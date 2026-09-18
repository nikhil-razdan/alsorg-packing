import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import AssignmentIndOutlinedIcon from "@mui/icons-material/AssignmentIndOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import { useSearchParams } from "react-router-dom";
import { matflowApi, readMatFlowError } from "../api/matflowApi";
import {
  EmptyState,
  ErrorBox,
  LoadingBlock,
  MATFLOW_ROLES,
  MATFLOW_LIST_CARD_OPTIONS,
  MatFlowViewToggle,
  PageHero,
  fieldSx,
  pageSx,
  panelSx,
  primaryBtnSx,
  secondaryBtnSx,
  sidePanelPaperSx,
  sidePanelHeaderSx,
  sidePanelBodySx,
  useMatFlow,
  useMatFlowViewMode,
  readable,
} from "../matflowUi";

const PRODUCT_BLANK = {
  productName: "",
  productType: "",
  drawingNo: "",
  drawingRevision: "0",
  unitQuantity: 1,
  dimensionLength: "",
  dimensionBreadth: "",
  dimensionHeight: "",
  requiredDate: "",
  remarks: "",
  active: true,
  rowVersion: null,
};

const clean = (value) => String(value ?? "").trim();
const normalizeRoles = (values) => new Set((Array.isArray(values) ? values : [values])
  .map((value) => clean(value).replace(/^ROLE_/i, "").toUpperCase()).filter(Boolean));
const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(String(value).length <= 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};
const inputDateTime = (value) => value ? String(value).slice(0, 16) : "";
const displayPd = (row) => row?.pdNumberPending || !clean(row?.projectCode) ? "PD No. not assigned" : row.projectCode;
const nullableNumber = (value) => value === "" || value == null ? null : Number(value);
const cleanProductBody = (value) => ({
  ...value,
  unitQuantity: Number(value.unitQuantity || 1),
  dimensionLength: nullableNumber(value.dimensionLength),
  dimensionBreadth: nullableNumber(value.dimensionBreadth),
  dimensionHeight: nullableNumber(value.dimensionHeight),
  requiredDate: value.requiredDate || null,
});

const statusTone = (status, overdue = false) => {
  if (overdue) return { color: "var(--mf-danger-text)", bg: "var(--mf-danger-soft)", border: "var(--mf-danger-border)" };
  const value = String(status || "").toUpperCase();
  if (["HANDED_OFF", "DONE", "READY_FOR_HANDOFF"].includes(value)) return { color: "var(--mf-success-text)", bg: "var(--mf-success-soft)", border: "var(--mf-success-border)" };
  if (["IN_PROGRESS", "WIP"].includes(value)) return { color: "var(--mf-primary-text)", bg: "var(--mf-primary-soft)", border: "var(--mf-primary-border)" };
  if (["UNASSIGNED", "TODO"].includes(value)) return { color: "var(--mf-warning-text)", bg: "var(--mf-warning-soft)", border: "var(--mf-warning-border)" };
  return { color: "var(--mf-text-secondary)", bg: "var(--mf-surface)", border: "var(--mf-border)" };
};

function StatusChip({ status, overdue = false, label }) {
  const tone = statusTone(status, overdue);
  return <Chip size="small" label={label || readable(status || "Pending")} sx={{ height: 24, borderRadius: 999, fontWeight: 900, fontSize: 9.3, color: tone.color, background: tone.bg, border: `1px solid ${tone.border}` }} />;
}

function Metric({ label, value, sub }) {
  return (
    <Box sx={{ minWidth: 0, px: 1.05, py: 0.85, border: "1px solid var(--mf-border)", borderRadius: 1.1, background: "var(--mf-panel-solid)" }}>
      <Typography sx={{ fontSize: 8.2, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--mf-text-muted)" }}>{label}</Typography>
      <Typography sx={{ mt: 0.12, fontSize: 14, lineHeight: 1.15, fontWeight: 950, color: "var(--mf-text)" }}>{value}</Typography>
      {sub && <Typography sx={{ mt: 0.12, fontSize: 8.6, color: "var(--mf-text-muted)" }}>{sub}</Typography>}
    </Box>
  );
}

function ProductForm({ value, onChange }) {
  const set = (key, next) => onChange({ ...value, [key]: next });
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))" }, gap: 1 }}>
      <TextField label="Product Name" value={value.productName} onChange={(e) => set("productName", e.target.value)} sx={fieldSx} />
      <TextField label="Product Type" value={value.productType} onChange={(e) => set("productType", e.target.value)} sx={fieldSx} />
      <TextField label="Drawing No. (Optional)" value={value.drawingNo} onChange={(e) => set("drawingNo", e.target.value)} sx={fieldSx} />
      <TextField label="Revision" value={value.drawingRevision} onChange={(e) => set("drawingRevision", e.target.value)} sx={fieldSx} />
      <TextField type="number" inputProps={{ min: 1 }} label="Units" value={value.unitQuantity} onChange={(e) => set("unitQuantity", e.target.value)} sx={fieldSx} />
      <TextField type="date" InputLabelProps={{ shrink: true }} label="Required Date" value={value.requiredDate} onChange={(e) => set("requiredDate", e.target.value)} sx={fieldSx} />
      <TextField type="number" label="Length (mm)" value={value.dimensionLength} onChange={(e) => set("dimensionLength", e.target.value)} sx={fieldSx} />
      <TextField type="number" label="Breadth (mm)" value={value.dimensionBreadth} onChange={(e) => set("dimensionBreadth", e.target.value)} sx={fieldSx} />
      <TextField type="number" label="Height (mm)" value={value.dimensionHeight} onChange={(e) => set("dimensionHeight", e.target.value)} sx={fieldSx} />
      <TextField label="Work / Product note" value={value.remarks} onChange={(e) => set("remarks", e.target.value)} sx={fieldSx} />
    </Box>
  );
}

