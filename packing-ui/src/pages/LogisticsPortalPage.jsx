import { useState } from "react";

import ShiftOperations from "../dashboard/components/logistics/ShiftOperations";
import DriverManagement from "../dashboard/components/logistics/DriverManagement";
import VehicleManagement from "../dashboard/components/logistics/VehicleManagement";
import ShiftHistory from "../dashboard/components/logistics/ShiftHistory";

function LogisticsPortalPage() {
  const [tab, setTab] =
    useState("operations");

  return (
    <div style={page}>
      <div style={content}>
        <div style={headerRow}>
          <div>
            <div style={logo}>
              🚚 Logistics ERP
            </div>

            <div style={subtitle}>
              Fleet, drivers and shift
              operations control center
            </div>
          </div>
        </div>

        <div style={tabsRow}>
          <SidebarButton
            active={
              tab === "operations"
            }
            onClick={() =>
              setTab("operations")
            }
            label="Shift Operations"
          />

          <SidebarButton
            active={
              tab === "drivers"
            }
            onClick={() =>
              setTab("drivers")
            }
            label="Driver Management"
          />

          <SidebarButton
            active={
              tab === "vehicles"
            }
            onClick={() =>
              setTab("vehicles")
            }
            label="Vehicle Management"
          />

          <SidebarButton
            active={
              tab === "history"
            }
            onClick={() =>
              setTab("history")
            }
            label="Shift History"
          />
        </div>

        {tab ===
          "operations" && (
          <ShiftOperations />
        )}

        {tab === "drivers" && (
          <DriverManagement />
        )}

        {tab ===
          "vehicles" && (
          <VehicleManagement />
        )}

        {tab === "history" && (
          <ShiftHistory />
        )}
      </div>
    </div>
  );
}

function SidebarButton({
  active,
  label,
  onClick,
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...sidebarBtn,
        background: active
          ? "linear-gradient(135deg,#2563eb,#3b82f6)"
          : "rgba(255,255,255,0.04)",

        border: active
          ? "1px solid rgba(59,130,246,0.4)"
          : "1px solid rgba(255,255,255,0.06)",

        boxShadow: active
          ? "0 10px 25px rgba(37,99,235,0.35)"
          : "none",
      }}
    >
      {label}
    </button>
  );
}

const page = {
  minHeight: "100vh",
  background:
    "linear-gradient(135deg,#020617,#0f172a)",
};

const content = {
  padding: 24,
};

const headerRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 24,
};

const logo = {
  color: "#fff",
  fontSize: 32,
  fontWeight: 900,
  marginBottom: 8,
};

const subtitle = {
  color: "rgba(255,255,255,0.65)",
  fontSize: 14,
};

const tabsRow = {
  display: "flex",
  gap: 12,
  marginBottom: 24,
  flexWrap: "wrap",
};

const sidebarBtn = {
  height: 48,
  borderRadius: 14,
  border: "none",
  color: "#fff",
  cursor: "pointer",
  paddingLeft: 18,
  paddingRight: 18,
  fontWeight: 700,
  fontSize: 14,
  transition: "all 0.25s ease",
};

export default LogisticsPortalPage;