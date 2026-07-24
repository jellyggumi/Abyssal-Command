#!/usr/bin/env node
// Abyssal Surge audio generation — stage 1-10 batch pipeline
// Uses _workspace/* plan artifacts and writes into assets/audio/elevenlabs/{category}/{id}.mp3
//
// Usage examples:
//   node tmp/generate-audio.mjs --stages 1-10
//   node tmp/generate-audio.mjs --stages 1,2,3 --force
//   node tmp/generate-audio.mjs --only tts --stages 1-10
//   node tmp/generate-audio.mjs --list-voices
//
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = resolve(ROOT, '.env.game-audio');
const MATRIX_PATH_DEFAULT = resolve(ROOT, '_workspace/20260723-solo-warden-rpg-concept/production/storyboard-motion-sound-matrix.json');
let OUT_BASE = resolve(ROOT, 'assets/audio/elevenlabs');
const RESULT_PATH = resolve(ROOT, 'tmp/audio-stage1-10-results.json');
const LEGACY_RESULT_PATH = resolve(ROOT, 'tmp/audio-gen-results.json');

const API = 'https://api.elevenlabs.io/v1';

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^['\"]|['\"]$/g, '');
  }
  return env;
}

const { ELEVENLABS_API_KEY, VOICE_ID: ENV_VOICE_ID } = loadEnv(ENV_PATH);
if (!ELEVENLABS_API_KEY) {
  console.error('ELEVENLABS_API_KEY missing in .env.game-audio');
  process.exit(1);
}

const HEADERS = { 'xi-api-key': ELEVENLABS_API_KEY };

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const LIST_VOICES = args.includes('--list-voices');
const STAGES_ARG = getArg('--stages', null);
const MATRIX_PATH = getArg('--matrix', MATRIX_PATH_DEFAULT);
const KIND_ONLY = getArg('--only', null)?.split(',').map((s) => s.trim()).filter(Boolean) || null;

function getArg(name, defaultValue = null) {
  const idx = args.indexOf(name);
  if (idx < 0) return defaultValue;
  return args[idx + 1] ?? defaultValue;
}

function parseStages(spec, fallbackRange) {
  if (!spec) return fallbackRange || [];
  const stages = new Set();
  for (const part of spec.split(',')) {
    const s = part.trim();
    if (!s) continue;
    const range = s.match(/^(\d+)\s*[-~]\s*(\d+)$/);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      for (let i = lo; i <= hi; i += 1) stages.add(i);
      continue;
    }
    const n = Number(s);
    if (Number.isFinite(n)) stages.add(n);
  }
  const list = Array.from(stages).sort((a, b) => a - b);
  return list.length ? list : fallbackRange || [];
}


function inferCategoryDuration(category) {
  if (category === 'bgm' || category === 'ambience' || category === 'combat') return 12;
  if (category === 'animation') return 1.2;
  if (category === 'sfx') return 1.3;
  return 1.5;
}

function normalizeVoiceSettings(input = {}) {
  return {
    stability: Number(input.stability ?? 0.4),
    similarity_boost: Number(input.similarityBoost ?? input.similarity_boost ?? 0.7),
    style: Number(input.style ?? 0.5),
    use_speaker_boost: Boolean(input.useSpeakerBoost ?? input.use_speaker_boost ?? true),
    speed: Number(input.speed ?? 1.0),
  };
}

