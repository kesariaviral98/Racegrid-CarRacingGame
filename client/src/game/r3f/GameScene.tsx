import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Road } from './Road';
import { Scenery } from './Scenery';
import { PlayerCarMesh, RemoteCarMesh } from './CarMesh';
import type { CoinWs, ObstacleWs } from '../../controllers/websocket.controller';
import {
  initSounds,
  setEngineSpeed,
  muteEngine,
  playFinishSound,
  playTireScreech,
  playCoinSound,
  playCrashSound,
} from '../../models/services/sound.service';
import {
  MAX_SPEED,
  ACCELERATION,
  DECELERATION,
  FRICTION,
  STEER_SPEED,
  ROAD_HALF_WIDTH,
  TRACK_LENGTH,
  TOTAL_LAPS,
} from '../../constants/game.constants';
import type { GameState } from '../../controllers/websocket.controller';

export type HudData = {
  speed: number;
  lap: number;
  totalLaps: number;
  position: number;
  totalPlayers: number;
  raceTimeMs: number;
  coinsCollected: number;
  isStunned: boolean;
  localZ: number;
  otherPlayersZ: number[];
};

type PhysicsState = {
  x: number; z: number; speed: number; steerAngle: number;
  lap: number; raceTimeMs: number; raceFinished: boolean;
  countdownActive: boolean; isBraking: boolean; prevSpeed: number;
  isStunned: boolean; soundPlayed: boolean;
};

type RemoteCar = { x: number; z: number; angle: number; speed: number; colorIndex: number };

// ─── Spinning gold coins ───────────────────────────────────────────────────

const COIN_COLOR = new THREE.Color('#ffd700');
const COIN_GLOW  = new THREE.Color('#ffee44');
const COIN_HALO  = new THREE.Color('#ff9900');

const coinMat = new THREE.MeshStandardMaterial({
  color: COIN_COLOR, emissive: COIN_GLOW, emissiveIntensity: 1.1,
  metalness: 0.98, roughness: 0.04,
});
const haloMat = new THREE.MeshStandardMaterial({
  color: COIN_HALO, emissive: COIN_HALO, emissiveIntensity: 0.6,
  transparent: true, opacity: 0.35, side: THREE.DoubleSide,
});

const COIN_BASE_Y = 1.6;

const CoinObjects = ({ coins }: { coins: CoinWs[] }): React.ReactElement => {
  const groupRef = useRef<THREE.Group>(null);
  const coinGeo  = useMemo(() => new THREE.CylinderGeometry(0.62, 0.62, 0.18, 20), []);
  const haloGeo  = useMemo(() => new THREE.RingGeometry(0.78, 1.08, 20), []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      child.rotation.y += 0.055;
      child.position.y = COIN_BASE_Y + Math.sin(t * 2.8 + i * 1.1) * 0.30;
    });
  });

  return (
    <group ref={groupRef}>
      {coins.map((c) => (
        <group key={c.id} position={[c.x, COIN_BASE_Y, c.z]}>
          {/* rotation X=90° makes the cylinder stand upright; Y-spin from useFrame creates spinning-coin look */}
          <mesh geometry={coinGeo} material={coinMat} rotation={[Math.PI / 2, 0, 0]} />
          {/* Horizontal halo stays flat on the ground plane as an aura */}
          <mesh geometry={haloGeo} material={haloMat} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} />
        </group>
      ))}
    </group>
  );
};

// ─── Obstacles ────────────────────────────────────────────────────────────

// Rock materials — varied grey/brown tones for realism
const rockMatA = new THREE.MeshStandardMaterial({ color: '#6e6660', roughness: 0.97, metalness: 0 });
const rockMatB = new THREE.MeshStandardMaterial({ color: '#595450', roughness: 0.99, metalness: 0 });
const rockMatC = new THREE.MeshStandardMaterial({ color: '#7c7268', roughness: 0.96, metalness: 0 });

