import React from "react";
import { useNavigate } from "react-router-dom";
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
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LogoutIcon from "@mui/icons-material/Logout";

import { hasModuleAccess } from "../utils/moduleAccess";
import { normalizeRole } from "../utils/permissions";

export default function ModuleHub() {
	const navigate = useNavigate();

	const username = localStorage.getItem("username") || "User";
	const role = normalizeRole(localStorage.getItem("role"));

	const cards = [
		{
			key: "PACKFLOW",
			title: "PackFlow",
			subtitle:
				"Inventory, packing, warehouse, dispatch, logistics and operational tracking.",
			icon: <Inventory2OutlinedIcon fontSize="large" />,
			path: "/packflow/dashboard",
			tags: ["Inventory", "Warehouse", "Dispatch", "Logistics"],
			visible: hasModuleAccess("PACKFLOW"),
			accent: "Inventory Control",
		},
		{
			key: "BOMFLOW",
			title: "BOMFlow",
			subtitle:
				"Product BOM creation, material costing, labour costing, rate master and cost control.",
			icon: <AccountTreeOutlinedIcon fontSize="large" />,
			path: "/bomflow/dashboard",
			tags: ["Product Master", "BOM Builder", "Rate Master", "Costing"],
			visible: hasModuleAccess("BOMFLOW"),
			accent: "Costing Control",
		},
		{
			key: "USERS",
			title: "User Management",
			subtitle:
				"Manage users, roles, module visibility, access control and admin permissions.",
			icon: <AdminPanelSettingsOutlinedIcon fontSize="large" />,
			path: "/users",
			tags: ["Users", "Roles", "Access", "Permissions"],
			visible: role === "ADMIN",
			accent: "Admin Control",
		},
	].filter((card) => card.visible);

	const logout = () => {
		localStorage.clear();
		navigate("/login", { replace: true });
	};

	return (
		<Box sx={pageSx}>
			<Box sx={ambientGlowOne} />
			<Box sx={ambientGlowTwo} />
			<Box sx={backgroundText}>FlowSuite</Box>

			<Box sx={topBarSx}>
				<Box sx={brandWrapSx}>
					<Box sx={brandMarkSx}>A</Box>

					<Box>
						<Typography sx={brandTitleSx}>
							FlowSuite
						</Typography>

						<Typography sx={brandSubSx}>
							Alsorg Operations Suite
						</Typography>
					</Box>
				</Box>

				<Button
					startIcon={<LogoutIcon />}
					onClick={logout}
					sx={logoutBtnSx}
				>
					Logout
				</Button>
			</Box>

			<Box sx={containerSx}>
				<Box sx={heroSx}>
					<Chip label="GLOBAL MODULE HUB" sx={badgeSx} />

					<Typography variant="h2" sx={titleSx}>
						Welcome, {username}
					</Typography>

					<Typography sx={subtitleSx}>
						Select the system module you want to open. Access is shown
						based on the permissions assigned by Admin.
					</Typography>
				</Box>

				{cards.length === 0 ? (
					<Card sx={emptyCardSx}>
						<Typography variant="h6" sx={{ fontWeight: 900, color: "#fff" }}>
							No module access assigned
						</Typography>

						<Typography sx={{ mt: 1, color: "rgba(255,255,255,.58)" }}>
							Please contact Admin to assign PackFlow or BOMFlow access.
						</Typography>
					</Card>
				) : (
					<Grid container spacing={3}>
						{cards.map((card) => (
							<Grid item xs={12} md={4} key={card.key}>
								<Card sx={moduleCardSx}>
									<CardContent sx={{ p: 3.5, position: "relative", zIndex: 1 }}>
										<Box sx={cardTopSx}>
											<Box sx={iconBoxSx}>
												{card.icon}
											</Box>

											<Chip label={card.accent} size="small" sx={cardChipSx} />
										</Box>

										<Typography variant="h4" sx={cardTitleSx}>
											{card.title}
										</Typography>

										<Typography sx={cardSubtitleSx}>
											{card.subtitle}
										</Typography>

										<Box sx={tagWrapSx}>
											{card.tags.map((tag) => (
												<Chip key={tag} label={tag} size="small" sx={tagSx} />
											))}
										</Box>

										<Button
											fullWidth
											variant="contained"
											endIcon={<ArrowForwardIcon />}
											onClick={() => navigate(card.path)}
											sx={openBtnSx}
										>
											Open {card.title}
										</Button>
									</CardContent>
								</Card>
							</Grid>
						))}
					</Grid>
				)}
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
	maxWidth: 1280,
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

const logoutBtnSx = {
	borderRadius: "14px",
	px: 2.4,
	py: 1.1,
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
	maxWidth: 1280,
	mx: "auto",
};

const heroSx = {
	mb: 4,
	maxWidth: 840,
};

const badgeSx = {
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

const titleSx = {
	color: "#fff",
	fontWeight: 950,
	letterSpacing: "-0.055em",
	lineHeight: 1,
	mb: 2,
};

const subtitleSx = {
	color: "rgba(255,255,255,.66)",
	fontSize: { xs: 15, md: 18 },
	lineHeight: 1.8,
	maxWidth: 760,
};

const emptyCardSx = {
	borderRadius: 5,
	p: 4,
	background: "linear-gradient(180deg, rgba(15,23,42,.92), rgba(15,23,42,.84))",
	border: "1px solid rgba(255,255,255,.08)",
	boxShadow: "0 30px 80px rgba(2,6,23,.45)",
};

const moduleCardSx = {
	height: "100%",
	position: "relative",
	overflow: "hidden",
	borderRadius: 5,
	background: "linear-gradient(180deg, rgba(15,23,42,.92), rgba(15,23,42,.84))",
	border: "1px solid rgba(255,255,255,.08)",
	boxShadow: "0 30px 80px rgba(2,6,23,.45)",
	backdropFilter: "blur(18px)",
	transition: "all .25s ease",
	"&:before": {
		content: '""',
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: 120,
		background: "linear-gradient(180deg, rgba(59,130,246,.18), transparent)",
		pointerEvents: "none",
	},
	"&:hover": {
		transform: "translateY(-6px)",
		boxShadow: "0 34px 90px rgba(2,6,23,.62)",
		borderColor: "rgba(59,130,246,.28)",
	},
};

const cardTopSx = {
	display: "flex",
	alignItems: "flex-start",
	justifyContent: "space-between",
	gap: 2,
	mb: 2.5,
};

const iconBoxSx = {
	width: 64,
	height: 64,
	borderRadius: "22px",
	display: "grid",
	placeItems: "center",
	color: "#93c5fd",
	background: "rgba(59,130,246,.13)",
	border: "1px solid rgba(59,130,246,.20)",
	boxShadow: "0 12px 30px rgba(37,99,235,.18)",
};

const cardChipSx = {
	color: "#60a5fa",
	background: "rgba(37,99,235,.13)",
	border: "1px solid rgba(59,130,246,.20)",
	fontWeight: 800,
};

const cardTitleSx = {
	color: "#fff",
	fontWeight: 950,
	mb: 1.2,
	letterSpacing: "-0.035em",
};

const cardSubtitleSx = {
	color: "rgba(255,255,255,.58)",
	lineHeight: 1.75,
	minHeight: 86,
	mb: 2.2,
};

const tagWrapSx = {
	display: "flex",
	flexWrap: "wrap",
	gap: 1,
	mb: 3,
};

const tagSx = {
	color: "rgba(255,255,255,.78)",
	background: "rgba(255,255,255,.055)",
	border: "1px solid rgba(255,255,255,.08)",
	fontWeight: 700,
};

const openBtnSx = {
	borderRadius: "16px",
	py: 1.35,
	textTransform: "none",
	fontWeight: 900,
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	boxShadow: "0 18px 40px rgba(37,99,235,.35)",
	"&:hover": {
		background: "linear-gradient(135deg,#1d4ed8,#2563eb)",
	},
};