import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  Collapse,
  Drawer,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ExpandLessOutlinedIcon from "@mui/icons-material/ExpandLessOutlined";
import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import RadioButtonUncheckedOutlinedIcon from "@mui/icons-material/RadioButtonUncheckedOutlined";
import { useNavigate } from "react-router-dom";
import { matflowApi, readMatFlowError } from "../api/matflowApi";
import API from "../../../services/api";
import {
  ErrorBox,
  LoadingBlock,
  MATFLOW_ROLES,
  MATFLOW_LIST_CARD_OPTIONS,
  MatFlowProductIdentity,
  MatFlowViewToggle,
  MatFlowListGrid,
  PageHero,
  EmptyState,
  MatFlowStatusChip,
  pageSx,
  panelSx,
  fieldSx,
  primaryBtnSx,
  secondaryBtnSx,
  sidePanelPaperSx,
  sidePanelHeaderSx,
  sidePanelBodySx,
  dialogPaperSx,
  dialogTitleSx,
  dialogContentSx,
  dialogActionsSx,
  useMatFlow,
  useMatFlowViewMode,
  readable,
} from "../matflowUi";

const projectBlank = {
  projectCode: "",
  projectName: "",
  clientName: "",
  plantCode: "",
  requiredDate: "",
  priority: "NORMAL",
  projectManager: "",
  designer1: "",
  designHead: "",
  remarks: "",
  active: true,
  rowVersion: null,
};

const productBlank = {
  productName: "",
  productType: "",
  drawingNo: "",
  drawingRevision: "",
  unitQuantity: 1,
  requiredDate: "",
  remarks: "",
  active: true,
  rowVersion: null,
};

const cleanProjectBody = (value) => ({
  ...value,
  requiredDate: value.requiredDate || null,
});

const cleanProductBody = (value) => ({
  ...value,
  unitQuantity: Number(value.unitQuantity || 1),
  requiredDate: value.requiredDate || null,
});

const formatDate = (value) => {
  if (!value) return "—";
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const FILE_TRACK_STAGE_RANK = {
  DESIGN_DRAFT: 0,
  DESIGN_CLARIFICATION: 0,
  DESIGN_SUBMITTED: 1,
  PPC_GATE_1: 1,
  ENGINEERING_REVIEW: 2,
  ENGINEERING_QUERY: 2,
  ENGINEERING_WORK: 2,
  REVISION_REVIEW: 2,
  PPC_GATE_2: 3,
  PRODUCTION_RELEASED: 4,
};

const latestAudit = (timeline, actions) => {
  const wanted = new Set(actions);
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    if (wanted.has(String(timeline[index]?.action || "").toUpperCase())) return timeline[index];
  }
  return null;
};

const auditDetails = (event) => {
  if (!event?.detailsJson) return {};
  if (typeof event.detailsJson === "object") return event.detailsJson;
  try {
    return JSON.parse(event.detailsJson);
  } catch {
    return {};
  }
};

const buildTrackingRows = (detail, record) => {
  const timeline = Array.isArray(detail?.timeline) ? detail.timeline : [];
  const file = detail?.productionFile || {};
  const currentRank = FILE_TRACK_STAGE_RANK[String(file.stage || record.stage || "").toUpperCase()] ?? 0;

  const row = ({ key, label, actions, targetRank, fallbackAt = null, fallbackActor = "" }) => {
    const event = latestAudit(timeline, actions);
    const details = auditDetails(event);
    const at = event?.at || fallbackAt || null;
    const reachedWithoutTimestamp = !at && currentRank >= targetRank;
    const remark = details.remarks || details.controlledReleaseReason || details.note || "";
    return {
      key,
      label,
      at,
      actor: event?.actor || fallbackActor || "",
      remark,
      state: at ? "complete" : reachedWithoutTimestamp ? "historical" : "pending",
    };
  };

  return [
    row({
      key: "DESIGN_OPENED",
      label: "PD / Project file opened",
      actions: ["PRODUCTION_FILE_CREATED", "LEGACY_PRODUCTION_FILE_BACKFILLED"],
      targetRank: 0,
      fallbackAt: record.createdAt || null,
      fallbackActor: record.createdAt ? "PD / Project record" : "",
    }),
    row({
      key: "DESIGN_TO_PPC",
      label: "Design → PPC",
      actions: ["DESIGN_SUBMITTED"],
      targetRank: 1,
    }),
    row({
      key: "PPC_TO_ENGINEERING",
      label: "PPC → Engineering",
      actions: ["PPC_GATE_1_ACCEPT"],
      targetRank: 2,
    }),
    row({
      key: "ENGINEERING_TO_PPC",
      label: "Engineering → PPC",
      actions: ["ENGINEERING_TO_PPC"],
      targetRank: 3,
    }),
    row({
      key: "PPC_TO_PRODUCTION",
      label: "PPC → Production Release",
      actions: ["PPC_GATE_2_RELEASE"],
      targetRank: 4,
      fallbackAt: file.productionReleasedAt || null,
      fallbackActor: file.productionReleasedAt ? "Release record" : "",
    }),
  ];
};

function ProductFields({ value, onChange, compact = false }) {
  const set = (key, next) => onChange({ ...value, [key]: next });
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        gap: 1.05,
      }}
    >
      <TextField size={compact ? "small" : "medium"} label="Product Name" value={value.productName} onChange={(e) => set("productName", e.target.value)} sx={fieldSx} />
      <TextField size={compact ? "small" : "medium"} label="Product Type" value={value.productType || ""} onChange={(e) => set("productType", e.target.value)} sx={fieldSx} />
      <TextField size={compact ? "small" : "medium"} label="Drawing No. (Optional)" value={value.drawingNo} onChange={(e) => set("drawingNo", e.target.value)} sx={fieldSx} />
      <TextField size={compact ? "small" : "medium"} label="Current Drawing Revision" value={value.drawingRevision || ""} onChange={(e) => set("drawingRevision", e.target.value)} sx={fieldSx} />
      <TextField size={compact ? "small" : "medium"} type="number" inputProps={{ min: 1 }} label="Units" value={value.unitQuantity} onChange={(e) => set("unitQuantity", e.target.value)} sx={fieldSx} />
      <TextField size={compact ? "small" : "medium"} type="date" InputLabelProps={{ shrink: true }} label="Required Date" value={value.requiredDate || ""} onChange={(e) => set("requiredDate", e.target.value)} sx={fieldSx} />
      <TextField size={compact ? "small" : "medium"} label="Remarks" value={value.remarks || ""} onChange={(e) => set("remarks", e.target.value)} sx={fieldSx} />
    </Box>
  );
}

function Meta({ label, value }) {
  return (
    <Box sx={metaSx}>
      <Typography sx={metaLabelSx}>{label}</Typography>
      <Typography sx={metaValueSx}>{value || "—"}</Typography>
    </Box>
  );
}

function BomRevisionRow({ bom, onOpen }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "minmax(190px,1.4fr) 90px 150px minmax(120px,.8fr) auto" },
        gap: 0.8,
        alignItems: "center",
        px: 1.05,
        py: 0.85,
        borderTop: "1px solid var(--mf-border)",
        "&:first-of-type": { borderTop: "none" },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: 10.8, fontWeight: 900, color: "var(--mf-text)" }}>
          {bom.bomNumber}
        </Typography>
        <Typography sx={{ mt: 0.15, fontSize: 9, color: "var(--mf-text-muted)" }}>
          {bom.latestRevision ? "Current revision" : "Historical revision"}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 10.2, fontWeight: 850, color: "var(--mf-text-secondary)" }}>
        Rev {bom.revisionNo}
      </Typography>
      <MatFlowStatusChip status={bom.status} />
      <Typography sx={{ fontSize: 9.4, color: "var(--mf-text-muted)" }}>
        {formatDateTime(bom.updatedAt)}
      </Typography>
      <Button size="small" endIcon={<OpenInNewOutlinedIcon />} onClick={() => onOpen(bom)} sx={linkBtnSx}>
        Open BOM
      </Button>
    </Box>
  );
}

function ProductionFileTrackingSheet({ record }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(Boolean(record.productionFileId));
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!record.productionFileId) {
      setLoading(false);
      setDetail(null);
      return undefined;
    }

    setLoading(true);
    setError("");
    matflowApi
      .getProductionFile(record.productionFileId)
      .then((response) => {
        if (active) setDetail(response?.data || null);
      })
      .catch((requestError) => {
        if (active) setError(readMatFlowError(requestError, "Unable to load File Tracking history."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [record.productionFileId, record.stage, record.updatedAt]);

  const trackingRows = useMemo(() => buildTrackingRows(detail, record), [detail, record]);

  return (
    <Box sx={trackingSheetSx}>
      <Box sx={trackingHeaderSx}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.55 }}>
            <HistoryOutlinedIcon sx={{ fontSize: 15, color: "var(--mf-primary-text)" }} />
            <Typography sx={{ fontSize: 10.8, fontWeight: 950, color: "var(--mf-text)" }}>
              File Tracking
            </Typography>
          </Box>
          <Typography sx={{ mt: 0.15, fontSize: 8.9, color: "var(--mf-text-muted)" }}>
            Latest successful handoff, receiving timestamp and digital sign-off.
          </Typography>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ px: 1, py: 1.2, fontSize: 9.2, color: "var(--mf-text-muted)" }}>Loading handoff history…</Box>
      ) : error ? (
        <Box sx={{ px: 1, py: 1.1, fontSize: 9.2, color: "var(--mf-danger-text)" }}>{error}</Box>
      ) : (
        <>
          <Box sx={trackingColumnHeaderSx}>
            <Typography sx={trackingColumnLabelSx}>Department / Handoff</Typography>
            <Typography sx={trackingColumnLabelSx}>Receiving / Completed</Typography>
            <Typography sx={trackingColumnLabelSx}>Remark / Digital Sign-off</Typography>
          </Box>
          {trackingRows.map((row) => {
            const complete = row.state === "complete";
            const historical = row.state === "historical";
            return (
              <Box key={row.key} sx={trackingRowSx(row.state)}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.55, minWidth: 0 }}>
                  {complete ? (
                    <CheckCircleOutlineOutlinedIcon sx={{ fontSize: 14, color: "var(--mf-success-text)", flex: "0 0 auto" }} />
                  ) : historical ? (
                    <HistoryOutlinedIcon sx={{ fontSize: 14, color: "var(--mf-warning-text)", flex: "0 0 auto" }} />
                  ) : (
                    <RadioButtonUncheckedOutlinedIcon sx={{ fontSize: 13, color: "var(--mf-text-muted)", flex: "0 0 auto" }} />
                  )}
                  <Typography sx={{ fontSize: 9.7, fontWeight: 900, color: complete ? "var(--mf-text)" : "var(--mf-text-secondary)" }}>
                    {row.label}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: 9.2, fontWeight: complete ? 850 : 700, color: complete ? "var(--mf-text-secondary)" : historical ? "var(--mf-warning-text)" : "var(--mf-text-muted)" }}>
                  {row.at ? formatDateTime(row.at) : historical ? "Completed · earlier timestamp unavailable" : "Awaiting handoff"}
                </Typography>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 9.2, fontWeight: row.actor ? 850 : 700, color: row.actor ? "var(--mf-text-secondary)" : "var(--mf-text-muted)" }}>
                    {row.actor || "—"}
                  </Typography>
                  {row.remark && (
                    <Typography sx={{ mt: 0.08, fontSize: 8.5, color: "var(--mf-text-muted)" }}>
                      {row.remark}
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          })}
        </>
      )}

      <Typography sx={trackingFootnoteSx}>
        PD / Project Production File tracking ends at Production Release.
      </Typography>
    </Box>
  );
}

