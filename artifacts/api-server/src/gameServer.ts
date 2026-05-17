import { Server as SocketIOServer, Socket } from "socket.io";
import { createServer } from "http";
import type { Express } from "express";
import { logger } from "./lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Player {
  id: string;
  nickname: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number };
  health: number;
  shield: number;
  maxShield: number;
  lastDamageAt: number;
  lastShieldUpdateAt: number;
  kills: number;
  deaths: number;
  alive: boolean;
  color: string;
  weapon: string;
  mapId: MapId;
  roomKey: RoomKey;
  lobbyId?: string;
}

type MapId = "cracked" | "sandstone" | "cyber" | "overpass" | "foundry";
type RoomKey = string;
type BotState = "idle" | "patrol" | "chase" | "attack" | "dead";
type PrivateLobbyStatus = "waiting" | "playing";

interface PrivateLobbyMember {
  clientToken: string;
  socketId?: string;
  nickname: string;
  connected: boolean;
  isHost: boolean;
  player?: Player;
  disconnectTimer?: ReturnType<typeof setTimeout>;
}

interface PrivateLobby {
  id: string;
  name: string;
  displayName: string;
  password: string;
  hostToken: string;
  mapId: MapId;
  maxPlayers: number;
  status: PrivateLobbyStatus;
  roomKey: RoomKey;
  createdAt: number;
  members: Map<string, PrivateLobbyMember>;
}

interface Bot extends Player {
  state: BotState;
  waypointX: number;
  waypointZ: number;
  path: Array<{ x: number; z: number }>;
  pathGoal?: { x: number; z: number };
  nextPathAt: number;
  stuckTime: number;
  lastPosition: { x: number; z: number };
  lastShot: number;
  strafDir: number;
  strafTimer: number;
  idleTimer: number;
  velY: number;
  isGrounded: boolean;
  jumpTimer: number;
  respawnTimer: number;
  fireRate: number;
  accuracy: number;
  /** True when bot is advancing toward player to get line-of-sight ("peeking") */
  isPeeking: boolean;
  /** Remaining time in current peek or cover phase */
  peekTimer: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAYER_COLORS = [
  "#e74c3c", "#3498db", "#2ecc71", "#f39c12",
  "#9b59b6", "#1abc9c", "#e67e22", "#e91e63",
  "#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4",
];

const BOT_NAMES = [
  "ShardViper", "CoreWarden", "RailSpecter", "QuartzAce",
  "ArcRipper", "VantaDrift", "PrismWolf", "CinderZero",
  "IonReaper", "HexRunner",
];

const BOT_WEAPONS = [
  "cluckfire",
  "ovomatic",
  "yolkpiercer",
  "shell_lobber",
  "rapid_yolker",
  "crackling_burst",
  "runny_marksman",
];

const SPAWN_POINTS = [
  { x: -25, y: 0.8, z: -25 }, { x: 25, y: 0.8, z: -25 },
  { x: -25, y: 0.8, z:  25 }, { x: 25, y: 0.8, z:  25 },
  { x:   0, y: 0.8, z: -28 }, { x:  0, y: 0.8, z:  28 },
  { x: -28, y: 0.8, z:   0 }, { x: 28, y: 0.8, z:   0 },
];

const WAYPOINTS = [
  ...SPAWN_POINTS.map((p) => ({ x: p.x, z: p.z })),
  { x:  0, z:  0 },  { x: -12, z:  0 }, { x: 12, z:  0 },
  { x:  0, z: -12 }, { x:   0, z: 12 },
  { x: -18, z: -8 }, { x: 18, z:  8 },
  { x: -18, z:  8 }, { x: 18, z: -8 },
  { x:  -8, z:-18 }, { x:  8, z: 18 },
  { x:   8, z:-18 }, { x: -8, z: 18 },
];

const MAX_HEALTH = 100;
const MAX_SHIELD = 75;
const SHIELD_RECHARGE_DELAY = 4200;
const SHIELD_RECHARGE_RATE = 22;
const RESPAWN_DELAY = 3000;
const MAX_MATCH_PLAYERS = 8;
const MIN_PRIVATE_PLAYERS_TO_START = 2;
const PRIVATE_RECONNECT_GRACE_MS = 45_000;
const BOT_SPEED = 5.5;
const BOT_TICK = 100;
const MULTIPLAYER_BOT_TICK = 120;
const GRAVITY = -20;
const PLAYER_HEIGHT = 0.8;
const BOT_RADIUS = 0.38;
const BOT_HEIGHT = 1.7;
const MAP_BOUND = 33;
const NAV_CELL = 2.5;
const NAV_MIN = -28.75;
const NAV_SIZE = 24;
const SIGHT_RANGE = 32;
const ATTACK_RANGE = 22;

// ─── 2D Line-of-Sight ─────────────────────────────────────────────────────────
//
// Collidable cover rectangles [x0, x1, z0, z1] shared across all maps.
// These approximate the central building walls and lane containers.

const COVER_RECTS_2D: Array<[number, number, number, number]> = [
  // Central building walls (N/S solid walls)
  [-7,  7, -6.75, -5.25],
  [-7,  7,  5.25,  6.75],
  // Central building side walls
  [-7.25, -5.75, -6,  1],
  [-7.25, -5.75, -1,  6],
  [ 5.75,  7.25, -6,  1],
  [ 5.75,  7.25, -1,  6],
  // Left lane — tall vertical container
  [-19, -17, -7, 7],
  // Left lane — N/S horizontal containers
  [-20, -10, -23, -21],
  [-20, -10,  21,  23],
  // Right lane — tall vertical container
  [ 17,  19, -7,  7],
  // Right lane — N/S horizontal containers
  [ 10,  20,  21,  23],
  [ 10,  20, -23, -21],
  // Corner spawn L-walls (approximate)
  [-25, -19, -23.5, -22],  [-21.5, -19.5, -25, -19],
  [ 19,  25, -23.5, -22],  [ 19.5,  21.5, -25, -19],
  [-25, -19,  22, 23.5],   [-21.5, -19.5,  19,  25],
  [ 19,  25,  22, 23.5],   [ 19.5,  21.5,  19,  25],
];

/**
 * 2D parametric ray–AABB intersection test.
 * Returns false (blocked) if the segment from (ax,az)→(bx,bz) passes through any cover rect.
 */
function hasLineOfSight2D(ax: number, az: number, bx: number, bz: number): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  for (const [rx0, rx1, rz0, rz1] of COVER_RECTS_2D) {
    let tMin = 0, tMax = 1;

    if (Math.abs(dx) < 1e-8) {
      if (ax < rx0 || ax > rx1) continue;
    } else {
      const t1 = (rx0 - ax) / dx;
      const t2 = (rx1 - ax) / dx;
      tMin = Math.max(tMin, Math.min(t1, t2));
      tMax = Math.min(tMax, Math.max(t1, t2));
      if (tMin > tMax) continue;
    }

    if (Math.abs(dz) < 1e-8) {
      if (az < rz0 || az > rz1) continue;
    } else {
      const t1 = (rz0 - az) / dz;
      const t2 = (rz1 - az) / dz;
      tMin = Math.max(tMin, Math.min(t1, t2));
      tMax = Math.min(tMax, Math.max(t1, t2));
      if (tMin > tMax) continue;
    }

    if (tMax >= 0 && tMin <= 1) return false; // blocked
  }
  return true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface AABB {
  x0: number; x1: number;
  y0: number; y1: number;
  z0: number; z1: number;
}

function box(x: number, z: number, w: number, h: number, d: number): AABB {
  return {
    x0: x - w / 2,
    x1: x + w / 2,
    y0: 0,
    y1: h,
    z0: z - d / 2,
    z1: z + d / 2,
  };
}

function centeredBox(x: number, y: number, z: number, w: number, h: number, d: number): AABB {
  return {
    x0: x - w / 2,
    x1: x + w / 2,
    y0: y - h / 2,
    y1: y + h / 2,
    z0: z - d / 2,
    z1: z + d / 2,
  };
}

function spawnCornerBoxes(cx: number, cz: number, sx: number, sz: number): AABB[] {
  return [
    box(cx, cz + sz * 2.5, 7, 4, 1.5),
    box(cx + sx * 3, cz, 1.5, 4, 7),
  ];
}

const SHARED_SPAWN_COVER = [
  ...spawnCornerBoxes(-22, -22,  1,  1),
  ...spawnCornerBoxes( 22, -22, -1,  1),
  ...spawnCornerBoxes(-22,  22,  1, -1),
  ...spawnCornerBoxes( 22,  22, -1, -1),
];

const MAP_COVER: Record<MapId, AABB[]> = {
  cracked: [
    box(0, -6, 14, 5.5, 1.5), box(0, 6, 14, 5.5, 1.5),
    box(-6.5, -2.5, 1.5, 5.5, 7), box(-6.5, 2.5, 1.5, 5.5, 7),
    box(6.5, -2.5, 1.5, 5.5, 7), box(6.5, 2.5, 1.5, 5.5, 7),
    box(-18, 0, 2, 3.5, 13), box(-15, -22, 10, 3.5, 2), box(-15, 22, 10, 3.5, 2),
    box(18, 0, 2, 3.5, 13), box(15, 22, 10, 3.5, 2), box(15, -22, 10, 3.5, 2),
    box(-7, 20, 3.5, 2.5, 3.5), box(7, -20, 3.5, 2.5, 3.5),
    box(-7, -16, 3, 2.5, 3), box(7, 16, 3, 2.5, 3),
    box(-10, 0, 2.5, 1.2, 2.5), box(10, 0, 2.5, 1.2, 2.5),
    box(0, -16, 5, 2.5, 2), box(0, 16, 5, 2.5, 2),
    ...SHARED_SPAWN_COVER,
  ],
  sandstone: [
    box(-7, -5.5, 1.5, 10, 1.5), box(7, -5.5, 1.5, 10, 1.5),
    box(-7, 5.5, 1.5, 10, 1.5), box(7, 5.5, 1.5, 10, 1.5),
    box(-18, 0, 2, 4, 14), box(-15, -22, 10, 4, 2), box(-15, 22, 10, 4, 2),
    box(-18, -12, 3, 1.2, 3), box(18, 0, 2, 4, 14), box(15, 22, 10, 4, 2),
    box(15, -22, 10, 4, 2), box(18, 12, 3, 1.2, 3), box(-5, 22, 3, 2.5, 3),
    box(5, -22, 3, 2.5, 3), box(0, 22, 4.5, 2.5, 2), box(0, -22, 4.5, 2.5, 2),
    box(-5, -18, 2.5, 2.5, 2.5), box(5, 18, 2.5, 2.5, 2.5),
    ...SHARED_SPAWN_COVER,
  ],
  cyber: [
    box(-9, 0, 4, 1.0, 8), box(9, 0, 4, 1.0, 8), centeredBox(0, 1.65, 0, 12, 0.7, 8),
    box(0, 0, 2, 4.5, 2), box(-18, 0, 2, 4, 14), box(-15, -22, 10, 4, 2),
    box(-15, 22, 10, 4, 2), box(18, 0, 2, 4, 14), box(15, 22, 10, 4, 2),
    box(15, -22, 10, 4, 2), box(-7, 22, 3, 2.5, 3), box(7, -22, 3, 2.5, 3),
    box(-7, -18, 3, 2.5, 3), box(7, 18, 3, 2.5, 3),
    box(-12, 0, 2.5, 1.0, 2.5), box(12, 0, 2.5, 1.0, 2.5),
    ...SHARED_SPAWN_COVER,
  ],
  overpass: [
    centeredBox(0, 3.2, 0, 30, 0.7, 5.5),
    box(-13, 0, 2, 3.2, 5.5), box(13, 0, 2, 3.2, 5.5),
    box(0, -6.5, 8, 2.8, 2), box(0, 6.5, 8, 2.8, 2),
    box(-4.5, 0, 2.2, 3.8, 8), box(4.5, 0, 2.2, 3.8, 8),
    box(-19, -12, 2, 3, 16), box(-14, -22, 11, 3, 2), box(-22, 10, 2, 2.5, 11),
    box(19, 12, 2, 3, 16), box(14, 22, 11, 3, 2), box(22, -10, 2, 2.5, 11),
    box(-8, 14, 4, 1.2, 3), box(8, -14, 4, 1.2, 3),
    box(0, 20, 7, 1.4, 2), box(0, -20, 7, 1.4, 2),
    ...SHARED_SPAWN_COVER,
  ],
  foundry: [
    box(0, 0, 7, 5, 7), box(0, -9, 12, 3.2, 2), box(0, 9, 12, 3.2, 2),
    centeredBox(-12, 3.0, 0, 4, 0.7, 26),
    box(-12, -14, 4, 3, 2), box(-12, 14, 4, 3, 2), box(-18, 0, 2, 2.4, 18),
    box(15, -17, 10, 3, 2), box(18, -5, 2, 2.6, 10),
    box(15, 17, 10, 3, 2), box(18, 5, 2, 2.6, 10),
    box(8, -20, 3, 1.2, 3), box(8, 20, 3, 1.2, 3),
    box(-4, -18, 3, 1.2, 3), box(4, 18, 3, 1.2, 3),
    box(-3, 18, 4, 2.2, 2), box(3, -18, 4, 2.2, 2),
    ...SHARED_SPAWN_COVER,
  ],
};

function segmentIntersectsAABB(
  start: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number },
  b: AABB,
): boolean {
  let tMin = 0;
  let tMax = 1;
  const axes: Array<["x" | "y" | "z", number, number]> = [
    ["x", b.x0, b.x1],
    ["y", b.y0, b.y1],
    ["z", b.z0, b.z1],
  ];

  for (const [axis, min, max] of axes) {
    const origin = start[axis];
    const delta = end[axis] - origin;
    if (Math.abs(delta) < 1e-8) {
      if (origin < min || origin > max) return false;
      continue;
    }
    const t1 = (min - origin) / delta;
    const t2 = (max - origin) / delta;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
    if (tMin > tMax) return false;
  }

  return tMax >= 0 && tMin <= 1;
}

