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
	MenuItem,
	TablePagination,
	TextField,
	Typography,
} from "@mui/material";

import SupervisorAccountOutlinedIcon
	from "@mui/icons-material/SupervisorAccountOutlined";

import {
	PRODUCTION_VIEW_OPTIONS,
	STORE_VIEW_OPTIONS,
	SUPERVISOR_VIEW_OPTIONS,
	VF_STAGE,
	getStageLabel,
	isVenFlowClosed,
} from "../venflowWorkflow";

import { useNavigate } from "react-router-dom";

import { venflowApi } from "../api/venflowApi";
import VenFlowStageChip from "./VenFlowStageChip";
import VenFlowStatusChip from "./VenFlowStatusChip";

import {
	darkMenuProps,
	fieldSx,
	loadingBoxSx,
	outlineBtnSx,
	premiumScrollbarSx,
	primaryBtnSx,
} from "../venflowTheme";

import SearchIcon from "@mui/icons-material/Search";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import RestartAltOutlinedIcon from "@mui/icons-material/RestartAltOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";

const PO_STATUS_OPTIONS = [
	["", "All"],
	["NOT_RAISED", "Not Raised"],
	["RAISED", "Raised"],
	["APPROVED", "Approved"],
	["REJECTED", "Rejected"],
];

const STORE_STATUS_OPTIONS = [
	["", "All"],
	["AVAILABLE_IN_STORE", "Available"],
	["NOT_AVAILABLE", "Not Available"],
	["PARTIALLY_AVAILABLE", "Partial"],
	["PENDING", "Pending"],
	["HOLD", "Hold"],
];

const DESK_META = {
	store: {
		title: "Store Desk",
		subtitle:
			"Review veneer availability, reserve material, send requirements to Purchase, receive material and inform Production.",
		activeTab: "store",
		defaultStage: "SENT_TO_STORE",
		searchLabel: "Search PD / Client / Veneer / Request No.",
		viewLabel: "Store View",
		viewOptions: STORE_VIEW_OPTIONS,
		primaryColor: "#3b82f6",
		icon: <StorefrontOutlinedIcon />,
	},
	purchase: {
		title: "Purchase Desk",
		subtitle:
			"Manage entries forwarded by Store, raise PO, track approval and monitor material receiving.",
		activeTab: "purchase",
		defaultStage: "",
		searchLabel: "Search PD / Client / Vendor / PO",
		viewLabel: "PO Status",
		viewOptions: PO_STATUS_OPTIONS,
		primaryColor: "#a78bfa",
		icon: <ShoppingCartOutlinedIcon />,
	},
	production: {
		title: "Production Desk",
		subtitle:
			"Track production informed items, add production details, start processing and close work.",
		activeTab: "production",
		defaultStage:
			VF_STAGE.MATERIAL_ISSUED_TO_PRODUCTION,
		searchLabel: "Search PD / Client / Veneer / Material",
		viewLabel: "Production View",
		viewOptions: PRODUCTION_VIEW_OPTIONS,
		primaryColor: "#22c55e",
		icon: <EngineeringOutlinedIcon />,
	},
	supervisor: {
		title: "Supervisor Desk",
		subtitle:
			"Review completed veneer / flitch processing, confirm closure and mark the requirement Ready for Next Stage.",
		activeTab: "supervisor",
		defaultStage: VF_STAGE.SUPERVISOR_INFORMED,
		searchLabel:
			"Search PD / Client / Material / Responsible Person",
		viewLabel: "Supervisor View",
		viewOptions: SUPERVISOR_VIEW_OPTIONS,
		primaryColor: "#38bdf8",
		icon: <SupervisorAccountOutlinedIcon />,
	},
};

const formatDateTime = (value) => {
	if (!value) return "-";

	return String(value)
		.replace("T", " ")
		.slice(0, 16);
};

const safeNumber = (value) => {
	const n = Number(value || 0);
	return Number.isFinite(n) ? n : 0;
};

const isDelayed = (row) => {
	if (!row?.expectedDate) return false;

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const expected = new Date(row.expectedDate);
	expected.setHours(0, 0, 0, 0);

	return expected < today && row.stage !== "READY_FOR_NEXT_STAGE";
};

const isCompleted = (row) =>
	isVenFlowClosed(row?.stage);

