import assert from "node:assert/strict";
import test from "node:test";

import { CINDER_SPAN_SURPRISE_TABLE } from "../defense-catalog.js";
import { createDefenseRun, getRunSnapshot } from "../defense-run-simulation.js";
import {
  SPEECH_BUBBLE_EVENT_TYPES,
  SPEECH_BUBBLE_PRIORITY,
  SpeechBubbleDirector,
  speechBubbleEligible,
  speechBubbleFor,
  speechBubbleHoldMs,
  speechBubbleLine,
  speechBubbleSpeakerFor,
  speechBubbleTextFor,
} from "../defense-speech-bubble.js";
import { STAGE_STORIES } from "../stage-story-catalog.js";

/**
 * Fixtures are pulled out of STAGE_STORIES rather than invented, so a change to
 * the authored dialogue shape (a renamed beat, a dropped `speaker`, a line
 * rewritten down to one sentence) reddens these tests instead of leaving them
 * passing against strings no shipping build ever renders.
 */
function authoredStage(stageId) {
  const story = STAGE_STORIES[stageId];
  assert.ok(story, `STAGE_STORIES must still author stage ${stageId}`);
  return story;
}

function authoredBeat(stageId, beatId) {
  const beat = authoredStage(stageId).storyBeats.find((entry) => entry.id === beatId);
  assert.ok(beat, `stage ${stageId} must still author beat ${beatId}`);
  assert.equal(typeof beat.dialogue?.text, "string", `beat ${beatId} must author dialogue text`);
  return beat;
}

function authoredAcquisitionLine(stageId, speaker) {
  const line = authoredStage(stageId).quest.acquisitionDialogue.find((entry) => entry.speaker === speaker);
  assert.ok(line, `stage ${stageId} must still author an acquisition line for ${speaker}`);
  return line;
}

/** Mirrors the enrichment defense-run-simulation.js's `emit` applies to a story event. */
function storyEvent(stageId, beat, extra = {}) {
  const story = authoredStage(stageId);
  return {
    type: beat.event.type,
    ...beat.event,
    stageId,
    storyBeat: beat,
    quest: { questId: story.quest.id, questGiverNpcId: story.quest.giverNpcId },
    ...extra,
  };
}

function everyAuthoredBeat() {
  return Object.entries(STAGE_STORIES).flatMap(([stageId, story]) =>
    story.storyBeats.map((beat) => ({ stageId, beat })));
}

/** Text after the first sentence terminator — what the old speech path threw away. */
function tailAfterFirstSentence(text) {
  const terminator = text.search(/[.!?]/u);
  assert.ok(terminator > 0 && terminator < text.length - 1,
    `fixture must be a multi-sentence authored line, got: ${text}`);
  return text.slice(terminator + 1).trim();
}

// ---------------------------------------------------------------------------
// Line normalization
// ---------------------------------------------------------------------------

test("speechBubbleLine strips bracketed stage direction in all three authored bracket forms", () => {
  const authored = authoredBeat("cinder-span", "cinder-span:boss-entry").dialogue.text;
  const wrapped = [
    ["ascii square", `[낮게] ${authored}`],
    ["ascii paren", `(속삭이며) ${authored}`],
    ["full-width paren", `（속삭이며） ${authored}`],
    ["leading and trailing", `[낮게] ${authored} （끝）`],
  ];
  for (const [label, source] of wrapped) {
    assert.deepEqual(speechBubbleLine(source), { speaker: null, text: authored },
      `${label} stage direction must be stripped without touching the authored line`);
  }

  assert.equal(speechBubbleLine("[웃으며]"), null,
    "a line that is nothing but stage direction has no displayable text");
  assert.deepEqual(speechBubbleLine("[낮게] 등불을 (조용히) 내려라."), { speaker: null, text: "등불을 내려라." },
    "mid-line stage direction is removed and the resulting double space collapses");
});

test("speechBubbleLine splits a speaker prefix only when the colon lands before column 40", () => {
  const line = authoredAcquisitionLine("cinder-span", "EMBER LOOKOUT");

  assert.deepEqual(speechBubbleLine(`${line.speaker}: ${line.text}`),
    { speaker: line.speaker, text: line.text },
    "an authored `speaker:` prefix is carried out as .speaker and excluded from .text");
  assert.deepEqual(speechBubbleLine(`${line.speaker}： ${line.text}`),
    { speaker: line.speaker, text: line.text },
    "a full-width colon divides the same way");

  const atLastAcceptedColumn = `${"A".repeat(39)}: ${line.text}`;
  const atFirstRejectedColumn = `${"A".repeat(40)}: ${line.text}`;
  assert.equal(atLastAcceptedColumn.indexOf(":"), 39, "fixture must place the colon at column 39");
  assert.equal(atFirstRejectedColumn.indexOf(":"), 40, "fixture must place the colon at column 40");

  assert.deepEqual(speechBubbleLine(atLastAcceptedColumn), { speaker: "A".repeat(39), text: line.text },
    "a colon at column 39 is still a speaker prefix");
  assert.deepEqual(speechBubbleLine(atFirstRejectedColumn),
    { speaker: null, text: atFirstRejectedColumn },
    "a colon at column 40 is prose punctuation, so the whole line stays in .text");

  assert.deepEqual(speechBubbleLine(`: ${line.text}`), { speaker: null, text: `: ${line.text}` },
    "a leading colon names no speaker and must not produce an empty label");
});

