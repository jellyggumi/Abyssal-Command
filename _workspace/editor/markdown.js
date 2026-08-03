/**
 * markdown.js — hand-written markdown engine for the Abyssal Lantern workspace editor.
 *
 * Zero dependencies. Pure, synchronous, side-effect free. ES module.
 *
 * The harness production documents are Korean+English, table-heavy, and carry
 * gate-checkable status tokens ([OBSERVED], PASS, S1, G4 …) that a generic
 * markdown library cannot decorate. This module owns that dialect.
 *
 * Exports:
 *   renderMarkdown(src) -> HTML string
 *   extractOutline(src) -> [{level, text, slug, line}]
 *   formatTables(src)   -> markdown string with GFM tables column-aligned (CJK-aware)
 *   renderStats(src)    -> {lines, words, chars, tables, headings, todos}
 */

/* ════════════════════════════════════════════════════════════════════════
   0. Primitives
   ════════════════════════════════════════════════════════════════════════ */

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

/** Escape the four dangerous characters. Runs before ANY wrapping. */
function esc(value) {
  return String(value).replace(/[&<>"]/g, (c) => HTML_ESCAPES[c]);
}

/** Split into {s, n} records; n is the 1-based ORIGINAL source line number. */
function splitLines(text) {
  return text.split(/\r\n|\r|\n/).map((s, i) => ({ s, n: i + 1 }));
}

/** Visual column count of leading whitespace (tab = 4). */
function indentOf(s) {
  let col = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === ' ') col += 1;
    else if (c === '\t') col += 4 - (col % 4);
    else break;
  }
  return col;
}

/** Remove up to `k` visual columns of leading whitespace. */
function stripIndent(s, k) {
  let col = 0;
  let i = 0;
  while (i < s.length && col < k) {
    const c = s[i];
    if (c === ' ') { col += 1; i += 1; continue; }
    if (c === '\t') {
      const adv = 4 - (col % 4);
      if (col + adv > k) break;
      col += adv; i += 1; continue;
    }
    break;
  }
  return s.slice(i);
}

/* ── East-Asian display width ─────────────────────────────────────────── */

/** Codepoint ranges rendered two cells wide in a monospace grid. */
const WIDE_RANGES = [
  [0x1100, 0x115f], [0x231a, 0x231b], [0x2329, 0x232a], [0x23e9, 0x23ec],
  [0x23f0, 0x23f0], [0x23f3, 0x23f3], [0x25fd, 0x25fe], [0x2614, 0x2615],
  [0x2648, 0x2653], [0x267f, 0x267f], [0x2693, 0x2693], [0x26a1, 0x26a1],
  [0x26aa, 0x26ab], [0x26bd, 0x26be], [0x26c4, 0x26c5], [0x26ce, 0x26ce],
  [0x26d4, 0x26d4], [0x26ea, 0x26ea], [0x26f2, 0x26f3], [0x26f5, 0x26f5],
  [0x26fa, 0x26fa], [0x26fd, 0x26fd], [0x2705, 0x2705], [0x270a, 0x270b],
  [0x2728, 0x2728], [0x274c, 0x274c], [0x274e, 0x274e], [0x2753, 0x2755],
  [0x2757, 0x2757], [0x2795, 0x2797], [0x27b0, 0x27b0], [0x27bf, 0x27bf],
  [0x2b1b, 0x2b1c], [0x2b50, 0x2b50], [0x2b55, 0x2b55],
  [0x2e80, 0x303e], [0x3041, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff],
  [0xa000, 0xa4cf], [0xa960, 0xa97f], [0xac00, 0xd7a3], [0xd7b0, 0xd7ff],
  [0xf900, 0xfaff], [0xfe10, 0xfe19], [0xfe30, 0xfe6f], [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x16fe0, 0x16fe4], [0x17000, 0x18aff], [0x1b000, 0x1b2ff],
  [0x1f004, 0x1f004], [0x1f0cf, 0x1f0cf], [0x1f18e, 0x1f18e],
  [0x1f191, 0x1f19a], [0x1f200, 0x1f320], [0x1f32d, 0x1f335],
  [0x1f337, 0x1f37c], [0x1f37e, 0x1f393], [0x1f3a0, 0x1f3ca],
  [0x1f3cf, 0x1f3d3], [0x1f3e0, 0x1f3f0], [0x1f3f4, 0x1f3f4],
  [0x1f3f8, 0x1f43e], [0x1f440, 0x1f440], [0x1f442, 0x1f4fc],
  [0x1f4ff, 0x1f53d], [0x1f54b, 0x1f54e], [0x1f550, 0x1f567],
  [0x1f57a, 0x1f57a], [0x1f595, 0x1f596], [0x1f5a4, 0x1f5a4],
  [0x1f5fb, 0x1f64f], [0x1f680, 0x1f6c5], [0x1f6cc, 0x1f6cc],
  [0x1f6d0, 0x1f6d2], [0x1f6eb, 0x1f6ec], [0x1f6f4, 0x1f6fc],
  [0x1f7e0, 0x1f7eb], [0x1f90c, 0x1f9ff], [0x1fa70, 0x1faff],
  [0x20000, 0x2fffd], [0x30000, 0x3fffd],
];

/** Codepoints that occupy no cell at all (combining marks, joiners). */
const ZERO_RANGES = [
  [0x0300, 0x036f], [0x0483, 0x0489], [0x0591, 0x05bd], [0x0610, 0x061a],
  [0x064b, 0x065f], [0x0670, 0x0670], [0x06d6, 0x06dc], [0x0e31, 0x0e31],
  [0x0e34, 0x0e3a], [0x0e47, 0x0e4e], [0x200b, 0x200f], [0x2028, 0x202e],
  [0x20d0, 0x20f0], [0xfe00, 0xfe0f], [0xfe20, 0xfe2f], [0xfeff, 0xfeff],
  [0xe0100, 0xe01ef],
];

