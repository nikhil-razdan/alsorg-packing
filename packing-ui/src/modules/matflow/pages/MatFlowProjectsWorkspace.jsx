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
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ExpandLessOutlinedIcon from "@mui/icons-material/ExpandLessOutlined";
import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { useNavigate } from "react-router-dom";
import { matflowApi, readMatFlowError } from "../api/matflowApi";
import {
  ErrorBox,
  LoadingBlock,
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

function ProductMasterRow({ project, product, boms, onEdit, onImage, onOpenFile, onOpenBom }) {
  const currentBom = boms.find((bom) => bom.latestRevision) || boms[0] || null;

  return (
    <Box sx={productCardSx}>
      <Box sx={productHeaderSx}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: "flex", gap: 0.65, alignItems: "center", flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: 13, fontWeight: 950, color: "var(--mf-text)" }}>
              {product.productName}
            </Typography>
            {product.productType && <Chip label={product.productType} size="small" sx={softChipSx} />}
          </Box>
          <Typography sx={{ mt: 0.25, fontSize: 9.7, color: "var(--mf-text-muted)" }}>
            Drawing {product.drawingNo || "—"}{product.drawingRevision ? ` · Rev ${product.drawingRevision}` : ""}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 0.55, flexWrap: "wrap", justifyContent: { md: "flex-end" } }}>
          <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => onEdit(project, product)} sx={secondaryBtnSx}>
            Edit
          </Button>
          <Button size="small" component="label" startIcon={<ImageOutlinedIcon />} sx={secondaryBtnSx}>
            {product.productImageAvailable ? "Replace Image" : "Attach Image"}
            <input hidden type="file" accept="image/*" onChange={(event) => onImage(project, product, event.target.files?.[0])} />
          </Button>
        </Box>
      </Box>

      <Box sx={productInfoGridSx}>
        <Meta label="Dimensions" value={product.dimensions || "Pending"} />
        <Meta label="Units" value={product.unitQuantity || 1} />
        <Meta label="Required" value={formatDate(product.requiredDate || project.requiredDate)} />
        <Meta label="Product Remarks" value={product.remarks || "—"} />
      </Box>

      <Box sx={identityGridSx}>
        <Box sx={productionFilePanelSx}>
          <Box sx={panelTopRowSx}>
            <Box>
              <Typography sx={panelEyebrowSx}>PRODUCTION FILE</Typography>
              <Typography sx={{ mt: 0.25, fontSize: 12.2, fontWeight: 950, color: "var(--mf-text)" }}>
                {product.productionFileNo || "Migration pending"}
              </Typography>
            </Box>
            <MatFlowStatusChip status={product.releaseHealth || "PENDING"} />
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

        <Box sx={bomPanelSx}>
          <Box sx={panelTopRowSx}>
            <Box>
              <Typography sx={panelEyebrowSx}>BOM</Typography>
              <Typography sx={{ mt: 0.25, fontSize: 12.2, fontWeight: 950, color: "var(--mf-text)" }}>
                {currentBom ? currentBom.bomNumber : "No BOM yet"}
              </Typography>
            </Box>
            {currentBom ? <MatFlowStatusChip status={currentBom.status} /> : <Chip label="PENDING" size="small" sx={softChipSx} />}
          </Box>

          {currentBom ? (
            <>
              <Box sx={{ mt: 0.9, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.7 }}>
                <Meta label="Current Revision" value={`Rev ${currentBom.revisionNo}`} />
                <Meta label="BOM Revisions" value={boms.length} />
              </Box>
              <Button fullWidth size="small" endIcon={<OpenInNewOutlinedIcon />} onClick={() => onOpenBom(currentBom)} sx={{ ...primaryBtnSx, mt: 0.9 }}>
                Open Current BOM
              </Button>
            </>
          ) : (
            <Box sx={emptyBomSx}>
              BOM stays attached to this Product / Production File. It becomes available through Engineering Work after the required gates are completed.
            </Box>
          )}
        </Box>
      </Box>

      {boms.length > 0 && (
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
  const { selectedPlantParam, availablePlants } = useMatFlow();
  const navigate = useNavigate();

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
      const [projectsResponse, bomsResponse] = await Promise.all([
        matflowApi.listProjects({ active: true, plantCode: selectedPlantParam }),
        matflowApi.listBoms(),
      ]);
      const projects = Array.isArray(projectsResponse?.data) ? projectsResponse.data : [];
      const bomRows = Array.isArray(bomsResponse?.data) ? bomsResponse.data : [];
      setRows(projects);
      setBoms(bomRows);
    } catch (requestError) {
      setError(readMatFlowError(requestError, "Unable to load MatFlow Projects."));
    } finally {
      setLoading(false);
    }
  }, [selectedPlantParam]);

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
          ...productBoms.flatMap((bom) => [bom.bomNumber, bom.status, bom.revisionNo]),
        ];
        return values.some((value) => String(value || "").toLowerCase().includes(query));
      });
    });
  }, [rows, search, bomsByFile]);

  const summary = useMemo(() => {
    const products = filteredRows.flatMap((project) => project.products || []);
    const productionFiles = products.filter((product) => product.productionFileId).length;
    const productsWithBom = products.filter((product) => (bomsByFile.get(product.productionFileId) || []).length > 0).length;
    return {
      projects: filteredRows.length,
      products: products.length,
      productionFiles,
      productsWithBom,
    };
  }, [filteredRows, bomsByFile]);

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
        title="Projects"
        subtitle="One Project card is the master production record. Every Product/Drawing, Production File and BOM revision remains attached to the same PD / Project identity—no independent departmental record."
        actions={
          <Box sx={{ display: "flex", gap: 0.8, flexWrap: "wrap" }}>
            <Button startIcon={<RefreshOutlinedIcon />} onClick={load} disabled={loading} sx={secondaryBtnSx}>
              Refresh
            </Button>
            <Button startIcon={<AddOutlinedIcon />} onClick={openNewProject} sx={primaryBtnSx}>
              New Project
            </Button>
          </Box>
        }
      />

      {error && <ErrorBox>{error}</ErrorBox>}

      <Card sx={{ ...panelSx, p: 1.25 }}>
        <TextField
          size="small"
          fullWidth
          label="Search PD No., project, client, product, drawing, Production File or BOM"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={fieldSx}
        />
      </Card>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" }, gap: 1 }}>
        <Summary label="Projects" value={summary.projects} />
        <Summary label="Products / Drawings" value={summary.products} />
        <Summary label="Production Files" value={summary.productionFiles} />
        <Summary label="Products with BOM" value={`${summary.productsWithBom}/${summary.products}`} />
      </Box>

      {!filteredRows.length ? (
        <Card sx={{ ...panelSx, p: 0 }}>
          <EmptyState>No projects found.</EmptyState>
        </Card>
      ) : (
        <Box sx={{ display: "grid", gap: 1.2 }}>
          {filteredRows.map((project) => {
            const products = project.products || [];
            const bomCount = products.reduce(
              (total, product) => total + (bomsByFile.get(product.productionFileId) || []).length,
              0
            );
            const productsWithBom = products.filter(
              (product) => (bomsByFile.get(product.productionFileId) || []).length > 0
            ).length;
            const isOpen = expanded[project.id] === true;

            return (
              <Card key={project.id} sx={{ ...panelSx, p: 0, overflow: "hidden" }}>
                <Box sx={projectHeaderSx}>
                  <Box sx={{ display: "flex", gap: 1, minWidth: 0, flex: 1 }}>
                    <IconButton
                      size="small"
                      onClick={() => setExpanded((current) => ({ ...current, [project.id]: !isOpen }))}
                      sx={toggleSx}
                    >
                      {isOpen ? <ExpandLessOutlinedIcon /> : <ExpandMoreOutlinedIcon />}
                    </IconButton>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 18, fontWeight: 950, color: "var(--mf-text)" }}>
                        {project.projectCode} · {project.projectName}
                      </Typography>
                      <Typography sx={{ mt: 0.2, fontSize: 10.2, color: "var(--mf-text-muted)" }}>
                        {project.clientName || "No client"} · {project.plantCode || "No plant"}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: "flex", gap: 0.55, flexWrap: "wrap", justifyContent: { md: "flex-end" } }}>
                    <Chip label={`${products.length} product${products.length === 1 ? "" : "s"}`} size="small" sx={softChipSx} />
                    <Chip label={`${productsWithBom}/${products.length || 0} with BOM`} size="small" sx={softChipSx} />
                    <Chip label={`${bomCount} BOM revision${bomCount === 1 ? "" : "s"}`} size="small" sx={softChipSx} />
                    <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => openEditProject(project)} sx={secondaryBtnSx}>
                      Edit Project
                    </Button>
                    <Button size="small" startIcon={<AddOutlinedIcon />} onClick={() => openBulkProducts(project)} sx={primaryBtnSx}>
                      Add Products
                    </Button>
                  </Box>
                </Box>

                <Collapse in={isOpen}>
                  <Box sx={{ px: 1.4, py: 1.25, borderTop: "1px solid var(--mf-border)" }}>
                    <Box sx={projectMetaGridSx}>
                      <Meta label="Plant" value={project.plantCode} />
                      <Meta label="Priority" value={project.priority || "NORMAL"} />
                      <Meta label="Required Date" value={formatDate(project.requiredDate)} />
                      <Meta label="Project Manager" value={project.projectManager || "—"} />
                    </Box>
                    {project.remarks && (
                      <Typography sx={{ mt: 0.8, fontSize: 9.8, color: "var(--mf-text-muted)" }}>
                        Project remarks: {project.remarks}
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ px: 1.4, pb: 1.4 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center", mb: 0.85 }}>
                      <Box>
                        <Typography sx={{ fontSize: 12, fontWeight: 950, color: "var(--mf-text)" }}>
                          Products / Production Files / BOMs
                        </Typography>
                        <Typography sx={{ mt: 0.15, fontSize: 9.4, color: "var(--mf-text-muted)" }}>
                          Everything remains attached to this Project / PD identity.
                        </Typography>
                      </Box>
                    </Box>

                    {!products.length ? (
                      <EmptyState>No products added.</EmptyState>
                    ) : (
                      <Box sx={{ display: "grid", gap: 0.9 }}>
                        {products.map((product) => (
                          <ProductMasterRow
                            key={product.id}
                            project={project}
                            product={product}
                            boms={bomsByFile.get(product.productionFileId) || []}
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
            Each Product / Drawing creates its own Production File automatically but remains inside this one Project master record.
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

const productCardSx = {
  border: "1px solid var(--mf-border)",
  borderRadius: 1.5,
  background: "var(--mf-panel-solid)",
  overflow: "hidden",
};

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

const productionFilePanelSx = {
  p: 1,
  borderRadius: 1.4,
  border: "1px solid var(--mf-primary-border)",
  background: "var(--mf-primary-soft)",
};

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
