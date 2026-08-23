import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import machFlowApi from "./machFlowApi";
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
  ["IN_PROGRESS", "In Progress"],
  ["WAITING_PARTS", "Waiting Parts"],
  ["REPAIRED", "Repaired"],
  ["CLOSED", "Closed"],
];

const PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"];
const WORK_TYPES = ["CORRECTIVE", "PREVENTIVE", "INSPECTION", "CALIBRATION", "IMPROVEMENT"];
const EQUIPMENT_STATUSES = ["ACTIVE", "UNDER_MAINTENANCE", "DOWN", "RETIRED"];
const CRITICALITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const EMPTY_WORK = {
  title: "",
  description: "",
  instructions: "",
  equipmentId: "",
  plantCode: "",
  location: "",
  requestedBy: "",
  teamName: "",
  responsible: "",
  workType: "CORRECTIVE",
  priority: "NORMAL",
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
  plantCode: "",
  location: "",
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
  safetyNotes: "",
};

const EMPTY_TEAM = { name: "", plantCode: "", lead: "", membersText: "", active: true };
const EMPTY_PLAN = {
  equipmentId: "",
  title: "",
  intervalDays: 30,
  leadDays: 3,
  nextDueDate: dateInput(new Date()),
  defaultPriority: "NORMAL",
  teamName: "",
  responsible: "",
  instructions: "",
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
  const [tab, setTab] = useState("dashboard");
  const [plantCode, setPlantCode] = useState("");
  const [toast, setToast] = useState(null);
  const plants = useAsync(() => machFlowApi.plants(), []);

  const normalizedRoles = useMemo(
    () => (roles || []).map((role) => String(role || "").replace(/^ROLE_/i, "").toUpperCase()),
    [roles]
  );
  const isAdmin = normalizedRoles.includes("ADMIN");
  const canPlan = isAdmin || normalizedRoles.some((role) => ["MACHFLOW_MANAGER", "MACHFLOW_PLANNER"].includes(role));
  const canExecute = canPlan || normalizedRoles.includes("MACHFLOW_TECHNICIAN");
  const visibleTabs = useMemo(
    () => TABS.filter(([key]) => canPlan || !["reports", "config"].includes(key)),
    [canPlan]
  );

  useEffect(() => {
    if (!visibleTabs.some(([key]) => key === tab)) setTab("dashboard");
  }, [tab, visibleTabs]);

  useEffect(() => {
    const available = plants.data || [];
    if (available.length === 1 && !plantCode) setPlantCode(available[0].name);
  }, [plants.data, plantCode]);

  const notify = useCallback((message, type = "success") => setToast({ message, type }), []);

  return (
    <div className="mf-shell">
      <header className="mf-topbar">
        <div className="mf-brand">
          <button className="mf-icon-btn mf-home-btn" type="button" onClick={() => navigate("/modules")} aria-label="Back to modules">←</button>
          <div className="mf-mark">M</div>
          <div>
            <strong>MachFlow</strong>
            <span>Machine Maintenance & Reliability</span>
          </div>
        </div>
        <nav className="mf-nav" aria-label="MachFlow sections">
          {visibleTabs.map(([key, label]) => (
            <button key={key} className={cx(tab === key && "is-active")} onClick={() => setTab(key)}>{label}</button>
          ))}
        </nav>
        <div className="mf-top-actions">
          <span className="mf-user-pill">{username || "MachFlow User"}</span>
          <select value={plantCode} onChange={(e) => setPlantCode(e.target.value)} aria-label="Plant filter">
            {(plants.data || []).length > 1 && <option value="">All authorised plants</option>}
            {(plants.data || []).map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </div>
      </header>

      <main className="mf-main">
        {tab === "dashboard" && <Dashboard plantCode={plantCode} onNavigate={setTab} />}
        {tab === "work" && <WorkOrders plantCode={plantCode} notify={notify} plants={plants.data || []} canPlan={canPlan} canExecute={canExecute} />}
        {tab === "calendar" && <MaintenanceCalendar plantCode={plantCode} />}
        {tab === "equipment" && <Equipment plantCode={plantCode} notify={notify} plants={plants.data || []} canPlan={canPlan} />}
        {tab === "reports" && canPlan && <Reports plantCode={plantCode} />}
        {tab === "config" && canPlan && <Configuration plantCode={plantCode} notify={notify} plants={plants.data || []} isAdmin={isAdmin} />}
      </main>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
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

function WorkOrders({ plantCode, notify, plants, canPlan, canExecute }) {
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
      await machFlowApi.createWorkOrder(payload);
      notify(canPlan && payload.scheduledAt ? "Maintenance work order planned" : "Maintenance request created");
      setCreateOpen(false);
      state.reload();
    } catch (error) {
      notify(errorText(error), "error");
    }
  };

  const move = async (id, target, version) => {
    if (!canExecute) return;
    if (["REPAIRED", "CLOSED"].includes(target)) {
      notify("Open the work order to capture repair and verification details before completing it.");
      setSelectedId(id);
      return;
    }
    try {
      await machFlowApi.changeStatus(id, { status: target, note: `Moved to ${human(target)}`, version });
      notify(`Moved to ${human(target)}`);
      state.reload();
      if (selectedId === id) setSelectedId(null);
    } catch (error) {
      notify(errorText(error), "error");
    }
  };

  if (state.error) return <ErrorBox error={state.error} onRetry={state.reload} />;

  return (
    <section className="mf-page">
      <div className="mf-page-head compact">
        <div><p className="mf-eyebrow">Maintenance execution</p><h1>Work Orders</h1><p>Corrective, preventive, inspection and calibration work with plant-secured ownership and traceable status history.</p></div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>+ {canPlan ? "New work order" : "Raise maintenance request"}</Button>
      </div>

      <div className="mf-toolbar">
        <div className="mf-search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search number, issue, equipment or requester…" /></div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All stages</option>{[...KANBAN.map(([x]) => x), "SCRAPPED", "CANCELLED"].map((x) => <option key={x} value={x}>{human(x)}</option>)}</select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)}><option value="">All priorities</option>{PRIORITIES.map((x) => <option key={x}>{human(x)}</option>)}</select>
        <select value={type} onChange={(e) => setType(e.target.value)}><option value="">All work types</option>{WORK_TYPES.map((x) => <option key={x}>{human(x)}</option>)}</select>
        <div className="mf-segment"><button className={cx(view === "kanban" && "is-active")} onClick={() => setView("kanban")}>Board</button><button className={cx(view === "list" && "is-active")} onClick={() => setView("list")}>List</button></div>
      </div>

      {state.loading ? <Loading /> : view === "kanban" ? (
        <div className="mf-kanban">
          {KANBAN.map(([key, label]) => (
            <div
              className="mf-kanban-col"
              key={key}
              onDragOver={(e) => { if (canExecute) e.preventDefault(); }}
              onDrop={(e) => {
                if (!canExecute) return;
                try {
                  const data = JSON.parse(e.dataTransfer.getData("text/plain") || "{}");
                  if (data.id && data.status !== key) move(data.id, key, data.version);
                } catch { /* ignore malformed drag payload */ }
              }}
            >
              <div className="mf-kanban-head"><div><strong>{label}</strong><span>{byStatus[key]?.length || 0}</span></div><i /></div>
              <div className="mf-kanban-cards">
                {(byStatus[key] || []).map((w) => <WorkCard key={w.id} w={w} canExecute={canExecute} onOpen={() => setSelectedId(w.id)} />)}
                {!byStatus[key]?.length && <div className="mf-kanban-empty">{canExecute ? "No work in this stage" : "No requests"}</div>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mf-panel mf-table-wrap">
          <table className="mf-table">
            <thead><tr><th>Work order</th><th>Equipment</th><th>Type</th><th>Requested by</th><th>Responsible</th><th>Scheduled</th><th>Priority</th><th>Status</th><th /></tr></thead>
            <tbody>{items.map((w) => <tr key={w.id}><td><strong>{w.workNumber}</strong><small>{w.title}</small></td><td>{w.equipmentName || "—"}</td><td>{human(w.workType)}</td><td>{w.requestedBy || "—"}</td><td>{w.responsible || "Unassigned"}</td><td className={cx(w.overdue && "mf-danger-text")}>{fmtDate(w.scheduledAt, true)}</td><td><PriorityBadge value={w.priority} /></td><td><StatusBadge status={w.status} /></td><td><Button onClick={() => setSelectedId(w.id)}>Open</Button></td></tr>)}</tbody>
          </table>
        </div>
      )}

      {createOpen && <WorkOrderForm onClose={() => setCreateOpen(false)} onSave={saveWork} equipment={equipment.data?.items || []} teams={teams.data || []} users={users.data || []} plants={plants} canPlan={canPlan} defaultPlant={plantCode} />}
      {selectedId && <WorkOrderDrawer id={selectedId} onClose={() => setSelectedId(null)} onChanged={() => state.reload()} notify={notify} canExecute={canExecute} canPlan={canPlan} equipment={equipment.data?.items || []} teams={teams.data || []} users={users.data || []} plants={plants} defaultPlant={plantCode} />}
    </section>
  );
}

function WorkCard({ w, onOpen, canExecute }) {
  return (
    <article
      className={cx("mf-work-card", w.overdue && "is-overdue", w.safetyRisk && "is-risk", canExecute && "is-draggable")}
      draggable={canExecute}
      onDragStart={(e) => { if (canExecute) e.dataTransfer.setData("text/plain", JSON.stringify({ id: w.id, status: w.status, version: w.version })); }}
      onClick={onOpen}
    >
      <div className="mf-work-card-top"><span>{w.workNumber}</span><PriorityBadge value={w.priority} /></div>
      <h3>{w.title}</h3>
      <p>{w.equipmentName || "General maintenance"}</p>
      <div className="mf-work-meta"><span>{w.plantCode}</span><span>{w.responsible || "Unassigned"}</span></div>
      <div className="mf-work-foot"><span className={cx(w.overdue && "mf-danger-text")}>{w.scheduledAt ? fmtDate(w.scheduledAt, true) : "Unscheduled"}</span><span>{w.productionStopped ? "Production stopped" : human(w.workType)}</span></div>
    </article>
  );
}

function WorkOrderForm({ onClose, onSave, equipment, teams, users, plants, canPlan, defaultPlant, initial }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_WORK, plantCode: defaultPlant || "", ...(initial || {}), scheduledAt: dateTimeInput(initial?.scheduledAt) }));
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const activeTeams = teams.filter((team) => team.active && (!form.plantCode || !team.plantCode || team.plantCode === form.plantCode));
  const assignableUsers = users.filter((user) => (user.roles || []).some((role) => ["MACHFLOW_MANAGER", "MACHFLOW_PLANNER", "MACHFLOW_TECHNICIAN"].includes(String(role).replace(/^ROLE_/i, "").toUpperCase())));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...form,
        requestedBy: null,
        equipmentId: form.equipmentId || null,
        scheduledAt: canPlan && form.scheduledAt ? form.scheduledAt : null,
        estimatedMinutes: canPlan && form.estimatedMinutes !== "" ? Number(form.estimatedMinutes) : null,
        downtimeMinutes: null,
        rootCause: null,
        actionTaken: null,
        partsUsed: null,
        partsCost: initial ? null : 0,
        laborCost: initial ? null : 0,
        externalCost: initial ? null : 0,
        verificationNote: null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={initial ? "Edit / plan work order" : canPlan ? "New maintenance work order" : "Raise maintenance request"} subtitle={initial ? "Update planning, ownership, priority and schedule without changing the repair record." : canPlan ? "Create, route and schedule the job with a controlled maintenance owner." : "Report the machine problem clearly. Maintenance planning and assignment are handled by the maintenance team."} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="mf-modal-body mf-form-grid">
          <Field label="Issue / Request title"><input required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Panel saw spindle vibration" /></Field>
          <Field label="Equipment"><select value={form.equipmentId} onChange={(e) => {
            const item = equipment.find((x) => x.id === e.target.value);
            setForm((f) => ({ ...f, equipmentId: e.target.value, plantCode: item?.plantCode || f.plantCode, location: item?.location || f.location, teamName: item?.maintenanceTeam || f.teamName, responsible: item?.primaryTechnician || f.responsible }));
          }}><option value="">General / no equipment</option>{equipment.map((item) => <option key={item.id} value={item.id}>{item.assetCode} · {item.name}</option>)}</select></Field>
          <Field label="Work type"><select value={form.workType} onChange={(e) => setForm((f) => ({ ...f, workType: e.target.value, breakdown: e.target.value === "CORRECTIVE" }))}>{WORK_TYPES.map((x) => <option key={x} value={x}>{human(x)}</option>)}</select></Field>
          <Field label="Priority"><select value={form.priority} onChange={(e) => set("priority", e.target.value)}>{PRIORITIES.map((x) => <option key={x} value={x}>{human(x)}</option>)}</select></Field>
          <Field label="Plant"><select required value={form.plantCode} onChange={(e) => set("plantCode", e.target.value)}><option value="">Select plant</option>{plants.map((plant) => <option key={plant.name} value={plant.name}>{plant.name}</option>)}</select></Field>
          <Field label="Location"><input value={form.location} onChange={(e) => set("location", e.target.value)} /></Field>
          {canPlan && <Field label="Maintenance team"><select value={form.teamName} onChange={(e) => set("teamName", e.target.value)}><option value="">Unassigned</option>{activeTeams.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}</select></Field>}
          {canPlan && <Field label="Responsible technician"><select value={form.responsible} onChange={(e) => set("responsible", e.target.value)}><option value="">Unassigned</option>{assignableUsers.map((u) => <option key={u.username} value={u.username}>{u.displayName || u.username}</option>)}</select></Field>}
          {canPlan && <Field label="Scheduled date & time"><input type="datetime-local" value={form.scheduledAt} onChange={(e) => set("scheduledAt", e.target.value)} /></Field>}
          {canPlan && <Field label="Estimated minutes"><input type="number" min="0" value={form.estimatedMinutes} onChange={(e) => set("estimatedMinutes", e.target.value)} /></Field>}
          <Field label="Problem description"><textarea required rows="4" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Symptoms, observations, error code, operating condition…" /></Field>
          <Field label="Safety / work instructions"><textarea rows="4" value={form.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder="Known hazard, LOTO need, access restriction or specific observation…" /></Field>
          <div className="mf-checks mf-full">
            <label><input type="checkbox" checked={form.breakdown} onChange={(e) => set("breakdown", e.target.checked)} /> Breakdown / failure</label>
            <label><input type="checkbox" checked={form.productionStopped} onChange={(e) => set("productionStopped", e.target.checked)} /> Production stopped</label>
            <label><input type="checkbox" checked={form.safetyRisk} onChange={(e) => set("safetyRisk", e.target.checked)} /> Safety risk</label>
          </div>
        </div>
        <div className="mf-modal-actions"><Button type="button" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={saving}>{saving ? "Saving…" : initial ? "Save changes" : canPlan ? "Create work order" : "Submit request"}</Button></div>
      </form>
    </Modal>
  );
}

