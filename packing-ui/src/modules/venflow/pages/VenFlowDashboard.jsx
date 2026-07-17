import React, {
	useEffect,
	useMemo,
	useState,
} from "react";

import {
	Box,
	Button,
	Card,
	CircularProgress,
	Typography,
} from "@mui/material";

import { useNavigate } from "react-router-dom";

import {
	getStageLabel,
} from "../venflowWorkflow";

import { venflowApi } from "../api/venflowApi";

import {
	loadingBoxSx,
	primaryBtnSx,
	secondaryBtnSx,
} from "../venflowTheme";

import {
	defaultVenFlowPathForRole,
	getVenFlowRole,
	isVenFlowAdminOrManager,
} from "../../../utils/venflowAccess";

import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import FactoryOutlinedIcon from "@mui/icons-material/FactoryOutlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";

const safeNumber = (value) => {
	const n = Number(value || 0);
	return Number.isFinite(n) ? n : 0;
};

const formatDateTime = (value) => {
	if (!value) return "-";

	return String(value)
		.replace("T", " ")
		.slice(0, 16);
};

const isDelayed = (row) => {
	if (!row?.expectedDate) return false;

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const expected = new Date(row.expectedDate);
	expected.setHours(0, 0, 0, 0);

	return expected < today && row.stage !== "READY_FOR_NEXT_STAGE";
};

