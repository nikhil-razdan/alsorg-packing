import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    Box,
    Button,
    Card,
    Chip,
    CircularProgress,
    Collapse,
    IconButton,
    LinearProgress,
    MenuItem,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";

import RefreshOutlinedIcon
    from "@mui/icons-material/RefreshOutlined";

import VisibilityOutlinedIcon
    from "@mui/icons-material/VisibilityOutlined";

import TrackChangesOutlinedIcon
    from "@mui/icons-material/TrackChangesOutlined";

import KeyboardArrowDownOutlinedIcon
    from "@mui/icons-material/KeyboardArrowDownOutlined";

import KeyboardArrowUpOutlinedIcon
    from "@mui/icons-material/KeyboardArrowUpOutlined";

import Inventory2OutlinedIcon
    from "@mui/icons-material/Inventory2Outlined";

import WarningAmberOutlinedIcon
    from "@mui/icons-material/WarningAmberOutlined";

import AccountTreeOutlinedIcon
    from "@mui/icons-material/AccountTreeOutlined";

import {
    useNavigate,
} from "react-router-dom";

import {
    matflowApi,
    readMatFlowError,
} from "../api/matflowApi";

import {
    errorBoxSx,
    fieldSx,
    heroBadgeSx,
    heroSubSx,
    heroSx,
    heroTitleSx,
    loadingSx,
    pageSx,
    panelSx,
    primaryBtnSx,
    secondaryBtnSx,
} from "../matflowTheme";

const clean = (value) =>
    String(value ?? "").trim();

const normalize = (value) =>
    clean(value)
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

const numeric = (value) => {
    const parsed =
        Number(value);

    return Number.isFinite(parsed)
        ? parsed
        : 0;
};

const formatQty = (value) =>
    numeric(value).toLocaleString(
        "en-IN",
        {
            maximumFractionDigits: 3,
        }
    );

const formatDateTime = (value) => {
    if (!value) {
        return "-";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "-";
    }

    return date.toLocaleString(
        "en-IN"
    );
};

const formatAge = (value) => {
    if (!value) {
        return "-";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "-";
    }

    const difference =
        Math.max(
            0,
            Date.now() -
            date.getTime()
        );

    const hours =
        Math.floor(
            difference /
            (1000 * 60 * 60)
        );

    if (hours < 24) {
        return `${hours} hr`;
    }

    const days =
        Math.floor(
            hours / 24
        );

    const remainingHours =
        hours % 24;

    return remainingHours > 0
        ? `${days}d ${remainingHours}h`
        : `${days}d`;
};

const lineArray = (requisition) =>
    Array.isArray(
        requisition?.lines
    )
        ? requisition.lines
        : [];

const sumLines = (
    requisition,
    field
) =>
    lineArray(requisition).reduce(
        (total, line) =>
            total +
            numeric(
                line?.[field]
            ),
        0
    );

const statusMeta = (value) => {
    const status =
        normalize(value);

    switch (status) {
        case "DRAFT":
            return {
                label:
                    "Draft",
                color:
                    "#94a3b8",
            };

        case "SUBMITTED":
        case "WAITING_STORE":
            return {
                label:
                    "Awaiting Store",
                color:
                    "#60a5fa",
            };

        case "PARTIAL_SHORTAGE":
            return {
                label:
                    "Partial Shortage",
                color:
                    "#fb923c",
            };

        case "SHORTAGE":
        case "SHORTAGE_PENDING":
            return {
                label:
                    "Shortage Pending",
                color:
                    "#f59e0b",
            };

        case "RESERVED":
        case "PLANNED":
            return {
                label:
                    "Reserved",
                color:
                    "#34d399",
            };

        case "IN_TRANSFER":
            return {
                label:
                    "In Transfer",
                color:
                    "#a78bfa",
            };

        case "PARTIALLY_ISSUED":
            return {
                label:
                    "Partially Issued",
                color:
                    "#22d3ee",
            };

        case "ISSUED":
        case "ISSUED_TO_PRODUCTION":
            return {
                label:
                    "Issued to Production",
                color:
                    "#06b6d4",
            };

        case "PARTIALLY_CONSUMED":
            return {
                label:
                    "Partially Consumed",
                color:
                    "#2dd4bf",
            };

        case "CONSUMED":
        case "COMPLETED":
            return {
                label:
                    "Consumed",
                color:
                    "#10b981",
            };

        case "RETURNED":
            return {
                label:
                    "Returned",
                color:
                    "#f472b6",
            };

        case "CANCELLED":
            return {
                label:
                    "Cancelled",
                color:
                    "#f87171",
            };

        default:
            return {
                label:
                    clean(value) ||
                    "Unknown",
                color:
                    "#94a3b8",
            };
    }
};

const clampPercent = (
    value
) => {
    return Math.min(
        100,
        Math.max(
            0,
            Math.round(
                numeric(value)
            )
        )
    );
};

const percentage = (
    value,
    total
) => {
    const safeTotal =
        numeric(total);

    if (safeTotal <= 0) {
        return 0;
    }

    return clampPercent(
        (
            numeric(value) /
            safeTotal
        ) *
        100
    );
};

const materialCategory = (
    line
) => {
    return normalize(
        line?.materialCategory ||
        line?.materialCategorySnapshot ||
        "MISCELLANEOUS"
    );
};

const readableCategory = (
    value
) => {
    const normalized =
        normalize(value);

    if (!normalized) {
        return "Miscellaneous";
    }

    return normalized
        .toLowerCase()
        .split("_")
        .map(
            (part) =>
                part.charAt(0)
                    .toUpperCase() +
                part.slice(1)
        )
        .join(" ");
};

const materialCoverage = (
    line
) => {
    const requested =
        numeric(
            line?.requestedQty
        );

    const reserved =
        numeric(
            line?.reservedQty
        );

    const issued =
        numeric(
            line?.issuedQty
        );

    const consumed =
        numeric(
            line?.consumedQty
        );

    const returned =
        numeric(
            line?.returnedQty
        );

    const operationallyCovered =
        Math.max(
            reserved,
            issued,
            consumed +
            returned
        );

    return Math.min(
        requested,
        operationallyCovered
    );
};

const openTransferStatuses =
    new Set([
        "PLANNED",
        "READY",
        "DISPATCHED",
        "IN_TRANSIT",
        "PARTIALLY_RECEIVED",
    ]);

const materialStage = (
    line,
    requisitionStatus,
    planning
) => {
    const requested =
        numeric(
            line?.requestedQty
        );

    const reserved =
        numeric(
            line?.reservedQty
        );

    const shortage =
        numeric(
            line?.shortageQty
        );

    const issued =
        numeric(
            line?.issuedQty
        );

    const consumed =
        numeric(
            line?.consumedQty
        );

    const returned =
        numeric(
            line?.returnedQty
        );

    const transfers =
        planning?.transfers ||
        [];

    const hasOpenTransfer =
        transfers.some(
            (transfer) =>
                openTransferStatuses.has(
                    normalize(
                        transfer?.status
                    )
                )
        );

    if (
        normalize(
            requisitionStatus
        ) === "CANCELLED"
    ) {
        return "CANCELLED";
    }

    if (returned > 0) {
        return "RETURNED";
    }

    if (
        requested > 0 &&
        consumed >= requested
    ) {
        return "CONSUMED";
    }

    if (consumed > 0) {
        return "PARTIALLY_CONSUMED";
    }

    if (
        requested > 0 &&
        issued >= requested
    ) {
        return "ISSUED";
    }

    if (issued > 0) {
        return "PARTIALLY_ISSUED";
    }

    if (hasOpenTransfer) {
        return "IN_TRANSFER";
    }

    if (
        shortage > 0 &&
        reserved > 0
    ) {
        return "PARTIAL_SHORTAGE";
    }

    if (shortage > 0) {
        return "SHORTAGE";
    }

    if (
        requested > 0 &&
        reserved >= requested
    ) {
        return "RESERVED";
    }

    if (
        normalize(
            requisitionStatus
        ) === "SUBMITTED"
    ) {
        return "WAITING_STORE";
    }

    return normalize(
        requisitionStatus
    ) || "DRAFT";
};

const materialProgress = (
    stage
) => {
    switch (
    normalize(stage)
    ) {
        case "DRAFT":
            return 10;

        case "WAITING_STORE":
        case "SUBMITTED":
            return 25;

        case "SHORTAGE":
            return 35;

        case "PARTIAL_SHORTAGE":
            return 45;

        case "RESERVED":
            return 55;

        case "IN_TRANSFER":
            return 70;

        case "PARTIALLY_ISSUED":
            return 78;

        case "ISSUED":
            return 85;

        case "PARTIALLY_CONSUMED":
            return 92;

        case "RETURNED":
            return 94;

        case "CONSUMED":
            return 100;

        default:
            return 15;
    }
};

const lineNeedsAttention = (
    line,
    requisitionStatus
) => {
    return (
        numeric(
            line?.shortageQty
        ) > 0 ||
        normalize(
            requisitionStatus
        ) === "SUBMITTED"
    );
};

const emptyPlanningState = {
    loading: false,
    error: "",
    data: null,
};

