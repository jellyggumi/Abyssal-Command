/**
 * Workspace Editor — application logic.
 *
 * Edits the game-studio-harness production documents under `_workspace/`.
 * All disk access goes through `server.mjs`; this module owns the UI, the
 * harness-aware document tree, and the save/conflict protocol.
 */

import { renderMarkdown, extractOutline, formatTables, renderStats } from './markdown.js';

/* ══════════════════════════════════════════════════════════════════════
   Harness artifact contract
   references/artifact-contract.md defines which artifact each role folder
   owns. The tree renders the contract, not just the filesystem: documents
   the contract expects but that do not exist yet appear as ghost rows you
   can click to create. That turns the sidebar into a completeness view.
   ══════════════════════════════════════════════════════════════════════ */

const ROLES = {
  intake:         { label: '인테이크',   owner: 'director',  order: 1 },
  design:         { label: '디자인',     owner: 'designer',  order: 2 },
  pm:             { label: 'PM',         owner: 'pm',        order: 3 },
  engineering:    { label: '엔지니어링', owner: 'programmer', order: 4 },
  ops:            { label: '운영',       owner: 'programmer', order: 5 },
  qa:             { label: 'QA',         owner: 'qa',        order: 6 },
  production:     { label: '프로덕션',   owner: 'director',  order: 7 },
  messages:       { label: '메시지',     owner: 'all',       order: 8 },
  retrospectives: { label: '회고',       owner: 'director',  order: 9 },
  ui:            { label: 'UI',          owner: 'designer',  order: 10 },
};

/** Artifact → the gate it feeds. Drives the ghost rows and tree badges. */
const CONTRACT = {
  intake:      [['production-brief.md', '—']],
  design:      [['concept.md', '—'], ['worldview.md', 'G1'], ['balance-sheet.md', 'G2'],
                ['core-loop.md', 'G7'], ['novelty-scorecard.md', 'G8'],
                ['presentation-spec.md', 'G4']],
  pm:          [['revenue-map.md', 'G5'], ['reward-bands.md', 'G5'],
                ['negotiation-record.md', 'G5'], ['revenue-forecast.md', 'G5']],
  engineering: [['architecture-contract.md', '—'], ['perf-budget.md', 'G6'],
                ['movement-optimization.md', 'G6'], ['resource-manifest.md', 'G6']],
  ops:         [['telemetry-contract.md', 'G6'], ['rollback-runbook.md', 'G6'],
                ['release-readiness.md', 'G6']],
  qa:          [['test-plan.md', '—'], ['benchmark-notes.md', 'G8'],
                ['playtest-report.md', 'G3/G7'], ['exploit-register.md', 'G2'],
                ['defect-register.md', '—'], ['regression-matrix.md', 'G4'],
                ['discovery-notes.md', '—'], ['gate-measurements.md', '전 게이트']],
  production:  [['task-manifest.md', '—'], ['decision-log.md', '—']],
};

/**
 * Boilerplate for a contract artifact created from a ghost row.
 *
 * `runId` is resolved from the run's own documents, not from the directory
 * name: the active run lives in `current/`, whose real run-id ({YYYYMMDD}-
 * {cycle-label}) only exists inside its briefs. Writing `run-id: current`
 * would put a value in a contract artifact that names no run at all.
 */
const scaffold = (role, name, gate, runId) => {
  const title = name.replace(/\.md$/, '').replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const owner = ROLES[role]?.owner ?? 'director';
  return `# ${title}\n\n`
    + `run-id: ${runId ? `\`${runId}\`` : '<!-- 미확인 — 런 브리프에서 채우세요 -->'}\n`
    + `owner: ${owner}\n`
    + `gate: ${gate}\n`
    + `status: \`[TARGET] — 미측정\`\n\n---\n\n## 1. \n\n`
    + `| 항목 | 값 | 근거 |\n|---|---|---|\n|  |  |  |\n`;
};

/* ══════════════════════════════════════════════════════════════════════
   State
   ══════════════════════════════════════════════════════════════════════ */

const state = {
  run: 'current',
  runs: [],
  tree: [],
  open: new Set(),         // expanded dir paths
  file: null,              // { path, kind, mtime, size }
  baseline: '',            // last-saved content, for the dirty check
  dirty: false,
  view: 'split',
  sync: true,
  outline: true,
  wide: false,
  showMissing: true,
  filter: '',
  conflict: false,
  runId: null,             // real {YYYYMMDD}-{label}, read from the run's briefs
};

const DRAFTS = 'ws-editor:drafts';
const PREFS = 'ws-editor:prefs';

/* ══════════════════════════════════════════════════════════════════════
   DOM
   ══════════════════════════════════════════════════════════════════════ */

const $ = (id) => document.getElementById(id);
const el = {
  runSelect: $('run-select'), runMeta: $('run-meta'), crumbs: $('crumbs'),
  btnSync: $('btn-sync'), btnReload: $('btn-reload'), btnSave: $('btn-save'),
  filter: $('filter-input'), btnGrep: $('btn-grep'), btnDrawer: $('btn-drawer'),
  btnNewFile: $('btn-new-file'), btnNewFolder: $('btn-new-folder'), btnCollapse: $('btn-collapse'),
  legend: $('legend'), tree: $('tree'), treeStat: $('tree-stat'), toggleMissing: $('toggle-missing'),
  gutterSidebar: $('gutter-sidebar'), gutterPanes: $('gutter-panes'),
  main: $('main'), sidebar: $('sidebar'),
  mdtools: $('mdtools'), conflictFlag: $('conflict-flag'),
  editorWrap: $('editor-wrap'), lineNumbers: $('line-numbers'), editor: $('editor'),
  btnOutline: $('btn-outline'), btnWide: $('btn-wide'), previewStat: $('preview-stat'),
  previewBody: document.querySelector('.preview__body'),
  outline: $('outline'), preview: $('preview'), viewer: $('viewer'),
  stPath: $('st-path'), stDirty: $('st-dirty'), stCursor: $('st-cursor'),
  stCounts: $('st-counts'), stMtime: $('st-mtime'), stServer: $('st-server'),
  modal: $('modal'), modalTitle: $('modal-title'), modalDesc: $('modal-desc'),
  modalInput: $('modal-input'), modalList: $('modal-list'),
  modalCancel: $('modal-cancel'), modalOk: $('modal-ok'),
  toasts: $('toasts'),
};

