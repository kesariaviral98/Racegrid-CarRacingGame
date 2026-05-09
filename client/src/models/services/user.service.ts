import { supabase } from '../../lib/supabaseClient';
import type { User, UserRow } from '../types/user.types';

const mapRowToUser = (row: UserRow): User => {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    username: row.username,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
};

export const getUserById = async (userId: string): Promise<User | null> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    return mapRowToUser(data as UserRow);
  } catch (err) {
    let message: string;
    if (err instanceof Error) {
      message = err.message;
    } else {
      message = 'Unknown error';
    }
    throw new Error(`Failed to get user by ID: ${message}`, { cause: err });
  }
};

export const getUsersByTenant = async (tenantId: string): Promise<User[]> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return [];
    }

    return (data as UserRow[]).map(mapRowToUser);
  } catch (err) {
    let message: string;
    if (err instanceof Error) {
      message = err.message;
    } else {
      message = 'Unknown error';
    }
    throw new Error(`Failed to get users by tenant: ${message}`, { cause: err });
  }
};

export const updateUserStatus = async (userId: string, isActive: boolean): Promise<void> => {
  try {
    const { error } = await supabase
      .from('users')
      .update({ is_active: isActive })
      .eq('id', userId);

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
    throw new Error(`Failed to update user status: ${message}`, { cause: err });
  }
};