export default function MatFlowTracker() {
    const navigate =
        useNavigate();

    const [
        requisitions,
        setRequisitions,
    ] = useState([]);

    const [
        expandedProjects,
        setExpandedProjects,
    ] = useState({});

    const [
        expandedRequisitions,
        setExpandedRequisitions,
    ] = useState({});

    const [
        planningByRequisition,
        setPlanningByRequisition,
    ] = useState({});

    const [search, setSearch] =
        useState("");

    const [
        plantFilter,
        setPlantFilter,
    ] = useState("ALL");

    const [
        statusFilter,
        setStatusFilter,
    ] = useState("ALL");

    const [
        attentionOnly,
        setAttentionOnly,
    ] = useState(false);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    const loadTracker =
        useCallback(
            async () => {
                setLoading(true);
                setError("");

                try {
                    const response =
                        await matflowApi
                            .listRequisitions();

                    setRequisitions(
                        Array.isArray(
                            response?.data
                        )
                            ? response.data
                            : []
                    );
                } catch (
                requestError
                ) {
                    setError(
                        readMatFlowError(
                            requestError,
                            "Unable to load the enhanced MatFlow tracker."
                        )
                    );
                } finally {
                    setLoading(false);
                }
            },
            []
        );

    useEffect(() => {
        loadTracker();
    }, [loadTracker]);

    const loadPlanning =
        useCallback(
            async (
                requisitionId
            ) => {
                if (!requisitionId) {
                    return;
                }

                setPlanningByRequisition(
                    (current) => ({
                        ...current,
                        [requisitionId]: {
                            ...emptyPlanningState,
                            ...current[
                            requisitionId
                            ],
                            loading:
                                true,
                            error:
                                "",
                        },
                    })
                );

                try {
                    const response =
                        await matflowApi
                            .getRequisitionPlanning(
                                requisitionId
                            );

                    setPlanningByRequisition(
                        (current) => ({
                            ...current,
                            [requisitionId]:
                            {
                                loading:
                                    false,
                                error:
                                    "",
                                data:
                                    response?.data ||
                                    null,
                            },
                        })
                    );
                } catch (
                requestError
                ) {
                    setPlanningByRequisition(
                        (current) => ({
                            ...current,
                            [requisitionId]:
                            {
                                loading:
                                    false,
                                error:
                                    readMatFlowError(
                                        requestError,
                                        "Unable to load planning details."
                                    ),
                                data:
                                    null,
                            },
                        })
                    );
                }
            },
            []
        );

    const toggleProject = (
        projectKey
    ) => {
        setExpandedProjects(
            (current) => ({
                ...current,
                [projectKey]:
                    !current[
                    projectKey
                    ],
            })
        );
    };

    const toggleRequisition =
        async (
            requisition
        ) => {
            const id =
                requisition?.id;

            if (!id) {
                return;
            }

            const nextExpanded =
                !expandedRequisitions[
                id
                ];

            setExpandedRequisitions(
                (current) => ({
                    ...current,
                    [id]:
                        nextExpanded,
                })
            );

            if (
                nextExpanded &&
                !planningByRequisition[
                    id
                ]?.data &&
                !planningByRequisition[
                    id
                ]?.loading
            ) {
                await loadPlanning(
                    id
                );
            }
        };

    const projectGroups =
        useMemo(() => {
            const grouped =
                new Map();

            for (
                const requisition
                of requisitions
            ) {
                const projectId =
                    requisition
                        ?.projectDrawingId ||
                    "NO_PROJECT";

                const projectKey =
                    String(projectId);

                if (
                    !grouped.has(
                        projectKey
                    )
                ) {
                    grouped.set(
                        projectKey,
                        {
                            key:
                                projectKey,

                            projectDrawingId:
                                requisition
                                    ?.projectDrawingId,

                            projectCode:
                                requisition
                                    ?.projectCode ||
                                "Unassigned Project",

                            drawingNo:
                                requisition
                                    ?.drawingNo ||
                                "-",

                            plantCode:
                                requisition
                                    ?.destinationPlantCode ||
                                "-",

                            requisitions:
                                [],
                        }
                    );
                }

                grouped
                    .get(
                        projectKey
                    )
                    .requisitions
                    .push(
                        requisition
                    );
            }

            return Array.from(
                grouped.values()
            )
                .map(
                    (project) => {
                        const requested =
                            project.requisitions
                                .reduce(
                                    (
                                        total,
                                        requisition
                                    ) =>
                                        total +
                                        sumLines(
                                            requisition,
                                            "requestedQty"
                                        ),
                                    0
                                );

                        const reserved =
                            project.requisitions
                                .reduce(
                                    (
                                        total,
                                        requisition
                                    ) =>
                                        total +
                                        sumLines(
                                            requisition,
                                            "reservedQty"
                                        ),
                                    0
                                );

                        const shortage =
                            project.requisitions
                                .reduce(
                                    (
                                        total,
                                        requisition
                                    ) =>
                                        total +
                                        sumLines(
                                            requisition,
                                            "shortageQty"
                                        ),
                                    0
                                );

                        const issued =
                            project.requisitions
                                .reduce(
                                    (
                                        total,
                                        requisition
                                    ) =>
                                        total +
                                        sumLines(
                                            requisition,
                                            "issuedQty"
                                        ),
                                    0
                                );

                        const consumed =
                            project.requisitions
                                .reduce(
                                    (
                                        total,
                                        requisition
                                    ) =>
                                        total +
                                        sumLines(
                                            requisition,
                                            "consumedQty"
                                        ),
                                    0
                                );

                        const materialCount =
                            project.requisitions
                                .reduce(
                                    (
                                        total,
                                        requisition
                                    ) =>
                                        total +
                                        lineArray(
                                            requisition
                                        )
                                            .length,
                                    0
                                );

                        const attentionCount =
                            project.requisitions
                                .reduce(
                                    (
                                        total,
                                        requisition
                                    ) =>
                                        total +
                                        lineArray(
                                            requisition
                                        ).filter(
                                            (
                                                line
                                            ) =>
                                                lineNeedsAttention(
                                                    line,
                                                    requisition.status
                                                )
                                        )
                                            .length,
                                    0
                                );

                        const progress =
                            requested > 0
                                ? Math.round(
                                    Math.min(
                                        100,
                                        (
                                            consumed /
                                            requested
                                        ) *
                                        100
                                    )
                                )
                                : 0;

                        const lastActivity =
                            project.requisitions
                                .map(
                                    (requisition) =>
                                        requisition.plannedAt ||
                                        requisition.submittedAt ||
                                        requisition.requestedAt
                                )
                                .filter(Boolean)
                                .sort()
                                .reverse()[0] ||
                            null;

                        let projectStatus =
                            "DRAFT";

                        if (
                            consumed > 0 &&
                            requested > 0 &&
                            consumed >=
                            requested
                        ) {
                            projectStatus =
                                "CONSUMED";
                        } else if (
                            issued > 0
                        ) {
                            projectStatus =
                                "ISSUED";
                        } else if (
                            shortage > 0
                        ) {
                            projectStatus =
                                reserved > 0
                                    ? "PARTIAL_SHORTAGE"
                                    : "SHORTAGE";
                        } else if (
                            reserved > 0
                        ) {
                            projectStatus =
                                "RESERVED";
                        } else if (
                            project.requisitions
                                .some(
                                    (
                                        requisition
                                    ) =>
                                        normalize(
                                            requisition.status
                                        ) ===
                                        "SUBMITTED"
                                )
                        ) {
                            projectStatus =
                                "WAITING_STORE";
                        }

                        return {
                            ...project,
                            requested,
                            reserved,
                            shortage,
                            issued,
                            consumed,
                            materialCount,
                            attentionCount,
                            progress,
                            lastActivity,
                            projectStatus,
                        };
                    }
                )
                .sort(
                    (left, right) =>
                        new Date(
                            right.lastActivity ||
                            0
                        ).getTime() -
                        new Date(
                            left.lastActivity ||
                            0
                        ).getTime()
                );
        }, [requisitions]);

    const analytics =
        useMemo(() => {
            const materialRows = [];

            const categoryMap =
                new Map();

            const projectMap =
                new Map();

            const health = {
                ready: 0,
                partial: 0,
                shortage: 0,
                waiting: 0,
                inProcess: 0,
            };

            let totalRequested = 0;
            let totalCovered = 0;
            let totalReserved = 0;
            let totalShortage = 0;
            let totalIssued = 0;
            let totalConsumed = 0;
            let totalReturned = 0;

            for (
                const requisition
                of requisitions
            ) {
                const projectKey =
                    String(
                        requisition
                            ?.projectDrawingId ||
                        requisition
                            ?.projectCode ||
                        "UNASSIGNED"
                    );

                const project =
                    projectMap.get(
                        projectKey
                    ) || {
                        projectKey,
                        projectCode:
                            requisition
                                ?.projectCode ||
                            "Unassigned",
                        drawingNo:
                            requisition
                                ?.drawingNo ||
                            "-",
                        plantCode:
                            requisition
                                ?.destinationPlantCode ||
                            "-",
                        requested: 0,
                        covered: 0,
                        reserved: 0,
                        shortage: 0,
                        issued: 0,
                        consumed: 0,
                        materialCount: 0,
                        attentionCount: 0,
                        lastActivity: null,
                    };

                const activity =
                    requisition
                        ?.plannedAt ||
                    requisition
                        ?.submittedAt ||
                    requisition
                        ?.requestedAt ||
                    null;

                if (
                    activity &&
                    (
                        !project.lastActivity ||
                        new Date(
                            activity
                        ).getTime() >
                        new Date(
                            project.lastActivity
                        ).getTime()
                    )
                ) {
                    project.lastActivity =
                        activity;
                }

                for (
                    const line
                    of lineArray(
                        requisition
                    )
                ) {
                    const requested =
                        numeric(
                            line
                                ?.requestedQty
                        );

                    const covered =
                        materialCoverage(
                            line
                        );

                    const reserved =
                        numeric(
                            line
                                ?.reservedQty
                        );

                    const shortage =
                        numeric(
                            line
                                ?.shortageQty
                        );

                    const issued =
                        numeric(
                            line
                                ?.issuedQty
                        );

                    const consumed =
                        numeric(
                            line
                                ?.consumedQty
                        );

                    const returned =
                        numeric(
                            line
                                ?.returnedQty
                        );

                    const status =
                        normalize(
                            requisition
                                ?.status
                        );

                    let healthKey =
                        "inProcess";

                    if (
                        (
                            status ===
                            "DRAFT" ||
                            status ===
                            "SUBMITTED"
                        ) &&
                        reserved === 0 &&
                        shortage === 0
                    ) {
                        healthKey =
                            "waiting";
                    } else if (
                        shortage > 0 &&
                        covered > 0
                    ) {
                        healthKey =
                            "partial";
                    } else if (
                        shortage > 0
                    ) {
                        healthKey =
                            "shortage";
                    } else if (
                        requested > 0 &&
                        covered >=
                        requested
                    ) {
                        healthKey =
                            "ready";
                    }

                    health[
                        healthKey
                    ] += 1;

                    totalRequested +=
                        requested;

                    totalCovered +=
                        covered;

                    totalReserved +=
                        reserved;

                    totalShortage +=
                        shortage;

                    totalIssued +=
                        issued;

                    totalConsumed +=
                        consumed;

                    totalReturned +=
                        returned;

                    project.requested +=
                        requested;

                    project.covered +=
                        covered;

                    project.reserved +=
                        reserved;

                    project.shortage +=
                        shortage;

                    project.issued +=
                        issued;

                    project.consumed +=
                        consumed;

                    project.materialCount +=
                        1;

                    if (
                        healthKey ===
                        "waiting" ||
                        healthKey ===
                        "partial" ||
                        healthKey ===
                        "shortage"
                    ) {
                        project.attentionCount +=
                            1;
                    }

                    const category =
                        materialCategory(
                            line
                        );

                    const categoryRow =
                        categoryMap.get(
                            category
                        ) || {
                            category,
                            materialCount: 0,
                            requested: 0,
                            covered: 0,
                            shortage: 0,
                        };

                    categoryRow
                        .materialCount +=
                        1;

                    categoryRow
                        .requested +=
                        requested;

                    categoryRow.covered +=
                        covered;

                    categoryRow.shortage +=
                        shortage;

                    categoryMap.set(
                        category,
                        categoryRow
                    );

                    materialRows.push({
                        requisitionId:
                            requisition.id,

                        requisitionNumber:
                            requisition
                                .requisitionNumber,

                        projectCode:
                            requisition
                                .projectCode,

                        drawingNo:
                            requisition
                                .drawingNo,

                        materialId:
                            line.materialId,

                        materialCode:
                            line.materialCode,

                        materialName:
                            line.materialName,

                        category,

                        requested,
                        covered,
                        reserved,
                        shortage,
                        issued,
                        consumed,
                        returned,

                        healthKey,
                    });
                }

                projectMap.set(
                    projectKey,
                    project
                );
            }

            const categories =
                Array.from(
                    categoryMap.values()
                )
                    .map(
                        (category) => ({
                            ...category,

                            readinessPercent:
                                percentage(
                                    category
                                        .covered,
                                    category
                                        .requested
                                ),

                            shortagePercent:
                                percentage(
                                    category
                                        .shortage,
                                    category
                                        .requested
                                ),
                        })
                    )
                    .sort(
                        (
                            left,
                            right
                        ) =>
                            right.requested -
                            left.requested
                    );

            const projectHealth =
                Array.from(
                    projectMap.values()
                )
                    .map(
                        (project) => ({
                            ...project,

                            readinessPercent:
                                percentage(
                                    project
                                        .covered,
                                    project
                                        .requested
                                ),

                            shortagePercent:
                                percentage(
                                    project
                                        .shortage,
                                    project
                                        .requested
                                ),
                        })
                    )
                    .sort(
                        (
                            left,
                            right
                        ) => {
                            if (
                                left.attentionCount !==
                                right.attentionCount
                            ) {
                                return (
                                    right.attentionCount -
                                    left.attentionCount
                                );
                            }

                            return (
                                left.readinessPercent -
                                right.readinessPercent
                            );
                        }
                    );

            const topShortages =
                materialRows
                    .filter(
                        (row) =>
                            row.shortage >
                            0
                    )
                    .sort(
                        (
                            left,
                            right
                        ) =>
                            right.shortage -
                            left.shortage
                    )
                    .slice(
                        0,
                        6
                    );

            const staleProjects =
                projectHealth.filter(
                    (project) => {
                        if (
                            !project
                                .lastActivity ||
                            project
                                .readinessPercent >=
                            100
                        ) {
                            return false;
                        }

                        const age =
                            Date.now() -
                            new Date(
                                project
                                    .lastActivity
                            ).getTime();

                        return (
                            age >
                            48 *
                            60 *
                            60 *
                            1000
                        );
                    }
                ).length;

            return {
                materialRows,
                categories,
                projectHealth,
                topShortages,
                health,

                materialCount:
                    materialRows.length,

                attentionCount:
                    health.waiting +
                    health.partial +
                    health.shortage,

                staleProjects,

                totalRequested,
                totalCovered,
                totalReserved,
                totalShortage,
                totalIssued,
                totalConsumed,
                totalReturned,

                readinessPercent:
                    percentage(
                        totalCovered,
                        totalRequested
                    ),

                reservationPercent:
                    percentage(
                        totalReserved,
                        totalRequested
                    ),

                shortagePercent:
                    percentage(
                        totalShortage,
                        totalRequested
                    ),

                executionPercent:
                    percentage(
                        totalConsumed,
                        totalRequested
                    ),
            };
        }, [
            requisitions,
        ]);

    const plantOptions =
        useMemo(
            () =>
                Array.from(
                    new Set(
                        projectGroups
                            .map(
                                (project) =>
                                    clean(
                                        project.plantCode
                                    )
                            )
                            .filter(Boolean)
                    )
                ).sort(),
            [projectGroups]
        );

    const visibleProjects =
        useMemo(() => {
            const query =
                clean(search)
                    .toLowerCase();

            return projectGroups.filter(
                (project) => {
                    if (
                        plantFilter !==
                        "ALL" &&
                        normalize(
                            project.plantCode
                        ) !==
                        normalize(
                            plantFilter
                        )
                    ) {
                        return false;
                    }

                    if (
                        statusFilter !==
                        "ALL" &&
                        normalize(
                            project.projectStatus
                        ) !==
                        normalize(
                            statusFilter
                        )
                    ) {
                        return false;
                    }

                    if (
                        attentionOnly &&
                        project.attentionCount ===
                        0
                    ) {
                        return false;
                    }

                    if (!query) {
                        return true;
                    }

                    const projectMatch =
                        [
                            project.projectCode,
                            project.drawingNo,
                            project.plantCode,
                        ].some(
                            (value) =>
                                clean(value)
                                    .toLowerCase()
                                    .includes(
                                        query
                                    )
                        );

                    if (projectMatch) {
                        return true;
                    }

                    return project.requisitions
                        .some(
                            (
                                requisition
                            ) => {
                                const headerMatch =
                                    [
                                        requisition
                                            .requisitionNumber,
                                        requisition
                                            .bomNumber,
                                        requisition
                                            .destinationLocationCode,
                                    ].some(
                                        (
                                            value
                                        ) =>
                                            clean(
                                                value
                                            )
                                                .toLowerCase()
                                                .includes(
                                                    query
                                                )
                                    );

                                if (
                                    headerMatch
                                ) {
                                    return true;
                                }

                                return lineArray(
                                    requisition
                                ).some(
                                    (
                                        line
                                    ) =>
                                        [
                                            line.materialCode,
                                            line.materialName,
                                            line.materialCategorySnapshot,
                                        ].some(
                                            (
                                                value
                                            ) =>
                                                clean(
                                                    value
                                                )
                                                    .toLowerCase()
                                                    .includes(
                                                        query
                                                    )
                                        )
                                );
                            }
                        );
                }
            );
        }, [
            attentionOnly,
            plantFilter,
            projectGroups,
            search,
            statusFilter,
        ]);

    const kpis =
        useMemo(() => {
            return {
                projects:
                    projectGroups.length,

                requisitions:
                    requisitions.length,

                materials:
                    projectGroups.reduce(
                        (
                            total,
                            project
                        ) =>
                            total +
                            project.materialCount,
                        0
                    ),

                attention:
                    projectGroups.reduce(
                        (
                            total,
                            project
                        ) =>
                            total +
                            project.attentionCount,
                        0
                    ),

                shortage:
                    projectGroups.reduce(
                        (
                            total,
                            project
                        ) =>
                            total +
                            project.shortage,
                        0
                    ),

                reserved:
                    projectGroups.reduce(
                        (
                            total,
                            project
                        ) =>
                            total +
                            project.reserved,
                        0
                    ),
            };
        }, [
            projectGroups,
            requisitions.length,
        ]);

    if (loading) {
        return (
            <Box sx={loadingSx}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={pageSx}>
            <Box sx={heroSx}>
                <Box sx={heroRowSx}>
                    <Box>
                        <Chip
                            icon={
                                <TrackChangesOutlinedIcon />
                            }
                            label="MATFLOW CONTROL TOWER"
                            sx={heroBadgeSx}
                        />

                        <Typography sx={heroTitleSx}>
                            Project & Material Tracker
                        </Typography>

                        <Typography sx={heroSubSx}>
                            Track every project,
                            requisition and individual
                            material from approved BOM
                            demand through reservation,
                            shortage, transfer, issue,
                            consumption and return.
                        </Typography>
                    </Box>

                    <Button
                        startIcon={
                            <RefreshOutlinedIcon />
                        }
                        onClick={loadTracker}
                        sx={secondaryBtnSx}
                    >
                        Refresh
                    </Button>
                </Box>
            </Box>

            {error && (
                <Box sx={errorBoxSx}>
                    {error}
                </Box>
            )}

            <ExecutiveAnalytics
                analytics={analytics}
            />

            <TrackerInsights
                analytics={analytics}
                onOpenMaterial={(
                    row
                ) =>
                    navigate(
                        `/matflow/requisitions/${row.requisitionId}`
                    )
                }
            />

            <Box sx={kpiGridSx}>
                <Kpi
                    label="Projects"
                    value={kpis.projects}
                    icon={
                        <AccountTreeOutlinedIcon />
                    }
                />

                <Kpi
                    label="Requisitions"
                    value={
                        kpis.requisitions
                    }
                    icon={
                        <TrackChangesOutlinedIcon />
                    }
                />

                <Kpi
                    label="Material Lines"
                    value={kpis.materials}
                    icon={
                        <Inventory2OutlinedIcon />
                    }
                />

                <Kpi
                    label="Need Attention"
                    value={kpis.attention}
                    icon={
                        <WarningAmberOutlinedIcon />
                    }
                />

                <Kpi
                    label="Reserved Qty"
                    value={
                        formatQty(
                            kpis.reserved
                        )
                    }
                />

                <Kpi
                    label="Shortage Qty"
                    value={
                        formatQty(
                            kpis.shortage
                        )
                    }
                />
            </Box>

            <Card sx={panelSx}>
                <Box sx={filterGridSx}>
                    <TextField
                        label="Search"
                        value={search}
                        onChange={(event) =>
                            setSearch(
                                event.target.value
                            )
                        }
                        placeholder="Project, drawing, requisition, BOM or material"
                        sx={fieldSx}
                    />

                    <TextField
                        select
                        label="Plant"
                        value={plantFilter}
                        onChange={(event) =>
                            setPlantFilter(
                                event.target.value
                            )
                        }
                        sx={fieldSx}
                    >
                        <MenuItem value="ALL">
                            All Accessible Plants
                        </MenuItem>

                        {plantOptions.map(
                            (plant) => (
                                <MenuItem
                                    key={plant}
                                    value={plant}
                                >
                                    {plant}
                                </MenuItem>
                            )
                        )}
                    </TextField>

                    <TextField
                        select
                        label="Project Stage"
                        value={statusFilter}
                        onChange={(event) =>
                            setStatusFilter(
                                event.target.value
                            )
                        }
                        sx={fieldSx}
                    >
                        <MenuItem value="ALL">
                            All Stages
                        </MenuItem>

                        <MenuItem value="DRAFT">
                            Draft
                        </MenuItem>

                        <MenuItem value="WAITING_STORE">
                            Awaiting Store
                        </MenuItem>

                        <MenuItem value="SHORTAGE">
                            Shortage
                        </MenuItem>

                        <MenuItem value="PARTIAL_SHORTAGE">
                            Partial Shortage
                        </MenuItem>

                        <MenuItem value="RESERVED">
                            Reserved
                        </MenuItem>

                        <MenuItem value="ISSUED">
                            Issued
                        </MenuItem>

                        <MenuItem value="CONSUMED">
                            Consumed
                        </MenuItem>
                    </TextField>

                    <Box sx={attentionSwitchSx}>
                        <Switch
                            checked={
                                attentionOnly
                            }
                            onChange={(
                                event
                            ) =>
                                setAttentionOnly(
                                    event
                                        .target
                                        .checked
                                )
                            }
                        />

                        <Typography sx={switchLabelSx}>
                            Attention only
                        </Typography>
                    </Box>
                </Box>
            </Card>

            <Box sx={projectListSx}>
                {visibleProjects.length ===
                    0 ? (
                    <Card sx={emptySx}>
                        No project or material
                        matches the selected filters.
                    </Card>
                ) : (
                    visibleProjects.map(
                        (project) => (
                            <ProjectSection
                                key={
                                    project.key
                                }
                                project={
                                    project
                                }
                                expanded={
                                    Boolean(
                                        expandedProjects[
                                        project
                                            .key
                                        ]
                                    )
                                }
                                onToggle={() =>
                                    toggleProject(
                                        project.key
                                    )
                                }
                                expandedRequisitions={
                                    expandedRequisitions
                                }
                                planningByRequisition={
                                    planningByRequisition
                                }
                                onToggleRequisition={
                                    toggleRequisition
                                }
                                onOpenRequisition={(
                                    requisition
                                ) =>
                                    navigate(
                                        `/matflow/requisitions/${requisition.id}`
                                    )
                                }
                                onOpenPlanning={(
                                    requisition
                                ) =>
                                    navigate(
                                        `/matflow/store/requisitions/${requisition.id}`
                                    )
                                }
                            />
                        )
                    )
                )}
            </Box>
        </Box>
    );
}

function TrackerInsights({
    analytics,
    onOpenMaterial,
}) {
    return (
        <Box sx={insightGridSx}>
            <Card sx={insightCardSx}>
                <Box sx={insightHeaderSx}>
                    <Box>
                        <Typography sx={insightTitleSx}>
                            Shortage Hotspots
                        </Typography>

                        <Typography sx={insightSubSx}>
                            Highest individual material
                            shortages requiring immediate
                            Store or Purchase action.
                        </Typography>
                    </Box>

                    <Chip
                        label={`${analytics.topShortages.length} PRIORITIES`}
                        size="small"
                        sx={warningChipSx}
                    />
                </Box>

                <Box sx={insightListSx}>
                    {analytics
                        .topShortages
                        .length ===
                        0 ? (
                        <Box sx={positiveEmptySx}>
                            No material shortage is
                            currently recorded.
                        </Box>
                    ) : (
                        analytics
                            .topShortages
                            .map(
                                (
                                    row,
                                    index
                                ) => (
                                    <Box
                                        key={`${row.requisitionId}-${row.materialId}-${index}`}
                                        sx={hotspotRowSx}
                                    >
                                        <Box sx={rankSx}>
                                            {index +
                                                1}
                                        </Box>

                                        <Box sx={hotspotIdentitySx}>
                                            <Typography sx={hotspotTitleSx}>
                                                {row.materialName ||
                                                    row.materialCode ||
                                                    "-"}
                                            </Typography>

                                            <Typography sx={hotspotSubSx}>
                                                {row.materialCode ||
                                                    "-"}
                                                {" · "}
                                                {row.projectCode ||
                                                    "-"}
                                                {" · "}
                                                {row.drawingNo ||
                                                    "-"}
                                            </Typography>
                                        </Box>

                                        <Box sx={hotspotQtySx}>
                                            <Typography sx={hotspotQtyValueSx}>
                                                {formatQty(
                                                    row.shortage
                                                )}
                                            </Typography>

                                            <Typography sx={hotspotQtyLabelSx}>
                                                SHORT
                                            </Typography>
                                        </Box>

                                        <Button
                                            onClick={() =>
                                                onOpenMaterial(
                                                    row
                                                )
                                            }
                                            sx={miniActionSx}
                                        >
                                            Open
                                        </Button>
                                    </Box>
                                )
                            )
                    )}
                </Box>
            </Card>

            <Card sx={insightCardSx}>
                <Typography sx={insightTitleSx}>
                    Category Readiness
                </Typography>

                <Typography sx={insightSubSx}>
                    Material coverage and shortage by
                    BOM category.
                </Typography>

                <Box sx={categoryListSx}>
                    {analytics.categories
                        .slice(
                            0,
                            7
                        )
                        .map(
                            (category) => (
                                <Box
                                    key={
                                        category.category
                                    }
                                    sx={categoryRowSx}
                                >
                                    <Box sx={categoryHeadSx}>
                                        <Typography sx={categoryNameSx}>
                                            {readableCategory(
                                                category.category
                                            )}
                                        </Typography>

                                        <Typography sx={categoryValueSx}>
                                            {category.readinessPercent}
                                            %
                                        </Typography>
                                    </Box>

                                    <LinearProgress
                                        variant="determinate"
                                        value={
                                            category
                                                .readinessPercent
                                        }
                                        sx={categoryProgressSx(
                                            category.shortage >
                                                0
                                                ? "#f59e0b"
                                                : "#22c55e"
                                        )}
                                    />

                                    <Box sx={categoryFootSx}>
                                        <Typography sx={categoryNoteSx}>
                                            {category.materialCount}
                                            {" material"}
                                            {category.materialCount ===
                                                1
                                                ? ""
                                                : "s"}
                                        </Typography>

                                        <Typography sx={categoryNoteSx}>
                                            Short{" "}
                                            {formatQty(
                                                category.shortage
                                            )}
                                        </Typography>
                                    </Box>
                                </Box>
                            )
                        )}
                </Box>
            </Card>

            <Card sx={insightCardSx}>
                <Typography sx={insightTitleSx}>
                    Project Health Ranking
                </Typography>

                <Typography sx={insightSubSx}>
                    Projects with the greatest attention
                    requirement appear first.
                </Typography>

                <Box sx={projectHealthListSx}>
                    {analytics
                        .projectHealth
                        .slice(
                            0,
                            6
                        )
                        .map(
                            (project) => {
                                const healthColor =
                                    project
                                        .shortage >
                                        0
                                        ? "#f59e0b"
                                        : project
                                            .readinessPercent >=
                                            90
                                            ? "#22c55e"
                                            : "#60a5fa";

                                return (
                                    <Box
                                        key={
                                            project.projectKey
                                        }
                                        sx={projectHealthRowSx}
                                    >
                                        <Box sx={projectHealthIdentitySx}>
                                            <Typography sx={projectHealthTitleSx}>
                                                {project.projectCode}
                                            </Typography>

                                            <Typography sx={projectHealthSubSx}>
                                                {project.drawingNo}
                                                {" · "}
                                                {project.plantCode}
                                            </Typography>
                                        </Box>

                                        <Box sx={projectHealthProgressSx}>
                                            <Box sx={projectHealthProgressHeadSx}>
                                                <Typography sx={projectHealthNoteSx}>
                                                    Readiness
                                                </Typography>

                                                <Typography
                                                    sx={{
                                                        ...projectHealthPercentSx,
                                                        color:
                                                            healthColor,
                                                    }}
                                                >
                                                    {project.readinessPercent}
                                                    %
                                                </Typography>
                                            </Box>

                                            <LinearProgress
                                                variant="determinate"
                                                value={
                                                    project.readinessPercent
                                                }
                                                sx={categoryProgressSx(
                                                    healthColor
                                                )}
                                            />
                                        </Box>

                                        <Box sx={attentionBadgeSx}>
                                            <Typography sx={attentionValueSx}>
                                                {project.attentionCount}
                                            </Typography>

                                            <Typography sx={attentionLabelSx}>
                                                ATTENTION
                                            </Typography>
                                        </Box>
                                    </Box>
                                );
                            }
                        )}
                </Box>
            </Card>
        </Box>
    );
}

function ExecutiveAnalytics({
    analytics,
}) {
    const healthItems = [
        {
            key: "ready",
            label: "Ready",
            value:
                analytics.health
                    .ready,
            color: "#22c55e",
        },
        {
            key: "partial",
            label: "Partial",
            value:
                analytics.health
                    .partial,
            color: "#fb923c",
        },
        {
            key: "shortage",
            label: "Shortage",
            value:
                analytics.health
                    .shortage,
            color: "#ef4444",
        },
        {
            key: "waiting",
            label: "Waiting",
            value:
                analytics.health
                    .waiting,
            color: "#60a5fa",
        },
        {
            key: "inProcess",
            label: "In Process",
            value:
                analytics.health
                    .inProcess,
            color: "#a78bfa",
        },
    ];

    const healthTotal =
        healthItems.reduce(
            (total, item) =>
                total +
                item.value,
            0
        );

    return (
        <Box sx={executiveGridSx}>
            <Card sx={executiveCardSx}>
                <Typography sx={cardEyebrowSx}>
                    Overall Readiness
                </Typography>

                <Box sx={ringLayoutSx}>
                    <ProgressRing
                        value={
                            analytics
                                .readinessPercent
                        }
                        color="#22c55e"
                    />

                    <Box>
                        <Typography sx={ringTitleSx}>
                            Material Coverage
                        </Typography>

                        <Typography sx={ringSubSx}>
                            {formatQty(
                                analytics
                                    .totalCovered
                            )}
                            {" of "}
                            {formatQty(
                                analytics
                                    .totalRequested
                            )}
                            {" covered"}
                        </Typography>

                        <Typography sx={ringNoteSx}>
                            Uses reserved, issued,
                            consumed and returned
                            quantities without double
                            counting.
                        </Typography>
                    </Box>
                </Box>
            </Card>

            <Card sx={executiveCardSx}>
                <Typography sx={cardEyebrowSx}>
                    Material Flow Position
                </Typography>

                <FlowProgress
                    label="Reservation Coverage"
                    value={
                        analytics
                            .reservationPercent
                    }
                    quantity={`${formatQty(
                        analytics
                            .totalReserved
                    )} reserved`}
                    color="#60a5fa"
                />

                <FlowProgress
                    label="Production Execution"
                    value={
                        analytics
                            .executionPercent
                    }
                    quantity={`${formatQty(
                        analytics
                            .totalConsumed
                    )} consumed`}
                    color="#22d3ee"
                />

                <FlowProgress
                    label="Shortage Exposure"
                    value={
                        analytics
                            .shortagePercent
                    }
                    quantity={`${formatQty(
                        analytics
                            .totalShortage
                    )} short`}
                    color="#f59e0b"
                />
            </Card>

            <Card sx={executiveCardSx}>
                <Typography sx={cardEyebrowSx}>
                    Material Health
                </Typography>

                <Box sx={healthBarSx}>
                    {healthItems.map(
                        (item) => {
                            const width =
                                healthTotal >
                                    0
                                    ? (
                                        item.value /
                                        healthTotal
                                    ) *
                                    100
                                    : 0;

                            return (
                                <Tooltip
                                    key={
                                        item.key
                                    }
                                    title={`${item.label}: ${item.value}`}
                                >
                                    <Box
                                        sx={{
                                            width:
                                                `${width}%`,
                                            minWidth:
                                                item.value >
                                                    0
                                                    ? "5px"
                                                    : 0,
                                            background:
                                                item.color,
                                        }}
                                    />
                                </Tooltip>
                            );
                        }
                    )}
                </Box>

                <Box sx={healthLegendSx}>
                    {healthItems.map(
                        (item) => (
                            <Box
                                key={
                                    item.key
                                }
                                sx={healthLegendItemSx}
                            >
                                <Box
                                    sx={{
                                        ...legendDotSx,
                                        background:
                                            item.color,
                                    }}
                                />

                                <Box>
                                    <Typography sx={legendValueSx}>
                                        {item.value}
                                    </Typography>

                                    <Typography sx={legendLabelSx}>
                                        {item.label}
                                    </Typography>
                                </Box>
                            </Box>
                        )
                    )}
                </Box>
            </Card>

            <Card sx={exceptionCardSx}>
                <Typography sx={cardEyebrowSx}>
                    Exception Centre
                </Typography>

                <ExceptionMetric
                    label="Materials Need Attention"
                    value={
                        analytics
                            .attentionCount
                    }
                    color="#f59e0b"
                />

                <ExceptionMetric
                    label="Projects Inactive > 48 Hours"
                    value={
                        analytics
                            .staleProjects
                    }
                    color="#f87171"
                />

                <ExceptionMetric
                    label="Shortage Material Lines"
                    value={
                        analytics.health
                            .shortage +
                        analytics.health
                            .partial
                    }
                    color="#fb923c"
                />

                <ExceptionMetric
                    label="Waiting for Store Planning"
                    value={
                        analytics.health
                            .waiting
                    }
                    color="#60a5fa"
                />
            </Card>
        </Box>
    );
}

function ProgressRing({
    value,
    color,
}) {
    const safeValue =
        clampPercent(value);

    return (
        <Box
            sx={progressRingSx(
                safeValue,
                color
            )}
        >
            <Box sx={progressRingInnerSx}>
                <Typography sx={progressRingValueSx}>
                    {safeValue}%
                </Typography>

                <Typography sx={progressRingLabelSx}>
                    READY
                </Typography>
            </Box>
        </Box>
    );
}

function FlowProgress({
    label,
    value,
    quantity,
    color,
}) {
    return (
        <Box sx={flowProgressSx}>
            <Box sx={flowProgressHeadSx}>
                <Typography sx={flowLabelSx}>
                    {label}
                </Typography>

                <Typography sx={flowValueSx}>
                    {value}%
                </Typography>
            </Box>

            <LinearProgress
                variant="determinate"
                value={
                    clampPercent(
                        value
                    )
                }
                sx={executiveProgressSx(
                    color
                )}
            />

            <Typography sx={flowQuantitySx}>
                {quantity}
            </Typography>
        </Box>
    );
}

function ExceptionMetric({
    label,
    value,
    color,
}) {
    return (
        <Box sx={exceptionMetricSx}>
            <Box
                sx={{
                    ...exceptionIndicatorSx,
                    background:
                        color,
                    boxShadow:
                        `0 0 16px ${color}65`,
                }}
            />

            <Typography sx={exceptionLabelSx}>
                {label}
            </Typography>

            <Typography
                sx={{
                    ...exceptionValueSx,
                    color,
                }}
            >
                {value}
            </Typography>
        </Box>
    );
}

function ProjectSection({
    project,
    expanded,
    onToggle,
    expandedRequisitions,
    planningByRequisition,
    onToggleRequisition,
    onOpenRequisition,
    onOpenPlanning,
}) {
    const meta =
        statusMeta(
            project.projectStatus
        );

    return (
        <Card sx={projectCardSx}>
            <Box sx={projectHeaderSx}>
                <IconButton
                    onClick={onToggle}
                    sx={expandButtonSx}
                >
                    {expanded
                        ? (
                            <KeyboardArrowUpOutlinedIcon />
                        )
                        : (
                            <KeyboardArrowDownOutlinedIcon />
                        )}
                </IconButton>

                <Box sx={projectIdentitySx}>
                    <Typography sx={projectTitleSx}>
                        {project.projectCode}
                    </Typography>

                    <Typography sx={projectSubSx}>
                        Drawing{" "}
                        {project.drawingNo}
                        {" · "}
                        {project.plantCode}
                        {" · "}
                        {project.requisitions.length}
                        {" requisition"}
                        {project.requisitions.length ===
                            1
                            ? ""
                            : "s"}
                    </Typography>
                </Box>

                <Chip
                    label={meta.label}
                    size="small"
                    sx={statusChipSx(
                        meta.color
                    )}
                />

                <ProjectMetric
                    label="Materials"
                    value={
                        project.materialCount
                    }
                />

                <ProjectMetric
                    label="Requested"
                    value={
                        formatQty(
                            project.requested
                        )
                    }
                />

                <ProjectMetric
                    label="Reserved"
                    value={
                        formatQty(
                            project.reserved
                        )
                    }
                />

                <ProjectMetric
                    label="Shortage"
                    value={
                        formatQty(
                            project.shortage
                        )
                    }
                    alert={
                        project.shortage >
                        0
                    }
                />

                <ProjectMetric
                    label="Attention"
                    value={
                        project.attentionCount
                    }
                    alert={
                        project.attentionCount >
                        0
                    }
                />

                <Box sx={projectProgressSx}>
                    <Typography sx={progressLabelSx}>
                        Project Progress
                    </Typography>

                    <Typography sx={progressValueSx}>
                        {project.progress}%
                    </Typography>

                    <LinearProgress
                        variant="determinate"
                        value={
                            project.progress
                        }
                        sx={progressBarSx(
                            meta.color
                        )}
                    />
                </Box>

                <Box sx={projectAgeSx}>
                    <Typography sx={metricLabelSx}>
                        Last Activity
                    </Typography>

                    <Typography sx={metricValueSx}>
                        {formatAge(
                            project.lastActivity
                        )}
                    </Typography>
                </Box>
            </Box>

            <Collapse
                in={expanded}
                unmountOnExit
            >
                <Box sx={requisitionListSx}>
                    {project.requisitions.map(
                        (requisition) => (
                            <RequisitionSection
                                key={
                                    requisition.id
                                }
                                requisition={
                                    requisition
                                }
                                expanded={
                                    Boolean(
                                        expandedRequisitions[
                                        requisition
                                            .id
                                        ]
                                    )
                                }
                                planningState={
                                    planningByRequisition[
                                    requisition
                                        .id
                                    ] ||
                                    emptyPlanningState
                                }
                                onToggle={() =>
                                    onToggleRequisition(
                                        requisition
                                    )
                                }
                                onOpen={() =>
                                    onOpenRequisition(
                                        requisition
                                    )
                                }
                                onOpenPlanning={() =>
                                    onOpenPlanning(
                                        requisition
                                    )
                                }
                            />
                        )
                    )}
                </Box>
            </Collapse>
        </Card>
    );
}

function RequisitionSection({
    requisition,
    expanded,
    planningState,
    onToggle,
    onOpen,
    onOpenPlanning,
}) {
    const status =
        normalize(
            requisition.status
        );

    const meta =
        statusMeta(status);

    const lines =
        lineArray(
            requisition
        );

    return (
        <Box sx={requisitionCardSx}>
            <Box sx={requisitionHeaderSx}>
                <IconButton
                    onClick={onToggle}
                    sx={smallExpandSx}
                >
                    {expanded
                        ? (
                            <KeyboardArrowUpOutlinedIcon />
                        )
                        : (
                            <KeyboardArrowDownOutlinedIcon />
                        )}
                </IconButton>

                <Box sx={requisitionIdentitySx}>
                    <Typography sx={requisitionTitleSx}>
                        {requisition.requisitionNumber ||
                            "Material Requisition"}
                    </Typography>

                    <Typography sx={requisitionSubSx}>
                        {requisition.bomNumber}
                        {" · Rev "}
                        {requisition.bomRevisionNo}
                        {" · "}
                        {requisition.destinationLocationCode}
                    </Typography>
                </Box>

                <Chip
                    label={meta.label}
                    size="small"
                    sx={statusChipSx(
                        meta.color
                    )}
                />

                <ProjectMetric
                    label="Requested"
                    value={
                        formatQty(
                            sumLines(
                                requisition,
                                "requestedQty"
                            )
                        )
                    }
                />

                <ProjectMetric
                    label="Reserved"
                    value={
                        formatQty(
                            sumLines(
                                requisition,
                                "reservedQty"
                            )
                        )
                    }
                />

                <ProjectMetric
                    label="Shortage"
                    value={
                        formatQty(
                            sumLines(
                                requisition,
                                "shortageQty"
                            )
                        )
                    }
                    alert={
                        sumLines(
                            requisition,
                            "shortageQty"
                        ) > 0
                    }
                />

                <Box sx={requisitionActionsSx}>
                    <Button
                        startIcon={
                            <VisibilityOutlinedIcon />
                        }
                        onClick={onOpen}
                        sx={secondaryBtnSx}
                    >
                        Details
                    </Button>

                    {[
                        "SUBMITTED",
                        "SHORTAGE_PENDING",
                        "PLANNED",
                    ].includes(
                        status
                    ) && (
                            <Button
                                onClick={
                                    onOpenPlanning
                                }
                                sx={primaryBtnSx}
                            >
                                Planning
                            </Button>
                        )}
                </Box>
            </Box>

            <Collapse
                in={expanded}
                unmountOnExit
            >
                <Box sx={materialSectionSx}>
                    {planningState.loading && (
                        <Box sx={inlineLoadingSx}>
                            <CircularProgress
                                size={20}
                            />

                            Loading planning
                            movement details...
                        </Box>
                    )}

                    {planningState.error && (
                        <Box sx={errorBoxSx}>
                            {planningState.error}
                        </Box>
                    )}

                    <MaterialHeader />

                    {lines.map(
                        (line, index) => (
                            <MaterialRow
                                key={
                                    line.id ||
                                    index
                                }
                                line={line}
                                requisitionStatus={
                                    requisition.status
                                }
                                planning={
                                    materialPlanning(
                                        line,
                                        planningState
                                            .data
                                    )
                                }
                            />
                        )
                    )}
                </Box>
            </Collapse>
        </Box>
    );
}

function materialPlanning(
    line,
    snapshot
) {
    const lineId =
        String(
            line?.id || ""
        );

    const materialId =
        String(
            line?.materialId ||
            ""
        );

    const materialCode =
        normalize(
            line?.materialCode
        );

    const reservations =
        Array.isArray(
            snapshot?.reservations
        )
            ? snapshot.reservations.filter(
                (reservation) =>
                    String(
                        reservation
                            ?.requisitionLineId ||
                        ""
                    ) ===
                    lineId
            )
            : [];

    const indentLines =
        Array.isArray(
            snapshot?.indents
        )
            ? snapshot.indents.flatMap(
                (indent) =>
                    (
                        Array.isArray(
                            indent?.lines
                        )
                            ? indent.lines
                            : []
                    )
                        .filter(
                            (
                                indentLine
                            ) =>
                                String(
                                    indentLine
                                        ?.requisitionLineId ||
                                    ""
                                ) ===
                                lineId ||
                                (
                                    !indentLine
                                        ?.requisitionLineId &&
                                    (
                                        String(
                                            indentLine
                                                ?.materialId ||
                                            ""
                                        ) ===
                                        materialId ||
                                        normalize(
                                            indentLine
                                                ?.materialCode
                                        ) ===
                                        materialCode
                                    )
                                )
                        )
                        .map(
                            (
                                indentLine
                            ) => ({
                                ...indentLine,
                                indentId:
                                    indent.id,
                                indentNumber:
                                    indent.indentNumber,
                                indentStatus:
                                    indent.status,
                            })
                        )
            )
            : [];

    const transfers =
        Array.isArray(
            snapshot?.transfers
        )
            ? snapshot.transfers.filter(
                (transfer) =>
                    String(
                        transfer
                            ?.requisitionLineId ||
                        ""
                    ) ===
                    lineId ||
                    (
                        !transfer
                            ?.requisitionLineId &&
                        (
                            String(
                                transfer
                                    ?.materialId ||
                                ""
                            ) ===
                            materialId ||
                            normalize(
                                transfer
                                    ?.materialCode
                            ) ===
                            materialCode
                        )
                    )
            )
            : [];

    return {
        reservations,
        indentLines,
        transfers,
    };
}

function MaterialHeader() {
    return (
        <Box sx={materialHeaderSx}>
            <Box>Material</Box>
            <Box>BOM / Request</Box>
            <Box>Reservation</Box>
            <Box>Shortage / Purchase</Box>
            <Box>Movement</Box>
            <Box>Production</Box>
            <Box>Status</Box>
        </Box>
    );
}

function MaterialRow({
    line,
    requisitionStatus,
    planning,
}) {
    const stage =
        materialStage(
            line,
            requisitionStatus,
            planning
        );

    const meta =
        statusMeta(stage);

    const progress =
        materialProgress(stage);

    const reservedSources =
        planning.reservations
            .map(
                (reservation) =>
                    reservation
                        .sourceLocationCode
            )
            .filter(Boolean);

    const indentRequired =
        planning.indentLines
            .reduce(
                (total, item) =>
                    total +
                    numeric(
                        item.requiredQty
                    ),
                0
            );

    const indentOrdered =
        planning.indentLines
            .reduce(
                (total, item) =>
                    total +
                    numeric(
                        item.orderedQty
                    ),
                0
            );

    const indentReceived =
        planning.indentLines
            .reduce(
                (total, item) =>
                    total +
                    numeric(
                        item.receivedQty
                    ),
                0
            );

    const openTransfers =
        planning.transfers.filter(
            (transfer) =>
                openTransferStatuses.has(
                    normalize(
                        transfer.status
                    )
                )
        );

    return (
        <Box
            sx={{
                ...materialRowSx,

                ...(numeric(
                    line.shortageQty
                ) > 0
                    ? attentionRowSx
                    : {}),
            }}
        >
            <Box>
                <Typography sx={materialNameSx}>
                    {line.materialName ||
                        "-"}
                </Typography>

                <Typography sx={materialCodeSx}>
                    {line.materialCode ||
                        "-"}
                    {" · "}
                    {line.materialCategorySnapshot ||
                        line.materialCategory ||
                        "MISCELLANEOUS"}
                    {" · "}
                    {line.uom ||
                        "-"}
                </Typography>
            </Box>

            <Box>
                <QtyPair
                    label="BOM"
                    value={
                        line.bomRequiredQty
                    }
                />

                <QtyPair
                    label="Requested"
                    value={
                        line.requestedQty
                    }
                />
            </Box>

            <Box>
                <QtyPair
                    label="Reserved"
                    value={
                        line.reservedQty
                    }
                />

                <Typography sx={smallNoteSx}>
                    {reservedSources.length >
                        0
                        ? reservedSources.join(
                            ", "
                        )
                        : "No source allocated"}
                </Typography>
            </Box>

            <Box>
                <QtyPair
                    label="Shortage"
                    value={
                        line.shortageQty
                    }
                    alert={
                        numeric(
                            line.shortageQty
                        ) > 0
                    }
                />

                <QtyPair
                    label="Indent"
                    value={
                        indentRequired
                    }
                />

                <Typography sx={smallNoteSx}>
                    Ordered{" "}
                    {formatQty(
                        indentOrdered
                    )}
                    {" · Received "}
                    {formatQty(
                        indentReceived
                    )}
                </Typography>
            </Box>

            <Box>
                <QtyPair
                    label="Transfers"
                    value={
                        planning.transfers
                            .length
                    }
                />

                <Typography sx={smallNoteSx}>
                    {openTransfers.length >
                        0
                        ? `${openTransfers.length} open movement${openTransfers.length === 1 ? "" : "s"}`
                        : "No open movement"}
                </Typography>

                {planning.transfers
                    .slice(0, 2)
                    .map(
                        (transfer) => (
                            <Typography
                                key={
                                    transfer.id
                                }
                                sx={routeTextSx}
                            >
                                {transfer.fromLocationCode}
                                {" → "}
                                {transfer.toLocationCode}
                            </Typography>
                        )
                    )}
            </Box>

            <Box>
                <QtyPair
                    label="Issued"
                    value={
                        line.issuedQty
                    }
                />

                <QtyPair
                    label="Consumed"
                    value={
                        line.consumedQty
                    }
                />

                <QtyPair
                    label="Returned"
                    value={
                        line.returnedQty
                    }
                />
            </Box>

            <Box>
                <Chip
                    label={meta.label}
                    size="small"
                    sx={statusChipSx(
                        meta.color
                    )}
                />

                <Box sx={lineProgressHeadSx}>
                    <Typography sx={smallNoteSx}>
                        {progress}%
                    </Typography>
                </Box>

                <LinearProgress
                    variant="determinate"
                    value={progress}
                    sx={progressBarSx(
                        meta.color
                    )}
                />
            </Box>
        </Box>
    );
}

function Kpi({
    label,
    value,
    icon,
}) {
    return (
        <Card sx={kpiCardSx}>
            <Box sx={kpiIconSx}>
                {icon}
            </Box>

            <Box>
                <Typography sx={metricLabelSx}>
                    {label}
                </Typography>

                <Typography sx={kpiValueSx}>
                    {value}
                </Typography>
            </Box>
        </Card>
    );
}

function ProjectMetric({
    label,
    value,
    alert = false,
}) {
    return (
        <Box sx={metricBoxSx}>
            <Typography sx={metricLabelSx}>
                {label}
            </Typography>

            <Typography
                sx={{
                    ...metricValueSx,
                    color:
                        alert
                            ? "#f59e0b"
                            : "var(--mf-text)",
                }}
            >
                {value}
            </Typography>
        </Box>
    );
}

function QtyPair({
    label,
    value,
    alert = false,
}) {
    return (
        <Box sx={qtyPairSx}>
            <Typography sx={qtyLabelSx}>
                {label}
            </Typography>

            <Typography
                sx={{
                    ...qtyValueSx,
                    color:
                        alert
                            ? "#f59e0b"
                            : "var(--mf-text)",
                }}
            >
                {formatQty(value)}
            </Typography>
        </Box>
    );
}

const heroRowSx = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "14px",
    flexWrap: "wrap",
};

