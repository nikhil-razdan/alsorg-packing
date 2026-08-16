import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    IconButton,
    MenuItem,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useNavigate } from "react-router-dom";

import {
    MATFLOW_MATERIAL_CATEGORIES,
    MATFLOW_ROLES,
    useMatFlow,
} from "../matflowUi";
import { extractMatFlowPage, matflowApi, readMatFlowError } from "../api/matflowApi";
import {
    downloadMatFlowExcel,
    downloadMaterialImportTemplate,
    parseMaterialImportWorkbook,
} from "../api/matflowExcel";
import {
    EmptyState,
    ErrorBox,
    LoadingBlock,
    MatFlowDeleteDialog,
    MatFlowPagination,
    MatFlowStatusChip,
    PageHero,
    SummaryCard,
    clean,
    dialogActionsSx,
    dialogContentSx,
    dialogPaperSx,
    dialogTitleSx,
    fieldSx,
    formatDate,
    formatQty,
    mainTextSx,
    normalize,
    numeric,
    pageSx,
    panelSx,
    primaryBtnSx,
    readable,
    secondaryBtnSx,
    subTextSx,
    tableCellSx,
    tableHeaderSx,
    tableRowSx,
    tableShellSx,
    useMatFlowPagination,
} from "../matflowUi";

const upperCode = (value) => clean(value).toUpperCase();

const emptyMaterial = {
    materialCode: "",
    materialName: "",
    category: "",
    specification: "",
    uom: "",
    preferredSupplier: "",
    active: true,
};

const MATERIAL_USAGE_PERIODS = [
    { value: "TODAY", label: "Today" },
    { value: "WEEK", label: "Last 7 Days" },
    { value: "MONTH", label: "Last 30 Days" },
    { value: "YEAR", label: "Last 365 Days" },
    { value: "ALL", label: "All Time" },
];

const localDateTimeParam = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return undefined;
    const pad = (value) => String(value).padStart(2, "0");
    return [
        date.getFullYear(), "-", pad(date.getMonth() + 1), "-", pad(date.getDate()),
        "T", pad(date.getHours()), ":", pad(date.getMinutes()), ":", pad(date.getSeconds()),
    ].join("");
};

const usageRangeParams = (period) => {
    if (period === "ALL") return {};
    const now = new Date();
    const from = new Date(now);
    if (period === "TODAY") from.setHours(0, 0, 0, 0);
    else if (period === "WEEK") from.setDate(from.getDate() - 7);
    else if (period === "MONTH") from.setDate(from.getDate() - 30);
    else if (period === "YEAR") from.setDate(from.getDate() - 365);
    return { from: localDateTimeParam(from), to: localDateTimeParam(now) };
};

const emptyLocation = {
    locationCode: "",
    locationName: "",
    plantCode: "",
    locationType: "STORE",
    ownershipType: "INTERNAL",
    supportsStock: true,
    address: "",
    contactPerson: "",
    contactPhone: "",
    active: true,
};

const emptyProject = {
    projectCode: "",
    projectName: "",
    clientName: "",
    plantCode: "",
    requiredDate: "",
    priority: "NORMAL",
    projectManager: "",
    remarks: "",
    active: true,
};

const emptyProduct = {
    productName: "",
    drawingNo: "",
    drawingRevision: "0",
    requiredDate: "",
    remarks: "",
    active: true,
};

