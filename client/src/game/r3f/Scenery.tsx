import { useMemo } from 'react';
import * as THREE from 'three';
import { ROAD_WIDTH, TRACK_LENGTH, TOTAL_LAPS } from '../../constants/game.constants';

const TOTAL_LENGTH = TRACK_LENGTH * TOTAL_LAPS;
const TREE_SPACING = 26;
const CITY_NEAR = ROAD_WIDTH / 2 + 28;   // buildings start here (x offset from road centre)
const CITY_FAR  = CITY_NEAR + 55;         // skyline layer further back

// ─── Geometry helpers ──────────────────────────────────────────────────────

type TreeData = { x: number; z: number; trunkH: number; canopyR: number; variant: number };

const buildTrees = (): TreeData[] => {
  const trees: TreeData[] = [];
  const count = Math.ceil(TOTAL_LENGTH / TREE_SPACING);
  for (let i = 0; i < count; i++) {
    const z = i * TREE_SPACING + TREE_SPACING / 2;
    // Deterministic pseudo-random using i
    const rA = ((i * 6271 + 13) % 1000) / 1000;
    const rB = ((i * 3571 + 91) % 1000) / 1000;
    const rC = ((i * 4973 + 37) % 1000) / 1000;
    const rD = ((i * 2039 + 57) % 1000) / 1000;

    trees.push({ x: -(ROAD_WIDTH / 2 + 3 + rA * 16), z, trunkH: 3 + rB * 5, canopyR: 1.8 + rC * 2, variant: i % 4 });
    trees.push({ x:  ROAD_WIDTH / 2 + 3 + rD * 16,   z, trunkH: 3 + rA * 5, canopyR: 1.8 + rB * 2, variant: (i + 2) % 4 });

    if (i % 4 === 0) {
      const rE = ((i * 7919 + 23) % 1000) / 1000;
      const rF = ((i * 5381 + 17) % 1000) / 1000;
      trees.push({ x: -(ROAD_WIDTH / 2 + 22 + rE * 28), z: z + 13, trunkH: 5 + rF * 8, canopyR: 2.5 + rE * 3, variant: 3 });
      trees.push({ x:  ROAD_WIDTH / 2 + 22 + rF * 28,   z: z + 13, trunkH: 5 + rE * 8, canopyR: 2.5 + rF * 3, variant: 3 });
    }
  }
  return trees;
};

// Armco barrier posts every 8 units
const buildBarrierPosts = (): { side: -1 | 1; z: number }[] => {
  const posts: { side: -1 | 1; z: number }[] = [];
  const n = Math.ceil(TOTAL_LENGTH / 8);
  for (let i = 0; i < n; i++) {
    posts.push({ side: -1, z: i * 8 + 4 });
    posts.push({ side:  1, z: i * 8 + 4 });
  }
  return posts;
};

// Sponsor billboards every 350 units, alternating sides
const BILLBOARD_SPECS = [
  { color: '#cc0000', accent: '#ffdd00', label: 'RACEGRID' },
  { color: '#003399', accent: '#ff8800', label: 'TURBO'    },
  { color: '#006600', accent: '#ffffff', label: 'SPEEDCO'  },
  { color: '#660066', accent: '#00ffff', label: 'APEX'     },
  { color: '#331100', accent: '#ffaa00', label: 'PITLANE'  },
];

const buildBillboards = (): { x: number; z: number; spec: typeof BILLBOARD_SPECS[0] }[] => {
  const boards: { x: number; z: number; spec: typeof BILLBOARD_SPECS[0] }[] = [];
  let dist = 150;
  let idx = 0;
  while (dist < TOTAL_LENGTH - 200) {
    const side = idx % 2 === 0 ? -1 : 1;
    boards.push({ x: side * (ROAD_WIDTH / 2 + 14), z: dist, spec: BILLBOARD_SPECS[idx % BILLBOARD_SPECS.length] });
    dist += 320 + (idx * 37) % 80;
    idx += 1;
  }
  return boards;
};

const MOUNTAIN_PEAKS: { x: number; h: number; w: number; snow: boolean }[] = Array.from(
  { length: 30 }, (_, i) => {
    const right = i % 2 === 1;
    const baseX = right ? 100 + ((i * 3791) % 80) : -100 - ((i * 4673) % 80);
    return { x: baseX, h: 35 + ((i * 6271) % 55), w: 32 + ((i * 5381) % 45), snow: i % 3 === 0 };
  }
);