const kpiGridSx = {
    display: "grid",
    gridTemplateColumns:
        "repeat(6,minmax(0,1fr))",
    gap: "9px",

    "@media (max-width: 1250px)": {
        gridTemplateColumns:
            "repeat(3,minmax(0,1fr))",
    },

    "@media (max-width: 760px)": {
        gridTemplateColumns:
            "repeat(2,minmax(0,1fr))",
    },

    "@media (max-width: 480px)": {
        gridTemplateColumns:
            "1fr",
    },
};

const kpiCardSx = {
    ...panelSx,
    minHeight: "82px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    transition:
        "transform .18s ease, border-color .18s ease",

    "&:hover": {
        transform:
            "translateY(-1px)",
        borderColor:
            "var(--mf-border-strong)",
    },
};

const kpiIconSx = {
    width: "38px",
    height: "38px",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    borderRadius: "10px",
    color: "#2563eb",
    background:
        "rgba(59,130,246,.11)",
    border:
        "1px solid rgba(59,130,246,.24)",
};

const kpiValueSx = {
    mt: "3px",
    color:
        "var(--mf-text)",
    fontWeight: 950,
    fontSize: "21px",
    lineHeight: 1.1,
};

const filterGridSx = {
    display: "grid",
    gridTemplateColumns:
        "minmax(280px,2fr) minmax(170px,.8fr) minmax(210px,1fr) 160px",
    gap: "11px",
    alignItems: "center",

    "@media (max-width: 1050px)": {
        gridTemplateColumns:
            "1fr 1fr",
    },

    "@media (max-width: 700px)": {
        gridTemplateColumns:
            "1fr",
    },
};

