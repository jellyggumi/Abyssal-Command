#!/usr/bin/env bash
# Hourly game-studio-harness improvement pass for Abyssal Surge.
#
# One invocation = ONE bounded improvement pass, not a full 3-stage cycle.
# The harness is a standing structure (skill://game-studio-harness): this
# script is the clock that keeps it turning. Each pass reads the newest
# task-manifest to find where the last pass stopped, does one increment of
# real work, verifies it, commits locally, and appends a retrospective note
# so the *next* pass has a sharper starting view than this one did.
#
# Safety contract (why each guard exists):
#   - never pushes: a broken auto-push deploys to live Pages. Local commits
#     only; a human pushes after reviewing the accumulated passes.
#   - lockfile: overlapping passes would race on the same files and the same
#     git index. A pass that overruns its hour simply skips the next tick.
#   - test gate: a pass that breaks the suite reverts its own working-tree
#     changes rather than committing red. The failure is logged and becomes
#     the next pass's first-priority input.
#   - bounded runtime: hard timeout below the 1h tick so a hung pass cannot
#     block its successor indefinitely.
#
# Usage:
#   scripts/hourly-studio-cycle.sh            # one pass now
#   scripts/hourly-studio-cycle.sh --dry-run  # print the prompt, run nothing
set -uo pipefail

# launchd hands this script a minimal PATH (/usr/bin:/bin:/usr/sbin:/sbin) that
# contains none of the binaries this loop needs. Pin them explicitly so a
# scheduled run behaves identically to an interactive one. node's dir is
# version-pinned deliberately: resolving it via `nvm use` would need an
# interactive shell init that launchd does not provide.
export PATH="$HOME/.local/bin:$HOME/.nvm/versions/node/v22.19.0/bin:/opt/homebrew/bin:/Applications/Obsidian.app/Contents/MacOS:/usr/bin:/bin:/usr/sbin:/sbin"

# The user-level Claude settings export LLM_WIKI_VAULT/OBSIDIAN_VAULT_PATH
# pointing at a DIFFERENT project (a Unity repo, unknown-castle) -- stale
# config that a pass would otherwise inherit and use to file this game's wiki
# updates into the wrong vault. Pin them to the real llm-wiki vault, which is
# also what this repo's CLAUDE.md documents.
export LLM_WIKI_VAULT="$HOME/vaults/llm-wiki"
export OBSIDIAN_VAULT_PATH="$HOME/vaults/llm-wiki"

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$REPO/.studio-loop"
LOG_DIR="$STATE_DIR/logs"
LOCK="$STATE_DIR/pass.lock"
STATE="$STATE_DIR/state.json"
PROMPT="$REPO/scripts/hourly-studio-prompt.md"

# Below the 3600s tick so an overrunning pass never collides with the next.
PASS_TIMEOUT_SEC="${PASS_TIMEOUT_SEC:-3000}"
MODEL="${STUDIO_LOOP_MODEL:-opus}"

mkdir -p "$LOG_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
LOG="$LOG_DIR/pass-$TS.log"

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*" | tee -a "$LOG"; }

if [[ "${1:-}" == "--dry-run" ]]; then
  echo "--- repo: $REPO"
  echo "--- model: $MODEL   timeout: ${PASS_TIMEOUT_SEC}s"
  echo "--- prompt: $PROMPT"
  echo "--- state: $STATE"
  echo
  cat "$PROMPT"
  exit 0
fi

# --- lock: skip (not queue) if a previous pass is still running -------------
if [[ -e "$LOCK" ]]; then
  PREV_PID="$(cat "$LOCK" 2>/dev/null || echo '')"
  if [[ -n "$PREV_PID" ]] && kill -0 "$PREV_PID" 2>/dev/null; then
    log "SKIP: pass $PREV_PID still running (overran its hour)"
    exit 0
  fi
  log "stale lock from dead pid $PREV_PID -- reclaiming"
  rm -f "$LOCK"
fi
echo $$ > "$LOCK"
cleanup() { rm -f "$LOCK"; }
trap cleanup EXIT INT TERM

cd "$REPO" || { log "FATAL: repo missing"; exit 1; }

# --- precondition: clean tree ------------------------------------------------
# A dirty tree means a human is mid-edit, or a prior pass died leaving debris.
# Either way an autonomous pass must not commit on top of it.
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  log "SKIP: working tree dirty -- refusing to run an autonomous pass over human/partial work"
  git status --short | head -20 | tee -a "$LOG"
  exit 0
fi

PASS_N=1
if [[ -f "$STATE" ]]; then
  PASS_N=$(( $(node -e "try{process.stdout.write(String(JSON.parse(require('fs').readFileSync('$STATE','utf8')).passCount||0))}catch(e){process.stdout.write('0')}") + 1 ))
fi
HEAD_BEFORE="$(git rev-parse HEAD)"

log "=== PASS #$PASS_N start (model=$MODEL, head=${HEAD_BEFORE:0:8}) ==="