// ─── City buildings ────────────────────────────────────────────────────────

type BuildingData = {
  x: number; z: number; w: number; d: number; h: number;
  color: string; windowColor: string; roofFlat: boolean; side: -1 | 1;
};

const BLDG_COLORS   = ['#2c3a4a','#374555','#243040','#2a3545','#1e2d3c','#334258','#293848'];
const WINDOW_COLORS = ['#ffe89a','#a8d4ff','#ffffff','#ffcc66','#cceeff'];

const buildCityBlocks = (): BuildingData[] => {
  const buildings: BuildingData[] = [];
  // Place buildings roughly every 80 units on each side, staggered in depth
  const SPACING = 80;
  const count = Math.ceil(TOTAL_LENGTH / SPACING);
  for (let i = 0; i < count; i++) {
    const z = i * SPACING + 20;
    const rA = ((i * 5381 + 19) % 1000) / 1000;
    const rB = ((i * 3571 + 41) % 1000) / 1000;
    const rC = ((i * 7919 + 67) % 1000) / 1000;
    const rD = ((i * 2039 + 83) % 1000) / 1000;
    const rE = ((i * 6173 + 31) % 1000) / 1000;

    // Near-row building (left side)
    const xNearL = -(CITY_NEAR + rA * 16);
    buildings.push({
      x: xNearL, z: z + rB * 30,
      w: 5 + rC * 7, d: 5 + rD * 5, h: 7 + rA * 22,
      color: BLDG_COLORS[i % BLDG_COLORS.length],
      windowColor: WINDOW_COLORS[i % WINDOW_COLORS.length],
      roofFlat: rE > 0.4,
      side: -1,
    });

    // Near-row building (right side)
    const xNearR = CITY_NEAR + rB * 16;
    buildings.push({
      x: xNearR, z: z + rA * 30,
      w: 5 + rD * 7, d: 5 + rC * 5, h: 7 + rB * 22,
      color: BLDG_COLORS[(i + 3) % BLDG_COLORS.length],
      windowColor: WINDOW_COLORS[(i + 2) % WINDOW_COLORS.length],
      roofFlat: rA > 0.4,
      side: 1,
    });

    // Back-row taller skyscrapers every 2nd slot
    if (i % 2 === 0) {
      buildings.push({
        x: -(CITY_FAR + rC * 20), z: z + rD * 60,
        w: 8 + rE * 10, d: 7 + rB * 8, h: 28 + rC * 40,
        color: BLDG_COLORS[(i + 1) % BLDG_COLORS.length],
        windowColor: WINDOW_COLORS[(i + 1) % WINDOW_COLORS.length],
        roofFlat: true,
        side: -1,
      });
      buildings.push({
        x: CITY_FAR + rD * 20, z: z + rE * 60,
        w: 8 + rA * 10, d: 7 + rC * 8, h: 28 + rD * 40,
        color: BLDG_COLORS[(i + 5) % BLDG_COLORS.length],
        windowColor: WINDOW_COLORS[(i + 3) % WINDOW_COLORS.length],
        roofFlat: true,
        side: 1,
      });
    }
  }
  return buildings;
};

// Pre-build static data
const TREES = buildTrees();
const BARRIER_POSTS = buildBarrierPosts();
const BILLBOARDS = buildBillboards();
const BUILDINGS = buildCityBlocks();

// Materials
const TRUNK_MAT   = new THREE.MeshStandardMaterial({ color: '#3a2008', roughness: 0.95 });
const BARRIER_MAT = new THREE.MeshStandardMaterial({ color: '#c8c8c8', metalness: 0.7, roughness: 0.3 });
const POST_MAT    = new THREE.MeshStandardMaterial({ color: '#aaaaaa', metalness: 0.6, roughness: 0.4 });
const MOUNTAIN_MAT= new THREE.MeshStandardMaterial({ color: '#3a5a38', roughness: 0.95 });
const SNOW_MAT    = new THREE.MeshStandardMaterial({ color: '#e8eef4', roughness: 0.8 });

// Building materials cache — one per unique color string
const bldgMatCache = new Map<string, THREE.MeshStandardMaterial>();
const getBldgMat = (color: string): THREE.MeshStandardMaterial => {
  let m = bldgMatCache.get(color);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 }); bldgMatCache.set(color, m); }
  return m;
};
const winMatCache = new Map<string, THREE.MeshStandardMaterial>();
const getWinMat = (color: string): THREE.MeshStandardMaterial => {
  let m = winMatCache.get(color);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.3 }); winMatCache.set(color, m); }
  return m;
};
const ROOF_MAT = new THREE.MeshStandardMaterial({ color: '#1a2535', roughness: 0.9 });
const ROOF_EDGE_MAT = new THREE.MeshStandardMaterial({ color: '#4a6080', roughness: 0.7, metalness: 0.3 });

