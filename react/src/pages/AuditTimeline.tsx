/**
 * Audit Timeline — Screen 4 (`/audit/:contractId`)
 *
 * Read-only session-scoped activity feed for the selected contract. Each row
 * shows an icon (by category), the pre-rendered summary, the acting user, and
 * a relative timestamp. Rows group into per-day buckets for at-a-glance
 * navigation. Captures: editor saves, comments / restrictions toggles, and
 * editing-permission (section assignment) changes.
 */
import { useMemo, useState, useEffect, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ButtonComponent, ChipListComponent } from "@syncfusion/ej2-react-buttons";
import { SkeletonComponent } from "@syncfusion/ej2-react-notifications";
import { StateMessage } from "../components/StateMessage";
import { useAudit } from "../hooks/useAudit";
import { useContract } from "../hooks/useAsync";
import { clearAudit } from "../services/auditStore";
import type { AuditEntry, AuditCategory } from "../services/auditStore";
import { showToast } from "../components/AppToast";
import "../styles/audit.css";

/** Syncfusion built-in icon CSS class per audit category. */
const ICON_BY_CATEGORY: Record<AuditCategory, string> = {
  version: "e-save",
  feature: "e-settings",
  permission: "e-lock",
};

/** Display label per audit category, shown in the row filter chips. */
const CATEGORY_LABEL: Record<AuditCategory, string> = {
  version: "Versions",
  feature: "Features",
  permission: "Permissions",
};

/** Compact ordering for the per-day grouping (newest row first). */
function groupByDayDescending(
  entries: AuditEntry[]
): { day: string; sortKey: number; rows: AuditEntry[] }[] {
  const map = new Map<string, { sortKey: number; rows: AuditEntry[] }>();
  for (const entry of entries) {
    const ts = new Date(entry.createdAt);
    const day = ts.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const sortKey = ts.getTime();
    const bucket = map.get(day);
    if (bucket) {
      bucket.rows.push(entry);
    } else {
      map.set(day, { sortKey, rows: [entry] });
    }
  }
  const groups = Array.from(map.entries()).map(([day, value]) => ({
    day,
    sortKey: value.sortKey,
    rows: value.rows,
  }));
  // Newest day first; within a day, newest row first.
  groups.sort((a, b) => b.sortKey - a.sortKey);
  groups.forEach((g) =>
    g.rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  );
  return groups;
}

/** Format an ISO timestamp as a friendly relative time (e.g. `2 min ago`). */
function relativeTime(iso: string, nowMs: number): string {
  const diff = nowMs - new Date(iso).getTime();
  const seconds = Math.round(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function AuditTimeline() {
  const { contractId = "" } = useParams();
  const navigate = useNavigate();
  const contract = useContract(contractId);
  const entries = useAudit(contractId);
  const [activeCategories, setActiveCategories] = useState<Set<AuditCategory>>(
    () => new Set<AuditCategory>(["version", "feature", "permission"])
  );
  // Re-render every minute so `2 min ago` strings stay fresh while the user
  // has the route open. Cheap — it's just a state bump on a single page.
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const filtered = useMemo(
    () => entries.filter((entry) => activeCategories.has(entry.category)),
    [entries, activeCategories]
  );
  const groups = useMemo(() => groupByDayDescending(filtered), [filtered]);
  const categoryCounts = useMemo(() => {
    const counts: Record<AuditCategory, number> = { version: 0, feature: 0, permission: 0 };
    for (const entry of entries) counts[entry.category] += 1;
    return counts;
  }, [entries]);

  if (contract.loading) {
    return (
      <div aria-busy="true" aria-live="polite">
        <SkeletonComponent width="40%" height="28px" style={{ marginBottom: 10 }} />
        <SkeletonComponent width="70%" height="14px" style={{ marginBottom: 24 }} />
        <SkeletonComponent width="100%" height="280px" />
      </div>
    );
  }

  if (contract.error || !contract.data) {
    return (
      <StateMessage
        severity="Error"
        title="Contract not found"
        action={
          <ButtonComponent cssClass="claw-button" type="button" onClick={() => navigate("/")}>
            Back to dashboard
          </ButtonComponent>
        }
      >
        <p>The selected contract could not be loaded. It may have been removed or the link is invalid.</p>
      </StateMessage>
    );
  }

  function toggleCategory(category: AuditCategory) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  function handleClear() {
    clearAudit(contractId);
    showToast(`Cleared audit history for ${contract.data!.title}.`, "Audit timeline");
  }

  const filterChipStyle: CSSProperties = { marginRight: 8, marginBottom: 8, cursor: "pointer" };

  return (
    <section aria-labelledby="audit-title">
      <div className="claw-screen-heading">
        <div>
          <h2 id="audit-title">Activity for {contract.data!.title}</h2>
        </div>
        <div className="claw-actions">
          <ButtonComponent
            cssClass="claw-button"
            type="button"
            onClick={() => navigate(`/workflow/${contract.data!.id}/editor`)}
          >
            Open in Editor
          </ButtonComponent>
          <ButtonComponent
            cssClass="claw-button"
            type="button"
            disabled={entries.length === 0}
            onClick={handleClear}
          >
            Clear logs
          </ButtonComponent>
        </div>
      </div>

      <div className="claw-audit-filters" aria-label="Filter audit timeline by category">
        {(Object.keys(CATEGORY_LABEL) as AuditCategory[]).map((category) => {
          const active = activeCategories.has(category);
          return (
            <span
              key={category}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              className={`claw-chip${active ? " e-info" : ""}`}
              style={filterChipStyle}
              onClick={() => toggleCategory(category)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleCategory(category);
                }
              }}
            >
              <ChipListComponent
                cssClass="claw-chip"
                chips={[
                  {
                    text: `${CATEGORY_LABEL[category]} · ${categoryCounts[category]}`,
                    cssClass: active ? "e-info" : "",
                  },
                ]}
              />
            </span>
          );
        })}
      </div>

      {entries.length === 0 ? (
        <StateMessage severity="Info" title="No audit entries yet">
          <p>
            Save a version, toggle a demo feature, or assign a section to a reviewer to
            begin the audit trail. Entries are captured for the lifetime of this tab.
          </p>
        </StateMessage>
      ) : filtered.length === 0 ? (
        <StateMessage severity="Info" title="No entries match the current filters">
          <p>Toggle a category chip above to bring rows back into view.</p>
        </StateMessage>
      ) : (
        <ol className="claw-audit-list" aria-label="Audit timeline">
          {groups.map((group) => (
            <li key={group.day} className="claw-audit-day">
              <h2 className="claw-audit-day-label">{group.day}</h2>
              <ol className="claw-audit-rows" aria-label={`Audit entries for ${group.day}`}>
                {group.rows.map((row) => (
                  <li key={row.id} className={`claw-audit-row claw-audit-row--${row.category}`}>
                    <span
                      className={`claw-audit-icon ${ICON_BY_CATEGORY[row.category]}`}
                      aria-hidden="true"
                    />
                    <div className="claw-audit-body">
                      <div className="claw-audit-summary">{row.summary}</div>
                      <div className="claw-audit-meta">
                        <ChipListComponent
                          cssClass="claw-chip"
                          chips={[
                            { text: row.actor, cssClass: "e-info" },
                            {
                              text: CATEGORY_LABEL[row.category],
                              cssClass: "e-success",
                            },
                          ]}
                        />
                        <time dateTime={row.createdAt} title={new Date(row.createdAt).toLocaleString()}>
                          {relativeTime(row.createdAt, nowMs)}
                        </time>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}