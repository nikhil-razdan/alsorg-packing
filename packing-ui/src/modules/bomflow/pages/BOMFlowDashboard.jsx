import React, { useMemo, useState } from "react";

import {
	Box,
	Button,
	Card,
	Chip,
	LinearProgress,
	Typography,
} from "@mui/material";

import { useNavigate } from "react-router-dom";

import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import PriceChangeOutlinedIcon from "@mui/icons-material/PriceChangeOutlined";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AddIcon from "@mui/icons-material/Add";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";
import CurrencyRupeeOutlinedIcon from "@mui/icons-material/CurrencyRupeeOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import DonutLargeOutlinedIcon from "@mui/icons-material/DonutLargeOutlined";
import SpeedOutlinedIcon from "@mui/icons-material/SpeedOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";

const dashboardStats = [
	{
		key: "products",
		title: "Total Products",
		value: "48",
		subtle: "Product entities created",
		accent: "#60a5fa",
		icon: <Inventory2OutlinedIcon />,
	},
	{
		key: "active",
		title: "Active Costings",
		value: "12",
		subtle: "Currently under costing",
		accent: "#22c55e",
		icon: <CalculateOutlinedIcon />,
	},
	{
		key: "draft",
		title: "Draft BOMs",
		value: "7",
		subtle: "Pending completion",
		accent: "#f59e0b",
		icon: <PendingActionsOutlinedIcon />,
	},
	{
		key: "approved",
		title: "Approved BOMs",
		value: "21",
		subtle: "Final approved versions",
		accent: "#34d399",
		icon: <CheckCircleOutlineOutlinedIcon />,
	},
	{
		key: "missing",
		title: "Missing Rates",
		value: "9",
		subtle: "Items need rate update",
		accent: "#ef4444",
		icon: <WarningAmberOutlinedIcon />,
	},
	{
		key: "avg",
		title: "Avg Product Cost",
		value: "₹ 42.8K",
		subtle: "Average calculated cost",
		accent: "#8b5cf6",
		icon: <CurrencyRupeeOutlinedIcon />,
	},
];

const quickActions = [
	{
		title: "Create Product",
		subtitle: "Start a new product costing file.",
		path: "/bomflow/products",
		icon: <Inventory2OutlinedIcon />,
	},
	{
		title: "Build BOM",
		subtitle: "Add material sections and quantities.",
		path: "/bomflow/bom-builder",
		icon: <RuleOutlinedIcon />,
	},
	{
		title: "Update Rates",
		subtitle: "Review missing and revised rates.",
		path: "/bomflow/rate-master",
		icon: <PriceChangeOutlinedIcon />,
	},
	{
		title: "Export Reports",
		subtitle: "Download costing sheets and summaries.",
		path: "/bomflow/reports",
		icon: <AssessmentOutlinedIcon />,
	},
];

const sectionCostSplit = [
	{ label: "Metal", value: 12450, percent: 28, accent: "#60a5fa" },
	{ label: "Wood", value: 15800, percent: 35, accent: "#a78bfa" },
	{ label: "Hardware", value: 5200, percent: 12, accent: "#34d399" },
	{ label: "Stone", value: 7600, percent: 17, accent: "#f59e0b" },
	{ label: "Glass", value: 4200, percent: 8, accent: "#38bdf8" },
];

const costTrend = [
	{ month: "Jan", value: 28 },
	{ month: "Feb", value: 42 },
	{ month: "Mar", value: 36 },
	{ month: "Apr", value: 58 },
	{ month: "May", value: 52 },
	{ month: "Jun", value: 74 },
];

const recentCostings = [
	{
		product: "Executive Office Desk - Mod A",
		code: "PRJ-2024-089",
		status: "Draft",
		cost: "₹ 45,250.00",
		owner: "Admin",
		issue: "1 missing rate",
	},
	{
		product: "Finn Coop Side Table",
		code: "WR-907.01",
		status: "Approved",
		cost: "₹ 18,740.00",
		owner: "Costing Team",
		issue: "Ready",
	},
	{
		product: "Planum Primo Coffee Table",
		code: "WR-569.01",
		status: "Review",
		cost: "₹ 32,880.00",
		owner: "Reviewer",
		issue: "Labour check",
	},
	{
		product: "Luxury Wardrobe Panel",
		code: "WD-225.08",
		status: "Draft",
		cost: "₹ 64,300.00",
		owner: "Editor",
		issue: "Rate revision",
	},
];