const attentionSwitchSx = {
    minHeight: "44px",
    display: "flex",
    alignItems: "center",
    px: "6px",
    borderRadius: "9px",
    background:
        "var(--mf-surface-soft)",
    border:
        "1px solid var(--mf-border)",
};

const switchLabelSx = {
    color:
        "var(--mf-text-secondary)",
    fontSize: "11px",
    fontWeight: 800,
};

const projectListSx = {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
};

const projectCardSx = {
    ...panelSx,
    p: 0,
    overflow: "hidden",
    backgroundImage: "none",
};

const projectHeaderSx = {
    minWidth: "1220px",
    p: "12px",
    display: "grid",
    gridTemplateColumns:
        "38px minmax(200px,1.4fr) 155px repeat(5,minmax(82px,.55fr)) minmax(145px,.8fr) 92px",
    alignItems: "center",
    gap: "10px",
    overflowX: "auto",
    background:
        "var(--mf-panel-bg)",
};

const expandButtonSx = {
    width: "34px",
    height: "34px",
    color:
        "var(--mf-text-muted)",
    background:
        "var(--mf-field-bg)",
    border:
        "1px solid var(--mf-border)",

    "&:hover": {
        color:
            "var(--mf-text)",
        background:
            "var(--mf-hover)",
        borderColor:
            "var(--mf-border-strong)",
    },
};

