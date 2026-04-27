"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  hint?: string;
  action?: { label: string; href: string };
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<EmptyStateProps["size"]>, string> = {
  sm: "p-3 text-xs",
  md: "p-4 text-sm",
  lg: "p-6 text-sm",
};

export function EmptyState({
  title,
  hint,
  action,
  size = "md",
  className,
}: EmptyStateProps) {
  const actionButton = action?.href === "#tell-claude" ? (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="mt-3"
      onClick={() =>
        window.dispatchEvent(new CustomEvent("jasonos:open-tell-claude"))
      }
    >
      {action.label}
    </Button>
  ) : action ? (
    <Button
      size="sm"
      variant="outline"
      className="mt-3"
      render={<Link href={action.href} />}
    >
      {action.label}
    </Button>
  ) : null;

  return (
    <div
      className={cn(
        "rounded-xl border border-dashed bg-muted/20 text-center text-muted-foreground",
        SIZE_CLASS[size],
        className
      )}
    >
      <div className="font-medium text-foreground/80">{title}</div>
      {hint ? <p className="mx-auto mt-1 max-w-md leading-relaxed">{hint}</p> : null}
      {actionButton}
    </div>
  );
}
