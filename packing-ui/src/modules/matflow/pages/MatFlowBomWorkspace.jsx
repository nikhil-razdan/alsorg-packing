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
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import SpeedOutlinedIcon from "@mui/icons-material/SpeedOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ApprovalOutlinedIcon from "@mui/icons-material/ApprovalOutlined";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import UndoOutlinedIcon from "@mui/icons-material/UndoOutlined";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MATFLOW_ROLES, useMatFlow } from "../matflowUi";
import { extractMatFlowPage, matflowApi, readMatFlowError } from "../api/matflowApi";
import {
    Detail,
    EmptyState,
    ErrorBox,
    LoadingBlock,
    MatFlowStatusChip,
    MatFlowPagination,
    MatFlowDeleteDialog,
    PageHero,
    clean,
    dialogActionsSx,
    dialogContentSx,
    dialogPaperSx,
    dialogTitleSx,
    dangerBtnSx,
    fieldSx,
    formatQty,
    mainTextSx,
    normalize,
    pageSx,
    panelSx,
    primaryBtnSx,
    readable,
    secondaryBtnSx,
    sectionSubSx,
    sectionTitleSx,
    subTextSx,
    tableCellSx,
    tableHeaderSx,
    tableRowSx,
    tableShellSx,
    useMatFlowPagination,
} from "../matflowUi";

const BOM_STATUSES = ["", "DRAFT", "SUBMITTED", "APPROVED", "RETURNED", "SUPERSEDED"];
const EDIT_ROLES = [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.ENGINEERING];
const PRODUCTION_REVIEW_ROLES = [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PRODUCTION];
const DIRECTOR_REVIEW_ROLES = [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.DIRECTOR];
const REQUISITION_ROLES = [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PRODUCTION];

const projectOf = (bom) => bom?.projectDrawing || bom?.project || bom?.projectContext || {};
const linesOf = (bom) => [bom?.lines, bom?.bomLines, bom?.items].find(Array.isArray) || [];

/*
 * Business identifiers such as plant codes must preserve punctuation.
 * Example: AL-P1 must never become AL_P1.
 *
 * normalize() remains correct for enum/status values such as:
 * QC, PROCESSING, PRODUCTION, EXTERNAL_PROCESSOR, SUBMITTED, etc.
 */
const upperCode = (value) => clean(value).toUpperCase();

const sameCode = (left, right) =>
    upperCode(left) === upperCode(right);

const routeLocationMatchesStep = (location, stepType) => {
    if (!location || location.active === false) return false;

    const locationType = normalize(location.locationType);
    const requestedStep = normalize(stepType);

    if (requestedStep === "QC") {
        return locationType === "QC";
    }

    if (requestedStep === "PROCESSING") {
        return ["PROCESSING", "EXTERNAL_PROCESSOR"].includes(locationType);
    }

    if (requestedStep === "PRODUCTION") {
        return locationType === "PRODUCTION";
    }

    return false;
};

const hasHistoryAction = (bom, action) =>
    (Array.isArray(bom?.history) ? bom.history : []).some(
        (entry) => normalize(entry?.action) === normalize(action)
    );

const productionApproved = (bom) =>
    Boolean(bom?.productionReviewedAt || bom?.productionReviewedBy) ||
    hasHistoryAction(bom, "PRODUCTION_APPROVED");

const workflowFor = (bom) => {
    const status = normalize(bom?.status);
    if (status === "DRAFT") return ["Engineering", "Complete material lines and approved QC / optional Processing / Production route options, then submit"];
    if (status === "RETURNED") return ["Engineering", "Correct the returned BOM and resubmit for Production + Director approval"];
    if (status === "SUBMITTED" && !productionApproved(bom)) return ["Production", "Review and approve or return the Engineering-submitted BOM"];
    if (status === "SUBMITTED" && productionApproved(bom)) return ["Director", "Production approved. Director final approval or return is required"];
    if (status === "APPROVED") return ["Production / Store", bom?.effective ? "Final approval complete — requisition can be raised against this effective BOM" : "Resolve effective revision"];
    if (status === "SUPERSEDED") return ["Engineering", "Use the current approved revision"];
    return ["MatFlow", "Review BOM status"];
};

export function MatFlowBomListPage({ submittedOnly = false }) {
    const navigate = useNavigate();
    const { hasRole } = useMatFlow();
    const canCreate = hasRole(EDIT_ROLES);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState(submittedOnly ? "SUBMITTED" : "");
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteWorking, setDeleteWorking] = useState(false);
    const bomPagination = useMatFlowPagination(rows, 20);

    const load = useCallback(async () => {
        setLoading(true); setError("");
        try {
            const response = await matflowApi.listBoms({
                search: clean(search) || undefined,
                status: submittedOnly ? "SUBMITTED" : status || undefined,
                latestOnly: undefined,
            });
            setRows(extractMatFlowPage(response?.data).rows);
        } catch (requestError) {
            setRows([]); setError(readMatFlowError(requestError, "Unable to load operational BOMs."));
        } finally { setLoading(false); }
    }, [search, status, submittedOnly]);

    useEffect(() => { load(); }, [load]);

    const confirmDeleteDraft = async () => {
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
                badge={submittedOnly ? "BOM REVIEW & APPROVAL" : "OPERATIONAL BOM CONTROL"}
                title={submittedOnly ? "Submitted BOM Review & Approval" : "Operational BOMs"}
                subtitle={submittedOnly
                    ? "Production performs the technical review first; Director gives final approval before the BOM becomes effective for material requisitions."
                    : "Engineering authors product-specific BOMs. Production technical approval and Director final approval are both required."}
                actions={!submittedOnly && canCreate ? <Button startIcon={<AddIcon />} onClick={() => navigate("/matflow/boms/new")} sx={primaryBtnSx}>Create BOM</Button> : null}
            />
            <Card sx={panelSx}>
                <Box sx={{ display: "grid", gridTemplateColumns: submittedOnly ? "1fr auto" : "1fr 220px auto", gap: 1, alignItems: "center" }}>
                    <TextField label="Search" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} sx={fieldSx} />
                    {!submittedOnly && <TextField select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={fieldSx}>{BOM_STATUSES.map((item) => <MenuItem key={item || "ALL"} value={item}>{item ? readable(item) : "All Statuses"}</MenuItem>)}</TextField>}
                    <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                </Box>
            </Card>
            <ErrorBox>{error}</ErrorBox>
            <Card sx={panelSx}>
                {loading ? <LoadingBlock /> : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px minmax(220px,1fr) 140px 120px 170px 200px 190px" }}>
                            {["BOM / Revision", "Project / Product", "Drawing", "Plant", "Status", "Responsible / Next", "Action"].map((h) => <Box key={h} sx={tableCellSx}>{h}</Box>)}
                        </Box>
                        {rows.length === 0 ? <EmptyState>No BOM records match the current view.</EmptyState> : bomPagination.pageItems.map((row) => {
                            const flow = workflowFor(row);
                            return (
                                <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "170px minmax(220px,1fr) 140px 120px 170px 200px 190px" }}>
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.bomNumber || "-"}</Typography><Typography sx={subTextSx}>Revision {row.revisionNo ?? "-"}{row.effective ? " · Effective" : ""}</Typography></Box>
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.projectCode || row.productName || "-"}</Typography><Typography sx={subTextSx}>{row.productName || row.clientName || "-"}</Typography></Box>
                                    <Box sx={tableCellSx}>{row.drawingNo || "-"}</Box>
                                    <Box sx={tableCellSx}>{row.plantCode || "-"}</Box>
                                    <Box sx={tableCellSx}><MatFlowStatusChip status={row.status} /></Box>
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{flow[0]}</Typography><Typography sx={subTextSx}>{flow[1]}</Typography></Box>
                                    <Box sx={{ ...tableCellSx, display: "flex", gap: .65, alignItems: "center" }}><Button onClick={() => navigate(`/matflow/boms/${row.id}`)} sx={secondaryBtnSx}>{normalize(row.status) === "SUBMITTED" ? "Review" : "Open"}</Button>{!submittedOnly && canCreate && normalize(row.status) === "DRAFT" && row.latestRevision === true && row.effective !== true && row.rowVersion != null && <Button startIcon={<DeleteOutlineIcon />} onClick={() => setDeleteTarget(row)} sx={dangerBtnSx}>Delete</Button>}</Box>
                                </Box>
                            );
                        })}
                    </Box>
                )}
                {!loading && (
                    <MatFlowPagination
                        {...bomPagination}
                        onPageChange={bomPagination.setPage}
                        onPageSizeChange={bomPagination.setPageSize}
                        label={submittedOnly ? "Submitted BOMs" : "Operational BOMs"}
                    />
                )}
            </Card>
            <MatFlowDeleteDialog
                open={Boolean(deleteTarget)}
                title="Delete Draft BOM?"
                subject={deleteTarget ? `${deleteTarget.bomNumber || "BOM"} · Revision ${deleteTarget.revisionNo ?? "-"}` : "Draft BOM"}
                description="Only the latest non-effective Draft BOM can be permanently removed. Submitted, returned and approved revisions remain in MatFlow as product engineering and approval history."
                working={deleteWorking}
                onClose={() => setDeleteTarget(null)}
                onConfirm={confirmDeleteDraft}
            />
        </Box>
    );
}

export const MatFlowBomReviewPage = () => <MatFlowBomListPage submittedOnly />;

export function MatFlowBomCreatePage() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const { selectedPlantParam } = useMatFlow();
    const requestedProductId = params.get("productId") || "";

    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState({
        projectId: "",
        projectDrawingId: requestedProductId,
        remarks: "",
    });

    useEffect(() => {
        let active = true;

        (async () => {
            setLoading(true);
            setError("");
            try {
                /*
                 * IMPORTANT:
                 * `listProjects()` is intentionally a legacy FLAT Product/Drawing
                 * compatibility adapter. BOM creation needs the authoritative
                 * nested hierarchy, so it must read Project Portfolio directly:
                 *
                 * Project -> approved active Product / Drawing -> BOM.
                 */
                const response = await matflowApi.listProjectPortfolio({
                    active: true,
                    plantCode: selectedPlantParam || undefined,
                });

                const visibleProjects = (Array.isArray(response?.data) ? response.data : [])
                    .filter((project) => project?.active !== false)
                    .map((project) => ({
                        ...project,
                        products: (Array.isArray(project?.products) ? project.products : [])
                            .filter((product) =>
                                product?.active !== false &&
                                normalize(product?.approvalStatus) === "APPROVED"
                            ),
                    }))
                    .filter((project) => project.products.length > 0);

                if (!active) return;

                setProjects(visibleProjects);

                if (requestedProductId) {
                    const owningProject = visibleProjects.find((project) =>
                        project.products.some(
                            (product) => String(product.id) === String(requestedProductId)
                        )
                    );

                    if (owningProject) {
                        setForm((current) => ({
                            ...current,
                            projectId: String(owningProject.id),
                            projectDrawingId: String(requestedProductId),
                        }));
                    } else {
                        setForm((current) => ({
                            ...current,
                            projectId: "",
                            projectDrawingId: "",
                        }));
                        setError(
                            "The requested Product is not active and Director-approved, or is not visible in your current plant access."
                        );
                    }
                }
            } catch (requestError) {
                if (active) {
                    setProjects([]);
                    setForm((current) => ({
                        ...current,
                        projectId: "",
                        projectDrawingId: "",
                    }));
                    setError(
                        readMatFlowError(
                            requestError,
                            "Unable to load Director-approved Project Products."
                        )
                    );
                }
            } finally {
                if (active) setLoading(false);
            }
        })();

        return () => {
            active = false;
        };
    }, [requestedProductId, selectedPlantParam]);

    const selectedProject = projects.find(
        (project) => String(project.id) === String(form.projectId)
    ) || null;

    const availableProducts = Array.isArray(selectedProject?.products)
        ? selectedProject.products
        : [];

    const selected = availableProducts.find(
        (product) => String(product.id) === String(form.projectDrawingId)
    ) || null;

    const totalApprovedProducts = useMemo(
        () => projects.reduce(
            (total, project) => total + (Array.isArray(project?.products) ? project.products.length : 0),
            0
        ),
        [projects]
    );

    const save = async () => {
        if (!selectedProject?.id) {
            setError("Select a Project first.");
            return;
        }
        if (!selected?.id) {
            setError("Select a valid Director-approved Product / Drawing.");
            return;
        }

        setSaving(true);
        setError("");

        try {
            const response = await matflowApi.createBom({
                projectDrawingId: selected.id,
                remarks: clean(form.remarks) || null,
            });

            if (!response?.data?.id) {
                throw new Error("Created BOM ID was not returned.");
            }

            navigate(`/matflow/boms/${response.data.id}`, { replace: true });
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to create BOM Draft."));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <LoadingBlock />;

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="NEW OPERATIONAL BOM"
                title="Create Product BOM"
                subtitle="Choose the client Project first, then its active Director-approved Product / Drawing. BOM ownership remains attached to the exact Product / Drawing UUID for complete Project → Product → Material traceability."
                actions={
                    <Button
                        startIcon={<ArrowBackIcon />}
                        onClick={() => navigate("/matflow/boms")}
                        sx={secondaryBtnSx}
                    >
                        Back
                    </Button>
                }
            />

            <ErrorBox>{error}</ErrorBox>

            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", lg: "minmax(0,1.5fr) minmax(280px,.5fr)" },
                    gap: 1.25,
                    alignItems: "start",
                }}
            >
                <Card sx={panelSx}>
                    <Box sx={{ mb: 1.4 }}>
                        <Typography sx={{ ...mainTextSx, fontSize: 16 }}>
                            Product Ownership
                        </Typography>
                        <Typography sx={{ ...subTextSx, mt: .25 }}>
                            {projects.length} Project{projects.length === 1 ? "" : "s"} · {totalApprovedProducts} approved Product{totalApprovedProducts === 1 ? "" : "s"} available in the current Plant scope.
                        </Typography>
                    </Box>

                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                            gap: 1.25,
                        }}
                    >
                        <TextField
                            select
                            label="1. Client Project *"
                            value={form.projectId}
                            onChange={(event) => {
                                const nextProjectId = event.target.value;
                                setForm((current) => ({
                                    ...current,
                                    projectId: nextProjectId,
                                    projectDrawingId: "",
                                }));
                                setError("");
                            }}
                            sx={fieldSx}
                        >
                            {projects.length === 0 && (
                                <MenuItem value="" disabled>
                                    No Project with approved Products available
                                </MenuItem>
                            )}
                            {projects.map((project) => (
                                <MenuItem key={project.id} value={project.id}>
                                    {project.projectCode || "-"} · {project.projectName || "-"} · {project.clientName || "-"}
                                </MenuItem>
                            ))}
                        </TextField>

                        <TextField
                            select
                            label="2. Product / Drawing *"
                            value={form.projectDrawingId}
                            disabled={!selectedProject?.id}
                            onChange={(event) => {
                                setForm((current) => ({
                                    ...current,
                                    projectDrawingId: event.target.value,
                                }));
                                setError("");
                            }}
                            sx={fieldSx}
                        >
                            {!selectedProject && (
                                <MenuItem value="" disabled>
                                    Select a Project first
                                </MenuItem>
                            )}
                            {selectedProject && availableProducts.length === 0 && (
                                <MenuItem value="" disabled>
                                    No active Director-approved Products in this Project
                                </MenuItem>
                            )}
                            {availableProducts.map((product) => (
                                <MenuItem key={product.id} value={product.id}>
                                    {product.productName || "-"} · {product.drawingNo || "-"} · Rev {product.drawingRevision ?? "0"}
                                </MenuItem>
                            ))}
                        </TextField>

                        <TextField
                            label="Engineering Remarks"
                            value={form.remarks}
                            onChange={(event) =>
                                setForm((current) => ({
                                    ...current,
                                    remarks: event.target.value,
                                }))
                            }
                            multiline
                            minRows={2}
                            sx={{ ...fieldSx, gridColumn: "1 / -1" }}
                        />
                    </Box>
                </Card>

                <Card sx={{ ...panelSx, display: "grid", gap: 1 }}>
                    <Typography sx={{ ...mainTextSx, fontSize: 15 }}>
                        BOM Eligibility
                    </Typography>
                    <Box sx={{ display: "grid", gap: .75 }}>
                        <Box sx={{ p: 1, border: "1px solid var(--mf-border)", borderRadius: 2, background: "var(--mf-surface)" }}>
                            <Typography sx={subTextSx}>Project</Typography>
                            <Typography sx={mainTextSx}>{selectedProject?.projectCode || "Not selected"}</Typography>
                        </Box>
                        <Box sx={{ p: 1, border: "1px solid var(--mf-border)", borderRadius: 2, background: "var(--mf-surface)" }}>
                            <Typography sx={subTextSx}>Product Approval</Typography>
                            {selected ? <MatFlowStatusChip status={selected.approvalStatus} /> : <Typography sx={mainTextSx}>Waiting for selection</Typography>}
                        </Box>
                        <Box sx={{ p: 1, border: "1px solid var(--mf-border)", borderRadius: 2, background: "var(--mf-surface)" }}>
                            <Typography sx={subTextSx}>BOM Binding</Typography>
                            <Typography sx={mainTextSx}>Exact Product / Drawing UUID</Typography>
                        </Box>
                    </Box>
                </Card>
            </Box>

            {selectedProject && (
                <Card sx={panelSx}>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 1 }}>
                        <Detail label="Project" value={`${selectedProject.projectCode || "-"} · ${selectedProject.projectName || "-"}`} />
                        <Detail label="Client" value={selectedProject.clientName} />
                        <Detail label="Plant" value={selectedProject.plantCode} />
                        <Detail label="Approved Products" value={availableProducts.length} />
                        {selected && <>
                            <Detail label="Product / Item" value={selected.productName} />
                            <Detail label="Drawing" value={`${selected.drawingNo || "-"} · Rev ${selected.drawingRevision ?? "0"}`} />
                            <Detail label="Required Date" value={selected.requiredDate || selectedProject.requiredDate || "Not set"} />
                            <Detail label="Director Approval" value={<MatFlowStatusChip status={selected.approvalStatus} />} />
                        </>}
                    </Box>
                </Card>
            )}

            {projects.length === 0 && (
                <Card sx={panelSx}>
                    <EmptyState>
                        No active Director-approved Product / Drawing is available for BOM creation in the current Plant scope. Create the Project/Product in Projects & Products and complete Director Product approval first.
                    </EmptyState>
                </Card>
            )}

            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
                <Button
                    onClick={() => navigate("/matflow/projects")}
                    sx={secondaryBtnSx}
                >
                    Projects & Products
                </Button>
                <Button
                    startIcon={<SaveOutlinedIcon />}
                    onClick={save}
                    disabled={saving || !selectedProject?.id || !selected?.id}
                    sx={primaryBtnSx}
                >
                    {saving ? "Creating..." : "Create BOM Draft"}
                </Button>
            </Box>
        </Box>
    );
}


