/**
 * Linear workflow screens shown in the horizontal stepper.
 *
 * The 5 steps are: Upload → Editor → Review → Sign & Publish → Audit Timeline.
 *
 * Routing shape:
 *   - Step 0 (Upload) lives at the static route `/new`.
 *   - Steps 1-4 live as children of `/workflow/:contractId`, e.g.
 *     `/workflow/:contractId/editor`, `/workflow/:contractId/review`, etc.
 *
 * Step 0 has no contract id requirement; steps 1-4 require one. The
 * per-doc workflow tree (`/workflow/:contractId/...`) and the upload
 * surface (`/new`) are independent route trees — see `App.tsx`.
 */

export const WORKFLOW_STEPS = [
  { label: "Upload", iconCss: "e-icons e-upload-1", text: "1" },
  { label: "Editor", iconCss: "e-icons e-edit", text: "2" },
  { label: "Review", iconCss: "e-icons e-checklist", text: "3" },
  { label: "Sign & Publish", iconCss: "e-icons e-stamp", text: "4" },
  { label: "Audit Timeline", iconCss: "e-icons e-history", text: "5" },
] as const;

/** Child paths inside `/workflow/:contractId/...` for steps 1-4. */
const WORKFLOW_CHILD_BASES = ["editor", "review", "sign", "audit"] as const;

/** Matches a contract id in any of the 4 nested workflow child routes. */
const CONTRACT_PATH = /^\/workflow\/([^/]+)\/(?:editor|review|sign|audit)/;

/**
 * Extract the contract id from a workflow child route path. Returns `null`
 * for `/new` (the upload surface) or any non-workflow route.
 */
export function contractIdFromPath(pathname: string): string | null {
  return pathname.match(CONTRACT_PATH)?.[1] ?? null;
}

/**
 * Active stepper index for the given pathname.
 *
 * Returns `-1` for paths that are not part of the workflow (Dashboard, etc.).
 */
export function activeStepFromPath(pathname: string): number {
  if (pathname === "/new") return 0;
  if (/\/workflow\/[^/]+\/audit$/.test(pathname)) return 4;
  if (/\/workflow\/[^/]+\/sign$/.test(pathname)) return 3;
  if (/\/workflow\/[^/]+\/review$/.test(pathname)) return 2;
  if (/\/workflow\/[^/]+\/editor$/.test(pathname)) return 1;
  return -1;
}

/**
 * Route path for a workflow step.
 *
 * - `index <= 0` → `"/new"` (the upload surface).
 * - `index >= 1` → `"/workflow/:contractId/<step>"`; requires a `contractId`.
 *   Returns `null` if the contract id is missing.
 */
export function pathForWorkflowStep(
  index: number,
  contractId: string | null
): string | null {
  if (index <= 0) return "/new";
  if (!contractId) return null;
  const child = WORKFLOW_CHILD_BASES[index - 1];
  return child ? `/workflow/${contractId}/${child}` : null;
}

/**
 * Title for the top-bar breadcrumb. The active step is rendered as the
 * suffix so deep-linkers see the workflow tree ("Workflow · Editor", etc.).
 */
export function titleForPathname(pathname: string): string {
  if (pathname === "/new") return "New Document";
  if (/\/workflow\/[^/]+\/editor$/.test(pathname)) return "Workflow · Editor";
  if (/\/workflow\/[^/]+\/review$/.test(pathname)) return "Workflow · Review";
  if (/\/workflow\/[^/]+\/sign$/.test(pathname)) return "Workflow · Sign & Publish";
  if (/\/workflow\/[^/]+\/audit$/.test(pathname)) return "Workflow · Audit Timeline";
  return "Dashboard";
}

/**
 * Per-document workflow child route (step 1-4) for a given lifecycle status.
 * Used by the sidebar Recent list so clicking a document opens it on the
 * step that matches its current state — Draft → editor, InReview → review,
 * PendingSignature → sign, Published/Obsolete → audit (terminal states
 * surface their trail rather than the editor).
 */
export function childRouteForStatus(
  status:
    | "Draft"
    | "InReview"
    | "PendingSignature"
    | "Published"
    | "Obsolete"
): (typeof WORKFLOW_CHILD_BASES)[number] {
  switch (status) {
    case "Draft":
      return "editor";
    case "InReview":
      return "review";
    case "PendingSignature":
      return "sign";
    case "Published":
    case "Obsolete":
      return "audit";
  }
}

/**
 * Build the workflow child path for a given contract id + status. Returns
 * `null` when no contract id is supplied so callers can short-circuit.
 */
export function workflowPathForStatus(
  contractId: string | null | undefined,
  status:
    | "Draft"
    | "InReview"
    | "PendingSignature"
    | "Published"
    | "Obsolete"
): string | null {
  if (!contractId) return null;
  return `/workflow/${contractId}/${childRouteForStatus(status)}`;
}