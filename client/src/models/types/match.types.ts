import type { TeamId } from './room.types';

export type MatchStatus = 'pending' | 'active' | 'finished';

export interface Match {
  id: string;
  tenantId: string;
  roomId: string;
  status: MatchStatus;
  winnerTeam: TeamId | null;
  startedAt: string | null;
  finishedAt: string | null;
  players?: MatchPlayer[];
}

export interface MatchPlayer {
  id: string;
  matchId: string;
  userId: string;
  username?: string;
  tenantId: string;
  team: TeamId;
  finishPosition: number | null;
  finishTimeMs: number | null;
  score: number;
  coinsCollected: number;
}

export interface MatchRow {
  id: string;
  tenant_id: string;
  room_id: string;
  status: MatchStatus;
  winner_team: TeamId | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface MatchPlayerRow {
  id: string;
  match_id: string;
  user_id: string;
  username: string | null;
  tenant_id: string;
  team: TeamId;
  finish_position: number | null;
  finish_time_ms: number | null;
  score: number;
  coins_collected: number | null;
}

export interface RaceResult {
  userId: string;
  username: string;
  team: TeamId;
  finishPosition: number;
  finishTimeMs: number;
  score: number;
}
