import React, {
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
	emptySx,
	mainTextSx,
	subTextSx,
	tableShellSx,
} from "../matflowTheme";

import SearchIcon
	from "@mui/icons-material/Search";
import RefreshIcon
	from "@mui/icons-material/Refresh";
import ArrowForwardIcon
	from "@mui/icons-material/ArrowForward";

const MODE_CONFIG = {
	production: {
		badge: "PRODUCTION MATERIAL CONTROL",
		title: "Production Requisitions",
		subtitle:
			"Raise and track material requisitions against active MatFlow releases.",
		loader: (params) =>
			matflowApi.listRequisitions(params),
		numberField: "requisitionNo",
		dateField: "submittedAt",
		detailPath: (row) =>
			`/matflow/requisitions/${row.id}`,
	},

	store: {
		badge: "STORE MATERIAL CONTROL",
		title: "Store Review Queue",
		subtitle:
			"Review requested quantities, available stock, blocked quantities and shortages.",
		loader: (params) =>
			matflowApi.listStoreQueue(params),
		numberField: "requisitionNo",
		dateField: "submittedAt",
		detailPath: (row) =>
			`/matflow/requisitions/${row.id}`,
	},

	indents: {
		badge: "STORE → PURCHASE",
		title: "Material Indents",
		subtitle:
			"Track shortage quantities submitted to Purchase for procurement.",
		loader: (params) =>
			matflowApi.listIndents(params),
		numberField: "indentNo",
		dateField: "submittedAt",
		detailPath: (row) =>
			`/matflow/indents/${row.id}`,
	},

	purchase: {
		badge: "PURCHASE PROCUREMENT",
		title: "Purchase Queue",
		subtitle:
			"Review submitted indents, compare vendor quotations and prepare purchase orders.",
		loader: (params) =>
			matflowApi.listPurchaseQueue(params),
		numberField: "indentNo",
		dateField: "submittedAt",
		detailPath: (row) =>
			`/matflow/indents/${row.id}`,
	},

	approvals: {
		badge: "PURCHASE ORDER APPROVAL",
		title: "PO Approval Queue",
		subtitle:
			"Review purchase orders submitted for authorized commercial approval.",
		loader: (params) =>
			matflowApi.listPurchaseOrders({
				...params,
				status: "PENDING_APPROVAL",
			}),
		numberField: "purchaseOrderNo",
		dateField: "submittedAt",
		detailPath: (row) =>
			`/matflow/purchase-orders/${row.id}`,
	},
};

const formatDate = (value) => {
	if (!value) return "-";

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return String(value);
	}

	return date.toLocaleDateString(
		"en-US",
		{
			dateStyle: "medium",
		}
	);
};