const projectIdentitySx = {
    minWidth: 0,
};

const projectTitleSx = {
    color:
        "var(--mf-text)",
    fontSize: "15px",
    fontWeight: 950,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const projectSubSx = {
    mt: "3px",
    color:
        "var(--mf-text-muted)",
    fontSize: "9.5px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const projectProgressSx = {
    minWidth: "135px",
};

const projectAgeSx = {
    minWidth: "80px",
};

const metricBoxSx = {
    minWidth: "72px",
};

const metricLabelSx = {
    color:
        "var(--mf-text-muted)",
    fontSize: "8.5px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".04em",
};

const metricValueSx = {
    mt: "3px",
    color:
        "var(--mf-text)",
    fontSize: "11px",
    fontWeight: 900,
};

const executiveGridSx = {
    display: "grid",
    gridTemplateColumns:
        "repeat(4,minmax(0,1fr))",
    gap: "10px",

    "@media (max-width: 1200px)": {
        gridTemplateColumns:
            "repeat(2,minmax(0,1fr))",
    },

    "@media (max-width: 700px)": {
        gridTemplateColumns:
            "1fr",
    },
};

const executiveCardSx = {
    ...panelSx,
    minHeight: "190px",
    position: "relative",
    overflow: "hidden",

    "&::after": {
        content: '""',
        position: "absolute",
        width: "130px",
        height: "130px",
        right: "-55px",
        top: "-55px",
        borderRadius: "50%",
        background:
            "radial-gradient(circle,rgba(59,130,246,.14),transparent 68%)",
        pointerEvents: "none",
    },
};

const exceptionCardSx = {
    ...executiveCardSx,
    background:
        "linear-gradient(145deg,rgba(239,68,68,.07),var(--mf-panel-bg))",
    border:
        "1px solid rgba(239,68,68,.20)",
};

const cardEyebrowSx = {
    color:
        "var(--mf-text-muted)",
    fontSize: "9px",
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: ".08em",
};

const ringLayoutSx = {
    mt: "18px",
    display: "flex",
    alignItems: "center",
    gap: "17px",

    "@media (max-width: 430px)": {
        alignItems: "flex-start",
        flexDirection: "column",
    },
};

const progressRingSx = (
    value,
    color
) => {
    const angle =
        Math.min(
            360,
            Math.max(
                0,
                value * 3.6
            )
        );

    return {
        width: "112px",
        height: "112px",
        flex: "0 0 auto",
        display: "grid",
        placeItems: "center",
        borderRadius: "50%",
        background:
            `conic-gradient(
				${color} 0deg ${angle}deg,
				var(--mf-surface-strong) ${angle}deg 360deg
			)`,
        boxShadow:
            `0 0 28px ${color}22`,
    };
};

const progressRingInnerSx = {
    width: "82px",
    height: "82px",
    display: "grid",
    placeItems: "center",
    alignContent: "center",
    borderRadius: "50%",
    background:
        "var(--mf-panel-bg-solid)",
    border:
        "1px solid var(--mf-border)",
};

const progressRingValueSx = {
    color:
        "var(--mf-text)",
    fontSize: "22px",
    fontWeight: 950,
};

const progressRingLabelSx = {
    color:
        "var(--mf-text-muted)",
    fontSize: "8px",
    fontWeight: 900,
    letterSpacing: ".10em",
};

const ringTitleSx = {
    color:
        "var(--mf-text)",
    fontSize: "14px",
    fontWeight: 900,
};

const ringSubSx = {
    mt: "5px",
    color:
        "var(--mf-text-secondary)",
    fontSize: "10px",
    fontWeight: 750,
};

const ringNoteSx = {
    mt: "8px",
    maxWidth: "185px",
    color:
        "var(--mf-text-muted)",
    fontSize: "8.5px",
    lineHeight: 1.5,
};

const flowProgressSx = {
    mt: "15px",
};

const flowProgressHeadSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
};

