// Shared game constants — keep in sync with server/src/controllers/gameLoop.controller.ts

// ── Track ────────────────────────────────────────────────────────────────────
export const ROAD_WIDTH = 20;
export const ROAD_HALF_WIDTH = 8;
/** Length of one lap in world units. */
export const TRACK_LENGTH = 1500;
export const TOTAL_LAPS = 3;
/** Total race distance across all laps. */
export const FINISH_LINE_Z = TRACK_LENGTH * TOTAL_LAPS; // 4500

// ── Physics ──────────────────────────────────────────────────────────────────
/** World units per second at full throttle. Multiply by 2.7 for km/h (≈ 216 km/h). */
export const MAX_SPEED = 80;
export const ACCELERATION = 30;
export const DECELERATION = 55;
export const FRICTION = 18;
export const STEER_SPEED = 16;

// ── Network ──────────────────────────────────────────────────────────────────
/** Server broadcast frequency. Client predicts at 60 fps and reconciles each tick. */
export const TICK_RATE_HZ = 20;
export const TICK_INTERVAL_MS = 1000 / TICK_RATE_HZ; // 50 ms

// ── Scoring ──────────────────────────────────────────────────────────────────
export const SCORE_BY_POSITION: Record<number, number> = {
  1: 10,
  2: 7,
  3: 5,
  4: 3,
};
