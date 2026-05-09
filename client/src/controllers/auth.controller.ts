import { supabase } from '../lib/supabaseClient';
import { getUserById } from '../models/services/user.service';
import { trackEvent, EventType } from '../models/services/analytics.service';
import type { User, UserRole } from '../models/types/user.types';

export const signUp = async (email: string, password: string, username: string): Promise<User> => {
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });

    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error('Sign up failed: no user returned');

    // Find the first available tenant to join
    const { data: tenants, error: tenantErr } = await supabase
      .from('tenants')
      .select('id')
      .limit(1);

    if (tenantErr !== null || !tenants || tenants.length === 0) {
      throw new Error('No tenant found — ask an admin to set one up');
    }

    const tenantId = (tenants[0] as { id: string }).id;

    const { error: profileErr } = await supabase.from('users').insert({
      id: authData.user.id,
      tenant_id: tenantId,
      username,
      role: 'player',
      is_active: true,
    });

    if (profileErr !== null) throw new Error(profileErr.message);

    const user = await getUserById(authData.user.id);
    if (!user) throw new Error('User profile not found after creation');

    trackEvent(EventType.USER_LOGIN, user.id, user.tenantId, { email, action: 'signup' });
    return user;
  } catch (err) {
    let message: string;
    if (err instanceof Error) {
      message = err.message;
    } else {
      message = 'Unknown error';
    }
    throw new Error(`Sign up failed: ${message}`, { cause: err });
  }
};

export const signIn = async (email: string, password: string): Promise<User> => {
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      throw new Error(authError.message);
    }

    if (!authData.user) {
      throw new Error('Sign in failed: no user returned');
    }

    const user = await getUserById(authData.user.id);

    if (!user) {
      throw new Error('User profile not found');
    }

    if (!user.isActive) {
      await supabase.auth.signOut();
      throw new Error('Account is banned');
    }

    trackEvent(EventType.USER_LOGIN, user.id, user.tenantId, { email });

    return user;
  } catch (err) {
    let message: string;
    if (err instanceof Error) {
      message = err.message;
    } else {
      message = 'Unknown error';
    }
    throw new Error(`Sign in failed: ${message}`, { cause: err });
  }
};

export const signOut = async (): Promise<void> => {
  try {
    const { error } = await supabase.auth.signOut();

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
    throw new Error(`Sign out failed: ${message}`, { cause: err });
  }
};

export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const { data } = await supabase.auth.getSession();

    if (!data.session) {
      return null;
    }

    const user = await getUserById(data.session.user.id);
    return user;
  } catch (err) {
    let message: string;
    if (err instanceof Error) {
      message = err.message;
    } else {
      message = 'Unknown error';
    }
    throw new Error(`Failed to get current user: ${message}`, { cause: err });
  }
};

export const getUserRole = async (userId: string): Promise<UserRole> => {
  try {
    const user = await getUserById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    return user.role;
  } catch (err) {
    let message: string;
    if (err instanceof Error) {
      message = err.message;
    } else {
      message = 'Unknown error';
    }
    throw new Error(`Failed to get user role: ${message}`, { cause: err });
  }
};
