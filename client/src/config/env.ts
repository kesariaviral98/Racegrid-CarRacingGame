const getEnvVariable = (key: string): string => {
  const value = import.meta.env[key] as string | undefined;

  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

const resolveWebSocketUrl = (): string => {
  const explicit = import.meta.env['VITE_WEBSOCKET_SERVER_URL'] as string | undefined;
  if (explicit !== undefined && explicit !== '') {
    return explicit;
  }
  // Auto-detect: use the same host the browser reached the app on.
  // This makes cross-computer LAN play work without manual config.
  const host = window.location.hostname;
  return `ws://${host}:4000`;
};

export const config = {
  supabaseUrl: getEnvVariable('VITE_SUPABASE_URL'),
  supabaseAnonKey: getEnvVariable('VITE_SUPABASE_ANON_KEY'),
  websocketServerUrl: resolveWebSocketUrl(),
  nodeEnv: getEnvVariable('VITE_NODE_ENV'),
};