const getPriority = (row) => {
	if (isCompleted(row)) return "Low";
	if (isDelayed(row)) return "High";

	if (
		[
			"PO_RAISED",
			"MATERIAL_ISSUED_TO_PRODUCTION",
			"PROCESSING_STARTED",
		].includes(row?.stage)
	) {
		return "High";
	}

	if (
		[
			"SENT_TO_STORE",
			"STORE_REVIEWED",
			"PURCHASE_REQUEST_RAISED",
			"PRODUCTION_INFORMED",
		].includes(row?.stage)
	) {
		return "Medium";
	}

	return "Low";
};

const buildDeskKpis = (desk, dashboard, rows, total) => {
	const delayedCount =
		safeNumber(dashboard.delayedItems) ||
		rows.filter(isDelayed).length;

	if (desk === "purchase") {
		return [
			{
				title: "Sent to Purchase",
				value: dashboard.sentToPurchase ?? total,
				icon: <ShoppingCartOutlinedIcon />,
				accent: "#a78bfa",
				trend: "Purchase queue",
			},
			{
				title: "Pending PO Raise",
				value: dashboard.pendingPoRaise ?? 0,
				icon: <LayersOutlinedIcon />,
				accent: "#fb7185",
				trend: "Needs PO",
			},
			{
				title: "PO Approval Pending",
				value: dashboard.pendingPoApproval ?? 0,
				icon: <AccessTimeOutlinedIcon />,
				accent: "#f59e0b",
				trend: "Manager sign-off",
			},
			{
				title: "Pending Receiving",
				value: dashboard.pendingMaterialReceiving ?? 0,
				icon: <Inventory2OutlinedIcon />,
				accent: "#06b6d4",
				trend: "Store receiving",
			},
			{
				title: "Delayed Items",
				value: delayedCount,
				icon: <WarningAmberOutlinedIcon />,
				accent: "#ef4444",
				trend: "Expected date crossed",
			},
		];
	}

	if (desk === "production") {
		return [
			{
				title: "Production Not Started",
				value: dashboard.productionNotStarted ?? 0,
				icon: <EngineeringOutlinedIcon />,
				accent: "#38bdf8",
				trend: "Start pending",
			},
			{
				title: "Production Started",
				value: dashboard.productionStarted ?? 0,
				icon: <AccessTimeOutlinedIcon />,
				accent: "#22c55e",
				trend: "Work in progress",
			},
			{
				title: "Job Done",
				value: dashboard.jobDone ?? 0,
				icon: <CheckCircleOutlineOutlinedIcon />,
				accent: "#34d399",
				trend: "Completed work",
			},
			{
				title: "Delayed Items",
				value: delayedCount,
				icon: <WarningAmberOutlinedIcon />,
				accent: "#ef4444",
				trend: "Needs attention",
			},
			{
				title: "Open Work",
				value: dashboard.totalPendingWorkLoading ?? total,
				icon: <LayersOutlinedIcon />,
				accent: "#facc15",
				trend: "Pending loading",
			},
		];
	}

	return [
		{
			title: "Total Requests",
			value: dashboard.totalEntries ?? total,
			icon: <LayersOutlinedIcon />,
			accent: "#3b82f6",
			trend: "Live requests",
		},
		{
			title: "Pending Store Review",
			value: dashboard.pendingStoreCheck ?? 0,
			icon: <StorefrontOutlinedIcon />,
			accent: "#f59e0b",
			trend: "Store pending",
		},
		{
			title: "Ready / Reserved",
			value:
				rows.filter((row) =>
					[
						"STOCK_AVAILABLE",
						"MATERIAL_RESERVED",
						"MATERIAL_ACCEPTED_IN_STORE",
					].includes(row.stage)
				).length,
			icon: <CheckCircleOutlineOutlinedIcon />,
			accent: "#22c55e",
			trend: "Can move ahead",
		},
		{
			title: "Pending Receiving",
			value: dashboard.pendingMaterialReceiving ?? 0,
			icon: <Inventory2OutlinedIcon />,
			accent: "#06b6d4",
			trend: "GRN / QC flow",
		},
		{
			title: "Delayed Items",
			value: delayedCount,
			icon: <WarningAmberOutlinedIcon />,
			accent: "#ef4444",
			trend: "Expected date crossed",
		},
	];
};

