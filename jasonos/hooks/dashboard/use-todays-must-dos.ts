"use client";

import { useEffect, useState } from "react";
import type { ActionCard, BestNextActionItem } from "@/lib/types";

export interface MustDoItem extends BestNextActionItem {
  card: ActionCard;
}

export function useTodaysMustDos(): { items: MustDoItem[]; configured: boolean } {
  const [items, setItems] = useState<MustDoItem[]>([]);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/must-dos")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { items?: MustDoItem[]; configured?: boolean } | null) => {
        if (cancelled) return;
        setItems(json?.items ?? []);
        setConfigured(Boolean(json?.configured));
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setConfigured(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { items, configured };
}
