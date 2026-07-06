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

import { venflowApi } from "../api/venflowApi";
import VenFlowStageChip from "../components/VenFlowStageChip";

import {
    darkMenuProps,
    fieldSx,
    loadingBoxSx,
    outlineBtnSx,
    pageHeaderSx,
    pageSubSx,
    pageTitleSx,
    tableCardSx,
    tableCellSx,
    tableHeadCellSx,
    tableRowSx,
    tableContainerSx
} from "../venflowTheme";

export default function VenFlowPurchaseDeskPage() {
    const navigate = useNavigate();

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [size, setSize] = useState(25);
    const [total, setTotal] = useState(0);

    const [filters, setFilters] = useState({
        search: "",
        poStatus: "",
    });

    const load = async (targetPage = page) => {
        try {
            setLoading(true);

            const res = await venflowApi.getPurchaseDesk({
                page: targetPage,
                size,
                search: filters.search || undefined,
                poStatus: filters.poStatus || undefined,
            });

            const data = res.data || {};

            setRows(data.content || []);
            setTotal(data.totalElements || 0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load(page);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, size]);

    const applyFilters = () => {
        setPage(0);
        load(0);
    };

    return (
        <Box>
            <Box sx={pageHeaderSx}>
                <Box>
                    <Typography sx={pageTitleSx}>
                        Purchase Desk
                    </Typography>

                    <Typography sx={pageSubSx}>
                        Entries forwarded by Store to Purchase. Raise PO, track approval
                        and monitor material receiving.
                    </Typography>
                </Box>
            </Box>

            <Card sx={filterCardSx}>
                <Box sx={filterGridSx}>
                    <TextField
                        label="Search PD / Client / Vendor / PO"
                        size="small"
                        value={filters.search}
                        onChange={(e) =>
                            setFilters((p) => ({
                                ...p,
                                search: e.target.value,
                            }))
                        }
                        sx={fieldSx}
                    />

                    <TextField
                        label="PO Status"
                        size="small"
                        select
                        value={filters.poStatus}
                        onChange={(e) =>
                            setFilters((p) => ({
                                ...p,
                                poStatus: e.target.value,
                            }))
                        }
                        sx={fieldSx}
                        SelectProps={{ MenuProps: darkMenuProps }}
                    >
                        <MenuItem value="">All</MenuItem>
                        <MenuItem value="NOT_RAISED">Not Raised</MenuItem>
                        <MenuItem value="RAISED">Raised</MenuItem>
                        <MenuItem value="APPROVED">Approved</MenuItem>
                        <MenuItem value="REJECTED">Rejected</MenuItem>
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
                            <Table size="small" sx={{ minWidth: 1300 }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={tableHeadCellSx}>Plant</TableCell>
                                        <TableCell sx={tableHeadCellSx}>PD No.</TableCell>
                                        <TableCell sx={tableHeadCellSx}>Client</TableCell>
                                        <TableCell sx={tableHeadCellSx}>Product</TableCell>
                                        <TableCell sx={tableHeadCellSx}>Veneer</TableCell>
                                        <TableCell sx={tableHeadCellSx}>Ordered</TableCell>
                                        <TableCell sx={tableHeadCellSx}>Vendor</TableCell>
                                        <TableCell sx={tableHeadCellSx}>PO No.</TableCell>
                                        <TableCell sx={tableHeadCellSx}>PO Status</TableCell>
                                        <TableCell sx={tableHeadCellSx}>Stage</TableCell>
                                        <TableCell sx={tableHeadCellSx} align="right">
                                            Action
                                        </TableCell>
                                    </TableRow>
                                </TableHead>

                                <TableBody>
                                    {rows.map((row) => (
                                        <TableRow key={row.id} hover sx={tableRowSx}>
                                            <TableCell sx={tableCellSx}>{row.plantCode || "-"}</TableCell>
                                            <TableCell sx={{ ...tableCellSx, color: "#fff", fontWeight: 950 }}>
                                                {row.pdNo}
                                            </TableCell>
                                            <TableCell sx={tableCellSx}>{row.clientName}</TableCell>
                                            <TableCell sx={tableCellSx}>{row.productDescription || "-"}</TableCell>
                                            <TableCell sx={tableCellSx}>{row.veneerType || "-"}</TableCell>
                                            <TableCell sx={tableCellSx}>
                                                {row.orderedQty ?? "-"} {row.unit || ""}
                                            </TableCell>
                                            <TableCell sx={tableCellSx}>{row.vendorName || "-"}</TableCell>
                                            <TableCell sx={tableCellSx}>{row.poNo || "-"}</TableCell>
                                            <TableCell sx={tableCellSx}>{row.poStatus || "NOT_RAISED"}</TableCell>
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
                                                colSpan={11}
                                                align="center"
                                                sx={{ ...tableCellSx, py: 5 }}
                                            >
                                                No Purchase Desk entries found.
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
        md: "2fr 1fr auto",
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