function WorkOrderDrawer({ id, onClose, onChanged, notify, canExecute, canPlan, equipment, teams, users, plants, defaultPlant }) {
  const state = useAsync(() => machFlowApi.workOrder(id), [id]);
  const [actionOpen, setActionOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  if (state.loading) return <div className="mf-drawer"><Loading /></div>;
  if (state.error) return <div className="mf-drawer"><ErrorBox error={state.error} onRetry={state.reload} /></div>;
  const w = state.data;

  const move = async (target, details = {}) => {
    try {
      await machFlowApi.changeStatus(id, { status: target, note: `Status moved to ${human(target)}`, version: w.version, ...details });
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
      notify("Work order planning updated");
      setEditOpen(false);
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
        <div className="mf-drawer-status"><StatusBadge status={w.status} /><PriorityBadge value={w.priority} />{w.overdue && <Badge tone="red">Overdue</Badge>}{w.productionStopped && <Badge tone="red">Production stopped</Badge>}</div>
        <div className="mf-stage-strip">{KANBAN.map(([key, label]) => <div key={key} className={cx(key === w.status && "is-current", ["CLOSED"].includes(w.status) && key !== "CLOSED" && "is-done")}>{label}</div>)}</div>
        <div className="mf-drawer-body">
          <div className="mf-detail-grid">
            <Detail label="Equipment" value={w.equipmentName || "General maintenance"} />
            <Detail label="Plant / Location" value={[w.plantCode, w.location].filter(Boolean).join(" · ")} />
            <Detail label="Requested by" value={w.requestedBy} />
            <Detail label="Responsible" value={w.responsible || "Unassigned"} />
            <Detail label="Team" value={w.teamName || "—"} />
            <Detail label="Work type" value={human(w.workType)} />
            <Detail label="Requested" value={fmtDate(w.requestedAt, true)} />
            <Detail label="Scheduled" value={fmtDate(w.scheduledAt, true)} danger={w.overdue} />
            <Detail label="Started" value={fmtDate(w.startedAt, true)} />
            <Detail label="Repaired" value={fmtDate(w.repairedAt, true)} />
            <Detail label="Actual duration" value={w.actualMinutes != null ? `${fmtNumber(w.actualMinutes)} min` : "—"} />
            <Detail label="Downtime" value={w.downtimeMinutes != null ? `${fmtNumber(w.downtimeMinutes)} min` : "—"} />
          </div>

          <DetailBlock title="Problem" text={w.description} />
          <DetailBlock title="Instructions / safety" text={w.instructions} />
          <DetailBlock title="Root cause" text={w.rootCause} />
          <DetailBlock title="Action taken" text={w.actionTaken} />
          <DetailBlock title="Parts used" text={w.partsUsed} />
          <DetailBlock title="Verification" text={w.verificationNote} />

          <div className="mf-cost-row"><span>Parts <strong>{fmtMoney(w.partsCost)}</strong></span><span>Labour <strong>{fmtMoney(w.laborCost)}</strong></span><span>External <strong>{fmtMoney(w.externalCost)}</strong></span><span>Total <strong>{fmtMoney(w.totalCost)}</strong></span></div>

          <div className="mf-section-title"><h3>Activity timeline</h3><span>{w.audit?.length || 0} events</span></div>
          <div className="mf-timeline">
            {(w.audit || []).map((a) => <div key={a.id} className="mf-timeline-item"><i /><div><strong>{human(a.action)}</strong><span>{a.actor || "System"} · {fmtDate(a.createdAt, true)}</span>{a.fromStatus && a.toStatus && <p>{human(a.fromStatus)} → {human(a.toStatus)}</p>}{a.note && <p>{a.note}</p>}</div></div>)}
          </div>
        </div>
        {(canPlan || canExecute) && <div className="mf-drawer-actions">
          {canPlan && <Button onClick={() => setEditOpen(true)}>Edit / Plan</Button>}
          {canExecute && w.allowedTransitions?.slice(0, 4).map((s) => <Button key={s} variant={s === "REPAIRED" || s === "CLOSED" ? "primary" : "default"} onClick={() => s === "REPAIRED" || s === "CLOSED" ? setActionOpen(s) : move(s)}>{human(s)}</Button>)}
        </div>}
        {canPlan && editOpen && <WorkOrderForm initial={w} onClose={() => setEditOpen(false)} onSave={saveEdit} equipment={equipment} teams={teams} users={users} plants={plants} canPlan={true} defaultPlant={defaultPlant} />}
        {canExecute && actionOpen && <StatusCompletionModal status={actionOpen} w={w} onClose={() => setActionOpen(false)} onSubmit={(details) => move(actionOpen, details)} />}
      </aside>
    </div>
  );
}

function StatusCompletionModal({ status, w, onClose, onSubmit }) {
  const [form, setForm] = useState({
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
  return (
    <Modal title={status === "REPAIRED" ? "Mark repaired" : "Close & verify work"} subtitle={status === "REPAIRED" ? "Record the repair result, downtime, parts and cost so reliability reporting stays accurate." : "Verify the repair result before final closure."} onClose={onClose} wide={status === "REPAIRED"}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form, actualMinutes: numericOrNull(form.actualMinutes), downtimeMinutes: numericOrNull(form.downtimeMinutes), partsCost: numericOrNull(form.partsCost), laborCost: numericOrNull(form.laborCost), externalCost: numericOrNull(form.externalCost) }); }}>
        <div className="mf-modal-body mf-form-grid">
          {status === "REPAIRED" && <>
            <Field label="Actual repair minutes"><input type="number" min="0" value={form.actualMinutes} onChange={(e) => setForm({ ...form, actualMinutes: e.target.value })} /></Field>
            <Field label="Downtime minutes"><input type="number" min="0" value={form.downtimeMinutes} onChange={(e) => setForm({ ...form, downtimeMinutes: e.target.value })} /></Field>
            <Field label="Root cause"><textarea required={w.workType === "CORRECTIVE" || w.breakdown} rows="3" value={form.rootCause} onChange={(e) => setForm({ ...form, rootCause: e.target.value })} placeholder="Failure mechanism / reason found during diagnosis" /></Field>
            <Field label="Action taken"><textarea required={w.workType === "CORRECTIVE" || w.breakdown} rows="3" value={form.actionTaken} onChange={(e) => setForm({ ...form, actionTaken: e.target.value })} placeholder="Repair, replacement, adjustment or corrective action performed" /></Field>
            <Field label="Parts / material used"><textarea rows="3" value={form.partsUsed} onChange={(e) => setForm({ ...form, partsUsed: e.target.value })} placeholder="Bearing 6205 × 2, V-belt B52 × 1…" /></Field>
            <Field label="Parts cost"><input type="number" min="0" step="0.01" value={form.partsCost} onChange={(e) => setForm({ ...form, partsCost: e.target.value })} /></Field>
            <Field label="Labour cost"><input type="number" min="0" step="0.01" value={form.laborCost} onChange={(e) => setForm({ ...form, laborCost: e.target.value })} /></Field>
            <Field label="External / vendor cost"><input type="number" min="0" step="0.01" value={form.externalCost} onChange={(e) => setForm({ ...form, externalCost: e.target.value })} /></Field>
          </>}
          {status === "CLOSED" && <Field label="Verification note"><textarea required rows="4" value={form.verificationNote} onChange={(e) => setForm({ ...form, verificationNote: e.target.value })} placeholder="Test run completed, output checked, safety guard restored and machine handed back to production…" /></Field>}
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

function Equipment({ plantCode, notify, plants, canPlan }) {
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
      notify("Equipment added to MachFlow");
      setCreateOpen(false);
      state.reload();
    } catch (error) {
      notify(errorText(error), "error");
    }
  };

  return (
    <section className="mf-page">
      <div className="mf-page-head compact"><div><p className="mf-eyebrow">Asset reliability register</p><h1>Equipment</h1><p>Every machine with asset identity, criticality, ownership, PM due date and maintenance history.</p></div>{canPlan && <Button variant="primary" onClick={() => setCreateOpen(true)}>+ Add equipment</Button>}</div>
      <div className="mf-toolbar"><div className="mf-search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search asset code, machine, model, serial or category…" /></div><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All equipment states</option>{EQUIPMENT_STATUSES.map((x) => <option key={x}>{x}</option>)}</select></div>
      {state.error ? <ErrorBox error={state.error} onRetry={state.reload} /> : state.loading ? <Loading /> : (
        <div className="mf-equipment-grid">
          {(state.data?.items || []).map((e) => <article className={cx("mf-equipment-card", e.status === "DOWN" && "is-down")} key={e.id} onClick={() => setSelectedId(e.id)}><div className="mf-equipment-top"><span>{e.assetCode}</span><StatusBadge status={e.status} /></div><h3>{e.name}</h3><p>{[e.category, e.manufacturer, e.model].filter(Boolean).join(" · ") || "Uncategorized equipment"}</p><div className="mf-equipment-meta"><span><small>Plant</small><strong>{e.plantCode}</strong></span><span><small>Location</small><strong>{e.location || "—"}</strong></span><span><small>Criticality</small><strong>{human(e.criticality)}</strong></span></div><div className="mf-equipment-foot"><span>{e.openWorkOrders ? `${e.openWorkOrders} open work orders` : "No open work"}</span><span>Next PM: {fmtDate(e.nextMaintenanceAt)}</span></div></article>)}
          {!state.data?.items?.length && <EmptyState title="No equipment found" text="Add the first machine or change the current filters." />}
        </div>
      )}
      {canPlan && createOpen && <EquipmentForm onClose={() => setCreateOpen(false)} onSave={save} teams={teams.data || []} users={users.data || []} plants={plants} defaultPlant={plantCode} />}
      {selectedId && <EquipmentDrawer id={selectedId} onClose={() => setSelectedId(null)} />}
    </section>
  );
}

