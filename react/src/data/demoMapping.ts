/**
 * Demo workflow mapping — single linear flow.
 *
 * The template gallery cards are backed by the client-side mock catalog in
 * `data/templateCatalog.ts`. The gallery now exposes only the three SOP
 * templates (Healthcare / Laboratory / Manufacturing), so the legacy demo
 * mappings below are unreachable from the Dashboard — the corresponding
 * seeded contracts (`ctr-northwind-service` / `ctr-contoso-nda` /
 * `ctr-fabrikam-purchase`) remain reachable via deep link and the All
 * Documents grid, but no longer have a Dashboard card. The mappings stay
 * in place so any future restore of the legacy catalog entries picks them
 * up automatically.
 *
 *   catalog id → canonical demo contractId   (Dashboard card click)
 *   contract.templateId → catalog id         (Editor/Review/Sign .docx lookup)
 *
 * The editor imports the *real* `.docx` for fidelity, resolved from the catalog
 * entry's `docxUrl`.
 */

import { blobToBase64, normalizeDocxUrl } from "../services/documentService";
import {
  buildUploadedContract,
  mintUploadedContractId,
  registerUploadedContract,
} from "./uploadedContracts";
import { setUploadedDoc } from "./uploadedDocStore";
import { bumpContractsRefresh } from "./contractsRefresh";
import { logAction } from "../services/auditStore";
import type { TemplateCatalogEntry } from "../models";

/** Catalog card id → the demo contract it opens. */
export const CONTRACT_ID_BY_CATALOG_ID: Record<string, string> = {
  "tpl-service-agreement": "ctr-northwind-service",
  "tpl-mutual-nda": "ctr-contoso-nda",
  "tpl-purchase-contract": "ctr-fabrikam-purchase",
};

/** Seed contract.templateId → catalog id (bridges the NDA id mismatch). */
export const CATALOG_ID_BY_TEMPLATE_ID: Record<string, string> = {
  "tpl-service-agreement": "tpl-service-agreement",
  "tpl-nda-mutual": "tpl-mutual-nda",
  "tpl-purchase-contract": "tpl-purchase-contract",
};

/** Resolve the catalog entry for a contract's templateId. */
export function resolveCatalogEntry(
  catalog: TemplateCatalogEntry[] | null | undefined,
  templateId: string
): TemplateCatalogEntry | null {
  if (!catalog) return null;
  const catalogId = CATALOG_ID_BY_TEMPLATE_ID[templateId] ?? templateId;
  return catalog.find((t) => t.id === catalogId) ?? null;
}

/**
 * Build a synthetic `TemplateCatalogEntry` for an uploaded DOCX. Used by the
 * editor + review + sign screens so they can render an "uploaded" contract
 * through the same `catalogEntry` plumbing as the seeded templates, without
 * special-casing anywhere except the docx import path. The `docxUrl` is left
 * empty — callers detect uploaded contracts via `entry.docxUrl === ""` and
 * import the stored base64 bytes instead.
 */
export function buildUploadedCatalogEntry(
  contractId: string,
  fileName: string,
  nowIso: string
): TemplateCatalogEntry {
  return {
    id: contractId,
    name: `Uploaded — ${fileName}`,
    type: "Service Agreement",
    description: "User-uploaded DOCX. Edits and downstream flows are session-only.",
    fieldKeys: [],
    docxUrl: "",
    uploadedAt: nowIso,
    updatedAt: nowIso,
    thumbnailUrl: "",
  };
}

/** True when a catalog entry describes an upload (vs. a served template). */
export function isUploadedCatalogEntry(entry: TemplateCatalogEntry | null): boolean {
  return !!entry && entry.docxUrl === "";
}

/**
 * Open a template gallery card as a fresh synthetic upload.
 *
 * Fetches the entry's `.docx` from its `docxUrl` (which is normally the
 * Vite-served `react/public/docx-templates/<file>.docx` for the mock
 * catalog), base64-encodes the bytes, mints a new `ctr-upload-<ts>`
 * contractId, and stashes the contract + doc in the same session stores
 * that `UploadTemplatePanel.accept` writes to. Returns the new contractId
 * so the caller can route to `/editor/:contractId`.
 *
 * This treats every template pick as its own session-scoped document so
 * the user can open the same template repeatedly (e.g. to start a new
 * draft from a known-good baseline) without overwriting any other
 * contract's history. The editor recognises these via
 * `templateId === "tpl-uploaded"` and routes to the base64 import path
 * automatically — no special-casing in the editor's own logic.
 *
 * @param entry Catalog entry whose `.docx` should be opened.
 * @returns The minted synthetic contractId, or `null` on failure (the
 *          caller is expected to surface a toast in that case).
 */
