import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
    Box,
    Button,
    Card,
    Collapse,
    LinearProgress,
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { canAccessMatFlowScreenForContext, useMatFlow } from "../matflowUi";
import { extractMatFlowPage, matflowApi, readMatFlowError } from "../api/matflowApi";
import { downloadMatFlowExcel } from "../api/matflowExcel";
import {
    Detail,
    EmptyState,
    ErrorBox,
    LoadingBlock,
    MatFlowKanbanBoard,
    MatFlowPagination,
    MatFlowStatusChip,
    MatFlowViewToggle,
    PageHero,
    SummaryCard,
    TimingHealthChip,
    clean,
    fieldSx,
    formatDate,
    formatDurationMinutes,
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

const FLOW = [
    ["DEMAND", "Production MR"],
    ["STORE", "Store"],
    ["PURCHASE", "Purchase"],
    ["QC", "QC"],
    ["PROCESSING", "Processing"],
    ["PRODUCTION", "Production"],
    ["COMPLETE", "Complete"],
];

const stageBucket = (stage) => {
    switch (normalize(stage)) {
        case "DRAFT": return "DEMAND";
        case "ORIGIN_STORE_FORWARDING":
        case "AWAITING_MAIN_STORE_PLANNING":
        case "AWAITING_STORE_PLANNING":
        case "MATERIAL_RESERVED":
        case "READY_TO_ISSUE": return "STORE";
        case "SHORTAGE_PENDING": return "PURCHASE";
        case "QC_PENDING":
        case "QC_ROUTING_PENDING": return "QC";
        case "PROCESSING": return "PROCESSING";
        case "TRANSFER_IN_PROGRESS":
        case "PRODUCTION_ISSUE":
        case "PRODUCTION_IN_PROGRESS": return "PRODUCTION";
        case "PRODUCTION_COMPLETED": return "COMPLETE";
        default: return "DEMAND";
    }
};

const nextActionTarget = (row) => {
    const id = row?.requisitionId;
    switch (normalize(row?.currentStage)) {
        case "ORIGIN_STORE_FORWARDING":
        case "AWAITING_MAIN_STORE_PLANNING":
        case "AWAITING_STORE_PLANNING":
        case "MATERIAL_RESERVED":
        case "READY_TO_ISSUE":
            return { label: "Store", path: `/matflow/store/requisitions/${id}`, screen: "store" };
        case "SHORTAGE_PENDING":
            return normalize(row?.nextDepartment) === "PURCHASE" || normalize(row?.responsibleDesk) === "PURCHASE"
                ? { label: "Purchase", path: "/matflow/purchase", screen: "purchase" }
                : { label: "Store", path: `/matflow/store/requisitions/${id}`, screen: "store" };
        case "QC_PENDING":
        case "QC_ROUTING_PENDING":
            return { label: "QC", path: "/matflow/qc", screen: "qc" };
        case "PROCESSING":
            return { label: "Processing", path: "/matflow/processing", screen: "processing" };
        case "PRODUCTION_ISSUE":
        case "PRODUCTION_IN_PROGRESS":
            return { label: "Production", path: "/matflow/production-execution", screen: "production-execution" };
        case "TRANSFER_IN_PROGRESS":
            return { label: "Track Route", path: `/matflow/tracker/${id}`, screen: "tracking" };
        default:
            return { label: "Open MR", path: `/matflow/requisitions/${id}`, screen: "production" };
    }
};

const UNIVERSAL_DASHBOARD_VIEWS = [
    ["overview", "Overall View", "KPIs, live execution and workflow health"],
    ["kanban", "Kanban", "Project-wise · Product-wise · Material-wise workflow control"],
    ["projects", "Project Tracker", "Project → Product → MR material readiness"],
    ["materials", "Material Tracker", "One material across Projects, Products and custody routes"],
];

const KANBAN_SCOPE_OPTIONS = [
    { value: "PROJECT", label: "Project-wise" },
    { value: "PRODUCT", label: "Product-wise" },
    { value: "MATERIAL", label: "Material-wise" },
];

const FLOW_KANBAN_COLUMNS = FLOW.map(([key, label]) => ({
    key,
    label,
    subtitle: key === "COMPLETE"
        ? "Fully accounted / completed"
        : "Current workflow bottleneck",
}));

const FLOW_INDEX = FLOW.reduce((result, [key], index) => {
    result[key] = index;
    return result;
}, {});

const requisitionStatusStage = (status) => {
    switch (normalize(status)) {
        case "DRAFT": return "DRAFT";
        case "SUBMITTED":
        case "SUBMITTED_TO_STORE":
            return "AWAITING_STORE_PLANNING";
        case "STORE_REVIEW_IN_PROGRESS":
            return "AWAITING_STORE_PLANNING";
        case "PARTIALLY_RESERVED":
            return "MATERIAL_RESERVED";
        case "SHORTAGE_PENDING":
            return "SHORTAGE_PENDING";
        case "READY_TO_ISSUE":
            return "READY_TO_ISSUE";
        case "PARTIALLY_ISSUED":
        case "ISSUED_TO_PRODUCTION":
            return "PRODUCTION_ISSUE";
        case "PRODUCTION_STARTED":
            return "PRODUCTION_IN_PROGRESS";
        case "PRODUCTION_COMPLETED":
        case "COMPLETED":
            return "PRODUCTION_COMPLETED";
        default:
            return normalize(status) || "DRAFT";
    }
};

const materialLineBucket = (status, fallbackStage) => {
    if (normalize(fallbackStage) === "DRAFT") return "DEMAND";
    switch (normalize(status)) {
        case "PENDING_STORE_REVIEW":
        case "RESERVED":
        case "PARTIALLY_RESERVED":
        case "READY_TO_ISSUE":
            return "STORE";
        case "SHORTAGE_IDENTIFIED":
        case "INDENT_CREATED":
        case "ORDERED":
            return "PURCHASE";
        case "QC_PENDING":
            return "QC";
        case "PROCESSING_REQUIRED":
        case "IN_PROCESSING":
            return "PROCESSING";
        case "PARTIALLY_ISSUED":
        case "ISSUED_TO_PRODUCTION":
        case "PARTIALLY_CONSUMED":
            return "PRODUCTION";
        case "CONSUMED":
        case "RETURNED":
            return "COMPLETE";
        case "CANCELLED":
            return "";
        default:
            return stageBucket(fallbackStage);
    }
};

const materialLineActionTarget = (row) => {
    const id = row?.requisitionId;
    switch (normalize(row?.lineStatus)) {
        case "PENDING_STORE_REVIEW":
        case "RESERVED":
        case "PARTIALLY_RESERVED":
        case "READY_TO_ISSUE":
            return { label: "Store", path: `/matflow/store/requisitions/${id}`, screen: "store" };
        case "SHORTAGE_IDENTIFIED":
        case "INDENT_CREATED":
        case "ORDERED":
            return { label: "Purchase", path: "/matflow/purchase", screen: "purchase" };
        case "QC_PENDING":
            return { label: "QC", path: "/matflow/qc", screen: "qc" };
        case "PROCESSING_REQUIRED":
        case "IN_PROCESSING":
            return { label: "Processing", path: "/matflow/processing", screen: "processing" };
        case "PARTIALLY_ISSUED":
        case "ISSUED_TO_PRODUCTION":
        case "PARTIALLY_CONSUMED":
            return { label: "Production", path: "/matflow/production-execution", screen: "production-execution" };
        case "CONSUMED":
        case "RETURNED":
            return { label: "Trace", path: `/matflow/tracker/${id}`, screen: "tracking" };
        default:
            return nextActionTarget(row);
    }
};

const chooseBottleneckRow = (rows = []) => {
    const safeRows = Array.isArray(rows) ? rows.filter(Boolean) : [];
    if (!safeRows.length) return null;

    const active = safeRows.filter((row) =>
        !["CANCELLED", "PRODUCTION_COMPLETED"].includes(normalize(row.currentStage))
    );
    const pool = active.length ? active : safeRows;

    return [...pool].sort((a, b) => {
        const aBucket = stageBucket(a.currentStage);
        const bBucket = stageBucket(b.currentStage);
        const byStage = numeric(FLOW_INDEX[aBucket]) - numeric(FLOW_INDEX[bBucket]);
        if (byStage !== 0) return byStage;
        return numeric(b.ageHours) - numeric(a.ageHours);
    })[0] || null;
};

const aggregateReadyPercent = (rows = []) => {
    const requested = rows.reduce((sum, row) => sum + numeric(row.requestedQty), 0);
    const issued = rows.reduce((sum, row) => sum + numeric(row.issuedQty), 0);
    if (requested > .0005) return Math.min(100, Math.max(0, Math.round((issued * 100) / requested)));
    if (!rows.length) return 0;
    return Math.round(rows.reduce((sum, row) => sum + numeric(row.materialReadyPercent), 0) / rows.length);
};

const projectKeyOf = (value = {}) =>
    [value.projectCode, value.projectName, value.clientName]
        .map((item) => clean(item).toUpperCase())
        .join("|") ||
    `PROJECT:${value.projectId || value.projectDrawingId || value.requisitionId || "UNKNOWN"}`;

const chooseMaterialBottleneck = (items = []) => {
    const safeItems = (Array.isArray(items) ? items : []).filter((item) => item?.lane);
    if (!safeItems.length) return null;
    const active = safeItems.filter((item) => item.lane !== "COMPLETE");
    const pool = active.length ? active : safeItems;
    return [...pool].sort((a, b) => {
        const byStage = numeric(FLOW_INDEX[a.lane]) - numeric(FLOW_INDEX[b.lane]);
        if (byStage !== 0) return byStage;
        return numeric(b.ageHours) - numeric(a.ageHours);
    })[0] || null;
};

const projectKanbanGroups = (rows = [], projects = [], materialLines = []) => {
    const grouped = new Map();

    (Array.isArray(projects) ? projects : []).forEach((project) => {
        if (!project || project.active === false) return;
        const key = projectKeyOf(project);
        grouped.set(key, {
            key,
            projectId: project.id,
            projectCode: project.projectCode,
            projectName: project.projectName,
            clientName: project.clientName,
            plantCode: project.plantCode,
            portfolioStage: project.portfolioStage,
            products: Array.isArray(project.products) ? project.products : [],
            rows: [],
        });
    });

    (Array.isArray(rows) ? rows : []).forEach((row) => {
        if (!row || normalize(row.currentStage) === "CANCELLED") return;
        const key = projectKeyOf(row);
        if (!grouped.has(key)) {
            grouped.set(key, {
                key,
                projectId: null,
                projectCode: row.projectCode,
                projectName: row.projectName,
                clientName: row.clientName,
                plantCode: row.destinationPlantCode,
                portfolioStage: null,
                products: [],
                rows: [],
            });
        }
        grouped.get(key).rows.push(row);
    });

    return Array.from(grouped.values()).map((group) => {
        const groupMaterialLines = (Array.isArray(materialLines) ? materialLines : []).filter((line) =>
            clean(line.projectCode).toUpperCase() === clean(group.projectCode).toUpperCase()
        );
        const trackedProductIds = new Set([
            ...group.rows.map((row) => clean(row.projectDrawingId)).filter(Boolean),
            ...groupMaterialLines.map((line) => clean(line.projectDrawingId)).filter(Boolean),
        ]);
        const pendingProduct = group.products.find((product) =>
            product?.active !== false && !trackedProductIds.has(clean(product?.id))
        ) || null;
        const bottleneckLine = chooseMaterialBottleneck(groupMaterialLines);
        const rowForLine = bottleneckLine
            ? group.rows.find((row) => String(row.requisitionId || "") === String(bottleneckLine.requisitionId || "")) || null
            : null;
        const bottleneck = rowForLine || chooseBottleneckRow(group.rows);
        const completed = !pendingProduct && groupMaterialLines.length > 0 &&
            groupMaterialLines.every((line) => line.lane === "COMPLETE");
        const trackedProductCount = new Set(group.rows.map((row) =>
            row.projectDrawingId || `${row.productName || ""}:${row.drawingNo || ""}`
        )).size;
        return {
            ...group,
            pendingProduct,
            bottleneckLine,
            bottleneck,
            lane: pendingProduct
                ? "DEMAND"
                : groupMaterialLines.length > 0
                    ? completed
                        ? "COMPLETE"
                        : bottleneckLine?.lane || stageBucket(bottleneck?.currentStage)
                    : group.rows.length === 0
                        ? "DEMAND"
                        : stageBucket(bottleneck?.currentStage),
            productCount: Math.max(group.products.length, trackedProductCount),
            mrCount: group.rows.length,
            materialLineCount: groupMaterialLines.length,
            readyPercent: aggregateReadyPercent(group.rows),
            shortageQty: groupMaterialLines.length
                ? groupMaterialLines.reduce((sum, line) => sum + numeric(line.shortageQty), 0)
                : group.rows.reduce((sum, row) => sum + numeric(row.shortageQty), 0),
            maxAgeHours: Math.max(
                group.rows.reduce((max, row) => Math.max(max, numeric(row.ageHours)), 0),
                groupMaterialLines.reduce((max, line) => Math.max(max, numeric(line.ageHours)), 0)
            ),
            riskCount: groupMaterialLines.length
                ? groupMaterialLines.filter((line) => ["BREACHED", "COMPLETED_LATE"].includes(normalize(line.timingHealth))).length
                : group.rows.filter((row) => ["BREACHED", "COMPLETED_LATE"].includes(normalize(row.timingHealth))).length,
        };
    });
};

const productKeyOf = (value = {}) =>
    clean(value.projectDrawingId || value.id) ||
    [value.projectCode, value.productName, value.drawingNo]
        .map((item) => clean(item).toUpperCase())
        .join("|") ||
    `PRODUCT:${value.requisitionId || "UNKNOWN"}`;

const productKanbanGroups = (rows = [], projects = [], materialLines = []) => {
    const grouped = new Map();

    (Array.isArray(projects) ? projects : []).forEach((project) => {
        if (!project || project.active === false) return;
        (Array.isArray(project.products) ? project.products : [])
            .filter((product) => product?.active !== false)
            .forEach((product) => {
                const key = productKeyOf(product);
                grouped.set(key, {
                    key,
                    projectDrawingId: product.id,
                    projectCode: project.projectCode,
                    projectName: project.projectName,
                    clientName: project.clientName,
                    productName: product.productName,
                    drawingNo: product.drawingNo,
                    plantCode: project.plantCode,
                    latestBomId: product.latestBomId,
                    latestBomNumber: product.latestBomNumber,
                    latestBomStatus: product.latestBomStatus,
                    bomEffective: product.bomEffective === true,
                    portfolioStage: product.currentDepartment || product.portfolioStage,
                    rows: [],
                });
            });
    });

    (Array.isArray(rows) ? rows : []).forEach((row) => {
        if (!row || normalize(row.currentStage) === "CANCELLED") return;
        const key = productKeyOf(row);
        if (!grouped.has(key)) {
            grouped.set(key, {
                key,
                projectDrawingId: row.projectDrawingId,
                projectCode: row.projectCode,
                projectName: row.projectName,
                clientName: row.clientName,
                productName: row.productName,
                drawingNo: row.drawingNo,
                plantCode: row.destinationPlantCode,
                latestBomId: null,
                latestBomNumber: null,
                latestBomStatus: null,
                bomEffective: false,
                portfolioStage: null,
                rows: [],
            });
        }
        grouped.get(key).rows.push(row);
    });

    return Array.from(grouped.values()).map((group) => {
        const groupMaterialLines = (Array.isArray(materialLines) ? materialLines : []).filter((line) =>
            clean(line.projectDrawingId) && clean(line.projectDrawingId) === clean(group.projectDrawingId)
        );
        const bottleneckLine = chooseMaterialBottleneck(groupMaterialLines);
        const rowForLine = bottleneckLine
            ? group.rows.find((row) => String(row.requisitionId || "") === String(bottleneckLine.requisitionId || "")) || null
            : null;
        const bottleneck = rowForLine || chooseBottleneckRow(group.rows);
        const completed = groupMaterialLines.length > 0 && groupMaterialLines.every((line) => line.lane === "COMPLETE");
        return {
            ...group,
            bottleneckLine,
            bottleneck,
            lane: groupMaterialLines.length > 0
                ? completed
                    ? "COMPLETE"
                    : bottleneckLine?.lane || stageBucket(bottleneck?.currentStage)
                : group.rows.length === 0
                    ? "DEMAND"
                    : stageBucket(bottleneck?.currentStage),
            mrCount: group.rows.length,
            materialLineCount: groupMaterialLines.length,
            requestedQty: groupMaterialLines.length
                ? groupMaterialLines.reduce((sum, line) => sum + numeric(line.requestedQty), 0)
                : group.rows.reduce((sum, row) => sum + numeric(row.requestedQty), 0),
            issuedQty: groupMaterialLines.length
                ? groupMaterialLines.reduce((sum, line) => sum + numeric(line.issuedQty), 0)
                : group.rows.reduce((sum, row) => sum + numeric(row.issuedQty), 0),
            shortageQty: groupMaterialLines.length
                ? groupMaterialLines.reduce((sum, line) => sum + numeric(line.shortageQty), 0)
                : group.rows.reduce((sum, row) => sum + numeric(row.shortageQty), 0),
            readyPercent: aggregateReadyPercent(group.rows),
            maxAgeHours: Math.max(
                group.rows.reduce((max, row) => Math.max(max, numeric(row.ageHours)), 0),
                groupMaterialLines.reduce((max, line) => Math.max(max, numeric(line.ageHours)), 0)
            ),
            riskCount: groupMaterialLines.length
                ? groupMaterialLines.filter((line) => ["BREACHED", "COMPLETED_LATE"].includes(normalize(line.timingHealth))).length
                : group.rows.filter((row) => ["BREACHED", "COMPLETED_LATE"].includes(normalize(row.timingHealth))).length,
        };
    });
};

const productPreExecutionTarget = (item) => {
    if (item?.bomEffective && item?.latestBomId) {
        return {
            label: "Raise MR",
            path: `/matflow/requisitions/new?bomId=${encodeURIComponent(item.latestBomId)}`,
            screen: "production",
        };
    }
    if (item?.latestBomId) {
        return {
            label: "Open BOM",
            path: `/matflow/boms/${item.latestBomId}`,
            screen: "boms",
        };
    }
    if (item?.projectDrawingId) {
        return {
            label: "Create BOM",
            path: `/matflow/boms/new?productId=${encodeURIComponent(item.projectDrawingId)}`,
            screen: "bom-create",
        };
    }
    return {
        label: "Projects & Products",
        path: "/matflow/projects",
        screen: "projects",
    };
};

const materialKanbanRows = (requisitions = [], trackerRows = [], selectedPlantParam = "") => {
    const trackerByRequisition = new Map(
        (Array.isArray(trackerRows) ? trackerRows : [])
            .filter((row) => row?.requisitionId)
            .map((row) => [String(row.requisitionId), row])
    );
    const selectedPlant = clean(selectedPlantParam).toUpperCase();

    return (Array.isArray(requisitions) ? requisitions : []).flatMap((requisition) => {
        if (!requisition?.id || normalize(requisition.status) === "CANCELLED") return [];
        const tracker = trackerByRequisition.get(String(requisition.id)) || null;
        const plantCode = clean(tracker?.destinationPlantCode || requisition.destinationPlantCode).toUpperCase();
        if (selectedPlant && plantCode !== selectedPlant) return [];

        const parentStage = tracker?.currentStage || requisitionStatusStage(requisition.status);
        const lines = Array.isArray(requisition.lines) ? requisition.lines : [];
        return lines
            .filter((line) => line?.id && normalize(line.status) !== "CANCELLED")
            .map((line) => ({
                id: line.id,
                materialId: line.issuedMaterialId || line.materialId,
                originalMaterialId: line.materialId,
                materialCode: line.issuedMaterialCode || line.materialCode,
                materialName: line.issuedMaterialName || line.materialName,
                materialCategory: line.materialCategory,
                uom: line.uom,
                lineStatus: line.status,
                requisitionId: requisition.id,
                requisitionNumber: requisition.requisitionNumber,
                projectDrawingId: requisition.projectDrawingId,
                projectCode: tracker?.projectCode || requisition.projectCode,
                projectName: tracker?.projectName,
                clientName: tracker?.clientName,
                productName: tracker?.productName,
                drawingNo: tracker?.drawingNo || requisition.drawingNo,
                destinationPlantCode: plantCode,
                currentStage: parentStage,
                currentDepartment: tracker?.currentDepartment || tracker?.responsibleDesk,
                currentLocationCode: tracker?.currentLocationCode || requisition.destinationLocationCode,
                timingHealth: tracker?.timingHealth,
                ageHours: tracker?.ageHours,
                requestedQty: line.requestedQty,
                reservedQty: line.reservedQty,
                shortageQty: line.shortageQty,
                issuedQty: line.issuedQty,
                consumedQty: line.consumedQty,
                returnedQty: line.returnedQty,
                lane: materialLineBucket(line.status, parentStage),
            }))
            .filter((line) => line.lane);
    });
};


const materialKanbanGroups = (lineItems = []) => {
    const grouped = new Map();
    (Array.isArray(lineItems) ? lineItems : []).forEach((line) => {
        if (!line?.lane) return;
        const key = clean(line.materialId) || clean(line.materialCode).toUpperCase() || `MATERIAL:${clean(line.materialName).toUpperCase()}`;
        if (!grouped.has(key)) {
            grouped.set(key, {
                key,
                materialId: line.materialId,
                materialCode: line.materialCode,
                materialName: line.materialName,
                materialCategory: line.materialCategory,
                uom: line.uom,
                lines: [],
            });
        }
        grouped.get(key).lines.push(line);
    });

    return Array.from(grouped.values()).map((group) => {
        const bottleneck = chooseMaterialBottleneck(group.lines);
        const projectKeys = new Set(group.lines.map((line) => clean(line.projectCode).toUpperCase()).filter(Boolean));
        const productKeys = new Set(group.lines.map((line) => clean(line.projectDrawingId) || `${clean(line.projectCode).toUpperCase()}|${clean(line.drawingNo).toUpperCase()}`).filter(Boolean));
        const mrKeys = new Set(group.lines.map((line) => clean(line.requisitionId)).filter(Boolean));
        return {
            ...group,
            bottleneck,
            lane: bottleneck?.lane || "DEMAND",
            lineCount: group.lines.length,
            projectCount: projectKeys.size,
            productCount: productKeys.size,
            mrCount: mrKeys.size,
            requestedQty: group.lines.reduce((sum, line) => sum + numeric(line.requestedQty), 0),
            reservedQty: group.lines.reduce((sum, line) => sum + numeric(line.reservedQty), 0),
            shortageQty: group.lines.reduce((sum, line) => sum + numeric(line.shortageQty), 0),
            issuedQty: group.lines.reduce((sum, line) => sum + numeric(line.issuedQty), 0),
            consumedQty: group.lines.reduce((sum, line) => sum + numeric(line.consumedQty), 0),
            returnedQty: group.lines.reduce((sum, line) => sum + numeric(line.returnedQty), 0),
            maxAgeHours: group.lines.reduce((max, line) => Math.max(max, numeric(line.ageHours)), 0),
            riskCount: group.lines.filter((line) => ["BREACHED", "COMPLETED_LATE"].includes(normalize(line.timingHealth))).length,
        };
    });
};
function UniversalDashboardHeader({ view, onViewChange, onRefresh = null, refreshing = false }) {
    return (
        <>
            <PageHero
                badge="MATFLOW UNIVERSAL DASHBOARD"
                title="Material Operations Command Center"
                subtitle="One plant-aware dashboard for overall operations, Project/Product material execution and material-specific custody tracking. Operational users are automatically limited to their authorised plant scope."
                actions={onRefresh ? <Button startIcon={<RefreshIcon />} onClick={onRefresh} disabled={refreshing} sx={secondaryBtnSx}>Refresh</Button> : null}
            />
            <Card sx={{ ...panelSx, p: 1 }}>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4,minmax(0,1fr))" }, gap: .8 }}>
                    {UNIVERSAL_DASHBOARD_VIEWS.map(([key, label, subtitle]) => {
                        const active = view === key;
                        return (
                            <Button
                                key={key}
                                onClick={() => onViewChange(key)}
                                sx={{
                                    ...(active ? primaryBtnSx : secondaryBtnSx),
                                    justifyContent: "flex-start",
                                    textAlign: "left",
                                    minHeight: 58,
                                    px: 1.4,
                                }}
                            >
                                <Box>
                                    <Typography sx={{ fontWeight: 950, fontSize: 13 }}>{label}</Typography>
                                    <Typography sx={{ fontSize: 10.5, opacity: .78 }}>{subtitle}</Typography>
                                </Box>
                            </Button>
                        );
                    })}
                </Box>
            </Card>
        </>
    );
}

