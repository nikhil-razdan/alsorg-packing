import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  InputAdornment,
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
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
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

const auditDetails = (event) => {
  if (!event?.detailsJson) return {};
  if (typeof event.detailsJson === "object") return event.detailsJson;
  try { return JSON.parse(event.detailsJson); } catch { return {}; }
};

const issueStatusLabel = (status) => {
  const value = String(status || "").toUpperCase();
  if (value === "CLOSED") return "Resolved";
  if (value === "RESPONDED") return "In discussion";
  return "Open";
};

const issueAccent = (item) => {
  const closed = String(item?.status || "").toUpperCase() === "CLOSED";
  if (closed) return "var(--mf-success-text)";
  const due = item?.dueAt ? new Date(item.dueAt) : null;
  if (due && !Number.isNaN(due.getTime()) && due < new Date()) return "var(--mf-danger-text)";
  if (["URGENT", "HIGH"].includes(String(item?.priority || "").toUpperCase())) return "var(--mf-warning-text)";
  return "var(--mf-primary)";
};

const issueMessages = (item, timeline = []) => {
  if (!item) return [];
  const id = String(item.id || "");
  const events = (Array.isArray(timeline) ? timeline : [])
    .filter((event) => String(event?.entityId || "") === id);
  const raised = events.find((event) => ["SHARED_QUERY_RAISED", "ENGINEERING_QUERY_RAISED"].includes(String(event?.action || "").toUpperCase()));
  const raisedDetails = auditDetails(raised);
  const messages = [{
    id: `raised-${id}`,
    kind: "message",
    actor: raised?.actor || raisedDetails.raisedBy || "Issue raised",
    department: raisedDetails.fromDepartment || "",
    at: raised?.at || null,
    text: item.description || raisedDetails.message || raisedDetails.description || item.title || "Issue raised",
  }];

  const responseEvents = events.filter((event) => [
    "SHARED_QUERY_MESSAGE",
    "SHARED_QUERY_RESPONDED",
    "ENGINEERING_QUERY_RESPONDED",
  ].includes(String(event?.action || "").toUpperCase()));

  responseEvents.forEach((event, index) => {
    const details = auditDetails(event);
    const text = details.message || details.response;
    if (!String(text || "").trim()) return;
    messages.push({
      id: `message-${id}-${index}-${event?.at || ""}`,
      kind: "message",
      actor: event?.actor || details.sentBy || details.respondedBy || "User",
      department: details.fromDepartment || "",
      at: event?.at || null,
      text,
    });
  });

  if (!responseEvents.length && String(item.responseText || "").trim()) {
    messages.push({
      id: `legacy-response-${id}`,
      kind: "message",
      actor: item.respondedBy || "Response",
      department: "",
      at: item.respondedAt || item.updatedAt || null,
      text: item.responseText,
    });
  }

  const closed = [...events].reverse().find((event) =>
    ["SHARED_QUERY_CLOSED", "ENGINEERING_QUERY_CLOSED"].includes(String(event?.action || "").toUpperCase())
  );
  if (closed) {
    const details = auditDetails(closed);
    messages.push({
      id: `closed-${id}`,
      kind: "system",
      actor: closed.actor || item.closedBy || "",
      at: closed.at || item.closedAt || null,
      text: details.note ? `Resolved · ${details.note}` : "Issue resolved",
    });
  }

  return messages;
};

const HEALTH_FILTERS = [
  { value: "RED", label: "Critical attention" },
  { value: "AMBER", label: "Needs attention" },
  { value: "GREEN", label: "On track" },
];

const STAGES_BY_FOCUS = Object.freeze({
  DESIGN: ["DESIGN_DRAFT", "DESIGN_CLARIFICATION", "DESIGN_SUBMITTED", "PPC_GATE_1"],
  ENGINEERING: ["ENGINEERING_REVIEW", "ENGINEERING_QUERY", "ENGINEERING_WORK", "REVISION_REVIEW", "PPC_GATE_2"],
  PPC: ["PPC_GATE_1", "ENGINEERING_QUERY", "PPC_GATE_2", "PRODUCTION_RELEASED"],
  MANAGEMENT: ["DESIGN_DRAFT", "DESIGN_CLARIFICATION", "DESIGN_SUBMITTED", "PPC_GATE_1", "ENGINEERING_REVIEW", "ENGINEERING_QUERY", "ENGINEERING_WORK", "REVISION_REVIEW", "PPC_GATE_2", "PRODUCTION_RELEASED"],
});