const operationalSectionColor = (key) => {
    const colors = {
        metal: "#60a5fa",
        wood: "#8b5cf6",
        veneer: "#a78bfa",
        hardware: "#f59e0b",
        stone: "#14b8a6",
        tile: "#2dd4bf",
        glass: "#38bdf8",
        upholstery: "#ec4899",
        fabric: "#f472b6",
        paint: "#fb7185",
        packaging: "#22c55e",
        "raw-material": "#94a3b8",
        miscellaneous: "#94a3b8",
    };

    return colors[key] || "#60a5fa";
};

const operationalSectionKey = (value) =>
    clean(value || "Miscellaneous")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "miscellaneous";

const materialCategoryOf = (line) =>
    line?.materialCategorySnapshot ||
    line?.materialCategory ||
    line?.categorySnapshot ||
    line?.category ||
    line?.material?.category ||
    "Miscellaneous";

const sortedRoutesForLine = (routes, lineId) =>
    (Array.isArray(routes) ? routes : [])
        .filter((item) => String(item?.bomLineId) === String(lineId))
        .sort((left, right) => Number(left?.sequenceNo || 0) - Number(right?.sequenceNo || 0));

const routeStepAccent = (stepType) => {
    const type = normalize(stepType);
    if (type === "QC") return "#38bdf8";
    if (type === "PROCESSING") return "#a78bfa";
    if (type === "PRODUCTION") return "#22c55e";
    return "#94a3b8";
};

