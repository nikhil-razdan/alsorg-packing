import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import UndoOutlinedIcon from "@mui/icons-material/UndoOutlined";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { MATFLOW_ROLES, useMatFlow } from "../matflowUi";
import { extractMatFlowPage, matflowApi, readMatFlowError } from "../api/matflowApi";
import { downloadMatFlowExcel } from "../api/matflowExcel";
import {
    Detail,
    EmptyState,
    ErrorBox,
    LoadingBlock,
    MatFlowDeleteDialog,
    MatFlowPagination,
    MatFlowStatusChip,
    PageHero,
    SummaryCard,
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
                subtitle="Engineering creates the Product BOM from Material Inventory. Production reviews the submitted BOM here—there is no separate approval desk."
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
                            {["BOM / Revision", "Project / Product", "Drawing", "Plant", "Status", "Current Owner / Next", "Action"].map((heading) => (
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

export function MatFlowBomCreatePage() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const { selectedPlantParam } = useMatFlow();

    const requestedProductId = params.get("productId") || "";
    const [projects, setProjects] = useState([]);
    const [form, setForm] = useState({ projectId: "", projectDrawingId: requestedProductId, remarks: "" });
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
                        setError("The requested Product is inactive or not visible in your current plant access.");
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
            setError("Select a Project.");
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

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="ENGINEERING"
                title="Create Product BOM"
                subtitle="Select an active Project and Product / Drawing. No Project or Product approval is required."
                actions={
                    <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/matflow/boms")} sx={secondaryBtnSx}>
                        Back
                    </Button>
                }
            />
            <ErrorBox>{error}</ErrorBox>

            <Card sx={panelSx}>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
                    <TextField
                        select
                        label="Project *"
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
                                {product.productName} · {product.drawingNo} Rev {product.drawingRevision || "0"}
                            </MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        multiline
                        minRows={3}
                        label="Engineering Remarks"
                        value={form.remarks}
                        onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))}
                        sx={{ ...fieldSx, gridColumn: "1 / -1" }}
                    />
                </Box>

                {selectedProject && selectedProduct && (
                    <Box sx={{ mt: 2, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 1 }}>
                        <Detail label="Project" value={`${selectedProject.projectCode} · ${selectedProject.projectName}`} />
                        <Detail label="Client" value={selectedProject.clientName} />
                        <Detail label="Product" value={selectedProduct.productName} />
                        <Detail label="Drawing" value={`${selectedProduct.drawingNo} · Rev ${selectedProduct.drawingRevision || "0"}`} />
                        <Detail label="Plant" value={selectedProject.plantCode} />
                    </Box>
                )}

                <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
                    <Button startIcon={<SaveOutlinedIcon />} onClick={save} disabled={saving} sx={primaryBtnSx}>
                        {saving ? "Creating..." : "Create Draft BOM"}
                    </Button>
                </Box>
            </Card>
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
            setBom(bomResponse?.data || null);
            setRoutes(extractMatFlowPage(routeResponse?.data).rows);
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
        routes.forEach((step) => {
            const key = String(step?.bomLineId || "");
            if (!key) return;
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(step);
        });
        map.forEach((items) => items.sort((a, b) => numeric(a.sequenceNo) - numeric(b.sequenceNo)));
        return map;
    }, [routes]);

    const counts = useMemo(() => ({
        materials: lines.length,
        processingOptions: routes.length,
        categories: new Set(lines.map((line) => clean(line.materialCategorySnapshot)).filter(Boolean)).size,
    }), [lines, routes]);

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
            if (lineDialog?.line?.id) {
                await matflowApi.updateBomLine(bom.id, lineDialog.line.id, body);
            } else {
                await matflowApi.addBomLine(bom.id, body);
            }
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
        const nextSequence = current.length
            ? Math.max(...current.map((item) => numeric(item.sequenceNo))) + 1
            : 1;
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
                await matflowApi.updateBomRouteStep(
                    bom.id,
                    routeDialog.line.id,
                    routeDialog.step.id,
                    body
                );
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

            setAction(null);
            setActionRemarks("");

            if (action === "REVISION" && response?.data?.id) {
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
                <PageHero title="Operational BOM" />
                <ErrorBox>{error || "BOM not found."}</ErrorBox>
            </Box>
        );
    }

    const workflow = bomWorkflow(bom);

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="PRODUCT BOM"
                title={`${bom.bomNumber || "BOM"} · Rev ${bom.revisionNo ?? "-"}`}
                subtitle={`${project.projectCode || "-"} · ${project.productName || "-"} · ${project.drawingNo || "-"} · ${project.clientName || "-"}`}
                actions={
                    <>
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/matflow/boms")} sx={secondaryBtnSx}>Back</Button>
                        {canEdit && (
                            <Button startIcon={<AddIcon />} onClick={() => openLine()} sx={primaryBtnSx}>Add Material</Button>
                        )}
                    </>
                }
            />

            <ErrorBox>{error}</ErrorBox>

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 1 }}>
                <SummaryCard label="Materials" value={counts.materials} />
                <SummaryCard label="Categories" value={counts.categories} />
                <SummaryCard label="Processing Options" value={counts.processingOptions} />
                <SummaryCard label="Status" value={readable(bom.status)} />
            </Box>

            <Card sx={panelSx}>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 1 }}>
                    <Detail label="Project" value={`${project.projectCode || "-"} · ${project.projectName || "-"}`} />
                    <Detail label="Client" value={project.clientName || "-"} />
                    <Detail label="Product" value={project.productName || "-"} />
                    <Detail label="Drawing" value={`${project.drawingNo || "-"} · Rev ${project.drawingRevision || "0"}`} />
                    <Detail label="Plant" value={project.plantCode || "-"} />
                    <Detail label="Status" value={<MatFlowStatusChip status={bom.status} />} />
                    <Detail label="Current Owner" value={workflow[0]} />
                    <Detail label="Next Action" value={workflow[1]} />
                    <Detail label="Production Reviewed By" value={bom.productionReviewedBy || "-"} />
                    <Detail label="Production Reviewed At" value={formatDate(bom.productionReviewedAt)} />
                </Box>

                <Box sx={{ mt: 1.5 }}>
                    <Alert severity="info">
                        Store—not Engineering—decides whether each allocated material lot needs QC. QC—not Store—decides whether an accepted QC lot goes directly to Production or to one of the Processing Units configured below.
                    </Alert>
                </Box>

                <Box sx={{ mt: 1.5, display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {canEdit && ["DRAFT", "RETURNED"].includes(status) && (
                        <Button startIcon={<SendOutlinedIcon />} onClick={() => { setAction("SUBMIT"); setActionRemarks(""); }} sx={primaryBtnSx}>
                            Submit to Production
                        </Button>
                    )}
                    {canReview && (
                        <>
                            <Button startIcon={<UndoOutlinedIcon />} onClick={() => { setAction("RETURN"); setActionRemarks(""); }} sx={secondaryBtnSx}>
                                Return to Engineering
                            </Button>
                            <Button startIcon={<SaveOutlinedIcon />} onClick={() => { setAction("REVIEW"); setActionRemarks(""); }} sx={primaryBtnSx}>
                                Mark Reviewed
                            </Button>
                        </>
                    )}
                    {canRequisition && (
                        <Button onClick={() => navigate(`/matflow/requisitions/new?bomId=${encodeURIComponent(bom.id)}`)} sx={primaryBtnSx}>
                            Raise Material Requisition
                        </Button>
                    )}
                    {canRevision && (
                        <Button startIcon={<EditOutlinedIcon />} onClick={() => { setAction("REVISION"); setActionRemarks(""); }} sx={secondaryBtnSx}>
                            Create Revision
                        </Button>
                    )}
                    {canEdit && status === "DRAFT" && bom.latestRevision && !bom.effective && (
                        <Button startIcon={<DeleteOutlineIcon />} onClick={() => setDeleteTarget(bom)} sx={dangerBtnSx}>
                            Delete Draft
                        </Button>
                    )}
                </Box>
            </Card>

            <Card sx={panelSx}>
                <Box sx={{ mb: 1.5 }}>
                    <Typography sx={{ fontWeight: 950, fontSize: 17 }}>Material Structure</Typography>
                    <Typography sx={subTextSx}>
                        Material Inventory specification and UOM snapshots are retained on each BOM line.
                    </Typography>
                </Box>

                <Box sx={tableShellSx}>
                    <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "70px 210px 170px minmax(220px,1fr) 90px 100px 110px 180px" }}>
                        {["Line", "Material", "Category", "Specification", "Required", "Waste %", "Net Qty", "Action"].map((heading) => (
                            <Box key={heading} sx={tableCellSx}>{heading}</Box>
                        ))}
                    </Box>
                    {lines.length === 0 ? <EmptyState>Add materials from Material Inventory.</EmptyState> : lines.map((line) => (
                        <Box key={line.id} sx={{ ...tableRowSx, gridTemplateColumns: "70px 210px 170px minmax(220px,1fr) 90px 100px 110px 180px" }}>
                            <Box sx={tableCellSx}>{line.lineNo ?? "-"}</Box>
                            <Box sx={tableCellSx}>
                                <Typography sx={mainTextSx}>{line.materialName || "-"}</Typography>
                                <Typography sx={subTextSx}>{line.materialCode || "-"} · {line.uom || "-"}</Typography>
                            </Box>
                            <Box sx={tableCellSx}>{readable(line.materialCategorySnapshot) || "-"}</Box>
                            <Box sx={{ ...tableCellSx, whiteSpace: "normal" }}>{line.specification || "-"}</Box>
                            <Box sx={tableCellSx}>{formatQty(line.requiredQty)}</Box>
                            <Box sx={tableCellSx}>{formatQty(line.wastagePercent)}</Box>
                            <Box sx={tableCellSx}>{formatQty(line.netRequiredQty)}</Box>
                            <Box sx={{ ...tableCellSx, display: "flex", gap: .5, flexWrap: "wrap" }}>
                                {canEdit && (
                                    <>
                                        <Button onClick={() => openLine(line)} sx={secondaryBtnSx}>Edit</Button>
                                        <Button onClick={() => deleteLine(line)} sx={dangerBtnSx}>Remove</Button>
                                    </>
                                )}
                            </Box>
                        </Box>
                    ))}
                </Box>
            </Card>

            <Card sx={panelSx}>
                <Box sx={{ mb: 1.5 }}>
                    <Typography sx={{ fontWeight: 950, fontSize: 17 }}>Approved Processing Options</Typography>
                    <Typography sx={subTextSx}>
                        Optional Processing Units per material. Store never selects these. They become choices for QC only after Store sends a QC-required lot and QC accepts it.
                    </Typography>
                </Box>

                {lines.length === 0 ? <EmptyState>Add BOM materials first.</EmptyState> : (
                    <Box sx={{ display: "grid", gap: 1.2 }}>
                        {lines.map((line) => {
                            const steps = processingByLine.get(String(line.id)) || [];
                            return (
                                <Card key={line.id} sx={{ ...panelSx, boxShadow: "none", m: 0 }}>
                                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                                        <Box>
                                            <Typography sx={mainTextSx}>{line.materialName} · {line.materialCode}</Typography>
                                            <Typography sx={subTextSx}>
                                                {steps.length ? `${steps.length} Processing option${steps.length === 1 ? "" : "s"}` : "Direct Production remains possible when QC does not select Processing."}
                                            </Typography>
                                        </Box>
                                        {canEdit && (
                                            <Button startIcon={<AddIcon />} onClick={() => openRoute(line)} sx={secondaryBtnSx}>
                                                Add Processing Unit
                                            </Button>
                                        )}
                                    </Box>

                                    {steps.length > 0 && (
                                        <Box sx={{ mt: 1, display: "grid", gap: .7 }}>
                                            {steps.map((step) => (
                                                <Box
                                                    key={step.id}
                                                    sx={{
                                                        display: "grid",
                                                        gridTemplateColumns: "70px minmax(180px,1fr) 170px 110px 150px",
                                                        gap: 1,
                                                        alignItems: "center",
                                                        p: 1,
                                                        border: "1px solid var(--mf-border)",
                                                        borderRadius: 2,
                                                    }}
                                                >
                                                    <Typography sx={subTextSx}>#{step.sequenceNo}</Typography>
                                                    <Box>
                                                        <Typography sx={mainTextSx}>{step.locationName || step.locationCode || "-"}</Typography>
                                                        <Typography sx={subTextSx}>{step.locationCode || "-"} · {step.plantCode || "-"}</Typography>
                                                    </Box>
                                                    <Typography sx={mainTextSx}>{step.processCode || "-"}</Typography>
                                                    <Typography sx={subTextSx}>{formatQty(step.expectedYieldPercent)}% yield</Typography>
                                                    <Box sx={{ display: "flex", gap: .5 }}>
                                                        {canEdit && (
                                                            <>
                                                                <Button onClick={() => openRoute(line, step)} sx={secondaryBtnSx}>Edit</Button>
                                                                <Button onClick={() => deleteRoute(line, step)} sx={dangerBtnSx}>Delete</Button>
                                                            </>
                                                        )}
                                                    </Box>
                                                </Box>
                                            ))}
                                        </Box>
                                    )}
                                </Card>
                            );
                        })}
                    </Box>
                )}
            </Card>

            {Array.isArray(bom.history) && bom.history.length > 0 && (
                <Card sx={panelSx}>
                    <Typography sx={{ fontWeight: 950, fontSize: 17, mb: 1 }}>BOM History</Typography>
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 150px 150px minmax(220px,1fr)" }}>
                            {["Action", "Actor", "Time", "Remarks"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {bom.history.map((row) => (
                            <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "170px 150px 150px minmax(220px,1fr)" }}>
                                <Box sx={tableCellSx}><MatFlowStatusChip status={row.action} /></Box>
                                <Box sx={tableCellSx}>{row.actionBy || "-"}</Box>
                                <Box sx={tableCellSx}>{formatDate(row.actionAt)}</Box>
                                <Box sx={{ ...tableCellSx, whiteSpace: "normal" }}>{row.remarks || "-"}</Box>
                            </Box>
                        ))}
                    </Box>
                </Card>
            )}

            <Dialog open={Boolean(lineDialog)} onClose={() => !working && setLineDialog(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>{lineDialog?.line ? "Edit BOM Material" : "Add BOM Material"}</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Box sx={{ display: "grid", gap: 1.5 }}>
                        <TextField
                            select
                            label="Material *"
                            value={lineForm.materialId}
                            onChange={(event) => setLineForm((current) => ({ ...current, materialId: event.target.value }))}
                            sx={fieldSx}
                        >
                            {materials.map((material) => (
                                <MenuItem key={material.id} value={material.id}>
                                    {material.materialName} · {material.materialCode} · {material.uom}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            type="number"
                            label="Required Qty *"
                            value={lineForm.requiredQty}
                            onChange={(event) => setLineForm((current) => ({ ...current, requiredQty: event.target.value }))}
                            sx={fieldSx}
                        />
                        <TextField
                            type="number"
                            label="Wastage %"
                            value={lineForm.wastagePercent}
                            onChange={(event) => setLineForm((current) => ({ ...current, wastagePercent: event.target.value }))}
                            sx={fieldSx}
                        />
                        <TextField
                            multiline
                            minRows={2}
                            label="Remarks"
                            value={lineForm.remarks}
                            onChange={(event) => setLineForm((current) => ({ ...current, remarks: event.target.value }))}
                            sx={fieldSx}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setLineDialog(null)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
                    <Button onClick={saveLine} disabled={working} sx={primaryBtnSx}>{working ? "Saving..." : "Save"}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(routeDialog)} onClose={() => !working && setRouteDialog(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>{routeDialog?.step ? "Edit Processing Option" : "Add Processing Option"}</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Box sx={{ display: "grid", gap: 1.5 }}>
                        <Alert severity="info">
                            This does not force Processing. It only authorizes a Processing Unit that QC may select for this material after an accepted QC inspection.
                        </Alert>
                        <TextField
                            type="number"
                            label="Sequence *"
                            value={routeForm.sequenceNo}
                            onChange={(event) => setRouteForm((current) => ({ ...current, sequenceNo: event.target.value }))}
                            sx={fieldSx}
                        />
                        <TextField
                            select
                            label="Processing Unit *"
                            value={routeForm.locationId}
                            onChange={(event) => setRouteForm((current) => ({ ...current, locationId: event.target.value }))}
                            sx={fieldSx}
                        >
                            {processingLocations.map((location) => (
                                <MenuItem key={location.id} value={location.id}>
                                    {location.locationCode} · {location.locationName} · {readable(location.locationType)}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            label="Process Code *"
                            value={routeForm.processCode}
                            onChange={(event) => setRouteForm((current) => ({ ...current, processCode: event.target.value }))}
                            sx={fieldSx}
                        />
                        <TextField
                            type="number"
                            label="Expected Yield %"
                            value={routeForm.expectedYieldPercent}
                            onChange={(event) => setRouteForm((current) => ({ ...current, expectedYieldPercent: event.target.value }))}
                            sx={fieldSx}
                        />
                        <TextField
                            multiline
                            minRows={2}
                            label="Remarks"
                            value={routeForm.remarks}
                            onChange={(event) => setRouteForm((current) => ({ ...current, remarks: event.target.value }))}
                            sx={fieldSx}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setRouteDialog(null)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
                    <Button onClick={saveRoute} disabled={working} sx={primaryBtnSx}>{working ? "Saving..." : "Save Option"}</Button>
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
                    <TextField
                        multiline
                        minRows={3}
                        label={action === "RETURN" ? "Return Remarks *" : "Remarks"}
                        value={actionRemarks}
                        onChange={(event) => setActionRemarks(event.target.value)}
                        sx={fieldSx}
                        fullWidth
                    />
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setAction(null)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
                    <Button onClick={executeAction} disabled={working} sx={primaryBtnSx}>
                        {working ? "Working..." : "Confirm"}
                    </Button>
                </DialogActions>
            </Dialog>

            <MatFlowDeleteDialog
                open={Boolean(deleteTarget)}
                title="Delete Draft BOM?"
                subject={bom?.bomNumber || "Draft BOM"}
                description="This is allowed only while the latest revision is a non-effective Draft."
                working={working}
                onClose={() => setDeleteTarget(null)}
                onConfirm={confirmDeleteDraft}
            />
        </Box>
    );
}
