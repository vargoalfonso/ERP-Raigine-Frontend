"use client";

import { useEffect, useState } from "react";
import {
  useLazyGetRawMaterialMastersQuery,
  type RawMaterialMaster,
} from "@/lib/api/raw-material-master/api";

const PAGE_SIZE = 100;

type SharedState = {
  items: RawMaterialMaster[];
  total: number | null;
  isFetching: boolean;
  isFetchingMore: boolean;
};

// Module-level (singleton) state: shared by every component that calls
// useAllRawMaterialMasters(), so the paginated fetch runs exactly ONCE for
// the whole app session - not once per mounted MaterialSpecEditor. Without
// this sharing, a BOM with a parent + several child parts would spin up one
// independent fetch-everything loop per editor, all firing at once, which
// is why loading could feel like it never finished.
let state: SharedState = {
  items: [],
  total: null,
  isFetching: true,
  isFetchingMore: false,
};
const listeners = new Set<() => void>();
let started = false;

function setState(patch: Partial<SharedState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

async function loadAllOnce(
  trigger: ReturnType<typeof useLazyGetRawMaterialMastersQuery>[0],
) {
  if (started) return;
  started = true;

  let page = 1;
  let collected: RawMaterialMaster[] = [];
  let knownTotal = Infinity;

  while (collected.length < knownTotal) {
    const result = await trigger({ page, limit: PAGE_SIZE })
      .unwrap()
      .catch(() => null);
    if (!result) break;

    collected = collected.concat(result.items);
    knownTotal = result.total ?? collected.length;
    setState({
      items: collected,
      total: knownTotal,
      isFetching: false,
      isFetchingMore: collected.length < knownTotal,
    });

    if (result.items.length === 0) break; // safety: avoid infinite loop
    page += 1;
  }
  setState({ isFetchingMore: false });
}

/**
 * Loads the full Raw Material Master list incrementally (100 records per
 * request, appended as each batch arrives) - shared by every component
 * that uses this hook. The dropdown becomes usable as soon as the first
 * page lands; remaining pages keep loading quietly in the background.
 */
export function useAllRawMaterialMasters() {
  const [trigger] = useLazyGetRawMaterialMastersQuery();
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    listeners.add(listener);
    loadAllOnce(trigger);
    return () => {
      listeners.delete(listener);
    };
  }, [trigger]);

  return state;
}
