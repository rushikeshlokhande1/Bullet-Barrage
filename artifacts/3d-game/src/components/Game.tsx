import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Arena } from "./Arena";
import { getMap } from "../data/maps";
import { RemotePlayer } from "./RemotePlayer";
import { FPSControls } from "./FPSControls";
import { HUD } from "./HUD";
import { useSocket } from "../hooks/useSocket";
import type { PlayerState, KillEvent, WeaponId, MapId } from "../types/game";
import { WEAPONS } from "../types/game";

const MAX_HEALTH = 100;

interface Props {
  nickname: string;
  mapId: MapId;
}

export function Game({ nickname, mapId }: Props) {
  const [self, setSelf] = useState<PlayerState | null>(null);
  const playersRef = useRef<Map<string, PlayerState>>(new Map());
  const [, forceUpdate] = useState(0);
  const [kills, setKills] = useState(0);
  const [health, setHealth] = useState(MAX_HEALTH);
  const [alive, setAlive] = useState(true);
  const [killFeed, setKillFeed] = useState<KillEvent[]>([]);
  const [ammo, setAmmo] = useState(WEAPONS["rifle"].ammo);
  const [reloading, setReloading] = useState(false);
  const [showMuzzleFlash, setShowMuzzleFlash] = useState(false);
  const [showHitIndicator, setShowHitIndicator] = useState(false);
  const [showDamage, setShowDamage] = useState(false);
  const [locked, setLocked] = useState(false);
  const [currentWeapon, setCurrentWeapon] = useState<WeaponId>("rifle");

  const selfIdRef = useRef("");
  const selfRef = useRef<PlayerState | null>(null);

  const map = getMap(mapId);

  useEffect(() => { selfRef.current = self; }, [self]);

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
      if (p) { p.position = data.position; p.rotation = data.rotation; }
    }, []);

  const onPlayerHit = useCallback((data: { id: string; health: number }) => {
    if (data.id === selfIdRef.current) {
      setHealth(data.health);
      setShowDamage(true);
      setTimeout(() => setShowDamage(false), 200);
    } else {
      const p = playersRef.current.get(data.id);
      if (p) p.health = data.health;
    }
  }, []);

  const onPlayerDied = useCallback((data: KillEvent) => {
    if (data.id === selfIdRef.current) {
      setAlive(false);
    } else {
      const p = playersRef.current.get(data.id);
      if (p) p.alive = false;
      forceUpdate((n) => n + 1);
    }
    if (data.killerId === selfIdRef.current) setKills(data.kills);
    setKillFeed((prev) => [...prev, { ...data, timestamp: Date.now() }]);
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
    nickname, onInit, onPlayerJoined, onPlayerMoved,
    onPlayerHit, onPlayerDied, onPlayerRespawned, onPlayerLeft,
  );

  const handleAmmoChange = useCallback((a: number, r: boolean) => {
    setAmmo(a); setReloading(r);
  }, []);

  const handleMuzzleFlash = useCallback(() => {
    setShowMuzzleFlash(true);
    setTimeout(() => setShowMuzzleFlash(false), 80);
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

  useEffect(() => {
    const fn = () => setLocked(document.pointerLockElement !== null);
    document.addEventListener("pointerlockchange", fn);
    return () => document.removeEventListener("pointerlockchange", fn);
  }, []);

  const remotePlayers = Array.from(playersRef.current.values());
  const [fogColor, fogNear, fogFar] = map.fog;

  return (
    <div style={{ width: "100vw", height: "100vh", background: map.sky }}>
      <Canvas
        camera={{ fov: 80, near: 0.05, far: 500, position: [0, 1.75, 0] }}
        style={{ width: "100%", height: "100%" }}
        gl={{ antialias: false }}
      >
        {/* Bright lighting */}
        <color attach="background" args={[map.sky]} />
        <ambientLight intensity={1.8} />
        <directionalLight position={[10, 20, 5]} intensity={1.5} />
        <directionalLight position={[-10, 10, -5]} intensity={0.8} color="#ffffee" />
        <hemisphereLight args={["#ffffff", "#333344", 0.6]} />
        <fog attach="fog" args={[fogColor, fogNear, fogFar]} />

        <Arena mapId={mapId} />

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
            onWeaponChange={handleWeaponChange}
            alive={alive}
            currentWeapon={currentWeapon}
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
          showMuzzleFlash={showMuzzleFlash}
          showHitIndicator={showHitIndicator}
          showDamage={showDamage}
          currentWeapon={currentWeapon}
          mapName={map.name}
        />
      )}

      {!locked && self && alive && (
        <div className="click-to-play">Click to capture mouse &nbsp;·&nbsp; ESC to release</div>
      )}

      {!self && (
        <div className="click-to-play">Connecting to server...</div>
      )}
    </div>
  );
}
