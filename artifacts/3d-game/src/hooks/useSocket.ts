import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { PlayerState, KillEvent, JoinPayload, WeaponId, MapId, PrivateLobbyState } from "../types/game";
import { WEAPON_ORDER } from "../types/game";
import { getMap } from "../data/maps";
import type { MapBox } from "../data/maps";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.replace(/\/$/, "");
const MAX_HEALTH = 100;
const MAX_SHIELD = 75;
const SHIELD_RECHARGE_DELAY = 4200;
const SHIELD_RECHARGE_RATE = 22;
const RESPAWN_DELAY = 2600;
const BOT_TICK = 160;
const BOT_RADIUS = 0.38;
const BOT_HEIGHT = 1.7;
const BOT_EYE_HEIGHT = 0.85;
const MAP_BOUND = 29;
const NAV_CELL = 2.5;
const NAV_MIN = -28.75;
const NAV_SIZE = 24;
const BOT_NAMES = [
  "ShardViper",
  "CoreWarden",
  "RailSpecter",
  "QuartzAce",
  "ArcRipper",
  "VantaDrift",
  "PrismWolf",
  "CinderZero",
  "IonReaper",
  "HexRunner",
];
const PLAYER_COLORS = [
  "#e74c3c",
  "#3498db",
  "#2ecc71",
  "#f39c12",
  "#9b59b6",
  "#1abc9c",
  "#e67e22",
  "#e91e63",
];
const SPAWN_POINTS = [
  { x: -25, y: 0.8, z: -25 },
  { x: 25, y: 0.8, z: -25 },
  { x: -25, y: 0.8, z: 25 },
  { x: 25, y: 0.8, z: 25 },
  { x: 0, y: 0.8, z: -28 },
  { x: 0, y: 0.8, z: 28 },
  { x: -28, y: 0.8, z: 0 },
  { x: 28, y: 0.8, z: 0 },
];
const WAYPOINTS = [
  ...SPAWN_POINTS.map((p) => ({ x: p.x, z: p.z })),
  { x: 0, z: 0 },
  { x: -12, z: 0 },
  { x: 12, z: 0 },
  { x: 0, z: -12 },
  { x: 0, z: 12 },
  { x: -18, z: -8 },
  { x: 18, z: 8 },
  { x: -18, z: 8 },
  { x: 18, z: -8 },
];

interface LocalBot extends PlayerState {
  waypoint: { x: number; z: number };
  path: Array<{ x: number; z: number }>;
  pathGoal: { x: number; z: number } | null;
  nextPathAt: number;
  stuckTime: number;
  lastPosition: { x: number; z: number };
  lastShot: number;
  lastDamageAt: number;
  lastShieldUpdateAt: number;
  respawnAt: number;
  strafe: number;
}

interface LocalPlayer extends PlayerState {
  lastDamageAt: number;
  lastShieldUpdateAt: number;
}

interface AABB {
  x0: number; x1: number;
  y0: number; y1: number;
  z0: number; z1: number;
}

interface NavNode {
  x: number;
  z: number;
}

interface LocalCallbacks {
  onInit: (self: PlayerState, others: PlayerState[]) => void;
  onPlayerMoved: (data: { id: string; position: { x: number; y: number; z: number }; rotation: { x: number; y: number }; mapId?: MapId }) => void;
  onPlayerHit: (data: { id: string; health: number; shield?: number; maxShield?: number; shieldDamage?: number; healthDamage?: number; shieldHit?: boolean; mapId?: MapId }) => void;
  onPlayerShield?: (data: { id: string; shield: number; maxShield: number; health?: number; mapId?: MapId }) => void;
  onPlayerDied: (data: KillEvent) => void;
  onPlayerRespawned: (data: { id: string; position: { x: number; y: number; z: number }; health: number; shield?: number; maxShield?: number; mapId?: MapId }) => void;
  onPlayerWeapon?: (data: { id: string; weapon: WeaponId; mapId?: MapId }) => void;
}

