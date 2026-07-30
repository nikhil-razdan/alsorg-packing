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
} from "../../../utils/matflowAccess";

import {
    useMatFlow,
} from "../MatFlowContext";

import {
    matflowApi,
    readMatFlowError,
} from "../api/matflowApi";

import MatFlowStatusChip
    from "../components/MatFlowStatusChip";

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
    tableCellSx,
    tableHeaderSx,
    tableRowSx,
    tableShellSx,
} from "../matflowTheme";

const PAGE_SIZE = 25;

const DEFAULT_FILTERS = {
    search: "",
    status: "",
};

const normalize = (value) => {
    return String(value ?? "")
        .trim()
        .toLowerCase();
};

const statusLabel = (value) => {
    return String(value || "")
        .replaceAll("_", " ");
};

const formatDate = (value) => {
    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return String(value);
    }

    return date.toLocaleString(
        "en-US",
        {
            dateStyle: "medium",
            timeStyle: "short",
        }
    );
};

export default function MatFlowProductionRequisitionList() {
    const navigate =
        useNavigate();

    const {
        role,
        user,
    } = useAuth();

    const {
        selectedPlantParam,
    } = useMatFlow();

    const cleanRole =
        getMatFlowRole(
            role ||
            user?.role
        );

    const canCreate =
        canAccessMatFlowScreen(
            "production",
            cleanRole
        );

    const [allRows, setAllRows] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    const [
        draftFilters,
        setDraftFilters,
    ] = useState(
        DEFAULT_FILTERS
    );

    const [
        appliedFilters,
        setAppliedFilters,
    ] = useState(
        DEFAULT_FILTERS
    );

    const [page, setPage] =
        useState(0);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const response =
                await matflowApi
                    .listRequisitions();

            const data =
                response?.data;

            setAllRows(
                Array.isArray(data)
                    ? data
                    : []
            );
        } catch (requestError) {
            setAllRows([]);

            setError(
                readMatFlowError(
                    requestError,
                    "Unable to load production requisitions."
                )
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const statusOptions =
        useMemo(() => {
            const values =
                allRows
                    .map((row) =>
                        String(
                            row.status || ""
                        ).trim()
                    )
                    .filter(Boolean);

            return [
                "",
                ...Array.from(
                    new Set(values)
                ).sort(),
            ];
        }, [allRows]);

    const filteredRows =
        useMemo(() => {
            const searchTerm =
                normalize(
                    appliedFilters.search
                );

            const requiredStatus =
                String(
                    appliedFilters.status ||
                    ""
                ).toUpperCase();

            return allRows.filter(
                (row) => {
                    if (
                        selectedPlantParam &&
                        String(
                            row.destinationPlantCode ||
                            ""
                        ).toUpperCase() !==
                        String(
                            selectedPlantParam
                        ).toUpperCase()
                    ) {
                        return false;
                    }

                    if (
                        requiredStatus &&
                        String(
                            row.status || ""
                        ).toUpperCase() !==
                        requiredStatus
                    ) {
                        return false;
                    }

                    if (!searchTerm) {
                        return true;
                    }

                    const searchable =
                        [
                            row.requisitionNumber,
                            row.projectCode,
                            row.drawingNo,
                            row.bomNumber,
                            row.destinationLocationCode,
                            row.destinationLocationName,
                            row.destinationPlantCode,
                            row.requestedBy,
                        ]
                            .map(normalize)
                            .join(" ");

                    return searchable.includes(
                        searchTerm
                    );
                }
            );
        }, [
            allRows,
            appliedFilters,
            selectedPlantParam,
        ]);

    const totalPages =
        filteredRows.length === 0
            ? 0
            : Math.ceil(
                filteredRows.length /
                PAGE_SIZE
            );

    const safePage =
        totalPages === 0
            ? 0
            : Math.min(
                page,
                totalPages - 1
            );

    const displayedRows =
        useMemo(() => {
            const start =
                safePage *
                PAGE_SIZE;

            return filteredRows.slice(
                start,
                start + PAGE_SIZE
            );
        }, [
            filteredRows,
            safePage,
        ]);

    useEffect(() => {
        if (page !== safePage) {
            setPage(safePage);
        }
    }, [
        page,
        safePage,
    ]);

    const updateDraftFilter = (
        key,
        value
    ) => {
        setDraftFilters(
            (current) => ({
                ...current,
                [key]: value,
            })
        );
    };

    const applyFilters = () => {
        setAppliedFilters({
            ...draftFilters,
        });

        setPage(0);
    };

    const resetFilters = () => {
        setDraftFilters(
            DEFAULT_FILTERS
        );

        setAppliedFilters(
            DEFAULT_FILTERS
        );

        setPage(0);
    };

    return (
        <Box sx={pageSx}>
            <Box sx={heroSx}>
                <Box sx={headerRowSx}>
                    <Box>
                        <Chip
                            label="PRODUCTION MATERIAL CONTROL"
                            sx={heroBadgeSx}
                        />

                        <Typography sx={heroTitleSx}>
                            Production Requisitions
                        </Typography>

                        <Typography sx={heroSubSx}>
                            Raise controlled material demand
                            against approved and effective
                            operational BOM revisions.
                        </Typography>
                    </Box>

                    {canCreate && (
                        <Button
                            startIcon={<AddIcon />}
                            onClick={() =>
                                navigate(
                                    "/matflow/requisitions/new"
                                )
                            }
                            sx={primaryBtnSx}
                        >
                            Create Requisition
                        </Button>
                    )}
                </Box>
            </Box>

            <Card sx={panelSx}>
                <Box sx={filterGridSx}>
                    <TextField
                        label="Search"
                        placeholder="Requisition, project, drawing or BOM..."
                        value={
                            draftFilters.search
                        }
                        onChange={(event) =>
                            updateDraftFilter(
                                "search",
                                event.target.value
                            )
                        }
                        onKeyDown={(event) => {
                            if (
                                event.key ===
                                "Enter"
                            ) {
                                applyFilters();
                            }
                        }}
                        sx={fieldSx}
                    />

                    <TextField
                        select
                        label="Status"
                        value={
                            draftFilters.status
                        }
                        onChange={(event) =>
                            updateDraftFilter(
                                "status",
                                event.target.value
                            )
                        }
                        sx={fieldSx}
                    >
                        {statusOptions.map(
                            (status) => (
                                <MenuItem
                                    key={
                                        status ||
                                        "ALL"
                                    }
                                    value={status}
                                >
                                    {status
                                        ? statusLabel(
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
                            Requisition Register
                        </Typography>

                        <Typography sx={sectionSubSx}>
                            {filteredRows.length} requisition
                            record
                            {filteredRows.length === 1
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
                        <Box sx={headerTableSx}>
                            <Box sx={tableCellSx}>
                                Requisition
                            </Box>

                            <Box sx={tableCellSx}>
                                Project / Drawing
                            </Box>

                            <Box sx={tableCellSx}>
                                BOM
                            </Box>

                            <Box sx={tableCellSx}>
                                Destination
                            </Box>

                            <Box sx={tableCellSx}>
                                Lines
                            </Box>

                            <Box sx={tableCellSx}>
                                Status
                            </Box>

                            <Box sx={tableCellSx}>
                                Requested
                            </Box>

                            <Box sx={tableCellSx}>
                                Action
                            </Box>
                        </Box>

                        {displayedRows.length === 0 ? (
                            <Box sx={emptySx}>
                                No production requisitions were found.
                            </Box>
                        ) : (
                            displayedRows.map(
                                (row) => (
                                    <Box
                                        key={row.id}
                                        sx={rowTableSx}
                                    >
                                        <Box sx={tableCellSx}>
                                            <Typography sx={mainTextSx}>
                                                {row.requisitionNumber ||
                                                    "-"}
                                            </Typography>

                                            <Typography sx={subTextSx}>
                                                Version{" "}
                                                {row.rowVersion ??
                                                    "-"}
                                            </Typography>
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Typography sx={mainTextSx}>
                                                {row.projectCode ||
                                                    "-"}
                                            </Typography>

                                            <Typography sx={subTextSx}>
                                                {row.drawingNo ||
                                                    "-"}
                                            </Typography>
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Typography sx={mainTextSx}>
                                                {row.bomNumber ||
                                                    "-"}
                                            </Typography>

                                            <Typography sx={subTextSx}>
                                                Revision{" "}
                                                {row.bomRevisionNo ??
                                                    "-"}
                                            </Typography>
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Typography sx={mainTextSx}>
                                                {row.destinationLocationName ||
                                                    row.destinationLocationCode ||
                                                    "-"}
                                            </Typography>

                                            <Typography sx={subTextSx}>
                                                {row.destinationPlantCode ||
                                                    "-"}
                                            </Typography>
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            {Array.isArray(
                                                row.lines
                                            )
                                                ? row.lines.length
                                                : 0}
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <MatFlowStatusChip
                                                status={
                                                    row.status
                                                }
                                            />
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Typography sx={mainTextSx}>
                                                {row.requestedBy ||
                                                    "-"}
                                            </Typography>

                                            <Typography sx={subTextSx}>
                                                {formatDate(
                                                    row.requestedAt
                                                )}
                                            </Typography>
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Button
                                                startIcon={
                                                    <VisibilityOutlinedIcon />
                                                }
                                                onClick={() =>
                                                    navigate(
                                                        `/matflow/requisitions/${row.id}`
                                                    )
                                                }
                                                sx={secondaryBtnSx}
                                            >
                                                Open
                                            </Button>
                                        </Box>
                                    </Box>
                                )
                            )
                        )}
                    </Box>
                )}

                <Box sx={paginationSx}>
                    <Button
                        disabled={
                            loading ||
                            safePage <= 0
                        }
                        onClick={() =>
                            setPage(
                                (current) =>
                                    Math.max(
                                        current - 1,
                                        0
                                    )
                            )
                        }
                        sx={secondaryBtnSx}
                    >
                        Previous
                    </Button>

                    <Typography sx={pageTextSx}>
                        Page {safePage + 1} of{" "}
                        {Math.max(
                            totalPages,
                            1
                        )}
                    </Typography>

                    <Button
                        disabled={
                            loading ||
                            safePage + 1 >=
                            totalPages
                        }
                        onClick={() =>
                            setPage(
                                (current) =>
                                    current + 1
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
        "minmax(260px,1fr) minmax(180px,.45fr) auto",
    gap: "10px",
    alignItems: "center",

    "@media (max-width: 760px)": {
        gridTemplateColumns: "1fr",
    },
};

const filterActionsSx = {
    display: "flex",
    gap: "7px",
};

const resultHeaderSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    mb: "12px",
};

const sectionTitleSx = {
    color: "#fff",
    fontSize: "17px",
    fontWeight: 950,
};

const sectionSubSx = {
    mt: "3px",
    color: "rgba(255,255,255,.52)",
    fontSize: "11px",
    fontWeight: 700,
};

const columns =
    "155px 155px 145px minmax(210px,1.2fr) 65px 145px 175px 105px";

const headerTableSx = {
    ...tableHeaderSx,
    gridTemplateColumns:
        columns,
};

const rowTableSx = {
    ...tableRowSx,
    gridTemplateColumns:
        columns,
};

const mainTextSx = {
    color: "#fff",
    fontSize: "12px",
    fontWeight: 850,
};

const subTextSx = {
    mt: "2px",
    color: "rgba(255,255,255,.47)",
    fontSize: "10px",
    fontWeight: 650,
};

const emptySx = {
    minHeight: "170px",
    display: "grid",
    placeItems: "center",
    color: "rgba(255,255,255,.50)",
    fontSize: "12px",
    fontWeight: 750,
};

const paginationSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "9px",
    mt: "12px",
};

const pageTextSx = {
    color: "rgba(255,255,255,.62)",
    fontSize: "11px",
    fontWeight: 750,
};