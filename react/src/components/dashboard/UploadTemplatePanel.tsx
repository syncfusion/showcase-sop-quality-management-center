/**
 * UploadTemplatePanel — Reusable composite for opening a controlled document.
 *
 * Combines two entry points into a single panel:
 *   1. The "Open a controlled document" drop-zone / file-picker (the upload
 *      half originally hosted by `UploadTemplateCard`).
 *   2. The "Start from a pre-approved template" gallery (the 3-column card
 *      grid originally hosted directly in `Dashboard.tsx`).
 *
 * Used inline on the Dashboard (replacing both old siblings) and inside the
 * sidebar "Open a document" Dialog in `AppShell`. To stay reusable, the
 * component is **navigation-agnostic** — it surfaces:
 *   - `onUploaded(contractId, fileName)` fired before consumer-driven navigate
 *   - `onPickTemplate(entry)` so the consumer can map `entry.id → contractId`
 *     and route.
 *
 * The upload pipeline (validation -> base64 -> mint contractId -> register ->
 * bump refresh -> notify) lives entirely inside this component, so two
 * simultaneous mounts (Dashboard + hidden Dialog) share exactly one code path.
 *
 * Messaging is intentionally framed for regulated industries (laboratories,
 * manufacturing, healthcare, life sciences) — controlled documents, QMS / LIMS
 * provenance, audit traceability (21 CFR Part 11 / ISO 17025).
 */

