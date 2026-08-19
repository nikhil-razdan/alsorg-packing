import React from "react";

import {
	useLocation,
	useNavigate,
} from "react-router-dom";

import {
	Box,
	Button,
	Card,
	CardContent,
	Chip,
	IconButton,
	Tooltip,
	Typography,
} from "@mui/material";

import Inventory2OutlinedIcon
	from "@mui/icons-material/Inventory2Outlined";

import AccountTreeOutlinedIcon
	from "@mui/icons-material/AccountTreeOutlined";

import LayersOutlinedIcon
	from "@mui/icons-material/LayersOutlined";

import AdminPanelSettingsOutlinedIcon
	from "@mui/icons-material/AdminPanelSettingsOutlined";

import PeopleAltOutlinedIcon
	from "@mui/icons-material/PeopleAltOutlined";

import ArrowForwardIcon
	from "@mui/icons-material/ArrowForward";

import LogoutIcon
	from "@mui/icons-material/Logout";

import DarkModeOutlinedIcon
	from "@mui/icons-material/DarkModeOutlined";

import LightModeOutlinedIcon
	from "@mui/icons-material/LightModeOutlined";

import { useAuth }
	from "../auth/AuthContext";

import {
	PackFlowThemeBoundary,
	usePackFlowTheme,
} from "../theme/PackFlowThemeContext";

import ClientMasterPage
	from "../pages/ClientMasterPage";

import RequireRole
	from "../auth/RequireRole";

import {
	MODULE_KEYS,
	hasModuleAccessFromUser,
} from "../utils/moduleAccess";

