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
import type { CasingEvent, DeathBurstEvent, ImpactEvent, ImpactMaterial, TracerEvent } from "./BulletEffect";
import { useSocket } from "../hooks/useSocket";
import type {
  PlayerState, KillEvent, WeaponId, MapId, GameMode, Difficulty, PrivateLobbyState,
} from "../types/game";
import { WEAPONS } from "../types/game";
import { playEliminationCue, playExplosionCue, playHitMarker, playShieldHit, playShieldRecharge } from "../lib/weaponAudio";
import { gameplayStart, gameplayStop } from "../lib/crazyGames";
import { getLeaderboard, submitLeaderboardEntry } from "../lib/leaderboard";
import type { LeaderboardEntry } from "../lib/leaderboard";

const MAX_HEALTH = 100;
const MAX_SHIELD = 75;
const MATCH_DURATION_MS = 7 * 60 * 1000;
const IMPACT_TTL = 640;
const TRACER_TTL = 160;
const CASING_TTL = 1900;
let impactCounter = 0;
let tracerCounter = 0;
let casingCounter = 0;
let deathBurstCounter = 0;

interface Props {
  nickname: string;
  mapId: MapId;
  mode: GameMode;
  botCount: number;
  difficulty: Difficulty;
  privateLobby?: {
    action: "create" | "join";
    name: string;
    password: string;
    maxPlayers?: number;
    clientToken: string;
  };
  onReplay: () => void;
  onExit: () => void;
}

