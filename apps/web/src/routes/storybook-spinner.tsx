import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { CasinoReel } from "@/components/casino-reel";
import { RevealResult } from "@/components/reveal-result";
import { BADGE_INFO, badgeEP, getMatchDetail } from "@/lib/badges";
import { initEngine, getScore } from "@/lib/engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SpinnerStorybook() {
  const [target, setTarget] = useState(777777);
  const [inputVal, setInputVal] = useState("777777");
  const [spinKey, setSpinKey] = useState(0);
  const [revealKey, setRevealKey] = useState(0);
  const [engineReady, setEngineReady] = useState(false);
  const revealedRef = useRef(false);
  const [score, setScore] = useState<{
    ep: number;
    rarity: string;
    badges: {
      id: string;
      name: string;
      icon: string;
      rarity: string;
      desc: string;
      ep: number;
      matchDetail: ReactNode;
    }[];
  } | null>(null);

  // Initialize WASM engine on mount.
  useEffect(() => {
    initEngine().then(() => setEngineReady(true));
  }, []);

  const handleSpinEnd = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;

    const s = getScore(target);
    const badges = s.badgeIds().map((id: string) => {
      const info = BADGE_INFO[id];
      return {
        id,
        name: info?.name ?? id,
        icon: info?.icon ?? "❓",
        rarity: info?.rarity ?? "common",
        desc: info?.desc ?? "",
        ep: info ? badgeEP(info) : 0,
        matchDetail: info ? getMatchDetail(id, target) : "",
      };
    });
    setScore({
      ep: s.total_ep,
      rarity: s.best_rarity,
      badges,
    });
    setRevealKey((k) => k + 1);
  }, [target]);

  async function handleRespin() {
    const n = parseInt(inputVal, 10);
    if (isNaN(n) || n < 0 || n > 9999999) return;

    await initEngine();
    setTarget(n);
    setScore(null);
    revealedRef.current = false;
    setSpinKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col items-center gap-8 py-8">
      <div className="text-center">
        <h2 className="font-display text-xl font-medium tracking-tight">
          Spinner storybook
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Test the full reveal — reels settle, then badges appear below.
        </p>
      </div>

      {!engineReady ? (
        <p className="text-sm text-muted-foreground">Loading engine…</p>
      ) : score ? (
        <RevealResult
          key={revealKey}
          ep={score.ep}
          rarity={score.rarity}
          badges={score.badges}
          isAlreadyRolled={false}
        >
          <CasinoReel key={spinKey} target={target} onSpinEnd={handleSpinEnd} />
        </RevealResult>
      ) : (
        <CasinoReel key={spinKey} target={target} onSpinEnd={handleSpinEnd} />
      )}

      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="target">Target number</Label>
          <Input
            id="target"
            type="number"
            min={0}
            max={9999999}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRespin()}
            className="w-40"
          />
        </div>
        <Button onClick={handleRespin}>Re-spin</Button>
      </div>

      <p className="font-mono text-sm tabular-nums text-muted-foreground">
        target: {target.toString().padStart(7, "0")}
      </p>
    </div>
  );
}
