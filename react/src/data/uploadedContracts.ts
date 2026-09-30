/**
 * Synthetic contract metadata for user-uploaded DOCX files.
 *
 * When the Dashboard upload card accepts a file we mint a `contractId` like
 * `ctr-upload-<timestamp>` and record the upload in `uploadedDocStore` plus a
 * thin `ContractDetail` stub here. The stub is shaped like a real contract so
 * the editor, review, and sign screens render without special-casing — they
 * just call `contractService.getContract(id)` and get a Draft contract owned
 * by Adam Bennett with no merge values, no assignments, no versions, no activity.
 *
 * Both the in-memory map AND `sessionStorage` are kept in sync so the "All
 * Documents" page can repopulate after a hard reload — same try/catch quota
 * pattern as `uploadedDocStore.ts`. Reload survival matches the existing
 * base64 payload in `uploadedDocStore` (also session-scoped).
 */

import type { ContractDetail } from "../models";

const memory = new Map<string, ContractDetail>();
const STORAGE_PREFIX = "claw-uploaded-contract:";

/** Upsert a synthetic ContractDetail for an uploaded DOCX. */
export function registerUploadedContract(contract: ContractDetail): void {
  memory.set(contract.id, contract);
  try {
    sessionStorage.setItem(
      `${STORAGE_PREFIX}${contract.id}`,
      JSON.stringify(contract)
    );
  } catch {
    // sessionStorage may be unavailable / quota-exceeded — memory is the source of truth.
  }
}

/** Read a synthetic ContractDetail by id (or null). */
export function getUploadedContract(id: string): ContractDetail | null {
  const inMemory = memory.get(id);
  if (inMemory) return inMemory;
  // Hydrate from sessionStorage so the All Documents page repopulates after
  // a hard reload (same survival guarantee as the base64 DOCX payload).
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${id}`);
    if (raw) {
      const parsed = JSON.parse(raw) as ContractDetail;
      memory.set(id, parsed);
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

/** True when the id was minted for an upload (vs. a seed contract). */
export function hasUploadedContract(id: string): boolean {
  return memory.has(id) || readSessionKeys().has(id);
}

/** Snapshot of every uploaded contract (memory + sessionStorage). */
export function listUploadedContracts(): ContractDetail[] {
  // Merge both sources so a hard reload (which loses the in-memory Map but
  // keeps sessionStorage) still surfaces the full list.
  const byId = new Map<string, ContractDetail>();
  for (const [id, c] of memory) byId.set(id, c);
  for (const id of readSessionKeys()) {
    if (byId.has(id)) continue;
    const fromSession = getUploadedContract(id);
    if (fromSession) byId.set(id, fromSession);
  }
  return Array.from(byId.values()).sort(
    (a, b) => Date.parse(b.updatedDate) - Date.parse(a.updatedDate)
  );
}

/** Drop a single upload (e.g. on cleanup). */
export function clearUploadedContract(id: string): void {
  memory.delete(id);
  try {
    sessionStorage.removeItem(`${STORAGE_PREFIX}${id}`);
  } catch {
    // ignore
  }
}

/** True when the given contractId was minted for an upload (vs. a seed). */
export function isUploadedContract(contractId: string): boolean {
  return contractId.startsWith("ctr-upload-");
}

/** Build a fresh synthetic contract for an upload. */
export function buildUploadedContract(opts: {
  contractId: string;
  title: string;
  nowIso: string;
}): ContractDetail {
  return {
    id: opts.contractId,
    title: opts.title,
    type: "ServiceAgreement",
    templateId: "tpl-uploaded",
    accountName: "Uploaded document",
    accountId: "acc-uploaded",
    ownerId: "rvw-adam",
    ownerName: "Adam Bennett",
    status: "Draft",
    currentVersion: 1,
    updatedDate: opts.nowIso,
    createdDate: opts.nowIso,
    versions: [],
    assignments: [],
    activity: [],
    comments: [],
  };
}

/** Generate a unique synthetic contractId for an upload. */
export function mintUploadedContractId(): string {
  return `ctr-upload-${Date.now().toString(36)}`;
}

// --- helpers ---

function readSessionKeys(): Set<string> {
  const ids = new Set<string>();
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        ids.add(key.slice(STORAGE_PREFIX.length));
      }
    }
  } catch {
    // sessionStorage unavailable — return empty set.
  }
  return ids;
}
