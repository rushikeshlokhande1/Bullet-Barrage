import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { PlayerState, KillEvent, JoinPayload } from "../types/game";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function useSocket(
  joinPayload: JoinPayload | null,
  onInit: (self: PlayerState, others: PlayerState[]) => void,
  onPlayerJoined: (p: PlayerState) => void,
  onPlayerMoved: (data: { id: string; position: { x: number; y: number; z: number }; rotation: { x: number; y: number } }) => void,
  onPlayerHit: (data: { id: string; health: number }) => void,
  onPlayerDied: (data: KillEvent) => void,
  onPlayerRespawned: (data: { id: string; position: { x: number; y: number; z: number }; health: number }) => void,
  onPlayerLeft: (id: string) => void,
) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!joinPayload) return;

    const socket = io(window.location.origin, {
      path: `${BASE}/ws/socket.io`,
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join", joinPayload);
    });

    socket.on("init", ({ self, players }: { self: PlayerState; players: PlayerState[] }) => {
      onInit(self, players);
    });

    socket.on("playerJoined", onPlayerJoined);
    socket.on("playerMoved", onPlayerMoved);
    socket.on("playerHit", onPlayerHit);
    socket.on("playerDied", onPlayerDied);
    socket.on("playerRespawned", onPlayerRespawned);
    socket.on("playerLeft", onPlayerLeft);

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [joinPayload]);

  const sendMove = useCallback(
    (position: { x: number; y: number; z: number }, rotation: { x: number; y: number }) => {
      socketRef.current?.emit("move", { position, rotation });
    },
    [],
  );

  const sendShoot = useCallback((targetId: string, damage: number) => {
    socketRef.current?.emit("shoot", { targetId, damage });
  }, []);

  return { sendMove, sendShoot };
}