export default function MatFlowQueue({
	mode,
}) {
	const navigate = useNavigate();

	const config =
		MODE_CONFIG[mode] ||
		MODE_CONFIG.production;

	const [rows, setRows] = useState([]);
	const [loading, setLoading] =
		useState(true);
	const [error, setError] =
		useState("");
	const [search, setSearch] =
		useState("");

	const load = async () => {
		try {
			setLoading(true);
			setError("");

			const response =
				await config.loader({
					search:
						search || undefined,
					page: 0,
					size: 50,
				});

			const result =
				extractMatFlowPage(
					response.data
				);

			setRows(result.rows);
		} catch (requestError) {
			setRows([]);

			setError(
				readMatFlowError(
					requestError,
					`Unable to load ${config.title}.`
				)
			);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [mode]);

	const displayedRows = useMemo(() => {
		if (!search.trim()) {
			return rows;
		}

		const term =
			search.trim().toLowerCase();

		return rows.filter((row) => {
			return JSON.stringify(row)
				.toLowerCase()
				.includes(term);
		});
	}, [rows, search]);

	return (
		<Box sx={pageSx}>
			<Box sx={heroSx}>
				<Chip
					label={config.badge}
					sx={heroBadgeSx}
				/>

				<Typography sx={heroTitleSx}>
					{config.title}
				</Typography>

				<Typography sx={heroSubSx}>
					{config.subtitle}
				</Typography>
			</Box>

			<Card sx={panelSx}>
				<Box sx={toolbarSx}>
					<TextField
						label="Search Queue"
						value={search}
						onChange={(event) =>
							setSearch(
								event.target.value
							)
						}
						onKeyDown={(event) => {
							if (
								event.key === "Enter"
							) {
								load();
							}
						}}
						sx={{
							...fieldSx,
							minWidth: {
								xs: "100%",
								md: "340px",
							},
						}}
					/>

					<Box sx={toolbarActionsSx}>
						<Button
							startIcon={<SearchIcon />}
							onClick={load}
							sx={primaryBtnSx}
						>
							Search
						</Button>

						<Button
							startIcon={<RefreshIcon />}
							onClick={load}
							sx={secondaryBtnSx}
						>
							Refresh
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
				{loading ? (
					<Box sx={loadingSx}>
						<CircularProgress />
					</Box>
				) : (
					<Box sx={tableShellSx}>
						<Box sx={queueHeaderSx}>
							<Box sx={tableCellSx}>
								Document
							</Box>
							<Box sx={tableCellSx}>
								Product / Project
							</Box>
							<Box sx={tableCellSx}>
								PD / Drawing
							</Box>
							<Box sx={tableCellSx}>
								Plant
							</Box>
							<Box sx={tableCellSx}>
								Status
							</Box>
							<Box sx={tableCellSx}>
								Date
							</Box>
							<Box sx={tableCellSx}>
								Action
							</Box>
						</Box>

						{displayedRows.length === 0 ? (
							<Box sx={emptySx}>
								No records are currently available.
							</Box>
						) : (
							displayedRows.map((row) => {
								const documentNo =
									row[
									config.numberField
									] ||
									row.documentNo ||
									row.poNo ||
									"-";

								const product =
									row.productName ||
									row.clientName ||
									row.projectCode ||
									"-";

								return (
									<Box
										key={row.id}
										sx={queueRowSx}
									>
										<Box sx={tableCellSx}>
											<Typography sx={mainTextSx}>
												{documentNo}
											</Typography>
										</Box>

										<Box sx={tableCellSx}>
											<Typography sx={mainTextSx}>
												{product}
											</Typography>

											<Typography sx={subTextSx}>
												{row.productCode ||
													row.projectCode ||
													"-"}
											</Typography>
										</Box>

										<Box sx={tableCellSx}>
											<Typography sx={mainTextSx}>
												{row.pdNo ||
													"-"}
											</Typography>

											<Typography sx={subTextSx}>
												{row.drawingNo ||
													"-"}
											</Typography>
										</Box>

										<Box sx={tableCellSx}>
											{row.plantCode ||
												"-"}
										</Box>

										<Box sx={tableCellSx}>
											<MatFlowStatusChip
												status={
													row.status ||
													row.lineStatus
												}
											/>
										</Box>

										<Box sx={tableCellSx}>
											{formatDate(
												row[
												config.dateField
												] ||
												row.createdAt
											)}
										</Box>

										<Box sx={tableCellSx}>
											<Button
												endIcon={
													<ArrowForwardIcon />
												}
												onClick={() =>
													navigate(
														config.detailPath(
															row
														)
													)
												}
												sx={secondaryBtnSx}
											>
												Open
											</Button>
										</Box>
									</Box>
								);
							})
						)}
					</Box>
				)}
			</Card>
		</Box>
	);
}

const toolbarSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "10px",
	flexWrap: "wrap",
};

const toolbarActionsSx = {
	display: "flex",
	gap: "7px",
};

const queueColumns =
	"150px minmax(220px,1.4fr) 150px 90px 180px 125px 110px";

const queueHeaderSx = {
	...tableHeaderSx,
	gridTemplateColumns: queueColumns,
};

const queueRowSx = {
	...tableRowSx,
	gridTemplateColumns: queueColumns,
};
