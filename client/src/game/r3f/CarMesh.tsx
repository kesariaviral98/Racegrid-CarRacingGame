import { useMemo } from 'react';
import * as THREE from 'three';

const windshieldMat = new THREE.MeshStandardMaterial({ color: '#1a3a6a', transparent: true, opacity: 0.75, roughness: 0.1 });
const tyreMat = new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.9 });
const rimMat = new THREE.MeshStandardMaterial({ color: '#888888', roughness: 0.5 });
const lightsMatF = new THREE.MeshStandardMaterial({ color: '#ffeeaa', emissive: '#ffcc44', emissiveIntensity: 0.5 });
const lightsMatR = new THREE.MeshStandardMaterial({ color: '#cc0000', emissive: '#ff0000', emissiveIntensity: 0.4 });

const REMOTE_BODY_COLORS = ['#1155cc', '#117733', '#cc8800', '#7711cc'];
const remoteBodyMats = REMOTE_BODY_COLORS.map((c): THREE.MeshStandardMaterial => {
  return new THREE.MeshStandardMaterial({ color: c });
});
const remoteRoofMats = REMOTE_BODY_COLORS.map((c): THREE.MeshStandardMaterial => {
  const col = new THREE.Color(c);
  col.multiplyScalar(0.65);
  return new THREE.MeshStandardMaterial({ color: col });
});

const WHEEL_POSITIONS: [number, number, number][] = [
  [-0.88, 0, 1.15],
  [0.88, 0, 1.15],
  [-0.88, 0, -1.05],
  [0.88, 0, -1.05],
];

const CarBody = ({
  bodyMat,
  roofMat,
  isBraking,
}: {
  bodyMat: THREE.Material;
  roofMat: THREE.Material;
  isBraking: boolean;
}): React.ReactElement => {
  let brakeMat: THREE.MeshStandardMaterial;
  if (isBraking) {
    brakeMat = new THREE.MeshStandardMaterial({ color: '#ff0000', emissive: '#ff0000', emissiveIntensity: 1.2 });
  } else {
    brakeMat = lightsMatR;
  }

  return (
    <>
      {/* Main body */}
      <mesh material={bodyMat} position={[0, 0.28, 0]} castShadow>
        <boxGeometry args={[1.78, 0.46, 3.6]} />
      </mesh>

      {/* Cabin / roof */}
      <mesh material={roofMat} position={[0, 0.66, -0.18]} castShadow>
        <boxGeometry args={[1.38, 0.4, 1.85]} />
      </mesh>

      {/* Windshield */}
      <mesh material={windshieldMat} position={[0, 0.65, 0.74]} rotation={[-0.22, 0, 0]}>
        <boxGeometry args={[1.2, 0.38, 0.08]} />
      </mesh>

      {/* Rear window */}
      <mesh material={windshieldMat} position={[0, 0.65, -1.1]} rotation={[0.22, 0, 0]}>
        <boxGeometry args={[1.2, 0.34, 0.08]} />
      </mesh>

      {/* Front bumper */}
      <mesh material={bodyMat} position={[0, 0.18, 1.88]}>
        <boxGeometry args={[1.6, 0.28, 0.18]} />
      </mesh>

      {/* Rear bumper */}
      <mesh material={bodyMat} position={[0, 0.18, -1.88]}>
        <boxGeometry args={[1.6, 0.28, 0.18]} />
      </mesh>

      {/* Headlights */}
      <mesh material={lightsMatF} position={[-0.6, 0.28, 1.83]}>
        <boxGeometry args={[0.28, 0.14, 0.06]} />
      </mesh>
      <mesh material={lightsMatF} position={[0.6, 0.28, 1.83]}>
        <boxGeometry args={[0.28, 0.14, 0.06]} />
      </mesh>

      {/* Tail lights */}
      <mesh material={brakeMat} position={[-0.6, 0.28, -1.83]}>
        <boxGeometry args={[0.28, 0.14, 0.06]} />
      </mesh>
      <mesh material={brakeMat} position={[0.6, 0.28, -1.83]}>
        <boxGeometry args={[0.28, 0.14, 0.06]} />
      </mesh>

      {/* Wheels */}
      {WHEEL_POSITIONS.map((pos, i): React.ReactElement => {
        let rimOffsetX: number;
        if (pos[0] < 0) {
          rimOffsetX = 0.07;
        } else {
          rimOffsetX = -0.07;
        }
        return (
          <group key={i} position={pos} rotation={[0, 0, Math.PI / 2]}>
            <mesh material={tyreMat}>
              <cylinderGeometry args={[0.34, 0.34, 0.26, 12]} />
            </mesh>
            <mesh material={rimMat} position={[rimOffsetX, 0, 0]}>
              <cylinderGeometry args={[0.2, 0.2, 0.04, 6]} />
            </mesh>
          </group>
        );
      })}
    </>
  );
};

interface PlayerCarProps {
  x: number;
  z: number;
  steerAngle: number;
  isBraking: boolean;
  carColor: string;
}

export const PlayerCarMesh = ({ x, z, steerAngle, isBraking, carColor }: PlayerCarProps): React.ReactElement => {
  const bodyMat = useMemo((): THREE.MeshStandardMaterial => {
    return new THREE.MeshStandardMaterial({ color: carColor });
  }, [carColor]);

  const roofMat = useMemo((): THREE.MeshStandardMaterial => {
    const col = new THREE.Color(carColor);
    col.multiplyScalar(0.7);
    return new THREE.MeshStandardMaterial({ color: col });
  }, [carColor]);

  const yawRad = steerAngle * 0.015;
  const rollRad = -steerAngle * 0.012;

  return (
    <group position={[x, 0, z]} rotation={[0, yawRad, rollRad]}>
      <CarBody bodyMat={bodyMat} roofMat={roofMat} isBraking={isBraking} />
    </group>
  );
};

interface RemoteCarProps {
  x: number;
  z: number;
  angle: number;
  colorIndex: number;
}

export const RemoteCarMesh = ({ x, z, angle, colorIndex }: RemoteCarProps): React.ReactElement => {
  const idx = colorIndex % remoteBodyMats.length;
  const yawRad = angle * 0.015;
  const rollRad = -angle * 0.012;

  return (
    <group position={[x, 0, z]} rotation={[0, yawRad, rollRad]}>
      <CarBody bodyMat={remoteBodyMats[idx]} roofMat={remoteRoofMats[idx]} isBraking={false} />
    </group>
  );
};
