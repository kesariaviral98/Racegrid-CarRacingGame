import Phaser from 'phaser';

const darkenColor = (color: number, factor: number): number => {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const r = Math.max(0, Math.floor(c.red * (1 - factor)));
  const g = Math.max(0, Math.floor(c.green * (1 - factor)));
  const b = Math.max(0, Math.floor(c.blue * (1 - factor)));
  return Phaser.Display.Color.GetColor(r, g, b);
};

const lightenColor = (color: number, factor: number): number => {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const r = Math.min(255, Math.floor(c.red + (255 - c.red) * factor));
  const g = Math.min(255, Math.floor(c.green + (255 - c.green) * factor));
  const b = Math.min(255, Math.floor(c.blue + (255 - c.blue) * factor));
  return Phaser.Display.Color.GetColor(r, g, b);
};

const drawCarTexture = (
  scene: Phaser.Scene,
  key: string,
  bodyColor: number,
  accentColor: number
): void => {
  const W = 64;
  const H = 30;
  const gfx = scene.add.graphics();
  const darkBody = darkenColor(bodyColor, 0.42);
  const lightBody = lightenColor(bodyColor, 0.48);
  const darkAccent = darkenColor(accentColor, 0.3);

  // Tires — ellipses give a slightly side-viewed look
  gfx.fillStyle(0x0e0e0e);
  gfx.fillEllipse(8, 7, 17, 13);
  gfx.fillEllipse(8, 23, 17, 13);
  gfx.fillEllipse(56, 7, 17, 13);
  gfx.fillEllipse(56, 23, 17, 13);

  // Wheel rim
  gfx.fillStyle(0x666666);
  gfx.fillCircle(8, 7, 4);
  gfx.fillCircle(8, 23, 4);
  gfx.fillCircle(56, 7, 4);
  gfx.fillCircle(56, 23, 4);

  // Rim spokes (cross pattern)
  gfx.fillStyle(0x888888);
  gfx.fillRect(7, 3, 2, 8);
  gfx.fillRect(4, 6, 8, 2);
  gfx.fillRect(7, 19, 2, 8);
  gfx.fillRect(4, 22, 8, 2);
  gfx.fillRect(55, 3, 2, 8);
  gfx.fillRect(52, 6, 8, 2);
  gfx.fillRect(55, 19, 2, 8);
  gfx.fillRect(52, 22, 8, 2);

  // Rim center hub
  gfx.fillStyle(0xbbbbbb);
  gfx.fillCircle(8, 7, 1);
  gfx.fillCircle(8, 23, 1);
  gfx.fillCircle(56, 7, 1);
  gfx.fillCircle(56, 23, 1);

  // Rear wing — blades first, then support
  gfx.fillStyle(accentColor);
  gfx.fillRect(2, 1, 9, 10);
  gfx.fillRect(2, 19, 9, 10);
  gfx.fillStyle(darkAccent);
  gfx.fillRect(3, 8, 6, 2);
  gfx.fillRect(3, 20, 6, 2);
  gfx.fillStyle(darkenColor(bodyColor, 0.28));
  gfx.fillRect(4, 8, 4, 14);

  // Body raised edge / 3-D shadow outline
  gfx.fillStyle(darkBody);
  gfx.fillRoundedRect(10, 6, 44, 18, 5);

  // Main body surface
  gfx.fillStyle(bodyColor);
  gfx.fillRoundedRect(12, 7, 40, 16, 4);

  // Roof convex highlight — simulates light hitting a curved surface
  gfx.fillStyle(lightBody, 0.72);
  gfx.fillEllipse(26, 15, 26, 9);

  // Side pod intakes
  gfx.fillStyle(darkBody);
  gfx.fillRect(14, 8, 15, 5);
  gfx.fillRect(14, 17, 15, 5);
  gfx.fillStyle(0x080808);
  gfx.fillRect(15, 9, 13, 3);
  gfx.fillRect(15, 18, 13, 3);

  // Cockpit
  gfx.fillStyle(0x080808);
  gfx.fillRoundedRect(24, 8, 20, 14, 4);

  // Windshield glass
  gfx.fillStyle(0x182050);
  gfx.fillRoundedRect(34, 9, 12, 12, 3);

  // Windshield double reflection
  gfx.fillStyle(0x5577bb, 0.75);
  gfx.fillRect(35, 10, 6, 4);
  gfx.fillStyle(0x99aad9, 0.45);
  gfx.fillRect(36, 15, 3, 2);

  // Driver helmet
  gfx.fillStyle(lightenColor(accentColor, 0.18));
  gfx.fillCircle(28, 15, 5);
  gfx.fillStyle(0x060606, 0.85);
  gfx.fillRect(25, 14, 7, 3);

  // Front nosecone
  gfx.fillStyle(bodyColor);
  gfx.fillRoundedRect(50, 11, 12, 8, 3);
  gfx.fillStyle(darkenColor(bodyColor, 0.18));
  gfx.fillRect(51, 14, 9, 2);

  // Front wing
  gfx.fillStyle(accentColor);
  gfx.fillRect(59, 1, 5, 28);
  gfx.fillStyle(bodyColor);
  gfx.fillRect(59, 12, 5, 6);
  gfx.fillStyle(darkAccent);
  gfx.fillRect(59, 6, 5, 2);
  gfx.fillRect(59, 22, 5, 2);

  // Exhaust pipes with heat glow
  gfx.fillStyle(0x2a2a2a);
  gfx.fillRect(11, 10, 5, 3);
  gfx.fillRect(11, 17, 5, 3);
  gfx.fillStyle(0x553322);
  gfx.fillRect(12, 10, 2, 3);
  gfx.fillRect(12, 17, 2, 3);

  // Left body edge highlight (light from above-left)
  gfx.fillStyle(0xffffff, 0.14);
  gfx.fillRect(12, 7, 1, 16);

  // Right body edge shadow
  gfx.fillStyle(0x000000, 0.18);
  gfx.fillRect(51, 7, 1, 16);

  gfx.generateTexture(key, W, H);
  gfx.destroy();
};

