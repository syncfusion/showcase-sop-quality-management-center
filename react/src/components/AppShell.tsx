/**
 * AppShell — Top-level layout: Syncfusion Sidebar (left) + top AppBar + main.
 *
 * Sidebar hosts exactly two nav items: **Dashboard** and **New Document**.
 *   - Dashboard:     `/`                       (exact match).
 *   - New Document:  `/new`                    (the upload + template surface,
 *                                              exact match — does NOT light up
 *                                              on `/workflow/:id/...`).
 *
 * The per-document workflow tree at `/workflow/:contractId/...` is reached
 * from Recent-list clicks or the upload surface; it has its own horizontal
 * `<WorkflowStepper />` owned by `WorkflowLayout` and is no longer surfaced
 * as a sidebar item.
 *
 * The old per-step sidebar buttons (Editor / Review / Sign / Audit) are
 * gone — the horizontal stepper is the only nav between Editor ⇆ Review
 * ⇆ Sign ⇆ Audit. The "Open a document" Dialog has also been removed; the
 * upload surface is a regular page at `/new` instead of a modal.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AppBarComponent,
  BreadcrumbComponent,
  BreadcrumbItemDirective,
  BreadcrumbItemsDirective,
  SidebarComponent,
  type ChangeEventArgs,
} from "@syncfusion/ej2-react-navigations";
import { ButtonComponent, SwitchComponent } from "@syncfusion/ej2-react-buttons";
import { LayoutGrid, FilePlus, Moon, Sun } from "lucide-react";
import { SkeletonComponent } from "@syncfusion/ej2-react-notifications";
import type { ThemeMode } from "../hooks/useTheme";
import {
  contractIdFromPath,
  titleForPathname,
  workflowPathForStatus,
} from "./workflowSteps";
import { useContracts } from "../hooks/useAsync";
import { isUploadedContract } from "../data/uploadedContracts";
import type { ContractDetail } from "../models";
import "../styles/app-shell.css";

interface AppShellProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  children: ReactNode;
}

const DESKTOP_MQ = "(min-width: 1024px)";

/**
 * Top-level nav. Both items use exact-match active states:
 *   - Dashboard highlights only on `/`.
 *   - New Document highlights only on `/new` — it must NOT light up on the
 *     per-document workflow tree at `/workflow/:id/...`, because that tree
 *     is its own workflow context and shares the stepper instead of the
 *     sidebar.
 */
const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutGrid, path: "/" },
  { key: "newDocument", label: "New Document", icon: FilePlus, path: "/new" },
] as const;

function isDesktopViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia(DESKTOP_MQ).matches;
}

function isItemActive(itemPath: string, pathname: string): boolean {
  return pathname === itemPath;
}

