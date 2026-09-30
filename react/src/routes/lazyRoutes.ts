/**
 * Lazy route definitions — page components are lazy-loaded so heavy Syncfusion
 * features (Document Editor, PDF Viewer) split into separate chunks via
 * vite.config.ts manualChunks.
 *
 * `AllDocuments` is intentionally NOT exported — its content has been
 * refactored into `<AllDocumentsPanel />` which is mounted directly inside
 * the Dashboard (see `src/pages/Dashboard.tsx`). The `/all-documents` route
 * no longer exists; the sidebar no longer offers a separate nav item.
 */

import { lazy } from "react";

export const Dashboard = lazy(() => import("../pages/Dashboard"));
export const Workspace = lazy(() => import("../pages/Workspace"));
export const WorkflowLayout = lazy(() => import("../pages/WorkflowLayout"));
export const EditorWorkspace = lazy(() => import("../pages/EditorWorkspace"));
export const ReviewApproval = lazy(() => import("../pages/ReviewApproval"));
export const SignPublish = lazy(() => import("../pages/SignPublish"));
export const AuditTimeline = lazy(() => import("../pages/AuditTimeline"));