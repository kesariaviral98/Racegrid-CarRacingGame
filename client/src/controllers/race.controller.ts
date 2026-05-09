import { createMatch, updateMatchResult, saveMatchPlayers } from '../models/services/match.service';
import { updateRoomStatus } from '../models/services/room.service';
import { trackEvent, EventType } from '../models/services/analytics.service';
import type { Match, RaceResult } from '../models/types/match.types';
import type { TeamId } from '../models/types/room.types';

const SCORE_BY_POSITION: Record<number, number> = {
  1: 10,
  2: 7,
  3: 5,
  4: 3,
};

export const handleRaceStart = async (
  tenantId: string,
  roomId: string,
  userId: string
): Promise<Match> => {
  try {
    const match = await createMatch(tenantId, roomId);

    trackEvent(EventType.RACE_STARTED, userId, tenantId, { matchId: match.id, roomId });

    return match;
  } catch (err) {
    let message: string;
    if (err instanceof Error) {
      message = err.message;
    } else {
      message = 'Unknown error';
    }
    throw new Error(`Failed to start race: ${message}`, { cause: err });
  }
};

export const handleRaceFinish = async (
  matchId: string,
  tenantId: string,
  roomId: string,
  results: RaceResult[],
  userId: string
): Promise<void> => {
  try {
    const teamAScore = results
      .filter((result) => {
        return result.team === 'A';
      })
      .reduce((sum, result) => {
        return sum + result.score;
      }, 0);

    const teamBScore = results
      .filter((result) => {
        return result.team === 'B';
      })
      .reduce((sum, result) => {
        return sum + result.score;
      }, 0);

    let winnerTeam: TeamId;
    if (teamAScore >= teamBScore) {
      winnerTeam = 'A';
    } else {
      winnerTeam = 'B';
    }

    const finishedAt = new Date().toISOString();

    await updateMatchResult(matchId, winnerTeam, finishedAt);
    await saveMatchPlayers(matchId, tenantId, results);
    await updateRoomStatus(roomId, 'finished');

    trackEvent(EventType.RACE_COMPLETED, userId, tenantId, {
      matchId,
      winnerTeam,
      results,
    });
  } catch (err) {
    let message: string;
    if (err instanceof Error) {
      message = err.message;
    } else {
      message = 'Unknown error';
    }
    throw new Error(`Failed to handle race finish: ${message}`, { cause: err });
  }
};

export const getScoreForPosition = (position: number): number => {
  const score = SCORE_BY_POSITION[position];
  if (score === undefined) {
    return 0;
  }
  return score;
};
