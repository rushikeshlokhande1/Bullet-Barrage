import { Server as SocketIOServer, Socket } from "socket.io";
import { createServer } from "http";
import type { Express } from "express";
import { logger } from "./lib/logger";

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
}

const PLAYER_COLORS = [
  "#e74c3c", "#3498db", "#2ecc71", "#f39c12",
  "#9b59b6", "#1abc9c", "#e67e22", "#e91e63",
];

const MAX_HEALTH = 100;
const RESPAWN_DELAY = 3000;

const players = new Map<string, Player>();

const SPAWN_POINTS = [
  { x: 0, y: 1, z: 0 },
  { x: 10, y: 1, z: 10 },
  { x: -10, y: 1, z: 10 },
  { x: 10, y: 1, z: -10 },
  { x: -10, y: 1, z: -10 },
];

function getRandomSpawn() {
  return SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
}

function getPlayerColor(index: number) {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

export function createGameServer(app: Express) {
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
    path: "/ws/socket.io",
  });

  io.on("connection", (socket: Socket) => {
    logger.info({ id: socket.id }, "Player connected");

    socket.on("join", (nickname: string) => {
      const spawn = getRandomSpawn();
      const colorIndex = players.size;
      const player: Player = {
        id: socket.id,
        nickname: nickname.slice(0, 20) || "Player",
        position: { ...spawn },
        rotation: { x: 0, y: 0 },
        health: MAX_HEALTH,
        kills: 0,
        deaths: 0,
        alive: true,
        color: getPlayerColor(colorIndex),
      };
      players.set(socket.id, player);

      socket.emit("init", {
        self: player,
        players: Array.from(players.values()).filter((p) => p.id !== socket.id),
      });

      socket.broadcast.emit("playerJoined", player);
      logger.info({ id: socket.id, nickname: player.nickname }, "Player joined");
    });

    socket.on("move", (data: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number } }) => {
      const player = players.get(socket.id);
      if (!player || !player.alive) return;
      player.position = data.position;
      player.rotation = data.rotation;
      socket.broadcast.emit("playerMoved", {
        id: socket.id,
        position: data.position,
        rotation: data.rotation,
      });
    });

    socket.on("shoot", (data: { targetId: string; damage: number }) => {
      const shooter = players.get(socket.id);
      const target = players.get(data.targetId);
      if (!shooter || !target || !target.alive || !shooter.alive) return;

      const dmg = Math.min(Math.max(data.damage, 0), 50);
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
          if (!players.has(data.targetId)) return;
          const spawn = getRandomSpawn();
          target.health = MAX_HEALTH;
          target.alive = true;
          target.position = { ...spawn };
          io.emit("playerRespawned", {
            id: data.targetId,
            position: spawn,
            health: MAX_HEALTH,
          });
        }, RESPAWN_DELAY);
      }
    });

    socket.on("disconnect", () => {
      players.delete(socket.id);
      io.emit("playerLeft", socket.id);
      logger.info({ id: socket.id }, "Player disconnected");
    });
  });

  return httpServer;
}
