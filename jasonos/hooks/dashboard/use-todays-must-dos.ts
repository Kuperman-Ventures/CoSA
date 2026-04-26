// Source-of-truth hook for the day's Must-Dos. Backed by the in-repo mock
// today; swap the inner `fetcher` to /api/bna once the engine is online.

"use client";

import { useMemo } from "react";
import { MOCK_BNA, MOCK_CARDS } from "@/lib/mock/data";
import type { ActionCard, BestNextActionItem } from "@/lib/types";

export interface MustDoItem extends BestNextActionItem {
  card: ActionCard;
}

export function useTodaysMustDos(): { items: MustDoItem[]; configured: boolean } {
  const items = useMemo<MustDoItem[]>(() => {
    return MOCK_BNA.map((b) => {
      const card = MOCK_CARDS.find((c) => c.id === b.card_id);
      return card ? { ...b, card } : null;
    }).filter(Boolean) as MustDoItem[];
  }, []);
  return { items, configured: false };
}
