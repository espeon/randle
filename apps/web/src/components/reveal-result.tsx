import { useEffect, useState, useRef, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  IconBrandBluesky,
  IconCheck,
  IconClipboardCopy,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BadgeIcon } from "@/components/badge-icon";
import { fetchTodayStats, type TodayStats } from "@/lib/leaderboard";
import { playCardFlip } from "@/lib/sound";

/**
 * Orchestrated reveal of the roll result.
 *
 * The settled reel (passed as children) stays mounted at the top — it is the
 * number. Below it, phases unfold:
 *  0. pause        — 800ms beat, just the reel sitting there
 *  1. ep           — EP counts up from 0 over ~1.2s
 *  2. rarity       — rarity word fades in
 *  3. badges       — each badge is dealt out of a stacked deck (motion/react),
 *                    staggered 250ms apart. The deck sits at the top; the
 *                    top card flips (rotateX) and slides into slot 1 just
 *                    below the deck; every previously-dealt card is pushed
 *                    down one slot to make room. The newest dealt card is
 *                    always closest to the deck.
 */

type Phase = "pause" | "ep" | "rarity" | "badges";

interface BadgeDetail {
  id: string;
  name: string;
  icon: string;
  rarity: string;
  desc: string;
  ep: number;
  matchDetail: ReactNode;
}

interface RevealResultProps {
  ep: number;
  rarity: string;
  badges: BadgeDetail[];
  /** The rolled number, used to compose the share/copy text. */
  number?: number;
  isAlreadyRolled: boolean;
  /**
   * Whether the reel's spin animation has finished. The slide-in from under
   * the reel (and the badge-deal phase) are gated on this so they don't
   * compete visually with the spinning reel.
   */
  reelSettled?: boolean;
  children?: ReactNode;
}

// Card-deal layout constants. Heights here must match the rendered card height
// (h-16 = 64px) and the inter-card gap (GAP) so the motion y-values line up
// with where each card actually sits.
const CARD_HEIGHT = 64;
const GAP = 8;
// How much each card in the deck is offset from the one above it. Tiny value
// gives just enough of a visible "stack" edge without revealing the faces.
const DECK_OFFSET = 2;
// Same easing curve the old CSS used for the deal transition.
const EASE = [0.22, 1, 0.36, 1] as const;

// Square emoji keyed by rarity tier — used in the share/copy blurb so the
// rarity line reads at a glance. Colors mirror the Tailwind classes in
// badge-icon.tsx (amber, red, emerald, yellow, sky, fuchsia).
const RARITY_EMOJI: Record<string, string> = {
  common: "🟧", // amber-500
  uncommon: "🟥", // red-500
  rare: "🟩", // emerald-500
  epic: "🟨", // yellow-400
  legendary: "🟦", // sky-400
  mythic: "🟪", // fuchsia-500
};
// Approximate "Top X%" placement for each rarity. Used purely in the share
// blurb — game scoring itself is the source of truth.
const RARITY_PERCENTILE: Record<string, string> = {
  common: "50",
  uncommon: "25",
  rare: "10",
  epic: "5",
  legendary: "1",
  mythic: "0.1",
};
// Cultural / number-of-note associations. When the rolled number matches
// one of these, a quote line gets inserted into the share blurb right under
// the title. Easy to extend — just add a new entry.
const NUMBER_MEMES: Record<number, string> = {
  0: "literally nothing",
  7: "lucky 7",
  13: "unlucky 13",
  23: "the 23 enigma",
  42: "the answer to life, the universe, and everything",
  67: "six seven",
  69: "nice",
  100: "hundo P",
  111: "angel number",
  222: "angel number",
  333: "angel number",
  404: "not found",
  420: "blaze it",
  666: "number of the beast",
  777: "jackpot",
  911: "calling 911",
  1337: "leet",
  1729: "the Hardy–Ramanujan number",
  1234: "easy as 1-2-3-4",
  31415: "π (approximately)",
};

