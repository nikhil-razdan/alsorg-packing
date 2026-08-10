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
    formatDate, formatDurationMinutes, mainTextSx, normalize, pageSx, panelSx, primaryBtnSx, secondaryBtnSx,
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


const projectHealthTone = (health) => {
    const value = normalize(health);
    if (["COMPLETED", "ON_TRACK"].includes(value)) return "var(--mf-success-text)";
    if (["SHORTAGE_RISK", "OVERDUE"].includes(value)) return "var(--mf-danger-text)";
    return "var(--mf-warning-text)";
};

const blankProjectHeader = {
    projectCode: "", projectName: "", clientName: "", plantCode: "",
    requiredDate: "", priority: "NORMAL", projectManager: "", remarks: "", active: true,
};
const blankPortfolioProduct = {
    productName: "", drawingNo: "", drawingRevision: "0", requiredDate: "", remarks: "", active: true,
};

/**
 * Primary Project master: Project -> Product(s) -> BOM / material execution.
 * The former flat Product/Drawing master is intentionally not used here.
 */
export function MatFlowProjectsPage() {
    const navigate = useNavigate();
    const { availablePlants, selectedPlantParam, hasRole } = useMatFlow();
    const canManage = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.ENGINEERING);
    const canApprove = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.DIRECTOR);
    const [rows, setRows] = useState([]);
    const [trackerRows, setTrackerRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState(() => new Set());
    const [projectDialog, setProjectDialog] = useState(null);
    const [productDialog, setProductDialog] = useState(null);
    const [approval, setApproval] = useState(null);
    const [approvalRemarks, setApprovalRemarks] = useState("");
    const [projectForm, setProjectForm] = useState(blankProjectHeader);
    const [productForm, setProductForm] = useState(blankPortfolioProduct);

    const load = useCallback(async () => {
        setLoading(true); setError("");
        try {
            const [response, trackerResponse] = await Promise.all([
                matflowApi.listProjectPortfolio({
                    search: clean(search) || undefined,
                    plantCode: selectedPlantParam || undefined,
                    active: undefined,
                }),
                matflowApi.getTracker({
                    plantCode: selectedPlantParam || undefined,
                }),
            ]);
            setRows(Array.isArray(response?.data) ? response.data : []);
            setTrackerRows(Array.isArray(trackerResponse?.data?.rows) ? trackerResponse.data.rows : []);
        } catch (e) {
            setRows([]); setTrackerRows([]); setError(readMatFlowError(e, "Unable to load Project Portfolio."));
        } finally { setLoading(false); }
    }, [search, selectedPlantParam]);
    useEffect(() => { load(); }, [load]);

    const toggle = (id) => setExpanded((current) => {
        const next = new Set(current);
        next.has(String(id)) ? next.delete(String(id)) : next.add(String(id));
        return next;
    });

    const openProject = (row = null) => {
        setProjectDialog({ row });
        setProjectForm(row ? {
            projectCode: row.projectCode || "", projectName: row.projectName || "",
            clientName: row.clientName || "", plantCode: row.plantCode || "",
            requiredDate: row.requiredDate || "", priority: row.priority || "NORMAL",
            projectManager: row.projectManager || "", remarks: row.remarks || "",
            active: row.active !== false,
        } : { ...blankProjectHeader, plantCode: selectedPlantParam || availablePlants[0] || "" });
        setError("");
    };
    const saveProject = async () => {
        if (![projectForm.projectCode, projectForm.projectName, projectForm.clientName, projectForm.plantCode].every(clean)) {
            setError("Project code, Project name, Client and Plant are required."); return;
        }
        setSaving(true); setError("");
        const body = {
            projectCode: upperCode(projectForm.projectCode), projectName: clean(projectForm.projectName),
            clientName: clean(projectForm.clientName), plantCode: upperCode(projectForm.plantCode),
            requiredDate: projectForm.requiredDate || null, priority: upperCode(projectForm.priority || "NORMAL"),
            projectManager: clean(projectForm.projectManager) || null, remarks: clean(projectForm.remarks) || null,
            active: projectForm.active !== false, rowVersion: projectDialog?.row?.rowVersion ?? null,
        };
        try {
            if (projectDialog?.row?.id) await matflowApi.updateProjectPortfolio(projectDialog.row.id, body);
            else await matflowApi.createProjectPortfolio(body);
            setProjectDialog(null); await load();
        } catch (e) { setError(readMatFlowError(e, "Unable to save Project.")); }
        finally { setSaving(false); }
    };

    const openProduct = (project, product = null) => {
        setProductDialog({ project, product });
        setProductForm(product ? {
            productName: product.productName || "", drawingNo: product.drawingNo || "",
            drawingRevision: product.drawingRevision || "0", requiredDate: product.requiredDate || "",
            remarks: "", active: product.active !== false,
        } : { ...blankPortfolioProduct, requiredDate: project.requiredDate || "" });
        setError("");
    };
    const saveProduct = async () => {
        const { project, product } = productDialog || {};
        if (!project?.id || !clean(productForm.productName) || !clean(productForm.drawingNo)) {
            setError("Project, Product name and Drawing number are required."); return;
        }
        setSaving(true); setError("");
        const body = {
            productName: clean(productForm.productName), drawingNo: upperCode(productForm.drawingNo),
            drawingRevision: clean(productForm.drawingRevision) || "0", requiredDate: productForm.requiredDate || null,
            remarks: clean(productForm.remarks) || null, active: productForm.active !== false,
            rowVersion: product?.rowVersion ?? null,
        };
        try {
            if (product?.id) await matflowApi.updateProjectProduct(project.id, product.id, body);
            else await matflowApi.addProjectProduct(project.id, body);
            setProductDialog(null);
            setExpanded((current) => new Set([...current, String(project.id)]));
            await load();
        } catch (e) { setError(readMatFlowError(e, "Unable to save Project Product.")); }
        finally { setSaving(false); }
    };

    const decideProduct = async () => {
        if (!approval?.project?.id || !approval?.product?.id) return;
        if (approval.type === "RETURN" && !clean(approvalRemarks)) {
            setError("Return remarks are required."); return;
        }
        setSaving(true); setError("");
        try {
            const body = { rowVersion: approval.product.rowVersion, remarks: clean(approvalRemarks) || null };
            if (approval.type === "APPROVE") {
                await matflowApi.approvePortfolioProduct(approval.project.id, approval.product.id, body);
            } else {
                await matflowApi.returnPortfolioProduct(approval.project.id, approval.product.id, body);
            }
            setApproval(null); setApprovalRemarks(""); await load();
        } catch (e) { setError(readMatFlowError(e, "Unable to complete Director Product decision.")); }
        finally { setSaving(false); }
    };

    const trackerByProduct = useMemo(() => {
        const map = new Map();
        trackerRows.forEach((row) => {
            if (!row?.projectDrawingId) return;
            const key = String(row.projectDrawingId);
            const current = map.get(key);
            if (!current || new Date(row.updatedAt || 0).getTime() > new Date(current.updatedAt || 0).getTime()) {
                map.set(key, row);
            }
        });
        return map;
    }, [trackerRows]);

    const totalProducts = rows.reduce((sum, row) => sum + Number(row.productCount || 0), 0);
    const approvedProducts = rows.reduce((sum, row) => sum + Number(row.approvedProductCount || 0), 0);
    const completedProducts = rows.reduce((sum, row) => sum + Number(row.completedProductCount || 0), 0);
    const riskProjects = rows.filter((row) => ["SHORTAGE_RISK", "OVERDUE"].includes(normalize(row.health))).length;

    return <Box sx={pageSx}>
        <PageHero
            badge="PROJECT PORTFOLIO CONTROL"
            title="Projects → Products → Materials"
            subtitle="One client Project can contain one or many manufactured Products. Every Product owns its Drawing, Director approval, Operational BOM and complete material execution trail."
            actions={<><Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>{canManage && <Button startIcon={<AddIcon />} onClick={() => openProject()} sx={primaryBtnSx}>Create Project</Button>}</>}
        />
        <ErrorBox>{error}</ErrorBox>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 1 }}>
            {[["CLIENT PROJECTS", rows.length], ["PRODUCTS / ITEMS", totalProducts], ["DIRECTOR APPROVED", approvedProducts], ["COMPLETED / RISK", `${completedProducts} / ${riskProjects}`]].map(([label, value]) =>
                <Card key={label} sx={panelSx}><Typography sx={subTextSx}>{label}</Typography><Typography sx={{ fontSize: 22, fontWeight: 950 }}>{value}</Typography></Card>)}
        </Box>
        <Card sx={panelSx}><Box sx={{ display: "flex", gap: 1 }}><TextField fullWidth label="Search project, client, product or drawing" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} sx={fieldSx} /><Button onClick={load} sx={secondaryBtnSx}>Search</Button></Box></Card>

        {loading ? <LoadingBlock /> : rows.length === 0 ? <Card sx={panelSx}><EmptyState>No Projects match the current view.</EmptyState></Card> : rows.map((project) => {
            const open = expanded.has(String(project.id));
            const coverage = Math.max(0, Math.min(100, Number(project.materialCoveragePercent || 0)));
            const liveDepartments = Array.from(new Set((project.products || [])
                .map((product) => trackerByProduct.get(String(product.id))?.currentDepartment)
                .filter(Boolean)));
            const liveControlPoint = liveDepartments.length === 0
                ? (project.currentDepartment || "SETUP")
                : liveDepartments.length <= 2
                    ? liveDepartments.join(" · ")
                    : `${liveDepartments.slice(0, 2).join(" · ")} +${liveDepartments.length - 2}`;
            return <Card key={project.id} sx={{ ...panelSx, p: 0, overflow: "hidden" }}>
                <Box sx={{ p: 1.6, display: "grid", gridTemplateColumns: "44px minmax(250px,1.3fr) minmax(180px,.8fr) repeat(4,minmax(100px,.45fr)) auto", gap: 1, alignItems: "center" }}>
                    <Button onClick={() => toggle(project.id)} sx={{ ...secondaryBtnSx, minWidth: 36, px: .6 }}>{open ? "−" : "+"}</Button>
                    <Box><Typography sx={{ ...mainTextSx, fontSize: 16 }}>{project.projectCode} · {project.projectName}</Typography><Typography sx={subTextSx}>{project.clientName} · {project.plantCode}{project.projectManager ? ` · PM ${project.projectManager}` : ""}</Typography></Box>
                    <Box><Typography sx={subTextSx}>MATERIAL COVERAGE</Typography><Box sx={{ mt: .5, height: 7, background: "var(--mf-surface-strong)", borderRadius: 99, overflow: "hidden" }}><Box sx={{ height: "100%", width: `${coverage}%`, background: "var(--mf-primary)" }} /></Box><Typography sx={{ ...subTextSx, mt: .35 }}>{coverage.toFixed(1)}%</Typography><Typography sx={{ ...subTextSx, mt: .25 }}>Started {formatDate(project.createdAt)}</Typography><Typography sx={subTextSx}>Updated {formatDate(project.updatedAt)}</Typography></Box>
                    <Box><Typography sx={subTextSx}>PRODUCTS</Typography><Typography sx={mainTextSx}>{project.productCount}</Typography></Box>
                    <Box><Typography sx={subTextSx}>APPROVED</Typography><Typography sx={mainTextSx}>{project.approvedProductCount}</Typography></Box>
                    <Box><Typography sx={subTextSx}>LIVE CONTROL POINT</Typography><Typography sx={mainTextSx}>{liveControlPoint}</Typography></Box>
                    <Box><Typography sx={subTextSx}>HEALTH</Typography><Typography sx={{ ...mainTextSx, color: projectHealthTone(project.health) }}>{String(project.health || "-").replaceAll("_", " ")}</Typography></Box>
                    <Box sx={{ display: "flex", gap: .5 }}>{canManage && <Button onClick={() => openProject(project)} sx={secondaryBtnSx}><EditOutlinedIcon fontSize="small" /></Button>}</Box>
                </Box>

                {open && <Box sx={{ borderTop: "1px solid var(--mf-border)", background: "var(--mf-surface)" }}>
                    <Box sx={{ p: 1.2, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}><Box><Typography sx={{ fontWeight: 950 }}>Products / Items in this Project</Typography><Typography sx={subTextSx}>Each Product has its own approval, BOM, requisition and material lifecycle.</Typography></Box>{canManage && <Button startIcon={<AddIcon />} onClick={() => openProduct(project)} sx={primaryBtnSx}>Add Product</Button>}</Box>
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "minmax(220px,1.1fr) 150px 170px 170px 150px minmax(180px,.8fr) 160px minmax(240px,1fr)" }}>{["Product / Drawing", "Director", "Operational BOM", "Material Demand", "Shortage", "Current Department", "Status", "Actions"].map((h) => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>
                        {(project.products || []).length === 0 ? <EmptyState>No Products have been created under this Project.</EmptyState> : (project.products || []).map((product) => <Box key={product.id} sx={{ ...tableRowSx, gridTemplateColumns: "minmax(220px,1.1fr) 150px 170px 170px 150px minmax(180px,.8fr) 160px minmax(240px,1fr)" }}>
                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{product.productName}</Typography><Typography sx={subTextSx}>{product.drawingNo} · Rev {product.drawingRevision || "0"}</Typography></Box>
                            <Box sx={tableCellSx}><MatFlowStatusChip status={product.approvalStatus || "PENDING_DIRECTOR_APPROVAL"} />{product.approvedBy && <Typography sx={subTextSx}>By {product.approvedBy}</Typography>}{product.approvedAt && <Typography sx={subTextSx}>{formatDate(product.approvedAt)}</Typography>}{!product.approvedAt && product.createdAt && <Typography sx={subTextSx}>Created {formatDate(product.createdAt)}</Typography>}</Box>
                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{product.latestBomNumber || "Not created"}</Typography><Typography sx={subTextSx}>{product.latestBomStatus ? `${String(product.latestBomStatus).replaceAll("_", " ")} · Rev ${product.latestBomRevision ?? "-"}` : "Engineering pending"}</Typography></Box>
                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{product.requestedQty ?? 0} requested</Typography><Typography sx={subTextSx}>{product.reservedQty ?? 0} reserved · {product.issuedQty ?? 0} issued</Typography></Box>
                            <Box sx={tableCellSx}><Typography sx={{ ...mainTextSx, color: Number(product.shortageQty || 0) > 0 ? "var(--mf-danger-text)" : "var(--mf-success-text)" }}>{product.shortageQty ?? 0}</Typography></Box>
                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{trackerByProduct.get(String(product.id))?.currentDepartment || product.currentDepartment || "ENGINEERING / BOM"}</Typography><Typography sx={subTextSx}>{trackerByProduct.get(String(product.id))?.currentLocationCode || trackerByProduct.get(String(product.id))?.currentLocationName || product.latestRequisitionNumber || "No requisition yet"}</Typography>{trackerByProduct.get(String(product.id))?.stageStartedAt && <Typography sx={subTextSx}>Stage since {formatDate(trackerByProduct.get(String(product.id)).stageStartedAt)} · {formatDurationMinutes(trackerByProduct.get(String(product.id)).stageDurationMinutes || 0)}</Typography>}</Box>
                            <Box sx={tableCellSx}><MatFlowStatusChip status={trackerByProduct.get(String(product.id))?.currentStage || trackerByProduct.get(String(product.id))?.requisitionStatus || product.requisitionStatus || product.latestBomStatus || product.approvalStatus} />{trackerByProduct.get(String(product.id))?.timingHealth && <Typography sx={subTextSx}>{String(trackerByProduct.get(String(product.id)).timingHealth).replaceAll("_", " ")}</Typography>}</Box>
                            <Box sx={{ ...tableCellSx, display: "flex", gap: .5, flexWrap: "wrap" }}>
                                {canManage && <Button onClick={() => openProduct(project, product)} sx={secondaryBtnSx}><EditOutlinedIcon fontSize="small" /></Button>}
                                {canApprove && normalize(product.approvalStatus) !== "APPROVED" && <Button onClick={() => { setApproval({ type: "APPROVE", project, product }); setApprovalRemarks(""); }} sx={primaryBtnSx}>Approve</Button>}
                                {canApprove && normalize(product.approvalStatus) !== "RETURNED" && <Button onClick={() => { setApproval({ type: "RETURN", project, product }); setApprovalRemarks(""); }} sx={secondaryBtnSx}>Return</Button>}
                                {normalize(product.approvalStatus) === "APPROVED" && <Button onClick={() => navigate(product.latestBomId ? `/matflow/boms/${product.latestBomId}` : "/matflow/boms/new")} sx={secondaryBtnSx}>{product.latestBomId ? "BOM" : "Create BOM"}</Button>}
                                {product.latestRequisitionId && <Button onClick={() => navigate(`/matflow/tracker/${product.latestRequisitionId}`)} sx={primaryBtnSx}>Track</Button>}
                            </Box>
                        </Box>)}
                    </Box>
                </Box>}
            </Card>;
        })}

        <Dialog open={Boolean(projectDialog)} onClose={() => !saving && setProjectDialog(null)} fullWidth maxWidth="md" PaperProps={{ sx: dialogPaperSx }}><DialogTitle sx={dialogTitleSx}>{projectDialog?.row ? "Edit Project" : "Create Client Project"}</DialogTitle><DialogContent sx={dialogContentSx}><Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.3 }}>
            <TextField label="Project / PD Code *" value={projectForm.projectCode} onChange={(e) => setProjectForm((c) => ({ ...c, projectCode: e.target.value }))} sx={fieldSx} />
            <TextField label="Project Name *" value={projectForm.projectName} onChange={(e) => setProjectForm((c) => ({ ...c, projectName: e.target.value }))} sx={fieldSx} />
            <TextField label="Client Name *" value={projectForm.clientName} onChange={(e) => setProjectForm((c) => ({ ...c, clientName: e.target.value }))} sx={fieldSx} />
            <TextField select label="Plant *" value={projectForm.plantCode} onChange={(e) => setProjectForm((c) => ({ ...c, plantCode: e.target.value }))} sx={fieldSx}>{availablePlants.map((plant) => <MenuItem key={plant} value={plant}>{plant}</MenuItem>)}</TextField>
            <TextField type="date" label="Project Required Date" value={projectForm.requiredDate} onChange={(e) => setProjectForm((c) => ({ ...c, requiredDate: e.target.value }))} InputLabelProps={{ shrink: true }} sx={fieldSx} />
            <TextField select label="Priority" value={projectForm.priority} onChange={(e) => setProjectForm((c) => ({ ...c, priority: e.target.value }))} sx={fieldSx}>{["LOW", "NORMAL", "HIGH", "CRITICAL"].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}</TextField>
            <TextField label="Project Manager / Owner" value={projectForm.projectManager} onChange={(e) => setProjectForm((c) => ({ ...c, projectManager: e.target.value }))} sx={fieldSx} />
            <TextField multiline minRows={3} label="Project Remarks" value={projectForm.remarks} onChange={(e) => setProjectForm((c) => ({ ...c, remarks: e.target.value }))} sx={{ ...fieldSx, gridColumn: "1 / -1" }} />
        </Box></DialogContent><DialogActions sx={dialogActionsSx}><Button onClick={() => setProjectDialog(null)} sx={secondaryBtnSx}>Cancel</Button><Button onClick={saveProject} disabled={saving} sx={primaryBtnSx}>{saving ? "Saving..." : "Save Project"}</Button></DialogActions></Dialog>

        <Dialog open={Boolean(productDialog)} onClose={() => !saving && setProductDialog(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}><DialogTitle sx={dialogTitleSx}>{productDialog?.product ? "Edit Product / Item" : `Add Product to ${productDialog?.project?.projectCode || "Project"}`}</DialogTitle><DialogContent sx={dialogContentSx}><Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.3 }}>
            <TextField label="Product / Item Name *" value={productForm.productName} onChange={(e) => setProductForm((c) => ({ ...c, productName: e.target.value }))} sx={{ ...fieldSx, gridColumn: "1 / -1" }} />
            <TextField label="Drawing No. *" value={productForm.drawingNo} onChange={(e) => setProductForm((c) => ({ ...c, drawingNo: e.target.value }))} sx={fieldSx} />
            <TextField label="Drawing Revision" value={productForm.drawingRevision} onChange={(e) => setProductForm((c) => ({ ...c, drawingRevision: e.target.value }))} sx={fieldSx} />
            <TextField type="date" label="Product Required Date" value={productForm.requiredDate} onChange={(e) => setProductForm((c) => ({ ...c, requiredDate: e.target.value }))} InputLabelProps={{ shrink: true }} sx={fieldSx} />
            <TextField multiline minRows={3} label="Product Remarks" value={productForm.remarks} onChange={(e) => setProductForm((c) => ({ ...c, remarks: e.target.value }))} sx={{ ...fieldSx, gridColumn: "1 / -1" }} />
        </Box></DialogContent><DialogActions sx={dialogActionsSx}><Button onClick={() => setProductDialog(null)} sx={secondaryBtnSx}>Cancel</Button><Button onClick={saveProduct} disabled={saving} sx={primaryBtnSx}>{saving ? "Saving..." : "Save Product"}</Button></DialogActions></Dialog>

        <Dialog open={Boolean(approval)} onClose={() => !saving && setApproval(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}><DialogTitle sx={dialogTitleSx}>{approval?.type === "APPROVE" ? "Director Product Approval" : "Return Product to Engineering"}</DialogTitle><DialogContent sx={dialogContentSx}><Typography sx={mainTextSx}>{approval?.project?.projectCode} → {approval?.product?.productName} → {approval?.product?.drawingNo}</Typography><TextField multiline minRows={3} fullWidth label={approval?.type === "RETURN" ? "Return Remarks *" : "Approval Remarks"} value={approvalRemarks} onChange={(e) => setApprovalRemarks(e.target.value)} sx={{ ...fieldSx, mt: 1.5 }} /></DialogContent><DialogActions sx={dialogActionsSx}><Button onClick={() => setApproval(null)} sx={secondaryBtnSx}>Cancel</Button><Button onClick={decideProduct} disabled={saving} sx={primaryBtnSx}>Confirm Decision</Button></DialogActions></Dialog>
    </Box>;
}

export const MatFlowMaterialsPage = () => <MasterPage type="materials" />;
export const MatFlowLocationsPage = () => <MasterPage type="locations" />;
