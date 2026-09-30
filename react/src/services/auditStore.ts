/**
 * In-memory (+ sessionStorage backup) per-contract audit log.
 *
 * Mirrors `editedDocStore` so the audit timeline route can use the exact same
 * source-of-truth model as the version list: append-only `AuditEntry[]` keyed
 * by `contractId`, with `sessionStorage` as the reload-survival backup that
 * gets wiped on hard reload / tab close (matching the "session-scoped only"
 * promise for the demo).
 */

export type AuditCategory = "version" | "feature" | "permission";

/** Audit log entry shape. Field-level details live in `payload` so consumers
 *  can render summaries without re-querying the version / assignment state. */
export interface AuditEntry {
  /** Stable per-contract monotonic id (`a1`, `a2`, …). */
  id: string;
  contractId: string;
  /** Bucket for filtering + icon selection on the Audit Timeline page. */
  category: AuditCategory;
  /** Machine-readable action key (`save`, `enable-comments`, `assign`, …). */
  action: string;
  /** Pre-rendered summary line shown in the timeline row. */
  summary: string;
  /** Free-form actor label (e.g. `Adam Bennett`, `Legal`, `Finance`). */
  actor: string;
  /** ISO timestamp the entry was logged at. */
  createdAt: string;
  /** Optional structured detail for future filter chips / detail drawers. */
  payload?: Record<string, unknown>;
}

/**
 * Forward-declared notify hook used by `write` to wake the `useAudit` hook.
 * The hook re-imports from this module via the circular `useAudit` import, but
 * we swallow that with a dynamic import-style late bind (functions are
 * hoisted + reassigned by `useAudit.ts`).
 *
 * Kept as a single export so future tooling (tests, dev overlays) can also
 * subscribe without going through React.
 */
type NotifyFn = (contractId: string) => void;
let notify: NotifyFn = () => {
  // Default no-op so SSR / non-React callers don't observe React wiring.
};

/** Internal: the audit hook calls this once on import to install its notify. */
export function _setAuditNotifier(fn: NotifyFn): void {
  notify = fn;
}

const memory = new Map<string, AuditEntry[]>();
const STORAGE_PREFIX = "claw-audit:";

/**
 * Stable empty-array singleton returned by `read` when a contract has no
 * entries yet. `useSyncExternalStore` requires `getSnapshot` to return the
 * same reference for unchanged data — a fresh `[]` literal on every call
 * triggers an infinite-loop warning even when the data is logically empty.
 */
const EMPTY_AUDIT: AuditEntry[] = Object.freeze([]) as unknown as AuditEntry[];

/** Read the full audit list for a contract, falling back to sessionStorage. */
function read(contractId: string): AuditEntry[] {
  const cached = memory.get(contractId);
  if (cached) return cached;
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${contractId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as AuditEntry[];
      memory.set(contractId, parsed);
      return parsed;
    }
  } catch {
    // sessionStorage unavailable / quota / corrupted JSON — fall through to empty.
  }
  return EMPTY_AUDIT;
}

/** Persist the audit list back to memory + sessionStorage. */
function write(contractId: string, entries: AuditEntry[]): void {
  memory.set(contractId, entries);
  try {
    sessionStorage.setItem(
      `${STORAGE_PREFIX}${contractId}`,
      JSON.stringify(entries)
    );
  } catch {
    // sessionStorage may be unavailable / quota-exceeded — memory is the source of truth.
  }
  notify(contractId);
}

/**
 * Append a new audit entry to the contract's log. The next id is assigned
 * monotonically (`a1`, `a2`, …) based on the current list length. Returns the
 * stored entry so callers can echo the id if they want to.
 */
export function logAction(
  contractId: string,
  entry: Omit<AuditEntry, "id" | "contractId" | "createdAt">
): AuditEntry {
  const list = read(contractId);
  const created: AuditEntry = {
    id: `a${list.length + 1}`,
    contractId,
    createdAt: new Date().toISOString(),
    ...entry,
  };
  write(contractId, [...list, created]);
  return created;
}

/** List every stored audit entry for a contract (oldest first). */
export function listAudit(contractId: string): AuditEntry[] {
  return read(contractId);
}

/** Drop all stored audit entries for a contract (optional cleanup). */
export function clearAudit(contractId: string): void {
  memory.delete(contractId);
  try {
    sessionStorage.removeItem(`${STORAGE_PREFIX}${contractId}`);
  } catch {
    // ignore
  }
}