const workflow = [
	{ label: "Created", value: 48, percent: 100, accent: "#60a5fa" },
	{ label: "BOM Added", value: 34, percent: 71, accent: "#38bdf8" },
	{ label: "Rate Checked", value: 27, percent: 56, accent: "#f59e0b" },
	{ label: "Reviewed", value: 23, percent: 48, accent: "#a78bfa" },
	{ label: "Approved", value: 21, percent: 44, accent: "#22c55e" },
];

const missingRateItems = [
	{
		item: "Brass Handles Custom",
		section: "Metal",
		product: "Executive Office Desk",
	},
	{
		item: "Imported Hinge Soft Close",
		section: "Hardware",
		product: "Wardrobe Panel",
	},
	{
		item: "Special Polish Finish",
		section: "Paint",
		product: "Coffee Table",
	},
];

const formatCurrency = (value) => {
	return `₹ ${Number(value || 0).toLocaleString("en-IN")}`;
};

export default function BOMFlowDashboard() {
	const navigate = useNavigate();

	const [range, setRange] = useState("month");
	const [activeMetric, setActiveMetric] = useState("active");

	const selectedStat = useMemo(() => {
		return dashboardStats.find((item) => item.key === activeMetric);
	}, [activeMetric]);

	return (
		<Box sx={pageSx}>
			<Box sx={heroSx}>
				<Box sx={heroLeftSx}>
					<Chip label="BOMFLOW DASHBOARD" sx={labelChipSx} />

					<Typography sx={pageTitleSx}>
						Product Costing Control Center
					</Typography>

					<Typography sx={pageSubSx}>
						Live overview of product BOM creation, costing progress,
						rate readiness, approval workflow and export controls.
					</Typography>
				</Box>

				<Box sx={heroActionsSx}>
					<Box sx={rangeSwitchSx}>
						<button
							type="button"
							onClick={() => setRange("week")}
							style={rangeBtnStyle(range === "week")}
						>
							Week
						</button>

						<button
							type="button"
							onClick={() => setRange("month")}
							style={rangeBtnStyle(range === "month")}
						>
							Month
						</button>

						<button
							type="button"
							onClick={() => setRange("quarter")}
							style={rangeBtnStyle(range === "quarter")}
						>
							Quarter
						</button>
					</Box>

					<Button
						startIcon={<AddIcon />}
						onClick={() => navigate("/bomflow/products")}
						sx={primaryBtnSx}
					>
						New Costing
					</Button>

					<Button
						startIcon={<DownloadOutlinedIcon />}
						onClick={() => navigate("/bomflow/reports")}
						sx={secondaryBtnSx}
					>
						Export
					</Button>
				</Box>
			</Box>

			<Box sx={statsGridSx}>
				{dashboardStats.map((item) => (
					<button
						key={item.key}
						type="button"
						onClick={() => setActiveMetric(item.key)}
						style={statCardStyle(item.accent, activeMetric === item.key)}
					>
						<div style={statAccentStyle(item.accent)} />

						<Box sx={statIconSx(item.accent)}>
							{item.icon}
						</Box>

						<Typography sx={statTitleSx}>
							{item.title}
						</Typography>

						<Typography sx={statValueSx}>
							{item.value}
						</Typography>

						<Typography sx={statSubSx}>
							{item.subtle}
						</Typography>

						<Typography sx={statHintSx}>
							{activeMetric === item.key ? "Selected" : "View insight"}
						</Typography>
					</button>
				))}
			</Box>

			{selectedStat && (
				<Card sx={insightCardSx(selectedStat.accent)}>
					<Box>
						<Typography sx={insightTitleSx}>
							{selectedStat.title} Insight
						</Typography>

						<Typography sx={insightSubSx}>
							This panel can later be connected with live backend APIs.
							For now, it gives a management-style snapshot of the selected
							dashboard metric.
						</Typography>
					</Box>

					<Box sx={insightValueBoxSx}>
						<Typography sx={insightValueLabelSx}>
							Current Value
						</Typography>

						<Typography sx={insightValueSx}>
							{selectedStat.value}
						</Typography>
					</Box>
				</Card>
			)}

			<Box sx={analyticsGridSx}>
				<Card sx={panelSx}>
					<Box sx={panelHeaderSx}>
						<Box>
							<Typography sx={panelTitleSx}>
								Costing Trend
							</Typography>

							<Typography sx={panelSubSx}>
								Month-wise movement of product costing activity
							</Typography>
						</Box>

						<Box sx={panelIconSx}>
							<TimelineOutlinedIcon />
						</Box>
					</Box>

					<Box sx={barChartSx}>
						{costTrend.map((item) => (
							<Box key={item.month} sx={barItemSx}>
								<Box sx={barTrackSx}>
									<Box
										sx={{
											...barFillSx,
											height: `${item.value}%`,
										}}
									/>
								</Box>

								<Typography sx={barLabelSx}>
									{item.month}
								</Typography>
							</Box>
						))}
					</Box>
				</Card>

				<Card sx={panelSx}>
					<Box sx={panelHeaderSx}>
						<Box>
							<Typography sx={panelTitleSx}>
								Section Cost Split
							</Typography>

							<Typography sx={panelSubSx}>
								Estimated material contribution
							</Typography>
						</Box>

						<Box sx={panelIconSx}>
							<DonutLargeOutlinedIcon />
						</Box>
					</Box>

					<Box sx={splitListSx}>
						{sectionCostSplit.map((item) => (
							<Box key={item.label} sx={splitItemSx}>
								<Box sx={splitTopSx}>
									<Box sx={splitNameSx}>
										<span style={dotStyle(item.accent)} />
										{item.label}
									</Box>

									<Typography sx={splitValueSx}>
										{formatCurrency(item.value)}
									</Typography>
								</Box>

								<LinearProgress
									variant="determinate"
									value={item.percent}
									sx={progressSx(item.accent)}
								/>
							</Box>
						))}
					</Box>
				</Card>
			</Box>

			<Box sx={threePanelGridSx}>
				<Card sx={panelSx}>
					<Box sx={panelHeaderSx}>
						<Box>
							<Typography sx={panelTitleSx}>
								Workflow Funnel
							</Typography>

							<Typography sx={panelSubSx}>
								Product costing stage movement
							</Typography>
						</Box>

						<Box sx={panelIconSx}>
							<SpeedOutlinedIcon />
						</Box>
					</Box>

					<Box sx={workflowListSx}>
						{workflow.map((item) => (
							<Box key={item.label} sx={workflowItemSx}>
								<Box sx={workflowTextRowSx}>
									<Typography sx={workflowLabelSx}>
										{item.label}
									</Typography>

									<Typography sx={workflowValueSx}>
										{item.value}
									</Typography>
								</Box>

								<LinearProgress
									variant="determinate"
									value={item.percent}
									sx={progressSx(item.accent)}
								/>
							</Box>
						))}
					</Box>
				</Card>

				<Card sx={warningPanelSx}>
					<Box sx={panelHeaderSx}>
						<Box>
							<Typography sx={panelTitleSx}>
								Attention Required
							</Typography>

							<Typography sx={panelSubSx}>
								Missing rates and costing blockers
							</Typography>
						</Box>

						<Box sx={warningIconSx}>
							<WarningAmberOutlinedIcon />
						</Box>
					</Box>

					<Box sx={missingListSx}>
						{missingRateItems.map((item) => (
							<Box key={item.item} sx={missingItemSx}>
								<Box>
									<Typography sx={missingTitleSx}>
										{item.item}
									</Typography>

									<Typography sx={missingSubSx}>
										{item.product} • {item.section}
									</Typography>
								</Box>

								<Chip
									label="Rate Missing"
									size="small"
									sx={missingChipSx}
								/>
							</Box>
						))}
					</Box>

					<Button
						fullWidth
						onClick={() => navigate("/bomflow/rate-master")}
						sx={warningBtnSx}
					>
						Open Rate Master
					</Button>
				</Card>

				<Card sx={panelSx}>
					<Box sx={panelHeaderSx}>
						<Box>
							<Typography sx={panelTitleSx}>
								Quick Actions
							</Typography>

							<Typography sx={panelSubSx}>
								Frequent BOMFlow operations
							</Typography>
						</Box>
					</Box>

					<Box sx={quickActionListSx}>
						{quickActions.map((item) => (
							<button
								key={item.title}
								type="button"
								onClick={() => navigate(item.path)}
								style={quickActionStyle}
							>
								<span style={quickActionIconStyle}>
									{item.icon}
								</span>

								<span style={{ flex: 1 }}>
									<span style={quickActionTitleStyle}>
										{item.title}
									</span>

									<span style={quickActionSubStyle}>
										{item.subtitle}
									</span>
								</span>

								<ArrowForwardIcon fontSize="small" />
							</button>
						))}
					</Box>
				</Card>
			</Box>

			<Card sx={panelSx}>
				<Box sx={panelHeaderSx}>
					<Box>
						<Typography sx={panelTitleSx}>
							Recent Product Costings
						</Typography>

						<Typography sx={panelSubSx}>
							Latest product BOM and costing activity
						</Typography>
					</Box>

					<Button
						startIcon={<VisibilityOutlinedIcon />}
						onClick={() => navigate("/bomflow/reports")}
						sx={secondaryBtnSx}
					>
						View All
					</Button>
				</Box>

				<Box sx={tableSx}>
					<Box sx={tableHeadSx}>
						<div>Product</div>
						<div>Code</div>
						<div>Status</div>
						<div>Cost</div>
						<div>Owner</div>
						<div>Action Point</div>
					</Box>

					{recentCostings.map((row) => (
						<Box key={row.code} sx={tableRowSx}>
							<Typography sx={productNameSx}>
								{row.product}
							</Typography>

							<Typography sx={tableTextSx}>
								{row.code}
							</Typography>

							<Chip
								label={row.status}
								size="small"
								sx={statusChipSx(row.status)}
							/>

							<Typography sx={costTextSx}>
								{row.cost}
							</Typography>

							<Typography sx={tableTextSx}>
								{row.owner}
							</Typography>

							<Typography sx={tableTextSx}>
								{row.issue}
							</Typography>
						</Box>
					))}
				</Box>
			</Card>
		</Box>
	);
}

