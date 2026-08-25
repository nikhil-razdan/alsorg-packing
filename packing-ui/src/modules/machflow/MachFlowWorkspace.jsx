import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import machFlowApi from "./machFlowApi";
import { createQrMatrix } from "./machQr";
import "./machflow.css";

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
const SERVICE_DOMAINS = ["MACHINE", "IT", "ELECTRICAL", "FACILITY", "UTILITY", "GENERAL"];
const ASSET_KINDS = ["PRODUCTION_MACHINE", "IT_ASSET", "ELECTRICAL_ASSET", "FACILITY_ASSET", "UTILITY_ASSET", "OTHER"];
const REPORTER_TYPES = ["EMPLOYEE", "OPERATOR", "SUPERVISOR", "STAFF", "CONTRACTOR", "OTHER"];

const SERVICE_DOMAIN_LABELS = {
  MACHINE: "Machine Maintenance",
  IT: "IT Support",
  ELECTRICAL: "Electrical Maintenance",
  FACILITY: "Facility Maintenance",
  UTILITY: "Utilities Maintenance",
  GENERAL: "General Maintenance",
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
  department: "",
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

function dateInput(value) {
  const d = value instanceof Date ? value : value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function dateTimeInput(value) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fmtDate(value, withTime = false) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(d);
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

  if (!matrix.length) return <div className="mf-qr-unavailable">QR unavailable</div>;
  const quiet = 4;
  const dimension = matrix.length + quiet * 2;

  return (
    <svg
      className="mf-machine-qr"
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

function useAsync(fn, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fn();
      setState({ loading: false, data, error: null });
      return data;
    } catch (error) {
      setState({ loading: false, data: null, error });
      throw error;
    }
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
  return <div className={cx("mf-toast", toast.type === "error" && "is-error")}>{toast.message}</div>;
}

function Button({ children, className = "", variant = "default", ...props }) {
  return (
    <button className={cx("mf-btn", `mf-btn-${variant}`, className)} {...props}>
      {children}
    </button>
  );
}

function Badge({ children, tone = "neutral" }) {
  return <span className={cx("mf-badge", `tone-${tone}`)}>{children}</span>;
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
    <label className="mf-field">
      <span className="mf-label">{label}</span>
      {children}
      {hint && <span className="mf-hint">{hint}</span>}
    </label>
  );
}

function Modal({ title, subtitle, children, onClose, wide = false }) {
  return (
    <div className="mf-modal-backdrop" onMouseDown={onClose}>
      <div className={cx("mf-modal", wide && "is-wide")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mf-modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="mf-icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyState({ title, text, action }) {
  return (
    <div className="mf-empty">
      <div className="mf-empty-icon">⌁</div>
      <strong>{title}</strong>
      <span>{text}</span>
      {action}
    </div>
  );
}

function Loading() {
  return <div className="mf-loading"><span /><span /><span /></div>;
}

function ErrorBox({ error, onRetry }) {
  return (
    <div className="mf-error">
      <strong>Could not load MachFlow data</strong>
      <span>{errorText(error)}</span>
      {onRetry && <Button onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export default function MachFlowWorkspace() {
  const navigate = useNavigate();
  const { roles = [], username = "" } = useAuth();
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const qrToken = query.get("asset") || query.get("qr") || "";
  const qrMode = String(query.get("mode") || "").toLowerCase() === "report" && Boolean(qrToken);

  const [tab, setTab] = useState("dashboard");
  const [plantCode, setPlantCode] = useState("");
  const [toast, setToast] = useState(null);
  const plants = useAsync(() => machFlowApi.plants(), []);

  const normalizedRoles = useMemo(
    () => (roles || []).map((role) => String(role || "").replace(/^ROLE_/i, "").toUpperCase()),
    [roles]
  );
  const isAdmin = normalizedRoles.includes("ADMIN");
  const isManager = isAdmin || normalizedRoles.includes("MACHFLOW_MANAGER");
  const isPlanner = normalizedRoles.includes("MACHFLOW_PLANNER");
  const isHeadTechnician = normalizedRoles.includes("MACHFLOW_HEAD_TECHNICIAN");
  const isTechnician = normalizedRoles.includes("MACHFLOW_TECHNICIAN");
  const isRequester = normalizedRoles.includes("MACHFLOW_REQUESTER");

  const canCoordinate = isManager || isPlanner || isHeadTechnician;
  const canManageMasters = isManager || isPlanner;
  const canExecute = canCoordinate || isTechnician;
  const canViewReports = canCoordinate;
  const requesterOnly = isRequester && !isManager && !isPlanner && !isHeadTechnician && !isTechnician;
  const visibleTabs = useMemo(
    () => TABS.filter(([key]) => {
      if (requesterOnly) return ["work", "equipment"].includes(key);
      if (key === "reports") return canViewReports;
      if (key === "config") return canManageMasters;
      return true;
    }),
    [canManageMasters, canViewReports, requesterOnly]
  );

  useEffect(() => {
    if (!visibleTabs.some(([key]) => key === tab)) setTab(visibleTabs[0]?.[0] || "work");
  }, [tab, visibleTabs]);

  useEffect(() => {
    const available = plants.data || [];
    if (available.length === 1 && !plantCode) setPlantCode(available[0].name);
  }, [plants.data, plantCode]);

  const notify = useCallback((message, type = "success") => setToast({ message, type }), []);

  if (qrMode) {
    return (
      <div className="mf-shell mf-mobile-shell">
        <QrComplaintPortal
          token={qrToken}
          username={username}
          onOpenMachFlow={() => navigate("/modules?module=machflow", { replace: true })}
        />
      </div>
    );
  }

  const roleLabel = isManager
    ? "Maintenance Head"
    : isHeadTechnician
      ? "Plant Head Technician"
      : isPlanner
        ? "Maintenance Planner"
        : isTechnician
          ? "Technician"
          : isRequester
            ? "Complainant / Requester"
            : "MachFlow User";

  return (
    <div className="mf-shell">
      <header className="mf-topbar">
        <div className="mf-brand">
          <button className="mf-icon-btn mf-home-btn" type="button" onClick={() => navigate("/modules")} aria-label="Back to modules">←</button>
          <div className="mf-mark">M</div>
          <div>
            <strong>MachFlow</strong>
            <span>Maintenance, IT Support & Reliability</span>
          </div>
        </div>
        <nav className="mf-nav" aria-label="MachFlow sections">
          {visibleTabs.map(([key, label]) => (
            <button key={key} className={cx(tab === key && "is-active")} onClick={() => setTab(key)}>{label}</button>
          ))}
        </nav>
        <div className="mf-top-actions">
          <span className="mf-user-pill">{username || "MachFlow User"} · {roleLabel}</span>
          <select value={plantCode} onChange={(e) => setPlantCode(e.target.value)} aria-label="Plant filter">
            {(plants.data || []).length > 1 && <option value="">All authorised plants</option>}
            {(plants.data || []).map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </div>
      </header>

      <main className="mf-main">
        {tab === "dashboard" && <Dashboard plantCode={plantCode} onNavigate={setTab} />}
        {tab === "work" && (
          <WorkOrders
            plantCode={plantCode}
            notify={notify}
            plants={plants.data || []}
            canCoordinate={canCoordinate}
            canManageMasters={canManageMasters}
            canExecute={canExecute}
            isRequester={isRequester}
            username={username}
          />
        )}
        {tab === "calendar" && <MaintenanceCalendar plantCode={plantCode} />}
        {tab === "equipment" && (
          <Equipment
            plantCode={plantCode}
            notify={notify}
            plants={plants.data || []}
            canManageMasters={canManageMasters}
          />
        )}
        {tab === "reports" && canViewReports && <Reports plantCode={plantCode} />}
        {tab === "config" && canManageMasters && (
          <Configuration plantCode={plantCode} notify={notify} plants={plants.data || []} isAdmin={isAdmin} />
        )}
      </main>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function QrComplaintPortal({ token, username, onOpenMachFlow }) {
  const equipment = useAsync(() => machFlowApi.qrEquipment(token), [token]);
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
      const result = await machFlowApi.createQrComplaint(token, form);
      setSubmitted(result);
    } catch (error) {
      setSubmitted({ error: errorText(error) });
    } finally {
      setSaving(false);
    }
  };

  if (submitted && !submitted.error) {
    return (
      <main className="mf-qr-page">
        <section className="mf-mobile-card mf-success-card">
          <div className="mf-mobile-icon">✓</div>
          <p className="mf-eyebrow">Complaint registered</p>
          <h1>{submitted.workNumber}</h1>
          <p>{submitted.title}</p>
          <div className="mf-mobile-status-grid">
            <Detail label="Machine" value={submitted.equipmentName} />
            <Detail label="Status" value={human(submitted.status)} />
            <Detail label="Assigned to" value={submitted.responsible || "Maintenance queue"} />
            <Detail label="Scheduled" value={fmtDate(submitted.scheduledAt, true)} />
          </div>
          <Button variant="primary" onClick={onOpenMachFlow}>Open MachFlow</Button>
        </section>
      </main>
    );
  }

  return (
    <main className="mf-qr-page">
      <section className="mf-mobile-card mf-machine-passport">
        <div className="mf-mobile-card-head">
          <div>
            <p className="mf-eyebrow">Machine QR Passport</p>
            <h1>{machine.name}</h1>
            <p>{machine.assetCode} · {machine.plantCode}{machine.location ? ` · ${machine.location}` : ""}</p>
          </div>
          <StatusBadge status={machine.status} />
        </div>
        <div className="mf-mobile-status-grid">
          <Detail label="Work center" value={machine.workCenter || "—"} />
          <Detail label="Category" value={machine.category || "—"} />
          <Detail label="Maintenance team" value={machine.maintenanceTeam || "—"} />
          <Detail label="Head technician" value={machine.headTechnician || "Unassigned"} />
        </div>
        {machine.safetyNotes && <div className="mf-safety-callout"><strong>Safety note</strong><span>{machine.safetyNotes}</span></div>}
      </section>

      <section className="mf-mobile-card">
        <div className="mf-mobile-card-head">
          <div><p className="mf-eyebrow">Raise corrective complaint</p><h2>What is wrong?</h2><p>Signed in as {username || "FlowSuite user"}. Your identity is recorded automatically.</p></div>
        </div>
        {submitted?.error && <div className="mf-inline-error">{submitted.error}</div>}
        <form onSubmit={submit} className="mf-mobile-form">
          <Field label="Problem title"><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Spindle vibration / machine not starting" /></Field>
          <Field label="Problem description"><textarea required rows="5" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What happened, error code, sound, smell, visible issue…" /></Field>
          <Field label="Machine operator (optional)"><input value={form.operatorName} onChange={(e) => setForm({ ...form, operatorName: e.target.value })} placeholder="If you are reporting for another operator" /></Field>
          <Field label="Operator contact (optional)"><input value={form.operatorContact} onChange={(e) => setForm({ ...form, operatorContact: e.target.value })} placeholder="Mobile / extension" /></Field>
          <Field label="Required attendance time"><input required type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></Field>
          <Field label="Priority"><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{PRIORITIES.map((p) => <option value={p} key={p}>{human(p)}</option>)}</select></Field>
          <div className="mf-mobile-switches">
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

function Dashboard({ plantCode, onNavigate }) {
  const state = useAsync(() => machFlowApi.dashboard(plantCode), [plantCode]);
  if (state.loading) return <Loading />;
  if (state.error) return <ErrorBox error={state.error} onRetry={state.reload} />;

  const data = state.data || {};
  const m = data.metrics || {};
  const statusMax = Math.max(1, ...Object.values(data.byStatus || {}).map(Number));

  return (
    <section className="mf-page">
      <div className="mf-page-head">
        <div>
          <p className="mf-eyebrow">Reliability command center</p>
          <h1>Maintenance Dashboard</h1>
          <p>Actionable machine health, downtime, preventive compliance and technician queue in one view.</p>
        </div>
        <Button variant="primary" onClick={() => onNavigate("work")}>Open work board</Button>
      </div>

      <div className="mf-kpi-grid">
        <Kpi title="Open work orders" value={fmtNumber(m.open)} detail={`${fmtNumber(m.critical)} critical`} tone="blue" />
        <Kpi title="Overdue" value={fmtNumber(m.overdue)} detail={`${fmtNumber(m.waitingParts)} waiting parts`} tone={m.overdue ? "red" : "green"} />
        <Kpi title="PM compliance · 30d" value={`${fmtNumber(m.pmCompliance30, 1)}%`} detail={`${fmtNumber(m.pmDue7)} due in 7 days`} tone={m.pmCompliance30 >= 90 ? "green" : "amber"} />
        <Kpi title="MTTR · 90d" value={`${fmtNumber(m.mttrHours90, 1)}h`} detail={`${fmtNumber(m.breakdowns30)} breakdowns / 30d`} tone="violet" />
        <Kpi title="Downtime · 30d" value={`${fmtNumber(m.downtimeHours30, 1)}h`} detail={`${fmtNumber(m.assetsDown)} assets down`} tone={m.assetsDown ? "red" : "teal"} />
        <Kpi title="Equipment register" value={fmtNumber(m.equipmentCount)} detail={`${fmtNumber(m.warrantyRisk60)} warranties ≤ 60d`} tone="neutral" />
      </div>

      <div className="mf-dashboard-grid">
        <div className="mf-panel mf-span-2">
          <div className="mf-panel-head">
            <div><h2>Work pipeline</h2><p>Active workload by stage</p></div>
          </div>
          <div className="mf-status-bars">
            {Object.entries(data.byStatus || {}).filter(([key]) => !["CANCELLED", "SCRAPPED"].includes(key)).map(([key, value]) => (
              <div className="mf-status-row" key={key}>
                <span>{human(key)}</span>
                <div><i style={{ width: `${(Number(value) / statusMax) * 100}%` }} /></div>
                <strong>{fmtNumber(value)}</strong>
              </div>
            ))}
          </div>
          <div className="mf-section-title"><h3>Open requests by service</h3><span>Unified maintenance intake</span></div>
          <div className="mf-chip-row">
            {Object.entries(data.byServiceDomain || {}).filter(([, value]) => Number(value) > 0).map(([domain, value]) => (
              <Badge key={domain} tone={domain === "MACHINE" ? "blue" : domain === "IT" ? "violet" : domain === "ELECTRICAL" ? "amber" : "teal"}>
                {SERVICE_DOMAIN_LABELS[domain] || human(domain)} · {fmtNumber(value)}
              </Badge>
            ))}
          </div>
        </div>

        <div className="mf-panel">
          <div className="mf-panel-head"><div><h2>Problem assets</h2><p>Breakdowns in the last 90 days</p></div></div>
          <div className="mf-rank-list">
            {(data.topProblemAssets || []).length ? data.topProblemAssets.map((x, i) => (
              <div key={x.name} className="mf-rank-row"><span>{i + 1}</span><strong>{x.name}</strong><Badge tone={x.failures >= 3 ? "red" : "amber"}>{x.failures} failures</Badge></div>
            )) : <EmptyState title="No repeat breakdowns" text="No failure pattern is visible in this window." />}
          </div>
        </div>

        <div className="mf-panel mf-span-3">
          <div className="mf-panel-head"><div><h2>Priority queue</h2><p>Critical and high-priority work first</p></div><Button onClick={() => onNavigate("work")}>View all</Button></div>
          <div className="mf-table-wrap">
            <table className="mf-table">
              <thead><tr><th>Work order</th><th>Equipment</th><th>Plant</th><th>Responsible</th><th>Schedule</th><th>Priority</th><th>Status</th></tr></thead>
              <tbody>
                {(data.priorityQueue || []).map((w) => (
                  <tr key={w.id}>
                    <td><strong>{w.workNumber}</strong><small>{w.title}</small></td>
                    <td>{w.equipmentName || "General maintenance"}</td>
                    <td>{w.plantCode}</td>
                    <td>{w.responsible || "Unassigned"}</td>
                    <td className={cx(w.overdue && "mf-danger-text")}>{fmtDate(w.scheduledAt, true)}</td>
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
    <div className={cx("mf-kpi", `tone-${tone}`)}>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

/* ================================= WORK ORDERS ================================= */

function WorkOrders({ plantCode, notify, plants, canCoordinate, canManageMasters, canExecute, isRequester, username }) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState("kanban");
  const [priority, setPriority] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const state = useAsync(
    () => machFlowApi.workOrders({ plantCode, search, priority, type, status, size: 1000 }),
    [plantCode, search, priority, type, status]
  );
  const equipment = useAsync(() => machFlowApi.equipment({ plantCode }), [plantCode]);
  const teams = useAsync(() => machFlowApi.teams(plantCode), [plantCode]);
  const users = useAsync(() => machFlowApi.users(plantCode), [plantCode]);

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
      const created = await machFlowApi.createWorkOrder(payload);
      notify(created?.responsible ? `Request ${created.workNumber} routed to ${created.responsible}` : `Request ${created.workNumber} created in maintenance queue`);
      setCreateOpen(false);
      state.reload();
    } catch (error) {
      notify(errorText(error), "error");
    }
  };

  if (state.error) return <ErrorBox error={state.error} onRetry={state.reload} />;

  const pageTitle = isRequester ? "My Maintenance Requests" : canExecute && !canCoordinate ? "My Technician Queue" : "Maintenance & Service Work Orders";
  const pageText = isRequester
    ? "Raise controlled Machine, IT, Electrical, Facility or Utility requests and track your own queue."
    : canExecute && !canCoordinate
      ? "Jobs assigned to you. Accept, start, hold for parts and record the repair from desktop or mobile."
      : "Unified plant/service intake with automatic team routing, delegation, execution and verified closure.";

  return (
    <section className="mf-page">
      <div className="mf-page-head compact">
        <div><p className="mf-eyebrow">Real-time maintenance execution</p><h1>{pageTitle}</h1><p>{pageText}</p></div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>+ Raise request</Button>
      </div>

      <div className="mf-toolbar">
        <div className="mf-search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search request, asset, IT issue, requester or technician…" /></div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All stages</option>{[...KANBAN.map(([x]) => x), "CLOSED", "SCRAPPED", "CANCELLED"].map((x) => <option key={x} value={x}>{human(x)}</option>)}</select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)}><option value="">All priorities</option>{PRIORITIES.map((x) => <option key={x} value={x}>{human(x)}</option>)}</select>
        {!isRequester && <select value={type} onChange={(e) => setType(e.target.value)}><option value="">All work types</option>{WORK_TYPES.map((x) => <option key={x} value={x}>{human(x)}</option>)}</select>}
        <div className="mf-segment"><button className={cx(view === "kanban" && "is-active")} onClick={() => setView("kanban")}>Board</button><button className={cx(view === "list" && "is-active")} onClick={() => setView("list")}>List</button></div>
      </div>

      {state.loading ? <Loading /> : view === "kanban" ? (
        <div className="mf-kanban mf-kanban-realflow">
          {KANBAN.map(([key, label]) => (
            <div className="mf-kanban-col" key={key}>
              <div className="mf-kanban-head"><div><strong>{label}</strong><span>{byStatus[key]?.length || 0}</span></div><i /></div>
              <div className="mf-kanban-cards">
                {(byStatus[key] || []).map((w) => <WorkCard key={w.id} w={w} onOpen={() => setSelectedId(w.id)} />)}
                {!byStatus[key]?.length && <div className="mf-kanban-empty">No requests</div>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mf-panel mf-table-wrap">
          <table className="mf-table">
            <thead><tr><th>Work order</th><th>Service / Asset</th><th>Source</th><th>Requested by</th><th>Responsible</th><th>Scheduled</th><th>Response</th><th>Priority</th><th>Status</th><th /></tr></thead>
            <tbody>{items.map((w) => <tr key={w.id}><td><strong>{w.workNumber}</strong><small>{w.title}</small></td><td><strong>{SERVICE_DOMAIN_LABELS[w.serviceDomain] || human(w.serviceDomain)}</strong><small>{w.equipmentName || w.requestCategory || "General request"} · {w.plantCode}{w.workCenter ? ` · ${w.workCenter}` : ""}</small></td><td>{human(w.complaintSource || "WEB")}</td><td>{w.requestedBy || "—"}<small>{w.reporterCode || w.reporterDepartment || ""}</small></td><td>{w.responsible || "Unassigned"}</td><td className={cx(w.overdue && "mf-danger-text")}>{fmtDate(w.scheduledAt, true)}</td><td>{w.responseMinutes != null ? `${w.responseMinutes} min` : "—"}</td><td><PriorityBadge value={w.priority} /></td><td><StatusBadge status={w.status} /></td><td><Button onClick={() => setSelectedId(w.id)}>Open</Button></td></tr>)}</tbody>
          </table>
        </div>
      )}

      {createOpen && <WorkOrderForm onClose={() => setCreateOpen(false)} onSave={saveWork} equipment={equipment.data?.items || []} teams={teams.data || []} users={users.data || []} plants={plants} canCoordinate={canCoordinate} defaultPlant={plantCode} isRequester={isRequester} />}
      {selectedId && <WorkOrderDrawer id={selectedId} onClose={() => setSelectedId(null)} onChanged={() => state.reload()} notify={notify} canExecute={canExecute} canCoordinate={canCoordinate} canManageMasters={canManageMasters} equipment={equipment.data?.items || []} teams={teams.data || []} users={users.data || []} plants={plants} defaultPlant={plantCode} username={username} />}
    </section>
  );
}

function WorkCard({ w, onOpen }) {
  return (
    <article className={cx("mf-work-card", w.overdue && "is-overdue", w.safetyRisk && "is-risk")} onClick={onOpen}>
      <div className="mf-work-card-top"><span>{w.workNumber}</span><PriorityBadge value={w.priority} /></div>
      <h3>{w.title}</h3>
      <p>{w.equipmentName || SERVICE_DOMAIN_LABELS[w.serviceDomain] || "General maintenance"}</p>
      <div className="mf-work-meta"><span>{w.plantCode}{w.workCenter ? ` · ${w.workCenter}` : ""}</span><span>{w.responsible || "Maintenance queue"}</span></div>
      <div className="mf-work-foot"><span className={cx(w.overdue && "mf-danger-text")}>{fmtDate(w.scheduledAt, true)}</span><span>{w.productionStopped ? "Production stopped" : human(w.complaintSource || w.workType)}</span></div>
    </article>
  );
}

function WorkOrderForm({ onClose, onSave, equipment, teams, users, plants, canCoordinate, defaultPlant, isRequester, initial }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_WORK,
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
  const domain = selectedAsset?.serviceDomain || form.serviceDomain || "GENERAL";
  const activeTeams = teams.filter((team) =>
    team.active &&
    (!form.plantCode || !team.plantCode || team.plantCode === form.plantCode) &&
    (!team.serviceDomain || team.serviceDomain === domain)
  );
  const assignableUsers = users.filter((user) =>
    (user.roles || []).some((role) =>
      ["MACHFLOW_MANAGER", "MACHFLOW_PLANNER", "MACHFLOW_HEAD_TECHNICIAN", "MACHFLOW_TECHNICIAN"]
        .includes(String(role).replace(/^ROLE_/i, "").toUpperCase())
    )
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
        workType: isRequester ? "CORRECTIVE" : form.workType,
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
        : "Use an asset when the request belongs to a machine/device, or raise a general IT, electrical, facility or utility request without creating a fake equipment record."}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit}>
        <div className="mf-modal-body mf-form-grid">
          <Field label="Asset / equipment" hint="Optional for general IT, wiring, lights, AC and facility requests.">
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
              disabled={Boolean(selectedAsset)}
              onChange={(e) => setForm((f) => ({ ...f, serviceDomain: e.target.value, teamName: "", responsible: "" }))}
            >
              {SERVICE_DOMAINS.map((value) => <option key={value} value={value}>{SERVICE_DOMAIN_LABELS[value]}</option>)}
            </select>
          </Field>

          <Field label="Issue / request title"><input required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. LAN down / CNC spindle alarm / AC not cooling" /></Field>
          <Field label="Request category"><input value={form.requestCategory} onChange={(e) => set("requestCategory", e.target.value)} placeholder="Breakdown / Internet / Light / AC / Wiring…" /></Field>

          {!isRequester && <Field label="Work type"><select value={form.workType} onChange={(e) => setForm((f) => ({ ...f, workType: e.target.value, breakdown: e.target.value === "CORRECTIVE" }))}>{WORK_TYPES.map((x) => <option key={x} value={x}>{human(x)}</option>)}</select></Field>}
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

          <div className="mf-checks mf-full">
            <label><input type="checkbox" checked={form.breakdown} onChange={(e) => set("breakdown", e.target.checked)} /> Breakdown / failure</label>
            <label><input type="checkbox" checked={form.productionStopped} onChange={(e) => set("productionStopped", e.target.checked)} /> Work / production stopped</label>
            <label><input type="checkbox" checked={form.safetyRisk} onChange={(e) => set("safetyRisk", e.target.checked)} /> Safety risk</label>
          </div>
        </div>
        <div className="mf-modal-actions"><Button type="button" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={saving}>{saving ? "Saving…" : initial ? "Save planning" : "Submit request"}</Button></div>
      </form>
    </Modal>
  );
}

function WorkOrderDrawer({ id, onClose, onChanged, notify, canExecute, canCoordinate, canManageMasters, equipment, teams, users, plants, defaultPlant }) {
  const state = useAsync(() => machFlowApi.workOrder(id), [id]);
  const [actionOpen, setActionOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  if (state.loading) return <div className="mf-drawer"><Loading /></div>;
  if (state.error) return <div className="mf-drawer"><ErrorBox error={state.error} onRetry={state.reload} /></div>;
  const w = state.data;

  const move = async (target, details = {}) => {
    try {
      await machFlowApi.changeStatus(id, { status: target, note: details.note || `Status moved to ${human(target)}`, version: w.version, ...details });
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
      await machFlowApi.updateWorkOrder(id, { ...payload, version: w.version });
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
      await machFlowApi.assignWorkOrder(id, payload);
      notify(`Assigned to ${payload.responsible}`);
      setAssignOpen(false);
      await state.reload();
      onChanged();
    } catch (error) {
      notify(errorText(error), "error");
    }
  };

  return (
    <div className="mf-drawer-backdrop" onMouseDown={onClose}>
      <aside className="mf-drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mf-drawer-head"><div><span>{w.workNumber}</span><h2>{w.title}</h2></div><button className="mf-icon-btn" onClick={onClose}>×</button></div>
        <div className="mf-drawer-status"><StatusBadge status={w.status} /><PriorityBadge value={w.priority} /><Badge tone="neutral">{human(w.complaintSource || "WEB")}</Badge>{w.overdue && <Badge tone="red">Overdue</Badge>}{w.productionStopped && <Badge tone="red">Production stopped</Badge>}{w.safetyRisk && <Badge tone="red">Safety risk</Badge>}</div>
        <div className="mf-stage-strip mf-stage-strip-real">{KANBAN.map(([key, label]) => <div key={key} className={cx(key === w.status && "is-current")}>{label}</div>)}</div>
        <div className="mf-drawer-body">
          <div className="mf-detail-grid">
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

          <div className="mf-cost-row"><span>Parts <strong>{fmtMoney(w.partsCost)}</strong></span><span>Labour <strong>{fmtMoney(w.laborCost)}</strong></span><span>External <strong>{fmtMoney(w.externalCost)}</strong></span><span>Total <strong>{fmtMoney(w.totalCost)}</strong></span></div>

          <div className="mf-section-title"><h3>Activity timeline</h3><span>{w.audit?.length || 0} events</span></div>
          <div className="mf-timeline">
            {(w.audit || []).map((a) => <div key={a.id} className="mf-timeline-item"><i /><div><strong>{human(a.action)}</strong><span>{a.actor || "System"} · {fmtDate(a.createdAt, true)}</span>{a.fromStatus && a.toStatus && <p>{human(a.fromStatus)} → {human(a.toStatus)}</p>}{a.note && <p>{a.note}</p>}</div></div>)}
          </div>
        </div>
        <div className="mf-drawer-actions">
          {canCoordinate && <Button onClick={() => setAssignOpen(true)}>Assign / Delegate</Button>}
          {canManageMasters && <Button onClick={() => setEditOpen(true)}>Edit Planning</Button>}
          {(w.allowedTransitions || []).map((target) => {
            const completion = target === "REPAIRED" || target === "CLOSED" || target === "WAITING_PARTS" || target === "CANCELLED" || target === "SCRAPPED";
            const primary = target === "ACCEPTED" || target === "IN_PROGRESS" || target === "REPAIRED" || target === "CLOSED";
            return <Button key={target} variant={primary ? "primary" : "default"} onClick={() => completion ? setActionOpen(target) : move(target)}>{target === "ACCEPTED" ? "Accept Job" : target === "IN_PROGRESS" ? "Start Work" : human(target)}</Button>;
          })}
        </div>
        {canManageMasters && editOpen && <WorkOrderForm initial={w} onClose={() => setEditOpen(false)} onSave={saveEdit} equipment={equipment} teams={teams} users={users} plants={plants} canCoordinate={true} defaultPlant={defaultPlant} isRequester={false} />}
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
        <div className="mf-modal-body mf-form-grid">
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
        <div className="mf-modal-actions"><Button type="button" onClick={onClose}>Cancel</Button><Button variant="primary">Confirm {human(status)}</Button></div>
      </form>
    </Modal>
  );
}

function Detail({ label, value, danger }) {
  return <div className="mf-detail"><span>{label}</span><strong className={cx(danger && "mf-danger-text")}>{value || "—"}</strong></div>;
}

function DetailBlock({ title, text }) {
  if (!text) return null;
  return <div className="mf-detail-block"><span>{title}</span><p>{text}</p></div>;
}

/* ================================= CALENDAR ================================= */

function MaintenanceCalendar({ plantCode }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const from = dateInput(weekStart);
  const to = dateInput(addDays(weekStart, 6));
  const state = useAsync(() => machFlowApi.calendar({ plantCode, from, to }), [plantCode, from, to]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const grouped = useMemo(() => {
    const g = {};
    (state.data || []).forEach((e) => { (g[String(e.date)] ||= []).push(e); });
    return g;
  }, [state.data]);

  return (
    <section className="mf-page">
      <div className="mf-page-head compact"><div><p className="mf-eyebrow">Preventive planning & workload</p><h1>Maintenance Calendar</h1><p>Weekly schedule with planned jobs and upcoming PM due dates.</p></div><div className="mf-inline-actions"><Button onClick={() => setWeekStart(startOfWeek(new Date()))}>Today</Button><Button onClick={() => setWeekStart(addDays(weekStart, -7))}>←</Button><Button onClick={() => setWeekStart(addDays(weekStart, 7))}>→</Button></div></div>
      {state.error ? <ErrorBox error={state.error} onRetry={state.reload} /> : state.loading ? <Loading /> : (
        <div className="mf-calendar">
          {days.map((day) => {
            const key = dateInput(day);
            const events = grouped[key] || [];
            return <div className={cx("mf-day", key === dateInput(new Date()) && "is-today")} key={key}><div className="mf-day-head"><span>{day.toLocaleDateString("en-IN", { weekday: "short" })}</span><strong>{day.getDate()}</strong></div><div className="mf-day-events">{events.map((e) => <div key={`${e.kind}-${e.id}`} className={cx("mf-event", e.kind === "PM_DUE" && "is-pm", e.priority === "CRITICAL" && "is-critical")}><span>{e.kind === "PM_DUE" ? "PM due" : e.number}</span><strong>{e.title}</strong><small>{e.equipment || ""}</small><small>{e.responsible || "Unassigned"}</small>{e.start && <small>{fmtDate(e.start, true)}</small>}</div>)}{!events.length && <div className="mf-day-empty">No scheduled work</div>}</div></div>;
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

function Equipment({ plantCode, notify, plants, canManageMasters }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const state = useAsync(() => machFlowApi.equipment({ plantCode, status, search }), [plantCode, status, search]);
  const teams = useAsync(() => machFlowApi.teams(plantCode), [plantCode]);
  const users = useAsync(() => machFlowApi.users(plantCode), [plantCode]);

  const save = async (payload) => {
    try {
      await machFlowApi.createEquipment(payload);
      notify("Equipment added to MachFlow and its machine QR link is ready");
      setCreateOpen(false);
      state.reload();
    } catch (error) {
      notify(errorText(error), "error");
    }
  };

  return (
    <section className="mf-page">
      <div className="mf-page-head compact">
        <div>
          <p className="mf-eyebrow">Asset reliability register</p>
          <h1>Asset / Equipment Master</h1>
          <p>One controlled record per maintainable asset—production machine, IT asset, electrical/facility equipment or utility—with service routing, QR identity and reliability history.</p>
        </div>
        {canManageMasters && <Button variant="primary" onClick={() => setCreateOpen(true)}>+ Add equipment</Button>}
      </div>

      <div className="mf-toolbar">
        <div className="mf-search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search asset code, machine/device, work center, model, serial or category…" /></div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All equipment states</option>{EQUIPMENT_STATUSES.map((x) => <option key={x} value={x}>{human(x)}</option>)}</select>
      </div>

      {state.error ? <ErrorBox error={state.error} onRetry={state.reload} /> : state.loading ? <Loading /> : (
        <div className="mf-equipment-grid">
          {(state.data?.items || []).map((e) => (
            <article className={cx("mf-equipment-card", e.status === "DOWN" && "is-down")} key={e.id} onClick={() => setSelectedId(e.id)}>
              <div className="mf-equipment-top"><span>{e.assetCode}</span><div className="mf-inline-actions"><span className="mf-service-domain-tag">{SERVICE_DOMAIN_LABELS[e.serviceDomain] || human(e.serviceDomain)}</span><StatusBadge status={e.status} /></div></div>
              <h3>{e.name}</h3>
              <p>{[human(e.assetKind), e.category, e.manufacturer, e.model].filter(Boolean).join(" · ") || "Uncategorized asset"}</p>
              <div className="mf-equipment-meta">
                <span><small>Plant</small><strong>{e.plantCode}</strong></span>
                <span><small>Work center</small><strong>{e.workCenter || e.location || "—"}</strong></span>
                <span><small>Criticality</small><strong>{human(e.criticality)}</strong></span>
              </div>
              <div className="mf-equipment-foot">
                <span>{e.openWorkOrders ? `${e.openWorkOrders} open work orders` : "No open work"}</span>
                <span>{e.qrEnabled ? "QR reporting active" : "QR disabled"}</span>
              </div>
            </article>
          ))}
          {!state.data?.items?.length && <EmptyState title="No equipment found" text="Add the first machine or change the current filters." />}
        </div>
      )}

      {canManageMasters && createOpen && <EquipmentForm onClose={() => setCreateOpen(false)} onSave={save} teams={teams.data || []} users={users.data || []} plants={plants} defaultPlant={plantCode} />}
      {selectedId && <EquipmentDrawer id={selectedId} onClose={() => setSelectedId(null)} notify={notify} canManageMasters={canManageMasters} />}
    </section>
  );
}

function EquipmentForm({ onClose, onSave, teams, users, plants, defaultPlant }) {
  const [form, setForm] = useState({ ...EMPTY_EQUIPMENT, plantCode: defaultPlant || "" });
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const serviceTeams = teams.filter((team) =>
    team.active &&
    (!form.plantCode || !team.plantCode || team.plantCode === form.plantCode) &&
    (!team.serviceDomain || team.serviceDomain === form.serviceDomain)
  );
  const maintenanceUsers = users.filter((u) => (u.roles || []).some((r) =>
    ["MACHFLOW_MANAGER", "MACHFLOW_PLANNER", "MACHFLOW_HEAD_TECHNICIAN", "MACHFLOW_TECHNICIAN"]
      .includes(String(r).replace(/^ROLE_/i, "").toUpperCase())
  ));

  const defaultKindForDomain = (domain) => ({
    MACHINE: "PRODUCTION_MACHINE",
    IT: "IT_ASSET",
    ELECTRICAL: "ELECTRICAL_ASSET",
    FACILITY: "FACILITY_ASSET",
    UTILITY: "UTILITY_ASSET",
    GENERAL: "OTHER",
  }[domain] || "OTHER");

  return (
    <Modal title="Add maintainable asset" subtitle="Create the permanent identity used by preventive plans, repair history, service routing and controlled QR requests." onClose={onClose} wide>
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
        } finally { setSaving(false); }
      }}>
        <div className="mf-modal-body mf-form-grid">
          <Field label="Asset code"><input required value={form.assetCode} onChange={(e) => set("assetCode", e.target.value)} placeholder="AKG-CNC-001 / IT-LAP-021" /></Field>
          <Field label="Asset / equipment name"><input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="HOMAG NMC-112 / Design Laptop 21" /></Field>

          <Field label="Service domain">
            <select value={form.serviceDomain} onChange={(e) => {
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
          <Field label="Asset kind"><select value={form.assetKind} onChange={(e) => set("assetKind", e.target.value)}>{ASSET_KINDS.map((value) => <option key={value} value={value}>{human(value)}</option>)}</select></Field>

          <Field label="Category"><input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="CNC Router / Laptop / AC / Compressor…" /></Field>
          <Field label="Criticality"><select value={form.criticality} onChange={(e) => set("criticality", e.target.value)}>{CRITICALITIES.map((x) => <option key={x} value={x}>{human(x)}</option>)}</select></Field>

          <Field label="Plant"><select required value={form.plantCode} onChange={(e) => setForm((current) => ({ ...current, plantCode: e.target.value, maintenanceTeam: "", primaryTechnician: "" }))}><option value="">Select plant</option>{plants.map((plant) => <option key={plant.name} value={plant.name}>{plant.name}</option>)}</select></Field>
          <Field label="Work center / department"><input value={form.workCenter} onChange={(e) => set("workCenter", e.target.value)} placeholder="CNC Bay / Design / Accounts / Utility Room…" /></Field>
          <Field label="Physical location"><input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Line 2 · Bay 4 / First floor cabin…" /></Field>
          <Field label="Owner / using department"><input value={form.owner} onChange={(e) => set("owner", e.target.value)} placeholder="K&W Production / Design / Accounts" /></Field>

          <Field label="Service / maintenance team" hint={`Only teams configured for ${SERVICE_DOMAIN_LABELS[form.serviceDomain]} are shown.`}><select value={form.maintenanceTeam} onChange={(e) => set("maintenanceTeam", e.target.value)}><option value="">Use plant/domain default team</option>{serviceTeams.map((t) => <option key={t.id} value={t.name}>{t.name}{t.defaultForPlant ? " · Default" : ""}</option>)}</select></Field>
          <Field label="Default technician / head" hint="Optional asset-level override. Normal routing goes to the service team's head."><select value={form.primaryTechnician} onChange={(e) => set("primaryTechnician", e.target.value)}><option value="">Use service team head</option>{maintenanceUsers.map((u) => <option key={u.username} value={u.username}>{u.displayName || u.username}</option>)}</select></Field>

          <Field label="Manufacturer"><input value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} /></Field>
          <Field label="Model"><input value={form.model} onChange={(e) => set("model", e.target.value)} /></Field>
          <Field label="Serial number"><input value={form.serialNumber} onChange={(e) => set("serialNumber", e.target.value)} /></Field>
          <Field label="Asset state"><select value={form.status} onChange={(e) => set("status", e.target.value)}>{EQUIPMENT_STATUSES.map((x) => <option key={x} value={x}>{human(x)}</option>)}</select></Field>

          <Field label="Purchase date"><input type="date" value={form.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} /></Field>
          <Field label="Commissioned date"><input type="date" value={form.commissionedDate} onChange={(e) => set("commissionedDate", e.target.value)} /></Field>
          <Field label="Warranty expiry"><input type="date" value={form.warrantyExpiry} onChange={(e) => set("warrantyExpiry", e.target.value)} /></Field>

          <div className="mf-checks"><label><input type="checkbox" checked={form.qrEnabled} onChange={(e) => set("qrEnabled", e.target.checked)} /> Enable controlled asset QR request link</label></div>
          <Field label="Description"><textarea rows="3" value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
          <Field label="Safety / isolation / support notes"><textarea rows="3" value={form.safetyNotes} onChange={(e) => set("safetyNotes", e.target.value)} placeholder="LOTO point, electrical isolation, admin credentials owner, network point, access note…" /></Field>
        </div>
        <div className="mf-modal-actions"><Button type="button" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={saving}>{saving ? "Saving…" : "Add asset"}</Button></div>
      </form>
    </Modal>
  );
}

function EquipmentDrawer({ id, onClose, notify, canManageMasters }) {
  const state = useAsync(() => machFlowApi.equipmentOne(id), [id]);
  if (state.loading) return <div className="mf-drawer"><Loading /></div>;
  if (state.error) return <div className="mf-drawer"><ErrorBox error={state.error} onRetry={state.reload} /></div>;
  const e = state.data;
  const h = e.health || {};
  const qrUrl = e.qrPath && typeof window !== "undefined" ? `${window.location.origin}${e.qrPath}` : "";

  const copyQrLink = async () => {
    if (!qrUrl) return;
    try {
      await navigator.clipboard.writeText(qrUrl);
      notify("Machine complaint link copied. Encode this URL in the QR label pasted on the machine.");
    } catch {
      notify("Clipboard is unavailable. Select and copy the QR URL manually.", "error");
    }
  };

  const rotateQr = async () => {
    if (!window.confirm("Rotate this machine QR token? The old QR label/link will immediately stop working.")) return;
    try {
      await machFlowApi.rotateEquipmentQr(e.id, { version: e.version });
      notify("Machine QR token rotated. Print a replacement QR label.");
      state.reload();
    } catch (error) { notify(errorText(error), "error"); }
  };

  return (
    <div className="mf-drawer-backdrop" onMouseDown={onClose}>
      <aside className="mf-drawer" onMouseDown={(x) => x.stopPropagation()}>
        <div className="mf-drawer-head"><div><span>{e.assetCode}</span><h2>{e.name}</h2></div><button className="mf-icon-btn" onClick={onClose}>×</button></div>
        <div className="mf-drawer-status"><StatusBadge status={e.status} /><Badge tone={h.score >= 85 ? "green" : h.score >= 65 ? "amber" : "red"}>Health {h.score ?? 0}/100 · {h.label || "No history"}</Badge>{e.qrEnabled && <Badge tone="teal">QR active</Badge>}</div>
        <div className="mf-drawer-body">
          <div className="mf-health-grid"><Kpi title="MTTR" value={`${fmtNumber(h.mttrHours, 1)}h`} detail="90-day average" tone="violet" /><Kpi title="MTBF" value={`${fmtNumber(h.mtbfDays, 1)}d`} detail="between failures" tone="teal" /><Kpi title="Open work" value={fmtNumber(h.openWorkOrders)} detail={`${fmtNumber(h.failures30)} failures / 30d`} tone={h.openWorkOrders ? "amber" : "green"} /></div>
          <div className="mf-detail-grid">
            <Detail label="Category" value={e.category} /><Detail label="Plant" value={e.plantCode} />
            <Detail label="Work center" value={e.workCenter} /><Detail label="Location" value={e.location} />
            <Detail label="Maintenance team" value={e.maintenanceTeam || "Plant default"} /><Detail label="Default technician" value={e.primaryTechnician || "Team head"} />
            <Detail label="Manufacturer / Model" value={[e.manufacturer, e.model].filter(Boolean).join(" · ")} /><Detail label="Serial number" value={e.serialNumber} />
            <Detail label="Owner / Department" value={e.owner} /><Detail label="Warranty expiry" value={fmtDate(e.warrantyExpiry)} />
            <Detail label="Last maintenance" value={fmtDate(e.lastMaintenanceAt, true)} /><Detail label="Next PM" value={fmtDate(e.nextMaintenanceAt, true)} />
          </div>

          {e.qrEnabled && <div className="mf-qr-control-card">
            <div><span>Machine QR complaint route</span><strong>Scan machine → identify asset → raise complaint → auto-route to plant maintenance head</strong></div>
            <div className="mf-qr-label-print">
              <MachineQr value={qrUrl} />
              <div className="mf-qr-label-copy">
                <strong>{e.assetCode}</strong>
                <span>{e.name}</span>
                <small>{e.plantCode}{e.workCenter ? ` · ${e.workCenter}` : ""}</small>
                <b>SCAN TO REPORT MACHINE MAINTENANCE</b>
              </div>
            </div>
            <input readOnly value={qrUrl} aria-label="Machine QR URL" />
            <div className="mf-inline-actions">
              <Button onClick={copyQrLink}>Copy QR link</Button>
              <Button onClick={() => window.print()}>Print QR label</Button>
              {qrUrl && <Button onClick={() => window.open(qrUrl, "_blank", "noopener,noreferrer")}>Test complaint view</Button>}
              {canManageMasters && <Button onClick={rotateQr}>Rotate token</Button>}
            </div>
            <small>QR is generated locally inside the browser; no machine token is sent to an external QR service. Rotating the token invalidates every previously printed label for this machine.</small>
          </div>}

          <DetailBlock title="Description" text={e.description} />
          <DetailBlock title="Safety / isolation notes" text={e.safetyNotes} />

          <div className="mf-section-title"><h3>Recent maintenance</h3><span>{e.recentWorkOrders?.length || 0} shown</span></div>
          <div className="mf-mini-list">{(e.recentWorkOrders || []).map((w) => <div key={w.id}><strong>{w.workNumber} · {w.title}</strong><span>{human(w.status)} · {fmtDate(w.scheduledAt, true)} · {w.responsible || "Unassigned"}</span></div>)}</div>

          <div className="mf-section-title"><h3>Preventive plans</h3><span>{e.plans?.length || 0} linked</span></div>
          <div className="mf-mini-list">{(e.plans || []).map((p) => <div key={p.id}><strong>{p.title}</strong><span>Every {p.intervalDays} days · Next {fmtDate(p.nextDueDate)} {p.scheduledTime ? `at ${String(p.scheduledTime).slice(0, 5)}` : ""}</span></div>)}</div>
        </div>
      </aside>
    </div>
  );
}


function Reports({ plantCode }) {
  const [from, setFrom] = useState(() => dateInput(addDays(new Date(), -180)));
  const [to, setTo] = useState(() => dateInput(new Date()));
  const state = useAsync(() => machFlowApi.reports({ plantCode, from, to }), [plantCode, from, to]);
  if (state.error) return <ErrorBox error={state.error} onRetry={state.reload} />;
  const data = state.data || {};
  const summary = data.summary || {};
  const maxMonthly = Math.max(1, ...(data.monthly || []).map((m) => Number(m.opened || 0)));
  return (
    <section className="mf-page">
      <div className="mf-page-head compact"><div><p className="mf-eyebrow">Maintenance intelligence</p><h1>Maintenance & Reliability Reports</h1><p>Compare service domains, failure concentration, cost and technician workload across Machine, IT, Electrical, Facility and Utility maintenance.</p></div><div className="mf-date-range"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><span>to</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div></div>
      {state.loading ? <Loading /> : <><div className="mf-kpi-grid four"><Kpi title="Work orders" value={fmtNumber(summary.orders)} detail={`${fmtNumber(summary.completed)} completed`} tone="blue" /><Kpi title="Planned maintenance mix" value={`${fmtNumber(summary.plannedRatio, 1)}%`} detail={`${fmtNumber(summary.preventive)} preventive`} tone="green" /><Kpi title="Corrective work" value={fmtNumber(summary.corrective)} detail="failure-driven jobs" tone="amber" /><Kpi title="Maintenance cost" value={fmtMoney(summary.totalCost)} detail="parts + labour + external" tone="violet" /></div><div className="mf-dashboard-grid"><div className="mf-panel mf-span-2"><div className="mf-panel-head"><div><h2>Monthly work trend</h2><p>Opened vs closed maintenance</p></div></div><div className="mf-month-chart">{(data.monthly || []).map((m) => <div className="mf-month-bar" key={m.month}><div><i style={{ height: `${Math.max(4, (m.opened / maxMonthly) * 100)}%` }} /><b style={{ height: `${Math.max(4, (m.closed / maxMonthly) * 100)}%` }} /></div><span>{m.month.slice(2)}</span></div>)}</div></div><div className="mf-panel"><div className="mf-panel-head"><div><h2>Top failure assets</h2><p>Where reliability action is needed</p></div></div><div className="mf-rank-list">{(data.byEquipment || []).slice(0, 8).map((a, i) => <div className="mf-rank-row" key={a.name}><span>{i + 1}</span><strong>{a.name}</strong><Badge tone={a.failures >= 3 ? "red" : "amber"}>{a.failures}</Badge></div>)}</div></div><div className="mf-panel mf-span-3 mf-table-wrap"><div className="mf-panel-head"><div><h2>Service-domain workload</h2><p>Machine, IT, Electrical, Facility and Utility request mix</p></div></div><table className="mf-table"><thead><tr><th>Service</th><th>Requests</th><th>Completed</th><th>Open</th><th>Downtime</th><th>Cost</th></tr></thead><tbody>{(data.byServiceDomain || []).map((row) => <tr key={row.serviceDomain}><td><strong>{SERVICE_DOMAIN_LABELS[row.serviceDomain] || human(row.serviceDomain)}</strong></td><td>{row.orders}</td><td>{row.completed}</td><td>{row.open}</td><td>{row.downtimeHours}h</td><td>{fmtMoney(row.cost)}</td></tr>)}</tbody></table></div><div className="mf-panel mf-span-3 mf-table-wrap"><div className="mf-panel-head"><div><h2>Technician performance</h2><p>Completion, repair time and downtime exposure</p></div></div><table className="mf-table"><thead><tr><th>Technician</th><th>Assigned</th><th>Completed</th><th>Avg repair</th><th>Downtime handled</th></tr></thead><tbody>{(data.byTechnician || []).map((t) => <tr key={t.name}><td><strong>{t.name}</strong></td><td>{t.orders}</td><td>{t.closed}</td><td>{t.avgRepairHours}h</td><td>{t.downtimeHours}h</td></tr>)}</tbody></table></div></div></>}
    </section>
  );
}

/* ================================= CONFIGURATION ================================= */

function Configuration({ plantCode, notify, plants }) {
  const [section, setSection] = useState("teams");
  const [teamOpen, setTeamOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [reporterOpen, setReporterOpen] = useState(null);

  const teams = useAsync(() => machFlowApi.teams(plantCode), [plantCode]);
  const reporters = useAsync(() => machFlowApi.reporters(plantCode, false), [plantCode]);
  const plans = useAsync(() => machFlowApi.plans(plantCode, false), [plantCode]);
  const equipment = useAsync(() => machFlowApi.equipment({ plantCode }), [plantCode]);
  const users = useAsync(() => machFlowApi.users(plantCode), [plantCode]);

  const generate = async () => {
    try {
      const result = await machFlowApi.generateDuePlans();
      notify(`${result.created || 0} preventive work orders generated`);
      plans.reload();
    } catch (error) { notify(errorText(error), "error"); }
  };

  const copyDeskLink = async (team) => {
    if (!team?.requestPath || typeof window === "undefined") return;
    const value = `${window.location.origin}${team.requestPath}`;
    try {
      await navigator.clipboard.writeText(value);
      notify(`${SERVICE_DOMAIN_LABELS[team.serviceDomain] || "Service"} request link copied`);
    } catch {
      notify(value, "error");
    }
  };

  return (
    <section className="mf-page">
      <div className="mf-page-head compact">
        <div>
          <p className="mf-eyebrow">Master data, access & automation</p>
          <h1>Maintenance Configuration</h1>
          <p>
            Full FlowSuite users are reserved for maintenance staff who need the application. Occasional workers, operators, supervisors and back-office staff can use controlled Reporter Passes instead of creating dozens of application accounts.
          </p>
        </div>
      </div>

      <div className="mf-config-tabs">
        <button className={cx(section === "teams" && "is-active")} onClick={() => setSection("teams")}>Service Teams & Routing</button>
        <button className={cx(section === "reporters" && "is-active")} onClick={() => setSection("reporters")}>Reporter Passes</button>
        <button className={cx(section === "plans" && "is-active")} onClick={() => setSection("plans")}>Preventive Plans</button>
      </div>

      {section === "teams" && (
        <div className="mf-panel">
          <div className="mf-panel-head">
            <div>
              <h2>Plant + service routing</h2>
              <p>Configure separate Machine, IT, Electrical, Facility and Utility teams. Each plant/domain can have its own default route; IT may also be company-wide.</p>
            </div>
            <Button variant="primary" onClick={() => setTeamOpen(true)}>+ New service team</Button>
          </div>
          <div className="mf-team-grid">
            {(teams.data || []).map((team) => (
              <div className="mf-team-card" key={team.id}>
                <div>
                  <strong>{team.name}</strong>
                  <div className="mf-inline-actions">
                    <span className="mf-service-domain-tag">{SERVICE_DOMAIN_LABELS[team.serviceDomain] || human(team.serviceDomain)}</span>
                    {team.defaultForPlant && <Badge tone="blue">Default route</Badge>}
                    <StatusBadge status={team.active ? "ACTIVE" : "RETIRED"} />
                  </div>
                </div>
                <p>{team.plantCode || "Company-wide"}</p>
                <span>Head / Lead: {team.lead || "Not assigned"}</span>
                <div className="mf-chip-row">{(team.members || []).slice(0, 10).map((member) => <Badge key={member}>{member}</Badge>)}</div>
                {team.publicReportingEnabled && team.requestPath && (
                  <div className="mf-service-desk-mini">
                    <MachineQr value={`${window.location.origin}${team.requestPath}`} size={82} />
                    <div>
                      <strong>Service Desk QR enabled</strong>
                      <span>Approved Reporter Pass holders can raise {SERVICE_DOMAIN_LABELS[team.serviceDomain] || human(team.serviceDomain)} requests without a FlowSuite account.</span>
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

      {section === "reporters" && (
        <div className="mf-panel">
          <div className="mf-panel-head">
            <div>
              <h2>Controlled Reporter Pass directory</h2>
              <p>These are not FlowSuite users. They have no module access, no password and no permission beyond submitting requests for their assigned plant/service domains with a PIN.</p>
            </div>
            <Button variant="primary" onClick={() => setReporterOpen(EMPTY_REPORTER)}>+ New Reporter Pass</Button>
          </div>
          <div className="mf-table-wrap">
            <table className="mf-reporter-table">
              <thead><tr><th>Reporter</th><th>Type</th><th>Plant / Department</th><th>Allowed services</th><th>Valid until</th><th>Status</th><th>Last request</th><th /></tr></thead>
              <tbody>
                {(reporters.data || []).map((reporter) => (
                  <tr key={reporter.id}>
                    <td><strong>{reporter.displayName}</strong><small>{reporter.reporterCode}</small></td>
                    <td>{human(reporter.reporterType)}</td>
                    <td>{reporter.plantCode}<small>{reporter.department || "—"}</small></td>
                    <td><div className="mf-chip-row">{(reporter.allowedDomains || []).map((domain) => <span className="mf-service-domain-tag" key={domain}>{SERVICE_DOMAIN_LABELS[domain] || human(domain)}</span>)}</div></td>
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
        <div className="mf-panel">
          <div className="mf-panel-head">
            <div><h2>Preventive maintenance plans</h2><p>Recurring PMs are generated before due date, scheduled to the defined time and routed by the asset's plant/service domain.</p></div>
            <div className="mf-inline-actions"><Button onClick={generate}>Generate due now</Button><Button variant="primary" onClick={() => setPlanOpen(true)}>+ New PM plan</Button></div>
          </div>
          <div className="mf-table-wrap">
            <table className="mf-table">
              <thead><tr><th>Asset</th><th>Plan</th><th>Cycle</th><th>Schedule</th><th>Est.</th><th>Route</th><th>Shutdown</th><th>Status</th></tr></thead>
              <tbody>{(plans.data || []).map((plan) => (
                <tr key={plan.id}>
                  <td>{plan.equipmentName}</td>
                  <td><strong>{plan.title}</strong><small>{plan.checklistText ? "Checklist configured" : "No checklist"}</small></td>
                  <td>Every {plan.intervalDays}d<small>Generate {plan.leadDays}d before</small></td>
                  <td className={cx(new Date(plan.nextDueDate) < new Date() && "mf-danger-text")}>{fmtDate(plan.nextDueDate)}<small>{plan.scheduledTime ? String(plan.scheduledTime).slice(0, 5) : "Time not set"}</small></td>
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

      {teamOpen && <TeamForm defaultPlant={plantCode} plants={plants} users={users.data || []} onClose={() => setTeamOpen(false)} onSave={async (payload) => {
        try {
          await machFlowApi.createTeam(payload);
          notify("Service team created");
          setTeamOpen(false);
          teams.reload();
        } catch (error) { notify(errorText(error), "error"); }
      }} />}

      {reporterOpen && <ReporterForm initial={reporterOpen?.id ? reporterOpen : null} defaultPlant={plantCode} plants={plants} onClose={() => setReporterOpen(null)} onSave={async (payload) => {
        try {
          if (reporterOpen?.id) await machFlowApi.updateReporter(reporterOpen.id, payload);
          else await machFlowApi.createReporter(payload);
          notify(reporterOpen?.id ? "Reporter Pass updated" : "Reporter Pass created");
          setReporterOpen(null);
          reporters.reload();
        } catch (error) { notify(errorText(error), "error"); }
      }} />}

      {planOpen && <PlanForm equipment={equipment.data?.items || []} teams={teams.data || []} users={users.data || []} onClose={() => setPlanOpen(false)} onSave={async (payload) => {
        try {
          await machFlowApi.createPlan(payload);
          notify("Preventive maintenance plan created");
          setPlanOpen(false);
          plans.reload();
        } catch (error) { notify(errorText(error), "error"); }
      }} />}
    </section>
  );
}

function TeamForm({ defaultPlant, plants, users, onClose, onSave }) {
  const [form, setForm] = useState({ ...EMPTY_TEAM, plantCode: defaultPlant || "" });
  const normalizeUserRoles = (user) => (user.roles || []).map((role) => String(role || "").replace(/^ROLE_/i, "").toUpperCase());
  const heads = users.filter((user) => normalizeUserRoles(user).some((role) => ["MACHFLOW_MANAGER", "MACHFLOW_HEAD_TECHNICIAN"].includes(role)));
  const members = users.filter((user) => normalizeUserRoles(user).some((role) => ["MACHFLOW_MANAGER", "MACHFLOW_PLANNER", "MACHFLOW_HEAD_TECHNICIAN", "MACHFLOW_TECHNICIAN"].includes(role)));
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
        <div className="mf-modal-body mf-form-grid">
          <Field label="Team name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="AKG Machine Maintenance / Central IT Support" /></Field>
          <Field label="Service domain"><select value={form.serviceDomain} onChange={(e) => setForm({ ...form, serviceDomain: e.target.value, defaultForPlant: false })}>{SERVICE_DOMAINS.map((value) => <option key={value} value={value}>{SERVICE_DOMAIN_LABELS[value]}</option>)}</select></Field>

          <Field label="Plant" hint="Leave company-wide only for a centrally managed service such as IT if your role allows it.">
            <select value={form.plantCode} onChange={(e) => setForm({ ...form, plantCode: e.target.value, lead: "", membersText: "", defaultForPlant: false })}>
              <option value="">Company-wide / all plants</option>
              {plants.map((plant) => <option key={plant.name} value={plant.name}>{plant.name}</option>)}
            </select>
          </Field>
          <Field label="Head Technician / Service Lead" hint="Must be a MachFlow Head Technician or Manager with access to the plant."><select required value={form.lead} onChange={(e) => setForm({ ...form, lead: e.target.value })}><option value="">Select lead</option>{heads.map((user) => <option key={user.username} value={user.username}>{user.displayName || user.username}</option>)}</select></Field>

          <Field label="Default request categories" hint="Comma-separated suggestions shown when this Service Desk QR is used."><input value={form.defaultCategories} onChange={(e) => setForm({ ...form, defaultCategories: e.target.value })} placeholder="LAN/Internet, PC/Laptop, Printer, Software" /></Field>
          <div className="mf-checks">
            <label><input type="checkbox" disabled={!form.plantCode} checked={form.defaultForPlant} onChange={(e) => setForm({ ...form, defaultForPlant: e.target.checked })} /> Default route for this plant + service</label>
            <label><input type="checkbox" checked={form.publicReportingEnabled} onChange={(e) => setForm({ ...form, publicReportingEnabled: e.target.checked })} /> Enable Service Desk QR / Reporter Pass requests</label>
          </div>

          <Field label="Technicians / members" hint="Only full FlowSuite maintenance users belong here. Occasional complainants belong in Reporter Passes, not this list."><div className="mf-user-select-list">{members.map((user) => <label key={user.username}><input type="checkbox" checked={selectedMembers.includes(user.username)} onChange={() => toggleMember(user.username)} /> {user.displayName || user.username}</label>)}</div></Field>
        </div>
        <div className="mf-modal-actions"><Button type="button" onClick={onClose}>Cancel</Button><Button variant="primary">Create service team</Button></div>
      </form>
    </Modal>
  );
}

function ReporterForm({ initial, defaultPlant, plants, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_REPORTER,
    plantCode: defaultPlant || "",
    ...(initial || {}),
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
        <div className="mf-modal-body mf-form-grid">
          <Field label="Reporter / Employee Code"><input required value={form.reporterCode} onChange={(e) => setForm({ ...form, reporterCode: e.target.value })} placeholder="EMP-0142 / OP-AKG-32" /></Field>
          <Field label="Name"><input required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></Field>
          <Field label="Reporter type"><select value={form.reporterType} onChange={(e) => setForm({ ...form, reporterType: e.target.value })}>{REPORTER_TYPES.map((value) => <option key={value} value={value}>{human(value)}</option>)}</select></Field>
          <Field label="Plant"><select required value={form.plantCode} onChange={(e) => setForm({ ...form, plantCode: e.target.value })}><option value="">Select plant</option>{plants.map((plant) => <option key={plant.name} value={plant.name}>{plant.name}</option>)}</select></Field>
          <Field label="Department / area"><input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Production / Design / Accounts / Store…" /></Field>
          <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label={initial ? "New PIN (leave blank to keep current)" : "Reporter PIN"} hint="4–8 digits. Stored hashed; repeated wrong attempts trigger a temporary lock."><input required={!initial} type="password" inputMode="numeric" minLength={4} maxLength={8} value={form.accessPin} onChange={(e) => setForm({ ...form, accessPin: e.target.value.replace(/\D/g, "") })} /></Field>
          <Field label="Valid until" hint="Optional. Useful for contractors/temporary workers."><input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} /></Field>
          <div className="mf-checks"><label><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Reporter Pass active</label></div>

          <Field label="Allowed request services" hint="Limit a reporter to only the areas they genuinely need.">
            <div className="mf-user-select-list">
              {SERVICE_DOMAINS.map((domain) => (
                <label key={domain}>
                  <input type="checkbox" checked={form.allowedDomains.includes(domain)} onChange={() => toggleDomain(domain)} />
                  {SERVICE_DOMAIN_LABELS[domain]}
                </label>
              ))}
            </div>
          </Field>
        </div>
        <div className="mf-modal-actions"><Button type="button" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={saving}>{saving ? "Saving…" : initial ? "Save Reporter Pass" : "Create Reporter Pass"}</Button></div>
      </form>
    </Modal>
  );
}

function PlanForm({ equipment, teams, users, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_PLAN);
  const selectedEquipment = equipment.find((x) => x.id === form.equipmentId);
  const selectable = users.filter((u) => (u.roles || []).some((r) => ["MACHFLOW_MANAGER", "MACHFLOW_PLANNER", "MACHFLOW_HEAD_TECHNICIAN", "MACHFLOW_TECHNICIAN"].includes(String(r).replace(/^ROLE_/i, "").toUpperCase())));
  const availableTeams = teams.filter((t) =>
    t.active &&
    (!selectedEquipment?.plantCode || !t.plantCode || t.plantCode === selectedEquipment.plantCode) &&
    (!selectedEquipment?.serviceDomain || !t.serviceDomain || t.serviceDomain === selectedEquipment.serviceDomain)
  );

  return (
    <Modal title="New preventive maintenance plan" subtitle="Define the maintenance cycle once. MachFlow will generate and route future PM work automatically." onClose={onClose} wide>
      <form onSubmit={(e) => {
        e.preventDefault();
        onSave({
          ...form,
          intervalDays: Number(form.intervalDays),
          leadDays: Number(form.leadDays),
          estimatedMinutes: Number(form.estimatedMinutes || 0),
        });
      }}>
        <div className="mf-modal-body mf-form-grid">
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
          <div className="mf-checks mf-full"><label><input type="checkbox" checked={form.requiresShutdown} onChange={(e) => setForm({ ...form, requiresShutdown: e.target.checked })} /> Preventive maintenance requires planned machine shutdown</label></div>
          <Field label="Instructions"><textarea rows="4" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Preparation, isolation, tools, lubrication grade, inspection standard…" /></Field>
          <Field label="Checklist" hint="One step per line. It is copied into each generated PM work order."><textarea rows="6" value={form.checklistText} onChange={(e) => setForm({ ...form, checklistText: e.target.value })} placeholder={"Isolate machine\nInspect guards\nCheck lubrication\nClean filters\nTrial run and verify"} /></Field>
        </div>
        <div className="mf-modal-actions"><Button type="button" onClick={onClose}>Cancel</Button><Button variant="primary">Create preventive plan</Button></div>
      </form>
    </Modal>
  );
}