function EquipmentForm({ onClose, onSave, teams, users, plants, defaultPlant }) {
  const [form, setForm] = useState({ ...EMPTY_EQUIPMENT, plantCode: defaultPlant || "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Modal title="Add equipment" subtitle="Use a permanent asset code. It becomes the machine's maintenance identity." onClose={onClose} wide>
      <form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSave({ ...form, purchaseDate: form.purchaseDate || null, commissionedDate: form.commissionedDate || null, warrantyExpiry: form.warrantyExpiry || null }); } finally { setSaving(false); } }}>
        <div className="mf-modal-body mf-form-grid">
          <Field label="Asset code"><input required value={form.assetCode} onChange={(e) => set("assetCode", e.target.value)} placeholder="AKG-CNC-001" /></Field>
          <Field label="Equipment name"><input required value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Category"><input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="CNC Router / Panel Saw / Compressor…" /></Field>
          <Field label="Criticality"><select value={form.criticality} onChange={(e) => set("criticality", e.target.value)}>{CRITICALITIES.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Plant"><select required value={form.plantCode} onChange={(e) => set("plantCode", e.target.value)}><option value="">Select plant</option>{plants.map((plant) => <option key={plant.name} value={plant.name}>{plant.name}</option>)}</select></Field>
          <Field label="Location"><input value={form.location} onChange={(e) => set("location", e.target.value)} /></Field>
          <Field label="Manufacturer"><input value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} /></Field>
          <Field label="Model"><input value={form.model} onChange={(e) => set("model", e.target.value)} /></Field>
          <Field label="Serial number"><input value={form.serialNumber} onChange={(e) => set("serialNumber", e.target.value)} /></Field>
          <Field label="Owner / department"><input value={form.owner} onChange={(e) => set("owner", e.target.value)} /></Field>
          <Field label="Maintenance team"><select value={form.maintenanceTeam} onChange={(e) => set("maintenanceTeam", e.target.value)}><option value="">Unassigned</option>{teams.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}</select></Field>
          <Field label="Primary technician"><select value={form.primaryTechnician} onChange={(e) => set("primaryTechnician", e.target.value)}><option value="">Unassigned</option>{users.filter((u) => (u.roles || []).some((r) => ["MACHFLOW_MANAGER", "MACHFLOW_PLANNER", "MACHFLOW_TECHNICIAN"].includes(String(r).replace(/^ROLE_/i, "").toUpperCase()))).map((u) => <option key={u.username} value={u.username}>{u.displayName || u.username}</option>)}</select></Field>
          <Field label="Purchase date"><input type="date" value={form.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} /></Field>
          <Field label="Commissioned date"><input type="date" value={form.commissionedDate} onChange={(e) => set("commissionedDate", e.target.value)} /></Field>
          <Field label="Warranty expiry"><input type="date" value={form.warrantyExpiry} onChange={(e) => set("warrantyExpiry", e.target.value)} /></Field>
          <Field label="Equipment state"><select value={form.status} onChange={(e) => set("status", e.target.value)}>{EQUIPMENT_STATUSES.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Description"><textarea rows="3" value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
          <Field label="Safety notes"><textarea rows="3" value={form.safetyNotes} onChange={(e) => set("safetyNotes", e.target.value)} /></Field>
        </div>
        <div className="mf-modal-actions"><Button type="button" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={saving}>{saving ? "Saving…" : "Add equipment"}</Button></div>
      </form>
    </Modal>
  );
}

