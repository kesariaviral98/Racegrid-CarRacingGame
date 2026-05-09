import dotenv from 'dotenv';

dotenv.config({ path: '.env.development' });

const getEnvVariable = (key: string): string => {
  const value = process.env[key];

  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

export const serverConfig = {
  port: parseInt(getEnvVariable('PORT'), 10),
  nodeEnv: getEnvVariable('NODE_ENV'),
  supabaseUrl: getEnvVariable('SUPABASE_URL'),
  supabaseServiceRoleKey: getEnvVariable('SUPABASE_SERVICE_ROLE_KEY'),
  databaseUrl: getEnvVariable('DATABASE_URL'),
};
