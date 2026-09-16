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
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ExpandLessOutlinedIcon from "@mui/icons-material/ExpandLessOutlined";
import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { useNavigate, useParams } from "react-router-dom";
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
  const { selectedPlantParam } = useMatFlow();
  const nav = useNavigate();

  const [rows, setRows] = useState([]);
  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [fileId, setFileId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [bomsResponse, filesResponse] = await Promise.all([
        matflowApi.listBoms(),
        matflowApi.listProductionFiles({
          plantCode: selectedPlantParam,
        }),
      ]);

      setRows(Array.isArray(bomsResponse?.data) ? bomsResponse.data : []);
      setFiles(Array.isArray(filesResponse?.data) ? filesResponse.data : []);
    } catch (requestError) {
      setError(readMatFlowError(requestError, "Unable to load Engineering BOMs."));
    } finally {
      setLoading(false);
    }
  }, [selectedPlantParam]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch =
        !q ||
        [
          row.bomNumber,
          row.projectCode,
          row.productionFileNo,
          row.productName,
          row.drawingNo,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);

      const matchesStatus = !status || row.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, status]);

  const activeBomFileIds = useMemo(
    () =>
      new Set(
        rows
          .filter((row) => row.status !== "SUPERSEDED")
          .map((row) => row.productionFileId)
          .filter(Boolean)
      ),
    [rows]
  );

  const bomEligibleFiles = useMemo(
    () =>
      files.filter(
        (file) =>
          file.stage === "ENGINEERING_WORK" &&
          file.engineeringDecision === "APPROVED" &&
          !activeBomFileIds.has(file.id)
      ),
    [files, activeBomFileIds]
  );

  const availableFiles = bomEligibleFiles;

  const pendingBomFiles = useMemo(
    () => files.filter((file) => !activeBomFileIds.has(file.id)),
    [files, activeBomFileIds]
  );

  const stats = useMemo(() => {
    const latest = rows.filter((row) => row.latestRevision).length;
    const drafts = rows.filter((row) => row.status === "DRAFT").length;
    const ready = rows.filter((row) => row.status === "READY_FOR_RELEASE").length;
    return {
      total: rows.length,
      latest,
      drafts,
      ready,
      productionFiles: files.length,
      eligible: bomEligibleFiles.length,
    };
  }, [rows, files.length, bomEligibleFiles.length]);

  const create = async () => {
    if (!fileId) return;
    setWorking(true);
    setError("");
    try {
      const response = await matflowApi.createBom({
        productionFileId: fileId,
        remarks: null,
      });
      setOpen(false);
      setFileId("");
      nav(`/matflow/boms/${response.data.id}`);
    } catch (requestError) {
      setError(readMatFlowError(requestError, "Unable to create BOM."));
    } finally {
      setWorking(false);
    }
  };

  if (loading && !rows.length) return <LoadingBlock />;

  return (
    <Box sx={pageSx}>
      <PageHero
        badge="ENGINEERING BOM"
        title="BOM Builder"
        subtitle="A lean, section-wise engineering BOM linked to the Production File. MatFlow keeps material structure and release readiness here; costing and procurement remain outside this phase."
        actions={
          <Box sx={{ display: "flex", gap: 0.8, flexWrap: "wrap" }}>
            <Button
              startIcon={<RefreshOutlinedIcon />}
              onClick={load}
              disabled={loading}
              sx={secondaryBtnSx}
            >
              Refresh
            </Button>
            <Button
              startIcon={<AddOutlinedIcon />}
              onClick={() => {
                setFileId("");
                setOpen(true);
              }}
              sx={primaryBtnSx}
            >
              New BOM
            </Button>
          </Box>
        }
      />

      {error && <ErrorBox>{error}</ErrorBox>}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" },
          gap: 1,
        }}
      >
        <MiniMetric label="Production Files" value={stats.productionFiles} />
        <MiniMetric label="BOMs" value={stats.total} />
        <MiniMetric label="BOM Eligible" value={stats.eligible} />
        <MiniMetric label="Ready for Release" value={stats.ready} />
      </Box>

      <Card sx={{ ...panelSx, p: 1.25 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(0,1fr) 190px" },
            gap: 1,
          }}
        >
          <TextField
            size="small"
            label="Search BOM, PD, product or drawing"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={fieldSx}
          />
          <TextField
            select
            size="small"
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            sx={fieldSx}
          >
            <MenuItem value="">All statuses</MenuItem>
            {[
              "DRAFT",
              "SUBMITTED",
              "PRODUCTION_REVIEW_PENDING",
              "RETURNED",
              "APPROVED",
              "READY_FOR_RELEASE",
              "RELEASED",
              "SUPERSEDED",
            ].map((value) => (
              <MenuItem key={value} value={value}>
                {readable(value)}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Card>

      <Card sx={{ ...panelSx, p: 0, overflow: "hidden" }}>
        {!filteredRows.length ? (
          <EmptyState>No BOMs found.</EmptyState>
        ) : (
          <>
            <Box sx={listHeadSx}>
              <div>BOM / PD</div>
              <div>Product / Drawing</div>
              <div>Revision</div>
              <div>Status</div>
              <div>Updated</div>
            </Box>
            {filteredRows.map((row) => (
              <Box
                key={row.id}
                component="button"
                type="button"
                onClick={() => nav(`/matflow/boms/${row.id}`)}
                sx={listRowSx}
              >
                <Box>
                  <Typography sx={rowPrimarySx}>{row.bomNumber}</Typography>
                  <Typography sx={rowMutedSx}>
                    {row.projectCode} · {row.productionFileNo}
                  </Typography>
                </Box>

                <Box>
                  <Typography sx={rowSecondarySx}>{row.productName}</Typography>
                  <Typography sx={rowMutedSx}>{row.drawingNo}</Typography>
                </Box>

                <Typography sx={rowSecondarySx}>Rev {row.revisionNo}</Typography>
                <MatFlowStatusChip status={row.status} />
                <Typography sx={rowMutedSx}>
                  {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "—"}
                </Typography>
              </Box>
            ))}
          </>
        )}
      </Card>

      <Card sx={{ ...panelSx, p: 0, overflow: "hidden" }}>
        <Box sx={{ px: 1.5, py: 1.25, borderBottom: "1px solid var(--mf-border)" }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 950, color: "var(--mf-text)" }}>
            Production File BOM Readiness
          </Typography>
          <Typography sx={{ mt: 0.2, fontSize: 9.8, color: "var(--mf-text-muted)" }}>
            Every migrated/new Product appears here. BOM creation becomes available only after Engineering approval reaches Engineering Work.
          </Typography>
        </Box>

        {!pendingBomFiles.length ? (
          <EmptyState>Every active Production File already has a current BOM.</EmptyState>
        ) : (
          pendingBomFiles.slice(0, 40).map((file) => {
            const eligible =
              file.stage === "ENGINEERING_WORK" &&
              file.engineeringDecision === "APPROVED";
            return (
              <Box
                key={file.id}
                sx={{
                  px: 1.5,
                  py: 1.05,
                  borderBottom: "1px solid var(--mf-border)",
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1.25fr .8fr .7fr 1.1fr auto" },
                  gap: 1,
                  alignItems: "center",
                  "&:last-child": { borderBottom: 0 },
                }}
              >
                <Box>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 900, color: "var(--mf-text)" }}>
                    {file.projectCode} · {file.productName}
                  </Typography>
                  <Typography sx={{ mt: 0.15, fontSize: 9.5, color: "var(--mf-text-muted)" }}>
                    {file.productionFileNo} · {file.drawingNo}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: 10.2, fontWeight: 800, color: "var(--mf-text-secondary)" }}>
                  {readable(file.stage)}
                </Typography>
                <MatFlowStatusChip status={file.releaseHealth} />
                <Typography
                  sx={{
                    fontSize: 9.8,
                    fontWeight: 800,
                    color: eligible ? "var(--mf-success-text)" : "var(--mf-text-muted)",
                  }}
                >
                  {eligible ? "Ready to start BOM" : "Not yet BOM eligible"}
                </Typography>
                <Button
                  size="small"
                  onClick={() => nav(`/matflow/work?fileId=${file.id}`)}
                  sx={secondaryBtnSx}
                >
                  Open File
                </Button>
              </Box>
            );
          })
        )}
      </Card>

      <Dialog
        open={open}
        onClose={() => !working && setOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: dialogPaperSx }}
      >
        <DialogTitle sx={dialogTitleSx}>Start Engineering BOM</DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Box sx={{ pt: 0.7 }}>
            <TextField
              select
              fullWidth
              label="Production File"
              value={fileId}
              onChange={(event) => setFileId(event.target.value)}
              sx={fieldSx}
            >
              {availableFiles.map((file) => (
                <MenuItem key={file.id} value={file.id}>
                  {file.productionFileNo} · {file.projectCode} · {file.productName} · {file.drawingNo}
                </MenuItem>
              ))}
            </TextField>

            <Typography
              sx={{
                mt: 1,
                fontSize: 10.5,
                lineHeight: 1.5,
                color: "var(--mf-text-muted)",
              }}
            >
              Only Engineering-approved files currently in Engineering Work and without an active BOM are selectable. Earlier-stage Production Files remain visible in the BOM Readiness list above.
            </Typography>

            {!availableFiles.length && (
              <Box
                sx={{
                  mt: 1.2,
                  p: 1.2,
                  borderRadius: 1.5,
                  border: "1px solid var(--mf-border)",
                  background: "var(--mf-surface)",
                  color: "var(--mf-text-muted)",
                  fontSize: 10.5,
                  fontWeight: 750,
                }}
              >
                No Production File is currently ready to start a new BOM.
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={() => setOpen(false)} disabled={working} sx={secondaryBtnSx}>
            Cancel
          </Button>
          <Button disabled={!fileId || working} onClick={create} sx={primaryBtnSx}>
            {working ? "Creating..." : "Create BOM"}
          </Button>
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
  const nav = useNavigate();

  const [bom, setBom] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [lineDialog, setLineDialog] = useState({ open: false, mode: "add" });
  const [line, setLine] = useState(lineBlank);
  const [deleteLine, setDeleteLine] = useState(null);
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
        subtitle={`${bom.projectCode} · ${bom.productionFileNo} · ${bom.drawingNo} · ${bom.bomNumber}`}
        actions={
          <Box sx={{ display: "flex", gap: 0.7, flexWrap: "wrap" }}>
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
              <Chip label="Legacy BOM · preserved" size="small" sx={softChipSx} />
            )}
          </Box>
          <Typography sx={{ fontSize: 10.5, color: "var(--mf-text-muted)" }}>
            {bom.legacyImported
              ? canCreateRevision
                ? "Historical BOM preserved exactly · Engineering is approved, so a current editable revision can now be created"
                : "Historical BOM preserved exactly · Read-only until this Production File reaches approved Engineering Work"
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

function SectionTable({ rows, editable, onEdit, onDelete }) {
  return (
    <Box sx={tableScrollSx}>
      <Box sx={tableHeadSx}>
        <div>#</div>
        <div>Material</div>
        <div>Specification</div>
        <div>UOM</div>
        <div>Required</div>
        <div>Wastage</div>
        <div>Net Qty</div>
        <div />
      </Box>

      {rows.map((row) => (
        <Box key={row.id} sx={tableRowSx}>
          <Typography sx={tableMutedSx}>{row.lineNo}</Typography>

          <Box sx={{ minWidth: 0 }}>
            <Typography sx={tableStrongSx}>{row.materialName || "Unnamed material"}</Typography>
            <Typography sx={tableMutedSx}>{row.materialCode || "No material code"}</Typography>
          </Box>

          <Typography sx={tableTextSx}>{row.specification || "—"}</Typography>
          <Typography sx={tableStrongSx}>{row.uom || "—"}</Typography>
          <Typography sx={tableNumberSx}>{number(row.requiredQty)}</Typography>
          <Typography sx={tableMutedSx}>{number(row.wastagePercent, 2)}%</Typography>
          <Typography sx={tableNumberSx}>{number(row.netRequiredQty)}</Typography>

          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.3 }}>
            <IconButton
              size="small"
              disabled={!editable}
              onClick={() => onEdit(row)}
              sx={tableActionSx}
              aria-label={`Edit ${row.materialName || "BOM material"}`}
            >
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              disabled={!editable}
              onClick={() => onDelete(row)}
              sx={{
                ...tableActionSx,
                "&:hover": { color: "var(--mf-danger-text)", background: "var(--mf-danger-soft)" },
              }}
              aria-label={`Delete ${row.materialName || "BOM material"}`}
            >
              <DeleteOutlineOutlinedIcon fontSize="small" />
            </IconButton>
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
  borderBottom: "1px solid var(--mf-border)",
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