function ProjectProductionFilePanel({ project, onOpen }) {
  const [trackingOpen, setTrackingOpen] = useState(false);
  const health = String(project?.releaseHealth || "").toUpperCase();
  const hasFile = Boolean(project?.productionFileId);
  return (
    <Card sx={{ ...panelSx, p: 0, overflow: "hidden", boxShadow: "none" }}>
      <Box sx={{ px: 1, py: 0.8, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(0,1fr) auto" }, gap: 0.75, alignItems: "center" }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 8, fontWeight: 950, letterSpacing: ".055em", textTransform: "uppercase", color: "var(--mf-primary-text)" }}>PROJECT PRODUCTION FILE</Typography>
          <Box sx={{ mt: 0.18, display: "flex", gap: 0.55, alignItems: "center", flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: 11.2, fontWeight: 950, color: "var(--mf-text)" }}>{project?.productionFileNo || "Initializing…"}</Typography>
            {hasFile && <Chip size="small" label={readable(project.stage || "DESIGN_DRAFT")} sx={{ ...softChipSx, height: 20, fontSize: 8.3 }} />}
            {healthLabel(health) && <Typography sx={{ fontSize: 8.5, fontWeight: 900, color: ticketHealthColor(health) }}>{healthLabel(health)}</Typography>}
          </Box>
          <Typography sx={{ mt: 0.12, fontSize: 8.6, color: "var(--mf-text-muted)" }}>One workflow identity for the whole PD / Project. Products and Product BOMs remain children inside this file.</Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 0.45, flexWrap: "wrap", justifyContent: { xs: "flex-start", sm: "flex-end" } }}>
          <Button size="small" disabled={!hasFile} onClick={() => setTrackingOpen((value) => !value)} startIcon={<HistoryOutlinedIcon />} sx={secondaryBtnSx}>{trackingOpen ? "Hide tracking" : "Tracking"}</Button>
          <Button size="small" disabled={!hasFile} endIcon={<OpenInNewOutlinedIcon />} onClick={() => onOpen(project)} sx={primaryBtnSx}>Open Workflow</Button>
        </Box>
      </Box>
      <Collapse in={trackingOpen && hasFile} unmountOnExit>
        <Box sx={{ p: 0.7, pt: 0, borderTop: "1px solid var(--mf-border)" }}>
          <ProductionFileTrackingSheet record={project} />
        </Box>
      </Collapse>
    </Card>
  );
}

