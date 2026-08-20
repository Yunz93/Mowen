# MyPi

MyPi is a local-first web workbench for the Pi coding agent. It keeps one Pi RPC process per active task, streams conversations over WebSocket, and requires browser approval before file mutations or shell commands.

## Requirements

- Node.js 22+
- pnpm 11.21+
- A working `pi` CLI available on `PATH`, or an explicit `PI_BIN`

## Development

```bash
pnpm install
pnpm dev
```

The web app runs at `http://127.0.0.1:5173` and proxies the local server at `http://127.0.0.1:4310`.

## Production build

```bash
pnpm build
pnpm start
```

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm exec playwright install chromium
pnpm test:e2e
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Server bind address |
| `PORT` | `4310` | Server port |
| `PI_BIN` | `pi` | Pi executable |
| `MYPI_DATA_DIR` | `~/.mypi-web` | Task and session metadata |
| `MYPI_ALLOWED_ROOTS` | process working directory | Comma-separated task roots |
| `MYPI_MAX_PROCESSES` | `3` | Positive concurrent Pi process limit |
| `MYPI_MUTATIONS` | `approval` | `approval` or `disabled` |
| `MYPI_APPROVAL_TIMEOUT_MS` | `300000` | Positive approval timeout in milliseconds |

## Safety model

MyPi is intended for local use and binds to loopback by default. Read-only tools run automatically. Writes, edits, and shell commands require explicit approval unless mutations are disabled. Working directories and file previews must stay under `MYPI_ALLOWED_ROOTS`; `.env`, `.ssh`, and Pi authentication files are protected.

If you expose MyPi beyond loopback, place it behind an authenticated reverse proxy and explicitly configure the allowed roots.