export function MatFlowDashboardPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { selectedPlantParam, availablePlants, roles } = useMatFlow();
    const contextPlants = selectedPlantParam ? [selectedPlantParam] : availablePlants;
    const requestedView = normalize(searchParams.get("view") || "overview").toLowerCase();
    const view = ["overview", "kanban", "projects", "materials"].includes(requestedView) ? requestedView : "overview";
    const materialId = clean(searchParams.get("materialId"));
    const requestedKanbanScope = normalize(searchParams.get("kanbanScope") || "PROJECT");
    const kanbanScope = ["PROJECT", "PRODUCT", "MATERIAL"].includes(requestedKanbanScope)
        ? requestedKanbanScope
        : "PROJECT";

    const changeView = useCallback((nextView) => {
        const next = new URLSearchParams(searchParams);
        next.set("view", nextView);
        if (nextView !== "materials") next.delete("materialId");
        if (nextView !== "kanban") next.delete("kanbanScope");
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    const changeKanbanScope = useCallback((scope) => {
        const next = new URLSearchParams(searchParams);
        next.set("view", "kanban");
        next.set("kanbanScope", normalize(scope) || "PROJECT");
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    const [data, setData] = useState(null);
    const [tracker, setTracker] = useState(null);
    const [requisitions, setRequisitions] = useState([]);
    const [projects, setProjects] = useState([]);
    const [kanbanSearch, setKanbanSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        if (!["overview", "kanban"].includes(view)) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError("");
        try {
            const [dashboardResponse, trackerResponse, requisitionResponse, projectResponse] = await Promise.all([
                matflowApi.dashboardReport({ plantCode: selectedPlantParam }),
                matflowApi.getTracker({ plantCode: selectedPlantParam }),
                view === "kanban"
                    ? matflowApi.listRequisitions()
                    : Promise.resolve({ data: [] }),
                view === "kanban"
                    ? matflowApi.listProjects({
                        active: true,
                        plantCode: selectedPlantParam || undefined,
                    })
                    : Promise.resolve({ data: [] }),
            ]);
            setData(dashboardResponse?.data || null);
            setTracker(trackerResponse?.data || null);
            setRequisitions(Array.isArray(requisitionResponse?.data) ? requisitionResponse.data : []);
            setProjects(extractMatFlowPage(projectResponse?.data).rows);
        } catch (requestError) {
            setRequisitions([]);
            setProjects([]);
            setError(readMatFlowError(requestError, "Unable to load MatFlow dashboard."));
        } finally {
            setLoading(false);
        }
    }, [selectedPlantParam, view]);

    useEffect(() => { load(); }, [load]);

    if (view === "kanban") {
        const trackerRows = (Array.isArray(tracker?.rows) ? tracker.rows : [])
            .filter((row) => normalize(row.currentStage) !== "CANCELLED");

        const term = clean(kanbanSearch).toLowerCase();

        const materialLineItems = materialKanbanRows(
            requisitions,
            trackerRows,
            selectedPlantParam
        );

        const projectItems = projectKanbanGroups(trackerRows, projects, materialLineItems)
            .filter((item) => !term || [
                item.projectCode,
                item.projectName,
                item.clientName,
                item.plantCode,
                item.pendingProduct?.productName,
                item.pendingProduct?.drawingNo,
                item.bottleneck?.requisitionNumber,
                item.bottleneck?.productName,
                item.bottleneckLine?.materialCode,
                item.bottleneckLine?.materialName,
            ].some((value) => clean(value).toLowerCase().includes(term)))
            .sort((a, b) => numeric(b.maxAgeHours) - numeric(a.maxAgeHours));

        const productItems = productKanbanGroups(trackerRows, projects, materialLineItems)
            .filter((item) => !term || [
                item.projectCode,
                item.projectName,
                item.clientName,
                item.productName,
                item.drawingNo,
                item.plantCode,
                item.bottleneck?.requisitionNumber,
                item.bottleneckLine?.materialCode,
                item.bottleneckLine?.materialName,
            ].some((value) => clean(value).toLowerCase().includes(term)))
            .sort((a, b) => numeric(b.maxAgeHours) - numeric(a.maxAgeHours));

        const materialItems = materialKanbanGroups(materialLineItems)
            .filter((item) => !term || [
                item.materialCode,
                item.materialName,
                item.materialCategory,
                item.bottleneck?.projectCode,
                item.bottleneck?.projectName,
                item.bottleneck?.productName,
                item.bottleneck?.drawingNo,
                item.bottleneck?.requisitionNumber,
                item.bottleneck?.lineStatus,
                item.bottleneck?.currentDepartment,
                item.bottleneck?.currentLocationCode,
            ].some((value) => clean(value).toLowerCase().includes(term)))
            .sort((a, b) => numeric(b.maxAgeHours) - numeric(a.maxAgeHours));

        const activeItems = kanbanScope === "PROJECT"
            ? projectItems
            : kanbanScope === "PRODUCT"
                ? productItems
                : materialItems;

        const kanbanKpis = kanbanScope === "PROJECT"
            ? [
                ["Projects", projectItems.length],
                ["Products", projectItems.reduce((sum, item) => sum + numeric(item.productCount), 0)],
                ["MRs", projectItems.reduce((sum, item) => sum + numeric(item.mrCount), 0)],
                ["Timing Risks", projectItems.reduce((sum, item) => sum + numeric(item.riskCount), 0)],
            ]
            : kanbanScope === "PRODUCT"
                ? [
                    ["Products", productItems.length],
                    ["MRs", productItems.reduce((sum, item) => sum + numeric(item.mrCount), 0)],
                    ["Shortage Qty", formatQty(productItems.reduce((sum, item) => sum + numeric(item.shortageQty), 0))],
                    ["Timing Risks", productItems.reduce((sum, item) => sum + numeric(item.riskCount), 0)],
                ]
                : [
                    ["Materials", materialItems.length],
                    ["Demand Lines", materialItems.reduce((sum, item) => sum + numeric(item.lineCount), 0)],
                    ["Shortage Qty", formatQty(materialItems.reduce((sum, item) => sum + numeric(item.shortageQty), 0))],
                    ["Issued Qty", formatQty(materialItems.reduce((sum, item) => sum + numeric(item.issuedQty), 0))],
                ];

        return (
            <Box sx={pageSx}>
                <UniversalDashboardHeader view={view} onViewChange={changeView} onRefresh={load} refreshing={loading} />
                <ErrorBox>{error}</ErrorBox>

                <Card sx={{ ...panelSx, display: "grid", gap: 1.1 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                        <Box>
                            <Typography sx={{ fontWeight: 950, fontSize: 17 }}>Execution Kanban</Typography>
                            <Typography sx={subTextSx}>
                                Switch between Project, Product and Material cards. Material-wise cards aggregate the same material across Projects, Products and MRs. The lane is derived from the authoritative backend workflow; cards cannot bypass Store, Purchase, QC, Processing, routing or Production controls.
                            </Typography>
                        </Box>
                        <MatFlowViewToggle
                            value={kanbanScope}
                            onChange={changeKanbanScope}
                            options={KANBAN_SCOPE_OPTIONS}
                        />
                    </Box>
                    <TextField
                        label={
                            kanbanScope === "PROJECT"
                                ? "Search PD No. / Project / Client / MR"
                                : kanbanScope === "PRODUCT"
                                    ? "Search PD No. / Product / Drawing / MR"
                                    : "Search Material / PD No. / Product / MR / State"
                        }
                        value={kanbanSearch}
                        onChange={(event) => setKanbanSearch(event.target.value)}
                        sx={fieldSx}
                    />
                </Card>

                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 1 }}>
                    {kanbanKpis.map(([label, value]) => (
                        <SummaryCard key={label} label={label} value={value} />
                    ))}
                </Box>

                {loading ? <LoadingBlock /> : (
                    <MatFlowKanbanBoard
                        columns={FLOW_KANBAN_COLUMNS}
                        items={activeItems}
                        laneFor={(item) => item.lane}
                        minColumnWidth={300}
                        emptyText={`No ${kanbanScope.toLowerCase()} items in this stage.`}
                        renderCard={(item) => {
                            if (kanbanScope === "PROJECT") {
                                const bottleneck = item.bottleneck;
                                const bottleneckLine = item.bottleneckLine;
                                const target = item.pendingProduct
                                    ? productPreExecutionTarget({
                                        ...item.pendingProduct,
                                        projectDrawingId: item.pendingProduct.id,
                                    })
                                    : bottleneckLine
                                        ? materialLineActionTarget(bottleneckLine)
                                        : bottleneck
                                            ? nextActionTarget(bottleneck)
                                            : null;
                                const canOpenTarget = target &&
                                    canAccessMatFlowScreenForContext(target.screen, roles, contextPlants);
                                return (
                                    <Card sx={{ ...panelSx, m: 0, p: 1.15, boxShadow: "none" }}>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: .7, alignItems: "flex-start" }}>
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography sx={{ ...mainTextSx, fontSize: 13 }}>{item.projectCode || "-"} · {item.projectName || "Project"}</Typography>
                                                <Typography sx={subTextSx}>{item.clientName || "-"} · {item.plantCode || "-"}</Typography>
                                            </Box>
                                            <MatFlowStatusChip status={item.pendingProduct ? "PRODUCTION_MR_PENDING" : bottleneckLine?.lineStatus || bottleneck?.currentStage || item.portfolioStage || item.lane} />
                                        </Box>
                                        <Box sx={{ mt: .9, display: "grid", gridTemplateColumns: "1fr 1fr", gap: .55 }}>
                                            <Detail label="Products" value={item.productCount} />
                                            <Detail label="MRs" value={item.mrCount} />
                                            <Detail label="Material Lines" value={item.materialLineCount} />
                                            <Detail label="Material Ready" value={`${item.readyPercent}%`} />
                                            <Detail label="Shortage" value={formatQty(item.shortageQty)} />
                                        </Box>
                                        <Typography sx={{ ...subTextSx, mt: .75 }}>
                                            {item.pendingProduct
                                                ? `Next Product: ${item.pendingProduct.productName || item.pendingProduct.drawingNo || "Product"} · ${readable(item.lane)}`
                                                : `Bottleneck: ${readable(bottleneckLine?.lineStatus || bottleneck?.currentStage || item.lane)}`}
                                            {item.riskCount ? ` · ${item.riskCount} timing risk` : ""}
                                        </Typography>
                                        <Box sx={{ display: "flex", gap: .55, mt: .9, flexWrap: "wrap" }}>
                                            {target ? (
                                                <Button
                                                    onClick={() => navigate(
                                                        canOpenTarget
                                                            ? target.path
                                                            : bottleneck?.requisitionId
                                                                ? `/matflow/tracker/${bottleneck.requisitionId}`
                                                                : "/matflow/projects"
                                                    )}
                                                    sx={primaryBtnSx}
                                                >
                                                    {canOpenTarget ? target.label : item.pendingProduct ? "Open Product" : "Open Bottleneck"}
                                                </Button>
                                            ) : (
                                                <Button
                                                    onClick={() => navigate("/matflow/projects")}
                                                    sx={primaryBtnSx}
                                                >
                                                    Projects & Products
                                                </Button>
                                            )}
                                            <Button
                                                onClick={() => navigate(
                                                    item.mrCount > 0
                                                        ? `/matflow/dashboard?view=projects&search=${encodeURIComponent(item.projectCode || item.projectName || "")}`
                                                        : "/matflow/boms"
                                                )}
                                                sx={secondaryBtnSx}
                                            >
                                                {item.mrCount > 0 ? "Project Tracker" : "Operational BOMs"}
                                            </Button>
                                        </Box>
                                    </Card>
                                );
                            }

                            if (kanbanScope === "PRODUCT") {
                                const bottleneck = item.bottleneck;
                                const bottleneckLine = item.bottleneckLine;
                                const target = bottleneckLine
                                    ? materialLineActionTarget(bottleneckLine)
                                    : bottleneck
                                        ? nextActionTarget(bottleneck)
                                        : productPreExecutionTarget(item);
                                const canOpenTarget = target &&
                                    canAccessMatFlowScreenForContext(target.screen, roles, contextPlants);
                                return (
                                    <Card sx={{ ...panelSx, m: 0, p: 1.15, boxShadow: "none" }}>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: .7, alignItems: "flex-start" }}>
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography sx={{ ...mainTextSx, fontSize: 13 }}>{item.productName || "Product"}</Typography>
                                                <Typography sx={subTextSx}>{item.projectCode || "-"} · {item.drawingNo || "-"} · {item.plantCode || "-"}</Typography>
                                            </Box>
                                            <MatFlowStatusChip status={bottleneckLine?.lineStatus || bottleneck?.currentStage || item.latestBomStatus || item.portfolioStage || item.lane} />
                                        </Box>
                                        <Box sx={{ mt: .9, display: "grid", gridTemplateColumns: "1fr 1fr", gap: .55 }}>
                                            <Detail label="MRs" value={item.mrCount} />
                                            <Detail label="Material Lines" value={item.materialLineCount} />
                                            <Detail label="Ready" value={`${item.readyPercent}%`} />
                                            <Detail label="Requested" value={formatQty(item.requestedQty)} />
                                            <Detail label="Shortage" value={formatQty(item.shortageQty)} />
                                        </Box>
                                        <Typography sx={{ ...subTextSx, mt: .75 }}>
                                            {item.clientName || "-"} · {bottleneckLine
                                                ? `Material bottleneck ${bottleneckLine.materialName || bottleneckLine.materialCode || "Material"} · ${readable(bottleneckLine.lineStatus || item.lane)}`
                                                : bottleneck
                                                    ? `Bottleneck ${readable(bottleneck.currentStage || item.lane)}`
                                                    : item.bomEffective
                                                        ? "Effective BOM ready · MR not yet raised"
                                                        : item.latestBomId
                                                            ? `BOM ${readable(item.latestBomStatus || "IN REVIEW")}`
                                                            : "Engineering BOM not created"}
                                        </Typography>
                                        <Box sx={{ display: "flex", gap: .55, mt: .9, flexWrap: "wrap" }}>
                                            <Button
                                                onClick={() => navigate(
                                                    canOpenTarget
                                                        ? target.path
                                                        : bottleneckLine?.requisitionId
                                                            ? `/matflow/tracker/${bottleneckLine.requisitionId}`
                                                            : bottleneck
                                                                ? `/matflow/tracker/${bottleneck.requisitionId}`
                                                                : "/matflow/projects"
                                                )}
                                                sx={primaryBtnSx}
                                            >
                                                {canOpenTarget
                                                    ? target.label
                                                    : bottleneck
                                                        ? "Open Bottleneck"
                                                        : "Open Product"}
                                            </Button>
                                            <Button
                                                onClick={() => navigate(
                                                    item.mrCount > 0
                                                        ? `/matflow/dashboard?view=projects&search=${encodeURIComponent(item.drawingNo || item.productName || "")}`
                                                        : item.latestBomId
                                                            ? `/matflow/boms/${item.latestBomId}`
                                                            : `/matflow/boms/new?productId=${encodeURIComponent(item.projectDrawingId || "")}`
                                                )}
                                                sx={secondaryBtnSx}
                                            >
                                                {item.mrCount > 0 ? "Product Tracker" : item.latestBomId ? "BOM" : "Create BOM"}
                                            </Button>
                                        </Box>
                                    </Card>
                                );
                            }

                            const bottleneck = item.bottleneck;
                            const target = bottleneck ? materialLineActionTarget(bottleneck) : null;
                            const canOpenTarget = target && canAccessMatFlowScreenForContext(
                                target.screen,
                                roles,
                                contextPlants
                            );
                            return (
                                <Card sx={{ ...panelSx, m: 0, p: 1.15, boxShadow: "none" }}>
                                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: .7, alignItems: "flex-start" }}>
                                        <Box sx={{ minWidth: 0 }}>
                                            <Typography sx={{ ...mainTextSx, fontSize: 13 }}>{item.materialName || "Material"}</Typography>
                                            <Typography sx={subTextSx}>{item.materialCode || "-"} · {readable(item.materialCategory || "OTHER")} · {item.uom || "-"}</Typography>
                                        </Box>
                                        <MatFlowStatusChip status={bottleneck?.lineStatus || item.lane} />
                                    </Box>
                                    <Typography sx={{ ...subTextSx, mt: .65 }}>
                                        {item.projectCount} Project{item.projectCount === 1 ? "" : "s"} · {item.productCount} Product{item.productCount === 1 ? "" : "s"} · {item.mrCount} MR{item.mrCount === 1 ? "" : "s"}
                                    </Typography>
                                    <Box sx={{ mt: .9, display: "grid", gridTemplateColumns: "1fr 1fr", gap: .55 }}>
                                        <Detail label="Demand Lines" value={item.lineCount} />
                                        <Detail label="Requested" value={`${formatQty(item.requestedQty)} ${item.uom || ""}`} />
                                        <Detail label="Reserved" value={`${formatQty(item.reservedQty)} ${item.uom || ""}`} />
                                        <Detail label="Shortage" value={`${formatQty(item.shortageQty)} ${item.uom || ""}`} />
                                        <Detail label="Issued" value={`${formatQty(item.issuedQty)} ${item.uom || ""}`} />
                                        <Detail label="Consumed" value={`${formatQty(item.consumedQty)} ${item.uom || ""}`} />
                                    </Box>
                                    <Typography sx={{ ...subTextSx, mt: .75 }}>
                                        {bottleneck
                                            ? `Bottleneck: ${bottleneck.projectCode || "-"} · ${bottleneck.productName || bottleneck.drawingNo || "Product"} · ${readable(bottleneck.lineStatus || bottleneck.currentStage)}`
                                            : "No active material demand"}
                                        {item.riskCount ? ` · ${item.riskCount} timing risk` : ""}
                                    </Typography>
                                    <Box sx={{ display: "flex", gap: .55, mt: .9, flexWrap: "wrap" }}>
                                        {bottleneck && (
                                            <Button
                                                onClick={() => navigate(
                                                    canOpenTarget
                                                        ? target.path
                                                        : `/matflow/tracker/${bottleneck.requisitionId}`
                                                )}
                                                sx={primaryBtnSx}
                                            >
                                                {canOpenTarget ? target.label : "Open Bottleneck"}
                                            </Button>
                                        )}
                                        {item.materialId && (
                                            <Button
                                                onClick={() => navigate(`/matflow/dashboard?view=materials&materialId=${encodeURIComponent(item.materialId)}`)}
                                                sx={secondaryBtnSx}
                                            >
                                                Track Material
                                            </Button>
                                        )}
                                    </Box>
                                </Card>
                            );
                        }}
                    />
                )}
            </Box>
        );
    }

    if (view === "projects") {
        return (
            <Box sx={pageSx}>
                <UniversalDashboardHeader view={view} onViewChange={changeView} />
                <MatFlowTrackerPage embedded initialSearch={clean(searchParams.get("search"))} />
            </Box>
        );
    }

    if (view === "materials") {
        return (
            <Box sx={pageSx}>
                <UniversalDashboardHeader view={view} onViewChange={changeView} />
                <MatFlowMaterialTrackerPage embedded materialIdOverride={materialId} onMaterialChange={(id) => {
                    const next = new URLSearchParams(searchParams);
                    next.set("view", "materials");
                    if (id) next.set("materialId", id);
                    else next.delete("materialId");
                    setSearchParams(next, { replace: true });
                }} />
            </Box>
        );
    }

    const totals = data?.totals || {};
    const kpis = tracker?.kpis || {};
    const liveRows = (tracker?.rows || [])
        .filter((row) => !["CANCELLED", "PRODUCTION_COMPLETED"].includes(normalize(row.currentStage)))
        .sort((a, b) => numeric(b.ageHours) - numeric(a.ageHours))
        .slice(0, 8);

    const cards = [
        ["Active Projects", totals.activeProjects ?? 0],
        ["Open MRs", kpis.activeRequisitions ?? totals.openRequisitions ?? 0],
        ["Shortage MRs", kpis.shortagePending ?? totals.shortageRequisitions ?? 0],
        ["Material In Transit", kpis.materialInTransit ?? totals.inTransitOutboundTransfers ?? 0],
        ["Pending QC", totals.pendingQcInspections ?? 0],
        ["Processing Jobs", totals.activeProcessingJobs ?? 0],
    ];

    return (
        <Box sx={pageSx}>
            <UniversalDashboardHeader view={view} onViewChange={changeView} onRefresh={load} refreshing={loading} />
            <ErrorBox>{error}</ErrorBox>
            {loading ? <LoadingBlock /> : (
                <>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(6,minmax(0,1fr))", gap: 1 }}>
                        {cards.map(([label, value]) => <SummaryCard key={label} label={label} value={value ?? 0} />)}
                    </Box>

                    <Card sx={panelSx}>
                        <Typography sx={{ fontWeight: 950, fontSize: 17 }}>Live Material Execution</Typography>
                        <Typography sx={{ ...subTextSx, mb: 1.2 }}>The highest-age active Project/Product MRs and their current material owner/location.</Typography>
                        <Box sx={tableShellSx}>
                            <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "220px 160px 170px 170px 120px 170px 120px" }}>
                                {["PD No. / Product", "MR", "Current Department", "Current Location", "Ready %", "Blocker / Next", "Action"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                            </Box>
                            {liveRows.length === 0 ? <EmptyState>No active Material Requisitions.</EmptyState> : liveRows.map((row) => {
                                const target = nextActionTarget(row);
                                return (
                                    <Box key={row.requisitionId} sx={{ ...tableRowSx, gridTemplateColumns: "220px 160px 170px 170px 120px 170px 120px" }}>
                                        <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.projectCode} · {row.productName}</Typography><Typography sx={subTextSx}>{row.clientName} · {row.drawingNo}</Typography></Box>
                                        <Box sx={tableCellSx}>{row.requisitionNumber}</Box>
                                        <Box sx={tableCellSx}><Typography sx={mainTextSx}>{readable(row.currentDepartment || row.responsibleDesk)}</Typography><Typography sx={subTextSx}>{readable(row.currentStage)}</Typography></Box>
                                        <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.currentLocationCode || "-"}</Typography><Typography sx={subTextSx}>{row.currentLocationName || "-"}</Typography></Box>
                                        <Box sx={tableCellSx}>{Math.round(numeric(row.materialReadyPercent))}%</Box>
                                        <Box sx={tableCellSx}><Typography sx={subTextSx}>{readable(row.productionStartBlocker || row.nextDepartment || row.currentStage)}</Typography></Box>
                                        <Box sx={tableCellSx}>{canAccessMatFlowScreenForContext(target.screen, roles, contextPlants) ? <Button onClick={() => navigate(target.path)} sx={secondaryBtnSx}>{target.label}</Button> : <Button onClick={() => navigate(`/matflow/tracker/${row.requisitionId}`)} sx={secondaryBtnSx}>Trace</Button>}</Box>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Card>

                    <Card sx={panelSx}>
                        <Typography sx={{ fontWeight: 950, fontSize: 17, mb: 1 }}>Workflow</Typography>
                        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 1 }}>
                            {[
                                ["Projects", "Project + Products", "/matflow/projects", "projects"],
                                ["BOM", "Engineering → Production Review", "/matflow/boms", "boms"],
                                ["MR", "Production demand", "/matflow/production", "production"],
                                ["Store", "Plant routing / Main Store planning", "/matflow/store", "store"],
                                ["Purchase", "PI → PO → GRN at Main Store", "/matflow/purchase", "purchase"],
                                ["QC", "Main Store checklist", "/matflow/qc", "qc"],
                                ["Production", "Receive → account → complete", "/matflow/production-execution", "production-execution"],
                            ].filter(([, , , screen]) => canAccessMatFlowScreenForContext(screen, roles, contextPlants)).map(([title, subtitle, path]) => (
                                <Card key={title} onClick={() => navigate(path)} sx={{ ...panelSx, m: 0, cursor: "pointer", boxShadow: "none" }}>
                                    <Typography sx={mainTextSx}>{title}</Typography>
                                    <Typography sx={subTextSx}>{subtitle}</Typography>
                                </Card>
                            ))}
                        </Box>
                    </Card>
                </>
            )}
        </Box>
    );
}

