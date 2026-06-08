import { useEffect, useState } from "react";
import StatusDonutChart from "../dashboard/components/StatusDonutChart";
import StatusLineChart from "../dashboard/components/StatusLineChart";
import StatusBarChart from "../dashboard/components/StatusBarChart";
import ActivityFeed from "../dashboard/components/ActivityFeed";
import InventoryReports from "../dashboard/components/inventory/InventoryReports";
import ScheduledReports from "../dashboard/components/ScheduledReports";
import {
  fetchDashboardStats,
  fetchDashboardActivity,
  fetchLogisticsStats,
  fetchDailyThroughputUsers,
} from "../dashboard/api/dashboardApi";
import AnalyticsGrid from "../dashboard/components/AnalyticsGrid";
import LogisticsShiftModal from "../dashboard/components/logistics/LogisticsShiftModal";
import LogisticsDashboard from "../dashboard/components/logistics/LogisticsDashboard";
import InventorySidebar from
  "../dashboard/components/inventory/InventorySidebar";

  function StatCard({
    title,
    value,
    subtle,
    accent = "#60a5fa",
    onClick,
    active = false,
  }) {
    const clickable = Boolean(onClick);

    return (
      <button
        type="button"
        onClick={onClick}
        style={statCard(accent, clickable, active)}
      >
        <div style={cardAccent(accent)} />

        <p style={statTitle}>{title}</p>

        <h2 style={statValue}>{value}</h2>

        {subtle && <div style={statSubtle}>{subtle}</div>}

        {clickable && (
          <div style={statClickHint}>
            {active ? "Hide details" : "View details"}
          </div>
        )}
      </button>
    );
  }
  
  function DetailStatCard({
    title,
    subtitle,
    accent = "#60a5fa",
    rows = [],
    totalLabel,
    totalValue,
  }) {
    return (
      <div style={detailCard(accent)}>
        <div style={detailHeader}>
          <div>
            <div style={detailTitle}>{title}</div>
            {subtitle && <div style={detailSubtitle}>{subtitle}</div>}
          </div>

          {totalLabel && (
            <div style={detailTotalBox}>
              <span>{totalLabel}</span>
              <strong>{totalValue}</strong>
            </div>
          )}
        </div>

        <div style={detailGrid}>
          {rows.map((row) => (
            <div key={row.label} style={detailItem}>
              <div style={detailItemLabel}>{row.label}</div>
              <div style={detailItemValue}>{row.value}</div>
              {row.subtle && (
                <div style={detailItemSubtle}>{row.subtle}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  function ThroughputMiniCard({
    title,
    value,
    subtle,
    accent,
    active,
    disabled,
    onClick,
  }) {
    return (
      <button
        type="button"
        onClick={disabled ? undefined : onClick}
        style={throughputMiniCard(accent, active, disabled)}
      >
        <div style={throughputMiniTitle}>{title}</div>
        <div style={throughputMiniValue}>{value}</div>
        <div style={throughputMiniSubtle}>{subtle}</div>

        <div style={throughputMiniHint}>
          {disabled ? "Admin only" : active ? "Selected" : "View users"}
        </div>
      </button>
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

const toNumber = (value) => Number(value ?? 0) || 0;

const normalizeStats = (data) => {
  console.log("Dashboard stats API response:", data);

  const warehouseItems = toNumber(
    data?.warehouseItems ??
      data?.warehouse ??
      data?.warehouseStock ??
      data?.inWarehouse
  );

  const readyToDispatchItems = toNumber(
    data?.readyToDispatchItems ??
      data?.readyToDispatch ??
      data?.readyToDispatchCount
  );

  const readyItems = toNumber(
    data?.readyItems ??
      data?.ready ??
      data?.readyCount
  );

  const inventoryTotal =
    warehouseItems + readyToDispatchItems + readyItems;

  return {
    warehouseItems,
    readyToDispatchItems,
    readyItems,

    totalItems:
      inventoryTotal ||
      toNumber(data?.totalItems ?? data?.total ?? data?.inventoryItems),

    packedItems: toNumber(
      data?.packedItems ??
        data?.packed ??
        data?.stickersGenerated
    ),

    dispatchedItems: toNumber(
      data?.dispatchedItems ??
        data?.dispatched
    ),

    pendingItems: toNumber(
      data?.pendingItems ??
        data?.pending
    ),

    stickersGenerated: toNumber(
      data?.stickersGenerated ??
        data?.stickers
    ),

    todayStickerGenerated: toNumber(
      data?.todayStickerGenerated ??
        data?.todayStickersGenerated ??
        data?.stickersGeneratedToday
    ),

    todayChallanGenerated: toNumber(
      data?.todayChallanGenerated ??
        data?.todayChallansGenerated ??
        data?.challansGeneratedToday
    ),
  };
};

function ThroughputUserModal({
  open,
  title,
  rows = [],
  loading,
  error,
  onClose,
}) {
  if (!open) return null;

  const total = rows.reduce(
    (sum, row) => sum + Number(row.count || 0),
    0
  );

  return (
    <div style={modalOverlay}>
      <div style={modalCard}>
        <div style={modalHeader}>
          <div>
            <div style={modalTitle}>{title}</div>
            <div style={modalSubtitle}>
              Today’s completed work by user
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={modalCloseBtn}
          >
            ×
          </button>
        </div>

        <div style={modalTotalBox}>
          <span>Total Work</span>
          <strong>{total}</strong>
        </div>

        {loading && (
          <div style={modalEmpty}>
            Loading user-wise data...
          </div>
        )}

        {!loading && error && (
          <div style={modalError}>
            {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div style={modalEmpty}>
            No user-wise data found for today.
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div style={modalUserList}>
            {rows.map((row, index) => (
              <div
                key={`${row.username}-${index}`}
                style={modalUserRow}
              >
                <div style={modalRank}>
                  {index + 1}
                </div>

                <div style={modalUserName}>
                  {row.username || "UNKNOWN"}
                </div>

                <div style={modalCount}>
                  {Number(row.count || 0)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardPage() {
	const [stats, setStats] = useState({
	  totalItems: 0,

	  warehouseItems: 0,
	  readyToDispatchItems: 0,
	  readyItems: 0,

	  packedItems: 0,
	  dispatchedItems: 0,
	  pendingItems: 0,
	  stickersGenerated: 0,

	  todayStickerGenerated: 0,
	  todayChallanGenerated: 0,
	});

  const [activityLogs, setActivityLogs] = useState([]);
  const [logistics, setLogistics] = useState(null);
  const [chartType, setChartType] = useState("donut");
  const [mode, setMode] = useState("inventory");
  const [inventorySection, setInventorySection] =
    useState("summary");
	
  const [activeStatCard, setActiveStatCard] = useState(null);
  const [shiftModal, setShiftModal] =
    useState(false);

	const [throughputModal, setThroughputModal] = useState({
	  open: false,
	  type: null,
	  title: "",
	  rows: [],
	  loading: false,
	  error: "",
	});

	const role = String(localStorage.getItem("role") || "").toUpperCase();

	const isAdmin =
	  role === "ADMIN" ||
	  role === "ROLE_ADMIN";
	  
	  
	const inventoryTotal =
	   Number(stats.warehouseItems || 0) +
	   Number(stats.readyToDispatchItems || 0) +
	   Number(stats.readyItems || 0);

	 const finalInventoryTotal =
	   inventoryTotal || Number(stats.totalItems || 0);

	   const throughputPackedItems =
	     Number(stats.packedItems || 0);

	   const throughputDispatchedItems =
	     Number(stats.dispatchedItems || 0);
		 
	   const pending =
	     Number(stats.pendingItems || 0) ||
	     Math.max(
	       finalInventoryTotal -
	         Number(stats.packedItems || 0) -
	         Number(stats.dispatchedItems || 0),
	       0
	     );
		 
		 const todayPackedItems =
		   Number(stats.todayStickerGenerated || 0);

		 const todayDispatchedItems =
		   Number(stats.todayChallanGenerated || 0);

		 const dailyThroughput =
		   todayPackedItems + todayDispatchedItems;

  const chartIndex = { donut: 0, line: 1, bar: 2 }[chartType];

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
 

  const toggleStatCard = (key) => {
    setActiveStatCard((current) =>
      current === key ? null : key
    );
  };
  
  const openThroughputUserModal = async (type) => {
    if (!isAdmin) return;

    const title =
      type === "packing"
        ? "User-wise Packing Work Today"
        : "User-wise Dispatch Work Today";

    setThroughputModal({
      open: true,
      type,
      title,
      rows: [],
      loading: true,
      error: "",
    });

    try {
      const data = await fetchDailyThroughputUsers(type);

      console.log("Throughput user data:", type, data);

      setThroughputModal({
        open: true,
        type,
        title,
        rows: Array.isArray(data) ? data : [],
        loading: false,
        error: "",
      });
    } catch (e) {
      console.error(e);

      setThroughputModal({
        open: true,
        type,
        title,
        rows: [],
        loading: false,
        error: "Unable to load user-wise data.",
      });
    }
  };

  const closeThroughputUserModal = () => {
    setThroughputModal({
      open: false,
      type: null,
      title: "",
      rows: [],
      loading: false,
      error: "",
    });
  };
  
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
			  <>
			    <div style={kpiGrid}>
			      <StatCard
			        accent="#60a5fa"
			        title="Inventory Items"
			        value={finalInventoryTotal}
			        subtle="Warehouse + Ready To Dispatch + Ready"
			        active={activeStatCard === "inventoryItems"}
			        onClick={() => toggleStatCard("inventoryItems")}
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
			        subtle="Sticker Generated"
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
			        value={dailyThroughput}
			        subtle="Today’s Sticker + Challan"
			        active={activeStatCard === "dailyThroughput"}
			        onClick={() => toggleStatCard("dailyThroughput")}
			      />

			      <StatCard
			        accent="#ef4444"
			        title="Ready to Dispatch"
			        value={Number(stats.readyToDispatchItems || 0)}
			        subtle="Dispatch action pending"
			      />

			      <StatCard
			        accent="#22c55e"
			        title="Operational Efficiency"
			        value="94%"
			        subtle="AI Optimized"
			      />
			    </div>

				{activeStatCard === "dailyThroughput" && (
				  <div style={detailCard("#06b6d4")}>
				    <div style={detailHeader}>
				      <div>
				        <div style={detailTitle}>
				          Daily Throughput Details
				        </div>

				        <div style={detailSubtitle}>
				          Today’s packed and dispatched work summary
				        </div>
				      </div>

				      <div style={detailTotalBox}>
				        <span>Total Today</span>
				        <strong>{dailyThroughput}</strong>
				      </div>
				    </div>

				    <div style={detailGrid}>
				      <button
				        type="button"
				        onClick={() => openThroughputUserModal("packing")}
				        disabled={!isAdmin}
				        style={throughputClickCard("#34d399", isAdmin)}
				      >
				        <div style={detailItemLabel}>
				          Packed Items
				        </div>

				        <div style={detailItemValue}>
				          {todayPackedItems}
				        </div>

				        <div style={detailItemSubtle}>
				          Packed Today / Sticker Generated Today
				        </div>

				        <div style={throughputCardHint}>
				          {isAdmin
				            ? "Click to view user-wise packing"
				            : "Admin only"}
				        </div>
				      </button>

				      <button
				        type="button"
				        onClick={() => openThroughputUserModal("dispatch")}
				        disabled={!isAdmin}
				        style={throughputClickCard("#f59e0b", isAdmin)}
				      >
				        <div style={detailItemLabel}>
				          Dispatched Items
				        </div>

				        <div style={detailItemValue}>
				          {todayDispatchedItems}
				        </div>

				        <div style={detailItemSubtle}>
				          Dispatched Today / Chalaan Generated Today
				        </div>

				        <div style={throughputCardHint}>
				          {isAdmin
				            ? "Click to view user-wise dispatch"
				            : "Admin only"}
				        </div>
				      </button>
				    </div>
				  </div>
				)}

			    {activeStatCard === "inventoryItems" && (
			      <DetailStatCard
			        accent="#60a5fa"
			        title="Inventory Item Breakdown"
			        subtitle="Live stock position by operational status"
			        totalLabel="Inventory Total"
			        totalValue={finalInventoryTotal}
			        rows={[
			          {
			            label: "Warehouse Items",
			            value: Number(stats.warehouseItems || 0),
			            subtle: "Currently inside warehouse",
			          },
			          {
			            label: "Ready to Dispatch",
			            value: Number(stats.readyToDispatchItems || 0),
			            subtle: "Waiting for dispatch",
			          },
			          {
			            label: "Ready Items",
			            value: Number(stats.readyItems || 0),
			            subtle: "Ready / processed stock",
			          },
			        ]}
			      />
			    )}

			    <div style={workspaceGrid}>
				<div style={chartPanelSurface}>
				  <div style={chartPanelTop}>
				    <div>
				      <div style={chartPanelTitle}>
				        Inventory Visualization
				      </div>

				      <div style={chartPanelSubtitle}>
				        Switch between donut, flow and volume charts
				      </div>
				    </div>

				    <div style={chartToggleWrap}>
				      <div
				        style={{
				          ...chartSlider,
				          transform: `translateX(${chartIndex * 40}px)`,
				        }}
				      />

				      <button
				        type="button"
				        title="Donut chart"
				        style={chartToggleBtn}
				        onClick={() => setChartType("donut")}
				      >
				        <DonutIcon />
				      </button>

				      <button
				        type="button"
				        title="Line chart"
				        style={chartToggleBtn}
				        onClick={() => setChartType("line")}
				      >
				        <LineIcon />
				      </button>

				      <button
				        type="button"
				        title="Bar chart"
				        style={chartToggleBtn}
				        onClick={() => setChartType("bar")}
				      >
				        <BarIcon />
				      </button>
				    </div>
				  </div>

				  <div style={chartPanelBody}>
				    {chartType === "donut" && (
				      <StatusDonutChart
				        warehouse={stats.warehouseItems}
				        readyToDispatch={stats.readyToDispatchItems}
				        ready={stats.readyItems}
				      />
				    )}

				    {chartType === "line" && (
				      <StatusLineChart
				        warehouse={stats.warehouseItems}
				        readyToDispatch={stats.readyToDispatchItems}
				        ready={stats.readyItems}
				      />
				    )}

				    {chartType === "bar" && (
				      <StatusBarChart
				        warehouse={stats.warehouseItems}
				        readyToDispatch={stats.readyToDispatchItems}
				        ready={stats.readyItems}
				      />
				    )}
				  </div>
				</div>

			      <div style={panelSurface}>
			        <ActivityFeed logs={activityLogs} />
			      </div>
			    </div>

				{isAdmin && (
				  <>
				    <InventoryReports />

				    <div style={adminPanel}>
				      <ScheduledReports />
				    </div>
				  </>
				)}
			  </>
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
	  <ThroughputUserModal
	    open={throughputModal.open}
	    title={throughputModal.title}
	    rows={throughputModal.rows}
	    loading={throughputModal.loading}
	    error={throughputModal.error}
	    onClose={closeThroughputUserModal}
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


const cardAccent = (accent) => ({
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 4,
  background: accent,
});

const statCard = (accent, clickable = false, active = false) => ({
  position: "relative",

  padding: "20px 20px 18px",

  borderRadius: 22,

  background: active
    ? `linear-gradient(180deg, ${accent}22, rgba(15,23,42,.82))`
    : "rgba(15,23,42,.78)",

  border: active
    ? `1px solid ${accent}66`
    : "1px solid rgba(255,255,255,.06)",

  boxShadow: active
    ? `0 18px 40px ${accent}26`
    : "0 18px 35px rgba(2,6,23,.32)",

  overflow: "hidden",

  minHeight: 118,

  backdropFilter: "blur(18px)",

  cursor: clickable ? "pointer" : "default",

  textAlign: "left",

  width: "100%",

  color: "#fff",

  fontFamily: "inherit",

  transition: "all .25s ease",
});

const statClickHint = {
  marginTop: 10,
  fontSize: 11,
  fontWeight: 800,
  color: "rgba(255,255,255,.72)",
};

const detailCard = (accent) => ({
  padding: 20,

  borderRadius: 24,

  background:
    "linear-gradient(180deg, rgba(255,255,255,.05), rgba(15,23,42,.82))",

  border: `1px solid ${accent}55`,

  boxShadow: `0 18px 40px ${accent}22`,

  backdropFilter: "blur(18px)",
});

const detailHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  marginBottom: 16,
  flexWrap: "wrap",
};

const detailTitle = {
  fontSize: 20,
  fontWeight: 900,
  color: "#fff",
};

const detailSubtitle = {
  marginTop: 4,
  fontSize: 13,
  color: "rgba(255,255,255,.58)",
};

const detailTotalBox = {
  minWidth: 140,
  padding: "10px 14px",

  borderRadius: 16,

  background: "rgba(255,255,255,.05)",

  border: "1px solid rgba(255,255,255,.08)",

  display: "flex",
  flexDirection: "column",
  gap: 4,

  color: "rgba(255,255,255,.68)",

  fontSize: 12,
  fontWeight: 700,
};

const detailGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 14,
};

const detailItem = {
  padding: 16,

  borderRadius: 18,

  background: "rgba(255,255,255,.04)",

  border: "1px solid rgba(255,255,255,.06)",
};

const throughputClickCard = (accent, enabled) => ({
  padding: 16,

  borderRadius: 18,

  background: "rgba(255,255,255,.04)",

  border: `1px solid ${accent}44`,

  cursor: enabled ? "pointer" : "not-allowed",

  opacity: enabled ? 1 : 0.7,

  textAlign: "left",

  fontFamily: "inherit",

  color: "#fff",

  transition: "all .25s ease",
});

const throughputCardHint = {
  marginTop: 10,
  fontSize: 11,
  fontWeight: 900,
  color: "rgba(255,255,255,.68)",
};

const modalOverlay = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,

  background: "rgba(2,6,23,.72)",

  backdropFilter: "blur(12px)",

  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  padding: 20,
};

const modalCard = {
  width: "min(560px, 100%)",

  borderRadius: 26,

  padding: 22,

  background:
    "linear-gradient(180deg, rgba(15,23,42,.96), rgba(15,23,42,.88))",

  border:
    "1px solid rgba(255,255,255,.08)",

  boxShadow:
    "0 28px 70px rgba(2,6,23,.55)",

  color: "#fff",
};

const modalHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  marginBottom: 16,
};

const modalTitle = {
  fontSize: 20,
  fontWeight: 900,
  color: "#fff",
};

const modalSubtitle = {
  marginTop: 5,
  fontSize: 13,
  color: "rgba(255,255,255,.56)",
};

const modalCloseBtn = {
  width: 34,
  height: 34,

  borderRadius: "50%",

  border:
    "1px solid rgba(255,255,255,.10)",

  background: "rgba(255,255,255,.06)",

  color: "#fff",

  cursor: "pointer",

  fontSize: 22,
  lineHeight: 1,
};

const modalTotalBox = {
  marginBottom: 14,

  padding: "12px 14px",

  borderRadius: 18,

  background: "rgba(59,130,246,.13)",

  border: "1px solid rgba(59,130,246,.22)",

  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",

  color: "rgba(255,255,255,.72)",

  fontSize: 13,
  fontWeight: 800,
};

const modalUserList = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const modalUserRow = {
  display: "grid",
  gridTemplateColumns: "42px minmax(0,1fr) auto",
  alignItems: "center",
  gap: 12,

  padding: "12px 14px",

  borderRadius: 16,

  background: "rgba(255,255,255,.045)",

  border: "1px solid rgba(255,255,255,.07)",
};

const modalRank = {
  width: 30,
  height: 30,

  borderRadius: 999,

  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  background: "rgba(59,130,246,.16)",

  color: "#93c5fd",

  fontSize: 12,
  fontWeight: 900,
};

const modalUserName = {
  color: "#fff",
  fontSize: 14,
  fontWeight: 800,

  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const modalCount = {
  color: "#fff",
  fontSize: 20,
  fontWeight: 900,
};

const modalEmpty = {
  padding: 16,

  borderRadius: 16,

  background: "rgba(255,255,255,.04)",

  color: "rgba(255,255,255,.58)",

  fontSize: 13,
  fontWeight: 700,
};

const modalError = {
  padding: 16,

  borderRadius: 16,

  background: "rgba(239,68,68,.10)",

  border: "1px solid rgba(239,68,68,.22)",

  color: "#fca5a5",

  fontSize: 13,
  fontWeight: 800,
};

const detailItemLabel = {
  fontSize: 12,
  fontWeight: 800,
  color: "rgba(255,255,255,.62)",
  textTransform: "uppercase",
  letterSpacing: ".06em",
};

const detailItemValue = {
  marginTop: 8,
  fontSize: 30,
  fontWeight: 900,
  color: "#fff",
};

const detailItemSubtle = {
  marginTop: 6,
  fontSize: 12,
  color: "rgba(255,255,255,.52)",
};

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

const throughputMiniCard = (
  accent,
  active = false,
  disabled = false
) => ({
  position: "relative",

  padding: 18,

  borderRadius: 20,

  border: active
    ? `1px solid ${accent}77`
    : "1px solid rgba(255,255,255,.07)",

  background: active
    ? `linear-gradient(180deg, ${accent}22, rgba(255,255,255,.035))`
    : "rgba(255,255,255,.04)",

  color: "#fff",

  textAlign: "left",

  cursor: disabled ? "not-allowed" : "pointer",

  opacity: disabled ? 0.72 : 1,

  boxShadow: active
    ? `0 16px 34px ${accent}22`
    : "none",

  transition: "all .25s ease",

  fontFamily: "inherit",
});

const throughputMiniTitle = {
  fontSize: 12,
  fontWeight: 900,
  color: "rgba(255,255,255,.62)",
  letterSpacing: ".07em",
  textTransform: "uppercase",
};

const throughputMiniValue = {
  marginTop: 10,
  fontSize: 34,
  fontWeight: 900,
  color: "#fff",
};

const throughputMiniSubtle = {
  marginTop: 6,
  fontSize: 12,
  fontWeight: 700,
  color: "rgba(255,255,255,.56)",
};

const throughputMiniHint = {
  marginTop: 12,
  fontSize: 11,
  fontWeight: 900,
  color: "rgba(255,255,255,.72)",
};

const chartPanelSurface = {
  position: "relative",

  minHeight: 420,

  padding: 22,

  borderRadius: 28,

  background:
    "radial-gradient(circle at top left, rgba(37,99,235,.18), transparent 34%), linear-gradient(180deg, rgba(15,23,42,.86), rgba(15,23,42,.68))",

  border:
    "1px solid rgba(255,255,255,.08)",

  boxShadow:
    "0 22px 55px rgba(2,6,23,.36)",

  backdropFilter: "blur(18px)",

  overflow: "hidden",
};

const chartPanelTop = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 18,
};

const chartPanelTitle = {
  fontSize: 18,
  fontWeight: 900,
  color: "#fff",
};

const chartPanelSubtitle = {
  marginTop: 5,
  fontSize: 12,
  color: "rgba(255,255,255,.56)",
};

const chartPanelBody = {
  minHeight: 330,

  padding: 18,

  borderRadius: 24,

  background:
    "linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.022))",

  border:
    "1px solid rgba(255,255,255,.06)",
};

export default DashboardPage;