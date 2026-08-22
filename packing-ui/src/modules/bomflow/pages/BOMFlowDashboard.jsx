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
	LinearProgress,
	Typography,
} from "@mui/material";

import { useNavigate } from "react-router-dom";

import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import PriceChangeOutlinedIcon from "@mui/icons-material/PriceChangeOutlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import QueryStatsOutlinedIcon from "@mui/icons-material/QueryStatsOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";

import bomFlowApi from "../api/bomFlowApi.js";
import BOMFlowPagination, { useBomFlowPagination } from "../BOMFlowPagination.jsx";

const number = (value) => {
	const parsed = Number(value ?? 0);
	return Number.isFinite(parsed) ? parsed : 0;
};

const integer = (value) =>
	number(value).toLocaleString("en-IN", {
		maximumFractionDigits: 0,
	});

const money = (value) =>
	`₹ ${number(value).toLocaleString("en-IN", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;

const percentage = (value) => {
	const safe = Math.max(0, Math.min(100, number(value)));
	return `${safe.toFixed(safe % 1 === 0 ? 0 : 1)}%`;
};

const formatDate = (value) => {
	if (!value) return "-";

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "-";

	return date.toLocaleString("en-IN", {
		day: "2-digit",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
};

const formatTime = (value) => {
	if (!value) return "Not synced";

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Not synced";

	return date.toLocaleTimeString("en-IN", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
};

const statusStyle = (status) => {
	const value = String(status || "DRAFT").trim().toUpperCase();

	if (["APPROVED", "RELEASED"].includes(value)) {
		return {
			color: "#4ade80",
			background: "rgba(34,197,94,.12)",
			border: "1px solid rgba(34,197,94,.24)",
		};
	}

	if (["VERIFIED"].includes(value)) {
		return {
			color: "#c084fc",
			background: "rgba(168,85,247,.12)",
			border: "1px solid rgba(168,85,247,.24)",
		};
	}

	if (["SUBMITTED", "PENDING_ENGINEERING_APPROVAL"].includes(value)) {
		return {
			color: "#7dd3fc",
			background: "rgba(14,165,233,.12)",
			border: "1px solid rgba(14,165,233,.24)",
		};
	}

	if (["RETURNED", "CANCELLED"].includes(value)) {
		return {
			color: "#fca5a5",
			background: "rgba(239,68,68,.12)",
			border: "1px solid rgba(239,68,68,.24)",
		};
	}

	return {
		color: "#fbbf24",
		background: "rgba(245,158,11,.12)",
		border: "1px solid rgba(245,158,11,.24)",
	};
};

const safeRows = (value) => (Array.isArray(value) ? value : []);

export default function BOMFlowDashboard() {
	const navigate = useNavigate();

	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState("");
	const [lastSyncedAt, setLastSyncedAt] = useState(null);

	const loadDashboard = useCallback(async ({ silent = false } = {}) => {
		if (silent) {
			setRefreshing(true);
		} else {
			setLoading(true);
		}

		setError("");

		try {
			const response = await bomFlowApi.getDashboardSummary();
			setData(response || {});
			setLastSyncedAt(new Date());
		} catch (requestError) {
			setError(
				requestError?.response?.data?.message ||
				requestError?.response?.data?.detail ||
				requestError?.message ||
				"Unable to load BOMFlow dashboard."
			);
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}, []);

	useEffect(() => {
		loadDashboard();
	}, [loadDashboard]);

	const recentCostings = useMemo(
		() => safeRows(data?.recentCostings),
		[data]
	);

	const recentPager = useBomFlowPagination(recentCostings, {
		initialPageSize: 5,
	});

	const stats = useMemo(
		() => [
			{
				key: "products",
				title: "Total Products",
				value: data?.totalProducts || 0,
				subtitle: "Product Master records",
				icon: <Inventory2OutlinedIcon />,
				accent: "#60a5fa",
				path: "/bomflow/products",
			},
			{
				key: "active",
				title: "Active Costings",
				value: data?.activeCostings || 0,
				subtitle: "Submitted to approved/released",
				icon: <CalculateOutlinedIcon />,
				accent: "#22c55e",
				path: "/bomflow/costing",
			},
			{
				key: "draft",
				title: "Draft / Returned",
				value: data?.draftBoms || 0,
				subtitle: "Editable BOM revisions",
				icon: <PendingActionsOutlinedIcon />,
				accent: "#f59e0b",
				path: "/bomflow/bom-builder",
			},
			{
				key: "approved",
				title: "Approved BOMs",
				value: data?.approvedBoms || 0,
				subtitle: "Approved / released revisions",
				icon: <CheckCircleOutlineOutlinedIcon />,
				accent: "#34d399",
				path: "/bomflow/reports",
			},
			{
				key: "missing",
				title: "Missing Rates",
				value: data?.missingRates || 0,
				subtitle: "Active BOM rows at zero rate",
				icon: <WarningAmberOutlinedIcon />,
				accent: "#ef4444",
				path: "/bomflow/rate-master",
			},
			{
				key: "rateMaster",
				title: "Material Rates",
				value: data?.activeMaterialRates || 0,
				subtitle: "Active Rate Master records",
				icon: <PriceChangeOutlinedIcon />,
				accent: "#38bdf8",
				path: "/bomflow/rate-master",
			},
			{
				key: "labourMaster",
				title: "Labour Rates",
				value: data?.activeLabourRates || 0,
				subtitle: "Active Labour Master records",
				icon: <EngineeringOutlinedIcon />,
				accent: "#a855f7",
				path: "/bomflow/labour-master",
			},
		],
		[data]
	);

	const recentMetrics = useMemo(() => {
		const material = recentCostings.reduce(
			(sum, row) => sum + number(row?.materialCost),
			0
		);

		const labour = recentCostings.reduce(
			(sum, row) => sum + number(row?.labourCost),
			0
		);

		const current = recentCostings.reduce(
			(sum, row) => sum + number(row?.currentCost),
			0
		);

		const average = recentCostings.length
			? current / recentCostings.length
			: 0;

		const materialShare = current > 0 ? (material / current) * 100 : 0;
		const labourShare = current > 0 ? (labour / current) * 100 : 0;

		return {
			material,
			labour,
			current,
			average,
			materialShare,
			labourShare,
		};
	}, [recentCostings]);

	const workflow = useMemo(() => {
		const active = number(data?.activeCostings);
		const draft = number(data?.draftBoms);
		const approved = number(data?.approvedBoms);
		const totalTracked = Math.max(1, active + draft);

		return [
			{
				label: "Editable Draft / Returned",
				value: draft,
				percent: (draft / totalTracked) * 100,
				accent: "#f59e0b",
			},
			{
				label: "Active Workflow",
				value: active,
				percent: (active / totalTracked) * 100,
				accent: "#38bdf8",
			},
			{
				label: "Approved / Released",
				value: approved,
				percent: active > 0 ? (approved / active) * 100 : 0,
				accent: "#22c55e",
			},
		];
	}, [data]);

	const rateHealth = useMemo(() => {
		const missing = number(data?.missingRates);
		const activeRates = number(data?.activeMaterialRates);

		if (missing === 0) {
			return {
				label: "Ready",
				message: "No active BOM row is currently blocked by a zero material rate.",
				accent: "#22c55e",
			};
		}

		if (activeRates === 0) {
			return {
				label: "Action Required",
				message: `${integer(missing)} BOM row(s) have missing rates and there are no active material rates in Rate Master.`,
				accent: "#ef4444",
			};
		}

		return {
			label: "Attention",
			message: `${integer(missing)} active BOM row(s) still have zero rates. Review or sync Rate Master before final costing.`,
			accent: "#f59e0b",
		};
	}, [data]);

	const maxRecentCost = useMemo(
		() =>
			Math.max(
				1,
				...recentCostings.map((row) => number(row?.currentCost))
			),
		[recentCostings]
	);

	if (loading && !data) {
		return (
			<Box sx={loadingPageSx}>
				<Box sx={loadingCardSx}>
					<CircularProgress size={34} />
					<Typography sx={loadingTitleSx}>
						Loading BOMFlow Dashboard
					</Typography>
					<Typography sx={loadingSubSx}>
						Reading live Product, BOM, Rate, Labour and Costing data.
					</Typography>
				</Box>
			</Box>
		);
	}

	return (
		<Box sx={pageSx}>
			<Box sx={heroSx}>
				<Box sx={heroCopySx}>
					<Box sx={heroBadgeRowSx}>
						<Chip label="BOMFLOW CONTROL CENTER" sx={labelChipSx} />
						<Chip
							icon={<AccessTimeOutlinedIcon sx={{ fontSize: "14px !important" }} />}
							label={`Synced ${formatTime(lastSyncedAt)}`}
							sx={syncChipSx}
						/>
					</Box>

					<Typography sx={titleSx}>
						Product BOM & Costing Dashboard
					</Typography>

					<Typography sx={subSx}>
						Live management view of Product Master, BOM workflow, material-rate readiness,
						labour masters and recent costing activity. All figures below come from the
						current BOMFlow backend dashboard response.
					</Typography>
				</Box>

				<Box sx={actionsSx}>
					<Button
						startIcon={
							refreshing ? (
								<CircularProgress size={15} color="inherit" />
							) : (
								<RefreshIcon />
							)
						}
						disabled={refreshing}
						onClick={() => loadDashboard({ silent: true })}
						sx={secondaryBtnSx}
					>
						{refreshing ? "Refreshing" : "Refresh"}
					</Button>

					<Button
						startIcon={<AddIcon />}
						onClick={() => navigate("/bomflow/products/new")}
						sx={primaryBtnSx}
					>
						New Product Costing
					</Button>
				</Box>
			</Box>

			{error && (
				<Card sx={errorCardSx}>
					<Box sx={errorIconSx}>
						<WarningAmberOutlinedIcon />
					</Box>
					<Box sx={{ flex: 1, minWidth: 0 }}>
						<Typography sx={errorTitleSx}>Dashboard data could not be refreshed</Typography>
						<Typography sx={errorTextSx}>{error}</Typography>
					</Box>
					<Button
						onClick={() => loadDashboard({ silent: true })}
						disabled={refreshing}
						sx={errorRetryBtnSx}
					>
						Retry
					</Button>
				</Card>
			)}

			<Box sx={statsGridSx}>
				{stats.map((stat) => (
					<button
						key={stat.key}
						type="button"
						onClick={() => navigate(stat.path)}
						style={statCardStyle(stat.accent)}
					>
						<div style={statBarStyle(stat.accent)} />
						<Box sx={statTopSx}>
							<Box sx={statIconSx(stat.accent)}>{stat.icon}</Box>
							<ArrowForwardIcon sx={statArrowSx} />
						</Box>
						<Typography sx={statLabelSx}>{stat.title}</Typography>
						<Typography sx={statValueSx}>{integer(stat.value)}</Typography>
						<Typography sx={statSubSx}>{stat.subtitle}</Typography>
					</button>
				))}
			</Box>

			<Box sx={managementGridSx}>
				<Card sx={executivePanelSx}>
					<Box sx={panelHeadSx}>
						<Box>
							<Typography sx={eyebrowSx}>RECENT PORTFOLIO</Typography>
							<Typography sx={panelTitleSx}>Recent Costing Exposure</Typography>
							<Typography sx={panelSubSx}>
								Aggregate view of the latest {recentCostings.length} revision(s) returned by the dashboard API.
							</Typography>
						</Box>
						<Box sx={panelIconSx("#60a5fa")}>
							<QueryStatsOutlinedIcon />
						</Box>
					</Box>

					<Box sx={portfolioGridSx}>
						<PortfolioMetric
							label="Current Cost"
							value={money(recentMetrics.current)}
							subtitle="Material + labour across recent revisions"
							accent="#60a5fa"
						/>
						<PortfolioMetric
							label="Average Revision Cost"
							value={money(recentMetrics.average)}
							subtitle="Average of recent dashboard revisions"
							accent="#22c55e"
						/>
						<PortfolioMetric
							label="Material Share"
							value={percentage(recentMetrics.materialShare)}
							subtitle={money(recentMetrics.material)}
							accent="#38bdf8"
						/>
						<PortfolioMetric
							label="Labour Share"
							value={percentage(recentMetrics.labourShare)}
							subtitle={money(recentMetrics.labour)}
							accent="#a855f7"
						/>
					</Box>

					<Box sx={mixBlockSx}>
						<Box sx={mixHeaderSx}>
							<Typography sx={mixLabelSx}>Material / Labour Mix</Typography>
							<Typography sx={mixValueSx}>
								{percentage(recentMetrics.materialShare)} / {percentage(recentMetrics.labourShare)}
							</Typography>
						</Box>
						<Box sx={stackedTrackSx}>
							<Box
								sx={{
								...stackedMaterialSx,
								width: `${Math.min(100, recentMetrics.materialShare)}%`,
							}}
							/>
							<Box
								sx={{
								...stackedLabourSx,
								width: `${Math.min(100, recentMetrics.labourShare)}%`,
							}}
							/>
						</Box>
					</Box>
				</Card>

				<Card sx={panelSx}>
					<Box sx={panelHeadSx}>
						<Box>
							<Typography sx={eyebrowSx}>COMMERCIAL READINESS</Typography>
							<Typography sx={panelTitleSx}>Rate & Master Health</Typography>
							<Typography sx={panelSubSx}>
								Live controls that affect BOM completion and costing reliability.
							</Typography>
						</Box>
						<Box sx={panelIconSx(rateHealth.accent)}>
							<TuneOutlinedIcon />
						</Box>
					</Box>

					<Box sx={healthHeroSx(rateHealth.accent)}>
						<Box>
							<Typography sx={healthStatusSx(rateHealth.accent)}>
								{rateHealth.label}
							</Typography>
							<Typography sx={healthMessageSx}>{rateHealth.message}</Typography>
						</Box>
						<WarningAmberOutlinedIcon sx={{ color: rateHealth.accent }} />
					</Box>

					<Box sx={healthListSx}>
						<HealthRow
							label="Missing material rates"
							value={integer(data?.missingRates)}
							accent={number(data?.missingRates) > 0 ? "#ef4444" : "#22c55e"}
						/>
						<HealthRow
							label="Active Rate Master records"
							value={integer(data?.activeMaterialRates)}
							accent="#38bdf8"
						/>
						<HealthRow
							label="Active Labour Master records"
							value={integer(data?.activeLabourRates)}
							accent="#a855f7"
						/>
					</Box>

					<Box sx={dualActionSx}>
						<Button onClick={() => navigate("/bomflow/rate-master")} sx={secondaryBtnSx}>
							Rate Master
						</Button>
						<Button onClick={() => navigate("/bomflow/labour-master")} sx={secondaryBtnSx}>
							Labour Master
						</Button>
					</Box>
				</Card>
			</Box>

			<Box sx={contentGridSx}>
				<Card sx={panelSx}>
					<Box sx={panelHeadSx}>
						<Box>
							<Typography sx={eyebrowSx}>LIVE WORKFLOW</Typography>
							<Typography sx={panelTitleSx}>BOM Workflow Position</Typography>
							<Typography sx={panelSubSx}>
								Overall revision counts supplied by BOMFlow dashboard reporting.
							</Typography>
						</Box>
						<Box sx={panelIconSx("#22c55e")}>
							<TrendingUpOutlinedIcon />
						</Box>
					</Box>

					<Box sx={workflowListSx}>
						{workflow.map((item) => (
							<Box key={item.label} sx={workflowRowSx}>
								<Box sx={workflowTopSx}>
									<Box sx={workflowNameSx}>
										<span style={dotStyle(item.accent)} />
										{item.label}
									</Box>
									<Typography sx={workflowCountSx}>{integer(item.value)}</Typography>
								</Box>
								<LinearProgress
									variant="determinate"
									value={Math.min(100, item.percent)}
									sx={workflowProgressSx(item.accent)}
								/>
							</Box>
						))}
					</Box>
				</Card>

				<Card sx={panelSx}>
					<Box sx={panelHeadSx}>
						<Box>
							<Typography sx={eyebrowSx}>WORKSPACES</Typography>
							<Typography sx={panelTitleSx}>BOMFlow Quick Access</Typography>
							<Typography sx={panelSubSx}>
								Move directly to the operational workspace you need.
							</Typography>
						</Box>
					</Box>

					<Box sx={quickListSx}>
						<QuickAction
							title="Product Master"
							subtitle="Products, dimensions, images, drawings and revisions"
							icon={<Inventory2OutlinedIcon />}
							onClick={() => navigate("/bomflow/products")}
						/>
						<QuickAction
							title="BOM Builder"
							subtitle="Section-wise material structure and approvals"
							icon={<RuleOutlinedIcon />}
							onClick={() => navigate("/bomflow/bom-builder")}
						/>
						<QuickAction
							title="Costing Engine"
							subtitle="Material, labour, overheads and final product costing"
							icon={<CalculateOutlinedIcon />}
							onClick={() => navigate("/bomflow/costing")}
						/>
						<QuickAction
							title="Reports"
							subtitle="Excel workbook, CSV exports and printable costing view"
							icon={<AssessmentOutlinedIcon />}
							onClick={() => navigate("/bomflow/reports")}
						/>
					</Box>
				</Card>
			</Box>

			<Card sx={recentPanelSx}>
				<Box sx={recentPanelHeadSx}>
					<Box>
						<Typography sx={eyebrowSx}>RECENT REVISION ACTIVITY</Typography>
						<Typography sx={panelTitleSx}>Latest Product Costings</Typography>
						<Typography sx={panelSubSx}>
							Current material + labour position for the latest revisions returned by BOMFlow.
						</Typography>
					</Box>

					<Button
						startIcon={<AssessmentOutlinedIcon />}
						onClick={() => navigate("/bomflow/reports")}
						sx={secondaryBtnSx}
					>
						Reports
					</Button>
				</Box>

				{recentCostings.length === 0 ? (
					<Box sx={emptyStateSx}>
						<Box sx={emptyIconSx}>
							<CalculateOutlinedIcon />
						</Box>
						<Typography sx={emptyTitleSx}>No BOM revision activity yet</Typography>
						<Typography sx={emptyTextSx}>
							Create a product and start a BOM revision to begin building live costing activity.
						</Typography>
						<Button
							startIcon={<AddIcon />}
							onClick={() => navigate("/bomflow/products/new")}
							sx={primaryBtnSx}
						>
							Create Product
						</Button>
					</Box>
				) : (
					<Box sx={tableWrapSx}>
						<Box sx={tableHeadSx}>
							<div>Product / Revision</div>
							<div>Status</div>
							<div>Material</div>
							<div>Labour</div>
							<div>Current Cost</div>
							<div>Updated By</div>
							<div>Last Update</div>
							<div>Actions</div>
						</Box>

						{recentPager.pageItems.map((row) => {
							const current = number(row?.currentCost);
							const progress = Math.round((current / maxRecentCost) * 100);

							return (
								<Box key={row?.revisionId || `${row?.productId}-${row?.updatedAt}`} sx={tableRowSx}>
									<Box sx={productCellSx}>
										<Box sx={productIconSx}>
											<Inventory2OutlinedIcon />
										</Box>
										<Box sx={{ minWidth: 0, flex: 1 }}>
											<Typography sx={productNameSx}>{row?.productName || "Unnamed Product"}</Typography>
											<Typography sx={productMetaSx}>
												{row?.productCode || "NO CODE"} • Revision activity
											</Typography>
											<LinearProgress variant="determinate" value={progress} sx={miniProgressSx} />
										</Box>
									</Box>

									<Box>
										<Chip
											label={String(row?.status || "DRAFT").replaceAll("_", " ")}
											size="small"
											sx={{
												height: 23,
												borderRadius: 999,
												fontSize: 9.5,
												fontWeight: 900,
												...statusStyle(row?.status),
											}}
										/>
									</Box>

									<Typography sx={tableAmountSx}>{money(row?.materialCost)}</Typography>
									<Typography sx={tableAmountSx}>{money(row?.labourCost)}</Typography>
									<Typography sx={tableTotalSx}>{money(row?.currentCost)}</Typography>

									<Box sx={personCellSx}>
										<PersonOutlineOutlinedIcon sx={{ fontSize: 15, color: "#64748b" }} />
										<Typography sx={tableTextSx}>{row?.updatedBy || "-"}</Typography>
									</Box>

									<Typography sx={tableMutedSx}>{formatDate(row?.updatedAt)}</Typography>

									<Box sx={rowActionsSx}>
										<Button
											disabled={!row?.revisionId}
											onClick={() => navigate(`/bomflow/revisions/${row.revisionId}`)}
											sx={smallSecondaryBtnSx}
										>
											BOM
										</Button>
										<Button
											disabled={!row?.revisionId}
											endIcon={<OpenInNewOutlinedIcon sx={{ fontSize: "14px !important" }} />}
											onClick={() =>
												navigate(
													`/bomflow/costing?productId=${row.productId || ""}&revisionId=${row.revisionId}`
												)
											}
											sx={smallPrimaryBtnSx}
										>
											Costing
										</Button>
									</Box>
								</Box>
							);
						})}
					</Box>
				)}
				{recentCostings.length > 0 && (
					<BOMFlowPagination
						page={recentPager.page}
						pageCount={recentPager.pageCount}
						pageSize={recentPager.pageSize}
						total={recentPager.total}
						from={recentPager.from}
						to={recentPager.to}
						onPageChange={recentPager.setPage}
						onPageSizeChange={recentPager.setPageSize}
						label="costing revisions"
						pageSizeOptions={[5, 10, 20]}
					/>
				)}
			</Card>
		</Box>
	);
}

function PortfolioMetric({ label, value, subtitle, accent }) {
	return (
		<Box sx={portfolioMetricSx}>
			<Box sx={portfolioAccentSx(accent)} />
			<Typography sx={portfolioLabelSx}>{label}</Typography>
			<Typography sx={portfolioValueSx}>{value}</Typography>
			<Typography sx={portfolioSubSx}>{subtitle}</Typography>
		</Box>
	);
}

function HealthRow({ label, value, accent }) {
	return (
		<Box sx={healthRowSx}>
			<Box sx={healthRowLeftSx}>
				<span style={dotStyle(accent)} />
				<Typography sx={healthRowLabelSx}>{label}</Typography>
			</Box>
			<Typography sx={{ ...healthRowValueSx, color: accent }}>{value}</Typography>
		</Box>
	);
}

function QuickAction({ title, subtitle, icon, onClick }) {
	return (
		<button type="button" onClick={onClick} style={quickButtonStyle}>
			<span style={quickIconStyle}>{icon}</span>
			<span style={{ flex: 1, minWidth: 0 }}>
				<span style={quickTitleStyle}>{title}</span>
				<span style={quickSubStyle}>{subtitle}</span>
			</span>
			<ArrowForwardIcon fontSize="small" />
		</button>
	);
}

/* ===================== PAGE ===================== */

const pageSx = {
	width: "100%",
	display: "flex",
	flexDirection: "column",
	gap: "14px",
	pb: "8px",
};

const heroSx = {
	position: "relative",
	display: "flex",
	alignItems: "flex-start",
	justifyContent: "space-between",
	gap: "18px",
	flexWrap: "wrap",
	p: "18px",
	borderRadius: "12px",
	background:
		"radial-gradient(circle at 10% 0%, rgba(37,99,235,.22), transparent 32%), linear-gradient(180deg, rgba(15,23,42,.90), rgba(15,23,42,.76))",
	border: "1px solid rgba(255,255,255,.08)",
	boxShadow: "0 18px 38px rgba(2,6,23,.28)",
	overflow: "hidden",
};

const heroCopySx = {
	minWidth: "280px",
	flex: 1,
};

const heroBadgeRowSx = {
	display: "flex",
	alignItems: "center",
	gap: "8px",
	flexWrap: "wrap",
	mb: "10px",
};

const labelChipSx = {
	height: 26,
	borderRadius: 999,
	background: "rgba(59,130,246,.14)",
	color: "#60a5fa",
	border: "1px solid rgba(59,130,246,.24)",
	fontWeight: 900,
	fontSize: 10.5,
	letterSpacing: ".06em",
};

const syncChipSx = {
	height: 26,
	borderRadius: 999,
	background: "rgba(255,255,255,.04)",
	color: "#94a3b8",
	border: "1px solid rgba(255,255,255,.08)",
	fontWeight: 800,
	fontSize: 10.5,
	"& .MuiChip-icon": {
		color: "#64748b",
	},
};

const titleSx = {
	color: "#fff",
	fontSize: {
		xs: 24,
		md: 32,
	},
	fontWeight: 950,
	lineHeight: 1.05,
	letterSpacing: "-0.04em",
};

const subSx = {
	mt: "8px",
	color: "rgba(255,255,255,.66)",
	fontSize: 12.5,
	fontWeight: 650,
	maxWidth: 900,
	lineHeight: 1.55,
};

const actionsSx = {
	display: "flex",
	alignItems: "center",
	gap: "8px",
	flexWrap: "wrap",
};

const primaryBtnSx = {
	height: 38,
	borderRadius: "9px",
	px: "14px",
	textTransform: "none",
	fontWeight: 850,
	fontSize: 11.5,
	color: "#fff",
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	boxShadow: "0 10px 22px rgba(37,99,235,.28)",
	"&:hover": {
		background: "linear-gradient(135deg,#1d4ed8,#2563eb)",
	},
};

const secondaryBtnSx = {
	height: 38,
	borderRadius: "9px",
	px: "13px",
	textTransform: "none",
	fontWeight: 850,
	fontSize: 11.5,
	color: "#fff",
	background: "rgba(255,255,255,.04)",
	border: "1px solid rgba(255,255,255,.08)",
	"&:hover": {
		background: "rgba(59,130,246,.12)",
		borderColor: "rgba(59,130,246,.30)",
	},
};

/* ===================== LOADING / ERROR ===================== */

const loadingPageSx = {
	minHeight: "560px",
	display: "grid",
	placeItems: "center",
};

const loadingCardSx = {
	width: "min(420px, 90vw)",
	p: "28px",
	borderRadius: "12px",
	background: "rgba(15,23,42,.80)",
	border: "1px solid rgba(255,255,255,.08)",
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	textAlign: "center",
	gap: "10px",
};

const loadingTitleSx = {
	color: "#fff",
	fontSize: 17,
	fontWeight: 900,
};

const loadingSubSx = {
	color: "rgba(255,255,255,.52)",
	fontSize: 11.5,
	fontWeight: 650,
	lineHeight: 1.5,
};

const errorCardSx = {
	p: "12px 13px",
	borderRadius: "10px",
	background: "rgba(239,68,68,.10)",
	border: "1px solid rgba(239,68,68,.24)",
	display: "flex",
	alignItems: "center",
	gap: "10px",
	flexWrap: "wrap",
};

const errorIconSx = {
	width: 36,
	height: 36,
	borderRadius: "9px",
	display: "grid",
	placeItems: "center",
	color: "#fca5a5",
	background: "rgba(239,68,68,.12)",
	border: "1px solid rgba(239,68,68,.20)",
};

const errorTitleSx = {
	color: "#fff",
	fontSize: 12.5,
	fontWeight: 900,
};

const errorTextSx = {
	mt: "2px",
	color: "rgba(255,255,255,.58)",
	fontSize: 10.5,
	fontWeight: 650,
};

const errorRetryBtnSx = {
	...secondaryBtnSx,
	height: 34,
	color: "#fca5a5",
	borderColor: "rgba(239,68,68,.26)",
};

/* ===================== STAT CARDS ===================== */

const statsGridSx = {
	display: "grid",
	gridTemplateColumns: "repeat(7,minmax(0,1fr))",
	gap: "10px",
	"@media (max-width: 1500px)": {
		gridTemplateColumns: "repeat(4,minmax(0,1fr))",
	},
	"@media (max-width: 980px)": {
		gridTemplateColumns: "repeat(2,minmax(0,1fr))",
	},
	"@media (max-width: 540px)": {
		gridTemplateColumns: "1fr",
	},
};

const statCardStyle = (accent) => ({
	position: "relative",
	width: "100%",
	minHeight: 136,
	padding: 13,
	borderRadius: 10,
	border: "1px solid rgba(255,255,255,.07)",
	background:
		"linear-gradient(180deg, rgba(15,23,42,.84), rgba(15,23,42,.74))",
	boxShadow: "0 14px 28px rgba(2,6,23,.22)",
	color: "#fff",
	textAlign: "left",
	cursor: "pointer",
	fontFamily: "inherit",
	overflow: "hidden",
	transition: "transform .18s ease, border-color .18s ease, box-shadow .18s ease",
	"--accent": accent,
});

const statBarStyle = (accent) => ({
	position: "absolute",
	left: 0,
	right: 0,
	top: 0,
	height: 3,
	background: accent,
	boxShadow: `0 0 18px ${accent}`,
});

const statTopSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "8px",
};

const statIconSx = (accent) => ({
	width: 36,
	height: 36,
	borderRadius: "9px",
	display: "grid",
	placeItems: "center",
	color: accent,
	background: `${accent}18`,
	border: `1px solid ${accent}33`,
});

const statArrowSx = {
	fontSize: 16,
	color: "rgba(255,255,255,.24)",
};

const statLabelSx = {
	mt: "10px",
	color: "rgba(255,255,255,.58)",
	fontSize: 9.5,
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".06em",
};

const statValueSx = {
	mt: "4px",
	color: "#fff",
	fontSize: 24,
	fontWeight: 950,
	lineHeight: 1,
};

const statSubSx = {
	mt: "6px",
	color: "rgba(255,255,255,.43)",
	fontSize: 9.8,
	fontWeight: 650,
	lineHeight: 1.35,
};

/* ===================== PANELS ===================== */

const managementGridSx = {
	display: "grid",
	gridTemplateColumns: "minmax(0,1.55fr) minmax(340px,.72fr)",
	gap: "14px",
	alignItems: "stretch",
	"@media (max-width: 1180px)": {
		gridTemplateColumns: "1fr",
	},
};

const contentGridSx = {
	display: "grid",
	gridTemplateColumns: "minmax(0,1fr) minmax(360px,.9fr)",
	gap: "14px",
	alignItems: "stretch",
	"@media (max-width: 1060px)": {
		gridTemplateColumns: "1fr",
	},
};

const panelSx = {
	p: "15px",
	borderRadius: "11px",
	background: "rgba(15,23,42,.78)",
	border: "1px solid rgba(255,255,255,.07)",
	boxShadow: "0 14px 28px rgba(2,6,23,.22)",
	overflow: "hidden",
};

const executivePanelSx = {
	...panelSx,
	background:
		"radial-gradient(circle at top right, rgba(59,130,246,.12), transparent 28%), rgba(15,23,42,.80)",
};

const panelHeadSx = {
	display: "flex",
	alignItems: "flex-start",
	justifyContent: "space-between",
	gap: "12px",
	mb: "13px",
};

const eyebrowSx = {
	color: "#60a5fa",
	fontSize: 9,
	fontWeight: 950,
	letterSpacing: ".11em",
};

const panelTitleSx = {
	mt: "3px",
	color: "#fff",
	fontSize: 17,
	fontWeight: 950,
	letterSpacing: "-0.02em",
};

const panelSubSx = {
	mt: "4px",
	color: "rgba(255,255,255,.50)",
	fontSize: 10.7,
	fontWeight: 650,
	lineHeight: 1.45,
};

const panelIconSx = (accent) => ({
	width: 36,
	height: 36,
	borderRadius: "9px",
	display: "grid",
	placeItems: "center",
	color: accent,
	background: `${accent}14`,
	border: `1px solid ${accent}28`,
	flexShrink: 0,
});

/* ===================== PORTFOLIO ===================== */

const portfolioGridSx = {
	display: "grid",
	gridTemplateColumns: "repeat(4,minmax(0,1fr))",
	gap: "9px",
	"@media (max-width: 860px)": {
		gridTemplateColumns: "repeat(2,minmax(0,1fr))",
	},
	"@media (max-width: 520px)": {
		gridTemplateColumns: "1fr",
	},
};

const portfolioMetricSx = {
	position: "relative",
	p: "12px",
	borderRadius: "9px",
	background: "rgba(2,6,23,.34)",
	border: "1px solid rgba(255,255,255,.06)",
	overflow: "hidden",
};

const portfolioAccentSx = (accent) => ({
	position: "absolute",
	top: 0,
	left: 0,
	bottom: 0,
	width: 2,
	background: accent,
});

const portfolioLabelSx = {
	color: "rgba(255,255,255,.50)",
	fontSize: 9,
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".06em",
};

const portfolioValueSx = {
	mt: "5px",
	color: "#fff",
	fontSize: 17,
	fontWeight: 950,
	fontFamily: "monospace",
	whiteSpace: "nowrap",
};

const portfolioSubSx = {
	mt: "4px",
	color: "rgba(255,255,255,.42)",
	fontSize: 9.5,
	fontWeight: 650,
	lineHeight: 1.35,
};

const mixBlockSx = {
	mt: "12px",
	p: "11px",
	borderRadius: "9px",
	background: "rgba(2,6,23,.28)",
	border: "1px solid rgba(255,255,255,.06)",
};

const mixHeaderSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "10px",
	mb: "8px",
};

const mixLabelSx = {
	color: "rgba(255,255,255,.62)",
	fontSize: 10.5,
	fontWeight: 850,
};

const mixValueSx = {
	color: "#fff",
	fontSize: 10.5,
	fontWeight: 900,
	fontFamily: "monospace",
};

const stackedTrackSx = {
	height: 8,
	borderRadius: 999,
	background: "rgba(255,255,255,.05)",
	overflow: "hidden",
	display: "flex",
};

const stackedMaterialSx = {
	height: "100%",
	background: "linear-gradient(90deg,#2563eb,#38bdf8)",
};

const stackedLabourSx = {
	height: "100%",
	background: "linear-gradient(90deg,#7c3aed,#a855f7)",
};

/* ===================== HEALTH ===================== */

const healthHeroSx = (accent) => ({
	p: "12px",
	borderRadius: "9px",
	background: `${accent}0f`,
	border: `1px solid ${accent}25`,
	display: "flex",
	alignItems: "flex-start",
	justifyContent: "space-between",
	gap: "10px",
});

const healthStatusSx = (accent) => ({
	color: accent,
	fontSize: 11,
	fontWeight: 950,
	textTransform: "uppercase",
	letterSpacing: ".07em",
});

const healthMessageSx = {
	mt: "4px",
	color: "rgba(255,255,255,.60)",
	fontSize: 10.5,
	fontWeight: 650,
	lineHeight: 1.45,
};

const healthListSx = {
	mt: "10px",
	display: "flex",
	flexDirection: "column",
};

const healthRowSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "10px",
	py: "9px",
	borderBottom: "1px solid rgba(255,255,255,.055)",
	"&:last-of-type": {
		borderBottom: "none",
	},
};

const healthRowLeftSx = {
	display: "flex",
	alignItems: "center",
	gap: "8px",
};

const healthRowLabelSx = {
	color: "rgba(255,255,255,.62)",
	fontSize: 10.5,
	fontWeight: 750,
};

const healthRowValueSx = {
	fontSize: 12,
	fontWeight: 950,
	fontFamily: "monospace",
};

const dualActionSx = {
	mt: "10px",
	display: "grid",
	gridTemplateColumns: "1fr 1fr",
	gap: "8px",
};

/* ===================== WORKFLOW ===================== */

const workflowListSx = {
	display: "flex",
	flexDirection: "column",
	gap: "11px",
};

const workflowRowSx = {
	p: "10px",
	borderRadius: "8px",
	background: "rgba(2,6,23,.28)",
	border: "1px solid rgba(255,255,255,.05)",
};

const workflowTopSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "10px",
	mb: "7px",
};

const workflowNameSx = {
	display: "flex",
	alignItems: "center",
	gap: "7px",
	color: "rgba(255,255,255,.68)",
	fontSize: 10.5,
	fontWeight: 800,
};

const workflowCountSx = {
	color: "#fff",
	fontSize: 12,
	fontWeight: 950,
};

const workflowProgressSx = (accent) => ({
	height: 6,
	borderRadius: 999,
	background: "rgba(255,255,255,.06)",
	"& .MuiLinearProgress-bar": {
		borderRadius: 999,
		background: accent,
	},
});

const dotStyle = (accent) => ({
	width: 7,
	height: 7,
	borderRadius: 999,
	background: accent,
	boxShadow: `0 0 10px ${accent}`,
	flexShrink: 0,
});

/* ===================== QUICK ACTIONS ===================== */

const quickListSx = {
	display: "flex",
	flexDirection: "column",
	gap: "8px",
};

const quickButtonStyle = {
	width: "100%",
	minHeight: 58,
	padding: "10px 11px",
	borderRadius: 9,
	border: "1px solid rgba(255,255,255,.07)",
	background: "rgba(255,255,255,.032)",
	color: "#fff",
	display: "flex",
	alignItems: "center",
	gap: 10,
	textAlign: "left",
	cursor: "pointer",
	fontFamily: "inherit",
};

const quickIconStyle = {
	width: 34,
	height: 34,
	borderRadius: 8,
	display: "grid",
	placeItems: "center",
	color: "#93c5fd",
	background: "rgba(59,130,246,.11)",
	border: "1px solid rgba(59,130,246,.20)",
	flexShrink: 0,
};

const quickTitleStyle = {
	display: "block",
	color: "#fff",
	fontSize: 11.5,
	fontWeight: 900,
};

const quickSubStyle = {
	display: "block",
	marginTop: 3,
	color: "rgba(255,255,255,.44)",
	fontSize: 9.8,
	fontWeight: 650,
	lineHeight: 1.35,
};

/* ===================== RECENT TABLE ===================== */

const recentPanelSx = {
	...panelSx,
	p: 0,
};

const recentPanelHeadSx = {
	p: "15px",
	display: "flex",
	alignItems: "flex-start",
	justifyContent: "space-between",
	gap: "12px",
	flexWrap: "wrap",
};

const tableWrapSx = {
	overflowX: "auto",
	overflowY: "hidden",
	scrollbarGutter: "stable",
	overscrollBehaviorX: "auto",
	WebkitOverflowScrolling: "touch",
	pb: "3px",
	borderTop: "1px solid rgba(255,255,255,.06)",
};

const tableHeadSx = {
	minWidth: 1420,
	display: "grid",
	gridTemplateColumns:
		"minmax(300px,1.55fr) 150px 145px 145px 160px 145px 185px 190px",
	background: "rgba(2,6,23,.38)",
	color: "rgba(255,255,255,.48)",
	fontSize: 9,
	fontWeight: 950,
	textTransform: "uppercase",
	letterSpacing: ".07em",
	"& > div": {
		padding: "11px 12px",
	},
};

const tableRowSx = {
	minWidth: 1420,
	display: "grid",
	gridTemplateColumns:
		"minmax(300px,1.55fr) 150px 145px 145px 160px 145px 185px 190px",
	alignItems: "center",
	borderTop: "1px solid rgba(255,255,255,.055)",
	background: "rgba(255,255,255,.016)",
	"& > p, & > div": {
		padding: "10px 12px",
	},
};

const productCellSx = {
	display: "flex",
	alignItems: "center",
	gap: "10px",
	minWidth: 0,
};

const productIconSx = {
	width: 38,
	height: 38,
	borderRadius: "9px",
	display: "grid",
	placeItems: "center",
	color: "#93c5fd",
	background: "rgba(59,130,246,.10)",
	border: "1px solid rgba(59,130,246,.18)",
	flexShrink: 0,
};

const productNameSx = {
	color: "#fff",
	fontSize: 12,
	fontWeight: 900,
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
};

const productMetaSx = {
	mt: "2px",
	color: "rgba(255,255,255,.43)",
	fontSize: 9.5,
	fontWeight: 650,
};

const miniProgressSx = {
	mt: "6px",
	height: 3,
	borderRadius: 99,
	background: "rgba(255,255,255,.05)",
	"& .MuiLinearProgress-bar": {
		borderRadius: 99,
		background: "linear-gradient(90deg,#2563eb,#60a5fa)",
	},
};

const tableAmountSx = {
	color: "rgba(255,255,255,.68)",
	fontSize: 10.5,
	fontWeight: 800,
	fontFamily: "monospace",
};

const tableTotalSx = {
	color: "#4ade80",
	fontSize: 11.5,
	fontWeight: 950,
	fontFamily: "monospace",
};

const tableTextSx = {
	color: "rgba(255,255,255,.65)",
	fontSize: 10.5,
	fontWeight: 750,
};

const tableMutedSx = {
	color: "rgba(255,255,255,.45)",
	fontSize: 9.8,
	fontWeight: 650,
};

const personCellSx = {
	display: "flex",
	alignItems: "center",
	gap: "6px",
};

const rowActionsSx = {
	display: "flex",
	alignItems: "center",
	gap: "6px",
	flexWrap: "wrap",
};

const smallSecondaryBtnSx = {
	...secondaryBtnSx,
	height: 32,
	minWidth: 66,
	px: "9px",
	fontSize: 10,
};

const smallPrimaryBtnSx = {
	...primaryBtnSx,
	height: 32,
	minWidth: 92,
	px: "9px",
	fontSize: 10,
};

const emptyStateSx = {
	minHeight: 250,
	borderTop: "1px solid rgba(255,255,255,.06)",
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	textAlign: "center",
	p: "24px",
};

const emptyIconSx = {
	width: 46,
	height: 46,
	borderRadius: "11px",
	display: "grid",
	placeItems: "center",
	color: "#93c5fd",
	background: "rgba(59,130,246,.11)",
	border: "1px solid rgba(59,130,246,.20)",
	mb: "10px",
};

const emptyTitleSx = {
	color: "#fff",
	fontSize: 15,
	fontWeight: 900,
};

const emptyTextSx = {
	mt: "5px",
	mb: "14px",
	maxWidth: 520,
	color: "rgba(255,255,255,.48)",
	fontSize: 10.5,
	fontWeight: 650,
	lineHeight: 1.45,
};
