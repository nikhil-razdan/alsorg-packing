import {
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
import CurrencyRupeeOutlinedIcon from "@mui/icons-material/CurrencyRupeeOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

import bomFlowApi from "../api/bomFlowApi.js";

const money = (value) => `₹ ${Number(value || 0).toLocaleString("en-IN", {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
})}`;

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

export default function BOMFlowDashboard() {
	const navigate = useNavigate();
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			setData(await bomFlowApi.getDashboardSummary());
		} catch (requestError) {
			setError(
				requestError?.response?.data?.message ||
				requestError?.response?.data?.detail ||
				requestError?.message ||
				"Unable to load BOMFlow dashboard."
			);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => { load(); }, []);

	const stats = useMemo(() => [
		{ title: "Total Products", value: data?.totalProducts || 0, icon: <Inventory2OutlinedIcon />, accent: "#60a5fa", path: "/bomflow/products" },
		{ title: "Active Costings", value: data?.activeCostings || 0, icon: <CalculateOutlinedIcon />, accent: "#22c55e", path: "/bomflow/costing" },
		{ title: "Draft / Returned BOMs", value: data?.draftBoms || 0, icon: <PendingActionsOutlinedIcon />, accent: "#f59e0b", path: "/bomflow/bom-builder" },
		{ title: "Approved BOMs", value: data?.approvedBoms || 0, icon: <CheckCircleOutlineOutlinedIcon />, accent: "#34d399", path: "/bomflow/reports" },
		{ title: "Missing Material Rates", value: data?.missingRates || 0, icon: <WarningAmberOutlinedIcon />, accent: "#ef4444", path: "/bomflow/rate-master" },
		{ title: "Active Rate Master", value: data?.activeMaterialRates || 0, icon: <PriceChangeOutlinedIcon />, accent: "#38bdf8", path: "/bomflow/rate-master" },
		{ title: "Active Labour Master", value: data?.activeLabourRates || 0, icon: <EngineeringOutlinedIcon />, accent: "#a855f7", path: "/bomflow/labour-master" },
	], [data]);

	const maxCost = Math.max(
		1,
		...(data?.recentCostings || []).map((row) => Number(row.currentCost || 0))
	);

	return (
		<Box sx={pageSx}>
			<Box sx={heroSx}>
				<Box>
					<Chip label="BOMFLOW DASHBOARD" sx={labelChipSx} />
					<Typography sx={titleSx}>Product Costing Control Center</Typography>
					<Typography sx={subSx}>
						Live overview of Product Master, BOM workflow, rate readiness, labour masters and costing activity.
					</Typography>
				</Box>
				<Box sx={actionsSx}>
					<Button startIcon={<RefreshIcon />} disabled={loading} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
					<Button startIcon={<AddIcon />} onClick={() => navigate("/bomflow/products/new")} sx={primaryBtnSx}>New Costing</Button>
				</Box>
			</Box>

			{error && <Box sx={errorSx}>{error}</Box>}

			{loading ? (
				<Box sx={loadingSx}><CircularProgress /></Box>
			) : (
				<>
					<Box sx={statsGridSx}>
						{stats.map((stat) => (
							<button key={stat.title} type="button" onClick={() => navigate(stat.path)} style={statCardStyle(stat.accent)}>
								<div style={statBarStyle(stat.accent)} />
								<Box sx={statIconSx(stat.accent)}>{stat.icon}</Box>
								<Typography sx={statLabelSx}>{stat.title}</Typography>
								<Typography sx={statValueSx}>{stat.value}</Typography>
								<Typography sx={statLinkSx}>Open <ArrowForwardIcon sx={{ fontSize: 13 }} /></Typography>
							</button>
						))}
					</Box>

					<Box sx={gridSx}>
						<Card sx={panelSx}>
							<Box sx={panelHeadSx}>
								<Box>
									<Typography sx={panelTitleSx}>Recent Costing Activity</Typography>
									<Typography sx={panelSubSx}>Latest BOM revisions with current material + labour cost.</Typography>
								</Box>
								<CurrencyRupeeOutlinedIcon sx={{ color: "#93c5fd" }} />
							</Box>

							<Box sx={recentListSx}>
								{(data?.recentCostings || []).map((row) => {
									const percent = Math.round((Number(row.currentCost || 0) / maxCost) * 100);
									return (
										<button key={row.revisionId} type="button" onClick={() => navigate(`/bomflow/costing?productId=${row.productId}&revisionId=${row.revisionId}`)} style={recentButtonStyle}>
											<Box sx={recentTopSx}>
												<Box sx={{ minWidth: 0 }}>
													<Typography sx={recentNameSx}>{row.productName}</Typography>
													<Typography sx={recentMetaSx}>{row.productCode || "NO CODE"} • {row.status} • {formatDate(row.updatedAt)}</Typography>
												</Box>
												<Typography sx={recentCostSx}>{money(row.currentCost)}</Typography>
											</Box>
											<LinearProgress variant="determinate" value={percent} sx={progressSx} />
											<Box sx={recentSplitSx}><span>Material {money(row.materialCost)}</span><span>Labour {money(row.labourCost)}</span></Box>
										</button>
									);
								})}
								{(data?.recentCostings || []).length === 0 && <Box sx={emptySx}>No BOM revisions yet.</Box>}
							</Box>
						</Card>

						<Card sx={panelSx}>
							<Typography sx={panelTitleSx}>Commercial Controls</Typography>
							<Typography sx={panelSubSx}>Open the new BOMFlow commercial workspaces.</Typography>
							<Box sx={quickListSx}>
								<Quick title="Rate Master" sub="Material rates, GST and effective dates" icon={<PriceChangeOutlinedIcon />} onClick={() => navigate("/bomflow/rate-master")} />
								<Quick title="Labour Master" sub="Department/process labour rates" icon={<EngineeringOutlinedIcon />} onClick={() => navigate("/bomflow/labour-master")} />
								<Quick title="Costing Engine" sub="Material + labour + overhead costing" icon={<CalculateOutlinedIcon />} onClick={() => navigate("/bomflow/costing")} />
								<Quick title="Reports" sub="CSV exports and printable PDF view" icon={<AssessmentOutlinedIcon />} onClick={() => navigate("/bomflow/reports")} />
								<Quick title="BOM Builder" sub="Material structure and approvals" icon={<RuleOutlinedIcon />} onClick={() => navigate("/bomflow/bom-builder")} />
							</Box>
						</Card>
					</Box>
				</>
			)}
		</Box>
	);
}