const flowLabelSx = {
    color:
        "var(--mf-text-secondary)",
    fontSize: "9.5px",
    fontWeight: 850,
};

const flowValueSx = {
    color:
        "var(--mf-text)",
    fontSize: "10px",
    fontWeight: 950,
};

const flowQuantitySx = {
    mt: "4px",
    color:
        "var(--mf-text-muted)",
    fontSize: "8.5px",
};

const executiveProgressSx = (
    color
) => ({
    mt: "6px",
    height: "7px",
    borderRadius: 999,
    background:
        "var(--mf-surface-strong)",

    "& .MuiLinearProgress-bar": {
        background:
            `linear-gradient(90deg,${color},${color}aa)`,
        borderRadius: 999,
    },
});

const healthBarSx = {
    mt: "22px",
    height: "15px",
    display: "flex",
    overflow: "hidden",
    borderRadius: 999,
    background:
        "var(--mf-surface-strong)",
    border:
        "1px solid var(--mf-border)",
};

const healthLegendSx = {
    mt: "20px",
    display: "grid",
    gridTemplateColumns:
        "repeat(3,minmax(0,1fr))",
    gap: "12px",

    "@media (max-width: 430px)": {
        gridTemplateColumns:
            "repeat(2,minmax(0,1fr))",
    },
};

