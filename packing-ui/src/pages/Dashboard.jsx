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

/* ===================== SMALL COMPONENT ===================== */

function StatCard({ title, value, subtle, darkMode }) {
  return (
    <div style={statCard(darkMode)}>
      <div style={cardHighlight} />
      <p style={statTitle(darkMode)}>{title}</p>
      <h2 style={statValue(darkMode)}>{value}</h2>
      {subtle && <div style={statSubtle}>{subtle}</div>}
    </div>
  );
}

/* ===================== ORIGINAL ICONS ===================== */

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

/* ===================== DASHBOARD ===================== */

function DashboardPage() {
  const [stats, setStats] = useState({
    totalItems: "—",
    packedItems: 0,
    dispatchedItems: 0,
    stickersGenerated: "—",
  });

  const [activityLogs, setActivityLogs] = useState([]);
  const [logistics, setLogistics] = useState(null);
  const [chartType, setChartType] = useState("donut");
  const pending =
    Number(stats.totalItems || 0) -
    Number(stats.packedItems || 0) -
    Number(stats.dispatchedItems || 0);
	
	const normalizeStats = (data) => ({
	  totalItems: Number(data?.totalItems ?? data?.total ?? 0),
	  packedItems: Number(data?.packedItems ?? data?.packed ?? 0),
	  dispatchedItems: Number(data?.dispatchedItems ?? data?.dispatched ?? 0),
	  stickersGenerated: Number(data?.stickersGenerated ?? data?.stickers ?? 0),
	});
	
  const [activeReport, setActiveReport] = useState(null);

  const chartIndex = { donut: 0, line: 1, bar: 2 }[chartType];
  const reportIndex = {
    packing: 0,
    dispatch: 1,
    combined: 2,
    aging: 3,
  }[activeReport];
  const [mode, setMode] = useState("inventory");
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    fetchLogisticsStats()
      .then(data => {
        console.log("🔥 LOGISTICS API:", data);
        setLogistics(data);
      })
      .catch(console.error);
  }, []);
  
  useEffect(() => {
    let active = true;

    fetchDashboardStats()
      .then((data) => {
        if (!active || !data) return;
		console.log("DASHBOARD API:", data); 
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
    <div style={page(darkMode)}>
      <div style={backgroundText(darkMode)}>Alsorg</div>

      <div style={content}>
        <h2 style={pageTitle(darkMode)}>Dashboard</h2>
		<div
		  style={{
		    display: "flex",
		    justifyContent: "space-between",
		    alignItems: "center",
		    marginBottom: 15,
		  }}
		>

		  <div style={{ display: "flex", gap: 10 }}>
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
		  </div>

		  <button
		    onClick={() => setDarkMode(!darkMode)}
		    style={themeBtn(darkMode)}
		  >
		    {darkMode ? "☀ Classic" : "🌙 Dark Mode"}
		  </button>

		</div>
		{mode === "inventory" && (
		  <>
		    <div style={statsRow}>
		      <StatCard darkMode={darkMode} title="Total Items In Inventory" value={Number(stats.totalItems || 0)} />
		      <StatCard darkMode={darkMode} title="Stickers Generated" value={Number(stats.stickersGenerated || 0)} />
		      <StatCard darkMode={darkMode} title="Packed Items" value={Number(stats.packedItems || 0)} />
		      <StatCard darkMode={darkMode} title="Dispatched" value={Number(stats.dispatchedItems || 0)} />
		    </div>

		    <div style={mainGrid}>
		      {/* INVENTORY CHART */}
		      <div style={panel(darkMode)}>
		        <div style={toggleWrap}>
		          <div
		            style={{
		              ...toggleSlider,
		              transform: `translateX(${chartIndex * 40}px)`
		            }}
		          />
		          <button style={toggleBtn} onClick={() => setChartType("donut")}><DonutIcon /></button>
		          <button style={toggleBtn} onClick={() => setChartType("line")}><LineIcon /></button>
		          <button style={toggleBtn} onClick={() => setChartType("bar")}><BarIcon /></button>
		        </div>

		        <div style={panelBody}>
		          {chartType === "donut" && (
		            <StatusDonutChart packed={stats.packedItems} dispatched={stats.dispatchedItems} pending={pending} />
		          )}
		          {chartType === "line" && (
		            <StatusLineChart packed={stats.packedItems} dispatched={stats.dispatchedItems} pending={pending} />
		          )}
		          {chartType === "bar" && (
		            <StatusBarChart packed={stats.packedItems} dispatched={stats.dispatchedItems} pending={pending} />
		          )}
		        </div>
		      </div>

		      {/* INVENTORY ACTIVITY */}
		      <div style={panel(darkMode)}>
		        <ActivityFeed logs={activityLogs} />
		      </div>
		    </div>
		  </>
		)}

		{mode === "logistics" && logistics && (
		  <>
		    <div style={statsRow}>
			<StatCard
			  darkMode={darkMode}
			  title="Working Trips"
			  value={Number(logistics?.totalTrips || 0)}
			/>

			<StatCard
			  darkMode={darkMode}
			  title="Total Loaders"
			  value={Number(logistics?.totalLoaders || 0)}
			/>

			<StatCard
			  darkMode={darkMode}
			  title="Efficiency"
			  value={Number(logistics?.efficiency || 0).toFixed(2)}
			/>

			<StatCard
			  darkMode={darkMode}
			  title="Active Drivers"
			  value={Object.keys(logistics?.drivers || {}).length}
			/>
		    </div>

		    <div style={mainGrid}>
		      {/* LOGISTICS ANALYTICS */}
		      <div style={panel(darkMode)}>
		        <AnalyticsGrid data={logistics} />
		      </div>

		      {/* FUTURE LOGISTICS ACTIVITY */}
		      <div style={panel(darkMode)}>
		        <div style={{ color: "#fff", fontWeight: 600 }}>
		          🚚 Logistics activity coming soon
		        </div>
		      </div>
		    </div>
		  </>
		)}

        
		{mode === "inventory" && localStorage.getItem("role") === "ADMIN" && (
		  <div style={adminPanel(darkMode)}>
		    <h3 style={{ color: "#fff", marginBottom: 10 }}>
		      Scheduled Reports
		    </h3>
		    <ScheduledReports />
		  </div>
		)}
		

        {/* MODALS */}
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
    </div>
  );
}

/* ===================== STYLES (unchanged from your working version) ===================== */

const page = (darkMode) => ({
  minHeight: "100vh",
  padding: 16,
  background: darkMode
    ? "linear-gradient(135deg, #000000, #111111)"
    : "linear-gradient(135deg, #f5c542, #b8860b)",
  overflowX: "hidden",
  overflowY: "auto",
  position: "relative",
});

const adminPanel = (darkMode) => ({
  marginTop: 20,
  background: darkMode
    ? "rgba(15,15,15,0.92)"
    : "rgba(255,255,255,0.15)",
  backdropFilter: "blur(10px)",
  borderRadius: 18,
  padding: 14,
  border: darkMode
    ? "1px solid rgba(255,215,0,0.25)"
    : "none",
});

const backgroundText = (darkMode) => ({
  position: "absolute",
  fontSize: 130,
  fontWeight: 900,
  color: darkMode
    ? "rgba(255,215,0,0.08)"
    : "rgba(255,255,255,0.07)",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  pointerEvents: "none",
});

const content = {
  position: "relative",
  zIndex: 1,
  height: "100%",
  display: "flex",
  flexDirection: "column",
};

const pageTitle = (darkMode) => ({
  marginTop: 0,
  fontSize: 28,
  fontWeight: 700,
  color: darkMode ? "#FFD700" : "#fff",
  marginBottom: 12,
  textShadow: darkMode
    ? "0 0 10px rgba(255,215,0,0.7)"
    : "none",
});

const statsRow = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 10,
  marginBottom: 12,
};

const mainGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gridAutoRows: "300px",
  gap: 14,
  flex: 1,
};