export function MatFlowTrackerPage({ embedded = false, initialSearch = "" }) {
    const navigate = useNavigate();
    const { selectedPlantParam, availablePlants, roles } = useMatFlow();
    const contextPlants = selectedPlantParam ? [selectedPlantParam] : availablePlants;
    const [data, setData] = useState({ kpis: {}, rows: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState(initialSearch || "");
    const [stage, setStage] = useState("");
    const [expandedProjects, setExpandedProjects] = useState({});
    const [trackerView, setTrackerView] = useState("HIERARCHY");

    useEffect(() => {
        setSearch(initialSearch || "");
    }, [initialSearch]);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await matflowApi.getTracker({
                plantCode: selectedPlantParam,
                search: clean(search) || undefined,
                stage: stage || undefined,
            });
            setData(response?.data || { kpis: {}, rows: [] });
        } catch (requestError) {
            setData({ kpis: {}, rows: [] });
            setError(readMatFlowError(requestError, "Unable to load Project Material Tracker."));
        } finally {
            setLoading(false);
        }
    }, [selectedPlantParam, search, stage]);

    useEffect(() => { load(); }, [load]);

    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const kpis = data?.kpis || {};
    const routedStorePending = rows.filter((row) => ["ORIGIN_STORE_FORWARDING", "AWAITING_MAIN_STORE_PLANNING", "AWAITING_STORE_PLANNING"].includes(normalize(row.currentStage))).length;
    const stages = useMemo(() => ["", ...Array.from(new Set(rows.map((row) => normalize(row.currentStage)).filter(Boolean))).sort()], [rows]);
    const projectGroups = useMemo(() => {
        const grouped = new Map();
        rows.forEach((row) => {
            const key = [row.projectCode, row.projectName, row.clientName].map((value) => clean(value).toUpperCase()).join("|") || `PROJECT:${row.projectDrawingId || row.requisitionId}`;
            if (!grouped.has(key)) {
                grouped.set(key, {
                    key,
                    projectCode: row.projectCode,
                    projectName: row.projectName,
                    clientName: row.clientName,
                    plantCode: row.destinationPlantCode,
                    rows: [],
                });
            }
            grouped.get(key).rows.push(row);
        });
        return Array.from(grouped.values()).map((project) => ({
            ...project,
            productCount: new Set(project.rows.map((row) => row.projectDrawingId || `${row.productName}:${row.drawingNo}`)).size,
            shortageQty: project.rows.reduce((sum, row) => sum + numeric(row.shortageQty), 0),
            readyCount: project.rows.filter((row) => row.readyToStartProduction === true).length,
            riskCount: project.rows.filter((row) => ["BREACHED", "COMPLETED_LATE"].includes(normalize(row.timingHealth))).length,
        }));
    }, [rows]);
    const projectPagination = useMatFlowPagination(projectGroups, 8);

    return (
        <Box sx={embedded ? { display: "grid", gap: 1.1 } : pageSx}>
            {!embedded && <PageHero
                badge="PROJECT / PRODUCT TRACKER"
                title="Material Execution Tracker"
                subtitle="One row per MR with Product context, current material department/location, readiness, shortage and the next responsible action."
                actions={
                    <>
                        <Button startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMatFlowExcel({ fileName: "MatFlow_Project_Tracker", sheetName: "Tracker", title: "MatFlow Project Material Tracker", rows })} sx={secondaryBtnSx}>Export Excel</Button>
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                    </>
                }
            />}
            {embedded && (
                <Card sx={{ ...panelSx, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <Box><Typography sx={{ fontWeight: 950, fontSize: 17 }}>Project / Product Material Tracker</Typography><Typography sx={subTextSx}>Expand a Project to trace its Products, MRs, readiness, shortages and next responsible action.</Typography></Box>
                    <Box sx={{ display: "flex", gap: .7 }}>
                        <Button startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMatFlowExcel({ fileName: "MatFlow_Project_Tracker", sheetName: "Tracker", title: "MatFlow Project Material Tracker", rows })} sx={secondaryBtnSx}>Export</Button>
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                    </Box>
                </Card>
            )}

            <Card sx={{ ...panelSx, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <Box>
                    <Typography sx={mainTextSx}>Tracker View</Typography>
                    <Typography sx={subTextSx}>{trackerView === "KANBAN" ? "Detailed MR-level Kanban inside the selected Project/Product tracker. Actions still open the authoritative workflow screen." : "Project hierarchy with collapsible Products and MR detail."}</Typography>
                </Box>
                <MatFlowViewToggle
                    value={trackerView}
                    onChange={setTrackerView}
                    options={[{ value: "HIERARCHY", label: "Hierarchy" }, { value: "KANBAN", label: "MR Kanban" }]}
                />
            </Card>

            <ErrorBox>{error}</ErrorBox>

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(6,minmax(0,1fr))", gap: 1 }}>
                <SummaryCard label="Active MRs" value={kpis.activeRequisitions ?? 0} />
                <SummaryCard label="Awaiting Store" value={routedStorePending} />
                <SummaryCard label="Shortage" value={kpis.shortagePending ?? 0} />
                <SummaryCard label="Reserved" value={kpis.materialReserved ?? 0} />
                <SummaryCard label="In Transit" value={kpis.materialInTransit ?? 0} />
                <SummaryCard label="Production" value={kpis.productionInProgress ?? 0} />
            </Box>

            <Card sx={panelSx}>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 1 }}>
                    <TextField label="Search PD No. / Product / MR / Material State" value={search} onChange={(e) => setSearch(e.target.value)} sx={fieldSx} />
                    <TextField select label="Current Stage" value={stage} onChange={(e) => setStage(e.target.value)} sx={fieldSx}>
                        {stages.map((value) => <MenuItem key={value || "ALL"} value={value}>{value ? readable(value) : "All Stages"}</MenuItem>)}
                    </TextField>
                </Box>
            </Card>

            {trackerView === "KANBAN" ? (
                loading ? <LoadingBlock /> : (
                    <MatFlowKanbanBoard
                        columns={FLOW.map(([key, label]) => ({ key, label, subtitle: key === "COMPLETE" ? "Production completed" : "Current workflow ownership" }))}
                        items={rows}
                        laneFor={(row) => stageBucket(row.currentStage)}
                        minColumnWidth={275}
                        renderCard={(row) => {
                            const target = nextActionTarget(row);
                            const canOpenTarget = canAccessMatFlowScreenForContext(target.screen, roles, contextPlants);
                            return (
                                <Card sx={{ ...panelSx, m: 0, p: 1.1, boxShadow: "none" }}>
                                    <Typography sx={{ ...mainTextSx, fontSize: 12.5 }}>{row.projectCode || "-"} · {row.productName || "-"}</Typography>
                                    <Typography sx={subTextSx}>{row.requisitionNumber || "-"} · {row.destinationPlantCode || "-"}</Typography>
                                    <Box sx={{ mt: .8, display: "flex", gap: .45, flexWrap: "wrap" }}>
                                        <MatFlowStatusChip status={row.currentStage} />
                                        <TimingHealthChip health={row.timingHealth} />
                                    </Box>
                                    <Typography sx={{ ...subTextSx, mt: .7 }}>Ready {Math.round(numeric(row.materialReadyPercent))}% · Shortage {formatQty(row.shortageQty)}</Typography>
                                    <Box sx={{ display: "flex", gap: .5, mt: .8, flexWrap: "wrap" }}>
                                        <Button onClick={() => navigate(canOpenTarget ? target.path : `/matflow/tracker/${row.requisitionId}`)} sx={primaryBtnSx}>{canOpenTarget ? target.label : "Trace"}</Button>
                                        <Button onClick={() => navigate(`/matflow/tracker/${row.requisitionId}`)} sx={secondaryBtnSx}>Trace</Button>
                                    </Box>
                                </Card>
                            );
                        }}
                    />
                )
            ) : (
                <Box sx={{ display: "grid", gap: 1 }}>
                    {loading ? <LoadingBlock /> : projectPagination.pageItems.length === 0 ? <EmptyState /> : projectPagination.pageItems.map((project) => {
                        const expanded = expandedProjects[project.key] === true;
                        return (
                            <Card key={project.key} sx={{ ...panelSx, p: 0, overflow: "hidden" }}>
                                <Box
                                    role={!expanded ? "button" : undefined}
                                    tabIndex={!expanded ? 0 : undefined}
                                    onClick={() => {
                                        if (!expanded) setExpandedProjects((current) => ({ ...current, [project.key]: true }));
                                    }}
                                    onKeyDown={(event) => {
                                        if (!expanded && (event.key === "Enter" || event.key === " ")) {
                                            event.preventDefault();
                                            setExpandedProjects((current) => ({ ...current, [project.key]: true }));
                                        }
                                    }}
                                    sx={{
                                        px: 1.5,
                                        py: 1.2,
                                        display: "grid",
                                        gridTemplateColumns: "minmax(260px,1fr) 110px 120px 120px 48px",
                                        gap: 1,
                                        alignItems: "center",
                                        cursor: expanded ? "default" : "pointer",
                                        background: expanded ? "var(--mf-surface)" : "var(--mf-panel-bg)",
                                    }}
                                >
                                    <Box>
                                        <Typography sx={{ ...mainTextSx, fontSize: 14 }}>{project.projectCode || "-"} · {project.projectName || "Project"}</Typography>
                                        <Typography sx={subTextSx}>{project.clientName || "-"} · {project.plantCode || "-"}</Typography>
                                    </Box>
                                    <Box><Typography sx={mainTextSx}>{project.productCount}</Typography><Typography sx={subTextSx}>Products</Typography></Box>
                                    <Box><Typography sx={mainTextSx}>{project.rows.length}</Typography><Typography sx={subTextSx}>MRs</Typography></Box>
                                    <Box><Typography sx={mainTextSx}>{formatQty(project.shortageQty)}</Typography><Typography sx={subTextSx}>{project.riskCount ? `${project.riskCount} timing risk` : `${project.readyCount} ready`}</Typography></Box>
                                    <Box sx={{ display: "grid", placeItems: "center" }}>
                                        {expanded && (
                                            <Button
                                                aria-label="Collapse project"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setExpandedProjects((current) => ({ ...current, [project.key]: false }));
                                                }}
                                                sx={{ ...secondaryBtnSx, minWidth: 38, width: 38, px: 0 }}
                                            >
                                                <ExpandLessIcon fontSize="small" />
                                            </Button>
                                        )}
                                    </Box>
                                </Box>

                                <Collapse in={expanded} unmountOnExit>
                                    <Box sx={tableShellSx}>
                                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "200px 165px 165px 155px 105px 120px 175px 110px" }}>
                                            {["Product / Drawing", "MR", "Current Owner", "Current Location", "Ready", "Shortage", "Next", "Action"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                                        </Box>
                                        {project.rows.map((row) => (
                                            <Box key={row.requisitionId} sx={{ ...tableRowSx, gridTemplateColumns: "200px 165px 165px 155px 105px 120px 175px 110px" }}>
                                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.productName || "-"}</Typography><Typography sx={subTextSx}>{row.drawingNo || "-"}</Typography></Box>
                                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.requisitionNumber}</Typography><Typography sx={subTextSx}>{readable(row.currentStage)}</Typography></Box>
                                                <Box sx={tableCellSx}>{readable(row.currentDepartment || row.responsibleDesk)}</Box>
                                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.currentLocationCode || "-"}</Typography><Typography sx={subTextSx}>{row.currentLocationName || "-"}</Typography></Box>
                                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{Math.round(numeric(row.materialReadyPercent))}%</Typography><LinearProgress variant="determinate" value={Math.min(100, Math.max(0, numeric(row.materialReadyPercent)))} /></Box>
                                                <Box sx={tableCellSx}>{formatQty(row.shortageQty)}</Box>
                                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{readable(row.nextDepartment || row.productionStartBlocker)}</Typography><TimingHealthChip health={row.timingHealth} /></Box>
                                                <Box sx={tableCellSx}><Button endIcon={<ArrowForwardIcon />} onClick={() => navigate(`/matflow/tracker/${row.requisitionId}`)} sx={secondaryBtnSx}>Track</Button></Box>
                                            </Box>
                                        ))}
                                    </Box>
                                </Collapse>
                            </Card>
                        );
                    })}
                </Box>
            )}
            {!loading && trackerView === "HIERARCHY" && <MatFlowPagination {...projectPagination} onPageChange={projectPagination.setPage} onPageSizeChange={projectPagination.setPageSize} label="Projects" />}
        </Box>
    );
}

