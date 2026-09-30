/**
 * AllDocuments — Screen route (`/all-documents`)
 *
 * Lists every contract visible to the user: the seed catalogue plus every
 * user-uploaded DOCX stub registered through `uploadedContracts`. Clicking
 * a row opens the Editor for that contract (same flow as the Dashboard
 * template gallery and the upload card).
 *
 * Uploaded rows are tagged "Uploaded" so the user can tell seed vs upload
 * apart. The page reads from `contractService.listContracts()`, which itself
 * hydrates the uploaded rows from `sessionStorage` so a hard reload still
 * surfaces everything the user uploaded this session.
 *
 * The table is rendered with Syncfusion's `GridComponent` so we get built-in
 * sort, paging, and search behaviour for free. The text box in the panel
 * header pushes a query into the grid's built-in `search` settings.
 */

import ReactDOMServer from "react-dom/server";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ButtonComponent } from "@syncfusion/ej2-react-buttons";
import {
  DropDownButtonComponent,
  type ItemModel,
} from '@syncfusion/ej2-react-splitbuttons';
import type { MenuEventArgs } from '@syncfusion/ej2-splitbuttons';
import {
  GridComponent,
  ColumnsDirective,
  ColumnDirective,
  Page,
  Sort,
  Filter,
  Search,
  Inject,
} from "@syncfusion/ej2-react-grids";
import {
  FileEdit,
  ClipboardCheck,
  PenTool,
  History,
  Archive,
  type LucideIcon,
} from "lucide-react";
import { useContracts } from "../hooks/useAsync";
import { contractService } from "../services/contractService";
import { showToast } from "../components/AppToast";
import { StateMessage } from "../components/StateMessage";
import { LabelChip } from "../components/StatusChip";
import { isUploadedContract } from "../data/uploadedContracts";
import type { ContractDetail, ContractStatus, ContractType } from "../models";
import "../styles/pages.css";

function lucideIconMarkup(Icon: LucideIcon, size = 16): string {
  return ReactDOMServer.renderToStaticMarkup(
    <Icon size={size} strokeWidth={1.75} aria-hidden="true" />,
  );
}

const STATUS_CHIP: Record<ContractStatus, { text: string; cssClass: string }> = {
  Draft: { text: "Draft", cssClass: "e-warning" },
  InReview: { text: "In review", cssClass: "e-info" },
  PendingSignature: { text: "Pending signature", cssClass: "e-warning" },
  Published: { text: "Published", cssClass: "e-success" },
  Obsolete: { text: "Obsolete", cssClass: "e-secondary" },
};

interface Row {
  id: string;
  title: string;
  account: string;
  type: ContractType;
  status: ContractStatus;
  source: "Uploaded" | "Seed";
  version: number;
  updated: string;
  /** ISO updated timestamp used as the grid sort key. */
  updatedDate: string;
}

/**
 * AllDocumentsPanel — The "All Documents" grid formerly hosted at
 * `/all-documents`, now mounted directly inside the Dashboard below
 * `<KpiCards />`. Exports a named component (not a default export) so
 * the Dashboard can import it by name without an extra lazy chunk.
 *
 * Row-click and the per-row dropdown drive direct navigation into the
 * workflow tree at `/workflow/:contractId/<step>`.
 */
