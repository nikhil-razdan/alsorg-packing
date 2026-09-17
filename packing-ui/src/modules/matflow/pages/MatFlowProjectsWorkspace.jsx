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
import {
  ErrorBox,
  LoadingBlock,
  MATFLOW_ROLES,
  MatFlowProductIdentity,
  PageHero,
  EmptyState,
  MatFlowStatusChip,
  pageSx,
  panelSx,
  fieldSx,
  primaryBtnSx,
  secondaryBtnSx,
  dialogPaperSx,
  dialogTitleSx,
  dialogContentSx,
  dialogActionsSx,
  useMatFlow,
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
  dimensionLength: "",
  dimensionBreadth: "",
  dimensionHeight: "",
  requiredDate: "",
  remarks: "",
  active: true,
  rowVersion: null,
};

const nullableNumber = (value) =>
  value === "" || value === null || value === undefined ? null : Number(value);

const cleanProjectBody = (value) => ({
  ...value,
  requiredDate: value.requiredDate || null,
});

const cleanProductBody = (value) => ({
  ...value,
  unitQuantity: Number(value.unitQuantity || 1),
  dimensionLength: nullableNumber(value.dimensionLength),
  dimensionBreadth: nullableNumber(value.dimensionBreadth),
  dimensionHeight: nullableNumber(value.dimensionHeight),
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

const buildTrackingRows = (detail, product) => {
  const timeline = Array.isArray(detail?.timeline) ? detail.timeline : [];
  const file = detail?.productionFile || {};
  const currentRank = FILE_TRACK_STAGE_RANK[String(file.stage || product.stage || "").toUpperCase()] ?? 0;

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
      label: "Design file opened",
      actions: ["PRODUCTION_FILE_CREATED", "LEGACY_PRODUCTION_FILE_BACKFILLED"],
      targetRank: 0,
      fallbackAt: product.createdAt || null,
      fallbackActor: product.createdAt ? "Project record" : "",
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
      <TextField size={compact ? "small" : "medium"} label="Drawing No." value={value.drawingNo} onChange={(e) => set("drawingNo", e.target.value)} sx={fieldSx} />
      <TextField size={compact ? "small" : "medium"} label="Current Drawing Revision" value={value.drawingRevision || ""} onChange={(e) => set("drawingRevision", e.target.value)} sx={fieldSx} />
      <TextField size={compact ? "small" : "medium"} type="number" inputProps={{ min: 1 }} label="Units" value={value.unitQuantity} onChange={(e) => set("unitQuantity", e.target.value)} sx={fieldSx} />
      <TextField size={compact ? "small" : "medium"} type="date" InputLabelProps={{ shrink: true }} label="Required Date" value={value.requiredDate || ""} onChange={(e) => set("requiredDate", e.target.value)} sx={fieldSx} />
      <TextField size={compact ? "small" : "medium"} type="number" label="Length (mm)" value={value.dimensionLength ?? ""} onChange={(e) => set("dimensionLength", e.target.value)} sx={fieldSx} />
      <TextField size={compact ? "small" : "medium"} type="number" label="Breadth (mm)" value={value.dimensionBreadth ?? ""} onChange={(e) => set("dimensionBreadth", e.target.value)} sx={fieldSx} />
      <TextField size={compact ? "small" : "medium"} type="number" label="Height (mm)" value={value.dimensionHeight ?? ""} onChange={(e) => set("dimensionHeight", e.target.value)} sx={fieldSx} />
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

function ProductionFileTrackingSheet({ product }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(Boolean(product.productionFileId));
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!product.productionFileId) {
      setLoading(false);
      setDetail(null);
      return undefined;
    }

    setLoading(true);
    setError("");
    matflowApi
      .getProductionFile(product.productionFileId)
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
  }, [product.productionFileId, product.stage, product.updatedAt]);

  const trackingRows = useMemo(() => buildTrackingRows(detail, product), [detail, product]);

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
            {product.productName || "Unnamed Product"} · File {product.productionFileNo || "—"} · latest successful handoff is shown.
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
        File tracking ends at Production Release.
      </Typography>
    </Box>
  );
}

