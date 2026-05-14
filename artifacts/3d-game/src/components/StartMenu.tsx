import { useState } from "react";
import type { MapId } from "../types/game";
import { ALL_MAP_IDS, getMap } from "../data/maps";

interface Props {
  onStart: (nickname: string, mapId: MapId) => void;
}

export function StartMenu({ onStart }: Props) {
  const [nick, setNick] = useState("");
  const [mapId, setMapId] = useState<MapId>("cracked");

  return (
    <div className="start-menu">
      <div className="game-title">FRAG.IO</div>
      <div className="game-subtitle">Multiplayer FPS</div>

      <div className="start-form">
        <input
          className="nickname-input"
          type="text"
          placeholder="Enter nickname..."
          maxLength={20}
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && nick.trim()) onStart(nick.trim(), mapId);
          }}
          autoFocus
        />

        <div className="map-select-label">Select Map</div>
        <div className="map-select">
          {ALL_MAP_IDS.map((id) => {
            const m = getMap(id);
            return (
              <button
                key={id}
                className={`map-btn ${mapId === id ? "selected" : ""}`}
                onClick={() => setMapId(id)}
              >
                <span className="map-dot" style={{ background: m.sky }} />
                {m.name}
              </button>
            );
          })}
        </div>

        <button
          className="play-button"
          onClick={() => nick.trim() && onStart(nick.trim(), mapId)}
        >
          Play
        </button>
      </div>

      <div className="controls-hint">
        <span>WASD</span> — Move &nbsp;|&nbsp; <span>MOUSE</span> — Aim<br />
        <span>CLICK</span> — Shoot &nbsp;|&nbsp; <span>SPACE</span> — Jump &nbsp;|&nbsp; <span>R</span> — Reload<br />
        <span>1/2/3</span> — Switch Weapon
      </div>
    </div>
  );
}
