import { useEffect, useState } from "react";
import StatusDonutChart from "../dashboard/components/StatusDonutChart";
import StatusLineChart from "../dashboard/components/StatusLineChart";
import StatusBarChart from "../dashboard/components/StatusBarChart";
import ActivityFeed from "../dashboard/components/ActivityFeed";
import ReportViewerModal from "../dashboard/components/ReportViewerModal";
import ScheduledReports from "../dashboard/components/ScheduledReports";
import {
  fetchDashboardStats,
  fetchDashboardActivity,
  fetchLogisticsStats,
} from "../dashboard/api/dashboardApi";
import AnalyticsGrid from "../dashboard/components/AnalyticsGrid";
import LogisticsShiftModal from "../dashboard/components/LogisticsShiftModal";
import LogisticsDashboard from "../dashboard/components/LogisticsDashboard";\

function StatCard({ title, value, subtle, accent = "#60a5fa", darkMode }) {
  return (
    <div style={statCard(darkMode, accent)}>
      <div style={cardAccent(accent)} />
      <p style={statTitle(darkMode)}>{title}</p>
      <h2 style={statValue(darkMode)}>{value}</h2>
      {subtle && <div style={statSubtle(darkMode)}>{subtle}</div>}
    </div>
  );
}

const DonutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const LineIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <polyline
      points="3,17 9,11 13,15 21,7"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
    />
  </svg>
);

const BarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <rect x="4" y="10" width="4" height="10" fill="currentColor" />
    <rect x="10" y="6" width="4" height="14" fill="currentColor" />
    <rect x="16" y="3" width="4" height="17" fill="currentColor" />
  </svg>
);


