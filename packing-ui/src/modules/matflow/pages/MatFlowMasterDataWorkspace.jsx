import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Box, Button, Card, Dialog, DialogActions, DialogContent, DialogTitle,
    FormControlLabel, MenuItem, Switch, TextField, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import ApprovalOutlinedIcon from "@mui/icons-material/ApprovalOutlined";
import UndoOutlinedIcon from "@mui/icons-material/UndoOutlined";
import {
    MATFLOW_ROLES, useMatFlow, ErrorBox, EmptyState, LoadingBlock,
    MATFLOW_MATERIAL_CATEGORIES, MatFlowStatusChip, PageHero, clean,
    dialogActionsSx, dialogContentSx, dialogPaperSx, dialogTitleSx, fieldSx,
    mainTextSx, normalize, pageSx, panelSx, primaryBtnSx, secondaryBtnSx,
    subTextSx, tableCellSx, tableHeaderSx, tableRowSx, tableShellSx,
} from "../matflowUi";
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
        if (type === "materials") return { ...form, materialCode: normalize(form.materialCode), category: normalize(form.category), uom: normalize(form.uom), minimumStock: Number(form.minimumStock || 0), reorderLevel: Number(form.reorderLevel || 0), rowVersion: dialog?.row?.rowVersion ?? null };
        if (type === "projects") return { ...form, projectCode: normalize(form.projectCode), drawingNo: normalize(form.drawingNo), plantCode: normalize(form.plantCode), requiredDate: clean(form.requiredDate) || null, rowVersion: dialog?.row?.rowVersion ?? null };
        return { ...form, locationCode: normalize(form.locationCode), plantCode: normalize(form.plantCode), locationType: normalize(form.locationType), ownershipType: normalize(form.ownershipType), rowVersion: dialog?.row?.rowVersion ?? null };
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

export const MatFlowMaterialsPage = () => <MasterPage type="materials" />;
export const MatFlowProjectsPage = () => <MasterPage type="projects" />;
export const MatFlowLocationsPage = () => <MasterPage type="locations" />;
