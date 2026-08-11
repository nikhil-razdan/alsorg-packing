import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    Chip,
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
import ApprovalOutlinedIcon from "@mui/icons-material/ApprovalOutlined";
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
    PageHero,
    clean,
    dialogActionsSx,
    dialogContentSx,
    dialogPaperSx,
    dialogTitleSx,
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
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px minmax(220px,1fr) 140px 120px 170px 200px 100px" }}>
                            {["BOM / Revision", "Project / Product", "Drawing", "Plant", "Status", "Responsible / Next", "Action"].map((h) => <Box key={h} sx={tableCellSx}>{h}</Box>)}
                        </Box>
                        {rows.length === 0 ? <EmptyState>No BOM records match the current view.</EmptyState> : bomPagination.pageItems.map((row) => {
                            const flow = workflowFor(row);
                            return (
                                <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "170px minmax(220px,1fr) 140px 120px 170px 200px 100px" }}>
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.bomNumber || "-"}</Typography><Typography sx={subTextSx}>Revision {row.revisionNo ?? "-"}{row.effective ? " · Effective" : ""}</Typography></Box>
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.projectCode || row.productName || "-"}</Typography><Typography sx={subTextSx}>{row.productName || row.clientName || "-"}</Typography></Box>
                                    <Box sx={tableCellSx}>{row.drawingNo || "-"}</Box>
                                    <Box sx={tableCellSx}>{row.plantCode || "-"}</Box>
                                    <Box sx={tableCellSx}><MatFlowStatusChip status={row.status} /></Box>
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{flow[0]}</Typography><Typography sx={subTextSx}>{flow[1]}</Typography></Box>
                                    <Box sx={tableCellSx}><Button onClick={() => navigate(`/matflow/boms/${row.id}`)} sx={secondaryBtnSx}>{normalize(row.status) === "SUBMITTED" ? "Review" : "Open"}</Button></Box>
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
        </Box>
    );
}

export const MatFlowBomReviewPage = () => <MatFlowBomListPage submittedOnly />;

