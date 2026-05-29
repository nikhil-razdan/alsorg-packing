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
import LogisticsShiftModal from "../dashboard/components/logistics/LogisticsShiftModal";
import LogisticsDashboard from "../dashboard/components/logistics/LogisticsDashboard";
import InventorySidebar from
  "../dashboard/components/inventory/InventorySidebar";

function StatCard({ title, value, subtle, accent = "#60a5fa"}) {
  return (
    <div style={statCard(accent)}>
      <div style={cardAccent(accent)} />
      <p style={statTitle}>{title}</p>
      <h2 style={statValue}>{value}</h2>
      {subtle && <div style={statSubtle}>{subtle}</div>}
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
  const [inventorySection, setInventorySection] =
    useState("summary");
	
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
    <div style={page}>
      <div style={backgroundText}>Alsorg</div>

      <div style={content}>
        <div style={heroRow}>
          <div>
            <h2 style={heroTitle}>Dashboard</h2>
            <div style={heroSubtitle}>
              Inventory and logistics overview in one workspace
            </div>
          </div>

          <div style={heroActions}>
            <button
              onClick={() => setMode("inventory")}
              style={modeBtn(mode === "inventory")}
            >
              📦 Inventory
            </button>

            <button
              onClick={() => setMode("logistics")}
              style={modeBtn(mode === "logistics")}
            >
              🚚 Logistics
            </button>
          </div>
        </div>

		{mode === "inventory" && (
		  <div style={inventoryLayout}>
		    <InventorySidebar
		      section={inventorySection}
		      setSection={setInventorySection}
		    />

		    <div style={inventoryMain}>
			{inventorySection === "summary" && (
			<div style={kpiGrid}>
		    <StatCard
		      accent="#60a5fa"
		      title="Total Items In Inventory"
		      value={Number(stats.totalItems || 0)}
		      subtle="Warehouse Stock"
		    />

		    <StatCard
		      accent="#f472b6"
		      title="Stickers Generated"
		      value={Number(stats.stickersGenerated || 0)}
		      subtle="Labels Printed"
		    />

		    <StatCard
		      accent="#34d399"
		      title="Packed Items"
		      value={Number(stats.packedItems || 0)}
		      subtle="Ready For Dispatch"
		    />

		    <StatCard
		      accent="#f59e0b"
		      title="Pending Items"
		      value={pending}
		      subtle="Awaiting Processing"
		    />

		    <StatCard
		      accent="#8b5cf6"
		      title="Inventory Accuracy"
		      value="98.4%"
		      subtle="Warehouse Precision"
		    />

		    <StatCard
		      accent="#06b6d4"
		      title="Daily Throughput"
		      value="1,284"
		      subtle="Items Processed"
		    />

		    <StatCard
		      accent="#ef4444"
		      title="Delayed Dispatches"
		      value="12"
		      subtle="Needs Attention"
		    />

		    <StatCard
		      accent="#22c55e"
		      title="Operational Efficiency"
		      value="94%"
		      subtle="AI Optimized"
		    />
		  </div>
	  )}
	  
            <div style={reportHeaderRow}>
              <div>
                <div style={sectionTitle}>Reports Center</div>
                <div style={sectionSubtitle}>
                  View, export and analyze inventory reports
                </div>
              </div>

              <div style={reportToggleGroup}>
                <div
                  style={{
                    ...reportSliderIndicator,
                    transform: `translateX(${reportIndex * 118}px)`,
                  }}
                />

                <button
                  style={{
                    ...reportToggleBtn,
					color:
					  activeReport === "packing"
					    ? "#fff"
					    : "rgba(255,255,255,.72)",
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
					    ? "#fff"
					    : "rgba(255,255,255,.72)",
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
					    ? "#fff"
					    : "rgba(255,255,255,.72)",
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
					    ? "#fff"
					    : "rgba(255,255,255,.72)",
                  }}
                  onClick={() => setActiveReport("aging")}
                >
                  ⏳ Aging
                </button>
              </div>
            </div>

			{inventorySection === "warehouse" && (
            <div style={workspaceGrid}>
              <div style={panelSurface}>
                <div style={chartToggleWrap}>
                  <div
                    style={{
                      ...chartSlider,
                      transform: `translateX(${chartIndex * 40}px)`,
                    }}
                  />
                  <button
                    style={chartToggleBtn}
                    onClick={() => setChartType("donut")}
                  >
                    <DonutIcon />
                  </button>
                  <button
                    style={chartToggleBtn}
                    onClick={() => setChartType("line")}
                  >
                    <LineIcon />
                  </button>
                  <button
                    style={chartToggleBtn}
                    onClick={() => setChartType("bar")}
                  >
                    <BarIcon />
                  </button>
                </div>

                <div style={panelBody}>
                  {chartType === "donut" && (
                    <StatusDonutChart
                      packed={stats.packedItems}
                      dispatched={stats.dispatchedItems}
                      pending={pending}
                    />
                  )}
                  {chartType === "line" && (
                    <StatusLineChart
                      packed={stats.packedItems}
                      dispatched={stats.dispatchedItems}
                      pending={pending}
                    />
                  )}
                  {chartType === "bar" && (
                    <StatusBarChart
                      packed={stats.packedItems}
                      dispatched={stats.dispatchedItems}
                      pending={pending}
                    />
                  )}
                </div>
              </div>

              <div style={panelSurface}>
                <ActivityFeed logs={activityLogs}  />
              </div>
            </div>
			)}
			
			{inventorySection === "analytics" && (
			<div style={analyticsSection}>
			  <div style={analyticsHeader}>
			    <div>
			      <div style={sectionTitle}>
			        Inventory Intelligence
			      </div>

			      <div style={sectionSubtitle}>
			        Advanced warehouse analytics and operational insights
			      </div>
			    </div>
			  </div>

			  <div style={analyticsGridLayout}>
			    <div style={analyticsCardLarge}>
			      <div style={analyticsCardTitle}>
			        Inventory Aging Analysis
			      </div>

			      <div style={agingGrid}>
			        <div style={agingItem("#22c55e")}>
			          <h2>62%</h2>
			          <span>0-7 Days</span>
			        </div>

			        <div style={agingItem("#3b82f6")}>
			          <h2>24%</h2>
			          <span>7-30 Days</span>
			        </div>

			        <div style={agingItem("#f59e0b")}>
			          <h2>11%</h2>
			          <span>30-90 Days</span>
			        </div>

			        <div style={agingItem("#ef4444")}>
			          <h2>3%</h2>
			          <span>90+ Days</span>
			        </div>
			      </div>
			    </div>

			    <div style={analyticsCard}>
			      <div style={analyticsCardTitle}>
			        Warehouse Utilization
			      </div>

			      <div style={metricValue}>
			        86%
			      </div>

			      <div style={metricSubtle}>
			        Rack occupancy across all zones
			      </div>
			    </div>

			    <div style={analyticsCard}>
			      <div style={analyticsCardTitle}>
			        Average Packing Time
			      </div>

			      <div style={metricValue}>
			        2.4m
			      </div>

			      <div style={metricSubtle}>
			        Per inventory item
			      </div>
			    </div>

			    <div style={analyticsCard}>
			      <div style={analyticsCardTitle}>
			        Sticker Failure Rate
			      </div>

			      <div style={metricValue}>
			        0.8%
			      </div>

			      <div style={metricSubtle}>
			        Printer & scan errors
			      </div>
			    </div>

			    <div style={analyticsCardWide}>
			      <div style={analyticsCardTitle}>
			        AI Operational Insights
			      </div>

			      <div style={insightsList}>
			        <div style={insightItem}>
			          Dispatch volume increased by 14%
			        </div>

			        <div style={insightItem}>
			          Packing efficiency improved this week
			        </div>

			        <div style={insightItem}>
			          Warehouse Zone B nearing capacity
			        </div>

			        <div style={insightItem}>
			          Sticker print failures reduced significantly
			        </div>
			      </div>
			    </div>
			  </div>
			</div>
			)}
			
			{inventorySection === "alerts" && (
			  <div style={analyticsCard}>
			    <div style={analyticsCardTitle}>
			      Live Inventory Alerts
			    </div>

			    <div style={insightsList}>
			      <div style={insightItem}>
			        ⚠ Warehouse Zone B near capacity
			      </div>

			      <div style={insightItem}>
			        ⚠ Dispatch delays detected
			      </div>

			      <div style={insightItem}>
			        ⚠ Sticker printer maintenance due
			      </div>

			      <div style={insightItem}>
			        ⚠ Packing queue exceeding threshold
			      </div>
			    </div>
			  </div>
			)}
			
			
            {localStorage.getItem("role") === "ADMIN" && (
              <div style={adminPanel}>
                <h3 style={adminPanelTitle}>Scheduled Reports</h3>
                <ScheduledReports />
              </div>
            )}
			  </div>
			</div>
        )}

		{mode === "logistics" && (
		  <LogisticsDashboard
		    logistics={logistics ?? emptyLogistics}
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

const page = {
  minHeight: "100vh",
  padding: 18,
  position: "relative",
  overflowX: "hidden",
  overflowY: "auto",

  background: `
    radial-gradient(circle at top left,
    rgba(59,130,246,0.16),
    transparent 22%),

    radial-gradient(circle at bottom right,
    rgba(14,165,233,0.12),
    transparent 24%),

    linear-gradient(
      135deg,
      #020617 0%,
      #0f172a 45%,
      #111827 100%
    )
  `,

  backgroundAttachment: "fixed",
};

const backgroundText = {
  position: "absolute",
  fontSize: 140,
  fontWeight: 900,

  background:
    "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03))",

  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",

  top: "50%",
  left: "50%",

  transform:
    "translate(-50%, -50%)",

  pointerEvents: "none",

  letterSpacing: 8,

  filter: "blur(1px)",

  opacity: 0.55,
};

const emptyLogistics = {
  totalTrips: 0,
  totalLoaders: 0,
  efficiency: 0,
  activeDrivers: 0,
  activeVehicles: 0,
  averageTripsPerDriver: 0,
  averageTripsPerVehicle: 0,
  tripsOverTime: {},
  shiftPerformance: {},
  vehicleUtilization: {},
  driverTrips: {},
  driverPerformance: {},
  overtimeAnalytics: {},
  tripsByLocation: {},
};

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

const heroTitle = {
  margin: 0,
  fontSize: 34,
  fontWeight: 900,
  color: "#fff",
  letterSpacing: 0.3,
};

const heroSubtitle = {
  marginTop: 6,
  fontSize: 14,
  color: "rgba(255,255,255,.72)",
};

const heroActions = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const modeBtn = (active) => ({
  height: 46,
  padding: "0 18px",

  borderRadius: 999,

  border: active
    ? "1px solid rgba(59,130,246,.4)"
    : "1px solid rgba(255,255,255,.06)",

  cursor: "pointer",

  background: active
    ? "linear-gradient(135deg,#2563eb,#3b82f6)"
    : "rgba(15,23,42,.78)",

  color: "#fff",

  fontWeight: 800,

  boxShadow: active
    ? "0 12px 28px rgba(37,99,235,.35)"
    : "none",

  transition: "all .25s ease",
});

const kpiGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",
  gap: 14,
};

const workspaceGrid = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 0.85fr)",
  gap: 14,
  alignItems: "stretch",
};

const panelSurface = {
  display: "flex",
  flexDirection: "column",

  minHeight: 300,

  padding: 18,

  borderRadius: 24,

  background:
    "rgba(15,23,42,.78)",

  border:
    "1px solid rgba(255,255,255,.06)",

  boxShadow:
    "0 18px 40px rgba(2,6,23,.34)",

  overflow: "hidden",

  backdropFilter: "blur(18px)",
};

const panelBody = {
  flex: 1,
  overflow: "hidden",
  marginTop: 8,
};

const chartToggleWrap = {
  position: "relative",

  display: "inline-flex",

  gap: 8,

  padding: 5,

  borderRadius: 999,

  background:
    "rgba(15,23,42,.92)",

  border:
    "1px solid rgba(255,255,255,.06)",

  width: "fit-content",
};

const chartToggleBtn = {
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

const chartSlider = {
  position: "absolute",

  top: 5,
  left: 5,

  width: 32,
  height: 32,

  borderRadius: "50%",

  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",

  transition:
    "transform .35s cubic-bezier(.4,0,.2,1)",
};

const reportHeaderRow = {
  marginBottom: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap",
};

const sectionTitle = {
  fontSize: 24,
  fontWeight: 900,
  color: "#fff",
};

const sectionSubtitle = {
  fontSize: 13,
  marginTop: 4,
  color: "rgba(255,255,255,.62)",
};

const reportToggleGroup = {
  position: "relative",

  display: "inline-flex",

  gap: 8,

  padding: 5,

  borderRadius: 999,

  background:
    "rgba(15,23,42,.92)",

  border:
    "1px solid rgba(255,255,255,.06)",

  overflow: "hidden",
};

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

const reportSliderIndicator = {
  position: "absolute",

  top: 5,
  left: 5,

  width: 110,
  height: 32,

  borderRadius: 999,

  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",

  transition:
    "transform .35s cubic-bezier(.4,0,.2,1)",
};

const cardAccent = (accent) => ({
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 4,
  background: accent,
});
const statCard = (accent) => ({
  position: "relative",

  padding: "20px 20px 18px",

  borderRadius: 22,

  background:
    "rgba(15,23,42,.78)",

  border:
    "1px solid rgba(255,255,255,.06)",

  boxShadow:
    "0 18px 35px rgba(2,6,23,.32)",

  overflow: "hidden",

  minHeight: 118,

  backdropFilter: "blur(18px)",
});

const statTitle = {
  color: "rgba(255,255,255,.62)",

  marginBottom: 10,

  fontSize: 12,

  fontWeight: 700,

  letterSpacing: "0.08em",

  textTransform: "uppercase",
};

const statValue = {
  margin: 0,

  fontSize: 30,

  fontWeight: 900,

  lineHeight: 1,

  color: "#fff",
};

const statSubtle = {
  marginTop: 8,

  fontSize: 11,

  fontWeight: 600,

  color: "rgba(255,255,255,.52)",
};

const adminPanel = {
  marginTop: 2,

  borderRadius: 24,

  padding: 18,

  background:
    "rgba(15,23,42,.78)",

  border:
    "1px solid rgba(255,255,255,.06)",

  boxShadow:
    "0 18px 35px rgba(2,6,23,.32)",

  backdropFilter: "blur(18px)",
};

const analyticsCardTitle = {
  fontSize: 16,

  fontWeight: 800,

  color: "#fff",

  marginBottom: 18,
};

const metricValue = {
  fontSize: 38,

  fontWeight: 900,

  color: "#fff",
};

const metricSubtle = {
  marginTop: 8,

  color: "rgba(255,255,255,.58)",

  fontSize: 13,
};

const agingGrid = {
  display: "grid",

  gridTemplateColumns:
    "repeat(4,minmax(0,1fr))",

  gap: 14,
};

const agingItem = (color) => ({
  padding: 18,

  borderRadius: 18,

  background:
    "rgba(255,255,255,.03)",

  border:
    `1px solid ${color}33`,

  textAlign: "center",
});

const insightsList = {
  display: "flex",

  flexDirection: "column",

  gap: 12,
};

const insightItem = {
  padding: "14px 16px",

  borderRadius: 16,

  background:
    "rgba(255,255,255,.04)",

  color: "rgba(255,255,255,.82)",

  fontSize: 14,

  fontWeight: 600,

  border:
    "1px solid rgba(255,255,255,.05)",
};

const analyticsCard = {
  padding: 22,

  borderRadius: 24,

  background:
    "rgba(15,23,42,.78)",

  border:
    "1px solid rgba(255,255,255,.06)",

  boxShadow:
    "0 18px 40px rgba(2,6,23,.34)",

  backdropFilter: "blur(18px)",
};

const analyticsCardLarge = {
  ...analyticsCard,

  gridColumn: "span 2",
};

const analyticsCardWide = {
  ...analyticsCard,

  gridColumn: "span 2",
};

const adminPanelTitle = {
  color: "#fff",
  marginBottom: 12,
  fontSize: 16,
  fontWeight: 800,
};

const analyticsSection = {
  marginTop: 4,
};

const analyticsHeader = {
  marginBottom: 16,
};

const analyticsGridLayout = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(260px,1fr))",

  gap: 16,
};

const inventoryLayout = {
  display: "flex",

  gap: 20,

  alignItems: "flex-start",
};

const inventoryMain = {
  flex: 1,

  display: "flex",

  flexDirection: "column",

  gap: 18,
};

export default DashboardPage;