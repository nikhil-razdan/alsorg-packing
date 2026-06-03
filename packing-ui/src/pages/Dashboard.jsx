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
  fetchDailyThroughputUserBreakdown,
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
		  {rows.map((row) => {
		    const clickable =
		      typeof row.onClick === "function";

		    return (
		      <div
		        key={row.label}
		        role={clickable ? "button" : undefined}
		        tabIndex={clickable ? 0 : undefined}
		        onClick={row.onClick}
		        onKeyDown={(e) => {
		          if (!clickable) return;

		          if (e.key === "Enter" || e.key === " ") {
		            row.onClick();
		          }
		        }}
		        style={{
		          ...detailItem,
		          ...(clickable ? detailItemClickable : {}),
		        }}
		      >
		        <div style={detailItemLabel}>
		          {row.label}
		        </div>

		        <div style={detailItemValue}>
		          {row.value}
		        </div>

		        {row.subtle && (
		          <div style={detailItemSubtle}>
		            {row.subtle}
		          </div>
		        )}

		        {clickable && (
		          <div style={detailClickHint}>
		            Click to view user-wise work
		          </div>
		        )}
		      </div>
		    );
		  })}
		</div>
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
  const [activeReport, setActiveReport] = useState(null);
  const [mode, setMode] = useState("inventory");
  const [inventorySection, setInventorySection] =
    useState("summary");
	
  const [activeStatCard, setActiveStatCard] = useState(null);
  const [shiftModal, setShiftModal] =
    useState(false);
	
	const isAdmin =
	  localStorage.getItem("role") === "ADMIN";

	const [throughputBreakdownType, setThroughputBreakdownType] =
	  useState(null);

	const [throughputUserRows, setThroughputUserRows] =
	  useState([]);

	const [throughputUserLoading, setThroughputUserLoading] =
	  useState(false);

	const [throughputUserError, setThroughputUserError] =
	  useState("");
	
	const inventoryTotal =
	   Number(stats.warehouseItems || 0) +
	   Number(stats.readyToDispatchItems || 0) +
	   Number(stats.readyItems || 0);

	 const finalInventoryTotal =
	   inventoryTotal || Number(stats.totalItems || 0);

	 const dailyThroughput =
	   Number(stats.todayStickerGenerated || 0) +
	   Number(stats.todayChallanGenerated || 0);
	   
	   const pending =
	     Number(stats.pendingItems || 0) ||
	     Math.max(
	       finalInventoryTotal -
	         Number(stats.packedItems || 0) -
	         Number(stats.dispatchedItems || 0),
	       0
	     );

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
 

  const toggleStatCard = (key) => {
    setActiveStatCard((current) => {
      const next =
        current === key ? null : key;

      if (next !== "dailyThroughput") {
        setThroughputBreakdownType(null);
        setThroughputUserRows([]);
        setThroughputUserError("");
      }

      return next;
    });
  };

  const loadThroughputUserBreakdown = async (type) => {
    if (!isAdmin) return;

    try {
      setThroughputBreakdownType(type);
      setThroughputUserLoading(true);
      setThroughputUserError("");

      const data =
        await fetchDailyThroughputUserBreakdown(type);

      setThroughputUserRows(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error(error);
      setThroughputUserRows([]);
      setThroughputUserError(
        "Failed to load user-wise throughput"
      );
    } finally {
      setThroughputUserLoading(false);
    }
  };
  
  const throughputBreakdownTotal =
    throughputUserRows.reduce(
      (sum, row) => sum + Number(row.count || 0),
      0
    );

  const throughputBreakdownTitle =
    throughputBreakdownType === "PACKED"
      ? "Packed Items by User"
      : throughputBreakdownType === "DISPATCHED"
      ? "Dispatched Items by User"
      : "";
  
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
				  <>
				    <DetailStatCard
				      accent="#06b6d4"
				      title="Daily Throughput Details"
				      subtitle={
				        isAdmin
				          ? "Today’s operational movement. Click Packed or Dispatch to view user-wise work."
				          : "Today’s operational movement"
				      }
				      totalLabel="Total Today"
				      totalValue={dailyThroughput}
				      rows={[
				        {
				          label: "Packed Items",
				          value: Number(stats.todayStickerGenerated || 0),
				          subtle: isAdmin
				            ? "Sticker Generated Today • Admin drilldown"
				            : "Sticker Generated Today",
				          onClick: isAdmin
				            ? () => loadThroughputUserBreakdown("PACKED")
				            : undefined,
				        },
				        {
				          label: "Dispatch Items",
				          value: Number(stats.todayChallanGenerated || 0),
				          subtle: isAdmin
				            ? "Dispatched Today • Admin drilldown"
				            : "Dispatched Today",
				          onClick: isAdmin
				            ? () => loadThroughputUserBreakdown("DISPATCHED")
				            : undefined,
				        },
				      ]}
				    />

				    {isAdmin && throughputBreakdownType && (
				      <div style={userThroughputPanel}>
				        <div style={userThroughputHeader}>
				          <div>
				            <div style={userThroughputTitle}>
				              {throughputBreakdownTitle}
				            </div>

				            <div style={userThroughputSubtitle}>
				              Today’s user-wise productivity
				            </div>
				          </div>

				          <div style={userThroughputTotalBox}>
				            <span>Total</span>
				            <strong>{throughputBreakdownTotal}</strong>
				          </div>
				        </div>

				        {throughputUserLoading && (
				          <div style={userThroughputEmpty}>
				            Loading user-wise work...
				          </div>
				        )}

				        {!throughputUserLoading &&
				          throughputUserError && (
				            <div style={userThroughputError}>
				              {throughputUserError}
				            </div>
				          )}

				        {!throughputUserLoading &&
				          !throughputUserError &&
				          throughputUserRows.length === 0 && (
				            <div style={userThroughputEmpty}>
				              No user-wise data found for today.
				            </div>
				          )}

				        {!throughputUserLoading &&
				          !throughputUserError &&
				          throughputUserRows.length > 0 && (
				            <div style={userThroughputTable}>
				              <div style={userThroughputTableHeader}>
				                <div>User</div>
				                <div>Work Type</div>
				                <div style={{ textAlign: "right" }}>
				                  Count
				                </div>
				              </div>

				              {throughputUserRows.map((row) => (
				                <div
				                  key={`${throughputBreakdownType}-${row.username}`}
				                  style={userThroughputTableRow}
				                >
				                  <div style={userNameCell}>
				                    {row.username || "SYSTEM"}
				                  </div>

				                  <div style={workTypeCell}>
				                    {throughputBreakdownType === "PACKED"
				                      ? "Packed"
				                      : "Dispatched"}
				                  </div>

				                  <div style={countCell}>
				                    {Number(row.count || 0)}
				                  </div>
				                </div>
				              ))}
				            </div>
				          )}
				      </div>
				    )}
				  </>
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

			    {localStorage.getItem("role") === "ADMIN" && (
			      <div style={adminPanel}>
			        <ScheduledReports />
			      </div>
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

const detailItemClickable = {
  cursor: "pointer",
  border: "1px solid rgba(6,182,212,.32)",
  background:
    "linear-gradient(180deg, rgba(6,182,212,.10), rgba(255,255,255,.04))",
  boxShadow:
    "0 14px 28px rgba(6,182,212,.12)",
};

const detailClickHint = {
  marginTop: 10,
  fontSize: 11,
  fontWeight: 900,
  color: "#67e8f9",
};

const userThroughputPanel = {
  padding: 20,

  borderRadius: 24,

  background:
    "linear-gradient(180deg, rgba(255,255,255,.05), rgba(15,23,42,.86))",

  border:
    "1px solid rgba(6,182,212,.34)",

  boxShadow:
    "0 18px 40px rgba(6,182,212,.14)",

  backdropFilter: "blur(18px)",
};

const userThroughputHeader = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 14,
  marginBottom: 16,
  flexWrap: "wrap",
};

const userThroughputTitle = {
  fontSize: 20,
  fontWeight: 900,
  color: "#fff",
};

const userThroughputSubtitle = {
  marginTop: 4,
  fontSize: 13,
  color: "rgba(255,255,255,.58)",
};

const userThroughputTotalBox = {
  minWidth: 110,
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

const userThroughputTable = {
  overflow: "hidden",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,.07)",
};

const userThroughputTableHeader = {
  display: "grid",
  gridTemplateColumns: "1fr 160px 100px",
  gap: 12,
  padding: "12px 14px",
  background: "rgba(15,23,42,.92)",
  color: "#94a3b8",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".06em",
};

const userThroughputTableRow = {
  display: "grid",
  gridTemplateColumns: "1fr 160px 100px",
  gap: 12,
  padding: "13px 14px",
  borderTop: "1px solid rgba(255,255,255,.06)",
  alignItems: "center",
};

const userNameCell = {
  color: "#fff",
  fontSize: 14,
  fontWeight: 900,
};

const workTypeCell = {
  color: "#67e8f9",
  fontSize: 13,
  fontWeight: 800,
};

const countCell = {
  color: "#fff",
  fontSize: 18,
  fontWeight: 900,
  textAlign: "right",
};

const userThroughputEmpty = {
  padding: 18,
  borderRadius: 16,
  color: "rgba(255,255,255,.62)",
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.06)",
  fontSize: 13,
  fontWeight: 700,
};

const userThroughputError = {
  padding: 18,
  borderRadius: 16,
  color: "#fecaca",
  background: "rgba(239,68,68,.10)",
  border: "1px solid rgba(239,68,68,.22)",
  fontSize: 13,
  fontWeight: 800,
};

export default DashboardPage;