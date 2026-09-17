import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, Card, TextField, Typography } from "@mui/material";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { useNavigate } from "react-router-dom";
import { matflowApi, readMatFlowError } from "../api/matflowApi";
import {
  ErrorBox,
  LoadingBlock,
  MatFlowProductIdentity,
  getMatFlowDepartmentAccess,
  pageSx,
  panelSx,
  primaryBtnSx,
  primaryMatFlowDepartment,
  readable,
  secondaryBtnSx,
  useMatFlow,
} from "../matflowUi";

const DESIGN_STAGES = new Set(["DESIGN_DRAFT", "DESIGN_CLARIFICATION", "DESIGN_SUBMITTED"]);
const ENGINEERING_STAGES = new Set(["ENGINEERING_REVIEW", "ENGINEERING_QUERY", "ENGINEERING_WORK", "REVISION_REVIEW"]);
const PPC_STAGES = new Set(["PPC_GATE_1", "PPC_GATE_2"]);
const CLOSED_DESIGN = new Set(["DONE", "CANCELLED"]);

const focusLabel = (focus) => ({
  DESIGN: "Design",
  ENGINEERING: "Engineering",
  PPC: "PPC",
  PRODUCTION: "Production",
  MANAGEMENT: "Management",
}[focus] || "Management");

const blockersForFocus = (row, focus) => {
  const blockers = Array.isArray(row?.blockers) ? row.blockers : [];
  if (focus === "MANAGEMENT" || focus === "PPC") return blockers;
  if (focus === "DESIGN") {
    return blockers.filter((value) => {
      const text = String(value || "").toLowerCase();
      return text.includes("design") || text.includes("query") || text.includes("overdue") || text.includes("revision");
    });
  }
  if (focus === "ENGINEERING") {
    return blockers.filter((value) => {
      const text = String(value || "").toLowerCase();
      return !text.includes("design task");
    });
  }
  return blockers;
};

const dueLabel = (row) => {
  if (row?.stage === "PRODUCTION_RELEASED") return "Released";
  if (!row?.plannedProductionReleaseDate) return "No release date";
  const due = new Date(`${row.plannedProductionReleaseDate}T23:59:59`);
  const today = new Date();
  if (Number.isNaN(due.getTime())) return row.plannedProductionReleaseDate;
  const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  return `${days}d to release`;
};

function Metric({ label, value, helper, attention = false }) {
  return (
    <Box sx={{ px: 1.25, py: 1.05, borderRight: "1px solid var(--mf-border)", "&:last-child": { borderRight: 0 } }}>
      <Typography sx={{ fontSize: 22, lineHeight: 1, fontWeight: 950, color: attention && Number(value) > 0 ? "var(--mf-danger-text)" : "var(--mf-text)" }}>{value}</Typography>
      <Typography sx={{ mt: 0.45, fontSize: 10.2, fontWeight: 850, color: "var(--mf-text-secondary)" }}>{label}</Typography>
      {helper && <Typography sx={{ mt: 0.1, fontSize: 8.8, color: "var(--mf-text-muted)" }}>{helper}</Typography>}
    </Box>
  );
}