function DashboardPage() {
  const [stats, setStats] = useState({
    totalItems: 0,
    packedItems: 0,
    dispatchedItems: 0,
    stickersGenerated: 0,
  });

  const [activityLogs, setActivityLogs] = useState([]);
  const [logistics, setLogistics] = useState(null);
  const [chartType, setChartType] = useState("donut");
  const [activeReport, setActiveReport] = useState(null);
  const [mode, setMode] = useState("inventory");
  const [darkMode, setDarkMode] = useState(false);
  
  const [shiftModal, setShiftModal] =
    useState(false);
	
  const pending = Math.max(
    Number(stats.totalItems || 0) -
      Number(stats.packedItems || 0) -
      Number(stats.dispatchedItems || 0),
    0
  );

  const normalizeStats = (data) => ({
    totalItems: Number(data?.totalItems ?? data?.total ?? 0),
    packedItems: Number(data?.packedItems ?? data?.packed ?? 0),
    dispatchedItems: Number(data?.dispatchedItems ?? data?.dispatched ?? 0),
    stickersGenerated: Number(data?.stickersGenerated ?? data?.stickers ?? 0),
  });

  const chartIndex = { donut: 0, line: 1, bar: 2 }[chartType];
  const reportIndex =
    {
      packing: 0,
      dispatch: 1,
      combined: 2,
      aging: 3,
    }[activeReport] ?? 0;

  useEffect(() => {
    fetchLogisticsStats()
      .then((data) => {
        setLogistics(data);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    let active = true;

    fetchDashboardStats()
      .then((data) => {
        if (!active || !data) return;
        setStats(normalizeStats(data));
      })
      .catch(console.error);

    fetchDashboardActivity(10)
      .then((logs) => {
        if (!active) return;
        setActivityLogs(logs || []);
      })
      .catch(() => setActivityLogs([]));

    return () => {
      active = false;
    };
  }, []);

  return (
    <div style={page(mode, darkMode)}>
      <div style={backgroundText(mode, darkMode)}>Alsorg</div>

      <div style={content}>
        <div style={heroRow}>
          <div>
            <h2 style={heroTitle(mode, darkMode)}>Dashboard</h2>
            <div style={heroSubtitle(mode, darkMode)}>
              Inventory and logistics overview in one workspace
            </div>
          </div>

          <div style={heroActions}>
            <button
              onClick={() => setMode("inventory")}
              style={modeBtn(mode === "inventory", darkMode)}
            >
              📦 Inventory
            </button>

            <button
              onClick={() => setMode("logistics")}
              style={modeBtn(mode === "logistics", darkMode)}
            >
              🚚 Logistics
            </button>

            <button
              onClick={() => setDarkMode((v) => !v)}
              style={themeBtn(darkMode)}
            >
              {darkMode ? "☀ Classic" : "🌙 Dark Mode"}
            </button>
          </div>
        </div>

        {mode === "inventory" && (
          <>
            <div style={kpiGrid}>
              <StatCard
                darkMode={darkMode}
                accent="#60a5fa"
                title="Total Items In Inventory"
                value={Number(stats.totalItems || 0)}
              />
              <StatCard
                darkMode={darkMode}
                accent="#f472b6"
                title="Stickers Generated"
                value={Number(stats.stickersGenerated || 0)}
              />
              <StatCard
                darkMode={darkMode}
                accent="#34d399"
                title="Packed Items"
                value={Number(stats.packedItems || 0)}
              />
              <StatCard
                darkMode={darkMode}
                accent="#f59e0b"
                title="Pending Items"
                value={pending}
              />
            </div>

            <div style={reportHeaderRow}>
              <div>
                <div style={sectionTitle(mode, darkMode)}>Reports Center</div>
                <div style={sectionSubtitle(mode, darkMode)}>
                  View, export and analyze inventory reports
                </div>
              </div>

              <div style={reportToggleGroup(darkMode)}>
                <div
                  style={{
                    ...reportSliderIndicator(darkMode),
                    transform: `translateX(${reportIndex * 118}px)`,
                  }}
                />

                <button
                  style={{
                    ...reportToggleBtn,
                    color:
                      activeReport === "packing"
                        ? "#111"
                        : darkMode
                        ? "#fff"
                        : "#111827",
                  }}
                  onClick={() => setActiveReport("packing")}
                >
                  📦 Packing
                </button>

                <button
                  style={{
                    ...reportToggleBtn,
                    color:
                      activeReport === "dispatch"
                        ? "#111"
                        : darkMode
                        ? "#fff"
                        : "#111827",
                  }}
                  onClick={() => setActiveReport("dispatch")}
                >
                  🚚 Dispatch
                </button>

                <button
                  style={{
                    ...reportToggleBtn,
                    color:
                      activeReport === "combined"
                        ? "#111"
                        : darkMode
                        ? "#fff"
                        : "#111827",
                  }}
                  onClick={() => setActiveReport("combined")}
                >
                  📊 Combined
                </button>

                <button
                  style={{
                    ...reportToggleBtn,
                    color:
                      activeReport === "aging"
                        ? "#111"
                        : darkMode
                        ? "#fff"
                        : "#111827",
                  }}
                  onClick={() => setActiveReport("aging")}
                >
                  ⏳ Aging
                </button>
              </div>
            </div>

            <div style={workspaceGrid}>
              <div style={panelSurface(darkMode)}>
                <div style={chartToggleWrap(darkMode)}>
                  <div
                    style={{
                      ...chartSlider(darkMode),
                      transform: `translateX(${chartIndex * 40}px)`,
                    }}
                  />
                  <button
                    style={chartToggleBtn(darkMode)}
                    onClick={() => setChartType("donut")}
                  >
                    <DonutIcon />
                  </button>
                  <button
                    style={chartToggleBtn(darkMode)}
                    onClick={() => setChartType("line")}
                  >
                    <LineIcon />
                  </button>
                  <button
                    style={chartToggleBtn(darkMode)}
                    onClick={() => setChartType("bar")}
                  >
                    <BarIcon />
                  </button>
                </div>

                <div style={panelBody}>
                  {chartType === "donut" && (
                    <StatusDonutChart
                      darkMode={darkMode}
                      packed={stats.packedItems}
                      dispatched={stats.dispatchedItems}
                      pending={pending}
                    />
                  )}
                  {chartType === "line" && (
                    <StatusLineChart
                      darkMode={darkMode}
                      packed={stats.packedItems}
                      dispatched={stats.dispatchedItems}
                      pending={pending}
                    />
                  )}
                  {chartType === "bar" && (
                    <StatusBarChart
                      darkMode={darkMode}
                      packed={stats.packedItems}
                      dispatched={stats.dispatchedItems}
                      pending={pending}
                    />
                  )}
                </div>
              </div>

              <div style={panelSurface(darkMode)}>
                <ActivityFeed logs={activityLogs} darkMode={darkMode} />
              </div>
            </div>

            {localStorage.getItem("role") === "ADMIN" && (
              <div style={adminPanel(darkMode)}>
                <h3 style={adminPanelTitle(darkMode)}>Scheduled Reports</h3>
                <ScheduledReports darkMode={darkMode} />
              </div>
            )}
          </>
        )}

		{mode === "logistics" && logistics && (
		  <LogisticsDashboard
		    logistics={logistics}
		    setShiftModal={setShiftModal}
		    StatCard={StatCard}
		    AnalyticsGrid={AnalyticsGrid}
		  />
		)}

        <ReportViewerModal
          open={activeReport === "packing"}
          onClose={() => setActiveReport(null)}
          title="Packing Report"
          fetchUrl="/api/reports/packing"
          exportCsvUrl="/api/reports/export/packing/csv"
          exportExcelUrl="/api/reports/export/packing/excel"
        />
        <ReportViewerModal
          open={activeReport === "dispatch"}
          onClose={() => setActiveReport(null)}
          title="Dispatch Report"
          fetchUrl="/api/reports/dispatch"
          exportCsvUrl="/api/reports/export/dispatch/csv"
          exportExcelUrl="/api/reports/export/dispatch/excel"
        />
        <ReportViewerModal
          open={activeReport === "combined"}
          onClose={() => setActiveReport(null)}
          title="Combined Report"
          fetchUrl="/api/reports/combined"
          exportCsvUrl="/api/reports/export/combined/csv"
          exportExcelUrl="/api/reports/export/combined/excel"
        />
        <ReportViewerModal
          open={activeReport === "aging"}
          onClose={() => setActiveReport(null)}
          title="Inventory Aging Report"
          fetchUrl="/api/reports/inventory-aging"
          exportCsvUrl="/api/reports/export/inventory-aging/csv"
          exportExcelUrl="/api/reports/export/inventory-aging/excel"
        />
      </div>
	  <LogisticsShiftModal
	    open={shiftModal}
	    onClose={() =>
	      setShiftModal(false)
	    }
	    onCreated={() => {
	      fetchLogisticsStats()
	        .then(setLogistics);
	    }}
	  />
    </div>
  );
}

const page = (mode, darkMode) => ({
  minHeight: "100vh",
  padding: 18,
  position: "relative",
  overflowX: "hidden",
  overflowY: "auto",

  background:
    mode === "inventory"
      ? darkMode
        ? "linear-gradient(135deg, #0b1020 0%, #111827 45%, #0f172a 100%)"
        : `
          radial-gradient(circle at top left, rgba(96,165,250,0.18), transparent 25%),
          radial-gradient(circle at bottom right, rgba(56,189,248,0.14), transparent 25%),
          linear-gradient(180deg, #eaf3ff 0%, #f6f9ff 100%)
        `
      : `
          radial-gradient(circle at top left, rgba(59,130,246,0.16), transparent 22%),
          radial-gradient(circle at bottom right, rgba(14,165,233,0.12), transparent 24%),
          linear-gradient(135deg, #020617 0%, #0f172a 45%, #111827 100%)
        `,

  backgroundAttachment: "fixed",
});

const backgroundText = (mode, darkMode) => ({
  position: "absolute",
  fontSize: mode === "inventory" ? 150 : 130,
  fontWeight: 900,
  background:
    mode === "inventory"
      ? darkMode
        ? "linear-gradient(180deg, rgba(96,165,250,0.12), rgba(96,165,250,0.03))"
        : "linear-gradient(180deg, rgba(255,255,255,0.20), rgba(255,255,255,0.05))"
      : darkMode
      ? "linear-gradient(180deg, rgba(255,215,0,0.16), rgba(255,215,0,0.04))"
      : "linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.04))",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  pointerEvents: "none",
  letterSpacing: 8,
  filter: "blur(1px)",
  opacity: 0.55,
});

const content = {
  position: "relative",
  zIndex: 1,
  height: "100%",
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

const heroRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 4,
};

const heroTitle = (mode, darkMode) => ({
  margin: 0,
  fontSize: 28,
  fontWeight: 800,
  color:
    mode === "inventory"
      ? darkMode
        ? "#e2e8f0"
        : "#0f172a"
      : darkMode
      ? "#FFD700"
      : "#fff",
  letterSpacing: 0.2,
});

const heroSubtitle = (mode, darkMode) => ({
  marginTop: 6,
  fontSize: 13,
  color:
    mode === "inventory"
      ? darkMode
        ? "rgba(226,232,240,0.72)"
        : "#475569"
      : darkMode
      ? "rgba(255,255,255,0.72)"
      : "rgba(255,255,255,0.88)",
});

const heroActions = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const modeBtn = (active, darkMode) => ({
  padding: "8px 16px",
  borderRadius: 999,
  border: darkMode
    ? "1px solid rgba(255,255,255,0.12)"
    : "1px solid rgba(96,165,250,0.22)",
  cursor: "pointer",
  background: active
    ? darkMode
      ? "linear-gradient(180deg, #e2e8f0, #cbd5e1)"
      : "linear-gradient(180deg, #ffffff, #e2e8f0)"
    : darkMode
    ? "rgba(15,23,42,0.9)"
    : "rgba(255,255,255,0.75)",
  color: active ? "#0f172a" : darkMode ? "#fff" : "#0f172a",
  fontWeight: 700,
  boxShadow: darkMode
    ? "0 8px 20px rgba(0,0,0,0.22)"
    : "0 8px 20px rgba(15,23,42,0.08)",
});

const themeBtn = (darkMode) => ({
  padding: "8px 16px",
  borderRadius: 999,
  border: darkMode
    ? "1px solid rgba(255,215,0,0.28)"
    : "1px solid rgba(96,165,250,0.20)",
  cursor: "pointer",
  background: darkMode
    ? "linear-gradient(135deg, #111, #222)"
    : "linear-gradient(180deg, #ffffff, #dbeafe)",
  color: darkMode ? "#FFD700" : "#0f172a",
  fontWeight: 800,
  boxShadow: darkMode
    ? "0 0 18px rgba(255,215,0,0.15)"
    : "0 8px 20px rgba(15,23,42,0.10)",
});

const kpiGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 14,
};

const logisticsKpiGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 10,
  marginBottom: 12,
};

