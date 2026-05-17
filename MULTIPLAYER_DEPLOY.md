# Bullet Barrage Multiplayer Release

CrazyGames hosts only the static HTML5 client. Online multiplayer requires this repo's Socket.IO server to be deployed separately on a public HTTPS host that supports WebSockets.

## 1. Deploy The Multiplayer Server

Deploy the repo with `Dockerfile.multiplayer`.

Required environment variable:

```text
PORT=3001
```

Most hosts set `PORT` automatically. If your host does, do not override it.

The server exposes:

```text
GET /api/healthz
WSS /ws/socket.io
```

After deployment, verify:

```powershell
Invoke-WebRequest https://YOUR-SERVER-URL/api/healthz
```

Expected result: HTTP `200`.

Good hosting options:

- Render Web Service from Docker
- Railway Docker service
- Fly.io Docker app
- Any VPS with Docker and HTTPS reverse proxy

## 2. Rebuild The CrazyGames Client For Multiplayer

Replace the URL below with your deployed HTTPS server origin.

```powershell
Set-Location C:\Users\rushi\Downloads\Bullet-Barrage\Bullet-Barrage\artifacts\3d-game
$env:VITE_API_ORIGIN="https://YOUR-SERVER-URL"
$env:BASE_PATH="./"
npm.cmd run build
npm.cmd run package:crazygames
```

Upload:

```text
C:\Users\rushi\Downloads\Bullet-Barrage\Bullet-Barrage\artifacts\3d-game\bullet-barrage-crazygames.zip
```

If CrazyGames asks for individual files, upload:

```text
C:\Users\rushi\Downloads\Bullet-Barrage\Bullet-Barrage\artifacts\3d-game\crazygames-single-file\index.html
```

## 3. CrazyGames Form Settings

Use these settings when the backend is deployed and the client is rebuilt with `VITE_API_ORIGIN`:

```text
Game engine: HTML5
Online multiplayer game: Yes
Progress save: Yes, using LocalStorage
Mobile support: No
CrazyGames SDK audio muting: No
```

## Important

If `VITE_API_ORIGIN` is missing, the CrazyGames build disables the multiplayer button because private rooms cannot work from static `index.html` alone.
