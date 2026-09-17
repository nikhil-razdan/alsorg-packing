import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import { useNavigate } from "react-router-dom";
import { matflowApi, readMatFlowError } from "../api/matflowApi";
import {
  ErrorBox,
  LoadingBlock,
  MatFlowProductIdentity,
  pageSx,
  secondaryBtnSx,
  useMatFlow,
  readable,
} from "../matflowUi";

const tone = (health) => {
  if (health === "RED") return "danger";
  if (health === "AMBER") return "warning";
  return "success";
};

const healthLabel = (health) => {
  if (health === "RED") return "Critical attention";
  if (health === "AMBER") return "Needs attention";
  if (health === "GREEN") return "On track";
  return "";
};

const toneColor = (value) => ({
  danger: "var(--mf-danger-text)",
  warning: "var(--mf-warning-text)",
  success: "var(--mf-success-text)",
  muted: "var(--mf-text-muted)",
  primary: "var(--mf-primary-text)",
}[value] || "var(--mf-text)");

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(date);
};

const releaseDue = (row) => {
  if (row?.stage === "PRODUCTION_RELEASED") return { label: "Released", tone: "success" };
  const value = row?.plannedProductionReleaseDate;
  if (!value) return { label: "No release date", tone: "muted" };
  const due = new Date(`${value}T23:59:59`);
  if (Number.isNaN(due.getTime())) return { label: value, tone: "muted" };
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const days = Math.round((dueDay.getTime() - start.getTime()) / 86400000);
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, tone: "danger" };
  if (days === 0) return { label: "Today", tone: "warning" };
  if (days === 1) return { label: "Tomorrow", tone: "warning" };
  return { label: formatDate(value), tone: days <= 7 ? "warning" : "muted" };
};

const nextAction = (row) => {
  switch (row?.stage) {
    case "DESIGN_DRAFT":
    case "DESIGN_CLARIFICATION":
    case "DESIGN_SUBMITTED":
      return "Complete Design";
    case "PPC_GATE_1":
      return "Review Gate 1";
    case "ENGINEERING_REVIEW":
    case "ENGINEERING_QUERY":
    case "ENGINEERING_WORK":
    case "REVISION_REVIEW":
      return "Open Engineering";
    case "PPC_GATE_2":
      return "Review Gate 2";
    case "PRODUCTION_RELEASED":
      return "View Release";
    default:
      return "Open File";
  }
};

const dotSx = (value) => ({
  width: 8,
  height: 8,
  flex: "0 0 auto",
  borderRadius: "50%",
  background: toneColor(tone(value)),
});

const border = "1px solid var(--mf-border)";
const shellCardSx = {
  border,
  borderRadius: 1.5,
  background: "var(--mf-panel-solid)",
  boxShadow: "none",
  overflow: "hidden",
};

function KpiRail({ items }) {
  return (
    <Card sx={{ ...shellCardSx, display: "grid", gridTemplateColumns: { xs: "1fr 1fr", lg: `repeat(${items.length},minmax(0,1fr))` } }}>
      {items.map((item, index) => (
        <Box
          key={item.label}
          onClick={item.onClick}
          role={item.onClick ? "button" : undefined}
          tabIndex={item.onClick ? 0 : undefined}
          sx={{
            px: { xs: 1.5, md: 2 },
            py: 1.7,
            cursor: item.onClick ? "pointer" : "default",
            borderLeft: { xs: index % 2 ? border : "none", lg: index ? border : "none" },
            borderTop: { xs: index >= 2 ? border : "none", lg: "none" },
            "&:hover": item.onClick ? { background: "var(--mf-hover)" } : undefined,
          }}
        >
          <Typography sx={{ fontSize: { xs: 25, md: 31 }, lineHeight: 1, fontWeight: 850, color: item.color || "var(--mf-text)" }}>
            {item.value}
          </Typography>
          <Typography sx={{ mt: .65, fontSize: 11.5, fontWeight: 800, color: "var(--mf-text-secondary)" }}>{item.label}</Typography>
          {item.helper && <Typography sx={{ mt: .2, fontSize: 9.5, color: "var(--mf-text-muted)" }}>{item.helper}</Typography>}
        </Box>
      ))}
    </Card>
  );
}