/* ══════════════════════════════════════════════════════════════════════
   API
   ══════════════════════════════════════════════════════════════════════ */

async function api(path, init) {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw Object.assign(new Error(body.error || `HTTP ${res.status}`),
    { status: res.status, detail: body.detail });
  return body;
}
const jsonInit = (method, body) => ({
  method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

/* ══════════════════════════════════════════════════════════════════════
   Toast / modal
   ══════════════════════════════════════════════════════════════════════ */

function toast(message, kind = 'ok', ms = 3200) {
  const node = document.createElement('div');
  node.className = `toast toast--${kind}`;
  node.textContent = message;
  el.toasts.append(node);
  setTimeout(() => {
    node.classList.add('is-out');
    setTimeout(() => node.remove(), 320);
  }, ms);
}

let modalResolve = null;

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.desc]
 * @param {string|null} [opts.value] input default; null hides the input
 * @param {Array}  [opts.items] selectable rows -> resolves with the item value
 * @param {string} [opts.ok]
 */
function modal({ title, desc = '', value = null, items = null, ok = '확인' }) {
  el.modalTitle.textContent = title;
  el.modalDesc.textContent = desc;
  el.modalDesc.hidden = !desc;
  el.modalOk.textContent = ok;

  const field = el.modalInput.parentElement;
  field.hidden = value === null;
  el.modalInput.value = value ?? '';

  el.modalList.innerHTML = '';
  el.modalList.hidden = !items;
  if (items) {
    for (const it of items) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'modal__item';
      row.innerHTML = it.html;
      row.addEventListener('click', () => closeModal(it.value));
      el.modalList.append(row);
    }
  }

  el.modal.hidden = false;
  el.modalOk.hidden = value === null && !!items;
  if (value !== null) {
    el.modalInput.focus();
    el.modalInput.setSelectionRange(0, el.modalInput.value.length);
  }
  return new Promise((res) => { modalResolve = res; });
}

function closeModal(result) {
  el.modal.hidden = true;
  el.modalList.innerHTML = '';
  const done = modalResolve;
  modalResolve = null;
  if (done) done(result);
}

el.modalCancel.addEventListener('click', () => closeModal(null));
// A modal with no input field is a confirm: OK resolves `true`, cancel `null`.
// Without this the two are indistinguishable and every confirm silently cancels.
const okValue = () => (el.modalInput.parentElement.hidden
  ? true : (el.modalInput.value.trim() || null));
el.modalOk.addEventListener('click', () => closeModal(okValue()));
el.modal.addEventListener('mousedown', (e) => { if (e.target === el.modal) closeModal(null); });
el.modalInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); closeModal(el.modalInput.value.trim() || null); }
});

/* ══════════════════════════════════════════════════════════════════════
   Tree
   ══════════════════════════════════════════════════════════════════════ */

const roleOf = (path) => {
  const parts = path.split('/');
  const idx = path.startsWith('archive/') ? 2 : 1;
  const seg = parts[idx];
  return ROLES[seg] ? seg : '';
};

const ICON = { dir: '▸', md: '◆', text: '·', image: '▣', binary: '▪' };
const iconFor = (node) => {
  if (node.type === 'dir') return ICON.dir;
  if (node.name.endsWith('.md')) return ICON.md;
  return ICON[node.kind] || ICON.text;
};

function renderLegend() {
  el.legend.innerHTML = '';
  for (const [key, meta] of Object.entries(ROLES).sort((a, b) => a[1].order - b[1].order)) {
    const chip = document.createElement('span');
    chip.className = 'legend__chip';
    chip.dataset.role = key;
    chip.textContent = meta.label;
    chip.title = `${key}/ — ${meta.owner}`;
    chip.addEventListener('click', () => {
      el.filter.value = el.filter.value === `${key}/` ? '' : `${key}/`;
      state.filter = el.filter.value.toLowerCase();
      renderTree();
    });
    el.legend.append(chip);
  }
}

/** Contract artifacts absent from a role folder, as ghost rows. */
function ghostsFor(dirNode) {
  if (!state.showMissing) return [];
  const role = dirNode.path.split('/').pop();
  const spec = CONTRACT[role];
  if (!spec || dirNode.path.split('/').length > 2 + (state.run.startsWith('archive/') ? 1 : 0)) {
    return [];
  }
  const present = new Set(dirNode.children.filter((c) => c.type === 'file').map((c) => c.name));
  return spec
    .filter(([name]) => !present.has(name))
    .map(([name, gate]) => ({
      type: 'missing', name, gate, role,
      path: `${dirNode.path}/${name}`, depth: dirNode.depth + 1,
    }));
}

/**
 * Run-level totals, independent of which folders are expanded.
 *
 * `docs` counts editable text files (the server's `kind === 'text'`, which
 * includes json/yaml/py alongside markdown), `md` narrows that to markdown,
 * and `missing` is every contract gap in the run -- not just the gaps inside
 * open folders.
 */
function runTotals() {
  let docs = 0, md = 0, missing = 0;
  const walk = (nodes) => {
    for (const node of nodes) {
      if (node.type === 'dir') {
        missing += ghostsFor(node).length;
        walk(node.children);
      } else if (node.kind === 'text') {
        docs++;
        if (node.name.endsWith('.md')) md++;
      }
    }
  };
  walk(state.tree);
  return { docs, md, missing };
}

const matches = (node) => !state.filter
  || node.path.toLowerCase().includes(state.filter)
  || node.name.toLowerCase().includes(state.filter);

/** A dir survives the filter when it or any descendant matches. */
function subtreeMatches(node) {
  if (matches(node)) return true;
  return node.type === 'dir' && node.children.some(subtreeMatches);
}

