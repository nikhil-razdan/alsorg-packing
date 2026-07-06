import React, { useEffect, useState } from "react";
import {
    Box,
    Button,
    Card,
    CircularProgress,
    MenuItem,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import API from "../../../services/api";
import { venflowApi } from "../api/venflowApi";
import VenFlowStatusChip from "../components/VenFlowStatusChip";
import VenFlowStageChip from "../components/VenFlowStageChip";

import {
    darkMenuProps,
    fieldSx,
    loadingBoxSx,
    outlineBtnSx,
    pageHeaderSx,
    pageSubSx,
    pageTitleSx,
    primaryBtnSx,
    tableCardSx,
    tableCellSx,
    tableHeadCellSx,
    tableRowSx,
    tableContainerSx
} from "../venflowTheme";

export default function VenFlowListPage() {
    const navigate = useNavigate();

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [size, setSize] = useState(25);
    const [total, setTotal] = useState(0);

    const [filters, setFilters] = useState({
        search: "",
        plantCode: "",
        stage: "",
        storeStatus: "",
        poStatus: "",
        productionStatus: "",
    });

    const [plantOptions, setPlantOptions] = useState([]);

    const readCurrentUser = () => {
        try {
            return JSON.parse(localStorage.getItem("currentUser") || "{}");
        } catch {
            return {};
        }
    };

    const readLocalPlantCodes = () => {
        try {
            return JSON.parse(localStorage.getItem("plantCodes") || "[]");
        } catch {
            return [];
        }
    };

    const load = async (targetPage = page) => {
        try {
            setLoading(true);

            const res = await venflowApi.getEntries({
                page: targetPage,
                size,
                search: filters.search || undefined,
                plantCode: filters.plantCode || undefined,
                stage: filters.stage || undefined,
                storeStatus: filters.storeStatus || undefined,
                poStatus: filters.poStatus || undefined,
                productionStatus: filters.productionStatus || undefined,
            });

            const data = res.data || {};

            setRows(data.content || []);
            setTotal(data.totalElements || 0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const loadPlants = async () => {
            const currentUser = readCurrentUser();

            const role = String(
                currentUser.role ||
                localStorage.getItem("role") ||
                ""
            ).toUpperCase();

            const assignedPlants =
                Array.isArray(currentUser.plantCodes) &&
                    currentUser.plantCodes.length > 0
                    ? currentUser.plantCodes
                    : readLocalPlantCodes();

            /*
             * ADMIN always sees all plants.
             */
            if (role === "ADMIN") {
                try {
                    const res = await API.get("/plants");

                    const rows = Array.isArray(res.data)
                        ? res.data
                        : Array.isArray(res.data?.content)
                            ? res.data.content
                            : [];

                    setPlantOptions(
                        rows
                            .map((p) => p.plantCode || p.code || p.name)
                            .filter(Boolean)
                            .map((p) => String(p).trim().toUpperCase())
                    );
                } catch {
                    setPlantOptions([]);
                }

                return;
            }

            /*
             * VenFlow Manager can see all only if no plant restriction.
             */
            if (role === "VENFLOW_MANAGER" && assignedPlants.length === 0) {
                try {
                    const res = await API.get("/plants");

                    const rows = Array.isArray(res.data)
                        ? res.data
                        : Array.isArray(res.data?.content)
                            ? res.data.content
                            : [];

                    setPlantOptions(
                        rows
                            .map((p) => p.plantCode || p.code || p.name)
                            .filter(Boolean)
                            .map((p) => String(p).trim().toUpperCase())
                    );
                } catch {
                    setPlantOptions([]);
                }

                return;
            }

            setPlantOptions(
                assignedPlants
                    .map((p) => String(p).trim().toUpperCase())
                    .filter(Boolean)
            );
        };

        loadPlants();
    }, []);

    useEffect(() => {
        load(page);
    }, [page, size]);

    const applyFilters = () => {
        setPage(0);
        load(0);
    };

    const updateFilter = (key, value) => {
        setFilters((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    return (
        <Box>
            <Box sx={pageHeaderSx}>
                <Box>
                    <Typography sx={pageTitleSx}>
                        Veneer Entries
                    </Typography>

                    <Typography sx={pageSubSx}>
                        Track every veneer requirement from order date to store,
                        requisition, receiving and balance closure.
                    </Typography>
                </Box>

                <Button
                    variant="contained"
                    onClick={() => navigate("/venflow/create")}
                    sx={primaryBtnSx}
                >
                    New Requirement
                </Button>
            </Box>

            <Card sx={filterCardSx}>
                <Box sx={filterGridSx}>
                    <TextField
                        label="Search PD / Client / Veneer"
                        size="small"
                        value={filters.search}
                        onChange={(e) => updateFilter("search", e.target.value)}
                        sx={fieldSx}
                    />

                    <TextField
                        label="Plant"
                        size="small"
                        select
                        value={filters.plantCode}
                        onChange={(e) => updateFilter("plantCode", e.target.value)}
                        sx={fieldSx}
                        SelectProps={{ MenuProps: darkMenuProps }}
                    >
                        <MenuItem value="">All Allowed Plants</MenuItem>

                        {plantOptions.map((plant) => (
                            <MenuItem key={plant} value={plant}>
                                {plant}
                            </MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        label="Stage"
                        size="small"
                        select
                        value={filters.stage}
                        onChange={(e) => updateFilter("stage", e.target.value)}
                        sx={fieldSx}
                        SelectProps={{ MenuProps: darkMenuProps }}
                    >
                        <MenuItem value="">All</MenuItem>
                        <MenuItem value="PRODUCTION_RAISED">Production Raised</MenuItem>
                        <MenuItem value="STORE_REVIEWED">Store Reviewed</MenuItem>
                        <MenuItem value="SENT_TO_PURCHASE">Sent to Purchase</MenuItem>
                        <MenuItem value="PO_RAISED">PO Raised</MenuItem>
                        <MenuItem value="PO_APPROVED">PO Approved</MenuItem>
                        <MenuItem value="MATERIAL_RECEIVED">Material Received</MenuItem>
                        <MenuItem value="MATERIAL_INFORMED">Production Informed</MenuItem>
                        <MenuItem value="PRODUCTION_STARTED">Production Started</MenuItem>
                        <MenuItem value="JOB_DONE">Job Done</MenuItem>
                    </TextField>

                    <TextField
                        label="Store Status"
                        size="small"
                        select
                        value={filters.storeStatus}
                        onChange={(e) => updateFilter("storeStatus", e.target.value)}
                        sx={fieldSx}
                        SelectProps={{ MenuProps: darkMenuProps }}
                    >
                        <MenuItem value="">All</MenuItem>
                        <MenuItem value="AVAILABLE_IN_STORE">Available in Store</MenuItem>
                        <MenuItem value="NOT_AVAILABLE">Not Available</MenuItem>
                        <MenuItem value="PARTIALLY_AVAILABLE">Partially Available</MenuItem>
                        <MenuItem value="PENDING">Pending</MenuItem>
                        <MenuItem value="HOLD">Hold</MenuItem>
                    </TextField>

                    <TextField
                        label="PO Status"
                        size="small"
                        select
                        value={filters.poStatus}
                        onChange={(e) => updateFilter("poStatus", e.target.value)}
                        sx={fieldSx}
                        SelectProps={{ MenuProps: darkMenuProps }}
                    >
                        <MenuItem value="">All</MenuItem>
                        <MenuItem value="NOT_RAISED">Not Raised</MenuItem>
                        <MenuItem value="RAISED">Raised</MenuItem>
                        <MenuItem value="APPROVED">Approved</MenuItem>
                        <MenuItem value="REJECTED">Rejected</MenuItem>
                    </TextField>

                    <TextField
                        label="Production"
                        size="small"
                        select
                        value={filters.productionStatus}
                        onChange={(e) => updateFilter("productionStatus", e.target.value)}
                        sx={fieldSx}
                        SelectProps={{ MenuProps: darkMenuProps }}
                    >
                        <MenuItem value="">All</MenuItem>
                        <MenuItem value="NOT_STARTED">Not Started</MenuItem>
                        <MenuItem value="STARTED">Started</MenuItem>
                        <MenuItem value="DONE">Done</MenuItem>
                    </TextField>

                    <Button
                        variant="outlined"
                        onClick={applyFilters}
                        sx={outlineBtnSx}
                    >
                        Apply
                    </Button>
                </Box>
            </Card>

            <Card sx={tableCardSx}>
                {loading ? (
                    <Box sx={loadingBoxSx}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        <TableContainer sx={{ tableContainerSx }}>
                            <Table size="small" sx={{ minWidth: 1700 }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={tableHeadCellSx}>Plant</TableCell>
                                        <TableCell sx={tableHeadCellSx}>Order Date</TableCell>
                                        <TableCell sx={tableHeadCellSx}>PD No.</TableCell>
                                        <TableCell sx={tableHeadCellSx}>Client</TableCell>
                                        <TableCell sx={tableHeadCellSx}>Product</TableCell>
                                        <TableCell sx={tableHeadCellSx}>Veneer</TableCell>
                                        <TableCell sx={tableHeadCellSx}>Size</TableCell>
                                        <TableCell sx={tableHeadCellSx}>Store</TableCell>
                                        <TableCell sx={tableHeadCellSx}>PO Status</TableCell>
                                        <TableCell sx={tableHeadCellSx}>PO No.</TableCell>
                                        <TableCell sx={tableHeadCellSx}>Ordered</TableCell>
                                        <TableCell sx={tableHeadCellSx}>Received</TableCell>
                                        <TableCell sx={tableHeadCellSx}>Balance</TableCell>
                                        <TableCell sx={tableHeadCellSx}>Expected</TableCell>
                                        <TableCell sx={tableHeadCellSx}>Production</TableCell>
                                        <TableCell sx={tableHeadCellSx}>Stage</TableCell>
                                        <TableCell sx={tableHeadCellSx} align="right">Action</TableCell>
                                    </TableRow>
                                </TableHead>

                                <TableBody>
                                    {rows.map((row) => (
                                        <TableRow key={row.id} hover sx={tableRowSx}>
                                            <TableCell sx={tableCellSx}>{row.plantCode || "-"}</TableCell>
                                            <TableCell sx={tableCellSx}>{row.orderDate || "-"}</TableCell>
                                            <TableCell sx={{ ...tableCellSx, color: "#fff", fontWeight: 950 }}>
                                                {row.pdNo}
                                            </TableCell>
                                            <TableCell sx={tableCellSx}>{row.clientName}</TableCell>
                                            <TableCell sx={tableCellSx}>{row.productDescription || "-"}</TableCell>
                                            <TableCell sx={tableCellSx}>{row.veneerType || "-"}</TableCell>
                                            <TableCell sx={tableCellSx}>{row.size || "-"}</TableCell>
                                            <TableCell sx={tableCellSx}>
                                                <VenFlowStatusChip status={row.storeStatus} />
                                            </TableCell>
                                            <TableCell sx={tableCellSx}>{row.poStatus || "NOT_RAISED"}</TableCell>
                                            <TableCell sx={tableCellSx}>{row.poNo || "-"}</TableCell>
                                            <TableCell sx={tableCellSx}>
                                                {row.orderedQty ?? "-"} {row.unit || ""}
                                            </TableCell>
                                            <TableCell sx={tableCellSx}>{row.receivedQty ?? "-"}</TableCell>
                                            <TableCell sx={{ ...tableCellSx, color: "#fff", fontWeight: 950 }}>
                                                {row.balanceQty ?? "-"}
                                            </TableCell>
                                            <TableCell sx={tableCellSx}>{row.expectedDate || "-"}</TableCell>
                                            <TableCell sx={tableCellSx}>{row.productionStatus || "NOT_STARTED"}</TableCell>
                                            <TableCell sx={tableCellSx}>
                                                <VenFlowStageChip stage={row.stage} />
                                            </TableCell>
                                            <TableCell sx={tableCellSx} align="right">
                                                <Button
                                                    size="small"
                                                    onClick={() => navigate(`/venflow/entries/${row.id}`)}
                                                    sx={openBtnSx}
                                                >
                                                    Open
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}

                                    {rows.length === 0 && (
                                        <TableRow>
                                            <TableCell
                                                colSpan={17}
                                                align="center"
                                                sx={{ ...tableCellSx, py: 5 }}
                                            >
                                                No VenFlow entries found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        <TablePagination
                            component="div"
                            count={total}
                            page={page}
                            rowsPerPage={size}
                            onPageChange={(_, newPage) => setPage(newPage)}
                            onRowsPerPageChange={(e) => {
                                setSize(Number(e.target.value));
                                setPage(0);
                            }}
                            rowsPerPageOptions={[10, 25, 50, 100]}
                            sx={paginationSx}
                        />
                    </>
                )}
            </Card>
        </Box>
    );
}

const filterCardSx = {
    p: 2,
    borderRadius: 4,
    mb: 2,
    background: "rgba(15,23,42,.78)",
    border: "1px solid rgba(255,255,255,.07)",
    boxShadow: "0 18px 40px rgba(2,6,23,.30)",
    backdropFilter: "blur(18px)",
};

const filterGridSx = {
    display: "grid",
    gridTemplateColumns: {
        xs: "1fr",
        md: "1.6fr 1fr 1fr 1fr 1fr auto",
    },
    gap: 1.5,
};

const openBtnSx = {
    borderRadius: "12px",
    textTransform: "none",
    fontWeight: 900,
    color: "#93c5fd",
    background: "rgba(59,130,246,.10)",
    border: "1px solid rgba(59,130,246,.22)",
    "&:hover": {
        background: "rgba(59,130,246,.18)",
    },
};

const paginationSx = {
    color: "#cbd5e1",
    borderTop: "1px solid rgba(255,255,255,.07)",
    "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": {
        color: "#94a3b8",
        fontWeight: 700,
    },
    "& .MuiSvgIcon-root": {
        color: "#cbd5e1",
    },
};