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
  const bobRef = useRef(0);
  const targetPos = useRef(new THREE.Vector3(player.position.x, player.position.y, player.position.z));

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    targetPos.current.set(player.position.x, player.position.y, player.position.z);
    groupRef.current.position.lerp(targetPos.current, 0.22);
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      player.rotation.y,
      0.22,
    );
    bobRef.current += delta * 4;
  });

  if (!player.alive) return null;

  const wep = WEAPONS[player.weapon ?? "rifle"];
  const healthPct = player.health / 100;
  const barColor = healthPct > 0.6 ? "#4caf50" : healthPct > 0.3 ? "#ff9800" : "#f44336";

  return (
    <group ref={groupRef} position={[player.position.x, player.position.y, player.position.z]}>
      {/* Egg body (main oval) */}
      <mesh position={[0, 0.75, 0]} scale={[1, 1.35, 1]}>
        <sphereGeometry args={[0.42, 10, 10]} />
        <meshLambertMaterial color={player.color} />
      </mesh>

      {/* Eyes */}
      <mesh position={[0.17, 1.0, -0.33]} scale={[1, 1.2, 1]}>
        <sphereGeometry args={[0.09, 7, 7]} />
        <meshLambertMaterial color="#111" />
      </mesh>
      <mesh position={[-0.17, 1.0, -0.33]} scale={[1, 1.2, 1]}>
        <sphereGeometry args={[0.09, 7, 7]} />
        <meshLambertMaterial color="#111" />
      </mesh>
      {/* Eye shine */}
      <mesh position={[0.19, 1.03, -0.4]}>
        <sphereGeometry args={[0.03, 5, 5]} />
        <meshLambertMaterial color="#fff" />
      </mesh>
      <mesh position={[-0.15, 1.03, -0.4]}>
        <sphereGeometry args={[0.03, 5, 5]} />
        <meshLambertMaterial color="#fff" />
      </mesh>

      {/* Gun */}
      <mesh position={[0.5, 0.7, -0.2]} rotation={[0, 0.1, 0]}>
        <boxGeometry args={wep.modelScale} />
        <meshLambertMaterial color={wep.color} />
      </mesh>
      {/* Gun barrel */}
      <mesh position={[0.5, 0.7, -0.2 - wep.modelScale[2] / 2 - 0.1]} rotation={[0, 0.1, 0]}>
        <boxGeometry args={[0.05, 0.05, 0.2]} />
        <meshLambertMaterial color="#333" />
      </mesh>

      {/* Health bar + nametag */}
      <Html position={[0, 1.8, 0]} center distanceFactor={14} zIndexRange={[1, 2]}>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
          pointerEvents: "none", minWidth: 80,
        }}>
          <div style={{
            background: "rgba(0,0,0,0.75)", color: "#fff",
            padding: "2px 8px", fontSize: 11, whiteSpace: "nowrap",
            fontFamily: "Impact, Arial Black, sans-serif",
            letterSpacing: 1, borderRadius: 2,
            borderBottom: `2px solid ${player.color}`,
          }}>
            {player.nickname}
          </div>
          <div style={{ width: 60, height: 5, background: "rgba(0,0,0,0.5)", borderRadius: 3 }}>
            <div style={{ width: `${player.health}%`, height: "100%", background: barColor, borderRadius: 3, transition: "width 0.1s" }} />
          </div>
        </div>
      </Html>
    </group>
  );
}
