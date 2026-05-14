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
  fog: [string, number, number];
  boxes: MapBox[];
  spawnPoints: Array<[number, number, number]>;
}

const MAPS: Record<MapId, MapDef> = {
  cracked: {
    id: "cracked",
    name: "CRACKED",
    sky: "#87ceeb",
    fog: ["#87ceeb", 40, 120],
    spawnPoints: [
      [0, 1, -20], [0, 1, 20], [20, 1, 0], [-20, 1, 0],
      [14, 1, 14], [-14, 1, 14], [14, 1, -14], [-14, 1, -14],
    ],
    boxes: [
      { pos: [0, -0.5, 0], size: [70, 1, 70], color: "#7c8c4e" },
      { pos: [0, 5, 35], size: [70, 12, 1], color: "#5a6e32" },
      { pos: [0, 5, -35], size: [70, 12, 1], color: "#5a6e32" },
      { pos: [35, 5, 0], size: [1, 12, 70], color: "#5a6e32" },
      { pos: [-35, 5, 0], size: [1, 12, 70], color: "#5a6e32" },
      { pos: [8, 2, 0], size: [2, 4, 12], color: "#e8d5a3" },
      { pos: [-8, 2, 0], size: [2, 4, 12], color: "#e8d5a3" },
      { pos: [0, 2, 8], size: [12, 4, 2], color: "#e8d5a3" },
      { pos: [0, 2, -8], size: [12, 4, 2], color: "#e8d5a3" },
      { pos: [18, 2, 10], size: [3, 4, 3], color: "#d4a373" },
      { pos: [-18, 2, 10], size: [3, 4, 3], color: "#d4a373" },
      { pos: [18, 2, -10], size: [3, 4, 3], color: "#d4a373" },
      { pos: [-18, 2, -10], size: [3, 4, 3], color: "#d4a373" },
      { pos: [25, 1.5, 0], size: [4, 3, 8], color: "#c0a060" },
      { pos: [-25, 1.5, 0], size: [4, 3, 8], color: "#c0a060" },
      { pos: [0, 1.5, 25], size: [8, 3, 4], color: "#c0a060" },
      { pos: [0, 1.5, -25], size: [8, 3, 4], color: "#c0a060" },
    ],
  },
  sandstone: {
    id: "sandstone",
    name: "SANDSTONE",
    sky: "#e8c87a",
    fog: ["#e8c87a", 30, 110],
    spawnPoints: [
      [0, 1, -22], [0, 1, 22], [22, 1, 0], [-22, 1, 0],
      [15, 1, 15], [-15, 1, 15], [15, 1, -15], [-15, 1, -15],
    ],
    boxes: [
      { pos: [0, -0.5, 0], size: [70, 1, 70], color: "#c9a96e" },
      { pos: [0, 5, 35], size: [70, 12, 1], color: "#b8854a" },
      { pos: [0, 5, -35], size: [70, 12, 1], color: "#b8854a" },
      { pos: [35, 5, 0], size: [1, 12, 70], color: "#b8854a" },
      { pos: [-35, 5, 0], size: [1, 12, 70], color: "#b8854a" },
      { pos: [0, 3, 0], size: [6, 6, 6], color: "#d4a96b" },
      { pos: [12, 4, 12], size: [5, 8, 5], color: "#e0b87a" },
      { pos: [-12, 4, 12], size: [5, 8, 5], color: "#e0b87a" },
      { pos: [12, 4, -12], size: [5, 8, 5], color: "#e0b87a" },
      { pos: [-12, 4, -12], size: [5, 8, 5], color: "#e0b87a" },
      { pos: [22, 2, 0], size: [2, 4, 16], color: "#cc9955" },
      { pos: [-22, 2, 0], size: [2, 4, 16], color: "#cc9955" },
      { pos: [0, 2, 22], size: [16, 4, 2], color: "#cc9955" },
      { pos: [0, 2, -22], size: [16, 4, 2], color: "#cc9955" },
      { pos: [8, 2, -20], size: [4, 4, 4], color: "#b07840" },
      { pos: [-8, 2, -20], size: [4, 4, 4], color: "#b07840" },
    ],
  },
  cyber: {
    id: "cyber",
    name: "CYBERZONE",
    sky: "#0d0d1a",
    fog: ["#0d0d1a", 20, 90],
    spawnPoints: [
      [0, 1, -20], [0, 1, 20], [20, 1, 0], [-20, 1, 0],
      [12, 1, 12], [-12, 1, 12], [12, 1, -12], [-12, 1, -12],
    ],
    boxes: [
      { pos: [0, -0.5, 0], size: [70, 1, 70], color: "#111122" },
      { pos: [0, 5, 35], size: [70, 12, 1], color: "#1a1a33" },
      { pos: [0, 5, -35], size: [70, 12, 1], color: "#1a1a33" },
      { pos: [-35, 5, 0], size: [1, 12, 70], color: "#1a1a33" },
      { pos: [35, 5, 0], size: [1, 12, 70], color: "#1a1a33" },
      { pos: [0, 2, 0], size: [5, 4, 5], color: "#00cccc" },
      { pos: [10, 2, 0], size: [2, 4, 10], color: "#cc00cc" },
      { pos: [-10, 2, 0], size: [2, 4, 10], color: "#cc00cc" },
      { pos: [0, 2, 10], size: [10, 4, 2], color: "#00cc88" },
      { pos: [0, 2, -10], size: [10, 4, 2], color: "#00cc88" },
      { pos: [20, 2, 10], size: [3, 4, 3], color: "#cc4400" },
      { pos: [-20, 2, 10], size: [3, 4, 3], color: "#cc4400" },
      { pos: [20, 2, -10], size: [3, 4, 3], color: "#cc4400" },
      { pos: [-20, 2, -10], size: [3, 4, 3], color: "#cc4400" },
      { pos: [24, 2, 0], size: [2, 8, 8], color: "#0044cc" },
      { pos: [-24, 2, 0], size: [2, 8, 8], color: "#0044cc" },
      { pos: [0, 2, 24], size: [8, 8, 2], color: "#0044cc" },
      { pos: [0, 2, -24], size: [8, 8, 2], color: "#0044cc" },
    ],
  },
};

export function getMap(id: MapId): MapDef {
  return MAPS[id] ?? MAPS["cracked"];
}

export const ALL_MAP_IDS: MapId[] = ["cracked", "sandstone", "cyber"];
