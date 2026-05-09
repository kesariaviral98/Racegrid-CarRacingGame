import { useMemo } from 'react';
import * as THREE from 'three';
import { ROAD_WIDTH, TRACK_LENGTH, TOTAL_LAPS } from '../../constants/game.constants';

const TOTAL_LENGTH = TRACK_LENGTH * TOTAL_LAPS;
const GRASS_HALF = 120;

const buildRoadTexture = (): THREE.CanvasTexture => {
  const SIZE = 512;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    return new THREE.CanvasTexture(canvas);
  }

  // Asphalt base
  ctx.fillStyle = '#252525';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Grain noise
  for (let i = 0; i < 4000; i++) {
    const px = Math.random() * SIZE;
    const py = Math.random() * SIZE;
    const b = Math.floor(Math.random() * 50 + 22);
    ctx.fillStyle = `rgb(${b},${b},${b})`;
    ctx.fillRect(px, py, Math.random() * 2 + 0.5, Math.random() * 1.5 + 0.5);
  }

  // White left edge stripe
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(12, 0, 8, SIZE);

  // White right edge stripe
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(SIZE - 20, 0, 8, SIZE);

  // Left dashed lane line
  ctx.strokeStyle = 'rgba(220,220,220,0.65)';
  ctx.lineWidth = 5;
  ctx.setLineDash([60, 70]);
  ctx.beginPath();
  ctx.moveTo(SIZE * 0.33, 0);
  ctx.lineTo(SIZE * 0.33, SIZE);
  ctx.stroke();

  // Centre solid yellow line
  ctx.strokeStyle = 'rgba(240,210,0,0.95)';
  ctx.lineWidth = 7;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(SIZE * 0.5, 0);
  ctx.lineTo(SIZE * 0.5, SIZE);
  ctx.stroke();

  // Right dashed lane line
  ctx.strokeStyle = 'rgba(220,220,220,0.65)';
  ctx.lineWidth = 5;
  ctx.setLineDash([60, 70]);
  ctx.beginPath();
  ctx.moveTo(SIZE * 0.67, 0);
  ctx.lineTo(SIZE * 0.67, SIZE);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, TOTAL_LENGTH / 20);
  return tex;
};

export const Road = (): React.ReactElement => {
  const roadTex = useMemo((): THREE.CanvasTexture => { return buildRoadTexture(); }, []);
  const halfLen = TOTAL_LENGTH / 2;

  return (
    <group>
      {/* Asphalt road surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, halfLen]} receiveShadow>
        <planeGeometry args={[ROAD_WIDTH, TOTAL_LENGTH]} />
        <meshStandardMaterial map={roadTex} />
      </mesh>

      {/* Left grass — two-tone for depth */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-(ROAD_WIDTH / 2 + GRASS_HALF * 0.4), -0.01, halfLen]}>
        <planeGeometry args={[GRASS_HALF * 0.8, TOTAL_LENGTH]} />
        <meshStandardMaterial color="#2a6628" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-(ROAD_WIDTH / 2 + GRASS_HALF * 1.4), -0.02, halfLen]}>
        <planeGeometry args={[GRASS_HALF * 1.2, TOTAL_LENGTH]} />
        <meshStandardMaterial color="#1f4f1d" roughness={0.98} />
      </mesh>

      {/* Right grass */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ROAD_WIDTH / 2 + GRASS_HALF * 0.4, -0.01, halfLen]}>
        <planeGeometry args={[GRASS_HALF * 0.8, TOTAL_LENGTH]} />
        <meshStandardMaterial color="#2a6628" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ROAD_WIDTH / 2 + GRASS_HALF * 1.4, -0.02, halfLen]}>
        <planeGeometry args={[GRASS_HALF * 1.2, TOTAL_LENGTH]} />
        <meshStandardMaterial color="#1f4f1d" roughness={0.98} />
      </mesh>

      {/* Rumble strips — red/white alternating at road edges */}
      <RumbleStrip side={-1} />
      <RumbleStrip side={1} />

      {/* Lap markers */}
      <FinishLineBanner z={TRACK_LENGTH} />
      <FinishLineBanner z={TRACK_LENGTH * 2} />

      {/* Start arch */}
      <StartArch z={10} />

      {/* Race finish arch at the true finish line */}
      <FinishArch z={TOTAL_LENGTH} />
    </group>
  );
};