function inRanges(cp, ranges) {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = ranges[mid];
    if (cp < r[0]) hi = mid - 1;
    else if (cp > r[1]) lo = mid + 1;
    else return true;
  }
  return false;
}

/** Monospace display width of a string; Hangul/CJK/fullwidth count as 2. */
function displayWidth(str) {
  let w = 0;
  for (const ch of String(str)) {
    const cp = ch.codePointAt(0);
    if (cp === 0x09) { w += 4; continue; }
    if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) continue;
    if (inRanges(cp, ZERO_RANGES)) continue;
    w += inRanges(cp, WIDE_RANGES) ? 2 : 1;
  }
  return w;
}

/** Right-pad with spaces to a target display width. */
function padTo(str, width) {
  const gap = width - displayWidth(str);
  return gap > 0 ? str + ' '.repeat(gap) : str;
}

/* ── slugs ────────────────────────────────────────────────────────────── */

/** Strip inline markdown so headings become plain text (Korean preserved). */
function stripInlineMarkup(text) {
  let s = String(text);
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');          // images -> alt
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');           // links  -> label
  s = s.replace(/`+/g, '');                                 // code ticks
  s = s.replace(/~~/g, '');                                 // strike
  s = s.replace(/\*\*|__/g, '');                            // strong
  s = s.replace(/[*_]/g, '');                               // em
  s = s.replace(/\\([\\`*_{}[\]()#+\-.!|~>])/g, '$1');      // backslash escapes
  return s.trim();
}

/**
 * Canonical slug. Shared verbatim by renderMarkdown and extractOutline.
 * Korean characters survive; ASCII is lowercased; punctuation is dropped.
 */
function slugify(text) {
  let s = stripInlineMarkup(text).toLowerCase();
  s = s.replace(/[^\p{L}\p{N}\s-]+/gu, '');
  s = s.trim().replace(/\s+/g, '-');
  s = s.replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
  return s || 'section';
}

/** Dedupe collisions as slug, slug-2, slug-3 … using a shared counter map. */
function uniqueSlug(base, seen) {
  const hits = (seen.get(base) || 0) + 1;
  seen.set(base, hits);
  return hits === 1 ? base : `${base}-${hits}`;
}

/* ════════════════════════════════════════════════════════════════════════
   1. Harness token decoration
   ════════════════════════════════════════════════════════════════════════ */

const TAG_KIND = {
  OBSERVED: 'observed', MEASURED: 'observed',
  TARGET: 'target', PLANNED: 'target', INFERENCE: 'target',
  SUPERSEDED: 'superseded', DEPRECATED: 'superseded',
};

const DECOR_RE = new RegExp(
  '\\[(OBSERVED|MEASURED|TARGET|PLANNED|INFERENCE|SUPERSEDED|DEPRECATED)\\]'
  + '|#([gG][1-8])\\b'
  + '|\\b(G[1-8])\\b'
  + '|\\b(PASS|FIX|REDO)\\b'
  + '|\\b(S[1-4])\\b',
  'g',
);

/** Status words are only meaningful at the head of a table cell. */
const STATUS_RE = /^(\s*)(done|blocked|deferred|fixed|open|wip|in-progress)\b/i;

/**
 * Wrap harness tokens. Input MUST already be HTML-escaped and MUST be a plain
 * text run — never markup — so decoration can never fire inside code, hrefs,
 * or generated attributes.
 */
function decorate(text) {
  return text.replace(DECOR_RE, (full, tag, anchorGate, gate, verdict, sev) => {
    if (tag) return `<span class="md-tag md-tag--${TAG_KIND[tag]}">${full}</span>`;
    if (anchorGate || gate) return `<span class="md-gate">${full}</span>`;
    if (verdict) return `<span class="md-verdict md-verdict--${verdict.toLowerCase()}">${full}</span>`;
    if (sev) return `<span class="md-sev md-sev--${sev.toLowerCase()}">${full}</span>`;
    return full;
  });
}

/* ════════════════════════════════════════════════════════════════════════
   2. Inline parser
   ════════════════════════════════════════════════════════════════════════

   Produces a node list of {t:'t'} plain-text runs and {t:'r'} raw-HTML runs.
   Only text runs get decorated, which is how "no decoration inside code"
   is guaranteed structurally rather than by regex gymnastics.
   ════════════════════════════════════════════════════════════════════════ */

const PUNCT_ESCAPABLE = /[\\`*_{}[\]()#+\-.!|~><"']/;
const UNSAFE_SCHEME = /^\s*(?:javascript|vbscript|data):/i;
const EXTERNAL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function safeHref(href) {
  if (!href) return '';
  if (UNSAFE_SCHEME.test(href) && !/^data:image\//i.test(href)) return '#';
  return href;
}

/** In-workspace navigation target: any non-external, non-fragment href. */
function isXref(href) {
  if (!href) return false;
  if (href.startsWith('#')) return false;
  if (href.startsWith('//')) return false;
  if (EXTERNAL_SCHEME.test(href)) return false;
  return true;
}

/** Find the index of the delimiter that closes `open` at `start`, or -1. */
function matchDelim(src, start, open, close) {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') { i += 1; continue; }
    if (c === open) depth += 1;
    else if (c === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function isWordChar(c) {
  return c !== undefined && /[\p{L}\p{N}]/u.test(c);
}

/**
 * Tokenize one inline string (already HTML-escaped) into text/raw nodes.
 */
function inlineNodes(src) {
  const nodes = [];
  let buf = '';
  const flush = () => { if (buf) { nodes.push({ t: 't', v: buf }); buf = ''; } };
  const raw = (v) => { flush(); nodes.push({ t: 'r', v }); };

  let i = 0;
  while (i < src.length) {
    const c = src[i];

    // backslash escape
    if (c === '\\' && i + 1 < src.length && PUNCT_ESCAPABLE.test(src[i + 1])) {
      buf += src[i + 1];
      i += 2;
      continue;
    }

    // hard line break / soft newline
    if (c === '\n') {
      if (/ {2,}$/.test(buf)) {
        buf = buf.replace(/ +$/, '');
        raw('<br>\n');
      } else {
        buf += '\n';
      }
      i += 1;
      continue;
    }

    // inline code — highest precedence
    if (c === '`') {
      let run = 0;
      while (src[i + run] === '`') run += 1;
      const fence = '`'.repeat(run);
      const close = src.indexOf(fence, i + run);
      // A longer run than the opener is not a valid closer — keep scanning.
      if (close !== -1 && src[close + run] !== '`') {
        let code = src.slice(i + run, close);
        if (code.length > 2 && code.startsWith(' ') && code.endsWith(' ') && code.trim() !== '') {
          code = code.slice(1, -1);
        }
        raw(`<code class="md-inline-code">${code.replace(/\n/g, ' ')}</code>`);
        i = close + run;
        continue;
      }
      buf += fence;
      i += run;
      continue;
    }

    // image
    if (c === '!' && src[i + 1] === '[') {
      const parsed = parseLinkish(src, i + 1);
      if (parsed) {
        const href = esc(safeHref(unescapeBackslash(parsed.dest)));
        const alt = esc(stripInlineMarkup(unescapeBackslash(parsed.label)));
        const title = parsed.title ? ` title="${esc(unescapeBackslash(parsed.title))}"` : '';
        raw(`<img class="md-img" src="${href}" alt="${alt}"${title} loading="lazy">`);
        i = parsed.end;
        continue;
      }
    }

    // link
    if (c === '[') {
      const parsed = parseLinkish(src, i);
      if (parsed) {
        const rawDest = unescapeBackslash(parsed.dest);
        const href = esc(safeHref(rawDest));
        const title = parsed.title ? ` title="${esc(unescapeBackslash(parsed.title))}"` : '';
        const xref = isXref(rawDest)
          ? ` class="md-xref" data-xref="${esc(rawDest)}"`
          : ' class="md-link"';
        const inner = renderNodes(inlineNodes(parsed.label));
        raw(`<a${xref} href="${href}"${title}>${inner}</a>`);
        i = parsed.end;
        continue;
      }
    }

    // strikethrough
    if (c === '~' && src[i + 1] === '~') {
      const close = src.indexOf('~~', i + 2);
      if (close !== -1 && close > i + 2) {
        raw(`<del class="md-del">${renderNodes(inlineNodes(src.slice(i + 2, close)))}</del>`);
        i = close + 2;
        continue;
      }
    }

    // strong
    if ((c === '*' && src[i + 1] === '*') || (c === '_' && src[i + 1] === '_')) {
      const marker = c + c;
      const close = findEmphasisClose(src, i + 2, marker, c === '_');
      if (close !== -1) {
        raw(`<strong class="md-strong">${renderNodes(inlineNodes(src.slice(i + 2, close)))}</strong>`);
        i = close + 2;
        continue;
      }
    }

    // emphasis
    if (c === '*' || c === '_') {
      const opensOk = c === '*' || !isWordChar(src[i - 1]);
      if (opensOk) {
        const close = findEmphasisClose(src, i + 1, c, c === '_');
        if (close !== -1) {
          raw(`<em class="md-em">${renderNodes(inlineNodes(src.slice(i + 1, close)))}</em>`);
          i = close + 1;
          continue;
        }
      }
    }

    // angle autolink: <https://…> survives escaping as &lt;https://…&gt;
    if (c === '&' && src.startsWith('&lt;http', i)) {
      const end = src.indexOf('&gt;', i + 4);
      if (end !== -1) {
        const url = src.slice(i + 4, end);
        if (/^https?:\/\/\S+$/.test(url)) {
          raw(`<a class="md-link md-autolink" href="${url}" rel="noreferrer">${url}</a>`);
          i = end + 4;
          continue;
        }
      }
    }

    // bare autolink
    if ((c === 'h' || c === 'H') && /^https?:\/\//i.test(src.slice(i, i + 8))) {
      const m = /^https?:\/\/[^\s<>`]+/i.exec(src.slice(i));
      if (m) {
        let url = m[0];
        url = url.replace(/(?:&quot;|&gt;|&lt;|&amp;)+$/, '');
        url = url.replace(/[.,;:!?]+$/, '');
        while (url.endsWith(')') && countChar(url, ')') > countChar(url, '(')) url = url.slice(0, -1);
        if (url.length > 8) {
          raw(`<a class="md-link md-autolink" href="${url}" rel="noreferrer">${url}</a>`);
          i += url.length;
          continue;
        }
      }
    }

    buf += c;
    i += 1;
  }

  flush();
  return nodes;
}

function countChar(s, ch) {
  let n = 0;
  for (const c of s) if (c === ch) n += 1;
  return n;
}

function unescapeBackslash(s) {
  return String(s).replace(/\\([\\`*_{}[\]()#+\-.!|~><"'])/g, '$1');
}

/** Locate the closing emphasis marker, rejecting empty and space-hugging spans. */
function findEmphasisClose(src, from, marker, wordBoundary) {
  let i = from;
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src.startsWith(marker, i)) {
      if (i === from) return -1;                       // empty span
      if (/\s/.test(src[i - 1])) { i += marker.length; continue; }
      if (wordBoundary && isWordChar(src[i + marker.length])) { i += marker.length; continue; }
      return i;
    }
    i += 1;
  }
  return -1;
}