export function MatFlowTrackerDetailPage() {
    const { requisitionId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        if (!requisitionId) return;
        setLoading(true);
        setError("");
        try {
            setData((await matflowApi.getTrackerDetail(requisitionId))?.data || null);
        } catch (requestError) {
            setData(null);
            setError(readMatFlowError(requestError, "Unable to load tracker detail."));
        } finally {
            setLoading(false);
        }
    }, [requisitionId]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <LoadingBlock />;
    const summary = data?.summary;
    if (!summary) return <Box sx={pageSx}><PageHero title="Tracker Detail" /><ErrorBox>{error || "Tracker record not found."}</ErrorBox></Box>;

    const stages = Array.isArray(data?.stages) ? data.stages : [];
    const materials = Array.isArray(data?.materials) ? data.materials : [];
    const events = Array.isArray(data?.events) ? data.events : [];

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="MR MATERIAL TRACE"
                title={`${summary.projectCode} · ${summary.productName}`}
                subtitle={`${summary.requisitionNumber} · ${summary.clientName || "-"} · ${summary.drawingNo || "-"}`}
                actions={
                    <>
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                        <Button onClick={() => navigate("/matflow/dashboard?view=projects")} sx={secondaryBtnSx}>Back</Button>
                    </>
                }
            />
            <ErrorBox>{error}</ErrorBox>

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 1 }}>
                <SummaryCard label="Material Ready" value={`${Math.round(numeric(summary.materialReadyPercent))}%`} />
                <SummaryCard label="Shortage" value={formatQty(summary.shortageQty)} />
                <SummaryCard label="Current Owner" value={readable(summary.currentDepartment)} />
                <SummaryCard label="Stage Time" value={formatDurationMinutes(summary.stageDurationMinutes)} />
                <SummaryCard label="Production Start" value={summary.readyToStartProduction ? "READY" : readable(summary.productionStartBlocker)} />
            </Box>

            <Card sx={panelSx}>
                <Typography sx={{ fontWeight: 950, fontSize: 17 }}>Major Workflow</Typography>
                <Box sx={{ mt: 1, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 1 }}>
                    {stages.map((stage) => (
                        <Card key={stage.key} sx={{ ...panelSx, m: 0, boxShadow: "none" }}>
                            <Typography sx={mainTextSx}>{stage.label}</Typography>
                            <Typography sx={subTextSx}>{stage.department} · {stage.locationCode || "-"}</Typography>
                            <Box sx={{ mt: .8, display: "flex", gap: .6, alignItems: "center", flexWrap: "wrap" }}>
                                <MatFlowStatusChip status={stage.state} />
                                <TimingHealthChip health={stage.timingHealth} />
                            </Box>
                            <Typography sx={{ ...subTextSx, mt: .7 }}>{formatDurationMinutes(stage.durationMinutes)}</Typography>
                        </Card>
                    ))}
                </Box>
            </Card>

            <Card sx={panelSx}>
                <Typography sx={{ fontWeight: 950, fontSize: 17 }}>Material Positions</Typography>
                <Typography sx={{ ...subTextSx, mb: 1.1 }}>Specific material custody and next hand-off; internal transfer records are represented only as route state.</Typography>
                <Box sx={tableShellSx}>
                    <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "200px 110px 110px 110px 180px 170px 180px" }}>
                        {["Material", "Requested", "Shortage", "Tracked Qty", "Current", "Location / State", "Next"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                    </Box>
                    {materials.length === 0 ? <EmptyState /> : materials.map((row, index) => (
                        <Box key={`${row.requisitionLineId}:${row.reservationId || index}`} sx={{ ...tableRowSx, gridTemplateColumns: "200px 110px 110px 110px 180px 170px 180px" }}>
                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialName || "-"}</Typography><Typography sx={subTextSx}>{row.currentMaterialCode || row.bomMaterialCode} · {row.uom}</Typography></Box>
                            <Box sx={tableCellSx}>{formatQty(row.requestedQty)}</Box>
                            <Box sx={tableCellSx}>{formatQty(row.shortageQty)}</Box>
                            <Box sx={tableCellSx}>{formatQty(row.trackedQty)}</Box>
                            <Box sx={tableCellSx}>{readable(row.currentDepartment)}</Box>
                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.currentLocationCode || "-"}</Typography><Typography sx={subTextSx}>{readable(row.movementState)}</Typography></Box>
                            <Box sx={tableCellSx}>{readable(row.nextDepartment)}{row.nextLocationCode ? ` · ${row.nextLocationCode}` : ""}</Box>
                        </Box>
                    ))}
                </Box>
            </Card>

            {events.length > 0 && (
                <Card sx={panelSx}>
                    <Typography sx={{ fontWeight: 950, fontSize: 17, mb: 1 }}>Audit Timeline</Typography>
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "180px 160px 160px minmax(260px,1fr)" }}>
                            {["Action", "Actor", "Time", "Details"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {events.slice().reverse().slice(0, 50).map((event) => (
                            <Box key={event.id} sx={{ ...tableRowSx, gridTemplateColumns: "180px 160px 160px minmax(260px,1fr)" }}>
                                <Box sx={tableCellSx}>{readable(event.action)}</Box>
                                <Box sx={tableCellSx}>{event.actor || "-"}</Box>
                                <Box sx={tableCellSx}>{formatDate(event.actionAt)}</Box>
                                <Box sx={{ ...tableCellSx, whiteSpace: "normal" }}>{event.detailsJson || "-"}</Box>
                            </Box>
                        ))}
                    </Box>
                </Card>
            )}
        </Box>
    );
}