export function MatFlowBomDetailPage() {
    const { bomId } = useParams();
    const navigate = useNavigate();
    const { hasRole } = useMatFlow();
    const [bom, setBom] = useState(null);
    const [routes, setRoutes] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [locations, setLocations] = useState([]);
    const [locationLoadError, setLocationLoadError] = useState("");
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [action, setAction] = useState(null);
    const [remarks, setRemarks] = useState("");
    const [lineDialog, setLineDialog] = useState(null);
    const [lineForm, setLineForm] = useState({ materialId: "", requiredQty: "", wastagePercent: "0", remarks: "" });
    const [routeDialog, setRouteDialog] = useState(null);
    const [routeForm, setRouteForm] = useState({ sequenceNo: "1", stepType: "QC", locationId: "", processCode: "", expectedYieldPercent: "100", remarks: "" });
    const [openSections, setOpenSections] = useState({});

    const load = useCallback(async () => {
        if (!bomId) return;
        setLoading(true); setError("");
        try {
            const [bomResponse, routeResponse] = await Promise.all([matflowApi.getBom(bomId), matflowApi.listBomRoutes(bomId)]);
            setBom(bomResponse?.data || null);
            setRoutes(extractMatFlowPage(routeResponse?.data).rows);
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to load the operational BOM."));
        } finally { setLoading(false); }
    }, [bomId]);
    useEffect(() => { load(); }, [load]);

    const lines = useMemo(() => linesOf(bom), [bom]);
    const project = useMemo(() => projectOf(bom), [bom]);
    const status = normalize(bom?.status);
    const canEdit = hasRole(EDIT_ROLES) && bom?.latestRevision === true && ["DRAFT", "RETURNED"].includes(status);
    const canDeleteDraft = hasRole(EDIT_ROLES) && status === "DRAFT" && bom?.latestRevision === true && bom?.effective !== true && bom?.rowVersion != null;
    const productionReviewComplete = productionApproved(bom);
    const canProductionReview = hasRole(PRODUCTION_REVIEW_ROLES) && status === "SUBMITTED" && !productionReviewComplete && bom?.rowVersion != null;
    const canDirectorReview = hasRole(DIRECTOR_REVIEW_ROLES) && status === "SUBMITTED" && productionReviewComplete && bom?.rowVersion != null;
    const canRevision = hasRole(EDIT_ROLES) && status === "APPROVED" && bom?.effective === true && bom?.latestRevision === true;
    const canRequisition = hasRole(REQUISITION_ROLES) && status === "APPROVED" && bom?.effective === true;
    const workflow = workflowFor(bom);

    const projectPlantCode = upperCode(
        project?.plantCode || project?.owningPlantCode
    );

    const routeLocationOptions = useMemo(() => {
        return locations.filter((location) => {
            if (!routeLocationMatchesStep(location, routeForm.stepType)) {
                return false;
            }

            /*
             * Every approved route destination belongs to the BOM/project
             * operational plant. An EXTERNAL_PROCESSOR may be physically
             * external, but its MatFlow location record must still be tagged
             * with the BOM's operational plant so downstream authorization
             * remains deterministic.
             */
            if (
                projectPlantCode &&
                !sameCode(location.plantCode, projectPlantCode)
            ) {
                return false;
            }

            return true;
        });
    }, [locations, routeForm.stepType, projectPlantCode]);

    const routeTypeOptions = useMemo(() => {
        if (!routeDialog) return ["QC", "PROCESSING", "PRODUCTION"];

        if (routeDialog.step) {
            return [normalize(routeDialog.step.stepType) || "QC"];
        }

        const lineRoutes = Array.isArray(routeDialog.lineRoutes)
            ? routeDialog.lineRoutes
            : [];

        const hasQc = lineRoutes.some(
            (step) => normalize(step.stepType) === "QC"
        );
        const hasProduction = lineRoutes.some(
            (step) => normalize(step.stepType) === "PRODUCTION"
        );

        if (!hasQc) return ["QC"];
        if (hasProduction) return ["PROCESSING"];
        return ["PROCESSING", "PRODUCTION"];
    }, [routeDialog]);

    const resolveRouteLocation = useCallback(
        (step) => {
            if (!step) return null;

            const masterLocation = locations.find(
                (location) => String(location.id) === String(step.locationId)
            );

            if (masterLocation) return masterLocation;

            if (
                step.locationId ||
                step.locationCode ||
                step.locationName ||
                step.locationType ||
                step.plantCode
            ) {
                return {
                    id: step.locationId || null,
                    locationCode: step.locationCode || null,
                    locationName: step.locationName || null,
                    plantCode: step.plantCode || null,
                    locationType: step.locationType || null,
                    ownershipType: step.ownershipType || null,
                    active: true,
                };
            }

            return null;
        },
        [locations]
    );

    const routeIssues = useMemo(() => {
        const issues = [];

        lines.forEach((line) => {
            const lineRoutes = routes
                .filter((item) => String(item.bomLineId) === String(line.id))
                .sort((a, b) => Number(a.sequenceNo || 0) - Number(b.sequenceNo || 0));

            const lineLabel =
                line.materialCodeSnapshot ||
                line.materialCode ||
                line.materialNameSnapshot ||
                line.materialName ||
                `Line ${line.lineNo ?? "-"}`;

            if (lineRoutes.length === 0) {
                issues.push(`${lineLabel}: route is missing.`);
                return;
            }

            const first = lineRoutes[0];
            const last = lineRoutes[lineRoutes.length - 1];

            if (normalize(first.stepType) !== "QC") issues.push(`${lineLabel}: first route step must be QC.`);
            if (normalize(last.stepType) !== "PRODUCTION") issues.push(`${lineLabel}: final route step must be Production.`);

            const qcCount = lineRoutes.filter((step) => normalize(step.stepType) === "QC").length;
            const productionCount = lineRoutes.filter((step) => normalize(step.stepType) === "PRODUCTION").length;

            if (qcCount !== 1) issues.push(`${lineLabel}: route must contain exactly one QC step.`);
            if (productionCount !== 1) issues.push(`${lineLabel}: route must contain exactly one Production step.`);

            lineRoutes.forEach((step, index) => {
                const sequence = Number(step?.sequenceNo || index + 1);
                const stepType = normalize(step?.stepType);
                const location = resolveRouteLocation(step);
                const locationType = normalize(location?.locationType);
                const locationLabel =
                    location?.locationCode ||
                    location?.locationName ||
                    (step?.locationId ? `location ${step.locationId}` : "location");

                if (!step?.locationId) {
                    issues.push(`${lineLabel}: route step ${sequence} (${stepType || "UNKNOWN"}) has no saved location.`);
                    return;
                }

                if (!location) {
                    issues.push(`${lineLabel}: route step ${sequence} references a Location Master record that cannot be resolved.`);
                    return;
                }

                if (!locationType) {
                    issues.push(`${lineLabel}: ${locationLabel} has no Location Type. Edit the Location Master record.`);
                    return;
                }

                if (stepType === "QC" && locationType !== "QC") {
                    issues.push(`${lineLabel}: QC step uses ${locationLabel}, but that location is ${readable(locationType)}, not QC.`);
                }

                if (stepType === "PROCESSING" && !["PROCESSING", "EXTERNAL_PROCESSOR"].includes(locationType)) {
                    issues.push(`${lineLabel}: Processing step uses ${locationLabel}, but that location is ${readable(locationType)}.`);
                }

                if (stepType === "PRODUCTION" && locationType !== "PRODUCTION") {
                    issues.push(`${lineLabel}: Production step uses ${locationLabel}, but that location is ${readable(locationType)}, not Production.`);
                }

                if (projectPlantCode && !sameCode(location.plantCode, projectPlantCode)) {
                    issues.push(`${lineLabel}: ${locationLabel} belongs to ${location.plantCode || "no plant"}, but this BOM belongs to ${projectPlantCode}.`);
                }

                if (location.active === false) issues.push(`${lineLabel}: ${locationLabel} is inactive.`);

                if (index > 0 && index < lineRoutes.length - 1 && stepType !== "PROCESSING") {
                    issues.push(`${lineLabel}: only Processing steps are allowed between QC and Production.`);
                }
            });
        });

        return Array.from(new Set(issues));
    }, [lines, routes, projectPlantCode, resolveRouteLocation]);

    const routeSummaryByLine = useMemo(() => {
        const summaries = new Map();

        lines.forEach((line) => {
            const lineRoutes = routes
                .filter((item) => String(item.bomLineId) === String(line.id))
                .sort((a, b) => Number(a.sequenceNo || 0) - Number(b.sequenceNo || 0));

            const hasQc = lineRoutes.some((step) => normalize(step?.stepType) === "QC");
            const hasProduction = lineRoutes.some((step) => normalize(step?.stepType) === "PRODUCTION");
            const processingCount = lineRoutes.filter(
                (step) => normalize(step?.stepType) === "PROCESSING"
            ).length;

            const complete =
                lineRoutes.length >= 2 &&
                normalize(lineRoutes[0]?.stepType) === "QC" &&
                normalize(lineRoutes[lineRoutes.length - 1]?.stepType) === "PRODUCTION" &&
                lineRoutes.filter((step) => normalize(step?.stepType) === "QC").length === 1 &&
                lineRoutes.filter((step) => normalize(step?.stepType) === "PRODUCTION").length === 1 &&
                lineRoutes.every((step, index) => {
                    const stepType = normalize(step?.stepType);
                    const location = resolveRouteLocation(step);
                    const locationType = normalize(location?.locationType);

                    if (!step?.locationId || !location || !locationType) return false;
                    if (location.active === false) return false;
                    if (projectPlantCode && !sameCode(location.plantCode, projectPlantCode)) return false;
                    if (stepType === "QC" && locationType !== "QC") return false;
                    if (
                        stepType === "PROCESSING" &&
                        !["PROCESSING", "EXTERNAL_PROCESSOR"].includes(locationType)
                    ) {
                        return false;
                    }
                    if (stepType === "PRODUCTION" && locationType !== "PRODUCTION") return false;
                    if (index > 0 && index < lineRoutes.length - 1 && stepType !== "PROCESSING") {
                        return false;
                    }
                    return true;
                });

            summaries.set(String(line.id), {
                complete,
                count: lineRoutes.length,
                hasQc,
                hasProduction,
                processingCount,
            });
        });

        return summaries;
    }, [lines, routes, projectPlantCode, resolveRouteLocation]);

    const validRouteLineCount = useMemo(
        () => Array.from(routeSummaryByLine.values()).filter((summary) => summary.complete).length,
        [routeSummaryByLine]
    );

    const routeCompletionPercent = lines.length > 0
        ? Math.round((validRouteLineCount / lines.length) * 100)
        : 0;

    const materialSections = useMemo(() => {
        const grouped = new Map();

        lines.forEach((line) => {
            const title = materialCategoryOf(line);
            const key = operationalSectionKey(title);

            if (!grouped.has(key)) {
                grouped.set(key, {
                    key,
                    title: readable(title) || title,
                    accent: operationalSectionColor(key),
                    rows: [],
                    routed: 0,
                    processingOptions: 0,
                });
            }

            const section = grouped.get(key);
            const summary = routeSummaryByLine.get(String(line.id));

            section.rows.push(line);
            if (summary?.complete) section.routed += 1;
            section.processingOptions += Number(summary?.processingCount || 0);
        });

        return Array.from(grouped.values()).sort((left, right) =>
            String(left.title).localeCompare(String(right.title))
        );
    }, [lines, routeSummaryByLine]);

    const processingOptionCount = useMemo(
        () => routes.filter((step) => normalize(step?.stepType) === "PROCESSING").length,
        [routes]
    );

    const builderCompletionPercent = lines.length > 0
        ? Math.round(((lines.length + validRouteLineCount) / (lines.length * 2)) * 100)
        : 0;

    useEffect(() => {
        setOpenSections((current) => {
            let changed = false;
            const validKeys = new Set(materialSections.map((section) => section.key));
            const next = { ...current };

            materialSections.forEach((section) => {
                if (!(section.key in next)) {
                    next[section.key] = true;
                    changed = true;
                }
            });

            Object.keys(next).forEach((key) => {
                if (!validKeys.has(key)) {
                    delete next[key];
                    changed = true;
                }
            });

            return changed ? next : current;
        });
    }, [materialSections]);

    const toggleSection = (key) => {
        setOpenSections((current) => ({
            ...current,
            [key]: !current[key],
        }));
    };

    const currentOwner = workflow[0];
    const allRoutesReady = lines.length > 0 && validRouteLineCount === lines.length;
    const directorApprovalComplete = status === "APPROVED" && bom?.effective === true;

    const assistantChecks = [
        {
            done: Boolean(project?.id || project?.projectDrawingId || bom?.projectDrawingId),
            label: "Project / Product ownership",
            subtitle: project?.productName
                ? `${project.projectCode || "Project"} · ${project.productName}`
                : "BOM must remain bound to an approved Product / Drawing.",
        },
        {
            done: lines.length > 0,
            label: "Material demand lines",
            subtitle: lines.length > 0
                ? `${lines.length} operational material line${lines.length === 1 ? "" : "s"} defined.`
                : "Add at least one Material Master line.",
        },
        {
            done: allRoutesReady,
            label: "Approved operational routes",
            subtitle: allRoutesReady
                ? "Every material has QC → optional Processing → Production control."
                : `${validRouteLineCount}/${lines.length} material route(s) complete.`,
        },
        {
            done: productionReviewComplete,
            label: "Production technical review",
            subtitle: productionReviewComplete
                ? "Production technical approval recorded."
                : "Production review is required after Engineering submission.",
        },
        {
            done: directorApprovalComplete,
            label: "Director final approval",
            subtitle: directorApprovalComplete
                ? "Effective BOM is ready for Production requisition."
                : "Director approval makes the BOM effective for requisition.",
        },
    ];

    const workflowSteps = [
        {
            title: "Engineering",
            subtitle: "Material structure + governed route",
            done: !["DRAFT", "RETURNED"].includes(status),
            current: ["DRAFT", "RETURNED"].includes(status),
        },
        {
            title: "Production Review",
            subtitle: "Technical verification",
            done: productionReviewComplete,
            current: status === "SUBMITTED" && !productionReviewComplete,
        },
        {
            title: "Director",
            subtitle: "Final operational approval",
            done: status === "APPROVED",
            current: status === "SUBMITTED" && productionReviewComplete,
        },
        {
            title: "Requisition Ready",
            subtitle: "Effective approved BOM",
            done: directorApprovalComplete,
            current: status === "APPROVED" && !bom?.effective,
        },
    ];

    useEffect(() => {
        if (!canEdit) {
            setMaterials([]);
            setLocations([]);
            setLocationLoadError("");
            return;
        }

        let active = true;

        (async () => {
            setLocationLoadError("");

            const [materialResult, locationResult] = await Promise.allSettled([
                matflowApi.listMaterials({ active: true }),
                matflowApi.listLocations({ active: true }),
            ]);

            if (!active) return;

            if (materialResult.status === "fulfilled") {
                setMaterials(
                    extractMatFlowPage(materialResult.value?.data).rows
                        .filter((item) => item.active !== false)
                );
            } else {
                setMaterials([]);
                setError(
                    readMatFlowError(
                        materialResult.reason,
                        "Unable to load active MatFlow materials."
                    )
                );
            }

            if (locationResult.status === "fulfilled") {
                setLocations(
                    extractMatFlowPage(locationResult.value?.data).rows
                        .filter((item) => item.active !== false)
                );
            } else {
                setLocations([]);
                setLocationLoadError(
                    readMatFlowError(
                        locationResult.reason,
                        "Unable to load active MatFlow route locations."
                    )
                );
            }
        })();

        return () => {
            active = false;
        };
    }, [canEdit]);

    const executeAction = async () => {
        if (!action || !bom?.id || bom.rowVersion == null) return;

        const cleaned = clean(remarks);

        if (["PRODUCTION_RETURN", "DIRECTOR_RETURN"].includes(action) && !cleaned) {
            setError("Return remarks are required.");
            return;
        }

        if (action === "SUBMIT" && routeIssues.length > 0) {
            setAction(null);
            setRemarks("");
            setError(
                `BOM cannot be submitted yet. ${routeIssues.slice(0, 4).join(" ")}${routeIssues.length > 4
                    ? ` +${routeIssues.length - 4} more route issue(s).`
                    : ""
                }`
            );
            return;
        }

        setWorking(true);
        setError("");
        const body = { rowVersion: bom.rowVersion, remarks: cleaned || null };
        try {
            let response;
            if (action === "SUBMIT") response = await matflowApi.submitBom(bom.id, body);
            if (action === "PRODUCTION_APPROVE") response = await matflowApi.productionApproveBom(bom.id, body);
            if (action === "PRODUCTION_RETURN") response = await matflowApi.productionReturnBom(bom.id, body);
            if (action === "DIRECTOR_APPROVE") response = await matflowApi.directorApproveBom(bom.id, body);
            if (action === "DIRECTOR_RETURN") response = await matflowApi.directorReturnBom(bom.id, body);
            if (action === "REVISION") response = await matflowApi.createBomRevision(bom.id, body);
            setAction(null); setRemarks("");
            if (action === "REVISION" && response?.data?.id) navigate(`/matflow/boms/${response.data.id}`, { replace: true });
            else if (response?.data?.id) { setBom(response.data); await load(); }
            else await load();
        } catch (requestError) { setError(readMatFlowError(requestError, "Unable to complete the BOM action.")); }
        finally { setWorking(false); }
    };

    const saveLine = async () => {
        if (!bom?.id) return;
        const qty = Number(lineForm.requiredQty);
        const wastage = Number(lineForm.wastagePercent || 0);
        if (!lineForm.materialId || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(wastage) || wastage < 0) { setError("Material and a valid positive quantity are required."); return; }
        setWorking(true); setError("");
        try {
            const body = { materialId: lineForm.materialId, requiredQty: qty, wastagePercent: wastage, remarks: clean(lineForm.remarks) || null, rowVersion: lineDialog?.line?.rowVersion ?? null };
            if (lineDialog?.line?.id) await matflowApi.updateBomLine(bom.id, lineDialog.line.id, body);
            else await matflowApi.addBomLine(bom.id, body);
            setLineDialog(null); await load();
        } catch (requestError) { setError(readMatFlowError(requestError, "Unable to save BOM material line.")); }
        finally { setWorking(false); }
    };

    const removeLine = async (line) => {
        if (!window.confirm(`Remove ${line.materialCode || line.materialName || "this material"} from the BOM?`)) return;
        setWorking(true); setError("");
        try { await matflowApi.deleteBomLine(bom.id, line.id, line.rowVersion); await load(); }
        catch (requestError) { setError(readMatFlowError(requestError, "Unable to remove BOM line.")); }
        finally { setWorking(false); }
    };

    const openRoute = (line, step = null) => {
        const lineRoutes = routes
            .filter((item) => String(item.bomLineId) === String(line.id))
            .sort((a, b) => Number(a.sequenceNo || 0) - Number(b.sequenceNo || 0));

        if (step) {
            setRouteDialog({ line, step, lineRoutes });
            setRouteForm({
                sequenceNo: String(step.sequenceNo ?? 10),
                stepType: normalize(step.stepType) || "QC",
                locationId: step.locationId || "",
                processCode: step.processCode || "",
                expectedYieldPercent: String(step.expectedYieldPercent ?? 100),
                remarks: step.remarks || "",
            });
            setError("");
            return;
        }

        const hasQc = lineRoutes.some(
            (item) => normalize(item.stepType) === "QC"
        );
        const productionStep = lineRoutes.find(
            (item) => normalize(item.stepType) === "PRODUCTION"
        );
        const processingSteps = lineRoutes.filter(
            (item) => normalize(item.stepType) === "PROCESSING"
        );

        /*
         * Route rows are permissions, not a mandatory processing chain:
         * QC is the gate, PROCESSING rows are candidate units, and Production
         * is the final destination. Keep large sequence space before Production
         * so Engineering can add more Processing candidates later.
         */
        const nextProcessingSequence = Math.max(
            20,
            ...processingSteps.map((item) => Number(item.sequenceNo || 0) + 10)
        );

        const nextType = !hasQc
            ? "QC"
            : productionStep
                ? "PROCESSING"
                : "PRODUCTION";

        const nextSequence = nextType === "QC"
            ? 10
            : nextType === "PRODUCTION"
                ? 1000
                : nextProcessingSequence;

        setRouteDialog({ line, step: null, lineRoutes });
        setRouteForm({
            sequenceNo: String(nextSequence),
            stepType: nextType,
            locationId: "",
            processCode: "",
            expectedYieldPercent: "100",
            remarks: "",
        });
        setError("");
    };

    useEffect(() => {
        if (!routeDialog) return;

        const selectedStillValid = routeLocationOptions.some(
            (location) => String(location.id) === String(routeForm.locationId)
        );

        if (routeForm.locationId && !selectedStillValid) {
            setRouteForm((current) => ({
                ...current,
                locationId: "",
            }));
            return;
        }

        if (!routeForm.locationId && routeLocationOptions.length === 1) {
            setRouteForm((current) => ({
                ...current,
                locationId: routeLocationOptions[0].id,
            }));
        }
    }, [
        routeDialog,
        routeForm.stepType,
        routeForm.locationId,
        routeLocationOptions,
    ]);

    const saveRoute = async () => {
        if (!routeDialog?.line?.id) {
            setError("BOM material line is required.");
            return;
        }

        if (!routeForm.locationId) {
            setError(
                routeLocationOptions.length === 0
                    ? `No compatible ${readable(routeForm.stepType)} location is configured${["QC", "PRODUCTION"].includes(normalize(routeForm.stepType)) && projectPlantCode
                        ? ` for plant ${projectPlantCode}`
                        : ""
                    }. Create/activate the location in MatFlow Location Master first.`
                    : "Route location is required."
            );
            return;
        }

        const selectedRouteLocation = routeLocationOptions.find(
            (location) => String(location.id) === String(routeForm.locationId)
        );

        if (!selectedRouteLocation) {
            setError(
                "The selected route location is no longer compatible with this route step. Refresh and select a valid location."
            );
            return;
        }

        const sequenceNo = Number(routeForm.sequenceNo);
        if (!Number.isInteger(sequenceNo) || sequenceNo <= 0) {
            setError("Route sequence must be a positive whole number.");
            return;
        }

        const stepType = normalize(routeForm.stepType);
        const existing = (routeDialog.lineRoutes || [])
            .filter((item) => item.id !== routeDialog?.step?.id)
            .sort((a, b) => Number(a.sequenceNo || 0) - Number(b.sequenceNo || 0));

        const existingQc = existing.find((item) => normalize(item.stepType) === "QC");
        const existingProduction = existing.find((item) => normalize(item.stepType) === "PRODUCTION");

        if (stepType === "QC" && existingQc) {
            setError("Each material can have only one QC gate.");
            return;
        }

        if (stepType === "PRODUCTION" && existingProduction) {
            setError("Each material can have only one final Production destination.");
            return;
        }

        if (stepType !== "QC" && !existingQc && normalize(routeDialog?.step?.stepType) !== "QC") {
            setError("Create the QC gate before Processing options or Production.");
            return;
        }

        if (stepType === "QC" && existing.some((item) => Number(item.sequenceNo || 0) <= sequenceNo)) {
            setError("QC must have the lowest sequence and remain the first route step.");
            return;
        }

        if (stepType === "PRODUCTION" && existing.some((item) => Number(item.sequenceNo || 0) >= sequenceNo)) {
            setError("Production must have the highest sequence and remain the final route step.");
            return;
        }

        if (stepType === "PROCESSING") {
            if (!clean(routeForm.processCode)) {
                setError("Process code is required for a Processing option.");
                return;
            }

            const qcSequence = Number(existingQc?.sequenceNo || 0);
            if (qcSequence && sequenceNo <= qcSequence) {
                setError("Processing options must be sequenced after the QC gate.");
                return;
            }
        }

        const body = {
            sequenceNo,
            stepType,
            locationId: routeForm.locationId,
            processCode: stepType === "PROCESSING" ? upperCode(routeForm.processCode) : null,
            expectedYieldPercent: Number(routeForm.expectedYieldPercent || 100),
            remarks: clean(routeForm.remarks) || null,
            rowVersion: routeDialog?.step?.rowVersion ?? null,
        };

        setWorking(true);
        setError("");

        try {
            /*
             * Existing legacy routes often used 1/2 for QC/Production. When
             * Engineering adds a new Processing candidate later, automatically
             * move the untouched Production marker to the end instead of forcing
             * the user to delete it first.
             */
            if (!routeDialog.step?.id && stepType === "PROCESSING" && existingProduction) {
                const productionSequence = Number(existingProduction.sequenceNo || 0);
                if (productionSequence <= sequenceNo) {
                    const finalSequence = Math.max(
                        1000,
                        sequenceNo + 100,
                        ...existing.map((item) => Number(item.sequenceNo || 0) + 100)
                    );

                    await matflowApi.updateBomRouteStep(
                        bom.id,
                        routeDialog.line.id,
                        existingProduction.id,
                        {
                            sequenceNo: finalSequence,
                            stepType: "PRODUCTION",
                            locationId: existingProduction.locationId,
                            processCode: null,
                            expectedYieldPercent: Number(existingProduction.expectedYieldPercent ?? 100),
                            remarks: clean(existingProduction.remarks) || null,
                            rowVersion: existingProduction.rowVersion,
                        }
                    );
                }
            }

            if (routeDialog.step?.id) {
                await matflowApi.updateBomRouteStep(
                    bom.id,
                    routeDialog.line.id,
                    routeDialog.step.id,
                    body
                );
            } else {
                await matflowApi.addBomRouteStep(
                    bom.id,
                    routeDialog.line.id,
                    body
                );
            }

            setRouteDialog(null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to save route step."));
        } finally {
            setWorking(false);
        }
    };

    const deleteRoute = async (line, step) => {
        if (!window.confirm("Delete this route step?")) return;
        try { await matflowApi.deleteBomRouteStep(bom.id, line.id, step.id, step.rowVersion); await load(); }
        catch (requestError) { setError(readMatFlowError(requestError, "Unable to delete route step.")); }
    };

    const confirmDeleteDraft = async () => {
        if (!deleteTarget?.id || deleteTarget.rowVersion == null) return;
        setWorking(true);
        setError("");
        try {
            await matflowApi.deleteDraftBom(deleteTarget.id, deleteTarget.rowVersion);
            setDeleteTarget(null);
            navigate("/matflow/boms", { replace: true });
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to delete the Draft BOM."));
        } finally {
            setWorking(false);
        }
    };


    if (loading) return <LoadingBlock />;

    if (!bom) {
        return (
            <Box sx={pageSx}>
                <ErrorBox>{error || "Operational BOM was not found."}</ErrorBox>
                <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={() => navigate("/matflow/boms")}
                    sx={secondaryBtnSx}
                >
                    Back to Operational BOMs
                </Button>
            </Box>
        );
    }

    const openLineEditor = (line = null) => {
        setLineDialog({ line });
        setLineForm({
            materialId: line?.materialId || line?.material?.id || "",
            requiredQty: line ? String(line.requiredQty ?? "") : "",
            wastagePercent: line ? String(line.wastagePercent ?? 0) : "0",
            remarks: line?.remarks || "",
        });
        setError("");
    };

    const quickActions = [
        {
            title: "Projects & Products",
            subtitle: "Open the owning Project / Product portfolio.",
            icon: <Inventory2OutlinedIcon />,
            path: "/matflow/projects",
        },
        {
            title: "Project Material Tracker",
            subtitle: "Trace live material execution after requisition.",
            icon: <AccountTreeOutlinedIcon />,
            path: "/matflow/tracker",
        },
        {
            title: "Operational BOMs",
            subtitle: "Return to revision and approval control.",
            icon: <RuleOutlinedIcon />,
            path: "/matflow/boms",
        },
        {
            title: "Requisitions",
            subtitle: "Open Production material-demand execution.",
            icon: <SpeedOutlinedIcon />,
            path: "/matflow/requisitions",
        },
    ];

    return (
        <Box sx={pageSx}>
            <Box sx={mfBuilderHeroSx}>
                <Box sx={mfBuilderHeroLeftSx}>
                    <Box sx={mfBuilderChipRowSx}>
                        <Chip label="MATFLOW BOM BUILDER" sx={mfBuilderLabelChipSx} />
                        <Chip
                            label={project?.projectCode || "NO PROJECT"}
                            sx={mfBuilderProjectChipSx}
                        />
                        <Chip
                            label={`● ${readable(status || "UNKNOWN")}`}
                            sx={mfBuilderStatusChipSx(status)}
                        />
                        {bom?.effective && (
                            <Chip label="EFFECTIVE" sx={mfBuilderEffectiveChipSx} />
                        )}
                    </Box>

                    <Typography sx={mfBuilderPageTitleSx}>
                        {project?.productName || bom?.bomNumber || "Operational BOM"}
                    </Typography>

                    <Typography sx={mfBuilderPageSubSx}>
                        Build the Product's section-wise material structure in a BOMFlow-style workspace,
                        while MatFlow continues to govern Project / Product ownership, QC-first routing,
                        optional Processing candidates, Production destination, Production technical review,
                        Director final approval and requisition release.
                    </Typography>

                    <Box sx={mfBuilderHeroMetaSx}>
                        <MatFlowBuilderMetaPill
                            label="BOM / Revision"
                            value={`${bom?.bomNumber || "-"} · R${bom?.revisionNo ?? "-"}`}
                            accent="#60a5fa"
                        />
                        <MatFlowBuilderMetaPill
                            label="Drawing"
                            value={project?.drawingNo || "-"}
                            accent="#a78bfa"
                        />
                        <MatFlowBuilderMetaPill
                            label="Plant"
                            value={project?.plantCode || project?.owningPlantCode || "-"}
                            accent="#22c55e"
                        />
                        <MatFlowBuilderMetaPill
                            label="Current Owner"
                            value={currentOwner}
                            accent="#f59e0b"
                        />
                    </Box>
                </Box>

                <Box sx={mfBuilderHeroRightSx}>
                    <Card sx={mfBuilderReadinessCardSx}>
                        <Box sx={mfBuilderReadinessTopSx}>
                            <Box>
                                <Typography sx={mfBuilderReadinessLabelSx}>
                                    Operational BOM Readiness
                                </Typography>
                                <Typography sx={mfBuilderReadinessValueSx}>
                                    {builderCompletionPercent}%
                                </Typography>
                            </Box>

                            <Box sx={mfBuilderReadinessIconSx}>
                                {allRoutesReady ? <CheckCircleOutlineIcon /> : <AltRouteOutlinedIcon />}
                            </Box>
                        </Box>

                        <LinearProgress
                            variant="determinate"
                            value={builderCompletionPercent}
                            sx={mfBuilderCompletionProgressSx}
                        />

                        <Typography sx={mfBuilderReadinessHintSx}>
                            {lines.length === 0
                                ? "Add material demand to begin."
                                : allRoutesReady
                                    ? "Material structure and route control are complete."
                                    : `${validRouteLineCount}/${lines.length} routes ready · ${routeIssues.length} control issue(s).`}
                        </Typography>
                    </Card>

                    <Box sx={mfBuilderHeroActionsSx}>
                        <Button
                            startIcon={<RefreshIcon />}
                            onClick={load}
                            disabled={working}
                            sx={secondaryBtnSx}
                        >
                            Refresh
                        </Button>
                        <Button
                            startIcon={<ArrowBackIcon />}
                            onClick={() => navigate("/matflow/boms")}
                            sx={secondaryBtnSx}
                        >
                            Back
                        </Button>
                        {canDeleteDraft && (
                            <Button
                                startIcon={<DeleteOutlineIcon />}
                                onClick={() => setDeleteTarget(bom)}
                                disabled={working}
                                sx={{ ...dangerBtnSx, gridColumn: "1 / -1" }}
                            >
                                Delete Draft
                            </Button>
                        )}
                    </Box>
                </Box>
            </Box>

            <ErrorBox>{error}</ErrorBox>

            {locationLoadError && (
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                    {locationLoadError} Route locations cannot be selected until the Location Master request succeeds.
                </Alert>
            )}

            <Box sx={mfBuilderSummaryGridSx}>
                <MatFlowBuilderStat
                    icon={<Inventory2OutlinedIcon />}
                    title="Material Lines"
                    value={lines.length}
                    subtitle={`${materialSections.length} material section${materialSections.length === 1 ? "" : "s"}`}
                    accent="#60a5fa"
                />
                <MatFlowBuilderStat
                    icon={<AltRouteOutlinedIcon />}
                    title="Route Coverage"
                    value={`${validRouteLineCount}/${lines.length}`}
                    subtitle={`${routeCompletionPercent}% QC → Production ready`}
                    accent={allRoutesReady ? "#22c55e" : "#f59e0b"}
                />
                <MatFlowBuilderStat
                    icon={<AccountTreeOutlinedIcon />}
                    title="Processing Options"
                    value={processingOptionCount}
                    subtitle="Approved candidate processing units"
                    accent="#a78bfa"
                />
                <MatFlowBuilderStat
                    icon={<ApprovalOutlinedIcon />}
                    title="Workflow Owner"
                    value={currentOwner}
                    subtitle={workflow[1]}
                    accent="#f59e0b"
                />
            </Box>

            <Box sx={mfBuilderMainGridSx}>
                <Box sx={mfBuilderLeftColumnSx}>
                    <Card sx={mfBuilderToolbarSx}>
                        <Box>
                            <Typography sx={mfBuilderToolbarTitleSx}>
                                BOM Sections
                            </Typography>
                            <Typography sx={mfBuilderToolbarSubSx}>
                                Materials are automatically grouped by Material Master category.
                                Each row keeps its independent operational route.
                            </Typography>
                        </Box>

                        <Box sx={mfBuilderToolbarActionsSx}>
                            <Chip
                                size="small"
                                label={`${lines.length} Material${lines.length === 1 ? "" : "s"}`}
                                sx={mfBuilderCountChipSx}
                            />
                            {canEdit && (
                                <Button
                                    startIcon={<AddIcon />}
                                    onClick={() => openLineEditor()}
                                    disabled={working}
                                    sx={primaryBtnSx}
                                >
                                    Add Material
                                </Button>
                            )}
                        </Box>
                    </Card>

                    {materialSections.length === 0 ? (
                        <Card sx={mfBuilderEmptySectionCardSx}>
                            <Box sx={mfBuilderEmptyIconSx("#60a5fa")}>
                                <RuleOutlinedIcon />
                            </Box>
                            <Box sx={{ flex: 1 }}>
                                <Typography sx={mfBuilderEmptyTitleSx}>
                                    No material demand has been added
                                </Typography>
                                <Typography sx={mfBuilderEmptySubSx}>
                                    Add the first Material Master item to start the Product's operational BOM.
                                    Material category will create the section automatically.
                                </Typography>
                            </Box>
                            {canEdit && (
                                <Button
                                    startIcon={<AddIcon />}
                                    onClick={() => openLineEditor()}
                                    sx={primaryBtnSx}
                                >
                                    Add Material
                                </Button>
                            )}
                        </Card>
                    ) : (
                        materialSections.map((section) => {
                            const isOpen = Boolean(openSections[section.key]);

                            return (
                                <Card
                                    key={section.key}
                                    sx={mfBuilderSectionCardSx(section.accent, isOpen)}
                                >
                                    <Box sx={mfBuilderSectionHeaderSx}>
                                        <Box sx={mfBuilderSectionLeftSx}>
                                            <IconButton
                                                size="small"
                                                onClick={() => toggleSection(section.key)}
                                                sx={mfBuilderSectionIconBtnSx}
                                            >
                                                {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                            </IconButton>

                                            <Box>
                                                <Box sx={mfBuilderSectionTitleRowSx}>
                                                    <Typography sx={mfBuilderSectionTitleSx}>
                                                        {section.title}
                                                    </Typography>
                                                    <Chip
                                                        label={`${section.rows.length} ${section.rows.length === 1 ? "Item" : "Items"}`}
                                                        size="small"
                                                        sx={mfBuilderCountChipSx}
                                                    />
                                                </Box>

                                                <Typography sx={mfBuilderSectionSubSx}>
                                                    Route ready: {section.routed}/{section.rows.length}
                                                    {section.processingOptions > 0
                                                        ? ` · ${section.processingOptions} Processing option(s)`
                                                        : " · Direct Production remains available after QC"}
                                                </Typography>
                                            </Box>
                                        </Box>

                                        <Box sx={mfBuilderSectionRightSx}>
                                            <Box>
                                                <Typography sx={mfBuilderSectionMetricLabelSx}>
                                                    Route Coverage
                                                </Typography>
                                                <Typography sx={mfBuilderSectionMetricValueSx}>
                                                    {section.rows.length > 0
                                                        ? Math.round((section.routed / section.rows.length) * 100)
                                                        : 0}%
                                                </Typography>
                                            </Box>
                                            <Chip
                                                size="small"
                                                icon={section.routed === section.rows.length
                                                    ? <CheckCircleOutlineIcon />
                                                    : <AltRouteOutlinedIcon />}
                                                label={section.routed === section.rows.length ? "Ready" : "Route Required"}
                                                sx={section.routed === section.rows.length
                                                    ? mfBuilderReadyChipSx
                                                    : mfBuilderWarningChipSx}
                                            />
                                        </Box>
                                    </Box>

                                    <Collapse in={isOpen}>
                                        <MatFlowOperationalSectionTable
                                            section={section}
                                            routes={routes}
                                            routeSummaryByLine={routeSummaryByLine}
                                            resolveRouteLocation={resolveRouteLocation}
                                            canEdit={canEdit}
                                            working={working}
                                            onEdit={openLineEditor}
                                            onDelete={removeLine}
                                            onRoute={openRoute}
                                        />
                                    </Collapse>
                                </Card>
                            );
                        })
                    )}
                    <Card sx={mfBuilderRouteRegisterCardSx}>
                        <Box sx={mfBuilderRouteRegisterHeaderSx}>
                            <Box>
                                <Typography sx={mfBuilderToolbarTitleSx}>
                                    Approved Material Route Register
                                </Typography>
                                <Typography sx={mfBuilderToolbarSubSx}>
                                    Full governed route detail remains visible for audit and maintenance.
                                    QC is mandatory first, Processing entries are approved candidate units,
                                    and Production is mandatory last.
                                </Typography>
                            </Box>

                            <Chip
                                size="small"
                                icon={allRoutesReady ? <CheckCircleOutlineIcon /> : <AltRouteOutlinedIcon />}
                                label={`${validRouteLineCount}/${lines.length} complete`}
                                sx={allRoutesReady ? mfBuilderReadyChipSx : mfBuilderWarningChipSx}
                            />
                        </Box>

                        <MatFlowRouteRegister
                            routes={routes}
                            lines={lines}
                            resolveRouteLocation={resolveRouteLocation}
                            projectPlantCode={projectPlantCode}
                            canEdit={canEdit}
                            onEdit={openRoute}
                            onDelete={deleteRoute}
                        />
                    </Card>

                    <Card sx={mfBuilderActionBarSx}>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography sx={mfBuilderActionEyebrowSx}>
                                {readable(status || "UNKNOWN")} · {currentOwner}
                            </Typography>
                            <Typography sx={mfBuilderActionTitleSx}>
                                {workflow[1]}
                            </Typography>
                            <Typography sx={mfBuilderActionSubSx}>
                                Project/Product ownership, route rules, Production technical approval,
                                Director final approval and requisition gating are unchanged.
                            </Typography>
                        </Box>

                        <Box sx={mfBuilderActionButtonsSx}>
                            {canEdit && lines.length > 0 && (
                                <Button
                                    startIcon={<SendOutlinedIcon />}
                                    endIcon={<ArrowForwardIcon />}
                                    onClick={() => setAction("SUBMIT")}
                                    disabled={working || routeIssues.length > 0}
                                    sx={primaryBtnSx}
                                >
                                    Submit for Production Review
                                </Button>
                            )}
                            {canProductionReview && (
                                <Button
                                    startIcon={<ApprovalOutlinedIcon />}
                                    onClick={() => setAction("PRODUCTION_APPROVE")}
                                    disabled={working}
                                    sx={primaryBtnSx}
                                >
                                    Production Approve
                                </Button>
                            )}
                            {canProductionReview && (
                                <Button
                                    startIcon={<UndoOutlinedIcon />}
                                    onClick={() => setAction("PRODUCTION_RETURN")}
                                    disabled={working}
                                    sx={secondaryBtnSx}
                                >
                                    Production Return
                                </Button>
                            )}
                            {canDirectorReview && (
                                <Button
                                    startIcon={<ApprovalOutlinedIcon />}
                                    onClick={() => setAction("DIRECTOR_APPROVE")}
                                    disabled={working}
                                    sx={primaryBtnSx}
                                >
                                    Director Final Approve
                                </Button>
                            )}
                            {canDirectorReview && (
                                <Button
                                    startIcon={<UndoOutlinedIcon />}
                                    onClick={() => setAction("DIRECTOR_RETURN")}
                                    disabled={working}
                                    sx={secondaryBtnSx}
                                >
                                    Director Return
                                </Button>
                            )}
                            {canRevision && (
                                <Button
                                    onClick={() => setAction("REVISION")}
                                    disabled={working}
                                    sx={secondaryBtnSx}
                                >
                                    Create Revision
                                </Button>
                            )}
                            {canRequisition && (
                                <Button
                                    endIcon={<ArrowForwardIcon />}
                                    onClick={() => navigate(`/matflow/requisitions/new?bomId=${bom.id}`)}
                                    sx={primaryBtnSx}
                                >
                                    Raise Requisition
                                </Button>
                            )}
                        </Box>
                    </Card>

                </Box>

                <Box sx={mfBuilderRightColumnSx}>
                    <Card sx={mfBuilderAssistantPanelSx}>
                        <Box sx={mfBuilderSideTitleRowSx}>
                            <Box>
                                <Typography sx={mfBuilderSideTitleSx}>
                                    Operational BOM Assistant
                                </Typography>
                                <Typography sx={mfBuilderSideSubSx}>
                                    Live readiness checks before Production review.
                                </Typography>
                            </Box>
                            <AutoAwesomeOutlinedIcon sx={{ color: "#93c5fd" }} />
                        </Box>

                        {assistantChecks.map((check) => (
                            <MatFlowBuilderAssistantItem
                                key={check.label}
                                done={check.done}
                                label={check.label}
                                subtitle={check.subtitle}
                            />
                        ))}
                    </Card>

                    <Card sx={routeIssues.length > 0 ? mfBuilderWarningPanelSx : mfBuilderReadyPanelSx}>
                        <Box sx={mfBuilderSideTitleRowSx}>
                            <Box>
                                <Typography sx={mfBuilderSideTitleSx}>
                                    Submission Gate
                                </Typography>
                                <Typography sx={mfBuilderSideSubSx}>
                                    MatFlow operational validation remains authoritative.
                                </Typography>
                            </Box>
                            {routeIssues.length > 0
                                ? <AltRouteOutlinedIcon sx={{ color: "#fca5a5" }} />
                                : <CheckCircleOutlineIcon sx={{ color: "#4ade80" }} />}
                        </Box>

                        {routeIssues.length > 0 ? (
                            <>
                                <Box sx={mfBuilderIssueListSx}>
                                    {routeIssues.slice(0, 5).map((issue, index) => (
                                        <Box key={`${issue}-${index}`} sx={mfBuilderIssueItemSx}>
                                            <span style={mfBuilderIssueDotStyle} />
                                            <Typography sx={mfBuilderIssueTextSx}>
                                                {issue}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Box>
                                {routeIssues.length > 5 && (
                                    <Typography sx={{ ...mfBuilderSideSubSx, mt: 1 }}>
                                        +{routeIssues.length - 5} more route issue(s).
                                    </Typography>
                                )}
                            </>
                        ) : (
                            <Box sx={mfBuilderReadyBoxSx}>
                                <CheckCircleOutlineIcon />
                                <Box>
                                    <Typography sx={mfBuilderReadyTitleSx}>
                                        Operational routes validated
                                    </Typography>
                                    <Typography sx={mfBuilderSideSubSx}>
                                        Every line has exactly one QC gate, optional Processing candidates and one final Production destination.
                                    </Typography>
                                </Box>
                            </Box>
                        )}
                    </Card>

                </Box>
            </Box>

            <Box sx={mfBuilderSupportGridSx}>
                <Card sx={mfBuilderSidePanelSx}>
                    <Box sx={mfBuilderSideTitleRowSx}>
                        <Box>
                            <Typography sx={mfBuilderSideTitleSx}>
                                Approval & Handoff
                            </Typography>
                            <Typography sx={mfBuilderSideSubSx}>
                                Engineering → Production → Director → Requisition.
                            </Typography>
                        </Box>
                        <ApprovalOutlinedIcon sx={{ color: "#93c5fd" }} />
                    </Box>

                    <Box sx={mfBuilderWorkflowListSx}>
                        {workflowSteps.map((step, index) => (
                            <MatFlowBuilderWorkflowStep
                                key={step.title}
                                index={index + 1}
                                {...step}
                            />
                        ))}
                    </Box>
                </Card>

                <Card sx={mfBuilderSidePanelSx}>
                    <Box sx={mfBuilderSideTitleRowSx}>
                        <Box>
                            <Typography sx={mfBuilderSideTitleSx}>
                                Section Split
                            </Typography>
                            <Typography sx={mfBuilderSideSubSx}>
                                Material-line distribution by operational category.
                            </Typography>
                        </Box>
                        <AccountTreeOutlinedIcon sx={{ color: "#93c5fd" }} />
                    </Box>

                    <Box sx={mfBuilderSplitListSx}>
                        {materialSections.length === 0 ? (
                            <Typography sx={mfBuilderSideSubSx}>
                                Add materials to generate the section distribution.
                            </Typography>
                        ) : materialSections.map((section) => {
                            const percent = lines.length > 0
                                ? Math.round((section.rows.length / lines.length) * 100)
                                : 0;

                            return (
                                <Box key={section.key} sx={mfBuilderSplitItemSx}>
                                    <Box sx={mfBuilderSplitTopSx}>
                                        <Box sx={mfBuilderSplitNameSx}>
                                            <span style={mfBuilderDotStyle(section.accent)} />
                                            {section.title}
                                        </Box>
                                        <Typography sx={mfBuilderSplitValueSx}>
                                            {percent}%
                                        </Typography>
                                    </Box>
                                    <LinearProgress
                                        variant="determinate"
                                        value={percent}
                                        sx={mfBuilderProgressSx(section.accent)}
                                    />
                                </Box>
                            );
                        })}
                    </Box>
                </Card>

                <Card sx={mfBuilderSidePanelSx}>
                    <Box sx={mfBuilderSideTitleRowSx}>
                        <Box>
                            <Typography sx={mfBuilderSideTitleSx}>
                                Quick Actions
                            </Typography>
                            <Typography sx={mfBuilderSideSubSx}>
                                MatFlow handoffs around the operational BOM.
                            </Typography>
                        </Box>
                        <SpeedOutlinedIcon sx={{ color: "#93c5fd" }} />
                    </Box>

                    <Box sx={mfBuilderQuickActionListSx}>
                        {quickActions.map((item) => (
                            <MatFlowBuilderQuickAction
                                key={item.title}
                                {...item}
                                onClick={() => navigate(item.path)}
                            />
                        ))}
                    </Box>
                </Card>
            </Box>

            <Dialog
                open={Boolean(action)}
                onClose={() => !working && setAction(null)}
                fullWidth
                maxWidth="sm"
                PaperProps={{ sx: dialogPaperSx }}
            >
                <DialogTitle sx={dialogTitleSx}>
                    {action === "SUBMIT"
                        ? "Submit BOM for Production Review"
                        : action === "PRODUCTION_APPROVE"
                            ? "Production Technical Approval"
                            : action === "PRODUCTION_RETURN"
                                ? "Production Return"
                                : action === "DIRECTOR_APPROVE"
                                    ? "Director Final Approval"
                                    : action === "DIRECTOR_RETURN"
                                        ? "Director Return"
                                        : "Create BOM Revision"}
                </DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        label={["PRODUCTION_RETURN", "DIRECTOR_RETURN"].includes(action)
                            ? "Return Remarks *"
                            : "Remarks"}
                        value={remarks}
                        onChange={(event) => setRemarks(event.target.value)}
                        sx={fieldSx}
                    />
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button
                        onClick={() => setAction(null)}
                        disabled={working}
                        sx={secondaryBtnSx}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={executeAction}
                        disabled={working}
                        sx={primaryBtnSx}
                    >
                        {working ? "Working..." : "Confirm"}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={Boolean(lineDialog)}
                onClose={() => !working && setLineDialog(null)}
                fullWidth
                maxWidth="sm"
                PaperProps={{ sx: dialogPaperSx }}
            >
                <DialogTitle sx={dialogTitleSx}>
                    {lineDialog?.line ? "Edit BOM Material" : "Add BOM Material"}
                </DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Box sx={{ display: "grid", gap: 1.5 }}>
                        <TextField
                            select
                            label="Material *"
                            value={lineForm.materialId}
                            onChange={(event) =>
                                setLineForm((current) => ({
                                    ...current,
                                    materialId: event.target.value,
                                }))}
                            sx={fieldSx}
                        >
                            {materials.map((material) => (
                                <MenuItem key={material.id} value={material.id}>
                                    {material.materialCode} · {material.materialName} · {readable(material.category || material.materialCategory || "") || "Uncategorized"} · {material.uom}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            type="number"
                            label="Required Quantity *"
                            value={lineForm.requiredQty}
                            onChange={(event) =>
                                setLineForm((current) => ({
                                    ...current,
                                    requiredQty: event.target.value,
                                }))}
                            sx={fieldSx}
                        />
                        <TextField
                            type="number"
                            label="Wastage %"
                            value={lineForm.wastagePercent}
                            onChange={(event) =>
                                setLineForm((current) => ({
                                    ...current,
                                    wastagePercent: event.target.value,
                                }))}
                            sx={fieldSx}
                        />
                        <TextField
                            multiline
                            minRows={2}
                            label="Remarks"
                            value={lineForm.remarks}
                            onChange={(event) =>
                                setLineForm((current) => ({
                                    ...current,
                                    remarks: event.target.value,
                                }))}
                            sx={fieldSx}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button
                        onClick={() => setLineDialog(null)}
                        disabled={working}
                        sx={secondaryBtnSx}
                    >
                        Cancel
                    </Button>
                    <Button
                        startIcon={<SaveOutlinedIcon />}
                        onClick={saveLine}
                        disabled={working}
                        sx={primaryBtnSx}
                    >
                        Save Material
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={Boolean(routeDialog)}
                onClose={() => !working && setRouteDialog(null)}
                fullWidth
                maxWidth="sm"
                PaperProps={{ sx: dialogPaperSx }}
            >
                <DialogTitle sx={dialogTitleSx}>
                    {routeDialog?.step ? "Edit Material Route Step" : "Route Material"}
                </DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Box sx={mfBuilderRouteDialogHeaderSx}>
                        <Typography sx={mainTextSx}>
                            {routeDialog?.line?.materialCodeSnapshot ||
                                routeDialog?.line?.materialCode ||
                                routeDialog?.line?.materialNameSnapshot ||
                                routeDialog?.line?.materialName ||
                                "Material"}
                        </Typography>
                        <Typography sx={subTextSx}>
                            BOM line {routeDialog?.line?.lineNo ?? "-"} · Approved operational control:
                            QC → optional Processing candidate(s) → Production.
                        </Typography>
                    </Box>

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
                        <TextField
                            type="number"
                            label="Sequence *"
                            value={routeForm.sequenceNo}
                            onChange={(event) =>
                                setRouteForm((current) => ({
                                    ...current,
                                    sequenceNo: event.target.value,
                                }))}
                            sx={fieldSx}
                        />
                        <TextField
                            select
                            label="Route Role *"
                            value={routeForm.stepType}
                            onChange={(event) => {
                                const nextStepType = event.target.value;
                                setRouteForm((current) => ({
                                    ...current,
                                    stepType: nextStepType,
                                    locationId: "",
                                    processCode: nextStepType === "PROCESSING"
                                        ? current.processCode
                                        : "",
                                }));
                            }}
                            sx={fieldSx}
                        >
                            {routeTypeOptions.map((value) => (
                                <MenuItem key={value} value={value}>
                                    {value === "PROCESSING" ? "Processing Option" : readable(value)}
                                </MenuItem>
                            ))}
                        </TextField>

                        <TextField
                            select
                            label="Location *"
                            value={routeForm.locationId}
                            onChange={(event) =>
                                setRouteForm((current) => ({
                                    ...current,
                                    locationId: event.target.value,
                                }))}
                            helperText={
                                locationLoadError
                                    ? "Location Master could not be loaded."
                                    : routeLocationOptions.length === 0
                                        ? `No active ${readable(routeForm.stepType)} location configured${["QC", "PRODUCTION"].includes(normalize(routeForm.stepType)) && projectPlantCode
                                            ? ` for ${projectPlantCode}`
                                            : ""}.`
                                        : `${routeLocationOptions.length} compatible location(s) available.`
                            }
                            sx={{ ...fieldSx, gridColumn: "1 / -1" }}
                        >
                            {routeLocationOptions.length === 0 ? (
                                <MenuItem value="" disabled>
                                    {locationLoadError
                                        ? "Unable to load locations"
                                        : `No compatible ${readable(routeForm.stepType)} location configured`}
                                </MenuItem>
                            ) : routeLocationOptions.map((location) => (
                                <MenuItem key={location.id} value={location.id}>
                                    {location.locationCode} · {location.locationName} · {location.plantCode}
                                    {normalize(location.locationType) === "EXTERNAL_PROCESSOR"
                                        ? " · External Processor"
                                        : ""}
                                </MenuItem>
                            ))}
                        </TextField>

                        {normalize(routeForm.stepType) === "PROCESSING" && (
                            <TextField
                                label="Process Code *"
                                value={routeForm.processCode}
                                onChange={(event) =>
                                    setRouteForm((current) => ({
                                        ...current,
                                        processCode: event.target.value,
                                    }))}
                                sx={fieldSx}
                            />
                        )}
                        <TextField
                            type="number"
                            label="Expected Yield %"
                            value={routeForm.expectedYieldPercent}
                            onChange={(event) =>
                                setRouteForm((current) => ({
                                    ...current,
                                    expectedYieldPercent: event.target.value,
                                }))}
                            sx={fieldSx}
                        />
                        <TextField
                            multiline
                            minRows={2}
                            label="Remarks"
                            value={routeForm.remarks}
                            onChange={(event) =>
                                setRouteForm((current) => ({
                                    ...current,
                                    remarks: event.target.value,
                                }))}
                            sx={{ ...fieldSx, gridColumn: "1 / -1" }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button
                        onClick={() => setRouteDialog(null)}
                        disabled={working}
                        sx={secondaryBtnSx}
                    >
                        Cancel
                    </Button>
                    <Button
                        startIcon={<SaveOutlinedIcon />}
                        onClick={saveRoute}
                        disabled={working}
                        sx={primaryBtnSx}
                    >
                        Save Route
                    </Button>
                </DialogActions>
            </Dialog>

            <MatFlowDeleteDialog
                open={Boolean(deleteTarget)}
                title="Delete Draft BOM?"
                subject={deleteTarget
                    ? `${deleteTarget.bomNumber || "BOM"} · Revision ${deleteTarget.revisionNo ?? "-"}`
                    : "Draft BOM"}
                description="This permanently removes only the latest non-effective Draft BOM revision, its Draft material lines and route setup. Historical approved/submitted revisions cannot be deleted."
                working={working}
                onClose={() => setDeleteTarget(null)}
                onConfirm={confirmDeleteDraft}
            />
        </Box>
    );
}

function MatFlowOperationalSectionTable({
    section,
    routes,
    routeSummaryByLine,
    resolveRouteLocation,
    canEdit,
    working,
    onEdit,
    onDelete,
    onRoute,
}) {
    return (
        <Box sx={mfBuilderTableShellSx}>
            <Box sx={mfBuilderTableHeadSx}>
                <div />
                <div>Material</div>
                <div>Specification</div>
                <div>Unit</div>
                <div>Required</div>
                <div>Wastage</div>
                <div>Net Required</div>
                <div>Approved Operational Route</div>
                <div>Actions</div>
            </Box>

            {section.rows.map((line) => {
                const summary = routeSummaryByLine.get(String(line.id)) || {
                    complete: false,
                    count: 0,
                    processingCount: 0,
                };
                const lineRoutes = sortedRoutesForLine(routes, line.id);

                return (
                    <Box
                        key={line.id}
                        sx={summary.complete
                            ? mfBuilderTableRowSx
                            : mfBuilderRouteMissingRowSx}
                    >
                        <Box sx={mfBuilderRowNumberSx}>
                            {line.lineNo ?? "-"}
                        </Box>

                        <Box sx={mfBuilderMaterialCellSx}>
                            <Typography sx={mfBuilderMaterialCodeSx}>
                                {line.materialCodeSnapshot || line.materialCode || "-"}
                            </Typography>
                            <Typography sx={mfBuilderMaterialNameSx}>
                                {line.materialNameSnapshot || line.materialName || "-"}
                            </Typography>
                        </Box>

                        <Box>
                            <Typography sx={mfBuilderCellTextSx}>
                                {line.specificationSnapshot || line.specification || "-"}
                            </Typography>
                            {line.remarks && (
                                <Typography sx={mfBuilderCellSubSx}>
                                    {line.remarks}
                                </Typography>
                            )}
                        </Box>

                        <Typography sx={mfBuilderCellStrongSx}>
                            {line.uomSnapshot || line.uom || "-"}
                        </Typography>

                        <Typography sx={mfBuilderNumberCellSx}>
                            {formatQty(line.requiredQty)}
                        </Typography>

                        <Typography sx={mfBuilderNumberCellSx}>
                            {formatQty(line.wastagePercent)}%
                        </Typography>

                        <Box>
                            <Typography sx={mfBuilderNumberCellSx}>
                                {formatQty(line.netRequiredQty)}
                            </Typography>
                            <Typography sx={mfBuilderCellSubSx}>
                                {line.uomSnapshot || line.uom || ""}
                            </Typography>
                        </Box>

                        <Box sx={mfBuilderRouteCellSx}>
                            {lineRoutes.length === 0 ? (
                                <Chip
                                    size="small"
                                    icon={<AltRouteOutlinedIcon />}
                                    label="Route Required"
                                    sx={mfBuilderWarningChipSx}
                                />
                            ) : (
                                <Box sx={mfBuilderRouteChipRowSx}>
                                    {lineRoutes.map((step, index) => {
                                        const location = resolveRouteLocation(step);
                                        const accent = routeStepAccent(step.stepType);
                                        return (
                                            <Box
                                                key={step.id || `${line.id}-${step.sequenceNo}-${index}`}
                                                sx={mfBuilderRouteSegmentSx(accent)}
                                                title={`${readable(step.stepType)} · ${location?.locationCode || "Missing location"}${step.processCode ? ` · ${step.processCode}` : ""}`}
                                            >
                                                <span style={mfBuilderRouteDotStyle(accent)} />
                                                <span>
                                                    {normalize(step.stepType) === "PROCESSING"
                                                        ? `PROCESS · ${location?.locationCode || "?"}`
                                                        : `${normalize(step.stepType) || "STEP"} · ${location?.locationCode || "?"}`}
                                                </span>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            )}
                            <Typography sx={mfBuilderCellSubSx}>
                                {summary.complete
                                    ? `${summary.count} governed step(s) · Ready`
                                    : `${summary.count} step(s) · route validation required`}
                            </Typography>
                        </Box>

                        <Box sx={mfBuilderRowActionsSx}>
                            {canEdit ? (
                                <>
                                    <IconButton
                                        size="small"
                                        title="Edit material"
                                        onClick={() => onEdit(line)}
                                        disabled={working}
                                        sx={mfBuilderSmallActionSx}
                                    >
                                        <EditOutlinedIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton
                                        size="small"
                                        title="Route material"
                                        onClick={() => onRoute(line)}
                                        disabled={working}
                                        sx={mfBuilderSmallRouteActionSx}
                                    >
                                        <AltRouteOutlinedIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton
                                        size="small"
                                        title="Delete material"
                                        onClick={() => onDelete(line)}
                                        disabled={working}
                                        sx={mfBuilderSmallDeleteActionSx}
                                    >
                                        <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                </>
                            ) : (
                                <Typography sx={mfBuilderCellSubSx}>
                                    Read only
                                </Typography>
                            )}
                        </Box>
                    </Box>
                );
            })}

            <Box sx={mfBuilderTableFooterSx}>
                {canEdit ? (
                    <Button
                        startIcon={<AddIcon />}
                        onClick={() => onEdit(null)}
                        disabled={working}
                        sx={mfBuilderAddRowBtnSx}
                    >
                        Add Material
                    </Button>
                ) : (
                    <Typography sx={mfBuilderCellSubSx}>
                        Approved / submitted BOM rows are read-only.
                    </Typography>
                )}

                <Typography sx={mfBuilderFooterMetricSx}>
                    Route Ready: {section.routed}/{section.rows.length}
                </Typography>
            </Box>
        </Box>
    );
}

function MatFlowRouteRegister({
    routes,
    lines,
    resolveRouteLocation,
    projectPlantCode,
    canEdit,
    onEdit,
    onDelete,
}) {
    return (
        <Box sx={mfBuilderRegisterTableShellSx}>
            <Box sx={mfBuilderRegisterHeadSx}>
                <div>Line / Material</div>
                <div>Sequence</div>
                <div>Route Role</div>
                <div>Location</div>
                <div>Process</div>
                <div>Yield %</div>
                <div>Control</div>
            </Box>

            {routes.length === 0 ? (
                <Box sx={mfBuilderRegisterEmptySx}>
                    No route configured yet. Use Route Material on a BOM material row.
                </Box>
            ) : routes
                .slice()
                .sort((left, right) => {
                    const leftLine = Number(left?.bomLineNo || 0);
                    const rightLine = Number(right?.bomLineNo || 0);
                    if (leftLine !== rightLine) return leftLine - rightLine;
                    return Number(left?.sequenceNo || 0) - Number(right?.sequenceNo || 0);
                })
                .map((step) => {
                    const line = lines.find((item) => String(item.id) === String(step.bomLineId));
                    const location = resolveRouteLocation(step);
                    const locationType = normalize(location?.locationType);
                    const expectedType = normalize(step.stepType);

                    const typeValid =
                        expectedType === "QC"
                            ? locationType === "QC"
                            : expectedType === "PROCESSING"
                                ? ["PROCESSING", "EXTERNAL_PROCESSOR"].includes(locationType)
                                : expectedType === "PRODUCTION"
                                    ? locationType === "PRODUCTION"
                                    : false;

                    const plantValid =
                        !projectPlantCode ||
                        sameCode(location?.plantCode, projectPlantCode);

                    const valid =
                        Boolean(step.locationId) &&
                        Boolean(location) &&
                        Boolean(locationType) &&
                        typeValid &&
                        plantValid &&
                        location?.active !== false;

                    return (
                        <Box key={step.id} sx={valid ? mfBuilderRegisterRowSx : mfBuilderRegisterInvalidRowSx}>
                            <Box>
                                <Typography sx={mfBuilderCellStrongSx}>
                                    Line {step.bomLineNo ?? line?.lineNo ?? "-"}
                                </Typography>
                                <Typography sx={mfBuilderCellSubSx}>
                                    {line?.materialCodeSnapshot || line?.materialCode || "-"}
                                </Typography>
                            </Box>
                            <Typography sx={mfBuilderNumberCellSx}>
                                {step.sequenceNo}
                            </Typography>
                            <Chip
                                size="small"
                                label={expectedType === "PROCESSING" ? "Processing Option" : readable(expectedType)}
                                sx={mfBuilderRouteRoleChipSx(routeStepAccent(expectedType))}
                            />
                            <Box>
                                <Typography sx={valid ? mfBuilderCellStrongSx : mfBuilderInvalidTextSx}>
                                    {location?.locationCode || location?.locationName || "INVALID / MISSING"}
                                </Typography>
                                <Typography sx={mfBuilderCellSubSx}>
                                    {locationType ? readable(locationType) : "No location type"}
                                    {location?.plantCode ? ` · ${location.plantCode}` : ""}
                                </Typography>
                            </Box>
                            <Typography sx={mfBuilderCellTextSx}>
                                {step.processCode || "-"}
                            </Typography>
                            <Typography sx={mfBuilderNumberCellSx}>
                                {step.expectedYieldPercent ?? 100}
                            </Typography>
                            <Box sx={mfBuilderRegisterActionsSx}>
                                {canEdit && line ? (
                                    <>
                                        <Button
                                            onClick={() => onEdit(line, step)}
                                            sx={mfBuilderRegisterActionBtnSx}
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            onClick={() => onDelete(line, step)}
                                            sx={mfBuilderRegisterDeleteBtnSx}
                                        >
                                            Delete
                                        </Button>
                                    </>
                                ) : (
                                    <Typography sx={mfBuilderCellSubSx}>
                                        Read only
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    );
                })}
        </Box>
    );
}

function MatFlowBuilderStat({ icon, title, value, subtitle, accent }) {
    return (
        <Card sx={mfBuilderMiniStatSx(accent)}>
            <Box sx={mfBuilderMiniIconSx(accent)}>
                {icon}
            </Box>
            <Box sx={{ minWidth: 0 }}>
                <Typography sx={mfBuilderMiniTitleSx}>{title}</Typography>
                <Typography sx={mfBuilderMiniValueSx}>{value}</Typography>
                <Typography sx={mfBuilderMiniSubSx}>{subtitle}</Typography>
            </Box>
        </Card>
    );
}

function MatFlowBuilderMetaPill({ label, value, accent }) {
    return (
        <Box sx={mfBuilderMetaPillSx(accent)}>
            <Typography sx={mfBuilderMetaLabelSx}>{label}</Typography>
            <Typography sx={mfBuilderMetaValueSx}>{value}</Typography>
        </Box>
    );
}

function MatFlowBuilderAssistantItem({ done, label, subtitle }) {
    return (
        <Box sx={mfBuilderAssistantItemSx}>
            <Box sx={mfBuilderAssistantDotSx(done)}>
                {done ? "✓" : "!"}
            </Box>
            <Box sx={{ minWidth: 0 }}>
                <Typography sx={mfBuilderAssistantLabelSx(done)}>
                    {label}
                </Typography>
                <Typography sx={mfBuilderAssistantSubSx}>
                    {subtitle}
                </Typography>
            </Box>
        </Box>
    );
}

function MatFlowBuilderWorkflowStep({
    index,
    title,
    subtitle,
    done,
    current,
}) {
    return (
        <Box sx={mfBuilderWorkflowStepSx}>
            <Box sx={mfBuilderWorkflowMarkerSx(done, current)}>
                {done ? "✓" : index}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={mfBuilderWorkflowTitleSx(done, current)}>
                    {title}
                </Typography>
                <Typography sx={mfBuilderWorkflowSubSx}>
                    {subtitle}
                </Typography>
            </Box>
            {current && (
                <Chip size="small" label="Current" sx={mfBuilderCurrentChipSx} />
            )}
        </Box>
    );
}

function MatFlowBuilderQuickAction({
    icon,
    title,
    subtitle,
    onClick,
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={mfBuilderQuickActionStyle}
        >
            <span style={mfBuilderQuickActionIconStyle}>{icon}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
                <span style={mfBuilderQuickActionTitleStyle}>{title}</span>
                <span style={mfBuilderQuickActionSubStyle}>{subtitle}</span>
            </span>
            <ArrowForwardIcon fontSize="small" />
        </button>
    );
}

/* =========================
 * BOMFLOW-INSPIRED MATFLOW BUILDER STYLES
 * ========================= */

const mfBuilderHeroSx = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "stretch",
    gap: "16px",
    flexWrap: "wrap",
    p: "16px",
    borderRadius: "12px",
    background:
        "radial-gradient(circle at top left, rgba(14,165,233,.22), transparent 34%), linear-gradient(180deg, rgba(8,22,40,.94), rgba(10,20,36,.84))",
    border: "1px solid rgba(125,211,252,.14)",
    boxShadow: "0 18px 38px rgba(2,6,23,.30)",
};

const mfBuilderHeroLeftSx = {
    minWidth: 280,
    flex: 1,
};

const mfBuilderHeroRightSx = {
    width: { xs: "100%", md: 390 },
    display: "flex",
    flexDirection: "column",
    gap: "10px",
};

const mfBuilderChipRowSx = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    mb: "10px",
};

const mfBuilderLabelChipSx = {
    height: 26,
    borderRadius: 999,
    background: "rgba(14,165,233,.14)",
    color: "#7dd3fc",
    border: "1px solid rgba(14,165,233,.28)",
    fontWeight: 900,
    fontSize: 10.5,
    letterSpacing: ".07em",
};

const mfBuilderProjectChipSx = {
    height: 26,
    borderRadius: 999,
    background: "rgba(255,255,255,.055)",
    color: "#cbd5e1",
    border: "1px solid rgba(255,255,255,.10)",
    fontWeight: 850,
    fontSize: 10.5,
};

const mfBuilderStatusChipSx = (status) => {
    const normalized = normalize(status);
    const approved = normalized === "APPROVED";
    const submitted = normalized === "SUBMITTED";
    const returned = normalized === "RETURNED";

    return {
        ...mfBuilderProjectChipSx,
        color: approved ? "#4ade80" : returned ? "#fca5a5" : submitted ? "#93c5fd" : "#fbbf24",
        background: approved
            ? "rgba(34,197,94,.12)"
            : returned
                ? "rgba(239,68,68,.12)"
                : submitted
                    ? "rgba(59,130,246,.12)"
                    : "rgba(245,158,11,.12)",
        border: approved
            ? "1px solid rgba(34,197,94,.24)"
            : returned
                ? "1px solid rgba(239,68,68,.24)"
                : submitted
                    ? "1px solid rgba(59,130,246,.24)"
                    : "1px solid rgba(245,158,11,.24)",
    };
};

const mfBuilderEffectiveChipSx = {
    ...mfBuilderProjectChipSx,
    color: "#4ade80",
    background: "rgba(34,197,94,.12)",
    border: "1px solid rgba(34,197,94,.24)",
};

const mfBuilderPageTitleSx = {
    color: "#fff",
    fontSize: { xs: 24, md: 32 },
    fontWeight: 950,
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
};

const mfBuilderPageSubSx = {
    mt: "8px",
    color: "rgba(226,232,240,.72)",
    fontSize: 12.5,
    fontWeight: 650,
    lineHeight: 1.55,
    maxWidth: 860,
};

const mfBuilderHeroMetaSx = {
    display: "flex",
    alignItems: "stretch",
    gap: "8px",
    flexWrap: "wrap",
    mt: "14px",
};

const mfBuilderMetaPillSx = (accent) => ({
    minWidth: 118,
    p: "9px 11px",
    borderRadius: "10px",
    background: `${accent}10`,
    border: `1px solid ${accent}28`,
});

const mfBuilderMetaLabelSx = {
    color: "rgba(226,232,240,.54)",
    fontSize: 9.5,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".08em",
};

const mfBuilderMetaValueSx = {
    mt: "4px",
    color: "#fff",
    fontSize: 13,
    fontWeight: 950,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const mfBuilderReadinessCardSx = {
    p: "14px",
    borderRadius: "10px",
    background: "rgba(2,6,23,.42)",
    border: "1px solid rgba(255,255,255,.08)",
};

const mfBuilderReadinessTopSx = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "14px",
    mb: "10px",
};

const mfBuilderReadinessLabelSx = {
    color: "rgba(226,232,240,.62)",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".07em",
};

const mfBuilderReadinessValueSx = {
    mt: "5px",
    color: "#4ade80",
    fontSize: 28,
    fontWeight: 950,
    fontFamily: "monospace",
    lineHeight: 1,
};

const mfBuilderReadinessIconSx = {
    width: 38,
    height: 38,
    borderRadius: "9px",
    display: "grid",
    placeItems: "center",
    background: "rgba(34,197,94,.13)",
    color: "#4ade80",
    border: "1px solid rgba(34,197,94,.24)",
};

const mfBuilderCompletionProgressSx = {
    height: 7,
    borderRadius: 999,
    background: "rgba(255,255,255,.07)",
    "& .MuiLinearProgress-bar": {
        borderRadius: 999,
        background: "linear-gradient(135deg,#0ea5e9,#22c55e)",
    },
};

const mfBuilderReadinessHintSx = {
    mt: "8px",
    color: "rgba(226,232,240,.55)",
    fontSize: 10.5,
    fontWeight: 650,
};

const mfBuilderHeroActionsSx = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
};

const mfBuilderSummaryGridSx = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "10px",
};

const mfBuilderMiniStatSx = (accent) => ({
    p: "13px",
    borderRadius: "10px",
    background: "rgba(10,24,42,.84)",
    border: "1px solid rgba(255,255,255,.07)",
    boxShadow: "0 14px 28px rgba(2,6,23,.22)",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    position: "relative",
    overflow: "hidden",
    minHeight: 76,
    "&:before": {
        content: '""',
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        background: accent,
    },
});

const mfBuilderMiniIconSx = (accent) => ({
    width: 38,
    height: 38,
    borderRadius: "9px",
    display: "grid",
    placeItems: "center",
    color: accent,
    background: `${accent}18`,
    border: `1px solid ${accent}33`,
    flexShrink: 0,
});

const mfBuilderMiniTitleSx = {
    color: "rgba(226,232,240,.56)",
    fontSize: 9.5,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".07em",
};

const mfBuilderMiniValueSx = {
    mt: "3px",
    color: "#fff",
    fontSize: 17,
    fontWeight: 950,
    overflow: "hidden",
    textOverflow: "ellipsis",
};

const mfBuilderMiniSubSx = {
    mt: "2px",
    color: "rgba(226,232,240,.50)",
    fontSize: 10.5,
    fontWeight: 650,
    lineHeight: 1.35,
};

const mfBuilderMainGridSx = {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.95fr) minmax(320px, .68fr)",
    gap: "14px",
    alignItems: "start",
    "@media (max-width: 1180px)": {
        gridTemplateColumns: "1fr",
    },
};

const mfBuilderLeftColumnSx = {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    minWidth: 0,
};

const mfBuilderRightColumnSx = {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    minWidth: 0,
    alignSelf: "start",
};

const mfBuilderSupportGridSx = {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "10px",
    alignItems: "stretch",
    "@media (max-width: 1180px)": {
        gridTemplateColumns: "1fr",
    },
};

const mfBuilderToolbarSx = {
    p: "13px 16px",
    borderRadius: "10px",
    background: "rgba(10,24,42,.84)",
    border: "1px solid rgba(255,255,255,.07)",
    boxShadow: "0 14px 28px rgba(2,6,23,.20)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
};

const mfBuilderToolbarTitleSx = {
    color: "#fff",
    fontSize: 17,
    fontWeight: 950,
};

const mfBuilderToolbarSubSx = {
    mt: "3px",
    color: "rgba(226,232,240,.54)",
    fontSize: 10.5,
    fontWeight: 650,
    lineHeight: 1.45,
};

const mfBuilderToolbarActionsSx = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
};

const mfBuilderSectionCardSx = (accent, open) => ({
    borderRadius: "10px",
    background: open
        ? `linear-gradient(180deg, ${accent}10, rgba(10,24,42,.84))`
        : "rgba(10,24,42,.84)",
    border: open
        ? `1px solid ${accent}40`
        : "1px solid rgba(255,255,255,.07)",
    borderLeft: `3px solid ${accent}`,
    boxShadow: open
        ? `0 14px 28px ${accent}12`
        : "0 14px 28px rgba(2,6,23,.20)",
    overflow: "hidden",
    transition: "all .22s ease",
});

const mfBuilderSectionHeaderSx = {
    minHeight: 58,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    px: "13px",
    py: "9px",
    background: "rgba(2,6,23,.22)",
    borderBottom: "1px solid rgba(255,255,255,.07)",
};

const mfBuilderSectionLeftSx = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
};

const mfBuilderSectionRightSx = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexShrink: 0,
};

const mfBuilderSectionIconBtnSx = {
    color: "#94a3b8",
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.06)",
    width: 30,
    height: 30,
    borderRadius: "8px",
    "&:hover": {
        background: "rgba(14,165,233,.14)",
        color: "#fff",
    },
};

const mfBuilderSectionTitleRowSx = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
};

const mfBuilderSectionTitleSx = {
    color: "#fff",
    fontSize: 17,
    fontWeight: 950,
    letterSpacing: "-0.02em",
};

const mfBuilderSectionSubSx = {
    mt: "2px",
    color: "rgba(226,232,240,.50)",
    fontSize: 10.5,
    fontWeight: 650,
};

const mfBuilderCountChipSx = {
    height: 21,
    borderRadius: 999,
    background: "rgba(255,255,255,.06)",
    color: "#94a3b8",
    border: "1px solid rgba(255,255,255,.07)",
    fontWeight: 850,
    fontSize: 9.5,
};

const mfBuilderSectionMetricLabelSx = {
    color: "#94a3b8",
    fontSize: 9,
    textTransform: "uppercase",
    textAlign: "right",
    fontWeight: 850,
    letterSpacing: ".06em",
};

const mfBuilderSectionMetricValueSx = {
    mt: "2px",
    color: "#fff",
    fontWeight: 950,
    fontFamily: "monospace",
    fontSize: 13,
    textAlign: "right",
};

const mfBuilderReadyChipSx = {
    height: 23,
    color: "#4ade80",
    background: "rgba(34,197,94,.12)",
    border: "1px solid rgba(34,197,94,.22)",
    fontWeight: 850,
    fontSize: 9.5,
};

const mfBuilderWarningChipSx = {
    height: 23,
    color: "#fbbf24",
    background: "rgba(245,158,11,.12)",
    border: "1px solid rgba(245,158,11,.22)",
    fontWeight: 850,
    fontSize: 9.5,
};

const mfBuilderTableShellSx = {
    background: "rgba(2,6,23,.18)",
    overflowX: "auto",
};

const mfBuilderTableHeadSx = {
    display: "grid",
    gridTemplateColumns:
        "42px minmax(170px,1.4fr) minmax(180px,1.45fr) 70px 84px 78px 100px minmax(290px,2fr) 112px",
    color: "rgba(226,232,240,.54)",
    fontSize: 9.5,
    fontWeight: 900,
    borderBottom: "1px solid rgba(255,255,255,.08)",
    background: "rgba(2,6,23,.34)",
    textTransform: "uppercase",
    letterSpacing: ".055em",
    minWidth: 1190,
    "& > div": {
        padding: "10px 8px",
    },
};

const mfBuilderTableRowSx = {
    display: "grid",
    gridTemplateColumns:
        "42px minmax(170px,1.4fr) minmax(180px,1.45fr) 70px 84px 78px 100px minmax(290px,2fr) 112px",
    alignItems: "center",
    borderBottom: "1px solid rgba(255,255,255,.06)",
    minHeight: 52,
    background: "rgba(255,255,255,.022)",
    minWidth: 1190,
    "& > p, & > div": {
        padding: "6px 8px",
    },
};

const mfBuilderRouteMissingRowSx = {
    ...mfBuilderTableRowSx,
    background: "rgba(245,158,11,.055)",
};

const mfBuilderRowNumberSx = {
    color: "#7dd3fc",
    fontFamily: "monospace",
    fontWeight: 900,
    fontSize: 11,
    textAlign: "center",
};

const mfBuilderMaterialCellSx = {
    minWidth: 0,
};

const mfBuilderMaterialCodeSx = {
    color: "#fff",
    fontWeight: 900,
    fontSize: 12,
};

const mfBuilderMaterialNameSx = {
    mt: "2px",
    color: "rgba(226,232,240,.58)",
    fontWeight: 650,
    fontSize: 10.5,
};

const mfBuilderCellTextSx = {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: 650,
    lineHeight: 1.35,
};

const mfBuilderCellSubSx = {
    mt: "2px",
    color: "rgba(226,232,240,.48)",
    fontSize: 9.5,
    fontWeight: 650,
    lineHeight: 1.35,
};

const mfBuilderCellStrongSx = {
    color: "#fff",
    fontWeight: 800,
    fontSize: 11,
};

const mfBuilderNumberCellSx = {
    color: "#fff",
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: 800,
};

const mfBuilderRouteCellSx = {
    minWidth: 0,
};

const mfBuilderRouteChipRowSx = {
    display: "flex",
    gap: "5px",
    alignItems: "center",
    flexWrap: "wrap",
};

const mfBuilderRouteSegmentSx = (accent) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    minHeight: 24,
    px: "7px",
    borderRadius: "7px",
    background: `${accent}11`,
    border: `1px solid ${accent}28`,
    color: "#e2e8f0",
    fontSize: 9.5,
    fontWeight: 800,
    whiteSpace: "nowrap",
});

const mfBuilderRouteDotStyle = (accent) => ({
    width: 6,
    height: 6,
    borderRadius: 999,
    background: accent,
    boxShadow: `0 0 8px ${accent}`,
    flexShrink: 0,
});

const mfBuilderRowActionsSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "4px",
};

const mfBuilderSmallActionSx = {
    width: 30,
    height: 30,
    color: "#cbd5e1",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: "8px",
    "&:hover": {
        color: "#fff",
        background: "rgba(59,130,246,.14)",
    },
};

const mfBuilderSmallRouteActionSx = {
    ...mfBuilderSmallActionSx,
    color: "#7dd3fc",
    borderColor: "rgba(14,165,233,.22)",
};

const mfBuilderSmallDeleteActionSx = {
    ...mfBuilderSmallActionSx,
    color: "#fca5a5",
    borderColor: "rgba(239,68,68,.20)",
};

const mfBuilderTableFooterSx = {
    minHeight: 42,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    px: "14px",
    background: "rgba(2,6,23,.30)",
};

const mfBuilderAddRowBtnSx = {
    color: "#7dd3fc",
    textTransform: "none",
    fontSize: 11,
    fontWeight: 850,
};

const mfBuilderFooterMetricSx = {
    color: "#94a3b8",
    fontSize: 10,
    fontFamily: "monospace",
    fontWeight: 800,
};

const mfBuilderEmptySectionCardSx = {
    p: "16px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    borderRadius: "10px",
    background: "rgba(10,24,42,.84)",
    border: "1px solid rgba(255,255,255,.07)",
};

const mfBuilderEmptyIconSx = (accent) => ({
    width: 40,
    height: 40,
    borderRadius: "9px",
    display: "grid",
    placeItems: "center",
    color: accent,
    background: `${accent}15`,
    border: `1px solid ${accent}30`,
});

const mfBuilderEmptyTitleSx = {
    color: "#fff",
    fontSize: 13,
    fontWeight: 900,
};

const mfBuilderEmptySubSx = {
    mt: "2px",
    color: "rgba(226,232,240,.52)",
    fontSize: 10.5,
    fontWeight: 650,
    maxWidth: 620,
};

const mfBuilderSidePanelSx = {
    p: "15px",
    borderRadius: "10px",
    background: "rgba(10,24,42,.84)",
    border: "1px solid rgba(255,255,255,.07)",
    boxShadow: "0 14px 28px rgba(2,6,23,.20)",
    overflow: "hidden",
};

const mfBuilderAssistantPanelSx = {
    ...mfBuilderSidePanelSx,
    background:
        "radial-gradient(circle at top right, rgba(14,165,233,.17), transparent 38%), rgba(10,24,42,.84)",
};

const mfBuilderWarningPanelSx = {
    ...mfBuilderSidePanelSx,
    background:
        "linear-gradient(180deg, rgba(239,68,68,.10), rgba(10,24,42,.84))",
    border: "1px solid rgba(239,68,68,.20)",
};

const mfBuilderReadyPanelSx = {
    ...mfBuilderSidePanelSx,
    background:
        "linear-gradient(180deg, rgba(34,197,94,.08), rgba(10,24,42,.84))",
    border: "1px solid rgba(34,197,94,.18)",
};

const mfBuilderSideTitleRowSx = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    mb: "12px",
};

const mfBuilderSideTitleSx = {
    color: "#fff",
    fontSize: 16,
    fontWeight: 950,
    lineHeight: 1.1,
    letterSpacing: "-0.02em",
};

const mfBuilderSideSubSx = {
    mt: "3px",
    color: "rgba(226,232,240,.50)",
    fontSize: 10.5,
    fontWeight: 650,
    lineHeight: 1.4,
};

const mfBuilderAssistantItemSx = {
    display: "flex",
    gap: "9px",
    alignItems: "flex-start",
    py: "8px",
    borderBottom: "1px solid rgba(255,255,255,.055)",
    "&:last-of-type": {
        borderBottom: "none",
    },
};

const mfBuilderAssistantDotSx = (done) => ({
    width: 22,
    height: 22,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    fontSize: 10.5,
    fontWeight: 950,
    color: done ? "#4ade80" : "#fbbf24",
    background: done ? "rgba(34,197,94,.12)" : "rgba(245,158,11,.12)",
    border: done ? "1px solid rgba(34,197,94,.22)" : "1px solid rgba(245,158,11,.22)",
    flexShrink: 0,
});

const mfBuilderAssistantLabelSx = (done) => ({
    color: done ? "#fff" : "rgba(226,232,240,.78)",
    fontSize: 11.5,
    fontWeight: 850,
});

const mfBuilderAssistantSubSx = {
    mt: "2px",
    color: "rgba(226,232,240,.48)",
    fontSize: 10,
    fontWeight: 650,
    lineHeight: 1.4,
};

const mfBuilderIssueListSx = {
    display: "grid",
    gap: "8px",
};

const mfBuilderIssueItemSx = {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
};

const mfBuilderIssueDotStyle = {
    width: 7,
    height: 7,
    borderRadius: 999,
    background: "#f87171",
    marginTop: 5,
    flexShrink: 0,
};

const mfBuilderIssueTextSx = {
    color: "#fecaca",
    fontSize: 10.5,
    fontWeight: 700,
    lineHeight: 1.4,
};

const mfBuilderReadyBoxSx = {
    p: "11px",
    borderRadius: "8px",
    background: "rgba(34,197,94,.08)",
    border: "1px solid rgba(34,197,94,.16)",
    display: "flex",
    alignItems: "flex-start",
    gap: "9px",
    color: "#4ade80",
};

const mfBuilderReadyTitleSx = {
    color: "#fff",
    fontSize: 11.5,
    fontWeight: 850,
};

const mfBuilderWorkflowListSx = {
    display: "grid",
    gap: "7px",
};

const mfBuilderWorkflowStepSx = {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    p: "8px",
    borderRadius: "8px",
    background: "rgba(2,6,23,.26)",
    border: "1px solid rgba(255,255,255,.05)",
};

const mfBuilderWorkflowMarkerSx = (done, current) => ({
    width: 25,
    height: 25,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    color: done ? "#4ade80" : current ? "#7dd3fc" : "#94a3b8",
    background: done
        ? "rgba(34,197,94,.12)"
        : current
            ? "rgba(14,165,233,.12)"
            : "rgba(148,163,184,.08)",
    border: done
        ? "1px solid rgba(34,197,94,.22)"
        : current
            ? "1px solid rgba(14,165,233,.22)"
            : "1px solid rgba(148,163,184,.14)",
    fontSize: 10,
    fontWeight: 950,
    flexShrink: 0,
});

const mfBuilderWorkflowTitleSx = (done, current) => ({
    color: done ? "#fff" : current ? "#e0f2fe" : "#cbd5e1",
    fontSize: 11,
    fontWeight: 850,
});

const mfBuilderWorkflowSubSx = {
    mt: "1px",
    color: "rgba(226,232,240,.46)",
    fontSize: 9.5,
    fontWeight: 650,
};

const mfBuilderCurrentChipSx = {
    height: 20,
    color: "#7dd3fc",
    background: "rgba(14,165,233,.10)",
    border: "1px solid rgba(14,165,233,.20)",
    fontWeight: 850,
    fontSize: 8.5,
};

const mfBuilderSplitListSx = {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
};

const mfBuilderSplitItemSx = {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
};

const mfBuilderSplitTopSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
};

