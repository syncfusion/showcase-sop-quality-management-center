/**
 * Editor Workspace — Screen 2 (`/editor/:contractId`)
 *
 * Core showcase screen and the single editor entry point. A Syncfusion
 * DocumentEditorContainerComponent (lazy route) with a Ribbon-style toolbar
 * loads the mapped template's real `.docx` (import fidelity), plus a side panel
 * (Merge fields → MockDataDialog preview, Clause library, Editing restrictions),
 * two feature checkboxes (comments/timestamps, section restrictions) that
 * default OFF, a "View as" role switcher, and a "Compare versions" hand-off that
 * carries the live-edited document to Review (Screen 3).
 *
 * States: editor loading, service-down banner, contract-not-found, empty.
 */

import {
  Component,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
  type Ref,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  DocumentEditorContainerComponent,
  Ribbon,
  type DocumentEditorContainerComponent as DocumentEditorContainerType,
} from "@syncfusion/ej2-react-documenteditor";
import {
  TabComponent,
  TabItemDirective,
  TabItemsDirective,
} from "@syncfusion/ej2-react-navigations";
import type { SelectEventArgs } from "@syncfusion/ej2-navigations";
import { ComboBoxComponent, DropDownListComponent } from "@syncfusion/ej2-react-dropdowns";
import { ButtonComponent, CheckBoxComponent, type ChangeEventArgs } from "@syncfusion/ej2-react-buttons";
import { SkeletonComponent } from "@syncfusion/ej2-react-notifications";
import { TooltipComponent } from "@syncfusion/ej2-react-popups";
import { showToast } from "../components/AppToast";
import { LabelChip } from "../components/StatusChip";
import { StateMessage } from "../components/StateMessage";
import MockDataDialog from "../components/editor/MockDataDialog";
import { useContract, useReviewers, useTemplateCatalog } from "../hooks/useAsync";
import { contractService } from "../services/contractService";
import {
  blobToBase64,
  documentEndpoint,
  exportSfdtAsDocxBase64,
  importDocxBase64AsSfdt,
  importTemplateAsSfdt,
  mailMerge,
  normalizeDocxUrl,
} from "../services/documentService";
import {
  appendVersion,
  ensureSeedVersion,
  getLatestVersion,
  getVersion,
  listVersions,
  setEditedDoc,
  type DocVersion,
} from "../services/editedDocStore";
import { logAction } from "../services/auditStore";
import { bumpContractsRefresh } from "../data/contractsRefresh";
import { getUploadedDoc } from "../data/uploadedDocStore";
import { isUploadedCatalogEntry, buildUploadedCatalogEntry, resolveCatalogEntry, resolveMockSopCatalogEntry } from "../data/demoMapping";
import type { ContractDetail, ReviewAssignment, Reviewer, TemplateCatalogEntry } from "../models";
import "../styles/pages.css";
import { reviewersSeed } from "../data/reviewers";

DocumentEditorContainerComponent.Inject(Ribbon);

type SideTab = "merge" | "clauses" | "assignments";
/**
 * View-as persona union. The "View as" ComboBox, the EJ2
 * `container.currentUser`, and the per-section editable-region owner all
 * key off the same person-name string. This makes "switch View-as to
 * unlock a region" work as advertised: a section assigned to
 * `Sarah Hughes` becomes editable only when View-as is `Sarah Hughes`.
 *
 * The union mirrors `reviewersSeed` in `data/reviewers.ts`. Adding a new
 * persona = appending a row there; the type, the ComboBox data source, and
 * the editable-region keying all pick it up automatically.
 */
type Role =
  | "Adam Bennett"
  | "Sarah Hughes"
  | "Michael Tran"
  | "Laura Phillips"
  | "Daniel Carter";

const SIDE_TABS: { id: SideTab; text: string }[] = [
  // { id: "merge", text: "Merge fields" },
  // { id: "clauses", text: "Clause library" },
  { id: "assignments", text: "Editing restrictions" },
];

// The "View as" ComboBox is fed from the canonical 5-persona reviewer list
// (see `data/reviewers.ts`). Keeping the source-of-truth there means the
// `Role` union, the dropdown, and the editable-region model stay in
// lock-step — add a row in `reviewersSeed` and all three update at once.
const ROLE_IDS: Role[] = reviewersSeed.map((r) => r.name) as Role[];
const DEFAULT_ROLE: Role = "Adam Bennett";
const DEFAULT_FONT_FAMILY = "Calibri";
const DEMO_COMMENT_TEXT =
  "Please review the highlighted terms before circulating this draft.";

/**
 * Extract a human message from a rejected mock-service call. The service rejects
 * with an `AppError` object ({ code, message, retryable }), which is not an
 * `Error` instance — so `e.message` alone would be lost. Falls back to a default.
 */
function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return fallback;
}

/** Run an editor mutation with track changes forced off, then restore it. */
function withTrackChangesSuspended(
  editor: DocumentEditorContainerType["documentEditor"],
  fn: () => void
): void {
  const previous = editor.enableTrackChanges;
  try {
    editor.enableTrackChanges = false;
    fn();
  } finally {
    editor.enableTrackChanges = previous;
  }
}

