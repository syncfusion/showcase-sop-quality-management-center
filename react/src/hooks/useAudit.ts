import { useSyncExternalStore } from "react";
import { _setAuditNotifier, listAudit, type AuditEntry } from "../services/auditStore";

/**
 * Per-contract subscriber set. Each contract gets its own listener pool so a
 * route subscribing to `contract:A` isn't woken up by writes to `contract:B`.
 */
const contractSubs = new Map<string, Set<() => void>>();

/** Global notify-all fan-out used by `subscribe` so `useSyncExternalStore` can
 *  use a single subscription callback regardless of the contract. */
const globalListeners = new Set<() => void>();

function ensureContractSet(contractId: string): Set<() => void> {
  let set = contractSubs.get(contractId);
  if (!set) {
    set = new Set();
    contractSubs.set(contractId, set);
  }
  return set;
}

/**
 * Notify every listener subscribed to `contractId` plus the global pool. The
 * store calls this after every successful `write`.
 */
export function notifyAuditChange(contractId: string): void {
  ensureContractSet(contractId).forEach((cb) => cb());
  globalListeners.forEach((cb) => cb());
}

/** Subscribe to `contractId` changes. Returns the unsubscribe function. */
export function subscribeAudit(
  contractId: string,
  cb: () => void
): () => void {
  const set = ensureContractSet(contractId);
  set.add(cb);
  globalListeners.add(cb);
  return () => {
    set.delete(cb);
    globalListeners.delete(cb);
  };
}

/**
 * Reactive read of the audit log for a contract. Re-renders whenever ANY
 * `logAction` (or `clearAudit`) for the same contract runs — mirrors how
 * `useSyncExternalStore` is meant to be used with module-scoped stores.
 *
 * Returns `[]` during SSR (the third argument to `useSyncExternalStore`) and
 * a stable empty array between renders when there's no entry yet.
 */
export function useAudit(contractId: string): AuditEntry[] {
  const subscribe = (cb: () => void) => subscribeAudit(contractId, cb);
  const getSnapshot = () => listAudit(contractId);
  const getServerSnapshot = (): AuditEntry[] => AUDIT_SSR_EMPTY;
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Singleton empty array for SSR snapshots — keeps referential stability. */
const AUDIT_SSR_EMPTY: AuditEntry[] = [];

// Install the notifier so `write` in the store wakes subscribers. The call
// runs once per module-import; safe to repeat (last write wins).
_setAuditNotifier(notifyAuditChange);