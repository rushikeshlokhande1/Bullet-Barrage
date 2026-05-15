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

// Helpers ─────────────────────────────────────────────────────────────────────

/** Box whose bottom face sits exactly on the ground (y=0). */
function g(x: number, z: number, w: number, h: number, d: number, color: string): MapBox {
  return { pos: [x, h / 2, z], size: [w, h, d], color };
}

/** L-shaped spawn cover — two walls meeting at a corner. */
function spawnCorner(cx: number, cz: number, sx: number, sz: number, color: string): MapBox[] {
  // sx/sz are ±1 to control which direction the L opens
  return [
    { pos: [cx, 2, cz + sz * 1.25], size: [5, 4, 1.5], color },
    { pos: [cx + sx * 1.75, 2, cz], size: [1.5, 4, 5], color },
  ];
}

// ═════════════════════════════════════════════════════════════════════════════
// MAP DEFINITIONS
// ═════════════════════════════════════════════════════════════════════════════

const MAPS: Record<MapId, MapDef> = {

  // ── MAP 1: Egg Town ────────────────────────────────────────────────────────
  // 3-lane arena with a central red building, blue/red shipping containers,
  // and orange crates. Bright, high-visibility. White floor.
  cracked: {
    id: "cracked",
    name: "Egg Town",
    sky: "#7ec8e3",
    fogColor: "#7ec8e3",
    fogNear: 30,
    fogFar: 80,
    floorColor: "#f0ece0",
    spawnPoints: [
      [-17, 1, -17], [17, 1, -17], [-17, 1, 17], [17, 1, 17],
      [0, 1, -19], [0, 1, 19], [-19, 1, 0], [19, 1, 0],
    ],
    boxes: [
      // ── Floor
      { pos: [0, -0.5, 0], size: [42, 1, 42], color: "#f0ece0" },

      // ── Boundary walls (bright red-orange)
      { pos: [0, 3.5, 21],  size: [42, 8, 1.5], color: "#cc4422" },
      { pos: [0, 3.5, -21], size: [42, 8, 1.5], color: "#cc4422" },
      { pos: [21, 3.5, 0],  size: [1.5, 8, 42], color: "#cc4422" },
      { pos: [-21, 3.5, 0], size: [1.5, 8, 42], color: "#cc4422" },

      // ── Central building (open E/W, N+S walls + 4 pillars + roof)
      g(0, -4.5, 10, 5, 1.5, "#dd3311"),     // N wall
      g(0,  4.5, 10, 5, 1.5, "#dd3311"),     // S wall
      g(-4.5, -2, 1, 5, 5,   "#dd3311"),     // NW pillar
      g( 4.5, -2, 1, 5, 5,   "#dd3311"),     // NE pillar
      g(-4.5,  2, 1, 5, 5,   "#dd3311"),     // SW pillar
      g( 4.5,  2, 1, 5, 5,   "#dd3311"),     // SE pillar
      { pos: [0, 5.25, 0], size: [10, 0.5, 9], color: "#bb2200" }, // Roof

      // ── Left lane — blue shipping containers (provide full standing cover)
      g(-13,  0, 2, 3, 8,   "#2255bb"),      // tall vertical container
      g(-10, -10, 6, 3, 2,  "#3366cc"),      // horizontal container
      g(-10,  10, 6, 3, 2,  "#2244aa"),      // horizontal container

      // ── Right lane — red shipping containers (mirrored)
      g(13,   0, 2, 3, 8,   "#cc2211"),      // tall vertical container
      g(10,  10, 6, 3, 2,   "#dd3322"),      // horizontal container
      g(10, -10, 6, 3, 2,   "#bb1100"),      // horizontal container

      // ── Mid scatter — orange crates (between lanes)
      g(-6,  12, 3, 2.5, 3, "#e8902a"),
      g( 6, -12, 3, 2.5, 3, "#e8902a"),
      g(-6,  -9, 2.5, 2.5, 2.5, "#cc7820"),
      g( 6,   9, 2.5, 2.5, 2.5, "#cc7820"),

      // ── Corner spawn covers (L-shaped walls)
      ...spawnCorner(-16, -16,  1,  1, "#aaaaaa"),  // NW
      ...spawnCorner( 16, -16, -1,  1, "#aaaaaa"),  // NE
      ...spawnCorner(-16,  16,  1, -1, "#aaaaaa"),  // SW
      ...spawnCorner( 16,  16, -1, -1, "#aaaaaa"),  // SE
    ],
  },

  // ── MAP 2: Container Yard ──────────────────────────────────────────────────
  // Sandy floor, colorful shipping containers, central open warehouse.
  // Red vs blue containers form the lane structure. Bright warm palette.
  sandstone: {
    id: "sandstone",
    name: "Container Yard",
    sky: "#e8d07a",
    fogColor: "#d4b850",
    fogNear: 30,
    fogFar: 75,
    floorColor: "#e0c878",
    spawnPoints: [
      [-17, 1, -17], [17, 1, -17], [-17, 1, 17], [17, 1, 17],
      [0, 1, -19], [0, 1, 19], [-19, 1, 0], [19, 1, 0],
    ],
    boxes: [
      // ── Floor (sandy)
      { pos: [0, -0.5, 0], size: [42, 1, 42], color: "#e0c878" },

      // ── Boundary (wooden fence look)
      { pos: [0, 2.5, 21],  size: [42, 6, 1.5], color: "#9a6a30" },
      { pos: [0, 2.5, -21], size: [42, 6, 1.5], color: "#9a6a30" },
      { pos: [21, 2.5, 0],  size: [1.5, 6, 42], color: "#9a6a30" },
      { pos: [-21, 2.5, 0], size: [1.5, 6, 42], color: "#9a6a30" },

      // ── Central warehouse: open-sided, just roof + 4 pillars
      { pos: [0, 5, 0], size: [14, 0.5, 10], color: "#882200" },  // Roof
      g(-6.5, -4.5, 1.2, 9.5, 1.2, "#6b1800"),  // NW pillar
      g( 6.5, -4.5, 1.2, 9.5, 1.2, "#6b1800"),  // NE pillar
      g(-6.5,  4.5, 1.2, 9.5, 1.2, "#6b1800"),  // SW pillar
      g( 6.5,  4.5, 1.2, 9.5, 1.2, "#6b1800"),  // SE pillar

      // ── Left lane — red containers
      g(-13,  0, 2, 3.5, 9, "#cc2211"),          // long side-wall container
      g(-10, -11, 7, 3.5, 2, "#bb1100"),          // front container
      g(-10,  11, 7, 3.5, 2, "#dd3322"),          // back container

      // ── Right lane — blue containers
      g(13,   0, 2, 3.5, 9, "#2244bb"),           // long side-wall container
      g(10,  11, 7, 3.5, 2, "#1133aa"),           // back container
      g(10, -11, 7, 3.5, 2, "#3355cc"),           // front container

      // ── Mid scatter — orange barrels + crates
      g(-5,  13, 2.5, 2.5, 2.5, "#ff6600"),
      g( 5, -13, 2.5, 2.5, 2.5, "#ff6600"),
      g( 0,  13, 4,   2.5, 2,   "#c08830"),       // wide crate row
      g( 0, -13, 4,   2.5, 2,   "#c08830"),
      g(-5, -11, 2,   2.5, 2,   "#ee8800"),
      g( 5,  11, 2,   2.5, 2,   "#ee8800"),

      // ── Corner spawn covers
      ...spawnCorner(-16, -16,  1,  1, "#b08848"),
      ...spawnCorner( 16, -16, -1,  1, "#b08848"),
      ...spawnCorner(-16,  16,  1, -1, "#b08848"),
      ...spawnCorner( 16,  16, -1, -1, "#b08848"),
    ],
  },

  // ── MAP 3: Yolk-topia ─────────────────────────────────────────────────────
  // Dark sci-fi rooftop. Neon cyan/magenta containers, glowing center platform,
  // neon-edged perimeter. Compact 3-lane layout with vertical feel.
  cyber: {
    id: "cyber",
    name: "Yolk-topia",
    sky: "#0d0820",
    fogColor: "#0d0820",
    fogNear: 22,
    fogFar: 65,
    floorColor: "#0a0618",
    spawnPoints: [
      [-17, 1, -17], [17, 1, -17], [-17, 1, 17], [17, 1, 17],
      [0, 1, -19], [0, 1, 19], [-19, 1, 0], [19, 1, 0],
    ],
    boxes: [
      // ── Floor (dark tile)
      { pos: [0, -0.5, 0], size: [42, 1, 42], color: "#0a0618" },
      // Grid lines on floor
      { pos: [0, -0.38, 0],  size: [42, 0.1, 0.3],  color: "#1a0840" },
      { pos: [0, -0.38, 0],  size: [0.3, 0.1, 42],  color: "#1a0840" },
      { pos: [0, -0.38, -7], size: [42, 0.1, 0.15], color: "#120630" },
      { pos: [0, -0.38,  7], size: [42, 0.1, 0.15], color: "#120630" },

      // ── Boundary walls (dark with neon edge glow)
      { pos: [0, 3.5,  21], size: [42, 8, 1.5], color: "#1a0840" },
      { pos: [0, 3.5, -21], size: [42, 8, 1.5], color: "#1a0840" },
      { pos: [21, 3.5,  0], size: [1.5, 8, 42], color: "#1a0840" },
      { pos: [-21, 3.5, 0], size: [1.5, 8, 42], color: "#1a0840" },
      // Top edge neon strips
      { pos: [0, 7.6,  21], size: [42, 0.3, 1.5], color: "#00e5ff" },
      { pos: [0, 7.6, -21], size: [42, 0.3, 1.5], color: "#e040fb" },
      { pos: [21, 7.6,  0], size: [1.5, 0.3, 42], color: "#76ff03" },
      { pos: [-21, 7.6, 0], size: [1.5, 0.3, 42], color: "#ff4081" },

      // ── Central raised platform (accessible via side-step boxes)
      g(-5, 0, 3, 1.5, 8, "#0d1428"),             // W approach ramp
      g( 5, 0, 3, 1.5, 8, "#0d1428"),             // E approach ramp
      { pos: [0, 2.15, 0], size: [10, 0.3, 6], color: "#0a1428" },  // Platform top
      { pos: [0, 2.32, -3], size: [10, 0.12, 0.4], color: "#00e5ff" }, // N neon edge
      { pos: [0, 2.32,  3], size: [10, 0.12, 0.4], color: "#00e5ff" }, // S neon edge
      // Central object on platform
      g(0, 0, 2, 4, 2, "#00bcd4"),                 // Center hotspot block

      // ── Left lane — cyan containers
      g(-13,   0, 2, 3.5, 9, "#00bcd4"),
      g(-10, -10, 6, 3.5, 2, "#00e5ff"),
      g(-10,  10, 6, 3.5, 2, "#0097a7"),

      // ── Right lane — magenta containers
      g( 13,   0, 2, 3.5, 9, "#e040fb"),
      g( 10,  10, 6, 3.5, 2, "#aa00ff"),
      g( 10, -10, 6, 3.5, 2, "#ce93d8"),

      // ── Mid scatter — neon crates
      g(-5,  12, 2.5, 2.5, 2.5, "#ff4081"),
      g( 5, -12, 2.5, 2.5, 2.5, "#ff4081"),
      g(-5, -10, 2.5, 2.5, 2.5, "#76ff03"),
      g( 5,  10, 2.5, 2.5, 2.5, "#76ff03"),

      // ── Corner spawn covers (dark with neon tops)
      ...spawnCorner(-16, -16,  1,  1, "#0d1428"),
      ...spawnCorner( 16, -16, -1,  1, "#0d1428"),
      ...spawnCorner(-16,  16,  1, -1, "#0d1428"),
      ...spawnCorner( 16,  16, -1, -1, "#0d1428"),
    ],
  },
};

export function getMap(id: MapId): MapDef {
  return MAPS[id] ?? MAPS["cracked"];
}

export const ALL_MAP_IDS: MapId[] = ["cracked", "sandstone", "cyber"];