export default function EditorWorkspace() {
  const { contractId = "" } = useParams();
  const navigate = useNavigate();
  const contract = useContract(contractId);
  const catalog = useTemplateCatalog();
  const reviewers = useReviewers();

  const catalogEntry = useMemo<TemplateCatalogEntry | null>(() => {
    // For uploaded contracts, the server catalog has no entry — synthesize a
    // minimal `TemplateCatalogEntry` so the editor / side panels can render
    // uniformly. `docxUrl` is left empty, which `loadContractIntoEditor`
    // detects to switch to the base64 import path.
    if (contract.data?.templateId === "tpl-uploaded") {
      return buildUploadedCatalogEntry(
        contract.data.id,
        contract.data.title,
        contract.data.updatedDate
      );
    }
    return (
      resolveCatalogEntry(catalog.data, contract.data?.templateId ?? "") ??
      // Fallback: the legacy `tpl-nda-mutual` / `tpl-service-agreement` /
      // `tpl-purchase-contract` ids no longer exist in the client-side
      // catalog (it now ships 3 SOPs only). Synthesise a catalog entry
      // pointing at the SOP .docx shipped under `public/docx-templates/`,
      // routed by the contract's account id.
      resolveMockSopCatalogEntry(contract.data)
    );
  }, [
    catalog.data,
    contract.data?.templateId,
    contract.data?.id,
    contract.data?.title,
    contract.data?.updatedDate,
    contract.data?.accountId,
  ]);

  const containerRef = useRef<DocumentEditorContainerType | null>(null);
  const contractRef = useRef(contract.data);
  contractRef.current = contract.data;
  const catalogEntryRef = useRef<TemplateCatalogEntry | null>(null);
  catalogEntryRef.current = catalogEntry;
  const roleRef = useRef<Role>(DEFAULT_ROLE);
  const demoCommentInsertedRef = useRef(false);
  // Previous-tick flags for the comments / restrictions checkboxes. The
  // protection effect re-runs whenever the editor reloads or `currentRole`
  // changes, so we only want to log a checkbox transition (not every effect
  // run). `null` = "first run, don't log".
  const prevCommentsEnabledRef = useRef<boolean | null>(null);
  const prevRestrictionsEnabledRef = useRef<boolean | null>(null);
  // Tracks `${sectionBookmark}::${user}` signatures already turned into editable
  // regions on the live document, so re-running the protection effect (on role
  // switch, etc.) re-enforces the lock without inserting duplicate regions.
  // Reset when the document reloads (regions live in the document, not React).
  const appliedSectionsRef = useRef<Set<string>>(new Set());
  // Tracks the `DocVersion.id` most recently opened into the EJ2 editor. The
  // version-load effect re-runs on every `activeVersionId` change, including
  // the redundant "point at the freshly-saved version" call in
  // `handleSaveAsNewVersion` (where the live editor already matches the saved
  // bytes). Reloading in that case round-trips the SFDT through the backend's
  // DocIO Import/Export pipeline, which is lossy — track-changes, comments,
  // and any unsynced editor state get dropped on the floor and the user sees
  // the document revert to its pre-save content. Comparing against this ref
  // lets the effect bail out before the round-trip when the requested version
  // is already loaded.
  const lastLoadedVersionIdRef = useRef<string | null>(null);
  // The version dropdown fires multiple `change` events whenever its `value`
  // prop changes externally — and crucially, the event payload oscillates
  // between the new value and the previous one in the same flush (logged
  // during diagnostics as `e.value=v3, v3, v4, v4` after a save from v2→v3).
  // A state- or ref-based equality check on the change handler can't tell
  // these apart from a genuine user pick, so the handler would happily
  // re-apply the previous value, reverting the dropdown and reloading the
  // editor against the now-stale version.
  //
  // To suppress the phantom batch: every site that updates the dropdown's
  // `value` prop programmatically (initial mount in `handleEditorCreated`,
  // `handleSaveAsNewVersion`) stamps `suppressDropdownChangeFor` with the
  // target value. The change handler then ignores the *next* change event
  // whose `e.value` matches the suppressed id — that's always the phantom
  // oscillation, never a real user pick, because a real user pick selects
  // a different version than the one we just programmed in. After the
  // phantom is absorbed, the ref clears so a subsequent genuine user pick
  // (which can be any other version) flows through normally.
  const suppressDropdownChangeFor = useRef<string | null>(null);
  // Mirror of `activeVersionId` updated synchronously each render. The
  // change handler reads this so the equality check sees the freshest
  // value even when the state-update batch hasn't flushed yet.
  const activeVersionIdRef = useRef<string | null>(null);
  /**
   * Wipe the editor's session-scoped flags when a different version is opened
   * (initial mount with the latest version, or a dropdown switch). Both
   * `handleEditorCreated` and `handleSelectVersion` call this so the
   * comments/protection effects re-initialise cleanly for the new document.
   */
  function resetEditorSessionState() {
    demoCommentInsertedRef.current = false;
    appliedSectionsRef.current = new Set();
  }
  const [tab, setTab] = useState<SideTab>("merge");
  const [serviceDown, setServiceDown] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [commentsEnabled, setCommentsEnabled] = useState(false);
  const [restrictionsEnabled, setRestrictionsEnabled] = useState(false);
  const [previewWithData, setPreviewWithData] = useState(false);
  const [currentRole, setCurrentRole] = useState<Role>(DEFAULT_ROLE);
  // History summary for the heading chip (latest id + total count). Refreshed
  // after every `appendVersion` so the user sees v2/v3 appear as they save.
  const [versionsSummary, setVersionsSummary] = useState<{ latestId: string; count: number } | null>(null);
  const [editorMounted, setEditorMounted] = useState(false);
  const [mockDialogOpen, setMockDialogOpen] = useState(false);
  const [documentSlots, setDocumentSlots] = useState<{ id: string; label: string }[]>([]);
  // Active version the editor should open (and keep loaded after a version
  // switch). Null until `listVersions` resolves; on first resolve it defaults
  // to the latest version (or to a user-picked id from the dropdown). The
  // `attempt` counter bumps after every `handleSaveAsNewVersion` so the
  // dropdown re-reads the version list and the new row appears immediately.
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [versionReloadToken, setVersionReloadToken] = useState(0);
  const [attempt, setAttempt] = useState(0);
  // True between the first edit and the next save/version-load. "Create new
  // version" gates on this to avoid empty checkpoints, and "Submit for
  // review" uses it to skip a duplicate snapshot when the user just clicked
  // Save immediately before submitting.
  const [isDirty, setIsDirty] = useState(false);
  roleRef.current = currentRole;
  activeVersionIdRef.current = activeVersionId;

  // Mount EJ2 Document Editor after the workspace chrome commits. React 19
  // StrictMode would otherwise create+destroy the editor in one turn, which
  // leaves toolbar nodes React no longer owns (insertBefore NotFoundError).
  // The catalog must be resolved too, since the editor imports the mapped
  // template's real .docx (resolved from the catalog entry).
  useEffect(() => {
    if (!contract.data || !catalogEntry) {
      setEditorMounted(false);
      setEditorReady(false);
      return;
    }
    // Reflect any pre-existing saved versions in the heading chip immediately
    // (the chip stays empty when there's nothing yet, which is the right
    // affordance — v1 is implicit until the user clicks Save).
    const existing = listVersions(contract.data.id);
    if (existing.length > 0) {
      setVersionsSummary({ latestId: existing[existing.length - 1].id, count: existing.length });
      // Default the active version to the most recent save so "Back to editor"
      // from Review resumes where the user left off (rather than rewinding to
      // v1 / Original). The user can still pick any version from the
      // dropdown to override this.
      setActiveVersionId((prev) =>
        prev && existing.some((v) => v.id === prev) ? prev : existing[existing.length - 1].id
      );
    } else {
      setVersionsSummary(null);
      setActiveVersionId(null);
    }
    const id = window.setTimeout(() => setEditorMounted(true), 50);
    return () => window.clearTimeout(id);
  }, [contract.data, catalogEntry]);

  // Version dropdown rows — re-derived whenever the version list changes
  // (initial mount, after a save, after a version switch). Same `{ id, label }`
  // shape Review uses so the picker mirrors that screen's affordance.
  const versionOptions = useMemo(() => {
    if (!contract.data) return [] as { id: string; label: string }[];
    return listVersions(contract.data.id).map((v) => ({
      id: v.id,
      label: `${v.id.toUpperCase()} · ${v.label}${
        v.createdBy ? ` · ${v.createdBy}` : ""
      }${v.createdAt ? ` · ${new Date(v.createdAt).toLocaleString()}` : ""}`,
    }));
  }, [contract.data, attempt]);

  // Resolve the currently-loaded `DocVersion` (the editor's source of truth)
  // and a derived "is branched" flag — true when the user picked a version
  // that's not the latest, so the heading chip can warn they're editing a
  // non-head history entry.
  const activeVersion = useMemo<DocVersion | null>(() => {
    if (!contract.data || !activeVersionId) return null;
    return getVersion(contract.data.id, activeVersionId);
  }, [contract.data, activeVersionId, attempt]);
  const isBranched = useMemo(() => {
    if (!contract.data || !activeVersionId) return false;
    const latest = getLatestVersion(contract.data.id);
    return latest != null && latest.id !== activeVersionId;
  }, [contract.data, activeVersionId, attempt]);

  const handleEditorCreated = useCallback(() => {
    const run = () => {
      const container = containerRef.current;
      if (!container?.documentEditor) return;
      const detail = contractRef.current;
      const entry = catalogEntryRef.current;
      if (!detail || !entry) return;
      resetEditorSessionState();
      // View-as now maps 1:1 to the EJ2 `currentUser` (person name). The
      // persona is the same string the editable-region model uses to
      // decide who can edit which section.
      container.currentUser = roleRef.current;
      container.setDefaultCharacterFormat({ fontFamily: DEFAULT_FONT_FAMILY, fontSize: 11 });
      container.documentEditor.setDefaultCharacterFormat({
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: 11,
      });
      // First-mount seeding: prefer the stored version list (so the editor
      // reopens on the latest save rather than rewinding to v1). Falls back
      // to the catalog/uploaded pipeline when no versions exist yet (deep
      // link from the dashboard on a fresh session).
      const versions = listVersions(detail.id);
      if (versions.length > 0) {
        // resume on latest: the version-load effect runs before the EJ2 ref
        // attaches and bails out on its `!containerRef.current` guard, so
        // kick off the actual `editor.open(...)` here while the container is
        // freshly created. Mount is a resume, not a user-initiated switch —
        // no toast.
        const latest = versions[versions.length - 1];
        // Stamp the ref synchronously so the effect-driven re-run on the
        // same id (triggered by setActiveVersionId below) short-circuits
        // instead of round-tripping the same bytes through DocIO a second
        // time. See the `lastLoadedVersionIdRef` docstring for the why.
        lastLoadedVersionIdRef.current = latest.id;
        activeVersionIdRef.current = latest.id;
        // Suppress the phantom `change` event EJ2 will fire when the next
        // render commits the new `value` prop. See the ref's docstring.
        suppressDropdownChangeFor.current = latest.id;
        setActiveVersionId(latest.id);
        setEditorReady(false);
        setServiceDown(false);
        void loadVersionIntoEditor(container, latest, {
          onReady: () => {
            applyCalibriDefault(container.documentEditor);
            setDocumentSlots(resolveDocumentSlots(safeGetBookmarks(container.documentEditor)));
            setEditorReady(true);
          },
          onServiceDown: () => {
            setServiceDown(true);
            setEditorReady(true);
          },
        });
        return;
      }
      void loadContractIntoEditor(container, entry, contractId, {
        onReady: () => {
          applyCalibriDefault(container.documentEditor);
          setEditorReady(true);
          // Surface the template's real clause-slot bookmarks (the
          // "[Insert … Clause: …]" placeholders) as the insertion targets.
          setDocumentSlots(resolveDocumentSlots(safeGetBookmarks(container.documentEditor)));
        },
        onServiceDown: () => {
          setServiceDown(true);
          setEditorReady(true);
        },
      });
    };
    if (containerRef.current?.documentEditor) {
      // Wire the dirty tracker once on first creation. The editor is brand-new,
      // so the just-loaded bytes ARE the saved state — start clean.
      // Syncfusion's DocumentEditor exposes a typed `contentChange` event
      // (see DocumentEditorModel.contentChange: EmitType<ContentChangeEventArgs>).
      // Subscribe via the Component base's `.on(event, handler)` API rather
      // than DOM addEventListener, which doesn't see EJ2's internal bus.
      containerRef.current.documentEditor.on("contentChange", () => setIsDirty(true));
      run();
    } else requestAnimationFrame(run);
  }, []);

  /**
   * Re-import the editor when the active version changes — covers both the
   * initial load (the first-mount seeding above sets `activeVersionId` to the
   * latest, but the editor doesn't actually open that version yet) and any
   * subsequent dropdown selection (`handleSelectVersion` bumps
   * `versionReloadToken`). The reload token is the primary trigger; we don't
   * depend on `editorReady` directly to avoid a feedback loop (this effect
   * sets `editorReady=false` while loading, then `true` on success).
   *
   * No-op when the requested version id matches the one already loaded
   * (`lastLoadedVersionIdRef`). Without this guard, the redundant
   * `setActiveVersionId(created.id)` call in `handleSaveAsNewVersion` would
   * round-trip the freshly-saved SFDT back through DocIO's Import/Export and
   * `editor.open(...)` over the live document — losing track-changes,
   * comments, and any unsynced editor state. The live state already matches
   * the saved bytes byte-for-byte, so re-importing them is both unnecessary
   * and lossy.
   */
  useEffect(() => {
    if (!containerRef.current || !activeVersion) return;
    if (lastLoadedVersionIdRef.current === activeVersion.id) return;
    const container = containerRef.current;
    setServiceDown(false);
    setEditorReady(false);
    resetEditorSessionState();
    // The freshly-loaded version matches the editor's current state byte-for-byte,
    // so the editor is no longer dirty — clicking "Create new version" again
    // would only produce an empty checkpoint until the next edit.
    setIsDirty(false);
    lastLoadedVersionIdRef.current = activeVersion.id;
    void loadVersionIntoEditor(container, activeVersion, {
      onReady: () => {
        applyCalibriDefault(container.documentEditor);
        setDocumentSlots(resolveDocumentSlots(safeGetBookmarks(container.documentEditor)));
        setEditorReady(true);
        // showToast(`Loaded ${activeVersion.id.toUpperCase()} (${activeVersion.label}).`, "Versions");
      },
      onServiceDown: () => {
        setServiceDown(true);
        setEditorReady(true);
      },
    });
  }, [activeVersionId, versionReloadToken]);

  /**
   * Dropdown handler: switch which `DocVersion` is loaded into the editor.
   * Always creates a NEW version on save (`appendVersion` never overwrites),
   * so picking v2 and clicking "Save as new version" produces v(N+1) — a
   * branch, not an overwrite.
   *
   * Reads `activeVersionIdRef` instead of the `activeVersionId` state for
   * the dedupe check. EJ2's DropDownList fires a `change` event when the
   * parent's `value` prop changes externally (e.g. after a save flips it
   * from `v2` → `v3`), and the event payload carries the *previous* value
   * (`v2`). The state in the closure has already advanced to `v3`, so a
   * state-based dedupe check passes `v2 !== v3` and the handler proceeds,
   * reverting the dropdown and triggering an editor reload against the
   * now-stale v2. The ref mirrors the state synchronously and still sees
   * `v3`, so the dedupe catches the phantom event.
   */
  function handleSelectVersion(versionId: string) {
    if (!versionId || versionId === activeVersionIdRef.current) return;
    activeVersionIdRef.current = versionId;
    setActiveVersionId(versionId);
    setVersionReloadToken((t) => t + 1);
  }

  // Must keep the trailing slash: the DocumentEditorContainer appends built-in
  // action names directly (e.g. serviceUrl + "RestrictEditing"), so stripping
  // it yields ".../documenteditorRestrictEditing" → 404 when enforcing
  // protection. Import/Export use manual fetches and are unaffected.
  const editorServiceUrl = useMemo(() => documentEndpoint(""), []);

  // Apply role-based protection + comments/track-changes when toggled. Do this
  // via the EJ2 instance — never by changing DocumentEditorContainerComponent
  // props after mount. Checking comments inserts one dated review comment on
  // the open document and shows the comments pane. Protection is gated on
  // `restrictionsEnabled` (when off, editing is unrestricted).
  useEffect(() => {
    if (!containerRef.current || !editorReady) return;
    const editor = containerRef.current.documentEditor;
    // The View-as persona IS the EJ2 `currentUser` (a person name). The
    // editable-region model keys regions on the same string, so picking a
    // persona in the toolbar unlocks exactly the sections assigned to that
    // person.
    containerRef.current.currentUser = currentRole;
    try {
      editor.enableComment = commentsEnabled;
      if (commentsEnabled) {
        if (!demoCommentInsertedRef.current) {
          const inserted = insertDemoCommentOnOpenDocument(editor, currentRole);
          if (inserted) {
            demoCommentInsertedRef.current = true;
            showToast("Added a review comment with author and timestamp.", "Comments");
          }
        }
        editor.showComments = true;
      } else {
        editor.showComments = false;
      }
      editor.enableTrackChanges = commentsEnabled;
      // Audit-log the checkbox transitions only — the effect fires on every
      // `currentRole` / `editorReady` change, but only the actual user-driven
      // commentsEnabled / restrictionsEnabled flips should appear in the
      // timeline.
      if (
        prevCommentsEnabledRef.current !== null &&
        prevCommentsEnabledRef.current !== commentsEnabled &&
        contract.data
      ) {
        logAction(contract.data.id, {
          category: "feature",
          action: commentsEnabled ? "enable-comments" : "disable-comments",
          summary: `${commentsEnabled ? "Enabled" : "Disabled"} comments & timestamps`,
          actor: currentRole,
          payload: { persona: currentRole },
        });
      }
      prevCommentsEnabledRef.current = commentsEnabled;
      if (
        prevRestrictionsEnabledRef.current !== null &&
        prevRestrictionsEnabledRef.current !== restrictionsEnabled &&
        contract.data
      ) {
        logAction(contract.data.id, {
          category: "feature",
          action: restrictionsEnabled ? "enable-restrictions" : "disable-restrictions",
          summary: `${restrictionsEnabled ? "Enabled" : "Disabled"} section editing restrictions`,
          actor: currentRole,
          payload: { persona: currentRole },
        });
      }
      prevRestrictionsEnabledRef.current = restrictionsEnabled;
      const assignments = contract.data?.assignments ?? [];
      if (!restrictionsEnabled) {
        // No restrictions → fully editable, regardless of assignments.
        editor.isReadOnly = false;
        editor.editor.stopProtection("claw-demo");
      } else if (assignments.length > 0) {
        // Per-section model: lock the whole document, then unlock each assigned
        // section as an editable region keyed to its reviewer's name. The
        // View-as persona (currentUser, set above) decides which regions the
        // current viewer can actually edit.
        applyAllRestrictions(editor, assignments, reviewers.data ?? [], appliedSectionsRef.current);
      } else {
        // Fallback (no assignments + restrictions on): whole-document
        // ReadOnly. The legacy per-role protection matrix
        // (Legal → CommentsOnly, Finance → ReadOnly, …) was retired with the
        // persona unification — see `data/reviewers.ts` for the new
        // single-vocabulary model.
        editor.editor.stopProtection("claw-demo");
        editor.editor.enforceProtection("claw-demo", "ReadOnly");
      }
    } catch {
      // stopProtection errors when not protected; ignore in demo mode.
    }
  }, [currentRole, editorReady, commentsEnabled, restrictionsEnabled, contract.data?.assignments, reviewers.data]);

  /**
   * Serialize the editor, export it to a DOCX (base64) via the backend, and
   * stash it keyed by contractId so downstream screens (Review, Sign & Publish)
   * can reopen the live-edited document. Non-fatal: those screens fall back to
   * the pristine template baseline when nothing is stashed.
   */
  async function persistEditedDoc() {
    if (!contract.data) return;
    const container = containerRef.current;
    try {
      if (container?.documentEditor) {
        const sfdt = container.documentEditor.serialize();
        const base64 = await exportSfdtAsDocxBase64(sfdt);
        setEditedDoc(contract.data.id, base64);
      }
    } catch {
      // Non-fatal — downstream screens handle a missing edited doc gracefully.
    }
  }

  /**
   * Carry the live-edited document to Review (Screen 3): stash it, snapshot
   * the live editor as a new version (so the All Documents `Version` column
   * advances in lock-step with the existing Save-as-new-version flow), mark
   * the contract as `InReview`, mirror the transition into the audit
   * timeline, and navigate. Review compares this (revised) against the
   * pristine template `.docx` (baseline).
   *
   * Mirrors the same `appendVersion` + `updateContractMeta` + refresh pattern
   * that `handleSaveAsNewVersion` uses, so submitting for review bumps the
   * version number on the All Documents grid identically to a manual save.
   * The status bump goes through `updateContractMeta` (forward-only — never
   * regresses InReview → Draft) and fans out via `bumpContractsRefresh()` so
   * every contract-derived view re-fetches without a hard reload.
   */
  async function handleCompareVersions() {
    if (!contract.data) return;
    await persistEditedDoc();
    const container = containerRef.current;
    const previousStatus = contract.data.status;
    let snapshot: Awaited<ReturnType<typeof snapshotLiveEditorAsNewVersion>> | null = null;
    // Only snapshot when the editor has unsaved changes. Skips the duplicate
    // version when the user just clicked "Create new version" immediately
    // before submitting — both buttons write to the same appendVersion
    // path, so a save-then-submit would otherwise produce two versions of
    // identical content. When the editor is clean, the live document
    // already equals the latest version and `persistEditedDoc` above has
    // refreshed the edited-DOCX handoff that Review reads.
    if (container?.documentEditor && isDirty) {
      snapshot = await snapshotLiveEditorAsNewVersion(container);
      if (!snapshot) {
        showToast("Could not snapshot the live document for review. Try again.", "Versions");
      }
    }
    // Always bump status + refresh so the grid reflects the lifecycle
    // transition, even when the version snapshot failed (the persisted edited
    // DOCX is still in `editedDocStore`, so Review can still load it).
    contractService.updateContractMeta(contract.data.id, {
      status: "InReview",
      ...(snapshot ? { updatedDate: snapshot.createdAt } : {}),
    });
    logAction(contract.data.id, {
      category: "version",
      action: "submit-for-review",
      summary: snapshot
        ? `Submitted ${snapshot.id.toUpperCase()} (${snapshot.label}) for review`
        : isDirty
          ? "Submitted draft for review"
          : "Submitted current version for review",
      actor: currentRole,
      payload: {
        previousStatus,
        nextStatus: "InReview",
        ...(snapshot ? { versionId: snapshot.id, label: snapshot.label } : {}),
      },
    });
    navigate(`/workflow/${contract.data.id}/review`);
  }

  /**
   * Serialize the live editor, round-trip through the backend DocIO
   * Import/Export, and append the result as the contract's next version
   * (v2, v3, …). Mirrors the same shape `handleSaveAsNewVersion` writes
   * through — `appendVersion` + `updateContractMeta(currentVersion)` +
   * `bumpContractsRefresh()` — so submitting for review advances the All
   * Documents `Version` column identically to a manual save. Returns the
   * created `DocVersion` on success, or `null` when the export round-trip
   * fails (caller decides how to surface the failure).
   */
  async function snapshotLiveEditorAsNewVersion(
    container: DocumentEditorContainerType
  ): Promise<DocVersion | null> {
    if (!contract.data) return null;
    try {
      const sfdt = container.documentEditor.serialize();
      const base64 = await exportSfdtAsDocxBase64(sfdt);
      const created = appendVersion(contract.data.id, base64, {
        label: `Submitted for review ${new Date().toLocaleString()}`,
        createdBy: container.currentUser,
      });
      const nextVersion = Number(created.id.slice(1));
      if (Number.isFinite(nextVersion) && nextVersion > 0) {
        contractService.updateContractMeta(contract.data.id, {
          currentVersion: nextVersion,
          updatedDate: created.createdAt,
        });
      }
      const list = listVersions(contract.data.id);
      setVersionsSummary({ latestId: created.id, count: list.length });
      setAttempt((a) => a + 1);
      // Fan out so the All Documents grid (and Dashboard KPI/Recent cards)
      // re-fetch and re-render the bumped `currentVersion` / `updatedDate`
      // immediately. `updateContractMeta` already bumps internally; calling
      // it again here is a no-op on the version side because the same
      // monotonic-max rule keeps it at `nextVersion`.
      bumpContractsRefresh();
      return created;
    } catch {
      return null;
    }
  }

  /**
   * Snapshot the current editor state as a new version in the contract's
   * history (v2, v3, …). The history is session-scoped (Map + sessionStorage);
   * Review can pick any two saved versions to compare. Best-effort: if the
   * export round-trip fails the user keeps editing with no version recorded.
   *
   * Also keeps the All Documents grid in sync: the row's `currentVersion` /
   * `updatedDate` come from the `ContractDetail` object that
   * `contractService.listContracts()` returns (a session-scoped clone of
   * `contractsSeed` for seeded contracts, or an entry in `uploadedContracts`
   * for uploads). Without this bump, the grid would keep showing the seed's
   * `V1` even after saving `v2` — the editor's own version dropdown is fed
   * from `editedDocStore` and is unaffected. `bumpContractsRefresh()` then
   * fans the change out to every contract-derived view (All Documents, the
   * Dashboard KPI/Recent cards) via the shared `useContractsRefreshKey`.
   */
  async function handleSaveAsNewVersion() {
    if (!contract.data) return;
    const container = containerRef.current;
    if (!container?.documentEditor) return;
    try {
      const sfdt = container.documentEditor.serialize();
      const base64 = await exportSfdtAsDocxBase64(sfdt);
      const created = appendVersion(contract.data.id, base64, {
        label: `Saved ${new Date().toLocaleString()}`,
        createdBy: container.currentUser,
      });
      // Keep the `ContractDetail` (the source for All Documents) in sync with
      // the freshly-saved version. `created.id` is `"v2"`, `"v3"`, … — strip
      // the prefix to get the numeric count. `updateContractMeta` is a no-op
      // when the id isn't known to the mock service (defensive — the editor
      // only runs for known contracts, so this should always hit).
      const nextVersion = Number(created.id.slice(1));
      if (Number.isFinite(nextVersion) && nextVersion > 0) {
        contractService.updateContractMeta(contract.data.id, {
          currentVersion: nextVersion,
          updatedDate: created.createdAt,
        });
      }
      const list = listVersions(contract.data.id);
      setVersionsSummary({ latestId: created.id, count: list.length });
      // Advance the dropdown to the freshly-saved version so the "Editing:"
      // chip and the picker both reflect the new latest. The version-load
      // effect keys on `activeVersionId` and would round-trip the
      // freshly-saved bytes back through DocIO's Import/Export — losing
      // track-changes, comments, and any unsynced editor state. To skip
      // that re-import, stamp `lastLoadedVersionIdRef` to the new id
      // *before* flipping `activeVersionId`: the effect then sees the two
      // match and bails out before the round-trip. The live EJ2 editor
      // already matches the saved bytes byte-for-byte, so re-importing is
      // both unnecessary and lossy.
      lastLoadedVersionIdRef.current = created.id;
      activeVersionIdRef.current = created.id;
      // Suppress the phantom `change` events EJ2 will fire when the next
      // render commits the new `value` prop. Without this, the dropdown
      // reverts to the pre-save id and the version-load effect re-imports
      // the now-stale version (reverting the editor content). See the
      // `suppressDropdownChangeFor` ref docstring for the full cause.
      suppressDropdownChangeFor.current = created.id;
      setActiveVersionId(created.id);
      setAttempt((a) => a + 1);
      // The just-saved bytes match the live editor byte-for-byte, so the
      // editor is no longer dirty — clicking "Submit for review" without
      // any new edits would otherwise produce a duplicate snapshot.
      setIsDirty(false);
      showToast(`Created ${created.id.toUpperCase()} (${created.label}). Previous version preserved.`, "Versions");
      // Mirror the action into the per-contract audit log so the
      // /audit/:contractId route picks it up.
      logAction(contract.data.id, {
        category: "version",
        action: "save",
        summary: `Saved ${created.id.toUpperCase()} (${created.label})`,
        actor: container.currentUser,
        payload: { versionId: created.id, label: created.label },
      });
      // Fan the change out to All Documents / Dashboard so they re-fetch and
      // re-render the bumped `currentVersion` / `updatedDate` immediately,
      // rather than waiting for a hard reload.
      bumpContractsRefresh();
    } catch {
      showToast("Could not save the new version. Try again.", "Versions");
    }
  }

  /**
   * Apply a selected mock dataset to the loaded document by filling every
   * «MERGEFIELD» server-side via DocIO mail merge (the reference workflow).
   * Serializes the current doc, runs the merge, then reopens the merged SFDT so
   * all fields resolve in one pass. Invoked by the MockDataDialog on confirm.
   */
  async function applyMockMergeData(values: Record<string, string>, datasetName: string) {
    const editor = containerRef.current?.documentEditor;
    setMockDialogOpen(false);
    if (!editor) return;
    try {
      const sfdt = editor.serialize();
      const merged = await mailMerge(sfdt, values);
      editor.open(merged);
      setPreviewWithData(true);
      showToast(`Populated the contract with "${datasetName}" data.`, "Preview with data");
    } catch {
      showToast("Could not apply the mock dataset. Try again.", "Preview with data");
    }
  }

  async function handleAssign(section: string, reviewerId: string, level: "ReadOnly" | "CommentsOnly") {
    if (!contract.data) return;
    const reviewer = (reviewers.data ?? []).find((r) => r.id === reviewerId);
    let assignment: ReviewAssignment | null = null;
    try {
      assignment = await contractService.assignSection({
        contractId: contract.data.id,
        sectionId: section,
        reviewerId,
        protectionLevel: level,
      });
    } catch (e) {
      const message = errorMessage(e, "Assignment failed.");
      // Re-assigning a section that was already assigned this session is a
      // no-op on the store — fall through and (re)apply the live region rather
      // than hard-failing, so the demo stays interactive. Any other failure
      // (unknown reviewer, missing contract) surfaces its real message.
      if (!/already assigned/i.test(message)) {
        showToast(message, "Editing restrictions");
        return;
      }
    }
    const sectionName = assignment?.sectionName ?? humanizeSection(section);
    const reviewerName = assignment?.reviewerName ?? reviewer?.name ?? "the reviewer";
    // The editable-region owner is the reviewer's **name**, not their role.
    // This is what makes "View as <name>" unlock the regions assigned to
    // that person — see `applyEditableRegionForAssignment`.
    const user = reviewer?.name ?? assignment?.reviewerName ?? reviewerName;
    // Audit-log the assignment regardless of whether restrictionsEnabled is
    // on (store + showToast handle the "not yet enforced" case gracefully).
    // actor is the persona the user is currently viewing as, which matches
    // the rest of the editor's attribution pattern.
    logAction(contract.data.id, {
      category: "permission",
      action: "assign",
      summary: `Assigned ${sectionName} to ${reviewerName} (${level === "CommentsOnly" ? "can edit" : "read-only"})`,
      actor: currentRole,
      payload: { section, reviewerId, reviewerName, level },
    });
    const editor = containerRef.current?.documentEditor;
    // Only "Can Edit" grants an editable region; "Read-only" keeps the
    // section locked for everyone (it still shows in the restriction strip).
    // Applying a live region requires the restriction lock to be on.
    if (editor && restrictionsEnabled && level === "CommentsOnly") {
      try {
        editor.editor.stopProtection("claw-demo");
      } catch {
        // Not yet protected — inserting the region below is safe.
      }
      const applied = applyEditableRegionForAssignment(editor, section, user);
      if (applied) appliedSectionsRef.current.add(`${section}::${user}`);
      try {
        editor.editor.enforceProtection("claw-demo", "ReadOnly");
      } catch {
        // Ignore: enforceProtection is a no-op when already protected.
      }
      showToast(
        applied
          ? `${sectionName} is now editable for ${user}. Switch "View as" to ${user} to preview.`
          : `Assigned ${sectionName} to ${reviewerName}, but this template has no matching section to unlock.`,
        "Editing restrictions"
      );
      return;
    }
    showToast(
      restrictionsEnabled
        ? `Assigned ${sectionName} to ${reviewerName} (read-only).`
        : `Assigned ${sectionName} to ${reviewerName}. Enable "Apply section editing restrictions" to lock the document.`,
      "Editing restrictions"
    );
  }

  const loading = contract.loading || catalog.loading;
  const notFound = !loading && (contract.error || !contract.data);

  return (
    <section aria-labelledby="editor-title">
      {loading ? (
        <EditorSkeleton />
      ) : notFound ? (
        <ContractNotFound onBack={() => navigate("/")} />
      ) : (
        <EditorErrorBoundary key={contract.data!.id}>
        <div className="claw-editor-screen">
          <div className="claw-screen-heading">
            <div>
              <h2 id="editor-title">{contract.data!.title}</h2>
              {versionsSummary ? (
                <div className="claw-version-chip-row" aria-label="Saved versions">
                  <LabelChip text={`Latest: ${versionsSummary.latestId.toUpperCase()}`} cssClass="e-info" />
                  <LabelChip
                    text={`${versionsSummary.count} version${versionsSummary.count === 1 ? "" : "s"} saved`}
                  />
                  {activeVersionId ? (
                    // The live editor matches the freshly-saved bytes
                    // whenever `activeVersionId` is at-or-ahead of the
                    // `latest` (set by `handleSaveAsNewVersion` to skip the
                    // reload). In that case the chip reads "Editing: Vn"
                    // without "branched" — same as the head of history.
                    // `isBranched` flips to true only when the user
                    // explicitly picks a non-latest version from the
                    // dropdown.
                    <LabelChip
                      text={`Editing: ${(isBranched ? activeVersionId : versionsSummary.latestId).toUpperCase()}${isBranched ? " · branched" : ""}`}
                      cssClass={isBranched ? "e-warning" : "e-info"}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="claw-actions">
              {/* Icon-only audit link — lives first so it stays reachable
                  when the right-side action stack is the focal point. The
                  aria-label is the accessible name; the visible content is
                  just the icon glyph. */}
              <TooltipComponent
                content="Audit Timeline"
                position="BottomCenter"
                cssClass="claw-action-tip"
              >
                <ButtonComponent
                  cssClass="claw-button claw-button-icon"
                  type="button"
                  onClick={() => navigate(`/workflow/${contract.data!.id}/audit`)}
                  aria-label="Open audit timeline"
                >
                  <span className="e-icons e-history" aria-hidden="true" />
                </ButtonComponent>
              </TooltipComponent>
              <ButtonComponent
                cssClass="claw-button"
                type="button"
                onClick={handleSaveAsNewVersion}
                disabled={!editorReady}
              >
                <span className="e-icons e-save" aria-hidden="true" style={{ marginRight: 6 }} />
                Create new version
              </ButtonComponent>
              <ButtonComponent
                cssClass="claw-button primary"
                isPrimary
                type="button"
                onClick={handleCompareVersions}
                disabled={!editorReady}
              >
                Review
                <span className="e-icons e-arrow-right" aria-hidden="true" style={{ marginLeft: 6 }} />
              </ButtonComponent>
            </div>
          </div>

          {serviceDown ? (
            <StateMessage severity="Error" title="Document Editor service unavailable">
              <p>The template document could not be imported. Start the ContractWorkspace.DocumentService and reopen.</p>
            </StateMessage>
          ) : null}

          <div className="claw-feature-controls" aria-label="Document Editor feature preview controls">
            <div className="claw-feature-toggle">
              <CheckBoxComponent
                checked={commentsEnabled}
                change={(e: ChangeEventArgs) => setCommentsEnabled(!!e.checked)}
                cssClass="claw-feature-check"
              />
              <span>
                <strong>Enable comments &amp; Track changes</strong>
                <small>Insert a review comment on the open document with author and date/time, and record edits as tracked revisions.</small>
              </span>
            </div>
            <div className="claw-feature-toggle">
              <CheckBoxComponent
                checked={restrictionsEnabled}
                change={(e: ChangeEventArgs) => setRestrictionsEnabled(!!e.checked)}
                cssClass="claw-feature-check"
              />
              <span>
                <strong className="claw-feature-title">
                  <span>Apply section editing restrictions</span>
                  <TooltipComponent
                    content="With sections assigned below, a reviewer can edit only the sections assigned to their role; otherwise Legal is limited to comments and Finance is read-only."
                    position="TopCenter"
                    cssClass="claw-feature-tip"
                  >
                    <span className="claw-info-icon e-icons e-circle-info" role="img" aria-label="More about section editing restrictions" tabIndex={0} />
                  </TooltipComponent>
                </strong>
                <small>Locks the document, then use the <strong>View as</strong> switcher to preview each role's access.</small>
              </span>
            </div>
          </div>

          {restrictionsEnabled ? (
            <div className="claw-restriction-strip" aria-label="Active reviewer restrictions">
              {buildRestrictions(contract.data!).map((r) => (
                <LabelChip key={r} text={r} />
              ))}
            </div>
          ) : null}

          <div className="claw-workspace-toolbar">
            <div className="claw-toolbar-group">
              <LabelChip text={previewWithData ? "Preview with data" : "Draft"} cssClass="e-info" />
            </div>
            <div className="claw-toolbar-group">
              <label htmlFor="editor-version-picker" className="muted" style={{ fontSize: 12 }}>
                Version
              </label>
              <DropDownListComponent
                id="editor-version-picker"
                cssClass="claw-form-dropdown claw-version-select"
                dataSource={versionOptions}
                fields={{ text: "label", value: "id" }}
                // Display the latest saved id when the live editor matches
                // it (i.e. after a save or on a fresh head-of-history
                // mount), and the user's explicit pick only when they
                // branched. Mirrors the "Editing:" chip logic so the
                // dropdown and chip can never disagree. `activeVersionId`
                // is advanced on save to `created.id`; the version-load
                // effect's `lastLoadedVersionIdRef` guard prevents the
                // re-import, and the dropdown's `change` handler swallows
                // the phantom events EJ2 emits while the prop settles. See
                // `handleSaveAsNewVersion` for the why.
                value={isBranched ? activeVersionId : (versionsSummary?.latestId ?? activeVersionId)}
                change={(e) => {
                  const v = e.value ? String(e.value) : null;
                  if (!v) return;
                  // Swallow the phantom event EJ2 emits with the
                  // programmatically-applied value (or any of the values in
                  // its oscillation batch — they're all the suppressed id
                  // or the previous one, and the previous one won't equal
                  // the new id so the only false-positive we'd see is the
                  // suppressed id itself).
                  if (v === suppressDropdownChangeFor.current) {
                    suppressDropdownChangeFor.current = null;
                    return;
                  }
                  handleSelectVersion(v);
                }}
                placeholder={versionOptions.length > 0 ? "Select a version" : "No versions yet"}
                enabled={versionOptions.length > 0}
                aria-label="Editor version"
              />
            </div>
            <div className="claw-toolbar-group">
              <label htmlFor="role-switcher" className="muted" style={{ fontSize: 12 }}>
                View as
              </label>
              <div className="claw-role-switcher">
                <ComboBoxComponent
                  id="role-switcher"
                  width="160px"
                  dataSource={ROLE_IDS}
                  value={currentRole}
                  change={(args) => args.value && setCurrentRole(args.value as Role)}
                  aria-label="View as role"
                />
              </div>
            </div>
          </div>

          <div className="claw-editor-layout">
            <div className="claw-editor-pane">
              <div
                className="claw-editor-loading"
                hidden={editorReady}
                aria-hidden={editorReady}
                aria-live="polite"
                aria-busy={!editorReady}
              >
                <SkeletonComponent width="40%" height="16px" style={{ marginBottom: 12 }} />
                <SkeletonComponent width="100%" height="560px" />
              </div>
              <div className="claw-editor-ej2">
                <div className="claw-editor-host">
                  {editorMounted ? (
                    <DocumentEditorIsland
                      editorRef={containerRef}
                      serviceUrl={editorServiceUrl}
                      onCreated={handleEditorCreated}
                    />
                  ) : null}
                </div>
              </div>
            </div>

            <aside className="claw-side-panel" aria-label="Editor side panel">
              <SidePanelTabs active={tab} onChange={setTab} />

              {/* {tab === "merge" ? (
                <MergeFieldsPanel
                  contract={contract.data!}
                  previewWithData={previewWithData}
                  onPreview={handlePreviewWithData}
                  onReplaceToken={replaceToken}
                />
              ) : null}
              {tab === "clauses" ? (
                <ClauseLibraryPanel
                  clauses={clauses.data ?? []}
                  loading={clauses.loading}
                  documentSlots={documentSlots}
                  insertedClauses={insertedClauses}
                  onInsert={handleInsertClause}
                />
              ) : null}
              {tab === "assignments" ? ( */}
                <AssignmentsPanel
                  contract={contract.data!}
                  reviewers={reviewers.data ?? []}
                  loading={reviewers.loading}
                  documentSlots={documentSlots}
                  onAssign={handleAssign}
                />
              {/* ) : null} */}
            </aside>
          </div>
        </div>
        </EditorErrorBoundary>
      )}
      {contract.data && catalogEntry && catalogEntry.fieldKeys.length > 0 ? (
        <MockDataDialog
          open={mockDialogOpen}
          templateName={catalogEntry.name}
          fieldKeys={catalogEntry.fieldKeys}
          onApply={(values, datasetName) => applyMockMergeData(values, datasetName)}
          onCancel={() => setMockDialogOpen(false)}
        />
      ) : null}
    </section>
  );
}

const DocumentEditorIsland = memo(
  function DocumentEditorIsland({
    editorRef,
    serviceUrl,
    onCreated,
  }: {
    editorRef: Ref<DocumentEditorContainerType>;
    serviceUrl: string;
    onCreated: () => void;
  }) {
    return (
      <DocumentEditorContainerComponent
        id="claw-doc-editor"
        ref={editorRef}
        height="610px"
        created={onCreated}
        serviceUrl={serviceUrl}
        enableToolbar
        toolbarMode="Ribbon"
        ribbonLayout="Simplified"
        showPropertiesPane={false}
        currentUser={DEFAULT_ROLE}
        documentEditorSettings={{ highlightEditableRanges: true }}
        enableComment={false}
      />
    );
  },
  () => true
);

class EditorErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Editor workspace failed", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <StateMessage severity="Error" title="Editor failed to load">
          <p>The document editor could not be mounted. Go back to the dashboard and open the contract again.</p>
        </StateMessage>
      );
    }
    return this.props.children;
  }
}