const mfBuilderSplitNameSx = {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    color: "#fff",
    fontSize: 11,
    fontWeight: 850,
};

const mfBuilderSplitValueSx = {
    color: "rgba(226,232,240,.72)",
    fontSize: 10,
    fontWeight: 850,
};

const mfBuilderDotStyle = (accent) => ({
    width: 7,
    height: 7,
    borderRadius: 999,
    background: accent,
    boxShadow: `0 0 10px ${accent}`,
});

const mfBuilderProgressSx = (accent) => ({
    height: 6,
    borderRadius: 999,
    background: "rgba(255,255,255,.06)",
    "& .MuiLinearProgress-bar": {
        borderRadius: 999,
        background: accent,
    },
});

const mfBuilderQuickActionListSx = {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
};

const mfBuilderQuickActionStyle = {
    width: "100%",
    minHeight: 52,
    padding: "9px 11px",
    borderRadius: 8,
    background: "rgba(255,255,255,.035)",
    border: "1px solid rgba(255,255,255,.065)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    gap: 9,
    textAlign: "left",
    cursor: "pointer",
    fontFamily: "inherit",
};

const mfBuilderQuickActionIconStyle = {
    width: 31,
    height: 31,
    borderRadius: 8,
    display: "grid",
    placeItems: "center",
    color: "#7dd3fc",
    background: "rgba(14,165,233,.10)",
    border: "1px solid rgba(14,165,233,.18)",
    flexShrink: 0,
};

