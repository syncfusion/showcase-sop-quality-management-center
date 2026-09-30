/**
 * Deterministic seed data — Contracts (12 instances covering every lifecycle
 * status + edge cases: in-review with high-risk clause inserts, signed with
 * image signature, published with DOCX+PDF artifacts, pending signature,
 * overdue review).
 *
 * 100% synthetic.
 */

import type { ContractDetail } from "../models";
import { accountsSeed } from "./accounts";
import { versionsSeed } from "./versions";
import { assignmentsSeed } from "./assignments";
import { activitySeed } from "./activity";

type ContractSeed = Omit<ContractDetail, "accountId"> & { accountId?: string };

export const contractsSeed: ContractSeed[] = [
  {
    id: "ctr-northwind-service",
    title: "Aurora Clinical Labs — Specimen Handling and Chain-of-Custody SOP",
    type: "ServiceAgreement",
    // (legacy alias: Quality Service Agreement)
    templateId: "tpl-service-agreement",
    accountName: "Aurora Clinical Labs",
    accountId: "acc-northwind",
    ownerId: "rvw-adam",
    ownerName: "Adam Bennett",
    status: "InReview",
    currentVersion: 3,
    updatedDate: "2026-09-09T09:42:00Z",
    createdDate: "2026-08-21T14:10:00Z",
    signatoryContactId: "ct-nw-priya" ,
    versions: [],
    assignments: [],
    activity: [],
    comments: [],
  },
  {
    id: "ctr-contoso-nda",
    title: "Northridge MD — Vendor Confidentiality and IP SOP",
    type: "MutualNDA",
    // (legacy alias: Quality & Confidentiality Agreement)
    templateId: "tpl-nda-mutual",
    accountName: "Northridge Medical Devices",
    ownerId: "rvw-adam",
    ownerName: "Adam Bennett",
    status: "Draft",
    currentVersion: 1,
    updatedDate: "2026-09-08T16:30:00Z",
    createdDate: "2026-09-08T11:05:00Z",
    signatoryContactId: "ct-co-elena",
    versions: [],
    assignments: [],
    activity: [],
    comments: [],
  },
  {
    id: "ctr-fabrikam-purchase",
    title: "St. Camille — Reference Materials Supply SOP",
    type: "PurchaseContract",
    // (legacy alias: Specification-Driven Purchase Contract)
    templateId: "tpl-purchase-contract",
    accountName: "St. Camille Regional Hospital",
    ownerId: "rvw-adam",
    ownerName: "Adam Bennett",
    status: "PendingSignature",
    currentVersion: 4,
    updatedDate: "2026-09-05T13:18:00Z",
    createdDate: "2026-07-30T10:22:00Z",
    signatoryContactId: "ct-fa-jordan",
    versions: [],
    assignments: [],
    activity: [],
    comments: [],
  },
  {
    id: "ctr-adventure-nda",
    title: "VelaCure — Clinical Trial Site Confidentiality SOP",
    type: "MutualNDA",
    // (legacy alias: Quality & Confidentiality Agreement)
    templateId: "tpl-nda-mutual",
    accountName: "VelaCure Pharmaceuticals",
    ownerId: "rvw-adam",
    ownerName: "Adam Bennett",
    status: "Draft",
    currentVersion: 1,
    updatedDate: "2026-09-07T10:15:00Z",
    createdDate: "2026-09-06T09:40:00Z",
    signatoryContactId: "ct-aw-catalina",
    versions: [],
    assignments: [],
    activity: [],
    comments: [],
  },
  {
    id: "ctr-trey-service",
    title: "Genevate BioLabs — Sequencing Service SOP",
    type: "ServiceAgreement",
    // (legacy alias: Quality Service Agreement)
    templateId: "tpl-service-agreement",
    accountName: "Genevate BioLabs",
    ownerId: "rvw-adam",
    ownerName: "Adam Bennett",
    status: "InReview",
    currentVersion: 2,
    updatedDate: "2026-09-06T17:48:00Z",
    createdDate: "2026-08-15T08:00:00Z",
    signatoryContactId: "ct-trey-alex",
    versions: [],
    assignments: [],
    activity: [],
    comments: [],
  },
  {
    id: "ctr-acme-nda",
    title: "Solace Telehealth — Business Associate SOP",
    type: "MutualNDA",
    // (legacy alias: Quality & Confidentiality Agreement)
    templateId: "tpl-nda-mutual",
    accountName: "Solace Telehealth",
    ownerId: "rvw-adam",
    ownerName: "Adam Bennett",
    status: "Draft",
    currentVersion: 1,
    updatedDate: "2026-09-04T11:30:00Z",
    createdDate: "2026-09-03T14:00:00Z",
    signatoryContactId: "ct-acme-hiro" ,
    versions: [],
    assignments: [],
    activity: [],
    comments: [],
  },
  {
    id: "ctr-northwind-purchase",
    title: "Aurora Clinical Labs — Reagent Supply SOP",
    type: "PurchaseContract",
    // (legacy alias: Specification-Driven Purchase Contract)
    templateId: "tpl-purchase-contract",
    accountName: "Aurora Clinical Labs",
    ownerId: "rvw-adam",
    ownerName: "Adam Bennett",
    status: "Published",
    currentVersion: 5,
    updatedDate: "2026-08-28T09:12:00Z",
    createdDate: "2026-06-12T09:00:00Z",
    signatoryContactId: "ct-nw-priya",
    versions: [],
    assignments: [],
    activity: [],
    comments: [],
  },
  {
    id: "ctr-contoso-service",
    title: "Northridge MD — Sterilization Validation Service SOP",
    type: "ServiceAgreement",
    // (legacy alias: Quality Service Agreement)
    templateId: "tpl-service-agreement",
    accountName: "Northridge Medical Devices",
    ownerId: "rvw-adam",
    ownerName: "Adam Bennett",
    status: "Published",
    currentVersion: 4,
    updatedDate: "2026-08-15T15:50:00Z",
    createdDate: "2026-05-20T10:30:00Z",
    signatoryContactId: "ct-co-elena",
    versions: [],
    assignments: [],
    activity: [],
    comments: [],
  },
  {
    id: "ctr-fabrikam-nda",
    title: "St. Camille — Resident Physician Confidentiality SOP",
    type: "MutualNDA",
    // (legacy alias: Quality & Confidentiality Agreement)
    templateId: "tpl-nda-mutual",
    accountName: "St. Camille Regional Hospital",
    ownerId: "rvw-adam",
    ownerName: "Adam Bennett",
    status: "Published",
    currentVersion: 2,
    updatedDate: "2026-07-22T12:18:00Z",
    createdDate: "2026-06-29T11:00:00Z",
    signatoryContactId: "ct-fa-jordan",
    versions: [],
    assignments: [],
    activity: [],
    comments: [],
  },
  {
    id: "ctr-trey-purchase",
    title: "Genevate BioLabs — Reagent and Consumables Purchase SOP",
    type: "PurchaseContract",
    // (legacy alias: Specification-Driven Purchase Contract)
    templateId: "tpl-purchase-contract",
    accountName: "Genevate BioLabs",
    ownerId: "rvw-adam",
    ownerName: "Adam Bennett",
    status: "PendingSignature",
    currentVersion: 3,
    updatedDate: "2026-09-02T14:05:00Z",
    createdDate: "2026-07-18T09:45:00Z",
    signatoryContactId: "ct-trey-alex",
    versions: [],
    assignments: [],
    activity: [],
    comments: [],
  },
  {
    id: "ctr-adventure-service",
    title: "VelaCure — Cleaning Validation Service SOP",
    type: "ServiceAgreement",
    // (legacy alias: Quality Service Agreement)
    templateId: "tpl-service-agreement",
    accountName: "VelaCure Pharmaceuticals",
    ownerId: "rvw-adam",
    ownerName: "Adam Bennett",
    status: "Published",
    currentVersion: 3,
    updatedDate: "2026-07-10T09:30:00Z",
    createdDate: "2026-05-01T13:00:00Z",
    signatoryContactId: "ct-aw-catalina",
    versions: [],
    assignments: [],
    activity: [],
    comments: [],
  },
  {
    id: "ctr-contoso-purchase",
    title: "Solace Telehealth — Cloud Hosting and BAA Purchase SOP",
    type: "PurchaseContract",
    // (legacy alias: Specification-Driven Purchase Contract)
    templateId: "tpl-purchase-contract",
    accountName: "Solace Telehealth",
    ownerId: "rvw-adam",
    ownerName: "Adam Bennett",
    status: "Published",
    currentVersion: 4,
    updatedDate: "2026-06-30T16:40:00Z",
    createdDate: "2026-04-15T08:20:00Z",
    signatoryContactId: "ct-co-elena",
    versions: [],
    assignments: [],
    activity: [],
    comments: [],
  },
];

// Wire relational arrays once at load (deterministic)
for (const contract of contractsSeed) {
  // Backfill accountId from accountsSeed by accountName when not set inline.
  if (!contract.accountId) {
    const account = accountsSeed.find((a) => a.name === contract.accountName);
    contract.accountId = account?.id ?? `acc-${contract.id}`;
  }
  contract.versions = versionsSeed.filter((v) => v.contractId === contract.id);
  contract.assignments = assignmentsSeed.filter((a) => a.contractId === contract.id);
  contract.activity = activitySeed.filter((a) => a.contractId === contract.id);
  contract.comments = [];
}

// Re-export a fully-typed ContractDetail[] for consumers (accountId now set).
export const contractsTyped: ContractDetail[] = contractsSeed as ContractDetail[];
