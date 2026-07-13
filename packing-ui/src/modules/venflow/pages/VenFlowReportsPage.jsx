import React, { useEffect, useMemo, useState } from "react";

import {
	Alert,
	Box,
	Button,
	Card,
	Chip,
	CircularProgress,
	Divider,
	MenuItem,
	TextField,
	Typography,
} from "@mui/material";

import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import PrecisionManufacturingOutlinedIcon from "@mui/icons-material/PrecisionManufacturingOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";

import { venflowApi } from "../api/venflowApi";

import {
	darkMenuProps,
	errorAlertSx,
	fieldSx,
	loadingBoxSx,
	outlineBtnSx,
	pageSubSx,
	pageTitleSx,
	premiumScrollbarSx,
	primaryBtnSx,
} from "../venflowTheme";

const safeNumber = (value) => {
	const numberValue = Number(value || 0);
	return Number.isFinite(numberValue) ? numberValue : 0;
};

const percent = (value, total) => {
	const totalNumber = safeNumber(total);
	if (totalNumber <= 0) return 0;

	return Math.round((safeNumber(value) / totalNumber) * 100);
};

const todayIso = () => {
	const date = new Date();
	return date.toISOString().slice(0, 10);
};

const daysAgoIso = (days) => {
	const date = new Date();
	date.setDate(date.getDate() - days);
	return date.toISOString().slice(0, 10);
};

const readLocalPlantCodes = () => {
	try {
		const raw = JSON.parse(localStorage.getItem("plantCodes") || "[]");
		if (!Array.isArray(raw)) return [];

		return Array.from(
			new Set(
				raw
					.map((item) => String(item || "").trim().toUpperCase())
					.filter(Boolean)
			)
		);
	} catch {
		return [];
	}
};

const readError = (err, fallback) => {
	const data = err?.response?.data;

	if (typeof data === "string") return data;

	return data?.message || data?.error || err?.message || fallback;
};

