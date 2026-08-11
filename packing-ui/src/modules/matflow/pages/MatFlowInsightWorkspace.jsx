import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Box,
    Button,
    Card,
    Collapse,
    IconButton,
    LinearProgress,
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useNavigate, useParams } from "react-router-dom";
import { useMatFlow } from "../matflowUi";
import { extractMatFlowPage, matflowApi, readMatFlowError } from "../api/matflowApi";
import {
    EmptyState,
    ErrorBox,
    LoadingBlock,
    MatFlowStatusChip,
    MatFlowPagination,
    PageHero,
    SummaryCard,
    clean,
    fieldSx,
    formatDate,
    formatQty,
    formatDurationMinutes,
    TimingHealthChip,
    TrackerTimingStrip,
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

const STAGES = [
    ["Project Portfolio", "Client Project → one or many Products/Items → Director product approval", "/matflow/projects"],
    ["Operational BOMs", "Engineering BOM → Production technical review → Director final approval", "/matflow/boms"],
    ["Production Requisitions", "Product/BOM material demand raised by Production", "/matflow/production"],
    ["Store", "Inventory check → reservation → shortage identification → first QC hand-off", "/matflow/store"],
    ["Purchase", "Shortage-only branch: Indent → PO → approval → GRN", "/matflow/purchase"],
    ["QC", "Inspect each received lot and choose Direct to Production or one approved Processing Unit", "/matflow/qc"],
    ["Processing", "Optional preprocessing only for lots explicitly routed by QC", "/matflow/processing"],
    ["Production", "Explicit issue → Production start → consumption/returns → finished-product completion", "/matflow/production-execution"],
    ["Ledger & Audit", "Immutable stock movements, custody, actor/time and workflow trace", "/matflow/ledger"],
];

const TRACKER_FLOW = [
    { key: "DEMAND", label: "Demand", caption: "Production requisition" },
    { key: "STORE", label: "Store", caption: "Review & reserve" },
    { key: "PURCHASE", label: "Purchase", caption: "Only when short" },
    { key: "ROUTE", label: "Route", caption: "QC / Processing" },
    { key: "PRODUCTION", label: "Production", caption: "Issue & consume" },
    { key: "COMPLETE", label: "Complete", caption: "Finished product" },
];

const TRACKER_STAGE_BUCKET = {
    DRAFT: "DEMAND",
    AWAITING_STORE_PLANNING: "STORE",
    SHORTAGE_PENDING: "PURCHASE",
    MATERIAL_RESERVED: "ROUTE",
    TRANSFER_IN_PROGRESS: "ROUTE",
    QC_PENDING: "ROUTE",
    QC_ROUTING_PENDING: "ROUTE",
    PROCESSING: "ROUTE",
    READY_TO_ISSUE: "ROUTE",
    PRODUCTION_ISSUE: "PRODUCTION",
    PRODUCTION_IN_PROGRESS: "PRODUCTION",
    PRODUCTION_COMPLETED: "COMPLETE",
};

const trackerStageIndex = (stage) => {
    if (normalize(stage) === "CANCELLED") return -1;
    const bucket = TRACKER_STAGE_BUCKET[normalize(stage)] || "DEMAND";
    return Math.max(0, TRACKER_FLOW.findIndex((item) => item.key === bucket));
};

const trackerHealth = (row) => {
    const currentStage = normalize(row?.currentStage);
    if (currentStage === "PRODUCTION_COMPLETED") return { label: "Completed", tone: "success" };
    if (currentStage === "CANCELLED") return { label: "Cancelled", tone: "muted" };
    const timing = normalize(row?.timingHealth);
    if (["BREACHED", "COMPLETED_LATE"].includes(timing)) return { label: readable(timing), tone: "danger" };
    if (timing === "WATCH") return { label: "SLA Watch", tone: "warning" };
    if (timing === "ON_TRACK") return { label: "On Track", tone: "success" };
    const age = Math.max(0, Number(row?.ageHours || 0));
    if (age >= 72) return { label: "Ageing 72h+", tone: "danger" };
    if (age >= 24) return { label: "Ageing 24h+", tone: "warning" };
    return { label: "Fresh <24h", tone: "success" };
};


const sumTrackerField = (rows, field) =>
    rows.reduce((total, row) => total + numeric(row?.[field]), 0);

const isCancelledTrackerRow = (row) =>
    normalize(row?.currentStage) === "CANCELLED" ||
    normalize(row?.requisitionStatus) === "CANCELLED";

const productExecutionState = (product, trackerRowsByProduct) => {
    const key = String(product?.id || "");
    const allRows = key ? (trackerRowsByProduct.get(key) || []) : [];
    const rows = allRows.filter((row) => !isCancelledTrackerRow(row));
    const latest = rows[0] || allRows[0] || null;

    const requestedQty = sumTrackerField(rows, "requestedQty");
    const reservedQty = sumTrackerField(rows, "reservedQty");
    const shortageQty = sumTrackerField(rows, "shortageQty");
    const issuedQty = sumTrackerField(rows, "issuedQty");
    const consumedQty = sumTrackerField(rows, "consumedQty");
    const returnedQty = sumTrackerField(rows, "returnedQty");

    const coveredQty = Math.max(reservedQty, issuedQty, consumedQty);
    const materialCoveragePercent = requestedQty > 0
        ? Math.min(100, Math.round((coveredQty / requestedQty) * 1000) / 10)
        : 0;

    const completed =
        rows.length > 0 &&
        rows.every((row) =>
            normalize(row?.currentStage || row?.requisitionStatus) ===
            "PRODUCTION_COMPLETED"
        );

    return {
        ...product,
        requestedQty,
        reservedQty,
        shortageQty,
        issuedQty,
        consumedQty,
        returnedQty,
        materialCoveragePercent,
        requisitionCount: rows.length,
        latestRequisitionId:
            latest?.requisitionId || product?.latestRequisitionId || null,
        latestRequisitionNumber:
            latest?.requisitionNumber || product?.latestRequisitionNumber || null,
        requisitionStatus:
            latest?.requisitionStatus || product?.requisitionStatus || null,
        currentStage:
            latest?.currentStage || product?.currentStage || null,
        currentDepartment:
            latest?.currentDepartment ||
            product?.currentDepartment ||
            (normalize(product?.approvalStatus) !== "APPROVED"
                ? "DIRECTOR APPROVAL"
                : product?.latestBomId
                    ? "READY FOR EXECUTION"
                    : "ENGINEERING / BOM"),
        _trackerRows: rows,
        _latestTrackerRow: latest,
        _completed: completed,
    };
};

const projectDepartment = (products, fallback) => {
    const departments = Array.from(
        new Set(
            products
                .map((product) => clean(product?._latestTrackerRow?.currentDepartment))
                .filter(Boolean)
                .map((value) => normalize(value))
        )
    );

    if (departments.length === 0) {
        return fallback || "PROJECT SETUP";
    }

    if (departments.length === 1) {
        return departments[0];
    }

    return `MULTI-DEPARTMENT (${departments.length})`;
};

const projectExecutionHealth = (project, products) => {
    if (project?.active === false) return "INACTIVE";
    if (products.length === 0) return "SETUP";

    const completedCount = products.filter((product) => product._completed).length;
    if (completedCount === products.length) return "COMPLETED";

    if (products.some((product) => numeric(product.shortageQty) > 0)) {
        return "SHORTAGE_RISK";
    }

    const timingRisk = products.some((product) =>
        ["BREACHED", "COMPLETED_LATE"].includes(
            normalize(product?._latestTrackerRow?.timingHealth)
        )
    );
    if (timingRisk) return "SLA_RISK";

    if (normalize(project?.health) === "OVERDUE") return "OVERDUE";

    if (products.some((product) => normalize(product?.approvalStatus) !== "APPROVED")) {
        return "APPROVAL_PENDING";
    }

    if (products.some((product) => !product?.latestBomId)) {
        return "BOM_PENDING";
    }

    if (products.some((product) => product?._latestTrackerRow)) {
        return "ON_TRACK";
    }

    return normalize(project?.health) || "READY";
};

const healthSx = (tone) => ({
    px: 1.05,
    py: .4,
    borderRadius: 999,
    fontSize: 10.5,
    fontWeight: 900,
    letterSpacing: .25,
    border: tone === "danger"
        ? "1px solid var(--mf-danger-border)"
        : tone === "warning"
            ? "1px solid var(--mf-warning-border)"
            : tone === "muted"
                ? "1px solid var(--mf-border)"
                : "1px solid var(--mf-success-border)",
    color: tone === "danger"
        ? "var(--mf-danger-text)"
        : tone === "warning"
            ? "var(--mf-warning-text)"
            : tone === "muted"
                ? "var(--mf-text-muted)"
                : "var(--mf-success-text)",
    background: tone === "danger"
        ? "var(--mf-danger-soft)"
        : tone === "warning"
            ? "var(--mf-warning-soft)"
            : tone === "muted"
                ? "var(--mf-surface)"
                : "var(--mf-success-soft)",
});

const trackerNextAction = (row) => {
    switch (normalize(row?.currentStage)) {
        case "DRAFT": return "Complete and submit the Production material requisition.";
        case "AWAITING_STORE_PLANNING": return "Store must review availability and reserve verified stock.";
        case "SHORTAGE_PENDING": return "Close shortage procurement while available stock follows the Production decision.";
        case "MATERIAL_RESERVED": return "Dispatch reserved Store stock to the QC gate.";
        case "TRANSFER_IN_PROGRESS": return "Execute the current physical material hand-off and receipt.";
        case "QC_PENDING": return "QC must inspect the received material and record accepted / rejected quantity.";
        case "QC_ROUTING_PENDING": return "QC must choose Direct to Production or an approved Processing Unit for the accepted lot.";
        case "PROCESSING": return "The selected Processing Unit must execute the preprocessing job and release output toward Production.";
        case "READY_TO_ISSUE": return "The controlled route is complete. Store must explicitly issue material to Production.";
        case "PRODUCTION_ISSUE": return "Complete the Production hand-off and start execution.";
        case "PRODUCTION_IN_PROGRESS": return "Record consumption / returns and complete the finished product.";
        case "PRODUCTION_COMPLETED": return "Material execution is complete and fully traceable.";
        case "CANCELLED": return "This requisition is cancelled.";
        default: return "Open the workflow to inspect the current operational action.";
    }
};

const trackerActionTarget = (row) => {
    const id = row?.requisitionId || row?.id;
    switch (normalize(row?.currentStage)) {
        case "AWAITING_STORE_PLANNING":
        case "MATERIAL_RESERVED":
        case "SHORTAGE_PENDING":
        case "READY_TO_ISSUE":
            return { label: "Open Store Workbench", path: `/matflow/store/requisitions/${id}` };
        case "TRANSFER_IN_PROGRESS":
            return { label: "Open Transfer Desk", path: "/matflow/transfers" };
        case "QC_PENDING":
        case "QC_ROUTING_PENDING":
            return { label: "Open QC Gate", path: "/matflow/qc" };
        case "PROCESSING":
            return { label: "Open Processing", path: "/matflow/processing" };
        case "PRODUCTION_ISSUE":
        case "PRODUCTION_IN_PROGRESS":
            return { label: "Open Production Execution", path: "/matflow/production-execution" };
        default:
            return { label: "Open Workflow", path: `/matflow/requisitions/${id}` };
    }
};

const trackerLaneState = (row, laneIndex) => {
    if (normalize(row?.currentStage) === "CANCELLED") return "SKIPPED";
    const currentIndex = trackerStageIndex(row?.currentStage);
    const hasShortagePath = Number(row?.shortageQty || 0) > 0 || Number(row?.openIndentCount || 0) > 0;

    if (laneIndex === 2 && !hasShortagePath) return "SKIPPED";
    if (laneIndex < currentIndex) return "DONE";
    if (laneIndex === currentIndex) return "CURRENT";
    return "NEXT";
};

const trackerLaneCount = (rows, key) => rows.filter((row) => {
    const stage = normalize(row?.currentStage);
    return stage !== "CANCELLED"
        && (TRACKER_STAGE_BUCKET[stage] || "DEMAND") === key;
}).length;

export function MatFlowDashboardPage() {
    const navigate = useNavigate();
    const { selectedPlantParam } = useMatFlow();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const load = useCallback(async () => { setLoading(true); setError(""); try { setData((await matflowApi.dashboardReport({ plantCode: selectedPlantParam }))?.data || null); } catch (e) { setError(readMatFlowError(e, "Unable to load MatFlow dashboard.")); } finally { setLoading(false); } }, [selectedPlantParam]);
    useEffect(() => { load(); }, [load]);
    const totals = data?.totals || {};
    const cards = [
        ["Active Projects", totals.activeProjects], ["Effective BOMs", totals.effectiveBoms], ["Open Requisitions", totals.openRequisitions], ["Shortage Requisitions", totals.shortageRequisitions], ["Ready Transfers", totals.readyOutboundTransfers], ["Pending QC", totals.pendingQcInspections], ["Processing Jobs", totals.activeProcessingJobs], ["Open Purchase Orders", totals.openPurchaseOrders]
    ];
    return <Box sx={pageSx}><PageHero badge="MATFLOW CONTROL CENTER" title="Material Planning & Execution" subtitle="Project → Products → Engineering BOM → Production + Director approval → Production requisition → Store → Purchase shortage branch → QC → optional Processing → Production completion, with one stock ledger and audit trail." actions={<Box sx={{ display: "flex", gap: .7, flexWrap: "wrap" }}>
        <Button onClick={() => navigate("/matflow/tracker/materials")} sx={primaryBtnSx}>Material Control Tower</Button>
        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
    </Box>} /><ErrorBox>{error}</ErrorBox>{loading ? <LoadingBlock /> : <><Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 1 }}>{cards.map(([label, value]) => <SummaryCard key={label} label={label} value={value ?? 0} colorful />)}</Box><Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 1 }}>{STAGES.map(([title, subtitle, path], index) => <Card key={title} sx={panelSx}><Typography sx={subTextSx}>STEP {index + 1}</Typography><Typography sx={{ fontSize: 17, fontWeight: 950, mt: .5 }}>{title}</Typography><Typography sx={{ ...subTextSx, minHeight: 32 }}>{subtitle}</Typography><Button fullWidth endIcon={<ArrowForwardIcon />} onClick={() => navigate(path)} sx={{ ...primaryBtnSx, mt: 1.5 }}>Open</Button></Card>)}</Box></>}</Box>;
}

