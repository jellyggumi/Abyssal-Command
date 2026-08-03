# Workspace Editor

Edit and preview the game-studio-harness production documents under
`_workspace/` — markdown-aware, artifact-contract-aware, no dependencies.

```bash
node _workspace/editor/server.mjs        # opens http://127.0.0.1:4488/
node _workspace/editor/server.mjs --port 5000 --no-open
```

Node 22, standard library only. No npm install, no build step, no CDN.

---

## Why a server

`file://` cannot write files. The File System Access API is gated on a secure
context and unavailable there, so a page opened directly off disk can render
these documents but never save one. This server owns every disk operation; the
frontend stays static files.

## What it is built around

`_workspace/` is not an ordinary docs folder. Nine git worktrees and several
harness agents write it concurrently, and
`references/artifact-contract.md` states its artifacts are studio memory that
is never deleted. Three behaviours follow from that:

**Concurrent-write detection.** Every save carries the mtime the client last
read. A mismatch is refused with 409 rather than clobbering the other writer;
your edit is stashed and you choose *open the disk version* or *overwrite
anyway*. The comparison is exact — a tolerance window would wave through the
one case this guards, two writers landing in the same second.

**No delete route.** The server exposes none. Every overwrite first copies the
previous bytes into `.backups/` (gitignored). Rename with `F2` to clear
something out of the way.

**Dot-prefixed names are refused.** The tree walk skips them, so such a
document would be invisible the moment it closed — and with no delete route,
unremovable. Creation and rename both reject them.

## The tree renders the contract, not the filesystem

`ghostsFor()` compares each role folder against the artifact contract and
renders what the contract requires but the run does not have: dotted rows with
the gate they feed (`G6`, `G2`, `전 게이트`). Clicking one scaffolds it with
`owner`, `gate`, and the run's real `run-id` filled in.

That run-id is read from the run's own briefs, not from the directory name —
the active run lives in `current/`, whose real id (`{YYYYMMDD}-{cycle-label}`)
appears only inside its documents. When no document declares one, the scaffold
writes a placeholder comment rather than inventing a value.

Sidebar counts are run-level and stable: collapsing a folder does not change
them, because a completeness number that shrank when you collapsed something
would be worse than no number. Hover for the breakdown.

## Keys

| | |
|---|---|
| `⌘S` | save |
| `⌘P` | focus the file filter |
| `⌘⇧F` | full-text search across the run |
| `⌘1` `⌘2` `⌘3` | edit / split / preview |
| `⌘B` `⌘K` | bold / link |
| `⌘⇧L` | align GFM tables (CJK-aware widths) |
| `⌘⇧R` | re-read from disk |
| `F2` `⌘E` | rename / move |
| `Tab` `⇧Tab` | indent / outdent selection |

`Enter` continues list and task-list structure. Preview re-renders debounced;
scroll is synced both ways (`⇅` toggles). Unsaved edits are stashed to
`localStorage` and offered back when you reopen the document.

## Reading long documents

These run 400–800 lines and are table-dense. Wide tables scroll horizontally
with a sticky header rather than wrapping — a five-column Korean table that
wraps becomes six lines tall per row. `▭` switches to a denser mode.

`≡ 목차` toggles an outline rail that jumps by source line. YAML fences are
framed distinctly because they carry the gate-checkable numbers. Status tokens
(`[OBSERVED]`, `PASS`/`FIX`/`REDO`, `S1`–`S4`, `done`/`blocked`, `G1`–`G8`)
render as pills. Relative `.md` links navigate in-place.

## Files

| | |
|---|---|
| `server.mjs` | file API + static host; path safety, mtime conflicts, backups |
| `index.html` | DOM contract |
| `app.js` | tree, editor, save protocol, run-id resolution |
| `markdown.js` | renderer, outline, table alignment, stats |
| `styles.css` | theme |

### API

```
GET  /api/health                    GET  /api/runs
GET  /api/tree?run=current          GET  /api/file?path=…
GET  /api/grep?q=…&run=…            GET  /api/raw?path=…      (images/binaries)
PUT  /api/file                      { path, content, baseMtime, force? }
POST /api/file                      { path, content }
POST /api/dir                       { path }
POST /api/move                      { from, to }
```

Paths are workspace-relative. Escaping `_workspace/` is refused (403), as is
writing to `editor/` itself.

## Open decision

This tool sits inside `_workspace/`, which the artifact contract reserves for
run artifacts. `.backups/` and temp files are gitignored; whether the tool
itself belongs in the repo, outside `_workspace/`, or ignored wholesale is
still yours to make.
