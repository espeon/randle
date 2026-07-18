# rngdle — command runner
# Docs: https://github.com/casey/just

# show available recipes
default:
    @just --list

# ── rngdle-core (Rust core, shared by web + appview) ─────────────

# run the full core test suite (determinism, edge_cases, props, badges)
test:
    cd rngdle-core && cargo test --release

# run the scoring micro-benchmark (prints ns/score)
bench:
    cd rngdle-core && cargo test --release bench_score_range -- --nocapture

# type-check the core
check-core:
    cd rngdle-core && cargo check

# ── web frontend (React + Vite + WASM) ───────────────────────────

# build WASM bindings into apps/web/wasm (run after changing rngdle-core)
wasm:
    wasm-pack build rngdle-core --release --target web --out-dir ../apps/web/wasm

# install web dependencies
web-install:
    cd apps/web && pnpm install

# start the Vite dev server (uses the checked-in wasm; run `just wasm` to refresh it)
web-dev:
    cd apps/web && pnpm run dev

# production build the web bundle
web-build:
    cd apps/web && pnpm run build

# ── appview backend ──────────────────────────────────────────────

# type-check the appview
check-appview:
    cd apps/appview && cargo check

# run the appview server (set DATABASE_URL to override the default sqlite path)
appview:
    cd apps/appview && cargo run --release

# ── combined ─────────────────────────────────────────────────────

# bring up appview (:3001) + Vite dev server (:38080, with /api proxy) together.
# open it via your front proxy at https://iori.kiryu.cloud (-> localhost:38080).
# Ctrl+C stops both processes.
dev:
    #!/usr/bin/env bash
    set -euo pipefail
    trap 'kill 0' INT TERM EXIT
    ( cd apps/appview && APPVIEW_PORT=3001 cargo run ) &
    ( cd apps/web && pnpm run dev --port 38080 --host ) &
    wait

# type-check the core and the appview
check: check-core check-appview

# full release build: wasm bindings + web bundle + appview binary
build: wasm web-build
    cd apps/appview && cargo build --release

# first-time setup: add the wasm target and install web deps
setup:
    rustup target add wasm32-unknown-unknown
    cd apps/web && pnpm install

# remove all build artifacts
clean:
    cargo clean --manifest-path rngdle-core/Cargo.toml
    cargo clean --manifest-path apps/appview/Cargo.toml
    cd apps/web && rm -rf dist