function SidePanelTabs({
  active,
  onChange,
}: {
  active: SideTab;
  onChange: (tab: SideTab) => void;
}) {
  const selectedItem = Math.max(0, SIDE_TABS.findIndex((item) => item.id === active));

  const handleSelected = useCallback(
    (args: SelectEventArgs) => {
      const next = SIDE_TABS[args.selectedIndex];
      if (next && next.id !== active) onChange(next.id);
    },
    [active, onChange]
  );

  return (
    <TabComponent
      cssClass="claw-side-tabs"
      width="100%"
      selectedItem={selectedItem}
      selected={handleSelected}
      overflowMode="Popup"
      showCloseButton={false}
      swipeMode="None"
      heightAdjustMode="None"
      animation={{ previous: { effect: "None" }, next: { effect: "None" } }}
    >
      <TabItemsDirective>
        {SIDE_TABS.map((item) => (
          <TabItemDirective key={item.id} header={{ text: item.text }} content="" />
        ))}
      </TabItemsDirective>
    </TabComponent>
  );
}

function AssignmentsPanel({
  contract,
  reviewers,
  loading,
  documentSlots,
  onAssign,
}: {
  contract: ContractDetail;
  reviewers: Reviewer[];
  loading: boolean;
  documentSlots: { id: string; label: string }[];
  onAssign: (section: string, reviewerId: string, level: "ReadOnly" | "CommentsOnly") => void;
}) {
  // Prefer the document's real clause-slot bookmarks — assigning one of these
  // produces a working editable region. Fall back to seeded assignments only
  // when the editor hasn't surfaced bookmarks yet AND the contract already
  // has assignments. Never invent section ids that aren't in the document:
  // the legacy hard-coded `["sec_fees", "sec_liability", "sec_termination"]`
  // fallback was the source of the SOPs showing contract sections that don't
  // exist in those docx files. The empty-state `StateMessage` rendered below
  // is the honest answer when neither source has data.
  const sections = documentSlots.length > 0
    ? documentSlots.map((s) => s.id)
    : contract.assignments.length > 0
      ? Array.from(new Set(contract.assignments.map((a) => a.sectionBookmark)))
      : [];

  const [reviewerBySection, setReviewerBySection] = useState<Record<string, string>>({});
  const [levelBySection, setLevelBySection] = useState<Record<string, "ReadOnly" | "CommentsOnly">>({});

  if (loading) {
    return <SkeletonComponent width="90%" height="80px" />;
  }

  // Sections are rendered as a single flat list. The legacy
  // Healthcare-SOP role-family grouping (`HEALTHCARE_SOP_ROLE_BY_SECTION`)
  // was retired when the View-as dropdown and the editable-region model
  // moved from role names to person names — the four role cards added
  // visual chrome without driving any model behaviour, so they're gone.
  const renderSectionRow = (section: string) => {
    // The reviewer dropdown shows every seeded persona. Drop the role
    // suffix now that "View as" uses names too — the two dropdowns share
    // a single vocabulary.
    const reviewerOptionData = reviewers.map((r) => ({ id: r.id, label: r.name }));
    return (
      <div
        key={section}
        className="claw-clause-item"
        style={{ flexDirection: "column", alignItems: "stretch", gap: 8, marginBottom: 10 }}
      >
        <strong style={{ fontSize: 12 }}>{humanizeSection(section)}</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <DropDownListComponent
            cssClass="claw-form-dropdown"
            dataSource={reviewerOptionData}
            fields={{ text: "label", value: "id" }}
            placeholder="Select reviewer…"
            value={reviewerBySection[section] || null}
            change={(e) => {
              if (e.value) setReviewerBySection((prev) => ({ ...prev, [section]: String(e.value) }));
            }}
            htmlAttributes={{ "aria-label": `Reviewer for ${section}` }}
            style={{ flex: 1, marginBottom: 0 }}
          />
          <DropDownListComponent
            cssClass="claw-form-dropdown"
            dataSource={[
              { id: "CommentsOnly", label: "Can Edit" },
              { id: "ReadOnly", label: "Read-only" },
            ]}
            fields={{ text: "label", value: "id" }}
            value={levelBySection[section] ?? "CommentsOnly"}
            change={(e) => {
              if (e.value === "ReadOnly" || e.value === "CommentsOnly") {
                setLevelBySection((prev) => ({ ...prev, [section]: e.value }));
              }
            }}
            htmlAttributes={{ "aria-label": `Protection for ${section}` }}
            style={{ flex: 1, marginBottom: 0 }}
          />
        </div>
        <ButtonComponent
          cssClass="claw-button"
          type="button"
          onClick={() => {
            if (reviewerBySection[section]) {
              onAssign(section, reviewerBySection[section], levelBySection[section] ?? "CommentsOnly");
            } else {
              showToast(
                "Select a reviewer before assigning.",
                "Editing restrictions"
              );
            }
          }}
          style={{ width: "100%", fontSize: 11 }}
        >
          Assign section
        </ButtonComponent>
      </div>
    );
  };

  return (
    <div>
      <StateMessage severity="Info" title="Editing restrictions">
        <p>
          Enable{" "}
          <strong>Apply section editing restrictions</strong> above, then switch <strong>View as</strong> to
          the same reviewer to preview their access.
        </p>
      </StateMessage>
      {sections.length > 0 ? (
        <div>{sections.map(renderSectionRow)}</div>
      ) : (
        <StateMessage severity="Info" title="No sections detected">
          <p>
            This document doesn&apos;t expose any <code>SlotBody_Slot_*</code> bookmarks, so
            section-level editing restrictions can&apos;t be applied. Edit the document
            directly, or pick a different template that ships with section anchors.
          </p>
        </StateMessage>
      )}
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div aria-live="polite" aria-busy="true">
      <SkeletonComponent width="40%" height="28px" style={{ marginBottom: 10 }} />
      <SkeletonComponent width="70%" height="14px" style={{ marginBottom: 24 }} />
      <div className="claw-feature-controls" aria-hidden="true">
        <SkeletonComponent width="80%" height="30px" />
        <SkeletonComponent width="80%" height="30px" />
        <SkeletonComponent width="40%" height="22px" />
      </div>
      <SkeletonComponent width="100%" height="610px" style={{ marginTop: 14 }} />
    </div>
  );
}

