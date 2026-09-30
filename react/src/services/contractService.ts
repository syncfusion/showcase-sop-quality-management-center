/**
 * Mock contract service — session-scoped, in-memory state backed by deterministic
 * seeds. Promise-based with simulated latency (200–600 ms). API-shaped so a real
 * backend can replace it later without UI rewrites.
 *
 * Writes are session-scoped only and reset on reload. Hosted demo is
 * read-only at the business-data layer: writes remain available locally but
 * are labeled ephemeral.
 */

import type {
  AccountDetail,
  ActivityLogEntry,
  AppError,
  Clause,
  ClauseInsertResult,
  ContractDetail,
  ContractTemplate,
  ReviewAssignment,
  Reviewer,
  SignatureRecord,
  VersionSnapshot,
  VersionSummary,
} from "../models";

import {
  templatesSeed,
  accountsSeed,
  clausesSeed,
  reviewersSeed,
  contractsSeed,
  versionsSeed,
  assignmentsSeed,
  activitySeed,
  signaturesSeed,
} from "../data";
import {
  getUploadedContract,
  hasUploadedContract,
  listUploadedContracts,
  registerUploadedContract,
} from "../data/uploadedContracts";
import { bumpContractsRefresh } from "../data/contractsRefresh";

// --- Simulated latency helper ---

function delay<T>(value: T, ms = 200 + Math.floor(Math.random() * 400)): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function appError(code: string, message: string, retryable = false): AppError {
  return { code, message, retryable };
}

function rejectError(code: string, message: string, retryable = false): Promise<never> {
  return Promise.reject(appError(code, message, retryable));
}

// --- Session-scoped in-memory store (deep clone of seeds) ---

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const sessionContracts: ContractDetail[] = clone(contractsSeed);
const sessionVersions: VersionSnapshot[] = clone(versionsSeed);
const sessionAssignments: ReviewAssignment[] = clone(assignmentsSeed);
const sessionActivity: ActivityLogEntry[] = clone(activitySeed);
const sessionSignatures: SignatureRecord[] = clone(signaturesSeed);

// --- In-memory index helpers ---

function contractById(id: string): ContractDetail | undefined {
  return sessionContracts.find((c) => c.id === id);
}

/**
 * Patch the in-session `currentVersion` / `updatedDate` of a contract so the
 * All Documents grid (and any other view that reads `ContractDetail.currentVersion`)
 * reflects the latest editor save without a hard reload. Mirrors the pattern
 * used by `insertClause` / `assignSection` / `attachSignature`: seed rows are
 * mutated in place on the module-scoped `sessionContracts` clone, while
 * uploaded stubs are re-registered through `uploadedContracts` so the bump
 * survives `getContract` re-reads in this session and on reload.
 *
 * `currentVersion` is taken as `Math.max(existing, newVersion)` so a save that
 * would otherwise lower the counter (e.g. seed says `3`, user saves `v2`) keeps
 * the row's number monotonic. `updatedDate` is always overwritten with `nowIso`
 * so the "Updated" column refreshes.
 */
export function updateContractMeta(
  id: string,
  patch: Partial<Pick<ContractDetail, "currentVersion" | "updatedDate" | "status">>
): void {
  const nowIso = new Date().toISOString();
  const seed = contractById(id);
  if (seed) {
    if (typeof patch.currentVersion === "number") {
      seed.currentVersion = Math.max(seed.currentVersion, patch.currentVersion);
    }
    if (patch.status) {
      // Lifecycle transitions flow forward only — never let a save / compare
      // action regress a contract back to Draft once it has moved into the
      // review / signature / published pipeline. Identical statuses are a
      // no-op so repeated saves don't churn the All Documents grid.
      //
      // `Obsolete` is the one exception: it is a terminal *out-of-band*
      // state that can be applied from any non-obsolete lifecycle stage
      // (the user marks a contract obsolete from the All Documents Actions
      // menu, regardless of whether it was Draft, InReview, etc.). Once a
      // row is Obsolete we keep it Obsolete — a second click is a no-op
      // and the order comparison below also keeps the audit trail stable.
      const order: Record<ContractDetail["status"], number> = {
        Draft: 0,
        InReview: 1,
        PendingSignature: 2,
        Published: 3,
        Obsolete: 4,
      };
      const next = patch.status;
      if (next === "Obsolete") {
        if (seed.status !== "Obsolete") {
          seed.status = "Obsolete";
        }
      } else if (order[next] >= order[seed.status]) {
        seed.status = next;
      }
    }
    if (patch.updatedDate) {
      seed.updatedDate = patch.updatedDate;
    } else {
      seed.updatedDate = nowIso;
    }
    bumpContractsRefresh();
    return;
  }
  const uploaded = getUploadedContract(id);
  if (uploaded) {
    if (typeof patch.currentVersion === "number") {
      uploaded.currentVersion = Math.max(
        uploaded.currentVersion ?? 0,
        patch.currentVersion
      );
    }
    if (patch.status) {
      // Same forward-only rule for uploaded contracts as for seed rows — see
      // `contractById` branch above for the rationale. `Obsolete` follows the
      // same "any non-obsolete → Obsolete is allowed" exception.
      const order: Record<ContractDetail["status"], number> = {
        Draft: 0,
        InReview: 1,
        PendingSignature: 2,
        Published: 3,
        Obsolete: 4,
      };
      const next = patch.status;
      if (next === "Obsolete") {
        if (uploaded.status !== "Obsolete") {
          uploaded.status = "Obsolete";
        }
      } else if (order[next] >= order[uploaded.status as ContractDetail["status"]]) {
        uploaded.status = next;
      }
    }
    uploaded.updatedDate = patch.updatedDate ?? nowIso;
    registerUploadedContract(uploaded);
    bumpContractsRefresh();
  }
}