const workspaceGrid = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 0.85fr)",
  gap: 14,
  alignItems: "stretch",
};

const panelSurface = (darkMode) => ({
  display: "flex",
  flexDirection: "column",
  minHeight: 300,
  padding: 18,
  borderRadius: 24,
  background: darkMode
    ? "linear-gradient(180deg, rgba(15,23,42,0.94), rgba(15,23,42,0.90))"
    : "linear-gradient(180deg, rgba(255,255,255,0.94), rgba(248,250,252,0.95))",
  border: darkMode
    ? "1px solid rgba(148,163,184,0.18)"
    : "1px solid rgba(148,163,184,0.18)",
  boxShadow: darkMode
    ? "0 18px 40px rgba(2,6,23,0.28)"
    : "0 18px 40px rgba(15,23,42,0.10)",
  overflow: "hidden",
});

const panelBody = {
  flex: 1,
  overflow: "hidden",
  marginTop: 8,
};

const createShiftBtn = {
  height: 44,
  padding: "0 18px",
  borderRadius: 12,
  border: "none",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow:
    "0 10px 25px rgba(37,99,235,0.35)",
};

const chartToggleWrap = (darkMode) => ({
  position: "relative",
  display: "inline-flex",
  gap: 8,
  padding: 5,
  borderRadius: 999,
  background: darkMode ? "rgba(15,23,42,0.9)" : "rgba(219,234,254,0.75)",
  border: darkMode
    ? "1px solid rgba(148,163,184,0.14)"
    : "1px solid rgba(148,163,184,0.15)",
  width: "fit-content",
});