/* ===================== STYLES ===================== */

const pageSx = {
	width: "100%",
	display: "flex",
	flexDirection: "column",
	gap: "14px",
};

const heroSx = {
	display: "flex",
	alignItems: "flex-start",
	justifyContent: "space-between",
	gap: "16px",
	flexWrap: "wrap",
};

const heroLeftSx = {
	minWidth: "280px",
	flex: 1,
};

const labelChipSx = {
	height: "26px",
	borderRadius: 999,
	background: "rgba(59,130,246,.14)",
	color: "#60a5fa",
	border: "1px solid rgba(59,130,246,.24)",
	fontWeight: 900,
	fontSize: "11px",
	letterSpacing: ".07em",
	mb: "10px",
};

const pageTitleSx = {
	color: "#fff",
	fontSize: {
		xs: "24px",
		md: "32px",
	},
	fontWeight: 950,
	lineHeight: 1.05,
	letterSpacing: "-0.04em",
};

const pageSubSx = {
	mt: "8px",
	color: "rgba(255,255,255,.68)",
	fontSize: "13px",
	fontWeight: 650,
	lineHeight: 1.5,
	maxWidth: "760px",
};

const heroActionsSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "flex-end",
	gap: "8px",
	flexWrap: "wrap",
};

const rangeSwitchSx = {
	display: "flex",
	alignItems: "center",
	gap: "4px",
	p: "4px",
	borderRadius: 999,
	background: "rgba(15,23,42,.82)",
	border: "1px solid rgba(255,255,255,.08)",
};

