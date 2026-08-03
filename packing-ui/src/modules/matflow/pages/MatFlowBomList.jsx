import {
    useCallback,
    useEffect,
    useState,
} from "react";

import {
    Box,
    Button,
    Card,
    Chip,
    CircularProgress,
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";

import AddIcon
    from "@mui/icons-material/Add";

import RefreshIcon
    from "@mui/icons-material/Refresh";

import SearchIcon
    from "@mui/icons-material/Search";

import VisibilityOutlinedIcon
    from "@mui/icons-material/VisibilityOutlined";

import {
    useNavigate,
} from "react-router-dom";

import {
    useAuth,
} from "../../../auth/AuthContext";

import {
    canAccessMatFlowScreen,
    getMatFlowRole,
    MATFLOW_ROLES,
} from "../../../utils/matflowAccess";

import {
    extractMatFlowPage,
    matflowApi,
    readMatFlowError,
} from "../api/matflowApi";

import MatFlowStatusChip
    from "../components/MatFlowStatusChip";

import {
    emptySx,
    errorBoxSx,
    fieldSx,
    heroBadgeSx,
    heroSubSx,
    heroSx,
    heroTitleSx,
    loadingSx,
    mainTextSx,
    pageSx,
    pageTextSx,
    panelSx,
    primaryBtnSx,
    secondaryBtnSx,
    sectionSubSx,
    sectionTitleSx,
    subTextSx,
    tableCellSx,
    tableHeaderSx,
    tableRowSx,
    tableShellSx,
} from "../matflowTheme";

const STATUS_OPTIONS = [
    "",
    "DRAFT",
    "SUBMITTED",
    "PRODUCTION_REVIEW_PENDING",
    "APPROVED",
    "RETURNED",
    "SUPERSEDED",
];

const normalizeStatus = (
    value
) =>
    String(
        value ?? ""
    )
        .trim()
        .toUpperCase();

const readableStatus = (
    value
) =>
    normalizeStatus(value)
        .toLowerCase()
        .split("_")
        .filter(Boolean)
        .map(
            (part) =>
                part.charAt(0)
                    .toUpperCase() +
                part.slice(1)
        )
        .join(" ");

const resolveBomWorkflow = (
    bom
) => {
    const status =
        normalizeStatus(
            bom?.status
        );

    switch (status) {
        case "DRAFT":
            return {
                department:
                    "Engineering",
                action:
                    "Add materials and submit",
                color:
                    "#2563eb",
            };

        case "RETURNED":
            return {
                department:
                    "Engineering",
                action:
                    "Correct and resubmit",
                color:
                    "#dc2626",
            };

        case "SUBMITTED":
        case "SUBMITTED_TO_HOD":
            return {
                department:
                    "HOD / Manager",
                action:
                    "Approve or return BOM",
                color:
                    "#d97706",
            };

        case "PRODUCTION_REVIEW_PENDING":
            return {
                department:
                    "Production",
                action:
                    "Review manufacturing suitability",
                color:
                    "#7c3aed",
            };

        case "APPROVED":
            if (
                bom?.effective !==
                true
            ) {
                return {
                    department:
                        "MatFlow Manager",
                    action:
                        "Resolve inactive approval",
                    color:
                        "#dc2626",
                };
            }

            if (
                bom?.latestRevision ===
                false
            ) {
                return {
                    department:
                        "Engineering",
                    action:
                        "Use latest BOM revision",
                    color:
                        "#64748b",
                };
            }

            return {
                department:
                    "Store / Production",
                action:
                    "Raise material requisition",
                color:
                    "#16a34a",
            };

        case "SUPERSEDED":
            return {
                department:
                    "Engineering",
                action:
                    "Use latest effective revision",
                color:
                    "#64748b",
            };

        default:
            return {
                department:
                    "MatFlow",
                action:
                    "Open and review record",
                color:
                    "#64748b",
            };
    }
};

const actionLabelForStatus = (
    status
) => {
    const normalized =
        normalizeStatus(
            status
        );

    if (
        [
            "SUBMITTED",
            "SUBMITTED_TO_HOD",
            "PRODUCTION_REVIEW_PENDING",
        ].includes(
            normalized
        )
    ) {
        return "Review";
    }

    return "Open";
};

export default function MatFlowBomList() {
    const navigate =
        useNavigate();

    const {
        role,
        user,
    } = useAuth();

    const cleanRole =
        getMatFlowRole(
            role ||
            user?.role
        );

    const canCreate =
        canAccessMatFlowScreen(
            "bom-create",
            cleanRole
        ) ||
        [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.ENGINEERING,
        ].includes(
            cleanRole
        );

    const [
        rows,
        setRows,
    ] = useState([]);

    const [
        loading,
        setLoading,
    ] = useState(true);

    const [
        error,
        setError,
    ] = useState("");

    const [
        filters,
        setFilters,
    ] = useState({
        search: "",
        plantCode: "",
        status: "",
    });

    const [
        appliedFilters,
        setAppliedFilters,
    ] = useState({
        search: "",
        plantCode: "",
        status: "",
    });

    const [
        page,
        setPage,
    ] = useState(0);

    const [
        totalPages,
        setTotalPages,
    ] = useState(0);

    const [
        totalElements,
        setTotalElements,
    ] = useState(0);

    const size = 25;

    const load =
        useCallback(
            async () => {
                setLoading(true);
                setError("");

                try {
                    /*
                     * A superseded revision is normally no longer
                     * the latest revision. Therefore latestOnly must
                     * be disabled when explicitly filtering for it.
                     */
                    const latestOnly =
                        appliedFilters.status ===
                            "SUPERSEDED"
                            ? false
                            : true;

                    const response =
                        await matflowApi
                            .listBoms({
                                page,
                                size,

                                search:
                                    appliedFilters.search ||
                                    undefined,

                                plantCode:
                                    appliedFilters.plantCode ||
                                    undefined,

                                status:
                                    appliedFilters.status ||
                                    undefined,

                                latestOnly,
                            });

                    const result =
                        extractMatFlowPage(
                            response?.data
                        );

                    setRows(
                        Array.isArray(
                            result.rows
                        )
                            ? result.rows
                            : []
                    );

                    setTotalPages(
                        Number.isFinite(
                            Number(
                                result.totalPages
                            )
                        )
                            ? Number(
                                result.totalPages
                            )
                            : 0
                    );

                    setTotalElements(
                        Number.isFinite(
                            Number(
                                result.totalElements
                            )
                        )
                            ? Number(
                                result.totalElements
                            )
                            : 0
                    );
                } catch (
                requestError
                ) {
                    setRows([]);
                    setTotalPages(0);
                    setTotalElements(0);

                    setError(
                        readMatFlowError(
                            requestError,
                            "Unable to load operational BOMs."
                        )
                    );
                } finally {
                    setLoading(false);
                }
            },
            [
                appliedFilters,
                page,
                size,
            ]
        );

    useEffect(() => {
        load();
    }, [load]);

    const updateFilter = (
        key,
        value
    ) => {
        setFilters(
            (current) => ({
                ...current,
                [key]: value,
            })
        );
    };

    const applyFilters = () => {
        setPage(0);

        setAppliedFilters({
            search:
                String(
                    filters.search ??
                    ""
                ).trim(),

            plantCode:
                String(
                    filters.plantCode ??
                    ""
                )
                    .trim()
                    .toUpperCase(),

            status:
                normalizeStatus(
                    filters.status
                ),
        });
    };

    const resetFilters = () => {
        const cleared = {
            search: "",
            plantCode: "",
            status: "",
        };

        setFilters(
            cleared
        );

        setAppliedFilters(
            cleared
        );

        setPage(0);
    };

    const handleSearchKeyDown = (
        event
    ) => {
        if (
            event.key ===
            "Enter"
        ) {
            applyFilters();
        }
    };

    return (
        <Box sx={pageSx}>
            <Box sx={heroSx}>
                <Box sx={headerRowSx}>
                    <Box>
                        <Chip
                            label="OPERATIONAL BOM CONTROL"
                            sx={heroBadgeSx}
                        />

                        <Typography sx={heroTitleSx}>
                            Operational BOMs
                        </Typography>

                        <Typography sx={heroSubSx}>
                            Manage project-specific
                            operational BOMs, their revisions,
                            HOD approval and Production review.
                            MatFlow BOMs remain independent
                            from the BOMFlow costing module.
                        </Typography>
                    </Box>

                    {canCreate && (
                        <Button
                            startIcon={
                                <AddIcon />
                            }
                            onClick={() =>
                                navigate(
                                    "/matflow/boms/new"
                                )
                            }
                            sx={primaryBtnSx}
                        >
                            Create BOM
                        </Button>
                    )}
                </Box>
            </Box>

            <Card sx={panelSx}>
                <Box sx={filterGridSx}>
                    <TextField
                        label="Search"
                        placeholder="BOM, PD, drawing or product..."
                        value={
                            filters.search
                        }
                        onChange={(event) =>
                            updateFilter(
                                "search",
                                event.target.value
                            )
                        }
                        onKeyDown={
                            handleSearchKeyDown
                        }
                        sx={fieldSx}
                    />

                    <TextField
                        label="Plant"
                        placeholder="Plant code..."
                        value={
                            filters.plantCode
                        }
                        onChange={(event) =>
                            updateFilter(
                                "plantCode",
                                event.target.value
                            )
                        }
                        onKeyDown={
                            handleSearchKeyDown
                        }
                        sx={fieldSx}
                    />

                    <TextField
                        select
                        label="Status"
                        value={
                            filters.status
                        }
                        onChange={(event) =>
                            updateFilter(
                                "status",
                                event.target.value
                            )
                        }
                        sx={fieldSx}
                    >
                        {STATUS_OPTIONS.map(
                            (status) => (
                                <MenuItem
                                    key={
                                        status ||
                                        "ALL"
                                    }
                                    value={status}
                                >
                                    {status
                                        ? readableStatus(
                                            status
                                        )
                                        : "All Statuses"}
                                </MenuItem>
                            )
                        )}
                    </TextField>

                    <Box sx={filterActionsSx}>
                        <Button
                            startIcon={
                                <SearchIcon />
                            }
                            onClick={
                                applyFilters
                            }
                            disabled={loading}
                            sx={primaryBtnSx}
                        >
                            Search
                        </Button>

                        <Button
                            startIcon={
                                <RefreshIcon />
                            }
                            onClick={
                                resetFilters
                            }
                            disabled={loading}
                            sx={secondaryBtnSx}
                        >
                            Reset
                        </Button>
                    </Box>
                </Box>
            </Card>

            {error && (
                <Box sx={errorBoxSx}>
                    {error}
                </Box>
            )}

            <Card sx={panelSx}>
                <Box sx={resultHeaderSx}>
                    <Box>
                        <Typography sx={sectionTitleSx}>
                            BOM Register
                        </Typography>

                        <Typography sx={sectionSubSx}>
                            {totalElements}
                            {" operational BOM record"}
                            {totalElements ===
                                1
                                ? ""
                                : "s"}
                        </Typography>
                    </Box>

                    <Button
                        startIcon={
                            <RefreshIcon />
                        }
                        onClick={load}
                        disabled={loading}
                        sx={secondaryBtnSx}
                    >
                        Refresh
                    </Button>
                </Box>

                {loading ? (
                    <Box sx={loadingSx}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Box sx={tableShellSx}>
                        <Box sx={bomHeaderSx}>
                            <Box sx={tableCellSx}>
                                BOM / Revision
                            </Box>

                            <Box sx={tableCellSx}>
                                PD / Drawing
                            </Box>

                            <Box sx={tableCellSx}>
                                Product
                            </Box>

                            <Box sx={tableCellSx}>
                                Plant
                            </Box>

                            <Box sx={tableCellSx}>
                                Lines
                            </Box>

                            <Box sx={tableCellSx}>
                                Status
                            </Box>

                            <Box sx={tableCellSx}>
                                Effective
                            </Box>

                            <Box sx={tableCellSx}>
                                Responsible / Next Action
                            </Box>

                            <Box sx={tableCellSx}>
                                Action
                            </Box>
                        </Box>

                        {rows.length ===
                            0 ? (
                            <Box sx={emptySx}>
                                No operational BOMs were found.
                            </Box>
                        ) : (
                            rows.map(
                                (row) => {
                                    const workflow =
                                        resolveBomWorkflow(
                                            row
                                        );

                                    return (
                                        <Box
                                            key={
                                                row.id
                                            }
                                            sx={bomRowSx}
                                        >
                                            <Box sx={tableCellSx}>
                                                <Typography sx={mainTextSx}>
                                                    {row.bomNumber ||
                                                        row.bomNo ||
                                                        "-"}
                                                </Typography>

                                                <Typography sx={subTextSx}>
                                                    Revision{" "}
                                                    {row.revisionNo ??
                                                        "-"}
                                                </Typography>
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                <Typography sx={mainTextSx}>
                                                    {row.projectCode ||
                                                        row.pdNo ||
                                                        "-"}
                                                </Typography>

                                                <Typography sx={subTextSx}>
                                                    {row.drawingNo ||
                                                        "-"}
                                                </Typography>
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                <Typography sx={productNameSx}>
                                                    {row.productName ||
                                                        "-"}
                                                </Typography>

                                                {row.clientName && (
                                                    <Typography sx={subTextSx}>
                                                        {row.clientName}
                                                    </Typography>
                                                )}
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                {row.owningPlantCode ||
                                                    row.plantCode ||
                                                    "-"}
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                {row.lineCount ??
                                                    row.lines?.length ??
                                                    0}
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                <MatFlowStatusChip
                                                    status={
                                                        row.status
                                                    }
                                                />
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                <MatFlowStatusChip
                                                    status={
                                                        row.effective ===
                                                            true
                                                            ? "ACTIVE"
                                                            : row.latestRevision ===
                                                                true
                                                                ? "LATEST"
                                                                : "INACTIVE"
                                                    }
                                                />
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                <Box
                                                    sx={workflowBoxSx(
                                                        workflow.color
                                                    )}
                                                >
                                                    <Typography
                                                        sx={{
                                                            ...workflowDepartmentSx,
                                                            color:
                                                                workflow.color,
                                                        }}
                                                    >
                                                        {workflow.department}
                                                    </Typography>

                                                    <Typography sx={workflowActionSx}>
                                                        {workflow.action}
                                                    </Typography>
                                                </Box>
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                <Button
                                                    startIcon={
                                                        <VisibilityOutlinedIcon />
                                                    }
                                                    onClick={() =>
                                                        navigate(
                                                            `/matflow/boms/${row.id}`
                                                        )
                                                    }
                                                    sx={secondaryBtnSx}
                                                >
                                                    {actionLabelForStatus(
                                                        row.status
                                                    )}
                                                </Button>
                                            </Box>
                                        </Box>
                                    );
                                }
                            )
                        )}
                    </Box>
                )}

                <Box sx={paginationSx}>
                    <Button
                        disabled={
                            loading ||
                            page <= 0
                        }
                        onClick={() =>
                            setPage(
                                (current) =>
                                    Math.max(
                                        current -
                                        1,
                                        0
                                    )
                            )
                        }
                        sx={secondaryBtnSx}
                    >
                        Previous
                    </Button>

                    <Typography sx={pageTextSx}>
                        Page {page + 1} of{" "}
                        {Math.max(
                            totalPages,
                            1
                        )}
                    </Typography>

                    <Button
                        disabled={
                            loading ||
                            page + 1 >=
                            totalPages
                        }
                        onClick={() =>
                            setPage(
                                (current) =>
                                    current +
                                    1
                            )
                        }
                        sx={secondaryBtnSx}
                    >
                        Next
                    </Button>
                </Box>
            </Card>
        </Box>
    );
}

const headerRowSx = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "14px",
    flexWrap: "wrap",
};