function ProductSubtaskRow({ row, canProgress, canEdit, working, onProgress, onEdit }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(row.note || "");
  return (
    <Box sx={{ px: 1, py: 0.85, display: "grid", gap: 0.6, borderBottom: "1px solid var(--mf-border)", "&:last-child": { borderBottom: 0 } }}>
      <Box sx={{ minWidth: 0, display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0,1.55fr) minmax(110px,.58fr) auto" }, gap: 0.8, alignItems: "center" }}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: "flex", gap: 0.55, alignItems: "center", flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: 11.2, fontWeight: 950, color: "var(--mf-text)" }}>{row.productName}</Typography>
            {row.productType && <Chip size="small" label={row.productType} sx={{ height: 21, fontSize: 8.4, fontWeight: 850 }} />}
          </Box>
          <Typography sx={{ mt: 0.1, fontSize: 8.9, color: "var(--mf-text-muted)" }}>
            Drawing {row.drawingNo || "Not assigned"} · Rev {row.drawingRevision || "0"}{row.dimensions ? ` · ${row.dimensions}` : ""}
          </Typography>
          {(row.note || row.productRemarks) && <Typography sx={{ mt: 0.22, fontSize: 9, color: "var(--mf-text-secondary)" }}>{row.note || row.productRemarks}</Typography>}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <StatusChip status={row.status} />
          <Typography sx={{ mt: 0.2, fontSize: 8.4, color: "var(--mf-text-muted)" }}>Due {formatDate(row.requiredDate)}</Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 0.5, justifyContent: { xs: "flex-start", md: "flex-end" }, flexWrap: "wrap" }}>
          {canEdit && <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => onEdit(row)} disabled={working} sx={secondaryBtnSx}>Edit</Button>}
          {canProgress && row.status !== "WIP" && <Button size="small" onClick={() => onProgress(row, "WIP", note)} disabled={working} sx={secondaryBtnSx}>Start</Button>}
          {canProgress && row.status !== "DONE" && <Button size="small" startIcon={<CheckCircleOutlineOutlinedIcon />} onClick={() => onProgress(row, "DONE", note)} disabled={working} sx={secondaryBtnSx}>Done</Button>}
          {canProgress && row.status === "DONE" && <Button size="small" onClick={() => onProgress(row, "WIP", note)} disabled={working} sx={secondaryBtnSx}>Reopen</Button>}
          {canProgress && <Button size="small" onClick={() => setNoteOpen((current) => !current)} sx={secondaryBtnSx}>{noteOpen ? "Hide note" : "Work note"}</Button>}
        </Box>
      </Box>
      <Collapse in={noteOpen} unmountOnExit>
        <Box sx={{ pt: 0.25, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr auto" }, gap: 0.6 }}>
          <TextField size="small" label="Product work note" value={note} onChange={(e) => setNote(e.target.value)} sx={fieldSx} />
          <Button onClick={() => onProgress(row, row.status === "TODO" ? "WIP" : row.status, note)} disabled={working} sx={secondaryBtnSx}>Save note</Button>
        </Box>
      </Collapse>
    </Box>
  );
}