export function MatFlowTrackerPage() {
    const navigate = useNavigate();
    const { selectedPlantParam } = useMatFlow();
    const [portfolio, setPortfolio] = useState([]);
    const [tracker, setTracker] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [health, setHealth] = useState("");
    const [expandedProjects, setExpandedProjects] = useState({});
    const [expandedProducts, setExpandedProducts] = useState({});
    const [materialDetails, setMaterialDetails] = useState({});
    const [materialLoading, setMaterialLoading] = useState({});

    const isProjectExpanded = useCallback(
        (projectId) => expandedProjects[String(projectId)] === true,
        [expandedProjects]
    );

    const expandProject = useCallback((projectId) => {
        const key = String(projectId);
        setExpandedProjects((current) => ({
            ...current,
            [key]: true,
        }));
    }, []);

    const collapseProject = useCallback((projectId) => {
        const key = String(projectId);
        setExpandedProjects((current) => ({
            ...current,
            [key]: false,
        }));
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [projectsResponse, trackerResponse] = await Promise.all([
                // Canonical Project -> Products hierarchy.
                // Do NOT use listProjects() here: that method is intentionally a
                // flat Product/Drawing compatibility view for legacy consumers.
                matflowApi.listProjectPortfolio({
                    search: clean(search) || undefined,
                    active: true,
                    plantCode: selectedPlantParam || undefined,
                }),
                matflowApi.getTracker({
                    search: clean(search) || undefined,
                    plantCode: selectedPlantParam,
                }),
            ]);
            setPortfolio(Array.isArray(projectsResponse?.data) ? projectsResponse.data : []);
            setTracker(trackerResponse?.data || null);
        } catch (requestError) {
            setPortfolio([]);
            setTracker(null);
            setError(readMatFlowError(requestError, "Unable to load Project → Product → Material tracker."));
        } finally {
            setLoading(false);
        }
    }, [search, selectedPlantParam]);

    useEffect(() => { load(); }, [load]);

    const trackerRows = Array.isArray(tracker?.rows) ? tracker.rows : [];

    const trackerRowsByProduct = useMemo(() => {
        const grouped = new Map();

        trackerRows.forEach((row) => {
            if (!row?.projectDrawingId) return;
            const key = String(row.projectDrawingId);
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(row);
        });

        grouped.forEach((rowsForProduct) => {
            rowsForProduct.sort((left, right) => {
                const leftTime = new Date(
                    left?.updatedAt || left?.stageStartedAt || left?.requestedAt || 0
                ).getTime();
                const rightTime = new Date(
                    right?.updatedAt || right?.stageStartedAt || right?.requestedAt || 0
                ).getTime();
                return rightTime - leftTime;
            });
        });

        return grouped;
    }, [trackerRows]);

    const trackerByProduct = useMemo(() => {
        const latest = new Map();
        trackerRowsByProduct.forEach((rowsForProduct, key) => {
            if (rowsForProduct.length) latest.set(key, rowsForProduct[0]);
        });
        return latest;
    }, [trackerRowsByProduct]);

    /*
     * The portfolio owns structure; tracker rows own live execution.
     * Merge them by the Product/Drawing UUID so setup-only Products remain
     * visible even before their first requisition, while active Products show
     * real quantities, custody and completion.
     */
    const livePortfolio = useMemo(() => {
        return portfolio.map((project) => {
            const products = (Array.isArray(project?.products) ? project.products : [])
                .map((product) => productExecutionState(product, trackerRowsByProduct));

            const productCount = products.length;
            const completedProductCount = products.filter((product) => product._completed).length;
            const shortageProductCount = products.filter(
                (product) => numeric(product.shortageQty) > 0
            ).length;

            const requestedQty = products.reduce(
                (total, product) => total + numeric(product.requestedQty),
                0
            );
            const coveredQty = products.reduce(
                (total, product) =>
                    total +
                    Math.max(
                        numeric(product.reservedQty),
                        numeric(product.issuedQty),
                        numeric(product.consumedQty)
                    ),
                0
            );
            const materialCoveragePercent = requestedQty > 0
                ? Math.min(100, Math.round((coveredQty / requestedQty) * 1000) / 10)
                : 0;

            return {
                ...project,
                products,
                productCount,
                approvedProductCount: products.filter(
                    (product) => normalize(product.approvalStatus) === "APPROVED"
                ).length,
                completedProductCount,
                shortageProductCount,
                materialCoveragePercent,
                currentDepartment: projectDepartment(
                    products,
                    project?.currentDepartment
                ),
                health: projectExecutionHealth(project, products),
            };
        });
    }, [portfolio, trackerRowsByProduct]);

    const projects = useMemo(() => {
        if (!health) return livePortfolio;
        return livePortfolio.filter(
            (project) => normalize(project.health) === normalize(health)
        );
    }, [livePortfolio, health]);

    const projectPagination = useMatFlowPagination(projects, 10);

    const projectKpis = useMemo(() => {
        const products = livePortfolio.flatMap((project) =>
            Array.isArray(project.products) ? project.products : []
        );
        const complete = products.filter((product) => product._completed).length;
        const shortage = products.filter(
            (product) => numeric(product.shortageQty) > 0
        ).length;
        const awaitingApproval = products.filter(
            (product) => normalize(product.approvalStatus) !== "APPROVED"
        ).length;
        const activeMaterials = trackerRows.reduce(
            (total, row) =>
                total +
                Number(row.reservationCount || 0) +
                Number(row.openIndentCount || 0),
            0
        );

        return {
            projects: livePortfolio.length,
            products: products.length,
            complete,
            shortage,
            awaitingApproval,
            activeMaterials,
        };
    }, [livePortfolio, trackerRows]);

    const healthOptions = useMemo(
        () => [
            "",
            ...Array.from(
                new Set(
                    livePortfolio
                        .map((project) => normalize(project.health))
                        .filter(Boolean)
                )
            ).sort(),
        ],
        [livePortfolio]
    );

    const pipeline = useMemo(() => TRACKER_FLOW.map((lane) => ({
        ...lane,
        count: trackerLaneCount(trackerRows, lane.key),
    })), [trackerRows]);

    const loadMaterialDetail = useCallback(async (product) => {
        const key = String(product?.id || "");
        if (!key) return;

        setExpandedProducts((current) => ({ ...current, [key]: !current[key] }));
        if (materialDetails[key] || materialLoading[key]) return;

        const productTrackerRows = Array.isArray(product?._trackerRows)
            ? product._trackerRows
            : (trackerRowsByProduct.get(key) || []).filter(
                (row) => !isCancelledTrackerRow(row)
            );
        const requisitionIds = Array.from(new Set([
            ...productTrackerRows.map((row) => row?.requisitionId).filter(Boolean),
            product?.latestRequisitionId,
        ].filter(Boolean).map(String)));

        if (requisitionIds.length === 0) return;

        setMaterialLoading((current) => ({ ...current, [key]: true }));

        try {
            const detailResults = await Promise.all(
                requisitionIds.map(async (requisitionId) => {
                    try {
                        return (await matflowApi.getTrackerDetail(requisitionId))?.data || null;
                    } catch {
                        return null;
                    }
                })
            );

            const details = detailResults.filter(Boolean);
            const materials = details.flatMap((detail) => {
                const requisitionNumber =
                    detail?.summary?.requisitionNumber ||
                    detail?.summary?.referenceNumber ||
                    "-";

                return (Array.isArray(detail?.materials) ? detail.materials : []).map(
                    (material) => ({
                        ...material,
                        requisitionId: detail?.summary?.requisitionId || null,
                        requisitionNumber,
                    })
                );
            });

            setMaterialDetails((current) => ({
                ...current,
                [key]: {
                    details,
                    materials,
                    requisitionCount: details.length,
                },
            }));
        } catch (requestError) {
            setError(
                readMatFlowError(
                    requestError,
                    "Unable to load the Product's material-level tracker details."
                )
            );
        } finally {
            setMaterialLoading((current) => ({ ...current, [key]: false }));
        }
    }, [materialDetails, materialLoading, trackerRowsByProduct]);

    return <Box sx={pageSx}>
        <PageHero
            badge="PROJECT → PRODUCT → MATERIAL CONTROL TOWER"
            title="Project Material Tracker"
            subtitle="The primary MatFlow tracker is project-centric: each client Project contains its Products/Drawings, and every Product expands to its live material positions, department custody, elapsed stage time, shortage/procurement exposure and next operational action."
            actions={<Box sx={{ display: "flex", gap: .7, flexWrap: "wrap" }}>
                <Button onClick={() => navigate("/matflow/tracker/materials")} sx={primaryBtnSx}>Material Control Tower</Button>
                <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
            </Box>}
        />
        <ErrorBox>{error}</ErrorBox>

        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 1 }}>
            <SummaryCard label="Client Projects" value={projectKpis.projects} colorful />
            <SummaryCard label="Products / Items" value={projectKpis.products} colorful />
            <SummaryCard label="Products Completed" value={projectKpis.complete} colorful />
            <SummaryCard label="Shortage Exposed" value={projectKpis.shortage} colorful />
            <SummaryCard label="Approval Pending" value={projectKpis.awaitingApproval} colorful />
            <SummaryCard label="Live Material Controls" value={projectKpis.activeMaterials} colorful />
        </Box>

        <Card sx={{ ...panelSx, p: 0, overflow: "hidden" }}>
            <Box sx={{ px: 1.8, pt: 1.6, pb: 1.2, borderBottom: "1px solid var(--mf-border)" }}>
                <Typography sx={{ fontSize: 17, fontWeight: 950 }}>Execution Pipeline</Typography>
                <Typography sx={subTextSx}>Count of active product-material requisitions at each control point.</Typography>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", md: "repeat(6,minmax(0,1fr))" } }}>
                {pipeline.map((lane, index) => <Box key={lane.key} sx={{ px: 1.5, py: 1.45, borderRight: { xs: "none", md: index < pipeline.length - 1 ? "1px solid var(--mf-border)" : "none" }, borderBottom: { xs: "1px solid var(--mf-border)", md: "none" } }}>
                    <Typography sx={{ ...subTextSx, fontSize: 10 }}>0{index + 1} · {lane.label.toUpperCase()}</Typography>
                    <Typography sx={{ fontSize: 24, fontWeight: 950, lineHeight: 1.15, mt: .35 }}>{lane.count}</Typography>
                    <Typography sx={{ ...subTextSx, mt: .2 }}>{lane.caption}</Typography>
                </Box>)}
            </Box>
        </Card>

        <Card sx={panelSx}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 230px" }, gap: 1 }}>
                <TextField label="Search Client / Project / Product / Drawing" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} sx={fieldSx} />
                <TextField select label="Project Health" value={health} onChange={(e) => setHealth(e.target.value)} sx={fieldSx}>
                    {healthOptions.map((value) => <MenuItem key={value || "ALL"} value={value}>{value ? readable(value) : "All Health States"}</MenuItem>)}
                </TextField>
            </Box>
        </Card>

        {loading ? <LoadingBlock /> : projects.length === 0 ? <Card sx={panelSx}><EmptyState>No Project portfolio matches the selected filters.</EmptyState></Card> : <Box sx={{ display: "grid", gap: 1.25 }}>
            {projectPagination.pageItems.map((project) => {
                const productRows = Array.isArray(project.products) ? project.products : [];
                const projectProgress = project.productCount > 0
                    ? Math.round((Number(project.completedProductCount || 0) / Number(project.productCount)) * 100)
                    : 0;
                const projectHealth = normalize(project.health);
                const healthTone = projectHealth === "COMPLETED" || projectHealth === "ON_TRACK"
                    ? "success"
                    : ["SHORTAGE_RISK", "OVERDUE"].includes(projectHealth) ? "danger" : "warning";
                const projectExpanded = isProjectExpanded(project.id);

                return <Card key={project.id} sx={{ ...panelSx, p: 0, overflow: "hidden" }}>
                    <Box
                        role={!projectExpanded ? "button" : undefined}
                        tabIndex={!projectExpanded ? 0 : undefined}
                        aria-expanded={projectExpanded}
                        aria-controls={`matflow-project-${project.id}`}
                        onClick={() => {
                            if (!projectExpanded) expandProject(project.id);
                        }}
                        onKeyDown={(event) => {
                            if (!projectExpanded && (event.key === "Enter" || event.key === " ")) {
                                event.preventDefault();
                                expandProject(project.id);
                            }
                        }}
                        sx={{
                            px: 1.8,
                            py: 1.55,
                            background: "linear-gradient(105deg,var(--mf-primary-soft),var(--mf-panel-solid) 58%,var(--mf-surface))",
                            borderBottom: projectExpanded ? "1px solid var(--mf-border)" : "none",
                            cursor: projectExpanded ? "default" : "pointer",
                            transition: "background .18s ease, box-shadow .18s ease",
                            "&:hover": !projectExpanded ? {
                                background: "linear-gradient(105deg,var(--mf-primary-soft),var(--mf-surface) 58%,var(--mf-panel-solid))",
                                boxShadow: "inset 0 0 0 1px var(--mf-border-strong)",
                            } : undefined,
                            "&:focus-visible": !projectExpanded ? {
                                outline: "2px solid var(--mf-primary)",
                                outlineOffset: "-2px",
                            } : undefined,
                        }}
                    >
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0,1.4fr) repeat(4,minmax(130px,.45fr))" }, gap: 1, alignItems: "center" }}>
                            <Box>
                                <Typography sx={{ ...subTextSx, fontSize: 10, letterSpacing: .6 }}>CLIENT PROJECT</Typography>
                                <Typography sx={{ fontSize: 21, fontWeight: 950 }}>{project.projectCode || "-"} · {project.projectName || "Project"}</Typography>
                                <Typography sx={{ ...mainTextSx, mt: .25 }}>{project.clientName || "-"}</Typography>
                            </Box>
                            <Box><Typography sx={subTextSx}>PLANT</Typography><Typography sx={mainTextSx}>{project.plantCode || "-"}</Typography></Box>
                            <Box><Typography sx={subTextSx}>PRODUCTS</Typography><Typography sx={mainTextSx}>{project.completedProductCount || 0}/{project.productCount || 0} complete</Typography></Box>
                            <Box><Typography sx={subTextSx}>CURRENT DEPARTMENT</Typography><Typography sx={mainTextSx}>{readable(project.currentDepartment || "-")}</Typography></Box>
                            <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: .7, flexWrap: "wrap" }}>
                                <Box sx={healthSx(healthTone)}>{readable(project.health || "SETUP")}</Box>
                                {projectExpanded && (
                                    <IconButton
                                        aria-label={`Collapse project ${project.projectCode || project.projectName || ""}`}
                                        title="Collapse project"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            collapseProject(project.id);
                                        }}
                                        size="small"
                                        sx={{
                                            width: 32,
                                            height: 32,
                                            border: "1px solid var(--mf-border-strong)",
                                            borderRadius: 1.5,
                                            color: "var(--mf-text)",
                                            background: "var(--mf-panel-solid)",
                                            "&:hover": {
                                                background: "var(--mf-surface)",
                                            },
                                        }}
                                    >
                                        <ExpandLessIcon fontSize="small" />
                                    </IconButton>
                                )}
                            </Box>
                        </Box>
                        <Collapse in={projectExpanded} timeout="auto" unmountOnExit>
                            <Box sx={{ mt: 1.1, display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr auto" }, gap: 1, alignItems: "center" }}>
                                <Box>
                                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}><Typography sx={subTextSx}>Project completion</Typography><Typography sx={mainTextSx}>{projectProgress}%</Typography></Box>
                                    <LinearProgress variant="determinate" value={projectProgress} sx={{ mt: .45, height: 7, borderRadius: 999 }} />
                                </Box>
                                <Box sx={{ display: "flex", gap: .7, flexWrap: "wrap" }}>
                                    <Typography sx={subTextSx}>Material coverage {formatQty(project.materialCoveragePercent)}%</Typography>
                                    <Typography sx={subTextSx}>· Required {project.requiredDate || "Not set"}</Typography>
                                    <Typography sx={subTextSx}>· Priority {readable(project.priority || "NORMAL")}</Typography>
                                </Box>
                            </Box>
                        </Collapse>
                    </Box>

                    <Collapse in={projectExpanded} timeout="auto" unmountOnExit>
                        <Box
                            id={`matflow-project-${project.id}`}
                            sx={{ p: 1.35, display: "grid", gap: 1 }}
                        >
                            {productRows.length === 0 ? <EmptyState>No Products/Items have been added to this Project.</EmptyState> : productRows.map((product) => {
                                const key = String(product.id);
                                const productTrackerRows = Array.isArray(product._trackerRows)
                                    ? product._trackerRows
                                    : (trackerRowsByProduct.get(key) || []).filter(
                                        (row) => !isCancelledTrackerRow(row)
                                    );
                                const live = product._latestTrackerRow || trackerByProduct.get(key);
                                const detail = materialDetails[key];
                                const materials = Array.isArray(detail?.materials) ? detail.materials : [];
                                const requisitionCount = Number(product.requisitionCount ?? productTrackerRows.length ?? 0);
                                const stageProgress = product._completed
                                    ? 100
                                    : live
                                        ? Math.max(0, Math.min(100, Number(live.actualProgressPercent ?? live.progressPercent ?? 0)))
                                        : 0;
                                const action = live ? trackerActionTarget(live) : null;

                                return <Box key={product.id} sx={{ border: "1px solid var(--mf-border)", borderRadius: 2, overflow: "hidden", background: "var(--mf-panel-solid)" }}>
                                    <Box sx={{ p: 1.2, display: "grid", gridTemplateColumns: { xs: "1fr", xl: "minmax(220px,1.1fr) 150px 160px minmax(190px,.8fr) 130px auto" }, gap: 1, alignItems: "center" }}>
                                        <Box>
                                            <Typography sx={{ ...subTextSx, fontSize: 9.5 }}>PRODUCT / ITEM · DRAWING</Typography>
                                            <Typography sx={{ fontSize: 16, fontWeight: 950 }}>{product.productName || "-"}</Typography>
                                            <Typography sx={subTextSx}>{product.drawingNo || "-"} · Rev {product.drawingRevision ?? "0"}</Typography>
                                        </Box>
                                        <Box><Typography sx={subTextSx}>PRODUCT APPROVAL</Typography><MatFlowStatusChip status={product.approvalStatus} /></Box>
                                        <Box><Typography sx={subTextSx}>BOM</Typography><Typography sx={mainTextSx}>{product.latestBomNumber || "Not created"}</Typography><Typography sx={subTextSx}>{product.latestBomStatus ? `${readable(product.latestBomStatus)} · Rev ${product.latestBomRevision ?? "-"}` : "Engineering pending"}</Typography></Box>
                                        <Box>
                                            <Typography sx={subTextSx}>LIVE CONTROL POINT</Typography>
                                            <Typography sx={mainTextSx}>{readable(product.currentDepartment || live?.currentDepartment || "ENGINEERING / BOM")}</Typography>
                                            <Typography sx={subTextSx}>{live?.currentLocationCode || live?.currentLocationName || (live ? "Location pending" : "No material requisition yet")}</Typography>
                                        </Box>
                                        <Box><Typography sx={subTextSx}>STATUS</Typography><MatFlowStatusChip status={product.currentStage || live?.currentStage || product.requisitionStatus || live?.requisitionStatus || product.latestBomStatus || product.approvalStatus} /></Box>
                                        <Box sx={{ display: "flex", gap: .6, flexWrap: "wrap", justifyContent: { xs: "flex-start", xl: "flex-end" } }}>
                                            {requisitionCount > 0 && <Button onClick={() => loadMaterialDetail(product)} sx={secondaryBtnSx}>{expandedProducts[key] ? "Hide Materials" : `Materials (${requisitionCount} req.)`}</Button>}
                                            {product.latestRequisitionId && <Button onClick={() => navigate(`/matflow/tracker/${product.latestRequisitionId}`)} sx={secondaryBtnSx}>Latest Trace</Button>}
                                            {action && <Button endIcon={<ArrowForwardIcon />} onClick={() => navigate(action.path)} sx={primaryBtnSx}>Act</Button>}
                                        </Box>
                                    </Box>

                                    <Box sx={{ px: 1.2, pb: 1.15 }}>
                                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", md: "repeat(6,minmax(0,1fr))" }, gap: .65 }}>
                                            {[["Requested", product.requestedQty], ["Reserved", product.reservedQty], ["Shortage", product.shortageQty], ["Issued", product.issuedQty], ["Consumed", product.consumedQty], ["Progress", `${stageProgress}%`]].map(([label, value]) => <Box key={label} sx={{ p: .75, borderRadius: 1.5, background: "var(--mf-surface)", border: "1px solid var(--mf-border)" }}><Typography sx={{ ...subTextSx, fontSize: 9 }}>{label}</Typography><Typography sx={{ fontSize: 14, fontWeight: 950 }}>{typeof value === "string" ? value : formatQty(value)}</Typography></Box>)}
                                        </Box>
                                        {live && <Box sx={{ mt: .75, display: "flex", gap: .7, alignItems: "center", flexWrap: "wrap" }}>
                                            <TimingHealthChip health={live.timingHealth} />
                                            <Typography sx={subTextSx}>Stage {formatDurationMinutes(live.stageDurationMinutes || 0)}</Typography>
                                            <Typography sx={subTextSx}>· Total lead {formatDurationMinutes(live.totalLeadTimeMinutes || 0)}</Typography>
                                            {live.bottleneckHint && <Typography sx={subTextSx}>· {live.bottleneckHint}</Typography>}
                                            {live.nextDepartment && <Typography sx={subTextSx}>· Next → {live.nextDepartment}{live.nextLocationCode ? ` / ${live.nextLocationCode}` : ""}</Typography>}
                                        </Box>}
                                    </Box>

                                    {expandedProducts[key] && <Box sx={{ borderTop: "1px solid var(--mf-border)", background: "var(--mf-surface)" }}>
                                        {materialLoading[key] ? <LoadingBlock /> : !detail ? <Box sx={{ p: 1.2 }}><Typography sx={subTextSx}>Material trace could not be loaded.</Typography></Box> : <>
                                            <Box sx={{ px: 1.2, py: 1, display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                                                <Box><Typography sx={{ fontSize: 14, fontWeight: 950 }}>Material Position Board</Typography><Typography sx={subTextSx}>Exact material custody and next destination across every active/non-cancelled requisition currently returned for this Product.</Typography></Box>
                                                <Typography sx={subTextSx}>{materials.length} tracked material position(s) · {detail?.requisitionCount || requisitionCount} requisition(s)</Typography>
                                            </Box>
                                            <Box sx={tableShellSx}>
                                                <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "145px 170px 80px 80px 80px 160px 145px 145px 140px 110px" }}>
                                                    {["Requisition", "Material", "Req", "Res", "Short", "Current Department", "Location", "Movement", "Next", "Action"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                                                </Box>
                                                {materials.length === 0 ? <EmptyState>No material position rows are available.</EmptyState> : materials.map((material, materialIndex) => <Box key={`${material.requisitionId || "req"}:${material.requisitionLineId || material.materialId || materialIndex}:${material.reservationId || "none"}`} sx={{ ...tableRowSx, gridTemplateColumns: "145px 170px 80px 80px 80px 160px 145px 145px 140px 110px" }}>
                                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{material.requisitionNumber || "-"}</Typography></Box>
                                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{material.currentMaterialCode || material.bomMaterialCode || "-"}</Typography><Typography sx={subTextSx}>{material.materialName || "-"}{material.materialCategory ? ` · ${readable(material.materialCategory)}` : ""} · {material.uom || ""}</Typography></Box>
                                                    <Box sx={tableCellSx}>{formatQty(material.requestedQty)}</Box>
                                                    <Box sx={tableCellSx}>{formatQty(material.reservedQty)}</Box>
                                                    <Box sx={tableCellSx}>{formatQty(material.shortageQty)}</Box>
                                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{material.currentDepartment || "-"}</Typography><Typography sx={subTextSx}>{material.activeReferenceNumber || material.activeReferenceType || ""}</Typography></Box>
                                                    <Box sx={tableCellSx}>{material.currentLocationCode || material.currentLocationName || "-"}</Box>
                                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{readable(material.movementState)}</Typography><Typography sx={subTextSx}>{material.lastMovedAt ? formatDate(material.lastMovedAt) : "-"}</Typography></Box>
                                                    <Box sx={tableCellSx}>{material.nextDepartment || "-"}{material.nextLocationCode ? ` / ${material.nextLocationCode}` : ""}</Box>
                                                    <Box sx={tableCellSx}>{material.materialId ? <Button onClick={() => navigate(`/matflow/tracker/materials/${material.materialId}`)} sx={secondaryBtnSx}>Track</Button> : "-"}</Box>
                                                </Box>)}
                                            </Box>
                                        </>}
                                    </Box>}
                                </Box>;
                            })}
                        </Box>
                    </Collapse>
                </Card>;
            })}
            <MatFlowPagination
                {...projectPagination}
                onPageChange={projectPagination.setPage}
                onPageSizeChange={projectPagination.setPageSize}
                pageSizeOptions={[5, 10, 20]}
                label="Client Projects"
            />
        </Box>}
    </Box>;
}

