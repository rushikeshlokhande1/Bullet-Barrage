import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { MapId, GameMode, Difficulty } from "../types/game";
import { ALL_MAP_IDS, getMap } from "../data/maps";
import { playUiClick, startMenuAmbient, stopMenuAmbient } from "../lib/weaponAudio";
import { getLeaderboard } from "../lib/leaderboard";

const MAP_PREVIEW: Partial<Record<MapId, string>> = {
  cracked: "RU",
  sandstone: "DS",
  cyber: "CX",
  overpass: "OP",
  foundry: "FD",
};

const DIFFICULTIES = [
  { label: "Easy", code: "I", bots: 3, diff: 0 as Difficulty },
  { label: "Normal", code: "II", bots: 5, diff: 1 as Difficulty },
  { label: "Hard", code: "III", bots: 7, diff: 2 as Difficulty },
];

const SHOWCASE_OPERATORS = [
  { name: "Vanta", role: "Assault", tone: "#42f5ff", accent: "#ff4f5f", delay: "0s" },
  { name: "Quartz", role: "Recon", tone: "#ffb84d", accent: "#42f5ff", delay: "-1.2s" },
  { name: "Cinder", role: "Heavy", tone: "#ff5f3d", accent: "#ffe27a", delay: "-2.1s" },
  { name: "Prism", role: "Medic", tone: "#87ff9b", accent: "#c78cff", delay: "-3s" },
];

const HAS_REMOTE_MULTIPLAYER = Boolean((import.meta.env.VITE_API_ORIGIN as string | undefined)?.trim());