const TABS_BY_FOCUS = Object.freeze({
  DESIGN: [
    ["overview", "Overview"],
    ["designChecklist", "Checklist"],
    ["designTasks", "Tasks"],
    ["drawings", "References"],
    ["queries", "Queries / Issues"],
    ["timeline", "Timeline"],
  ],
  ENGINEERING: [
    ["overview", "Overview"],
    ["engineeringChecklist", "Checklist"],
    ["engineeringTasks", "Tasks"],
    ["drawings", "References"],
    ["queries", "Queries / Issues"],
    ["timeline", "Timeline"],
  ],
  PPC: [
    ["overview", "Overview"],
    ["queries", "Issues"],
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
  if (focus === "PPC") return ["PPC_GATE_1", "PPC_GATE_2", "PRODUCTION_RELEASED"].includes(stage) || (stage === "ENGINEERING_QUERY" && Number(row?.openQueries || 0) > 0);
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

const HEALTH_RANK = Object.freeze({ RED: 3, AMBER: 2, GREEN: 1 });

const compactDate = (value) => {
  if (!value) return "—";
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(parsed);
};

const fileAttention = (row, focus) => {
  const health = String(row?.releaseHealth || "").toUpperCase();
  if (["RED", "AMBER"].includes(health)) return true;
  if (focus === "DESIGN") {
    return Number(row?.openQueries || 0) > 0
      || Number(row?.designTaskProgress?.overdue || 0) > 0
      || Number(row?.designTaskProgress?.hold || 0) > 0;
  }
  if (focus === "ENGINEERING") {
    return Number(row?.openQueries || 0) > 0
      || Number(row?.engineeringTaskPending || 0) > 0
      || Boolean(row?.revisionReviewRequired);
  }
  if (focus === "PPC") {
    return Number(row?.openQueries || 0) > 0
      || ["PPC_GATE_1", "PPC_GATE_2"].includes(String(row?.stage || "").toUpperCase());
  }
  return Number(row?.openQueries || 0) > 0;
};

const worstHealth = (rows) => {
  const values = (Array.isArray(rows) ? rows : []).map((row) => String(row?.releaseHealth || "").toUpperCase());
  if (values.includes("RED")) return "RED";
  if (values.includes("AMBER")) return "AMBER";
  if (values.includes("GREEN")) return "GREEN";
  return "";
};

const buildWorkQueueGroups = (rows, groupBy, focus) => {
  const groups = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const clientName = clean(row?.clientName) || "Client not assigned";
    const projectCode = clean(row?.projectCode) || "PD not assigned";
    const projectName = clean(row?.projectName) || "";
    const key = groupBy === "CLIENT"
      ? `CLIENT:${clientName.toUpperCase()}`
      : `PD:${clientName.toUpperCase()}::${projectCode.toUpperCase()}`;
    if (!groups.has(key)) {
      groups.set(key, { key, clientName, projectCode, projectName, rows: [] });
    }
    groups.get(key).rows.push(row);
  });

  return Array.from(groups.values()).map((group) => {
    const orderedRows = group.rows.slice().sort((left, right) => {
      const healthDiff = (HEALTH_RANK[String(right?.releaseHealth || "").toUpperCase()] || 0)
        - (HEALTH_RANK[String(left?.releaseHealth || "").toUpperCase()] || 0);
      if (healthDiff) return healthDiff;
      const leftDue = String(left?.plannedProductionReleaseDate || left?.plannedDispatchDate || "9999-12-31");
      const rightDue = String(right?.plannedProductionReleaseDate || right?.plannedDispatchDate || "9999-12-31");
      if (leftDue !== rightDue) return leftDue.localeCompare(rightDue);
      return String(left?.productName || "").localeCompare(String(right?.productName || ""));
    });
    const dueDates = orderedRows
      .map((row) => row?.plannedProductionReleaseDate || row?.plannedDispatchDate)
      .filter(Boolean)
      .sort();
    return {
      ...group,
      rows: orderedRows,
      health: worstHealth(orderedRows),
      attentionCount: orderedRows.filter((row) => fileAttention(row, focus)).length,
      fileCount: orderedRows.length,
      pdCount: new Set(orderedRows.map((row) => clean(row?.projectCode)).filter(Boolean)).size,
      dueDate: dueDates[0] || null,
    };
  }).sort((left, right) => {
    const healthDiff = (HEALTH_RANK[right.health] || 0) - (HEALTH_RANK[left.health] || 0);
    if (healthDiff) return healthDiff;
    if (right.attentionCount !== left.attentionCount) return right.attentionCount - left.attentionCount;
    const leftDue = left.dueDate || "9999-12-31";
    const rightDue = right.dueDate || "9999-12-31";
    if (leftDue !== rightDue) return leftDue.localeCompare(rightDue);
    const leftName = groupBy === "CLIENT" ? left.clientName : left.projectCode;
    const rightName = groupBy === "CLIENT" ? right.clientName : right.projectCode;
    return String(leftName || "").localeCompare(String(rightName || ""));
  });
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
  selfTask: false,
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
  const { user } = useAuth();
  const currentUsername = clean(user?.username || user?.email || "");
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
  const juniorEngineerOnly = hasRole(MATFLOW_ROLES.ENGINEERING_JUNIOR)
    && !hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.ENGINEERING_HEAD, MATFLOW_ROLES.ENGINEERING);
  const canCreateEngineeringTask = canEngineeringReview || juniorEngineerOnly;
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
  const [tab, setTab] = useState(searchParams.get("tab") || "overview");
  const [selectedQueryId, setSelectedQueryId] = useState(searchParams.get("queryId") || "");
  const [workspaceView, setWorkspaceView] = useState("FILES");
  const [workspaceFocus, setWorkspaceFocus] = useState(resolvedInitialFocus);
  const [groupBy, setGroupBy] = useState("PD");
  const [expandedGroupKey, setExpandedGroupKey] = useState("");
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

  /*
   * Keep deep links live even when the user is already inside MatFlow Work and a
   * notification/report link changes only the URL query string. React Router may
   * reuse this mounted workspace instead of remounting it.
   */
  useEffect(() => {
    const urlFileId = searchParams.get("fileId") || "";
    const urlTab = searchParams.get("tab") || "overview";
    const urlQueryId = searchParams.get("queryId") || "";
    const urlSearch = searchParams.get("q") || "";
    if (urlFileId && urlFileId !== selectedId) setSelectedId(urlFileId);
    if (urlTab !== tab) setTab(urlTab);
    if (urlQueryId !== selectedQueryId) setSelectedQueryId(urlQueryId);
    if (urlSearch && urlSearch !== search) setSearch(urlSearch);
  }, [searchParams]);

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

  const queueGroups = useMemo(
    () => buildWorkQueueGroups(files, groupBy, workspaceFocus),
    [files, groupBy, workspaceFocus]
  );

  const queueSummary = useMemo(() => ({
    clients: new Set(files.map((row) => clean(row?.clientName)).filter(Boolean)).size,
    pds: new Set(files.map((row) => clean(row?.projectCode)).filter(Boolean)).size,
    products: files.length,
    attention: files.filter((row) => fileAttention(row, workspaceFocus)).length,
  }), [files, workspaceFocus]);

  useEffect(() => {
    if (!selectedId) return;
    const ownerGroup = queueGroups.find((group) => group.rows.some((row) => row.id === selectedId));
    if (ownerGroup) setExpandedGroupKey(ownerGroup.key);
  }, [selectedId, queueGroups]);

  useEffect(() => {
    if (!expandedGroupKey) return;
    if (!queueGroups.some((group) => group.key === expandedGroupKey)) setExpandedGroupKey("");
  }, [queueGroups, expandedGroupKey]);

  useEffect(() => {
    loadList();
  }, [selectedPlantParam, health, stage, workspaceFocus]);

  useEffect(() => {
    if (!selectedId) return;
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("fileId", selectedId);
      if (tab && tab !== "overview") next.set("tab", tab);
      else next.delete("tab");
      if (selectedQueryId) next.set("queryId", selectedQueryId);
      else next.delete("queryId");
      return next;
    }, { replace: true });
    loadDetail(selectedId);
  }, [selectedId, loadDetail, setSearchParams]);

  // Lightweight foreground refresh keeps Issue Chat current without turning MatFlow
  // into a noisy real-time surface or requiring a second messaging infrastructure.
  useEffect(() => {
    if (!selectedId || tab !== "queries") return undefined;
    const refreshConversation = () => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        loadDetail(selectedId, { quiet: true });
      }
    };
    const timer = window.setInterval(refreshConversation, 7000);
    window.addEventListener("focus", refreshConversation);
    document.addEventListener("visibilitychange", refreshConversation);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshConversation);
      document.removeEventListener("visibilitychange", refreshConversation);
    };
  }, [selectedId, tab, loadDetail]);

  const selectWorkspaceTab = (value) => {
    setTab(value);
    if (value !== "queries") setSelectedQueryId("");
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (selectedId) next.set("fileId", selectedId);
      if (value && value !== "overview") next.set("tab", value);
      else next.delete("tab");
      if (value !== "queries") next.delete("queryId");
      return next;
    }, { replace: true });
  };

  const selectIssueThread = (queryId) => {
    const nextId = String(queryId || "");
    setSelectedQueryId(nextId);
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (selectedId) next.set("fileId", selectedId);
      next.set("tab", "queries");
      if (nextId) next.set("queryId", nextId);
      else next.delete("queryId");
      return next;
    }, { replace: true });
  };

  const refresh = async () => {
    await loadList({ quiet: true });
    await loadDetail(selectedId, { quiet: true });
  };

  const file = detail?.productionFile;

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

  const sendQueryMessage = (item, message) => {
    const text = clean(message);
    if (!file || !item || !text) return Promise.resolve(false);
    return execute(
      () => matflowApi.respondQuery(file.id, item.id, { response: text, rowVersion: item.rowVersion }),
      "Unable to send issue-chat message."
    );
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
    if (a.kind === "QUERY_CREATE") {
      if (!clean(a.queryTitle)) { setError("Issue title is required."); return; }
      return execute(
        () => matflowApi.createQuery(file.id, { title: a.queryTitle, description: a.description, assignedTo: clean(a.assignedTo) || null, dueAt: a.dueAt || null, priority: a.priority }),
        "Unable to start issue chat."
      );
    }
    if (a.kind === "QUERY_CLOSE")
      return execute(
        () => matflowApi.closeQuery(file.id, a.item.id, { note: a.note, rowVersion: a.item.rowVersion }),
        "Unable to close query."
      );
    if (a.kind === "TASK_CREATE")
      return execute(
        () => matflowApi.createEngineeringTask(file.id, {
          taskKey: clean(a.taskKey) || `AUTO-${Date.now()}`,
          title: a.queryTitle,
          assignedTo: a.selfTask ? null : (clean(a.assignedTo) || null),
          dueAt: a.dueAt || null,
          priority: a.priority,
          blocking: a.selfTask ? false : a.blocking,
          description: clean(a.description) || null,
        }),
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
    if (!revisionFile || !revisionNo) return setError("Choose a file and revision number only when you want to add an optional reference.");
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
            ? "Start with Client / PD, then open the Product that needs Design action."
            : workspaceFocus === "ENGINEERING"
              ? "Start with Client / PD, then open the Product that needs Engineering action."
              : workspaceFocus === "PPC"
                ? "Review Client / PD queues first, then open the Product for the required gate decision."
                : "Client / PD-first work queue with one controlled Production File per Product / Drawing."
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
        <DesignTaskDesk selectedPlantParam={selectedPlantParam} onOpenFile={(fileId) => { setSelectedQueryId(""); setSelectedId(fileId); setWorkspaceView("FILES"); setWorkspaceFocus("DESIGN"); setTab("designTasks"); }} />
      ) : (
      <>
      <Card sx={{ ...panelSx, p: 1.2 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(260px,2fr) 135px 165px minmax(180px,1fr) auto" }, gap: 0.8 }}>
          <TextField
            size="small"
            label="Search PD No. / Client / Project / Product / Drawing"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadList()}
            sx={fieldSx}
          />
          <TextField select size="small" label="View by" value={groupBy} onChange={(e) => { setGroupBy(e.target.value); setExpandedGroupKey(""); }} sx={fieldSx}>
            <MenuItem value="PD">PD No.</MenuItem>
            <MenuItem value="CLIENT">Client</MenuItem>
          </TextField>
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

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "430px minmax(0,1fr)" }, gap: 1.2, alignItems: "start" }}>
        <Card sx={{ ...panelSx, p: 0, maxHeight: { xl: "calc(100vh - 210px)" }, overflow: "auto" }}>
          <Box sx={{ px: 1.25, py: 1.05, borderBottom: "1px solid var(--mf-border)", display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center" }}>
            <Box>
              <Typography sx={{ fontSize: 11.5, fontWeight: 900, color: "var(--mf-text)" }}>
                {groupBy === "PD" ? "PD Work Queue" : "Client Work Queue"}
              </Typography>
              <Typography sx={{ mt: 0.1, fontSize: 9.3, color: "var(--mf-text-muted)" }}>
                {queueGroups.length} group{queueGroups.length === 1 ? "" : "s"} · attention first
              </Typography>
            </Box>
            <Typography sx={{ fontSize: 9.3, fontWeight: 800, color: "var(--mf-text-muted)" }}>
              {queueSummary.products} product{queueSummary.products === 1 ? "" : "s"}
            </Typography>
          </Box>

          {queueGroups.length === 0 ? (
            <Box sx={{ p: 3, color: "var(--mf-text-muted)", textAlign: "center" }}>No work matches the current filters.</Box>
          ) : queueGroups.map((group) => {
            const visual = healthVisual(group.health);
            const expanded = expandedGroupKey === group.key;
            return (
              <Box key={group.key} sx={{ borderBottom: "1px solid var(--mf-border)", "&:last-child": { borderBottom: 0 } }}>
                <Box
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedGroupKey(expanded ? "" : group.key)}
                  onKeyDown={(event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); setExpandedGroupKey(expanded ? "" : group.key); } }}
                  sx={{
                    position: "relative",
                    display: "grid",
                    gridTemplateColumns: "minmax(0,1fr) auto",
                    gap: 1,
                    px: 1.25,
                    py: 1.05,
                    pl: 1.55,
                    cursor: "pointer",
                    background: expanded ? "var(--mf-surface)" : "var(--mf-panel-solid)",
                    "&:hover": { background: "var(--mf-hover)" },
                    "&::before": { content: '""', position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: visual.accent },
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 9, fontWeight: 850, letterSpacing: ".045em", textTransform: "uppercase", color: "var(--mf-text-muted)" }}>
                      {groupBy === "PD" ? group.clientName : `${group.pdCount} PD${group.pdCount === 1 ? "" : "s"}`}
                    </Typography>
                    <Typography noWrap sx={{ mt: 0.15, fontSize: 13, fontWeight: 950, color: "var(--mf-text)" }}>
                      {groupBy === "PD" ? group.projectCode : group.clientName}
                    </Typography>
                    <Typography noWrap sx={{ mt: 0.12, fontSize: 9.6, color: "var(--mf-text-secondary)" }}>
                      {groupBy === "PD" ? (group.projectName || "Project") : `${group.fileCount} products across ${group.pdCount} PD${group.pdCount === 1 ? "" : "s"}`}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.65, textAlign: "right" }}>
                    <Box>
                      <Typography sx={{ fontSize: 9.2, fontWeight: 900, color: group.attentionCount ? visual.accent : "var(--mf-success-text)" }}>
                        {group.attentionCount ? `${group.attentionCount} need action` : "On track"}
                      </Typography>
                      <Typography sx={{ mt: 0.18, fontSize: 8.8, color: "var(--mf-text-muted)" }}>
                        {group.fileCount} product{group.fileCount === 1 ? "" : "s"} · due {compactDate(group.dueDate)}
                      </Typography>
                    </Box>
                    {expanded ? <ExpandMoreRoundedIcon sx={{ fontSize: 18, color: "var(--mf-text-muted)" }} /> : <ChevronRightRoundedIcon sx={{ fontSize: 18, color: "var(--mf-text-muted)" }} />}
                  </Box>
                </Box>

                {expanded && (
                  <Box sx={{ background: "var(--mf-panel-solid)" }}>
                    {group.rows.map((row) => {
                      const rowVisual = healthVisual(row.releaseHealth);
                      const selected = selectedId === row.id;
                      return (
                        <Box
                          key={row.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => { setSelectedQueryId(""); setSelectedId(row.id); }}
                          onKeyDown={(event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); setSelectedQueryId(""); setSelectedId(row.id); } }}
                          sx={{
                            display: "grid",
                            gridTemplateColumns: "9px minmax(0,1fr) auto",
                            gap: 0.75,
                            alignItems: "center",
                            px: 1.2,
                            py: 0.85,
                            borderTop: "1px solid var(--mf-border)",
                            cursor: "pointer",
                            background: selected ? "var(--mf-primary-soft)" : "transparent",
                            "&:hover": { background: selected ? "var(--mf-primary-soft)" : "var(--mf-hover)" },
                          }}
                        >
                          <Box sx={{ width: 7, height: 7, borderRadius: "50%", background: rowVisual.accent }} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography noWrap sx={{ fontSize: 10.8, fontWeight: selected ? 950 : 850, color: "var(--mf-text)" }}>
                              {row.productName || "Unnamed Product"}
                            </Typography>
                            <Typography noWrap sx={{ mt: 0.08, fontSize: 8.9, color: "var(--mf-text-muted)" }}>
                              {groupBy === "CLIENT" ? `${row.projectCode || "No PD"} · ` : ""}{row.drawingNo || "No drawing"} · {row.productionFileNo}
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: "right", minWidth: 90 }}>
                            <Typography sx={{ fontSize: 8.9, fontWeight: 850, color: rowVisual.accent }}>{readable(row.stage)}</Typography>
                            <Typography sx={{ mt: 0.08, fontSize: 8.5, color: "var(--mf-text-muted)" }}>{row.currentOwner || "Unassigned"}</Typography>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Box>
            );
          })}
        </Card>

        {!detail ? (
          <Card sx={{ ...panelSx, p: { xs: 2.2, md: 3 }, minHeight: 270 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 950, color: "var(--mf-text)" }}>Choose a Product from the work queue</Typography>
            <Typography sx={{ mt: 0.35, maxWidth: 650, fontSize: 10.5, lineHeight: 1.55, color: "var(--mf-text-muted)" }}>
              Work now starts from Client / PD context. Expand the relevant group, then open only the Product / Drawing you want to work on. Direct links from Projects, notifications and reports still open the exact Production File.
            </Typography>
            <Box sx={{ mt: 2, display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" }, gap: 0.75 }}>
              {[
                ["Clients", queueSummary.clients],
                ["PDs", queueSummary.pds],
                ["Products", queueSummary.products],
                ["Need action", queueSummary.attention],
              ].map(([label, value]) => (
                <Box key={label} sx={{ py: 1, borderTop: "1px solid var(--mf-border)" }}>
                  <Typography sx={{ fontSize: 17, fontWeight: 950, color: label === "Need action" && Number(value) ? "var(--mf-warning-text)" : "var(--mf-text)" }}>{value}</Typography>
                  <Typography sx={{ mt: 0.15, fontSize: 9.2, fontWeight: 800, color: "var(--mf-text-muted)" }}>{label}</Typography>
                </Box>
              ))}
            </Box>
            {queueGroups.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography sx={{ fontSize: 9.2, fontWeight: 900, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--mf-text-muted)" }}>Attention order</Typography>
                <Box sx={{ mt: 0.6, display: "grid", gap: 0.45 }}>
                  {queueGroups.slice(0, 4).map((group) => {
                    const visual = healthVisual(group.health);
                    return (
                      <Box key={group.key} sx={{ display: "flex", alignItems: "center", gap: 0.7, py: 0.45 }}>
                        <Box sx={{ width: 7, height: 7, borderRadius: "50%", background: visual.accent }} />
                        <Typography sx={{ minWidth: 0, flex: 1, fontSize: 10.2, fontWeight: 850, color: "var(--mf-text)" }}>
                          {groupBy === "PD" ? `${group.projectCode} · ${group.clientName}` : group.clientName}
                        </Typography>
                        <Typography sx={{ fontSize: 9, color: "var(--mf-text-muted)" }}>{group.attentionCount ? `${group.attentionCount} need action` : "On track"}</Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            )}
          </Card>
        ) : (
          <Box sx={{ minWidth: 0 }}>
            <Card sx={productionFileHeaderSx(file.releaseHealth)}>
              <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 1.2 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ mb: 0.35, fontSize: 9.2, fontWeight: 900, letterSpacing: ".045em", textTransform: "uppercase", color: "var(--mf-text-muted)" }}>
                    {file.clientName || "Client not assigned"}
                  </Typography>
                  <MatFlowProductIdentity
                    productName={file.productName}
                    projectCode={file.projectCode}
                    productionFileNo={file.productionFileNo}
                    drawingNo={file.drawingNo}
                    projectName={file.projectName}
                    showProjectName
                    size="hero"
                  />
                </Box>
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
                    <SummaryCard label="Issues" value={file.openQueries || 0} helper={file.openQueries ? "Needs response / closure" : "No open issue"} tone={file.openQueries ? "warning" : "success"} />
                    <SummaryCard label="BOM" value={readable(file.latestBomStatus || "NOT_STARTED")} helper={file.assignedEngineer || "Engineer not assigned"} tone={file.latestBomStatus === "READY_FOR_RELEASE" || file.latestBomStatus === "RELEASED" ? "success" : "default"} />
                  </>
                )}
                {workspaceFocus === "PPC" && (
                  <>
                    <SummaryCard label="Issues" value={file.openQueries || 0} helper={file.openQueries ? "View Design ↔ Engineering discussion" : "No open issue"} tone={file.openQueries ? "warning" : "success"} />
                    <SummaryCard label="Gate 1" value={readable(file.ppcGate1Decision || "PENDING")} helper={file.ppcOwner || "PPC owner not assigned"} />
                    <SummaryCard label="Gate 2" value={readable(file.ppcGate2Decision || "PENDING")} helper={detail.ppcGate2Ready ? "Ready" : `${detail.ppcGate2Blockers?.length || 0} blocker(s)`} tone={detail.ppcGate2Ready ? "success" : "warning"} />
                    <SummaryCard label="Release" value={file.productionReleasedAt ? "RELEASED" : (file.plannedProductionReleaseDate || "NOT PLANNED")} helper={file.productionReleasedAt ? toDateTime(file.productionReleasedAt) : "Planned production release"} tone={file.productionReleasedAt ? "success" : "default"} />
                  </>
                )}
                {workspaceFocus === "MANAGEMENT" && (
                  <>
                    <SummaryCard label="Department" value={file.currentDepartment || "—"} helper={file.currentOwner || "No current owner"} />
                    <SummaryCard label="Design" value={`${file.designChecklistProgress?.percent || 0}%`} helper={`${file.designTaskProgress?.overdue || 0} overdue task(s)`} tone={file.designTaskProgress?.overdue ? "warning" : "default"} />
                    <SummaryCard label="Issues" value={file.openQueries || 0} helper={file.openQueries ? "Open communication" : "No open issue"} tone={file.openQueries ? "warning" : "success"} />
                    <SummaryCard label="Release" value={file.stage === "PRODUCTION_RELEASED" ? "RELEASED" : readable(file.stage)} helper={file.plannedProductionReleaseDate || "No release date"} tone={file.stage === "PRODUCTION_RELEASED" ? "success" : "default"} />
                  </>
                )}
              </Box>
            </Card>

            <Card sx={{ ...panelSx, p: 0 }}>
              <Tabs value={tab} onChange={(_, value) => selectWorkspaceTab(value)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: "1px solid var(--mf-border)", px: 1, minHeight: 42 }}>
                {(TABS_BY_FOCUS[workspaceFocus] || TABS_BY_FOCUS.MANAGEMENT).map(([value, label]) => <Tab key={value} value={value} label={value === "queries" && Number(file.openQueries || 0) > 0 ? `${label} · ${file.openQueries}` : label} sx={{ minHeight: 42, py: 0.6 }} />)}
              </Tabs>
              <Box sx={{ p: 1.45 }}>
                {tab === "overview" && <Overview focus={workspaceFocus} file={file} detail={detail} canDesignHead={canDesignHead} canPpc={canPpc} canEngineeringReview={canEngineeringReview} canEngineeringDecision={canEngineeringDecision} setAction={setAction} />}
                {tab === "designChecklist" && <Checklist title="Designer Checklist" area="DESIGN" items={detail.designChecklist || []} progress={file.designChecklistProgress} canEdit={canDesignTeam && DESIGN_STAGES.includes(file.stage)} working={working} onSave={saveChecklist} />}
                {tab === "designTasks" && <DesignTasks items={detail.designTasks || []} progress={file.designTaskProgress} canHead={canDesignHead && DESIGN_STAGES.includes(file.stage)} canWork={canDesignTeam && DESIGN_STAGES.includes(file.stage)} onCreate={openNewDesignTask} onEdit={openEditDesignTask} onStatus={requestDesignTaskStatus} />}
                {tab === "drawings" && <Revisions file={file} rows={(detail.revisions || []).filter((row) => workspaceFocus === "DESIGN" ? row.type === "DESIGN_DRAWING" : workspaceFocus === "ENGINEERING" ? row.type === "ENGINEERING_DRAWING" : true)} canUploadDesign={workspaceFocus === "DESIGN" && canDesignTeam} canUploadEngineering={workspaceFocus === "ENGINEERING" && canEngineeringReview} revisionType={revisionType} setRevisionType={setRevisionType} revisionNo={revisionNo} setRevisionNo={setRevisionNo} summary={revisionSummary} setSummary={setRevisionSummary} setFile={setRevisionFile} upload={uploadRevision} openRevision={openRevision} canReview={workspaceFocus === "ENGINEERING" && canEngineeringDecision} setAction={setAction} working={working} />}
                {tab === "engineeringChecklist" && <Checklist title="Engineering Technical Checklist" area="ENGINEERING" items={detail.engineeringChecklist || []} progress={file.engineeringChecklistProgress} canEdit={canEngineeringReview && ["ENGINEERING_REVIEW", "ENGINEERING_QUERY"].includes(file.stage)} working={working} onSave={saveChecklist} />}
                {tab === "queries" && <IssueChat
                  items={detail.queries || []}
                  timeline={detail.timeline || []}
                  file={file}
                  currentUsername={currentUsername}
                  selectedQueryId={selectedQueryId}
                  onSelectQuery={selectIssueThread}
                  canCreate={canSharedQueryWrite && ["ENGINEERING_REVIEW", "ENGINEERING_QUERY", "ENGINEERING_WORK", "REVISION_REVIEW"].includes(file.stage)}
                  canMessage={canSharedQueryWrite}
                  canClose={canSharedQueryClose}
                  readOnly={workspaceFocus === "PPC" && !canSharedQueryWrite}
                  working={working}
                  onSendMessage={sendQueryMessage}
                  setAction={setAction}
                />}
                {tab === "engineeringTasks" && <Tasks items={detail.engineeringTasks || []} canManage={canEngineeringReview} canCreateSelf={juniorEngineerOnly} canCreate={canCreateEngineeringTask} canWork={canEngineeringTask} setAction={setAction} />}
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
        <Alert severity="info" sx={{ mt: 1 }}>{file.openQueries} open Design ↔ Engineering issue{file.openQueries === 1 ? "" : "s"}.</Alert>
      )}
      {focus === "PPC" && Number(file.openQueries || 0) > 0 && (
        <Box sx={{ mt: 1, px: 1, py: 0.75, borderLeft: "3px solid var(--mf-warning-text)", background: "var(--mf-warning-soft)", borderRadius: 1 }}>
          <Typography sx={{ fontSize: 9.8, fontWeight: 850, color: "var(--mf-warning-text)" }}>
            {file.openQueries} open Design ↔ Engineering issue{Number(file.openQueries) === 1 ? "" : "s"}. Open the Issues tab to review the conversation.
          </Typography>
        </Box>
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

function IssueChat({
  items,
  timeline,
  file,
  currentUsername,
  selectedQueryId,
  onSelectQuery,
  canCreate,
  canMessage,
  canClose,
  readOnly,
  working,
  onSendMessage,
  setAction,
}) {
  const [search, setSearch] = useState("");
  const [showResolved, setShowResolved] = useState(() => {
    const source = Array.isArray(items) ? items : [];
    return source.length > 0 && source.every((item) => String(item?.status || "").toUpperCase() === "CLOSED");
  });
  const [draft, setDraft] = useState("");
  const bottomRef = useRef(null);

  const ordered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (Array.isArray(items) ? items : [])
      .filter((item) => showResolved || String(item.status || "").toUpperCase() !== "CLOSED")
      .filter((item) => !term || [item.title, item.description, item.key, item.assignedTo, item.priority]
        .some((value) => String(value || "").toLowerCase().includes(term)))
      .slice()
      .sort((a, b) => {
        const aClosed = String(a.status || "").toUpperCase() === "CLOSED";
        const bClosed = String(b.status || "").toUpperCase() === "CLOSED";
        if (aClosed !== bClosed) return aClosed ? 1 : -1;
        return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
      });
  }, [items, search, showResolved]);

  const active = useMemo(() => {
    const requested = (Array.isArray(items) ? items : []).find((item) => String(item.id) === String(selectedQueryId || ""));
    return requested || ordered[0] || null;
  }, [items, ordered, selectedQueryId]);

  const messages = useMemo(() => issueMessages(active, timeline), [active, timeline]);

  useEffect(() => {
    if (active && String(active.id) !== String(selectedQueryId || "")) onSelectQuery(active.id);
  }, [active?.id, selectedQueryId, onSelectQuery]);

  useEffect(() => {
    const source = Array.isArray(items) ? items : [];
    const selected = source.find((item) => String(item?.id || "") === String(selectedQueryId || ""));
    const hasOpen = source.some((item) => String(item?.status || "").toUpperCase() !== "CLOSED");
    if ((selected && String(selected.status || "").toUpperCase() === "CLOSED") || (!hasOpen && source.length > 0)) {
      setShowResolved(true);
    }
  }, [items, selectedQueryId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [active?.id, messages.length]);

  const send = async () => {
    const message = draft.trim();
    if (!message || !active || working || !canMessage || String(active.status).toUpperCase() === "CLOSED") return;
    const ok = await onSendMessage(active, message);
    if (ok) setDraft("");
  };

  const openCount = (Array.isArray(items) ? items : []).filter((item) => String(item.status || "").toUpperCase() !== "CLOSED").length;

  return (
    <Box>
      <Box sx={{ mb: 1, display: "flex", alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: 1, flexDirection: { xs: "column", sm: "row" } }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.7 }}>
            <ForumOutlinedIcon sx={{ fontSize: 18, color: "var(--mf-primary-text)" }} />
            <Typography sx={{ fontSize: 13.2, fontWeight: 900, color: "var(--mf-text)" }}>Issue Chat</Typography>
          </Box>
          <Typography sx={{ mt: 0.15, fontSize: 9.4, color: "var(--mf-text-muted)" }}>
            Design ↔ Engineering conversation on this Product / PD · {openCount} open
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 0.6, alignItems: "center", flexWrap: "wrap" }}>
          <Button size="small" onClick={() => setShowResolved((value) => !value)} sx={secondaryBtnSx}>
            {showResolved ? "Hide resolved" : "Show resolved"}
          </Button>
          {canCreate && (
            <Button
              size="small"
              startIcon={<AddOutlinedIcon />}
              sx={primaryBtnSx}
              onClick={() => setAction({ ...EMPTY_ACTION, kind: "QUERY_CREATE", title: "Start Issue Chat", priority: "NORMAL" })}
            >
              New issue
            </Button>
          )}
        </Box>
      </Box>

      {readOnly && (
        <Box sx={{ mb: 0.9, px: 1, py: 0.75, display: "flex", gap: 0.7, alignItems: "center", border: "1px solid var(--mf-border)", borderRadius: 1.2, background: "var(--mf-surface)" }}>
          <VisibilityOutlinedIcon sx={{ fontSize: 16, color: "var(--mf-text-muted)" }} />
          <Typography sx={{ fontSize: 9.5, color: "var(--mf-text-secondary)" }}>
            PPC view only. Open issues continue to follow the existing gate rules until Design / Engineering resolve them.
          </Typography>
        </Box>
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "280px minmax(0,1fr)" }, gap: 0.9, minHeight: 500 }}>
        <Card sx={{ ...panelSx, p: 0, overflow: "hidden", boxShadow: "none" }}>
          <Box sx={{ p: 0.8, borderBottom: "1px solid var(--mf-border)" }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search issues"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              sx={fieldSx}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon sx={{ fontSize: 16, color: "var(--mf-text-muted)" }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          <Box sx={{ maxHeight: { xs: 220, lg: 520 }, overflowY: "auto" }}>
            {!ordered.length ? (
              <Box sx={{ p: 2.2, textAlign: "center" }}>
                <Typography sx={{ fontSize: 10, color: "var(--mf-text-muted)" }}>No issue threads.</Typography>
              </Box>
            ) : ordered.map((item) => {
              const selected = String(active?.id || "") === String(item.id || "");
              const accent = issueAccent(item);
              return (
                <Box
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectQuery(item.id)}
                  onKeyDown={(event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); onSelectQuery(item.id); } }}
                  sx={{
                    px: 1,
                    py: 0.9,
                    cursor: "pointer",
                    borderBottom: "1px solid var(--mf-border)",
                    borderLeft: `3px solid ${accent}`,
                    background: selected ? "var(--mf-primary-soft)" : "var(--mf-panel-solid)",
                    "&:hover": { background: selected ? "var(--mf-primary-soft)" : "var(--mf-hover)" },
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", gap: 0.6, alignItems: "flex-start" }}>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 900, color: "var(--mf-text)", lineHeight: 1.35 }}>{item.title}</Typography>
                    <Typography sx={{ fontSize: 8.5, fontWeight: 850, color: accent, whiteSpace: "nowrap" }}>{issueStatusLabel(item.status)}</Typography>
                  </Box>
                  <Typography noWrap sx={{ mt: 0.3, fontSize: 8.9, color: "var(--mf-text-muted)" }}>
                    {item.key} · {item.assignedTo ? `To ${item.assignedTo}` : "Shared thread"}
                  </Typography>
                  <Typography noWrap sx={{ mt: 0.15, fontSize: 8.8, color: "var(--mf-text-secondary)" }}>
                    {item.responseText || item.description || "No message yet"}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Card>

        <Card sx={{ ...panelSx, p: 0, overflow: "hidden", boxShadow: "none", display: "flex", flexDirection: "column", minHeight: 500 }}>
          {!active ? (
            <Box sx={{ flex: 1, display: "grid", placeItems: "center", p: 3 }}>
              <Box sx={{ textAlign: "center" }}>
                <ForumOutlinedIcon sx={{ fontSize: 28, color: "var(--mf-text-muted)" }} />
                <Typography sx={{ mt: 0.7, fontSize: 11.5, fontWeight: 850, color: "var(--mf-text-secondary)" }}>No issue selected</Typography>
                <Typography sx={{ mt: 0.2, fontSize: 9.2, color: "var(--mf-text-muted)" }}>Open an existing thread or start a new issue.</Typography>
              </Box>
            </Box>
          ) : (
            <>
              <Box sx={{ px: 1.2, py: 0.95, borderBottom: "1px solid var(--mf-border)", display: "flex", justifyContent: "space-between", gap: 1, alignItems: "flex-start" }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 11.8, fontWeight: 900, color: "var(--mf-text)" }}>{active.title}</Typography>
                  <Typography sx={{ mt: 0.2, fontSize: 8.9, color: "var(--mf-text-muted)" }}>
                    {active.key} · {issueStatusLabel(active.status)} · {active.priority || "NORMAL"} · Due {toDateTime(active.dueAt)}
                  </Typography>
                  <Typography sx={{ mt: 0.15, fontSize: 8.9, color: "var(--mf-text-muted)" }}>
                    Product {file?.productName || "—"} · PD {file?.projectCode || "—"} · Current action {active.assignedTo || "Shared"}
                  </Typography>
                </Box>
                {canClose && String(active.status || "").toUpperCase() !== "CLOSED" && (
                  <Button
                    size="small"
                    startIcon={<CheckCircleOutlineRoundedIcon />}
                    sx={secondaryBtnSx}
                    onClick={() => setAction({ ...EMPTY_ACTION, kind: "QUERY_CLOSE", title: "Resolve Issue", item: active })}
                  >
                    Resolve
                  </Button>
                )}
              </Box>

              <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: { xs: 1, md: 1.4 }, py: 1.2, background: "var(--mf-surface)" }}>
                {messages.map((message) => {
                  if (message.kind === "system") {
                    return (
                      <Box key={message.id} sx={{ my: 1, textAlign: "center" }}>
                        <Typography sx={{ display: "inline-block", px: 1, py: 0.4, borderRadius: 99, border: "1px solid var(--mf-success-border)", background: "var(--mf-success-soft)", fontSize: 8.8, color: "var(--mf-success-text)", fontWeight: 800 }}>
                          {message.text} {message.actor ? `· ${message.actor}` : ""}
                        </Typography>
                      </Box>
                    );
                  }
                  const mine = currentUsername && String(message.actor || "").toLowerCase() === currentUsername.toLowerCase();
                  return (
                    <Box key={message.id} sx={{ mb: 1, display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                      <Box sx={{ maxWidth: { xs: "90%", md: "74%" } }}>
                        <Typography sx={{ mb: 0.25, px: 0.3, fontSize: 8.2, color: "var(--mf-text-muted)", textAlign: mine ? "right" : "left" }}>
                          {mine ? "You" : (message.actor || "User")}{message.department ? ` · ${readable(message.department)}` : ""} · {toDateTime(message.at)}
                        </Typography>
                        <Box sx={{ px: 1.05, py: 0.8, borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px", border: `1px solid ${mine ? "var(--mf-primary-border)" : "var(--mf-border)"}`, background: mine ? "var(--mf-primary-soft)" : "var(--mf-panel-solid)" }}>
                          <Typography sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 10.3, lineHeight: 1.55, color: "var(--mf-text-secondary)" }}>{message.text}</Typography>
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
                <div ref={bottomRef} />
              </Box>

              <Box sx={{ p: 0.9, borderTop: "1px solid var(--mf-border)", background: "var(--mf-panel-solid)" }}>
                {String(active.status || "").toUpperCase() === "CLOSED" ? (
                  <Typography sx={{ py: 0.8, textAlign: "center", fontSize: 9.4, color: "var(--mf-success-text)", fontWeight: 800 }}>Resolved thread · conversation retained in the Production File audit trail.</Typography>
                ) : canMessage ? (
                  <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 0.7, alignItems: "end" }}>
                    <TextField
                      multiline
                      maxRows={4}
                      placeholder="Message Design / Engineering…"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          send();
                        }
                      }}
                      sx={fieldSx}
                      helperText="Enter to send · Shift+Enter for a new line"
                    />
                    <Button disabled={working || !draft.trim()} onClick={send} sx={{ ...primaryBtnSx, minWidth: 42, px: 1.1 }}>
                      <SendRoundedIcon sx={{ fontSize: 18 }} />
                    </Button>
                  </Box>
                ) : (
                  <Typography sx={{ py: 0.7, textAlign: "center", fontSize: 9.2, color: "var(--mf-text-muted)" }}>Read-only conversation.</Typography>
                )}
              </Box>
            </>
          )}
        </Card>
      </Box>
    </Box>
  );
}

