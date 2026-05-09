import { supabase } from '../../lib/supabaseClient';
import type { Room, RoomRow } from '../types/room.types';

const mapRowToRoom = (row: RoomRow): Room => {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    code: row.code,
    status: row.status,
    hostId: row.host_id,
    createdAt: row.created_at,
    players: [],
  };
};

export const createRoom = async (tenantId: string, hostId: string, code: string): Promise<Room> => {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .insert({ tenant_id: tenantId, host_id: hostId, code })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapRowToRoom(data as RoomRow);
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

export const getRoomByCode = async (code: string): Promise<Room | null> => {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .single();

    if (error) {
      return null;
    }

    if (!data) {
      return null;
    }

    return mapRowToRoom(data as RoomRow);
  } catch (err) {
    let message: string;
    if (err instanceof Error) {
      message = err.message;
    } else {
      message = 'Unknown error';
    }
    throw new Error(`Failed to get room by code: ${message}`, { cause: err });
  }
};

export const getRoomById = async (roomId: string): Promise<Room | null> => {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (error) {
      return null;
    }

    if (!data) {
      return null;
    }

    return mapRowToRoom(data as RoomRow);
  } catch (err) {
    let message: string;
    if (err instanceof Error) {
      message = err.message;
    } else {
      message = 'Unknown error';
    }
    throw new Error(`Failed to get room by ID: ${message}`, { cause: err });
  }
};

export const updateRoomStatus = async (
  roomId: string,
  status: Room['status']
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('rooms')
      .update({ status })
      .eq('id', roomId);

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
    throw new Error(`Failed to update room status: ${message}`, { cause: err });
  }
};
