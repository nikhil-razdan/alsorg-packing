import {
  useCallback,
  useState,
} from "react";

import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

import LogisticsDashboard from "../dashboard/components/logistics/LogisticsDashboard";
import LogisticsOperationsHub from "../dashboard/components/logistics/LogisticsOperationsHub";
import ShiftReports from "../dashboard/components/logistics/ShiftReports";
import DriverManagement from "../dashboard/components/logistics/DriverManagement";
import VehicleManagement from "../dashboard/components/logistics/VehicleManagement";

function LogisticsPortalPage() {
  const [tab, setTab] =
    useState("dashboard");

  const [snackOpen, setSnackOpen] =
    useState(false);

  const [snackMsg, setSnackMsg] =
    useState("");

  const [snackType, setSnackType] =
    useState("success");

  const showAlert =
    useCallback(
      (
        message,
        type = "success"
      ) => {
        setSnackMsg(
          message ||
          "Operation completed"
        );

        setSnackType(type);
        setSnackOpen(true);
      },
      []
    );

  return (
    <div style={page}>
      <div style={content}>
        <div style={headerRow}>
          <div>
            <div style={logo}>
              🚚 Logistics
            </div>

            <div style={subtitle}>
              Management intelligence, driver, fleet and movement control center
            </div>
          </div>

          <div style={liveBadge}>
            <span style={liveDot} />
            LIVE OPERATIONS
          </div>
        </div>

        <div style={tabsRow}>
          <SidebarButton
            active={
              tab === "dashboard"
            }
            onClick={() =>
              setTab("dashboard")
            }
            label="Management Dashboard"
          />

          <SidebarButton
            active={
              tab === "operations"
            }
            onClick={() =>
              setTab("operations")
            }
            label="Trip Operations"
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
              tab === "reports"
            }
            onClick={() =>
              setTab("reports")
            }
            label="Operations Reports"
          />
        </div>

        {tab === "dashboard" && (
          <LogisticsDashboard />
        )}

        {tab === "operations" && (
          <LogisticsOperationsHub
            showAlert={showAlert}
          />
        )}

        {tab === "drivers" && (
          <DriverManagement
            showAlert={showAlert}
          />
        )}

        {tab === "vehicles" && (
          <VehicleManagement
            showAlert={showAlert}
          />
        )}

        {tab === "reports" && (
          <>
            <div style={reportNotice}>
              <div style={reportNoticeTitle}>
                Manual-shift analytics
              </div>

              <div style={reportNoticeText}>
                The existing Excel report
                continues to use legacy
                manual-shift metrics such
                as helpers, fuel, distance
                and overtime. Dispatch
                challans remain visible in
                Trip Operations and are not
                counted twice.
              </div>
            </div>

            <ShiftReports
              showAlert={showAlert}
            />
          </>
        )}

        <Snackbar
          open={snackOpen}
          autoHideDuration={3500}
          onClose={() =>
            setSnackOpen(false)
          }
          anchorOrigin={{
            vertical: "top",
            horizontal: "center",
          }}
        >
          <Alert
            severity={snackType}
            variant="filled"
            onClose={() =>
              setSnackOpen(false)
            }
            sx={{
              borderRadius: "14px",
              fontWeight: 800,
              boxShadow:
                "0 18px 45px rgba(0,0,0,.35)",
            }}
          >
            {snackMsg}
          </Alert>
        </Snackbar>
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
      type="button"
      onClick={onClick}
      style={{
        ...sidebarBtn,

        background: active
          ? "linear-gradient(135deg,#2563eb,#3b82f6)"
          : "rgba(255,255,255,.035)",

        border: active
          ? "1px solid rgba(96,165,250,.52)"
          : "1px solid rgba(255,255,255,.065)",

        boxShadow: active
          ? "0 10px 28px rgba(37,99,235,.28)"
          : "none",

        transform: active
          ? "translateY(-1px)"
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
    "radial-gradient(circle at top right,rgba(37,99,235,.10),transparent 32%),linear-gradient(135deg,#020617,#0f172a)",
};

const content = {
  padding: 24,
};

const headerRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 22,
  flexWrap: "wrap",
};

const logo = {
  color: "#fff",
  fontSize: 32,
  fontWeight: 950,
  marginBottom: 7,
};

const subtitle = {
  color: "rgba(255,255,255,.62)",
  fontSize: 13,
  fontWeight: 600,
};

const liveBadge = {
  height: 38,
  padding: "0 14px",
  display: "flex",
  alignItems: "center",
  gap: 8,
  borderRadius: 999,
  color: "#4ade80",
  background:
    "rgba(34,197,94,.10)",
  border:
    "1px solid rgba(34,197,94,.18)",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: ".7px",
};

const liveDot = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "#22c55e",
  boxShadow:
    "0 0 14px rgba(34,197,94,.75)",
};

const tabsRow = {
  display: "flex",
  gap: 10,
  marginBottom: 22,
  flexWrap: "wrap",
};

const sidebarBtn = {
  height: 44,
  borderRadius: 13,
  color: "#fff",
  cursor: "pointer",
  paddingLeft: 17,
  paddingRight: 17,
  fontWeight: 800,
  fontSize: 13,
  transition:
    "all .22s ease",
};

const reportNotice = {
  marginBottom: 16,
  padding: 16,
  borderRadius: 16,
  background:
    "rgba(59,130,246,.09)",
  border:
    "1px solid rgba(59,130,246,.17)",
};

const reportNoticeTitle = {
  color: "#fff",
  fontWeight: 900,
  fontSize: 13,
};

const reportNoticeText = {
  marginTop: 5,
  color: "#94a3b8",
  fontSize: 12,
  fontWeight: 650,
  lineHeight: 1.55,
};

export default LogisticsPortalPage;