export default function VenFlowReportsPage() {
	const [summary, setSummary] = useState(null);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState("");

	const [filters, setFilters] = useState({
		plantCode: "",
		fromDate: daysAgoIso(7),
		toDate: todayIso(),
	});

	const plantOptions = useMemo(() => readLocalPlantCodes(), []);

	const load = async (silent = false) => {
		try {
			if (silent) {
				setRefreshing(true);
			} else {
				setLoading(true);
			}

			setError("");

			const res =
				await venflowApi.getReportSummary({
					plantCode:
						filters.plantCode ||
						undefined,

					fromDate:
						filters.fromDate ||
						undefined,

					toDate:
						filters.toDate ||
						undefined,
				});
			setSummary(res.data || {});
		} catch (err) {
			setSummary({});
			setError(readError(err, "Unable to load VenFlow reports."));
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	};

	useEffect(() => {
		let active = true;

		const loadInitial = async () => {
			try {
				setLoading(true);
				setError("");

				const res =
					await venflowApi.getReportSummary({
						plantCode:
							filters.plantCode ||
							undefined,

						fromDate:
							filters.fromDate ||
							undefined,

						toDate:
							filters.toDate ||
							undefined,
					});

				if (!active) return;

				setSummary(res.data || {});
			} catch (err) {
				if (!active) return;

				setSummary({});
				setError(readError(err, "Unable to load VenFlow reports."));
			} finally {
				if (active) {
					setLoading(false);
				}
			}
		};

		loadInitial();

		return () => {
			active = false;
		};
	}, []);

	const totalOrders = safeNumber(summary?.totalOrders);
	const totalPending = safeNumber(summary?.totalPendingWorkLoading);
	const jobDone = safeNumber(summary?.jobDone);
	const delayedItems = safeNumber(summary?.delayedItems);

	const completedPercent = percent(jobDone, totalOrders);
	const pendingPercent = percent(totalPending, totalOrders);
	const delayedPercent = percent(delayedItems, totalPending || totalOrders);

	const cards = [
		{
			label: "Total Orders",
			value: summary?.totalOrders,
			subtle: "All veneer requirements",
			icon: <AssessmentOutlinedIcon />,
			accent: "#3b82f6",
			trend: "Live order base",
		},
		{
			label: "Pending Store Check",
			value: summary?.pendingStoreCheck,
			subtle: "Production raised but Store pending",
			icon: <StorefrontOutlinedIcon />,
			accent: "#f59e0b",
			trend: "Store action required",
		},
		{
			label: "Sent to Purchase",
			value: summary?.sentToPurchase,
			subtle: "Store forwarded to Purchase",
			icon: <ShoppingCartOutlinedIcon />,
			accent: "#8b5cf6",
			trend: "Purchase queue",
		},
		{
			label: "Pending PO Raise",
			value: summary?.pendingPoRaise,
			subtle: "Purchase has not raised PO",
			icon: <PendingActionsOutlinedIcon />,
			accent: "#fb7185",
			trend: "PO creation pending",
		},
		{
			label: "Pending PO Approval",
			value: summary?.pendingPoApproval,
			subtle: "PO raised but not approved",
			icon: <WarningAmberOutlinedIcon />,
			accent: "#f97316",
			trend: "Manager sign-off",
		},
		{
			label: "Pending Material Receiving",
			value: summary?.pendingMaterialReceiving,
			subtle: "PO approved, receiving pending",
			icon: <LocalShippingOutlinedIcon />,
			accent: "#06b6d4",
			trend: "Inbound material",
		},
		{
			label: "Material Received Not Informed",
			value: summary?.materialReceivedNotInformed,
			subtle: "Store received but Production not informed",
			icon: <Inventory2OutlinedIcon />,
			accent: "#38bdf8",
			trend: "Store to Production handover",
		},
		{
			label: "Production Not Started",
			value: summary?.productionNotStarted,
			subtle: "Production informed but not started",
			icon: <PrecisionManufacturingOutlinedIcon />,
			accent: "#60a5fa",
			trend: "Start pending",
		},
		{
			label: "Production Started",
			value: summary?.productionStarted,
			subtle: "Work started but not done",
			icon: <TimelineOutlinedIcon />,
			accent: "#22c55e",
			trend: "Work in progress",
		},
		{
			label: "Job Done",
			value: summary?.jobDone,
			subtle: "Closed production jobs",
			icon: <CheckCircleOutlineOutlinedIcon />,
			accent: "#34d399",
			trend: `${completedPercent}% completion`,
		},
		{
			label: "Delayed Items",
			value: summary?.delayedItems,
			subtle: "Expected date crossed",
			icon: <WarningAmberOutlinedIcon />,
			accent: "#ef4444",
			trend: `${delayedPercent}% delay risk`,
		},
		{
			label: "Total Pending Work Loading",
			value: summary?.totalPendingWorkLoading,
			subtle: "Everything except Job Done",
			icon: <PendingActionsOutlinedIcon />,
			accent: "#facc15",
			trend: `${pendingPercent}% active load`,
		},
	];

	const exports = [
		{
			title: "Total Orders List",
			subtitle: "Complete VenFlow requirement register",
			tag: "Master",
		},
		{
			title: "Date-wise Order Log",
			subtitle: "Daily created and updated requirement movement",
			tag: "Timeline",
		},
		{
			title: "Daily Production Done",
			subtitle: "Production closure and completed job report",
			tag: "Production",
		},
		{
			title: "Total Pending Work Loading",
			subtitle: "Open workload excluding completed jobs",
			tag: "WIP",
		},
		{
			title: "Purchase Pending Report",
			subtitle: "Entries pending PO raise or approval",
			tag: "Purchase",
		},
		{
			title: "Store Pending Report",
			subtitle: "Store review, receiving and inform-production pending",
			tag: "Store",
		},
		{
			title: "Production Pending Report",
			subtitle: "Production informed, started and closure pending",
			tag: "Production",
		},
		{
			title: "Plant-wise Excel Export",
			subtitle: "Plant-level access-wise summary export",
			tag: "Plant",
		},
	];

	if (loading) {
		return (
			<Box sx={loadingBoxSx}>
				<CircularProgress />
			</Box>
		);
	}

	return (
		<Box sx={pageSx}>
			<Box sx={topBarSx}>
				<Box>
					<Typography sx={pageTitleSx}>
						Reports Dashboard
					</Typography>

					<Typography sx={pageSubSx}>
						Plant-wise and access-wise reporting for veneer requirement,
						Store review, Purchase PO, material receiving and Production closure.
					</Typography>
				</Box>

				<Box sx={filterStripSx}>
					<TextField
						select
						size="small"
						label="Plant"
						value={filters.plantCode}
						onChange={(e) =>
							setFilters((prev) => ({
								...prev,
								plantCode: e.target.value,
							}))
						}
						sx={compactFieldSx}
						SelectProps={{ MenuProps: darkMenuProps }}
					>
						<MenuItem value="">All Plants</MenuItem>

						{plantOptions.map((plant) => (
							<MenuItem key={plant} value={plant}>
								{plant}
							</MenuItem>
						))}
					</TextField>

					<TextField
						size="small"
						type="date"
						label="From"
						value={filters.fromDate}
						onChange={(e) =>
							setFilters((prev) => ({
								...prev,
								fromDate: e.target.value,
							}))
						}
						InputLabelProps={{ shrink: true }}
						sx={compactFieldSx}
					/>

					<TextField
						size="small"
						type="date"
						label="To"
						value={filters.toDate}
						onChange={(e) =>
							setFilters((prev) => ({
								...prev,
								toDate: e.target.value,
							}))
						}
						InputLabelProps={{ shrink: true }}
						sx={compactFieldSx}
					/>

					<Button
						startIcon={<RefreshOutlinedIcon />}
						onClick={() => load(true)}
						disabled={refreshing}
						sx={primaryBtnSx}
					>
						{refreshing ? "Refreshing..." : "Refresh"}
					</Button>
				</Box>
			</Box>

			{error && (
				<Alert severity="error" sx={errorAlertSx}>
					{error}
				</Alert>
			)}

			<Box sx={commandPanelSx}>
				<Box sx={commandLeftSx}>
					<Box sx={commandIconSx}>
						<FilterAltOutlinedIcon />
					</Box>

					<Box>
						<Typography sx={commandTitleSx}>
							Report Control Center
						</Typography>

						<Typography sx={commandSubSx}>
							Currently showing summary numbers from VenFlow report API.
							Plant and date controls are ready for backend filtering when detailed exports are connected.
						</Typography>
					</Box>
				</Box>

				<Box sx={commandMetricsSx}>
					<MiniMetric
						label="Completion"
						value={`${completedPercent}%`}
						accent="#22c55e"
					/>
					<MiniMetric
						label="Pending Load"
						value={`${pendingPercent}%`}
						accent="#facc15"
					/>
					<MiniMetric
						label="Delay Risk"
						value={`${delayedPercent}%`}
						accent="#ef4444"
					/>
				</Box>
			</Box>

			<Box sx={mainGridSx}>
				<Box sx={leftColumnSx}>
					<Box sx={kpiGridSx}>
						{cards.map((card) => (
							<ReportKpiCard key={card.label} card={card} />
						))}
					</Box>

					<Card sx={exportsPanelSx}>
						<Box sx={sectionHeaderSx}>
							<Box>
								<Typography sx={sectionTitleSx}>
									Next detailed exports
								</Typography>

								<Typography sx={sectionSubSx}>
									Quick-access export structure for detailed operational reporting.
								</Typography>
							</Box>

							<Chip
								label="Export module ready"
								size="small"
								sx={softChipSx("#3b82f6")}
							/>
						</Box>

						<Box sx={exportsGridSx}>
							{exports.map((item, index) => (
								<Box key={item.title} sx={exportItemSx}>
									<Box sx={exportIndexSx}>
										{index + 1}
									</Box>

									<Box sx={{ minWidth: 0, flex: 1 }}>
										<Typography sx={exportTitleSx}>
											{item.title}
										</Typography>

										<Typography sx={exportSubSx}>
											{item.subtitle}
										</Typography>
									</Box>

									<Chip
										label={item.tag}
										size="small"
										sx={softChipSx("#60a5fa")}
									/>

									<Button
										startIcon={<DownloadOutlinedIcon />}
										sx={exportBtnSx}
									>
										Export
									</Button>
								</Box>
							))}
						</Box>
					</Card>
				</Box>

				<Box sx={rightColumnSx}>
					<Card sx={insightCardSx}>
						<Box sx={sectionHeaderSx}>
							<Box>
								<Typography sx={sectionTitleSx}>
									Operational Snapshot
								</Typography>

								<Typography sx={sectionSubSx}>
									Live balance between pending work, completed work and delayed items.
								</Typography>
							</Box>

							<CalendarMonthOutlinedIcon sx={{ color: "#60a5fa" }} />
						</Box>

						<Box sx={donutAreaSx}>
							<Box sx={donutSx(completedPercent)}>
								<Box sx={donutInnerSx}>
									<Typography sx={donutValueSx}>
										{completedPercent}%
									</Typography>

									<Typography sx={donutLabelSx}>
										Completed
									</Typography>
								</Box>
							</Box>

							<Box sx={legendSx}>
								<LegendRow color="#22c55e" label="Job Done" value={jobDone} />
								<LegendRow color="#facc15" label="Pending Work" value={totalPending} />
								<LegendRow color="#ef4444" label="Delayed Items" value={delayedItems} />
								<Divider sx={{ borderColor: "rgba(255,255,255,.08)", my: 1 }} />
								<LegendRow color="#60a5fa" label="Total Orders" value={totalOrders} />
							</Box>
						</Box>
					</Card>

					<Card sx={trendCardSx}>
						<Box sx={sectionHeaderSx}>
							<Box>
								<Typography sx={sectionTitleSx}>
									Pending Work Loading Trend
								</Typography>

								<Typography sx={sectionSubSx}>
									Visual trend placeholder for daily pending workload movement.
								</Typography>
							</Box>

							<Chip label="Daily" size="small" sx={softChipSx("#8b5cf6")} />
						</Box>

						<Box sx={chartWrapSx}>
							<svg width="100%" height="160" viewBox="0 0 520 160">
								<defs>
									<linearGradient id="venflowReportLine" x1="0" y1="0" x2="1" y2="0">
										<stop offset="0%" stopColor="#38bdf8" />
										<stop offset="50%" stopColor="#3b82f6" />
										<stop offset="100%" stopColor="#8b5cf6" />
									</linearGradient>
									<linearGradient id="venflowReportArea" x1="0" y1="0" x2="0" y2="1">
										<stop offset="0%" stopColor="rgba(59,130,246,.34)" />
										<stop offset="100%" stopColor="rgba(59,130,246,0)" />
									</linearGradient>
								</defs>

								<path
									d="M20 132 L20 102 C70 92 78 50 122 56 C162 62 165 36 210 43 C252 50 265 82 306 74 C350 66 365 52 405 66 C445 80 468 88 500 56 L500 132 Z"
									fill="url(#venflowReportArea)"
								/>

								<polyline
									fill="none"
									stroke="url(#venflowReportLine)"
									strokeWidth="4"
									strokeLinecap="round"
									strokeLinejoin="round"
									points="20,102 75,78 130,56 185,48 240,68 295,74 350,62 405,66 460,84 500,56"
								/>

								{[
									[20, 102],
									[75, 78],
									[130, 56],
									[185, 48],
									[240, 68],
									[295, 74],
									[350, 62],
									[405, 66],
									[460, 84],
									[500, 56],
								].map(([x, y], index) => (
									<circle
										key={`${x}-${y}-${index}`}
										cx={x}
										cy={y}
										r="5"
										fill="#0f172a"
										stroke="#60a5fa"
										strokeWidth="3"
									/>
								))}
							</svg>
						</Box>

						<Box sx={trendFooterSx}>
							<TrendPill label="Total Pending" value={totalPending} accent="#facc15" />
							<TrendPill label="Delayed" value={delayedItems} accent="#ef4444" />
							<TrendPill label="Closed" value={jobDone} accent="#22c55e" />
						</Box>
					</Card>

					<Card sx={notePanelSx}>
						<Typography sx={noteTitleSx}>
							Report note
						</Typography>

						<Typography sx={noteTextSx}>
							This page is now prepared for the next phase: downloadable Excel/PDF exports,
							plant-wise filters, date-wise logs and department-wise workload reports.
						</Typography>
					</Card>
				</Box>
			</Box>
		</Box>
	);
}

function ReportKpiCard({ card }) {
	return (
		<Card sx={kpiCardSx(card.accent)}>
			<Box sx={kpiGlowSx(card.accent)} />

			<Box sx={kpiTopSx}>
				<Box>
					<Typography sx={kpiLabelSx}>
						{card.label}
					</Typography>

					<Typography sx={kpiValueSx}>
						{card.value ?? 0}
					</Typography>
				</Box>

				<Box sx={kpiIconSx(card.accent)}>
					{card.icon}
				</Box>
			</Box>

			<Typography sx={kpiSubtleSx}>
				{card.subtle}
			</Typography>

			<Box sx={kpiFooterSx}>
				<Typography sx={kpiTrendSx(card.accent)}>
					▲ {card.trend}
				</Typography>

				<MiniSpark accent={card.accent} />
			</Box>
		</Card>
	);
}

function MiniSpark({ accent }) {
	return (
		<Box sx={sparkSx}>
			<svg width="100%" height="34" viewBox="0 0 120 34">
				<polyline
					fill="none"
					stroke={accent}
					strokeWidth="3"
					strokeLinecap="round"
					strokeLinejoin="round"
					points="0,24 10,18 20,22 30,12 40,15 50,9 60,20 70,13 80,17 90,8 100,13 110,6 120,10"
				/>
			</svg>
		</Box>
	);
}

function MiniMetric({ label, value, accent }) {
	return (
		<Box sx={miniMetricSx(accent)}>
			<Typography sx={miniMetricLabelSx}>
				{label}
			</Typography>

			<Typography sx={miniMetricValueSx}>
				{value}
			</Typography>
		</Box>
	);
}

function LegendRow({ color, label, value }) {
	return (
		<Box sx={legendRowSx}>
			<Box sx={legendNameSx}>
				<span
					style={{
						width: 9,
						height: 9,
						borderRadius: 999,
						background: color,
						display: "inline-block",
						boxShadow: `0 0 14px ${color}66`,
					}}
				/>
				{label}
			</Box>

			<Typography sx={legendValueSx}>
				{value ?? 0}
			</Typography>
		</Box>
	);
}

function TrendPill({ label, value, accent }) {
	return (
		<Box sx={trendPillSx(accent)}>
			<Typography sx={trendPillLabelSx}>
				{label}
			</Typography>

			<Typography sx={trendPillValueSx}>
				{value ?? 0}
			</Typography>
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

const topBarSx = {
	display: "flex",
	alignItems: "flex-start",
	justifyContent: "space-between",
	gap: "18px",
	flexWrap: "wrap",
};

const filterStripSx = {
	display: "flex",
	alignItems: "center",
	gap: "10px",
	flexWrap: "wrap",
	p: "10px",
	borderRadius: "16px",
	background: "rgba(15,23,42,.70)",
	border: "1px solid rgba(255,255,255,.07)",
	boxShadow: "0 16px 34px rgba(2,6,23,.30)",
};

const compactFieldSx = {
	...fieldSx,
	minWidth: 150,

	"& .MuiOutlinedInput-root": {
		...fieldSx["& .MuiOutlinedInput-root"],
		minHeight: "38px",
		borderRadius: "11px",
	},
};

const commandPanelSx = {
	p: "14px",
	borderRadius: "16px",
	background:
		"linear-gradient(135deg, rgba(37,99,235,.16), rgba(15,23,42,.72))",
	border: "1px solid rgba(59,130,246,.22)",
	boxShadow: "0 18px 42px rgba(2,6,23,.34)",
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "14px",
	flexWrap: "wrap",
};

const commandLeftSx = {
	display: "flex",
	alignItems: "center",
	gap: "12px",
	minWidth: 0,
};

const commandIconSx = {
	width: 46,
	height: 46,
	borderRadius: "14px",
	display: "grid",
	placeItems: "center",
	background: "rgba(59,130,246,.18)",
	border: "1px solid rgba(59,130,246,.34)",
	color: "#93c5fd",
	flexShrink: 0,
};

const commandTitleSx = {
	color: "#fff",
	fontSize: 15,
	fontWeight: 950,
};

const commandSubSx = {
	mt: "4px",
	color: "rgba(255,255,255,.58)",
	fontSize: 12,
	fontWeight: 650,
	lineHeight: 1.5,
};

const commandMetricsSx = {
	display: "flex",
	alignItems: "center",
	gap: "10px",
	flexWrap: "wrap",
};

const miniMetricSx = (accent) => ({
	minWidth: 120,
	p: "9px 11px",
	borderRadius: "12px",
	background: `${accent}12`,
	border: `1px solid ${accent}30`,
});

const miniMetricLabelSx = {
	color: "rgba(255,255,255,.58)",
	fontSize: 10,
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".05em",
};

const miniMetricValueSx = {
	mt: "4px",
	color: "#fff",
	fontSize: 18,
	fontWeight: 950,
};

const mainGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		xl: "minmax(0, 1.45fr) minmax(360px, .72fr)",
	},
	gap: "14px",
	alignItems: "start",
};

const leftColumnSx = {
	minWidth: 0,
	display: "flex",
	flexDirection: "column",
	gap: "14px",
};

const rightColumnSx = {
	minWidth: 0,
	display: "flex",
	flexDirection: "column",
	gap: "14px",
};

const kpiGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		sm: "repeat(2, minmax(0,1fr))",
		lg: "repeat(3, minmax(0,1fr))",
	},
	gap: "12px",
};

