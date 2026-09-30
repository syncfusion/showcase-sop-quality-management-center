/**
 * In-memory (+ sessionStorage backup) carrier for the live-edited document,
 * keyed by contractId.
 *
 * History shape: append-only `DocVersion[]` per contract. The pristine baseline
 * is recorded as `v1` (seeded once when the contract is first opened in the
 * editor — either the uploaded DOCX for `ctr-upload-*` contracts or, for seeded
 * templates, the rendered template .docx fetched from the service). Each
 * subsequent editor save produces `v2`, `v3`, … without overwriting history, so
 * the Review screen can pick any two versions to compare (`v1` vs `v3`, `v2`
 * vs `v4`, etc.).
 *
 * The in-memory `Map` is the source of truth; `sessionStorage` is the reload
 * survival backup (cleared on hard reload / tab close). That matches the
 * "session-scoped only" promise for the demo.
 *
 * Backwards-compat shims (`setEditedDoc` / `getEditedDoc` / `clearEditedDoc`)
 * are preserved so existing call sites keep working: `setEditedDoc` appends a
 * new version, `getEditedDoc` returns the latest.
 */

export interface DocVersion {
  id: string; // "v1", "v2", ... per contract
  label: string; // human-friendly label, e.g. "Original" or "Saved 9/24/2026, 10:42 AM"
  base64: string; // DOCX base64 (no data: prefix)
  createdAt: string; // ISO timestamp
  createdBy: string; // currentUser / role
  source: "edited" | "uploaded" | "template";
}

const memory = new Map<string, DocVersion[]>();
const STORAGE_PREFIX = "claw-doc-versions:";

/** Read the full version list from memory, falling back to sessionStorage. */
function read(contractId: string): DocVersion[] {
  const cached = memory.get(contractId);
  if (cached) return cached;
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${contractId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as DocVersion[];
      memory.set(contractId, parsed);
      return parsed;
    }
  } catch {
    // sessionStorage unavailable / quota / corrupted JSON — fall through to empty.
  }
  return [];
}

/** Persist the version list back to memory + sessionStorage. */
function write(contractId: string, versions: DocVersion[]): void {
  memory.set(contractId, versions);
  try {
    sessionStorage.setItem(
      `${STORAGE_PREFIX}${contractId}`,
      JSON.stringify(versions)
    );
  } catch {
    // sessionStorage may be unavailable / quota-exceeded — memory is the source of truth.
  }
}

/**
 * Record the pristine baseline (`v1`) for a contract if no versions exist yet.
 * Called once per contract when the editor first opens it. For uploaded
 * contracts, pass the stored base64 DOCX; for seeded templates, pass the .docx
 * fetched from the service.
 */
export function ensureSeedVersion(
  contractId: string,
  base64: string,
  source: DocVersion["source"],
  createdBy = "system"
): DocVersion {
  const existing = read(contractId);
  if (existing.length > 0) return existing[0];
  const seed: DocVersion = {
    id: "v1",
    label: "Original",
    base64,
    createdAt: new Date().toISOString(),
    createdBy,
    source,
  };
  write(contractId, [seed]);
  return seed;
}

/** List every stored version for a contract (oldest first). */
export function listVersions(contractId: string): DocVersion[] {
  return read(contractId);
}

/** Look up a single version by its `id` (`v1`, `v2`, …), or `null` if absent. */
export function getVersion(contractId: string, versionId: string): DocVersion | null {
  return read(contractId).find((v) => v.id === versionId) ?? null;
}

/** Return the most recently stored version for a contract, or `null`. */
export function getLatestVersion(contractId: string): DocVersion | null {
  const list = read(contractId);
  return list[list.length - 1] ?? null;
}

/**
 * Append a new version to the contract's history. The next id is assigned
 * monotonically (`v2`, `v3`, …) based on the current list length.
 */
export function appendVersion(
  contractId: string,
  base64: string,
  opts: { label?: string; createdBy?: string } = {}
): DocVersion {
  const versions = read(contractId);
  const nextNum = versions.length + 1;
  const version: DocVersion = {
    id: `v${nextNum}`,
    label: opts.label ?? `Version ${nextNum}`,
    base64,
    createdAt: new Date().toISOString(),
    createdBy: opts.createdBy ?? "Adam Bennett",
    source: "edited",
  };
  write(contractId, [...versions, version]);
  return version;
}

/** Drop all stored versions for a contract (optional cleanup). */
export function clearVersions(contractId: string): void {
  memory.delete(contractId);
  try {
    sessionStorage.removeItem(`${STORAGE_PREFIX}${contractId}`);
  } catch {
    // ignore
  }
}

// ── Backwards-compat shims ────────────────────────────────────────────────────
// The editor's "Compare versions" button (EditorWorkspace) and the Review
// screen (ReviewApproval) historically used a single-slot API. Keep those
// symbols working so the diff stays small: `setEditedDoc` is now an append,
// `getEditedDoc` returns the latest, and `clearEditedDoc` wipes the history.

/** Append a new version carrying the supplied DOCX base64. */
export function setEditedDoc(contractId: string, docxBase64: string): void {
  appendVersion(contractId, docxBase64, {
    label: `Saved ${new Date().toLocaleString()}`,
  });
}

/** Retrieve the latest DOCX base64 for a contract, or `null` if none. */
export function getEditedDoc(contractId: string): string | null {
  return getLatestVersion(contractId)?.base64 ?? null;
}

/** Drop every stored version for a contract. */
export function clearEditedDoc(contractId: string): void {
  clearVersions(contractId);
}
