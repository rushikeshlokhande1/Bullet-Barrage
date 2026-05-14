import { useState } from "react";
import { StartMenu } from "./components/StartMenu";
import { Game } from "./components/Game";
import "./index.css";

export default function App() {
  const [nickname, setNickname] = useState<string | null>(null);

  if (!nickname) {
    return <StartMenu onStart={setNickname} />;
  }

  return <Game nickname={nickname} />;
}