// Big boulder cluster — scaled 1.9× for road presence matching the 1.5-unit hitbox
const BigRockMesh = ({ x, z, seed }: { x: number; z: number; seed: number }) => {
  const rot0 = (seed * 2.17) % (Math.PI * 2);
  const rot1 = (seed * 3.41) % (Math.PI * 2);
  return (
    <group position={[x, 0, z]} rotation={[0, rot0, 0]} scale={[1.9, 1.9, 1.9]}>
      {/* Central boulder */}
      <mesh material={rockMatA} position={[0, 0.52, 0]} rotation={[0.25 + rot1 * 0.1, rot0, 0.15]} scale={[1.0, 0.84, 0.94]}>
        <icosahedronGeometry args={[0.58, 1]} />
      </mesh>
      {/* Right cluster */}
      <mesh material={rockMatB} position={[0.58, 0.28, 0.14]} rotation={[0.6, rot1, 0.4]} scale={[0.9, 0.74, 0.84]}>
        <icosahedronGeometry args={[0.40, 1]} />
      </mesh>
      {/* Left cluster */}
      <mesh material={rockMatC} position={[-0.50, 0.22, -0.20]} rotation={[1.1, 0.4 + rot0, 0.7]} scale={[0.82, 0.68, 0.92]}>
        <icosahedronGeometry args={[0.32, 1]} />
      </mesh>
      {/* Back rock */}
      <mesh material={rockMatA} position={[0.10, 0.28, -0.54]} rotation={[rot1, 1.4, 0.5]} scale={[0.85, 0.78, 0.88]}>
        <icosahedronGeometry args={[0.34, 1]} />
      </mesh>
      {/* Front pebble */}
      <mesh material={rockMatB} position={[0.20, 0.14, 0.52]} rotation={[0.4, 2.2, 1.0]} scale={[1.1, 0.85, 0.95]}>
        <icosahedronGeometry args={[0.19, 0]} />
      </mesh>
      {/* Small scatter stones */}
      <mesh material={rockMatC} position={[-0.28, 0.10, 0.44]} rotation={[1.8, rot0, 0.3]}>
        <icosahedronGeometry args={[0.14, 0]} />
      </mesh>
      <mesh material={rockMatA} position={[0.44, 0.08, -0.28]} rotation={[rot1, 0.5, 1.2]}>
        <icosahedronGeometry args={[0.12, 0]} />
      </mesh>
    </group>
  );
};

// All obstacles render as big rocks regardless of server type
const ObstacleObjects = ({ obstacles }: { obstacles: ObstacleWs[] }) => (
  <group>
    {obstacles.map((o) => (
      <BigRockMesh key={o.id} x={o.x} z={o.z} seed={o.id} />
    ))}
  </group>
);

// ─── SceneContent (3D) ─────────────────────────────────────────────────────

interface SceneProps {
  localUserId: string;
  gameState: GameState | null;
  carColor: string;
  onInputSend: (input: { up: boolean; down: boolean; left: boolean; right: boolean }) => void;
  onHudUpdate: (data: HudData) => void;
  onRaceFinished: () => void;
  raceOver: boolean;
}