const rangeBtnStyle = (active) => ({
	height: 30,
	padding: "0 12px",
	borderRadius: 999,
	border: active
		? "1px solid rgba(59,130,246,.40)"
		: "1px solid transparent",
	background: active
		? "linear-gradient(135deg,#2563eb,#3b82f6)"
		: "transparent",
	color: "#fff",
	fontWeight: 850,
	fontSize: 11,
	cursor: "pointer",
	boxShadow: active ? "0 8px 18px rgba(37,99,235,.26)" : "none",
});

const primaryBtnSx = {
	height: "38px",
	borderRadius: "9px",
	px: "14px",
	textTransform: "none",
	fontWeight: 850,
	color: "#fff",
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	boxShadow: "0 10px 22px rgba(37,99,235,.30)",

	"&:hover": {
		background: "linear-gradient(135deg,#1d4ed8,#2563eb)",
	},
};

const secondaryBtnSx = {
	height: "38px",
	borderRadius: "9px",
	px: "14px",
	textTransform: "none",
	fontWeight: 850,
	color: "#fff",
	background: "rgba(255,255,255,.04)",
	border: "1px solid rgba(255,255,255,.08)",

	"&:hover": {
		background: "rgba(59,130,246,.14)",
		borderColor: "rgba(59,130,246,.30)",
	},
};