const healthLegendItemSx = {
    display: "flex",
    alignItems: "center",
    gap: "7px",
};

const legendDotSx = {
    width: "8px",
    height: "8px",
    flexShrink: 0,
    borderRadius: "50%",
};

const legendValueSx = {
    color:
        "var(--mf-text)",
    fontSize: "13px",
    fontWeight: 950,
};

const legendLabelSx = {
    color:
        "var(--mf-text-muted)",
    fontSize: "8px",
    fontWeight: 800,
};

const exceptionMetricSx = {
    mt: "13px",
    display: "grid",
    gridTemplateColumns:
        "8px minmax(0,1fr) auto",
    alignItems: "center",
    gap: "9px",
};

const exceptionIndicatorSx = {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
};

const exceptionLabelSx = {
    color:
        "var(--mf-text-secondary)",
    fontSize: "9.5px",
    fontWeight: 750,
};

const exceptionValueSx = {
    fontSize: "15px",
    fontWeight: 950,
};

const insightGridSx = {
    display: "grid",
    gridTemplateColumns:
        "1.25fr 1fr 1fr",
    gap: "10px",

    "@media (max-width: 1180px)": {
        gridTemplateColumns:
            "1fr 1fr",
    },

    "@media (max-width: 760px)": {
        gridTemplateColumns:
            "1fr",
    },
};

const insightCardSx = {
    ...panelSx,
    minHeight: "300px",
    overflow: "hidden",
};

const insightHeaderSx = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "10px",
};

const insightTitleSx = {
    color:
        "var(--mf-text)",
    fontSize: "14px",
    fontWeight: 950,
};