const chartToggleBtn = (darkMode) => ({
  width: 32,
  height: 32,
  borderRadius: "50%",
  border: "none",
  background: "transparent",
  color: darkMode ? "#fff" : "#0f172a",
  cursor: "pointer",
  zIndex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});

const chartSlider = (darkMode) => ({
  position: "absolute",
  top: 5,
  left: 5,
  width: 32,
  height: 32,
  borderRadius: "50%",
  background: darkMode
    ? "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.25))"
    : "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(219,234,254,0.75))",
  transition: "transform 0.35s cubic-bezier(.4,0,.2,1)",
});

const reportHeaderRow = {
  marginBottom: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap",
};

const sectionTitle = (mode, darkMode) => ({
  fontSize: 22,
  fontWeight: 800,
  color:
    mode === "inventory"
      ? darkMode
        ? "#e2e8f0"
        : "#0f172a"
      : darkMode
      ? "#FFD700"
      : "#fff",
});

const sectionSubtitle = (mode, darkMode) => ({
  fontSize: 13,
  marginTop: 4,
  color:
    mode === "inventory"
      ? darkMode
        ? "rgba(226,232,240,0.72)"
        : "#64748b"
      : darkMode
      ? "rgba(255,255,255,0.72)"
      : "rgba(255,255,255,0.88)",
});