function EquipmentDrawer({ id, onClose }) {
  const state = useAsync(() => machFlowApi.equipmentOne(id), [id]);
  if (state.loading) return <div className="mf-drawer"><Loading /></div>;
  if (state.error) return <div className="mf-drawer"><ErrorBox error={state.error} onRetry={state.reload} /></div>;
  const e = state.data;
  const h = e.health || {};
  return (
    <div className="mf-drawer-backdrop" onMouseDown={onClose}><aside className="mf-drawer" onMouseDown={(x) => x.stopPropagation()}><div className="mf-drawer-head"><div><span>{e.assetCode}</span><h2>{e.name}</h2></div><button className="mf-icon-btn" onClick={onClose}>×</button></div><div className="mf-drawer-status"><StatusBadge status={e.status} /><Badge tone={h.score >= 85 ? "green" : h.score >= 65 ? "amber" : "red"}>Health {h.score}/100 · {h.label}</Badge></div><div className="mf-drawer-body"><div className="mf-health-grid"><Kpi title="MTTR" value={`${fmtNumber(h.mttrHours, 1)}h`} detail="90-day average" tone="violet" /><Kpi title="MTBF" value={`${fmtNumber(h.mtbfDays, 1)}d`} detail="between failures" tone="teal" /><Kpi title="Open work" value={fmtNumber(h.openWorkOrders)} detail={`${fmtNumber(h.failures30)} failures / 30d`} tone={h.openWorkOrders ? "amber" : "green"} /></div><div className="mf-detail-grid"><Detail label="Category" value={e.category} /><Detail label="Plant / location" value={[e.plantCode, e.location].filter(Boolean).join(" · ")} /><Detail label="Manufacturer / model" value={[e.manufacturer, e.model].filter(Boolean).join(" · ")} /><Detail label="Serial number" value={e.serialNumber} /><Detail label="Criticality" value={human(e.criticality)} /><Detail label="Owner" value={e.owner} /><Detail label="Maintenance team" value={e.maintenanceTeam} /><Detail label="Primary technician" value={e.primaryTechnician} /><Detail label="Last maintenance" value={fmtDate(e.lastMaintenanceAt, true)} /><Detail label="Next PM" value={fmtDate(e.nextMaintenanceAt, true)} danger={h.pmOverdue} /><Detail label="Warranty expiry" value={fmtDate(e.warrantyExpiry)} /><Detail label="Lifetime downtime" value={`${fmtNumber(h.lifetimeDowntimeHours, 1)}h`} /></div><DetailBlock title="Description" text={e.description} /><DetailBlock title="Safety notes" text={e.safetyNotes} /><div className="mf-section-title"><h3>Preventive plans</h3></div><div className="mf-mini-list">{(e.plans || []).map((p) => <div key={p.id}><strong>{p.title}</strong><span>Every {p.intervalDays} days · next {fmtDate(p.nextDueDate)}</span></div>)}</div><div className="mf-section-title"><h3>Recent maintenance</h3></div><div className="mf-mini-list">{(e.recentWorkOrders || []).map((w) => <div key={w.id}><strong>{w.workNumber} · {w.title}</strong><span>{fmtDate(w.requestedAt)} · {human(w.status)} · {w.responsible || "Unassigned"}</span></div>)}</div></div></aside></div>
  );
}