function renderTree() {
  el.tree.innerHTML = '';
  // Counts are run-level, computed from the tree data rather than from the
  // rows that happen to be expanded -- a completeness number that shrank when
  // you collapsed a folder would be worse than no number.
  const totals = runTotals();

  const emit = (nodes, parent) => {
    for (const node of nodes) {
      if (node.type !== 'missing' && !subtreeMatches(node)) continue;

      const row = document.createElement('div');
      row.className = `tree__row tree__row--${node.type === 'missing' ? 'missing' : node.type}`;
      row.style.setProperty('--depth', String(node.depth));
      const role = roleOf(node.path);
      if (role) row.dataset.role = role;
      row.dataset.path = node.path;
      row.tabIndex = 0;

      if (node.type === 'dir') {
        const twisty = document.createElement('span');
        twisty.className = 'tree__twisty';
        if (state.open.has(node.path)) twisty.classList.add('is-open');
        twisty.textContent = '▸';
        row.append(twisty);
      } else {
        const icon = document.createElement('span');
        icon.className = 'tree__icon';
        icon.textContent = iconFor(node);
        row.append(icon);
      }

      const name = document.createElement('span');
      name.className = 'tree__name';
      name.textContent = node.name;
      row.append(name);

      if (node.type === 'dir') {
        const label = ROLES[node.name]?.label;
        if (label && node.depth <= 1) {
          const badge = document.createElement('span');
          badge.className = 'tree__badge';
          badge.textContent = label;
          row.append(badge);
        }
        const count = document.createElement('span');
        count.className = 'tree__count';
        count.textContent = node.pruned ? '⋯' : String(node.docs ?? 0);
        if (node.pruned) count.title = '자산 트리 — 문서 편집기에서 생략';
        row.append(count);
      } else if (node.type === 'missing') {
        const badge = document.createElement('span');
        badge.className = 'tree__badge';
        badge.textContent = node.gate === '—' ? '계약' : node.gate;
        badge.title = '아티팩트 계약이 요구하지만 아직 없음 — 클릭해 생성';
        row.append(badge);
      }

      if (state.file && state.file.path === node.path) row.classList.add('is-active');

      row.addEventListener('click', () => {
        if (node.type === 'dir') {
          state.open.has(node.path) ? state.open.delete(node.path) : state.open.add(node.path);
          renderTree();
        } else if (node.type === 'missing') {
          createContractDoc(node);
        } else {
          openFile(node.path);
        }
      });
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.click(); }
      });

      parent.append(row);

      if (node.type === 'dir' && (state.open.has(node.path) || state.filter)) {
        emit(node.children, parent);
        for (const ghost of ghostsFor(node)) {
          if (state.filter && !matches(ghost)) continue;
          emit([ghost], parent);
        }
      }
    }
  };

  emit(state.tree, el.tree);
  el.treeStat.textContent = `문서 ${totals.docs} · 그 중 md ${totals.md}`
    + (totals.missing ? ` · 계약 누락 ${totals.missing}` : '');
  el.treeStat.title = `${state.run} 전체 기준 — 펼침 상태와 무관\n`
    + `문서: 편집 가능한 텍스트 파일 ${totals.docs}개 (md ${totals.md}, 기타 ${totals.docs - totals.md})\n`
    + `계약 누락: 아티팩트 계약이 요구하지만 없는 문서 ${totals.missing}개`;
}

/* ══════════════════════════════════════════════════════════════════════
   Runs
   ══════════════════════════════════════════════════════════════════════ */

async function loadRuns() {
  const { runs } = await api('/api/runs');
  state.runs = runs;
  el.runSelect.innerHTML = '';
  const groups = { active: '활성', other: '기타', archive: '아카이브' };
  for (const key of ['active', 'other', 'archive']) {
    const list = runs.filter((r) => r.group === key);
    if (!list.length) continue;
    const group = document.createElement('optgroup');
    group.label = groups[key];
    for (const run of list) {
      const opt = document.createElement('option');
      opt.value = run.id;
      opt.textContent = run.label;
      group.append(opt);
    }
    el.runSelect.append(group);
  }
  el.runSelect.value = state.runs.some((r) => r.id === state.run) ? state.run : runs[0].id;
  state.run = el.runSelect.value;
}

async function loadTree() {
  const { tree } = await api(`/api/tree?run=${encodeURIComponent(state.run)}`);
  state.tree = tree;
  // Open the run root and its role folders so the studio layout is visible.
  for (const node of tree) if (node.type === 'dir') state.open.add(node.path);
  const active = state.runs.find((r) => r.id === state.run);
  // Tree first so the run-id resolver can see the run's documents, then the
  // resolved id joins the run label.
  state.runId = await resolveRunId();
  el.runMeta.textContent = active
    ? `${active.group === 'archive' ? '아카이브 (읽기 주의)' : '활성 런'}`
      + `${state.runId ? ` · ${state.runId}` : ''}`
    : '';
  renderTree();
}

/**
 * The directory name is not the run-id: the active run lives in `current/`.
 * The real id ({YYYYMMDD}-{cycle-label}) is declared inside the run's own
 * intake briefs and manifests, so read it from there and cache it per run --
 * `loadTree()` re-runs on every create, rename, and run switch, and the id
 * does not change under us.
 * Returns null when no document declares one; callers must then write a
 * placeholder rather than invent a value.
 */
const runIdCache = new Map();

async function resolveRunId() {
  if (runIdCache.has(state.run)) return runIdCache.get(state.run);

  const flat = [];
  (function walk(ns) { for (const n of ns) { flat.push(n); if (n.children) walk(n.children); } })(state.tree);

  // `intake/production-brief.md` is the contract's canonical name but does not
  // always carry the id, so the dated brief variants and the manifest follow.
  const ranked = flat.filter((n) => n.type === 'file' && n.name.endsWith('.md'))
    .map((n) => {
      const p = n.path;
      const score = /\/intake\/production-brief-/.test(p) ? 0
        : /\/production\/task-manifest\.md$/.test(p) ? 1
        : /\/intake\/production-brief\.md$/.test(p) ? 2
        : /\/intake\//.test(p) ? 3 : 9;
      return { path: p, score };
    })
    .filter((c) => c.score < 9)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  let found = null;
  for (const cand of ranked) {
    try {
      const { content } = await api(`/api/file?path=${encodeURIComponent(cand.path)}`);
      const hit = content && content.match(/run-id:\s*`?([0-9]{8}-[A-Za-z0-9._-]+)`?/);
      if (hit) { found = hit[1]; break; }
    } catch { /* unreadable candidate — try the next */ }
  }
  // Memoize hits only. Caching a miss would let one transient failure poison
  // the run for the whole session -- every later scaffold would write the
  // placeholder while the real id sat on disk. A miss re-scans, bounded by
  // the slice above.
  if (found) runIdCache.set(state.run, found);
  return found;
}