export function MatFlowProjectsPage() {
    const navigate = useNavigate();
    const { hasRole, selectedPlantParam, availablePlants } = useMatFlow();
    const canManage = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.ENGINEERING);

    const [rows, setRows] = useState([]);
    const [expandedProjects, setExpandedProjects] = useState({});
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [activeFilter, setActiveFilter] = useState("ACTIVE");
    const [projectDialog, setProjectDialog] = useState(null);
    const [productDialog, setProductDialog] = useState(null);
    const [deleteDialog, setDeleteDialog] = useState(null);
    const [projectForm, setProjectForm] = useState(emptyProject);
    const [productForm, setProductForm] = useState(emptyProduct);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await matflowApi.listProjects({
                search: clean(search) || undefined,
                active: activeFilter === "ALL" ? undefined : activeFilter === "ACTIVE",
                plantCode: selectedPlantParam || undefined,
            });
            setRows(Array.isArray(response?.data) ? response.data : []);
        } catch (requestError) {
            setRows([]);
            setError(readMatFlowError(requestError, "Unable to load Projects & Products."));
        } finally {
            setLoading(false);
        }
    }, [search, activeFilter, selectedPlantParam]);

    useEffect(() => { load(); }, [load]);

    const counts = useMemo(() => ({
        projects: rows.length,
        products: rows.reduce((total, project) => total + (Array.isArray(project?.products) ? project.products.length : 0), 0),
        bomReady: rows.reduce((total, project) => total + (project?.products || []).filter((product) => product?.bomEffective === true).length, 0),
        active: rows.filter((project) => project?.active !== false).length,
    }), [rows]);

    const openProject = (project = null) => {
        setProjectDialog({ project });
        setProjectForm({
            ...emptyProject,
            projectCode: project?.projectCode || "",
            projectName: project?.projectName || "",
            clientName: project?.clientName || "",
            plantCode: project?.plantCode || selectedPlantParam || availablePlants[0] || "",
            requiredDate: project?.requiredDate || "",
            priority: project?.priority || "NORMAL",
            projectManager: project?.projectManager || "",
            remarks: project?.remarks || "",
            active: project?.active !== false,
        });
        setError("");
    };

    const saveProject = async () => {
        if (![projectForm.projectCode, projectForm.projectName, projectForm.clientName, projectForm.plantCode].every((value) => clean(value))) {
            setError("PD No., Project name, Client and Plant are required.");
            return;
        }

        setWorking(true);
        setError("");
        try {
            const body = {
                projectCode: upperCode(projectForm.projectCode),
                projectName: clean(projectForm.projectName),
                clientName: clean(projectForm.clientName),
                plantCode: upperCode(projectForm.plantCode),
                requiredDate: clean(projectForm.requiredDate) || null,
                priority: upperCode(projectForm.priority || "NORMAL"),
                projectManager: clean(projectForm.projectManager) || null,
                remarks: clean(projectForm.remarks) || null,
                active: projectForm.active === true,
                rowVersion: projectDialog?.project?.rowVersion ?? null,
            };
            if (projectDialog?.project?.id) {
                await matflowApi.updateProject(projectDialog.project.id, body);
            } else {
                await matflowApi.createProject(body);
            }
            setProjectDialog(null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to save Project."));
        } finally {
            setWorking(false);
        }
    };

    const openProduct = (project, product = null) => {
        setProductDialog({ project, product });
        setProductForm({
            ...emptyProduct,
            productName: product?.productName || "",
            drawingNo: product?.drawingNo || "",
            drawingRevision: product?.drawingRevision || "0",
            requiredDate: product?.requiredDate || "",
            remarks: product?.remarks || "",
            active: product?.active !== false,
        });
        setError("");
    };

    const saveProduct = async () => {
        const project = productDialog?.project;
        if (!project?.id) return;
        if (!clean(productForm.productName) || !clean(productForm.drawingNo)) {
            setError("Product name and Drawing number are required.");
            return;
        }

        setWorking(true);
        setError("");
        try {
            const body = {
                productName: clean(productForm.productName),
                drawingNo: upperCode(productForm.drawingNo),
                drawingRevision: upperCode(productForm.drawingRevision) || "0",
                requiredDate: clean(productForm.requiredDate) || null,
                remarks: clean(productForm.remarks) || null,
                active: productForm.active === true,
                rowVersion: productDialog?.product?.rowVersion ?? null,
            };
            if (productDialog?.product?.id) {
                await matflowApi.updateProjectProduct(project.id, productDialog.product.id, body);
            } else {
                await matflowApi.addProjectProduct(project.id, body);
            }
            setProductDialog(null);
            setExpandedProjects((current) => ({ ...current, [String(project.id)]: true }));
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to save Product / Drawing."));
        } finally {
            setWorking(false);
        }
    };

    const confirmDelete = async () => {
        const target = deleteDialog;
        if (!target) return;
        setWorking(true);
        setError("");
        try {
            if (target.type === "PROJECT") {
                await matflowApi.deleteProject(target.project.id, target.project.rowVersion);
            } else {
                await matflowApi.deleteProjectProduct(
                    target.project.id,
                    target.product.id,
                    target.product.rowVersion
                );
            }
            setDeleteDialog(null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(
                requestError,
                "Unable to delete this setup record. If execution history exists, deactivate it instead."
            ));
        } finally {
            setWorking(false);
        }
    };

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="PD / PROJECT → PRODUCT"
                title="Projects & Products"
                subtitle="Use PD No. / Project No. as the Project identifier, then add one or many Products / Drawings. No Project or Product approval is required."
                actions={
                    <>
                        <Button
                            startIcon={<FileDownloadOutlinedIcon />}
                            onClick={() => downloadMatFlowExcel({
                                fileName: "MatFlow_Projects_Products",
                                sheetName: "Projects",
                                title: "MatFlow Projects & Products",
                                rows: rows.flatMap((project) =>
                                    (project.products || []).length
                                        ? project.products.map((product) => ({
                                            pdNo: project.projectCode,
                                            projectName: project.projectName,
                                            clientName: project.clientName,
                                            plantCode: project.plantCode,
                                            productName: product.productName,
                                            drawingNo: product.drawingNo,
                                            drawingRevision: product.drawingRevision,
                                            latestBomNumber: product.latestBomNumber,
                                            latestBomStatus: product.latestBomStatus,
                                            bomEffective: product.bomEffective,
                                            currentDepartment: product.currentDepartment,
                                        }))
                                        : [{
                                            pdNo: project.projectCode,
                                            projectName: project.projectName,
                                            clientName: project.clientName,
                                            plantCode: project.plantCode,
                                        }]
                                ),
                            })}
                            sx={secondaryBtnSx}
                        >
                            Export Excel
                        </Button>
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                        {canManage && (
                            <Button startIcon={<AddIcon />} onClick={() => openProject()} sx={primaryBtnSx}>
                                Create Project
                            </Button>
                        )}
                    </>
                }
            />

            <ErrorBox>{error}</ErrorBox>

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 1 }}>
                <SummaryCard label="Projects" value={counts.projects} />
                <SummaryCard label="Products" value={counts.products} />
                <SummaryCard label="Effective BOMs" value={counts.bomReady} />
                <SummaryCard label="Active Projects" value={counts.active} />
            </Box>

            <Card sx={panelSx}>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 1 }}>
                    <TextField
                        label="Search PD No. / Project / Client / Product / Drawing"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        sx={fieldSx}
                    />
                    <TextField
                        select
                        label="Project State"
                        value={activeFilter}
                        onChange={(event) => setActiveFilter(event.target.value)}
                        sx={fieldSx}
                    >
                        <MenuItem value="ACTIVE">Active</MenuItem>
                        <MenuItem value="INACTIVE">Inactive</MenuItem>
                        <MenuItem value="ALL">All</MenuItem>
                    </TextField>
                </Box>
            </Card>

            {loading ? <LoadingBlock /> : rows.length === 0 ? (
                <Card sx={panelSx}><EmptyState>No Projects found.</EmptyState></Card>
            ) : (
                <Box sx={{ display: "grid", gap: 1.1 }}>
                    {rows.map((project) => {
                        const expanded = expandedProjects[String(project.id)] === true;
                        const products = Array.isArray(project.products) ? project.products : [];
                        return (
                            <Card
                                key={project.id}
                                sx={{ ...panelSx, p: 0, overflow: "hidden", cursor: expanded ? "default" : "pointer" }}
                                onClick={() => {
                                    if (!expanded) setExpandedProjects((current) => ({ ...current, [String(project.id)]: true }));
                                }}
                            >
                                <Box
                                    sx={{
                                        p: 1.6,
                                        display: "grid",
                                        gridTemplateColumns: "minmax(260px,1.7fr) minmax(160px,1fr) 120px 150px auto",
                                        gap: 1,
                                        alignItems: "center",
                                        background: expanded ? "var(--mf-surface)" : "var(--mf-card-bg)",
                                    }}
                                >
                                    <Box>
                                        <Typography sx={{ fontWeight: 950, fontSize: 16 }}>
                                            {project.projectCode} · {project.projectName}
                                        </Typography>
                                        <Typography sx={subTextSx}>PD No. · {project.clientName} · {project.plantCode}</Typography>
                                    </Box>
                                    <Box>
                                        <Typography sx={subTextSx}>PRODUCTS</Typography>
                                        <Typography sx={mainTextSx}>{products.length}</Typography>
                                    </Box>
                                    <MatFlowStatusChip status={project.active === false ? "INACTIVE" : "ACTIVE"} />
                                    <Box>
                                        <Typography sx={subTextSx}>CURRENT</Typography>
                                        <Typography sx={mainTextSx}>{readable(project.currentDepartment || "PROJECT SETUP")}</Typography>
                                    </Box>
                                    <Box sx={{ display: "flex", gap: .5, justifyContent: "flex-end" }}>
                                        {canManage && (
                                            <>
                                                <Button
                                                    onClick={(event) => { event.stopPropagation(); openProject(project); }}
                                                    sx={secondaryBtnSx}
                                                >
                                                    Edit
                                                </Button>
                                                <Button
                                                    onClick={(event) => { event.stopPropagation(); openProduct(project); setExpandedProjects((current) => ({ ...current, [String(project.id)]: true })); }}
                                                    sx={primaryBtnSx}
                                                >
                                                    Add Product
                                                </Button>
                                                {project.rowVersion != null && (
                                                    <Tooltip title="Delete setup-only Project">
                                                        <IconButton
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                setDeleteDialog({ type: "PROJECT", project });
                                                            }}
                                                            size="small"
                                                        >
                                                            <DeleteOutlineIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </>
                                        )}
                                        {expanded && (
                                            <Tooltip title="Collapse Project">
                                                <IconButton
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setExpandedProjects((current) => ({ ...current, [String(project.id)]: false }));
                                                    }}
                                                    size="small"
                                                >
                                                    <ExpandLessIcon />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </Box>
                                </Box>

                                {expanded && (
                                    <Box sx={{ p: 1.4 }}>
                                        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 1, mb: 1.2 }}>
                                            <Box><Typography sx={subTextSx}>Required Date</Typography><Typography sx={mainTextSx}>{project.requiredDate || "-"}</Typography></Box>
                                            <Box><Typography sx={subTextSx}>Priority</Typography><Typography sx={mainTextSx}>{readable(project.priority || "NORMAL")}</Typography></Box>
                                            <Box><Typography sx={subTextSx}>Project Manager</Typography><Typography sx={mainTextSx}>{project.projectManager || "-"}</Typography></Box>
                                            <Box><Typography sx={subTextSx}>Health</Typography><MatFlowStatusChip status={project.health || "READY"} /></Box>
                                        </Box>

                                        <Box sx={tableShellSx}>
                                            <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "minmax(210px,1fr) 170px 130px 170px 170px 210px" }}>
                                                {["Product / Item", "Drawing", "Required", "Latest BOM", "Current", "Action"].map((heading) => (
                                                    <Box key={heading} sx={tableCellSx}>{heading}</Box>
                                                ))}
                                            </Box>
                                            {products.length === 0 ? <EmptyState>No Products added yet.</EmptyState> : products.map((product) => (
                                                <Box key={product.id} sx={{ ...tableRowSx, gridTemplateColumns: "minmax(210px,1fr) 170px 130px 170px 170px 210px" }}>
                                                    <Box sx={tableCellSx}>
                                                        <Typography sx={mainTextSx}>{product.productName || "-"}</Typography>
                                                        <Typography sx={subTextSx}>{product.active === false ? "Inactive" : "Active"}</Typography>
                                                    </Box>
                                                    <Box sx={tableCellSx}>
                                                        <Typography sx={mainTextSx}>{product.drawingNo || "-"}</Typography>
                                                        <Typography sx={subTextSx}>Rev {product.drawingRevision || "0"}</Typography>
                                                    </Box>
                                                    <Box sx={tableCellSx}>{product.requiredDate || project.requiredDate || "-"}</Box>
                                                    <Box sx={tableCellSx}>
                                                        {product.latestBomId ? (
                                                            <>
                                                                <Typography sx={mainTextSx}>{product.latestBomNumber || "-"}</Typography>
                                                                <Typography sx={subTextSx}>Rev {product.latestBomRevision ?? "-"} · {readable(product.latestBomStatus || "-")}</Typography>
                                                            </>
                                                        ) : <Typography sx={subTextSx}>Not created</Typography>}
                                                    </Box>
                                                    <Box sx={tableCellSx}>
                                                        <Typography sx={mainTextSx}>{readable(product.currentDepartment || (product.latestBomId ? "BOM" : "ENGINEERING / BOM"))}</Typography>
                                                    </Box>
                                                    <Box sx={{ ...tableCellSx, display: "flex", gap: .5, flexWrap: "wrap" }}>
                                                        {product.latestBomId ? (
                                                            <Button onClick={() => navigate(`/matflow/boms/${product.latestBomId}`)} sx={secondaryBtnSx}>Open BOM</Button>
                                                        ) : canManage ? (
                                                            <Button onClick={() => navigate(`/matflow/boms/new?productId=${encodeURIComponent(product.id)}`)} sx={primaryBtnSx}>Create BOM</Button>
                                                        ) : null}
                                                        {canManage && <Button onClick={() => openProduct(project, product)} sx={secondaryBtnSx}>Edit</Button>}
                                                        {canManage && product.rowVersion != null && (
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => setDeleteDialog({ type: "PRODUCT", project, product })}
                                                            >
                                                                <DeleteOutlineIcon fontSize="small" />
                                                            </IconButton>
                                                        )}
                                                    </Box>
                                                </Box>
                                            ))}
                                        </Box>
                                    </Box>
                                )}
                            </Card>
                        );
                    })}
                </Box>
            )}

            <Dialog open={Boolean(projectDialog)} onClose={() => !working && setProjectDialog(null)} fullWidth maxWidth="md" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>{projectDialog?.project ? "Edit Project" : "Create Project"}</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
                        <TextField label="PD No. / Project No. *" value={projectForm.projectCode} onChange={(e) => setProjectForm((c) => ({ ...c, projectCode: e.target.value }))} sx={fieldSx} />
                        <TextField label="Project Name *" value={projectForm.projectName} onChange={(e) => setProjectForm((c) => ({ ...c, projectName: e.target.value }))} sx={fieldSx} />
                        <TextField label="Client Name *" value={projectForm.clientName} onChange={(e) => setProjectForm((c) => ({ ...c, clientName: e.target.value }))} sx={fieldSx} />
                        <TextField select label="Plant *" value={projectForm.plantCode} onChange={(e) => setProjectForm((c) => ({ ...c, plantCode: e.target.value }))} sx={fieldSx}>
                            {availablePlants.map((plant) => <MenuItem key={plant} value={plant}>{plant}</MenuItem>)}
                        </TextField>
                        <TextField type="date" label="Required Date" InputLabelProps={{ shrink: true }} value={projectForm.requiredDate} onChange={(e) => setProjectForm((c) => ({ ...c, requiredDate: e.target.value }))} sx={fieldSx} />
                        <TextField select label="Priority" value={projectForm.priority} onChange={(e) => setProjectForm((c) => ({ ...c, priority: e.target.value }))} sx={fieldSx}>
                            {["LOW", "NORMAL", "HIGH", "URGENT"].map((value) => <MenuItem key={value} value={value}>{readable(value)}</MenuItem>)}
                        </TextField>
                        <TextField label="Project Manager" value={projectForm.projectManager} onChange={(e) => setProjectForm((c) => ({ ...c, projectManager: e.target.value }))} sx={fieldSx} />
                        <FormControlLabel control={<Switch checked={projectForm.active === true} onChange={(e) => setProjectForm((c) => ({ ...c, active: e.target.checked }))} />} label="Active" />
                        <TextField multiline minRows={3} label="Remarks" value={projectForm.remarks} onChange={(e) => setProjectForm((c) => ({ ...c, remarks: e.target.value }))} sx={{ ...fieldSx, gridColumn: "1 / -1" }} />
                    </Box>
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setProjectDialog(null)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
                    <Button onClick={saveProject} disabled={working} sx={primaryBtnSx}>{working ? "Saving..." : "Save Project"}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(productDialog)} onClose={() => !working && setProductDialog(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>{productDialog?.product ? "Edit Product / Drawing" : "Add Product / Drawing"}</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Alert severity="info" sx={{ mb: 1.5 }}>Product creation is immediate. There is no approval step.</Alert>
                    <Box sx={{ display: "grid", gap: 1.5 }}>
                        <TextField label="Product / Item *" value={productForm.productName} onChange={(e) => setProductForm((c) => ({ ...c, productName: e.target.value }))} sx={fieldSx} />
                        <TextField label="Drawing No. *" value={productForm.drawingNo} onChange={(e) => setProductForm((c) => ({ ...c, drawingNo: e.target.value }))} sx={fieldSx} />
                        <TextField label="Drawing Revision" value={productForm.drawingRevision} onChange={(e) => setProductForm((c) => ({ ...c, drawingRevision: e.target.value }))} sx={fieldSx} />
                        <TextField type="date" label="Required Date" InputLabelProps={{ shrink: true }} value={productForm.requiredDate} onChange={(e) => setProductForm((c) => ({ ...c, requiredDate: e.target.value }))} sx={fieldSx} />
                        <TextField multiline minRows={2} label="Remarks" value={productForm.remarks} onChange={(e) => setProductForm((c) => ({ ...c, remarks: e.target.value }))} sx={fieldSx} />
                        <FormControlLabel control={<Switch checked={productForm.active === true} onChange={(e) => setProductForm((c) => ({ ...c, active: e.target.checked }))} />} label="Active" />
                    </Box>
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setProductDialog(null)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
                    <Button onClick={saveProduct} disabled={working} sx={primaryBtnSx}>{working ? "Saving..." : "Save Product"}</Button>
                </DialogActions>
            </Dialog>

            <MatFlowDeleteDialog
                open={Boolean(deleteDialog)}
                title={deleteDialog?.type === "PROJECT" ? "Delete Project?" : "Delete Product?"}
                subject={deleteDialog?.type === "PROJECT"
                    ? deleteDialog?.project?.projectCode
                    : deleteDialog?.product?.productName}
                description="Permanent delete is limited to setup-only records without BOM/MR history. Use inactive state when historical traceability exists."
                working={working}
                onClose={() => setDeleteDialog(null)}
                onConfirm={confirmDelete}
            />
        </Box>
    );
}

