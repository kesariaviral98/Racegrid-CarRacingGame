import {
  getRoomState,
  getPlayersInRoom,
  setRoomStatus,
  setRoomMatchId,
  incrementRaceTime,
  getRoomCoins,
  getRoomObstacles,
  getRoomBot,
  createRoomBot,
  setRoomBot,
} from '../models/GameState';
import { createMatch, finishMatch } from '../models/services/race.service';
import type { ServerMessage, RaceResult, PlayerState, CoinState, ObstacleState } from '../models/types/game.types';
import type { ConnectedPlayer } from '../models/types/player.types';
import type { CoinInternal, ObstacleInternal, BotState } from '../models/GameState';

const TICK_RATE_HZ = 20;
const TICK_INTERVAL_MS = 1000 / TICK_RATE_HZ;
const MAX_RACE_MS = 180_000; // 3-minute hard cap in case human never finishes
const MAX_SPEED = 80;
const ACCELERATION = 30;
const DECELERATION = 55;
const FRICTION = 18;
const STEER_SPEED = 16;
const ROAD_HALF_WIDTH = 8;
const TOTAL_LAPS = 3;
const TRACK_LENGTH = 1500;

// Obstacle collision — car 1.78 wide, rock cluster ~1.2 wide → 1.5 combined half-width
const OBSTACLE_HIT_X = 1.5;
const OBSTACLE_STUN_MS = 1500;

// Car-car collision — car 1.78 wide, 3.6 long → 2.5 is right for bumper contact
const COLLISION_DIST = 2.5;
const COLLISION_STUN_MS = 1200;

// Bot tuning
const BOT_USER_ID = 'bot-1';
const BOT_USERNAME = 'Bot Racer';
const BOT_TARGET_SPEED = MAX_SPEED * 0.74;

// Coin collection
const COIN_RADIUS_X = 0.9; // coin radius 0.62 + small tolerance
// Z uses swept detection: no forward padding (was causing early collection)

const SCORE_BY_POSITION: Record<number, number> = { 1: 10, 2: 7, 3: 5, 4: 3 };

const activeRooms = new Set<string>();

const broadcastToRoom = (roomId: string, message: ServerMessage): void => {
  const players = getPlayersInRoom(roomId);
  players.forEach((p) => {
    if (p.ws.readyState === p.ws.OPEN) p.ws.send(JSON.stringify(message));
  });
};

/**
 * Starts the 3-second countdown for a room then hands off to the main game loop.
 * Spawns a bot opponent when only one human player is present.
 * Safe to call multiple times — no-ops if the room loop is already running.
 */
export const startGameLoop = (roomId: string): void => {
  if (activeRooms.has(roomId)) return;
  const room = getRoomState(roomId);
  if (room === undefined) return;

  const players = getPlayersInRoom(roomId);
  if (players.size === 1) createRoomBot(roomId);

  activeRooms.add(roomId);
  setRoomStatus(roomId, 'countdown');

  void createMatch(room.tenantId, roomId)
    .then((matchId) => setRoomMatchId(roomId, matchId))
    .catch((err: unknown) => console.error('Failed to create match:', err));

  let countdown = 3;
  broadcastToRoom(roomId, { type: 'RACE_STARTED', countdown });

  const countdownInterval = setInterval((): void => {
    countdown -= 1;
    if (countdown <= 0) {
      clearInterval(countdownInterval);
      broadcastToRoom(roomId, { type: 'RACE_STARTED', countdown: 0 });
      setRoomStatus(roomId, 'racing');
      runGameLoop(roomId);
    } else {
      broadcastToRoom(roomId, { type: 'RACE_STARTED', countdown });
    }
  }, 1000);
};

/**
 * Core authoritative game loop running at TICK_RATE_HZ (20 Hz).
 * Each tick: advances physics for all players and the bot, checks collisions,
 * updates positions, then broadcasts GAME_STATE to every connected client.
 * Stops automatically when the room status leaves 'racing'.
 */
