#!/usr/bin/env node
/**
 * Workspace Editor — local file API + static host.
 *
 * The browser cannot write files from `file://` (the File System Access API is
 * gated on a secure context), so the editor is served from this tiny Node
 * stdlib server which owns every disk operation.
 *
 * Two properties matter more than features here:
 *
 *  1. `_workspace/` is written concurrently by harness agents and by several git
 *     worktrees. Every save therefore carries the mtime the client last read;
 *     a mismatch is refused with 409 instead of clobbering another writer.
 *  2. The artifact contract states workspace artifacts are studio memory and are
 *     never deleted. This server exposes no delete route at all, and every
 *     overwrite first copies the previous bytes into `.backups/`.
 *
 * Usage:  node _workspace/editor/server.mjs [--port 4488] [--no-open]
 */

import { createServer } from 'node:http';
import { readFile, writeFile, readdir, stat, mkdir, rename, copyFile, access, unlink } from 'node:fs/promises';
import { constants as FS } from 'node:fs';
import { join, resolve, relative, dirname, extname, basename, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const EDITOR_DIR = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = resolve(EDITOR_DIR, '..');          // _workspace/
const REPO = resolve(WORKSPACE, '..');                // repo root
const BACKUP_DIR = join(EDITOR_DIR, '.backups');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const START_PORT = Number(flag('--port', process.env.WS_EDITOR_PORT || 4488));
const AUTO_OPEN = !args.includes('--no-open');

/* ── file classification ─────────────────────────────────────────────── */

const TEXT_EXT = new Set([
  '.md', '.markdown', '.txt', '.json', '.yaml', '.yml', '.js', '.mjs', '.cjs',
  '.ts', '.mts', '.css', '.html', '.htm', '.svg', '.py', '.sh', '.mermaid',
  '.csv', '.tsv', '.log', '.tap', '.patch', '.diff', '.toml', '.ini', '.env',
]);
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp', '.ico']);
const SKIP_NAMES = new Set([
  '.DS_Store', '.git', 'node_modules', '__pycache__', '.backups', 'Thumbs.db',
]);
/** Asset trees that would swamp a document tree — thousands of binaries. */
const SKIP_DIRS = new Set(['concept-layers', 'ingame-mesh', 'derived-textures']);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.blend': 'application/octet-stream',
  // Audio needs a real type or <audio> refuses to decode it.
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.fbx': 'application/octet-stream', '.obj': 'text/plain; charset=utf-8',
  '.mtl': 'text/plain; charset=utf-8',
};

const kindOf = (name) => {
  const ext = extname(name).toLowerCase();
  if (TEXT_EXT.has(ext)) return 'text';
  if (IMAGE_EXT.has(ext)) return 'image';
  return 'binary';
};

/* ── path safety ─────────────────────────────────────────────────────── */

/**
 * Resolve a client-supplied workspace-relative path, refusing anything that
 * escapes `_workspace/` or reaches into the editor's own source.
 */
function safePath(rel) {
  if (typeof rel !== 'string' || rel.length === 0) throw httpError(400, 'path required');
  if (rel.includes('\0')) throw httpError(400, 'illegal path');
  const abs = resolve(WORKSPACE, rel.replace(/^\/+/, ''));
  const rp = relative(WORKSPACE, abs);
  if (rp.startsWith('..') || rp.startsWith(sep) || resolve(abs) !== abs) {
    throw httpError(403, 'path escapes _workspace/');
  }
  const first = rp.split(sep)[0];
  if (first === 'editor') throw httpError(403, 'editor source is not editable here');
  return { abs, rel: rp.split(sep).join('/') };
}

/**
 * Runtime assets live at the repo root, outside `_workspace/`, so they need a
 * second resolver. Containment is unchanged -- only the accepted prefix
 * widens, and only to `assets/`. Everything else at the repo root (`.git/`,
 * the live site JS, `tests/`) stays unreachable: the editor can overwrite and
 * delete here, and that blast radius must stay narrow.
 */
const ASSET_ROOTS = ['assets'];

