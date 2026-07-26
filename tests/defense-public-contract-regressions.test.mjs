import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { BattleVisualizer } from "../battle-visualizer.js";
import { CUTSCENES, ITEMS, SKILLS, STAGES } from "../defense-catalog.js";
import { DefenseAudio } from "../defense-audio.js";
import {
  advanceDefenseRun,
  createDefenseRun,
  getRunDigest,
  getRunSnapshot,
} from "../defense-run-simulation.js";

function criticalHitSnapshot() {
  for (let seed = 1; seed <= 16; seed += 1) {
    let run = createDefenseRun({ stageId: "cinder-span", seed });
    for (let tick = 0; tick < 600; tick += 1) {
      run = advanceDefenseRun(run, 1);
      const snapshot = getRunSnapshot(run);
      if (snapshot.events.some(({ type }) => type === "CRITICAL_HIT")) return { run, snapshot };
    }
  }
  return null;
}

test("every authored stage exposes its own public narrative rather than default cutscene copy", () => {
  for (const stage of STAGES) {
    const snapshot = getRunSnapshot(createDefenseRun({ stageId: stage.id, seed: 17 }));
    const started = snapshot.events.find(({ type }) => type === "STAGE_STARTED");

    assert.ok(started, `${stage.id} must emit its stage-start event publicly`);
    assert.deepEqual(snapshot.cutscene, CUTSCENES[stage.id], `${stage.id} must expose its authored cutscene in the public snapshot`);
    assert.deepEqual(started.cutscene, CUTSCENES[stage.id].intro, `${stage.id} must expose its authored entry narrative in the public stage-start event`);
    assert.notDeepEqual(snapshot.cutscene, CUTSCENES.default, `${stage.id} must not silently downgrade to generic cutscene copy`);
  }
});

test("public snapshots retain truthful commander and Gate integrity envelopes", () => {
  const snapshot = getRunSnapshot(createDefenseRun({ stageId: "gate-zenith", seed: 19 }));

  for (const [label, subject] of [["commander", snapshot.commander], ["Gate", snapshot.gate]]) {
    assert.equal(typeof subject.integrity, "number", `${label} must publish current integrity`);
    assert.equal(typeof subject.maxIntegrity, "number", `${label} must publish maximum integrity`);
    assert.ok(subject.integrity >= 0 && subject.integrity <= subject.maxIntegrity, `${label} integrity must remain a player-readable bounded value`);
  }
});

test("critical visual and audio observation is idempotent and cannot alter the deterministic outcome", () => {
  const result = criticalHitSnapshot();
  assert.ok(result, "a fixed Cinder Span search range must yield a public critical event");
  const { run, snapshot } = result;
  const critical = snapshot.events.find(({ type }) => type === "CRITICAL_HIT");
  const digest = getRunDigest(run);
  const originalSnapshot = structuredClone(snapshot);
  const audio = new DefenseAudio({ reducedMotion: true });
  const played = [];
  const visual = new BattleVisualizer();
  audio.play = (cueId, event) => {
    played.push({ cueId, event });
    return true;
  };

  visual.onVisualFeedback(critical.eventId);
  audio.consume([critical, critical]);

  assert.equal(played.length, 1, "a reader must not replay one stable critical event twice");
  assert.equal(played[0].event, critical, "audio must observe the public event object without rewriting it");
  assert.deepEqual(getRunSnapshot(run), originalSnapshot, "visual/audio observation must not mutate the simulation snapshot");
  assert.equal(getRunDigest(run), digest, "visual/audio observation must not alter deterministic run outcome");
});

test("canonical catalog metadata retains stable labels and mechanical entries", () => {
  const entries = [
    [ITEMS["ashen-sigil"], "ashen-sigil", "Cinder Sigil", { damageBonus: 180 }],
    [ITEMS["hourglass-fragment"], "hourglass-fragment", "Ration Sigil Fragment", { cooldownReduction: 0.1 }],
    [SKILLS["void-aegis"], "void-aegis", "Zenith Aegis", { damage: 0, cooldown: 300, radius: 0, integrity: 50 }],
    [SKILLS["ward-binder"], "ward-binder", "Zenith Binder", { maxIntegrity: 120 }],
  ];

  for (const [entry, id, name, numericFields] of entries) {
    assert.equal(entry.id, id, `${name} must retain its stable runtime ID`);
    assert.equal(entry.name, name, `${id} must retain its canonical catalog label`);
    for (const [field, value] of Object.entries(numericFields)) {
      assert.equal(entry[field], value, `${name} must retain ${field}=${value}`);
    }
  }
});

test("shipped command-deck vocabulary retains the canonical faction and companion terms", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(source, /ABYSSAL COMMAND · FARWATCH HOLD/);
  assert.match(source, /정예를 처치하고 <b>추출\(Extract\)<\/b>하여 동료를 확보/);
  assert.doesNotMatch(source, /ABYSSAL COMMAND · DEEP REFUGE/);
  assert.doesNotMatch(source, /복속/);
  assert.doesNotMatch(source, /그림자\s*(?:군단|세력|진영)/);
});
