import * as THREE from "three";
import { useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { WeaponId } from "../types/game";
import { WEAPONS } from "../types/game";

interface Props {
  weaponId: WeaponId;
  isShooting: boolean;
  isAiming: boolean;
  isReloading: boolean;
  isInspecting: boolean;
  movementRef: MutableRefObject<number>;
  lookRef: MutableRefObject<THREE.Vector2>;
}

interface GunConfig {
  body: [number, number, number];
  barrel: [number, number, number];
  stock: [number, number, number];
  grip: [number, number, number];
  mag: [number, number, number];
  offset: [number, number, number];
  bodyColor: string;
  darkColor: string;
  metalColor: string;
  accentColor: string;
  flashColor: string;
  recoil: number;
  tilt: number;
  kind: "rifle" | "shotgun" | "sniper" | "launcher" | "minigun" | "burst" | "marksman";
}

const GUN_CONFIGS: Record<WeaponId, GunConfig> = {
  cluckfire: {
    body: [0.09, 0.085, 0.58],
    barrel: [0.036, 0.036, 0.34],
    stock: [0.08, 0.075, 0.22],
    grip: [0.055, 0.15, 0.065],
    mag: [0.06, 0.13, 0.07],
    offset: [0.29, -0.22, -0.48],
    bodyColor: "#20262f",
    darkColor: "#090d12",
    metalColor: "#6e7784",
    accentColor: "#42f5ff",
    flashColor: "#8ffcff",
    recoil: 0.07,
    tilt: 0.04,
    kind: "rifle",
  },
  ovomatic: {
    body: [0.12, 0.10, 0.48],
    barrel: [0.07, 0.07, 0.34],
    stock: [0.11, 0.09, 0.24],
    grip: [0.075, 0.17, 0.08],
    mag: [0.08, 0.08, 0.06],
    offset: [0.27, -0.25, -0.43],
    bodyColor: "#3a1715",
    darkColor: "#100b0a",
    metalColor: "#7f8587",
    accentColor: "#ff5a3d",
    flashColor: "#ff7c32",
    recoil: 0.13,
    tilt: 0.08,
    kind: "shotgun",
  },
  yolkpiercer: {
    body: [0.075, 0.075, 0.82],
    barrel: [0.03, 0.03, 0.55],
    stock: [0.075, 0.06, 0.30],
    grip: [0.052, 0.15, 0.055],
    mag: [0.05, 0.12, 0.055],
    offset: [0.31, -0.20, -0.55],
    bodyColor: "#111e34",
    darkColor: "#050914",
    metalColor: "#a5b3c8",
    accentColor: "#7fb7ff",
    flashColor: "#b8d7ff",
    recoil: 0.16,
    tilt: 0.055,
    kind: "sniper",
  },
  shell_lobber: {
    body: [0.16, 0.13, 0.48],
    barrel: [0.10, 0.10, 0.32],
    stock: [0.10, 0.08, 0.18],
    grip: [0.07, 0.16, 0.075],
    mag: [0.13, 0.13, 0.12],
    offset: [0.30, -0.25, -0.42],
    bodyColor: "#3a382f",
    darkColor: "#11110d",
    metalColor: "#837c68",
    accentColor: "#ffb000",
    flashColor: "#ff6d1a",
    recoil: 0.15,
    tilt: 0.075,
    kind: "launcher",
  },
  rapid_yolker: {
    body: [0.16, 0.13, 0.68],
    barrel: [0.075, 0.075, 0.44],
    stock: [0.11, 0.09, 0.22],
    grip: [0.075, 0.17, 0.08],
    mag: [0.16, 0.16, 0.10],
    offset: [0.31, -0.25, -0.52],
    bodyColor: "#272d34",
    darkColor: "#08090c",
    metalColor: "#77818b",
    accentColor: "#ff8f2f",
    flashColor: "#ffc14a",
    recoil: 0.055,
    tilt: 0.035,
    kind: "minigun",
  },
  crackling_burst: {
    body: [0.10, 0.09, 0.62],
    barrel: [0.035, 0.035, 0.33],
    stock: [0.08, 0.065, 0.18],
    grip: [0.055, 0.14, 0.06],
    mag: [0.055, 0.11, 0.07],
    offset: [0.29, -0.22, -0.48],
    bodyColor: "#172a24",
    darkColor: "#06110e",
    metalColor: "#536862",
    accentColor: "#9cff6a",
    flashColor: "#c9ff8a",
    recoil: 0.065,
    tilt: 0.035,
    kind: "burst",
  },
  runny_marksman: {
    body: [0.085, 0.08, 0.70],
    barrel: [0.032, 0.032, 0.42],
    stock: [0.09, 0.07, 0.28],
    grip: [0.055, 0.14, 0.06],
    mag: [0.052, 0.10, 0.055],
    offset: [0.30, -0.21, -0.50],
    bodyColor: "#4c3d31",
    darkColor: "#15110e",
    metalColor: "#8d8b82",
    accentColor: "#d8b47a",
    flashColor: "#f5d28a",
    recoil: 0.095,
    tilt: 0.045,
    kind: "marksman",
  },
};

function Box({
  args,
  position = [0, 0, 0],
  color,
  metalness = 0.65,
  roughness = 0.32,
  emissive,
  emissiveIntensity = 0,
}: {
  args: [number, number, number];
  position?: [number, number, number];
  color: string;
  metalness?: number;
  roughness?: number;
  emissive?: string;
  emissiveIntensity?: number;
}) {
  return (
    <mesh position={position} castShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial
        color={color}
        metalness={metalness}
        roughness={roughness}
        emissive={emissive ?? "#000000"}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  );
}

function CrystalPrism({
  radius = 0.04,
  depth = 0.16,
  position = [0, 0, 0],
  rotation = [Math.PI / 2, 0, 0],
  color,
  intensity = 1.8,
}: {
  radius?: number;
  depth?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  color: string;
  intensity?: number;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <cylinderGeometry args={[radius * 0.72, radius, depth, 6]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={intensity}
        metalness={0.15}
        roughness={0.12}
        transparent
        opacity={0.86}
      />
    </mesh>
  );
}

function HeatVent({
  index,
  color,
  side = 1,
  bodyZ,
}: {
  index: number;
  color: string;
  side?: 1 | -1;
  bodyZ: number;
}) {
  return (
    <Box
      args={[0.008, 0.042, 0.032]}
      position={[side * 0.055, 0.005, -bodyZ * 0.27 + index * 0.052]}
      color={color}
      emissive={color}
      emissiveIntensity={0.45}
      metalness={0.2}
      roughness={0.26}
    />
  );
}

function FloatingHand({
  side,
  accent,
  shooting,
  reloading,
}: {
  side: 1 | -1;
  accent: string;
  shooting: number;
  reloading: number;
}) {
  const x = side * (0.078 + shooting * 0.01);
  const y = -0.105 - reloading * 0.035;
  const z = side === 1 ? -0.11 + shooting * 0.018 : -0.28 - reloading * 0.035;
  return (
    <group position={[x, y, z]} rotation={[0.26 + reloading * 0.28, side * 0.16, side * 0.18]}>
      <mesh castShadow>
        <sphereGeometry args={[0.055, 14, 10]} />
        <meshStandardMaterial color="#eef4f6" roughness={0.34} metalness={0.18} />
      </mesh>
      <mesh position={[0, -0.008, -0.048]} scale={[0.78, 0.48, 0.42]} castShadow>
        <sphereGeometry args={[0.045, 10, 8]} />
        <meshStandardMaterial color="#202832" roughness={0.42} metalness={0.28} />
      </mesh>
      <mesh position={[side * 0.038, 0.006, -0.012]} rotation={[0, 0, side * 0.5]}>
        <boxGeometry args={[0.01, 0.016, 0.05]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.75 + shooting} roughness={0.2} />
      </mesh>
    </group>
  );
}

function SniperScope({
  accent,
  metal,
  dark,
  aiming,
  shooting,
}: {
  accent: string;
  metal: string;
  dark: string;
  aiming: number;
  shooting: number;
}) {
  const glow = 0.55 + aiming * 0.55 + shooting * 0.35;

  return (
    <group position={[0, 0.145, -0.13]}>
      {/* Picatinny rail and two hard mounts keep the optic visibly attached to the rifle. */}
      <Box args={[0.18, 0.018, 0.56]} position={[0, -0.105, 0.015]} color="#05080d" metalness={0.94} roughness={0.2} />
      {[-0.12, 0, 0.12].map((z) => (
        <Box key={z} args={[0.19, 0.012, 0.022]} position={[0, -0.087, z]} color={metal} metalness={0.88} roughness={0.18} />
      ))}
      {[-0.17, 0.12].map((z) => (
        <group key={z} position={[0, -0.055, z]}>
          <Box args={[0.026, 0.094, 0.05]} position={[-0.056, 0, 0]} color={metal} metalness={0.92} roughness={0.16} />
          <Box args={[0.026, 0.094, 0.05]} position={[0.056, 0, 0]} color={metal} metalness={0.92} roughness={0.16} />
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[0.087, 0.009, 12, 32]} />
            <meshStandardMaterial color={metal} metalness={0.95} roughness={0.13} emissive={accent} emissiveIntensity={0.04 + aiming * 0.1} />
          </mesh>
        </group>
      ))}

      {/* Long hollow optic tube with stepped rear eyepiece and larger front objective. */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.066, 0.066, 0.54, 36, 1, true]} />
        <meshStandardMaterial color="#05080e" metalness={0.96} roughness={0.14} emissive={accent} emissiveIntensity={0.04 + aiming * 0.12} />
      </mesh>
      <mesh position={[0, 0, -0.31]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.092, 0.071, 0.13, 36, 1, true]} />
        <meshStandardMaterial color="#070b12" metalness={0.95} roughness={0.13} emissive={accent} emissiveIntensity={0.05 + aiming * 0.12} />
      </mesh>
      <mesh position={[0, 0, 0.31]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.058, 0.071, 0.12, 36, 1, true]} />
        <meshStandardMaterial color="#070b12" metalness={0.95} roughness={0.13} emissive={accent} emissiveIntensity={0.04 + aiming * 0.1} />
      </mesh>

      {/* Real glass elements at both ends, inset enough to show optic depth. */}
      <mesh position={[0, 0, -0.382]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.077, 36]} />
        <meshPhysicalMaterial
          color="#7bdcff"
          roughness={0.025}
          metalness={0}
          transmission={0.5}
          thickness={0.07}
          transparent
          opacity={0.5}
          emissive={accent}
          emissiveIntensity={glow}
        />
      </mesh>
      <mesh position={[0, 0, 0.382]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.049, 32]} />
        <meshPhysicalMaterial
          color="#b9f4ff"
          roughness={0.035}
          metalness={0}
          transmission={0.36}
          thickness={0.045}
          transparent
          opacity={0.36}
          emissive={accent}
          emissiveIntensity={0.35 + aiming * 0.45}
        />
      </mesh>

      {/* Internal reticle plane sits inside the tunnel, not outside as a floating disc. */}
      <group position={[0, 0, 0.18]}>
        <Box args={[0.0025, 0.0025, 0.078]} position={[0, 0, 0]} color={accent} emissive={accent} emissiveIntensity={1.2 + aiming} metalness={0.1} roughness={0.16} />
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.0025, 0.0025, 0.078]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.2 + aiming} transparent opacity={0.8} />
        </mesh>
      </group>

      {/* Metallic clamp rings and blue reflection slashes on the objective glass. */}
      {[-0.36, -0.22, 0.22, 0.36].map((z) => (
        <mesh key={z} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[z < -0.3 ? 0.092 : z > 0.3 ? 0.058 : 0.068, 0.008, 12, 36]} />
          <meshStandardMaterial color={metal} metalness={0.94} roughness={0.13} emissive={accent} emissiveIntensity={0.06 + aiming * 0.12} />
        </mesh>
      ))}
      <Box args={[0.006, 0.002, 0.065]} position={[-0.025, 0.038, -0.386]} color="#d9fbff" emissive="#9eeaff" emissiveIntensity={0.85 + aiming * 0.5} metalness={0.05} roughness={0.08} />
      <Box args={[0.004, 0.002, 0.045]} position={[0.028, -0.032, -0.387]} color="#d9fbff" emissive="#9eeaff" emissiveIntensity={0.55 + aiming * 0.35} metalness={0.05} roughness={0.08} />
      <pointLight color={accent} intensity={aiming * 0.65 + shooting * 0.4} distance={2.2} position={[0, 0.02, -0.38]} />
    </group>
  );
}