export default function VenFlowDeskShell({ desk = "store" }) {
	const navigate = useNavigate();

	const meta = DESK_META[desk] || DESK_META.store;

	const [rows, setRows] = useState([]);
	const [dashboard, setDashboard] = useState({});
	const [loading, setLoading] = useState(true);
	const [page, setPage] = useState(0);
	const [size, setSize] = useState(25);
	const [total, setTotal] = useState(0);

	const [filters, setFilters] = useState({
		search: "",
		stage: meta.defaultStage,
		storeStatus: "",
		poStatus: "",
	});

	const [selectedId, setSelectedId] = useState("");

	useEffect(() => {
		setFilters({
			search: "",
			stage: meta.defaultStage,
			storeStatus: "",
			poStatus: "",
		});
		setPage(0);
		setSelectedId("");
	}, [desk]);

	const selectedRow = useMemo(() => {
		return rows.find((row) => row.id === selectedId) || rows[0] || null;
	}, [rows, selectedId]);

	const kpis = useMemo(
		() => buildDeskKpis(desk, dashboard, rows, total),
		[desk, dashboard, rows, total]
	);

	const updateFilter = (key, value) => {
		setFilters((prev) => ({
			...prev,
			[key]: value,
		}));
	};

	const loadDashboard = async () => {
		try {
			const res = await venflowApi.getDashboard();
			setDashboard(res.data || {});
		} catch {
			setDashboard({});
		}
	};

	const load = async (
		targetPage = page,
		activeFilters = filters
	) => {
		try {
			setLoading(true);

			const params =
				desk === "purchase"
					? {
						page: targetPage,
						size,
						search: activeFilters.search || undefined,
						poStatus: activeFilters.poStatus || undefined,
					}
					: {
						page: targetPage,
						size,
						search: activeFilters.search || undefined,
						stage: activeFilters.stage || undefined,
						storeStatus:
							desk === "store"
								? activeFilters.storeStatus || undefined
								: undefined,
					};

			let res;

			if (desk === "purchase") {
				res = await venflowApi.getPurchaseDesk(
					params
				);
			} else if (desk === "supervisor") {
				res = await venflowApi.getSupervisorDesk({
					page: targetPage,
					size,
					search:
						activeFilters.search ||
						undefined,
				});
			} else {
				res = await venflowApi.getEntries(
					params
				);
			}

			const data = res.data || {};
			const nextRows = data.content || [];

			setRows(nextRows);
			setTotal(data.totalElements || 0);

			if (nextRows.length > 0) {
				setSelectedId((prev) =>
					prev && nextRows.some((row) => row.id === prev)
						? prev
						: nextRows[0].id
				);
			} else {
				setSelectedId("");
			}
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadDashboard();
	}, []);

	useEffect(() => {
		load(page);
	}, [page, size, desk]);

	const applyFilters = () => {
		setPage(0);
		load(0);
	};

	const clearFilters = () => {
		const cleared = {
			search: "",
			stage: meta.defaultStage,
			storeStatus: "",
			poStatus: "",
		};

		setFilters(cleared);
		setPage(0);
		setSelectedId("");

		load(0, cleared);
	};

	return (
		<Box sx={pageSx}>
			<Box sx={headerSx}>
				<Box sx={headerIconSx(meta.primaryColor)}>
					{meta.icon}
				</Box>

				<Box sx={{ minWidth: 0 }}>
					<Typography sx={titleSx}>
						{meta.title}
					</Typography>

					<Typography sx={subSx}>
						{meta.subtitle}
					</Typography>
				</Box>
			</Box>

			<Box sx={tabsSx}>
				<DeskTab
					active={desk === "store"}
					label="Store Desk"
					onClick={() => navigate("/venflow/store")}
				/>
				<DeskTab
					active={desk === "purchase"}
					label="Purchase Desk"
					onClick={() => navigate("/venflow/purchase")}
				/>
				<DeskTab
					active={desk === "production"}
					label="Production Desk"
					onClick={() => navigate("/venflow/production")}
				/>
				<DeskTab
					active={desk === "supervisor"}
					label="Supervisor Desk"
					onClick={() => navigate("/venflow/supervisor")}
				/>
			</Box>

			<Box sx={kpiGridSx}>
				{kpis.map((item) => (
					<KpiCard key={item.title} item={item} />
				))}
			</Box>

			<Card sx={filterPanelSx}>
				<Box sx={filterGridSx(desk)}>
					<TextField
						label={meta.searchLabel}
						size="small"
						value={filters.search}
						onChange={(e) =>
							updateFilter("search", e.target.value)
						}
						sx={fieldSx}
						InputProps={{
							startAdornment: (
								<SearchIcon
									sx={{
										color: "#94a3b8",
										fontSize: 18,
										mr: 1,
									}}
								/>
							),
						}}
					/>

					<TextField
						label={meta.viewLabel}
						size="small"
						select
						value={
							desk === "purchase"
								? filters.poStatus
								: filters.stage
						}
						onChange={(e) =>
							desk === "purchase"
								? updateFilter("poStatus", e.target.value)
								: updateFilter("stage", e.target.value)
						}
						sx={fieldSx}
						SelectProps={{ MenuProps: darkMenuProps }}
					>
						{meta.viewOptions.map(([value, label]) => (
							<MenuItem key={label} value={value}>
								{label}
							</MenuItem>
						))}
					</TextField>

					{desk === "store" && (
						<TextField
							label="Store Status"
							size="small"
							select
							value={filters.storeStatus}
							onChange={(e) =>
								updateFilter("storeStatus", e.target.value)
							}
							sx={fieldSx}
							SelectProps={{ MenuProps: darkMenuProps }}
						>
							{STORE_STATUS_OPTIONS.map(([value, label]) => (
								<MenuItem key={label} value={value}>
									{label}
								</MenuItem>
							))}
						</TextField>
					)}

					<Box sx={filterButtonsSx}>
						<Button
							startIcon={<TuneOutlinedIcon />}
							onClick={applyFilters}
							sx={outlineBtnSx}
						>
							Apply
						</Button>

						<Button
							startIcon={<RestartAltOutlinedIcon />}
							onClick={clearFilters}
							sx={clearBtnSx}
						>
							Clear
						</Button>
					</Box>
				</Box>
			</Card>

			<Box sx={mainGridSx}>
				<Card sx={tablePanelSx}>
					<Box sx={tableHeaderSx}>
						<Typography sx={tableTitleSx}>
							{total} results
						</Typography>

						<Button sx={smallToolBtnSx}>
							Columns
						</Button>
					</Box>

					<Box sx={tableScrollSx}>
						<Box sx={tableHeadSx}>
							<Box />
							<Typography sx={headCellSx}>PD / Request</Typography>
							<Typography sx={headCellSx}>Client / Material</Typography>
							<Typography sx={headCellSx}>Qty</Typography>
							<Typography sx={headCellSx}>Store</Typography>
							<Typography sx={headCellSx}>PO</Typography>
							<Typography sx={headCellSx}>Stage</Typography>
							<Typography sx={{ ...headCellSx, textAlign: "right" }}>
								Action
							</Typography>
						</Box>

						{loading ? (
							<Box sx={loadingBoxSx}>
								<CircularProgress />
							</Box>
						) : (
							<Box>
								{rows.map((row) => {
									const active = selectedRow?.id === row.id;
									const priority = getPriority(row);

									return (
										<Box
											key={row.id}
											sx={tableRowSx(active)}
											onClick={() => setSelectedId(row.id)}
										>
											<Box sx={selectBoxSx(active)}>
												{active ? "✓" : ""}
											</Box>

											<Box sx={{ minWidth: 0 }}>
												<Typography sx={mainTextSx}>
													{row.pdNo || "-"}
												</Typography>

												<Typography sx={mutedTextSx}>
													{row.plantCode || "-"} ·{" "}
													{row.bomReference || "No BOM"}
												</Typography>
											</Box>

											<Box sx={{ minWidth: 0 }}>
												<Typography sx={mainTextSx}>
													{row.clientName || "-"}
												</Typography>

												<Typography sx={mutedTextSx}>
													{row.materialName ||
														row.productDescription ||
														row.veneerType ||
														"-"}
												</Typography>
											</Box>

											<Typography sx={bodyCellSx}>
												{row.requiredQty ?? "-"}{" "}
												{row.unit || ""}
											</Typography>

											<Box>
												<VenFlowStatusChip
													status={
														row.storeStatus ||
														row.stockDecision ||
														"PENDING"
													}
												/>
											</Box>

											<Chip
												label={row.poStatus || "NOT_RAISED"}
												size="small"
												sx={statusChipSx(
													row.poStatus === "APPROVED"
														? "#22c55e"
														: row.poStatus === "RAISED"
															? "#3b82f6"
															: "#64748b"
												)}
											/>

											<Box>
												<VenFlowStageChip stage={row.stage} />
											</Box>

											<Box sx={rowActionSx}>
												<Chip
													label={priority}
													size="small"
													sx={priorityChipSx(priority)}
												/>

												<Button
													size="small"
													onClick={(e) => {
														e.stopPropagation();
														navigate(
															`/venflow/entries/${row.id}`
														);
													}}
													sx={openBtnSx}
												>
													Open
												</Button>
											</Box>
										</Box>
									);
								})}

								{rows.length === 0 && (
									<Box sx={emptySx}>
										No {meta.title} entries found.
									</Box>
								)}
							</Box>
						)}
					</Box>

					<Box sx={paginationWrapSx}>
						<Typography sx={showingTextSx}>
							Showing {rows.length === 0 ? 0 : page * size + 1} to{" "}
							{page * size + rows.length} of {total}
						</Typography>

						<TablePagination
							component="div"
							count={total}
							page={page}
							rowsPerPage={size}
							onPageChange={(_, nextPage) => setPage(nextPage)}
							onRowsPerPageChange={(e) => {
								setSize(Number(e.target.value));
								setPage(0);
							}}
							rowsPerPageOptions={[10, 25, 50, 100]}
							sx={paginationSx}
						/>
					</Box>
				</Card>

				<Card sx={previewPanelSx}>
					{!selectedRow ? (
						<Box sx={emptyPreviewSx}>
							Select an entry to preview details.
						</Box>
					) : (
						<PreviewPanel
							row={selectedRow}
							desk={desk}
							onOpen={() =>
								navigate(`/venflow/entries/${selectedRow.id}`)
							}
						/>
					)}
				</Card>
			</Box>
		</Box>
	);
}

