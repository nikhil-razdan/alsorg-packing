import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Box, Button, Card, Dialog, DialogActions, DialogContent, DialogTitle,
    FormControlLabel, MenuItem, Switch, TextField, Tooltip, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import ApprovalOutlinedIcon from "@mui/icons-material/ApprovalOutlined";
import UndoOutlinedIcon from "@mui/icons-material/UndoOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import TrackChangesOutlinedIcon from "@mui/icons-material/TrackChangesOutlined";
import {
    MATFLOW_ROLES, useMatFlow, ErrorBox, EmptyState, LoadingBlock,
    MATFLOW_MATERIAL_CATEGORIES, MatFlowStatusChip, PageHero, clean,
    dialogActionsSx, dialogContentSx, dialogPaperSx, dialogTitleSx, fieldSx,
    formatDate, mainTextSx, normalize, pageSx, panelSx, primaryBtnSx, secondaryBtnSx, SummaryCard,
    subTextSx, tableCellSx, tableHeaderSx, tableRowSx, tableShellSx,
} from "../matflowUi";
import { useNavigate } from "react-router-dom";
import { extractMatFlowPage, matflowApi, readMatFlowError } from "../api/matflowApi";

const FALLBACK_LOCATION_TYPES = ["STORE", "PRODUCTION", "PROCESSING", "QC", "TRANSIT", "EXTERNAL_PROCESSOR", "SUPPLIER"];
const FALLBACK_OWNERSHIP_TYPES = ["INTERNAL", "EXTERNAL"];

const emptyMaterial = {
    materialCode: "", materialName: "", category: "", specification: "", uom: "",
    preferredSupplier: "", minimumStock: "0", reorderLevel: "0", active: true,
};
const emptyProject = {
    projectCode: "", projectName: "", clientName: "", drawingNo: "", drawingRevision: "0",
    productName: "", plantCode: "", requiredDate: "", remarks: "", active: true,
};
const emptyLocation = {
    locationCode: "", locationName: "", plantCode: "", locationType: "STORE",
    ownershipType: "INTERNAL", supportsStock: true, address: "", contactPerson: "",
    contactPhone: "", active: true,
};

const upperCode = (value) =>
    clean(value).toUpperCase();

const metadataEnum = (payload, name, fallback) => {
    const raw = payload?.enums?.[name] ?? payload?.data?.enums?.[name] ?? payload?.[name];
    return Array.isArray(raw) && raw.length ? raw : fallback;
};

function MasterDialog({ type, open, row, form, setForm, saving, availablePlants, metadata, onClose, onSave }) {
    const text = (key, label, extra = {}) => (
        <TextField key={key} label={label} value={form[key] ?? ""}
            onChange={(e) => setForm((c) => ({ ...c, [key]: e.target.value }))}
            disabled={saving} sx={fieldSx} {...extra} />
    );
    const plant = (
        <TextField select label="Plant *" value={form.plantCode || ""}
            onChange={(e) => setForm((c) => ({ ...c, plantCode: e.target.value }))}
            disabled={saving} sx={fieldSx}>
            {availablePlants.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
        </TextField>
    );

    return <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="md" PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle sx={dialogTitleSx}>{row ? "Edit" : "Add"} {type === "materials" ? "Material" : type === "projects" ? "Project Product" : "Location"}</DialogTitle>
        <DialogContent sx={dialogContentSx}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2,minmax(0,1fr))" }, gap: 1.5 }}>
                {type === "materials" && <>
                    {text("materialCode", "Material Code *")}{text("materialName", "Material Name *")}
                    <TextField select label="Category *" value={form.category || ""} onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))} sx={fieldSx}>
                        {MATFLOW_MATERIAL_CATEGORIES.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
                    </TextField>
                    {text("uom", "UOM *")}{text("preferredSupplier", "Preferred Supplier")}
                    {text("minimumStock", "Minimum Stock", { type: "number" })}{text("reorderLevel", "Reorder Level", { type: "number" })}
                    {text("specification", "Specification", { multiline: true, minRows: 3, sx: { ...fieldSx, gridColumn: "1 / -1" } })}
                </>}
                {type === "projects" && <>
                    {text("projectCode", "Project / PD Code *")}{text("projectName", "Project Name *")}
                    {text("clientName", "Client Name *")}{text("productName", "Product / Item *")}
                    {text("drawingNo", "Drawing No. *")}{text("drawingRevision", "Drawing Revision")}
                    {plant}{text("requiredDate", "Required Date", { type: "date", InputLabelProps: { shrink: true } })}
                    {text("remarks", "Remarks", { multiline: true, minRows: 3, sx: { ...fieldSx, gridColumn: "1 / -1" } })}
                </>}
                {type === "locations" && <>
                    {text("locationCode", "Location Code *")}{text("locationName", "Location Name *")}{plant}
                    <TextField select label="Location Type *" value={form.locationType || ""} onChange={(e) => setForm((c) => ({ ...c, locationType: e.target.value }))} sx={fieldSx}>
                        {metadata.locationTypes.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                    </TextField>
                    <TextField select label="Ownership *" value={form.ownershipType || ""} onChange={(e) => setForm((c) => ({ ...c, ownershipType: e.target.value }))} sx={fieldSx}>
                        {metadata.ownershipTypes.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                    </TextField>
                    {text("contactPerson", "Contact Person")}{text("contactPhone", "Contact Phone")}
                    {text("address", "Address", { multiline: true, minRows: 3, sx: { ...fieldSx, gridColumn: "1 / -1" } })}
                </>}
            </Box>
            <Box sx={{ mt: 1.5, display: "flex", gap: 2, flexWrap: "wrap" }}>
                {type === "locations" && <FormControlLabel control={<Switch checked={form.supportsStock === true} onChange={(e) => setForm((c) => ({ ...c, supportsStock: e.target.checked }))} />} label="Supports stock" />}
                <FormControlLabel control={<Switch checked={form.active !== false} onChange={(e) => setForm((c) => ({ ...c, active: e.target.checked }))} />} label="Active" />
            </Box>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}><Button onClick={onClose} sx={secondaryBtnSx}>Cancel</Button><Button onClick={onSave} disabled={saving} sx={primaryBtnSx}>{saving ? "Saving..." : "Save"}</Button></DialogActions>
    </Dialog>;
}