const statsGridSx = {
	display: "grid",
	gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
	gap: "10px",

	"@media (max-width: 1500px)": {
		gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
	},

	"@media (max-width: 850px)": {
		gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
	},

	"@media (max-width: 540px)": {
		gridTemplateColumns: "1fr",
	},
};

const statCardStyle = (accent, active) => ({
	position: "relative",
	width: "100%",
	minHeight: 118,
	padding: "13px",
	borderRadius: 10,
	background: active
		? `linear-gradient(180deg, ${accent}20, rgba(15,23,42,.82))`
		: "rgba(15,23,42,.78)",
	border: active
		? `1px solid ${accent}66`
		: "1px solid rgba(255,255,255,.07)",
	boxShadow: active
		? `0 14px 28px ${accent}20`
		: "0 14px 28px rgba(2,6,23,.26)",
	backdropFilter: "blur(18px)",
	color: "#fff",
	textAlign: "left",
	cursor: "pointer",
	overflow: "hidden",
	fontFamily: "inherit",
	transition: "all .25s ease",
});

const statAccentStyle = (accent) => ({
	position: "absolute",
	top: 0,
	left: 0,
	right: 0,
	height: 3,
	background: accent,
});

const statIconSx = (accent) => ({
	width: "36px",
	height: "36px",
	borderRadius: "9px",
	display: "grid",
	placeItems: "center",
	background: `${accent}18`,
	color: accent,
	border: `1px solid ${accent}33`,
	mb: "9px",
});

const statTitleSx = {
	color: "rgba(255,255,255,.60)",
	fontSize: "10px",
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".08em",
};

const statValueSx = {
	mt: "5px",
	color: "#fff",
	fontSize: "24px",
	fontWeight: 950,
	lineHeight: 1,
};

const statSubSx = {
	mt: "5px",
	color: "rgba(255,255,255,.54)",
	fontSize: "11px",
	fontWeight: 650,
};

const statHintSx = {
	mt: "8px",
	color: "rgba(255,255,255,.72)",
	fontSize: "10.5px",
	fontWeight: 850,
};

const insightCardSx = (accent) => ({
	p: "15px",
	borderRadius: "10px",
	background:
		"linear-gradient(180deg, rgba(255,255,255,.05), rgba(15,23,42,.78))",
	border: `1px solid ${accent}55`,
	boxShadow: `0 14px 28px ${accent}16`,
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "14px",
	flexWrap: "wrap",
});

const insightTitleSx = {
	color: "#fff",
	fontSize: "17px",
	fontWeight: 900,
};

const insightSubSx = {
	mt: "4px",
	color: "rgba(255,255,255,.58)",
	fontSize: "12px",
	fontWeight: 650,
	maxWidth: "780px",
	lineHeight: 1.45,
};

const insightValueBoxSx = {
	minWidth: "130px",
	p: "12px",
	borderRadius: "9px",
	background: "rgba(255,255,255,.05)",
	border: "1px solid rgba(255,255,255,.08)",
};

const insightValueLabelSx = {
	color: "rgba(255,255,255,.58)",
	fontSize: "10px",
	fontWeight: 850,
	textTransform: "uppercase",
	letterSpacing: ".07em",
};

const insightValueSx = {
	mt: "5px",
	color: "#fff",
	fontSize: "22px",
	fontWeight: 950,
};

const analyticsGridSx = {
	display: "grid",
	gridTemplateColumns: "minmax(0, 1.6fr) minmax(320px, .8fr)",
	gap: "14px",
	alignItems: "stretch",

	"@media (max-width: 1180px)": {
		gridTemplateColumns: "1fr",
	},
};

const threePanelGridSx = {
	display: "grid",
	gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
	gap: "14px",
	alignItems: "stretch",

	"@media (max-width: 1180px)": {
		gridTemplateColumns: "1fr",
	},
};