export default function AllDocumentsPanel() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("");
  // refreshKey bumps on cross-tab `storage` events so this page reflects
  // uploads made in another tab without a hard reload.
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith("claw-uploaded-")) {
        setRefreshKey((n) => n + 1);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const { data, loading, error, retry } = useContracts(refreshKey);

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    return data.map((c) => toRow(c));
  }, [data]);

  const counts = useMemo(() => {
    let uploaded = 0;
    for (const r of rows) if (r.source === "Uploaded") uploaded++;
    return { total: rows.length, uploaded };
  }, [rows]);

  // Sync the external filter input into the grid's built-in search settings
  // so the user gets instant filtering without us re-implementing it.
  const gridRef = useRef<GridComponent | null>(null);
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const next = { ...(grid.searchSettings ?? {}), key: filter };
    grid.searchSettings = next;
  }, [filter, rows.length]);

  function openRow(id: string) {
    showToast("Opening contract…", "All Documents");
    void navigate(`/workflow/${id}/editor`);
  }

  function markObsolete(row: Row) {
    if (row.status === "Obsolete") {
      showToast("Already obsolete", "All Documents");
      return;
    }
    const confirmed = window.confirm(
      `Mark "${row.title}" as obsolete? This moves the contract into a terminal state.`
    );
    if (!confirmed) return;
    const changed = contractService.markObsolete(row.id);
    if (!changed) {
      showToast("Could not mark obsolete", "All Documents");
      return;
    }
    showToast(`Marked "${row.title}" obsolete`, "All Documents");
  }

  function actionsTemplate(props: Row) {
    const items: ItemModel[] = [
      { id: "edit", text: "Edit" },
      { id: "compare", text: "Compare Versions" },
      { id: "publish", text: "Publish" },
      { id: "audit", text: "Audit Timeline" },
      { id: "obsolete", text: "Mark Obsolete" },
    ];
    const iconFor: Record<string, LucideIcon> = {
      edit: FileEdit,
      compare: ClipboardCheck,
      publish: PenTool,
      audit: History,
      obsolete: Archive,
    };
    const routeFor: Record<string, { child: string; label: string }> = {
      edit: { child: "editor", label: "Editor" },
      compare: { child: "review", label: "Compare Versions" },
      publish: { child: "sign", label: "Sign & Publish" },
      audit: { child: "audit", label: "Audit Timeline" },
    };
    const beforeItemRender = (e: MenuEventArgs) => {
      const id = (e.item as ItemModel | undefined)?.id;
      const Icon = id ? iconFor[id] : undefined;
      if (!Icon) return;
      const span = document.createElement("span");
      span.className = "claw-all-docs-actions-icon";
      span.innerHTML = lucideIconMarkup(Icon);
      e.element.prepend(span);
    };
    return (
      <span
        onMouseDown={(e) => e?.stopPropagation()}
        onClick={(e) => e?.stopPropagation()}
        onPointerDown={(e) => e?.stopPropagation()}
      >
        <DropDownButtonComponent
          cssClass="claw-all-docs-actions-popup"
          content="Actions"
          items={items}
          beforeItemRender={beforeItemRender}
          select={(e) => {
            const id = (e.item as ItemModel | undefined)?.id;
            if (!id) return;
            const contractId = props.id;
            if (!contractId) return;
            if (id === "obsolete") {
              markObsolete(props);
              return;
            }
            const target = routeFor[id];
            if (!target) return;
            void navigate(`/workflow/${contractId}/${target.child}`);
          }}
        />
      </span>
    );
  }

  function statusTemplate(props: Row) {
    const chip = STATUS_CHIP[props.status] ?? { text: props.status, cssClass: "e-info" };
    return <LabelChip text={chip.text} cssClass={chip.cssClass} />;
  }

  function versionTemplate(props: Row) {
    return (
      <LabelChip
        text={`V${props.version}`}
        cssClass="e-outline claw-all-docs-version-chip"
      />
    );
  }

  function sourceTemplate(props: Row) {
    const isUploaded = props.source === "Uploaded";
    return (
      <LabelChip
        text={props.source}
        cssClass={
          isUploaded
            ? "e-info claw-all-docs-source-chip claw-all-docs-source-chip--uploaded"
            : "e-secondary claw-all-docs-source-chip claw-all-docs-source-chip--seed"
        }
      />
    );
  }

  function titleTemplate(props: Row) {
    const sub = props.source === "Uploaded" ? "Uploaded file" : "Seed contract";
    return (
      <div className="claw-all-docs-title">
        <div className="claw-all-docs-title-text">
          <a
            className="claw-all-docs-title-link"
            href={`/workflow/${props.id}/editor`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openRow(props.id);
            }}
            title={`Open ${props.title}`}
          >
            <span className="claw-all-docs-title-name">{props.title}</span>
            <span className="claw-all-docs-title-open" aria-hidden="true">
              ↗
            </span>
          </a>
          <div className="claw-all-docs-title-sub muted">
            {sub} · {props.id}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby="all-docs-title">
      <div className="claw-panel">
        <div className="claw-panel-heading">
          <div className="claw-panel-heading-caption">
            <div className="claw-panel-heading-title">
              {counts.total} document{counts.total === 1 ? "" : "s"}
              {counts.uploaded > 0 ? (
                <span className="muted claw-all-docs-sub">
                  · {counts.uploaded} uploaded this session
                </span>
              ) : null}
            </div>
            <div className="claw-panel-heading-sub">
              Click a row to open it in the editor.
            </div>
          </div>
          <label className="claw-all-docs-search">
            <span className="claw-all-docs-search-label">Filter</span>
            <input
              type="search"
              placeholder="Search title or status"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter documents"
            />
          </label>
        </div>
        <div className="claw-panel-body">
          {loading ? (
            <StateMessage severity="Info" title="Loading documents…">
              <p>Fetching the workspace catalogue.</p>
            </StateMessage>
          ) : error ? (
            <StateMessage
              severity="Error"
              title="Could not load documents"
              action={
                <ButtonComponent cssClass="claw-button" type="button" onClick={retry}>
                  Retry
                </ButtonComponent>
              }
            >
              <p>{error.message}</p>
            </StateMessage>
          ) : rows.length === 0 ? (
            <EmptyState onUpload={() => void navigate("/")} />
          ) : (
            <div className="claw-all-docs-grid-wrap" aria-label="All documents">
              <GridComponent
                ref={gridRef}
                dataSource={rows}
                cssClass="claw-all-docs-grid"
                allowSorting={false}
                allowFiltering
                filterSettings={{type: 'Excel'}}
                allowPaging
                pageSettings={{ pageSize: 10, pageSizes: [10, 25, 50], currentPage: 1 }}
                // sortSettings={{ columns: [{ field: "updatedDate", direction: "Descending" }] }}
                searchSettings={{ fields: ["title", "account", "status", "type"], operator: "contains", key: "", ignoreCase: true }}
                rowHeight={56}
                gridLines="None"
                recordDoubleClick={(e) => {
                  const id = (e.rowData as Row | undefined)?.id;
                  if (id) openRow(id);
                }}
              >
                <ColumnsDirective>
                  <ColumnDirective
                    field="title"
                    headerText="Document"
                    width="280"
                    template={titleTemplate}
                    minWidth="220"
                  />
                  <ColumnDirective
                    field="source"
                    headerText="Source"
                    width="120"
                    template={sourceTemplate}
                  />
                  <ColumnDirective
                    field="status"
                    headerText="Status"
                    width="100"
                    template={statusTemplate}
                  />
                  <ColumnDirective
                    field="version"
                    headerText="Version"
                    width="100"
                    textAlign="Left"
                    template={versionTemplate}
                  />
                  <ColumnDirective
                    field="updated"
                    headerText="Updated"
                    width="160"
                  />
                  <ColumnDirective
                    headerText="Actions"
                    width="140"
                    minWidth="120"
                    template={actionsTemplate}
                    allowSorting={false}
                    textAlign="Left"
                  />
                </ColumnsDirective>
                <Inject services={[Page, Sort, Filter, Search]} />
              </GridComponent>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <StateMessage
      severity="Info"
      title="No documents yet"
      action={
        <ButtonComponent cssClass="claw-button primary" isPrimary type="button" onClick={onUpload}>
          Upload a .docx
        </ButtonComponent>
      }
    >
      <p>
        Upload a file from the Dashboard, or pick a template — every contract will appear here.
      </p>
    </StateMessage>
  );
}

function toRow(c: ContractDetail): Row {
  return {
    id: c.id,
    title: c.title,
    account: c.accountName,
    type: c.type,
    status: c.status,
    source: isUploadedContract(c.id) ? "Uploaded" : "Seed",
    version: c.currentVersion,
    updated: formatRelativeDate(c.updatedDate),
    updatedDate: c.updatedDate,
  };
}

function formatRelativeDate(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  const diff = Date.now() - ms;
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.floor(diff / min)} min ago`;
  if (diff < day) return `${Math.floor(diff / hr)} hr ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} day${Math.floor(diff / day) === 1 ? "" : "s"} ago`;
  return new Date(ms).toLocaleDateString();
}
