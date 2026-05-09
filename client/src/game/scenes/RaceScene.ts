import Phaser from 'phaser';
import { Car } from '../entities/Car';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  TOTAL_LAPS,
  FINISH_LINE_X,
  FINISH_LINE_Y_MIN,
  FINISH_LINE_Y_MAX,
  PILL_LEFT_X,
  PILL_RIGHT_X,
  PILL_CENTER_Y,
  TRACK_OUTER_RADIUS,
  TRACK_INNER_RADIUS,
  MAX_SPEED,
} from '../../constants/game.constants';
import type { PlayerState, GameState } from '../../controllers/websocket.controller';

export const RACE_EVENTS = {
  HUD_UPDATE: 'hud_update',
  RACE_FINISHED: 'race_finished',
} as const;

export type HudData = {
  speed: number;
  lap: number;
  totalLaps: number;
  position: number;
  totalPlayers: number;
  raceTimeMs: number;
};

const LAP_COOLDOWN_MS = 2000;
const CAR_START_X = 950;
const CAR_START_Y = 302;
const CAR_START_ANGLE = 0;
const TRACK_MID_RADIUS = (TRACK_OUTER_RADIUS + TRACK_INNER_RADIUS) / 2;
const CURB_WIDTH = 11;
const CURB_STRIPE_W = 30;
const SEMICIRCLE_SEGMENTS = 14;
const BARRIER_COUNT_STRAIGHT = 30;
const BARRIER_COUNT_SEMI = 20;
const CAMERA_LERP = 0.06;
const CAMERA_ZOOM = 1.25;
const CAMERA_ROT_LERP = 0.1;
const SHADING_RINGS = 5;
const SHADING_WIDTH = 10;
const BOUNDARY_MARGIN = 6;

const GRASS_OUTER = 0x1a5c1a;
const GRASS_INNER = 0x226622;
const ASPHALT_FALLBACK = 0x202020;
const TRACK_BORDER = 0xffffff;
const CURB_RED = 0xdd2222;
const CURB_WHITE = 0xf0f0f0;

const REMOTE_CAR_TEXTURES = ['car_blue', 'car_green', 'car_yellow', 'car_purple'];