export function MatFlowTrackerDetailPage() {
    const { requisitionId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        if (!requisitionId) return;
        setLoading(true); setError("");
        try { setData((await matflowApi.getTrackerDetail(requisitionId))?.data || null); }
        catch (e) { setError(readMatFlowError(e, "Unable to load professional tracker detail.")); }
        finally { setLoading(false); }
    }, [requisitionId]);
    useEffect(() => { load(); }, [load]);

    if (loading) return <LoadingBlock />;
    const summary = data?.summary || {};
    const cycle = data?.cycle || {};
    const stages = Array.isArray(data?.stages) ? data.stages : [];
    const operations = Array.isArray(data?.operations) ? data.operations : [];
    const materials = Array.isArray(data?.materials) ? data.materials : [];
    const events = Array.isArray(data?.events) ? data.events : [];
    const action = trackerActionTarget(summary);

    return <Box sx={pageSx}>
        <PageHero
            badge="PROJECT + MATERIAL CONTROL TOWER"
            title={`${summary.projectCode || "Project"} · ${summary.drawingNo || "-"}`}
            subtitle={`${summary.requisitionNumber || "-"} · ${summary.bomNumber || "-"} Rev ${summary.bomRevisionNo ?? "-"}`}
            actions={<><Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button><Button onClick={() => navigate("/matflow/tracker")} sx={secondaryBtnSx}>Back to Tracker</Button><Button endIcon={<ArrowForwardIcon />} onClick={() => navigate(action.path)} sx={primaryBtnSx}>{action.label}</Button></>}
        />
        <ErrorBox>{error}</ErrorBox>

        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 1 }}>
            <SummaryCard label="Current Department" value={summary.currentDepartment || summary.responsibleDesk || "-"} />
            <SummaryCard label="Current Location" value={summary.currentLocationCode || summary.currentLocationName || "-"} />
            <SummaryCard label="Stage Time" value={formatDurationMinutes(summary.stageDurationMinutes || 0)} />
            <SummaryCard label="Total Lead Time" value={formatDurationMinutes(summary.totalLeadTimeMinutes || 0)} />
            <SummaryCard label="Progress" value={`${summary.actualProgressPercent ?? summary.progressPercent ?? 0}%`} />
            <SummaryCard label="SLA Breaches" value={cycle.slaBreachedStageCount ?? 0} />
        </Box>

        <Card sx={panelSx}>
            <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center", flexWrap: "wrap", mb: 1.2 }}>
                <Box><Typography sx={{ fontSize: 17, fontWeight: 950 }}>Live Control Point</Typography><Typography sx={subTextSx}>Exact owner, custody location, elapsed time and next hand-off.</Typography></Box>
                <TimingHealthChip health={summary.timingHealth} />
            </Box>
            <TrackerTimingStrip startAt={summary.stageStartedAt} endAt={summary.stageEndedAt} durationMinutes={summary.stageDurationMinutes} targetMinutes={summary.targetMinutes} health={summary.timingHealth} department={summary.currentDepartment} location={summary.currentLocationCode || summary.currentLocationName} />
            <Box sx={{ mt: 1, p: 1, borderRadius: 1.5, border: "1px solid var(--mf-border)", display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
                <Box><Typography sx={subTextSx}>NEXT DEPARTMENT / LOCATION</Typography><Typography sx={mainTextSx}>{summary.nextDepartment || "-"}{summary.nextLocationCode ? ` · ${summary.nextLocationCode}` : ""}</Typography></Box>
                <Box><Typography sx={subTextSx}>BOTTLENECK SIGNAL</Typography><Typography sx={mainTextSx}>{summary.bottleneckHint || cycle.bottleneckStage || "No active breach"}</Typography></Box>
            </Box>
        </Card>

        <Card sx={panelSx}>
            <Typography sx={{ fontSize: 17, fontWeight: 950 }}>Stage Cycle Timeline</Typography>
            <Typography sx={{ ...subTextSx, mb: 1.2 }}>Start, finish, cycle time, operational target and responsible department for each major project/material stage.</Typography>
            <Box sx={{ display: "grid", gap: .8 }}>
                {stages.map((s, index) => <Box key={`${s.key}-${index}`} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "42px minmax(180px,1.3fr) minmax(130px,.8fr) minmax(180px,1fr) 120px 120px" }, gap: .8, alignItems: "center", p: 1, border: "1px solid var(--mf-border)", borderRadius: 1.5, background: normalize(s.state) === "CURRENT" ? "var(--mf-primary-soft)" : "var(--mf-surface)" }}>
                    <Box sx={{ width: 30, height: 30, borderRadius: 999, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 950, border: "1px solid var(--mf-border-strong)" }}>{index + 1}</Box>
                    <Box><Typography sx={mainTextSx}>{s.label}</Typography><Typography sx={subTextSx}>{s.department}{s.locationCode ? ` · ${s.locationCode}` : ""} · {readable(s.state)}</Typography></Box>
                    <Box><Typography sx={subTextSx}>OWNER</Typography><Typography sx={mainTextSx}>{s.actor || s.department || "-"}</Typography></Box>
                    <Box><Typography sx={subTextSx}>START → END</Typography><Typography sx={mainTextSx}>{s.startedAt ? formatDate(s.startedAt) : "Not started"}</Typography><Typography sx={subTextSx}>{s.endedAt ? `End ${formatDate(s.endedAt)}` : s.startedAt ? "Running" : "Waiting"}</Typography></Box>
                    <Box><Typography sx={subTextSx}>CYCLE TIME</Typography><Typography sx={mainTextSx}>{formatDurationMinutes(s.durationMinutes || 0)}</Typography>{Number(s.targetMinutes || 0) > 0 && <Typography sx={subTextSx}>Target {formatDurationMinutes(s.targetMinutes)}</Typography>}</Box>
                    <TimingHealthChip health={s.timingHealth} />
                </Box>)}
            </Box>
        </Card>

        <Card sx={panelSx}>
            <Typography sx={{ fontSize: 17, fontWeight: 950 }}>Material Position Board</Typography>
            <Typography sx={{ ...subTextSx, mb: 1 }}>Every reserved or shortage quantity shows its actual department/location, movement state and next hand-off.</Typography>
            <Box sx={tableShellSx}>
                <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "180px 95px 120px 170px 170px 145px 160px" }}>{["Material", "Tracked Qty", "State", "Current Department / Location", "Next", "Last Movement", "Reference"].map(h => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>
                {materials.length === 0 ? <EmptyState>No material positions are available.</EmptyState> : materials.map((m, index) => <Box key={`${m.requisitionLineId}-${m.reservationId || index}`} sx={{ ...tableRowSx, gridTemplateColumns: "180px 95px 120px 170px 170px 145px 160px" }}>
                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{m.currentMaterialCode || m.bomMaterialCode || "-"}</Typography><Typography sx={subTextSx}>{m.materialName || "-"}</Typography></Box>
                    <Box sx={tableCellSx}>{formatQty(m.trackedQty)} {m.uom || ""}</Box>
                    <Box sx={tableCellSx}><MatFlowStatusChip status={m.movementState} /></Box>
                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{m.currentDepartment || "-"}</Typography><Typography sx={subTextSx}>{m.currentLocationCode || m.currentLocationName || "-"}</Typography></Box>
                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{m.nextDepartment || "-"}</Typography><Typography sx={subTextSx}>{m.nextLocationCode || "-"}</Typography></Box>
                    <Box sx={tableCellSx}>{m.lastMovedAt ? formatDate(m.lastMovedAt) : "-"}</Box>
                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{readable(m.activeReferenceType)}</Typography><Typography sx={subTextSx}>{m.activeReferenceNumber || "-"}</Typography></Box>
                </Box>)}
            </Box>
        </Card>

        <Card sx={panelSx}>
            <Typography sx={{ fontSize: 17, fontWeight: 950 }}>Operational Timing Detail</Typography>
            <Typography sx={{ ...subTextSx, mb: 1 }}>Transfer legs, QC gates, processing jobs, procurement events and Store issue timing.</Typography>
            <Box sx={tableShellSx}>
                <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "190px 150px 160px 160px 110px 125px 180px" }}>{["Operation", "Department / Location", "Started", "Ended", "Duration", "Timing", "Reference"].map(h => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>
                {operations.length === 0 ? <EmptyState>No detailed operations recorded.</EmptyState> : operations.map((op, index) => <Box key={`${op.referenceId || op.key}-${index}`} sx={{ ...tableRowSx, gridTemplateColumns: "190px 150px 160px 160px 110px 125px 180px" }}>
                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{op.label}</Typography><Typography sx={subTextSx}>{readable(op.state)}</Typography></Box>
                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{op.department || "-"}</Typography><Typography sx={subTextSx}>{op.locationCode || "-"}</Typography></Box>
                    <Box sx={tableCellSx}>{op.startedAt ? formatDate(op.startedAt) : "-"}</Box>
                    <Box sx={tableCellSx}>{op.endedAt ? formatDate(op.endedAt) : normalize(op.state) === "CURRENT" ? "Running" : "-"}</Box>
                    <Box sx={tableCellSx}>{formatDurationMinutes(op.durationMinutes || 0)}</Box>
                    <Box sx={tableCellSx}><TimingHealthChip health={op.timingHealth} /></Box>
                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{op.referenceNumber || "-"}</Typography><Typography sx={subTextSx}>{op.actor ? `By ${op.actor}` : readable(op.referenceType)}</Typography></Box>
                </Box>)}
            </Box>
        </Card>

        <Card sx={panelSx}>
            <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap", mb: 1 }}>
                <Box><Typography sx={{ fontSize: 17, fontWeight: 950 }}>Cycle & Bottleneck Analysis</Typography><Typography sx={subTextSx}>Executive lead-time view generated from real workflow timestamps.</Typography></Box>
                <MatFlowStatusChip status={cycle.completed ? "COMPLETED" : summary.currentStage} />
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: .8 }}>
                <SummaryCard label="Project Lead" value={formatDurationMinutes(cycle.totalProjectLeadTimeMinutes || 0)} />
                <SummaryCard label="Requisition Lead" value={formatDurationMinutes(cycle.requisitionLeadTimeMinutes || 0)} />
                <SummaryCard label="Avg Completed Stage" value={formatDurationMinutes(cycle.averageCompletedStageMinutes || 0)} />
                <SummaryCard label="Completed Stages" value={`${cycle.completedStageCount || 0}/${cycle.applicableStageCount || 0}`} />
                <SummaryCard label="Longest Stage" value={cycle.bottleneckStage || "-"} />
                <SummaryCard label="Longest Duration" value={formatDurationMinutes(cycle.bottleneckMinutes || 0)} />
            </Box>
        </Card>

        <Card sx={panelSx}>
            <Typography sx={{ fontSize: 17, fontWeight: 950 }}>Immutable Workflow Event Log</Typography>
            <Typography sx={{ ...subTextSx, mb: 1 }}>Audit events are the traceability proof behind the tracker timing.</Typography>
            <Box sx={tableShellSx}>
                <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 180px 150px 160px minmax(240px,1fr)" }}>{["Time", "Action", "Actor", "Entity", "Details"].map(h => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>
                {events.length === 0 ? <EmptyState>No audit events were found for this workflow.</EmptyState> : [...events].reverse().map((event) => <Box key={event.id} sx={{ ...tableRowSx, gridTemplateColumns: "170px 180px 150px 160px minmax(240px,1fr)" }}>
                    <Box sx={tableCellSx}>{formatDate(event.actionAt)}</Box>
                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{readable(event.action)}</Typography></Box>
                    <Box sx={tableCellSx}>{event.actor || "-"}</Box>
                    <Box sx={tableCellSx}>{readable(event.entityType)}</Box>
                    <Box sx={{ ...tableCellSx, whiteSpace: "normal", wordBreak: "break-word" }}>{event.detailsJson || "-"}</Box>
                </Box>)}
            </Box>
        </Card>
    </Box>;
}