export function RevealResult({
  ep,
  rarity,
  badges,
  number,
  isAlreadyRolled,
  reelSettled = true,
  children,
}: RevealResultProps) {
  const [phase, setPhase] = useState<Phase>("pause");
  const [displayedEp, setDisplayedEp] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const reduced = useReducedMotion();
  // slideInDone gates the badge-deal phase so cards only start flipping once
  // they're actually visible. With reduced motion the slide is instant, so
  // it's "done" from the start.
  const [slideInDone, setSlideInDone] = useState(reduced);

  // Phase 0: pause → then start EP count-up. Hold the pause until the reel
  // has finished spinning so the EP count and the slide-in don't fight the
  // reel for attention.
  useEffect(() => {
    if (!reelSettled) return;
    setPhase("ep");
  }, [reelSettled]);

  // Phase 1: EP count-up.
  useEffect(() => {
    if (phase !== "ep") return;
    const start = performance.now();
    const duration = 1200;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayedEp(Math.round(ep * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayedEp(ep);
        setPhase("rarity");
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, ep]);

  // Phase 2: rarity → badges.
  useEffect(() => {
    if (phase !== "rarity") return;
    const t = setTimeout(() => setPhase("badges"), 600);
    return () => clearTimeout(t);
  }, [phase]);

  // Phase 3: reveal badges one by one. Wait for the slide-in to complete
  // so the cards are actually visible when they start flipping.
  useEffect(() => {
    if (phase !== "badges") return;
    if (!slideInDone) return;
    if (revealedCount >= badges.length) return;
    const t = setTimeout(
      () => {
        setRevealedCount((v) => v + 1);
        playCardFlip();
      },
      revealedCount === 0 ? 400 : 250,
    );
    return () => clearTimeout(t);
  }, [phase, slideInDone, revealedCount, badges.length]);

  // The badge deal animation runs the same way for both freshly-rolled and
  // already-rolled readings; only the header label differs.
  const effectiveRevealedCount = revealedCount;

  const showEp = phase !== "pause";
  const showRarity = phase === "rarity" || phase === "badges";
  const showBadgesHeader = phase === "badges" && effectiveRevealedCount > 0;
  // Action buttons pop in once the very last badge has been dealt.
  const allDone = badges.length > 0 && effectiveRevealedCount >= badges.length;

  // Fetch today's stats (for percentile display) once badges are done.
  // Non-blocking — if it fails, the UI just omits the percentile line.
  const [stats, setStats] = useState<TodayStats | null>(null);
  useEffect(() => {
    if (!allDone) return;
    let cancelled = false;
    fetchTodayStats(ep).then((s) => {
      if (!cancelled && s) setStats(s);
    });
    return () => { cancelled = true; };
  }, [allDone, ep]);

  const animDuration = reduced ? 0.01 : 0.55;
  // Slide-in from under the reel. Y-offset is chosen so the entire deck
  // (header + first card slot) is hidden above the clip initially.
  const slideInY = -140;
  const slideInDuration = reduced ? 0 : 1.4;
  // Second downward movement: when the copy/share buttons pop in, the
  // stack shifts down a bit more so the buttons feel like they "claimed"
  // the space above the deck.
  const buttonPushY = 48;
  const buttonPushDuration = reduced ? 0.01 : 0.4;

  // Copy / share text composition. Mimics the canonical "stat card" feel:
  // number on top, rarity + tier, a short list of earned badges, total EP,
  // and a link back to the app.
  function buildShareText(n: number): string {
    const rarityEmoji = RARITY_EMOJI[rarity] ?? "⬜";
    // Use real percentile from AppView if available; otherwise fall back
    // to the static rarity-tier estimate.
    const percentileStr = stats
      ? stats.percentile.toFixed(stats.percentile < 10 ? 1 : 0)
      : RARITY_PERCENTILE[rarity] ?? "—";
    const epStr = ep.toLocaleString();
    const meme = NUMBER_MEMES[n];

    const lines: string[] = [];
    lines.push(`RANDle 🎲 ${n}`);
    if (meme) {
      lines.push("");
      lines.push(`"${meme}"`);
    }
    lines.push("");
    lines.push(`${rarityEmoji} ${rarity.toUpperCase()} • Top ${percentileStr}%`);

    const maxBadges = 3;
    const visible = badges.slice(0, maxBadges);
    if (visible.length > 0) {
      lines.push("");
      for (const b of visible) {
        lines.push(`🟩 ${b.icon} ${b.name}`);
      }
      if (badges.length > maxBadges) {
        lines.push(`+${badges.length - maxBadges} more`);
      }
    }

    lines.push("");
    lines.push(`${epStr} EP`);
    if (stats && stats.total_rolls > 0) {
      lines.push(`rarer than ${percentileStr}% of today's rolls`);
    }
    return lines.join("\n");
  }

  const handleCopy = async () => {
    if (number == null) return;
    const text = buildShareText(number);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Copy failed:", e);
    }
  };

  const handleShare = () => {
    if (number == null) return;
    const text = buildShareText(number);
    const url = `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Top: settled reel + status line + EP/rarity */}
      <div className="flex flex-col items-center gap-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
          {isAlreadyRolled ? "· readout locked ·" : "· signal locked ·"}
        </p>

        {/* The settled reel persists here — passed in as children */}
        {children}

        {/* EP + rarity row */}
        <div
          className="flex items-center gap-3 text-sm transition-opacity duration-500"
          style={{ opacity: showEp ? 1 : 0 }}
        >
          <span className="font-mono font-medium text-foreground">
            {displayedEp} EP
          </span>
          <span
            className="capitalize text-muted-foreground transition-opacity duration-500"
            style={{ opacity: showRarity ? 1 : 0 }}
          >
            · {rarity}
          </span>
          {stats && stats.total_rolls > 0 && allDone && (
            <span className="text-xs text-muted-foreground">
              · rarer than {stats.percentile.toFixed(stats.percentile < 10 ? 1 : 0)}% of today
            </span>
          )}
        </div>
      </div>

      {/* Action buttons — pop in once every badge has been dealt. Always
          present in the layout so the badges below stay pushed down. */}
      <motion.div
        initial={false}
        animate={allDone ? "visible" : "hidden"}
        variants={{
          hidden: { opacity: 0, y: -8, scale: 0.95 },
          visible: { opacity: 1, y: 0, scale: 1 },
        }}
        transition={{
          duration: reduced ? 0.01 : 0.4,
          ease: [0.34, 1.56, 0.64, 1],
        }}
        className={`flex items-center z-10 gap-3 ${allDone ? "" : "pointer-events-none"}`}
        aria-hidden={!allDone}
      >
        <Button
          variant="outline"
          size="default"
          onClick={() => void handleCopy()}
          disabled={number == null}
          aria-hidden={!allDone}
          tabIndex={allDone ? 0 : -1}
        >
          {copied ? (
            <IconCheck data-icon="inline-start" />
          ) : (
            <IconClipboardCopy data-icon="inline-start" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button
          variant="outline"
          size="default"
          onClick={handleShare}
          disabled={number == null}
          aria-hidden={!allDone}
          tabIndex={allDone ? 0 : -1}
        >
          <IconBrandBluesky data-icon="inline-start" />
          Share to Bluesky
        </Button>
      </motion.div>

      {/* Below: card deck + dealt stack.
          The overflow-hidden wrapper is the "window" the stack slides into;
          the motion.div starts shifted up so the deck is hidden above the
          window. It only animates down to y=0 once the reel has settled,
          so the slide-in lands right after the reel finishes. */}
      <div className="-mt-10 w-full max-w-sm overflow-hidden">
        {/* Outer motion.div: the slide-in from under the reel (first move down). */}
        <motion.div
          initial={reduced ? false : { y: slideInY }}
          animate={{ y: reelSettled ? 0 : slideInY }}
          transition={{ duration: slideInDuration, ease: EASE }}
          onAnimationComplete={() => setSlideInDone(true)}
        >
          {/* Inner motion.div: a second downward push when the copy/share
              buttons pop in (second move down). Nested so the two movements
              compose without overwriting each other. */}
          <motion.div
            initial={false}
            animate={{ y: allDone ? buttonPushY : 0 }}
            transition={{ duration: buttonPushDuration, ease: EASE }}
          >
            <p
              className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground transition-opacity duration-500"
              style={{ opacity: showBadgesHeader ? 1 : 0 }}
            >
              Badges · {effectiveRevealedCount}/{badges.length}
            </p>

            {/*
              Card-deal container.
              - perspective on the container gives the 3D context for each card's rotateX.
              - min-height reserves space for the deck slot (top) plus every dealt slot.
              - All cards are absolutely positioned and driven by motion; their target
                y / rotateX / opacity is computed below from revealedCount.
            */}
            <div
              className="relative"
              style={{
                perspective: 1200,
                minHeight: (badges.length + 1) * (CARD_HEIGHT + GAP),
              }}
            >
              {badges.map((b, i) => {
                const isDealt = i < effectiveRevealedCount;
                // Position in the deck stack: 0 = top of deck, 1 = next, etc.
                // -1 for dealt cards (unused for positioning).
                const stackIndex = isDealt ? -1 : i - effectiveRevealedCount;

                // Deck is anchored at y=0 (top of container). Dealt cards live
                // below it, in a stack with the newest at slot 1 (closest to the
                // deck) and older cards pushed further down. Slot for card i is
                // (revealedCount - i), so the just-dealt card lands at slot 1 and
                // every previously-dealt card shifts down one slot.
                //
                // Special case: when every card is dealt (no deck left), we shift
                // the whole stack up by one slot so the newest lands at y=0 — the
                // exact spot the deck just vacated. The last card then simply
                // flips in place instead of sliding down into empty space.
                const noDeck = effectiveRevealedCount >= badges.length;
                const slotOffset = noDeck ? 1 : 0;
                const targetY = isDealt
                  ? (effectiveRevealedCount - i - slotOffset) *
                    (CARD_HEIGHT + GAP)
                  : stackIndex * DECK_OFFSET;

                // Face-down while in the deck (rotateX 180°). Face-up once dealt.
                const targetRotateX = isDealt ? 0 : 180;
                // Only the top of the deck is visible; the rest of the stack is
                // hidden behind it (the small DECK_OFFSET still shows their edges).
                const targetOpacity = isDealt ? 1 : stackIndex === 0 ? 1 : 0;
                const targetScale = isDealt ? 1 : 0.96;
                // Dealt cards stack above the deck in z-order so a card being
                // dealt doesn't dip behind its own deck during the slide-down.
                const zIndex = isDealt ? 100 + i : 10 + (badges.length - i);

                return (
                  <motion.div
                    key={b.id}
                    className="absolute left-0 right-0 top-0 will-change-transform"
                    style={{ zIndex }}
                    initial={{
                      // On first paint, every card starts in the deck, stacked.
                      y: i * DECK_OFFSET,
                      rotateX: 180,
                      opacity: i === 0 ? 1 : 0,
                      scale: 0.96,
                    }}
                    animate={{
                      y: targetY,
                      rotateX: targetRotateX,
                      opacity: targetOpacity,
                      scale: targetScale,
                    }}
                    transition={{ duration: animDuration, ease: EASE }}
                  >
                    {isDealt ? <BadgeRow badge={b} /> : <CardBack />}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

/** Face-down card. Visible only as the top of the deck stack. */
function CardBack() {
  return (
    <div className="flex h-16 items-center justify-center rounded-lg border border-border/50 bg-gradient-to-br from-card/60 to-card/20">
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/40">
        RANDle
      </span>
    </div>
  );
}

function BadgeRow({ badge }: { badge: BadgeDetail }) {
  return (
    <div className="flex h-16 items-start gap-2.5 rounded-lg border border-border/50 bg-card/50 p-2.5">
      <BadgeIcon
        id={badge.id}
        emoji={badge.icon}
        rarity={badge.rarity}
        size={20}
        className="mt-0.5"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-foreground">
          {badge.name}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {badge.desc}
        </span>
        {badge.matchDetail && badge.matchDetail !== badge.desc && (
          <span className="truncate text-xs text-primary">
            {badge.matchDetail}
          </span>
        )}
      </div>
      <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
        <Badge variant="outline" className="text-[10px] capitalize">
          {badge.rarity}
        </Badge>
        <span className="font-mono text-[10px] text-muted-foreground">
          {badge.ep.toLocaleString()} EP
        </span>
      </div>
    </div>
  );
}
