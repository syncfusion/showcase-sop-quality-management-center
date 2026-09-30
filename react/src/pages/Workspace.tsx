/**
 * Workspace — legacy step-0 page. The upload surface has been folded into
 * `<WorkflowLayout mode="upload" />` (mounted on `/new`) so the stepper
 * always sits above the upload panel. This file is kept as a redirect
 * shim so any external reference resolves; the lazy export in
 * `routes/lazyRoutes.ts` remains usable but no route is mounted against
 * it anymore.
 */

import { Navigate } from "react-router-dom";

export default function Workspace() {
  return <Navigate to="/new" replace />;
}