const CANOPY_MATS = [
  new THREE.MeshStandardMaterial({ color: '#1a6a1a', roughness: 0.9 }),
  new THREE.MeshStandardMaterial({ color: '#235522', roughness: 0.9 }),
  new THREE.MeshStandardMaterial({ color: '#2a7a2a', roughness: 0.9 }),
  new THREE.MeshStandardMaterial({ color: '#144414', roughness: 0.9 }),
];

// ─── City building mesh ────────────────────────────────────────────────────

const CityBuilding = ({ b }: { b: BuildingData }): React.ReactElement => {
  const wallMat   = getBldgMat(b.color);
  const windowMat = getWinMat(b.windowColor);

  // Window grid on front face (facing road)
  const winRows = Math.max(2, Math.floor(b.h / 4));
  const winCols = Math.max(1, Math.floor(b.w / 3));
  const winW = b.w / (winCols * 2 + 1);
  const winH = b.h / (winRows * 2 + 1);
  const windows: React.ReactElement[] = [];
  for (let row = 0; row < winRows; row++) {
    for (let col = 0; col < winCols; col++) {
      const wx = -b.w / 2 + winW + col * (2 * winW);
      const wy = winH + row * (2 * winH);
      // Only show some windows lit (deterministic)
      if ((row * winCols + col) % 3 !== 1) {
        windows.push(
          <mesh key={`${row}-${col}`} material={windowMat}
            position={[wx, wy, b.d / 2 + 0.06]}>
            <boxGeometry args={[winW * 0.65, winH * 0.65, 0.04]} />
          </mesh>
        );
      }
    }
  }

  return (
    <group position={[b.x, 0, b.z]}>
      {/* Main body */}
      <mesh material={wallMat} position={[0, b.h / 2, 0]}>
        <boxGeometry args={[b.w, b.h, b.d]} />
      </mesh>
      {/* Roof slab */}
      <mesh material={ROOF_MAT} position={[0, b.h + 0.12, 0]}>
        <boxGeometry args={[b.w + 0.1, 0.24, b.d + 0.1]} />
      </mesh>
      {/* Roof edge trim */}
      <mesh material={ROOF_EDGE_MAT} position={[0, b.h + 0.24, 0]}>
        <boxGeometry args={[b.w + 0.3, 0.14, b.d + 0.3]} />
      </mesh>
      {/* Rooftop AC/structure cube (varies) */}
      {b.roofFlat && (
        <mesh material={getBldgMat('#1a2030')} position={[b.w * 0.2, b.h + 0.7, 0]}>
          <boxGeometry args={[b.w * 0.35, 0.9, b.d * 0.4]} />
        </mesh>
      )}
      {/* Windows facing the road */}
      {windows}
    </group>
  );
};

const CityBuildings = (): React.ReactElement => (
  <group>
    {BUILDINGS.map((b, i) => <CityBuilding key={i} b={b} />)}
  </group>
);

export const Scenery = (): React.ReactElement => {
  const trunkGeo  = useMemo(() => new THREE.CylinderGeometry(0.2, 0.32, 1, 6), []);
  const canopyGeos= useMemo(() => [
    new THREE.SphereGeometry(1, 7, 6),
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.ConeGeometry(1, 2, 6),
    new THREE.SphereGeometry(1, 5, 5),
  ], []);

  return (
    <group>
      {/* City buildings along both sides of the track */}
      <CityBuildings />

      {/* Distant mountains */}
      <Mountains />

      {/* Armco barriers — continuous beam */}
      <ArcoBarriers />

      {/* Barrier vertical posts */}
      {BARRIER_POSTS.map((p, i) => (
        <mesh key={i} material={POST_MAT} position={[p.side * (ROAD_WIDTH / 2 + 1.0), 0.55, p.z]}>
          <cylinderGeometry args={[0.07, 0.07, 1.1, 5]} />
        </mesh>
      ))}

      {/* Sponsor billboards */}
      {BILLBOARDS.map((b, i) => <Billboard key={i} {...b} />)}

      {/* Trees */}
      {TREES.map((t, i) => {
        const geo = canopyGeos[t.variant];
        const mat = CANOPY_MATS[t.variant];
        return (
          <group key={i} position={[t.x, 0, t.z]}>
            <mesh geometry={trunkGeo} material={TRUNK_MAT} scale={[1, t.trunkH, 1]} position={[0, t.trunkH / 2, 0]} />
            <mesh geometry={geo} material={mat} scale={[t.canopyR, t.canopyR, t.canopyR]} position={[0, t.trunkH + t.canopyR * 0.55, 0]} />
          </group>
        );
      })}
    </group>
  );
};