function parsePlan(json) {
  const narration = new Map();
  for (const item of json.narrationClips || []) {
    narration.set(item.id, {
      id: item.id,
      text: item.text,
      voiceProfile: item.voice,
      settings: item.settings || {},
      category: 'narration',
      targetCut: item.targetCut,
    });
  }

  const state = new Map();
  for (const key of Object.keys(json.stateNarrations || {})) {
    const item = json.stateNarrations[key];
    state.set(item.id, {
      id: item.id,
      text: item.text,
      voiceProfile: item.voice,
      settings: item.settings || {},
      category: 'state',
      sourceKey: key,
    });
  }

  const skill = new Map();
  for (const key of Object.keys(json.skillTriggerNarrations || {})) {
    const item = json.skillTriggerNarrations[key];
    skill.set(item.id, {
      id: item.id,
      text: item.text,
      voiceProfile: item.voice,
      settings: item.settings || {},
      category: 'skill',
      triggerKey: key,
    });
  }

  const bgmById = new Map();
  const sfxById = new Map();
  for (const group of ['bgm', 'sfx']) {
    const map = json.audioClipsByCategory?.[group] || {};
    for (const value of Object.values(map)) {
      const target = {
        id: value.id,
        category: group,
        targetCut: value.targetCut,
      };
      (group === 'bgm' ? bgmById : sfxById).set(target.id, target);
    }
  }

  const ambienceById = new Map();
  for (const [_, id] of Object.entries(json.stageAmbience || {})) {
    ambienceById.set(id, {
      id,
      category: 'ambience',
    });
  }

  const battle = new Map();
  for (const [k, id] of Object.entries(json.battleTriggerSfx || {})) {
    battle.set(k, id);
  }

  return {
    schemaVersion: json.schemaVersion,
    outputConfig: json.outputConfig || {},
    voiceProfiles: json.voiceProfiles || {},
    narrationClips: narration,
    stateNarrations: state,
    skillNarrations: skill,
    bgmById,
    sfxById,
    ambienceById,
    battle,
    animationSfxMap: json.animationSfxMap || {},
    stageAmbience: json.stageAmbience || {},
    renderWorkflow: json.renderWorkflow || {},
  };
}

function collectCutsByStages(matrix, stages) {
  const stageSet = new Set(stages);
  const seenCuts = new Set();
  const selectedCuts = [];

  if (matrix.stageToCuts && Object.keys(matrix.stageToCuts).length) {
    for (const stage of [...stageSet].sort((a, b) => a - b)) {
      const ids = matrix.stageToCuts[String(stage)] || [];
      for (const id of ids) {
        if (seenCuts.has(id)) continue;
        const cut = (matrix.cuts || []).find((item) => item.cutId === id);
        if (cut) {
          selectedCuts.push(cut);
          seenCuts.add(id);
        }
      }
    }
    if (selectedCuts.length) return selectedCuts;
  }

  for (const cut of matrix.cuts || []) {
    const n = Number(cut.stage);
    if (Number.isFinite(n) && stageSet.has(n) && !seenCuts.has(cut.cutId)) {
      selectedCuts.push(cut);
      seenCuts.add(cut.cutId);
    }
  }
  return selectedCuts;
}

function normalizeActorToken(actor) {
  return actor?.replace(/^boss:/, '') || actor;
}


const CUT_SCENE_FALLBACK_TEXT = {
  npcHaram_lobby_opening: '하람: 오늘은 1단계 봉쇄선 전개가 시작됩니다. 모든 분대의 열화상은 오프라인 브리핑 채널로 집결하세요.',
  npcMeri_lobby_timing: '메리: 이동 타이밍은 0.8초 창을 놓치지 말고, 동기화 후 가호를 배치하세요.',
  npcRael_stage9_choice: '릴: 약속은 깨지면 전부 쓰러집니다. 선택이 곧 다음 장의 명령입니다.',
};

function inferSfxPrompt(id, context = {}) {
  const sid = String(id);
  const tag = sid.toLowerCase();
  const base = context.label || context.cutLabel || context.scenePrompt || `dark fantasy cue ${sid}`;

  if (tag.includes('bgm') || context.category === 'bgm') {
    return `cinematic dark fantasy background music, brooding low brass, ambient choir, cinematic tension loop for ${base}`;
  }

  if (tag.includes('bg_stage') || context.category === 'ambience') {
    return `immersive ambience loop, dark fantasy environment texture, distant wind and machinery, suitable for gameplay ambience scene for ${base}`;
  }

  if (tag.includes('loop')) {
    return `seamless  loopable dark fantasy game SFX cue matching action ${tag}, ${base}`;
  }

  if (tag.includes('boss')) {
    return `powerful boss action SFX for ${sid}, short percussive impact, dark fantasy metal and choral accents, one-shot`;
  }
  if (tag.includes('player_')) {
    return `player combat cue ${sid} in Korean dark-fantasy game, dramatic but clean mix, one-shot`;
  }
  if (tag.includes('enter') || tag.includes('chime') || tag.includes('gate') || tag.includes('forge') || tag.includes('ping') || tag.includes('summon')) {
    return `thematic cinematic cue for ${sid}, sharp onset, atmospheric resonance, one-shot`;
  }

  return `game SFX cue ${sid}, dark fantasy style, short dynamic mix`;
}

