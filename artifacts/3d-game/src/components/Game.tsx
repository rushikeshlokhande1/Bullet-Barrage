import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Arena } from "./Arena";
import { RemotePlayer } from "./RemotePlayer";
import { FPSControls } from "./FPSControls";
import { HUD } from "./HUD";
import { useSocket } from "../hooks/useSocket";
import type { PlayerState, KillEvent } from "../types/game";

const MAX_HEALTH = 100;
const MAX_AMMO = 12;

interface Props {
  nickname: string;
}

export function Game({ nickname }: Props) {
  const [self, setSelf] = useState<PlayerState | null>(null);
  const playersRef = useRef<Map<string, PlayerState>>(new Map());
  const [playersTick, setPlayersTick] = useState(0);
  const [kills, setKills] = useState(0);
  const [health, setHealth] = useState(MAX_HEALTH);
  const [alive, setAlive] = useState(true);
  const [killFeed, setKillFeed] = useState<KillEvent[]>([]);
  const [ammo, setAmmo] = useState(MAX_AMMO);
  const [reloading, setReloading] = useState(false);
  const [showMuzzleFlash, setShowMuzzleFlash] = useState(false);
  const [showHitIndicator, setShowHitIndicator] = useState(false);
  const [showDamage, setShowDamage] = useState(false);
  const [locked, setLocked] = useState(false);

  const selfId = useRef<string>("");
  const selfRef = useRef<PlayerState | null>(null);

  useEffect(() => {
    selfRef.current = self;
  }, [self]);

  const onInit = useCallback((initSelf: PlayerState, others: PlayerState[]) => {
    selfId.current = initSelf.id;
    setSelf(initSelf);
    selfRef.current = initSelf;
    setHealth(initSelf.health);
    setAlive(initSelf.alive);
    setKills(initSelf.kills);
    for (const p of others) {
      playersRef.current.set(p.id, p);
    }
    setPlayersTick((t) => t + 1);
  }, []);

  const onPlayerJoined = useCallback((p: PlayerState) => {
    playersRef.current.set(p.id, p);
    setPlayersTick((t) => t + 1);
  }, []);

  const onPlayerMoved = useCallback(
    (data: { id: string; position: { x: number; y: number; z: number }; rotation: { x: number; y: number } }) => {
      const p = playersRef.current.get(data.id);
      if (p) {
        p.position = data.position;
        p.rotation = data.rotation;
      }
    },
    [],
  );

  const onPlayerHit = useCallback((data: { id: string; health: number }) => {
    if (data.id === selfId.current) {
      setHealth(data.health);
      setShowDamage(true);
      setTimeout(() => setShowDamage(false), 200);
    } else {
      const p = playersRef.current.get(data.id);
      if (p) p.health = data.health;
    }
  }, []);

  const onPlayerDied = useCallback((data: KillEvent) => {
    if (data.id === selfId.current) {
      setAlive(false);
      setSelf((prev) => prev ? { ...prev, alive: false } : prev);
    } else {
      const p = playersRef.current.get(data.id);
      if (p) p.alive = false;
      setPlayersTick((t) => t + 1);
    }
    if (data.killerId === selfId.current) {
      setKills(data.kills);
    }
    setKillFeed((prev) => [
      ...prev,
      { ...data, timestamp: Date.now() },
    ]);
    setTimeout(() => {
      setKillFeed((prev) => prev.slice(1));
    }, 4000);
  }, []);

  const onPlayerRespawned = useCallback(
    (data: { id: string; position: { x: number; y: number; z: number }; health: number }) => {
      if (data.id === selfId.current) {
        setHealth(data.health);
        setAlive(true);
        setSelf((prev) =>
          prev ? { ...prev, health: data.health, alive: true, position: data.position } : prev,
        );
      } else {
        const p = playersRef.current.get(data.id);
        if (p) {
          p.alive = true;
          p.health = data.health;
          p.position = data.position;
        }
        setPlayersTick((t) => t + 1);
      }
    },
    [],
  );

  const onPlayerLeft = useCallback((id: string) => {
    playersRef.current.delete(id);
    setPlayersTick((t) => t + 1);
  }, []);

  const { sendMove, sendShoot } = useSocket(
    nickname,
    onInit,
    onPlayerJoined,
    onPlayerMoved,
    onPlayerHit,
    onPlayerDied,
    onPlayerRespawned,
    onPlayerLeft,
  );

  const handleAmmoChange = useCallback((a: number, r: boolean) => {
    setAmmo(a);
    setReloading(r);
  }, []);

  const handleMuzzleFlash = useCallback(() => {
    setShowMuzzleFlash(true);
    setTimeout(() => setShowMuzzleFlash(false), 80);
  }, []);

  const handleHitConfirmed = useCallback(() => {
    setShowHitIndicator(true);
    setTimeout(() => setShowHitIndicator(false), 150);
  }, []);

  useEffect(() => {
    const onLockChange = () => {
      setLocked(document.pointerLockElement !== null);
    };
    document.addEventListener("pointerlockchange", onLockChange);
    return () => document.removeEventListener("pointerlockchange", onLockChange);
  }, []);

  const remotePlayers = Array.from(playersRef.current.values());

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0a0a14" }}>
      <Canvas
        camera={{ fov: 80, near: 0.05, far: 500 }}
        style={{ width: "100%", height: "100%" }}
        gl={{ antialias: false }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 20, 10]} intensity={0.8} />
        <fog attach="fog" args={["#0a0a14", 30, 80]} />

        <Arena />

        {remotePlayers.map((p) => (
          <RemotePlayer key={p.id} player={p} />
        ))}

        {self && (
          <FPSControls
            self={self}
            players={playersRef.current}
            onMove={sendMove}
            onShoot={sendShoot}
            onAmmoChange={handleAmmoChange}
            onMuzzleFlash={handleMuzzleFlash}
            onHitConfirmed={handleHitConfirmed}
            alive={alive}
          />
        )}
      </Canvas>

      {self && (
        <HUD
          health={health}
          maxHealth={MAX_HEALTH}
          kills={kills}
          alive={alive}
          nickname={nickname}
          killFeed={killFeed}
          ammo={ammo}
          maxAmmo={MAX_AMMO}
          reloading={reloading}
          showMuzzleFlash={showMuzzleFlash}
          showHitIndicator={showHitIndicator}
          showDamage={showDamage}
        />
      )}

      {!locked && self && alive && (
        <div className="click-to-play">Click to capture mouse</div>
      )}

      {!self && (
        <div className="click-to-play">Connecting...</div>
      )}
    </div>
  );
}
