import test from "node:test";
import assert from "node:assert/strict";
import { cutsceneEventKey, cutsceneFromEvent, cutsceneLines } from "../defense-cutscene.js";

test("cutscene adapter normalizes authored stage copy without mutating the event", () => {
  const event = Object.freeze({ type: "STAGE_STARTED", tick: 0, stageId: "cinder-span", cutscene: ["  첫 줄  ", "둘째 줄", ""] });
  const cutscene = cutsceneFromEvent(event);

  assert.deepEqual(cutscene, {
    eventType: "STAGE_STARTED",
    title: "봉쇄선 진입",
    lines: ["첫 줄", "둘째 줄"],
  });
  assert.equal(cutsceneEventKey(event), "STAGE_STARTED:0:cinder-span");
  assert.deepEqual(event.cutscene, ["  첫 줄  ", "둘째 줄", ""]);
});

test("cutscene adapter accepts terminal and elite copy but rejects empty presentation events", () => {
  assert.deepEqual(cutsceneLines("승리 기록"), ["승리 기록"]);
  assert.equal(cutsceneFromEvent({ type: "ITEM_COLLECTED", tick: 10 }), null);
  assert.equal(cutsceneEventKey({ type: "ITEM_COLLECTED", tick: 10 }), null);
  assert.deepEqual(cutsceneFromEvent({ type: "TERMINAL", tick: 72, outcome: "VICTORY", cutscene: "관문이 유지됐다." }), {
    eventType: "TERMINAL",
    title: "전투 기록",
    lines: ["관문이 유지됐다."],
  });
  assert.equal(cutsceneEventKey({ type: "TERMINAL", tick: 72, outcome: "VICTORY", cutscene: "관문이 유지됐다." }), "TERMINAL:72:VICTORY");
});

test("lore surprise projects its authored snapshot text locally without a provider", (t) => {
  let providerCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    providerCalls += 1;
    throw new Error("presentation must not call a provider");
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  const event = Object.freeze({
    type: "LORE_SURPRISE_RESOLVED",
    tick: 0,
    tableId: "cinder-span-surprise",
    outcomeId: "ash-echo-whisper",
    text: "옛 교량의 재가 바람에 흩어진다.",
  });

  assert.deepEqual(cutsceneFromEvent(event), {
    eventType: "LORE_SURPRISE_RESOLVED",
    title: "심연 기록",
    lines: ["옛 교량의 재가 바람에 흩어진다."],
  });
  assert.equal(cutsceneEventKey(event), "LORE_SURPRISE_RESOLVED:0:ash-echo-whisper");
  assert.equal(providerCalls, 0);
  assert.equal(event.text, "옛 교량의 재가 바람에 흩어진다.", "presentation must not mutate the snapshot event");
});
