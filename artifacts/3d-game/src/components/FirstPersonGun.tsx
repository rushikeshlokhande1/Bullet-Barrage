import * as THREE from "three";
import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { WeaponId } from "../types/game";
import { WEAPONS } from "../types/game";

interface Props {
  weaponId: WeaponId;
  isShooting: boolean;
}

export function FirstPersonGun({ weaponId, isShooting }: Props) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null!);
  const bobRef = useRef(0);
  const shootRef = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    bobRef.current += delta * 5;
    if (isShooting) shootRef.current = Math.min(shootRef.current + delta * 30, 1);
    else shootRef.current = Math.max(shootRef.current - delta * 15, 0);

    const bob = Math.sin(bobRef.current) * 0.008;
    const recoil = shootRef.current * 0.06;

    const right = new THREE.Vector3(0.28, -0.22 + bob, -0.45 + recoil);
    right.applyQuaternion(camera.quaternion);

    groupRef.current.position.copy(camera.position).add(right);
    groupRef.current.quaternion.copy(camera.quaternion);
  });

  const wep = WEAPONS[weaponId];

  return (
    <group ref={groupRef}>
      {/* Gun body */}
      <mesh>
        <boxGeometry args={wep.modelScale} />
        <meshLambertMaterial color={wep.color} />
      </mesh>
      {/* Grip */}
      <mesh position={[0, -wep.modelScale[1] * 0.6, wep.modelScale[2] * 0.1]}>
        <boxGeometry args={[wep.modelScale[0] * 0.7, wep.modelScale[1] * 0.7, wep.modelScale[2] * 0.25]} />
        <meshLambertMaterial color="#333" />
      </mesh>
      {/* Barrel tip */}
      <mesh position={[0, 0, -(wep.modelScale[2] / 2 + 0.12)]}>
        <boxGeometry args={[0.05, 0.05, 0.24]} />
        <meshLambertMaterial color="#222" />
      </mesh>
      {/* Scope/sight */}
      <mesh position={[0, wep.modelScale[1] * 0.6, 0]}>
        <boxGeometry args={[wep.modelScale[0] * 0.4, wep.modelScale[1] * 0.3, wep.modelScale[2] * 0.4]} />
        <meshLambertMaterial color="#444" />
      </mesh>
    </group>
  );
}
