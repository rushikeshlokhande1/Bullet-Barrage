import type { MapDef } from "../data/maps";
import type { CSSProperties } from "react";
import type { KillEvent, PlayerState, WeaponId } from "../types/game";
import { WEAPON_ORDER, WEAPONS } from "../types/game";

interface Props {
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  kills: number;
  alive: boolean;
  nickname: string;
  killFeed: KillEvent[];
  ammo: number;
  reloading: boolean;
  reloadProgress: number;
  reloadLabel: string;
  showHitIndicator: boolean;
  showDamage: boolean;
  showShieldHit: boolean;
  showShieldRecharge: boolean;
  currentWeapon: WeaponId;
  isAiming: boolean;
  isInspecting: boolean;
  movementLabel: string;
  movementAccuracy: number;
  mapName: string;
  map: MapDef;
  self: PlayerState;
  players: PlayerState[];
  playerCount: number;
}

const MAP_EXTENT = 60;
const MAP_MIN = -30;

function toPct(value: number) {
  return ((value - MAP_MIN) / MAP_EXTENT) * 100;
}

function MiniMap({ map, self, players }: { map: MapDef; self: PlayerState; players: PlayerState[] }) {
  const livePlayers = players.filter((player) => player.alive);
  const yawDeg = self.rotation.y * (180 / Math.PI);

  return (
    <div className="hud-minimap" aria-label={`${map.name} live minimap`}>
      <div className="minimap-grid" />
      <div className="minimap-boundary" />
      {map.boxes.map((box, index) => {
        const [x, y, z] = box.pos;
        const [w, h, d] = box.size;
        const isFloor = box.noCollide && y < 0;
        if (isFloor) return null;
        const isWall = box.noCollide && (w >= 58 || d >= 58);
        return (
          <span
            key={`${box.pos.join(":")}-${index}`}
            className={`minimap-obstacle ${box.noCollide ? "decor" : ""} ${isWall ? "wall" : ""}`}
            style={{
              left: `${toPct(x - w / 2)}%`,
              top: `${toPct(z - d / 2)}%`,
              width: `${(w / MAP_EXTENT) * 100}%`,
              height: `${(d / MAP_EXTENT) * 100}%`,
              backgroundColor: box.color,
              opacity: box.noCollide ? 0.34 : Math.min(0.86, 0.42 + h * 0.07),
            }}
          />
        );
      })}
      {map.movementPads.map((pad) => (
        <span
          key={pad.id}
          className={`minimap-pad ${pad.type}`}
          style={{
            left: `${toPct(pad.pos[0])}%`,
            top: `${toPct(pad.pos[2])}%`,
            width: `${(pad.radius * 2 / MAP_EXTENT) * 100}%`,
            height: `${(pad.radius * 2 / MAP_EXTENT) * 100}%`,
          }}
        />
      ))}
      {livePlayers.map((player) => (
        <span
          key={player.id}
          className={`minimap-contact ${player.id.startsWith("bot_") || player.id.startsWith("local_bot_") ? "bot" : "human"}`}
          style={{
            left: `${toPct(player.position.x)}%`,
            top: `${toPct(player.position.z)}%`,
            "--contact-color": player.color,
            transform: `translate(-50%, -50%) rotate(${player.rotation.y}rad)`,
          } as CSSProperties}
          title={player.nickname}
        />
      ))}
      <span
        className="minimap-self"
        style={{
          left: `${toPct(self.position.x)}%`,
          top: `${toPct(self.position.z)}%`,
          transform: `translate(-50%, -50%) rotate(${yawDeg}deg)`,
        }}
      />
      <span className="minimap-sweep" />
    </div>
  );
}

