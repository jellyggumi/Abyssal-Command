/**
 * Pure choreography math for the pre-run lobby: camera showcase cycle, the
 * commander/boss face-off staging, and the authored dialogue relay that plays
 * over it. No DOM access, no `three` import, no catalog import — see
 * `_workspace/current/ui/lobby-cinematic-spec.md` §1. Kept pure so
 * `node --test` can exercise every frame formula directly, with the DOM/three
 * wiring (`app.js`) staying a thin caller of these functions.
 */

/** One showcase lap: long enough to read all three framings without feeling like a turntable loop. */
export const SHOWCASE_CYCLE_MS = 21000;

/** One dialogue line's hold time before the relay advances — long enough to read a short Korean line. */
export const DIALOGUE_LINE_MS = 6000;

/** Resting yaw: an off-axis angle so the boss silhouette reads instead of a flat side profile. */
export const SHOWCASE_BASE_YAW = 0.62;

/** Resting pitch, tuned to match SHOWCASE_BASE_YAW so the static and animated shots agree at rest. */
export const SHOWCASE_BASE_PITCH = 0.62;

const TAU = Math.PI * 2;

/** Coerces elapsed-time input to a finite, non-negative number — a render-loop timer must never leak NaN downstream. */
const sanitizeElapsedMs = (elapsedMs) => (Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Reduced-motion resting shot. Deliberately the *mid* framing rather than
 * "the animation paused", so `prefers-reduced-motion` still reads as an
 * art-directed still instead of a stalled turntable.
 */
const STATIC_SHOT = Object.freeze({
  phaseId: "static",
  framing: "mid",
  progress: 0,
  yaw: SHOWCASE_BASE_YAW,
  pitch: SHOWCASE_BASE_PITCH,
  distanceScale: 0.78,
});

/** Framing name from the current zoom: gates when the boss plate/vignette fade in (see spec §2). */
const framingFor = (distanceScale) => {
  if (distanceScale <= 0.68) return "closeup";
  if (distanceScale < 0.88) return "mid";
  return "wide";
};

/** Coarse phase label for HUD copy/telemetry — thirds of the lap, not tied to any one formula constant. */
const phaseIdFor = (progress) => {
  if (progress < 1 / 3) return "approach";
  if (progress < 2 / 3) return "orbit";
  return "reveal";
};

/**
 * Camera pose for the lobby showcase orbit. Seamless by construction:
 * `progress` is a pure function of `elapsedMs % SHOWCASE_CYCLE_MS`, so frame 0
 * of lap N is bit-identical to frame 0 of lap N+1 — no drift to paper over.
 */
export function showcaseCamera(elapsedMs, { reducedMotion = false } = {}) {
  if (reducedMotion) return STATIC_SHOT;

  const progress = (sanitizeElapsedMs(elapsedMs) % SHOWCASE_CYCLE_MS) / SHOWCASE_CYCLE_MS;
  // A ±31° sweep, not a full spin — a full spin loses the boss silhouette and reads as a turntable.
  const yaw = SHOWCASE_BASE_YAW + 0.55 * Math.sin(TAU * progress);
  // The camera rises slightly as it pulls back, so the reveal beat reads as a lift, not a flat pan.
  const pitch = SHOWCASE_BASE_PITCH + 0.16 * Math.cos(TAU * progress);
  // Wide (1.0) at the seam, closeup (0.5) at the half-lap, back to wide at the wrap — a single breathing cycle.
  const distanceScale = 1 - 0.5 * (0.5 - 0.5 * Math.cos(TAU * progress));

  return Object.freeze({
    phaseId: phaseIdFor(progress),
    framing: framingFor(distanceScale),
    progress,
    yaw,
    pitch,
    distanceScale,
  });
}

/** FNV-1a 32-bit hash: deterministic and dependency-free, plenty for picking a lane — not a security primitive. */
const hash32 = (value) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

/**
 * Presentation-only face-off staging in arena coordinates. The commander
 * always stands foreground-left of the boss (0.42/0.62 of width) so the
 * silhouettes never trade sides between stages; a stable hash of `stageId`
 * moves the shared lane up or down so repeat visits to the lobby don't all
 * frame identically, while keeping both actors level (so `facing` stays a
 * clean horizontal yaw instead of an off-axis stare).
 */
export function stagingFor(stageId, arena) {
  if (typeof stageId !== "string" || stageId.length === 0) {
    throw new TypeError("stagingFor: stageId must be a non-empty string");
  }
  const width = arena?.width;
  const height = arena?.height;
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new TypeError("stagingFor: arena must have finite positive width and height");
  }

  // Hash -> [-1, 1] so different stages read from a different lane while staying fully deterministic.
  const normalizedHash = (hash32(stageId) / 0xffffffff) * 2 - 1;
  const laneY = clamp(height * 0.5 + normalizedHash * 0.08 * height, height * 0.12, height * 0.88);

  const commander = Object.freeze({ x: Math.round(width * 0.42), y: laneY });
  const boss = Object.freeze({ x: Math.round(width * 0.62), y: laneY });
  const facing = Math.atan2(boss.y - commander.y, boss.x - commander.x);

  return Object.freeze({ commander, boss, facing });
}