export default function VenFlowDashboard() {
	const navigate = useNavigate();

	const [data, setData] = useState({});
	const [recentRows, setRecentRows] = useState([]);
	const [loading, setLoading] = useState(true);

	const role = getVenFlowRole();
	const isAdminManager = isVenFlowAdminOrManager(role);

	const canCreate =
		isAdminManager ||
		role === "VENFLOW_ENGINEERING";

	const load = async () => {
		try {
			setLoading(true);

			const [dashRes, entriesRes] = await Promise.allSettled([
				venflowApi.getDashboard(),
				venflowApi.getEntries({
					page: 0,
					size: 8,
				}),
			]);

			if (dashRes.status === "fulfilled") {
				setData(dashRes.value.data || {});
			}

			if (entriesRes.status === "fulfilled") {
				setRecentRows(entriesRes.value.data?.content || []);
			}
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, []);

	const cards = useMemo(
		() => [
			{
				label: "Total Orders",
				value: data.totalEntries,
				subtle: "All plant-wise veneer requirements",
				accent: "#3b82f6",
				icon: <LayersOutlinedIcon />,
			},
			{
				label: "Pending Store Check",
				value: data.pendingStoreCheck,
				subtle: "Production raised, Store pending",
				accent: "#f59e0b",
				icon: <StorefrontOutlinedIcon />,
			},
			{
				label: "Sent to Purchase",
				value: data.sentToPurchase,
				subtle: "Store forwarded to Purchase",
				accent: "#a78bfa",
				icon: <ShoppingCartOutlinedIcon />,
			},
			{
				label: "Pending PO Raise",
				value: data.pendingPoRaise,
				subtle: "Purchase has not raised PO",
				accent: "#fb7185",
				icon: <DescriptionOutlinedIcon />,
			},
			{
				label: "Pending PO Approval",
				value: data.pendingPoApproval,
				subtle: "PO raised, approval pending",
				accent: "#f97316",
				icon: <VerifiedUserOutlinedIcon />,
			},
			{
				label: "Pending Receiving",
				value: data.pendingMaterialReceiving,
				subtle: "PO approved, Store receiving pending",
				accent: "#06b6d4",
				icon: <LocalShippingOutlinedIcon />,
			},
			{
				label: "Production Not Started",
				value: data.productionNotStarted,
				subtle: "Material informed, start pending",
				accent: "#38bdf8",
				icon: <FactoryOutlinedIcon />,
			},
			{
				label: "Production Started",
				value: data.productionStarted,
				subtle: "Work in progress",
				accent: "#22c55e",
				icon: <EngineeringOutlinedIcon />,
			},
			{
				label: "Job Done",
				value: data.jobDone,
				subtle: "Completed production work",
				accent: "#34d399",
				icon: <CheckCircleOutlineOutlinedIcon />,
			},
			{
				label: "Delayed Items",
				value: data.delayedItems,
				subtle: "Expected date crossed",
				accent: "#ef4444",
				icon: <AccessTimeOutlinedIcon />,
			},
			{
				label: "Pending Work Loading",
				value: data.totalPendingWorkLoading,
				subtle: "Everything except Job Done",
				accent: "#facc15",
				icon: <WarningAmberOutlinedIcon />,
			},
		],
		[data]
	);

	const total = safeNumber(data.totalEntries);
	const completed = safeNumber(data.jobDone);
	const delayed = safeNumber(data.delayedItems);
	const inProgress = safeNumber(data.productionStarted);
	const pending = Math.max(total - completed - inProgress, 0);

	const delayedRows = recentRows.filter(isDelayed);

	if (loading) {
		return (
			<Box sx={loadingBoxSx}>
				<CircularProgress />
			</Box>
		);
	}

	return (
		<Box sx={pageSx}>
			<Box sx={heroSx}>
				<Box>
					<Typography sx={titleSx}>
						Veneer Dashboard
					</Typography>

					<Typography sx={subSx}>
						Live tracking of BOM / Indent creation, AKG Store review,
						purchase allocation, PO approval, receiving, GRN, allocation-level
						QC, issue to Production and process closure.
					</Typography>
				</Box>

				<Box sx={heroActionsSx}>
					<Button
						variant="contained"
						startIcon={<OpenInNewOutlinedIcon />}
						onClick={() =>
							navigate(defaultVenFlowPathForRole(role))
						}
						sx={primaryBtnSx}
					>
						Open My Work
					</Button>

					{canCreate && (
						<Button
							onClick={() => navigate("/venflow/create")}
							sx={secondaryBtnSx}
						>
							New Requirement
						</Button>
					)}
				</Box>
			</Box>

			<Box sx={kpiGridSx}>
				{cards.map((card) => (
					<KpiCard key={card.label} card={card} />
				))}
			</Box>

			<Box sx={middleGridSx}>
				<Card sx={panelSx}>
					<Box sx={panelHeaderSx}>
						<Typography sx={panelTitleSx}>
							Workflow Overview
						</Typography>

						<Box sx={periodPillSx}>
							Current Snapshot
						</Box>
					</Box>

					<Box sx={workflowBodySx}>
						<Box sx={donutSx(total, completed, inProgress, delayed)}>
							<Box sx={donutInnerSx}>
								<Typography sx={donutValueSx}>
									{total}
								</Typography>

								<Typography sx={donutLabelSx}>
									Total Orders
								</Typography>
							</Box>
						</Box>

						<Box sx={legendSx}>
							<LegendRow color="#22c55e" label="Completed" value={completed} total={total} />
							<LegendRow color="#3b82f6" label="In Progress" value={inProgress} total={total} />
							<LegendRow color="#94a3b8" label="Pending" value={pending} total={total} />
							<LegendRow color="#ef4444" label="Delayed" value={delayed} total={total} />
						</Box>
					</Box>

					<Box sx={miniMetricsSx}>
						<MiniMetric
							icon={<AccessTimeOutlinedIcon />}
							label="Average Cycle"
							value={
								data.averageCycleDays != null
									? `${data.averageCycleDays} days`
									: "—"
							}
							accent="#3b82f6"
						/>

						<MiniMetric
							icon={<CheckCircleOutlineOutlinedIcon />}
							label="On-Time Delivery"
							value={
								data.onTimeDeliveryPercent != null
									? `${data.onTimeDeliveryPercent}%`
									: "—"
							}
							accent="#22c55e"
						/>

						<MiniMetric
							icon={<WarningAmberOutlinedIcon />}
							label="Delayed Items"
							value={delayed}
							accent="#f59e0b"
						/>

						<MiniMetric
							icon={<VerifiedUserOutlinedIcon />}
							label="Data Completeness"
							value={
								data.dataCompletenessPercent != null
									? `${data.dataCompletenessPercent}%`
									: "—"
							}
							accent="#8b5cf6"
						/>
					</Box>
				</Card>

				<Card sx={panelSx}>
					<Box sx={panelHeaderSx}>
						<Typography sx={panelTitleSx}>
							Recent Activity
						</Typography>

						<Button
							onClick={() => navigate("/venflow/entries")}
							sx={viewAllBtnSx}
						>
							View All
						</Button>
					</Box>

					<Box sx={activityListSx}>
						{recentRows.slice(0, 5).map((row, index) => (
							<Box key={row.id || index} sx={activityItemSx}>
								<Box sx={activityDotSx(index)} />

								<Box sx={{ minWidth: 0, flex: 1 }}>
									<Typography sx={activityTitleSx}>
										{getStageLabel(row.stage)}
									</Typography>

									<Typography sx={activityMsgSx}>
										{row.pdNo || "-"} ·{" "}
										{row.materialName || row.clientName || "Veneer requirement"}
									</Typography>
								</Box>

								<Typography sx={activityTimeSx}>
									{formatDateTime(row.updatedAt || row.raisedAt)}
								</Typography>
							</Box>
						))}

						{recentRows.length === 0 && (
							<Typography sx={emptySx}>
								No recent activity found.
							</Typography>
						)}
					</Box>
				</Card>
			</Box>

			<Box sx={bottomGridSx}>
				<Card sx={panelSx}>
					<Box sx={panelHeaderSx}>
						<Typography sx={panelTitleSx}>
							At a Glance
						</Typography>
					</Box>

					<Box sx={glanceTableSx}>
						<GlanceRow label="Total Orders" count={total} percent={100} accent="#3b82f6" />
						<GlanceRow label="Pending Store Check" count={data.pendingStoreCheck} percent={percent(data.pendingStoreCheck, total)} accent="#f59e0b" />
						<GlanceRow label="Sent to Purchase" count={data.sentToPurchase} percent={percent(data.sentToPurchase, total)} accent="#a78bfa" />
						<GlanceRow label="Job Done" count={data.jobDone} percent={percent(data.jobDone, total)} accent="#22c55e" />
					</Box>
				</Card>

				<Card sx={panelSx}>
					<Box sx={panelHeaderSx}>
						<Typography sx={panelTitleSx}>
							Recent Delayed Items
						</Typography>

						<Button
							onClick={() => navigate("/venflow/entries")}
							sx={viewAllBtnSx}
						>
							View All
						</Button>
					</Box>

					<Box sx={delayedListSx}>
						{delayedRows.slice(0, 4).map((row) => (
							<Box key={row.id} sx={delayedRowSx}>
								<Box>
									<Typography sx={activityTitleSx}>
										{row.pdNo || "-"}
									</Typography>

									<Typography sx={activityMsgSx}>
										{row.materialName || row.clientName || "-"}
									</Typography>
								</Box>

								<Box sx={overduePillSx}>
									Overdue
								</Box>
							</Box>
						))}

						{delayedRows.length === 0 && (
							<Typography sx={emptySx}>
								No delayed items in recent list.
							</Typography>
						)}
					</Box>
				</Card>
			</Box>
		</Box>
	);
}

function percent(value, total) {
	const base = safeNumber(total);
	if (base <= 0) return 0;

	return Math.round((safeNumber(value) / base) * 100);
}

function KpiCard({ card }) {
	return (
		<Card sx={kpiCardSx(card.accent)}>
			<Box sx={kpiIconSx(card.accent)}>
				{card.icon}
			</Box>

			<Box sx={{ minWidth: 0 }}>
				<Typography sx={kpiLabelSx}>
					{card.label}
				</Typography>

				<Typography sx={kpiValueSx}>
					{card.value ?? 0}
				</Typography>

				<Typography sx={kpiSubtleSx}>
					{card.subtle}
				</Typography>
			</Box>
		</Card>
	);
}

function LegendRow({
	color,
	label,
	value,
	total,
}) {
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
					}}
				/>
				{label}
			</Box>

			<Typography sx={legendValueSx}>
				{value ?? 0} ({percent(value, total)}%)
			</Typography>
		</Box>
	);
}