export function Game({ nickname, mapId, mode, botCount, difficulty, privateLobby, onReplay, onExit }: Props) {
  const [self, setSelf] = useState<PlayerState | null>(null);
  const playersRef = useRef<Map<string, PlayerState>>(new Map());
  const [, forceUpdate] = useState(0);
  const [kills, setKills] = useState(0);
  const [health, setHealth] = useState(MAX_HEALTH);
  const [shield, setShield] = useState(MAX_SHIELD);
  const [maxShield, setMaxShield] = useState(MAX_SHIELD);
  const [showShieldHit, setShowShieldHit] = useState(false);
  const [showShieldRecharge, setShowShieldRecharge] = useState(false);
  const [alive, setAlive] = useState(true);
  const [killFeed, setKillFeed] = useState<KillEvent[]>([]);
  const [ammo, setAmmo] = useState(WEAPONS.cluckfire.ammo);
  const [reloading, setReloading] = useState(false);
  const [reloadProgress, setReloadProgress] = useState(0);
  const [reloadLabel, setReloadLabel] = useState("");
  const [showHitIndicator, setShowHitIndicator] = useState(false);
  const [showDamage, setShowDamage] = useState(false);
  const [locked, setLocked] = useState(false);
  const [currentWeapon, setCurrentWeapon] = useState<WeaponId>("cluckfire");
  const [isShooting, setIsShooting] = useState(false);
  const [isAiming, setIsAiming] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [movementState, setMovementState] = useState({ label: "GROUNDED", accuracy: 1 });
  const [impacts, setImpacts] = useState<ImpactEvent[]>([]);
  const [tracers, setTracers] = useState<TracerEvent[]>([]);
  const [casings, setCasings] = useState<CasingEvent[]>([]);
  const [deathBursts, setDeathBursts] = useState<DeathBurstEvent[]>([]);
  const [selfDeaths, setSelfDeaths] = useState(0);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [combatPulse, setCombatPulse] = useState<"" | "shake" | "heavy" | "slowmo">("");
  const [timeRemaining, setTimeRemaining] = useState(MATCH_DURATION_MS);
  const [matchEnded, setMatchEnded] = useState(false);
  const [finalLeaderboard, setFinalLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [joinError, setJoinError] = useState("");
  const [lobbyState, setLobbyState] = useState<PrivateLobbyState | null>(null);
  const [lobbyMessage, setLobbyMessage] = useState("");
  const [activeMapId, setActiveMapId] = useState<MapId>(mapId);

  const selfIdRef = useRef("");
  const selfLiveRef = useRef<PlayerState | null>(null);
  const lastShieldRef = useRef(MAX_SHIELD);
  const matchStartedAtRef = useRef(Date.now());
  const selfDeathsRef = useRef(0);
  const killsRef = useRef(0);
  const lastRecordedRef = useRef("");
  const matchEndedRef = useRef(false);
  const map = getMap(activeMapId);
  const isLocalMapPlayer = useCallback((player: PlayerState) => !player.mapId || player.mapId === activeMapId, [activeMapId]);
  const isLocalMapEvent = useCallback((eventMapId?: MapId) => !eventMapId || eventMapId === activeMapId, [activeMapId]);

  const joinPayload = useMemo(() => ({
    nickname,
    mapId,
    solo: mode === "solo",
    botCount,
    difficulty,
    privateLobby,
  }), [nickname, mapId, mode, botCount, difficulty, privateLobby]);

  const onInit = useCallback((initSelf: PlayerState, others: PlayerState[]) => {
    selfIdRef.current = initSelf.id;
    playersRef.current.clear();
    if (initSelf.mapId) setActiveMapId(initSelf.mapId);
    setSelf(initSelf);
    selfLiveRef.current = initSelf;
    setHealth(initSelf.health);
    setShield(initSelf.shield ?? MAX_SHIELD);
    setMaxShield(initSelf.maxShield ?? MAX_SHIELD);
    lastShieldRef.current = initSelf.shield ?? MAX_SHIELD;
    setAlive(initSelf.alive);
    setKills(initSelf.kills);
    killsRef.current = initSelf.kills;
    selfDeathsRef.current = initSelf.deaths ?? 0;
    matchStartedAtRef.current = Date.now();
    lastRecordedRef.current = "";
    matchEndedRef.current = false;
    setMatchEnded(false);
    setTimeRemaining(MATCH_DURATION_MS);
    setFinalLeaderboard(getLeaderboard());
    for (const p of others) {
      if (isLocalMapPlayer(p)) playersRef.current.set(p.id, p);
    }
    gameplayStart();
    forceUpdate((n) => n + 1);
  }, [isLocalMapPlayer]);

  const onPlayerJoined = useCallback((p: PlayerState) => {
    if (!isLocalMapPlayer(p)) return;
    playersRef.current.set(p.id, p);
    forceUpdate((n) => n + 1);
  }, [isLocalMapPlayer]);

  const onPlayerMoved = useCallback(
    (data: { id: string; position: { x: number; y: number; z: number }; rotation: { x: number; y: number }; mapId?: MapId }) => {
      if (!isLocalMapEvent(data.mapId)) return;
      const p = playersRef.current.get(data.id);
      if (p) {
        p.position = data.position;
        p.rotation = data.rotation;
        forceUpdate((n) => n + 1);
      }
    }, [isLocalMapEvent]);

  const onPlayerHit = useCallback((data: { id: string; health: number; shield?: number; maxShield?: number; shieldDamage?: number; healthDamage?: number; shieldHit?: boolean; mapId?: MapId }) => {
    if (!isLocalMapEvent(data.mapId)) return;
    if (matchEndedRef.current) return;
    if (data.id === selfIdRef.current) {
      setHealth(data.health);
      if (typeof data.shield === "number") {
        setShield(data.shield);
        lastShieldRef.current = data.shield;
      }
      if (typeof data.maxShield === "number") setMaxShield(data.maxShield);
      setSelf((prev) => {
        const next = prev ? {
          ...prev,
          health: data.health,
          shield: data.shield ?? prev.shield,
          maxShield: data.maxShield ?? prev.maxShield,
        } : prev;
        selfLiveRef.current = next;
        return next;
      });
      if (data.shieldHit) {
        playShieldHit((data.shieldDamage ?? 0) / Math.max(1, data.maxShield ?? MAX_SHIELD));
        if ((data.shieldDamage ?? 0) >= 24) {
          setCombatPulse("shake");
          setTimeout(() => setCombatPulse(""), 220);
        }
        setShowShieldHit(true);
        setTimeout(() => setShowShieldHit(false), 320);
      }
      if ((data.healthDamage ?? 0) > 0 || !data.shieldHit) {
        setShowDamage(true);
        if ((data.healthDamage ?? 0) >= 18) {
          setCombatPulse("heavy");
          setTimeout(() => setCombatPulse(""), 280);
        }
        setTimeout(() => setShowDamage(false), 250);
      }
    } else {
      const p = playersRef.current.get(data.id);
      if (p) {
        p.health = data.health;
        if (typeof data.shield === "number") p.shield = data.shield;
        if (typeof data.maxShield === "number") p.maxShield = data.maxShield;
      }
      forceUpdate((n) => n + 1);
    }
  }, [isLocalMapEvent]);

  const onPlayerShield = useCallback((data: { id: string; shield: number; maxShield: number; health?: number; mapId?: MapId }) => {
    if (!isLocalMapEvent(data.mapId)) return;
    if (matchEndedRef.current) return;
    if (data.id === selfIdRef.current) {
      if (data.shield > lastShieldRef.current && lastShieldRef.current <= 0) {
        playShieldRecharge();
        setShowShieldRecharge(true);
        setTimeout(() => setShowShieldRecharge(false), 520);
      }
      lastShieldRef.current = data.shield;
      setShield(data.shield);
      setMaxShield(data.maxShield);
      if (typeof data.health === "number") setHealth(data.health);
      setSelf((prev) => {
        const next = prev ? { ...prev, shield: data.shield, maxShield: data.maxShield, health: data.health ?? prev.health } : prev;
        selfLiveRef.current = next;
        return next;
      });
      return;
    }

    const p = playersRef.current.get(data.id);
    if (p) {
      p.shield = data.shield;
      p.maxShield = data.maxShield;
      if (typeof data.health === "number") p.health = data.health;
      forceUpdate((n) => n + 1);
    }
  }, [isLocalMapEvent]);

  const onPlayerDied = useCallback((data: KillEvent) => {
    if (!isLocalMapEvent(data.mapId)) return;
    if (matchEndedRef.current) return;
    if (data.id !== selfIdRef.current && !playersRef.current.has(data.id)) return;

    // Resolve victim nickname before marking dead
    let victimNickname = data.victimNickname ?? "";
    if (!victimNickname) {
      if (data.id === selfIdRef.current) {
        victimNickname = "you";
      } else {
        victimNickname = playersRef.current.get(data.id)?.nickname ?? "???";
      }
    }

    const victimPlayer = data.id === selfIdRef.current ? selfLiveRef.current : playersRef.current.get(data.id);
    if (victimPlayer) {
      const burstId = ++deathBurstCounter;
      const burst: DeathBurstEvent = {
        id: burstId,
        position: new THREE.Vector3(victimPlayer.position.x, victimPlayer.position.y + 0.2, victimPlayer.position.z),
        color: victimPlayer.color,
        accent: WEAPONS[victimPlayer.weapon]?.accent ?? "#42f5ff",
        timestamp: Date.now(),
      };
      setDeathBursts((prev) => [...prev.slice(-7), burst]);
      setTimeout(() => setDeathBursts((prev) => prev.filter((event) => event.id !== burstId)), 1100);
    }

    if (data.id === selfIdRef.current) {
      setAlive(false);
      const nextDeaths = selfDeathsRef.current + 1;
      setSelfDeaths((d) => {
        const next = d + 1;
        selfDeathsRef.current = next;
        return next;
      });
      setCombatPulse("heavy");
      setTimeout(() => setCombatPulse(""), 320);
      playExplosionCue(0.72);
      lastRecordedRef.current = `${killsRef.current}:${nextDeaths}`;
      submitLeaderboardEntry({
        nickname,
        kills: killsRef.current,
        deaths: nextDeaths,
        durationMs: Date.now() - matchStartedAtRef.current,
        mapId: activeMapId,
        mode,
      });
    } else {
      const p = playersRef.current.get(data.id);
      if (p) {
        p.alive = false;
        p.deaths = (p.deaths ?? 0) + 1;
      }
      forceUpdate((n) => n + 1);
    }
    if (data.killerId === selfIdRef.current) {
      setKills(data.kills);
      killsRef.current = data.kills;
      playHitMarker(true);
      playEliminationCue(data.kills);
      playExplosionCue(0.42);
      setCombatPulse("slowmo");
      setTimeout(() => setCombatPulse(""), 520);
    }
    const enriched: KillEvent = { ...data, victimNickname, timestamp: Date.now() };
    setKillFeed((prev) => [...prev.slice(-4), enriched]);
    setTimeout(() => setKillFeed((prev) => prev.slice(1)), 4000);
  }, [activeMapId, isLocalMapEvent, mode, nickname]);

  const onPlayerRespawned = useCallback(
    (data: { id: string; position: { x: number; y: number; z: number }; health: number; shield?: number; maxShield?: number; mapId?: MapId }) => {
      if (!isLocalMapEvent(data.mapId)) return;
      if (matchEndedRef.current) return;
      if (data.id === selfIdRef.current) {
        setHealth(data.health);
        setShield(data.shield ?? MAX_SHIELD);
        setMaxShield(data.maxShield ?? MAX_SHIELD);
        lastShieldRef.current = data.shield ?? MAX_SHIELD;
        setAlive(true);
        setSelf((prev) => {
          const next = prev ? { ...prev, health: data.health, shield: data.shield ?? prev.shield, maxShield: data.maxShield ?? prev.maxShield, alive: true, position: data.position } : prev;
          selfLiveRef.current = next;
          return next;
        });
      } else {
        const p = playersRef.current.get(data.id);
        if (p) {
          p.alive = true;
          p.health = data.health;
          p.shield = data.shield ?? p.shield;
          p.maxShield = data.maxShield ?? p.maxShield;
          p.position = data.position;
        }
        forceUpdate((n) => n + 1);
      }
    }, [isLocalMapEvent]);

  const onPlayerLeft = useCallback((id: string) => {
    playersRef.current.delete(id);
    forceUpdate((n) => n + 1);
  }, []);

  const onPlayerWeapon = useCallback((data: { id: string; weapon: WeaponId; mapId?: MapId }) => {
    if (!isLocalMapEvent(data.mapId)) return;
    const p = playersRef.current.get(data.id);
    if (p) {
      p.weapon = data.weapon;
      forceUpdate((n) => n + 1);
    }
  }, [isLocalMapEvent]);

  const onLobbyState = useCallback((state: PrivateLobbyState) => {
    setLobbyState(state);
    setActiveMapId(state.mapId);
    setLobbyMessage("");
  }, []);

  const onLobbyError = useCallback((message: string) => {
    setLobbyMessage(message);
  }, []);

  const { sendMove, sendShoot, sendWeapon, startPrivateLobby } = useSocket(
    joinPayload, onInit, onPlayerJoined, onPlayerMoved,
    onPlayerHit, onPlayerDied, onPlayerRespawned, onPlayerLeft,
    onPlayerWeapon, onPlayerShield, setJoinError, onLobbyState, onLobbyError,
  );

  const handleMove = useCallback((position: { x: number; y: number; z: number }, rotation: { x: number; y: number }) => {
    selfLiveRef.current = selfLiveRef.current
      ? { ...selfLiveRef.current, position, rotation }
      : null;
    setSelf((prev) => {
      const next = prev ? { ...prev, position, rotation } : prev;
      selfLiveRef.current = next;
      return next;
    });
    sendMove(position, rotation);
  }, [sendMove]);

  const handleAmmoChange = useCallback((a: number, r: boolean) => {
    setAmmo(a); setReloading(r);
  }, []);

  const handleReloadProgress = useCallback((progress: number, label: string) => {
    setReloadProgress(progress);
    setReloadLabel(label);
  }, []);

  const handleHitConfirmed = useCallback(() => {
    playHitMarker(false);
    setShowHitIndicator(true);
    setTimeout(() => setShowHitIndicator(false), 150);
  }, []);

  const recordCurrentRun = useCallback(() => {
    const signature = `${killsRef.current}:${selfDeathsRef.current}`;
    if (signature === lastRecordedRef.current) return;
    lastRecordedRef.current = signature;
    submitLeaderboardEntry({
      nickname,
      kills: killsRef.current,
      deaths: selfDeathsRef.current,
      durationMs: Date.now() - matchStartedAtRef.current,
      mapId: activeMapId,
      mode,
    });
  }, [activeMapId, mode, nickname]);

  const finishMatch = useCallback(() => {
    if (matchEndedRef.current) return;
    matchEndedRef.current = true;
    setMatchEnded(true);
    setShowScoreboard(false);
    recordCurrentRun();
    setFinalLeaderboard(getLeaderboard());
    if (document.pointerLockElement instanceof HTMLElement) document.exitPointerLock();
    gameplayStop();
  }, [recordCurrentRun]);

  const handleWeaponChange = useCallback((w: WeaponId) => {
    setCurrentWeapon(w);
    setAmmo(WEAPONS[w].ammo);
    setReloading(false);
    setReloadProgress(0);
    setReloadLabel("");
    sendWeapon(w);
  }, [sendWeapon]);

  const handleProjectileVfx = useCallback((event: {
    start: THREE.Vector3;
    end: THREE.Vector3;
    casingPosition: THREE.Vector3;
    casingVelocity: THREE.Vector3;
    weaponId: WeaponId;
    material: ImpactMaterial;
    normal?: THREE.Vector3;
  }) => {
    const id = ++impactCounter;
    const tracerId = ++tracerCounter;
    const casingId = ++casingCounter;
    const now = Date.now();
    const impact: ImpactEvent = {
      id,
      position: event.end.clone(),
      normal: event.normal?.clone(),
      weaponId: event.weaponId,
      material: event.material,
      timestamp: now,
    };
    const tracer: TracerEvent = {
      id: tracerId,
      start: event.start.clone(),
      end: event.end.clone(),
      weaponId: event.weaponId,
      timestamp: now,
    };
    const casing: CasingEvent = {
      id: casingId,
      position: event.casingPosition.clone(),
      velocity: event.casingVelocity.clone(),
      weaponId: event.weaponId,
      timestamp: now,
    };
    setImpacts((prev) => [...prev.slice(-14), impact]);
    setTracers((prev) => [...prev.slice(-18), tracer]);
    if (event.weaponId !== "shell_lobber") setCasings((prev) => [...prev.slice(-18), casing]);
    setTimeout(() => {
      setImpacts((prev) => prev.filter((e) => e.id !== id));
    }, IMPACT_TTL);
    setTimeout(() => {
      setTracers((prev) => prev.filter((e) => e.id !== tracerId));
    }, TRACER_TTL);
    setTimeout(() => {
      setCasings((prev) => prev.filter((e) => e.id !== casingId));
    }, CASING_TTL);
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
      if (e.code === "Escape" && e.shiftKey && e.type === "keydown") {
        recordCurrentRun();
        gameplayStop();
        onExit();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, [onExit, recordCurrentRun]);

  useEffect(() => () => {
    recordCurrentRun();
  }, [recordCurrentRun]);

  useEffect(() => {
    if (!self || matchEnded) return;
    const startedAt = matchStartedAtRef.current;
    const updateTimer = () => {
      const remaining = Math.max(0, MATCH_DURATION_MS - (Date.now() - startedAt));
      setTimeRemaining(remaining);
      if (remaining <= 0) finishMatch();
    };
    updateTimer();
    const timer = window.setInterval(updateTimer, 250);
    return () => window.clearInterval(timer);
  }, [finishMatch, matchEnded, self]);

  const remotePlayers = Array.from(playersRef.current.values()).filter(isLocalMapPlayer);
  const playerCount = remotePlayers.length + (self ? 1 : 0);
  const matchRows = [
    ...(self ? [{
      id: self.id,
      nickname: self.nickname,
      kills,
      deaths: selfDeaths,
      alive,
      color: self.color,
      isSelf: true,
    }] : []),
    ...remotePlayers.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      kills: player.kills,
      deaths: player.deaths,
      alive: player.alive,
      color: player.color,
      isSelf: false,
    })),
  ].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  const finalRank = Math.max(1, matchRows.findIndex((row) => row.isSelf) + 1);
  const formatMatchTime = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (privateLobby && lobbyState && !self) {
    const canStart = lobbyState.isHost && lobbyState.players.filter((p) => p.connected).length >= lobbyState.minPlayersToStart;
    return (
      <div className="private-wait-bg" style={{ background: map.sky }}>
        <div className="private-wait-atmosphere" />
        <div className="private-wait-shell">
          <div className="private-wait-head">
            <div>
              <div className="private-wait-kicker">SECURE PRIVATE LOBBY</div>
              <h1>{lobbyState.name}</h1>
              <p>Squad staging before deployment</p>
            </div>
            <button className="private-wait-exit" onClick={onExit}>EXIT</button>
          </div>

          <div className="private-wait-grid">
            <div className="private-map-preview" style={{ background: map.sky }}>
              <div className="private-map-radar">
                {Array.from({ length: 8 }, (_, i) => <span key={i} />)}
              </div>
              <div className="private-map-copy">
                <span>SELECTED MAP</span>
                <strong>{map.name}</strong>
              </div>
            </div>

            <div className="private-access-panel">
              <div><span>ROOM ID</span><strong>{lobbyState.id}</strong></div>
              <div><span>ACCESS</span><strong>{privateLobby.password ? "PASSWORD" : "OPEN"}</strong></div>
              <div><span>CAPACITY</span><strong>{lobbyState.players.filter((p) => p.connected).length}/{lobbyState.maxPlayers}</strong></div>
            </div>
          </div>

          <div className="private-wait-roster">
            {lobbyState.players.map((player, index) => (
              <div key={player.id} className={`private-wait-player ${player.connected ? "" : "offline"}`}>
                <div className="private-player-avatar">{player.nickname.slice(0, 2).toUpperCase()}</div>
                <div className="private-player-main">
                  <span>{player.nickname}</span>
                  <small>{player.connected ? "Ready in staging" : "Attempting reconnect"}</small>
                </div>
                <div className="private-player-net">
                  <span className="private-ping-dot" />
                  {player.connected ? `${34 + ((index * 17) % 42)} ms` : "OFF"}
                </div>
                {player.isHost && <strong>HOST</strong>}
                {!player.isHost && player.connected && <em>READY</em>}
                {!player.connected && <em>RECONNECTING</em>}
              </div>
            ))}
          </div>

          {lobbyMessage && <div className="private-wait-message">{lobbyMessage}</div>}

          {lobbyState.isHost ? (
            <button className="private-wait-start" disabled={!canStart} onClick={startPrivateLobby}>
              START GAME
            </button>
          ) : (
            <div className="private-wait-hold">Waiting for host to start the match</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`game-shell ${combatPulse ? `combat-${combatPulse}` : ""}`} style={{ width: "100vw", height: "100vh", background: map.sky }}>
      <Canvas
        dpr={[1, 1]}
        camera={{ fov: 80, near: 0.05, far: 600, position: [0, 1.75, 0] }}
        style={{ width: "100%", height: "100%" }}
        gl={{
          antialias: false,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
        }}
        performance={{ min: 0.5 }}
      >
        <color attach="background" args={[map.sky]} />
        <ambientLight intensity={2.2} />
        <directionalLight position={[15, 25, 10]} intensity={1.8} />
        <directionalLight position={[-10, 15, -10]} intensity={1.0} color="#fffbe8" />
        <hemisphereLight args={["#ffffff", "#446644", 0.8]} />
        <fog attach="fog" args={[map.fogColor, map.fogNear, map.fogFar]} />

        <Arena mapId={activeMapId} />

        {remotePlayers.map((p) => (
          <RemotePlayer key={p.id} player={p} />
        ))}

        <BulletEffects impacts={impacts} tracers={tracers} casings={casings} deathBursts={deathBursts} />

        {self && (
          <FPSControls
            self={self}
            players={playersRef.current}
            onMove={handleMove}
            onShoot={sendShoot}
            onAmmoChange={handleAmmoChange}
            onReloadProgress={handleReloadProgress}
            onMuzzleFlash={() => {}}
            onHitConfirmed={handleHitConfirmed}
            onWeaponChange={handleWeaponChange}
            onAimChange={setIsAiming}
            onInspectChange={setIsInspecting}
            onMovementState={setMovementState}
            onProjectileVfx={handleProjectileVfx}
            alive={alive && !matchEnded}
            currentWeapon={currentWeapon}
            isShooting={isShooting}
            setIsShooting={setIsShooting}
            boxes={map.boxes}
            movementPads={map.movementPads}
          />
        )}
      </Canvas>

      {joinError && (
        <div className="join-error-overlay">
          <div className="join-error-panel">
            <div className="join-error-title">LOBBY ACCESS DENIED</div>
            <div className="join-error-message">{joinError}</div>
            <button className="join-error-button" onClick={onExit}>BACK TO MENU</button>
          </div>
        </div>
      )}

      {self && (
        <div className={`match-clock ${timeRemaining <= 30000 ? "danger" : ""}`}>
          <span>MATCH</span>
          {formatMatchTime(timeRemaining)}
        </div>
      )}

      {self && (
        <HUD
          health={health}
          maxHealth={MAX_HEALTH}
          shield={shield}
          maxShield={maxShield}
          showShieldHit={showShieldHit}
          showShieldRecharge={showShieldRecharge}
          kills={kills}
          alive={alive}
          nickname={nickname}
          killFeed={killFeed}
          ammo={ammo}
          reloading={reloading}
          reloadProgress={reloadProgress}
          reloadLabel={reloadLabel}
          showHitIndicator={showHitIndicator}
          showDamage={showDamage}
          currentWeapon={currentWeapon}
          isAiming={isAiming}
          isInspecting={isInspecting}
          movementLabel={movementState.label}
          movementAccuracy={movementState.accuracy}
          mapName={map.name}
          map={map}
          self={self}
          players={remotePlayers}
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
            color: "#42f5ff",
            fontFamily: "'Black Han Sans', sans-serif",
            fontSize: 13,
            letterSpacing: 2,
            padding: "4px 18px",
            borderRadius: 20,
            border: "1px solid rgba(66,245,255,0.3)",
            pointerEvents: "none",
          }}
        >
          SIM SOLO MODE
        </div>
      )}

      {matchEnded && self && (
        <div className="match-results-overlay">
          <div className="match-results-panel">
            <div className="match-results-kicker">MATCH COMPLETE</div>
            <div className="match-results-title">RESULTS</div>

            <div className="match-results-stats">
              <div><span>RANK</span><strong>#{finalRank}</strong></div>
              <div><span>ELIMS</span><strong>{kills}</strong></div>
              <div><span>DEATHS</span><strong>{selfDeaths}</strong></div>
              <div><span>K/D</span><strong>{selfDeaths === 0 ? kills.toFixed(0) : (kills / selfDeaths).toFixed(2)}</strong></div>
            </div>

            <div className="match-results-grid">
              <div className="match-results-card">
                <div className="match-results-card-head">MATCH LEADERBOARD</div>
                {matchRows.slice(0, 8).map((row, index) => (
                  <div key={row.id} className={`match-result-row ${row.isSelf ? "self" : ""}`}>
                    <span>{index + 1}</span>
                    <i style={{ background: row.color }} />
                    <strong>{row.nickname}</strong>
                    <em>{row.kills} / {row.deaths}</em>
                  </div>
                ))}
              </div>

              <div className="match-results-card">
                <div className="match-results-card-head">ALL-TIME TOP RUNS</div>
                {finalLeaderboard.slice(0, 8).map((entry, index) => (
                  <div key={entry.id} className="match-result-row">
                    <span>{index + 1}</span>
                    <i />
                    <strong>{entry.nickname}</strong>
                    <em>{entry.score}</em>
                  </div>
                ))}
                {finalLeaderboard.length === 0 && <div className="match-results-empty">No scored runs yet</div>}
              </div>
            </div>

            <div className="match-results-actions">
              <button className="match-results-replay" onClick={onReplay}>JOIN NEXT BATTLE</button>
              <button className="match-results-exit" onClick={onExit}>BACK TO MENU</button>
            </div>
          </div>
        </div>
      )}

      {!locked && self && alive && !matchEnded && (
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
