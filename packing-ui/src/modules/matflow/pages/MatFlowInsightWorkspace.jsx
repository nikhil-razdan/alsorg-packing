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
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useNavigate, useParams } from "react-router-dom";
import { useMatFlow } from "../matflowUi";
import { extractMatFlowPage, matflowApi, readMatFlowError } from "../api/matflowApi";
import { downloadMatFlowExcel } from ".../api/matflowExcel";
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


const DASHBOARD_DECISION_REASON_KEYS = [
    "reason",
    "remarks",
    "remark",
    "comments",
    "comment",
    "decisionReason",
    "decisionRemarks",
    "returnReason",
    "rejectionReason",
    "cancelReason",
    "cancellationReason",
    "releaseReason",
    "deleteReason",
    "adjustmentReason",
    "holdReason",
    "note",
    "notes",
];

const dashboardAuditDetails = (detailsJson) => {
    if (!detailsJson) return {};
    if (typeof detailsJson === "object") return detailsJson;
    try {
        const parsed = JSON.parse(String(detailsJson));
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
};

const dashboardReasonFromDetails = (details, depth = 0) => {
    if (!details || typeof details !== "object" || depth > 2) return "";

    for (const key of DASHBOARD_DECISION_REASON_KEYS) {
        const value = details?.[key];
        if (value != null && typeof value !== "object" && clean(value)) {
            return clean(value);
        }
    }

    for (const [key, value] of Object.entries(details)) {
        if (value == null || typeof value === "object") continue;
        const normalizedKey = normalize(key);
        if (
            normalizedKey.includes("REASON") ||
            normalizedKey.includes("REMARK") ||
            normalizedKey.includes("COMMENT") ||
            normalizedKey.includes("NOTE")
        ) {
            const cleaned = clean(value);
            if (cleaned) return cleaned;
        }
    }

    for (const value of Object.values(details)) {
        if (value && typeof value === "object") {
            const nested = dashboardReasonFromDetails(value, depth + 1);
            if (nested) return nested;
        }
    }

    return "";
};

const dashboardReasonForAudit = (audit) =>
    dashboardReasonFromDetails(dashboardAuditDetails(audit?.detailsJson));

const dashboardDecisionNeedsReason = (action) => {
    const value = normalize(action);
    return [
        "RETURN",
        "REJECT",
        "CANCEL",
        "DELETE",
        "RELEASE",
        "ADJUST",
        "HOLD",
        "OVERRIDE",
        "REOPEN",
        "VOID",
    ].some((token) => value.includes(token));
};

const dashboardTimestamp = (value) => {
    if (!value) return 0;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
};

const dashboardPercent = (value, total) =>
    total > 0 ? `${Math.round((value / total) * 100)}%` : "—";

const dashboardScopeKey = (projectCode, drawingNo) =>
    `${clean(projectCode).toUpperCase()}|${clean(drawingNo).toUpperCase()}`;

const dashboardTrackerSeverity = (row) => {
    const health = normalize(row?.timingHealth);
    if (["BREACHED", "COMPLETED_LATE"].includes(health)) return 1000;
    if (numeric(row?.shortageQty) > 0) return 900;
    if (health === "WATCH") return 800;
    if (numeric(row?.openIndentCount) > 0) return 700;
    if (numeric(row?.openTransferCount) > 0) return 600;
    return Math.min(500, numeric(row?.ageHours));
};

const dashboardTrackerIsLive = (row) => {
    const stage = normalize(row?.currentStage || row?.requisitionStatus);
    return !["CANCELLED", "PRODUCTION_COMPLETED", "COMPLETED", "CLOSED"].includes(stage);
};

const dashboardLocationLabel = (row) => {
    const code = clean(row?.currentLocationCode);
    const name = clean(row?.currentLocationName);
    if (code || name) return [code, name].filter(Boolean).join(" · ");
    const department = clean(row?.currentDepartment || row?.responsibleDesk);
    return department ? readable(department) : "Custody pending";
};

const dashboardNextLabel = (row) => {
    const department = clean(row?.nextDepartment);
    const code = clean(row?.nextLocationCode);
    const name = clean(row?.nextLocationName);
    const place = [code, name].filter(Boolean).join(" · ");
    if (department && place) return `${readable(department)} · ${place}`;
    if (department) return readable(department);
    if (place) return place;
    return "No pending hand-off";
};

const dashboardAccentForTone = (tone) => ({
    red: "#ef4444",
    amber: "#f59e0b",
    orange: "#f97316",
    green: "#22c55e",
    blue: "#3b82f6",
    indigo: "#6366f1",
    sky: "#0ea5e9",
    purple: "#8b5cf6",
}[tone] || "#3b82f6");

function DashboardSectionHeading({ eyebrow, title, subtitle, action }) {
    return (
        <Box sx={{
            mb: 1.1,
            display: "flex",
            justifyContent: "space-between",
            gap: 1.5,
            alignItems: "flex-start",
            flexWrap: "wrap",
        }}>
            <Box sx={{ minWidth: 0 }}>
                {eyebrow && (
                    <Typography sx={{
                        ...subTextSx,
                        fontSize: 9.5,
                        fontWeight: 950,
                        letterSpacing: ".085em",
                        textTransform: "uppercase",
                    }}>
                        {eyebrow}
                    </Typography>
                )}
                <Typography sx={{ fontSize: 17.5, fontWeight: 950, mt: eyebrow ? .2 : 0 }}>
                    {title}
                </Typography>
                {subtitle && (
                    <Typography sx={{ ...subTextSx, mt: .25, maxWidth: 900 }}>
                        {subtitle}
                    </Typography>
                )}
            </Box>
            {action}
        </Box>
    );
}

function DashboardTraceStandard() {
    const items = [
        ["STATE", "Where the Project / Product / Material is right now"],
        ["TIME", "When it entered the state and how long it has remained there"],
        ["ACTOR", "Who performed the recorded business action"],
        ["REASON", "Why a return, reject, hold, cancel, release or adjustment happened"],
        ["NEXT", "The controlled next department / physical hand-off"],
    ];

    return (
        <Card sx={{
            ...panelSx,
            p: 0,
            overflow: "hidden",
            borderTop: "3px solid var(--mf-primary)",
        }}>
            <Box sx={{
                px: 1.5,
                py: 1.05,
                borderBottom: "1px solid var(--mf-border)",
                display: "flex",
                justifyContent: "space-between",
                gap: 1,
                flexWrap: "wrap",
                alignItems: "center",
            }}>
                <Box>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 950 }}>
                        MatFlow Traceability Standard
                    </Typography>
                    <Typography sx={subTextSx}>
                        Every execution state should answer these five questions without reconstructing the story manually.
                    </Typography>
                </Box>
                <MatFlowStatusChip status="AUDIT_READY" />
            </Box>

            <Box sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))", xl: "repeat(5,minmax(0,1fr))" },
            }}>
                {items.map(([label, description], index) => (
                    <Box
                        key={label}
                        sx={{
                            px: 1.35,
                            py: 1.05,
                            borderRight: { xl: index === items.length - 1 ? 0 : "1px solid var(--mf-border)" },
                            borderBottom: { xs: index === items.length - 1 ? 0 : "1px solid var(--mf-border)", xl: 0 },
                            minHeight: 76,
                        }}
                    >
                        <Typography sx={{
                            color: "var(--mf-primary-text)",
                            fontSize: 9.5,
                            fontWeight: 950,
                            letterSpacing: ".08em",
                        }}>
                            {label}
                        </Typography>
                        <Typography sx={{ ...subTextSx, mt: .45, lineHeight: 1.45 }}>
                            {description}
                        </Typography>
                    </Box>
                ))}
            </Box>
        </Card>
    );
}

function DashboardFlowCard({ item, onOpen }) {
    const accent = dashboardAccentForTone(item.tone);
    return (
        <Card sx={{
            ...panelSx,
            minHeight: 174,
            display: "flex",
            flexDirection: "column",
            position: "relative",
            overflow: "hidden",
            borderTop: `3px solid ${accent}`,
            "&::after": {
                content: '""',
                position: "absolute",
                width: 94,
                height: 94,
                borderRadius: "50%",
                right: -34,
                top: -44,
                background: `${accent}18`,
                pointerEvents: "none",
            },
        }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, position: "relative", zIndex: 1 }}>
                <Box>
                    <Typography sx={{ ...subTextSx, fontSize: 9, fontWeight: 950, letterSpacing: ".07em" }}>
                        STEP {item.step}
                    </Typography>
                    <Typography sx={{ fontSize: 16, fontWeight: 950, mt: .35 }}>{item.title}</Typography>
                </Box>
                <Box sx={{ textAlign: "right" }}>
                    <Typography sx={{ fontSize: 21, lineHeight: 1, fontWeight: 950 }}>{item.value}</Typography>
                    <Typography sx={{ ...subTextSx, fontSize: 9, mt: .3 }}>{item.metricLabel}</Typography>
                </Box>
            </Box>
            <Typography sx={{ ...subTextSx, mt: .75, lineHeight: 1.45, flex: 1 }}>
                {item.subtitle}
            </Typography>
            <Typography sx={{
                color: accent,
                fontWeight: 900,
                fontSize: 10.5,
                mt: .7,
                minHeight: 30,
            }}>
                {item.helper}
            </Typography>
            <Button
                fullWidth
                endIcon={<ArrowForwardIcon />}
                onClick={() => onOpen(item.path)}
                sx={{ ...secondaryBtnSx, mt: .7 }}
            >
                Open Control Desk
            </Button>
        </Card>
    );
}

