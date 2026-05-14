import * as THREE from "three";
import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { WeaponId } from "../types/game";
import { WEAPONS } from "../types/game";

interface Props {
  weaponId: WeaponId;
  isShooting: boolean;
}

const GUN_CONFIGS: Record<WeaponId, {
  body: [number, number, number];
  barrel: [number, number, number];
  stock: [number, number, number];
  grip: [number, number, number];
  mag: [number, number, number];
  bodyColor: string;
  darkColor: string;
  accentColor: string;
  offset: [number, number, number];
}> = {
  rifle: {
    body:    [0.08, 0.08, 0.55],
    barrel:  [0.04, 0.04, 0.30],
    stock:   [0.07, 0.07, 0.20],
    grip:    [0.06, 0.14, 0.06],
    mag:     [0.06, 0.12, 0.06],
    bodyColor:   "#555",
    darkColor:   "#222",
    accentColor: "#666",
    offset: [0.28, -0.22, -0.45],
  },
  shotgun: {
    body:    [0.10, 0.09, 0.42],
    barrel:  [0.07, 0.07, 0.28],
    stock:   [0.09, 0.08, 0.22],
    grip:    [0.08, 0.16, 0.07],
    mag:     [0.07, 0.08, 0.04],
    bodyColor:   "#7a4820",
    darkColor:   "#3a1e08",
    accentColor: "#9a5a28",
    offset: [0.26, -0.24, -0.42],
  },
  sniper: {
    body:    [0.07, 0.07, 0.70],
    barrel:  [0.035, 0.035, 0.40],
    stock:   [0.07, 0.06, 0.28],
    grip:    [0.055, 0.16, 0.055],
    mag:     [0.055, 0.14, 0.055],
    bodyColor:   "#1a3a5c",
    darkColor:   "#0d1e30",
    accentColor: "#2a5a8c",
    offset: [0.30, -0.21, -0.50],
  },
};

export function FirstPersonGun({ weaponId, isShooting }: Props) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null!);
  const muzzleRef = useRef<THREE.Mesh>(null!);
  const muzzleLightRef = useRef<THREE.PointLight>(null!);
  const bobRef = useRef(0);
  const shootRef = useRef(0);
  const bobSpeedRef = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    bobSpeedRef.current = THREE.MathUtils.lerp(bobSpeedRef.current, 5, delta * 8);
    bobRef.current += delta * bobSpeedRef.current;

    if (isShooting) shootRef.current = Math.min(shootRef.current + delta * 28, 1);
    else shootRef.current = Math.max(shootRef.current - delta * 12, 0);

    const bob = Math.sin(bobRef.current) * 0.007;
    const bobX = Math.cos(bobRef.current * 0.5) * 0.003;
    const recoil = shootRef.current * 0.07;
    const tilt = shootRef.current * 0.04;

    const cfg = GUN_CONFIGS[weaponId];
    const off = new THREE.Vector3(cfg.offset[0] + bobX, cfg.offset[1] + bob, cfg.offset[2] + recoil);
    off.applyQuaternion(camera.quaternion);

    groupRef.current.position.copy(camera.position).add(off);
    groupRef.current.quaternion.copy(camera.quaternion);
    groupRef.current.rotateX(tilt);

    // Muzzle flash
    const flashOn = isShooting;
    if (muzzleRef.current) {
      muzzleRef.current.visible = flashOn;
      muzzleRef.current.scale.setScalar(flashOn ? 0.8 + Math.random() * 0.4 : 0.8);
    }
    if (muzzleLightRef.current) {
      muzzleLightRef.current.intensity = flashOn ? 4 + Math.random() * 2 : 0;
    }
  });

  const cfg = GUN_CONFIGS[weaponId];
  const bz = cfg.body[2];
  const barrelLen = cfg.barrel[2];

  return (
    <group ref={groupRef}>
      {/* Gun body */}
      <mesh castShadow>
        <boxGeometry args={cfg.body} />
        <meshStandardMaterial color={cfg.bodyColor} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Barrel (extends forward) */}
      <mesh position={[0, 0, -(bz / 2 + barrelLen / 2)]}>
        <boxGeometry args={cfg.barrel} />
        <meshStandardMaterial color={cfg.darkColor} metalness={0.85} roughness={0.2} />
      </mesh>

      {/* Barrel tip / suppressor ring */}
      <mesh position={[0, 0, -(bz / 2 + barrelLen + 0.015)]}>
        <boxGeometry args={[cfg.barrel[0] + 0.02, cfg.barrel[1] + 0.02, 0.03]} />
        <meshStandardMaterial color={cfg.accentColor} metalness={0.9} roughness={0.15} />
      </mesh>

      {/* Stock (extends backward) */}
      <mesh position={[0, -0.005, bz / 2 + cfg.stock[2] / 2]}>
        <boxGeometry args={cfg.stock} />
        <meshStandardMaterial color={cfg.darkColor} metalness={0.5} roughness={0.5} />
      </mesh>

      {/* Pistol grip */}
      <mesh position={[0, -(cfg.body[1] / 2 + cfg.grip[1] / 2), bz * 0.15]}>
        <boxGeometry args={cfg.grip} />
        <meshStandardMaterial color={cfg.darkColor} metalness={0.3} roughness={0.7} />
      </mesh>

      {/* Magazine */}
      <mesh position={[0, -(cfg.body[1] / 2 + cfg.mag[1] / 2), -(bz * 0.1)]}>
        <boxGeometry args={cfg.mag} />
        <meshStandardMaterial color={cfg.accentColor} metalness={0.55} roughness={0.45} />
      </mesh>

      {/* Top rail / sight */}
      <mesh position={[0, cfg.body[1] / 2 + 0.018, -(bz * 0.1)]}>
        <boxGeometry args={[cfg.body[0] * 0.55, 0.018, bz * 0.55]} />
        <meshStandardMaterial color={cfg.accentColor} metalness={0.8} roughness={0.25} />
      </mesh>

      {/* Front sight post */}
      <mesh position={[0, cfg.body[1] / 2 + 0.032, -(bz * 0.3)]}>
        <boxGeometry args={[0.008, 0.022, 0.008]} />
        <meshStandardMaterial color="#ddd" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* Muzzle flash glow */}
      <mesh ref={muzzleRef} position={[0, 0, -(bz / 2 + barrelLen + 0.05)]} visible={false}>
        <sphereGeometry args={[0.09, 6, 6]} />
        <meshStandardMaterial
          color="#ff8800"
          emissive="#ff6600"
          emissiveIntensity={3}
          transparent
          opacity={0.9}
        />
      </mesh>
      <pointLight
        ref={muzzleLightRef}
        color="#ff9900"
        intensity={0}
        distance={6}
        position={[0, 0, -(bz / 2 + barrelLen + 0.05)]}
      />
    </group>
  );
}
