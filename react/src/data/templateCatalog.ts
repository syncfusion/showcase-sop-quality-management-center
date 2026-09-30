/**
 * Client-side template catalog (mock).
 *
 * Replaces the former server-side fetch of `GET <service>/Templates/templates.json`
 * with a hardcoded list. The three entries correspond to the `.docx` files
 * shipped under `react/public/docx-templates/` and served by the Vite dev
 * server at `${BASE_URL}docx-templates/<File>.docx`. The `.docx` bytes are
 * fetched by the browser from the Vite origin and POSTed to the unchanged
 * `<service>/api/documenteditor/Import` endpoint, so the Editor / Review /
 * Sign screens continue to round-trip through the existing server pipeline.
 *
 * Shape matches `TemplateCatalogEntry` in `models/index.ts` exactly so the
 * `useTemplateCatalog()` hook in `useAsync.ts` and the `normalizeDocxUrl`
 * helper in `documentService.ts` continue to work without change.
 *
 * Field metadata (names, descriptions, fieldKeys, SVG thumbnails, dates) is
 * copied verbatim from the previous `wwwroot/Templates/templates.json` so
 * the Dashboard gallery looks identical to the old fetch path.
 */

import type { TemplateCatalogEntry } from "../models";

/**
 * Resolve the Vite-served origin for `.docx` files in `public/docx-templates/`.
 * `BASE_URL` is the configured public path (default `/`); we always join with a
 * trailing slash so the result is `https://host/<base>docx-templates/<file>`.
 *
 * Falls back to a relative URL when `import.meta.env.BASE_URL` is undefined
 * (defensive — Vite always provides it in practice).
 */
function viteDocxUrl(fileName: string): string {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/");
  return `${base}docx-templates/${fileName}`;
}

/**
 * Resolve a Vite-served PNG under `public/template-images/`. Matches the
 * reference-style 3D illustrations shipped for each domain so the Dashboard
 * gallery reads as a real document catalogue rather than a flat mock.
 */
function viteTemplateImage(fileName: string): string {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/");
  return `${base}template-images/${fileName}`;
}

const NOW_ISO = "2026-09-25T00:00:00Z";

/**
 * Three template entries — Healthcare SOP, Laboratory SOP, Manufacturing SOP.
 * `fieldKeys` match the merge fields actually authored into the `.docx` files
 * so the "Preview with data" dialog (EditorWorkspace's `MockDataDialog`) can
 * populate them via DocIO mail merge on Import.
 */
export const TEMPLATE_CATALOG: TemplateCatalogEntry[] = [
  {
    id: "tpl-healthcare-sop",
    name: "Healthcare SOP",
    type: "Healthcare SOP",
    description:
      "Patient-care Standard Operating Procedure aligned with CMS, The Joint Commission, HIPAA, and state clinical regulations.",
    fieldKeys: [
      "CompanyName",
      "CustomerContact",
      "EffectiveDate",
      "DepartmentName",
      "ProcedureCode",
      "ReviewCycle",
    ],
    docxUrl: viteDocxUrl("HealthcareSOP.docx"),
    uploadedAt: NOW_ISO,
    updatedAt: NOW_ISO,
    thumbnailUrl: viteTemplateImage("healthcare.png"),
  },
  {
    id: "tpl-laboratory-sop",
    name: "Laboratory SOP",
    type: "Laboratory SOP",
    description:
      "Laboratory test method SOP aligned with ISO/IEC 17025, USP <1220>, and the Laboratory's accreditation scope.",
    fieldKeys: [
      "CompanyName",
      "CustomerContact",
      "EffectiveDate",
      "TestMethod",
      "Accreditation",
      "ReviewCycle",
    ],
    docxUrl: viteDocxUrl("LaboratorySOP.docx"),
    uploadedAt: NOW_ISO,
    updatedAt: NOW_ISO,
    thumbnailUrl: viteTemplateImage("laboratory.png"),
  },
  {
    id: "tpl-manufacturing-sop",
    name: "Manufacturing SOP",
    type: "Manufacturing SOP",
    description:
      "Production-line operating SOP aligned with 21 CFR Part 211 / Part 117, ISO 9001, ISO 13485, and the Facility's Quality Management System.",
    fieldKeys: [
      "CompanyName",
      "CustomerContact",
      "EffectiveDate",
      "ProductLine",
      "EquipmentName",
      "ReviewCycle",
    ],
    docxUrl: viteDocxUrl("ManufacturingSOP.docx"),
    uploadedAt: NOW_ISO,
    updatedAt: NOW_ISO,
    thumbnailUrl: viteTemplateImage("manufacturing.png"),
  },
];

/**
 * Async accessor for the mock catalog. Resolves to the static
 * `TEMPLATE_CATALOG` constant; the Promise wrapper preserves the contract
 * used by `useAsync<TemplateCatalogEntry[]>` so the `loading` / `error` /
 * `retry` UX in `UploadTemplatePanel` continues to work unchanged.
 */
export function getMockTemplateCatalog(): Promise<TemplateCatalogEntry[]> {
  return Promise.resolve(TEMPLATE_CATALOG);
}