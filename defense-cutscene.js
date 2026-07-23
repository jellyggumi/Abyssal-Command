/**
 * Renderer-neutral presentation adapter for authored defense cutscenes.
 * It observes simulation events only; it never changes run or campaign state.
 */
const EVENT_TITLES = Object.freeze({
  STAGE_STARTED: "봉쇄선 진입",
  ELITE_CANDIDATE_AVAILABLE: "정예 잔향",
  TERMINAL: "전투 기록",
  LORE_SURPRISE_RESOLVED: "심연 기록",
});

export function cutsceneLines(cutscene) {
  const values = Array.isArray(cutscene) ? cutscene : [cutscene];
  return values
    .filter((line) => typeof line === "string")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function cutsceneFromEvent(event) {
  const authoredLines = cutsceneLines(event?.cutscene);
  const loreLines = event?.type === "LORE_SURPRISE_RESOLVED" ? cutsceneLines(event.text) : [];
  const lines = authoredLines.length ? authoredLines : loreLines;
  if (!lines.length) return null;
  return Object.freeze({
    eventType: event.type,
    title: EVENT_TITLES[event.type] ?? "심연 기록",
    lines: Object.freeze(lines),
  });
}

export function cutsceneEventKey(event) {
  if (!event?.type || !cutsceneFromEvent(event)) return null;
  return [
    event.type,
    event.tick ?? 0,
    event.stageId ?? event.eliteId ?? event.enemyId ?? event.outcomeId ?? event.tableId ?? event.outcome ?? event.text ?? "",
  ].join(":");
}
