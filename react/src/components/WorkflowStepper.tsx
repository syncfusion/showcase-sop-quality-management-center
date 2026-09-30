/**
 * WorkflowStepper — Horizontal Syncfusion `StepperComponent` for the workflow
 * tree. Owned by `WorkflowLayout` so the same instance mounts once per
 * `:contractId` and the inner `<Outlet />` swap stays smooth.
 *
 * 5 steps: Upload → Editor → Review → Sign & Publish → Audit Timeline.
 *
 * - Status: `< active` = "Completed", `===` = "InProgress", `>` = "NotStarted".
 * - Every step is ALWAYS enabled — users can jump straight to Audit from the
 *   Upload screen, or back to Editor from Sign, regardless of forward
 *   progress. Step 0 (Upload) needs no contract id; steps 1-4 do — clicking
 *   one of those without a contract id is a silent no-op (the user stays on
 *   the upload surface until they pick / drop a document).
 *
 * Steps collapse to `stepType="Indicator"` below 1024px to avoid label
 * overlap on narrow screens.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  StepperComponent,
  type StepModel,
  type StepperChangedEventArgs,
  type StepperChangingEventArgs,
} from "@syncfusion/ej2-react-navigations";
import {
  WORKFLOW_STEPS,
  activeStepFromPath,
  contractIdFromPath,
  pathForWorkflowStep,
} from "./workflowSteps";

const DESKTOP_MQ = "(min-width: 1024px)";

interface WorkflowStepperProps {
  /**
   * The contract id of the document currently being processed. `null` when
   * the user is on the bare `/new` upload surface — gating logic uses
   * this to decide whether a future step is reachable.
   */
  contractId: string | null;
  /**
   * Fired AFTER a step click triggers a navigation. Used by the parent
   * `WorkflowLayout` to e.g. reset scroll position. Optional.
   */
  onNavigated?: () => void;
  /**
   * Whether to render the "Upload" step (index 0) alongside the four
   * per-document steps. The upload step only makes sense on the `/new`
   * surface; the per-document workflow tree (`/workflow/:id/...`) hides
   * it so the user sees Editor / Review / Sign & Publish / Audit only.
   * Defaults to `false`.
   */
  showUploadStep?: boolean;
}

function isDesktopViewport(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia(DESKTOP_MQ).matches;
}

export default function WorkflowStepper({
  contractId,
  onNavigated,
  showUploadStep = false,
}: WorkflowStepperProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const stepperRef = useRef<StepperComponent | null>(null);

  // Source-of-truth from the URL: in case `contractId` is passed via a
  // prop that hasn't propagated yet (route transitions during render), we
  // also re-derive it from the current pathname so the stepper renders
  // synchronously with the URL.
  const derivedId = contractId ?? contractIdFromPath(pathname);
  // `activeStepFromPath` returns an index into the full 5-step table
  // (Upload = 0 … Audit = 4). When the upload step is hidden, the visible
  // stepper starts at Editor = 1, so we remap the active index by
  // subtracting 1 and clamping at 0 (the upload branch — index 0 — never
  // resolves here because `/new` always passes `showUploadStep`).
  const rawActive = activeStepFromPath(pathname);
  const activeStep = showUploadStep ? rawActive : Math.max(0, rawActive - 1);

  // Filter the 5-step table to the visible subset. When the upload step
  // is hidden, we render the per-doc steps (Editor … Audit) at indices
  // 0-3 inside Syncfusion's stepper, while keeping the original 5-step
  // `pathForWorkflowStep` indices (1-4) for navigation.
  const visibleSteps = useMemo(
    () =>
      showUploadStep
        ? WORKFLOW_STEPS
        : WORKFLOW_STEPS.filter((_step, index) => index > 0),
    [showUploadStep]
  );

  const steps: StepModel[] = useMemo(
    () =>
      visibleSteps.map((step, index) => ({
        text: step.text,
        label: step.label,
        iconCss: step.iconCss,
        status:
          index < activeStep
            ? "Completed"
            : index === activeStep
            ? "InProgress"
            : "NotStarted",
      })),
    [activeStep, visibleSteps]
  );

  // No gating in `stepChanging` — every step is reachable from every step.
  // Steps 1-4 require a contract id; `pathForWorkflowStep` returns `null`
  // when one isn't available and the click is a silent no-op (the user
  // stays on the upload surface to pick or drop a document first).
  const handleStepChanging = useCallback((_args: StepperChangingEventArgs) => {
    /* intentionally permissive */
  }, []);

  const handleStepChanged = useCallback(
    (args: StepperChangedEventArgs) => {
      if (!args.isInteracted) return;
      // The visible stepper's activeStep is indexed against the *filtered*
      // list (0..N-1). When the upload step is hidden, the visible index
      // is one less than the canonical 5-step index that `pathForWorkflowStep`
      // expects, so re-add 1 to map back to the original table.
      const targetIndex = showUploadStep
        ? args.activeStep
        : args.activeStep + 1;
      const to = pathForWorkflowStep(targetIndex, derivedId);
      if (!to || to === pathname) return;
      void navigate(to);
      onNavigated?.();
    },
    [derivedId, navigate, onNavigated, pathname, showUploadStep]
  );

  // Keep the Syncfusion progressbar in sync when the viewport collapses /
  // expands so the connector lines re-measure to the new step width.
  useEffect(() => {
    const refresh = () => stepperRef.current?.refreshProgressbar();
    const timer = window.setTimeout(refresh, 350);
    window.addEventListener("resize", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", refresh);
    };
  }, []);

  return (
    <nav className="claw-stepper-bar" aria-label="Workflow">
      <StepperComponent
        ref={stepperRef}
        steps={steps}
        activeStep={activeStep}
        orientation="Horizontal"
        stepType={isDesktopViewport() ? "Default" : "Indicator"}
        labelPosition="Bottom"
        cssClass="claw-workflow-stepper"
        showTooltip
        animation={{ enable: true, duration: 400, delay: 0 }}
        stepChanging={handleStepChanging}
        stepChanged={handleStepChanged}
      />
    </nav>
  );
}