const panel = (darkMode) => ({
  display: "flex",
  flexDirection: "column",
  height: "100%",
  background: darkMode
    ? "rgba(15,15,15,0.92)"
    : "rgba(255,255,255,0.15)",
  borderRadius: 18,
  backdropFilter: "blur(10px)",
  padding: 12,
  border: darkMode
    ? "1px solid rgba(255,215,0,0.25)"
    : "none",
  boxShadow: darkMode
    ? "0 0 18px rgba(255,215,0,0.12)"
    : "none",
});

const panelBody = {
  flex: 1,
  overflowY: "auto",
};

const toggleWrap = {
  position: "relative",
  display: "inline-flex",
  gap: 8,
  padding: 5,
  marginBottom: 10,
  borderRadius: 999,
  background: "rgba(255,255,255,0.2)",
};

const toggleBtn = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  border: "none",
  background: "transparent",
  color: "#fff",
  cursor: "pointer",
  zIndex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const toggleSlider = {
  position: "absolute",
  top: 5,
  left: 5,
  width: 32,
  height: 32,
  borderRadius: "50%",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.25))",
  transition: "transform 0.35s cubic-bezier(.4,0,.2,1)",
};

const reportToggleBtn = {
  width: 110,
  height: 32,
  borderRadius: 999,
  border: "none",
  background: "transparent",
  color: "#fff",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  zIndex: 1,
};

