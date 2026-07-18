# RNGdle deploy

Runs the appview + a static frontend behind **Caddy on `:8080`**, fronted by your
own TLS proxy for `iori.kiryu.cloud`.

```
internet ──TLS──► your front proxy ──► :8080 Caddy ─┬─ /api/* ──► appview :3001
                                                    └─ /*     ──► apps/web/dist
```

## First install (on the Linux server)

```bash
git clone <your-repo> rngdle && cd rngdle
sudo bash deploy/install.sh
```

The script will, as needed: download the Caddy binary, install Node 20 + Rust,
build the appview (release) and the web bundle, drop them in `/opt/rngdle`, and
enable + start `caddy` and `rngdle-appview` as systemd services.

Then point your front proxy at `localhost:8080` (or the host's `:8080`).

## Update (rebuild + redeploy)

```bash
git pull && sudo bash deploy/install.sh
```

Re-running rebuilds both artifacts, copies them into place, and restarts the
services. It's idempotent.

## Operations

```bash
systemctl status caddy rngdle-appview
journalctl -u rngdle-appview -f      # jetstream ingestion + scoring
journalctl -u caddy -f
```

- Appview SQLite DB: `/opt/rngdle/appview/rngdle.db`
- Frontend bundle: `/opt/rngdle/web/dist`
- Caddyfile: `/etc/caddy/Caddyfile`

## Notes

- Caddy is **HTTP-only** (`admin off`, `:8080`); TLS is your front proxy's job.
- The Caddyfile sets `COOP`/`COEP` headers to match the Vite dev server (the WASM
  bundle expects them). Remove them only if a cross-origin resource fails to load.
- Node install uses NodeSource (Debian/Ubuntu). On other distros, install Node 20
  yourself first and the script will skip that step.
- Release build uses LTO (`apps/appview/Cargo.toml`), so the first build is slow.