const generateAsphaltTexture = (scene: Phaser.Scene): void => {
  const SIZE = 256;
  const gfx = scene.add.graphics();

  // Base asphalt
  gfx.fillStyle(0x222222);
  gfx.fillRect(0, 0, SIZE, SIZE);

  // Fine aggregate speckles
  const SPECKLE_COUNT = 4500;
  for (let index = 0; index < SPECKLE_COUNT; index++) {
    const px = Math.random() * SIZE;
    const py = Math.random() * SIZE;
    const sz = Math.random() * 1.5 + 0.4;
    const bright = Math.floor(Math.random() * 65 + 35);
    gfx.fillStyle((bright << 16) | (bright << 8) | bright);
    gfx.fillRect(px, py, sz, sz);
  }

  // Coarser stones
  const STONE_COUNT = 700;
  for (let index = 0; index < STONE_COUNT; index++) {
    const px = Math.random() * SIZE;
    const py = Math.random() * SIZE;
    const sw = Math.random() * 2.5 + 1;
    const sh = Math.random() * 1.5 + 0.8;
    const bright = Math.floor(Math.random() * 40 + 55);
    gfx.fillStyle((bright << 16) | (bright << 8) | bright, 0.7);
    gfx.fillEllipse(px, py, sw, sh);
  }

  // Dark wear/oil patches
  const PATCH_COUNT = 18;
  for (let index = 0; index < PATCH_COUNT; index++) {
    const px = Math.random() * SIZE;
    const py = Math.random() * SIZE;
    const pw = Math.random() * 35 + 12;
    const ph = Math.random() * 18 + 6;
    gfx.fillStyle(0x0a0a0a, Math.random() * 0.22 + 0.05);
    gfx.fillEllipse(px, py, pw, ph);
  }

  gfx.generateTexture('asphalt', SIZE, SIZE);
  gfx.destroy();
};

