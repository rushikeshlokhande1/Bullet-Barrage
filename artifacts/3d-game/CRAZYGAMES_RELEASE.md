# CrazyGames Release Checklist

## Client Upload

1. Deploy the API server to a public HTTPS host with WebSocket support. See `../../MULTIPLAYER_DEPLOY.md`.
2. Create `artifacts/3d-game/.env.production` from `.env.production.example`.
3. Set `VITE_API_ORIGIN` to the deployed API origin.
4. Run `npm run build` from `artifacts/3d-game`.
5. Run `npm run package:crazygames` to generate a single-file upload ZIP.
6. Upload the ZIP. If CrazyGames asks for individual files instead, upload only `artifacts/3d-game/crazygames-single-file/index.html`.
6. Upload the ZIP to CrazyGames.

## Multiplayer Upload

For a real CrazyGames multiplayer submission, set:

```text
VITE_API_ORIGIN=https://your-deployed-api-host
```

before running the client build. The deployed API must serve Socket.IO at:

```text
/ws/socket.io
```

If `VITE_API_ORIGIN` is not set, the CrazyGames build intentionally disables the multiplayer menu path so players do not enter a private lobby that cannot connect.

## Required Platform Notes

- The build uses relative asset paths for ZIP hosting.
- The CrazyGames SDK v3 script is included in `index.html`.
- Loading and gameplay lifecycle events are sent through the SDK when available.
- Multiplayer map rooms are reported with `updateRoom`.
- Arrow keys and Space are prevented from scrolling the parent page.

## Multiplayer Backend

CrazyGames hosts the game client. The multiplayer server must be hosted separately.

The current Socket.IO path is:

```text
/ws/socket.io
```

Your deployed API server must expose that path over HTTPS/WSS and allow the CrazyGames origin.
