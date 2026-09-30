/**
 * Shared refresh signal for contract-derived views (Dashboard KPI cards,
 * All Documents list). Bumped whenever an upload is registered so any
 * subscribed view re-fetches and re-aggregates its data.
 *
 * Same-tab fanout is in-memory via a listener set so it is synchronous and
 * survives `localStorage` being unavailable / quota-exceeded. Cross-tab
 * fanout uses a sentinel `localStorage` key: writing the new counter fires a
 * `storage` event in sibling tabs, where this module mirrors the value into
 * its local counter and fans out to its own listeners.
 *
 * React consumers subscribe via `useContractsRefreshKey` (built on
 * `useSyncExternalStore`); non-React producers call `bumpContractsRefresh`.
 */

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "claw-contracts-refresh";

let counter = 0;
const listeners = new Set<() => void>();

function fanout(): void {
  // Snapshot the set so listeners that mutate the listener set (e.g. an
  // effect that unsubscribes during render) don't trip the iterator.
  for (const notify of Array.from(listeners)) notify();
}

function readCounterFromStorage(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeCounterToStorage(next: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // localStorage may be unavailable / quota-exceeded — same-tab fanout
    // still works against the in-memory counter.
  }
}

/**
 * Bump the shared refresh key. Same-tab subscribers fan out immediately;
 * sibling tabs pick up the change via the `storage` event.
 */
export function bumpContractsRefresh(): void {
  counter += 1;
  writeCounterToStorage(counter);
  fanout();
}

/** Subscribe a component to the shared refresh key. */
export function useContractsRefreshKey(): number {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
      };
    },
    () => counter,
    () => counter
  );
}

// Cross-tab: mirror sibling-tab writes into the local counter so fanout fires.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    const next = readCounterFromStorage();
    if (next !== counter) {
      counter = next;
      fanout();
    }
  });
}
