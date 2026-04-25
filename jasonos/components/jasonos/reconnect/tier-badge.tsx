import { cn } from "@/lib/utils";
import type { RecruiterTier } from "@/lib/reconnect/types";

const TIER_CLASS: Record<RecruiterTier, string> = {
  "TIER 1": "bg-red-600 text-white",
  "TIER 2": "bg-orange-500 text-white",
  "TIER 3": "bg-yellow-400 text-zinc-900",
  "TIER 4": "bg-zinc-700 text-zinc-300",
};

export function TierBadge({
  tier,
  className,
}: {
  tier: RecruiterTier;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded px-2 text-[10px] font-bold uppercase tracking-wider",
        TIER_CLASS[tier],
        className
      )}
    >
      {tier}
    </span>
  );
}