const runGameLoop = (roomId: string): void => {
  const interval = setInterval((): void => {
    const room = getRoomState(roomId);
    if (room === undefined || room.status !== 'racing') {
      clearInterval(interval);
      activeRooms.delete(roomId);
      return;
    }

    incrementRaceTime(roomId, TICK_INTERVAL_MS);
    const dt = TICK_INTERVAL_MS / 1000;

    const players = getPlayersInRoom(roomId);
    const coins = getRoomCoins(roomId);
    const obstacles = getRoomObstacles(roomId);

    // Update humans
    players.forEach((player) => {
      if (!player.state.connected) return;
      const prevZ = player.state.z; // snapshot before physics advances z
      updatePlayerPhysics(player, dt);
      checkLapCompletion(player, room.raceTimeMs);
      checkCoinCollection(player, coins, prevZ);
      checkObstacleCollision(player, obstacles, prevZ);
    });

    // Update bot
    const bot = getRoomBot(roomId);
    if (bot !== null) {
      const botPrevZ = bot.z;
      updateBot(bot, dt, room.raceTimeMs, coins, obstacles, botPrevZ);
      setRoomBot(roomId, bot);
    }

    applyCarCollisions(players, bot);
    updatePositions(players, bot);

    // Build full player list
    const allStates: PlayerState[] = Array.from(players.values()).map((p) => p.state);
    if (bot !== null) allStates.push(botToState(bot, allStates.length + 1));

    const uncollectedCoins: CoinState[] = coins
      .filter((c) => !c.collected)
      .map((c) => ({ id: c.id, x: c.x, z: c.z }));

    const obstacleList: ObstacleState[] = obstacles.map((o) => ({
      id: o.id, x: o.x, z: o.z, type: o.type,
    }));

    // Race ends when a HUMAN player crosses the finish arch, or time limit reached.
    // Bot completing laps does NOT end the race — player must cross the finish.
    const anyFinished =
      Array.from(players.values()).some((p) => p.state.connected && p.state.lap >= TOTAL_LAPS) ||
      room.raceTimeMs >= MAX_RACE_MS;

    if (anyFinished) {
      clearInterval(interval);
      // Broadcast final state with 'finished' status before RACE_FINISHED so
      // the client fallback path can trigger celebration even if RACE_FINISHED is missed.
      broadcastToRoom(roomId, {
        type: 'GAME_STATE',
        state: {
          roomId, tenantId: room.tenantId, matchId: room.matchId,
          players: allStates, raceTimeMs: room.raceTimeMs,
          status: 'finished', coins: [], obstacles: [],
        },
      });
      finishRace(roomId, players, bot);
      return;
    }

    broadcastToRoom(roomId, {
      type: 'GAME_STATE',
      state: {
        roomId,
        tenantId: room.tenantId,
        matchId: room.matchId,
        players: allStates,
        raceTimeMs: room.raceTimeMs,
        status: room.status,
        coins: uncollectedCoins,
        obstacles: obstacleList,
      },
    });
  }, TICK_INTERVAL_MS);
};

/**
 * Advances a single player's physics state by dt seconds.
 * During stun the car decelerates gently so it rolls clear of the collision zone.
 * Input is ignored while stunTimeMs > 0.
 */
