import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LaunchOutlinedIcon from "@mui/icons-material/LaunchOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import { useSearchParams } from "react-router-dom";
import { matflowApi, readMatFlowError } from "../api/matflowApi";
import { downloadMatFlowExcel } from "../api/matflowReportsExcel";
import {
  ErrorBox,
  LoadingBlock,
  MATFLOW_ROLES,
  MatFlowProductIdentity,
  PageHero,
  getMatFlowDepartmentAccess,
  primaryMatFlowDepartment,
  SummaryCard,
  clean,
  dialogActionsSx,
  dialogContentSx,
  dialogPaperSx,
  dialogTitleSx,
  fieldSx,
  pageSx,
  panelSx,
  primaryBtnSx,
  readable,
  secondaryBtnSx,
  useMatFlow,
} from "../matflowUi";

const DESIGN_STAGES = ["DESIGN_DRAFT", "DESIGN_CLARIFICATION"];
const DESIGN_TASK_TYPES = [
  "NEW_PROJECT",
  "INITIAL_DRAWING",
  "REVISION",
  "PD_FILE",
  "AS_PER_MEASUREMENT",
  "COMMENTS",
  "ADDITIONAL",
  "SAMPLE",
  "UN_HOLD",
  "OTHER",
];
const toDateTime = (value) => (value ? new Date(value).toLocaleString() : "—");
const toInputDateTime = (value) => (value ? String(value).slice(0, 16) : "");
const parseAssignees = (value) =>
  Array.from(
    new Set(
      String(value || "")
        .split(/[,\n]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, 12);

const HEALTH_FILTERS = [
  { value: "RED", label: "Critical attention" },
  { value: "AMBER", label: "Needs attention" },
  { value: "GREEN", label: "On track" },
];

const STAGES_BY_FOCUS = Object.freeze({
  DESIGN: ["DESIGN_DRAFT", "DESIGN_CLARIFICATION", "DESIGN_SUBMITTED", "PPC_GATE_1"],
  ENGINEERING: ["ENGINEERING_REVIEW", "ENGINEERING_QUERY", "ENGINEERING_WORK", "REVISION_REVIEW", "PPC_GATE_2"],
  PPC: ["PPC_GATE_1", "PPC_GATE_2", "PRODUCTION_RELEASED"],
  MANAGEMENT: ["DESIGN_DRAFT", "DESIGN_CLARIFICATION", "DESIGN_SUBMITTED", "PPC_GATE_1", "ENGINEERING_REVIEW", "ENGINEERING_QUERY", "ENGINEERING_WORK", "REVISION_REVIEW", "PPC_GATE_2", "PRODUCTION_RELEASED"],
});

const TABS_BY_FOCUS = Object.freeze({
  DESIGN: [
    ["overview", "Overview"],
    ["designChecklist", "Checklist"],
    ["designTasks", "Tasks"],
    ["drawings", "Drawings"],
    ["queries", "Queries / Issues"],
    ["timeline", "Timeline"],
  ],
  ENGINEERING: [
    ["overview", "Overview"],
    ["engineeringChecklist", "Checklist"],
    ["engineeringTasks", "Tasks"],
    ["drawings", "Drawings"],
    ["queries", "Queries / Issues"],
    ["timeline", "Timeline"],
  ],
  PPC: [
    ["overview", "Overview"],
    ["timeline", "Timeline"],
  ],
  MANAGEMENT: [
    ["overview", "Overview"],
    ["queries", "Queries / Issues"],
    ["timeline", "Timeline"],
  ],
});

const visibleInFocus = (row, focus) => {
  const stage = String(row?.stage || "").toUpperCase();
  if (focus === "DESIGN") {
    return ["DESIGN_DRAFT", "DESIGN_CLARIFICATION", "DESIGN_SUBMITTED", "PPC_GATE_1"].includes(stage)
      || (stage === "ENGINEERING_QUERY" && Number(row?.openQueries || 0) > 0);
  }
  if (focus === "ENGINEERING") return ["ENGINEERING_REVIEW", "ENGINEERING_QUERY", "ENGINEERING_WORK", "REVISION_REVIEW", "PPC_GATE_2"].includes(stage);
  if (focus === "PPC") return ["PPC_GATE_1", "PPC_GATE_2", "PRODUCTION_RELEASED"].includes(stage);
  return true;
};

const timelineForFocus = (rows, focus) => {
  const list = Array.isArray(rows) ? rows : [];
  if (focus === "MANAGEMENT") return list;
  return list.filter((row) => {
    const action = String(row?.action || "").toUpperCase();
    if (action.includes("QUERY") || action.includes("PRODUCTION_FILE") || action === "FILE_SETUP_UPDATED") return true;
    if (focus === "DESIGN") return action.includes("DESIGN") || action.includes("PPC_GATE_1");
    if (focus === "ENGINEERING") return action.includes("ENGINEERING") || action.includes("BOM") || action.includes("REVISION") || action.includes("PPC_GATE_2");
    if (focus === "PPC") return action.includes("PPC") || action.includes("SUBMITTED") || action.includes("RELEASE");
    return true;
  });
};

const healthVisual = (health) => {
  const value = String(health || "").toUpperCase();
  if (value === "RED") {
    return { label: "Critical attention", accent: "var(--mf-danger-text)", border: "var(--mf-danger-border)", soft: "var(--mf-danger-soft)" };
  }
  if (value === "AMBER") {
    return { label: "Needs attention", accent: "var(--mf-warning-text)", border: "var(--mf-warning-border)", soft: "var(--mf-warning-soft)" };
  }
  if (value === "GREEN") {
    return { label: "On track", accent: "var(--mf-success-text)", border: "var(--mf-success-border)", soft: "var(--mf-success-soft)" };
  }
  return { label: "", accent: "var(--mf-border-strong)", border: "var(--mf-border)", soft: "transparent" };
};

const productionFileListRowSx = (health, selected) => {
  const visual = healthVisual(health);
  return {
    position: "relative",
    p: 1.35,
    pl: 1.65,
    borderBottom: "1px solid var(--mf-border)",
    cursor: "pointer",
    background: selected ? "var(--mf-primary-soft)" : "transparent",
    transition: "background .15s ease, box-shadow .15s ease",
    "&::before": {
      content: '""',
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
      background: visual.accent,
    },
    "&:hover": { background: selected ? "var(--mf-primary-soft)" : visual.soft },
  };
};

const productionFileHeaderSx = (health) => {
  const visual = healthVisual(health);
  return {
    ...panelSx,
    p: 1.7,
    mb: 1.2,
    borderLeft: `3px solid ${visual.accent}`,
    boxShadow: `inset 18px 0 28px -30px ${visual.accent}, var(--mf-card-shadow)`,
  };
};

const statusSx = {
  height: 23,
  borderRadius: 1.1,
  fontSize: 9.5,
  fontWeight: 900,
  color: "var(--mf-text-secondary)",
  border: "1px solid var(--mf-border)",
  background: "var(--mf-surface)",
};

const EMPTY_SETUP = {
  designer: "",
  designHead: "",
  ppcOwner: "",
  engineeringHead: "",
  assignedEngineer: "",
  plannedProductionReleaseDate: "",
  plannedDispatchDate: "",
  remarks: "",
};

const EMPTY_ACTION = {
  kind: "",
  title: "",
  decision: "",
  remarks: "",
  assignedTo: "",
  controlledReleaseReason: "",
  queryTitle: "",
  description: "",
  dueAt: "",
  priority: "NORMAL",
  response: "",
  note: "",
  taskKey: "",
  blocking: true,
  item: null,
  revision: null,
};

const EMPTY_DESIGN_TASK = {
  mode: "create",
  id: "",
  rowVersion: null,
  taskType: "INITIAL_DRAWING",
  title: "",
  description: "",
  assigneesText: "",
  receivedAt: "",
  dueAt: "",
  priority: "NORMAL",
  blocking: "true",
  remarks: "",
};

export function MatFlowWorkWorkspacePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedPlantParam, hasRole, roles } = useMatFlow();
  const departmentAccess = useMemo(() => getMatFlowDepartmentAccess(roles), [roles]);
  const preferredDepartment = useMemo(() => primaryMatFlowDepartment(roles), [roles]);
  const canSetup = hasRole(
    MATFLOW_ROLES.ADMIN,
    MATFLOW_ROLES.MANAGER,
    MATFLOW_ROLES.DESIGN_HEAD,
    MATFLOW_ROLES.PPC,
    MATFLOW_ROLES.ENGINEERING_HEAD
  );
  const canDesignTeam = hasRole(
    MATFLOW_ROLES.ADMIN,
    MATFLOW_ROLES.MANAGER,
    MATFLOW_ROLES.DESIGN_HEAD,
    MATFLOW_ROLES.DESIGNER,
    MATFLOW_ROLES.DESIGNER_JUNIOR
  );
  const canDesignHead = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.DESIGN_HEAD);
  const canPpc = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PPC);
  const canEngineeringReview = hasRole(
    MATFLOW_ROLES.ADMIN,
    MATFLOW_ROLES.MANAGER,
    MATFLOW_ROLES.ENGINEERING_HEAD,
    MATFLOW_ROLES.ENGINEERING
  );
  const canEngineeringDecision = hasRole(
    MATFLOW_ROLES.ADMIN,
    MATFLOW_ROLES.MANAGER,
    MATFLOW_ROLES.ENGINEERING_HEAD
  );
  const canEngineeringTask = hasRole(
    MATFLOW_ROLES.ADMIN,
    MATFLOW_ROLES.MANAGER,
    MATFLOW_ROLES.ENGINEERING_HEAD,
    MATFLOW_ROLES.ENGINEERING,
    MATFLOW_ROLES.ENGINEERING_JUNIOR
  );
  const canSharedQueryWrite = hasRole(
    MATFLOW_ROLES.ADMIN,
    MATFLOW_ROLES.MANAGER,
    MATFLOW_ROLES.DESIGN_HEAD,
    MATFLOW_ROLES.DESIGNER,
    MATFLOW_ROLES.DESIGNER_JUNIOR,
    MATFLOW_ROLES.ENGINEERING_HEAD,
    MATFLOW_ROLES.ENGINEERING,
    MATFLOW_ROLES.ENGINEERING_JUNIOR
  );
  const canSharedQueryClose = hasRole(
    MATFLOW_ROLES.ADMIN,
    MATFLOW_ROLES.MANAGER,
    MATFLOW_ROLES.DESIGN_HEAD,
    MATFLOW_ROLES.DESIGNER,
    MATFLOW_ROLES.ENGINEERING_HEAD,
    MATFLOW_ROLES.ENGINEERING
  );

  const focusOptions = useMemo(() => {
    const values = [];
    if (departmentAccess.design) values.push({ value: "DESIGN", label: "Design" });
    if (departmentAccess.engineering) values.push({ value: "ENGINEERING", label: "Engineering" });
    if (departmentAccess.ppc) values.push({ value: "PPC", label: "PPC" });
    if (departmentAccess.management && values.length > 1) values.unshift({ value: "MANAGEMENT", label: "Overview" });
    return values;
  }, [departmentAccess]);

  const resolvedInitialFocus = useMemo(() => {
    if (focusOptions.some((item) => item.value === preferredDepartment)) return preferredDepartment;
    return focusOptions[0]?.value || "MANAGEMENT";
  }, [focusOptions, preferredDepartment]);

  const [files, setFiles] = useState([]);
  const [detail, setDetail] = useState(null);
  const [selectedId, setSelectedId] = useState(searchParams.get("fileId") || "");
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [health, setHealth] = useState("");
  const [stage, setStage] = useState("");
  const [tab, setTab] = useState("overview");
  const [workspaceView, setWorkspaceView] = useState("FILES");
  const [workspaceFocus, setWorkspaceFocus] = useState(resolvedInitialFocus);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);
  const [setup, setSetup] = useState(EMPTY_SETUP);
  const [action, setAction] = useState(EMPTY_ACTION);
  const [designTaskDialog, setDesignTaskDialog] = useState(null);
  const [designTaskStatusDialog, setDesignTaskStatusDialog] = useState(null);
  const [revisionType, setRevisionType] = useState("DESIGN_DRAWING");
  const [revisionNo, setRevisionNo] = useState("");
  const [revisionSummary, setRevisionSummary] = useState("");
  const [revisionFile, setRevisionFile] = useState(null);

  useEffect(() => {
    if (!canDesignTeam && canEngineeringReview && revisionType !== "ENGINEERING_DRAWING") {
      setRevisionType("ENGINEERING_DRAWING");
    } else if (canDesignTeam && !canEngineeringReview && revisionType !== "DESIGN_DRAWING") {
      setRevisionType("DESIGN_DRAWING");
    }
  }, [canDesignTeam, canEngineeringReview, revisionType]);

  useEffect(() => {
    if (!focusOptions.some((item) => item.value === workspaceFocus)) setWorkspaceFocus(resolvedInitialFocus);
  }, [focusOptions, workspaceFocus, resolvedInitialFocus]);

  useEffect(() => {
    const tabs = TABS_BY_FOCUS[workspaceFocus] || TABS_BY_FOCUS.MANAGEMENT;
    if (!tabs.some(([value]) => value === tab)) setTab("overview");
    if (workspaceFocus !== "DESIGN" && workspaceView === "TASKS") setWorkspaceView("FILES");
    const allowedStages = STAGES_BY_FOCUS[workspaceFocus] || STAGES_BY_FOCUS.MANAGEMENT;
    if (stage && !allowedStages.includes(stage)) setStage("");
  }, [workspaceFocus, tab, workspaceView, stage]);

  const loadList = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) setLoading(true);
      try {
        const response = await matflowApi.listProductionFiles({
          plantCode: selectedPlantParam,
          search: clean(search) || undefined,
          health: health || undefined,
          stage: stage || undefined,
        });
        const rows = Array.isArray(response?.data) ? response.data : [];
        const hasIdentitySearch = Boolean(clean(search));
        const scopedRows = hasIdentitySearch
          ? rows
          : rows.filter((row) => visibleInFocus(row, workspaceFocus) || row.id === selectedId);
        setFiles(scopedRows);
        if (!selectedId && scopedRows.length) setSelectedId(scopedRows[0].id);
      } catch (requestError) {
        if (!quiet) setError(readMatFlowError(requestError, "Unable to load Production Files."));
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [selectedPlantParam, search, health, stage, selectedId, workspaceFocus]
  );

  const loadDetail = useCallback(async (id, { quiet = false } = {}) => {
    if (!id) {
      setDetail(null);
      return;
    }
    try {
      const response = await matflowApi.getProductionFile(id);
      setDetail(response?.data || null);
    } catch (requestError) {
      if (!quiet) setError(readMatFlowError(requestError, "Unable to load Production File."));
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [selectedPlantParam, health, stage, workspaceFocus]);

  useEffect(() => {
    if (!selectedId) return;
    setSearchParams({ fileId: selectedId }, { replace: true });
    loadDetail(selectedId);
  }, [selectedId, loadDetail, setSearchParams]);

  const refresh = async () => {
    await loadList({ quiet: true });
    await loadDetail(selectedId, { quiet: true });
  };

  const file = detail?.productionFile;
  const designDrawing = useMemo(
    () => (detail?.revisions || []).find((row) => row.type === "DESIGN_DRAWING" && row.status === "ACTIVE"),
    [detail?.revisions]
  );

  const execute = async (fn, fallback) => {
    setWorking(true);
    setError("");
    try {
      const response = await fn();
      if (response?.data?.productionFile) setDetail(response.data);
      await loadList({ quiet: true });
      setAction(EMPTY_ACTION);
      return true;
    } catch (requestError) {
      setError(readMatFlowError(requestError, fallback));
      return false;
    } finally {
      setWorking(false);
    }
  };

  const openSetup = () => {
    if (!file) return;
    setSetup({
      designer: file.designer || "",
      designHead: file.designHead || "",
      ppcOwner: file.ppcOwner || "",
      engineeringHead: file.engineeringHead || "",
      assignedEngineer: file.assignedEngineer || "",
      plannedProductionReleaseDate: file.plannedProductionReleaseDate || "",
      plannedDispatchDate: file.plannedDispatchDate || "",
      remarks: "",
    });
    setSetupOpen(true);
  };

  const saveSetup = async () => {
    const ok = await execute(
      () => matflowApi.updateProductionFileSetup(file.id, { ...setup, rowVersion: file.rowVersion }),
      "Unable to update Production File setup."
    );
    if (ok) setSetupOpen(false);
  };

  const saveChecklist = (area, item, nextStatus, remarks = item.remarks || "") => {
    const normalizedRemarks = clean(remarks) || "";
    const currentRemarks = clean(item.remarks) || "";
    if (nextStatus === item.status && normalizedRemarks === currentRemarks) return Promise.resolve(true);
    return execute(
      () =>
        matflowApi.updateChecklist(file.id, area, item.key, {
          status: nextStatus,
          remarks: normalizedRemarks || null,
          rowVersion: item.rowVersion,
        }),
      "Unable to update checklist."
    );
  };

  const openNewDesignTask = () => {
    setDesignTaskDialog({
      ...EMPTY_DESIGN_TASK,
      receivedAt: toInputDateTime(new Date().toISOString()),
    });
  };

  const openEditDesignTask = (item) => {
    setDesignTaskDialog({
      mode: "edit",
      id: item.id,
      rowVersion: item.rowVersion,
      taskType: item.taskType || "OTHER",
      title: item.title || "",
      description: item.description || "",
      assigneesText: (item.assignees || []).join(", "),
      receivedAt: toInputDateTime(item.receivedAt),
      dueAt: toInputDateTime(item.dueAt),
      priority: item.priority || "NORMAL",
      blocking: item.blocking === false ? "false" : "true",
      remarks: item.remarks || "",
    });
  };

  const saveDesignTask = async () => {
    if (!designTaskDialog || !file) return;
    const assignees = parseAssignees(designTaskDialog.assigneesText);
    if (!designTaskDialog.title.trim()) return setError("Design task title is required.");
    if (!assignees.length) return setError("Assign at least one Designer-2 / Design team member.");
    const payload = {
      taskType: designTaskDialog.taskType,
      title: designTaskDialog.title.trim(),
      description: clean(designTaskDialog.description) || null,
      assignees,
      receivedAt: designTaskDialog.receivedAt || null,
      dueAt: designTaskDialog.dueAt || null,
      priority: designTaskDialog.priority,
      blocking: designTaskDialog.blocking === "true",
      remarks: clean(designTaskDialog.remarks) || null,
      ...(designTaskDialog.mode === "edit" ? { rowVersion: designTaskDialog.rowVersion } : {}),
    };
    const ok = await execute(
      () =>
        designTaskDialog.mode === "edit"
          ? matflowApi.updateDesignTask(file.id, designTaskDialog.id, payload)
          : matflowApi.createDesignTask(file.id, payload),
      "Unable to save Design task."
    );
    if (ok) setDesignTaskDialog(null);
  };

  const requestDesignTaskStatus = (item, nextStatus) => {
    if (["HOLD", "CANCELLED"].includes(nextStatus)) {
      setDesignTaskStatusDialog({ item, status: nextStatus, note: "" });
      return;
    }
    execute(
      () =>
        matflowApi.setDesignTaskStatus(file.id, item.id, {
          status: nextStatus,
          note: null,
          rowVersion: item.rowVersion,
        }),
      "Unable to update Design task."
    );
  };

  const saveDesignTaskStatus = async () => {
    if (!designTaskStatusDialog || !file) return;
    const ok = await execute(
      () =>
        matflowApi.setDesignTaskStatus(file.id, designTaskStatusDialog.item.id, {
          status: designTaskStatusDialog.status,
          note: designTaskStatusDialog.note,
          rowVersion: designTaskStatusDialog.item.rowVersion,
        }),
      "Unable to update Design task."
    );
    if (ok) setDesignTaskStatusDialog(null);
  };

  const submitAction = () => {
    if (!file) return;
    const a = action;
    if (a.kind === "DESIGN_HEAD_REVIEW")
      return execute(
        () => matflowApi.reviewDesignHead(file.id, { decision: a.decision, remarks: a.remarks, rowVersion: file.rowVersion }),
        "Unable to record Design Head review."
      );
    if (a.kind === "DESIGN_SUBMIT")
      return execute(
        () => matflowApi.submitDesign(file.id, { controlledReleaseReason: a.controlledReleaseReason, rowVersion: file.rowVersion }),
        "Unable to submit Design."
      );
    if (a.kind === "PPC1")
      return execute(
        () => matflowApi.ppcGate1(file.id, { decision: a.decision, remarks: a.remarks, assignedTo: a.assignedTo, rowVersion: file.rowVersion }),
        "Unable to complete PPC Gate 1."
      );
    if (a.kind === "ENG_DECISION")
      return execute(
        () => matflowApi.engineeringDecision(file.id, { decision: a.decision, remarks: a.remarks, rowVersion: file.rowVersion }),
        "Unable to record Engineering decision."
      );
    if (a.kind === "QUERY_CREATE")
      return execute(
        () => matflowApi.createQuery(file.id, { title: a.queryTitle, description: a.description, assignedTo: a.assignedTo, dueAt: a.dueAt || null, priority: a.priority }),
        "Unable to create Engineering Query."
      );
    if (a.kind === "QUERY_RESPOND")
      return execute(
        () => matflowApi.respondQuery(file.id, a.item.id, { response: a.response, rowVersion: a.item.rowVersion }),
        "Unable to respond to query."
      );
    if (a.kind === "QUERY_CLOSE")
      return execute(
        () => matflowApi.closeQuery(file.id, a.item.id, { note: a.note, rowVersion: a.item.rowVersion }),
        "Unable to close query."
      );
    if (a.kind === "TASK_CREATE")
      return execute(
        () => matflowApi.createEngineeringTask(file.id, { taskKey: a.taskKey, title: a.queryTitle, assignedTo: a.assignedTo, dueAt: a.dueAt || null, priority: a.priority, blocking: a.blocking, description: a.description }),
        "Unable to create Engineering task."
      );
    if (a.kind === "TASK_STATUS")
      return execute(
        () => matflowApi.setEngineeringTaskStatus(file.id, a.item.id, { status: a.decision, note: a.note, rowVersion: a.item.rowVersion }),
        "Unable to update task."
      );
    if (a.kind === "REVISION_IMPACT")
      return execute(
        () => matflowApi.reviewRevisionImpact(file.id, a.revision.id, { decision: a.decision, impactNote: a.note, rowVersion: a.revision.rowVersion }),
        "Unable to review revision impact."
      );
    if (a.kind === "PPC2")
      return execute(
        () => matflowApi.ppcGate2(file.id, { decision: a.decision, remarks: a.remarks, rowVersion: file.rowVersion }),
        "Unable to complete PPC Gate 2."
      );
  };

  const uploadRevision = async () => {
    if (!revisionFile || !revisionNo) return setError("Revision number and file are required.");
    await execute(
      () => matflowApi.uploadRevision(file.id, { type: revisionType, revisionNo, changeSummary: revisionSummary, file: revisionFile }),
      "Unable to upload revision."
    );
    setRevisionNo("");
    setRevisionSummary("");
    setRevisionFile(null);
  };

  const openRevision = async (revision) => {
    try {
      const response = await matflowApi.revisionFile(file.id, revision.id);
      const url = URL.createObjectURL(response?.data);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (requestError) {
      setError(readMatFlowError(requestError, "Unable to open revision."));
    }
  };

  if (loading) return <LoadingBlock />;

  return (
    <Box sx={pageSx}>
      <PageHero
        badge={workspaceFocus === "DESIGN" ? "DESIGN" : workspaceFocus === "ENGINEERING" ? "ENGINEERING" : workspaceFocus === "PPC" ? "PPC" : "CONTROL"}
        title={workspaceFocus === "DESIGN" ? "Design Work" : workspaceFocus === "ENGINEERING" ? "Engineering Work" : workspaceFocus === "PPC" ? "PPC Control" : "Work"}
        subtitle={
          workspaceFocus === "DESIGN"
            ? "Checklist, assigned tasks, drawings and shared queries for the selected Product / PD."
            : workspaceFocus === "ENGINEERING"
              ? "Technical checklist, engineering tasks, drawings and shared queries for the selected Product / PD."
              : workspaceFocus === "PPC"
                ? "Gate decisions and handoff status for the selected Product / PD."
                : "Switch department focus while keeping one Product / PD Production File."
        }
        actions={(
          <Box sx={{ display: "flex", gap: 0.55, flexWrap: "wrap" }}>
            {focusOptions.length > 1 && focusOptions.map((item) => (
              <Button key={item.value} onClick={() => { setWorkspaceFocus(item.value); setWorkspaceView("FILES"); setTab("overview"); }} sx={workspaceFocus === item.value ? primaryBtnSx : secondaryBtnSx}>
                {item.label}
              </Button>
            ))}
            {workspaceFocus === "DESIGN" && departmentAccess.design && (
              <Button onClick={() => setWorkspaceView(workspaceView === "TASKS" ? "FILES" : "TASKS")} sx={workspaceView === "TASKS" ? primaryBtnSx : secondaryBtnSx}>
                {workspaceView === "TASKS" ? "Products" : "Task Desk"}
              </Button>
            )}
            {workspaceView === "FILES" && <Button startIcon={<RefreshOutlinedIcon />} onClick={refresh} sx={secondaryBtnSx}>Refresh</Button>}
          </Box>
        )}
      />
      {error && <ErrorBox>{error}</ErrorBox>}

      {workspaceView === "TASKS" ? (
        <DesignTaskDesk selectedPlantParam={selectedPlantParam} onOpenFile={(fileId) => { setSelectedId(fileId); setWorkspaceView("FILES"); setWorkspaceFocus("DESIGN"); setTab("designTasks"); }} />
      ) : (
      <>
      <Card sx={{ ...panelSx, p: 1.35 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1.3fr auto" }, gap: 1 }}>
          <TextField size="small" label="Search Product Name / PD No. / File / Drawing" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadList()} sx={fieldSx} />
          <TextField select size="small" label="Health" value={health} onChange={(e) => setHealth(e.target.value)} sx={fieldSx}>
            <MenuItem value="">All</MenuItem>
            {HEALTH_FILTERS.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Stage" value={stage} onChange={(e) => setStage(e.target.value)} sx={fieldSx}>
            <MenuItem value="">All stages</MenuItem>
            {(STAGES_BY_FOCUS[workspaceFocus] || STAGES_BY_FOCUS.MANAGEMENT).map((value) => (
              <MenuItem key={value} value={value}>{readable(value)}</MenuItem>
            ))}
          </TextField>
          <Button onClick={() => loadList()} sx={secondaryBtnSx}>Search</Button>
        </Box>
      </Card>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "360px minmax(0,1fr)" }, gap: 1.3, alignItems: "start" }}>
        <Card sx={{ ...panelSx, p: 0, maxHeight: { xl: "calc(100vh - 210px)" }, overflow: "auto" }}>
          {files.length === 0 ? (
            <Box sx={{ p: 3, color: "var(--mf-text-muted)", textAlign: "center" }}>No Production Files found.</Box>
          ) : files.map((row) => (
            <Box key={row.id} onClick={() => setSelectedId(row.id)} sx={productionFileListRowSx(row.releaseHealth, selectedId === row.id)}>
              <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "flex-start" }}>
                <MatFlowProductIdentity
                  productName={row.productName}
                  projectCode={row.projectCode}
                  productionFileNo={row.productionFileNo}
                  drawingNo={row.drawingNo}
                  size="md"
                  sx={{ flex: 1 }}
                />
                {healthVisual(row.releaseHealth).label && (
                  <Typography sx={{ color: healthVisual(row.releaseHealth).accent, fontWeight: 900, fontSize: 9.4, whiteSpace: "nowrap" }}>
                    {healthVisual(row.releaseHealth).label}
                  </Typography>
                )}
              </Box>
              <Typography sx={{ mt: 0.28, color: "var(--mf-text-muted)", fontSize: 9.7 }}>{readable(row.stage)}</Typography>
              {row.currentOwner && <Typography sx={{ mt: 0.28, color: "var(--mf-text-muted)", fontSize: 9.7 }}>Owner: {row.currentOwner}</Typography>}
            </Box>
          ))}
        </Card>

        {!detail ? (
          <Card sx={{ ...panelSx, p: 4, textAlign: "center", color: "var(--mf-text-muted)" }}>Select a Production File.</Card>
        ) : (
          <Box sx={{ minWidth: 0 }}>
            <Card sx={productionFileHeaderSx(file.releaseHealth)}>
              <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 1.2 }}>
                <MatFlowProductIdentity
                  productName={file.productName}
                  projectCode={file.projectCode}
                  productionFileNo={file.productionFileNo}
                  drawingNo={file.drawingNo}
                  projectName={file.projectName}
                  showProjectName
                  size="hero"
                />
                <Box sx={{ display: "flex", gap: 0.7, alignItems: "center", flexWrap: "wrap" }}>
                  {healthVisual(file.releaseHealth).label && (
                    <Typography sx={{ color: healthVisual(file.releaseHealth).accent, fontSize: 10, fontWeight: 900 }}>
                      {healthVisual(file.releaseHealth).label}
                    </Typography>
                  )}
                  <Chip label={readable(file.stage)} sx={statusSx} />
                  {canSetup && <Button onClick={openSetup} sx={secondaryBtnSx}>Setup</Button>}
                </Box>
              </Box>

              <Box sx={{ mt: 1.2, display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" }, gap: 0.75 }}>
                {workspaceFocus === "DESIGN" && (
                  <>
                    <SummaryCard label="Checklist" value={`${file.designChecklistProgress?.percent || 0}%`} helper={`${file.designChecklistProgress?.pending || 0} pending`} />
                    <SummaryCard label="Tasks" value={`${file.designTaskProgress?.done || 0}/${file.designTaskProgress?.total || 0}`} helper={`${file.designTaskProgress?.hold || 0} hold · ${file.designTaskProgress?.overdue || 0} overdue`} tone={file.designTaskProgress?.hold || file.designTaskProgress?.overdue ? "warning" : "success"} />
                    <SummaryCard label="Design Head" value={readable(file.designHeadDecision || "PENDING")} helper={file.designHead || "Not assigned"} tone={file.designHeadDecision === "APPROVED" ? "success" : "warning"} />
                    <SummaryCard label="Handoff" value={detail.designHandoffReady ? "READY" : "BLOCKED"} helper={detail.designHandoffReady ? "Ready for PPC" : `${detail.designHandoffBlockers?.length || 0} blocker(s)`} tone={detail.designHandoffReady ? "success" : "warning"} />
                  </>
                )}
                {workspaceFocus === "ENGINEERING" && (
                  <>
                    <SummaryCard label="Checklist" value={`${file.engineeringChecklistProgress?.percent || 0}%`} helper={`${file.engineeringChecklistProgress?.pending || 0} pending`} />
                    <SummaryCard label="Tasks" value={`${file.engineeringTaskCompleted || 0}/${Number(file.engineeringTaskPending || 0) + Number(file.engineeringTaskCompleted || 0)}`} helper={`${file.engineeringTaskPending || 0} pending`} tone={file.engineeringTaskPending ? "warning" : "success"} />
                    <SummaryCard label="Queries" value={file.openQueries || 0} helper={file.openQueries ? "Needs response / closure" : "No open query"} tone={file.openQueries ? "warning" : "success"} />
                    <SummaryCard label="BOM" value={readable(file.latestBomStatus || "NOT_STARTED")} helper={file.assignedEngineer || "Engineer not assigned"} tone={file.latestBomStatus === "READY_FOR_RELEASE" || file.latestBomStatus === "RELEASED" ? "success" : "default"} />
                  </>
                )}
                {workspaceFocus === "PPC" && (
                  <>
                    <SummaryCard label="Stage" value={readable(file.stage)} helper={file.currentOwner || "No current owner"} />
                    <SummaryCard label="Gate 1" value={readable(file.ppcGate1Decision || "PENDING")} helper={file.ppcOwner || "PPC owner not assigned"} />
                    <SummaryCard label="Gate 2" value={readable(file.ppcGate2Decision || "PENDING")} helper={detail.ppcGate2Ready ? "Ready" : `${detail.ppcGate2Blockers?.length || 0} blocker(s)`} tone={detail.ppcGate2Ready ? "success" : "warning"} />
                    <SummaryCard label="Release" value={file.productionReleasedAt ? "RELEASED" : (file.plannedProductionReleaseDate || "NOT PLANNED")} helper={file.productionReleasedAt ? toDateTime(file.productionReleasedAt) : "Planned production release"} tone={file.productionReleasedAt ? "success" : "default"} />
                  </>
                )}
                {workspaceFocus === "MANAGEMENT" && (
                  <>
                    <SummaryCard label="Department" value={file.currentDepartment || "—"} helper={file.currentOwner || "No current owner"} />
                    <SummaryCard label="Design" value={`${file.designChecklistProgress?.percent || 0}%`} helper={`${file.designTaskProgress?.overdue || 0} overdue task(s)`} tone={file.designTaskProgress?.overdue ? "warning" : "default"} />
                    <SummaryCard label="Queries" value={file.openQueries || 0} helper={file.openQueries ? "Open communication" : "No open query"} tone={file.openQueries ? "warning" : "success"} />
                    <SummaryCard label="Release" value={file.stage === "PRODUCTION_RELEASED" ? "RELEASED" : readable(file.stage)} helper={file.plannedProductionReleaseDate || "No release date"} tone={file.stage === "PRODUCTION_RELEASED" ? "success" : "default"} />
                  </>
                )}
              </Box>
            </Card>

            <Card sx={{ ...panelSx, p: 0 }}>
              <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: "1px solid var(--mf-border)", px: 1, minHeight: 42 }}>
                {(TABS_BY_FOCUS[workspaceFocus] || TABS_BY_FOCUS.MANAGEMENT).map(([value, label]) => <Tab key={value} value={value} label={label} sx={{ minHeight: 42, py: 0.6 }} />)}
              </Tabs>
              <Box sx={{ p: 1.45 }}>
                {tab === "overview" && <Overview focus={workspaceFocus} file={file} detail={detail} canDesignHead={canDesignHead} canPpc={canPpc} canEngineeringReview={canEngineeringReview} canEngineeringDecision={canEngineeringDecision} setAction={setAction} />}
                {tab === "designChecklist" && <Checklist title="Designer Checklist" area="DESIGN" items={detail.designChecklist || []} progress={file.designChecklistProgress} canEdit={canDesignTeam && DESIGN_STAGES.includes(file.stage)} working={working} onSave={saveChecklist} />}
                {tab === "designTasks" && <DesignTasks items={detail.designTasks || []} progress={file.designTaskProgress} canHead={canDesignHead && DESIGN_STAGES.includes(file.stage)} canWork={canDesignTeam && DESIGN_STAGES.includes(file.stage)} onCreate={openNewDesignTask} onEdit={openEditDesignTask} onStatus={requestDesignTaskStatus} />}
                {tab === "drawings" && <Revisions file={file} rows={(detail.revisions || []).filter((row) => workspaceFocus === "DESIGN" ? row.type === "DESIGN_DRAWING" : workspaceFocus === "ENGINEERING" ? row.type === "ENGINEERING_DRAWING" : true)} canUploadDesign={workspaceFocus === "DESIGN" && canDesignTeam} canUploadEngineering={workspaceFocus === "ENGINEERING" && canEngineeringReview} revisionType={revisionType} setRevisionType={setRevisionType} revisionNo={revisionNo} setRevisionNo={setRevisionNo} summary={revisionSummary} setSummary={setRevisionSummary} setFile={setRevisionFile} upload={uploadRevision} openRevision={openRevision} canReview={workspaceFocus === "ENGINEERING" && canEngineeringDecision} setAction={setAction} working={working} />}
                {tab === "engineeringChecklist" && <Checklist title="Engineering Technical Checklist" area="ENGINEERING" items={detail.engineeringChecklist || []} progress={file.engineeringChecklistProgress} canEdit={canEngineeringReview && ["ENGINEERING_REVIEW", "ENGINEERING_QUERY"].includes(file.stage)} working={working} onSave={saveChecklist} />}
                {tab === "queries" && <Queries
                  items={detail.queries || []}
                  canCreate={canSharedQueryWrite && ["ENGINEERING_REVIEW", "ENGINEERING_QUERY", "ENGINEERING_WORK", "REVISION_REVIEW"].includes(file.stage)}
                  canRespond={canSharedQueryWrite}
                  canClose={canSharedQueryClose}
                  setAction={setAction}
                />}
                {tab === "engineeringTasks" && <Tasks items={detail.engineeringTasks || []} canManage={canEngineeringReview} canWork={canEngineeringTask} setAction={setAction} />}
                {tab === "timeline" && <Timeline rows={timelineForFocus(detail.timeline, workspaceFocus)} />}
              </Box>
            </Card>
          </Box>
        )}
      </Box>
      </>
      )}

      <Dialog open={setupOpen} onClose={() => !working && setSetupOpen(false)} fullWidth maxWidth="md" PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle sx={dialogTitleSx}>Production File Responsibility & Dates</DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1, mt: 0.4 }}>
            {(workspaceFocus === "DESIGN" || workspaceFocus === "MANAGEMENT") && (
              <>
                <TextField label="Designer / Project Designer" value={setup.designer} onChange={(e) => setSetup((value) => ({ ...value, designer: e.target.value }))} sx={fieldSx} />
                <TextField label="Design Head" value={setup.designHead} onChange={(e) => setSetup((value) => ({ ...value, designHead: e.target.value }))} sx={fieldSx} />
              </>
            )}
            {(workspaceFocus === "PPC" || workspaceFocus === "MANAGEMENT") && (
              <TextField label="PPC Owner" value={setup.ppcOwner} onChange={(e) => setSetup((value) => ({ ...value, ppcOwner: e.target.value }))} sx={fieldSx} />
            )}
            {(workspaceFocus === "ENGINEERING" || workspaceFocus === "MANAGEMENT") && (
              <>
                <TextField label="Engineering Head" value={setup.engineeringHead} onChange={(e) => setSetup((value) => ({ ...value, engineeringHead: e.target.value }))} sx={fieldSx} />
                <TextField label="Assigned Engineer" value={setup.assignedEngineer} onChange={(e) => setSetup((value) => ({ ...value, assignedEngineer: e.target.value }))} sx={fieldSx} />
              </>
            )}
            {(workspaceFocus === "PPC" || workspaceFocus === "MANAGEMENT" || workspaceFocus === "DESIGN") && (
              <TextField type="date" label="Planned Production Release" InputLabelProps={{ shrink: true }} value={setup.plannedProductionReleaseDate} onChange={(e) => setSetup((value) => ({ ...value, plannedProductionReleaseDate: e.target.value }))} sx={fieldSx} />
            )}
            {(workspaceFocus === "PPC" || workspaceFocus === "MANAGEMENT") && (
              <TextField type="date" label="Planned Dispatch" InputLabelProps={{ shrink: true }} value={setup.plannedDispatchDate} onChange={(e) => setSetup((value) => ({ ...value, plannedDispatchDate: e.target.value }))} sx={fieldSx} />
            )}
            <TextField label="Remarks" multiline minRows={2} value={setup.remarks} onChange={(e) => setSetup((value) => ({ ...value, remarks: e.target.value }))} sx={{ ...fieldSx, gridColumn: { md: "1 / -1" } }} />
          </Box>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={() => setSetupOpen(false)} sx={secondaryBtnSx}>Cancel</Button>
          <Button disabled={working} onClick={saveSetup} sx={primaryBtnSx}>Save</Button>
        </DialogActions>
      </Dialog>

      <DesignTaskDialog value={designTaskDialog} setValue={setDesignTaskDialog} working={working} onSave={saveDesignTask} />
      <DesignTaskStatusDialog value={designTaskStatusDialog} setValue={setDesignTaskStatusDialog} working={working} onSave={saveDesignTaskStatus} />
      <ActionDialog action={action} setAction={setAction} working={working} submit={submitAction} />
    </Box>
  );
}

