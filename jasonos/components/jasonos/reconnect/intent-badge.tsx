import { Badge } from "@/components/ui/badge";
import type { Intent } from "@/lib/triage/types";

const INTENT_BADGE: Record<Intent, { label: string; className: string }> = {
  door: {
    label: "Door",
    className: "border-sky-400/30 bg-sky-400/15 text-sky-200",
  },
  pipeline: {
    label: "Pipeline",
    className: "border-emerald-400/30 bg-emerald-400/15 text-emerald-200",
  },
  role_inquiry: {
    label: "Role",
    className: "border-violet-400/30 bg-violet-400/15 text-violet-200",
  },
  intel: {
    label: "Intel",
    className: "border-amber-400/30 bg-amber-400/15 text-amber-200",
  },
  warm: {
    label: "Warm",
    className: "border-slate-400/30 bg-slate-400/15 text-slate-200",
  },
};

export function IntentBadge({
  intent,
  personalGoal,
}: {
  intent: Intent | null | undefined;
  personalGoal?: string | null;
}) {
  if (!intent) return null;
  const config = INTENT_BADGE[intent];

  return (
    <Badge
      variant="outline"
      className={`h-5 rounded-full px-2 text-[10px] font-semibold uppercase tracking-wide ${config.className}`}
      title={personalGoal || undefined}
    >
      {config.label}
    </Badge>
  );
}
