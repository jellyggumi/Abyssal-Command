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
  '.glb': 'model/gltf-binary', '.blend': 'application/octet-stream',
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

/** Stream a workspace file by its own bytes — used for image/binary preview. */
async function serveRaw(res, relPath) {
  const { abs } = safePath(relPath);
  const body = await readFile(abs);
  res.writeHead(200, {
    'content-type': MIME[extname(abs).toLowerCase()] || 'application/octet-stream',
    'content-length': body.length,
    'cache-control': 'no-store',
  });
  res.end(body);
}

const ROUTES = {
  'GET /api/health': async () => ({
    ok: true, workspace: WORKSPACE, repo: REPO, pid: process.pid, node: process.version,
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
  'PUT /api/file': async (_url, body) => saveFile(body),
  'POST /api/file': async (_url, body) => createFile(body),
  'POST /api/dir': async (_url, body) => createDir(body),
  'POST /api/move': async (_url, body) => movePath(body),
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const key = `${req.method} ${url.pathname}`;

  res.setHeader('x-content-type-options', 'nosniff');

  try {
    if (url.pathname === '/api/raw' && req.method === 'GET') {
      return await serveRaw(res, url.searchParams.get('path'));
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
