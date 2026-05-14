import { useState } from "react";
import type { MapId, GameMode, Difficulty } from "../types/game";
import { ALL_MAP_IDS, getMap } from "../data/maps";

const MAP_PREVIEW: Record<MapId, string> = {
  cracked: "🌿",
  sandstone: "🏜️",
  cyber: "🌌",
};

const DIFFICULTIES = [
  { label: "Easy",   emoji: "😊", bots: 3, diff: 0 as Difficulty },
  { label: "Normal", emoji: "😤", bots: 5, diff: 1 as Difficulty },
  { label: "Hard",   emoji: "💀", bots: 7, diff: 2 as Difficulty },
];

interface StartPayload {
  nickname: string;
  mapId: MapId;
  mode: GameMode;
  botCount: number;
  difficulty: Difficulty;
}

interface Props {
  onStart: (payload: StartPayload) => void;
}

export function StartMenu({ onStart }: Props) {
  const [nick, setNick] = useState("");
  const [mapId, setMapId] = useState<MapId>("cracked");
  const [mode, setMode] = useState<GameMode>("multiplayer");
  const [diffIdx, setDiffIdx] = useState(1);

  const diff = DIFFICULTIES[diffIdx];

  const handlePlay = () => {
    if (!nick.trim()) return;
    onStart({
      nickname: nick.trim(),
      mapId,
      mode,
      botCount: mode === "solo" ? diff.bots : 0,
      difficulty: mode === "solo" ? diff.diff : 1,
    });
  };

  return (
    <div className="menu-bg">
      <div className="egg-deco egg-tl">🥚</div>
      <div className="egg-deco egg-tr">🥚</div>
      <div className="egg-deco egg-bl">🥚</div>
      <div className="egg-deco egg-br">🥚</div>

      <div className="menu-card">
        <div className="menu-logo">
          <span className="logo-egg">🥚</span>
          <span className="logo-text">FRAG<span className="logo-dot">.</span>IO</span>
          <span className="logo-egg">🥚</span>
        </div>
        <div className="menu-tagline">Multiplayer Browser FPS</div>

        <div className="menu-form">
          <label className="form-label">NICKNAME</label>
          <input
            className="menu-input"
            type="text"
            placeholder="Enter your name..."
            maxLength={20}
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePlay()}
            autoFocus
          />

          {/* Mode toggle */}
          <div className="mode-toggle">
            <button
              className={`mode-btn ${mode === "multiplayer" ? "active" : ""}`}
              onClick={() => setMode("multiplayer")}
            >
              🌐 Multiplayer
            </button>
            <button
              className={`mode-btn ${mode === "solo" ? "active" : ""}`}
              onClick={() => setMode("solo")}
            >
              🤖 Solo vs Bots
            </button>
          </div>

          {/* Difficulty selector (solo only) */}
          {mode === "solo" && (
            <div className="diff-select">
              {DIFFICULTIES.map((d, i) => (
                <button
                  key={d.label}
                  className={`diff-btn ${diffIdx === i ? "active" : ""}`}
                  onClick={() => setDiffIdx(i)}
                >
                  <span className="diff-emoji">{d.emoji}</span>
                  <span className="diff-label">{d.label}</span>
                  <span className="diff-bots">{d.bots} bots</span>
                </button>
              ))}
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
                  onClick={() => setMapId(id)}
                >
                  <div className="map-preview" style={{ background: m.sky }}>
                    <span style={{ fontSize: 28 }}>{MAP_PREVIEW[id]}</span>
                  </div>
                  <div className="map-card-name">{m.name}</div>
                </button>
              );
            })}
          </div>

          <button className="menu-play-btn" onClick={handlePlay}>
            {mode === "solo" ? `PLAY SOLO  ${diff.emoji}` : "PLAY NOW"}
          </button>
        </div>

        <div className="menu-controls">
          <div className="ctrl-row"><kbd>WASD</kbd> Move &nbsp;&nbsp; <kbd>SPACE</kbd> Jump &nbsp;&nbsp; <kbd>R</kbd> Reload</div>
          <div className="ctrl-row"><kbd>CLICK</kbd> Shoot &nbsp;&nbsp; <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> Weapons &nbsp;&nbsp; <kbd>ESC</kbd> Unlock</div>
        </div>
      </div>
    </div>
  );
}