function pickVoiceForProfile(profileName, plan) {
  const profile = plan.voiceProfiles?.[profileName] || {};
  if (profile.voiceId && /^V1_/.test(profile.voiceId)) {
    return { ...profile, fallback: true };
  }
  if (!profile.voiceId) return null;
  return profile;
}

async function post(url, body, accept = 'audio/mpeg') {
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json', Accept: accept },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw Object.assign(new Error(`HTTP ${res.status}: ${detail.slice(0, 500)}`), { status: res.status });
  }
  return Buffer.from(await res.arrayBuffer());
}

async function listVoices() {
  const res = await fetch(`${API}/voices`, { headers: HEADERS });
  if (!res.ok) throw new Error(`voices HTTP ${res.status}`);
  const { voices } = await res.json();
  for (const v of voices) {
    const labels = v.labels ? JSON.stringify(v.labels) : '{}';
    console.log(`${v.voice_id}\t${v.name}\t${labels}`);
  }
}

async function genSoundGeneration(item) {
  const out = resolve(OUT_BASE, item.category, `${item.id}.mp3`);
  const existing = !FORCE && existsSync(out);
  if (existing) return { ...item, skipped: true, bytes: statSync(out).size };
  const payload = {
    text: item.prompt,
    duration_seconds: item.durationSeconds,
    prompt_influence: 0.6,
  };
  const buf = await post(`${API}/sound-generation`, payload);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buf);
  return { ...item, skipped: false, bytes: buf.length, path: out.replace(`${ROOT}/`, '') };
}

async function genTextToSpeech(item, plan, category, modelId) {
  const out = resolve(OUT_BASE, String(category), `${item.id}.mp3`);
  const existing = !FORCE && existsSync(out);
  if (existing) return { ...item, skipped: true, bytes: statSync(out).size, path: out.replace(`${ROOT}/`, '') };

  const attemptProfiles = [];
  const profileName = item.voiceProfile || item.voiceId;
  if (profileName) {
    const chosen = pickVoiceForProfile(profileName, plan) || (String(profileName).length >= 15 ? { voiceId: profileName } : null);
    if (chosen?.voiceId) {
      attemptProfiles.push({
        voiceId: chosen.voiceId,
        settings: normalizeVoiceSettings({
          ...(plan.voiceProfiles?.[profileName]?.settings || {}),
          ...(item.settings || {}),
        }),
      });
    }
  }
  const fallbackId = ENV_VOICE_ID || 'onwK4e9ZLuTAKqWW03F9';
  attemptProfiles.push({ voiceId: fallbackId, settings: normalizeVoiceSettings({ stability: 0.4, similarityBoost: 0.8, style: 0.5, useSpeakerBoost: true }) });

  let lastErr;
  for (const attempt of attemptProfiles) {
    try {
      const buf = await post(
        `${API}/text-to-speech/${attempt.voiceId}?output_format=mp3_44100_96`,
        {
          model_id: modelId,
          text: item.text,
          voice_settings: attempt.settings,
        },
      );
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, buf);
      return {
        ...item,
        skipped: false,
        bytes: buf.length,
        voiceId: attempt.voiceId,
        path: out.replace(`${ROOT}/`, ''),
      };
    } catch (e) {
      lastErr = e;
      console.warn(`tts fallback for ${item.id}: ${attempt.voiceId} failed (${e.message})`);
    }
  }
}

function addItem(map, key, item) {
  if (!map.has(key)) map.set(key, item);
}

