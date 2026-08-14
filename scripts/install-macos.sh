#!/usr/bin/env bash
# MyPi one-click installer for macOS.
# Copies the app into Applications, then applies local trust so Gatekeeper
# does not block an unsigned / ad-hoc-signed build:
#   1. strip com.apple.quarantine
#   2. ad-hoc codesign --deep
#   3. optional spctl --add (sudo)
#   4. refresh Launch Services
#
# Usage:
#   ./scripts/install-macos.sh
#   ./scripts/install-macos.sh /path/to/MyPi.dmg
#   ./scripts/install-macos.sh --build
#   ./scripts/install-macos.sh --trust-only /Applications/MyPi.app
#   ./scripts/install-macos.sh --user          # install to ~/Applications (no sudo)

set -u

APP_NAME="MyPi"
DEST_DIR="/Applications"
BUILD=0
TRUST_ONLY=0
OPEN_AFTER=1
SOURCE=""

die() {
  echo "错误: $*" >&2
  exit 1
}

info() {
  echo "→ $*"
}

ok() {
  echo "✓ $*"
}

need_darwin() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    die "这个脚本只能在 macOS 上运行。"
  fi
}

usage() {
  cat <<EOF
MyPi macOS 一键安装

用法:
  $0 [选项] [MyPi.app|MyPi.dmg|MyPi.zip]

选项:
  --build         若本地还没有安装包，先执行 pnpm desktop:pack:mac
  --trust-only    只对已有 .app 做系统信任（不拷贝）
  --user          安装到 ~/Applications（不需要管理员）
  --no-open       安装后不自动打开
  -h, --help      显示帮助
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build) BUILD=1; shift ;;
    --trust-only) TRUST_ONLY=1; shift ;;
    --user) DEST_DIR="${HOME}/Applications"; shift ;;
    --no-open) OPEN_AFTER=0; shift ;;
    -h|--help) usage; exit 0 ;;
    --) shift; break ;;
    -*) die "未知选项: $1" ;;
    *) SOURCE="$1"; shift ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_DIR="${ROOT}/apps/desktop/release"
TMP_DIR=""