export default function MatFlowDesignWorkspace() {
  const { selectedPlantParam, roles, role } = useMatFlow();
  const [searchParams, setSearchParams] = useSearchParams();
  const roleSet = useMemo(() => normalizeRoles([...(roles || []), role]), [roles, role]);
  const canHead = roleSet.has(MATFLOW_ROLES.ADMIN) || roleSet.has(MATFLOW_ROLES.MANAGER) || roleSet.has(MATFLOW_ROLES.DESIGN_HEAD);
  const juniorOnly = roleSet.has(MATFLOW_ROLES.DESIGNER_JUNIOR)
    && ![MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.DESIGN_HEAD, MATFLOW_ROLES.DESIGNER].some((value) => roleSet.has(value));
  const canContribute = canHead || roleSet.has(MATFLOW_ROLES.DESIGNER) || juniorOnly;
  const canAddProduct = canHead || roleSet.has(MATFLOW_ROLES.DESIGNER) || juniorOnly;
  const [viewMode, setViewMode] = useMatFlowViewMode("design-pd-work", "LIST");

  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState("overview");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ assignedJunior: "", dueAt: "", brief: "" });
  const [productOpen, setProductOpen] = useState(false);
  const [productEditingId, setProductEditingId] = useState("");
  const [productForm, setProductForm] = useState(PRODUCT_BLANK);
  const [logText, setLogText] = useState("");
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [ppcOwner, setPpcOwner] = useState("");

  const selectedProjectId = searchParams.get("projectId") || "";

  const loadList = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const response = await matflowApi.listDesignProjects({ plantCode: selectedPlantParam, search: search || undefined, status: status || undefined });
      setRows(response?.data || []);
    } catch (requestError) {
      setError(readMatFlowError(requestError, "Unable to load Design PD assignments."));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [selectedPlantParam, search, status]);

  const loadDetail = useCallback(async (projectId, { quiet = false } = {}) => {
    if (!projectId) return;
    if (!quiet) setDetailLoading(true);
    try {
      const response = await matflowApi.getDesignProject(projectId);
      setSelected(response?.data || null);
    } catch (requestError) {
      setError(readMatFlowError(requestError, "Unable to load this PD Design workspace."));
    } finally {
      if (!quiet) setDetailLoading(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { if (selectedProjectId) loadDetail(selectedProjectId); else setSelected(null); }, [selectedProjectId, loadDetail]);

  const refresh = async () => {
    await Promise.all([loadList({ quiet: true }), selectedProjectId ? loadDetail(selectedProjectId, { quiet: true }) : Promise.resolve()]);
  };

  const openPd = (projectId) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("designPd", "1");
      next.set("projectId", projectId);
      return next;
    }, { replace: true });
    setTab("overview");
  };
  const closePd = () => {
    setSelected(null);
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete("projectId");
      return next;
    }, { replace: true });
  };

  const run = async (fn, fallback) => {
    setWorking(true); setError("");
    try {
      const response = await fn();
      if (response?.data?.projectId) setSelected(response.data);
      await loadList({ quiet: true });
      return response?.data;
    } catch (requestError) {
      setError(readMatFlowError(requestError, fallback));
      return null;
    } finally { setWorking(false); }
  };

  const openAssignment = () => {
    if (!selected) return;
    setAssignForm({ assignedJunior: selected.assignedJunior || "", dueAt: inputDateTime(selected.dueAt), brief: selected.brief || "" });
    setAssignOpen(true);
  };
  const saveAssignment = async () => {
    const data = await run(() => matflowApi.assignDesignProject(selected.projectId, {
      assignedJunior: assignForm.assignedJunior,
      dueAt: assignForm.dueAt || null,
      brief: assignForm.brief || null,
      rowVersion: selected.rowVersion,
    }), "Unable to assign this PD.");
    if (data) setAssignOpen(false);
  };

  const setChecklist = async (item, nextStatus, remarks = item.remarks || "") => {
    let nextRemarks = remarks;
    if (nextStatus === "NOT_APPLICABLE" && !clean(nextRemarks)) {
      nextRemarks = window.prompt("Reason for marking this checklist point N/A:", "") || "";
      if (!clean(nextRemarks)) return;
    }
    await run(() => matflowApi.updateDesignProjectChecklist(selected.projectId, item.key, {
      status: nextStatus,
      remarks: clean(nextRemarks) || null,
      rowVersion: selected.rowVersion,
    }), "Unable to update the PD checklist.");
  };
  const toggleChecklistLock = async () => {
    const unlocking = selected.checklistLocked;
    const note = unlocking ? window.prompt("Reason for unlocking this signed PD checklist:", "Correction required") : null;
    if (unlocking && !clean(note)) return;
    await run(() => matflowApi.setDesignProjectChecklistLock(selected.projectId, {
      locked: !selected.checklistLocked,
      note: note || null,
      rowVersion: selected.rowVersion,
    }), "Unable to change checklist lock.");
  };

  const openProductCreate = () => {
    setProductEditingId("");
    setProductForm(PRODUCT_BLANK);
    setProductOpen(true);
  };

  const openProductEdit = (product) => {
    if (!product) return;
    setProductEditingId(product.productId);
    setProductForm({
      productName: product.productName || "",
      productType: product.productType || "",
      drawingNo: product.drawingNo || "",
      drawingRevision: product.drawingRevision || "0",
      unitQuantity: product.unitQuantity || 1,
      dimensionLength: product.dimensionLength ?? "",
      dimensionBreadth: product.dimensionBreadth ?? "",
      dimensionHeight: product.dimensionHeight ?? "",
      requiredDate: product.requiredDate || "",
      remarks: product.productRemarks || "",
      active: true,
      rowVersion: product.rowVersion ?? null,
    });
    setProductOpen(true);
  };

  const closeProductDialog = () => {
    setProductOpen(false);
    setProductEditingId("");
    setProductForm(PRODUCT_BLANK);
  };

  const saveProduct = async () => {
    if (!clean(productForm.productName)) { setError("Product Name is required."); return; }
    const body = cleanProductBody(productForm);
    const response = productEditingId
      ? await run(() => matflowApi.updateProjectProduct(selected.projectId, productEditingId, body), "Unable to update this Product / Design subtask.")
      : await run(() => matflowApi.addProjectProduct(selected.projectId, body), "Unable to add Product to this PD.");
    if (response) {
      closeProductDialog();
      await loadDetail(selected.projectId, { quiet: true });
    }
  };

  const updateProductProgress = async (product, nextStatus, note) => {
    await run(() => matflowApi.updateDesignProductProgress(selected.projectId, product.productId, {
      status: nextStatus,
      note: clean(note) || null,
      rowVersion: selected.rowVersion,
    }), "Unable to update Product work status.");
  };

  const addLog = async () => {
    if (!clean(logText)) return;
    const response = await run(() => matflowApi.addDesignProjectLog(selected.projectId, {
      message: logText,
      kind: "NOTE",
      rowVersion: selected.rowVersion,
    }), "Unable to add the PD activity update.");
    if (response) setLogText("");
  };

  const openHandoff = () => {
    if (!selected?.productionFileId) return;
    setPpcOwner(selected.ppcOwner || "");
    setHandoffOpen(true);
  };

  const handoffToPpc = async () => {
    if (!selected?.productionFileId) return;
    if (!clean(ppcOwner) && !clean(selected.ppcOwner)) { setError("Assign the PPC owner before handoff."); return; }
    setWorking(true); setError("");
    try {
      let detailResponse = await matflowApi.getProductionFile(selected.productionFileId);
      let file = detailResponse?.data?.productionFile;
      if (!file) throw new Error("Project Production File is unavailable.");

      if (!clean(file.ppcOwner) || clean(file.ppcOwner) !== clean(ppcOwner)) {
        const setupResponse = await matflowApi.updateProductionFileSetup(file.id, {
          designer: file.designer || selected.assignedJunior || null,
          designHead: file.designHead || selected.designHead || null,
          ppcOwner: clean(ppcOwner),
          engineeringHead: file.engineeringHead || null,
          assignedEngineer: file.assignedEngineer || null,
          plannedProductionReleaseDate: file.plannedProductionReleaseDate || null,
          plannedDispatchDate: file.plannedDispatchDate || null,
          remarks: file.remarks || null,
          rowVersion: file.rowVersion,
        });
        file = setupResponse?.data?.productionFile || file;
      }

      if (String(file.designHeadDecision || "").toUpperCase() !== "APPROVED") {
        const reviewResponse = await matflowApi.reviewDesignHead(file.id, {
          decision: "APPROVE",
          remarks: "Project / PD Design work completed and approved for PPC Gate 1.",
          rowVersion: file.rowVersion,
        });
        file = reviewResponse?.data?.productionFile || file;
      }

      await matflowApi.submitDesign(file.id, { controlledReleaseReason: null, rowVersion: file.rowVersion });
      setHandoffOpen(false); setPpcOwner("");
      await Promise.all([loadDetail(selected.projectId, { quiet: true }), loadList({ quiet: true })]);
    } catch (requestError) {
      setError(readMatFlowError(requestError, "Unable to hand this Project / PD to PPC Gate 1."));
    } finally { setWorking(false); }
  };

  if (loading) return <LoadingBlock />;

  const activeCount = rows.filter((row) => !["HANDED_OFF"].includes(row.status)).length;
  const overdueCount = rows.filter((row) => row.overdue).length;
  const readyCount = rows.filter((row) => row.status === "READY_FOR_HANDOFF").length;

  return (
    <Box sx={{ ...pageSx, display: "grid", gap: 1 }}>
      <PageHero
        badge="DESIGN · PD WORKSPACE"
        title={juniorOnly ? "My PD Work" : "Design Work"}
        subtitle="One Project / PD is one Production File and one Design assignment. Products are work/subtasks inside it; the whole Project moves together to PPC and Engineering."
        actions={(
          <Box sx={{ display: "flex", gap: 0.65, alignItems: "center", flexWrap: "wrap" }}>
            <MatFlowViewToggle value={viewMode} onChange={setViewMode} options={MATFLOW_LIST_CARD_OPTIONS} />
            <Button startIcon={<RefreshOutlinedIcon />} onClick={refresh} disabled={working} sx={secondaryBtnSx}>Refresh</Button>
          </Box>
        )}
      />
      {error && <ErrorBox>{error}</ErrorBox>}

      <Card sx={{ ...panelSx, p: 1, boxShadow: "none" }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(260px,1fr) 190px" }, gap: 0.8 }}>
          <TextField size="small" label="Find Project / Client / PD / Product / Designer" value={search} onChange={(e) => setSearch(e.target.value)} sx={fieldSx} />
          <TextField select size="small" label="Work status" value={status} onChange={(e) => setStatus(e.target.value)} sx={fieldSx}>
            <MenuItem value="">All</MenuItem>
            {["UNASSIGNED", "ASSIGNED", "IN_PROGRESS", "READY_FOR_HANDOFF", "HANDED_OFF"].map((value) => <MenuItem key={value} value={value}>{readable(value)}</MenuItem>)}
          </TextField>
        </Box>
      </Card>

      <Card sx={{ ...panelSx, p: 0, boxShadow: "none", overflow: "hidden" }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", md: "repeat(4,minmax(0,1fr))" } }}>
          {[["PD assignments", rows.length], ["Active", activeCount], ["Ready for PPC", readyCount], ["Overdue", overdueCount]].map(([label, value], index) => (
            <Box key={label} sx={{ px: 1.1, py: 0.85, borderLeft: index ? "1px solid var(--mf-border)" : 0 }}>
              <Typography sx={{ fontSize: 16, fontWeight: 950, color: label === "Overdue" && value ? "var(--mf-danger-text)" : "var(--mf-text)" }}>{value}</Typography>
              <Typography sx={{ fontSize: 8.5, fontWeight: 850, color: "var(--mf-text-muted)" }}>{label}</Typography>
            </Box>
          ))}
        </Box>
      </Card>

      {!rows.length ? <Card sx={{ ...panelSx, p: 0 }}><EmptyState>No Design PD assignments match this view.</EmptyState></Card> : viewMode === "LIST" ? (
        <Card sx={{ ...panelSx, p: 0, overflow: "hidden", boxShadow: "none" }}>
          <Box sx={{ overflowX: "auto" }}>
            <Box sx={{ minWidth: 900 }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "minmax(220px,1.25fr) minmax(180px,.9fr) 150px 150px 120px", gap: 0.7, px: 1, py: 0.65, background: "var(--mf-table-head)", borderBottom: "1px solid var(--mf-border-strong)", position: "sticky", top: 0, zIndex: 1 }}>
                {["Project / PD", "Assignment", "Products", "Checklist", "Status"].map((label) => <Typography key={label} sx={{ fontSize: 8.2, fontWeight: 950, textTransform: "uppercase", color: "var(--mf-text-muted)" }}>{label}</Typography>)}
              </Box>
              {rows.map((row) => {
                const tone = statusTone(row.status, row.overdue);
                return (
                  <Box key={row.projectId} onClick={() => openPd(row.projectId)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openPd(row.projectId); } }} sx={{ px: 1, py: 0.8, display: "grid", gridTemplateColumns: "minmax(220px,1.25fr) minmax(180px,.9fr) 150px 150px 120px", gap: 0.7, alignItems: "center", cursor: "pointer", borderBottom: "1px solid var(--mf-border)", borderLeft: `3px solid ${tone.color}`, "&:hover": { background: "var(--mf-table-hover)" }, "&:last-child": { borderBottom: 0 } }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: 10.8, fontWeight: 950, color: "var(--mf-text)" }}>{row.projectName}</Typography>
                      <Typography noWrap sx={{ mt: 0.08, fontSize: 8.7, color: "var(--mf-text-muted)" }}>{row.clientName} · {displayPd(row)} · {row.productionFileNo || "Project file"}</Typography>
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: 9.7, fontWeight: 900, color: row.assignedJunior ? "var(--mf-text-secondary)" : "var(--mf-warning-text)" }}>{row.assignedJunior || "Unassigned"}</Typography>
                      <Typography noWrap sx={{ mt: 0.08, fontSize: 8.4, color: row.overdue ? "var(--mf-danger-text)" : "var(--mf-text-muted)" }}>{row.dueAt ? `Due ${formatDate(row.dueAt)}` : "No Design due date"}</Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 9.8, fontWeight: 900, color: "var(--mf-text-secondary)" }}>{row.productDone}/{row.productCount} done</Typography>
                      <Typography sx={{ fontSize: 8.4, color: "var(--mf-text-muted)" }}>{row.status === "HANDED_OFF" ? "Project handed off" : `${row.productCount - row.productDone} remaining`}</Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 9.8, fontWeight: 900, color: row.checklistReadyForHandoff ? "var(--mf-success-text)" : "var(--mf-text-secondary)" }}>{row.checklistPercent}%</Typography>
                      <Typography sx={{ fontSize: 8.4, color: "var(--mf-text-muted)" }}>{row.checklistLocked ? "Locked" : `${row.checklistPending} pending`}</Typography>
                    </Box>
                    <Box><StatusChip status={row.status} overdue={row.overdue} /></Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Card>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(2,minmax(0,1fr))" }, gap: 0.8 }}>
          {rows.map((row) => {
            const tone = statusTone(row.status, row.overdue);
            return (
              <Card key={row.projectId} onClick={() => openPd(row.projectId)} sx={{ ...panelSx, p: 1, cursor: "pointer", borderLeft: `3px solid ${tone.color}`, boxShadow: "none", "&:hover": { background: "var(--mf-table-hover)" } }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 0.8, alignItems: "flex-start" }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 11.4, fontWeight: 950, color: "var(--mf-text)" }}>{row.projectName}</Typography>
                    <Typography sx={{ mt: 0.1, fontSize: 8.8, color: "var(--mf-text-muted)" }}>{row.clientName} · {displayPd(row)}</Typography>
                  </Box>
                  <StatusChip status={row.status} overdue={row.overdue} />
                </Box>
                <Box sx={{ mt: 0.8, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 0.55 }}>
                  <Metric label="Assigned" value={row.assignedJunior || "—"} sub={row.dueAt ? `Due ${formatDate(row.dueAt)}` : "No due date"} />
                  <Metric label="Products" value={`${row.productDone}/${row.productCount}`} sub="Done" />
                  <Metric label="Checklist" value={`${row.checklistPercent}%`} sub={row.checklistLocked ? "Locked" : `${row.checklistPending} pending`} />
                </Box>
              </Card>
            );
          })}
        </Box>
      )}

      <Drawer anchor="right" open={Boolean(selectedProjectId)} onClose={closePd} PaperProps={{ sx: sidePanelPaperSx }}>
        <Box sx={sidePanelHeaderSx}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 8.2, fontWeight: 950, letterSpacing: ".06em", color: "var(--mf-primary-text)" }}>DESIGN PD WORK</Typography>
            <Typography noWrap sx={{ mt: 0.08, fontSize: 15.5, fontWeight: 950, color: "var(--mf-text)" }}>{selected?.projectName || "Project"}</Typography>
            <Typography noWrap sx={{ mt: 0.04, fontSize: 9, color: "var(--mf-text-muted)" }}>{selected ? `${selected.clientName} · ${displayPd(selected)} · ${selected.plantCode}` : "Loading…"}</Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 0.55, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {selected && canHead && selected.status !== "HANDED_OFF" && <Button size="small" startIcon={<AssignmentIndOutlinedIcon />} onClick={openAssignment} sx={secondaryBtnSx}>{selected.assignedJunior ? "Reassign" : "Assign PD"}</Button>}
            {selected && canAddProduct && selected.status !== "HANDED_OFF" && <Button size="small" startIcon={<AddOutlinedIcon />} onClick={openProductCreate} sx={primaryBtnSx}>Product</Button>}
            {selected && canHead && selected.status === "READY_FOR_HANDOFF" && <Button size="small" startIcon={<SendOutlinedIcon />} onClick={openHandoff} disabled={working} sx={primaryBtnSx}>Hand Project to PPC</Button>}
            <IconButton onClick={closePd} sx={{ color: "var(--mf-text-secondary)", border: "1px solid var(--mf-border)" }}><CloseOutlinedIcon /></IconButton>
          </Box>
        </Box>
        <Box sx={sidePanelBodySx}>
          {detailLoading || !selected ? <LoadingBlock minHeight={220} /> : (
            <>
              <Card sx={{ ...panelSx, p: 0, overflow: "hidden", boxShadow: "none" }}>
                <Box sx={{ px: 1, py: 0.85, display: "flex", justifyContent: "space-between", gap: 0.8, flexWrap: "wrap", alignItems: "center" }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 11.4, fontWeight: 950, color: "var(--mf-text)" }}>{selected.assignedJunior || "Awaiting junior assignment"}</Typography>
                    <Typography sx={{ mt: 0.08, fontSize: 8.7, color: "var(--mf-text-muted)" }}>{selected.brief || "The PD itself is the Design assignment. Products below are its work/subtasks."}</Typography>
                  </Box>
                  <StatusChip status={selected.status} overdue={selected.overdue} />
                </Box>
                <Box sx={{ p: 0.8, pt: 0, display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", md: "repeat(4,minmax(0,1fr))" }, gap: 0.6 }}>
                  <Metric label="Products" value={`${selected.productDone}/${selected.productCount}`} sub={selected.status === "HANDED_OFF" ? "Project handed off" : "Design subtasks done"} />
                  <Metric label="PD Checklist" value={`${selected.checklistPercent}%`} sub={selected.checklistLocked ? "Locked by Design Head" : `${selected.checklistPending} pending`} />
                  <Metric label="Design Due" value={selected.dueAt ? formatDate(selected.dueAt) : "Not set"} sub={selected.overdue ? "Overdue" : "PD assignment"} />
                  <Metric label="Project File" value={selected.productionFileNo || "—"} sub={readable(selected.productionFileStage || "DESIGN_DRAFT")} />
                </Box>
                {selected.status !== "HANDED_OFF" && selected.handoffBlockers?.length > 0 && (
                  <Box sx={{ px: 1, py: 0.75, borderTop: "1px solid var(--mf-border)", background: "var(--mf-warning-soft)" }}>
                    <Typography sx={{ fontSize: 8.4, fontWeight: 900, color: "var(--mf-warning-text)" }}>Project handoff pending · {selected.handoffBlockers.join(" · ")}</Typography>
                  </Box>
                )}
              </Card>

              <Card sx={{ ...panelSx, p: 0, overflow: "hidden", boxShadow: "none" }}>
                <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto" sx={{ minHeight: 40, borderBottom: "1px solid var(--mf-border)", "& .MuiTab-root": { minHeight: 40, textTransform: "none", fontWeight: 900, fontSize: 10 } }}>
                  <Tab value="overview" label="Overview" />
                  <Tab value="products" label={`Products · ${selected.productCount}`} />
                  <Tab value="checklist" label={`PD Checklist · ${selected.checklistPercent}%`} />
                  <Tab value="activity" label="Activity" />
                </Tabs>

                {tab === "overview" && (
                  <Box sx={{ p: 1, display: "grid", gap: 0.8 }}>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))" }, gap: 0.7 }}>
                      {[["Client", selected.clientName], ["PD No.", displayPd(selected)], ["Project Manager / Source", selected.projectManager || "Director Reference"], ["Design Head", selected.designHead || "—"], ["Assigned Junior", selected.assignedJunior || "—"], ["Tentative Completion", formatDate(selected.tentativeCompletionDate)]].map(([label, value]) => (
                        <Box key={label} sx={{ px: 0.9, py: 0.7, border: "1px solid var(--mf-border)", borderRadius: 1 }}>
                          <Typography sx={{ fontSize: 8.1, fontWeight: 900, color: "var(--mf-text-muted)", textTransform: "uppercase" }}>{label}</Typography>
                          <Typography sx={{ mt: 0.1, fontSize: 10, fontWeight: 850, color: "var(--mf-text-secondary)" }}>{value}</Typography>
                        </Box>
                      ))}
                    </Box>
                    <Box sx={{ px: 0.95, py: 0.8, border: "1px solid var(--mf-border)", borderRadius: 1 }}>
                      <Typography sx={{ fontSize: 8.1, fontWeight: 900, color: "var(--mf-text-muted)", textTransform: "uppercase" }}>Design brief</Typography>
                      <Typography sx={{ mt: 0.15, fontSize: 9.7, lineHeight: 1.5, color: "var(--mf-text-secondary)" }}>{selected.brief || "No Design brief added yet."}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: 8.6, color: "var(--mf-text-muted)" }}>Departmental handoff is Project-level: all Product subtasks stay inside this shared Production File and the whole Project moves to PPC Gate 1 together.</Typography>
                  </Box>
                )}

                {tab === "products" && (
                  <Box>
                    {!selected.products.length ? <EmptyState>No Products yet. Create the first Product as work begins on this PD.</EmptyState> : selected.products.map((product) => (
                      <ProductSubtaskRow
                        key={product.productId}
                        row={product}
                        canProgress={canContribute && selected.status !== "HANDED_OFF"}
                        canEdit={canAddProduct && selected.status !== "HANDED_OFF"}
                        working={working}
                        onProgress={updateProductProgress}
                        onEdit={openProductEdit}
                      />
                    ))}
                  </Box>
                )}

                {tab === "checklist" && (
                  <Box sx={{ display: "grid", gap: 0 }}>
                    <Box sx={{ px: 1, py: 0.75, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 0.7, flexWrap: "wrap", background: "var(--mf-surface)" }}>
                      <Box>
                        <Typography sx={{ fontSize: 10.2, fontWeight: 950, color: "var(--mf-text)" }}>PD Design checklist</Typography>
                        <Typography sx={{ fontSize: 8.5, color: "var(--mf-text-muted)" }}>Owned by Design Head. The whole Project / PD handoff requires the checklist to be locked and all blocking points resolved.</Typography>
                      </Box>
                      {canHead && selected.status !== "HANDED_OFF" && <Button size="small" startIcon={selected.checklistLocked ? <LockOpenOutlinedIcon /> : <LockOutlinedIcon />} onClick={toggleChecklistLock} disabled={working} sx={secondaryBtnSx}>{selected.checklistLocked ? "Unlock" : "Lock checklist"}</Button>}
                    </Box>
                    {selected.checklist.map((item) => (
                      <Box key={item.key} sx={{ px: 1, py: 0.68, display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0,1fr) 160px" }, gap: 0.7, alignItems: "center", borderTop: "1px solid var(--mf-border)" }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: 9.8, fontWeight: 850, color: "var(--mf-text-secondary)" }}>{item.title}</Typography>
                          <Typography sx={{ mt: 0.08, fontSize: 8.2, color: "var(--mf-text-muted)" }}>{item.section}{item.remarks ? ` · ${item.remarks}` : ""}</Typography>
                        </Box>
                        {canHead && !selected.checklistLocked ? (
                          <TextField select size="small" value={item.status} onChange={(e) => setChecklist(item, e.target.value)} sx={fieldSx}>
                            <MenuItem value="PENDING">Pending</MenuItem>
                            <MenuItem value="COMPLETE">Complete</MenuItem>
                            <MenuItem value="NOT_APPLICABLE">N/A</MenuItem>
                          </TextField>
                        ) : <Box sx={{ justifySelf: { xs: "start", md: "end" } }}><StatusChip status={item.status === "COMPLETE" ? "DONE" : item.status} label={item.status === "NOT_APPLICABLE" ? "N/A" : readable(item.status)} /></Box>}
                      </Box>
                    ))}
                  </Box>
                )}

                {tab === "activity" && (
                  <Box sx={{ p: 1, display: "grid", gap: 0.75 }}>
                    {canContribute && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr auto" }, gap: 0.6 }}>
                      <TextField size="small" label="Add PD work update / log" value={logText} onChange={(e) => setLogText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addLog(); } }} sx={fieldSx} />
                      <Button startIcon={<TimelineOutlinedIcon />} onClick={addLog} disabled={working || !clean(logText)} sx={primaryBtnSx}>Add update</Button>
                    </Box>}
                    {!selected.logs.length ? <EmptyState>No PD activity updates yet.</EmptyState> : selected.logs.map((log) => (
                      <Box key={log.id} sx={{ display: "grid", gridTemplateColumns: "8px minmax(0,1fr)", gap: 0.7 }}>
                        <Box sx={{ width: 8, height: 8, mt: 0.55, borderRadius: "50%", background: "var(--mf-primary)" }} />
                        <Box sx={{ pb: 0.75, borderBottom: "1px solid var(--mf-border)" }}>
                          <Typography sx={{ fontSize: 9.7, fontWeight: 850, color: "var(--mf-text-secondary)" }}>{log.message}</Typography>
                          <Typography sx={{ mt: 0.1, fontSize: 8.2, color: "var(--mf-text-muted)" }}>{log.actor || "User"} · {formatDateTime(log.at)} · {readable(log.kind)}</Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
              </Card>
            </>
          )}
        </Box>
      </Drawer>

      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Assign PD / Project</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 1, pt: "12px !important" }}>
          <TextField label="Junior Designer / Design team username" value={assignForm.assignedJunior} onChange={(e) => setAssignForm({ ...assignForm, assignedJunior: e.target.value })} sx={fieldSx} />
          <TextField type="datetime-local" InputLabelProps={{ shrink: true }} label="Design due date" value={assignForm.dueAt} onChange={(e) => setAssignForm({ ...assignForm, dueAt: e.target.value })} sx={fieldSx} />
          <TextField multiline minRows={3} label="Design brief / mail instruction" value={assignForm.brief} onChange={(e) => setAssignForm({ ...assignForm, brief: e.target.value })} sx={fieldSx} />
        </DialogContent>
        <DialogActions><Button onClick={() => setAssignOpen(false)} sx={secondaryBtnSx}>Cancel</Button><Button onClick={saveAssignment} disabled={working || !clean(assignForm.assignedJunior)} sx={primaryBtnSx}>Assign PD</Button></DialogActions>
      </Dialog>

      <Dialog open={productOpen} onClose={closeProductDialog} fullWidth maxWidth="md">
        <DialogTitle>{productEditingId ? "Edit Product / Design subtask" : "Add Product / Design subtask"}</DialogTitle>
        <DialogContent sx={{ pt: "12px !important" }}><ProductForm value={productForm} onChange={setProductForm} /></DialogContent>
        <DialogActions><Button onClick={closeProductDialog} sx={secondaryBtnSx}>Cancel</Button><Button onClick={saveProduct} disabled={working} sx={primaryBtnSx}>{productEditingId ? "Save Product" : "Add Product"}</Button></DialogActions>
      </Dialog>

      <Dialog open={handoffOpen} onClose={() => setHandoffOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Hand Project / PD to PPC Gate 1</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 1, pt: "12px !important" }}>
          <Typography sx={{ fontSize: 10, color: "var(--mf-text-secondary)" }}>All Product subtasks are complete and the PD checklist is locked. This approves the shared Project Production File and moves the whole Project to PPC Gate 1.</Typography>
          <TextField label="PPC Owner" value={ppcOwner} onChange={(e) => setPpcOwner(e.target.value)} sx={fieldSx} helperText="The PPC owner receives the whole Project / PD, not individual Products." />
        </DialogContent>
        <DialogActions><Button onClick={() => setHandoffOpen(false)} sx={secondaryBtnSx}>Cancel</Button><Button startIcon={<SendOutlinedIcon />} onClick={handoffToPpc} disabled={working || !clean(ppcOwner)} sx={primaryBtnSx}>Hand Project to PPC</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
