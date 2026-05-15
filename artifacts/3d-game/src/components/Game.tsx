import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Arena } from "./Arena";
import { getMap } from "../data/maps";
import { RemotePlayer } from "./RemotePlayer";
import { FPSControls } from "./FPSControls";
import { HUD } from "./HUD";
import { BulletEffects } from "./BulletEffect";
import { Scoreboard } from "./Scoreboard";
import type { ImpactEvent } from "./BulletEffect";
import { useSocket } from "../hooks/useSocket";
import type {
  PlayerState, KillEvent, WeaponId, MapId, GameMode, Difficulty,
} from "../types/game";
import { WEAPONS } from "../types/game";

const MAX_HEALTH = 100;
const IMPACT_TTL = 420;
let impactCounter = 0;

interface Props {
  nickname: string;
  mapId: MapId;
  mode: GameMode;
  botCount: number;
  difficulty: Difficulty;
}

export function Game({ nickname, mapId, mode, botCount, difficulty }: Props) {
  const [self, setSelf] = useState<PlayerState | null>(null);
  const playersRef = useRef<Map<string, PlayerState>>(new Map());
  const [, forceUpdate] = useState(0);
  const [kills, setKills] = useState(0);
  const [health, setHealth] = useState(MAX_HEALTH);
  const [alive, setAlive] = useState(true);
  const [killFeed, setKillFeed] = useState<KillEvent[]>([]);
  const [ammo, setAmmo] = useState(WEAPONS["rifle"].ammo);
  const [reloading, setReloading] = useState(false);
  const [showHitIndicator, setShowHitIndicator] = useState(false);
  const [showDamage, setShowDamage] = useState(false);
  const [locked, setLocked] = useState(false);
  const [currentWeapon, setCurrentWeapon] = useState<WeaponId>("rifle");
  const [isShooting, setIsShooting] = useState(false);
  const [impacts, setImpacts] = useState<ImpactEvent[]>([]);
  const [selfDeaths, setSelfDeaths] = useState(0);
  const [showScoreboard, setShowScoreboard] = useState(false);

  const selfIdRef = useRef("");
  const map = getMap(mapId);

  const joinPayload = useMemo(() => ({
    nickname,
    solo: mode === "solo",
    botCount,
    difficulty,
  }), [nickname, mode, botCount, difficulty]);

  const onInit = useCallback((initSelf: PlayerState, others: PlayerState[]) => {
    selfIdRef.current = initSelf.id;
    setSelf(initSelf);
    setHealth(initSelf.health);
    setAlive(initSelf.alive);
    setKills(initSelf.kills);
    for (const p of others) playersRef.current.set(p.id, p);
    forceUpdate((n) => n + 1);
  }, []);

  const onPlayerJoined = useCallback((p: PlayerState) => {
    playersRef.current.set(p.id, p);
    forceUpdate((n) => n + 1);
  }, []);

  const onPlayerMoved = useCallback(
    (data: { id: string; position: { x: number; y: number; z: number }; rotation: { x: number; y: number } }) => {
      const p = playersRef.current.get(data.id);
      if (p) {
        p.position = data.position;
        p.rotation = data.rotation;
      }
    }, []);

  const onPlayerHit = useCallback((data: { id: string; health: number }) => {
    if (data.id === selfIdRef.current) {
      setHealth(data.health);
      setShowDamage(true);
      setTimeout(() => setShowDamage(false), 250);
    } else {
      const p = playersRef.current.get(data.id);
      if (p) p.health = data.health;
    }
  }, []);

  const onPlayerDied = useCallback((data: KillEvent) => {
    // Resolve victim nickname before marking dead
    let victimNickname = data.victimNickname ?? "";
    if (!victimNickname) {
      if (data.id === selfIdRef.current) {
        victimNickname = "you";
      } else {
        victimNickname = playersRef.current.get(data.id)?.nickname ?? "???";
      }
    }

    if (data.id === selfIdRef.current) {
      setAlive(false);
      setSelfDeaths((d) => d + 1);
    } else {
      const p = playersRef.current.get(data.id);
      if (p) {
        p.alive = false;
        p.deaths = (p.deaths ?? 0) + 1;
      }
      forceUpdate((n) => n + 1);
    }
    if (data.killerId === selfIdRef.current) setKills(data.kills);
    const enriched: KillEvent = { ...data, victimNickname, timestamp: Date.now() };
    setKillFeed((prev) => [...prev.slice(-4), enriched]);
    setTimeout(() => setKillFeed((prev) => prev.slice(1)), 4000);
  }, []);

  const onPlayerRespawned = useCallback(
    (data: { id: string; position: { x: number; y: number; z: number }; health: number }) => {
      if (data.id === selfIdRef.current) {
        setHealth(data.health);
        setAlive(true);
        setSelf((prev) => prev ? { ...prev, health: data.health, alive: true, position: data.position } : prev);
      } else {
        const p = playersRef.current.get(data.id);
        if (p) { p.alive = true; p.health = data.health; p.position = data.position; }
        forceUpdate((n) => n + 1);
      }
    }, []);

  const onPlayerLeft = useCallback((id: string) => {
    playersRef.current.delete(id);
    forceUpdate((n) => n + 1);
  }, []);

  const { sendMove, sendShoot } = useSocket(
    joinPayload, onInit, onPlayerJoined, onPlayerMoved,
    onPlayerHit, onPlayerDied, onPlayerRespawned, onPlayerLeft,
  );

  const handleAmmoChange = useCallback((a: number, r: boolean) => {
    setAmmo(a); setReloading(r);
  }, []);

  const handleHitConfirmed = useCallback(() => {
    setShowHitIndicator(true);
    setTimeout(() => setShowHitIndicator(false), 150);
  }, []);

  const handleWeaponChange = useCallback((w: WeaponId) => {
    setCurrentWeapon(w);
    setAmmo(WEAPONS[w].ammo);
    setReloading(false);
  }, []);

  const handleImpact = useCallback((position: THREE.Vector3) => {
    const id = ++impactCounter;
    const event: ImpactEvent = { id, position, timestamp: Date.now() };
    setImpacts((prev) => [...prev.slice(-8), event]);
    setTimeout(() => {
      setImpacts((prev) => prev.filter((e) => e.id !== id));
    }, IMPACT_TTL);
  }, []);

  useEffect(() => {
    const fn = () => setLocked(document.pointerLockElement !== null);
    document.addEventListener("pointerlockchange", fn);
    return () => document.removeEventListener("pointerlockchange", fn);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Tab") {
        e.preventDefault();
        setShowScoreboard(e.type === "keydown");
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  const remotePlayers = Array.from(playersRef.current.values());
  const playerCount = remotePlayers.length + (self ? 1 : 0);

  return (
    <div style={{ width: "100vw", height: "100vh", background: map.sky }}>
      <Canvas
        camera={{ fov: 80, near: 0.05, far: 600, position: [0, 1.75, 0] }}
        style={{ width: "100%", height: "100%" }}
        gl={{ antialias: false }}
      >
        <color attach="background" args={[map.sky]} />
        <ambientLight intensity={2.2} />
        <directionalLight position={[15, 25, 10]} intensity={1.8} />
        <directionalLight position={[-10, 15, -10]} intensity={1.0} color="#fffbe8" />
        <hemisphereLight args={["#ffffff", "#446644", 0.8]} />
        <fog attach="fog" args={[map.fogColor, map.fogNear, map.fogFar]} />

        <Arena mapId={mapId} />

        {remotePlayers.map((p) => (
          <RemotePlayer key={p.id} player={p} />
        ))}

        <BulletEffects impacts={impacts} />

        {self && (
          <FPSControls
            self={self}
            players={playersRef.current}
            onMove={sendMove}
            onShoot={sendShoot}
            onAmmoChange={handleAmmoChange}
            onMuzzleFlash={() => {}}
            onHitConfirmed={handleHitConfirmed}
            onWeaponChange={handleWeaponChange}
            onImpact={handleImpact}
            alive={alive}
            currentWeapon={currentWeapon}
            isShooting={isShooting}
            setIsShooting={setIsShooting}
            boxes={map.boxes}
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
          reloading={reloading}
          showHitIndicator={showHitIndicator}
          showDamage={showDamage}
          currentWeapon={currentWeapon}
          mapName={map.name}
          playerCount={playerCount}
        />
      )}

      {self && showScoreboard && (
        <Scoreboard
          self={self}
          players={remotePlayers}
          selfKills={kills}
          selfDeaths={selfDeaths}
        />
      )}

      {mode === "solo" && self && (
        <div
          style={{
            position: "fixed",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.55)",
            color: "#ffd700",
            fontFamily: "'Black Han Sans', sans-serif",
            fontSize: 13,
            letterSpacing: 2,
            padding: "4px 18px",
            borderRadius: 20,
            border: "1px solid rgba(255,215,0,0.3)",
            pointerEvents: "none",
          }}
        >
          🤖 SOLO MODE
        </div>
      )}

      {!locked && self && alive && (
        <div className="lock-prompt">
          CLICK TO PLAY
          <span className="lock-prompt-sub">ESC to release mouse</span>
        </div>
      )}

      {!self && (
        <div className="lock-prompt">
          CONNECTING...
          <span className="lock-prompt-sub">Please wait</span>
        </div>
      )}
    </div>
  );
}
