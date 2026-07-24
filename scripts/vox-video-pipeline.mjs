#!/usr/bin/env node
/**
 * Vox Director fallback video pipeline for stage1-10 defense RPG package.
 *
 * - Mix per-part audio from manifest/playlist declarations
 * - Render placeholder part videos per style
 * - Concatenate sequences to full stories
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const FONT_PATH = '/System/Library/Fonts/Supplemental/Arial.ttf';

const runId = getArg('--run-id', '20260723-solo-warden-rpg-concept');
const workspaceRoot = resolve(ROOT, '_workspace', runId);
const manifestPath = resolve(workspaceRoot, 'production', 'vox-director_manifest.json');
const playlistPath = resolve(workspaceRoot, 'assets', 'video', 'vox-part-playlist.json');

const STYLE_PRESETS = {
  base: {
    label: 'BASE',
    background: '2a2f3a',
    eq: 'eq=contrast=1.08:saturation=1.06:brightness=0.015',
    textColor: 'ffffff',
    box: 'black@0.40',
    motion: true,
    overlayText: 'BASE',
  },
  'anime-soft': {
    label: 'ANIME',
    background: '2f2b3c',
    eq: 'eq=contrast=1.0:saturation=1.15:brightness=0.02',
    textColor: 'e8e5ff',
    box: '121024@0.48',
    motion: true,
    overlayText: 'ANIME',
  },
  'noir-cut': {
    label: 'NOIR',
    background: '1f1d23',
    eq: 'eq=contrast=1.28:saturation=0.28:brightness=-0.05',
    textColor: 'f8d58b',
    box: '000000@0.58',
    motion: true,
    overlayText: 'NOIR',
  },
  'webtoon-static': {
    label: 'WEBTOON',
    background: '252a36',
    eq: 'eq=contrast=1.18:saturation=1.02:brightness=0.01',
    textColor: 'fff4cb',
    box: '090910@0.56',
    motion: false,
    overlayText: 'WEBTOON',
  },
};

const CATEGORY_DIR = {
  narration: 'narration',
  bgm: 'bgm',
  sfx: 'sfx',
  ambience: 'ambience',
  combatSfx: 'combat',
  npcVoice: 'npc',
  battleTriggerAudio: 'combat',
  state: 'state',
  skill: 'skill',
};

function getArg(name, defaultValue = null) {
  const idx = process.argv.indexOf(name);
  if (idx < 0 || idx + 1 >= process.argv.length) return defaultValue;
  return process.argv[idx + 1];
}

function hasArg(name) {
  return process.argv.includes(name);
}

function runFfmpeg(args, logPrefix) {
  const label = logPrefix ? `[ffmpeg] ${logPrefix}` : '[ffmpeg]';
  console.log(`${label}\n` + ['ffmpeg', ...args].map((a) => escapeShellArg(a)).join(' '));
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
}

function escapeShellArg(value) {
  if (!value) return '""';
  if (/[^A-Za-z0-9_./:-]/.test(String(value))) {
    return `'${String(value).replace(/'/g, "'\\''")}'`;
  }
  return String(value);
}

function safeText(text, maxLen = 140) {
  if (!text) return '';
  return String(text)
    .replace(/\\/g, '/')
    .replace(/:/g, ' - ')
    .replace(/,/g, ' / ')
    .replace(/'/g, '')
    .replace(/\n/g, ' ')
    .replace(/\r/g, '')
    .slice(0, maxLen);
}

function ffTextEscaped(text) {
  return safeText(text)
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/,/g, '\\,')
    .replace(/\//g, '\\/');
}

function ensureDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

function loadJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function collectCategoryGain() {
  return {
    narration: 1.0,
    bgm: 0.56,
    ambience: 0.56,
    combatSfx: 0.92,
    sfx: 0.9,
    npcVoice: 0.95,
    battleTriggerAudio: 0.9,
    state: 0.9,
    skill: 0.95,
  };
}

function normalizeTrackRef(ref, category, partId) {
  if (!ref) return null;
  if (typeof ref === 'string') {
    return resolve(workspaceRoot, ref);
  }

  if (typeof ref === 'object') {
    const raw = ref.path || ref.audio || ref.file;
    if (raw) {
      return resolve(workspaceRoot, String(raw));
    }
    if (ref.id) {
      const guessed = resolve(workspaceRoot, 'assets/audio/elevenlabs', CATEGORY_DIR[category] || '', `${ref.id}.mp3`);
      return guessed;
    }
  }

  console.warn(`[vox-video-pipeline] unknown ${category} entry in ${partId}:`, ref);
  return null;
}

function gatherTracks(part, partId) {
  const gain = collectCategoryGain();
  const entries = [];
  let cutOffsetSec = 0;

  for (const cut of part.cutAudio || []) {
    const offsetSec = cutOffsetSec;
    const push = (category) => {
      const list = cut[category] || [];
      for (const item of list) {
        const file = normalizeTrackRef(item, category, partId);
        if (file) entries.push({ path: file, gain: gain[category] ?? 1.0, category, offsetSec });
      }
    };

    ['narration', 'bgm', 'sfx', 'ambience', 'combatSfx', 'npcVoice', 'battleTriggerAudio', 'state', 'skill'].forEach((category) => push(category));
    cutOffsetSec += Number(cut.durationSec) || 0;
  }

  const uniqueMap = new Map();
  const out = [];
  for (const e of entries) {
    if (!existsSync(e.path)) {
      continue;
    }
    const key = `${e.path}@${e.offsetSec}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, true);
      out.push(e);
    }
  }

  return out;
}

function statHasEnoughSize(filePath, minSeconds, isVideo = false) {
  if (!existsSync(filePath)) return false;
  try {
    const out = execFileSync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath],
      { encoding: 'utf8' },
    );
    const sec = Number(String(out).trim());
    if (!Number.isFinite(sec)) return false;
    return sec >= Math.max(0.5, isVideo ? minSeconds * 0.8 : minSeconds * 0.8);
  } catch (_e) {
    return false;
  }
}

function buildAmixFilter(inputs, durationSec) {
  const labels = inputs.map((_, i) => `a${i}`);
  const normalized = labels
    .map((label, i) => {
      const delayMs = Math.max(0, Math.round((inputs[i].offsetSec || 0) * 1000));
      const delayStage = delayMs > 0 ? `,adelay=${delayMs}|${delayMs}` : '';
      return `[${i}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume=${inputs[i].gain}${delayStage}[${label}]`;
    })
    .join(';');
  const mixers = labels.map((label) => `[${label}]`).join('');

  if (inputs.length === 1) {
    return `${normalized};${mixers}apad,atrim=0:${durationSec}[mixed]`;
  }

  return `${normalized};${mixers}amix=inputs=${inputs.length}:duration=longest:normalize=0,apad,atrim=0:${durationSec}[mixed]`;
}

function buildPartAudioMix(parts, audioRoot, force) {
  const report = { generated: {}, skipped: {}, missingTracks: {} };

  const entries = parts.map((part) => {
    const outWav = resolve(workspaceRoot, audioRoot, part.audioMix);
    const tracks = gatherTracks(part, part.partId);

    if (!force && statHasEnoughSize(outWav, part.durationSec)) {
      report.skipped[part.partId] = { out: part.audioMix };
      return { partId: part.partId, out: outWav, skipped: true };
    }

    ensureDir(outWav);

    if (tracks.length === 0) {
      runFfmpeg([
        '-y',
        '-f',
        'lavfi',
        '-i',
        'anullsrc=r=48000:cl=stereo',
        '-t',
        String(part.durationSec),
        '-c:a',
        'pcm_s16le',
        outWav,
      ], `silence ${part.partId}`);

      report.generated[part.partId] = {
        out: part.audioMix,
        tracksUsed: [],
        trackCount: 0,
        reason: 'no source tracks, generated silence',
      };
      return { partId: part.partId, out: outWav, reason: 'silence' };
    }

    const filter = buildAmixFilter(tracks, part.durationSec);
    const ffArgs = ['-y'];
    for (const t of tracks) ffArgs.push('-i', t.path);
    ffArgs.push('-filter_complex', filter, '-map', '[mixed]', '-t', String(part.durationSec), '-ar', '48000', '-c:a', 'pcm_s16le', outWav);

    runFfmpeg(ffArgs, `mix ${part.partId}`);

    report.generated[part.partId] = {
      out: part.audioMix,
      trackCount: tracks.length,
      tracksUsed: tracks.map((t) => t.path),
      gains: tracks.map((t) => t.gain),
    };

    return { partId: part.partId, out: outWav, tracksUsed: tracks.map((t) => t.path), skipped: false };
  });

  return { report, entries };
}

function buildMotionFilter(style, subtitle1, subtitle2) {
  const filters = [
    `scale=1024:576:force_original_aspect_ratio=decrease,pad=1024:576:(ow-iw)/2:(oh-ih)/2:color=black`,
    style.eq,
  ];

  if (style.motion) {
    filters.push(`drawbox=x='mod(t*82,860)':y='sin(t/2)*100+120':w=420:h=170:color=${style.textColor}@0.10:t=fill`);
  }

  filters.push(
    `drawtext=fontfile=${FONT_PATH}:text='${ffTextEscaped(subtitle1)}':x=30:y=28:fontsize=30:fontcolor=${style.textColor}:box=1:boxcolor=${style.box}:boxborderw=16:shadowx=2:shadowy=2:shadowcolor=black@0.4`
  );

  if (subtitle2) {
    filters.push(
      `drawtext=fontfile=${FONT_PATH}:text='${ffTextEscaped(subtitle2)}':x=30:y=470:fontsize=22:fontcolor=${style.textColor}:box=1:boxcolor=${style.box}:boxborderw=12:shadowx=1:shadowy=1:shadowcolor=black@0.35`
    );
  }

  filters.push('format=yuv420p');
  filters.push('fps=30');

  return filters.filter(Boolean).join(',');
}

function renderPartVideo(part, outputAudioRoot, styleName, forceVideo = false) {
  const style = STYLE_PRESETS[styleName];
  if (!style) throw new Error(`Unknown style: ${styleName}`);

  const audioMix = resolve(workspaceRoot, outputAudioRoot, part.audioMix);
  if (!existsSync(audioMix)) {
    throw new Error(`Missing mixed audio for ${part.partId}: ${audioMix}`);
  }

  const outPath = part.styleOutputs[styleName];
  if (!forceVideo && statHasEnoughSize(outPath, part.durationSec, true)) {
    return { partId: part.partId, style: styleName, skipped: true, out: outPath };
  }

  const partLabel = `${part.partId} / ${part.cutIds.join('/')}`;
  const promptHead = part.scenePrompts?.[0] || '';
  const subtitle1 = `${style.overlayText} | ${partLabel}`;
  const subtitle2 = promptHead;

  const vf = `color=c=0x${style.background}:size=1024x576:d=${part.durationSec},${buildMotionFilter(style, subtitle1, subtitle2)}`;

  const ffArgs = [
    '-y',
    '-f',
    'lavfi',
    '-i',
    vf,
    '-i',
    audioMix,
    '-t',
    String(part.durationSec),
    '-map',
    '0:v',
    '-map',
    '1:a',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '20',
    '-r',
    '30',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-ar',
    '48000',
    '-shortest',
    outPath,
  ];

  ensureDir(outPath);
  runFfmpeg(ffArgs, `render ${part.partId} [${styleName}]`);

  return { partId: part.partId, style: styleName, out: outPath, skipped: false };
}

function concatParts(seqName, styleName, styleDir, partFiles, sequence, finalName, forceConcat) {
  const lines = [];
  const missing = [];

  for (const fileName of sequence) {
    const full = partFiles.get(fileName);
    if (!full) {
      missing.push(fileName);
      continue;
    }
    lines.push(`file '${full}'`);
  }

  if (missing.length) {
    throw new Error(`Missing part files for ${seqName} (${styleName}): ${missing.join(', ')}`);
  }

  const listPath = resolve(workspaceRoot, 'assets', 'video', '.concat', `${seqName}.${styleName}.txt`);
  ensureDir(listPath);
  writeFileSync(listPath, `${lines.join('\n')}\n`, 'utf8');

  const outPath = resolve(styleDir, finalName);

  if (!forceConcat && statHasEnoughSize(outPath, 0.1, true)) {
    return { seq: seqName, style: styleName, skipped: true, out: outPath };
  }

  runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outPath], `concat ${styleName} ${seqName}`);
  return { seq: seqName, style: styleName, out: outPath, skipped: false };
}

function pickPartMetas(playlist, manifest) {
  const partById = new Map();
  for (const p of manifest.parts) partById.set(p.partId, p);

  return playlist.parts.map((p) => {
    const manifestPart = partById.get(p.partId);
    if (!manifestPart) {
      return { ...p, cutAudio: [], scenePrompts: [], cutTrackCount: 0, cutPrompts: [] };
    }

    return {
      partId: p.partId,
      audioMix: p.audioMix,
      output: p.output,
      durationSec: p.durationSec,
      cutIds: p.cutIds || [],
      scenePrompts: manifestPart.scenePrompts || [],
      cutAudio: manifestPart.cutAudio || [],
      cutPrompts: (manifestPart.cutAudio || []).map((c) => ({
        cutId: c.cutId,
        durationSec: c.durationSec,
        prompt: c.scenePrompt || '',
      })),
      cutTrackCount: (manifestPart.cutAudio || []).length,
    };
  });
}

(function main() {
  const shouldAudio = !hasArg('--video-only') && !hasArg('--concat-only') || hasArg('--all');
  const shouldRender = !hasArg('--audio-only') && !hasArg('--concat-only') || hasArg('--all');
  const shouldConcat = hasArg('--concat') || hasArg('--all') || hasArg('--concat-only');
  const force = hasArg('--force');
  const stylesArg = getArg('--styles', 'base');
  const runStyles = stylesArg
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !!STYLE_PRESETS[s]);

  if (runStyles.length === 0) {
    throw new Error(`No valid style selected. Supported: ${Object.keys(STYLE_PRESETS).join(', ')}`);
  }

  const manifest = loadJson(manifestPath);
  const playlist = loadJson(playlistPath);

  const outputAudioRoot = manifest.outputPreset.audioRoot;
  const outputVideoRoot = manifest.outputPreset.videoPartsRoot;

  const partMetas = pickPartMetas(playlist, manifest);

  const report = {
    runId,
    requestedStyles: runStyles,
    parts: partMetas.map((p) => ({
      partId: p.partId,
      durationSec: p.durationSec,
      cutIds: p.cutIds,
      audioMix: p.audioMix,
      output: p.output,
      cutTrackCount: p.cutTrackCount,
    })),
  };

  const videoRootsByStyle = new Map();
  for (const styleName of runStyles) {
    videoRootsByStyle.set(styleName, styleName === 'base' ? resolve(workspaceRoot, outputVideoRoot) : resolve(workspaceRoot, outputVideoRoot, 'styles', styleName));
  }

  for (const part of partMetas) {
    part.styleOutputs = {};
    for (const styleName of runStyles) {
      const base = videoRootsByStyle.get(styleName);
      part.styleOutputs[styleName] = resolve(base, basename(part.output));
    }
  }

  // 1) Mix audio
  if (shouldAudio) {
    const audioResult = buildPartAudioMix(partMetas, outputAudioRoot, force);
    report.audio = audioResult.report;
  }

  // 2) Render part videos
  if (shouldRender) {
    for (const part of partMetas) {
      for (const styleName of runStyles) {
        const result = renderPartVideo(part, outputAudioRoot, styleName, force);
        report.parts.find((x) => x.partId === part.partId)[`render_${styleName}`] = result;
      }
    }
  }

  // 3) Concat sequences
  if (shouldConcat) {
    const names = {
      base: {
        mainline: 'defense_stage1to10_story_01.mp4',
        ending_branch_b: 'defense_stage1to10_story_endingB.mp4',
        cut_only: 'defense_stage1to10_story_cutonly.mp4',
      },
      'anime-soft': {
        mainline: 'defense_stage1to10_story_01_anime_soft.mp4',
        ending_branch_b: 'defense_stage1to10_story_endingB_anime_soft.mp4',
        cut_only: 'defense_stage1to10_story_cutonly_anime_soft.mp4',
      },
      'noir-cut': {
        mainline: 'defense_stage1to10_story_01_noir_cut.mp4',
        ending_branch_b: 'defense_stage1to10_story_endingB_noir_cut.mp4',
        cut_only: 'defense_stage1to10_story_cutonly_noir_cut.mp4',
      },
      'webtoon-static': {
        mainline: 'defense_stage1to10_story_01_webtoon_static.mp4',
        ending_branch_b: 'defense_stage1to10_story_endingB_webtoon_static.mp4',
        cut_only: 'defense_stage1to10_story_cutonly_webtoon_static.mp4',
      },
    };

    for (const styleName of runStyles) {
      const styleRoot = videoRootsByStyle.get(styleName);
      const partFileMap = new Map(partMetas.map((p) => [basename(resolve(workspaceRoot, p.output)), p.styleOutputs[styleName]]));
      const seqRes = {};

      for (const [seqName, sequence] of Object.entries(playlist.sequences || {})) {
        const outName = (names[styleName] && names[styleName][seqName]) || `${seqName}_${styleName}.mp4`;
        seqRes[seqName] = concatParts(seqName, styleName, styleRoot, partFileMap, sequence, outName, force);
      }

      report[`concat_${styleName}`] = seqRes;
    }
  }

  const reportPath = resolve(workspaceRoot, 'production', 'vox-director_video_run_report.json');
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[vox-video-pipeline] done. report=${reportPath}`);
})();