function randomSpawn() {
  return { ...SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)] };
}

function randomWaypoint() {
  return { ...WAYPOINTS[Math.floor(Math.random() * WAYPOINTS.length)] };
}

function mapBoxesToAabbs(boxes: MapBox[]): AABB[] {
  return boxes
    .filter((box) => !box.noCollide)
    .map((box) => ({
      x0: box.pos[0] - box.size[0] / 2,
      x1: box.pos[0] + box.size[0] / 2,
      y0: box.pos[1] - box.size[1] / 2,
      y1: box.pos[1] + box.size[1] / 2,
      z0: box.pos[2] - box.size[2] / 2,
      z1: box.pos[2] + box.size[2] / 2,
    }));
}

function botIntersectsBox(bot: Pick<PlayerState, "position">, box: AABB) {
  const feet = bot.position.y - 0.8;
  const head = feet + BOT_HEIGHT;
  return (
    bot.position.x + BOT_RADIUS > box.x0 &&
    bot.position.x - BOT_RADIUS < box.x1 &&
    head > box.y0 &&
    feet < box.y1 &&
    bot.position.z + BOT_RADIUS > box.z0 &&
    bot.position.z - BOT_RADIUS < box.z1
  );
}

function pointBlocked(x: number, z: number, boxes: AABB[]) {
  if (x < -MAP_BOUND || x > MAP_BOUND || z < -MAP_BOUND || z > MAP_BOUND) return true;
  return boxes.some((box) => (
    x + BOT_RADIUS > box.x0 &&
    x - BOT_RADIUS < box.x1 &&
    z + BOT_RADIUS > box.z0 &&
    z - BOT_RADIUS < box.z1 &&
    box.y1 > 0.35
  ));
}

function segmentBlocked(ax: number, az: number, bx: number, bz: number, boxes: AABB[]) {
  const steps = Math.max(3, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.75));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (pointBlocked(ax + (bx - ax) * t, az + (bz - az) * t, boxes)) return true;
  }
  return false;
}

function hasLocalLineOfSight(a: PlayerState, b: PlayerState, boxes: AABB[]) {
  const ax = a.position.x;
  const az = a.position.z;
  const bx = b.position.x;
  const bz = b.position.z;
  const ay0 = a.position.y + BOT_EYE_HEIGHT;
  const by0 = b.position.y + BOT_EYE_HEIGHT;
  const steps = Math.max(4, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.75));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const y = ay0 + (by0 - ay0) * t;
    const z = az + (bz - az) * t;
    if (boxes.some((box) => x > box.x0 && x < box.x1 && y > box.y0 && y < box.y1 && z > box.z0 && z < box.z1)) return false;
  }
  return true;
}

function navIndex(value: number) {
  return Math.max(0, Math.min(NAV_SIZE - 1, Math.round((value - NAV_MIN) / NAV_CELL)));
}

function navWorld(index: number) {
  return NAV_MIN + index * NAV_CELL;
}

function findPath(start: NavNode, goal: NavNode, boxes: AABB[]): NavNode[] {
  const sx = navIndex(start.x);
  const sz = navIndex(start.z);
  const gx = navIndex(goal.x);
  const gz = navIndex(goal.z);
  const key = (x: number, z: number) => `${x}:${z}`;
  const open = new Set<string>([key(sx, sz)]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[key(sx, sz), 0]]);
  const fScore = new Map<string, number>([[key(sx, sz), Math.hypot(gx - sx, gz - sz)]]);
  const dirs = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];

  const isBlockedCell = (x: number, z: number) => pointBlocked(navWorld(x), navWorld(z), boxes);
  if (isBlockedCell(sx, sz) || isBlockedCell(gx, gz)) return [];

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
      const cells: string[] = [current];
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
      if (isBlockedCell(nx, nz)) continue;
      if (dx !== 0 && dz !== 0 && (isBlockedCell(cx + dx, cz) || isBlockedCell(cx, cz + dz))) continue;
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

