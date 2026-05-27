import { useState } from "react";

import ShiftOperations from "../logistics/components/ShiftOperations";

import DriverManagement from "../logistics/components/DriverManagement";

import VehicleManagement from "../logistics/components/VehicleManagement";

import ShiftHistory from "../logistics/components/ShiftHistory";

function LogisticsPortalPage() {
  const [tab, setTab] =
    useState("operations");

  return (
    <div style={page}>
        <div style={logo}>
          🚚 Logistics ERP
        </div>

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

      <div style={content}>
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
          : "transparent",
      }}
    >
      {label}
    </button>
  );
}

const page = {
  display: "flex",
  minHeight: "100vh",
  background:
    "linear-gradient(135deg,#020617,#0f172a)",
};

const tabsRow = {
  display: "flex",
  gap: 12,
  marginBottom: 24,
  flexWrap: "wrap",
};

const logo = {
  color: "#fff",
  fontSize: 24,
  fontWeight: 900,
  marginBottom: 18,
};

const sidebarBtn = {
  height: 48,
  borderRadius: 14,
  border: "none",
  color: "#fff",
  cursor: "pointer",
  textAlign: "left",
  paddingLeft: 16,
  fontWeight: 700,
  fontSize: 14,
};

const content = {
  flex: 1,
  padding: 24,
};

export default LogisticsPortalPage;