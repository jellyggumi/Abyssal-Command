#!/usr/bin/env bash
# Refresh the graphify export inside the wiki root, then lint the authored vault.
#
# WHY A WRAPPER
# -------------
# The llm-wiki vault root is this repository root, so the upstream lint script
# walks every markdown file in the repo -- node_modules READMEs, .claude agent
# definitions, archived run artifacts, and the 328 generated graphify community
# notes. Those are not vault pages and their "broken links" and "orphans" are
# noise that buries the real findings.
#
# This wrapper scopes the lint to what a human or an agent actually authored:
#   index.md, log.md, raw/**, wiki/** except wiki/graph/**
#
# Usage:
#   bash scripts/wiki-sync.sh            # export + lint
#   bash scripts/wiki-sync.sh --lint     # lint only
#   bash scripts/wiki-sync.sh --export   # export only
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LINT="${HOME}/.agents/skills/llm-wiki/scripts/lint-wiki.py"
DO_EXPORT=1
DO_LINT=1

case "${1:-}" in
  --lint) DO_EXPORT=0 ;;
  --export) DO_LINT=0 ;;
  "") ;;
  *) echo "unknown option: $1" >&2; exit 2 ;;
esac

cd "$REPO"

if ((DO_EXPORT)); then
  if [[ ! -f .graphify/graph.json ]]; then
    echo "[wiki-sync] no .graphify/graph.json -- run 'graphify update' first" >&2
    exit 1
  fi
  mkdir -p wiki/graph
  graphify export obsidian --dir wiki/graph
fi

if ((DO_LINT)); then
  # Mirror only the authored vault into a scratch root so the upstream linter
  # sees a clean vault instead of the whole repository.
  scratch="$(mktemp -d)"
  trap 'rm -rf "$scratch"' EXIT

  mkdir -p "$scratch/raw/sources" "$scratch/raw/assets" \
           "$scratch/wiki/sources" "$scratch/wiki/entities" \
           "$scratch/wiki/concepts" "$scratch/wiki/queries" "$scratch/wiki/reports"
  # AGENTS.md/CLAUDE.md are the vault contract the linter requires present.
  cp index.md log.md AGENTS.md CLAUDE.md "$scratch/" 2>/dev/null || true
  for d in raw wiki; do
    if [[ -d "$d" ]]; then
      # -a preserves the tree; wiki/graph is the one generated subtree to drop.
      (cd "$d" && find . -type f -not -path "./graph/*" -print0) \
        | while IFS= read -r -d '' f; do
            mkdir -p "$scratch/$d/$(dirname "$f")"
            cp "$d/$f" "$scratch/$d/$f"
          done
    fi
  done

  echo "[wiki-sync] linting authored vault (wiki/graph excluded)"
  # macOS mktemp returns /var/... which the linter reports as /private/var/...
  python3 "$LINT" "$scratch" | sed -e "s|/private$scratch|<vault>|g" -e "s|$scratch|<vault>|g"
fi
