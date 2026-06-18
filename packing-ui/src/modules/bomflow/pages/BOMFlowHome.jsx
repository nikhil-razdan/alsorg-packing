import React from "react";
import {
	Box,
	Button,
	Card,
	CardContent,
	Chip,
	Grid,
	Typography,
} from "@mui/material";

import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import PriceChangeOutlinedIcon from "@mui/icons-material/PriceChangeOutlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AppsIcon from "@mui/icons-material/Apps";
import LogoutIcon from "@mui/icons-material/Logout";

import { useNavigate } from "react-router-dom";

const modules = [
	{
		title: "Product Master",
		subtitle:
			"Create product details, drawing number, collection, size, category and product photo.",
		icon: <Inventory2OutlinedIcon />,
		status: "Ready to Start",
		action: "Create Product",
		path: "/bomflow/products",
		enabled: false,
	},
	{
		title: "BOM Builder",
		subtitle:
			"Create section-wise BOM for metal, wood, hardware, stone, glass, upholstery, paint and labour.",
		icon: <RuleOutlinedIcon />,
		status: "Planned",
		action: "Open BOM Builder",
		path: "/bomflow/bom-builder",
		enabled: false,
	},
	{
		title: "Rate Master",
		subtitle:
			"Maintain material rates, vendor rates, purchase register rates, bill copies and effective dates.",
		icon: <PriceChangeOutlinedIcon />,
		status: "Planned",
		action: "Open Rate Master",
		path: "/bomflow/rate-master",
		enabled: false,
	},
	{
		title: "Labour Master",
		subtitle:
			"Maintain process-wise labour rates, departments, working time and labour calculation rules.",
		icon: <EngineeringOutlinedIcon />,
		status: "Planned",
		action: "Open Labour Master",
		path: "/bomflow/labour-master",
		enabled: false,
	},
	{
		title: "Costing Engine",
		subtitle:
			"Calculate direct material, direct labour, overheads, prime cost and final product costing.",
		icon: <CalculateOutlinedIcon />,
		status: "Planned",
		action: "View Costing",
		path: "/bomflow/costing",
		enabled: false,
	},
	{
		title: "Reports",
		subtitle:
			"Export Price Sheet, Direct Material, Direct Labour, Change Log, PDF approval and summaries.",
		icon: <AssessmentOutlinedIcon />,
		status: "Planned",
		action: "View Reports",
		path: "/bomflow/reports",
		enabled: false,
	},
];

export default function BOMFlowHome() {
	const navigate = useNavigate();

	const username = localStorage.getItem("username") || "User";

	const logout = () => {
		localStorage.clear();
		navigate("/login", { replace: true });
	};

	return (
		<Box sx={pageSx}>
			<Box sx={ambientGlowOne} />
			<Box sx={ambientGlowTwo} />
			<Box sx={backgroundText}>BOMFlow</Box>

			<Box sx={topBarSx}>
				<Box sx={brandWrapSx}>
					<Box sx={brandMarkSx}>B</Box>

					<Box>
						<Typography sx={brandTitleSx}>
							BOMFlow
						</Typography>

						<Typography sx={brandSubSx}>
							Product Costing & BOM Control
						</Typography>
					</Box>
				</Box>

				<Box sx={topActionWrapSx}>
					<Button
						startIcon={<AppsIcon />}
						onClick={() => navigate("/modules")}
						sx={secondaryBtnSx}
					>
						All Modules
					</Button>

					<Button
						startIcon={<LogoutIcon />}
						onClick={logout}
						sx={secondaryBtnSx}
					>
						Logout
					</Button>
				</Box>
			</Box>

			<Box sx={containerSx}>
				<Box sx={heroSx}>
					<Chip label="BOMFLOW MODULE" sx={heroBadgeSx} />

					<Typography variant="h2" sx={heroTitleSx}>
						BOMFlow
					</Typography>

					<Typography sx={heroSubtitleSx}>
						Welcome, {username}. Create product details, build BOM,
						manage rates, calculate costing, control approval workflow,
						track versions and export Excel/PDF reports.
					</Typography>

					<Box sx={heroChipWrapSx}>
						<Chip label="Product Master" sx={heroChipSx} />
						<Chip label="BOM Builder" sx={heroChipSx} />
						<Chip label="Rate Master" sx={heroChipSx} />
						<Chip label="Costing Engine" sx={heroChipSx} />
						<Chip label="Reports" sx={heroChipSx} />
					</Box>
				</Box>

				<Grid container spacing={2.5}>
					{modules.map((item) => (
						<Grid item xs={12} sm={6} lg={4} key={item.title}>
							<Card sx={moduleCardSx(item.enabled)}>
								<CardContent sx={{ p: 3, position: "relative", zIndex: 1 }}>
									<Box sx={cardTopSx}>
										<Box sx={moduleIconSx}>{item.icon}</Box>

										<Chip
											size="small"
											label={item.status}
											sx={item.enabled ? statusReadySx : statusPlannedSx}
										/>
									</Box>

									<Typography variant="h6" sx={moduleTitleSx}>
										{item.title}
									</Typography>

									<Typography sx={moduleSubtitleSx}>
										{item.subtitle}
									</Typography>

									<Button
										fullWidth
										variant={item.enabled ? "contained" : "outlined"}
										disabled={!item.enabled}
										endIcon={<ArrowForwardIcon />}
										onClick={() => navigate(item.path)}
										sx={item.enabled ? moduleBtnSx : disabledBtnSx}
									>
										{item.enabled ? item.action : "Coming Soon"}
									</Button>
								</CardContent>
							</Card>
						</Grid>
					))}
				</Grid>
			</Box>
		</Box>
	);
}

