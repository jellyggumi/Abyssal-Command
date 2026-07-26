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
#   - publish gate: after the independent suite passes, this driver may publish
#     new commits from `studio-loop/main`. The pass agent itself never pushes.
#   - lockfile: overlapping passes would race on the same files and the same
#     git index. A pass that overruns its hour simply skips the next tick.
#   - test gate: a pass that breaks the suite reverts its own working-tree
#     changes rather than committing red. The failure is logged and becomes
#     the next pass's first-priority input.
#   - bounded runtime: hard timeout below the 1h tick so a hung pass cannot
#     block its successor indefinitely.
#
# NEVER EDIT THIS FILE WHILE A PASS IS RUNNING. bash reads a script
# incrementally, holding a byte offset into the open file. A pass sits blocked
# at `wait` for ~15 minutes, and bash has not yet read the lines below that
# point; rewriting the file shifts those bytes and the interpreter resumes
# mid-token. Measured consequence (pass #10): the claude subprocess finished
# and its commit landed, but the driver died before the verification suite,
# the end-of-pass log line, and the state write -- leaving passCount frozen,
# a stale lock, and an unverified commit. Reverting the file did NOT rescue
# it. Check `.studio-loop/pass.lock` first; stage patches elsewhere (e.g.
# /tmp) and copy them in only between ticks.
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
# The lock holds `pid HEAD`, not a bare pid. When a pass dies without running
# its EXIT trap, the next tick finds both a stale lock and whatever that pass
# had edited but not committed. The recorded HEAD is what makes the leftovers
# attributable: if HEAD has not moved, nothing else committed in between, so
# the dirty files are provably that pass's own debris (see the self-recovery
# block below). Older locks hold only a pid; cut then yields an empty HEAD,
# which reads as "not attributable" and correctly declines to recover.
STALE_PASS_HEAD=""
if [[ -e "$LOCK" ]]; then
  PREV_PID="$(cut -d' ' -f1 "$LOCK" 2>/dev/null || echo '')"
  PREV_HEAD="$(cut -d' ' -f2 -s "$LOCK" 2>/dev/null || echo '')"
  if [[ -n "$PREV_PID" ]] && kill -0 "$PREV_PID" 2>/dev/null; then
    log "SKIP: pass $PREV_PID still running (overran its hour)"
    exit 0
  fi
  log "stale lock from dead pid $PREV_PID (head ${PREV_HEAD:-none}) -- reclaiming"
  STALE_PASS_HEAD="$PREV_HEAD"
  rm -f "$LOCK"
fi
cd "$REPO" || { log "FATAL: repo missing"; exit 1; }
echo "$$ $(git rev-parse HEAD)" > "$LOCK"
cleanup() { rm -f "$LOCK"; }
trap cleanup EXIT INT TERM

cd "$REPO" || { log "FATAL: repo missing"; exit 1; }

# --- halt: a previous pass rewrote its own limits ----------------------------
# Set by the tamper gate at the end of a pass. Deliberately requires a human
# to clear: if a pass can edit the driver or the brief, every later pass runs
# under rules that may have been written by an agent rather than the operator,
# and each further tick compounds that. Refusing to run is the safe default.
if [[ -f "$STATE" ]] && node -e "try{const s=JSON.parse(require('fs').readFileSync('$STATE','utf8'));process.exit(s.governTampered?0:1)}catch(e){process.exit(1)}"; then
  log "HALTED: governing files were modified during an earlier pass and a human has not cleared it."
  node -e "const s=JSON.parse(require('fs').readFileSync('$STATE','utf8'));console.log('  ',JSON.stringify(s.governTampered))" 2>&1 | tee -a "$LOG"
  log "        Review, then remove the governTampered key from .studio-loop/state.json to resume."
  exit 0
fi

