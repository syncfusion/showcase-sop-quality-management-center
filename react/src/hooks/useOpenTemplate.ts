/**
 * Shared hooks for opening a contract after a template pick or a fresh upload.
 *
 * Both callbacks land the user inside the workflow tree at
 * `/workflow/:contractId/editor` so the horizontal stepper picks up at
 * step 1 (Editor) and the user can move forward from there.
 */

import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { showToast } from "../components/AppToast";
import { openTemplateAsUpload } from "../data/demoMapping";
import type { TemplateCatalogEntry } from "../models";

/** Build the workflow tree path for a contract. */
export function workflowEditorPath(id: string): string {
  return `/workflow/${id}/editor`;
}

/**
 * Open a pre-approved template. Mints a synthetic uploaded contract from the
 * template's `.docx` (see `openTemplateAsUpload`) and routes into the
 * workflow tree at `/workflow/:id/editor`. Surfaces a toast on failure.
 */
export function useOpenTemplate() {
  const navigate = useNavigate();
  return useCallback(
    async (entry: TemplateCatalogEntry) => {
      showToast(`Opening "${entry.name}"…`, "Editor workspace");
      const contractId = await openTemplateAsUpload(entry);
      if (!contractId) {
        showToast(
          `Could not open "${entry.name}". The template file could not be read.`,
          "Template"
        );
        return;
      }
      void navigate(workflowEditorPath(contractId));
    },
    [navigate]
  );
}

/**
 * Route into the workflow tree once a fresh upload finishes. Used as the
 * `onUploaded` callback for `<UploadTemplatePanel />`.
 */
export function useOpenUploadedContract() {
  const navigate = useNavigate();
  return useCallback(
    (contractId: string) => {
      if (!contractId) return;
      void navigate(workflowEditorPath(contractId));
    },
    [navigate]
  );
}