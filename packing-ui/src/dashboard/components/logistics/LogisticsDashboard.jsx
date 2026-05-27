import { useState } from "react";
import ExecutiveSidebar from "./panels/ExecutiveSidebar";
import TripsLineChart from "./charts/TripsLineChart";
import StatusDistributionChart from "./charts/StatusDistributionChart";

function LogisticsDashboard({
  logistics,
  setShiftModal,
  StatCard,
  AnalyticsGrid,
}) {
  const [section, setSection] = useState("summary");

  return (
    <div style={layout}>
      <ExecutiveSidebar
        section={section}
        setSection={setSection}
      />

      <div style={main}>
        <div style={header}>
          DRIVER & VEHICLE
          <br />
          OPERATIONS DASHBOARD
        </div>

        <div style={subtitle}>
          Real-time overview of trips,
          loaders and performance
        </div>

        <div style={kpiGrid}>
          <StatCard
            darkMode={true}
            accent="#3b82f6"
            title="Working Trips"
            value={logistics.totalTrips}
            subtle="Trips Completed"
          />

          <StatCard
            darkMode={true}
            accent="#22c55e"
            title="Total Loaders"
            value={logistics.totalLoaders}
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
            value={logistics.activeDrivers}
            subtle="Drivers Available"
          />
        </div>

        <div style={chartsGrid}>
          <TripsLineChart
            logistics={logistics}
          />

          <StatusDistributionChart
            logistics={logistics}
          />
        </div>
      </div>
    </div>
  );
}

const chartsGrid = {
  marginTop: 24,

  display: "grid",

  gridTemplateColumns: "1.4fr 1fr",

  gap: 20,
};

const layout = {
  display: "flex",

  gap: 20,
};

const main = {
  flex: 1,
};

const header = {
  color: "#fff",

  fontSize: 32,

  fontWeight: 900,

  marginBottom: 8,

  lineHeight: 1.2,
};

const subtitle = {
  color: "rgba(255,255,255,.65)",

  marginBottom: 24,

  fontSize: 15,
};

const kpiGrid = {
  display: "grid",

  gridTemplateColumns:
    "repeat(4,minmax(0,1fr))",

  gap: 18,
};

export default LogisticsDashboard;