function moveBotWithCollision(bot: LocalBot, moveX: number, moveZ: number, distance: number, boxes: AABB[]) {
  let collided = false;
  const oldX = bot.position.x;
  const oldZ = bot.position.z;

  bot.position.x = Math.max(-MAP_BOUND, Math.min(MAP_BOUND, bot.position.x + moveX * distance));
  if (boxes.some((box) => botIntersectsBox(bot, box))) {
    bot.position.x = oldX;
    collided = true;
  }

  bot.position.z = Math.max(-MAP_BOUND, Math.min(MAP_BOUND, bot.position.z + moveZ * distance));
  if (boxes.some((box) => botIntersectsBox(bot, box))) {
    bot.position.z = oldZ;
    collided = true;
  }

  return collided;
}

function localKillEvent(data: Omit<KillEvent, "timestamp">): KillEvent {
  return { ...data, timestamp: Date.now() };
}

function shieldState(now = Date.now()) {
  return {
    shield: MAX_SHIELD,
    maxShield: MAX_SHIELD,
    lastDamageAt: 0,
    lastShieldUpdateAt: now,
  };
}

function updateLocalShield(player: PlayerState & { lastDamageAt: number; lastShieldUpdateAt: number }, now = Date.now()) {
  if (!player.alive) {
    player.lastShieldUpdateAt = now;
    return false;
  }
  const before = player.shield;
  const rechargeStart = player.lastDamageAt + SHIELD_RECHARGE_DELAY;
  if (player.shield < player.maxShield && now > rechargeStart) {
    const rechargeFrom = Math.max(player.lastShieldUpdateAt, rechargeStart);
    player.shield = Math.min(player.maxShield, player.shield + ((now - rechargeFrom) / 1000) * SHIELD_RECHARGE_RATE);
  }
  player.lastShieldUpdateAt = now;
  return Math.abs(player.shield - before) >= 0.25;
}

function applyLocalDamage(player: PlayerState & { lastDamageAt: number; lastShieldUpdateAt: number }, damage: number) {
  const now = Date.now();
  updateLocalShield(player, now);
  const appliedDamage = Math.min(Math.max(damage, 0), 100);
  const shieldDamage = Math.min(player.shield, appliedDamage);
  const healthDamage = appliedDamage - shieldDamage;
  player.shield = Math.max(0, player.shield - shieldDamage);
  player.health = Math.max(0, player.health - healthDamage);
  player.lastDamageAt = now;
  player.lastShieldUpdateAt = now;
  return {
    health: player.health,
    shield: player.shield,
    maxShield: player.maxShield,
    shieldDamage,
    healthDamage,
    shieldHit: shieldDamage > 0,
  };
}

class LocalSoloSession {
  private self: LocalPlayer;
  private bots = new Map<string, LocalBot>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTick = Date.now();
  private callbacks: LocalCallbacks;
  private difficulty: number;
  private mapId: MapId;
  private collidables: AABB[];
  private playerGraceUntil = Date.now() + 8000;

