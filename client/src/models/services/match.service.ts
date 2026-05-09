import { supabase } from '../../lib/supabaseClient';
import type { Match, MatchRow, MatchPlayer, MatchPlayerRow, RaceResult } from '../types/match.types';
import type { TeamId } from '../types/room.types';

const mapRowToMatch = (row: MatchRow): Match => {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    roomId: row.room_id,
    status: row.status,
    winnerTeam: row.winner_team,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
};

const mapRowToMatchPlayer = (row: MatchPlayerRow): MatchPlayer => {
  return {
    id: row.id,
    matchId: row.match_id,
    userId: row.user_id,
    username: row.username ?? undefined,
    tenantId: row.tenant_id,
    team: row.team,
    finishPosition: row.finish_position,
    finishTimeMs: row.finish_time_ms,
    score: row.score,
    coinsCollected: row.coins_collected ?? 0,
  };
};

export const createMatch = async (tenantId: string, roomId: string): Promise<Match> => {
  try {
    const { data, error } = await supabase
      .from('matches')
      .insert({ tenant_id: tenantId, room_id: roomId })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapRowToMatch(data as MatchRow);
  } catch (err) {
    let message: string;
    if (err instanceof Error) {
      message = err.message;
    } else {
      message = 'Unknown error';
    }
    throw new Error(`Failed to create match: ${message}`, { cause: err });
  }
};

export const updateMatchResult = async (
  matchId: string,
  winnerTeam: TeamId,
  finishedAt: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('matches')
      .update({ status: 'finished', winner_team: winnerTeam, finished_at: finishedAt })
      .eq('id', matchId);

    if (error) {
      throw new Error(error.message);
    }
  } catch (err) {
    let message: string;
    if (err instanceof Error) {
      message = err.message;
    } else {
      message = 'Unknown error';
    }
    throw new Error(`Failed to update match result: ${message}`, { cause: err });
  }
};

export const saveMatchPlayers = async (
  matchId: string,
  tenantId: string,
  results: RaceResult[]
): Promise<MatchPlayer[]> => {
  try {
    const rows = results.map((result) => {
      return {
        match_id: matchId,
        user_id: result.userId,
        tenant_id: tenantId,
        team: result.team,
        finish_position: result.finishPosition,
        finish_time_ms: result.finishTimeMs,
        score: result.score,
      };
    });

    const { data, error } = await supabase
      .from('match_players')
      .insert(rows)
      .select();

    if (error) {
      throw new Error(error.message);
    }

    return (data as MatchPlayerRow[]).map(mapRowToMatchPlayer);
  } catch (err) {
    let message: string;
    if (err instanceof Error) {
      message = err.message;
    } else {
      message = 'Unknown error';
    }
    throw new Error(`Failed to save match players: ${message}`, { cause: err });
  }
};

export const getMatchHistory = async (tenantId: string): Promise<Match[]> => {
  try {
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('finished_at', { ascending: false })
      .limit(50);

    if (matchError) {
      throw new Error(matchError.message);
    }

    if (!matchData) {
      return [];
    }

    const matches = (matchData as MatchRow[]).map(mapRowToMatch);

    // Fetch players for all matches in one query
    const matchIds = matches.map((m) => { return m.id; });
    if (matchIds.length === 0) {
      return matches;
    }

    const { data: playerData } = await supabase
      .from('match_players')
      .select('*')
      .in('match_id', matchIds)
      .order('finish_position', { ascending: true });

    if (playerData !== null) {
      const playersByMatch = new Map<string, MatchPlayer[]>();
      (playerData as MatchPlayerRow[]).forEach((row): void => {
        const mp = mapRowToMatchPlayer(row);
        const list = playersByMatch.get(mp.matchId) ?? [];
        list.push(mp);
        playersByMatch.set(mp.matchId, list);
      });

      matches.forEach((m): void => {
        m.players = playersByMatch.get(m.id) ?? [];
      });
    }

    return matches;
  } catch (err) {
    let message: string;
    if (err instanceof Error) {
      message = err.message;
    } else {
      message = 'Unknown error';
    }
    throw new Error(`Failed to get match history: ${message}`, { cause: err });
  }
};