export function HUD({
  health, maxHealth, shield, maxShield, kills, alive, nickname, killFeed,
  ammo, reloading, reloadProgress, reloadLabel, showHitIndicator, showDamage, showShieldHit, showShieldRecharge,
  currentWeapon, isAiming, isInspecting, movementLabel, movementAccuracy, mapName, playerCount,
  map, self, players,
}: Props) {
  const pct = Math.max(0, (health / maxHealth) * 100);
  const shieldPct = Math.max(0, (shield / maxShield) * 100);
  const wep = WEAPONS[currentWeapon];
  const hpColor = pct > 60 ? "#4caf50" : pct > 30 ? "#ff9800" : "#f44336";
  const scoped = isAiming && currentWeapon === "yolkpiercer";
  const lowHealth = pct <= 30;

  return (
    <div className={`hud ${lowHealth ? "low-health" : ""}`}>
      {/* Crosshair */}
      <div className={`crosshair-wrap ${isAiming ? "ads" : ""} ${scoped ? "scoped" : ""}`}>
        <div className="ch-h" /><div className="ch-v" />
        <div className="ch-dot" />
      </div>
      {isAiming && !scoped && <div className="ads-focus" />}
      {scoped && (
        <div className="sniper-scope-overlay">
          <div className="scope-shadow scope-shadow-left" />
          <div className="scope-shadow scope-shadow-right" />
          <div className="scope-lens">
            <div className="scope-glass" />
            <div className="scope-reflection" />
            <div className="scope-reticle">
              <span className="scope-line scope-line-h" />
              <span className="scope-line scope-line-v" />
              <span className="scope-dot" />
              <span className="scope-tick tick-top" />
              <span className="scope-tick tick-bottom" />
              <span className="scope-tick tick-left" />
              <span className="scope-tick tick-right" />
            </div>
            <div className="scope-ring inner" />
            <div className="scope-ring outer" />
          </div>
          <div className="scope-readout scope-readout-left">OBELISK LXR</div>
          <div className="scope-readout scope-readout-right">CRYSTAL OPTIC</div>
        </div>
      )}
      {isInspecting && <div className="inspect-label">INSPECTING</div>}
      <div className={`movement-readout ${movementAccuracy < 0.65 ? "unstable" : ""}`}>
        <span>{movementLabel}</span>
        <span>{Math.round(movementAccuracy * 100)}% ACC</span>
      </div>

      {/* Hit flash */}
      {showHitIndicator && <div className="hit-ring" />}
      {showDamage && <div className="damage-vignette" />}
      {showShieldHit && <div className="shield-vignette" />}
      {showShieldRecharge && <div className="shield-recharge-pulse" />}
      {lowHealth && alive && <div className="low-health-vignette" />}

      {/* Top-left: map + player count */}
      <div className="hud-topleft">
        <div className="map-badge">
          <span>AO</span>
          {mapName}
        </div>
        <div className="player-count">ONLINE {playerCount}</div>
        <MiniMap map={map} self={self} players={players} />
      </div>

      {/* Top-right: kills */}
      <div className="hud-topright">
        <div className="kills-box">
          <div className="kills-lbl">ELIMS</div>
          <div className="kills-num">{kills}</div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="hud-bottom">
        {/* Health */}
        <div className="hp-block">
          <div className="hp-icon">HP</div>
          <div className="hp-info">
            <div className="shield-track">
              <div className="shield-fill" style={{ width: `${shieldPct}%` }} />
            </div>
            <div className="hp-track">
              <div className="hp-fill" style={{ width: `${pct}%`, background: hpColor }} />
            </div>
            <div className="vitals-row">
              <div className="hp-num">{Math.ceil(health)}<span className="hp-max">/{maxHealth}</span></div>
              <div className="shield-num">SH {Math.ceil(shield)}<span>/{maxShield}</span></div>
            </div>
          </div>
        </div>

        {/* Center: weapon slots */}
        <div className="weapon-bar">
          {WEAPON_ORDER.map((id, i) => (
            <div key={id} className={`wslot ${currentWeapon === id ? "active" : ""}`}>
              <span className="wslot-key">{i + 1}</span>
              <span className="wslot-name">{WEAPONS[id].name}</span>
            </div>
          ))}
        </div>

        {/* Ammo */}
        <div className="ammo-block">
          {reloading ? (
            <div className="reload-stack">
              <div className="reload-text">{reloadLabel || "RELOADING"}</div>
              <div className="reload-track"><div className="reload-fill" style={{ width: `${Math.round(reloadProgress * 100)}%` }} /></div>
              <div className="reload-percent">{Math.round(reloadProgress * 100)}%</div>
            </div>
          ) : (
            <div className="ammo-row">
              <div className="ammo-cur">{ammo}</div>
              <div className="ammo-sep"> / </div>
              <div className="ammo-max">{wep.ammo}</div>
            </div>
          )}
          <div className="wep-name">{wep.name}</div>
        </div>
      </div>

      {/* Kill feed */}
      <div className="killfeed">
        {killFeed.slice(-6).map((k) => (
          <div key={k.id + k.timestamp} className="kf-item">
            <span className="kf-killer">{k.killerNickname}</span>
            <span className="kf-icon"> KINETIC </span>
            <span className="kf-victim">{k.victimNickname}</span>
          </div>
        ))}
      </div>

      {/* Death overlay */}
      {!alive && (
        <div className="death-overlay">
          <div className="death-icon">CORE BREACH</div>
          <div className="death-title">YOU WERE SHATTERED</div>
          <div className="death-sub">Respawning in 3s...</div>
        </div>
      )}
    </div>
  );
}
