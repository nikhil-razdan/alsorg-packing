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
                            : "#fff",
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
                            : "#fff",
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

    "@media (max-width: 1150px)": {
        gridTemplateColumns:
            "repeat(3,minmax(0,1fr))",
    },

    "@media (max-width: 650px)": {
        gridTemplateColumns:
            "1fr",
    },
};

const kpiCardSx = {
    ...panelSx,
    display: "flex",
    alignItems: "center",
    gap: "10px",
};

const kpiIconSx = {
    width: "36px",
    height: "36px",
    display: "grid",
    placeItems: "center",
    borderRadius: "10px",
    color: "#60a5fa",
    background:
        "rgba(96,165,250,.12)",
    border:
        "1px solid rgba(96,165,250,.25)",
};

const kpiValueSx = {
    mt: "3px",
    color: "#fff",
    fontWeight: 950,
    fontSize: "21px",
};

const filterGridSx = {
    display: "grid",
    gridTemplateColumns:
        "minmax(280px,2fr) minmax(170px,.8fr) minmax(210px,1fr) 160px",
    gap: "11px",
    alignItems: "center",

    "@media (max-width: 900px)": {
        gridTemplateColumns:
            "1fr",
    },
};

const attentionSwitchSx = {
    display: "flex",
    alignItems: "center",
    minHeight: "48px",
};

const switchLabelSx = {
    color:
        "rgba(255,255,255,.70)",
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
};

const projectHeaderSx = {
    p: "12px",
    display: "grid",
    gridTemplateColumns:
        "38px minmax(200px,1.4fr) 155px repeat(5,minmax(82px,.55fr)) minmax(145px,.8fr) 92px",
    alignItems: "center",
    gap: "10px",
    overflowX: "auto",
};

const expandButtonSx = {
    color: "#94a3b8",
    border:
        "1px solid rgba(255,255,255,.08)",
};

const projectIdentitySx = {
    minWidth: 0,
};

const projectTitleSx = {
    color: "#fff",
    fontSize: "15px",
    fontWeight: 950,
};

const projectSubSx = {
    mt: "3px",
    color:
        "rgba(255,255,255,.48)",
    fontSize: "9.5px",
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
        "rgba(255,255,255,.42)",
    fontSize: "8.5px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".04em",
};

const metricValueSx = {
    mt: "3px",
    color: "#fff",
    fontSize: "11px",
    fontWeight: 900,
};

const progressLabelSx = {
    color:
        "rgba(255,255,255,.42)",
    fontSize: "8.5px",
    fontWeight: 900,
    textTransform: "uppercase",
};

const progressValueSx = {
    mt: "2px",
    color: "#fff",
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
        "rgba(255,255,255,.07)",

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
});

const requisitionListSx = {
    p: "10px",
    pt: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
};

const requisitionCardSx = {
    borderRadius: "10px",
    background:
        "rgba(2,6,23,.34)",
    border:
        "1px solid rgba(255,255,255,.07)",
    overflow: "hidden",
};

const requisitionHeaderSx = {
    p: "10px",
    display: "grid",
    gridTemplateColumns:
        "34px minmax(220px,1.4fr) 145px repeat(3,90px) minmax(185px,auto)",
    alignItems: "center",
    gap: "10px",
    overflowX: "auto",
};

const smallExpandSx = {
    color: "#94a3b8",
};

const requisitionIdentitySx = {
    minWidth: 0,
};

const requisitionTitleSx = {
    color: "#fff",
    fontSize: "12px",
    fontWeight: 900,
};

const requisitionSubSx = {
    mt: "2px",
    color:
        "rgba(255,255,255,.45)",
    fontSize: "9px",
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
        "rgba(255,255,255,.45)",
    background:
        "rgba(15,23,42,.72)",
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
    borderBottom:
        "1px solid rgba(255,255,255,.055)",
    background:
        "rgba(2,6,23,.24)",
};

const attentionRowSx = {
    background:
        "rgba(245,158,11,.055)",
    borderLeft:
        "3px solid rgba(245,158,11,.75)",
};

const materialNameSx = {
    color: "#fff",
    fontSize: "11.5px",
    fontWeight: 900,
};

const materialCodeSx = {
    mt: "3px",
    color:
        "rgba(255,255,255,.45)",
    fontSize: "9px",
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
        "rgba(255,255,255,.42)",
    fontSize: "8.5px",
    fontWeight: 850,
};

const qtyValueSx = {
    color: "#fff",
    fontSize: "10px",
    fontWeight: 900,
};

const smallNoteSx = {
    mt: "4px",
    color:
        "rgba(255,255,255,.43)",
    fontSize: "8.5px",
    lineHeight: 1.4,
};

const routeTextSx = {
    mt: "3px",
    color:
        "rgba(167,139,250,.90)",
    fontSize: "8.5px",
    fontWeight: 750,
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
        "rgba(255,255,255,.55)",
    fontSize: "10px",
};

const emptySx = {
    ...panelSx,
    p: "30px",
    textAlign: "center",
    color:
        "rgba(255,255,255,.52)",
};