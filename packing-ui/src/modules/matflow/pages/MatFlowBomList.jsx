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

import { useAuth }
    from "../../../auth/AuthContext";

import {
    canAccessMatFlowScreen,
    getMatFlowRole,
} from "../../../utils/matflowAccess";

import {
    extractMatFlowPage,
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
    emptySx,
    mainTextSx,
    pageTextSx,
    sectionSubSx,
    sectionTitleSx,
    subTextSx,
} from "../matflowTheme";

const STATUS_OPTIONS = [
    "",
    "DRAFT",
    "SUBMITTED",
    "APPROVED",
    "RETURNED",
    "SUPERSEDED",
];

export default function MatFlowBomList() {
    const navigate =
        useNavigate();

    const { role } =
        useAuth();

    const cleanRole =
        getMatFlowRole(role);

    const canCreate =
        canAccessMatFlowScreen(
            "bom-create",
            cleanRole
        );

    const [rows, setRows] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    const [filters, setFilters] =
        useState({
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

    const [page, setPage] =
        useState(0);

    const [totalPages, setTotalPages] =
        useState(0);

    const [totalElements, setTotalElements] =
        useState(0);

    const size = 25;

    const load = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const response =
                await matflowApi.listBoms({
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

                    /*
                     * The main register should display one
                     * current revision per BOM/project.
                     */
                    latestOnly: true,
                });

            const result =
                extractMatFlowPage(
                    response?.data
                );

            setRows(result.rows);

            setTotalPages(
                result.totalPages
            );

            setTotalElements(
                result.totalElements
            );
        } catch (requestError) {
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
    }, [
        appliedFilters,
        page,
    ]);

    useEffect(() => {
        load();
    }, [load]);

    const updateFilter = (
        key,
        value
    ) => {
        setFilters((current) => ({
            ...current,
            [key]: value,
        }));
    };

    const applyFilters = () => {
        setPage(0);

        setAppliedFilters({
            search:
                String(
                    filters.search || ""
                ).trim(),

            plantCode:
                String(
                    filters.plantCode || ""
                )
                    .trim()
                    .toUpperCase(),

            status:
                String(
                    filters.status || ""
                )
                    .trim()
                    .toUpperCase(),
        });
    };

    const resetFilters = () => {
        const cleared = {
            search: "",
            plantCode: "",
            status: "",
        };

        setFilters(cleared);
        setAppliedFilters(cleared);
        setPage(0);
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
                            MatFlow operational BOMs are
                            project-specific and independent from
                            the BOMFlow costing module.
                        </Typography>
                    </Box>

                    {canCreate && (
                        <Button
                            startIcon={<AddIcon />}
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
                        value={filters.search}
                        onChange={(event) =>
                            updateFilter(
                                "search",
                                event.target.value
                            )
                        }
                        sx={fieldSx}
                    />

                    <TextField
                        label="Plant"
                        value={filters.plantCode}
                        onChange={(event) =>
                            updateFilter(
                                "plantCode",
                                event.target.value
                            )
                        }
                        sx={fieldSx}
                    />

                    <TextField
                        select
                        label="Status"
                        value={filters.status}
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
                                        ? status.replaceAll(
                                            "_",
                                            " "
                                        )
                                        : "All Statuses"}
                                </MenuItem>
                            )
                        )}
                    </TextField>

                    <Box sx={filterActionsSx}>
                        <Button
                            startIcon={<SearchIcon />}
                            onClick={applyFilters}
                            sx={primaryBtnSx}
                        >
                            Search
                        </Button>

                        <Button
                            startIcon={<RefreshIcon />}
                            onClick={resetFilters}
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
                            {totalElements} operational BOM
                            records
                        </Typography>
                    </Box>

                    <Button
                        startIcon={<RefreshIcon />}
                        onClick={load}
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
                                Action
                            </Box>
                        </Box>

                        {rows.length === 0 ? (
                            <Box sx={emptySx}>
                                No operational BOMs were found.
                            </Box>
                        ) : (
                            rows.map((row) => (
                                <Box
                                    key={row.id}
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
                                        {row.productName ||
                                            "-"}
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
                                            status={row.status}
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
                                            Open
                                        </Button>
                                    </Box>
                                </Box>
                            ))
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
                        Page {page + 1} of{" "}
                        {Math.max(totalPages, 1)}
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
        "minmax(240px,1.4fr) minmax(150px,.7fr) minmax(160px,.7fr) auto",
    gap: "10px",
    alignItems: "center",

    "@media (max-width: 950px)": {
        gridTemplateColumns: "1fr 1fr",
    },

    "@media (max-width: 620px)": {
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

const bomColumns =
    "155px 165px minmax(220px,1.3fr) 110px 70px 140px 110px 100px";

const bomHeaderSx = {
    ...tableHeaderSx,
    gridTemplateColumns:
        bomColumns,
};

const bomRowSx = {
    ...tableRowSx,
    gridTemplateColumns:
        bomColumns,
};

const paginationSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "9px",
    mt: "12px",
};