export function MatFlowDashboardPage() {
    const navigate = useNavigate();
    const { selectedPlantParam } = useMatFlow();

    const [data, setData] = useState(null);
    const [portfolio, setPortfolio] = useState([]);
    const [tracker, setTracker] = useState(null);
    const [shortages, setShortages] = useState([]);
    const [audits, setAudits] = useState([]);
    const [ledger, setLedger] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [warning, setWarning] = useState("");
    const [refreshedAt, setRefreshedAt] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        setWarning("");

        /*
         * Clear every previously scoped feed before issuing the new plant-scoped
         * request set. A partial failure must never leave data from the prior
         * plant selection visible under the newly selected scope.
         */
        setData(null);
        setPortfolio([]);
        setTracker(null);
        setShortages([]);
        setAudits([]);
        setLedger([]);

        const requests = [
            ["dashboard", matflowApi.dashboardReport({ plantCode: selectedPlantParam || undefined })],
            ["projects", matflowApi.listProjectPortfolio({
                active: true,
                plantCode: selectedPlantParam || undefined,
            })],
            ["tracker", matflowApi.getTracker({ plantCode: selectedPlantParam || undefined })],
            ["shortages", matflowApi.shortageReport({
                plantCode: selectedPlantParam || undefined,
                minimumAgeDays: 0,
            })],
            ["audit", matflowApi.auditLogs({
                plantCode: selectedPlantParam || undefined,
                page: 0,
                size: 100,
            })],
            ["ledger", matflowApi.stockLedger({
                plantCode: selectedPlantParam || undefined,
                page: 0,
                size: 100,
            })],
        ];

        try {
            const settled = await Promise.allSettled(requests.map(([, promise]) => promise));
            const failures = [];

            settled.forEach((result, index) => {
                const key = requests[index][0];
                if (result.status === "rejected") {
                    failures.push(`${key}: ${readMatFlowError(result.reason, "feed unavailable")}`);
                    return;
                }

                const payload = result.value?.data;
                if (key === "dashboard") setData(payload || null);
                if (key === "projects") setPortfolio(Array.isArray(payload) ? payload : []);
                if (key === "tracker") setTracker(payload || null);
                if (key === "shortages") {
                    setShortages(
                        Array.isArray(payload)
                            ? payload
                            : extractMatFlowPage(payload).rows
                    );
                }
                if (key === "audit") setAudits(extractMatFlowPage(payload).rows);
                if (key === "ledger") setLedger(extractMatFlowPage(payload).rows);
            });

            if (failures.length === requests.length) {
                throw new Error("All MatFlow dashboard feeds are unavailable.");
            }

            if (failures.length > 0) {
                setWarning(
                    `Dashboard loaded with partial supporting data (${requests.length - failures.length}/${requests.length} feeds available). Refresh after the unavailable service recovers.`
                );
            }

            setRefreshedAt(new Date().toISOString());
        } catch (requestError) {
            setData(null);
            setPortfolio([]);
            setTracker(null);
            setShortages([]);
            setAudits([]);
            setLedger([]);
            setError(readMatFlowError(requestError, "Unable to load MatFlow Operations Command Center."));
        } finally {
            setLoading(false);
        }
    }, [selectedPlantParam]);

    useEffect(() => {
        load();
    }, [load]);

    const totals = data?.totals || {};
    const plantRows = Array.isArray(data?.rows) ? data.rows : [];
    const trackerRows = Array.isArray(tracker?.rows) ? tracker.rows : [];

    const portfolioContext = useMemo(() => {
        const byProductId = new Map();
        const byScope = new Map();
        const products = [];

        portfolio.forEach((project) => {
            (Array.isArray(project?.products) ? project.products : []).forEach((product) => {
                const context = { project, product };
                products.push(context);
                if (product?.id != null) {
                    byProductId.set(String(product.id), context);
                }
                const scopeKey = dashboardScopeKey(project?.projectCode, product?.drawingNo);
                if (scopeKey !== "|") byScope.set(scopeKey, context);
            });
        });

        return { byProductId, byScope, products };
    }, [portfolio]);

    const productCount = portfolioContext.products.length;
    const awaitingDirector = portfolioContext.products.filter(
        ({ product }) => product?.active !== false && normalize(product?.approvalStatus) !== "APPROVED"
    ).length;
    const productsWithoutBom = portfolioContext.products.filter(
        ({ product }) => product?.active !== false && !product?.latestBomId
    ).length;
    const approvedProducts = portfolioContext.products.filter(
        ({ product }) => normalize(product?.approvalStatus) === "APPROVED"
    ).length;

    const sortedAudits = useMemo(
        () => [...audits].sort((a, b) => dashboardTimestamp(b?.actionAt) - dashboardTimestamp(a?.actionAt)),
        [audits]
    );

    const sortedLedger = useMemo(
        () => [...ledger].sort((a, b) => dashboardTimestamp(b?.actionAt) - dashboardTimestamp(a?.actionAt)),
        [ledger]
    );

    const latestAuditByEntity = useMemo(() => {
        const map = new Map();
        sortedAudits.forEach((audit) => {
            if (audit?.entityId != null && !map.has(String(audit.entityId))) {
                map.set(String(audit.entityId), audit);
            }
        });
        return map;
    }, [sortedAudits]);

    const latestAuditByScope = useMemo(() => {
        const map = new Map();
        sortedAudits.forEach((audit) => {
            const key = dashboardScopeKey(audit?.projectCode, audit?.drawingNo);
            if (key !== "|" && !map.has(key)) map.set(key, audit);
        });
        return map;
    }, [sortedAudits]);

    const liveTrackerRows = useMemo(
        () => trackerRows.filter(dashboardTrackerIsLive),
        [trackerRows]
    );

    const trackerStats = useMemo(() => {
        const breach = liveTrackerRows.filter((row) =>
            ["BREACHED", "COMPLETED_LATE"].includes(normalize(row?.timingHealth))
        ).length;
        const watch = liveTrackerRows.filter((row) => normalize(row?.timingHealth) === "WATCH").length;
        const inTransit = liveTrackerRows.filter((row) =>
            normalize(row?.currentDepartment) === "IN_TRANSIT" ||
            normalize(row?.currentStage).includes("TRANSFER")
        ).length;
        const production = liveTrackerRows.filter((row) =>
            normalize(row?.currentDepartment).includes("PRODUCTION") ||
            normalize(row?.currentStage).includes("PRODUCTION")
        ).length;
        const materialControls = liveTrackerRows.reduce(
            (total, row) =>
                total + numeric(row?.reservationCount) + numeric(row?.openIndentCount),
            0
        );
        return { breach, watch, inTransit, production, materialControls };
    }, [liveTrackerRows]);

    const shortageMaterialCount = useMemo(
        () => new Set(
            shortages
                .map((row) => row?.materialId || clean(row?.materialCode).toUpperCase())
                .filter(Boolean)
        ).size,
        [shortages]
    );

    const latestAudit = sortedAudits[0] || null;
    const last24Hours = Date.now() - 24 * 60 * 60 * 1000;
    const recentAuditCount = sortedAudits.filter(
        (audit) => dashboardTimestamp(audit?.actionAt) >= last24Hours
    ).length;

    const attentionRows = useMemo(() => {
        return liveTrackerRows
            .map((row) => {
                const productContext =
                    portfolioContext.byProductId.get(String(row?.projectDrawingId || "")) ||
                    portfolioContext.byScope.get(dashboardScopeKey(row?.projectCode, row?.drawingNo)) ||
                    null;

                const audit =
                    latestAuditByEntity.get(String(row?.requisitionId || row?.id || "")) ||
                    latestAuditByScope.get(dashboardScopeKey(row?.projectCode, row?.drawingNo)) ||
                    null;

                return {
                    row,
                    project: productContext?.project || null,
                    product: productContext?.product || null,
                    audit,
                    severity: dashboardTrackerSeverity(row),
                };
            })
            .sort((left, right) =>
                right.severity - left.severity ||
                dashboardTimestamp(right.row?.updatedAt) - dashboardTimestamp(left.row?.updatedAt)
            )
            .slice(0, 10);
    }, [
        liveTrackerRows,
        portfolioContext,
        latestAuditByEntity,
        latestAuditByScope,
    ]);

    const shortagePriority = useMemo(
        () => [...shortages]
            .sort((a, b) =>
                numeric(b?.ageDays) - numeric(a?.ageDays) ||
                numeric(b?.shortageQty) - numeric(a?.shortageQty)
            )
            .slice(0, 10),
        [shortages]
    );

    const traceability = useMemo(() => {
        const total = sortedAudits.length;
        const actor = sortedAudits.filter((row) => clean(row?.actor)).length;
        const timestamp = sortedAudits.filter((row) => row?.actionAt).length;
        const context = sortedAudits.filter(
            (row) => clean(row?.projectCode) || clean(row?.drawingNo)
        ).length;
        const decisions = sortedAudits.filter((row) => dashboardDecisionNeedsReason(row?.action));
        const missingReasons = decisions.filter((row) => !dashboardReasonForAudit(row)).length;

        return {
            total,
            actor,
            timestamp,
            context,
            decisions: decisions.length,
            missingReasons,
        };
    }, [sortedAudits]);

    const primaryCards = [
        {
            label: "Active Projects",
            value: totals.activeProjects ?? portfolio.length,
            helper: `${productCount} Product / Drawing records in scope`,
            tone: "blue",
        },
        {
            label: "Products / Drawings",
            value: productCount,
            helper: `${approvedProducts} Director-approved · ${awaitingDirector} awaiting`,
            tone: "indigo",
        },
        {
            label: "Effective BOMs",
            value: totals.effectiveBoms ?? 0,
            helper: `${productsWithoutBom} Product(s) currently without a BOM`,
            tone: "purple",
        },
        {
            label: "Live Requisitions",
            value: totals.openRequisitions ?? liveTrackerRows.length,
            helper: `${trackerStats.materialControls} active reservation / shortage controls`,
            tone: "sky",
        },
        {
            label: "Shortage Exposure",
            value: totals.shortageRequisitions ?? 0,
            helper: `${shortages.length} shortage line(s) · ${shortageMaterialCount} material(s)`,
            tone: "red",
        },
        {
            label: "SLA Risk / Breach",
            value: trackerStats.breach + trackerStats.watch,
            helper: `${trackerStats.breach} breached · ${trackerStats.watch} on watch`,
            tone: trackerStats.breach > 0 ? "red" : "amber",
        },
        {
            label: "Pending QC",
            value: totals.pendingQcInspections ?? 0,
            helper: `${totals.readyOutboundTransfers ?? 0} route hand-off(s) ready`,
            tone: "amber",
        },
        {
            label: "Open Purchase Orders",
            value: totals.openPurchaseOrders ?? 0,
            helper: `${totals.openIndents ?? 0} open shortage indent(s)`,
            tone: "orange",
        },
    ];

    const secondaryCards = [
        ["Director Approval Pending", awaitingDirector, "amber"],
        ["Transfers Ready", totals.readyOutboundTransfers ?? 0, "green"],
        ["Transfers In Transit", totals.inTransitOutboundTransfers ?? 0, "sky"],
        ["Processing Jobs", totals.activeProcessingJobs ?? 0, "purple"],
        ["Low Stock Lines", totals.lowStockLines ?? 0, "amber"],
        ["Blocked Stock Lines", totals.blockedStockLines ?? 0, "red"],
    ];

    const flowCards = [
        {
            step: 1,
            title: "Project Portfolio",
            subtitle: "Project ownership, Product / Drawing register and Director Product approval.",
            path: "/matflow/projects",
            value: totals.activeProjects ?? portfolio.length,
            metricLabel: "ACTIVE PROJECTS",
            helper: `${productCount} products · ${awaitingDirector} awaiting Director`,
            tone: "blue",
        },
        {
            step: 2,
            title: "Operational BOMs",
            subtitle: "Engineering material structure → Production technical review → Director final approval.",
            path: "/matflow/boms",
            value: totals.effectiveBoms ?? 0,
            metricLabel: "EFFECTIVE BOMS",
            helper: productsWithoutBom > 0 ? `${productsWithoutBom} Product(s) need BOM coverage` : "All active Products have BOM coverage",
            tone: "purple",
        },
        {
            step: 3,
            title: "Production Requisitions",
            subtitle: "Product/BOM material demand becomes an accountable execution request.",
            path: "/matflow/production",
            value: totals.openRequisitions ?? liveTrackerRows.length,
            metricLabel: "OPEN REQUESTS",
            helper: `${trackerStats.materialControls} material control branch(es) currently live`,
            tone: "sky",
        },
        {
            step: 4,
            title: "Store",
            subtitle: "Availability review, reservation, shortage declaration and first controlled hand-off.",
            path: "/matflow/store",
            value: totals.shortageRequisitions ?? 0,
            metricLabel: "SHORTAGE REQS",
            helper: `${totals.readyOutboundTransfers ?? 0} transfer(s) ready · ${totals.lowStockLines ?? 0} low-stock lines`,
            tone: "green",
        },
        {
            step: 5,
            title: "Purchase",
            subtitle: "Shortage-only procurement: Indent → PO → approval → GRN / receiving.",
            path: "/matflow/purchase",
            value: totals.openPurchaseOrders ?? 0,
            metricLabel: "OPEN POS",
            helper: `${totals.openIndents ?? 0} open indent(s)`,
            tone: "orange",
        },
        {
            step: 6,
            title: "Quality Control",
            subtitle: "Inspect received material and explicitly decide Direct-to-Production or approved Processing.",
            path: "/matflow/qc",
            value: totals.pendingQcInspections ?? 0,
            metricLabel: "PENDING QC",
            helper: `${totals.expectedInboundTransfers ?? 0} expected inbound transfer(s)`,
            tone: "amber",
        },
        {
            step: 7,
            title: "Processing",
            subtitle: "Optional preprocessing only when the QC-controlled route explicitly requires it.",
            path: "/matflow/processing",
            value: totals.activeProcessingJobs ?? 0,
            metricLabel: "ACTIVE JOBS",
            helper: "Input → Processing Unit → output material lineage",
            tone: "purple",
        },
        {
            step: 8,
            title: "Production",
            subtitle: "Controlled issue → Production start → consumption / returns → finished Product completion.",
            path: "/matflow/production-execution",
            value: trackerStats.production,
            metricLabel: "LIVE IN PRODUCTION",
            helper: `${trackerStats.inTransit} material control(s) currently in transit`,
            tone: "green",
        },
        {
            step: 9,
            title: "Ledger & Audit",
            subtitle: "Immutable material movement evidence plus who / when / why business-action trace.",
            path: "/matflow/ledger",
            value: recentAuditCount,
            metricLabel: "AUDIT EVENTS · 24H",
            helper: `${sortedAudits.length} recent audit records loaded`,
            tone: "indigo",
        },
    ];

    const topLedger = sortedLedger.slice(0, 10);
    const topAudits = sortedAudits.slice(0, 10);

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="MATFLOW EXECUTIVE OPERATIONS CONTROL"
                title="MatFlow Operations Command Center"
                subtitle="Project → Product → Material execution with current state, custody, entered-at time, dwell/SLA, responsible actor, recorded reason/remarks, next hand-off, shortage exposure and immutable movement/audit evidence."
                actions={
                    <Box sx={{ display: "flex", gap: .7, flexWrap: "wrap" }}>
                        <Button onClick={() => navigate("/matflow/tracker")} sx={secondaryBtnSx}>
                            Project Tracker
                        </Button>
                        <Button onClick={() => navigate("/matflow/tracker/materials")} sx={primaryBtnSx}>
                            Material Control Tower
                        </Button>
                        <Button
                            startIcon={<RefreshIcon />}
                            onClick={load}
                            disabled={loading}
                            sx={secondaryBtnSx}
                        >
                            Refresh
                        </Button>
                    </Box>
                }
            />

            <ErrorBox>{error}</ErrorBox>

            {warning && (
                <Box sx={{
                    px: 1.35,
                    py: 1,
                    borderRadius: 1.7,
                    border: "1px solid var(--mf-warning-border)",
                    background: "var(--mf-warning-soft)",
                    color: "var(--mf-warning-text)",
                    fontSize: 11,
                    fontWeight: 800,
                }}>
                    {warning}
                </Box>
            )}

            {loading ? (
                <LoadingBlock />
            ) : (
                <>
                    <Card sx={{
                        ...panelSx,
                        py: 1,
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", md: "repeat(4,minmax(0,1fr))" },
                        gap: .75,
                    }}>
                        {[
                            ["SCOPE", selectedPlantParam || "All accessible plants", "Backend plant authorization remains authoritative."],
                            ["LAST REFRESH", formatDate(refreshedAt), `${plantRows.length || data?.plants?.length || 0} plant scope(s) summarized.`],
                            ["LAST RECORDED ACTION", latestAudit ? readable(latestAudit.action) : "No audit event", latestAudit ? `${latestAudit.projectCode || "-"} · ${latestAudit.drawingNo || "-"}` : "No audit record loaded."],
                            ["LAST ACTOR / TIME", latestAudit?.actor || "-", latestAudit?.actionAt ? formatDate(latestAudit.actionAt) : "No timestamp recorded."],
                        ].map(([label, value, helper]) => (
                            <Box
                                key={label}
                                sx={{
                                    minWidth: 0,
                                    px: 1,
                                    py: .8,
                                    borderRadius: 1.5,
                                    border: "1px solid var(--mf-border)",
                                    background: "var(--mf-surface)",
                                }}
                            >
                                <Typography sx={{ ...subTextSx, fontSize: 8.8, fontWeight: 950, letterSpacing: ".07em" }}>
                                    {label}
                                </Typography>
                                <Typography sx={{ ...mainTextSx, mt: .35, overflowWrap: "anywhere" }}>{value}</Typography>
                                <Typography sx={{ ...subTextSx, mt: .25 }}>{helper}</Typography>
                            </Box>
                        ))}
                    </Card>

                    <DashboardTraceStandard />

                    <Box sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))",
                        gap: 1,
                    }}>
                        {primaryCards.map((card) => (
                            <SummaryCard
                                key={card.label}
                                label={card.label}
                                value={card.value ?? 0}
                                helper={card.helper}
                                tone={card.tone}
                                colorful
                            />
                        ))}
                    </Box>

                    <Box sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))",
                        gap: .8,
                    }}>
                        {secondaryCards.map(([label, value, tone]) => (
                            <SummaryCard
                                key={label}
                                label={label}
                                value={value}
                                tone={tone}
                            />
                        ))}
                    </Box>

                    <Box sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", xl: "minmax(0,1.7fr) minmax(320px,.7fr)" },
                        gap: 1,
                        alignItems: "start",
                    }}>
                        <Card sx={panelSx}>
                            <DashboardSectionHeading
                                eyebrow="Executive Intervention Queue"
                                title="What Needs Attention Now"
                                subtitle="Highest-risk live Project → Product → Requisition control points. The queue combines state, custody, time-in-state, SLA, shortage, next hand-off and the latest recorded actor/reason context."
                                action={
                                    <Button onClick={() => navigate("/matflow/tracker")} sx={secondaryBtnSx}>
                                        Full Project Tracker
                                    </Button>
                                }
                            />

                            <Box sx={tableShellSx}>
                                <Box sx={{
                                    ...tableHeaderSx,
                                    gridTemplateColumns: "minmax(205px,1.35fr) 165px minmax(180px,1fr) 165px minmax(190px,1fr) minmax(190px,1fr) 110px",
                                }}>
                                    {[
                                        "Project → Product → Requisition",
                                        "Current State / Owner",
                                        "Current Custody",
                                        "Entered / Dwell",
                                        "Next Hand-off",
                                        "Last Actor / Reason",
                                        "Trace",
                                    ].map((heading) => (
                                        <Box key={heading} sx={tableCellSx}>{heading}</Box>
                                    ))}
                                </Box>

                                {attentionRows.length === 0 ? (
                                    <EmptyState>No live Project/Product execution requires intervention in the selected scope.</EmptyState>
                                ) : attentionRows.map(({ row, project, product, audit }) => {
                                    const reason = dashboardReasonForAudit(audit);
                                    const duration = numeric(row?.stageDurationMinutes) > 0
                                        ? numeric(row.stageDurationMinutes)
                                        : numeric(row?.ageHours) * 60;
                                    const target = numeric(row?.targetMinutes);
                                    const requisitionId = row?.requisitionId || row?.id;

                                    return (
                                        <Box
                                            key={requisitionId || `${row?.projectCode}:${row?.drawingNo}`}
                                            sx={{
                                                ...tableRowSx,
                                                gridTemplateColumns: "minmax(205px,1.35fr) 165px minmax(180px,1fr) 165px minmax(190px,1fr) minmax(190px,1fr) 110px",
                                            }}
                                        >
                                            <Box sx={tableCellSx}>
                                                <Typography sx={mainTextSx}>
                                                    {project?.projectCode || row?.projectCode || "-"} · {project?.projectName || "Project"}
                                                </Typography>
                                                <Typography sx={subTextSx}>
                                                    {product?.productName || "Product"} · {product?.drawingNo || row?.drawingNo || "-"}
                                                </Typography>
                                                <Typography sx={{ ...subTextSx, mt: .2 }}>
                                                    {row?.requisitionNumber || "-"}
                                                </Typography>
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                <MatFlowStatusChip status={row?.currentStage || row?.requisitionStatus} />
                                                <Typography sx={{ ...subTextSx, mt: .45 }}>
                                                    Owner: {readable(row?.currentDepartment || row?.responsibleDesk || "-")}
                                                </Typography>
                                                <Box sx={{ mt: .35 }}>
                                                    <TimingHealthChip health={row?.timingHealth} />
                                                </Box>
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                <Typography sx={mainTextSx}>{dashboardLocationLabel(row)}</Typography>
                                                <Typography sx={subTextSx}>
                                                    Shortage: {formatQty(row?.shortageQty)}
                                                </Typography>
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                <Typography sx={mainTextSx}>{formatDate(row?.stageStartedAt)}</Typography>
                                                <Typography sx={subTextSx}>
                                                    {formatDurationMinutes(duration)}
                                                    {target > 0 ? ` / target ${formatDurationMinutes(target)}` : ""}
                                                </Typography>
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                <Typography sx={mainTextSx}>{dashboardNextLabel(row)}</Typography>
                                                <Typography sx={subTextSx}>
                                                    {trackerNextAction(row)}
                                                </Typography>
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                <Typography sx={mainTextSx}>{audit?.actor || "-"}</Typography>
                                                <Typography sx={subTextSx}>{formatDate(audit?.actionAt)}</Typography>
                                                <Typography sx={{
                                                    ...subTextSx,
                                                    mt: .3,
                                                    color: reason
                                                        ? "var(--mf-text-secondary)"
                                                        : dashboardDecisionNeedsReason(audit?.action)
                                                            ? "var(--mf-warning-text)"
                                                            : "var(--mf-text-muted)",
                                                }}>
                                                    {reason || row?.bottleneckHint || (
                                                        dashboardDecisionNeedsReason(audit?.action)
                                                            ? "No reason / remarks recorded on this decision event."
                                                            : "No exception reason required on the latest event."
                                                    )}
                                                </Typography>
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                <Button
                                                    disabled={!requisitionId}
                                                    onClick={() => navigate(`/matflow/tracker/${requisitionId}`)}
                                                    sx={secondaryBtnSx}
                                                >
                                                    Trace
                                                </Button>
                                            </Box>
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Card>

                        <Card sx={panelSx}>
                            <DashboardSectionHeading
                                eyebrow="Audit Completeness"
                                title="Traceability Integrity"
                                subtitle="Quick control on whether recent backend audit evidence answers who / when / context / why."
                                action={
                                    <Button onClick={() => navigate("/matflow/reports")} sx={secondaryBtnSx}>
                                        Reports
                                    </Button>
                                }
                            />

                            <Box sx={{ display: "grid", gap: .7 }}>
                                {[
                                    ["Actor Coverage", dashboardPercent(traceability.actor, traceability.total), `${traceability.actor}/${traceability.total} audit events identify an actor`, "green"],
                                    ["Timestamp Coverage", dashboardPercent(traceability.timestamp, traceability.total), `${traceability.timestamp}/${traceability.total} audit events have action time`, "blue"],
                                    ["Project / Drawing Context", dashboardPercent(traceability.context, traceability.total), `${traceability.context}/${traceability.total} events carry Project/Drawing context`, "indigo"],
                                    ["Exception Decisions", traceability.decisions, "Return / reject / cancel / release / adjust / hold etc.", "amber"],
                                    ["Missing Recorded Reason", traceability.missingReasons, traceability.missingReasons > 0 ? "Review exception actions without reason/remarks." : "No missing reason detected in the loaded exception decisions.", traceability.missingReasons > 0 ? "red" : "green"],
                                ].map(([label, value, helper, tone]) => {
                                    const accent = dashboardAccentForTone(tone);
                                    return (
                                        <Box
                                            key={label}
                                            sx={{
                                                p: .9,
                                                borderRadius: 1.5,
                                                border: "1px solid var(--mf-border)",
                                                borderLeft: `3px solid ${accent}`,
                                                background: "var(--mf-surface)",
                                            }}
                                        >
                                            <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                                                <Typography sx={{ ...subTextSx, fontWeight: 900 }}>{label}</Typography>
                                                <Typography sx={{ fontSize: 15, fontWeight: 950, color: accent }}>{value}</Typography>
                                            </Box>
                                            <Typography sx={{ ...subTextSx, mt: .25 }}>{helper}</Typography>
                                        </Box>
                                    );
                                })}
                            </Box>

                            <Box sx={{
                                mt: 1,
                                p: .9,
                                borderRadius: 1.5,
                                border: "1px solid var(--mf-border)",
                                background: "var(--mf-panel-bg)",
                            }}>
                                <Typography sx={{ ...subTextSx, fontSize: 9, fontWeight: 950 }}>DIRECTOR CONTROL PRINCIPLE</Typography>
                                <Typography sx={{ ...subTextSx, mt: .4, lineHeight: 1.5 }}>
                                    A status without timestamp, actor and exception reason is not a complete operational trace. This panel highlights gaps from the loaded audit evidence instead of hiding them.
                                </Typography>
                            </Box>
                        </Card>
                    </Box>

                    <Card sx={panelSx}>
                        <DashboardSectionHeading
                            eyebrow="End-to-End Module"
                            title="Live Process Control Desks"
                            subtitle="The MatFlow lifecycle remains Project → Product → Materials, but each desk now carries a live operational signal instead of being a static navigation card."
                        />
                        <Box sx={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit,minmax(225px,1fr))",
                            gap: 1,
                        }}>
                            {flowCards.map((item) => (
                                <DashboardFlowCard
                                    key={item.title}
                                    item={item}
                                    onOpen={navigate}
                                />
                            ))}
                        </Box>
                    </Card>

                    <Card sx={panelSx}>
                        <DashboardSectionHeading
                            eyebrow="Material Risk"
                            title="Priority Material Shortages"
                            subtitle="Oldest and highest-quantity open shortage lines across the accessible Project/Product scope. Material identity is kept explicit so the user can move directly into material-centric tracking."
                            action={
                                <Button onClick={() => navigate("/matflow/reports")} sx={secondaryBtnSx}>
                                    Full Shortage Report
                                </Button>
                            }
                        />
                        <Box sx={tableShellSx}>
                            <Box sx={{
                                ...tableHeaderSx,
                                gridTemplateColumns: "150px minmax(200px,1fr) minmax(170px,.8fr) 155px 120px 100px 125px",
                            }}>
                                {[
                                    "Material",
                                    "Material Name",
                                    "Project / Drawing",
                                    "Requisition",
                                    "Shortage",
                                    "Age",
                                    "Tracking",
                                ].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                            </Box>

                            {shortagePriority.length === 0 ? (
                                <EmptyState>No open material shortages exist in the selected scope.</EmptyState>
                            ) : shortagePriority.map((row, index) => {
                                const context =
                                    portfolioContext.byScope.get(dashboardScopeKey(row?.projectCode, row?.drawingNo)) ||
                                    null;
                                return (
                                    <Box
                                        key={row?.requisitionLineId || `${row?.materialId}:${index}`}
                                        sx={{
                                            ...tableRowSx,
                                            gridTemplateColumns: "150px minmax(200px,1fr) minmax(170px,.8fr) 155px 120px 100px 125px",
                                        }}
                                    >
                                        <Box sx={tableCellSx}>
                                            <Typography sx={mainTextSx}>{row?.materialCode || "-"}</Typography>
                                            <Typography sx={subTextSx}>{row?.uom || ""}</Typography>
                                        </Box>
                                        <Box sx={tableCellSx}>{row?.materialName || "-"}</Box>
                                        <Box sx={tableCellSx}>
                                            <Typography sx={mainTextSx}>
                                                {row?.projectCode || "-"} · {context?.product?.productName || "Product"}
                                            </Typography>
                                            <Typography sx={subTextSx}>{row?.drawingNo || "-"}</Typography>
                                        </Box>
                                        <Box sx={tableCellSx}>{row?.requisitionNumber || "-"}</Box>
                                        <Box sx={tableCellSx}>
                                            <Typography sx={{ fontWeight: 950, color: "var(--mf-danger-text)" }}>
                                                {formatQty(row?.shortageQty)} {row?.uom || ""}
                                            </Typography>
                                        </Box>
                                        <Box sx={tableCellSx}>
                                            <MatFlowStatusChip status={numeric(row?.ageDays) >= 3 ? "BREACHED" : numeric(row?.ageDays) >= 1 ? "WATCH" : "OPEN"} />
                                            <Typography sx={{ ...subTextSx, mt: .25 }}>{numeric(row?.ageDays)}d</Typography>
                                        </Box>
                                        <Box sx={tableCellSx}>
                                            <Button
                                                disabled={!row?.materialId}
                                                onClick={() => navigate(`/matflow/tracker/materials/${row.materialId}`)}
                                                sx={secondaryBtnSx}
                                            >
                                                Material
                                            </Button>
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Card>

                    <Box sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", xl: "1fr 1fr" },
                        gap: 1,
                        alignItems: "start",
                    }}>
                        <Card sx={panelSx}>
                            <DashboardSectionHeading
                                eyebrow="Physical Material Evidence"
                                title="Latest Material Movements"
                                subtitle="Immutable stock-ledger events: material, physical location, Project/Drawing context, quantity delta, actor, timestamp and movement remarks."
                                action={
                                    <Button onClick={() => navigate("/matflow/ledger")} sx={secondaryBtnSx}>
                                        Full Ledger
                                    </Button>
                                }
                            />

                            <Box sx={tableShellSx}>
                                <Box sx={{
                                    ...tableHeaderSx,
                                    gridTemplateColumns: "155px 145px 145px 105px minmax(165px,1fr) minmax(180px,1fr)",
                                }}>
                                    {["Material", "Movement", "Location", "Qty Δ", "Project / Reference", "Actor / Time / Reason"].map((heading) => (
                                        <Box key={heading} sx={tableCellSx}>{heading}</Box>
                                    ))}
                                </Box>

                                {topLedger.length === 0 ? (
                                    <EmptyState>No material movement has been recorded in the selected scope.</EmptyState>
                                ) : topLedger.map((row, index) => (
                                    <Box
                                        key={row?.id || row?.ledgerId || index}
                                        sx={{
                                            ...tableRowSx,
                                            gridTemplateColumns: "155px 145px 145px 105px minmax(165px,1fr) minmax(180px,1fr)",
                                        }}
                                    >
                                        <Box sx={tableCellSx}>
                                            <Typography sx={mainTextSx}>{row?.materialCode || "-"}</Typography>
                                            <Typography sx={subTextSx}>{row?.materialName || "-"}</Typography>
                                        </Box>
                                        <Box sx={tableCellSx}><MatFlowStatusChip status={row?.movementType} /></Box>
                                        <Box sx={tableCellSx}>
                                            <Typography sx={mainTextSx}>{row?.locationCode || "-"}</Typography>
                                            <Typography sx={subTextSx}>{row?.plantCode || "-"}</Typography>
                                        </Box>
                                        <Box sx={tableCellSx}>
                                            {formatQty(row?.quantityChange)} {row?.uom || ""}
                                        </Box>
                                        <Box sx={tableCellSx}>
                                            <Typography sx={mainTextSx}>{row?.projectCode || "-"} · {row?.drawingNo || "-"}</Typography>
                                            <Typography sx={subTextSx}>{row?.referenceNumber || row?.referenceType || "-"}</Typography>
                                        </Box>
                                        <Box sx={tableCellSx}>
                                            <Typography sx={mainTextSx}>{row?.actor || "-"}</Typography>
                                            <Typography sx={subTextSx}>{formatDate(row?.actionAt)}</Typography>
                                            <Typography sx={{ ...subTextSx, mt: .2 }}>{row?.remarks || "No movement remarks recorded."}</Typography>
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        </Card>

                        <Card sx={panelSx}>
                            <DashboardSectionHeading
                                eyebrow="Who / When / Why"
                                title="Latest Business Decisions & Audit"
                                subtitle="Central backend audit evidence. Exception actions explicitly expose recorded reason/remarks when present and flag the absence when a reason should exist."
                                action={
                                    <Button onClick={() => navigate("/matflow/reports")} sx={secondaryBtnSx}>
                                        Full Audit
                                    </Button>
                                }
                            />

                            <Box sx={tableShellSx}>
                                <Box sx={{
                                    ...tableHeaderSx,
                                    gridTemplateColumns: "155px minmax(160px,1fr) 160px 150px minmax(190px,1fr)",
                                }}>
                                    {["Entity", "Action", "Project / Drawing", "Actor / Time", "Reason / Recorded Detail"].map((heading) => (
                                        <Box key={heading} sx={tableCellSx}>{heading}</Box>
                                    ))}
                                </Box>

                                {topAudits.length === 0 ? (
                                    <EmptyState>No audit event is available in the selected scope.</EmptyState>
                                ) : topAudits.map((row, index) => {
                                    const reason = dashboardReasonForAudit(row);
                                    const needsReason = dashboardDecisionNeedsReason(row?.action);
                                    return (
                                        <Box
                                            key={row?.id || index}
                                            sx={{
                                                ...tableRowSx,
                                                gridTemplateColumns: "155px minmax(160px,1fr) 160px 150px minmax(190px,1fr)",
                                            }}
                                        >
                                            <Box sx={tableCellSx}>
                                                <Typography sx={mainTextSx}>{readable(row?.entityType || "-")}</Typography>
                                            </Box>
                                            <Box sx={tableCellSx}>
                                                <MatFlowStatusChip status={row?.action} />
                                            </Box>
                                            <Box sx={tableCellSx}>
                                                <Typography sx={mainTextSx}>{row?.projectCode || "-"}</Typography>
                                                <Typography sx={subTextSx}>{row?.drawingNo || "-"}</Typography>
                                            </Box>
                                            <Box sx={tableCellSx}>
                                                <Typography sx={mainTextSx}>{row?.actor || "-"}</Typography>
                                                <Typography sx={subTextSx}>{formatDate(row?.actionAt)}</Typography>
                                            </Box>
                                            <Box sx={tableCellSx}>
                                                <Typography sx={{
                                                    ...subTextSx,
                                                    color: reason
                                                        ? "var(--mf-text-secondary)"
                                                        : needsReason
                                                            ? "var(--mf-warning-text)"
                                                            : "var(--mf-text-muted)",
                                                    fontWeight: needsReason && !reason ? 850 : 600,
                                                }}>
                                                    {reason || (needsReason
                                                        ? "No reason / remarks recorded for this exception decision."
                                                        : "No exception reason required / recorded.")}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Card>
                    </Box>

                    <Card sx={panelSx}>
                        <DashboardSectionHeading
                            eyebrow="Plant-Level Operating Picture"
                            title="Plant Operations Matrix"
                            subtitle="Backend-authorized roll-up by accessible plant. Use it to identify where Project demand, shortages, material routing, QC, processing, purchase or stock risk is concentrated."
                        />

                        <Box sx={tableShellSx}>
                            <Box sx={{
                                ...tableHeaderSx,
                                gridTemplateColumns: "120px 90px 90px 95px 95px 110px 100px 100px 105px 105px 105px",
                            }}>
                                {[
                                    "Plant",
                                    "Projects",
                                    "Open Reqs",
                                    "Shortage",
                                    "Ready Xfer",
                                    "Transit Out",
                                    "Inbound",
                                    "Pending QC",
                                    "Processing",
                                    "Open PO",
                                    "Stock Risk",
                                ].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                            </Box>

                            {plantRows.length === 0 ? (
                                <EmptyState>No plant roll-up is available for the current access scope.</EmptyState>
                            ) : plantRows.map((row) => (
                                <Box
                                    key={row?.plantCode || row?.plant || "plant"}
                                    sx={{
                                        ...tableRowSx,
                                        gridTemplateColumns: "120px 90px 90px 95px 95px 110px 100px 100px 105px 105px 105px",
                                    }}
                                >
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row?.plantCode || row?.plant || "-"}</Typography></Box>
                                    <Box sx={tableCellSx}>{row?.activeProjects ?? 0}</Box>
                                    <Box sx={tableCellSx}>{row?.openRequisitions ?? 0}</Box>
                                    <Box sx={tableCellSx}>{row?.shortageRequisitions ?? 0}</Box>
                                    <Box sx={tableCellSx}>{row?.readyOutboundTransfers ?? 0}</Box>
                                    <Box sx={tableCellSx}>{row?.inTransitOutboundTransfers ?? 0}</Box>
                                    <Box sx={tableCellSx}>{row?.expectedInboundTransfers ?? 0}</Box>
                                    <Box sx={tableCellSx}>{row?.pendingQcInspections ?? 0}</Box>
                                    <Box sx={tableCellSx}>{row?.activeProcessingJobs ?? 0}</Box>
                                    <Box sx={tableCellSx}>{row?.openPurchaseOrders ?? 0}</Box>
                                    <Box sx={tableCellSx}>
                                        <Typography sx={{
                                            fontWeight: 950,
                                            color: numeric(row?.lowStockLines) + numeric(row?.blockedStockLines) > 0
                                                ? "var(--mf-warning-text)"
                                                : "var(--mf-success-text)",
                                        }}>
                                            {numeric(row?.lowStockLines) + numeric(row?.blockedStockLines)}
                                        </Typography>
                                        <Typography sx={subTextSx}>
                                            {row?.lowStockLines ?? 0} low · {row?.blockedStockLines ?? 0} blocked
                                        </Typography>
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    </Card>
                </>
            )}
        </Box>
    );
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
            title="Project Tracker"
            subtitle="The primary MatFlow tracker is project-centric: each client Project contains its Products/Drawings, and every Product expands to its live material positions, department custody, elapsed stage time, shortage/procurement exposure and next operational action."
            actions={<Box sx={{ display: "flex", gap: .7, flexWrap: "wrap" }}>
                <Button onClick={() => navigate("/matflow/tracker/materials")} sx={primaryBtnSx}>Material Control Tower</Button>
                <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
            </Box>}
        />
        <ErrorBox>{error}</ErrorBox>

        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 1 }}>
            <SummaryCard label="Client Projects" tone="blue" value={projectKpis.projects} colorful />
            <SummaryCard label="Products / Items" tone="indigo" value={projectKpis.products} colorful />
            <SummaryCard label="Products Completed" tone="green" value={projectKpis.complete} colorful />
            <SummaryCard label="Shortage Exposed" tone="red" value={projectKpis.shortage} colorful />
            <SummaryCard label="Approval Pending" tone="amber" value={projectKpis.awaitingApproval} colorful />
            <SummaryCard label="Live Material Controls" tone="sky" value={projectKpis.activeMaterials} colorful />
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
            <SummaryCard label="Current Department" tone="sky" value={summary.currentDepartment || summary.responsibleDesk || "-"} />
            <SummaryCard label="Current Location" tone="sky" value={summary.currentLocationCode || summary.currentLocationName || "-"} />
            <SummaryCard label="Stage Time" tone="purple" value={formatDurationMinutes(summary.stageDurationMinutes || 0)} />
            <SummaryCard label="Total Lead Time" tone="purple" value={formatDurationMinutes(summary.totalLeadTimeMinutes || 0)} />
            <SummaryCard label="Progress" tone="green" value={`${summary.actualProgressPercent ?? summary.progressPercent ?? 0}%`} />
            <SummaryCard label="SLA Breaches" tone="red" value={cycle.slaBreachedStageCount ?? 0} />
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
                <SummaryCard label="Project Lead" tone="blue" value={formatDurationMinutes(cycle.totalProjectLeadTimeMinutes || 0)} />
                <SummaryCard label="Requisition Lead" tone="indigo" value={formatDurationMinutes(cycle.requisitionLeadTimeMinutes || 0)} />
                <SummaryCard label="Avg Completed Stage" tone="green" value={formatDurationMinutes(cycle.averageCompletedStageMinutes || 0)} />
                <SummaryCard label="Completed Stages" tone="green" value={`${cycle.completedStageCount || 0}/${cycle.applicableStageCount || 0}`} />
                <SummaryCard label="Longest Stage" tone="amber" value={cycle.bottleneckStage || "-"} />
                <SummaryCard label="Longest Duration" tone="orange" value={formatDurationMinutes(cycle.bottleneckMinutes || 0)} />
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
                actions={<><Button startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMatFlowExcel({ fileName: "MatFlow_Stock_Ledger", sheetName: "Stock Ledger", title: "MatFlow Immutable Stock Ledger", rows })} sx={secondaryBtnSx}>Export Excel</Button><Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button></>}
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
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialName || "-"}</Typography><Typography sx={subTextSx}>{row.materialCode || "-"}</Typography></Box>
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
                actions={<><Button startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMatFlowExcel({ fileName: "MatFlow_Shortage_Ageing_Report", sheetName: "Shortages", title: "MatFlow Shortage Ageing Report", rows: shortages })} sx={secondaryBtnSx}>Shortage Excel</Button><Button startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMatFlowExcel({ fileName: "MatFlow_Audit_Report", sheetName: "Audit", title: "MatFlow Audit Report", rows: audits })} sx={secondaryBtnSx}>Audit Excel</Button><Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button></>}
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
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialName || "-"}</Typography><Typography sx={subTextSx}>{row.materialCode || "-"}</Typography></Box>
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
    const [portfolio, setPortfolio] = useState([]);
    const [overviewTracker, setOverviewTracker] = useState(null);
    const [overviewLedger, setOverviewLedger] = useState([]);
    const [overviewShortages, setOverviewShortages] = useState([]);

    const [selectedProjectId, setSelectedProjectId] = useState("");
    const [selectedProductId, setSelectedProductId] = useState("");
    const [selectedId, setSelectedId] = useState(materialId || "");

    const [bomScopeMaterials, setBomScopeMaterials] = useState([]);
    const [scopeMaterialLoading, setScopeMaterialLoading] = useState(false);

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [overviewLoading, setOverviewLoading] = useState(true);
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

    const loadOverview = useCallback(async () => {
        setOverviewLoading(true);
        setError("");
        try {
            const [projectResponse, trackerResponse, ledgerResponse, shortageResponse] = await Promise.all([
                matflowApi.listProjectPortfolio({
                    active: true,
                    plantCode: selectedPlantParam || undefined,
                }),
                matflowApi.getTracker({
                    plantCode: selectedPlantParam || undefined,
                }),
                matflowApi.stockLedger({
                    plantCode: selectedPlantParam || undefined,
                    page: 0,
                    size: 250,
                }),
                matflowApi.shortageReport({
                    plantCode: selectedPlantParam || undefined,
                    minimumAgeDays: 0,
                }),
            ]);

            setPortfolio(Array.isArray(projectResponse?.data) ? projectResponse.data : []);
            setOverviewTracker(trackerResponse?.data || null);
            setOverviewLedger(extractMatFlowPage(ledgerResponse?.data).rows);
            setOverviewShortages(
                Array.isArray(shortageResponse?.data)
                    ? shortageResponse.data
                    : extractMatFlowPage(shortageResponse?.data).rows
            );
        } catch (requestError) {
            setPortfolio([]);
            setOverviewTracker(null);
            setOverviewLedger([]);
            setOverviewShortages([]);
            setError(readMatFlowError(requestError, "Unable to load the Material Control Tower overview."));
        } finally {
            setOverviewLoading(false);
        }
    }, [selectedPlantParam]);

    useEffect(() => {
        loadMaterials();
        loadOverview();
    }, [loadMaterials, loadOverview]);

    const projects = useMemo(
        () => portfolio.filter((project) => project?.active !== false),
        [portfolio]
    );

    const selectedProject = useMemo(
        () => projects.find((project) => String(project?.id) === String(selectedProjectId)) || null,
        [projects, selectedProjectId]
    );

    const projectProducts = useMemo(
        () => (Array.isArray(selectedProject?.products) ? selectedProject.products : [])
            .filter((product) => product?.active !== false),
        [selectedProject]
    );

    const selectedProduct = useMemo(
        () => projectProducts.find((product) => String(product?.id) === String(selectedProductId)) || null,
        [projectProducts, selectedProductId]
    );

    const productsInScope = useMemo(() => {
        if (!selectedProject) {
            return projects.flatMap((project) =>
                (Array.isArray(project?.products) ? project.products : [])
                    .filter((product) => product?.active !== false)
                    .map((product) => ({
                        ...product,
                        _projectId: project.id,
                        _projectCode: project.projectCode,
                        _projectName: project.projectName,
                        _clientName: project.clientName,
                    }))
            );
        }

        if (selectedProduct) {
            return [{
                ...selectedProduct,
                _projectId: selectedProject.id,
                _projectCode: selectedProject.projectCode,
                _projectName: selectedProject.projectName,
                _clientName: selectedProject.clientName,
            }];
        }

        return projectProducts.map((product) => ({
            ...product,
            _projectId: selectedProject.id,
            _projectCode: selectedProject.projectCode,
            _projectName: selectedProject.projectName,
            _clientName: selectedProject.clientName,
        }));
    }, [projects, selectedProject, selectedProduct, projectProducts]);

    const overviewRows = Array.isArray(overviewTracker?.rows) ? overviewTracker.rows : [];

    const rowMatchesScope = useCallback((row) => {
        if (!row) return false;

        if (selectedProductId) {
            return String(row.projectDrawingId || row.productId || "") === String(selectedProductId);
        }

        if (selectedProject) {
            if (row.projectId && String(row.projectId) === String(selectedProject.id)) {
                return true;
            }
            return clean(row.projectCode).toUpperCase() === clean(selectedProject.projectCode).toUpperCase();
        }

        return true;
    }, [selectedProject, selectedProductId]);

    const ledgerMatchesScope = useCallback((row) => {
        if (!row) return false;

        if (selectedProject) {
            const projectMatches =
                (row.projectId && String(row.projectId) === String(selectedProject.id)) ||
                clean(row.projectCode).toUpperCase() === clean(selectedProject.projectCode).toUpperCase();

            if (!projectMatches) return false;
        }

        if (selectedProduct) {
            const productIdMatches =
                row.projectDrawingId &&
                String(row.projectDrawingId) === String(selectedProduct.id);

            const drawingMatches =
                clean(row.drawingNo).toUpperCase() ===
                clean(selectedProduct.drawingNo).toUpperCase();

            if (!productIdMatches && !drawingMatches) return false;
        }

        return true;
    }, [selectedProject, selectedProduct]);

    const shortageMatchesScope = useCallback((row) => {
        if (!row) return false;

        if (selectedProject) {
            const projectMatches =
                (row.projectId && String(row.projectId) === String(selectedProject.id)) ||
                clean(row.projectCode).toUpperCase() === clean(selectedProject.projectCode).toUpperCase();

            if (!projectMatches) return false;
        }

        if (selectedProduct) {
            const productIdMatches =
                row.projectDrawingId &&
                String(row.projectDrawingId) === String(selectedProduct.id);

            const drawingMatches =
                clean(row.drawingNo).toUpperCase() ===
                clean(selectedProduct.drawingNo).toUpperCase();

            if (!productIdMatches && !drawingMatches) return false;
        }

        return true;
    }, [selectedProject, selectedProduct]);

    const scopedOverviewRows = useMemo(
        () => overviewRows.filter(rowMatchesScope),
        [overviewRows, rowMatchesScope]
    );

    const scopedLedgerRows = useMemo(
        () => overviewLedger.filter(ledgerMatchesScope),
        [overviewLedger, ledgerMatchesScope]
    );

    const scopedShortages = useMemo(
        () => overviewShortages.filter(shortageMatchesScope),
        [overviewShortages, shortageMatchesScope]
    );

    /*
     * Product-aware material discovery.
     *
     * Project Portfolio owns the Project -> Product hierarchy and exposes the
     * latest BOM for each Product. Read those BOMs only when the user narrows
     * the Control Tower to a Project/Product. This keeps the normal global
     * Material dropdown fast while ensuring a selected Product only offers the
     * materials that actually belong to its BOM/execution history.
     */
    useEffect(() => {
        let cancelled = false;

        const loadScopeMaterials = async () => {
            if (!selectedProject) {
                setBomScopeMaterials([]);
                setScopeMaterialLoading(false);
                return;
            }

            setScopeMaterialLoading(true);

            const productsToLoad = selectedProduct
                ? [selectedProduct]
                : projectProducts;

            try {
                const responses = await Promise.all(
                    productsToLoad
                        .filter((product) => product?.latestBomId)
                        .map(async (product) => {
                            try {
                                return (await matflowApi.getBom(product.latestBomId))?.data || null;
                            } catch {
                                return null;
                            }
                        })
                );

                if (cancelled) return;

                const materialMap = new Map();

                responses.filter(Boolean).forEach((bom) => {
                    const lines = [bom?.lines, bom?.bomLines, bom?.items].find(Array.isArray) || [];

                    lines.forEach((line) => {
                        const id = line?.materialId || line?.material?.id || null;
                        const code =
                            line?.materialCodeSnapshot ||
                            line?.materialCode ||
                            line?.material?.materialCode ||
                            "";
                        const name =
                            line?.materialNameSnapshot ||
                            line?.materialName ||
                            line?.material?.materialName ||
                            "";
                        const uom =
                            line?.uomSnapshot ||
                            line?.uom ||
                            line?.material?.uom ||
                            "";

                        const key = id ? `ID:${id}` : `CODE:${clean(code).toUpperCase()}`;
                        if (key === "CODE:") return;

                        materialMap.set(key, {
                            id,
                            materialCode: code,
                            materialName: name,
                            uom,
                        });
                    });
                });

                setBomScopeMaterials(Array.from(materialMap.values()));
            } finally {
                if (!cancelled) setScopeMaterialLoading(false);
            }
        };

        loadScopeMaterials();

        return () => {
            cancelled = true;
        };
    }, [selectedProject, selectedProduct, projectProducts]);

    const masterMaterialById = useMemo(
        () => new Map(materials.map((material) => [String(material.id), material])),
        [materials]
    );

    const masterMaterialByCode = useMemo(
        () => new Map(
            materials
                .filter((material) => clean(material.materialCode))
                .map((material) => [clean(material.materialCode).toUpperCase(), material])
        ),
        [materials]
    );

    const materialOptions = useMemo(() => {
        if (!selectedProject) {
            return materials
                .filter((material) => material?.active !== false)
                .sort((a, b) =>
                    `${a.materialCode || ""} ${a.materialName || ""}`.localeCompare(
                        `${b.materialCode || ""} ${b.materialName || ""}`
                    )
                );
        }

        const map = new Map();

        const addMaterial = (candidate) => {
            if (!candidate) return;

            const direct =
                candidate.id != null
                    ? masterMaterialById.get(String(candidate.id))
                    : null;

            const byCode = masterMaterialByCode.get(
                clean(candidate.materialCode).toUpperCase()
            );

            const resolved = direct || byCode || candidate;
            const id = resolved?.id || candidate?.id;
            const code = resolved?.materialCode || candidate?.materialCode || "";
            const name = resolved?.materialName || candidate?.materialName || "";
            if (!id && !code) return;

            const key = id ? `ID:${id}` : `CODE:${clean(code).toUpperCase()}`;
            map.set(key, {
                ...resolved,
                id: id || null,
                materialCode: code,
                materialName: name,
                uom: resolved?.uom || candidate?.uom || "",
            });
        };

        bomScopeMaterials.forEach(addMaterial);

        scopedLedgerRows.forEach((row) =>
            addMaterial({
                id: row.materialId,
                materialCode: row.materialCode,
                materialName: row.materialName,
                uom: row.uom,
            })
        );

        scopedShortages.forEach((row) =>
            addMaterial({
                id: row.materialId,
                materialCode: row.materialCode,
                materialName: row.materialName,
                uom: row.uom,
            })
        );

        return Array.from(map.values())
            .filter((material) => material?.active !== false)
            .sort((a, b) =>
                `${a.materialCode || ""} ${a.materialName || ""}`.localeCompare(
                    `${b.materialCode || ""} ${b.materialName || ""}`
                )
            );
    }, [
        selectedProject,
        materials,
        masterMaterialById,
        masterMaterialByCode,
        bomScopeMaterials,
        scopedLedgerRows,
        scopedShortages,
    ]);

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

    const materialLotMatchesScope = useCallback((lot) => {
        if (!lot) return false;

        if (selectedProject) {
            const projectMatches =
                (lot.projectId && String(lot.projectId) === String(selectedProject.id)) ||
                clean(lot.projectCode).toUpperCase() === clean(selectedProject.projectCode).toUpperCase();

            if (!projectMatches) return false;
        }

        if (selectedProduct) {
            const productMatches =
                (lot.productId && String(lot.productId) === String(selectedProduct.id)) ||
                clean(lot.drawingNo).toUpperCase() === clean(selectedProduct.drawingNo).toUpperCase();

            if (!productMatches) return false;
        }

        return true;
    }, [selectedProject, selectedProduct]);

    const lots = Array.isArray(data?.lots) ? data.lots : [];

    const scopedLots = useMemo(
        () => lots.filter(materialLotMatchesScope),
        [lots, materialLotMatchesScope]
    );

    const filteredLots = useMemo(
        () => scopedLots.filter((lot) => materialTowerMatches(lot, search)),
        [scopedLots, search]
    );

    const lotPagination = useMatFlowPagination(filteredLots, 10);

    const rawMovementRows = Array.isArray(data?.movementHistory) ? data.movementHistory : [];
    const movementRows = useMemo(
        () => rawMovementRows.filter(ledgerMatchesScope),
        [rawMovementRows, ledgerMatchesScope]
    );
    const movementPagination = useMatFlowPagination(movementRows, 20);

    const projectGroups = useMemo(() => {
        const groupedProjects = new Map();

        lotPagination.pageItems.forEach((lot) => {
            const projectKey = String(lot.projectId || lot.projectCode || "UNASSIGNED");

            if (!groupedProjects.has(projectKey)) {
                groupedProjects.set(projectKey, {
                    key: projectKey,
                    projectId: lot.projectId,
                    projectCode: lot.projectCode,
                    projectName: lot.projectName,
                    clientName: lot.clientName,
                    plantCode: lot.plantCode,
                    products: new Map(),
                });
            }

            const project = groupedProjects.get(projectKey);
            const productKey = String(
                lot.productId || `${lot.productName || "-"}:${lot.drawingNo || "-"}`
            );

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

        return Array.from(groupedProjects.values()).map((project) => ({
            ...project,
            products: Array.from(project.products.values()),
        }));
    }, [lotPagination.pageItems]);

    const backendKpis = data?.kpis || {};
    const identity = data?.material || {};
    const inventory = Array.isArray(data?.inventory) ? data.inventory : [];

    /*
     * The backend KPI is authoritative for global material tracking.
     * When Project/Product scope is selected, calculate line totals once per
     * requisition line so multiple reservation lots never double-count demand.
     * Physical inventory remains plant/material-wide because stock on hand is
     * not owned by a Project until it is reserved.
     */
    const displayKpis = useMemo(() => {
        if (!selectedProject && !selectedProduct) return backendKpis;

        const lineMap = new Map();

        scopedLots.forEach((lot) => {
            const key = String(
                lot.requisitionLineId ||
                `${lot.requisitionId || ""}:${lot.currentMaterialId || lot.currentMaterialCode || ""}`
            );

            const current = lineMap.get(key) || {
                requestedQty: 0,
                reservedQty: 0,
                shortageQty: 0,
                issuedQty: 0,
                consumedQty: 0,
                returnedQty: 0,
            };

            current.requestedQty = Math.max(current.requestedQty, numeric(lot.lineRequestedQty));
            current.reservedQty = Math.max(current.reservedQty, numeric(lot.lineReservedQty));
            current.shortageQty = Math.max(current.shortageQty, numeric(lot.lineShortageQty));
            current.issuedQty = Math.max(current.issuedQty, numeric(lot.lineIssuedQty));
            current.consumedQty = Math.max(current.consumedQty, numeric(lot.lineConsumedQty));
            current.returnedQty = Math.max(current.returnedQty, numeric(lot.lineReturnedQty));

            lineMap.set(key, current);
        });

        const lineRows = Array.from(lineMap.values());
        const liveLots = scopedLots.filter((lot) => !lot.completed);
        const projectCount = new Set(
            scopedLots.map((lot) => lot.projectId || lot.projectCode).filter(Boolean)
        ).size;
        const productCount = new Set(
            scopedLots.map((lot) => lot.productId || `${lot.productName || ""}:${lot.drawingNo || ""}`).filter(Boolean)
        ).size;
        const delayedLotCount = liveLots.filter((lot) =>
            ["BREACHED", "COMPLETED_LATE"].includes(normalize(lot.timingHealth))
        ).length;

        const averageCurrentDwellMinutes = liveLots.length
            ? Math.round(
                liveLots.reduce((sum, lot) => sum + numeric(lot.currentDwellMinutes), 0) /
                liveLots.length
            )
            : 0;

        const longestCurrentDwellMinutes = liveLots.reduce(
            (max, lot) => Math.max(max, numeric(lot.currentDwellMinutes)),
            0
        );

        const sum = (field) =>
            lineRows.reduce((total, row) => total + numeric(row[field]), 0);

        return {
            ...backendKpis,
            projectCount,
            productCount,
            trackedLotCount: scopedLots.length,
            liveLotCount: liveLots.length,
            delayedLotCount,
            requestedQty: sum("requestedQty"),
            reservedQty: sum("reservedQty"),
            shortageQty: sum("shortageQty"),
            issuedQty: sum("issuedQty"),
            consumedQty: sum("consumedQty"),
            returnedQty: sum("returnedQty"),
            averageCurrentDwellMinutes,
            longestCurrentDwellMinutes,
        };
    }, [backendKpis, scopedLots, selectedProject, selectedProduct]);

    const scopeLabel = useMemo(() => {
        if (selectedProject && selectedProduct) {
            return `${selectedProject.projectCode || selectedProject.projectName || "Project"} → ${selectedProduct.productName || "Product"} · ${selectedProduct.drawingNo || "-"}`;
        }
        if (selectedProject) {
            return `${selectedProject.projectCode || selectedProject.projectName || "Project"} → All Products`;
        }
        return "All Accessible Projects / Products";
    }, [selectedProject, selectedProduct]);

    const changeProject = (event) => {
        const nextProjectId = event.target.value;
        setSelectedProjectId(nextProjectId);
        setSelectedProductId("");
        setSelectedId("");
        setData(null);
        setSearch("");
        setExpandedLots({});
        navigate("/matflow/tracker/materials");
    };

    const changeProduct = (event) => {
        const nextProductId = event.target.value;
        setSelectedProductId(nextProductId);
        setSelectedId("");
        setData(null);
        setSearch("");
        setExpandedLots({});
        navigate("/matflow/tracker/materials");
    };

    const changeMaterial = (event) => {
        const nextId = event.target.value;
        setSelectedId(nextId);
        setExpandedLots({});
        setSearch("");

        if (nextId) {
            navigate(`/matflow/tracker/materials/${nextId}`);
        } else {
            navigate("/matflow/tracker/materials");
        }
    };

    const trackMaterial = (material) => {
        if (!material?.id) return;
        setSelectedId(String(material.id));
        setExpandedLots({});
        setSearch("");
        navigate(`/matflow/tracker/materials/${material.id}`);
    };

    const toggleLot = (lotKey) => {
        setExpandedLots((current) => ({
            ...current,
            [lotKey]: !current[lotKey],
        }));
    };

    const liveOverviewRows = useMemo(
        () => scopedOverviewRows.filter((row) =>
            !["CANCELLED", "PRODUCTION_COMPLETED", "COMPLETED", "CLOSED"].includes(
                normalize(row.currentStage || row.requisitionStatus)
            )
        ),
        [scopedOverviewRows]
    );

    const overviewStats = useMemo(() => {
        const scopeProjects = selectedProject ? 1 : projects.length;
        const scopeProducts = selectedProject
            ? (selectedProduct ? 1 : projectProducts.length)
            : productsInScope.length;

        const activeControls = liveOverviewRows.reduce(
            (total, row) =>
                total +
                Number(row.reservationCount || 0) +
                Number(row.openIndentCount || 0),
            0
        );

        const shortageMaterials = new Set(
            scopedShortages
                .map((row) => row.materialId || clean(row.materialCode).toUpperCase())
                .filter(Boolean)
        );

        const delayed = liveOverviewRows.filter((row) =>
            ["BREACHED", "COMPLETED_LATE"].includes(normalize(row.timingHealth))
        ).length;

        const watching = liveOverviewRows.filter((row) =>
            normalize(row.timingHealth) === "WATCH"
        ).length;

        const inTransit = liveOverviewRows.filter((row) =>
            normalize(row.currentDepartment) === "IN_TRANSIT" ||
            normalize(row.currentStage).includes("TRANSFER")
        ).length;

        const materialUniverse = selectedProject
            ? materialOptions.length
            : materials.filter((material) => material?.active !== false).length;

        return {
            projects: scopeProjects,
            products: scopeProducts,
            materials: materialUniverse,
            liveRequisitions: liveOverviewRows.length,
            activeControls,
            shortageMaterials: shortageMaterials.size,
            slaRisk: delayed + watching,
            inTransit,
        };
    }, [
        selectedProject,
        selectedProduct,
        projects,
        projectProducts,
        productsInScope,
        liveOverviewRows,
        scopedShortages,
        materialOptions,
        materials,
    ]);

    const stageSnapshot = useMemo(() => {
        const buckets = [
            ["Demand / Planning", "DEMAND", "blue"],
            ["Store", "STORE", "indigo"],
            ["Purchase", "PURCHASE", "amber"],
            ["QC", "QC", "purple"],
            ["Processing", "PROCESSING", "orange"],
            ["In Transit", "IN_TRANSIT", "sky"],
            ["Production", "PRODUCTION", "green"],
        ];

        return buckets.map(([label, key, tone]) => {
            const count = liveOverviewRows.filter((row) => {
                const department = normalize(row.currentDepartment);
                const stage = normalize(row.currentStage);

                if (key === "DEMAND") {
                    return ["DRAFT", "DEMAND", "PRODUCTION_REQUISITION"].some(
                        (value) => stage.includes(value)
                    );
                }

                if (key === "IN_TRANSIT") {
                    return department === "IN_TRANSIT" || stage.includes("TRANSFER");
                }

                return department.includes(key) || stage.includes(key);
            }).length;

            return { label, key, tone, count };
        });
    }, [liveOverviewRows]);

    const latestActivities = useMemo(
        () => [...scopedLedgerRows]
            .sort((a, b) =>
                new Date(b.actionAt || b.createdAt || 0).getTime() -
                new Date(a.actionAt || a.createdAt || 0).getTime()
            )
            .slice(0, 12),
        [scopedLedgerRows]
    );

    const attentionMaterials = useMemo(() => {
        const map = new Map();

        scopedShortages.forEach((row) => {
            const key = row.materialId || clean(row.materialCode).toUpperCase() || row.materialName;
            if (!key) return;

            const current = map.get(key) || {
                materialId: row.materialId || null,
                materialCode: row.materialCode || "",
                materialName: row.materialName || "",
                shortageLines: 0,
                maxAgeDays: 0,
                projects: new Set(),
            };

            current.shortageLines += 1;
            current.maxAgeDays = Math.max(current.maxAgeDays, Number(row.ageDays || 0));
            if (row.projectCode) current.projects.add(row.projectCode);
            map.set(key, current);
        });

        return Array.from(map.values())
            .map((row) => ({
                ...row,
                projectCount: row.projects.size,
            }))
            .sort((a, b) => b.maxAgeDays - a.maxAgeDays)
            .slice(0, 10);
    }, [scopedShortages]);

    const recentMaterials = useMemo(() => {
        const map = new Map();

        latestActivities.forEach((row) => {
            const key = row.materialId || clean(row.materialCode).toUpperCase() || row.materialName;
            if (!key) return;

            if (!map.has(key)) {
                map.set(key, {
                    materialId: row.materialId || null,
                    materialCode: row.materialCode || "",
                    materialName: row.materialName || "",
                    locationCode: row.locationCode || "",
                    movementType: row.movementType || "",
                    actionAt: row.actionAt || row.createdAt || null,
                    actor: row.actor || "",
                });
            }
        });

        return Array.from(map.values()).slice(0, 8);
    }, [latestActivities]);

    const scopedMaterialCatalog = useMemo(
        () => materialOptions.slice(0, 24),
        [materialOptions]
    );

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="DIRECTOR MATERIAL CUSTODY CONTROL"
                title="Material Control Tower"
                subtitle="Select Project → Product → Material for an exact product-owned custody trace. Leave Material blank to see the live material operations overview, recent activity, shortages, SLA risk and materials available in the selected Project/Product scope."
                actions={
                    <Box sx={{ display: "flex", gap: .7, flexWrap: "wrap" }}>
                        <Button onClick={() => navigate("/matflow/tracker")} sx={secondaryBtnSx}>Project Tracker</Button>
                        <Button
                            startIcon={<RefreshIcon />}
                            disabled={loading || overviewLoading}
                            onClick={() => {
                                loadOverview();
                                if (selectedId) loadTracker();
                            }}
                            sx={secondaryBtnSx}
                        >
                            Refresh
                        </Button>
                    </Box>
                }
            />

            <ErrorBox>{error}</ErrorBox>

            <Card sx={panelSx}>
                <Box sx={{ mb: 1.15 }}>
                    <Typography sx={{ fontSize: 16, fontWeight: 950 }}>Tracking Scope</Typography>
                    <Typography sx={subTextSx}>
                        {scopeLabel}. Choose a Project and Product to narrow the Material list to that Product's BOM and execution history. Keeping Project blank preserves the original global material tracking behavior.
                    </Typography>
                </Box>

                <Box sx={{
                    display: "grid",
                    gridTemplateColumns: {
                        xs: "1fr",
                        md: "repeat(2,minmax(0,1fr))",
                        xl: "repeat(4,minmax(0,1fr))",
                    },
                    gap: 1,
                }}>
                    <TextField
                        select
                        label="Project"
                        value={selectedProjectId}
                        onChange={changeProject}
                        sx={fieldSx}
                    >
                        <MenuItem value="">All Projects</MenuItem>
                        {projects.map((project) => (
                            <MenuItem key={project.id} value={project.id}>
                                {project.projectCode || "-"} · {project.projectName || "Project"} · {project.clientName || "-"}
                            </MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        select
                        label="Product / Drawing"
                        value={selectedProductId}
                        onChange={changeProduct}
                        disabled={!selectedProject}
                        sx={fieldSx}
                    >
                        <MenuItem value="">All Products in Project</MenuItem>
                        {projectProducts.map((product) => (
                            <MenuItem key={product.id} value={product.id}>
                                {product.productName || "-"} · {product.drawingNo || "-"} · Rev {product.drawingRevision ?? "0"}
                            </MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        select
                        label="Material to Track"
                        value={selectedId}
                        onChange={changeMaterial}
                        disabled={materialLoading || scopeMaterialLoading}
                        sx={fieldSx}
                    >
                        <MenuItem value="">
                            {selectedProject
                                ? "Overview · Select a Material"
                                : "Overview · Select Any Material"}
                        </MenuItem>
                        {materialOptions.map((material) => (
                            <MenuItem
                                key={material.id || `material:${material.materialCode}`}
                                value={material.id || ""}
                                disabled={!material.id}
                            >
                                {material.materialName || "Material"} · {material.materialCode || "-"}
                                {material.uom ? ` · ${material.uom}` : ""}
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
                </Box>

                {selectedId && (
                    <Box sx={{ mt: 1 }}>
                        <TextField
                            fullWidth
                            label="Filter Project / Product / Requisition / Location"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            sx={fieldSx}
                        />
                    </Box>
                )}
            </Card>

            {!selectedId ? (
                overviewLoading || materialLoading ? (
                    <LoadingBlock />
                ) : (
                    <>
                        <Box sx={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))",
                            gap: 1,
                        }}>
                            <SummaryCard label="Projects in Scope" tone="blue" value={overviewStats.projects} colorful />
                            <SummaryCard label="Products / Drawings" tone="indigo" value={overviewStats.products} colorful />
                            <SummaryCard label="Materials Available" tone="purple" value={overviewStats.materials} colorful />
                            <SummaryCard label="Live Requisitions" tone="sky" value={overviewStats.liveRequisitions} colorful />
                            <SummaryCard label="Live Material Controls" tone="indigo" value={overviewStats.activeControls} colorful />
                            <SummaryCard label="Materials in Shortage" tone="red" value={overviewStats.shortageMaterials} colorful />
                            <SummaryCard label="SLA Risk / Breach" tone="amber" value={overviewStats.slaRisk} colorful />
                            <SummaryCard label="In Transit" tone="sky" value={overviewStats.inTransit} colorful />
                        </Box>

                        <Card sx={panelSx}>
                            <Box sx={{ mb: 1 }}>
                                <Typography sx={{ fontSize: 17, fontWeight: 950 }}>Live Material Stages</Typography>
                                <Typography sx={subTextSx}>
                                    Current material-control ownership for {scopeLabel}. These are live Requisition-level control points; choose a specific Material above for reservation/lot-level custody timing.
                                </Typography>
                            </Box>

                            <Box sx={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit,minmax(135px,1fr))",
                                gap: .85,
                            }}>
                                {stageSnapshot.map((stage) => (
                                    <SummaryCard
                                        key={stage.key}
                                        label={stage.label}
                                        tone={stage.tone}
                                        value={stage.count}
                                        colorful
                                    />
                                ))}
                            </Box>
                        </Card>

                        {selectedProject && (
                            <Card sx={panelSx}>
                                <Box sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                    gap: 1,
                                    flexWrap: "wrap",
                                    mb: 1,
                                }}>
                                    <Box>
                                        <Typography sx={{ fontSize: 17, fontWeight: 950 }}>
                                            Materials Available to Track
                                        </Typography>
                                        <Typography sx={subTextSx}>
                                            Derived from the selected Product's latest BOM plus material movement/shortage history in this Project scope.
                                        </Typography>
                                    </Box>
                                    {scopeMaterialLoading && <Typography sx={subTextSx}>Loading Product BOM materials…</Typography>}
                                </Box>

                                {scopedMaterialCatalog.length === 0 ? (
                                    <EmptyState>
                                        No material could be resolved for this Project/Product scope yet. Create/approve the Product BOM or begin material execution and it will appear here.
                                    </EmptyState>
                                ) : (
                                    <Box sx={tableShellSx}>
                                        <Box sx={{
                                            ...tableHeaderSx,
                                            gridTemplateColumns: "180px minmax(240px,1fr) 110px 120px",
                                        }}>
                                            {["Material", "Name", "UOM", "Tracking"].map((heading) => (
                                                <Box key={heading} sx={tableCellSx}>{heading}</Box>
                                            ))}
                                        </Box>

                                        {scopedMaterialCatalog.map((material) => (
                                            <Box
                                                key={material.id || `catalog:${material.materialCode}`}
                                                sx={{
                                                    ...tableRowSx,
                                                    gridTemplateColumns: "180px minmax(240px,1fr) 110px 120px",
                                                }}
                                            >
                                                <Box sx={tableCellSx}>
                                                    <Typography sx={mainTextSx}>{material.materialCode || "-"}</Typography>
                                                </Box>
                                                <Box sx={tableCellSx}>
                                                    <Typography sx={mainTextSx}>{material.materialName || "-"}</Typography>
                                                    <Typography sx={subTextSx}>{readable(material.category || "")}</Typography>
                                                </Box>
                                                <Box sx={tableCellSx}>{material.uom || "-"}</Box>
                                                <Box sx={tableCellSx}>
                                                    {material.id ? (
                                                        <Button
                                                            onClick={() => trackMaterial(material)}
                                                            sx={primaryBtnSx}
                                                        >
                                                            Track
                                                        </Button>
                                                    ) : (
                                                        <Typography sx={subTextSx}>Master ID unavailable</Typography>
                                                    )}
                                                </Box>
                                            </Box>
                                        ))}
                                    </Box>
                                )}
                            </Card>
                        )}

                        <Box sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", xl: "1.25fr .75fr" },
                            gap: 1,
                            alignItems: "start",
                        }}>
                            <Card sx={panelSx}>
                                <Box sx={{ mb: 1 }}>
                                    <Typography sx={{ fontSize: 17, fontWeight: 950 }}>Latest Material Activities</Typography>
                                    <Typography sx={subTextSx}>
                                        Latest immutable stock-ledger movements in {scopeLabel}. Select a Material to open its complete custody timeline.
                                    </Typography>
                                </Box>

                                <Box sx={tableShellSx}>
                                    <Box sx={{
                                        ...tableHeaderSx,
                                        gridTemplateColumns: "165px 170px 160px minmax(170px,1fr) 160px 145px",
                                    }}>
                                        {["Time", "Material", "Movement", "Location", "Project / Drawing", "Actor"].map((heading) => (
                                            <Box key={heading} sx={tableCellSx}>{heading}</Box>
                                        ))}
                                    </Box>

                                    {latestActivities.length === 0 ? (
                                        <EmptyState>No material movement has been recorded in the selected scope.</EmptyState>
                                    ) : latestActivities.map((row, index) => (
                                        <Box
                                            key={row.id || row.ledgerId || `${row.actionAt}:${index}`}
                                            sx={{
                                                ...tableRowSx,
                                                gridTemplateColumns: "165px 170px 160px minmax(170px,1fr) 160px 145px",
                                            }}
                                        >
                                            <Box sx={tableCellSx}>{formatDate(row.actionAt || row.createdAt)}</Box>
                                            <Box sx={tableCellSx}>
                                                <Typography sx={mainTextSx}>{row.materialCode || "-"}</Typography>
                                                <Typography sx={subTextSx}>{row.materialName || "-"}</Typography>
                                            </Box>
                                            <Box sx={tableCellSx}><MatFlowStatusChip status={row.movementType} /></Box>
                                            <Box sx={tableCellSx}>
                                                <Typography sx={mainTextSx}>{row.locationCode || "-"}</Typography>
                                                <Typography sx={subTextSx}>{row.locationName || row.plantCode || "-"}</Typography>
                                            </Box>
                                            <Box sx={tableCellSx}>
                                                <Typography sx={mainTextSx}>{row.projectCode || "-"}</Typography>
                                                <Typography sx={subTextSx}>{row.drawingNo || "-"}</Typography>
                                            </Box>
                                            <Box sx={tableCellSx}>{row.actor || "-"}</Box>
                                        </Box>
                                    ))}
                                </Box>
                            </Card>

                            <Card sx={panelSx}>
                                <Typography sx={{ fontSize: 17, fontWeight: 950 }}>Recently Active Materials</Typography>
                                <Typography sx={{ ...subTextSx, mb: 1 }}>
                                    Most recently moved material identities in the current scope.
                                </Typography>

                                <Box sx={{ display: "grid", gap: .7 }}>
                                    {recentMaterials.length === 0 ? (
                                        <EmptyState>No recent material activity.</EmptyState>
                                    ) : recentMaterials.map((row, index) => {
                                        const master =
                                            (row.materialId && masterMaterialById.get(String(row.materialId))) ||
                                            masterMaterialByCode.get(clean(row.materialCode).toUpperCase());

                                        return (
                                            <Box
                                                key={row.materialId || row.materialCode || index}
                                                sx={{
                                                    p: .9,
                                                    borderRadius: 1.6,
                                                    border: "1px solid var(--mf-border)",
                                                    background: "var(--mf-surface)",
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    gap: 1,
                                                    alignItems: "center",
                                                }}
                                            >
                                                <Box sx={{ minWidth: 0 }}>
                                                    <Typography sx={mainTextSx}>
                                                        {row.materialName || "Material"} · {row.materialCode || "-"}
                                                    </Typography>
                                                    <Typography sx={subTextSx}>
                                                        {readable(row.movementType)} · {row.locationCode || "-"} · {formatDate(row.actionAt)}
                                                    </Typography>
                                                </Box>
                                                {master?.id && (
                                                    <Button
                                                        onClick={() => trackMaterial(master)}
                                                        sx={secondaryBtnSx}
                                                    >
                                                        Track
                                                    </Button>
                                                )}
                                            </Box>
                                        );
                                    })}
                                </Box>
                            </Card>
                        </Box>

                        <Card sx={panelSx}>
                            <Box sx={{ mb: 1 }}>
                                <Typography sx={{ fontSize: 17, fontWeight: 950 }}>Material Attention Queue</Typography>
                                <Typography sx={subTextSx}>
                                    Materials with open shortage exposure, ordered by the oldest shortage age. This is a count-based overview so quantities with different UOMs are never incorrectly added together.
                                </Typography>
                            </Box>

                            <Box sx={tableShellSx}>
                                <Box sx={{
                                    ...tableHeaderSx,
                                    gridTemplateColumns: "180px minmax(230px,1fr) 130px 130px 130px",
                                }}>
                                    {["Material", "Name", "Shortage Lines", "Projects", "Oldest Age"].map((heading) => (
                                        <Box key={heading} sx={tableCellSx}>{heading}</Box>
                                    ))}
                                </Box>

                                {attentionMaterials.length === 0 ? (
                                    <EmptyState>No open material shortages exist in the selected scope.</EmptyState>
                                ) : attentionMaterials.map((row, index) => (
                                    <Box
                                        key={row.materialId || row.materialCode || index}
                                        sx={{
                                            ...tableRowSx,
                                            gridTemplateColumns: "180px minmax(230px,1fr) 130px 130px 130px",
                                        }}
                                    >
                                        <Box sx={tableCellSx}>{row.materialCode || "-"}</Box>
                                        <Box sx={tableCellSx}>{row.materialName || "-"}</Box>
                                        <Box sx={tableCellSx}>{row.shortageLines}</Box>
                                        <Box sx={tableCellSx}>{row.projectCount}</Box>
                                        <Box sx={tableCellSx}>
                                            <MatFlowStatusChip status={row.maxAgeDays >= 3 ? "BREACHED" : row.maxAgeDays >= 1 ? "WATCH" : "OPEN"} />
                                            <Typography sx={subTextSx}>{row.maxAgeDays}d</Typography>
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        </Card>
                    </>
                )
            ) : loading ? (
                <LoadingBlock />
            ) : !data ? (
                <Card sx={panelSx}>
                    <EmptyState>No material tracking data is available.</EmptyState>
                </Card>
            ) : (
                <>
                    <Card sx={{ ...panelSx, overflow: "hidden" }}>
                        <Box sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 1.2,
                            alignItems: "flex-start",
                            flexWrap: "wrap",
                        }}>
                            <Box>
                                <Typography sx={{ ...subTextSx, fontSize: 10 }}>TRACKING MATERIAL</Typography>
                                <Typography sx={{ fontSize: 22, fontWeight: 950 }}>
                                    {identity.materialName || "-"} · {identity.materialCode || "-"}
                                </Typography>
                                <Typography sx={subTextSx}>
                                    {readable(identity.category)} · {identity.specification || "No specification"} · {identity.uom || "-"}
                                    {identity.preferredSupplier ? ` · Preferred supplier: ${identity.preferredSupplier}` : ""}
                                </Typography>
                                <Typography sx={{ ...subTextSx, mt: .45 }}>
                                    Scope: {scopeLabel}
                                </Typography>
                            </Box>
                            <MatFlowStatusChip status={identity.active === false ? "INACTIVE" : "ACTIVE"} />
                        </Box>
                    </Card>

                    <Box sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))",
                        gap: 1,
                    }}>
                        <SummaryCard label="Projects" tone="blue" value={displayKpis.projectCount || 0} colorful />
                        <SummaryCard label="Products / Drawings" tone="indigo" value={displayKpis.productCount || 0} colorful />
                        <SummaryCard label="Tracked Lots / Branches" tone="purple" value={displayKpis.trackedLotCount || 0} colorful />
                        <SummaryCard label="Live Lots" tone="sky" value={displayKpis.liveLotCount || 0} colorful />
                        <SummaryCard label="Delayed / SLA Breach" tone="red" value={displayKpis.delayedLotCount || 0} colorful />
                        <SummaryCard label="Requested" tone="blue" value={`${formatQty(displayKpis.requestedQty)} ${identity.uom || ""}`} colorful />
                        <SummaryCard label="Current Shortage" tone="red" value={`${formatQty(displayKpis.shortageQty)} ${identity.uom || ""}`} colorful />
                        <SummaryCard label={selectedProject ? "Plant On Hand" : "On Hand"} tone="indigo" value={`${formatQty(displayKpis.onHandQty)} ${identity.uom || ""}`} colorful />
                        <SummaryCard label={selectedProject ? "Plant Available" : "Available"} tone="green" value={`${formatQty(displayKpis.availableQty)} ${identity.uom || ""}`} colorful />
                        <SummaryCard label="Avg Live Dwell" tone="amber" value={formatDurationMinutes(displayKpis.averageCurrentDwellMinutes || 0)} colorful />
                        <SummaryCard label="Longest Live Dwell" tone="orange" value={formatDurationMinutes(displayKpis.longestCurrentDwellMinutes || 0)} colorful />
                    </Box>

                    <Card sx={panelSx}>
                        <Box sx={{ mb: 1 }}>
                            <Typography sx={{ fontSize: 17, fontWeight: 950 }}>Physical Stock Position</Typography>
                            <Typography sx={subTextSx}>
                                Inventory is physical plant/location stock for this material. Project/Product scope is applied to custody lots and movement history; unreserved stock is intentionally not falsely assigned to a Project.
                            </Typography>
                        </Box>

                        <Box sx={tableShellSx}>
                            <Box sx={{
                                ...tableHeaderSx,
                                gridTemplateColumns: "170px 180px 120px 120px 120px 120px 120px 120px",
                            }}>
                                {["Plant", "Location", "On Hand", "Reserved", "Blocked", "In Transit", "Available", "Updated"].map((heading) => (
                                    <Box key={heading} sx={tableCellSx}>{heading}</Box>
                                ))}
                            </Box>

                            {inventory.length === 0 ? (
                                <EmptyState>No physical stock position exists for this material.</EmptyState>
                            ) : inventory.map((row) => (
                                <Box
                                    key={`${row.locationId || row.locationCode}`}
                                    sx={{
                                        ...tableRowSx,
                                        gridTemplateColumns: "170px 180px 120px 120px 120px 120px 120px 120px",
                                    }}
                                >
                                    <Box sx={tableCellSx}>{row.plantCode || "-"}</Box>
                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>{row.locationCode || "-"}</Typography>
                                        <Typography sx={subTextSx}>{row.locationName || readable(row.locationType)}</Typography>
                                    </Box>
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
                        <Box sx={{ px: 1.5, py: 1.25, borderBottom: "1px solid var(--mf-border)" }}>
                            <Typography sx={{ fontSize: 18, fontWeight: 950 }}>Project / Product Material Custody</Typography>
                            <Typography sx={subTextSx}>
                                Each row is a live material trace branch: pre-allocation demand/Store review, a reservation-backed physical lot, or an open Purchase-shortage branch. Current, previous and next positions are derived from the actual Requisition, Store, PO/GRN, QC, Transfer, Processing, Production and Return records.
                            </Typography>
                        </Box>

                        {filteredLots.length === 0 ? (
                            <Box sx={{ p: 1.5 }}>
                                <EmptyState>No Project/Product material lots match the selected scope.</EmptyState>
                            </Box>
                        ) : projectGroups.map((project) => (
                            <Box key={project.key} sx={{ borderBottom: "1px solid var(--mf-border)" }}>
                                <Box sx={{ px: 1.6, py: 1.25, background: "var(--mf-surface)" }}>
                                    <Typography sx={{ ...subTextSx, fontSize: 9.5 }}>CLIENT PROJECT</Typography>
                                    <Typography sx={{ fontSize: 17, fontWeight: 950 }}>
                                        {project.projectCode || "UNASSIGNED"} · {project.projectName || "Project"}
                                    </Typography>
                                    <Typography sx={subTextSx}>
                                        {project.clientName || "-"} · {project.plantCode || "-"}
                                    </Typography>
                                </Box>

                                {project.products.map((product) => (
                                    <Box
                                        key={product.key}
                                        sx={{
                                            px: 1.35,
                                            py: 1.15,
                                            borderTop: "1px solid var(--mf-border)",
                                        }}
                                    >
                                        <Box sx={{ mb: 1 }}>
                                            <Typography sx={{ ...subTextSx, fontSize: 9.5 }}>PRODUCT / DRAWING</Typography>
                                            <Typography sx={{ fontSize: 15.5, fontWeight: 950 }}>
                                                {product.productName || "-"} · {product.drawingNo || "-"} · Rev {product.drawingRevision ?? "0"}
                                            </Typography>
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
                                                    <Box
                                                        key={lot.lotKey}
                                                        sx={{
                                                            border: "1px solid var(--mf-border)",
                                                            borderRadius: 2,
                                                            overflow: "hidden",
                                                            background: "var(--mf-panel-solid)",
                                                        }}
                                                    >
                                                        <Box sx={{
                                                            p: 1.15,
                                                            display: "flex",
                                                            justifyContent: "space-between",
                                                            gap: 1,
                                                            alignItems: "flex-start",
                                                            flexWrap: "wrap",
                                                        }}>
                                                            <Box>
                                                                <Typography sx={{ fontSize: 14.5, fontWeight: 950 }}>
                                                                    {lot.requisitionNumber || "-"} · {lot.currentMaterialCode || identity.materialCode}
                                                                </Typography>
                                                                <Typography sx={subTextSx}>
                                                                    {lot.sourceBranch === "PURCHASE_SHORTAGE" ? "Open Purchase shortage" : lot.sourceBranch === "DEMAND" ? "Demand / Store planning" : "Reservation lot"}
                                                                    {lot.reservationId ? ` · ${String(lot.reservationId).slice(0, 8)}` : ""}
                                                                    {lot.activeReferenceNumber ? ` · Ref ${lot.activeReferenceNumber}` : ""}
                                                                </Typography>
                                                            </Box>

                                                            <Box sx={{
                                                                display: "flex",
                                                                gap: .6,
                                                                alignItems: "center",
                                                                flexWrap: "wrap",
                                                            }}>
                                                                <MatFlowStatusChip status={lot.movementState || lot.currentStage} />
                                                                <TimingHealthChip health={lot.timingHealth} />
                                                                <Button
                                                                    onClick={() => navigate(`/matflow/tracker/${lot.requisitionId}`)}
                                                                    sx={secondaryBtnSx}
                                                                >
                                                                    Requisition Trace
                                                                </Button>
                                                            </Box>
                                                        </Box>

                                                        <Box sx={{
                                                            px: 1.15,
                                                            pb: 1.05,
                                                            display: "grid",
                                                            gridTemplateColumns: {
                                                                xs: "1fr",
                                                                md: "repeat(4,minmax(0,1fr))",
                                                            },
                                                            gap: .75,
                                                        }}>
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
                                                                <Typography sx={{ fontSize: 17, fontWeight: 950 }}>
                                                                    {lot.completed ? "Closed" : formatDurationMinutes(lot.currentDwellMinutes || 0)}
                                                                </Typography>
                                                                {Number(lot.currentTargetMinutes || 0) > 0 && (
                                                                    <Typography sx={subTextSx}>Target {formatDurationMinutes(lot.currentTargetMinutes)}</Typography>
                                                                )}
                                                                {!lot.completed && Number(lot.currentVarianceMinutes || 0) > 0 && (
                                                                    <Typography sx={subTextSx}>Over target by {formatDurationMinutes(lot.currentVarianceMinutes)}</Typography>
                                                                )}
                                                            </Box>
                                                        </Box>

                                                        <Box sx={{ px: 1.15, pb: 1.05 }}>
                                                            <Box sx={{
                                                                display: "grid",
                                                                gridTemplateColumns: {
                                                                    xs: "repeat(2,minmax(0,1fr))",
                                                                    md: "repeat(7,minmax(0,1fr))",
                                                                },
                                                                gap: .6,
                                                            }}>
                                                                {[
                                                                    ["Tracked", lot.trackedQty],
                                                                    ["Requested", lot.lineRequestedQty],
                                                                    ["Reserved", lot.lineReservedQty],
                                                                    ["Shortage", lot.lineShortageQty],
                                                                    ["Issued", lot.lineIssuedQty],
                                                                    ["Consumed", lot.lineConsumedQty],
                                                                    ["Returned", lot.lineReturnedQty],
                                                                ].map(([label, value]) => (
                                                                    <Box
                                                                        key={label}
                                                                        sx={{
                                                                            p: .65,
                                                                            borderRadius: 1.3,
                                                                            border: "1px solid var(--mf-border)",
                                                                        }}
                                                                    >
                                                                        <Typography sx={{ ...subTextSx, fontSize: 8.5 }}>{label}</Typography>
                                                                        <Typography sx={{ fontSize: 13, fontWeight: 950 }}>
                                                                            {formatQty(value)} {lot.uom || ""}
                                                                        </Typography>
                                                                    </Box>
                                                                ))}
                                                            </Box>

                                                            {lot.lineLevelPostIssueAggregation && (
                                                                <Box sx={{
                                                                    mt: .75,
                                                                    p: .8,
                                                                    borderRadius: 1.5,
                                                                    border: "1px solid var(--mf-border)",
                                                                    background: "var(--mf-surface)",
                                                                }}>
                                                                    <Typography sx={{ fontSize: 11.5, fontWeight: 900 }}>Traceability note</Typography>
                                                                    <Typography sx={subTextSx}>
                                                                        Multiple reservations feed this requisition line. Store issue remains reservation-specific, but current Production consumption/return records are line-level. MatFlow therefore labels the post-issue section as aggregated instead of assigning consumption to the wrong physical reservation.
                                                                    </Typography>
                                                                </Box>
                                                            )}

                                                            <Box sx={{
                                                                mt: .8,
                                                                display: "flex",
                                                                justifyContent: "space-between",
                                                                gap: 1,
                                                                alignItems: "center",
                                                                flexWrap: "wrap",
                                                            }}>
                                                                <Typography sx={subTextSx}>
                                                                    {history.length} custody event(s) recorded for this branch.
                                                                </Typography>
                                                                <Button
                                                                    onClick={() => toggleLot(lot.lotKey)}
                                                                    sx={secondaryBtnSx}
                                                                >
                                                                    {expanded ? "Hide Custody Timeline" : "Full Custody Timeline"}
                                                                </Button>
                                                            </Box>
                                                        </Box>

                                                        <Collapse in={expanded}>
                                                            <Box sx={{
                                                                borderTop: "1px solid var(--mf-border)",
                                                                p: 1.05,
                                                                background: "var(--mf-surface)",
                                                            }}>
                                                                <Typography sx={{ fontSize: 14, fontWeight: 950, mb: .75 }}>
                                                                    Custody & Stage-Time Timeline
                                                                </Typography>

                                                                <Box sx={tableShellSx}>
                                                                    <Box sx={{
                                                                        ...tableHeaderSx,
                                                                        gridTemplateColumns: "55px 170px 175px 155px 165px 165px 120px 130px 180px",
                                                                    }}>
                                                                        {["#", "State / Event", "Department / Location", "Entered", "Exited", "Duration", "SLA", "Actor", "Reference"].map((heading) => (
                                                                            <Box key={heading} sx={tableCellSx}>{heading}</Box>
                                                                        ))}
                                                                    </Box>

                                                                    {history.length === 0 ? (
                                                                        <EmptyState>No custody events have been created for this branch yet.</EmptyState>
                                                                    ) : history.map((event) => (
                                                                        <Box
                                                                            key={`${lot.lotKey}:${event.sequence}`}
                                                                            sx={{
                                                                                ...tableRowSx,
                                                                                gridTemplateColumns: "55px 170px 175px 155px 165px 165px 120px 130px 180px",
                                                                            }}
                                                                        >
                                                                            <Box sx={tableCellSx}>{event.sequence}</Box>
                                                                            <Box sx={tableCellSx}>
                                                                                <Typography sx={mainTextSx}>{event.label || readable(event.state)}</Typography>
                                                                                <Typography sx={subTextSx}>
                                                                                    {readable(event.state)} · {formatQty(event.quantity)} {lot.uom || ""}
                                                                                </Typography>
                                                                            </Box>
                                                                            <Box sx={tableCellSx}>
                                                                                <Typography sx={mainTextSx}>{readable(event.department || "-")}</Typography>
                                                                                <Typography sx={subTextSx}>
                                                                                    {materialTowerLocation(event.locationCode, event.locationName, event.department, event.state)}
                                                                                </Typography>
                                                                            </Box>
                                                                            <Box sx={tableCellSx}>{formatDate(event.enteredAt)}</Box>
                                                                            <Box sx={tableCellSx}>{event.exitedAt ? formatDate(event.exitedAt) : "Current"}</Box>
                                                                            <Box sx={tableCellSx}>
                                                                                <Typography sx={mainTextSx}>{formatDurationMinutes(event.durationMinutes || 0)}</Typography>
                                                                                {Number(event.targetMinutes || 0) > 0 && (
                                                                                    <Typography sx={subTextSx}>Target {formatDurationMinutes(event.targetMinutes)}</Typography>
                                                                                )}
                                                                            </Box>
                                                                            <Box sx={tableCellSx}><TimingHealthChip health={event.timingHealth} /></Box>
                                                                            <Box sx={tableCellSx}>{event.actor || "-"}</Box>
                                                                            <Box sx={tableCellSx}>
                                                                                <Typography sx={mainTextSx}>{event.referenceNumber || event.referenceType || "-"}</Typography>
                                                                                <Typography sx={subTextSx}>{event.scope ? readable(event.scope) : ""}</Typography>
                                                                            </Box>
                                                                        </Box>
                                                                    ))}
                                                                </Box>

                                                                {history.some((event) => event.note) && (
                                                                    <Box sx={{ mt: .8 }}>
                                                                        {history.filter((event) => event.note).map((event) => (
                                                                            <Typography key={`note:${event.sequence}`} sx={subTextSx}>
                                                                                #{event.sequence} · {event.note}
                                                                            </Typography>
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
                            <Typography sx={subTextSx}>
                                Latest stock-ledger movements for this material in {scopeLabel}. Use this as the quantity-level physical audit corroboration for the custody timeline.
                            </Typography>
                        </Box>

                        <Box sx={tableShellSx}>
                            <Box sx={{
                                ...tableHeaderSx,
                                gridTemplateColumns: "165px 155px 165px 105px 105px 105px 105px 170px 165px 165px",
                            }}>
                                {["Time", "Movement", "Location", "Qty Δ", "Reserved Δ", "Blocked Δ", "Transit Δ", "Project / Drawing", "Reference", "Actor"].map((heading) => (
                                    <Box key={heading} sx={tableCellSx}>{heading}</Box>
                                ))}
                            </Box>

                            {movementRows.length === 0 ? (
                                <EmptyState>No stock-ledger movement exists for the selected material and scope.</EmptyState>
                            ) : movementPagination.pageItems.map((row) => (
                                <Box
                                    key={row.ledgerId || row.id}
                                    sx={{
                                        ...tableRowSx,
                                        gridTemplateColumns: "165px 155px 165px 105px 105px 105px 105px 170px 165px 165px",
                                    }}
                                >
                                    <Box sx={tableCellSx}>{formatDate(row.actionAt)}</Box>
                                    <Box sx={tableCellSx}><MatFlowStatusChip status={row.movementType} /></Box>
                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>{row.locationCode || "-"}</Typography>
                                        <Typography sx={subTextSx}>{row.locationName || row.plantCode || "-"}</Typography>
                                    </Box>
                                    <Box sx={tableCellSx}>{formatQty(row.quantityChange)}</Box>
                                    <Box sx={tableCellSx}>{formatQty(row.reservedChange)}</Box>
                                    <Box sx={tableCellSx}>{formatQty(row.blockedChange)}</Box>
                                    <Box sx={tableCellSx}>{formatQty(row.inTransitChange)}</Box>
                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>{row.projectCode || "-"}</Typography>
                                        <Typography sx={subTextSx}>{row.drawingNo || "-"}</Typography>
                                    </Box>
                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>{row.referenceNumber || row.referenceType || "-"}</Typography>
                                        <Typography sx={subTextSx}>{row.batchNo || ""}</Typography>
                                    </Box>
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
