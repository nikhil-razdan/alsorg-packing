import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
    Box,
    Button,
    Card,
    Collapse,
    Divider,
    Drawer,
    LinearProgress,
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import PrecisionManufacturingOutlinedIcon from "@mui/icons-material/PrecisionManufacturingOutlined";
import QueryStatsRoundedIcon from "@mui/icons-material/QueryStatsRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { canAccessMatFlowScreenForContext, useMatFlow } from "../matflowUi";
import { extractMatFlowPage, matflowApi, readMatFlowError } from "../api/matflowApi";
import { downloadMatFlowExcel } from "../api/matflowExcel";
import {
    Detail,
    EmptyState,
    ErrorBox,
    LoadingBlock,
    MatFlowIdentityBadge,
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
    getMatFlowKanbanIdentity,
    mainTextSx,
    matFlowKanbanCardSx,
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
            return { label: "Track Handoff", path: `/matflow/tracker/${id}`, screen: "tracking" };
        default:
            return { label: "Open MR", path: `/matflow/requisitions/${id}`, screen: "production" };
    }
};

const UNIVERSAL_DASHBOARD_VIEWS = [
    ["operations", "Operations Board", "Project-wise · Product-wise · Material-wise workflow control"],
    ["overview", "Overview", "KPIs, live execution and workflow health"],
    ["projects", "Project Tracker", "Project → Product → MR material readiness"],
    ["materials", "Material Tracker", "One material across Projects, Products and plant/store/processing/production hand-offs"],
];

const KANBAN_SCOPE_OPTIONS = [
    { value: "PROJECT", label: "Project-wise" },
    { value: "PRODUCT", label: "Product-wise" },
    { value: "MATERIAL", label: "Material-wise" },
];


function KanbanIdentityLegend({ scope }) {
    const projectA = getMatFlowKanbanIdentity({ kind: "PROJECT", projectKey: "LEGEND-PROJECT-A" });
    const projectB = getMatFlowKanbanIdentity({ kind: "PROJECT", projectKey: "LEGEND-PROJECT-B" });
    const productA = getMatFlowKanbanIdentity({ kind: "PRODUCT", projectKey: "LEGEND-PROJECT-A", productKey: "PRODUCT-A" });
    const productB = getMatFlowKanbanIdentity({ kind: "PRODUCT", projectKey: "LEGEND-PROJECT-A", productKey: "PRODUCT-B" });
    const materials = [
        ["Metal", "METAL", "LEGEND-METAL"],
        ["Wood / Veneer", "WOOD / VENEER", "LEGEND-WOOD"],
        ["Stone / Tile", "STONE / TILE", "LEGEND-STONE"],
        ["Hardware", "HARDWARE", "LEGEND-HARDWARE"],
    ].map(([label, category, key]) => ({
        label,
        identity: getMatFlowKanbanIdentity({
            kind: "MATERIAL",
            materialCategory: category,
            materialKey: key,
        }),
    }));

    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                gap: .65,
                flexWrap: "wrap",
                px: .2,
            }}
        >
            <Typography sx={{ ...subTextSx, fontSize: 10.2, fontWeight: 850, mr: .2 }}>
                Visual identity:
            </Typography>
            {scope === "PROJECT" && (
                <>
                    <MatFlowIdentityBadge label="Project A" identity={projectA} />
                    <MatFlowIdentityBadge label="Project B" identity={projectB} />
                    <Typography sx={{ ...subTextSx, fontSize: 10.2 }}>
                        each Project keeps a stable border and background tint.
                    </Typography>
                </>
            )}
            {scope === "PRODUCT" && (
                <>
                    <MatFlowIdentityBadge label="Project family" identity={projectA} accent={projectA.familyAccent} />
                    <MatFlowIdentityBadge label="Product 1" identity={productA} />
                    <MatFlowIdentityBadge label="Product 2" identity={productB} />
                    <Typography sx={{ ...subTextSx, fontSize: 10.2 }}>
                        Products stay in their parent Project colour family but use distinct shades.
                    </Typography>
                </>
            )}
            {scope === "MATERIAL" && (
                <>
                    {materials.map(({ label, identity }) => (
                        <MatFlowIdentityBadge key={label} label={label} identity={identity} />
                    ))}
                    <Typography sx={{ ...subTextSx, fontSize: 10.2 }}>
                        category families stay meaningful while each material gets a stable shade.
                    </Typography>
                </>
            )}
            <Typography sx={{ ...subTextSx, fontSize: 10.2, ml: "auto" }}>
                Workflow state still uses the existing status chip colours.
            </Typography>
        </Box>
    );
}

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

const productionOwnerText = (row) => {
    const user = row?.productionUser || row?.requestedBy || "Production";
    const plant = row?.productionPlantCode || row?.plantCode || "-";
    return `${user} · ${plant}`;
};

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
                plantCode: row.productionPlantCode,
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
            materialLines: groupMaterialLines,
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
                plantCode: row.productionPlantCode,
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
            materialLines: groupMaterialLines,
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
        const plantCode = clean(tracker?.productionPlantCode || requisition.productionPlantCode).toUpperCase();
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
                productionPlantCode: plantCode,
                currentStage: parentStage,
                currentDepartment: tracker?.currentDepartment || tracker?.responsibleDesk,
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

const BOARD_FILTER_OPTIONS = [
    { value: "ALL", label: "All Work" },
    { value: "ACTIVE", label: "Active Only" },
    { value: "RISK", label: "Timing Risk" },
    { value: "SHORTAGE", label: "Shortage" },
];

const BOARD_DENSITY_OPTIONS = [
    { value: "COMPACT", label: "Compact" },
    { value: "COMFORTABLE", label: "Comfortable" },
];

const boardPrioritySort = (a, b) => {
    const aComplete = normalize(a?.lane) === "COMPLETE";
    const bComplete = normalize(b?.lane) === "COMPLETE";
    if (aComplete && bComplete) return numeric(a?.maxAgeHours) - numeric(b?.maxAgeHours);
    const byRisk = numeric(b?.riskCount) - numeric(a?.riskCount);
    if (byRisk !== 0) return byRisk;
    const byShortage = numeric(b?.shortageQty) - numeric(a?.shortageQty);
    if (byShortage !== 0) return byShortage;
    return numeric(b?.maxAgeHours) - numeric(a?.maxAgeHours);
};

const boardFilterMatch = (item, filter) => {
    switch (normalize(filter)) {
        case "ACTIVE": return normalize(item?.lane) !== "COMPLETE";
        case "RISK": return numeric(item?.riskCount) > 0;
        case "SHORTAGE": return numeric(item?.shortageQty) > .0005;
        default: return true;
    }
};

const boardActionFor = (scope, item) => {
    if (!item) return null;
    if (scope === "PROJECT") {
        if (item.pendingProduct) {
            return productPreExecutionTarget({
                ...item.pendingProduct,
                projectDrawingId: item.pendingProduct.id,
            });
        }
        if (item.bottleneckLine) return materialLineActionTarget(item.bottleneckLine);
        if (item.bottleneck) return nextActionTarget(item.bottleneck);
        return null;
    }
    if (scope === "PRODUCT") {
        if (item.bottleneckLine) return materialLineActionTarget(item.bottleneckLine);
        if (item.bottleneck) return nextActionTarget(item.bottleneck);
        return productPreExecutionTarget(item);
    }
    return item.bottleneck ? materialLineActionTarget(item.bottleneck) : null;
};