test("speechBubbleLine requires Hangul in the body, not merely in the speaker label", () => {
  assert.equal(speechBubbleLine("DUSK WARDEN: lower the lantern."), null,
    "an all-latin line carries no authored Korean copy and must be skipped");
  assert.equal(speechBubbleLine("감시자: lower the lantern."), null,
    "Hangul in the speaker label must not qualify a latin body — the label is not the line");

  const authored = authoredBeat("echo-throne", "echo-throne:boss-entry").dialogue.text;
  assert.deepEqual(speechBubbleLine(`DUSK WARDEN: lower the lantern.\n감시자: ${authored}`),
    { speaker: "감시자", text: authored },
    "the walk continues past a rejected line to the first line that has Korean body copy");

  for (const value of [null, undefined, 42, {}, []]) {
    assert.equal(speechBubbleLine(value), null, `non-string input ${JSON.stringify(value)} yields no line`);
  }
});

test("speechBubbleLine keeps every sentence of a multi-sentence authored line", () => {
  const multiSentence = [
    authoredBeat("cinder-span", "cinder-span:reversal"),
    authoredBeat("cinder-span", "cinder-span:completion"),
    authoredBeat("echo-throne", "echo-throne:completion"),
  ];
  for (const beat of multiSentence) {
    const authored = beat.dialogue.text;
    const tail = tailAfterFirstSentence(authored);
    const line = speechBubbleLine(authored);
    assert.ok(line, `${beat.id} must resolve to a displayable line`);
    assert.equal(line.text, authored, `${beat.id} must survive normalization byte for byte`);
    assert.ok(line.text.includes(tail),
      `${beat.id} must keep the sentence after the first terminator — a bubble is not truncated like speech was`);
    assert.ok(line.text.endsWith(tail), `${beat.id} must end on its final authored sentence`);
  }
});

test("speechBubbleLine clamps a runaway line to 140 characters and trims the cut edge", () => {
  const overLong = "가".repeat(200);
  const clamped = speechBubbleLine(overLong);
  assert.equal(clamped.text.length, 140, "an over-long line is cut to the bubble's character budget");
  assert.ok(overLong.startsWith(clamped.text), "the clamp keeps the head of the line, not an arbitrary slice");

  const atBudget = "가".repeat(140);
  assert.equal(speechBubbleLine(atBudget).text, atBudget, "a line exactly at the budget is untouched");

  const justUnder = "나".repeat(139);
  assert.equal(speechBubbleLine(justUnder).text, justUnder, "a line under the budget is untouched");

  const cutOnWhitespace = `${"가".repeat(139)} ${"나".repeat(20)}`;
  const trimmed = speechBubbleLine(cutOnWhitespace).text;
  assert.equal(trimmed.length, 139, "a clamp landing on a space must not leave the space dangling");
  assert.equal(trimmed, trimmed.trimEnd(), "the clamped line never ends in whitespace");
});

test("speechBubbleLine takes the first line carrying Hangul out of a multi-line block", () => {
  const first = authoredBeat("abyss-chancel", "abyss-chancel:boss-entry").dialogue.text;
  const second = authoredBeat("abyss-chancel", "abyss-chancel:completion").dialogue.text;

  assert.equal(speechBubbleLine(`${first}\n${second}`).text, first,
    "the first displayable line wins over later ones");
  assert.equal(speechBubbleLine(`   \n\n${second}`).text, second,
    "blank lines are skipped rather than returned as empty text");
  assert.equal(speechBubbleLine(`（웃으며）\n${second}`).text, second,
    "a line reduced to nothing by stage-direction stripping is skipped, not returned empty");
});

// ---------------------------------------------------------------------------
// Speaker + anchor resolution
// ---------------------------------------------------------------------------

test("every authored story beat resolves to a story-priority bubble carrying its own line", () => {
  const beats = everyAuthoredBeat();
  assert.ok(beats.length >= 12, "the catalog must still author the stage story beats these tests cover");

  for (const { stageId, beat } of beats) {
    const bubble = speechBubbleFor(storyEvent(stageId, beat));
    assert.ok(bubble, `${beat.id} must produce a bubble`);
    assert.equal(bubble.text, beat.dialogue.text, `${beat.id} must display its authored line verbatim`);
    assert.equal(bubble.speaker, beat.dialogue.speaker, `${beat.id} must label its authored speaker`);
    assert.equal(bubble.eventType, beat.event.type, `${beat.id} must report the event it came from`);
    assert.equal(bubble.story, true, `${beat.id} is authored story copy`);
    assert.equal(bubble.priority, SPEECH_BUBBLE_PRIORITY.story, `${beat.id} must take story priority`);
    assert.ok(["narrator", "keeper", "antagonist", "warden"].includes(bubble.role),
      `${beat.id} resolved an unknown role: ${bubble.role}`);
    assert.equal(bubble.holdMs, speechBubbleHoldMs(beat.dialogue.text),
      `${beat.id}'s hold must be derived from the line it actually shows`);
  }
});

