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
  PageHero,
  MATFLOW_LIST_CARD_OPTIONS,
  MatFlowViewToggle,
  MATFLOW_ROLES,
  fieldSx,
  getMatFlowDepartmentAccess,
  pageSx,
  panelSx,
  primaryMatFlowDepartment,
  readable,
  secondaryBtnSx,
  useMatFlow,
  useMatFlowViewMode,
} from "../matflowUi";

const REPORTS = Object.freeze({
  DESIGN: "DESIGN_TASKS",
  ENGINEERING: "ENGINEERING_TASKS",
  QUERIES: "OPEN_QUERIES",
  PPC: "PPC_HANDOFF",
});

const CLOSED = new Set(["DONE", "COMPLETE", "COMPLETED", "CANCELLED", "CLOSED", "NOT_APPLICABLE", "PRODUCTION_RELEASED"]);
const designTaskStatusLabel = (status) => {
  const value = String(status || "").toUpperCase();
  if (["COMPLETED", "DONE", "CANCELLED"].includes(value)) return "Completed";
  if (["WIP", "WORKING", "HOLD", "IN_PROGRESS"].includes(value)) return "WIP";
  return "Pending / Yet To Start";
};

const reportStatusLabel = (type, status) => type === REPORTS.DESIGN ? designTaskStatusLabel(status) : readable(status || "—");

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
    { key: "status", label: "Status", width: 22, value: (row) => designTaskStatusLabel(row.status) },
    { key: "priority", label: "Priority", width: 13 },
    { key: "receivedAt", label: "Received At", width: 22 },
    { key: "dueAt", label: "Due At", width: 22 },
    { key: "startedAt", label: "Started At", width: 22 },
    { key: "completedAt", label: "Completed At", width: 22 },
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
    { key: "taskKey", label: "Issue No.", width: 18 },
    { key: "taskTitle", label: "Issue / Topic", width: 34 },
    { key: "description", label: "Description", width: 40 },
    { key: "assignee", label: "Assigned To", width: 22 },
    { key: "status", label: "Status", width: 16 },
    { key: "priority", label: "Priority", width: 13 },
    { key: "dueAt", label: "Due At", width: 22 },
    { key: "responseText", label: "Latest Message", width: 40 },
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

const reportWorkPath = (type, row) => {
  const fileId = row?.productionFileId;
  if (!fileId) return "/matflow/work";
  if (type === REPORTS.QUERIES && row?.queryId) return `/matflow/work?fileId=${fileId}&tab=queries&queryId=${row.queryId}`;
  if (type === REPORTS.DESIGN) return `/matflow/work?fileId=${fileId}&tab=designTasks`;
  if (type === REPORTS.ENGINEERING) return `/matflow/work?fileId=${fileId}&tab=engineeringTasks`;
  return `/matflow/work?fileId=${fileId}`;
};

function reportTitle(type) {
  return {
    [REPORTS.DESIGN]: "Design Department · Task Assignment Report",
    [REPORTS.ENGINEERING]: "Engineering Department · Task Assignment Report",
    [REPORTS.QUERIES]: "Design ↔ Engineering · Open Issue Chats",
    [REPORTS.PPC]: "PPC · Handoff & Release Report",
  }[type] || "MatFlow Department Report";
}


/*
 * Reports/Team grid tracks deliberately use minmax + fractional growth instead of
 * fixed pixel-only columns. The minimums keep the grid readable at normal/high zoom;
 * the fractional maxima absorb extra width when the browser is zoomed out so the
 * header and rows continue to fill the available MatFlow workspace evenly.
 */
