import type WebSocket from 'ws';
import type { ClientMessage, ServerMessage, TeamId } from '../models/types/game.types';
import type { ConnectedPlayer } from '../models/types/player.types';
import {
  getOrCreateRoom,
  addPlayerToRoom,
  removePlayerFromRoom,
  getPlayersInRoom,
  getRoomState,
} from '../models/GameState';
import { handleInput } from './input.controller';
import { startGameLoop } from './gameLoop.controller';

const TEAM_A_START_X = -1.5;
const TEAM_B_START_X = 1.5;
const CAR_START_Z = 0;
const CAR_START_ANGLE = 0;
const READY_START_DELAY_MS = 500;

const broadcastToRoom = (roomId: string, message: ServerMessage): void => {
  const players = getPlayersInRoom(roomId);

  players.forEach((player): void => {
    if (player.ws.readyState === player.ws.OPEN) {
      player.ws.send(JSON.stringify(message));
    }
  });
};

export const handleConnection = (ws: WebSocket): void => {
  let connectedPlayer: ConnectedPlayer | null = null;

  ws.on('message', (data: Buffer): void => {
    try {
      const message = JSON.parse(data.toString()) as ClientMessage;

      if (message.type === 'JOIN_ROOM') {
        connectedPlayer = handleJoinRoom(ws, message.roomId, message.userId, message.tenantId, message.username);
      } else if (message.type === 'PLAYER_INPUT') {
        if (connectedPlayer !== null) {
          handleInput(connectedPlayer, message.input);
        }
      } else if (message.type === 'RACE_READY') {
        if (connectedPlayer !== null) {
          connectedPlayer.readyForRace = true;
          maybeStartLoop(connectedPlayer.roomId);
        }
      }
    } catch (err) {
      console.error('Error handling message:', err);
    }
  });

  ws.on('close', (): void => {
    if (connectedPlayer !== null) {
      handleDisconnect(connectedPlayer);
    }
  });
};

const maybeStartLoop = (roomId: string): void => {
  const room = getRoomState(roomId);
  if (room === undefined) {
    return;
  }
  if (room.status !== 'waiting') {
    return;
  }
  // Brief pause so late-connecting players join before countdown begins
  setTimeout((): void => {
    const currentRoom = getRoomState(roomId);
    if (currentRoom !== undefined && currentRoom.status === 'waiting') {
      startGameLoop(roomId);
    }
  }, READY_START_DELAY_MS);
};

const handleJoinRoom = (ws: WebSocket, roomId: string, userId: string, tenantId: string, username: string): ConnectedPlayer => {
  const room = getOrCreateRoom(roomId, tenantId);

  let team: TeamId;
  if (room.players.length < 2) {
    team = 'A';
  } else {
    team = 'B';
  }

  let startX: number;
  if (team === 'A') {
    startX = TEAM_A_START_X;
  } else {
    startX = TEAM_B_START_X;
  }

  const player: ConnectedPlayer = {
    ws,
    userId,
    username,
    roomId,
    team,
    state: {
      userId,
      username,
      x: startX,
      z: CAR_START_Z,
      angle: CAR_START_ANGLE,
      speed: 0,
      lap: 0,
      position: room.players.length + 1,
      team,
      connected: true,
      finishTimeMs: null,
      coinsCollected: 0,
      stunTimeMs: 0,
    },
    lastInput: { up: false, down: false, left: false, right: false },
    readyForRace: false,
  };

  addPlayerToRoom(roomId, player);

  const roomPlayers = getPlayersInRoom(roomId);
  const joinedMessage: ServerMessage = {
    type: 'ROOM_JOINED',
    players: Array.from(roomPlayers.values()).map((p): ConnectedPlayer['state'] => {
      return p.state;
    }),
  };

  ws.send(JSON.stringify(joinedMessage));

  return player;
};

const handleDisconnect = (player: ConnectedPlayer): void => {
  removePlayerFromRoom(player.roomId, player.userId);

  const disconnectMessage: ServerMessage = {
    type: 'PLAYER_DISCONNECTED',
    userId: player.userId,
  };

  broadcastToRoom(player.roomId, disconnectMessage);
};