function ContractNotFound({ onBack }: { onBack: () => void }) {
  return (
    <StateMessage
      severity="Error"
      title="Contract not found"
      action={
        <ButtonComponent cssClass="claw-button" type="button" onClick={onBack}>
          Back to dashboard
        </ButtonComponent>
      }
    >
      <p>The selected contract could not be loaded. It may have been removed or the link is invalid.</p>
    </StateMessage>
  );
}

function buildRestrictions(contract: ContractDetail): string[] {
  return contract.assignments.map((a) => {
    const protection = a.protectionLevel === "CommentsOnly" ? "Can Edit" : a.protectionLevel === "ReadOnly" ? "Read-only" : "Editable range";
    // Use the reviewer's name (matches "View as" / AssignmentsPanel) so the
    // strip echoes the same identity vocabulary the user just assigned.
    return `${a.reviewerName} · ${protection}`;
  });
}

function humanizeSection(section: string): string {
  const map: Record<string, string> = {
    // Legacy contract sections.
    sec_confidentiality: "Confidentiality",
    sec_exclusions: "Exclusions",
    sec_fees: "Fees & payment",
    sec_term: "Term",
    sec_jurisdiction: "Jurisdiction",
    sec_termination: "Termination",
    sec_liability: "Liability",
    sec_general: "General",
    sec_data_protection: "Data protection",
    sec_delivery: "Delivery",
    sec_warranty: "Warranty",

    // Healthcare SOP — mirrors the section titles authored by
    // `AddClauseSlot` in `CreateHealthcareSop` of Program.cs.
    sec_pre_procedure: "Pre-Procedure Requirements",
    sec_procedure_steps: "Procedure Steps",
    sec_post_procedure: "Post-Procedure & Documentation",
    sec_adverse_event: "Adverse Event Reporting",
    sec_quality: "Quality Monitoring",

    // Laboratory SOP — mirrors the section titles authored by
    // `AddClauseSlot` in `CreateLaboratorySop` of Program.cs.
    sec_sample_receipt: "Sample Receipt & Acceptance",
    sec_reagents: "Reagents, Standards & Reference Materials",
    sec_calibration: "Calibration & Quality Control",
    sec_data_reporting: "Data Analysis & Reporting",
    sec_records: "Records & Retention",

    // Manufacturing SOP — mirrors the section titles authored by
    // `AddClauseSlot` in `CreateManufacturingSop` of Program.cs.
    sec_pre_start: "Pre-Start-Up Checks",
    sec_normal_operation: "Normal Operation",
    sec_changeover: "Changeover & Cleaning",
    sec_in_process: "In-Process Sampling & Hold",
    sec_stop: "Planned & Emergency Stop",
  };
  return map[section] ?? section.replace(/^sec_/, "").replace(/_/g, " ");
}