function ProductMasterRow({ project, product, boms, canEdit, showEngineering, onEdit, onImage, onOpenFile, onOpenBom }) {
  const currentBom = boms.find((bom) => bom.latestRevision) || boms[0] || null;

  return (
    <Box sx={productCardSx(product.releaseHealth)}>
      <Box sx={productHeaderSx}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: "flex", gap: 0.65, alignItems: "flex-start", flexWrap: "wrap" }}>
            <MatFlowProductIdentity
              productName={product.productName}
              projectCode={project.projectCode}
              productionFileNo={product.productionFileNo}
              drawingNo={product.drawingNo}
              size="md"
              sx={{ minWidth: 0, flex: "1 1 260px" }}
              projectSx={{ display: "none" }}
            />
            {product.productType && <Chip label={product.productType} size="small" sx={softChipSx} />}
          </Box>
          {product.drawingRevision && (
            <Typography sx={{ mt: 0.2, fontSize: 9.2, color: "var(--mf-text-muted)" }}>Drawing revision {product.drawingRevision}</Typography>
          )}
        </Box>

        {canEdit && (
          <Box sx={{ display: "flex", gap: 0.55, flexWrap: "wrap", justifyContent: { md: "flex-end" } }}>
            <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => onEdit(project, product)} sx={secondaryBtnSx}>
              Edit
            </Button>
            <Button size="small" component="label" startIcon={<ImageOutlinedIcon />} sx={secondaryBtnSx}>
              {product.productImageAvailable ? "Replace Image" : "Attach Image"}
              <input hidden type="file" accept="image/*" onChange={(event) => onImage(project, product, event.target.files?.[0])} />
            </Button>
          </Box>
        )}
      </Box>

      <Box sx={productInfoGridSx}>
        <Meta label="Dimensions" value={product.dimensions || "Pending"} />
        <Meta label="Units" value={product.unitQuantity || 1} />
        <Meta label="Required" value={formatDate(product.requiredDate || project.requiredDate)} />
        <Meta label="Product Remarks" value={product.remarks || "—"} />
      </Box>

      <Box sx={{ ...identityGridSx, gridTemplateColumns: showEngineering ? { xs: "1fr", lg: "1fr 1fr" } : "1fr" }}>
        <Box sx={productionFilePanelSx(product.releaseHealth)}>
          <Box sx={panelTopRowSx}>
            <Box>
              <Typography sx={panelEyebrowSx}>PRODUCTION FILE</Typography>
              <MatFlowProductIdentity
                productName={product.productName}
                projectCode={project.projectCode}
                productionFileNo={product.productionFileNo}
                drawingNo={product.drawingNo}
                size="md"
                sx={{ mt: 0.25 }}
              />
            </Box>
          </Box>
          <Box sx={{ mt: 0.9, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.7 }}>
            <Meta label="Stage" value={readable(product.stage || "NOT_STARTED")} />
            <Meta label="Drawing" value={product.drawingNo || "—"} />
          </Box>
          <Button
            fullWidth
            size="small"
            disabled={!product.productionFileId}
            endIcon={<OpenInNewOutlinedIcon />}
            onClick={() => onOpenFile(product)}
            sx={{ ...secondaryBtnSx, mt: 0.9 }}
          >
            Open Production File
          </Button>
        </Box>

        {showEngineering && (
          <Box sx={bomPanelSx}>
            <Box sx={panelTopRowSx}>
              <Box>
                <Typography sx={panelEyebrowSx}>ENGINEERING BOM</Typography>
                <Typography sx={{ mt: 0.25, fontSize: 12.2, fontWeight: 950, color: "var(--mf-text)" }}>
                  {currentBom ? currentBom.bomNumber : "No BOM yet"}
                </Typography>
              </Box>
              {currentBom ? <MatFlowStatusChip status={currentBom.status} /> : null}
            </Box>

            {currentBom ? (
              <>
                <Box sx={{ mt: 0.9, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.7 }}>
                  <Meta label="Current Revision" value={`Rev ${currentBom.revisionNo}`} />
                  <Meta label="BOM Revisions" value={boms.length} />
                </Box>
                <Button fullWidth size="small" endIcon={<OpenInNewOutlinedIcon />} onClick={() => onOpenBom(currentBom)} sx={{ ...secondaryBtnSx, mt: 0.9 }}>
                  Open BOM
                </Button>
              </>
            ) : (
              <Box sx={emptyBomSx}>No Engineering BOM has been created for this Production File.</Box>
            )}
          </Box>
        )}
      </Box>

      <ProductionFileTrackingSheet product={product} />

      {showEngineering && boms.length > 0 && (
        <Box sx={bomHistorySx}>
          <Box sx={{ px: 1.05, py: 0.8, display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 900, color: "var(--mf-text-secondary)" }}>
              BOM revision history
            </Typography>
            <Typography sx={{ fontSize: 9.2, color: "var(--mf-text-muted)" }}>
              Every revision remains attached to the same Product / Production File
            </Typography>
          </Box>
          {boms.map((bom) => (
            <BomRevisionRow key={bom.id} bom={bom} onOpen={onOpenBom} />
          ))}
        </Box>
      )}
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
    MATFLOW_ROLES.ENGINEERING_HEAD,
    MATFLOW_ROLES.ENGINEERING
  );
  const canSeeEngineeringReference = hasRole(
    MATFLOW_ROLES.ADMIN,
    MATFLOW_ROLES.MANAGER,
    MATFLOW_ROLES.DIRECTOR,
    MATFLOW_ROLES.ENGINEERING_HEAD,
    MATFLOW_ROLES.ENGINEERING
  );

  const [rows, setRows] = useState([]);
  const [boms, setBoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState("");
  const [activeProject, setActiveProject] = useState(null);
  const [projectForm, setProjectForm] = useState(projectBlank);
  const [productForms, setProductForms] = useState([productBlank]);
  const [editProduct, setEditProduct] = useState(null);
  const [expanded, setExpanded] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const projectsPromise = matflowApi.listProjects({ active: true, plantCode: selectedPlantParam });
      const bomsPromise = canSeeEngineeringReference ? matflowApi.listBoms() : Promise.resolve({ data: [] });
      const [projectsResponse, bomsResponse] = await Promise.all([projectsPromise, bomsPromise]);
      const projects = Array.isArray(projectsResponse?.data) ? projectsResponse.data : [];
      const bomRows = canSeeEngineeringReference && Array.isArray(bomsResponse?.data) ? bomsResponse.data : [];
      setRows(projects);
      setBoms(bomRows);
    } catch (requestError) {
      setError(readMatFlowError(requestError, "Unable to load MatFlow Projects."));
    } finally {
      setLoading(false);
    }
  }, [selectedPlantParam, canSeeEngineeringReference]);

  useEffect(() => {
    load();
  }, [load]);

  const bomsByFile = useMemo(() => {
    const result = new Map();
    for (const bom of boms) {
      if (!bom.productionFileId) continue;
      if (!result.has(bom.productionFileId)) result.set(bom.productionFileId, []);
      result.get(bom.productionFileId).push(bom);
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
      ];
      if (projectValues.some((value) => String(value || "").toLowerCase().includes(query))) return true;

      return (project.products || []).some((product) => {
        const productBoms = bomsByFile.get(product.productionFileId) || [];
        const values = [
          product.productName,
          product.productType,
          product.drawingNo,
          product.drawingRevision,
          product.productionFileNo,
          product.stage,
          product.releaseHealth,
          ...(canSeeEngineeringReference ? productBoms.flatMap((bom) => [bom.bomNumber, bom.status, bom.revisionNo]) : []),
        ];
        return values.some((value) => String(value || "").toLowerCase().includes(query));
      });
    });
  }, [rows, search, bomsByFile, canSeeEngineeringReference]);

  const summary = useMemo(() => {
    const products = filteredRows.flatMap((project) => project.products || []);
    const productionFiles = products.filter((product) => product.productionFileId).length;
    const productsWithBom = canSeeEngineeringReference
      ? products.filter((product) => (bomsByFile.get(product.productionFileId) || []).length > 0).length
      : 0;
    const inDesign = products.filter((product) => ["DESIGN_DRAFT", "DESIGN_CLARIFICATION", "DESIGN_SUBMITTED"].includes(product.stage)).length;
    return {
      projects: filteredRows.length,
      products: products.length,
      productionFiles,
      productsWithBom,
      inDesign,
      clients: new Set(filteredRows.map((project) => project.clientName).filter(Boolean)).size,
    };
  }, [filteredRows, bomsByFile, canSeeEngineeringReference]);

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
      await load();
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
      (product) => String(product.productName || "").trim() && String(product.drawingNo || "").trim()
    );
    if (!valid.length) {
      setError("Add at least one Product Name and Drawing No.");
      return;
    }
    const ok = await run(() => matflowApi.addProjectProducts(activeProject.id, valid.map(cleanProductBody)));
    if (ok) {
      setDialog("");
      setExpanded((current) => ({ ...current, [activeProject.id]: true }));
      setActiveProject(null);
      await load();
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
      await load();
    }
  };

  const uploadImage = async (project, product, file) => {
    if (!file) return;
    const ok = await run(() => matflowApi.uploadProductImage(project.id, product.id, file));
    if (ok) await load();
  };

  const openProductionFile = (product) => {
    if (!product.productionFileId) return;
    navigate(`/matflow/work?fileId=${product.productionFileId}`);
  };

  const openBom = (bom) => navigate(`/matflow/boms/${bom.id}`);

  if (loading && !rows.length) return <LoadingBlock />;

  return (
    <Box sx={pageSx}>
      <PageHero
        badge="MASTER PRODUCTION FILE"
        title={juniorDesignerOnly ? "My Assigned Products" : "Projects"}
        subtitle={juniorDesignerOnly ? "Only PDs and Products connected to your assigned Design tasks are visible." : (canSeeEngineeringReference ? "Product Name + PD No. with one Production File per Product / Drawing." : "Product Name + PD No., drawing ownership and file tracking.")}
        actions={
          <Box sx={{ display: "flex", gap: 0.8, flexWrap: "wrap" }}>
            <Button startIcon={<RefreshOutlinedIcon />} onClick={load} disabled={loading} sx={secondaryBtnSx}>
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
          label={canSeeEngineeringReference ? "Search Product Name / PD No. / project / drawing / Production File / BOM" : "Search Product Name / PD No. / client / project / drawing"}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={fieldSx}
        />
      </Card>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" }, gap: 1 }}>
        <Summary label={juniorDesignerOnly ? "Assigned PDs" : "Projects"} value={summary.projects} />
        <Summary label={juniorDesignerOnly ? "Assigned Products" : "Products / Drawings"} value={summary.products} />
        <Summary label="Production Files" value={summary.productionFiles} />
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
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2,minmax(0,1fr))", xl: "repeat(3,minmax(0,1fr))" }, gap: 1, alignItems: "stretch" }}>
          {filteredRows.map((project) => {
            const products = project.products || [];
            const bomCount = products.reduce(
              (total, product) => total + (bomsByFile.get(product.productionFileId) || []).length,
              0
            );
            const productsWithBom = products.filter(
              (product) => (bomsByFile.get(product.productionFileId) || []).length > 0
            ).length;
            const productionFiles = products.filter((product) => product.productionFileId);
            const healthValues = productionFiles.map((product) => String(product.releaseHealth || "").toUpperCase());
            const projectHealth = healthValues.includes("RED")
              ? "RED"
              : healthValues.includes("AMBER")
                ? "AMBER"
                : healthValues.includes("GREEN") && healthValues.length
                  ? "GREEN"
                  : "PENDING";
            const isOpen = expanded[project.id] === true;
            const visibleFiles = productionFiles.slice(0, 2);
            const stageCounts = productionFiles.reduce((map, product) => {
              const key = product.stage || "NOT_STARTED";
              map.set(key, (map.get(key) || 0) + 1);
              return map;
            }, new Map());

            return (
              <Card
                key={project.id}
                sx={{
                  ...ticketCardSx(projectHealth),
                  gridColumn: isOpen ? "1 / -1" : "auto",
                }}
              >
                <Box sx={ticketTopSx}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={ticketEyebrowSx}>
                      PROJECT TICKET · {project.plantCode || "NO PLANT"}
                    </Typography>
                    <Typography sx={{ mt: 0.25, fontSize: 16.5, lineHeight: 1.08, fontWeight: 950, color: "var(--mf-text)" }}>
                      {project.projectCode}
                    </Typography>
                    <Typography noWrap sx={{ mt: 0.2, fontSize: 10.3, fontWeight: 850, color: "var(--mf-text-secondary)" }}>
                      {project.projectName || "Unnamed Project"}
                    </Typography>
                    <Typography noWrap sx={{ mt: 0.1, fontSize: 8.9, color: "var(--mf-text-muted)" }}>
                      {project.clientName || "Client not assigned"}
                    </Typography>
                    {!!products.length && (
                      <Typography noWrap sx={{ mt: 0.2, fontSize: 8.7, fontWeight: 800, color: "var(--mf-primary-text)" }}>
                        Products: {products.slice(0, 2).map((item) => item.productName || "Unnamed Product").join(" · ")}{products.length > 2 ? ` +${products.length - 2}` : ""}
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ display: "grid", justifyItems: "end", gap: 0.4, flex: "0 0 auto" }}>
                    <Chip label={`${productionFiles.length} File${productionFiles.length === 1 ? "" : "s"}`} size="small" sx={softChipSx} />
                  </Box>
                </Box>

                <Box sx={ticketPerforationSx} />

                <Box sx={ticketMetaGridSx}>
                  <TicketMeta label="Required" value={formatDate(project.requiredDate)} />
                  <TicketMeta label="Priority" value={readable(project.priority || "NORMAL")} />
                  {juniorDesignerOnly ? <TicketMeta label="Assigned Products" value={products.length} /> : <TicketMeta label="Manager" value={project.projectManager || "—"} />}
                  {juniorDesignerOnly ? <TicketMeta label="Client" value={project.clientName || "—"} /> : <TicketMeta label="Designer" value={project.designer1 || "—"} />}
                </Box>

                <Box sx={{ px: 1.05, pb: 0.8, display: "flex", flexDirection: "column", flex: 1 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 0.7, mb: 0.55 }}>
                    <Box>
                      <Typography sx={{ fontSize: 9.3, fontWeight: 950, color: "var(--mf-text)" }}>PRODUCTS / PRODUCTION FILES</Typography>
                      <Typography sx={{ mt: 0.08, fontSize: 8.2, color: "var(--mf-text-muted)" }}>
                        One Product / Drawing = one controlled Production File
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 8.5, fontWeight: 850, color: "var(--mf-text-muted)", whiteSpace: "nowrap" }}>
                      {canSeeEngineeringReference
                        ? `${productsWithBom}/${products.length || 0} with BOM · ${bomCount} revisions`
                        : `${productionFiles.length} controlled file${productionFiles.length === 1 ? "" : "s"}`}
                    </Typography>
                  </Box>

                  {!visibleFiles.length ? (
                    <Box sx={ticketEmptyFileSx}>No Production File yet. Add a Product / Drawing to create one automatically.</Box>
                  ) : (
                    <Box sx={{ display: "grid", gap: 0.45 }}>
                      {visibleFiles.map((product) => (
                        <Box
                          key={product.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => openProductionFile(product)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") openProductionFile(product);
                          }}
                          sx={ticketFileRowSx(product.releaseHealth)}
                        >
                          <MatFlowProductIdentity
                            productName={product.productName}
                            projectCode={project.projectCode}
                            productionFileNo={product.productionFileNo}
                            drawingNo={product.drawingNo}
                            size="sm"
                            sx={{ minWidth: 0 }}
                          />
                          <Box sx={{ display: "flex", gap: 0.45, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
                            {juniorDesignerOnly ? (
                              <Typography sx={{ color: "var(--mf-primary-text)", fontSize: 8.6, fontWeight: 900 }}>Assigned to you</Typography>
                            ) : (
                              <>
                                <Typography sx={{ color: ticketHealthColor(product.releaseHealth), fontSize: 8.4, fontWeight: 900 }}>
                                  {healthLabel(product.releaseHealth)}
                                </Typography>
                                <Chip label={readable(product.stage || "NOT_STARTED")} size="small" sx={softChipSx} />
                              </>
                            )}
                          </Box>
                        </Box>
                      ))}
                      {productionFiles.length > visibleFiles.length && (
                        <Typography sx={{ px: 0.2, fontSize: 8.4, fontWeight: 850, color: "var(--mf-primary-text)" }}>
                          + {productionFiles.length - visibleFiles.length} more Production File{productionFiles.length - visibleFiles.length === 1 ? "" : "s"} inside this Project ticket
                        </Typography>
                      )}
                    </Box>
                  )}

                  <Box sx={{ mt: "auto", pt: 0.65, minHeight: 24, display: "flex", flexWrap: "wrap", gap: 0.35, alignItems: "flex-end" }}>
                    {juniorDesignerOnly
                      ? <Typography sx={{ fontSize: 8.6, color: "var(--mf-text-muted)" }}>Only your assigned Product / PD records are shown.</Typography>
                      : Array.from(stageCounts.entries()).slice(0, 2).map(([stageName, count]) => (
                          <Chip key={stageName} label={`${readable(stageName)} · ${count}`} size="small" sx={softChipSx} />
                        ))}
                  </Box>
                </Box>

                <Box sx={ticketActionsSx}>
                  {canProjectWrite && (
                    <>
                      <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => openEditProject(project)} sx={secondaryBtnSx}>
                        Edit
                      </Button>
                      <Button size="small" startIcon={<AddOutlinedIcon />} onClick={() => openBulkProducts(project)} sx={primaryBtnSx}>
                        Add
                      </Button>
                    </>
                  )}
                  <Button
                    size="small"
                    endIcon={isOpen ? <ExpandLessOutlinedIcon /> : <ExpandMoreOutlinedIcon />}
                    onClick={() => setExpanded((current) => ({ ...current, [project.id]: !isOpen }))}
                    sx={{ ...secondaryBtnSx, ml: { sm: "auto" } }}
                  >
                    {isOpen ? "Close details" : "Open ticket"}
                  </Button>
                </Box>

                <Collapse in={isOpen} unmountOnExit>
                  <Box sx={{ px: 1.4, py: 1.25, borderTop: "1px dashed var(--mf-border-strong)", background: "var(--mf-surface)" }}>
                    <Box sx={projectMetaGridSx}>
                      <Meta label="Plant" value={project.plantCode} />
                      <Meta label="Priority" value={project.priority || "NORMAL"} />
                      <Meta label="Required Date" value={formatDate(project.requiredDate)} />
                      {juniorDesignerOnly ? <Meta label="Client" value={project.clientName || "—"} /> : <Meta label="Project Manager" value={project.projectManager || "—"} />}
                      {!juniorDesignerOnly && <Meta label="Designer" value={project.designer1 || "—"} />}
                      {!juniorDesignerOnly && <Meta label="Design Head" value={project.designHead || "—"} />}
                    </Box>
                    {!juniorDesignerOnly && project.remarks && (
                      <Typography sx={{ mt: 0.8, fontSize: 9.8, color: "var(--mf-text-muted)" }}>
                        Project remarks: {project.remarks}
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ px: 1.4, py: 1.35 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center", mb: 0.85 }}>
                      <Box>
                        <Typography sx={{ fontSize: 12, fontWeight: 950, color: "var(--mf-text)" }}>
                          Product / Production File detail
                        </Typography>
                        <Typography sx={{ mt: 0.15, fontSize: 9.4, color: "var(--mf-text-muted)" }}>
                          {juniorDesignerOnly ? "Only the Product / Drawing information connected to your assignment is shown." : (canSeeEngineeringReference ? "Drawing, image, Production File and Engineering BOM history stay under this Project / PD ticket." : "Drawing, image and Production File tracking stay under this Project / PD ticket.")}
                        </Typography>
                      </Box>
                    </Box>

                    {!products.length ? (
                      <EmptyState>No products added.</EmptyState>
                    ) : (
                      <Box sx={{ display: "grid", gap: 0.9 }}>
                        {products.map((product) => juniorDesignerOnly ? (
                          <Box key={product.id} sx={{ p: 1.1, border: "1px solid var(--mf-border)", borderRadius: 1.2, display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0,1.4fr) .8fr .8fr auto" }, gap: 1, alignItems: "center", background: "var(--mf-panel-solid)" }}>
                            <MatFlowProductIdentity productName={product.productName} projectCode={project.projectCode} productionFileNo={product.productionFileNo} drawingNo={product.drawingNo} size="sm" />
                            <Box><Typography sx={{ fontSize: 9, color: "var(--mf-text-muted)" }}>Dimensions</Typography><Typography sx={{ fontSize: 10, fontWeight: 850, color: "var(--mf-text-secondary)" }}>{product.dimensions || "—"}</Typography></Box>
                            <Box><Typography sx={{ fontSize: 9, color: "var(--mf-text-muted)" }}>Required</Typography><Typography sx={{ fontSize: 10, fontWeight: 850, color: "var(--mf-text-secondary)" }}>{formatDate(product.requiredDate)}</Typography></Box>
                            <Button size="small" onClick={() => openProductionFile(product)} sx={primaryBtnSx}>Open my task</Button>
                          </Box>
                        ) : (
                          <ProductMasterRow
                            key={product.id}
                            project={project}
                            product={product}
                            boms={bomsByFile.get(product.productionFileId) || []}
                            canEdit={canProjectWrite}
                            showEngineering={canSeeEngineeringReference}
                            onEdit={openProductEdit}
                            onImage={uploadImage}
                            onOpenFile={openProductionFile}
                            onOpenBom={openBom}
                          />
                        ))}
                      </Box>
                    )}
                  </Box>
                </Collapse>
              </Card>
            );
          })}
        </Box>
      )}

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
            <TextField label="PD No. / Project Code" value={projectForm.projectCode} onChange={(e) => setProjectForm({ ...projectForm, projectCode: e.target.value })} sx={fieldSx} />
            <TextField label="Project Name" value={projectForm.projectName} onChange={(e) => setProjectForm({ ...projectForm, projectName: e.target.value })} sx={fieldSx} />
            <TextField label="Client Name" value={projectForm.clientName} onChange={(e) => setProjectForm({ ...projectForm, clientName: e.target.value })} sx={fieldSx} />
            <TextField select label="Plant" value={projectForm.plantCode} onChange={(e) => setProjectForm({ ...projectForm, plantCode: e.target.value })} sx={fieldSx}>
              {(availablePlants || []).map((plant) => (
                <MenuItem key={plant} value={plant}>{plant}</MenuItem>
              ))}
            </TextField>
            <TextField type="date" InputLabelProps={{ shrink: true }} label="Required Date" value={projectForm.requiredDate || ""} onChange={(e) => setProjectForm({ ...projectForm, requiredDate: e.target.value })} sx={fieldSx} />
            <TextField label="Project Manager" value={projectForm.projectManager || ""} onChange={(e) => setProjectForm({ ...projectForm, projectManager: e.target.value })} sx={fieldSx} />
            <TextField label="Designer-1 / Client Project Designer" value={projectForm.designer1 || ""} onChange={(e) => setProjectForm({ ...projectForm, designer1: e.target.value })} sx={fieldSx} />
            <TextField label="Design Head" value={projectForm.designHead || ""} onChange={(e) => setProjectForm({ ...projectForm, designHead: e.target.value })} sx={fieldSx} />
            <TextField label="Remarks" multiline minRows={2} value={projectForm.remarks || ""} onChange={(e) => setProjectForm({ ...projectForm, remarks: e.target.value })} sx={{ ...fieldSx, gridColumn: { md: "1/-1" } }} />
          </Box>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={() => setDialog("")} sx={secondaryBtnSx}>Cancel</Button>
          <Button disabled={working} onClick={saveProject} sx={primaryBtnSx}>Save</Button>
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
          Add Multiple Products · {activeProject?.projectCode || "Project"}
        </DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Typography sx={{ mb: 1.2, fontSize: 10.5, color: "var(--mf-text-muted)" }}>
            Each Product / Drawing creates its own Production File automatically and remains inside this one Project master record. File identity follows PD sequence automatically — for example {activeProject?.projectCode || "PD-54"}/01, /02 … /09, /10.
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
      <Typography sx={{ fontSize: 7.2, fontWeight: 950, letterSpacing: ".055em", color: "var(--mf-text-muted)" }}>
        {label.toUpperCase()}
      </Typography>
      <Typography noWrap sx={{ mt: 0.1, fontSize: 9.1, fontWeight: 850, color: "var(--mf-text-secondary)" }}>
        {value || "—"}
      </Typography>
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
  height: "100%",
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  borderRadius: 1.35,
  borderTop: `2px solid ${ticketHealthColor(health)}`,
  borderLeft: `3px solid ${ticketHealthColor(health)}`,
  boxShadow: `inset 20px 0 30px -32px ${ticketHealthColor(health)}, var(--mf-card-shadow)`,
  "&::before": {
    content: '""',
    position: "absolute",
    top: 72,
    left: -6,
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: "var(--mf-page-bg)",
    border: "1px solid var(--mf-border)",
    zIndex: 2,
  },
  "&::after": {
    content: '""',
    position: "absolute",
    top: 72,
    right: -6,
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: "var(--mf-page-bg)",
    border: "1px solid var(--mf-border)",
    zIndex: 2,
  },
});

