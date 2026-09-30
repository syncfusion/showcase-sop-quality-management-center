/**
 * Dashboard — `/`
 *
 * Single-screen overview: KPI strip on top, full documents grid below.
 *
 * The upload + template picker used to live here; that surface has moved
 * to its own `/workflow` route (`Workspace`) so the Dashboard reads as a
 * pure read-only overview. Every document row still exposes direct
 * access to all workflow sub-routes via its per-row dropdown
 * (Editor / Review / Sign & Publish / Audit Timeline) — clicking any of
 * those items navigates straight into `/workflow/:contractId/<step>`.
 */

import "../styles/pages.css";
import KpiCards from "../components/dashboard/KpiCards";
import AllDocumentsPanel from "./AllDocuments";

export default function Dashboard() {
  return (
    <section aria-labelledby="home-title">
      <div className="claw-screen-heading">
        <div>
          <h1 style={{margin: '0px'}}>SOP Documents Dashboard</h1>
          <p className="muted">
            Controlled-document workspace · Laboratories · Manufacturing · Healthcare ·
          </p>
        </div>
      </div>

      <div className="claw-dashboard-stack">
        <KpiCards />
        <AllDocumentsPanel />
      </div>
    </section>
  );
}