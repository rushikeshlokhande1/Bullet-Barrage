import * as THREE from "three";
import { useMemo } from "react";

const WALL_COLOR = "#2c3e50";
const FLOOR_COLOR = "#1a1a2e";
const OBSTACLE_COLOR = "#34495e";

interface Box {
  pos: [number, number, number];
  size: [number, number, number];
  color?: string;
}

const BOXES: Box[] = [
  { pos: [0, -0.5, 0], size: [60, 1, 60], color: FLOOR_COLOR },
  { pos: [0, 5, 30], size: [60, 10, 1], color: WALL_COLOR },
  { pos: [0, 5, -30], size: [60, 10, 1], color: WALL_COLOR },
  { pos: [30, 5, 0], size: [1, 10, 60], color: WALL_COLOR },
  { pos: [-30, 5, 0], size: [1, 10, 60], color: WALL_COLOR },
  { pos: [8, 1.5, 8], size: [4, 3, 4], color: OBSTACLE_COLOR },
  { pos: [-8, 1.5, 8], size: [4, 3, 4], color: OBSTACLE_COLOR },
  { pos: [8, 1.5, -8], size: [4, 3, 4], color: OBSTACLE_COLOR },
  { pos: [-8, 1.5, -8], size: [4, 3, 4], color: OBSTACLE_COLOR },
  { pos: [0, 1.5, 0], size: [5, 3, 5], color: "#1a252f" },
  { pos: [18, 1.5, 0], size: [2, 3, 8], color: OBSTACLE_COLOR },
  { pos: [-18, 1.5, 0], size: [2, 3, 8], color: OBSTACLE_COLOR },
  { pos: [0, 1.5, 18], size: [8, 3, 2], color: OBSTACLE_COLOR },
  { pos: [0, 1.5, -18], size: [8, 3, 2], color: OBSTACLE_COLOR },
  { pos: [15, 3, 15], size: [3, 2, 3], color: "#16213e" },
  { pos: [-15, 3, 15], size: [3, 2, 3], color: "#16213e" },
  { pos: [15, 3, -15], size: [3, 2, 3], color: "#16213e" },
  { pos: [-15, 3, -15], size: [3, 2, 3], color: "#16213e" },
];

export const arenaBoxes = BOXES.filter((b) => b.size[1] > 1);

export function Arena() {
  const meshes = useMemo(
    () =>
      BOXES.map((b, i) => (
        <mesh key={i} position={b.pos} castShadow={false} receiveShadow={false}>
          <boxGeometry args={b.size} />
          <meshLambertMaterial color={b.color ?? OBSTACLE_COLOR} />
        </mesh>
      )),
    [],
  );

  return <>{meshes}</>;
}
