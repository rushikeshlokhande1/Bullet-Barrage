import { useMemo } from "react";
import type { MapId } from "../types/game";
import { getMap } from "../data/maps";

interface Props {
  mapId: MapId;
}

export function Arena({ mapId }: Props) {
  const map = getMap(mapId);
  const meshes = useMemo(
    () =>
      map.boxes.map((b, i) => (
        <mesh
          key={i}
          position={b.pos}
          userData={{ mapBox: !b.noCollide }}
        >
          <boxGeometry args={b.size} />
          <meshLambertMaterial color={b.color} />
        </mesh>
      )),
    [mapId],
  );
  return <>{meshes}</>;
}