const kpiCardSx = (accent) => ({
	position: "relative",
	overflow: "hidden",
	minHeight: 150,
	p: "16px",
	borderRadius: "18px",
	background:
		"linear-gradient(180deg, rgba(30,41,59,.74), rgba(15,23,42,.80))",
	border: `1px solid ${accent}33`,
	boxShadow: "0 18px 38px rgba(2,6,23,.34)",
	color: "#fff",
	transition: "all .22s ease",

	"&:hover": {
		transform: "translateY(-3px)",
		borderColor: `${accent}66`,
		boxShadow: `0 22px 46px ${accent}1f`,
	},
});

const kpiGlowSx = (accent) => ({
	position: "absolute",
	right: -44,
	top: -48,
	width: 124,
	height: 124,
	borderRadius: "50%",
	background: `${accent}18`,
	filter: "blur(4px)",
});

const kpiTopSx = {
	position: "relative",
	zIndex: 1,
	display: "flex",
	alignItems: "flex-start",
	justifyContent: "space-between",
	gap: "10px",
};

const kpiIconSx = (accent) => ({
	width: 46,
	height: 46,
	borderRadius: "50%",
	display: "grid",
	placeItems: "center",
	background: `${accent}18`,
	color: accent,
	border: `1px solid ${accent}36`,
	boxShadow: `0 0 24px ${accent}20`,
	flexShrink: 0,
});

