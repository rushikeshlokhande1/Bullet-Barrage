import * as THREE from "three";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { PlayerState } from "../types/game";

interface Props {
  player: PlayerState;
}

export function RemotePlayer({ player }: Props) {
  const groupRef = useRef<THREE.Group>(null!);
  const targetPos = useRef(new THREE.Vector3(player.position.x, player.position.y, player.position.z));
  const targetRotY = useRef(player.rotation.y);

  useFrame(() => {
    if (!groupRef.current) return;
    targetPos.current.set(player.position.x, player.position.y, player.position.z);
    groupRef.current.position.lerp(targetPos.current, 0.2);
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      player.rotation.y,
      0.2,
    );
  });

  if (!player.alive) return null;

  return (
    <group ref={groupRef} position={[player.position.x, player.position.y, player.position.z]}>
      <mesh position={[0, 0, 0]} castShadow={false}>
        <boxGeometry args={[0.8, 1.6, 0.8]} />
        <meshLambertMaterial color={player.color} />
      </mesh>
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[0.7, 0.7, 0.7]} />
        <meshLambertMaterial color={player.color} />
      </mesh>
      <mesh position={[0, 0.7, -0.6]}>
        <boxGeometry args={[0.15, 0.15, 0.6]} />
        <meshLambertMaterial color="#555" />
      </mesh>
    </group>
  );
}
