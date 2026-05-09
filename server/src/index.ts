import { WebSocketServer } from 'ws';
import { serverConfig } from './config/env';
import { handleConnection } from './controllers/connection.controller';

const startServer = (): void => {
  const wss = new WebSocketServer({ port: serverConfig.port });

  wss.on('connection', handleConnection);

  wss.on('listening', (): void => {
    console.log(`RaceGrid WebSocket server running on port ${serverConfig.port}`);
  });

  wss.on('error', (error: Error): void => {
    console.error('WebSocket server error:', error.message);
  });
};

startServer();