export class RaceScene extends Phaser.Scene {
  private localCar!: Car;
  private remoteCars: Map<string, Car> = new Map();
  private remoteCarTextureIndex: Map<string, string> = new Map();
  private carLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private localLabel!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };
  private raceTimeMs: number = 0;
  private raceFinished: boolean = false;
  private position: number = 1;
  private totalPlayers: number = 1;
  private lapCooldown: number = 0;
  private lastCrossedFinish: boolean = false;
  private countdownActive: boolean = true;
  private countdownText!: Phaser.GameObjects.Text;
  private skidRT!: Phaser.GameObjects.RenderTexture;
  private skidGfx!: Phaser.GameObjects.Graphics;
  private cameraRotation: number = 0;
  private onInputSend:
    | ((input: { up: boolean; down: boolean; left: boolean; right: boolean }) => void)
    | null = null;

  public constructor() {
    super({ key: 'RaceScene' });
  }

  public init(data: {
    onInputSend?: (input: {
      up: boolean;
      down: boolean;
      left: boolean;
      right: boolean;
    }) => void;
  }): void {
    if (data.onInputSend !== undefined) {
      this.onInputSend = data.onInputSend;
    }
  }

  public create(): void {
    this.remoteCars = new Map();
    this.remoteCarTextureIndex = new Map();
    this.carLabels = new Map();
    this.raceTimeMs = 0;
    this.raceFinished = false;
    this.position = 1;
    this.totalPlayers = 1;
    this.lapCooldown = 0;
    this.lastCrossedFinish = false;
    this.countdownActive = true;

    // ── Layer 0: outer grass ──────────────────────────────────────────────────
    this.drawGrass();

    // ── Layer 1: asphalt track surface ───────────────────────────────────────
    this.drawAsphaltTrack();

    // ── Layer 2: track edge shading (3-D depth rings) ────────────────────────
    this.drawTrackShading();

    // ── Layer 3: curbs ────────────────────────────────────────────────────────
    this.drawCurbs();

    // ── Layer 4: dashed centre line ───────────────────────────────────────────
    this.drawCentreLine();

    // ── Layer 5: inner infield grass ──────────────────────────────────────────
    this.drawInnerGrass();

    // ── Layer 6: finish line ──────────────────────────────────────────────────
    this.drawFinishLine();

    // ── Layer 7: environment decoration ──────────────────────────────────────
    this.drawTrees();
    this.drawGrandstand();
    this.drawCircuitLabel();

    // ── Layer 8: tire barriers (3-D dots) ────────────────────────────────────
    this.drawTireBarriers();

    // ── Layer 9: persistent skid-mark canvas ─────────────────────────────────
    this.skidRT = this.add.renderTexture(0, 0, GAME_WIDTH, GAME_HEIGHT).setDepth(9);
    this.skidGfx = this.add.graphics().setVisible(false);

    // ── Layer 10+: cars ───────────────────────────────────────────────────────
    this.localCar = new Car(this, CAR_START_X, CAR_START_Y, 'car_red');
    this.localCar.angle = CAR_START_ANGLE;
    this.localCar.initParticles(this);
    this.localCar.setDepth(10);

    this.localLabel = this.add
      .text(CAR_START_X, CAR_START_Y - 26, 'YOU', {
        fontSize: '10px',
        fontFamily: 'Arial Black, sans-serif',
        color: '#ff4444',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.setupCamera();
    this.setupControls();
    this.showCountdown();
  }

  public update(_time: number, delta: number): void {
    // ── GTA-style camera: always shows car pointing "up" ──────────────────────
    const targetRot = Phaser.Math.DegToRad(-this.localCar.angle - 90);
    let diff = targetRot - this.cameraRotation;
    while (diff > Math.PI) {
      diff -= 2 * Math.PI;
    }
    while (diff < -Math.PI) {
      diff += 2 * Math.PI;
    }
    this.cameraRotation += diff * CAMERA_ROT_LERP;
    this.cameras.main.setRotation(this.cameraRotation);

    // Keep countdown text upright in screen-space
    const mid = this.cameras.main.midPoint;
    this.countdownText.setPosition(mid.x, mid.y);
    this.countdownText.setRotation(-this.cameraRotation);

    if (this.countdownActive) {
      return;
    }

    if (this.raceFinished) {
      return;
    }

    const deltaSeconds = delta / 1000;
    this.raceTimeMs += delta;
    this.lapCooldown = Math.max(0, this.lapCooldown - delta);

    const up = this.cursors.up.isDown || this.wasd.up.isDown;
    const down = this.cursors.down.isDown || this.wasd.down.isDown;
    const left = this.cursors.left.isDown || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;

    this.localCar.applyInput(up, down, left, right, deltaSeconds);

    if (this.onInputSend !== null) {
      this.onInputSend({ up, down, left, right });
    }

    this.enforceBoundary();

    const hardCorner = (left || right) && Math.abs(this.localCar.speed) > 120;
    if ((this.localCar.isBraking || hardCorner) && Math.abs(this.localCar.speed) > 50) {
      this.paintSkidMark(this.localCar.x, this.localCar.y, this.localCar.angle);
    }

    this.localLabel.setPosition(this.localCar.x, this.localCar.y - 26);

    this.checkLapCompletion();

    const hudData: HudData = {
      speed: Math.round(Math.abs(this.localCar.speed) * 0.72),
      lap: this.localCar.lap,
      totalLaps: TOTAL_LAPS,
      position: this.position,
      totalPlayers: this.totalPlayers,
      raceTimeMs: this.raceTimeMs,
    };

    this.events.emit(RACE_EVENTS.HUD_UPDATE, hudData);
  }

  // ── Boundary collision (pill-shape axis-distance check) ───────────────────
  private enforceBoundary(): void {
    const car = this.localCar;
    const clampedX = Math.max(PILL_LEFT_X, Math.min(PILL_RIGHT_X, car.x));
    const dx = car.x - clampedX;
    const dy = car.y - PILL_CENTER_Y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > TRACK_OUTER_RADIUS - BOUNDARY_MARGIN) {
      if (dist === 0) {
        return;
      }
      const scale = (TRACK_OUTER_RADIUS - BOUNDARY_MARGIN) / dist;
      car.x = clampedX + dx * scale;
      car.y = PILL_CENTER_Y + dy * scale;
      car.speed *= 0.6;
    } else if (dist < TRACK_INNER_RADIUS + BOUNDARY_MARGIN) {
      if (dist === 0) {
        car.y = PILL_CENTER_Y - (TRACK_INNER_RADIUS + BOUNDARY_MARGIN);
        car.speed *= 0.6;
        return;
      }
      const scale = (TRACK_INNER_RADIUS + BOUNDARY_MARGIN) / dist;
      car.x = clampedX + dx * scale;
      car.y = PILL_CENTER_Y + dy * scale;
      car.speed *= 0.6;
    }
  }

  public applyServerState(gameState: GameState, localUserId: string): void {
    this.raceTimeMs = gameState.raceTimeMs;

    if (this.countdownActive && gameState.status === 'racing') {
      this.triggerGoAndStart();
    }

    gameState.players.forEach((playerState: PlayerState): void => {
      if (playerState.userId === localUserId) {
        this.localCar.lap = playerState.lap;
        this.position = playerState.position;
        if (playerState.lap >= TOTAL_LAPS && !this.raceFinished) {
          this.raceFinished = true;
          this.events.emit(RACE_EVENTS.RACE_FINISHED);
        }
        return;
      }

      this.updateRemoteCar(playerState);
    });

    this.totalPlayers = gameState.players.length;
  }

  public onServerCountdown(count: number): void {
    if (count <= 0) {
      return;
    }
    this.countdownText.setVisible(true);
    this.countdownText.setText(String(count));
    this.countdownText.setColor('#ffdd00');
    this.tweens.add({
      targets: this.countdownText,
      scaleX: { from: 1.5, to: 1.0 },
      scaleY: { from: 1.5, to: 1.0 },
      duration: 700,
      ease: 'Back.Out',
    });
  }

  private triggerGoAndStart(): void {
    if (!this.countdownActive) {
      return;
    }
    this.countdownActive = false;
    this.countdownText.setText('GO!');
    this.countdownText.setColor('#00ff88');
    this.tweens.add({
      targets: this.countdownText,
      scaleX: { from: 1.7, to: 1.0 },
      scaleY: { from: 1.7, to: 1.0 },
      duration: 380,
      ease: 'Back.Out',
    });
    this.time.delayedCall(700, (): void => {
      this.countdownText.setVisible(false);
    });
  }

  private updateRemoteCar(playerState: PlayerState): void {
    let car = this.remoteCars.get(playerState.userId);

    if (car === undefined) {
      let textureKey = this.remoteCarTextureIndex.get(playerState.userId);
      if (textureKey === undefined) {
        const index = this.remoteCars.size % REMOTE_CAR_TEXTURES.length;
        textureKey = REMOTE_CAR_TEXTURES[index];
        this.remoteCarTextureIndex.set(playerState.userId, textureKey);
      }
      car = new Car(this, playerState.x, playerState.y, textureKey);
      car.initParticles(this);
      car.setDepth(9);
      this.remoteCars.set(playerState.userId, car);

      const label = this.add
        .text(playerState.x, playerState.y - 26, playerState.username, {
          fontSize: '10px',
          fontFamily: 'Arial Black, sans-serif',
          color: '#66aaff',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(20);
      this.carLabels.set(playerState.userId, label);
    }

    car.x = Phaser.Math.Linear(car.x, playerState.x, 0.3);
    car.y = Phaser.Math.Linear(car.y, playerState.y, 0.3);
    car.angle = playerState.angle;
    car.speed = playerState.speed;

    const label = this.carLabels.get(playerState.userId);
    if (label !== undefined) {
      label.setPosition(car.x, car.y - 26);
    }
  }

  private checkLapCompletion(): void {
    if (this.lapCooldown > 0) {
      return;
    }

    if (this.localCar.lap >= TOTAL_LAPS) {
      return;
    }

    const nearFinishX = Math.abs(this.localCar.x - FINISH_LINE_X) < 15;
    const inFinishZoneY =
      this.localCar.y >= FINISH_LINE_Y_MIN && this.localCar.y <= FINISH_LINE_Y_MAX;
    const movingForward = this.localCar.speed > 0;
    const crossingNow = nearFinishX && inFinishZoneY && movingForward;

    if (crossingNow && !this.lastCrossedFinish) {
      this.localCar.lap += 1;
      this.lapCooldown = LAP_COOLDOWN_MS;

      if (this.localCar.lap >= TOTAL_LAPS) {
        this.localCar.finishTimeMs = this.raceTimeMs;
        this.raceFinished = true;
        this.events.emit(RACE_EVENTS.RACE_FINISHED);
      }
    }

    this.lastCrossedFinish = crossingNow;
  }

  private setupCamera(): void {
    this.cameras.main.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.cameras.main.startFollow(this.localCar, true, CAMERA_LERP, CAMERA_LERP);
    this.cameras.main.setZoom(CAMERA_ZOOM);
  }

  private setupControls(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  private showCountdown(): void {
    this.countdownText = this.add
      .text(CAR_START_X, CAR_START_Y, 'Waiting...', {
        fontSize: '52px',
        fontFamily: 'Impact, Arial Black, sans-serif',
        color: '#aaaaaa',
        stroke: '#000000',
        strokeThickness: 8,
        shadow: { offsetX: 3, offsetY: 3, color: '#000000', blur: 6, fill: true },
      })
      .setOrigin(0.5)
      .setDepth(100);

    // Client-side fallback countdown (server overrides these via onServerCountdown)
    this.time.delayedCall(800, (): void => {
      this.onServerCountdown(3);
    });
    this.time.delayedCall(1800, (): void => {
      this.onServerCountdown(2);
    });
    this.time.delayedCall(2800, (): void => {
      this.onServerCountdown(1);
    });
    this.time.delayedCall(3800, (): void => {
      this.triggerGoAndStart();
    });
  }

  // ── Track drawing ─────────────────────────────────────────────────────────

  private drawGrass(): void {
    const gfx = this.add.graphics().setDepth(0);
    gfx.fillStyle(GRASS_OUTER);
    gfx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    gfx.fillStyle(0x1e6e1e, 0.45);
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 17; col++) {
        const px = col * 100 + (row % 2) * 50;
        const py = row * 95;
        gfx.fillRect(px, py, 44, 38);
      }
    }
  }

  private drawAsphaltTrack(): void {
    const outerX = PILL_LEFT_X - TRACK_OUTER_RADIUS;
    const outerY = PILL_CENTER_Y - TRACK_OUTER_RADIUS;
    const outerW = (PILL_RIGHT_X - PILL_LEFT_X) + 2 * TRACK_OUTER_RADIUS;
    const outerH = 2 * TRACK_OUTER_RADIUS;

    if (this.textures.exists('asphalt')) {
      const maskShape = this.make.graphics({ x: 0, y: 0 }, false);
      maskShape.fillStyle(0xffffff);
      maskShape.fillRoundedRect(outerX, outerY, outerW, outerH, TRACK_OUTER_RADIUS);
      const trackMask = maskShape.createGeometryMask();

      const centerX = (PILL_LEFT_X + PILL_RIGHT_X) / 2;
      const tile = this.add.tileSprite(centerX, PILL_CENTER_Y, outerW + 4, outerH + 4, 'asphalt');
      tile.setMask(trackMask);
      tile.setDepth(1);
    } else {
      const gfx = this.add.graphics().setDepth(1);
      gfx.fillStyle(ASPHALT_FALLBACK);
      gfx.fillRoundedRect(outerX, outerY, outerW, outerH, TRACK_OUTER_RADIUS);
    }

    const borderGfx = this.add.graphics().setDepth(2);
    borderGfx.lineStyle(3, TRACK_BORDER, 1);

    const outerX2 = PILL_LEFT_X - TRACK_OUTER_RADIUS;
    const outerY2 = PILL_CENTER_Y - TRACK_OUTER_RADIUS;
    const outerW2 = (PILL_RIGHT_X - PILL_LEFT_X) + 2 * TRACK_OUTER_RADIUS;
    const outerH2 = 2 * TRACK_OUTER_RADIUS;
    borderGfx.strokeRoundedRect(outerX2, outerY2, outerW2, outerH2, TRACK_OUTER_RADIUS);

    const innerX = PILL_LEFT_X - TRACK_INNER_RADIUS;
    const innerY = PILL_CENTER_Y - TRACK_INNER_RADIUS;
    const innerW = (PILL_RIGHT_X - PILL_LEFT_X) + 2 * TRACK_INNER_RADIUS;
    const innerH = 2 * TRACK_INNER_RADIUS;
    borderGfx.strokeRoundedRect(innerX, innerY, innerW, innerH, TRACK_INNER_RADIUS);
  }

  private drawTrackShading(): void {
    const gfx = this.add.graphics().setDepth(3);

    const outerX = PILL_LEFT_X - TRACK_OUTER_RADIUS;
    const outerY = PILL_CENTER_Y - TRACK_OUTER_RADIUS;
    const outerW = (PILL_RIGHT_X - PILL_LEFT_X) + 2 * TRACK_OUTER_RADIUS;
    const outerH = 2 * TRACK_OUTER_RADIUS;

    const innerX = PILL_LEFT_X - TRACK_INNER_RADIUS;
    const innerY = PILL_CENTER_Y - TRACK_INNER_RADIUS;
    const innerW = (PILL_RIGHT_X - PILL_LEFT_X) + 2 * TRACK_INNER_RADIUS;
    const innerH = 2 * TRACK_INNER_RADIUS;

    for (let ring = 0; ring < SHADING_RINGS; ring++) {
      const alpha = (0.055 * (SHADING_RINGS - ring)) / SHADING_RINGS;
      gfx.lineStyle(SHADING_WIDTH, 0x000000, alpha);
      const shrink = ring * 3;
      gfx.strokeRoundedRect(
        outerX + shrink,
        outerY + shrink,
        outerW - shrink * 2,
        outerH - shrink * 2,
        TRACK_OUTER_RADIUS - shrink
      );
    }

    for (let ring = 0; ring < SHADING_RINGS; ring++) {
      const alpha = (0.05 * (SHADING_RINGS - ring)) / SHADING_RINGS;
      gfx.lineStyle(SHADING_WIDTH, 0x000000, alpha);
      const grow = ring * 3;
      gfx.strokeRoundedRect(
        innerX - grow,
        innerY - grow,
        innerW + grow * 2,
        innerH + grow * 2,
        TRACK_INNER_RADIUS + grow
      );
    }

    // Worn racing line at mid-track
    const midX = PILL_LEFT_X - TRACK_MID_RADIUS;
    const midY = PILL_CENTER_Y - TRACK_MID_RADIUS;
    const midW = (PILL_RIGHT_X - PILL_LEFT_X) + 2 * TRACK_MID_RADIUS;
    const midH = 2 * TRACK_MID_RADIUS;
    gfx.lineStyle(6, 0x333333, 0.35);
    gfx.strokeRoundedRect(midX, midY, midW, midH, TRACK_MID_RADIUS);
  }

  private getCurbPoints(
    cx: number,
    cy: number,
    innerR: number,
    outerR: number,
    startRad: number,
    endRad: number
  ): Phaser.Math.Vector2[] {
    const points: Phaser.Math.Vector2[] = [];
    const steps = 5;

    for (let step = 0; step <= steps; step++) {
      const a = startRad + ((endRad - startRad) * step) / steps;
      points.push(new Phaser.Math.Vector2(cx + Math.cos(a) * outerR, cy + Math.sin(a) * outerR));
    }

    for (let step = steps; step >= 0; step--) {
      const a = startRad + ((endRad - startRad) * step) / steps;
      points.push(new Phaser.Math.Vector2(cx + Math.cos(a) * innerR, cy + Math.sin(a) * innerR));
    }

    return points;
  }

  private drawCurbs(): void {
    const gfx = this.add.graphics().setDepth(4);
    const straight = PILL_RIGHT_X - PILL_LEFT_X;
    const numStripes = Math.ceil(straight / CURB_STRIPE_W);

    // Top straight curbs
    for (let i = 0; i < numStripes; i++) {
      const sx = PILL_LEFT_X + i * CURB_STRIPE_W;
      const sw = Math.min(CURB_STRIPE_W, PILL_RIGHT_X - sx);
      let outerColor: number;
      let innerColor: number;
      if (i % 2 === 0) {
        outerColor = CURB_RED;
        innerColor = CURB_WHITE;
      } else {
        outerColor = CURB_WHITE;
        innerColor = CURB_RED;
      }
      gfx.fillStyle(outerColor);
      gfx.fillRect(sx, PILL_CENTER_Y - TRACK_OUTER_RADIUS, sw, CURB_WIDTH);
      gfx.fillStyle(innerColor);
      gfx.fillRect(sx, PILL_CENTER_Y - TRACK_INNER_RADIUS - CURB_WIDTH, sw, CURB_WIDTH);
    }

    // Bottom straight curbs
    for (let i = 0; i < numStripes; i++) {
      const sx = PILL_LEFT_X + i * CURB_STRIPE_W;
      const sw = Math.min(CURB_STRIPE_W, PILL_RIGHT_X - sx);
      let outerColor: number;
      let innerColor: number;
      if (i % 2 === 0) {
        outerColor = CURB_RED;
        innerColor = CURB_WHITE;
      } else {
        outerColor = CURB_WHITE;
        innerColor = CURB_RED;
      }
      gfx.fillStyle(outerColor);
      gfx.fillRect(sx, PILL_CENTER_Y + TRACK_OUTER_RADIUS - CURB_WIDTH, sw, CURB_WIDTH);
      gfx.fillStyle(innerColor);
      gfx.fillRect(sx, PILL_CENTER_Y + TRACK_INNER_RADIUS, sw, CURB_WIDTH);
    }

    // Right semicircle curbs
    for (let i = 0; i < SEMICIRCLE_SEGMENTS; i++) {
      const startRad = -Math.PI / 2 + (i / SEMICIRCLE_SEGMENTS) * Math.PI;
      const endRad = -Math.PI / 2 + ((i + 1) / SEMICIRCLE_SEGMENTS) * Math.PI;
      let color1: number;
      let color2: number;
      if (i % 2 === 0) {
        color1 = CURB_RED;
        color2 = CURB_WHITE;
      } else {
        color1 = CURB_WHITE;
        color2 = CURB_RED;
      }
      gfx.fillStyle(color1);
      gfx.fillPoints(
        this.getCurbPoints(
          PILL_RIGHT_X,
          PILL_CENTER_Y,
          TRACK_OUTER_RADIUS - CURB_WIDTH,
          TRACK_OUTER_RADIUS,
          startRad,
          endRad
        ),
        true
      );
      gfx.fillStyle(color2);
      gfx.fillPoints(
        this.getCurbPoints(
          PILL_RIGHT_X,
          PILL_CENTER_Y,
          TRACK_INNER_RADIUS,
          TRACK_INNER_RADIUS + CURB_WIDTH,
          startRad,
          endRad
        ),
        true
      );
    }

    // Left semicircle curbs
    for (let i = 0; i < SEMICIRCLE_SEGMENTS; i++) {
      const startRad = Math.PI / 2 + (i / SEMICIRCLE_SEGMENTS) * Math.PI;
      const endRad = Math.PI / 2 + ((i + 1) / SEMICIRCLE_SEGMENTS) * Math.PI;
      let color1: number;
      let color2: number;
      if (i % 2 === 0) {
        color1 = CURB_RED;
        color2 = CURB_WHITE;
      } else {
        color1 = CURB_WHITE;
        color2 = CURB_RED;
      }
      gfx.fillStyle(color1);
      gfx.fillPoints(
        this.getCurbPoints(
          PILL_LEFT_X,
          PILL_CENTER_Y,
          TRACK_OUTER_RADIUS - CURB_WIDTH,
          TRACK_OUTER_RADIUS,
          startRad,
          endRad
        ),
        true
      );
      gfx.fillStyle(color2);
      gfx.fillPoints(
        this.getCurbPoints(
          PILL_LEFT_X,
          PILL_CENTER_Y,
          TRACK_INNER_RADIUS,
          TRACK_INNER_RADIUS + CURB_WIDTH,
          startRad,
          endRad
        ),
        true
      );
    }
  }

  private drawCentreLine(): void {
    const gfx = this.add.graphics().setDepth(5);
    const midX = PILL_LEFT_X - TRACK_MID_RADIUS;
    const midY = PILL_CENTER_Y - TRACK_MID_RADIUS;
    const midW = (PILL_RIGHT_X - PILL_LEFT_X) + 2 * TRACK_MID_RADIUS;
    const midH = 2 * TRACK_MID_RADIUS;
    gfx.lineStyle(2, 0xffffff, 0.4);
    gfx.strokeRoundedRect(midX, midY, midW, midH, TRACK_MID_RADIUS);
  }

  private drawInnerGrass(): void {
    const gfx = this.add.graphics().setDepth(6);
    const innerX = PILL_LEFT_X - TRACK_INNER_RADIUS;
    const innerY = PILL_CENTER_Y - TRACK_INNER_RADIUS;
    const innerW = (PILL_RIGHT_X - PILL_LEFT_X) + 2 * TRACK_INNER_RADIUS;
    const innerH = 2 * TRACK_INNER_RADIUS;

    gfx.fillStyle(GRASS_INNER);
    gfx.fillRoundedRect(innerX, innerY, innerW, innerH, TRACK_INNER_RADIUS);

    // Variation patches
    gfx.fillStyle(0x257525, 0.45);
    const cx = (PILL_LEFT_X + PILL_RIGHT_X) / 2;
    gfx.fillRect(cx - 200, PILL_CENTER_Y - 30, 160, 60);
    gfx.fillRect(cx + 80, PILL_CENTER_Y - 20, 100, 40);
    gfx.fillRect(cx - 60, PILL_CENTER_Y + 18, 120, 32);
  }

  private drawFinishLine(): void {
    const gfx = this.add.graphics().setDepth(7);
    const top = FINISH_LINE_Y_MIN;
    const bottom = FINISH_LINE_Y_MAX;
    const stripeH = 10;
    const stripeW = 9;
    const stripeCount = Math.floor((bottom - top) / stripeH);

    for (let i = 0; i < stripeCount; i++) {
      let color: number;
      if (i % 2 === 0) {
        color = 0xffffff;
      } else {
        color = 0x111111;
      }
      gfx.fillStyle(color);
      gfx.fillRect(FINISH_LINE_X - stripeW / 2, top + i * stripeH, stripeW, stripeH);
    }

    gfx.fillStyle(0xbbbbbb);
    gfx.fillRect(FINISH_LINE_X + 6, top - 6, 3, 14);
    gfx.fillStyle(0xff0000);
    gfx.fillRect(FINISH_LINE_X + 6, top - 6, 3, 7);
  }

  private drawTireBarriers(): void {
    const gfx = this.add.graphics().setDepth(8);

    const drawTire = (tx: number, ty: number, isOuter: boolean, altColor: boolean): void => {
      let baseColor: number;
      if (isOuter) {
        baseColor = 0x181818;
      } else if (altColor) {
        baseColor = 0xcc1111;
      } else {
        baseColor = 0xdddddd;
      }
      gfx.fillStyle(baseColor);
      gfx.fillCircle(tx, ty, 5);
      gfx.fillStyle(0x555555, 0.65);
      gfx.fillCircle(tx - 1.5, ty - 1.5, 2.5);
      gfx.fillStyle(0x000000, 0.5);
      gfx.fillCircle(tx + 1.2, ty + 1.2, 2);
    };

    // Top and bottom straight barriers
    for (let i = 0; i < BARRIER_COUNT_STRAIGHT; i++) {
      const tx = PILL_LEFT_X + (i / BARRIER_COUNT_STRAIGHT) * (PILL_RIGHT_X - PILL_LEFT_X);
      drawTire(tx, PILL_CENTER_Y - TRACK_OUTER_RADIUS, true, false);
      drawTire(tx, PILL_CENTER_Y - TRACK_INNER_RADIUS, false, i % 8 < 4);
      drawTire(tx, PILL_CENTER_Y + TRACK_OUTER_RADIUS, true, false);
      drawTire(tx, PILL_CENTER_Y + TRACK_INNER_RADIUS, false, i % 8 >= 4);
    }

    // Right semicircle barriers
    for (let i = 0; i < BARRIER_COUNT_SEMI; i++) {
      const angle = -Math.PI / 2 + (i / BARRIER_COUNT_SEMI) * Math.PI;
      drawTire(
        PILL_RIGHT_X + Math.cos(angle) * TRACK_OUTER_RADIUS,
        PILL_CENTER_Y + Math.sin(angle) * TRACK_OUTER_RADIUS,
        true,
        false
      );
      drawTire(
        PILL_RIGHT_X + Math.cos(angle) * TRACK_INNER_RADIUS,
        PILL_CENTER_Y + Math.sin(angle) * TRACK_INNER_RADIUS,
        false,
        i % 8 < 4
      );
    }

    // Left semicircle barriers
    for (let i = 0; i < BARRIER_COUNT_SEMI; i++) {
      const angle = Math.PI / 2 + (i / BARRIER_COUNT_SEMI) * Math.PI;
      drawTire(
        PILL_LEFT_X + Math.cos(angle) * TRACK_OUTER_RADIUS,
        PILL_CENTER_Y + Math.sin(angle) * TRACK_OUTER_RADIUS,
        true,
        false
      );
      drawTire(
        PILL_LEFT_X + Math.cos(angle) * TRACK_INNER_RADIUS,
        PILL_CENTER_Y + Math.sin(angle) * TRACK_INNER_RADIUS,
        false,
        i % 8 < 4
      );
    }
  }

  private drawTrees(): void {
    const gfx = this.add.graphics().setDepth(7);
    const positions = [
      { x: 80, y: 200 },
      { x: 80, y: 680 },
      { x: 1500, y: 200 },
      { x: 1500, y: 680 },
      { x: 250, y: 100 },
      { x: 600, y: 80 },
      { x: 1000, y: 90 },
      { x: 1350, y: 100 },
      { x: 250, y: 800 },
      { x: 600, y: 820 },
      { x: 1000, y: 810 },
      { x: 1350, y: 800 },
      // Inside infield
      { x: 620, y: 435 },
      { x: 800, y: 460 },
      { x: 980, y: 430 },
    ];

    positions.forEach((pos): void => {
      gfx.fillStyle(0x4a2e10);
      gfx.fillRect(pos.x - 3, pos.y, 6, 11);
      gfx.fillStyle(0x0a1f0a, 0.4);
      gfx.fillEllipse(pos.x + 2, pos.y + 2, 28, 12);
      gfx.fillStyle(0x1a6a1a);
      gfx.fillCircle(pos.x, pos.y - 7, 14);
      gfx.fillStyle(0x2d9a2d, 0.65);
      gfx.fillCircle(pos.x - 4, pos.y - 10, 8);
      gfx.fillStyle(0x44bb44, 0.3);
      gfx.fillCircle(pos.x - 6, pos.y - 11, 4);
    });
  }

  private drawGrandstand(): void {
    const gfx = this.add.graphics().setDepth(7);
    const sx = FINISH_LINE_X - 68;
    const sy = PILL_CENTER_Y - TRACK_OUTER_RADIUS - 96;
    const sw = 136;
    const sh = 82;

    gfx.fillStyle(0x443366);
    gfx.fillRect(sx - 3, sy - 12, sw + 6, sh + 4);
    gfx.fillStyle(0x8888aa);
    gfx.fillRect(sx, sy, sw, sh);
    gfx.fillStyle(0x5544aa);
    gfx.fillRect(sx - 6, sy - 10, sw + 12, 10);
    gfx.fillStyle(0x000000, 0.25);
    gfx.fillRect(sx - 6, sy, sw + 12, 5);

    const rowColors = [0xff4444, 0x4466ff, 0xffff44, 0x44ff66, 0xff8844];
    for (let row = 0; row < 5; row++) {
      gfx.fillStyle(rowColors[row]);
      for (let seat = 0; seat < 13; seat++) {
        gfx.fillRect(sx + 6 + seat * 9, sy + 10 + row * 14, 7, 10);
        gfx.fillStyle(0xffffff, 0.15);
        gfx.fillRect(sx + 7 + seat * 9, sy + 10 + row * 14, 3, 3);
        gfx.fillStyle(rowColors[row]);
      }
    }
  }

  private drawCircuitLabel(): void {
    const cx = (PILL_LEFT_X + PILL_RIGHT_X) / 2;
    this.add
      .text(cx, PILL_CENTER_Y + 12, 'RACEGRID', {
        fontSize: '24px',
        fontFamily: 'Impact, sans-serif',
        color: '#2a7a2a',
        stroke: '#143014',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setAlpha(0.65)
      .setDepth(7);

    this.add
      .text(cx, PILL_CENTER_Y + 42, 'GRAND PRIX CIRCUIT', {
        fontSize: '12px',
        fontFamily: 'Arial, sans-serif',
        color: '#1a5a1a',
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setAlpha(0.55)
      .setDepth(7);
  }

  private paintSkidMark(x: number, y: number, angleDeg: number): void {
    this.skidGfx.clear();
    this.skidGfx.fillStyle(0x0a0a0a, 0.55);
    const rad = Phaser.Math.DegToRad(angleDeg + 90);
    const hw = 4;
    this.skidGfx.fillRect(x + Math.cos(rad) * hw - 2, y + Math.sin(rad) * hw - 2, 4, 4);
    this.skidGfx.fillRect(x - Math.cos(rad) * hw - 2, y - Math.sin(rad) * hw - 2, 4, 4);
    this.skidRT.draw(this.skidGfx);
  }

  public getSpeedRatio(): number {
    return Math.abs(this.localCar.speed) / MAX_SPEED;
  }
}