test("the role ladder maps each authored speaker class to its own anchor class", () => {
  const cases = [
    { stageId: "cinder-span", beatId: "cinder-span:acquisition", role: "keeper", anchorKind: "stage-npc" },
    { stageId: "abyss-chancel", beatId: "abyss-chancel:acquisition", role: "keeper", anchorKind: "stage-npc" },
    { stageId: "cinder-span", beatId: "cinder-span:boss-entry", role: "antagonist", anchorKind: "entity" },
    { stageId: "echo-throne", beatId: "echo-throne:reversal", role: "antagonist", anchorKind: "entity" },
    { stageId: "cinder-span", beatId: "cinder-span:completion", role: "warden", anchorKind: "commander" },
    { stageId: "echo-throne", beatId: "echo-throne:completion", role: "warden", anchorKind: "commander" },
    // A `questCompletion` spoken by the tactician stays antagonist: the metadata
    // ladder runs before the "completion beats are the warden" type fallback.
    { stageId: "abyss-chancel", beatId: "abyss-chancel:completion", role: "antagonist", anchorKind: "entity" },
  ];

  for (const { stageId, beatId, role, anchorKind } of cases) {
    const beat = authoredBeat(stageId, beatId);
    const event = storyEvent(stageId, beat);
    const speaker = speechBubbleSpeakerFor(event, beat.dialogue.speaker);
    assert.equal(speaker.role, role, `${beatId} (${beat.dialogue.speaker}) must resolve role ${role}`);
    assert.equal(speaker.anchorKind, anchorKind, `${beatId} must anchor as ${anchorKind}`);
    assert.equal(speechBubbleFor(event).role, role, `${beatId}'s bubble must carry the same role`);
  }

  // Role tokens that reach the ladder through metadata rather than a beat.
  assert.equal(speechBubbleSpeakerFor({ type: "BOSS_SPAWNED", voiceRole: "commander" }).role, "warden",
    "an explicit commander voiceRole is the player-side speaker");
  assert.equal(speechBubbleSpeakerFor({ type: "OCCUPATION_CAPTURED" }, "황혼의 파수꾼").role, "warden",
    "the warden's own Korean label round-trips back to the warden role");
  assert.equal(speechBubbleSpeakerFor({ type: "OCCUPATION_CAPTURED" }, "감시자").role, "keeper",
    "the keeper's Korean label resolves keeper");
  assert.equal(speechBubbleSpeakerFor({ type: "OCCUPATION_CAPTURED" }).role, "narrator",
    "a beat with no speaker metadata and no warden-defaulting type falls through to the narrator");
});

test("a questAcquisition beat spoken by DUSK WARDEN resolves warden, beating the keeper rule its kind would hit", () => {
  const beat = authoredBeat("cinder-span", "cinder-span:acquisition");
  assert.equal(beat.kind, "questAcquisition", "the ordering trap only exists while the beat kind is questAcquisition");

  const keeperLine = authoredAcquisitionLine("cinder-span", "EMBER LOOKOUT");
  const wardenLine = authoredAcquisitionLine("cinder-span", "DUSK WARDEN");

  const keeperBubble = speechBubbleFor(storyEvent("cinder-span", { ...beat, dialogue: keeperLine }));
  const wardenBubble = speechBubbleFor(storyEvent("cinder-span", { ...beat, dialogue: wardenLine }));

  // Same beat kind, same event, same quest — only the authored speaker differs.
  assert.equal(keeperBubble.role, "keeper",
    "the questAcquisition kind alone resolves keeper, which is what makes the next assertion load-bearing");
  assert.equal(wardenBubble.role, "warden",
    "the warden pattern is tested before the keeper pattern, so a DUSK WARDEN acquisition line is the warden");

  assert.deepEqual(keeperBubble.anchor,
    { kind: "stage-npc", id: authoredStage("cinder-span").quest.giverNpcId, questId: authoredStage("cinder-span").quest.id },
    "the keeper reading hangs the bubble on the quest-giver NPC");
  assert.deepEqual(wardenBubble.anchor, { kind: "entity", id: "commander" },
    "the warden reading moves the same beat's bubble onto the commander — the trap changes where it is drawn");
});

