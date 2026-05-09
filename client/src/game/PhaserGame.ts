import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { RaceScene } from './scenes/RaceScene';
import { ResultScene } from './scenes/ResultScene';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants/game.constants';

export const createPhaserGame = (
  parent: HTMLElement,
  onInputSend: (input: { up: boolean; down: boolean; left: boolean; right: boolean }) => void
): Phaser.Game => {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent,
    backgroundColor: '#1a5c1a',
    scene: [BootScene, PreloadScene, RaceScene, ResultScene],
    physics: {
      default: 'arcade',
      arcade: { debug: false },
    },
    callbacks: {
      preBoot: (game: Phaser.Game): void => {
        game.scene.start('BootScene');
      },
    },
  };

  const game = new Phaser.Game(config);

  game.events.once(Phaser.Core.Events.READY, (): void => {
    const raceScene = game.scene.getScene('RaceScene') as RaceScene;
    if (raceScene !== null) {
      raceScene.scene.restart({ onInputSend });
    }
  });

  return game;
};

export const destroyPhaserGame = (game: Phaser.Game): void => {
  game.destroy(true);
};