/**
 * Opens the mapped template's real `.docx` by streaming it through the backend
 * `POST /api/documenteditor/Import` endpoint into SFDT, then `editor.open(sfdt)`.
 * No synthetic fallback — the service-down panel shows if the import fails.
 *
 * Two import paths are supported:
 *   - Seeded templates → fetch `entry.docxUrl` server-side via
 *     `importTemplateAsSfdt(docxUrl)`.
 *   - User uploads → `entry.docxUrl` is empty; the base64 DOCX lives in the
 *     session-scoped `uploadedDocStore` keyed by the synthetic contractId, so
 *     we round-trip it through `importDocxBase64AsSfdt` instead.
 */
async function loadContractIntoEditor(
  container: DocumentEditorContainerType,
  entry: TemplateCatalogEntry,
  contractId: string,
  callbacks: { onReady: () => void; onServiceDown: () => void }
): Promise<void> {
  const editor = container.documentEditor;
  try {
    let baselineBase64: string | null = null;
    const sfdt = isUploadedCatalogEntry(entry)
      ? await (async () => {
          const uploaded = getUploadedDoc(contractId);
          if (!uploaded) throw new Error("Uploaded document not found in session store");
          baselineBase64 = uploaded.base64;
          return importDocxBase64AsSfdt(uploaded.base64);
        })()
      : await (async () => {
          const sfdtPayload = await importTemplateAsSfdt(entry.docxUrl);
          // Fetch the .docx bytes in parallel-friendly fashion so the seed can
          // record the pristine template (otherwise the Review screen would
          // compare v2 against the same v2 for seeded templates). Best-effort:
          // if the fetch fails the user can still save v2 from the editor and
          // Review will fall back to v2 == v2.
          try {
            const res = await fetch(normalizeDocxUrl(entry.docxUrl));
            if (res.ok) {
              baselineBase64 = await blobToBase64(await res.blob());
            }
          } catch {
            // ignore — see comment above.
          }
          return sfdtPayload;
        })();
    if (baselineBase64) {
      // Seed v1 exactly once per contract; subsequent loads re-use the existing
      // history so the user can compare against the original pristine upload.
      ensureSeedVersion(
        contractId,
        baselineBase64,
        isUploadedCatalogEntry(entry) ? "uploaded" : "template"
      );
    }
    editor.open(sfdt);
    callbacks.onReady();
  } catch {
    callbacks.onServiceDown();
  }
}