const RumbleStrip = ({ side }: { side: -1 | 1 }): React.ReactElement => {
  const COUNT = 30;
  const STRIPE_W = 1.2;
  const STRIPE_LEN = TOTAL_LENGTH / (COUNT * 2);
  const xPos = side * (ROAD_WIDTH / 2 + STRIPE_W / 2);

  const stripes: React.ReactElement[] = [];
  for (let i = 0; i < COUNT * 2; i++) {
    let color: string;
    if (i % 2 === 0) {
      color = '#cc1111';
    } else {
      color = '#eeeeee';
    }
    const z = i * STRIPE_LEN + STRIPE_LEN / 2;
    stripes.push(
      <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[xPos, 0.005, z]}>
        <planeGeometry args={[STRIPE_W, STRIPE_LEN]} />
        <meshStandardMaterial color={color} />
      </mesh>
    );
  }

  return <group>{stripes}</group>;
};

const FinishLineBanner = ({ z }: { z: number }): React.ReactElement => {
  const SQUARES = 12;
  const SQ = ROAD_WIDTH / SQUARES;
  const marks: React.ReactElement[] = [];

  for (let i = 0; i < SQUARES; i++) {
    let color: string;
    if (i % 2 === 0) {
      color = '#ffffff';
    } else {
      color = '#111111';
    }
    const x = -ROAD_WIDTH / 2 + i * SQ + SQ / 2;
    marks.push(
      <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, z]}>
        <planeGeometry args={[SQ, SQ]} />
        <meshStandardMaterial color={color} />
      </mesh>
    );
  }

  return <group>{marks}</group>;
};

const START_STREAMER_COLORS = ['#00cc44', '#ffffff', '#00cc44', '#ffffff', '#00cc44'];

const StartArch = ({ z }: { z: number }): React.ReactElement => {
  const POLE_HEIGHT = 8.5;
  const POLE_R = 0.28;
  const BANNER_W = ROAD_WIDTH + 3;
  const xOffset = ROAD_WIDTH / 2 + 0.6;

  return (
    <group position={[0, 0, z]}>
      {/* Checkered start line ground */}
      {Array.from({ length: 14 }, (_, i): React.ReactElement => {
        const col = i % 2 === 0 ? '#ffffff' : '#111111';
        const x = -(ROAD_WIDTH + 2) / 2 + i * ((ROAD_WIDTH + 2) / 14) + (ROAD_WIDTH + 2) / 28;
        return (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.014, 0]}>
            <planeGeometry args={[(ROAD_WIDTH + 2) / 14, 2]} />
            <meshStandardMaterial color={col} />
          </mesh>
        );
      })}

      {/* Left pole */}
      <mesh position={[-xOffset, POLE_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[POLE_R, POLE_R, POLE_HEIGHT, 10]} />
        <meshStandardMaterial color="#00cc44" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Right pole */}
      <mesh position={[xOffset, POLE_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[POLE_R, POLE_R, POLE_HEIGHT, 10]} />
        <meshStandardMaterial color="#00cc44" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Cross-bar */}
      <mesh position={[0, POLE_HEIGHT, 0]}>
        <boxGeometry args={[BANNER_W, 0.22, 0.22]} />
        <meshStandardMaterial color="#00cc44" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Green "START" banner */}
      <mesh position={[0, POLE_HEIGHT - 0.8, 0]}>
        <boxGeometry args={[BANNER_W, 1.4, 0.07]} />
        <meshStandardMaterial color="#00aa33" emissive="#00ee44" emissiveIntensity={0.4} />
      </mesh>

      {/* White/green alternating blocks */}
      {Array.from({ length: 7 }, (_, i): React.ReactElement => {
        const bx = -BANNER_W / 2 + i * (BANNER_W / 7) + BANNER_W / 14;
        return (
          <mesh key={i} position={[bx, POLE_HEIGHT - 0.8, 0.05]}>
            <boxGeometry args={[BANNER_W / 7 - 0.05, 1.35, 0.02]} />
            <meshStandardMaterial color={i % 2 === 0 ? '#ffffff' : '#00aa33'} />
          </mesh>
        );
      })}

      {/* Hanging streamers */}
      {START_STREAMER_COLORS.map((col, i): React.ReactElement => {
        const sx = -BANNER_W / 2 + (i + 1) * (BANNER_W / (START_STREAMER_COLORS.length + 1));
        return (
          <mesh key={i} position={[sx, POLE_HEIGHT - 2.8, 0]}>
            <boxGeometry args={[0.22, 3.2, 0.06]} />
            <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.3} transparent opacity={0.9} />
          </mesh>
        );
      })}
    </group>
  );
};

