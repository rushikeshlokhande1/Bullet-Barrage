import { useState } from "react";
import { StartMenu } from "./components/StartMenu";
import { Game } from "./components/Game";
import type { MapId, GameMode, Difficulty } from "./types/game";
import "./index.css";

interface GameState {
  nickname: string;
  mapId: MapId;
  mode: GameMode;
  botCount: number;
  difficulty: Difficulty;
}

export default function App() {
  const [state, setState] = useState<GameState | null>(null);

  if (!state) {
    return (
      <StartMenu
        onStart={(payload) =>
          setState({
            nickname: payload.nickname,
            mapId: payload.mapId,
            mode: payload.mode,
            botCount: payload.botCount,
            difficulty: payload.difficulty,
          })
        }
      />
    );
  }

  return (
    <Game
      nickname={state.nickname}
      mapId={state.mapId}
      mode={state.mode}
      botCount={state.botCount}
      difficulty={state.difficulty}
    />
  );
}
