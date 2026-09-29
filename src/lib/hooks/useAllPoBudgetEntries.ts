"use client";

import { useEffect, useState } from "react";
import {
  useLazyGetPoBudgetListQuery,
  type PoBudgetRow,
  type PoBudgetType,
} from "@/lib/api/po-budget/api";

const PAGE_SIZE = 100;

type SharedState = {
  items: PoBudgetRow[];
  total: number | null;
  isFetching: boolean;
  isFetchingMore: boolean;
};

type CacheEntry = {
  state: SharedState;
  listeners: Set<() => void>;
  started: boolean;
};

// Cached per (type, budgetSubtype) combination - shared by every component
// using the same params, so switching tabs back and forth doesn't re-fetch,
// and multiple components requesting the same list don't each run their own
// independent fetch-everything loop (same issue as the raw material master
// dropdown had before).
const cache = new Map<string, CacheEntry>();

function keyFor(type: PoBudgetType, budgetSubtype?: string) {
  return `${type}::${budgetSubtype ?? ""}`;
}

function getEntry(key: string): CacheEntry {
  let entry = cache.get(key);
  if (!entry) {
    entry = {
      state: { items: [], total: null, isFetching: true, isFetchingMore: false },
      listeners: new Set(),
      started: false,
    };
    cache.set(key, entry);
  }
  return entry;
}

function setState(entry: CacheEntry, patch: Partial<SharedState>) {
  entry.state = { ...entry.state, ...patch };
  entry.listeners.forEach((listener) => listener());
}

async function loadAllOnce(
  entry: CacheEntry,
  trigger: ReturnType<typeof useLazyGetPoBudgetListQuery>[0],
  type: PoBudgetType,
  budgetSubtype: string | undefined,
) {
  if (entry.started) return;
  entry.started = true;

  let page = 1;
  let collected: PoBudgetRow[] = [];
  let knownTotal = Infinity;

  while (collected.length < knownTotal) {
    const result = await trigger({ type, page, limit: PAGE_SIZE, budgetSubtype })
      .unwrap()
      .catch(() => null);
    if (!result) break;

    const batch = result.data ?? [];
    collected = collected.concat(batch);
    knownTotal = result.pagination?.total ?? collected.length;
    setState(entry, {
      items: collected,
      total: knownTotal,
      isFetching: false,
      isFetchingMore: collected.length < knownTotal,
    });

    if (batch.length === 0) break; // safety: avoid infinite loop
    page += 1;
  }
  setState(entry, { isFetchingMore: false });
}

/**
 * Loads the full PO/PR Budget list for a given (type, budgetSubtype)
 * incrementally - 100 records per request, appended as each batch arrives -
 * instead of stopping at whatever the first page (limit=100) returned.
 * The dropdown becomes usable as soon as the first page lands; remaining
 * pages keep loading quietly in the background.
 */
export function useAllPoBudgetEntries(
  type: PoBudgetType,
  budgetSubtype?: string,
  enabled = true,
) {
  const [trigger] = useLazyGetPoBudgetListQuery();
  const key = keyFor(type, budgetSubtype);

  const [, forceRender] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const entry = getEntry(key);
    const listener = () => forceRender((n) => n + 1);
    entry.listeners.add(listener);
    loadAllOnce(entry, trigger, type, budgetSubtype);
    return () => {
      entry.listeners.delete(listener);
    };
  }, [key, trigger, type, budgetSubtype, enabled]);

  return getEntry(key).state;
}
