import * as THREE from "three";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { WeaponId } from "../types/game";
import { WEAPONS } from "../types/game";

export interface ImpactEvent {
  id: number;
  position: THREE.Vector3;
  timestamp: number;
  normal?: THREE.Vector3;
  weaponId: WeaponId;
  material: ImpactMaterial;
}

export interface TracerEvent {
  id: number;
  start: THREE.Vector3;
  end: THREE.Vector3;
  timestamp: number;
  weaponId: WeaponId;
}

export interface CasingEvent {
  id: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  timestamp: number;
  weaponId: WeaponId;
}

export interface DeathBurstEvent {
  id: number;
  position: THREE.Vector3;
  color: string;
  accent: string;
  timestamp: number;
}

export type ImpactMaterial = "concrete" | "metal" | "wood" | "sand" | "energy" | "flesh";

const DURATION = 520;

const MATERIAL_VFX: Record<ImpactMaterial, {
  spark: string;
  smoke: string;
  decal: string;
  sparkCount: number;
  smokeScale: number;
}> = {
  concrete: { spark: "#ffb347", smoke: "#8f8a7f", decal: "#2a2520", sparkCount: 6, smokeScale: 1.0 },
  metal: { spark: "#ffe27a", smoke: "#6f7680", decal: "#151719", sparkCount: 12, smokeScale: 0.7 },
  wood: { spark: "#ff9b36", smoke: "#7a5c42", decal: "#2d1c10", sparkCount: 4, smokeScale: 1.15 },
  sand: { spark: "#e0c878", smoke: "#c6ad71", decal: "#8a7444", sparkCount: 2, smokeScale: 1.45 },
  energy: { spark: "#60f3ff", smoke: "#273a48", decal: "#073447", sparkCount: 10, smokeScale: 0.8 },
  flesh: { spark: "#ff4f4f", smoke: "#53303a", decal: "#5a0707", sparkCount: 5, smokeScale: 0.75 },
};

interface SparkProps {
  impact: ImpactEvent;
}

function ImpactSpark({ impact }: SparkProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const lightRef = useRef<THREE.PointLight>(null!);
  const coreRef = useRef<THREE.Mesh>(null!);
  const ringsRef = useRef<THREE.Mesh[]>([]);
  const decalRef = useRef<THREE.Mesh>(null!);
  const smokeRef = useRef<THREE.Mesh>(null!);
  const vfx = MATERIAL_VFX[impact.material];
  const wep = WEAPONS[impact.weaponId];
  const explosive = impact.weaponId === "shell_lobber";

  useFrame(() => {
    const age = (Date.now() - impact.timestamp) / DURATION;
    if (age >= 1) return;
    const t = Math.min(age, 1);
    const eased = 1 - Math.pow(1 - t, 2);

    if (lightRef.current) {
      lightRef.current.intensity = (1 - t) * 5;
    }
    if (coreRef.current) {
      const s = explosive ? 0.4 + eased * 1.8 : (1 - eased) * 0.35 + 0.02;
      coreRef.current.scale.setScalar(s);
      const mat = coreRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = explosive ? Math.max(0, 1 - t) : Math.max(0, 1 - t * 1.5);
    }
    if (decalRef.current) {
      const mat = decalRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = Math.max(0, 0.62 - t * 0.18);
    }
    if (smokeRef.current) {
      smokeRef.current.position.y = t * 0.35;
      smokeRef.current.scale.setScalar((0.16 + t * 0.75) * vfx.smokeScale * (explosive ? 2.1 : 1));
      const mat = smokeRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = Math.max(0, 0.38 - t * 0.36);
    }
    ringsRef.current.forEach((ring, i) => {
      if (!ring) return;
      const delay = i * 0.15;
      const localT = Math.max(0, Math.min(1, (t - delay) / (1 - delay)));
      const s = 0.05 + localT * 0.5;
      ring.scale.setScalar(s);
      (ring.material as THREE.MeshStandardMaterial).opacity = Math.max(0, (1 - localT) * 0.7);
    });
  });

  return (
    <group ref={groupRef} position={impact.position}>
      {/* Dynamic light */}
      <pointLight
        ref={lightRef}
        color={wep.accent}
        intensity={explosive ? 10 : 5}
        distance={explosive ? 14 : 8}
        decay={2}
      />

      <mesh ref={decalRef} position={[0, 0.012, 0]} rotation={[Math.PI / 2, 0, impact.id * 0.37]}>
        <circleGeometry args={[explosive ? 1.0 : 0.24, 18]} />
        <meshStandardMaterial color={vfx.decal} transparent opacity={0.62} depthWrite={false} />
      </mesh>

      <mesh ref={smokeRef} position={[0, 0.03, 0]}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshStandardMaterial color={vfx.smoke} transparent opacity={0.38} roughness={1} depthWrite={false} />
      </mesh>

      {/* Core fireball */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[explosive ? 0.55 : 0.3, 8, 8]} />
        <meshStandardMaterial
          color={vfx.spark}
          emissive={wep.accent}
          emissiveIntensity={4}
          transparent
          opacity={1}
          depthWrite={false}
        />
      </mesh>

      {/* Expanding fire rings */}
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(el) => { if (el) ringsRef.current[i] = el; }}
          rotation={[Math.PI / 2 + (i * 0.5), 0, i * 1.1]}
        >
          <torusGeometry args={[0.25, 0.06, 6, 12]} />
          <meshStandardMaterial
            color={explosive ? "#ff9900" : vfx.spark}
            emissive={wep.accent}
            emissiveIntensity={2}
            transparent
            opacity={0.7}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Spark shards flying outward */}
      {Array.from({ length: explosive ? 18 : vfx.sparkCount }, (_, i) => (
        <SparkShard key={i} index={i} startTime={impact.timestamp} color={vfx.spark} explosive={explosive} />
      ))}
    </group>
  );
}