test("an authored speaker label overrides the role's default label without changing the role", () => {
  const beat = authoredBeat("abyss-chancel", "abyss-chancel:acquisition");
  const event = storyEvent("abyss-chancel", beat);

  const withAuthored = speechBubbleSpeakerFor(event, beat.dialogue.speaker);
  const withoutAuthored = speechBubbleSpeakerFor(event, null);

  assert.equal(withAuthored.role, withoutAuthored.role, "the label does not decide the role here — the kind does");
  assert.equal(withAuthored.label, beat.dialogue.speaker, "the authored label is what the bubble shows");
  assert.notEqual(withAuthored.label, withoutAuthored.label,
    "the authored label must actually displace the role's stand-in label");
  assert.equal(speechBubbleFor(event).speaker, beat.dialogue.speaker,
    "the resolved bubble carries the authored label through");
});

test("anchors resolve to the renderer collection that can actually project the speaker", () => {
  const story = authoredStage("cinder-span");
  const acquisition = authoredBeat("cinder-span", "cinder-span:acquisition");
  const bossEntry = authoredBeat("echo-throne", "echo-throne:boss-entry");
  const reversal = authoredBeat("cinder-span", "cinder-span:reversal");
  const completion = authoredBeat("cinder-span", "cinder-span:completion");

  assert.deepEqual(speechBubbleFor(storyEvent("cinder-span", completion)).anchor,
    { kind: "entity", id: "commander" },
    "the warden speaks from the commander's body");

  assert.deepEqual(speechBubbleFor(storyEvent("cinder-span", acquisition)).anchor,
    { kind: "stage-npc", id: story.quest.giverNpcId, questId: story.quest.id },
    "a keeper beat with a quest giver anchors on that NPC record");

  assert.deepEqual(
    speechBubbleFor({
      type: "STAGE_STARTED", stageId: "cinder-span", storyBeat: acquisition, quest: { questId: story.quest.id },
    }).anchor,
    { kind: "stage-npc", id: null, questId: story.quest.id },
    "a keeper beat carrying only a questId still anchors on the NPC record, matched by quest");

  assert.deepEqual(
    speechBubbleFor({ type: "STAGE_STARTED", stageId: "cinder-span", storyBeat: acquisition }).anchor,
    { kind: "none", id: null },
    "a keeper beat with no quest at all has no body to hang on");

  const bossEvent = storyEvent("echo-throne", bossEntry, { entityId: "boss-482" });
  assert.notEqual(bossEvent.bossId, bossEvent.entityId, "fixture must distinguish the live entity from the catalog boss id");
  assert.deepEqual(speechBubbleFor(bossEvent).anchor, { kind: "entity", id: "boss-482" },
    "BOSS_SPAWNED prefers the live entity id, which is the one the renderer can project");
  assert.deepEqual(speechBubbleFor(storyEvent("echo-throne", bossEntry)).anchor,
    { kind: "entity", id: bossEntry.event.bossId },
    "without a live entity id the catalog boss id is the fallback subject");

  assert.deepEqual(speechBubbleFor(storyEvent("cinder-span", reversal)).anchor, { kind: "none", id: null },
    "an antagonist taunt with no body on screen degrades to the bodiless anchor instead of a dangling id");
});

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

test("every authored beat fires on an event type the bubble channel admits", () => {
  for (const { stageId, beat } of everyAuthoredBeat()) {
    assert.ok(SPEECH_BUBBLE_EVENT_TYPES.has(beat.event.type),
      `${stageId} authors ${beat.id} on ${beat.event.type}, which the bubble channel would silently drop`);
    assert.equal(speechBubbleEligible(storyEvent(stageId, beat)), true,
      `${beat.id} must be eligible as the simulation emits it`);
  }
});

test("OBJECTIVE_COMPLETED bubbles only for the boss kill or an authored quest completion", () => {
  const completion = authoredBeat("cinder-span", "cinder-span:completion");
  const nonBossObjectiveId = authoredStage("cinder-span").quest.objectives[0].id;
  assert.notEqual(nonBossObjectiveId, "boss-kill", "fixture must be a non-boss objective");

  assert.equal(speechBubbleEligible({ type: "OBJECTIVE_COMPLETED", objectiveId: "boss-kill" }), true,
    "the boss kill is the run's authored climax");
  assert.equal(speechBubbleEligible({ type: "OBJECTIVE_COMPLETED", objectiveId: nonBossObjectiveId, storyBeat: completion }), true,
    "an authored questCompletion beat earns a bubble whatever objective carried it");

  const ordinary = { type: "OBJECTIVE_COMPLETED", objectiveId: nonBossObjectiveId, stageId: "cinder-span", dialogue: completion.dialogue };
  assert.equal(speechBubbleEligible(ordinary), false,
    "an ordinary objective tick is not a story beat, even when dialogue is attached");
  assert.equal(speechBubbleFor(ordinary), null,
    "an ineligible objective must produce no bubble at all — attached copy must not leak through");

  assert.equal(speechBubbleEligible({ type: "CRITICAL_HIT" }), false, "combat feedback is not dialogue");
  assert.equal(speechBubbleEligible(undefined), false, "a missing event is not eligible");
  assert.equal(speechBubbleEligible(null), false, "a null event is not eligible");
});