function OperationsBoardDrawer({
    open,
    scope,
    item,
    onClose,
    navigate,
    roles,
    contextPlants,
}) {
    if (!item) return null;

    const identity = scope === "PROJECT"
        ? getMatFlowKanbanIdentity({ kind: "PROJECT", projectKey: item.key || projectKeyOf(item) })
        : scope === "PRODUCT"
            ? getMatFlowKanbanIdentity({
                kind: "PRODUCT",
                projectKey: projectKeyOf(item),
                productKey: item.key || productKeyOf(item),
            })
            : getMatFlowKanbanIdentity({
                kind: "MATERIAL",
                materialCategory: item.materialCategory,
                materialKey: item.key || item.materialId || item.materialCode || item.materialName,
            });

    const action = boardActionFor(scope, item);
    const canOpenAction = action && canAccessMatFlowScreenForContext(action.screen, roles, contextPlants);
    const bottleneck = item.bottleneck;
    const bottleneckLine = item.bottleneckLine || (scope === "MATERIAL" ? bottleneck : null);
    const materialLines = Array.isArray(item.materialLines)
        ? item.materialLines
        : Array.isArray(item.lines)
            ? item.lines
            : [];

    const title = scope === "PROJECT"
        ? `${item.projectCode || "-"} · ${item.projectName || "Project"}`
        : scope === "PRODUCT"
            ? item.productName || item.drawingNo || "Product"
            : item.materialName || item.materialCode || "Material";

    const subtitle = scope === "PROJECT"
        ? `${item.clientName || "-"} · ${item.plantCode || "-"}`
        : scope === "PRODUCT"
            ? `${item.projectCode || "-"} · ${item.drawingNo || "-"} · ${item.plantCode || "-"}`
            : `${item.materialCode || "-"} · ${readable(item.materialCategory || "OTHER")} · ${item.uom || "-"}`;

    const status = scope === "PROJECT"
        ? item.pendingProduct
            ? "PRODUCTION_MR_PENDING"
            : bottleneckLine?.lineStatus || bottleneck?.currentStage || item.portfolioStage || item.lane
        : scope === "PRODUCT"
            ? bottleneckLine?.lineStatus || bottleneck?.currentStage || item.latestBomStatus || item.portfolioStage || item.lane
            : bottleneck?.lineStatus || item.lane;

    const goPrimary = () => {
        if (canOpenAction) {
            navigate(action.path);
            onClose();
            return;
        }
        const mrId = bottleneckLine?.requisitionId || bottleneck?.requisitionId;
        if (mrId) navigate(`/matflow/tracker/${mrId}`);
        else navigate(scope === "MATERIAL" ? "/matflow/dashboard?view=materials" : "/matflow/projects");
        onClose();
    };

    const goTracker = () => {
        if (scope === "MATERIAL" && item.materialId) {
            navigate(`/matflow/dashboard?view=materials&materialId=${encodeURIComponent(item.materialId)}`);
        } else if (scope === "PRODUCT") {
            navigate(`/matflow/dashboard?view=projects&search=${encodeURIComponent(item.drawingNo || item.productName || "")}`);
        } else {
            navigate(`/matflow/dashboard?view=projects&search=${encodeURIComponent(item.projectCode || item.projectName || "")}`);
        }
        onClose();
    };

    return (
        <Drawer
            anchor="right"
            open={Boolean(open)}
            onClose={onClose}
            PaperProps={{
                sx: {
                    width: { xs: "100vw", sm: 470 },
                    maxWidth: "100vw",
                    color: "var(--mf-text)",
                    background: "var(--mf-panel-solid)",
                    borderLeft: "1px solid var(--mf-border)",
                    backgroundImage: "none",
                },
            }}
        >
            <Box sx={{ p: 1.5, display: "grid", gap: 1.15 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "flex-start" }}>
                    <Box sx={{ minWidth: 0 }}>
                        <Box sx={{ display: "flex", gap: .5, flexWrap: "wrap", mb: .65 }}>
                            <MatFlowIdentityBadge label={scope} identity={identity} />
                            {scope === "MATERIAL" && (
                                <MatFlowIdentityBadge
                                    label={identity.familyName || readable(item.materialCategory || "Other")}
                                    identity={identity}
                                    accent={identity.familyAccent}
                                />
                            )}
                        </Box>
                        <Typography sx={{ ...mainTextSx, fontSize: 17 }}>{title}</Typography>
                        <Typography sx={{ ...subTextSx, mt: .2 }}>{subtitle}</Typography>
                    </Box>
                    <Button onClick={onClose} sx={{ ...secondaryBtnSx, minWidth: 64, minHeight: 32 }}>Close</Button>
                </Box>

                <Box sx={{ display: "flex", gap: .6, alignItems: "center", flexWrap: "wrap" }}>
                    <MatFlowStatusChip status={status} />
                    {numeric(item.riskCount) > 0 && <TimingHealthChip health="BREACHED" />}
                </Box>

                <Divider sx={{ borderColor: "var(--mf-border)" }} />

                {scope === "PROJECT" && (
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: .7 }}>
                        <Detail label="Products" value={item.productCount} />
                        <Detail label="MRs" value={item.mrCount} />
                        <Detail label="Material Lines" value={item.materialLineCount} />
                        <Detail label="Material Ready" value={`${item.readyPercent}%`} />
                        <Detail label="Shortage" value={formatQty(item.shortageQty)} />
                        <Detail label="Timing Risks" value={item.riskCount || 0} />
                    </Box>
                )}

                {scope === "PRODUCT" && (
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: .7 }}>
                        <Detail label="MRs" value={item.mrCount} />
                        <Detail label="Material Lines" value={item.materialLineCount} />
                        <Detail label="Material Ready" value={`${item.readyPercent}%`} />
                        <Detail label="Requested" value={formatQty(item.requestedQty)} />
                        <Detail label="Issued" value={formatQty(item.issuedQty)} />
                        <Detail label="Shortage" value={formatQty(item.shortageQty)} />
                    </Box>
                )}

                {scope === "MATERIAL" && (
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: .7 }}>
                        <Detail label="Projects" value={item.projectCount} />
                        <Detail label="Products" value={item.productCount} />
                        <Detail label="MRs" value={item.mrCount} />
                        <Detail label="Demand Lines" value={item.lineCount} />
                        <Detail label="Requested" value={`${formatQty(item.requestedQty)} ${item.uom || ""}`} />
                        <Detail label="Reserved" value={`${formatQty(item.reservedQty)} ${item.uom || ""}`} />
                        <Detail label="Shortage" value={`${formatQty(item.shortageQty)} ${item.uom || ""}`} />
                        <Detail label="Issued" value={`${formatQty(item.issuedQty)} ${item.uom || ""}`} />
                        <Detail label="Consumed" value={`${formatQty(item.consumedQty)} ${item.uom || ""}`} />
                        <Detail label="Returned" value={`${formatQty(item.returnedQty)} ${item.uom || ""}`} />
                    </Box>
                )}

                <Card sx={{ ...panelSx, m: 0, p: 1, ...matFlowKanbanCardSx(identity) }}>
                    <Typography sx={{ ...mainTextSx, fontSize: 12 }}>Current bottleneck</Typography>
                    <Typography sx={{ ...subTextSx, mt: .35 }}>
                        {scope === "PROJECT" && item.pendingProduct
                            ? `Production MR pending for ${item.pendingProduct.productName || item.pendingProduct.drawingNo || "Product"}.`
                            : bottleneckLine
                                ? `${bottleneckLine.projectCode || item.projectCode || "-"} · ${bottleneckLine.productName || bottleneckLine.drawingNo || "Product"} · ${bottleneckLine.materialName || bottleneckLine.materialCode || "Material"} · ${readable(bottleneckLine.lineStatus || item.lane)}`
                                : bottleneck
                                    ? `${bottleneck.projectCode || item.projectCode || "-"} · ${bottleneck.productName || bottleneck.drawingNo || "Product"} · ${readable(bottleneck.currentStage || item.lane)}`
                                    : "No active execution bottleneck."}
                    </Typography>
                </Card>

                <Box sx={{ display: "flex", gap: .7, flexWrap: "wrap" }}>
                    {(action || bottleneck || item.pendingProduct) && (
                        <Button onClick={goPrimary} sx={primaryBtnSx}>
                            {canOpenAction ? action.label : "Open Bottleneck"}
                        </Button>
                    )}
                    <Button onClick={goTracker} sx={secondaryBtnSx}>
                        {scope === "MATERIAL" ? "Material Tracker" : scope === "PRODUCT" ? "Product Tracker" : "Project Tracker"}
                    </Button>
                </Box>

                {materialLines.length > 0 && (
                    <>
                        <Divider sx={{ borderColor: "var(--mf-border)" }} />
                        <Box>
                            <Typography sx={{ ...mainTextSx, fontSize: 12.5 }}>Material demand detail</Typography>
                            <Typography sx={{ ...subTextSx, mt: .15 }}>
                                Showing up to 20 demand lines. Use the Tracker for complete history and audit.
                            </Typography>
                        </Box>
                        <Box sx={{ display: "grid", gap: .65 }}>
                            {materialLines.slice(0, 20).map((line, index) => (
                                <Card key={line?.id || `${line?.requisitionId || "line"}:${index}`} sx={{ ...panelSx, m: 0, p: .85, boxShadow: "none" }}>
                                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: .7, alignItems: "flex-start" }}>
                                        <Box sx={{ minWidth: 0 }}>
                                            <Typography sx={{ ...mainTextSx, fontSize: 11.5 }}>
                                                {scope === "MATERIAL"
                                                    ? `${line.projectCode || "-"} · ${line.productName || line.drawingNo || "Product"}`
                                                    : `${line.materialName || line.materialCode || "Material"}`}
                                            </Typography>
                                            <Typography sx={{ ...subTextSx, mt: .15 }}>
                                                {line.requisitionNumber || "MR"} · Req {formatQty(line.requestedQty)} {line.uom || ""} · Reserved {formatQty(line.reservedQty)} · Short {formatQty(line.shortageQty)}
                                            </Typography>
                                        </Box>
                                        <MatFlowStatusChip status={line.lineStatus || line.currentStage || line.lane} />
                                    </Box>
                                </Card>
                            ))}
                        </Box>
                    </>
                )}
            </Box>
        </Drawer>
    );
}


const OVERVIEW_TONES = {
    primary: {
        text: "var(--mf-primary-text)",
        soft: "var(--mf-primary-soft)",
        border: "var(--mf-primary-border)",
    },
    success: {
        text: "var(--mf-success-text)",
        soft: "var(--mf-success-soft)",
        border: "var(--mf-success-border)",
    },
    warning: {
        text: "var(--mf-warning-text)",
        soft: "var(--mf-warning-soft)",
        border: "var(--mf-warning-border)",
    },
    danger: {
        text: "var(--mf-danger-text)",
        soft: "var(--mf-danger-soft)",
        border: "var(--mf-danger-border)",
    },
    purple: {
        text: "var(--mf-purple-text)",
        soft: "var(--mf-purple-soft)",
        border: "var(--mf-purple-border)",
    },
};

const percent = (value) => Math.max(0, Math.min(100, Math.round(numeric(value))));

function OverviewMetricCard({ label, value, subtitle, icon: Icon, tone = "primary", progress = null, onClick = null }) {
    const palette = OVERVIEW_TONES[tone] || OVERVIEW_TONES.primary;
    return (
        <Card
            onClick={onClick || undefined}
            sx={{
                ...panelSx,
                m: 0,
                p: 1.25,
                minHeight: 112,
                display: "grid",
                gap: .75,
                cursor: onClick ? "pointer" : "default",
                position: "relative",
                overflow: "hidden",
                transition: "transform .18s ease,border-color .18s ease,box-shadow .18s ease",
                "&:hover": onClick ? {
                    transform: "translateY(-2px)",
                    borderColor: palette.border,
                    boxShadow: "var(--mf-card-shadow)",
                } : undefined,
                "&::after": {
                    content: '""',
                    position: "absolute",
                    width: 84,
                    height: 84,
                    borderRadius: "50%",
                    right: -28,
                    top: -28,
                    background: palette.soft,
                    pointerEvents: "none",
                },
            }}
        >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: .8, position: "relative", zIndex: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ ...subTextSx, fontSize: 10.5, fontWeight: 900, textTransform: "uppercase", letterSpacing: .45 }}>{label}</Typography>
                    <Typography sx={{ ...mainTextSx, fontSize: { xs: 22, md: 26 }, lineHeight: 1.05, mt: .35 }}>{value}</Typography>
                </Box>
                {Icon && (
                    <Box sx={{ width: 34, height: 34, borderRadius: 2, display: "grid", placeItems: "center", background: palette.soft, color: palette.text, border: `1px solid ${palette.border}`, flexShrink: 0 }}>
                        <Icon sx={{ fontSize: 18 }} />
                    </Box>
                )}
            </Box>
            <Typography sx={{ ...subTextSx, fontSize: 10.5, position: "relative", zIndex: 1 }}>{subtitle}</Typography>
            {progress !== null && progress !== undefined && (
                <LinearProgress
                    variant="determinate"
                    value={percent(progress)}
                    sx={{
                        height: 5,
                        borderRadius: 99,
                        backgroundColor: "var(--mf-surface-strong)",
                        position: "relative",
                        zIndex: 1,
                        "& .MuiLinearProgress-bar": { backgroundColor: palette.text, borderRadius: 99 },
                    }}
                />
            )}
        </Card>
    );
}

function OverviewDonut({ value, label, caption, tone = "primary", size = 152 }) {
    const palette = OVERVIEW_TONES[tone] || OVERVIEW_TONES.primary;
    const safeValue = percent(value);
    return (
        <Box sx={{ display: "grid", placeItems: "center", gap: .9 }}>
            <Box
                sx={{
                    width: size,
                    height: size,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    background: `conic-gradient(${palette.text} 0deg ${safeValue * 3.6}deg, var(--mf-surface-strong) ${safeValue * 3.6}deg 360deg)`,
                    boxShadow: `0 0 0 1px ${palette.border}, inset 0 0 0 1px var(--mf-border)`,
                    position: "relative",
                    "&::after": {
                        content: '""',
                        position: "absolute",
                        inset: 14,
                        borderRadius: "50%",
                        background: "var(--mf-card-bg)",
                        border: "1px solid var(--mf-border)",
                    },
                }}
            >
                <Box sx={{ position: "relative", zIndex: 1, textAlign: "center" }}>
                    <Typography sx={{ ...mainTextSx, fontSize: 28, lineHeight: 1 }}>{safeValue}%</Typography>
                    <Typography sx={{ ...subTextSx, fontSize: 9.5, mt: .3 }}>{label}</Typography>
                </Box>
            </Box>
            <Typography sx={{ ...subTextSx, fontSize: 10.5, textAlign: "center", maxWidth: 220 }}>{caption}</Typography>
        </Box>
    );
}

function OverviewBarList({ rows, maxValue = null, valueLabel = (value) => value, emptyText = "No data to chart." }) {
    const calculatedMax = Math.max(1, maxValue || 0, ...rows.map((row) => numeric(row.value)));
    if (!rows.length) return <EmptyState>{emptyText}</EmptyState>;
    return (
        <Box sx={{ display: "grid", gap: .9 }}>
            {rows.map((row) => {
                const palette = OVERVIEW_TONES[row.tone] || OVERVIEW_TONES.primary;
                const width = Math.max(row.value > 0 ? 4 : 0, Math.min(100, (numeric(row.value) / calculatedMax) * 100));
                return (
                    <Box key={row.key || row.label} sx={{ display: "grid", gap: .35 }}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: .8 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: .55, minWidth: 0 }}>
                                <Box sx={{ width: 7, height: 7, borderRadius: "50%", background: palette.text, flexShrink: 0 }} />
                                <Typography sx={{ ...mainTextSx, fontSize: 11.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.label}</Typography>
                            </Box>
                            <Typography sx={{ ...mainTextSx, fontSize: 11.2, color: palette.text, flexShrink: 0 }}>{valueLabel(row.value)}</Typography>
                        </Box>
                        <Box sx={{ height: 8, borderRadius: 99, background: "var(--mf-surface-strong)", overflow: "hidden", border: "1px solid var(--mf-border)" }}>
                            <Box sx={{ width: `${width}%`, height: "100%", borderRadius: 99, background: palette.text, transition: "width .25s ease" }} />
                        </Box>
                        {row.subtitle && <Typography sx={{ ...subTextSx, fontSize: 9.6 }}>{row.subtitle}</Typography>}
                    </Box>
                );
            })}
        </Box>
    );
}