export function MatFlowMaterialTrackerPage({ embedded = false, materialIdOverride = "", onMaterialChange = null }) {
    const { materialId: routeMaterialId } = useParams();
    const materialId = materialIdOverride || routeMaterialId || "";
    const navigate = useNavigate();
    const { selectedPlantParam } = useMatFlow();

    const [materials, setMaterials] = useState([]);
    const [projects, setProjects] = useState([]);
    const [selectedId, setSelectedId] = useState(materialId || "");
    const [selectedProjectId, setSelectedProjectId] = useState("");
    const [selectedProductId, setSelectedProductId] = useState("");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [activeOnly, setActiveOnly] = useState(true);
    const [expandedLotKey, setExpandedLotKey] = useState("");

    useEffect(() => {
        let active = true;
        Promise.all([
            matflowApi.listMaterials({ active: true }),
            matflowApi.listProjects({
                active: true,
                plantCode: selectedPlantParam || undefined,
            }),
        ])
            .then(([materialResponse, projectResponse]) => {
                if (!active) return;
                setMaterials(extractMatFlowPage(materialResponse?.data).rows);
                const projectRows = extractMatFlowPage(projectResponse?.data).rows;
                setProjects(projectRows);
                setSelectedProjectId((current) =>
                    current && projectRows.some((project) => String(project.id) === String(current))
                        ? current
                        : ""
                );
            })
            .catch(() => {
                if (!active) return;
                setMaterials([]);
                setProjects([]);
                setSelectedProjectId("");
                setSelectedProductId("");
            });
        return () => { active = false; };
    }, [selectedPlantParam]);

    const selectedProject = useMemo(
        () => projects.find((project) => String(project.id) === String(selectedProjectId)) || null,
        [projects, selectedProjectId]
    );

    const availableProducts = useMemo(
        () => (Array.isArray(selectedProject?.products) ? selectedProject.products : [])
            .filter((product) => product?.active !== false),
        [selectedProject]
    );

    useEffect(() => {
        if (!selectedProductId) return;
        if (!availableProducts.some((product) => String(product.id) === String(selectedProductId))) {
            setSelectedProductId("");
        }
    }, [availableProducts, selectedProductId]);

    const load = useCallback(async () => {
        const id = selectedId || materialId;
        if (!id) {
            setData(null);
            return;
        }
        setLoading(true);
        setError("");
        try {
            setData((await matflowApi.getMaterialTracker(id, {
                plantCode: selectedPlantParam,
                activeOnly,
            }))?.data || null);
        } catch (requestError) {
            setData(null);
            setError(readMatFlowError(requestError, "Unable to load Material Control Tower."));
        } finally {
            setLoading(false);
        }
    }, [selectedId, materialId, selectedPlantParam, activeOnly]);

    useEffect(() => { if (selectedId || materialId) load(); }, [load, selectedId, materialId]);

    const lots = Array.isArray(data?.lots) ? data.lots : [];
    const filteredLots = useMemo(() => {
        const term = clean(search).toLowerCase();
        return lots.filter((row) => {
            if (selectedProjectId && String(row.projectId || "") !== String(selectedProjectId)) {
                return false;
            }
            if (selectedProductId && String(row.productId || "") !== String(selectedProductId)) {
                return false;
            }
            if (!term) return true;
            return [
                row.projectCode, // compatibility field: business PD No.
                row.projectName,
                row.clientName,
                row.productName,
                row.drawingNo,
                row.bomNumber,
                row.requisitionNumber,
                row.currentStage,
                row.currentDepartment,
                row.currentLocationCode,
                row.nextDepartment,
                row.nextAction,
            ].some((value) => clean(value).toLowerCase().includes(term));
        });
    }, [lots, search, selectedProjectId, selectedProductId]);

    const pagination = useMatFlowPagination(filteredLots, 20);
    const identity = data?.material || {};
    const kpis = data?.kpis || {};
    const visibleKpis = useMemo(() => {
        const live = filteredLots.filter((row) => row.completed !== true);
        return {
            projectCount: new Set(filteredLots.map((row) => row.projectId).filter(Boolean)).size,
            productCount: new Set(filteredLots.map((row) => row.productId).filter(Boolean)).size,
            liveLotCount: live.length,
            shortageQty: filteredLots.reduce((total, row) => total + numeric(row.lineShortageQty), 0),
            delayedLotCount: live.filter((row) => ["BREACHED", "COMPLETED_LATE"].includes(normalize(row.timingHealth))).length,
        };
    }, [filteredLots]);

    return (
        <Box sx={embedded ? { display: "grid", gap: 1.1 } : pageSx}>
            {!embedded && <PageHero
                badge="MATERIAL CONTROL TOWER"
                title={identity.materialName || "Track One Material"}
                subtitle={identity.materialCode
                    ? `${identity.materialCode} · ${identity.category || "-"} · ${identity.uom || "-"}`
                    : "Select a Material Inventory item to see every Project/Product allocation, current route and next action."}
                actions={<Button startIcon={<RefreshIcon />} onClick={load} disabled={!selectedId && !materialId} sx={secondaryBtnSx}>Refresh</Button>}
            />}
            {embedded && (
                <Card sx={{ ...panelSx, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <Box><Typography sx={{ fontWeight: 950, fontSize: 17 }}>{identity.materialName || "Material Tracker"}</Typography><Typography sx={subTextSx}>{identity.materialCode ? `${identity.materialCode} · ${identity.category || "-"} · ${identity.uom || "-"}` : "Select a Material Inventory item to trace it across Projects, Products, MRs and custody routes."}</Typography></Box>
                    <Button startIcon={<RefreshIcon />} onClick={load} disabled={!selectedId && !materialId} sx={secondaryBtnSx}>Refresh</Button>
                </Card>
            )}

            <ErrorBox>{error}</ErrorBox>

            <Card sx={panelSx}>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(260px,1.15fr) minmax(210px,.9fr) minmax(230px,1fr) minmax(200px,.9fr) 160px" }, gap: 1 }}>
                    <TextField select label="Material *" value={selectedId} onChange={(e) => { const id = e.target.value; setSelectedId(id); setExpandedLotKey(""); if (embedded && onMaterialChange) onMaterialChange(id); else navigate(`/matflow/dashboard?view=materials&materialId=${encodeURIComponent(id)}`, { replace: true }); }} sx={fieldSx}>
                        {materials.map((material) => <MenuItem key={material.id} value={material.id}>{material.materialName} · {material.materialCode}</MenuItem>)}
                    </TextField>
                    <TextField
                        select
                        label="PD No. / Project"
                        value={selectedProjectId}
                        onChange={(e) => { setSelectedProjectId(e.target.value); setSelectedProductId(""); }}
                        sx={fieldSx}
                    >
                        <MenuItem value="">All PDs / Projects</MenuItem>
                        {projects.map((project) => (
                            <MenuItem key={project.id} value={project.id}>
                                {project.projectCode || "-"} · {project.projectName || "Project"}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        select
                        label="Product / Drawing"
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        disabled={!selectedProjectId}
                        sx={fieldSx}
                    >
                        <MenuItem value="">All Products</MenuItem>
                        {availableProducts.map((product) => (
                            <MenuItem key={product.id} value={product.id}>
                                {product.productName || "Product"} · {product.drawingNo || "-"}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField label="Search MR / BOM / state" value={search} onChange={(e) => setSearch(e.target.value)} sx={fieldSx} />
                    <TextField select label="Scope" value={activeOnly ? "ACTIVE" : "ALL"} onChange={(e) => setActiveOnly(e.target.value === "ACTIVE")} sx={fieldSx}>
                        <MenuItem value="ACTIVE">Live only</MenuItem>
                        <MenuItem value="ALL">All history</MenuItem>
                    </TextField>
                </Box>
            </Card>

            {loading ? <LoadingBlock /> : data && (
                <>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(6,minmax(0,1fr))", gap: 1 }}>
                        <SummaryCard label="PDs / Projects" value={visibleKpis.projectCount} />
                        <SummaryCard label="Products" value={visibleKpis.productCount} />
                        <SummaryCard label="Live Lots" value={visibleKpis.liveLotCount} />
                        <SummaryCard label="Shortage Qty" value={formatQty(visibleKpis.shortageQty)} />
                        <SummaryCard label="Available Stock (Plant)" value={formatQty(kpis.availableQty)} />
                        <SummaryCard label="Delayed Lots" value={visibleKpis.delayedLotCount} />
                    </Box>

                    <Card sx={panelSx}>
                        <Typography sx={{ fontWeight: 950, fontSize: 17 }}>Material Routes by PD / Product</Typography>
                        <Typography sx={{ ...subTextSx, mb: 1.2 }}>Each row follows the actual branch taken by this material, including Store, Purchase, QC, Processing and Production custody.</Typography>
                        <Box sx={tableShellSx}>
                            <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "220px 175px 130px 180px 150px 190px 150px 105px" }}>
                                {["PD No. / Product", "MR", "Tracked Qty", "Current", "Location", "Next Action", "Timing", "Route"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                            </Box>
                            {pagination.pageItems.length === 0 ? <EmptyState /> : pagination.pageItems.map((row) => {
                                const history = Array.isArray(row.history) ? row.history : [];
                                const expanded = expandedLotKey === row.lotKey;
                                return (
                                    <Fragment key={row.lotKey}>
                                        <Box sx={{ ...tableRowSx, gridTemplateColumns: "220px 175px 130px 180px 150px 190px 150px 105px" }}>
                                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.projectCode} · {row.productName}</Typography><Typography sx={subTextSx}>{row.clientName} · {row.drawingNo}</Typography></Box>
                                            <Box sx={tableCellSx}>{row.requisitionNumber || "-"}</Box>
                                            <Box sx={tableCellSx}>{formatQty(row.trackedQty)}</Box>
                                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{readable(row.currentDepartment)}</Typography><Typography sx={subTextSx}>{readable(row.currentStage)}</Typography></Box>
                                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.currentLocationCode || "-"}</Typography><Typography sx={subTextSx}>{row.currentLocationName || "-"}</Typography></Box>
                                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{readable(row.nextDepartment)}</Typography><Typography sx={subTextSx}>{readable(row.nextAction)}</Typography></Box>
                                            <Box sx={tableCellSx}><TimingHealthChip health={row.timingHealth} /><Typography sx={subTextSx}>{formatDurationMinutes(row.currentDwellMinutes)}</Typography></Box>
                                            <Box sx={tableCellSx}>
                                                <Button
                                                    onClick={() => setExpandedLotKey((current) => current === row.lotKey ? "" : row.lotKey)}
                                                    sx={secondaryBtnSx}
                                                >
                                                    {expanded ? "Hide" : "Route"}
                                                </Button>
                                            </Box>
                                        </Box>
                                        <Collapse in={expanded} unmountOnExit>
                                            <Box sx={{ p: 1.2, borderBottom: "1px solid var(--mf-border)", background: "var(--mf-surface)" }}>
                                                <Typography sx={{ fontWeight: 900, mb: .8 }}>Specific Material Route & Custody History</Typography>
                                                {history.length === 0 ? (
                                                    <Typography sx={subTextSx}>No custody events have been recorded for this lot yet.</Typography>
                                                ) : (
                                                    <Box sx={tableShellSx}>
                                                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "70px 190px 170px 170px 145px 145px 125px 150px" }}>
                                                            {["#", "State", "Department / Location", "Time In", "Time Out", "Duration", "Actor", "Reference"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                                                        </Box>
                                                        {history.map((event) => (
                                                            <Box key={`${row.lotKey}:${event.sequence}`} sx={{ ...tableRowSx, gridTemplateColumns: "70px 190px 170px 170px 145px 145px 125px 150px" }}>
                                                                <Box sx={tableCellSx}>{event.sequence}</Box>
                                                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{event.label || readable(event.state)}</Typography><Typography sx={subTextSx}>{readable(event.state)} · {formatQty(event.quantity)} {row.uom || ""}</Typography></Box>
                                                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{readable(event.department)}</Typography><Typography sx={subTextSx}>{event.locationCode || event.locationName || "Administrative / external"}</Typography></Box>
                                                                <Box sx={tableCellSx}>{formatDate(event.enteredAt)}</Box>
                                                                <Box sx={tableCellSx}>{event.exitedAt ? formatDate(event.exitedAt) : "Current"}</Box>
                                                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{formatDurationMinutes(event.durationMinutes)}</Typography><TimingHealthChip health={event.timingHealth} /></Box>
                                                                <Box sx={tableCellSx}>{event.actor || "-"}</Box>
                                                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{event.referenceNumber || event.referenceType || "-"}</Typography><Typography sx={subTextSx}>{event.note || ""}</Typography></Box>
                                                            </Box>
                                                        ))}
                                                    </Box>
                                                )}
                                            </Box>
                                        </Collapse>
                                    </Fragment>
                                );
                            })}
                        </Box>
                        <MatFlowPagination {...pagination} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} label="Material Lots" />
                    </Card>
                </>
            )}
        </Box>
    );
}

export function MatFlowMaterialRegisterPage() {
    const { selectedPlantParam } = useMatFlow();
    const [data, setData] = useState({ rows: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            setData((await matflowApi.materialRegister({
                plantCode: selectedPlantParam,
                search: clean(search) || undefined,
            }))?.data || { rows: [] });
        } catch (requestError) {
            setData({ rows: [] });
            setError(readMatFlowError(requestError, "Unable to load Material Register."));
        } finally {
            setLoading(false);
        }
    }, [selectedPlantParam, search]);

    useEffect(() => { load(); }, [load]);

    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const pagination = useMatFlowPagination(rows, 20);

    const totals = useMemo(() => rows.reduce((sum, row) => ({
        purchased: sum.purchased + numeric(row.purchasedQty),
        issued: sum.issued + numeric(row.issuedQty),
        consumed: sum.consumed + numeric(row.consumedQty),
        waste: sum.waste + numeric(row.productionWastedQty) + numeric(row.processingWastedQty),
        onHand: sum.onHand + numeric(row.onHandQty),
    }), { purchased: 0, issued: 0, consumed: 0, waste: 0, onHand: 0 }), [rows]);

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="DERIVED INVENTORY HELPER"
                title="Material Register"
                subtitle="Calculated from immutable stock ledger, balances and Processing records—purchased, issued, consumed, wasted, returned and current stock are never maintained in a duplicate register table."
                actions={
                    <>
                        <Button startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMatFlowExcel({ fileName: "MatFlow_Material_Register", sheetName: "Material Register", title: "MatFlow Material Register", rows })} sx={secondaryBtnSx}>Export Excel</Button>
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                    </>
                }
            />
            <ErrorBox>{error}</ErrorBox>

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 1 }}>
                <SummaryCard label="Purchased" value={formatQty(totals.purchased)} />
                <SummaryCard label="Issued to Production" value={formatQty(totals.issued)} />
                <SummaryCard label="Consumed" value={formatQty(totals.consumed)} />
                <SummaryCard label="Total Waste" value={formatQty(totals.waste)} />
                <SummaryCard label="On Hand" value={formatQty(totals.onHand)} />
            </Box>

            <Card sx={panelSx}>
                <TextField label="Search Material" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ ...fieldSx, minWidth: 320 }} />
            </Card>

            <Card sx={panelSx}>
                {loading ? <LoadingBlock /> : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "210px 110px 110px 110px 110px 110px 110px 110px 110px 140px" }}>
                            {["Material", "Purchased", "Issued", "Consumed", "Prod Waste", "Proc Waste", "Returned", "On Hand", "Available", "Last Movement"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {pagination.pageItems.length === 0 ? <EmptyState /> : pagination.pageItems.map((row) => (
                            <Box key={row.materialId} sx={{ ...tableRowSx, gridTemplateColumns: "210px 110px 110px 110px 110px 110px 110px 110px 110px 140px" }}>
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialName}</Typography><Typography sx={subTextSx}>{row.materialCode} · {row.uom}</Typography></Box>
                                <Box sx={tableCellSx}>{formatQty(row.purchasedQty)}</Box>
                                <Box sx={tableCellSx}>{formatQty(row.issuedQty)}</Box>
                                <Box sx={tableCellSx}>{formatQty(row.consumedQty)}</Box>
                                <Box sx={tableCellSx}>{formatQty(row.productionWastedQty)}</Box>
                                <Box sx={tableCellSx}>{formatQty(row.processingWastedQty)}</Box>
                                <Box sx={tableCellSx}>{formatQty(row.returnedQty)}</Box>
                                <Box sx={tableCellSx}>{formatQty(row.onHandQty)}</Box>
                                <Box sx={tableCellSx}>{formatQty(row.availableQty)}</Box>
                                <Box sx={tableCellSx}>{formatDate(row.lastMovementAt)}</Box>
                            </Box>
                        ))}
                    </Box>
                )}
                {!loading && <MatFlowPagination {...pagination} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} label="Material Register" />}
            </Card>
        </Box>
    );
}