function ModuleHubContent() {
	const navigate = useNavigate();
	const location = useLocation();

	const {
		mode,
		toggleTheme,
	} = usePackFlowTheme();

	const {
		user,
		role,
		roles = [],
		modules = [],
		hasRole,
		hasAnyRole,
		logout,
	} = useAuth();

	const username =
		user?.username ||
		localStorage.getItem("username") ||
		"User";

	/*
	 * Shared FlowSuite module hosting.
	 *
	 * Client Master intentionally lives on the already-registered /modules
	 * route instead of beneath /packflow.  This avoids any dependency on the
	 * application's outer/root router and prevents PackFlow wildcard/default
	 * redirects from swallowing the shared module.
	 *
	 * The backend remains ADMIN-protected for master maintenance. PackFlow
	 * packing users continue to use only the authenticated search endpoint.
	 */
	const requestedSharedModule =
		new URLSearchParams(
			location.search
		)
			.get("module")
			?.trim()
			.toLowerCase() || "";

	const clientMasterView =
		requestedSharedModule === "client-master" ||
		requestedSharedModule === "clients";

	if (clientMasterView) {
		return (
			<RequireRole allowed={["ADMIN"]}>
				<ClientMasterPage />
			</RequireRole>
		);
	}

	/*
	 * AuthContext may keep role/modules separately from user.
	 * Build one reliable object for module-access checks.
	 */
	const accessUser = {
		...(user || {}),

		role:
			role ||
			user?.role ||
			"",

		roles:
			Array.isArray(roles)
				? roles
				: Array.isArray(user?.roles)
					? user.roles
					: [],

		modules:
			Array.isArray(modules)
				? modules
				: Array.isArray(user?.modules)
					? user.modules
					: [],
	};

	const isHardwareOnly =
		hasRole("HARDWARE_PACKING") &&
		!hasAnyRole(
			"ADMIN",
			"PACKING",
			"WAREHOUSE",
			"DISPATCH",
			"LOGISTICS"
		);

	const canAccess = (moduleKey) => {
		return hasModuleAccessFromUser(
			accessUser,
			moduleKey
		);
	};

	const cards = [
		{
			key: MODULE_KEYS.PACKFLOW,
			title: "PackFlow",
			subtitle:
				"Inventory, packing, warehouse, dispatch, logistics and operational tracking.",
			icon: (
				<Inventory2OutlinedIcon
					fontSize="large"
				/>
			),
			path:
				isHardwareOnly
					? "/packflow/zoho-items"
					: "/packflow/dashboard",
			tags: [
				"Inventory",
				"Warehouse",
				"Dispatch",
				"Logistics",
			],
			visible: canAccess(
				MODULE_KEYS.PACKFLOW
			),
			accent: "Inventory Control",
		},
		{
			key: MODULE_KEYS.BOMFLOW,
			title: "BOMFlow",
			subtitle:
				"Product master, BOM revisions, costing, engineering review and approval.",
			icon: (
				<AccountTreeOutlinedIcon
					fontSize="large"
				/>
			),
			path: "/bomflow/dashboard",
			tags: [
				"Product Master",
				"BOM Builder",
				"Costing",
				"Approval",
			],
			visible: canAccess(
				MODULE_KEYS.BOMFLOW
			),
			accent: "BOM Control",
		},
		{
			key: MODULE_KEYS.MATFLOW,
			title: "MatFlow",
			subtitle:
				"Operational BOMs, plant-routed production requisitions, AL-P1 Main Store control, purchase, QC, processing, issue, returns and a Universal Dashboard.",
			icon: (
				<LayersOutlinedIcon
					fontSize="large"
				/>
			),
			path: "/matflow/dashboard",
			tags: [
				"Operational BOM",
				"Production",
				"Store",
				"Universal Dashboard",
			],
			visible: canAccess(
				MODULE_KEYS.MATFLOW
			),
			accent: "Material Control",
		},
		{
			key: MODULE_KEYS.MATERIALS,
			title: "Material Inventory",
			subtitle:
				"Global ALSORG material catalogue, stock position, actual consumption insights and Excel import/export.",
			icon: (
				<Inventory2OutlinedIcon fontSize="large" />
			),
			path: "/matflow/materials",
			tags: [
				"Material Master",
				"Consumption",
				"Inventory",
				"Excel Import",
			],
			// Transitional visibility: existing MatFlow users keep access today.
			// Later PackFlow-only users can be assigned MATERIALS independently.
			visible:
				canAccess(MODULE_KEYS.MATERIALS) ||
				canAccess(MODULE_KEYS.MATFLOW),
			accent: "Global Material Control",
		},
		{
			key: MODULE_KEYS.CLIENTS,
			title: "Client Master",
			subtitle:
				"Shared FlowSuite client directory for searchable PackFlow selection today and cross-module client integration later.",
			icon: (
				<PeopleAltOutlinedIcon
					fontSize="large"
				/>
			),
			path: "/modules?module=client-master",
			tags: [
				"Client Directory",
				"Search",
				"Shared Master",
				"Future Integrations",
			],
			visible:
				hasRole("ADMIN"),
			accent: "Shared Master Data",
		},
		{
			key: "USERS",
			title: "User Management",
			subtitle:
				"Manage users, roles, module visibility, access control and administrative permissions.",
			icon: (
				<AdminPanelSettingsOutlinedIcon
					fontSize="large"
				/>
			),
			path: "/users",
			tags: [
				"Users",
				"Roles",
				"Modules",
				"Permissions",
			],
			visible:
				hasRole("ADMIN"),
			accent: "Admin Control",
		},
	].filter((card) => card.visible);

	const handleLogout = async () => {
		await logout();

		navigate("/login", {
			replace: true,
		});
	};

	return (
		<Box sx={pageSx}>
			<Box sx={ambientGlowOne} />
			<Box sx={ambientGlowTwo} />

			<Box sx={backgroundText}>
				FlowSuite
			</Box>

			<Box sx={topBarSx}>
				<Box sx={brandWrapSx}>
					<Box sx={brandMarkSx}>
						A
					</Box>

					<Box>
						<Typography
							sx={brandTitleSx}
						>
							FlowSuite
						</Typography>

						<Typography
							sx={brandSubSx}
						>
							Alsorg Operations Suite
						</Typography>
					</Box>
				</Box>

				<Box sx={topBarActionsSx}>
					<Tooltip
						title={
							mode === "dark"
								? "Switch to light mode"
								: "Switch to dark mode"
						}
					>
						<IconButton
							onClick={toggleTheme}
							sx={themeToggleSx}
							aria-label={
								mode === "dark"
									? "Switch to light mode"
									: "Switch to dark mode"
							}
						>
							{mode === "dark"
								? <LightModeOutlinedIcon />
								: <DarkModeOutlinedIcon />}
						</IconButton>
					</Tooltip>

					<Button
						startIcon={<LogoutIcon />}
						onClick={handleLogout}
						sx={logoutBtnSx}
					>
						Logout
					</Button>
				</Box>
			</Box>

			<Box sx={containerSx}>
				<Box sx={heroSx}>
					<Chip
						label="GLOBAL MODULE HUB"
						sx={badgeSx}
					/>

					<Typography
						variant="h2"
						sx={titleSx}
					>
						Welcome, {username}
					</Typography>

					<Typography sx={subtitleSx}>
						Select the system module you want to open. Access is shown
						based on permissions assigned by Admin.
					</Typography>
				</Box>

				{cards.length === 0 ? (
					<Card sx={emptyCardSx}>
						<Typography
							variant="h6"
							sx={{
								fontWeight: 900,
								color: "var(--pf-text-strong)",
							}}
						>
							No module access assigned
						</Typography>

						<Typography
							sx={{
								mt: 1,
								color:
									"var(--pf-text-muted)",
							}}
						>
							Please contact Admin to assign PackFlow, BOMFlow or
							MatFlow access.
						</Typography>
					</Card>
				) : (
					<Box sx={moduleGridSx}>
						{cards.map((card) => (
							<Card
								key={card.key}
								sx={moduleCardSx}
							>
								<CardContent
									sx={cardContentSx}
								>
									<Box sx={cardTopSx}>
										<Box sx={iconBoxSx}>
											{card.icon}
										</Box>

										<Chip
											label={card.accent}
											size="small"
											sx={cardChipSx}
										/>
									</Box>

									<Typography
										variant="h4"
										sx={cardTitleSx}
									>
										{card.title}
									</Typography>

									<Typography
										sx={cardSubtitleSx}
									>
										{card.subtitle}
									</Typography>

									<Box sx={tagWrapSx}>
										{card.tags.map(
											(tag) => (
												<Chip
													key={tag}
													label={tag}
													size="small"
													sx={tagSx}
												/>
											)
										)}
									</Box>

									<Button
										fullWidth
										variant="contained"
										endIcon={
											<ArrowForwardIcon />
										}
										onClick={() =>
											navigate(
												card.path
											)
										}
										sx={openBtnSx}
									>
										Open {card.title}
									</Button>
								</CardContent>
							</Card>
						))}
					</Box>
				)}
			</Box>
		</Box>
	);
}