function DesignTaskDesk({ selectedPlantParam, onOpenFile }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [assignee, setAssignee] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await matflowApi.listDesignTasks({
        plantCode: selectedPlantParam,
        search: clean(search) || undefined,
        assignee: clean(assignee) || undefined,
        status: status || undefined,
      });
      setRows(Array.isArray(response?.data) ? response.data : []);
    } catch (requestError) {
      setError(readMatFlowError(requestError, "Unable to load Design Task Desk."));
    } finally {
      setLoading(false);
    }
  }, [selectedPlantParam, search, assignee, status]);

  useEffect(() => { load(); }, [selectedPlantParam, status]);

  const stats = useMemo(() => {
    const tasks = rows.map((row) => row.task || {});
    const active = tasks.filter((task) => !["DONE", "CANCELLED"].includes(task.status)).length;
    const working = tasks.filter((task) => task.status === "WORKING").length;
    const hold = tasks.filter((task) => task.status === "HOLD").length;
    const overdue = tasks.filter((task) => task.dueAt && new Date(task.dueAt) < new Date() && !["DONE", "CANCELLED"].includes(task.status)).length;
    return { total: tasks.length, active, working, hold, overdue };
  }, [rows]);

  const exportExcel = async () => {
    const exportRows = rows.map((row) => {
      const task = row.task || {};
      return {
        productName: row.productName,
        projectCode: row.projectCode,
        productionFileNo: row.productionFileNo,
        drawingNo: row.drawingNo,
        clientName: row.clientName,
        projectName: row.projectName,
        taskNo: task.taskNo,
        taskTitle: task.title,
        taskType: readable(task.taskType),
        designer: task.designer1,
        assignedBy: task.assignedBy,
        assignedUsers: (task.assignees || []).join(", "),
        status: readable(task.status),
        priority: task.priority,
        receivedAt: toDateTime(task.receivedAt),
        dueAt: toDateTime(task.dueAt),
        startedAt: toDateTime(task.startedAt),
        completedAt: toDateTime(task.completedAt),
        holdReason: task.holdReason,
        remarks: task.remarks,
      };
    });
    await downloadMatFlowExcel({
      fileName: `MatFlow_Design_Task_Report_${new Date().toISOString().slice(0, 10)}`,
      sheetName: "Design Tasks",
      title: "Design Department · Task Assignment Report",
      subtitle: "Product Name + PD No. identify every assignment.",
      rows: exportRows,
      metadata: [selectedPlantParam ? `Plant ${selectedPlantParam}` : "All permitted plants", assignee ? `User ${assignee}` : "All users", status ? `Status ${readable(status)}` : "All statuses", `${rows.length} row(s)`],
      columns: [
        { key: "productName", label: "Product Name" },
        { key: "projectCode", label: "PD No." },
        { key: "productionFileNo", label: "Production File" },
        { key: "drawingNo", label: "Drawing No." },
        { key: "clientName", label: "Client" },
        { key: "projectName", label: "Project" },
        { key: "taskNo", label: "Task No." },
        { key: "taskTitle", label: "Task" },
        { key: "taskType", label: "Type" },
        { key: "designer", label: "Designer / Originator" },
        { key: "assignedBy", label: "Assigned By" },
        { key: "assignedUsers", label: "Assigned User(s)" },
        { key: "status", label: "Status" },
        { key: "priority", label: "Priority" },
        { key: "receivedAt", label: "Received At" },
        { key: "dueAt", label: "Due At" },
        { key: "startedAt", label: "Started At" },
        { key: "completedAt", label: "Completed At" },
        { key: "holdReason", label: "Hold Reason" },
        { key: "remarks", label: "Remarks" },
      ],
    });
  };

  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      {error && <ErrorBox>{error}</ErrorBox>}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" }, gap: 0.7 }}>
        <SummaryCard label="Tasks" value={stats.total} />
        <SummaryCard label="Active" value={stats.active} />
        <SummaryCard label="On Hold" value={stats.hold} tone={stats.hold ? "warning" : "success"} />
        <SummaryCard label="Overdue" value={stats.overdue} tone={stats.overdue ? "danger" : "success"} />
      </Box>

      <Card sx={{ ...panelSx, p: 1.1 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 170px auto auto" }, gap: 0.7 }}>
          <TextField size="small" label="Search Product / PD / client / project / task" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} sx={fieldSx} />
          <TextField size="small" label="Assigned user" value={assignee} onChange={(e) => setAssignee(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} sx={fieldSx} />
          <TextField select size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={fieldSx}>
            <MenuItem value="">All</MenuItem>
            {["NEED_TO_START", "ASSIGNED", "WORKING", "HOLD", "DONE", "CANCELLED"].map((value) => <MenuItem key={value} value={value}>{readable(value)}</MenuItem>)}
          </TextField>
          <Button disabled={loading} onClick={load} sx={secondaryBtnSx}>Search</Button>
          <Button disabled={!rows.length} onClick={exportExcel} sx={secondaryBtnSx}>Excel</Button>
        </Box>
      </Card>

      <Card sx={{ ...panelSx, p: 0, overflow: "hidden" }}>
        <Box sx={{ display: { xs: "none", lg: "grid" }, gridTemplateColumns: "1.2fr .9fr 1.35fr .95fr 1fr .8fr auto", gap: 1, px: 1.3, py: 0.9, background: "var(--mf-table-head)", borderBottom: "1px solid var(--mf-border)" }}>
          {["Product / PD", "Project / Client", "Task", "Received / Due", "Assigned User(s)", "Status", ""].map((label, index) => <Typography key={`${label}-${index}`} sx={{ fontSize: 9, fontWeight: 900, color: "var(--mf-text-muted)" }}>{label}</Typography>)}
        </Box>
        {loading ? <Box sx={{ p: 3, textAlign: "center", color: "var(--mf-text-muted)" }}>Loading Design tasks…</Box> : rows.length === 0 ? <Box sx={{ p: 3, textAlign: "center", color: "var(--mf-text-muted)" }}>No Design tasks match the current filters.</Box> : rows.map((row) => {
          const task = row.task || {};
          return (
            <Box key={task.id} sx={{ px: 1.3, py: 1.05, display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.2fr .9fr 1.35fr .95fr 1fr .8fr auto" }, gap: 1, alignItems: "center", borderBottom: "1px solid var(--mf-border)" }}>
              <MatFlowProductIdentity productName={row.productName} projectCode={row.projectCode} productionFileNo={row.productionFileNo} drawingNo={row.drawingNo} size="sm" />
              <Box><Typography sx={{ fontSize: 10.2, fontWeight: 850, color: "var(--mf-text-secondary)" }}>{row.projectName || "—"}</Typography><Typography sx={{ fontSize: 9.2, color: "var(--mf-text-muted)" }}>{row.clientName || "Client not assigned"}</Typography></Box>
              <Box><Typography sx={{ fontSize: 10.8, fontWeight: 900, color: "var(--mf-text)" }}>{task.title}</Typography><Typography sx={{ fontSize: 9.2, color: "var(--mf-text-muted)" }}>{task.taskNo} · {readable(task.taskType)}</Typography></Box>
              <Box><Typography sx={{ fontSize: 9.8, color: "var(--mf-text-secondary)" }}>{toDateTime(task.receivedAt)}</Typography><Typography sx={{ mt: 0.15, fontSize: 9.2, color: "var(--mf-text-muted)" }}>Due {toDateTime(task.dueAt)}</Typography></Box>
              <Box><Typography sx={{ fontSize: 9.8, fontWeight: 850, color: "var(--mf-text-secondary)" }}>{(task.assignees || []).join(", ") || "Unassigned"}</Typography><Typography sx={{ mt: 0.15, fontSize: 9.2, color: "var(--mf-text-muted)" }}>Assigned by {task.assignedBy || task.designer1 || "—"}</Typography></Box>
              <Box><Chip label={readable(task.status)} sx={{ ...statusSx, color: task.status === "HOLD" ? "var(--mf-warning-text)" : task.status === "DONE" ? "var(--mf-success-text)" : "var(--mf-text-secondary)" }} />{task.holdReason && <Typography sx={{ mt: 0.2, fontSize: 8.8, color: "var(--mf-warning-text)" }}>{task.holdReason}</Typography>}</Box>
              <Button size="small" onClick={() => onOpenFile(row.productionFileId)} sx={secondaryBtnSx}>Open File</Button>
            </Box>
          );
        })}
      </Card>
    </Box>
  );
}

function Overview({ focus, file, detail, canDesignHead, canPpc, canEngineeringReview, canEngineeringDecision, setAction }) {
  const designStage = DESIGN_STAGES.includes(file.stage);
  const meta = focus === "DESIGN"
    ? [
        ["Current Owner", file.currentOwner || "—"],
        ["Designer", file.designer || "—"],
        ["Design Head", file.designHead || "—"],
        ["Planned Handoff", file.plannedProductionReleaseDate || "—"],
      ]
    : focus === "ENGINEERING"
      ? [
          ["Current Owner", file.currentOwner || "—"],
          ["Engineering Head", file.engineeringHead || "—"],
          ["Assigned Engineer", file.assignedEngineer || "—"],
          ["Planned Release", file.plannedProductionReleaseDate || "—"],
        ]
      : focus === "PPC"
        ? [
            ["Current Department", file.currentDepartment || "—"],
            ["Current Owner", file.currentOwner || "—"],
            ["PPC Owner", file.ppcOwner || "—"],
            ["Planned Release", file.plannedProductionReleaseDate || "—"],
          ]
        : [
            ["Current Department", file.currentDepartment || "—"],
            ["Current Owner", file.currentOwner || "—"],
            ["Planned Release", file.plannedProductionReleaseDate || "—"],
            ["Planned Dispatch", file.plannedDispatchDate || "—"],
          ];

  return (
    <Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" }, gap: 0.8 }}>
        {meta.map(([label, value]) => (
          <Box key={label} sx={{ px: 1.05, py: 0.9, borderBottom: "1px solid var(--mf-border)" }}>
            <Typography sx={{ fontSize: 8.9, fontWeight: 850, color: "var(--mf-text-muted)" }}>{label}</Typography>
            <Typography sx={{ mt: 0.25, fontSize: 11.2, fontWeight: 900, color: "var(--mf-text)" }}>{value}</Typography>
          </Box>
        ))}
      </Box>

      {focus === "DESIGN" && file.designHeadRemarks && (
        <Alert severity={file.designHeadDecision === "RETURNED" ? "warning" : "info"} sx={{ mt: 1 }}>
          Design Head: {file.designHeadRemarks}
        </Alert>
      )}
      {focus === "DESIGN" && designStage && (detail.designHandoffBlockers || []).length > 0 && (
        <Alert severity="info" sx={{ mt: 1 }}>
          Design handoff: {(detail.designHandoffBlockers || []).join(" · ")}
        </Alert>
      )}
      {focus === "ENGINEERING" && file.revisionReviewRequired && (
        <Alert severity="warning" sx={{ mt: 1 }}>Revision impact review is pending.</Alert>
      )}
      {focus === "ENGINEERING" && file.openQueries > 0 && (
        <Alert severity="info" sx={{ mt: 1 }}>{file.openQueries} open Design ↔ Engineering query{file.openQueries === 1 ? "" : "ies"}.</Alert>
      )}
      {focus === "PPC" && (detail.ppcGate2Blockers || []).length > 0 && ["ENGINEERING_WORK", "PPC_GATE_2"].includes(file.stage) && (
        <Alert severity="info" sx={{ mt: 1 }}>Release blockers: {(detail.ppcGate2Blockers || []).join(" · ")}</Alert>
      )}
      {focus === "MANAGEMENT" && file.controlledReleaseReason && (
        <Alert severity="warning" sx={{ mt: 1 }}>Controlled release: {file.controlledReleaseReason}</Alert>
      )}

      <Divider sx={{ my: 1.25, borderColor: "var(--mf-border)" }} />
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.65 }}>
        {focus === "DESIGN" && canDesignHead && designStage && (
          <>
            <Button sx={secondaryBtnSx} onClick={() => setAction({ ...EMPTY_ACTION, kind: "DESIGN_HEAD_REVIEW", title: "Design Head Review — Approve", decision: "APPROVE" })}>Approve Design</Button>
            <Button sx={secondaryBtnSx} onClick={() => setAction({ ...EMPTY_ACTION, kind: "DESIGN_HEAD_REVIEW", title: "Design Head Review — Return", decision: "RETURN" })}>Return</Button>
            <Button disabled={!detail.designHandoffReady} sx={primaryBtnSx} onClick={() => setAction({ ...EMPTY_ACTION, kind: "DESIGN_SUBMIT", title: "Submit Design to PPC Gate 1" })}>Send to PPC</Button>
          </>
        )}
        {focus === "PPC" && canPpc && ["DESIGN_SUBMITTED", "PPC_GATE_1"].includes(file.stage) && (
          <>
            <Button sx={primaryBtnSx} onClick={() => setAction({ ...EMPTY_ACTION, kind: "PPC1", title: "PPC Gate 1 — Accept", decision: "ACCEPT" })}>Accept Gate 1</Button>
            <Button sx={secondaryBtnSx} onClick={() => setAction({ ...EMPTY_ACTION, kind: "PPC1", title: "PPC Gate 1 — Return", decision: "RETURN" })}>Return to Design</Button>
          </>
        )}
        {focus === "ENGINEERING" && ["ENGINEERING_REVIEW", "ENGINEERING_QUERY"].includes(file.stage) && (
          <>
            {canEngineeringDecision && <Button sx={primaryBtnSx} onClick={() => setAction({ ...EMPTY_ACTION, kind: "ENG_DECISION", title: "Engineering Decision — Approve", decision: "APPROVED" })}>Approve Engineering</Button>}
            {canEngineeringReview && <Button sx={secondaryBtnSx} onClick={() => setAction({ ...EMPTY_ACTION, kind: "QUERY_CREATE", title: "Raise Query to Design" })}>Raise Query</Button>}
          </>
        )}
        {focus === "PPC" && canPpc && ["ENGINEERING_WORK", "PPC_GATE_2"].includes(file.stage) && (
          <>
            <Button disabled={!detail.ppcGate2Ready} sx={primaryBtnSx} onClick={() => setAction({ ...EMPTY_ACTION, kind: "PPC2", title: "PPC Gate 2 — Production Release", decision: "RELEASE" })}>Release</Button>
            <Button sx={secondaryBtnSx} onClick={() => setAction({ ...EMPTY_ACTION, kind: "PPC2", title: "PPC Gate 2 — Return", decision: "RETURN" })}>Return to Engineering</Button>
          </>
        )}
        {file.stage === "PRODUCTION_RELEASED" && (
          <Typography sx={{ px: 0.3, py: 0.7, fontSize: 10.2, fontWeight: 900, color: "var(--mf-success-text)" }}>
            Production Released
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function Checklist({ title, area, items, progress, canEdit, working, onSave }) {
  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, mb: 1.1, alignItems: "flex-start" }}>
        <Box>
          <Typography sx={{ fontWeight: 950, color: "var(--mf-text)" }}>{title}</Typography>
          <Typography sx={{ fontSize: 10.5, color: "var(--mf-text-muted)" }}>
            {progress?.complete || 0} complete · {progress?.notApplicable || 0} N/A · {progress?.pending || 0} pending
          </Typography>
          <Typography sx={{ mt: 0.25, fontSize: 9.3, color: "var(--mf-text-muted)" }}>
            Complete / Not Applicable is a sign-off state. After saving, that point is locked and duplicate saves do not create Timeline history.
          </Typography>
        </Box>
        <Chip label={`${progress?.percent || 0}%`} sx={statusSx} />
      </Box>
      <Box sx={{ border: "1px solid var(--mf-border)", borderRadius: 1.8, overflow: "hidden" }}>
        {items.length === 0 ? (
          <Box sx={{ p: 3, textAlign: "center", color: "var(--mf-text-muted)" }}>No checklist items.</Box>
        ) : items.map((item) => (
          <ChecklistRow
            key={item.id}
            item={item}
            area={area}
            canEdit={canEdit}
            working={working}
            onSave={onSave}
          />
        ))}
      </Box>
    </Box>
  );
}

function ChecklistRow({ item, area, canEdit, working, onSave }) {
  const [status, setStatus] = useState(item.status);
  const [remarks, setRemarks] = useState(item.remarks || "");
  useEffect(() => {
    setStatus(item.status);
    setRemarks(item.remarks || "");
  }, [item.status, item.remarks]);

  const locked = item.status === "COMPLETE" || item.status === "NOT_APPLICABLE";
  const editable = canEdit && !locked;
  const dirty = status !== item.status || (clean(remarks) || "") !== (clean(item.remarks) || "");

  return (
    <Box sx={{
      p: 1.1,
      display: "grid",
      gridTemplateColumns: { xs: "1fr", md: "110px minmax(260px,1fr) 170px minmax(180px,.8fr) auto" },
      gap: 0.8,
      alignItems: "center",
      borderBottom: "1px solid var(--mf-border)",
      background: locked ? "var(--mf-surface)" : "transparent",
      "&:last-child": { borderBottom: 0 },
    }}>
      <Chip label={readable(item.section || item.criticality)} sx={statusSx} />
      <Box>
        <Typography sx={{ fontSize: 11.5, fontWeight: 900, color: "var(--mf-text)" }}>{item.title}</Typography>
        <Typography sx={{ fontSize: 9.5, color: "var(--mf-text-muted)" }}>
          {readable(item.criticality)}{locked && item.completedBy ? ` · signed by ${item.completedBy}` : ""}
        </Typography>
      </Box>
      <TextField select size="small" value={status} disabled={!editable} onChange={(e) => setStatus(e.target.value)} sx={fieldSx}>
        <MenuItem value="PENDING">Pending</MenuItem>
        <MenuItem value="COMPLETE">Complete</MenuItem>
        {item.criticality !== "CRITICAL" && <MenuItem value="NOT_APPLICABLE">Not Applicable</MenuItem>}
      </TextField>
      <TextField
        size="small"
        value={remarks}
        disabled={!editable}
        placeholder={status === "NOT_APPLICABLE" ? "N/A reason required" : "Remarks"}
        onChange={(e) => setRemarks(e.target.value)}
        sx={fieldSx}
      />
      {locked ? (
        <Chip icon={<LockOutlinedIcon sx={{ fontSize: "14px !important" }} />} label="Locked" size="small" sx={{ ...statusSx, color: "var(--mf-success-text)", borderColor: "var(--mf-success-border)", background: "var(--mf-success-soft)" }} />
      ) : canEdit ? (
        <Button size="small" disabled={working || !dirty} onClick={() => onSave(area, item, status, remarks)} sx={secondaryBtnSx}>Save</Button>
      ) : null}
    </Box>
  );
}

function DesignTasks({ items, progress, canHead, canWork, onCreate, onEdit, onStatus }) {
  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center", mb: 1 }}>
        <Box>
          <Typography sx={{ fontWeight: 950, color: "var(--mf-text)" }}>Design Department Tasks</Typography>
          <Typography sx={{ mt: 0.2, fontSize: 10.2, color: "var(--mf-text-muted)" }}>Designer supplies the requirement; Design Head delegates work to one or many Junior Designer / Design team members.</Typography>
        </Box>
        {canHead && <Button startIcon={<AddOutlinedIcon />} onClick={onCreate} sx={primaryBtnSx}>Delegate Task</Button>}
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5,1fr)" }, gap: 0.8, mb: 1 }}>
        <SummaryCard label="Total" value={progress?.total || 0} />
        <SummaryCard label="Working" value={progress?.working || 0} />
        <SummaryCard label="On Hold" value={progress?.hold || 0} tone={progress?.hold ? "warning" : "success"} />
        <SummaryCard label="Overdue" value={progress?.overdue || 0} tone={progress?.overdue ? "danger" : "success"} />
        <SummaryCard label="Done" value={`${progress?.done || 0} · ${progress?.percent || 0}%`} tone="success" />
      </Box>

      {items.length === 0 ? (
        <Card sx={{ ...panelSx, p: 3, textAlign: "center", color: "var(--mf-text-muted)" }}>No Design tasks delegated yet.</Card>
      ) : (
        <Box sx={{ display: "grid", gap: 0.8 }}>
          {items.map((item) => {
            const active = !["DONE", "CANCELLED"].includes(item.status);
            return (
              <Card key={item.id} sx={{ ...panelSx, p: 1.3 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: "flex", gap: 0.6, alignItems: "center", flexWrap: "wrap" }}>
                      <Typography sx={{ fontSize: 11.8, fontWeight: 950, color: "var(--mf-text)" }}>{item.taskNo}</Typography>
                      <Chip label={readable(item.taskType)} sx={statusSx} />
                      <Chip label={readable(item.status)} sx={{ ...statusSx, color: item.status === "HOLD" ? "var(--mf-warning-text)" : item.status === "DONE" ? "var(--mf-success-text)" : "var(--mf-text-secondary)" }} />
                      {item.blocking && <Chip label="Handoff blocking" sx={{ ...statusSx, color: "var(--mf-danger-text)" }} />}
                    </Box>
                    <Typography sx={{ mt: 0.55, fontSize: 12.5, fontWeight: 900, color: "var(--mf-text)" }}>{item.title}</Typography>
                    {item.description && <Typography sx={{ mt: 0.25, fontSize: 10, color: "var(--mf-text-muted)" }}>{item.description}</Typography>}
                  </Box>
                  {canHead && active && <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => onEdit(item)} sx={secondaryBtnSx}>Edit</Button>}
                </Box>

                <Box sx={{ mt: 1, display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" }, gap: 0.7 }}>
                  <Mini label="Designer-1" value={item.designer1 || "—"} />
                  <Mini label="Assigned by" value={item.assignedBy || "—"} />
                  <Mini label="Received" value={toDateTime(item.receivedAt)} />
                  <Mini label="Due" value={toDateTime(item.dueAt)} />
                </Box>

                <Box sx={{ mt: 0.8, display: "flex", gap: 0.5, alignItems: "center", flexWrap: "wrap" }}>
                  <Typography sx={{ fontSize: 9.5, fontWeight: 850, color: "var(--mf-text-muted)" }}>Designer-2 / team:</Typography>
                  {(item.assignees || []).map((assignee) => <Chip key={assignee} label={assignee} sx={statusSx} />)}
                </Box>

                {item.holdReason && <Alert severity="warning" sx={{ mt: 0.8 }}>Hold: {item.holdReason}</Alert>}
                {item.remarks && <Typography sx={{ mt: 0.6, fontSize: 9.8, color: "var(--mf-text-muted)" }}>Remarks: {item.remarks}</Typography>}

                {canWork && active && (
                  <Box sx={{ mt: 0.9, display: "flex", gap: 0.55, flexWrap: "wrap" }}>
                    {["NEED_TO_START", "ASSIGNED"].includes(item.status) && <Button size="small" onClick={() => onStatus(item, "WORKING")} sx={primaryBtnSx}>Start</Button>}
                    {item.status === "WORKING" && <Button size="small" onClick={() => onStatus(item, "HOLD")} sx={secondaryBtnSx}>Hold</Button>}
                    {item.status === "HOLD" && <Button size="small" onClick={() => onStatus(item, "WORKING")} sx={primaryBtnSx}>Resume</Button>}
                    {["WORKING", "HOLD", "ASSIGNED"].includes(item.status) && <Button size="small" onClick={() => onStatus(item, "DONE")} sx={primaryBtnSx}>Mark Done</Button>}
                    {canHead && <Button size="small" onClick={() => onStatus(item, "CANCELLED")} sx={secondaryBtnSx}>Cancel</Button>}
                  </Box>
                )}
              </Card>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

function Mini({ label, value }) {
  return <Box sx={{ p: 0.8, border: "1px solid var(--mf-border)", borderRadius: 1.2, background: "var(--mf-surface)" }}><Typography sx={{ fontSize: 8.8, color: "var(--mf-text-muted)", fontWeight: 850 }}>{label}</Typography><Typography sx={{ mt: 0.2, fontSize: 10.3, color: "var(--mf-text-secondary)", fontWeight: 800 }}>{value}</Typography></Box>;
}

function Queries({ items, canCreate, canRespond, canClose, setAction }) {
  return <Box><Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}><Typography sx={{ fontWeight: 950, color: "var(--mf-text)" }}>Design ↔ Engineering Queries / Issues</Typography>{canCreate && <Button startIcon={<AddOutlinedIcon />} sx={secondaryBtnSx} onClick={() => setAction({ ...EMPTY_ACTION, kind: "QUERY_CREATE", title: "Raise Query / Issue to Design" })}>New Query / Issue</Button>}</Box>{items.length === 0 ? <Box sx={{ p: 3, textAlign: "center", color: "var(--mf-text-muted)" }}>No shared queries or issues.</Box> : items.map((item) => <Card key={item.id} sx={{ ...panelSx, p: 1.3, mb: 0.8 }}><Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}><Box><Typography sx={{ fontSize: 12, fontWeight: 950, color: "var(--mf-text)" }}>{item.title}</Typography><Typography sx={{ mt: 0.25, fontSize: 10, color: "var(--mf-text-muted)" }}>{item.description}</Typography></Box><Chip label={item.status} sx={statusSx} /></Box><Box sx={{ mt: 0.8, display: "flex", flexWrap: "wrap", gap: 1, fontSize: 10, color: "var(--mf-text-muted)" }}><span>Assigned: {item.assignedTo || "—"}</span><span>Due: {toDateTime(item.dueAt)}</span><span>Priority: {item.priority}</span></Box>{item.responseText && <Alert severity="info" sx={{ mt: 0.8 }}>Response: {item.responseText}</Alert>}<Box sx={{ mt: 0.8, display: "flex", gap: 0.6 }}>{canRespond && item.status !== "CLOSED" && <Button size="small" sx={secondaryBtnSx} onClick={() => setAction({ ...EMPTY_ACTION, kind: "QUERY_RESPOND", title: "Respond to Query", item })}>Respond</Button>}{canClose && item.status !== "CLOSED" && <Button size="small" sx={secondaryBtnSx} onClick={() => setAction({ ...EMPTY_ACTION, kind: "QUERY_CLOSE", title: "Close Query", item })}>Close</Button>}</Box></Card>)}</Box>;
}

function Tasks({ items, canManage, canWork, setAction }) {
  return <Box><Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}><Typography sx={{ fontWeight: 950, color: "var(--mf-text)" }}>Engineering Documentation Tasks</Typography>{canManage && <Button startIcon={<AddOutlinedIcon />} sx={secondaryBtnSx} onClick={() => setAction({ ...EMPTY_ACTION, kind: "TASK_CREATE", title: "Add Engineering Task" })}>Add Task</Button>}</Box><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 0.8 }}>{items.map((item) => <Card key={item.id} sx={{ ...panelSx, p: 1.2 }}><Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}><Box><Typography sx={{ fontSize: 11.5, fontWeight: 950, color: "var(--mf-text)" }}>{item.title}</Typography><Typography sx={{ fontSize: 9.5, color: "var(--mf-text-muted)" }}>{item.key} · {item.blocking ? "Release blocking" : "Non-blocking"}</Typography></Box><Chip label={readable(item.status)} sx={statusSx} /></Box><Typography sx={{ mt: 0.7, fontSize: 10, color: "var(--mf-text-muted)" }}>Owner: {item.assignedTo || "Unassigned"} · Due: {toDateTime(item.dueAt)}</Typography><Typography sx={{ mt: 0.25, fontSize: 9.5, color: "var(--mf-text-muted)" }}>Started: {toDateTime(item.startedAt)} · Revision: {item.revisionContext || "—"} · Completed: {toDateTime(item.completedAt)}</Typography>{canWork && !["COMPLETE", "NOT_APPLICABLE", "CANCELLED"].includes(item.status) && <Box sx={{ mt: 0.8, display: "flex", gap: 0.5, flexWrap: "wrap" }}>{["IN_PROGRESS", "BLOCKED", "COMPLETE", "NOT_APPLICABLE"].map((status) => <Button key={status} size="small" sx={secondaryBtnSx} onClick={() => setAction({ ...EMPTY_ACTION, kind: "TASK_STATUS", title: `Set ${item.title}: ${readable(status)}`, decision: status, item })}>{readable(status)}</Button>)}</Box>}</Card>)}</Box></Box>;
}

function Revisions({ file, rows, canUploadDesign, canUploadEngineering, revisionType, setRevisionType, revisionNo, setRevisionNo, summary, setSummary, setFile, upload, openRevision, canReview, setAction, working }) {
  const canUpload = canUploadDesign || canUploadEngineering;
  return <Box><Typography sx={{ fontWeight: 950, color: "var(--mf-text)" }}>Immutable Drawing Revisions</Typography><Typography sx={{ mt: 0.2, fontSize: 10.5, color: "var(--mf-text-muted)" }}>Drawing revisions stay attached to this Product / PD Production File. Previous revisions remain available for traceability.</Typography>{canUpload && <Card sx={{ ...panelSx, p: 1.2, mt: 1.1 }}><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "180px 130px 1fr auto auto" }, gap: 0.8, alignItems: "center" }}><TextField select size="small" label="Type" value={revisionType} onChange={(e) => setRevisionType(e.target.value)} sx={fieldSx}>{canUploadDesign && <MenuItem value="DESIGN_DRAWING">Design Drawing</MenuItem>}{canUploadEngineering && <MenuItem value="ENGINEERING_DRAWING">Production / Engineering Drawing</MenuItem>}</TextField><TextField size="small" label="Revision" value={revisionNo} onChange={(e) => setRevisionNo(e.target.value)} sx={fieldSx} /><TextField size="small" label="Change summary" value={summary} onChange={(e) => setSummary(e.target.value)} sx={fieldSx} /><Button component="label" startIcon={<UploadFileOutlinedIcon />} sx={secondaryBtnSx}>Choose<input hidden type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></Button><Button disabled={working} onClick={upload} sx={primaryBtnSx}>Upload</Button></Box></Card>}<Box sx={{ mt: 1 }}>{rows.length === 0 ? <Box sx={{ p: 3, textAlign: "center", color: "var(--mf-text-muted)" }}>No revisions uploaded.</Box> : rows.map((row) => <Box key={row.id} sx={{ p: 1.1, display: "grid", gridTemplateColumns: { xs: "1fr", md: "120px 100px 1fr 160px auto" }, gap: 1, alignItems: "center", borderBottom: "1px solid var(--mf-border)" }}><Typography sx={{ fontSize: 11, fontWeight: 900, color: "var(--mf-text)" }}>{readable(row.type)}</Typography><Typography sx={{ fontSize: 11, fontWeight: 950, color: "var(--mf-text)" }}>Rev {row.revisionNo}</Typography><Typography sx={{ fontSize: 10, color: "var(--mf-text-muted)" }}>{row.changeSummary || row.originalFileName}</Typography><Chip label={readable(row.status)} sx={statusSx} /><Box sx={{ display: "flex", gap: 0.5 }}><Button size="small" startIcon={<LaunchOutlinedIcon />} onClick={() => openRevision(row)} sx={secondaryBtnSx}>Open</Button>{canReview && row.status === "PENDING_IMPACT_REVIEW" && <Button size="small" onClick={() => setAction({ ...EMPTY_ACTION, kind: "REVISION_IMPACT", title: `Revision Impact — ${row.revisionNo}`, revision: row, decision: "ACCEPT" })} sx={primaryBtnSx}>Review</Button>}</Box></Box>)}</Box>{file.downstreamWorkflowStatus === "RELEASE_INVALIDATED_BY_REVISION" && <Alert severity="error" sx={{ mt: 1 }}>The previous Production Release is invalidated by an accepted revision. Engineering and PPC Gate 2 must run again.</Alert>}</Box>;
}