function MiniMetric({
	icon,
	label,
	value,
	accent,
}) {
	return (
		<Box sx={miniMetricSx}>
			<Box sx={miniIconSx(accent)}>
				{icon}
			</Box>

			<Box>
				<Typography sx={miniValueSx}>
					{value}
				</Typography>

				<Typography sx={miniLabelSx}>
					{label}
				</Typography>
			</Box>
		</Box>
	);
}

function GlanceRow({
	label,
	count,
	percent,
	accent,
}) {
	return (
		<Box sx={glanceRowSx}>
			<Typography sx={glanceLabelSx}>
				{label}
			</Typography>

			<Typography sx={glanceValueSx}>
				{count ?? 0}
			</Typography>

			<Typography sx={glanceValueSx}>
				{percent}%
			</Typography>

			<Box sx={miniLineSx(accent)} />
		</Box>
	);
}

const pageSx = {
	display: "flex",
	flexDirection: "column",
	gap: "14px",
};

const heroSx = {
	display: "flex",
	justifyContent: "space-between",
	gap: 2,
	alignItems: "flex-start",
	flexWrap: "wrap",
};

const titleSx = {
	color: "#fff",
	fontSize: {
		xs: 28,
		md: 36,
	},
	fontWeight: 950,
	letterSpacing: "-.05em",
	lineHeight: 1,
};

