import { lazy, Suspense, useEffect, useState } from "react";
import { StartMenu } from "./components/StartMenu";
import type { MapId, GameMode, Difficulty } from "./types/game";
import {
  gameplayStop,
  getInviteMapId,
  initCrazyGames,
  leaveRoom,
  loadingStart,
  loadingStop,
  updateRoom,
} from "./lib/crazyGames";
import "./index.css";

const Game = lazy(() => import("./components/Game").then((module) => ({ default: module.Game })));

interface GameState {
  nickname: string;
  mapId: MapId;
  mode: GameMode;
  botCount: number;
  difficulty: Difficulty;
  privateLobby?: {
    action: "create" | "join";
    name: string;
    password: string;
    maxPlayers?: number;
    clientToken: string;
  };
}

export default function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [matchKey, setMatchKey] = useState(0);
  const inviteMapId = getInviteMapId();

  useEffect(() => {
    loadingStart();
    void initCrazyGames().finally(() => loadingStop());
  }, []);

  useEffect(() => {
    const preventPageScroll = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", preventPageScroll, { passive: false });
    return () => window.removeEventListener("keydown", preventPageScroll);
  }, []);

  if (!state) {
    return (
      <StartMenu
        initialMapId={inviteMapId ?? undefined}
        onStart={(payload) =>
          {
            updateRoom(payload.mapId, payload.mode);
            setState({
              nickname: payload.nickname,
              mapId: payload.mapId,
              mode: payload.mode,
              botCount: payload.botCount,
              difficulty: payload.difficulty,
              privateLobby: payload.privateLobby,
            });
          }
        }
      />
    );
  }

  return (
    <Suspense
      fallback={(
        <div className="game-loading-screen">
          LOADING ARENA
          <span>Preparing simulation</span>
        </div>
      )}
    >
      <Game
        key={matchKey}
        nickname={state.nickname}
        mapId={state.mapId}
        mode={state.mode}
        botCount={state.botCount}
        difficulty={state.difficulty}
        privateLobby={state.privateLobby}
        onReplay={() => {
          gameplayStop();
          leaveRoom();
          setState((current) => current?.privateLobby
            ? {
              ...current,
              privateLobby: {
                ...current.privateLobby,
                action: "join",
                maxPlayers: undefined,
              },
            }
            : current);
          setMatchKey((key) => key + 1);
        }}
        onExit={() => {
          gameplayStop();
          leaveRoom();
          setState(null);
        }}
      />
    </Suspense>
  );
}
