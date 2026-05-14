import * as THREE from "three";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { PlayerState } from "../types/game";
import { WEAPONS } from "../types/game";

interface Props {
  player: PlayerState;
}

export function RemotePlayer({ player }: Props) {
  const groupRef = useRef<THREE.Group>(null!);
  const targetPos = useRef(new THREE.Vector3(player.position.x, player.position.y, player.position.z));

  useFrame(() => {
    if (!groupRef.current) return;
    targetPos.current.set(player.position.x, player.position.y, player.position.z);
    groupRef.current.position.lerp(targetPos.current, 0.25);
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      player.rotation.y,
      0.25,
    );
  });

  if (!player.alive) return null;

  const wep = WEAPONS[player.weapon ?? "rifle"];

  return (
    <group ref={groupRef} position={[player.position.x, player.position.y, player.position.z]}>
      {/* Body */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.75, 1.4, 0.55]} />
        <meshLambertMaterial color={player.color} />
      </mesh>
      {/* Egg head */}
      <mesh position={[0, 1.0, 0]}>
        <sphereGeometry args={[0.38, 8, 8]} />
        <meshLambertMaterial color={player.color} />
      </mesh>
      {/* Eyes */}
      <mesh position={[0.14, 1.05, -0.3]}>
        <sphereGeometry args={[0.07, 6, 6]} />
        <meshLambertMaterial color="#000" />
      </mesh>
      <mesh position={[-0.14, 1.05, -0.3]}>
        <sphereGeometry args={[0.07, 6, 6]} />
        <meshLambertMaterial color="#000" />
      </mesh>
      {/* Gun */}
      <mesh position={[0.45, 0.2, -0.3]} rotation={[0, 0, 0]}>
        <boxGeometry args={wep.modelScale} />
        <meshLambertMaterial color={wep.color} />
      </mesh>
      {/* Nametag */}
      <Html position={[0, 1.8, 0]} center distanceFactor={15} zIndexRange={[1, 2]}>
        <div style={{
          background: "rgba(0,0,0,0.7)",
          color: "#fff",
          padding: "2px 6px",
          fontSize: 11,
          whiteSpace: "nowrap",
          fontFamily: "monospace",
          borderLeft: `3px solid ${player.color}`,
          pointerEvents: "none",
        }}>
          {player.nickname} &nbsp;❤{player.health}
        </div>
      </Html>
    </group>
  );
}
