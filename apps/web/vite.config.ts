import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      // Serve OAuth client metadata dynamically from the request origin, so
      // login works on any dev URL (localhost, a tunnel, iori.kiryu.cloud…)
      // without editing a static file. The built dist uses the pinned static
      // copy in public/.well-known instead.
      name: "atproto-oauth-client-metadata",
      configureServer(server) {
        server.middlewares.use(
          "/.well-known/atproto/oauth/client.json",
          (req, res) => {
            const host =
              (req.headers["x-forwarded-host"] as string | undefined) ||
              req.headers.host;
            if (!host) {
              res.statusCode = 400;
              res.end();
              return;
            }
            const forwarded = req.headers["x-forwarded-proto"] as
              | string
              | undefined;
            const proto =
              forwarded ||
              (host.startsWith("localhost") || host.startsWith("127.0.0.1")
                ? "http"
                : "https");
            const origin = `${proto}://${host}`;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                client_id: `${origin}/.well-known/atproto/oauth/client.json`,
                client_name: "RNGdle",
                client_uri: origin,
                redirect_uris: [`${origin}/callback`],
                scope: "atproto repo:vg.nat.randle.roll",
                grant_types: ["authorization_code", "refresh_token"],
                response_types: ["code"],
                token_endpoint_auth_method: "none",
                application_type: "web",
                dpop_bound_access_tokens: true,
              }),
            );
          },
        );
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    headers: {
      // Required for WASM
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    proxy: {
      // Route same-origin /api/* to the appview so the frontend needs no
      // separate public URL in dev. In prod, point a reverse proxy here.
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
    allowedHosts: ["iori.kiryu.cloud"],
  },
  optimizeDeps: {
    exclude: ["rngdle-core"],
  },
});