function hasShotLineOfSight(shooter: Player, target: Player): boolean {
  if (shooter.mapId !== target.mapId) return false;

  const start = { x: shooter.position.x, y: shooter.position.y + 0.75, z: shooter.position.z };
  const end = { x: target.position.x, y: target.position.y + 0.75, z: target.position.z };

  for (const cover of MAP_COVER[shooter.mapId]) {
    if (segmentIntersectsAABB(start, end, cover)) return false;
  }
  return true;
}

function botIntersectsCover(bot: Bot, cover: AABB): boolean {
  const botFeet = bot.position.y - PLAYER_HEIGHT;
  const botHead = botFeet + BOT_HEIGHT;
  return (
    bot.position.x + BOT_RADIUS > cover.x0 &&
    bot.position.x - BOT_RADIUS < cover.x1 &&
    botHead > cover.y0 &&
    botFeet < cover.y1 &&
    bot.position.z + BOT_RADIUS > cover.z0 &&
    bot.position.z - BOT_RADIUS < cover.z1
  );
}

function botHitsAnyCover(bot: Bot): boolean {
  return MAP_COVER[bot.mapId].some((cover) => botIntersectsCover(bot, cover));
}

function moveBotWithCollision(bot: Bot, moveX: number, moveZ: number, distance: number): boolean {
  let collided = false;
  const oldX = bot.position.x;
  const oldZ = bot.position.z;

  bot.position.x = Math.max(-MAP_BOUND, Math.min(MAP_BOUND, bot.position.x + moveX * distance));
  if (botHitsAnyCover(bot)) {
    bot.position.x = oldX;
    collided = true;
  }

  bot.position.z = Math.max(-MAP_BOUND, Math.min(MAP_BOUND, bot.position.z + moveZ * distance));
  if (botHitsAnyCover(bot)) {
    bot.position.z = oldZ;
    collided = true;
  }

  return collided;
}

function navIndex(value: number) {
  return Math.max(0, Math.min(NAV_SIZE - 1, Math.round((value - NAV_MIN) / NAV_CELL)));
}

function navWorld(index: number) {
  return NAV_MIN + index * NAV_CELL;
}

function pointBlockedForBot(mapId: MapId, x: number, z: number) {
  if (x < -MAP_BOUND || x > MAP_BOUND || z < -MAP_BOUND || z > MAP_BOUND) return true;
  return MAP_COVER[mapId].some((cover) => (
    x + BOT_RADIUS > cover.x0 &&
    x - BOT_RADIUS < cover.x1 &&
    z + BOT_RADIUS > cover.z0 &&
    z - BOT_RADIUS < cover.z1 &&
    cover.y1 > 0.35
  ));
}

function segmentBlockedForBot(mapId: MapId, ax: number, az: number, bx: number, bz: number) {
  const steps = Math.max(3, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.75));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (pointBlockedForBot(mapId, ax + (bx - ax) * t, az + (bz - az) * t)) return true;
  }
  return false;
}

