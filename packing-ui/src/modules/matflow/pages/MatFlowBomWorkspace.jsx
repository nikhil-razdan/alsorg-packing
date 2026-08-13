import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
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
    LinearProgress,
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import SpeedOutlinedIcon from "@mui/icons-material/SpeedOutlined";
import UndoOutlinedIcon from "@mui/icons-material/UndoOutlined";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { MATFLOW_ROLES, useMatFlow } from "../matflowUi";
import { extractMatFlowPage, matflowApi, readMatFlowError } from "../api/matflowApi";
import { downloadMatFlowBomExcel, downloadMatFlowExcel } from "../api/matflowExcel";
import {
    EmptyState,
    ErrorBox,
    LoadingBlock,
    MatFlowDeleteDialog,
    MatFlowPagination,
    MatFlowStatusChip,
    PageHero,
    clean,
    dangerBtnSx,
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

const BOM_STATUSES = ["", "DRAFT", "SUBMITTED", "APPROVED", "RETURNED", "SUPERSEDED"];
const EDIT_ROLES = [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.ENGINEERING];
const REVIEW_ROLES = [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PRODUCTION];
const REQUISITION_ROLES = [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PRODUCTION];

const projectOf = (bom) => bom?.project || {};
const linesOf = (bom) => Array.isArray(bom?.lines) ? bom.lines : [];
const upperCode = (value) => clean(value).toUpperCase();

const bomWorkflow = (bom) => {
    const status = normalize(bom?.status);
    if (status === "DRAFT") {
        return ["Engineering", "Add material lines and optional Processing Unit choices, then submit."];
    }
    if (status === "RETURNED") {
        return ["Engineering", "Correct the returned BOM and resubmit to Production."];
    }
    if (status === "SUBMITTED") {
        return ["Production", "Review the BOM on this same page and mark Reviewed or Return."];
    }
    if (status === "APPROVED") {
        return ["Production", bom?.effective
            ? "Production review complete. This BOM is effective and can be requisitioned."
            : "Approved revision is waiting to become effective."];
    }
    if (status === "SUPERSEDED") {
        return ["Engineering", "Use the current latest revision."];
    }
    return ["MatFlow", "Review BOM state."];
};

export function MatFlowBomListPage() {
    const navigate = useNavigate();
    const { hasRole, selectedPlantParam } = useMatFlow();
    const canCreate = hasRole(EDIT_ROLES);

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteWorking, setDeleteWorking] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await matflowApi.listBoms({
                search: clean(search) || undefined,
                status: status || undefined,
                latestOnly: true,
            });
            const list = extractMatFlowPage(response?.data).rows;
            setRows(list.filter((row) =>
                !selectedPlantParam ||
                upperCode(row?.plantCode) === upperCode(selectedPlantParam)
            ));
        } catch (requestError) {
            setRows([]);
            setError(readMatFlowError(requestError, "Unable to load Operational BOMs."));
        } finally {
            setLoading(false);
        }
    }, [search, status, selectedPlantParam]);

    useEffect(() => { load(); }, [load]);

    const pagination = useMatFlowPagination(rows, 20);

    const confirmDelete = async () => {
        if (!deleteTarget?.id || deleteTarget.rowVersion == null) return;
        setDeleteWorking(true);
        setError("");
        try {
            await matflowApi.deleteDraftBom(deleteTarget.id, deleteTarget.rowVersion);
            setDeleteTarget(null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to delete the Draft BOM."));
        } finally {
            setDeleteWorking(false);
        }
    };

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="OPERATIONAL BOM"
                title="Product BOMs"
                subtitle="Engineering creates the Product BOM from Material Inventory. BOM numbers follow BOM/yyyy/MM/dd/PD-NO/DRAWING-NO; Production reviews the submitted BOM here with no separate approval desk."
                actions={
                    <>
                        <Button
                            startIcon={<FileDownloadOutlinedIcon />}
                            onClick={() => downloadMatFlowExcel({
                                fileName: "MatFlow_Operational_BOMs",
                                sheetName: "BOMs",
                                title: "MatFlow Operational BOMs",
                                rows,
                            })}
                            sx={secondaryBtnSx}
                        >
                            Export Excel
                        </Button>
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                        {canCreate && (
                            <Button startIcon={<AddIcon />} onClick={() => navigate("/matflow/boms/new")} sx={primaryBtnSx}>
                                Create BOM
                            </Button>
                        )}
                    </>
                }
            />

            <Card sx={panelSx}>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 1 }}>
                    <TextField
                        label="Search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        sx={fieldSx}
                    />
                    <TextField
                        select
                        label="Status"
                        value={status}
                        onChange={(event) => setStatus(event.target.value)}
                        sx={fieldSx}
                    >
                        {BOM_STATUSES.map((value) => (
                            <MenuItem key={value || "ALL"} value={value}>
                                {value ? readable(value) : "All Statuses"}
                            </MenuItem>
                        ))}
                    </TextField>
                </Box>
            </Card>

            <ErrorBox>{error}</ErrorBox>

            <Card sx={panelSx}>
                {loading ? <LoadingBlock /> : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "165px minmax(230px,1fr) 135px 120px 150px 220px 170px" }}>
                            {["BOM / Revision", "PD No. / Product", "Drawing", "Plant", "Status", "Current Owner / Next", "Action"].map((heading) => (
                                <Box key={heading} sx={tableCellSx}>{heading}</Box>
                            ))}
                        </Box>
                        {pagination.pageItems.length === 0 ? <EmptyState>No BOMs found.</EmptyState> : pagination.pageItems.map((row) => {
                            const workflow = bomWorkflow(row);
                            return (
                                <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "165px minmax(230px,1fr) 135px 120px 150px 220px 170px" }}>
                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>{row.bomNumber || "-"}</Typography>
                                        <Typography sx={subTextSx}>Rev {row.revisionNo ?? "-"}{row.effective ? " · Effective" : ""}</Typography>
                                    </Box>
                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>{row.projectCode || "-"}</Typography>
                                        <Typography sx={subTextSx}>{row.productName || "-"} · {row.clientName || "-"}</Typography>
                                    </Box>
                                    <Box sx={tableCellSx}>{row.drawingNo || "-"}</Box>
                                    <Box sx={tableCellSx}>{row.plantCode || "-"}</Box>
                                    <Box sx={tableCellSx}><MatFlowStatusChip status={row.status} /></Box>
                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>{workflow[0]}</Typography>
                                        <Typography sx={subTextSx}>{workflow[1]}</Typography>
                                    </Box>
                                    <Box sx={{ ...tableCellSx, display: "flex", gap: .6, flexWrap: "wrap" }}>
                                        <Button onClick={() => navigate(`/matflow/boms/${row.id}`)} sx={secondaryBtnSx}>
                                            {normalize(row.status) === "SUBMITTED" && hasRole(REVIEW_ROLES) ? "Review" : "Open"}
                                        </Button>
                                        {canCreate && normalize(row.status) === "DRAFT" && row.latestRevision && !row.effective && row.rowVersion != null && (
                                            <Button startIcon={<DeleteOutlineIcon />} onClick={() => setDeleteTarget(row)} sx={dangerBtnSx}>
                                                Delete
                                            </Button>
                                        )}
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                )}
                {!loading && (
                    <MatFlowPagination
                        {...pagination}
                        onPageChange={pagination.setPage}
                        onPageSizeChange={pagination.setPageSize}
                        label="Operational BOMs"
                    />
                )}
            </Card>

            <MatFlowDeleteDialog
                open={Boolean(deleteTarget)}
                title="Delete Draft BOM?"
                subject={deleteTarget ? `${deleteTarget.bomNumber || "BOM"} · Rev ${deleteTarget.revisionNo ?? "-"}` : "Draft BOM"}
                description="Only the latest non-effective Draft revision can be permanently deleted. Submitted, returned, reviewed and superseded revisions remain traceable."
                working={deleteWorking}
                onClose={() => setDeleteTarget(null)}
                onConfirm={confirmDelete}
            />
        </Box>
    );
}


const sectionPalette = {
    METAL: "#60a5fa",
    WOOD: "#8b5cf6",
    VENEER: "#a78bfa",
    LAMINATE: "#c084fc",
    STONE_TILE: "#14b8a6",
    GLASS_MIRROR: "#38bdf8",
    FABRIC_LEATHER: "#ec4899",
    UPHOLSTERY: "#f472b6",
    HARDWARE: "#f59e0b",
    PAINT_POLISH: "#fb7185",
    ADHESIVE_CHEMICAL: "#f97316",
    PACKAGING: "#22c55e",
    RAW_MATERIAL: "#94a3b8",
    OTHER: "#94a3b8",
};

