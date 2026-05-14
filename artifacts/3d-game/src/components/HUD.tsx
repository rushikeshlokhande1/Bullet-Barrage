import type { KillEvent, WeaponId } from "../types/game";
import { WEAPONS } from "../types/game";

interface Props {
  health: number;
  maxHealth: number;
  kills: number;
  alive: boolean;
  nickname: string;
  killFeed: KillEvent[];
  ammo: number;
  reloading: boolean;
  showMuzzleFlash: boolean;
  showHitIndicator: boolean;
  showDamage: boolean;
  currentWeapon: WeaponId;
  mapName: string;
}

export function HUD({
  health, maxHealth, kills, alive, nickname, killFeed,
  ammo, reloading, showMuzzleFlash, showHitIndicator,
  showDamage, currentWeapon, mapName,
}: Props) {
  const pct = (health / maxHealth) * 100;
  const fillClass = pct > 60 ? "" : pct > 30 ? "medium" : "low";
  const wep = WEAPONS[currentWeapon];

  return (
    <div className="hud">
      <div className="crosshair" />

      {showMuzzleFlash && <div className="muzzle-flash active" />}
      {showHitIndicator && <div className="hit-indicator active" />}
      {showDamage && <div className="damage-overlay active" />}

      {!alive && (
        <div className="respawn-overlay">
          <div className="respawn-text">YOU DIED</div>
          <div className="respawn-hint">Respawning in 3s...</div>
        </div>
      )}

      <div className="player-name-display">
        <span>{nickname}</span>
        <span style={{ color: "#555", marginLeft: 8, fontSize: 11 }}>{mapName}</span>
      </div>

      <div className="kills-display">
        <div className="kills-label">Kills</div>
        <div className="kills-value">{kills}</div>
      </div>

      <div className="health-bar-container">
        <div className="health-label">Health &nbsp;{health}</div>
        <div className="health-bar-bg">
          <div className={`health-bar-fill ${fillClass}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="weapon-hud">
        <div className="weapon-slots">
          {(["rifle", "shotgun", "sniper"] as WeaponId[]).map((id, i) => (
            <div key={id} className={`weapon-slot ${currentWeapon === id ? "active" : ""}`}>
              <span className="slot-key">{i + 1}</span>
              <span className="slot-name">{WEAPONS[id].name}</span>
            </div>
          ))}
        </div>
        <div className="ammo-display">
          <div className="ammo-label">{wep.name}</div>
          {reloading ? (
            <div className="reloading-text">Reloading...</div>
          ) : (
            <div className="ammo-value">{ammo}<span style={{ color: "#666" }}>/{wep.ammo}</span></div>
          )}
        </div>
      </div>

      <div className="killfeed">
        {killFeed.slice(-5).map((k) => (
          <div key={k.id + k.timestamp} className="killfeed-item">
            <span style={{ color: "#e74c3c" }}>{k.killerNickname}</span>
            {" ⚔ "}
            <span style={{ color: "#aaa" }}>a player</span>
          </div>
        ))}
      </div>
    </div>
  );
}