import {
  useCallback,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { ButtonComponent } from "@syncfusion/ej2-react-buttons";
import { SkeletonComponent } from "@syncfusion/ej2-react-notifications";
import { UploadCloud, ArrowRight, ShieldCheck } from "lucide-react";
import { showToast } from "../AppToast";
import { StateMessage } from "../StateMessage";
import { LabelChip } from "../StatusChip";
import { blobToBase64 } from "../../services/documentService";
import {
  buildUploadedContract,
  mintUploadedContractId,
  registerUploadedContract,
} from "../../data/uploadedContracts";
import { setUploadedDoc } from "../../data/uploadedDocStore";
import { bumpContractsRefresh } from "../../data/contractsRefresh";
import { useTemplateCatalog } from "../../hooks/useAsync";
import { logAction } from "../../services/auditStore";
import type { TemplateCatalogEntry } from "../../models";
import "./UploadTemplatePanel.css";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOCX_MIME_ALT = "application/octet-stream"; // some browsers report this for .docx
const DOCX_EXTENSION = ".docx";
const MAX_BYTES = 10 * 1024 * 1024;

type Phase = "idle" | "reading" | "navigating";

export interface UploadTemplatePanelProps {
  /**
   * Fired immediately after a successful upload, BEFORE the consumer is
   * expected to navigate. Receives the freshly minted `contractId` and the
   * original file name so the caller can route and/or pre-show a toast.
   */
  onUploaded?: (contractId: string, fileName: string) => void;
  /**
   * Fired when the user picks a template card. The component does NOT
   * look up the mapped contract id — the consumer decides what to do with
   * the catalogue entry (most often: route to `/editor/{contractId}`).
   */
  onPickTemplate?: (entry: TemplateCatalogEntry) => void;
  /**
   * Optional companion section flag. When `false`, the templates gallery
   * is hidden (e.g. legacy `UploadTemplateCard` usage or compact contexts).
   * Defaults to `true`.
   */
  showTemplates?: boolean;
  /**
   * Optional className forwarded to the outermost wrapper. Useful when the
   * panel is mounted inside a Dialog (strip outer card chrome, etc.).
   */
  className?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function stripExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

export default function UploadTemplatePanel({
  onUploaded,
  onPickTemplate,
  showTemplates = true,
  className,
}: UploadTemplatePanelProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const catalog = useTemplateCatalog();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const reset = useCallback(() => {
    setPhase("idle");
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const accept = useCallback(
    async (file: File) => {
      setError(null);
      // Validation: extension, size, MIME.
      const lowerName = file.name.toLowerCase();
      if (!lowerName.endsWith(DOCX_EXTENSION)) {
        setError(
          `"${file.name}" isn't a .docx file. Choose a Word document.`
        );
        return;
      }
      if (file.size > MAX_BYTES) {
        setError(
          `"${file.name}" is ${formatBytes(file.size)} — uploads are limited to ${formatBytes(MAX_BYTES)}.`
        );
        return;
      }
      if (
        file.type &&
        file.type !== DOCX_MIME &&
        file.type !== DOCX_MIME_ALT
      ) {
        setError(
          `"${file.name}" doesn't look like a Word document (type: ${file.type || "unknown"}).`
        );
        return;
      }

      setPhase("reading");
      try {
        const base64 = await blobToBase64(file);
        const nowIso = new Date().toISOString();
        const contractId = mintUploadedContractId();
        const title = stripExtension(file.name);
        setUploadedDoc({
          contractId,
          base64,
          fileName: file.name,
          fileSize: file.size,
          uploadedAt: nowIso,
        });
        registerUploadedContract(
          buildUploadedContract({ contractId, title, nowIso })
        );
        // Record a creation entry in the per-contract audit log so the
        // timeline reflects the upload alongside later edits/saves. Done
        // before navigation so the entry is in place when /audit/:id mounts.
        logAction(contractId, {
          category: "version",
          action: "create",
          summary: `Uploaded "${file.name}" (${formatBytes(file.size)})`,
          actor: "Author",
          payload: { fileName: file.name, fileSize: file.size },
        });
        // Bump the shared refresh key BEFORE the consumer navigates so the
        // KPI strip + All Documents list see the new upload when we come
        // back to those tabs. Same-tab subscribers fan out immediately;
        // sibling tabs pick it up via the `storage` event.
        bumpContractsRefresh();
        setPhase("navigating");
        showToast(`Opening "${file.name}" in the editor…`, "Uploaded document");
        onUploaded?.(contractId, file.name);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not read the file.";
        setError(`Could not read "${file.name}": ${message}`);
        setPhase("idle");
      }
    },
    [onUploaded]
  );

  const onPick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void accept(file);
    },
    [accept]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void accept(file);
    },
    [accept]
  );

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!dragging) setDragging(true);
  }, [dragging]);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const busy = phase !== "idle";

  /**
   * Visual+ARIA support: keyboard users need an actual focusable surface to
   * re-trigger the hidden <input type="file"> via Enter/Space.
   */
  const onDropKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onPick();
      }
    },
    [onPick]
  );

  return (
    <div className={`claw-utp${className ? ` ${className}` : ""}`}>
      {/* Section 1 — Upload (always shown) */}
      <section
        className="e-card claw-panel claw-utp-upload"
        aria-labelledby={`${inputId}-title`}
      >
        <div className="e-card-content">
          <div
            className={`claw-utp-drop${dragging ? " is-dragging" : ""}${busy ? " is-busy" : ""}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onKeyDown={onDropKeyDown}
            role="button"
            tabIndex={0}
            aria-label="Drop a .docx file here, or use the browse files button"
            aria-busy={busy}
          >
            <div className="claw-utp-drop-icon" aria-hidden="true">
              <UploadCloud size={36} strokeWidth={1.5} />
            </div>
            <div className="claw-utp-drop-copy">
              <div className="claw-utp-drop-headline">
                {phase === "navigating"
                  ? "Opening in editor…"
                  : "Drop a .docx from your QMS, LIMS, or shared drive"}
              </div>
              <div className="claw-utp-drop-sub muted">or</div>
              <div className="claw-utp-drop-actions">
                <ButtonComponent
                  cssClass="claw-button primary"
                  isPrimary
                  type="button"
                  disabled={busy}
                  onClick={onPick}
                >
                  Browse files
                </ButtonComponent>
              </div>
              <input
                ref={inputRef}
                id={inputId}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={onInputChange}
                hidden
              />
              <div className="claw-utp-drop-meta muted">
                Up to 10 MB · DOCX · Session-scoped, audit-logged
              </div>
            </div>
          </div>

          {error ? (
            <div className="claw-utp-error">
              <StateMessage severity="Error" title="Upload rejected">
                <p>{error}</p>
              </StateMessage>
              <ButtonComponent cssClass="claw-button" type="button" onClick={reset}>
                Try again
              </ButtonComponent>
            </div>
          ) : null}
        </div>
      </section>

      {/* Section 2 — Templates (optional) */}
      {showTemplates ? (
        <section
          className="e-card claw-panel claw-utp-templates"
          aria-labelledby={`${inputId}-tpl-title`}
        >
          <div className="e-card-header claw-panel-heading">
            <div className="e-card-header-caption">
              <div className="e-card-header-title claw-utp-eyebrow-row">
                <ShieldCheck
                  size={16}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  className="claw-utp-eyebrow-icon"
                />
                <span id={`${inputId}-tpl-title`}>
                  Start from a pre-approved template
                </span>
              </div>
              <div className="e-card-sub-title">
                Pre-approved by Quality, Regulatory, and Legal for laboratory,
                manufacturing, and clinical-use environments.
              </div>
            </div>
          </div>
          <div className="e-card-content">
            {catalog.loading ? (
              <TemplateGallerySkeleton />
            ) : catalog.error ? (
              <StateMessage
                severity="Error"
                title="Templates unavailable"
                action={
                  <ButtonComponent
                    cssClass="claw-button"
                    type="button"
                    onClick={catalog.retry}
                  >
                    Retry
                  </ButtonComponent>
                }
              >
                <p>Something went wrong loading this section.</p>
              </StateMessage>
            ) : catalog.data && catalog.data.length > 0 ? (
              <div className="claw-utp-grid">
                {catalog.data.map((t) => (
                  <div
                    key={t.id}
                    className="e-card claw-utp-template-card"
                    role="button"
                    tabIndex={0}
                    aria-label={`${t.name} — ${t.type} template`}
                    onClick={() => onPickTemplate?.(t)}
                    onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onPickTemplate?.(t);
                      }
                    }}
                  >
                    <div className="e-card-image claw-utp-template-thumb" aria-hidden="true">
                      <img src={t.thumbnailUrl} alt="" loading="lazy" />
                    </div>
                    <div className="e-card-header">
                      <div className="e-card-header-caption">
                        <LabelChip text={t.type} cssClass="e-info" />
                        <div className="e-card-header-title">{t.name}</div>
                        <div className="e-card-sub-title">{t.description}</div>
                      </div>
                    </div>
                    <span className="claw-utp-template-go" aria-hidden="true">
                      Open
                      <ArrowRight size={14} strokeWidth={1.75} />
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <StateMessage severity="Info" title="No active templates">
                <p>Import a QMS template to begin.</p>
              </StateMessage>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function TemplateGallerySkeleton() {
  return (
    <div className="claw-utp-grid">
      {[0, 1, 2].map((i) => (
        <div key={i} className="e-card claw-utp-template-card" aria-hidden="true">
          <div className="e-card-image claw-utp-template-thumb" />
          <div className="e-card-header">
            <div className="e-card-header-caption">
              <SkeletonComponent width="40%" height="12px" style={{ marginBottom: "10px" }} />
              <SkeletonComponent width="70%" height="14px" style={{ marginBottom: "8px" }} />
              <SkeletonComponent width="90%" height="12px" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}