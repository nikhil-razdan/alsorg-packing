import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, Card, MenuItem, TextField, Typography } from "@mui/material";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { useNavigate } from "react-router-dom";
import { matflowApi, readMatFlowError } from "../api/matflowApi";
import { downloadMatFlowExcel } from "../api/matflowReportsExcel";
import {
  EmptyState,
  ErrorBox,
  LoadingBlock,
  MATFLOW_ROLES,
  MatFlowProductIdentity,
  PageHero,
  fieldSx,
  getMatFlowDepartmentAccess,
  pageSx,
  panelSx,
  primaryMatFlowDepartment,
  readable,
  secondaryBtnSx,
  useMatFlow,
} from "../matflowUi";

const REPORTS = Object.freeze({
  DESIGN: "DESIGN_TASKS",
  ENGINEERING: "ENGINEERING_TASKS",
  QUERIES: "OPEN_QUERIES",
  PPC: "PPC_HANDOFF",
});

const CLOSED = new Set(["DONE", "COMPLETE", "CANCELLED", "CLOSED", "NOT_APPLICABLE", "PRODUCTION_RELEASED"]);
const ENGINEERING_STAGES = new Set(["ENGINEERING_REVIEW", "ENGINEERING_QUERY", "ENGINEERING_WORK", "REVISION_REVIEW", "PPC_GATE_2", "PRODUCTION_RELEASED"]);
const toDateTime = (value) => (value ? new Date(value).toLocaleString() : "—");
const safeDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const includes = (value, term) => String(value ?? "").toLowerCase().includes(term);

async function mapConcurrent(items, limit, worker) {
  const source = Array.isArray(items) ? items : [];
  const results = new Array(source.length);
  let cursor = 0;
  const runner = async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= source.length) return;
      results[index] = await worker(source[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, source.length || 1)) }, runner));
  return results;
}

const identityColumns = [
  { key: "productName", label: "Product Name", width: 26 },
  { key: "projectCode", label: "PD No.", width: 16 },
  { key: "productionFileNo", label: "Production File", width: 18 },
  { key: "drawingNo", label: "Drawing No.", width: 16 },
  { key: "clientName", label: "Client", width: 24 },
  { key: "projectName", label: "Project", width: 26 },
];

function reportColumns(type) {
  if (type === REPORTS.DESIGN) return [
    ...identityColumns,
    { key: "taskNo", label: "Task No.", width: 20 },
    { key: "taskTitle", label: "Task", width: 30 },
    { key: "taskType", label: "Task Type", width: 18 },
    { key: "designer1", label: "Designer / Originator", width: 22 },
    { key: "assignedBy", label: "Assigned By", width: 22 },
    { key: "assignee", label: "Assigned User(s)", width: 28 },
    { key: "status", label: "Status", width: 16 },
    { key: "priority", label: "Priority", width: 13 },
    { key: "receivedAt", label: "Received At", width: 22 },
    { key: "dueAt", label: "Due At", width: 22 },
    { key: "startedAt", label: "Started At", width: 22 },
    { key: "completedAt", label: "Completed At", width: 22 },
    { key: "holdReason", label: "Hold Reason", width: 30 },
    { key: "remarks", label: "Remarks", width: 34 },
  ];
  if (type === REPORTS.ENGINEERING) return [
    ...identityColumns,
    { key: "taskKey", label: "Task Key", width: 18 },
    { key: "taskTitle", label: "Engineering Task", width: 30 },
    { key: "assignee", label: "Assigned Engineer", width: 22 },
    { key: "status", label: "Status", width: 16 },
    { key: "priority", label: "Priority", width: 13 },
    { key: "dueAt", label: "Due At", width: 22 },
    { key: "startedAt", label: "Started At", width: 22 },
    { key: "completedAt", label: "Completed At", width: 22 },
    { key: "completedBy", label: "Completed By", width: 20 },
    { key: "revisionContext", label: "Revision Context", width: 20 },
    { key: "completionNote", label: "Completion Note", width: 34 },
  ];
  if (type === REPORTS.QUERIES) return [
    ...identityColumns,
    { key: "taskKey", label: "Query No.", width: 18 },
    { key: "taskTitle", label: "Query / Issue", width: 34 },
    { key: "description", label: "Description", width: 40 },
    { key: "assignee", label: "Assigned To", width: 22 },
    { key: "status", label: "Status", width: 16 },
    { key: "priority", label: "Priority", width: 13 },
    { key: "dueAt", label: "Due At", width: 22 },
    { key: "responseText", label: "Response", width: 40 },
    { key: "respondedBy", label: "Responded By", width: 20 },
    { key: "respondedAt", label: "Responded At", width: 22 },
    { key: "updatedAt", label: "Last Updated", width: 22 },
  ];
  return [
    ...identityColumns,
    { key: "stage", label: "Stage", width: 22 },
    { key: "ppcOwner", label: "PPC Owner", width: 22 },
    { key: "currentOwner", label: "Current Owner", width: 22 },
    { key: "ppcGate1Decision", label: "PPC Gate 1", width: 18 },
    { key: "ppcGate2Decision", label: "PPC Gate 2", width: 18 },
    { key: "plannedProductionReleaseDate", label: "Planned Release", width: 18 },
    { key: "productionReleasedAt", label: "Released At", width: 22 },
    { key: "updatedAt", label: "Last Updated", width: 22 },
  ];
}