const updatePlayerPhysics = (player: ConnectedPlayer, dt: number): void => {
  const s = player.state;

  // Stun: count down, gentle deceleration, ignore input
  // Gentle decel keeps the car rolling forward so it clears the obstacle/collision zone
  if (s.stunTimeMs > 0) {
    s.stunTimeMs = Math.max(0, s.stunTimeMs - dt * 1000);
    s.speed = Math.max(0, s.speed - DECELERATION * 1.2 * dt);
    s.angle *= Math.max(0, 1 - 4 * dt);
    s.z += s.speed * dt;
    return;
  }

  const inp = player.lastInput;
  if (inp.up) {
    s.speed = Math.min(MAX_SPEED, s.speed + ACCELERATION * dt);
  } else if (inp.down) {
    s.speed = Math.max(0, s.speed - DECELERATION * dt);
  } else {
    s.speed = Math.max(0, s.speed - FRICTION * dt);
  }

  const sf = Math.max(0.2, s.speed / MAX_SPEED);
  const steerDelta = STEER_SPEED * sf * dt;
  if (inp.left) {
    s.x = Math.min(ROAD_HALF_WIDTH, s.x + steerDelta);
    s.angle = Math.min(s.angle + 180 * dt, 30);
  } else if (inp.right) {
    s.x = Math.max(-ROAD_HALF_WIDTH, s.x - steerDelta);
    s.angle = Math.max(s.angle - 180 * dt, -30);
  } else {
    s.angle *= Math.pow(0.05, dt);
  }
  s.z += s.speed * dt;
};

/** Records a lap crossing and stamps finishTimeMs on the final lap. */
const checkLapCompletion = (player: ConnectedPlayer, raceTimeMs: number): void => {
  const s = player.state;
  const nextZ = (s.lap + 1) * TRACK_LENGTH;
  if (s.z >= nextZ && s.lap < TOTAL_LAPS) {
    s.lap += 1;
    if (s.lap >= TOTAL_LAPS) s.finishTimeMs = raceTimeMs;
  }
};

// Swept z-detection: checks the entire range the car travelled this tick.
// Prevents fast-moving cars from skipping over narrow coin hitboxes between server ticks.
const checkCoinCollection = (player: ConnectedPlayer, coins: CoinInternal[], prevZ: number): void => {
  const s = player.state;
  const zMin = Math.min(prevZ, s.z);
  const zMax = Math.max(prevZ, s.z);
  for (const coin of coins) {
    if (!coin.collected &&
        Math.abs(s.x - coin.x) < COIN_RADIUS_X &&
        coin.z >= zMin &&
        coin.z <= zMax) {
      coin.collected = true;
      s.coinsCollected += 1;
    }
  }
};

// Swept obstacle detection: checks the range the car swept this tick, extended forward
// by one tick's worth of movement to compensate for client prediction drift (~4 units at max speed).
// No backward extension — that was causing false hits on obstacles already behind the car.
const checkObstacleCollision = (player: ConnectedPlayer, obstacles: ObstacleInternal[], prevZ: number): void => {
  const s = player.state;
  if (s.stunTimeMs > 0) return;
  const tickForward = s.speed * TICK_INTERVAL_MS / 1000;
  const zMin = prevZ - 0.3;       // minimal backward for rock physical depth
  const zMax = s.z + tickForward; // one tick forward to meet client's predicted position
  for (const obs of obstacles) {
    if (Math.abs(s.x - obs.x) < OBSTACLE_HIT_X && obs.z >= zMin && obs.z <= zMax) {
      s.speed = Math.max(s.speed, 12);
      s.stunTimeMs = OBSTACLE_STUN_MS;
      break;
    }
  }
};

/**
 * Detects and resolves car-to-car collisions between all human players and the bot.
 * The car that is *ahead* (higher z) gets stunned when rammed from behind;
 * the ramming car loses speed proportionally.
 */
