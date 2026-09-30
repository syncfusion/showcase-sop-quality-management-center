import { Suspense } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { SkeletonComponent } from "@syncfusion/ej2-react-notifications";
import AppShell from "./components/AppShell";
import AppToast from "./components/AppToast";
import { useTheme } from "./hooks/useTheme";
import {
  Dashboard,
  WorkflowLayout,
  EditorWorkspace,
  ReviewApproval,
  SignPublish,
  AuditTimeline,
} from "./routes/lazyRoutes";

function RouteFallback() {
  return (
    <div className="claw-route-fallback" role="status" aria-live="polite" aria-busy="true">
      <SkeletonComponent width="220px" height="28px" />
      <SkeletonComponent width="320px" height="14px" />
      <span>Loading workspace…</span>
    </div>
  );
}

export default function App() {
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      <AppShell theme={theme} onToggleTheme={toggleTheme}>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Dashboard — KPIs + inlined documents grid (no stepper) */}
            <Route path="/" element={<Dashboard />} />

            {/* Upload + per-document workflow trees.
                 /new                          → upload surface (the "New Document" nav item)
                 /workflow                     → redirects to /new (backward compat)
                 /workflow/:contractId         → editor (redirect)
                 /workflow/:contractId/{step}  → editor/review/sign/audit.
                 The two trees are independent siblings so the "New Document"
                 nav item highlights only on /new and never on a per-doc step. */}
            <Route path="/new" element={<WorkflowLayout mode="upload" />} />
            <Route path="/workflow" element={<Navigate to="/new" replace />} />
            <Route path="/workflow/:contractId" element={<WorkflowLayout mode="workflow" />}>
              <Route index element={<Navigate to="editor" replace />} />
              <Route path="editor" element={<EditorWorkspace />} />
              <Route path="review" element={<ReviewApproval />} />
              <Route path="sign" element={<SignPublish />} />
              <Route path="audit" element={<AuditTimeline />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppShell>
      <AppToast />
    </>
  );
}