export default function ModuleHub() {
	return (
		<PackFlowThemeBoundary>
			<ModuleHubContent />
		</PackFlowThemeBoundary>
	);
}

const pageSx = {
	minHeight: "100vh",
	position: "relative",
	overflowX: "hidden",
	overflowY: "auto",
	fontFamily: "Inter, system-ui, sans-serif",
	background: `
		radial-gradient(circle at 7% 0%, rgba(59,130,246,.11), transparent 25%),
		radial-gradient(circle at 94% 100%, rgba(14,165,233,.07), transparent 28%),
		linear-gradient(180deg,var(--pf-bg) 0%,var(--pf-bg-alt) 100%)
	`,
	color: "var(--pf-text-strong)",
	p: { xs: 1.5, sm: 2, md: 3 },
	transition: "background .18s ease,color .18s ease",
};

const ambientGlowOne = {
	position: "absolute",
	top: -150,
	left: -130,
	width: 380,
	height: 380,
	borderRadius: "50%",
	background: "rgba(37,99,235,.12)",
	filter: "blur(110px)",
	pointerEvents: "none",
};

const ambientGlowTwo = {
	position: "absolute",
	right: -130,
	bottom: -150,
	width: 420,
	height: 420,
	borderRadius: "50%",
	background: "rgba(14,165,233,.09)",
	filter: "blur(120px)",
	pointerEvents: "none",
};

