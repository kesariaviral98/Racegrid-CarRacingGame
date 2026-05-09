import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  public constructor() {
    super({ key: 'BootScene' });
  }

  public create(): void {
    this.scene.start('PreloadScene');
  }
}
