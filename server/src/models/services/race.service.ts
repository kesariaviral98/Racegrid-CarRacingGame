import { supabase } from '../../lib/supabaseClient';
import type { RaceResult, TeamId } from '../types/game.types';

const getTeamScore = (results: RaceResult[], team: TeamId): number => {
  return results
    .filter((r): boolean => { return r.team === team; })
    .reduce((sum, r): number => { return sum + r.score; }, 0);
};

export const createMatch = async (tenantId: string, roomId: string): Promise<string> => {
  const { data, error } = await supabase
    .from('matches')
    .insert({ tenant_id: tenantId, room_id: roomId, status: 'active', started_at: new Date().toISOString() })
    .select('id')
    .single();

  if (error !== null) {
    throw new Error(`Failed to create match: ${error.message}`);
  }

  const row = data as { id: string };
  return row.id;
};

export const finishMatch = async (
  matchId: string,
  tenantId: string,
  roomId: string,
  results: RaceResult[]
): Promise<void> => {
  const scoreA = getTeamScore(results, 'A');
  const scoreB = getTeamScore(results, 'B');

  let winnerTeam: TeamId;
  if (scoreA >= scoreB) {
    winnerTeam = 'A';
  } else {
    winnerTeam = 'B';
  }

  const finishedAt = new Date().toISOString();

  const { error: matchErr } = await supabase
    .from('matches')
    .update({ status: 'finished', winner_team: winnerTeam, finished_at: finishedAt })
    .eq('id', matchId);

  if (matchErr !== null) {
    throw new Error(`Failed to update match: ${matchErr.message}`);
  }

  const rows = results.map((r) => {
    return {
      match_id: matchId,
      user_id: r.userId,
      username: r.username,
      tenant_id: tenantId,
      team: r.team,
      finish_position: r.finishPosition,
      finish_time_ms: r.finishTimeMs,
      score: r.score,
      coins_collected: r.coinsCollected,
    };
  });

  const { error: playersErr } = await supabase
    .from('match_players')
    .insert(rows);

  if (playersErr !== null) {
    console.error(`Failed to save match players for room ${roomId}:`, playersErr.message);
  }
};
