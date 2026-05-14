import type { MapId } from "../types/game";

export interface MapBox {
  pos: [number, number, number];
  size: [number, number, number];
  color: string;
}

export interface MapDef {
  id: MapId;
  name: string;
  sky: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  floorColor: string;
  boxes: MapBox[];
  spawnPoints: Array<[number, number, number]>;
}

const MAPS: Record<MapId, MapDef> = {
  cracked: {
    id: "cracked",
    name: "Farm",
    sky: "#4fc3f7",
    fogColor: "#4fc3f7",
    fogNear: 40,
    fogFar: 130,
    floorColor: "#6aaa2c",
    spawnPoints: [
      [0, 1, -22], [0, 1, 22], [22, 1, 0], [-22, 1, 0],
      [16, 1, 16], [-16, 1, 16], [16, 1, -16], [-16, 1, -16],
    ],
    boxes: [
      // Floor
      { pos: [0, -0.5, 0], size: [80, 1, 80], color: "#6aaa2c" },
      // Outer walls
      { pos: [0, 4, 38], size: [76, 9, 1], color: "#8b6914" },
      { pos: [0, 4, -38], size: [76, 9, 1], color: "#8b6914" },
      { pos: [38, 4, 0], size: [1, 9, 76], color: "#8b6914" },
      { pos: [-38, 4, 0], size: [1, 9, 76], color: "#8b6914" },
      // Hay bales (cover blocks)
      { pos: [10, 1, 0], size: [3, 2, 3], color: "#d4a017" },
      { pos: [-10, 1, 0], size: [3, 2, 3], color: "#d4a017" },
      { pos: [0, 1, 10], size: [3, 2, 3], color: "#d4a017" },
      { pos: [0, 1, -10], size: [3, 2, 3], color: "#d4a017" },
      // Barn walls
      { pos: [20, 2, 0], size: [2, 4, 14], color: "#c0392b" },
      { pos: [-20, 2, 0], size: [2, 4, 14], color: "#c0392b" },
      { pos: [0, 2, 20], size: [14, 4, 2], color: "#c0392b" },
      { pos: [0, 2, -20], size: [14, 4, 2], color: "#c0392b" },
      // Corner crates
      { pos: [14, 1.5, 14], size: [4, 3, 4], color: "#8b6914" },
      { pos: [-14, 1.5, 14], size: [4, 3, 4], color: "#8b6914" },
      { pos: [14, 1.5, -14], size: [4, 3, 4], color: "#8b6914" },
      { pos: [-14, 1.5, -14], size: [4, 3, 4], color: "#8b6914" },
      // Elevated platforms
      { pos: [28, 2, 10], size: [5, 4, 5], color: "#c0392b" },
      { pos: [-28, 2, -10], size: [5, 4, 5], color: "#c0392b" },
    ],
  },
  sandstone: {
    id: "sandstone",
    name: "Scrambled",
    sky: "#ffd54f",
    fogColor: "#ffd54f",
    fogNear: 35,
    fogFar: 120,
    floorColor: "#d4a843",
    spawnPoints: [
      [0, 1, -22], [0, 1, 22], [22, 1, 0], [-22, 1, 0],
      [15, 1, 15], [-15, 1, 15], [15, 1, -15], [-15, 1, -15],
    ],
    boxes: [
      { pos: [0, -0.5, 0], size: [80, 1, 80], color: "#d4a843" },
      { pos: [0, 4, 38], size: [76, 9, 1], color: "#a07832" },
      { pos: [0, 4, -38], size: [76, 9, 1], color: "#a07832" },
      { pos: [38, 4, 0], size: [1, 9, 76], color: "#a07832" },
      { pos: [-38, 4, 0], size: [1, 9, 76], color: "#a07832" },
      // Pyramids (tall towers)
      { pos: [12, 4, 12], size: [5, 8, 5], color: "#e8c56a" },
      { pos: [-12, 4, 12], size: [5, 8, 5], color: "#e8c56a" },
      { pos: [12, 4, -12], size: [5, 8, 5], color: "#e8c56a" },
      { pos: [-12, 4, -12], size: [5, 8, 5], color: "#e8c56a" },
      // Low walls
      { pos: [22, 1.5, 0], size: [2, 3, 18], color: "#c4974a" },
      { pos: [-22, 1.5, 0], size: [2, 3, 18], color: "#c4974a" },
      { pos: [0, 1.5, 22], size: [18, 3, 2], color: "#c4974a" },
      { pos: [0, 1.5, -22], size: [18, 3, 2], color: "#c4974a" },
      // Center oasis
      { pos: [0, 0.5, 0], size: [6, 1, 6], color: "#3a8fca" },
      // Rocks
      { pos: [30, 1.5, 10], size: [3, 3, 3], color: "#a07832" },
      { pos: [-30, 1.5, -10], size: [3, 3, 3], color: "#a07832" },
    ],
  },
  cyber: {
    id: "cyber",
    name: "Yolk-topia",
    sky: "#1a0a2e",
    fogColor: "#1a0a2e",
    fogNear: 25,
    fogFar: 100,
    floorColor: "#12082a",
    spawnPoints: [
      [0, 1, -20], [0, 1, 20], [20, 1, 0], [-20, 1, 0],
      [14, 1, 14], [-14, 1, 14], [14, 1, -14], [-14, 1, -14],
    ],
    boxes: [
      { pos: [0, -0.5, 0], size: [76, 1, 76], color: "#12082a" },
      { pos: [0, 4, 38], size: [76, 9, 1], color: "#200840" },
      { pos: [0, 4, -38], size: [76, 9, 1], color: "#200840" },
      { pos: [38, 4, 0], size: [1, 9, 76], color: "#200840" },
      { pos: [-38, 4, 0], size: [1, 9, 76], color: "#200840" },
      // Neon blocks
      { pos: [0, 2, 0], size: [5, 4, 5], color: "#00e5ff" },
      { pos: [11, 2, 0], size: [2, 4, 10], color: "#e040fb" },
      { pos: [-11, 2, 0], size: [2, 4, 10], color: "#e040fb" },
      { pos: [0, 2, 11], size: [10, 4, 2], color: "#00e676" },
      { pos: [0, 2, -11], size: [10, 4, 2], color: "#00e676" },
      { pos: [21, 2, 10], size: [3, 4, 3], color: "#ff1744" },
      { pos: [-21, 2, 10], size: [3, 4, 3], color: "#ff1744" },
      { pos: [21, 2, -10], size: [3, 4, 3], color: "#ff9100" },
      { pos: [-21, 2, -10], size: [3, 4, 3], color: "#ff9100" },
      { pos: [26, 3, 0], size: [2, 10, 8], color: "#2979ff" },
      { pos: [-26, 3, 0], size: [2, 10, 8], color: "#2979ff" },
      { pos: [0, 3, 26], size: [8, 10, 2], color: "#2979ff" },
      { pos: [0, 3, -26], size: [8, 10, 2], color: "#2979ff" },
    ],
  },
};

export function getMap(id: MapId): MapDef {
  return MAPS[id] ?? MAPS["cracked"];
}

export const ALL_MAP_IDS: MapId[] = ["cracked", "sandstone", "cyber"];
