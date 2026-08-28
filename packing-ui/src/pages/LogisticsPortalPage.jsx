import {
  useCallback,
  useState,
} from "react";

import usePackFlowDataRefresh
  from "../dashboard/hooks/usePackFlowDataRefresh";

import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

import LogisticsOperationsHub from "../dashboard/components/logistics/LogisticsOperationsHub";
import ShiftReports from "../dashboard/components/logistics/ShiftReports";
import DriverManagement from "../dashboard/components/logistics/DriverManagement";
import VehicleManagement from "../dashboard/components/logistics/VehicleManagement";

function LogisticsPortalPage() {
  const [tab, setTab] =
    useState("operations");

  const [livePulse, setLivePulse] =
    useState(0);

  /*
   * The portal shell owns no logistics records itself; its imported workspaces
   * remain the authoritative data owners.  Incrementing this token provides a
   * stable, non-remounting live-refresh signal to those workspaces.  Updated
   * workspaces can consume it without losing filters, open dialogs or pagination.
   */
  usePackFlowDataRefresh(
    "logistics",
    async () => {
      setLivePulse(
        (current) =>
          current + 1
      );
    },
    {
      intervalMs: 6000,
    }
  );

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
    <div className="packflow-theme-page packflow-logistics-page" style={page}>
      <div style={content}>
        <div style={headerRow}>
          <div>
            <div style={logo}>
              🚚 Logistics
            </div>

            <div style={subtitle}>
              Driver, fleet and movement control center
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

        {tab === "operations" && (
          <LogisticsOperationsHub
            showAlert={showAlert}
            liveRefreshToken={livePulse}
          />
        )}

        {tab === "drivers" && (
          <DriverManagement
            showAlert={showAlert}
            liveRefreshToken={livePulse}
          />
        )}

        {tab === "vehicles" && (
          <VehicleManagement
            showAlert={showAlert}
            liveRefreshToken={livePulse}
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
              liveRefreshToken={livePulse}
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
          : "rgba(var(--pf-fg-rgb),.035)",

        border: active
          ? "1px solid rgba(96,165,250,.52)"
          : "1px solid rgba(var(--pf-fg-rgb),.065)",

        boxShadow: active
          ? "0 10px 28px rgba(37,99,235,.28)"
          : "none",

        transform: active
          ? "translateY(-1px)"
          : "none",

        color: active
          ? "#fff"
          : "var(--pf-text-strong)",
      }}
    >
      {label}
    </button>
  );
}

const page = {
  minHeight: "100%",
  background:
    "radial-gradient(circle at 88% 0%,rgba(59,130,246,.07),transparent 30%),transparent",
  color: "var(--pf-text-strong)",
};

const content = {
  padding: "6px 4px 24px",
};

const headerRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 10,
  padding: "18px 20px",
  flexWrap: "wrap",
  borderRadius: 16,
  background:
    "linear-gradient(135deg,var(--pf-surface),var(--pf-surface-alt))",
  border: "1px solid var(--pf-border-soft)",
  boxShadow: "0 7px 22px rgba(var(--pf-shadow-rgb),.055)",
};

const logo = {
  color: "var(--pf-text-strong)",
  fontSize: 30,
  lineHeight: 1.08,
  fontWeight: 950,
  letterSpacing: "-.025em",
  marginBottom: 6,
};

const subtitle = {
  color: "var(--pf-text-muted)",
  fontSize: 12.5,
  lineHeight: 1.5,
  fontWeight: 650,
};

const liveBadge = {
  height: 36,
  padding: "0 13px",
  display: "flex",
  alignItems: "center",
  gap: 8,
  borderRadius: 999,
  color: "#15803d",
  background: "rgba(34,197,94,.09)",
  border: "1px solid rgba(34,197,94,.17)",
  fontSize: 10.5,
  fontWeight: 900,
  letterSpacing: ".55px",
};

const liveDot = {
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: "#22c55e",
  boxShadow: "0 0 10px rgba(34,197,94,.45)",
};

const tabsRow = {
  display: "flex",
  gap: 6,
  width: "fit-content",
  maxWidth: "100%",
  overflowX: "auto",
  marginBottom: 16,
  padding: 5,
  borderRadius: 13,
  background: "var(--pf-surface-alt)",
  border: "1px solid var(--pf-border-soft)",
};

const sidebarBtn = {
  height: 40,
  borderRadius: 9,
  cursor: "pointer",
  paddingLeft: 15,
  paddingRight: 15,
  fontWeight: 850,
  fontSize: 12,
  whiteSpace: "nowrap",
  transition: "all .18s ease",
};

const reportNotice = {
  marginBottom: 14,
  padding: "13px 15px",
  borderRadius: 13,
  background:
    "linear-gradient(135deg,rgba(59,130,246,.075),rgba(14,165,233,.035))",
  border: "1px solid rgba(59,130,246,.15)",
};

const reportNoticeTitle = {
  color: "var(--pf-text-strong)",
  fontWeight: 900,
  fontSize: 12.5,
};

const reportNoticeText = {
  marginTop: 4,
  color: "var(--pf-text-muted)",
  fontSize: 11.5,
  fontWeight: 650,
  lineHeight: 1.55,
};

export default LogisticsPortalPage;