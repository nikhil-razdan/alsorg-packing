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

	const load = async () => {
		try {
			setLoading(true);

			const res = await venflowApi.getEntries({
				page,
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
		load();
	}, [page, size]);

	const applyFilters = () => {
		setPage(0);
		setTimeout(load, 0);
	};

	const updateFilter = (key, value) => {
		setFilters((prev) => ({
			...prev,
			[key]: value,
		}));
	};

	return (
		<Box>
			<Box sx={headerSx}>
				<Box>
					<Typography sx={titleSx}>
						Veneer Entries
					</Typography>

					<Typography sx={subSx}>
						Track every veneer requirement from order date to receiving and balance closure.
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
					/>

					<TextField
						label="Stage"
						size="small"
						select
						value={filters.stage}
						onChange={(e) => updateFilter("stage", e.target.value)}
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
						sx={filterBtnSx}
					>
						Apply
					</Button>
				</Box>
			</Card>

			<Card sx={tableCardSx}>
				{loading ? (
					<Box sx={{ p: 5, textAlign: "center" }}>
						<CircularProgress />
					</Box>
				) : (
					<>
						<TableContainer>
							<Table size="small">
								<TableHead>
									<TableRow>
										<TableCell>Order Date</TableCell>
										<TableCell>PD No.</TableCell>
										<TableCell>Client</TableCell>
										<TableCell>Product</TableCell>
										<TableCell>Veneer</TableCell>
										<TableCell>Size</TableCell>
										<TableCell>Store</TableCell>
										<TableCell>Ordered</TableCell>
										<TableCell>Received</TableCell>
										<TableCell>Balance</TableCell>
										<TableCell>Expected</TableCell>
										<TableCell>Stage</TableCell>
										<TableCell align="right">Action</TableCell>
									</TableRow>
								</TableHead>

								<TableBody>
									{rows.map((row) => (
										<TableRow key={row.id} hover>
											<TableCell>{row.orderDate || "-"}</TableCell>
											<TableCell sx={{ fontWeight: 900 }}>{row.pdNo}</TableCell>
											<TableCell>{row.clientName}</TableCell>
											<TableCell>{row.productDescription || "-"}</TableCell>
											<TableCell>{row.veneerType || "-"}</TableCell>
											<TableCell>{row.size || "-"}</TableCell>
											<TableCell>
												<VenFlowStatusChip status={row.storeStatus} />
											</TableCell>
											<TableCell>
												{row.orderedQty ?? "-"} {row.unit || ""}
											</TableCell>
											<TableCell>{row.receivedQty ?? "-"}</TableCell>
											<TableCell sx={{ fontWeight: 900 }}>
												{row.balanceQty ?? "-"}
											</TableCell>
											<TableCell>{row.expectedDate || "-"}</TableCell>
											<TableCell>
												<VenFlowStageChip stage={row.stage} />
											</TableCell>
											<TableCell align="right">
												<Button
													size="small"
													onClick={() => navigate(`/venflow/entries/${row.id}`)}
													sx={{ fontWeight: 900 }}
												>
													Open
												</Button>
											</TableCell>
										</TableRow>
									))}

									{rows.length === 0 && (
										<TableRow>
											<TableCell colSpan={13} align="center" sx={{ py: 5 }}>
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
						/>
					</>
				)}
			</Card>
		</Box>
	);
}

const headerSx = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: { xs: "flex-start", md: "center" },
	gap: 2,
	mb: 2.5,
	flexDirection: { xs: "column", md: "row" },
};

const titleSx = {
	fontSize: 28,
	fontWeight: 950,
	color: "#111827",
	letterSpacing: "-0.04em",
};

const subSx = {
	mt: 0.5,
	color: "#64748b",
	fontWeight: 650,
};

const primaryBtnSx = {
	borderRadius: "14px",
	textTransform: "none",
	fontWeight: 900,
	background: "linear-gradient(135deg,#92400e,#b45309)",
};

const filterCardSx = {
	p: 2,
	borderRadius: 4,
	mb: 2,
	border: "1px solid #e5e7eb",
	boxShadow: "0 14px 35px rgba(15,23,42,.05)",
};

const filterGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		md: "2fr 1fr 1fr auto",
	},
	gap: 1.5,
};

const filterBtnSx = {
	borderRadius: "12px",
	textTransform: "none",
	fontWeight: 900,
	borderColor: "#92400e",
	color: "#92400e",
};

const tableCardSx = {
	borderRadius: 4,
	border: "1px solid #e5e7eb",
	boxShadow: "0 18px 45px rgba(15,23,42,.06)",
	overflow: "hidden",
};