import React, { useCallback, useEffect, useMemo, useState } from "react";
import machFlowApi from "./machFlowApi";
import { MachFlowThemeProvider } from "./machflowUi";
import "./machflow.css";

const SERVICE_DOMAINS = [
  [
    "MACHINE",
    "Machine Maintenance",
    "Production machines, electrical, lights, AC/HVAC, utilities, facility and factory maintenance",
  ],
  [
    "IT",
    "IT Support",
    "PC/laptop, LAN, internet, printer, software, server/UPS, Wi-Fi and IT infrastructure",
  ],
];

const CATEGORY_OPTIONS = {
  MACHINE: [
    "Machine Breakdown",
    "Abnormal Noise / Vibration",
    "Electrical",
    "Lighting",
    "AC / HVAC",
    "Pneumatic / Hydraulic",
    "Utility",
    "Facility",
    "Safety",
    "Other",
  ],
  IT: [
    "PC / Laptop",
    "Network / LAN",
    "Internet",
    "Printer / Scanner",
    "Software / Login",
    "Server / UPS",
    "Wi-Fi / Access Point",
    "Peripheral",
    "Other",
  ],
};


const inferRequestDomain = (category) => {
  const text = String(category || "").trim().toUpperCase();
  if (!text) return "";
  if (/(LAN|NETWORK|INTERNET|WI-?FI|PC|LAPTOP|COMPUTER|PRINTER|SCANNER|SOFTWARE|LOGIN|SERVER|UPS|ACCESS POINT|PERIPHERAL)/.test(text)) return "IT";
  if (/(MACHINE|BREAKDOWN|VIBRATION|ELECTRICAL|LIGHT|LIGHTING|AC|HVAC|PNEUMATIC|HYDRAULIC|UTILITY|FACILITY|COMPRESSOR|GENERATOR|SAFETY)/.test(text)) return "MACHINE";
  return "";
};

const categoriesForDomain = (domain, configured = []) => {
  const defaults = CATEGORY_OPTIONS[domain] || CATEGORY_OPTIONS.MACHINE;
  const custom = Array.isArray(configured) ? configured : [];
  if (!custom.length) return defaults;

  const safe = custom.filter((category) => {
    const inferred = inferRequestDomain(category);
    return !inferred || inferred === domain;
  });

  return safe.length ? safe : defaults;
};

const EMPTY_REQUEST = {
  serviceDomain: "MACHINE",
  requestCategory: "",
  plantCode: "",
  title: "",
  description: "",
  location: "",
  operatorName: "",
  operatorContact: "",
  requestedForAt: "",
  priority: "NORMAL",
  productionStopped: false,
  safetyRisk: false,
  serviceDeskToken: "",
};

const cleanUuid = (value) => {
  const text = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : "";
};

const errorText = (error) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.data?.message ||
  error?.message ||
  "Request could not be completed.";

const fmtDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const toApiDateTime = (value) => (value ? `${value}:00` : null);

function AccessChoice({ sessionUser, mode, onMode }) {
  return (
    <div className="mf-request-access-grid">
      <button
        type="button"
        className={`mf-request-access-card ${mode === "FLOW_SUITE" ? "is-active" : ""}`}
        onClick={() => onMode("FLOW_SUITE")}
      >
        <span className="mf-request-access-icon">FS</span>
        <strong>FlowSuite employee</strong>
        <small>
          {sessionUser
            ? `Continue as ${sessionUser}`
            : "For approved employees whose FlowSuite username is linked to a Reporter profile, plus operational MachFlow staff."}
        </small>
      </button>

      <button
        type="button"
        className={`mf-request-access-card ${mode === "REPORTER" ? "is-active" : ""}`}
        onClick={() => onMode("REPORTER")}
      >
        <span className="mf-request-access-icon">RP</span>
        <strong>Reporter Pass</strong>
        <small>For approved operators, supervisors, workers and staff who do not need a FlowSuite account.</small>
      </button>
    </div>
  );
}