/** Parse `[label](dest "title")` starting at the `[`. */
function parseLinkish(src, start) {
  if (src[start] !== '[') return null;
  const labelEnd = matchDelim(src, start, '[', ']');
  if (labelEnd === -1) return null;
  if (src[labelEnd + 1] !== '(') return null;
  const destEnd = matchDelim(src, labelEnd + 1, '(', ')');
  if (destEnd === -1) return null;

  const label = src.slice(start + 1, labelEnd);
  const body = src.slice(labelEnd + 2, destEnd).trim();

  let dest = body;
  let title = '';
  const tm = /^(\S*)\s+(?:&quot;([\s\S]*)&quot;|'([\s\S]*)')$/.exec(body);
  if (tm) {
    dest = tm[1];
    title = tm[2] !== undefined ? tm[2] : tm[3];
  }
  if (dest.startsWith('&lt;') && dest.endsWith('&gt;')) dest = dest.slice(4, -4);

  return { label, dest, title, end: destEnd + 1 };
}

/** Join nodes, decorating only the plain-text runs. */
function renderNodes(nodes) {
  let out = '';
  for (const node of nodes) out += node.t === 't' ? decorate(node.v) : node.v;
  return out;
}

/**
 * Escape, tokenize, decorate. `cellStart` enables table-cell status words.
 */