const backgroundText = {
	position: "fixed",
	fontSize: { xs: 82, md: 168 },
	fontWeight: 950,
	background:
		"linear-gradient(180deg,rgba(var(--pf-fg-rgb),.04),rgba(var(--pf-fg-rgb),.008))",
	WebkitBackgroundClip: "text",
	WebkitTextFillColor: "transparent",
	top: "53%",
	left: "50%",
	transform: "translate(-50%, -50%)",
	letterSpacing: 5,
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
	maxWidth: 1240,
	mx: "auto",
	mb: { xs: 3, md: 4 },
	minHeight: 66,
	px: { xs: 1.5, md: 2 },
	py: 1,
	borderRadius: "14px",
	background: "rgba(var(--pf-surface-rgb),.92)",
	border: "1px solid var(--pf-border)",
	boxShadow: "var(--pf-card-shadow)",
	backdropFilter: "blur(16px)",
};

const brandWrapSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.4,
};

const brandMarkSx = {
	width: 42,
	height: 42,
	borderRadius: "11px",
	display: "grid",
	placeItems: "center",
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	color: "#fff",
	fontWeight: 950,
	fontSize: 17,
	boxShadow: "0 8px 20px rgba(37,99,235,.22)",
};

const brandTitleSx = {
	color: "var(--pf-text-strong)",
	fontWeight: 950,
	fontSize: 18,
	letterSpacing: 0.25,
};

const brandSubSx = {
	color: "var(--pf-text-muted)",
	fontSize: 10.5,
	fontWeight: 650,
	mt: 0.2,
};

const topBarActionsSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
};

const themeToggleSx = {
	width: 38,
	height: 38,
	borderRadius: "9px",
	color: "var(--pf-text)",
	background: "rgba(var(--pf-fg-rgb),.045)",
	border: "1px solid var(--pf-border)",
	"&:hover": {
		color: "#2563eb",
		background: "rgba(59,130,246,.11)",
		borderColor: "rgba(59,130,246,.26)",
	},
};

const logoutBtnSx = {
	minHeight: 38,
	borderRadius: "9px",
	px: 2,
	py: 0.8,
	textTransform: "none",
	fontWeight: 850,
	fontSize: 12,
	color: "#2563eb",
	background: "rgba(59,130,246,.09)",
	border: "1px solid rgba(59,130,246,.22)",
	boxShadow: "none",
	"&:hover": {
		color: "#fff",
		background: "linear-gradient(135deg,#2563eb,#3b82f6)",
		borderColor: "rgba(59,130,246,.38)",
	},
};

const containerSx = {
	position: "relative",
	zIndex: 1,
	maxWidth: 1240,
	mx: "auto",
};

const heroSx = {
	mb: { xs: 3, md: 3.5 },
	maxWidth: 820,
	px: { xs: 0.5, md: 1 },
};

const badgeSx = {
	mb: 1.5,
	height: 29,
	borderRadius: "8px",
	background: "rgba(59,130,246,.10)",
	border: "1px solid rgba(59,130,246,.22)",
	color: "#3b82f6",
	fontSize: 10.5,
	fontWeight: 900,
	letterSpacing: 1,
	"& .MuiChip-label": {
		px: 1.2,
	},
};

const titleSx = {
	color: "var(--pf-text-strong)",
	fontWeight: 950,
	letterSpacing: "-0.045em",
	lineHeight: 1.05,
	mb: 1.2,
	fontSize: { xs: 34, sm: 40, md: 48 },
};

const subtitleSx = {
	color: "var(--pf-text-muted)",
	fontSize: { xs: 13.5, md: 15 },
	fontWeight: 600,
	lineHeight: 1.65,
	maxWidth: 760,
};

const moduleGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		md: "repeat(2, minmax(0, 1fr))",
		xl: "repeat(3, minmax(0, 1fr))",
	},
	gap: { xs: 1.5, md: 2 },
	alignItems: "stretch",
};

const emptyCardSx = {
	borderRadius: "14px",
	p: 3.5,
	background: "rgba(var(--pf-surface-rgb),.94)",
	border: "1px solid var(--pf-border)",
	boxShadow: "var(--pf-card-shadow)",
};

const moduleCardSx = {
	height: "100%",
	minHeight: 274,
	position: "relative",
	overflow: "hidden",
	borderRadius: "14px",
	background:
		"linear-gradient(180deg,rgba(var(--pf-surface-rgb),.97),rgba(var(--pf-surface-alt-rgb),.94))",
	border: "1px solid var(--pf-border)",
	boxShadow: "var(--pf-card-shadow)",
	backdropFilter: "blur(12px)",
	transition: "transform .18s ease, box-shadow .18s ease, border-color .18s ease",
	"&:before": {
		content: '\"\"',
		position: "absolute",
		top: 0,
		left: 0,
		bottom: 0,
		width: 4,
		background: "linear-gradient(180deg,#2563eb,#60a5fa)",
		pointerEvents: "none",
	},
	"&:hover": {
		transform: "translateY(-2px)",
		boxShadow: "0 18px 42px rgba(37,99,235,.13)",
		borderColor: "rgba(59,130,246,.30)",
	},
};

const cardContentSx = {
	p: { xs: 2.25, md: 2.6 },
	pl: { xs: 2.5, md: 2.85 },
	position: "relative",
	zIndex: 1,
	height: "100%",
	display: "flex",
	flexDirection: "column",
	"&:last-child": {
		pb: { xs: 2.25, md: 2.6 },
	},
};

const cardTopSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 1.5,
	mb: 1.8,
};

const iconBoxSx = {
	width: 48,
	height: 48,
	borderRadius: "12px",
	display: "grid",
	placeItems: "center",
	color: "#3b82f6",
	background: "rgba(59,130,246,.11)",
	border: "1px solid rgba(59,130,246,.20)",
	boxShadow: "none",
	"& svg": {
		fontSize: 27,
	},
};

const cardChipSx = {
	height: 25,
	borderRadius: "7px",
	color: "#3b82f6",
	background: "rgba(59,130,246,.09)",
	border: "1px solid rgba(59,130,246,.19)",
	fontWeight: 850,
	fontSize: 9.5,
	"& .MuiChip-label": {
		px: 1,
	},
};

const cardTitleSx = {
	color: "var(--pf-text-strong)",
	fontWeight: 950,
	fontSize: { xs: 22, md: 24 },
	mb: 0.7,
	letterSpacing: "-0.035em",
};

const cardSubtitleSx = {
	color: "var(--pf-text-muted)",
	fontSize: 12.5,
	fontWeight: 600,
	lineHeight: 1.6,
	minHeight: 62,
	mb: 1.8,
};

const tagWrapSx = {
	display: "flex",
	flexWrap: "wrap",
	gap: 0.7,
	mb: 2,
	mt: "auto",
};

const tagSx = {
	height: 24,
	borderRadius: "7px",
	color: "var(--pf-text-soft)",
	background: "rgba(var(--pf-fg-rgb),.045)",
	border: "1px solid var(--pf-border)",
	fontWeight: 750,
	fontSize: 9.5,
	"& .MuiChip-label": {
		px: 0.95,
	},
};

const openBtnSx = {
	minHeight: 40,
	borderRadius: "9px",
	py: 0.9,
	textTransform: "none",
	fontWeight: 900,
	fontSize: 12.5,
	color: "#fff",
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	boxShadow: "0 8px 20px rgba(37,99,235,.20)",
	"&:hover": {
		background: "linear-gradient(135deg,#1d4ed8,#2563eb)",
		boxShadow: "0 10px 24px rgba(37,99,235,.24)",
	},
};
