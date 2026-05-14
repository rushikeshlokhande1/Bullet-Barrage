import { useState } from "react";
import type { MapId } from "../types/game";
import { ALL_MAP_IDS, getMap } from "../data/maps";

const MAP_PREVIEW: Record<MapId, string> = {
  cracked: "🌿",
  sandstone: "🏜️",
  cyber: "🌌",
};

interface Props {
  onStart: (nickname: string, mapId: MapId) => void;
}

export function StartMenu({ onStart }: Props) {
  const [nick, setNick] = useState("");
  const [mapId, setMapId] = useState<MapId>("cracked");

  return (
    <div className="menu-bg">
      {/* Egg decorations */}
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
            onKeyDown={(e) => e.key === "Enter" && nick.trim() && onStart(nick.trim(), mapId)}
            autoFocus
          />

          <label className="form-label" style={{ marginTop: 16 }}>SELECT MAP</label>
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

          <button
            className="menu-play-btn"
            onClick={() => nick.trim() && onStart(nick.trim(), mapId)}
          >
            PLAY NOW
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
