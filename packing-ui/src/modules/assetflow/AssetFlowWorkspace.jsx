import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import assetFlowApi from "./assetFlowApi";
import { createQrMatrix } from "./assetQr";
import { AssetFlowThemeProvider, useAssetFlowTheme } from "./assetflowUi";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import PrecisionManufacturingOutlinedIcon from "@mui/icons-material/PrecisionManufacturingOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import AppsIcon from "@mui/icons-material/Apps";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import AddAlertOutlinedIcon from "@mui/icons-material/AddAlertOutlined";
import "./assetflow.css";

const TABS = [
  ["dashboard", "Dashboard"],
  ["work", "Work Orders"],
  ["calendar", "Calendar"],
  ["equipment", "Equipment"],
  ["reports", "Reports"],
  ["config", "Configuration"],
];

const KANBAN = [
  ["NEW", "New Request"],
  ["PLANNED", "Planned"],
  ["ASSIGNED", "Assigned"],
  ["ACCEPTED", "Accepted"],
  ["IN_PROGRESS", "In Progress"],
  ["WAITING_PARTS", "Waiting Parts"],
  ["REPAIRED", "Repaired"],
];

const PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"];
const WORK_TYPES = ["CORRECTIVE", "PREVENTIVE", "INSPECTION", "CALIBRATION", "IMPROVEMENT"];
const EQUIPMENT_STATUSES = ["ACTIVE", "UNDER_MAINTENANCE", "DOWN", "RETIRED"];
const CRITICALITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const SERVICE_DOMAINS = ["MACHINE", "IT"];
const ASSET_KINDS = ["PRODUCTION_MACHINE", "IT_ASSET", "ELECTRICAL_ASSET", "FACILITY_ASSET", "UTILITY_ASSET", "OTHER"];
const REPORTER_TYPES = ["EMPLOYEE", "OPERATOR", "SUPERVISOR", "STAFF", "CONTRACTOR", "OTHER"];

const SERVICE_DOMAIN_LABELS = {
  MACHINE: "Machine Maintenance",
  IT: "IT Support",
};

const EMPTY_WORK = {
  title: "",
  description: "",
  instructions: "",
  equipmentId: "",
  serviceDomain: "MACHINE",
  requestCategory: "",
  plantCode: "",
  location: "",
  requestedBy: "",
  operatorName: "",
  operatorContact: "",
  teamName: "",
  responsible: "",
  workType: "CORRECTIVE",
  priority: "NORMAL",
  requestedForAt: "",
  scheduledAt: "",
  estimatedMinutes: 60,
  downtimeMinutes: 0,
  breakdown: true,
  productionStopped: false,
  safetyRisk: false,
  rootCause: "",
  actionTaken: "",
  partsUsed: "",
  partsCost: 0,
  laborCost: 0,
  externalCost: 0,
  verificationNote: "",
};

const EMPTY_EQUIPMENT = {
  assetCode: "",
  name: "",
  category: "",
  serviceDomain: "MACHINE",
  assetKind: "PRODUCTION_MACHINE",
  plantCode: "",
  location: "",
  workCenter: "",
  manufacturer: "",
  model: "",
  serialNumber: "",
  criticality: "MEDIUM",
  status: "ACTIVE",
  maintenanceTeam: "",
  primaryTechnician: "",
  owner: "",
  assignedToCode: "",
  assignedToName: "",
  assignedDepartment: "",
  hostname: "",
  ipAddress: "",
  macAddress: "",
  operatingSystem: "",
  purchaseDate: "",
  commissionedDate: "",
  warrantyExpiry: "",
  description: "",
  qrEnabled: true,
  safetyNotes: "",
};

const EMPTY_TEAM = {
  name: "",
  plantCode: "",
  serviceDomain: "MACHINE",
  lead: "",
  membersText: "",
  defaultForPlant: false,
  publicReportingEnabled: true,
  defaultCategories: "",
  active: true,
};

const EMPTY_REPORTER = {
  reporterCode: "",
  displayName: "",
  reporterType: "EMPLOYEE",
  plantCode: "",
  plantCodes: [],
  linkedUsername: "",
  department: "",
  designation: "",
  phone: "",
  email: "",
  allowedDomains: ["MACHINE"],
  accessPin: "",
  active: true,
  validUntil: "",
};
const EMPTY_PLAN = {
  equipmentId: "",
  title: "",
  intervalDays: 30,
  leadDays: 3,
  nextDueDate: dateInput(new Date()),
  scheduledTime: "09:00",
  estimatedMinutes: 60,
  defaultPriority: "NORMAL",
  teamName: "",
  responsible: "",
  requiresShutdown: false,
  instructions: "",
  checklistText: "",
  active: true,
};

function parseBusinessDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const copy = new Date(value.getTime());
    return Number.isNaN(copy.getTime()) ? null : copy;
  }

  const text = String(value).trim();
  if (!text) return null;

  const localMatch = text.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/
  );

  // Spring LocalDate / LocalDateTime values intentionally represent business-local
  // wall-clock time. Build them from components instead of allowing Date.parse()
  // to reinterpret a date-only value as UTC.
  if (localMatch) {
    const [, year, month, day, hour = "0", minute = "0", second = "0", millis = "0"] = localMatch;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      Number(String(millis).padEnd(3, "0"))
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function dateInput(value) {
  const d = parseBusinessDate(value);
  if (!d) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function dateTimeInput(value) {
  const d = parseBusinessDate(value);
  if (!d) return "";
  return `${dateInput(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fmtDate(value, withTime = false) {
  const d = parseBusinessDate(value);
  if (!d) return value ? String(value) : "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(d);
}

function isPastBusinessDate(value) {
  const d = parseBusinessDate(value);
  return Boolean(d && d.getTime() < Date.now());
}

function fmtNumber(value, digits = 0) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits }).format(Number(value || 0));
}

function fmtMoney(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function human(value) {
  return String(value || "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function MachineQr({ value, size = 184 }) {
  const matrix = useMemo(() => {
    try {
      return createQrMatrix(value, "M");
    } catch {
      return [];
    }
  }, [value]);

  if (!matrix.length) return <div className="af-qr-unavailable">QR unavailable</div>;
  const quiet = 4;
  const dimension = matrix.length + quiet * 2;

  return (
    <svg
      className="af-machine-qr"
      width={size}
      height={size}
      viewBox={`0 0 ${dimension} ${dimension}`}
      role="img"
      aria-label="Machine maintenance QR code"
      shapeRendering="crispEdges"
    >
      <rect x="0" y="0" width={dimension} height={dimension} fill="#fff" />
      <g fill="#000">
        {matrix.flatMap((row, r) => row.map((dark, c) => dark ? (
          <rect key={`${r}-${c}`} x={c + quiet} y={r + quiet} width="1" height="1" />
        ) : null))}
      </g>
    </svg>
  );
}

function errorText(error) {
  return error?.response?.data?.message || error?.response?.data?.error || error?.message || "Something went wrong";
}

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => setDebounced(value), delay);
    return () => globalThis.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function useAsync(fn, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    if (mountedRef.current) {
      setState((current) => ({ ...current, loading: true, error: null }));
    }

    try {
      const data = await fn();
      if (mountedRef.current && requestId === requestIdRef.current) {
        setState({ loading: false, data, error: null });
      }
      return data;
    } catch (error) {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setState({ loading: false, data: null, error });
      }
      throw error;
    }
    // The caller supplies the dependency contract for fn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  return { ...state, reload: load };
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(onClose, 3500);
    return () => clearTimeout(id);
  }, [toast, onClose]);
  if (!toast) return null;
  return <div className={cx("af-toast", toast.type === "error" && "is-error")}>{toast.message}</div>;
}

function Button({ children, className = "", variant = "default", ...props }) {
  return (
    <button className={cx("af-btn", `af-btn-${variant}`, className)} {...props}>
      {children}
    </button>
  );
}

function Badge({ children, tone = "neutral" }) {
  return <span className={cx("af-badge", `tone-${tone}`)}>{children}</span>;
}

function StatusBadge({ status }) {
  const tone = {
    NEW: "blue",
    PLANNED: "violet",
    ASSIGNED: "blue",
    ACCEPTED: "teal",
    IN_PROGRESS: "amber",
    WAITING_PARTS: "orange",
    REPAIRED: "teal",
    CLOSED: "green",
    SCRAPPED: "red",
    CANCELLED: "neutral",
    ACTIVE: "green",
    UNDER_MAINTENANCE: "amber",
    DOWN: "red",
    RETIRED: "neutral",
  }[status] || "neutral";
  return <Badge tone={tone}>{human(status)}</Badge>;
}

function PriorityBadge({ value }) {
  const tone = value === "CRITICAL" ? "red" : value === "HIGH" ? "orange" : value === "NORMAL" ? "blue" : "neutral";
  return <Badge tone={tone}>{human(value)}</Badge>;
}

function Field({ label, children, hint }) {
  return (
    <label className="af-field">
      <span className="af-label">{label}</span>
      {children}
      {hint && <span className="af-hint">{hint}</span>}
    </label>
  );
}

function Modal({ title, subtitle, children, onClose, wide = false }) {
  return (
    <div className="af-modal-backdrop" onMouseDown={onClose}>
      <div className={cx("af-modal", wide && "is-wide")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="af-modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="af-icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyState({ title, text, action }) {
  return (
    <div className="af-empty">
      <div className="af-empty-icon">⌁</div>
      <strong>{title}</strong>
      <span>{text}</span>
      {action}
    </div>
  );
}

function Loading() {
  return <div className="af-loading"><span /><span /><span /></div>;
}

function ErrorBox({ error, onRetry }) {
  return (
    <div className="af-error">
      <strong>Could not load AssetFlow data</strong>
      <span>{errorText(error)}</span>
      {onRetry && <Button onClick={onRetry}>Retry</Button>}
    </div>
  );
}

function AssetFlowWorkspaceContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { roles = [], username = "", user, logout } = useAuth();
  const { isDark, toggleMode } = useAssetFlowTheme();
  const [collapsed, setCollapsed] = useState(false);
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const qrToken = query.get("asset") || query.get("qr") || "";
  const qrMode = String(query.get("mode") || "").toLowerCase() === "report" && Boolean(qrToken);

  const [tab, setTab] = useState("dashboard");
  const [plantCode, setPlantCode] = useState("");
  const [serviceDomain, setServiceDomain] = useState("");
  const [toast, setToast] = useState(null);
  const plants = useAsync(() => assetFlowApi.plants(), []);

  const normalizedRoles = useMemo(
    () => (roles || []).map((role) => String(role || "").replace(/^ROLE_/i, "").toUpperCase()),
    [roles]
  );

  const isAdmin = normalizedRoles.includes("ADMIN");
  const isDirector = normalizedRoles.includes("ASSETFLOW_DIRECTOR");
  const isLegacyManager = normalizedRoles.includes("ASSETFLOW_MANAGER");
  const isLegacyPlanner = normalizedRoles.includes("ASSETFLOW_PLANNER");

  const isMachineHead =
    normalizedRoles.includes("ASSETFLOW_MACHINE_HEAD") ||
    normalizedRoles.includes("ASSETFLOW_HEAD_TECHNICIAN");
  const isMachineTechnician =
    normalizedRoles.includes("ASSETFLOW_MACHINE_TECHNICIAN") ||
    normalizedRoles.includes("ASSETFLOW_TECHNICIAN");
  const isItHead = normalizedRoles.includes("ASSETFLOW_IT_HEAD");
  const isItTechnician = normalizedRoles.includes("ASSETFLOW_IT_TECHNICIAN");

  const crossDomain = isAdmin || isDirector;
  const allowedDomains = useMemo(() => {
    if (crossDomain) return ["MACHINE", "IT"];
    if (isMachineHead || isMachineTechnician || isLegacyManager || isLegacyPlanner) return ["MACHINE"];
    if (isItHead || isItTechnician) return ["IT"];
    return [];
  }, [crossDomain, isMachineHead, isMachineTechnician, isLegacyManager, isLegacyPlanner, isItHead, isItTechnician]);

  useEffect(() => {
    if (!crossDomain && allowedDomains.length === 1 && serviceDomain !== allowedDomains[0]) {
      setServiceDomain(allowedDomains[0]);
    }
    if (crossDomain && serviceDomain && !allowedDomains.includes(serviceDomain)) {
      setServiceDomain("");
    }
  }, [crossDomain, allowedDomains, serviceDomain]);

  const selectedDomain = serviceDomain || "";
  const domainIsMachine = selectedDomain === "MACHINE";
  const domainIsIt = selectedDomain === "IT";

  const canCoordinate =
    !isDirector &&
    (
      isAdmin ||
      (domainIsMachine && (isMachineHead || isLegacyManager || isLegacyPlanner)) ||
      (domainIsIt && isItHead)
    );

  const canManageMasters = canCoordinate;

  // Asset master edits are deliberately stricter than general coordination.
  // Only ADMIN or the owning department Head can update an existing asset.
  // Legacy Manager/Planner roles may keep their previous coordination surfaces
  // but they do not receive the new asset edit/update control.
  const canEditAssets =
    !isDirector &&
    (
      isAdmin ||
      (domainIsMachine && isMachineHead) ||
      (domainIsIt && isItHead)
    );

  const canExecute =
    !isDirector &&
    (
      canCoordinate ||
      (domainIsMachine && isMachineTechnician) ||
      (domainIsIt && isItTechnician)
    );

  const canViewReports =
    isAdmin ||
    isDirector ||
    isLegacyManager ||
    isLegacyPlanner ||
    isMachineHead ||
    isItHead;

  const visibleTabs = useMemo(
    () => TABS.filter(([key]) => {
      if (key === "reports") return canViewReports;
      if (key === "config") return canManageMasters || isAdmin;
      return true;
    }),
    [canManageMasters, canViewReports, isAdmin]
  );

  useEffect(() => {
    if (!visibleTabs.some(([key]) => key === tab)) setTab(visibleTabs[0]?.[0] || "dashboard");
  }, [tab, visibleTabs]);

  useEffect(() => {
    const available = plants.data || [];
    if (available.length === 1 && !plantCode) setPlantCode(available[0].name);
  }, [plants.data, plantCode]);

  const notify = useCallback((message, type = "success") => setToast({ message, type }), []);

  if (qrMode) {
    return (
      <div className="af-shell af-mobile-shell">
        <QrComplaintPortal
          token={qrToken}
          username={username}
          onOpenAssetFlow={() => navigate("/modules?module=assetflow", { replace: true })}
        />
      </div>
    );
  }

  const roleLabel = isAdmin
    ? "Administrator"
    : isDirector
      ? "Director · Overall Maintenance"
      : isItHead
        ? "IT Head"
        : isItTechnician
          ? "IT Technician"
          : isMachineHead
            ? "Machine Maintenance Head"
            : isMachineTechnician
              ? "Machine Maintenance Technician"
              : isLegacyManager
                ? "Maintenance Manager · Legacy"
                : isLegacyPlanner
                  ? "Maintenance Planner · Legacy"
                  : "AssetFlow User";

  const domainLabel = selectedDomain
    ? SERVICE_DOMAIN_LABELS[selectedDomain]
    : "Overall · Machine + IT";

  const tabLabel = (key, fallback) => {
    if (key !== "equipment") return fallback;
    if (selectedDomain === "IT") return "IT Asset Master";
    if (selectedDomain === "MACHINE") return "Machine Master";
    return "Asset Masters";
  };

  const navIcon = (key) => ({
    dashboard: <DashboardOutlinedIcon />,
    work: <AssignmentOutlinedIcon />,
    calendar: <CalendarMonthOutlinedIcon />,
    equipment: <PrecisionManufacturingOutlinedIcon />,
    reports: <AssessmentOutlinedIcon />,
    config: <SettingsOutlinedIcon />,
  })[key] || <AssignmentOutlinedIcon />;

  const navSection = (key) => {
    if (key === "dashboard") return "HOME";
    if (["work", "calendar"].includes(key)) return "OPERATIONS";
    if (key === "equipment") return "ASSETS";
    return "CONTROL";
  };

  const navSections = [
    ["HOME", "Home"],
    ["OPERATIONS", "My Work"],
    ["ASSETS", "Assets"],
    ["CONTROL", "Control & Reports"],
  ];

  const headerMeta = {
    dashboard: [
      selectedDomain === "IT" ? "IT Support Dashboard" : selectedDomain === "MACHINE" ? "Machine Maintenance Dashboard" : "Overall Maintenance Dashboard",
      selectedDomain === "IT" ? "IT service health, request workload and asset performance." : selectedDomain === "MACHINE" ? "Machine reliability, downtime, PM and maintenance workload." : "Director view across Machine Maintenance and IT Support.",
    ],
    work: ["Work Orders", "Requests, planning, assignment, execution and closure."],
    calendar: ["Maintenance Calendar", "Scheduled corrective and preventive work by date."],
    equipment: [tabLabel("equipment", "Equipment"), selectedDomain === "IT" ? "IT asset register and QR-linked support history." : selectedDomain === "MACHINE" ? "Machine register, QR-linked history and reliability health." : "Machine and IT asset masters remain department-separated."],
    reports: [selectedDomain === "IT" ? "IT Support Reports" : selectedDomain === "MACHINE" ? "Machine Maintenance Reports" : "Overall Maintenance Reports", "Performance, reliability, workload and management analytics."],
    config: ["AssetFlow Configuration", "Service routing, Reporter Passes, Service Desk QR and preventive plans."],
  }[tab] || ["AssetFlow", domainLabel];

  const handleLogout = async () => {
    if (typeof logout === "function") await logout();
    navigate("/login", { replace: true });
  };

  const renderContent = () => (
    <>
      {tab === "dashboard" && (
        <Dashboard
          plantCode={plantCode}
          serviceDomain={selectedDomain}
          onNavigate={setTab}
          showDepartmentComparison={crossDomain && !selectedDomain}
        />
      )}

      {tab === "work" && (
        <WorkOrders
          plantCode={plantCode}
          serviceDomain={selectedDomain}
          notify={notify}
          plants={plants.data || []}
          canCoordinate={canCoordinate}
          canManageMasters={canManageMasters}
          canExecute={canExecute}
          readOnly={isDirector}
          username={username}
        />
      )}

      {tab === "calendar" && <MaintenanceCalendar plantCode={plantCode} serviceDomain={selectedDomain} />}

      {tab === "equipment" && (
        <Equipment
          plantCode={plantCode}
          serviceDomain={selectedDomain}
          notify={notify}
          plants={plants.data || []}
          canManageMasters={canManageMasters}
          canEditAssets={canEditAssets}
          readOnly={isDirector}
        />
      )}

      {tab === "reports" && canViewReports && (
        <Reports
          plantCode={plantCode}
          serviceDomain={selectedDomain}
          showDepartmentComparison={crossDomain && !selectedDomain}
        />
      )}

      {tab === "config" && (canManageMasters || isAdmin) && (
        <Configuration
          plantCode={plantCode}
          serviceDomain={selectedDomain}
          notify={notify}
          plants={plants.data || []}
          isAdmin={isAdmin}
        />
      )}
    </>
  );

  return (
    <div className="af-shell af-app-shell">
      <aside className={cx("af-app-sidebar", collapsed && "is-collapsed")}>
        <div className="af-app-logo">
          <div className="af-app-mark">A</div>
          {!collapsed && (
            <div className="af-app-logo-copy">
              <strong>AssetFlow</strong>
              <span>Maintenance Workflow</span>
            </div>
          )}
        </div>

        <div className={cx("af-app-identity", collapsed && "is-collapsed")}>
          <div className="af-app-avatar">{String(user?.username || username || "U").trim().charAt(0).toUpperCase() || "U"}</div>
          {!collapsed && (
            <div className="af-app-identity-copy">
              <strong>{user?.username || username || "User"}</strong>
              <span>{roleLabel}</span>
            </div>
          )}
        </div>

        <div className="af-app-divider" />
        <nav className="af-app-nav af-sidebar-scroll" aria-label="AssetFlow sections">
          {navSections.map(([sectionKey, sectionName]) => {
            const sectionItems = visibleTabs.filter(([key]) => navSection(key) === sectionKey);
            if (!sectionItems.length) return null;
            return (
              <div className="af-app-nav-section" key={sectionKey}>
                {!collapsed && <div className="af-app-nav-title">{sectionName}</div>}
                {sectionItems.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    title={collapsed ? tabLabel(key, label) : undefined}
                    className={cx("af-app-nav-item", tab === key && "is-active")}
                    onClick={() => setTab(key)}
                  >
                    <span className="af-app-nav-icon">{navIcon(key)}</span>
                    {!collapsed && <span>{tabLabel(key, label)}</span>}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="af-app-divider" />
        <button type="button" className="af-app-collapse" onClick={() => setCollapsed((value) => !value)}>
          <MenuIcon />{!collapsed && <span>Collapse</span>}
        </button>
      </aside>

      <div className={cx("af-app-main", collapsed && "is-collapsed")}>
        <header className="af-app-header">
          <div className="af-app-header-copy">
            <strong>{headerMeta[0]}</strong>
            <span>{headerMeta[1]}</span>
          </div>

          <div className="af-app-header-actions">
            {crossDomain ? (
              <label className="af-app-select-wrap">
                <span>Department</span>
                <select value={serviceDomain} onChange={(e) => setServiceDomain(e.target.value)} aria-label="Maintenance department filter">
                  <option value="">Overall · Machine + IT</option>
                  <option value="MACHINE">Machine Maintenance</option>
                  <option value="IT">IT Support</option>
                </select>
              </label>
            ) : (
              <span className="af-app-domain-chip">{domainLabel}</span>
            )}

            {((plants.data || []).length > 1 || !plantCode) && (
              <label className="af-app-select-wrap af-app-plant-select">
                <span>Plant</span>
                <select value={plantCode} onChange={(e) => setPlantCode(e.target.value)} aria-label="Plant filter">
                  {(plants.data || []).length > 1 && <option value="">All authorised plants</option>}
                  {(plants.data || []).map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
              </label>
            )}

            <button type="button" className="af-app-header-btn af-app-header-request" onClick={() => navigate("/modules?module=assetflow-request")}>
              <AddAlertOutlinedIcon /><span>Raise Request</span>
            </button>
            <button type="button" className="af-app-header-btn af-app-header-icon" onClick={toggleMode} title={isDark ? "Light mode" : "Dark mode"} aria-label={isDark ? "Light mode" : "Dark mode"}>
              {isDark ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
            </button>
            <button type="button" className="af-app-header-btn af-app-header-icon" onClick={() => navigate("/modules")} title="Modules" aria-label="Modules">
              <AppsIcon />
            </button>
            <button type="button" className="af-app-header-btn af-app-header-icon" onClick={handleLogout} title="Logout" aria-label="Logout">
              <LogoutIcon />
            </button>
          </div>
        </header>

        <main className="af-app-content">{renderContent()}</main>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default function AssetFlowWorkspace() {
  return (
    <AssetFlowThemeProvider>
      <AssetFlowWorkspaceContent />
    </AssetFlowThemeProvider>
  );
}

function QrComplaintPortal({ token, username, onOpenAssetFlow }) {
  const equipment = useAsync(() => assetFlowApi.qrEquipment(token), [token]);
  const [submitted, setSubmitted] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    operatorName: "",
    operatorContact: "",
    priority: "NORMAL",
    scheduledAt: dateTimeInput(new Date()),
    productionStopped: false,
    safetyRisk: false,
    breakdown: true,
    workType: "CORRECTIVE",
  });

  if (equipment.loading) return <Loading />;
  if (equipment.error) return <ErrorBox error={equipment.error} onRetry={equipment.reload} />;
  const machine = equipment.data || {};

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await assetFlowApi.createQrComplaint(token, form);
      setSubmitted(result);
    } catch (error) {
      setSubmitted({ error: errorText(error) });
    } finally {
      setSaving(false);
    }
  };

  if (submitted && !submitted.error) {
    return (
      <main className="af-qr-page">
        <section className="af-mobile-card af-success-card">
          <div className="af-mobile-icon">✓</div>
          <p className="af-eyebrow">Complaint registered</p>
          <h1>{submitted.workNumber}</h1>
          <p>{submitted.title}</p>
          <div className="af-mobile-status-grid">
            <Detail label="Machine" value={submitted.equipmentName} />
            <Detail label="Status" value={human(submitted.status)} />
            <Detail label="Assigned to" value={submitted.responsible || "Maintenance queue"} />
            <Detail label="Scheduled" value={fmtDate(submitted.scheduledAt, true)} />
          </div>
          <Button variant="primary" onClick={onOpenAssetFlow}>Open AssetFlow</Button>
        </section>
      </main>
    );
  }

  return (
    <main className="af-qr-page">
      <section className="af-mobile-card af-machine-passport">
        <div className="af-mobile-card-head">
          <div>
            <p className="af-eyebrow">Machine QR Passport</p>
            <h1>{machine.name}</h1>
            <p>{machine.assetCode} · {machine.plantCode}{machine.location ? ` · ${machine.location}` : ""}</p>
          </div>
          <StatusBadge status={machine.status} />
        </div>
        <div className="af-mobile-status-grid">
          <Detail label="Work center" value={machine.workCenter || "—"} />
          <Detail label="Category" value={machine.category || "—"} />
          <Detail label="Maintenance team" value={machine.maintenanceTeam || "—"} />
          <Detail label="Head technician" value={machine.headTechnician || "Unassigned"} />
        </div>
        {machine.safetyNotes && <div className="af-safety-callout"><strong>Safety note</strong><span>{machine.safetyNotes}</span></div>}
      </section>

      <section className="af-mobile-card">
        <div className="af-mobile-card-head">
          <div><p className="af-eyebrow">Raise corrective complaint</p><h2>What is wrong?</h2><p>Signed in as {username || "FlowSuite user"}. Your identity is recorded automatically.</p></div>
        </div>
        {submitted?.error && <div className="af-inline-error">{submitted.error}</div>}
        <form onSubmit={submit} className="af-mobile-form">
          <Field label="Problem title"><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Spindle vibration / machine not starting" /></Field>
          <Field label="Problem description"><textarea required rows="5" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What happened, error code, sound, smell, visible issue…" /></Field>
          <Field label="Machine operator (optional)"><input value={form.operatorName} onChange={(e) => setForm({ ...form, operatorName: e.target.value })} placeholder="If you are reporting for another operator" /></Field>
          <Field label="Operator contact (optional)"><input value={form.operatorContact} onChange={(e) => setForm({ ...form, operatorContact: e.target.value })} placeholder="Mobile / extension" /></Field>
          <Field label="Required attendance time"><input required type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></Field>
          <Field label="Priority"><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{PRIORITIES.map((p) => <option value={p} key={p}>{human(p)}</option>)}</select></Field>
          <div className="af-mobile-switches">
            <label><input type="checkbox" checked={form.productionStopped} onChange={(e) => setForm({ ...form, productionStopped: e.target.checked })} /> Production stopped</label>
            <label><input type="checkbox" checked={form.safetyRisk} onChange={(e) => setForm({ ...form, safetyRisk: e.target.checked })} /> Safety risk</label>
          </div>
          <Button variant="primary" disabled={saving}>{saving ? "Submitting…" : "Submit maintenance complaint"}</Button>
        </form>
      </section>
    </main>
  );
}

/* ================================= DASHBOARD ================================= */

function Dashboard({ plantCode, serviceDomain, onNavigate, showDepartmentComparison }) {
  const state = useAsync(() => assetFlowApi.dashboard(plantCode, serviceDomain || undefined), [plantCode, serviceDomain]);
  if (state.loading) return <Loading />;
  if (state.error) return <ErrorBox error={state.error} onRetry={state.reload} />;

  const data = state.data || {};
  const m = data.metrics || {};
  const statusMax = Math.max(1, ...Object.values(data.byStatus || {}).map(Number));

  return (
    <section className="af-page">
      <div className="af-page-head">
        <div>
          <p className="af-eyebrow">{showDepartmentComparison ? "Director command center" : serviceDomain === "IT" ? "IT service command center" : "Machine reliability command center"}</p>
          <h1>{showDepartmentComparison ? "Overall Maintenance Dashboard" : serviceDomain === "IT" ? "IT Support Dashboard" : "Machine Maintenance Dashboard"}</h1>
          <p>{showDepartmentComparison ? "Executive comparison of Machine Maintenance and IT Support without mixing their operational queues." : serviceDomain === "IT" ? "IT requests, asset health, response time, preventive tasks and technician workload for the IT team only." : "Machine breakdowns, downtime, preventive compliance, reliability and technician workload for Machine Maintenance only."}</p>
        </div>
        <Button variant="primary" onClick={() => onNavigate("work")}>Open work board</Button>
      </div>

      <div className="af-kpi-grid">
        <Kpi title="Open work orders" value={fmtNumber(m.open)} detail={`${fmtNumber(m.critical)} critical`} tone="blue" />
        <Kpi title="Overdue" value={fmtNumber(m.overdue)} detail={`${fmtNumber(m.waitingParts)} waiting parts`} tone={m.overdue ? "red" : "green"} />
        <Kpi title="PM compliance · 30d" value={`${fmtNumber(m.pmCompliance30, 1)}%`} detail={`${fmtNumber(m.pmDue7)} due in 7 days`} tone={m.pmCompliance30 >= 90 ? "green" : "amber"} />
        <Kpi title={serviceDomain === "IT" ? "Avg resolution · 90d" : "MTTR · 90d"} value={`${fmtNumber(m.mttrHours90, 1)}h`} detail={`${fmtNumber(m.breakdowns30)} corrective / 30d`} tone="violet" />
        <Kpi title={serviceDomain === "IT" ? "Service interruption · 30d" : "Downtime · 30d"} value={`${fmtNumber(m.downtimeHours30, 1)}h`} detail={`${fmtNumber(m.assetsDown)} assets affected`} tone={m.assetsDown ? "red" : "teal"} />
        <Kpi title={serviceDomain === "IT" ? "IT Asset Master" : serviceDomain === "MACHINE" ? "Machine Master" : "Total assets"} value={fmtNumber(m.equipmentCount)} detail={`${fmtNumber(m.warrantyRisk60)} warranties ≤ 60d`} tone="neutral" />
      </div>

      {showDepartmentComparison && (data.departmentComparison || []).length > 0 && (
        <div className="af-department-comparison">
          {(data.departmentComparison || []).map((row) => (
            <div className="af-department-card" key={row.serviceDomain}>
              <div className="af-panel-head"><div><h2>{row.label}</h2><p>Department-isolated operational summary</p></div><Badge tone={row.serviceDomain === "IT" ? "violet" : "blue"}>{row.open} open</Badge></div>
              <div className="af-department-metrics">
                <span><small>Overdue</small><strong>{fmtNumber(row.overdue)}</strong></span>
                <span><small>Critical</small><strong>{fmtNumber(row.critical)}</strong></span>
                <span><small>Completed · 30d</small><strong>{fmtNumber(row.completed30)}</strong></span>
                <span><small>Avg response</small><strong>{fmtNumber(row.avgResponseMinutes30, 1)} min</strong></span>
                <span><small>Avg resolution</small><strong>{fmtNumber(row.avgResolutionHours30, 1)}h</strong></span>
                <span><small>Assets / affected</small><strong>{fmtNumber(row.assets)} / {fmtNumber(row.assetsDown)}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="af-dashboard-grid">
        <div className="af-panel af-span-2">
          <div className="af-panel-head">
            <div><h2>Work pipeline</h2><p>Active workload by stage</p></div>
          </div>
          <div className="af-status-bars">
            {Object.entries(data.byStatus || {}).filter(([key]) => !["CANCELLED", "SCRAPPED"].includes(key)).map(([key, value]) => (
              <div className="af-status-row" key={key}>
                <span>{human(key)}</span>
                <div><i style={{ width: `${(Number(value) / statusMax) * 100}%` }} /></div>
                <strong>{fmtNumber(value)}</strong>
              </div>
            ))}
          </div>
          <div className="af-section-title"><h3>Open requests by service</h3><span>Unified maintenance intake</span></div>
          <div className="af-chip-row">
            {Object.entries(data.byServiceDomain || {}).filter(([, value]) => Number(value) > 0).map(([domain, value]) => (
              <Badge key={domain} tone={domain === "MACHINE" ? "blue" : domain === "IT" ? "violet" : "teal"}>
                {SERVICE_DOMAIN_LABELS[domain] || human(domain)} · {fmtNumber(value)}
              </Badge>
            ))}
          </div>
        </div>

        <div className="af-panel">
          <div className="af-panel-head"><div><h2>Problem assets</h2><p>Breakdowns in the last 90 days</p></div></div>
          <div className="af-rank-list">
            {(data.topProblemAssets || []).length ? data.topProblemAssets.map((x, i) => (
              <div key={x.name} className="af-rank-row"><span>{i + 1}</span><strong>{x.name}</strong><Badge tone={x.failures >= 3 ? "red" : "amber"}>{x.failures} failures</Badge></div>
            )) : <EmptyState title="No repeat breakdowns" text="No failure pattern is visible in this window." />}
          </div>
        </div>

        <div className="af-panel af-span-3">
          <div className="af-panel-head"><div><h2>Priority queue</h2><p>Critical and high-priority work first</p></div><Button onClick={() => onNavigate("work")}>View all</Button></div>
          <div className="af-table-wrap">
            <table className="af-table">
              <thead><tr><th>Work order</th><th>Equipment</th><th>Plant</th><th>Responsible</th><th>Schedule</th><th>Priority</th><th>Status</th></tr></thead>
              <tbody>
                {(data.priorityQueue || []).map((w) => (
                  <tr key={w.id}>
                    <td><strong>{w.workNumber}</strong><small>{w.title}</small></td>
                    <td><strong>{SERVICE_DOMAIN_LABELS[w.serviceDomain] || human(w.serviceDomain)}</strong><small>{w.equipmentName || w.requestCategory || "General request"}</small></td>
                    <td>{w.plantCode}</td>
                    <td>{w.responsible || "Unassigned"}</td>
                    <td className={cx(w.overdue && "af-danger-text")}>{fmtDate(w.scheduledAt, true)}</td>
                    <td><PriorityBadge value={w.priority} /></td>
                    <td><StatusBadge status={w.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function Kpi({ title, value, detail, tone }) {
  return (
    <div className={cx("af-kpi", `tone-${tone}`)}>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

/* ================================= WORK ORDERS ================================= */

function WorkOrders({ plantCode, serviceDomain, notify, plants, canCoordinate, canManageMasters, canExecute, readOnly, username }) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState("kanban");
  const [priority, setPriority] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const debouncedSearch = useDebouncedValue(search);
  const state = useAsync(
    () => assetFlowApi.workOrders({
      plantCode,
      serviceDomain: serviceDomain || undefined,
      search: debouncedSearch,
      priority,
      type,
      status,
      // The current backend board contract is capped at 1,000 records. True
      // cursor/server pagination will be completed in the backend phase so
      // Kanban counts are not made inaccurate by a frontend-only truncation.
      size: 1000,
    }),
    [plantCode, serviceDomain, debouncedSearch, priority, type, status]
  );

  const needsReferenceData = createOpen || Boolean(selectedId);
  const equipment = useAsync(
    () => needsReferenceData
      ? assetFlowApi.equipment({ plantCode, serviceDomain: serviceDomain || undefined })
      : Promise.resolve({ items: [] }),
    [needsReferenceData, plantCode, serviceDomain]
  );
  const teams = useAsync(
    () => needsReferenceData
      ? assetFlowApi.teams(plantCode, serviceDomain || undefined)
      : Promise.resolve([]),
    [needsReferenceData, plantCode, serviceDomain]
  );
  const users = useAsync(
    () => needsReferenceData
      ? assetFlowApi.users(plantCode, serviceDomain || undefined)
      : Promise.resolve([]),
    [needsReferenceData, plantCode, serviceDomain]
  );

  const items = state.data?.items || [];
  const byStatus = useMemo(() => {
    const grouped = Object.fromEntries(KANBAN.map(([key]) => [key, []]));
    items.forEach((w) => {
      if (!grouped[w.status]) grouped[w.status] = [];
      grouped[w.status].push(w);
    });
    return grouped;
  }, [items]);

  const saveWork = async (payload) => {
    try {
      const created = await assetFlowApi.createWorkOrder(payload);
      notify(created?.responsible ? `Request ${created.workNumber} routed to ${created.responsible}` : `Request ${created.workNumber} created in maintenance queue`);
      setCreateOpen(false);
      state.reload();
    } catch (error) {
      notify(errorText(error), "error");
    }
  };

  if (state.error) return <ErrorBox error={state.error} onRetry={state.reload} />;

  const pageTitle = readOnly
    ? "Overall Maintenance Work Orders"
    : canExecute && !canCoordinate
      ? `${SERVICE_DOMAIN_LABELS[serviceDomain] || "Maintenance"} Technician Queue`
      : `${SERVICE_DOMAIN_LABELS[serviceDomain] || "Maintenance & IT"} Work Orders`;
  const pageText = readOnly
    ? "Read-only cross-department operational view for management oversight."
    : canExecute && !canCoordinate
      ? "Jobs assigned to you. Accept, start, hold for parts and record the completed repair from desktop or mobile."
      : "Department-scoped intake, routing, delegation, execution and verified closure.";

  return (
    <section className="af-page">
      <div className="af-page-head compact">
        <div><p className="af-eyebrow">Real-time maintenance execution</p><h1>{pageTitle}</h1><p>{pageText}</p></div>
        {!readOnly && <Button variant="primary" onClick={() => setCreateOpen(true)}>+ New work order</Button>}
      </div>

      <div className="af-toolbar">
        <div className="af-search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search request, asset, IT issue, requester or technician…" /></div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All stages</option>{[...KANBAN.map(([x]) => x), "CLOSED", "SCRAPPED", "CANCELLED"].map((x) => <option key={x} value={x}>{human(x)}</option>)}</select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)}><option value="">All priorities</option>{PRIORITIES.map((x) => <option key={x} value={x}>{human(x)}</option>)}</select>
        <select value={type} onChange={(e) => setType(e.target.value)}><option value="">All work types</option>{WORK_TYPES.map((x) => <option key={x} value={x}>{human(x)}</option>)}</select>
        <div className="af-segment"><button className={cx(view === "kanban" && "is-active")} onClick={() => setView("kanban")}>Board</button><button className={cx(view === "list" && "is-active")} onClick={() => setView("list")}>List</button></div>
      </div>

      {state.loading ? <Loading /> : view === "kanban" ? (
        <div className="af-kanban af-kanban-realflow">
          {KANBAN.map(([key, label]) => (
            <div className="af-kanban-col" key={key}>
              <div className="af-kanban-head"><div><strong>{label}</strong><span>{byStatus[key]?.length || 0}</span></div><i /></div>
              <div className="af-kanban-cards">
                {(byStatus[key] || []).map((w) => <WorkCard key={w.id} w={w} onOpen={() => setSelectedId(w.id)} />)}
                {!byStatus[key]?.length && <div className="af-kanban-empty">No requests</div>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="af-panel af-table-wrap">
          <table className="af-table">
            <thead><tr><th>Work order</th><th>Service / Asset</th><th>Source</th><th>Requested by</th><th>Responsible</th><th>Scheduled</th><th>Response</th><th>Priority</th><th>Status</th><th /></tr></thead>
            <tbody>{items.map((w) => <tr key={w.id}><td><strong>{w.workNumber}</strong><small>{w.title}</small></td><td><strong>{SERVICE_DOMAIN_LABELS[w.serviceDomain] || human(w.serviceDomain)}</strong><small>{w.equipmentName || w.requestCategory || "General request"} · {w.plantCode}{w.workCenter ? ` · ${w.workCenter}` : ""}</small></td><td>{human(w.complaintSource || "WEB")}</td><td>{w.requestedBy || "—"}<small>{w.reporterCode || w.reporterDepartment || ""}</small></td><td>{w.responsible || "Unassigned"}</td><td className={cx(w.overdue && "af-danger-text")}>{fmtDate(w.scheduledAt, true)}</td><td>{w.responseMinutes != null ? `${w.responseMinutes} min` : "—"}</td><td><PriorityBadge value={w.priority} /></td><td><StatusBadge status={w.status} /></td><td><Button onClick={() => setSelectedId(w.id)}>Open</Button></td></tr>)}</tbody>
          </table>
        </div>
      )}

      {createOpen && <WorkOrderForm onClose={() => setCreateOpen(false)} onSave={saveWork} equipment={equipment.data?.items || []} teams={teams.data || []} users={users.data || []} plants={plants} canCoordinate={canCoordinate} defaultPlant={plantCode} defaultDomain={serviceDomain} />}
      {selectedId && <WorkOrderDrawer id={selectedId} onClose={() => setSelectedId(null)} onChanged={() => state.reload()} notify={notify} canExecute={canExecute && !readOnly} canCoordinate={canCoordinate && !readOnly} canManageMasters={canManageMasters && !readOnly} equipment={equipment.data?.items || []} teams={teams.data || []} users={users.data || []} plants={plants} defaultPlant={plantCode} username={username} />}
    </section>
  );
}

function WorkCard({ w, onOpen }) {
  return (
    <article className={cx("af-work-card", w.overdue && "is-overdue", w.safetyRisk && "is-risk")} onClick={onOpen}>
      <div className="af-work-card-top"><span>{w.workNumber}</span><PriorityBadge value={w.priority} /></div>
      <h3>{w.title}</h3>
      <p>{w.equipmentName || SERVICE_DOMAIN_LABELS[w.serviceDomain] || "General maintenance"}</p>
      <div className="af-work-meta"><span>{w.plantCode}{w.workCenter ? ` · ${w.workCenter}` : ""}</span><span>{w.responsible || "Maintenance queue"}</span></div>
      <div className="af-work-foot"><span className={cx(w.overdue && "af-danger-text")}>{fmtDate(w.scheduledAt, true)}</span><span>{w.productionStopped ? "Production stopped" : human(w.complaintSource || w.workType)}</span></div>
    </article>
  );
}

function WorkOrderForm({ onClose, onSave, equipment, teams, users, plants, canCoordinate, defaultPlant, defaultDomain = "", initial }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_WORK,
    serviceDomain: defaultDomain || "MACHINE",
    plantCode: defaultPlant || "",
    requestedForAt: dateTimeInput(initial?.requestedForAt || initial?.scheduledAt || new Date()),
    scheduledAt: dateTimeInput(initial?.scheduledAt || initial?.requestedForAt || new Date()),
    ...(initial || {}),
    requestedForAt: dateTimeInput(initial?.requestedForAt || initial?.scheduledAt || new Date()),
    scheduledAt: dateTimeInput(initial?.scheduledAt || initial?.requestedForAt || new Date()),
  }));
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const selectedAsset = equipment.find((item) => item.id === form.equipmentId);
  const domain = selectedAsset?.serviceDomain || form.serviceDomain || defaultDomain || "MACHINE";
  const activeTeams = teams.filter((team) =>
    team.active &&
    (!form.plantCode || !team.plantCode || team.plantCode === form.plantCode) &&
    (!team.serviceDomain || team.serviceDomain === domain)
  );
  const domainAssignableRoles = domain === "IT"
    ? ["ADMIN", "ASSETFLOW_IT_HEAD", "ASSETFLOW_IT_TECHNICIAN", "ASSETFLOW_MANAGER", "ASSETFLOW_PLANNER"]
    : ["ADMIN", "ASSETFLOW_MACHINE_HEAD", "ASSETFLOW_MACHINE_TECHNICIAN", "ASSETFLOW_HEAD_TECHNICIAN", "ASSETFLOW_TECHNICIAN", "ASSETFLOW_MANAGER", "ASSETFLOW_PLANNER"];
  const assignableUsers = users.filter((user) =>
    (user.roles || []).some((role) => domainAssignableRoles.includes(String(role).replace(/^ROLE_/i, "").toUpperCase()))
  );

  const submit = async (event) => {
    event.preventDefault();
    if (!form.equipmentId && !form.plantCode) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        equipmentId: form.equipmentId || null,
        serviceDomain: domain,
        requestCategory: form.requestCategory || null,
        workType: form.workType,
        requestedForAt: form.requestedForAt || null,
        scheduledAt: canCoordinate ? form.scheduledAt || form.requestedForAt || null : form.requestedForAt || null,
        estimatedMinutes: canCoordinate && form.estimatedMinutes !== "" ? Number(form.estimatedMinutes) : null,
        teamName: canCoordinate ? form.teamName || null : null,
        responsible: canCoordinate ? form.responsible || null : null,
        downtimeMinutes: null,
        rootCause: null,
        actionTaken: null,
        partsUsed: null,
        partsCost: null,
        laborCost: null,
        externalCost: null,
        verificationNote: null,
        version: initial?.version ?? null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={initial ? "Edit maintenance / service planning" : "Raise maintenance / service request"}
      subtitle={initial
        ? "Update routing, service domain, schedule and ownership without altering execution history."
        : "Use an asset when the request belongs to a machine/device, or raise a general Machine Maintenance or IT request without creating a fake equipment record."}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit}>
        <div className="af-modal-body af-form-grid">
          <Field label="Asset / equipment" hint="Optional for general non-asset-specific Machine Maintenance or IT requests.">
            <select value={form.equipmentId} onChange={(e) => {
              const item = equipment.find((x) => x.id === e.target.value);
              setForm((f) => ({
                ...f,
                equipmentId: e.target.value,
                serviceDomain: item?.serviceDomain || f.serviceDomain,
                plantCode: item?.plantCode || f.plantCode,
                location: item?.location || f.location,
                teamName: item?.maintenanceTeam || "",
                responsible: "",
              }));
            }}>
              <option value="">General request / no specific asset</option>
              {equipment.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.assetCode} · {item.name} · {item.plantCode} · {SERVICE_DOMAIN_LABELS[item.serviceDomain] || human(item.serviceDomain)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Service domain">
            <select
              value={domain}
              disabled={Boolean(selectedAsset) || Boolean(defaultDomain)}
              onChange={(e) => setForm((f) => ({ ...f, serviceDomain: e.target.value, teamName: "", responsible: "" }))}
            >
              {SERVICE_DOMAINS.map((value) => <option key={value} value={value}>{SERVICE_DOMAIN_LABELS[value]}</option>)}
            </select>
          </Field>

          <Field label="Issue / request title"><input required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. LAN down / CNC spindle alarm / AC not cooling" /></Field>
          <Field label="Request category"><input value={form.requestCategory} onChange={(e) => set("requestCategory", e.target.value)} placeholder="Breakdown / Internet / Light / AC / Wiring…" /></Field>

          <Field label="Work type"><select value={form.workType} onChange={(e) => setForm((f) => ({ ...f, workType: e.target.value, breakdown: e.target.value === "CORRECTIVE" }))}>{WORK_TYPES.map((x) => <option key={x} value={x}>{human(x)}</option>)}</select></Field>
          <Field label="Priority"><select value={form.priority} onChange={(e) => set("priority", e.target.value)}>{PRIORITIES.map((x) => <option key={x} value={x}>{human(x)}</option>)}</select></Field>

          <Field label="Plant / site">
            {selectedAsset ? (
              <input value={form.plantCode} readOnly />
            ) : (
              <select required value={form.plantCode} onChange={(e) => setForm((f) => ({ ...f, plantCode: e.target.value, teamName: "", responsible: "" }))}>
                <option value="">Select plant</option>
                {plants.map((plant) => <option key={plant.name} value={plant.name}>{plant.name}</option>)}
              </select>
            )}
          </Field>
          <Field label="Exact location"><input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Machine bay, department, cabin, workstation…" /></Field>

          <Field label="Requested / preferred attendance"><input required type="datetime-local" value={form.requestedForAt} onChange={(e) => set("requestedForAt", e.target.value)} /></Field>
          {canCoordinate && <Field label="Maintenance scheduled time"><input type="datetime-local" value={form.scheduledAt} onChange={(e) => set("scheduledAt", e.target.value)} /></Field>}

          <Field label="Person / operator at location (optional)"><input value={form.operatorName} onChange={(e) => set("operatorName", e.target.value)} placeholder="If raised for another person or machine operator" /></Field>
          <Field label="Contact / extension (optional)"><input value={form.operatorContact} onChange={(e) => set("operatorContact", e.target.value)} /></Field>

          {canCoordinate && <Field label="Service team override"><select value={form.teamName} onChange={(e) => set("teamName", e.target.value)}><option value="">Use automatic {SERVICE_DOMAIN_LABELS[domain]} route</option>{activeTeams.map((t) => <option key={t.id} value={t.name}>{t.name}{t.defaultForPlant ? " · Default" : ""}</option>)}</select></Field>}
          {canCoordinate && <Field label="Responsible technician"><select value={form.responsible} onChange={(e) => set("responsible", e.target.value)}><option value="">Use team head / automatic route</option>{assignableUsers.map((u) => <option key={u.username} value={u.username}>{u.displayName || u.username}</option>)}</select></Field>}
          {canCoordinate && <Field label="Estimated minutes"><input type="number" min="0" value={form.estimatedMinutes} onChange={(e) => set("estimatedMinutes", e.target.value)} /></Field>}

          <Field label="Problem / request description"><textarea required rows="5" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Symptoms, error, affected area, network point, light/socket, machine condition or any useful observation…" /></Field>
          <Field label="Instructions / safety note"><textarea rows="5" value={form.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder="Known hazard, access restriction, LOTO need or useful service instruction…" /></Field>

          <div className="af-checks af-full">
            <label><input type="checkbox" checked={form.breakdown} onChange={(e) => set("breakdown", e.target.checked)} /> Breakdown / failure</label>
            <label><input type="checkbox" checked={form.productionStopped} onChange={(e) => set("productionStopped", e.target.checked)} /> Work / production stopped</label>
            <label><input type="checkbox" checked={form.safetyRisk} onChange={(e) => set("safetyRisk", e.target.checked)} /> Safety risk</label>
          </div>
        </div>
        <div className="af-modal-actions"><Button type="button" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={saving}>{saving ? "Saving…" : initial ? "Save planning" : "Submit request"}</Button></div>
      </form>
    </Modal>
  );
}

function WorkOrderDrawer({ id, onClose, onChanged, notify, canExecute, canCoordinate, canManageMasters, equipment, teams, users, plants, defaultPlant }) {
  const state = useAsync(() => assetFlowApi.workOrder(id), [id]);
  const [actionOpen, setActionOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  if (state.loading) return <div className="af-drawer"><Loading /></div>;
  if (state.error) return <div className="af-drawer"><ErrorBox error={state.error} onRetry={state.reload} /></div>;
  const w = state.data;

  const move = async (target, details = {}) => {
    try {
      await assetFlowApi.changeStatus(id, { status: target, note: details.note || `Status moved to ${human(target)}`, version: w.version, ...details });
      notify(`Work order moved to ${human(target)}`);
      await state.reload();
      onChanged();
      setActionOpen(false);
    } catch (error) {
      notify(errorText(error), "error");
    }
  };

  const saveEdit = async (payload) => {
    try {
      await assetFlowApi.updateWorkOrder(id, { ...payload, version: w.version });
      notify("Maintenance planning updated");
      setEditOpen(false);
      await state.reload();
      onChanged();
    } catch (error) {
      notify(errorText(error), "error");
    }
  };

  const assign = async (payload) => {
    try {
      await assetFlowApi.assignWorkOrder(id, payload);
      notify(`Assigned to ${payload.responsible}`);
      setAssignOpen(false);
      await state.reload();
      onChanged();
    } catch (error) {
      notify(errorText(error), "error");
    }
  };

  return (
    <div className="af-drawer-backdrop" onMouseDown={onClose}>
      <aside className="af-drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="af-drawer-head"><div><span>{w.workNumber}</span><h2>{w.title}</h2></div><button className="af-icon-btn" onClick={onClose}>×</button></div>
        <div className="af-drawer-status"><StatusBadge status={w.status} /><PriorityBadge value={w.priority} /><Badge tone="neutral">{human(w.complaintSource || "WEB")}</Badge>{w.overdue && <Badge tone="red">Overdue</Badge>}{w.productionStopped && <Badge tone="red">Production stopped</Badge>}{w.safetyRisk && <Badge tone="red">Safety risk</Badge>}</div>
        <div className="af-stage-strip af-stage-strip-real">{KANBAN.map(([key, label]) => <div key={key} className={cx(key === w.status && "is-current")}>{label}</div>)}</div>
        <div className="af-drawer-body">
          <div className="af-detail-grid">
            <Detail label="Service domain" value={SERVICE_DOMAIN_LABELS[w.serviceDomain] || human(w.serviceDomain)} />
            <Detail label="Request category" value={w.requestCategory || "—"} />
            <Detail label="Asset / equipment" value={w.equipmentName || "General / no fixed asset"} />
            <Detail label="Plant / Location" value={[w.plantCode, w.location].filter(Boolean).join(" · ")} />
            <Detail label="Work center" value={w.workCenter || "—"} />
            <Detail label="Requested by" value={w.requestedBy} />
            <Detail label="Reporter Code" value={w.reporterCode || "FlowSuite user"} />
            <Detail label="Reporter department/contact" value={[w.reporterDepartment, w.reporterContact].filter(Boolean).join(" · ") || "—"} />
            <Detail label="Machine operator" value={w.operatorName || "Same as requester / not specified"} />
            <Detail label="Operator contact" value={w.operatorContact || "—"} />
            <Detail label="Team" value={w.teamName || "Plant maintenance queue"} />
            <Detail label="Responsible" value={w.responsible || "Unassigned"} />
            <Detail label="Assigned" value={fmtDate(w.assignedAt, true)} />
            <Detail label="Accepted by" value={w.acceptedBy || "—"} />
            <Detail label="Accepted" value={fmtDate(w.acceptedAt, true)} />
            <Detail label="Response time" value={w.responseMinutes != null ? `${w.responseMinutes} min` : "—"} />
            <Detail label="Requested / preferred" value={fmtDate(w.requestedForAt, true)} />
            <Detail label="Scheduled" value={fmtDate(w.scheduledAt, true)} danger={w.overdue} />
            <Detail label="Started" value={fmtDate(w.startedAt, true)} />
            <Detail label="Attendance after accept" value={w.attendanceMinutes != null ? `${w.attendanceMinutes} min` : "—"} />
            <Detail label="Repaired" value={fmtDate(w.repairedAt, true)} />
            <Detail label="Repair duration" value={w.actualMinutes != null ? `${fmtNumber(w.actualMinutes)} min` : "—"} />
            <Detail label="Downtime" value={w.downtimeMinutes != null ? `${fmtNumber(w.downtimeMinutes)} min` : "—"} />
          </div>

          <DetailBlock title="Problem" text={w.description} />
          <DetailBlock title="Instructions / safety" text={w.instructions} />
          <DetailBlock title="Root cause" text={w.rootCause} />
          <DetailBlock title="Action taken" text={w.actionTaken} />
          <DetailBlock title="Parts used" text={w.partsUsed} />
          <DetailBlock title="Verification / handover" text={w.verificationNote} />

          <div className="af-cost-row"><span>Parts <strong>{fmtMoney(w.partsCost)}</strong></span><span>Labour <strong>{fmtMoney(w.laborCost)}</strong></span><span>External <strong>{fmtMoney(w.externalCost)}</strong></span><span>Total <strong>{fmtMoney(w.totalCost)}</strong></span></div>

          <div className="af-section-title"><h3>Activity timeline</h3><span>{w.audit?.length || 0} events</span></div>
          <div className="af-timeline">
            {(w.audit || []).map((a) => <div key={a.id} className="af-timeline-item"><i /><div><strong>{human(a.action)}</strong><span>{a.actor || "System"} · {fmtDate(a.createdAt, true)}</span>{a.fromStatus && a.toStatus && <p>{human(a.fromStatus)} → {human(a.toStatus)}</p>}{a.note && <p>{a.note}</p>}</div></div>)}
          </div>
        </div>
        <div className="af-drawer-actions">
          {canCoordinate && <Button onClick={() => setAssignOpen(true)}>Assign / Delegate</Button>}
          {canManageMasters && <Button onClick={() => setEditOpen(true)}>Edit Planning</Button>}
          {(w.allowedTransitions || []).map((target) => {
            const completion = target === "REPAIRED" || target === "CLOSED" || target === "WAITING_PARTS" || target === "CANCELLED" || target === "SCRAPPED";
            const primary = target === "ACCEPTED" || target === "IN_PROGRESS" || target === "REPAIRED" || target === "CLOSED";
            return <Button key={target} variant={primary ? "primary" : "default"} onClick={() => completion ? setActionOpen(target) : move(target)}>{target === "ACCEPTED" ? "Accept Job" : target === "IN_PROGRESS" ? "Start Work" : human(target)}</Button>;
          })}
        </div>
        {canManageMasters && editOpen && <WorkOrderForm initial={w} onClose={() => setEditOpen(false)} onSave={saveEdit} equipment={equipment} teams={teams} users={users} plants={plants} canCoordinate={true} defaultPlant={defaultPlant} defaultDomain={w.serviceDomain || ""} />}
        {canCoordinate && assignOpen && <AssignmentModal w={w} teams={teams} users={users} onClose={() => setAssignOpen(false)} onSubmit={assign} />}
        {actionOpen && <StatusCompletionModal status={actionOpen} w={w} onClose={() => setActionOpen(false)} onSubmit={(details) => move(actionOpen, details)} />}
      </aside>
    </div>
  );
}

function StatusCompletionModal({ status, w, onClose, onSubmit }) {
  const [form, setForm] = useState({
    note: "",
    actualMinutes: w.actualMinutes ?? "",
    downtimeMinutes: w.downtimeMinutes ?? "",
    rootCause: w.rootCause || "",
    actionTaken: w.actionTaken || "",
    partsUsed: w.partsUsed || "",
    partsCost: w.partsCost ?? "",
    laborCost: w.laborCost ?? "",
    externalCost: w.externalCost ?? "",
    verificationNote: w.verificationNote || "",
  });
  const numericOrNull = (value) => value === "" || value == null ? null : Number(value);
  const isRepair = status === "REPAIRED";
  const isClose = status === "CLOSED";
  const needsReason = ["WAITING_PARTS", "CANCELLED", "SCRAPPED"].includes(status);
  const title = isRepair ? "Record repair completion" : isClose ? "Verify & close work" : status === "WAITING_PARTS" ? "Put job on hold for parts" : `${human(status)} request`;
  const subtitle = isRepair
    ? "Capture diagnosis, work done, parts, cost and downtime. This drives MTTR and reliability analysis."
    : isClose
      ? "Head technician / maintenance management verifies test run and handover before closure."
      : "Record a clear reason so the maintenance timeline remains auditable.";

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose} wide={isRepair}>
      <form onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          ...form,
          actualMinutes: numericOrNull(form.actualMinutes),
          downtimeMinutes: numericOrNull(form.downtimeMinutes),
          partsCost: numericOrNull(form.partsCost),
          laborCost: numericOrNull(form.laborCost),
          externalCost: numericOrNull(form.externalCost),
        });
      }}>
        <div className="af-modal-body af-form-grid">
          {isRepair && <>
            <Field label="Actual repair minutes"><input type="number" min="0" value={form.actualMinutes} onChange={(e) => setForm({ ...form, actualMinutes: e.target.value })} /></Field>
            <Field label="Downtime minutes"><input type="number" min="0" value={form.downtimeMinutes} onChange={(e) => setForm({ ...form, downtimeMinutes: e.target.value })} /></Field>
            <Field label="Root cause / best-known cause"><textarea required={w.workType === "CORRECTIVE" || w.breakdown} rows="3" value={form.rootCause} onChange={(e) => setForm({ ...form, rootCause: e.target.value })} placeholder="Electrical failure, bearing seizure, loose terminal, operator misuse…" /></Field>
            <Field label="Work done / action taken"><textarea required rows="3" value={form.actionTaken} onChange={(e) => setForm({ ...form, actionTaken: e.target.value })} placeholder="Diagnosis, repair, replacement, adjustment and test performed" /></Field>
            <Field label="Parts / consumables used"><textarea rows="3" value={form.partsUsed} onChange={(e) => setForm({ ...form, partsUsed: e.target.value })} placeholder="Bearing 6205 × 2, V-belt B52 × 1…" /></Field>
            <Field label="Parts cost"><input type="number" min="0" step="0.01" value={form.partsCost} onChange={(e) => setForm({ ...form, partsCost: e.target.value })} /></Field>
            <Field label="Labour cost"><input type="number" min="0" step="0.01" value={form.laborCost} onChange={(e) => setForm({ ...form, laborCost: e.target.value })} /></Field>
            <Field label="External / vendor cost"><input type="number" min="0" step="0.01" value={form.externalCost} onChange={(e) => setForm({ ...form, externalCost: e.target.value })} /></Field>
          </>}
          {isClose && <Field label="Machine test / handover verification"><textarea required rows="4" value={form.verificationNote} onChange={(e) => setForm({ ...form, verificationNote: e.target.value })} placeholder="Test run completed, output verified, guards restored and machine handed back to production…" /></Field>}
          {needsReason && <Field label={status === "WAITING_PARTS" ? "Required part / hold reason" : "Reason"}><textarea required rows="4" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={status === "WAITING_PARTS" ? "Part name, quantity, expected source / ETA…" : "Enter clear reason"} /></Field>}
        </div>
        <div className="af-modal-actions"><Button type="button" onClick={onClose}>Cancel</Button><Button variant="primary">Confirm {human(status)}</Button></div>
      </form>
    </Modal>
  );
}

function Detail({ label, value, danger }) {
  return <div className="af-detail"><span>{label}</span><strong className={cx(danger && "af-danger-text")}>{value || "—"}</strong></div>;
}

function DetailBlock({ title, text }) {
  if (!text) return null;
  return <div className="af-detail-block"><span>{title}</span><p>{text}</p></div>;
}

/* ================================= CALENDAR ================================= */

function MaintenanceCalendar({ plantCode, serviceDomain }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const from = dateInput(weekStart);
  const to = dateInput(addDays(weekStart, 6));
  const state = useAsync(() => assetFlowApi.calendar({ plantCode, serviceDomain: serviceDomain || undefined, from, to }), [plantCode, serviceDomain, from, to]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const grouped = useMemo(() => {
    const g = {};
    (state.data || []).forEach((e) => { (g[String(e.date)] ||= []).push(e); });
    return g;
  }, [state.data]);

  return (
    <section className="af-page">
      <div className="af-page-head compact"><div><p className="af-eyebrow">Preventive planning & workload</p><h1>Maintenance Calendar</h1><p>Weekly schedule with planned jobs and upcoming PM due dates.</p></div><div className="af-inline-actions"><Button onClick={() => setWeekStart(startOfWeek(new Date()))}>Today</Button><Button onClick={() => setWeekStart(addDays(weekStart, -7))}>←</Button><Button onClick={() => setWeekStart(addDays(weekStart, 7))}>→</Button></div></div>
      {state.error ? <ErrorBox error={state.error} onRetry={state.reload} /> : state.loading ? <Loading /> : (
        <div className="af-calendar">
          {days.map((day) => {
            const key = dateInput(day);
            const events = grouped[key] || [];
            return <div className={cx("af-day", key === dateInput(new Date()) && "is-today")} key={key}><div className="af-day-head"><span>{day.toLocaleDateString("en-IN", { weekday: "short" })}</span><strong>{day.getDate()}</strong></div><div className="af-day-events">{events.map((e) => <div key={`${e.kind}-${e.id}`} className={cx("af-event", e.kind === "PM_DUE" && "is-pm", e.priority === "CRITICAL" && "is-critical")}><span>{e.kind === "PM_DUE" ? "PM due" : e.number}</span><strong>{e.title}</strong><small>{e.equipment || ""}</small><small>{e.responsible || "Unassigned"}</small>{e.start && <small>{fmtDate(e.start, true)}</small>}</div>)}{!events.length && <div className="af-day-empty">No scheduled work</div>}</div></div>;
          })}
        </div>
      )}
    </section>
  );
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }

/* ================================= EQUIPMENT ================================= */

function Equipment({ plantCode, serviceDomain, notify, plants, canManageMasters, canEditAssets, readOnly }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editAsset, setEditAsset] = useState(null);
  const [editLoadingId, setEditLoadingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const debouncedSearch = useDebouncedValue(search);
  const state = useAsync(
    () => assetFlowApi.equipment({
      plantCode,
      serviceDomain: serviceDomain || undefined,
      status,
      search: debouncedSearch,
    }),
    [plantCode, serviceDomain, status, debouncedSearch]
  );

  const needsEditorReferences = createOpen || Boolean(editAsset);
  const teams = useAsync(
    () => needsEditorReferences
      ? assetFlowApi.teams(plantCode, serviceDomain || undefined)
      : Promise.resolve([]),
    [needsEditorReferences, plantCode, serviceDomain]
  );
  const users = useAsync(
    () => needsEditorReferences
      ? assetFlowApi.users(plantCode, serviceDomain || undefined)
      : Promise.resolve([]),
    [needsEditorReferences, plantCode, serviceDomain]
  );

  const saveCreate = async (payload) => {
    try {
      await assetFlowApi.createEquipment(payload);
      notify("Asset added to AssetFlow and its controlled QR request link is ready");
      setCreateOpen(false);
      await state.reload();
    } catch (error) {
      notify(errorText(error), "error");
    }
  };

  const openEdit = async (id) => {
    if (!canEditAssets || readOnly || !id) return;
    setEditLoadingId(id);
    try {
      const detail = await assetFlowApi.equipmentOne(id);
      setSelectedId(null);
      setEditAsset(detail);
    } catch (error) {
      notify(errorText(error), "error");
    } finally {
      setEditLoadingId(null);
    }
  };

  const saveUpdate = async (payload) => {
    if (!editAsset?.id) return;
    try {
      const updated = await assetFlowApi.updateEquipment(editAsset.id, {
        ...payload,
        version: editAsset.version,
      });
      notify(`${updated?.assetCode || editAsset.assetCode || "Asset"} updated successfully`);
      setEditAsset(null);
      await state.reload();
    } catch (error) {
      notify(errorText(error), "error");
    }
  };

  return (
    <section className="af-page">
      <div className="af-page-head compact">
        <div>
          <p className="af-eyebrow">Asset reliability register</p>
          <h1>{serviceDomain === "IT" ? "IT Asset Master" : serviceDomain === "MACHINE" ? "Machine Master" : "Machine & IT Asset Masters"}</h1>
          <p>{serviceDomain === "IT" ? "IT devices with assignment, network identity, QR reporting and support history." : serviceDomain === "MACHINE" ? "Production machines plus electrical, lighting, AC/HVAC, facility and utility assets under Machine Maintenance." : "Director/admin view of both isolated asset registers."}</p>
        </div>
        {canManageMasters && !readOnly && <Button variant="primary" onClick={() => setCreateOpen(true)}>+ Add asset</Button>}
      </div>

      <div className="af-toolbar">
        <div className="af-search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search asset code, machine/device, work center, model, serial or category…" /></div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All equipment states</option>{EQUIPMENT_STATUSES.map((x) => <option key={x} value={x}>{human(x)}</option>)}</select>
      </div>

      {state.error ? <ErrorBox error={state.error} onRetry={state.reload} /> : state.loading ? <Loading /> : (
        <div className="af-equipment-grid">
          {(state.data?.items || []).map((e) => (
            <article className={cx("af-equipment-card", e.status === "DOWN" && "is-down")} key={e.id} onClick={() => setSelectedId(e.id)}>
              <div className="af-equipment-top">
                <span>{e.assetCode}</span>
                <div className="af-inline-actions">
                  <span className="af-service-domain-tag">{SERVICE_DOMAIN_LABELS[e.serviceDomain] || human(e.serviceDomain)}</span>
                  <StatusBadge status={e.status} />
                  {canEditAssets && !readOnly && (
                    <Button
                      className="af-asset-card-edit"
                      type="button"
                      disabled={editLoadingId === e.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        openEdit(e.id);
                      }}
                    >
                      {editLoadingId === e.id ? "Loading…" : "Edit"}
                    </Button>
                  )}
                </div>
              </div>
              <h3>{e.name}</h3>
              <p>{[human(e.assetKind), e.category, e.manufacturer, e.model].filter(Boolean).join(" · ") || "Uncategorized asset"}</p>
              <div className="af-equipment-meta">
                <span><small>Plant</small><strong>{e.plantCode}</strong></span>
                <span><small>{e.serviceDomain === "IT" ? "Assigned to" : "Work center"}</small><strong>{e.serviceDomain === "IT" ? (e.assignedToName || e.assignedDepartment || e.location || "—") : (e.workCenter || e.location || "—")}</strong></span>
                <span><small>Criticality</small><strong>{human(e.criticality)}</strong></span>
              </div>
              <div className="af-equipment-foot">
                <span>{e.openWorkOrders ? `${e.openWorkOrders} open work orders` : "No open work"}</span>
                <span>{e.qrEnabled ? "QR reporting active" : "QR disabled"}</span>
              </div>
            </article>
          ))}
          {!state.data?.items?.length && <EmptyState title="No equipment found" text="Add the first machine or change the current filters." />}
        </div>
      )}

      {canManageMasters && createOpen && (
        <EquipmentForm
          mode="create"
          onClose={() => setCreateOpen(false)}
          onSave={saveCreate}
          teams={teams.data || []}
          users={users.data || []}
          plants={plants}
          defaultPlant={plantCode}
          defaultDomain={serviceDomain}
        />
      )}

      {canEditAssets && editAsset && (
        <EquipmentForm
          mode="edit"
          equipment={editAsset}
          onClose={() => setEditAsset(null)}
          onSave={saveUpdate}
          teams={teams.data || []}
          users={users.data || []}
          plants={plants}
          defaultPlant={plantCode}
          defaultDomain={serviceDomain}
        />
      )}

      {selectedId && (
        <EquipmentDrawer
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onEdit={canEditAssets && !readOnly ? openEdit : null}
          notify={notify}
          canEditAssets={canEditAssets && !readOnly}
        />
      )}
    </section>
  );
}

function equipmentToForm(equipment, defaultPlant, defaultDomain) {
  const source = equipment || {};
  const domain = source.serviceDomain || defaultDomain || "MACHINE";
  return {
    ...EMPTY_EQUIPMENT,
    assetCode: source.assetCode || "",
    name: source.name || "",
    category: source.category || "",
    serviceDomain: domain,
    assetKind: source.assetKind || (domain === "IT" ? "IT_ASSET" : "PRODUCTION_MACHINE"),
    plantCode: source.plantCode || defaultPlant || "",
    location: source.location || "",
    workCenter: source.workCenter || "",
    manufacturer: source.manufacturer || "",
    model: source.model || "",
    serialNumber: source.serialNumber || "",
    criticality: source.criticality || "MEDIUM",
    status: source.status || "ACTIVE",
    maintenanceTeam: source.maintenanceTeam || "",
    primaryTechnician: source.primaryTechnician || "",
    owner: source.owner || "",
    assignedToCode: source.assignedToCode || "",
    assignedToName: source.assignedToName || "",
    assignedDepartment: source.assignedDepartment || "",
    hostname: source.hostname || "",
    ipAddress: source.ipAddress || "",
    macAddress: source.macAddress || "",
    operatingSystem: source.operatingSystem || "",
    purchaseDate: dateInput(source.purchaseDate),
    commissionedDate: dateInput(source.commissionedDate),
    warrantyExpiry: dateInput(source.warrantyExpiry),
    description: source.description || "",
    qrEnabled: source.qrEnabled !== false,
    safetyNotes: source.safetyNotes || "",
  };
}

function EquipmentForm({ mode = "create", equipment = null, onClose, onSave, teams, users, plants, defaultPlant, defaultDomain = "" }) {
  const editing = mode === "edit" && Boolean(equipment?.id);
  const [form, setForm] = useState(() => equipmentToForm(equipment, defaultPlant, defaultDomain));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(equipmentToForm(equipment, defaultPlant, defaultDomain));
  }, [equipment?.id, equipment?.version, defaultPlant, defaultDomain]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const serviceTeams = teams.filter((team) =>
    team.active &&
    (!form.plantCode || !team.plantCode || team.plantCode === form.plantCode) &&
    (!team.serviceDomain || team.serviceDomain === form.serviceDomain)
  );
  const equipmentRoles = form.serviceDomain === "IT"
    ? ["ADMIN", "ASSETFLOW_IT_HEAD", "ASSETFLOW_IT_TECHNICIAN", "ASSETFLOW_MANAGER", "ASSETFLOW_PLANNER"]
    : ["ADMIN", "ASSETFLOW_MACHINE_HEAD", "ASSETFLOW_MACHINE_TECHNICIAN", "ASSETFLOW_HEAD_TECHNICIAN", "ASSETFLOW_TECHNICIAN", "ASSETFLOW_MANAGER", "ASSETFLOW_PLANNER"];
  const maintenanceUsers = users.filter((u) => (u.roles || []).some((r) =>
    equipmentRoles.includes(String(r).replace(/^ROLE_/i, "").toUpperCase())
  ));

  const defaultKindForDomain = (domain) => domain === "IT" ? "IT_ASSET" : "PRODUCTION_MACHINE";
  const domainLocked = Boolean(defaultDomain);

  return (
    <Modal
      title={editing ? `Edit asset · ${equipment.assetCode || ""}` : "Add maintainable asset"}
      subtitle={editing
        ? "Update the asset master. Existing QR identity, repair history and preventive-plan links remain attached to this asset."
        : "Create the permanent identity used by preventive plans, repair history, service routing and controlled QR requests."}
      onClose={onClose}
      wide
    >
      <form onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          await onSave({
            ...form,
            purchaseDate: form.purchaseDate || null,
            commissionedDate: form.commissionedDate || null,
            warrantyExpiry: form.warrantyExpiry || null,
          });
        } finally {
          setSaving(false);
        }
      }}>
        <div className="af-modal-body af-form-grid">
          <Field label="Asset code"><input required value={form.assetCode} onChange={(e) => set("assetCode", e.target.value)} placeholder="AKG-CNC-001 / IT-LAP-021" /></Field>
          <Field label="Asset / equipment name"><input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="HOMAG NMC-112 / Design Laptop 21" /></Field>

          <Field label="Service domain" hint={editing && domainLocked ? "Department Heads cannot move an asset between Machine Maintenance and IT. ADMIN may do this from the Overall Asset Masters view." : undefined}>
            <select disabled={domainLocked} value={form.serviceDomain} onChange={(e) => {
              const nextDomain = e.target.value;
              setForm((current) => ({
                ...current,
                serviceDomain: nextDomain,
                assetKind: defaultKindForDomain(nextDomain),
                maintenanceTeam: "",
                primaryTechnician: "",
              }));
            }}>
              {SERVICE_DOMAINS.map((value) => <option key={value} value={value}>{SERVICE_DOMAIN_LABELS[value]}</option>)}
            </select>
          </Field>
          <Field label="Asset kind"><select value={form.assetKind} onChange={(e) => set("assetKind", e.target.value)}>{ASSET_KINDS.filter((value) => form.serviceDomain === "IT" ? ["IT_ASSET", "OTHER"].includes(value) : value !== "IT_ASSET").map((value) => <option key={value} value={value}>{human(value)}</option>)}</select></Field>

          <Field label="Category"><input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="CNC Router / Laptop / AC / Compressor…" /></Field>
          <Field label="Criticality"><select value={form.criticality} onChange={(e) => set("criticality", e.target.value)}>{CRITICALITIES.map((x) => <option key={x} value={x}>{human(x)}</option>)}</select></Field>

          <Field label="Plant"><select required value={form.plantCode} onChange={(e) => setForm((current) => ({ ...current, plantCode: e.target.value, maintenanceTeam: "", primaryTechnician: "" }))}><option value="">Select plant</option>{plants.map((plant) => <option key={plant.name} value={plant.name}>{plant.name}</option>)}</select></Field>
          <Field label="Work center / department"><input value={form.workCenter} onChange={(e) => set("workCenter", e.target.value)} placeholder="CNC Bay / Design / Accounts / Utility Room…" /></Field>
          <Field label="Physical location"><input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Line 2 · Bay 4 / First floor cabin…" /></Field>
          <Field label="Owner / using department"><input value={form.owner} onChange={(e) => set("owner", e.target.value)} placeholder="K&W Production / Design / Accounts" /></Field>

          {form.serviceDomain === "IT" && <>
            <Field label="Assigned employee code"><input value={form.assignedToCode} onChange={(e) => set("assignedToCode", e.target.value)} placeholder="EMP-0142" /></Field>
            <Field label="Assigned employee / user"><input value={form.assignedToName} onChange={(e) => set("assignedToName", e.target.value)} /></Field>
            <Field label="Assigned department"><input value={form.assignedDepartment} onChange={(e) => set("assignedDepartment", e.target.value)} /></Field>
            <Field label="Hostname"><input value={form.hostname} onChange={(e) => set("hostname", e.target.value)} placeholder="ALS-DESIGN-021" /></Field>
            <Field label="IP address"><input value={form.ipAddress} onChange={(e) => set("ipAddress", e.target.value)} /></Field>
            <Field label="MAC address"><input value={form.macAddress} onChange={(e) => set("macAddress", e.target.value)} /></Field>
            <Field label="Operating system"><input value={form.operatingSystem} onChange={(e) => set("operatingSystem", e.target.value)} placeholder="Windows 11 Pro" /></Field>
          </>}

          <Field label="Service / maintenance team" hint={`Only teams configured for ${SERVICE_DOMAIN_LABELS[form.serviceDomain]} are shown.`}><select value={form.maintenanceTeam} onChange={(e) => set("maintenanceTeam", e.target.value)}><option value="">Use plant/domain default team</option>{serviceTeams.map((t) => <option key={t.id} value={t.name}>{t.name}{t.defaultForPlant ? " · Default" : ""}</option>)}</select></Field>
          <Field label="Default technician / head" hint="Optional asset-level override. Normal routing goes to the service team's head."><select value={form.primaryTechnician} onChange={(e) => set("primaryTechnician", e.target.value)}><option value="">Use service team head</option>{maintenanceUsers.map((u) => <option key={u.username} value={u.username}>{u.displayName || u.username}</option>)}</select></Field>

          <Field label="Manufacturer"><input value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} /></Field>
          <Field label="Model"><input value={form.model} onChange={(e) => set("model", e.target.value)} /></Field>
          <Field label="Serial number"><input value={form.serialNumber} onChange={(e) => set("serialNumber", e.target.value)} /></Field>
          <Field label="Asset state"><select value={form.status} onChange={(e) => set("status", e.target.value)}>{EQUIPMENT_STATUSES.map((x) => <option key={x} value={x}>{human(x)}</option>)}</select></Field>

          <Field label="Purchase date"><input type="date" value={form.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} /></Field>
          <Field label="Commissioned date"><input type="date" value={form.commissionedDate} onChange={(e) => set("commissionedDate", e.target.value)} /></Field>
          <Field label="Warranty expiry"><input type="date" value={form.warrantyExpiry} onChange={(e) => set("warrantyExpiry", e.target.value)} /></Field>

          <div className="af-checks"><label><input type="checkbox" checked={form.qrEnabled} onChange={(e) => set("qrEnabled", e.target.checked)} /> Enable controlled asset QR request link</label></div>
          <Field label="Description"><textarea rows="3" value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
          <Field label="Safety / isolation / support notes"><textarea rows="3" value={form.safetyNotes} onChange={(e) => set("safetyNotes", e.target.value)} placeholder="LOTO point, electrical isolation, admin credentials owner, network point, access note…" /></Field>
        </div>
        <div className="af-modal-actions">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={saving}>{saving ? (editing ? "Updating…" : "Saving…") : (editing ? "Update asset" : "Add asset")}</Button>
        </div>
      </form>
    </Modal>
  );
}

function sameOriginAppUrl(path) {
  if (typeof window === "undefined") return "";
  const value = String(path || "").trim();
  if (!value.startsWith("/") || value.startsWith("//")) return "";

  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin ? url.toString() : "";
  } catch {
    return "";
  }
}

function openSameOriginAppUrl(url) {
  if (!url || typeof window === "undefined") return;
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (opened) opened.opener = null;
}

function EquipmentDrawer({ id, onClose, onEdit, notify, canEditAssets }) {
  const state = useAsync(() => assetFlowApi.equipmentOne(id), [id]);
  if (state.loading) return <div className="af-drawer"><Loading /></div>;
  if (state.error) return <div className="af-drawer"><ErrorBox error={state.error} onRetry={state.reload} /></div>;
  const e = state.data;
  const h = e.health || {};
  const qrUrl = sameOriginAppUrl(e.qrPath);

  const copyQrLink = async () => {
    if (!qrUrl) return;
    try {
      await navigator.clipboard.writeText(qrUrl);
      notify("Asset request link copied. Encode this URL in the QR label pasted on the asset.");
    } catch {
      notify("Clipboard is unavailable. Select and copy the QR URL manually.", "error");
    }
  };

  const rotateQr = async () => {
    if (!window.confirm("Rotate this asset QR token? The old QR label/link will immediately stop working.")) return;
    try {
      await assetFlowApi.rotateEquipmentQr(e.id);
      notify("Asset QR token rotated. Print a replacement QR label.");
      state.reload();
    } catch (error) { notify(errorText(error), "error"); }
  };

  return (
    <div className="af-drawer-backdrop" onMouseDown={onClose}>
      <aside className="af-drawer" onMouseDown={(x) => x.stopPropagation()}>
        <div className="af-drawer-head">
          <div><span>{e.assetCode}</span><h2>{e.name}</h2></div>
          <div className="af-drawer-head-actions">
            {canEditAssets && onEdit && <Button className="af-drawer-edit-btn" onClick={() => onEdit(e.id)}>Edit asset</Button>}
            <button className="af-icon-btn" onClick={onClose} aria-label="Close">×</button>
          </div>
        </div>
        <div className="af-drawer-status"><StatusBadge status={e.status} /><Badge tone={h.score >= 85 ? "green" : h.score >= 65 ? "amber" : "red"}>Health {h.score ?? 0}/100 · {h.label || "No history"}</Badge>{e.qrEnabled && <Badge tone="teal">QR active</Badge>}</div>
        <div className="af-drawer-body">
          <div className="af-health-grid"><Kpi title="MTTR" value={`${fmtNumber(h.mttrHours, 1)}h`} detail="90-day average" tone="violet" /><Kpi title="MTBF" value={`${fmtNumber(h.mtbfDays, 1)}d`} detail="between failures" tone="teal" /><Kpi title="Open work" value={fmtNumber(h.openWorkOrders)} detail={`${fmtNumber(h.failures30)} failures / 30d`} tone={h.openWorkOrders ? "amber" : "green"} /></div>
          <div className="af-detail-grid">
            <Detail label="Category" value={e.category} /><Detail label="Plant" value={e.plantCode} />
            <Detail label="Work center" value={e.workCenter} /><Detail label="Location" value={e.location} />
            <Detail label="Maintenance team" value={e.maintenanceTeam || "Plant default"} /><Detail label="Default technician" value={e.primaryTechnician || "Team head"} />
            <Detail label="Manufacturer / Model" value={[e.manufacturer, e.model].filter(Boolean).join(" · ")} /><Detail label="Serial number" value={e.serialNumber} />
            <Detail label="Owner / Department" value={e.owner} /><Detail label="Warranty expiry" value={fmtDate(e.warrantyExpiry)} />
            {e.serviceDomain === "IT" && <>
              <Detail label="Assigned employee" value={[e.assignedToCode, e.assignedToName].filter(Boolean).join(" · ")} />
              <Detail label="Assigned department" value={e.assignedDepartment} />
              <Detail label="Hostname" value={e.hostname} />
              <Detail label="IP / MAC" value={[e.ipAddress, e.macAddress].filter(Boolean).join(" · ")} />
              <Detail label="Operating system" value={e.operatingSystem} />
            </>}
            <Detail label="Last maintenance" value={fmtDate(e.lastMaintenanceAt, true)} /><Detail label="Next PM" value={fmtDate(e.nextMaintenanceAt, true)} />
          </div>

          {e.qrEnabled && <div className="af-qr-control-card">
            <div><span>{e.serviceDomain === "IT" ? "IT Asset QR request route" : "Machine QR complaint route"}</span><strong>Scan asset → identify exact record → authenticate requester → auto-route to the correct department</strong></div>
            <div className="af-qr-label-print">
              <MachineQr value={qrUrl} />
              <div className="af-qr-label-copy">
                <strong>{e.assetCode}</strong>
                <span>{e.name}</span>
                <small>{e.plantCode}{e.workCenter ? ` · ${e.workCenter}` : ""}</small>
                <b>{e.serviceDomain === "IT" ? "SCAN TO REQUEST IT SUPPORT" : "SCAN TO REPORT MACHINE MAINTENANCE"}</b>
              </div>
            </div>
            <input readOnly value={qrUrl} aria-label="Asset QR URL" />
            <div className="af-inline-actions">
              <Button onClick={copyQrLink}>Copy QR link</Button>
              <Button onClick={() => window.print()}>Print QR label</Button>
              {qrUrl && <Button onClick={() => openSameOriginAppUrl(qrUrl)}>Test complaint view</Button>}
              {canEditAssets && <Button onClick={rotateQr}>Rotate token</Button>}
            </div>
            <small>QR is generated locally inside the browser; no asset token is sent to an external QR service. Rotating the token invalidates every previously printed label for this asset.</small>
          </div>}

          <DetailBlock title="Description" text={e.description} />
          <DetailBlock title="Safety / isolation notes" text={e.safetyNotes} />

          <div className="af-section-title"><h3>Recent maintenance</h3><span>{e.recentWorkOrders?.length || 0} shown</span></div>
          <div className="af-mini-list">{(e.recentWorkOrders || []).map((w) => <div key={w.id}><strong>{w.workNumber} · {w.title}</strong><span>{human(w.status)} · {fmtDate(w.scheduledAt, true)} · {w.responsible || "Unassigned"}</span></div>)}</div>

          <div className="af-section-title"><h3>Preventive plans</h3><span>{e.plans?.length || 0} linked</span></div>
          <div className="af-mini-list">{(e.plans || []).map((p) => <div key={p.id}><strong>{p.title}</strong><span>Every {p.intervalDays} days · Next {fmtDate(p.nextDueDate)} {p.scheduledTime ? `at ${String(p.scheduledTime).slice(0, 5)}` : ""}</span></div>)}</div>
        </div>
      </aside>
    </div>
  );
}


function Reports({ plantCode, serviceDomain, showDepartmentComparison }) {
  const [from, setFrom] = useState(() => dateInput(addDays(new Date(), -180)));
  const [to, setTo] = useState(() => dateInput(new Date()));
  const state = useAsync(() => assetFlowApi.reports({ plantCode, serviceDomain: serviceDomain || undefined, from, to }), [plantCode, serviceDomain, from, to]);
  if (state.error) return <ErrorBox error={state.error} onRetry={state.reload} />;
  const data = state.data || {};
  const summary = data.summary || {};
  const maxMonthly = Math.max(1, ...(data.monthly || []).map((m) => Number(m.opened || 0)));
  return (
    <section className="af-page">
      <div className="af-page-head compact"><div><p className="af-eyebrow">Maintenance intelligence</p><h1>{showDepartmentComparison ? "Director · Overall Maintenance Reports" : serviceDomain === "IT" ? "IT Support Reports" : "Machine Maintenance Reports"}</h1><p>{showDepartmentComparison ? "Cross-department executive analytics. Operational records remain isolated by department." : serviceDomain === "IT" ? "IT-only response, asset, technician, workload and cost analytics." : "Machine-only reliability, downtime, PM, technician and maintenance-cost analytics."}</p></div><div className="af-date-range"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><span>to</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div></div>
      {state.loading ? <Loading /> : <><div className="af-kpi-grid four"><Kpi title="Work orders" value={fmtNumber(summary.orders)} detail={`${fmtNumber(summary.completed)} completed`} tone="blue" /><Kpi title="Planned maintenance mix" value={`${fmtNumber(summary.plannedRatio, 1)}%`} detail={`${fmtNumber(summary.preventive)} preventive`} tone="green" /><Kpi title="Corrective work" value={fmtNumber(summary.corrective)} detail="failure-driven jobs" tone="amber" /><Kpi title="Maintenance cost" value={fmtMoney(summary.totalCost)} detail="parts + labour + external" tone="violet" /></div><div className="af-dashboard-grid"><div className="af-panel af-span-2"><div className="af-panel-head"><div><h2>Monthly work trend</h2><p>Opened vs closed maintenance</p></div></div><div className="af-month-chart">{(data.monthly || []).map((m) => <div className="af-month-bar" key={m.month}><div><i style={{ height: `${Math.max(4, (m.opened / maxMonthly) * 100)}%` }} /><b style={{ height: `${Math.max(4, (m.closed / maxMonthly) * 100)}%` }} /></div><span>{m.month.slice(2)}</span></div>)}</div></div><div className="af-panel"><div className="af-panel-head"><div><h2>Top failure assets</h2><p>Where reliability action is needed</p></div></div><div className="af-rank-list">{(data.byEquipment || []).slice(0, 8).map((a, i) => <div className="af-rank-row" key={a.name}><span>{i + 1}</span><strong>{a.name}</strong><Badge tone={a.failures >= 3 ? "red" : "amber"}>{a.failures}</Badge></div>)}</div></div><div className="af-panel af-span-3 af-table-wrap"><div className="af-panel-head"><div><h2>Service-domain workload</h2><p>Machine Maintenance vs IT Support request mix</p></div></div><table className="af-table"><thead><tr><th>Service</th><th>Requests</th><th>Completed</th><th>Open</th><th>Downtime</th><th>Cost</th></tr></thead><tbody>{(data.byServiceDomain || []).map((row) => <tr key={row.serviceDomain}><td><strong>{SERVICE_DOMAIN_LABELS[row.serviceDomain] || human(row.serviceDomain)}</strong></td><td>{row.orders}</td><td>{row.completed}</td><td>{row.open}</td><td>{row.downtimeHours}h</td><td>{fmtMoney(row.cost)}</td></tr>)}</tbody></table></div><div className="af-panel af-span-3 af-table-wrap"><div className="af-panel-head"><div><h2>Technician performance</h2><p>Completion, repair time and downtime exposure</p></div></div><table className="af-table"><thead><tr><th>Technician</th><th>Assigned</th><th>Completed</th><th>Avg repair</th><th>Downtime handled</th></tr></thead><tbody>{(data.byTechnician || []).map((t) => <tr key={t.name}><td><strong>{t.name}</strong></td><td>{t.orders}</td><td>{t.closed}</td><td>{t.avgRepairHours}h</td><td>{t.downtimeHours}h</td></tr>)}</tbody></table></div></div></>}
    </section>
  );
}

/* ================================= CONFIGURATION ================================= */

function Configuration({ plantCode, serviceDomain, notify, plants, isAdmin }) {
  const [section, setSection] = useState("teams");
  const [teamOpen, setTeamOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [reporterOpen, setReporterOpen] = useState(null);

  const needTeams = section === "teams" || section === "plans" || teamOpen || planOpen;
  const needReporters = isAdmin && section === "reporters";
  const needPlans = section === "plans";
  const needEquipment = section === "plans" || planOpen;
  const needUsers = teamOpen || planOpen;

  const teams = useAsync(
    () => needTeams
      ? assetFlowApi.teams(plantCode, serviceDomain || undefined)
      : Promise.resolve([]),
    [needTeams, plantCode, serviceDomain]
  );
  const reporters = useAsync(
    () => needReporters
      ? assetFlowApi.reporters(plantCode, false)
      : Promise.resolve([]),
    [needReporters, plantCode]
  );
  const plans = useAsync(
    () => needPlans
      ? assetFlowApi.plans(plantCode, serviceDomain || undefined, false)
      : Promise.resolve([]),
    [needPlans, plantCode, serviceDomain]
  );
  const equipment = useAsync(
    () => needEquipment
      ? assetFlowApi.equipment({ plantCode, serviceDomain: serviceDomain || undefined })
      : Promise.resolve({ items: [] }),
    [needEquipment, plantCode, serviceDomain]
  );
  const users = useAsync(
    () => needUsers
      ? assetFlowApi.users(plantCode, serviceDomain || undefined)
      : Promise.resolve([]),
    [needUsers, plantCode, serviceDomain]
  );

  const generate = async () => {
    try {
      const result = await assetFlowApi.generateDuePlans(serviceDomain || undefined);
      notify(`${result.created || 0} preventive work orders generated`);
      plans.reload();
    } catch (error) { notify(errorText(error), "error"); }
  };

  const copyDeskLink = async (team) => {
    const value = sameOriginAppUrl(team?.requestPath);
    if (!value) {
      notify("The service-desk request link returned by the server is invalid.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      notify(`${SERVICE_DOMAIN_LABELS[team.serviceDomain] || "Service"} request link copied`);
    } catch {
      notify(value, "error");
    }
  };

  return (
    <section className="af-page">
      <div className="af-page-head compact">
        <div>
          <p className="af-eyebrow">Master data, access & automation</p>
          <h1>Maintenance Configuration</h1>
          <p>
            Full FlowSuite users are reserved for maintenance staff who need the application. Occasional workers, operators, supervisors and back-office staff can use controlled Reporter Passes instead of creating dozens of application accounts.
          </p>
        </div>
      </div>

      <div className="af-config-tabs">
        <button className={cx(section === "teams" && "is-active")} onClick={() => setSection("teams")}>Service Teams & Routing</button>
        {isAdmin && <button className={cx(section === "reporters" && "is-active")} onClick={() => setSection("reporters")}>Reporter Passes</button>}
        <button className={cx(section === "plans" && "is-active")} onClick={() => setSection("plans")}>Preventive Plans</button>
      </div>

      {section === "teams" && (
        <div className="af-panel">
          <div className="af-panel-head">
            <div>
              <h2>Plant + service routing</h2>
              <p>Configure strictly separated Machine Maintenance and IT Support routes. LAN / internet / PC issues route only to IT; lighting / electrical / AC-HVAC / factory utility issues route only to Machine Maintenance. Machine teams are plant-specific; IT may be plant-specific or centrally managed company-wide.</p>
            </div>
            <Button variant="primary" onClick={() => setTeamOpen(true)}>+ New service team</Button>
          </div>
          <div className="af-team-grid">
            {(teams.data || []).map((team) => (
              <div className="af-team-card" key={team.id}>
                <div>
                  <strong>{team.name}</strong>
                  <div className="af-inline-actions">
                    <span className="af-service-domain-tag">{SERVICE_DOMAIN_LABELS[team.serviceDomain] || human(team.serviceDomain)}</span>
                    {team.defaultForPlant && <Badge tone="blue">Default route</Badge>}
                    <StatusBadge status={team.active ? "ACTIVE" : "RETIRED"} />
                  </div>
                </div>
                <p>{team.plantCode || "Company-wide"}</p>
                <span>Head / Lead: {team.lead || "Not assigned"}</span>
                <div className="af-chip-row">{(team.members || []).slice(0, 10).map((member) => <Badge key={member}>{member}</Badge>)}</div>
                {team.publicReportingEnabled && sameOriginAppUrl(team.requestPath) && (
                  <div className="af-service-desk-mini">
                    <MachineQr value={sameOriginAppUrl(team.requestPath)} size={82} />
                    <div>
                      <strong>{SERVICE_DOMAIN_LABELS[team.serviceDomain] || human(team.serviceDomain)} Service Desk QR</strong>
                      <span>{team.serviceDomain === "IT" ? "LAN, internet, PC/laptop, printer, software and IT infrastructure requests route to IT only." : "Machine, electrical, lighting, AC/HVAC, utilities and facility requests route to Machine Maintenance only."}</span>
                    </div>
                    <Button onClick={() => copyDeskLink(team)}>Copy request link</Button>
                  </div>
                )}
              </div>
            ))}
            {!teams.data?.length && <EmptyState title="No service team configured" text="Create plant/domain routes and nominate the Head Technician or service lead before going live." />}
          </div>
        </div>
      )}

      {section === "reporters" && isAdmin && (
        <div className="af-panel">
          <div className="af-panel-head">
            <div>
              <h2>Controlled Reporter Pass directory</h2>
              <p>These are not FlowSuite users. They have no module access, no password and no permission beyond submitting requests for their assigned plant/service domains with a PIN.</p>
            </div>
            <Button variant="primary" onClick={() => setReporterOpen(EMPTY_REPORTER)}>+ New Reporter Pass</Button>
          </div>
          <div className="af-table-wrap">
            <table className="af-reporter-table">
              <thead><tr><th>Reporter</th><th>Type</th><th>Plant / Department</th><th>Allowed services</th><th>Valid until</th><th>Status</th><th>Last request</th><th /></tr></thead>
              <tbody>
                {(reporters.data || []).map((reporter) => (
                  <tr key={reporter.id}>
                    <td><strong>{reporter.displayName}</strong><small>{reporter.reporterCode}</small></td>
                    <td>{human(reporter.reporterType)}</td>
                    <td>{(reporter.plantCodes || [reporter.plantCode]).filter(Boolean).join(", ")}<small>{[reporter.department, reporter.designation, reporter.linkedUsername && `FlowSuite: ${reporter.linkedUsername}`].filter(Boolean).join(" · ") || "—"}</small></td>
                    <td><div className="af-chip-row">{(reporter.allowedDomains || []).map((domain) => <span className="af-service-domain-tag" key={domain}>{SERVICE_DOMAIN_LABELS[domain] || human(domain)}</span>)}</div></td>
                    <td>{fmtDate(reporter.validUntil)}</td>
                    <td>{reporter.active ? <Badge tone="green">Active</Badge> : <Badge>Disabled</Badge>}</td>
                    <td>{fmtDate(reporter.lastRequestAt, true)}</td>
                    <td><Button onClick={() => setReporterOpen(reporter)}>Edit</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!reporters.data?.length && <EmptyState title="No Reporter Passes" text="Add only employees/operators who are approved to raise support requests but do not need a FlowSuite application account." />}
          </div>
        </div>
      )}

      {section === "plans" && (
        <div className="af-panel">
          <div className="af-panel-head">
            <div><h2>Preventive maintenance plans</h2><p>Recurring PMs are generated before due date, scheduled to the defined time and routed by the asset's plant/service domain.</p></div>
            <div className="af-inline-actions"><Button onClick={generate}>Generate due now</Button><Button variant="primary" onClick={() => setPlanOpen(true)}>+ New PM plan</Button></div>
          </div>
          <div className="af-table-wrap">
            <table className="af-table">
              <thead><tr><th>Asset</th><th>Plan</th><th>Cycle</th><th>Schedule</th><th>Est.</th><th>Route</th><th>Shutdown</th><th>Status</th></tr></thead>
              <tbody>{(plans.data || []).map((plan) => (
                <tr key={plan.id}>
                  <td>{plan.equipmentName}</td>
                  <td><strong>{plan.title}</strong><small>{plan.checklistText ? "Checklist configured" : "No checklist"}</small></td>
                  <td>Every {plan.intervalDays}d<small>Generate {plan.leadDays}d before</small></td>
                  <td className={cx(isPastBusinessDate(plan.nextDueDate) && "af-danger-text")}>{fmtDate(plan.nextDueDate)}<small>{plan.scheduledTime ? String(plan.scheduledTime).slice(0, 5) : "Time not set"}</small></td>
                  <td>{fmtNumber(plan.estimatedMinutes)} min</td>
                  <td>{plan.responsible || plan.teamName || "Asset/domain default"}</td>
                  <td>{plan.requiresShutdown ? <Badge tone="amber">Planned shutdown</Badge> : <Badge>Running access</Badge>}</td>
                  <td>{plan.active ? <Badge tone="green">Active</Badge> : <Badge>Paused</Badge>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {teamOpen && <TeamForm defaultPlant={plantCode} defaultDomain={serviceDomain} allowCompanyWide={isAdmin} plants={plants} users={users.data || []} onClose={() => setTeamOpen(false)} onSave={async (payload) => {
        try {
          await assetFlowApi.createTeam(payload);
          notify("Service team created");
          setTeamOpen(false);
          teams.reload();
        } catch (error) { notify(errorText(error), "error"); }
      }} />}

      {reporterOpen && <ReporterForm initial={reporterOpen?.id ? reporterOpen : null} defaultPlant={plantCode} plants={plants} onClose={() => setReporterOpen(null)} onSave={async (payload) => {
        try {
          if (reporterOpen?.id) await assetFlowApi.updateReporter(reporterOpen.id, payload);
          else await assetFlowApi.createReporter(payload);
          notify(reporterOpen?.id ? "Reporter Pass updated" : "Reporter Pass created");
          setReporterOpen(null);
          reporters.reload();
        } catch (error) { notify(errorText(error), "error"); }
      }} />}

      {planOpen && <PlanForm equipment={equipment.data?.items || []} teams={teams.data || []} users={users.data || []} onClose={() => setPlanOpen(false)} onSave={async (payload) => {
        try {
          await assetFlowApi.createPlan(payload);
          notify("Preventive maintenance plan created");
          setPlanOpen(false);
          plans.reload();
        } catch (error) { notify(errorText(error), "error"); }
      }} />}
    </section>
  );
}

function TeamForm({ defaultPlant, defaultDomain = "", allowCompanyWide = false, plants, users, onClose, onSave }) {
  const [form, setForm] = useState({ ...EMPTY_TEAM, plantCode: defaultPlant || "", serviceDomain: defaultDomain || "MACHINE" });
  const normalizeUserRoles = (user) => (user.roles || []).map((role) => String(role || "").replace(/^ROLE_/i, "").toUpperCase());
  const headRoles = form.serviceDomain === "IT"
    ? ["ADMIN", "ASSETFLOW_IT_HEAD", "ASSETFLOW_MANAGER", "ASSETFLOW_PLANNER"]
    : ["ADMIN", "ASSETFLOW_MACHINE_HEAD", "ASSETFLOW_HEAD_TECHNICIAN", "ASSETFLOW_MANAGER", "ASSETFLOW_PLANNER"];
  const memberRoles = form.serviceDomain === "IT"
    ? ["ADMIN", "ASSETFLOW_IT_HEAD", "ASSETFLOW_IT_TECHNICIAN", "ASSETFLOW_MANAGER", "ASSETFLOW_PLANNER"]
    : ["ADMIN", "ASSETFLOW_MACHINE_HEAD", "ASSETFLOW_MACHINE_TECHNICIAN", "ASSETFLOW_HEAD_TECHNICIAN", "ASSETFLOW_TECHNICIAN", "ASSETFLOW_MANAGER", "ASSETFLOW_PLANNER"];
  const heads = users.filter((user) => normalizeUserRoles(user).some((role) => headRoles.includes(role)));
  const members = users.filter((user) => normalizeUserRoles(user).some((role) => memberRoles.includes(role)));
  const selectedMembers = String(form.membersText || "").split(",").map((x) => x.trim()).filter(Boolean);
  const toggleMember = (username) => {
    const next = selectedMembers.includes(username)
      ? selectedMembers.filter((value) => value !== username)
      : [...selectedMembers, username];
    setForm({ ...form, membersText: next.join(", ") });
  };

  return (
    <Modal title="New maintenance / service team" subtitle="Create a plant/domain route. The team lead receives auto-routed requests and may delegate to eligible technicians." onClose={onClose} wide>
      <form onSubmit={(event) => { event.preventDefault(); onSave(form); }}>
        <div className="af-modal-body af-form-grid">
          <Field label="Team name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="AKG Machine Maintenance / Central IT Support" /></Field>
          <Field label="Service domain"><select disabled={Boolean(defaultDomain)} value={form.serviceDomain} onChange={(e) => setForm({ ...form, serviceDomain: e.target.value, defaultForPlant: false })}>{SERVICE_DOMAINS.map((value) => <option key={value} value={value}>{SERVICE_DOMAIN_LABELS[value]}</option>)}</select></Field>

          <Field label="Plant" hint="Leave company-wide only for a centrally managed service such as IT if your role allows it.">
            <select required={form.serviceDomain === "MACHINE" || !allowCompanyWide} value={form.plantCode} onChange={(e) => setForm({ ...form, plantCode: e.target.value, lead: "", membersText: "", defaultForPlant: false })}>
              {form.serviceDomain === "IT" && allowCompanyWide && <option value="">Company-wide / all plants</option>}
              {form.serviceDomain === "MACHINE" && <option value="">Select plant</option>}
              {plants.map((plant) => <option key={plant.name} value={plant.name}>{plant.name}</option>)}
            </select>
          </Field>
          <Field label="Head Technician / Service Lead" hint="Must be a AssetFlow Head Technician or Manager with access to the plant."><select required value={form.lead} onChange={(e) => setForm({ ...form, lead: e.target.value })}><option value="">Select lead</option>{heads.map((user) => <option key={user.username} value={user.username}>{user.displayName || user.username}</option>)}</select></Field>

          <Field label="Default request categories" hint="Comma-separated suggestions shown when this Service Desk QR is used."><input value={form.defaultCategories} onChange={(e) => setForm({ ...form, defaultCategories: e.target.value })} placeholder={form.serviceDomain === "IT" ? "Network / LAN, Internet, PC / Laptop, Printer / Scanner, Software / Login" : "Machine Breakdown, Electrical, Lighting, AC / HVAC, Utility, Facility"} /></Field>
          <div className="af-checks">
            <label><input type="checkbox" disabled={!form.plantCode} checked={form.defaultForPlant} onChange={(e) => setForm({ ...form, defaultForPlant: e.target.checked })} /> Default route for this plant + service</label>
            <label><input type="checkbox" checked={form.publicReportingEnabled} onChange={(e) => setForm({ ...form, publicReportingEnabled: e.target.checked })} /> Enable Service Desk QR / Reporter Pass requests</label>
          </div>

          <Field label="Technicians / members" hint="Only full FlowSuite maintenance users belong here. Occasional complainants belong in Reporter Passes, not this list."><div className="af-user-select-list">{members.map((user) => <label key={user.username}><input type="checkbox" checked={selectedMembers.includes(user.username)} onChange={() => toggleMember(user.username)} /> {user.displayName || user.username}</label>)}</div></Field>
        </div>
        <div className="af-modal-actions"><Button type="button" onClick={onClose}>Cancel</Button><Button variant="primary">Create service team</Button></div>
      </form>
    </Modal>
  );
}

function ReporterForm({ initial, defaultPlant, plants, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_REPORTER,
    plantCode: defaultPlant || "",
    ...(initial || {}),
    plantCodes: Array.isArray(initial?.plantCodes) && initial.plantCodes.length
      ? initial.plantCodes
      : (initial?.plantCode ? [initial.plantCode] : (defaultPlant ? [defaultPlant] : [])),
    allowedDomains: Array.isArray(initial?.allowedDomains) && initial.allowedDomains.length ? initial.allowedDomains : ["MACHINE"],
    accessPin: "",
    validUntil: initial?.validUntil ? dateInput(initial.validUntil) : "",
  }));
  const [saving, setSaving] = useState(false);

  const toggleDomain = (domain) => {
    setForm((current) => {
      const exists = current.allowedDomains.includes(domain);
      const next = exists
        ? current.allowedDomains.filter((value) => value !== domain)
        : [...current.allowedDomains, domain];
      return { ...current, allowedDomains: next.length ? next : [domain] };
    });
  };

  return (
    <Modal title={initial ? "Edit Reporter Pass" : "New Reporter Pass"} subtitle="A Reporter Pass is not a FlowSuite account. It only authorises controlled request submission for the selected plant and service domains." onClose={onClose} wide>
      <form onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          await onSave({
            ...form,
            accessPin: form.accessPin || null,
            validUntil: form.validUntil || null,
            version: initial?.version ?? null,
          });
        } finally { setSaving(false); }
      }}>
        <div className="af-modal-body af-form-grid">
          <Field label="Reporter / Employee Code"><input required value={form.reporterCode} onChange={(e) => setForm({ ...form, reporterCode: e.target.value })} placeholder="EMP-0142 / OP-AKG-32" /></Field>
          <Field label="Name"><input required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></Field>
          <Field label="Reporter type"><select value={form.reporterType} onChange={(e) => setForm({ ...form, reporterType: e.target.value })}>{REPORTER_TYPES.map((value) => <option key={value} value={value}>{human(value)}</option>)}</select></Field>
          <Field label="Primary plant"><select required value={form.plantCode} onChange={(e) => {
            const value = e.target.value;
            setForm((current) => ({ ...current, plantCode: value, plantCodes: current.plantCodes.includes(value) ? current.plantCodes : [...current.plantCodes, value] }));
          }}><option value="">Select plant</option>{plants.map((plant) => <option key={plant.name} value={plant.name}>{plant.name}</option>)}</select></Field>
          <Field label="Authorised plants" hint="Use multiple plants only for approved supervisors/managers who genuinely work across locations."><div className="af-user-select-list">{plants.map((plant) => <label key={plant.name}><input type="checkbox" checked={form.plantCodes.includes(plant.name)} onChange={() => setForm((current) => ({ ...current, plantCodes: current.plantCodes.includes(plant.name) ? current.plantCodes.filter((x) => x !== plant.name) : [...current.plantCodes, plant.name] }))} /> {plant.name}</label>)}</div></Field>
          <Field label="Linked FlowSuite username (optional)" hint="Link an existing FlowSuite employee so the same person can use the authenticated Maintenance Request portal without a second account."><input value={form.linkedUsername || ""} onChange={(e) => setForm({ ...form, linkedUsername: e.target.value })} placeholder="Existing FlowSuite username" /></Field>
          <Field label="Designation"><input value={form.designation || ""} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="Operator / Supervisor / Manager / Staff" /></Field>
          <Field label="Department / area"><input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Production / Design / Accounts / Store…" /></Field>
          <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label={initial ? "New PIN (leave blank to keep current)" : "Reporter PIN"} hint="4–8 digits. Stored hashed; repeated wrong attempts trigger a temporary lock."><input required={!initial} type="password" inputMode="numeric" minLength={4} maxLength={8} value={form.accessPin} onChange={(e) => setForm({ ...form, accessPin: e.target.value.replace(/\D/g, "") })} /></Field>
          <Field label="Valid until" hint="Optional. Useful for contractors/temporary workers."><input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} /></Field>
          <div className="af-checks"><label><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Reporter Pass active</label></div>

          <Field label="Allowed request services" hint="Limit a reporter to only the areas they genuinely need.">
            <div className="af-user-select-list">
              {SERVICE_DOMAINS.map((domain) => (
                <label key={domain}>
                  <input type="checkbox" checked={form.allowedDomains.includes(domain)} onChange={() => toggleDomain(domain)} />
                  {SERVICE_DOMAIN_LABELS[domain]}
                </label>
              ))}
            </div>
          </Field>
        </div>
        <div className="af-modal-actions"><Button type="button" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={saving}>{saving ? "Saving…" : initial ? "Save Reporter Pass" : "Create Reporter Pass"}</Button></div>
      </form>
    </Modal>
  );
}

function PlanForm({ equipment, teams, users, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_PLAN);
  const selectedEquipment = equipment.find((x) => x.id === form.equipmentId);
  const selectedDomain = selectedEquipment?.serviceDomain || "MACHINE";
  const planRoles = selectedDomain === "IT"
    ? ["ADMIN", "ASSETFLOW_IT_HEAD", "ASSETFLOW_IT_TECHNICIAN", "ASSETFLOW_MANAGER", "ASSETFLOW_PLANNER"]
    : ["ADMIN", "ASSETFLOW_MACHINE_HEAD", "ASSETFLOW_MACHINE_TECHNICIAN", "ASSETFLOW_HEAD_TECHNICIAN", "ASSETFLOW_TECHNICIAN", "ASSETFLOW_MANAGER", "ASSETFLOW_PLANNER"];
  const selectable = users.filter((u) => (u.roles || []).some((r) => planRoles.includes(String(r).replace(/^ROLE_/i, "").toUpperCase())));
  const availableTeams = teams.filter((t) =>
    t.active &&
    (!selectedEquipment?.plantCode || !t.plantCode || t.plantCode === selectedEquipment.plantCode) &&
    (!selectedEquipment?.serviceDomain || !t.serviceDomain || t.serviceDomain === selectedEquipment.serviceDomain)
  );

  return (
    <Modal title="New preventive maintenance plan" subtitle="Define the maintenance cycle once. AssetFlow will generate and route future PM work automatically." onClose={onClose} wide>
      <form onSubmit={(e) => {
        e.preventDefault();
        onSave({
          ...form,
          intervalDays: Number(form.intervalDays),
          leadDays: Number(form.leadDays),
          estimatedMinutes: Number(form.estimatedMinutes || 0),
        });
      }}>
        <div className="af-modal-body af-form-grid">
          <Field label="Equipment"><select required value={form.equipmentId} onChange={(e) => {
            const item = equipment.find((x) => x.id === e.target.value);
            setForm({ ...form, equipmentId: e.target.value, teamName: item?.maintenanceTeam || "", responsible: item?.primaryTechnician || "" });
          }}><option value="">Select equipment</option>{equipment.map((e) => <option key={e.id} value={e.id}>{e.assetCode} · {e.name}</option>)}</select></Field>
          <Field label="Plan title"><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Monthly lubrication & safety inspection" /></Field>
          <Field label="Interval days"><input required type="number" min="1" value={form.intervalDays} onChange={(e) => setForm({ ...form, intervalDays: e.target.value })} /></Field>
          <Field label="Generate before due (days)"><input type="number" min="0" value={form.leadDays} onChange={(e) => setForm({ ...form, leadDays: e.target.value })} /></Field>
          <Field label="Next due date"><input required type="date" value={form.nextDueDate} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} /></Field>
          <Field label="Scheduled attendance time"><input required type="time" value={form.scheduledTime} onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })} /></Field>
          <Field label="Estimated maintenance minutes"><input required type="number" min="1" value={form.estimatedMinutes} onChange={(e) => setForm({ ...form, estimatedMinutes: e.target.value })} /></Field>
          <Field label="Priority"><select value={form.defaultPriority} onChange={(e) => setForm({ ...form, defaultPriority: e.target.value })}>{PRIORITIES.map((x) => <option key={x} value={x}>{human(x)}</option>)}</select></Field>
          <Field label="Maintenance team"><select value={form.teamName} onChange={(e) => setForm({ ...form, teamName: e.target.value })}><option value="">Use machine / plant default route</option>{availableTeams.map((t) => <option key={t.id} value={t.name}>{t.name}{t.defaultForPlant ? " · Default" : ""}</option>)}</select></Field>
          <Field label="Responsible technician"><select value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })}><option value="">Use team head / machine default</option>{selectable.map((u) => <option key={u.username} value={u.username}>{u.displayName || u.username}</option>)}</select></Field>
          <div className="af-checks af-full"><label><input type="checkbox" checked={form.requiresShutdown} onChange={(e) => setForm({ ...form, requiresShutdown: e.target.checked })} /> Preventive maintenance requires planned machine shutdown</label></div>
          <Field label="Instructions"><textarea rows="4" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Preparation, isolation, tools, lubrication grade, inspection standard…" /></Field>
          <Field label="Checklist" hint="One step per line. It is copied into each generated PM work order."><textarea rows="6" value={form.checklistText} onChange={(e) => setForm({ ...form, checklistText: e.target.value })} placeholder={"Isolate machine\nInspect guards\nCheck lubrication\nClean filters\nTrial run and verify"} /></Field>
        </div>
        <div className="af-modal-actions"><Button type="button" onClick={onClose}>Cancel</Button><Button variant="primary">Create preventive plan</Button></div>
      </form>
    </Modal>
  );
}

