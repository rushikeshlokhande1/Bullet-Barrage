import type { GameMode, MapId } from "../types/game";

export interface LeaderboardEntry {
  id: string;
  nickname: string;
  score: number;
  kills: number;
  deaths: number;
  kd: number;
  durationMs: number;
  mapId: MapId;
  mode: GameMode;
  createdAt: number;
}

const STORAGE_KEY = "bullet-barrage-local-leaderboard-v1";
const MAX_ENTRIES = 25;

function readEntries(): LeaderboardEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry?.score === "number") : [];
  } catch {
    return [];
  }
}

function rank(entries: LeaderboardEntry[]) {
  return [...entries]
    .sort((a, b) => b.score - a.score || b.kills - a.kills || a.deaths - b.deaths || b.createdAt - a.createdAt)
    .slice(0, MAX_ENTRIES);
}

export function getLeaderboard() {
  if (typeof window === "undefined") return [];
  return rank(readEntries());
}

export function submitLeaderboardEntry(entry: Omit<LeaderboardEntry, "id" | "score" | "kd" | "createdAt">) {
  if (typeof window === "undefined" || entry.kills <= 0) return getLeaderboard();
  const kd = entry.deaths === 0 ? entry.kills : entry.kills / entry.deaths;
  const minutes = Math.max(0.5, entry.durationMs / 60000);
  const paceBonus = Math.round((entry.kills / minutes) * 30);
  const survivalBonus = Math.max(0, Math.round((180000 - entry.durationMs) / 1000));
  const score = entry.kills * 1000 + Math.round(kd * 180) + paceBonus + survivalBonus;
  const next: LeaderboardEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    score,
    kd,
    createdAt: Date.now(),
  };
  const entries = rank([...readEntries(), next]);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new CustomEvent("bullet-barrage-leaderboard-updated"));
  return entries;
}
