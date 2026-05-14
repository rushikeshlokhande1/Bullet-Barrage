import { useState } from "react";

interface Props {
  onStart: (nickname: string) => void;
}

export function StartMenu({ onStart }: Props) {
  const [nick, setNick] = useState("");

  return (
    <div className="start-menu">
      <div className="game-title">FRAG.IO</div>
      <div className="game-subtitle">Multiplayer FPS</div>
      <div className="start-form">
        <input
          className="nickname-input"
          type="text"
          placeholder="Enter nickname..."
          maxLength={20}
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && nick.trim()) onStart(nick.trim());
          }}
          autoFocus
        />
        <button
          className="play-button"
          onClick={() => nick.trim() && onStart(nick.trim())}
        >
          Play
        </button>
      </div>
      <div className="controls-hint">
        <span>WASD</span> — Move &nbsp;|&nbsp; <span>MOUSE</span> — Aim<br />
        <span>CLICK</span> — Shoot &nbsp;|&nbsp; <span>SPACE</span> — Jump<br />
        <span>R</span> — Reload
      </div>
    </div>
  );
}