const applyCarCollisions = (players: Map<string, ConnectedPlayer>, bot: BotState | null): void => {
  const humans = Array.from(players.values()).filter((p) => p.state.connected);

  // Human vs human — only the car that got rammed (ahead) gets stunned
  for (let i = 0; i < humans.length; i++) {
    for (let j = i + 1; j < humans.length; j++) {
      const a = humans[i].state;
      const b = humans[j].state;
      const dx = a.x - b.x;
      const dz = a.z - b.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < COLLISION_DIST && dist > 0) {
        const nx = dx / dist;
        const push = (COLLISION_DIST - dist) * 0.5;
        if (a.z >= b.z) {
          // a is ahead — b rammed a; stun a, b slows
          a.stunTimeMs = Math.max(a.stunTimeMs, COLLISION_STUN_MS);
          a.speed = Math.max(a.speed, 10); // keep forward so a clears collision zone
          b.speed *= 0.72;
        } else {
          // b is ahead — a rammed b; stun b, a slows
          b.stunTimeMs = Math.max(b.stunTimeMs, COLLISION_STUN_MS);
          b.speed = Math.max(b.speed, 10); // keep forward so b clears collision zone
          a.speed *= 0.72;
        }
        a.x = Math.max(-ROAD_HALF_WIDTH, Math.min(ROAD_HALF_WIDTH, a.x + nx * push));
        b.x = Math.max(-ROAD_HALF_WIDTH, Math.min(ROAD_HALF_WIDTH, b.x - nx * push));
      }
    }
  }

  // Human vs bot — only the car that got rammed (ahead) gets stunned
  if (bot !== null) {
    for (const human of humans) {
      const h = human.state;
      const dx = h.x - bot.x;
      const dz = h.z - bot.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < COLLISION_DIST && dist > 0) {
        const nx = dx / dist;
        const push = (COLLISION_DIST - dist) * 0.5;
        if (h.z >= bot.z) {
          // human is ahead — bot rammed human; stun human
          h.stunTimeMs = Math.max(h.stunTimeMs, COLLISION_STUN_MS);
          h.speed = Math.max(h.speed, 10);
          bot.speed *= 0.72;
        } else {
          // bot is ahead — human rammed bot; stun bot
          bot.stunTimeMs = Math.max(bot.stunTimeMs ?? 0, COLLISION_STUN_MS);
          bot.speed = Math.max(bot.speed, 10);
          h.speed *= 0.72;
        }
        h.x = Math.max(-ROAD_HALF_WIDTH, Math.min(ROAD_HALF_WIDTH, h.x + nx * push));
        bot.x = Math.max(-ROAD_HALF_WIDTH, Math.min(ROAD_HALF_WIDTH, bot.x - nx * push));
      }
    }
  }
};

const updateBot = (
  bot: BotState,
  dt: number,
  raceTimeMs: number,
  coins: CoinInternal[],
  obstacles: ObstacleInternal[],
  prevZ: number,
): void => {
  // Stun countdown
  if ((bot.stunTimeMs ?? 0) > 0) {
    bot.stunTimeMs = Math.max(0, (bot.stunTimeMs ?? 0) - dt * 1000);
    bot.speed = Math.max(0, bot.speed - DECELERATION * 2 * dt);
    bot.z += bot.speed * dt;
    return;
  }

  // Obstacle avoidance: steer away if obstacle ahead
  let avoidX = 0;
  for (const obs of obstacles) {
    const dz = obs.z - bot.z;
    if (dz > 0 && dz < 18 && Math.abs(bot.x - obs.x) < 3.5) {
      avoidX += bot.x < obs.x ? -2 : 2;
    }
  }

  bot.speed = Math.min(BOT_TARGET_SPEED, bot.speed + ACCELERATION * dt);

  // Sine-wave natural movement + avoidance
  bot.phase += dt * 0.6;
  const naturalX = Math.sin(bot.phase) * 3.2 + Math.cos(bot.phase * 0.38) * 1.4;
  const targetX = Math.max(-(ROAD_HALF_WIDTH - 1.2), Math.min(ROAD_HALF_WIDTH - 1.2, naturalX + avoidX));
  const diff = targetX - bot.x;
  const steerDelta = STEER_SPEED * (bot.speed / MAX_SPEED) * dt;
  const step = Math.sign(diff) * Math.min(Math.abs(diff), steerDelta);
  bot.x += step;
  bot.angle = steerDelta > 0 ? (step / steerDelta) * 22 : 0;
  bot.z += bot.speed * dt;

  // Lap
  const nextZ = (bot.lap + 1) * TRACK_LENGTH;
  if (bot.z >= nextZ && bot.lap < TOTAL_LAPS) {
    bot.lap += 1;
    if (bot.lap >= TOTAL_LAPS && bot.finishTimeMs === null) bot.finishTimeMs = raceTimeMs;
  }

  // Coins — swept detection
  const zMin = Math.min(prevZ, bot.z);
  const zMax = Math.max(prevZ, bot.z);
  for (const coin of coins) {
    if (!coin.collected &&
        Math.abs(bot.x - coin.x) < COIN_RADIUS_X &&
        coin.z >= zMin &&
        coin.z <= zMax) {
      coin.collected = true;
      bot.coinsCollected += 1;
    }
  }
};