export async function openTemplateAsUpload(
  entry: TemplateCatalogEntry
): Promise<string | null> {
  try {
    const url = normalizeDocxUrl(entry.docxUrl);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Template file unavailable (HTTP ${res.status})`);
    }
    const blob = await res.blob();
    const base64 = await blobToBase64(blob);
    const nowIso = new Date().toISOString();
    const contractId = mintUploadedContractId();
    const title = entry.name;
    setUploadedDoc({
      contractId,
      base64,
      fileName: `${entry.name}.docx`,
      fileSize: blob.size,
      uploadedAt: nowIso,
    });
    registerUploadedContract(
      buildUploadedContract({ contractId, title, nowIso })
    );
    logAction(contractId, {
      category: "feature",
      action: "open-template",
      summary: `Opened "${entry.name}" from the template gallery`,
      actor: "Author",
      payload: { templateId: entry.id, fileSize: blob.size },
    });
    bumpContractsRefresh();
    return contractId;
  } catch {
    return null;
  }
}

/**
 * Account-id → SOP .docx file base name. The Showcase ships three SOP .docx
 * assets under `react/public/docx-templates/` (HealthcareSOP / LaboratorySOP /
 * ManufacturingSOP) and no equivalent NDA / Service / Purchase files anymore,
 * so every seed contract is routed onto one of the three SOPs based on its
 * primary account. The mapping is by account (not by contract) so the 12
 * seed contracts inherit the right SOP without per-row overrides and the
 * three demo accounts that share an SOP file stay consistent across rows.
 */
export const MOCK_SOP_BY_ACCOUNT_ID: Record<
  string,
  "HealthcareSOP" | "LaboratorySOP" | "ManufacturingSOP"
> = {
  "acc-northwind": "LaboratorySOP", // Aurora Clinical Labs
  "acme-logistics": "LaboratorySOP", // Genevate BioLabs
  "acc-contoso": "ManufacturingSOP", // Northridge Medical Devices
  "acc-adventure": "ManufacturingSOP", // VelaCure Pharmaceuticals
  "acc-fabrikam": "HealthcareSOP", // St. Camille Regional Hospital
  "acc-trey": "HealthcareSOP", // Solace Telehealth
};

/** Merge-field token set per shipped SOP .docx — mirrors `templateCatalog.ts`. */
const SOP_FIELD_KEYS: Record<
  "HealthcareSOP" | "LaboratorySOP" | "ManufacturingSOP",
  string[]
> = {
  HealthcareSOP: [
    "CompanyName",
    "CustomerContact",
    "EffectiveDate",
    "DepartmentName",
    "ProcedureCode",
    "ReviewCycle",
  ],
  LaboratorySOP: [
    "CompanyName",
    "CustomerContact",
    "EffectiveDate",
    "TestMethod",
    "Accreditation",
    "ReviewCycle",
  ],
  ManufacturingSOP: [
    "CompanyName",
    "CustomerContact",
    "EffectiveDate",
    "ProductLine",
    "EquipmentName",
    "ReviewCycle",
  ],
};

/** Pretty label per SOP file — mirrors the names in `templateCatalog.ts`. */
const SOP_LABEL_BY_FILE: Record<
  "HealthcareSOP" | "LaboratorySOP" | "ManufacturingSOP",
  { name: string; type: string; description: string }
> = {
  HealthcareSOP: {
    name: "Healthcare SOP",
    type: "Healthcare SOP",
    description:
      "Patient-care Standard Operating Procedure aligned with CMS, The Joint Commission, HIPAA, and state clinical regulations.",
  },
  LaboratorySOP: {
    name: "Laboratory SOP",
    type: "Laboratory SOP",
    description:
      "Laboratory test method SOP aligned with ISO/IEC 17025, USP <1220>, and the Laboratory's accreditation scope.",
  },
  ManufacturingSOP: {
    name: "Manufacturing SOP",
    type: "Manufacturing SOP",
    description:
      "Production-line operating SOP aligned with 21 CFR Part 211 / Part 117, ISO 9001, ISO 13485, and the Facility's Quality Management System.",
  },
};

/**
 * Synthesize a `TemplateCatalogEntry` for a seed contract that points at the
 * Vite-served `react/public/docx-templates/<sop>.docx`. Called by the editor
 * as a fallback when `resolveCatalogEntry` returns null (i.e. the contract's
 * `templateId` is the legacy `tpl-nda-mutual` / `tpl-service-agreement` /
 * `tpl-purchase-contract`, none of which exist in the new 3-SOP client
 * catalog). Returns `null` when the contract's `accountId` isn't in the
 * routing table — callers should surface the standard contract-not-found
 * affordance in that case.
 */
export function resolveMockSopCatalogEntry(
  contract: { accountId: string; updatedDate: string } | null | undefined
): TemplateCatalogEntry | null {
  if (!contract) return null;
  const fileBase = MOCK_SOP_BY_ACCOUNT_ID[contract.accountId];
  if (!fileBase) return null;
  // Identical helper to templateCatalog.ts → viteDocxUrl; duplicated here so
  // we don't introduce a cross-module import just for one URL builder.
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/");
  const label = SOP_LABEL_BY_FILE[fileBase];
  return {
    id: `sop-${fileBase.toLowerCase()}`,
    name: label.name,
    type: label.type as TemplateCatalogEntry["type"],
    description: label.description,
    fieldKeys: SOP_FIELD_KEYS[fileBase],
    docxUrl: `${base}docx-templates/${fileBase}.docx`,
    uploadedAt: contract.updatedDate,
    updatedAt: contract.updatedDate,
    thumbnailUrl: "",
  };
}
