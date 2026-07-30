#!/usr/bin/env node
// Abyssal Lantern defense audio — ElevenLabs sound-generation batch.
//
// Reads assets/audio/elevenlabs-sound-plan.json (concept-driven prompts keyed to
// the runtime cue/variant IDs in defense-audio.js) and generates one mp3 per
// entry via POST /v1/sound-generation. Writes the runtime sample map to
// assets/audio/elevenlabs/index.json, which DefenseAudio loads when sample mode
// is enabled (procedural oscillators remain the authoritative fallback).
//
// Usage:
//   node scripts/generate-defense-audio.mjs             # generate missing files
//   node scripts/generate-defense-audio.mjs --force     # regenerate everything
//   node scripts/generate-defense-audio.mjs --only sfx  # sfx | loops
//   node scripts/generate-defense-audio.mjs --dry-run   # print the work list
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = resolve(ROOT, '.env.game-audio');
const PLAN_PATH = resolve(ROOT, 'assets/audio/elevenlabs-sound-plan.json');
const RESULT_PATH = resolve(ROOT, 'tmp/defense-audio-results.json');
const API = 'https://api.elevenlabs.io/v1';

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const { ELEVENLABS_API_KEY } = { ...loadEnv(ENV_PATH), ...process.env };
if (!ELEVENLABS_API_KEY) {
  console.error('ELEVENLABS_API_KEY missing (.env.game-audio or environment).');
  process.exit(1);
}

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const DRY_RUN = args.includes('--dry-run');
const onlyIndex = args.indexOf('--only');
const ONLY = onlyIndex >= 0 ? args[onlyIndex + 1] : null;

const plan = JSON.parse(readFileSync(PLAN_PATH, 'utf8'));
const outBase = resolve(ROOT, plan.outputBase);

async function generate(entry, category) {
  const out = resolve(outBase, category, `${entry.key}.mp3`);
  if (!FORCE && existsSync(out) && statSync(out).size > 0) {
    return { key: entry.key, category, skipped: true, bytes: statSync(out).size };
  }
  if (DRY_RUN) return { key: entry.key, category, dryRun: true };
  const res = await fetch(`${API}/sound-generation`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: entry.prompt,
      duration_seconds: entry.duration,
      prompt_influence: entry.promptInfluence ?? 0.6,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buf);
  return { key: entry.key, category, skipped: false, bytes: buf.length };
}

function buildRuntimeIndex() {
  // Runtime sample map consumed by DefenseAudio.enableSamples().
  // cues:  playback key (variant key or cue id) -> { url, gain }
  // loops: `${kind}:${stageId}` -> { url, gain }
  const cues = {};
  for (const entry of plan.sfx) {
    const url = `${plan.outputBase}/sfx/${entry.key}.mp3`;
    const file = resolve(outBase, 'sfx', `${entry.key}.mp3`);
    if (!existsSync(file) || statSync(file).size === 0) continue;
    const target = { url, gain: entry.gain ?? 0.8 };
    const keys = [entry.variant ?? entry.cueId, ...(entry.variantAliases ?? [])];
    for (const key of keys) cues[key] = target;
  }
  const loops = {};
  for (const entry of plan.loops) {
    const url = `${plan.outputBase}/loops/${entry.key}.mp3`;
    const file = resolve(outBase, 'loops', `${entry.key}.mp3`);
    if (!existsSync(file) || statSync(file).size === 0) continue;
    loops[`${entry.kind}:${entry.stageId}`] = { url, gain: entry.gain ?? 0.5 };
  }
  return {
    schemaVersion: 1,
    generator: 'scripts/generate-defense-audio.mjs',
    source: 'elevenlabs /v1/sound-generation',
    concept: 'Abyssal Lantern (심연의 등불)',
    cues,
    loops,
  };
}

async function main() {
  const work = [];
  if (!ONLY || ONLY === 'sfx') for (const entry of plan.sfx) work.push([entry, 'sfx']);
  if (!ONLY || ONLY === 'loops') for (const entry of plan.loops) work.push([entry, 'loops']);

  const results = [];
  let failed = 0;
  for (const [entry, category] of work) {
    try {
      const result = await generate(entry, category);
      results.push(result);
      const status = result.dryRun ? 'plan' : result.skipped ? 'skip' : 'ok  ';
      console.log(`${status} ${category}/${entry.key} ${result.bytes ?? entry.duration + 's'}`);
    } catch (e) {
      failed += 1;
      results.push({ key: entry.key, category, error: e.message });
      console.error(`FAIL ${category}/${entry.key}: ${e.message}`);
    }
  }

  if (!DRY_RUN) {
    const index = buildRuntimeIndex();
    const indexPath = resolve(outBase, 'index.json');
    mkdirSync(outBase, { recursive: true });
    writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
    console.log(`\nindex: ${indexPath.replace(`${ROOT}/`, '')} (${Object.keys(index.cues).length} cue keys, ${Object.keys(index.loops).length} loops)`);
    mkdirSync(dirname(RESULT_PATH), { recursive: true });
    writeFileSync(RESULT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  }

  const generated = results.filter((r) => r.skipped === false).length;
  const skipped = results.filter((r) => r.skipped === true).length;
  console.log(`${generated} generated, ${skipped} skipped, ${failed} failed`);
  if (failed) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