const panelSx = {
	height: "100%",
	p: "15px",
	borderRadius: "10px",
	background: "rgba(15,23,42,.78)",
	border: "1px solid rgba(255,255,255,.07)",
	boxShadow: "0 14px 28px rgba(2,6,23,.26)",
	backdropFilter: "blur(18px)",
	overflow: "hidden",
};

const warningPanelSx = {
	...panelSx,
	background:
		"linear-gradient(180deg, rgba(239,68,68,.11), rgba(15,23,42,.78))",
	border: "1px solid rgba(239,68,68,.22)",
};

const panelHeaderSx = {
	display: "flex",
	alignItems: "flex-start",
	justifyContent: "space-between",
	gap: "12px",
	mb: "12px",
};

const panelTitleSx = {
	color: "#fff",
	fontSize: "17px",
	fontWeight: 950,
	letterSpacing: "-0.02em",
};

const panelSubSx = {
	mt: "3px",
	color: "rgba(255,255,255,.55)",
	fontSize: "11px",
	fontWeight: 650,
	lineHeight: 1.4,
};

const panelIconSx = {
	width: "36px",
	height: "36px",
	borderRadius: "9px",
	display: "grid",
	placeItems: "center",
	color: "#93c5fd",
	background: "rgba(59,130,246,.12)",
	border: "1px solid rgba(59,130,246,.22)",
};

const warningIconSx = {
	...panelIconSx,
	color: "#fca5a5",
	background: "rgba(239,68,68,.12)",
	border: "1px solid rgba(239,68,68,.22)",
};

const barChartSx = {
	height: "240px",
	display: "grid",
	gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
	gap: "10px",
	alignItems: "end",
	pt: "10px",
};

const barItemSx = {
	height: "100%",
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "flex-end",
	gap: "8px",
};

const barTrackSx = {
	width: "100%",
	maxWidth: "54px",
	height: "190px",
	borderRadius: "10px",
	background: "rgba(255,255,255,.04)",
	border: "1px solid rgba(255,255,255,.06)",
	display: "flex",
	alignItems: "flex-end",
	overflow: "hidden",
};

const barFillSx = {
	width: "100%",
	borderRadius: "10px 10px 0 0",
	background: "linear-gradient(180deg,#60a5fa 0%,#2563eb 100%)",
	boxShadow: "0 -10px 26px rgba(37,99,235,.28)",
};

const barLabelSx = {
	color: "rgba(255,255,255,.62)",
	fontSize: "11px",
	fontWeight: 800,
};

const splitListSx = {
	display: "flex",
	flexDirection: "column",
	gap: "11px",
};

const splitItemSx = {
	display: "flex",
	flexDirection: "column",
	gap: "6px",
};

const splitTopSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "8px",
};

const splitNameSx = {
	display: "flex",
	alignItems: "center",
	gap: "7px",
	color: "#fff",
	fontSize: "12px",
	fontWeight: 850,
};

const splitValueSx = {
	color: "rgba(255,255,255,.70)",
	fontSize: "11px",
	fontWeight: 800,
};

const dotStyle = (accent) => ({
	width: 8,
	height: 8,
	borderRadius: 999,
	background: accent,
	boxShadow: `0 0 12px ${accent}`,
});

const progressSx = (accent) => ({
	height: "7px",
	borderRadius: 999,
	background: "rgba(255,255,255,.06)",

	"& .MuiLinearProgress-bar": {
		borderRadius: 999,
		background: accent,
	},
});

const workflowListSx = {
	display: "flex",
	flexDirection: "column",
	gap: "11px",
};

const workflowItemSx = {
	display: "flex",
	flexDirection: "column",
	gap: "6px",
};

const workflowTextRowSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
};

const workflowLabelSx = {
	color: "rgba(255,255,255,.72)",
	fontSize: "12px",
	fontWeight: 800,
};

const workflowValueSx = {
	color: "#fff",
	fontSize: "13px",
	fontWeight: 950,
};

const missingListSx = {
	display: "flex",
	flexDirection: "column",
	gap: "8px",
	mb: "12px",
};

const missingItemSx = {
	p: "12px",
	borderRadius: "8px",
	background: "rgba(2,6,23,.38)",
	border: "1px solid rgba(239,68,68,.18)",
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "8px",
};