/* ══════════════════════════════════════════════════════════════════════
   Open / render
   ══════════════════════════════════════════════════════════════════════ */

const draftKey = (path) => `${state.run}:${path}`;
const readDrafts = () => { try { return JSON.parse(localStorage.getItem(DRAFTS) || '{}'); } catch { return {}; } };
const writeDrafts = (d) => { try { localStorage.setItem(DRAFTS, JSON.stringify(d)); } catch { /* full */ } };

function stashDraft() {
  if (!state.file || !state.dirty) return;
  const drafts = readDrafts();
  drafts[draftKey(state.file.path)] = { content: el.editor.value, at: Date.now() };
  writeDrafts(drafts);
}
function dropDraft(path) {
  const drafts = readDrafts();
  delete drafts[draftKey(path)];
  writeDrafts(drafts);
}

async function openFile(path, { line } = {}) {
  if (state.dirty && state.file && state.file.path !== path) {
    const keep = await modal({
      title: '저장하지 않은 변경',
      desc: `${state.file.path}\n\n변경을 임시 보관하고 이동합니다. 다시 열면 복구를 제안합니다.`,
      value: null, ok: '이동',
    });
    if (keep !== true) return;              // cancel keeps you on this document
    stashDraft();
  }

  let data;
  try {
    data = await api(`/api/file?path=${encodeURIComponent(path)}`);
  } catch (err) {
    toast(`열 수 없습니다: ${err.message}`, 'err');
    return;
  }

  state.file = { path: data.path, kind: data.kind, mtime: data.mtime, size: data.size };
  state.conflict = false;
  el.conflictFlag.hidden = true;

  if (data.kind !== 'text') {
    showViewer(data);
    renderCrumbs();
    renderTree();
    return;
  }

  el.viewer.hidden = true;
  el.preview.hidden = false;

  state.baseline = data.content;
  el.editor.value = data.content;
  el.editor.readOnly = false;
  setDirty(false);

  // A draft only exists when a previous session left unsaved edits behind.
  const draft = readDrafts()[draftKey(path)];
  if (draft && draft.content !== data.content) {
    const age = Math.round((Date.now() - draft.at) / 60000);
    const recover = await modal({
      title: '임시 보관된 변경 발견',
      desc: `${age}분 전 이 문서의 미저장 변경이 있습니다. `
          + '복구하면 편집기에 그 내용이 올라가고, 저장할 때까지 디스크는 그대로입니다.',
      value: null, ok: '복구',
    });
    if (recover === true) {
      el.editor.value = draft.content;      // baseline stays the disk bytes,
      setDirty(true);                        // so the diff shows as unsaved
      toast('임시 보관 내용 복구', 'ok');
    } else {
      dropDraft(path);
    }
  }

  renderAll();
  renderCrumbs();
  renderTree();
  if (line) gotoLine(line);
  el.editor.focus();
}

function showViewer(data) {
  el.preview.hidden = true;
  el.viewer.hidden = false;
  el.editor.value = '';
  el.editor.readOnly = true;
  state.baseline = '';
  setDirty(false);
  el.lineNumbers.textContent = '';

  const url = `/api/raw?path=${encodeURIComponent(data.path)}`;
  const kb = (data.size / 1024).toFixed(1);
  el.viewer.innerHTML = '';
  if (data.kind === 'image') {
    const img = document.createElement('img');
    img.src = url;
    img.alt = data.path;
    el.viewer.append(img);
  } else {
    const box = document.createElement('div');
    box.className = 'viewer__binary';
    box.textContent = '텍스트가 아닌 파일 — 편집할 수 없습니다';
    el.viewer.append(box);
  }
  const cap = document.createElement('div');
  cap.className = 'viewer__caption';
  cap.innerHTML = `<code>${escapeHTML(data.path)}</code> · ${kb} KB`
    + ` · <a href="${url}" target="_blank" rel="noopener">원본 열기</a>`;
  el.viewer.append(cap);

  el.previewStat.textContent = `${data.kind} · ${kb} KB`;
  el.stPath.textContent = data.path;
  el.stCounts.textContent = '';
  el.stCursor.textContent = '';
  el.stMtime.textContent = new Date(data.mtime).toLocaleString('ko-KR');
}

const escapeHTML = (s) => s.replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function renderCrumbs() {
  el.crumbs.innerHTML = '';
  if (!state.file) { el.crumbs.textContent = '문서를 선택하세요'; return; }
  for (const part of state.file.path.split('/')) {
    const span = document.createElement('span');
    span.className = 'crumbs__part';
    span.textContent = part;
    el.crumbs.append(span);
  }
}

/* ── preview + gutter ─────────────────────────────────────────────────── */

let renderTimer = null;
const scheduleRender = () => {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(renderAll, 120);
};

function renderAll() {
  const src = el.editor.value;
  el.preview.innerHTML = renderMarkdown(src);
  renderOutline(src);
  renderLineNumbers();

  const s = renderStats(src);
  el.previewStat.textContent = `표 ${s.tables} · 표제 ${s.headings}`
    + (s.todos ? ` · 미완 ${s.todos}` : '');
  el.stCounts.textContent = `${s.lines}행 · ${s.words}단어 · ${s.chars}자`;

  // In-workspace cross-references navigate instead of reloading the page.
  for (const link of el.preview.querySelectorAll('.md-xref')) {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      resolveXref(link.dataset.xref || link.getAttribute('href'));
    });
  }
  updateCursor();
}