/* ================================= REPORTS ================================= */

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
      <div className="mf-page-head compact"><div><p className="mf-eyebrow">Maintenance intelligence</p><h1>Reliability Reports</h1><p>Use trends, failure concentration and technician workload to improve maintenance decisions—not just count tickets.</p></div><div className="mf-date-range"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><span>to</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div></div>
      {state.loading ? <Loading /> : <><div className="mf-kpi-grid four"><Kpi title="Work orders" value={fmtNumber(summary.orders)} detail={`${fmtNumber(summary.completed)} completed`} tone="blue" /><Kpi title="Planned maintenance mix" value={`${fmtNumber(summary.plannedRatio, 1)}%`} detail={`${fmtNumber(summary.preventive)} preventive`} tone="green" /><Kpi title="Corrective work" value={fmtNumber(summary.corrective)} detail="failure-driven jobs" tone="amber" /><Kpi title="Maintenance cost" value={fmtMoney(summary.totalCost)} detail="parts + labour + external" tone="violet" /></div><div className="mf-dashboard-grid"><div className="mf-panel mf-span-2"><div className="mf-panel-head"><div><h2>Monthly work trend</h2><p>Opened vs closed maintenance</p></div></div><div className="mf-month-chart">{(data.monthly || []).map((m) => <div className="mf-month-bar" key={m.month}><div><i style={{ height: `${Math.max(4, (m.opened / maxMonthly) * 100)}%` }} /><b style={{ height: `${Math.max(4, (m.closed / maxMonthly) * 100)}%` }} /></div><span>{m.month.slice(2)}</span></div>)}</div></div><div className="mf-panel"><div className="mf-panel-head"><div><h2>Top failure assets</h2><p>Where reliability action is needed</p></div></div><div className="mf-rank-list">{(data.byEquipment || []).slice(0, 8).map((a, i) => <div className="mf-rank-row" key={a.name}><span>{i + 1}</span><strong>{a.name}</strong><Badge tone={a.failures >= 3 ? "red" : "amber"}>{a.failures}</Badge></div>)}</div></div><div className="mf-panel mf-span-3 mf-table-wrap"><div className="mf-panel-head"><div><h2>Technician performance</h2><p>Completion, repair time and downtime exposure</p></div></div><table className="mf-table"><thead><tr><th>Technician</th><th>Assigned</th><th>Completed</th><th>Avg repair</th><th>Downtime handled</th></tr></thead><tbody>{(data.byTechnician || []).map((t) => <tr key={t.name}><td><strong>{t.name}</strong></td><td>{t.orders}</td><td>{t.closed}</td><td>{t.avgRepairHours}h</td><td>{t.downtimeHours}h</td></tr>)}</tbody></table></div></div></>}
    </section>
  );
}

