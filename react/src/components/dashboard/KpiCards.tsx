/**
 * KpiCards — Dashboard KPI strip (Screen 1).
 *
 * Four status tiles that summarise the contract portfolio at a glance:
 * Draft / In Review / Approved / Obsolete.
 *
 * Aggregation
 * -----------
 * Counts are derived from `contractService.listContracts()`, which merges
 * the seed catalogue with every uploaded DOCX stub (uploaded rows hydrate
 * from `sessionStorage` so hard reloads keep them visible). The KPI tiles
 * reuse the `All Documents` data source so the two surfaces can never
 * disagree.
 *
 * Lifecycle → tile mapping (Option 1):
 *   Draft       ← ContractStatus "Draft"
 *   In Review   ← ContractStatus "InReview"
 *   Approved    ← ContractStatus "Published"
 *   Obsolete    ← placeholder, left at 0 until a future status is introduced
 *
 * Refresh
 * -------
 * Driven by the shared `useContractsRefreshKey` so an upload made in this
 * tab OR a sibling tab re-aggregates the counts without a hard reload.
 * While the first fetch is in flight, each tile renders a thin shimmer bar
 * over the placeholder so the strip doesn't flash "0" for all four tiles.
 */

import { useMemo } from "react";
import { PenLine, Clock, CheckCircle2, Archive, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useContracts } from "../../hooks/useAsync";
import type { ContractStatus } from "../../models";
import "./KpiCards.css";

type KpiStatus = "Draft" | "InReview" | "Approved" | "Obsolete";

interface KpiStat {
  status: KpiStatus;
  count: number;
}

/**
 * Map each KPI tile to the set of `ContractStatus` values it counts.
 *
 * Note: `PendingSignature` rolls up into the `In Review` tile so the
 * portfolio summary stays single-glance — anything that has cleared
 * Review and is now waiting on signatures is still "in flight" for the
 * author, while `Published` represents fully-executed contracts only.
 * `Obsolete` is its own terminal status and counts toward its own tile
 * (set via the All Documents "Mark Obsolete" action).
 */
const STATUSES_FOR_TILE: Record<KpiStatus, ContractStatus[]> = {
  Draft: ["Draft"],
  InReview: ["InReview", "PendingSignature"],
  Approved: ["Published"],
  Obsolete: ["Obsolete"],
};

const TILES: KpiStatus[] = ["Draft", "InReview", "Approved", "Obsolete"];

function iconForStatus(status: KpiStatus): LucideIcon {
  switch (status) {
    case "Draft":
      return PenLine;
    case "InReview":
      return Clock;
    case "Approved":
      return CheckCircle2;
    case "Obsolete":
      return Archive;
  }
}

function statusLabel(status: KpiStatus): string {
  switch (status) {
    case "Draft":
      return "Draft";
    case "InReview":
      return "In Review";
    case "Approved":
      return "Approved";
    case "Obsolete":
      return "Obsolete";
  }
}

function statusKey(status: KpiStatus): string {
  switch (status) {
    case "Draft":
      return "draft";
    case "InReview":
      return "in-review";
    case "Approved":
      return "approved";
    case "Obsolete":
      return "obsolete";
  }
}

function getStatusIcon(Icon: LucideIcon): ReactNode {
  return <Icon size={20} strokeWidth={1.75} aria-hidden="true" />;
}

export default function KpiCards() {
  const { data, loading } = useContracts();

  const counts = useMemo<Record<KpiStatus, number>>(() => {
    const out: Record<KpiStatus, number> = {
      Draft: 0,
      InReview: 0,
      Approved: 0,
      Obsolete: 0,
    };
    if (!data) return out;
    for (const c of data) {
      for (const tile of TILES) {
        if (STATUSES_FOR_TILE[tile].includes(c.status)) {
          out[tile] += 1;
        }
      }
    }
    return out;
  }, [data]);

  const stats: KpiStat[] = TILES.map((status) => ({
    status,
    count: counts[status],
  }));

  return (
      <div className="claw-kpi-grid">
        {stats.map((stat) => (
          <div key={stat.status} className="e-card claw-kpi-card">
            <div className="claw-kpi-icon" data-status={statusKey(stat.status)}>
              {getStatusIcon(iconForStatus(stat.status))}
            </div>
            <div className="claw-kpi-meta">
              <div className="claw-kpi-value" aria-live="polite">
                {loading && !data ? (
                  <span className="claw-kpi-shimmer" aria-hidden="true" />
                ) : (
                  stat.count
                )}
              </div>
              <div className="claw-kpi-label">{statusLabel(stat.status)}</div>
            </div>
          </div>
        ))}
      </div>
  );
}