function Tasks({ items, canManage, canCreateSelf, canCreate, canWork, setAction }) {
  const openCreate = () => setAction({
    ...EMPTY_ACTION,
    kind: "TASK_CREATE",
    title: canCreateSelf && !canManage ? "Add My Engineering Task" : "Add Engineering Task",
    selfTask: canCreateSelf && !canManage,
    blocking: canCreateSelf && !canManage ? false : true,
    priority: "NORMAL",
  });

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, mb: 1 }}>
        <Box>
          <Typography sx={{ fontWeight: 950, color: "var(--mf-text)" }}>Engineering Tasks</Typography>
          <Typography sx={{ mt: 0.15, fontSize: 9.7, color: "var(--mf-text-muted)" }}>
            {canCreateSelf && !canManage
              ? "Add your own non-blocking work items; senior Engineering users control delegated/release-blocking tasks."
              : "Engineering Head / Engineer can delegate work; Junior Engineers can maintain their own tasks."}
          </Typography>
        </Box>
        {canCreate && (
          <Button startIcon={<AddOutlinedIcon />} sx={secondaryBtnSx} onClick={openCreate}>
            {canCreateSelf && !canManage ? "Add My Task" : "Add Task"}
          </Button>
        )}
      </Box>
      {!items.length ? (
        <Box sx={{ p: 2.2, textAlign: "center", color: "var(--mf-text-muted)", fontSize: 10.5 }}>No Engineering tasks yet.</Box>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 0.8 }}>
          {items.map((item) => (
            <Card key={item.id} sx={{ ...panelSx, p: 1.2, boxShadow: "none" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                <Box>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 950, color: "var(--mf-text)" }}>{item.title}</Typography>
                  <Typography sx={{ fontSize: 9.5, color: "var(--mf-text-muted)" }}>{item.key} · {item.blocking ? "Release blocking" : "Personal / non-blocking"}</Typography>
                </Box>
                <Chip label={readable(item.status)} sx={statusSx} />
              </Box>
              <Typography sx={{ mt: 0.7, fontSize: 10, color: "var(--mf-text-muted)" }}>Owner: {item.assignedTo || "Unassigned"} · Due: {toDateTime(item.dueAt)}</Typography>
              <Typography sx={{ mt: 0.25, fontSize: 9.5, color: "var(--mf-text-muted)" }}>Started: {toDateTime(item.startedAt)} · Completed: {toDateTime(item.completedAt)}</Typography>
              {canWork && !["COMPLETE", "NOT_APPLICABLE", "CANCELLED"].includes(item.status) && (
                <Box sx={{ mt: 0.8, display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                  {["IN_PROGRESS", "BLOCKED", "COMPLETE", "NOT_APPLICABLE"].map((status) => (
                    <Button key={status} size="small" sx={secondaryBtnSx} onClick={() => setAction({ ...EMPTY_ACTION, kind: "TASK_STATUS", title: `Set ${item.title}: ${readable(status)}`, decision: status, item })}>
                      {readable(status)}
                    </Button>
                  ))}
                </Box>
              )}
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}

function Revisions({ file, rows, canUploadDesign, canUploadEngineering, revisionType, setRevisionType, revisionNo, setRevisionNo, summary, setSummary, setFile, upload, openRevision, canReview, setAction, working }) {
  const canUpload = canUploadDesign || canUploadEngineering;
  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}>
        <Box>
          <Typography sx={{ fontWeight: 950, color: "var(--mf-text)" }}>Optional References</Typography>
          <Typography sx={{ mt: 0.2, fontSize: 10.3, color: "var(--mf-text-muted)" }}>
            Drawings and attachments are optional supporting references. They are not required to complete Design, Engineering or Production Release gates.
          </Typography>
        </Box>
      </Box>
      {canUpload && (
        <Card sx={{ ...panelSx, p: 1.1, mt: 1, boxShadow: "none" }}>
          <Typography sx={{ mb: 0.75, fontSize: 9.5, fontWeight: 850, color: "var(--mf-text-muted)" }}>Add a reference only when it is useful</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "170px 120px 1fr auto auto" }, gap: 0.7, alignItems: "center" }}>
            <TextField select size="small" label="Reference type" value={revisionType} onChange={(e) => setRevisionType(e.target.value)} sx={fieldSx}>
              {canUploadDesign && <MenuItem value="DESIGN_DRAWING">Design Drawing</MenuItem>}
              {canUploadEngineering && <MenuItem value="ENGINEERING_DRAWING">Engineering Drawing</MenuItem>}
            </TextField>
            <TextField size="small" label="Revision" value={revisionNo} onChange={(e) => setRevisionNo(e.target.value)} sx={fieldSx} />
            <TextField size="small" label="Reference note" value={summary} onChange={(e) => setSummary(e.target.value)} sx={fieldSx} />
            <Button component="label" startIcon={<UploadFileOutlinedIcon />} sx={secondaryBtnSx}>Choose File<input hidden type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></Button>
            <Button disabled={working} onClick={upload} sx={secondaryBtnSx}>Add</Button>
          </Box>
        </Card>
      )}
      <Box sx={{ mt: 1 }}>
        {rows.length === 0 ? (
          <Box sx={{ p: 2.2, textAlign: "center", color: "var(--mf-text-muted)", fontSize: 10.5 }}>No optional references added.</Box>
        ) : rows.map((row) => (
          <Box key={row.id} sx={{ p: 1, display: "grid", gridTemplateColumns: { xs: "1fr", md: "120px 100px 1fr 150px auto" }, gap: 1, alignItems: "center", borderBottom: "1px solid var(--mf-border)" }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 850, color: "var(--mf-text-secondary)" }}>{readable(row.type)}</Typography>
            <Typography sx={{ fontSize: 10.5, fontWeight: 950, color: "var(--mf-text)" }}>Rev {row.revisionNo}</Typography>
            <Typography sx={{ fontSize: 9.8, color: "var(--mf-text-muted)" }}>{row.changeSummary || row.originalFileName}</Typography>
            <Chip label={readable(row.status)} sx={statusSx} />
            <Box sx={{ display: "flex", gap: 0.5 }}>
              <Button size="small" startIcon={<LaunchOutlinedIcon />} onClick={() => openRevision(row)} sx={secondaryBtnSx}>Open</Button>
              {canReview && row.status === "PENDING_IMPACT_REVIEW" && <Button size="small" onClick={() => setAction({ ...EMPTY_ACTION, kind: "REVISION_IMPACT", title: `Revision Impact — ${row.revisionNo}`, revision: row, decision: "ACCEPT" })} sx={primaryBtnSx}>Review</Button>}
            </Box>
          </Box>
        ))}
      </Box>
      {file.downstreamWorkflowStatus === "RELEASE_INVALIDATED_BY_REVISION" && <Alert severity="error" sx={{ mt: 1 }}>An optional reference revision changed after release and its accepted impact invalidated the previous Production Release. Engineering and PPC Gate 2 must revalidate it.</Alert>}
    </Box>
  );
}