test("LORE_SURPRISE_RESOLVED is ineligible as story yet still bubbles as an ambient narrator line", () => {
  const outcome = CINDER_SPAN_SURPRISE_TABLE.outcomes[0];
  assert.equal(typeof outcome?.text, "string", "the surprise table must still author outcome copy");
  const event = { type: "LORE_SURPRISE_RESOLVED", tick: 0, outcomeId: outcome.id, text: outcome.text };

  assert.equal(speechBubbleEligible(event), false, "lore is not one of the authored story milestones");

  const line = speechBubbleTextFor(event);
  assert.deepEqual(line, { speaker: null, text: outcome.text, story: false },
    "lore resolves through the non-story fallback and is marked as such");

  const bubble = speechBubbleFor(event);
  assert.equal(bubble.text, outcome.text, "the authored lore copy is shown verbatim");
  assert.equal(bubble.story, false, "lore never claims story status");
  assert.equal(bubble.role, "narrator", "lore has no on-screen speaker");
  assert.deepEqual(bubble.anchor, { kind: "none", id: null }, "a narrator line has no body to hang on");
  assert.ok(bubble.priority < SPEECH_BUBBLE_PRIORITY.story,
    "ambient lore must rank below story so a milestone can preempt it");
  assert.equal(bubble.priority, SPEECH_BUBBLE_PRIORITY.ambient);

  assert.equal(speechBubbleTextFor({ type: "LORE_SURPRISE_RESOLVED", tick: 0 }), null,
    "a lore event with no authored text produces nothing");
  assert.equal(speechBubbleFor({ type: "LORE_SURPRISE_RESOLVED", tick: 0, text: "ash drifts off the span." }), null,
    "lore with no Korean copy produces nothing");
});

test("acquisition dialogue is read on stage entry only, and never outranks the beat's own line", () => {
  const story = authoredStage("cinder-span");
  const beat = authoredBeat("cinder-span", "cinder-span:acquisition");
  const firstAcquisitionLine = story.quest.acquisitionDialogue[0];
  assert.notEqual(beat.dialogue.text, firstAcquisitionLine.text,
    "fixture must keep the beat line distinct from the acquisition line for this to mean anything");

  const withBeat = speechBubbleTextFor({
    type: "STAGE_STARTED", stageId: "cinder-span", storyBeat: beat,
    quest: { questId: story.quest.id, acquisitionDialogue: story.quest.acquisitionDialogue },
  });
  assert.equal(withBeat.text, beat.dialogue.text, "the beat's own line is the stage-entry bubble");

  const withoutBeat = speechBubbleTextFor({
    type: "STAGE_STARTED", stageId: "cinder-span",
    quest: { questId: story.quest.id, acquisitionDialogue: story.quest.acquisitionDialogue },
  });
  assert.equal(withoutBeat.text, firstAcquisitionLine.text,
    "with no beat, stage entry falls back to the first authored acquisition line");
  assert.equal(withoutBeat.speaker, firstAcquisitionLine.speaker,
    "the acquisition line's authored speaker rides along");

  assert.equal(speechBubbleTextFor({
    type: "OCCUPATION_CAPTURED", stageId: "cinder-span",
    quest: { questId: story.quest.id, acquisitionDialogue: story.quest.acquisitionDialogue },
  }), null, "a later quest event carrying the same quest payload must not replay the acquisition dialogue");
});

// ---------------------------------------------------------------------------
// Hold duration
// ---------------------------------------------------------------------------

test("speechBubbleHoldMs clamps both ends and scales strictly in between", () => {
  const min = speechBubbleHoldMs("");
  const max = speechBubbleHoldMs("가".repeat(140));

  assert.equal(min, 2200, "an empty line still holds long enough to be read");
  assert.equal(max, 5200, "the longest displayable line is capped so a bubble cannot camp the screen");

  assert.equal(speechBubbleHoldMs("가".repeat(12)), min, "12 characters is still inside the floor");
  assert.ok(speechBubbleHoldMs("가".repeat(13)) > min,
    "13 characters is the first length whose own duration clears the floor");
  assert.equal(speechBubbleHoldMs("가".repeat(13)), 2254, "past the floor the duration is 1500ms + 58ms per character");

  assert.ok(speechBubbleHoldMs("가".repeat(63)) < max, "63 characters is still under the ceiling");
  assert.equal(speechBubbleHoldMs("가".repeat(63)), 5154);
  assert.equal(speechBubbleHoldMs("가".repeat(64)), max, "64 characters is the first length pinned to the ceiling");

  let previous = -1;
  for (let length = 0; length <= 200; length += 1) {
    const hold = speechBubbleHoldMs("가".repeat(length));
    assert.ok(hold >= previous, `hold must never shrink as a line grows (broke at length ${length})`);
    assert.ok(hold >= min && hold <= max, `hold must stay inside the clamp (broke at length ${length})`);
    previous = hold;
  }

  for (const value of [null, undefined, 42, {}]) {
    assert.equal(speechBubbleHoldMs(value), min, "a non-string never produces NaN, which would make a bubble immortal");
  }
});

