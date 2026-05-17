import type { PlayerState } from "../types/game";
import { WEAPONS } from "../types/game";

interface Props {
  self: PlayerState;
  players: PlayerState[];
  selfKills: number;
  selfDeaths: number;
}

const WEAPON_ICONS: Record<string, string> = {
  cluckfire: "AR",
  ovomatic: "SG",
  yolkpiercer: "SR",
  shell_lobber: "EX",
  rapid_yolker: "MG",
  crackling_burst: "BR",
  runny_marksman: "DMR",
};

export function Scoreboard({ self, players, selfKills, selfDeaths }: Props) {
  const selfRow = {
    id: self.id,
    nickname: self.nickname,
    kills: selfKills,
    deaths: selfDeaths,
    alive: self.alive,
    color: self.color,
    weapon: self.weapon,
    isSelf: true,
    isBot: false,
  };

  const otherRows = players.map((p) => ({
    id: p.id,
    nickname: p.nickname,
    kills: p.kills,
    deaths: p.deaths,
    alive: p.alive,
    color: p.color,
    weapon: p.weapon,
    isSelf: false,
    isBot: p.id.startsWith("bot_"),
  }));

  const rows = [selfRow, ...otherRows].sort(
    (a, b) => b.kills - a.kills || a.deaths - b.deaths,
  );

  return (
    <div className="scoreboard-overlay">
      <div className="scoreboard-panel">
        <div className="sb-title">
          <span className="sb-title-egg">CORE</span>
          SCOREBOARD
          <span className="sb-title-egg">CORE</span>
        </div>

        <table className="sb-table">
          <thead>
            <tr className="sb-head">
              <th className="sb-col-rank">#</th>
              <th className="sb-col-name">PLAYER</th>
              <th className="sb-col-wep">WEAPON</th>
              <th className="sb-col-stat">KILLS</th>
              <th className="sb-col-stat">DEATHS</th>
              <th className="sb-col-stat">K/D</th>
              <th className="sb-col-status">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const kd = row.deaths === 0
                ? row.kills.toFixed(0)
                : (row.kills / row.deaths).toFixed(2);

              return (
                <tr
                  key={row.id}
                  className={`sb-row ${row.isSelf ? "sb-self" : ""} ${!row.alive ? "sb-dead" : ""}`}
                >
                  <td className="sb-col-rank">
                    {i === 0 ? "MVP" : i + 1}
                  </td>
                  <td className="sb-col-name">
                    <span className="sb-dot" style={{ background: row.color }} />
                    <span className="sb-nick">{row.nickname}</span>
                    {row.isBot && <span className="sb-bot-badge">BOT</span>}
                    {row.isSelf && <span className="sb-you-badge">YOU</span>}
                  </td>
                  <td className="sb-col-wep">
                    <span className="sb-wep-icon">{WEAPON_ICONS[row.weapon] ?? "CW"}</span>
                    <span className="sb-wep-name">{WEAPONS[row.weapon as keyof typeof WEAPONS]?.name ?? row.weapon}</span>
                  </td>
                  <td className={`sb-col-stat sb-kills ${row.kills > 0 ? "sb-nonzero" : ""}`}>
                    {row.kills}
                  </td>
                  <td className="sb-col-stat sb-deaths">{row.deaths}</td>
                  <td className={`sb-col-stat sb-kd ${Number(kd) >= 1 ? "sb-kd-pos" : "sb-kd-neg"}`}>
                    {kd}
                  </td>
                  <td className="sb-col-status">
                    <span className={`sb-status-dot ${row.alive ? "sb-alive" : "sb-respawn"}`} />
                    {row.alive ? "ALIVE" : "DOWN"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="sb-hint">Hold TAB to view - release to close</div>
      </div>
    </div>
  );
}