# --- run one pass ------------------------------------------------------------
# acceptEdits alone is NOT enough: it auto-approves edits but still gates Bash,
# and a gated tool in non-interactive -p mode is simply denied (measured: a
# probe run in this repo with acceptEdits-only had `git log` and a wiki `ls`
# both come back BLOCKED, which would leave every pass unable to test, commit,
# or write the wiki). --allowedTools is what actually unblocks them. The pass
# therefore runs its own tests/git; this driver re-verifies independently below
# rather than trusting the agent's self-report.
PASS_PROMPT="$(cat "$PROMPT")

## This pass
- pass number: **#$PASS_N**
- started: $(date '+%Y-%m-%d %H:%M:%S %Z')
- HEAD at start: \`$HEAD_BEFORE\`
- log file: \`$LOG\`"

# Bash watchdog instead of timeout(1): this is macOS without GNU coreutils,
# so `timeout` does not exist. Calling it would exit 127 instantly and turn
# every scheduled tick into a silent no-op that still logged success.
set +e
claude \
  -p "$PASS_PROMPT" \
  --model "$MODEL" \
  --permission-mode acceptEdits \
  --allowedTools "Bash Read Edit Write Glob Grep Skill Agent" \
  --add-dir "$HOME/vaults/llm-wiki" \
  >> "$LOG" 2>&1 &
CLAUDE_PID=$!
(
  sleep "$PASS_TIMEOUT_SEC"
  if kill -0 "$CLAUDE_PID" 2>/dev/null; then
    echo "[watchdog] killing overrunning pass $CLAUDE_PID after ${PASS_TIMEOUT_SEC}s" >> "$LOG"
    kill -TERM "$CLAUDE_PID" 2>/dev/null
    sleep 10
    kill -KILL "$CLAUDE_PID" 2>/dev/null
  fi
) &
WATCHDOG_PID=$!
wait "$CLAUDE_PID"
RC=$?
kill "$WATCHDOG_PID" 2>/dev/null
wait "$WATCHDOG_PID" 2>/dev/null
set -e

case "$RC" in
  0)              log "pass exited clean" ;;
  143|137)        log "TIMEOUT: watchdog killed pass after ${PASS_TIMEOUT_SEC}s -- verifying tree state" ;;
  *)              log "pass exited rc=$RC -- verifying tree state" ;;
esac

# --- verify: the suite must be green, whatever the agent claimed -------------
# This is the real gate. An agent's self-report is not evidence; the test
# runner is. Runs regardless of the agent's exit code, because a timeout can
# still leave good committed work behind.
log "running verification suite..."
set +e
node --test 'tests/**/*.test.mjs' >> "$LOG" 2>&1
TEST_RC=$?
set -e

HEAD_AFTER="$(git rev-parse HEAD)"
DIRTY="$(git status --porcelain --untracked-files=no)"

if [[ $TEST_RC -ne 0 ]]; then
  log "TESTS FAILED (rc=$TEST_RC)"
  if [[ -n "$DIRTY" ]]; then
    log "reverting uncommitted changes from failed pass"
    git checkout -- . 2>&1 | tee -a "$LOG"
    git clean -fd -- '*.tmp' 2>&1 | tee -a "$LOG" || true
  fi
  if [[ "$HEAD_AFTER" != "$HEAD_BEFORE" ]]; then
    log "WARN: pass committed ${HEAD_AFTER:0:8} but suite is red -- left in place for human review, NOT auto-reverted"
  fi
else
  log "tests PASS"
  if [[ -n "$DIRTY" ]]; then
    log "WARN: pass left uncommitted changes with a green suite -- committing as a checkpoint"
    git add -A
    git commit -q -m "chore(studio-loop): pass #$PASS_N uncommitted remainder

Auto-committed by scripts/hourly-studio-cycle.sh because the pass ended
with a green test suite but left changes unstaged. Review before push."
    HEAD_AFTER="$(git rev-parse HEAD)"
  fi
fi

COMMITS=$(git rev-list --count "$HEAD_BEFORE..$HEAD_AFTER" 2>/dev/null || echo 0)
log "=== PASS #$PASS_N end: $COMMITS commit(s), tests=$([[ $TEST_RC -eq 0 ]] && echo PASS || echo FAIL) ==="

node -e "
const fs = require('fs');
const p = '$STATE';
let s = {};
try { s = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) {}
s.passCount = $PASS_N;
s.lastRun = new Date().toISOString();
s.lastRc = $RC;
s.lastTestRc = $TEST_RC;
s.lastCommits = $COMMITS;
s.lastHead = '$HEAD_AFTER';
s.history = (s.history || []).slice(-49);
s.history.push({ pass: $PASS_N, at: new Date().toISOString(), rc: $RC, testRc: $TEST_RC, commits: $COMMITS, log: '$LOG' });
fs.writeFileSync(p, JSON.stringify(s, null, 2) + '\n');
"

# Keep the last 100 pass logs; older ones are noise.
ls -1t "$LOG_DIR"/pass-*.log 2>/dev/null | tail -n +101 | xargs rm -f 2>/dev/null || true

exit 0
