import type { GameState, RaceStatus } from './types/game.types';
import type { ConnectedPlayer } from './types/player.types';

export type CoinInternal = { id: number; x: number; z: number; collected: boolean };
export type ObstacleInternal = { id: number; x: number; z: number; type: 'rock' | 'barrel' | 'cone' };
export type BotState = {
  x: number; z: number; speed: number; angle: number;
  lap: number; finishTimeMs: number | null; coinsCollected: number; phase: number;
  stunTimeMs?: number;
};

const COIN_COUNT = 75;
const COIN_Z_SPACING = 60;
const OBSTACLE_COUNT = 22;

const generateCoins = (): CoinInternal[] => {
  return Array.from({ length: COIN_COUNT }, (_, i): CoinInternal => {
    // Bias toward center of road: 2/3 of coins near centre, 1/3 wide
    const rawX = (((i * 3571 + 17) % 110) - 55) / 10; // -5.5 to 5.5
    const x = i % 3 === 0 ? rawX : rawX * 0.45; // centre-weighted
    return {
      id: i,
      x: Math.max(-6, Math.min(6, x)),
      z: (i + 1) * COIN_Z_SPACING,
      collected: false,
    };
  });
};

const generateObstacles = (): ObstacleInternal[] => {
  const types = ['rock', 'barrel', 'cone'] as const;

  // LCG for deterministic but well-distributed pseudo-random values
  let seed = 0xdeadbeef;
  const rng = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };

  // Spread across z=250..4400 with a minimum gap of 150 units
  const START_Z = 250;
  const END_Z = 4400;
  const MIN_GAP = 150;
  const baseSpacing = (END_Z - START_Z) / OBSTACLE_COUNT;

  return Array.from({ length: OBSTACLE_COUNT }, (_, i): ObstacleInternal => {
    const baseZ = START_Z + i * baseSpacing;
    const jitter = (rng() - 0.5) * (baseSpacing - MIN_GAP);
    const z = Math.max(START_Z + i * MIN_GAP, Math.min(END_Z, baseZ + jitter));
    const x = (rng() * 2 - 1) * 6.5; // −6.5 to 6.5, uniform spread
    return { id: i, x, z, type: types[i % 3] };
  });
};

const rooms = new Map<string, GameState>();
const playersByRoom = new Map<string, Map<string, ConnectedPlayer>>();
const roomCoins = new Map<string, CoinInternal[]>();
const roomObstacles = new Map<string, ObstacleInternal[]>();
const roomBots = new Map<string, BotState | null>();

export const getOrCreateRoom = (roomId: string, tenantId: string): GameState => {
  const existing = rooms.get(roomId);

  if (existing !== undefined) {
    return existing;
  }

  const newRoom: GameState = {
    roomId,
    tenantId,
    matchId: null,
    players: [],
    raceTimeMs: 0,
    status: 'waiting',
    coins: [],
    obstacles: [],
  };

  rooms.set(roomId, newRoom);
  playersByRoom.set(roomId, new Map());
  roomCoins.set(roomId, generateCoins());
  roomObstacles.set(roomId, generateObstacles());
  roomBots.set(roomId, null);

  return newRoom;
};

export const getRoomCoins = (roomId: string): CoinInternal[] => {
  return roomCoins.get(roomId) ?? [];
};

export const getRoomObstacles = (roomId: string): ObstacleInternal[] => {
  return roomObstacles.get(roomId) ?? [];
};

export const getRoomBot = (roomId: string): BotState | null => {
  return roomBots.get(roomId) ?? null;
};

export const createRoomBot = (roomId: string): void => {
  roomBots.set(roomId, {
    x: 2,
    z: -4,
    speed: 0,
    angle: 0,
    lap: 0,
    finishTimeMs: null,
    coinsCollected: 0,
    phase: 1.2,
  });
};

export const setRoomBot = (roomId: string, bot: BotState): void => {
  roomBots.set(roomId, bot);
};

export const getRoomState = (roomId: string): GameState | undefined => {
  return rooms.get(roomId);
};

export const setRoomMatchId = (roomId: string, matchId: string): void => {
  const room = rooms.get(roomId);
  if (room !== undefined) {
    room.matchId = matchId;
  }
};

export const setRoomStatus = (roomId: string, status: RaceStatus): void => {
  const room = rooms.get(roomId);

  if (room === undefined) {
    return;
  }

  room.status = status;
};

export const incrementRaceTime = (roomId: string, deltaMs: number): void => {
  const room = rooms.get(roomId);

  if (room === undefined) {
    return;
  }

  room.raceTimeMs += deltaMs;
};

export const getPlayersInRoom = (roomId: string): Map<string, ConnectedPlayer> => {
  const players = playersByRoom.get(roomId);

  if (players === undefined) {
    return new Map();
  }

  return players;
};

export const addPlayerToRoom = (roomId: string, player: ConnectedPlayer): void => {
  let roomPlayers = playersByRoom.get(roomId);

  if (roomPlayers === undefined) {
    roomPlayers = new Map();
    playersByRoom.set(roomId, roomPlayers);
  }

  roomPlayers.set(player.userId, player);

  const room = rooms.get(roomId);
  if (room !== undefined) {
    const existing = room.players.find((p) => {
      return p.userId === player.userId;
    });
    if (existing === undefined) {
      room.players.push(player.state);
    }
  }
};

export const removePlayerFromRoom = (roomId: string, userId: string): void => {
  const roomPlayers = playersByRoom.get(roomId);

  if (roomPlayers !== undefined) {
    roomPlayers.delete(userId);
  }

  const room = rooms.get(roomId);

  if (room !== undefined) {
    const playerState = room.players.find((p) => {
      return p.userId === userId;
    });
    if (playerState !== undefined) {
      playerState.connected = false;
    }
  }
};

export const deleteRoom = (roomId: string): void => {
  rooms.delete(roomId);
  playersByRoom.delete(roomId);
  roomCoins.delete(roomId);
  roomObstacles.delete(roomId);
  roomBots.delete(roomId);
};
