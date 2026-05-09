import { createRoom, getRoomByCode, updateRoomStatus } from '../models/services/room.service';
import { trackEvent, EventType } from '../models/services/analytics.service';
import type { Room, RoomPlayer, TeamId } from '../models/types/room.types';

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 6;

const generateRoomCode = (): string => {
  let code = '';
  for (let index = 0; index < ROOM_CODE_LENGTH; index++) {
    const randomIndex = Math.floor(Math.random() * ROOM_CODE_CHARS.length);
    code += ROOM_CODE_CHARS[randomIndex];
  }
  return code;
};

export const handleCreateRoom = async (
  tenantId: string,
  hostId: string
): Promise<Room> => {
  try {
    const code = generateRoomCode();
    const room = await createRoom(tenantId, hostId, code);

    trackEvent(EventType.ROOM_CREATED, hostId, tenantId, { roomId: room.id, code: room.code });

    return room;
  } catch (err) {
    let message: string;
    if (err instanceof Error) {
      message = err.message;
    } else {
      message = 'Unknown error';
    }
    throw new Error(`Failed to create room: ${message}`, { cause: err });
  }
};

export const handleJoinRoom = async (
  code: string,
  userId: string,
  tenantId: string
): Promise<Room> => {
  try {
    const room = await getRoomByCode(code);

    if (!room) {
      throw new Error('Room not found');
    }

    if (room.status !== 'waiting') {
      throw new Error('Room is not accepting players');
    }

    trackEvent(EventType.ROOM_JOINED, userId, tenantId, { roomId: room.id, code: room.code });

    return room;
  } catch (err) {
    let message: string;
    if (err instanceof Error) {
      message = err.message;
    } else {
      message = 'Unknown error';
    }
    throw new Error(`Failed to join room: ${message}`, { cause: err });
  }
};

export const handleSelectTeam = (
  players: RoomPlayer[],
  userId: string,
  username: string,
  team: TeamId,
  tenantId: string
): RoomPlayer[] => {
  const existingIndex = players.findIndex((player) => {
    return player.userId === userId;
  });

  if (existingIndex !== -1) {
    const updated = [...players];
    updated[existingIndex] = { userId, username, team };
    trackEvent(EventType.TEAM_SELECTED, userId, tenantId, { team });
    return updated;
  }

  trackEvent(EventType.TEAM_SELECTED, userId, tenantId, { team });
  return [...players, { userId, username, team }];
};

export const handleLeaveRoom = (players: RoomPlayer[], userId: string): RoomPlayer[] => {
  return players.filter((player) => {
    return player.userId !== userId;
  });
};

export const handleStartRace = async (roomId: string): Promise<void> => {
  try {
    await updateRoomStatus(roomId, 'active');
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