export function MatFlowLedgerPage() {
    const { selectedPlantParam } = useMatFlow();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [movementType, setMovementType] = useState("");

    const ledgerPagination = useMatFlowPagination(rows, 20);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await matflowApi.stockLedger({
                plantCode: selectedPlantParam,
                movementType: movementType || undefined,
                search: clean(search) || undefined,
                page: 0,
                size: 250,
            });
            setRows(extractMatFlowPage(response?.data).rows);
        } catch (requestError) {
            setRows([]);
            setError(readMatFlowError(requestError, "Unable to load stock ledger."));
        } finally {
            setLoading(false);
        }
    }, [selectedPlantParam, movementType, search]);

    useEffect(() => { load(); }, [load]);

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="IMMUTABLE STOCK LEDGER"
                title="Stock Ledger"
                subtitle="Quantity, reservation, blocked and in-transit deltas generated by MatFlow transactions."
                actions={<Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>}
            />
            <ErrorBox>{error}</ErrorBox>
            <Card sx={panelSx}>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 230px" }, gap: 1 }}>
                    <TextField label="Search" value={search} onChange={e => setSearch(e.target.value)} sx={fieldSx} />
                    <TextField label="Movement Type" value={movementType} onChange={e => setMovementType(normalize(e.target.value))} sx={fieldSx} />
                </Box>
            </Card>
            <Card sx={panelSx}>
                {loading ? <LoadingBlock /> : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 160px 140px 100px 100px 100px 170px 150px" }}>
                            {["Material", "Location", "Movement", "Qty Δ", "Reserved Δ", "Blocked Δ", "Reference", "Actor / Time"].map(h => <Box key={h} sx={tableCellSx}>{h}</Box>)}
                        </Box>
                        {rows.length === 0 ? <EmptyState /> : ledgerPagination.pageItems.map((row, index) => (
                            <Box key={row.id || index} sx={{ ...tableRowSx, gridTemplateColumns: "170px 160px 140px 100px 100px 100px 170px 150px" }}>
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialCode}</Typography><Typography sx={subTextSx}>{row.materialName}</Typography></Box>
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.locationCode}</Typography><Typography sx={subTextSx}>{row.plantCode}</Typography></Box>
                                <Box sx={tableCellSx}>{readable(row.movementType)}</Box>
                                <Box sx={tableCellSx}>{formatQty(row.quantityChange)}</Box>
                                <Box sx={tableCellSx}>{formatQty(row.reservedChange)}</Box>
                                <Box sx={tableCellSx}>{formatQty(row.blockedChange)}</Box>
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.referenceNumber || row.referenceType}</Typography><Typography sx={subTextSx}>{row.projectCode || "-"} · {row.drawingNo || "-"}</Typography></Box>
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.actor || "-"}</Typography><Typography sx={subTextSx}>{formatDate(row.actionAt)}</Typography></Box>
                            </Box>
                        ))}
                    </Box>
                )}
                {!loading && (
                    <MatFlowPagination
                        {...ledgerPagination}
                        onPageChange={ledgerPagination.setPage}
                        onPageSizeChange={ledgerPagination.setPageSize}
                        label="Ledger Movements"
                    />
                )}
            </Card>
        </Box>
    );
}