test("every authored line holds inside the readable window", () => {
  for (const { beat } of everyAuthoredBeat()) {
    const hold = speechBubbleHoldMs(beat.dialogue.text);
    assert.ok(hold >= 2200 && hold <= 5200, `${beat.id} holds ${hold}ms, outside the readable window`);
  }
});

// ---------------------------------------------------------------------------
// SpeechBubbleDirector
// ---------------------------------------------------------------------------

const BOSS_BEAT = authoredBeat("cinder-span", "cinder-span:boss-entry");
const LORE_TEXT = CINDER_SPAN_SURPRISE_TABLE.outcomes[0].text;

function storyEmission(eventId) {
  return storyEvent("cinder-span", BOSS_BEAT, { eventId, entityId: "boss-482" });
}

function loreEmission(eventId) {
  return { type: "LORE_SURPRISE_RESOLVED", tick: 0, eventId, text: LORE_TEXT };
}

function clockedDirector(options = {}) {
  const clock = { t: 0 };
  const director = new SpeechBubbleDirector({ now: () => clock.t, ...options });
  return { clock, director };
}

test("the same emission is admitted once, however many times the snapshot replays it", () => {
  const { director } = clockedDirector();
  const event = storyEmission("event:7");

  const first = director.present(event);
  assert.ok(first, "the first sight of a beat becomes live");
  assert.equal(director.present(event), null, "a replayed snapshot must not restage the same beat");
  assert.equal(director.present({ ...event }), null, "identity is the event, not the object reference");
  assert.equal(director.list().length, 1, "the duplicate must not double the live set");

  const sameIdDifferentText = { ...event, storyBeat: authoredBeat("cinder-span", "cinder-span:completion") };
  assert.equal(director.present(sameIdDifferentText), null, "one emission id is one beat, whatever line is attached");

  assert.ok(director.present(storyEmission("event:8")), "a distinct emission is a distinct beat");
});

test("a story beat preempts a live ambient line, and the displaced line does not come back", () => {
  const { director } = clockedDirector();

  assert.ok(director.present(loreEmission("lore:1")), "ambient lore goes live when nothing outranks it");
  const story = director.present(storyEmission("story:1"));
  assert.ok(story, "a story beat outranks live ambient lore");

  assert.deepEqual(director.list().map((record) => record.key), [story.key],
    "preemption clears the ambient bubble rather than stacking on top of it");
  assert.equal(director.present(loreEmission("lore:1")), null,
    "a preempted line is spent — it must not replay once the slot frees");
});

test("ambient lore arriving under a live story beat is dropped, not queued behind it", () => {
  const { clock, director } = clockedDirector();
  const story = director.present(storyEmission("story:2"));
  assert.ok(story);

  assert.equal(director.present(loreEmission("lore:2")), null, "the lower-priority line is refused outright");
  assert.deepEqual(director.list().map((record) => record.key), [story.key], "the story beat is untouched");

  // Dropped, not deferred: nothing replays it when the story bubble ends.
  clock.t = story.expiresAt;
  assert.equal(director.list().length, 0, "the story beat expires on schedule");
  assert.ok(director.present(loreEmission("lore:2")),
    "a dropped line was never remembered, so a fresh emission of it can still be shown later");
});

test("equal-priority beats queue up to maxActive and the next one is refused until a slot frees", () => {
  for (const maxActive of [1, 2, 3]) {
    const { clock, director } = clockedDirector({ maxActive });
    for (let index = 0; index < maxActive; index += 1) {
      assert.ok(director.present(storyEmission(`cap${maxActive}:${index}`)),
        `bubble ${index} must fit under maxActive=${maxActive}`);
    }
    assert.equal(director.list().length, maxActive, `exactly ${maxActive} bubbles are live`);

    const overflow = storyEmission(`cap${maxActive}:overflow`);
    assert.equal(director.present(overflow), null, `the ${maxActive + 1}th equal-priority bubble is refused`);
    assert.equal(director.list().length, maxActive, "a refusal must not evict a live bubble");

    clock.t = Math.max(...director.list().map((record) => record.expiresAt));
    assert.equal(director.list().length, 0, "the queue drains once every hold elapses");
    assert.ok(director.present(overflow),
      "a bubble refused for want of a slot was not marked as shown, so it still gets its turn");
  }
});

test("a bubble expires exactly when its hold elapses and stops being reported", () => {
  const { clock, director } = clockedDirector();
  const record = director.present(storyEmission("expiry:1"));
  assert.equal(record.expiresAt, record.startedAt + record.holdMs, "expiry is the start plus the resolved hold");

  clock.t = record.expiresAt - 1;
  assert.deepEqual(director.expire(), [], "one tick short of the hold the bubble is still live");
  assert.deepEqual(director.list().map((entry) => entry.key), [record.key]);

  clock.t = record.expiresAt;
  assert.deepEqual(director.expire(), [record.key], "the hold boundary is inclusive — the bubble drops on it");
  assert.deepEqual(director.list(), [], "an expired bubble is no longer reported to the presenter");
  assert.equal(director.debugMetrics().bubbles, 0);
});

