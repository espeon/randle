import type { Icon as TablerIcon } from "@tabler/icons-react";
import { BADGE_ICONS } from "@/lib/badge-icons";

/** Rarity → Tailwind text color class. Applied to the icon stroke. */
const RARITY_COLORS: Record<string, string> = {
  common: "text-amber-500",
  uncommon: "text-red-500",
  rare: "text-emerald-500",
  epic: "text-yellow-400",
  legendary: "text-sky-400",
  mythic: "text-fuchsia-500",
};

interface BadgeIconProps {
  id: string;
  emoji: string;
  rarity?: string;
  className?: string;
  size?: number;
}

/**
 * Renders a badge icon. Uses a Tabler vector icon when available,
 * falling back to the emoji string from BADGE_INFO. Icons are colored
 * by rarity when a rarity string is provided.
 */
export function BadgeIcon({ id, emoji, rarity, className, size = 20 }: BadgeIconProps) {
  const Icon: TablerIcon | undefined = BADGE_ICONS[id];
  const colorClass = rarity ? (RARITY_COLORS[rarity] ?? "text-primary") : "text-primary";
  if (Icon) {
    return <Icon className={`${colorClass} ${className ?? ""}`} size={size} stroke={1.8} />;
  }
  return (
    <span className={`${colorClass} ${className ?? ""}`} style={{ fontSize: size }} aria-hidden>
      {emoji}
    </span>
  );
}