const pageSx = {
	minHeight: "100vh",
	position: "relative",
	overflow: "hidden",
	fontFamily: "Inter, system-ui, sans-serif",
	background: `
		radial-gradient(circle at top left, rgba(59,130,246,0.14), transparent 22%),
		radial-gradient(circle at bottom right, rgba(14,165,233,0.10), transparent 24%),
		linear-gradient(135deg, #020617 0%, #0f172a 45%, #111827 100%)
	`,
	p: { xs: 2, md: 4 },
};

const ambientGlowOne = {
	position: "absolute",
	top: -120,
	left: -120,
	width: 420,
	height: 420,
	borderRadius: "50%",
	background: "rgba(37,99,235,.18)",
	filter: "blur(100px)",
	pointerEvents: "none",
};

const ambientGlowTwo = {
	position: "absolute",
	right: -120,
	bottom: -120,
	width: 460,
	height: 460,
	borderRadius: "50%",
	background: "rgba(14,165,233,.14)",
	filter: "blur(110px)",
	pointerEvents: "none",
};

const backgroundText = {
	position: "absolute",
	fontSize: { xs: 88, md: 190 },
	fontWeight: 950,
	background:
		"linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.012))",
	WebkitBackgroundClip: "text",
	WebkitTextFillColor: "transparent",
	top: "50%",
	left: "50%",
	transform: "translate(-50%, -50%)",
	letterSpacing: 6,
	pointerEvents: "none",
	userSelect: "none",
	whiteSpace: "nowrap",
};

const topBarSx = {
	position: "relative",
	zIndex: 1,
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 2,
	maxWidth: 1300,
	mx: "auto",
	mb: 5,
};

const brandWrapSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.8,
};

const brandMarkSx = {
	width: 52,
	height: 52,
	borderRadius: "18px",
	display: "grid",
	placeItems: "center",
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	color: "#fff",
	fontWeight: 950,
	fontSize: 20,
	boxShadow: "0 14px 30px rgba(37,99,235,.35)",
};

const brandTitleSx = {
	color: "#fff",
	fontWeight: 950,
	fontSize: 20,
	letterSpacing: 0.5,
};

const brandSubSx = {
	color: "rgba(255,255,255,.52)",
	fontSize: 12,
	mt: 0.4,
};

const topActionWrapSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.2,
};

const secondaryBtnSx = {
	borderRadius: "14px",
	px: 2,
	py: 1,
	textTransform: "none",
	fontWeight: 800,
	color: "#fff",
	background: "rgba(255,255,255,.05)",
	border: "1px solid rgba(255,255,255,.10)",
	"&:hover": {
		background: "rgba(59,130,246,.18)",
		borderColor: "rgba(59,130,246,.35)",
	},
};

const containerSx = {
	position: "relative",
	zIndex: 1,
	maxWidth: 1300,
	mx: "auto",
};

