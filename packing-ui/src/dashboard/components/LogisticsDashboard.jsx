function LogisticsDashboard({
  logistics,
  setShiftModal,
  StatCard,
  AnalyticsGrid,
}) {
  return (
    <>
      {/* ========================================
          HERO / FILTER BAR
      ======================================== */}

      <div style={logisticsHero}>
        <div>
          <div style={heroTitle}>
            Logistics Command Center
          </div>

          <div style={heroSubtitle}>
            Monitor fleet operations,
            drivers, trips and shift
            performance
          </div>
        </div>

        <div style={logisticsFilters}>
          <button
            style={createShiftBtn}
            onClick={() =>
              setShiftModal(true)
            }
          >
            + Create Shift
          </button>

          <input
            type="date"
            style={logisticsInput}
          />

          <select
            style={logisticsInput}
          >
            <option>
              All Drivers
            </option>
          </select>

          <select
            style={logisticsInput}
          >
            <option>
              All Vehicles
            </option>
          </select>
        </div>
      </div>

      {/* ========================================
          KPI GRID
      ======================================== */}

      <div style={logisticsKpiGrid}>
        <StatCard
          darkMode={true}
          accent="#3b82f6"
          title="Working Trips"
          value={
            logistics.totalTrips
          }
          subtle="Trips Completed"
        />

        <StatCard
          darkMode={true}
          accent="#22c55e"
          title="Total Loaders"
          value={
            logistics.totalLoaders
          }
          subtle="Loaders Utilized"
        />

        <StatCard
          darkMode={true}
          accent="#f59e0b"
          title="Fleet Efficiency"
          value={`${Number(
            logistics.efficiency || 0
          ).toFixed(1)}%`}
          subtle="Loaders / Trip"
        />

        <StatCard
          darkMode={true}
          accent="#8b5cf6"
          title="Active Drivers"
          value={
            logistics.activeDrivers
          }
          subtle="Drivers Available"
        />

        <StatCard
          darkMode={true}
          accent="#ec4899"
          title="Active Vehicles"
          value={
            logistics.activeVehicles
          }
          subtle="Fleet Running"
        />

        <StatCard
          darkMode={true}
          accent="#06b6d4"
          title="Trips / Driver"
          value={Number(
            logistics.averageTripsPerDriver ||
              0
          ).toFixed(1)}
          subtle="Average Productivity"
        />

        <StatCard
          darkMode={true}
          accent="#f97316"
          title="Trips / Vehicle"
          value={Number(
            logistics.averageTripsPerVehicle ||
              0
          ).toFixed(1)}
          subtle="Fleet Utilization"
        />
      </div>

      {/* ========================================
          ANALYTICS
      ======================================== */}

      <div style={logisticsMainGrid}>
        <div style={logisticsMainPanel}>
          <AnalyticsGrid
            data={logistics}
          />
        </div>
      </div>
    </>
  );
}

/* ========================================
   STYLES
======================================== */

const logisticsHero = {
  display: "flex",

  justifyContent:
    "space-between",

  alignItems: "center",

  gap: 20,

  marginBottom: 28,

  flexWrap: "wrap",
};

const heroTitle = {
  color: "#ffffff",

  fontSize: 30,

  fontWeight: 900,

  marginBottom: 8,

  letterSpacing: 0.3,
};

const heroSubtitle = {
  color:
    "rgba(255,255,255,0.65)",

  fontSize: 14,
};

const logisticsFilters = {
  display: "flex",

  alignItems: "center",

  gap: 12,

  flexWrap: "wrap",
};

const logisticsInput = {
  height: 42,

  borderRadius: 12,

  border:
    "1px solid rgba(255,255,255,0.08)",

  background:
    "rgba(17,24,39,0.92)",

  color: "#fff",

  padding: "0 14px",

  outline: "none",

  minWidth: 160,

  fontSize: 13,
};

const createShiftBtn = {
  height: 44,

  padding: "0 18px",

  borderRadius: 12,

  border: "none",

  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",

  color: "#fff",

  fontWeight: 700,

  cursor: "pointer",

  boxShadow:
    "0 10px 24px rgba(37,99,235,0.35)",

  transition:
    "all 0.25s ease",
};

const logisticsKpiGrid = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",

  gap: 18,

  marginBottom: 28,
};

const logisticsMainGrid = {
  display: "grid",

  gridTemplateColumns:
    "minmax(0,1fr)",

  gap: 20,
};

const logisticsMainPanel = {
  width: "100%",
};

export default LogisticsDashboard;