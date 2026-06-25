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
		stage: "",
		storeStatus: "",
	});

	const load = async (targetPage = page) => {
		try {
			setLoading(true);

			const res = await venflowApi.getEntries({
				page: targetPage,
				size,
				search: filters.search || undefined,
				stage: filters.stage || undefined,
				storeStatus: filters.storeStatus || undefined,
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
						label="Stage"
						size="small"
						select
						value={filters.stage}
						onChange={(e) => updateFilter("stage", e.target.value)}
						sx={fieldSx}
						SelectProps={{ MenuProps: darkMenuProps }}
					>
						<MenuItem value="">All</MenuItem>
						<MenuItem value="HEADER_CREATED">Header Created</MenuItem>
						<MenuItem value="PRODUCT_DETAILS_FILLED">Product Details Filled</MenuItem>
						<MenuItem value="STORE_STATUS_UPDATED">Store Status Updated</MenuItem>
						<MenuItem value="REQUISITION_UPDATED">Requisition Updated</MenuItem>
						<MenuItem value="ORDER_QTY_UPDATED">Ordered Qty Updated</MenuItem>
						<MenuItem value="EXPECTED_DATE_UPDATED">Expected Date Updated</MenuItem>
						<MenuItem value="RECEIVED_QTY_UPDATED">Receiving Updated</MenuItem>
						<MenuItem value="COMPLETED">Completed</MenuItem>
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
						<TableContainer sx={{ overflowX: "auto" }}>
							<Table size="small" sx={{ minWidth: 1320 }}>
								<TableHead>
									<TableRow>
										<TableCell sx={tableHeadCellSx}>Order Date</TableCell>
										<TableCell sx={tableHeadCellSx}>PD No.</TableCell>
										<TableCell sx={tableHeadCellSx}>Client</TableCell>
										<TableCell sx={tableHeadCellSx}>Product</TableCell>
										<TableCell sx={tableHeadCellSx}>Veneer</TableCell>
										<TableCell sx={tableHeadCellSx}>Size</TableCell>
										<TableCell sx={tableHeadCellSx}>Store</TableCell>
										<TableCell sx={tableHeadCellSx}>Ordered</TableCell>
										<TableCell sx={tableHeadCellSx}>Received</TableCell>
										<TableCell sx={tableHeadCellSx}>Balance</TableCell>
										<TableCell sx={tableHeadCellSx}>Expected</TableCell>
										<TableCell sx={tableHeadCellSx}>Stage</TableCell>
										<TableCell sx={tableHeadCellSx} align="right">Action</TableCell>
									</TableRow>
								</TableHead>

								<TableBody>
									{rows.map((row) => (
										<TableRow key={row.id} hover sx={tableRowSx}>
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
											<TableCell sx={tableCellSx}>
												{row.orderedQty ?? "-"} {row.unit || ""}
											</TableCell>
											<TableCell sx={tableCellSx}>{row.receivedQty ?? "-"}</TableCell>
											<TableCell sx={{ ...tableCellSx, color: "#fff", fontWeight: 950 }}>
												{row.balanceQty ?? "-"}
											</TableCell>
											<TableCell sx={tableCellSx}>{row.expectedDate || "-"}</TableCell>
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
												colSpan={13}
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
		md: "2fr 1fr 1fr auto",
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