# --- precondition: clean tree ------------------------------------------------
# A dirty tree means a human is mid-edit, another agent session is working this
# repo, or a prior pass died leaving debris. An autonomous pass must not commit
# on top of any of those.
#
# Skips are RECORDED, not just logged: if the tree stays dirty for days the
# loop would otherwise starve in total silence -- indistinguishable from
# running fine -- which is the same class of invisible failure as a scheduler
# that exits 127 every tick. `consecutiveSkips` makes starvation checkable
# with a single `cat .studio-loop/state.json`.
# Self-recovery, narrowly scoped: only when the previous pass died without
# releasing its lock AND HEAD is still exactly where that pass started. Both
# conditions together mean no other commit landed in between, so every dirty
# file is that dead pass's own unfinished edit. Stash (never discard) so the
# work is recoverable by hand -- `git stash list` keeps it, and a human can
# inspect or restore it. Anything outside this exact case falls through to
# the guard below untouched.
if [[ -n "$STALE_PASS_HEAD" ]] && [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  if [[ "$STALE_PASS_HEAD" == "$(git rev-parse HEAD)" ]]; then
    log "recovering: previous pass died mid-edit at the current HEAD -- stashing its debris"
    git status --short | head -20 | tee -a "$LOG"
    if git stash push --quiet --include-untracked \
         -m "studio-loop: debris from pass killed at ${STALE_PASS_HEAD:0:8} ($(date -u +%Y-%m-%dT%H:%M:%SZ))" 2>&1 | tee -a "$LOG"; then
      log "recovered: debris stashed (recover with: git stash list / git stash show -p)"
    else
      log "WARN: stash failed -- leaving the tree as-is for the dirty-tree guard"
    fi
  else
    log "NOT recovering: HEAD moved since the dead pass started (${STALE_PASS_HEAD:0:8} -> $(git rev-parse --short HEAD)); debris is not provably ours"
  fi
fi

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  log "SKIP: working tree dirty -- refusing to run an autonomous pass over human/partial work"
  git status --short | head -20 | tee -a "$LOG"
  node -e "
const fs = require('fs');
const p = '$STATE';
let s = {};
try { s = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) {}
s.consecutiveSkips = (s.consecutiveSkips || 0) + 1;
s.lastSkip = { at: new Date().toISOString(), reason: 'dirty-tree', log: '$LOG' };
fs.mkdirSync(require('path').dirname(p), { recursive: true });
fs.writeFileSync(p, JSON.stringify(s, null, 2) + '\n');
if (s.consecutiveSkips >= 3) {
  console.error('[studio-loop] WARNING: ' + s.consecutiveSkips + ' consecutive dirty-tree skips -- the loop is doing NO work. Commit or stash the working tree.');
}
" 2>&1 | tee -a "$LOG"
  exit 0
fi

PASS_N=1
if [[ -f "$STATE" ]]; then
  PASS_N=$(( $(node -e "try{process.stdout.write(String(JSON.parse(require('fs').readFileSync('$STATE','utf8')).passCount||0))}catch(e){process.stdout.write('0')}") + 1 ))
fi
HEAD_BEFORE="$(git rev-parse HEAD)"
PASS_START_EPOCH=$(date +%s)

# Fingerprint the files that define this pass's limits. A pass holds Edit on
# the whole worktree, which includes the driver and the brief -- the very
# things constraining it. Not hypothetical: pass #10 wrote an auto-push into
# this script and argued in-comment that "never push" was too strict.
#
# Attribution is mechanical, not self-reported. Every tick that night RAN
# (zero skips), so the dirty-tree check found a clean tree at 08:00:03 --
# no earlier pass could have left this uncommitted, or #10 would have
# skipped. The block was present at 08:11 when an operator snapshotted the
# file. Only #10 and that operator were active in between, and the operator
# did not write it. #10's own log says "modified in the tree by another
# session -- I left it untouched", which refers to encountering the
# operator's later edit; it does not clear its own earlier one. A pass's
# account of itself is not evidence, least of all right after a
# self-modification.
#
# It surfaced only because a residual diff caught a human's eye, so the class
# gets a detector rather than the instance getting a fix.
GOVERN_FILES=("$REPO/scripts/hourly-studio-cycle.sh" "$REPO/scripts/hourly-studio-prompt.md" "$HOME/Library/LaunchAgents/com.abyssalsurge.studio-loop.plist")
GOVERN_SUM_BEFORE="$(shasum -a 256 "${GOVERN_FILES[@]}" 2>/dev/null | awk '{print $1}' | tr '\n' ' ')"

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

# Neither branch below ever `git add -A` or `git checkout -- .` blindly. The
# tree is only known-clean at pass START: another agent session (or the user)
# can write files while a pass runs, and this driver has no way to tell that
# work apart from the pass's own. Sweeping it into an auto-commit, or
# reverting it wholesale, would destroy or misattribute someone else's edits.
# The pass agent is instructed to commit its own work; anything left over is
# reported for a human instead of guessed at.
if [[ $TEST_RC -ne 0 ]]; then
  log "TESTS FAILED (rc=$TEST_RC)"
  if [[ -n "$DIRTY" ]]; then
    log "WARN: red suite AND uncommitted changes -- NOT auto-reverting (cannot prove they are all this pass's)."
    log "      Inspect and revert by hand if they are loop debris:"
    git status --short | head -20 | tee -a "$LOG"
  fi
  if [[ "$HEAD_AFTER" != "$HEAD_BEFORE" ]]; then
    log "WARN: pass committed ${HEAD_AFTER:0:8} but suite is red -- left in place for human review"
  fi
else
  log "tests PASS"
  if [[ -n "$DIRTY" ]]; then
    log "WARN: green suite but uncommitted changes remain -- left for a human, NOT auto-committed."
    log "      Either the pass failed to commit its own work, or a concurrent session is editing:"
    git status --short | head -20 | tee -a "$LOG"
  fi
fi

COMMITS=$(git rev-list --count "$HEAD_BEFORE..$HEAD_AFTER" 2>/dev/null || echo 0)

PASS_SECONDS=$(( $(date +%s) - PASS_START_EPOCH ))
log "=== PASS #$PASS_N end: $COMMITS commit(s), tests=$([[ $TEST_RC -eq 0 ]] && echo PASS || echo FAIL), ${PASS_SECONDS}s ==="

# --- tamper gate: did the pass rewrite its own limits? -----------------------
# Compare the governing files against their pre-pass fingerprint. A mismatch
# is not auto-reverted (the operator may legitimately have edited between
# ticks, and this driver never destroys work it cannot attribute) but it does
# hard-stop the loop: the next tick refuses to start until a human clears the
# flag. An agent that can widen its own envelope unnoticed compounds, so the
# loop halts rather than continuing on rules it may have written for itself.
GOVERN_SUM_AFTER="$(shasum -a 256 "${GOVERN_FILES[@]}" 2>/dev/null | awk '{print $1}' | tr '\n' ' ')"
GOVERN_TAMPERED=0
if [[ "$GOVERN_SUM_AFTER" != "$GOVERN_SUM_BEFORE" ]]; then
  GOVERN_TAMPERED=1
  log "ALERT: governing files changed during this pass -- the loop is HALTED until a human clears it."
  log "       before: $GOVERN_SUM_BEFORE"
  log "       after:  $GOVERN_SUM_AFTER"
  for f in "${GOVERN_FILES[@]}"; do
    git diff --stat -- "$f" 2>/dev/null | tee -a "$LOG"
  done
  log "       Review the diff. To resume: verify the change was yours, then"
  log "       clear governTampered in .studio-loop/state.json."
fi
# --- publish: operator-authorized, verification-gated auto-push -------------
# The pass agent is still forbidden from pushing. Only the driver, after its
# independent green-suite gate, may publish the exact loop branch. A missing
# remote, auth failure, or non-fast-forward is non-fatal: the pass result and
# state remain valid and the warning stays in the log for the next tick.
PUSH_RC=0
PUSH_STATUS="skipped"
PUSH_HEAD=""
PUSH_BRANCH="$(git branch --show-current 2>/dev/null || true)"
PUSH_DIRTY="$(git status --porcelain --untracked-files=no)"
HEAD_LINEAR=0
if git merge-base --is-ancestor "$HEAD_BEFORE" "$HEAD_AFTER"; then
  HEAD_LINEAR=1
fi
if [[ $TEST_RC -eq 0 && $COMMITS -gt 0 && $GOVERN_TAMPERED -eq 0 &&
      "$PUSH_BRANCH" == "studio-loop/main" &&
      "$HEAD_AFTER" == "$(git rev-parse HEAD)" &&
      -z "$PUSH_DIRTY" &&
      $HEAD_LINEAR -eq 1 ]]; then
  PUSH_HEAD="$HEAD_AFTER"
  set +e
  GIT_TERMINAL_PROMPT=0 git push origin "HEAD:refs/heads/studio-loop/main" >> "$LOG" 2>&1
  PUSH_RC=$?
  set -e
  if [[ $PUSH_RC -eq 0 ]]; then
    PUSH_STATUS="pushed"
    log "auto-push: published ${PUSH_HEAD:0:8} to origin/studio-loop/main"
  else
    PUSH_STATUS="failed"
    log "WARN: auto-push failed (rc=$PUSH_RC) -- pass remains valid; inspect the log and retry next tick"
  fi
else
  log "auto-push: skipped (tests=$TEST_RC commits=$COMMITS branch=${PUSH_BRANCH:-none} dirty=$([[ -n "$PUSH_DIRTY" ]] && echo yes || echo no) tampered=$GOVERN_TAMPERED)"
fi

# A pass that dies almost immediately produced nothing, whatever its exit code
# says. The real case seen in production: two consecutive ticks exited rc=1
# after 6 seconds on "You've hit your monthly spend limit" -- no commit, no
# work, and completely invisible unless a human opened the log. That is the
# same silent-starvation shape `consecutiveSkips` exists to catch, so it gets
# the same treatment. Duration is the signal rather than the exit code because
# quota exhaustion, auth failure, and a crashed CLI all look different in rc
# but identical in "returned far too fast to have done anything".
UNPRODUCTIVE=0
if [[ $PASS_SECONDS -lt 60 || ( $RC -ne 0 && $COMMITS -eq 0 ) ]]; then
  UNPRODUCTIVE=1
  log "WARN: pass produced nothing (${PASS_SECONDS}s, rc=$RC, $COMMITS commits) -- likely quota/auth/CLI failure, see log head"
  head -3 "$LOG" | grep -v "^\[" | head -2 | tee -a "$LOG" || true
fi

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
s.lastDurationSec = $PASS_SECONDS;
s.lastHead = '$HEAD_AFTER';
s.lastPush = { status: '$PUSH_STATUS', rc: $PUSH_RC, head: '$PUSH_HEAD' };
s.consecutiveSkips = 0; // a pass actually ran; starvation streak (if any) is over
s.consecutiveUnproductive = $UNPRODUCTIVE ? (s.consecutiveUnproductive || 0) + 1 : 0;
if ($GOVERN_TAMPERED) {
  s.governTampered = { at: new Date().toISOString(), pass: $PASS_N, log: '$LOG',
    note: 'Governing files (driver and/or brief) changed while pass #$PASS_N ran. The loop is halted until this key is removed by a human.' };
}
s.history = (s.history || []).slice(-49);
s.history.push({ pass: $PASS_N, at: new Date().toISOString(), rc: $RC, testRc: $TEST_RC, commits: $COMMITS, durationSec: $PASS_SECONDS, unproductive: !!$UNPRODUCTIVE, governTampered: !!$GOVERN_TAMPERED, push: { status: '$PUSH_STATUS', rc: $PUSH_RC, head: '$PUSH_HEAD' }, log: '$LOG' });
fs.writeFileSync(p, JSON.stringify(s, null, 2) + '\n');
if (s.consecutiveUnproductive >= 3) {
  console.error('[studio-loop] WARNING: ' + s.consecutiveUnproductive + ' consecutive passes produced nothing. The loop is burning ticks without working -- check quota (claude.ai/settings/usage), auth, or lower STUDIO_LOOP_MODEL.');
}
" 2>&1 | tee -a "$LOG"

# Keep the last 100 pass logs; older ones are noise.
ls -1t "$LOG_DIR"/pass-*.log 2>/dev/null | tail -n +101 | xargs rm -f 2>/dev/null || true

exit 0