function MasterPage({ type }) {
    const { availablePlants, hasRole } = useMatFlow();
    const [rows, setRows] = useState([]), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
    const [error, setError] = useState(""), [search, setSearch] = useState("");
    const [dialog, setDialog] = useState(null), [approval, setApproval] = useState(null), [approvalRemarks, setApprovalRemarks] = useState("");
    const [form, setForm] = useState(type === "materials" ? emptyMaterial : type === "projects" ? emptyProject : emptyLocation);
    const [metadata, setMetadata] = useState({ locationTypes: FALLBACK_LOCATION_TYPES, ownershipTypes: FALLBACK_OWNERSHIP_TYPES });

    const canManage = type === "materials"
        ? hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.STORE, MATFLOW_ROLES.PURCHASE)
        : type === "projects"
            ? hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.ENGINEERING)
            : hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.STORE);
    const canApproveProduct = type === "projects" && hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.DIRECTOR);

    const api = useMemo(() => type === "materials"
        ? { list: matflowApi.listMaterials, create: matflowApi.createMaterial, update: matflowApi.updateMaterial }
        : type === "projects"
            ? { list: matflowApi.listProjects, create: matflowApi.createProject, update: matflowApi.updateProject }
            : { list: matflowApi.listLocations, create: matflowApi.createLocation, update: matflowApi.updateLocation }, [type]);

    const load = useCallback(async () => {
        setLoading(true); setError("");
        try { setRows(extractMatFlowPage((await api.list({ search: clean(search) || undefined }))?.data).rows); }
        catch (e) { setRows([]); setError(readMatFlowError(e, "Unable to load MatFlow master data.")); }
        finally { setLoading(false); }
    }, [api, search]);
    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        if (type !== "locations") return;
        matflowApi.metadata().then((r) => setMetadata({
            locationTypes: metadataEnum(r?.data, "locationType", FALLBACK_LOCATION_TYPES),
            ownershipTypes: metadataEnum(r?.data, "ownershipType", FALLBACK_OWNERSHIP_TYPES),
        })).catch(() => { });
    }, [type]);

    const blank = type === "materials" ? emptyMaterial : type === "projects" ? emptyProject : emptyLocation;
    const openCreate = () => { setDialog({ row: null }); setForm({ ...blank, plantCode: blank.plantCode || availablePlants[0] || "" }); setError(""); };
    const openEdit = (row) => { const next = { ...blank }; Object.keys(next).forEach((k) => { if (row[k] != null) next[k] = typeof next[k] === "boolean" ? row[k] === true : String(row[k]); }); setDialog({ row }); setForm(next); setError(""); };

    const validate = () => {
        if (type === "materials") {
            if (!clean(form.materialCode) || !clean(form.materialName) || !clean(form.category) || !clean(form.uom)) return "Material code, name, category and UOM are required.";
        } else if (type === "projects") {
            if (![form.projectCode, form.projectName, form.clientName, form.productName, form.drawingNo, form.plantCode].every((v) => clean(v))) return "Project code, Project Name, Client, Product, Drawing and Plant are required.";
        } else if (![form.locationCode, form.locationName, form.plantCode, form.locationType, form.ownershipType].every((v) => clean(v))) return "Location code, name, plant, type and ownership are required.";
        return "";
    };
    const body = () => {
        if (type === "materials") {
            return {
                ...form,

                // Business identifier: preserve -, ., / etc.
                materialCode: upperCode(
                    form.materialCode
                ),

                materialName:
                    clean(form.materialName),

                // Category is an enum-like value.
                category:
                    normalize(form.category),

                specification:
                    clean(form.specification) || null,

                // UOM is a business code, not an enum.
                // Preserve values such as SQ.FT, SQ-M, KG/M2, etc.
                uom:
                    upperCode(form.uom),

                preferredSupplier:
                    clean(form.preferredSupplier) || null,

                minimumStock:
                    Number(form.minimumStock || 0),

                reorderLevel:
                    Number(form.reorderLevel || 0),

                active:
                    form.active === true,

                rowVersion:
                    dialog?.row?.rowVersion ?? null,
            };
        }

        if (type === "projects") {
            return {
                ...form,

                // Preserve project/PD punctuation.
                projectCode:
                    upperCode(form.projectCode),

                projectName:
                    clean(form.projectName),

                clientName:
                    clean(form.clientName),

                // Preserve WR-359.06 etc.
                drawingNo:
                    upperCode(form.drawingNo),

                drawingRevision:
                    upperCode(form.drawingRevision) || "0",

                productName:
                    clean(form.productName),

                // CRITICAL FIX:
                // AL-P1 must remain AL-P1.
                plantCode:
                    upperCode(form.plantCode),

                requiredDate:
                    clean(form.requiredDate) || null,

                remarks:
                    clean(form.remarks) || null,

                active:
                    form.active === true,

                rowVersion:
                    dialog?.row?.rowVersion ?? null,
            };
        }

        return {
            ...form,

            // Preserve codes such as QC-AL-P1.
            locationCode:
                upperCode(form.locationCode),

            locationName:
                clean(form.locationName),

            // CRITICAL FIX:
            // AL-P1 must remain AL-P1.
            plantCode:
                upperCode(form.plantCode),

            // These ARE enum values.
            locationType:
                normalize(form.locationType),

            ownershipType:
                normalize(
                    form.ownershipType || "INTERNAL"
                ),

            supportsStock:
                form.supportsStock === true,

            address:
                clean(form.address) || null,

            contactPerson:
                clean(form.contactPerson) || null,

            contactPhone:
                clean(form.contactPhone) || null,

            active:
                form.active === true,

            rowVersion:
                dialog?.row?.rowVersion ?? null,
        };
    };
    const save = async () => {
        const message = validate(); if (message) { setError(message); return; }
        setSaving(true); setError("");
        try { dialog?.row?.id ? await api.update(dialog.row.id, body()) : await api.create(body()); setDialog(null); await load(); }
        catch (e) { setError(readMatFlowError(e, "Unable to save MatFlow master record.")); }
        finally { setSaving(false); }
    };
    const decideProduct = async () => {
        if (!approval?.row?.id) return;
        if (approval.type === "RETURN" && !clean(approvalRemarks)) { setError("Return remarks are required."); return; }
        setSaving(true); setError("");
        try {
            const request = { rowVersion: approval.row.rowVersion, remarks: clean(approvalRemarks) || null };
            if (approval.type === "APPROVE") await matflowApi.approveProjectProduct(approval.row.id, request);
            else await matflowApi.returnProjectProduct(approval.row.id, request);
            setApproval(null); setApprovalRemarks(""); await load();
        } catch (e) { setError(readMatFlowError(e, "Unable to complete Director product approval.")); }
        finally { setSaving(false); }
    };

    const title = type === "materials" ? "Material Master" : type === "projects" ? "Projects & Products" : "Material Locations";
    const columns = type === "materials" ? ["Material", "Category", "UOM", "Min / Reorder", "Status", "Action"]
        : type === "projects" ? ["Project", "Product / Drawing", "Client", "Plant", "Director Approval", "Required", "Action"]
            : ["Location", "Plant", "Type", "Ownership", "Stock", "Status", "Action"];
    const grid = `repeat(${columns.length},minmax(130px,1fr))`;

    const rowCells = (row) => {
        if (type === "materials") return [
            <Box><Typography sx={mainTextSx}>{row.materialCode}</Typography><Typography sx={subTextSx}>{row.materialName}</Typography></Box>, row.category, row.uom,
            `${row.minimumStock ?? 0} / ${row.reorderLevel ?? 0}`, <MatFlowStatusChip status={row.active ? "ACTIVE" : "INACTIVE"} />,
            canManage ? <Button onClick={() => openEdit(row)} sx={secondaryBtnSx}><EditOutlinedIcon fontSize="small" /></Button> : "-",
        ];
        if (type === "projects") return [
            <Box><Typography sx={mainTextSx}>{row.projectCode}</Typography><Typography sx={subTextSx}>{row.projectName}</Typography></Box>,
            <Box><Typography sx={mainTextSx}>{row.productName}</Typography><Typography sx={subTextSx}>{row.drawingNo} · Rev {row.drawingRevision ?? "0"}</Typography></Box>,
            row.clientName || "-", row.plantCode || "-", <Box><MatFlowStatusChip status={row.productApprovalStatus || "PENDING_DIRECTOR_APPROVAL"} />{row.productApprovedBy && <Typography sx={subTextSx}>By {row.productApprovedBy}</Typography>}</Box>, row.requiredDate || "-",
            <Box sx={{ display: "flex", gap: .5, flexWrap: "wrap" }}>
                {canManage && <Button onClick={() => openEdit(row)} sx={secondaryBtnSx}><EditOutlinedIcon fontSize="small" /></Button>}
                {canApproveProduct && normalize(row.productApprovalStatus) !== "APPROVED" && <Button onClick={() => { setApproval({ type: "APPROVE", row }); setApprovalRemarks(""); }} sx={primaryBtnSx}>Approve</Button>}
                {canApproveProduct && normalize(row.productApprovalStatus) !== "RETURNED" && <Button onClick={() => { setApproval({ type: "RETURN", row }); setApprovalRemarks(""); }} sx={secondaryBtnSx}>Return</Button>}
            </Box>,
        ];
        return [<Box><Typography sx={mainTextSx}>{row.locationCode}</Typography><Typography sx={subTextSx}>{row.locationName}</Typography></Box>, row.plantCode, row.locationType, row.ownershipType, row.supportsStock ? "Yes" : "No", <MatFlowStatusChip status={row.active ? "ACTIVE" : "INACTIVE"} />, canManage ? <Button onClick={() => openEdit(row)} sx={secondaryBtnSx}><EditOutlinedIcon fontSize="small" /></Button> : "-"];
    };

    return <Box sx={pageSx}>
        <PageHero badge={type === "projects" ? "PROJECT / PRODUCT APPROVAL" : "MATFLOW MASTER DATA"} title={title}
            subtitle={type === "projects" ? "Create one or more products/drawings under a client project. Director approval is mandatory before Engineering can create its operational BOM." : "Maintain MatFlow operational reference data."}
            actions={canManage ? <Button startIcon={<AddIcon />} onClick={openCreate} sx={primaryBtnSx}>{type === "projects" ? "Add Product" : "Add"}</Button> : null} />
        <Card sx={panelSx}><Box sx={{ display: "flex", gap: 1 }}><TextField label="Search" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} sx={{ ...fieldSx, flex: 1 }} /><Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button></Box></Card>
        <ErrorBox>{error}</ErrorBox>
        <Card sx={panelSx}>{loading ? <LoadingBlock /> : <Box sx={tableShellSx}>
            <Box sx={{ ...tableHeaderSx, gridTemplateColumns: grid }}>{columns.map((h) => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>
            {rows.length === 0 ? <EmptyState /> : rows.map((row) => <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: grid }}>{rowCells(row).map((cell, i) => <Box key={i} sx={tableCellSx}>{cell}</Box>)}</Box>)}
        </Box>}</Card>
        <MasterDialog type={type} open={Boolean(dialog)} row={dialog?.row} form={form} setForm={setForm} saving={saving} availablePlants={availablePlants} metadata={metadata} onClose={() => setDialog(null)} onSave={save} />
        <Dialog open={Boolean(approval)} onClose={() => !saving && setApproval(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
            <DialogTitle sx={dialogTitleSx}>{approval?.type === "APPROVE" ? <><ApprovalOutlinedIcon /> Director Product Approval</> : <><UndoOutlinedIcon /> Return Product to Engineering</>}</DialogTitle>
            <DialogContent sx={dialogContentSx}><Typography sx={mainTextSx}>{approval?.row?.projectCode} · {approval?.row?.productName} · {approval?.row?.drawingNo}</Typography><TextField fullWidth multiline minRows={3} label={approval?.type === "RETURN" ? "Return Remarks *" : "Approval Remarks"} value={approvalRemarks} onChange={(e) => setApprovalRemarks(e.target.value)} sx={{ ...fieldSx, mt: 1.5 }} /></DialogContent>
            <DialogActions sx={dialogActionsSx}><Button onClick={() => setApproval(null)} sx={secondaryBtnSx}>Cancel</Button><Button onClick={decideProduct} disabled={saving} sx={primaryBtnSx}>Confirm</Button></DialogActions>
        </Dialog>
    </Box>;
}

const blankProjectHeader = {
    projectCode: "", projectName: "", clientName: "", plantCode: "",
    requiredDate: "", priority: "NORMAL", projectManager: "", remarks: "", active: true,
};

const blankPortfolioProduct = {
    productName: "", drawingNo: "", drawingRevision: "0", requiredDate: "", remarks: "", active: true,
};

const dangerBtnSx = {
    ...secondaryBtnSx,
    color: "var(--mf-danger-text)",
    borderColor: "var(--mf-danger-border)",
    background: "var(--mf-danger-soft)",
    "&:hover": {
        borderColor: "var(--mf-danger-text)",
        background: "var(--mf-danger-soft)",
    },
    "&.Mui-disabled": {
        color: "var(--mf-text-muted)",
        borderColor: "var(--mf-border)",
        background: "var(--mf-surface)",
    },
};

const projectDirectoryItemSx = (selected) => ({
    width: "100%",
    textAlign: "left",
    cursor: "pointer",
    p: 1.35,
    borderRadius: 2,
    border: selected
        ? "1px solid var(--mf-primary-border)"
        : "1px solid var(--mf-border)",
    background: selected
        ? "var(--mf-primary-soft)"
        : "var(--mf-panel-bg)",
    transition: "border-color .15s ease, background .15s ease, transform .15s ease",
    "&:hover": {
        borderColor: "var(--mf-primary-border)",
        background: selected ? "var(--mf-primary-soft)" : "var(--mf-hover)",
        transform: "translateY(-1px)",
    },
});

const registryMetaSx = {
    p: 1.2,
    minHeight: 74,
    borderRadius: 2,
    border: "1px solid var(--mf-border)",
    background: "var(--mf-surface)",
};

const priorityLabelSx = (priority) => {
    const value = normalize(priority || "NORMAL");
    const danger = value === "CRITICAL";
    const warning = value === "HIGH";
    return {
        display: "inline-flex",
        alignItems: "center",
        px: .9,
        py: .35,
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: .25,
        color: danger
            ? "var(--mf-danger-text)"
            : warning
                ? "var(--mf-warning-text)"
                : "var(--mf-primary-text)",
        background: danger
            ? "var(--mf-danger-soft)"
            : warning
                ? "var(--mf-warning-soft)"
                : "var(--mf-primary-soft)",
        border: danger
            ? "1px solid var(--mf-danger-border)"
            : warning
                ? "1px solid var(--mf-warning-border)"
                : "1px solid var(--mf-primary-border)",
    };
};

const productHasExecutionHistory = (product) =>
    Boolean(product?.latestBomId || product?.latestRequisitionId);

/**
 * Project Portfolio / master administration workspace.
 *
 * Deliberately NOT a second material tracker:
 * - this page owns Project headers and Product/Drawing registry data;
 * - Director product approval and BOM hand-off live here;
 * - material custody, shortages, stage timing and next actions live only in
 *   the dedicated Project Material Tracker.
 */
export function MatFlowProjectsPage() {
    const navigate = useNavigate();
    const { availablePlants, selectedPlantParam, hasRole } = useMatFlow();

    const canManage = hasRole(
        MATFLOW_ROLES.ADMIN,
        MATFLOW_ROLES.MANAGER,
        MATFLOW_ROLES.ENGINEERING
    );
    const canApprove = hasRole(
        MATFLOW_ROLES.ADMIN,
        MATFLOW_ROLES.MANAGER,
        MATFLOW_ROLES.DIRECTOR
    );

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [priorityFilter, setPriorityFilter] = useState("ALL");
    const [approvalFilter, setApprovalFilter] = useState("ALL");
    const [selectedProjectId, setSelectedProjectId] = useState("");

    const [projectDialog, setProjectDialog] = useState(null);
    const [productDialog, setProductDialog] = useState(null);
    const [approval, setApproval] = useState(null);
    const [approvalRemarks, setApprovalRemarks] = useState("");
    const [deleteTarget, setDeleteTarget] = useState(null);

    const [projectForm, setProjectForm] = useState(blankProjectHeader);
    const [productForm, setProductForm] = useState(blankPortfolioProduct);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await matflowApi.listProjectPortfolio({
                plantCode: selectedPlantParam || undefined,
                active: undefined,
            });
            setRows(Array.isArray(response?.data) ? response.data : []);
        } catch (requestError) {
            setRows([]);
            setError(readMatFlowError(requestError, "Unable to load Projects & Products portfolio."));
        } finally {
            setLoading(false);
        }
    }, [selectedPlantParam]);

    useEffect(() => {
        load();
    }, [load]);

    const filteredRows = useMemo(() => {
        const query = clean(search).toLowerCase();
        const status = normalize(statusFilter);
        const priority = normalize(priorityFilter);
        const approvalState = normalize(approvalFilter);

        return rows.filter((project) => {
            if (status === "ACTIVE" && project.active === false) return false;
            if (status === "INACTIVE" && project.active !== false) return false;
            if (priority !== "ALL" && normalize(project.priority || "NORMAL") !== priority) return false;

            const products = Array.isArray(project.products) ? project.products : [];
            if (
                approvalState !== "ALL" &&
                !products.some((product) => normalize(product.approvalStatus) === approvalState)
            ) {
                return false;
            }

            if (!query) return true;

            const projectMatch = [
                project.projectCode,
                project.projectName,
                project.clientName,
                project.projectManager,
                project.plantCode,
            ].some((value) => String(value ?? "").toLowerCase().includes(query));

            const productMatch = products.some((product) =>
                [
                    product.productName,
                    product.drawingNo,
                    product.drawingRevision,
                    product.latestBomNumber,
                ].some((value) => String(value ?? "").toLowerCase().includes(query))
            );

            return projectMatch || productMatch;
        });
    }, [rows, search, statusFilter, priorityFilter, approvalFilter]);

    useEffect(() => {
        if (filteredRows.length === 0) {
            if (selectedProjectId) setSelectedProjectId("");
            return;
        }

        const stillVisible = filteredRows.some(
            (project) => String(project.id) === String(selectedProjectId)
        );
        if (!stillVisible) {
            setSelectedProjectId(String(filteredRows[0].id));
        }
    }, [filteredRows, selectedProjectId]);

    const selectedProject = useMemo(
        () => filteredRows.find(
            (project) => String(project.id) === String(selectedProjectId)
        ) || null,
        [filteredRows, selectedProjectId]
    );

    const allProducts = useMemo(
        () => rows.flatMap((project) => Array.isArray(project.products) ? project.products : []),
        [rows]
    );

    const portfolioKpis = useMemo(() => {
        const approved = allProducts.filter(
            (product) => normalize(product.approvalStatus) === "APPROVED"
        ).length;
        const pending = allProducts.filter(
            (product) => normalize(product.approvalStatus) === "PENDING_DIRECTOR_APPROVAL"
        ).length;
        const withoutBom = allProducts.filter((product) => !product.latestBomId).length;
        return {
            projects: rows.length,
            activeProjects: rows.filter((project) => project.active !== false).length,
            products: allProducts.length,
            approved,
            pending,
            withoutBom,
        };
    }, [rows, allProducts]);

    const openProject = (row = null) => {
        setProjectDialog({ row });
        setProjectForm(row ? {
            projectCode: row.projectCode || "",
            projectName: row.projectName || "",
            clientName: row.clientName || "",
            plantCode: row.plantCode || "",
            requiredDate: row.requiredDate || "",
            priority: row.priority || "NORMAL",
            projectManager: row.projectManager || "",
            remarks: row.remarks || "",
            active: row.active !== false,
        } : {
            ...blankProjectHeader,
            plantCode: selectedPlantParam || availablePlants[0] || "",
        });
        setError("");
    };

    const saveProject = async () => {
        if (
            ![
                projectForm.projectCode,
                projectForm.projectName,
                projectForm.clientName,
                projectForm.plantCode,
            ].every((value) => Boolean(clean(value)))
        ) {
            setError("Project code, Project name, Client and Plant are required.");
            return;
        }

        const body = {
            projectCode: upperCode(projectForm.projectCode),
            projectName: clean(projectForm.projectName),
            clientName: clean(projectForm.clientName),
            plantCode: upperCode(projectForm.plantCode),
            requiredDate: projectForm.requiredDate || null,
            priority: upperCode(projectForm.priority || "NORMAL"),
            projectManager: clean(projectForm.projectManager) || null,
            remarks: clean(projectForm.remarks) || null,
            active: projectForm.active !== false,
            rowVersion: projectDialog?.row?.rowVersion ?? null,
        };

        setSaving(true);
        setError("");
        try {
            const response = projectDialog?.row?.id
                ? await matflowApi.updateProjectPortfolio(projectDialog.row.id, body)
                : await matflowApi.createProjectPortfolio(body);

            const savedId = response?.data?.id || projectDialog?.row?.id || null;
            setProjectDialog(null);
            await load();
            if (savedId) setSelectedProjectId(String(savedId));
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to save Project."));
        } finally {
            setSaving(false);
        }
    };

    const openProduct = (project, product = null) => {
        setProductDialog({ project, product });
        setProductForm(product ? {
            productName: product.productName || "",
            drawingNo: product.drawingNo || "",
            drawingRevision: product.drawingRevision || "0",
            requiredDate: product.requiredDate || "",
            remarks: "",
            active: product.active !== false,
        } : {
            ...blankPortfolioProduct,
            requiredDate: project?.requiredDate || "",
        });
        setError("");
    };

    const saveProduct = async () => {
        const { project, product } = productDialog || {};
        if (!project?.id || !clean(productForm.productName) || !clean(productForm.drawingNo)) {
            setError("Project, Product name and Drawing number are required.");
            return;
        }

        const body = {
            productName: clean(productForm.productName),
            drawingNo: upperCode(productForm.drawingNo),
            drawingRevision: upperCode(productForm.drawingRevision) || "0",
            requiredDate: productForm.requiredDate || null,
            remarks: clean(productForm.remarks) || null,
            active: productForm.active !== false,
            rowVersion: product?.rowVersion ?? null,
        };

        setSaving(true);
        setError("");
        try {
            if (product?.id) {
                await matflowApi.updateProjectProduct(project.id, product.id, body);
            } else {
                await matflowApi.addProjectProduct(project.id, body);
            }
            setProductDialog(null);
            setSelectedProjectId(String(project.id));
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to save Project Product."));
        } finally {
            setSaving(false);
        }
    };

    const decideProduct = async () => {
        if (!approval?.project?.id || !approval?.product?.id) return;
        if (approval.type === "RETURN" && !clean(approvalRemarks)) {
            setError("Return remarks are required.");
            return;
        }

        setSaving(true);
        setError("");
        try {
            const body = {
                rowVersion: approval.product.rowVersion,
                remarks: clean(approvalRemarks) || null,
            };

            if (approval.type === "APPROVE") {
                await matflowApi.approvePortfolioProduct(
                    approval.project.id,
                    approval.product.id,
                    body
                );
            } else {
                await matflowApi.returnPortfolioProduct(
                    approval.project.id,
                    approval.product.id,
                    body
                );
            }

            setApproval(null);
            setApprovalRemarks("");
            setSelectedProjectId(String(approval.project.id));
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to complete Director Product decision."));
        } finally {
            setSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;

        setSaving(true);
        setError("");
        try {
            if (deleteTarget.kind === "PROJECT") {
                await matflowApi.deleteProjectPortfolio(
                    deleteTarget.project.id,
                    deleteTarget.project.rowVersion
                );
                if (String(selectedProjectId) === String(deleteTarget.project.id)) {
                    setSelectedProjectId("");
                }
            } else {
                await matflowApi.deleteProjectProduct(
                    deleteTarget.project.id,
                    deleteTarget.product.id,
                    deleteTarget.product.rowVersion
                );
                setSelectedProjectId(String(deleteTarget.project.id));
            }

            setDeleteTarget(null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(
                requestError,
                deleteTarget.kind === "PROJECT"
                    ? "Unable to delete Project."
                    : "Unable to delete Product."
            ));
        } finally {
            setSaving(false);
        }
    };

    const selectedProducts = Array.isArray(selectedProject?.products)
        ? selectedProject.products
        : [];
    const selectedApprovedCount = selectedProducts.filter(
        (product) => normalize(product.approvalStatus) === "APPROVED"
    ).length;
    const selectedApprovalPercent = selectedProducts.length
        ? Math.round((selectedApprovedCount / selectedProducts.length) * 100)
        : 0;
    const projectDeleteBlocked = selectedProducts.some(productHasExecutionHistory);

    const projectDeleteReason = projectDeleteBlocked
        ? "This Project contains Product(s) with a BOM or material requisition. Deactivate it instead so execution history stays traceable."
        : "Delete this Project and its setup-only Product records.";

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="PROJECT PORTFOLIO ADMINISTRATION"
                title="Projects & Products"
                subtitle="Master the client Project structure here: create Project headers, maintain the Product / Drawing register, control Director approval, and hand approved Products to Engineering BOM. Live material custody, shortages, stage timing and execution remain exclusively in Project Material Tracker."
                actions={
                    <>
                        <Button
                            startIcon={<TrackChangesOutlinedIcon />}
                            onClick={() => navigate("/matflow/tracker")}
                            sx={secondaryBtnSx}
                        >
                            Open Material Tracker
                        </Button>
                        <Button
                            startIcon={<RefreshIcon />}
                            onClick={load}
                            sx={secondaryBtnSx}
                        >
                            Refresh
                        </Button>
                        {canManage && (
                            <Button
                                startIcon={<AddIcon />}
                                onClick={() => openProject()}
                                sx={primaryBtnSx}
                            >
                                Create Project
                            </Button>
                        )}
                    </>
                }
            />

            <ErrorBox>{error}</ErrorBox>

            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))",
                    gap: 1,
                }}
            >
                <SummaryCard label="Client Projects" value={portfolioKpis.projects} colorful />
                <SummaryCard label="Active Projects" value={portfolioKpis.activeProjects} colorful />
                <SummaryCard label="Products / Items" value={portfolioKpis.products} colorful />
                <SummaryCard label="Awaiting Director" value={portfolioKpis.pending} colorful />
                <SummaryCard label="Director Approved" value={portfolioKpis.approved} colorful />
                <SummaryCard label="Products Without BOM" value={portfolioKpis.withoutBom} colorful />
            </Box>

            <Card sx={panelSx}>
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: {
                            xs: "1fr",
                            md: "minmax(260px,1.5fr) repeat(3,minmax(150px,.6fr))",
                        },
                        gap: 1,
                    }}
                >
                    <TextField
                        label="Search project, client, manager, product or drawing"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        sx={fieldSx}
                    />
                    <TextField
                        select
                        label="Project Status"
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        sx={fieldSx}
                    >
                        <MenuItem value="ALL">All Projects</MenuItem>
                        <MenuItem value="ACTIVE">Active</MenuItem>
                        <MenuItem value="INACTIVE">Inactive</MenuItem>
                    </TextField>
                    <TextField
                        select
                        label="Priority"
                        value={priorityFilter}
                        onChange={(event) => setPriorityFilter(event.target.value)}
                        sx={fieldSx}
                    >
                        <MenuItem value="ALL">All Priorities</MenuItem>
                        {["LOW", "NORMAL", "HIGH", "CRITICAL"].map((value) => (
                            <MenuItem key={value} value={value}>{value}</MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        select
                        label="Product Approval"
                        value={approvalFilter}
                        onChange={(event) => setApprovalFilter(event.target.value)}
                        sx={fieldSx}
                    >
                        <MenuItem value="ALL">All Approval States</MenuItem>
                        <MenuItem value="PENDING_DIRECTOR_APPROVAL">Pending Director</MenuItem>
                        <MenuItem value="APPROVED">Approved</MenuItem>
                        <MenuItem value="RETURNED">Returned</MenuItem>
                    </TextField>
                </Box>
            </Card>

            {loading ? (
                <LoadingBlock />
            ) : filteredRows.length === 0 ? (
                <Card sx={panelSx}>
                    <EmptyState>No Projects match the current portfolio filters.</EmptyState>
                </Card>
            ) : (
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: {
                            xs: "1fr",
                            lg: "minmax(280px,.72fr) minmax(0,2.1fr)",
                        },
                        gap: 1.25,
                        alignItems: "start",
                    }}
                >
                    <Card sx={{ ...panelSx, p: 0, overflow: "hidden" }}>
                        <Box sx={{ px: 1.45, py: 1.25, borderBottom: "1px solid var(--mf-border)" }}>
                            <Typography sx={{ fontWeight: 950, fontSize: 15 }}>
                                Project Directory
                            </Typography>
                            <Typography sx={subTextSx}>
                                {filteredRows.length} portfolio record{filteredRows.length === 1 ? "" : "s"}. Select one to administer its Product register.
                            </Typography>
                        </Box>
                        <Box
                            sx={{
                                p: 1,
                                display: "grid",
                                gap: .75,
                                maxHeight: { lg: "calc(100vh - 330px)" },
                                overflowY: "auto",
                            }}
                        >
                            {filteredRows.map((project) => {
                                const selected = String(project.id) === String(selectedProjectId);
                                const count = Number(project.productCount || 0);
                                const approved = Number(project.approvedProductCount || 0);
                                return (
                                    <Box
                                        key={project.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setSelectedProjectId(String(project.id))}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                setSelectedProjectId(String(project.id));
                                            }
                                        }}
                                        sx={projectDirectoryItemSx(selected)}
                                    >
                                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "flex-start" }}>
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography noWrap sx={{ ...mainTextSx, fontSize: 13.5 }}>
                                                    {project.projectCode || "No Code"}
                                                </Typography>
                                                <Typography noWrap sx={{ ...subTextSx, mt: .15 }}>
                                                    {project.projectName || "Unnamed Project"}
                                                </Typography>
                                            </Box>
                                            <MatFlowStatusChip status={project.active === false ? "INACTIVE" : "ACTIVE"} />
                                        </Box>
                                        <Typography noWrap sx={{ ...subTextSx, mt: .75 }}>
                                            {project.clientName || "No Client"} · {project.plantCode || "No Plant"}
                                        </Typography>
                                        <Box sx={{ mt: .85, display: "flex", justifyContent: "space-between", gap: 1 }}>
                                            <Typography sx={subTextSx}>{count} Product{count === 1 ? "" : "s"}</Typography>
                                            <Typography sx={subTextSx}>{approved}/{count || 0} Approved</Typography>
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Card>

                    {!selectedProject ? (
                        <Card sx={panelSx}>
                            <EmptyState>Select a Project from the directory.</EmptyState>
                        </Card>
                    ) : (
                        <Box sx={{ display: "grid", gap: 1.1, minWidth: 0 }}>
                            <Card sx={panelSx}>
                                <Box
                                    sx={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        gap: 1.5,
                                        flexWrap: "wrap",
                                        alignItems: "flex-start",
                                    }}
                                >
                                    <Box sx={{ minWidth: 0 }}>
                                        <Box sx={{ display: "flex", gap: .75, flexWrap: "wrap", alignItems: "center" }}>
                                            <Typography sx={{ fontWeight: 950, fontSize: 20 }}>
                                                {selectedProject.projectCode} · {selectedProject.projectName}
                                            </Typography>
                                            <Box sx={priorityLabelSx(selectedProject.priority)}>
                                                {normalize(selectedProject.priority || "NORMAL")}
                                            </Box>
                                            <MatFlowStatusChip status={selectedProject.active === false ? "INACTIVE" : "ACTIVE"} />
                                        </Box>
                                        <Typography sx={{ ...subTextSx, mt: .45 }}>
                                            {selectedProject.clientName} · {selectedProject.plantCode}
                                            {selectedProject.projectManager ? ` · Owner ${selectedProject.projectManager}` : ""}
                                        </Typography>
                                    </Box>

                                    <Box sx={{ display: "flex", gap: .65, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                        {canManage && (
                                            <Button
                                                startIcon={<EditOutlinedIcon />}
                                                onClick={() => openProject(selectedProject)}
                                                sx={secondaryBtnSx}
                                            >
                                                Edit Project
                                            </Button>
                                        )}
                                        {canManage && selectedProject.active !== false && (
                                            <Button
                                                startIcon={<AddIcon />}
                                                onClick={() => openProduct(selectedProject)}
                                                sx={primaryBtnSx}
                                            >
                                                Add Product
                                            </Button>
                                        )}
                                        <Button
                                            startIcon={<TrackChangesOutlinedIcon />}
                                            onClick={() => navigate("/matflow/tracker")}
                                            sx={secondaryBtnSx}
                                        >
                                            Material Tracker
                                        </Button>
                                        {canManage && (
                                            <Tooltip title={projectDeleteReason} placement="top" arrow>
                                                <span>
                                                    <Button
                                                        startIcon={<DeleteOutlineIcon />}
                                                        onClick={() => setDeleteTarget({
                                                            kind: "PROJECT",
                                                            project: selectedProject,
                                                        })}
                                                        disabled={projectDeleteBlocked || saving}
                                                        sx={dangerBtnSx}
                                                    >
                                                        Delete Project
                                                    </Button>
                                                </span>
                                            </Tooltip>
                                        )}
                                    </Box>
                                </Box>

                                <Box
                                    sx={{
                                        mt: 1.4,
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fit,minmax(135px,1fr))",
                                        gap: .8,
                                    }}
                                >
                                    <Box sx={registryMetaSx}>
                                        <Typography sx={subTextSx}>PROJECT OWNER</Typography>
                                        <Typography sx={{ ...mainTextSx, mt: .35 }}>
                                            {selectedProject.projectManager || "Unassigned"}
                                        </Typography>
                                    </Box>
                                    <Box sx={registryMetaSx}>
                                        <Typography sx={subTextSx}>REQUIRED DATE</Typography>
                                        <Typography sx={{ ...mainTextSx, mt: .35 }}>
                                            {selectedProject.requiredDate ? formatDate(selectedProject.requiredDate, false) : "Not set"}
                                        </Typography>
                                    </Box>
                                    <Box sx={registryMetaSx}>
                                        <Typography sx={subTextSx}>PRODUCT REGISTER</Typography>
                                        <Typography sx={{ ...mainTextSx, mt: .35 }}>
                                            {selectedProducts.length} Product{selectedProducts.length === 1 ? "" : "s"}
                                        </Typography>
                                    </Box>
                                    <Box sx={registryMetaSx}>
                                        <Typography sx={subTextSx}>DIRECTOR APPROVAL</Typography>
                                        <Typography sx={{ ...mainTextSx, mt: .35 }}>
                                            {selectedApprovedCount}/{selectedProducts.length || 0} Approved
                                        </Typography>
                                        <Box sx={{ mt: .65, height: 5, borderRadius: 99, background: "var(--mf-surface-strong)", overflow: "hidden" }}>
                                            <Box sx={{ width: `${selectedApprovalPercent}%`, height: "100%", background: "var(--mf-primary)" }} />
                                        </Box>
                                    </Box>
                                    <Box sx={registryMetaSx}>
                                        <Typography sx={subTextSx}>LAST UPDATED</Typography>
                                        <Typography sx={{ ...mainTextSx, mt: .35 }}>
                                            {formatDate(selectedProject.updatedAt)}
                                        </Typography>
                                    </Box>
                                </Box>

                                {selectedProject.remarks && (
                                    <Box sx={{ mt: 1.1, p: 1.1, borderRadius: 2, border: "1px dashed var(--mf-border-strong)", background: "var(--mf-surface)" }}>
                                        <Typography sx={subTextSx}>PROJECT REMARKS</Typography>
                                        <Typography sx={{ ...mainTextSx, mt: .35, fontWeight: 700 }}>
                                            {selectedProject.remarks}
                                        </Typography>
                                    </Box>
                                )}
                            </Card>

                            <Card sx={{ ...panelSx, p: 0, overflow: "hidden" }}>
                                <Box
                                    sx={{
                                        px: 1.45,
                                        py: 1.25,
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        gap: 1,
                                        flexWrap: "wrap",
                                        borderBottom: "1px solid var(--mf-border)",
                                    }}
                                >
                                    <Box>
                                        <Typography sx={{ fontWeight: 950, fontSize: 16 }}>
                                            Product / Drawing Register
                                        </Typography>
                                        <Typography sx={subTextSx}>
                                            Structural master records only. Operational material execution is intentionally not duplicated here.
                                        </Typography>
                                    </Box>
                                    {canManage && selectedProject.active !== false && (
                                        <Button
                                            startIcon={<AddIcon />}
                                            onClick={() => openProduct(selectedProject)}
                                            sx={primaryBtnSx}
                                        >
                                            Add Product
                                        </Button>
                                    )}
                                </Box>

                                <Box sx={tableShellSx}>
                                    <Box
                                        sx={{
                                            ...tableHeaderSx,
                                            gridTemplateColumns: "minmax(220px,1.2fr) 160px 190px 145px 130px minmax(300px,1.25fr)",
                                        }}
                                    >
                                        {["Product / Drawing", "Director Approval", "BOM Readiness", "Required Date", "Lifecycle", "Administration"].map((heading) => (
                                            <Box key={heading} sx={tableCellSx}>{heading}</Box>
                                        ))}
                                    </Box>

                                    {selectedProducts.length === 0 ? (
                                        <EmptyState>No Products have been registered under this Project.</EmptyState>
                                    ) : selectedProducts.map((product) => {
                                        const executionLocked = productHasExecutionHistory(product);
                                        const deleteReason = executionLocked
                                            ? "This Product already owns a BOM or material requisition. Deactivate it instead to preserve traceability."
                                            : "Delete this setup-only Product record.";

                                        return (
                                            <Box
                                                key={product.id}
                                                sx={{
                                                    ...tableRowSx,
                                                    gridTemplateColumns: "minmax(220px,1.2fr) 160px 190px 145px 130px minmax(300px,1.25fr)",
                                                }}
                                            >
                                                <Box sx={tableCellSx}>
                                                    <Typography sx={mainTextSx}>{product.productName}</Typography>
                                                    <Typography sx={subTextSx}>
                                                        {product.drawingNo} · Rev {product.drawingRevision || "0"}
                                                    </Typography>
                                                    <Typography sx={{ ...subTextSx, mt: .25 }}>
                                                        Created {formatDate(product.createdAt)}
                                                    </Typography>
                                                </Box>

                                                <Box sx={tableCellSx}>
                                                    <MatFlowStatusChip status={product.approvalStatus || "PENDING_DIRECTOR_APPROVAL"} />
                                                    {product.approvedBy && (
                                                        <Typography sx={{ ...subTextSx, mt: .35 }}>By {product.approvedBy}</Typography>
                                                    )}
                                                    {product.approvedAt && (
                                                        <Typography sx={subTextSx}>{formatDate(product.approvedAt)}</Typography>
                                                    )}
                                                    {normalize(product.approvalStatus) === "RETURNED" && product.approvalRemarks && (
                                                        <Typography sx={{ ...subTextSx, color: "var(--mf-danger-text)", mt: .35 }}>
                                                            {product.approvalRemarks}
                                                        </Typography>
                                                    )}
                                                </Box>

                                                <Box sx={tableCellSx}>
                                                    <Typography sx={mainTextSx}>
                                                        {product.latestBomNumber || "Not created"}
                                                    </Typography>
                                                    <Typography sx={subTextSx}>
                                                        {product.latestBomStatus
                                                            ? `${String(product.latestBomStatus).replaceAll("_", " ")} · Rev ${product.latestBomRevision ?? "-"}`
                                                            : normalize(product.approvalStatus) === "APPROVED"
                                                                ? "Ready for Engineering BOM"
                                                                : "Awaiting Product approval"}
                                                    </Typography>
                                                    {product.latestBomId && (
                                                        <MatFlowStatusChip status={product.latestBomEffective ? "EFFECTIVE" : product.latestBomStatus} />
                                                    )}
                                                </Box>

                                                <Box sx={tableCellSx}>
                                                    <Typography sx={mainTextSx}>
                                                        {product.requiredDate ? formatDate(product.requiredDate, false) : "Not set"}
                                                    </Typography>
                                                </Box>

                                                <Box sx={tableCellSx}>
                                                    <MatFlowStatusChip status={product.active === false ? "INACTIVE" : "ACTIVE"} />
                                                </Box>

                                                <Box sx={{ ...tableCellSx, display: "flex", gap: .55, flexWrap: "wrap", alignItems: "center" }}>
                                                    {canManage && (
                                                        <Button
                                                            startIcon={<EditOutlinedIcon />}
                                                            onClick={() => openProduct(selectedProject, product)}
                                                            sx={secondaryBtnSx}
                                                        >
                                                            Edit
                                                        </Button>
                                                    )}
                                                    {canApprove && normalize(product.approvalStatus) !== "APPROVED" && product.active !== false && (
                                                        <Button
                                                            onClick={() => {
                                                                setApproval({ type: "APPROVE", project: selectedProject, product });
                                                                setApprovalRemarks("");
                                                            }}
                                                            sx={primaryBtnSx}
                                                        >
                                                            Approve
                                                        </Button>
                                                    )}
                                                    {canApprove && normalize(product.approvalStatus) !== "RETURNED" && (
                                                        <Button
                                                            onClick={() => {
                                                                setApproval({ type: "RETURN", project: selectedProject, product });
                                                                setApprovalRemarks("");
                                                            }}
                                                            sx={secondaryBtnSx}
                                                        >
                                                            Return
                                                        </Button>
                                                    )}
                                                    {normalize(product.approvalStatus) === "APPROVED" && (
                                                        <Button
                                                            onClick={() => navigate(
                                                                product.latestBomId
                                                                    ? `/matflow/boms/${product.latestBomId}`
                                                                    : "/matflow/boms/new"
                                                            )}
                                                            sx={secondaryBtnSx}
                                                        >
                                                            {product.latestBomId ? "Open BOM" : "Create BOM"}
                                                        </Button>
                                                    )}
                                                    {product.latestRequisitionId && (
                                                        <Button
                                                            onClick={() => navigate(`/matflow/tracker/${product.latestRequisitionId}`)}
                                                            sx={secondaryBtnSx}
                                                        >
                                                            Open Tracker
                                                        </Button>
                                                    )}
                                                    {canManage && (
                                                        <Tooltip title={deleteReason} placement="top" arrow>
                                                            <span>
                                                                <Button
                                                                    startIcon={<DeleteOutlineIcon />}
                                                                    onClick={() => setDeleteTarget({
                                                                        kind: "PRODUCT",
                                                                        project: selectedProject,
                                                                        product,
                                                                    })}
                                                                    disabled={executionLocked || saving}
                                                                    sx={dangerBtnSx}
                                                                >
                                                                    Delete
                                                                </Button>
                                                            </span>
                                                        </Tooltip>
                                                    )}
                                                </Box>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            </Card>
                        </Box>
                    )}
                </Box>
            )}

            <Dialog
                open={Boolean(projectDialog)}
                onClose={() => !saving && setProjectDialog(null)}
                fullWidth
                maxWidth="md"
                PaperProps={{ sx: dialogPaperSx }}
            >
                <DialogTitle sx={dialogTitleSx}>
                    {projectDialog?.row ? "Edit Project Header" : "Create Client Project"}
                </DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.3 }}>
                        <TextField
                            label="Project / PD Code *"
                            value={projectForm.projectCode}
                            onChange={(event) => setProjectForm((current) => ({ ...current, projectCode: event.target.value }))}
                            sx={fieldSx}
                        />
                        <TextField
                            label="Project Name *"
                            value={projectForm.projectName}
                            onChange={(event) => setProjectForm((current) => ({ ...current, projectName: event.target.value }))}
                            sx={fieldSx}
                        />
                        <TextField
                            label="Client Name *"
                            value={projectForm.clientName}
                            onChange={(event) => setProjectForm((current) => ({ ...current, clientName: event.target.value }))}
                            sx={fieldSx}
                        />
                        <TextField
                            select
                            label="Plant *"
                            value={projectForm.plantCode}
                            onChange={(event) => setProjectForm((current) => ({ ...current, plantCode: event.target.value }))}
                            sx={fieldSx}
                        >
                            {availablePlants.map((plant) => (
                                <MenuItem key={plant} value={plant}>{plant}</MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            type="date"
                            label="Project Required Date"
                            value={projectForm.requiredDate}
                            onChange={(event) => setProjectForm((current) => ({ ...current, requiredDate: event.target.value }))}
                            InputLabelProps={{ shrink: true }}
                            sx={fieldSx}
                        />
                        <TextField
                            select
                            label="Priority"
                            value={projectForm.priority}
                            onChange={(event) => setProjectForm((current) => ({ ...current, priority: event.target.value }))}
                            sx={fieldSx}
                        >
                            {["LOW", "NORMAL", "HIGH", "CRITICAL"].map((value) => (
                                <MenuItem key={value} value={value}>{value}</MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            label="Project Manager / Owner"
                            value={projectForm.projectManager}
                            onChange={(event) => setProjectForm((current) => ({ ...current, projectManager: event.target.value }))}
                            sx={fieldSx}
                        />
                        <Box sx={{ display: "flex", alignItems: "center", px: .3 }}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={projectForm.active !== false}
                                        onChange={(event) => setProjectForm((current) => ({ ...current, active: event.target.checked }))}
                                    />
                                }
                                label="Project Active"
                            />
                        </Box>
                        <TextField
                            multiline
                            minRows={3}
                            label="Project Remarks"
                            value={projectForm.remarks}
                            onChange={(event) => setProjectForm((current) => ({ ...current, remarks: event.target.value }))}
                            sx={{ ...fieldSx, gridColumn: "1 / -1" }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setProjectDialog(null)} disabled={saving} sx={secondaryBtnSx}>
                        Cancel
                    </Button>
                    <Button onClick={saveProject} disabled={saving} sx={primaryBtnSx}>
                        {saving ? "Saving..." : "Save Project"}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={Boolean(productDialog)}
                onClose={() => !saving && setProductDialog(null)}
                fullWidth
                maxWidth="sm"
                PaperProps={{ sx: dialogPaperSx }}
            >
                <DialogTitle sx={dialogTitleSx}>
                    {productDialog?.product
                        ? "Edit Product / Drawing Record"
                        : `Add Product to ${productDialog?.project?.projectCode || "Project"}`}
                </DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.3 }}>
                        <TextField
                            label="Product / Item Name *"
                            value={productForm.productName}
                            onChange={(event) => setProductForm((current) => ({ ...current, productName: event.target.value }))}
                            sx={{ ...fieldSx, gridColumn: "1 / -1" }}
                        />
                        <TextField
                            label="Drawing No. *"
                            value={productForm.drawingNo}
                            onChange={(event) => setProductForm((current) => ({ ...current, drawingNo: event.target.value }))}
                            sx={fieldSx}
                        />
                        <TextField
                            label="Drawing Revision"
                            value={productForm.drawingRevision}
                            onChange={(event) => setProductForm((current) => ({ ...current, drawingRevision: event.target.value }))}
                            sx={fieldSx}
                        />
                        <TextField
                            type="date"
                            label="Product Required Date"
                            value={productForm.requiredDate}
                            onChange={(event) => setProductForm((current) => ({ ...current, requiredDate: event.target.value }))}
                            InputLabelProps={{ shrink: true }}
                            sx={fieldSx}
                        />
                        <Box sx={{ display: "flex", alignItems: "center", px: .3 }}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={productForm.active !== false}
                                        onChange={(event) => setProductForm((current) => ({ ...current, active: event.target.checked }))}
                                    />
                                }
                                label="Product Active"
                            />
                        </Box>
                        <TextField
                            multiline
                            minRows={3}
                            label="Product Remarks"
                            value={productForm.remarks}
                            onChange={(event) => setProductForm((current) => ({ ...current, remarks: event.target.value }))}
                            sx={{ ...fieldSx, gridColumn: "1 / -1" }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setProductDialog(null)} disabled={saving} sx={secondaryBtnSx}>
                        Cancel
                    </Button>
                    <Button onClick={saveProduct} disabled={saving} sx={primaryBtnSx}>
                        {saving ? "Saving..." : "Save Product"}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={Boolean(approval)}
                onClose={() => !saving && setApproval(null)}
                fullWidth
                maxWidth="sm"
                PaperProps={{ sx: dialogPaperSx }}
            >
                <DialogTitle sx={dialogTitleSx}>
                    {approval?.type === "APPROVE"
                        ? "Director Product Approval"
                        : "Return Product to Engineering"}
                </DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Typography sx={mainTextSx}>
                        {approval?.project?.projectCode} → {approval?.product?.productName} → {approval?.product?.drawingNo}
                    </Typography>
                    <TextField
                        multiline
                        minRows={3}
                        fullWidth
                        label={approval?.type === "RETURN" ? "Return Remarks *" : "Approval Remarks"}
                        value={approvalRemarks}
                        onChange={(event) => setApprovalRemarks(event.target.value)}
                        sx={{ ...fieldSx, mt: 1.5 }}
                    />
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setApproval(null)} disabled={saving} sx={secondaryBtnSx}>
                        Cancel
                    </Button>
                    <Button onClick={decideProduct} disabled={saving} sx={primaryBtnSx}>
                        {saving ? "Working..." : "Confirm Decision"}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={Boolean(deleteTarget)}
                onClose={() => !saving && setDeleteTarget(null)}
                fullWidth
                maxWidth="sm"
                PaperProps={{ sx: dialogPaperSx }}
            >
                <DialogTitle sx={{ ...dialogTitleSx, color: "var(--mf-danger-text)" }}>
                    <DeleteOutlineIcon />
                    {deleteTarget?.kind === "PROJECT" ? "Delete Project" : "Delete Product"}
                </DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    {deleteTarget?.kind === "PROJECT" ? (
                        <>
                            <Typography sx={mainTextSx}>
                                Delete {deleteTarget?.project?.projectCode} · {deleteTarget?.project?.projectName}?
                            </Typography>
                            <Typography sx={{ ...subTextSx, mt: .8 }}>
                                This permanently removes the Project header and its setup-only Products. The backend refuses deletion if any Product already has a BOM or material requisition, preserving MatFlow execution history.
                            </Typography>
                        </>
                    ) : (
                        <>
                            <Typography sx={mainTextSx}>
                                Delete {deleteTarget?.product?.productName} · {deleteTarget?.product?.drawingNo}?
                            </Typography>
                            <Typography sx={{ ...subTextSx, mt: .8 }}>
                                This permanently removes this setup-only Product / Drawing record. Products with a BOM or material requisition cannot be deleted and must be deactivated instead.
                            </Typography>
                        </>
                    )}
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setDeleteTarget(null)} disabled={saving} sx={secondaryBtnSx}>
                        Cancel
                    </Button>
                    <Button onClick={confirmDelete} disabled={saving} sx={dangerBtnSx}>
                        {saving ? "Deleting..." : "Delete Permanently"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export const MatFlowMaterialsPage = () => <MasterPage type="materials" />;
export const MatFlowLocationsPage = () => <MasterPage type="locations" />;
