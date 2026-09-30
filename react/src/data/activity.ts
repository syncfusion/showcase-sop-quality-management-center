/**
 * Deterministic seed data — Activity timeline (audit events).
 *
 * ActivityType: Created | Merged | ClauseInserted | CommentAdded |
 *   RevisionAccepted | RevisionRejected | Signed | Published | Assigned | Saved.
 *
 * Seeded `actor` values match the 5-persona `reviewersSeed` list. Each
 * legacy author / reviewer name has been migrated to the new unified
 * reviewer directory — see `data/reviewers.ts` for the canonical list.
 */

import type { ActivityLogEntry } from "../models";

export const activitySeed: ActivityLogEntry[] = [
  // Northwind service agreement
  { id: "act-nw-1", contractId: "ctr-northwind-service", type: "Created", actor: "Adam Bennett", timestamp: "2026-08-21T14:10:00Z", detail: "Created from Laboratory SOP template" },
  { id: "act-nw-2", contractId: "ctr-northwind-service", type: "Merged", actor: "Adam Bennett", timestamp: "2026-08-21T14:20:00Z", detail: "Merged CRM data for Northwind Traders" },
  { id: "act-nw-3", contractId: "ctr-northwind-service", type: "Assigned", actor: "Adam Bennett", timestamp: "2026-09-02T10:00:00Z", detail: "Assigned Fees & payment to Michael Tran (Finance)" },
  { id: "act-nw-4", contractId: "ctr-northwind-service", type: "ClauseInserted", actor: "Adam Bennett", timestamp: "2026-09-03T15:40:00Z", detail: "Inserted Net 45 payment clause at sec_fees" },
  { id: "act-nw-5", contractId: "ctr-northwind-service", type: "CommentAdded", actor: "Sarah Hughes", timestamp: "2026-09-04T09:30:00Z", detail: "Comment on Confidentiality section" },
  { id: "act-nw-6", contractId: "ctr-northwind-service", type: "CommentAdded", actor: "Michael Tran", timestamp: "2026-09-05T11:15:00Z", detail: "Comment on Fees & payment section" },
  { id: "act-nw-7", contractId: "ctr-northwind-service", type: "Saved", actor: "Adam Bennett", timestamp: "2026-09-08T09:40:00Z", detail: "Saved Version 3 draft" },

  // Contoso NDA
  { id: "act-co-nda-1", contractId: "ctr-contoso-nda", type: "Created", actor: "Adam Bennett", timestamp: "2026-09-08T11:05:00Z", detail: "Created from Manufacturing SOP template" },

  // Fabrikam purchase contract
  { id: "act-fab-pu-1", contractId: "ctr-fabrikam-purchase", type: "Created", actor: "Adam Bennett", timestamp: "2026-07-30T10:22:00Z", detail: "Created from Healthcare SOP template" },
  { id: "act-fab-pu-2", contractId: "ctr-fabrikam-purchase", type: "Merged", actor: "Adam Bennett", timestamp: "2026-07-30T10:35:00Z", detail: "Merged CRM data for Fabrikam" },
  { id: "act-fab-pu-3", contractId: "ctr-fabrikam-purchase", type: "RevisionAccepted", actor: "Sarah Hughes", timestamp: "2026-08-20T15:10:00Z", detail: "Accepted all revisions" },
  { id: "act-fab-pu-4", contractId: "ctr-fabrikam-purchase", type: "Signed", actor: "Adam Bennett", timestamp: "2026-08-25T11:00:00Z", detail: "Image-based approval signature attached" },

  // Trey Research service agreement
  { id: "act-tr-se-1", contractId: "ctr-trey-service", type: "Created", actor: "Adam Bennett", timestamp: "2026-08-15T08:00:00Z", detail: "Created from Laboratory SOP template" },
  { id: "act-tr-se-2", contractId: "ctr-trey-service", type: "ClauseInserted", actor: "Michael Tran", timestamp: "2026-09-06T17:30:00Z", detail: "Inserted Data protection addendum (high risk)" },
  { id: "act-tr-se-3", contractId: "ctr-trey-service", type: "CommentAdded", actor: "Sarah Hughes", timestamp: "2026-09-06T17:45:00Z", detail: "Comment on liability cap clause" },

  // Published contracts
  { id: "act-nw-pu-1", contractId: "ctr-northwind-purchase", type: "Published", actor: "Adam Bennett", timestamp: "2026-08-28T09:12:00Z", detail: "Published — DOCX + clean PDF exported" },
  { id: "act-co-se-1", contractId: "ctr-contoso-service", type: "Published", actor: "Adam Bennett", timestamp: "2026-08-15T15:50:00Z", detail: "Published — DOCX + clean PDF exported" },
  { id: "act-fa-nda-1", contractId: "ctr-fabrikam-nda", type: "Published", actor: "Adam Bennett", timestamp: "2026-07-22T12:18:00Z", detail: "Published — DOCX + clean PDF exported" },
  { id: "act-aw-se-1", contractId: "ctr-adventure-service", type: "Published", actor: "Adam Bennett", timestamp: "2026-07-10T09:30:00Z", detail: "Published — DOCX + clean PDF exported" },
  { id: "act-co-pu-1", contractId: "ctr-contoso-purchase", type: "Published", actor: "Adam Bennett", timestamp: "2026-06-30T16:40:00Z", detail: "Published — DOCX + clean PDF exported" },
];
