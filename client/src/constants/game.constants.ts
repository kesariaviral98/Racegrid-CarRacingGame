// Road Rash-style 3D racing constants
export const ROAD_WIDTH = 20;
export const ROAD_HALF_WIDTH = 8;
export const TRACK_LENGTH = 1500; // units per lap
export const TOTAL_LAPS = 3;
export const MAX_SPEED = 80; // units/sec (× 2.7 ≈ km/h, max ~216)
export const ACCELERATION = 30;
export const DECELERATION = 55;
export const FRICTION = 18;
export const STEER_SPEED = 16;
export const TICK_RATE_HZ = 20;

export const SCORE_BY_POSITION: Record<number, number> = {
  1: 10,
  2: 7,
  3: 5,
  4: 3,
};