export function MatFlowLedgerPage() {
    const { selectedPlantParam } = useMatFlow();
    const [data, setData] = useState({ rows: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [movementType, setMovementType] = useState("");
    const [page, setPage] = useState(0);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            setData(extractMatFlowPage((await matflowApi.stockLedger({
                plantCode: selectedPlantParam,
                search: clean(search) || undefined,
                movementType: movementType || undefined,
                page,
                size: 25,
            }))?.data));
        } catch (requestError) {
            setData({ rows: [], page: 0, totalPages: 0, totalElements: 0 });
            setError(readMatFlowError(requestError, "Unable to load Stock Ledger."));
        } finally {
            setLoading(false);
        }
    }, [selectedPlantParam, search, movementType, page]);

    useEffect(() => { load(); }, [load]);

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="IMMUTABLE STOCK HISTORY"
                title="Stock Ledger"
                subtitle="Physical stock, reservation, QC, issue, consumption, wastage and return movements with reference and actor traceability."
                actions={
                    <>
                        <Button startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMatFlowExcel({ fileName: "MatFlow_Stock_Ledger", sheetName: "Ledger", title: "MatFlow Stock Ledger", rows: data.rows || [] })} sx={secondaryBtnSx}>Export Page</Button>
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                    </>
                }
            />
            <ErrorBox>{error}</ErrorBox>

            <Card sx={panelSx}>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 1 }}>
                    <TextField label="Search reference / PD No. / Drawing / batch / actor" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} sx={fieldSx} />
                    <TextField label="Movement Type" value={movementType} onChange={(e) => { setMovementType(e.target.value); setPage(0); }} sx={fieldSx} />
                </Box>
            </Card>

            <Card sx={panelSx}>
                {loading ? <LoadingBlock /> : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "180px 170px 150px 150px 110px 130px 170px 140px" }}>
                            {["Material", "Location", "Movement", "Qty Change", "On Hand", "Reference", "PD No. / Drawing", "Actor / Time"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {(data.rows || []).length === 0 ? <EmptyState /> : data.rows.map((row) => (
                            <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "180px 170px 150px 150px 110px 130px 170px 140px" }}>
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialName}</Typography><Typography sx={subTextSx}>{row.materialCode}</Typography></Box>
                                <Box sx={tableCellSx}>{row.locationCode} · {row.plantCode}</Box>
                                <Box sx={tableCellSx}><MatFlowStatusChip status={row.movementType} /></Box>
                                <Box sx={tableCellSx}>{formatQty(row.quantityChange)}</Box>
                                <Box sx={tableCellSx}>{formatQty(row.onHandAfter)}</Box>
                                <Box sx={tableCellSx}>{row.referenceNumber || row.referenceType || "-"}</Box>
                                <Box sx={tableCellSx}>{row.projectCode || "-"} · {row.drawingNo || "-"}</Box>
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.actor || "-"}</Typography><Typography sx={subTextSx}>{formatDate(row.actionAt)}</Typography></Box>
                            </Box>
                        ))}
                    </Box>
                )}

                <Box sx={{ mt: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography sx={subTextSx}>{data.totalElements || 0} ledger rows</Typography>
                    <Box sx={{ display: "flex", gap: 1 }}>
                        <Button disabled={page <= 0} onClick={() => setPage((value) => Math.max(0, value - 1))} sx={secondaryBtnSx}>Previous</Button>
                        <Button disabled={page + 1 >= (data.totalPages || 0)} onClick={() => setPage((value) => value + 1)} sx={secondaryBtnSx}>Next</Button>
                    </Box>
                </Box>
            </Card>
        </Box>
    );
}

