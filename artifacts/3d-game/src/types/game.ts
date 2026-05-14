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
}

export interface KillEvent {
  id: string;
  killerId: string;
  killerNickname: string;
  kills: number;
  timestamp: number;
}
