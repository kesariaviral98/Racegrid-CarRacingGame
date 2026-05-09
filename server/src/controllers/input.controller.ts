import type { ConnectedPlayer } from '../models/types/player.types';
import type { PlayerInput } from '../models/types/game.types';

export const handleInput = (player: ConnectedPlayer, input: PlayerInput): void => {
  if (!isValidInput(input)) {
    return;
  }

  player.lastInput = input;
};

const isValidInput = (input: unknown): input is PlayerInput => {
  if (typeof input !== 'object' || input === null) {
    return false;
  }

  const candidate = input as Record<string, unknown>;

  if (typeof candidate['up'] !== 'boolean') {
    return false;
  }

  if (typeof candidate['down'] !== 'boolean') {
    return false;
  }

  if (typeof candidate['left'] !== 'boolean') {
    return false;
  }

  if (typeof candidate['right'] !== 'boolean') {
    return false;
  }

  return true;
};
