export type MapId = "cracked" | "sandstone" | "cyber" | "overpass" | "foundry";
export type GameMode = "multiplayer" | "solo";
export type Difficulty = 0 | 1 | 2;

export interface PlayerState {
  id: string;
  nickname: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number };
  health: number;
  shield: number;
  maxShield: number;
  kills: number;
  deaths: number;
  alive: boolean;
  color: string;
  weapon: WeaponId;
  mapId?: MapId;
  lobbyId?: string;
}

export interface PrivateLobbyPlayer {
  id: string;
  nickname: string;
  connected: boolean;
  isHost: boolean;
}

export interface PrivateLobbyState {
  id: string;
  name: string;
  mapId: MapId;
  maxPlayers: number;
  status: "waiting" | "playing";
  minPlayersToStart: number;
  isHost: boolean;
  players: PrivateLobbyPlayer[];
}

export interface KillEvent {
  id: string;
  killerId: string;
  killerNickname: string;
  victimNickname: string;
  kills: number;
  timestamp: number;
  mapId?: MapId;
}

export type WeaponId =
  | "cluckfire"
  | "ovomatic"
  | "yolkpiercer"
  | "shell_lobber"
  | "rapid_yolker"
  | "crackling_burst"
  | "runny_marksman";

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
  personality: string;
  accent: string;
  fireMode: "auto" | "semi" | "burst";
  adsFov: number;
  adsSpreadMultiplier: number;
  adsSpeedMultiplier: number;
  recoilKick: number;
  recoilRecovery: number;
  sway: number;
  inspectTime: number;
  reloadStages: Array<{ label: string; at: number }>;
  recoilPattern: Array<[number, number]>;
  audio: {
    fire: "rifle" | "shotgun" | "sniper" | "launcher" | "minigun" | "burst" | "marksman";
    pitch: number;
    thump: number;
  };
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  cluckfire: {
    id: "cluckfire",
    name: "Aegis CR-7",
    damage: 22,
    pellets: 1,
    ammo: 30,
    reloadTime: 1800,
    fireRate: 120,
    spread: 0.015,
    color: "#24272c",
    modelScale: [0.12, 0.12, 0.7],
    personality: "Crystal energy assault rifle",
    accent: "#42f5ff",
    fireMode: "auto",
    adsFov: 58,
    adsSpreadMultiplier: 0.45,
    adsSpeedMultiplier: 0.72,
    recoilKick: 0.016,
    recoilRecovery: 10,
    sway: 0.85,
    inspectTime: 1250,
    reloadStages: [{ label: "CELL OUT", at: 0.22 }, { label: "CELL LOCK", at: 0.62 }, { label: "CORE PRIME", at: 0.86 }],
    recoilPattern: [[0.00, 1.00], [0.18, 1.05], [-0.12, 1.10], [0.26, 1.18], [-0.20, 1.16], [0.08, 1.24]],
    audio: { fire: "rifle", pitch: 1.0, thump: 0.34 },
  },
  ovomatic: {
    id: "ovomatic",
    name: "Breach Quartz",
    damage: 14,
    pellets: 7,
    ammo: 6,
    reloadTime: 2200,
    fireRate: 700,
    spread: 0.12,
    color: "#6b1b18",
    modelScale: [0.14, 0.14, 0.55],
    personality: "Devastating close-range shotgun",
    accent: "#ff5a3d",
    fireMode: "semi",
    adsFov: 62,
    adsSpreadMultiplier: 0.72,
    adsSpeedMultiplier: 0.68,
    recoilKick: 0.052,
    recoilRecovery: 7,
    sway: 1.05,
    inspectTime: 1450,
    reloadStages: [{ label: "HINGE OPEN", at: 0.18 }, { label: "SHARD SHELLS", at: 0.55 }, { label: "BREECH LOCK", at: 0.9 }],
    recoilPattern: [[0.00, 1.00], [0.35, 1.10], [-0.32, 1.05], [0.18, 1.16]],
    audio: { fire: "shotgun", pitch: 0.82, thump: 0.7 },
  },
  yolkpiercer: {
    id: "yolkpiercer",
    name: "Obelisk LXR",
    damage: 90,
    pellets: 1,
    ammo: 6,
    reloadTime: 2500,
    fireRate: 1400,
    spread: 0.001,
    color: "#173456",
    modelScale: [0.1, 0.1, 1.0],
    personality: "Elite long-range sniper",
    accent: "#7fb7ff",
    fireMode: "semi",
    adsFov: 34,
    adsSpreadMultiplier: 0.08,
    adsSpeedMultiplier: 0.52,
    recoilKick: 0.07,
    recoilRecovery: 5.5,
    sway: 0.45,
    inspectTime: 1700,
    reloadStages: [{ label: "BOLT DRAW", at: 0.2 }, { label: "LENS CELL", at: 0.64 }, { label: "RAIL ALIGN", at: 0.9 }],
    recoilPattern: [[0.00, 1.00], [0.12, 1.05], [-0.10, 1.08]],
    audio: { fire: "sniper", pitch: 0.72, thump: 0.95 },
  },
  shell_lobber: {
    id: "shell_lobber",
    name: "Cinder Arc",
    damage: 55,
    pellets: 1,
    ammo: 4,
    reloadTime: 2600,
    fireRate: 950,
    spread: 0.04,
    color: "#4b4f38",
    modelScale: [0.18, 0.16, 0.62],
    personality: "Explosive crystal launcher",
    accent: "#ffb000",
    fireMode: "semi",
    adsFov: 60,
    adsSpreadMultiplier: 0.65,
    adsSpeedMultiplier: 0.58,
    recoilKick: 0.062,
    recoilRecovery: 4.8,
    sway: 1.15,
    inspectTime: 1600,
    reloadStages: [{ label: "BREAK LOCK", at: 0.2 }, { label: "CORE CHAMBER", at: 0.58 }, { label: "WARHEAD ARM", at: 0.86 }],
    recoilPattern: [[0.00, 1.00], [-0.28, 1.08], [0.24, 1.04]],
    audio: { fire: "launcher", pitch: 0.64, thump: 1.0 },
  },
  rapid_yolker: {
    id: "rapid_yolker",
    name: "Maelstrom MG",
    damage: 13,
    pellets: 1,
    ammo: 80,
    reloadTime: 3200,
    fireRate: 55,
    spread: 0.04,
    color: "#30343b",
    modelScale: [0.18, 0.15, 0.82],
    personality: "Chaotic energy machine gun",
    accent: "#ff8f2f",
    fireMode: "auto",
    adsFov: 64,
    adsSpreadMultiplier: 0.62,
    adsSpeedMultiplier: 0.6,
    recoilKick: 0.011,
    recoilRecovery: 12,
    sway: 1.25,
    inspectTime: 1300,
    reloadStages: [{ label: "DRUM DROP", at: 0.18 }, { label: "DRUM SEAT", at: 0.66 }, { label: "BARREL SPIN", at: 0.9 }],
    recoilPattern: [[0.05, 0.8], [-0.08, 0.88], [0.11, 0.82], [-0.13, 0.92], [0.16, 0.86], [-0.10, 0.95]],
    audio: { fire: "minigun", pitch: 1.18, thump: 0.22 },
  },
  crackling_burst: {
    id: "crackling_burst",
    name: "Triune VX",
    damage: 18,
    pellets: 1,
    ammo: 27,
    reloadTime: 1700,
    fireRate: 90,
    spread: 0.01,
    color: "#162333",
    modelScale: [0.12, 0.11, 0.68],
    personality: "Precision burst rifle",
    accent: "#9cff6a",
    fireMode: "burst",
    adsFov: 56,
    adsSpreadMultiplier: 0.35,
    adsSpeedMultiplier: 0.74,
    recoilKick: 0.018,
    recoilRecovery: 11,
    sway: 0.75,
    inspectTime: 1200,
    reloadStages: [{ label: "CELL OUT", at: 0.24 }, { label: "CELL IN", at: 0.6 }, { label: "BURST SYNC", at: 0.88 }],
    recoilPattern: [[-0.08, 1.0], [0.10, 1.05], [0.02, 1.18], [-0.12, 1.08]],
    audio: { fire: "burst", pitch: 1.35, thump: 0.26 },
  },
  runny_marksman: {
    id: "runny_marksman",
    name: "Valkyr DMR",
    damage: 42,
    pellets: 1,
    ammo: 12,
    reloadTime: 2100,
    fireRate: 360,
    spread: 0.006,
    color: "#6a472c",
    modelScale: [0.11, 0.11, 0.78],
    personality: "Skill-based marksman rifle",
    accent: "#d8b47a",
    fireMode: "semi",
    adsFov: 48,
    adsSpreadMultiplier: 0.18,
    adsSpeedMultiplier: 0.7,
    recoilKick: 0.034,
    recoilRecovery: 8.5,
    sway: 0.6,
    inspectTime: 1500,
    reloadStages: [{ label: "CLIP STRIP", at: 0.25 }, { label: "CELL SEAT", at: 0.62 }, { label: "HAMMER SET", at: 0.9 }],
    recoilPattern: [[0.00, 1.00], [-0.14, 1.08], [0.16, 1.10], [0.04, 1.12]],
    audio: { fire: "marksman", pitch: 0.9, thump: 0.58 },
  },
};

export const WEAPON_ORDER: WeaponId[] = [
  "cluckfire",
  "ovomatic",
  "yolkpiercer",
  "shell_lobber",
  "rapid_yolker",
  "crackling_burst",
  "runny_marksman",
];

export interface JoinPayload {
  nickname: string;
  solo: boolean;
  botCount: number;
  difficulty: Difficulty;
  mapId: MapId;
  privateLobby?: {
    action: "create" | "join";
    name: string;
    password: string;
    maxPlayers?: number;
    clientToken: string;
  };
}
