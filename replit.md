# Frag.IO — Multiplayer Browser FPS

A lightweight multiplayer FPS game inspired by Shell Shockers. Players join with a nickname, enter a 3D arena, and shoot each other in real-time.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API + game server (port 8080)
- `pnpm --filter @workspace/3d-game run dev` — run the game frontend (port 24982)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + React Three Fiber + Three.js
- Backend: Express 5 + Socket.IO (game server)
- No database (all state in-memory)
- Validation: Zod (`zod/v4`)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/3d-game/` — React + React Three Fiber game client
  - `src/components/Game.tsx` — main game component (state, socket events)
  - `src/components/FPSControls.tsx` — pointer lock, WASD movement, shooting
  - `src/components/Arena.tsx` — 3D map geometry + exported box data
  - `src/components/RemotePlayer.tsx` — interpolated remote player meshes
  - `src/components/HUD.tsx` — crosshair, health bar, kill count, kill feed
  - `src/components/StartMenu.tsx` — nickname entry screen
  - `src/hooks/useSocket.ts` — Socket.IO client hook
  - `src/types/game.ts` — shared TypeScript types
- `artifacts/api-server/` — Express + Socket.IO game server
  - `src/gameServer.ts` — game logic: players, shooting, health, respawn

## Architecture decisions

- Socket.IO is mounted at `/ws/socket.io` (proxied via `/ws` path in `artifact.toml`)
- Client-side hit detection using raycasting + angle thresholding; server validates and applies damage
- Player state is fully in-memory on the server — no database needed
- Respawn delay is 3 seconds, handled server-side with `setTimeout`
- Remote players use `lerp` interpolation in `useFrame` for smooth movement

## Product

- Enter a nickname to join the arena
- WASD to move, mouse to aim (pointer lock), left click to shoot
- Space to jump, R to reload
- 12-round magazine, 1.5s reload time
- 25 damage per hit (4 hits to kill)
- Kill feed, health bar, ammo counter, kill count in HUD
- Players respawn at random spawn points after 3 seconds

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Must restart `api-server` workflow after code changes (it builds before running)
- WebSocket path `/ws` must be in `api-server/artifact.toml` paths array for proxy routing to work
- Pointer lock only activates after clicking the canvas (browser security requirement)
- `BASE_URL` env var from Vite must be used as the socket.io `path` prefix in `useSocket.ts`