function findBotPath(mapId: MapId, start: { x: number; z: number }, goal: { x: number; z: number }) {
  const sx = navIndex(start.x);
  const sz = navIndex(start.z);
  const gx = navIndex(goal.x);
  const gz = navIndex(goal.z);
  const key = (x: number, z: number) => `${x}:${z}`;
  const blocked = (x: number, z: number) => pointBlockedForBot(mapId, navWorld(x), navWorld(z));
  if (blocked(sx, sz) || blocked(gx, gz)) return [];

  const open = new Set<string>([key(sx, sz)]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[key(sx, sz), 0]]);
  const fScore = new Map<string, number>([[key(sx, sz), Math.hypot(gx - sx, gz - sz)]]);
  const dirs = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];

  for (let guard = 0; open.size > 0 && guard < 500; guard++) {
    let current = "";
    let best = Number.POSITIVE_INFINITY;
    for (const candidate of open) {
      const score = fScore.get(candidate) ?? Number.POSITIVE_INFINITY;
      if (score < best) {
        best = score;
        current = candidate;
      }
    }

    const [cx, cz] = current.split(":").map(Number);
    if (cx === gx && cz === gz) {
      const cells = [current];
      while (cameFrom.has(cells[0])) cells.unshift(cameFrom.get(cells[0])!);
      return cells.slice(1).map((cell) => {
        const [x, z] = cell.split(":").map(Number);
        return { x: navWorld(x), z: navWorld(z) };
      });
    }

    open.delete(current);
    for (const [dx, dz] of dirs) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx < 0 || nx >= NAV_SIZE || nz < 0 || nz >= NAV_SIZE) continue;
      if (blocked(nx, nz)) continue;
      if (dx !== 0 && dz !== 0 && (blocked(cx + dx, cz) || blocked(cx, cz + dz))) continue;
      const neighbor = key(nx, nz);
      const tentative = (gScore.get(current) ?? Number.POSITIVE_INFINITY) + Math.hypot(dx, dz);
      if (tentative >= (gScore.get(neighbor) ?? Number.POSITIVE_INFINITY)) continue;
      cameFrom.set(neighbor, current);
      gScore.set(neighbor, tentative);
      fScore.set(neighbor, tentative + Math.hypot(gx - nx, gz - nz));
      open.add(neighbor);
    }
  }

  return [];
}

function getBotNavDirection(bot: Bot, goal: { x: number; z: number }, now: number, forcePath = false) {
  const moved = Math.hypot(bot.position.x - bot.lastPosition.x, bot.position.z - bot.lastPosition.z);
  bot.stuckTime = moved < 0.04 ? bot.stuckTime + MULTIPLAYER_BOT_TICK / 1000 : 0;
  bot.lastPosition = { x: bot.position.x, z: bot.position.z };

  const directClear = !forcePath && !segmentBlockedForBot(bot.mapId, bot.position.x, bot.position.z, goal.x, goal.z);
  if (directClear && bot.stuckTime < 0.5) {
    bot.path = [];
    const dx = goal.x - bot.position.x;
    const dz = goal.z - bot.position.z;
    const dist = Math.max(Math.hypot(dx, dz), 0.001);
    return { x: dx / dist, z: dz / dist };
  }

  const goalMoved = !bot.pathGoal || Math.hypot(bot.pathGoal.x - goal.x, bot.pathGoal.z - goal.z) > 4;
  if (now >= bot.nextPathAt || goalMoved || bot.path.length === 0 || bot.stuckTime > 0.55) {
    bot.path = findBotPath(bot.mapId, { x: bot.position.x, z: bot.position.z }, goal);
    bot.pathGoal = { ...goal };
    bot.nextPathAt = now + 550 + Math.random() * 450;
  }

  const next = bot.path[0] ?? goal;
  const dx = next.x - bot.position.x;
  const dz = next.z - bot.position.z;
  const dist = Math.max(Math.hypot(dx, dz), 0.001);
  if (dist < 1.1 && bot.path.length > 0) bot.path.shift();
  return { x: dx / dist, z: dz / dist };
}

function parseMapId(value: unknown): MapId {
  return value === "sandstone" || value === "cyber" || value === "overpass" || value === "foundry" ? value : "cracked";
}

function getPublicRoomKey(mapId: MapId): RoomKey {
  return `public:${mapId}`;
}

function getMapRoom(roomKey: RoomKey) {
  return `room:${roomKey}`;
}

function getLobbyRoom(lobbyId: string) {
  return `lobby:${lobbyId}`;
}

function normalizeLobbyName(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

function getPrivateRoomKey(lobbyId: string): RoomKey {
  return `private:${lobbyId}`;
}

function normalizeLobbyLookup(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^#/, "");
}

function generateLobbyCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function sanitizePassword(value: unknown) {
  return String(value ?? "").trim().slice(0, 64);
}

function sanitizeClientToken(value: unknown) {
  return String(value ?? "").trim().slice(0, 80);
}

function sanitizeMaxPlayers(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return MAX_MATCH_PLAYERS;
  return Math.min(Math.max(Math.floor(numeric), 2), MAX_MATCH_PLAYERS);
}

function getRandomSpawn() {
  return { ...SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)] };
}

function getRandomWaypoint() {
  return { ...WAYPOINTS[Math.floor(Math.random() * WAYPOINTS.length)] };
}

function angleDiff(a: number, b: number) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

function createShieldState(now = Date.now()) {
  return {
    shield: MAX_SHIELD,
    maxShield: MAX_SHIELD,
    lastDamageAt: 0,
    lastShieldUpdateAt: now,
  };
}

function updateShield(player: Player, now = Date.now()) {
  if (!player.alive) {
    player.lastShieldUpdateAt = now;
    return false;
  }
  const before = player.shield;
  const maxShield = player.maxShield || MAX_SHIELD;
  const rechargeStart = player.lastDamageAt + SHIELD_RECHARGE_DELAY;
  if (player.shield < maxShield && now > rechargeStart) {
    const rechargeFrom = Math.max(player.lastShieldUpdateAt, rechargeStart);
    const dt = Math.max(0, now - rechargeFrom) / 1000;
    player.shield = Math.min(maxShield, player.shield + dt * SHIELD_RECHARGE_RATE);
  }
  player.lastShieldUpdateAt = now;
  return Math.abs(player.shield - before) >= 0.25;
}

function damagePlayerShieldFirst(player: Player, damage: number, now = Date.now()) {
  updateShield(player, now);
  const appliedDamage = Math.min(Math.max(Number(damage) || 0, 0), 100);
  const shieldBefore = player.shield;
  const shieldDamage = Math.min(shieldBefore, appliedDamage);
  const healthDamage = appliedDamage - shieldDamage;
  player.shield = Math.max(0, shieldBefore - shieldDamage);
  player.health = Math.max(0, player.health - healthDamage);
  player.lastDamageAt = now;
  player.lastShieldUpdateAt = now;

  return {
    health: player.health,
    shield: player.shield,
    maxShield: player.maxShield || MAX_SHIELD,
    shieldDamage,
    healthDamage,
    shieldHit: shieldDamage > 0,
  };
}

function createBotPlayer(mapId: MapId, roomKey: RoomKey, index: number, idPrefix: string, difficulty = 1, lobbyId?: string): Bot {
  const sp = SPAWN_POINTS[(index + 2) % SPAWN_POINTS.length];
  const wp = getRandomWaypoint();
  const weaponChoice = BOT_WEAPONS[Math.floor(Math.random() * BOT_WEAPONS.length)];
  const fireRateMap: Record<string, number> = {
    cluckfire: 1200 - difficulty * 160,
    ovomatic: 2600 - difficulty * 400,
    yolkpiercer: 3800 - difficulty * 600,
    shell_lobber: 3000 - difficulty * 450,
    rapid_yolker: 900 - difficulty * 120,
    crackling_burst: 1400 - difficulty * 180,
    runny_marksman: 1900 - difficulty * 280,
  };

  return {
    id: `${idPrefix}_${index}`,
    nickname: BOT_NAMES[index % BOT_NAMES.length],
    position: { x: sp.x, y: sp.y, z: sp.z },
    rotation: { x: 0, y: Math.random() * Math.PI * 2 },
    health: MAX_HEALTH,
    ...createShieldState(),
    kills: 0,
    deaths: 0,
    alive: true,
    color: PLAYER_COLORS[(index + 1) % PLAYER_COLORS.length],
    weapon: weaponChoice,
    mapId,
    roomKey,
    lobbyId,
    state: "patrol",
    waypointX: wp.x,
    waypointZ: wp.z,
    path: [],
    pathGoal: undefined,
    nextPathAt: 0,
    stuckTime: 0,
    lastPosition: { x: sp.x, z: sp.z },
    lastShot: 0,
    strafDir: Math.random() > 0.5 ? 1 : -1,
    strafTimer: 0.6 + Math.random() * 0.9,
    idleTimer: 0,
    velY: 0,
    isGrounded: true,
    jumpTimer: 3 + Math.random() * 5,
    respawnTimer: 0,
    fireRate: fireRateMap[weaponChoice] ?? 1000,
    accuracy: 0.12 + difficulty * 0.1,
    isPeeking: false,
    peekTimer: 1.0 + Math.random() * 1.0,
  };
}