function DeskTab({
	active,
	label,
	onClick,
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			style={{
				height: 44,
				border: "none",
				background: "transparent",
				color: active ? "#60a5fa" : "rgba(255,255,255,.70)",
				fontWeight: 950,
				fontSize: 13,
				cursor: "pointer",
				borderBottom: active
					? "2px solid #3b82f6"
					: "2px solid transparent",
				padding: "0 16px",
				fontFamily: "inherit",
			}}
		>
			{label}
		</button>
	);
}

function KpiCard({ item }) {
	return (
		<Card sx={kpiCardSx}>
			<Box sx={kpiIconSx(item.accent)}>
				{item.icon}
			</Box>

			<Box sx={{ minWidth: 0, flex: 1 }}>
				<Typography sx={kpiTitleSx}>
					{item.title}
				</Typography>

				<Typography sx={kpiValueSx}>
					{item.value ?? 0}
				</Typography>

				<Typography sx={kpiTrendSx(item.accent)}>
					▲ {item.trend}
				</Typography>
			</Box>

			<MiniSpark accent={item.accent} />
		</Card>
	);
}

function MiniSpark({ accent }) {
	return (
		<Box sx={sparkSx}>
			<svg width="100%" height="32" viewBox="0 0 120 32">
				<polyline
					fill="none"
					stroke={accent}
					strokeWidth="3"
					strokeLinecap="round"
					strokeLinejoin="round"
					points="0,25 12,19 24,23 36,12 48,17 60,8 72,20 84,14 96,18 108,7 120,11"
				/>
			</svg>
		</Box>
	);
}

