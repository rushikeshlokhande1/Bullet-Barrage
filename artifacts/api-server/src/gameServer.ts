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
  kills: number;
  deaths: number;
  alive: boolean;
  color: string;
  weapon: string;
}

type BotState = "idle" | "patrol" | "chase" | "attack" | "dead";

interface Bot extends Player {
  state: BotState;
  waypointX: number;
  waypointZ: number;
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
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAYER_COLORS = [
  "#e74c3c", "#3498db", "#2ecc71", "#f39c12",
  "#9b59b6", "#1abc9c", "#e67e22", "#e91e63",
  "#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4",
];

const BOT_NAMES = [
  "EggSlayer", "PoachDaddy", "HardBoiled", "OmeletteKing",
  "ScrambleMaster", "BenedictBot", "FriedEgg", "YolkWarrior",
  "SunnyBot", "OverEasyAI",
];

const BOT_WEAPONS = ["rifle", "shotgun", "sniper"];

const SPAWN_POINTS = [
  { x: -17, y: 0.8, z: -17 }, { x: 17, y: 0.8, z: -17 },
  { x: -17, y: 0.8, z:  17 }, { x: 17, y: 0.8, z:  17 },
  { x:   0, y: 0.8, z: -19 }, { x:  0, y: 0.8, z:  19 },
  { x: -19, y: 0.8, z:   0 }, { x: 19, y: 0.8, z:   0 },
];

const WAYPOINTS = [
  ...SPAWN_POINTS.map((p) => ({ x: p.x, z: p.z })),
  { x:  0, z:  0 }, { x: -8, z:  0 }, { x:  8, z:  0 },
  { x:  0, z: -8 }, { x:  0, z:  8 },
  { x: -13, z: -5 }, { x: 13, z:  5 },
  { x: -13, z:  5 }, { x: 13, z: -5 },
  { x: -5, z: -13 }, { x:  5, z: 13 },
];

const MAX_HEALTH = 100;
const RESPAWN_DELAY = 3000;
const BOT_SPEED = 5.5;
const BOT_TICK = 100;
const GRAVITY = -20;
const PLAYER_HEIGHT = 0.8;
const SIGHT_RANGE = 28;
const ATTACK_RANGE = 18;

function getRandomSpawn() {
  return { ...SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)] };
}