  constructor(joinPayload: JoinPayload, callbacks: LocalCallbacks) {
    this.callbacks = callbacks;
    this.difficulty = joinPayload.difficulty;
    this.mapId = joinPayload.mapId;
    this.collidables = mapBoxesToAabbs(getMap(joinPayload.mapId).boxes);
    this.self = {
      id: "local_player",
      nickname: joinPayload.nickname.slice(0, 20) || "Player",
      position: randomSpawn(),
      rotation: { x: 0, y: 0 },
      health: MAX_HEALTH,
      ...shieldState(),
      kills: 0,
      deaths: 0,
      alive: true,
      color: PLAYER_COLORS[0],
      weapon: "cluckfire",
      mapId: joinPayload.mapId,
    };

    for (let i = 0; i < joinPayload.botCount; i++) {
      const spawn = SPAWN_POINTS[(i + 2) % SPAWN_POINTS.length];
      const weapon = WEAPON_ORDER[(i + 1) % WEAPON_ORDER.length];
      this.bots.set(`local_bot_${i}`, {
        id: `local_bot_${i}`,
        nickname: BOT_NAMES[i % BOT_NAMES.length],
        position: { ...spawn },
        rotation: { x: 0, y: Math.random() * Math.PI * 2 },
        health: MAX_HEALTH,
        ...shieldState(),
        kills: 0,
        deaths: 0,
        alive: true,
        color: PLAYER_COLORS[(i + 1) % PLAYER_COLORS.length],
        weapon,
        mapId: joinPayload.mapId,
        waypoint: randomWaypoint(),
        path: [],
        pathGoal: null,
        nextPathAt: 0,
        stuckTime: 0,
        lastPosition: { x: spawn.x, z: spawn.z },
        lastShot: 0,
        respawnAt: 0,
        strafe: Math.random() > 0.5 ? 1 : -1,
      });
    }

    this.callbacks.onInit(this.self, Array.from(this.bots.values()));
    this.timer = setInterval(() => this.tick(), BOT_TICK);
  }

  move(position: PlayerState["position"], rotation: PlayerState["rotation"]) {
    this.self.position = position;
    this.self.rotation = rotation;
  }

  weapon(weapon: WeaponId) {
    this.self.weapon = weapon;
    this.callbacks.onPlayerWeapon?.({ id: this.self.id, weapon, mapId: this.mapId });
  }

  shoot(targetId: string, damage: number) {
    const bot = this.bots.get(targetId);
    if (!bot || !bot.alive || !this.self.alive) return;

    const hit = applyLocalDamage(bot, damage);
    this.callbacks.onPlayerHit({ id: bot.id, ...hit, mapId: this.mapId });

    if (bot.health > 0) return;

    bot.alive = false;
    bot.deaths += 1;
    bot.respawnAt = Date.now() + RESPAWN_DELAY;
    this.self.kills += 1;
    this.callbacks.onPlayerDied(localKillEvent({
      id: bot.id,
      killerId: this.self.id,
      killerNickname: this.self.nickname,
      victimNickname: bot.nickname,
      kills: this.self.kills,
      mapId: this.mapId,
    }));
  }

  cleanup() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private tick() {
    const now = Date.now();
    const dt = Math.min((now - this.lastTick) / 1000, 0.2);
    this.lastTick = now;

    if (updateLocalShield(this.self, now)) {
      this.callbacks.onPlayerShield?.({ id: this.self.id, shield: this.self.shield, maxShield: this.self.maxShield, health: this.self.health, mapId: this.mapId });
    }
    for (const bot of this.bots.values()) {
      if (updateLocalShield(bot, now)) {
        this.callbacks.onPlayerShield?.({ id: bot.id, shield: bot.shield, maxShield: bot.maxShield, health: bot.health, mapId: this.mapId });
      }
      if (!bot.alive) {
        if (now >= bot.respawnAt) this.respawnBot(bot);
        continue;
      }

      this.updateBot(bot, dt, now);
    }
  }