const kpiLabelSx = {
	color: "rgba(255,255,255,.68)",
	fontSize: 11,
	fontWeight: 950,
	textTransform: "uppercase",
	letterSpacing: ".07em",
	lineHeight: 1.35,
};

const kpiValueSx = {
	mt: "12px",
	fontSize: 34,
	fontWeight: 950,
	color: "#fff",
	lineHeight: 1,
	letterSpacing: "-0.04em",
};

const kpiSubtleSx = {
	position: "relative",
	zIndex: 1,
	mt: "12px",
	color: "rgba(255,255,255,.56)",
	fontSize: 12,
	fontWeight: 650,
	lineHeight: 1.45,
	minHeight: 35,
};

const kpiFooterSx = {
	position: "relative",
	zIndex: 1,
	mt: "8px",
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "10px",
};

const kpiTrendSx = (accent) => ({
	color: accent,
	fontSize: 10.5,
	fontWeight: 850,
});

const sparkSx = {
	width: 86,
	opacity: 0.9,
	flexShrink: 0,
};

const exportsPanelSx = {
	p: "16px",
	borderRadius: "18px",
	background: "rgba(15,23,42,.74)",
	border: "1px solid rgba(255,255,255,.07)",
	boxShadow: "0 18px 42px rgba(2,6,23,.34)",
	color: "#fff",
};