function PreviewPanel({
	row,
	desk,
	onOpen,
}) {
	const priority = getPriority(row);

	return (
		<Box sx={previewSx}>
			<Box sx={previewHeaderSx}>
				<Box sx={previewDocSx}>
					<LayersOutlinedIcon />
				</Box>

				<Box sx={{ flex: 1, minWidth: 0 }}>
					<Box sx={previewTitleRowSx}>
						<Typography sx={previewTitleSx}>
							{row.pdNo || "Requirement"}
						</Typography>

						<Chip
							label={priority}
							size="small"
							sx={priorityChipSx(priority)}
						/>
					</Box>

					<Typography sx={previewSubSx}>
						{row.clientName || "-"}
					</Typography>

					<Typography sx={previewMetaSx}>
						{row.plantCode || "-"} · {row.requiredQty ?? "-"}{" "}
						{row.unit || ""}
					</Typography>
				</Box>
			</Box>

			<Box sx={previewTabsSx}>
				<Box sx={previewTabActiveSx}>Overview</Box>
				<Box sx={previewTabSx}>Material</Box>
				<Box sx={previewTabSx}>History</Box>
			</Box>

			<Box sx={previewBodySx}>
				<PreviewRow label="Material" value={row.materialName || row.productDescription} />
				<PreviewRow label="Veneer Type" value={row.veneerType} />
				<PreviewRow label="Drawing No." value={row.drawingNo} />
				<PreviewRow label="Size" value={row.size} />
				<PreviewRow label="Store Status" value={<VenFlowStatusChip status={row.storeStatus || row.stockDecision || "PENDING"} />} />
				<PreviewRow label="PO Status" value={row.poStatus || "NOT_RAISED"} />
				<PreviewRow label="Stage" value={<VenFlowStageChip stage={row.stage} />} />
				<PreviewRow label="Expected Date" value={row.expectedDate} />
				<PreviewRow label="Updated" value={formatDateTime(row.updatedAt || row.raisedAt)} />
			</Box>

			<Box sx={nextActionSx}>
				<Typography sx={nextActionTitleSx}>
					Suggested Action
				</Typography>

				<Typography sx={nextActionTextSx}>
					{desk === "store"
						? "Review stock availability, reserve material or raise purchase request."
						: desk === "purchase"
							? "Update purchase details, raise PO or wait for approval."
							: "Update production details, start processing or close completed work."}
				</Typography>
			</Box>

			<Box sx={previewActionRowSx}>
				<Button
					fullWidth
					startIcon={<OpenInNewOutlinedIcon />}
					onClick={onOpen}
					sx={primaryBtnSx}
				>
					Open Tracker
				</Button>

				<Button
					fullWidth
					sx={outlineBtnSx}
					onClick={onOpen}
				>
					Add Remark
				</Button>
			</Box>
		</Box>
	);
}

