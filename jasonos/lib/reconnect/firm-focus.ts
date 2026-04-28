import type { ReconnectContact } from "./types";

export type FocusLabel = "anchor" | "secondary" | "tertiary" | "bench" | null;

export function focusLabel(rank: number | null | undefined): FocusLabel {
  if (rank == null) return null;
  if (rank === 1) return "anchor";
  if (rank === 2) return "secondary";
  if (rank === 3) return "tertiary";
  return "bench";
}

export function focusBadgeText(rank: number | null | undefined): string | null {
  switch (focusLabel(rank)) {
    case "anchor":    return "ANCHOR";
    case "secondary": return "2nd";
    case "tertiary":  return "3rd";
    case "bench":     return `#${rank}`;
    default:          return null;
  }
}

export function isAnchor(c: Pick<ReconnectContact, "firm_focus_rank">): boolean {
  return c.firm_focus_rank === 1;
}

export function isBench(c: Pick<ReconnectContact, "firm_focus_rank">): boolean {
  return (c.firm_focus_rank ?? 0) > 3;
}