function renderInline(text, cellStart) {
  const nodes = inlineNodes(esc(text));
  if (cellStart && nodes.length && nodes[0].t === 't') {
    const m = STATUS_RE.exec(nodes[0].v);
    if (m) {
      const word = m[2];
      const badge = `${m[1]}<span class="md-status md-status--${word.toLowerCase()}">${word}</span>`;
      const rest = nodes[0].v.slice(m[0].length);
      nodes.splice(0, 1, { t: 'r', v: badge }, { t: 't', v: rest });
    }
  }
  return renderNodes(nodes);
}

/* ════════════════════════════════════════════════════════════════════════
   3. Code fence tokenizer  (operates on RAW code, escapes at emit time)
   ════════════════════════════════════════════════════════════════════════ */

const SCALAR_SPEC = {
  re: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(true|false|null|undefined|True|False|None|yes|no|on|off)\b|(-?\b\d+(?:\.\d+)?(?:[eE][-+]?\d+)?\b)/g,
  classes: ['tok-str', 'tok-bool', 'tok-num'],
};

const JS_SPEC = {
  re: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(true|false|null|undefined)\b|\b(const|let|var|function|return|if|else|for|while|await|async|new|class|import|export|from|try|catch|throw|typeof|of|in)\b|(-?\b\d+(?:\.\d+)?(?:[eE][-+]?\d+)?\b)/g,
  classes: ['tok-comment', 'tok-str', 'tok-bool', 'tok-key', 'tok-num'],
};

const BASH_SPEC = {
  re: /(#[^\n]*)|("(?:[^"\\]|\\.)*"|'[^']*')|(\$\{?[A-Za-z_][\w]*\}?)|(\b\d+\b)/g,
  classes: ['tok-comment', 'tok-str', 'tok-key', 'tok-num'],
};

/** Run one alternation spec; every alternative's whole match is the token. */
function runSpec(code, spec) {
  const out = [];
  let last = 0;
  let m;
  spec.re.lastIndex = 0;
  while ((m = spec.re.exec(code)) !== null) {
    if (m[0].length === 0) { spec.re.lastIndex += 1; continue; }
    if (m.index > last) out.push({ v: code.slice(last, m.index), c: null });
    let cls = null;
    for (let g = 1; g < m.length; g++) {
      if (m[g] !== undefined) { cls = spec.classes[g - 1]; break; }
    }
    out.push({ v: m[0], c: cls });
    last = m.index + m[0].length;
  }
  if (last < code.length) out.push({ v: code.slice(last), c: null });
  return out;
}

/** Index of a `#` that starts a YAML comment (not inside quotes), else -1. */
function unquotedHash(line) {
  let quote = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === '\\') { i += 1; continue; }
      if (c === quote) quote = '';
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return i;
  }
  return -1;
}

function tokenizeYaml(code) {
  const out = [];
  const lines = code.split('\n');
  lines.forEach((line, idx) => {
    if (idx) out.push({ v: '\n', c: null });
    const hash = unquotedHash(line);
    const body = hash >= 0 ? line.slice(0, hash) : line;
    const comment = hash >= 0 ? line.slice(hash) : '';
    let rest = body;
    const km = /^(\s*(?:-\s+)?)([A-Za-z_][\w.\- ]*?)(\s*:)(?=\s|$)/.exec(body);
    if (km) {
      if (km[1]) out.push({ v: km[1], c: null });
      out.push({ v: km[2], c: 'tok-key' });
      out.push({ v: km[3], c: null });
      rest = body.slice(km[0].length);
    }
    if (rest) out.push(...runSpec(rest, SCALAR_SPEC));
    if (comment) out.push({ v: comment, c: 'tok-comment' });
  });
  return out;
}