function Timeline({ rows }) {
  return <Box>{rows.length === 0 ? <Box sx={{ p: 3, textAlign: "center", color: "var(--mf-text-muted)" }}>No audit events yet.</Box> : rows.map((row, index) => <Box key={`${row.entityId}-${index}`} sx={{ display: "grid", gridTemplateColumns: "150px 170px 1fr", gap: 1, p: 1, borderBottom: "1px solid var(--mf-border)" }}><Typography sx={{ fontSize: 10, color: "var(--mf-text-muted)" }}>{toDateTime(row.at)}</Typography><Typography sx={{ fontSize: 10.5, fontWeight: 900, color: "var(--mf-text)" }}>{readable(row.action)}</Typography><Typography sx={{ fontSize: 10, color: "var(--mf-text-secondary)" }}>{row.actor}</Typography></Box>)}</Box>;
}

function DesignTaskDialog({ value, setValue, working, onSave }) {
  const open = Boolean(value);
  if (!value) return null;
  return <Dialog open={open} onClose={() => !working && setValue(null)} fullWidth maxWidth="md" PaperProps={{ sx: dialogPaperSx }}><DialogTitle sx={dialogTitleSx}>{value.mode === "edit" ? "Edit Design Task" : "Delegate Design Task"}</DialogTitle><DialogContent sx={dialogContentSx}><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.1, mt: 0.5 }}><TextField select label="Task Type" value={value.taskType} onChange={(e) => setValue((row) => ({ ...row, taskType: e.target.value }))} sx={fieldSx}>{DESIGN_TASK_TYPES.map((type) => <MenuItem key={type} value={type}>{readable(type)}</MenuItem>)}</TextField><TextField select label="Priority" value={value.priority} onChange={(e) => setValue((row) => ({ ...row, priority: e.target.value }))} sx={fieldSx}><MenuItem value="LOW">Low</MenuItem><MenuItem value="NORMAL">Normal</MenuItem><MenuItem value="HIGH">High</MenuItem><MenuItem value="URGENT">Urgent</MenuItem></TextField><TextField label="Task Title *" value={value.title} onChange={(e) => setValue((row) => ({ ...row, title: e.target.value }))} sx={{ ...fieldSx, gridColumn: { md: "1 / -1" } }} /><TextField label="Description / task details" multiline minRows={3} value={value.description} onChange={(e) => setValue((row) => ({ ...row, description: e.target.value }))} sx={{ ...fieldSx, gridColumn: { md: "1 / -1" } }} /><TextField label="Junior Designer / Design team assignees *" multiline minRows={2} helperText="Comma separated. One task may be shared by multiple members." value={value.assigneesText} onChange={(e) => setValue((row) => ({ ...row, assigneesText: e.target.value }))} sx={{ ...fieldSx, gridColumn: { md: "1 / -1" } }} /><TextField type="datetime-local" label="Received Date / Time" InputLabelProps={{ shrink: true }} value={value.receivedAt} onChange={(e) => setValue((row) => ({ ...row, receivedAt: e.target.value }))} sx={fieldSx} /><TextField type="datetime-local" label="Due Date / Time" InputLabelProps={{ shrink: true }} value={value.dueAt} onChange={(e) => setValue((row) => ({ ...row, dueAt: e.target.value }))} sx={fieldSx} /><TextField select label="Blocks Design Handoff?" value={value.blocking} onChange={(e) => setValue((row) => ({ ...row, blocking: e.target.value }))} sx={fieldSx}><MenuItem value="true">Yes</MenuItem><MenuItem value="false">No</MenuItem></TextField><TextField label="Remarks" value={value.remarks} onChange={(e) => setValue((row) => ({ ...row, remarks: e.target.value }))} sx={fieldSx} /></Box></DialogContent><DialogActions sx={dialogActionsSx}><Button onClick={() => setValue(null)} sx={secondaryBtnSx}>Cancel</Button><Button disabled={working} onClick={onSave} sx={primaryBtnSx}>{value.mode === "edit" ? "Save Task" : "Delegate Task"}</Button></DialogActions></Dialog>;
}