function safeAssetPath(rel) {
  if (typeof rel !== 'string' || rel.length === 0) throw httpError(400, 'path required');
  if (rel.includes('\0')) throw httpError(400, 'illegal path');
  const abs = resolve(REPO, rel.replace(/^\/+/, ''));
  const rp = relative(REPO, abs);
  if (rp.startsWith('..') || rp.startsWith(sep) || resolve(abs) !== abs) {
    throw httpError(403, 'path escapes the repo');
  }
  const first = rp.split(sep)[0];
  if (!ASSET_ROOTS.includes(first)) {
    throw httpError(403, `only ${ASSET_ROOTS.map((r) => `${r}/`).join(', ')} is reachable here`);
  }
  return { abs, rel: rp.split(sep).join('/') };
}

const httpError = (status, message) => Object.assign(new Error(message), { status });

/* ── tree walk ───────────────────────────────────────────────────────── */

async function walk(absDir, relDir, depth, out) {
  let entries;
  try {
    entries = await readdir(absDir, { withFileTypes: true });
  } catch {
    return out;
  }
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name, 'en');
  });

  for (const ent of entries) {
    if (SKIP_NAMES.has(ent.name) || ent.name.startsWith('.')) continue;
    const rel = relDir ? `${relDir}/${ent.name}` : ent.name;
    const abs = join(absDir, ent.name);

    if (ent.isDirectory()) {
      const pruned = SKIP_DIRS.has(ent.name);
      const node = { type: 'dir', name: ent.name, path: rel, depth, children: [], pruned };
      out.push(node);
      if (!pruned && depth < 12) await walk(abs, rel, depth + 1, node.children);
      // Count only what a document editor cares about.
      node.docs = countDocs(node);
    } else if (ent.isFile()) {
      const kind = kindOf(ent.name);
      let size = 0, mtime = 0;
      try { const s = await stat(abs); size = s.size; mtime = s.mtimeMs; } catch { /* raced */ }
      out.push({ type: 'file', name: ent.name, path: rel, depth, kind, size, mtime });
    }
  }
  return out;
}

const countDocs = (node) => node.children.reduce(
  (n, c) => n + (c.type === 'dir' ? c.docs || 0 : c.kind === 'text' ? 1 : 0), 0,
);

/* ── run discovery ───────────────────────────────────────────────────── */

