# ohMyPi

Local-first workbench for the [Pi](https://pi.dev) coding agent. Runs on your computer, keeps API keys off the screen, and asks before writing files or running commands.

## One-click install

GitHub Actions builds desktop packages on every `main` push (`nightly`) and on version tags (`v1.2.3`). The install script downloads that package and, on macOS, applies Gatekeeper trust automatically.

**macOS**

```bash
curl -fsSL https://github.com/Yunz93/ohMyPi/releases/latest/download/install-macos.sh | bash
```

Nightly (latest `main`):

```bash
curl -fsSL https://github.com/Yunz93/ohMyPi/releases/download/nightly/install-macos.sh | bash -s -- --nightly
```

**Windows (PowerShell)**

```powershell
irm https://github.com/Yunz93/ohMyPi/releases/latest/download/install-windows.ps1 | iex
```

Then open ohMyPi, paste an API key, and choose a work folder. If macOS still blocks the app: **System Settings → Privacy & Security → Open Anyway**.

### Publish a stable release

```bash
git tag v0.1.0
git push origin v0.1.0
```

That runs `.github/workflows/release.yml`, uploads `ohMyPi-mac-*.dmg` / `ohMyPi-win-*-setup.exe`, and attaches the install scripts.

Manual run: **Actions → Release → Run workflow**.

## Desktop app (Windows + macOS)

### Local install from a clone

```bash
bash scripts/install-macos.sh --nightly   # download GitHub package
bash scripts/install-macos.sh --build     # pack on this Mac, then install
bash scripts/install-macos.sh --user      # ~/Applications, no admin
bash scripts/install-macos.sh --trust-only /Applications/ohMyPi.app
pnpm desktop:install:mac
```

The macOS script:

1. Downloads (or packs) `ohMyPi.app`
2. Copies it to `/Applications`
3. Removes `com.apple.quarantine`
4. Ad-hoc code-signs the app
5. Registers Gatekeeper (`spctl --add`, if sudo is available)
6. Opens ohMyPi

### Build the installer locally

On the target OS (Windows on Windows, macOS on a Mac):

```bash
corepack enable
pnpm install
pnpm desktop:pack:mac   # → apps/desktop/release/ohMyPi-mac-*.dmg
pnpm desktop:pack:win   # → apps/desktop/release/ohMyPi-win-*-setup.exe
```

The pack step vendors a matching Pi CLI, so the user does not install Node or Pi.

### What the user sees

1. Open **ohMyPi**
2. Welcome → paste an API key (Anthropic / OpenAI / Gemini / OpenRouter / DeepSeek)
3. **Choose folder…** (native file dialog)
4. Chat. ohMyPi asks before editing files or running commands

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
| `OHMYPI_PI_ENTRY` | (desktop sets this) | Pi CLI file run with Node/Electron |
| `OHMYPI_DATA_DIR` | `~/.ohmypi` | Tasks + settings |
| `OHMYPI_ALLOWED_ROOTS` | home (or Setup folder) | Allowed project roots |
| `OHMYPI_MUTATIONS` | `approval` | `approval` or `disabled` |
| `OHMYPI_MAX_PROCESSES` | `3` | Concurrent Pi processes |
| `OHMYPI_REPO` | `Yunz93/ohMyPi` | GitHub repo for the install script |

`.env` is loaded automatically. Real environment variables override `.env`.

## Scripts

```bash
pnpm dev                 # web + server
pnpm desktop:dev         # Electron + web
pnpm desktop:pack:mac    # macOS dmg/zip
pnpm desktop:pack:win    # Windows nsis + portable exe
pnpm desktop:install:mac # download/copy to /Applications + Gatekeeper trust
pnpm build
pnpm start
pnpm test
pnpm test:integration
pnpm doctor
```

## Security notes

- Bind stays on localhost by default
- Writes to `.env`, `.ssh`, and Pi `auth.json` are blocked
- Mutation tools require approval unless `OHMYPI_MUTATIONS=disabled`
