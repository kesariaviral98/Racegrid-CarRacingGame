import Phaser from 'phaser';
import {
  MAX_SPEED,
  ACCELERATION,
  DECELERATION,
  FRICTION,
  ROTATION_SPEED,
} from '../../constants/game.constants';

const EXHAUST_REAR_OFFSET = 30;
const EXHAUST_SPEED_THRESHOLD = 35;
const SMOKE_BRAKING_SPEED = 55;

export class Car extends Phaser.GameObjects.Container {
  public speed: number = 0;
  public lap: number = 0;
  public finishTimeMs: number | null = null;
  public isBraking: boolean = false;

  private readonly textureKey: string;
  private exhaustEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private smokeEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  public constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    textureKey: string
  ) {
    super(scene, x, y);
    this.textureKey = textureKey;

    // Ground shadow (offset slightly for perspective depth)
    const shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.38);
    shadow.fillEllipse(4, 8, 58, 16);
    this.add(shadow);

    const sprite = scene.add.image(0, 0, textureKey);
    sprite.setOrigin(0.5, 0.5);
    this.add(sprite);

    scene.add.existing(this);
  }

  public initParticles(scene: Phaser.Scene): void {
    this.exhaustEmitter = scene.add.particles(this.x, this.y, 'exhaust_particle', {
      speed: { min: 25, max: 70 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.55, end: 0 },
      alpha: { start: 1.0, end: 0 },
      lifespan: { min: 120, max: 300 },
      frequency: 22,
      quantity: 2,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.exhaustEmitter.stop();

    this.smokeEmitter = scene.add.particles(this.x, this.y, 'smoke_particle', {
      speed: { min: 6, max: 22 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.55, end: 0 },
      alpha: { start: 0.35, end: 0 },
      lifespan: { min: 600, max: 1100 },
      frequency: 45,
      quantity: 1,
    });
    this.smokeEmitter.stop();
  }

  public applyInput(
    up: boolean,
    down: boolean,
    left: boolean,
    right: boolean,
    deltaSeconds: number
  ): void {
    if (left) {
      this.angle -= ROTATION_SPEED * deltaSeconds;
    }

    if (right) {
      this.angle += ROTATION_SPEED * deltaSeconds;
    }

    if (up) {
      this.speed = Math.min(MAX_SPEED, this.speed + ACCELERATION * deltaSeconds);
      this.isBraking = false;
    } else if (down) {
      this.speed = Math.max(-MAX_SPEED / 2, this.speed - DECELERATION * deltaSeconds);
      this.isBraking = this.speed > SMOKE_BRAKING_SPEED;
    } else {
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - FRICTION * deltaSeconds);
      } else if (this.speed < 0) {
        this.speed = Math.min(0, this.speed + FRICTION * deltaSeconds);
      }
      this.isBraking = false;
    }

    const radians = Phaser.Math.DegToRad(this.angle);
    this.x += Math.cos(radians) * this.speed * deltaSeconds;
    this.y += Math.sin(radians) * this.speed * deltaSeconds;

    this.updateParticles(up, radians);
  }

  private updateParticles(accelerating: boolean, facingRadians: number): void {
    if (this.exhaustEmitter === null) {
      return;
    }

    const rearRadians = facingRadians + Math.PI;
    const exhaustX = this.x + Math.cos(rearRadians) * EXHAUST_REAR_OFFSET;
    const exhaustY = this.y + Math.sin(rearRadians) * EXHAUST_REAR_OFFSET;

    this.exhaustEmitter.setPosition(exhaustX, exhaustY);

    if (accelerating && this.speed > EXHAUST_SPEED_THRESHOLD) {
      this.exhaustEmitter.start();
    } else {
      this.exhaustEmitter.stop();
    }

    if (this.smokeEmitter !== null) {
      this.smokeEmitter.setPosition(exhaustX, exhaustY);
      if (this.isBraking) {
        this.smokeEmitter.start();
      } else {
        this.smokeEmitter.stop();
      }
    }
  }

  public getTextureKey(): string {
    return this.textureKey;
  }

  public override destroy(fromScene?: boolean): void {
    if (this.exhaustEmitter !== null) {
      this.exhaustEmitter.destroy();
      this.exhaustEmitter = null;
    }
    if (this.smokeEmitter !== null) {
      this.smokeEmitter.destroy();
      this.smokeEmitter = null;
    }
    super.destroy(fromScene);
  }
}