const reportSliderIndicator = {
  position: "absolute",
  top: 5,
  left: 5,
  width: 110,
  height: 32,
  borderRadius: 999,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.25))",
  transition: "transform 0.35s cubic-bezier(.4,0,.2,1)",
};

const statCard = (darkMode) => ({
  position: "relative",
  padding: 12,
  borderRadius: 14,
  background: darkMode
    ? "linear-gradient(180deg, rgba(35,35,35,0.95), rgba(10,10,10,0.95))"
    : "linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0.15))",
  backdropFilter: "blur(10px)",
  color: darkMode ? "#FFD700" : "#fff",
  border: darkMode
    ? "1px solid rgba(255,215,0,0.2)"
    : "none",
  boxShadow: darkMode
    ? "0 0 14px rgba(255,215,0,0.12)"
    : "none",
});

const cardHighlight = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 30,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.25), transparent)",
};

const statTitle = (darkMode) => ({
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  opacity: 0.9,
  color: darkMode ? "#ffffff" : "#fff",
});

const statValue = (darkMode) => ({
  fontSize: 26,
  fontWeight: 900,
  marginTop: 6,
  marginBottom: 4,
  lineHeight: 1,
  color: darkMode ? "#FFD700" : "#fff",
  textShadow: darkMode
    ? "0 0 12px rgba(255,215,0,0.6)"
    : "none",
});

const statSubtle = {
  fontSize: 11,
  fontWeight: 500,
  opacity: 0.75,
};

const modeBtn = (active, darkMode) => ({
  padding: "8px 16px",
  borderRadius: 20,
  border: darkMode
    ? "1px solid rgba(255,215,0,0.3)"
    : "none",
  cursor: "pointer",
  background: active
    ? darkMode
      ? "#FFD700"
      : "#fff"
    : darkMode
      ? "rgba(30,30,30,0.9)"
      : "rgba(255,255,255,0.3)",
  color: active
    ? "#111"
    : darkMode
      ? "#fff"
      : "#fff",
  fontWeight: 600,
  boxShadow: darkMode
    ? "0 0 12px rgba(255,215,0,0.15)"
    : "none",
});

const themeBtn = (darkMode) => ({
  padding: "8px 16px",
  borderRadius: 20,
  border: darkMode
    ? "1px solid rgba(255,215,0,0.4)"
    : "none",
  cursor: "pointer",
  background: darkMode
    ? "linear-gradient(135deg, #111, #222)"
    : "#111",
  color: darkMode ? "#FFD700" : "#fff",
  fontWeight: 700,
  boxShadow: darkMode
    ? "0 0 18px rgba(255,215,0,0.25)"
    : "0 0 10px rgba(0,0,0,0.2)",
});

export default DashboardPage;