const categoryKey = (line) =>
    normalize(
        line?.materialCategorySnapshot ||
        line?.materialCategory ||
        line?.category ||
        "OTHER"
    ) || "OTHER";

const categoryAccent = (key) => sectionPalette[normalize(key)] || "#60a5fa";

const sectionTitle = (key) => readable(key || "OTHER");

const routesForLine = (routes, lineId) =>
    (Array.isArray(routes) ? routes : [])
        .filter((step) => String(step?.bomLineId || "") === String(lineId || ""))
        .filter((step) => normalize(step?.stepType) === "PROCESSING")
        .sort((a, b) => numeric(a?.sequenceNo) - numeric(b?.sequenceNo));

function BuilderMetaPill({ label, value, accent = "#60a5fa" }) {
    return (
        <Box sx={builderMetaPillSx(accent)}>
            <Typography sx={builderMetaLabelSx}>{label}</Typography>
            <Typography noWrap sx={builderMetaValueSx}>{value ?? "-"}</Typography>
        </Box>
    );
}

function BuilderMiniStat({ icon, title, value, subtitle, accent = "#60a5fa" }) {
    return (
        <Card sx={builderMiniStatSx(accent)}>
            <Box sx={builderMiniIconSx(accent)}>{icon}</Box>
            <Box sx={{ minWidth: 0 }}>
                <Typography sx={builderMiniTitleSx}>{title}</Typography>
                <Typography sx={builderMiniValueSx}>{value}</Typography>
                <Typography sx={builderMiniSubSx}>{subtitle}</Typography>
            </Box>
        </Card>
    );
}

function BuilderAssistantItem({ done, label, subtitle }) {
    return (
        <Box sx={builderAssistantItemSx}>
            <Box sx={builderAssistantDotSx(done)}>{done ? "✓" : "!"}</Box>
            <Box sx={{ minWidth: 0 }}>
                <Typography sx={builderAssistantLabelSx(done)}>{label}</Typography>
                <Typography sx={builderAssistantSubSx}>{subtitle}</Typography>
            </Box>
        </Box>
    );
}

function BuilderWorkflowItem({ number, title, subtitle, active, done }) {
    return (
        <Box sx={builderWorkflowItemSx(active, done)}>
            <Box sx={builderWorkflowNumberSx(active, done)}>{done ? "✓" : number}</Box>
            <Box sx={{ minWidth: 0 }}>
                <Typography sx={builderWorkflowTitleSx}>{title}</Typography>
                <Typography sx={builderAssistantSubSx}>{subtitle}</Typography>
            </Box>
        </Box>
    );
}

function BuilderQuickAction({ icon, title, subtitle, onClick }) {
    return (
        <Button onClick={onClick} sx={builderQuickActionSx}>
            <Box sx={builderQuickIconSx}>{icon}</Box>
            <Box sx={{ minWidth: 0, textAlign: "left", flex: 1 }}>
                <Typography sx={builderQuickTitleSx}>{title}</Typography>
                <Typography sx={builderAssistantSubSx}>{subtitle}</Typography>
            </Box>
            <ArrowForwardIcon sx={{ fontSize: 17, opacity: .65 }} />
        </Button>
    );
}

export function MatFlowBomCreatePage() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const { selectedPlantParam } = useMatFlow();

    const requestedProductId = params.get("productId") || "";
    const [projects, setProjects] = useState([]);
    const [form, setForm] = useState({
        projectId: "",
        projectDrawingId: requestedProductId,
        remarks: "",
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            setError("");
            try {
                const response = await matflowApi.listProjects({
                    active: true,
                    plantCode: selectedPlantParam || undefined,
                });
                const list = (Array.isArray(response?.data) ? response.data : [])
                    .filter((project) => project?.active !== false)
                    .map((project) => ({
                        ...project,
                        products: (Array.isArray(project?.products) ? project.products : [])
                            .filter((product) => product?.active !== false),
                    }))
                    .filter((project) => project.products.length > 0);

                if (!active) return;
                setProjects(list);

                if (requestedProductId) {
                    const owner = list.find((project) =>
                        project.products.some((product) => String(product.id) === String(requestedProductId))
                    );
                    if (owner) {
                        setForm((current) => ({
                            ...current,
                            projectId: String(owner.id),
                            projectDrawingId: String(requestedProductId),
                        }));
                    } else {
                        setError("The requested Product is inactive or outside your current plant access.");
                    }
                }
            } catch (requestError) {
                if (active) {
                    setProjects([]);
                    setError(readMatFlowError(requestError, "Unable to load active Projects and Products."));
                }
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [requestedProductId, selectedPlantParam]);

    const selectedProject = projects.find((project) => String(project.id) === String(form.projectId)) || null;
    const products = Array.isArray(selectedProject?.products) ? selectedProject.products : [];
    const selectedProduct = products.find((product) => String(product.id) === String(form.projectDrawingId)) || null;

    const save = async () => {
        if (!selectedProject?.id) {
            setError("Select a PD No. / Project.");
            return;
        }
        if (!selectedProduct?.id) {
            setError("Select an active Product / Drawing.");
            return;
        }

        setSaving(true);
        setError("");
        try {
            const response = await matflowApi.createBom({
                projectDrawingId: selectedProduct.id,
                remarks: clean(form.remarks) || null,
            });
            if (!response?.data?.id) throw new Error("Created BOM ID was not returned.");
            navigate(`/matflow/boms/${response.data.id}`, { replace: true });
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to create BOM Draft."));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <LoadingBlock />;

    const ready = Boolean(selectedProject?.id && selectedProduct?.id);
    const completion = ready ? 100 : selectedProject?.id ? 50 : 0;

    return (
        <Box sx={pageSx}>
            <Box sx={builderHeroSx}>
                <Box sx={builderHeroLeftSx}>
                    <Box sx={builderChipRowSx}>
                        <Chip label="MATFLOW BOM BUILDER" sx={builderLabelChipSx} />
                        <Chip label={selectedProject?.projectCode || "SELECT PD NO."} sx={builderProjectChipSx} />
                        <Chip label="● NEW DRAFT" sx={builderStatusChipSx("DRAFT")} />
                    </Box>
                    <Typography sx={builderPageTitleSx}>
                        {selectedProduct?.productName || "Create Product BOM"}
                    </Typography>
                    <Typography sx={builderPageSubSx}>
                        Start the operational material BOM against one Product / Drawing. MatFlow will generate the
                        canonical BOM number automatically and open the section-wise builder for Engineering.
                    </Typography>
                    <Box sx={builderMetaRowSx}>
                        <BuilderMetaPill label="PD No." value={selectedProject?.projectCode || "Not selected"} accent="#60a5fa" />
                        <BuilderMetaPill label="Drawing" value={selectedProduct?.drawingNo || "Not selected"} accent="#a78bfa" />
                        <BuilderMetaPill label="Plant" value={selectedProject?.plantCode || selectedPlantParam || "-"} accent="#22c55e" />
                    </Box>
                </Box>

                <Box sx={builderHeroRightSx}>
                    <Card sx={builderReadinessCardSx}>
                        <Box sx={builderReadinessTopSx}>
                            <Box>
                                <Typography sx={builderReadinessLabelSx}>Builder Context</Typography>
                                <Typography sx={builderReadinessValueSx}>{completion}%</Typography>
                            </Box>
                            <Box sx={builderReadinessIconSx}><Inventory2OutlinedIcon /></Box>
                        </Box>
                        <LinearProgress variant="determinate" value={completion} sx={builderProgressSx("#60a5fa")} />
                        <Typography sx={builderReadinessHintSx}>
                            {ready ? "Project and Product selected. Create the Draft to begin material authoring." : "Select PD No. and Product / Drawing."}
                        </Typography>
                    </Card>
                    <Box sx={builderHeroActionRowSx}>
                        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/matflow/boms")} sx={secondaryBtnSx}>Back</Button>
                        <Button startIcon={<SaveOutlinedIcon />} onClick={save} disabled={saving || !ready} sx={primaryBtnSx}>
                            {saving ? "Creating..." : "Create Draft BOM"}
                        </Button>
                    </Box>
                </Box>
            </Box>

            <ErrorBox>{error}</ErrorBox>

            <Box sx={builderSummaryGridSx}>
                <BuilderMiniStat icon={<RuleOutlinedIcon />} title="PD No." value={selectedProject?.projectCode || "-"} subtitle={selectedProject?.projectName || "Select Project"} accent="#60a5fa" />
                <BuilderMiniStat icon={<Inventory2OutlinedIcon />} title="Product" value={selectedProduct?.productName || "-"} subtitle={selectedProject?.clientName || "Select Product"} accent="#22c55e" />
                <BuilderMiniStat icon={<AccountTreeOutlinedIcon />} title="Drawing" value={selectedProduct?.drawingNo || "-"} subtitle={`Revision ${selectedProduct?.drawingRevision || "0"}`} accent="#a78bfa" />
                <BuilderMiniStat icon={<CheckCircleOutlineIcon />} title="Approval" value="Not Required" subtitle="Project/Product are immediately usable" accent="#f59e0b" />
            </Box>

            <Box sx={builderMainGridSx}>
                <Box sx={builderLeftColumnSx}>
                    <Card sx={builderToolbarSx}>
                        <Box>
                            <Typography sx={builderToolbarTitleSx}>BOM Context</Typography>
                            <Typography sx={builderToolbarSubSx}>Choose the owning PD No. and Product / Drawing before material authoring.</Typography>
                        </Box>
                    </Card>

                    <Card sx={{ ...panelSx, m: 0 }}>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
                            <TextField
                                select
                                label="PD No. / Project *"
                                value={form.projectId}
                                onChange={(event) => setForm((current) => ({
                                    ...current,
                                    projectId: event.target.value,
                                    projectDrawingId: "",
                                }))}
                                sx={fieldSx}
                            >
                                {projects.map((project) => (
                                    <MenuItem key={project.id} value={project.id}>
                                        {project.projectCode} · {project.projectName} · {project.clientName}
                                    </MenuItem>
                                ))}
                            </TextField>

                            <TextField
                                select
                                label="Product / Drawing *"
                                value={form.projectDrawingId}
                                disabled={!selectedProject}
                                onChange={(event) => setForm((current) => ({ ...current, projectDrawingId: event.target.value }))}
                                sx={fieldSx}
                            >
                                {products.map((product) => (
                                    <MenuItem key={product.id} value={product.id}>
                                        {product.productName} · {product.drawingNo} · Rev {product.drawingRevision || "0"}
                                    </MenuItem>
                                ))}
                            </TextField>

                            <TextField
                                multiline
                                minRows={4}
                                label="Engineering Remarks"
                                value={form.remarks}
                                onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))}
                                sx={{ ...fieldSx, gridColumn: "1 / -1" }}
                                placeholder="Optional scope / engineering notes for this BOM family"
                            />
                        </Box>
                    </Card>
                </Box>

                <Box sx={builderRightColumnSx}>
                    <Card sx={builderSidePanelSx}>
                        <Box sx={builderSideTitleRowSx}>
                            <Box>
                                <Typography sx={builderSideTitleSx}>BOM Assistant</Typography>
                                <Typography sx={builderAssistantSubSx}>Pre-builder checks.</Typography>
                            </Box>
                            <AutoAwesomeOutlinedIcon sx={{ color: "#93c5fd" }} />
                        </Box>
                        <BuilderAssistantItem done={Boolean(selectedProject)} label="PD No. selected" subtitle={selectedProject ? `${selectedProject.projectCode} · ${selectedProject.clientName}` : "Choose the manufacturing Project / PD."} />
                        <BuilderAssistantItem done={Boolean(selectedProduct)} label="Product / Drawing selected" subtitle={selectedProduct ? `${selectedProduct.productName} · ${selectedProduct.drawingNo}` : "Choose the Product that owns this BOM."} />
                        <BuilderAssistantItem done={ready} label="Ready to create" subtitle="The backend will generate BOM/yyyy/MM/dd/PD-NO/DRAWING-NO." />
                    </Card>

                    <Card sx={builderSidePanelSx}>
                        <Typography sx={builderSideTitleSx}>After Draft Creation</Typography>
                        <Box sx={{ mt: 1 }}>
                            <BuilderWorkflowItem number="1" title="Engineering" subtitle="Add material lines from Material Inventory." active />
                            <BuilderWorkflowItem number="2" title="Processing Options" subtitle="Optionally register approved Processing Units per material." />
                            <BuilderWorkflowItem number="3" title="Production Review" subtitle="Production reviews or returns the submitted BOM on the same page." />
                        </Box>
                    </Card>
                </Box>
            </Box>
        </Box>
    );
}