/* ================================= CONFIGURATION ================================= */

function Configuration({ plantCode, notify, plants, isAdmin }) {
  const [section, setSection] = useState("teams");
  const [teamOpen, setTeamOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const teams = useAsync(() => machFlowApi.teams(plantCode), [plantCode]);
  const plans = useAsync(() => machFlowApi.plans(plantCode, false), [plantCode]);
  const equipment = useAsync(() => machFlowApi.equipment({ plantCode }), [plantCode]);
  const users = useAsync(() => machFlowApi.users(plantCode), [plantCode]);

  const generate = async () => {
    try { const result = await machFlowApi.generateDuePlans(); notify(`${result.created || 0} preventive work orders generated`); plans.reload(); }
    catch (error) { notify(errorText(error), "error"); }
  };

  return (
    <section className="mf-page">
      <div className="mf-page-head compact"><div><p className="mf-eyebrow">Master data & automation</p><h1>Configuration</h1><p>Keep maintenance teams and preventive schedules controlled while reusing your existing FlowSuite user accounts and plant access.</p></div></div>
      <div className="mf-config-tabs"><button className={cx(section === "teams" && "is-active")} onClick={() => setSection("teams")}>Maintenance Teams</button><button className={cx(section === "plans" && "is-active")} onClick={() => setSection("plans")}>Preventive Plans</button></div>
      {section === "teams" ? <div className="mf-panel"><div className="mf-panel-head"><div><h2>Maintenance teams</h2><p>Teams stay inside MachFlow. People are selected from the existing FlowSuite user master.</p></div><Button variant="primary" onClick={() => setTeamOpen(true)}>+ New team</Button></div><div className="mf-team-grid">{(teams.data || []).map((t) => <div className="mf-team-card" key={t.id}><div><strong>{t.name}</strong><StatusBadge status={t.active ? "ACTIVE" : "RETIRED"} /></div><p>{t.plantCode || "Company-wide"}</p><span>Lead: {t.lead || "—"}</span><div className="mf-chip-row">{(t.members || []).slice(0, 8).map((m) => <Badge key={m}>{m}</Badge>)}</div></div>)}</div></div> : <div className="mf-panel"><div className="mf-panel-head"><div><h2>Preventive maintenance plans</h2><p>Recurring plans automatically generate planned work orders before the due date.</p></div><div className="mf-inline-actions"><Button onClick={generate}>Generate due now</Button><Button variant="primary" onClick={() => setPlanOpen(true)}>+ New PM plan</Button></div></div><div className="mf-table-wrap"><table className="mf-table"><thead><tr><th>Equipment</th><th>Plan</th><th>Interval</th><th>Lead time</th><th>Next due</th><th>Responsible</th><th>Status</th></tr></thead><tbody>{(plans.data || []).map((p) => <tr key={p.id}><td>{p.equipmentName}</td><td><strong>{p.title}</strong></td><td>{p.intervalDays} days</td><td>{p.leadDays} days</td><td className={cx(new Date(p.nextDueDate) < new Date() && "mf-danger-text")}>{fmtDate(p.nextDueDate)}</td><td>{p.responsible || "—"}</td><td>{p.active ? <Badge tone="green">Active</Badge> : <Badge>Paused</Badge>}</td></tr>)}</tbody></table></div></div>}
      {teamOpen && <TeamForm defaultPlant={plantCode} plants={plants} users={users.data || []} isAdmin={isAdmin} onClose={() => setTeamOpen(false)} onSave={async (payload) => { try { await machFlowApi.createTeam(payload); notify("Maintenance team created"); setTeamOpen(false); teams.reload(); } catch (error) { notify(errorText(error), "error"); } }} />}
      {planOpen && <PlanForm equipment={equipment.data?.items || []} teams={teams.data || []} users={users.data || []} onClose={() => setPlanOpen(false)} onSave={async (payload) => { try { await machFlowApi.createPlan(payload); notify("Preventive plan created"); setPlanOpen(false); plans.reload(); } catch (error) { notify(errorText(error), "error"); } }} />}
    </section>
  );
}

function TeamForm({ defaultPlant, plants, users, isAdmin, onClose, onSave }) {
  const [form, setForm] = useState({ ...EMPTY_TEAM, plantCode: defaultPlant || "" });
  const selectable = users.filter((u) => (u.roles || []).some((r) => ["MACHFLOW_MANAGER", "MACHFLOW_PLANNER", "MACHFLOW_TECHNICIAN"].includes(String(r).replace(/^ROLE_/i, "").toUpperCase())));
  const selectedMembers = String(form.membersText || "").split(",").map((x) => x.trim()).filter(Boolean);
  const toggleMember = (username) => {
    const next = selectedMembers.includes(username) ? selectedMembers.filter((x) => x !== username) : [...selectedMembers, username];
    setForm({ ...form, membersText: next.join(", ") });
  };
  return <Modal title="New maintenance team" subtitle="Build the team from existing MachFlow-enabled FlowSuite users." onClose={onClose}><form onSubmit={(e) => { e.preventDefault(); onSave(form); }}><div className="mf-modal-body mf-form-grid"><Field label="Team name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field><Field label="Plant"><select required={!isAdmin} value={form.plantCode} onChange={(e) => setForm({ ...form, plantCode: e.target.value })}>{isAdmin && <option value="">Company-wide</option>} {!isAdmin && <option value="">Select plant</option>}{plants.map((plant) => <option key={plant.name} value={plant.name}>{plant.name}</option>)}</select></Field><Field label="Team lead"><select value={form.lead} onChange={(e) => setForm({ ...form, lead: e.target.value })}><option value="">Unassigned</option>{selectable.map((u) => <option key={u.username} value={u.username}>{u.displayName || u.username}</option>)}</select></Field><Field label="Members" hint="Select one or more MachFlow users"><div className="mf-user-select-list">{selectable.map((u) => <label key={u.username}><input type="checkbox" checked={selectedMembers.includes(u.username)} onChange={() => toggleMember(u.username)} /> {u.displayName || u.username}</label>)}</div></Field></div><div className="mf-modal-actions"><Button type="button" onClick={onClose}>Cancel</Button><Button variant="primary">Create team</Button></div></form></Modal>;
}

function PlanForm({ equipment, teams, users, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_PLAN);
  const selectable = users.filter((u) => (u.roles || []).some((r) => ["MACHFLOW_MANAGER", "MACHFLOW_PLANNER", "MACHFLOW_TECHNICIAN"].includes(String(r).replace(/^ROLE_/i, "").toUpperCase())));
  return <Modal title="New preventive plan" subtitle="Define when MachFlow should create the next planned maintenance work order." onClose={onClose}><form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, intervalDays: Number(form.intervalDays), leadDays: Number(form.leadDays) }); }}><div className="mf-modal-body mf-form-grid"><Field label="Equipment"><select required value={form.equipmentId} onChange={(e) => { const item = equipment.find((x) => x.id === e.target.value); setForm({ ...form, equipmentId: e.target.value, teamName: item?.maintenanceTeam || form.teamName, responsible: item?.primaryTechnician || form.responsible }); }}><option value="">Select equipment</option>{equipment.map((e) => <option key={e.id} value={e.id}>{e.assetCode} · {e.name}</option>)}</select></Field><Field label="Plan title"><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Monthly lubrication & inspection" /></Field><Field label="Interval days"><input required type="number" min="1" value={form.intervalDays} onChange={(e) => setForm({ ...form, intervalDays: e.target.value })} /></Field><Field label="Generate before due (days)"><input type="number" min="0" value={form.leadDays} onChange={(e) => setForm({ ...form, leadDays: e.target.value })} /></Field><Field label="Next due date"><input required type="date" value={form.nextDueDate} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} /></Field><Field label="Priority"><select value={form.defaultPriority} onChange={(e) => setForm({ ...form, defaultPriority: e.target.value })}>{PRIORITIES.map((x) => <option key={x} value={x}>{human(x)}</option>)}</select></Field><Field label="Team"><select value={form.teamName} onChange={(e) => setForm({ ...form, teamName: e.target.value })}><option value="">Unassigned</option>{teams.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}</select></Field><Field label="Responsible"><select value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })}><option value="">Unassigned</option>{selectable.map((u) => <option key={u.username} value={u.username}>{u.displayName || u.username}</option>)}</select></Field><Field label="Instructions"><textarea rows="4" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></Field></div><div className="mf-modal-actions"><Button type="button" onClick={onClose}>Cancel</Button><Button variant="primary">Create PM plan</Button></div></form></Modal>;
}