function emitPlayerShield(io: SocketIOServer, player: Player) {
  io.to(getMapRoom(player.roomKey)).emit("playerShield", {
    id: player.id,
    shield: player.shield,
    maxShield: player.maxShield || MAX_SHIELD,
    health: player.health,
    mapId: player.mapId,
    lobbyId: player.lobbyId,
  });
}

// ─── Solo Session ─────────────────────────────────────────────────────────────

class SoloSession {
  private socket: Socket;
  private player: Player;
  private bots = new Map<string, Bot>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTick = Date.now();
  private difficulty: number;

  constructor(socket: Socket, nickname: string, botCount: number, difficulty: number, mapId: MapId) {
    this.socket = socket;
    this.difficulty = difficulty;

    const spawn = getRandomSpawn();
    this.player = {
      id: socket.id,
      nickname: String(nickname).slice(0, 20) || "Player",
      position: spawn,
      rotation: { x: 0, y: 0 },
      health: MAX_HEALTH,
      ...createShieldState(),
      kills: 0,
      deaths: 0,
      alive: true,
      color: PLAYER_COLORS[0],
      weapon: "cluckfire",
      mapId,
      roomKey: `solo:${socket.id}`,
    };

    for (let i = 0; i < botCount; i++) {
      const bot = this.createBot(i);
      this.bots.set(bot.id, bot);
    }

    socket.emit("init", {
      self: this.player,
      players: Array.from(this.bots.values()),
    });

    this.timer = setInterval(() => this.tick(), BOT_TICK);
    logger.info({ id: socket.id, bots: botCount }, "Solo session started");
  }

  private createBot(index: number): Bot {
    const bot = createBotPlayer(this.player.mapId, this.player.roomKey, index, `bot_${this.socket.id}`, this.difficulty);
    bot.state = "idle";
    bot.idleTimer = 1 + Math.random() * 1.5;
    return bot;
  }

  private tick() {
    const now = Date.now();
    const dt = Math.min((now - this.lastTick) / 1000, 0.2);
    this.lastTick = now;

    if (updateShield(this.player, now)) {
      this.socket.emit("playerShield", {
        id: this.player.id,
        shield: this.player.shield,
        maxShield: this.player.maxShield,
        health: this.player.health,
        mapId: this.player.mapId,
      });
    }
    for (const bot of this.bots.values()) {
      if (updateShield(bot, now)) {
        this.socket.emit("playerShield", {
          id: bot.id,
          shield: bot.shield,
          maxShield: bot.maxShield,
          health: bot.health,
          mapId: bot.mapId,
        });
      }
      this.updateBot(bot, dt, now);
    }
  }

  private updateBot(bot: Bot, dt: number, now: number) {
    if (bot.state === "dead") {
      bot.respawnTimer -= dt;
      if (bot.respawnTimer <= 0) {
        const sp = getRandomSpawn();
        bot.health = MAX_HEALTH;
        Object.assign(bot, createShieldState());
        bot.alive = true;
        bot.state = "patrol";
        bot.position = { x: sp.x, y: sp.y, z: sp.z };
        bot.velY = 0;
        bot.isPeeking = false;
        bot.peekTimer = 1.0 + Math.random() * 1.0;
        bot.path = [];
        bot.pathGoal = undefined;
        bot.nextPathAt = 0;
        bot.stuckTime = 0;
        bot.lastPosition = { x: sp.x, z: sp.z };
        this.socket.emit("playerRespawned", { id: bot.id, position: bot.position, health: MAX_HEALTH, shield: bot.shield, maxShield: bot.maxShield });
      }
      return;
    }

    const player = this.player;
    const dx = player.position.x - bot.position.x;
    const dz = player.position.z - bot.position.z;
    const distToPlayer = Math.sqrt(dx * dx + dz * dz);

    // ── State transitions ──────────────────────────────────────────────────
    switch (bot.state) {
      case "idle":
        bot.idleTimer -= dt;
        if (bot.idleTimer <= 0) bot.state = "patrol";
        break;
      case "patrol":
        if (player.alive && distToPlayer < SIGHT_RANGE)
          bot.state = distToPlayer < ATTACK_RANGE ? "attack" : "chase";
        break;
      case "chase":
        if (!player.alive || distToPlayer > SIGHT_RANGE + 5)
          bot.state = "patrol";
        else if (distToPlayer < ATTACK_RANGE)
          bot.state = "attack";
        break;
      case "attack":
        if (!player.alive || distToPlayer > SIGHT_RANGE + 5)
          bot.state = "patrol";
        else if (distToPlayer > ATTACK_RANGE + 3)
          bot.state = "chase";
        break;
    }

    // ── Gravity ────────────────────────────────────────────────────────────
    bot.velY += GRAVITY * dt;
    bot.position.y += bot.velY * dt;
    if (bot.position.y < PLAYER_HEIGHT) {
      bot.position.y = PLAYER_HEIGHT;
      bot.velY = 0;
      bot.isGrounded = true;
    }

    // ── Occasional jump ────────────────────────────────────────────────────
    bot.jumpTimer -= dt;
    if (bot.jumpTimer <= 0 && bot.isGrounded) {
      if (bot.state === "attack" || bot.state === "chase") {
        bot.velY = 6;
        bot.isGrounded = false;
      }
      bot.jumpTimer = 3 + Math.random() * 6;
    }

    // ── Movement & rotation ────────────────────────────────────────────────
    let moveX = 0;
    let moveZ = 0;
    let targetYaw = bot.rotation.y;

    if (bot.state === "patrol") {
      const wdx = bot.waypointX - bot.position.x;
      const wdz = bot.waypointZ - bot.position.z;
      const wDist = Math.sqrt(wdx * wdx + wdz * wdz);
      if (wDist < 1.5) {
        const wp = getRandomWaypoint();
        bot.waypointX = wp.x;
        bot.waypointZ = wp.z;
        bot.path = [];
      } else {
        const nav = getBotNavDirection(bot, { x: bot.waypointX, z: bot.waypointZ }, now, true);
        moveX = nav.x;
        moveZ = nav.z;
        targetYaw = Math.atan2(-moveX, -moveZ);
      }
    } else if (bot.state === "chase") {
      if (distToPlayer > 0.1) {
        const nav = getBotNavDirection(bot, { x: player.position.x, z: player.position.z }, now, !hasShotLineOfSight(bot, player));
        moveX = nav.x;
        moveZ = nav.z;
        targetYaw = Math.atan2(-dx, -dz);
      }
    } else if (bot.state === "attack") {
      targetYaw = Math.atan2(-dx, -dz);

      const los = hasShotLineOfSight(bot, player);

      // ── Peek / cover cycle ──────────────────────────────────────────────
      // When no line-of-sight, bot advances ("peeks") toward the player.
      // Once LOS is acquired or peek timer expires, bot strafes/waits.
      bot.peekTimer -= dt;

      if (!los && !bot.isPeeking) {
        // Step toward player to get LOS (peek out from cover)
        bot.isPeeking = true;
        bot.peekTimer = 0.8 + Math.random() * 0.6;
      } else if (bot.isPeeking && (los || bot.peekTimer <= 0)) {
        // Got LOS or peek expired → go back to strafe phase
        bot.isPeeking = false;
        bot.peekTimer = 1.0 + Math.random() * 1.2;
      }

      if (bot.isPeeking) {
        // Advance toward player (peekout move — ~60% speed)
        const nav = getBotNavDirection(bot, { x: player.position.x, z: player.position.z }, now, !los);
        moveX = nav.x;
        moveZ = nav.z;
      } else {
        // Normal strafe
        bot.strafTimer -= dt;
        if (bot.strafTimer <= 0) {
          bot.strafDir = Math.random() > 0.5 ? 1 : -1;
          bot.strafTimer = 0.6 + Math.random() * 0.9;
        }
        const perpX =  Math.cos(targetYaw) * bot.strafDir;
        const perpZ = -Math.sin(targetYaw) * bot.strafDir;
        const closeFactor = distToPlayer < 5 ? -0.5 : 0.0;
        moveX = perpX * 0.8 + (dx / (distToPlayer || 1)) * closeFactor;
        moveZ = perpZ * 0.8 + (dz / (distToPlayer || 1)) * closeFactor;
      }

      // ── Shoot (only when line-of-sight is clear) ────────────────────────
      const canShoot = los || distToPlayer < 3.5; // also shoot at point-blank
      if (canShoot && now - bot.lastShot > bot.fireRate && player.alive) {
        bot.lastShot = now;
        const hitRoll = Math.random();
        const hitThreshold =
          distToPlayer < 6  ? bot.accuracy + 0.25
          : distToPlayer < 14 ? bot.accuracy
          : bot.accuracy - 0.15;

        if (hitRoll < hitThreshold) {
          const dmgMap: Record<string, number> = {
            cluckfire: 20,
            ovomatic: 14,
            yolkpiercer: 38,
            shell_lobber: 34,
            rapid_yolker: 10,
            crackling_burst: 18,
            runny_marksman: 28,
          };
          const dmg = dmgMap[bot.weapon] ?? 20;

          const hit = damagePlayerShieldFirst(player, dmg);
          this.socket.emit("playerHit", { id: player.id, ...hit });

          if (player.health <= 0) {
            player.alive = false;
            player.deaths++;
            bot.kills++;

            this.socket.emit("playerDied", {
              id: player.id,
              killerId: bot.id,
              killerNickname: bot.nickname,
              kills: bot.kills,
            });

            setTimeout(() => {
              if (!this.bots.has(bot.id)) return;
              const sp = getRandomSpawn();
              player.health = MAX_HEALTH;
              Object.assign(player, createShieldState());
              player.alive = true;
              player.position = sp;
              this.socket.emit("playerRespawned", { id: player.id, position: sp, health: MAX_HEALTH, shield: player.shield, maxShield: player.maxShield });
            }, RESPAWN_DELAY);
          }
        }
      }
    }

    // ── Smooth rotation ────────────────────────────────────────────────────
    const yawDiff = angleDiff(bot.rotation.y, targetYaw);
    bot.rotation.y += yawDiff * Math.min(dt * 10, 1);

    // ── Apply movement ─────────────────────────────────────────────────────
    const speed = bot.state === "attack"
      ? (bot.isPeeking ? BOT_SPEED * 0.6 : BOT_SPEED * 0.75)
      : BOT_SPEED;
    const collided = moveBotWithCollision(bot, moveX, moveZ, speed * dt);
    if (collided) {
      bot.path = [];
      bot.nextPathAt = 0;
      if (bot.state === "patrol") {
        const wp = getRandomWaypoint();
        bot.waypointX = wp.x;
        bot.waypointZ = wp.z;
      } else if (bot.state === "attack") {
        bot.strafDir *= -1;
        bot.strafTimer = 0.35 + Math.random() * 0.45;
        bot.isPeeking = false;
        bot.peekTimer = 0.55 + Math.random() * 0.65;
      }
    }

    this.socket.emit("playerMoved", {
      id: bot.id,
      position: bot.position,
      rotation: { x: 0, y: bot.rotation.y },
    });
  }