export function MatFlowDashboardPage() {
  const { selectedPlantParam, roles } = useMatFlow();
  const navigate = useNavigate();
  const access = useMemo(() => getMatFlowDepartmentAccess(roles), [roles]);
  const preferred = useMemo(() => primaryMatFlowDepartment(roles), [roles]);
  const focusOptions = useMemo(() => {
    const values = [];
    if (access.design) values.push("DESIGN");
    if (access.engineering) values.push("ENGINEERING");
    if (access.ppc) values.push("PPC");
    if (access.production) values.push("PRODUCTION");
    if (access.management && values.length > 1) values.unshift("MANAGEMENT");
    return Array.from(new Set(values));
  }, [access]);
  const initialFocus = focusOptions.includes(preferred) ? preferred : (focusOptions[0] || "MANAGEMENT");

  const [focus, setFocus] = useState(initialFocus);
  const [data, setData] = useState(null);
  const [engineering, setEngineering] = useState(null);
  const [designTasks, setDesignTasks] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!focusOptions.includes(focus)) setFocus(initialFocus);
  }, [focusOptions, focus, initialFocus]);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    setError("");
    const requests = [matflowApi.dashboard({ plantCode: selectedPlantParam })];
    const designIndex = access.design ? requests.push(matflowApi.listDesignTasks({ plantCode: selectedPlantParam })) - 1 : -1;
    const engineeringIndex = access.engineering ? requests.push(matflowApi.engineeringKpis({ plantCode: selectedPlantParam })) - 1 : -1;
    const results = await Promise.allSettled(requests);
    const errors = [];

    if (results[0]?.status === "fulfilled") setData(results[0].value?.data || null);
    else errors.push(readMatFlowError(results[0]?.reason, "Unable to load MatFlow overview."));

    if (designIndex >= 0) {
      const result = results[designIndex];
      if (result?.status === "fulfilled") setDesignTasks(Array.isArray(result.value?.data) ? result.value.data : []);
      else errors.push(readMatFlowError(result?.reason, "Design task summary is unavailable."));
    } else setDesignTasks([]);

    if (engineeringIndex >= 0) {
      const result = results[engineeringIndex];
      if (result?.status === "fulfilled") setEngineering(result.value?.data || null);
      else errors.push(readMatFlowError(result?.reason, "Engineering summary is unavailable."));
    } else setEngineering(null);

    setError(Array.from(new Set(errors.filter(Boolean))).join(" | "));
    setLoading(false);
    setRefreshing(false);
  }, [selectedPlantParam, access.design, access.engineering]);

  useEffect(() => { load(); }, [load]);

  const designStats = useMemo(() => {
    const tasks = designTasks.map((row) => row.task || {});
    const now = new Date();
    return {
      active: tasks.filter((task) => !CLOSED_DESIGN.has(task.status)).length,
      working: tasks.filter((task) => task.status === "WORKING").length,
      hold: tasks.filter((task) => task.status === "HOLD").length,
      overdue: tasks.filter((task) => task.dueAt && new Date(task.dueAt) < now && !CLOSED_DESIGN.has(task.status)).length,
    };
  }, [designTasks]);

  const attention = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (Array.isArray(data?.attentionFiles) ? data.attentionFiles : [])
      .filter((row) => {
        if (focus === "DESIGN") return DESIGN_STAGES.has(row.stage) || (row.stage === "ENGINEERING_QUERY" && Number(row.openQueries || 0) > 0);
        if (focus === "ENGINEERING") return ENGINEERING_STAGES.has(row.stage) || row.stage === "PPC_GATE_2";
        if (focus === "PPC") return PPC_STAGES.has(row.stage);
        if (focus === "PRODUCTION") return row.stage === "PRODUCTION_RELEASED";
        return true;
      })
      .filter((row) => !term || [row.productName, row.projectCode, row.projectName, row.clientName, row.productionFileNo, row.currentOwner].some((value) => String(value || "").toLowerCase().includes(term)))
      .slice(0, 40);
  }, [data?.attentionFiles, search, focus]);

  const metrics = useMemo(() => {
    if (focus === "DESIGN") return [
      ["Active Tasks", designStats.active, "Assigned Design work"],
      ["Working", designStats.working, "Currently in progress"],
      ["On Hold", designStats.hold, "Needs intervention", designStats.hold > 0],
      ["Overdue", designStats.overdue, "Past due date", designStats.overdue > 0],
    ];
    if (focus === "ENGINEERING") return [
      ["In Engineering", engineering?.filesInEngineering || 0, "Current files"],
      ["Open Queries", engineering?.openQueries || 0, "Shared with Design", Number(engineering?.openQueries || 0) > 0],
      ["Pending Tasks", engineering?.pendingTasks || 0, "Documentation work"],
      ["Completed Tasks", engineering?.completedTasks || 0, "Engineering tasks done"],
    ];
    if (focus === "PPC") return [
      ["Gate 1", data?.ppcGate1 || 0, "Awaiting / at Gate 1"],
      ["Gate 2", data?.ppcGate2 || 0, "Ready for release review"],
      ["Released", data?.productionReleased || 0, "Production Released"],
      ["Attention", attention.length, "Current PPC queue", attention.length > 0],
    ];
    if (focus === "PRODUCTION") return [
      ["Released", data?.productionReleased || 0, "Validated handoff"],
      ["Projects", data?.activeProjects || 0, "Active PDs"],
      ["Files", data?.totalProductionFiles || 0, "Production Files"],
      ["Attention", attention.length, "Visible exceptions", attention.length > 0],
    ];
    return [
      ["Active PDs", data?.activeProjects || 0, "Projects"],
      ["Products", data?.totalProductionFiles || 0, "Production Files"],
      ["Attention", data?.needsAttention || 0, "Needs intervention", Number(data?.needsAttention || 0) > 0],
      ["Overdue", data?.overdue || 0, "Across active work", Number(data?.overdue || 0) > 0],
    ];
  }, [focus, designStats, engineering, data, attention.length]);

  if (loading && !data) return <LoadingBlock />;

  return (
    <Box sx={{ ...pageSx, display: "grid", gap: 1 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: { xs: "flex-start", md: "center" }, flexWrap: "wrap" }}>
        <Box>
          <Typography component="h1" sx={{ fontSize: { xs: 24, md: 29 }, lineHeight: 1.05, fontWeight: 950, letterSpacing: "-.03em", color: "var(--mf-text)" }}>
            {focusLabel(focus)} Overview
          </Typography>
          <Typography sx={{ mt: 0.25, fontSize: 10.2, color: "var(--mf-text-muted)" }}>
            Product Name + PD No. first. Only the department information needed for this view is shown.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 0.55, flexWrap: "wrap" }}>
          {focusOptions.length > 1 && focusOptions.map((value) => (
            <Button key={value} onClick={() => setFocus(value)} sx={focus === value ? primaryBtnSx : secondaryBtnSx}>{focusLabel(value)}</Button>
          ))}
          {(access.design || access.engineering || access.ppc || access.production || access.management) && (
            <Button onClick={() => navigate("/matflow/reports")} sx={secondaryBtnSx}>Reports</Button>
          )}
          <Button startIcon={<RefreshOutlinedIcon />} onClick={() => load({ quiet: true })} disabled={refreshing} sx={secondaryBtnSx}>{refreshing ? "Refreshing…" : "Refresh"}</Button>
        </Box>
      </Box>

      {error && <ErrorBox>{error}</ErrorBox>}

      <Card sx={{ ...panelSx, p: 0, boxShadow: "none" }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" } }}>
          {metrics.map(([label, value, helper, isAttention]) => <Metric key={label} label={label} value={value} helper={helper} attention={isAttention} />)}
        </Box>
      </Card>

      <Card sx={{ ...panelSx, p: 1 }}>
        <TextField fullWidth size="small" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find Product Name / PD No. / client / project" />
      </Card>

      <Card sx={{ ...panelSx, p: 0, overflow: "hidden" }}>
        <Box sx={{ px: 1.25, py: 0.9, borderBottom: "1px solid var(--mf-border)" }}>
          <Typography sx={{ fontSize: 11.5, fontWeight: 950, color: "var(--mf-text)" }}>Needs attention</Typography>
          <Typography sx={{ mt: 0.1, fontSize: 9, color: "var(--mf-text-muted)" }}>Only records relevant to {focusLabel(focus).toLowerCase()} are listed here.</Typography>
        </Box>
        {!attention.length ? (
          <Box sx={{ p: 2.5, textAlign: "center", fontSize: 10.5, color: "var(--mf-text-muted)" }}>No matching attention items.</Box>
        ) : attention.map((row) => (
          <Box key={row.productionFileId || row.productionFileNo} sx={{ px: 1.25, py: 0.95, display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.4fr .9fr .7fr 1.3fr auto" }, gap: 0.9, alignItems: "center", borderBottom: "1px solid var(--mf-border)", "&:last-child": { borderBottom: 0 } }}>
            <MatFlowProductIdentity productName={row.productName} projectCode={row.projectCode} productionFileNo={row.productionFileNo} drawingNo={row.drawingNo} size="sm" />
            <Box>
              <Typography sx={{ fontSize: 10.2, fontWeight: 850, color: "var(--mf-text-secondary)" }}>{row.clientName || row.projectName || "—"}</Typography>
              <Typography sx={{ mt: 0.08, fontSize: 8.9, color: "var(--mf-text-muted)" }}>{row.projectName || "—"}</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 9.8, fontWeight: 850, color: "var(--mf-text-secondary)" }}>{readable(row.stage)}</Typography>
              <Typography sx={{ mt: 0.08, fontSize: 8.8, color: "var(--mf-text-muted)" }}>{row.currentOwner || "Unassigned"}</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 9.5, color: "var(--mf-text-secondary)" }}>{blockersForFocus(row, focus).slice(0, 2).join(" · ") || "Attention required"}</Typography>
              <Typography sx={{ mt: 0.1, fontSize: 8.7, color: "var(--mf-text-muted)" }}>{dueLabel(row)}</Typography>
            </Box>
            <Button size="small" endIcon={<OpenInNewOutlinedIcon />} onClick={() => navigate(`/matflow/work?fileId=${row.productionFileId}`)} sx={secondaryBtnSx}>Open</Button>
          </Box>
        ))}
      </Card>
    </Box>
  );
}