const SceneContent = ({
  localUserId, gameState, carColor, onInputSend, onHudUpdate, onRaceFinished, raceOver,
}: SceneProps): React.ReactElement => {
  const { camera } = useThree();

  const physics = useRef<PhysicsState>({
    x: 0, z: 0, speed: 0, steerAngle: 0, lap: 0,
    raceTimeMs: 0, raceFinished: false, countdownActive: true,
    isBraking: false, prevSpeed: 0, isStunned: false, soundPlayed: false,
  });

  const keys          = useRef(new Set<string>());
  const camX          = useRef(0);
  const remoteCarsRef = useRef<Map<string, RemoteCar>>(new Map());
  const screechCd     = useRef(0);
  const prevCoins     = useRef(0);
  const wasStunned    = useRef(false);
  const raceOverRef   = useRef(false);

  const [localRender, setLocalRender] = useState({ x: 0, z: 0, steerAngle: 0, isBraking: false });
  const [remoteCars, setRemoteCars]   = useState<[string, RemoteCar][]>([]);

  // Mirror raceOver prop into a ref so useFrame can read it without stale closure
  useEffect((): void => { raceOverRef.current = raceOver; }, [raceOver]);

  // Keyboard listeners
  useEffect((): (() => void) => {
    const onDown = (e: KeyboardEvent): void => { initSounds(); keys.current.add(e.code); };
    const onUp   = (e: KeyboardEvent): void => { keys.current.delete(e.code); };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup',   onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup',   onUp);
      muteEngine();
    };
  }, []);

  // Sync server state
  useEffect((): void => {
    if (gameState === null) return;
    const p = physics.current;

    if (p.countdownActive && gameState.status === 'racing') p.countdownActive = false;

    const sp = gameState.players.find((pl) => pl.userId === localUserId);
    if (sp !== undefined) {
      if (sp.lap > p.lap) p.lap = sp.lap;
      if (sp.lap >= TOTAL_LAPS && !p.raceFinished) {
        // Only trigger from server confirmation if the client car has already crossed.
        // If not yet crossed, useFrame will fire onRaceFinished at the right visual moment.
        if (p.z >= TOTAL_LAPS * TRACK_LENGTH) {
          p.raceFinished = true;
          if (!p.soundPlayed) { p.soundPlayed = true; playFinishSound(); }
          onRaceFinished();
        }
      }
      const newCoins = sp.coinsCollected ?? 0;
      if (newCoins > prevCoins.current) { playCoinSound(); prevCoins.current = newCoins; }

      // Stun sync from server
      const serverStun = (sp.stunTimeMs ?? 0) > 0;
      if (serverStun && !wasStunned.current) { playCrashSound(); }
      wasStunned.current = serverStun;
      p.isStunned = serverStun;
      if (serverStun) {
        // Only sync lateral position and speed — syncing z snaps the car backward
        // causing the crash to appear early. z is driven by client physics only.
        p.x = THREE.MathUtils.lerp(p.x, sp.x, 0.3);
        p.speed = THREE.MathUtils.lerp(p.speed, sp.speed, 0.4);
      }
    }

    // Remote cars
    const colorMap = new Map<string, number>();
    let idx = 0;
    gameState.players.forEach((pl) => {
      if (pl.userId === localUserId) return;
      const prev = remoteCarsRef.current.get(pl.userId);
      colorMap.set(pl.userId, prev !== undefined ? prev.colorIndex : idx++);
    });

    const newRemote = new Map<string, RemoteCar>();
    gameState.players.forEach((pl) => {
      if (pl.userId === localUserId) return;
      const prev = remoteCarsRef.current.get(pl.userId);
      newRemote.set(pl.userId, {
        x: THREE.MathUtils.lerp(prev?.x ?? pl.x, pl.x, 0.35),
        z: THREE.MathUtils.lerp(prev?.z ?? pl.z, pl.z, 0.35),
        angle: pl.angle, speed: pl.speed,
        colorIndex: colorMap.get(pl.userId) ?? 0,
      });
    });
    remoteCarsRef.current = newRemote;
    setRemoteCars(Array.from(newRemote.entries()));
  }, [gameState, localUserId, onRaceFinished]);

  useFrame((_, delta): void => {
    const p  = physics.current;
    const dt = Math.min(delta, 0.05);

    if (!p.countdownActive && !p.raceFinished && !raceOverRef.current) {
      if (p.isStunned) {
        // Stunned — send no input; decelerate at same rate as server so car keeps rolling
        onInputSend({ up: false, down: false, left: false, right: false });
        p.speed = Math.max(0, p.speed - DECELERATION * 1.2 * dt);
        p.steerAngle *= Math.max(0, 1 - 5 * dt);
      } else {
        const up    = keys.current.has('ArrowUp')    || keys.current.has('KeyW');
        const down  = keys.current.has('ArrowDown')  || keys.current.has('KeyS');
        const left  = keys.current.has('ArrowLeft')  || keys.current.has('KeyA');
        const right = keys.current.has('ArrowRight') || keys.current.has('KeyD');

        onInputSend({ up, down, left, right });

        if (up)        { p.speed = Math.min(MAX_SPEED, p.speed + ACCELERATION * dt); p.isBraking = false; }
        else if (down) { p.speed = Math.max(0, p.speed - DECELERATION * dt); p.isBraking = p.speed > 5; }
        else           { p.speed = Math.max(0, p.speed - FRICTION * dt); p.isBraking = false; }

        if (p.speed < p.prevSpeed * 0.45 && p.prevSpeed > 15) playCrashSound();
        p.prevSpeed = p.speed;

        const sf = Math.max(0.2, p.speed / MAX_SPEED);
        const sd = STEER_SPEED * sf * dt;
        if (left)       { p.x = Math.min(ROAD_HALF_WIDTH, p.x + sd); p.steerAngle = Math.min(p.steerAngle + 200 * dt, 30); }
        else if (right) { p.x = Math.max(-ROAD_HALF_WIDTH, p.x - sd); p.steerAngle = Math.max(p.steerAngle - 200 * dt, -30); }
        else            { p.steerAngle *= Math.max(0, 1 - 8 * dt); }

        const nextLapZ = (p.lap + 1) * TRACK_LENGTH;
        if (p.z >= nextLapZ && p.lap < TOTAL_LAPS) {
          p.lap += 1;
          if (p.lap >= TOTAL_LAPS && !p.soundPlayed) {
            p.soundPlayed = true;
            playFinishSound();
            // Trigger celebration the instant the CLIENT-predicted car crosses the finish
            // arch (z >= TOTAL_LENGTH). This fires before the server confirms, guaranteeing
            // the overlay appears AFTER the arch is crossed visually.
            onRaceFinished();
          }
        }

        setEngineSpeed(p.speed);
        screechCd.current -= dt;
        const si = p.isBraking ? p.speed / MAX_SPEED : (Math.abs(p.steerAngle) / 30) * (p.speed / MAX_SPEED);
        if (si > 0.5 && screechCd.current <= 0) { playTireScreech(si); screechCd.current = 0.15; }
      }

      p.z += p.speed * dt;
      p.raceTimeMs += delta * 1000;
    }

    // Camera
    const targetCamX = p.x * 0.45;
    camX.current += (targetCamX - camX.current) * 0.07;
    camera.position.set(camX.current, 2.4, p.z - 7);
    (camera as THREE.PerspectiveCamera).lookAt(new THREE.Vector3(p.x * 0.2, 0.4, p.z + 90));

    if (!p.raceFinished) {
      const lp = gameState?.players.find((pl) => pl.userId === localUserId);
      onHudUpdate({
        speed: Math.round(p.speed * 2.7),
        lap: Math.min(p.lap, TOTAL_LAPS),
        totalLaps: TOTAL_LAPS,
        position: lp?.position ?? 1,
        totalPlayers: gameState?.players.length ?? 1,
        raceTimeMs: p.raceTimeMs,
        coinsCollected: lp?.coinsCollected ?? 0,
        isStunned: p.isStunned,
        localZ: p.z,
        otherPlayersZ: gameState?.players
          .filter((pl) => pl.userId !== localUserId)
          .map((pl) => pl.z) ?? [],
      });
      setLocalRender({ x: p.x, z: p.z, steerAngle: p.steerAngle, isBraking: p.isBraking });
    }
  });

  return (
    <>
      {/* Deep racing sky — rich midday blue */}
      <color attach="background" args={['#1a3a6e']} />
      <fog attach="fog" args={['#4a7ab8', 120, 500]} />

      {/* Cinematic 4-point lighting */}
      <ambientLight intensity={0.3} color="#c8d8f0" />
      {/* Sun — harsh midday from upper-right */}
      <directionalLight position={[22, 45, -30]} intensity={2.4} castShadow color="#fff4c0"
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-near={1} shadow-camera-far={600}
        shadow-camera-left={-60} shadow-camera-right={60}
        shadow-camera-top={60} shadow-camera-bottom={-60} />
      {/* Cool sky fill from left */}
      <directionalLight position={[-20, 25, 20]} intensity={0.55} color="#90b8ff" />
      {/* Warm asphalt bounce */}
      <directionalLight position={[0, -8, 10]} intensity={0.2} color="#d4a060" />
      {/* Sky/ground hemisphere */}
      <hemisphereLight args={['#5585cc', '#2a5a18', 0.5]} />

      <Road />
      <Scenery />
      <CoinObjects   coins={gameState?.coins ?? []} />
      <ObstacleObjects obstacles={gameState?.obstacles ?? []} />

      <PlayerCarMesh
        x={localRender.x} z={localRender.z}
        steerAngle={localRender.steerAngle} isBraking={localRender.isBraking}
        carColor={carColor}
      />

      {remoteCars.map(([uid, rc]) => (
        <RemoteCarMesh key={uid} x={rc.x} z={rc.z} angle={rc.angle} colorIndex={rc.colorIndex} />
      ))}
    </>
  );
};

// ─── Outer shell (Canvas + overlays) ─────────────────────────────────────

interface GameSceneProps extends SceneProps { countdownLabel?: string; }

export const GameScene = ({ ...rest }: GameSceneProps): React.ReactElement => {
  return (
    <div className="relative w-full h-full">
      <Canvas
        camera={{ position: [0, 2.4, -7], fov: 68 }}
        shadows
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.25,
          powerPreference: 'high-performance',
        }}
        dpr={[1, 1.5]}
      >
        <SceneContent {...rest} />
      </Canvas>

      {/* Countdown is rendered by TrafficLight in GamePage — nothing here */}
    </div>
  );
};
