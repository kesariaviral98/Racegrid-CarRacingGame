import Phaser from 'phaser';

export class ResultScene extends Phaser.Scene {
  public constructor() {
    super({ key: 'ResultScene' });
  }

  public create(): void {
    this.add
      .text(400, 300, 'Race Finished!', { fontSize: '32px', color: '#ffffff' })
      .setOrigin(0.5);
  }
}
