import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Box,
    Button,
    Card,
    LinearProgress,
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useNavigate, useParams } from "react-router-dom";
import { useMatFlow } from "../matflowUi";
import { extractMatFlowPage, matflowApi, readMatFlowError } from "../api/matflowApi";
import {
    EmptyState,
    ErrorBox,
    LoadingBlock,
    MatFlowStatusChip,
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
} from "../matflowUi";

const STAGES = [
    ["Project Portfolio", "Client Project → Product/Item ownership and Director product approval", "/matflow/projects"],
    ["Operational BOMs", "Engineering BOM → Production technical review → Director final approval", "/matflow/boms"],
    ["Production Requisitions", "Material demand against approved BOM", "/matflow/production"],
    ["Store", "Availability, reservation, shortage and issue", "/matflow/store"],
    ["Transfers", "Approved material route movement", "/matflow/transfers"],
    ["Purchase", "Shortage procurement and vendor control", "/matflow/purchase"],
    ["QC", "Quality inspection + per-lot Direct/Processing route decision", "/matflow/qc"],
    ["Processing", "Optional QC-selected material preprocessing jobs", "/matflow/processing"],
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
    return <Box sx={pageSx}><PageHero badge="MATFLOW CONTROL CENTER" title="Material Planning & Execution" subtitle="Project → Engineering BOM → Production approval → requisition → Store → Purchase/QC → Processing → Production completion, with one stock ledger and audit trail." actions={<Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>} /><ErrorBox>{error}</ErrorBox>{loading ? <LoadingBlock /> : <><Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 1 }}>{cards.map(([label, value]) => <SummaryCard key={label} label={label} value={value ?? 0} colorful />)}</Box><Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 1 }}>{STAGES.map(([title, subtitle, path], index) => <Card key={title} sx={panelSx}><Typography sx={subTextSx}>STEP {index + 1}</Typography><Typography sx={{ fontSize: 17, fontWeight: 950, mt: .5 }}>{title}</Typography><Typography sx={{ ...subTextSx, minHeight: 32 }}>{subtitle}</Typography><Button fullWidth endIcon={<ArrowForwardIcon />} onClick={() => navigate(path)} sx={{ ...primaryBtnSx, mt: 1.5 }}>Open</Button></Card>)}</Box></>}</Box>;
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
    const [expandedProducts, setExpandedProducts] = useState({});
    const [materialDetails, setMaterialDetails] = useState({});
    const [materialLoading, setMaterialLoading] = useState({});

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [projectsResponse, trackerResponse] = await Promise.all([
                matflowApi.listProjectPortfolio({
                    search: clean(search) || undefined,
                    active: true,
                    plantCode: selectedPlantParam,
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
    const trackerByProduct = useMemo(
        () => new Map(trackerRows.map((row) => [String(row.projectDrawingId), row])),
        [trackerRows]
    );

    const projects = useMemo(() => {
        if (!health) return portfolio;
        return portfolio.filter((project) => normalize(project.health) === normalize(health));
    }, [portfolio, health]);

    const projectKpis = useMemo(() => {
        const products = portfolio.flatMap((project) => Array.isArray(project.products) ? project.products : []);
        const complete = products.filter((product) => normalize(product.requisitionStatus) === "PRODUCTION_COMPLETED").length;
        const shortage = products.filter((product) => numeric(product.shortageQty) > 0).length;
        const awaitingApproval = products.filter((product) => normalize(product.approvalStatus) !== "APPROVED").length;
        const activeMaterials = trackerRows.reduce((total, row) => total + Number(row.reservationCount || 0) + Number(row.openIndentCount || 0), 0);
        return {
            projects: portfolio.length,
            products: products.length,
            complete,
            shortage,
            awaitingApproval,
            activeMaterials,
        };
    }, [portfolio, trackerRows]);

    const healthOptions = useMemo(
        () => ["", ...Array.from(new Set(portfolio.map((project) => normalize(project.health)).filter(Boolean))).sort()],
        [portfolio]
    );

    const pipeline = useMemo(() => TRACKER_FLOW.map((lane) => ({
        ...lane,
        count: trackerLaneCount(trackerRows, lane.key),
    })), [trackerRows]);

    const loadMaterialDetail = useCallback(async (product) => {
        const requisitionId = product?.latestRequisitionId;
        if (!requisitionId) return;
        const key = String(product.id);
        setExpandedProducts((current) => ({ ...current, [key]: !current[key] }));
        if (materialDetails[key] || materialLoading[key]) return;
        setMaterialLoading((current) => ({ ...current, [key]: true }));
        try {
            const response = await matflowApi.getTrackerDetail(requisitionId);
            setMaterialDetails((current) => ({ ...current, [key]: response?.data || null }));
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to load material-level tracker detail."));
        } finally {
            setMaterialLoading((current) => ({ ...current, [key]: false }));
        }
    }, [materialDetails, materialLoading]);

    return <Box sx={pageSx}>
        <PageHero
            badge="PROJECT → PRODUCT → MATERIAL CONTROL TOWER"
            title="Project Material Tracker"
            subtitle="The primary MatFlow tracker is project-centric: each client Project contains its Products/Drawings, and every Product expands to its live material positions, department custody, elapsed stage time, shortage/procurement exposure and next operational action."
            actions={<Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>}
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
            {projects.map((project) => {
                const productRows = Array.isArray(project.products) ? project.products : [];
                const projectProgress = project.productCount > 0
                    ? Math.round((Number(project.completedProductCount || 0) / Number(project.productCount)) * 100)
                    : 0;
                const projectHealth = normalize(project.health);
                const healthTone = projectHealth === "COMPLETED" || projectHealth === "ON_TRACK"
                    ? "success"
                    : ["SHORTAGE_RISK", "OVERDUE"].includes(projectHealth) ? "danger" : "warning";

                return <Card key={project.id} sx={{ ...panelSx, p: 0, overflow: "hidden" }}>
                    <Box sx={{ px: 1.8, py: 1.55, background: "linear-gradient(105deg,var(--mf-primary-soft),var(--mf-panel-solid) 58%,var(--mf-surface))", borderBottom: "1px solid var(--mf-border)" }}>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0,1.4fr) repeat(4,minmax(130px,.45fr))" }, gap: 1, alignItems: "center" }}>
                            <Box>
                                <Typography sx={{ ...subTextSx, fontSize: 10, letterSpacing: .6 }}>CLIENT PROJECT</Typography>
                                <Typography sx={{ fontSize: 21, fontWeight: 950 }}>{project.projectCode || "-"} · {project.projectName || "Project"}</Typography>
                                <Typography sx={{ ...mainTextSx, mt: .25 }}>{project.clientName || "-"}</Typography>
                            </Box>
                            <Box><Typography sx={subTextSx}>PLANT</Typography><Typography sx={mainTextSx}>{project.plantCode || "-"}</Typography></Box>
                            <Box><Typography sx={subTextSx}>PRODUCTS</Typography><Typography sx={mainTextSx}>{project.completedProductCount || 0}/{project.productCount || 0} complete</Typography></Box>
                            <Box><Typography sx={subTextSx}>CURRENT DEPARTMENT</Typography><Typography sx={mainTextSx}>{project.currentDepartment || "-"}</Typography></Box>
                            <Box sx={{ display: "flex", justifyContent: "flex-end" }}><Box sx={healthSx(healthTone)}>{readable(project.health)}</Box></Box>
                        </Box>
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
                    </Box>

                    <Box sx={{ p: 1.35, display: "grid", gap: 1 }}>
                        {productRows.length === 0 ? <EmptyState>No Products/Items have been added to this Project.</EmptyState> : productRows.map((product) => {
                            const live = trackerByProduct.get(String(product.id));
                            const key = String(product.id);
                            const detail = materialDetails[key];
                            const materials = Array.isArray(detail?.materials) ? detail.materials : [];
                            const stageProgress = live ? Math.max(0, Math.min(100, Number(live.actualProgressPercent ?? live.progressPercent ?? 0))) : normalize(product.requisitionStatus) === "PRODUCTION_COMPLETED" ? 100 : 0;
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
                                        <Typography sx={mainTextSx}>{live?.currentDepartment || product.currentDepartment || "ENGINEERING / BOM"}</Typography>
                                        <Typography sx={subTextSx}>{live?.currentLocationCode || live?.currentLocationName || (live ? "Location pending" : "No material requisition yet")}</Typography>
                                    </Box>
                                    <Box><Typography sx={subTextSx}>STATUS</Typography><MatFlowStatusChip status={live?.currentStage || live?.requisitionStatus || product.requisitionStatus || product.latestBomStatus || product.approvalStatus} /></Box>
                                    <Box sx={{ display: "flex", gap: .6, flexWrap: "wrap", justifyContent: { xs: "flex-start", xl: "flex-end" } }}>
                                        {product.latestRequisitionId && <Button onClick={() => loadMaterialDetail(product)} sx={secondaryBtnSx}>{expandedProducts[key] ? "Hide Materials" : "Materials"}</Button>}
                                        {product.latestRequisitionId && <Button onClick={() => navigate(`/matflow/tracker/${product.latestRequisitionId}`)} sx={secondaryBtnSx}>Full Trace</Button>}
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
                                            <Box><Typography sx={{ fontSize: 14, fontWeight: 950 }}>Material Position Board</Typography><Typography sx={subTextSx}>Exact material custody and next destination for this Product requisition.</Typography></Box>
                                            <Typography sx={subTextSx}>{materials.length} tracked material line(s)</Typography>
                                        </Box>
                                        <Box sx={tableShellSx}>
                                            <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 90px 90px 90px 170px 160px 160px 150px" }}>
                                                {["Material", "Req", "Res", "Short", "Current Department", "Location", "Movement", "Next"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                                            </Box>
                                            {materials.length === 0 ? <EmptyState>No material position rows are available.</EmptyState> : materials.map((material) => <Box key={material.requisitionLineId || `${material.materialId}:${material.reservationId || "none"}`} sx={{ ...tableRowSx, gridTemplateColumns: "170px 90px 90px 90px 170px 160px 160px 150px" }}>
                                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{material.currentMaterialCode || material.bomMaterialCode || "-"}</Typography><Typography sx={subTextSx}>{material.materialName || "-"}{material.materialCategory ? ` · ${readable(material.materialCategory)}` : ""} · {material.uom || ""}</Typography></Box>
                                                <Box sx={tableCellSx}>{formatQty(material.requestedQty)}</Box>
                                                <Box sx={tableCellSx}>{formatQty(material.reservedQty)}</Box>
                                                <Box sx={tableCellSx}>{formatQty(material.shortageQty)}</Box>
                                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{material.currentDepartment || "-"}</Typography><Typography sx={subTextSx}>{material.activeReferenceNumber || material.activeReferenceType || ""}</Typography></Box>
                                                <Box sx={tableCellSx}>{material.currentLocationCode || material.currentLocationName || "-"}</Box>
                                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{readable(material.movementState)}</Typography><Typography sx={subTextSx}>{material.lastMovedAt ? formatDate(material.lastMovedAt) : "-"}</Typography></Box>
                                                <Box sx={tableCellSx}>{material.nextDepartment || "-"}{material.nextLocationCode ? ` / ${material.nextLocationCode}` : ""}</Box>
                                            </Box>)}
                                        </Box>
                                    </>}
                                </Box>}
                            </Box>;
                        })}
                    </Box>
                </Card>;
            })}
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
    const [rows, setRows] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
    const [search, setSearch] = useState(""), [movementType, setMovementType] = useState("");
    const load = useCallback(async () => { setLoading(true); setError(""); try { const r = await matflowApi.stockLedger({ plantCode: selectedPlantParam, movementType: movementType || undefined, search: clean(search) || undefined, page: 0, size: 100 }); setRows(extractMatFlowPage(r?.data).rows); } catch (e) { setError(readMatFlowError(e, "Unable to load stock ledger.")); } finally { setLoading(false); } }, [selectedPlantParam, movementType, search]);
    useEffect(() => { load(); }, [load]);
    return <Box sx={pageSx}><PageHero badge="IMMUTABLE STOCK LEDGER" title="Stock Ledger" subtitle="Quantity, reservation, blocked and in-transit deltas generated by MatFlow transactions." actions={<Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>} /><ErrorBox>{error}</ErrorBox><Card sx={panelSx}><Box sx={{ display: "grid", gridTemplateColumns: "1fr 230px", gap: 1 }}><TextField label="Search" value={search} onChange={e => setSearch(e.target.value)} sx={fieldSx} /><TextField label="Movement Type" value={movementType} onChange={e => setMovementType(normalize(e.target.value))} sx={fieldSx} /></Box></Card><Card sx={panelSx}>{loading ? <LoadingBlock /> : <Box sx={tableShellSx}><Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 160px 140px 100px 100px 100px 170px 150px" }}>{["Material", "Location", "Movement", "Qty Δ", "Reserved Δ", "Blocked Δ", "Reference", "Actor / Time"].map(h => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>{rows.length === 0 ? <EmptyState /> : rows.map((row, index) => <Box key={row.id || index} sx={{ ...tableRowSx, gridTemplateColumns: "170px 160px 140px 100px 100px 100px 170px 150px" }}><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialCode}</Typography><Typography sx={subTextSx}>{row.materialName}</Typography></Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.locationCode}</Typography><Typography sx={subTextSx}>{row.plantCode}</Typography></Box><Box sx={tableCellSx}>{readable(row.movementType)}</Box><Box sx={tableCellSx}>{formatQty(row.quantityChange)}</Box><Box sx={tableCellSx}>{formatQty(row.reservedChange)}</Box><Box sx={tableCellSx}>{formatQty(row.blockedChange)}</Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.referenceNumber || row.referenceType}</Typography><Typography sx={subTextSx}>{row.projectCode || "-"} · {row.drawingNo || "-"}</Typography></Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.actor || "-"}</Typography><Typography sx={subTextSx}>{formatDate(row.actionAt)}</Typography></Box></Box>)}</Box>}</Card></Box>;
}

export function MatFlowReportsPage() {
    const { selectedPlantParam } = useMatFlow();
    const [shortages, setShortages] = useState([]), [audits, setAudits] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
    const [minimumAgeDays, setMinimumAgeDays] = useState(0);
    const load = useCallback(async () => { setLoading(true); setError(""); try { const [s, a] = await Promise.all([matflowApi.shortageReport({ plantCode: selectedPlantParam, minimumAgeDays }), matflowApi.auditLogs({ plantCode: selectedPlantParam, page: 0, size: 100 })]); setShortages(Array.isArray(s?.data) ? s.data : []); setAudits(extractMatFlowPage(a?.data).rows); } catch (e) { setError(readMatFlowError(e, "Unable to load MatFlow reports.")); } finally { setLoading(false); } }, [selectedPlantParam, minimumAgeDays]);
    useEffect(() => { load(); }, [load]);
    return <Box sx={pageSx}><PageHero badge="MATFLOW REPORTING" title="Operational Reports" subtitle="Shortage ageing and centralized audit trail from the backend reporting authority." actions={<Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>} /><ErrorBox>{error}</ErrorBox><Card sx={panelSx}><TextField type="number" label="Minimum Shortage Age (days)" value={minimumAgeDays} onChange={e => setMinimumAgeDays(Math.max(0, Number(e.target.value || 0)))} sx={{ ...fieldSx, minWidth: 260 }} /></Card>{loading ? <LoadingBlock /> : <><Card sx={panelSx}><Typography sx={{ fontWeight: 950, mb: 1 }}>Shortage Ageing</Typography><Box sx={tableShellSx}><Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 170px 180px 110px 110px 120px 100px" }}>{["Requisition", "Project / Drawing", "Material", "Requested", "Reserved", "Shortage", "Age"].map(h => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>{shortages.length === 0 ? <EmptyState>No shortages match the selected age.</EmptyState> : shortages.map((row, index) => <Box key={row.requisitionLineId || index} sx={{ ...tableRowSx, gridTemplateColumns: "170px 170px 180px 110px 110px 120px 100px" }}><Box sx={tableCellSx}>{row.requisitionNumber}</Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.projectCode}</Typography><Typography sx={subTextSx}>{row.drawingNo}</Typography></Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialCode}</Typography><Typography sx={subTextSx}>{row.materialName}</Typography></Box><Box sx={tableCellSx}>{formatQty(row.requestedQty)}</Box><Box sx={tableCellSx}>{formatQty(row.reservedQty)}</Box><Box sx={tableCellSx}>{formatQty(row.shortageQty)}</Box><Box sx={tableCellSx}>{row.ageDays}d</Box></Box>)}</Box></Card><Card sx={panelSx}><Typography sx={{ fontWeight: 950, mb: 1 }}>Audit Trail</Typography><Box sx={tableShellSx}><Box sx={{ ...tableHeaderSx, gridTemplateColumns: "150px 180px 170px 160px 150px 170px" }}>{["Entity", "Action", "Project / Drawing", "Plant", "Actor", "Time"].map(h => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>{audits.length === 0 ? <EmptyState /> : audits.map((row, index) => <Box key={row.id || index} sx={{ ...tableRowSx, gridTemplateColumns: "150px 180px 170px 160px 150px 170px" }}><Box sx={tableCellSx}>{row.entityType}</Box><Box sx={tableCellSx}>{readable(row.action)}</Box><Box sx={tableCellSx}>{row.projectCode || "-"} · {row.drawingNo || "-"}</Box><Box sx={tableCellSx}>{row.plantCode || "-"}</Box><Box sx={tableCellSx}>{row.actor || "-"}</Box><Box sx={tableCellSx}>{formatDate(row.actionAt)}</Box></Box>)}</Box></Card></>}</Box>;
}
