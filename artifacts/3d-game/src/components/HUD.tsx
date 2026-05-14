import { useEffect, useRef } from "react";
import type { KillEvent } from "../types/game";

interface Props {
  health: number;
  maxHealth: number;
  kills: number;
  alive: boolean;
  nickname: string;
  killFeed: KillEvent[];
  ammo: number;
  maxAmmo: number;
  reloading: boolean;
  showMuzzleFlash: boolean;
  showHitIndicator: boolean;
  showDamage: boolean;
}

export function HUD({
  health,
  maxHealth,
  kills,
  alive,
  nickname,
  killFeed,
  ammo,
  maxAmmo,
  reloading,
  showMuzzleFlash,
  showHitIndicator,
  showDamage,
}: Props) {
  const pct = (health / maxHealth) * 100;
  const fillClass =
    pct > 60 ? "" : pct > 30 ? "medium" : "low";

  return (
    <div className="hud">
      <div className="crosshair" />

      {showMuzzleFlash && <div className="muzzle-flash active" />}
      {showHitIndicator && <div className="hit-indicator active" />}
      {showDamage && <div className="damage-overlay active" />}

      {!alive && (
        <div className="respawn-overlay">
          <div className="respawn-text">YOU DIED</div>
          <div className="respawn-hint">Respawning...</div>
        </div>
      )}

      <div className="player-name-display">
        <span>{nickname}</span>
      </div>

      <div className="kills-display">
        <div className="kills-label">Kills</div>
        <div className="kills-value">{kills}</div>
      </div>

      <div className="health-bar-container">
        <div className="health-label">Health</div>
        <div className="health-bar-bg">
          <div
            className={`health-bar-fill ${fillClass}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="ammo-display">
        <div className="ammo-label">Ammo</div>
        {reloading ? (
          <div className="reloading-text">Reloading</div>
        ) : (
          <div className="ammo-value">
            {ammo}/{maxAmmo}
          </div>
        )}
      </div>

      <div className="killfeed">
        {killFeed.slice(-5).map((k) => (
          <div key={k.id + k.timestamp} className="killfeed-item">
            <span style={{ color: "#e74c3c" }}>{k.killerNickname}</span>
            {" killed "}
            <span style={{ color: "#aaa" }}>a player</span>
          </div>
        ))}
      </div>
    </div>
  );
}
