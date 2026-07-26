import React, {
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

import { useNavigate } from "react-router-dom";

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
} from "../matflowTheme";

import SearchIcon
	from "@mui/icons-material/Search";
import RefreshIcon
	from "@mui/icons-material/Refresh";
import VisibilityOutlinedIcon
	from "@mui/icons-material/VisibilityOutlined";

const statusOptions = [
	"",
	"ACTIVE",
	"SUPERSEDED",
	"CANCELLED",
];

const formatDate = (value) => {
	if (!value) return "-";

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
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

export default function MatFlowReleaseList() {
	const navigate = useNavigate();

	const [rows, setRows] = useState([]);
	const [loading, setLoading] =
		useState(true);
	const [error, setError] =
		useState("");

	const [page, setPage] = useState(0);
	const [size] = useState(20);
	const [totalPages, setTotalPages] =
		useState(0);
	const [totalElements, setTotalElements] =
		useState(0);

	const [filters, setFilters] = useState({
		search: "",
		plantCode: "",
		status: "",
	});

	const load = async (
		targetPage = page,
		targetFilters = filters
	) => {
		try {
			setLoading(true);
			setError("");

			const response =
				await matflowApi.listReleases({
					page: targetPage,
					size,
					search:
						targetFilters.search ||
						undefined,
					plantCode:
						targetFilters.plantCode ||
						undefined,
					status:
						targetFilters.status ||
						undefined,
				});

			const result =
				extractMatFlowPage(
					response.data
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

			setError(
				readMatFlowError(
					requestError,
					"Unable to load MatFlow releases."
				)
			);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load(page);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [page]);

	const updateFilter = (key, value) => {
		setFilters((current) => ({
			...current,
			[key]: value,
		}));
	};

	const applyFilters = () => {
		setPage(0);
		load(0);
	};

	const clearFilters = () => {
		const cleared = {
			search: "",
			plantCode: "",
			status: "",
		};

		setFilters(cleared);
		setPage(0);
		load(0, cleared);
	};

	return (
		<Box sx={pageSx}>
			<Box sx={heroSx}>
				<Chip
					label="BOMFLOW → MATFLOW"
					sx={heroBadgeSx}
				/>

				<Typography sx={heroTitleSx}>
					Approved BOM Releases
				</Typography>

				<Typography sx={heroSubSx}>
					Each release is an immutable material-planning snapshot.
					Production requisitions must be raised against an active
					MatFlow release rather than directly against editable BOM
					rows.
				</Typography>
			</Box>

			<Card sx={panelSx}>
				<Box sx={filterGridSx}>
					<TextField
						label="Search"
						placeholder="BOM No., product, PD or drawing..."
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
						placeholder="e.g. AKG"
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
						label="Release Status"
						value={filters.status}
						onChange={(event) =>
							updateFilter(
								"status",
								event.target.value
							)
						}
						sx={fieldSx}
					>
						{statusOptions.map((status) => (
							<MenuItem
								key={status || "ALL"}
								value={status}
							>
								{status || "All Statuses"}
							</MenuItem>
						))}
					</TextField>

					<Box sx={filterActionSx}>
						<Button
							startIcon={<SearchIcon />}
							onClick={applyFilters}
							sx={primaryBtnSx}
						>
							Search
						</Button>

						<Button
							startIcon={<RefreshIcon />}
							onClick={clearFilters}
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
						<Typography sx={resultTitleSx}>
							Release Register
						</Typography>

						<Typography sx={resultSubSx}>
							{totalElements} release record
							{totalElements === 1
								? ""
								: "s"}
						</Typography>
					</Box>

					<Button
						startIcon={<RefreshIcon />}
						onClick={() => load(page)}
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
						<Box sx={releaseTableHeaderSx}>
							<Box sx={tableCellSx}>
								BOM / Revision
							</Box>
							<Box sx={tableCellSx}>
								Product
							</Box>
							<Box sx={tableCellSx}>
								PD / Drawing
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
								Released
							</Box>
							<Box sx={tableCellSx}>
								Action
							</Box>
						</Box>

						{rows.length === 0 ? (
							<Box sx={emptyRowSx}>
								No MatFlow releases found.
							</Box>
						) : (
							rows.map((row) => (
								<Box
									key={row.id}
									sx={releaseTableRowSx}
								>
									<Box sx={tableCellSx}>
										<Typography sx={strongTextSx}>
											{row.bomNo || "-"}
										</Typography>

										<Typography sx={smallTextSx}>
											Revision{" "}
											{row.sourceRevisionNo ??
												"-"}
										</Typography>
									</Box>

									<Box sx={tableCellSx}>
										<Typography sx={strongTextSx}>
											{row.productName ||
												"-"}
										</Typography>

										<Typography sx={smallTextSx}>
											{row.productCode ||
												"No product code"}
										</Typography>
									</Box>

									<Box sx={tableCellSx}>
										<Typography sx={strongTextSx}>
											{row.pdNo || "-"}
										</Typography>

										<Typography sx={smallTextSx}>
											{row.drawingNo || "-"}
										</Typography>
									</Box>

									<Box sx={tableCellSx}>
										{row.plantCode || "-"}
									</Box>

									<Box sx={tableCellSx}>
										{row.releasedLineCount ??
											row.lineCount ??
											0}
									</Box>

									<Box sx={tableCellSx}>
										<MatFlowStatusChip
											status={row.status}
										/>
									</Box>

									<Box sx={tableCellSx}>
										<Typography sx={strongTextSx}>
											{row.releasedBy ||
												"-"}
										</Typography>

										<Typography sx={smallTextSx}>
											{formatDate(
												row.releasedAt
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
													`/matflow/releases/${row.id}`
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
							setPage((current) =>
								Math.max(current - 1, 0)
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
							page + 1 >= totalPages
						}
						onClick={() =>
							setPage((current) =>
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

const filterGridSx = {
	display: "grid",
	gridTemplateColumns:
		"minmax(240px,1.5fr) minmax(140px,.7fr) minmax(180px,.8fr) auto",
	gap: "10px",
	alignItems: "center",

	"@media (max-width: 1050px)": {
		gridTemplateColumns: "1fr 1fr",
	},

	"@media (max-width: 650px)": {
		gridTemplateColumns: "1fr",
	},
};

const filterActionSx = {
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

const resultTitleSx = {
	color: "#fff",
	fontSize: "17px",
	fontWeight: 950,
};

const resultSubSx = {
	mt: "3px",
	color: "rgba(255,255,255,.52)",
	fontSize: "11px",
	fontWeight: 700,
};

const releaseColumns =
	"150px minmax(230px,1.5fr) 150px 90px 70px 150px 190px 115px";

const releaseTableHeaderSx = {
	...tableHeaderSx,
	gridTemplateColumns: releaseColumns,
};

const releaseTableRowSx = {
	...tableRowSx,
	gridTemplateColumns: releaseColumns,
};

const strongTextSx = {
	color: "#fff",
	fontSize: "12px",
	fontWeight: 850,
};

const smallTextSx = {
	mt: "2px",
	color: "rgba(255,255,255,.48)",
	fontSize: "10px",
	fontWeight: 650,
};

const emptyRowSx = {
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