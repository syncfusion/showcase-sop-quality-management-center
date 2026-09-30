/**
 * Deterministic seed data — Reviewer directory.
 *
 * Five English personas covering the legacy contract role families
 * (Author / Legal / Finance / Customer) and the Healthcare SOP reviewer
 * bucket. The editor's "View as" ComboBox and the reviewer dropdown in the
 * Assignments panel read from the same list so there is exactly one
 * vocabulary for "who is looking at the document" — change the names here
 * and the entire app picks them up.
 *
 * `role` is intentionally retained on the type: the audit log
 * (AuditTimeline), the AllDocuments grid reviewer filter, and the
 * restriction-strip chips in the editor still bucket by role for display.
 * The role is no longer the EJ2 editable-region key — that key is now the
 * `name` (see `applyEditableRegionForAssignment` in `EditorWorkspace.tsx`).
 *
 * 100% synthetic personas — no PII.
 */

import type { Reviewer } from "../models";

export const reviewersSeed: Reviewer[] = [
  { id: "rvw-adam", name: "Adam Bennett", role: "Author" },
  { id: "rvw-sarah", name: "Sarah Hughes", role: "Legal" },
  { id: "rvw-michael", name: "Michael Tran", role: "Finance" },
  { id: "rvw-laura", name: "Laura Phillips", role: "Customer" },
  { id: "rvw-daniel", name: "Daniel Carter", role: "Quality" },
];
