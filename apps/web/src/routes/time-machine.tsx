import { useEffect, useState } from "react";
import { CasinoReel } from "@/components/casino-reel";
import { RevealResult } from "@/components/reveal-result";
import { fetchRound } from "@/lib/drand";
import { initEngine, getDailyRoll, getScore } from "@/lib/engine";
import { getCurrent } from "@/state/session";
import { BADGE_INFO, badgeEP, getMatchDetail } from "@/lib/badges";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

/**
 * Time-machine route: /play/:date
 *
 * Recomputes and replays the roll for any past date. The drand round is
 * deterministic (derived from the UTC midnight timestamp), so anyone visiting
 * the same date + DID gets the same number.
 *
 * If the viewer is logged in, we use their DID — so they see exactly what
 * they would have rolled that day. If not, we show a read-only demo using a
 * fixed placeholder DID.
 */

const DEMO_DID = "did:plc:timemachine0000000000000000000";

function dateToRound(dateStr: string): number {
  // Parse as UTC midnight. The date string is YYYY-MM-DD.
  const [y, m, d] = dateStr.split("-").map(Number);
  const midnightUtc = new Date(Date.UTC(y, m - 1, d));
  const unixSecs = Math.floor(midnightUtc.getTime() / 1000);
  // Replicate the Rust daily_round logic inline — we could export it from
  // wasm but it's trivial enough to compute here.
  const DRAND_GENESIS = 1692803367;
  const DRAND_PERIOD = 3;
  if (unixSecs <= DRAND_GENESIS) return 1;
  return 1 + Math.floor((unixSecs - DRAND_GENESIS) / DRAND_PERIOD);
}

function isFutureDate(dateStr: string): boolean {
  const today = new Date().toISOString().split("T")[0];
  return dateStr > today;
}

function isValidDate(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr));
}

interface TimeMachineState {
  status: "loading" | "error" | "ready";
  message?: string;
  number?: number;
  badges?: string[];
  ep?: number;
  rarity?: string;
  round?: number;
}

export default function TimeMachine({ date }: { date: string }) {
  const [state, setState] = useState<TimeMachineState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!isValidDate(date)) {
        setState({ status: "error", message: `Invalid date: ${date}` });
        return;
      }
      if (isFutureDate(date)) {
        setState({ status: "error", message: "Can't time-travel to the future!" });
        return;
      }

      try {
        await initEngine();
        const round = dateToRound(date);
        const drandRound = await fetchRound(round);
        const did = getCurrent()?.did ?? DEMO_DID;
        const number = getDailyRoll(round, drandRound.randomness, did);
        const score = getScore(number);
        const badgeIds = score.badgeIds();
        const ep = score.total_ep;
        const rarity = score.best_rarity;

        if (cancelled) return;
        setState({
          status: "ready",
          number,
          badges: badgeIds,
          ep,
          rarity,
          round,
        });
      } catch (e) {
        if (!cancelled) {
          setState({ status: "error", message: String(e) });
        }
      }
    }

    void run();
    return () => { cancelled = true; };
  }, [date]);

  if (state.status === "loading") {
    return (
      <div className="flex flex-col items-center gap-6 py-12">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          · rewinding the cosmic tape ·
        </p>
        <p className="text-sm text-muted-foreground">
          Recomputing the roll for {date}…
        </p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col items-center gap-6 py-12">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-destructive">
          · timeline error ·
        </p>
        <p className="text-sm text-muted-foreground">{state.message}</p>
        <Button variant="ghost" size="sm" render={
          <Link to="/" />
        }>
          Back to today
        </Button>
      </div>
    );
  }

  const badgeDetails = state.badges!.map((id) => {
    const info = BADGE_INFO[id];
    return {
      id,
      name: info?.name ?? id,
      icon: info?.icon ?? "❓",
      rarity: info?.rarity ?? "common",
      desc: info?.desc ?? "",
      ep: info ? badgeEP(info) : 0,
      matchDetail: info ? getMatchDetail(id, state.number!) : "",
    };
  });

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
          · time machine · {date} ·
        </p>
        {!getCurrent() && (
          <p className="mt-1 text-xs text-muted-foreground">
            Showing a demo roll. Log in to see your own number for this date.
          </p>
        )}
      </div>

      <RevealResult
        ep={state.ep!}
        rarity={state.rarity!}
        badges={badgeDetails}
        number={state.number}
        isAlreadyRolled={true}
        reelSettled={false}
      >
        <CasinoReel
          key={`tm-${date}`}
          target={state.number!}
          onSpinEnd={() => {}}
        />
      </RevealResult>

      <Button variant="ghost" size="sm" render={
        <Link to="/" />
      }>
        ← Back to today
      </Button>
    </div>
  );
}