const subSx = {
	mt: 1,
	color: "rgba(255,255,255,.68)",
	fontSize: 13,
	fontWeight: 650,
	lineHeight: 1.55,
	maxWidth: 760,
};

const heroActionsSx = {
	display: "flex",
	gap: 1,
	flexWrap: "wrap",
};

const kpiGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		sm: "repeat(2,minmax(0,1fr))",
		lg: "repeat(3,minmax(0,1fr))",
		xl: "repeat(6,minmax(0,1fr))",
	},
	gap: "12px",
};

const kpiCardSx = (accent) => ({
	minHeight: 128,
	p: "18px",
	borderRadius: "18px",
	background:
		"linear-gradient(180deg, rgba(30,41,59,.76), rgba(15,23,42,.78))",
	border: `1px solid ${accent}44`,
	boxShadow: `0 18px 38px rgba(2,6,23,.34), inset 0 1px 0 rgba(255,255,255,.04)`,
	color: "#fff",
	display: "flex",
	gap: 1.5,
	position: "relative",
	overflow: "hidden",

	"&:before": {
		content: '""',
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: 3,
		background: accent,
	},

	"&:hover": {
		transform: "translateY(-3px)",
		boxShadow: `0 24px 46px ${accent}18`,
	},
});

const kpiIconSx = (accent) => ({
	width: 46,
	height: 46,
	borderRadius: "50%",
	display: "grid",
	placeItems: "center",
	color: "#fff",
	background: `linear-gradient(135deg, ${accent}, ${accent}99)`,
	boxShadow: `0 14px 34px ${accent}35`,
	flexShrink: 0,

	"& svg": {
		fontSize: 24,
	},
});

const kpiLabelSx = {
	color: "rgba(255,255,255,.64)",
	fontSize: 11,
	fontWeight: 950,
	textTransform: "uppercase",
	letterSpacing: ".06em",
};

const kpiValueSx = {
	mt: 0.9,
	color: "#fff",
	fontSize: 32,
	fontWeight: 950,
	lineHeight: 1,
};

const kpiSubtleSx = {
	mt: 1,
	color: "rgba(255,255,255,.58)",
	fontSize: 12,
	fontWeight: 650,
	lineHeight: 1.45,
};

const middleGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		xl: "1fr 1fr",
	},
	gap: "12px",
};

const bottomGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		xl: "1fr 1fr",
	},
	gap: "12px",
};

const panelSx = {
	borderRadius: "18px",
	background:
		"linear-gradient(180deg, rgba(30,41,59,.70), rgba(15,23,42,.76))",
	border: "1px solid rgba(255,255,255,.075)",
	boxShadow: "0 18px 42px rgba(2,6,23,.34)",
	color: "#fff",
	overflow: "hidden",
};

const panelHeaderSx = {
	minHeight: 54,
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 1,
	px: 2,
	borderBottom: "1px solid rgba(255,255,255,.07)",
};

const panelTitleSx = {
	color: "#fff",
	fontSize: 16,
	fontWeight: 950,
};

const periodPillSx = {
	height: 30,
	px: 1.2,
	borderRadius: "10px",
	display: "flex",
	alignItems: "center",
	color: "#cbd5e1",
	background: "rgba(255,255,255,.045)",
	border: "1px solid rgba(255,255,255,.08)",
	fontSize: 12,
	fontWeight: 850,
};

const workflowBodySx = {
	display: "flex",
	alignItems: "center",
	gap: 4,
	p: 3,
	flexWrap: "wrap",
};

const donutSx = (total, completed, inProgress, delayed) => {
	const c = percent(completed, total);
	const p = percent(inProgress, total);
	const d = percent(delayed, total);

	return {
		width: 160,
		height: 160,
		borderRadius: "50%",
		background: `conic-gradient(#22c55e 0 ${c}%, #3b82f6 ${c}% ${c + p}%, #ef4444 ${c + p}% ${c + p + d}%, rgba(148,163,184,.42) ${c + p + d}% 100%)`,
		display: "grid",
		placeItems: "center",
		boxShadow: "0 18px 38px rgba(2,6,23,.34)",
	};
};

const donutInnerSx = {
	width: 104,
	height: 104,
	borderRadius: "50%",
	background: "rgba(15,23,42,.96)",
	display: "grid",
	placeItems: "center",
	textAlign: "center",
};

const donutValueSx = {
	color: "#fff",
	fontSize: 30,
	fontWeight: 950,
	lineHeight: 1,
};

const donutLabelSx = {
	color: "rgba(255,255,255,.62)",
	fontSize: 11,
	fontWeight: 800,
};

