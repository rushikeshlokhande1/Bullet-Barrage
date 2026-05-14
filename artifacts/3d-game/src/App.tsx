import { useState } from "react";
import { StartMenu } from "./components/StartMenu";
import { Game } from "./components/Game";
import type { MapId } from "./types/game";
import "./index.css";

export default function App() {
  const [state, setState] = useState<{ nickname: string; mapId: MapId } | null>(null);

  if (!state) {
    return <StartMenu onStart={(nickname, mapId) => setState({ nickname, mapId })} />;
  }

  return <Game nickname={state.nickname} mapId={state.mapId} />;
}