const filterGridSx = {
    display: "grid",
    gridTemplateColumns:
        "minmax(240px,1.4fr) minmax(150px,.7fr) minmax(180px,.75fr) auto",
    gap: "10px",
    alignItems: "center",

    "@media (max-width: 950px)": {
        gridTemplateColumns:
            "1fr 1fr",
    },

    "@media (max-width: 620px)": {
        gridTemplateColumns:
            "1fr",
    },
};

const filterActionsSx = {
    display: "flex",
    gap: "7px",
    flexWrap: "wrap",
};

const resultHeaderSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    mb: "12px",
};

const bomColumns =
    "155px 165px minmax(220px,1.3fr) 110px 70px 145px 110px minmax(205px,1fr) 105px";

const bomHeaderSx = {
    ...tableHeaderSx,
    gridTemplateColumns:
        bomColumns,
    minWidth: "1390px",
};

const bomRowSx = {
    ...tableRowSx,
    gridTemplateColumns:
        bomColumns,
    minWidth: "1390px",
};

const productNameSx = {
    color:
        "var(--mf-text)",
    fontSize: "11px",
    fontWeight: 850,
};

const workflowBoxSx = (
    color
) => ({
    width: "100%",
    minWidth: 0,
    padding: "7px 9px",
    borderRadius: "8px",
    background:
        `${color}0D`,
    border:
        `1px solid ${color}28`,
});

const workflowDepartmentSx = {
    fontSize: "8.5px",
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: ".04em",
};

const workflowActionSx = {
    mt: "2px",
    color:
        "var(--mf-text-secondary)",
    fontSize: "8.5px",
    fontWeight: 750,
    lineHeight: 1.35,
};

const paginationSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "9px",
    mt: "12px",
};