const pageColumns = (type) => {
  const identity = [
    { key: "productName", label: "Product", width: "minmax(150px,1.05fr)" },
    { key: "projectCode", label: "PD No.", width: "minmax(92px,.62fr)" },
    { key: "clientName", label: "Client", width: "minmax(125px,.86fr)" },
    { key: "projectName", label: "Project", width: "minmax(135px,.94fr)" },
  ];
  if (type === REPORTS.DESIGN) return [
    ...identity,
    { key: "task", label: "Task", width: "minmax(205px,1.5fr)" },
    { key: "assignedBy", label: "Assigned By", width: "minmax(118px,.82fr)" },
    { key: "assignee", label: "Assigned To", width: "minmax(145px,1fr)" },
    { key: "status", label: "Status", width: "minmax(100px,.68fr)" },
    { key: "receivedAt", label: "Received", width: "minmax(132px,.9fr)" },
    { key: "dueAt", label: "Due", width: "minmax(132px,.9fr)" },
    { key: "completedAt", label: "Completed", width: "minmax(132px,.9fr)" },
    { key: "action", label: "", width: "88px", align: "right" },
  ];
  if (type === REPORTS.ENGINEERING) return [
    ...identity,
    { key: "task", label: "Engineering Task", width: "minmax(210px,1.55fr)" },
    { key: "assignee", label: "Assigned Engineer", width: "minmax(145px,1fr)" },
    { key: "status", label: "Status", width: "minmax(100px,.68fr)" },
    { key: "priority", label: "Priority", width: "minmax(90px,.58fr)" },
    { key: "dueAt", label: "Due", width: "minmax(132px,.9fr)" },
    { key: "startedAt", label: "Started", width: "minmax(132px,.9fr)" },
    { key: "completedAt", label: "Completed", width: "minmax(132px,.9fr)" },
    { key: "action", label: "", width: "88px", align: "right" },
  ];
  if (type === REPORTS.QUERIES) return [
    ...identity,
    { key: "task", label: "Issue / Topic", width: "minmax(225px,1.65fr)" },
    { key: "assignee", label: "Assigned To", width: "minmax(145px,1fr)" },
    { key: "status", label: "Status", width: "minmax(100px,.68fr)" },
    { key: "priority", label: "Priority", width: "minmax(90px,.58fr)" },
    { key: "dueAt", label: "Due", width: "minmax(132px,.9fr)" },
    { key: "updatedAt", label: "Last Updated", width: "minmax(132px,.9fr)" },
    { key: "action", label: "", width: "88px", align: "right" },
  ];
  return [
    ...identity,
    { key: "stage", label: "Stage", width: "minmax(135px,.92fr)" },
    { key: "ppcOwner", label: "PPC Owner", width: "minmax(130px,.88fr)" },
    { key: "ppcGate1Decision", label: "Gate 1", width: "minmax(92px,.62fr)" },
    { key: "ppcGate2Decision", label: "Gate 2", width: "minmax(92px,.62fr)" },
    { key: "plannedProductionReleaseDate", label: "Planned Release", width: "minmax(120px,.8fr)" },
    { key: "productionReleasedAt", label: "Released At", width: "minmax(132px,.9fr)" },
    { key: "action", label: "", width: "88px", align: "right" },
  ];
};

const reportTableMinWidth = (type) => {
  if (type === REPORTS.DESIGN) return 1500;
  if (type === REPORTS.ENGINEERING) return 1390;
  if (type === REPORTS.QUERIES) return 1300;
  return 1260;
};

const reportStatusColor = (row) => {
  const status = String(row?.status || row?.stage || "").toUpperCase();
  const due = safeDate(row?.dueAt);
  const overdue = due && due < new Date() && !CLOSED.has(status);
  if (overdue || ["BLOCKED", "CANCELLED"].includes(status)) return "var(--mf-danger-text)";
  if (["DONE", "COMPLETE", "COMPLETED", "CLOSED", "PRODUCTION_RELEASED"].includes(status)) return "var(--mf-success-text)";
  if (["WIP", "IN_PROGRESS", "WORKING", "ASSIGNED", "RESPONDED"].includes(status)) return "var(--mf-primary-text)";
  return "var(--mf-text-secondary)";
};

const reportRowAccent = (row) => {
  const due = safeDate(row?.dueAt);
  if (due && due < new Date() && !CLOSED.has(String(row?.status || "").toUpperCase())) return "var(--mf-danger-text)";
  const status = String(row?.status || row?.stage || "").toUpperCase();
  if (["BLOCKED"].includes(status)) return "var(--mf-warning-text)";
  if (["DONE", "COMPLETE", "COMPLETED", "CLOSED", "PRODUCTION_RELEASED"].includes(status)) return "var(--mf-success-text)";
  return "transparent";
};

const teamDepartmentLabel = (primary) => ({
  DESIGN: "Design",
  ENGINEERING: "Engineering",
  PPC: "PPC",
  PRODUCTION: "Production",
}[primary] || "Department");