function ContextCard({ asset, desk }) {
  if (!asset && !desk) return null;

  return (
    <div className="mf-request-context-card">
      <div className="mf-request-context-mark">{asset ? "A" : "D"}</div>
      <div>
        <span>{asset ? "Asset identified by QR" : "Service desk identified by QR"}</span>
        <strong>{asset ? `${asset.assetCode} · ${asset.name}` : desk.name}</strong>
        <small>
          {[asset?.serviceDomain || desk?.serviceDomain, asset?.plantCode || desk?.plantCode, asset?.location]
            .filter(Boolean)
            .join(" · ")}
        </small>
      </div>
    </div>
  );
}

function RequestForm({
  context,
  identity,
  flowContext,
  reporterContext,
  onSubmit,
  submitting,
}) {
  const asset = context?.asset || reporterContext?.asset || null;
  const tokenDesk = context?.serviceDesk || reporterContext?.serviceDesk || null;
  const allowedDomains = identity === "REPORTER"
    ? reporterContext?.allowedDomains || []
    : flowContext?.serviceDomains || [];
  const desks = identity === "REPORTER"
    ? reporterContext?.serviceDesks || []
    : flowContext?.serviceDesks || [];
  const plants = identity === "REPORTER"
    ? reporterContext?.plants || reporterContext?.reporter?.plantCodes || [reporterContext?.reporter?.plantCode].filter(Boolean)
    : flowContext?.plants || [];

  const initialDomain = asset?.serviceDomain || tokenDesk?.serviceDomain || allowedDomains[0] || "MACHINE";
  const initialPlant = asset?.plantCode || tokenDesk?.plantCode || (plants.length === 1 ? plants[0] : "");

  const [form, setForm] = useState(() => ({
    ...EMPTY_REQUEST,
    serviceDomain: initialDomain,
    plantCode: initialPlant,
    location: asset?.location || "",
    serviceDeskToken: tokenDesk?.token || "",
  }));

  useEffect(() => {
    setForm((current) => ({
      ...current,
      serviceDomain: asset?.serviceDomain || tokenDesk?.serviceDomain || current.serviceDomain || initialDomain,
      plantCode: asset?.plantCode || tokenDesk?.plantCode || current.plantCode || initialPlant,
      location: asset?.location || current.location,
      serviceDeskToken: tokenDesk?.token || current.serviceDeskToken,
    }));
  }, [asset?.serviceDomain, asset?.plantCode, asset?.location, tokenDesk?.serviceDomain, tokenDesk?.plantCode, tokenDesk?.token, initialPlant]);

  const selectedDesk = useMemo(
    () => desks.find((item) => String(item.token) === String(form.serviceDeskToken)),
    [desks, form.serviceDeskToken]
  );

  const domainLocked = Boolean(asset || tokenDesk);
  const plantLocked = Boolean(asset?.plantCode || tokenDesk?.plantCode);
  const categories = categoriesForDomain(
    form.serviceDomain,
    selectedDesk?.categories || tokenDesk?.categories || []
  );

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = (event) => {
    event.preventDefault();
    onSubmit({ ...form, requestedForAt: toApiDateTime(form.requestedForAt) });
  };

  return (
    <form className="mf-request-form" onSubmit={submit}>
      <div className="mf-request-section-head">
        <div>
          <span>REQUEST DETAILS</span>
          <h2>Tell the right team what needs attention</h2>
        </div>
        <div className="mf-request-security-chip">Controlled identity</div>
      </div>

      <div className="mf-request-form-grid">
        <label className="mf-field">
          <span className="mf-label">Service *</span>
          <select
            value={form.serviceDomain}
            disabled={domainLocked}
            onChange={(e) => setForm((current) => ({
              ...current,
              serviceDomain: e.target.value,
              requestCategory: "",
              serviceDeskToken: "",
            }))}
          >
            {SERVICE_DOMAINS.filter(([key]) => allowedDomains.includes(key)).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>

        <label className="mf-field">
          <span className="mf-label">Request category *</span>
          <select
            required
            value={form.requestCategory}
            onChange={(e) => {
              const nextCategory = e.target.value;
              const inferred = inferRequestDomain(nextCategory);
              setForm((current) => ({
                ...current,
                requestCategory: nextCategory,
                serviceDomain: !domainLocked && inferred ? inferred : current.serviceDomain,
              }));
            }}
          >
            <option value="">Select category</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>

        <div className="mf-request-route-banner mf-full">
          <strong>{form.serviceDomain === "IT" ? "Routes to IT Support" : "Routes to Machine Maintenance"}</strong>
          <span>
            {form.serviceDomain === "IT"
              ? "LAN, internet, PC/laptop, printer, software, server/UPS, Wi-Fi and IT infrastructure stay with IT."
              : "Machine breakdown, electrical, lighting, AC/HVAC, utilities, facility and factory maintenance stay with Machine Maintenance."}
          </span>
        </div>

        {!tokenDesk && desks.length > 0 && !asset && (
          <label className="mf-field mf-full">
            <span className="mf-label">Service desk / team</span>
            <select
              value={form.serviceDeskToken}
              onChange={(e) => {
                const desk = desks.find((item) => String(item.token) === e.target.value);
                setForm((current) => ({
                  ...current,
                  serviceDeskToken: e.target.value,
                  serviceDomain: desk?.serviceDomain || current.serviceDomain,
                  plantCode: desk?.plantCode || current.plantCode,
                  requestCategory: "",
                }));
              }}
            >
              <option value="">Auto-route to default team</option>
              {desks
                .filter((item) => !form.serviceDomain || item.serviceDomain === form.serviceDomain)
                .map((item) => (
                  <option key={item.token} value={item.token}>
                    {item.name}{item.plantCode ? ` · ${item.plantCode}` : " · Company-wide"}
                  </option>
                ))}
            </select>
          </label>
        )}

        <label className="mf-field">
          <span className="mf-label">Plant / Site *</span>
          <select required value={form.plantCode} disabled={plantLocked} onChange={(e) => set("plantCode", e.target.value)}>
            <option value="">Select plant</option>
            {plants.map((plant) => <option key={plant} value={plant}>{plant}</option>)}
          </select>
        </label>

        <label className="mf-field">
          <span className="mf-label">Exact location</span>
          <input
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Floor, department, workstation, cabin…"
          />
        </label>

        <label className="mf-field mf-full">
          <span className="mf-label">Issue / request title *</span>
          <input
            required
            maxLength={300}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Example: Internet down at Design workstation"
          />
        </label>

        <label className="mf-field mf-full">
          <span className="mf-label">Problem description *</span>
          <textarea
            required
            rows={5}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="What happened? What do you observe? Mention error message, abnormal sound, affected area or anything useful to the technician."
          />
        </label>

        <label className="mf-field">
          <span className="mf-label">Operator / person at location</span>
          <input value={form.operatorName} onChange={(e) => set("operatorName", e.target.value)} placeholder="Name, if different" />
        </label>

        <label className="mf-field">
          <span className="mf-label">Contact / extension</span>
          <input value={form.operatorContact} onChange={(e) => set("operatorContact", e.target.value)} placeholder="Phone / extension" />
        </label>

        <label className="mf-field">
          <span className="mf-label">Required / preferred time</span>
          <input type="datetime-local" value={form.requestedForAt} onChange={(e) => set("requestedForAt", e.target.value)} />
          <span className="mf-hint">Maintenance may reschedule after triage.</span>
        </label>

        <label className="mf-field">
          <span className="mf-label">Initial urgency</span>
          <select value={form.priority} onChange={(e) => set("priority", e.target.value)}>
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
          <span className="mf-hint">Safety/production-stop flags can automatically escalate it.</span>
        </label>

        <div className="mf-request-flags mf-full">
          <label>
            <input type="checkbox" checked={form.productionStopped} onChange={(e) => set("productionStopped", e.target.checked)} />
            <span><strong>Work / production stopped</strong><small>The issue is preventing normal work.</small></span>
          </label>
          <label>
            <input type="checkbox" checked={form.safetyRisk} onChange={(e) => set("safetyRisk", e.target.checked)} />
            <span><strong>Safety risk</strong><small>Immediate hazard or unsafe condition exists.</small></span>
          </label>
        </div>
      </div>

      <div className="mf-request-submit-bar">
        <div>
          <strong>{asset ? `${asset.assetCode} · ${asset.name}` : selectedDesk?.name || tokenDesk?.name || "Automatic service routing"}</strong>
          <span>{identity === "REPORTER" ? reporterContext?.reporter?.displayName : flowContext?.username}</span>
        </div>
        <button className="mf-btn mf-btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit service request"}
        </button>
      </div>
    </form>
  );
}

