import { Sparkles } from "lucide-react";
import { format } from "date-fns";

export function DailyWrap() {
  const today = format(new Date(), "EEEE, MMM d");
  return (
    <section className="rounded-xl border bg-card p-4">
      <header className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-amber-400" />
        <h2 className="text-sm font-semibold tracking-tight">Daily Wrap</h2>
        <span className="text-[11px] text-muted-foreground">· {today} · auto-generated 6pm</span>
      </header>
      <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            What got actioned
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            <span className="text-foreground">7 cards</span> across Advisors (3),
            Ventures (2), Job Search (1), Personal (1). Two Sprint follow-ups sent;
            encoreOS onboarding bug fixed and shipped.
          </p>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            What got dismissed
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            <span className="text-foreground">4 Crunchbase cards</span> all
            tagged <span className="text-amber-300">&ldquo;Not ICP&rdquo;</span>.
            Pattern: Series A SaaS &lt;$10M ARR — consider tightening filter.
          </p>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            On deck for tomorrow
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Anthropic interview prep (10am Wed). Patternlabs proposal follow-up.
            Mom&rsquo;s birthday flowers (order by Thu).
          </p>
        </div>
      </div>
    </section>
  );
}