export function MatFlowReportsPage() {
    const { selectedPlantParam } = useMatFlow();
    const [shortages, setShortages] = useState([]);
    const [audits, setAudits] = useState({ rows: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [shortageResponse, auditResponse] = await Promise.all([
                matflowApi.shortageReport({ plantCode: selectedPlantParam, minimumAgeDays: 0 }),
                matflowApi.auditLogs({ plantCode: selectedPlantParam, page: 0, size: 25 }),
            ]);
            setShortages(Array.isArray(shortageResponse?.data) ? shortageResponse.data : []);
            setAudits(extractMatFlowPage(auditResponse?.data));
        } catch (requestError) {
            setShortages([]);
            setAudits({ rows: [] });
            setError(readMatFlowError(requestError, "Unable to load MatFlow reports."));
        } finally {
            setLoading(false);
        }
    }, [selectedPlantParam]);

    useEffect(() => { load(); }, [load]);

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="REPORTING"
                title="Operational Reports"
                subtitle="Shortage ageing and recent audit activity. Material stock roll-up lives in Material Register and physical movement detail lives in Stock Ledger."
                actions={<Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>}
            />
            <ErrorBox>{error}</ErrorBox>

            <Card sx={panelSx}>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center", mb: 1 }}>
                    <Box><Typography sx={{ fontWeight: 950, fontSize: 17 }}>Shortage Ageing</Typography><Typography sx={subTextSx}>Open MR shortages waiting on Store/Purchase closure.</Typography></Box>
                    <Button startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMatFlowExcel({ fileName: "MatFlow_Shortage_Ageing", sheetName: "Shortages", title: "MatFlow Shortage Ageing", rows: shortages })} sx={secondaryBtnSx}>Export</Button>
                </Box>
                {loading ? <LoadingBlock /> : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 190px 190px 100px 110px 120px 140px" }}>
                            {["MR", "PD No. / Drawing", "Material", "Requested", "Shortage", "Age", "Plant"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {shortages.length === 0 ? <EmptyState>No open shortages.</EmptyState> : shortages.slice(0, 50).map((row) => (
                            <Box key={row.requisitionLineId} sx={{ ...tableRowSx, gridTemplateColumns: "170px 190px 190px 100px 110px 120px 140px" }}>
                                <Box sx={tableCellSx}>{row.requisitionNumber}</Box>
                                <Box sx={tableCellSx}>{row.projectCode} · {row.drawingNo}</Box>
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialName}</Typography><Typography sx={subTextSx}>{row.materialCode}</Typography></Box>
                                <Box sx={tableCellSx}>{formatQty(row.requestedQty)}</Box>
                                <Box sx={tableCellSx}>{formatQty(row.shortageQty)}</Box>
                                <Box sx={tableCellSx}>{row.ageDays} day(s)</Box>
                                <Box sx={tableCellSx}>{row.plantCode}</Box>
                            </Box>
                        ))}
                    </Box>
                )}
            </Card>

            <Card sx={panelSx}>
                <Typography sx={{ fontWeight: 950, fontSize: 17, mb: 1 }}>Recent Audit Activity</Typography>
                <Box sx={tableShellSx}>
                    <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "180px 170px 150px 170px minmax(240px,1fr)" }}>
                        {["Action", "Entity", "Actor", "Time", "Project / Details"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                    </Box>
                    {(audits.rows || []).length === 0 ? <EmptyState /> : audits.rows.map((row) => (
                        <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "180px 170px 150px 170px minmax(240px,1fr)" }}>
                            <Box sx={tableCellSx}>{readable(row.action)}</Box>
                            <Box sx={tableCellSx}>{row.entityType}</Box>
                            <Box sx={tableCellSx}>{row.actor || "-"}</Box>
                            <Box sx={tableCellSx}>{formatDate(row.actionAt)}</Box>
                            <Box sx={{ ...tableCellSx, whiteSpace: "normal" }}>{row.projectCode || "-"} · {row.drawingNo || "-"} · {row.detailsJson || ""}</Box>
                        </Box>
                    ))}
                </Box>
            </Card>
        </Box>
    );
}