function PreviewRow({
	label,
	value,
}) {
	return (
		<Box sx={previewRowSx}>
			<Typography sx={previewLabelSx}>
				{label}
			</Typography>

			<Box sx={previewValueSx}>
				{value || "-"}
			</Box>
		</Box>
	);
}

const pageSx = {
	display: "flex",
	flexDirection: "column",
	gap: "14px",
};

const headerSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.5,
};

const headerIconSx = (color) => ({
	width: 46,
	height: 46,
	borderRadius: "16px",
	display: "grid",
	placeItems: "center",
	color,
	background: `${color}18`,
	border: `1px solid ${color}30`,
	boxShadow: `0 16px 36px ${color}18`,

	"& svg": {
		fontSize: 24,
	},
});

const titleSx = {
	color: "#fff",
	fontSize: {
		xs: 26,
		md: 34,
	},
	fontWeight: 950,
	letterSpacing: "-.045em",
	lineHeight: 1,
};

const subSx = {
	mt: 0.8,
	color: "rgba(255,255,255,.64)",
	fontSize: 13,
	fontWeight: 650,
	lineHeight: 1.55,
};

const tabsSx = {
	height: 48,
	display: "flex",
	alignItems: "center",
	gap: 1,
	borderBottom: "1px solid rgba(255,255,255,.07)",
};

const kpiGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		sm: "repeat(2,minmax(0,1fr))",
		lg: "repeat(5,minmax(0,1fr))",
	},
	gap: "12px",
};

const kpiCardSx = {
	position: "relative",
	minHeight: 112,
	p: "14px",
	borderRadius: "16px",
	background:
		"linear-gradient(180deg, rgba(30,41,59,.78), rgba(15,23,42,.76))",
	border: "1px solid rgba(255,255,255,.075)",
	boxShadow: "0 18px 38px rgba(2,6,23,.34)",
	color: "#fff",
	overflow: "hidden",
	display: "flex",
	gap: 1.4,
};

const kpiIconSx = (accent) => ({
	width: 44,
	height: 44,
	borderRadius: "50%",
	display: "grid",
	placeItems: "center",
	background: `${accent}22`,
	color: accent,
	border: `1px solid ${accent}44`,
	flexShrink: 0,
});

const kpiTitleSx = {
	color: "rgba(255,255,255,.70)",
	fontSize: 11,
	fontWeight: 950,
	textTransform: "uppercase",
	letterSpacing: ".05em",
};

const kpiValueSx = {
	mt: 0.7,
	color: "#fff",
	fontSize: 28,
	fontWeight: 950,
	lineHeight: 1,
};

const kpiTrendSx = (accent) => ({
	mt: 0.8,
	color: accent,
	fontSize: 11,
	fontWeight: 850,
});

const sparkSx = {
	position: "absolute",
	right: 12,
	bottom: 8,
	width: 88,
	opacity: 0.82,
};

const filterPanelSx = {
	p: "13px",
	borderRadius: "16px",
	background: "rgba(15,23,42,.72)",
	border: "1px solid rgba(255,255,255,.075)",
	boxShadow: "0 18px 38px rgba(2,6,23,.30)",
};

const filterGridSx = (desk) => ({
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		md:
			desk === "store"
				? "2fr 1.3fr 1fr auto"
				: "2fr 1.3fr auto",
	},
	gap: "10px",
	alignItems: "center",
});

