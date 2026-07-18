import { Button } from "@/components/ui/button";
import { IconLogout, IconVolume, IconVolumeOff } from "@tabler/icons-react";
import { createRouter, createRoute, createRootRoute, Outlet, RouterProvider } from "@tanstack/react-router";
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import Index from "./routes/index.tsx";
import Callback from "./routes/callback.tsx";
import Leaderboard from "./routes/leaderboard.tsx";
import SpinnerStorybook from "./routes/storybook-spinner.tsx";
import TimeMachine from "./routes/time-machine.tsx";
import { initTheme } from "@/lib/theme";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrent, logout } from "@/state/session";
import { isSoundEnabled, setSoundEnabled } from "@/lib/sound";
import { useEffect, useState } from "react";

initTheme();

const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-svh bg-background text-foreground">
      <header>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <a href="/" className="font-display text-base font-semibold tracking-tight">RNGdle</a>
          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-1 text-sm">
              <a
                href="/"
                className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Play
              </a>
              <a
                href="/leaderboard"
                className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Leaderboard
              </a>
            </nav>
            <ThemeToggle />
            <SoundToggle />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-12">
        <Outlet />
      </main>
    </div>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Index,
});

const callbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/callback",
  component: Callback,
});

const leaderboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/leaderboard",
  component: Leaderboard,
});

const spinnerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/storybook/spinner",
  component: SpinnerStorybook,
});

const timeMachineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/play/$date",
  component: () => {
    const { date } = timeMachineRoute.useParams();
    return <TimeMachine date={date} />;
  },
});

const routeTree = rootRoute.addChildren([indexRoute, callbackRoute, leaderboardRoute, spinnerRoute, timeMachineRoute]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);

function LogoutButton() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(!!getCurrent());
  }, []);

  if (!loggedIn) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Log out"
      onClick={() => {
        void logout().then(() => {
          window.location.href = "/";
        });
      }}
    >
      <IconLogout />
    </Button>
  );
}

function SoundToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(isSoundEnabled());
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={on ? "Mute sound" : "Enable sound"}
      onClick={() => {
        const next = !on;
        setOn(next);
        setSoundEnabled(next);
      }}
    >
      {on ? <IconVolume /> : <IconVolumeOff />}
    </Button>
  );
}
