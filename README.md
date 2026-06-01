# Twitch Orders Collector

Localhost-only desktop utility for collecting strict Twitch chat item requests with `Electron + Vue 3 + SQLite`.

## Features

- Secure Electron shell with `contextIsolation: true` and a minimal preload bridge
- SQLite persistence for settings and request history via `sql.js` on a local file
- Strict command parsing for `!request something`
- Dashboard, request log, popularity, users, and settings views
- Live updates and desktop notifications for new valid requests
- Twitch EventSub WebSocket ingestion path for chat messages
- Local OAuth callback support over HTTP or HTTPS, with optional `mkcert`

## Requirements

- Volta
- Node.js `26.2.0` pinned via Volta
- A Twitch user access token that matches the configured bot user
- `channel.chat.message` EventSub access for the target broadcaster

The project is pinned to `Node 26.2.0`, which was the latest current release on May 31, 2026 according to the official Node.js download page.

Install or select the pinned runtime with Volta:

```bash
volta install node@26.2.0
volta pin node@26.2.0
```

## Install

```bash
npm install
```

Or explicitly:

```bash
volta run --node 26.2.0 npm install
```

No native SQLite rebuild is required.

## Local OAuth callback

The app now uses a fixed local callback URL for the simple flow:

```text
http://localhost:3443/oauth/twitch/callback
```

Register that exact URL in Twitch, then click `Start OAuth`.

## Local HTTPS OAuth with mkcert

Generate the localhost certificate and key first:

```bash
mkcert -install
mkcert localhost 127.0.0.1 ::1
```

Then fill these app settings:

- `Twitch client ID`
- `Twitch client secret`
- `mkcert cert path`
- `mkcert key path`

If you later re-enable HTTPS in code/config, the redirect URL to register in Twitch is, for example:

```text
https://localhost:3443/oauth/twitch/callback
```

After saving settings, click `Start OAuth`. The app will:

1. start a local HTTPS callback server with your mkcert certificate
2. open the Twitch authorization page in the browser
3. exchange the returned code for tokens
4. store the access token, refresh token, and bot user ID locally

The app can also manage the certificate for you from `Settings`:

- `Create / update mkcert` reuses existing cert/key files if they already exist
- `Regenerate mkcert` forces a new certificate for the current host

There is also a CLI helper:

```bash
node scripts/manage-mkcert.js --host twitch-orders.local --force
```

Optional flags:

- `--binary <path-to-mkcert>`
- `--outputDir <directory>`
- `--certPath <custom-cert-file>`
- `--keyPath <custom-key-file>`

## Run in development

```bash
npm run dev
```

This starts Vite on `http://127.0.0.1:5173` and launches Electron against the local renderer.

## Build the renderer bundle

```bash
npm run build
```

After building, you can launch Electron against the production renderer with:

```bash
npm start
```

## Build a Windows `.exe`

Generate the Windows installer locally with:

```bash
npm run dist:win
```

This writes the installer to:

- `release/Twitch Orders Collector-Setup-<version>.exe`

The current build also produces:

- `release/win-unpacked/`
- `release/latest.yml`
- `release/*.blockmap`

## Automated GitHub Release builds

The repository now includes a GitHub Actions workflow at:

- `.github/workflows/release.yml`

It automatically:

1. runs on pushed tags like `v0.1.0`
2. builds the Windows installer on `windows-latest`
3. creates the GitHub Release if needed
4. uploads the generated `.exe` asset to that release

To trigger it, create and push a tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Local data

- Development database path: `data/twitch-orders-collector.sqlite3`
- Packaged runtime database path: Electron `userData/data/twitch-orders-collector.sqlite3`

## Twitch settings

The app stores these values in SQLite:

- Twitch client ID
- OAuth token
- Bot user ID
- Channel user ID
- Channel login
- Channel display name
- Trigger word
- Strip punctuation toggle

The parser only accepts strict commands matching:

- `!request pikachu`
- `!request blue sword`

These are rejected:

- `i want pikachu`
- `request blue sword`

## Project structure

- `electron/` Electron main and preload code
- `core/` database, repositories, parsing, services
- `src/` Vue renderer
- `data/` local development SQLite file location
- `scripts/` developer scripts
