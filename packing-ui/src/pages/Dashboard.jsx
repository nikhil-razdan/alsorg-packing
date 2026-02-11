import { useEffect, useState } from "react";
import StatusDonutChart from "../dashboard/components/StatusDonutChart";
import StatusLineChart from "../dashboard/components/StatusLineChart";
import StatusBarChart from "../dashboard/components/StatusBarChart";
import ActivityFeed from "../dashboard/components/ActivityFeed";
import ReportViewerModal from "../dashboard/components/ReportViewerModal";

import {
  fetchDashboardStats,
  fetchDashboardActivity,
} from "../dashboard/api/dashboardApi";

/* ===================== SMALL COMPONENT ===================== */

function StatCard({ title, value, subtle }) {
  return (
    <div style={statCard}>
      <div style={cardHighlight} />
      <p style={statTitle}>{title}</p>
      <h2 style={statValue}>{value}</h2>
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
  const [chartType, setChartType] = useState("donut");

  // ✅ FIXED HERE
  const [activeReport, setActiveReport] = useState(null);

  const chartIndex = { donut: 0, line: 1, bar: 2 }[chartType];
  const reportIndex = {
    packing: 0,
    dispatch: 1,
    combined: 2,
    aging: 3,
  }[activeReport];

  useEffect(() => {
    let active = true;

    fetchDashboardStats()
      .then((data) => {
        if (!active || !data) return;
        setStats(data);
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
    <div style={page}>
      <div style={backgroundText}>Alsorg</div>

      <div style={content}>
        <h2 style={pageTitle}>Dashboard</h2>

        <div style={statsRow}>
          <StatCard title="Total Items In Inventory" value={stats.totalItems} subtle="Ready for packing" />
          <StatCard title="Stickers Generated" value={stats.stickersGenerated} subtle={`${stats.packedItems} packed`} />
          <StatCard title="Packed Items" value={stats.packedItems} subtle="Ready to dispatch" />
          <StatCard title="Dispatched" value={stats.dispatchedItems} subtle="Out of warehouse" />
        </div>

        <div style={mainGrid}>
          {/* LEFT PANEL */}
          <div style={panel}>
            <div style={toggleWrap}>
              <div
                style={{
                  ...toggleSlider,
                  transform: `translateX(${chartIndex * 40}px)`,
                }}
              />
              <button style={toggleBtn} onClick={() => setChartType("donut")}><DonutIcon /></button>
              <button style={toggleBtn} onClick={() => setChartType("line")}><LineIcon /></button>
              <button style={toggleBtn} onClick={() => setChartType("bar")}><BarIcon /></button>
            </div>

            <div style={panelBody}>
              {chartType === "donut" && (
                <StatusDonutChart packed={stats.packedItems} dispatched={stats.dispatchedItems} pending={stats.totalItems} />
              )}
              {chartType === "line" && (
                <StatusLineChart packed={stats.packedItems} dispatched={stats.dispatchedItems} pending={stats.totalItems} />
              )}
              {chartType === "bar" && (
                <StatusBarChart packed={stats.packedItems} dispatched={stats.dispatchedItems} pending={stats.totalItems} />
              )}
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div style={panel}>
            <div style={toggleWrap}>
              <div
                style={{
                  ...reportSliderIndicator,
                  transform: activeReport ? `translateX(${reportIndex * 120}px)` : "translateX(0px)",
                  opacity: activeReport ? 1 : 0,
                }}
              />
              {[
                { key: "packing", label: "Packing Report" },
                { key: "dispatch", label: "Dispatch Report" },
                { key: "combined", label: "Combined Report" },
                { key: "aging", label: "Aging Report" },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveReport(item.key)}
                  style={reportToggleBtn}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div style={panelBody}>
              <ActivityFeed logs={activityLogs} />
            </div>
          </div>
        </div>

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

const page = {
  height: "100vh",
  padding: 16,
  background: "linear-gradient(135deg, #f5c542, #b8860b)",
  overflow: "hidden",
  position: "relative",
};

const backgroundText = {
  position: "absolute",
  fontSize: 130,
  fontWeight: 900,
  color: "rgba(255,255,255,0.07)",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  pointerEvents: "none",
};

const content = {
  position: "relative",
  zIndex: 1,
  height: "100%",
  display: "flex",
  flexDirection: "column",
};

const pageTitle = {
  fontSize: 22,
  fontWeight: 700,
  color: "#fff",
  marginBottom: 12,
};

const statsRow = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 10,
  marginBottom: 12,
};

const mainGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
  flex: 1,
};

const panel = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  background: "rgba(255,255,255,0.15)",
  borderRadius: 18,
  backdropFilter: "blur(10px)",
  padding: 12,
};

const panelBody = {
  flex: 1,
  overflow: "hidden",
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

const statCard = {
  position: "relative",
  padding: 12,
  borderRadius: 14,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0.15))",
  backdropFilter: "blur(10px)",
  color: "#fff",
};

const cardHighlight = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 30,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.25), transparent)",
};

const statTitle = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  opacity: 0.85,
};

const statValue = {
  fontSize: 26,
  fontWeight: 900,
  marginTop: 6,
  marginBottom: 4,
  lineHeight: 1,
};

const statSubtle = {
  fontSize: 11,
  fontWeight: 500,
  opacity: 0.75,
};

export default DashboardPage;