const drawExhaustParticle = (scene: Phaser.Scene): void => {
  const gfx = scene.add.graphics();
  gfx.fillStyle(0xff7700);
  gfx.fillCircle(8, 8, 8);
  gfx.fillStyle(0xffcc44);
  gfx.fillCircle(8, 8, 4);
  gfx.fillStyle(0xffffff, 0.5);
  gfx.fillCircle(7, 7, 2);
  gfx.generateTexture('exhaust_particle', 16, 16);
  gfx.destroy();
};

const drawSmokeParticle = (scene: Phaser.Scene): void => {
  const gfx = scene.add.graphics();
  gfx.fillStyle(0xaaaaaa, 0.85);
  gfx.fillCircle(12, 12, 12);
  gfx.fillStyle(0xcccccc, 0.5);
  gfx.fillCircle(10, 10, 7);
  gfx.generateTexture('smoke_particle', 24, 24);
  gfx.destroy();
};

const drawSkidParticle = (scene: Phaser.Scene): void => {
  const gfx = scene.add.graphics();
  gfx.fillStyle(0x111111, 0.8);
  gfx.fillEllipse(6, 3, 12, 6);
  gfx.generateTexture('skid_particle', 12, 6);
  gfx.destroy();
};

export class PreloadScene extends Phaser.Scene {
  private loadingText!: Phaser.GameObjects.Text;
  private progressBar!: Phaser.GameObjects.Graphics;

  public constructor() {
    super({ key: 'PreloadScene' });
  }

  public preload(): void {
    this.createLoadingScreen();
  }

  public create(): void {
    this.loadingText.setText('Building track...');
    generateAsphaltTexture(this);

    this.loadingText.setText('Painting cars...');
    drawCarTexture(this, 'car_red', 0xcc1111, 0xff6600);
    drawCarTexture(this, 'car_blue', 0x1155cc, 0x00aaff);
    drawCarTexture(this, 'car_green', 0x117733, 0x44ff88);
    drawCarTexture(this, 'car_yellow', 0xcc8800, 0xffdd00);
    drawCarTexture(this, 'car_purple', 0x7711cc, 0xee44ff);

    this.loadingText.setText('Generating effects...');
    drawExhaustParticle(this);
    drawSmokeParticle(this);
    drawSkidParticle(this);

    const cx2 = this.cameras.main.width / 2;
    const cy2 = this.cameras.main.height / 2;
    this.progressBar.clear();
    this.progressBar.fillStyle(0x00ff88);
    this.progressBar.fillRect(cx2 - 200, cy2 - 5, 400, 10);
    this.loadingText.setText('Ready!');

    this.time.delayedCall(350, (): void => {
      this.scene.start('RaceScene');
    });
  }

  private createLoadingScreen(): void {
    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height / 2;
    const bx = cx - 205;
    const by = cy - 10;

    this.cameras.main.setBackgroundColor(0x0a0a0a);

    this.add
      .text(cx, cy - 90, 'RACEGRID', {
        fontSize: '56px',
        fontFamily: 'Impact, Arial Black, sans-serif',
        color: '#ff4400',
        stroke: '#220000',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy - 36, 'MULTIPLAYER RACING', {
        fontSize: '14px',
        fontFamily: 'Arial, sans-serif',
        color: '#666666',
        letterSpacing: 4,
      })
      .setOrigin(0.5);

    const barBg = this.add.graphics();
    barBg.fillStyle(0x2a2a2a);
    barBg.fillRect(bx, by, 410, 20);
    barBg.lineStyle(1, 0x444444);
    barBg.strokeRect(bx, by, 410, 20);

    this.progressBar = this.add.graphics();
    this.progressBar.fillStyle(0xff4400);
    this.progressBar.fillRect(bx + 5, by + 5, 40, 10);

    this.loadingText = this.add
      .text(cx, cy + 56, 'Initializing...', {
        fontSize: '13px',
        fontFamily: 'Arial, sans-serif',
        color: '#555555',
      })
      .setOrigin(0.5);
  }
}