function WorkflowRow({ label, value, total, toneName = "primary" }) {
  const percent = total > 0 ? Math.min(100, Math.round((Number(value || 0) / total) * 100)) : 0;
  return (
    <Box sx={{ py: 1.05, borderBottom: border }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center" }}>
        <Typography sx={{ fontSize: 11, fontWeight: 800, color: "var(--mf-text-secondary)" }}>{label}</Typography>
        <Typography sx={{ fontSize: 12, fontWeight: 900, color: "var(--mf-text)" }}>{value || 0}</Typography>
      </Box>
      <Box sx={{ mt: .65, height: 3, borderRadius: 20, background: "var(--mf-surface-strong)", overflow: "hidden" }}>
        <Box sx={{ height: "100%", width: `${percent}%`, background: toneColor(toneName), borderRadius: 20 }} />
      </Box>
    </Box>
  );
}

function MetricLine({ label, value, helper }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1.2, py: .9, borderBottom: border, alignItems: "baseline" }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: "var(--mf-text-secondary)" }}>{label}</Typography>
        {helper && <Typography sx={{ mt: .15, fontSize: 9, color: "var(--mf-text-muted)" }}>{helper}</Typography>}
      </Box>
      <Typography sx={{ fontSize: 13, fontWeight: 900, color: "var(--mf-text)", whiteSpace: "nowrap" }}>{value}</Typography>
    </Box>
  );
}