const filterButtonsSx = {
	display: "flex",
	gap: "8px",
	alignItems: "center",
};

const clearBtnSx = {
	height: "38px",
	borderRadius: "9px",
	px: "12px",
	textTransform: "none",
	fontWeight: 850,
	color: "#94a3b8",

	"&:hover": {
		background: "rgba(255,255,255,.05)",
	},
};

const mainGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		xl: "minmax(700px,1fr) 430px",
	},
	gap: "12px",
	alignItems: "stretch",
};

const tablePanelSx = {
	borderRadius: "16px",
	background: "rgba(15,23,42,.72)",
	border: "1px solid rgba(255,255,255,.075)",
	boxShadow: "0 18px 42px rgba(2,6,23,.34)",
	color: "#fff",
	overflow: "hidden",
};

const tableHeaderSx = {
	height: 52,
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 1,
	px: 2,
	borderBottom: "1px solid rgba(255,255,255,.07)",
};

const tableTitleSx = {
	color: "#fff",
	fontSize: 14,
	fontWeight: 950,
};

const smallToolBtnSx = {
	height: 34,
	borderRadius: "10px",
	textTransform: "none",
	color: "#cbd5e1",
	fontWeight: 850,
	background: "rgba(255,255,255,.04)",
	border: "1px solid rgba(255,255,255,.08)",
};

const tableScrollSx = {
	overflow: "auto",
	maxHeight: 540,
	...premiumScrollbarSx,
};

const tableHeadSx = {
	display: "grid",
	gridTemplateColumns: "34px 1fr 1.45fr .65fr .9fr .9fr 1fr 112px",
	gap: "10px",
	alignItems: "center",
	minWidth: 1050,
	height: 44,
	px: 1.6,
	background: "rgba(2,6,23,.32)",
	borderBottom: "1px solid rgba(255,255,255,.07)",
};

const tableRowSx = (active) => ({
	display: "grid",
	gridTemplateColumns: "34px 1fr 1.45fr .65fr .9fr .9fr 1fr 112px",
	gap: "10px",
	alignItems: "center",
	minWidth: 1050,
	minHeight: 64,
	px: 1.6,
	cursor: "pointer",
	borderLeft: active
		? "3px solid #3b82f6"
		: "3px solid transparent",
	borderBottom: "1px solid rgba(255,255,255,.06)",
	background: active
		? "linear-gradient(90deg, rgba(37,99,235,.30), rgba(59,130,246,.08))"
		: "rgba(255,255,255,.014)",

	"&:hover": {
		background: active
			? "linear-gradient(90deg, rgba(37,99,235,.34), rgba(59,130,246,.10))"
			: "rgba(59,130,246,.08)",
	},
});

const headCellSx = {
	color: "rgba(255,255,255,.52)",
	fontSize: 10.5,
	fontWeight: 950,
	textTransform: "uppercase",
	letterSpacing: ".06em",
	whiteSpace: "nowrap",
};

const bodyCellSx = {
	color: "rgba(255,255,255,.72)",
	fontSize: 12,
	fontWeight: 750,
	whiteSpace: "nowrap",
};

const selectBoxSx = (active) => ({
	width: 17,
	height: 17,
	borderRadius: "5px",
	display: "grid",
	placeItems: "center",
	color: "#fff",
	fontSize: 11,
	fontWeight: 950,
	border: active
		? "1px solid #3b82f6"
		: "1px solid rgba(255,255,255,.20)",
	background: active
		? "linear-gradient(135deg,#2563eb,#3b82f6)"
		: "transparent",
});