const sectionHeaderSx = {
	display: "flex",
	alignItems: "flex-start",
	justifyContent: "space-between",
	gap: "12px",
	flexWrap: "wrap",
	mb: "14px",
};

const sectionTitleSx = {
	color: "#fff",
	fontWeight: 950,
	fontSize: 18,
	letterSpacing: "-0.02em",
};

const sectionSubSx = {
	mt: "5px",
	color: "rgba(255,255,255,.54)",
	fontSize: 12,
	fontWeight: 650,
	lineHeight: 1.5,
};

const exportsGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		lg: "repeat(2, minmax(0,1fr))",
	},
	gap: "10px",
	maxHeight: 370,
	overflow: "auto",
	pr: "4px",
	...premiumScrollbarSx,
};

const exportItemSx = {
	display: "flex",
	alignItems: "center",
	gap: "12px",
	p: "12px",
	borderRadius: "14px",
	background: "rgba(255,255,255,.04)",
	border: "1px solid rgba(255,255,255,.07)",
	transition: "all .22s ease",

	"&:hover": {
		background: "rgba(59,130,246,.08)",
		borderColor: "rgba(59,130,246,.25)",
	},
};

const exportIndexSx = {
	width: 34,
	height: 34,
	borderRadius: "50%",
	display: "grid",
	placeItems: "center",
	background: "rgba(59,130,246,.16)",
	color: "#93c5fd",
	fontWeight: 950,
	fontSize: 12,
	border: "1px solid rgba(59,130,246,.24)",
	flexShrink: 0,
};