function Timeline({ rows }) {
  return <Box>{rows.length === 0 ? <Box sx={{ p: 3, textAlign: "center", color: "var(--mf-text-muted)" }}>No audit events yet.</Box> : rows.map((row, index) => <Box key={`${row.entityId}-${index}`} sx={{ display: "grid", gridTemplateColumns: "150px 170px 1fr", gap: 1, p: 1, borderBottom: "1px solid var(--mf-border)" }}><Typography sx={{ fontSize: 10, color: "var(--mf-text-muted)" }}>{toDateTime(row.at)}</Typography><Typography sx={{ fontSize: 10.5, fontWeight: 900, color: "var(--mf-text)" }}>{readable(row.action)}</Typography><Typography sx={{ fontSize: 10, color: "var(--mf-text-secondary)" }}>{row.actor}</Typography></Box>)}</Box>;
}

function DesignTaskDialog({ value, setValue, working, onSave }) {
  const open = Boolean(value);
  if (!value) return null;
  return <Dialog open={open} onClose={() => !working && setValue(null)} fullWidth maxWidth="md" PaperProps={{ sx: dialogPaperSx }}><DialogTitle sx={dialogTitleSx}>{value.mode === "edit" ? "Edit Design Task" : "Delegate Design Task"}</DialogTitle><DialogContent sx={dialogContentSx}><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.1, mt: 0.5 }}><TextField select label="Task Type" value={value.taskType} onChange={(e) => setValue((row) => ({ ...row, taskType: e.target.value }))} sx={fieldSx}>{DESIGN_TASK_TYPES.map((type) => <MenuItem key={type} value={type}>{readable(type)}</MenuItem>)}</TextField><TextField select label="Priority" value={value.priority} onChange={(e) => setValue((row) => ({ ...row, priority: e.target.value }))} sx={fieldSx}><MenuItem value="LOW">Low</MenuItem><MenuItem value="NORMAL">Normal</MenuItem><MenuItem value="HIGH">High</MenuItem><MenuItem value="URGENT">Urgent</MenuItem></TextField><TextField label="Task Title *" value={value.title} onChange={(e) => setValue((row) => ({ ...row, title: e.target.value }))} sx={{ ...fieldSx, gridColumn: { md: "1 / -1" } }} /><TextField label="Description / exact drawing work" multiline minRows={3} value={value.description} onChange={(e) => setValue((row) => ({ ...row, description: e.target.value }))} sx={{ ...fieldSx, gridColumn: { md: "1 / -1" } }} /><TextField label="Junior Designer / Design team assignees *" multiline minRows={2} helperText="Comma separated. One task may be shared by multiple members." value={value.assigneesText} onChange={(e) => setValue((row) => ({ ...row, assigneesText: e.target.value }))} sx={{ ...fieldSx, gridColumn: { md: "1 / -1" } }} /><TextField type="datetime-local" label="Received Date / Time" InputLabelProps={{ shrink: true }} value={value.receivedAt} onChange={(e) => setValue((row) => ({ ...row, receivedAt: e.target.value }))} sx={fieldSx} /><TextField type="datetime-local" label="Due Date / Time" InputLabelProps={{ shrink: true }} value={value.dueAt} onChange={(e) => setValue((row) => ({ ...row, dueAt: e.target.value }))} sx={fieldSx} /><TextField select label="Blocks Design Handoff?" value={value.blocking} onChange={(e) => setValue((row) => ({ ...row, blocking: e.target.value }))} sx={fieldSx}><MenuItem value="true">Yes</MenuItem><MenuItem value="false">No</MenuItem></TextField><TextField label="Remarks" value={value.remarks} onChange={(e) => setValue((row) => ({ ...row, remarks: e.target.value }))} sx={fieldSx} /></Box></DialogContent><DialogActions sx={dialogActionsSx}><Button onClick={() => setValue(null)} sx={secondaryBtnSx}>Cancel</Button><Button disabled={working} onClick={onSave} sx={primaryBtnSx}>{value.mode === "edit" ? "Save Task" : "Delegate Task"}</Button></DialogActions></Dialog>;
}