async function listRuns() {
  const runs = [];
  const push = async (rel, label, group) => {
    try {
      const s = await stat(join(WORKSPACE, rel));
      if (!s.isDirectory()) return;
      runs.push({ id: rel, label, group, mtime: s.mtimeMs });
    } catch { /* absent */ }
  };
  await push('current', 'current', 'active');

  try {
    for (const name of await readdir(join(WORKSPACE, 'archive'))) {
      if (SKIP_NAMES.has(name) || name.startsWith('.')) continue;
      await push(`archive/${name}`, name, 'archive');
    }
  } catch { /* no archive */ }

  // Any other top-level run directory (e.g. a dated run left outside archive/).
  try {
    for (const ent of await readdir(WORKSPACE, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      if (SKIP_NAMES.has(ent.name) || ent.name.startsWith('.')) continue;
      if (['current', 'archive', 'editor'].includes(ent.name)) continue;
      await push(ent.name, ent.name, 'other');
    }
  } catch { /* unreadable */ }

  const rank = { active: 0, other: 1, archive: 2 };
  runs.sort((a, b) => (rank[a.group] - rank[b.group]) || b.label.localeCompare(a.label, 'en'));
  return runs;
}

/* ── grep ────────────────────────────────────────────────────────────── */

async function grep(root, needle, limit = 200) {
  const hits = [];
  const lower = needle.toLowerCase();

  const visit = async (absDir, relDir) => {
    if (hits.length >= limit) return;
    let entries;
    try { entries = await readdir(absDir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      if (hits.length >= limit) return;
      if (SKIP_NAMES.has(ent.name) || ent.name.startsWith('.')) continue;
      const rel = relDir ? `${relDir}/${ent.name}` : ent.name;
      const abs = join(absDir, ent.name);
      if (ent.isDirectory()) {
        if (SKIP_DIRS.has(ent.name)) continue;
        await visit(abs, rel);
      } else if (kindOf(ent.name) === 'text') {
        let text;
        try { text = await readFile(abs, 'utf8'); } catch { continue; }
        if (!text.toLowerCase().includes(lower)) continue;
        const lines = text.split('\n');
        for (let i = 0; i < lines.length && hits.length < limit; i++) {
          if (!lines[i].toLowerCase().includes(lower)) continue;
          hits.push({ path: rel, line: i + 1, text: lines[i].trim().slice(0, 220) });
        }
      }
    }
  };
  await visit(join(WORKSPACE, root), root);
  return hits;
}

/* ── gate scan ───────────────────────────────────────────────────────── */

/**
 * Where a run actually stands on G1-G8.
 *
 * The artifact contract names `qa/gate-measurements.md` as the single source
 * for gate numbers and `production/gate-reviews/` for verdicts, but a live run
 * scatters gate references across every role folder. This walks the run once
 * and reports, per gate, which documents cite it and which of those carry a
 * verdict token -- so the editor can answer "where is G6" without opening
 * thirteen files.
 *
 * Counting only: it reads citations, never decides a verdict. QA owns
 * measurement and the director owns the verdict; this is a locator.
 */
async function scanGates(runRel) {
  const gates = {};
  for (let n = 1; n <= 8; n++) gates[`G${n}`] = [];
  const docs = [];

  const visit = async (absDir, relDir) => {
    let entries;
    try { entries = await readdir(absDir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      if (SKIP_NAMES.has(ent.name) || ent.name.startsWith('.')) continue;
      const rel = relDir ? `${relDir}/${ent.name}` : ent.name;
      const abs = join(absDir, ent.name);
      if (ent.isDirectory()) {
        if (SKIP_DIRS.has(ent.name)) continue;
        await visit(abs, rel);
      } else if (ent.name.endsWith('.md')) {
        let text;
        try { text = await readFile(abs, 'utf8'); } catch { continue; }

        // Strip fenced code so a sample table in a spec is not read as a citation.
        const prose = text.replace(/```[\s\S]*?```/g, '').replace(/~~~[\s\S]*?~~~/g, '');

        const cited = new Set();
        for (const m of prose.matchAll(/\bG([1-8])\b/g)) cited.add(`G${m[1]}`);
        if (!cited.size) continue;

        const verdicts = {};
        for (const v of ['PASS', 'FIX', 'REDO']) {
          const c = (prose.match(new RegExp(`\\b${v}\\b`, 'g')) || []).length;
          if (c) verdicts[v] = c;
        }
        // A measured claim needs a number; flag docs that cite a gate with none.
        const hasNumbers = /\d+(\.\d+)?\s*(%|%p|ms|s\b|\/5)/.test(prose);

        const entry = { path: rel, gates: [...cited].sort(), verdicts, hasNumbers };
        docs.push(entry);
        for (const g of cited) gates[g].push(rel);
      }
    }
  };
  await visit(join(WORKSPACE, runRel), runRel);

  // The two artifacts the contract makes authoritative for gates.
  const authority = {
    'qa/gate-measurements.md': await exists(join(WORKSPACE, runRel, 'qa/gate-measurements.md')),
    'production/gate-reviews': await exists(join(WORKSPACE, runRel, 'production/gate-reviews')),
  };

  return { run: runRel, gates, docs, authority };
}

/* ── asset lane ──────────────────────────────────────────────────────── */

const AUDIO_EXT  = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.webm']);
const MESH_EXT   = new Set(['.glb', '.gltf', '.fbx', '.obj']);
const VIDEO_EXT  = new Set(['.mp4', '.webm', '.mov']);

const assetKind = (name) => {
  const e = extname(name).toLowerCase();
  if (IMAGE_EXT.has(e)) return 'image';
  if (AUDIO_EXT.has(e)) return 'audio';
  if (MESH_EXT.has(e)) return 'mesh';
  if (VIDEO_EXT.has(e)) return 'video';
  if (TEXT_EXT.has(e)) return 'text';
  return 'other';
};

/**
 * Which runtime sources name which asset paths.
 *
 * This is the whole point of the asset lane: dropping a file into `assets/`
 * does NOT put it in the game. Audio needs an entry in
 * `assets/audio/elevenlabs/index.json`, UI images need a `[data-ui-icon]` rule
 * in `styles.css`, and meshes are hardcoded in `battle-realtime-three.js`.
 * Overwriting an already-referenced path reflects immediately; a brand-new
 * file does not until something names it. So the editor reports, per asset,
 * whether the runtime can see it and from where.
 *
 * Cached and invalidated by the newest source mtime -- a scan is ~40 file
 * reads and the sources change far less often than the assets.
 */
let refCache = null;

async function assetReferenceIndex() {
  const sources = [];
  for (const ent of await readdir(REPO, { withFileTypes: true })) {
    if (!ent.isFile()) continue;
    if (/\.(js|mjs|cjs|css|html|json)$/i.test(ent.name)) sources.push(ent.name);
  }
  // `assets/audio/elevenlabs/index.json` IS a runtime consumer: DefenseAudio
  // fetches it. `assets/defense-asset-manifest.json` is NOT -- it is a
  // generated inventory of the same assets, so counting it would mark all
  // 1070 as referenced and invert the signal entirely. Its own
  // `runtimeReference` field is read separately as a second opinion.
  sources.push('assets/audio/elevenlabs/index.json');

  let newest = 0;
  const stamps = await Promise.all(sources.map(async (s) => {
    try { return (await stat(join(REPO, s))).mtimeMs; } catch { return 0; }
  }));
  for (const m of stamps) if (m > newest) newest = m;
  if (refCache && refCache.newest === newest) return refCache;

  const byAsset = new Map();          // asset path -> [{ source, line }]
  for (const src of sources) {
    let text;
    try { text = await readFile(join(REPO, src), 'utf8'); } catch { continue; }
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (const m of lines[i].matchAll(/assets\/[A-Za-z0-9_\-./]+\.[A-Za-z0-9]{2,5}/g)) {
        const p = m[0];
        if (!byAsset.has(p)) byAsset.set(p, []);
        const list = byAsset.get(p);
        if (list.length < 6) list.push({ source: src, line: i + 1 });
      }
    }
  }
  // Second opinion: the build script's own conclusion per asset. Where this
  // disagrees with the live scan, the manifest is stale -- itself worth seeing.
  const manifest = new Map();
  try {
    const m = JSON.parse(await readFile(join(REPO, 'assets/defense-asset-manifest.json'), 'utf8'));
    for (const row of m.rows || []) {
      manifest.set(row.currentPath, {
        disposition: row.disposition, runtimeReference: row.runtimeReference,
      });
    }
  } catch { /* manifest absent or unparseable — live scan stands alone */ }

  refCache = { newest, byAsset, manifest, sources: sources.length };
  return refCache;
}

/**
 * Flat asset listing with reference status. Flat rather than a tree because
 * the useful grouping here is by kind and by whether the runtime sees it, not
 * by directory -- 978 of this repo's 1071 assets are unreferenced, and they do
 * not cluster by folder.
 */
async function scanAssets({ kind = null, refs = null, dir = null } = {}) {
  const index = await assetReferenceIndex();
  const rows = [];

  const visit = async (absDir, relDir) => {
    let entries;
    try { entries = await readdir(absDir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      if (ent.name.startsWith('.') || SKIP_NAMES.has(ent.name)) continue;
      const rel = `${relDir}/${ent.name}`;
      const abs = join(absDir, ent.name);
      if (ent.isDirectory()) {
        await visit(abs, rel);
      } else if (ent.isFile()) {
        const k = assetKind(ent.name);
        const referencedBy = index.byAsset.get(rel) || [];
        if (kind && k !== kind) continue;
        if (refs === 'referenced' && !referencedBy.length) continue;
        if (refs === 'orphan' && referencedBy.length) continue;
        if (dir && !rel.startsWith(dir)) continue;
        let size = 0, mtime = 0;
        try { const s = await stat(abs); size = s.size; mtime = s.mtimeMs; } catch { /* raced */ }
        const mf = index.manifest.get(rel) || null;
        rows.push({
          path: rel, name: ent.name, kind: k, size, mtime, referencedBy,
          manifest: mf,
          // The build script and the live scan disagreeing means the manifest
          // predates a change -- surfaced rather than silently preferred.
          stale: mf ? (mf.runtimeReference !== (referencedBy.length > 0)) : false,
        });
      }
    }
  };
  await visit(join(REPO, 'assets'), 'assets');

  rows.sort((a, b) => b.mtime - a.mtime);

  const totals = { all: 0, referenced: 0, orphan: 0, stale: 0, byKind: {} };
  for (const r of rows) {
    totals.all++;
    r.referencedBy.length ? totals.referenced++ : totals.orphan++;
    if (r.stale) totals.stale++;
    totals.byKind[r.kind] = (totals.byKind[r.kind] || 0) + 1;
  }

  // The disk walk cannot see an asset that a runtime source names but that is
  // not there -- the worst case, because the game 404s at runtime instead of
  // degrading. Invert the index to find them. (This is not hypothetical: a
  // referenced video was removed in this repo while the editor was being
  // built, and only this check catches it.)
  const onDisk = new Set(rows.map((r) => r.path));
  const broken = [];
  for (const [path, sources] of index.byAsset) {
    if (onDisk.has(path)) continue;
    if (!path.startsWith('assets/')) continue;
    if (await exists(join(REPO, path))) continue;   // filtered out of rows, not missing
    broken.push({ path, kind: assetKind(path), referencedBy: sources });
  }
  broken.sort((a, b) => a.path.localeCompare(b.path));

  return {
    rows: rows.slice(0, 600), truncated: rows.length > 600, totals,
    broken, sources: index.sources,
  };
}

/* ── mutations ───────────────────────────────────────────────────────── */

const exists = async (p) => { try { await access(p, FS.F_OK); return true; } catch { return false; } };

async function backup(abs, rel) {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = join(BACKUP_DIR, `${rel.replace(/[/\\]/g, '__')}.${stamp}.bak`);
    await mkdir(BACKUP_DIR, { recursive: true });
    await copyFile(abs, dest);
    return relative(WORKSPACE, dest).split(sep).join('/');
  } catch {
    return null;                            // backup is best-effort, never fatal
  }
}

/**
 * Atomic write: land bytes in a sibling temp file, then rename over target.
 * The temp name is dot-prefixed so a crash mid-write cannot leave a visible
 * orphan in the document tree -- and since this server exposes no delete
 * route, a visible orphan would be unremovable from the editor.
 */
async function writeAtomic(abs, content) {
  await mkdir(dirname(abs), { recursive: true });
  const tmp = join(dirname(abs), `.${basename(abs)}.${process.pid}.${Date.now()}.tmp`);
  try {
    await writeFile(tmp, content, 'utf8');
    await rename(tmp, abs);
  } catch (err) {
    await unlink(tmp).catch(() => {});      // never mask the original failure
    throw err;
  }
}

async function saveFile({ path, content, baseMtime, force }) {
  const { abs, rel } = safePath(path);
  if (typeof content !== 'string') throw httpError(400, 'content must be a string');
  if (kindOf(basename(abs)) !== 'text') throw httpError(415, 'not a text file');

  let current = null;
  try { current = await stat(abs); } catch { /* new file */ }

  if (current && baseMtime != null && !force) {
    // Exact compare. The client got this mtime from this server reading this
    // filesystem, so no granularity tolerance is warranted -- and a coarse
    // window (e.g. 1s) would wave through exactly the case this guards:
    // two writers landing on the same file within the same second.
    // The epsilon covers float-representation noise only.
    if (Math.abs(current.mtimeMs - Number(baseMtime)) > 0.001) {
      throw Object.assign(httpError(409, 'file changed on disk since it was opened'), {
        detail: { diskMtime: current.mtimeMs, baseMtime: Number(baseMtime) },
      });
    }
  }

  const backedUp = current ? await backup(abs, rel) : null;
  await writeAtomic(abs, content);
  const after = await stat(abs);
  return { path: rel, mtime: after.mtimeMs, size: after.size, backup: backedUp, created: !current };
}

/**
 * The tree walk skips dot-prefixed entries, so a document created with one
 * would be invisible the moment it closed -- unreachable through the UI, and
 * with no delete route, unremovable too. Refuse it at creation instead.
 */
function refuseHidden(rel) {
  const bad = rel.split('/').find((seg) => seg.startsWith('.'));
  if (bad) {
    throw httpError(400,
      `"${bad}" 는 점으로 시작해 문서 트리에 표시되지 않습니다 — 다른 이름을 쓰세요`);
  }
}

async function createFile({ path, content = '' }) {
  const { abs, rel } = safePath(path);
  refuseHidden(rel);
  if (await exists(abs)) throw httpError(409, 'already exists');
  await writeAtomic(abs, content);
  const s = await stat(abs);
  return { path: rel, mtime: s.mtimeMs, size: s.size, created: true };
}

async function createDir({ path }) {
  const { abs, rel } = safePath(path);
  refuseHidden(rel);
  if (await exists(abs)) throw httpError(409, 'already exists');
  await mkdir(abs, { recursive: true });
  return { path: rel, type: 'dir' };
}

/** Rename/move. Never destructive: refuses an existing destination. */
async function movePath({ from, to }) {
  const src = safePath(from);
  const dst = safePath(to);
  refuseHidden(dst.rel);            // renaming into invisibility is the same trap
  if (!await exists(src.abs)) throw httpError(404, 'source not found');
  if (await exists(dst.abs)) throw httpError(409, 'destination already exists');
  await mkdir(dirname(dst.abs), { recursive: true });
  await rename(src.abs, dst.abs);
  return { from: src.rel, to: dst.rel };
}

/* ── asset mutations ─────────────────────────────────────────────────── */

/**
 * Write an asset from base64. Overwrite is the interesting case: replacing a
 * path the runtime already names is the only way a new file reflects in-game
 * immediately, so the response reports what now references it.
 */
async function writeAsset({ path, base64, force }) {
  const { abs, rel } = safeAssetPath(path);
  if (typeof base64 !== 'string' || !base64) throw httpError(400, 'base64 required');

  const existing = await exists(abs);
  if (existing && !force) throw httpError(409, 'asset exists — pass force to overwrite');

  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length) throw httpError(400, 'decoded to zero bytes');

  let backedUp = null;
  if (existing) {
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      await mkdir(BACKUP_DIR, { recursive: true });
      const dest = join(BACKUP_DIR, `${rel.replace(/[/\\]/g, '__')}.${stamp}.bak`);
      await copyFile(abs, dest);
      backedUp = relative(REPO, dest).split(sep).join('/');
    } catch { /* best effort */ }
  }

  await mkdir(dirname(abs), { recursive: true });
  const tmp = join(dirname(abs), `.${basename(abs)}.${process.pid}.${Date.now()}.tmp`);
  try {
    await writeFile(tmp, bytes);
    await rename(tmp, abs);
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw err;
  }

  const index = await assetReferenceIndex();
  const referencedBy = index.byAsset.get(rel) || [];
  const s = await stat(abs);
  return {
    path: rel, size: s.size, mtime: s.mtimeMs, overwrote: existing, backup: backedUp,
    referencedBy,
    inGame: referencedBy.length > 0,
    note: referencedBy.length
      ? '런타임이 이미 이 경로를 참조합니다 — 즉시 반영됩니다'
      : '이 경로를 참조하는 런타임 소스가 없습니다 — 등록 없이는 인게임에 나타나지 않습니다',
  };
}