const STREAMER_COLORS = ['#ff1144', '#ffdd00', '#ff1144', '#ffdd00', '#ff1144'];

const FinishArch = ({ z }: { z: number }): React.ReactElement => {
  const POLE_HEIGHT = 8;
  const POLE_R = 0.28;
  const BANNER_W = ROAD_WIDTH + 3;
  const xOffset = ROAD_WIDTH / 2 + 0.6;
  const SQUARES = 14;
  const SQ = (ROAD_WIDTH + 2) / SQUARES;

  // Checkered ground at finish
  const ground: React.ReactElement[] = [];
  for (let i = 0; i < SQUARES; i++) {
    const col = i % 2 === 0 ? '#ffffff' : '#111111';
    const x = -(ROAD_WIDTH + 2) / 2 + i * SQ + SQ / 2;
    ground.push(
      <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.015, 0]}>
        <planeGeometry args={[SQ, SQ * 1.5]} />
        <meshStandardMaterial color={col} />
      </mesh>
    );
  }

  return (
    <group position={[0, 0, z]}>
      {ground}

      {/* Left pole */}
      <mesh position={[-xOffset, POLE_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[POLE_R, POLE_R, POLE_HEIGHT, 10]} />
        <meshStandardMaterial color="#d0d0d0" metalness={0.85} roughness={0.15} />
      </mesh>

      {/* Right pole */}
      <mesh position={[xOffset, POLE_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[POLE_R, POLE_R, POLE_HEIGHT, 10]} />
        <meshStandardMaterial color="#d0d0d0" metalness={0.85} roughness={0.15} />
      </mesh>

      {/* Horizontal cross-bar */}
      <mesh position={[0, POLE_HEIGHT, 0]}>
        <boxGeometry args={[BANNER_W, 0.22, 0.22]} />
        <meshStandardMaterial color="#d0d0d0" metalness={0.85} roughness={0.15} />
      </mesh>

      {/* Ribbon banner */}
      <mesh position={[0, POLE_HEIGHT - 0.8, 0]}>
        <boxGeometry args={[BANNER_W, 1.4, 0.07]} />
        <meshStandardMaterial color="#ff1144" emissive="#ff0033" emissiveIntensity={0.6} />
      </mesh>

      {/* "FINISH" stripe pattern — alternating blocks on the banner */}
      {Array.from({ length: 7 }, (_, i): React.ReactElement => {
        const bx = -BANNER_W / 2 + i * (BANNER_W / 7) + BANNER_W / 14;
        const col = i % 2 === 0 ? '#ffffff' : '#ff1144';
        return (
          <mesh key={i} position={[bx, POLE_HEIGHT - 0.8, 0.05]}>
            <boxGeometry args={[BANNER_W / 7 - 0.05, 1.35, 0.02]} />
            <meshStandardMaterial color={col} />
          </mesh>
        );
      })}

      {/* Hanging streamers */}
      {STREAMER_COLORS.map((col, i): React.ReactElement => {
        const sx = -BANNER_W / 2 + (i + 1) * (BANNER_W / (STREAMER_COLORS.length + 1));
        return (
          <mesh key={i} position={[sx, POLE_HEIGHT - 2.8, 0]}>
            <boxGeometry args={[0.22, 3.2, 0.06]} />
            <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.35} transparent opacity={0.92} />
          </mesh>
        );
      })}
    </group>
  );
};