export function MatFlowMaterialsPage() {
    const { hasRole, selectedPlantParam } = useMatFlow();
    const canManage = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.STORE, MATFLOW_ROLES.PURCHASE);
    const fileRef = useRef(null);

    const [rows, setRows] = useState([]);
    const [usageRows, setUsageRows] = useState([]);
    const [usagePeriod, setUsagePeriod] = useState("MONTH");
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [dialog, setDialog] = useState(null);
    const [form, setForm] = useState(emptyMaterial);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [materialResponse, usageResponse] = await Promise.all([
                matflowApi.listMaterials({ search: clean(search) || undefined }),
                matflowApi.materialRegister({
                    plantCode: selectedPlantParam || undefined,
                    search: clean(search) || undefined,
                    ...usageRangeParams(usagePeriod),
                }),
            ]);
            setRows(extractMatFlowPage(materialResponse?.data).rows);
            setUsageRows(Array.isArray(usageResponse?.data?.rows) ? usageResponse.data.rows : []);
        } catch (requestError) {
            setRows([]);
            setUsageRows([]);
            setError(readMatFlowError(requestError, "Unable to load Material Catalogue and usage."));
        } finally {
            setLoading(false);
        }
    }, [search, usagePeriod, selectedPlantParam]);

    useEffect(() => { load(); }, [load]);
    const pagination = useMatFlowPagination(rows, 20);

    const open = (row = null) => {
        setDialog({ row });
        setForm({
            ...emptyMaterial,
            ...Object.fromEntries(Object.keys(emptyMaterial).map((key) => [
                key,
                row?.[key] == null ? emptyMaterial[key] : typeof emptyMaterial[key] === "boolean" ? row[key] === true : String(row[key]),
            ])),
        });
        setError("");
    };

    const save = async () => {
        if (![form.materialCode, form.materialName, form.category, form.uom].every((value) => clean(value))) {
            setError("Material code, name, category and UOM are required.");
            return;
        }
        setWorking(true);
        setError("");
        try {
            const body = {
                materialCode: upperCode(form.materialCode),
                materialName: clean(form.materialName),
                category: normalize(form.category),
                specification: clean(form.specification) || null,
                uom: upperCode(form.uom),
                preferredSupplier: clean(form.preferredSupplier) || null,
                active: form.active === true,
                rowVersion: dialog?.row?.rowVersion ?? null,
            };
            if (dialog?.row?.id) await matflowApi.updateMaterial(dialog.row.id, body);
            else await matflowApi.createMaterial(body);
            setDialog(null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to save Material."));
        } finally {
            setWorking(false);
        }
    };

    const importMaterials = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        setWorking(true);
        setError("");
        try {
            const imported = await parseMaterialImportWorkbook(file, { category: "OTHER", uom: "PCS", codePrefix: "MAT" });
            if (!imported.length) throw new Error("No material rows were found in the workbook.");

            let saved = 0;
            const errors = [];
            for (const row of imported) {
                try {
                    await matflowApi.createMaterial({
                        materialCode: upperCode(row.materialCode),
                        materialName: clean(row.materialName),
                        category: normalize(row.category || "OTHER"),
                        specification: clean(row.specification) || null,
                        uom: upperCode(row.uom || "PCS"),
                        preferredSupplier: clean(row.preferredSupplier) || null,
                        active: row.active !== false,
                        rowVersion: null,
                    });
                    saved += 1;
                } catch (requestError) {
                    errors.push(`${row.materialCode || row.materialName}: ${readMatFlowError(requestError, "failed")}`);
                }
            }
            await load();
            if (errors.length) {
                setError(`Imported ${saved}/${imported.length}. ${errors.slice(0, 5).join(" | ")}${errors.length > 5 ? ` | +${errors.length - 5} more` : ""}`);
            }
        } catch (requestError) {
            setError(readMatFlowError(requestError, requestError?.message || "Unable to import Material workbook."));
        } finally {
            setWorking(false);
        }
    };

    const usageByMaterial = useMemo(() => {
        const map = new Map();
        usageRows.forEach((row) => {
            if (!row?.materialId) return;
            map.set(String(row.materialId), {
                ...row,
                usedQty: numeric(row.consumedQty) + numeric(row.productionWastedQty) + numeric(row.processingWastedQty),
                wasteQty: numeric(row.productionWastedQty) + numeric(row.processingWastedQty),
            });
        });
        return map;
    }, [usageRows]);

    const exportRows = useMemo(() => rows.map((row) => {
        const usage = usageByMaterial.get(String(row.id)) || {};
        return {
            ...row,
            periodUsedQty: numeric(usage.usedQty),
            periodConsumedQty: numeric(usage.consumedQty),
            periodWasteQty: numeric(usage.wasteQty),
            periodIssuedQty: numeric(usage.issuedQty),
            periodReturnedQty: numeric(usage.returnedQty),
        };
    }), [rows, usageByMaterial]);

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="MATERIAL CATALOGUE & USAGE"
                title="Material Master"
                subtitle="Master material identity for BOM/MR traceability plus MatFlow usage reporting. Physical stock, minimum levels and reorder controls remain in Tally."
                actions={
                    <>
                        <Button startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMatFlowExcel({ fileName: "MatFlow_Material_Catalogue_Usage", sheetName: "Materials", title: "MatFlow Material Catalogue & Usage", rows: exportRows })} sx={secondaryBtnSx}>Export Excel</Button>
                        {canManage && <Button onClick={() => downloadMaterialImportTemplate()} sx={secondaryBtnSx}>Import Template</Button>}
                        {canManage && <Button startIcon={<FileUploadOutlinedIcon />} onClick={() => fileRef.current?.click()} disabled={working} sx={secondaryBtnSx}>Import</Button>}
                        <input ref={fileRef} type="file" hidden accept=".xlsx,.xls" onChange={importMaterials} />
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                        {canManage && <Button startIcon={<AddIcon />} onClick={() => open()} sx={primaryBtnSx}>Add Material</Button>}
                    </>
                }
            />
            <ErrorBox>{error}</ErrorBox>
            <Card sx={{ ...panelSx, display: "flex", gap: 1.2, alignItems: "center", flexWrap: "wrap" }}>
                <TextField label="Search Material" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ ...fieldSx, minWidth: 320, flex: "1 1 320px" }} />
                <TextField select label="Usage Period" value={usagePeriod} onChange={(e) => setUsagePeriod(e.target.value)} sx={{ ...fieldSx, minWidth: 190 }}>
                    {MATERIAL_USAGE_PERIODS.map((period) => <MenuItem key={period.value} value={period.value}>{period.label}</MenuItem>)}
                </TextField>
                <Typography sx={subTextSx}>Used = Production consumption + Production wastage + Processing wastage. Stock balances are maintained in Tally.</Typography>
            </Card>

            <Card sx={panelSx}>
                {loading ? <LoadingBlock /> : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "145px 210px 145px minmax(190px,1fr) 80px 105px 105px 105px 105px 95px" }}>
                            {["Code", "Material", "Category", "Specification", "UOM", "Used", "Consumed", "Waste", "Returned", "Action"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {pagination.pageItems.length === 0 ? <EmptyState /> : pagination.pageItems.map((row) => (
                            (() => {
                                const usage = usageByMaterial.get(String(row.id)) || {};
                                return <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "145px 210px 145px minmax(190px,1fr) 80px 105px 105px 105px 105px 95px" }}>
                                    <Box sx={tableCellSx}>{row.materialCode}</Box>
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialName}</Typography><Typography sx={subTextSx}>{row.preferredSupplier || "-"}</Typography></Box>
                                    <Box sx={tableCellSx}>{readable(row.category)}</Box>
                                    <Box sx={{ ...tableCellSx, whiteSpace: "normal" }}>{row.specification || "-"}</Box>
                                    <Box sx={tableCellSx}>{row.uom}</Box>
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{formatQty(usage.usedQty || 0)}</Typography><Typography sx={subTextSx}>{row.uom}</Typography></Box>
                                    <Box sx={tableCellSx}>{formatQty(usage.consumedQty || 0)}</Box>
                                    <Box sx={tableCellSx}>{formatQty(usage.wasteQty || 0)}</Box>
                                    <Box sx={tableCellSx}>{formatQty(usage.returnedQty || 0)}</Box>
                                    <Box sx={tableCellSx}>{canManage && <Button onClick={() => open(row)} sx={secondaryBtnSx}>Edit</Button>}</Box>
                                </Box>;
                            })()
                        ))}
                    </Box>
                )}
                {!loading && <MatFlowPagination {...pagination} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} label="Materials" />}
            </Card>

            <Dialog open={Boolean(dialog)} onClose={() => !working && setDialog(null)} fullWidth maxWidth="md" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>{dialog?.row ? "Edit Material" : "Add Material"}</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
                        <TextField label="Material Code *" value={form.materialCode} onChange={(e) => setForm((c) => ({ ...c, materialCode: e.target.value }))} sx={fieldSx} />
                        <TextField label="Material Name *" value={form.materialName} onChange={(e) => setForm((c) => ({ ...c, materialName: e.target.value }))} sx={fieldSx} />
                        <TextField select label="Category *" value={form.category} onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))} sx={fieldSx}>
                            {MATFLOW_MATERIAL_CATEGORIES.map((category) => <MenuItem key={category.value} value={category.value}>{category.label}</MenuItem>)}
                        </TextField>
                        <TextField label="UOM *" value={form.uom} onChange={(e) => setForm((c) => ({ ...c, uom: e.target.value }))} sx={fieldSx} />
                        <TextField label="Preferred Supplier" value={form.preferredSupplier} onChange={(e) => setForm((c) => ({ ...c, preferredSupplier: e.target.value }))} sx={fieldSx} />
                        <FormControlLabel control={<Switch checked={form.active === true} onChange={(e) => setForm((c) => ({ ...c, active: e.target.checked }))} />} label="Active" />
                        <TextField multiline minRows={3} label="Specification" value={form.specification} onChange={(e) => setForm((c) => ({ ...c, specification: e.target.value }))} sx={{ ...fieldSx, gridColumn: "1 / -1" }} />
                    </Box>
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setDialog(null)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
                    <Button onClick={save} disabled={working} sx={primaryBtnSx}>{working ? "Saving..." : "Save"}</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export function MatFlowLocationsPage() {
    const { hasRole, availablePlants, selectedPlantParam } = useMatFlow();
    const canManage = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.STORE);
    const [rows, setRows] = useState([]);
    const [metadata, setMetadata] = useState({ locationType: [], ownershipType: [] });
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [dialog, setDialog] = useState(null);
    const [form, setForm] = useState(emptyLocation);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [locationResponse, metaResponse] = await Promise.all([
                matflowApi.listLocations({ search: clean(search) || undefined }),
                matflowApi.metadata(),
            ]);
            setRows(extractMatFlowPage(locationResponse?.data).rows.filter((row) =>
                normalize(row?.locationType) !== "QC" &&
                (!selectedPlantParam || upperCode(row.plantCode) === upperCode(selectedPlantParam))
            ));
            setMetadata({
                locationType: (metaResponse?.data?.enums?.locationType || ["STORE", "PROCESSING", "EXTERNAL_PROCESSOR", "PRODUCTION"]).filter((value) => normalize(value) !== "QC"),
                ownershipType: metaResponse?.data?.enums?.ownershipType || ["INTERNAL", "EXTERNAL"],
            });
        } catch (requestError) {
            setRows([]);
            setError(readMatFlowError(requestError, "Unable to load Locations."));
        } finally {
            setLoading(false);
        }
    }, [search, selectedPlantParam]);

    useEffect(() => { load(); }, [load]);
    const pagination = useMatFlowPagination(rows, 20);

    const open = (row = null) => {
        setDialog({ row });
        setForm({
            ...emptyLocation,
            locationCode: row?.locationCode || "",
            locationName: row?.locationName || "",
            plantCode: row?.plantCode || selectedPlantParam || availablePlants[0] || "",
            locationType: row?.locationType || "STORE",
            ownershipType: row?.ownershipType || "INTERNAL",
            supportsStock: row?.supportsStock !== false,
            address: row?.address || "",
            contactPerson: row?.contactPerson || "",
            contactPhone: row?.contactPhone || "",
            active: row?.active !== false,
        });
        setError("");
    };

    const save = async () => {
        if (![form.locationCode, form.locationName, form.plantCode, form.locationType, form.ownershipType].every((value) => clean(value))) {
            setError("Location code, name, Plant, type and ownership are required.");
            return;
        }
        setWorking(true);
        setError("");
        try {
            const body = {
                locationCode: upperCode(form.locationCode),
                locationName: clean(form.locationName),
                plantCode: upperCode(form.plantCode),
                locationType: normalize(form.locationType),
                ownershipType: normalize(form.ownershipType),
                supportsStock: form.supportsStock === true,
                address: clean(form.address) || null,
                contactPerson: clean(form.contactPerson) || null,
                contactPhone: clean(form.contactPhone) || null,
                active: form.active === true,
                rowVersion: dialog?.row?.rowVersion ?? null,
            };
            if (dialog?.row?.id) await matflowApi.updateLocation(dialog.row.id, body);
            else await matflowApi.createLocation(body);
            setDialog(null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to save Location."));
        } finally {
            setWorking(false);
        }
    };

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="LOCATION MASTER"
                title="MatFlow Locations"
                subtitle="Define Store, Processing and Production locations used by material custody. QC is intentionally not a location; it is an AL-P1 Main Store checklist against an MR material lot."
                actions={
                    <>
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                        {canManage && <Button startIcon={<AddIcon />} onClick={() => open()} sx={primaryBtnSx}>Add Location</Button>}
                    </>
                }
            />
            <ErrorBox>{error}</ErrorBox>
            <Card sx={panelSx}><TextField label="Search Location" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ ...fieldSx, minWidth: 320 }} /></Card>

            <Card sx={panelSx}>
                {loading ? <LoadingBlock /> : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "150px 220px 120px 160px 130px 110px 120px" }}>
                            {["Code", "Location", "Plant", "Type", "Ownership", "Custody Tracking", "Action"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {pagination.pageItems.length === 0 ? <EmptyState /> : pagination.pageItems.map((row) => (
                            <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "150px 220px 120px 160px 130px 110px 120px" }}>
                                <Box sx={tableCellSx}>{row.locationCode}</Box>
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.locationName}</Typography><Typography sx={subTextSx}>{row.contactPerson || row.address || "-"}</Typography></Box>
                                <Box sx={tableCellSx}>{row.plantCode}</Box>
                                <Box sx={tableCellSx}><MatFlowStatusChip status={row.locationType} /></Box>
                                <Box sx={tableCellSx}>{readable(row.ownershipType)}</Box>
                                <Box sx={tableCellSx}>{row.supportsStock ? "Yes" : "No"}</Box>
                                <Box sx={tableCellSx}>{canManage && <Button onClick={() => open(row)} sx={secondaryBtnSx}>Edit</Button>}</Box>
                            </Box>
                        ))}
                    </Box>
                )}
                {!loading && <MatFlowPagination {...pagination} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} label="Locations" />}
            </Card>

            <Dialog open={Boolean(dialog)} onClose={() => !working && setDialog(null)} fullWidth maxWidth="md" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>{dialog?.row ? "Edit Location" : "Add Location"}</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
                        <TextField label="Location Code *" value={form.locationCode} onChange={(e) => setForm((c) => ({ ...c, locationCode: e.target.value }))} sx={fieldSx} />
                        <TextField label="Location Name *" value={form.locationName} onChange={(e) => setForm((c) => ({ ...c, locationName: e.target.value }))} sx={fieldSx} />
                        <TextField select label="Plant *" value={form.plantCode} onChange={(e) => setForm((c) => ({ ...c, plantCode: e.target.value }))} sx={fieldSx}>
                            {availablePlants.map((plant) => <MenuItem key={plant} value={plant}>{plant}</MenuItem>)}
                        </TextField>
                        <TextField select label="Location Type *" value={form.locationType} onChange={(e) => setForm((c) => ({ ...c, locationType: e.target.value }))} sx={fieldSx}>
                            {metadata.locationType.map((value) => <MenuItem key={value} value={value}>{readable(value)}</MenuItem>)}
                        </TextField>
                        <TextField select label="Ownership *" value={form.ownershipType} onChange={(e) => setForm((c) => ({ ...c, ownershipType: e.target.value }))} sx={fieldSx}>
                            {metadata.ownershipType.map((value) => <MenuItem key={value} value={value}>{readable(value)}</MenuItem>)}
                        </TextField>
                        <TextField label="Contact Person" value={form.contactPerson} onChange={(e) => setForm((c) => ({ ...c, contactPerson: e.target.value }))} sx={fieldSx} />
                        <TextField label="Contact Phone" value={form.contactPhone} onChange={(e) => setForm((c) => ({ ...c, contactPhone: e.target.value }))} sx={fieldSx} />
                        <TextField multiline minRows={2} label="Address" value={form.address} onChange={(e) => setForm((c) => ({ ...c, address: e.target.value }))} sx={fieldSx} />
                        <FormControlLabel control={<Switch checked={form.supportsStock === true} onChange={(e) => setForm((c) => ({ ...c, supportsStock: e.target.checked }))} />} label="Supports MatFlow Custody Tracking" />
                        <FormControlLabel control={<Switch checked={form.active === true} onChange={(e) => setForm((c) => ({ ...c, active: e.target.checked }))} />} label="Active" />
                    </Box>
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setDialog(null)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
                    <Button onClick={save} disabled={working} sx={primaryBtnSx}>{working ? "Saving..." : "Save"}</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
