/**
 * In-memory (+ sessionStorage backup) store for user-uploaded DOCX files,
 * keyed by the synthetic `contractId` we mint for them. Mirrors the shape of
 * `editedDocStore` but holds the *pristine upload* (the edited version still
 * lives in `editedDocStore` after the user clicks "Compare versions" in the
 * editor). Together they let Review / Sign & Publish re-open the right file
 * without any server-side persistence.
 *
 * Uploaded documents are session-scoped only: they disappear on hard reload,
 * same as the live-edited document.
 */

export interface UploadedDoc {
  contractId: string;
  base64: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string; // ISO
}

const memory = new Map<string, UploadedDoc>();
const STORAGE_PREFIX = "claw-uploaded-doc:";

/** Stash an uploaded DOCX (base64, no data: prefix) for a synthetic contract. */
export function setUploadedDoc(record: UploadedDoc): void {
  memory.set(record.contractId, record);
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${record.contractId}`, JSON.stringify(record));
  } catch {
    // sessionStorage may be unavailable / quota-exceeded — memory is the source of truth.
  }
}

/** Retrieve an uploaded DOCX by its synthetic contractId, or null if none. */
export function getUploadedDoc(contractId: string): UploadedDoc | null {
  const inMemory = memory.get(contractId);
  if (inMemory) return inMemory;
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${contractId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as UploadedDoc;
      memory.set(contractId, parsed);
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

/** True when the given contractId was minted for an upload (vs. a seed). */
export function isUploadedContract(contractId: string): boolean {
  return contractId.startsWith("ctr-upload-");
}

/** Drop a single upload (e.g. on cleanup). */
export function clearUploadedDoc(contractId: string): void {
  memory.delete(contractId);
  try {
    sessionStorage.removeItem(`${STORAGE_PREFIX}${contractId}`);
  } catch {
    // ignore
  }
}