export function MatFlowBomDetailPage() {
    const { bomId } = useParams();
    const navigate = useNavigate();
    const { hasRole } = useMatFlow();

    const [bom, setBom] = useState(null);
    const [routes, setRoutes] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [processingLocations, setProcessingLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [openSections, setOpenSections] = useState({});
    const [lineDialog, setLineDialog] = useState(null);
    const [lineForm, setLineForm] = useState({ materialId: "", requiredQty: "", wastagePercent: "0", remarks: "" });
    const [routeDialog, setRouteDialog] = useState(null);
    const [routeForm, setRouteForm] = useState({
        sequenceNo: "1",
        locationId: "",
        processCode: "",
        expectedYieldPercent: "100",
        remarks: "",
    });
    const [action, setAction] = useState(null);
    const [actionRemarks, setActionRemarks] = useState("");
    const [deleteTarget, setDeleteTarget] = useState(null);

    const load = useCallback(async () => {
        if (!bomId) return;
        setLoading(true);
        setError("");
        try {
            const [bomResponse, routeResponse] = await Promise.all([
                matflowApi.getBom(bomId),
                matflowApi.listBomRoutes(bomId),
            ]);
            const nextBom = bomResponse?.data || null;
            setBom(nextBom);
            setRoutes(extractMatFlowPage(routeResponse?.data).rows);

            const nextSections = {};
            linesOf(nextBom).forEach((line) => {
                nextSections[categoryKey(line)] = true;
            });
            setOpenSections((current) => ({ ...nextSections, ...current }));
        } catch (requestError) {
            setBom(null);
            setRoutes([]);
            setError(readMatFlowError(requestError, "Unable to load the Operational BOM."));
        } finally {
            setLoading(false);
        }
    }, [bomId]);

    useEffect(() => { load(); }, [load]);

    const status = normalize(bom?.status);
    const project = projectOf(bom);
    const lines = linesOf(bom);
    const canEdit = hasRole(EDIT_ROLES) && bom?.latestRevision === true && ["DRAFT", "RETURNED"].includes(status);
    const canReview = hasRole(REVIEW_ROLES) && status === "SUBMITTED" && bom?.rowVersion != null;
    const canRevision = hasRole(EDIT_ROLES) && status === "APPROVED" && bom?.effective && bom?.latestRevision;
    const canRequisition = hasRole(REQUISITION_ROLES) && status === "APPROVED" && bom?.effective;

    useEffect(() => {
        if (!canEdit) {
            setMaterials([]);
            setProcessingLocations([]);
            return;
        }

        let active = true;
        (async () => {
            try {
                const [materialResponse, locationResponse] = await Promise.all([
                    matflowApi.listMaterials({ active: true }),
                    matflowApi.listLocations({ active: true }),
                ]);
                if (!active) return;
                setMaterials(extractMatFlowPage(materialResponse?.data).rows.filter((row) => row?.active !== false));
                setProcessingLocations(
                    extractMatFlowPage(locationResponse?.data).rows.filter((location) =>
                        location?.active !== false &&
                        ["PROCESSING", "EXTERNAL_PROCESSOR"].includes(normalize(location?.locationType)) &&
                        (!project?.plantCode || upperCode(location?.plantCode) === upperCode(project.plantCode))
                    )
                );
            } catch (requestError) {
                if (active) setError(readMatFlowError(requestError, "Unable to load Material / Processing masters."));
            }
        })();
        return () => { active = false; };
    }, [canEdit, project?.plantCode]);

    const processingByLine = useMemo(() => {
        const map = new Map();
        lines.forEach((line) => map.set(String(line.id), routesForLine(routes, line.id)));
        return map;
    }, [lines, routes]);

    const materialSections = useMemo(() => {
        const grouped = new Map();
        lines.forEach((line) => {
            const key = categoryKey(line);
            if (!grouped.has(key)) {
                grouped.set(key, {
                    key,
                    title: sectionTitle(key),
                    accent: categoryAccent(key),
                    rows: [],
                    processingCount: 0,
                });
            }
            const section = grouped.get(key);
            section.rows.push(line);
            section.processingCount += (processingByLine.get(String(line.id)) || []).length;
        });
        return Array.from(grouped.values()).sort((a, b) => a.title.localeCompare(b.title));
    }, [lines, processingByLine]);

    const validQtyCount = lines.filter((line) => numeric(line.requiredQty) > 0 && numeric(line.netRequiredQty) > 0).length;
    const specifiedCount = lines.filter((line) => Boolean(clean(line.specification) || clean(line.materialName))).length;
    const categorizedCount = lines.filter((line) => Boolean(clean(line.materialCategorySnapshot))).length;
    const readiness = lines.length === 0
        ? 0
        : Math.round(((validQtyCount + specifiedCount + categorizedCount) / (lines.length * 3)) * 100);
    const processingOptionCount = routes.filter((step) => normalize(step?.stepType) === "PROCESSING").length;

    const workflow = bomWorkflow(bom);

    const openLine = (line = null) => {
        setLineDialog({ line });
        setLineForm({
            materialId: line?.materialId || "",
            requiredQty: line?.requiredQty != null ? String(line.requiredQty) : "",
            wastagePercent: line?.wastagePercent != null ? String(line.wastagePercent) : "0",
            remarks: line?.remarks || "",
        });
        setError("");
    };

    const saveLine = async () => {
        const requiredQty = Number(lineForm.requiredQty);
        const wastagePercent = Number(lineForm.wastagePercent || 0);
        if (!lineForm.materialId || !Number.isFinite(requiredQty) || requiredQty <= 0 || !Number.isFinite(wastagePercent) || wastagePercent < 0) {
            setError("Material, positive quantity and non-negative wastage percent are required.");
            return;
        }

        setWorking(true);
        setError("");
        try {
            const body = {
                materialId: lineForm.materialId,
                requiredQty,
                wastagePercent,
                remarks: clean(lineForm.remarks) || null,
                rowVersion: lineDialog?.line?.rowVersion ?? null,
            };
            if (lineDialog?.line?.id) await matflowApi.updateBomLine(bom.id, lineDialog.line.id, body);
            else await matflowApi.addBomLine(bom.id, body);
            setLineDialog(null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to save BOM material line."));
        } finally {
            setWorking(false);
        }
    };

    const deleteLine = async (line) => {
        if (!line?.id || line.rowVersion == null) return;
        setWorking(true);
        setError("");
        try {
            await matflowApi.deleteBomLine(bom.id, line.id, line.rowVersion);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to remove BOM material line."));
        } finally {
            setWorking(false);
        }
    };

    const openRoute = (line, step = null) => {
        const current = processingByLine.get(String(line.id)) || [];
        const nextSequence = current.length ? Math.max(...current.map((item) => numeric(item.sequenceNo))) + 1 : 1;
        setRouteDialog({ line, step });
        setRouteForm({
            sequenceNo: String(step?.sequenceNo ?? nextSequence),
            locationId: step?.locationId || "",
            processCode: step?.processCode || "",
            expectedYieldPercent: String(step?.expectedYieldPercent ?? 100),
            remarks: step?.remarks || "",
        });
        setError("");
    };

    const saveRoute = async () => {
        const sequenceNo = Number(routeForm.sequenceNo);
        const expectedYieldPercent = Number(routeForm.expectedYieldPercent);
        if (!Number.isInteger(sequenceNo) || sequenceNo <= 0 || !routeForm.locationId || !clean(routeForm.processCode)) {
            setError("Processing sequence, Processing Unit and process code are required.");
            return;
        }
        if (!Number.isFinite(expectedYieldPercent) || expectedYieldPercent <= 0 || expectedYieldPercent > 100) {
            setError("Expected yield must be greater than 0 and not more than 100.");
            return;
        }

        setWorking(true);
        setError("");
        try {
            const body = {
                sequenceNo,
                stepType: "PROCESSING",
                locationId: routeForm.locationId,
                processCode: clean(routeForm.processCode).toUpperCase(),
                expectedYieldPercent,
                remarks: clean(routeForm.remarks) || null,
                rowVersion: routeDialog?.step?.rowVersion ?? null,
            };
            if (routeDialog?.step?.id) {
                await matflowApi.updateBomRouteStep(bom.id, routeDialog.line.id, routeDialog.step.id, body);
            } else {
                await matflowApi.addBomRouteStep(bom.id, routeDialog.line.id, body);
            }
            setRouteDialog(null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to save Processing option."));
        } finally {
            setWorking(false);
        }
    };

    const deleteRoute = async (line, step) => {
        if (!step?.id || step.rowVersion == null) return;
        setWorking(true);
        setError("");
        try {
            await matflowApi.deleteBomRouteStep(bom.id, line.id, step.id, step.rowVersion);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to remove Processing option."));
        } finally {
            setWorking(false);
        }
    };

    const executeAction = async () => {
        if (!action || !bom?.id || bom.rowVersion == null) return;
        const remarks = clean(actionRemarks);
        if (action === "RETURN" && !remarks) {
            setError("Return remarks are required.");
            return;
        }
        if (action === "SUBMIT" && lines.length === 0) {
            setError("Add at least one material line before submitting.");
            return;
        }

        setWorking(true);
        setError("");
        try {
            const body = { rowVersion: bom.rowVersion, remarks: remarks || null };
            let response;
            if (action === "SUBMIT") response = await matflowApi.submitBom(bom.id, body);
            if (action === "REVIEW") response = await matflowApi.productionReviewBom(bom.id, body);
            if (action === "RETURN") response = await matflowApi.productionReturnBom(bom.id, body);
            if (action === "REVISION") response = await matflowApi.createBomRevision(bom.id, body);

            const completedAction = action;
            setAction(null);
            setActionRemarks("");
            if (completedAction === "REVISION" && response?.data?.id) {
                navigate(`/matflow/boms/${response.data.id}`, { replace: true });
            } else {
                await load();
            }
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to complete BOM action."));
        } finally {
            setWorking(false);
        }
    };

    const confirmDeleteDraft = async () => {
        if (!bom?.id || bom.rowVersion == null) return;
        setWorking(true);
        setError("");
        try {
            await matflowApi.deleteDraftBom(bom.id, bom.rowVersion);
            navigate("/matflow/boms", { replace: true });
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to delete Draft BOM."));
        } finally {
            setWorking(false);
            setDeleteTarget(null);
        }
    };

    if (loading) return <LoadingBlock />;
    if (!bom) {
        return (
            <Box sx={pageSx}>
                <ErrorBox>{error || "Operational BOM was not found."}</ErrorBox>
                <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/matflow/boms")} sx={secondaryBtnSx}>Back to BOMs</Button>
            </Box>
        );
    }

    const currentStep = status === "SUBMITTED" ? 2 : status === "APPROVED" ? 3 : 1;
    const quickActions = [
        { title: "Material Inventory", subtitle: "Open the source material master.", icon: <Inventory2OutlinedIcon />, path: "/matflow/materials" },
        { title: "Projects & Products", subtitle: "Open the owning PD / Product portfolio.", icon: <RuleOutlinedIcon />, path: "/matflow/projects" },
        { title: "Project Tracker", subtitle: "Trace material execution after MR submission.", icon: <AccountTreeOutlinedIcon />, path: "/matflow/tracker" },
        { title: "Material Requisitions", subtitle: "Open Production material demand.", icon: <SpeedOutlinedIcon />, path: "/matflow/production" },
    ];

    return (
        <Box sx={pageSx}>
            <Box sx={builderHeroSx}>
                <Box sx={builderHeroLeftSx}>
                    <Box sx={builderChipRowSx}>
                        <Chip label="MATFLOW BOM BUILDER" sx={builderLabelChipSx} />
                        <Chip label={project?.projectCode || "NO PD"} sx={builderProjectChipSx} />
                        <Chip label={`● ${readable(status || "UNKNOWN")}`} sx={builderStatusChipSx(status)} />
                        {bom?.effective && <Chip label="EFFECTIVE" sx={builderEffectiveChipSx} />}
                    </Box>

                    <Typography sx={builderPageTitleSx}>{project?.productName || bom?.bomNumber || "Operational BOM"}</Typography>
                    <Typography sx={builderPageSubSx}>
                        Section-wise operational material BOM for {project?.projectCode || "the selected PD"}. Engineering owns material structure and optional Processing Unit choices; Production performs the final review on this same page. Store later makes two independent decisions for each allocated lot: whether a QC check is required and whether one approved Processing option is required before Production.
                    </Typography>

                    <Box sx={builderMetaRowSx}>
                        <BuilderMetaPill label="BOM" value={bom?.bomNumber || "-"} accent="#60a5fa" />
                        <BuilderMetaPill label="Revision" value={`Rev ${bom?.revisionNo ?? "-"}`} accent="#a78bfa" />
                        <BuilderMetaPill label="Drawing" value={project?.drawingNo || "-"} accent="#f59e0b" />
                        <BuilderMetaPill label="Client" value={project?.clientName || "-"} accent="#22c55e" />
                    </Box>
                </Box>

                <Box sx={builderHeroRightSx}>
                    <Card sx={builderReadinessCardSx}>
                        <Box sx={builderReadinessTopSx}>
                            <Box>
                                <Typography sx={builderReadinessLabelSx}>BOM Structure Health</Typography>
                                <Typography sx={builderReadinessValueSx}>{readiness}%</Typography>
                            </Box>
                            <Box sx={builderReadinessIconSx}><CheckCircleOutlineIcon /></Box>
                        </Box>
                        <LinearProgress variant="determinate" value={readiness} sx={builderProgressSx(readiness === 100 ? "#22c55e" : "#60a5fa")} />
                        <Typography sx={builderReadinessHintSx}>
                            {lines.length === 0 ? "Add at least one material to begin." : `${lines.length} material line${lines.length === 1 ? "" : "s"} across ${materialSections.length} categor${materialSections.length === 1 ? "y" : "ies"}.`}
                        </Typography>
                    </Card>

                    <Box sx={builderHeroActionRowSx}>
                        <Button startIcon={<RefreshIcon />} onClick={load} disabled={working} sx={secondaryBtnSx}>Refresh</Button>
                        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/matflow/boms")} sx={secondaryBtnSx}>Back</Button>
                        {canEdit && (
                            <Button startIcon={<AddIcon />} onClick={() => openLine()} disabled={working} sx={primaryBtnSx}>Add Material</Button>
                        )}
                    </Box>
                </Box>
            </Box>

            <ErrorBox>{error}</ErrorBox>

            {status === "RETURNED" && clean(bom?.returnRemarks) && (
                <Alert severity="warning" sx={{ borderRadius: 2 }}>
                    Production returned this BOM: {bom.returnRemarks}
                </Alert>
            )}

            <Box sx={builderSummaryGridSx}>
                <BuilderMiniStat icon={<Inventory2OutlinedIcon />} title="Material Lines" value={lines.length} subtitle="Across operational sections" accent="#60a5fa" />
                <BuilderMiniStat icon={<RuleOutlinedIcon />} title="Categories" value={materialSections.length} subtitle="Material structure groups" accent="#22c55e" />
                <BuilderMiniStat icon={<AccountTreeOutlinedIcon />} title="Processing Options" value={processingOptionCount} subtitle="Optional Store-selected units" accent="#a78bfa" />
                <BuilderMiniStat icon={<CheckCircleOutlineIcon />} title="Current Owner" value={workflow[0]} subtitle={readable(status)} accent="#f59e0b" />
            </Box>

            <Box sx={builderMainGridSx}>
                <Box sx={builderLeftColumnSx}>
                    <Card sx={builderToolbarSx}>
                        <Box>
                            <Typography sx={builderToolbarTitleSx}>BOM Sections</Typography>
                            <Typography sx={builderToolbarSubSx}>Material Inventory rows grouped automatically by operational category.</Typography>
                        </Box>
                        <Box sx={{ display: "flex", gap: .8, flexWrap: "wrap" }}>
                            <Button
                                startIcon={<FileDownloadOutlinedIcon />}
                                onClick={() => downloadMatFlowBomExcel({ bom, routes })}
                                sx={secondaryBtnSx}
                            >
                                Download BOM
                            </Button>
                            {canEdit && <Button startIcon={<AddIcon />} onClick={() => openLine()} sx={primaryBtnSx}>Add Material</Button>}
                        </Box>
                    </Card>

                    {materialSections.length === 0 ? (
                        <Card sx={{ ...panelSx, m: 0 }}>
                            <EmptyState>No BOM materials yet. Engineering can add materials from Material Inventory.</EmptyState>
                        </Card>
                    ) : materialSections.map((section) => {
                        const isOpen = openSections[section.key] !== false;
                        return (
                            <Card key={section.key} sx={builderSectionCardSx(section.accent, isOpen)}>
                                <Box sx={builderSectionHeaderSx}>
                                    <Box sx={builderSectionLeftSx}>
                                        <IconButton size="small" onClick={() => setOpenSections((current) => ({ ...current, [section.key]: !isOpen }))} sx={builderSectionIconBtnSx}>
                                            {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                        </IconButton>
                                        <Box>
                                            <Box sx={builderSectionTitleRowSx}>
                                                <Typography sx={builderSectionTitleSx}>{section.title}</Typography>
                                                <Chip label={`${section.rows.length} ${section.rows.length === 1 ? "Item" : "Items"}`} size="small" sx={builderCountChipSx} />
                                            </Box>
                                            <Typography sx={builderSectionSubSx}>
                                                {section.processingCount} optional Processing Unit choice{section.processingCount === 1 ? "" : "s"}
                                            </Typography>
                                        </Box>
                                    </Box>
                                    <Box sx={builderSectionRightSx}>
                                        <Typography sx={builderSectionRightValueSx}>{section.rows.length}</Typography>
                                        <Typography sx={builderSectionRightLabelSx}>Material lines</Typography>
                                    </Box>
                                </Box>

                                <Collapse in={isOpen}>
                                    <Box sx={builderSectionTableShellSx}>
                                        <Box sx={{ ...builderSectionTableHeaderSx, gridTemplateColumns: "54px minmax(190px,1.1fr) minmax(150px,.9fr) 70px 90px 82px 95px minmax(210px,1.2fr) 150px" }}>
                                            {[
                                                "Line", "Material", "Specification", "UOM", "Required", "Waste %", "Net Qty", "Processing Options", "Action",
                                            ].map((heading) => <Box key={heading} sx={builderSectionCellSx}>{heading}</Box>)}
                                        </Box>

                                        {section.rows.map((line) => {
                                            const steps = processingByLine.get(String(line.id)) || [];
                                            return (
                                                <Box key={line.id} sx={{ ...builderSectionTableRowSx, gridTemplateColumns: "54px minmax(190px,1.1fr) minmax(150px,.9fr) 70px 90px 82px 95px minmax(210px,1.2fr) 150px" }}>
                                                    <Box sx={builderSectionCellSx}>{line.lineNo ?? "-"}</Box>
                                                    <Box sx={builderSectionCellSx}>
                                                        <Typography sx={mainTextSx}>{line.materialName || "-"}</Typography>
                                                        <Typography sx={subTextSx}>{line.materialCode || "-"}</Typography>
                                                    </Box>
                                                    <Box sx={builderSectionCellSx}><Typography sx={subTextSx}>{line.specification || "-"}</Typography></Box>
                                                    <Box sx={builderSectionCellSx}>{line.uom || "-"}</Box>
                                                    <Box sx={builderSectionCellSx}>{formatQty(line.requiredQty)}</Box>
                                                    <Box sx={builderSectionCellSx}>{formatQty(line.wastagePercent)}%</Box>
                                                    <Box sx={builderSectionCellSx}>{formatQty(line.netRequiredQty)}</Box>
                                                    <Box sx={builderSectionCellSx}>
                                                        {steps.length === 0 ? (
                                                            <Typography sx={subTextSx}>None configured</Typography>
                                                        ) : (
                                                            <Box sx={{ display: "flex", gap: .45, flexWrap: "wrap" }}>
                                                                {steps.map((step) => (
                                                                    <Chip
                                                                        key={step.id}
                                                                        size="small"
                                                                        label={`${step.processCode || "PROCESS"} · ${step.locationCode || step.locationName || "UNIT"}`}
                                                                        onClick={canEdit ? () => openRoute(line, step) : undefined}
                                                                        sx={builderProcessingChipSx}
                                                                    />
                                                                ))}
                                                            </Box>
                                                        )}
                                                    </Box>
                                                    <Box sx={{ ...builderSectionCellSx, display: "flex", gap: .45, flexWrap: "wrap" }}>
                                                        {canEdit ? (
                                                            <>
                                                                <Button onClick={() => openLine(line)} sx={secondaryBtnSx}>Edit</Button>
                                                                <Button onClick={() => openRoute(line)} sx={secondaryBtnSx}>Processing</Button>
                                                                <IconButton onClick={() => deleteLine(line)} disabled={working} sx={builderDeleteIconSx}><DeleteOutlineIcon fontSize="small" /></IconButton>
                                                            </>
                                                        ) : <Typography sx={subTextSx}>Read only</Typography>}
                                                    </Box>
                                                </Box>
                                            );
                                        })}
                                    </Box>
                                </Collapse>
                            </Card>
                        );
                    })}

                    <Card sx={{ ...panelSx, m: 0 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                            <Box>
                                <Typography sx={{ fontWeight: 950, fontSize: 16 }}>Workflow Action</Typography>
                                <Typography sx={subTextSx}>{workflow[1]}</Typography>
                            </Box>
                            <Box sx={{ display: "flex", gap: .7, flexWrap: "wrap" }}>
                                {canEdit && ["DRAFT", "RETURNED"].includes(status) && (
                                    <Button startIcon={<SendOutlinedIcon />} onClick={() => { setAction("SUBMIT"); setActionRemarks(""); }} sx={primaryBtnSx}>Submit to Production</Button>
                                )}
                                {canReview && (
                                    <>
                                        <Button startIcon={<UndoOutlinedIcon />} onClick={() => { setAction("RETURN"); setActionRemarks(""); }} sx={secondaryBtnSx}>Return to Engineering</Button>
                                        <Button startIcon={<CheckCircleOutlineIcon />} onClick={() => { setAction("REVIEW"); setActionRemarks(""); }} sx={primaryBtnSx}>Mark Reviewed</Button>
                                    </>
                                )}
                                {canRequisition && (
                                    <Button endIcon={<ArrowForwardIcon />} onClick={() => navigate(`/matflow/requisitions/new?bomId=${encodeURIComponent(bom.id)}`)} sx={primaryBtnSx}>Raise MR</Button>
                                )}
                                {canRevision && (
                                    <Button startIcon={<EditOutlinedIcon />} onClick={() => { setAction("REVISION"); setActionRemarks(""); }} sx={secondaryBtnSx}>Create Revision</Button>
                                )}
                                {canEdit && status === "DRAFT" && bom.latestRevision && !bom.effective && (
                                    <Button startIcon={<DeleteOutlineIcon />} onClick={() => setDeleteTarget(bom)} sx={dangerBtnSx}>Delete Draft</Button>
                                )}
                            </Box>
                        </Box>
                    </Card>

                    {Array.isArray(bom.history) && bom.history.length > 0 && (
                        <Card sx={{ ...panelSx, m: 0 }}>
                            <Typography sx={{ fontWeight: 950, fontSize: 16, mb: 1 }}>BOM History</Typography>
                            <Box sx={tableShellSx}>
                                <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "160px 150px 150px minmax(220px,1fr)" }}>
                                    {["Action", "Actor", "Time", "Remarks"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                                </Box>
                                {bom.history.map((row) => (
                                    <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "160px 150px 150px minmax(220px,1fr)" }}>
                                        <Box sx={tableCellSx}>{readable(row.action)}</Box>
                                        <Box sx={tableCellSx}>{row.actionBy || "-"}</Box>
                                        <Box sx={tableCellSx}>{formatDate(row.actionAt)}</Box>
                                        <Box sx={tableCellSx}>{row.remarks || "-"}</Box>
                                    </Box>
                                ))}
                            </Box>
                        </Card>
                    )}
                </Box>

                <Box sx={builderRightColumnSx}>
                    <Card sx={builderSidePanelSx}>
                        <Box sx={builderSideTitleRowSx}>
                            <Box>
                                <Typography sx={builderSideTitleSx}>BOM Assistant</Typography>
                                <Typography sx={builderAssistantSubSx}>Operational checks before Production review.</Typography>
                            </Box>
                            <AutoAwesomeOutlinedIcon sx={{ color: "#93c5fd" }} />
                        </Box>
                        <BuilderAssistantItem done={lines.length > 0} label="Material structure" subtitle={lines.length ? `${lines.length} material line(s) added.` : "At least one material is required."} />
                        <BuilderAssistantItem done={lines.length > 0 && validQtyCount === lines.length} label="Quantity validation" subtitle={lines.length > 0 && validQtyCount === lines.length ? "All required/net quantities are positive." : "Correct zero or invalid quantities before submission."} />
                        <BuilderAssistantItem done={lines.length > 0 && categorizedCount === lines.length} label="Category snapshots" subtitle="Material categories organize the builder and remain traceable." />
                        <BuilderAssistantItem done={status === "APPROVED" && bom?.effective === true} label="Production review" subtitle={status === "APPROVED" && bom?.effective ? "Reviewed and effective for MR creation." : `Current owner: ${workflow[0]}.`} />
                    </Card>

                    <Card sx={builderSidePanelSx}>
                        <Box sx={builderSideTitleRowSx}>
                            <Box>
                                <Typography sx={builderSideTitleSx}>Workflow</Typography>
                                <Typography sx={builderAssistantSubSx}>No separate review page or Director gate.</Typography>
                            </Box>
                            <RuleOutlinedIcon sx={{ color: "#93c5fd" }} />
                        </Box>
                        <Box sx={{ mt: 1 }}>
                            <BuilderWorkflowItem number="1" title="Engineering BOM" subtitle="Create/edit lines and optional Processing Unit choices." active={currentStep === 1} done={currentStep > 1} />
                            <BuilderWorkflowItem number="2" title="Production Review" subtitle="Mark Reviewed or return to Engineering on this BOM page." active={currentStep === 2} done={currentStep > 2} />
                            <BuilderWorkflowItem number="3" title="MR Ready" subtitle="Effective BOM can be requested by Production." active={currentStep === 3} done={status === "APPROVED" && bom?.effective} />
                        </Box>
                    </Card>

                    <Card sx={builderSidePanelSx}>
                        <Box sx={builderSideTitleRowSx}>
                            <Box>
                                <Typography sx={builderSideTitleSx}>Routing Rule</Typography>
                                <Typography sx={builderAssistantSubSx}>Keep BOM routing simple and optional.</Typography>
                            </Box>
                            <AccountTreeOutlinedIcon sx={{ color: "#93c5fd" }} />
                        </Box>
                        <Alert severity="info" sx={{ mt: 1, borderRadius: 2 }}>
                            Store independently decides whether a reserved MR lot needs a QC check and whether it needs Processing. If Processing is required, Store selects one of the Processing Units configured for that material here. QC is only a check/tick and never chooses this route.
                        </Alert>
                    </Card>

                    <Card sx={builderSidePanelSx}>
                        <Box sx={builderSideTitleRowSx}>
                            <Box>
                                <Typography sx={builderSideTitleSx}>Section Split</Typography>
                                <Typography sx={builderAssistantSubSx}>Line distribution by material category.</Typography>
                            </Box>
                            <AccountTreeOutlinedIcon sx={{ color: "#93c5fd" }} />
                        </Box>
                        <Box sx={{ mt: 1, display: "grid", gap: 1 }}>
                            {materialSections.length === 0 ? (
                                <Typography sx={builderAssistantSubSx}>Add materials to generate the section distribution.</Typography>
                            ) : materialSections.map((section) => {
                                const percent = lines.length ? Math.round((section.rows.length / lines.length) * 100) : 0;
                                return (
                                    <Box key={section.key}>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, mb: .4 }}>
                                            <Typography sx={builderQuickTitleSx}>{section.title}</Typography>
                                            <Typography sx={builderAssistantSubSx}>{percent}%</Typography>
                                        </Box>
                                        <LinearProgress variant="determinate" value={percent} sx={builderProgressSx(section.accent)} />
                                    </Box>
                                );
                            })}
                        </Box>
                    </Card>

                    <Card sx={builderSidePanelSx}>
                        <Box sx={builderSideTitleRowSx}>
                            <Box>
                                <Typography sx={builderSideTitleSx}>Quick Actions</Typography>
                                <Typography sx={builderAssistantSubSx}>Related MatFlow workspaces.</Typography>
                            </Box>
                            <SpeedOutlinedIcon sx={{ color: "#93c5fd" }} />
                        </Box>
                        <Box sx={{ mt: 1, display: "grid", gap: .8 }}>
                            {quickActions.map((item) => <BuilderQuickAction key={item.title} {...item} onClick={() => navigate(item.path)} />)}
                        </Box>
                    </Card>
                </Box>
            </Box>

            <Dialog open={Boolean(lineDialog)} onClose={() => !working && setLineDialog(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>{lineDialog?.line ? "Edit BOM Material" : "Add BOM Material"}</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Box sx={{ display: "grid", gap: 1.5 }}>
                        <TextField
                            select
                            label="Material *"
                            value={lineForm.materialId}
                            disabled={Boolean(lineDialog?.line)}
                            onChange={(event) => setLineForm((current) => ({ ...current, materialId: event.target.value }))}
                            sx={fieldSx}
                        >
                            {materials.map((material) => (
                                <MenuItem key={material.id} value={material.id}>
                                    {material.materialName} · {material.materialCode} · {readable(material.category)} · {material.uom}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField type="number" label="Required Qty *" value={lineForm.requiredQty} onChange={(event) => setLineForm((current) => ({ ...current, requiredQty: event.target.value }))} sx={fieldSx} />
                        <TextField type="number" label="Wastage %" value={lineForm.wastagePercent} onChange={(event) => setLineForm((current) => ({ ...current, wastagePercent: event.target.value }))} sx={fieldSx} />
                        <TextField multiline minRows={3} label="Remarks" value={lineForm.remarks} onChange={(event) => setLineForm((current) => ({ ...current, remarks: event.target.value }))} sx={fieldSx} />
                    </Box>
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setLineDialog(null)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
                    <Button onClick={saveLine} disabled={working} sx={primaryBtnSx}>{working ? "Saving..." : "Save Material"}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(routeDialog)} onClose={() => !working && setRouteDialog(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>{routeDialog?.step ? "Edit Processing Option" : "Add Processing Option"}</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Alert severity="info" sx={{ mb: 1.5, borderRadius: 2 }}>
                        This is an approved Processing Unit option only. Store may select it for an MR lot whether QC is required or not. Direct to Production remains valid when Processing is not required.
                    </Alert>
                    <Box sx={{ display: "grid", gap: 1.5 }}>
                        <TextField type="number" label="Option Sequence *" value={routeForm.sequenceNo} onChange={(event) => setRouteForm((current) => ({ ...current, sequenceNo: event.target.value }))} sx={fieldSx} />
                        <TextField select label="Processing Unit *" value={routeForm.locationId} onChange={(event) => setRouteForm((current) => ({ ...current, locationId: event.target.value }))} sx={fieldSx}>
                            {processingLocations.map((location) => (
                                <MenuItem key={location.id} value={location.id}>
                                    {location.locationCode} · {location.locationName} · {readable(location.locationType)}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField label="Process Code *" value={routeForm.processCode} onChange={(event) => setRouteForm((current) => ({ ...current, processCode: event.target.value }))} sx={fieldSx} />
                        <TextField type="number" label="Expected Yield %" value={routeForm.expectedYieldPercent} onChange={(event) => setRouteForm((current) => ({ ...current, expectedYieldPercent: event.target.value }))} sx={fieldSx} />
                        <TextField multiline minRows={2} label="Remarks" value={routeForm.remarks} onChange={(event) => setRouteForm((current) => ({ ...current, remarks: event.target.value }))} sx={fieldSx} />
                    </Box>
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    {routeDialog?.step && (
                        <Button onClick={async () => { const line = routeDialog.line; const step = routeDialog.step; setRouteDialog(null); await deleteRoute(line, step); }} disabled={working} sx={dangerBtnSx}>Delete Option</Button>
                    )}
                    <Box sx={{ flex: 1 }} />
                    <Button onClick={() => setRouteDialog(null)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
                    <Button onClick={saveRoute} disabled={working || processingLocations.length === 0} sx={primaryBtnSx}>{working ? "Saving..." : "Save Option"}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(action)} onClose={() => !working && setAction(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>
                    {action === "SUBMIT" ? "Submit BOM to Production"
                        : action === "REVIEW" ? "Mark BOM Reviewed"
                            : action === "RETURN" ? "Return BOM to Engineering"
                                : "Create BOM Revision"}
                </DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <TextField multiline minRows={3} label={action === "RETURN" ? "Return Remarks *" : "Remarks"} value={actionRemarks} onChange={(event) => setActionRemarks(event.target.value)} sx={fieldSx} fullWidth />
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setAction(null)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
                    <Button onClick={executeAction} disabled={working} sx={primaryBtnSx}>{working ? "Working..." : "Confirm"}</Button>
                </DialogActions>
            </Dialog>

            <MatFlowDeleteDialog
                open={Boolean(deleteTarget)}
                title="Delete Draft BOM?"
                subject={bom?.bomNumber || "Draft BOM"}
                description="This is allowed only while the latest revision is a non-effective Draft. Submitted/reviewed BOM history remains immutable."
                working={working}
                onClose={() => setDeleteTarget(null)}
                onConfirm={confirmDeleteDraft}
            />
        </Box>
    );
}

/* BOMFlow-inspired MatFlow builder chrome. Uses MatFlow theme variables only. */
const builderHeroSx = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "stretch",
    gap: 2,
    p: { xs: 2, md: 2.4 },
    border: "1px solid var(--mf-border)",
    borderRadius: 3,
    background: "var(--mf-hero-bg)",
    boxShadow: "var(--mf-card-shadow)",
    flexWrap: { xs: "wrap", lg: "nowrap" },
};
const builderHeroLeftSx = { flex: "1 1 640px", minWidth: 0 };
const builderHeroRightSx = { flex: "0 1 330px", minWidth: { xs: "100%", lg: 310 }, display: "grid", gap: 1 };
const builderChipRowSx = { display: "flex", gap: .7, flexWrap: "wrap", mb: 1 };
const builderLabelChipSx = { height: 24, fontSize: 10.5, fontWeight: 950, letterSpacing: .8, color: "var(--mf-primary-text)", background: "var(--mf-primary-soft)", border: "1px solid var(--mf-primary-border)" };
const builderProjectChipSx = { height: 24, fontSize: 10.5, fontWeight: 900, color: "var(--mf-purple-text)", background: "var(--mf-purple-soft)", border: "1px solid var(--mf-purple-border)" };
const builderStatusChipSx = (status) => {
    const value = normalize(status);
    const success = ["APPROVED", "EFFECTIVE"].includes(value);
    const warning = ["SUBMITTED", "RETURNED"].includes(value);
    return { height: 24, fontSize: 10.5, fontWeight: 900, color: success ? "var(--mf-success-text)" : warning ? "var(--mf-warning-text)" : "var(--mf-text-secondary)", background: success ? "var(--mf-success-soft)" : warning ? "var(--mf-warning-soft)" : "var(--mf-surface-strong)", border: `1px solid ${success ? "var(--mf-success-border)" : warning ? "var(--mf-warning-border)" : "var(--mf-border)"}` };
};
const builderEffectiveChipSx = { height: 24, fontSize: 10.5, fontWeight: 950, color: "var(--mf-success-text)", background: "var(--mf-success-soft)", border: "1px solid var(--mf-success-border)" };
const builderPageTitleSx = { color: "var(--mf-text)", fontWeight: 980, fontSize: { xs: 25, md: 31 }, lineHeight: 1.13, letterSpacing: -.6 };
const builderPageSubSx = { mt: .7, color: "var(--mf-text-secondary)", fontSize: 12.5, lineHeight: 1.65, maxWidth: 880 };
const builderMetaRowSx = { display: "flex", flexWrap: "wrap", gap: .8, mt: 1.4 };
const builderMetaPillSx = (accent) => ({ minWidth: 110, maxWidth: 230, px: 1.05, py: .72, borderRadius: 1.8, background: "var(--mf-surface)", border: `1px solid ${accent}33`, borderLeft: `3px solid ${accent}` });
const builderMetaLabelSx = { color: "var(--mf-text-muted)", fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: .55 };
const builderMetaValueSx = { color: "var(--mf-text)", fontSize: 11.8, fontWeight: 900, mt: .15 };
const builderReadinessCardSx = { m: 0, p: 1.5, boxShadow: "none", background: "var(--mf-card-bg-elevated)" };
const builderReadinessTopSx = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 };
const builderReadinessLabelSx = { color: "var(--mf-text-secondary)", fontSize: 10.5, fontWeight: 850, textTransform: "uppercase", letterSpacing: .45 };
const builderReadinessValueSx = { color: "var(--mf-text)", fontSize: 26, lineHeight: 1.1, fontWeight: 980, mt: .25 };
const builderReadinessIconSx = { width: 36, height: 36, borderRadius: 2, display: "grid", placeItems: "center", color: "var(--mf-primary-text)", background: "var(--mf-primary-soft)" };
const builderReadinessHintSx = { mt: .75, color: "var(--mf-text-muted)", fontSize: 10.7, lineHeight: 1.45 };
const builderProgressSx = (accent) => ({ mt: 1, height: 6, borderRadius: 9, backgroundColor: "var(--mf-surface-strong)", "& .MuiLinearProgress-bar": { borderRadius: 9, backgroundColor: accent } });
const builderHeroActionRowSx = { display: "flex", gap: .7, flexWrap: "wrap", justifyContent: "flex-end" };
const builderSummaryGridSx = { display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))", xl: "repeat(4,minmax(0,1fr))" }, gap: 1 };
const builderMiniStatSx = (accent) => ({ m: 0, p: 1.35, display: "flex", gap: 1.05, alignItems: "center", borderTop: `2px solid ${accent}`, boxShadow: "none" });
const builderMiniIconSx = (accent) => ({ flex: "0 0 auto", width: 34, height: 34, borderRadius: 2, display: "grid", placeItems: "center", color: accent, background: `${accent}18` });
const builderMiniTitleSx = { color: "var(--mf-text-muted)", fontSize: 9.8, fontWeight: 800, textTransform: "uppercase", letterSpacing: .45 };
const builderMiniValueSx = { color: "var(--mf-text)", fontSize: 16.5, fontWeight: 950, lineHeight: 1.2, mt: .1, overflow: "hidden", textOverflow: "ellipsis" };
const builderMiniSubSx = { color: "var(--mf-text-muted)", fontSize: 9.8, mt: .2, lineHeight: 1.35 };
const builderMainGridSx = { display: "grid", gridTemplateColumns: { xs: "1fr", xl: "minmax(0,1fr) 310px" }, gap: 1.25, alignItems: "start" };
const builderLeftColumnSx = { display: "grid", gap: 1.05, minWidth: 0 };
const builderRightColumnSx = { display: "grid", gap: 1.05, minWidth: 0 };
const builderToolbarSx = { ...panelSx, m: 0, p: 1.35, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap", boxShadow: "none" };
const builderToolbarTitleSx = { color: "var(--mf-text)", fontSize: 15.5, fontWeight: 950 };
const builderToolbarSubSx = { color: "var(--mf-text-muted)", fontSize: 10.8, mt: .15 };
const builderSectionCardSx = (accent, open) => ({ m: 0, overflow: "hidden", borderLeft: `3px solid ${accent}`, boxShadow: open ? "var(--mf-card-shadow)" : "none" });
const builderSectionHeaderSx = { p: 1.15, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 };
const builderSectionLeftSx = { display: "flex", alignItems: "center", gap: .8, minWidth: 0 };
const builderSectionIconBtnSx = { color: "var(--mf-text-secondary)", border: "1px solid var(--mf-border)", borderRadius: 1.5, width: 30, height: 30 };
const builderSectionTitleRowSx = { display: "flex", alignItems: "center", gap: .6, flexWrap: "wrap" };
const builderSectionTitleSx = { color: "var(--mf-text)", fontSize: 14, fontWeight: 950 };
const builderCountChipSx = { height: 20, fontSize: 9.5, fontWeight: 850, color: "var(--mf-text-secondary)", background: "var(--mf-surface-strong)", border: "1px solid var(--mf-border)" };
const builderSectionSubSx = { color: "var(--mf-text-muted)", fontSize: 10.2, mt: .15 };
const builderSectionRightSx = { textAlign: "right", minWidth: 74 };
const builderSectionRightLabelSx = { color: "var(--mf-text-muted)", fontSize: 9.4 };
const builderSectionRightValueSx = { color: "var(--mf-text)", fontSize: 14.2, fontWeight: 950 };
const builderSectionTableShellSx = { overflowX: "auto", borderTop: "1px solid var(--mf-border)" };
const builderSectionTableHeaderSx = { minWidth: 1230, display: "grid", alignItems: "center", background: "var(--mf-table-head)", borderBottom: "1px solid var(--mf-border)", color: "var(--mf-text-secondary)", fontSize: 9.6, fontWeight: 900, textTransform: "uppercase", letterSpacing: .35 };
const builderSectionTableRowSx = { minWidth: 1230, display: "grid", alignItems: "center", background: "var(--mf-table-row)", borderBottom: "1px solid var(--mf-border)", "&:hover": { background: "var(--mf-table-hover)" } };
const builderSectionCellSx = { p: .8, minWidth: 0, fontSize: 11, color: "var(--mf-text-secondary)", overflowWrap: "anywhere" };
const builderProcessingChipSx = { height: 22, fontSize: 9.4, fontWeight: 800, color: "var(--mf-purple-text)", background: "var(--mf-purple-soft)", border: "1px solid var(--mf-purple-border)", cursor: "pointer" };
const builderDeleteIconSx = { width: 30, height: 30, color: "var(--mf-danger-text)", border: "1px solid var(--mf-danger-border)", borderRadius: 1.5 };
const builderSidePanelSx = { ...panelSx, m: 0, p: 1.3, boxShadow: "none" };
const builderSideTitleRowSx = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 };
const builderSideTitleSx = { color: "var(--mf-text)", fontSize: 14.2, fontWeight: 950 };
const builderAssistantItemSx = { display: "flex", gap: .75, py: .85, borderBottom: "1px solid var(--mf-border)", "&:last-of-type": { borderBottom: 0 } };
const builderAssistantDotSx = (done) => ({ flex: "0 0 auto", width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 10.5, fontWeight: 950, color: done ? "var(--mf-success-text)" : "var(--mf-warning-text)", background: done ? "var(--mf-success-soft)" : "var(--mf-warning-soft)", border: `1px solid ${done ? "var(--mf-success-border)" : "var(--mf-warning-border)"}` });
const builderAssistantLabelSx = (done) => ({ color: done ? "var(--mf-text)" : "var(--mf-warning-text)", fontSize: 11.3, fontWeight: 900, lineHeight: 1.3 });
const builderAssistantSubSx = { color: "var(--mf-text-muted)", fontSize: 9.9, lineHeight: 1.45, mt: .15 };
const builderWorkflowItemSx = (active, done) => ({ display: "flex", gap: .75, p: .8, borderRadius: 1.6, border: `1px solid ${active ? "var(--mf-primary-border)" : "var(--mf-border)"}`, background: active ? "var(--mf-primary-soft)" : done ? "var(--mf-success-soft)" : "var(--mf-surface)", mb: .65 });
const builderWorkflowNumberSx = (active, done) => ({ flex: "0 0 auto", width: 24, height: 24, display: "grid", placeItems: "center", borderRadius: "50%", fontSize: 10.5, fontWeight: 950, color: done ? "var(--mf-success-text)" : active ? "var(--mf-primary-text)" : "var(--mf-text-muted)", background: done ? "var(--mf-success-soft)" : active ? "var(--mf-primary-soft)" : "var(--mf-surface-strong)", border: `1px solid ${done ? "var(--mf-success-border)" : active ? "var(--mf-primary-border)" : "var(--mf-border)"}` });
const builderWorkflowTitleSx = { color: "var(--mf-text)", fontSize: 11.2, fontWeight: 900 };
const builderQuickActionSx = { width: "100%", justifyContent: "flex-start", gap: .75, px: .8, py: .75, color: "var(--mf-text)", border: "1px solid var(--mf-border)", borderRadius: 1.6, background: "var(--mf-surface)", "&:hover": { background: "var(--mf-hover)" } };
const builderQuickIconSx = { width: 28, height: 28, borderRadius: 1.5, display: "grid", placeItems: "center", color: "var(--mf-primary-text)", background: "var(--mf-primary-soft)", "& svg": { fontSize: 17 } };
const builderQuickTitleSx = { color: "var(--mf-text)", fontSize: 10.7, fontWeight: 900 };