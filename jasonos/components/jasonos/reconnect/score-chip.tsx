import { cn } from "@/lib/utils";

export function ScoreChip({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "num-mono inline-flex h-7 items-center rounded-md border bg-background px-2 text-xs font-semibold",
        score >= 95
          ? "border-red-500/30 text-red-300"
          : score >= 90
          ? "border-orange-400/30 text-orange-300"
          : "border-border text-foreground",
        className
      )}
    >
      {score} / 100
    </span>
  );
}
