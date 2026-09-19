import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  Checkbox,
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
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ExpandLessOutlinedIcon from "@mui/icons-material/ExpandLessOutlined";
import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { useNavigate, useParams } from "react-router-dom";
import { matflowApi, readMatFlowError } from "../api/matflowApi";
import { downloadMatFlowBomExcel } from "../api/matflowBomExcel";
import {
  ErrorBox,
  LoadingBlock,
  PageHero,
  EmptyState,
  MATFLOW_ROLES,
  MATFLOW_LIST_CARD_OPTIONS,
  MatFlowProductIdentity,
  MatFlowViewToggle,
  MatFlowListGrid,
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
  useMatFlowViewMode,
  readable,
} from "../matflowUi";

const SECTION_ORDER = [
  "Metal",
  "Wood",
  "Hardware",
  "Stone",
  "Glass",
  "Fabric / Upholstery",
  "Paint & Polish",
  "Packaging",
  "Miscellaneous",
];

const sectionAccent = (section) => {
  const key = String(section || "").trim().toLowerCase();
  if (key.includes("metal")) return "var(--mf-primary)";
  if (key.includes("wood")) return "var(--mf-purple-text)";
  if (key.includes("hardware")) return "var(--mf-warning-text)";
  if (key.includes("stone")) return "var(--mf-success-text)";
  if (key.includes("glass")) return "var(--mf-primary-text)";
  if (key.includes("fabric") || key.includes("upholstery")) return "var(--mf-danger-text)";
  if (key.includes("paint") || key.includes("polish")) return "var(--mf-purple-text)";
  if (key.includes("pack")) return "var(--mf-success-text)";
  return "var(--mf-text-muted)";
};

const number = (value, digits = 3) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString("en-IN", { maximumFractionDigits: digits })
    : "0";
};

const lineBlank = {
  materialId: "",
  materialCode: "",
  materialName: "",
  category: "Wood",
  specification: "",
  uom: "NOS",
  requiredQty: "",
  wastagePercent: "0",
  remarks: "",
  rowVersion: null,
};

const normalizeLinePayload = (line) => ({
  materialId: line.materialId || null,
  materialCode: String(line.materialCode || "").trim(),
  materialName: String(line.materialName || "").trim(),
  category: String(line.category || "").trim(),
  specification: String(line.specification || "").trim() || null,
  uom: String(line.uom || "").trim().toUpperCase(),
  requiredQty: Number(line.requiredQty),
  wastagePercent: Number(line.wastagePercent || 0),
  remarks: String(line.remarks || "").trim() || null,
  rowVersion: line.rowVersion ?? null,
});

const validateLine = (line) => {
  if (!String(line.materialName || "").trim()) return "Material Name is required.";
  if (!String(line.category || "").trim()) return "Section / Category is required.";
  if (!String(line.uom || "").trim()) return "UOM is required.";
  const qty = Number(line.requiredQty);
  if (!Number.isFinite(qty) || qty <= 0) return "Required Qty must be greater than zero.";
  const wastage = Number(line.wastagePercent || 0);
  if (!Number.isFinite(wastage) || wastage < 0) return "Wastage % cannot be negative.";
  return "";
};

/* -------------------------------------------------------------------------- */
/* BOM LANDING                                                                */
/* -------------------------------------------------------------------------- */