function Quick({ title, sub, icon, onClick }) {
	return (
		<button type="button" onClick={onClick} style={quickButtonStyle}>
			<span style={quickIconStyle}>{icon}</span>
			<span style={{ flex: 1 }}><span style={quickTitleStyle}>{title}</span><span style={quickSubStyle}>{sub}</span></span>
			<ArrowForwardIcon fontSize="small" />
		</button>
	);
}

const pageSx = { width: "100%", display: "flex", flexDirection: "column", gap: "14px" };
const heroSx = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" };
const labelChipSx = { height: 26, borderRadius: 999, background: "rgba(59,130,246,.14)", color: "#60a5fa", border: "1px solid rgba(59,130,246,.24)", fontWeight: 900, fontSize: 11, mb: "10px" };
const titleSx = { color: "#fff", fontSize: { xs: 24, md: 32 }, fontWeight: 950, lineHeight: 1.05, letterSpacing: "-0.04em" };
const subSx = { mt: "8px", color: "rgba(255,255,255,.66)", fontSize: 13, fontWeight: 650, maxWidth: 820, lineHeight: 1.5 };
const actionsSx = { display: "flex", gap: "8px", flexWrap: "wrap" };
const primaryBtnSx = { height: 38, borderRadius: "9px", textTransform: "none", fontWeight: 850, color: "#fff", background: "linear-gradient(135deg,#2563eb,#3b82f6)" };
const secondaryBtnSx = { height: 38, borderRadius: "9px", textTransform: "none", fontWeight: 850, color: "#fff", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" };
const errorSx = { p: "11px 13px", borderRadius: "9px", color: "#fca5a5", background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.24)", fontSize: 12, fontWeight: 750 };
const loadingSx = { minHeight: 360, display: "grid", placeItems: "center" };
const statsGridSx = { display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: "10px", "@media (max-width: 1450px)": { gridTemplateColumns: "repeat(4,minmax(0,1fr))" }, "@media (max-width: 900px)": { gridTemplateColumns: "repeat(2,minmax(0,1fr))" }, "@media (max-width: 520px)": { gridTemplateColumns: "1fr" } };
const statCardStyle = (accent) => ({ position: "relative", minHeight: 128, padding: "13px", borderRadius: 10, border: "1px solid rgba(255,255,255,.07)", background: "rgba(15,23,42,.78)", color: "#fff", textAlign: "left", cursor: "pointer", fontFamily: "inherit", overflow: "hidden" });
const statBarStyle = (accent) => ({ position: "absolute", left: 0, right: 0, top: 0, height: 3, background: accent });
const statIconSx = (accent) => ({ width: 36, height: 36, borderRadius: "9px", display: "grid", placeItems: "center", color: accent, background: `${accent}18`, border: `1px solid ${accent}33`, mb: "9px" });
const statLabelSx = { color: "rgba(255,255,255,.58)", fontSize: 9.5, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".06em" };
const statValueSx = { mt: "5px", color: "#fff", fontSize: 23, fontWeight: 950 };
const statLinkSx = { mt: "9px", color: "#93c5fd", fontSize: 10.5, fontWeight: 850, display: "flex", alignItems: "center", gap: "3px" };
const gridSx = { display: "grid", gridTemplateColumns: "minmax(0,1.55fr) minmax(330px,.75fr)", gap: "14px", "@media (max-width: 1120px)": { gridTemplateColumns: "1fr" } };
const panelSx = { p: "15px", borderRadius: "10px", background: "rgba(15,23,42,.78)", border: "1px solid rgba(255,255,255,.07)", boxShadow: "0 14px 28px rgba(2,6,23,.24)" };
const panelHeadSx = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px", mb: "12px" };
const panelTitleSx = { color: "#fff", fontSize: 17, fontWeight: 950 };
const panelSubSx = { mt: "3px", color: "rgba(255,255,255,.52)", fontSize: 11, fontWeight: 650 };
const recentListSx = { display: "flex", flexDirection: "column", gap: "8px" };
const recentButtonStyle = { width: "100%", padding: "11px", borderRadius: 9, border: "1px solid rgba(255,255,255,.07)", background: "rgba(2,6,23,.34)", color: "#fff", textAlign: "left", cursor: "pointer", fontFamily: "inherit" };
const recentTopSx = { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" };
const recentNameSx = { color: "#fff", fontSize: 12.5, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const recentMetaSx = { mt: "3px", color: "rgba(255,255,255,.46)", fontSize: 10, fontWeight: 650 };
const recentCostSx = { color: "#4ade80", fontSize: 13, fontWeight: 900, fontFamily: "monospace", flexShrink: 0 };
const progressSx = { mt: "9px", height: 5, borderRadius: 99, background: "rgba(255,255,255,.06)", "& .MuiLinearProgress-bar": { borderRadius: 99, background: "linear-gradient(135deg,#2563eb,#60a5fa)" } };
const recentSplitSx = { mt: "6px", display: "flex", justifyContent: "space-between", gap: "8px", color: "rgba(255,255,255,.50)", fontSize: 9.5, fontWeight: 700 };
const emptySx = { py: "28px", textAlign: "center", color: "#64748b", fontSize: 12 };
const quickListSx = { mt: "12px", display: "flex", flexDirection: "column", gap: "8px" };
const quickButtonStyle = { width: "100%", minHeight: 56, padding: "10px 12px", borderRadius: 9, border: "1px solid rgba(255,255,255,.07)", background: "rgba(255,255,255,.035)", color: "#fff", display: "flex", alignItems: "center", gap: 10, textAlign: "left", cursor: "pointer", fontFamily: "inherit" };
const quickIconStyle = { width: 34, height: 34, borderRadius: 8, display: "grid", placeItems: "center", color: "#93c5fd", background: "rgba(59,130,246,.12)", border: "1px solid rgba(59,130,246,.20)" };
const quickTitleStyle = { display: "block", color: "#fff", fontSize: 12, fontWeight: 900 };
const quickSubStyle = { display: "block", marginTop: 3, color: "rgba(255,255,255,.48)", fontSize: 10.5, fontWeight: 650 };