test("hold postpones expiry by exactly the paused time and ignores unusable deltas", () => {
  const { clock, director } = clockedDirector();
  const record = director.present(storyEmission("hold:1"));
  const originalExpiry = record.expiresAt;

  clock.t = originalExpiry - 1;
  director.hold(1000);

  clock.t = originalExpiry;
  assert.equal(director.list().length, 1,
    "a bubble that would have expired now is still live — a pause must not burn its read time");

  clock.t = originalExpiry + 999;
  assert.equal(director.list().length, 1, "the extension runs its full length");

  clock.t = originalExpiry + 1000;
  assert.equal(director.list().length, 0, "and expiry lands exactly one hold-length later, not later still");

  // A frame that reports a garbage delta must not make a bubble immortal.
  const guard = clockedDirector();
  const guarded = guard.director.present(storyEmission("hold:2"));
  for (const delta of [Number.NaN, Number.POSITIVE_INFINITY, 0, -5000]) {
    guard.director.hold(delta);
  }
  assert.equal(guarded.expiresAt, guarded.startedAt + guarded.holdMs, "an unusable delta leaves expiry alone");
  guard.clock.t = guarded.expiresAt;
  assert.equal(guard.director.list().length, 0, "so the bubble still expires on its own schedule");
});

test("list reports highest priority first and, within a priority, oldest first", () => {
  const { clock, director } = clockedDirector({ maxActive: 3 });
  const first = director.present(storyEmission("order:1"));
  clock.t += 100;
  const second = director.present(storyEmission("order:2"));
  clock.t += 100;
  const third = director.present(storyEmission("order:3"));

  assert.deepEqual(director.list().map((record) => record.key), [first.key, second.key, third.key],
    "equal-priority bubbles read oldest first, so the reader finishes the line they started");

  // Insertion order reversed relative to age: the sort, not the Map, must decide.
  director.active.clear();
  director.active.set(third.key, { ...third, startedAt: 300 });
  director.active.set(first.key, { ...first, startedAt: 100 });
  assert.deepEqual(director.list().map((record) => record.key), [first.key, third.key],
    "age ordering comes from the sort, not from insertion order");

  // present() never leaves a mixed-priority set live (that is what the drop rule
  // buys), so the priority term is seeded directly to pin the documented order.
  const ambient = speechBubbleFor(loreEmission("order:ambient"));
  director.active.clear();
  director.active.set(ambient.key, { ...ambient, startedAt: 0, expiresAt: clock.t + 10_000 });
  director.active.set(first.key, { ...first, startedAt: 500, expiresAt: clock.t + 10_000 });
  assert.deepEqual(director.list().map((record) => record.key), [first.key, ambient.key],
    "a newer story bubble still outranks an older ambient one");
});

test("present never leaves bubbles of two different priorities live at once", () => {
  const { clock, director } = clockedDirector({ maxActive: 3 });
  const emissions = [
    loreEmission("mix:a"), storyEmission("mix:b"), loreEmission("mix:c"),
    storyEmission("mix:d"), loreEmission("mix:e"), storyEmission("mix:f"),
  ];
  for (const [index, event] of emissions.entries()) {
    director.present(event);
    clock.t += 40 * index;
    const priorities = new Set(director.list().map((record) => record.priority));
    assert.ok(priorities.size <= 1,
      `after ${event.eventId} the live set mixed priorities ${[...priorities].join(",")} — ambient must be dropped, not layered`);
  }
});

test("clear dismisses the live set without letting the dismissed beats replay; reset lets them", () => {
  const { director } = clockedDirector({ maxActive: 2 });
  const first = storyEmission("life:1");
  const second = storyEmission("life:2");
  director.present(first);
  director.present(second);

  assert.deepEqual(director.clear().sort(), [speechBubbleFor(first).key, speechBubbleFor(second).key].sort(),
    "clear reports what it dismissed");
  assert.deepEqual(director.list(), [], "nothing is live after a clear");
  assert.equal(director.present(first), null, "a dismissed beat stays spent for the rest of the run");
  assert.ok(director.debugMetrics().bubbleKeys >= 2, "clear keeps the run's identity memory");

  director.reset();
  assert.equal(director.debugMetrics().bubbleKeys, 0, "a reset drops the identity memory with the live set");
  assert.ok(director.present(first), "after a stage remount the same beat is new again");
});