export function MatFlowDashboardPage() {
  const { selectedPlantParam } = useMatFlow();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [health, setHealth] = useState("ALL");

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    setError("");
    const [dashboardResult, engineeringResult] = await Promise.allSettled([
      matflowApi.dashboard({ plantCode: selectedPlantParam }),
      matflowApi.engineeringKpis({ plantCode: selectedPlantParam }),
    ]);

    const errors = [];
    if (dashboardResult.status === "fulfilled") {
      setData(dashboardResult.value?.data || null);
    } else {
      setData(null);
      errors.push(readMatFlowError(dashboardResult.reason, "Unable to load management overview."));
    }
    if (engineeringResult.status === "fulfilled") {
      setKpis(engineeringResult.value?.data || null);
    } else {
      setKpis(null);
      errors.push(readMatFlowError(engineeringResult.reason, "Engineering KPI summary is temporarily unavailable."));
    }
    setError(Array.from(new Set(errors.filter(Boolean))).join(" | "));
    setLoading(false);
    setRefreshing(false);
  }, [selectedPlantParam]);

  useEffect(() => { load(); }, [load]);

  const attention = useMemo(() => {
    const term = String(search || "").trim().toLowerCase();
    return (Array.isArray(data?.attentionFiles) ? data.attentionFiles : [])
      .filter((row) => health === "ALL" || row.health === health)
      .filter((row) => !term || [
        row.productionFileNo,
        row.projectCode,
        row.projectName,
        row.productName,
        row.drawingNo,
        row.currentOwner,
        row.currentDepartment,
      ].some((value) => String(value || "").toLowerCase().includes(term)));
  }, [data?.attentionFiles, search, health]);

  if (loading && !data) return <LoadingBlock />;

  const files = Number(data?.totalProductionFiles || 0);
  const updatedAt = data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <Box sx={{ ...pageSx, display: "grid", gap: 1.35 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1.5, alignItems: { xs: "flex-start", md: "center" }, flexWrap: "wrap", pb: .2 }}>
        <Box>
          <Typography component="h1" sx={{ fontSize: { xs: 25, md: 31 }, lineHeight: 1.08, fontWeight: 880, letterSpacing: "-.035em", color: "var(--mf-text)" }}>
            Overview
          </Typography>
          <Typography sx={{ mt: .35, fontSize: 10.5, color: "var(--mf-text-muted)" }}>
            Management view · Designer → PPC → Engineering → Production Release
          </Typography>
        </Box>
        <Button startIcon={<RefreshOutlinedIcon />} disabled={refreshing} onClick={() => load({ quiet: true })} sx={secondaryBtnSx}>
          {refreshing ? "Refreshing…" : `Updated ${updatedAt}`}
        </Button>
      </Box>

      {error && <ErrorBox>{error}</ErrorBox>}

      <KpiRail items={[
        { label: "Active projects", value: data?.activeProjects || 0, helper: "Distinct PD / Project identities", onClick: () => navigate("/matflow/projects") },
        { label: "Production files", value: files, helper: "One file per Product / Drawing", onClick: () => navigate("/matflow/work") },
        { label: "Need action", value: data?.needsAttention || 0, helper: "Attention, query or overdue work", color: Number(data?.needsAttention || 0) ? "var(--mf-danger-text)" : "var(--mf-success-text)", onClick: () => navigate("/matflow/work") },
        { label: "Released", value: data?.productionReleased || 0, helper: "Validated PPC Gate 2 handoff", color: "var(--mf-success-text)", onClick: () => navigate("/matflow/release") },
      ]} />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "minmax(0,1.8fr) minmax(260px,.65fr)" }, gap: 1.35, alignItems: "start" }}>
        <Card sx={shellCardSx}>
          <Box sx={{ px: 1.6, py: 1.35, display: "flex", justifyContent: "space-between", gap: 1.2, alignItems: { xs: "stretch", md: "center" }, flexDirection: { xs: "column", md: "row" }, borderBottom: border }}>
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 850, color: "var(--mf-text)" }}>Files needing attention</Typography>
              <Typography sx={{ mt: .2, fontSize: 9.8, color: "var(--mf-text-muted)" }}>Management works exceptions; routine movement stays with the workflow.</Typography>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(240px,1fr) 125px" }, gap: .7, minWidth: { md: 390 } }}>
              <Box sx={{ position: "relative" }}>
                <SearchOutlinedIcon sx={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 18, color: "var(--mf-text-muted)", zIndex: 1 }} />
                <TextField
                  fullWidth
                  size="small"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Find Product Name or PD No."
                  inputProps={{ "aria-label": "Find Product Name or PD No." }}
                  sx={{ "& .MuiOutlinedInput-root": { height: 38, pl: 3.2, borderRadius: 1.2 } }}
                />
              </Box>
              <TextField select size="small" value={health} onChange={(event) => setHealth(event.target.value)} sx={{ "& .MuiOutlinedInput-root": { height: 38, borderRadius: 1.2 } }}>
                <MenuItem value="ALL">All status</MenuItem>
                <MenuItem value="RED">Critical attention</MenuItem>
                <MenuItem value="AMBER">Needs attention</MenuItem>
                <MenuItem value="GREEN">On track</MenuItem>
              </TextField>
            </Box>
          </Box>

          <Box sx={{ overflowX: "auto" }}>
            <Box sx={{ minWidth: 860 }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "minmax(285px,1.35fr) 165px 170px 130px minmax(170px,.75fr)", minHeight: 42, alignItems: "center", background: "var(--mf-table-head)", borderBottom: border }}>
                {["Product / PD", "Stage", "Owner", "Release due", "Next action"].map((heading) => (
                  <Typography key={heading} sx={{ px: 1.4, fontSize: 9.8, fontWeight: 900, color: "var(--mf-text-secondary)" }}>{heading}</Typography>
                ))}
              </Box>

              {attention.length === 0 ? (
                <Box sx={{ px: 2, py: 4.3, textAlign: "center" }}>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: "var(--mf-text-secondary)" }}>No active control exceptions.</Typography>
                  <Typography sx={{ mt: .3, fontSize: 9.5, color: "var(--mf-text-muted)" }}>Files requiring attention, query response or overdue action will appear here.</Typography>
                </Box>
              ) : attention.slice(0, 12).map((row) => {
                const due = releaseDue(row);
                return (
                  <Box
                    key={row.productionFileId}
                    onClick={() => navigate(`/matflow/work?fileId=${row.productionFileId}`)}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "minmax(285px,1.35fr) 165px 170px 130px minmax(170px,.75fr)",
                      minHeight: 66,
                      alignItems: "center",
                      borderBottom: border,
                      cursor: "pointer",
                      "&:hover": { background: "var(--mf-table-hover)" },
                    }}
                  >
                    <Box sx={{ px: 1.4, minWidth: 0 }}>
                      <Box sx={{ display: "flex", gap: .7, alignItems: "flex-start", minWidth: 0 }}>
                        <Box sx={{ ...dotSx(row.health), mt: .45 }} />
                        <MatFlowProductIdentity
                          productName={row.productName}
                          projectCode={row.projectCode}
                          productionFileNo={row.productionFileNo}
                          drawingNo={row.drawingNo}
                          projectName={row.projectName}
                          showProjectName
                          size="sm"
                          sx={{ minWidth: 0, flex: 1 }}
                        />
                      </Box>
                    </Box>
                    <Box sx={{ px: 1.4 }}>
                      <Typography sx={{ fontSize: 10.5, fontWeight: 780, color: "var(--mf-text-secondary)" }}>{readable(row.stage)}</Typography>
                      <Typography sx={{ mt: .15, fontSize: 8.9, color: toneColor(tone(row.health)), fontWeight: 850 }}>{healthLabel(row.health)}</Typography>
                    </Box>
                    <Box sx={{ px: 1.4 }}>
                      <Typography noWrap sx={{ fontSize: 10.5, fontWeight: 780, color: "var(--mf-text-secondary)" }}>{row.currentOwner || "Unassigned"}</Typography>
                      <Typography noWrap sx={{ mt: .15, fontSize: 8.9, color: "var(--mf-text-muted)" }}>{readable(row.currentDepartment || "") || "—"}</Typography>
                    </Box>
                    <Typography sx={{ px: 1.4, fontSize: 10.5, fontWeight: due.tone === "danger" || due.tone === "warning" ? 850 : 650, color: toneColor(due.tone) }}>{due.label}</Typography>
                    <Box sx={{ px: 1.4 }}>
                      <Button
                        onClick={(event) => { event.stopPropagation(); navigate(`/matflow/work?fileId=${row.productionFileId}`); }}
                        endIcon={<ArrowForwardOutlinedIcon sx={{ fontSize: "15px !important" }} />}
                        sx={{ minWidth: 0, p: 0, color: row.health === "RED" ? "var(--mf-danger-text)" : "var(--mf-primary-text)", fontSize: 10.5, fontWeight: 850, "&:hover": { background: "transparent", textDecoration: "underline" } }}
                      >
                        {nextAction(row)}
                      </Button>
                      {(row.blockers || []).length > 0 && <Typography noWrap sx={{ mt: .25, fontSize: 8.8, color: "var(--mf-text-muted)" }}>{row.blockers.join(" · ")}</Typography>}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>

          <Box sx={{ px: 1.6, py: 1, display: "flex", justifyContent: "space-between", gap: 1, borderTop: attention.length ? "none" : border, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: 9.5, color: "var(--mf-text-muted)" }}>Showing {Math.min(attention.length, 12)} of {attention.length} matching exceptions</Typography>
            <Button onClick={() => navigate("/matflow/work")} sx={{ p: 0, minWidth: 0, minHeight: 0, fontSize: 10.5, fontWeight: 850, color: "var(--mf-primary-text)", "&:hover": { background: "transparent", textDecoration: "underline" } }}>Open Production Control</Button>
          </Box>
        </Card>

        <Box sx={{ display: "grid", gap: 1.35 }}>
          <Card sx={{ ...shellCardSx, px: 1.45, pt: 1.3, pb: .35 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 850, color: "var(--mf-text)" }}>Workflow</Typography>
            <Typography sx={{ mt: .2, mb: .6, fontSize: 9.4, color: "var(--mf-text-muted)" }}>Current file ownership by control stage</Typography>
            <WorkflowRow label="Design" value={data?.design} total={files} />
            <WorkflowRow label="PPC Gate 1" value={data?.ppcGate1} total={files} toneName="warning" />
            <WorkflowRow label="Engineering" value={data?.engineering} total={files} toneName="primary" />
            <WorkflowRow label="PPC Gate 2" value={data?.ppcGate2} total={files} toneName="warning" />
            <WorkflowRow label="Production Released" value={data?.productionReleased} total={files} toneName="success" />
          </Card>

          <Card sx={{ ...shellCardSx, px: 1.45, pt: 1.3, pb: .35 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 850, color: "var(--mf-text)" }}>Engineering</Typography>
            <Typography sx={{ mt: .2, mb: .6, fontSize: 9.4, color: "var(--mf-text-muted)" }}>Compact execution pulse</Typography>
            <MetricLine label="Files in engineering" value={kpis?.filesInEngineering || 0} />
            <MetricLine label="Open queries" value={kpis?.openQueries || 0} helper={Number(kpis?.openQueries || 0) ? "Requires clarification / response" : "No active clarification"} />
            <MetricLine label="Pending tasks" value={kpis?.pendingTasks || 0} />
            <MetricLine label="First Time Right" value={`${Number(kpis?.firstTimeRightPercent || 0).toFixed(1)}%`} helper="Released without revision-impact / Gate 2 return" />
            <MetricLine label="Avg. completed task" value={`${Number(kpis?.averageCompletedTaskMinutes || 0).toFixed(1)} min`} />
          </Card>
        </Box>
      </Box>
    </Box>
  );
}