/** Neutral Korean fallbacks so a missing/blank stage fact never surfaces the literal string "undefined". */
const FALLBACK_BOSS_NAME = "정체를 알 수 없는 위협";
const FALLBACK_OBJECTIVE = "봉쇄선을 사수하라";
const FALLBACK_STAGE_NAME = "이름 없는 전선";

const authoredText = (value, fallback) => (typeof value === "string" && value.trim() ? value.trim() : fallback);

/**
 * Authored two-way relay for the lobby face-off, in the 그림자군단 / Dusk
 * Warden voice already established by `defense-catalog.js#CUTSCENES` (관문,
 * 봉쇄선, 심연, 잔향). Kept to 4 short lines so the full relay comfortably
 * fits inside one pass of the showcase orbit at DIALOGUE_LINE_MS per line.
 */
export function dialogueScriptFor(stageFacts) {
  const facts = stageFacts ?? {};
  const idPrefix = typeof facts.stageId === "string" && facts.stageId ? facts.stageId : "lobby-stage";
  const bossName = authoredText(facts.bossName, FALLBACK_BOSS_NAME);
  const objective = authoredText(facts.objective, FALLBACK_OBJECTIVE);
  const stageName = authoredText(facts.stageName, FALLBACK_STAGE_NAME);

  return Object.freeze([
    Object.freeze({
      id: `${idPrefix}-relay-0`,
      speaker: "commander",
      text: `${bossName}, ${stageName}의 봉쇄선은 그림자군단이 지킨다.`,
    }),
    Object.freeze({
      id: `${idPrefix}-relay-1`,
      speaker: "boss",
      text: "봉쇄선 하나로 심연을 막을 수 있다 믿는가.",
    }),
    Object.freeze({
      id: `${idPrefix}-relay-2`,
      speaker: "commander",
      text: `믿음이 아니라 명령이다. ${objective}, 이 관문은 물러서지 않는다.`,
    }),
    Object.freeze({
      id: `${idPrefix}-relay-3`,
      speaker: "boss",
      text: "그렇다면 네 잔향마저 이 어둠에 묻히리라.",
    }),
  ]);
}

/**
 * Resolves which authored line is on screen at `elapsedMs`. Index-based (not
 * time-range objects) so the caller can cheaply diff against the previously
 * rendered index and only touch the DOM when the relay actually advances.
 */
export function dialogueLineAt(elapsedMs, script) {
  if (!Array.isArray(script) || script.length === 0) return null;
  const safeElapsed = sanitizeElapsedMs(elapsedMs);
  const index = Math.floor(Math.max(0, safeElapsed) / DIALOGUE_LINE_MS) % script.length;
  return Object.freeze({ index, line: script[index] });
}