const missingTitleSx = {
	color: "#fff",
	fontSize: "12px",
	fontWeight: 850,
};

const missingSubSx = {
	mt: "2px",
	color: "rgba(255,255,255,.50)",
	fontSize: "10.5px",
	fontWeight: 650,
};

const missingChipSx = {
	height: "22px",
	borderRadius: 999,
	background: "rgba(239,68,68,.14)",
	color: "#fca5a5",
	border: "1px solid rgba(239,68,68,.24)",
	fontWeight: 850,
	fontSize: "10px",
};

const warningBtnSx = {
	height: "38px",
	borderRadius: "9px",
	background: "rgba(239,68,68,.16)",
	color: "#fca5a5",
	border: "1px solid rgba(239,68,68,.28)",
	textTransform: "none",
	fontWeight: 900,
	fontSize: "12px",

	"&:hover": {
		background: "rgba(239,68,68,.24)",
	},
};

const quickActionListSx = {
	display: "flex",
	flexDirection: "column",
	gap: "8px",
};

const quickActionStyle = {
	width: "100%",
	minHeight: 54,
	padding: "10px 12px",
	borderRadius: 8,
	background: "rgba(255,255,255,.04)",
	border: "1px solid rgba(255,255,255,.07)",
	color: "#fff",
	display: "flex",
	alignItems: "center",
	gap: 10,
	textAlign: "left",
	cursor: "pointer",
	fontFamily: "inherit",
	transition: "all .22s ease",
};

const quickActionIconStyle = {
	width: 32,
	height: 32,
	borderRadius: 8,
	background: "rgba(59,130,246,.13)",
	border: "1px solid rgba(59,130,246,.20)",
	color: "#93c5fd",
	display: "grid",
	placeItems: "center",
	flexShrink: 0,
};

const quickActionTitleStyle = {
	display: "block",
	color: "#fff",
	fontSize: "12px",
	fontWeight: 900,
};

const quickActionSubStyle = {
	display: "block",
	marginTop: 3,
	color: "rgba(255,255,255,.52)",
	fontSize: "10.5px",
	fontWeight: 650,
	lineHeight: 1.3,
};

const tableSx = {
	overflowX: "auto",
	borderRadius: "9px",
	border: "1px solid rgba(255,255,255,.07)",
};

const tableHeadSx = {
	minWidth: 920,
	display: "grid",
	gridTemplateColumns:
		"minmax(260px, 1.6fr) 140px 120px 150px 150px 160px",
	background: "rgba(2,6,23,.36)",
	color: "rgba(255,255,255,.55)",
	fontSize: "10px",
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".07em",

	"& > div": {
		padding: "12px 14px",
	},
};

const tableRowSx = {
	minWidth: 920,
	display: "grid",
	gridTemplateColumns:
		"minmax(260px, 1.6fr) 140px 120px 150px 150px 160px",
	alignItems: "center",
	borderTop: "1px solid rgba(255,255,255,.06)",
	background: "rgba(255,255,255,.025)",

	"& > p, & > div": {
		padding: "12px 14px",
	},
};

const productNameSx = {
	color: "#fff",
	fontSize: "13px",
	fontWeight: 900,
};

const tableTextSx = {
	color: "rgba(255,255,255,.68)",
	fontSize: "12px",
	fontWeight: 700,
};

const costTextSx = {
	color: "#4ade80",
	fontSize: "12px",
	fontWeight: 900,
	fontFamily: "monospace",
};

const statusChipSx = (status) => {
	if (status === "Approved") {
		return {
			height: "22px",
			borderRadius: 999,
			background: "rgba(34,197,94,.14)",
			color: "#4ade80",
			border: "1px solid rgba(34,197,94,.24)",
			fontWeight: 850,
			fontSize: "10px",
		};
	}

	if (status === "Review") {
		return {
			height: "22px",
			borderRadius: 999,
			background: "rgba(168,85,247,.14)",
			color: "#c084fc",
			border: "1px solid rgba(168,85,247,.24)",
			fontWeight: 850,
			fontSize: "10px",
		};
	}

	return {
		height: "22px",
		borderRadius: 999,
		background: "rgba(245,158,11,.14)",
		color: "#fbbf24",
		border: "1px solid rgba(245,158,11,.24)",
		fontWeight: 850,
		fontSize: "10px",
	};
};