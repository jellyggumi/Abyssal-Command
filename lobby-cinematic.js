/**
 * Pure choreography math for the pre-run lobby: camera showcase cycle, the
 * commander/boss face-off staging, and the authored dialogue relay that plays
 * over it. No DOM access, no `three` import, no catalog import — see
 * `_workspace/current/ui/lobby-cinematic-spec.md` §1. Kept pure so
 * `node --test` can exercise every frame formula directly, with the DOM/three
 * wiring (`app.js`) staying a thin caller of these functions.
 */

/** One showcase lap: wide route read → squad mid-shot → commander close-up → wide reset. */
export const SHOWCASE_CYCLE_MS = 24000;

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
  focusRole: "commander",
  progress: 0,
  yaw: SHOWCASE_BASE_YAW,
  pitch: SHOWCASE_BASE_PITCH,
  distanceScale: 1,
});

/** Framing name from the current zoom: gates when the boss plate/vignette fade in (see spec §2). */
const framingFor = (distanceScale) => {
  if (distanceScale <= 0.96) return "closeup";
  if (distanceScale < 1.05) return "mid";
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
  // A bounded hero orbit, not a turntable: the camera keeps the commander as
  // its authoritative target while boss and companions remain supporting silhouettes.
  const yaw = SHOWCASE_BASE_YAW
    + 0.48 * Math.sin(TAU * progress)
    + 0.08 * Math.sin(TAU * progress * 2);
  // Lift on the route reveal, settle for the close commander read.
  const pitch = SHOWCASE_BASE_PITCH + 0.14 * Math.cos(TAU * progress);
  // Wide at the seam, close at half-lap, exactly reset at wrap.
  const distanceScale = 0.9 + 0.2 * (0.5 + 0.5 * Math.cos(TAU * progress));

  return Object.freeze({
    phaseId: phaseIdFor(progress),
    framing: framingFor(distanceScale),
    focusRole: "commander",
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
 * Presentation-only hero staging in arena coordinates. The commander owns the
 * center line; the boss reads behind the hero and companions form a shallow
 * crescent. A stable stage hash shifts the shared lane without changing sides
 * or introducing simulation state.
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

  const commander = Object.freeze({ x: Math.round(width * 0.5), y: laneY });
  const boss = Object.freeze({ x: Math.round(width * 0.7), y: laneY });
  const companions = Object.freeze([
    Object.freeze({ x: Math.round(width * 0.43), y: Math.round(laneY - height * 0.09) }),
    Object.freeze({ x: Math.round(width * 0.4), y: Math.round(laneY + height * 0.08) }),
    Object.freeze({ x: Math.round(width * 0.48), y: Math.round(laneY + height * 0.13) }),
  ]);
  const facing = Math.atan2(boss.y - commander.y, boss.x - commander.x);

  return Object.freeze({ commander, boss, companions, facing });
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
