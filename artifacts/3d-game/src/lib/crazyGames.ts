import type { MapId } from "../types/game";

type CrazyEnvironment = "local" | "crazygames" | "disabled";

interface CrazyGamesSdk {
  init: () => Promise<void>;
  environment: CrazyEnvironment;
  game: {
    loadingStart: () => void;
    loadingStop: () => void;
    gameplayStart: () => void;
    gameplayStop: () => void;
    updateRoom: (data: { roomId?: string; isJoinable?: boolean; inviteParams?: Record<string, string> }) => void;
    leftRoom: () => void;
    setGameContext: (data: Record<string, string>) => void;
    clearGameContext: () => void;
    inviteParams: Record<string, string> | null;
    getInviteParam: (key: string) => string | null;
  };
}

declare global {
  interface Window {
    CrazyGames?: {
      SDK?: CrazyGamesSdk;
    };
  }
}

let initPromise: Promise<boolean> | null = null;
let gameplayActive = false;
let currentRoomId: string | null = null;

function sdk() {
  return window.CrazyGames?.SDK;
}

function canUseSdk() {
  try {
    const env = sdk()?.environment;
    return env === "local" || env === "crazygames";
  } catch {
    return false;
  }
}

async function callSdk(action: (sdk: CrazyGamesSdk) => void | Promise<void>) {
  if (!(await initCrazyGames())) return;
  const activeSdk = sdk();
  if (!activeSdk || !canUseSdk()) return;
  try {
    await action(activeSdk);
  } catch {
    // The SDK intentionally throws in disabled environments; gameplay must continue.
  }
}

export async function initCrazyGames() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const activeSdk = sdk();
    if (!activeSdk) return false;
    if (!canUseSdk()) return false;
    try {
      await activeSdk.init();
      return canUseSdk();
    } catch {
      return false;
    }
  })();

  return initPromise;
}

export function loadingStart() {
  void callSdk((activeSdk) => activeSdk.game.loadingStart());
}

export function loadingStop() {
  void callSdk((activeSdk) => activeSdk.game.loadingStop());
}

export function gameplayStart() {
  if (gameplayActive) return;
  gameplayActive = true;
  void callSdk((activeSdk) => activeSdk.game.gameplayStart());
}

export function gameplayStop() {
  if (!gameplayActive) return;
  gameplayActive = false;
  void callSdk((activeSdk) => activeSdk.game.gameplayStop());
}

export function updateRoom(mapId: MapId, mode: "multiplayer" | "solo") {
  const roomId = mode === "multiplayer" ? `arena-${mapId}` : `solo-${mapId}`;
  currentRoomId = roomId;
  void callSdk((activeSdk) => {
    activeSdk.game.updateRoom({
      roomId,
      isJoinable: mode === "multiplayer",
      inviteParams: { mapId, mode },
    });
    activeSdk.game.setGameContext({ mapId, mode, roomId });
  });
}

export function leaveRoom() {
  if (!currentRoomId) return;
  currentRoomId = null;
  void callSdk((activeSdk) => {
    activeSdk.game.leftRoom();
    activeSdk.game.clearGameContext();
  });
}

export function getInviteMapId(): MapId | null {
  if (!canUseSdk()) return null;
  try {
    const activeSdk = sdk();
    const raw = activeSdk?.game.getInviteParam("mapId") ?? activeSdk?.game.inviteParams?.["mapId"] ?? null;
    return raw === "cracked" || raw === "sandstone" || raw === "cyber" || raw === "overpass" || raw === "foundry"
      ? raw
      : null;
  } catch {
    return null;
  }
}