const mfBuilderQuickActionTitleStyle = {
    display: "block",
    fontSize: 11.5,
    fontWeight: 850,
    color: "#fff",
};

const mfBuilderQuickActionSubStyle = {
    display: "block",
    marginTop: 2,
    fontSize: 9.5,
    fontWeight: 650,
    lineHeight: 1.35,
    color: "rgba(226,232,240,.48)",
};

const mfBuilderRouteRegisterCardSx = {
    p: 0,
    overflow: "hidden",
    marginTop: "2px",
    borderRadius: "10px",
    background: "rgba(10,24,42,.84)",
    border: "1px solid rgba(255,255,255,.07)",
    boxShadow: "0 14px 28px rgba(2,6,23,.20)",
};

const mfBuilderRouteRegisterHeaderSx = {
    px: "15px",
    py: "13px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    borderBottom: "1px solid rgba(255,255,255,.07)",
};

const mfBuilderRegisterTableShellSx = {
    overflowX: "auto",
    background: "rgba(2,6,23,.18)",
};

const mfBuilderRegisterHeadSx = {
    display: "grid",
    gridTemplateColumns: "150px 85px 145px 210px minmax(160px,1fr) 85px 150px",
    minWidth: 1040,
    color: "rgba(226,232,240,.52)",
    fontSize: 9.5,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".055em",
    background: "rgba(2,6,23,.34)",
    borderBottom: "1px solid rgba(255,255,255,.08)",
    "& > div": {
        padding: "10px 9px",
    },
};

