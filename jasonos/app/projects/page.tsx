import { MOCK_PROJECTS, MOCK_TODOS } from "@/lib/mock/data";
import { TrackPill } from "@/components/jasonos/track-pill";
import { Button } from "@/components/ui/button";
import { Sparkles, Target } from "lucide-react";
import { format } from "date-fns";

export const metadata = { title: "Projects · JasonOS" };

export default function ProjectsPage() {
  return (
    <div className="mx-auto max-w-[1200px] space-y-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Goal → Plan decomposer output. Each project groups sequenced to-dos.
          </p>
        </div>
        <Button size="sm" className="gap-2">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          New project from goal
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {MOCK_PROJECTS.map((p) => {
          const todos = MOCK_TODOS.filter((t) => t.project_id === p.id);
          return (
            <article
              key={p.id}
              className="jos-card-enter rounded-xl border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <TrackPill track={p.track} />
                  <h2 className="mt-2 text-base font-semibold tracking-tight">
                    {p.name}
                  </h2>
                </div>
                {p.target_date ? (
                  <div className="text-right text-[11px] text-muted-foreground">
                    target
                    <div className="num-mono text-foreground">
                      {format(new Date(p.target_date), "MMM d")}
                    </div>
                  </div>
                ) : null}
              </div>
              {p.goal_statement ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {p.goal_statement}
                </p>
              ) : null}

              <div className="mt-3">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Success criteria
                </div>
                <ul className="mt-1 space-y-0.5">
                  {p.success_criteria.map((s) => (
                    <li
                      key={s}
                      className="flex items-start gap-1.5 text-[12px] text-muted-foreground"
                    >
                      <Target className="mt-0.5 h-3 w-3 text-foreground/60" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-3 border-t pt-3">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Sequenced to-dos · {todos.length}
                </div>
                <ul className="mt-1.5 space-y-1.5">
                  {todos.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between gap-2 text-[12px]"
                    >
                      <span>{t.title}</span>
                      {t.due_date ? (
                        <span className="num-mono text-[10px] text-muted-foreground">
                          {format(new Date(t.due_date), "MMM d")}
                        </span>
                      ) : null}
                    </li>
                  ))}
                  {todos.length === 0 ? (
                    <li className="text-[11px] text-muted-foreground">No to-dos yet.</li>
                  ) : null}
                </ul>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