function tokenizeJson(code) {
  const toks = runSpec(code, SCALAR_SPEC);
  // Promote `"key":` strings to tok-key.
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].c !== 'tok-str') continue;
    let j = i + 1;
    while (j < toks.length && toks[j].c === null && /^\s*$/.test(toks[j].v)) j += 1;
    const next = toks[j];
    if (next && next.c === null && /^\s*:/.test(next.v)) toks[i].c = 'tok-key';
  }
  return toks;
}

function tokenizeCode(code, lang) {
  const l = String(lang || '').toLowerCase();
  try {
    if (l === 'yaml' || l === 'yml') return tokenizeYaml(code);
    if (l === 'json' || l === 'jsonc') return tokenizeJson(code);
    if (['js', 'javascript', 'mjs', 'cjs', 'ts', 'typescript'].includes(l)) return runSpec(code, JS_SPEC);
    if (['bash', 'sh', 'shell', 'zsh', 'console'].includes(l)) return runSpec(code, BASH_SPEC);
  } catch {
    /* fall through to plain */
  }
  return [{ v: code, c: null }];
}

function renderCodeBlock(code, lang) {
  const language = String(lang || '').trim().split(/\s+/)[0] || '';
  const attr = esc(language || 'text');
  const body = tokenizeCode(code, language)
    .map((t) => (t.c ? `<span class="${t.c}">${esc(t.v)}</span>` : esc(t.v)))
    .join('');
  const pre = `<pre class="md-code" data-lang="${attr}"><code>${body}</code></pre>`;
  if (language.toLowerCase() === 'yaml' || language.toLowerCase() === 'yml') {
    return `<div class="md-yaml"><span class="md-yaml__tag">YAML</span>${pre}</div>`;
  }
  return pre;
}

/* ════════════════════════════════════════════════════════════════════════
   4. Block-level recognizers
   ════════════════════════════════════════════════════════════════════════ */

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})[ \t]*(.*)$/;
const ATX_RE = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/;
const HR_RE = /^ {0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/;
const LIST_RE = /^(\s*)([-*+]|\d{1,9}[.)])([ \t]+|$)(.*)$/;
const QUOTE_RE = /^ {0,3}>[ \t]?(.*)$/;
const TASK_RE = /^\[([ xX])\][ \t]+(.*)$/;

function isFenceOpen(s) {
  const m = FENCE_RE.exec(s);
  if (!m) return null;
  if (m[1][0] === '`' && m[2].includes('`')) return null;
  return { marker: m[1], info: m[2].trim() };
}

function isFenceClose(s, marker) {
  const m = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(s);
  return !!m && m[1][0] === marker[0] && m[1].length >= marker.length;
}

/** Split a table row on unescaped pipes; outer pipes optional. */
function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length) { cur += c + s[i + 1]; i += 1; continue; }
    if (c === '|') { cells.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  cells.push(cur.trim());
  return cells;
}

function hasUnescapedPipe(s) {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\') { i += 1; continue; }
    if (s[i] === '|') return true;
  }
  return false;
}

/**
 * Parse a delimiter row into per-column alignments, or null when the line is
 * not a delimiter row. Requires a pipe so a bare `---` stays a horizontal rule.
 */
function parseDelimiter(line) {
  const t = line.trim();
  if (!hasUnescapedPipe(t)) return null;
  if (!/^\|?[\s:|-]+\|?$/.test(t)) return null;
  if (!t.includes('-')) return null;
  const cells = splitRow(t);
  if (!cells.length) return null;
  const aligns = [];
  for (const cell of cells) {
    const m = /^(:?)(-+)(:?)$/.exec(cell.trim());
    if (!m) return null;
    if (m[1] && m[3]) aligns.push('center');
    else if (m[3]) aligns.push('right');
    else if (m[1]) aligns.push('left');
    else aligns.push(null);
  }
  return aligns;
}

/** True when lines[i] starts a GFM table. */
function isTableStart(lines, i) {
  if (i + 1 >= lines.length) return false;
  if (!hasUnescapedPipe(lines[i].s)) return false;
  if (lines[i].s.trim() === '') return false;
  return parseDelimiter(lines[i + 1].s) !== null;
}

function isBlockStart(lines, i) {
  const s = lines[i].s;
  if (s.trim() === '') return true;
  if (isFenceOpen(s)) return true;
  if (HR_RE.test(s)) return true;
  if (ATX_RE.test(s) && /^ {0,3}#/.test(s)) return true;
  if (QUOTE_RE.test(s)) return true;
  if (isTableStart(lines, i)) return true;
  const lm = LIST_RE.exec(s);
  if (lm) {
    if (/^\d/.test(lm[2])) return /^0*1[.)]$/.test(lm[2]);
    return lm[4].trim() !== '';
  }
  return false;
}

/* ════════════════════════════════════════════════════════════════════════
   5. Block parser
   ════════════════════════════════════════════════════════════════════════ */