function ProductMasterRow({ project, product, boms, canEdit, canPermanentDelete, selectedForDelete, showEngineering, onEdit, onImage, onOpenBom, onPermanentDelete, onToggleDeleteSelection }) {
  const [expanded, setExpanded] = useState(false);
  const currentBom = boms.find((bom) => bom.latestRevision) || boms[0] || null;

  return (
    <Box sx={{ border: "1px solid var(--mf-border)", borderRadius: 1.05, background: "var(--mf-panel-solid)", overflow: "hidden" }}>
      <Box sx={productHeaderSx}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.55, minWidth: 0, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: 11.2, fontWeight: 950, color: "var(--mf-text)" }}>{product.productName || "Unnamed Product"}</Typography>
            {product.productType && <Chip label={product.productType} size="small" sx={{ ...softChipSx, height: 19, fontSize: 8.2 }} />}
            {showEngineering && currentBom && <MatFlowStatusChip status={currentBom.status} />}
          </Box>
          <Typography sx={{ mt: 0.14, fontSize: 8.6, color: "var(--mf-text-muted)" }}>
            Drawing {product.drawingNo || "Not assigned"}{product.drawingRevision ? ` · Rev ${product.drawingRevision}` : ""} · {product.unitQuantity || 1} unit{Number(product.unitQuantity || 1) === 1 ? "" : "s"}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.35 }}>
          {canPermanentDelete && (
            <Checkbox
              size="small"
              checked={Boolean(selectedForDelete)}
              onClick={(event) => event.stopPropagation()}
              onChange={() => onToggleDeleteSelection?.(product.id)}
              inputProps={{ "aria-label": `Select ${product.productName || "Product"} for permanent delete` }}
              sx={{ p: 0.35, color: "var(--mf-text-muted)", "&.Mui-checked": { color: "var(--mf-danger-text)" } }}
            />
          )}
          <Button
            size="small"
            endIcon={expanded ? <ExpandLessOutlinedIcon /> : <ExpandMoreOutlinedIcon />}
            onClick={() => setExpanded((value) => !value)}
            sx={{ ...secondaryBtnSx, minWidth: 0, px: 0.8, py: 0.35, fontSize: 9 }}
          >
            {expanded ? "Less" : "Details"}
          </Button>
        </Box>
      </Box>

      <Collapse in={expanded} unmountOnExit>
        <Box sx={productExpandedSx}>
          <Box sx={productInfoGridSx}>
            <Meta label="Required" value={formatDate(product.requiredDate || project.requiredDate)} />
            <Meta label="Units" value={product.unitQuantity || 1} />
            <Meta label="Remarks" value={product.remarks || "—"} />
          </Box>

          {(canEdit || canPermanentDelete) && (
            <Box sx={productUtilityRowSx}>
              {canEdit && <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => onEdit(project, product)} sx={secondaryBtnSx}>Edit Product</Button>}
              {canEdit && (
                <Button size="small" component="label" startIcon={<ImageOutlinedIcon />} sx={secondaryBtnSx}>
                  {product.productImageAvailable ? "Replace Image" : "Attach Image"}
                  <input hidden type="file" accept="image/*" onChange={(event) => onImage(project, product, event.target.files?.[0])} />
                </Button>
              )}
              {canPermanentDelete && (
                <Button
                  size="small"
                  startIcon={<DeleteOutlineOutlinedIcon />}
                  onClick={() => onPermanentDelete({ kind: "PRODUCT", project, product })}
                  sx={{ ...secondaryBtnSx, color: "var(--mf-danger-text)", borderColor: "var(--mf-danger-border)", background: "var(--mf-danger-soft)" }}
                >
                  Permanent Delete
                </Button>
              )}
            </Box>
          )}

          {showEngineering && (
            <Box sx={bomPanelSx}>
              <Box sx={panelTopRowSx}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={panelEyebrowSx}>PRODUCT ENGINEERING BOM</Typography>
                  <Typography sx={{ mt: 0.18, fontSize: 10.8, fontWeight: 950, color: "var(--mf-text)" }}>{currentBom ? currentBom.bomNumber : "No BOM yet"}</Typography>
                  <Typography sx={{ mt: 0.08, fontSize: 8.6, color: "var(--mf-text-muted)" }}>
                    {currentBom ? `Rev ${currentBom.revisionNo} · ${boms.length} revision${boms.length === 1 ? "" : "s"}` : "Created by Engineering for this Product inside the shared Project file."}
                  </Typography>
                </Box>
                {currentBom ? <MatFlowStatusChip status={currentBom.status} /> : null}
              </Box>
              {currentBom ? (
                <Button size="small" endIcon={<OpenInNewOutlinedIcon />} onClick={() => onOpenBom(currentBom)} sx={{ ...secondaryBtnSx, mt: 0.55 }}>Open BOM</Button>
              ) : null}
            </Box>
          )}

          {showEngineering && boms.length > 1 && (
            <Box sx={bomHistorySx}>
              <Box sx={{ px: 1, py: 0.65, display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap", borderBottom: "1px solid var(--mf-border)" }}>
                <Typography sx={{ fontSize: 9.7, fontWeight: 900, color: "var(--mf-text-secondary)" }}>Earlier BOM revisions</Typography>
                <Typography sx={{ fontSize: 8.4, color: "var(--mf-text-muted)" }}>{boms.length} total</Typography>
              </Box>
              {boms.map((bom) => <BomRevisionRow key={bom.id} bom={bom} onOpen={onOpenBom} />)}
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

export function MatFlowProjectsPage() {
  const { selectedPlantParam, availablePlants, hasRole } = useMatFlow();
  const navigate = useNavigate();
  const juniorDesignerOnly = hasRole(MATFLOW_ROLES.DESIGNER_JUNIOR)
    && !hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.DIRECTOR, MATFLOW_ROLES.DESIGN_HEAD, MATFLOW_ROLES.DESIGNER);
  const canProjectWrite = hasRole(
    MATFLOW_ROLES.ADMIN,
    MATFLOW_ROLES.MANAGER,
    MATFLOW_ROLES.DESIGN_HEAD,
    MATFLOW_ROLES.DESIGNER,
    MATFLOW_ROLES.DESIGNER_JUNIOR,
    MATFLOW_ROLES.ENGINEERING_HEAD,
    MATFLOW_ROLES.ENGINEERING
  );
  const canChooseJuniorDesigner = hasRole(
    MATFLOW_ROLES.ADMIN,
    MATFLOW_ROLES.MANAGER,
    MATFLOW_ROLES.DESIGN_HEAD
  );
  const canPermanentDelete = hasRole(MATFLOW_ROLES.ADMIN);

  const canSeeEngineeringReference = hasRole(
    MATFLOW_ROLES.ADMIN,
    MATFLOW_ROLES.MANAGER,
    MATFLOW_ROLES.DIRECTOR,
    MATFLOW_ROLES.ENGINEERING_HEAD,
    MATFLOW_ROLES.ENGINEERING
  );

  const [viewMode, setViewMode] = useMatFlowViewMode("projects", "LIST");
  const [rows, setRows] = useState([]);
  const [boms, setBoms] = useState([]);
  const [bomsLoaded, setBomsLoaded] = useState(!canSeeEngineeringReference);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState("");
  const [activeProject, setActiveProject] = useState(null);
  const [projectForm, setProjectForm] = useState(projectBlank);
  const [productForms, setProductForms] = useState([productBlank]);
  const [editProduct, setEditProduct] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [juniorDesignerOptions, setJuniorDesignerOptions] = useState([]);
  const [juniorDesignerLoading, setJuniorDesignerLoading] = useState(false);
  const [juniorDesignerError, setJuniorDesignerError] = useState("");
  const [clientOptions, setClientOptions] = useState([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [clientCreateOpen, setClientCreateOpen] = useState(false);
  const [clientCreateForm, setClientCreateForm] = useState({ name: "", address: "" });
  const [clientCreateError, setClientCreateError] = useState("");
  const [clientCreating, setClientCreating] = useState(false);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState(null);
  const [permanentDeleteConfirm, setPermanentDeleteConfirm] = useState("");
  const [selectedProjectDeleteIds, setSelectedProjectDeleteIds] = useState([]);
  const [selectedProductDeleteIds, setSelectedProductDeleteIds] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const projectsResponse = await matflowApi.listProjects({ active: true, plantCode: selectedPlantParam });
      setRows(Array.isArray(projectsResponse?.data) ? projectsResponse.data : []);
    } catch (requestError) {
      setError(readMatFlowError(requestError, "Unable to load MatFlow Projects."));
    } finally {
      setLoading(false);
    }
  }, [selectedPlantParam]);

  const loadBoms = useCallback(async ({ reportError = false } = {}) => {
    if (!canSeeEngineeringReference) {
      setBoms([]);
      setBomsLoaded(true);
      return;
    }
    try {
      const response = await matflowApi.listBoms();
      setBoms(Array.isArray(response?.data) ? response.data : []);
    } catch (requestError) {
      if (reportError) setError(readMatFlowError(requestError, "Unable to load Engineering BOM references."));
    } finally {
      setBomsLoaded(true);
    }
  }, [canSeeEngineeringReference]);

  const refresh = useCallback(async () => {
    matflowApi.clearReadCache();
    setBomsLoaded(!canSeeEngineeringReference);
    await Promise.all([load(), loadBoms({ reportError: true })]);
  }, [load, loadBoms, canSeeEngineeringReference]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let live = true;
    const plantCode = String(projectForm.plantCode || "").trim();
    if (!canChooseJuniorDesigner || !dialog.startsWith("project") || !plantCode) {
      setJuniorDesignerOptions([]);
      setJuniorDesignerError("");
      return undefined;
    }

    setJuniorDesignerLoading(true);
    setJuniorDesignerError("");
    API.get("/matflow/users/junior-designers", { params: { plantCode } })
      .then((response) => {
        if (!live) return;
        const usernames = (Array.isArray(response?.data) ? response.data : [])
          .map((row) => String(row?.username || "").trim())
          .filter(Boolean);
        setJuniorDesignerOptions(Array.from(new Set(usernames)));
      })
      .catch((requestError) => {
        if (!live) return;
        setJuniorDesignerOptions([]);
        setJuniorDesignerError(readMatFlowError(requestError, "Unable to load Junior Designers."));
      })
      .finally(() => { if (live) setJuniorDesignerLoading(false); });

    return () => { live = false; };
  }, [canChooseJuniorDesigner, dialog, projectForm.plantCode]);

  useEffect(() => {
    let live = true;
    let timer = null;
    const query = String(projectForm.clientName || "").trim();
    if (!dialog.startsWith("project") || query.length < 2) {
      setClientOptions([]);
      setClientLoading(false);
      return undefined;
    }

    setClientLoading(true);
    timer = window.setTimeout(() => {
      API.get("/client-master/search", { params: { q: query, limit: 20 } })
        .then((response) => {
          if (!live) return;
          setClientOptions(Array.isArray(response?.data) ? response.data : []);
        })
        .catch(() => { if (live) setClientOptions([]); })
        .finally(() => { if (live) setClientLoading(false); });
    }, 220);

    return () => {
      live = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [dialog, projectForm.clientName]);

  useEffect(() => {
    if (!canSeeEngineeringReference) {
      setBoms([]);
      setBomsLoaded(true);
      return undefined;
    }

    // Projects are the primary screen data. Engineering BOM references are warmed
    // just after first paint so they do not hold the entire Projects page hostage.
    setBomsLoaded(false);
    const timer = window.setTimeout(() => loadBoms(), 450);
    return () => window.clearTimeout(timer);
  }, [canSeeEngineeringReference, selectedPlantParam, loadBoms]);

  useEffect(() => {
    if (selectedProjectId && canSeeEngineeringReference && !bomsLoaded) loadBoms();
  }, [selectedProjectId, canSeeEngineeringReference, bomsLoaded, loadBoms]);

  const bomsByProduct = useMemo(() => {
    const result = new Map();
    for (const bom of boms) {
      if (!bom.productId) continue;
      if (!result.has(bom.productId)) result.set(bom.productId, []);
      result.get(bom.productId).push(bom);
    }
    for (const list of result.values()) {
      list.sort((a, b) => {
        if (Boolean(a.latestRevision) !== Boolean(b.latestRevision)) return a.latestRevision ? -1 : 1;
        return Number(b.revisionNo || 0) - Number(a.revisionNo || 0);
      });
    }
    return result;
  }, [boms]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((project) => {
      const projectValues = [
        project.projectCode,
        project.projectName,
        project.clientName,
        project.plantCode,
        project.projectManager,
        project.designer1,
        project.designHead,
        project.productionFileNo,
        project.stage,
        project.releaseHealth,
      ];
      if (projectValues.some((value) => String(value || "").toLowerCase().includes(query))) return true;

      return (project.products || []).some((product) => {
        const productBoms = bomsByProduct.get(product.id) || [];
        const values = [
          product.productName,
          product.productType,
          product.drawingNo,
          product.drawingRevision,
          ...(canSeeEngineeringReference ? productBoms.flatMap((bom) => [bom.bomNumber, bom.status, bom.revisionNo]) : []),
        ];
        return values.some((value) => String(value || "").toLowerCase().includes(query));
      });
    });
  }, [rows, search, bomsByProduct, canSeeEngineeringReference]);

  const summary = useMemo(() => {
    const products = filteredRows.flatMap((project) => project.products || []);
    const sharedFiles = new Map();
    for (const project of filteredRows) {
      if (project.productionFileId) sharedFiles.set(project.productionFileId, project);
    }
    const productsWithBom = canSeeEngineeringReference
      ? products.filter((product) => (bomsByProduct.get(product.id) || []).length > 0).length
      : 0;
    const inDesign = Array.from(sharedFiles.values()).filter((file) =>
      ["DESIGN_DRAFT", "DESIGN_CLARIFICATION", "DESIGN_SUBMITTED"].includes(file.stage)
    ).length;
    return {
      projects: filteredRows.length,
      products: products.length,
      productionFiles: sharedFiles.size,
      productsWithBom,
      inDesign,
      clients: new Set(filteredRows.map((project) => project.clientName).filter(Boolean)).size,
    };
  }, [filteredRows, bomsByProduct, canSeeEngineeringReference]);

  const selectedProject = useMemo(
    () => rows.find((project) => project.id === selectedProjectId) || null,
    [rows, selectedProjectId]
  );

  const visibleProjectIds = useMemo(
    () => filteredRows.map((project) => project.id).filter(Boolean),
    [filteredRows]
  );
  const visibleSelectedProjectCount = visibleProjectIds.filter((idValue) => selectedProjectDeleteIds.includes(idValue)).length;
  const allVisibleProjectsSelected = Boolean(visibleProjectIds.length)
    && visibleSelectedProjectCount === visibleProjectIds.length;

  useEffect(() => {
    const valid = new Set(rows.map((project) => project.id));
    setSelectedProjectDeleteIds((current) => current.filter((idValue) => valid.has(idValue)));
  }, [rows]);

  useEffect(() => {
    if (!selectedProjectId || !selectedProject) {
      setSelectedProductDeleteIds([]);
      return;
    }
    const valid = new Set((selectedProject.products || []).map((product) => product.id));
    setSelectedProductDeleteIds((current) => current.filter((idValue) => valid.has(idValue)));
  }, [selectedProjectId, selectedProject]);

  const openProjectDetails = (project) => setSelectedProjectId(project?.id || "");
  const closeProjectDetails = () => setSelectedProjectId("");

  const run = async (fn) => {
    setWorking(true);
    setError("");
    try {
      await fn();
      return true;
    } catch (requestError) {
      setError(readMatFlowError(requestError));
      return false;
    } finally {
      setWorking(false);
    }
  };

  const openNewProject = () => {
    setActiveProject(null);
    setProjectForm({ ...projectBlank, plantCode: selectedPlantParam || availablePlants?.[0] || "" });
    setDialog("project-new");
  };

  const openEditProject = (project) => {
    setActiveProject(project);
    setProjectForm({
      projectCode: project.projectCode || "",
      projectName: project.projectName || "",
      clientName: project.clientName || "",
      plantCode: project.plantCode || "",
      requiredDate: project.requiredDate || "",
      priority: project.priority || "NORMAL",
      projectManager: project.projectManager || "",
      designer1: project.designer1 || "",
      designHead: project.designHead || "",
      remarks: project.remarks || "",
      active: project.active !== false,
      rowVersion: project.rowVersion,
    });
    setDialog("project-edit");
  };

  const saveProject = async () => {
    const editing = dialog === "project-edit";
    const projectId = activeProject?.id;
    const ok = await run(async () => {
      if (editing) await matflowApi.updateProject(projectId, cleanProjectBody(projectForm));
      else await matflowApi.createProject(cleanProjectBody(projectForm));
    });
    if (ok) {
      setDialog("");
      setActiveProject(null);
      await refresh();
    }
  };

  const saveClientFromProject = async () => {
    const name = String(clientCreateForm.name || "").trim();
    if (!name) {
      setClientCreateError("Client Name is required.");
      return;
    }
    setClientCreating(true);
    setClientCreateError("");
    try {
      const response = await API.post("/client-master", {
        name,
        address: String(clientCreateForm.address || "").trim(),
        active: true,
      });
      const created = response?.data || { name, address: clientCreateForm.address || "" };
      const createdName = String(created?.name || name).trim();
      setClientOptions((current) => {
        const next = [created, ...current.filter((row) => String(row?.name || "").toLowerCase() !== createdName.toLowerCase())];
        return next;
      });
      setProjectForm((current) => ({ ...current, clientName: createdName }));
      setClientCreateOpen(false);
      setClientCreateForm({ name: "", address: "" });
    } catch (requestError) {
      setClientCreateError(readMatFlowError(requestError, "Unable to create Client."));
    } finally {
      setClientCreating(false);
    }
  };

  const openBulkProducts = (project) => {
    setActiveProject(project);
    setProductForms([{ ...productBlank, requiredDate: project?.requiredDate || "" }]);
    setDialog("products-add");
  };

  const saveProducts = async () => {
    if (!activeProject) return;
    const valid = productForms.filter(
      (product) => String(product.productName || "").trim()
    );
    if (!valid.length) {
      setError("Add at least one Product Name.");
      return;
    }
    const ok = await run(() => matflowApi.addProjectProducts(activeProject.id, valid.map(cleanProductBody)));
    if (ok) {
      const projectId = activeProject.id;
      setDialog("");
      setSelectedProjectId(projectId);
      setActiveProject(null);
      await refresh();
    }
  };

  const openProductEdit = (project, product) => {
    setActiveProject(project);
    setEditProduct({ ...product, requiredDate: product.requiredDate || "", remarks: product.remarks || "" });
    setDialog("product-edit");
  };

  const saveProductEdit = async () => {
    if (!activeProject || !editProduct) return;
    const ok = await run(() =>
      matflowApi.updateProjectProduct(activeProject.id, editProduct.id, cleanProductBody(editProduct))
    );
    if (ok) {
      setDialog("");
      setEditProduct(null);
      setActiveProject(null);
      await refresh();
    }
  };

  const uploadImage = async (project, product, file) => {
    if (!file) return;
    const ok = await run(() => matflowApi.uploadProductImage(project.id, product.id, file));
    if (ok) await refresh();
  };

  const openProjectProductionFile = (project) => {
    if (!project?.productionFileId) return;
    navigate(`/matflow/work?fileId=${project.productionFileId}`);
  };

  const openDesignPd = (project) => {
    if (!project?.id) return;
    navigate(`/matflow/work?designPd=1&projectId=${project.id}`);
  };

  const openBom = (bom) => navigate(`/matflow/boms/${bom.id}`);

  const toggleProjectDeleteSelection = (projectId) => {
    if (!canPermanentDelete || !projectId) return;
    setSelectedProjectDeleteIds((current) => current.includes(projectId)
      ? current.filter((idValue) => idValue !== projectId)
      : [...current, projectId]);
  };

  const toggleVisibleProjectDeleteSelection = () => {
    if (!canPermanentDelete || !visibleProjectIds.length) return;
    setSelectedProjectDeleteIds((current) => {
      const next = new Set(current);
      if (allVisibleProjectsSelected) visibleProjectIds.forEach((idValue) => next.delete(idValue));
      else visibleProjectIds.forEach((idValue) => next.add(idValue));
      return Array.from(next);
    });
  };

  const toggleProductDeleteSelection = (productId) => {
    if (!canPermanentDelete || !productId) return;
    setSelectedProductDeleteIds((current) => current.includes(productId)
      ? current.filter((idValue) => idValue !== productId)
      : [...current, productId]);
  };

  const toggleAllProductsForDelete = () => {
    if (!canPermanentDelete || !selectedProject) return;
    const ids = (selectedProject.products || []).map((product) => product.id).filter(Boolean);
    const allSelected = ids.length > 0 && ids.every((idValue) => selectedProductDeleteIds.includes(idValue));
    setSelectedProductDeleteIds(allSelected ? [] : ids);
  };

  const openBulkProjectDelete = () => {
    if (!canPermanentDelete || !selectedProjectDeleteIds.length) return;
    setPermanentDeleteConfirm("");
    setPermanentDeleteTarget({ kind: "PROJECT_BULK", projectIds: [...selectedProjectDeleteIds] });
  };

  const openBulkProductDelete = () => {
    if (!canPermanentDelete || !selectedProject || !selectedProductDeleteIds.length) return;
    setPermanentDeleteConfirm("");
    setPermanentDeleteTarget({
      kind: "PRODUCT_BULK",
      project: selectedProject,
      productIds: [...selectedProductDeleteIds],
    });
  };

  const openPermanentDelete = (target) => {
    if (!canPermanentDelete || !target) return;
    setPermanentDeleteConfirm("");
    setPermanentDeleteTarget(target);
  };

  const closePermanentDelete = () => {
    if (working) return;
    setPermanentDeleteTarget(null);
    setPermanentDeleteConfirm("");
  };

  const confirmPermanentDelete = async () => {
    const target = permanentDeleteTarget;
    if (!canPermanentDelete || !target || permanentDeleteConfirm.trim().toUpperCase() !== "DELETE") return;

    const ok = await run(async () => {
      if (target.kind === "PROJECT") {
        await matflowApi.permanentlyDeleteProject(target.project.id);
      } else if (target.kind === "PRODUCT") {
        await matflowApi.permanentlyDeleteProjectProduct(target.project.id, target.product.id);
      } else if (target.kind === "PROJECT_BULK") {
        await matflowApi.permanentlyDeleteProjects(target.projectIds);
      } else if (target.kind === "PRODUCT_BULK") {
        await matflowApi.permanentlyDeleteProjectProducts(target.project.id, target.productIds);
      }
    });

    if (ok) {
      const deletingProjectId = target.project?.id;
      if (target.kind === "PROJECT" && selectedProjectId === deletingProjectId) closeProjectDetails();
      if (target.kind === "PROJECT_BULK") {
        if (target.projectIds.includes(selectedProjectId)) closeProjectDetails();
        setSelectedProjectDeleteIds([]);
      }
      if (target.kind === "PRODUCT_BULK") setSelectedProductDeleteIds([]);
      setPermanentDeleteTarget(null);
      setPermanentDeleteConfirm("");
      await refresh();
    }
  };

  if (loading && !rows.length) return <LoadingBlock />;

  return (
    <Box sx={pageSx}>
      <PageHero
        badge="MASTER PD / PROJECT PRODUCTION FILE"
        title={juniorDesignerOnly ? "My PD / Projects" : "Projects"}
        subtitle={juniorDesignerOnly ? "Create and manage your own PD / Projects. Each one is automatically assigned to you and remains visible to the Design Head for tracking and control." : (canSeeEngineeringReference ? "One Production File per PD / Project. Products and drawings are child work inside the same departmental handoff." : "PD / Project workflow with child Product / Drawing context and one shared Production File.")}
        actions={
          <Box sx={{ display: "flex", gap: 0.8, flexWrap: "wrap", alignItems: "center" }}>
            <MatFlowViewToggle value={viewMode} onChange={setViewMode} options={MATFLOW_LIST_CARD_OPTIONS} />
            <Button startIcon={<RefreshOutlinedIcon />} onClick={refresh} disabled={loading} sx={secondaryBtnSx}>
              Refresh
            </Button>
            {canProjectWrite && (
              <Button startIcon={<AddOutlinedIcon />} onClick={openNewProject} sx={primaryBtnSx}>
                New Project
              </Button>
            )}
          </Box>
        }
      />

      {error && <ErrorBox>{error}</ErrorBox>}

      <Card sx={{ ...panelSx, p: 1.25 }}>
        <TextField
          size="small"
          fullWidth
          label={canSeeEngineeringReference ? "Search Product / PD No. / project / drawing / Project File / BOM" : "Search Product Name / PD No. / client / project / drawing"}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={fieldSx}
        />
      </Card>

      {canPermanentDelete && filteredRows.length > 0 && (
        <Card sx={{ ...panelSx, p: 0.8, display: "flex", alignItems: "center", gap: 0.6, flexWrap: "wrap", borderColor: selectedProjectDeleteIds.length ? "var(--mf-danger-border)" : "var(--mf-border)" }}>
          <Checkbox
            size="small"
            checked={allVisibleProjectsSelected}
            indeterminate={visibleSelectedProjectCount > 0 && !allVisibleProjectsSelected}
            onChange={toggleVisibleProjectDeleteSelection}
            inputProps={{ "aria-label": "Select all visible PD / Projects for permanent delete" }}
            sx={{ p: 0.35, color: "var(--mf-text-muted)", "&.Mui-checked, &.MuiCheckbox-indeterminate": { color: "var(--mf-danger-text)" } }}
          />
          <Typography sx={{ fontSize: 9.2, fontWeight: 900, color: selectedProjectDeleteIds.length ? "var(--mf-danger-text)" : "var(--mf-text-secondary)" }}>
            {selectedProjectDeleteIds.length ? `${selectedProjectDeleteIds.length} PD / Project${selectedProjectDeleteIds.length === 1 ? "" : "s"} selected` : "ADMIN multi-select permanent delete"}
          </Typography>
          <Box sx={{ ml: { xs: 0, sm: "auto" }, display: "flex", gap: 0.5, flexWrap: "wrap" }}>
            {selectedProjectDeleteIds.length > 0 && <Button size="small" onClick={() => setSelectedProjectDeleteIds([])} sx={secondaryBtnSx}>Clear</Button>}
            <Button
              size="small"
              disabled={!selectedProjectDeleteIds.length || working}
              startIcon={<DeleteOutlineOutlinedIcon />}
              onClick={openBulkProjectDelete}
              sx={{ ...secondaryBtnSx, color: "var(--mf-danger-text)", borderColor: "var(--mf-danger-border)", background: selectedProjectDeleteIds.length ? "var(--mf-danger-soft)" : undefined }}
            >
              Delete Selected{selectedProjectDeleteIds.length ? ` (${selectedProjectDeleteIds.length})` : ""}
            </Button>
          </Box>
        </Card>
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" }, gap: 1 }}>
        <Summary label={juniorDesignerOnly ? "My PDs" : "Projects"} value={summary.projects} />
        <Summary label={juniorDesignerOnly ? "My Products" : "Products / Drawings"} value={summary.products} />
        <Summary label="Project Files" value={summary.productionFiles} />
        {juniorDesignerOnly
          ? <Summary label="Clients" value={summary.clients} />
          : canSeeEngineeringReference
            ? <Summary label="Products with BOM" value={`${summary.productsWithBom}/${summary.products}`} />
            : <Summary label="In Design" value={summary.inDesign} />}
      </Box>

      {!filteredRows.length ? (
        <Card sx={{ ...panelSx, p: 0 }}>
          <EmptyState>No projects found.</EmptyState>
        </Card>
      ) : viewMode === "LIST" ? (
        <Box sx={{ display: "grid", gap: 1 }}>
          <MatFlowListGrid
            columns={[
              ...(canPermanentDelete ? [{ key: "select", label: "", width: "48px", align: "center" }] : []),
              { key: "pd", label: "PD No.", width: "125px" },
              { key: "project", label: "Project / Client", width: "minmax(220px,1.08fr)" },
              { key: "products", label: "Products / Project File", width: "160px" },
              { key: "workflow", label: "Workflow / Health", width: "minmax(230px,1fr)" },
              { key: "completion", label: "Tentative Completion", width: "145px" },
              { key: "owner", label: "Director Ref. / Designer", width: "180px" },
              { key: "actions", label: "", width: "100px", align: "right" },
            ]}
            rows={filteredRows}
            minWidth={canPermanentDelete ? 1128 : 1080}
            getRowKey={(project) => project.id}
            onRowClick={(project) => openProjectDetails(project)}
            rowAriaLabel={(project) => `Open PD ${project.projectCode || "Project"} details`}
            rowSx={(project) => selectedProjectDeleteIds.includes(project.id)
              ? { background: "var(--mf-danger-soft)", "&:hover": { background: "var(--mf-danger-soft)" } }
              : selectedProjectId === project.id
                ? { background: "var(--mf-primary-soft)", "&:hover": { background: "var(--mf-primary-soft)" } }
                : {}}
            rowAccent={(project) => {
              const health = String(project.releaseHealth || "").toUpperCase();
              if (health === "RED") return "var(--mf-danger-text)";
              if (health === "AMBER") return "var(--mf-warning-text)";
              if (health === "GREEN") return "var(--mf-success-text)";
              return "transparent";
            }}
            renderCell={(project, column) => {
              const products = project.products || [];
              const sharedFile = project.productionFileId ? project : null;
              const productionFiles = sharedFile ? [sharedFile] : [];
              const stageCounts = new Map(sharedFile ? [[sharedFile.stage || "NOT_STARTED", 1]] : []);
              const healthValues = sharedFile ? [String(sharedFile.releaseHealth || "").toUpperCase()] : [];
              const projectHealth = healthValues.includes("RED") ? "RED" : healthValues.includes("AMBER") ? "AMBER" : healthValues.includes("GREEN") && healthValues.length ? "GREEN" : "PENDING";
              const bomCount = products.reduce((total, product) => total + (bomsByProduct.get(product.id) || []).length, 0);
              const productsWithBom = products.filter((product) => (bomsByProduct.get(product.id) || []).length > 0).length;
              if (column.key === "select") return (
                <Box onClick={(event) => event.stopPropagation()} sx={{ display: "flex", justifyContent: "center" }}>
                  <Checkbox
                    size="small"
                    checked={selectedProjectDeleteIds.includes(project.id)}
                    onChange={() => toggleProjectDeleteSelection(project.id)}
                    inputProps={{ "aria-label": `Select PD ${project.projectCode || project.projectName || "Project"} for permanent delete` }}
                    sx={{ p: 0.35, color: "var(--mf-text-muted)", "&.Mui-checked": { color: "var(--mf-danger-text)" } }}
                  />
                </Box>
              );
              if (column.key === "pd") return <Box><Typography sx={{ fontSize: 10.7, fontWeight: 950, color: "var(--mf-text)" }}>{project.projectCode || "Not assigned"}</Typography><Typography sx={{ mt: 0.08, fontSize: 8.7, color: "var(--mf-text-muted)" }}>{project.plantCode || "No plant"}</Typography></Box>;
              if (column.key === "project") return <Box><Typography noWrap sx={{ fontSize: 10.4, fontWeight: 900, color: "var(--mf-text)" }}>{project.projectName || "Unnamed Project"}</Typography><Typography noWrap sx={{ mt: 0.08, fontSize: 9, color: "var(--mf-text-secondary)" }}>{project.clientName || "Client not assigned"}</Typography></Box>;
              if (column.key === "products") return <Box><Typography sx={{ fontSize: 10.2, fontWeight: 900, color: "var(--mf-text)" }}>{products.length} product{products.length === 1 ? "" : "s"}</Typography><Typography sx={{ mt: 0.08, fontSize: 8.8, color: "var(--mf-text-muted)" }}>{productionFiles.length ? "Project file active" : "Project file pending"}{canSeeEngineeringReference ? ` · ${productsWithBom}/${products.length || 0} with BOM · ${bomCount} rev` : ""}</Typography></Box>;
              if (column.key === "workflow") return <Box><Box sx={{ display: "flex", gap: 0.35, flexWrap: "wrap" }}>{Array.from(stageCounts.entries()).slice(0, 2).map(([stageName, count]) => <Chip key={stageName} label={`${readable(stageName)} · ${count}`} size="small" sx={softChipSx} />)}{!stageCounts.size && <Typography sx={{ fontSize: 9.5, color: "var(--mf-text-muted)" }}>Project file pending</Typography>}</Box><Typography sx={{ mt: 0.25, fontSize: 8.7, fontWeight: 900, color: ticketHealthColor(projectHealth) }}>{healthLabel(projectHealth)}</Typography></Box>;
              if (column.key === "completion") return <Typography sx={{ fontSize: 9.7, fontWeight: 800, color: project.requiredDate ? "var(--mf-text-secondary)" : "var(--mf-text-muted)" }}>{project.requiredDate ? formatDate(project.requiredDate) : "Not set"}</Typography>;
              if (column.key === "owner") return <Box><Typography noWrap sx={{ fontSize: 9.7, fontWeight: 850, color: "var(--mf-text-secondary)" }}>{project.projectManager || "—"}</Typography><Typography noWrap sx={{ mt: 0.08, fontSize: 8.8, color: "var(--mf-text-muted)" }}>{project.designer1 || "Designer not assigned"}</Typography></Box>;
              return <Box onClick={(event) => event.stopPropagation()} sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Button size="small" endIcon={<OpenInNewOutlinedIcon />} onClick={() => openProjectDetails(project)} sx={secondaryBtnSx}>View</Button>
              </Box>;
            }}
          />

        </Box>
      ) : (
        <Box sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(auto-fit,minmax(300px,1fr))" },
          gap: 0.8,
          alignItems: "stretch",
        }}>
          {filteredRows.map((project) => {
            const products = project.products || [];
            const sharedFile = project.productionFileId ? project : null;
            const productionFiles = sharedFile ? [sharedFile] : [];
            const productsWithBom = products.filter((product) => (bomsByProduct.get(product.id) || []).length > 0).length;
            const healthValues = sharedFile ? [String(sharedFile.releaseHealth || "").toUpperCase()] : [];
            const projectHealth = healthValues.includes("RED")
              ? "RED"
              : healthValues.includes("AMBER")
                ? "AMBER"
                : healthValues.includes("GREEN") && healthValues.length
                  ? "GREEN"
                  : "PENDING";
            const visibleProducts = products.slice(0, 2);
            const owner = project.projectManager || project.designer1 || "Unassigned";

            return (
              <Card key={project.id} sx={{ ...ticketCardSx(projectHealth), borderColor: selectedProjectDeleteIds.includes(project.id) ? "var(--mf-danger-border)" : undefined }}>
                <Box sx={ticketTopSx}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ display: "flex", gap: 0.55, alignItems: "center", minWidth: 0 }}>
                      <Typography sx={{ fontSize: 8, fontWeight: 950, letterSpacing: ".07em", color: "var(--mf-primary-text)", whiteSpace: "nowrap" }}>
                        PD {project.projectCode || "Not assigned"}
                      </Typography>
                      <Typography sx={{ fontSize: 8, color: "var(--mf-text-muted)" }}>·</Typography>
                      <Typography noWrap sx={{ fontSize: 8.3, fontWeight: 800, color: "var(--mf-text-muted)" }}>{project.plantCode || "No plant"}</Typography>
                    </Box>
                    <Typography noWrap sx={{ mt: 0.25, fontSize: 12.8, lineHeight: 1.12, fontWeight: 950, color: "var(--mf-text)" }}>
                      {project.projectName || "Unnamed Project"}
                    </Typography>
                    <Typography noWrap sx={{ mt: 0.12, fontSize: 8.8, color: "var(--mf-text-secondary)" }}>
                      {project.clientName || "Client not assigned"}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.45, flex: "0 0 auto" }}>
                    {canPermanentDelete && (
                      <Checkbox
                        size="small"
                        checked={selectedProjectDeleteIds.includes(project.id)}
                        onChange={() => toggleProjectDeleteSelection(project.id)}
                        inputProps={{ "aria-label": `Select PD ${project.projectCode || project.projectName || "Project"} for permanent delete` }}
                        sx={{ p: 0.3, color: "var(--mf-text-muted)", "&.Mui-checked": { color: "var(--mf-danger-text)" } }}
                      />
                    )}
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", background: ticketHealthColor(projectHealth) }} />
                    <Typography sx={{ fontSize: 8.3, fontWeight: 900, color: ticketHealthColor(projectHealth), whiteSpace: "nowrap" }}>
                      {healthLabel(projectHealth) || "Pending"}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={ticketMetaGridSx}>
                  <TicketMeta label="Products" value={products.length} />
                  <TicketMeta label="Project File" value={productionFiles.length ? readable(project.stage || "Active") : "Pending"} />
                  <TicketMeta label="Tentative" value={project.requiredDate ? formatDate(project.requiredDate) : "Not set"} />
                  <TicketMeta label="Owner" value={owner} />
                </Box>

                <Box sx={{ px: 0.85, pb: 0.7, display: "grid", gap: 0.38, flex: 1 }}>
                  {!visibleProducts.length ? (
                    <Box sx={ticketEmptyFileSx}>No Products yet. The PD / Project Production File still remains the workflow identity.</Box>
                  ) : (
                    visibleProducts.map((product) => {
                      const productBoms = bomsByProduct.get(product.id) || [];
                      const currentBom = productBoms.find((bom) => bom.latestRevision) || productBoms[0] || null;
                      return (
                        <Box
                          key={product.id}
                          sx={{
                            px: 0.62, py: 0.5, display: "grid", gridTemplateColumns: "minmax(0,1fr) auto",
                            gap: 0.55, minHeight: 38, alignItems: "center", border: "1px solid var(--mf-border)",
                            borderRadius: 0.9, background: "var(--mf-surface)",
                          }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography noWrap sx={{ fontSize: 9.6, fontWeight: 900, color: "var(--mf-text)" }}>{product.productName || "Unnamed Product"}</Typography>
                            <Typography noWrap sx={{ mt: 0.05, fontSize: 7.9, color: "var(--mf-text-muted)" }}>
                              DWG {product.drawingNo || "Not assigned"}{product.drawingRevision ? ` · Rev ${product.drawingRevision}` : ""}
                            </Typography>
                          </Box>
                          {canSeeEngineeringReference && currentBom ? <MatFlowStatusChip status={currentBom.status} /> : <Typography sx={{ fontSize: 7.9, color: "var(--mf-text-muted)" }}>{product.productType || "Product"}</Typography>}
                        </Box>
                      );
                    })
                  )}
                  {products.length > visibleProducts.length && (
                    <Typography sx={{ px: 0.15, pt: 0.05, fontSize: 8, fontWeight: 850, color: "var(--mf-primary-text)" }}>
                      + {products.length - visibleProducts.length} more product{products.length - visibleProducts.length === 1 ? "" : "s"}
                    </Typography>
                  )}
                </Box>

                <Box sx={ticketActionsSx}>
                  <Typography sx={{ mr: "auto", fontSize: 8, color: "var(--mf-text-muted)", whiteSpace: "nowrap" }}>
                    {canSeeEngineeringReference ? `${productsWithBom}/${products.length || 0} with BOM` : `${readable(project.priority || "NORMAL")} priority`}
                  </Typography>
                  {canProjectWrite && <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => openEditProject(project)} sx={{ ...secondaryBtnSx, px: 0.75 }}>Edit</Button>}
                  {canPermanentDelete && <Button size="small" startIcon={<DeleteOutlineOutlinedIcon />} onClick={() => openPermanentDelete({ kind: "PROJECT", project })} sx={{ ...secondaryBtnSx, px: 0.75, color: "var(--mf-danger-text)", borderColor: "var(--mf-danger-border)" }}>Delete</Button>}
                  {canProjectWrite && <Button size="small" startIcon={<AddOutlinedIcon />} onClick={() => openBulkProducts(project)} sx={{ ...primaryBtnSx, px: 0.75 }}>Add</Button>}
                  <Button size="small" disabled={!project.productionFileId} endIcon={<OpenInNewOutlinedIcon />} onClick={() => openProjectProductionFile(project)} sx={{ ...secondaryBtnSx, px: 0.8 }}>Workflow</Button>
                  <Button size="small" endIcon={<OpenInNewOutlinedIcon />} onClick={() => openProjectDetails(project)} sx={{ ...secondaryBtnSx, px: 0.8 }}>Details</Button>
                </Box>
              </Card>
            );
          })}
        </Box>
      )}

      <Drawer
        anchor="right"
        open={Boolean(selectedProject)}
        onClose={closeProjectDetails}
        PaperProps={{
          sx: {
            ...sidePanelPaperSx,
            width: {
              xs: "100vw",
              sm: "min(94vw, 700px)",
              md: "min(78vw, 790px)",
              lg: "min(62vw, 860px)",
              xl: "min(54vw, 900px)",
            },
          },
        }}
      >
        {selectedProject && (
          <>
            <Box sx={sidePanelHeaderSx}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 8.8, fontWeight: 950, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--mf-primary-text)" }}>PD / PROJECT DETAIL</Typography>
                <Typography noWrap sx={{ mt: 0.12, fontSize: 14.5, fontWeight: 950, color: "var(--mf-text)" }}>
                  {selectedProject.projectCode ? `PD ${selectedProject.projectCode}` : "PD No. not assigned"} · {selectedProject.projectName || "Unnamed Project"}
                </Typography>
                <Typography noWrap sx={{ mt: 0.08, fontSize: 9, color: "var(--mf-text-muted)" }}>
                  {selectedProject.clientName || "Client not assigned"} · {selectedProject.plantCode || "No plant"}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", gap: 0.55, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {canProjectWrite && <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => openEditProject(selectedProject)} sx={secondaryBtnSx}>Edit PD</Button>}
                {canPermanentDelete && <Button size="small" startIcon={<DeleteOutlineOutlinedIcon />} onClick={() => openPermanentDelete({ kind: "PROJECT", project: selectedProject })} sx={{ ...secondaryBtnSx, color: "var(--mf-danger-text)", borderColor: "var(--mf-danger-border)", background: "var(--mf-danger-soft)" }}>Permanent Delete</Button>}
                {canProjectWrite && <Button size="small" startIcon={<AddOutlinedIcon />} onClick={() => openBulkProducts(selectedProject)} sx={primaryBtnSx}>Add Product</Button>}
                <Button size="small" disabled={!selectedProject.productionFileId} endIcon={<OpenInNewOutlinedIcon />} onClick={() => openProjectProductionFile(selectedProject)} sx={secondaryBtnSx}>Open PD / Project File</Button>
                <IconButton aria-label="Close project details" onClick={closeProjectDetails} sx={{ color: "var(--mf-text-secondary)", border: "1px solid var(--mf-border)" }}>
                  <CloseOutlinedIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>

            <Box className="mf-side-panel-scroll" sx={sidePanelBodySx}>
              <Card sx={{ ...panelSx, p: 0.8, boxShadow: "none" }}>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(118px,1fr))", gap: 0.5 }}>
                  <Meta label="Priority" value={selectedProject.priority || "NORMAL"} />
                  <Meta label="Tentative Completion" value={selectedProject.requiredDate ? formatDate(selectedProject.requiredDate) : "Not set"} />
                  <Meta label="Director Reference" value={selectedProject.projectManager || "—"} />
                  <Meta label={juniorDesignerOnly ? "Assigned Junior" : "Designer"} value={selectedProject.designer1 || (juniorDesignerOnly ? "You" : "—")} />
                  <Meta label="Design Head" value={selectedProject.designHead || "—"} />
                </Box>
                {selectedProject.remarks && (
                  <Typography sx={{ mt: 0.8, fontSize: 9.5, color: "var(--mf-text-muted)" }}>Project remarks: {selectedProject.remarks}</Typography>
                )}
              </Card>

              <ProjectProductionFilePanel project={selectedProject} onOpen={openProjectProductionFile} />

              <Card sx={{ ...panelSx, p: 0, overflow: "hidden", boxShadow: "none" }}>
                <Box sx={{ px: 1.15, py: 0.9, borderBottom: "1px solid var(--mf-border)", display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                  <Box>
                    <Typography sx={{ fontSize: 11.2, fontWeight: 950, color: "var(--mf-text)" }}>Products</Typography>
                    <Typography sx={{ mt: 0.06, fontSize: 8.5, color: "var(--mf-text-muted)" }}>Products are child work inside this PD / Project. The Production File and departmental handoff belong to the whole Project; BOMs remain Product-specific.</Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.45, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <Typography sx={{ fontSize: 9, fontWeight: 850, color: "var(--mf-text-muted)" }}>{(selectedProject.products || []).length} product{(selectedProject.products || []).length === 1 ? "" : "s"}</Typography>
                    {canPermanentDelete && (selectedProject.products || []).length > 0 && (
                      <>
                        <Button size="small" onClick={toggleAllProductsForDelete} sx={{ ...secondaryBtnSx, px: 0.7 }}>
                          {(selectedProject.products || []).every((product) => selectedProductDeleteIds.includes(product.id)) ? "Clear Products" : "Select All Products"}
                        </Button>
                        <Button
                          size="small"
                          disabled={!selectedProductDeleteIds.length || working}
                          startIcon={<DeleteOutlineOutlinedIcon />}
                          onClick={openBulkProductDelete}
                          sx={{ ...secondaryBtnSx, px: 0.7, color: "var(--mf-danger-text)", borderColor: "var(--mf-danger-border)", background: selectedProductDeleteIds.length ? "var(--mf-danger-soft)" : undefined }}
                        >
                          Delete Selected{selectedProductDeleteIds.length ? ` (${selectedProductDeleteIds.length})` : ""}
                        </Button>
                      </>
                    )}
                  </Box>
                </Box>
                <Box sx={{ p: 0.75 }}>
                  {!(selectedProject.products || []).length ? (
                    <EmptyState>No products added.</EmptyState>
                  ) : (
                    <Box sx={{ display: "grid", gap: 0.55 }}>
                      {(selectedProject.products || []).map((product) => juniorDesignerOnly ? (
                        <Box key={product.id} sx={{ p: 0.75, border: "1px solid var(--mf-border)", borderRadius: 1.1, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(0,1fr) auto auto" }, gap: 0.65, alignItems: "center", background: "var(--mf-panel-solid)" }}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography noWrap sx={{ fontSize: 10.3, fontWeight: 950, color: "var(--mf-text)" }}>{product.productName || "Unnamed Product"}</Typography>
                            <Typography noWrap sx={{ mt: 0.06, fontSize: 8.3, color: "var(--mf-text-muted)" }}>DWG {product.drawingNo || "Not assigned"}{product.drawingRevision ? ` · Rev ${product.drawingRevision}` : ""}</Typography>
                          </Box>
                          <Typography sx={{ fontSize: 8.8, color: "var(--mf-text-secondary)" }}>Due {formatDate(product.requiredDate || selectedProject.requiredDate)}</Typography>
                          <Button size="small" onClick={() => openDesignPd(selectedProject)} sx={primaryBtnSx}>Open PD Work</Button>
                        </Box>
                      ) : (
                        <ProductMasterRow
                          key={product.id}
                          project={selectedProject}
                          product={product}
                          boms={bomsByProduct.get(product.id) || []}
                          canEdit={canProjectWrite}
                          canPermanentDelete={canPermanentDelete}
                          selectedForDelete={selectedProductDeleteIds.includes(product.id)}
                          showEngineering={canSeeEngineeringReference}
                          onEdit={openProductEdit}
                          onImage={uploadImage}
                          onOpenBom={openBom}
                          onPermanentDelete={openPermanentDelete}
                          onToggleDeleteSelection={toggleProductDeleteSelection}
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              </Card>
            </Box>
          </>
        )}
      </Drawer>

      <Dialog
        open={dialog === "project-new" || dialog === "project-edit"}
        onClose={() => !working && setDialog("")}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: dialogPaperSx }}
      >
        <DialogTitle sx={dialogTitleSx}>
          {dialog === "project-edit" ? "Edit Project / PD" : "Create Project / PD"}
          <IconButton onClick={() => setDialog("")} sx={{ float: "right" }}>
            <CloseOutlinedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.2, pt: 0.5 }}>
            <TextField label="PD No. / Project Code (Optional)" value={projectForm.projectCode} onChange={(e) => setProjectForm({ ...projectForm, projectCode: e.target.value })} sx={fieldSx} />
            <TextField label="Project Name" value={projectForm.projectName} onChange={(e) => setProjectForm({ ...projectForm, projectName: e.target.value })} sx={fieldSx} />
            <Autocomplete
              freeSolo
              options={clientOptions}
              loading={clientLoading}
              value={clientOptions.find((row) => String(row?.name || "").toLowerCase() === String(projectForm.clientName || "").toLowerCase()) || projectForm.clientName || null}
              inputValue={projectForm.clientName || ""}
              getOptionLabel={(option) => typeof option === "string" ? option : String(option?.name || "")}
              isOptionEqualToValue={(option, value) => String(option?.id || option?.name || "") === String(value?.id || value?.name || value || "")}
              filterOptions={(options, params) => {
                const result = [...options];
                const typed = String(params.inputValue || "").trim();
                const exact = options.some((row) => String(row?.name || "").trim().toLowerCase() === typed.toLowerCase());
                if (typed && !exact && canProjectWrite) {
                  result.push({ id: `__create__:${typed}`, name: `Create client “${typed}”`, inputValue: typed, __create: true });
                }
                return result;
              }}
              onInputChange={(_event, value, reason) => {
                if (reason === "input" || reason === "clear") {
                  setProjectForm((current) => ({ ...current, clientName: value }));
                }
              }}
              onChange={(_event, value) => {
                if (!value) {
                  setProjectForm((current) => ({ ...current, clientName: "" }));
                  return;
                }
                if (typeof value === "string") {
                  setProjectForm((current) => ({ ...current, clientName: value }));
                  return;
                }
                if (value.__create) {
                  setClientCreateForm({ name: value.inputValue || "", address: "" });
                  setClientCreateError("");
                  setClientCreateOpen(true);
                  return;
                }
                setProjectForm((current) => ({ ...current, clientName: value.name || "" }));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Client"
                  helperText="Search the shared Client Directory. Type a new name and choose Create client to add it without leaving this PD."
                  sx={fieldSx}
                />
              )}
            />
            <TextField
              select
              label="Plant"
              value={projectForm.plantCode}
              onChange={(e) => setProjectForm((current) => ({
                ...current,
                plantCode: e.target.value,
                designer1: dialog === "project-new" && canChooseJuniorDesigner ? "" : current.designer1,
              }))}
              sx={fieldSx}
            >
              {(availablePlants || []).map((plant) => (
                <MenuItem key={plant} value={plant}>{plant}</MenuItem>
              ))}
            </TextField>
            <TextField
              type="date"
              InputLabelProps={{ shrink: true }}
              label="Tentative Completion Date (Optional)"
              value={projectForm.requiredDate || ""}
              onChange={(e) => setProjectForm({ ...projectForm, requiredDate: e.target.value })}
              helperText="Optional — leave blank if the Project completion date is not yet committed."
              sx={fieldSx}
            />
            <TextField
              label="Director Reference"
              placeholder="Enter Director reference"
              value={projectForm.projectManager || ""}
              onChange={(e) => setProjectForm({ ...projectForm, projectManager: e.target.value })}
              helperText="Free-text reference entered for this PD / Project. 'Director Reference' is never saved as a default value."
              sx={fieldSx}
            />
            {juniorDesignerOnly ? (
              <Box sx={{ px: 1.2, py: 1, border: "1px solid var(--mf-border)", borderRadius: 1.1, background: "var(--mf-surface)" }}>
                <Typography sx={{ fontSize: 8.4, fontWeight: 950, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--mf-text-muted)" }}>Design Owner</Typography>
                <Typography sx={{ mt: 0.15, fontSize: 10.2, fontWeight: 900, color: "var(--mf-text)" }}>You · automatic self-assignment</Typography>
                <Typography sx={{ mt: 0.1, fontSize: 8.8, color: "var(--mf-text-muted)" }}>A Junior Designer can create a Project / PD only for their own account. The Design Head can still view, track and edit it.</Typography>
              </Box>
            ) : canChooseJuniorDesigner ? (
              <TextField
                select
                label="Junior Designer / Design Owner"
                value={projectForm.designer1 || ""}
                onChange={(e) => setProjectForm({ ...projectForm, designer1: e.target.value })}
                disabled={dialog === "project-edit" || juniorDesignerLoading}
                helperText={dialog === "project-edit"
                  ? "Use the Design PD workspace to reassign an existing Project / PD."
                  : (juniorDesignerError || "Choose an enabled FlowSuite Junior Designer with MATFLOW access for this Plant.")}
                sx={fieldSx}
              >
                <MenuItem value=""><em>Unassigned</em></MenuItem>
                {projectForm.designer1 && !juniorDesignerOptions.includes(projectForm.designer1) && (
                  <MenuItem value={projectForm.designer1} disabled>
                    {projectForm.designer1} (not currently eligible for this Plant)
                  </MenuItem>
                )}
                {!juniorDesignerOptions.length && !juniorDesignerLoading && <MenuItem disabled value="__NONE__">No Junior Designers available for this Plant</MenuItem>}
                {juniorDesignerOptions.map((username) => <MenuItem key={username} value={username}>{username}</MenuItem>)}
              </TextField>
            ) : (
              <Box sx={{ px: 1.2, py: 1, border: "1px solid var(--mf-border)", borderRadius: 1.1, background: "var(--mf-surface)" }}>
                <Typography sx={{ fontSize: 8.4, fontWeight: 950, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--mf-text-muted)" }}>Junior Designer / Design Owner</Typography>
                <Typography sx={{ mt: 0.15, fontSize: 9.2, color: "var(--mf-text-secondary)" }}>Design Head assigns the Junior Designer from the FlowSuite user directory.</Typography>
              </Box>
            )}
            {!juniorDesignerOnly && <TextField label="Design Head" value={projectForm.designHead || ""} onChange={(e) => setProjectForm({ ...projectForm, designHead: e.target.value })} sx={fieldSx} />}
            <TextField label="Remarks" multiline minRows={2} value={projectForm.remarks || ""} onChange={(e) => setProjectForm({ ...projectForm, remarks: e.target.value })} sx={{ ...fieldSx, gridColumn: { md: "1/-1" } }} />
          </Box>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={() => setDialog("")} sx={secondaryBtnSx}>Cancel</Button>
          <Button disabled={working} onClick={saveProject} sx={primaryBtnSx}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={clientCreateOpen} onClose={() => !clientCreating && setClientCreateOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle sx={dialogTitleSx}>Create Client</DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Box sx={{ display: "grid", gap: 1, pt: 0.5 }}>
            <TextField label="Client Name" value={clientCreateForm.name} onChange={(e) => setClientCreateForm((current) => ({ ...current, name: e.target.value }))} sx={fieldSx} />
            <TextField label="Address (Optional)" multiline minRows={2} value={clientCreateForm.address} onChange={(e) => setClientCreateForm((current) => ({ ...current, address: e.target.value }))} sx={fieldSx} />
            {clientCreateError && <Typography sx={{ fontSize: 9.2, color: "var(--mf-danger-text)" }}>{clientCreateError}</Typography>}
          </Box>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={() => setClientCreateOpen(false)} disabled={clientCreating} sx={secondaryBtnSx}>Cancel</Button>
          <Button onClick={saveClientFromProject} disabled={clientCreating || !String(clientCreateForm.name || "").trim()} sx={primaryBtnSx}>{clientCreating ? "Creating..." : "Create & Select"}</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(permanentDeleteTarget)}
        onClose={closePermanentDelete}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: dialogPaperSx }}
      >
        <DialogTitle sx={dialogTitleSx}>ADMIN · Permanent Delete</DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Box sx={{ display: "grid", gap: 1, pt: 0.5 }}>
            <Typography sx={{ fontSize: 11.5, lineHeight: 1.6, color: "var(--mf-danger-text)", fontWeight: 850 }}>
              This action is irreversible.
            </Typography>
            <Typography sx={{ fontSize: 10.5, lineHeight: 1.6, color: "var(--mf-text-secondary)" }}>
              {permanentDeleteTarget?.kind === "PROJECT"
                ? `PD / Project ${permanentDeleteTarget?.project?.projectCode || permanentDeleteTarget?.project?.projectName || "selected record"} will be permanently removed together with its Products, current and legacy BOMs, Production File workflow records, revisions/attachments and MatFlow audit/history that depends on it.`
                : permanentDeleteTarget?.kind === "PROJECT_BULK"
                  ? `${permanentDeleteTarget?.projectIds?.length || 0} selected PD / Projects will be permanently removed in one transaction together with their Products, current and legacy BOMs, Production File workflow records, revisions/attachments and dependent MatFlow history.`
                  : permanentDeleteTarget?.kind === "PRODUCT_BULK"
                    ? `${permanentDeleteTarget?.productIds?.length || 0} selected Products inside ${permanentDeleteTarget?.project?.projectCode || permanentDeleteTarget?.project?.projectName || "this PD / Project"} will be permanently removed in one transaction together with all current and legacy BOM revisions and Product-specific MatFlow history.`
                    : `Product ${permanentDeleteTarget?.product?.productName || "selected record"} will be permanently removed together with all current and legacy BOM revisions and Product-specific MatFlow history.`}
            </Typography>
            <Typography sx={{ fontSize: 9.4, color: "var(--mf-text-muted)" }}>Shared masters such as Users, Client Directory, Plants and Materials are not deleted.</Typography>
            <TextField
              label='Type DELETE to confirm'
              value={permanentDeleteConfirm}
              onChange={(event) => setPermanentDeleteConfirm(event.target.value)}
              autoComplete="off"
              sx={fieldSx}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={closePermanentDelete} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
          <Button
            onClick={confirmPermanentDelete}
            disabled={working || permanentDeleteConfirm.trim().toUpperCase() !== "DELETE"}
            startIcon={<DeleteOutlineOutlinedIcon />}
            sx={{ ...secondaryBtnSx, color: "var(--mf-danger-text)", borderColor: "var(--mf-danger-border)", background: "var(--mf-danger-soft)" }}
          >
            {working
              ? "Deleting..."
              : permanentDeleteTarget?.kind === "PROJECT_BULK"
                ? `Permanently Delete ${permanentDeleteTarget?.projectIds?.length || 0} Projects`
                : permanentDeleteTarget?.kind === "PRODUCT_BULK"
                  ? `Permanently Delete ${permanentDeleteTarget?.productIds?.length || 0} Products`
                  : "Permanently Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={dialog === "products-add"}
        onClose={() => !working && setDialog("")}
        fullWidth
        maxWidth="lg"
        PaperProps={{ sx: dialogPaperSx }}
      >
        <DialogTitle sx={dialogTitleSx}>
          Add Multiple Products · {activeProject?.projectCode || activeProject?.projectName || "Project"}
        </DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Typography sx={{ mb: 1.2, fontSize: 10.5, color: "var(--mf-text-muted)" }}>
            All Products remain children of this one PD / Project Production File. Adding Products does not create additional Production Files or additional departmental handoffs. PD No. may also be assigned later.
          </Typography>
          <Box sx={{ display: "grid", gap: 1 }}>
            {productForms.map((row, index) => (
              <Card key={index} sx={{ ...panelSx, p: 1.3 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 950, color: "var(--mf-text)" }}>Product {index + 1}</Typography>
                  {productForms.length > 1 && (
                    <IconButton size="small" onClick={() => setProductForms((values) => values.filter((_, itemIndex) => itemIndex !== index))}>
                      <DeleteOutlineOutlinedIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
                <ProductFields compact value={row} onChange={(next) => setProductForms((values) => values.map((item, itemIndex) => itemIndex === index ? next : item))} />
              </Card>
            ))}
          </Box>
          <Button sx={{ mt: 1, ...secondaryBtnSx }} startIcon={<AddOutlinedIcon />} onClick={() => setProductForms((values) => [...values, { ...productBlank, requiredDate: activeProject?.requiredDate || "" }])}>
            Add another product
          </Button>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={() => setDialog("")} sx={secondaryBtnSx}>Cancel</Button>
          <Button disabled={working} onClick={saveProducts} sx={primaryBtnSx}>
            Create {productForms.length} Product{productForms.length === 1 ? "" : "s"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={dialog === "product-edit"}
        onClose={() => !working && setDialog("")}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: dialogPaperSx }}
      >
        <DialogTitle sx={dialogTitleSx}>Edit Product</DialogTitle>
        <DialogContent sx={dialogContentSx}>
          {editProduct && <Box sx={{ pt: 0.5 }}><ProductFields value={editProduct} onChange={setEditProduct} /></Box>}
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={() => setDialog("")} sx={secondaryBtnSx}>Cancel</Button>
          <Button disabled={working} onClick={saveProductEdit} sx={primaryBtnSx}>Save Product</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function Summary({ label, value }) {
  return (
    <Card sx={{ ...panelSx, p: 1.2 }}>
      <Typography sx={{ fontSize: 8.9, fontWeight: 900, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--mf-text-muted)" }}>
        {label}
      </Typography>
      <Typography sx={{ mt: 0.3, fontSize: 18, fontWeight: 950, color: "var(--mf-text)" }}>
        {value}
      </Typography>
    </Card>
  );
}

function TicketMeta({ label, value }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: 6.9, fontWeight: 950, letterSpacing: ".055em", color: "var(--mf-text-muted)" }}>{label.toUpperCase()}</Typography>
      <Typography noWrap sx={{ mt: 0.06, fontSize: 8.8, fontWeight: 850, color: "var(--mf-text-secondary)" }}>{value || "—"}</Typography>
    </Box>
  );
}

const ticketHealthColor = (health) => ({
  RED: "var(--mf-danger-text)",
  AMBER: "var(--mf-warning-text)",
  GREEN: "var(--mf-success-text)",
}[String(health || "").toUpperCase()] || "var(--mf-border-strong)");

const ticketHealthSoft = (health) => ({
  RED: "var(--mf-danger-soft)",
  AMBER: "var(--mf-warning-soft)",
  GREEN: "var(--mf-success-soft)",
}[String(health || "").toUpperCase()] || "var(--mf-panel-solid)");

const healthLabel = (health) => ({
  RED: "Critical attention",
  AMBER: "Needs attention",
  GREEN: "On track",
}[String(health || "").toUpperCase()] || "");

const ticketCardSx = (health) => ({
  ...panelSx,
  position: "relative",
  p: 0,
  overflow: "hidden",
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  borderRadius: 1.2,
  borderLeft: `3px solid ${ticketHealthColor(health)}`,
  boxShadow: `inset 14px 0 24px -30px ${ticketHealthColor(health)}`,
  transition: "border-color .15s ease, box-shadow .15s ease, transform .15s ease",
  "&:hover": { borderColor: "var(--mf-card-border-hover)", transform: "translateY(-1px)" },
});

const ticketTopSx = {
  px: 0.9,
  pt: 0.75,
  pb: 0.55,
  minHeight: 56,
  display: "flex",
  justifyContent: "space-between",
  gap: 0.7,
  alignItems: "flex-start",
  background: "var(--mf-panel-solid)",
};

const ticketEyebrowSx = {
  fontSize: 7.2,
  fontWeight: 950,
  letterSpacing: ".07em",
  color: "var(--mf-primary-text)",
};

const ticketPerforationSx = { display: "none" };

const ticketMetaGridSx = {
  mx: 0.85,
  mb: 0.55,
  px: 0.7,
  py: 0.5,
  display: "grid",
  gridTemplateColumns: "repeat(4,minmax(0,1fr))",
  gap: 0.55,
  borderRadius: 1,
  border: "1px solid var(--mf-border)",
  background: "var(--mf-surface)",
};

const ticketFileRowSx = (health) => ({
  px: 0.62,
  py: 0.48,
  display: "grid",
  gridTemplateColumns: "minmax(0,1fr) auto",
  gap: 0.55,
  minHeight: 38,
  alignItems: "center",
  border: "1px solid var(--mf-border)",
  borderLeft: `3px solid ${ticketHealthColor(health)}`,
  borderRadius: 0.9,
  background: ticketHealthSoft(health),
  cursor: "pointer",
  transition: "border-color .15s ease, background .15s ease",
  "&:hover": { borderColor: ticketHealthColor(health) },
  "&:focus-visible": { outline: "2px solid var(--mf-primary)", outlineOffset: 1 },
});

const ticketEmptyFileSx = {
  p: 0.65,
  minHeight: 38,
  border: "1px dashed var(--mf-border-strong)",
  borderRadius: 0.9,
  fontSize: 8.4,
  color: "var(--mf-text-muted)",
  background: "var(--mf-surface)",
};

const ticketActionsSx = {
  px: 0.85,
  py: 0.5,
  mt: "auto",
  minHeight: 40,
  display: "flex",
  flexWrap: "wrap",
  gap: 0.4,
  alignItems: "center",
  borderTop: "1px solid var(--mf-border)",
  background: "var(--mf-panel-solid)",
};

const projectHeaderSx = {
  p: 1.35,
  display: "flex",
  justifyContent: "space-between",
  alignItems: { xs: "flex-start", md: "center" },
  flexDirection: { xs: "column", md: "row" },
  gap: 1,
  background: "var(--mf-panel-solid)",
};

const toggleSx = {
  width: 30,
  height: 30,
  borderRadius: 1.2,
  color: "var(--mf-text-secondary)",
  border: "1px solid var(--mf-border)",
  background: "var(--mf-surface)",
};

const projectMetaGridSx = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" },
  gap: 0.75,
};

const metaSx = {
  minWidth: 0,
  p: 0.58,
  borderRadius: 0.95,
  background: "var(--mf-surface)",
  border: "1px solid var(--mf-border)",
};

const metaLabelSx = {
  fontSize: 7.3,
  fontWeight: 900,
  letterSpacing: ".045em",
  textTransform: "uppercase",
  color: "var(--mf-text-muted)",
};

const metaValueSx = {
  mt: 0.12,
  fontSize: 9.4,
  fontWeight: 850,
  color: "var(--mf-text)",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const productCardSx = (health) => ({
  border: "1px solid var(--mf-border)",
  borderLeft: `3px solid ${ticketHealthColor(health)}`,
  borderRadius: 1.15,
  background: "var(--mf-panel-solid)",
  overflow: "hidden",
  boxShadow: `inset 14px 0 24px -30px ${ticketHealthColor(health)}`,
});

const productHeaderSx = {
  px: 0.85,
  py: 0.65,
  minHeight: 48,
  display: "flex",
  justifyContent: "space-between",
  gap: 0.65,
  alignItems: { xs: "flex-start", sm: "center" },
  flexDirection: { xs: "column", sm: "row" },
};

const productInfoGridSx = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" },
  gap: 0.5,
};

const identityGridSx = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
  gap: 0.55,
};

const productExpandedSx = {
  px: 0.75,
  pb: 0.75,
  pt: 0.2,
  display: "grid",
  gap: 0.6,
  borderTop: "1px solid var(--mf-border)",
};

const productUtilityRowSx = {
  display: "flex",
  gap: 0.45,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const productionFilePanelSx = (health) => ({
  p: 0.72,
  borderRadius: 1,
  border: "1px solid",
  borderColor: ticketHealthColor(health),
  borderLeftWidth: 3,
  background: ticketHealthSoft(health),
});

const bomPanelSx = {
  p: 0.72,
  borderRadius: 1,
  border: "1px solid var(--mf-border)",
  background: "var(--mf-surface)",
};

const panelTopRowSx = {
  display: "flex",
  justifyContent: "space-between",
  gap: 0.8,
  alignItems: "flex-start",
};

const panelEyebrowSx = {
  fontSize: 7.4,
  fontWeight: 950,
  letterSpacing: ".06em",
  color: "var(--mf-text-muted)",
};

const emptyBomSx = {
  mt: 0.9,
  p: 0.85,
  borderRadius: 1.2,
  border: "1px dashed var(--mf-border-strong)",
  color: "var(--mf-text-muted)",
  fontSize: 9.4,
  lineHeight: 1.5,
};

const bomHistorySx = {
  mx: 0,
  mb: 0,
  border: "1px solid var(--mf-border)",
  borderRadius: 1.3,
  overflow: "hidden",
  background: "var(--mf-surface)",
};

const trackingSheetSx = {
  mx: 0,
  mb: 0,
  border: "1px solid var(--mf-border)",
  borderRadius: 1.3,
  overflow: "hidden",
  background: "var(--mf-surface)",
};

const trackingHeaderSx = {
  px: 0.8,
  py: 0.6,
  borderBottom: "1px solid var(--mf-border)",
  background: "var(--mf-panel-solid)",
};

const trackingColumnHeaderSx = {
  display: { xs: "none", md: "grid" },
  gridTemplateColumns: "minmax(180px,1.15fr) minmax(180px,.9fr) minmax(140px,.75fr)",
  gap: 0.8,
  px: 1,
  py: 0.55,
  background: "var(--mf-table-head)",
  borderBottom: "1px solid var(--mf-border)",
};

const trackingColumnLabelSx = {
  fontSize: 8.2,
  fontWeight: 950,
  letterSpacing: ".045em",
  textTransform: "uppercase",
  color: "var(--mf-text-muted)",
};

const trackingRowSx = (state) => {
  const accent = state === "complete"
    ? "var(--mf-success-text)"
    : state === "historical"
      ? "var(--mf-warning-text)"
      : "var(--mf-border-strong)";
  return {
    position: "relative",
    display: "grid",
    gridTemplateColumns: { xs: "1fr", md: "minmax(180px,1.15fr) minmax(180px,.9fr) minmax(140px,.75fr)" },
    gap: { xs: 0.25, md: 0.8 },
    alignItems: "center",
    px: 0.8,
    py: 0.58,
    pl: 1,
    borderBottom: "1px solid var(--mf-border)",
    "&::before": {
      content: '""',
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
      background: accent,
    },
  };
};

const trackingFootnoteSx = {
  px: 0.8,
  py: 0.55,
  fontSize: 8.6,
  lineHeight: 1.45,
  color: "var(--mf-text-muted)",
  background: "var(--mf-panel-solid)",
};

const softChipSx = {
  height: 20,
  borderRadius: 1.1,
  fontSize: 9,
  fontWeight: 850,
  color: "var(--mf-text-secondary)",
  background: "var(--mf-surface)",
  border: "1px solid var(--mf-border)",
};

const linkBtnSx = {
  minWidth: 0,
  px: 0.5,
  py: 0.25,
  fontSize: 9.6,
  fontWeight: 850,
  color: "var(--mf-primary-text)",
  "&:hover": { background: "transparent", textDecoration: "underline" },
};