const mfBuilderRegisterRowSx = {
    display: "grid",
    gridTemplateColumns: "150px 85px 145px 210px minmax(160px,1fr) 85px 150px",
    minWidth: 1040,
    minHeight: 48,
    alignItems: "center",
    borderBottom: "1px solid rgba(255,255,255,.055)",
    background: "rgba(255,255,255,.02)",
    "& > div, & > p": {
        padding: "7px 9px",
    },
};

const mfBuilderRegisterInvalidRowSx = {
    ...mfBuilderRegisterRowSx,
    background: "rgba(239,68,68,.055)",
};

const mfBuilderInvalidTextSx = {
    ...mfBuilderCellStrongSx,
    color: "#fca5a5",
};

const mfBuilderRouteRoleChipSx = (accent) => ({
    justifySelf: "start",
    height: 23,
    color: accent,
    background: `${accent}10`,
    border: `1px solid ${accent}26`,
    fontWeight: 850,
    fontSize: 9,
});

const mfBuilderRegisterActionsSx = {
    display: "flex",
    gap: "5px",
    alignItems: "center",
};

const mfBuilderRegisterActionBtnSx = {
    minWidth: 60,
    height: 30,
    borderRadius: "7px",
    textTransform: "none",
    fontSize: 10,
    fontWeight: 850,
    color: "#7dd3fc",
    border: "1px solid rgba(14,165,233,.18)",
    background: "rgba(14,165,233,.07)",
};