cleanup() {
  if [[ -n "${TMP_DIR}" && -d "${TMP_DIR}" ]]; then
    rm -rf "${TMP_DIR}"
  fi
  if [[ -n "${ATTACHED_DMG:-}" ]]; then
    hdiutil detach "${ATTACHED_DMG}" -quiet >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

find_app_in_dir() {
  local dir="$1"
  local found
  found="$(find "$dir" -name "${APP_NAME}.app" -type d -maxdepth 5 2>/dev/null | head -n 1 || true)"
  echo "$found"
}

mount_dmg() {
  local dmg="$1"
  local output
  output="$(hdiutil attach "$dmg" -nobrowse -readonly -noverify 2>&1)" || die "无法打开磁盘映像: $dmg"
  ATTACHED_DMG="$(echo "$output" | awk '/\/Volumes\// { print $NF; exit }')"
  [[ -n "${ATTACHED_DMG}" ]] || die "挂载 DMG 失败。"
  echo "${ATTACHED_DMG}"
}

unpack_source() {
  local input="$1"
  if [[ -d "$input" && "$input" == *.app ]]; then
    echo "$input"
    return
  fi
  if [[ -f "$input" && "$input" == *.dmg ]]; then
    local volume
    volume="$(mount_dmg "$input")"
    local app
    app="$(find_app_in_dir "$volume")"
    [[ -n "$app" ]] || die "DMG 里没有找到 ${APP_NAME}.app"
    echo "$app"
    return
  fi
  if [[ -f "$input" && "$input" == *.zip ]]; then
    TMP_DIR="$(mktemp -d -t mypi-install)"
    unzip -q "$input" -d "$TMP_DIR" || die "解压失败: $input"
    local app
    app="$(find_app_in_dir "$TMP_DIR")"
    [[ -n "$app" ]] || die "ZIP 里没有找到 ${APP_NAME}.app"
    echo "$app"
    return
  fi
  die "不支持的安装包: $input（需要 .app / .dmg / .zip）"
}

locate_packaged_app() {
  local app
  app="$(find_app_in_dir "$RELEASE_DIR")"
  if [[ -n "$app" ]]; then
    echo "$app"
    return
  fi
  local dmg
  dmg="$(find "$RELEASE_DIR" -name "*.dmg" -type f -maxdepth 3 2>/dev/null | head -n 1 || true)"
  if [[ -n "$dmg" ]]; then
    unpack_source "$dmg"
    return
  fi
  local zip
  zip="$(find "$RELEASE_DIR" -name "*.zip" -type f -maxdepth 3 2>/dev/null | head -n 1 || true)"
  if [[ -n "$zip" ]]; then
    unpack_source "$zip"
    return
  fi
  echo ""
}

maybe_build() {
  if [[ "$BUILD" != "1" ]]; then
    return
  fi
  need_darwin
  command -v pnpm >/dev/null || die "未找到 pnpm。请先安装 Node.js 22+ 并执行 corepack enable。"
  info "正在打包 macOS 应用（首次会下载 Pi，可能较久）…"
  (cd "$ROOT" && pnpm desktop:pack:mac) || die "打包失败。"
}

# Clear quarantine + ad-hoc sign + Gatekeeper label so a non-technical user
# can open the app without System Settings → Open Anyway.
trust_app() {
  local app="$1"
  [[ -d "$app" ]] || die "找不到应用: $app"

  info "清除隔离属性（quarantine）…"
  xattr -cr "$app" 2>/dev/null || true
  xattr -dr com.apple.quarantine "$app" 2>/dev/null || true
  if command -v sudo >/dev/null && sudo -n true 2>/dev/null; then
    sudo xattr -cr "$app" 2>/dev/null || true
    sudo xattr -dr com.apple.quarantine "$app" 2>/dev/null || true
  fi

  if command -v codesign >/dev/null; then
    info "写入本机 ad-hoc 签名…"
    codesign --force --deep --sign - --timestamp=none "$app" 2>/dev/null \
      || sudo codesign --force --deep --sign - --timestamp=none "$app" \
      || die "codesign 失败。"
    if codesign --verify --deep --strict "$app" >/dev/null 2>&1; then
      ok "签名校验通过。"
    else
      codesign --verify --deep "$app" >/dev/null 2>&1 && ok "签名已写入（非 strict）。" \
        || echo "警告: codesign --verify 未完全通过，仍可尝试打开。" >&2
    fi
  else
    echo "警告: 没有 codesign，已跳过签名。" >&2
  fi

  if command -v spctl >/dev/null; then
    info "登记 Gatekeeper 评估…"
    if sudo -n true 2>/dev/null || [[ -t 0 ]]; then
      sudo spctl --add --label "${APP_NAME}" "$app" 2>/dev/null \
        && sudo spctl --enable --label "${APP_NAME}" 2>/dev/null \
        && ok "已加入 spctl 白名单。" \
        || echo "提示: spctl 登记失败（新系统上较常见），隔离属性已清除，一般仍可打开。" >&2
    else
      echo "提示: 当前无法使用 sudo，已跳过 spctl。若打开仍被拦截，请用管理员再跑一次。" >&2
    fi
  fi

  local lsregister="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
  if [[ -x "$lsregister" ]]; then
    "$lsregister" -f "$app" >/dev/null 2>&1 || true
  fi

  ok "已完成 macOS 信任处理: $app"
}

copy_app() {
  local src="$1"
  local dest="${DEST_DIR}/${APP_NAME}.app"
  mkdir -p "$DEST_DIR" || die "无法创建目录: $DEST_DIR"
  if [[ -d "$dest" ]]; then
    info "正在替换已有安装: $dest"
    rm -rf "$dest" 2>/dev/null || sudo rm -rf "$dest" || die "无法删除旧版本。"
  fi
  info "安装到 $dest"
  if cp -R "$src" "$dest" 2>/dev/null; then
    :
  else
    sudo cp -R "$src" "$dest" || die "拷贝失败（可能需要管理员密码）。"
  fi
  if [[ "$(stat -f %u "$dest" 2>/dev/null || echo 0)" == "0" ]]; then
    sudo chown -R "$(id -un):staff" "$dest" 2>/dev/null || true
  fi
  echo "$dest"
}

need_darwin

if [[ "$TRUST_ONLY" == "1" ]]; then
  TARGET="${SOURCE:-${DEST_DIR}/${APP_NAME}.app}"
  [[ -d "$TARGET" ]] || die "--trust-only 需要一个 .app 路径。"
  trust_app "$TARGET"
  exit 0
fi

if [[ -n "$SOURCE" ]]; then
  APP_SRC="$(unpack_source "$SOURCE")"
else
  maybe_build
  APP_SRC="$(locate_packaged_app)"
  if [[ -z "$APP_SRC" ]]; then
    if [[ "$BUILD" != "1" ]]; then
      info "未找到现成安装包，开始自动打包…"
      BUILD=1
      maybe_build
      APP_SRC="$(locate_packaged_app)"
    fi
  fi
  [[ -n "$APP_SRC" ]] || die "打包后仍未找到 ${APP_NAME}.app。请检查 apps/desktop/release。"
fi

INSTALLED="$(copy_app "$APP_SRC")"
trust_app "$INSTALLED"

if [[ "$OPEN_AFTER" == "1" ]]; then
  info "正在打开 ${APP_NAME}…"
  open "$INSTALLED"
fi

echo
ok "安装完成。请按屏幕上的向导粘贴 API Key 并选择工作文件夹。"
echo "   应用位置: $INSTALLED"
echo "   若仍提示无法打开: 系统设置 → 隐私与安全性 → 仍要打开"
echo "   或再执行: $0 --trust-only \"$INSTALLED\""