export default function AppShell({ theme, onToggleTheme, children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const sidebarRef = useRef<SidebarComponent>(null);
  const [isOpen, setIsOpen] = useState(isDesktopViewport);
  const [isDesktop, setIsDesktop] = useState(isDesktopViewport);
  const currentScreen = titleForPathname(location.pathname);

  /**
   * Contract id from the URL, when the user is inside `/workflow/:id/<child>`.
   * `null` for Dashboard (`/`) and the upload surface (`/new`) — in which
   * case no Recent row is highlighted. Reuses the same regex the
   * `<WorkflowStepper />` uses to derive its active step, so the sidebar
   * highlight and the stepper always agree on "which document is open".
   */
  const activeContractId = contractIdFromPath(location.pathname);

  /**
   * "Recent" list — every contract visible to the user. Uploaded DOCX stubs
   * surface first (the user just created them), then everything else by
   * `createdDate` desc so the most recently *created* contracts lead. The
   * sidebar intentionally sorts on `createdDate` (not `updatedDate`) so a
   * save / status flip on an older contract doesn't bump it ahead of newer
   * ones in the Recent list. Re-fetches on the shared refresh key so an
   * upload from the upload surface (or the Dashboard) immediately bumps the
   * sidebar without a hard reload.
   */
  const { data: recentContracts, loading: recentLoading } = useContracts();
  const recent: ContractDetail[] = useMemo(() => {
    if (!recentContracts) return [];
    return [...recentContracts].sort((a, b) => {
      const aUpload = isUploadedContract(a.id) ? 1 : 0;
      const bUpload = isUploadedContract(b.id) ? 1 : 0;
      if (aUpload !== bUpload) return bUpload - aUpload;
      return Date.parse(b.createdDate) - Date.parse(a.createdDate);
    });
  }, [recentContracts]);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const onChange = () => {
      const desktop = mq.matches;
      setIsDesktop(desktop);
      setIsOpen(desktop);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (!window.matchMedia(DESKTOP_MQ).matches) {
        sidebarRef.current?.hide(event);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleToggle = useCallback(() => {
    setIsOpen((open) => !open);
  }, []);

  const handleSidebarChange = useCallback((args: ChangeEventArgs) => {
    const nowOpen = args.element.classList.contains("e-open");
    setIsOpen((prev) => (prev === nowOpen ? prev : nowOpen));
  }, []);

  /**
   * Click handler for sidebar nav. The mobile-over sidebar auto-hides on
   * navigate so the user sees the new page, not the sidebar backdrop.
   */
  const handleNav = useCallback(
    (path: string) => {
      if (path === location.pathname) {
        if (!window.matchMedia(DESKTOP_MQ).matches) sidebarRef.current?.hide();
        return;
      }
      void navigate(path);
      if (!window.matchMedia(DESKTOP_MQ).matches) sidebarRef.current?.hide();
    },
    [location.pathname, navigate]
  );

  /**
   * Click handler for Recent rows. The destination is the per-doc workflow
   * child that matches the contract's current lifecycle status, so the user
   * lands on the relevant step (Draft → editor, InReview → review,
   * PendingSignature → sign, Published/Obsolete → audit). Mobile-over
   * sidebar auto-hides on navigate so the user sees the new page.
   */
  const handleRecentNav = useCallback(
    (contract: ContractDetail) => {
      const target = workflowPathForStatus(contract.id, contract.status);
      if (!target) return;
      if (target === location.pathname) {
        if (!window.matchMedia(DESKTOP_MQ).matches) sidebarRef.current?.hide();
        return;
      }
      void navigate(target);
      if (!window.matchMedia(DESKTOP_MQ).matches) sidebarRef.current?.hide();
    },
    [location.pathname, navigate]
  );

  return (
    <div className="claw-app-shell" id="claw-app-shell">
      <SidebarComponent
        ref={sidebarRef}
        id="claw-sidebar"
        className="claw-sidebar"
        width="248px"
        dockSize="60px"
        enableDock
        type={isDesktop ? "Push" : "Over"}
        position="Left"
        isOpen={isOpen}
        target="#claw-app-shell"
        showBackdrop={!isDesktop}
        closeOnDocumentClick={!isDesktop}
        enableGestures={!isDesktop}
        animate
        change={handleSidebarChange}
      >
        <div className="claw-sidebar-inner">
          <div className="claw-brand">
            <div className="claw-brand-mark" aria-hidden="true">
              SOP
            </div>
            <div className="claw-brand-text">
              <div className="claw-brand-title">SOP Manager</div>
              <div className="claw-brand-sub">Approval Workspace</div>
            </div>
          </div>
          <nav className="claw-overview-nav" aria-label="Primary">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = isItemActive(item.path, location.pathname);
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`claw-nav-item${isActive ? " claw-nav-item--active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => handleNav(item.path)}
                >
                  <Icon className="claw-nav-item-icon" size={18} strokeWidth={1.75} aria-hidden="true" />
                  <span className="claw-nav-item-label">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="claw-recent" aria-label="Recent documents">
            <div className="claw-recent-label claw-eyebrow">Recent</div>
            <ul className="claw-recent-list" role="list">
              {recentLoading ? (
                <RecentListSkeleton />
              ) : recent.length === 0 ? (
                <li className="claw-recent-empty">No documents yet</li>
              ) : (
                recent.map((contract) => {
                  const isActive = contract.id === activeContractId;
                  return (
                    <li key={contract.id}>
                      <button
                        type="button"
                        className={`claw-recent-item${isActive ? " claw-recent-item--active" : ""}`}
                        data-active={isActive ? "true" : undefined}
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => handleRecentNav(contract)}
                        title={contract.title}
                      >
                        <span
                          className="claw-recent-dot"
                          data-status={contract.status}
                          aria-hidden="true"
                        />
                        <span className="claw-recent-title">{contract.title}</span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          <div className="claw-sidebar-footer">
            Demo data is synthetic — edits reset on reload.
          </div>
        </div>
      </SidebarComponent>

      <div className="claw-main e-main-content">
        <a href="#main-content" className="claw-skip-link">
          Skip to main content
        </a>
        <AppBarComponent colorMode="Inherit" cssClass="claw-topbar" isSticky>
          <div className="claw-topbar-start">
            <ButtonComponent
              type="button"
              cssClass="claw-icon-button"
              iconCss="e-icons e-menu"
              onClick={handleToggle}
              aria-label={isOpen ? "Collapse navigation" : "Expand navigation"}
              aria-controls="claw-sidebar"
              aria-expanded={isOpen}
            />
            <nav aria-label="Breadcrumb">
            <BreadcrumbComponent
              cssClass="claw-breadcrumb"
              enableNavigation={false}
              overflowMode="Wrap"
            >
              <BreadcrumbItemsDirective>
                <BreadcrumbItemDirective text="SOP" />
                <BreadcrumbItemDirective text={currentScreen} />
              </BreadcrumbItemsDirective>
            </BreadcrumbComponent>
            </nav>
          </div>
          <span className="e-appbar-spacer" />
          <div className="claw-top-actions">
            <div className="claw-theme-toggle" title="Toggle theme">
              <span className="claw-theme-toggle-icon" aria-hidden="true">
                {theme === "light" ? (
                  <Sun size={18} strokeWidth={1.75} />
                ) : (
                  <Moon size={18} strokeWidth={1.75} />
                )}
              </span>
              <SwitchComponent
                cssClass="claw-theme-switch"
                checked={theme === "dark"}
                change={onToggleTheme}
                aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              />
            </div>
            <div
              className="claw-avatar"
              aria-label="Current user: Adam Bennett"
              title="Adam Bennett"
            >
              AB
            </div>
          </div>
        </AppBarComponent>

        <main className="claw-content" id="main-content">
          <div className="claw-content-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}

/**
 * Skeleton state for the Recent list. Renders while the contracts fetch
 * is in flight so the sidebar doesn't collapse to a single "No documents
 * yet" row on first paint. Each placeholder mirrors the shape of a real
 * Recent row (a small status-dot block + a longer title bar) so the
 * layout doesn't jump when the real data arrives.
 */
function RecentListSkeleton() {
  // Vary the title bar widths so the loading state doesn't look like a
  // stack of identical bars. Indices match the slot in the list.
  const titleWidths = ["78%", "62%", "88%", "70%"];
  return (
    <ul className="claw-recent-list claw-recent-list--loading" role="list" aria-busy="true" aria-label="Loading recent documents">
      {titleWidths.map((width, i) => (
        <li key={i} className="claw-recent-item claw-recent-item--skeleton" aria-hidden="true">
          <SkeletonComponent
            width="8px"
            height="8px"
            shape="Circle"
            cssClass="claw-recent-dot-skeleton"
          />
          <SkeletonComponent
            width={width}
            height="12px"
            cssClass="claw-recent-title-skeleton"
          />
        </li>
      ))}
    </ul>
  );
}