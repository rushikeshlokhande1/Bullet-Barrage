import type { MapId } from "../types/game";

export interface MapBox {
  pos: [number, number, number];
  size: [number, number, number];
  color: string;
  /** If true, no collision is applied (floor, boundary walls, decoration). */
  noCollide?: boolean;
}

export interface MovementPad {
  id: string;
  pos: [number, number, number];
  radius: number;
  impulse: [number, number, number];
  type: "jump" | "launch";
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
  movementPads: MovementPad[];
  spawnPoints: Array<[number, number, number]>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Box sitting flat on the ground (bottom face at y = 0). */
function g(x: number, z: number, w: number, h: number, d: number, color: string): MapBox {
  return { pos: [x, h / 2, z], size: [w, h, d], color };
}

/** Invisible boundary / decoration — no collision. */
function nc(pos: [number,number,number], size: [number,number,number], color: string): MapBox {
  return { pos, size, color, noCollide: true };
}

/**
 * L-shaped spawn corner:  two walls meeting at (cx,cz).
 * sx / sz control which quadrant the L opens toward (±1).
 */
function spawnCorner(
  cx: number, cz: number, sx: number, sz: number, color: string,
): MapBox[] {
  return [
    g(cx,          cz + sz * 2.5, 7,   4, 1.5, color),  // horizontal arm
    g(cx + sx * 3, cz,            1.5, 4, 7,   color),  // vertical arm
  ];
}

// ═════════════════════════════════════════════════════════════════════════════
// MAP DEFINITIONS  (60 × 60 arena)
// ═════════════════════════════════════════════════════════════════════════════

const MAPS: Record<MapId, MapDef> = {

  // MAP 1: Shard Town
  // Bright white arena. Red central building (open E/W), blue-left containers,
  // red-right containers, orange scatter crates. Three clear lanes.
  cracked: {
    id: "cracked",
    name: "Shard Town",
    sky: "#7ec8e3",
    fogColor: "#7ec8e3",
    fogNear: 45,
    fogFar: 110,
    floorColor: "#f0ece0",
    movementPads: [
      { id: "cracked-jump-mid-n", pos: [0, 0.08, -18], radius: 1.45, impulse: [0, 10.5, 0], type: "jump" },
      { id: "cracked-launch-west", pos: [-23, 0.08, 0], radius: 1.65, impulse: [13, 8.5, 0], type: "launch" },
      { id: "cracked-launch-east", pos: [23, 0.08, 0], radius: 1.65, impulse: [-13, 8.5, 0], type: "launch" },
    ],
    spawnPoints: [
      [-25, 1, -25], [25, 1, -25], [-25, 1, 25], [25, 1, 25],
      [0, 1, -28], [0, 1, 28], [-28, 1, 0], [28, 1, 0],
    ],
    boxes: [
      // Floor (no collision — handled by y < PLAYER_HEIGHT)
      nc([0, -0.5, 0], [60, 1, 60], "#f0ece0"),

      // Boundary walls (no collision — MAP_BOUND clamp handles these)
      nc([0,  3.5,  30], [60, 8, 1.5], "#cc4422"),
      nc([0,  3.5, -30], [60, 8, 1.5], "#cc4422"),
      nc([ 30, 3.5, 0], [1.5, 8, 60], "#cc4422"),
      nc([-30, 3.5, 0], [1.5, 8, 60], "#cc4422"),

      // ── Central building (open E/W — two solid N/S walls + roof)
      g(0, -6,  14, 5.5, 1.5, "#dd3311"),           // N wall
      g(0,  6,  14, 5.5, 1.5, "#dd3311"),           // S wall
      // Partial side walls (create doorways at x=0 by leaving 4-unit gap)
      g(-6.5, -2.5, 1.5, 5.5, 7, "#dd3311"),        // W side wall (N half)
      g(-6.5,  2.5, 1.5, 5.5, 7, "#dd3311"),        // W side wall (S half)
      g( 6.5, -2.5, 1.5, 5.5, 7, "#dd3311"),        // E side wall (N half)
      g( 6.5,  2.5, 1.5, 5.5, 7, "#dd3311"),        // E side wall (S half)
      nc([0, 5.75, 0], [14, 0.5, 12], "#bb2200"),   // Roof (no collision)

      // ── Left lane — blue shipping containers
      g(-18,   0, 2, 3.5, 13, "#2255bb"),            // tall N-S blocker
      g(-15, -22, 10, 3.5, 2, "#3366cc"),            // N horizontal
      g(-15,  22, 10, 3.5, 2, "#2244aa"),            // S horizontal

      // ── Right lane — red shipping containers
      g( 18,   0, 2, 3.5, 13, "#cc2211"),            // tall N-S blocker
      g( 15,  22, 10, 3.5, 2, "#dd3322"),            // S horizontal
      g( 15, -22, 10, 3.5, 2, "#bb1100"),            // N horizontal

      // ── Mid-field scatter — orange/yellow crates
      g(-7,  20, 3.5, 2.5, 3.5, "#e8902a"),
      g( 7, -20, 3.5, 2.5, 3.5, "#e8902a"),
      g(-7, -16, 3,   2.5, 3,   "#cc7820"),
      g( 7,  16, 3,   2.5, 3,   "#cc7820"),
      // Low crates — can be jumped over (height 1.2)
      g(-10,  0, 2.5, 1.2, 2.5, "#ddaa50"),
      g( 10,  0, 2.5, 1.2, 2.5, "#ddaa50"),
      // Between building and containers
      g(0, -16, 5, 2.5, 2, "#cc8833"),
      g(0,  16, 5, 2.5, 2, "#cc8833"),

      // ── Corner spawn covers (L-walls)
      ...spawnCorner(-22, -22,  1,  1, "#aaaaaa"),
      ...spawnCorner( 22, -22, -1,  1, "#aaaaaa"),
      ...spawnCorner(-22,  22,  1, -1, "#aaaaaa"),
      ...spawnCorner( 22,  22, -1, -1, "#aaaaaa"),
    ],
  },

  // ── MAP 2: Container Yard ──────────────────────────────────────────────────
  // Sandy floor, red + blue shipping containers, open central warehouse.
  sandstone: {
    id: "sandstone",
    name: "Container Yard",
    sky: "#e8d07a",
    fogColor: "#d4b850",
    fogNear: 45,
    fogFar: 105,
    floorColor: "#e0c878",
    movementPads: [
      { id: "sandstone-jump-center", pos: [0, 0.08, 0], radius: 1.45, impulse: [0, 11.2, 0], type: "jump" },
      { id: "sandstone-launch-north", pos: [0, 0.08, -24], radius: 1.6, impulse: [0, 8.5, 13], type: "launch" },
      { id: "sandstone-launch-south", pos: [0, 0.08, 24], radius: 1.6, impulse: [0, 8.5, -13], type: "launch" },
    ],
    spawnPoints: [
      [-25, 1, -25], [25, 1, -25], [-25, 1, 25], [25, 1, 25],
      [0, 1, -28], [0, 1, 28], [-28, 1, 0], [28, 1, 0],
    ],
    boxes: [
      nc([0, -0.5, 0], [60, 1, 60], "#e0c878"),

      nc([0,  2.5,  30], [60, 6, 1.5], "#9a6a30"),
      nc([0,  2.5, -30], [60, 6, 1.5], "#9a6a30"),
      nc([ 30, 2.5, 0], [1.5, 6, 60], "#9a6a30"),
      nc([-30, 2.5, 0], [1.5, 6, 60], "#9a6a30"),

      // ── Central warehouse: roof + 4 sturdy pillars (open sides)
      nc([0, 5.25, 0], [16, 0.5, 12], "#882200"),   // Roof (no collision)
      g(-7, -5.5, 1.5, 10, 1.5, "#6b1800"),          // NW pillar
      g( 7, -5.5, 1.5, 10, 1.5, "#6b1800"),          // NE pillar
      g(-7,  5.5, 1.5, 10, 1.5, "#6b1800"),          // SW pillar
      g( 7,  5.5, 1.5, 10, 1.5, "#6b1800"),          // SE pillar

      // ── Left lane — red containers
      g(-18,   0, 2, 4, 14, "#cc2211"),
      g(-15, -22, 10, 4, 2, "#bb1100"),
      g(-15,  22, 10, 4, 2, "#dd3322"),
      // Low crate between containers
      g(-18, -12, 3, 1.2, 3, "#dd6633"),

      // ── Right lane — blue containers
      g( 18,   0, 2, 4, 14, "#2244bb"),
      g( 15,  22, 10, 4, 2, "#1133aa"),
      g( 15, -22, 10, 4, 2, "#3355cc"),
      // Low crate
      g( 18,  12, 3, 1.2, 3, "#4477dd"),

      // ── Mid scatter — orange barrels + crates
      g(-5,  22, 3, 2.5, 3,   "#ff6600"),
      g( 5, -22, 3, 2.5, 3,   "#ff6600"),
      g( 0,  22, 4.5, 2.5, 2, "#c08830"),
      g( 0, -22, 4.5, 2.5, 2, "#c08830"),
      g(-5, -18, 2.5, 2.5, 2.5, "#ee8800"),
      g( 5,  18, 2.5, 2.5, 2.5, "#ee8800"),

      // ── Corner spawn covers
      ...spawnCorner(-22, -22,  1,  1, "#b08848"),
      ...spawnCorner( 22, -22, -1,  1, "#b08848"),
      ...spawnCorner(-22,  22,  1, -1, "#b08848"),
      ...spawnCorner( 22,  22, -1, -1, "#b08848"),
    ],
  },

  // MAP 3: Crystal-topia
  // Dark sci-fi rooftop. Neon-edged walls, cyan/magenta containers,
  // central raised platform players can stand on.
  cyber: {
    id: "cyber",
    name: "Crystal-topia",
    sky: "#0d0820",
    fogColor: "#0d0820",
    fogNear: 38,
    fogFar: 95,
    floorColor: "#0a0618",
    movementPads: [
      { id: "cyber-jump-platform", pos: [0, 2.08, 0], radius: 1.5, impulse: [0, 12.4, 0], type: "jump" },
      { id: "cyber-launch-west", pos: [-24, 0.08, -24], radius: 1.55, impulse: [14, 9.5, 14], type: "launch" },
      { id: "cyber-launch-east", pos: [24, 0.08, 24], radius: 1.55, impulse: [-14, 9.5, -14], type: "launch" },
    ],
    spawnPoints: [
      [-25, 1, -25], [25, 1, -25], [-25, 1, 25], [25, 1, 25],
      [0, 1, -28], [0, 1, 28], [-28, 1, 0], [28, 1, 0],
    ],
    boxes: [
      nc([0, -0.5, 0], [60, 1, 60], "#0a0618"),

      nc([0,  3.5,  30], [60, 8, 1.5], "#1a0840"),
      nc([0,  3.5, -30], [60, 8, 1.5], "#1a0840"),
      nc([ 30, 3.5, 0], [1.5, 8, 60], "#1a0840"),
      nc([-30, 3.5, 0], [1.5, 8, 60], "#1a0840"),

      // Neon wall caps (purely decorative)
      nc([0,  7.6,  30], [60, 0.3, 1.5], "#00e5ff"),
      nc([0,  7.6, -30], [60, 0.3, 1.5], "#e040fb"),
      nc([ 30, 7.6, 0], [1.5, 0.3, 60], "#76ff03"),
      nc([-30, 7.6, 0], [1.5, 0.3, 60], "#ff4081"),

      // ── Central raised platform (SOLID — players can stand on top at y≈2)
      // Step blocks leading up (height 1.0 — jumpable)
      g(-9, 0, 4, 1.0, 8, "#0d1428"),               // W step
      g( 9, 0, 4, 1.0, 8, "#0d1428"),               // E step
      // Platform surface at y 1.0–1.3 (top at 1.3m → jumpable from step)
      { pos: [0, 1.65, 0], size: [12, 0.7, 8], color: "#0a1428" }, // Main platform
      // Neon edge strips on platform (no collision)
      nc([0, 2.02, -4], [12, 0.08, 0.3], "#00e5ff"),
      nc([0, 2.02,  4], [12, 0.08, 0.3], "#00e5ff"),
      // Center obelisk on platform
      g(0, 0, 2, 4.5, 2, "#00bcd4"),                 // Center control point

      // ── Left lane — cyan containers
      g(-18,   0, 2, 4, 14, "#00bcd4"),
      g(-15, -22, 10, 4, 2, "#00e5ff"),
      g(-15,  22, 10, 4, 2, "#0097a7"),

      // ── Right lane — magenta containers
      g( 18,   0, 2, 4, 14, "#e040fb"),
      g( 15,  22, 10, 4, 2, "#aa00ff"),
      g( 15, -22, 10, 4, 2, "#ce93d8"),

      // ── Mid scatter — neon crates
      g(-7,  22, 3, 2.5, 3, "#ff4081"),
      g( 7, -22, 3, 2.5, 3, "#ff4081"),
      g(-7, -18, 3, 2.5, 3, "#76ff03"),
      g( 7,  18, 3, 2.5, 3, "#76ff03"),
      // Low crates (jumpable)
      g(-12, 0, 2.5, 1.0, 2.5, "#ff1744"),
      g( 12, 0, 2.5, 1.0, 2.5, "#ff1744"),

      // ── Corner spawn covers (dark with neon top strips)
      ...spawnCorner(-22, -22,  1,  1, "#0d1428"),
      ...spawnCorner( 22, -22, -1,  1, "#0d1428"),
      ...spawnCorner(-22,  22,  1, -1, "#0d1428"),
      ...spawnCorner( 22,  22, -1, -1, "#0d1428"),
    ],
  },

  overpass: {
    id: "overpass",
    name: "Overpass",
    sky: "#9fb8c8",
    fogColor: "#9fb8c8",
    fogNear: 48,
    fogFar: 120,
    floorColor: "#30343a",
    movementPads: [
      { id: "overpass-jump-mid", pos: [0, 0.08, 0], radius: 1.35, impulse: [0, 10.8, 0], type: "jump" },
      { id: "overpass-launch-left", pos: [-24, 0.08, 18], radius: 1.55, impulse: [12, 8.5, -10], type: "launch" },
      { id: "overpass-launch-right", pos: [24, 0.08, -18], radius: 1.55, impulse: [-12, 8.5, 10], type: "launch" },
    ],
    spawnPoints: [
      [-25, 1, -25], [25, 1, 25], [-24, 1, 24], [24, 1, -24],
      [-28, 1, -6], [28, 1, 6], [-6, 1, 28], [6, 1, -28],
    ],
    boxes: [
      nc([0, -0.5, 0], [60, 1, 60], "#30343a"),
      nc([0, 3.5, 30], [60, 8, 1.5], "#26313a"),
      nc([0, 3.5, -30], [60, 8, 1.5], "#26313a"),
      nc([30, 3.5, 0], [1.5, 8, 60], "#26313a"),
      nc([-30, 3.5, 0], [1.5, 8, 60], "#26313a"),

      // Mid overpass: high ground with clear, readable supports.
      { pos: [0, 3.2, 0], size: [30, 0.7, 5.5], color: "#58616b" },
      g(-13, 0, 2, 3.2, 5.5, "#3c444d"),
      g(13, 0, 2, 3.2, 5.5, "#3c444d"),
      g(0, -6.5, 8, 2.8, 2, "#434b54"),
      g(0, 6.5, 8, 2.8, 2, "#434b54"),

      // Mid choke blockers create two doorways under the bridge.
      g(-4.5, 0, 2.2, 3.8, 8, "#2d333a"),
      g(4.5, 0, 2.2, 3.8, 8, "#2d333a"),

      // Side lanes and flank pockets.
      g(-19, -12, 2, 3, 16, "#1f5f86"),
      g(-14, -22, 11, 3, 2, "#2676a3"),
      g(-22, 10, 2, 2.5, 11, "#1f5f86"),
      g(19, 12, 2, 3, 16, "#9b4b20"),
      g(14, 22, 11, 3, 2, "#b76028"),
      g(22, -10, 2, 2.5, 11, "#9b4b20"),

      // Spawn safety pockets.
      ...spawnCorner(-23, -23, 1, 1, "#6b747c"),
      ...spawnCorner(23, 23, -1, -1, "#6b747c"),
      ...spawnCorner(-23, 23, 1, -1, "#5d6870"),
      ...spawnCorner(23, -23, -1, 1, "#5d6870"),

      // Low mid cover for rotations without blocking silhouettes.
      g(-8, 14, 4, 1.2, 3, "#7d8790"),
      g(8, -14, 4, 1.2, 3, "#7d8790"),
      g(0, 20, 7, 1.4, 2, "#6e7882"),
      g(0, -20, 7, 1.4, 2, "#6e7882"),
    ],
  },

  foundry: {
    id: "foundry",
    name: "Foundry",
    sky: "#30150d",
    fogColor: "#30150d",
    fogNear: 42,
    fogFar: 100,
    floorColor: "#201816",
    movementPads: [
      { id: "foundry-jump-catwalk", pos: [-10, 0.08, 0], radius: 1.35, impulse: [0, 11.5, 0], type: "jump" },
      { id: "foundry-launch-flank", pos: [22, 0.08, 0], radius: 1.55, impulse: [-14, 8.5, 0], type: "launch" },
    ],
    spawnPoints: [
      [-25, 1, -24], [25, 1, 24], [-25, 1, 24], [25, 1, -24],
      [-28, 1, 0], [28, 1, 0], [0, 1, -28], [0, 1, 28],
    ],
    boxes: [
      nc([0, -0.5, 0], [60, 1, 60], "#201816"),
      nc([0, 3.5, 30], [60, 8, 1.5], "#4a1f14"),
      nc([0, 3.5, -30], [60, 8, 1.5], "#4a1f14"),
      nc([30, 3.5, 0], [1.5, 8, 60], "#4a1f14"),
      nc([-30, 3.5, 0], [1.5, 8, 60], "#4a1f14"),

      // Furnace core: strong central silhouette and hard chokepoint.
      g(0, 0, 7, 5, 7, "#8b240e"),
      nc([0, 5.2, 0], [8, 0.3, 8], "#ff6a00"),
      g(0, -9, 12, 3.2, 2, "#66210f"),
      g(0, 9, 12, 3.2, 2, "#66210f"),

      // Catwalk high ground crossing one side.
      { pos: [-12, 3.0, 0], size: [4, 0.7, 26], color: "#5d4a3c" },
      g(-12, -14, 4, 3, 2, "#4b3c31"),
      g(-12, 14, 4, 3, 2, "#4b3c31"),
      g(-18, 0, 2, 2.4, 18, "#3f332d"),

      // Opposite low flank with staggered cover and sight breaks.
      g(15, -17, 10, 3, 2, "#a05222"),
      g(18, -5, 2, 2.6, 10, "#a05222"),
      g(15, 17, 10, 3, 2, "#a05222"),
      g(18, 5, 2, 2.6, 10, "#a05222"),
      g(8, -20, 3, 1.2, 3, "#d27a2c"),
      g(8, 20, 3, 1.2, 3, "#d27a2c"),

      // Spawn protection and readable safe exits.
      ...spawnCorner(-23, -23, 1, 1, "#6b2d18"),
      ...spawnCorner(23, 23, -1, -1, "#6b2d18"),
      ...spawnCorner(-23, 23, 1, -1, "#6b2d18"),
      ...spawnCorner(23, -23, -1, 1, "#6b2d18"),

      // Small lane cover.
      g(-4, -18, 3, 1.2, 3, "#b96a2a"),
      g(4, 18, 3, 1.2, 3, "#b96a2a"),
      g(-3, 18, 4, 2.2, 2, "#7a3b1d"),
      g(3, -18, 4, 2.2, 2, "#7a3b1d"),
    ],
  },
};

export function getMap(id: MapId): MapDef {
  return MAPS[id] ?? MAPS["cracked"];
}

export const ALL_MAP_IDS: MapId[] = ["cracked", "sandstone", "cyber", "overpass", "foundry"];