// ─── Armco crash barriers ─────────────────────────────────────────────────

const ArcoBarriers = (): React.ReactElement => {
  const beamGeo = useMemo(() => new THREE.BoxGeometry(TOTAL_LENGTH, 0.28, 0.14), []);
  const xL = -(ROAD_WIDTH / 2 + 1.0);
  const xR =   ROAD_WIDTH / 2 + 1.0;
  const y = 0.52;
  const zMid = TOTAL_LENGTH / 2;

  return (
    <group>
      {/* Left barrier — 2 rails */}
      <mesh geometry={beamGeo} material={BARRIER_MAT} position={[xL, y, zMid]} />
      <mesh geometry={beamGeo} material={BARRIER_MAT} position={[xL, y + 0.35, zMid]} />
      {/* Right barrier */}
      <mesh geometry={beamGeo} material={BARRIER_MAT} position={[xR, y, zMid]} />
      <mesh geometry={beamGeo} material={BARRIER_MAT} position={[xR, y + 0.35, zMid]} />
    </group>
  );
};

// ─── Sponsor billboard ─────────────────────────────────────────────────────

const Billboard = ({ x, z, spec }: { x: number; z: number; spec: typeof BILLBOARD_SPECS[0] }): React.ReactElement => {
  const isLeft = x < 0;
  const facingAngle = isLeft ? Math.PI / 8 : -Math.PI / 8; // Angled slightly toward road

  const bgMat    = useMemo(() => new THREE.MeshStandardMaterial({ color: spec.color,  roughness: 0.6 }), [spec]);
  const accentMat= useMemo(() => new THREE.MeshStandardMaterial({ color: spec.accent, roughness: 0.5, emissive: spec.accent, emissiveIntensity: 0.25 }), [spec]);
  const poleMat  = useMemo(() => new THREE.MeshStandardMaterial({ color: '#888888', metalness: 0.7, roughness: 0.3 }), []);

  return (
    <group position={[x, 0, z]} rotation={[0, facingAngle, 0]}>
      {/* Support pole */}
      <mesh material={poleMat} position={[0, 2.2, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 4.4, 6]} />
      </mesh>
      {/* Board background */}
      <mesh material={bgMat} position={[0, 5.2, 0]}>
        <boxGeometry args={[6.5, 2.4, 0.2]} />
      </mesh>
      {/* Accent stripe top */}
      <mesh material={accentMat} position={[0, 6.5, 0.05]}>
        <boxGeometry args={[6.5, 0.35, 0.08]} />
      </mesh>
      {/* Accent stripe bottom */}
      <mesh material={accentMat} position={[0, 3.95, 0.05]}>
        <boxGeometry args={[6.5, 0.35, 0.08]} />
      </mesh>
      {/* Three accent blocks representing brand name */}
      {[-1.8, 0, 1.8].map((bx, i) => (
        <mesh key={i} material={accentMat} position={[bx, 5.2, 0.11]}>
          <boxGeometry args={[1.4, 1.4, 0.06]} />
        </mesh>
      ))}
    </group>
  );
};

// ─── Mountains ────────────────────────────────────────────────────────────

const Mountains = (): React.ReactElement => {
  const HALF = TOTAL_LENGTH / 2;
  return (
    <group position={[0, 0, HALF]}>
      {MOUNTAIN_PEAKS.map((p, i) => (
        <group key={i}>
          {/* Main peak */}
          <mesh material={MOUNTAIN_MAT} position={[p.x, p.h / 2 - 6, 0]}>
            <coneGeometry args={[p.w / 2, p.h, 6]} />
          </mesh>
          {/* Snow cap */}
          {p.snow && (
            <mesh material={SNOW_MAT} position={[p.x, p.h - 6, 0]}>
              <coneGeometry args={[p.w / 6, p.h * 0.28, 6]} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
};