function SparkShard({
  index,
  startTime,
  color,
  explosive,
}: { index: number; startTime: number; color: string; explosive: boolean }) {
  const ref = useRef<THREE.Mesh>(null!);
  const total = explosive ? 18 : 8;
  const angle = (index / total) * Math.PI * 2;
  const speed = (explosive ? 2.6 : 0.8) + (index % 3) * 0.45;
  const up = (explosive ? 1.3 : 0.5) + (index % 2) * 0.8;

  useFrame(() => {
    if (!ref.current) return;
    const t = Math.min((Date.now() - startTime) / DURATION, 1);
    ref.current.position.set(
      Math.cos(angle) * speed * t,
      up * t - 2 * t * t,
      Math.sin(angle) * speed * t,
    );
    (ref.current.material as THREE.MeshStandardMaterial).opacity = Math.max(0, 1 - t * 1.8);
  });

  return (
    <mesh ref={ref}>
      <boxGeometry args={[0.04, 0.04, 0.18]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={2}
        transparent
        opacity={1}
        depthWrite={false}
      />
    </mesh>
  );
}

function BulletTracer({ tracer }: { tracer: TracerEvent }) {
  const ref = useRef<THREE.Mesh>(null!);
  const wep = WEAPONS[tracer.weaponId];
  const dir = tracer.end.clone().sub(tracer.start);
  const len = Math.max(0.1, dir.length());
  const mid = tracer.start.clone().add(tracer.end).multiplyScalar(0.5);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize());

  useFrame(() => {
    const age = Math.min((Date.now() - tracer.timestamp) / 140, 1);
    if (!ref.current) return;
    ref.current.scale.set(1, 1, 1 - age * 0.75);
    (ref.current.material as THREE.MeshStandardMaterial).opacity = Math.max(0, 0.85 - age);
  });

  return (
    <mesh ref={ref} position={mid} quaternion={quat}>
      <boxGeometry args={[0.018, 0.018, len]} />
      <meshStandardMaterial color={wep.accent} emissive={wep.accent} emissiveIntensity={2.8} transparent opacity={0.85} depthWrite={false} />
    </mesh>
  );
}

function ShellCasing({ casing }: { casing: CasingEvent }) {
  const ref = useRef<THREE.Mesh>(null!);
  const pos = useRef(casing.position.clone());
  const vel = useRef(casing.velocity.clone());
  const spin = useRef(new THREE.Vector3(Math.random() * 8, Math.random() * 10, Math.random() * 12));

  useFrame((_, delta) => {
    if (!ref.current) return;
    const dt = Math.min(delta, 0.05);
    vel.current.y -= 8.5 * dt;
    pos.current.addScaledVector(vel.current, dt);
    if (pos.current.y < 0.08) {
      pos.current.y = 0.08;
      vel.current.y = Math.abs(vel.current.y) * 0.28;
      vel.current.x *= 0.68;
      vel.current.z *= 0.68;
    }
    ref.current.position.copy(pos.current);
    ref.current.rotation.x += spin.current.x * dt;
    ref.current.rotation.y += spin.current.y * dt;
    ref.current.rotation.z += spin.current.z * dt;
    const age = Math.min((Date.now() - casing.timestamp) / 1800, 1);
    (ref.current.material as THREE.MeshStandardMaterial).opacity = Math.max(0, 1 - age);
  });

  return (
    <mesh ref={ref}>
      <cylinderGeometry args={[0.018, 0.018, casing.weaponId === "ovomatic" ? 0.09 : 0.06, 8]} />
      <meshStandardMaterial color={casing.weaponId === "ovomatic" ? "#b52020" : "#c89535"} metalness={0.75} roughness={0.24} transparent opacity={1} />
    </mesh>
  );
}