  private updateBot(bot: LocalBot, dt: number, now: number) {
    const dx = this.self.position.x - bot.position.x;
    const dz = this.self.position.z - bot.position.z;
    const dist = Math.max(Math.hypot(dx, dz), 0.001);
    const los = this.self.alive && dist < 26 && hasLocalLineOfSight(bot, this.self, this.collidables);
    const knowsPlayer = this.self.alive && dist < 30;
    const speed = knowsPlayer ? (los ? 5.6 : 6.1) : 4.8;
    let moveX = 0;
    let moveZ = 0;
    let targetYaw = bot.rotation.y;
    const moved = Math.hypot(bot.position.x - bot.lastPosition.x, bot.position.z - bot.lastPosition.z);
    bot.stuckTime = moved < 0.04 ? bot.stuckTime + dt : 0;
    bot.lastPosition = { x: bot.position.x, z: bot.position.z };

    if (knowsPlayer) {
      targetYaw = Math.atan2(-dx, -dz);
      if (los) {
        const strafeX = dz / dist;
        const strafeZ = -dx / dist;
        const chase = dist > 15 ? 0.58 : dist < 7 ? -0.42 : 0.08;
        const coverBias = bot.shield < bot.maxShield * 0.35 ? -0.22 : 0;
        moveX = (dx / dist) * (chase + coverBias) + strafeX * bot.strafe * 0.72;
        moveZ = (dz / dist) * (chase + coverBias) + strafeZ * bot.strafe * 0.72;
        if (Math.random() < 0.018) bot.strafe *= -1;
        if (dist > 9 && !segmentBlocked(bot.position.x, bot.position.z, this.self.position.x, this.self.position.z, this.collidables)) {
          bot.path = [];
        }
      } else {
        const goalMoved = !bot.pathGoal || Math.hypot(bot.pathGoal.x - this.self.position.x, bot.pathGoal.z - this.self.position.z) > 4;
        if (now >= bot.nextPathAt || goalMoved || bot.path.length === 0 || bot.stuckTime > 0.55) {
          bot.path = findPath(
            { x: bot.position.x, z: bot.position.z },
            { x: this.self.position.x, z: this.self.position.z },
            this.collidables,
          );
          bot.pathGoal = { x: this.self.position.x, z: this.self.position.z };
          bot.nextPathAt = now + 550 + Math.random() * 350;
          if (bot.stuckTime > 0.55) bot.strafe *= -1;
        }

        const next = bot.path[0] ?? bot.waypoint;
        const px = next.x - bot.position.x;
        const pz = next.z - bot.position.z;
        const pd = Math.max(Math.hypot(px, pz), 0.001);
        if (pd < 1.1 && bot.path.length > 0) bot.path.shift();
        moveX = px / pd;
        moveZ = pz / pd;
      }
    } else {
      const wx = bot.waypoint.x - bot.position.x;
      const wz = bot.waypoint.z - bot.position.z;
      const wdist = Math.max(Math.hypot(wx, wz), 0.001);
      if (wdist < 1.5 || pointBlocked(bot.waypoint.x, bot.waypoint.z, this.collidables)) {
        bot.waypoint = randomWaypoint();
        bot.path = [];
      }
      if (now >= bot.nextPathAt || bot.path.length === 0 || bot.stuckTime > 0.75) {
        bot.path = findPath(
          { x: bot.position.x, z: bot.position.z },
          bot.waypoint,
          this.collidables,
        );
        bot.pathGoal = { ...bot.waypoint };
        bot.nextPathAt = now + 900 + Math.random() * 700;
      }
      const next = bot.path[0] ?? bot.waypoint;
      const px = next.x - bot.position.x;
      const pz = next.z - bot.position.z;
      const pd = Math.max(Math.hypot(px, pz), 0.001);
      if (pd < 1.1 && bot.path.length > 0) bot.path.shift();
      moveX = wx / wdist;
      moveZ = wz / wdist;
      moveX = px / pd;
      moveZ = pz / pd;
      targetYaw = Math.atan2(-moveX, -moveZ);
    }

    const moveLength = Math.max(Math.hypot(moveX, moveZ), 1);
    const collided = moveBotWithCollision(bot, moveX / moveLength, moveZ / moveLength, speed * dt, this.collidables);
    if (collided) {
      bot.path = [];
      bot.nextPathAt = 0;
      bot.strafe *= -1;
    }
    const yawDiff = ((targetYaw - bot.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    bot.rotation = { x: 0, y: bot.rotation.y + yawDiff * Math.min(dt * 8, 1) };

    this.callbacks.onPlayerMoved({
      id: bot.id,
      position: bot.position,
      rotation: bot.rotation,
      mapId: this.mapId,
    });

    const fireRate = 1600 - this.difficulty * 180;
    const accuracy = 0.08 + this.difficulty * 0.07 + (dist < 8 ? 0.1 : 0);
    if (los && now - bot.lastShot > fireRate) {
      bot.lastShot = now;
      if (Math.random() < accuracy) this.damagePlayer(bot);
    }
  }

  private damagePlayer(bot: LocalBot) {
    if (!this.self.alive) return;
    if (Date.now() < this.playerGraceUntil) return;
    const hit = applyLocalDamage(this.self, 8 + this.difficulty * 2);
    this.callbacks.onPlayerHit({ id: this.self.id, ...hit, mapId: this.mapId });

    if (this.self.health > 0) return;

    this.self.alive = false;
    this.self.deaths += 1;
    bot.kills += 1;
    this.callbacks.onPlayerDied(localKillEvent({
      id: this.self.id,
      killerId: bot.id,
      killerNickname: bot.nickname,
      victimNickname: this.self.nickname,
      kills: bot.kills,
      mapId: this.mapId,
    }));

    setTimeout(() => {
      if (!this.timer) return;
      this.self.position = randomSpawn();
      this.self.health = MAX_HEALTH;
      Object.assign(this.self, shieldState());
      this.self.alive = true;
      this.playerGraceUntil = Date.now() + 5000;
      this.callbacks.onPlayerRespawned({
        id: this.self.id,
        position: this.self.position,
        health: MAX_HEALTH,
        shield: this.self.shield,
        maxShield: this.self.maxShield,
        mapId: this.mapId,
      });
    }, RESPAWN_DELAY);
  }

  private respawnBot(bot: LocalBot) {
    bot.position = randomSpawn();
    bot.health = MAX_HEALTH;
    Object.assign(bot, shieldState());
    bot.alive = true;
    bot.waypoint = randomWaypoint();
    this.callbacks.onPlayerRespawned({
      id: bot.id,
      position: bot.position,
      health: MAX_HEALTH,
      shield: bot.shield,
      maxShield: bot.maxShield,
      mapId: this.mapId,
    });
  }
}

export function useSocket(
  joinPayload: JoinPayload | null,
  onInit: (self: PlayerState, others: PlayerState[]) => void,
  onPlayerJoined: (p: PlayerState) => void,
  onPlayerMoved: (data: { id: string; position: { x: number; y: number; z: number }; rotation: { x: number; y: number }; mapId?: PlayerState["mapId"] }) => void,
  onPlayerHit: (data: { id: string; health: number; shield?: number; maxShield?: number; shieldDamage?: number; healthDamage?: number; shieldHit?: boolean; mapId?: PlayerState["mapId"] }) => void,
  onPlayerDied: (data: KillEvent) => void,
  onPlayerRespawned: (data: { id: string; position: { x: number; y: number; z: number }; health: number; shield?: number; maxShield?: number; mapId?: PlayerState["mapId"] }) => void,
  onPlayerLeft: (id: string) => void,
  onPlayerWeapon?: (data: { id: string; weapon: WeaponId; mapId?: PlayerState["mapId"] }) => void,
  onPlayerShield?: (data: { id: string; shield: number; maxShield: number; health?: number; mapId?: PlayerState["mapId"] }) => void,
  onJoinError?: (message: string) => void,
  onLobbyState?: (state: PrivateLobbyState) => void,
  onLobbyError?: (message: string) => void,
) {
  const socketRef = useRef<Socket | null>(null);
  const localSessionRef = useRef<LocalSoloSession | null>(null);

  useEffect(() => {
    if (!joinPayload) return;
    localSessionRef.current?.cleanup();
    localSessionRef.current = null;

    const startLocalSession = () => {
      if (localSessionRef.current) return;
      if (!joinPayload.solo && joinPayload.privateLobby) {
        onJoinError?.("Private lobbies require the multiplayer server connection.");
        return;
      }
      socketRef.current?.disconnect();
      socketRef.current = null;
      localSessionRef.current = new LocalSoloSession({
        ...joinPayload,
        solo: true,
        botCount: Math.max(joinPayload.botCount, 5),
        difficulty: joinPayload.difficulty ?? 1,
      }, {
        onInit,
        onPlayerMoved,
        onPlayerHit,
        onPlayerDied,
        onPlayerRespawned,
        onPlayerWeapon,
        onPlayerShield,
      });
    };

    const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

    if (joinPayload.solo || (!API_ORIGIN && !isLocalHost)) {
      startLocalSession();

      return () => {
        localSessionRef.current?.cleanup();
        localSessionRef.current = null;
      };
    }

    const socket = io(API_ORIGIN || window.location.origin, {
      path: `${BASE}/ws/socket.io`,
      transports: ["websocket"],
      reconnectionAttempts: 4,
      timeout: 7000,
    });

    socketRef.current = socket;
    const fallbackTimer = setTimeout(() => {
      if (!socket.connected) startLocalSession();
    }, 2200);

    socket.on("connect", () => {
      clearTimeout(fallbackTimer);
      socket.emit("join", joinPayload);
    });

    socket.on("init", ({ self, players, lobby }: { self: PlayerState; players: PlayerState[]; lobby?: PrivateLobbyState }) => {
      clearTimeout(fallbackTimer);
      if (lobby) onLobbyState?.(lobby);
      onInit(self, players);
    });

    socket.on("connect_error", () => {
      startLocalSession();
    });

    socket.on("joinError", (data: { message?: string }) => {
      onJoinError?.(data.message ?? "Unable to join this lobby.");
      socket.disconnect();
    });
    socket.on("lobbyError", (data: { message?: string }) => {
      onLobbyError?.(data.message ?? "Unable to update this private lobby.");
    });
    socket.on("lobbyClosed", (data: { message?: string }) => {
      onJoinError?.(data.message ?? "Private lobby closed.");
      socket.disconnect();
    });
    socket.on("lobbyState", (state: PrivateLobbyState) => {
      clearTimeout(fallbackTimer);
      onLobbyState?.(state);
    });
    socket.on("matchStarting", (state: PrivateLobbyState) => {
      onLobbyState?.(state);
    });
    socket.on("playerJoined", onPlayerJoined);
    socket.on("playerMoved", onPlayerMoved);
    socket.on("playerHit", onPlayerHit);
    if (onPlayerShield) socket.on("playerShield", onPlayerShield);
    socket.on("playerDied", onPlayerDied);
    socket.on("playerRespawned", onPlayerRespawned);
    socket.on("playerLeft", onPlayerLeft);
    if (onPlayerWeapon) socket.on("playerWeapon", onPlayerWeapon);

    return () => {
      clearTimeout(fallbackTimer);
      socket.disconnect();
      socketRef.current = null;
      localSessionRef.current?.cleanup();
      localSessionRef.current = null;
    };
  }, [joinPayload]);

  const sendMove = useCallback(
    (position: { x: number; y: number; z: number }, rotation: { x: number; y: number }) => {
      localSessionRef.current?.move(position, rotation);
      socketRef.current?.emit("move", { position, rotation });
    },
    [],
  );

  const sendShoot = useCallback((targetId: string, damage: number) => {
    localSessionRef.current?.shoot(targetId, damage);
    socketRef.current?.emit("shoot", { targetId, damage });
  }, []);

  const sendWeapon = useCallback((weapon: WeaponId) => {
    localSessionRef.current?.weapon(weapon);
    socketRef.current?.emit("weapon", weapon);
  }, []);

  const startPrivateLobby = useCallback(() => {
    socketRef.current?.emit("startPrivateLobby");
  }, []);

  return { sendMove, sendShoot, sendWeapon, startPrivateLobby };
}
