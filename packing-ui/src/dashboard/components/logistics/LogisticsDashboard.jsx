import { useMemo, useState } from "react";

import ExecutiveSidebar from "./panels/ExecutiveSidebar";

import TripsLineChart from "./charts/TripsLineChart";
import StatusDistributionChart from "./charts/StatusDistributionChart";

function LogisticsDashboard({
  logistics,
  StatCard,
}) {
  const [section, setSection] =
    useState("summary");

  const sectionData = useMemo(() => {
    switch (section) {
      case "drivers":
        return {
          title:
            "Driver Performance Intelligence",

          subtitle:
            "Driver utilization, shift activity and workforce availability",

          cards: [
            {
              title:
                "Active Drivers",

              value:
                logistics.activeDrivers,

              subtle:
                "Currently Available",

              accent: "#8b5cf6",
            },

            {
              title:
                "Trips Per Driver",

              value: Number(
                (logistics.totalTrips || 0) /
                  Math.max(
                    logistics.activeDrivers || 1,
                    1
                  )
              ).toFixed(1),

              subtle:
                "Efficiency Ratio",

              accent: "#3b82f6",
            },

            {
              title:
                "Loaders Per Driver",

              value: Number(
                (logistics.totalLoaders || 0) /
                  Math.max(
                    logistics.activeDrivers || 1,
                    1
                  )
              ).toFixed(1),

              subtle:
                "Workload Balance",

              accent: "#22c55e",
            },

            {
              title:
                "Driver Availability",

              value: `${Number(
                logistics.driverAvailability).toFixed(0)}%`,

              subtle:
                "Operational Readiness",

              accent: "#f59e0b",
            },
          ],
        };

      case "vehicles":
        return {
          title:
            "Vehicle Utilization Analytics",

          subtitle:
            "Fleet performance, fuel efficiency and transport intelligence",

          cards: [
            {
              title:
                "Fleet Efficiency",

              value: `${Number(
                logistics.efficiency).toFixed(1)}%`,

              subtle:
                "Trips / Resources",

              accent: "#3b82f6",
            },

            {
              title:
                "Fuel Usage",

              value:
                logistics.totalFuelUsed ,

              subtle:
                "Litres Consumed",

              accent: "#ef4444",
            },

            {
              title:
                "Distance Covered",

              value:
                logistics.totalDistance ,

              subtle:
                "KM Travelled",

              accent: "#22c55e",
            },

            {
              title:
                "Vehicles Active",

              value:
                logistics.activeVehicles,

              subtle:
                "Fleet Running",

              accent: "#8b5cf6",
            },
          ],
        };

      case "operations":
        return {
          title:
            "Operations Intelligence Center",

          subtitle:
            "Live operational analytics and shift optimization",

          cards: [
            {
              title:
                "Working Trips",

              value:
                logistics.totalTrips,

              subtle:
                "Trips Completed",

              accent: "#3b82f6",
            },

            {
              title:
                "Total Loaders",

              value:
                logistics.totalLoaders,

              subtle:
                "Loaders Utilized",

              accent: "#22c55e",
            },

            {
              title:
                "Route Efficiency",

              value: `${Number(
                logistics.efficiency).toFixed(1)}%`,

              subtle:
                "Performance Score",

              accent: "#f59e0b",
            },

            {
              title:
                "Operational Score",

              value: "94%",

              subtle:
                "AI Optimization",

              accent: "#8b5cf6",
            },
          ],
        };

      case "alerts":
        return {
          title:
            "Alerts & Risk Insights",

          subtitle:
            "Operational risks, anomalies and predictive insights",

          cards: [
            {
              title:
                "Delayed Routes",

              value:
                logistics.delayedRoutes,

              subtle:
                "Needs Attention",

              accent: "#ef4444",
            },

            {
              title:
                "Fuel Alerts",

              value:
                logistics.fuelAlerts,

              subtle:
                "Low Fuel Vehicles",

              accent: "#f59e0b",
            },

            {
              title:
                "Inactive Drivers",

              value:
                logistics.inactiveDrivers,

              subtle:
                "Unavailable Staff",

              accent: "#8b5cf6",
            },

            {
              title:
                "System Health",

              value: "98%",

              subtle:
                "Platform Stability",

              accent: "#22c55e",
            },
          ],
        };

      case "routes":
        return {
          title:
            "Route Analysis & Mapping",

          subtitle:
            "Distribution patterns and logistics route optimization",

          cards: [
            {
              title:
                "Factory Routes",

              value:
                logistics.factoryRoutes ,

              subtle:
                "Industrial Deliveries",

              accent: "#3b82f6",
            },

            {
              title:
                "Warehouse Routes",

              value:
                logistics.warehouseRoutes,

              subtle:
                "Storage Operations",

              accent: "#22c55e",
            },

            {
              title:
                "Residential Routes",

              value:
                logistics.residentialRoutes,

              subtle:
                "Customer Deliveries",

              accent: "#f59e0b",
            },

            {
              title:
                "Route Accuracy",

              value: "96%",

              subtle:
                "Navigation Precision",

              accent: "#8b5cf6",
            },
          ],
        };

      default:
        return {
          title:
            "Driver & Vehicle Operations Dashboard",

          subtitle:
            "Real-time overview of trips, loaders and performance",

          cards: [
            {
              title:
                "Working Trips",

              value:
                logistics.totalTrips,

              subtle:
                "Trips Completed",

              accent: "#3b82f6",
            },

            {
              title:
                "Total Loaders",

              value:
                logistics.totalLoaders,

              subtle:
                "Loaders Utilized",

              accent: "#22c55e",
            },

            {
              title:
                "Fleet Efficiency",

              value: `${Number(
                logistics.efficiency).toFixed(1)}%`,

              subtle:
                "Loaders / Trip",

              accent: "#f59e0b",
            },

            {
              title:
                "Active Drivers",

              value:
                logistics.activeDrivers,

              subtle:
                "Drivers Available",

              accent: "#8b5cf6",
            },
          ],
        };
    }
  }, [section, logistics]);

  return (
    <div style={layout}>
      <ExecutiveSidebar
        section={section}
        setSection={setSection}
      />

      <div style={main}>
        <div style={topBar}>
          <div>
            <div style={header}>
              {sectionData.title}
            </div>

            <div style={subtitle}>
              {
                sectionData.subtitle
              }
            </div>
          </div>

          <div style={liveBadge}>
            ● LIVE OPERATIONS
          </div>
        </div>

        <div style={kpiGrid}>
          {sectionData.cards.map(
            (card) => (
              <StatCard
                key={card.title}
                accent={card.accent}
                title={card.title}
                value={card.value}
                subtle={card.subtle}
              />
            )
          )}
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

const topBar = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
  marginBottom: 24,
};

const liveBadge = {
  height: 44,
  padding: "0 18px",
  borderRadius: 999,
  display: "flex",
  alignItems: "center",
  background:
    "rgba(34,197,94,.15)",
  color: "#4ade80",
  fontWeight: 800,
  letterSpacing: 1,
  border:
    "1px solid rgba(34,197,94,.25)",
};

const chartsGrid = {
  marginTop: 24,
  display: "grid",
  gridTemplateColumns:
    "1.4fr 1fr",
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
  fontSize: 15,
};

const kpiGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(4,minmax(0,1fr))",
  gap: 18,
};

export default LogisticsDashboard;