const ticketTopSx = {
  px: 1.1,
  py: 0.9,
  minHeight: 72,
  display: "flex",
  justifyContent: "space-between",
  gap: 0.75,
  alignItems: "flex-start",
  background: "var(--mf-panel-solid)",
};

const ticketEyebrowSx = {
  fontSize: 7.5,
  fontWeight: 950,
  letterSpacing: ".08em",
  color: "var(--mf-primary-text)",
};

const ticketPerforationSx = {
  mx: 0.95,
  borderTop: "1px dashed var(--mf-border-strong)",
};

const ticketMetaGridSx = {
  px: 1.05,
  py: 0.7,
  minHeight: 70,
  display: "grid",
  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  gap: 0.55,
  columnGap: 0.8,
  alignContent: "center",
};

const ticketFileRowSx = (health) => ({
  px: 0.7,
  py: 0.55,
  display: "grid",
  gridTemplateColumns: { xs: "1fr", sm: "minmax(0,1fr) auto" },
  gap: 0.55,
  minHeight: 45,
  alignItems: "center",
  border: "1px solid var(--mf-border)",
  borderLeft: `3px solid ${ticketHealthColor(health)}`,
  borderRadius: 1,
  background: ticketHealthSoft(health),
  cursor: "pointer",
  transition: "border-color .15s ease, background .15s ease, transform .15s ease",
  "&:hover": { borderColor: ticketHealthColor(health), transform: "translateY(-1px)" },
  "&:focus-visible": { outline: "2px solid var(--mf-primary)", outlineOffset: 1 },
});