function OverviewPlantComparison({ rows }) {
    const metrics = [
        ["openRequisitions", "Open MRs", "primary"],
        ["shortageRequisitions", "Shortage", "danger"],
        ["pendingQcInspections", "QC", "warning"],
        ["activeProcessingJobs", "Processing", "purple"],
    ];
    if (!rows.length) return <EmptyState>No plant dashboard rows available.</EmptyState>;
    const maximum = Math.max(1, ...rows.flatMap((row) => metrics.map(([key]) => numeric(row?.[key]))));
    return (
        <Box sx={{ display: "grid", gap: 1 }}>
            <Box sx={{ display: "flex", gap: 1.2, flexWrap: "wrap" }}>
                {metrics.map(([, label, tone]) => {
                    const palette = OVERVIEW_TONES[tone];
                    return <Box key={label} sx={{ display: "flex", gap: .45, alignItems: "center" }}><Box sx={{ width: 7, height: 7, borderRadius: "50%", background: palette.text }} /><Typography sx={{ ...subTextSx, fontSize: 9.8 }}>{label}</Typography></Box>;
                })}
            </Box>
            {rows.map((row) => (
                <Box key={row.plantCode || row.plant || row.code} sx={{ p: .85, border: "1px solid var(--mf-border)", borderRadius: 2, background: "var(--mf-surface)" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: .8, mb: .65 }}>
                        <Typography sx={{ ...mainTextSx, fontSize: 11.5 }}>{row.plantCode || row.plant || row.code || "Plant"}</Typography>
                        <Typography sx={{ ...subTextSx, fontSize: 9.8 }}>{numeric(row.activeProjects)} active projects · {numeric(row.openRequisitions)} open MRs</Typography>
                    </Box>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: .45, alignItems: "end", minHeight: 66 }}>
                        {metrics.map(([key, label, tone]) => {
                            const palette = OVERVIEW_TONES[tone];
                            const value = numeric(row?.[key]);
                            const height = Math.max(value > 0 ? 7 : 2, (value / maximum) * 46);
                            return (
                                <Box key={key} sx={{ display: "grid", justifyItems: "center", gap: .25 }} title={`${label}: ${value}`}>
                                    <Typography sx={{ ...subTextSx, fontSize: 8.7 }}>{value}</Typography>
                                    <Box sx={{ width: "72%", maxWidth: 42, height: 48, display: "flex", alignItems: "flex-end", borderRadius: "5px 5px 2px 2px", overflow: "hidden", background: "var(--mf-surface-strong)" }}>
                                        <Box sx={{ width: "100%", height, background: palette.text, borderRadius: "5px 5px 2px 2px", opacity: .88 }} />
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
            ))}
        </Box>
    );
}

function OverviewAttentionList({ rows, navigate, roles, contextPlants }) {
    if (!rows.length) return <EmptyState>No active exceptions or aged material flows need attention.</EmptyState>;
    return (
        <Box sx={{ display: "grid", gap: .7 }}>
            {rows.map((row, index) => {
                const target = nextActionTarget(row);
                const canOpenTarget = canAccessMatFlowScreenForContext(target.screen, roles, contextPlants);
                const breached = ["BREACHED", "COMPLETED_LATE"].includes(normalize(row.timingHealth));
                const watch = normalize(row.timingHealth) === "WATCH";
                const tone = breached ? OVERVIEW_TONES.danger : watch ? OVERVIEW_TONES.warning : numeric(row.shortageQty) > .0005 ? OVERVIEW_TONES.warning : OVERVIEW_TONES.primary;
                return (
                    <Card
                        key={row.requisitionId || `${row.requisitionNumber}:${index}`}
                        sx={{ ...panelSx, m: 0, p: .9, boxShadow: "none", borderLeft: `3px solid ${tone.text}` }}
                    >
                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: .8, alignItems: "flex-start" }}>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ ...mainTextSx, fontSize: 11.7 }}>{row.projectCode || "-"} · {row.productName || "Product"}</Typography>
                                <Typography sx={{ ...subTextSx, mt: .12 }}>{row.requisitionNumber || "MR"} · {readable(row.currentStage)} · {row.currentDepartment || row.currentStage || row.productionPlantCode || "-"}</Typography>
                            </Box>
                            <Box sx={{ display: "flex", gap: .35, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                <TimingHealthChip health={row.timingHealth} />
                                {numeric(row.shortageQty) > .0005 && <MatFlowStatusChip status="SHORTAGE_PENDING" />}
                            </Box>
                        </Box>
                        <Box sx={{ mt: .65, display: "grid", gridTemplateColumns: "1fr auto", gap: .7, alignItems: "center" }}>
                            <Box>
                                <Box sx={{ display: "flex", justifyContent: "space-between", gap: .6, mb: .3 }}>
                                    <Typography sx={{ ...subTextSx, fontSize: 9.7 }}>Material ready</Typography>
                                    <Typography sx={{ ...mainTextSx, fontSize: 9.7 }}>{percent(row.materialReadyPercent)}%</Typography>
                                </Box>
                                <LinearProgress variant="determinate" value={percent(row.materialReadyPercent)} sx={{ height: 4, borderRadius: 99, background: "var(--mf-surface-strong)", "& .MuiLinearProgress-bar": { borderRadius: 99 } }} />
                            </Box>
                            <Button
                                endIcon={<ChevronRightRoundedIcon sx={{ fontSize: 16 }} />}
                                onClick={() => navigate(canOpenTarget ? target.path : `/matflow/tracker/${row.requisitionId}`)}
                                sx={{ ...secondaryBtnSx, minHeight: 30, px: .8, fontSize: 9.8 }}
                            >
                                {canOpenTarget ? target.label : "Trace"}
                            </Button>
                        </Box>
                    </Card>
                );
            })}
        </Box>
    );
}