const insightSubSx = {
    mt: "3px",
    color:
        "var(--mf-text-muted)",
    fontSize: "8.5px",
    lineHeight: 1.5,
};

const warningChipSx = {
    height: "23px",
    flexShrink: 0,
    color: "#d97706",
    background:
        "rgba(245,158,11,.10)",
    border:
        "1px solid rgba(245,158,11,.25)",
    fontSize: "8px",
    fontWeight: 900,
};

const insightListSx = {
    mt: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "7px",
};

const hotspotRowSx = {
    p: "8px",
    display: "grid",
    gridTemplateColumns:
        "27px minmax(0,1fr) 65px 52px",
    alignItems: "center",
    gap: "8px",
    borderRadius: "8px",
    background:
        "var(--mf-surface-soft)",
    border:
        "1px solid var(--mf-border)",

    "@media (max-width: 460px)": {
        gridTemplateColumns:
            "27px minmax(0,1fr) 55px",

        "& .MuiButton-root": {
            gridColumn: "2 / -1",
            justifySelf: "flex-end",
        },
    },
};

const rankSx = {
    width: "25px",
    height: "25px",
    display: "grid",
    placeItems: "center",
    borderRadius: "7px",
    color: "#d97706",
    background:
        "rgba(245,158,11,.10)",
    fontSize: "9px",
    fontWeight: 950,
};

const hotspotIdentitySx = {
    minWidth: 0,
};

const hotspotTitleSx = {
    color:
        "var(--mf-text)",
    fontSize: "10px",
    fontWeight: 850,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const hotspotSubSx = {
    mt: "2px",
    color:
        "var(--mf-text-muted)",
    fontSize: "8px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const hotspotQtySx = {
    textAlign: "right",
};

const hotspotQtyValueSx = {
    color: "#d97706",
    fontSize: "11px",
    fontWeight: 950,
};

const hotspotQtyLabelSx = {
    color:
        "var(--mf-text-muted)",
    fontSize: "7px",
    fontWeight: 900,
};

const miniActionSx = {
    minWidth: "46px",
    height: "25px",
    px: "8px",
    color: "#0284c7",
    fontSize: "8px",
    fontWeight: 900,
    background:
        "var(--mf-field-bg)",
    border:
        "1px solid rgba(2,132,199,.25)",

    "&:hover": {
        background:
            "rgba(2,132,199,.09)",
    },
};

const positiveEmptySx = {
    p: "20px",
    color: "#16a34a",
    textAlign: "center",
    fontSize: "10px",
    fontWeight: 750,
    borderRadius: "9px",
    background:
        "rgba(34,197,94,.07)",
    border:
        "1px dashed rgba(34,197,94,.22)",
};

const categoryListSx = {
    mt: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
};

const categoryRowSx = {
    minWidth: 0,
};

const categoryHeadSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
};

const categoryNameSx = {
    color:
        "var(--mf-text-secondary)",
    fontSize: "9.5px",
    fontWeight: 850,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const categoryValueSx = {
    color:
        "var(--mf-text)",
    fontSize: "9.5px",
    fontWeight: 950,
};

const categoryProgressSx = (
    color
) => ({
    mt: "6px",
    height: "6px",
    borderRadius: 999,
    background:
        "var(--mf-surface-strong)",

    "& .MuiLinearProgress-bar": {
        backgroundColor:
            color,
        borderRadius: 999,
    },
});

const categoryFootSx = {
    mt: "4px",
    display: "flex",
    justifyContent: "space-between",
    gap: "8px",
};

const categoryNoteSx = {
    color:
        "var(--mf-text-muted)",
    fontSize: "7.5px",
};

const projectHealthListSx = {
    mt: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
};

const projectHealthRowSx = {
    p: "8px",
    display: "grid",
    gridTemplateColumns:
        "minmax(95px,.8fr) minmax(100px,1fr) 54px",
    alignItems: "center",
    gap: "9px",
    borderRadius: "8px",
    background:
        "var(--mf-surface-soft)",
    border:
        "1px solid var(--mf-border)",
};

const projectHealthIdentitySx = {
    minWidth: 0,
};

const projectHealthTitleSx = {
    color:
        "var(--mf-text)",
    fontSize: "10px",
    fontWeight: 900,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const projectHealthSubSx = {
    mt: "2px",
    color:
        "var(--mf-text-muted)",
    fontSize: "7.5px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const projectHealthProgressSx = {
    minWidth: 0,
};

const projectHealthProgressHeadSx = {
    display: "flex",
    justifyContent: "space-between",
    gap: "6px",
};

const projectHealthNoteSx = {
    color:
        "var(--mf-text-muted)",
    fontSize: "7.5px",
};

const projectHealthPercentSx = {
    fontSize: "8px",
    fontWeight: 950,
};

const attentionBadgeSx = {
    textAlign: "center",
};

const attentionValueSx = {
    color: "#d97706",
    fontSize: "12px",
    fontWeight: 950,
};

const attentionLabelSx = {
    color:
        "var(--mf-text-muted)",
    fontSize: "6.5px",
    fontWeight: 900,
};

const progressLabelSx = {
    color:
        "var(--mf-text-muted)",
    fontSize: "8.5px",
    fontWeight: 900,
    textTransform: "uppercase",
};

const progressValueSx = {
    mt: "2px",
    color:
        "var(--mf-text)",
    fontSize: "10px",
    fontWeight: 900,
};

const progressBarSx = (
    color
) => ({
    mt: "5px",
    height: "6px",
    borderRadius: 999,
    background:
        "var(--mf-surface-strong)",

    "& .MuiLinearProgress-bar": {
        backgroundColor:
            color,
        borderRadius: 999,
    },
});

const statusChipSx = (
    color
) => ({
    height: "24px",
    maxWidth: "160px",
    color,
    background:
        `${color}16`,
    border:
        `1px solid ${color}38`,
    fontSize: "8.5px",
    fontWeight: 900,

    "& .MuiChip-label": {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
});

const requisitionListSx = {
    p: "10px",
    pt: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    background:
        "var(--mf-panel-bg)",
};

const requisitionCardSx = {
    borderRadius: "10px",
    background:
        "var(--mf-surface-soft)",
    border:
        "1px solid var(--mf-border)",
    overflow: "hidden",
};

const requisitionHeaderSx = {
    minWidth: "940px",
    p: "10px",
    display: "grid",
    gridTemplateColumns:
        "34px minmax(220px,1.4fr) 145px repeat(3,90px) minmax(185px,auto)",
    alignItems: "center",
    gap: "10px",
    overflowX: "auto",
};

const smallExpandSx = {
    width: "32px",
    height: "32px",
    color:
        "var(--mf-text-muted)",
    border:
        "1px solid transparent",

    "&:hover": {
        color:
            "var(--mf-text)",
        background:
            "var(--mf-hover)",
        borderColor:
            "var(--mf-border)",
    },
};

const requisitionIdentitySx = {
    minWidth: 0,
};

const requisitionTitleSx = {
    color:
        "var(--mf-text)",
    fontSize: "12px",
    fontWeight: 900,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const requisitionSubSx = {
    mt: "2px",
    color:
        "var(--mf-text-muted)",
    fontSize: "9px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const requisitionActionsSx = {
    display: "flex",
    gap: "7px",
    justifyContent: "flex-end",
};

const materialSectionSx = {
    p: "10px",
    pt: 0,
    overflowX: "auto",
};

const materialColumns =
    "minmax(240px,1.5fr) 130px 150px 180px 190px 150px 165px";

const materialHeaderSx = {
    minWidth: "1180px",
    display: "grid",
    gridTemplateColumns:
        materialColumns,
    gap: "10px",
    p: "9px",
    color:
        "var(--mf-text-muted)",
    background:
        "var(--mf-surface-strong)",
    border:
        "1px solid var(--mf-border)",
    borderRadius: "8px 8px 0 0",
    fontSize: "8.5px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".04em",
};

const materialRowSx = {
    minWidth: "1180px",
    display: "grid",
    gridTemplateColumns:
        materialColumns,
    gap: "10px",
    p: "10px 9px",
    alignItems: "start",
    color:
        "var(--mf-text-secondary)",
    background:
        "var(--mf-panel-bg)",
    borderLeft:
        "1px solid var(--mf-border)",
    borderRight:
        "1px solid var(--mf-border)",
    borderBottom:
        "1px solid var(--mf-border)",

    "&:hover": {
        background:
            "var(--mf-hover)",
    },
};

const attentionRowSx = {
    background:
        "rgba(245,158,11,.065)",
    borderLeft:
        "3px solid rgba(245,158,11,.78)",
};

const materialNameSx = {
    color:
        "var(--mf-text)",
    fontSize: "11.5px",
    fontWeight: 900,
    lineHeight: 1.35,
    overflowWrap: "anywhere",
};

const materialCodeSx = {
    mt: "3px",
    color:
        "var(--mf-text-muted)",
    fontSize: "9px",
    lineHeight: 1.4,
    overflowWrap: "anywhere",
};

const qtyPairSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    mb: "3px",
};

const qtyLabelSx = {
    color:
        "var(--mf-text-muted)",
    fontSize: "8.5px",
    fontWeight: 850,
};

const qtyValueSx = {
    color:
        "var(--mf-text)",
    fontSize: "10px",
    fontWeight: 900,
};

const smallNoteSx = {
    mt: "4px",
    color:
        "var(--mf-text-muted)",
    fontSize: "8.5px",
    lineHeight: 1.4,
    overflowWrap: "anywhere",
};

const routeTextSx = {
    mt: "3px",
    color: "#8b5cf6",
    fontSize: "8.5px",
    fontWeight: 750,
    lineHeight: 1.35,
};

const lineProgressHeadSx = {
    mt: "7px",
    display: "flex",
    justifyContent: "flex-end",
};

const inlineLoadingSx = {
    mb: "9px",
    display: "flex",
    alignItems: "center",
    gap: "9px",
    color:
        "var(--mf-text-muted)",
    fontSize: "10px",
};

const emptySx = {
    ...panelSx,
    p: "30px",
    textAlign: "center",
    color:
        "var(--mf-text-muted)",
};