function MachFlowRequestPortalContent() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const assetToken = cleanUuid(params.get("asset"));
  const deskToken = cleanUuid(params.get("desk"));

  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState(null);
  const [sessionUser, setSessionUser] = useState("");
  const [flowContext, setFlowContext] = useState(null);
  const [mode, setMode] = useState("REPORTER");
  const [credentials, setCredentials] = useState({ reporterCode: "", accessPin: "" });
  const [reporterContext, setReporterContext] = useState(null);
  const [authorising, setAuthorising] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [result, setResult] = useState(null);
  const [recentRequests, setRecentRequests] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [publicResult, meResult] = await Promise.allSettled([
        machFlowApi.publicContext({ asset: assetToken, desk: deskToken }),
        machFlowApi.sessionMe(),
      ]);

      if (publicResult.status === "fulfilled") setContext(publicResult.value || {});
      else throw publicResult.reason;

      const me = meResult.status === "fulfilled" ? meResult.value : null;
      if (me?.authenticated === true && me?.enabled === true && me?.username) {
        setSessionUser(me.username);
        setMode("FLOW_SUITE");
        try {
          const [ctx, mine] = await Promise.all([
            machFlowApi.requesterContext(),
            machFlowApi.myRequests(),
          ]);
          setFlowContext(ctx || {});
          setRecentRequests(Array.isArray(mine) ? mine : []);
        } catch (error) {
          setMessage({ type: "error", text: errorText(error) });
        }
      }
    } catch (error) {
      setMessage({ type: "error", text: errorText(error) });
    } finally {
      setLoading(false);
    }
  }, [assetToken, deskToken]);

  useEffect(() => {
    load();
  }, [load]);

  const authorise = async (event) => {
    event.preventDefault();
    setAuthorising(true);
    setMessage(null);
    try {
      const response = await machFlowApi.publicAuthorise({
        ...credentials,
        equipmentToken: assetToken || null,
        serviceDeskToken: deskToken || null,
      });
      setReporterContext(response || {});
      try {
        const mine = await machFlowApi.publicMyRequests({
          reporterCode: credentials.reporterCode,
          accessPin: credentials.accessPin,
          equipmentToken: assetToken || null,
          serviceDeskToken: deskToken || null,
        });
        setRecentRequests(Array.isArray(mine) ? mine : []);
      } catch {
        setRecentRequests([]);
      }
      setMessage({ type: "success", text: `Reporter Pass verified for ${response?.reporter?.displayName || credentials.reporterCode}.` });
    } catch (error) {
      setReporterContext(null);
      setMessage({ type: "error", text: errorText(error) });
    } finally {
      setAuthorising(false);
    }
  };

  const submitRequest = async (form) => {
    setSubmitting(true);
    setMessage(null);
    try {
      let response;
      if (mode === "FLOW_SUITE") {
        if (!sessionUser || !flowContext) throw new Error("Please sign in to FlowSuite first.");
        response = await machFlowApi.createRequesterRequest({
          equipmentId: null,
          equipmentToken: assetToken || null,
          serviceDeskToken: form.serviceDeskToken || deskToken || null,
          serviceDomain: form.serviceDomain,
          requestCategory: form.requestCategory,
          plantCode: form.plantCode,
          title: form.title,
          description: form.description,
          location: form.location,
          operatorName: form.operatorName,
          operatorContact: form.operatorContact,
          requestedForAt: form.requestedForAt,
          priority: form.priority,
          productionStopped: form.productionStopped,
          safetyRisk: form.safetyRisk,
        });
        try {
          const mine = await machFlowApi.myRequests();
          setRecentRequests(Array.isArray(mine) ? mine : []);
        } catch {
          // Submission succeeded; history refresh is non-critical.
        }
      } else {
        if (!reporterContext) throw new Error("Verify your Reporter Code and PIN first.");
        response = await machFlowApi.publicCreateRequest({
          reporterCode: credentials.reporterCode,
          accessPin: credentials.accessPin,
          equipmentToken: assetToken || null,
          serviceDeskToken: form.serviceDeskToken || deskToken || null,
          serviceDomain: form.serviceDomain,
          requestCategory: form.requestCategory,
          plantCode: form.plantCode,
          title: form.title,
          description: form.description,
          location: form.location,
          operatorName: form.operatorName,
          operatorContact: form.operatorContact,
          requestedForAt: form.requestedForAt,
          priority: form.priority,
          productionStopped: form.productionStopped,
          safetyRisk: form.safetyRisk,
        });
        try {
          const mine = await machFlowApi.publicMyRequests({
            reporterCode: credentials.reporterCode,
            accessPin: credentials.accessPin,
          });
          setRecentRequests(Array.isArray(mine) ? mine : []);
        } catch {
          // Submission succeeded; reporter history refresh is non-critical.
        }
      }
      setResult(response || {});
      setMessage({ type: "success", text: "Your request has been submitted to MachFlow." });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setMessage({ type: "error", text: errorText(error) });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="mf-shell mf-request-shell"><div className="mf-loading"><span /><span /><span /></div></div>;
  }

  return (
    <div className="mf-shell mf-request-shell">
      <header className="mf-request-header">
        <div className="mf-request-brand">
          <div className="mf-mark">M</div>
          <div><strong>MachFlow Request Center</strong><span>ALSORG Maintenance & Service Support</span></div>
        </div>
        <div className="mf-request-header-actions"><span className="mf-request-header-note">Approved employees only · Every request is traceable</span><a className="mf-btn" href="/modules">FlowSuite Home</a></div>
      </header>

      <main className="mf-request-main">
        <section className="mf-request-hero">
          <span className="mf-eyebrow">CONTROLLED SERVICE REQUEST</span>
          <h1>One controlled request center for Machine Maintenance and IT Support.</h1>
          <p>
            Scan the asset/service QR or open this page. A FlowSuite login or an approved Reporter Pass is required before anything can be posted.
          </p>
          <ContextCard asset={context?.asset} desk={context?.serviceDesk} />
        </section>

        {message && <div className={`mf-request-message ${message.type === "error" ? "is-error" : "is-success"}`}>{message.text}</div>}

        {result && (
          <section className="mf-request-success-card">
            <span>REQUEST REGISTERED</span>
            <strong>{result.workNumber || "MachFlow request"}</strong>
            <p>{result.message || "The responsible service team can now triage and act on this request."}</p>
            <div>
              {result.status && <em>Status: {String(result.status).replaceAll("_", " ")}</em>}
              {result.teamName && <em>Team: {result.teamName}</em>}
              {result.responsible && <em>Assigned: {result.responsible}</em>}
            </div>
            <button type="button" className="mf-btn" onClick={() => setResult(null)}>Raise another request</button>
          </section>
        )}

        {!result && (
          <>
            <section className="mf-request-card">
              <div className="mf-request-section-head">
                <div><span>IDENTITY</span><h2>Who is raising this request?</h2></div>
                <small>No anonymous posting</small>
              </div>
              <AccessChoice sessionUser={sessionUser} mode={mode} onMode={(next) => { setMode(next); setMessage(null); setRecentRequests([]); if (next === "FLOW_SUITE" && sessionUser) { machFlowApi.myRequests().then((mine) => setRecentRequests(Array.isArray(mine) ? mine : [])).catch(() => {}); } }} />

              {mode === "FLOW_SUITE" && !sessionUser && (
                <div className="mf-request-login-box">
                  <div><strong>Use your existing FlowSuite account</strong><span>You do not need a MachFlow role just to raise your own request.</span></div>
                  <a className="mf-btn mf-btn-primary" href={`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}>Open FlowSuite Login</a>
                </div>
              )}

              {mode === "FLOW_SUITE" && sessionUser && (
                <div className="mf-request-verified">
                  <span>✓</span><div><strong>{sessionUser}</strong><small>Authenticated FlowSuite employee</small></div>
                </div>
              )}

              {mode === "REPORTER" && !reporterContext && (
                <form className="mf-request-pin-form" onSubmit={authorise}>
                  <label className="mf-field"><span className="mf-label">Reporter / Employee Code</span><input required autoComplete="username" value={credentials.reporterCode} onChange={(e) => setCredentials((c) => ({ ...c, reporterCode: e.target.value }))} placeholder="Example: EMP-0142" /></label>
                  <label className="mf-field"><span className="mf-label">Reporter PIN</span><input required type="password" inputMode="numeric" autoComplete="current-password" minLength={4} maxLength={8} value={credentials.accessPin} onChange={(e) => setCredentials((c) => ({ ...c, accessPin: e.target.value.replace(/\D/g, "") }))} placeholder="4–8 digit PIN" /></label>
                  <button className="mf-btn mf-btn-primary" disabled={authorising}>{authorising ? "Verifying…" : "Verify Reporter Pass"}</button>
                </form>
              )}

              {mode === "REPORTER" && reporterContext && (
                <div className="mf-request-verified">
                  <span>✓</span>
                  <div>
                    <strong>{reporterContext.reporter?.displayName}</strong>
                    <small>{[
                      reporterContext.reporter?.reporterCode,
                      reporterContext.reporter?.department,
                      (reporterContext.plants || reporterContext.reporter?.plantCodes || []).join(", "),
                    ].filter(Boolean).join(" · ")}</small>
                  </div>
                  <button type="button" className="mf-btn" onClick={() => setReporterContext(null)}>Change</button>
                </div>
              )}
            </section>

            {((mode === "FLOW_SUITE" && sessionUser && flowContext) || (mode === "REPORTER" && reporterContext)) && (
              <section className="mf-request-card">
                <RequestForm
                  key={`${mode}-${context?.asset?.token || ""}-${context?.serviceDesk?.token || ""}-${reporterContext?.reporter?.id || sessionUser}`}
                  context={context}
                  identity={mode}
                  flowContext={flowContext}
                  reporterContext={reporterContext}
                  onSubmit={submitRequest}
                  submitting={submitting}
                />
              </section>
            )}
          </>
        )}

        {((mode === "FLOW_SUITE" && sessionUser) || (mode === "REPORTER" && reporterContext)) && recentRequests.length > 0 && (
          <section className="mf-request-card">
            <div className="mf-request-section-head"><div><span>MY REQUESTS</span><h2>Recent requests raised by you</h2></div><small>Last {Math.min(10, recentRequests.length)}</small></div>
            <div className="mf-request-history">
              {recentRequests.slice(0, 10).map((item) => (
                <div key={item.id}>
                  <span>{item.workNumber}</span>
                  <strong>{item.title}</strong>
                  <small>{[item.serviceDomain, item.status, fmtDate(item.requestedAt)].filter(Boolean).join(" · ")}</small>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mf-request-policy">
          <strong>How access works</strong>
          <p>
            A FlowSuite account can raise a request only when Admin has linked that username to an approved MachFlow Reporter profile (or the account is operational MachFlow staff). Employees without FlowSuite use a Reporter Pass with authorised plants and departments. Scanning a QR only identifies the exact machine, IT asset or service desk; it never grants permission by itself.
          </p>
        </section>
      </main>
    </div>
  );
}


export default function MachFlowRequestPortal() {
  return (
    <MachFlowThemeProvider>
      <MachFlowRequestPortalContent />
    </MachFlowThemeProvider>
  );
}