export function MatFlowBomListPage() {
  const { selectedPlantParam, hasRole } = useMatFlow();
  const canPermanentDelete = hasRole(MATFLOW_ROLES.ADMIN);
  const [viewMode, setViewMode] = useMatFlowViewMode("boms", "LIST");
  const nav = useNavigate();

  const [rows, setRows] = useState([]);
  const [files, setFiles] = useState([]);
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [fileId, setFileId] = useState("");
  const [productId, setProductId] = useState("");
  const [selectedBomDeleteIds, setSelectedBomDeleteIds] = useState([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [bomsResponse, filesResponse, projectsResponse] = await Promise.all([
        matflowApi.listBoms(),
        matflowApi.listProductionFiles({ plantCode: selectedPlantParam }),
        matflowApi.listProjects({ active: true, plantCode: selectedPlantParam }),
      ]);
      setRows(Array.isArray(bomsResponse?.data) ? bomsResponse.data : []);
      setFiles(Array.isArray(filesResponse?.data) ? filesResponse.data : []);
      setProjects(Array.isArray(projectsResponse?.data) ? projectsResponse.data : []);
    } catch (requestError) {
      setError(readMatFlowError(requestError, "Unable to load Engineering BOMs."));
    } finally {
      setLoading(false);
    }
  }, [selectedPlantParam]);

  useEffect(() => { load(); }, [load]);

  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch = !q || [
        row.bomNumber,
        row.projectCode,
        row.projectName,
        row.productionFileNo,
        row.productName,
        row.drawingNo,
      ].filter(Boolean).join(" ").toLowerCase().includes(q);
      return matchesSearch && (!status || row.status === status);
    });
  }, [rows, search, status]);

  const visibleBomIds = useMemo(() => filteredRows.map((row) => row.id).filter(Boolean), [filteredRows]);
  const visibleSelectedBomCount = visibleBomIds.filter((idValue) => selectedBomDeleteIds.includes(idValue)).length;
  const allVisibleBomsSelected = Boolean(visibleBomIds.length)
    && visibleSelectedBomCount === visibleBomIds.length;

  useEffect(() => {
    const valid = new Set(rows.map((row) => row.id));
    setSelectedBomDeleteIds((current) => current.filter((idValue) => valid.has(idValue)));
  }, [rows]);

  const toggleBomSelection = (bomId) => {
    if (!canPermanentDelete || !bomId) return;
    setSelectedBomDeleteIds((current) => current.includes(bomId)
      ? current.filter((idValue) => idValue !== bomId)
      : [...current, bomId]);
  };

  const toggleVisibleBomSelection = () => {
    if (!canPermanentDelete || !visibleBomIds.length) return;
    setSelectedBomDeleteIds((current) => {
      const next = new Set(current);
      if (allVisibleBomsSelected) visibleBomIds.forEach((idValue) => next.delete(idValue));
      else visibleBomIds.forEach((idValue) => next.add(idValue));
      return Array.from(next);
    });
  };

  const activeBomKeys = useMemo(() => new Set(
    rows
      .filter((row) => row.status !== "SUPERSEDED" && row.productionFileId && row.productId)
      .map((row) => `${row.productionFileId}:${row.productId}`)
  ), [rows]);

  const productReadiness = useMemo(() => {
    const result = [];
    for (const file of files) {
      const project = projectsById.get(file.projectId);
      const products = (project?.products || []).filter((product) => product.active !== false);
      if (!products.length) {
        result.push({ file, project, product: null, hasActiveBom: false, eligible: false });
        continue;
      }
      for (const product of products) {
        const hasActiveBom = activeBomKeys.has(`${file.id}:${product.id}`);
        const eligible = !hasActiveBom
          && file.stage === "ENGINEERING_WORK"
          && file.engineeringDecision === "APPROVED";
        result.push({ file, project, product, hasActiveBom, eligible });
      }
    }
    return result;
  }, [files, projectsById, activeBomKeys]);

  const pendingBomItems = useMemo(
    () => productReadiness.filter((item) => !item.hasActiveBom),
    [productReadiness]
  );

  const eligibleItems = useMemo(
    () => productReadiness.filter((item) => item.eligible && item.product),
    [productReadiness]
  );

  const availableFiles = useMemo(() => {
    const map = new Map();
    for (const item of eligibleItems) map.set(item.file.id, item.file);
    return Array.from(map.values());
  }, [eligibleItems]);

  const availableProducts = useMemo(
    () => eligibleItems.filter((item) => item.file.id === fileId).map((item) => item.product),
    [eligibleItems, fileId]
  );

  const stats = useMemo(() => ({
    total: rows.length,
    ready: rows.filter((row) => row.status === "READY_FOR_RELEASE").length,
    productionFiles: files.length,
    eligible: eligibleItems.length,
  }), [rows, files.length, eligibleItems.length]);

  const create = async () => {
    if (!fileId || !productId) return;
    setWorking(true);
    setError("");
    try {
      const response = await matflowApi.createBom({
        productionFileId: fileId,
        productId,
        remarks: null,
      });
      setOpen(false);
      setFileId("");
      setProductId("");
      nav(`/matflow/boms/${response.data.id}`);
    } catch (requestError) {
      setError(readMatFlowError(requestError, "Unable to create BOM."));
    } finally {
      setWorking(false);
    }
  };

  const openBulkDelete = () => {
    if (!canPermanentDelete || !selectedBomDeleteIds.length) return;
    setBulkDeleteConfirm("");
    setBulkDeleteOpen(true);
  };

  const closeBulkDelete = () => {
    if (working) return;
    setBulkDeleteOpen(false);
    setBulkDeleteConfirm("");
  };

  const permanentlyDeleteSelectedBoms = async () => {
    if (!canPermanentDelete || !selectedBomDeleteIds.length || bulkDeleteConfirm.trim().toUpperCase() !== "DELETE") return;
    setWorking(true);
    setError("");
    try {
      await matflowApi.permanentlyDeleteBoms([...selectedBomDeleteIds]);
      setSelectedBomDeleteIds([]);
      setBulkDeleteOpen(false);
      setBulkDeleteConfirm("");
      await load();
    } catch (requestError) {
      setError(readMatFlowError(requestError, "Unable to permanently delete selected BOMs."));
    } finally {
      setWorking(false);
    }
  };

  const readinessText = (item) => {
    if (!item.product) return "Add at least one Product to this PD / Project first";
    if (item.eligible) return "Ready to start this Product BOM";
    if (item.file.engineeringDecision !== "APPROVED") return "Awaiting Engineering approval of the Project";
    if (item.file.stage !== "ENGINEERING_WORK") return `Project is at ${readable(item.file.stage)}`;
    return "Not yet BOM eligible";
  };

  if (loading && !rows.length) return <LoadingBlock />;

  return (
    <Box sx={pageSx}>
      <PageHero
        badge="ENGINEERING BOM"
        title="BOM Builder"
        subtitle="The PD / Project owns one Production File and one departmental handoff. Engineering BOMs remain Product-specific inside that shared Project workflow."
        actions={(
          <Box sx={{ display: "flex", gap: 0.8, flexWrap: "wrap", alignItems: "center" }}>
            <MatFlowViewToggle value={viewMode} onChange={setViewMode} options={MATFLOW_LIST_CARD_OPTIONS} />
            <Button startIcon={<RefreshOutlinedIcon />} onClick={load} disabled={loading} sx={secondaryBtnSx}>Refresh</Button>
            <Button startIcon={<AddOutlinedIcon />} onClick={() => { setFileId(""); setProductId(""); setOpen(true); }} sx={primaryBtnSx}>New BOM</Button>
          </Box>
        )}
      />

      {error && <ErrorBox>{error}</ErrorBox>}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" }, gap: 1 }}>
        <MiniMetric label="PD / Project Files" value={stats.productionFiles} />
        <MiniMetric label="Product BOMs" value={stats.total} />
        <MiniMetric label="Products BOM Eligible" value={stats.eligible} />
        <MiniMetric label="Ready for Release" value={stats.ready} />
      </Box>

      <Card sx={{ ...panelSx, p: 1.25 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0,1fr) 190px" }, gap: 1 }}>
          <TextField size="small" label="Search Product / PD / Project / BOM / Drawing" value={search} onChange={(event) => setSearch(event.target.value)} sx={fieldSx} />
          <TextField select size="small" label="Status" value={status} onChange={(event) => setStatus(event.target.value)} sx={fieldSx}>
            <MenuItem value="">All statuses</MenuItem>
            {["DRAFT", "SUBMITTED", "PRODUCTION_REVIEW_PENDING", "RETURNED", "APPROVED", "READY_FOR_RELEASE", "RELEASED", "SUPERSEDED"].map((value) => (
              <MenuItem key={value} value={value}>{readable(value)}</MenuItem>
            ))}
          </TextField>
        </Box>
      </Card>

      {canPermanentDelete && filteredRows.length > 0 && (
        <Card sx={{ ...panelSx, p: 0.8, display: "flex", alignItems: "center", gap: 0.6, flexWrap: "wrap", borderColor: selectedBomDeleteIds.length ? "var(--mf-danger-border)" : "var(--mf-border)" }}>
          <Checkbox
            size="small"
            checked={allVisibleBomsSelected}
            indeterminate={visibleSelectedBomCount > 0 && !allVisibleBomsSelected}
            onChange={toggleVisibleBomSelection}
            inputProps={{ "aria-label": "Select all visible BOMs for permanent delete" }}
            sx={{ p: 0.35, color: "var(--mf-text-muted)", "&.Mui-checked, &.MuiCheckbox-indeterminate": { color: "var(--mf-danger-text)" } }}
          />
          <Typography sx={{ fontSize: 9.2, fontWeight: 900, color: selectedBomDeleteIds.length ? "var(--mf-danger-text)" : "var(--mf-text-secondary)" }}>
            {selectedBomDeleteIds.length ? `${selectedBomDeleteIds.length} BOM${selectedBomDeleteIds.length === 1 ? "" : "s"} selected` : "ADMIN multi-select permanent delete"}
          </Typography>
          <Box sx={{ ml: { xs: 0, sm: "auto" }, display: "flex", gap: 0.5, flexWrap: "wrap" }}>
            {selectedBomDeleteIds.length > 0 && <Button size="small" onClick={() => setSelectedBomDeleteIds([])} sx={secondaryBtnSx}>Clear</Button>}
            <Button
              size="small"
              disabled={!selectedBomDeleteIds.length || working}
              startIcon={<DeleteOutlineOutlinedIcon />}
              onClick={openBulkDelete}
              sx={{ ...secondaryBtnSx, color: "var(--mf-danger-text)", borderColor: "var(--mf-danger-border)", background: selectedBomDeleteIds.length ? "var(--mf-danger-soft)" : undefined }}
            >
              Delete Selected{selectedBomDeleteIds.length ? ` (${selectedBomDeleteIds.length})` : ""}
            </Button>
          </Box>
        </Card>
      )}

      {!filteredRows.length ? (
        <Card sx={{ ...panelSx, p: 0 }}><EmptyState>No BOMs found.</EmptyState></Card>
      ) : viewMode === "CARD" ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(2,minmax(0,1fr))" }, gap: 0.8 }}>
          {filteredRows.map((row) => (
            <Card key={row.id} onClick={() => nav(`/matflow/boms/${row.id}`)} sx={{ ...panelSx, p: 1.15, cursor: "pointer", borderColor: selectedBomDeleteIds.includes(row.id) ? "var(--mf-danger-border)" : "var(--mf-border)" }}>
              <Box sx={{ display: "flex", gap: 0.5, alignItems: "flex-start" }}>
                {canPermanentDelete && (
                  <Box onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      size="small"
                      checked={selectedBomDeleteIds.includes(row.id)}
                      onChange={() => toggleBomSelection(row.id)}
                      inputProps={{ "aria-label": `Select BOM ${row.bomNumber || "record"} for permanent delete` }}
                      sx={{ p: 0.3, color: "var(--mf-text-muted)", "&.Mui-checked": { color: "var(--mf-danger-text)" } }}
                    />
                  </Box>
                )}
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <MatFlowProductIdentity productName={row.productName} projectCode={row.projectCode} productionFileNo={row.productionFileNo} drawingNo={row.drawingNo} size="sm" />
                </Box>
              </Box>
              <Box sx={{ mt: 0.75, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                <Box><Typography sx={rowPrimarySx}>{row.bomNumber}</Typography><Typography sx={rowMutedSx}>Revision {row.revisionNo}</Typography></Box>
                <MatFlowStatusChip status={row.status} />
              </Box>
            </Card>
          ))}
        </Box>
      ) : (
        <MatFlowListGrid
          columns={[
            ...(canPermanentDelete ? [{ key: "select", label: "", width: "48px", align: "center" }] : []),
            { key: "product", label: "Product / PD", width: "300px" },
            { key: "bom", label: "BOM / Drawing", width: "minmax(330px,1.4fr)" },
            { key: "revision", label: "Revision", width: "110px" },
            { key: "status", label: "Status", width: "180px" },
            { key: "updated", label: "Updated", width: "190px" },
          ]}
          rows={filteredRows}
          minWidth={canPermanentDelete ? 1168 : 1120}
          getRowKey={(row) => row.id}
          onRowClick={(row) => nav(`/matflow/boms/${row.id}`)}
          rowAriaLabel={(row) => `Open BOM ${row.bomNumber || ""}`}
          renderCell={(row, column) => {
            if (column.key === "select") return (
              <Box onClick={(event) => event.stopPropagation()} sx={{ display: "flex", justifyContent: "center" }}>
                <Checkbox
                  size="small"
                  checked={selectedBomDeleteIds.includes(row.id)}
                  onChange={() => toggleBomSelection(row.id)}
                  inputProps={{ "aria-label": `Select BOM ${row.bomNumber || "record"} for permanent delete` }}
                  sx={{ p: 0.35, color: "var(--mf-text-muted)", "&.Mui-checked": { color: "var(--mf-danger-text)" } }}
                />
              </Box>
            );
            if (column.key === "product") return <MatFlowProductIdentity productName={row.productName} projectCode={row.projectCode} productionFileNo={row.productionFileNo} drawingNo={row.drawingNo} size="sm" />;
            if (column.key === "bom") return <Box><Typography sx={rowPrimarySx}>{row.bomNumber}</Typography><Typography sx={rowMutedSx}>{row.drawingNo ? `Drawing ${row.drawingNo}` : "Drawing not assigned"}</Typography></Box>;
            if (column.key === "revision") return <Typography sx={rowSecondarySx}>Rev {row.revisionNo}</Typography>;
            if (column.key === "status") return <MatFlowStatusChip status={row.status} />;
            return <Typography sx={rowMutedSx}>{row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "—"}</Typography>;
          }}
        />
      )}

      <Card sx={{ ...panelSx, p: 0, overflow: "hidden" }}>
        <Box sx={{ px: 1.5, py: 1.25, borderBottom: "1px solid var(--mf-border)" }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 950, color: "var(--mf-text)" }}>Product BOM Readiness inside each PD / Project</Typography>
          <Typography sx={{ mt: 0.2, fontSize: 9.8, color: "var(--mf-text-muted)" }}>
            The whole PD / Project is handed to Engineering once. Each active child Product then gets its own BOM inside that same Production File.
          </Typography>
        </Box>

        {!pendingBomItems.length ? (
          <EmptyState>Every active Product already has a current BOM.</EmptyState>
        ) : viewMode === "CARD" ? (
          <Box sx={{ p: 1, display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(2,minmax(0,1fr))" }, gap: 0.8 }}>
            {pendingBomItems.slice(0, 50).map((item) => (
              <Box key={`${item.file.id}:${item.product?.id || "NO_PRODUCT"}`} sx={{ p: 1.1, border: "1px solid var(--mf-border)", borderRadius: 1.5, display: "grid", gap: 0.75, background: "var(--mf-panel-solid)" }}>
                <MatFlowProductIdentity productName={item.product?.productName || item.project?.projectName || "No Product yet"} projectCode={item.file.projectCode} productionFileNo={item.file.productionFileNo} drawingNo={item.product?.drawingNo} size="sm" />
                <Box sx={{ display: "flex", gap: 0.7, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 850, color: "var(--mf-text-secondary)" }}>{readable(item.file.stage)}</Typography>
                  <MatFlowStatusChip status={item.file.releaseHealth} />
                </Box>
                <Typography sx={{ fontSize: 9.7, fontWeight: 800, color: item.eligible ? "var(--mf-success-text)" : "var(--mf-text-muted)" }}>{readinessText(item)}</Typography>
                <Button size="small" onClick={() => nav(`/matflow/work?fileId=${item.file.id}`)} sx={secondaryBtnSx}>Open PD / Project File</Button>
              </Box>
            ))}
          </Box>
        ) : (
          <Box sx={{ p: 1 }}>
            <MatFlowListGrid
              columns={[
                { key: "product", label: "Product / PD", width: "300px" },
                { key: "stage", label: "Project Stage", width: "180px" },
                { key: "health", label: "Health", width: "150px" },
                { key: "readiness", label: "Product BOM Readiness", width: "minmax(300px,1fr)" },
                { key: "action", label: "", width: "160px", align: "right" },
              ]}
              rows={pendingBomItems.slice(0, 50)}
              minWidth={1090}
              getRowKey={(item) => `${item.file.id}:${item.product?.id || "NO_PRODUCT"}`}
              rowAccent={(item) => String(item.file.releaseHealth || "").toUpperCase() === "RED" ? "var(--mf-danger-text)" : String(item.file.releaseHealth || "").toUpperCase() === "AMBER" ? "var(--mf-warning-text)" : String(item.file.releaseHealth || "").toUpperCase() === "GREEN" ? "var(--mf-success-text)" : "transparent"}
              renderCell={(item, column) => {
                if (column.key === "product") return <MatFlowProductIdentity productName={item.product?.productName || item.project?.projectName || "No Product yet"} projectCode={item.file.projectCode} productionFileNo={item.file.productionFileNo} drawingNo={item.product?.drawingNo} size="sm" />;
                if (column.key === "stage") return <Typography sx={{ fontSize: 10, fontWeight: 850, color: "var(--mf-text-secondary)" }}>{readable(item.file.stage)}</Typography>;
                if (column.key === "health") return <MatFlowStatusChip status={item.file.releaseHealth} />;
                if (column.key === "readiness") return <Typography sx={{ fontSize: 9.7, fontWeight: 850, color: item.eligible ? "var(--mf-success-text)" : "var(--mf-text-muted)" }}>{readinessText(item)}</Typography>;
                return <Button size="small" onClick={() => nav(`/matflow/work?fileId=${item.file.id}`)} sx={secondaryBtnSx}>Open Project File</Button>;
              }}
            />
          </Box>
        )}
      </Card>

      <Dialog open={bulkDeleteOpen} onClose={closeBulkDelete} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle sx={dialogTitleSx}>ADMIN · Permanently Delete Selected BOMs?</DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Box sx={{ display: "grid", gap: 1, pt: 0.5 }}>
            <Typography sx={{ fontSize: 11.5, lineHeight: 1.6, color: "var(--mf-danger-text)", fontWeight: 850 }}>
              This action is irreversible.
            </Typography>
            <Typography sx={{ fontSize: 10.5, lineHeight: 1.6, color: "var(--mf-text-secondary)" }}>
              {selectedBomDeleteIds.length} selected BOM{selectedBomDeleteIds.length === 1 ? "" : "s"} will be permanently removed in one transaction, including matching current and legacy BOM copies and their dependent BOM records.
            </Typography>
            <Typography sx={{ fontSize: 9.4, color: "var(--mf-text-muted)" }}>If any selected BOM cannot be purged, the entire batch is rolled back.</Typography>
            <TextField
              label='Type DELETE to confirm'
              value={bulkDeleteConfirm}
              onChange={(event) => setBulkDeleteConfirm(event.target.value)}
              autoComplete="off"
              sx={fieldSx}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={closeBulkDelete} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
          <Button
            onClick={permanentlyDeleteSelectedBoms}
            disabled={working || !selectedBomDeleteIds.length || bulkDeleteConfirm.trim().toUpperCase() !== "DELETE"}
            startIcon={<DeleteOutlineOutlinedIcon />}
            sx={{ ...secondaryBtnSx, color: "var(--mf-danger-text)", borderColor: "var(--mf-danger-border)", background: "var(--mf-danger-soft)" }}
          >
            {working ? "Deleting..." : `Permanently Delete ${selectedBomDeleteIds.length} BOM${selectedBomDeleteIds.length === 1 ? "" : "s"}`}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={open} onClose={() => !working && setOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle sx={dialogTitleSx}>Start Product BOM inside PD / Project</DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Box sx={{ pt: 0.7, display: "grid", gap: 1 }}>
            <TextField
              select
              fullWidth
              label="PD / Project Production File"
              value={fileId}
              onChange={(event) => { setFileId(event.target.value); setProductId(""); }}
              sx={fieldSx}
            >
              {availableFiles.map((file) => {
                const project = projectsById.get(file.projectId);
                return <MenuItem key={file.id} value={file.id}>{project?.projectName || file.projectName || "Unnamed Project"} — PD No. {file.projectCode || "not assigned"} · {file.productionFileNo}</MenuItem>;
              })}
            </TextField>

            <TextField select fullWidth disabled={!fileId} label="Product" value={productId} onChange={(event) => setProductId(event.target.value)} sx={fieldSx}>
              {availableProducts.map((product) => (
                <MenuItem key={product.id} value={product.id}>{product.productName || "Unnamed Product"}{product.drawingNo ? ` · Drawing ${product.drawingNo}` : " · Drawing not assigned"}</MenuItem>
              ))}
            </TextField>

            <Typography sx={{ fontSize: 10.5, lineHeight: 1.5, color: "var(--mf-text-muted)" }}>
              Engineering receives the whole PD / Project. Select the child Product whose BOM you are authoring; this does not create another Production File or another handoff.
            </Typography>

            {!availableFiles.length && (
              <Box sx={{ p: 1.2, borderRadius: 1.5, border: "1px solid var(--mf-border)", background: "var(--mf-surface)", color: "var(--mf-text-muted)", fontSize: 10.5, fontWeight: 750 }}>
                No Product is currently ready to start a BOM. The PD / Project must first reach Engineering Work with Engineering approval.
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={() => setOpen(false)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
          <Button disabled={!fileId || !productId || working} onClick={create} sx={primaryBtnSx}>{working ? "Creating..." : "Create Product BOM"}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/* -------------------------------------------------------------------------- */
/* BOM BUILDER                                                                */
/* -------------------------------------------------------------------------- */

export function MatFlowBomDetailPage() {
  const { bomId } = useParams();
  const { hasRole } = useMatFlow();
  const canPermanentDelete = hasRole(MATFLOW_ROLES.ADMIN);
  const [viewMode, setViewMode] = useMatFlowViewMode("bom-detail", "LIST");
  const nav = useNavigate();

  const [bom, setBom] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lineDialog, setLineDialog] = useState({ open: false, mode: "add" });
  const [line, setLine] = useState(lineBlank);
  const [deleteLine, setDeleteLine] = useState(null);
  const [permanentDeleteOpen, setPermanentDeleteOpen] = useState(false);
  const [permanentDeleteConfirm, setPermanentDeleteConfirm] = useState("");
  const [openSections, setOpenSections] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [bomResponse, materialsResponse] = await Promise.all([
        matflowApi.getBom(bomId),
        matflowApi.listMaterials({ active: true }),
      ]);

      const nextBom = bomResponse.data;
      setBom(nextBom);
      setMaterials(Array.isArray(materialsResponse?.data) ? materialsResponse.data : []);

      setOpenSections((current) => {
        const next = { ...current };
        (nextBom?.lines || []).forEach((row) => {
          const key = String(row.category || "Miscellaneous");
          if (next[key] === undefined) next[key] = true;
        });
        return next;
      });
    } catch (requestError) {
      setError(readMatFlowError(requestError, "Unable to load BOM."));
    } finally {
      setLoading(false);
    }
  }, [bomId]);

  useEffect(() => {
    load();
  }, [load]);

  const editable = bom?.editable === true;
  const canCreateRevision = bom?.canCreateRevision === true;

  const groupedSections = useMemo(() => {
    const groups = new Map();

    (bom?.lines || []).forEach((row) => {
      const category = String(row.category || "").trim() || "Miscellaneous";
      if (!groups.has(category)) {
        groups.set(category, {
          title: category,
          rows: [],
          requiredQty: 0,
          netQty: 0,
        });
      }
      const group = groups.get(category);
      group.rows.push(row);
      group.requiredQty += Number(row.requiredQty || 0);
      group.netQty += Number(row.netRequiredQty || 0);
    });

    return Array.from(groups.values()).sort((a, b) => {
      const aIndex = SECTION_ORDER.findIndex(
        (value) => value.toLowerCase() === a.title.toLowerCase()
      );
      const bIndex = SECTION_ORDER.findIndex(
        (value) => value.toLowerCase() === b.title.toLowerCase()
      );
      if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
      if (aIndex >= 0) return -1;
      if (bIndex >= 0) return 1;
      return a.title.localeCompare(b.title);
    });
  }, [bom]);

  const summary = useMemo(() => {
    const rows = bom?.lines || [];
    return {
      lines: rows.length,
      sections: groupedSections.length,
      requiredQty: rows.reduce((sum, row) => sum + Number(row.requiredQty || 0), 0),
      netQty: rows.reduce((sum, row) => sum + Number(row.netRequiredQty || 0), 0),
    };
  }, [bom, groupedSections]);

  const pickMaterial = (materialId) => {
    if (!materialId) {
      setLine((current) => ({
        ...current,
        materialId: "",
      }));
      return;
    }

    const material = materials.find((item) => item.id === materialId);
    if (!material) return;

    setLine((current) => ({
      ...current,
      materialId: material.id,
      materialCode: material.materialCode || "",
      materialName: material.materialName || "",
      category: material.category || current.category || "Miscellaneous",
      specification: material.specification || "",
      uom: material.uom || "NOS",
    }));
  };

  const openAdd = (category = "Wood") => {
    if (!editable) return;
    setLine({
      ...lineBlank,
      category: category || "Wood",
    });
    setLineDialog({ open: true, mode: "add" });
  };

  const openEdit = (row) => {
    if (!editable) return;
    setLine({
      materialId: row.materialId || "",
      materialCode: row.materialCode || "",
      materialName: row.materialName || "",
      category: row.category || "Miscellaneous",
      specification: row.specification || "",
      uom: row.uom || "NOS",
      requiredQty: row.requiredQty ?? "",
      wastagePercent: row.wastagePercent ?? "0",
      remarks: row.remarks || "",
      rowVersion: row.rowVersion,
      id: row.id,
    });
    setLineDialog({ open: true, mode: "edit" });
  };

  const saveLine = async () => {
    const validation = validateLine(line);
    if (validation) {
      setError(validation);
      return;
    }

    setWorking(true);
    setError("");
    try {
      const payload = normalizeLinePayload(line);
      if (lineDialog.mode === "edit") {
        await matflowApi.updateBomLine(bomId, line.id, payload);
      } else {
        await matflowApi.addBomLine(bomId, payload);
      }

      setLineDialog({ open: false, mode: "add" });
      setLine(lineBlank);
      await load();
    } catch (requestError) {
      setError(readMatFlowError(requestError, "Unable to save BOM line."));
    } finally {
      setWorking(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteLine) return;
    setWorking(true);
    setError("");
    try {
      await matflowApi.deleteBomLine(bomId, deleteLine.id, deleteLine.rowVersion);
      setDeleteLine(null);
      await load();
    } catch (requestError) {
      setError(readMatFlowError(requestError, "Unable to delete BOM line."));
    } finally {
      setWorking(false);
    }
  };

  const downloadBom = async () => {
    if (!bom) return;
    setExporting(true);
    setError("");
    try {
      await downloadMatFlowBomExcel(bom);
    } catch (requestError) {
      setError(requestError?.message || "Unable to download BOM workbook.");
    } finally {
      setExporting(false);
    }
  };

  const submit = async () => {
    if (!bom) return;
    setWorking(true);
    setError("");
    try {
      await matflowApi.submitBom(bomId, {
        remarks: bom.remarks,
        rowVersion: bom.rowVersion,
      });
      await load();
    } catch (requestError) {
      setError(readMatFlowError(requestError, "Unable to mark BOM Ready for Release."));
    } finally {
      setWorking(false);
    }
  };

  const createRevision = async () => {
    if (!bom) return;
    setWorking(true);
    setError("");
    try {
      const response = await matflowApi.createBomRevision(bomId, {
        remarks: `Revision from ${bom.bomNumber}`,
        rowVersion: bom.rowVersion,
      });
      nav(`/matflow/boms/${response.data.id}`);
    } catch (requestError) {
      setError(readMatFlowError(requestError, "Unable to create BOM revision."));
    } finally {
      setWorking(false);
    }
  };

  const closePermanentDelete = () => {
    if (working) return;
    setPermanentDeleteOpen(false);
    setPermanentDeleteConfirm("");
  };

  const permanentlyDeleteBom = async () => {
    if (!canPermanentDelete || permanentDeleteConfirm.trim().toUpperCase() !== "DELETE") return;
    setWorking(true);
    setError("");
    try {
      await matflowApi.permanentlyDeleteBom(bomId);
      setPermanentDeleteOpen(false);
      setPermanentDeleteConfirm("");
      nav("/matflow/boms", { replace: true });
    } catch (requestError) {
      setError(readMatFlowError(requestError, "Unable to permanently delete BOM."));
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <LoadingBlock />;

  if (!bom) {
    return (
      <Box sx={pageSx}>
        <ErrorBox>{error || "BOM not found."}</ErrorBox>
      </Box>
    );
  }

  return (
    <Box sx={pageSx}>
      <PageHero
        badge="BOM BUILDER"
        title={bom.productName || bom.bomNumber}
        subtitle={`${bom.projectCode ? `PD No. ${bom.projectCode}` : "PD No. not assigned"} · Project File ${bom.productionFileNo || "—"} · Product ${bom.productName || "—"}${bom.drawingNo ? ` · Drawing ${bom.drawingNo}` : ""} · ${bom.bomNumber}`}
        actions={
          <Box sx={{ display: "flex", gap: 0.7, flexWrap: "wrap", alignItems: "center" }}>
            <MatFlowViewToggle value={viewMode} onChange={setViewMode} options={MATFLOW_LIST_CARD_OPTIONS} />
            <Button
              startIcon={<ArrowBackOutlinedIcon />}
              onClick={() => nav("/matflow/boms")}
              sx={secondaryBtnSx}
            >
              Back
            </Button>
            <Button
              startIcon={<RefreshOutlinedIcon />}
              onClick={load}
              disabled={working}
              sx={secondaryBtnSx}
            >
              Refresh
            </Button>
            <Button
              startIcon={<FileDownloadOutlinedIcon />}
              onClick={downloadBom}
              disabled={exporting}
              sx={secondaryBtnSx}
            >
              {exporting ? "Preparing…" : "Download BOM"}
            </Button>
            {canPermanentDelete && (
              <Button
                startIcon={<DeleteOutlineOutlinedIcon />}
                onClick={() => { setPermanentDeleteConfirm(""); setPermanentDeleteOpen(true); }}
                disabled={working}
                sx={{ ...secondaryBtnSx, color: "var(--mf-danger-text)", borderColor: "var(--mf-danger-border)", background: "var(--mf-danger-soft)" }}
              >
                Permanent Delete
              </Button>
            )}
            {editable && (
              <Button
                startIcon={<AddOutlinedIcon />}
                onClick={() => openAdd()}
                disabled={working}
                sx={secondaryBtnSx}
              >
                Add Material
              </Button>
            )}
            {editable && (
              <Button
                onClick={submit}
                disabled={working || summary.lines === 0}
                sx={primaryBtnSx}
              >
                Ready for Release
              </Button>
            )}
            {canCreateRevision && (
              <Button onClick={createRevision} disabled={working} sx={primaryBtnSx}>
                {bom.legacyImported ? "Create Current Revision" : "Create Revision"}
              </Button>
            )}
          </Box>
        }
      />

      {error && <ErrorBox>{error}</ErrorBox>}

      <Card sx={{ ...panelSx, p: 1.35 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            flexWrap: "wrap",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.7, flexWrap: "wrap" }}>
            <MatFlowStatusChip status={bom.status} />
            <Chip
              label={`Revision ${bom.revisionNo}`}
              size="small"
              sx={softChipSx}
            />
            {bom.latestRevision && (
              <Chip label="Current revision" size="small" sx={softChipSx} />
            )}
            {bom.legacyImported && (
              <Chip label="Legacy BOM · historical" size="small" sx={softChipSx} />
            )}
          </Box>
          <Typography sx={{ fontSize: 10.5, color: "var(--mf-text-muted)" }}>
            {bom.legacyImported
              ? canCreateRevision
                ? "Historical BOM preserved exactly · Engineering is approved, so a current editable revision can now be created"
                : "Historical Product BOM preserved exactly · Read-only until the shared PD / Project Production File reaches approved Engineering Work"
              : "Engineering material structure only · No costing/procurement workflow in this phase"}
          </Typography>
        </Box>
      </Card>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" },
          gap: 1,
        }}
      >
        <MiniMetric label="Material Lines" value={summary.lines} />
        <MiniMetric label="Sections" value={summary.sections} />
        <MiniMetric label="Required Qty" value={number(summary.requiredQty)} />
        <MiniMetric label="Net Qty incl. Wastage" value={number(summary.netQty)} />
      </Box>

      <Card sx={{ ...panelSx, p: 0, overflow: "hidden" }}>
        <Box sx={builderHeaderSx}>
          <Box>
            <Typography sx={builderTitleSx}>Material Structure</Typography>
            <Typography sx={builderSubSx}>
              Grouped by engineering section. Add from Material Master or enter a manual line.
            </Typography>
          </Box>
          {editable && (
            <Button
              startIcon={<AddOutlinedIcon />}
              onClick={() => openAdd()}
              sx={secondaryBtnSx}
            >
              Add Row
            </Button>
          )}
        </Box>

        {!groupedSections.length ? (
          <EmptyState>
            No BOM material lines yet. Add the first material row to start the engineering structure.
          </EmptyState>
        ) : (
          <Box sx={{ display: "grid", gap: 0 }}>
            {groupedSections.map((section) => {
              const accent = sectionAccent(section.title);
              const isOpen = openSections[section.title] !== false;

              return (
                <Box
                  key={section.title}
                  sx={{
                    borderTop: "1px solid var(--mf-border)",
                    "&:first-of-type": { borderTop: "none" },
                  }}
                >
                  <Box sx={sectionHeaderSx}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, minWidth: 0 }}>
                      <IconButton
                        size="small"
                        onClick={() =>
                          setOpenSections((current) => ({
                            ...current,
                            [section.title]: !isOpen,
                          }))
                        }
                        sx={sectionToggleSx}
                      >
                        {isOpen ? <ExpandLessOutlinedIcon /> : <ExpandMoreOutlinedIcon />}
                      </IconButton>

                      <Box
                        sx={{
                          width: 4,
                          height: 30,
                          borderRadius: 99,
                          background: accent,
                          flexShrink: 0,
                        }}
                      />

                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={sectionTitleSx}>{section.title}</Typography>
                        <Typography sx={sectionMetaSx}>
                          {section.rows.length} {section.rows.length === 1 ? "item" : "items"} · Net Qty {number(section.netQty)}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.7 }}>
                      <Typography sx={sectionQtySx}>
                        Required {number(section.requiredQty)}
                      </Typography>
                      {editable && (
                        <Button
                          size="small"
                          startIcon={<AddOutlinedIcon />}
                          onClick={() => openAdd(section.title)}
                          sx={sectionAddSx}
                        >
                          Add
                        </Button>
                      )}
                    </Box>
                  </Box>

                  <Collapse in={isOpen}>
                    <SectionTable
                      rows={section.rows}
                      editable={editable}
                      onEdit={openEdit}
                      onDelete={setDeleteLine}
                      viewMode={viewMode}
                    />
                  </Collapse>
                </Box>
              );
            })}
          </Box>
        )}
      </Card>

      <Dialog
        open={lineDialog.open}
        onClose={() => !working && setLineDialog({ open: false, mode: "add" })}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: dialogPaperSx }}
      >
        <DialogTitle sx={dialogTitleSx}>
          {lineDialog.mode === "edit" ? "Edit BOM Material" : "Add BOM Material"}
        </DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Box
            sx={{
              pt: 0.6,
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: 1.05,
            }}
          >
            <TextField
              select
              label="Material Master (optional)"
              value={line.materialId}
              onChange={(event) => pickMaterial(event.target.value)}
              sx={{ ...fieldSx, gridColumn: { md: "1 / -1" } }}
            >
              <MenuItem value="">Manual material</MenuItem>
              {materials.map((material) => (
                <MenuItem key={material.id} value={material.id}>
                  {material.materialCode} · {material.materialName}
                  {material.category ? ` · ${material.category}` : ""}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Section / Category *"
              value={line.category}
              onChange={(event) => setLine((current) => ({ ...current, category: event.target.value }))}
              helperText="Examples: Metal, Wood, Hardware, Stone, Glass, Fabric / Upholstery, Paint & Polish"
              sx={fieldSx}
            />

            <TextField
              label="Material Code"
              value={line.materialCode}
              onChange={(event) =>
                setLine((current) => ({ ...current, materialCode: event.target.value }))
              }
              sx={fieldSx}
            />

            <TextField
              label="Material Name *"
              value={line.materialName}
              onChange={(event) =>
                setLine((current) => ({ ...current, materialName: event.target.value }))
              }
              sx={{ ...fieldSx, gridColumn: { md: "1 / -1" } }}
            />

            <TextField
              label="Specification"
              value={line.specification}
              onChange={(event) =>
                setLine((current) => ({ ...current, specification: event.target.value }))
              }
              multiline
              minRows={2}
              sx={{ ...fieldSx, gridColumn: { md: "1 / -1" } }}
            />

            <TextField
              label="UOM *"
              value={line.uom}
              onChange={(event) =>
                setLine((current) => ({ ...current, uom: event.target.value }))
              }
              sx={fieldSx}
            />

            <TextField
              type="number"
              label="Required Qty *"
              value={line.requiredQty}
              onChange={(event) =>
                setLine((current) => ({ ...current, requiredQty: event.target.value }))
              }
              inputProps={{ min: 0, step: "0.001" }}
              sx={fieldSx}
            />

            <TextField
              type="number"
              label="Wastage %"
              value={line.wastagePercent}
              onChange={(event) =>
                setLine((current) => ({ ...current, wastagePercent: event.target.value }))
              }
              inputProps={{ min: 0, step: "0.01" }}
              sx={fieldSx}
            />

            <TextField
              label="Remarks"
              value={line.remarks}
              onChange={(event) =>
                setLine((current) => ({ ...current, remarks: event.target.value }))
              }
              sx={fieldSx}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button
            onClick={() => setLineDialog({ open: false, mode: "add" })}
            disabled={working}
            sx={secondaryBtnSx}
          >
            Cancel
          </Button>
          <Button onClick={saveLine} disabled={working} sx={primaryBtnSx}>
            {working
              ? "Saving..."
              : lineDialog.mode === "edit"
              ? "Save Changes"
              : "Add Material"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={permanentDeleteOpen}
        onClose={closePermanentDelete}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: dialogPaperSx }}
      >
        <DialogTitle sx={dialogTitleSx}>ADMIN · Permanently Delete BOM?</DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Box sx={{ display: "grid", gap: 1, pt: 0.5 }}>
            <Typography sx={{ fontSize: 11.5, lineHeight: 1.6, color: "var(--mf-danger-text)", fontWeight: 850 }}>
              This action cannot be undone.
            </Typography>
            <Typography sx={{ fontSize: 10.5, lineHeight: 1.6, color: "var(--mf-text-secondary)" }}>
              {bom?.bomNumber || "This BOM"} · Revision {bom?.revisionNo || "—"} will be physically removed. If this is an imported legacy BOM, its old mf_boms / mf_bom_lines record and the current compatibility copy are removed together. Any dependent MatFlow rows are purged first.
            </Typography>
            <TextField
              label="Type DELETE to confirm"
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
            onClick={permanentlyDeleteBom}
            disabled={working || permanentDeleteConfirm.trim().toUpperCase() !== "DELETE"}
            startIcon={<DeleteOutlineOutlinedIcon />}
            sx={{ ...secondaryBtnSx, color: "var(--mf-danger-text)", borderColor: "var(--mf-danger-border)", background: "var(--mf-danger-soft)" }}
          >
            {working ? "Deleting..." : "Permanently Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(deleteLine)}
        onClose={() => !working && setDeleteLine(null)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: dialogPaperSx }}
      >
        <DialogTitle sx={dialogTitleSx}>Delete BOM Material?</DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Typography sx={{ fontSize: 11.5, lineHeight: 1.55, color: "var(--mf-text-secondary)" }}>
            {deleteLine?.materialName || "This material line"} will be removed from the draft BOM.
            Remaining line numbers will be re-sequenced automatically.
          </Typography>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={() => setDeleteLine(null)} disabled={working} sx={secondaryBtnSx}>
            Cancel
          </Button>
          <Button
            onClick={confirmDelete}
            disabled={working}
            sx={{
              ...secondaryBtnSx,
              color: "var(--mf-danger-text)",
              borderColor: "var(--mf-danger-border)",
              background: "var(--mf-danger-soft)",
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function SectionTable({ rows, editable, onEdit, onDelete, viewMode = "LIST" }) {
  if (viewMode === "CARD") {
    return (
      <Box sx={{ p: 1, display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2,minmax(0,1fr))" }, gap: 0.8 }}>
        {rows.map((row) => (
          <Card key={row.id} sx={{ ...panelSx, p: 1.05, boxShadow: "none", display: "grid", gap: 0.7 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={tableStrongSx}>{row.materialName || "Unnamed material"}</Typography>
                <Typography sx={tableMutedSx}>#{row.lineNo} · {row.materialCode || "No material code"}</Typography>
              </Box>
              <Typography sx={tableStrongSx}>{row.uom || "—"}</Typography>
            </Box>
            <Typography sx={tableTextSx}>{row.specification || "—"}</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0.6 }}>
              <Box><Typography sx={tableMutedSx}>Required</Typography><Typography sx={tableNumberSx}>{number(row.requiredQty)}</Typography></Box>
              <Box><Typography sx={tableMutedSx}>Wastage</Typography><Typography sx={tableNumberSx}>{number(row.wastagePercent, 2)}%</Typography></Box>
              <Box><Typography sx={tableMutedSx}>Net Qty</Typography><Typography sx={tableNumberSx}>{number(row.netRequiredQty)}</Typography></Box>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.3 }}>
              <IconButton size="small" disabled={!editable} onClick={() => onEdit(row)} sx={tableActionSx} aria-label={`Edit ${row.materialName || "BOM material"}`}><EditOutlinedIcon fontSize="small" /></IconButton>
              <IconButton size="small" disabled={!editable} onClick={() => onDelete(row)} sx={{ ...tableActionSx, "&:hover": { color: "var(--mf-danger-text)", background: "var(--mf-danger-soft)" } }} aria-label={`Delete ${row.materialName || "BOM material"}`}><DeleteOutlineOutlinedIcon fontSize="small" /></IconButton>
            </Box>
          </Card>
        ))}
      </Box>
    );
  }
  return (
    <Box sx={tableScrollSx}>
      <Box sx={tableHeadSx}><div>#</div><div>Material</div><div>Specification</div><div>UOM</div><div>Required</div><div>Wastage</div><div>Net Qty</div><div /></Box>
      {rows.map((row) => (
        <Box key={row.id} sx={tableRowSx}>
          <Typography sx={tableMutedSx}>{row.lineNo}</Typography>
          <Box sx={{ minWidth: 0 }}><Typography sx={tableStrongSx}>{row.materialName || "Unnamed material"}</Typography><Typography sx={tableMutedSx}>{row.materialCode || "No material code"}</Typography></Box>
          <Typography sx={tableTextSx}>{row.specification || "—"}</Typography>
          <Typography sx={tableStrongSx}>{row.uom || "—"}</Typography>
          <Typography sx={tableNumberSx}>{number(row.requiredQty)}</Typography>
          <Typography sx={tableMutedSx}>{number(row.wastagePercent, 2)}%</Typography>
          <Typography sx={tableNumberSx}>{number(row.netRequiredQty)}</Typography>
          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.3 }}>
            <IconButton size="small" disabled={!editable} onClick={() => onEdit(row)} sx={tableActionSx} aria-label={`Edit ${row.materialName || "BOM material"}`}><EditOutlinedIcon fontSize="small" /></IconButton>
            <IconButton size="small" disabled={!editable} onClick={() => onDelete(row)} sx={{ ...tableActionSx, "&:hover": { color: "var(--mf-danger-text)", background: "var(--mf-danger-soft)" } }} aria-label={`Delete ${row.materialName || "BOM material"}`}><DeleteOutlineOutlinedIcon fontSize="small" /></IconButton>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function MiniMetric({ label, value }) {
  return (
    <Card sx={{ ...panelSx, p: 1.25, minWidth: 0 }}>
      <Typography
        sx={{
          fontSize: 9,
          fontWeight: 900,
          letterSpacing: ".05em",
          textTransform: "uppercase",
          color: "var(--mf-text-muted)",
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          mt: 0.35,
          fontSize: 18,
          lineHeight: 1.15,
          fontWeight: 950,
          color: "var(--mf-text)",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </Typography>
    </Card>
  );
}

const softChipSx = {
  height: 24,
  borderRadius: 1.2,
  background: "var(--mf-surface)",
  color: "var(--mf-text-secondary)",
  border: "1px solid var(--mf-border)",
  fontSize: 9.5,
  fontWeight: 850,
};

const listHeadSx = {
  display: { xs: "none", md: "grid" },
  gridTemplateColumns: "1.15fr 1.25fr .45fr .6fr .8fr",
  gap: 1,
  px: 1.5,
  py: 0.85,
  background: "var(--mf-table-head)",
  borderBottom: "1px solid var(--mf-border-strong)",
  position: "sticky",
  top: 0,
  zIndex: 1,
  color: "var(--mf-text-muted)",
  fontSize: 9,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".05em",
};

const listRowSx = {
  width: "100%",
  p: 0,
  px: 1.5,
  py: 1.1,
  display: "grid",
  gridTemplateColumns: { xs: "1fr", md: "1.15fr 1.25fr .45fr .6fr .8fr" },
  gap: { xs: 0.6, md: 1 },
  alignItems: "center",
  textAlign: "left",
  fontFamily: "inherit",
  color: "inherit",
  background: "var(--mf-table-row)",
  border: 0,
  borderBottom: "1px solid var(--mf-border)",
  cursor: "pointer",
  "&:last-child": { borderBottom: 0 },
  "&:hover": { background: "var(--mf-table-hover)" },
};

const rowPrimarySx = {
  fontSize: 11.5,
  fontWeight: 950,
  color: "var(--mf-text)",
};

const rowSecondarySx = {
  fontSize: 10.5,
  fontWeight: 800,
  color: "var(--mf-text-secondary)",
};

const rowMutedSx = {
  mt: 0.15,
  fontSize: 9.5,
  fontWeight: 700,
  color: "var(--mf-text-muted)",
};

const builderHeaderSx = {
  px: 1.5,
  py: 1.2,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 1,
  flexWrap: "wrap",
  background: "var(--mf-table-head)",
  borderBottom: "1px solid var(--mf-border)",
};

const builderTitleSx = {
  fontSize: 13,
  fontWeight: 950,
  color: "var(--mf-text)",
};

const builderSubSx = {
  mt: 0.2,
  fontSize: 10,
  fontWeight: 700,
  color: "var(--mf-text-muted)",
};

const sectionHeaderSx = {
  minHeight: 54,
  px: 1.2,
  py: 0.8,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 1,
  background: "var(--mf-panel-bg)",
};

const sectionToggleSx = {
  width: 30,
  height: 30,
  color: "var(--mf-text-muted)",
  border: "1px solid var(--mf-border)",
  borderRadius: 1.2,
  "&:hover": {
    color: "var(--mf-text)",
    background: "var(--mf-hover)",
  },
};

const sectionTitleSx = {
  fontSize: 12,
  fontWeight: 950,
  color: "var(--mf-text)",
};

const sectionMetaSx = {
  mt: 0.15,
  fontSize: 9.5,
  fontWeight: 700,
  color: "var(--mf-text-muted)",
};

const sectionQtySx = {
  display: { xs: "none", sm: "block" },
  fontSize: 9.5,
  fontWeight: 800,
  color: "var(--mf-text-secondary)",
};

const sectionAddSx = {
  ...secondaryBtnSx,
  height: 30,
  minWidth: 0,
  px: 1,
  fontSize: 9.5,
};

const tableScrollSx = {
  overflowX: "auto",
  borderTop: "1px solid var(--mf-border)",
};

const tableHeadSx = {
  minWidth: 1000,
  px: 1.1,
  display: "grid",
  gridTemplateColumns: "42px minmax(210px,1.6fr) minmax(220px,1.6fr) 80px 95px 85px 100px 82px",
  alignItems: "center",
  background: "var(--mf-table-head)",
  borderBottom: "1px solid var(--mf-border)",
  color: "var(--mf-text-muted)",
  fontSize: 8.8,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".05em",
  "& > div": { py: 0.85, px: 0.6 },
};

const tableRowSx = {
  minWidth: 1000,
  minHeight: 48,
  px: 1.1,
  display: "grid",
  gridTemplateColumns: "42px minmax(210px,1.6fr) minmax(220px,1.6fr) 80px 95px 85px 100px 82px",
  alignItems: "center",
  background: "var(--mf-table-row)",
  borderBottom: "1px solid var(--mf-border)",
  "&:last-child": { borderBottom: 0 },
  "& > p, & > div": { px: 0.6, py: 0.75 },
  "&:hover": { background: "var(--mf-table-hover)" },
};

const tableStrongSx = {
  fontSize: 10.5,
  fontWeight: 900,
  color: "var(--mf-text)",
};

const tableTextSx = {
  fontSize: 10,
  fontWeight: 700,
  color: "var(--mf-text-secondary)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const tableMutedSx = {
  fontSize: 9.5,
  fontWeight: 700,
  color: "var(--mf-text-muted)",
};

const tableNumberSx = {
  fontSize: 10.5,
  fontWeight: 900,
  color: "var(--mf-text)",
  fontVariantNumeric: "tabular-nums",
};

const tableActionSx = {
  width: 30,
  height: 30,
  color: "var(--mf-text-muted)",
  borderRadius: 1.2,
  "&:hover": {
    color: "var(--mf-primary-text)",
    background: "var(--mf-primary-soft)",
  },
  "&.Mui-disabled": {
    color: "var(--mf-text-muted)",
    opacity: 0.35,
  },
};