function DesignTaskStatusDialog({ value, setValue, working, onSave }) {
  if (!value) return null;
  return <Dialog open fullWidth maxWidth="sm" onClose={() => !working && setValue(null)} PaperProps={{ sx: dialogPaperSx }}><DialogTitle sx={dialogTitleSx}>{readable(value.status)} · {value.item.title}</DialogTitle><DialogContent sx={dialogContentSx}><TextField autoFocus fullWidth label={value.status === "HOLD" ? "Hold reason *" : "Cancellation reason *"} multiline minRows={3} value={value.note} onChange={(e) => setValue((row) => ({ ...row, note: e.target.value }))} sx={{ ...fieldSx, mt: 0.8 }} /></DialogContent><DialogActions sx={dialogActionsSx}><Button onClick={() => setValue(null)} sx={secondaryBtnSx}>Cancel</Button><Button disabled={working || !String(value.note || "").trim()} onClick={onSave} sx={primaryBtnSx}>Confirm</Button></DialogActions></Dialog>;
}

function ActionDialog({ action, setAction, working, submit }) {
  const open = Boolean(action.kind);
  const close = () => !working && setAction(EMPTY_ACTION);
  const needsDecision = ["DESIGN_HEAD_REVIEW", "PPC1", "ENG_DECISION", "TASK_STATUS", "REVISION_IMPACT", "PPC2"].includes(action.kind);
  return <Dialog open={open} onClose={close} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}><DialogTitle sx={dialogTitleSx}>{action.title || "MatFlow Action"}</DialogTitle><DialogContent sx={dialogContentSx}><Box sx={{ display: "grid", gap: 1.1, mt: 0.5 }}>{action.kind === "DESIGN_HEAD_REVIEW" && <TextField label={action.decision === "RETURN" ? "Return reason *" : "Design Head review remarks"} multiline minRows={3} value={action.remarks} onChange={(e) => setAction((value) => ({ ...value, remarks: e.target.value }))} sx={fieldSx} />}{action.kind === "DESIGN_SUBMIT" && <TextField label="Controlled Release reason (mandatory when the checklist requires attention)" multiline minRows={3} value={action.controlledReleaseReason} onChange={(e) => setAction((value) => ({ ...value, controlledReleaseReason: e.target.value }))} sx={fieldSx} />}{action.kind === "PPC1" && action.decision === "ACCEPT" && <TextField label="Assign Engineer / username" value={action.assignedTo} onChange={(e) => setAction((value) => ({ ...value, assignedTo: e.target.value }))} sx={fieldSx} />}{["PPC1", "ENG_DECISION", "PPC2"].includes(action.kind) && <TextField label="Remarks" multiline minRows={3} value={action.remarks} onChange={(e) => setAction((value) => ({ ...value, remarks: e.target.value }))} sx={fieldSx} />}{action.kind === "QUERY_CREATE" && <><TextField label="Query title" value={action.queryTitle} onChange={(e) => setAction((value) => ({ ...value, queryTitle: e.target.value }))} sx={fieldSx} /><TextField label="Detail" multiline minRows={3} value={action.description} onChange={(e) => setAction((value) => ({ ...value, description: e.target.value }))} sx={fieldSx} /><TextField label="Assigned to / Designer username" value={action.assignedTo} onChange={(e) => setAction((value) => ({ ...value, assignedTo: e.target.value }))} sx={fieldSx} /><TextField type="datetime-local" label="Due" InputLabelProps={{ shrink: true }} value={action.dueAt} onChange={(e) => setAction((value) => ({ ...value, dueAt: e.target.value }))} sx={fieldSx} /></>}{action.kind === "QUERY_RESPOND" && <TextField label="Response" multiline minRows={4} value={action.response} onChange={(e) => setAction((value) => ({ ...value, response: e.target.value }))} sx={fieldSx} />}{action.kind === "QUERY_CLOSE" && <TextField label="Closure note" multiline minRows={3} value={action.note} onChange={(e) => setAction((value) => ({ ...value, note: e.target.value }))} sx={fieldSx} />}{action.kind === "TASK_CREATE" && <><TextField label="Task key" value={action.taskKey} onChange={(e) => setAction((value) => ({ ...value, taskKey: e.target.value }))} sx={fieldSx} /><TextField label="Task title" value={action.queryTitle} onChange={(e) => setAction((value) => ({ ...value, queryTitle: e.target.value }))} sx={fieldSx} /><TextField label="Assigned to" value={action.assignedTo} onChange={(e) => setAction((value) => ({ ...value, assignedTo: e.target.value }))} sx={fieldSx} /><TextField label="Description" multiline minRows={2} value={action.description} onChange={(e) => setAction((value) => ({ ...value, description: e.target.value }))} sx={fieldSx} /></>}{action.kind === "TASK_STATUS" && <TextField label="Note / reason" multiline minRows={2} value={action.note} onChange={(e) => setAction((value) => ({ ...value, note: e.target.value }))} sx={fieldSx} />}{action.kind === "REVISION_IMPACT" && <><TextField select label="Decision" value={action.decision} onChange={(e) => setAction((value) => ({ ...value, decision: e.target.value }))} sx={fieldSx}><MenuItem value="ACCEPT">Accept and revalidate</MenuItem><MenuItem value="REJECT">Reject revision</MenuItem></TextField><TextField label="Impact assessment / note" multiline minRows={4} value={action.note} onChange={(e) => setAction((value) => ({ ...value, note: e.target.value }))} sx={fieldSx} /></>}{needsDecision && action.kind !== "REVISION_IMPACT" && <Typography sx={{ fontSize: 10.5, color: "var(--mf-text-muted)" }}>Decision: <b>{readable(action.decision)}</b></Typography>}</Box></DialogContent><DialogActions sx={dialogActionsSx}><Button onClick={close} sx={secondaryBtnSx}>Cancel</Button><Button disabled={working || (action.kind === "DESIGN_HEAD_REVIEW" && action.decision === "RETURN" && !String(action.remarks || "").trim())} onClick={submit} sx={primaryBtnSx}>Confirm</Button></DialogActions></Dialog>;
}