const mfBuilderRegisterDeleteBtnSx = {
    ...mfBuilderRegisterActionBtnSx,
    color: "#fca5a5",
    border: "1px solid rgba(239,68,68,.18)",
    background: "rgba(239,68,68,.06)",
};

const mfBuilderRegisterEmptySx = {
    p: "18px",
    color: "rgba(226,232,240,.52)",
    fontSize: 11,
    fontWeight: 650,
};

const mfBuilderActionBarSx = {
    p: "14px 16px",
    borderRadius: "10px",
    background:
        "radial-gradient(circle at bottom right, rgba(14,165,233,.13), transparent 35%), rgba(10,24,42,.90)",
    border: "1px solid rgba(125,211,252,.13)",
    boxShadow: "0 14px 28px rgba(2,6,23,.22)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "14px",
    flexWrap: "wrap",
};

const mfBuilderActionEyebrowSx = {
    color: "#7dd3fc",
    fontSize: 9.5,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".07em",
};

const mfBuilderActionTitleSx = {
    mt: "3px",
    color: "#fff",
    fontSize: 14,
    fontWeight: 900,
};

const mfBuilderActionSubSx = {
    mt: "2px",
    color: "rgba(226,232,240,.48)",
    fontSize: 10,
    fontWeight: 650,
    maxWidth: 720,
};

const mfBuilderActionButtonsSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "7px",
    flexWrap: "wrap",
};

const mfBuilderRouteDialogHeaderSx = {
    mb: 1.25,
    p: 1,
    borderRadius: 1.6,
    border: "1px solid var(--mf-border)",
    background: "var(--mf-surface)",
};