function UniversalDashboardHeader({ view, onViewChange, onRefresh = null, refreshing = false }) {
    return (
        <>
            <PageHero
                badge="MATFLOW UNIVERSAL DASHBOARD"
                title="Material Operations Command Center"
                subtitle="One plant-aware dashboard for overall operations, Project/Product material execution and material-specific workflow tracking. Store routing comes from the MR plant, Processing uses approved Processing Units, and final issue stays tied to the exact Production requester."
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
    const rawRequestedView = normalize(searchParams.get("view") || "operations").toLowerCase();
    // Backward compatibility for v7-v9 dashboard bookmarks that used ?view=kanban.
    const requestedView = rawRequestedView === "kanban" ? "operations" : rawRequestedView;
    const view = ["operations", "overview", "projects", "materials"].includes(requestedView) ? requestedView : "operations";
    const materialId = clean(searchParams.get("materialId"));
    const requestedKanbanScope = normalize(searchParams.get("boardScope") || searchParams.get("kanbanScope") || "PROJECT");
    const kanbanScope = ["PROJECT", "PRODUCT", "MATERIAL"].includes(requestedKanbanScope)
        ? requestedKanbanScope
        : "PROJECT";

    const changeView = useCallback((nextView) => {
        const next = new URLSearchParams(searchParams);
        next.set("view", nextView);
        if (nextView !== "materials") next.delete("materialId");
        if (nextView !== "operations") {
            next.delete("boardScope");
            next.delete("kanbanScope");
        }
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    const changeKanbanScope = useCallback((scope) => {
        const next = new URLSearchParams(searchParams);
        next.set("view", "operations");
        next.set("boardScope", normalize(scope) || "PROJECT");
        next.delete("kanbanScope");
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    const [data, setData] = useState(null);
    const [tracker, setTracker] = useState(null);
    const [requisitions, setRequisitions] = useState([]);
    const [projects, setProjects] = useState([]);
    const [kanbanSearch, setKanbanSearch] = useState("");
    const [boardFilter, setBoardFilter] = useState("ALL");
    const [boardDensity, setBoardDensity] = useState("COMPACT");
    const [selectedBoardItem, setSelectedBoardItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        if (!["overview", "operations"].includes(view)) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError("");
        try {
            const [dashboardResponse, trackerResponse, requisitionResponse, projectResponse] = await Promise.all([
                matflowApi.dashboardReport({ plantCode: selectedPlantParam }),
                matflowApi.getTracker({ plantCode: selectedPlantParam }),
                view === "operations"
                    ? matflowApi.listRequisitions()
                    : Promise.resolve({ data: [] }),
                view === "operations"
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

    if (view === "operations") {
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
            .sort(boardPrioritySort);

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
            .sort(boardPrioritySort);

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
            ].some((value) => clean(value).toLowerCase().includes(term)))
            .sort(boardPrioritySort);

        const scopedItems = kanbanScope === "PROJECT"
            ? projectItems
            : kanbanScope === "PRODUCT"
                ? productItems
                : materialItems;

        const activeItems = scopedItems
            .filter((item) => boardFilterMatch(item, boardFilter))
            .sort(boardPrioritySort);

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

                <Card sx={{ ...panelSx, display: "grid", gap: 1.05 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                        <Box sx={{ minWidth: 0, flex: "1 1 420px" }}>
                            <Typography sx={{ fontWeight: 950, fontSize: 17 }}>Material Operations Board</Typography>
                            <Typography sx={subTextSx}>
                                Scalable Project, Product and Material workflow control. The board stays within the working viewport, each stage scrolls independently, completed work is intentionally limited to recent records, and large lanes progressively reveal more cards without flooding the page.
                            </Typography>
                        </Box>
                        <MatFlowViewToggle
                            value={kanbanScope}
                            onChange={(scope) => {
                                setSelectedBoardItem(null);
                                changeKanbanScope(scope);
                            }}
                            options={KANBAN_SCOPE_OPTIONS}
                        />
                    </Box>

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "minmax(280px,1fr) auto auto" }, gap: .8, alignItems: "center" }}>
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
                        <MatFlowViewToggle
                            value={boardFilter}
                            onChange={setBoardFilter}
                            options={BOARD_FILTER_OPTIONS}
                        />
                        <MatFlowViewToggle
                            value={boardDensity}
                            onChange={setBoardDensity}
                            options={BOARD_DENSITY_OPTIONS}
                        />
                    </Box>

                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                        <KanbanIdentityLegend scope={kanbanScope} />
                        <Typography sx={{ ...subTextSx, fontSize: 10.2 }}>
                            Priority order: timing risk → shortage → longest waiting. Compact is the recommended daily operating density.
                        </Typography>
                    </Box>
                </Card>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", md: "repeat(4,minmax(0,1fr))" }, gap: 1 }}>
                    {kanbanKpis.map(([label, value]) => (
                        <SummaryCard key={label} label={label} value={value} />
                    ))}
                </Box>

                {loading ? <LoadingBlock /> : (
                    <MatFlowKanbanBoard
                        columns={FLOW_KANBAN_COLUMNS}
                        items={activeItems}
                        laneFor={(item) => item.lane}
                        minColumnWidth={boardDensity === "COMPACT" ? 285 : 315}
                        boardHeight={{ xs: 620, md: "clamp(540px, calc(100vh - 300px), 780px)" }}
                        initialItemsPerLane={boardDensity === "COMPACT" ? 24 : 12}
                        loadMoreStep={boardDensity === "COMPACT" ? 24 : 12}
                        completedLaneKeys={["COMPLETE"]}
                        completedLaneLimit={12}
                        boardKey={`${kanbanScope}|${boardFilter}|${term}|${selectedPlantParam || "ALL"}`}
                        laneSummary={(laneItems) => {
                            const risk = laneItems.filter((entry) => numeric(entry.riskCount) > 0).length;
                            const shortage = laneItems.filter((entry) => numeric(entry.shortageQty) > .0005).length;
                            const parts = [];
                            if (risk) parts.push(`${risk} risk`);
                            if (shortage) parts.push(`${shortage} shortage`);
                            return parts.length ? parts.join(" · ") : "No current risk flags";
                        }}
                        emptyText={`No ${kanbanScope.toLowerCase()} items in this stage.`}
                        renderCard={(item) => {
                            const compact = boardDensity === "COMPACT";

                            if (kanbanScope === "PROJECT") {
                                const bottleneck = item.bottleneck;
                                const bottleneckLine = item.bottleneckLine;
                                const target = boardActionFor("PROJECT", item);
                                const canOpenTarget = target && canAccessMatFlowScreenForContext(target.screen, roles, contextPlants);
                                const identity = getMatFlowKanbanIdentity({
                                    kind: "PROJECT",
                                    projectKey: item.key || projectKeyOf(item),
                                });
                                const primaryPath = canOpenTarget
                                    ? target.path
                                    : bottleneckLine?.requisitionId
                                        ? `/matflow/tracker/${bottleneckLine.requisitionId}`
                                        : bottleneck?.requisitionId
                                            ? `/matflow/tracker/${bottleneck.requisitionId}`
                                            : "/matflow/projects";
                                return (
                                    <Card sx={{ ...panelSx, m: 0, p: compact ? .85 : 1.15, ...matFlowKanbanCardSx(identity) }}>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: .65, alignItems: "flex-start" }}>
                                            <Box sx={{ minWidth: 0 }}>
                                                <Box sx={{ display: "flex", gap: .4, alignItems: "center", flexWrap: "wrap", mb: .4 }}>
                                                    <MatFlowIdentityBadge label="Project" identity={identity} />
                                                    {!compact && item.projectCode && <MatFlowIdentityBadge label={item.projectCode} identity={identity} />}
                                                </Box>
                                                <Typography sx={{ ...mainTextSx, fontSize: compact ? 12.2 : 13, lineHeight: 1.25 }}>
                                                    {item.projectCode || "-"} · {item.projectName || "Project"}
                                                </Typography>
                                                <Typography sx={{ ...subTextSx, mt: .12 }}>{item.clientName || "-"} · {item.plantCode || "-"}</Typography>
                                            </Box>
                                            <MatFlowStatusChip status={item.pendingProduct ? "PRODUCTION_MR_PENDING" : bottleneckLine?.lineStatus || bottleneck?.currentStage || item.portfolioStage || item.lane} />
                                        </Box>

                                        {compact ? (
                                            <>
                                                <Typography sx={{ ...subTextSx, mt: .55 }}>
                                                    {item.productCount} Products · {item.mrCount} MRs · {item.materialLineCount} Materials
                                                </Typography>
                                                <Typography sx={{ ...mainTextSx, mt: .35, fontSize: 11.2 }}>
                                                    Ready {item.readyPercent}% · Shortage {formatQty(item.shortageQty)}{item.riskCount ? ` · ${item.riskCount} risk` : ""}
                                                </Typography>
                                            </>
                                        ) : (
                                            <Box sx={{ mt: .9, display: "grid", gridTemplateColumns: "1fr 1fr", gap: .55 }}>
                                                <Detail label="Products" value={item.productCount} />
                                                <Detail label="MRs" value={item.mrCount} />
                                                <Detail label="Material Lines" value={item.materialLineCount} />
                                                <Detail label="Material Ready" value={`${item.readyPercent}%`} />
                                                <Detail label="Shortage" value={formatQty(item.shortageQty)} />
                                            </Box>
                                        )}

                                        <Typography
                                            sx={{
                                                ...subTextSx,
                                                mt: compact ? .45 : .75,
                                                ...(compact ? { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } : {}),
                                            }}
                                        >
                                            {item.pendingProduct
                                                ? `Next: ${item.pendingProduct.productName || item.pendingProduct.drawingNo || "Product"} · Production MR`
                                                : `Bottleneck: ${readable(bottleneckLine?.lineStatus || bottleneck?.currentStage || item.lane)}`}
                                        </Typography>

                                        <Box sx={{ display: "flex", gap: .5, mt: compact ? .65 : .9, flexWrap: "wrap" }}>
                                            <Button
                                                onClick={() => navigate(primaryPath)}
                                                sx={{ ...primaryBtnSx, minHeight: compact ? 30 : undefined, px: compact ? .9 : undefined, fontSize: compact ? 10 : undefined }}
                                            >
                                                {canOpenTarget ? target.label : item.pendingProduct ? "Open Product" : "Open Bottleneck"}
                                            </Button>
                                            <Button
                                                onClick={() => setSelectedBoardItem({ scope: "PROJECT", item })}
                                                sx={{ ...secondaryBtnSx, minHeight: compact ? 30 : undefined, px: compact ? .9 : undefined, fontSize: compact ? 10 : undefined }}
                                            >
                                                Details
                                            </Button>
                                            {!compact && (
                                                <Button
                                                    onClick={() => navigate(item.mrCount > 0
                                                        ? `/matflow/dashboard?view=projects&search=${encodeURIComponent(item.projectCode || item.projectName || "")}`
                                                        : "/matflow/boms")}
                                                    sx={secondaryBtnSx}
                                                >
                                                    {item.mrCount > 0 ? "Project Tracker" : "Operational BOMs"}
                                                </Button>
                                            )}
                                        </Box>
                                    </Card>
                                );
                            }

                            if (kanbanScope === "PRODUCT") {
                                const bottleneck = item.bottleneck;
                                const bottleneckLine = item.bottleneckLine;
                                const target = boardActionFor("PRODUCT", item);
                                const canOpenTarget = target && canAccessMatFlowScreenForContext(target.screen, roles, contextPlants);
                                const projectIdentity = getMatFlowKanbanIdentity({ kind: "PROJECT", projectKey: projectKeyOf(item) });
                                const identity = getMatFlowKanbanIdentity({
                                    kind: "PRODUCT",
                                    projectKey: projectKeyOf(item),
                                    productKey: item.key || productKeyOf(item),
                                });
                                const primaryPath = canOpenTarget
                                    ? target.path
                                    : bottleneckLine?.requisitionId
                                        ? `/matflow/tracker/${bottleneckLine.requisitionId}`
                                        : bottleneck?.requisitionId
                                            ? `/matflow/tracker/${bottleneck.requisitionId}`
                                            : "/matflow/projects";
                                return (
                                    <Card sx={{ ...panelSx, m: 0, p: compact ? .85 : 1.15, ...matFlowKanbanCardSx(identity) }}>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: .65, alignItems: "flex-start" }}>
                                            <Box sx={{ minWidth: 0 }}>
                                                <Box sx={{ display: "flex", gap: .4, alignItems: "center", flexWrap: "wrap", mb: .4 }}>
                                                    <MatFlowIdentityBadge label="Product" identity={identity} />
                                                    {!compact && (
                                                        <MatFlowIdentityBadge
                                                            label={`Project ${item.projectCode || "Family"}`}
                                                            identity={projectIdentity}
                                                            accent={projectIdentity.familyAccent}
                                                        />
                                                    )}
                                                </Box>
                                                <Typography sx={{ ...mainTextSx, fontSize: compact ? 12.2 : 13, lineHeight: 1.25 }}>{item.productName || "Product"}</Typography>
                                                <Typography sx={{ ...subTextSx, mt: .12 }}>{item.projectCode || "-"} · {item.drawingNo || "-"} · {item.plantCode || "-"}</Typography>
                                            </Box>
                                            <MatFlowStatusChip status={bottleneckLine?.lineStatus || bottleneck?.currentStage || item.latestBomStatus || item.portfolioStage || item.lane} />
                                        </Box>

                                        {compact ? (
                                            <>
                                                <Typography sx={{ ...subTextSx, mt: .55 }}>
                                                    {item.materialLineCount} Materials · {item.mrCount} MRs · Ready {item.readyPercent}%
                                                </Typography>
                                                <Typography sx={{ ...mainTextSx, mt: .35, fontSize: 11.2 }}>
                                                    Requested {formatQty(item.requestedQty)} · Shortage {formatQty(item.shortageQty)}{item.riskCount ? ` · ${item.riskCount} risk` : ""}
                                                </Typography>
                                            </>
                                        ) : (
                                            <Box sx={{ mt: .9, display: "grid", gridTemplateColumns: "1fr 1fr", gap: .55 }}>
                                                <Detail label="MRs" value={item.mrCount} />
                                                <Detail label="Material Lines" value={item.materialLineCount} />
                                                <Detail label="Ready" value={`${item.readyPercent}%`} />
                                                <Detail label="Requested" value={formatQty(item.requestedQty)} />
                                                <Detail label="Shortage" value={formatQty(item.shortageQty)} />
                                            </Box>
                                        )}

                                        <Typography
                                            sx={{
                                                ...subTextSx,
                                                mt: compact ? .45 : .75,
                                                ...(compact ? { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } : {}),
                                            }}
                                        >
                                            {bottleneckLine
                                                ? `Material: ${bottleneckLine.materialName || bottleneckLine.materialCode || "Material"} · ${readable(bottleneckLine.lineStatus || item.lane)}`
                                                : bottleneck
                                                    ? `Bottleneck: ${readable(bottleneck.currentStage || item.lane)}`
                                                    : item.bomEffective
                                                        ? "Effective BOM ready · MR not yet raised"
                                                        : item.latestBomId
                                                            ? `BOM ${readable(item.latestBomStatus || "IN REVIEW")}`
                                                            : "Engineering BOM not created"}
                                        </Typography>

                                        <Box sx={{ display: "flex", gap: .5, mt: compact ? .65 : .9, flexWrap: "wrap" }}>
                                            <Button
                                                onClick={() => navigate(primaryPath)}
                                                sx={{ ...primaryBtnSx, minHeight: compact ? 30 : undefined, px: compact ? .9 : undefined, fontSize: compact ? 10 : undefined }}
                                            >
                                                {canOpenTarget ? target.label : bottleneck ? "Open Bottleneck" : "Open Product"}
                                            </Button>
                                            <Button
                                                onClick={() => setSelectedBoardItem({ scope: "PRODUCT", item })}
                                                sx={{ ...secondaryBtnSx, minHeight: compact ? 30 : undefined, px: compact ? .9 : undefined, fontSize: compact ? 10 : undefined }}
                                            >
                                                Details
                                            </Button>
                                            {!compact && (
                                                <Button
                                                    onClick={() => navigate(item.mrCount > 0
                                                        ? `/matflow/dashboard?view=projects&search=${encodeURIComponent(item.drawingNo || item.productName || "")}`
                                                        : item.latestBomId
                                                            ? `/matflow/boms/${item.latestBomId}`
                                                            : `/matflow/boms/new?productId=${encodeURIComponent(item.projectDrawingId || "")}`)}
                                                    sx={secondaryBtnSx}
                                                >
                                                    {item.mrCount > 0 ? "Product Tracker" : item.latestBomId ? "BOM" : "Create BOM"}
                                                </Button>
                                            )}
                                        </Box>
                                    </Card>
                                );
                            }

                            const bottleneck = item.bottleneck;
                            const target = boardActionFor("MATERIAL", item);
                            const canOpenTarget = target && canAccessMatFlowScreenForContext(target.screen, roles, contextPlants);
                            const identity = getMatFlowKanbanIdentity({
                                kind: "MATERIAL",
                                materialCategory: item.materialCategory,
                                materialKey: item.key || item.materialId || item.materialCode || item.materialName,
                            });
                            return (
                                <Card sx={{ ...panelSx, m: 0, p: compact ? .85 : 1.15, ...matFlowKanbanCardSx(identity) }}>
                                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: .65, alignItems: "flex-start" }}>
                                        <Box sx={{ minWidth: 0 }}>
                                            <Box sx={{ display: "flex", gap: .4, alignItems: "center", flexWrap: "wrap", mb: .4 }}>
                                                <MatFlowIdentityBadge label="Material" identity={identity} />
                                                {!compact && <MatFlowIdentityBadge label={identity.familyName || readable(item.materialCategory || "Other")} identity={identity} accent={identity.familyAccent} />}
                                            </Box>
                                            <Typography sx={{ ...mainTextSx, fontSize: compact ? 12.2 : 13, lineHeight: 1.25 }}>{item.materialName || "Material"}</Typography>
                                            <Typography sx={{ ...subTextSx, mt: .12 }}>{item.materialCode || "-"} · {readable(item.materialCategory || "OTHER")} · {item.uom || "-"}</Typography>
                                        </Box>
                                        <MatFlowStatusChip status={bottleneck?.lineStatus || item.lane} />
                                    </Box>

                                    <Typography sx={{ ...subTextSx, mt: .55 }}>
                                        {item.projectCount} Project{item.projectCount === 1 ? "" : "s"} · {item.productCount} Product{item.productCount === 1 ? "" : "s"} · {item.mrCount} MR{item.mrCount === 1 ? "" : "s"}
                                    </Typography>

                                    {compact ? (
                                        <Typography sx={{ ...mainTextSx, mt: .35, fontSize: 11.2 }}>
                                            {formatQty(item.requestedQty)} {item.uom || ""} requested · {formatQty(item.shortageQty)} short{item.riskCount ? ` · ${item.riskCount} risk` : ""}
                                        </Typography>
                                    ) : (
                                        <Box sx={{ mt: .9, display: "grid", gridTemplateColumns: "1fr 1fr", gap: .55 }}>
                                            <Detail label="Demand Lines" value={item.lineCount} />
                                            <Detail label="Requested" value={`${formatQty(item.requestedQty)} ${item.uom || ""}`} />
                                            <Detail label="Reserved" value={`${formatQty(item.reservedQty)} ${item.uom || ""}`} />
                                            <Detail label="Shortage" value={`${formatQty(item.shortageQty)} ${item.uom || ""}`} />
                                            <Detail label="Issued" value={`${formatQty(item.issuedQty)} ${item.uom || ""}`} />
                                            <Detail label="Consumed" value={`${formatQty(item.consumedQty)} ${item.uom || ""}`} />
                                        </Box>
                                    )}

                                    <Typography
                                        sx={{
                                            ...subTextSx,
                                            mt: compact ? .45 : .75,
                                            ...(compact ? { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } : {}),
                                        }}
                                    >
                                        {bottleneck
                                            ? `Bottleneck: ${bottleneck.projectCode || "-"} · ${bottleneck.productName || bottleneck.drawingNo || "Product"} · ${readable(bottleneck.lineStatus || bottleneck.currentStage)}`
                                            : "No active material demand"}
                                    </Typography>

                                    <Box sx={{ display: "flex", gap: .5, mt: compact ? .65 : .9, flexWrap: "wrap" }}>
                                        {bottleneck && (
                                            <Button
                                                onClick={() => navigate(canOpenTarget ? target.path : `/matflow/tracker/${bottleneck.requisitionId}`)}
                                                sx={{ ...primaryBtnSx, minHeight: compact ? 30 : undefined, px: compact ? .9 : undefined, fontSize: compact ? 10 : undefined }}
                                            >
                                                {canOpenTarget ? target.label : "Open Bottleneck"}
                                            </Button>
                                        )}
                                        <Button
                                            onClick={() => setSelectedBoardItem({ scope: "MATERIAL", item })}
                                            sx={{ ...secondaryBtnSx, minHeight: compact ? 30 : undefined, px: compact ? .9 : undefined, fontSize: compact ? 10 : undefined }}
                                        >
                                            Details
                                        </Button>
                                        {!compact && item.materialId && (
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

                <OperationsBoardDrawer
                    open={Boolean(selectedBoardItem)}
                    scope={selectedBoardItem?.scope || kanbanScope}
                    item={selectedBoardItem?.item || null}
                    onClose={() => setSelectedBoardItem(null)}
                    navigate={navigate}
                    roles={roles}
                    contextPlants={contextPlants}
                />
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
    const trackerRows = Array.isArray(tracker?.rows) ? tracker.rows : [];
    const plantRows = Array.isArray(data?.rows) ? data.rows : [];
    const activeRows = trackerRows.filter((row) => !["CANCELLED", "PRODUCTION_COMPLETED"].includes(normalize(row.currentStage)));

    const avgMaterialReady = activeRows.length
        ? activeRows.reduce((sum, row) => sum + percent(row.materialReadyPercent), 0) / activeRows.length
        : 0;
    const shortageRows = activeRows.filter((row) => numeric(row.shortageQty) > .0005);
    const shortageQty = shortageRows.reduce((sum, row) => sum + numeric(row.shortageQty), 0);
    const breachedRows = activeRows.filter((row) => ["BREACHED", "COMPLETED_LATE"].includes(normalize(row.timingHealth)));
    const watchRows = activeRows.filter((row) => normalize(row.timingHealth) === "WATCH");
    const onTrackRows = activeRows.filter((row) => normalize(row.timingHealth) === "ON_TRACK");
    const notStartedRows = activeRows.filter((row) => ["NOT_STARTED", ""].includes(normalize(row.timingHealth)));

    const workflowLoad = FLOW.map(([key, label], index) => {
        const count = activeRows.filter((row) => stageBucket(row.currentStage) === key).length;
        const tone = key === "COMPLETE" ? "success"
            : key === "PURCHASE" ? "danger"
                : key === "QC" ? "warning"
                    : key === "PROCESSING" ? "purple"
                        : index <= 1 ? "primary" : "success";
        return { key, label, value: count, tone };
    });

    const timingHealthRows = [
        { key: "BREACHED", label: "Breached", value: breachedRows.length, tone: "danger", subtitle: "Already above the workflow timing target" },
        { key: "WATCH", label: "Watch", value: watchRows.length, tone: "warning", subtitle: "At or above 75% of the stage timing target" },
        { key: "ON_TRACK", label: "On track", value: onTrackRows.length, tone: "success", subtitle: "Inside the current stage timing target" },
        { key: "NOT_STARTED", label: "Not started", value: notStartedRows.length, tone: "primary", subtitle: "No stage timing clock started yet" },
    ];

    const attentionRows = [...activeRows]
        .filter((row) => ["BREACHED", "WATCH"].includes(normalize(row.timingHealth)) || numeric(row.shortageQty) > .0005 || numeric(row.ageHours) >= 24)
        .sort((a, b) => {
            const breachScore = (row) => ["BREACHED", "COMPLETED_LATE"].includes(normalize(row.timingHealth)) ? 4 : normalize(row.timingHealth) === "WATCH" ? 2 : 0;
            const shortageScore = (row) => numeric(row.shortageQty) > .0005 ? 2 : 0;
            return (breachScore(b) + shortageScore(b)) - (breachScore(a) + shortageScore(a)) || numeric(b.ageHours) - numeric(a.ageHours);
        })
        .slice(0, 6);

    const liveRows = [...activeRows]
        .sort((a, b) => numeric(b.ageHours) - numeric(a.ageHours))
        .slice(0, 8);

    const overviewCards = [
        {
            label: "Active Projects",
            value: totals.activeProjects ?? 0,
            subtitle: `${totals.effectiveBoms ?? 0} effective BOMs in current scope`,
            icon: FolderOpenRoundedIcon,
            tone: "primary",
            onClick: () => changeView("projects"),
        },
        {
            label: "Open Material Requests",
            value: kpis.activeRequisitions ?? totals.openRequisitions ?? 0,
            subtitle: `${shortageRows.length} currently carry a shortage`,
            icon: AssignmentOutlinedIcon,
            tone: shortageRows.length ? "warning" : "primary",
            onClick: () => changeView("operations"),
        },
        {
            label: "Material Readiness",
            value: `${Math.round(avgMaterialReady)}%`,
            subtitle: `Average readiness across ${activeRows.length} active MRs`,
            icon: QueryStatsRoundedIcon,
            tone: avgMaterialReady >= 80 ? "success" : avgMaterialReady >= 50 ? "warning" : "primary",
            progress: avgMaterialReady,
        },
        {
            label: "Shortage Exposure",
            value: formatQty(shortageQty),
            subtitle: `${shortageRows.length} MRs need purchase / supply resolution`,
            icon: WarningAmberRoundedIcon,
            tone: shortageRows.length ? "danger" : "success",
            onClick: () => navigate("/matflow/purchase"),
        },
        {
            label: "Material Hand-offs",
            value: kpis.transfersInProgress ?? totals.materialInTransitRequisitions ?? 0,
            subtitle: "Active Main Store / Plant Store / Processing / Production hand-offs",
            icon: LocalShippingOutlinedIcon,
            tone: "purple",
        },
        {
            label: "Quality / Processing",
            value: `${totals.pendingQcInspections ?? 0} / ${totals.activeProcessingJobs ?? 0}`,
            subtitle: "Pending QC checks / active processing jobs",
            icon: FactCheckOutlinedIcon,
            tone: (totals.pendingQcInspections ?? 0) > 0 ? "warning" : "success",
        },
    ];

    const workflowLinks = [
        ["Projects", "Project + Product portfolio", "/matflow/projects", "projects", FolderOpenRoundedIcon, "primary"],
        ["BOM", "Engineering → Production Review", "/matflow/boms", "boms", AssessmentRoundedIcon, "purple"],
        ["MR", "Production material demand", "/matflow/production", "production", AssignmentOutlinedIcon, "primary"],
        ["Store", "Plant routing / Main Store planning", "/matflow/store", "store", Inventory2OutlinedIcon, "success"],
        ["Purchase", "PI → PO → GRN at Main Store", "/matflow/purchase", "purchase", WarningAmberRoundedIcon, "warning"],
        ["QC", "Main Store material checklist", "/matflow/qc", "qc", FactCheckOutlinedIcon, "warning"],
        ["Production", "Receive → account → complete", "/matflow/production-execution", "production-execution", PrecisionManufacturingOutlinedIcon, "purple"],
    ].filter(([, , , screen]) => canAccessMatFlowScreenForContext(screen, roles, contextPlants));

    return (
        <Box sx={pageSx}>
            <UniversalDashboardHeader view={view} onViewChange={changeView} onRefresh={load} refreshing={loading} />
            <ErrorBox>{error}</ErrorBox>
            {loading ? <LoadingBlock /> : (
                <>
                    <Card
                        sx={{
                            ...panelSx,
                            p: { xs: 1.25, md: 1.6 },
                            overflow: "hidden",
                            position: "relative",
                            background: "var(--mf-hero-bg)",
                            "&::after": {
                                content: '\"\"',
                                position: "absolute",
                                width: 240,
                                height: 240,
                                borderRadius: "50%",
                                right: -90,
                                top: -120,
                                background: "var(--mf-primary-soft)",
                                filter: "blur(2px)",
                                pointerEvents: "none",
                            },
                        }}
                    >
                        <Box sx={{ position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0,1.5fr) minmax(360px,.7fr)" }, gap: 1.5, alignItems: "center" }}>
                            <Box>
                                <Box sx={{ display: "flex", alignItems: "center", gap: .55, mb: .7 }}>
                                    <Box sx={{ width: 28, height: 28, borderRadius: 2, display: "grid", placeItems: "center", background: "var(--mf-primary-soft)", color: "var(--mf-primary-text)", border: "1px solid var(--mf-primary-border)" }}>
                                        <BoltRoundedIcon sx={{ fontSize: 17 }} />
                                    </Box>
                                    <Typography sx={{ ...mainTextSx, fontSize: 11.5, textTransform: "uppercase", letterSpacing: .75 }}>Operational pulse</Typography>
                                </Box>
                                <Typography sx={{ ...mainTextSx, fontSize: { xs: 22, md: 28 }, lineHeight: 1.12 }}>
                                    {selectedPlantParam ? `${selectedPlantParam} Material Flow Overview` : "Cross-Plant Material Flow Overview"}
                                </Typography>
                                <Typography sx={{ ...subTextSx, mt: .65, maxWidth: 760, fontSize: 11.5 }}>
                                    A live executive view of Project demand, material readiness, shortages, plant/store hand-offs, QC, processing and Production execution. Charts use the same plant-authorised tracker and dashboard read models as the Operations Board.
                                </Typography>
                                <Box sx={{ display: "flex", gap: .6, mt: 1.15, flexWrap: "wrap" }}>
                                    <Button onClick={() => changeView("operations")} sx={primaryBtnSx}>Open Operations Board</Button>
                                    <Button onClick={() => changeView("projects")} sx={secondaryBtnSx}>Project Tracker</Button>
                                    <Button onClick={() => changeView("materials")} sx={secondaryBtnSx}>Material Tracker</Button>
                                </Box>
                            </Box>
                            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: .7 }}>
                                {[
                                    ["Active MRs", activeRows.length, "primary"],
                                    ["Timing Risk", breachedRows.length + watchRows.length, breachedRows.length ? "danger" : "warning"],
                                    ["Shortage", shortageRows.length, shortageRows.length ? "danger" : "success"],
                                ].map(([label, value, tone]) => {
                                    const palette = OVERVIEW_TONES[tone];
                                    return (
                                        <Box key={label} sx={{ p: .85, borderRadius: 2, border: `1px solid ${palette.border}`, background: palette.soft, textAlign: "center" }}>
                                            <Typography sx={{ ...mainTextSx, fontSize: 20, color: palette.text }}>{value}</Typography>
                                            <Typography sx={{ ...subTextSx, fontSize: 9.5 }}>{label}</Typography>
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Box>
                    </Card>

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", md: "repeat(3,minmax(0,1fr))", xl: "repeat(6,minmax(0,1fr))" }, gap: 1 }}>
                        {overviewCards.map((card) => <OverviewMetricCard key={card.label} {...card} />)}
                    </Box>

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "minmax(280px,.72fr) minmax(420px,1.25fr) minmax(360px,1fr)" }, gap: 1 }}>
                        <Card sx={{ ...panelSx, m: 0, p: 1.25 }}>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: .8, mb: .95 }}>
                                <Box>
                                    <Typography sx={{ ...mainTextSx, fontSize: 14 }}>Material Readiness</Typography>
                                    <Typography sx={{ ...subTextSx, mt: .15 }}>Average across active Material Requisitions</Typography>
                                </Box>
                                <QueryStatsRoundedIcon sx={{ color: "var(--mf-primary-text)", fontSize: 20 }} />
                            </Box>
                            <OverviewDonut
                                value={avgMaterialReady}
                                label="ready"
                                caption={`${activeRows.filter((row) => row.readyToStartProduction === true).length} MR(s) currently report ready-to-start Production.`}
                                tone={avgMaterialReady >= 80 ? "success" : avgMaterialReady >= 50 ? "warning" : "primary"}
                            />
                            <Divider sx={{ my: 1, borderColor: "var(--mf-border)" }} />
                            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: .55 }}>
                                <Detail label="Open MRs" value={activeRows.length} />
                                <Detail label="Shortage MRs" value={shortageRows.length} />
                                <Detail label="Ready to Start" value={activeRows.filter((row) => row.readyToStartProduction === true).length} />
                                <Detail label="Material Hand-offs" value={kpis.transfersInProgress ?? totals.materialInTransitRequisitions ?? 0} />
                            </Box>
                        </Card>

                        <Card sx={{ ...panelSx, m: 0, p: 1.25 }}>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: .8, mb: 1 }}>
                                <Box>
                                    <Typography sx={{ ...mainTextSx, fontSize: 14 }}>Workflow Load</Typography>
                                    <Typography sx={{ ...subTextSx, mt: .15 }}>Where active Project/Product MRs are currently concentrated</Typography>
                                </Box>
                                <AssessmentRoundedIcon sx={{ color: "var(--mf-primary-text)", fontSize: 20 }} />
                            </Box>
                            <OverviewBarList rows={workflowLoad} valueLabel={(value) => `${value} MR${numeric(value) === 1 ? "" : "s"}`} />
                        </Card>

                        <Card sx={{ ...panelSx, m: 0, p: 1.25 }}>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: .8, mb: 1 }}>
                                <Box>
                                    <Typography sx={{ ...mainTextSx, fontSize: 14 }}>Timing Health</Typography>
                                    <Typography sx={{ ...subTextSx, mt: .15 }}>Current stage timing against backend operational targets</Typography>
                                </Box>
                                <QueryStatsRoundedIcon sx={{ color: "var(--mf-warning-text)", fontSize: 20 }} />
                            </Box>
                            <OverviewBarList rows={timingHealthRows} valueLabel={(value) => `${value}`} />
                        </Card>
                    </Box>

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "minmax(420px,1.08fr) minmax(420px,.92fr)" }, gap: 1 }}>
                        <Card sx={{ ...panelSx, m: 0, p: 1.25 }}>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: .8, mb: 1 }}>
                                <Box>
                                    <Typography sx={{ ...mainTextSx, fontSize: 14 }}>Plant Operations Comparison</Typography>
                                    <Typography sx={{ ...subTextSx, mt: .15 }}>Open demand and execution workload by authorised Plant scope</Typography>
                                </Box>
                                <PrecisionManufacturingOutlinedIcon sx={{ color: "var(--mf-purple-text)", fontSize: 20 }} />
                            </Box>
                            <OverviewPlantComparison rows={plantRows} />
                        </Card>

                        <Card sx={{ ...panelSx, m: 0, p: 1.25 }}>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: .8, mb: 1 }}>
                                <Box>
                                    <Typography sx={{ ...mainTextSx, fontSize: 14 }}>Attention Center</Typography>
                                    <Typography sx={{ ...subTextSx, mt: .15 }}>Highest priority timing, shortage and aged-flow exceptions</Typography>
                                </Box>
                                <WarningAmberRoundedIcon sx={{ color: "var(--mf-warning-text)", fontSize: 20 }} />
                            </Box>
                            <OverviewAttentionList rows={attentionRows} navigate={navigate} roles={roles} contextPlants={contextPlants} />
                        </Card>
                    </Box>

                    <Card sx={{ ...panelSx, p: 1.25 }}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1, flexWrap: "wrap" }}>
                            <Box>
                                <Typography sx={{ ...mainTextSx, fontSize: 14 }}>Live Material Execution</Typography>
                                <Typography sx={{ ...subTextSx, mt: .15 }}>Oldest active Project/Product MRs with the current department, Production plant/requester, readiness and next action.</Typography>
                            </Box>
                            <Button onClick={() => changeView("operations")} endIcon={<ChevronRightRoundedIcon />} sx={secondaryBtnSx}>Open full Operations Board</Button>
                        </Box>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2,minmax(0,1fr))" }, gap: .75 }}>
                            {liveRows.length === 0 ? <EmptyState>No active Material Requisitions.</EmptyState> : liveRows.map((row) => {
                                const target = nextActionTarget(row);
                                const canOpenTarget = canAccessMatFlowScreenForContext(target.screen, roles, contextPlants);
                                return (
                                    <Card key={row.requisitionId} sx={{ ...panelSx, m: 0, p: .9, boxShadow: "none" }}>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: .8, alignItems: "flex-start" }}>
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography sx={{ ...mainTextSx, fontSize: 11.8 }}>{row.projectCode || "-"} · {row.productName || "Product"}</Typography>
                                                <Typography sx={{ ...subTextSx, mt: .12 }}>{row.requisitionNumber || "-"} · {row.currentDepartment || row.currentStage || row.productionPlantCode || "-"}</Typography>
                                            </Box>
                                            <Box sx={{ display: "flex", gap: .35, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                                <MatFlowStatusChip status={row.currentStage} />
                                                <TimingHealthChip health={row.timingHealth} />
                                            </Box>
                                        </Box>
                                        <Box sx={{ mt: .7, display: "grid", gridTemplateColumns: "1fr auto", gap: .8, alignItems: "end" }}>
                                            <Box>
                                                <Box sx={{ display: "flex", justifyContent: "space-between", gap: .6, mb: .3 }}>
                                                    <Typography sx={{ ...subTextSx, fontSize: 9.8 }}>{readable(row.currentDepartment || row.responsibleDesk)} · {formatDurationMinutes(numeric(row.ageHours) * 60)}</Typography>
                                                    <Typography sx={{ ...mainTextSx, fontSize: 9.8 }}>{percent(row.materialReadyPercent)}%</Typography>
                                                </Box>
                                                <LinearProgress variant="determinate" value={percent(row.materialReadyPercent)} sx={{ height: 5, borderRadius: 99, background: "var(--mf-surface-strong)", "& .MuiLinearProgress-bar": { borderRadius: 99 } }} />
                                                {row.productionStartBlocker && <Typography sx={{ ...subTextSx, fontSize: 9.5, mt: .4 }}>Blocker: {readable(row.productionStartBlocker)}</Typography>}
                                            </Box>
                                            <Button onClick={() => navigate(canOpenTarget ? target.path : `/matflow/tracker/${row.requisitionId}`)} sx={{ ...secondaryBtnSx, minHeight: 30, fontSize: 9.8 }}>{canOpenTarget ? target.label : "Trace"}</Button>
                                        </Box>
                                    </Card>
                                );
                            })}
                        </Box>
                    </Card>

                    <Card sx={{ ...panelSx, p: 1.25 }}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: .8, mb: 1 }}>
                            <Box>
                                <Typography sx={{ ...mainTextSx, fontSize: 14 }}>Operational Workspaces</Typography>
                                <Typography sx={{ ...subTextSx, mt: .15 }}>Jump directly into the authorised desk responsible for the next material action.</Typography>
                            </Box>
                            <BoltRoundedIcon sx={{ color: "var(--mf-primary-text)", fontSize: 20 }} />
                        </Box>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", md: "repeat(3,minmax(0,1fr))", xl: `repeat(${Math.min(7, Math.max(1, workflowLinks.length))},minmax(0,1fr))` }, gap: .75 }}>
                            {workflowLinks.map(([title, subtitle, path, , Icon, tone]) => {
                                const palette = OVERVIEW_TONES[tone] || OVERVIEW_TONES.primary;
                                return (
                                    <Card
                                        key={title}
                                        onClick={() => navigate(path)}
                                        sx={{ ...panelSx, m: 0, p: .9, boxShadow: "none", cursor: "pointer", transition: "transform .18s ease,border-color .18s ease", "&:hover": { transform: "translateY(-2px)", borderColor: palette.border } }}
                                    >
                                        <Box sx={{ width: 31, height: 31, borderRadius: 2, display: "grid", placeItems: "center", background: palette.soft, color: palette.text, border: `1px solid ${palette.border}`, mb: .7 }}>
                                            <Icon sx={{ fontSize: 17 }} />
                                        </Box>
                                        <Typography sx={{ ...mainTextSx, fontSize: 11.5 }}>{title}</Typography>
                                        <Typography sx={{ ...subTextSx, mt: .18, fontSize: 9.7 }}>{subtitle}</Typography>
                                    </Card>
                                );
                            })}
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
                    plantCode: row.productionPlantCode,
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
                subtitle="One row per MR with Product context, current responsible department, Production plant/requester, readiness, shortage and the next responsible action."
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
                    <Typography sx={subTextSx}>{trackerView === "KANBAN" ? "Detailed MR-level workflow board inside the selected Project/Product tracker. Actions still open the authoritative workflow screen." : "Project hierarchy with collapsible Products and MR detail."}</Typography>
                </Box>
                <MatFlowViewToggle
                    value={trackerView}
                    onChange={setTrackerView}
                    options={[{ value: "HIERARCHY", label: "Hierarchy" }, { value: "KANBAN", label: "MR Workflow Board" }]}
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
                                    <Typography sx={subTextSx}>{row.requisitionNumber || "-"} · {row.productionPlantCode || "-"}</Typography>
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
                                        {["Product / Drawing", "MR", "Current Owner", "Production User / Plant", "Ready", "Shortage", "Next", "Action"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                                    </Box>
                                    {project.rows.map((row) => (
                                        <Box key={row.requisitionId} sx={{ ...tableRowSx, gridTemplateColumns: "200px 165px 165px 155px 105px 120px 175px 110px" }}>
                                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.productName || "-"}</Typography><Typography sx={subTextSx}>{row.drawingNo || "-"}</Typography></Box>
                                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.requisitionNumber}</Typography><Typography sx={subTextSx}>{readable(row.currentStage)}</Typography></Box>
                                            <Box sx={tableCellSx}>{readable(row.currentDepartment || row.responsibleDesk)}</Box>
                                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{productionOwnerText(row)}</Typography><Typography sx={subTextSx}>{readable(row.currentDepartment || row.currentStage || "Workflow")}</Typography></Box>
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
                            <Typography sx={subTextSx}>{stage.department} · {readable(stage.state || "-")}</Typography>
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
                <Typography sx={{ ...subTextSx, mb: 1.1 }}>Specific material workflow state and next hand-off, expressed only by department, plant and workflow status.</Typography>
                <Box sx={tableShellSx}>
                    <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "200px 110px 110px 110px 180px 170px 180px" }}>
                        {["Material", "Requested", "Shortage", "Tracked Qty", "Current", "Plant / State", "Next"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                    </Box>
                    {materials.length === 0 ? <EmptyState /> : materials.map((row, index) => (
                        <Box key={`${row.requisitionLineId}:${row.reservationId || index}`} sx={{ ...tableRowSx, gridTemplateColumns: "200px 110px 110px 110px 180px 170px 180px" }}>
                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialName || "-"}</Typography><Typography sx={subTextSx}>{row.currentMaterialCode || row.bomMaterialCode} · {row.uom}</Typography></Box>
                            <Box sx={tableCellSx}>{formatQty(row.requestedQty)}</Box>
                            <Box sx={tableCellSx}>{formatQty(row.shortageQty)}</Box>
                            <Box sx={tableCellSx}>{formatQty(row.trackedQty)}</Box>
                            <Box sx={tableCellSx}>{readable(row.currentDepartment)}</Box>
                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.currentPlantCode || summary.productionPlantCode || "-"}</Typography><Typography sx={subTextSx}>{readable(row.movementState)}</Typography></Box>
                            <Box sx={tableCellSx}>{readable(row.nextDepartment || row.nextAction)}</Box>
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

    const [requisitions, setRequisitions] = useState([]);
    const [projects, setProjects] = useState([]);
    const [selectedId, setSelectedId] = useState(materialId || "");
    const [selectedProjectId, setSelectedProjectId] = useState("");
    const [selectedProductId, setSelectedProductId] = useState("");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [usageIndexLoading, setUsageIndexLoading] = useState(true);
    const [usageIndexReady, setUsageIndexReady] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [activeOnly, setActiveOnly] = useState(true);
    const [expandedLotKey, setExpandedLotKey] = useState("");

    /*
     * The Material Tracker selector is intentionally demand-driven.  Do not use
     * the Material Catalogue here: a material belongs in this selector
     * only after it is actually referenced by a non-cancelled MR line that the
     * current user is allowed to read.  This also gives us the exact Project ->
     * Product relationship for each selectable material without inventing a
     * second source of truth in the frontend.
     */
    useEffect(() => {
        let active = true;
        setUsageIndexLoading(true);
        setUsageIndexReady(false);
        Promise.all([
            matflowApi.listRequisitions(),
            matflowApi.listProjects({
                plantCode: selectedPlantParam || undefined,
            }),
        ])
            .then(([requisitionResponse, projectResponse]) => {
                if (!active) return;
                setRequisitions(Array.isArray(requisitionResponse?.data) ? requisitionResponse.data : []);
                setProjects(extractMatFlowPage(projectResponse?.data).rows);
                setUsageIndexReady(true);
            })
            .catch(() => {
                if (!active) return;
                setRequisitions([]);
                setProjects([]);
                setSelectedId("");
                setSelectedProjectId("");
                setSelectedProductId("");
                setData(null);
                setUsageIndexReady(true);
            })
            .finally(() => {
                if (active) setUsageIndexLoading(false);
            });
        return () => { active = false; };
    }, [selectedPlantParam]);

    const productContextById = useMemo(() => {
        const index = new Map();
        projects.forEach((project) => {
            (Array.isArray(project?.products) ? project.products : []).forEach((product) => {
                if (!product?.id) return;
                index.set(String(product.id), { project, product });
            });
        });
        return index;
    }, [projects]);

    const materialUsageIndex = useMemo(() => {
        const byId = new Map();
        const selectedPlant = clean(selectedPlantParam).toUpperCase();

        const register = ({
            materialId: id,
            materialCode,
            materialName,
            materialCategory,
            uom,
            requisition,
            context,
        }) => {
            const key = clean(id);
            if (!key) return;

            let entry = byId.get(key);
            if (!entry) {
                entry = {
                    id: key,
                    materialId: key,
                    materialCode: clean(materialCode),
                    materialName: clean(materialName) || clean(materialCode) || "Material",
                    materialCategory: clean(materialCategory),
                    uom: clean(uom),
                    projectIds: new Set(),
                    productIds: new Set(),
                    requisitionIds: new Set(),
                };
                byId.set(key, entry);
            }

            if (!entry.materialCode && materialCode) entry.materialCode = clean(materialCode);
            if ((!entry.materialName || entry.materialName === "Material") && materialName) entry.materialName = clean(materialName);
            if (!entry.materialCategory && materialCategory) entry.materialCategory = clean(materialCategory);
            if (!entry.uom && uom) entry.uom = clean(uom);

            if (requisition?.id) entry.requisitionIds.add(String(requisition.id));
            if (context?.project?.id) entry.projectIds.add(String(context.project.id));
            if (context?.product?.id) entry.productIds.add(String(context.product.id));
        };

        (Array.isArray(requisitions) ? requisitions : []).forEach((requisition) => {
            if (!requisition || normalize(requisition.status) === "CANCELLED") return;
            const demandPlant = clean(requisition.productionPlantCode).toUpperCase();
            if (selectedPlant && demandPlant !== selectedPlant) return;

            const context = productContextById.get(String(requisition.projectDrawingId || "")) || null;
            (Array.isArray(requisition.lines) ? requisition.lines : []).forEach((line) => {
                if (!line || normalize(line.status) === "CANCELLED") return;

                // Original BOM/MR material.
                register({
                    materialId: line.materialId,
                    materialCode: line.materialCode,
                    materialName: line.materialName,
                    materialCategory: line.materialCategory,
                    uom: line.uom,
                    requisition,
                    context,
                });

                // A processed/output material can become the issued material for
                // the same demand line.  It is also genuinely used by that
                // Project/Product, so expose it as a selectable tracked material.
                if (line.issuedMaterialId && String(line.issuedMaterialId) !== String(line.materialId || "")) {
                    register({
                        materialId: line.issuedMaterialId,
                        materialCode: line.issuedMaterialCode,
                        materialName: line.issuedMaterialName,
                        materialCategory: line.materialCategory,
                        uom: line.uom,
                        requisition,
                        context,
                    });
                }
            });
        });

        const rows = Array.from(byId.values())
            .map((entry) => ({
                ...entry,
                projectCount: entry.projectIds.size,
                productCount: entry.productIds.size,
                requisitionCount: entry.requisitionIds.size,
            }))
            .sort((a, b) =>
                clean(a.materialName).localeCompare(clean(b.materialName), undefined, { sensitivity: "base" })
                || clean(a.materialCode).localeCompare(clean(b.materialCode), undefined, { sensitivity: "base" })
            );

        return { rows, byId };
    }, [requisitions, productContextById, selectedPlantParam]);

    const usedMaterials = materialUsageIndex.rows;
    const effectiveSelectedMaterialId = clean(selectedId || materialId);
    const selectedMaterialUsage = effectiveSelectedMaterialId
        ? materialUsageIndex.byId.get(effectiveSelectedMaterialId) || null
        : null;

    const availableProjects = useMemo(() => {
        if (!selectedMaterialUsage) return [];
        return projects
            .filter((project) => project?.id && selectedMaterialUsage.projectIds.has(String(project.id)))
            .sort((a, b) =>
                clean(a.projectCode).localeCompare(clean(b.projectCode), undefined, { sensitivity: "base", numeric: true })
                || clean(a.projectName).localeCompare(clean(b.projectName), undefined, { sensitivity: "base" })
            );
    }, [projects, selectedMaterialUsage]);

    const availableProducts = useMemo(() => {
        if (!selectedMaterialUsage) return [];
        const sourceProjects = selectedProjectId
            ? availableProjects.filter((project) => String(project.id) === String(selectedProjectId))
            : availableProjects;

        return sourceProjects
            .flatMap((project) =>
                (Array.isArray(project?.products) ? project.products : [])
                    .filter((product) => product?.id && selectedMaterialUsage.productIds.has(String(product.id)))
                    .map((product) => ({
                        ...product,
                        trackerProjectId: project.id,
                        trackerProjectCode: project.projectCode,
                        trackerProjectName: project.projectName,
                    }))
            )
            .sort((a, b) =>
                clean(a.trackerProjectCode).localeCompare(clean(b.trackerProjectCode), undefined, { sensitivity: "base", numeric: true })
                || clean(a.productName).localeCompare(clean(b.productName), undefined, { sensitivity: "base" })
                || clean(a.drawingNo).localeCompare(clean(b.drawingNo), undefined, { sensitivity: "base", numeric: true })
            );
    }, [availableProjects, selectedMaterialUsage, selectedProjectId]);

    useEffect(() => {
        const incoming = clean(materialId);
        if (!incoming || incoming === clean(selectedId)) return;
        // Once the used-material index is ready, never resurrect a stale or
        // inventory-only material ID from an old URL/bookmark.
        if (usageIndexReady && !materialUsageIndex.byId.has(incoming)) return;
        setSelectedId(incoming);
        setSelectedProjectId("");
        setSelectedProductId("");
        setExpandedLotKey("");
    }, [materialId, selectedId, usageIndexReady, materialUsageIndex]);

    useEffect(() => {
        if (!usageIndexReady || !selectedId) return;
        if (!materialUsageIndex.byId.has(clean(selectedId))) {
            setSelectedId("");
            setSelectedProjectId("");
            setSelectedProductId("");
            setExpandedLotKey("");
            setData(null);
            if (embedded && onMaterialChange) {
                onMaterialChange("");
            } else if (!embedded) {
                navigate("/matflow/dashboard?view=materials", { replace: true });
            }
        }
    }, [usageIndexReady, selectedId, materialUsageIndex, embedded, onMaterialChange, navigate]);

    useEffect(() => {
        if (!selectedProjectId) return;
        if (!availableProjects.some((project) => String(project.id) === String(selectedProjectId))) {
            setSelectedProjectId("");
            setSelectedProductId("");
        }
    }, [availableProjects, selectedProjectId]);

    useEffect(() => {
        if (!selectedProductId) return;
        if (!availableProducts.some((product) => String(product.id) === String(selectedProductId))) {
            setSelectedProductId("");
        }
    }, [availableProducts, selectedProductId]);

    const load = useCallback(async () => {
        const id = clean(selectedId || materialId);
        if (!id) {
            setData(null);
            return;
        }
        // The dropdown is the authoritative selector for this page.  Once its
        // usage index has loaded, an inventory-only/stale ID must not trigger a
        // tracker request behind the scenes.
        if (usageIndexReady && !materialUsageIndex.byId.has(id)) {
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
    }, [selectedId, materialId, selectedPlantParam, activeOnly, usageIndexReady, materialUsageIndex]);

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
                    : "Select a material actually used in MatFlow to see only the Projects/Products that use it, plus every allocation, route and next action."}
                actions={<Button startIcon={<RefreshIcon />} onClick={load} disabled={!selectedId && !materialId} sx={secondaryBtnSx}>Refresh</Button>}
            />}
            {embedded && (
                <Card sx={{ ...panelSx, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <Box><Typography sx={{ fontWeight: 950, fontSize: 17 }}>{identity.materialName || "Material Tracker"}</Typography><Typography sx={subTextSx}>{identity.materialCode ? `${identity.materialCode} · ${identity.category || "-"} · ${identity.uom || "-"}` : "Select a material already used in a MatFlow MR. Project and Product filters will then show only where that material is actually used."}</Typography></Box>
                    <Button startIcon={<RefreshIcon />} onClick={load} disabled={!selectedId && !materialId} sx={secondaryBtnSx}>Refresh</Button>
                </Card>
            )}

            <ErrorBox>{error}</ErrorBox>

            <Card sx={panelSx}>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(260px,1.15fr) minmax(210px,.9fr) minmax(230px,1fr) minmax(200px,.9fr) 160px" }, gap: 1 }}>
                    <TextField
                        select
                        label="Material in Use *"
                        value={selectedMaterialUsage ? selectedId : ""}
                        disabled={usageIndexLoading}
                        helperText={usageIndexLoading
                            ? "Loading used materials…"
                            : `${usedMaterials.length} material${usedMaterials.length === 1 ? "" : "s"} used in your current plant/access scope`}
                        onChange={(e) => {
                            const id = e.target.value;
                            setSelectedId(id);
                            setSelectedProjectId("");
                            setSelectedProductId("");
                            setExpandedLotKey("");
                            if (embedded && onMaterialChange) onMaterialChange(id);
                            else if (id) navigate(`/matflow/dashboard?view=materials&materialId=${encodeURIComponent(id)}`, { replace: true });
                            else navigate("/matflow/dashboard?view=materials", { replace: true });
                        }}
                        sx={fieldSx}
                    >
                        <MenuItem value="" disabled>
                            {usedMaterials.length === 0 ? "No used materials in this scope" : "Select a used Material"}
                        </MenuItem>
                        {usedMaterials.map((material) => (
                            <MenuItem key={material.materialId} value={material.materialId}>
                                <Box sx={{ minWidth: 0, py: .15 }}>
                                    <Typography sx={{ fontSize: 12.2, fontWeight: 850, lineHeight: 1.25 }}>
                                        {material.materialName || "Material"} · {material.materialCode || "-"}
                                    </Typography>
                                    <Typography sx={{ ...subTextSx, fontSize: 9.8, mt: .1 }}>
                                        {material.projectCount} Project{material.projectCount === 1 ? "" : "s"} · {material.productCount} Product{material.productCount === 1 ? "" : "s"} · {material.requisitionCount} MR{material.requisitionCount === 1 ? "" : "s"}
                                    </Typography>
                                </Box>
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        select
                        label="Used in PD No. / Project"
                        value={selectedProjectId}
                        onChange={(e) => { setSelectedProjectId(e.target.value); setSelectedProductId(""); }}
                        disabled={!selectedMaterialUsage}
                        helperText={selectedMaterialUsage
                            ? `${availableProjects.length} Project${availableProjects.length === 1 ? "" : "s"} use this material`
                            : "Select a used material first"}
                        sx={fieldSx}
                    >
                        <MenuItem value="">All Projects using this Material</MenuItem>
                        {availableProjects.map((project) => (
                            <MenuItem key={project.id} value={project.id}>
                                {project.projectCode || "-"} · {project.projectName || "Project"}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        select
                        label="Used in Product / Drawing"
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        disabled={!selectedMaterialUsage}
                        helperText={selectedMaterialUsage
                            ? `${availableProducts.length} Product${availableProducts.length === 1 ? "" : "s"}${selectedProjectId ? " in selected Project" : " use this material"}`
                            : "Select a used material first"}
                        sx={fieldSx}
                    >
                        <MenuItem value="">All Products using this Material</MenuItem>
                        {availableProducts.map((product) => (
                            <MenuItem key={product.id} value={product.id}>
                                {!selectedProjectId ? `${product.trackerProjectCode || "-"} · ` : ""}
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
                        <SummaryCard label="Store Declared / Allocated" value={formatQty(visibleKpis.reservedQty)} />
                        <SummaryCard label="Delayed Lots" value={visibleKpis.delayedLotCount} />
                    </Box>

                    <Card sx={panelSx}>
                        <Typography sx={{ fontWeight: 950, fontSize: 17 }}>Material Workflow by PD / Product</Typography>
                        <Typography sx={{ ...subTextSx, mb: 1.2 }}>Each row follows the actual branch taken by this material across Store, Purchase, QC, Processing and Production.</Typography>
                        <Box sx={tableShellSx}>
                            <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "220px 175px 130px 180px 150px 190px 150px 105px" }}>
                                {["PD No. / Product", "MR", "Tracked Qty", "Current", "Production User / Plant", "Next Action", "Timing", "Route"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
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
                                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{productionOwnerText(row)}</Typography><Typography sx={subTextSx}>{readable(row.currentDepartment || row.currentStage || "Workflow")}</Typography></Box>
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
                                                <Typography sx={{ fontWeight: 900, mb: .8 }}>Specific Material Workflow History</Typography>
                                                {history.length === 0 ? (
                                                    <Typography sx={subTextSx}>No workflow events have been recorded for this lot yet.</Typography>
                                                ) : (
                                                    <Box sx={tableShellSx}>
                                                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "70px 190px 170px 170px 145px 145px 125px 150px" }}>
                                                            {["#", "State", "Department / Plant", "Time In", "Time Out", "Duration", "Actor", "Reference"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                                                        </Box>
                                                        {history.map((event) => (
                                                            <Box key={`${row.lotKey}:${event.sequence}`} sx={{ ...tableRowSx, gridTemplateColumns: "70px 190px 170px 170px 145px 145px 125px 150px" }}>
                                                                <Box sx={tableCellSx}>{event.sequence}</Box>
                                                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{event.label || readable(event.state)}</Typography><Typography sx={subTextSx}>{readable(event.state)} · {formatQty(event.quantity)} {row.uom || ""}</Typography></Box>
                                                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{readable(event.department)}</Typography><Typography sx={subTextSx}>{event.plantCode || event.department || "Administrative / external"}</Typography></Box>
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

const MATERIAL_USAGE_PERIODS = [
    { value: "TODAY", label: "Today" },
    { value: "WEEK", label: "Last 7 Days" },
    { value: "MONTH", label: "Last 30 Days" },
    { value: "YEAR", label: "Last 365 Days" },
    { value: "ALL", label: "All Time" },
];

const localUsageDateTime = (date) => {
    const pad = (value) => String(value).padStart(2, "0");
    return [
        date.getFullYear(), "-", pad(date.getMonth() + 1), "-", pad(date.getDate()),
        "T", pad(date.getHours()), ":", pad(date.getMinutes()), ":", pad(date.getSeconds()),
    ].join("");
};

const materialUsageRange = (period) => {
    if (period === "ALL") return {};
    const now = new Date();
    const from = new Date(now);
    if (period === "TODAY") from.setHours(0, 0, 0, 0);
    else if (period === "WEEK") from.setDate(from.getDate() - 7);
    else if (period === "MONTH") from.setDate(from.getDate() - 30);
    else if (period === "YEAR") from.setDate(from.getDate() - 365);
    return { from: localUsageDateTime(from), to: localUsageDateTime(now) };
};

export function MatFlowMaterialRegisterPage() {
    const { selectedPlantParam } = useMatFlow();
    const [data, setData] = useState({ rows: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [usagePeriod, setUsagePeriod] = useState("MONTH");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            setData((await matflowApi.materialRegister({
                plantCode: selectedPlantParam,
                search: clean(search) || undefined,
                ...materialUsageRange(usagePeriod),
            }))?.data || { rows: [] });
        } catch (requestError) {
            setData({ rows: [] });
            setError(readMatFlowError(requestError, "Unable to load Material Register."));
        } finally {
            setLoading(false);
        }
    }, [selectedPlantParam, search, usagePeriod]);

    useEffect(() => { load(); }, [load]);

    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const pagination = useMatFlowPagination(rows, 20);

    const totals = useMemo(() => rows.reduce((sum, row) => {
        const waste = numeric(row.productionWastedQty) + numeric(row.processingWastedQty);
        return {
            purchased: sum.purchased + numeric(row.purchasedQty),
            issued: sum.issued + numeric(row.issuedQty),
            consumed: sum.consumed + numeric(row.consumedQty),
            waste: sum.waste + waste,
            used: sum.used + numeric(row.consumedQty) + waste,
            returned: sum.returned + numeric(row.returnedQty),
        };
    }, { purchased: 0, issued: 0, consumed: 0, waste: 0, used: 0, returned: 0 }), [rows]);

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="MATERIAL USAGE"
                title="Material Usage Register"
                subtitle="MatFlow reports actual material flow and usage by period. Physical Store balances, minimum stock and reorder controls remain exclusively in Tally."
                actions={
                    <>
                        <Button startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMatFlowExcel({ fileName: "MatFlow_Material_Usage", sheetName: "Material Usage", title: "MatFlow Material Usage Register", rows })} sx={secondaryBtnSx}>Export Excel</Button>
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                    </>
                }
            />
            <ErrorBox>{error}</ErrorBox>

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(6,minmax(0,1fr))", gap: 1 }}>
                <SummaryCard label="Total Used" value={formatQty(totals.used)} />
                <SummaryCard label="Consumed" value={formatQty(totals.consumed)} />
                <SummaryCard label="Process / Prod Waste" value={formatQty(totals.waste)} />
                <SummaryCard label="Issued to Production" value={formatQty(totals.issued)} />
                <SummaryCard label="Returned" value={formatQty(totals.returned)} />
                <SummaryCard label="Purchased / Received" value={formatQty(totals.purchased)} />
            </Box>

            <Card sx={{ ...panelSx, display: "flex", gap: 1.2, alignItems: "center", flexWrap: "wrap" }}>
                <TextField label="Search Material" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ ...fieldSx, minWidth: 320, flex: "1 1 320px" }} />
                <TextField select label="Usage Period" value={usagePeriod} onChange={(e) => setUsagePeriod(e.target.value)} sx={{ ...fieldSx, minWidth: 190 }}>
                    {MATERIAL_USAGE_PERIODS.map((period) => <MenuItem key={period.value} value={period.value}>{period.label}</MenuItem>)}
                </TextField>
                <Typography sx={subTextSx}>Used = consumed + Production wastage + Processing wastage for the selected period.</Typography>
            </Card>

            <Card sx={panelSx}>
                {loading ? <LoadingBlock /> : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "220px 115px 110px 110px 110px 110px 110px 110px 145px" }}>
                            {["Material", "Used", "Consumed", "Prod Waste", "Proc Waste", "Issued", "Returned", "Purchased", "Last Movement"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {pagination.pageItems.length === 0 ? <EmptyState /> : pagination.pageItems.map((row) => (
                            <Box key={row.materialId} sx={{ ...tableRowSx, gridTemplateColumns: "220px 115px 110px 110px 110px 110px 110px 110px 145px" }}>
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialName}</Typography><Typography sx={subTextSx}>{row.materialCode} · {row.uom}</Typography></Box>
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{formatQty(numeric(row.consumedQty) + numeric(row.productionWastedQty) + numeric(row.processingWastedQty))}</Typography></Box>
                                <Box sx={tableCellSx}>{formatQty(row.consumedQty)}</Box>
                                <Box sx={tableCellSx}>{formatQty(row.productionWastedQty)}</Box>
                                <Box sx={tableCellSx}>{formatQty(row.processingWastedQty)}</Box>
                                <Box sx={tableCellSx}>{formatQty(row.issuedQty)}</Box>
                                <Box sx={tableCellSx}>{formatQty(row.returnedQty)}</Box>
                                <Box sx={tableCellSx}>{formatQty(row.purchasedQty)}</Box>
                                <Box sx={tableCellSx}>{formatDate(row.lastMovementAt)}</Box>
                            </Box>
                        ))}
                    </Box>
                )}
                {!loading && <MatFlowPagination {...pagination} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} label="Material Usage" />}
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
            setData(extractMatFlowPage((await matflowApi.materialMovementAudit({
                plantCode: selectedPlantParam,
                search: clean(search) || undefined,
                movementType: movementType || undefined,
                page,
                size: 25,
            }))?.data));
        } catch (requestError) {
            setData({ rows: [], page: 0, totalPages: 0, totalElements: 0 });
            setError(readMatFlowError(requestError, "Unable to load Material Movement Audit."));
        } finally {
            setLoading(false);
        }
    }, [selectedPlantParam, search, movementType, page]);

    useEffect(() => { load(); }, [load]);

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="IMMUTABLE MATERIAL HISTORY"
                title="Material Movement Audit"
                subtitle="Immutable MatFlow workflow and usage events for audit/reference. Events are grouped by plant/department only; Tally remains the physical stock authority."
                actions={
                    <>
                        <Button startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMatFlowExcel({ fileName: "MatFlow_Material_Movement_Audit", sheetName: "Movements", title: "MatFlow Material Movement Audit", rows: data.rows || [] })} sx={secondaryBtnSx}>Export Page</Button>
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
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "190px 175px 155px 150px 145px 180px 145px" }}>
                            {["Material", "Plant / Department", "Movement", "Qty Change", "Reference", "PD No. / Drawing", "Actor / Time"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {(data.rows || []).length === 0 ? <EmptyState /> : data.rows.map((row) => (
                            <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "190px 175px 155px 150px 145px 180px 145px" }}>
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialName}</Typography><Typography sx={subTextSx}>{row.materialCode}</Typography></Box>
                                <Box sx={tableCellSx}>{row.plantCode || "-"} · {readable(row.department || row.responsibleDepartment || "Workflow")}</Box>
                                <Box sx={tableCellSx}><MatFlowStatusChip status={row.movementType} /></Box>
                                <Box sx={tableCellSx}>{formatQty(row.quantityChange)}</Box>
                                <Box sx={tableCellSx}>{row.referenceNumber || row.referenceType || "-"}</Box>
                                <Box sx={tableCellSx}>{row.projectCode || "-"} · {row.drawingNo || "-"}</Box>
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.actor || "-"}</Typography><Typography sx={subTextSx}>{formatDate(row.actionAt)}</Typography></Box>
                            </Box>
                        ))}
                    </Box>
                )}

                <Box sx={{ mt: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography sx={subTextSx}>{data.totalElements || 0} movement rows</Typography>
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
                subtitle="Shortage ageing and recent audit activity. Material usage roll-up lives in Material Usage Register; immutable MatFlow events live in Material Movement Audit. Physical stock remains in Tally."
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