/**
 * Delete an asset. Deliberately NOT available for `_workspace/`: the artifact
 * contract makes those documents studio memory. Assets are different -- the
 * manifest already carries `historicalDeletionRows`, so this project treats
 * asset removal as a normal, recorded operation.
 *
 * Two guards: a runtime-referenced asset is refused outright (deleting it
 * breaks the game), and the bytes are copied to `.backups/` first.
 */
async function deleteAsset({ path, force }) {
  const { abs, rel } = safeAssetPath(path);
  if (!await exists(abs)) throw httpError(404, 'not found');

  const index = await assetReferenceIndex();
  const referencedBy = index.byAsset.get(rel) || [];
  if (referencedBy.length && !force) {
    throw Object.assign(httpError(409, 'runtime references this asset — deleting it breaks the game'), {
      detail: { referencedBy },
    });
  }

  let backedUp = null;
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await mkdir(BACKUP_DIR, { recursive: true });
    const dest = join(BACKUP_DIR, `${rel.replace(/[/\\]/g, '__')}.${stamp}.deleted`);
    await copyFile(abs, dest);
    backedUp = relative(REPO, dest).split(sep).join('/');
  } catch { /* best effort */ }

  await unlink(abs);
  return {
    path: rel, deleted: true, backup: backedUp,
    wasReferenced: referencedBy.length > 0, referencedBy,
    manifestNote: 'assets/defense-asset-manifest.json 은 파생 파일입니다 — '
      + 'scripts/build-defense-asset-manifest.mjs --write 로 재생성하세요',
  };
}

