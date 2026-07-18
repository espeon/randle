#!/usr/bin/env bash
#
# RNGdle server install / update.
#
# Builds the appview (release) + web bundle from this repo, installs Caddy
# (HTTP on :8080, fronted by your own TLS proxy for iori.kiryu.cloud), and
# registers both as systemd services.
#
#   sudo bash deploy/install.sh          # first install
#   sudo bash deploy/install.sh          # rebuild + redeploy + restart (idempotent)
#
# Prereqs handled automatically if missing: Caddy binary, Node 20.x, Rust.
# Assumes Debian/Ubuntu for Node (apt + NodeSource). Rust comes via rustup.

set -euo pipefail

INSTALL_DIR=/opt/rngdle
CADDY_PORT=8080
APPVIEW_PORT=3001
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

err() { echo "ERROR: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || err "run with sudo (needs root to install system services)"

case "$(uname -m)" in
	x86_64)        ARCH=amd64 ;;
	aarch64|arm64) ARCH=arm64 ;;
	*)             err "unsupported arch: $(uname -m)" ;;
esac

echo "==> repo: $REPO_ROOT"

# ---------------------------------------------------------------- Caddy
if ! command -v caddy >/dev/null 2>&1; then
	echo "==> installing Caddy ($ARCH)"
	curl -fsSL "https://caddyserver.com/api/download?os=linux&arch=${ARCH}" -o /tmp/caddy.tar.gz
	tar -xzf /tmp/caddy.tar.gz -C /usr/local/bin caddy
	chmod +x /usr/local/bin/caddy
fi
id caddy >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin caddy
install -d -o caddy -g caddy /etc/caddy /var/lib/caddy /var/log/caddy

# ---------------------------------------------------------------- Node + pnpm + Rust (for building)
if ! command -v node >/dev/null 2>&1; then
	echo "==> installing Node 20.x"
	curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
	apt-get install -y nodejs
fi
if ! command -v pnpm >/dev/null 2>&1; then
	echo "==> installing pnpm"
	corepack enable
	corepack prepare pnpm@latest --activate
fi
if ! command -v cargo >/dev/null 2>&1; then
	echo "==> installing Rust (rustup)"
	curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
fi
# rustup installs into root's home under sudo.
# shellcheck disable=SC1091
source /root/.cargo/env 2>/dev/null || export PATH="/root/.cargo/bin:$PATH"

# ---------------------------------------------------------------- build
echo "==> building appview (release; LTO, this can take a few minutes)"
( cd "$REPO_ROOT/apps/appview" && cargo build --release )

echo "==> building web bundle"
( cd "$REPO_ROOT/apps/web" && pnpm install --frozen-lockfile && pnpm run build )

# ---------------------------------------------------------------- install artifacts
echo "==> installing artifacts to $INSTALL_DIR"
id rngdle >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin --home-dir "$INSTALL_DIR" rngdle
install -d -o rngdle -g rngdle "$INSTALL_DIR/appview" "$INSTALL_DIR/web/dist"
install -m 0755 "$REPO_ROOT/apps/appview/target/release/rngdle-appview" "$INSTALL_DIR/appview/rngdle-appview"
cp -a "$REPO_ROOT/apps/web/dist/." "$INSTALL_DIR/web/dist/"
chown -R rngdle:rngdle "$INSTALL_DIR"

# ---------------------------------------------------------------- configs + units
echo "==> installing Caddyfile + systemd units"
install -m 0644 "$SCRIPT_DIR/Caddyfile"              /etc/caddy/Caddyfile
install -m 0644 "$SCRIPT_DIR/caddy.service"          /etc/systemd/system/caddy.service
install -m 0644 "$SCRIPT_DIR/rngdle-appview.service" /etc/systemd/system/rngdle-appview.service

systemctl daemon-reload
systemctl enable --now rngdle-appview
systemctl enable --now caddy
systemctl restart rngdle-appview caddy

echo
echo "==> done"
echo "    appview : localhost:${APPVIEW_PORT}   (rngdle-appview.service)"
echo "    caddy   : :${CADDY_PORT}               (caddy.service) -> front with your TLS proxy"
echo
echo "    logs:   journalctl -u rngdle-appview -f"
echo "            journalctl -u caddy -f"