function getPrivateLobbyClientToken() {
  const key = "bullet-barrage-private-lobby-tab-token";
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const token = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(key, token);
    return token;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

interface StartPayload {
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
}

interface Props {
  onStart: (payload: StartPayload) => void;
  initialMapId?: MapId;
}

export function StartMenu({ onStart, initialMapId }: Props) {
  const [nick, setNick] = useState("");
  const [mapId, setMapId] = useState<MapId>(initialMapId ?? "cracked");
  const [mode, setMode] = useState<GameMode>("solo");
  const [diffIdx, setDiffIdx] = useState(1);
  const [privateLobbyEnabled, setPrivateLobbyEnabled] = useState(false);
  const [privateLobbyAction, setPrivateLobbyAction] = useState<"create" | "join">("create");
  const [privateLobbyName, setPrivateLobbyName] = useState("");
  const [privateLobbyPassword, setPrivateLobbyPassword] = useState("");
  const [privateLobbyMaxPlayers, setPrivateLobbyMaxPlayers] = useState(4);
  const [leaders, setLeaders] = useState(() => getLeaderboard().slice(0, 5));

  const diff = DIFFICULTIES[diffIdx];
  const selectedMap = getMap(mapId);

  useEffect(() => {
    const update = () => setLeaders(getLeaderboard().slice(0, 5));
    update();
    window.addEventListener("bullet-barrage-leaderboard-updated", update);
    return () => window.removeEventListener("bullet-barrage-leaderboard-updated", update);
  }, []);

  const interact = (kind: "hover" | "confirm" | "deny" = "confirm") => {
    startMenuAmbient();
    playUiClick(kind);
  };

  const handlePlay = () => {
    if (!nick.trim()) {
      interact("deny");
      return;
    }
    const lobbyName = privateLobbyName.trim();
    const lobbyPassword = privateLobbyPassword.trim();
    if (mode === "multiplayer" && privateLobbyEnabled && (!lobbyName || !lobbyPassword)) {
      interact("deny");
      return;
    }
    interact("confirm");
    stopMenuAmbient();
    onStart({
      nickname: nick.trim(),
      mapId,
      mode,
      botCount: mode === "solo" ? diff.bots : 0,
      difficulty: mode === "solo" ? diff.diff : 1,
      privateLobby: mode === "multiplayer" && privateLobbyEnabled
        ? {
          action: privateLobbyAction,
          name: lobbyName,
          password: lobbyPassword,
          maxPlayers: privateLobbyAction === "create" ? privateLobbyMaxPlayers : undefined,
          clientToken: getPrivateLobbyClientToken(),
        }
        : undefined,
    });
  };

  return (
    <div className="menu-bg">
      <div className="menu-cinematic" />
      <div className="menu-gridlines" />
      <div className="menu-scanline" />
      <div className="menu-particles" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <span
            key={i}
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              animationDelay: `${i * -0.23}s`,
            } as CSSProperties}
          />
        ))}
      </div>
      <div className="egg-deco egg-tl">CORE</div>
      <div className="egg-deco egg-tr">CORE</div>
      <div className="egg-deco egg-bl">CORE</div>
      <div className="egg-deco egg-br">CORE</div>

      <div className="operator-showcase" aria-hidden="true">
        <div className="operator-showcase-title">
          <span>ACTIVE SQUAD</span>
          <strong>Crystal Unit</strong>
        </div>
        <div className="operator-stage">
          {SHOWCASE_OPERATORS.map((operator, index) => (
            <div
              key={operator.name}
              className={`operator-card operator-${index + 1}`}
              style={{
                "--skin": operator.tone,
                "--accent": operator.accent,
                "--delay": operator.delay,
              } as CSSProperties}
            >
              <div className="operator-render">
                <span className="operator-glow" />
                <span className="operator-head">
                  <i />
                </span>
                <span className="operator-neck" />
                <span className="operator-torso">
                  <i className="operator-core" />
                  <i className="operator-strap strap-left" />
                  <i className="operator-strap strap-right" />
                </span>
                <span className="operator-arm arm-left" />
                <span className="operator-arm arm-right" />
                <span className="operator-weapon" />
                <span className="operator-leg leg-left" />
                <span className="operator-leg leg-right" />
              </div>
              <div className="operator-caption">
                <strong>{operator.name}</strong>
                <span>{operator.role}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="menu-card">
        <div className="menu-status-strip">
          <span>LIVE OPS</span>
          <span>REGION AUTO</span>
          <span>WEBGL READY</span>
        </div>
        <div className="menu-logo">
          <span className="logo-egg">BB</span>
          <span className="logo-text">BULLET<span className="logo-dot">.</span>BARRAGE</span>
          <span className="logo-egg">FPS</span>
        </div>
        <div className="menu-tagline">Tactical crystal arena combat</div>

        <div className="menu-form">
          <label className="form-label">CALLSIGN</label>
          <input
            className="menu-input"
            type="text"
            placeholder="Enter your name..."
            maxLength={20}
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePlay()}
            onFocus={() => interact("hover")}
            autoFocus
          />

          <div className="mode-toggle">
            <button
              className={`mode-btn ${mode === "multiplayer" ? "active" : ""}`}
              disabled={!HAS_REMOTE_MULTIPLAYER}
              title={HAS_REMOTE_MULTIPLAYER ? "Play online" : "Online rooms require a deployed multiplayer server"}
              onClick={() => {
                interact(HAS_REMOTE_MULTIPLAYER ? "confirm" : "deny");
                if (HAS_REMOTE_MULTIPLAYER) setMode("multiplayer");
              }}
            >
              <span>NET</span> Multiplayer
            </button>
            <button
              className={`mode-btn ${mode === "solo" ? "active" : ""}`}
              onClick={() => { interact("confirm"); setMode("solo"); }}
            >
              <span>SIM</span> Solo vs Bots
            </button>
          </div>

          {mode === "solo" && (
            <div className="diff-select">
              {DIFFICULTIES.map((d, i) => (
                <button
                  key={d.label}
                  className={`diff-btn ${diffIdx === i ? "active" : ""}`}
                  onClick={() => { interact("confirm"); setDiffIdx(i); }}
                >
                  <span className="diff-emoji">{d.code}</span>
                  <span className="diff-label">{d.label}</span>
                  <span className="diff-bots">{d.bots} bots</span>
                </button>
              ))}
            </div>
          )}

          {mode === "multiplayer" && (
            <div className="private-lobby-panel">
              <button
                type="button"
                className={`private-lobby-toggle ${privateLobbyEnabled ? "active" : ""}`}
                onClick={() => { interact("confirm"); setPrivateLobbyEnabled((enabled) => !enabled); }}
              >
                {privateLobbyEnabled ? "PRIVATE LOBBY ENABLED" : "PRIVATE PASSWORD LOBBY"}
              </button>
              {privateLobbyEnabled && (
                <div className="private-lobby-fields">
                  <div className="private-lobby-actions">
                    <button
                      type="button"
                      className={`private-lobby-action ${privateLobbyAction === "create" ? "active" : ""}`}
                      onClick={() => { interact("confirm"); setPrivateLobbyAction("create"); }}
                    >
                      Create Private Lobby
                    </button>
                    <button
                      type="button"
                      className={`private-lobby-action ${privateLobbyAction === "join" ? "active" : ""}`}
                      onClick={() => { interact("confirm"); setPrivateLobbyAction("join"); }}
                    >
                      Join Private Lobby
                    </button>
                  </div>
                  <input
                    className="menu-input private-lobby-input"
                    type="text"
                    placeholder={privateLobbyAction === "create" ? "Custom room name" : "Room ID or room name"}
                    maxLength={24}
                    value={privateLobbyName}
                    onChange={(e) => setPrivateLobbyName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handlePlay()}
                  />
                  <input
                    className="menu-input private-lobby-input"
                    type="password"
                    placeholder="Password"
                    maxLength={32}
                    value={privateLobbyPassword}
                    onChange={(e) => setPrivateLobbyPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handlePlay()}
                  />
                  {privateLobbyAction === "create" && (
                    <div className="private-lobby-max">
                      <span>MAX PLAYERS</span>
                      <div className="private-lobby-stepper">
                        {[2, 4, 6, 8].map((count) => (
                          <button
                            key={count}
                            type="button"
                            className={`private-lobby-count ${privateLobbyMaxPlayers === count ? "active" : ""}`}
                            onClick={() => { interact("confirm"); setPrivateLobbyMaxPlayers(count); }}
                          >
                            {count}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <label className="form-label" style={{ marginTop: 14 }}>SELECT MAP</label>
          <div className="map-grid">
            {ALL_MAP_IDS.map((id) => {
              const m = getMap(id);
              return (
                <button
                  key={id}
                  className={`map-card ${mapId === id ? "selected" : ""}`}
                  onClick={() => { interact("confirm"); setMapId(id); }}
                >
                  <div className="map-preview" style={{ background: m.sky }}>
                    <span style={{ fontSize: 20 }}>{MAP_PREVIEW[id] ?? id.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div className="map-card-name">{m.name}</div>
                </button>
              );
            })}
          </div>

          <button className="menu-play-btn" onClick={handlePlay}>
            {mode === "solo"
              ? `PLAY SOLO ${diff.code}`
              : privateLobbyEnabled
                ? privateLobbyAction === "create" ? "CREATE PRIVATE LOBBY" : "JOIN PRIVATE LOBBY"
                : "PLAY NOW"}
          </button>
        </div>

        <div className="menu-controls">
          <div className="ctrl-row"><kbd>WASD</kbd> Move <kbd>SPACE</kbd> Jump <kbd>R</kbd> Reload</div>
          <div className="ctrl-row"><kbd>CLICK</kbd> Shoot <kbd>1-7</kbd> Weapons <kbd>F</kbd> Inspect</div>
        </div>
      </div>

      <div className="menu-intel">
        <div className="menu-intel-map" style={{ background: selectedMap.sky }}>
          <span>{MAP_PREVIEW[mapId] ?? mapId.slice(0, 2).toUpperCase()}</span>
          <div className="menu-intel-map-grid" />
        </div>
        <div className="menu-intel-copy">
          <span>SELECTED ARENA</span>
          <strong>{selectedMap.name}</strong>
          <em>{mode === "multiplayer" ? "Low-latency live room" : `${diff.bots} combat simulations`}</em>
        </div>
        <div className="menu-leaderboard">
          <div className="menu-leaderboard-head">
            <span>LOCAL LEADERBOARD</span>
            <strong>TOP RUNS</strong>
          </div>
          {leaders.length > 0 ? leaders.map((entry, index) => (
            <div key={entry.id} className="menu-leader-row">
              <span className="menu-leader-rank">{index + 1}</span>
              <span className="menu-leader-name">{entry.nickname}</span>
              <span className="menu-leader-score">{entry.score}</span>
              <span className="menu-leader-kills">{entry.kills} ELIMS</span>
            </div>
          )) : (
            <div className="menu-leader-empty">No scored runs yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