/**
 * True when the id belongs to ANY contract visible to the user — the seed
 * catalogue OR an uploaded DOCX stub. Mirrors the lookup order used by
 * `getContract` / `listContracts` so the write paths (assign / clause /
 * signature) accept the same set of ids the read paths do.
 */
function isKnownContract(id: string): boolean {
  return contractById(id) !== undefined || hasUploadedContract(id);
}
function templateById(id: string): ContractTemplate | undefined {
  return templatesSeed.find((t) => t.id === id);
}
function accountById(id: string): AccountDetail | undefined {
  return accountsSeed.find((a) => a.id === id);
}
function reviewerById(id: string): Reviewer | undefined {
  return reviewersSeed.find((r) => r.id === id);
}
function clauseById(id: string): Clause | undefined {
  return clausesSeed.find((c) => c.id === id);
}

// --- Filter types ---

export interface ClauseFilter {
  category?: Clause["category"];
  riskLevel?: Clause["riskLevel"];
}

// --- Service surface ---

export const contractService = {
  async getTemplate(id: string): Promise<ContractTemplate> {
    const template = templateById(id);
    if (!template) return rejectError("NOT_FOUND", `Template ${id} not found`);
    return delay(clone(template));
  },

  async getContract(id: string): Promise<ContractDetail> {
    // Synthetic uploaded contracts live in a parallel session-scoped map
    // (`uploadedContracts`). They share the same `ContractDetail` shape so the
    // editor / review / sign screens render identically; merge fields and
    // assignments are simply empty for uploads.
    const uploaded = getUploadedContract(id);
    if (uploaded) return delay(clone(uploaded));
    const contract = contractById(id);
    if (!contract) return rejectError("NOT_FOUND", `Contract ${id} not found`);
    const detail = clone({
      ...contract,
      versions: sessionVersions.filter((v) => v.contractId === id),
      assignments: sessionAssignments.filter((a) => a.contractId === id),
      activity: sessionActivity.filter((a) => a.contractId === id),
    });
    return delay(detail);
  },

  /**
   * List every contract visible to the user: the seed catalogue plus every
   * upload registered in `uploadedContracts` (which itself hydrates from
   * sessionStorage so hard reloads keep showing uploaded rows). Sorted by
   * `updatedDate` desc so freshly uploaded drafts surface at the top.
   */
  async listContracts(): Promise<ContractDetail[]> {
    const seedRows: ContractDetail[] = sessionContracts
      .map((c) =>
        clone({
          ...c,
          versions: sessionVersions.filter((v) => v.contractId === c.id),
          assignments: sessionAssignments.filter((a) => a.contractId === c.id),
          activity: sessionActivity.filter((a) => a.contractId === c.id),
        })
      );
    const uploaded = listUploadedContracts();
    // De-dupe (an uploaded id should never collide with a seed id, but be defensive).
    const byId = new Map<string, ContractDetail>();
    for (const c of seedRows) byId.set(c.id, c);
    for (const c of uploaded) byId.set(c.id, c);
    const merged = Array.from(byId.values()).sort(
      (a, b) => Date.parse(b.createdDate) - Date.parse(a.createdDate)
    );
    return delay(merged);
  },

  async getAccount(id: string): Promise<AccountDetail> {
    const account = accountById(id);
    if (!account) return rejectError("NOT_FOUND", `Account ${id} not found`);
    return delay(clone(account));
  },

  async getClauses(filter?: ClauseFilter): Promise<Clause[]> {
    let rows = clone(clausesSeed);
    if (filter) {
      if (filter.category) rows = rows.filter((c) => c.category === filter.category);
      if (filter.riskLevel) rows = rows.filter((c) => c.riskLevel === filter.riskLevel);
    }
    return delay(rows);
  },

  async getReviewers(): Promise<Reviewer[]> {
    return delay(clone(reviewersSeed));
  },

  async getVersions(contractId: string): Promise<VersionSummary[]> {
    const rows = sessionVersions
      .filter((v) => v.contractId === contractId)
      .sort((a, b) => b.versionNo - a.versionNo);
    return delay(clone(rows));
  },

  async insertClause(req: {
    contractId: string;
    clauseId: string;
    slot: string;
  }): Promise<ClauseInsertResult> {
    if (!isKnownContract(req.contractId)) {
      return rejectError("NOT_FOUND", `Contract ${req.contractId} not found`);
    }
    const clause = clauseById(req.clauseId);
    if (!clause) return rejectError("NOT_FOUND", `Clause ${req.clauseId} not found`);
    const nowIso = new Date().toISOString();
    sessionActivity.push({
      id: `act-${req.contractId}-clause-${Date.now().toString(36)}`,
      contractId: req.contractId,
      type: "ClauseInserted",
      actor: "Adam Bennett",
      timestamp: nowIso,
      detail: `Inserted ${clause.name} at ${req.slot}`,
    });
    // For seed contracts we mutate the in-session record so `getContract` /
    // the All Documents page reflect `updatedDate`. For uploaded contracts
    // the same field is on a separate stub — rehydrate + re-register so the
    // bump survives `getContract` re-reads in this session and on reload.
    const seedContract = contractById(req.contractId);
    if (seedContract) {
      seedContract.updatedDate = nowIso;
    } else {
      const uploaded = getUploadedContract(req.contractId);
      if (uploaded) {
        uploaded.updatedDate = nowIso;
        uploaded.activity = (uploaded.activity ?? []).concat({
          id: `act-${uploaded.id}-clause-${Date.now().toString(36)}`,
          contractId: uploaded.id,
          type: "ClauseInserted",
          actor: "Adam Bennett",
          timestamp: nowIso,
          detail: `Inserted ${clause.name} at ${req.slot}`,
        });
        registerUploadedContract(uploaded);
      }
    }
    const result: ClauseInsertResult = {
      contractId: req.contractId,
      clauseId: clause.id,
      insertedAtBookmark: req.slot,
      insertedClauseName: clause.name,
      riskLevel: clause.riskLevel,
    };
    return delay(result, 350);
  },

  async assignSection(req: {
    contractId: string;
    sectionId: string;
    reviewerId: string;
    protectionLevel: ReviewAssignment["protectionLevel"];
  }): Promise<ReviewAssignment> {
    if (!isKnownContract(req.contractId)) {
      return rejectError("NOT_FOUND", `Contract ${req.contractId} not found`);
    }
    const reviewer = reviewerById(req.reviewerId);
    if (!reviewer) return rejectError("VALIDATION", "Reviewer is required.");
    const existing = sessionAssignments.find(
      (a) => a.contractId === req.contractId && a.sectionBookmark === req.sectionId
    );
    if (existing) {
      return rejectError("VALIDATION", "A reviewer is already assigned to this section.");
    }
    const nowIso = new Date().toISOString();
    const assignment: ReviewAssignment = {
      id: `asg-${Date.now().toString(36)}`,
      contractId: req.contractId,
      sectionName: req.sectionId.replace(/^sec_/, "").replace(/_/g, " "),
      sectionBookmark: req.sectionId,
      reviewerId: reviewer.id,
      reviewerName: reviewer.name,
      reviewerRole: reviewer.role,
      protectionLevel: req.protectionLevel,
      status: "Pending",
      isOverdue: false,
    };
    sessionAssignments.push(assignment);
    const seedContract = contractById(req.contractId);
    if (seedContract) {
      seedContract.assignments = sessionAssignments.filter(
        (a) => a.contractId === req.contractId
      );
      seedContract.updatedDate = nowIso;
    } else {
      const uploaded = getUploadedContract(req.contractId);
      if (uploaded) {
        uploaded.assignments = (uploaded.assignments ?? []).concat(clone(assignment));
        uploaded.updatedDate = nowIso;
        registerUploadedContract(uploaded);
      }
    }
    sessionActivity.push({
      id: `act-${req.contractId}-assign-${Date.now().toString(36)}`,
      contractId: req.contractId,
      type: "Assigned",
      actor: "Adam Bennett",
      timestamp: nowIso,
      detail: `Assigned ${assignment.sectionName} to ${reviewer.name} (${reviewer.role})`,
    });
    return delay(clone(assignment), 400);
  },

  async attachSignature(req: {
    contractId: string;
    signer: { name: string; title: string };
    imageData: string;
  }): Promise<SignatureRecord> {
    if (!isKnownContract(req.contractId)) {
      return rejectError("NOT_FOUND", `Contract ${req.contractId} not found`);
    }
    const nowIso = new Date().toISOString();
    const record: SignatureRecord = {
      contractId: req.contractId,
      signerName: req.signer.name,
      signerTitle: req.signer.title,
      signedDate: nowIso,
      imageData: req.imageData,
      disclaimer:
        "This is an image-based approval signature, not a certificate-backed digital signature.",
    };
    sessionSignatures.push(record);
    const seedContract = contractById(req.contractId);
    if (seedContract) {
      seedContract.updatedDate = nowIso;
    } else {
      const uploaded = getUploadedContract(req.contractId);
      if (uploaded) {
        uploaded.updatedDate = nowIso;
        registerUploadedContract(uploaded);
      }
    }
    sessionActivity.push({
      id: `act-${req.contractId}-sign-${Date.now().toString(36)}`,
      contractId: req.contractId,
      type: "Signed",
      actor: req.signer.name,
      timestamp: nowIso,
      detail: "Image-based approval signature attached",
    });
    return delay(clone(record), 450);
  },

  /**
   * Patch `currentVersion` / `updatedDate` / `status` on the in-session
   * contract so the All Documents grid reflects the latest editor save and
   * lifecycle transitions (Draft ��� InReview, etc.) without a hard reload.
   * Thin re-export of the top-level `updateContractMeta` for callers that
   * already hold a `contractService` reference.
   */
  updateContractMeta(
    id: string,
    patch: Partial<Pick<ContractDetail, "currentVersion" | "updatedDate" | "status">>
  ): void {
    updateContractMeta(id, patch);
  },

  /**
   * Move a contract into the `Obsolete` terminal state from any
   * non-obsolete lifecycle stage. Records an audit `ActivityLogEntry` so
   * the Audit Timeline picks up the change, and bumps the contracts
   * refresh key so the All Documents grid + KPI cards re-fetch.
   *
   * The status flip goes through `updateContractMeta` so the same
   * "any non-obsolete → Obsolete is allowed" exception (vs. the normal
   * forward-only lifecycle guard) is enforced here. A second call on an
   * already-obsolete contract is a no-op and records no extra audit
   * entry — re-clicking the Actions menu must not pollute the timeline.
   */
  markObsolete(id: string): boolean {
    if (!isKnownContract(id)) return false;
    const nowIso = new Date().toISOString();
    const seed = contractById(id);
    if (seed) {
      if (seed.status === "Obsolete") return false;
      const previousStatus = seed.status;
      seed.status = "Obsolete";
      seed.updatedDate = nowIso;
      sessionActivity.push({
        id: `act-${id}-obsolete-${Date.now().toString(36)}`,
        contractId: id,
        type: "MarkedObsolete",
        actor: "Adam Bennett",
        timestamp: nowIso,
        detail: `Marked obsolete (was ${previousStatus})`,
      });
      bumpContractsRefresh();
      return true;
    }
    const uploaded = getUploadedContract(id);
    if (!uploaded) return false;
    if (uploaded.status === "Obsolete") return false;
    const previousStatus = uploaded.status as ContractDetail["status"];
    uploaded.status = "Obsolete";
    uploaded.updatedDate = nowIso;
    uploaded.activity = (uploaded.activity ?? []).concat({
      id: `act-${id}-obsolete-${Date.now().toString(36)}`,
      contractId: id,
      type: "MarkedObsolete",
      actor: "Adam Bennett",
      timestamp: nowIso,
      detail: `Marked obsolete (was ${previousStatus})`,
    });
    registerUploadedContract(uploaded);
    bumpContractsRefresh();
    return true;
  },
};
