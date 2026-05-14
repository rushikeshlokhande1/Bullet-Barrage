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
  showHitIndicator: boolean;
  showDamage: boolean;
  currentWeapon: WeaponId;
  mapName: string;
  playerCount: number;
}

export function HUD({
  health, maxHealth, kills, alive, nickname, killFeed,
  ammo, reloading, showHitIndicator, showDamage,
  currentWeapon, mapName, playerCount,
}: Props) {
  const pct = Math.max(0, (health / maxHealth) * 100);
  const wep = WEAPONS[currentWeapon];
  const hpColor = pct > 60 ? "#4caf50" : pct > 30 ? "#ff9800" : "#f44336";

  return (
    <div className="hud">
      {/* Crosshair */}
      <div className="crosshair-wrap">
        <div className="ch-h" /><div className="ch-v" />
        <div className="ch-dot" />
      </div>

      {/* Hit flash */}
      {showHitIndicator && <div className="hit-ring" />}
      {showDamage && <div className="damage-vignette" />}

      {/* Top-left: map + player count */}
      <div className="hud-topleft">
        <div className="map-badge">{mapName}</div>
        <div className="player-count">🥚 {playerCount} online</div>
      </div>

      {/* Top-right: kills */}
      <div className="hud-topright">
        <div className="kills-box">
          <div className="kills-num">{kills}</div>
          <div className="kills-lbl">KILLS</div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="hud-bottom">
        {/* Health */}
        <div className="hp-block">
          <div className="hp-icon">🥚</div>
          <div className="hp-info">
            <div className="hp-track">
              <div className="hp-fill" style={{ width: `${pct}%`, background: hpColor }} />
            </div>
            <div className="hp-num">{health}<span className="hp-max">/{maxHealth}</span></div>
          </div>
        </div>

        {/* Center: weapon slots */}
        <div className="weapon-bar">
          {(["rifle", "shotgun", "sniper"] as WeaponId[]).map((id, i) => (
            <div key={id} className={`wslot ${currentWeapon === id ? "active" : ""}`}>
              <span className="wslot-key">{i + 1}</span>
              <span className="wslot-name">{WEAPONS[id].name}</span>
            </div>
          ))}
        </div>

        {/* Ammo */}
        <div className="ammo-block">
          {reloading ? (
            <div className="reload-text">RELOADING...</div>
          ) : (
            <>
              <div className="ammo-cur">{ammo}</div>
              <div className="ammo-sep"> / </div>
              <div className="ammo-max">{wep.ammo}</div>
            </>
          )}
          <div className="wep-name">{wep.name}</div>
        </div>
      </div>

      {/* Kill feed */}
      <div className="killfeed">
        {killFeed.slice(-6).map((k) => (
          <div key={k.id + k.timestamp} className="kf-item">
            <span className="kf-killer">{k.killerNickname}</span>
            <span className="kf-icon"> 🍳 </span>
            <span className="kf-victim">{k.victimNickname}</span>
          </div>
        ))}
      </div>

      {/* Death overlay */}
      {!alive && (
        <div className="death-overlay">
          <div className="death-icon">🥚</div>
          <div className="death-title">YOU GOT CRACKED!</div>
          <div className="death-sub">Respawning in 3s...</div>
        </div>
      )}
    </div>
  );
}
