#!/bin/sh
# Mindmods Cletus Installer
# curl -fsSL https://mindmods.tech/cletus.sh | sh
set -e

REPO="https://github.com/Mindmods-Research/cletus.git"

# Determine install directory
if [ -n "$CLETUS_DIR" ]; then
  INSTALL_DIR="$CLETUS_DIR"
elif [ -w /opt ] || [ "$(id -u)" = "0" ]; then
  INSTALL_DIR="/opt/cletus"
else
  INSTALL_DIR="$HOME/.cletus/runtime"
fi

# Preflight: Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js is required (>= 20). Install it first." >&2
  exit 1
fi

NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "[ERROR] Node.js >= 20 required, found $(node -v)." >&2
  exit 1
fi

# Preflight: git
if ! command -v git >/dev/null 2>&1; then
  echo "[ERROR] git is required." >&2
  exit 1
fi

# Enable pnpm via corepack
if ! command -v pnpm >/dev/null 2>&1; then
  echo "[INFO]  Enabling pnpm via corepack..."
  corepack enable pnpm || {
    echo "[ERROR] Failed to enable pnpm. Install it manually: npm i -g pnpm" >&2
    exit 1
  }
fi

# Clone or update
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "[INFO]  Updating existing installation at $INSTALL_DIR..."
  cd "$INSTALL_DIR" && git pull --ff-only
else
  echo "[INFO]  Cloning cletus to $INSTALL_DIR..."
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone "$REPO" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# Install and build
echo "[INFO]  Installing dependencies..."
pnpm install --frozen-lockfile
echo "[INFO]  Building..."
pnpm run build

# Launch
exec node dist/index.js --run
