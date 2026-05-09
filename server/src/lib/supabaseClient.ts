import { createClient } from '@supabase/supabase-js';
import { serverConfig } from '../config/env';

export const supabase = createClient(
  serverConfig.supabaseUrl,
  serverConfig.supabaseServiceRoleKey,
  { auth: { persistSession: false } }
);