function renderTable(headerCells, aligns, bodyRows) {
  const cols = headerCells.length;
  const styleOf = (idx) => {
    const a = aligns[idx];
    return a ? ` style="text-align:${a}"` : '';
  };

  let head = '<tr>';
  for (let c = 0; c < cols; c++) {
    head += `<th${styleOf(c)}>${renderInline(headerCells[c] || '', true)}</th>`;
  }
  head += '</tr>';

  let body = '';
  for (const row of bodyRows) {
    body += '<tr>';
    for (let c = 0; c < cols; c++) {
      body += `<td${styleOf(c)}>${renderInline(row[c] !== undefined ? row[c] : '', true)}</td>`;
    }
    body += '</tr>';
  }

  return `<div class="md-tablewrap"><table class="md-table" data-cols="${cols}">`
    + `<thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

/** A frontmatter key line: the colon must be followed by whitespace or EOL. */
const FM_KEY_RE = /^[^:\s][^:]*:(\s|$)/;

/**
 * Render the frontmatter block as a definition-style key/value grid.
 * A line that is not `key: value` is a wrapped continuation of the previous
 * value and renders with an empty key cell.
 */
function renderFrontmatter(lines) {
  let rows = '';
  for (const line of lines) {
    const raw = line.s;
    if (raw.trim() === '') continue;
    // Same rule the detector uses: the colon must be followed by space or EOL,
    // so a wrapped line carrying a URL is not mistaken for `key: value`.
    const m = FM_KEY_RE.test(raw.trim())
      ? /^([^:\s][^:]*?)\s*:\s*(.*)$/.exec(raw.trim())
      : null;
    if (m) {
      rows += '<div class="md-front__row">'
        + `<span class="md-front__k">${esc(m[1].trim())}</span>`
        + `<span class="md-front__v">${renderInline(m[2])}</span>`
        + '</div>';
    } else {
      rows += '<div class="md-front__row md-front__row--cont">'
        + '<span class="md-front__k"></span>'
        + `<span class="md-front__v">${renderInline(raw.trim())}</span>`
        + '</div>';
    }
  }
  return `<div class="md-front">${rows}</div>`;
}

/**
 * Detect leading YAML frontmatter. Returns {body, end} where `end` is the
 * index just past the closing fence, or null.
 *
 * The block must OPEN with a `key:` line; later lines may be unindented
 * continuations of the previous value.
 *
 * Evidence note, so nobody mistakes this for a fix to observed breakage:
 * as of this writing exactly ONE workspace doc has fenced frontmatter
 * (`current/intake/motion-rig-baked-motion-repair-plan.md`, 8 keyed rows,
 * zero continuations), and it parses identically with or without this
 * relaxation. The continuation branch is unexercised by the corpus.
 * It exists because the wrapped-`key:` shape IS house style in body prose
 * (e.g. `design/item-drop-timed-buff-spec.md` wraps `authority:` — that
 * block follows an H1 and is NOT fenced, so it is prose, not frontmatter).
 * If anyone ever fences such a block, requiring every line to be a key
 * would drop the whole grid to hr+paragraph+hr. This is hardening, not a
 * bug fix.
 */
function readFrontmatter(lines) {
  if (!lines.length || lines[0].s.trim() !== '---') return null;
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    const t = lines[i].s.trim();
    if (t === '---' || t === '...') { close = i; break; }
  }
  if (close === -1) return null;
  const body = lines.slice(1, close);

  // A leading `---` over prose is a horizontal rule, not frontmatter.
  const firstReal = body.find((l) => l.s.trim() !== '');
  if (!firstReal) return null;
  const opener = firstReal.s;
  if (!FM_KEY_RE.test(opener) && !/^-\s/.test(opener)) return null;

  return { body, end: close + 1 };
}

/**
 * Core block loop.
 * @param {{s:string,n:number}[]} lines
 * @param {{slugs: Map<string, number>}} ctx
 * @param {boolean} tight  suppress <p> wrappers (tight list items)
 */
function parseBlocks(lines, ctx, tight) {
  let html = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].s;

    if (line.trim() === '') { i += 1; continue; }

    // ── fenced code ────────────────────────────────────────────────────
    const fence = isFenceOpen(line);
    if (fence) {
      const buf = [];
      let j = i + 1;
      while (j < lines.length && !isFenceClose(lines[j].s, fence.marker)) {
        buf.push(lines[j].s);
        j += 1;
      }
      html += renderCodeBlock(buf.join('\n'), fence.info);
      i = j < lines.length ? j + 1 : j;
      continue;
    }

    // ── horizontal rule (before headings so `---` never becomes setext) ─
    if (HR_RE.test(line)) {
      html += '<hr class="md-rule">';
      i += 1;
      continue;
    }

    // ── ATX heading ────────────────────────────────────────────────────
    const atx = ATX_RE.exec(line);
    if (atx && /^ {0,3}#/.test(line)) {
      const level = atx[1].length;
      const rawText = (atx[2] || '').replace(/[ \t]+#+[ \t]*$/, '');
      const slug = uniqueSlug(slugify(rawText), ctx.slugs);
      const inner = renderInline(rawText);
      // The outline is a byproduct of this same walk, so a heading nested in a
      // blockquote or list item can never appear in one and be missing from the other.
      ctx.headings.push({
        level,
        text: stripInlineMarkup(rawText),
        slug,
        line: lines[i].n,
      });
      html += `<h${level} id="${esc(slug)}" data-line="${lines[i].n}">${inner}`
        + `<a class="md-anchor" href="#${esc(slug)}" aria-hidden="true">#</a></h${level}>`;
      i += 1;
      continue;
    }

    // ── GFM table ──────────────────────────────────────────────────────
    if (isTableStart(lines, i)) {
      const header = splitRow(lines[i].s);
      const aligns = parseDelimiter(lines[i + 1].s) || [];
      const body = [];
      let j = i + 2;
      while (j < lines.length) {
        const s = lines[j].s;
        if (s.trim() === '') break;
        if (!hasUnescapedPipe(s)) break;
        if (HR_RE.test(s) || isFenceOpen(s) || /^ {0,3}#{1,6}[ \t]/.test(s)) break;
        body.push(splitRow(s));
        j += 1;
      }
      while (aligns.length < header.length) aligns.push(null);
      ctx.tables += 1;
      html += renderTable(header, aligns, body);
      i = j;
      continue;
    }

    // ── blockquote ─────────────────────────────────────────────────────
    if (QUOTE_RE.test(line)) {
      const inner = [];
      let j = i;
      while (j < lines.length) {
        const s = lines[j].s;
        const qm = QUOTE_RE.exec(s);
        if (qm) { inner.push({ s: qm[1], n: lines[j].n }); j += 1; continue; }
        if (s.trim() === '') break;
        if (isBlockStart(lines, j)) break;
        inner.push({ s: s.trim(), n: lines[j].n });   // lazy continuation
        j += 1;
      }
      html += `<blockquote class="md-quote">${parseBlocks(inner, ctx, false)}</blockquote>`;
      i = j;
      continue;
    }

    // ── list ───────────────────────────────────────────────────────────
    if (LIST_RE.test(line) && indentOf(line) < 4) {
      const list = collectList(lines, i);
      if (list) {
        html += renderList(list, ctx);
        i = list.end;
        continue;
      }
    }

    // ── paragraph ──────────────────────────────────────────────────────
    const para = [];
    let j = i;
    while (j < lines.length) {
      if (j > i && isBlockStart(lines, j)) break;
      if (lines[j].s.trim() === '') break;
      para.push(lines[j].s.replace(/^ {0,3}/, ''));
      j += 1;
    }
    const text = para.join('\n');
    html += tight ? renderInline(text) : `<p>${renderInline(text)}</p>`;
    i = j;
  }

  return html;
}

