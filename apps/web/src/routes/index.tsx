import { useState, useEffect, useCallback } from "react";
import { fetchRound } from "../lib/drand.ts";
import { initEngine, getDailyRoll, getScore, getDailyRound } from "../lib/engine.ts";
import { getTodaysRoll, writeRoll } from "../lib/atproto.ts";
import {
  restore,
  startLogin,
  type AppState,
} from "../state/session.ts";
import { Button } from "@/components/ui/button";
import { CasinoReel } from "@/components/casino-reel";
import { RevealResult } from "@/components/reveal-result";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BADGE_INFO, badgeEP, getMatchDetail } from "@/lib/badges";

type State =
  | { status: "logged-out" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready-to-roll"; app: AppState; round: number; randomness: string }
  | { status: "spinning"; number: number; badges: string[]; ep: number; rarity: string }
  | { status: "rolled"; number: number; badges: string[]; ep: number; rarity: string }
  | { status: "already-rolled"; number: number; badges: string[]; ep: number; rarity: string };

export default function Index() {
  const [handle, setHandle] = useState("");
  const [state, setState] = useState<State>({ status: "logged-out" });

  const init = useCallback(async () => {
    const app = await restore();
    if (!app) {
      setState({ status: "logged-out" });
      return;
    }

    setState({ status: "loading" });
    await initEngine();

    const today = new Date().toISOString().split("T")[0];
    const existing = await getTodaysRoll(app.agent, app.did);
    if (existing && existing.date === today) {
      setState({
        status: "already-rolled",
        number: existing.claimedNumber,
        badges: existing.badges,
        ep: existing.ep,
        rarity: "common",
      });
      return;
    }

    try {
      const round = getDailyRound();
      const drandRound = await fetchRound(round);
      setState({
        status: "ready-to-roll",
        app,
        round,
        randomness: drandRound.randomness,
      });
    } catch (e) {
      setState({ status: "error", message: String(e) });
    }
  }, []);

  useEffect(() => {
    void init();
  }, [init]);

  async function handleLogin() {
    if (!handle.trim()) return;
    setState({ status: "loading" });
    try {
      const url = await startLogin(handle.trim());
      window.location.href = url;
    } catch (e) {
      setState({ status: "error", message: String(e) });
    }
  }

  async function handleReveal(
    app: AppState,
    round: number,
    randomness: string,
  ) {
    try {
      const number = getDailyRoll(round, randomness, app.did);
      const score = getScore(number);
      const badgeIds = score.badgeIds();
      const ep = score.total_ep;
      const rarity = score.best_rarity;

      // Write to the PDS while the reels spin (overlapped — no extra wait).
      const writePromise = writeRoll(app.agent, app.did, {
        date: new Date().toISOString().split("T")[0],
        round,
        claimedNumber: number,
        badges: badgeIds,
        ep,
        algo: "vg.nat.randle.roll:v1",
      });

      setState({ status: "spinning", number, badges: badgeIds, ep, rarity });

      // Hold the promise so a write failure still surfaces as an error.
      await writePromise;
    } catch (e) {
      setState({ status: "error", message: String(e) });
    }
  }

  function handleSpinEnd() {
    if (state.status !== "spinning") return;
    setState({
      status: "rolled",
      number: state.number,
      badges: state.badges,
      ep: state.ep,
      rarity: state.rarity,
    });
  }

  if (state.status === "logged-out") {
    return (
      <div className="mx-auto flex max-w-sm flex-col gap-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <span className="text-2xl">🎲</span>
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            · daily cosmic readout ·
          </p>
          <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight">
            Roll your fate
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Every day the drand beacon commits a random number to your Bluesky
            repo. It's already been decided. You just have to see it.
          </p>
        </div>
        <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="handle" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Bluesky handle
            </Label>
            <Input
              id="handle"
              type="text"
              placeholder="alice.bsky.social"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleLogin()}
              className="h-12 bg-muted/50 text-base font-medium focus-visible:bg-card"
            />
          </div>
          <Button
            size="lg"
            className="w-full text-base"
            onClick={handleLogin}
            disabled={!handle.trim()}
          >
            Sign in with Bluesky
          </Button>
        </div>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="flex justify-center py-16">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-sm text-center">
        <p className="font-display text-lg font-medium text-destructive">
          {state.message}
        </p>
        <Button
          variant="ghost"
          className="mt-3 text-sm text-muted-foreground"
          onClick={() => setState({ status: "logged-out" })}
        >
          Try again
        </Button>
      </div>
    );
  }

  const result =
    state.status === "rolled" || state.status === "already-rolled" ? state : null;

  if (state.status === "spinning" || (result && (state.status === "rolled" || state.status === "already-rolled"))) {
    const rolledNumber = state.status === "spinning" ? state.number : result!.number;
    const badgeDetails = (state.status === "spinning" ? state.badges : result!.badges).map((id) => {
      const info = BADGE_INFO[id];
      return {
        id,
        name: info?.name ?? id,
        icon: info?.icon ?? "❓",
        rarity: info?.rarity ?? "common",
        desc: info?.desc ?? "",
        ep: info ? badgeEP(info) : 0,
        matchDetail: info ? getMatchDetail(id, rolledNumber) : "",
      };
    });

    return (
      <RevealResult
        ep={state.status === "spinning" ? state.ep : result!.ep}
        rarity={state.status === "spinning" ? state.rarity : result!.rarity}
        badges={badgeDetails}
        number={state.status === "spinning" ? state.number : result!.number}
        isAlreadyRolled={state.status === "already-rolled"}
        reelSettled={state.status !== "spinning"}
      >
        <CasinoReel
          key="reel"
          target={state.status === "spinning" ? state.number : result!.number}
          onSpinEnd={handleSpinEnd}
        />
      </RevealResult>
    );
  }

  if (state.status === "ready-to-roll") {
    return (
      <div className="flex flex-col items-center gap-8 py-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <span className="text-2xl">🔮</span>
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            · signal acquired ·
          </p>
          <h2 className="mt-3 font-display text-xl font-medium tracking-tight">
            Your number is ready
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The drand beacon has committed. The cosmos has spoken.
            You just have to look.
          </p>
        </div>
        <Button
          size="lg"
          className="text-base"
          onClick={() => void handleReveal(state.app, state.round, state.randomness)}
        >
          Reveal
        </Button>
      </div>
    );
  }

  return null;
}
