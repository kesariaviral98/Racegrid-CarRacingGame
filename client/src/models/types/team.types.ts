import type { TeamId } from './room.types';

export interface TeamScore {
  team: TeamId;
  totalScore: number;
  players: string[];
}