export function MatFlowReportsPage() {
    const { selectedPlantParam } = useMatFlow();
    const [shortages, setShortages] = useState([]);
    const [audits, setAudits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [minimumAgeDays, setMinimumAgeDays] = useState(0);

    const shortagePagination = useMatFlowPagination(shortages, 20);
    const auditPagination = useMatFlowPagination(audits, 20);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [shortageResponse, auditResponse] = await Promise.all([
                matflowApi.shortageReport({ plantCode: selectedPlantParam, minimumAgeDays }),
                matflowApi.auditLogs({ plantCode: selectedPlantParam, page: 0, size: 250 }),
            ]);
            setShortages(Array.isArray(shortageResponse?.data) ? shortageResponse.data : []);
            setAudits(extractMatFlowPage(auditResponse?.data).rows);
        } catch (requestError) {
            setShortages([]);
            setAudits([]);
            setError(readMatFlowError(requestError, "Unable to load MatFlow reports."));
        } finally {
            setLoading(false);
        }
    }, [selectedPlantParam, minimumAgeDays]);

    useEffect(() => { load(); }, [load]);

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="MATFLOW REPORTING"
                title="Operational Reports"
                subtitle="Shortage ageing and centralized audit trail from the backend reporting authority."
                actions={<Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>}
            />
            <ErrorBox>{error}</ErrorBox>
            <Card sx={panelSx}>
                <TextField
                    type="number"
                    label="Minimum Shortage Age (days)"
                    value={minimumAgeDays}
                    onChange={e => setMinimumAgeDays(Math.max(0, Number(e.target.value || 0)))}
                    sx={{ ...fieldSx, minWidth: 260 }}
                />
            </Card>

            {loading ? <LoadingBlock /> : (
                <>
                    <Card sx={panelSx}>
                        <Typography sx={{ fontWeight: 950, mb: 1 }}>Shortage Ageing</Typography>
                        <Box sx={tableShellSx}>
                            <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 170px 180px 110px 110px 120px 100px" }}>
                                {["Requisition", "Project / Drawing", "Material", "Requested", "Reserved", "Shortage", "Age"].map(h => <Box key={h} sx={tableCellSx}>{h}</Box>)}
                            </Box>
                            {shortages.length === 0 ? (
                                <EmptyState>No shortages match the selected age.</EmptyState>
                            ) : shortagePagination.pageItems.map((row, index) => (
                                <Box key={row.requisitionLineId || index} sx={{ ...tableRowSx, gridTemplateColumns: "170px 170px 180px 110px 110px 120px 100px" }}>
                                    <Box sx={tableCellSx}>{row.requisitionNumber}</Box>
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.projectCode}</Typography><Typography sx={subTextSx}>{row.drawingNo}</Typography></Box>
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialCode}</Typography><Typography sx={subTextSx}>{row.materialName}</Typography></Box>
                                    <Box sx={tableCellSx}>{formatQty(row.requestedQty)}</Box>
                                    <Box sx={tableCellSx}>{formatQty(row.reservedQty)}</Box>
                                    <Box sx={tableCellSx}>{formatQty(row.shortageQty)}</Box>
                                    <Box sx={tableCellSx}>{row.ageDays}d</Box>
                                </Box>
                            ))}
                        </Box>
                        <MatFlowPagination
                            {...shortagePagination}
                            onPageChange={shortagePagination.setPage}
                            onPageSizeChange={shortagePagination.setPageSize}
                            label="Shortage Rows"
                        />
                    </Card>

                    <Card sx={panelSx}>
                        <Typography sx={{ fontWeight: 950, mb: 1 }}>Audit Trail</Typography>
                        <Box sx={tableShellSx}>
                            <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "150px 180px 170px 160px 150px 170px" }}>
                                {["Entity", "Action", "Project / Drawing", "Plant", "Actor", "Time"].map(h => <Box key={h} sx={tableCellSx}>{h}</Box>)}
                            </Box>
                            {audits.length === 0 ? <EmptyState /> : auditPagination.pageItems.map((row, index) => (
                                <Box key={row.id || index} sx={{ ...tableRowSx, gridTemplateColumns: "150px 180px 170px 160px 150px 170px" }}>
                                    <Box sx={tableCellSx}>{row.entityType}</Box>
                                    <Box sx={tableCellSx}>{readable(row.action)}</Box>
                                    <Box sx={tableCellSx}>{row.projectCode || "-"} · {row.drawingNo || "-"}</Box>
                                    <Box sx={tableCellSx}>{row.plantCode || "-"}</Box>
                                    <Box sx={tableCellSx}>{row.actor || "-"}</Box>
                                    <Box sx={tableCellSx}>{formatDate(row.actionAt)}</Box>
                                </Box>
                            ))}
                        </Box>
                        <MatFlowPagination
                            {...auditPagination}
                            onPageChange={auditPagination.setPage}
                            onPageSizeChange={auditPagination.setPageSize}
                            label="Audit Events"
                        />
                    </Card>
                </>
            )}
        </Box>
    );
}



