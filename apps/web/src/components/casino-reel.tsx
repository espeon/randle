import {
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
} from "react";

/**
 * Multi-digit slot machine.
 *
 * Each column is a vertical strip of random digits (0–9) repeated ~8 times,
 * ending on the target digit. When mounted, each strip translates upward
 * so the target lands in the viewport with a long cubic-bezier ease,
 * staggered so columns settle left → right.
 *
 * Adapted from a single-digit reference into a 7-reel grid with Tailwind
 * styling and cascading delays.
 */

const ITEM_H = 112; // px — must match the `h-28` on each reel item
const REPEAT = 8; // cycles of 0–9 in each strip
const STRIP_LEN = REPEAT * 10; // 80 random digits before the target
const MAX_DIGITS = 7;

interface CasinoReelProps {
  /** The full number to display once all reels stop. */
  target: number;
  /** Called once the last column finishes its spin. */
  onSpinEnd: () => void;
}

export function CasinoReel({ target, onSpinEnd }: CasinoReelProps) {
  const padded = String(target).padStart(MAX_DIGITS, "0").slice(-MAX_DIGITS);
  const digits = padded.split("").map(Number);

  const handleSettled = useCallback(() => {
    onSpinEnd();
  }, [onSpinEnd]);

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        className="flex gap-2 rounded-2xl border-2 border-primary/30 bg-card p-3"
        style={{ boxShadow: "0 0 64px oklch(0.68 0.21 42 / 0.25), 0 0 16px oklch(0.68 0.21 42 / 0.18)" }}
      >
        {digits.map((digit, col) => (
          <Reel
            key={col}
            target={digit}
            index={col}
            isLast={col === digits.length - 1}
            onSettled={handleSettled}
          />
        ))}
      </div>
    </div>
  );
}

function Reel({
  target,
  index,
  isLast,
  onSettled,
}: {
  target: number;
  index: number;
  isLast: boolean;
  onSettled: () => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);

  // Build the strip once: [random digits...] + [target]
  const strip = useRef<number[] | null>(null);
  if (strip.current === null) {
    const random = Array.from({ length: STRIP_LEN }, () =>
      Math.floor(Math.random() * 10),
    );
    strip.current = [...random, target];
  }
  const items = strip.current;
  const totalHeight = items.length * ITEM_H;
  const delay = index * 350; // ms — stagger each column
  const duration = 3000; // ms — slow, dramatic spin

  // Run the animation once on mount.
  useLayoutEffect(() => {
    const el = stripRef.current;
    if (!el) return;

    // Reset to top instantly.
    el.style.transition = "none";
    el.style.transform = "translateY(0px)";
    // Force reflow so the reset paints before the spin transition.
    void el.offsetHeight;

    requestAnimationFrame(() => {
      el.style.transition = `transform ${duration}ms cubic-bezier(0.08, 0.62, 0.15, 1) ${delay}ms`;
      el.style.transform = `translateY(-${totalHeight - ITEM_H}px)`;
    });
    // totalHeight and delay are stable per mount (derived from strip).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only the last column fires onSettled when its transition ends.
  useEffect(() => {
    if (!isLast) return;
    const el = stripRef.current;
    if (!el) return;

    const handler = (e: TransitionEvent) => {
      if (e.propertyName !== "transform") return;
      onSettled();
    };
    el.addEventListener("transitionend", handler);
    return () => el.removeEventListener("transitionend", handler);
  }, [isLast, onSettled]);

  return (
    <div
      className="relative h-28 w-16 overflow-hidden rounded-lg bg-muted/40"
    >
      <div ref={stripRef} className="will-change-transform">
        {items.map((num, i) => (
          <div
            key={i}
            className="flex h-28 w-16 items-center justify-center font-mono text-5xl font-bold tabular-nums text-primary"
          >
            {num}
          </div>
        ))}
      </div>
      {/* Glass gradient overlays for depth */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-7 bg-gradient-to-b from-card to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-card to-transparent" />
    </div>
  );
}