const legendSx = {
	flex: 1,
	minWidth: 240,
	display: "flex",
	flexDirection: "column",
	gap: 1.3,
};

const legendRowSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 1,
};

const legendNameSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	color: "rgba(255,255,255,.72)",
	fontSize: 13,
	fontWeight: 800,
};

const legendValueSx = {
	color: "#fff",
	fontSize: 13,
	fontWeight: 900,
};

const miniMetricsSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		md: "repeat(4,1fr)",
	},
	gap: 1,
	p: 2,
	borderTop: "1px solid rgba(255,255,255,.07)",
};

const miniMetricSx = {
	p: 1.4,
	borderRadius: "14px",
	background: "rgba(255,255,255,.04)",
	border: "1px solid rgba(255,255,255,.06)",
	display: "flex",
	alignItems: "center",
	gap: 1.2,
};

const miniIconSx = (accent) => ({
	width: 38,
	height: 38,
	borderRadius: "13px",
	display: "grid",
	placeItems: "center",
	color: accent,
	background: `${accent}18`,
	border: `1px solid ${accent}28`,
});

const miniValueSx = {
	color: "#fff",
	fontSize: 20,
	fontWeight: 950,
	lineHeight: 1,
};

const miniLabelSx = {
	mt: 0.5,
	color: "rgba(255,255,255,.56)",
	fontSize: 11,
	fontWeight: 750,
};

const viewAllBtnSx = {
	textTransform: "none",
	color: "#60a5fa",
	fontSize: 12,
	fontWeight: 900,
};

const activityListSx = {
	p: 2,
	display: "flex",
	flexDirection: "column",
	gap: 1.3,
};

const activityItemSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.4,
	p: 1,
	borderRadius: "14px",

	"&:hover": {
		background: "rgba(59,130,246,.08)",
	},
};

const activityDotSx = (index) => ({
	width: 36,
	height: 36,
	borderRadius: "12px",
	display: "grid",
	placeItems: "center",
	background:
		index % 3 === 0
			? "rgba(34,197,94,.15)"
			: index % 3 === 1
				? "rgba(59,130,246,.15)"
				: "rgba(245,158,11,.15)",
	border: "1px solid rgba(255,255,255,.08)",

	"&:after": {
		content: '""',
		width: 9,
		height: 9,
		borderRadius: "50%",
		background:
			index % 3 === 0
				? "#22c55e"
				: index % 3 === 1
					? "#3b82f6"
					: "#f59e0b",
	},
});

const activityTitleSx = {
	color: "#fff",
	fontSize: 13,
	fontWeight: 950,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const activityMsgSx = {
	mt: 0.3,
	color: "rgba(255,255,255,.55)",
	fontSize: 12,
	fontWeight: 650,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const activityTimeSx = {
	color: "rgba(255,255,255,.55)",
	fontSize: 11,
	fontWeight: 750,
	whiteSpace: "nowrap",
};

const emptySx = {
	color: "#94a3b8",
	fontSize: 13,
	fontWeight: 800,
	py: 3,
	textAlign: "center",
};

const glanceTableSx = {
	p: 2,
	display: "flex",
	flexDirection: "column",
};

const glanceRowSx = {
	display: "grid",
	gridTemplateColumns: "1.4fr .5fr .5fr 1fr",
	gap: 1,
	alignItems: "center",
	minHeight: 48,
	borderBottom: "1px solid rgba(255,255,255,.06)",
};

const glanceLabelSx = {
	color: "#fff",
	fontSize: 13,
	fontWeight: 850,
};

const glanceValueSx = {
	color: "rgba(255,255,255,.72)",
	fontSize: 13,
	fontWeight: 850,
};

const miniLineSx = (accent) => ({
	height: 28,
	borderRadius: "10px",
	background: `linear-gradient(90deg, transparent, ${accent}55, transparent)`,
	border: `1px solid ${accent}22`,
});

const delayedListSx = {
	p: 2,
	display: "flex",
	flexDirection: "column",
	gap: 1,
};

const delayedRowSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 1,
	p: 1.2,
	borderRadius: "14px",
	background: "rgba(255,255,255,.035)",
	border: "1px solid rgba(255,255,255,.06)",
};

const overduePillSx = {
	px: 1.2,
	py: 0.6,
	borderRadius: 999,
	color: "#f87171",
	background: "rgba(239,68,68,.12)",
	border: "1px solid rgba(239,68,68,.22)",
	fontSize: 11,
	fontWeight: 900,
};