const materialTowerLocation = (code, name, department, state) => {
    if (code || name) return [code, name].filter(Boolean).join(" · ");
    const normalizedState = normalize(state);
    if (["DEMAND_RAISED", "STORE_REVIEW", "STORE_PLANNED_AWAITING_ALLOCATION"].includes(normalizedState)) {
        return "Administrative stage · physical custody not started";
    }
    if (normalizedState === "SUPPLIER_ORDERED") return "Vendor / Supplier";
    if (normalize(department) === "IN_TRANSIT" || normalizedState === "IN_TRANSIT") return "In transit";
    return readable(department || state || "Location pending");
};

const materialTowerMatches = (lot, query) => {
    const q = clean(query).toLowerCase();
    if (!q) return true;
    return [
        lot.projectCode, lot.projectName, lot.clientName, lot.productName, lot.drawingNo,
        lot.bomNumber, lot.requisitionNumber, lot.currentMaterialCode, lot.currentMaterialName,
        lot.currentStage, lot.currentDepartment, lot.currentLocationCode, lot.currentLocationName,
        lot.movementState, lot.previousLocationCode, lot.previousLocationName,
        lot.nextDepartment, lot.nextLocationCode, lot.nextLocationName, lot.activeReferenceNumber,
    ].some((value) => String(value || "").toLowerCase().includes(q));
};