test("debugMetrics agrees with the live set it is describing", () => {
  const { clock, director } = clockedDirector({ maxActive: 2 });
  assert.deepEqual(director.debugMetrics(), { bubbles: 0, bubbleKeys: 0, bubblePriority: 0 },
    "an idle director reports nothing live");

  const ambient = director.present(loreEmission("metrics:lore"));
  assert.deepEqual(director.debugMetrics(),
    { bubbles: 1, bubbleKeys: 1, bubblePriority: ambient.priority },
    "one ambient line live, one key remembered");

  const story = director.present(storyEmission("metrics:story"));
  const metricsAfterPreempt = director.debugMetrics();
  assert.equal(metricsAfterPreempt.bubbles, director.list().length, "the count matches what list reports");
  assert.equal(metricsAfterPreempt.bubblePriority, story.priority,
    "the reported priority is the priority of what is actually live, not of what was");
  assert.equal(metricsAfterPreempt.bubbleKeys, 2, "the preempted line is still remembered as spent");

  clock.t = story.expiresAt;
  const drained = director.debugMetrics();
  assert.equal(drained.bubbles, 0, "metrics expire stale bubbles like list does");
  assert.equal(drained.bubblePriority, 0, "an empty live set reports no priority");
  assert.equal(drained.bubbleKeys, 2, "identity memory outlives the bubbles");
});

test("the shown-key memory is bounded, evicting oldest first instead of growing with the run", () => {
  const { clock, director } = clockedDirector();
  const total = 33;
  const emissions = [];

  for (let index = 0; index < total; index += 1) {
    const event = storyEmission(`bound:${index}`);
    emissions.push(event);
    clock.t += 9000; // longer than any hold, so each beat gets its own uncontested slot
    assert.ok(director.present(event), `emission ${index} must be admitted`);
  }

  assert.equal(director.debugMetrics().bubbleKeys, 32,
    "identity memory is capped, so a long run cannot leak one key per story beat");

  clock.t += 9000;
  assert.ok(director.present(emissions[0]),
    "the oldest key was the one evicted, so the first beat is presentable again");
  assert.equal(director.present(emissions[total - 1]), null,
    "the most recent keys are still remembered — eviction is oldest-first, not a wholesale flush");
});

test("the queue's record is exactly the resolver's bubble plus its schedule", () => {
  const { clock, director } = clockedDirector();
  clock.t = 12_345;
  const event = storyEmission("record:1");
  const resolved = speechBubbleFor(event);
  const record = director.present(event);

  for (const field of ["key", "eventType", "text", "speaker", "role", "story", "priority", "holdMs"]) {
    assert.deepEqual(record[field], resolved[field], `the live record must carry the resolver's ${field}`);
  }
  assert.deepEqual(record.anchor, resolved.anchor, "the live record must carry the resolved anchor");
  assert.equal(record.startedAt, 12_345, "a bubble starts on the injected clock, not on wall time");
  assert.equal(record.expiresAt, 12_345 + resolved.holdMs, "and ends one resolved hold later");
  assert.deepEqual(director.list()[0], record, "list reports the very record present returned");
});

// ---------------------------------------------------------------------------
// Grounding against real simulation output
// ---------------------------------------------------------------------------

test("a STAGE_STARTED event as the simulation actually emits it resolves an anchored bubble", () => {
  const snapshot = getRunSnapshot(createDefenseRun({ stageId: "cinder-span", seed: 17 }));
  const stageStarted = snapshot.events.find((event) => event.type === "STAGE_STARTED");
  assert.ok(stageStarted, "a run must open with STAGE_STARTED");

  const bubble = speechBubbleFor(stageStarted);
  assert.ok(bubble, "the event shape the simulation emits must produce a bubble");

  const story = authoredStage("cinder-span");
  const beat = authoredBeat("cinder-span", "cinder-span:acquisition");
  assert.equal(bubble.text, beat.dialogue.text, "the opening bubble shows the authored acquisition beat");
  assert.equal(bubble.speaker, beat.dialogue.speaker, "labelled with the authored speaker");
  assert.deepEqual(bubble.anchor, { kind: "stage-npc", id: story.quest.giverNpcId, questId: story.quest.id },
    "and hangs on the quest-giver NPC the simulation named in the event");
  assert.equal(bubble.key, `event:${stageStarted.eventId}`,
    "a real emission is identified by its own event id, so a replayed snapshot dedups");
});

test("a real resolved lore surprise bubbles as ambient narrator copy", () => {
  let lore = null;
  for (let seed = 1; seed <= 40 && !lore; seed += 1) {
    const snapshot = getRunSnapshot(createDefenseRun({ stageId: "cinder-span", seed }));
    lore = snapshot.events.find((event) => event.type === "LORE_SURPRISE_RESOLVED" && typeof event.text === "string");
  }
  assert.ok(lore, "cinder-span must still be able to resolve its authored lore surprise");

  const authoredTexts = CINDER_SPAN_SURPRISE_TABLE.outcomes.map((outcome) => outcome.text);
  assert.ok(authoredTexts.includes(lore.text), "the emitted lore must come from the authored surprise table");

  const bubble = speechBubbleFor(lore);
  assert.ok(bubble, "resolved lore must reach the player as a bubble even though it is not a story beat");
  assert.equal(bubble.text, lore.text);
  assert.equal(bubble.story, false);
  assert.equal(bubble.priority, SPEECH_BUBBLE_PRIORITY.ambient);
  assert.equal(bubble.role, "narrator");
  assert.equal(bubble.key, `event:${lore.eventId}`);
});