const teamMemberNames = (value) => String(value || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const pageCellValue = (row, key, type) => {
  if (key === "task") return (
    <Box>
      <Typography sx={{ fontSize: 10.4, fontWeight: 900, color: "var(--mf-text)" }}>{row.taskTitle || "—"}</Typography>
      <Typography sx={{ mt: 0.1, fontSize: 8.9, color: "var(--mf-text-muted)" }}>{row.taskNo || row.taskKey || readable(row.taskType || "")}</Typography>
    </Box>
  );
  if (key === "status") return <Typography sx={{ fontSize: 10, fontWeight: 900, color: reportStatusColor(row) }}>{reportStatusLabel(type, row.status)}</Typography>;
  if (key === "stage") return <Typography sx={{ fontSize: 10, fontWeight: 900, color: reportStatusColor(row) }}>{readable(row.stage || "—")}</Typography>;
  if (["receivedAt", "dueAt", "startedAt", "completedAt", "updatedAt", "productionReleasedAt"].includes(key)) {
    return <Typography sx={{ fontSize: 9.6, color: "var(--mf-text-secondary)", whiteSpace: "nowrap" }}>{toDateTime(row[key])}</Typography>;
  }
  if (key === "plannedProductionReleaseDate") return <Typography sx={{ fontSize: 9.8, color: "var(--mf-text-secondary)" }}>{row[key] || "—"}</Typography>;
  if (["ppcGate1Decision", "ppcGate2Decision", "priority"].includes(key)) return <Typography sx={{ fontSize: 9.8, fontWeight: 850, color: "var(--mf-text-secondary)" }}>{readable(row[key] || "—")}</Typography>;
  return <Typography sx={{ fontSize: 10, fontWeight: ["productName", "projectCode"].includes(key) ? 900 : 750, color: ["productName", "projectCode"].includes(key) ? "var(--mf-text)" : "var(--mf-text-secondary)" }}>{row[key] || "—"}</Typography>;
};

export function MatFlowReportsPage() {
  const { selectedPlantParam, roles } = useMatFlow();
  const navigate = useNavigate();
  const access = useMemo(() => getMatFlowDepartmentAccess(roles), [roles]);
  const primary = useMemo(() => primaryMatFlowDepartment(roles), [roles]);
  const teamMode = !access.management;
  const departmentLabel = teamDepartmentLabel(primary);
  const juniorDesignerOnly = useMemo(() => roles.includes(MATFLOW_ROLES.DESIGNER_JUNIOR)
    && !roles.some((role) => [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.DIRECTOR, MATFLOW_ROLES.DESIGN_HEAD, MATFLOW_ROLES.DESIGNER].includes(role)), [roles]);
  // PPC receives read-only Issue Chat visibility because unresolved cross-department
  // issues are gate context, not PPC-owned work. Junior Designers see only their own
  // assignment report; related Issue Chat stays inside the assigned Product workspace.
  const canSeeQueries = !juniorDesignerOnly && (access.design || access.engineering || access.ppc || access.management);

  const availableReports = useMemo(() => {
    const rows = [];
    if (access.design) rows.push({ value: REPORTS.DESIGN, label: "Design Tasks" });
    if (access.engineering) rows.push({ value: REPORTS.ENGINEERING, label: "Engineering Tasks" });
    if (canSeeQueries) rows.push({ value: REPORTS.QUERIES, label: "Issue Chats" });
    if (access.ppc || access.production) rows.push({ value: REPORTS.PPC, label: "PPC / Release" });
    return rows;
  }, [access, canSeeQueries]);

  const initialType = useMemo(() => {
    if (primary === "DESIGN" && access.design) return REPORTS.DESIGN;
    if (primary === "ENGINEERING" && access.engineering) return REPORTS.ENGINEERING;
    if ((primary === "PPC" || primary === "PRODUCTION") && (access.ppc || access.production)) return REPORTS.PPC;
    return availableReports[0]?.value || REPORTS.DESIGN;
  }, [primary, access, availableReports]);

  const [viewMode, setViewMode] = useMatFlowViewMode("reports", "LIST");
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
          queryId: reportType === REPORTS.QUERIES ? task.id : null,
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

  const teamMembers = useMemo(() => {
    if (!teamMode || juniorDesignerOnly) return [];
    const now = new Date();
    const members = new Map();
    filtered.forEach((row) => {
      const names = teamMemberNames(row.assignee);
      names.forEach((name) => {
        if (!members.has(name)) members.set(name, { name, total: 0, active: 0, completed: 0, overdue: 0 });
        const member = members.get(name);
        const completed = CLOSED.has(row.status);
        member.total += 1;
        if (completed) member.completed += 1;
        else member.active += 1;
        if (!completed && row.dueAt && safeDate(row.dueAt) < now) member.overdue += 1;
      });
    });
    return Array.from(members.values()).sort((left, right) => {
      if (right.overdue !== left.overdue) return right.overdue - left.overdue;
      if (right.active !== left.active) return right.active - left.active;
      return left.name.localeCompare(right.name);
    });
  }, [filtered, teamMode, juniorDesignerOnly]);

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
        juniorDesignerOnly ? "Assigned user: current Junior Designer" : (assignee ? `User ${assignee}` : "All users"),
        client ? `Client ${client}` : "All clients",
        project ? `Project ${project}` : "All projects",
        status ? `Status ${reportStatusLabel(reportType, status)}` : "All statuses",
        fromDate ? `From ${fromDate}` : "",
        toDate ? `To ${toDate}` : "",
        `${filtered.length} row(s)`,
      ],
    });
  };

  const reportLabel = availableReports.find((item) => item.value === reportType)?.label || "Report";
  const visibleColumns = useMemo(() => pageColumns(reportType), [reportType]);
  const tableTemplate = useMemo(() => visibleColumns.map((column) => column.width).join(" "), [visibleColumns]);
  const tableMinWidth = useMemo(() => reportTableMinWidth(reportType), [reportType]);

  if (loading && !rows.length) return <LoadingBlock />;

  return (
    <Box sx={{ ...pageSx, display: "grid", gap: 1 }}>
      <PageHero
        badge={teamMode ? "DEPARTMENT TEAM" : "DEPARTMENT REPORTS"}
        title={juniorDesignerOnly ? "My Tasks" : teamMode ? `${departmentLabel} Team` : "Reports"}
        subtitle={juniorDesignerOnly
          ? "Your assigned Design tasks with Product Name + PD No. context."
          : teamMode
            ? "Team workload, task ownership, due dates and handoffs in one operational view."
            : "Department task and handoff reports with Product Name + PD No. as the common reference."}
        actions={(
          <Box sx={{ display: "flex", gap: 0.7, flexWrap: "wrap", alignItems: "center" }}>
            <MatFlowViewToggle value={viewMode} onChange={setViewMode} options={MATFLOW_LIST_CARD_OPTIONS} />
            <Button startIcon={<RefreshOutlinedIcon />} onClick={load} disabled={loading} sx={secondaryBtnSx}>Refresh</Button>
            <Button startIcon={<FileDownloadOutlinedIcon />} onClick={exportReport} disabled={!filtered.length} sx={secondaryBtnSx}>Download Excel</Button>
          </Box>
        )}
      />

      {error && <ErrorBox>{error}</ErrorBox>}

      <Card sx={{ ...panelSx, p: 1.15, minWidth: 0 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2,minmax(0,1fr))",
              lg: "repeat(4,minmax(0,1fr))",
              xl: "repeat(9,minmax(0,1fr))",
            },
            gap: 0.75,
            alignItems: "stretch",
            minWidth: 0,
          }}
        >
          {availableReports.length > 1 ? (
            <TextField select size="small" label={teamMode ? "Team View" : "Report"} value={reportType} onChange={(event) => { setReportType(event.target.value); setAssignee(""); setClient(""); setProject(""); setStatus(""); }} sx={fieldSx}>
              {availableReports.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
            </TextField>
          ) : <Box sx={{ px: 1, minHeight: 40, display: "flex", alignItems: "center", border: "1px solid var(--mf-border)", borderRadius: 1.2, color: "var(--mf-text-secondary)", fontSize: 10.5, fontWeight: 850 }}>{reportLabel}</Box>}
          <TextField
            size="small"
            label="Search Product / PD / client / project / task"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{ ...fieldSx, gridColumn: { xs: "auto", sm: "span 2", lg: "span 2", xl: "span 2" } }}
          />
          {!juniorDesignerOnly && <TextField select size="small" label="Assigned User" value={assignee} onChange={(event) => setAssignee(event.target.value)} sx={fieldSx}>
            <MenuItem value="">All users</MenuItem>
            {assigneeOptions.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </TextField>}
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
            {statusOptions.map((value) => <MenuItem key={value} value={value}>{reportStatusLabel(reportType, value)}</MenuItem>)}
          </TextField>
          <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={fromDate} onChange={(event) => setFromDate(event.target.value)} sx={fieldSx} />
          <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={toDate} onChange={(event) => setToDate(event.target.value)} sx={fieldSx} />
        </Box>
      </Card>

      <Card sx={{ ...panelSx, p: 0, boxShadow: "none", overflow: "hidden" }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(125px,1fr))",
            gap: "1px",
            background: "var(--mf-border)",
          }}
        >
          {[
            [teamMode ? "Assignments" : "Rows", stats.total],
            ["Active", stats.active],
            ["Completed", stats.completed],
            ["Overdue", stats.overdue],
          ].map(([label, value]) => (
            <Box key={label} sx={{ px: 1.25, py: 0.9, minWidth: 0, background: "var(--mf-panel-solid)" }}>
              <Typography sx={{ fontSize: 18, lineHeight: 1.05, fontWeight: 950, color: label === "Overdue" && value ? "var(--mf-danger-text)" : "var(--mf-text)" }}>{value}</Typography>
              <Typography sx={{ mt: 0.12, fontSize: 9.3, fontWeight: 850, color: "var(--mf-text-muted)" }}>{label}</Typography>
            </Box>
          ))}
        </Box>
      </Card>

      {teamMode && !juniorDesignerOnly && teamMembers.length > 0 && (
        <Card sx={{ ...panelSx, p: 0, overflow: "hidden", boxShadow: "none" }}>
          <Box sx={{ px: 1.2, py: 0.9, borderBottom: "1px solid var(--mf-border)", display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Box>
              <Typography sx={{ fontSize: 11.2, fontWeight: 950, color: "var(--mf-text)" }}>Team workload</Typography>
              <Typography sx={{ mt: 0.08, fontSize: 8.9, color: "var(--mf-text-muted)" }}>Select a team member to filter the assignments below.</Typography>
            </Box>
            {assignee && <Button size="small" onClick={() => setAssignee("")} sx={secondaryBtnSx}>Show whole team</Button>}
          </Box>
          <Box
            sx={{
              p: 0.8,
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(auto-fill,minmax(190px,230px))" },
              justifyContent: "start",
              alignItems: "stretch",
              gap: 0.65,
            }}
          >
            {teamMembers.map((member) => (
              <Box
                key={member.name}
                component="button"
                type="button"
                onClick={() => setAssignee(member.name)}
                sx={{
                  p: 0.9,
                  width: "100%",
                  minWidth: 0,
                  minHeight: 66,
                  display: "grid",
                  alignContent: "center",
                  textAlign: "left",
                  font: "inherit",
                  color: "inherit",
                  cursor: "pointer",
                  borderRadius: 1.2,
                  border: assignee === member.name ? "1px solid var(--mf-primary)" : "1px solid var(--mf-border)",
                  background: assignee === member.name ? "var(--mf-primary-soft)" : "var(--mf-panel-solid)",
                  "&:hover": { background: "var(--mf-table-hover)", borderColor: "var(--mf-border-strong)" },
                }}
              >
                <Typography noWrap sx={{ fontSize: 10.3, fontWeight: 950, color: "var(--mf-text)" }}>{member.name}</Typography>
                <Box sx={{ mt: 0.5, display: "grid", gridTemplateColumns: "repeat(3,auto)", justifyContent: "start", columnGap: 1.05, rowGap: 0.3 }}>
                  <Typography sx={{ whiteSpace: "nowrap", fontSize: 8.7, fontWeight: 850, color: "var(--mf-primary-text)" }}>{member.active} active</Typography>
                  <Typography sx={{ whiteSpace: "nowrap", fontSize: 8.7, fontWeight: 850, color: "var(--mf-success-text)" }}>{member.completed} done</Typography>
                  <Typography sx={{ whiteSpace: "nowrap", fontSize: 8.7, fontWeight: 900, color: member.overdue ? "var(--mf-danger-text)" : "var(--mf-text-muted)" }}>{member.overdue} overdue</Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Card>
      )}

      {!filtered.length ? (
        <Card sx={{ ...panelSx, p: 0, overflow: "hidden", boxShadow: "none" }}>
          <EmptyState>No rows match the current report filters.</EmptyState>
        </Card>
      ) : viewMode === "CARD" ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(auto-fit,minmax(420px,1fr))" }, gap: 1, alignItems: "stretch" }}>
          {filtered.map((row, index) => (
            <Card
              key={`${row.productionFileId || "file"}-${row.taskNo || row.taskKey || row.stage}-${index}`}
              sx={{ ...panelSx, p: 1.2, borderTop: `3px solid ${reportRowAccent(row)}`, display: "grid", gap: 0.9, boxShadow: "none" }}
            >
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))" }, gap: 0.8 }}>
                {visibleColumns.filter((column) => column.key !== "action").map((column) => (
                  <Box key={column.key} sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 8.3, fontWeight: 900, letterSpacing: ".035em", textTransform: "uppercase", color: "var(--mf-text-muted)" }}>
                      {column.label}
                    </Typography>
                    <Box sx={{ mt: 0.18, minWidth: 0 }}>{pageCellValue(row, column.key, reportType)}</Box>
                  </Box>
                ))}
              </Box>
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Button
                  size="small"
                  endIcon={<OpenInNewOutlinedIcon />}
                  onClick={() => navigate(reportWorkPath(reportType, row))}
                  sx={secondaryBtnSx}
                >
                  {reportType === REPORTS.QUERIES ? "Open chat" : "Open"}
                </Button>
              </Box>
            </Card>
          ))}
        </Box>
      ) : (
        <Card sx={{ ...panelSx, p: 0, overflow: "hidden", boxShadow: "none", minWidth: 0 }}>
          <Box sx={{ overflowX: "auto", overflowY: "hidden", width: "100%", scrollbarGutter: "stable" }}>
            <Box sx={{ width: "100%", minWidth: tableMinWidth }}>
              <Box
                sx={{
                  px: 1.1,
                  py: 0.75,
                  display: "grid",
                  gridTemplateColumns: tableTemplate,
                  gap: 0.9,
                  alignItems: "center",
                  background: "var(--mf-table-head)",
                  borderBottom: "1px solid var(--mf-border-strong)",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}
              >
                {visibleColumns.map((column) => (
                  <Typography key={column.key} sx={{ minWidth: 0, textAlign: column.align || "left", fontSize: 8.6, fontWeight: 950, letterSpacing: ".035em", textTransform: "uppercase", color: "var(--mf-text-muted)" }}>
                    {column.label}
                  </Typography>
                ))}
              </Box>
              {filtered.map((row, index) => (
                <Box
                  key={`${row.productionFileId || "file"}-${row.taskNo || row.taskKey || row.stage}-${index}`}
                  sx={{
                    px: 1.1,
                    py: 0.85,
                    display: "grid",
                    gridTemplateColumns: tableTemplate,
                    gap: 0.9,
                    alignItems: "center",
                    borderBottom: "1px solid var(--mf-border)",
                    boxShadow: `inset 3px 0 0 ${reportRowAccent(row)}`,
                    background: "var(--mf-panel-solid)",
                    "&:last-child": { borderBottom: 0 },
                    "&:hover": { background: "var(--mf-table-hover)" },
                  }}
                >
                  {visibleColumns.map((column) => column.key === "action" ? (
                    <Button
                      key={column.key}
                      size="small"
                      endIcon={<OpenInNewOutlinedIcon />}
                      onClick={() => navigate(reportWorkPath(reportType, row))}
                      sx={{ ...secondaryBtnSx, justifySelf: "end" }}
                    >
                      {reportType === REPORTS.QUERIES ? "Open chat" : "Open"}
                    </Button>
                  ) : (
                    <Box key={column.key} sx={{ minWidth: 0 }}>
                      {pageCellValue(row, column.key, reportType)}
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          </Box>
        </Card>
      )}
    </Box>
  );
}