export function MatFlowMaterialTrackerPage() {
    const navigate = useNavigate();
    const { materialId } = useParams();
    const { selectedPlantParam } = useMatFlow();

    const [materials, setMaterials] = useState([]);
    const [selectedId, setSelectedId] = useState(materialId || "");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [materialLoading, setMaterialLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeOnly, setActiveOnly] = useState(false);
    const [search, setSearch] = useState("");
    const [expandedLots, setExpandedLots] = useState({});

    useEffect(() => {
        setSelectedId(materialId || "");
    }, [materialId]);

    const loadMaterials = useCallback(async () => {
        setMaterialLoading(true);
        try {
            const response = await matflowApi.listMaterials({});
            setMaterials(extractMatFlowPage(response?.data).rows);
        } catch (requestError) {
            setMaterials([]);
            setError(readMatFlowError(requestError, "Unable to load the Material Master."));
        } finally {
            setMaterialLoading(false);
        }
    }, []);

    useEffect(() => {
        loadMaterials();
    }, [loadMaterials]);

    const loadTracker = useCallback(async () => {
        if (!selectedId) {
            setData(null);
            return;
        }
        setLoading(true);
        setError("");
        try {
            const response = await matflowApi.getMaterialTracker(selectedId, {
                plantCode: selectedPlantParam || undefined,
                activeOnly,
            });
            setData(response?.data || null);
        } catch (requestError) {
            setData(null);
            setError(readMatFlowError(requestError, "Unable to load the Material Control Tower."));
        } finally {
            setLoading(false);
        }
    }, [selectedId, selectedPlantParam, activeOnly]);

    useEffect(() => {
        loadTracker();
    }, [loadTracker]);

    const lots = Array.isArray(data?.lots) ? data.lots : [];
    const filteredLots = useMemo(
        () => lots.filter((lot) => materialTowerMatches(lot, search)),
        [lots, search]
    );
    const lotPagination = useMatFlowPagination(filteredLots, 10);
    const movementRows = Array.isArray(data?.movementHistory) ? data.movementHistory : [];
    const movementPagination = useMatFlowPagination(movementRows, 20);

    const projectGroups = useMemo(() => {
        const projects = new Map();
        lotPagination.pageItems.forEach((lot) => {
            const projectKey = String(lot.projectId || lot.projectCode || "UNASSIGNED");
            if (!projects.has(projectKey)) {
                projects.set(projectKey, {
                    key: projectKey,
                    projectId: lot.projectId,
                    projectCode: lot.projectCode,
                    projectName: lot.projectName,
                    clientName: lot.clientName,
                    plantCode: lot.plantCode,
                    products: new Map(),
                });
            }
            const project = projects.get(projectKey);
            const productKey = String(lot.productId || `${lot.productName || "-"}:${lot.drawingNo || "-"}`);
            if (!project.products.has(productKey)) {
                project.products.set(productKey, {
                    key: productKey,
                    productId: lot.productId,
                    productName: lot.productName,
                    drawingNo: lot.drawingNo,
                    drawingRevision: lot.drawingRevision,
                    lots: [],
                });
            }
            project.products.get(productKey).lots.push(lot);
        });
        return Array.from(projects.values()).map((project) => ({
            ...project,
            products: Array.from(project.products.values()),
        }));
    }, [lotPagination.pageItems]);

    const kpis = data?.kpis || {};
    const identity = data?.material || {};
    const inventory = Array.isArray(data?.inventory) ? data.inventory : [];

    const changeMaterial = (event) => {
        const nextId = event.target.value;
        setSelectedId(nextId);
        setExpandedLots({});
        if (nextId) navigate(`/matflow/tracker/materials/${nextId}`);
        else navigate("/matflow/tracker/materials");
    };

    const toggleLot = (lotKey) => {
        setExpandedLots((current) => ({
            ...current,
            [lotKey]: !current[lotKey],
        }));
    };

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="DIRECTOR MATERIAL CUSTODY CONTROL"
                title="Material Control Tower"
                subtitle="Track one material across every Project → Product → Requisition allocation: exact current custody, previous location, next hand-off, quantity, elapsed dwell time, SLA health, actors, references and the complete physical/procurement history."
                actions={
                    <Box sx={{ display: "flex", gap: .7, flexWrap: "wrap" }}>
                        <Button onClick={() => navigate("/matflow/tracker")} sx={secondaryBtnSx}>Project Tracker</Button>
                        <Button startIcon={<RefreshIcon />} disabled={!selectedId || loading} onClick={loadTracker} sx={secondaryBtnSx}>Refresh</Button>
                    </Box>
                }
            />

            <ErrorBox>{error}</ErrorBox>

            <Card sx={panelSx}>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(260px,1.2fr) 220px minmax(260px,1fr)" }, gap: 1 }}>
                    <TextField
                        select
                        label="Material to Track"
                        value={selectedId}
                        onChange={changeMaterial}
                        disabled={materialLoading}
                        sx={fieldSx}
                    >
                        <MenuItem value="">Select Material</MenuItem>
                        {materials.map((material) => (
                            <MenuItem key={material.id} value={material.id}>
                                {material.materialCode} · {material.materialName}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        select
                        label="Tracking Scope"
                        value={activeOnly ? "LIVE" : "ALL"}
                        onChange={(event) => setActiveOnly(event.target.value === "LIVE")}
                        sx={fieldSx}
                    >
                        <MenuItem value="ALL">Live + Historical Lots</MenuItem>
                        <MenuItem value="LIVE">Live Lots Only</MenuItem>
                    </TextField>
                    <TextField
                        label="Filter Project / Product / Requisition / Location"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        sx={fieldSx}
                    />
                </Box>
            </Card>

            {!selectedId ? (
                <Card sx={panelSx}>
                    <EmptyState>Select a material such as Veneer, Wood, Stone, Hardware or Upholstery to open its end-to-end custody trace.</EmptyState>
                </Card>
            ) : loading ? (
                <LoadingBlock />
            ) : !data ? (
                <Card sx={panelSx}><EmptyState>No material tracking data is available.</EmptyState></Card>
            ) : (
                <>
                    <Card sx={{ ...panelSx, overflow: "hidden" }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1.2, alignItems: "flex-start", flexWrap: "wrap" }}>
                            <Box>
                                <Typography sx={{ ...subTextSx, fontSize: 10 }}>TRACKING MATERIAL</Typography>
                                <Typography sx={{ fontSize: 22, fontWeight: 950 }}>{identity.materialCode || "-"} · {identity.materialName || "-"}</Typography>
                                <Typography sx={subTextSx}>
                                    {readable(identity.category)} · {identity.specification || "No specification"} · {identity.uom || "-"}
                                    {identity.preferredSupplier ? ` · Preferred supplier: ${identity.preferredSupplier}` : ""}
                                </Typography>
                            </Box>
                            <MatFlowStatusChip status={identity.active === false ? "INACTIVE" : "ACTIVE"} />
                        </Box>
                    </Card>

                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 1 }}>
                        <SummaryCard label="Projects" value={kpis.projectCount || 0} colorful />
                        <SummaryCard label="Products / Drawings" value={kpis.productCount || 0} colorful />
                        <SummaryCard label="Tracked Lots / Branches" value={kpis.trackedLotCount || 0} colorful />
                        <SummaryCard label="Live Lots" value={kpis.liveLotCount || 0} colorful />
                        <SummaryCard label="Delayed / SLA Breach" value={kpis.delayedLotCount || 0} colorful />
                        <SummaryCard label="Requested" value={`${formatQty(kpis.requestedQty)} ${identity.uom || ""}`} colorful />
                        <SummaryCard label="Current Shortage" value={`${formatQty(kpis.shortageQty)} ${identity.uom || ""}`} colorful />
                        <SummaryCard label="On Hand" value={`${formatQty(kpis.onHandQty)} ${identity.uom || ""}`} colorful />
                        <SummaryCard label="Available" value={`${formatQty(kpis.availableQty)} ${identity.uom || ""}`} colorful />
                        <SummaryCard label="Avg Live Dwell" value={formatDurationMinutes(kpis.averageCurrentDwellMinutes || 0)} colorful />
                        <SummaryCard label="Longest Live Dwell" value={formatDurationMinutes(kpis.longestCurrentDwellMinutes || 0)} colorful />
                    </Box>

                    <Card sx={panelSx}>
                        <Box sx={{ mb: 1 }}>
                            <Typography sx={{ fontSize: 17, fontWeight: 950 }}>Physical Inventory Position</Typography>
                            <Typography sx={subTextSx}>All accessible stock locations for this material. This is physical inventory truth; Project/Product allocation lots are shown separately below.</Typography>
                        </Box>
                        <Box sx={tableShellSx}>
                            <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "150px 190px 130px 105px 105px 105px 105px 105px 165px" }}>
                                {["Plant", "Location", "Type", "On Hand", "Reserved", "Blocked", "Transit", "Available", "Updated"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                            </Box>
                            {inventory.length === 0 ? <EmptyState>No stock balance exists for the selected material in the accessible plant scope.</EmptyState> : inventory.map((row) => (
                                <Box key={`${row.locationId}:${row.plantCode}`} sx={{ ...tableRowSx, gridTemplateColumns: "150px 190px 130px 105px 105px 105px 105px 105px 165px" }}>
                                    <Box sx={tableCellSx}>{row.plantCode || "-"}</Box>
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.locationCode || "-"}</Typography><Typography sx={subTextSx}>{row.locationName || "-"}</Typography></Box>
                                    <Box sx={tableCellSx}>{readable(row.locationType)}</Box>
                                    <Box sx={tableCellSx}>{formatQty(row.onHandQty)}</Box>
                                    <Box sx={tableCellSx}>{formatQty(row.reservedQty)}</Box>
                                    <Box sx={tableCellSx}>{formatQty(row.blockedQty)}</Box>
                                    <Box sx={tableCellSx}>{formatQty(row.inTransitQty)}</Box>
                                    <Box sx={tableCellSx}>{formatQty(row.availableQty)}</Box>
                                    <Box sx={tableCellSx}>{formatDate(row.updatedAt)}</Box>
                                </Box>
                            ))}
                        </Box>
                    </Card>

                    <Card sx={{ ...panelSx, p: 0, overflow: "hidden" }}>
                        <Box sx={{ p: 1.6, borderBottom: "1px solid var(--mf-border)" }}>
                            <Typography sx={{ fontSize: 18, fontWeight: 950 }}>Project / Product Material Custody</Typography>
                            <Typography sx={subTextSx}>
                                Each row is a live material trace branch: pre-allocation demand/Store review, a reservation-backed physical lot, or an open Purchase-shortage branch. Current, previous and next positions are derived from the actual Requisition, Store, PO/GRN, QC, Transfer, Processing, Production and Return records.
                            </Typography>
                        </Box>

                        {filteredLots.length === 0 ? (
                            <Box sx={{ p: 1.5 }}><EmptyState>No Project/Product material lots match the selected scope.</EmptyState></Box>
                        ) : projectGroups.map((project) => (
                            <Box key={project.key} sx={{ borderBottom: "1px solid var(--mf-border)" }}>
                                <Box sx={{ px: 1.6, py: 1.25, background: "var(--mf-surface)" }}>
                                    <Typography sx={{ ...subTextSx, fontSize: 9.5 }}>CLIENT PROJECT</Typography>
                                    <Typography sx={{ fontSize: 17, fontWeight: 950 }}>
                                        {project.projectCode || "UNASSIGNED"} · {project.projectName || "Project"}
                                    </Typography>
                                    <Typography sx={subTextSx}>{project.clientName || "-"} · {project.plantCode || "-"}</Typography>
                                </Box>

                                {project.products.map((product) => (
                                    <Box key={product.key} sx={{ px: 1.35, py: 1.15, borderTop: "1px solid var(--mf-border)" }}>
                                        <Box sx={{ mb: 1 }}>
                                            <Typography sx={{ ...subTextSx, fontSize: 9.5 }}>PRODUCT / DRAWING</Typography>
                                            <Typography sx={{ fontSize: 15.5, fontWeight: 950 }}>{product.productName || "-"} · {product.drawingNo || "-"} · Rev {product.drawingRevision ?? "0"}</Typography>
                                        </Box>

                                        <Box sx={{ display: "grid", gap: 1 }}>
                                            {product.lots.map((lot) => {
                                                const expanded = expandedLots[lot.lotKey] === true;
                                                const currentLocation = materialTowerLocation(
                                                    lot.currentLocationCode,
                                                    lot.currentLocationName,
                                                    lot.currentDepartment,
                                                    lot.movementState
                                                );
                                                const previousLocation = materialTowerLocation(
                                                    lot.previousLocationCode,
                                                    lot.previousLocationName,
                                                    lot.previousDepartment,
                                                    lot.previousState
                                                );
                                                const nextLocation = materialTowerLocation(
                                                    lot.nextLocationCode,
                                                    lot.nextLocationName,
                                                    lot.nextDepartment,
                                                    "NEXT"
                                                );
                                                const history = Array.isArray(lot.history) ? lot.history : [];

                                                return (
                                                    <Box key={lot.lotKey} sx={{ border: "1px solid var(--mf-border)", borderRadius: 2, overflow: "hidden", background: "var(--mf-panel-solid)" }}>
                                                        <Box sx={{ p: 1.15, display: "flex", justifyContent: "space-between", gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}>
                                                            <Box>
                                                                <Typography sx={{ fontSize: 14.5, fontWeight: 950 }}>
                                                                    {lot.requisitionNumber || "-"} · {lot.currentMaterialCode || identity.materialCode}
                                                                </Typography>
                                                                <Typography sx={subTextSx}>
                                                                    {lot.sourceBranch === "PURCHASE_SHORTAGE" ? "Open Purchase shortage" : "Reservation lot"}
                                                                    {lot.reservationId ? ` · ${String(lot.reservationId).slice(0, 8)}` : ""}
                                                                    {lot.activeReferenceNumber ? ` · Ref ${lot.activeReferenceNumber}` : ""}
                                                                </Typography>
                                                            </Box>
                                                            <Box sx={{ display: "flex", gap: .6, alignItems: "center", flexWrap: "wrap" }}>
                                                                <MatFlowStatusChip status={lot.movementState || lot.currentStage} />
                                                                <TimingHealthChip health={lot.timingHealth} />
                                                                <Button onClick={() => navigate(`/matflow/tracker/${lot.requisitionId}`)} sx={secondaryBtnSx}>Requisition Trace</Button>
                                                            </Box>
                                                        </Box>

                                                        <Box sx={{ px: 1.15, pb: 1.05, display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4,minmax(0,1fr))" }, gap: .75 }}>
                                                            <Box sx={{ p: .9, borderRadius: 1.5, background: "var(--mf-surface)", border: "1px solid var(--mf-border)" }}>
                                                                <Typography sx={{ ...subTextSx, fontSize: 9 }}>PREVIOUS CUSTODY</Typography>
                                                                <Typography sx={mainTextSx}>{readable(lot.previousDepartment || "Start")}</Typography>
                                                                <Typography sx={subTextSx}>{previousLocation}</Typography>
                                                                <Typography sx={subTextSx}>{lot.previousState ? readable(lot.previousState) : "No earlier custody event"}</Typography>
                                                            </Box>
                                                            <Box sx={{ p: .9, borderRadius: 1.5, background: "var(--mf-surface)", border: "1px solid var(--mf-border)" }}>
                                                                <Typography sx={{ ...subTextSx, fontSize: 9 }}>CURRENT CUSTODY</Typography>
                                                                <Typography sx={mainTextSx}>{readable(lot.currentDepartment || "-")}</Typography>
                                                                <Typography sx={subTextSx}>{currentLocation}</Typography>
                                                                <Typography sx={subTextSx}>Since {lot.enteredCurrentStateAt ? formatDate(lot.enteredCurrentStateAt) : "-"}</Typography>
                                                            </Box>
                                                            <Box sx={{ p: .9, borderRadius: 1.5, background: "var(--mf-surface)", border: "1px solid var(--mf-border)" }}>
                                                                <Typography sx={{ ...subTextSx, fontSize: 9 }}>NEXT HAND-OFF</Typography>
                                                                <Typography sx={mainTextSx}>{readable(lot.nextDepartment || "None")}</Typography>
                                                                <Typography sx={subTextSx}>{nextLocation}</Typography>
                                                                <Typography sx={subTextSx}>{lot.nextAction || "No pending action."}</Typography>
                                                            </Box>
                                                            <Box sx={{ p: .9, borderRadius: 1.5, background: "var(--mf-surface)", border: "1px solid var(--mf-border)" }}>
                                                                <Typography sx={{ ...subTextSx, fontSize: 9 }}>TIME IN CURRENT STATE</Typography>
                                                                <Typography sx={{ fontSize: 17, fontWeight: 950 }}>{lot.completed ? "Closed" : formatDurationMinutes(lot.currentDwellMinutes || 0)}</Typography>
                                                                {Number(lot.currentTargetMinutes || 0) > 0 && <Typography sx={subTextSx}>Target {formatDurationMinutes(lot.currentTargetMinutes)}</Typography>}
                                                                {!lot.completed && Number(lot.currentVarianceMinutes || 0) > 0 && <Typography sx={subTextSx}>Over target by {formatDurationMinutes(lot.currentVarianceMinutes)}</Typography>}
                                                            </Box>
                                                        </Box>

                                                        <Box sx={{ px: 1.15, pb: 1.05 }}>
                                                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", md: "repeat(7,minmax(0,1fr))" }, gap: .6 }}>
                                                                {[
                                                                    ["Tracked", lot.trackedQty],
                                                                    ["Requested", lot.lineRequestedQty],
                                                                    ["Reserved", lot.lineReservedQty],
                                                                    ["Shortage", lot.lineShortageQty],
                                                                    ["Issued", lot.lineIssuedQty],
                                                                    ["Consumed", lot.lineConsumedQty],
                                                                    ["Returned", lot.lineReturnedQty],
                                                                ].map(([label, value]) => (
                                                                    <Box key={label} sx={{ p: .65, borderRadius: 1.3, border: "1px solid var(--mf-border)" }}>
                                                                        <Typography sx={{ ...subTextSx, fontSize: 8.5 }}>{label}</Typography>
                                                                        <Typography sx={{ fontSize: 13, fontWeight: 950 }}>{formatQty(value)} {lot.uom || ""}</Typography>
                                                                    </Box>
                                                                ))}
                                                            </Box>

                                                            {lot.lineLevelPostIssueAggregation && (
                                                                <Box sx={{ mt: .75, p: .8, borderRadius: 1.5, border: "1px solid var(--mf-border)", background: "var(--mf-surface)" }}>
                                                                    <Typography sx={{ fontSize: 11.5, fontWeight: 900 }}>Traceability note</Typography>
                                                                    <Typography sx={subTextSx}>
                                                                        Multiple reservations feed this requisition line. Store issue remains reservation-specific, but current Production consumption/return records are line-level. MatFlow therefore labels the post-issue section as aggregated instead of assigning consumption to the wrong physical reservation.
                                                                    </Typography>
                                                                </Box>
                                                            )}

                                                            <Box sx={{ mt: .8, display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                                                                <Typography sx={subTextSx}>{history.length} custody event(s) recorded for this branch.</Typography>
                                                                <Button onClick={() => toggleLot(lot.lotKey)} sx={secondaryBtnSx}>
                                                                    {expanded ? "Hide Custody Timeline" : "Full Custody Timeline"}
                                                                </Button>
                                                            </Box>
                                                        </Box>

                                                        <Collapse in={expanded}>
                                                            <Box sx={{ borderTop: "1px solid var(--mf-border)", p: 1.05, background: "var(--mf-surface)" }}>
                                                                <Typography sx={{ fontSize: 14, fontWeight: 950, mb: .75 }}>Custody & Stage-Time Timeline</Typography>
                                                                <Box sx={tableShellSx}>
                                                                    <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "55px 170px 175px 155px 165px 165px 120px 130px 180px" }}>
                                                                        {["#", "State / Event", "Department / Location", "Entered", "Exited", "Duration", "SLA", "Actor", "Reference"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                                                                    </Box>
                                                                    {history.length === 0 ? <EmptyState>No custody events have been created for this branch yet.</EmptyState> : history.map((event) => (
                                                                        <Box key={`${lot.lotKey}:${event.sequence}`} sx={{ ...tableRowSx, gridTemplateColumns: "55px 170px 175px 155px 165px 165px 120px 130px 180px" }}>
                                                                            <Box sx={tableCellSx}>{event.sequence}</Box>
                                                                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{event.label || readable(event.state)}</Typography><Typography sx={subTextSx}>{readable(event.state)} · {formatQty(event.quantity)} {lot.uom || ""}</Typography></Box>
                                                                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{readable(event.department || "-")}</Typography><Typography sx={subTextSx}>{materialTowerLocation(event.locationCode, event.locationName, event.department, event.state)}</Typography></Box>
                                                                            <Box sx={tableCellSx}>{formatDate(event.enteredAt)}</Box>
                                                                            <Box sx={tableCellSx}>{event.exitedAt ? formatDate(event.exitedAt) : "Current"}</Box>
                                                                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{formatDurationMinutes(event.durationMinutes || 0)}</Typography>{Number(event.targetMinutes || 0) > 0 && <Typography sx={subTextSx}>Target {formatDurationMinutes(event.targetMinutes)}</Typography>}</Box>
                                                                            <Box sx={tableCellSx}><TimingHealthChip health={event.timingHealth} /></Box>
                                                                            <Box sx={tableCellSx}>{event.actor || "-"}</Box>
                                                                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{event.referenceNumber || event.referenceType || "-"}</Typography><Typography sx={subTextSx}>{event.scope ? readable(event.scope) : ""}</Typography></Box>
                                                                        </Box>
                                                                    ))}
                                                                </Box>
                                                                {history.some((event) => event.note) && (
                                                                    <Box sx={{ mt: .8 }}>
                                                                        {history.filter((event) => event.note).map((event) => (
                                                                            <Typography key={`note:${event.sequence}`} sx={subTextSx}>#{event.sequence} · {event.note}</Typography>
                                                                        ))}
                                                                    </Box>
                                                                )}
                                                            </Box>
                                                        </Collapse>
                                                    </Box>
                                                );
                                            })}
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        ))}

                        <Box sx={{ px: 1.2, pb: 1.2 }}>
                            <MatFlowPagination
                                {...lotPagination}
                                onPageChange={lotPagination.setPage}
                                onPageSizeChange={lotPagination.setPageSize}
                                pageSizeOptions={[5, 10, 20, 50]}
                                label="Material Lots / Branches"
                            />
                        </Box>
                    </Card>

                    <Card sx={panelSx}>
                        <Box sx={{ mb: 1 }}>
                            <Typography sx={{ fontSize: 17, fontWeight: 950 }}>Immutable Material Movement Ledger</Typography>
                            <Typography sx={subTextSx}>Latest stock-ledger movements for this material across the accessible plant scope. Use this as the quantity-level physical audit corroboration for the custody timeline.</Typography>
                        </Box>
                        <Box sx={tableShellSx}>
                            <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "165px 155px 165px 105px 105px 105px 105px 170px 165px 165px" }}>
                                {["Time", "Movement", "Location", "Qty Δ", "Reserved Δ", "Blocked Δ", "Transit Δ", "Project / Drawing", "Reference", "Actor"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                            </Box>
                            {movementRows.length === 0 ? <EmptyState>No stock-ledger movement exists for the selected material.</EmptyState> : movementPagination.pageItems.map((row) => (
                                <Box key={row.ledgerId} sx={{ ...tableRowSx, gridTemplateColumns: "165px 155px 165px 105px 105px 105px 105px 170px 165px 165px" }}>
                                    <Box sx={tableCellSx}>{formatDate(row.actionAt)}</Box>
                                    <Box sx={tableCellSx}><MatFlowStatusChip status={row.movementType} /></Box>
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.locationCode || "-"}</Typography><Typography sx={subTextSx}>{row.locationName || row.plantCode || "-"}</Typography></Box>
                                    <Box sx={tableCellSx}>{formatQty(row.quantityChange)}</Box>
                                    <Box sx={tableCellSx}>{formatQty(row.reservedChange)}</Box>
                                    <Box sx={tableCellSx}>{formatQty(row.blockedChange)}</Box>
                                    <Box sx={tableCellSx}>{formatQty(row.inTransitChange)}</Box>
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.projectCode || "-"}</Typography><Typography sx={subTextSx}>{row.drawingNo || "-"}</Typography></Box>
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.referenceNumber || row.referenceType || "-"}</Typography><Typography sx={subTextSx}>{row.batchNo || ""}</Typography></Box>
                                    <Box sx={tableCellSx}>{row.actor || "-"}</Box>
                                </Box>
                            ))}
                        </Box>
                        <MatFlowPagination
                            {...movementPagination}
                            onPageChange={movementPagination.setPage}
                            onPageSizeChange={movementPagination.setPageSize}
                            label="Movement Ledger Events"
                        />
                    </Card>
                </>
            )}
        </Box>
    );
}
