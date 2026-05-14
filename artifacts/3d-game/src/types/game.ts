export type MapId = "cracked" | "sandstone" | "cyber";
export type GameMode = "multiplayer" | "solo";
export type Difficulty = 0 | 1 | 2;

export interface PlayerState {
  id: string;
  nickname: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number };
  health: number;
  kills: number;
  deaths: number;
  alive: boolean;
  color: string;
  weapon: WeaponId;
}

export interface KillEvent {
  id: string;
  killerId: string;
  killerNickname: string;
  kills: number;
  timestamp: number;
}

export type WeaponId = "rifle" | "shotgun" | "sniper";

export interface WeaponDef {
  id: WeaponId;
  name: string;
  damage: number;
  pellets: number;
  ammo: number;
  reloadTime: number;
  fireRate: number;
  spread: number;
  color: string;
  modelScale: [number, number, number];
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  rifle: {
    id: "rifle",
    name: "EggK-47",
    damage: 22,
    pellets: 1,
    ammo: 30,
    reloadTime: 1800,
    fireRate: 120,
    spread: 0.015,
    color: "#888",
    modelScale: [0.12, 0.12, 0.7],
  },
  shotgun: {
    id: "shotgun",
    name: "Scrambler",
    damage: 14,
    pellets: 7,
    ammo: 6,
    reloadTime: 2200,
    fireRate: 700,
    spread: 0.12,
    color: "#a06030",
    modelScale: [0.14, 0.14, 0.55],
  },
  sniper: {
    id: "sniper",
    name: "Free Ranger",
    damage: 90,
    pellets: 1,
    ammo: 6,
    reloadTime: 2500,
    fireRate: 1400,
    spread: 0.001,
    color: "#336699",
    modelScale: [0.1, 0.1, 1.0],
  },
};

export interface JoinPayload {
  nickname: string;
  solo: boolean;
  botCount: number;
  difficulty: Difficulty;
}