  handleShoot(targetId: string, damage: number) {
    const bot = this.bots.get(targetId);
    if (!bot || !bot.alive) return;
    if (!hasShotLineOfSight(this.player, bot)) return;

    const dmg = Math.min(Math.max(Number(damage) || 0, 0), 100);
    const hit = damagePlayerShieldFirst(bot, dmg);
    this.socket.emit("playerHit", { id: bot.id, ...hit });

    if (bot.health <= 0) {
      bot.alive = false;
      bot.state = "dead";
      bot.respawnTimer = RESPAWN_DELAY / 1000;
      bot.deaths++;
      this.player.kills++;

      this.socket.emit("playerDied", {
        id: bot.id,
        killerId: this.socket.id,
        killerNickname: this.player.nickname,
        kills: this.player.kills,
      });
    }
  }

  handleMove(position: { x: number; y: number; z: number }, rotation: { x: number; y: number }) {
    this.player.position = position;
    this.player.rotation = rotation;
  }

  cleanup() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info({ id: this.socket.id }, "Solo session cleaned up");
  }
}

// ─── Game Server ──────────────────────────────────────────────────────────────

export function createGameServer(app: Express) {
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
    path: "/ws/socket.io",
  });

  const players = new Map<string, Player>();
  const soloSessions = new Map<string, SoloSession>();
  const multiplayerBots = new Map<RoomKey, Map<string, Bot>>();
  const multiplayerBotTimers = new Map<RoomKey, ReturnType<typeof setInterval>>();
  const multiplayerBotLastTick = new Map<RoomKey, number>();
  const privateLobbies = new Map<string, PrivateLobby>();
  const privateLobbyLookup = new Map<string, string>();
  const socketLobbyIds = new Map<string, string>();

  setInterval(() => {
    const now = Date.now();
    for (const player of players.values()) {
      if (updateShield(player, now)) emitPlayerShield(io, player);
    }
    for (const bots of multiplayerBots.values()) {
      for (const bot of bots.values()) {
        if (updateShield(bot, now)) emitPlayerShield(io, bot);
      }
    }
  }, 250);

  const getRealPlayersForRoom = (roomKey: RoomKey) =>
    Array.from(players.values()).filter((p) => p.roomKey === roomKey);

  const getBotsForRoom = (roomKey: RoomKey) => {
    let bots = multiplayerBots.get(roomKey);
    if (!bots) {
      bots = new Map<string, Bot>();
      multiplayerBots.set(roomKey, bots);
    }
    return bots;
  };

  const stopBotTickerIfEmpty = (roomKey: RoomKey) => {
    if (getBotsForRoom(roomKey).size > 0) return;
    const timer = multiplayerBotTimers.get(roomKey);
    if (timer) clearInterval(timer);
    multiplayerBotTimers.delete(roomKey);
    multiplayerBotLastTick.delete(roomKey);
  };

  const respawnMultiplayerBot = (bot: Bot) => {
    const sp = getRandomSpawn();
    bot.health = MAX_HEALTH;
    Object.assign(bot, createShieldState());
    bot.alive = true;
    bot.state = "patrol";
    bot.position = { x: sp.x, y: sp.y, z: sp.z };
    bot.velY = 0;
    bot.isGrounded = true;
    bot.respawnTimer = 0;
    bot.path = [];
    bot.pathGoal = undefined;
    bot.nextPathAt = 0;
    bot.stuckTime = 0;
    bot.lastPosition = { x: sp.x, z: sp.z };
    const wp = getRandomWaypoint();
    bot.waypointX = wp.x;
    bot.waypointZ = wp.z;
    io.to(getMapRoom(bot.roomKey)).emit("playerRespawned", {
      id: bot.id,
      position: bot.position,
      health: MAX_HEALTH,
      shield: bot.shield,
      maxShield: bot.maxShield,
      mapId: bot.mapId,
      lobbyId: bot.lobbyId,
    });
  };

  const updateMultiplayerBot = (bot: Bot, realPlayers: Player[], dt: number, now: number) => {
    if (bot.state === "dead") {
      bot.respawnTimer -= dt;
      if (bot.respawnTimer <= 0) respawnMultiplayerBot(bot);
      return;
    }

    const aliveTargets = realPlayers.filter((p) => p.alive);
    if (aliveTargets.length === 0) return;
    let target = aliveTargets[0];
    let targetDist = Number.POSITIVE_INFINITY;
    for (const player of aliveTargets) {
      const dx = player.position.x - bot.position.x;
      const dz = player.position.z - bot.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < targetDist) {
        target = player;
        targetDist = dist;
      }
    }

    const dx = target.position.x - bot.position.x;
    const dz = target.position.z - bot.position.z;
    const distToPlayer = Math.max(Math.hypot(dx, dz), 0.001);
    const seesPlayer = distToPlayer < SIGHT_RANGE;
    let moveX = 0;
    let moveZ = 0;
    let targetYaw = bot.rotation.y;

    bot.velY += GRAVITY * dt;
    bot.position.y += bot.velY * dt;
    if (bot.position.y < PLAYER_HEIGHT) {
      bot.position.y = PLAYER_HEIGHT;
      bot.velY = 0;
      bot.isGrounded = true;
    }

    if (seesPlayer) {
      bot.state = distToPlayer < ATTACK_RANGE ? "attack" : "chase";
    } else if (bot.state !== "patrol") {
      bot.state = "patrol";
    }

    if (bot.state === "patrol") {
      const wdx = bot.waypointX - bot.position.x;
      const wdz = bot.waypointZ - bot.position.z;
      const wDist = Math.max(Math.hypot(wdx, wdz), 0.001);
      if (wDist < 1.5) {
        const wp = getRandomWaypoint();
        bot.waypointX = wp.x;
        bot.waypointZ = wp.z;
        bot.path = [];
      } else {
        const nav = getBotNavDirection(bot, { x: bot.waypointX, z: bot.waypointZ }, now, true);
        moveX = nav.x;
        moveZ = nav.z;
        targetYaw = Math.atan2(-moveX, -moveZ);
      }
    } else if (bot.state === "chase") {
      const nav = getBotNavDirection(bot, { x: target.position.x, z: target.position.z }, now, !hasShotLineOfSight(bot, target));
      moveX = nav.x;
      moveZ = nav.z;
      targetYaw = Math.atan2(-dx, -dz);
    } else {
      targetYaw = Math.atan2(-dx, -dz);
      const los = hasShotLineOfSight(bot, target);
      const closeFactor = distToPlayer > 10 ? 0.35 : distToPlayer < 5 ? -0.45 : 0;
      bot.strafTimer -= dt;
      if (bot.strafTimer <= 0) {
        bot.strafDir = Math.random() > 0.5 ? 1 : -1;
        bot.strafTimer = 0.65 + Math.random() * 0.85;
      }
      const perpX = Math.cos(targetYaw) * bot.strafDir;
      const perpZ = -Math.sin(targetYaw) * bot.strafDir;
      moveX = perpX * 0.75 + (dx / distToPlayer) * closeFactor;
      moveZ = perpZ * 0.75 + (dz / distToPlayer) * closeFactor;
      if (!los) {
        const nav = getBotNavDirection(bot, { x: target.position.x, z: target.position.z }, now, true);
        moveX = nav.x;
        moveZ = nav.z;
      }

      if ((los || distToPlayer < 3.5) && now - bot.lastShot > bot.fireRate && target.alive) {
        bot.lastShot = now;
        const hitChance = distToPlayer < 7 ? bot.accuracy + 0.16 : bot.accuracy - 0.08;
        if (Math.random() < hitChance) {
          const dmgMap: Record<string, number> = {
            cluckfire: 16,
            ovomatic: 12,
            yolkpiercer: 34,
            shell_lobber: 30,
            rapid_yolker: 8,
            crackling_burst: 15,
            runny_marksman: 24,
          };
          const dmg = dmgMap[bot.weapon] ?? 16;
          const hit = damagePlayerShieldFirst(target, dmg, now);
          io.to(getMapRoom(target.roomKey)).emit("playerHit", { id: target.id, ...hit, mapId: target.mapId, lobbyId: target.lobbyId });
          if (target.health <= 0) {
            target.alive = false;
            target.deaths++;
            bot.kills++;
            io.to(getMapRoom(target.roomKey)).emit("playerDied", {
              id: target.id,
              killerId: bot.id,
              killerNickname: bot.nickname,
              victimNickname: target.nickname,
              kills: bot.kills,
              mapId: target.mapId,
              lobbyId: target.lobbyId,
            });
            setTimeout(() => {
              const respawnTarget = players.get(target.id);
              if (!respawnTarget) return;
              const sp = getRandomSpawn();
              respawnTarget.health = MAX_HEALTH;
              Object.assign(respawnTarget, createShieldState());
              respawnTarget.alive = true;
              respawnTarget.position = sp;
              io.to(getMapRoom(respawnTarget.roomKey)).emit("playerRespawned", {
                id: respawnTarget.id,
                position: sp,
                health: MAX_HEALTH,
                shield: respawnTarget.shield,
                maxShield: respawnTarget.maxShield,
                mapId: respawnTarget.mapId,
                lobbyId: respawnTarget.lobbyId,
              });
            }, RESPAWN_DELAY);
          }
        }
      }
    }

    const yawDiff = angleDiff(bot.rotation.y, targetYaw);
    bot.rotation.y += yawDiff * Math.min(dt * 10, 1);
    const moveLength = Math.max(Math.hypot(moveX, moveZ), 1);
    const speed = bot.state === "attack" ? BOT_SPEED * 0.76 : BOT_SPEED;
    const collided = moveBotWithCollision(bot, moveX / moveLength, moveZ / moveLength, speed * dt);
    if (collided) {
      bot.path = [];
      bot.nextPathAt = 0;
      const wp = getRandomWaypoint();
      bot.waypointX = wp.x;
      bot.waypointZ = wp.z;
      bot.strafDir *= -1;
    }

    io.to(getMapRoom(bot.roomKey)).emit("playerMoved", {
      id: bot.id,
      position: bot.position,
      rotation: { x: 0, y: bot.rotation.y },
      mapId: bot.mapId,
      lobbyId: bot.lobbyId,
    });
  };

  const tickMultiplayerBots = (roomKey: RoomKey) => {
    const realPlayers = getRealPlayersForRoom(roomKey);
    if (realPlayers.length === 0) {
      stopBotTickerIfEmpty(roomKey);
      return;
    }

    const now = Date.now();
    const lastTick = multiplayerBotLastTick.get(roomKey) ?? now;
    const dt = Math.min((now - lastTick) / 1000, 0.2);
    multiplayerBotLastTick.set(roomKey, now);

    for (const bot of getBotsForRoom(roomKey).values()) {
      updateMultiplayerBot(bot, realPlayers, dt, now);
    }
  };

  const ensureBotTicker = (roomKey: RoomKey) => {
    if (multiplayerBotTimers.has(roomKey)) return;
    multiplayerBotLastTick.set(roomKey, Date.now());
    multiplayerBotTimers.set(roomKey, setInterval(() => tickMultiplayerBots(roomKey), MULTIPLAYER_BOT_TICK));
  };

  const syncMultiplayerBots = (roomKey: RoomKey, mapId: MapId, lobbyId?: string) => {
    const room = getMapRoom(roomKey);
    const realCount = getRealPlayersForRoom(roomKey).length;
    const desiredBots = roomKey.startsWith("private:") ? 0 : realCount > 0 ? Math.max(0, MAX_MATCH_PLAYERS - realCount) : 0;
    const bots = getBotsForRoom(roomKey);

    while (bots.size > desiredBots) {
      const botId = Array.from(bots.keys()).at(-1);
      if (!botId) break;
      bots.delete(botId);
      io.to(room).emit("playerLeft", botId);
    }

    while (bots.size < desiredBots) {
      const index = bots.size;
      const bot = createBotPlayer(mapId, roomKey, index, `bot_${mapId}_${lobbyId ?? "public"}`, 1, lobbyId);
      while (bots.has(bot.id)) {
        bot.id = `bot_${mapId}_${Math.floor(Math.random() * 10000)}`;
      }
      bots.set(bot.id, bot);
      io.to(room).emit("playerJoined", bot);
    }

    if (desiredBots > 0) ensureBotTicker(roomKey);
    else stopBotTickerIfEmpty(roomKey);
  };

  const getConnectedLobbyMembers = (lobby: PrivateLobby) =>
    Array.from(lobby.members.values()).filter((member) => member.connected);

  const serializeLobby = (lobby: PrivateLobby, viewerToken?: string) => ({
    id: lobby.id,
    name: lobby.displayName,
    mapId: lobby.mapId,
    maxPlayers: lobby.maxPlayers,
    status: lobby.status,
    minPlayersToStart: MIN_PRIVATE_PLAYERS_TO_START,
    isHost: viewerToken === lobby.hostToken,
    players: Array.from(lobby.members.values()).map((member) => ({
      id: member.clientToken,
      nickname: member.nickname,
      connected: member.connected,
      isHost: member.clientToken === lobby.hostToken,
    })),
  });

  const emitLobbyState = (lobby: PrivateLobby) => {
    for (const member of lobby.members.values()) {
      if (!member.socketId || !member.connected) continue;
      io.to(member.socketId).emit("lobbyState", serializeLobby(lobby, member.clientToken));
    }
  };

  const destroyPrivateLobby = (lobby: PrivateLobby, reason: string) => {
    io.to(getLobbyRoom(lobby.id)).emit("lobbyClosed", { message: reason });
    io.to(getMapRoom(lobby.roomKey)).emit("lobbyClosed", { message: reason });
    for (const member of lobby.members.values()) {
      if (member.disconnectTimer) clearTimeout(member.disconnectTimer);
      if (member.player) players.delete(member.player.id);
    }
    getBotsForRoom(lobby.roomKey).clear();
    stopBotTickerIfEmpty(lobby.roomKey);
    privateLobbies.delete(lobby.id);
    privateLobbyLookup.delete(lobby.id.toLowerCase());
    privateLobbyLookup.delete(lobby.name);
  };

  const findPrivateLobby = (roomNameOrId: unknown) => {
    const lookup = normalizeLobbyLookup(roomNameOrId);
    const lobbyId = privateLobbyLookup.get(lookup);
    return lobbyId ? privateLobbies.get(lobbyId) : undefined;
  };

  const createPlayerForLobbyMember = (lobby: PrivateLobby, member: PrivateLobbyMember, colorIndex: number): Player => {
    const spawn = getRandomSpawn();
    return {
      id: member.socketId ?? member.clientToken,
      nickname: member.nickname,
      position: spawn,
      rotation: { x: 0, y: 0 },
      health: MAX_HEALTH,
      ...createShieldState(),
      kills: member.player?.kills ?? 0,
      deaths: member.player?.deaths ?? 0,
      alive: true,
      color: member.player?.color ?? PLAYER_COLORS[colorIndex % PLAYER_COLORS.length],
      weapon: member.player?.weapon ?? "cluckfire",
      mapId: lobby.mapId,
      roomKey: lobby.roomKey,
      lobbyId: lobby.id,
    };
  };

  const sendMatchInit = (socketId: string, player: Player, lobby: PrivateLobby, viewerToken?: string) => {
    const others = [
      ...getRealPlayersForRoom(lobby.roomKey).filter((p) => p.id !== player.id),
      ...Array.from(getBotsForRoom(lobby.roomKey).values()),
    ];
    io.to(socketId).emit("init", { self: player, players: others, lobby: serializeLobby(lobby, viewerToken) });
  };

  const startPrivateLobbyMatch = (lobby: PrivateLobby, hostSocket: Socket) => {
    if (lobby.status === "playing") {
      hostSocket.emit("lobbyError", { message: "This private lobby is already in a match." });
      return;
    }
    if (lobby.hostToken && !lobby.members.get(lobby.hostToken)?.connected) {
      hostSocket.emit("lobbyError", { message: "Host is not connected." });
      return;
    }
    const connectedMembers = getConnectedLobbyMembers(lobby);
    if (connectedMembers.length < MIN_PRIVATE_PLAYERS_TO_START) {
      hostSocket.emit("lobbyError", { message: "Not enough players to start." });
      return;
    }

    lobby.status = "playing";
    connectedMembers.forEach((member, index) => {
      if (!member.socketId) return;
      const socketInRoom = io.sockets.sockets.get(member.socketId);
      const player = createPlayerForLobbyMember(lobby, member, index);
      member.player = player;
      players.set(player.id, player);
      socketInRoom?.join(getMapRoom(lobby.roomKey));
    });

    syncMultiplayerBots(lobby.roomKey, lobby.mapId, lobby.id);
    for (const member of connectedMembers) {
      if (member.socketId && member.player) sendMatchInit(member.socketId, member.player, lobby, member.clientToken);
    }
    io.to(getLobbyRoom(lobby.id)).emit("matchStarting", serializeLobby(lobby));
    logger.info({ lobbyId: lobby.id, mapId: lobby.mapId, players: connectedMembers.length }, "Private lobby match started");
  };

  const cleanupExistingSocketState = (socket: Socket) => {
    const previousLobbyId = socketLobbyIds.get(socket.id);
    const previousLobby = previousLobbyId ? privateLobbies.get(previousLobbyId) : undefined;
    if (previousLobby) {
      const member = Array.from(previousLobby.members.values()).find((candidate) => candidate.socketId === socket.id);
      if (member) {
        member.connected = false;
        member.socketId = undefined;
        if (!member.player) previousLobby.members.delete(member.clientToken);
      }
      socket.leave(getLobbyRoom(previousLobby.id));
      socketLobbyIds.delete(socket.id);
      emitLobbyState(previousLobby);
    }

    const existingPlayer = players.get(socket.id);
    if (existingPlayer) {
      const previousRoom = getMapRoom(existingPlayer.roomKey);
      socket.leave(previousRoom);
      socket.to(previousRoom).emit("playerLeft", socket.id);
      players.delete(socket.id);
      syncMultiplayerBots(existingPlayer.roomKey, existingPlayer.mapId, existingPlayer.lobbyId);
    }

    const existingSoloSession = soloSessions.get(socket.id);
    if (existingSoloSession) {
      existingSoloSession.cleanup();
      soloSessions.delete(socket.id);
    }
  };

  io.on("connection", (socket: Socket) => {
    logger.info({ id: socket.id }, "Player connected");

    socket.on("join", (data: string | {
      nickname: string;
      solo?: boolean;
      botCount?: number;
      difficulty?: number;
      mapId?: string;
      privateLobby?: { action?: "create" | "join"; name?: string; password?: string; maxPlayers?: number; clientToken?: string };
    }) => {
      const isObj = typeof data === "object" && data !== null;
      const nickname = String(isObj ? data.nickname : data).slice(0, 20) || "Player";
      const solo = isObj ? !!data.solo : false;
      const botCount = isObj ? Math.min(data.botCount ?? 5, 10) : 0;
      const difficulty = isObj ? Math.min(Math.max(data.difficulty ?? 1, 0), 2) : 1;
      const mapId = parseMapId(isObj ? data.mapId : undefined);
      const privateLobbyRequest = !solo && isObj ? data.privateLobby : undefined;

      cleanupExistingSocketState(socket);

      if (solo) {
        const session = new SoloSession(socket, nickname, botCount, difficulty, mapId);
        soloSessions.set(socket.id, session);
        return;
      }

      if (privateLobbyRequest) {
        const action = privateLobbyRequest.action === "join" ? "join" : "create";
        const lobbyName = normalizeLobbyName(privateLobbyRequest.name);
        const displayName = String(privateLobbyRequest.name ?? "").trim().slice(0, 24);
        const lobbyPassword = sanitizePassword(privateLobbyRequest.password);
        const clientToken = sanitizeClientToken(privateLobbyRequest.clientToken) || socket.id;

        if (!lobbyName) {
          socket.emit("joinError", { message: "Enter a private lobby name or room ID." });
          return;
        }
        if (!lobbyPassword) {
          socket.emit("joinError", { message: "Enter the private lobby password." });
          return;
        }

        let lobby: PrivateLobby | undefined;
        if (action === "create") {
          if (privateLobbyLookup.has(lobbyName)) {
            socket.emit("joinError", { message: "A private lobby with that name already exists." });
            return;
          }
          let lobbyId = generateLobbyCode();
          while (privateLobbies.has(lobbyId)) lobbyId = generateLobbyCode();
          lobby = {
            id: lobbyId,
            name: lobbyName,
            displayName: displayName || lobbyName,
            password: lobbyPassword,
            hostToken: clientToken,
            mapId,
            maxPlayers: sanitizeMaxPlayers(privateLobbyRequest.maxPlayers),
            status: "waiting",
            roomKey: getPrivateRoomKey(lobbyId),
            createdAt: Date.now(),
            members: new Map(),
          };
          privateLobbies.set(lobby.id, lobby);
          privateLobbyLookup.set(lobby.id.toLowerCase(), lobby.id);
          privateLobbyLookup.set(lobby.name, lobby.id);
        } else {
          lobby = findPrivateLobby(privateLobbyRequest.name);
          if (!lobby) {
            socket.emit("joinError", { message: "Private lobby not found." });
            return;
          }
          if (lobby.password !== lobbyPassword) {
            socket.emit("joinError", { message: "Incorrect private lobby password." });
            return;
          }
          if (lobby.status !== "waiting" && !lobby.members.has(clientToken)) {
            socket.emit("joinError", { message: "This private lobby match has already started." });
            return;
          }
          if (!lobby.members.has(clientToken) && getConnectedLobbyMembers(lobby).length >= lobby.maxPlayers) {
            socket.emit("joinError", { message: "This private lobby is full." });
            return;
          }
        }

        const existingMember = lobby.members.get(clientToken);
        if (existingMember?.socketId && existingMember.socketId !== socket.id && existingMember.connected) {
          socket.emit("joinError", { message: "This player session is already connected to the lobby." });
          return;
        }

        const member: PrivateLobbyMember = existingMember ?? {
          clientToken,
          nickname,
          connected: true,
          isHost: clientToken === lobby.hostToken,
        };
        if (member.disconnectTimer) clearTimeout(member.disconnectTimer);
        member.socketId = socket.id;
        member.nickname = nickname;
        member.connected = true;
        member.isHost = clientToken === lobby.hostToken;
        lobby.members.set(clientToken, member);
        socketLobbyIds.set(socket.id, lobby.id);
        socket.join(getLobbyRoom(lobby.id));

        socket.emit("lobbyState", serializeLobby(lobby, clientToken));
        emitLobbyState(lobby);

        if (lobby.status === "playing" && member.player) {
          const oldId = member.player.id;
          if (oldId !== socket.id) {
            players.delete(oldId);
            io.to(getMapRoom(lobby.roomKey)).emit("playerLeft", oldId);
            member.player.id = socket.id;
          }
        member.player.nickname = nickname;
        member.player.alive = true;
        member.player.health = Math.max(member.player.health, 1);
        updateShield(member.player);
        players.set(socket.id, member.player);
          socket.join(getMapRoom(lobby.roomKey));
          sendMatchInit(socket.id, member.player, lobby, member.clientToken);
          socket.to(getMapRoom(lobby.roomKey)).emit("playerJoined", member.player);
        }

        logger.info({ id: socket.id, nickname, lobbyId: lobby.id, action }, "Player joined private lobby");
        return;
      }

      const roomKey = getPublicRoomKey(mapId);
      const spawn = getRandomSpawn();
      const mapRoom = getMapRoom(roomKey);
      const mapPlayers = getRealPlayersForRoom(roomKey);
      if (mapPlayers.length >= MAX_MATCH_PLAYERS) {
        socket.emit("joinError", { message: "This public match is full. Try another map." });
        return;
      }
      const colorIndex = mapPlayers.length % PLAYER_COLORS.length;
      const player: Player = {
        id: socket.id,
        nickname,
        position: spawn,
        rotation: { x: 0, y: 0 },
        health: MAX_HEALTH,
        ...createShieldState(),
        kills: 0,
        deaths: 0,
        alive: true,
        color: PLAYER_COLORS[colorIndex],
        weapon: "cluckfire",
        mapId,
        roomKey,
      };
      socket.join(mapRoom);
      players.set(socket.id, player);
      syncMultiplayerBots(roomKey, mapId);
      const mapBots = Array.from(getBotsForRoom(roomKey).values());
      const otherRealPlayers = getRealPlayersForRoom(roomKey).filter((p) => p.id !== socket.id);

      socket.emit("init", {
        self: player,
        players: [...otherRealPlayers, ...mapBots],
      });
      socket.to(mapRoom).emit("playerJoined", player);
      logger.info({ id: socket.id, nickname, mapId, lobbyId: "public" }, "Player joined multiplayer room");
    });

    socket.on("startPrivateLobby", () => {
      const lobbyId = socketLobbyIds.get(socket.id);
      const lobby = lobbyId ? privateLobbies.get(lobbyId) : undefined;
      if (!lobby) {
        socket.emit("lobbyError", { message: "Private lobby not found." });
        return;
      }
      const member = Array.from(lobby.members.values()).find((candidate) => candidate.socketId === socket.id);
      if (!member || member.clientToken !== lobby.hostToken) {
        socket.emit("lobbyError", { message: "Only the host can start this private lobby." });
        return;
      }
      startPrivateLobbyMatch(lobby, socket);
    });

    socket.on("move", (data: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number } }) => {
      const session = soloSessions.get(socket.id);
      if (session) { session.handleMove(data.position, data.rotation); return; }
      const p = players.get(socket.id);
      if (!p || !p.alive) return;
      p.position = data.position;
      p.rotation = data.rotation;
      socket.to(getMapRoom(p.roomKey)).emit("playerMoved", { id: socket.id, position: data.position, rotation: data.rotation, mapId: p.mapId, lobbyId: p.lobbyId });
    });

    socket.on("weapon", (weapon: string) => {
      const p = players.get(socket.id);
      if (!p) return;
      p.weapon = weapon;
      socket.to(getMapRoom(p.roomKey)).emit("playerWeapon", { id: socket.id, weapon, mapId: p.mapId, lobbyId: p.lobbyId });
    });

    socket.on("shoot", (data: { targetId: string; damage: number }) => {
      const session = soloSessions.get(socket.id);
      if (session) { session.handleShoot(data.targetId, data.damage); return; }

      const shooter = players.get(socket.id);
      const target = shooter
        ? players.get(data.targetId) ?? getBotsForRoom(shooter.roomKey).get(data.targetId)
        : undefined;
      if (!shooter || !target || !target.alive || !shooter.alive) return;
      if (shooter.roomKey !== target.roomKey) return;
      if (!hasShotLineOfSight(shooter, target)) return;
      const mapRoom = getMapRoom(shooter.roomKey);

      const dmg = Math.min(Math.max(Number(data.damage) || 0, 0), 100);
      const hit = damagePlayerShieldFirst(target, dmg);
      io.to(mapRoom).emit("playerHit", { id: data.targetId, ...hit, mapId: shooter.mapId, lobbyId: shooter.lobbyId });

      if (target.health <= 0) {
        target.alive = false;
        target.deaths++;
        shooter.kills++;
        io.to(mapRoom).emit("playerDied", {
          id: data.targetId,
          killerId: socket.id,
          killerNickname: shooter.nickname,
          kills: shooter.kills,
          mapId: shooter.mapId,
          lobbyId: shooter.lobbyId,
        });
        logger.info({ shooter: shooter.nickname, victim: target.nickname }, "Kill");
        setTimeout(() => {
          const botTarget = getBotsForRoom(shooter.roomKey).get(data.targetId);
          if (botTarget) {
            respawnMultiplayerBot(botTarget);
            return;
          }
          const t = players.get(data.targetId);
          if (!t) return;
          const sp = getRandomSpawn();
          t.health = MAX_HEALTH;
          Object.assign(t, createShieldState());
          t.alive = true;
          t.position = sp;
          io.to(getMapRoom(t.roomKey)).emit("playerRespawned", { id: data.targetId, position: sp, health: MAX_HEALTH, shield: t.shield, maxShield: t.maxShield, mapId: t.mapId, lobbyId: t.lobbyId });
        }, RESPAWN_DELAY);
      }
    });

    socket.on("disconnect", () => {
      const session = soloSessions.get(socket.id);
      if (session) { session.cleanup(); soloSessions.delete(socket.id); }
      const lobbyId = socketLobbyIds.get(socket.id);
      socketLobbyIds.delete(socket.id);
      const lobby = lobbyId ? privateLobbies.get(lobbyId) : undefined;
      if (lobby) {
        const member = Array.from(lobby.members.values()).find((candidate) => candidate.socketId === socket.id);
        if (member) {
          member.connected = false;
          member.socketId = undefined;
          if (member.player) {
            member.player = players.get(socket.id) ?? member.player;
            players.delete(socket.id);
            socket.to(getMapRoom(lobby.roomKey)).emit("playerLeft", socket.id);
            syncMultiplayerBots(lobby.roomKey, lobby.mapId, lobby.id);
          }
          emitLobbyState(lobby);
          member.disconnectTimer = setTimeout(() => {
            const currentLobby = privateLobbies.get(lobby.id);
            const currentMember = currentLobby?.members.get(member.clientToken);
            if (!currentLobby || !currentMember || currentMember.connected) return;
            currentLobby.members.delete(member.clientToken);
            if (currentMember.clientToken === currentLobby.hostToken) {
              destroyPrivateLobby(currentLobby, "Host disconnected. Private lobby closed.");
              return;
            }
            emitLobbyState(currentLobby);
            if (currentLobby.members.size === 0) {
              destroyPrivateLobby(currentLobby, "Private lobby closed.");
            }
          }, PRIVATE_RECONNECT_GRACE_MS);
        }
        logger.info({ id: socket.id, lobbyId: lobby.id }, "Private lobby player disconnected");
        return;
      }
      const player = players.get(socket.id);
      players.delete(socket.id);
      if (player) {
        socket.to(getMapRoom(player.roomKey)).emit("playerLeft", socket.id);
        syncMultiplayerBots(player.roomKey, player.mapId, player.lobbyId);
      }
      logger.info({ id: socket.id }, "Player disconnected");
    });
  });

  return httpServer;
}