function DesignTaskStatusDialog({ value, setValue, working, onSave }) {
  if (!value) return null;
  return <Dialog open fullWidth maxWidth="sm" onClose={() => !working && setValue(null)} PaperProps={{ sx: dialogPaperSx }}><DialogTitle sx={dialogTitleSx}>{readable(value.status)} · {value.item.title}</DialogTitle><DialogContent sx={dialogContentSx}><TextField autoFocus fullWidth label={value.status === "HOLD" ? "Hold reason *" : "Cancellation reason *"} multiline minRows={3} value={value.note} onChange={(e) => setValue((row) => ({ ...row, note: e.target.value }))} sx={{ ...fieldSx, mt: 0.8 }} /></DialogContent><DialogActions sx={dialogActionsSx}><Button onClick={() => setValue(null)} sx={secondaryBtnSx}>Cancel</Button><Button disabled={working || !String(value.note || "").trim()} onClick={onSave} sx={primaryBtnSx}>Confirm</Button></DialogActions></Dialog>;
}

function ActionDialog({ action, setAction, working, submit }) {
  const open = Boolean(action.kind);
  const close = () => !working && setAction(EMPTY_ACTION);
  const needsDecision = ["DESIGN_HEAD_REVIEW", "PPC1", "ENG_DECISION", "TASK_STATUS", "REVISION_IMPACT", "PPC2"].includes(action.kind);
  return <Dialog open={open} onClose={close} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}><DialogTitle sx={dialogTitleSx}>{action.title || "MatFlow Action"}</DialogTitle><DialogContent sx={dialogContentSx}><Box sx={{ display: "grid", gap: 1.1, mt: 0.5 }}>{action.kind === "DESIGN_HEAD_REVIEW" && <TextField label={action.decision === "RETURN" ? "Return reason *" : "Design Head review remarks"} multiline minRows={3} value={action.remarks} onChange={(e) => setAction((value) => ({ ...value, remarks: e.target.value }))} sx={fieldSx} />}{action.kind === "DESIGN_SUBMIT" && <TextField label="Controlled Release reason (mandatory when the checklist requires attention)" multiline minRows={3} value={action.controlledReleaseReason} onChange={(e) => setAction((value) => ({ ...value, controlledReleaseReason: e.target.value }))} sx={fieldSx} />}{action.kind === "PPC1" && action.decision === "ACCEPT" && <TextField label="Assign Engineer / username" value={action.assignedTo} onChange={(e) => setAction((value) => ({ ...value, assignedTo: e.target.value }))} sx={fieldSx} />}{["PPC1", "ENG_DECISION", "PPC2"].includes(action.kind) && <TextField label="Remarks" multiline minRows={3} value={action.remarks} onChange={(e) => setAction((value) => ({ ...value, remarks: e.target.value }))} sx={fieldSx} />}{action.kind === "QUERY_CREATE" && <><TextField autoFocus label="Issue title *" value={action.queryTitle} onChange={(e) => setAction((value) => ({ ...value, queryTitle: e.target.value }))} sx={fieldSx} /><TextField label="Opening message / context" multiline minRows={3} value={action.description} onChange={(e) => setAction((value) => ({ ...value, description: e.target.value }))} sx={fieldSx} /><TextField select label="Priority" value={action.priority} onChange={(e) => setAction((value) => ({ ...value, priority: e.target.value }))} sx={fieldSx}><MenuItem value="LOW">Low</MenuItem><MenuItem value="NORMAL">Normal</MenuItem><MenuItem value="HIGH">High</MenuItem><MenuItem value="URGENT">Urgent</MenuItem></TextField><TextField type="datetime-local" label="Due / expected response" InputLabelProps={{ shrink: true }} value={action.dueAt} onChange={(e) => setAction((value) => ({ ...value, dueAt: e.target.value }))} sx={fieldSx} /><TextField label="Route to username (optional)" helperText="Leave blank to auto-route to the counterpart department owner." value={action.assignedTo} onChange={(e) => setAction((value) => ({ ...value, assignedTo: e.target.value }))} sx={{ ...fieldSx, gridColumn: { md: "1 / -1" } }} /></>}{action.kind === "QUERY_CLOSE" && <TextField label="Closure note" multiline minRows={3} value={action.note} onChange={(e) => setAction((value) => ({ ...value, note: e.target.value }))} sx={fieldSx} />}{action.kind === "TASK_CREATE" && <><TextField label="Task title *" value={action.queryTitle} onChange={(e) => setAction((value) => ({ ...value, queryTitle: e.target.value }))} sx={fieldSx} />{action.selfTask ? <Box sx={{ px: 1.1, py: 0.9, border: "1px solid var(--mf-border)", borderRadius: 1.1, background: "var(--mf-surface)" }}><Typography sx={{ fontSize: 9.2, fontWeight: 850, color: "var(--mf-text-muted)" }}>ASSIGNEE</Typography><Typography sx={{ mt: 0.15, fontSize: 10.8, fontWeight: 900, color: "var(--mf-text)" }}>You</Typography><Typography sx={{ mt: 0.1, fontSize: 8.9, color: "var(--mf-text-muted)" }}>Junior Engineer self-created tasks are non-blocking.</Typography></Box> : <TextField label="Assign to Engineer / Junior Engineer" value={action.assignedTo} onChange={(e) => setAction((value) => ({ ...value, assignedTo: e.target.value }))} sx={fieldSx} />}<TextField select label="Priority" value={action.priority} onChange={(e) => setAction((value) => ({ ...value, priority: e.target.value }))} sx={fieldSx}><MenuItem value="LOW">Low</MenuItem><MenuItem value="NORMAL">Normal</MenuItem><MenuItem value="HIGH">High</MenuItem><MenuItem value="URGENT">Urgent</MenuItem></TextField><TextField type="datetime-local" label="Due Date / Time" InputLabelProps={{ shrink: true }} value={action.dueAt} onChange={(e) => setAction((value) => ({ ...value, dueAt: e.target.value }))} sx={fieldSx} />{!action.selfTask && <TextField select label="Blocks Engineering Handoff?" value={String(action.blocking)} onChange={(e) => setAction((value) => ({ ...value, blocking: e.target.value === "true" }))} sx={fieldSx}><MenuItem value="true">Yes</MenuItem><MenuItem value="false">No</MenuItem></TextField>}<TextField label="Description" multiline minRows={2} value={action.description} onChange={(e) => setAction((value) => ({ ...value, description: e.target.value }))} sx={fieldSx} /></>}{action.kind === "TASK_STATUS" && <TextField label="Note / reason" multiline minRows={2} value={action.note} onChange={(e) => setAction((value) => ({ ...value, note: e.target.value }))} sx={fieldSx} />}{action.kind === "REVISION_IMPACT" && <><TextField select label="Decision" value={action.decision} onChange={(e) => setAction((value) => ({ ...value, decision: e.target.value }))} sx={fieldSx}><MenuItem value="ACCEPT">Accept and revalidate</MenuItem><MenuItem value="REJECT">Reject revision</MenuItem></TextField><TextField label="Impact assessment / note" multiline minRows={4} value={action.note} onChange={(e) => setAction((value) => ({ ...value, note: e.target.value }))} sx={fieldSx} /></>}{needsDecision && action.kind !== "REVISION_IMPACT" && <Typography sx={{ fontSize: 10.5, color: "var(--mf-text-muted)" }}>Decision: <b>{readable(action.decision)}</b></Typography>}</Box></DialogContent><DialogActions sx={dialogActionsSx}><Button onClick={close} sx={secondaryBtnSx}>Cancel</Button><Button disabled={working || (action.kind === "DESIGN_HEAD_REVIEW" && action.decision === "RETURN" && !String(action.remarks || "").trim()) || (action.kind === "QUERY_CREATE" && !String(action.queryTitle || "").trim())} onClick={submit} sx={primaryBtnSx}>Confirm</Button></DialogActions></Dialog>;
}
