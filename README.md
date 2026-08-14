# MyPi

Local-first workbench for the [Pi](https://pi.dev) coding agent. Runs on your computer, keeps API keys off the screen, and asks before writing files or running commands.

## Desktop app (Windows + macOS)

This is the path for non-technical users. Someone technical builds the installer once; the person using it only double-clicks MyPi and follows the on-screen guide.

### Build the installer

On the target OS (build Windows on Windows, macOS on a Mac):

```bash
git clone <this-repo> mypi
cd mypi
corepack enable
pnpm install
pnpm desktop:pack:mac   # → apps/desktop/release/*.dmg
# or
pnpm desktop:pack:win   # → apps/desktop/release/*.exe
```

The pack step downloads a matching Pi CLI into the app, so the user does not install Node or Pi.

### What the user sees

1. Open **MyPi**
2. Welcome → paste an API key (Anthropic / OpenAI / Gemini / OpenRouter / DeepSeek)
3. **Choose folder…** (native file dialog)
4. Chat. MyPi asks before editing files or running commands

Settings → **Open setup** to change the key or folder later. Keys are stored in `~/.pi/agent/auth.json` and never shown in full.

### Run the desktop app in development

```bash
pnpm desktop:dev
```

Starts the web UI (Vite) and the Electron window together. The first-run wizard still appears.

## Browser / developer mode

```bash
pnpm install
cp .env.example .env
pnpm dev                 # http://127.0.0.1:5173
```

Optional: install Pi on your PATH if you are not using the desktop bundle:

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
pi --version
```

Production web server:

```bash
pnpm build
NODE_ENV=production pnpm start   # http://127.0.0.1:4310
```

## Configuration

| Variable | Default | Meaning |
|----------|---------|---------|
| `HOST` / `PORT` | `127.0.0.1` / `4310` | Server bind address |
| `PI_BIN` | `pi` | Pi executable (PATH) |
| `MYPI_PI_ENTRY` | (desktop sets this) | Pi CLI file run with Node/Electron |
| `MYPI_DATA_DIR` | `~/.mypi-web` | Tasks + settings |
| `MYPI_ALLOWED_ROOTS` | home (or Setup folder) | Allowed project roots |
| `MYPI_MUTATIONS` | `approval` | `approval` or `disabled` |
| `MYPI_MAX_PROCESSES` | `3` | Concurrent Pi processes |

`.env` is loaded automatically. Real environment variables override `.env`.

## Scripts

```bash
pnpm dev                 # web + server
pnpm desktop:dev         # Electron + web
pnpm desktop:pack:mac    # macOS dmg/zip
pnpm desktop:pack:win    # Windows nsis + portable exe
pnpm build
pnpm start
pnpm test
pnpm test:integration
pnpm doctor
```

## Security notes

- Bind stays on localhost by default
- Writes to `.env`, `.ssh`, and Pi `auth.json` are blocked
- Mutation tools require approval unless `MYPI_MUTATIONS=disabled`