const botToState = (bot: BotState, pos: number): PlayerState => ({
  userId: BOT_USER_ID, username: BOT_USERNAME,
  x: bot.x, z: bot.z, angle: bot.angle, speed: bot.speed,
  lap: bot.lap, position: pos, team: 'B', connected: true,
  finishTimeMs: bot.finishTimeMs, coinsCollected: bot.coinsCollected,
  stunTimeMs: bot.stunTimeMs ?? 0,
});

const updatePositions = (players: Map<string, ConnectedPlayer>, bot: BotState | null): void => {
  type E = { lap: number; z: number; setPos: (n: number) => void };
  const entries: E[] = Array.from(players.values()).map((p) => ({
    lap: p.state.lap, z: p.state.z, setPos: (n) => { p.state.position = n; },
  }));
  if (bot !== null) entries.push({ lap: bot.lap, z: bot.z, setPos: () => {} });
  entries.sort((a, b) => b.lap !== a.lap ? b.lap - a.lap : b.z - a.z);
  entries.forEach((e, i) => e.setPos(i + 1));
};

/**
 * Finalises the race: sets room status, ranks all participants, broadcasts
 * RACE_FINISHED with results, and persists the match to Supabase.
 * Bot results are included in the broadcast but excluded from the DB write.
 */
const finishRace = (roomId: string, players: Map<string, ConnectedPlayer>, bot: BotState | null): void => {
  setRoomStatus(roomId, 'finished');
  activeRooms.delete(roomId);

  type E = { userId: string; username: string; team: 'A' | 'B'; finishTimeMs: number | null; coinsCollected: number; isBot: boolean };
  const entries: E[] = Array.from(players.values()).map((p) => ({
    userId: p.userId, username: p.username, team: p.team,
    finishTimeMs: p.state.finishTimeMs, coinsCollected: p.state.coinsCollected, isBot: false,
  }));
  if (bot !== null) {
    entries.push({ userId: BOT_USER_ID, username: BOT_USERNAME, team: 'B', finishTimeMs: bot.finishTimeMs, coinsCollected: bot.coinsCollected, isBot: true });
  }
  entries.sort((a, b) => (a.finishTimeMs ?? Infinity) - (b.finishTimeMs ?? Infinity));

  const results: RaceResult[] = entries.map((e, i) => ({
    userId: e.userId, username: e.username, team: e.team,
    finishPosition: i + 1, finishTimeMs: e.finishTimeMs ?? 0,
    score: SCORE_BY_POSITION[i + 1] ?? 0, coinsCollected: e.coinsCollected,
  }));

  broadcastToRoom(roomId, { type: 'RACE_FINISHED', results });

  const roomState = getRoomState(roomId);
  if (roomState !== undefined && roomState.matchId !== null) {
    // Re-number positions after removing bot so humans get correct rank
    const humanResults = results
      .filter((r) => r.userId !== BOT_USER_ID)
      .map((r, i) => ({ ...r, finishPosition: i + 1 }));
    void finishMatch(roomState.matchId, roomState.tenantId, roomId, humanResults)
      .catch((err: unknown) => console.error('Failed to save results:', err));
  }
};

export const getActiveRooms = (): Set<string> => activeRooms;
export { updatePlayerPhysics };
export type { PlayerState };