/**
 * Register an audio asset in the ElevenLabs sample map, which is what actually
 * puts a sound in the game. Dropping the mp3 alone does nothing: `app.js`
 * hands DefenseAudio `assets/audio/elevenlabs/index.json`, and only the
 * `cues`/`loops` entries there are fetched.
 */
async function registerAudioCue({ key, path, gain = 0.9, kind = 'cues' }) {
  if (!['cues', 'loops'].includes(kind)) throw httpError(400, 'kind must be cues or loops');
  if (!key || typeof key !== 'string') throw httpError(400, 'key required');
  const { rel } = safeAssetPath(path);

  const idxPath = join(REPO, 'assets/audio/elevenlabs/index.json');
  let idx;
  try { idx = JSON.parse(await readFile(idxPath, 'utf8')); }
  catch (err) { throw httpError(500, `sample map unreadable: ${err.message}`); }

  idx[kind] = idx[kind] || {};
  const previous = idx[kind][key] || null;
  idx[kind][key] = { url: rel, gain: Number(gain) };

  const tmp = `${idxPath}.${process.pid}.tmp`;
  try {
    await writeFile(tmp, `${JSON.stringify(idx, null, 2)}\n`, 'utf8');
    await rename(tmp, idxPath);
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw err;
  }
  refCache = null;                    // the sample map is itself a ref source
  return { key, kind, path: rel, gain: Number(gain), previous, inGame: true };
}

