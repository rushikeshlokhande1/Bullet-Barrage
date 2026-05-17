import { useMemo } from "react";
import type { MapId } from "../types/game";
import { getMap } from "../data/maps";
import type { ImpactMaterial } from "./BulletEffect";

interface Props {
  mapId: MapId;
}

export function Arena({ mapId }: Props) {
  const map = getMap(mapId);
  const inferMaterial = (color: string): ImpactMaterial => {
    const c = color.toLowerCase();
    if (c.includes("00e") || c.includes("e040") || c.includes("76ff") || c.includes("ff40")) return "energy";
    if (c.includes("22") || c.includes("33") || c.includes("44") || c.includes("aa")) return "metal";
    if (c.includes("e0c") || c.includes("c0") || c.includes("b0")) return "sand";
    if (c.includes("88") || c.includes("6a") || c.includes("78")) return "wood";
    return "concrete";
  };
  const meshes = useMemo(
    () =>
      map.boxes.map((b, i) => (
        <mesh
          key={i}
          position={b.pos}
          userData={{ mapBox: !b.noCollide, impactMaterial: inferMaterial(b.color) }}
        >
          <boxGeometry args={b.size} />
          <meshLambertMaterial color={b.color} />
        </mesh>
      )),
    [mapId],
  );
  const pads = useMemo(
    () =>
      map.movementPads.map((pad) => (
        <group key={pad.id} position={pad.pos} userData={{ movementPad: pad.type }}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[pad.radius, pad.radius, 0.08, 28]} />
            <meshStandardMaterial
              color={pad.type === "jump" ? "#53c7ff" : "#ffc400"}
              emissive={pad.type === "jump" ? "#00e5ff" : "#ff7a18"}
              emissiveIntensity={1.2}
              transparent
              opacity={0.74}
            />
          </mesh>
          <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[pad.radius * 0.76, 0.035, 8, 32]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive={pad.type === "jump" ? "#53c7ff" : "#ffc400"}
              emissiveIntensity={1.8}
              transparent
              opacity={0.85}
            />
          </mesh>
        </group>
      )),
    [mapId],
  );
  return <>{meshes}{pads}</>;
}
