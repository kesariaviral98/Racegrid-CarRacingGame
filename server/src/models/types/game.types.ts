export type RaceStatus = 'waiting' | 'countdown' | 'racing' | 'finished';
export type TeamId = 'A' | 'B';

export type PlayerInput = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

export type CoinState = { id: number; x: number; z: number };
export type ObstacleType = 'rock' | 'barrel' | 'cone';
export type ObstacleState = { id: number; x: number; z: number; type: ObstacleType };

export type PlayerState = {
  userId: string;
  username: string;
  x: number;
  z: number;
  angle: number;
  speed: number;
  lap: number;
  position: number;
  team: TeamId;
  connected: boolean;
  finishTimeMs: number | null;
  coinsCollected: number;
  stunTimeMs: number;
};

export type GameState = {
  roomId: string;
  tenantId: string;
  matchId: string | null;
  players: PlayerState[];
  raceTimeMs: number;
  status: RaceStatus;
  coins: CoinState[];
  obstacles: ObstacleState[];
};

export type RaceResult = {
  userId: string;
  username: string;
  team: TeamId;
  finishPosition: number;
  finishTimeMs: number;
  score: number;
  coinsCollected: number;
};

type RoomJoinedMessage = { type: 'ROOM_JOINED'; players: PlayerState[] };
type GameStateMessage = { type: 'GAME_STATE'; state: GameState };
type RaceStartedMessage = { type: 'RACE_STARTED'; countdown: number };
type RaceFinishedMessage = { type: 'RACE_FINISHED'; results: RaceResult[] };
type PlayerDisconnectedMessage = { type: 'PLAYER_DISCONNECTED'; userId: string };

export type ServerMessage =
  | RoomJoinedMessage
  | GameStateMessage
  | RaceStartedMessage
  | RaceFinishedMessage
  | PlayerDisconnectedMessage;

type JoinRoomMessage = { type: 'JOIN_ROOM'; roomId: string; userId: string; tenantId: string; username: string };
type PlayerInputMessage = { type: 'PLAYER_INPUT'; input: PlayerInput };
type RaceReadyMessage = { type: 'RACE_READY' };

export type ClientMessage = JoinRoomMessage | PlayerInputMessage | RaceReadyMessage;