/* ── HTTP plumbing ───────────────────────────────────────────────────── */

const sendJSON = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  res.end(payload);
};

async function readBody(req, limit = 32 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw httpError(413, 'payload too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw httpError(400, 'invalid JSON body'); }
}

async function serveStatic(res, urlPath) {
  const name = urlPath === '/' || urlPath === '' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const abs = resolve(EDITOR_DIR, name);
  if (!abs.startsWith(EDITOR_DIR + sep) && abs !== join(EDITOR_DIR, 'index.html')) {
    return sendJSON(res, 403, { error: 'forbidden' });
  }
  try {
    const body = await readFile(abs);
    res.writeHead(200, {
      'content-type': MIME[extname(abs).toLowerCase()] || 'application/octet-stream',
      'content-length': body.length,
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    sendJSON(res, 404, { error: 'not found', path: name });
  }
}

/**
 * Stream a file by its own bytes — image/audio/mesh/binary preview.
 *
 * Accepts both roots: a workspace path, or an `assets/` path so the browser
 * can play a cue and show a plate without a second server. Range requests are
 * honoured because `<audio>`/`<video>` seek with them.
 */
async function serveRaw(res, relPath, range) {
  const { abs } = relPath && relPath.startsWith('assets/')
    ? safeAssetPath(relPath) : safePath(relPath);
  const type = MIME[extname(abs).toLowerCase()] || 'application/octet-stream';
  const s = await stat(abs);

  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m) {
      const start = m[1] ? Number(m[1]) : 0;
      const end = m[2] ? Math.min(Number(m[2]), s.size - 1) : s.size - 1;
      if (start <= end) {
        const body = (await readFile(abs)).subarray(start, end + 1);
        res.writeHead(206, {
          'content-type': type,
          'content-length': body.length,
          'content-range': `bytes ${start}-${end}/${s.size}`,
          'accept-ranges': 'bytes',
          'cache-control': 'no-store',
        });
        return res.end(body);
      }
    }
  }

  const body = await readFile(abs);
  res.writeHead(200, {
    'content-type': type,
    'content-length': body.length,
    'accept-ranges': 'bytes',
    'cache-control': 'no-store',
  });
  res.end(body);
}

const ROUTES = {
  'GET /api/health': async () => ({
    ok: true, workspace: WORKSPACE, repo: REPO, pid: process.pid, node: process.version,
    // The client caches this so a later session finds the API even when the
    // page is served from another origin and the port has drifted.
    port: server.address()?.port ?? null,
  }),
  'GET /api/runs': async () => ({ runs: await listRuns() }),
  'GET /api/tree': async (url) => {
    const run = url.searchParams.get('run') || 'current';
    const { abs, rel } = safePath(run);
    if (!(await stat(abs)).isDirectory()) throw httpError(400, 'run is not a directory');
    return { run: rel, tree: await walk(abs, rel, 0, []) };
  },
  'GET /api/file': async (url) => {
    const { abs, rel } = safePath(url.searchParams.get('path'));
    const s = await stat(abs);
    if (s.isDirectory()) throw httpError(400, 'path is a directory');
    const kind = kindOf(basename(abs));
    if (kind !== 'text') return { path: rel, kind, size: s.size, mtime: s.mtimeMs, content: null };
    return { path: rel, kind, size: s.size, mtime: s.mtimeMs, content: await readFile(abs, 'utf8') };
  },
  'GET /api/grep': async (url) => {
    const q = url.searchParams.get('q') || '';
    if (q.trim().length < 2) throw httpError(400, 'query too short');
    const run = url.searchParams.get('run') || 'current';
    const { rel } = safePath(run);
    return { query: q, run: rel, hits: await grep(rel, q.trim()) };
  },
  'GET /api/gates': async (url) => {
    const { rel } = safePath(url.searchParams.get('run') || 'current');
    return scanGates(rel);
  },
  'GET /api/assets': async (url) => scanAssets({
    kind: url.searchParams.get('kind') || null,
    refs: url.searchParams.get('refs') || null,
    dir:  url.searchParams.get('dir') || null,
  }),
  'PUT /api/asset':      async (_url, body) => writeAsset(body),
  'POST /api/asset/del': async (_url, body) => deleteAsset(body),
  'POST /api/audio/cue': async (_url, body) => registerAudioCue(body),
  'PUT /api/file': async (_url, body) => saveFile(body),
  'POST /api/file': async (_url, body) => createFile(body),
  'POST /api/dir': async (_url, body) => createDir(body),
  'POST /api/move': async (_url, body) => movePath(body),
};

/**
 * Loopback-only CORS.
 *
 * The editor is often served by a different local server than this one -- the
 * repo's game dev server (`python -m http.server` on :8000) hands out
 * `_workspace/editor/index.html`, and then the page's API calls are
 * cross-origin. Allowing that is necessary, but a blanket `*` would let any
 * page the user happens to visit read and DELETE through this API.
 *
 * So the origin must be loopback. A remote page sends its own origin, which
 * fails this test, and browsers will not let it forge the header. That also
 * closes DNS rebinding: a hostname resolving to 127.0.0.1 still carries its
 * real origin.
 */
const LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return true;                    // same-origin or a non-browser client
  if (!LOOPBACK_ORIGIN.test(origin)) return false;
  res.setHeader('access-control-allow-origin', origin);
  res.setHeader('vary', 'origin');
  res.setHeader('access-control-allow-methods', 'GET, PUT, POST, OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('access-control-max-age', '600');
  return true;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const key = `${req.method} ${url.pathname}`;

  res.setHeader('x-content-type-options', 'nosniff');

  if (!applyCors(req, res)) {
    return sendJSON(res, 403, { error: 'cross-origin request from a non-loopback origin' });
  }
  if (req.method === 'OPTIONS') {          // preflight for PUT/POST + content-type
    res.writeHead(204);
    return res.end();
  }

  try {
    if (url.pathname === '/api/raw' && req.method === 'GET') {
      return await serveRaw(res, url.searchParams.get('path'), req.headers.range);
    }
    const handler = ROUTES[key];
    if (handler) {
      const body = req.method === 'GET' ? undefined : await readBody(req);
      return sendJSON(res, 200, await handler(url, body));
    }
    if (url.pathname.startsWith('/api/')) {
      return sendJSON(res, 404, { error: 'no such endpoint', endpoint: key });
    }
    if (req.method !== 'GET') return sendJSON(res, 405, { error: 'method not allowed' });
    return await serveStatic(res, url.pathname);
  } catch (err) {
    const status = err.status
      || (err.code === 'ENOENT' ? 404 : err.code === 'EISDIR' ? 400
        : err.code === 'EACCES' || err.code === 'EPERM' ? 403 : 500);
    if (status >= 500) console.error(`[error] ${key}:`, err);
    sendJSON(res, status, { error: err.message, ...(err.detail ? { detail: err.detail } : {}) });
  }
});

/* ── boot, with port fallback ────────────────────────────────────────── */

function listen(port, attempt = 0) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < 12) {
      console.log(`포트 ${port} 사용 중 — ${port + 1} 시도`);
      listen(port + 1, attempt + 1);
    } else {
      console.error('서버를 시작할 수 없습니다:', err.message);
      process.exit(1);
    }
  });
  server.listen(port, '127.0.0.1', () => {
    const target = `http://127.0.0.1:${port}/`;
    console.log('');
    console.log('  Workspace Editor');
    console.log(`  ${target}`);
    console.log(`  workspace: ${WORKSPACE}`);
    console.log('  Ctrl+C 로 종료');
    console.log('');
    if (AUTO_OPEN) {
      const cmd = process.platform === 'darwin' ? 'open'
        : process.platform === 'win32' ? 'start' : 'xdg-open';
      spawn(cmd, [target], { stdio: 'ignore', detached: true, shell: process.platform === 'win32' })
        .on('error', () => { /* headless is fine */ })
        .unref();
    }
  });
}

listen(START_PORT);

process.on('SIGINT', () => { server.close(); process.exit(0); });
process.on('SIGTERM', () => { server.close(); process.exit(0); });