function renderLineNumbers() {
  const count = el.editor.value.split('\n').length;
  const frag = [];
  for (let i = 1; i <= count; i++) frag.push(i);
  el.lineNumbers.textContent = frag.join('\n');
}

function renderOutline(src) {
  const items = extractOutline(src);
  el.outline.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'outline__empty';
    empty.textContent = '표제 없음';
    el.outline.append(empty);
    return;
  }
  for (const item of items) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'outline__item';
    row.style.setProperty('--level', String(item.level));
    row.dataset.level = String(item.level);   // styles.css keys emphasis off this
    row.textContent = item.text;
    row.title = `${item.line}행`;
    row.addEventListener('click', () => gotoLine(item.line));
    el.outline.append(row);
  }
}

/** Resolve a relative `.md` link from the current document and open it. */
function resolveXref(href) {
  if (!href || !state.file) return;
  if (/^https?:/i.test(href)) { window.open(href, '_blank', 'noopener'); return; }
  const clean = href.replace(/^\.\//, '').split('#')[0];
  if (!clean) return;
  const base = state.file.path.split('/').slice(0, -1);
  const parts = clean.split('/');
  const stack = [...base];
  for (const part of parts) {
    if (part === '..') stack.pop();
    else if (part !== '.') stack.push(part);
  }
  const target = stack.join('/');
  const flat = [];
  (function walk(ns) { for (const n of ns) { flat.push(n); if (n.children) walk(n.children); } })(state.tree);
  const hit = flat.find((n) => n.path === target)
    || flat.find((n) => n.type === 'file' && n.path.endsWith(`/${clean}`));
  if (hit) openFile(hit.path);
  else toast(`참조를 찾을 수 없습니다: ${clean}`, 'warn');
}

/* ── cursor / dirty ──────────────────────────────────────────────────── */

function updateCursor() {
  const upto = el.editor.value.slice(0, el.editor.selectionStart);
  const line = upto.split('\n').length;
  const col = upto.length - upto.lastIndexOf('\n');
  const sel = el.editor.selectionEnd - el.editor.selectionStart;
  el.stCursor.textContent = `${line}:${col}${sel ? ` (${sel} 선택)` : ''}`;
}

function setDirty(next) {
  state.dirty = next;
  el.btnSave.disabled = !next || !state.file || state.file.kind !== 'text';
  el.stDirty.classList.toggle('is-dirty', next);
  el.stDirty.textContent = next ? '● 미저장' : state.file ? '저장됨' : '';
  if (state.file) {
    el.stPath.textContent = state.file.path;
    el.stMtime.textContent = state.file.mtime
      ? new Date(state.file.mtime).toLocaleString('ko-KR') : '';
  }
}

function gotoLine(line) {
  const lines = el.editor.value.split('\n');
  const idx = Math.min(Math.max(line, 1), lines.length) - 1;
  const pos = lines.slice(0, idx).reduce((n, l) => n + l.length + 1, 0);
  el.editor.focus();
  el.editor.setSelectionRange(pos, pos + (lines[idx]?.length ?? 0));
  const lh = parseFloat(getComputedStyle(el.editor).lineHeight) || 22;
  el.editor.scrollTop = Math.max(0, idx * lh - el.editor.clientHeight / 3);
  syncPreviewToEditor();
  updateCursor();
}

/* ══════════════════════════════════════════════════════════════════════
   Save
   ══════════════════════════════════════════════════════════════════════ */

async function save({ force = false } = {}) {
  if (!state.file || state.file.kind !== 'text') return;
  const content = el.editor.value;
  try {
    const res = await api('/api/file', jsonInit('PUT', {
      path: state.file.path, content, baseMtime: state.file.mtime, force,
    }));
    state.file.mtime = res.mtime;
    state.file.size = res.size;
    state.baseline = content;
    state.conflict = false;
    el.conflictFlag.hidden = true;
    setDirty(false);
    dropDraft(state.file.path);
    toast(`저장 — ${state.file.path.split('/').pop()}`, 'ok', 1800);
  } catch (err) {
    if (err.status === 409) {
      state.conflict = true;
      el.conflictFlag.hidden = false;
      stashDraft();
      const when = err.detail?.diskMtime
        ? new Date(err.detail.diskMtime).toLocaleTimeString('ko-KR') : '알 수 없음';
      const choice = await modal({
        title: '디스크에서 파일이 변경되었습니다',
        desc: `다른 에이전트나 워크트리가 ${when}에 이 파일을 썼습니다. `
            + '내 변경은 임시 보관되었습니다.',
        value: null,
        items: [
          { value: 'reload', html: '<b>디스크 버전 열기</b><span>내 변경을 버리지 않고 보관 — 복구 제안됨</span>' },
          { value: 'force', html: '<b>내 버전으로 덮어쓰기</b><span>이전 내용은 .backups/ 에 보존됩니다</span>' },
        ],
      });
      if (choice === 'force') await save({ force: true });
      else if (choice === 'reload') await reload({ keepDraft: true });
    } else {
      toast(`저장 실패: ${err.message}`, 'err', 5000);
    }
  }
}

async function reload({ keepDraft = false } = {}) {
  if (!state.file) return;
  if (state.dirty && !keepDraft) {
    const go = await modal({
      title: '다시 읽기',
      desc: '미저장 변경이 임시 보관된 뒤 디스크 내용으로 대체됩니다.',
      value: null, ok: '진행',
    });
    if (go !== true) return;
  }
  stashDraft();
  const path = state.file.path;
  state.file = null;
  state.dirty = false;
  await openFile(path);
}

/* ══════════════════════════════════════════════════════════════════════
   Create / move
   ══════════════════════════════════════════════════════════════════════ */

const activeDir = () => {
  if (state.file) {
    const parts = state.file.path.split('/');
    parts.pop();
    return parts.join('/');
  }
  return state.run;
};

async function createContractDoc(ghost) {
  try {
    await api('/api/file', jsonInit('POST', {
      path: ghost.path, content: scaffold(ghost.role, ghost.name, ghost.gate, state.runId),
    }));
    toast(`계약 문서 생성 — ${ghost.name}`, 'ok');
    await loadTree();
    await openFile(ghost.path);
  } catch (err) {
    toast(`생성 실패: ${err.message}`, 'err');
  }
}

async function newFile() {
  const dir = activeDir();
  const name = await modal({
    title: '새 문서',
    desc: `${dir}/ 에 생성합니다. 하위 경로도 쓸 수 있습니다 (예: qa/proof/notes.md).`,
    value: 'new-document.md',
  });
  if (!name) return;
  const path = `${dir}/${name}`.replace(/\/+/g, '/');
  const title = name.split('/').pop().replace(/\.md$/, '').replace(/-/g, ' ');
  try {
    await api('/api/file', jsonInit('POST', {
      path, content: `# ${title}\n\nrun-id: `
        + `${state.runId ? `\`${state.runId}\`` : '<!-- 미확인 — 런 브리프에서 채우세요 -->'}\n\n`,
    }));
    toast('문서 생성', 'ok');
    await loadTree();
    await openFile(path);
  } catch (err) {
    toast(`생성 실패: ${err.message}`, 'err');
  }
}

async function newFolder() {
  const dir = activeDir();
  const name = await modal({
    title: '새 폴더', desc: `${dir}/ 에 생성합니다.`, value: '',
  });
  if (!name) return;
  try {
    await api('/api/dir', jsonInit('POST', { path: `${dir}/${name}`.replace(/\/+/g, '/') }));
    toast('폴더 생성', 'ok');
    await loadTree();
  } catch (err) {
    toast(`생성 실패: ${err.message}`, 'err');
  }
}

/**
 * Rename/move the open document. Deletion is deliberately absent — the
 * artifact contract treats workspace artifacts as permanent studio memory.
 */
async function renamePath() {
  if (!state.file) return;
  if (state.dirty) { toast('먼저 저장하세요', 'warn'); return; }
  const to = await modal({
    title: '이름 변경 · 이동',
    desc: '워크스페이스 기준 경로입니다. 삭제는 제공하지 않습니다 — 아티팩트는 스튜디오 기억입니다.',
    value: state.file.path,
  });
  if (!to || to === state.file.path) return;
  try {
    await api('/api/move', jsonInit('POST', { from: state.file.path, to }));
    toast('이동 완료', 'ok');
    await loadTree();
    await openFile(to);
  } catch (err) {
    toast(`이동 실패: ${err.message}`, 'err');
  }
}

/* ══════════════════════════════════════════════════════════════════════
   Search
   ══════════════════════════════════════════════════════════════════════ */

async function grepAll() {
  const q = await modal({
    title: '전문 검색',
    desc: `${state.run} 안의 모든 텍스트 문서를 검색합니다.`,
    value: el.filter.value.trim(),
  });
  if (!q || q.length < 2) return;
  try {
    const { hits } = await api(`/api/grep?q=${encodeURIComponent(q)}&run=${encodeURIComponent(state.run)}`);
    if (!hits.length) { toast('결과 없음', 'warn'); return; }
    const pick = await modal({
      title: `검색 결과 ${hits.length}건`,
      desc: `"${q}"`,
      value: null,
      items: hits.slice(0, 120).map((h) => ({
        value: h,
        html: `<b>${escapeHTML(h.path.split('/').slice(1).join('/'))}<span class="modal__line">:${h.line}</span></b>`
            + `<span>${escapeHTML(h.text)}</span>`,
      })),
    });
    if (pick) await openFile(pick.path, { line: pick.line });
  } catch (err) {
    toast(`검색 실패: ${err.message}`, 'err');
  }
}

/* ══════════════════════════════════════════════════════════════════════
   Markdown editing helpers
   ══════════════════════════════════════════════════════════════════════ */

function surround(before, after = before, placeholder = '') {
  const ta = el.editor;
  const { selectionStart: s, selectionEnd: e } = ta;
  const picked = ta.value.slice(s, e) || placeholder;
  const next = ta.value.slice(0, s) + before + picked + after + ta.value.slice(e);
  ta.value = next;
  ta.selectionStart = s + before.length;
  ta.selectionEnd = s + before.length + picked.length;
  ta.focus();
  onInput();
}

function insertBlock(text) {
  const ta = el.editor;
  const s = ta.selectionStart;
  const atLineStart = s === 0 || ta.value[s - 1] === '\n';
  const body = (atLineStart ? '' : '\n') + text;
  ta.value = ta.value.slice(0, s) + body + ta.value.slice(ta.selectionEnd);
  ta.selectionStart = ta.selectionEnd = s + body.length;
  ta.focus();
  onInput();
}

const MD_ACTIONS = {
  h2:   () => insertBlock('## '),
  bold: () => surround('**', '**', '굵게'),
  code: () => surround('`', '`', 'code'),
  link: () => surround('[', '](path.md)', '텍스트'),
  table: () => insertBlock('| 항목 | 값 | 근거 |\n|---|---|---|\n|  |  |  |\n'),
  yaml: () => insertBlock('```yaml\nsystem: \nband: [0, 0]\ndata_mirror: \n```\n'),
  gate: () => insertBlock(
    '| 게이트 | 측정값 | 방법 | 증거 | 판정 |\n|---|---|---|---|---|\n'
    + '| G1 |  |  | `qa/gate-measurements.md#g1` | PASS |\n'),
  fmt: () => {
    const ta = el.editor;
    const pos = ta.selectionStart;
    const next = formatTables(ta.value);
    if (next === ta.value) { toast('정렬할 표 없음', 'warn', 1600); return; }
    ta.value = next;
    ta.selectionStart = ta.selectionEnd = Math.min(pos, next.length);
    onInput();
    toast('표 정렬', 'ok', 1600);
  },
};

el.mdtools.addEventListener('click', (e) => {
  const btn = e.target.closest('.mdtool');
  if (!btn || !btn.dataset.md) return;
  MD_ACTIONS[btn.dataset.md]?.();
});

/* ══════════════════════════════════════════════════════════════════════
   Scroll sync
   ══════════════════════════════════════════════════════════════════════ */

let syncing = false;
const ratio = (node) => {
  const span = node.scrollHeight - node.clientHeight;
  return span > 0 ? node.scrollTop / span : 0;
};
const applyRatio = (node, r) => {
  const span = node.scrollHeight - node.clientHeight;
  if (span > 0) node.scrollTop = r * span;
};

function syncPreviewToEditor() {
  if (!state.sync || syncing) return;
  syncing = true;
  applyRatio(el.preview, ratio(el.editor));
  requestAnimationFrame(() => { syncing = false; });
}

el.editor.addEventListener('scroll', () => {
  el.lineNumbers.scrollTop = el.editor.scrollTop;   // gutter must never drift
  syncPreviewToEditor();
});
el.preview.addEventListener('scroll', () => {
  if (!state.sync || syncing) return;
  syncing = true;
  applyRatio(el.editor, ratio(el.preview));
  el.lineNumbers.scrollTop = el.editor.scrollTop;
  requestAnimationFrame(() => { syncing = false; });
});

/* ══════════════════════════════════════════════════════════════════════
   Editor input
   ══════════════════════════════════════════════════════════════════════ */

function onInput() {
  setDirty(el.editor.value !== state.baseline);
  scheduleRender();
}

el.editor.addEventListener('input', onInput);
el.editor.addEventListener('keyup', updateCursor);
el.editor.addEventListener('click', updateCursor);

el.editor.addEventListener('keydown', (e) => {
  // Tab indents rather than leaving the textarea — these docs are list-heavy.
  if (e.key === 'Tab') {
    e.preventDefault();
    const ta = el.editor;
    const { selectionStart: s, selectionEnd: en } = ta;
    if (s === en) {
      ta.value = `${ta.value.slice(0, s)}  ${ta.value.slice(en)}`;
      ta.selectionStart = ta.selectionEnd = s + 2;
    } else {
      const from = ta.value.lastIndexOf('\n', s - 1) + 1;
      const block = ta.value.slice(from, en);
      const shifted = e.shiftKey
        ? block.replace(/^ {1,2}/gm, '')
        : block.replace(/^/gm, '  ');
      ta.value = ta.value.slice(0, from) + shifted + ta.value.slice(en);
      ta.selectionStart = from;
      ta.selectionEnd = from + shifted.length;
    }
    onInput();
    return;
  }
  // Continue list/table structure on Enter.
  if (e.key === 'Enter' && !e.shiftKey && !e.metaKey) {
    const ta = el.editor;
    const from = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
    const line = ta.value.slice(from, ta.selectionStart);
    const list = line.match(/^(\s*)([-*+]|\d+\.)\s+(\[[ x]\]\s+)?/);
    if (list && line.trim() !== list[0].trim()) {
      e.preventDefault();
      const marker = /^\d+\./.test(list[2])
        ? `${parseInt(list[2], 10) + 1}.` : list[2];
      const task = list[3] ? '[ ] ' : '';
      insertBlock(`\n${list[1]}${marker} ${task}`);
    }
  }
});

/* ══════════════════════════════════════════════════════════════════════
   View mode / prefs
   ══════════════════════════════════════════════════════════════════════ */

function setView(view) {
  state.view = view;
  el.main.dataset.view = view;
  for (const btn of document.querySelectorAll('.viewmode__btn')) {
    btn.classList.toggle('is-active', btn.dataset.view === view);
  }
  syncOutlineButton();
  savePrefs();
}

/**
 * styles.css reclaims the 220px outline track in split view at or below
 * 1700px, where it would starve the document (measurements in the rule's
 * comment). The rail is genuinely gone there, so the toggle must not keep
 * claiming it is on -- a button reporting a state the layout contradicts is
 * worse than a disabled one.
 */
const OUTLINE_FITS = () => window.matchMedia('(min-width: 1701px)').matches;

function syncOutlineButton() {
  const suppressed = state.view === 'split' && !OUTLINE_FITS();
  el.btnOutline.disabled = suppressed;
  el.btnOutline.classList.toggle('is-active', state.outline && !suppressed);
  el.btnOutline.title = suppressed
    ? '목차는 분할 보기에서 1700px 이하일 때 문서 폭을 위해 숨습니다 — ⌘3 프리뷰 보기에서 사용하세요'
    : '문서 목차 토글';
}

for (const btn of document.querySelectorAll('.viewmode__btn')) {
  btn.addEventListener('click', () => setView(btn.dataset.view));
}

el.btnSync.addEventListener('click', () => {
  state.sync = !state.sync;
  el.btnSync.classList.toggle('is-active', state.sync);
  savePrefs();
});
el.btnOutline.addEventListener('click', () => {
  state.outline = !state.outline;
  el.previewBody.classList.toggle('is-outline-off', !state.outline);
  syncOutlineButton();
  savePrefs();
});
el.btnWide.addEventListener('click', () => {
  state.wide = !state.wide;
  el.preview.classList.toggle('is-wide', state.wide);
  el.btnWide.classList.toggle('is-active', state.wide);
  savePrefs();
});
el.toggleMissing.addEventListener('change', () => {
  state.showMissing = el.toggleMissing.checked;
  renderTree();
  savePrefs();
});
el.btnCollapse.addEventListener('click', () => {
  state.open.clear();
  renderTree();
});
el.btnSave.addEventListener('click', () => save());
el.btnReload.addEventListener('click', () => reload());
el.btnNewFile.addEventListener('click', newFile);
el.btnNewFolder.addEventListener('click', newFolder);
el.btnGrep.addEventListener('click', grepAll);

/* Narrow-screen drawer. Below 1100px the sidebar is an overlay, so without a
   toggle the document tree is unreachable. */
const NARROW = () => window.matchMedia('(max-width: 1100px)').matches;

function setDrawer(open) {
  el.sidebar.classList.toggle('is-open', open);
  el.btnDrawer.setAttribute('aria-expanded', String(open));
  el.btnDrawer.setAttribute('aria-label', open ? '문서 트리 닫기' : '문서 트리 열기');
}

el.btnDrawer.addEventListener('click', () => {
  setDrawer(!el.sidebar.classList.contains('is-open'));
});

// Tapping the scrim (the sidebar's own ::after, outside its box) closes it.
el.sidebar.addEventListener('click', (e) => {
  if (NARROW() && e.target === el.sidebar) setDrawer(false);
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && el.modal.hidden && el.sidebar.classList.contains('is-open')) {
    setDrawer(false);
  }
});

// Returning to a wide viewport must not leave the drawer class latched on.
window.matchMedia('(max-width: 1100px)').addEventListener('change', (m) => {
  if (!m.matches) setDrawer(false);
});

// Crossing the outline breakpoint changes whether the rail can exist at all,
// so the toggle's honesty has to be re-evaluated on resize too.
window.matchMedia('(max-width: 1700px)').addEventListener('change', syncOutlineButton);

el.filter.addEventListener('input', () => {
  state.filter = el.filter.value.trim().toLowerCase();
  renderTree();
});
el.runSelect.addEventListener('change', async () => {
  stashDraft();
  state.run = el.runSelect.value;
  state.open.clear();
  state.file = null;
  el.editor.value = '';
  el.preview.innerHTML = '';
  setDirty(false);
  savePrefs();
  await loadTree();
});

function savePrefs() {
  try {
    localStorage.setItem(PREFS, JSON.stringify({
      run: state.run, view: state.view, sync: state.sync, outline: state.outline,
      wide: state.wide, showMissing: state.showMissing,
      sidebarW: document.documentElement.style.getPropertyValue('--sidebar-w'),
      split: el.main.style.getPropertyValue('--split'),
    }));
  } catch { /* private mode */ }
}

function loadPrefs() {
  let p;
  try { p = JSON.parse(localStorage.getItem(PREFS) || '{}'); } catch { return; }
  if (p.run) state.run = p.run;
  if (p.view) setView(p.view);
  if (p.sync === false) { state.sync = false; el.btnSync.classList.remove('is-active'); }
  // `state.outline` stays the user's preference even when width suppresses the
  // rail, so switching to preview-only restores what they had on.
  if (p.outline === false) {
    state.outline = false;
    el.previewBody.classList.add('is-outline-off');
  }
  // Explicit re-sync: setView() above already ran syncOutlineButton() against
  // the default state, before this block settled it.
  syncOutlineButton();
  if (p.wide) { state.wide = true; el.preview.classList.add('is-wide'); el.btnWide.classList.add('is-active'); }
  if (p.showMissing === false) { state.showMissing = false; el.toggleMissing.checked = false; }
  if (p.sidebarW) document.documentElement.style.setProperty('--sidebar-w', p.sidebarW);
  if (p.split) el.main.style.setProperty('--split', p.split);
}

/* ══════════════════════════════════════════════════════════════════════
   Gutters
   ══════════════════════════════════════════════════════════════════════ */

function draggable(handle, onMove) {
  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    handle.classList.add('is-drag');
    document.body.style.cursor = 'col-resize';
    const move = (ev) => onMove(ev.clientX);
    const up = () => {
      handle.classList.remove('is-drag');
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      savePrefs();
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  });
}

draggable(el.gutterSidebar, (x) => {
  const w = Math.min(Math.max(x, 200), 560);
  document.documentElement.style.setProperty('--sidebar-w', `${w}px`);
});
draggable(el.gutterPanes, (x) => {
  const box = el.main.getBoundingClientRect();
  const frac = Math.min(Math.max((x - box.left) / box.width, 0.2), 0.8);
  el.main.style.setProperty('--split', `${(frac * 100).toFixed(1)}%`);
});

/* ══════════════════════════════════════════════════════════════════════
   Keyboard
   ══════════════════════════════════════════════════════════════════════ */

window.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) {
    if (e.key === 'Escape' && !el.modal.hidden) closeModal(null);
    return;
  }
  const k = e.key.toLowerCase();

  if (k === 's') { e.preventDefault(); save(); return; }
  if (k === 'p' && !e.shiftKey) { e.preventDefault(); el.filter.focus(); el.filter.select(); return; }
  if (k === 'f' && e.shiftKey) { e.preventDefault(); grepAll(); return; }
  if (k === 'l' && e.shiftKey) { e.preventDefault(); MD_ACTIONS.fmt(); return; }
  if (k === 'b') { e.preventDefault(); MD_ACTIONS.bold(); return; }
  if (k === 'k') { e.preventDefault(); MD_ACTIONS.link(); return; }
  if (k === 'r' && e.shiftKey) { e.preventDefault(); reload(); return; }
  if (k === '1') { e.preventDefault(); setView('edit'); return; }
  if (k === '2') { e.preventDefault(); setView('split'); return; }
  if (k === '3') { e.preventDefault(); setView('preview'); return; }
  if (k === 'e') { e.preventDefault(); renamePath(); return; }
});