export function FirstPersonGun({
  weaponId,
  isShooting,
  isAiming,
  isReloading,
  isInspecting,
  movementRef,
  lookRef,
}: Props) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null!);
  const muzzleRef = useRef<THREE.Mesh>(null!);
  const smokeRef = useRef<THREE.Mesh>(null!);
  const tracerRef = useRef<THREE.Mesh>(null!);
  const shellRef = useRef<THREE.Mesh>(null!);
  const movingRef = useRef<THREE.Group>(null!);
  const muzzleLightRef = useRef<THREE.PointLight>(null!);
  const bobRef = useRef(0);
  const shootRef = useRef(0);
  const spinRef = useRef(0);
  const aimRef = useRef(0);
  const reloadRef = useRef(0);
  const inspectRef = useRef(0);

  const cfg = GUN_CONFIGS[weaponId];
  const wep = WEAPONS[weaponId];
  const bz = cfg.body[2];
  const barrelLen = cfg.barrel[2];
  const muzzleZ = -(bz / 2 + barrelLen + 0.055);
  const scratchPositions = useMemo(
    () => Array.from({ length: 10 }, (_, i) => [
      (Math.sin(i * 1.7) * cfg.body[0]) * 0.42,
      cfg.body[1] / 2 + 0.004,
      -bz * 0.38 + i * bz * 0.075,
    ] as [number, number, number]),
    [cfg.body, bz],
  );

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const moveAmount = THREE.MathUtils.clamp(movementRef.current, 0, 1);
    bobRef.current += delta * (4.2 + moveAmount * 5.2);
    spinRef.current += delta * (isShooting || cfg.kind === "minigun" ? 18 : 2.5);

    shootRef.current = isShooting
      ? Math.min(shootRef.current + delta * 34, 1)
      : Math.max(shootRef.current - delta * 10, 0);
    aimRef.current = THREE.MathUtils.lerp(aimRef.current, isAiming ? 1 : 0, 1 - Math.exp(-delta * 14));
    reloadRef.current = THREE.MathUtils.lerp(reloadRef.current, isReloading ? 1 : 0, 1 - Math.exp(-delta * 8));
    inspectRef.current = THREE.MathUtils.lerp(inspectRef.current, isInspecting ? 1 : 0, 1 - Math.exp(-delta * 7));

    const swayScale = wep.sway * (isAiming ? 0.35 : 1);
    const bob = Math.sin(bobRef.current) * 0.007 * (0.25 + moveAmount) * swayScale;
    const bobX = Math.cos(bobRef.current * 0.5) * 0.006 * (0.2 + moveAmount) * swayScale;
    const lookSwayX = THREE.MathUtils.clamp(-lookRef.current.x * 0.0008, -0.035, 0.035) * swayScale;
    const lookSwayY = THREE.MathUtils.clamp(lookRef.current.y * 0.00055, -0.025, 0.025) * swayScale;
    const recoil = shootRef.current * cfg.recoil;
    const aimOffset = cfg.kind === "sniper"
      ? new THREE.Vector3(0.0, -0.205, -0.72)
      : new THREE.Vector3(0.02, -0.145, -0.55);
    const hipOffset = new THREE.Vector3(cfg.offset[0], cfg.offset[1], cfg.offset[2]);
    const baseOffset = hipOffset.lerp(aimOffset, aimRef.current);
    const reloadDrop = Math.sin(reloadRef.current * Math.PI) * 0.1;
    const inspectLift = Math.sin(inspectRef.current * Math.PI) * 0.09;
    const off = new THREE.Vector3(
      baseOffset.x + bobX + lookSwayX + inspectRef.current * -0.08,
      baseOffset.y + bob + lookSwayY - reloadDrop + inspectLift,
      baseOffset.z + recoil + inspectRef.current * 0.08,
    );
    off.applyQuaternion(camera.quaternion);

    groupRef.current.position.copy(camera.position).add(off);
    groupRef.current.quaternion.copy(camera.quaternion);
    groupRef.current.rotateX(shootRef.current * cfg.tilt - reloadRef.current * 0.35 + inspectRef.current * 0.18);
    groupRef.current.rotateY(inspectRef.current * (cfg.kind === "sniper" ? -0.52 : -0.32));
    groupRef.current.rotateZ(Math.sin(shootRef.current * Math.PI) * 0.015 - lookSwayX * 0.8 + inspectRef.current * 0.42);

    if (movingRef.current) {
      movingRef.current.position.z = cfg.kind === "shotgun"
        ? Math.sin(shootRef.current * Math.PI) * 0.08
        : shootRef.current * 0.04;
      movingRef.current.position.y = -Math.sin(reloadRef.current * Math.PI) * 0.045;
      movingRef.current.rotation.x = Math.sin(reloadRef.current * Math.PI) * 0.16;
      movingRef.current.rotation.z = cfg.kind === "minigun" ? spinRef.current : Math.sin(inspectRef.current * Math.PI) * 0.15;
    }

    const flashOn = isShooting;
    if (muzzleRef.current) {
      muzzleRef.current.visible = flashOn;
      muzzleRef.current.scale.set(
        0.9 + Math.random() * 0.8,
        0.5 + Math.random() * 0.3,
        1.0 + Math.random() * 0.9,
      );
    }
    if (smokeRef.current) {
      smokeRef.current.visible = shootRef.current > 0.04;
      smokeRef.current.scale.setScalar(0.65 + shootRef.current * 1.7);
      smokeRef.current.position.z = muzzleZ - shootRef.current * 0.20;
    }
    if (tracerRef.current) {
      tracerRef.current.visible = flashOn && cfg.kind !== "shotgun";
      tracerRef.current.scale.z = cfg.kind === "sniper" || cfg.kind === "marksman" ? 2.8 : 1.5;
    }
    if (shellRef.current) {
      shellRef.current.visible = shootRef.current > 0.03 && cfg.kind !== "launcher";
      shellRef.current.position.set(0.11 + shootRef.current * 0.13, 0.035 + shootRef.current * 0.06, -0.04 + shootRef.current * 0.12);
      shellRef.current.rotation.set(spinRef.current, 0, spinRef.current * 1.7);
    }
    if (muzzleLightRef.current) {
      muzzleLightRef.current.intensity = flashOn ? 5 + Math.random() * 4 : shootRef.current * 0.4;
      muzzleLightRef.current.color.set(cfg.flashColor);
    }
  });

  return (
    <group ref={groupRef}>
      <FloatingHand side={-1} accent={cfg.accentColor} shooting={shootRef.current} reloading={reloadRef.current} />
      <FloatingHand side={1} accent={cfg.accentColor} shooting={shootRef.current} reloading={reloadRef.current} />
      <group ref={movingRef}>
        <Box args={cfg.body} color={cfg.bodyColor} />
        <Box args={[cfg.body[0] * 0.72, 0.018, bz * 0.74]} position={[0, cfg.body[1] / 2 + 0.02, -bz * 0.06]} color={cfg.metalColor} />
        <Box args={[cfg.body[0] * 0.82, 0.012, bz * 0.38]} position={[0, cfg.body[1] / 2 + 0.044, -bz * 0.12]} color={cfg.darkColor} metalness={0.9} roughness={0.18} />
        <Box args={[cfg.body[0] * 0.5, 0.012, bz * 0.22]} position={[0, cfg.body[1] / 2 + 0.061, bz * 0.20]} color={cfg.metalColor} metalness={0.82} roughness={0.2} />
        <Box args={cfg.barrel} position={[0, 0, -(bz / 2 + barrelLen / 2)]} color={cfg.darkColor} metalness={0.9} roughness={0.18} />
        <Box args={[cfg.barrel[0] + 0.022, cfg.barrel[1] + 0.022, 0.035]} position={[0, 0, -(bz / 2 + barrelLen + 0.018)]} color={cfg.metalColor} metalness={0.9} roughness={0.16} />
        <Box args={[cfg.barrel[0] * 0.45, cfg.barrel[1] * 0.45, barrelLen + 0.07]} position={[0, 0, -(bz / 2 + barrelLen / 2 + 0.02)]} color={cfg.accentColor} emissive={cfg.accentColor} emissiveIntensity={0.8 + shootRef.current * 1.2} metalness={0.25} roughness={0.18} />

        <CrystalPrism
          radius={cfg.kind === "launcher" ? 0.055 : cfg.kind === "sniper" ? 0.032 : 0.04}
          depth={cfg.kind === "shotgun" ? 0.2 : 0.24}
          position={[0, 0.012, -bz * 0.09]}
          color={cfg.accentColor}
          intensity={1.35 + shootRef.current * 2.6}
        />
        <pointLight color={cfg.accentColor} intensity={0.45 + shootRef.current * 2.6} distance={2.2} position={[0, 0.02, -bz * 0.1]} />
        {[-1, 1].map((side) => (
          <group key={side}>
            {[0, 1, 2, 3].map((i) => <HeatVent key={i} index={i} color={cfg.accentColor} side={side as 1 | -1} bodyZ={bz} />)}
          </group>
        ))}
        {[-1, 1].map((x) => (
          <Box key={x} args={[0.012, 0.012, bz * 0.58]} position={[x * (cfg.body[0] / 2 + 0.012), -0.012, -bz * 0.06]} color={cfg.metalColor} metalness={0.88} roughness={0.21} />
        ))}

        {cfg.kind === "minigun" && (
          <group position={[0, 0, -(bz / 2 + barrelLen / 2)]}>
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const a = (i / 6) * Math.PI * 2;
              return (
                <Box
                  key={i}
                  args={[0.018, 0.018, barrelLen + 0.12]}
                  position={[Math.cos(a) * 0.045, Math.sin(a) * 0.045, 0]}
                  color={cfg.metalColor}
                  metalness={0.92}
                  roughness={0.18}
                />
              );
            })}
          </group>
        )}

        {cfg.kind === "launcher" && (
          <group position={[0, -0.005, -0.05]}>
            {[0, 1, 2, 3].map((i) => {
              const a = (i / 4) * Math.PI * 2;
              return (
                <mesh key={i} position={[Math.cos(a) * 0.055, Math.sin(a) * 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.03, 0.03, 0.18, 10]} />
                  <meshStandardMaterial color={cfg.accentColor} emissive={cfg.accentColor} emissiveIntensity={0.7} metalness={0.5} roughness={0.35} />
                </mesh>
              );
            })}
          </group>
        )}

        {cfg.kind === "rifle" && (
          <>
            <Box args={[0.055, 0.025, 0.16]} position={[0, -0.072, -0.2]} color={cfg.darkColor} metalness={0.45} roughness={0.48} />
            <Box args={[0.018, 0.05, 0.15]} position={[0.058, 0.025, -0.15]} color={cfg.accentColor} emissive={cfg.accentColor} emissiveIntensity={0.7} />
          </>
        )}

        {cfg.kind === "sniper" && (
          <>
            <SniperScope
              accent={cfg.accentColor}
              metal={cfg.metalColor}
              dark={cfg.darkColor}
              aiming={aimRef.current}
              shooting={shootRef.current}
            />
            <Box args={[0.018, 0.22, 0.018]} position={[-0.055, -0.11, -0.35]} color={cfg.metalColor} />
            <Box args={[0.018, 0.22, 0.018]} position={[0.055, -0.11, -0.35]} color={cfg.metalColor} />
            <Box args={[0.012, 0.012, 0.62]} position={[0, 0.045, -(bz / 2 + 0.1)]} color={cfg.accentColor} emissive={cfg.accentColor} emissiveIntensity={1.1} />
          </>
        )}

        {cfg.kind === "burst" && (
          <>
            <Box args={[0.012, 0.012, bz * 0.9]} position={[cfg.body[0] / 2 + 0.008, 0.01, -0.02]} color={cfg.accentColor} emissive={cfg.accentColor} emissiveIntensity={1.3} />
            <Box args={[0.012, 0.012, bz * 0.7]} position={[-cfg.body[0] / 2 - 0.008, 0.01, -0.06]} color={cfg.accentColor} emissive={cfg.accentColor} emissiveIntensity={1.3} />
            <Box args={[0.058, 0.018, 0.04]} position={[0, cfg.body[1] / 2 + 0.048, 0.13]} color="#071018" emissive={cfg.accentColor} emissiveIntensity={0.6} />
          </>
        )}

        {cfg.kind === "shotgun" && (
          <>
            <Box args={[cfg.body[0] * 0.78, 0.045, 0.24]} position={[0, -0.085, -0.16]} color={cfg.metalColor} />
            {[-0.065, 0.065].map((x) => (
              <Box key={x} args={[0.026, 0.026, 0.10]} position={[x, 0.065, 0.04]} color={cfg.accentColor} roughness={0.24} />
            ))}
          </>
        )}

        {cfg.kind === "marksman" && (
          <>
            <Box args={[cfg.body[0] * 0.95, 0.028, 0.28]} position={[0, -0.005, 0.13]} color="#8a5a34" metalness={0.28} roughness={0.42} />
            <Box args={[cfg.body[0] * 0.6, 0.018, 0.12]} position={[0, 0.065, -0.29]} color="#b9b0a0" metalness={0.15} roughness={0.72} />
          </>
        )}
      </group>

      <Box args={cfg.stock} position={[0, -0.006, bz / 2 + cfg.stock[2] / 2]} color={cfg.darkColor} metalness={0.42} roughness={0.55} />
      <Box args={cfg.grip} position={[0, -(cfg.body[1] / 2 + cfg.grip[1] / 2), bz * 0.12]} color={cfg.darkColor} metalness={0.32} roughness={0.72} />
      <Box args={cfg.mag} position={[0, -(cfg.body[1] / 2 + cfg.mag[1] / 2), -bz * 0.06]} color={cfg.accentColor} metalness={0.55} roughness={0.38} emissive={cfg.kind === "launcher" ? cfg.accentColor : undefined} emissiveIntensity={cfg.kind === "launcher" ? 0.28 : 0} />

      {scratchPositions.map((pos, i) => (
        <Box key={i} args={[0.006, 0.004, 0.045]} position={pos} color="#d7d0be" metalness={0.7} roughness={0.2} />
      ))}

      <mesh ref={muzzleRef} position={[0, 0, muzzleZ]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <coneGeometry args={[0.12, cfg.kind === "sniper" ? 0.48 : 0.30, 7]} />
        <meshStandardMaterial color={cfg.flashColor} emissive={cfg.flashColor} emissiveIntensity={3.5} transparent opacity={0.92} />
      </mesh>
      {Array.from({ length: cfg.kind === "shotgun" || cfg.kind === "launcher" ? 8 : 5 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.035, Math.sin(a) * 0.035, muzzleZ - 0.035]}
            rotation={[Math.PI / 2, 0, a]}
            visible={isShooting}
          >
            <boxGeometry args={[0.008, 0.008, cfg.kind === "sniper" ? 0.22 : 0.13]} />
            <meshStandardMaterial color={cfg.flashColor} emissive={cfg.flashColor} emissiveIntensity={2.4} transparent opacity={0.76} />
          </mesh>
        );
      })}
      <mesh ref={smokeRef} position={[0, 0.015, muzzleZ]} visible={false}>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshStandardMaterial color="#7d7a70" transparent opacity={0.32} roughness={1} />
      </mesh>
      <mesh ref={tracerRef} position={[0, 0, muzzleZ - 0.45]} visible={false}>
        <boxGeometry args={[0.012, 0.012, 0.7]} />
        <meshStandardMaterial color={cfg.flashColor} emissive={cfg.flashColor} emissiveIntensity={2.2} transparent opacity={0.8} />
      </mesh>
      <mesh ref={shellRef} visible={false}>
        <cylinderGeometry args={[0.012, 0.012, cfg.kind === "shotgun" ? 0.08 : 0.055, 8]} />
        <meshStandardMaterial color={cfg.kind === "shotgun" ? "#bf1f1f" : "#c89535"} metalness={0.75} roughness={0.22} />
      </mesh>
      <pointLight ref={muzzleLightRef} color={wep.accent} intensity={0} distance={7} position={[0, 0, muzzleZ]} />
    </group>
  );
}
