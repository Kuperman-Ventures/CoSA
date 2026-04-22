"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, Sparkles } from "lucide-react";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/projects", label: "Projects" },
  { href: "/todos", label: "To-Dos" },
  { href: "/contacts", label: "Contacts" },
  { href: "/settings", label: "Settings" },
];

export function TopNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 glass hairline border-b">
      <div className="mx-auto flex h-12 max-w-[1800px] items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-foreground text-background text-[10px] font-bold">
            J
          </span>
          <span className="text-sm">JasonOS</span>
          <span className="ml-2 hidden rounded-sm bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground sm:inline">
            v0.1
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {NAV.map((n) => {
            const active =
              n.href === "/" ? pathname === "/" : pathname?.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 transition-colors",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("jasonos:open-tell-claude"))
            }
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            Tell Claude
            <kbd className="ml-2 inline-flex items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              <Command className="h-3 w-3" /> K
            </kbd>
          </Button>
        </div>
      </div>
    </header>
  );
}