function getRandomWaypoint() {
  return { ...WAYPOINTS[Math.floor(Math.random() * WAYPOINTS.length)] };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function angleDiff(a: number, b: number) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// ─── Solo Session ─────────────────────────────────────────────────────────────

class SoloSession {
  private socket: Socket;
  private player: Player;
  private bots = new Map<string, Bot>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTick = Date.now();
  private difficulty: number;

  constructor(socket: Socket, nickname: string, botCount: number, difficulty: number) {
    this.socket = socket;
    this.difficulty = difficulty;

    const spawn = getRandomSpawn();
    this.player = {
      id: socket.id,
      nickname: String(nickname).slice(0, 20) || "Player",
      position: spawn,
      rotation: { x: 0, y: 0 },
      health: MAX_HEALTH,
      kills: 0,
      deaths: 0,
      alive: true,
      color: PLAYER_COLORS[0],
      weapon: "rifle",
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
    const sp = SPAWN_POINTS[(index + 2) % SPAWN_POINTS.length];
    const wp = getRandomWaypoint();
    const weaponChoice = BOT_WEAPONS[Math.floor(Math.random() * BOT_WEAPONS.length)];
    const fireRateMap: Record<string, number> = {
      rifle:   1800 - this.difficulty * 300,   // easy:1800 normal:1500 hard:1200
      shotgun: 2600 - this.difficulty * 400,   // easy:2600 normal:2200 hard:1800
      sniper:  3800 - this.difficulty * 600,   // easy:3800 normal:3200 hard:2600
    };
    // easy:0.12  normal:0.22  hard:0.32
    const accuracyBase = 0.12 + this.difficulty * 0.10;

    return {
      id: `bot_${index}_${this.socket.id}`,
      nickname: BOT_NAMES[index % BOT_NAMES.length],
      position: { x: sp.x, y: sp.y, z: sp.z },
      rotation: { x: 0, y: Math.random() * Math.PI * 2 },
      health: MAX_HEALTH,
      kills: 0,
      deaths: 0,
      alive: true,
      color: PLAYER_COLORS[(index + 1) % PLAYER_COLORS.length],
      weapon: weaponChoice,
      state: "idle",
      waypointX: wp.x,
      waypointZ: wp.z,
      lastShot: 0,
      strafDir: 1,
      strafTimer: 1,
      idleTimer: 1 + Math.random() * 1.5,
      velY: 0,
      isGrounded: true,
      jumpTimer: 3 + Math.random() * 5,
      respawnTimer: 0,
      fireRate: fireRateMap[weaponChoice] ?? 1000,
      accuracy: accuracyBase,
    };
  }

  private tick() {
    const now = Date.now();
    const dt = Math.min((now - this.lastTick) / 1000, 0.2);
    this.lastTick = now;

    for (const bot of this.bots.values()) {
      this.updateBot(bot, dt, now);
    }
  }

  private updateBot(bot: Bot, dt: number, now: number) {
    if (bot.state === "dead") {
      bot.respawnTimer -= dt;
      if (bot.respawnTimer <= 0) {
        const sp = getRandomSpawn();
        bot.health = MAX_HEALTH;
        bot.alive = true;
        bot.state = "patrol";
        bot.position = { x: sp.x, y: sp.y, z: sp.z };
        bot.velY = 0;
        this.socket.emit("playerRespawned", { id: bot.id, position: bot.position, health: MAX_HEALTH });
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
        if (player.alive && distToPlayer < SIGHT_RANGE) {
          bot.state = distToPlayer < ATTACK_RANGE ? "attack" : "chase";
        }
        break;

      case "chase":
        if (!player.alive || distToPlayer > SIGHT_RANGE + 5) {
          bot.state = "patrol";
        } else if (distToPlayer < ATTACK_RANGE) {
          bot.state = "attack";
        }
        break;

      case "attack":
        if (!player.alive || distToPlayer > SIGHT_RANGE + 5) {
          bot.state = "patrol";
        } else if (distToPlayer > ATTACK_RANGE + 3) {
          bot.state = "chase";
        }
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

    // ── Jump timer ─────────────────────────────────────────────────────────
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
      } else {
        moveX = wdx / wDist;
        moveZ = wdz / wDist;
        targetYaw = Math.atan2(-moveX, -moveZ);
      }
    } else if (bot.state === "chase") {
      if (distToPlayer > 0.1) {
        moveX = dx / distToPlayer;
        moveZ = dz / distToPlayer;
        targetYaw = Math.atan2(-dx, -dz);
      }
    } else if (bot.state === "attack") {
      targetYaw = Math.atan2(-dx, -dz);

      // Strafe
      bot.strafTimer -= dt;
      if (bot.strafTimer <= 0) {
        bot.strafDir = Math.random() > 0.5 ? 1 : -1;
        bot.strafTimer = 0.7 + Math.random() * 1.0;
      }
      const perpX = Math.cos(targetYaw) * bot.strafDir;
      const perpZ = -Math.sin(targetYaw) * bot.strafDir;

      // Back off if too close
      const closeFactor = distToPlayer < 5 ? -0.6 : 0;
      moveX = perpX * 0.8 + (dx / (distToPlayer || 1)) * closeFactor;
      moveZ = perpZ * 0.8 + (dz / (distToPlayer || 1)) * closeFactor;

      // ── Shoot ────────────────────────────────────────────────────────────
      if (now - bot.lastShot > bot.fireRate && player.alive) {
        bot.lastShot = now;
        const hitRoll = Math.random();
        const hitThreshold =
          distToPlayer < 6 ? bot.accuracy + 0.25
          : distToPlayer < 12 ? bot.accuracy
          : bot.accuracy - 0.2;

        if (hitRoll < hitThreshold) {
          const dmgMap: Record<string, number> = { rifle: 20, shotgun: 14, sniper: 38 };
          const dmg = dmgMap[bot.weapon] ?? 20;

          player.health = Math.max(0, player.health - dmg);
          this.socket.emit("playerHit", { id: player.id, health: player.health });

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

            // Auto-respawn player
            setTimeout(() => {
              if (!this.bots.has(bot.id)) return;
              const sp = getRandomSpawn();
              player.health = MAX_HEALTH;
              player.alive = true;
              player.position = sp;
              this.socket.emit("playerRespawned", { id: player.id, position: sp, health: MAX_HEALTH });
            }, RESPAWN_DELAY);
          }
        }
      }
    }

    // Smooth rotate
    const yawDiff = angleDiff(bot.rotation.y, targetYaw);
    bot.rotation.y += yawDiff * Math.min(dt * 10, 1);

    // Apply movement
    const speed = bot.state === "attack" ? BOT_SPEED * 0.75 : BOT_SPEED;
    bot.position.x = Math.max(-33, Math.min(33, bot.position.x + moveX * speed * dt));
    bot.position.z = Math.max(-33, Math.min(33, bot.position.z + moveZ * speed * dt));

    // Emit movement
    this.socket.emit("playerMoved", {
      id: bot.id,
      position: bot.position,
      rotation: { x: 0, y: bot.rotation.y },
    });
  }

  handleShoot(targetId: string, damage: number) {
    const bot = this.bots.get(targetId);
    if (!bot || !bot.alive) return;

    const dmg = Math.min(Math.max(Number(damage) || 0, 0), 100);
    bot.health = Math.max(0, bot.health - dmg);
    this.socket.emit("playerHit", { id: bot.id, health: bot.health });

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

  io.on("connection", (socket: Socket) => {
    logger.info({ id: socket.id }, "Player connected");

    socket.on("join", (data: string | { nickname: string; solo?: boolean; botCount?: number; difficulty?: number }) => {
      const isObj = typeof data === "object" && data !== null;
      const nickname = String(isObj ? data.nickname : data).slice(0, 20) || "Player";
      const solo = isObj ? !!data.solo : false;
      const botCount = isObj ? Math.min(data.botCount ?? 5, 10) : 0;
      const difficulty = isObj ? Math.min(Math.max(data.difficulty ?? 1, 0), 2) : 1;

      if (solo) {
        const session = new SoloSession(socket, nickname, botCount, difficulty);
        soloSessions.set(socket.id, session);
        return;
      }

      const spawn = getRandomSpawn();
      const colorIndex = players.size % PLAYER_COLORS.length;
      const player: Player = {
        id: socket.id,
        nickname,
        position: spawn,
        rotation: { x: 0, y: 0 },
        health: MAX_HEALTH,
        kills: 0,
        deaths: 0,
        alive: true,
        color: PLAYER_COLORS[colorIndex],
        weapon: "rifle",
      };
      players.set(socket.id, player);

      socket.emit("init", {
        self: player,
        players: Array.from(players.values()).filter((p) => p.id !== socket.id),
      });
      socket.broadcast.emit("playerJoined", player);
      logger.info({ id: socket.id, nickname }, "Player joined multiplayer");
    });

    socket.on("move", (data: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number } }) => {
      const session = soloSessions.get(socket.id);
      if (session) {
        session.handleMove(data.position, data.rotation);
        return;
      }
      const p = players.get(socket.id);
      if (!p || !p.alive) return;
      p.position = data.position;
      p.rotation = data.rotation;
      socket.broadcast.emit("playerMoved", { id: socket.id, position: data.position, rotation: data.rotation });
    });

    socket.on("weapon", (weapon: string) => {
      const p = players.get(socket.id);
      if (!p) return;
      p.weapon = weapon;
      socket.broadcast.emit("playerWeapon", { id: socket.id, weapon });
    });

    socket.on("shoot", (data: { targetId: string; damage: number }) => {
      const session = soloSessions.get(socket.id);
      if (session) {
        session.handleShoot(data.targetId, data.damage);
        return;
      }

      const shooter = players.get(socket.id);
      const target = players.get(data.targetId);
      if (!shooter || !target || !target.alive || !shooter.alive) return;

      const dmg = Math.min(Math.max(Number(data.damage) || 0, 0), 100);
      target.health = Math.max(0, target.health - dmg);
      io.emit("playerHit", { id: data.targetId, health: target.health });

      if (target.health <= 0) {
        target.alive = false;
        target.deaths++;
        shooter.kills++;
        io.emit("playerDied", {
          id: data.targetId,
          killerId: socket.id,
          killerNickname: shooter.nickname,
          kills: shooter.kills,
        });
        logger.info({ shooter: shooter.nickname, victim: target.nickname }, "Kill");
        setTimeout(() => {
          const t = players.get(data.targetId);
          if (!t) return;
          const sp = getRandomSpawn();
          t.health = MAX_HEALTH;
          t.alive = true;
          t.position = sp;
          io.emit("playerRespawned", { id: data.targetId, position: sp, health: MAX_HEALTH });
        }, RESPAWN_DELAY);
      }
    });

    socket.on("disconnect", () => {
      const session = soloSessions.get(socket.id);
      if (session) {
        session.cleanup();
        soloSessions.delete(socket.id);
      }
      players.delete(socket.id);
      io.emit("playerLeft", socket.id);
      logger.info({ id: socket.id }, "Player disconnected");
    });
  });

  return httpServer;
}