const ticketEmptyFileSx = {
  p: 0.75,
  minHeight: 45,
  border: "1px dashed var(--mf-border-strong)",
  borderRadius: 1.2,
  fontSize: 8.8,
  color: "var(--mf-text-muted)",
  background: "var(--mf-surface)",
};

const ticketActionsSx = {
  px: 1.05,
  py: 0.65,
  mt: "auto",
  minHeight: 45,
  display: "flex",
  flexWrap: "wrap",
  gap: 0.45,
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
  p: 0.8,
  borderRadius: 1.2,
  background: "var(--mf-surface)",
  border: "1px solid var(--mf-border)",
};

const metaLabelSx = {
  fontSize: 8.2,
  fontWeight: 900,
  letterSpacing: ".05em",
  textTransform: "uppercase",
  color: "var(--mf-text-muted)",
};

const metaValueSx = {
  mt: 0.2,
  fontSize: 10.5,
  fontWeight: 850,
  color: "var(--mf-text)",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const productCardSx = (health) => ({
  border: "1px solid var(--mf-border)",
  borderLeft: `3px solid ${ticketHealthColor(health)}`,
  borderRadius: 1.5,
  background: "var(--mf-panel-solid)",
  overflow: "hidden",
  boxShadow: `inset 18px 0 28px -32px ${ticketHealthColor(health)}`,
});

const productHeaderSx = {
  px: 1.15,
  py: 1,
  display: "flex",
  justifyContent: "space-between",
  gap: 1,
  alignItems: { xs: "flex-start", md: "center" },
  flexDirection: { xs: "column", md: "row" },
  borderBottom: "1px solid var(--mf-border)",
};

const productInfoGridSx = {
  px: 1.15,
  py: 0.9,
  display: "grid",
  gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(4,1fr)" },
  gap: 0.7,
};

const identityGridSx = {
  px: 1.15,
  pb: 1.05,
  display: "grid",
  gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
  gap: 0.8,
};

const productionFilePanelSx = (health) => ({
  p: 1,
  borderRadius: 1.4,
  border: "1px solid",
  borderColor: ticketHealthColor(health),
  borderLeftWidth: 3,
  background: ticketHealthSoft(health),
});

const bomPanelSx = {
  p: 1,
  borderRadius: 1.4,
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
  fontSize: 8.2,
  fontWeight: 950,
  letterSpacing: ".07em",
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
  mx: 1.15,
  mb: 1.05,
  border: "1px solid var(--mf-border)",
  borderRadius: 1.3,
  overflow: "hidden",
  background: "var(--mf-surface)",
};

const trackingSheetSx = {
  mx: 1.15,
  mb: 1.05,
  border: "1px solid var(--mf-border)",
  borderRadius: 1.3,
  overflow: "hidden",
  background: "var(--mf-surface)",
};

const trackingHeaderSx = {
  px: 1,
  py: 0.8,
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
    px: 1,
    py: 0.72,
    pl: 1.2,
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
  px: 1,
  py: 0.75,
  fontSize: 8.6,
  lineHeight: 1.45,
  color: "var(--mf-text-muted)",
  background: "var(--mf-panel-solid)",
};

const softChipSx = {
  height: 22,
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