const heroSx = {
	mb: 4,
	p: { xs: 3, md: 4 },
	borderRadius: 5,
	background: "linear-gradient(180deg, rgba(15,23,42,.92), rgba(15,23,42,.84))",
	border: "1px solid rgba(255,255,255,.08)",
	boxShadow: "0 30px 80px rgba(2,6,23,.45)",
	backdropFilter: "blur(18px)",
	position: "relative",
	overflow: "hidden",
	"&:before": {
		content: '""',
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: 140,
		background: "linear-gradient(180deg, rgba(59,130,246,.18), transparent)",
		pointerEvents: "none",
	},
};

const heroBadgeSx = {
	position: "relative",
	zIndex: 1,
	mb: 2,
	height: 38,
	borderRadius: 999,
	background: "rgba(37,99,235,.14)",
	border: "1px solid rgba(59,130,246,.22)",
	color: "#60a5fa",
	fontSize: 12,
	fontWeight: 850,
	letterSpacing: 1.2,
};

const heroTitleSx = {
	position: "relative",
	zIndex: 1,
	color: "#fff",
	fontWeight: 950,
	letterSpacing: "-0.055em",
	lineHeight: 1,
	mb: 2,
};

const heroSubtitleSx = {
	position: "relative",
	zIndex: 1,
	fontSize: { xs: 15, md: 18 },
	maxWidth: 900,
	color: "rgba(255,255,255,.68)",
	lineHeight: 1.8,
};

const heroChipWrapSx = {
	position: "relative",
	zIndex: 1,
	mt: 3,
	display: "flex",
	gap: 1.2,
	flexWrap: "wrap",
};

const heroChipSx = {
	color: "rgba(255,255,255,.82)",
	border: "1px solid rgba(255,255,255,.10)",
	background: "rgba(255,255,255,.055)",
	fontWeight: 750,
};

const moduleCardSx = (enabled) => ({
	height: "100%",
	position: "relative",
	overflow: "hidden",
	borderRadius: 5,
	background: "linear-gradient(180deg, rgba(15,23,42,.92), rgba(15,23,42,.84))",
	border: "1px solid rgba(255,255,255,.08)",
	boxShadow: "0 24px 70px rgba(2,6,23,.36)",
	backdropFilter: "blur(18px)",
	opacity: enabled ? 1 : 0.82,
	transition: "all .25s ease",
	"&:before": {
		content: '""',
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: 110,
		background: "linear-gradient(180deg, rgba(59,130,246,.14), transparent)",
		pointerEvents: "none",
	},
	"&:hover": {
		transform: "translateY(-4px)",
		borderColor: "rgba(59,130,246,.26)",
		boxShadow: "0 30px 84px rgba(2,6,23,.50)",
	},
});

const cardTopSx = {
	display: "flex",
	alignItems: "flex-start",
	justifyContent: "space-between",
	gap: 2,
	mb: 2,
};

const moduleIconSx = {
	width: 56,
	height: 56,
	borderRadius: "20px",
	display: "grid",
	placeItems: "center",
	background: "rgba(59,130,246,.13)",
	border: "1px solid rgba(59,130,246,.20)",
	color: "#93c5fd",
	boxShadow: "0 12px 30px rgba(37,99,235,.16)",
};

const statusReadySx = {
	color: "#bbf7d0",
	background: "rgba(34,197,94,.13)",
	border: "1px solid rgba(34,197,94,.25)",
	fontWeight: 800,
};

const statusPlannedSx = {
	color: "rgba(255,255,255,.62)",
	background: "rgba(255,255,255,.04)",
	border: "1px solid rgba(255,255,255,.08)",
	fontWeight: 800,
};

const moduleTitleSx = {
	fontWeight: 900,
	color: "#fff",
	mb: 1,
};

const moduleSubtitleSx = {
	color: "rgba(255,255,255,.58)",
	lineHeight: 1.68,
	minHeight: 84,
	mb: 2.5,
};

const moduleBtnSx = {
	borderRadius: "16px",
	py: 1.2,
	fontWeight: 850,
	textTransform: "none",
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	boxShadow: "0 18px 40px rgba(37,99,235,.30)",
	"&:hover": {
		background: "linear-gradient(135deg,#1d4ed8,#2563eb)",
	},
};

const disabledBtnSx = {
	borderRadius: "16px",
	py: 1.2,
	fontWeight: 850,
	textTransform: "none",
	color: "rgba(255,255,255,.35) !important",
	borderColor: "rgba(255,255,255,.10) !important",
};