/**
 * Open an already-stored `DocVersion` (v1, v2, …) into the editor. Round-trips
 * the version's DOCX base64 through the backend `POST /api/documenteditor/Import`
 * endpoint into SFDT, then `editor.open(sfdt)`. Used when the editor mounts
 * with a non-empty version list (default = latest) and when the user picks a
 * different version from the toolbar dropdown. Does NOT touch the version
 * store — loading is read-only, saves always create a new version.
 *
 * Failures route through `onServiceDown` so the existing service-down
 * `StateMessage` shows uniformly across both load paths.
 */
async function loadVersionIntoEditor(
  container: DocumentEditorContainerType,
  version: DocVersion,
  callbacks: { onReady: () => void; onServiceDown: () => void }
): Promise<void> {
  const editor = container.documentEditor;
  try {
    const sfdt = await importDocxBase64AsSfdt(version.base64);
    editor.open(sfdt);
    callbacks.onReady();
  } catch {
    callbacks.onServiceDown();
  }
}

/** Apply Calibri as the editor default and restyle the opened document. */
function applyCalibriDefault(
  editor: DocumentEditorContainerType["documentEditor"]
): void {
  editor.setDefaultCharacterFormat({ fontFamily: DEFAULT_FONT_FAMILY, fontSize: 11 });
  withTrackChangesSuspended(editor, () => {
    try {
      editor.selection.selectAll();
      editor.selection.characterFormat.fontFamily = DEFAULT_FONT_FAMILY;
      editor.selection.moveToDocumentStart();
    } catch {
      // Empty or still-layouting document — default format still applies to new text.
    }
  });
}

