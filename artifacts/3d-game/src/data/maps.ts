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

// Helper: box sitting on the ground at Y=0
function floor(x: number, z: number, w: number, h: number, d: number, color: string): MapBox {
  return { pos: [x, h / 2, z], size: [w, h, d], color };
}

const MAPS: Record<MapId, MapDef> = {
  // ─────────────────────────────────────────────────────── FARM MAP
  cracked: {
    id: "cracked",
    name: "Farm",
    sky: "#5bbce4",
    fogColor: "#5bbce4",
    fogNear: 55,
    fogFar: 160,
    floorColor: "#5a9e1e",
    spawnPoints: [
      [-45, 1, -45], [45, 1, -45], [-45, 1, 45], [45, 1, 45],
      [0, 1, -45], [0, 1, 45], [-45, 1, 0], [45, 1, 0],
      [-20, 1, -20], [20, 1, 20], [20, 1, -20], [-20, 1, 20],
    ],
    boxes: [
      // ── Floor & paths
      { pos: [0, -0.5, 0], size: [130, 1, 130], color: "#5a9e1e" },
      { pos: [0, -0.35, 0], size: [7, 0.4, 130], color: "#b89050" },  // N-S path
      { pos: [0, -0.35, 0], size: [130, 0.4, 7], color: "#b89050" },  // E-W path

      // ── Boundary walls
      { pos: [0, 3.5, 63], size: [130, 8, 2], color: "#5a3010" },
      { pos: [0, 3.5, -63], size: [130, 8, 2], color: "#5a3010" },
      { pos: [63, 3.5, 0], size: [2, 8, 130], color: "#5a3010" },
      { pos: [-63, 3.5, 0], size: [2, 8, 130], color: "#5a3010" },

      // ── Central barn (hollow rectangle with gaps for entry)
      floor(0, -9, 22, 5.5, 2, "#8b2500"),             // North wall
      floor(0, 9, 22, 5.5, 2, "#8b2500"),              // South wall
      floor(-11, 0, 2, 5.5, 18, "#8b2500"),            // West wall
      floor(11, 0, 2, 5.5, 18, "#8b2500"),             // East wall
      { pos: [0, 6, 0], size: [22, 1, 18], color: "#6b1e00" }, // Roof
      // Barn interior dividers (creates separate rooms)
      floor(-3, 0, 2, 4, 7, "#7a2500"),
      floor(3, 0, 2, 4, 7, "#7a2500"),

      // ── North silos
      floor(-8, -38, 5, 12, 5, "#c0c8b8"),
      floor(8, -38, 5, 12, 5, "#c0c8b8"),
      floor(0, -32, 14, 2.5, 3, "#8b6914"),            // connecting low wall

      // ── South shed (3 walls + roof)
      floor(-7, 38, 2, 5, 14, "#6b3010"),
      floor(7, 38, 2, 5, 14, "#6b3010"),
      floor(0, 31.5, 14, 5, 2, "#6b3010"),
      { pos: [0, 5.5, 38], size: [14, 1, 14], color: "#5a2810" },

      // ── East fence line (with gaps to pass through)
      floor(35, -25, 2, 4, 16, "#7a4820"),
      floor(35, 2, 2, 4, 18, "#7a4820"),
      floor(35, 28, 2, 4, 16, "#7a4820"),

      // ── West fence line
      floor(-35, -28, 2, 4, 16, "#7a4820"),
      floor(-35, -2, 2, 4, 18, "#7a4820"),
      floor(-35, 25, 2, 4, 16, "#7a4820"),

      // ── NE corner house
      floor(40, -40, 12, 5, 2, "#c4a875"),             // South wall
      floor(34, -46, 2, 5, 12, "#c4a875"),             // West wall
      floor(46, -46, 2, 5, 12, "#c4a875"),             // East wall
      floor(38, -52, 5, 5, 2, "#c4a875"),              // North wall left (gap in middle)
      floor(44, -52, 4, 5, 2, "#c4a875"),              // North wall right
      { pos: [40, 5.5, -46], size: [12, 1, 12], color: "#a08450" }, // Roof

      // ── SW ruins (broken walls)
      floor(-40, 40, 12, 3.5, 2, "#909090"),
      floor(-46, 35, 2, 3.5, 9, "#909090"),
      floor(-34, 46, 7, 2, 2, "#888"),
      floor(-46, 46, 5, 2, 4, "#999"),

      // ── NW corner - water tower
      floor(-45, -42, 4, 9, 4, "#7090a0"),             // Tank
      floor(-43, -42, 1, 9, 1, "#607080"),             // Leg NE
      floor(-47, -42, 1, 9, 1, "#607080"),             // Leg NW
      floor(-45, -40, 1, 9, 1, "#607080"),             // Leg S
      floor(-42, -38, 6, 1.5, 6, "#506070"),           // Platform

      // ── SE corner - crate cluster
      floor(38, 36, 4, 3, 4, "#8b6914"),
      floor(44, 38, 3, 2, 3, "#7a5810"),
      floor(40, 43, 5, 2, 3, "#6b4a10"),
      floor(36, 42, 3, 3, 5, "#9b7a20"),

      // ── Mid-map cover: hay bales (player can't jump over, provide crouching cover)
      floor(18, 18, 5, 2.5, 3, "#d4a017"),
      floor(-18, -18, 5, 2.5, 3, "#d4a017"),
      floor(18, -18, 3, 2.5, 5, "#c89a14"),
      floor(-18, 18, 3, 2.5, 5, "#c89a14"),

      // ── Mid-map barrels & crates
      floor(24, 0, 3, 2.5, 3, "#8b4513"),
      floor(-24, 0, 3, 2.5, 3, "#8b4513"),
      floor(0, 24, 3, 2.5, 3, "#7a5510"),
      floor(0, -24, 3, 2.5, 3, "#7a5510"),

      // ── Low sandbag walls (crouching cover, H=1.5)
      floor(14, -14, 10, 1.5, 1.5, "#b09050"),
      floor(-14, 14, 10, 1.5, 1.5, "#b09050"),
      floor(14, 14, 1.5, 1.5, 10, "#a08040"),
      floor(-14, -14, 1.5, 1.5, 10, "#a08040"),

      // ── Elevated platform (NE mid area)
      floor(28, -14, 8, 1.5, 8, "#8b5010"),            // Platform top
      floor(28, -10, 1.5, 2, 8, "#7a4010"),            // Platform wall east
      floor(24, -14, 1.5, 2, 8, "#7a4010"),            // Platform wall west

      // ── Scattered individual crates
      floor(-30, 14, 3, 3, 3, "#7a5010"),
      floor(30, -14, 3, 3, 3, "#7a5010"),
      floor(-50, -14, 3, 3, 3, "#8b6014"),
      floor(50, 14, 3, 3, 3, "#8b6014"),
      floor(-14, -50, 3, 2.5, 3, "#c4a030"),
      floor(14, 50, 3, 2.5, 3, "#c4a030"),
    ],
  },

  // ─────────────────────────────────────────────── SCRAMBLED (DESERT)
  sandstone: {
    id: "sandstone",
    name: "Scrambled",
    sky: "#f5c842",
    fogColor: "#e8b830",
    fogNear: 55,
    fogFar: 160,
    floorColor: "#d4a843",
    spawnPoints: [
      [-45, 1, -45], [45, 1, -45], [-45, 1, 45], [45, 1, 45],
      [0, 1, -45], [0, 1, 45], [-45, 1, 0], [45, 1, 0],
      [-22, 1, -22], [22, 1, 22], [22, 1, -22], [-22, 1, 22],
    ],
    boxes: [
      { pos: [0, -0.5, 0], size: [130, 1, 130], color: "#d4a843" },
      { pos: [0, 3.5, 63], size: [130, 8, 2], color: "#b07830" },
      { pos: [0, 3.5, -63], size: [130, 8, 2], color: "#b07830" },
      { pos: [63, 3.5, 0], size: [2, 8, 130], color: "#b07830" },
      { pos: [-63, 3.5, 0], size: [2, 8, 130], color: "#b07830" },

      // Central temple ruin
      floor(0, 0, 3, 6, 3, "#e8c56a"),                 // Center pillar
      floor(-8, 0, 3, 8, 3, "#e8c56a"),                // West pillar
      floor(8, 0, 3, 8, 3, "#e8c56a"),                 // East pillar
      floor(0, -8, 3, 8, 3, "#e8c56a"),                // North pillar
      floor(0, 8, 3, 8, 3, "#e8c56a"),                 // South pillar
      { pos: [0, 7.5, 0], size: [20, 1.5, 20], color: "#d4b055" }, // Partial roof

      // Dunes / sand mounds (broad low cover)
      floor(-30, 0, 10, 3, 10, "#ddb860"),
      floor(30, 0, 10, 3, 10, "#ddb860"),
      floor(0, 30, 10, 3, 10, "#ddb860"),
      floor(0, -30, 10, 3, 10, "#ddb860"),

      // Long canyon walls
      floor(-20, -30, 2, 5, 22, "#c4974a"),
      floor(20, 30, 2, 5, 22, "#c4974a"),
      floor(-30, 20, 22, 5, 2, "#c4974a"),
      floor(30, -20, 22, 5, 2, "#c4974a"),

      // Corner ruins
      floor(42, -42, 14, 5, 2, "#b08040"),
      floor(35, -49, 2, 5, 14, "#b08040"),
      floor(49, -49, 2, 5, 14, "#b08040"),

      floor(-42, 42, 14, 5, 2, "#b08040"),
      floor(-35, 49, 2, 5, 14, "#b08040"),
      floor(-49, 49, 2, 5, 14, "#b08040"),

      // Oasis (small water feature)
      { pos: [-40, 0.2, -40], size: [8, 0.4, 8], color: "#2090c8" },
      floor(-44, -40, 2, 3, 8, "#5a8030"),             // Oasis reeds
      floor(-40, -44, 8, 3, 2, "#5a8030"),

      // Rock boulders (scattered, all solid)
      floor(15, -15, 5, 4, 5, "#a08050"),
      floor(-15, 15, 5, 4, 5, "#a08050"),
      floor(45, 15, 4, 4, 4, "#9a7040"),
      floor(-45, -15, 4, 4, 4, "#9a7040"),
      floor(20, 45, 4, 3, 4, "#9a7040"),
      floor(-20, -45, 4, 3, 4, "#9a7040"),

      // Low walls
      floor(25, -10, 12, 2.5, 2, "#c49050"),
      floor(-25, 10, 12, 2.5, 2, "#c49050"),
      floor(-10, -25, 2, 2.5, 12, "#c49050"),
      floor(10, 25, 2, 2.5, 12, "#c49050"),

      // Elevated sniper tower
      floor(48, 48, 5, 8, 5, "#b09050"),               // Tower body
      floor(45, 45, 8, 0.8, 8, "#9a7a40"),             // Platform
    ],
  },

  // ─────────────────────────────────────────────── YOLK-TOPIA (CYBER)
  cyber: {
    id: "cyber",
    name: "Yolk-topia",
    sky: "#0e0620",
    fogColor: "#0e0620",
    fogNear: 45,
    fogFar: 140,
    floorColor: "#0a0418",
    spawnPoints: [
      [-45, 1, -45], [45, 1, -45], [-45, 1, 45], [45, 1, 45],
      [0, 1, -45], [0, 1, 45], [-45, 1, 0], [45, 1, 0],
      [-22, 1, -22], [22, 1, 22], [22, 1, -22], [-22, 1, 22],
    ],
    boxes: [
      { pos: [0, -0.5, 0], size: [130, 1, 130], color: "#0a0418" },
      { pos: [0, -0.35, 0], size: [8, 0.2, 130], color: "#1a0430" },
      { pos: [0, -0.35, 0], size: [130, 0.2, 8], color: "#1a0430" },
      { pos: [0, 3.5, 63], size: [130, 8, 2], color: "#150330" },
      { pos: [0, 3.5, -63], size: [130, 8, 2], color: "#150330" },
      { pos: [63, 3.5, 0], size: [2, 8, 130], color: "#150330" },
      { pos: [-63, 3.5, 0], size: [2, 8, 130], color: "#150330" },

      // Central neon hub
      floor(0, 0, 6, 8, 6, "#00e5ff"),
      floor(-12, 0, 2, 6, 16, "#e040fb"),
      floor(12, 0, 2, 6, 16, "#e040fb"),
      floor(0, -12, 16, 6, 2, "#00e676"),
      floor(0, 12, 16, 6, 2, "#00e676"),
      { pos: [0, 7, 0], size: [16, 1, 16], color: "#001824" },   // Hub roof

      // Neon towers (cover + sight lines)
      floor(-28, -28, 3, 12, 3, "#ff1744"),
      floor(28, 28, 3, 12, 3, "#ff1744"),
      floor(28, -28, 3, 12, 3, "#ffea00"),
      floor(-28, 28, 3, 12, 3, "#ffea00"),

      // Energy barriers (long glowing walls)
      floor(-22, -10, 2, 5, 18, "#2979ff"),
      floor(22, 10, 2, 5, 18, "#2979ff"),
      floor(-10, 22, 18, 5, 2, "#2979ff"),
      floor(10, -22, 18, 5, 2, "#2979ff"),

      // Server racks (room-like clusters)
      floor(-38, -10, 2, 6, 12, "#1a3050"),
      floor(-44, -10, 2, 6, 12, "#1a3050"),
      floor(-41, -4, 6, 6, 2, "#1a3050"),
      floor(-41, -16, 6, 6, 2, "#1a3050"),

      floor(38, 10, 2, 6, 12, "#1a3050"),
      floor(44, 10, 2, 6, 12, "#1a3050"),
      floor(41, 4, 6, 6, 2, "#1a3050"),
      floor(41, 16, 6, 6, 2, "#1a3050"),

      // Floating platforms (elevated cover)
      { pos: [30, 4, -30], size: [10, 0.8, 10], color: "#0a1428" },
      { pos: [30, 4.4, -30], size: [10, 0.2, 1.5], color: "#2979ff" },  // Edge glow
      { pos: [-30, 4, 30], size: [10, 0.8, 10], color: "#0a1428" },
      { pos: [-30, 4.4, 30], size: [10, 0.2, 1.5], color: "#e040fb" },

      // Corner bunkers
      floor(-46, -46, 10, 5, 2, "#101830"),
      floor(-40, -52, 2, 5, 12, "#101830"),
      floor(-52, -52, 2, 5, 12, "#101830"),

      floor(46, 46, 10, 5, 2, "#101830"),
      floor(40, 52, 2, 5, 12, "#101830"),
      floor(52, 52, 2, 5, 12, "#101830"),

      // Scattered neon crates
      floor(18, 18, 3, 3, 3, "#ff6d00"),
      floor(-18, -18, 3, 3, 3, "#ff6d00"),
      floor(18, -18, 3, 3, 3, "#00bcd4"),
      floor(-18, 18, 3, 3, 3, "#00bcd4"),
      floor(35, 0, 3, 3, 3, "#76ff03"),
      floor(-35, 0, 3, 3, 3, "#76ff03"),
      floor(0, 35, 3, 3, 3, "#ff4081"),
      floor(0, -35, 3, 3, 3, "#ff4081"),

      // Low cover walls
      floor(15, -5, 10, 2, 2, "#0d1a2e"),
      floor(-15, 5, 10, 2, 2, "#0d1a2e"),
      floor(5, 15, 2, 2, 10, "#0d1a2e"),
      floor(-5, -15, 2, 2, 10, "#0d1a2e"),
    ],
  },
};

export function getMap(id: MapId): MapDef {
  return MAPS[id] ?? MAPS["cracked"];
}

export const ALL_MAP_IDS: MapId[] = ["cracked", "sandstone", "cyber"];
