/**
 * Review & Approval — Screen 3 (`/review/:contractId`)
 *
 * Real two-document comparison shown side by side. The baseline is the pristine
 * template `.docx` (resolved from the contract's templateId via the catalog); the
 * revised document is the live-edited doc carried from the editor's "Compare
 * versions" click (session store), falling back to the baseline when the review is
 * opened directly (a valid "no changes" comparison). The pristine original is shown
 * in the LEFT editor; the baseline + revised are sent to the backend
 * `POST /api/documenteditor/CompareDocuments` (DocIO redline) and the resulting
 * Comparison.docx is opened in the RIGHT editor, whose native revisions pane
 * provides Accept / Reject. The two editors scroll in sync.
 *
 * States: comparing (Skeleton), service-down/error with retry, no-changes note.
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  DocumentEditorContainerComponent,
  Ribbon,
  type DocumentEditorContainerComponent as DocumentEditorContainerType,
} from "@syncfusion/ej2-react-documenteditor";
import { ButtonComponent } from "@syncfusion/ej2-react-buttons";
import { SkeletonComponent } from "@syncfusion/ej2-react-notifications";
import { TooltipComponent } from "@syncfusion/ej2-react-popups";
import { DropDownListComponent } from "@syncfusion/ej2-react-dropdowns";
import { LabelChip } from "../components/StatusChip";
import { StateMessage } from "../components/StateMessage";
import { useContract, useTemplateCatalog } from "../hooks/useAsync";
import {
  compareDocuments,
  documentEndpoint,
  fetchDocxAsBase64,
  importDocxBase64AsSfdt,
  importTemplateAsSfdt,
} from "../services/documentService";
import { getEditedDoc, getVersion, listVersions } from "../services/editedDocStore";
import { getUploadedDoc } from "../data/uploadedDocStore";
import {
  resolveCatalogEntry,
  buildUploadedCatalogEntry,
  resolveMockSopCatalogEntry,
} from "../data/demoMapping";
import "../styles/pages.css";

DocumentEditorContainerComponent.Inject(Ribbon);

type Phase = "comparing" | "ready" | "error";

export default function ReviewApproval() {
  const { contractId = "" } = useParams();
  const navigate = useNavigate();
  const contract = useContract(contractId);
  const catalog = useTemplateCatalog();

  const catalogEntry = useMemo(() => {
    // Uploaded contracts have no server-side catalog entry — synthesize a
    // minimal one so the comparison pipeline renders. The `docxUrl` is empty;
    // the comparison effect below detects that and uses the stored base64
    // DOCX as the baseline (and also as the "pristine original" on the left).
    if (contract.data?.templateId === "tpl-uploaded") {
      return buildUploadedCatalogEntry(
        contract.data.id,
        contract.data.title,
        contract.data.updatedDate
      );
    }
    return (
      resolveCatalogEntry(catalog.data, contract.data?.templateId ?? "") ??
      // Legacy template ids (tpl-nda-mutual / tpl-service-agreement /
      // tpl-purchase-contract) no longer exist in the client-side catalog
      // (it now ships 3 SOPs only). Fall back to the SOP routing so the
      // comparison effect below has a `catalogEntry` to work with — without
      // this, the effect's `!catalogEntry` guard bails out and the screen
      // locks on the skeleton.
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
  const originalContainerRef = useRef<DocumentEditorContainerType | null>(null);
  const comparedSfdtRef = useRef<string | null>(null);
  const originalSfdtRef = useRef<string | null>(null);
  const [phase, setPhase] = useState<Phase>("comparing");
  const [noChanges, setNoChanges] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);
  const [editorMounted, setEditorMounted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [baselineId, setBaselineId] = useState("template");
  const [revisedId, setRevisedId] = useState("edited");

  // Run the comparison once the contract + catalog entry are resolved. Baseline
  // = template .docx; revised = edited doc from the editor (or baseline if none).
  useEffect(() => {
    if (!contract.data || !catalogEntry) return;
    let cancelled = false;
    setPhase("comparing");
    setNoChanges(false);
    setShowRevisions(false);
    setEditorMounted(false);
    comparedSfdtRef.current = null;
    originalSfdtRef.current = null;

    (async () => {
      try {
        // Read the chosen baseline/revised versions from the versioned store.
        // The editor seeds `v1` (Original) on first load and `appendVersion`
        // adds each subsequent save, so by the time Review opens there's
        // always at least one version available.
        const baselineVersion = getVersion(contract.data!.id, baselineId);
        const revisedVersion = getVersion(contract.data!.id, revisedId);
        if (!baselineVersion || !revisedVersion) {
          // No saved versions yet — fall back to the legacy template/upload
          // pipeline so opening Review directly (without going through the
          // editor first) still shows a sensible comparison.
          const uploadedBaseline = catalogEntry.docxUrl === ""
            ? getUploadedDoc(contract.data!.id)?.base64 ?? null
            : null;
          const [originalSfdt, baseline] = await Promise.all([
            uploadedBaseline !== null
              ? importDocxBase64AsSfdt(uploadedBaseline)
              : importTemplateAsSfdt(catalogEntry.docxUrl),
            uploadedBaseline !== null
              ? Promise.resolve(uploadedBaseline)
              : fetchDocxAsBase64(catalogEntry.docxUrl),
          ]);
          const revised = getEditedDoc(contract.data!.id) ?? baseline;
          const sfdt = await compareDocuments(baseline, revised, "Adam Bennett");
          if (cancelled) return;
          originalSfdtRef.current = originalSfdt;
          comparedSfdtRef.current = sfdt;
          setTimeout(() => {
            if (!cancelled) setEditorMounted(true);
          }, 50);
          return;
        }
        const [originalSfdt, sfdt] = await Promise.all([
          importDocxBase64AsSfdt(baselineVersion.base64),
          compareDocuments(baselineVersion.base64, revisedVersion.base64, "Adam Bennett"),
        ]);
        if (cancelled) return;
        originalSfdtRef.current = originalSfdt;
        comparedSfdtRef.current = sfdt;
        // Defer editor mount one turn (React 19 StrictMode insertBefore guard).
        setTimeout(() => {
          if (!cancelled) setEditorMounted(true);
        }, 50);
      } catch {
        if (!cancelled) setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contract.data, catalogEntry, attempt, baselineId, revisedId]);

  // Fired from both editors' `created` callbacks. Opens both documents and wires
  // synchronized scrolling once both editor instances and both SFDTs are ready.
  const wireWhenReady = useCallback(() => {
    const run = () => {
      const originalEditor = originalContainerRef.current?.documentEditor;
      const resultEditor = containerRef.current?.documentEditor;
      const originalSfdt = originalSfdtRef.current;
      const comparedSfdt = comparedSfdtRef.current;
      if (!originalEditor || !resultEditor || !originalSfdt || !comparedSfdt) return;
      try {
        originalEditor.open(originalSfdt);
        resultEditor.showRevisions = false;
        resultEditor.open(comparedSfdt);
        setShowRevisions(false);
        setNoChanges(resultEditor.revisions.length === 0);

        // Synchronized scrolling with a re-entrancy guard (setScrollPosition
        // itself raises viewChange).
        let syncing = false;
        originalEditor.viewChange = () => {
          if (syncing) return;
          syncing = true;
          resultEditor.selection.setScrollPosition(originalEditor.selection.getScrollPosition());
          syncing = false;
        };
        resultEditor.viewChange = () => {
          if (syncing) return;
          syncing = true;
          originalEditor.selection.setScrollPosition(resultEditor.selection.getScrollPosition());
          syncing = false;
        };

        setPhase("ready");
      } catch {
        setPhase("error");
      }
    };
    // Only initialize once both editors exist; each created callback retries.
    if (originalContainerRef.current?.documentEditor && containerRef.current?.documentEditor) run();
  }, []);

  const toggleReviewPane = useCallback(() => {
    const resultEditor = containerRef.current?.documentEditor;
    if (!resultEditor) return;
    setShowRevisions((prev) => {
      const next = !prev;
      resultEditor.showRevisions = next;
      return next;
    });
  }, []);

  const editorServiceUrl = useMemo(() => documentEndpoint("").replace(/\/$/, ""), []);

  // Dynamic dropdown options: every saved version for this contract, oldest
  // first. Refreshed when `attempt` bumps (user clicked Compare / Retry) so a
  // newly-saved version appears immediately without a hard reload.
  const versionOptions = useMemo(() => {
    if (!contract.data) return [] as { id: string; label: string }[];
    const versions = listVersions(contract.data.id);
    return versions.map((v) => ({
      id: v.id,
      label: `${v.id.toUpperCase()} · ${v.label}${
        v.createdBy ? ` · ${v.createdBy}` : ""
      }${v.createdAt ? ` · ${new Date(v.createdAt).toLocaleString()}` : ""}`,
    }));
  }, [contract.data, attempt]);

  // When versions first become available (or the list grows), default the
  // baseline to v1 (the pristine Original) and the revised to the latest
  // saved version, which is the most useful starting comparison.
  useEffect(() => {
    if (!contract.data) return;
    const versions = listVersions(contract.data.id);
    if (versions.length === 0) return;
    const firstId = versions[0].id;
    const lastId = versions[versions.length - 1].id;
    setBaselineId((prev) => (versions.some((v) => v.id === prev) ? prev : firstId));
    setRevisedId((prev) => (versions.some((v) => v.id === prev) ? prev : lastId));
  }, [contract.data, attempt, versionOptions]);

  const loading = contract.loading || catalog.loading;
  const notFound = !loading && (contract.error || !contract.data);
  const canCompare = Boolean(
    baselineId &&
      revisedId &&
      baselineId !== revisedId &&
      versionOptions.some((v) => v.id === baselineId) &&
      versionOptions.some((v) => v.id === revisedId)
  );
  const baselineLabel =
    versionOptions.find((v) => v.id === baselineId)?.label ?? "Original";
  const revisedLabel =
    versionOptions.find((v) => v.id === revisedId)?.label ?? "Latest version";

  if (loading) return <ReviewSkeleton />;
  if (notFound) {
    return (
      <StateMessage
        severity="Error"
        title="Contract not found"
        action={
          <ButtonComponent cssClass="claw-button" type="button" onClick={() => navigate("/")}>
            Back to dashboard
          </ButtonComponent>
        }
      >
        <p>The selected contract could not be loaded.</p>
      </StateMessage>
    );
  }

  return (
    <section aria-labelledby="review-title">
      <div className="claw-screen-heading">
        <div>
          <h2 id="review-title">{contract.data!.title}</h2>
        </div>
        <div className="claw-actions">
          {/* Icon-only back link — mirrors the audit icon button in the
              editor: TooltipComponent carries the accessible name, the
              visible content is just the arrow glyph. Slot kept where the
              original text "Back to editor" button lived so the action
              stack order (back · continue) is unchanged. */}
          <TooltipComponent
            content="Back to editor"
            position="BottomCenter"
            cssClass="claw-action-tip"
          >
            <ButtonComponent
              cssClass="claw-button claw-button-icon"
              type="button"
              onClick={() => navigate(`/workflow/${contract.data!.id}/editor`)}
              aria-label="Back to editor"
            >
              <span className="e-icons e-arrow-left" aria-hidden="true" />
            </ButtonComponent>
          </TooltipComponent>
          <ButtonComponent
            cssClass="claw-button primary"
            isPrimary
            type="button"
            onClick={() => navigate(`/workflow/${contract.data!.id}/sign`)}
          >
            Sign & Publish
          </ButtonComponent>
        </div>
      </div>

      <div className="claw-comparison-toolbar">
        <div className="claw-comparison-side">
          <span className="claw-eyebrow">Baseline</span>
          <DropDownListComponent
            cssClass="claw-form-dropdown claw-version-select"
            dataSource={versionOptions}
            fields={{ text: "label", value: "id" }}
            value={baselineId}
            change={(e) => {
              if (e.value) setBaselineId(String(e.value));
            }}
            placeholder="Select original version"
          />
        </div>
        <span className="claw-comparison-arrow" aria-hidden="true">→</span>
        <div className="claw-comparison-side">
          <span className="claw-eyebrow">Revised</span>
          <DropDownListComponent
            cssClass="claw-form-dropdown claw-version-select"
            dataSource={versionOptions}
            fields={{ text: "label", value: "id" }}
            value={revisedId}
            change={(e) => {
              if (e.value) setRevisedId(String(e.value));
            }}
            placeholder="Select revised version"
          />
        </div>
        <ButtonComponent
          cssClass="claw-button"
          type="button"
          disabled={!canCompare}
          onClick={() => setAttempt((a) => a + 1)}
        >
          Compare documents
        </ButtonComponent>
        {noChanges && phase === "ready" ? (
          <LabelChip text="No changes detected" cssClass="e-success" />
        ) : null}
      </div>

      {phase === "error" ? (
        <StateMessage
          severity="Error"
          title="Comparison unavailable"
          action={
            <ButtonComponent cssClass="claw-button" type="button" onClick={() => setAttempt((a) => a + 1)}>
              Retry comparison
            </ButtonComponent>
          }
        >
          <p>
            The Document Editor service could not compare the documents. Ensure ContractWorkspace.DocumentService is
            running, then retry.
          </p>
        </StateMessage>
      ) : (
        <div className="claw-comparison-workspace">
          <div className="claw-editor-loading" hidden={phase === "ready"} aria-live="polite" aria-busy={phase !== "ready"}>
            <SkeletonComponent width="40%" height="16px" style={{ marginBottom: 12 }} />
            <SkeletonComponent width="100%" height="560px" />
          </div>
          {editorMounted ? (
            <div className="claw-compare-grid">
              <div className="claw-compare-col">
                <div className="claw-compare-col-head">
                  <span>Original Document</span>
                </div>
                <CompareEditorIsland
                  id="claw-review-editor-original"
                  editorRef={originalContainerRef}
                  serviceUrl={editorServiceUrl}
                  onCreated={wireWhenReady}
                />
              </div>
              <div className="claw-compare-col">
                <div className="claw-compare-col-head">
                  <span>Result Document (with tracked changes)</span>
                  <ButtonComponent
                    cssClass="claw-button subtle"
                    type="button"
                    iconCss="e-icons e-eye"
                    onClick={toggleReviewPane}
                  >
                    {showRevisions ? "Hide Review Pane" : "Show Review Pane"}
                  </ButtonComponent>
                </div>
                <CompareEditorIsland
                  id="claw-review-editor-result"
                  editorRef={containerRef}
                  serviceUrl={editorServiceUrl}
                  onCreated={wireWhenReady}
                />
              </div>
            </div>
          ) : (
            <div className="claw-comparison-panel">
              <ReviewSkeleton compact />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

const CompareEditorIsland = memo(
  function CompareEditorIsland({
    id,
    editorRef,
    serviceUrl,
    onCreated,
  }: {
    id: string;
    editorRef: Ref<DocumentEditorContainerType>;
    serviceUrl: string;
    onCreated: () => void;
  }) {
    return (
      <DocumentEditorContainerComponent
        id={id}
        ref={editorRef}
        height="600px"
        created={onCreated}
        serviceUrl={serviceUrl}
        enableToolbar={false}
        showPropertiesPane={false}
        currentUser="Adam Bennett"
      />
    );
  },
  () => true
);

function ReviewSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div aria-live="polite" aria-busy="true">
      {!compact ? (
        <>
          <SkeletonComponent width="40%" height="28px" style={{ marginBottom: 10 }} />
          <SkeletonComponent width="60%" height="14px" style={{ marginBottom: 20 }} />
        </>
      ) : null}
      <SkeletonComponent width="100%" height={compact ? "560px" : "620px"} />
    </div>
  );
}
