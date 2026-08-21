# ohMyPi

本机运行的 [Pi](https://pi.dev) 编程助手。API 密钥只存在这台电脑上，改文件或跑命令前会先问你。

免费开源（MIT）。没有 Apple 开发者证书，也没有公证。**macOS 请用下面的安装脚本**，不要双击 GitHub 上的 `.dmg`——系统会提示无法验证开发者。

## 安装

**macOS（推荐，也是目前唯一支持的安装方式）**

打开「终端」，粘贴后回车：

```bash
curl -fsSL https://github.com/Yunz93/ohMyPi/releases/latest/download/install-macos.sh | bash
```

脚本会下载应用、拷到 `/Applications`、去掉隔离属性、在本机做 ad-hoc 签名，然后打开 ohMyPi。

开发中的每日构建：

```bash
curl -fsSL https://github.com/Yunz93/ohMyPi/releases/download/nightly/install-macos.sh | bash -s -- --nightly
```

若仍无法打开：系统设置 → 隐私与安全性 → 仍要打开。或再跑一次：

```bash
bash <(curl -fsSL https://github.com/Yunz93/ohMyPi/releases/latest/download/install-macos.sh) --trust-only /Applications/ohMyPi.app
```

**Windows（PowerShell）**

```powershell
irm https://github.com/Yunz93/ohMyPi/releases/latest/download/install-windows.ps1 | iex
```

装好后打开 ohMyPi，粘贴 API Key，选一个工作文件夹。密钥保存在 `~/.pi/agent/auth.json`，界面里不会再显示完整密钥。对话会发给你选择的 AI 服务商，不会经过 ohMyPi 的服务器。

### 发布稳定版

```bash
git tag v0.1.0
git push origin v0.1.0
```

这会跑 `.github/workflows/release.yml`，上传安装包和上述脚本。日常 `main` 推送会更新 `nightly` 预发布。

## 开发者

从仓库本地安装：

```bash
bash scripts/install-macos.sh --nightly   # 下载 GitHub 包
bash scripts/install-macos.sh --build     # 本机打包再安装
bash scripts/install-macos.sh --user      # ~/Applications，不需要管理员
bash scripts/install-macos.sh --trust-only /Applications/ohMyPi.app
```

本机打包（在对应系统上）：

```bash
corepack enable
pnpm install
pnpm desktop:pack:mac   # → apps/desktop/release/ohMyPi-mac-*.dmg
pnpm desktop:pack:win   # → apps/desktop/release/ohMyPi-win-*-setup.exe
```

打包时会带上 Pi，用户不必再装 Node。

浏览器开发模式：

```bash
pnpm install
cp .env.example .env
pnpm dev                 # http://127.0.0.1:5173
pnpm desktop:dev         # Electron + web
```

可选：不走桌面包时，把 Pi 装到 PATH：

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
pi --version
```

生产 web 服务：

```bash
pnpm build
NODE_ENV=production pnpm start   # http://127.0.0.1:4310
```

### 环境变量

| 变量 | 默认 | 含义 |
|------|------|------|
| `HOST` / `PORT` | `127.0.0.1` / `4310` | 服务监听地址 |
| `PI_BIN` | `pi` | PATH 上的 Pi |
| `OHMYPI_PI_ENTRY` | （桌面版会设置） | 用 Node/Electron 跑的 Pi CLI |
| `OHMYPI_DATA_DIR` | `~/.ohmypi` | 会话和设置 |
| `OHMYPI_ALLOWED_ROOTS` | 家目录或向导所选文件夹 | 允许访问的根目录 |
| `OHMYPI_MUTATIONS` | `approval` | `approval` 或 `disabled` |
| `OHMYPI_MAX_PROCESSES` | `3` | 同时运行的 Pi 进程数 |
| `OHMYPI_REPO` | `Yunz93/ohMyPi` | 安装脚本下载用的仓库 |

`.env` 会自动加载。真正的环境变量优先于 `.env`。

### 常用命令

```bash
pnpm test
pnpm test:integration
pnpm doctor
pnpm desktop:install:mac
```

## 安全

- 默认只监听本机
- 禁止写入 `.env`、`.ssh` 和 Pi 的 `auth.json`
- 改文件、跑命令默认要你点允许（`OHMYPI_MUTATIONS=disabled` 时全部拒绝）
- macOS 安装包目前**没有** Apple 公证；信任由安装脚本在本机完成