function DeathShard({ burst, index }: { burst: DeathBurstEvent; index: number }) {
  const ref = useRef<THREE.Mesh>(null!);
  const angle = (index / 18) * Math.PI * 2;
  const lift = 0.7 + (index % 5) * 0.22;
  const speed = 1.2 + (index % 4) * 0.34;

  useFrame(() => {
    if (!ref.current) return;
    const t = Math.min((Date.now() - burst.timestamp) / 980, 1);
    const eased = 1 - Math.pow(1 - t, 2);
    ref.current.position.set(
      Math.cos(angle) * speed * eased,
      lift * eased - 1.2 * t * t,
      Math.sin(angle) * speed * eased,
    );
    ref.current.rotation.x += 0.08 + index * 0.002;
    ref.current.rotation.y += 0.05;
    (ref.current.material as THREE.MeshStandardMaterial).opacity = Math.max(0, 1 - t);
  });

  return (
    <mesh ref={ref}>
      <tetrahedronGeometry args={[0.08 + (index % 3) * 0.018, 0]} />
      <meshStandardMaterial color={index % 2 ? burst.color : burst.accent} emissive={burst.accent} emissiveIntensity={1.4} transparent opacity={1} depthWrite={false} />
    </mesh>
  );
}

function DeathBurst({ burst }: { burst: DeathBurstEvent }) {
  const coreRef = useRef<THREE.Mesh>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  const lightRef = useRef<THREE.PointLight>(null!);

  useFrame(() => {
    const t = Math.min((Date.now() - burst.timestamp) / 980, 1);
    if (coreRef.current) {
      coreRef.current.scale.setScalar(0.45 + t * 1.9);
      (coreRef.current.material as THREE.MeshStandardMaterial).opacity = Math.max(0, 0.72 - t * 0.72);
    }
    if (ringRef.current) {
      ringRef.current.scale.setScalar(0.4 + t * 3.2);
      ringRef.current.rotation.z += 0.035;
      (ringRef.current.material as THREE.MeshStandardMaterial).opacity = Math.max(0, 0.84 - t * 0.84);
    }
    if (lightRef.current) lightRef.current.intensity = Math.max(0, 9 - t * 9);
  });

  return (
    <group position={burst.position}>
      <pointLight ref={lightRef} color={burst.accent} intensity={9} distance={12} decay={2} />
      <mesh ref={coreRef} position={[0, 0.75, 0]}>
        <sphereGeometry args={[0.58, 14, 10]} />
        <meshStandardMaterial color={burst.color} emissive={burst.accent} emissiveIntensity={3.2} transparent opacity={0.72} depthWrite={false} />
      </mesh>
      <mesh ref={ringRef} position={[0, 0.72, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.45, 0.035, 8, 32]} />
        <meshStandardMaterial color={burst.accent} emissive={burst.accent} emissiveIntensity={2.8} transparent opacity={0.84} depthWrite={false} />
      </mesh>
      {Array.from({ length: 18 }, (_, index) => <DeathShard key={index} burst={burst} index={index} />)}
    </group>
  );
}

interface Props {
  impacts: ImpactEvent[];
  tracers: TracerEvent[];
  casings: CasingEvent[];
  deathBursts: DeathBurstEvent[];
}

export function BulletEffects({ impacts, tracers, casings, deathBursts }: Props) {
  return (
    <>
      {tracers.map((tracer) => (
        <BulletTracer key={tracer.id} tracer={tracer} />
      ))}
      {casings.map((casing) => (
        <ShellCasing key={casing.id} casing={casing} />
      ))}
      {impacts.map((imp) => (
        <ImpactSpark key={imp.id} impact={imp} />
      ))}
      {deathBursts.map((burst) => (
        <DeathBurst key={burst.id} burst={burst} />
      ))}
    </>
  );
}