/**
 * Attach a dated review comment to content already in the opened document
 * (title bookmark when present, otherwise the first paragraph).
 */
function insertDemoCommentOnOpenDocument(
  editor: DocumentEditorContainerType["documentEditor"],
  author: string
): boolean {
  try {
    withTrackChangesSuspended(editor, () => {
      const bookmarks = safeGetBookmarks(editor);
      const title = bookmarks.find((name) => name.startsWith("Title_"));
      if (title) {
        editor.selection.selectBookmark(title);
      } else {
        editor.selection.moveToDocumentStart();
        editor.selection.selectParagraph();
      }
      editor.editor.insertComment(DEMO_COMMENT_TEXT, {
        author,
        dateTime: new Date(),
        isResolved: false,
      });
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Template `.docx` slot names (authored by the backend
 * `ContractWorkspace.TemplateGenerator` via `AddClauseSlot`) → semantic
 * side-panel slot ids. Each slot emits two bookmarks — `Slot_Xy` around the
 * bold label and `SlotBody_Slot_Xy` around the "[Insert … Clause: …]"
 * placeholder paragraph that an insertion replaces:
 *   Mutual NDA        → Confidentiality, Exclusions, Term
 *   Service Agreement → Payment, Liability, Termination
 *   Purchase Contract → Delivery, Warranty, DataProtection
 *
 * Healthcare SOP — see `react/public/docx-templates/HealthcareSOP.docx` —
 * uses `SlotBody_Slot_<Key>` pairs authored by `scripts/patch_healthcare_sop.py`
 * for each role-based section; each one maps to its own `sec_*` id and a
 * designated SOP role family (Doctor / Nurse / Admin / Quality). The
 * editable-region flow reuses the existing per-section model: the section
 * bookmark becomes an editable region owned by the assigned reviewer's role.
 */
// Template `.docx` slot bookmark suffix → semantic side-panel slot id.
// Each `AddClauseSlot(label, "Slot_Xy", …)` call in
// `ContractWorkspace.TemplateGenerator/Program.cs` emits two bookmarks —
// `Slot_Xy` around the bold label and `SlotBody_Slot_Xy` around the body
// paragraph the clause insertion replaces. The `Slot_Xy` suffix is the
// canonical key the side panel uses to translate a live bookmark into a
// section id. Keep in sync with every `AddClauseSlot` invocation in
// `Program.cs` — if a new template adds a slot whose key isn't here, the
// bookmark will be filtered out by `resolveDocumentSlots` and the side
// panel will show the empty state for that section.
const SLOT_BY_TEMPLATE_NAME: Record<string, string> = {
  // Legacy contract templates.
  Confidentiality: "sec_confidentiality",
  Exclusions: "sec_exclusions",
  Term: "sec_term",
  Payment: "sec_fees",
  Liability: "sec_liability",
  Termination: "sec_termination",
  Delivery: "sec_delivery",
  Warranty: "sec_warranty",
  DataProtection: "sec_data_protection",

  // Healthcare SOP — see Program.cs `CreateHealthcareSop`.
  PreProcedure: "sec_pre_procedure",
  ProcedureSteps: "sec_procedure_steps",
  PostProcedure: "sec_post_procedure",
  AdverseEvent: "sec_adverse_event",
  Quality: "sec_quality",

  // Laboratory SOP — see Program.cs `CreateLaboratorySop`.
  SampleReceipt: "sec_sample_receipt",
  Reagents: "sec_reagents",
  Calibration: "sec_calibration",
  DataReporting: "sec_data_reporting",
  Records: "sec_records",

  // Manufacturing SOP — see Program.cs `CreateManufacturingSop`.
  PreStart: "sec_pre_start",
  NormalOperation: "sec_normal_operation",
  Changeover: "sec_changeover",
  InProcess: "sec_in_process",
  Stop: "sec_stop",
};

/**
 * Healthcare SOP — section → designated SOP role family. Retired in the
 * persona unification: with "View as" using person names, the four
 * role-family cards (Doctor / Nurse / Admin / Quality) added visual chrome
 * without driving any model behaviour. The sections still exist in the
 * template bookmarks; they just render as a flat list now.
 *
 * Kept as a comment-only breadcrumb so anyone looking for the SOP→role
 * mapping (e.g. when re-introducing a role-family view) knows where to
 * start.
 *
 *   sec_clinical_assessment / sec_treatment_plan → Doctor
 *   sec_patient_monitoring / sec_medication_admin → Nurse
 *   sec_patient_registration / sec_appointment_discharge → Admin
 *   sec_compliance_review / sec_approval_signoff → Quality
 */

const SLOT_BODY_PREFIX = "SlotBody_Slot_";

/** Derive the side-panel slot options from the loaded document's bookmarks. */
function resolveDocumentSlots(bookmarks: string[]): { id: string; label: string }[] {
  return bookmarks
    .filter((name) => name.startsWith(SLOT_BODY_PREFIX))
    .map((name) => SLOT_BY_TEMPLATE_NAME[name.slice(SLOT_BODY_PREFIX.length)])
    .filter((id): id is string => Boolean(id))
    .map((id) => ({ id, label: humanizeSection(id) }));
}

/**
 * Turn an assigned section into a Syncfusion editable region owned by `user`
 * (the reviewer's role, matched against `container.currentUser`). Resolves the
 * section id to its real `SlotBody_Slot_*` bookmark, selects it, and marks it
 * editable. Returns true when a region landed; false when the template has no
 * matching bookmark. Must run while document protection is stopped.
 */
function applyEditableRegionForAssignment(
  editor: DocumentEditorContainerType["documentEditor"],
  secId: string,
  user: string
): boolean {
  const bookmark = findSlotBodyBookmark(editor, secId);
  if (!bookmark) return false;
  withTrackChangesSuspended(editor, () => {
    editor.selection.selectBookmark(bookmark);
    editor.editor.insertEditingRegion(user);
  });
  return true;
}

/**
 * Apply the per-section protection model: unlock the document, insert an
 * editable region for every "Can Edit" assignment (keyed to its reviewer's
 * role), then enforce global ReadOnly so everything else is locked. The
 * `applied` set guards against inserting a region twice across effect re-runs —
 * regions persist in the document, so we only insert new signatures and simply
 * re-enforce the lock otherwise. "Read-only" assignments are intentionally
 * skipped (their section stays locked for everyone).
 */
function applyAllRestrictions(
  editor: DocumentEditorContainerType["documentEditor"],
  assignments: ReviewAssignment[],
  reviewers: Reviewer[],
  applied: Set<string>
): void {
  try {
    editor.editor.stopProtection("claw-demo");
  } catch {
    // Not currently protected — inserting regions below is safe.
  }
  editor.isReadOnly = false;
  for (const a of assignments) {
    if (a.protectionLevel !== "CommentsOnly") continue;
    const reviewer = reviewers.find((r) => r.id === a.reviewerId);
    // Region owner is the reviewer's **name**, matching the EJ2
    // `currentUser` set by View-as. EJ2 unlocks a region only for the
    // user-name passed to `insertEditingRegion(user)`, so naming the
    // person (not their role) is what makes the per-section preview
    // actually work.
    const user = reviewer?.name ?? a.reviewerName;
    const signature = `${a.sectionBookmark}::${user}`;
    if (applied.has(signature)) continue;
    if (applyEditableRegionForAssignment(editor, a.sectionBookmark, user)) {
      applied.add(signature);
    }
  }
  editor.editor.enforceProtection("claw-demo", "ReadOnly");
}

/** Find the slot-body bookmark for a semantic slot id, or null when absent. */
function findSlotBodyBookmark(
  editor: DocumentEditorContainerType["documentEditor"],
  slot: string
): string | null {
  for (const name of safeGetBookmarks(editor)) {
    if (!name.startsWith(SLOT_BODY_PREFIX)) continue;
    if (SLOT_BY_TEMPLATE_NAME[name.slice(SLOT_BODY_PREFIX.length)] === slot) return name;
  }
  return null;
}

/** getBookmarks can throw while the editor is mid-layout; treat that as "none". */
function safeGetBookmarks(editor: DocumentEditorContainerType["documentEditor"]): string[] {
  try {
    return editor.getBookmarks();
  } catch {
    return [];
  }
}
