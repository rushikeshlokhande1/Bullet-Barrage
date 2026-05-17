import * as THREE from "three";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { PlayerState, WeaponId } from "../types/game";
import { WEAPONS } from "../types/game";

interface Props {
  player: PlayerState;
}

function angleDiff(a: number, b: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function roundedMaterial(color: string, roughness = 0.44, metalness = 0.18) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={roughness}
      metalness={metalness}
    />
  );
}

function EnergyMaterial({ color, intensity = 1.6 }: { color: string; intensity?: number }) {
  return (
    <meshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={intensity}
      roughness={0.18}
      metalness={0.08}
      transparent
      opacity={0.92}
    />
  );
}

export function RemotePlayer({ player }: Props) {
  const groupRef = useRef<THREE.Group>(null!);
  const bodyRef = useRef<THREE.Mesh>(null!);
  const rimRef = useRef<THREE.Mesh>(null!);
  const coreRef = useRef<THREE.Mesh>(null!);
  const leftEyeRef = useRef<THREE.Mesh>(null!);
  const rightEyeRef = useRef<THREE.Mesh>(null!);
  const leftHandRef = useRef<THREE.Group>(null!);
  const rightHandRef = useRef<THREE.Group>(null!);
  const leftFootRef = useRef<THREE.Group>(null!);
  const rightFootRef = useRef<THREE.Group>(null!);
  const trailRef = useRef<THREE.Mesh>(null!);
  const shieldRef = useRef<THREE.Mesh>(null!);
  const shieldRingRef = useRef<THREE.Mesh>(null!);
  const bobRef = useRef(0);
  const runRef = useRef(0);
  const blinkRef = useRef(0);
  const lastYawRef = useRef(player.rotation.y);
  const targetPos = useRef(new THREE.Vector3(player.position.x, player.position.y, player.position.z));
  const renderPos = useRef(targetPos.current.clone());
  const previousPos = useRef(targetPos.current.clone());
  const smoothedSpeedRef = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    targetPos.current.set(player.position.x, player.position.y, player.position.z);
    const frameSpeed = targetPos.current.distanceTo(previousPos.current) / Math.max(delta, 0.001);
    previousPos.current.copy(targetPos.current);
    smoothedSpeedRef.current = THREE.MathUtils.lerp(
      smoothedSpeedRef.current,
      frameSpeed,
      1 - Math.exp(-delta * 10),
    );
    const moving = THREE.MathUtils.clamp(smoothedSpeedRef.current / 7.5, 0, 1);

    renderPos.current.lerp(targetPos.current, 1 - Math.exp(-delta * 14));
    groupRef.current.position.copy(renderPos.current);
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      player.rotation.y,
      1 - Math.exp(-delta * 14),
    );
    const strafeLean = THREE.MathUtils.clamp(angleDiff(lastYawRef.current, player.rotation.y) * 2.4, -0.24, 0.24);
    lastYawRef.current = player.rotation.y;

    bobRef.current += delta * (3.4 + moving * 7.5);
    runRef.current += delta * (7.5 + moving * 9);
    blinkRef.current = (blinkRef.current + delta) % 3.4;
    const bob = Math.sin(bobRef.current) * 0.035 * (0.3 + moving);
    groupRef.current.position.y = renderPos.current.y + bob;

    if (bodyRef.current) {
      bodyRef.current.rotation.z = Math.sin(runRef.current) * 0.04 * moving - strafeLean;
      bodyRef.current.rotation.x = 0.06 * moving;
      bodyRef.current.scale.set(
        1 + Math.sin(bobRef.current * 2) * 0.018 * moving,
        1 + Math.sin(bobRef.current * 2 + Math.PI) * 0.026 * moving,
        1 + moving * 0.018,
      );
      const bodyMat = bodyRef.current.material as THREE.MeshPhysicalMaterial;
      bodyMat.emissiveIntensity = 0.12 + (1 - player.health / 100) * 0.12;
    }
    if (rimRef.current) {
      const rimMat = rimRef.current.material as THREE.MeshStandardMaterial;
      rimMat.opacity = 0.18 + moving * 0.12;
    }
    if (coreRef.current) {
      const healthPulse = 1 + (1 - player.health / 100) * 0.45;
      const pulse = (1 + Math.sin(bobRef.current * 2.6) * 0.08) * healthPulse;
      coreRef.current.scale.setScalar(pulse);
      const mat = coreRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.7 + moving * 0.75 + (1 - player.health / 100) * 0.8 + Math.sin(bobRef.current * 3) * 0.18;
    }
    const blink = blinkRef.current > 3.04 ? 0.12 : 1;
    if (leftEyeRef.current && rightEyeRef.current) {
      const focus = 1 + moving * 0.12;
      leftEyeRef.current.scale.set(1.35 * focus, 0.72 * blink, 0.25);
      rightEyeRef.current.scale.set(1.35 * focus, 0.72 * blink, 0.25);
    }
    if (leftHandRef.current && rightHandRef.current) {
      leftHandRef.current.position.y = 0.73 + Math.sin(runRef.current) * 0.035 * moving;
      rightHandRef.current.position.y = 0.70 + Math.sin(runRef.current + Math.PI) * 0.025 * moving;
      leftHandRef.current.rotation.z = -0.12 + Math.sin(runRef.current) * 0.08 * moving;
      rightHandRef.current.rotation.z = 0.1 + Math.sin(runRef.current + Math.PI) * 0.06 * moving;
    }
    if (leftFootRef.current && rightFootRef.current) {
      leftFootRef.current.position.y = 0.2 + Math.max(0, Math.sin(runRef.current)) * 0.06 * moving;
      rightFootRef.current.position.y = 0.2 + Math.max(0, Math.sin(runRef.current + Math.PI)) * 0.06 * moving;
      leftFootRef.current.rotation.x = -0.12 + Math.sin(runRef.current) * 0.16 * moving;
      rightFootRef.current.rotation.x = -0.12 + Math.sin(runRef.current + Math.PI) * 0.16 * moving;
    }
    if (trailRef.current) {
      trailRef.current.visible = moving > 0.15;
      trailRef.current.scale.set(0.9 + moving * 0.35, 0.9 + moving * 0.15, 1 + moving * 0.8);
      const trailMat = trailRef.current.material as THREE.MeshStandardMaterial;
      trailMat.opacity = moving * 0.22;
    }
    const shieldPct = (player.shield ?? 0) / Math.max(1, player.maxShield ?? 75);
    if (shieldRef.current) {
      shieldRef.current.visible = shieldPct > 0.02;
      shieldRef.current.scale.setScalar(1.04 + shieldPct * 0.1 + Math.sin(bobRef.current * 4.2) * 0.012);
      const shieldMat = shieldRef.current.material as THREE.MeshStandardMaterial;
      shieldMat.opacity = 0.1 + shieldPct * 0.22;
      shieldMat.emissiveIntensity = 0.34 + shieldPct * 0.7 + Math.sin(bobRef.current * 5) * 0.08;
    }
    if (shieldRingRef.current) {
      shieldRingRef.current.visible = shieldPct > 0.02;
      shieldRingRef.current.rotation.z += delta * (0.9 + shieldPct * 1.4);
      const ringMat = shieldRingRef.current.material as THREE.MeshStandardMaterial;
      ringMat.opacity = 0.18 + shieldPct * 0.32;
    }
  });

  if (!player.alive) return null;

  const wep = WEAPONS[player.weapon as WeaponId] ?? WEAPONS.cluckfire;
  const healthPct = player.health / 100;
  const shieldPct = (player.shield ?? 0) / Math.max(1, player.maxShield ?? 75);
  const barColor = healthPct > 0.6 ? "#4caf50" : healthPct > 0.3 ? "#ff9800" : "#f44336";
  const skin = player.color;
  const accent = wep.accent;
  const visor = "#101820";
  const armor = "#f0f3f5";
  const darkArmor = "#222b33";

  return (
    <group ref={groupRef} position={[player.position.x, player.position.y, player.position.z]}>
      <mesh ref={shieldRef} position={[0, 0.86, 0]} userData={{ isPlayer: true }}>
        <sphereGeometry args={[0.72, 24, 14]} />
        <meshStandardMaterial color="#61f6ff" emissive="#61f6ff" emissiveIntensity={0.7} transparent opacity={0.18} roughness={0.08} metalness={0.05} depthWrite={false} wireframe />
      </mesh>
      <mesh ref={shieldRingRef} position={[0, 0.86, 0]} rotation={[Math.PI / 2, 0, 0]} userData={{ isPlayer: true }}>
        <torusGeometry args={[0.76, 0.012, 8, 40]} />
        <meshStandardMaterial color="#b7fbff" emissive="#44f3ff" emissiveIntensity={0.85} transparent opacity={0.32} depthWrite={false} />
      </mesh>
      <group userData={{ isPlayer: true }}>
        {/* Smooth capsule body with a clean competitive silhouette. */}
        <mesh ref={bodyRef} position={[0, 0.82, 0]} castShadow userData={{ isPlayer: true }}>
          <capsuleGeometry args={[0.36, 0.7, 8, 12]} />
          <meshPhysicalMaterial
            color={skin}
            roughness={0.22}
            metalness={0.04}
            clearcoat={0.85}
            clearcoatRoughness={0.2}
            emissive={accent}
            emissiveIntensity={0.1}
          />
        </mesh>
        <mesh ref={rimRef} position={[0, 0.82, 0.025]} scale={[1.04, 1.03, 1.04]} userData={{ isPlayer: true }}>
          <capsuleGeometry args={[0.36, 0.7, 8, 12]} />
          <meshStandardMaterial color="#ffffff" emissive={accent} emissiveIntensity={0.18} transparent opacity={0.18} roughness={0.18} depthWrite={false} />
        </mesh>

        {/* Compact floating foot pods for readable movement without widening the hit silhouette. */}
        <group ref={leftFootRef} position={[-0.18, 0.2, -0.02]} rotation={[-0.12, 0.06, -0.04]}>
          <mesh castShadow userData={{ isPlayer: true }}>
            <sphereGeometry args={[0.12, 8, 6]} />
            {roundedMaterial(darkArmor, 0.33, 0.28)}
          </mesh>
          <mesh position={[0, -0.012, -0.06]} scale={[1.0, 0.32, 0.74]} userData={{ isPlayer: true }}>
            <sphereGeometry args={[0.12, 8, 5]} />
            <EnergyMaterial color={accent} intensity={0.38} />
          </mesh>
        </group>
        <group ref={rightFootRef} position={[0.18, 0.2, -0.02]} rotation={[-0.12, -0.06, 0.04]}>
          <mesh castShadow userData={{ isPlayer: true }}>
            <sphereGeometry args={[0.12, 8, 6]} />
            {roundedMaterial(darkArmor, 0.33, 0.28)}
          </mesh>
          <mesh position={[0, -0.012, -0.06]} scale={[1.0, 0.32, 0.74]} userData={{ isPlayer: true }}>
            <sphereGeometry args={[0.12, 8, 5]} />
            <EnergyMaterial color={accent} intensity={0.38} />
          </mesh>
        </group>

        {/* Subtle sci-fi armor plating that preserves readability at distance. */}
        <mesh position={[0, 1.23, -0.015]} scale={[1.02, 0.28, 0.24]} userData={{ isPlayer: true }}>
          <sphereGeometry args={[0.37, 10, 6]} />
          {roundedMaterial(armor, 0.32, 0.22)}
        </mesh>
        <mesh position={[0, 0.64, -0.02]} scale={[1.0, 0.22, 0.22]} userData={{ isPlayer: true }}>
          <sphereGeometry args={[0.36, 10, 6]} />
          {roundedMaterial(darkArmor, 0.4, 0.3)}
        </mesh>
        <mesh position={[0, 0.96, -0.345]} rotation={[0, 0, 0]} userData={{ isPlayer: true }}>
          <boxGeometry args={[0.52, 0.12, 0.035]} />
          {roundedMaterial(visor, 0.24, 0.08)}
        </mesh>

        {/* Expressive glowing eyes mounted in the visor. */}
        <mesh ref={leftEyeRef} position={[-0.13, 0.98, -0.372]} scale={[1.35, 0.72, 0.25]} userData={{ isPlayer: true }}>
          <sphereGeometry args={[0.055, 8, 5]} />
          <EnergyMaterial color="#dffcff" intensity={1.2} />
        </mesh>
        <mesh ref={rightEyeRef} position={[0.13, 0.98, -0.372]} scale={[1.35, 0.72, 0.25]} userData={{ isPlayer: true }}>
          <sphereGeometry args={[0.055, 8, 5]} />
          <EnergyMaterial color="#dffcff" intensity={1.2} />
        </mesh>

        {/* Reactive crystal chest core. */}
        <mesh ref={coreRef} position={[0, 0.82, -0.36]} rotation={[Math.PI / 2, 0, Math.PI / 4]} userData={{ isPlayer: true }}>
          <octahedronGeometry args={[0.105, 0]} />
          <EnergyMaterial color={accent} intensity={1.9} />
        </mesh>
        <mesh position={[0, 0.82, -0.368]} rotation={[Math.PI / 2, 0, 0]} userData={{ isPlayer: true }}>
          <torusGeometry args={[0.132, 0.012, 8, 20]} />
          <meshStandardMaterial color={armor} emissive={accent} emissiveIntensity={0.24} metalness={0.42} roughness={0.22} />
        </mesh>

        {/* Soft movement trail visible only while sprinting, kept translucent for FPS clarity. */}
        <mesh ref={trailRef} position={[0, 0.72, 0.34]} scale={[1, 1, 1.2]} visible={false}>
          <sphereGeometry args={[0.28, 10, 8]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.45} transparent opacity={0.0} roughness={0.8} depthWrite={false} />
        </mesh>

        {/* Floating hands, posed for first/third-person weapon readability. */}
        <group ref={leftHandRef} position={[-0.33, 0.73, -0.32]} rotation={[0.35, -0.2, -0.12]}>
          <mesh castShadow userData={{ isPlayer: true }}>
            <sphereGeometry args={[0.115, 8, 6]} />
            {roundedMaterial(armor, 0.34, 0.18)}
          </mesh>
          <mesh position={[0, -0.015, -0.105]} scale={[0.72, 0.46, 0.35]} userData={{ isPlayer: true }}>
            <sphereGeometry args={[0.075, 8, 5]} />
            {roundedMaterial(darkArmor, 0.38, 0.26)}
          </mesh>
        </group>
        <group ref={rightHandRef} position={[0.39, 0.69, -0.31]} rotation={[0.35, 0.16, 0.1]}>
          <mesh castShadow userData={{ isPlayer: true }}>
            <sphereGeometry args={[0.12, 8, 6]} />
            {roundedMaterial(armor, 0.34, 0.18)}
          </mesh>
          <mesh position={[0, -0.015, -0.105]} scale={[0.72, 0.46, 0.35]} userData={{ isPlayer: true }}>
            <sphereGeometry args={[0.075, 8, 5]} />
            {roundedMaterial(darkArmor, 0.38, 0.26)}
          </mesh>
        </group>

        {/* Compact third-person weapon proxy with crystal-energy accent. */}
        <group position={[0.45, 0.68, -0.36]} rotation={[0, 0.12, 0]} userData={{ isPlayer: true }}>
          <mesh castShadow>
            <boxGeometry args={[wep.modelScale[0], wep.modelScale[1], wep.modelScale[2] * 0.82]} />
            <meshStandardMaterial color={wep.color} roughness={0.3} metalness={0.45} />
          </mesh>
          <mesh position={[0, 0.035, -wep.modelScale[2] * 0.18]}>
            <boxGeometry args={[wep.modelScale[0] * 0.58, 0.026, wep.modelScale[2] * 0.42]} />
            <EnergyMaterial color={accent} intensity={0.95} />
          </mesh>
          <mesh position={[0, 0, -wep.modelScale[2] * 0.52]}>
            <boxGeometry args={[0.05, 0.05, 0.24]} />
            <meshStandardMaterial color="#111820" roughness={0.22} metalness={0.75} emissive={accent} emissiveIntensity={0.18} />
          </mesh>
        </group>
      </group>

      <Html position={[0, 1.84, 0]} center distanceFactor={14} zIndexRange={[1, 2]}>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
          pointerEvents: "none", minWidth: 80,
        }}>
          <div style={{
            background: "rgba(0,0,0,0.75)", color: "#fff",
            padding: "2px 8px", fontSize: 11, whiteSpace: "nowrap",
            fontFamily: "Impact, Arial Black, sans-serif",
            letterSpacing: 1, borderRadius: 2,
            borderBottom: `2px solid ${skin}`,
          }}>
            {player.nickname}
          </div>
          <div style={{ width: 60, height: 5, background: "rgba(0,0,0,0.5)", borderRadius: 3 }}>
            <div style={{ width: `${player.health}%`, height: "100%", background: barColor, borderRadius: 3, transition: "width 0.1s" }} />
          </div>
          <div style={{ width: 60, height: 4, background: "rgba(66,245,255,0.12)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${shieldPct * 100}%`, height: "100%", background: "#61f6ff", borderRadius: 3, boxShadow: "0 0 7px #61f6ff", transition: "width 0.12s" }} />
          </div>
        </div>
      </Html>
    </group>
  );
}
