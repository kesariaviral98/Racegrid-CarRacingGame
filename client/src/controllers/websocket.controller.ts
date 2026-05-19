import { config } from '../config/env';

export type PlayerInput = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

export type CoinWs = { id: number; x: number; z: number };
export type ObstacleWs = { id: number; x: number; z: number; type: 'rock' | 'barrel' | 'cone' };

export type PlayerState = {
  userId: string;
  username: string;
  x: number;
  z: number;
  angle: number;
  speed: number;
  lap: number;
  position: number;
  coinsCollected?: number;
  stunTimeMs?: number;
};

export type GameState = {
  players: PlayerState[];
  raceTimeMs: number;
  status: 'waiting' | 'countdown' | 'racing' | 'finished';
  tenantId?: string;
  matchId?: string | null;
  coins?: CoinWs[];
  obstacles?: ObstacleWs[];
};

export type RaceResultWs = {
  userId: string;
  username: string;
  team: string;
  finishPosition: number;
  finishTimeMs: number;
  score: number;
  coinsCollected?: number;
};

type ClientMessage =
  | { type: 'JOIN_ROOM'; roomId: string; userId: string; tenantId: string; username: string }
  | { type: 'PLAYER_INPUT'; input: PlayerInput }
  | { type: 'RACE_READY' };

type ServerMessage =
  | { type: 'ROOM_JOINED'; players: PlayerState[] }
  | { type: 'GAME_STATE'; state: GameState }
  | { type: 'RACE_STARTED'; countdown: number }
  | { type: 'RACE_FINISHED'; results: RaceResultWs[] }
  | { type: 'PLAYER_DISCONNECTED'; userId: string };

type MessageHandler = (message: ServerMessage) => void;

let socket: WebSocket | null = null;
const messageHandlers: Set<MessageHandler> = new Set();

/**
 * Opens a WebSocket connection to the game server and sends JOIN_ROOM.
 * No-ops if a connection is already open.
 */
export const connectWebSocket = (roomId: string, userId: string, tenantId: string, username: string): void => {
  if (socket !== null && socket.readyState === WebSocket.OPEN) {
    return;
  }

  socket = new WebSocket(config.websocketServerUrl);

  socket.onopen = (): void => {
    const joinMessage: ClientMessage = { type: 'JOIN_ROOM', roomId, userId, tenantId, username };
    sendMessage(joinMessage);
  };

  socket.onmessage = (event: MessageEvent): void => {
    try {
      const message = JSON.parse(event.data as string) as ServerMessage;
      messageHandlers.forEach((handler) => {
        handler(message);
      });
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  };

  socket.onclose = (): void => {
    socket = null;
  };

  socket.onerror = (event: Event): void => {
    console.error('WebSocket error:', event);
  };
};

/** Gracefully closes the socket. Safe to call even if already disconnected. */
export const disconnectWebSocket = (): void => {
  if (socket !== null) {
    socket.close();
    socket = null;
  }
};

export const sendInput = (input: PlayerInput): void => {
  const message: ClientMessage = { type: 'PLAYER_INPUT', input };
  sendMessage(message);
};

export const sendRaceReady = (): void => {
  const message: ClientMessage = { type: 'RACE_READY' };
  sendMessage(message);
};

/** Registers a handler to receive all incoming server messages. */
export const addMessageHandler = (handler: MessageHandler): void => {
  messageHandlers.add(handler);
};

/** Deregisters a previously added handler. */
export const removeMessageHandler = (handler: MessageHandler): void => {
  messageHandlers.delete(handler);
};

const sendMessage = (message: ClientMessage): void => {
  if (socket === null || socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(message));
};