function reportTitle(type) {
  return {
    [REPORTS.DESIGN]: "Design Department · Task Assignment Report",
    [REPORTS.ENGINEERING]: "Engineering Department · Task Assignment Report",
    [REPORTS.QUERIES]: "Design ↔ Engineering · Open Queries / Issues",
    [REPORTS.PPC]: "PPC · Handoff & Release Report",
  }[type] || "MatFlow Department Report";
}

export function MatFlowReportsPage() {
  const { selectedPlantParam, roles, hasRole } = useMatFlow();
  const navigate = useNavigate();
  const access = useMemo(() => getMatFlowDepartmentAccess(roles), [roles]);
  const primary = useMemo(() => primaryMatFlowDepartment(roles), [roles]);
  const canSeeQueries = access.design || access.engineering || access.management;

  const availableReports = useMemo(() => {
    const rows = [];
    if (access.design) rows.push({ value: REPORTS.DESIGN, label: "Design Tasks" });
    if (access.engineering) rows.push({ value: REPORTS.ENGINEERING, label: "Engineering Tasks" });
    if (canSeeQueries) rows.push({ value: REPORTS.QUERIES, label: "Open Queries / Issues" });
    if (access.ppc || access.production) rows.push({ value: REPORTS.PPC, label: "PPC / Release" });
    return rows;
  }, [access, canSeeQueries]);

  const initialType = useMemo(() => {
    if (primary === "DESIGN" && access.design) return REPORTS.DESIGN;
    if (primary === "ENGINEERING" && access.engineering) return REPORTS.ENGINEERING;
    if ((primary === "PPC" || primary === "PRODUCTION") && (access.ppc || access.production)) return REPORTS.PPC;
    return availableReports[0]?.value || REPORTS.DESIGN;
  }, [primary, access, availableReports]);

  const [reportType, setReportType] = useState(initialType);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [assignee, setAssignee] = useState("");
  const [client, setClient] = useState("");
  const [project, setProject] = useState("");
  const [status, setStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    if (!availableReports.some((item) => item.value === reportType)) setReportType(initialType);
  }, [availableReports, reportType, initialType]);

  const loadFileDetails = useCallback(async (files) => {
    const details = await mapConcurrent(files, 6, async (file) => {
      const response = await matflowApi.getProductionFile(file.id);
      return response?.data || null;
    });
    return details.filter(Boolean);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (reportType === REPORTS.DESIGN) {
        const response = await matflowApi.listDesignTasks({ plantCode: selectedPlantParam });
        const mapped = (response?.data || []).map((row) => {
          const task = row.task || {};
          return {
            productionFileId: row.productionFileId,
            productionFileNo: row.productionFileNo,
            projectCode: row.projectCode,
            projectName: row.projectName,
            clientName: row.clientName,
            productName: row.productName,
            drawingNo: row.drawingNo,
            stage: row.stage,
            taskNo: task.taskNo,
            taskTitle: task.title,
            taskType: task.taskType,
            designer1: task.designer1,
            assignedBy: task.assignedBy,
            assignee: (task.assignees || []).join(", "),
            status: task.status,
            priority: task.priority,
            receivedAt: task.receivedAt,
            dueAt: task.dueAt,
            startedAt: task.startedAt,
            completedAt: task.completedAt,
            holdReason: task.holdReason,
            remarks: task.remarks,
            activityAt: task.receivedAt || task.createdAt || task.updatedAt,
          };
        });
        setRows(mapped);
        return;
      }

      const response = await matflowApi.listProductionFiles({ plantCode: selectedPlantParam });
      const files = Array.isArray(response?.data) ? response.data : [];

      if (reportType === REPORTS.PPC) {
        setRows(files.map((file) => ({
          productionFileId: file.id,
          productionFileNo: file.productionFileNo,
          projectCode: file.projectCode,
          projectName: file.projectName,
          clientName: file.clientName,
          productName: file.productName,
          drawingNo: file.drawingNo,
          stage: file.stage,
          ppcOwner: file.ppcOwner,
          currentOwner: file.currentOwner,
          ppcGate1Decision: file.ppcGate1Decision,
          ppcGate2Decision: file.ppcGate2Decision,
          plannedProductionReleaseDate: file.plannedProductionReleaseDate,
          productionReleasedAt: file.productionReleasedAt,
          updatedAt: file.updatedAt,
          status: file.stage,
          assignee: file.ppcOwner || file.currentOwner || "",
          activityAt: file.productionReleasedAt || file.updatedAt,
        })));
        return;
      }

      const candidates = reportType === REPORTS.ENGINEERING
        ? files.filter((file) => Number(file.engineeringTaskPending || 0) + Number(file.engineeringTaskCompleted || 0) > 0 || ENGINEERING_STAGES.has(file.stage))
        : files.filter((file) => Number(file.openQueries || 0) > 0 || file.stage === "ENGINEERING_QUERY");
      const details = await loadFileDetails(candidates);
      const mapped = [];
      for (const detail of details) {
        const file = detail.productionFile || {};
        const source = reportType === REPORTS.ENGINEERING
          ? (detail.engineeringTasks || [])
          : (detail.queries || []).filter((task) => ["OPEN", "RESPONDED"].includes(task.status));
        source.forEach((task) => mapped.push({
          productionFileId: file.id,
          productionFileNo: file.productionFileNo,
          projectCode: file.projectCode,
          projectName: file.projectName,
          clientName: file.clientName,
          productName: file.productName,
          drawingNo: file.drawingNo,
          stage: file.stage,
          taskKey: task.key,
          taskTitle: task.title,
          description: task.description,
          assignee: task.assignedTo || "",
          status: task.status,
          priority: task.priority,
          dueAt: task.dueAt,
          startedAt: task.startedAt,
          completedAt: task.completedAt,
          completedBy: task.completedBy,
          revisionContext: task.revisionContext,
          completionNote: task.completionNote,
          responseText: task.responseText,
          respondedBy: task.respondedBy,
          respondedAt: task.respondedAt,
          updatedAt: task.updatedAt,
          activityAt: task.startedAt || task.respondedAt || task.updatedAt,
        }));
      }
      setRows(mapped);
    } catch (requestError) {
      setRows([]);
      setError(readMatFlowError(requestError, "Unable to load the department report."));
    } finally {
      setLoading(false);
    }
  }, [reportType, selectedPlantParam, loadFileDetails]);

  useEffect(() => { load(); }, [load]);

  const assigneeOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.assignee).filter(Boolean))).sort(), [rows]);
  const clientOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.clientName).filter(Boolean))).sort(), [rows]);
  const projectOptions = useMemo(() => Array.from(new Set(rows.map((row) => [row.projectCode, row.projectName].filter(Boolean).join(" · ")).filter(Boolean))).sort(), [rows]);
  const statusOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.status).filter(Boolean))).sort(), [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const start = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const end = toDate ? new Date(`${toDate}T23:59:59`) : null;
    return rows.filter((row) => {
      const activity = safeDate(row.activityAt);
      if (term && ![
        row.productName, row.projectCode, row.productionFileNo, row.drawingNo, row.clientName, row.projectName,
        row.taskNo, row.taskKey, row.taskTitle, row.description, row.assignee,
      ].some((value) => includes(value, term))) return false;
      if (assignee && !includes(row.assignee, assignee.toLowerCase())) return false;
      if (client && row.clientName !== client) return false;
      if (project && [row.projectCode, row.projectName].filter(Boolean).join(" · ") !== project) return false;
      if (status && row.status !== status) return false;
      if (start && activity && activity < start) return false;
      if (end && activity && activity > end) return false;
      return true;
    });
  }, [rows, search, assignee, client, project, status, fromDate, toDate]);

  const stats = useMemo(() => {
    const now = new Date();
    const total = filtered.length;
    const completed = filtered.filter((row) => CLOSED.has(row.status)).length;
    const active = total - completed;
    const overdue = filtered.filter((row) => row.dueAt && safeDate(row.dueAt) < now && !CLOSED.has(row.status)).length;
    return { total, active, completed, overdue };
  }, [filtered]);

  const exportReport = async () => {
    await downloadMatFlowExcel({
      fileName: `${reportTitle(reportType)}_${selectedPlantParam || "ALL"}_${new Date().toISOString().slice(0, 10)}`,
      sheetName: "Department Report",
      title: reportTitle(reportType),
      subtitle: "Product Name + PD No. are the primary human-facing identity across MatFlow.",
      rows: filtered,
      columns: reportColumns(reportType),
      metadata: [
        selectedPlantParam ? `Plant ${selectedPlantParam}` : "All permitted plants",
        assignee ? `User ${assignee}` : "All users",
        client ? `Client ${client}` : "All clients",
        project ? `Project ${project}` : "All projects",
        status ? `Status ${readable(status)}` : "All statuses",
        fromDate ? `From ${fromDate}` : "",
        toDate ? `To ${toDate}` : "",
        `${filtered.length} row(s)`,
      ],
    });
  };

  const reportLabel = availableReports.find((item) => item.value === reportType)?.label || "Report";
  const isSupervisor = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.DIRECTOR, MATFLOW_ROLES.DESIGN_HEAD, MATFLOW_ROLES.ENGINEERING_HEAD);

  if (loading && !rows.length) return <LoadingBlock />;

  return (
    <Box sx={{ ...pageSx, display: "grid", gap: 1 }}>
      <PageHero
        badge="DEPARTMENT REPORTS"
        title="Reports"
        subtitle="Department task and handoff reports with Product Name + PD No. as the common reference."
        actions={(
          <Box sx={{ display: "flex", gap: 0.7, flexWrap: "wrap" }}>
            <Button startIcon={<RefreshOutlinedIcon />} onClick={load} disabled={loading} sx={secondaryBtnSx}>Refresh</Button>
            <Button startIcon={<FileDownloadOutlinedIcon />} onClick={exportReport} disabled={!filtered.length} sx={secondaryBtnSx}>Download Excel</Button>
          </Box>
        )}
      />

      {error && <ErrorBox>{error}</ErrorBox>}

      <Card sx={{ ...panelSx, p: 1.15 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(auto-fit,minmax(150px,1fr))" }, gap: 0.75 }}>
          {availableReports.length > 1 ? (
            <TextField select size="small" label="Report" value={reportType} onChange={(event) => { setReportType(event.target.value); setAssignee(""); setClient(""); setProject(""); setStatus(""); }} sx={fieldSx}>
              {availableReports.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
            </TextField>
          ) : <Box sx={{ px: 1, py: 1, border: "1px solid var(--mf-border)", borderRadius: 1.2, color: "var(--mf-text-secondary)", fontSize: 10.5, fontWeight: 850 }}>{reportLabel}</Box>}
          <TextField size="small" label="Search Product / PD / client / project / task" value={search} onChange={(event) => setSearch(event.target.value)} sx={fieldSx} />
          <TextField select size="small" label="Assigned User" value={assignee} onChange={(event) => setAssignee(event.target.value)} sx={fieldSx}>
            <MenuItem value="">All users</MenuItem>
            {assigneeOptions.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Client" value={client} onChange={(event) => setClient(event.target.value)} sx={fieldSx}>
            <MenuItem value="">All clients</MenuItem>
            {clientOptions.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Project / PD" value={project} onChange={(event) => setProject(event.target.value)} sx={fieldSx}>
            <MenuItem value="">All projects</MenuItem>
            {projectOptions.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Status" value={status} onChange={(event) => setStatus(event.target.value)} sx={fieldSx}>
            <MenuItem value="">All statuses</MenuItem>
            {statusOptions.map((value) => <MenuItem key={value} value={value}>{readable(value)}</MenuItem>)}
          </TextField>
          <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={fromDate} onChange={(event) => setFromDate(event.target.value)} sx={fieldSx} />
          <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={toDate} onChange={(event) => setToDate(event.target.value)} sx={fieldSx} />
        </Box>
      </Card>

      <Card sx={{ ...panelSx, p: 0, boxShadow: "none" }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" } }}>
          {[
            ["Rows", stats.total],
            ["Active", stats.active],
            ["Completed", stats.completed],
            ["Overdue", stats.overdue],
          ].map(([label, value], index) => (
            <Box key={label} sx={{ px: 1.25, py: 1, borderLeft: index ? "1px solid var(--mf-border)" : "none" }}>
              <Typography sx={{ fontSize: 18, fontWeight: 950, color: label === "Overdue" && value ? "var(--mf-danger-text)" : "var(--mf-text)" }}>{value}</Typography>
              <Typography sx={{ mt: 0.1, fontSize: 9.5, fontWeight: 800, color: "var(--mf-text-muted)" }}>{label}</Typography>
            </Box>
          ))}
        </Box>
      </Card>

      <Card sx={{ ...panelSx, p: 0, overflow: "hidden" }}>
        {!filtered.length ? <EmptyState>No rows match the current report filters.</EmptyState> : filtered.map((row, index) => (
          <Box
            key={`${row.productionFileId || "file"}-${row.taskNo || row.taskKey || row.stage}-${index}`}
            sx={{
              px: 1.2,
              py: 0.95,
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: reportType === REPORTS.PPC ? "1.25fr 1fr .8fr .85fr .9fr auto" : "1.2fr 1fr 1.25fr .9fr .85fr auto" },
              gap: 0.9,
              alignItems: "center",
              borderBottom: "1px solid var(--mf-border)",
              "&:last-child": { borderBottom: 0 },
            }}
          >
            <MatFlowProductIdentity productName={row.productName} projectCode={row.projectCode} productionFileNo={row.productionFileNo} drawingNo={row.drawingNo} size="sm" />
            <Box>
              <Typography sx={{ fontSize: 10.2, fontWeight: 850, color: "var(--mf-text-secondary)" }}>{row.clientName || "—"}</Typography>
              <Typography sx={{ mt: 0.1, fontSize: 9.1, color: "var(--mf-text-muted)" }}>{row.projectName || "—"}</Typography>
            </Box>
            {reportType === REPORTS.PPC ? (
              <Box>
                <Typography sx={{ fontSize: 10.3, fontWeight: 900, color: "var(--mf-text)" }}>{readable(row.stage)}</Typography>
                <Typography sx={{ mt: 0.1, fontSize: 9, color: "var(--mf-text-muted)" }}>Gate 1: {readable(row.ppcGate1Decision || "PENDING")} · Gate 2: {readable(row.ppcGate2Decision || "PENDING")}</Typography>
              </Box>
            ) : (
              <Box>
                <Typography sx={{ fontSize: 10.5, fontWeight: 900, color: "var(--mf-text)" }}>{row.taskTitle || "—"}</Typography>
                <Typography sx={{ mt: 0.1, fontSize: 9, color: "var(--mf-text-muted)" }}>{row.taskNo || row.taskKey || readable(row.taskType || "")}</Typography>
              </Box>
            )}
            <Box>
              <Typography sx={{ fontSize: 9.8, fontWeight: 800, color: "var(--mf-text-secondary)" }}>{row.assignee || row.ppcOwner || "Unassigned"}</Typography>
              {isSupervisor && <Typography sx={{ mt: 0.1, fontSize: 8.8, color: "var(--mf-text-muted)" }}>{reportType === REPORTS.DESIGN ? `Assigned by ${row.assignedBy || row.designer1 || "—"}` : row.currentOwner ? `Current ${row.currentOwner}` : ""}</Typography>}
            </Box>
            <Box>
              <Typography sx={{ fontSize: 9.7, fontWeight: 850, color: "var(--mf-text-secondary)" }}>{readable(row.status)}</Typography>
              <Typography sx={{ mt: 0.1, fontSize: 8.8, color: "var(--mf-text-muted)" }}>{row.dueAt ? `Due ${toDateTime(row.dueAt)}` : row.plannedProductionReleaseDate ? `Planned ${row.plannedProductionReleaseDate}` : ""}</Typography>
            </Box>
            <Button size="small" endIcon={<OpenInNewOutlinedIcon />} onClick={() => navigate(`/matflow/work?fileId=${row.productionFileId}`)} sx={secondaryBtnSx}>Open</Button>
          </Box>
        ))}
      </Card>
    </Box>
  );
}