const mainTextSx = {
	color: "#fff",
	fontSize: 12.5,
	fontWeight: 900,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const mutedTextSx = {
	mt: 0.4,
	color: "rgba(255,255,255,.50)",
	fontSize: 10.5,
	fontWeight: 700,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const statusChipSx = (color) => ({
	height: 22,
	borderRadius: 999,
	color,
	background: `${color}20`,
	border: `1px solid ${color}32`,
	fontSize: 10,
	fontWeight: 900,
});

const priorityChipSx = (priority) => {
	const color =
		priority === "High"
			? "#ef4444"
			: priority === "Medium"
				? "#f59e0b"
				: "#22c55e";

	return statusChipSx(color);
};

const rowActionSx = {
	display: "flex",
	justifyContent: "flex-end",
	alignItems: "center",
	gap: 0.8,
};

const openBtnSx = {
	minWidth: 46,
	height: 28,
	borderRadius: "9px",
	textTransform: "none",
	color: "#93c5fd",
	fontSize: 11,
	fontWeight: 900,
	background: "rgba(59,130,246,.10)",
	border: "1px solid rgba(59,130,246,.24)",
};

const emptySx = {
	color: "#94a3b8",
	fontSize: 13,
	fontWeight: 850,
	textAlign: "center",
	py: 6,
};

const paginationWrapSx = {
	minHeight: 54,
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 1,
	px: 2,
	borderTop: "1px solid rgba(255,255,255,.07)",
};

const showingTextSx = {
	color: "rgba(255,255,255,.58)",
	fontSize: 12,
	fontWeight: 750,
};

const paginationSx = {
	color: "#cbd5e1",

	"& .MuiTablePagination-toolbar": {
		minHeight: 44,
	},

	"& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": {
		color: "#94a3b8",
		fontWeight: 700,
	},

	"& .MuiSvgIcon-root": {
		color: "#cbd5e1",
	},
};

const previewPanelSx = {
	borderRadius: "16px",
	background:
		"linear-gradient(180deg, rgba(30,41,59,.72), rgba(15,23,42,.76))",
	border: "1px solid rgba(255,255,255,.075)",
	boxShadow: "0 18px 42px rgba(2,6,23,.34)",
	color: "#fff",
	overflow: "hidden",
	minHeight: 620,
};

const emptyPreviewSx = {
	height: "100%",
	display: "grid",
	placeItems: "center",
	color: "#94a3b8",
	fontWeight: 850,
};

const previewSx = {
	height: "100%",
	display: "flex",
	flexDirection: "column",
};

const previewHeaderSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.4,
	p: 2,
	borderBottom: "1px solid rgba(255,255,255,.07)",
};

const previewDocSx = {
	width: 48,
	height: 48,
	borderRadius: "14px",
	display: "grid",
	placeItems: "center",
	color: "#bfdbfe",
	background: "rgba(59,130,246,.16)",
	border: "1px solid rgba(59,130,246,.30)",
};

const previewTitleRowSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	flexWrap: "wrap",
};

const previewTitleSx = {
	color: "#fff",
	fontSize: 20,
	fontWeight: 950,
	lineHeight: 1,
};

const previewSubSx = {
	mt: 0.6,
	color: "#fff",
	fontSize: 13,
	fontWeight: 850,
};

const previewMetaSx = {
	mt: 0.4,
	color: "rgba(255,255,255,.54)",
	fontSize: 11,
	fontWeight: 700,
};

const previewTabsSx = {
	height: 45,
	display: "flex",
	alignItems: "center",
	gap: 2,
	px: 2,
	borderBottom: "1px solid rgba(255,255,255,.07)",
};

const previewTabActiveSx = {
	height: 45,
	display: "flex",
	alignItems: "center",
	color: "#60a5fa",
	fontSize: 12,
	fontWeight: 950,
	borderBottom: "2px solid #3b82f6",
};

const previewTabSx = {
	height: 45,
	display: "flex",
	alignItems: "center",
	color: "rgba(255,255,255,.58)",
	fontSize: 12,
	fontWeight: 800,
};

const previewBodySx = {
	p: 2,
	display: "flex",
	flexDirection: "column",
	gap: 1,
};

const previewRowSx = {
	display: "grid",
	gridTemplateColumns: "125px 1fr",
	gap: 1,
	alignItems: "center",
	py: 0.7,
	borderBottom: "1px solid rgba(255,255,255,.055)",
};

const previewLabelSx = {
	color: "rgba(255,255,255,.52)",
	fontSize: 11,
	fontWeight: 850,
};

const previewValueSx = {
	color: "#fff",
	fontSize: 12,
	fontWeight: 850,
	minWidth: 0,
};

const nextActionSx = {
	mx: 2,
	mt: "auto",
	p: 1.5,
	borderRadius: "14px",
	background: "rgba(59,130,246,.10)",
	border: "1px solid rgba(59,130,246,.22)",
};

const nextActionTitleSx = {
	color: "#bfdbfe",
	fontSize: 12,
	fontWeight: 950,
};

const nextActionTextSx = {
	mt: 0.6,
	color: "rgba(255,255,255,.62)",
	fontSize: 12,
	fontWeight: 650,
	lineHeight: 1.55,
};

const previewActionRowSx = {
	display: "grid",
	gridTemplateColumns: "1fr 1fr",
	gap: 1,
	p: 2,
};