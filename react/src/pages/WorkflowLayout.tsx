/**
 * WorkflowLayout — Owns the horizontal `<WorkflowStepper />` and renders
 * the active workflow surface underneath it.
 *
 * Two independent shells:
 *
 *   - `mode="upload"` (mounted at `/new`): stepper + UploadTemplatePanel.
 *   - `mode="workflow"` (default; mounted as the parent of
 *     `/workflow/:contractId`): stepper + `<Outlet />` that resolves to
 *     Editor / Review / Sign & Publish / Audit Timeline.
 *
 * Mounting the stepper once across the upload surface AND the per-doc
 * tree means the same instance stays mounted while the user moves between
 * Upload ⇆ Editor ⇆ Review ⇆ Sign ⇆ Audit. Only the inner pane swaps, so
 * transitions are smooth (no whole-page refresh, no stepper re-mount, scroll
 * position preserved at the top).
 *
 * The upload surface reuses `<UploadTemplatePanel />` (the same component
 * the Dashboard inlines) — there is exactly one upload code path.
 */

import { useCallback } from "react";
import { Outlet, useParams } from "react-router-dom";
import WorkflowStepper from "../components/WorkflowStepper";
import UploadTemplatePanel from "../components/dashboard/UploadTemplatePanel";
import {
  useOpenTemplate,
  useOpenUploadedContract,
} from "../hooks/useOpenTemplate";
import "../styles/pages.css";

export type WorkflowLayoutMode = "upload" | "workflow";

interface WorkflowLayoutProps {
  /**
   * `"upload"` forces the upload surface regardless of `:contractId` (used
   * by the `/new` route). `"workflow"` (default) keeps the per-doc tree
   * behaviour — Outlet when a `:contractId` is present, UploadTemplatePanel
   * otherwise.
   */
  mode?: WorkflowLayoutMode;
}

export default function WorkflowLayout({ mode = "workflow" }: WorkflowLayoutProps) {
  const { contractId } = useParams<{ contractId: string }>();
  const id = contractId ?? null;
  const openTemplate = useOpenTemplate();
  const openUploaded = useOpenUploadedContract();

  /**
   * Scroll the inner pane back to the top when a step changes — keeps
   * the editor / comparison / audit views from landing mid-scroll after
   * the stepper-driven transition. Cheap, runs once per step click.
   */
  const handleNavigated = useCallback(() => {
    const main = document.getElementById("main-content");
    if (main) main.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className="claw-workflow-layout">
      {id && <WorkflowStepper
        contractId={id}
        onNavigated={handleNavigated}
        showUploadStep={mode === "upload"}
      />}
      <div className="claw-workflow-layout-pane">
        {mode === "upload" || !id ? (
          <UploadTemplatePanel
            onPickTemplate={openTemplate}
            onUploaded={(contractId) => openUploaded(contractId)}
          />
        ) : (
          <Outlet />
        )}
      </div>
    </div>
  );
}