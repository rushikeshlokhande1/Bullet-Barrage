import * as THREE from "three";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

export interface ImpactEvent {
  id: number;
  position: THREE.Vector3;
  timestamp: number;
  normal?: THREE.Vector3;
}

const DURATION = 380;

interface SparkProps {
  impact: ImpactEvent;
}

function ImpactSpark({ impact }: SparkProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const lightRef = useRef<THREE.PointLight>(null!);
  const coreRef = useRef<THREE.Mesh>(null!);
  const ringsRef = useRef<THREE.Mesh[]>([]);

  useFrame(() => {
    const age = (Date.now() - impact.timestamp) / DURATION;
    if (age >= 1) return;
    const t = Math.min(age, 1);
    const eased = 1 - Math.pow(1 - t, 2);

    if (lightRef.current) {
      lightRef.current.intensity = (1 - t) * 5;
    }
    if (coreRef.current) {
      const s = (1 - eased) * 0.35 + 0.02;
      coreRef.current.scale.setScalar(s);
      const mat = coreRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = Math.max(0, 1 - t * 1.5);
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
        color="#ff8800"
        intensity={5}
        distance={8}
        decay={2}
      />

      {/* Core fireball */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshStandardMaterial
          color="#ffcc00"
          emissive="#ff6600"
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
            color="#ff6600"
            emissive="#ff3300"
            emissiveIntensity={2}
            transparent
            opacity={0.7}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Spark shards flying outward */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <SparkShard key={i} index={i} startTime={impact.timestamp} />
      ))}
    </group>
  );
}

function SparkShard({ index, startTime }: { index: number; startTime: number }) {
  const ref = useRef<THREE.Mesh>(null!);
  const angle = (index / 8) * Math.PI * 2;
  const speed = 0.8 + (index % 3) * 0.4;
  const up = 0.5 + (index % 2) * 0.8;

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
        color="#ffaa00"
        emissive="#ff6600"
        emissiveIntensity={2}
        transparent
        opacity={1}
        depthWrite={false}
      />
    </mesh>
  );
}

interface Props {
  impacts: ImpactEvent[];
}

export function BulletEffects({ impacts }: Props) {
  return (
    <>
      {impacts.map((imp) => (
        <ImpactSpark key={imp.id} impact={imp} />
      ))}
    </>
  );
}