/**
 * Collect a whole list starting at `start`.
 * Returns {items, ordered, startNum, loose, end} or null.
 */
function collectList(lines, start) {
  const first = LIST_RE.exec(lines[start].s);
  if (!first) return null;
  const ordered = /^\d/.test(first[2]);
  const startNum = ordered ? parseInt(first[2], 10) : 1;
  const baseIndent = indentOf(lines[start].s);

  const items = [];
  let loose = false;
  let pendingBlank = false;
  let i = start;

  while (i < lines.length) {
    const m = LIST_RE.exec(lines[i].s);
    if (!m) break;

    const markerIndent = indentOf(lines[i].s);
    if (markerIndent > baseIndent + 3) break;          // belongs to a child list
    if (markerIndent < baseIndent) break;
    if (/^\d/.test(m[2]) !== ordered) break;
    if (m[3] === '' && m[4] === '') { /* empty item is allowed */ }

    if (pendingBlank) { loose = true; pendingBlank = false; }

    const markerLen = m[2].length;
    let gap = m[3].replace(/\t/g, '    ').length;
    if (gap === 0 || gap > 4) gap = 1;
    const contentIndent = markerIndent + markerLen + gap;

    const itemLines = [{ s: m[4], n: lines[i].n }];
    i += 1;

    while (i < lines.length) {
      const s = lines[i].s;

      if (s.trim() === '') {
        let j = i;
        while (j < lines.length && lines[j].s.trim() === '') j += 1;
        if (j < lines.length && indentOf(lines[j].s) >= contentIndent) {
          for (let k = i; k < j; k++) itemLines.push({ s: '', n: lines[k].n });
          i = j;
          loose = true;
          continue;
        }
        pendingBlank = true;
        i = j;
        break;
      }

      if (indentOf(s) >= contentIndent) {
        itemLines.push({ s: stripIndent(s, contentIndent), n: lines[i].n });
        i += 1;
        continue;
      }

      if (LIST_RE.test(s) || HR_RE.test(s) || isFenceOpen(s)
        || /^ {0,3}#{1,6}[ \t]/.test(s) || QUOTE_RE.test(s)) break;

      itemLines.push({ s: s.trim(), n: lines[i].n });   // lazy continuation
      i += 1;
    }

    items.push(itemLines);

    if (pendingBlank) {
      const next = i < lines.length ? LIST_RE.exec(lines[i].s) : null;
      if (!next) break;
      if (indentOf(lines[i].s) > baseIndent + 3) break;
      if (/^\d/.test(next[2]) !== ordered) break;
    }
  }

  if (!items.length) return null;
  return { items, ordered, startNum, loose, end: i };
}

function renderList(list, ctx) {
  const { items, ordered, startNum, loose } = list;
  let hasTask = false;
  let body = '';

  for (const itemLines of items) {
    const lines = itemLines.slice();
    let taskClass = '';
    let marker = '';

    const tm = lines.length ? TASK_RE.exec(lines[0].s) : null;
    if (tm) {
      hasTask = true;
      const done = tm[1] !== ' ';
      if (!done) ctx.todos += 1;
      taskClass = done ? ' class="md-task is-done"' : ' class="md-task"';
      marker = `<span class="md-check" aria-hidden="true">${done ? '✓' : ''}</span>`;
      lines[0] = { s: tm[2], n: lines[0].n };
    }

    while (lines.length && lines[lines.length - 1].s.trim() === '') lines.pop();
    const inner = parseBlocks(lines, ctx, !loose);
    body += `<li${taskClass}>${marker}${inner}</li>`;
  }

  const cls = `md-list${hasTask ? ' md-list--task' : ''}${loose ? ' md-list--loose' : ''}`;
  if (ordered) {
    const startAttr = startNum !== 1 ? ` start="${startNum}"` : '';
    return `<ol class="${cls}"${startAttr}>${body}</ol>`;
  }
  return `<ul class="${cls}">${body}</ul>`;
}

/* ════════════════════════════════════════════════════════════════════════
   6. Public API
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Single authoritative walk. renderMarkdown and extractOutline are both thin
 * views over this, so a heading can never appear in the preview without a
 * matching outline entry (or vice versa) — including headings nested inside
 * blockquotes and list items.
 *
 * @param {string} text
 * @returns {{html: string, ctx: {headings: {level:number,text:string,slug:string,line:number}[],
 *            tables: number, todos: number}}}
 */
function walk(text) {
  const lines = splitLines(text);
  const ctx = { slugs: new Map(), headings: [], tables: 0, todos: 0 };
  let html = '';
  let rest = lines;

  try {
    const fm = readFrontmatter(lines);
    if (fm) {
      html += renderFrontmatter(fm.body);
      rest = lines.slice(fm.end);
    }
  } catch {
    rest = lines;
  }

  try {
    html += parseBlocks(rest, ctx, false);
  } catch {
    html += `<p>${esc(rest.map((l) => l.s).join('\n'))}</p>`;
  }

  return { html, ctx };
}

/**
 * Render markdown to an HTML fragment string.
 * Pure and synchronous. Never throws: a block that fails degrades to a
 * paragraph of its own escaped source.
 *
 * @param {string} src
 * @returns {string}
 */
export function renderMarkdown(src) {
  const text = src == null ? '' : String(src);
  if (!text.trim()) return '';
  return walk(text).html;
}

/**
 * Heading index for scroll-sync and jump navigation.
 * `slug` and `line` are byte-identical to the id/data-line renderMarkdown
 * emits for the same source, because both come from the same walk.
 *
 * @param {string} src
 * @returns {{level:number, text:string, slug:string, line:number}[]}
 */
export function extractOutline(src) {
  const text = src == null ? '' : String(src);
  if (!text.trim()) return [];
  return walk(text).ctx.headings;
}

/**
 * Re-emit every GFM table with uniform, CJK-aware column widths.
 * Non-table lines and fenced regions come back byte-identical, and the
 * transform is idempotent.
 *
 * @param {string} src
 * @returns {string}
 */
export function formatTables(src) {
  const text = src == null ? '' : String(src);
  if (!text) return text;

  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const rawLines = text.split(/\r\n|\r|\n/);
  const lines = rawLines.map((s, i) => ({ s, n: i + 1 }));
  const out = [];

  let i = 0;
  while (i < lines.length) {
    const s = lines[i].s;

    // fenced regions pass through untouched
    const fence = isFenceOpen(s);
    if (fence) {
      out.push(s);
      i += 1;
      while (i < lines.length) {
        out.push(lines[i].s);
        const closed = isFenceClose(lines[i].s, fence.marker);
        i += 1;
        if (closed) break;
      }
      continue;
    }

    if (!isTableStart(lines, i)) {
      out.push(s);
      i += 1;
      continue;
    }

    const indent = /^\s*/.exec(s)[0];
    const header = splitRow(s);
    const aligns = parseDelimiter(lines[i + 1].s) || [];
    const bodyRows = [];
    let j = i + 2;
    while (j < lines.length) {
      const b = lines[j].s;
      if (b.trim() === '') break;
      if (!hasUnescapedPipe(b)) break;
      if (HR_RE.test(b) || isFenceOpen(b) || /^ {0,3}#{1,6}[ \t]/.test(b)) break;
      bodyRows.push(splitRow(b));
      j += 1;
    }

    // Column count spans every row so no authored cell is ever dropped.
    let cols = header.length;
    for (const row of bodyRows) cols = Math.max(cols, row.length);
    cols = Math.max(cols, aligns.length);

    const widths = new Array(cols).fill(3);
    const measure = (row) => {
      for (let c = 0; c < cols; c++) {
        const w = displayWidth(row[c] || '');
        if (w > widths[c]) widths[c] = w;
      }
    };
    measure(header);
    for (const row of bodyRows) measure(row);

    const emit = (row) => {
      let line = indent + '|';
      for (let c = 0; c < cols; c++) line += ` ${padTo(row[c] || '', widths[c])} |`;
      return line;
    };

    const delim = [];
    for (let c = 0; c < cols; c++) {
      const w = widths[c];
      const a = aligns[c] || null;
      if (a === 'center') delim.push(`:${'-'.repeat(Math.max(1, w - 2))}:`);
      else if (a === 'right') delim.push(`${'-'.repeat(Math.max(2, w - 1))}:`);
      else if (a === 'left') delim.push(`:${'-'.repeat(Math.max(2, w - 1))}`);
      else delim.push('-'.repeat(w));
    }

    out.push(emit(header));
    out.push(emit(delim));
    for (const row of bodyRows) out.push(emit(row));
    i = j;
  }

  return out.join(nl);
}

/**
 * Document counters for the status bar.
 *
 * Structural counts come from the same walk that renders the preview, so a
 * table or task item nested inside a blockquote or list item is counted
 * exactly when it is rendered — and code fences are excluded for free.
 *
 * @param {string} src
 * @returns {{lines:number, words:number, chars:number, tables:number, headings:number, todos:number}}
 */
export function renderStats(src) {
  const text = src == null ? '' : String(src);
  const body = text.replace(/(\r\n|\r|\n)$/, '');
  const trimmed = text.trim();

  const stats = {
    lines: text === '' ? 0 : splitLines(body).length,
    words: trimmed ? trimmed.split(/\s+/).length : 0,
    chars: [...text].length,
    tables: 0,
    headings: 0,
    todos: 0,
  };
  if (!trimmed) return stats;

  try {
    const { ctx } = walk(text);
    stats.tables = ctx.tables;
    stats.headings = ctx.headings.length;
    stats.todos = ctx.todos;
  } catch {
    /* counters stay zero; line/word/char counts are still valid */
  }
  return stats;
}