export function MatFlowBomCreatePage() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const requestedProductId = params.get("productId") || "";
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState({ projectDrawingId: requestedProductId, remarks: "" });

    useEffect(() => {
        let active = true;

        (async () => {
            try {
                /*
                 * v3 /projects returns the true Project aggregate. BOMs are still
                 * product-specific, so flatten only Director-approved child Products.
                 */
                const response = await matflowApi.listProjects({ active: true });
                const projectRows = extractMatFlowPage(response?.data).rows;

                const approvedProducts = projectRows.flatMap((projectRow) =>
                    (Array.isArray(projectRow?.products) ? projectRow.products : [])
                        .filter((product) =>
                            product?.active !== false &&
                            normalize(product?.approvalStatus) === "APPROVED"
                        )
                        .map((product) => ({
                            ...product,
                            projectId: projectRow.id,
                            projectCode: projectRow.projectCode,
                            projectName: projectRow.projectName,
                            clientName: projectRow.clientName,
                            plantCode: projectRow.plantCode,
                            owningPlantCode: projectRow.plantCode,
                            projectRequiredDate: projectRow.requiredDate,
                        }))
                );

                if (!active) return;

                setProducts(approvedProducts);

                if (requestedProductId) {
                    const exists = approvedProducts.some(
                        (product) => String(product.id) === String(requestedProductId)
                    );
                    if (!exists) {
                        setForm((current) => ({ ...current, projectDrawingId: "" }));
                        setError(
                            "The requested Product is not active and Director-approved, or is not visible in your plant access."
                        );
                    }
                }
            } catch (requestError) {
                if (active) {
                    setProducts([]);
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
    }, [requestedProductId]);

    const selected = products.find(
        (product) => String(product.id) === String(form.projectDrawingId)
    );

    const save = async () => {
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
                subtitle="Engineering creates a BOM only for an active Product/Item that has already received Director approval inside its client Project."
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

            <Card sx={panelSx}>
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", md: "minmax(320px,1.3fr) minmax(260px,.7fr)" },
                        gap: 1.5,
                    }}
                >
                    <TextField
                        select
                        label="Project → Product / Drawing *"
                        value={form.projectDrawingId}
                        onChange={(e) =>
                            setForm((current) => ({
                                ...current,
                                projectDrawingId: e.target.value,
                            }))
                        }
                        sx={fieldSx}
                    >
                        {products.length === 0 && (
                            <MenuItem value="" disabled>
                                No Director-approved Products available
                            </MenuItem>
                        )}
                        {products.map((product) => (
                            <MenuItem key={product.id} value={product.id}>
                                {product.projectCode || "-"} → {product.productName || "-"} · {product.drawingNo || "-"} · Rev {product.drawingRevision ?? "0"}
                            </MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        label="Engineering Remarks"
                        value={form.remarks}
                        onChange={(e) =>
                            setForm((current) => ({
                                ...current,
                                remarks: e.target.value,
                            }))
                        }
                        sx={fieldSx}
                    />
                </Box>
            </Card>

            {selected && (
                <Card sx={panelSx}>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
                            gap: 1,
                        }}
                    >
                        <Detail label="Project" value={`${selected.projectCode || "-"} · ${selected.projectName || "-"}`} />
                        <Detail label="Client" value={selected.clientName} />
                        <Detail label="Product / Item" value={selected.productName} />
                        <Detail label="Drawing" value={`${selected.drawingNo || "-"} · Rev ${selected.drawingRevision ?? "0"}`} />
                        <Detail label="Plant" value={selected.plantCode} />
                        <Detail label="Director Approval" value={<MatFlowStatusChip status={selected.approvalStatus} />} />
                    </Box>
                </Card>
            )}

            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Button
                    startIcon={<SaveOutlinedIcon />}
                    onClick={save}
                    disabled={saving || !selected?.id}
                    sx={primaryBtnSx}
                >
                    {saving ? "Creating..." : "Create BOM Draft"}
                </Button>
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
    const [locations, setLocations] = useState([]);
    const [locationLoadError, setLocationLoadError] = useState("");
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [action, setAction] = useState(null);
    const [remarks, setRemarks] = useState("");
    const [lineDialog, setLineDialog] = useState(null);
    const [lineForm, setLineForm] = useState({ materialId: "", requiredQty: "", wastagePercent: "0", remarks: "" });
    const [routeDialog, setRouteDialog] = useState(null);
    const [routeForm, setRouteForm] = useState({ sequenceNo: "1", stepType: "QC", locationId: "", processCode: "", expectedYieldPercent: "100", remarks: "" });

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

    const validRouteLineCount = useMemo(() => {
        return lines.filter((line) => {
            const lineRoutes = routes
                .filter((item) => String(item.bomLineId) === String(line.id))
                .sort((a, b) => Number(a.sequenceNo || 0) - Number(b.sequenceNo || 0));

            if (lineRoutes.length < 2) return false;
            if (normalize(lineRoutes[0]?.stepType) !== "QC") return false;
            if (normalize(lineRoutes[lineRoutes.length - 1]?.stepType) !== "PRODUCTION") return false;

            const qcCount = lineRoutes.filter((step) => normalize(step?.stepType) === "QC").length;
            const productionCount = lineRoutes.filter((step) => normalize(step?.stepType) === "PRODUCTION").length;
            if (qcCount !== 1 || productionCount !== 1) return false;

            return lineRoutes.every((step, index) => {
                const stepType = normalize(step?.stepType);
                const location = resolveRouteLocation(step);
                const locationType = normalize(location?.locationType);

                if (!step?.locationId || !location || !locationType) return false;
                if (location.active === false) return false;
                if (projectPlantCode && !sameCode(location.plantCode, projectPlantCode)) return false;
                if (stepType === "QC" && locationType !== "QC") return false;
                if (stepType === "PROCESSING" && !["PROCESSING", "EXTERNAL_PROCESSOR"].includes(locationType)) return false;
                if (stepType === "PRODUCTION" && locationType !== "PRODUCTION") return false;
                if (index > 0 && index < lineRoutes.length - 1 && stepType !== "PROCESSING") return false;
                return true;
            });
        }).length;
    }, [lines, routes, projectPlantCode, resolveRouteLocation]);

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

    if (loading) return <LoadingBlock />;
    return (
        <Box sx={pageSx}>
            <PageHero badge="OPERATIONAL BOM" title={bom?.bomNumber || "BOM"} subtitle={`${project.projectCode || "-"} · ${project.drawingNo || "-"} · Revision ${bom?.revisionNo ?? "-"}`} actions={<><Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button><Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/matflow/boms")} sx={secondaryBtnSx}>Back</Button></>} />
            <ErrorBox>{error}</ErrorBox>
            {locationLoadError && (
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                    {locationLoadError} Route locations cannot be selected until the Location Master request succeeds.
                </Alert>
            )}
            {bom && <>
                <Card sx={panelSx}>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 1 }}>
                        <Detail label="Status" value={<MatFlowStatusChip status={bom.status} />} />
                        <Detail label="Effective" value={bom.effective ? "Yes" : "No"} />
                        <Detail label="Latest Revision" value={bom.latestRevision ? "Yes" : "No"} />
                        <Detail label="Project" value={project.projectCode} /><Detail label="Product" value={project.productName} /><Detail label="Drawing" value={project.drawingNo} /><Detail label="Plant" value={project.plantCode || project.owningPlantCode} />
                        <Detail label="Responsible Department" value={workflow[0]} /><Detail label="Next Action" value={workflow[1]} />
                    </Box>
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "flex-end", mt: 1.5 }}>
                        {canEdit && lines.length > 0 && <Button startIcon={<SendOutlinedIcon />} onClick={() => setAction("SUBMIT")} sx={primaryBtnSx}>Submit for Approval</Button>}
                        {canProductionReview && <Button startIcon={<ApprovalOutlinedIcon />} onClick={() => setAction("PRODUCTION_APPROVE")} sx={primaryBtnSx}>Production Approve</Button>}
                        {canProductionReview && <Button startIcon={<UndoOutlinedIcon />} onClick={() => setAction("PRODUCTION_RETURN")} sx={secondaryBtnSx}>Production Return</Button>}
                        {canDirectorReview && <Button startIcon={<ApprovalOutlinedIcon />} onClick={() => setAction("DIRECTOR_APPROVE")} sx={primaryBtnSx}>Director Final Approve</Button>}
                        {canDirectorReview && <Button startIcon={<UndoOutlinedIcon />} onClick={() => setAction("DIRECTOR_RETURN")} sx={secondaryBtnSx}>Director Return</Button>}
                        {canRevision && <Button onClick={() => setAction("REVISION")} sx={secondaryBtnSx}>Create Revision</Button>}
                        {canRequisition && <Button onClick={() => navigate(`/matflow/requisitions/new?bomId=${bom.id}`)} sx={primaryBtnSx}>Raise Requisition</Button>}
                    </Box>
                </Card>

                <Card sx={panelSx}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center" }}>
                        <Box><Typography sx={sectionTitleSx}>Material Lines</Typography><Typography sx={sectionSubSx}>{lines.length} line(s)</Typography></Box>
                        {canEdit && <Button startIcon={<AddIcon />} onClick={() => { setLineDialog({ line: null }); setLineForm({ materialId: "", requiredQty: "", wastagePercent: "0", remarks: "" }); }} sx={primaryBtnSx}>Add Material</Button>}
                    </Box>
                    <Box sx={{ ...tableShellSx, mt: 1.5 }}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "65px 190px minmax(200px,1fr) 100px 110px 130px 170px" }}>
                            {["Line", "Material", "Specification", "Required", "Wastage %", "Net Required", "Actions"].map((h) => <Box key={h} sx={tableCellSx}>{h}</Box>)}
                        </Box>
                        {lines.length === 0 ? <EmptyState>Add at least one material line before submission.</EmptyState> : lines.map((line) => (
                            <Box key={line.id} sx={{ ...tableRowSx, gridTemplateColumns: "65px 190px minmax(200px,1fr) 100px 110px 130px 170px" }}>
                                <Box sx={tableCellSx}>{line.lineNo ?? "-"}</Box>
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{line.materialCodeSnapshot || line.materialCode || "-"}</Typography><Typography sx={subTextSx}>{line.materialNameSnapshot || line.materialName || "-"}</Typography></Box>
                                <Box sx={tableCellSx}>{line.specificationSnapshot || line.specification || "-"}</Box>
                                <Box sx={tableCellSx}>{formatQty(line.requiredQty)} {line.uomSnapshot || line.uom || ""}</Box>
                                <Box sx={tableCellSx}>{formatQty(line.wastagePercent)}</Box>
                                <Box sx={tableCellSx}>{formatQty(line.netRequiredQty)}</Box>
                                <Box sx={{ ...tableCellSx, display: "flex", gap: .5 }}>
                                    {canEdit && <Button onClick={() => { setLineDialog({ line }); setLineForm({ materialId: line.materialId || line.material?.id || "", requiredQty: String(line.requiredQty ?? ""), wastagePercent: String(line.wastagePercent ?? 0), remarks: line.remarks || "" }); }} sx={secondaryBtnSx}><EditOutlinedIcon fontSize="small" /></Button>}
                                    {canEdit && <Button onClick={() => removeLine(line)} sx={secondaryBtnSx}><DeleteOutlineIcon fontSize="small" /></Button>}
                                    {canEdit && <Button onClick={() => openRoute(line)} sx={secondaryBtnSx}>Route</Button>}
                                </Box>
                            </Box>
                        ))}
                    </Box>
                </Card>

                <Card sx={panelSx}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                        <Box>
                            <Typography sx={sectionTitleSx}>Approved Material Route</Typography>
                            <Typography sx={sectionSubSx}>
                                Every material requires QC and a Production destination. Processing rows are approved candidate Processing Units; QC decides per inspected lot whether to bypass Processing or send the material to one approved unit.
                            </Typography>
                        </Box>
                        <Chip
                            size="small"
                            label={`${validRouteLineCount}/${lines.length} material route(s) complete`}
                            color={lines.length > 0 && validRouteLineCount === lines.length ? "success" : "warning"}
                        />
                    </Box>
                    {routeIssues.length > 0 && (
                        <Alert severity="warning" sx={{ mt: 1.25, borderRadius: 2 }}>
                            {routeIssues.slice(0, 3).join(" ")}
                            {routeIssues.length > 3 ? ` +${routeIssues.length - 3} more route issue(s).` : ""}
                        </Alert>
                    )}
                    <Box sx={{ ...tableShellSx, mt: 1.5 }}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "90px 80px 140px 180px 130px 110px 160px" }}>
                            {["BOM Line", "Sequence", "Step", "Location", "Process", "Yield %", "Action"].map((h) => <Box key={h} sx={tableCellSx}>{h}</Box>)}
                        </Box>
                        {routes.length === 0 ? <EmptyState>No explicit route configured. Add route steps from the material line actions.</EmptyState> : routes.map((step) => {
                            const line = lines.find((item) => String(item.id) === String(step.bomLineId));
                            const resolvedLocation = resolveRouteLocation(step);
                            const resolvedLocationType = normalize(resolvedLocation?.locationType);
                            const expectedType = normalize(step.stepType);
                            const locationTypeValid =
                                expectedType === "QC"
                                    ? resolvedLocationType === "QC"
                                    : expectedType === "PROCESSING"
                                        ? ["PROCESSING", "EXTERNAL_PROCESSOR"].includes(resolvedLocationType)
                                        : expectedType === "PRODUCTION"
                                            ? resolvedLocationType === "PRODUCTION"
                                            : false;
                            const plantValid = !projectPlantCode || sameCode(resolvedLocation?.plantCode, projectPlantCode);
                            const routeLocationValid = Boolean(step.locationId) && Boolean(resolvedLocation) && Boolean(resolvedLocationType) && locationTypeValid && plantValid && resolvedLocation?.active !== false;

                            return <Box key={step.id} sx={{ ...tableRowSx, gridTemplateColumns: "90px 80px 140px 180px 130px 110px 160px" }}>
                                <Box sx={tableCellSx}>{step.bomLineNo ?? line?.lineNo ?? "-"}</Box>
                                <Box sx={tableCellSx}>{step.sequenceNo}</Box>
                                <Box sx={tableCellSx}>{step.stepType}</Box>
                                <Box sx={tableCellSx}>
                                    <Typography sx={routeLocationValid ? mainTextSx : { ...mainTextSx, color: "error.main" }}>
                                        {resolvedLocation?.locationCode || resolvedLocation?.locationName || "INVALID / MISSING"}
                                    </Typography>
                                    <Typography sx={subTextSx}>
                                        {resolvedLocationType ? readable(resolvedLocationType) : "No location type"}
                                        {resolvedLocation?.plantCode ? ` · ${resolvedLocation.plantCode}` : ""}
                                    </Typography>
                                </Box>
                                <Box sx={tableCellSx}>{step.processCode || "-"}</Box>
                                <Box sx={tableCellSx}>{step.expectedYieldPercent ?? 100}</Box>
                                <Box sx={{ ...tableCellSx, display: "flex", gap: .5 }}>
                                    {canEdit && line ? <>
                                        <Button onClick={() => openRoute(line, step)} sx={secondaryBtnSx}>Edit</Button>
                                        <Button onClick={() => deleteRoute(line, step)} sx={secondaryBtnSx}>Delete</Button>
                                    </> : "-"}
                                </Box>
                            </Box>;
                        })}
                    </Box>
                </Card>
            </>}

            <Dialog open={Boolean(action)} onClose={() => !working && setAction(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>{action === "SUBMIT" ? "Submit BOM for Production Review" : action === "PRODUCTION_APPROVE" ? "Production Technical Approval" : action === "PRODUCTION_RETURN" ? "Production Return" : action === "DIRECTOR_APPROVE" ? "Director Final Approval" : action === "DIRECTOR_RETURN" ? "Director Return" : "Create BOM Revision"}</DialogTitle>
                <DialogContent sx={dialogContentSx}><TextField fullWidth multiline minRows={3} label={["PRODUCTION_RETURN", "DIRECTOR_RETURN"].includes(action) ? "Return Remarks *" : "Remarks"} value={remarks} onChange={(e) => setRemarks(e.target.value)} sx={fieldSx} /></DialogContent>
                <DialogActions sx={dialogActionsSx}><Button onClick={() => setAction(null)} sx={secondaryBtnSx}>Cancel</Button><Button onClick={executeAction} disabled={working} sx={primaryBtnSx}>{working ? "Working..." : "Confirm"}</Button></DialogActions>
            </Dialog>

            <Dialog open={Boolean(lineDialog)} onClose={() => !working && setLineDialog(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>{lineDialog?.line ? "Edit BOM Material" : "Add BOM Material"}</DialogTitle>
                <DialogContent sx={dialogContentSx}><Box sx={{ display: "grid", gap: 1.5 }}>
                    <TextField select label="Material *" value={lineForm.materialId} onChange={(e) => setLineForm((c) => ({ ...c, materialId: e.target.value }))} sx={fieldSx}>{materials.map((m) => <MenuItem key={m.id} value={m.id}>{m.materialCode} · {m.materialName} · {m.uom}</MenuItem>)}</TextField>
                    <TextField type="number" label="Required Quantity *" value={lineForm.requiredQty} onChange={(e) => setLineForm((c) => ({ ...c, requiredQty: e.target.value }))} sx={fieldSx} />
                    <TextField type="number" label="Wastage %" value={lineForm.wastagePercent} onChange={(e) => setLineForm((c) => ({ ...c, wastagePercent: e.target.value }))} sx={fieldSx} />
                    <TextField multiline minRows={2} label="Remarks" value={lineForm.remarks} onChange={(e) => setLineForm((c) => ({ ...c, remarks: e.target.value }))} sx={fieldSx} />
                </Box></DialogContent>
                <DialogActions sx={dialogActionsSx}><Button onClick={() => setLineDialog(null)} sx={secondaryBtnSx}>Cancel</Button><Button onClick={saveLine} disabled={working} sx={primaryBtnSx}>Save</Button></DialogActions>
            </Dialog>

            <Dialog open={Boolean(routeDialog)} onClose={() => !working && setRouteDialog(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>{routeDialog?.step ? "Edit Route Step" : "Add Route Step"}</DialogTitle>
                <DialogContent sx={dialogContentSx}><Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                    <TextField type="number" label="Sequence *" value={routeForm.sequenceNo} onChange={(e) => setRouteForm((c) => ({ ...c, sequenceNo: e.target.value }))} sx={fieldSx} />
                    <TextField
                        select
                        label="Route Role *"
                        value={routeForm.stepType}
                        onChange={(e) => {
                            const nextStepType = e.target.value;
                            setRouteForm((current) => ({
                                ...current,
                                stepType: nextStepType,
                                locationId: "",
                                processCode:
                                    nextStepType === "PROCESSING"
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
                        onChange={(e) =>
                            setRouteForm((current) => ({
                                ...current,
                                locationId: e.target.value,
                            }))
                        }
                        helperText={
                            locationLoadError
                                ? "Location Master could not be loaded."
                                : routeLocationOptions.length === 0
                                    ? `No active ${readable(routeForm.stepType)} location configured${["QC", "PRODUCTION"].includes(normalize(routeForm.stepType)) && projectPlantCode
                                        ? ` for ${projectPlantCode}`
                                        : ""
                                    }.`
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
                        ) : (
                            routeLocationOptions.map((location) => (
                                <MenuItem key={location.id} value={location.id}>
                                    {location.locationCode} · {location.locationName} · {location.plantCode}
                                    {normalize(location.locationType) === "EXTERNAL_PROCESSOR"
                                        ? " · External Processor"
                                        : ""}
                                </MenuItem>
                            ))
                        )}
                    </TextField>
                    {routeForm.stepType === "PROCESSING" && <TextField label="Process Code *" value={routeForm.processCode} onChange={(e) => setRouteForm((c) => ({ ...c, processCode: e.target.value }))} sx={fieldSx} />}
                    <TextField type="number" label="Expected Yield %" value={routeForm.expectedYieldPercent} onChange={(e) => setRouteForm((c) => ({ ...c, expectedYieldPercent: e.target.value }))} sx={fieldSx} />
                    <TextField multiline minRows={2} label="Remarks" value={routeForm.remarks} onChange={(e) => setRouteForm((c) => ({ ...c, remarks: e.target.value }))} sx={{ ...fieldSx, gridColumn: "1 / -1" }} />
                </Box></DialogContent>
                <DialogActions sx={dialogActionsSx}><Button onClick={() => setRouteDialog(null)} sx={secondaryBtnSx}>Cancel</Button><Button onClick={saveRoute} disabled={working} sx={primaryBtnSx}>Save Route</Button></DialogActions>
            </Dialog>
        </Box>
    );
}