const reportToggleGroup = (darkMode) => ({
  position: "relative",
  display: "inline-flex",
  gap: 8,
  padding: 5,
  borderRadius: 999,
  background: darkMode ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.78)",
  border: darkMode
    ? "1px solid rgba(148,163,184,0.14)"
    : "1px solid rgba(148,163,184,0.15)",
  overflow: "hidden",
  boxShadow: darkMode
    ? "0 12px 30px rgba(2,6,23,0.22)"
    : "0 12px 30px rgba(15,23,42,0.08)",
});

const reportToggleBtn = {
  width: 110,
  height: 32,
  borderRadius: 999,
  border: "none",
  background: "transparent",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  zIndex: 1,
};

const reportSliderIndicator = (darkMode) => ({
  position: "absolute",
  top: 5,
  left: 5,
  width: 110,
  height: 32,
  borderRadius: 999,
  background: darkMode
    ? "linear-gradient(180deg, rgba(255,255,255,0.80), rgba(255,255,255,0.45))"
    : "linear-gradient(180deg, #e2e8f0, #cbd5e1)",
  transition: "transform 0.35s cubic-bezier(.4,0,.2,1)",
});

const statCard = (darkMode, accent) => ({
  position: "relative",
  padding: "20px 20px 18px",
  borderRadius: 22,
  background: darkMode
    ? "linear-gradient(180deg, rgba(15,23,42,0.94), rgba(15,23,42,0.88))"
    : "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.92))",
  border: darkMode
    ? "1px solid rgba(148,163,184,0.16)"
    : "1px solid rgba(148,163,184,0.18)",
  boxShadow: darkMode
    ? "0 18px 35px rgba(2,6,23,0.24)"
    : "0 18px 35px rgba(15,23,42,0.08)",
  overflow: "hidden",
  minHeight: 118,
});

const cardAccent = (accent) => ({
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 4,
  background: accent,
});

const statTitle = (darkMode) => ({
  color: darkMode ? "#cbd5e1" : "#64748b",
  marginBottom: 10,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
});

const statValue = (darkMode) => ({
  margin: 0,
  fontSize: 30,
  fontWeight: 900,
  lineHeight: 1,
  color: darkMode ? "#f8fafc" : "#0f172a",
});

const statSubtle = (darkMode) => ({
  marginTop: 8,
  fontSize: 11,
  fontWeight: 600,
  color: darkMode ? "#94a3b8" : "#64748b",
});

const adminPanel = (darkMode) => ({
  marginTop: 2,
  borderRadius: 24,
  padding: 18,
  background: darkMode
    ? "linear-gradient(180deg, rgba(15,23,42,0.94), rgba(15,23,42,0.88))"
    : "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(248,250,252,0.92))",
  border: darkMode
    ? "1px solid rgba(148,163,184,0.16)"
    : "1px solid rgba(148,163,184,0.18)",
  boxShadow: darkMode
    ? "0 18px 35px rgba(2,6,23,0.24)"
    : "0 18px 35px rgba(15,23,42,0.08)",
});

const adminPanelTitle = (darkMode) => ({
  color: darkMode ? "#f8fafc" : "#0f172a",
  marginBottom: 12,
  fontSize: 16,
  fontWeight: 800,
});

const logisticsHero = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 18,
  flexWrap: "wrap",
};

const logisticsHeading = {
  fontSize: 28,
  fontWeight: 900,
  color: "#f8fafc",
};

const logisticsSubheading = {
  color: "#94a3b8",
  marginTop: 6,
  fontSize: 13,
};

const logisticsFilters = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const logisticsInput = {
  padding: "10px 14px",
  borderRadius: 12,
  border:
    "1px solid rgba(255,255,255,0.08)",
  background: "#0f172a",
  color: "#fff",
  outline: "none",
};

const logisticsMainGrid = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 16,
};

const logisticsMainPanel = {
  background:
    "linear-gradient(180deg,#020617,#0f172a)",
  borderRadius: 26,
  padding: 18,
  border:
    "1px solid rgba(255,255,255,0.08)",
  boxShadow:
    "0 20px 50px rgba(0,0,0,0.45)",
};

export default DashboardPage;