function resolveSoundPlanPath(matrix, matrixPath) {
  const defaultDir = dirname(matrixPath);
  const provided = matrix?.source?.soundPlan || '';
  const candidates = [];

  if (provided) {
    const explicit = String(provided).trim();
    if (explicit) {
      candidates.push(explicit);
      const artifactRoot = matrix?.artifactRoot ? resolve(ROOT, matrix.artifactRoot) : null;
      if (artifactRoot) candidates.push(resolve(artifactRoot, explicit));
      candidates.push(resolve(defaultDir, explicit));
      candidates.push(resolve(defaultDir, '..', explicit));
    }
  }

  const defaultPlan = resolve(defaultDir, 'elevenlabs_sound_plan.json');
  candidates.push(defaultPlan);

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
    const normalized = resolve(candidate);
    if (existsSync(normalized)) return normalized;
  }

  if (!existsSync(defaultPlan)) {
    const tried = candidates.filter(Boolean).map((v) => resolve(v)).join('\n  ');
    throw new Error(`Unable to resolve sound plan path. Tried:\n  ${tried}`);
  }
  return defaultPlan;
}
async function main() {
  if (LIST_VOICES) return listVoices();

  const matrix = JSON.parse(readFileSync(MATRIX_PATH, 'utf8'));
  if (matrix.artifactRoot) {
    OUT_BASE = resolve(ROOT, matrix.artifactRoot, 'assets/audio/elevenlabs');
  }
  const planPath = resolveSoundPlanPath(matrix, MATRIX_PATH);
  const plan = parsePlan(JSON.parse(readFileSync(planPath, 'utf8')));

  const requestedStages = parseStages(STAGES_ARG, matrix.stageRange ? matrix.stageRange.map((x) => Number(x)).filter(Boolean) : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const selectedCuts = collectCutsByStages(matrix, requestedStages);

  if (!selectedCuts.length) {
    console.log(`selected stages have no cuts: ${requestedStages.join(',')}`);
    return;
  }


  const toGenerate = new Map();
  const missing = [];

  // Collect narrative lines for selected cuts.
  for (const cut of selectedCuts) {
    const narrationIds = [...(cut.audio?.narration || [])];
    for (const id of narrationIds) {
      const entry = plan.narrationClips.get(id);
      if (!entry) {
        missing.push({ id, kind: 'narration', source: cut.cutId, reason: 'missing in plan.narrationClips' });
        continue;
      }
      addItem(toGenerate, `tts|narration|${entry.id}`, {
        category: 'narration',
        ...entry,
        targetCut: cut.cutId,
      });
    }

    const stateIds = [...(cut.triggers?.stateNarration || [])];
    for (const id of stateIds) {
      const entry = plan.stateNarrations.get(id);
      if (!entry) {
        missing.push({ id, kind: 'state', source: cut.cutId, reason: 'missing in plan.stateNarrations' });
        continue;
      }
      addItem(toGenerate, `tts|state|${entry.id}`, {
        category: 'state',
        ...entry,
        targetCut: cut.cutId,
      });
    }

    const skillIds = [...(cut.triggers?.skillNarration || [])];
    for (const id of skillIds) {
      const entry = plan.skillNarrations.get(id);
      if (!entry) {
        missing.push({ id, kind: 'skill', source: cut.cutId, reason: 'missing in plan.skillTriggerNarrations' });
        continue;
      }
      addItem(toGenerate, `tts|skill|${entry.id}`, {
        category: 'skill',
        ...entry,
        targetCut: cut.cutId,
      });
    }

    const npcIds = [...(cut.audio?.npcVoiceSamples || []), ...(cut.audio?.npcVoice || [])];
    for (const id of npcIds) {
      const text = CUT_SCENE_FALLBACK_TEXT[id] || `${cut.label || cut.cutId}: NPC line ${id}`;
      const profile = id.startsWith('npcHaram') ? 'npcHaram' : id.startsWith('npcMeri') ? 'npcMeri' : id.startsWith('npcRael') ? 'npcRael' : 'narrator';
      addItem(toGenerate, `tts|npc|${id}`, {
        category: 'npc',
        id,
        text,
        voiceId: profile,
        settings: plan.voiceProfiles?.[profile]?.settings || {},
        targetCut: cut.cutId,
      });
    }

    for (const id of cut.audio?.bgm || []) {
      const entry = plan.bgmById.get(id);
      if (!entry) {
        missing.push({ id, kind: 'bgm', source: cut.cutId, reason: 'missing in plan.audioClipsByCategory.bgm' });
        addItem(toGenerate, `sfx|bgm|${id}`, {
          category: 'bgm',
          id,
          prompt: inferSfxPrompt(id, { category: 'bgm', cutLabel: cut.label, scenePrompt: cut.scenePrompt }),
          durationSeconds: inferCategoryDuration('bgm'),
          targetCut: cut.cutId,
        });
        continue;
      }
      addItem(toGenerate, `tts|bgm|${entry.id}`, {
        category: 'bgm',
        id: entry.id,
        prompt: inferSfxPrompt(entry.id, { category: 'bgm', cutLabel: cut.label, scenePrompt: cut.scenePrompt }),
        durationSeconds: inferCategoryDuration('bgm'),
        targetCut: cut.cutId,
      });
    }

    const ambienceIds = Array.isArray(cut.audio?.ambience)
      ? cut.audio.ambience
      : cut.audio?.ambience
      ? [cut.audio.ambience]
      : [];
    for (const id of ambienceIds) {
      addItem(toGenerate, `sfx|ambience|${id}`, {
        category: 'ambience',
        id,
        prompt: inferSfxPrompt(id, { category: 'ambience', cutLabel: cut.label, scenePrompt: cut.scenePrompt }),
        durationSeconds: inferCategoryDuration('ambience'),
        targetCut: cut.cutId,
      });
    }

    const sfxIds = [...(cut.audio?.sfx || [])];
    for (const id of sfxIds) {
      addItem(toGenerate, `sfx|${id}`, {
        category: 'sfx',
        id,
        prompt: inferSfxPrompt(id, { category: 'sfx', cutLabel: cut.label, scenePrompt: cut.scenePrompt }),
        durationSeconds: inferCategoryDuration('sfx'),
        targetCut: cut.cutId,
      });
    }

    const combatIds = [...(cut.triggers?.battleSfx || []), ...(cut.audio?.combatSfx || [])];
    for (const eventOrId of combatIds) {
      const mappedId = plan.battle.get(eventOrId) || plan.battle.get(String(eventOrId)) || eventOrId;
      addItem(toGenerate, `combat|${mappedId}`, {
        category: 'combat',
        id: mappedId,
        prompt: inferSfxPrompt(mappedId, { category: 'combat', cutLabel: cut.label, scenePrompt: cut.scenePrompt }),
        durationSeconds: inferCategoryDuration('combat'),
        targetCut: cut.cutId,
        sourceEvent: eventOrId,
      });
    }

    for (const move of cut.motion || []) {
      const actor = normalizeActorToken(move.actor);
      const action = move.action;
      if (!actor || !action) continue;
      const byActor = plan.animationSfxMap?.[actor];
      const fxId = byActor?.[action];
      if (!fxId) {
        if (String(action) === 'show' && actor !== 'player') {
          missing.push({ id: `${actor}:${action}`, kind: 'animation-sfx', source: cut.cutId, reason: `no mapping for actor ${actor}` });
        }
        continue;
      }
      addItem(toGenerate, `sfx|${fxId}`, {
        category: 'sfx',
        id: fxId,
        prompt: inferSfxPrompt(fxId, {
          category: 'sfx',
          cutLabel: cut.label,
          scenePrompt: cut.scenePrompt,
          actor,
          action,
        }),
        durationSeconds: inferCategoryDuration('sfx'),
        targetCut: cut.cutId,
        sourceAction: `${actor}:${action}`,
      });
    }
  }

  // Always include stage-level ambience defined in map for selected stages.
  for (const stage of requestedStages) {
    const key = `stage${String(stage).padStart(2, '0')}`;
    const ambienceId = plan.stageAmbience[key];
    if (ambienceId) {
      addItem(toGenerate, `sfx|ambience|${ambienceId}`, {
        category: 'ambience',
        id: ambienceId,
        prompt: inferSfxPrompt(ambienceId, { category: 'ambience', cutLabel: `stage${stage}` }),
        durationSeconds: inferCategoryDuration('ambience'),
      });
    }
  }

  // Ensure base runtime IDs listed in plan are included once if used by runtime contract.
  for (const entry of plan.battle.values()) {
    const usedInCuts = [...toGenerate.values()].some((x) => x.category === 'combat' && x.id === entry);
    if (!usedInCuts) continue;
  }

  // Inject globally requested narration/state/skill ids if the runtime config asks for all-first.
  const runtime = matrix.elevenlabsRuntime || {};
  if (runtime.generateAllNarrationAndStateFirst) {
    for (const id of runtime.narrationIdsUsed || []) {
      const entry = plan.narrationClips.get(id);
      if (entry) {
        addItem(toGenerate, `tts|narration|${entry.id}`, {
          category: 'narration',
          ...entry,
        });
      }
    }
    for (const id of runtime.stateNarrationIds || []) {
      const entry = plan.stateNarrations.get(id);
      if (entry) {
        addItem(toGenerate, `tts|state|${entry.id}`, {
          category: 'state',
          ...entry,
        });
      }
    }
    for (const id of runtime.skillNarrationIds || []) {
      const entry = plan.skillNarrations.get(id);
      if (entry) {
        addItem(toGenerate, `tts|skill|${entry.id}`, {
          category: 'skill',
          ...entry,
        });
      }
    }
    for (const id of runtime.combatSfxIds || []) {
      const mapped = plan.battle.get(id) || id;
      addItem(toGenerate, `combat|${mapped}`, {
        category: 'combat',
        id: mapped,
        prompt: inferSfxPrompt(mapped, { category: 'combat' }),
        durationSeconds: inferCategoryDuration('combat'),
        sourceEvent: id,
      });
    }
  }

  const items = Array.from(toGenerate.values()).filter((item) => {
    if (!KIND_ONLY) return true;
    if (KIND_ONLY.includes('tts')) return item.category === 'narration' || item.category === 'state' || item.category === 'skill' || item.category === 'npc';
    return KIND_ONLY.includes(item.category);
  });

  const selected = [];
  const results = [];

  // keep deterministic ordering
  const ordered = items.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    if (a.targetCut && b.targetCut && a.targetCut !== b.targetCut) return a.targetCut.localeCompare(b.targetCut);
    return a.id.localeCompare(b.id);
  });

  const modelId = plan.outputConfig?.ttsModel || 'eleven_multilingual_v2';

  for (const item of ordered) {
    selected.push(item);
    try {
      const result =
        item.category === 'narration' || item.category === 'state' || item.category === 'skill' || item.category === 'npc'
          ? await genTextToSpeech(item, plan, item.category, modelId)
          : await genSoundGeneration(item);
      result.category = item.category;
      result.id = item.id;
      result.targetCut = item.targetCut;
      result.source = item.sourceAction || item.sourceEvent || item.sourceKey || null;
      result.ok = true;
      results.push({
        ...result,
      });
      const label = `${item.category} ${item.id}`;
      if (result.skipped) {
        console.log(`skip ${label} (${result.bytes}B)`);
      } else {
        console.log(`ok   ${label} ${result.bytes}B`);
      }
    } catch (e) {
      const err = e.message || String(e);
      console.error(`FAIL ${item.category} ${item.id}: ${err}`);
      results.push({
        category: item.category,
        id: item.id,
        targetCut: item.targetCut,
        source: item.sourceAction || item.sourceEvent || item.sourceKey || null,
        path: null,
        skipped: false,
        ok: false,
        status: e.status,
        error: err,
      });
    }
  }

  const runSummary = {
    generatedAt: new Date().toISOString(),
    request: {
      sourceMatrix: MATRIX_PATH,
      sourceSoundPlan: planPath,
      stages: requestedStages,
      stageCuts: selectedCuts.map((x) => x.cutId),
      only: KIND_ONLY,
      force: FORCE,
    },
    outputBase: 'assets/audio/elevenlabs/{category}/{id}.mp3',
    totals: {
      requested: selected.length,
      generated: results.filter((x) => x.ok && !x.skipped).length,
      skipped: results.filter((x) => x.ok && x.skipped).length,
      failed: results.filter((x) => !x.ok).length,
    },
    results,
    missing,
  };

  mkdirSync(dirname(RESULT_PATH), { recursive: true });
  writeFileSync(RESULT_PATH, JSON.stringify(runSummary, null, 2));
  writeFileSync(LEGACY_RESULT_PATH, JSON.stringify(results, null, 2));

  const failed = runSummary.totals.failed;
  console.log(`\n${runSummary.totals.generated} generated, ${runSummary.totals.skipped} skipped, ${failed} failed`);
  if (failed) process.exitCode = 2;

  if (missing.length) {
    console.warn(`\nmissing ids: ${missing.length}`);
    for (const m of missing.slice(0, 20)) {
      console.warn(`- [${m.kind}] ${m.id} (cut=${m.source}) ${m.reason}`);
    }
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