// F2 is the conventional rename key; ⌘E is the in-editor equivalent.
window.addEventListener('keydown', (e) => {
  if (e.key === 'F2') { e.preventDefault(); renamePath(); }
});

window.addEventListener('beforeunload', (e) => {
  stashDraft();
  if (state.dirty) e.preventDefault();   // modern Chrome needs no returnValue
});

/* ══════════════════════════════════════════════════════════════════════
   Boot
   ══════════════════════════════════════════════════════════════════════ */

async function boot() {
  renderLegend();
  loadPrefs();
  try {
    const health = await api('/api/health');
    el.stServer.textContent = `node ${health.node} · pid ${health.pid}`;
  } catch {
    el.stServer.textContent = '서버 연결 실패';
    document.body.classList.add('is-offline');
    toast('서버에 연결할 수 없습니다. `node _workspace/editor/server.mjs` 로 실행하세요.', 'err', 9000);
    return;
  }
  await loadRuns();
  await loadTree();
  setDirty(false);

  // Land on the run's task manifest — the harness's own entry point.
  const flat = [];
  (function walk(ns) { for (const n of ns) { flat.push(n); if (n.children) walk(n.children); } })(state.tree);
  const entry = flat.find((n) => n.path.endsWith('production/task-manifest.md'))
    || flat.find((n) => n.path.endsWith('summary.md'))
    || flat.find((n) => n.kind === 'text' && n.name.endsWith('.md'));
  if (entry) await openFile(entry.path);
}

boot();