const exportTitleSx = {
	color: "#fff",
	fontWeight: 900,
	fontSize: 13,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const exportSubSx = {
	mt: "4px",
	color: "rgba(255,255,255,.48)",
	fontWeight: 650,
	fontSize: 11,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const exportBtnSx = {
	height: 32,
	borderRadius: "10px",
	textTransform: "none",
	fontWeight: 850,
	color: "#93c5fd",
	background: "rgba(59,130,246,.10)",
	border: "1px solid rgba(59,130,246,.22)",
	flexShrink: 0,

	"&:hover": {
		background: "rgba(59,130,246,.18)",
	},
};

const softChipSx = (color) => ({
	height: 24,
	borderRadius: 999,
	background: `${color}18`,
	color,
	border: `1px solid ${color}30`,
	fontWeight: 900,
	fontSize: 10.5,
});

const insightCardSx = {
	p: "16px",
	borderRadius: "18px",
	background: "rgba(15,23,42,.74)",
	border: "1px solid rgba(255,255,255,.07)",
	boxShadow: "0 18px 42px rgba(2,6,23,.34)",
	color: "#fff",
};

const donutAreaSx = {
	display: "flex",
	alignItems: "center",
	gap: "18px",
	flexWrap: "wrap",
};

const donutSx = (completed) => ({
	width: 150,
	height: 150,
	borderRadius: "50%",
	background: `conic-gradient(#22c55e ${completed}%, rgba(250,204,21,.88) ${completed}% ${Math.min(
		completed + 35,
		100
	)}%, rgba(239,68,68,.80) ${Math.min(completed + 35, 100)}% 100%)`,
	display: "grid",
	placeItems: "center",
	boxShadow: "0 0 40px rgba(34,197,94,.14)",
	flexShrink: 0,
});

const donutInnerSx = {
	width: 98,
	height: 98,
	borderRadius: "50%",
	background: "rgba(15,23,42,.96)",
	display: "grid",
	placeItems: "center",
	textAlign: "center",
	border: "1px solid rgba(255,255,255,.08)",
};

const donutValueSx = {
	color: "#fff",
	fontSize: 24,
	fontWeight: 950,
	lineHeight: 1,
};

const donutLabelSx = {
	color: "rgba(255,255,255,.58)",
	fontSize: 10.5,
	fontWeight: 850,
};

const legendSx = {
	flex: 1,
	minWidth: 210,
	display: "flex",
	flexDirection: "column",
	gap: "8px",
};

const legendRowSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "12px",
};

const legendNameSx = {
	display: "flex",
	alignItems: "center",
	gap: "9px",
	color: "rgba(255,255,255,.70)",
	fontSize: 12,
	fontWeight: 750,
};

const legendValueSx = {
	color: "#fff",
	fontSize: 13,
	fontWeight: 950,
};

const trendCardSx = {
	p: "16px",
	borderRadius: "18px",
	background: "rgba(15,23,42,.74)",
	border: "1px solid rgba(255,255,255,.07)",
	boxShadow: "0 18px 42px rgba(2,6,23,.34)",
	color: "#fff",
};

const chartWrapSx = {
	mt: "8px",
	p: "10px",
	borderRadius: "14px",
	background: "rgba(2,6,23,.22)",
	border: "1px solid rgba(255,255,255,.06)",
};

const trendFooterSx = {
	display: "grid",
	gridTemplateColumns: "repeat(3, minmax(0,1fr))",
	gap: "8px",
	mt: "10px",
};

const trendPillSx = (accent) => ({
	p: "10px",
	borderRadius: "12px",
	background: `${accent}12`,
	border: `1px solid ${accent}2e`,
});

const trendPillLabelSx = {
	color: "rgba(255,255,255,.54)",
	fontSize: 10,
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".04em",
};

const trendPillValueSx = {
	mt: "5px",
	color: "#fff",
	fontSize: 18,
	fontWeight: 950,
};

const notePanelSx = {
	p: "16px",
	borderRadius: "18px",
	background:
		"linear-gradient(135deg, rgba(59,130,246,.12), rgba(15,23,42,.72))",
	border: "1px solid rgba(59,130,246,.20)",
	boxShadow: "0 18px 42px rgba(2,6,23,.30)",
	color: "#fff",
};

const noteTitleSx = {
	color: "#bfdbfe",
	fontSize: 14,
	fontWeight: 950,
};

const noteTextSx = {
	mt: "8px",
	color: "rgba(255,255,255,.60)",
	fontSize: 12.5,
	fontWeight: 650,
	lineHeight: 1.7,
};