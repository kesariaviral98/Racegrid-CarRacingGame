import type WebSocket from 'ws';
import type { PlayerState, PlayerInput, TeamId } from './game.types';

export type ConnectedPlayer = {
  ws: WebSocket;
  userId: string;
  username: string;
  roomId: string;
  team: TeamId;
  state: PlayerState;
  lastInput: PlayerInput;
  readyForRace: boolean;
};
