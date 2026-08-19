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

import { useAuth }
	from "../auth/AuthContext";

import ClientMasterPage
	from "../pages/ClientMasterPage";

import RequireRole
	from "../auth/RequireRole";

import {
	MODULE_KEYS,
	hasModuleAccessFromUser,
} from "../utils/moduleAccess";

export default function ModuleHub() {
	const navigate = useNavigate();
	const location = useLocation();

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

				<Button
					startIcon={<LogoutIcon />}
					onClick={handleLogout}
					sx={logoutBtnSx}
				>
					Logout
				</Button>
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
								color: "#0f172a",
							}}
						>
							No module access assigned
						</Typography>

						<Typography
							sx={{
								mt: 1,
								color:
									"#64748b",
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

const pageSx = {
	minHeight: "100vh",
	position: "relative",
	overflowX: "hidden",
	overflowY: "auto",
	fontFamily: "Inter, system-ui, sans-serif",
	background: `
		radial-gradient(circle at 7% 0%, rgba(59,130,246,.10), transparent 25%),
		radial-gradient(circle at 94% 100%, rgba(14,165,233,.07), transparent 28%),
		linear-gradient(180deg,#f8fbff 0%,#f3f7fc 48%,#eef4fa 100%)
	`,
	color: "#0f172a",
	p: { xs: 1.5, sm: 2, md: 3 },
};

const ambientGlowOne = {
	position: "absolute",
	top: -150,
	left: -130,
	width: 380,
	height: 380,
	borderRadius: "50%",
	background: "rgba(37,99,235,.10)",
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
	background: "rgba(14,165,233,.08)",
	filter: "blur(120px)",
	pointerEvents: "none",
};

const backgroundText = {
	position: "fixed",
	fontSize: { xs: 82, md: 168 },
	fontWeight: 950,
	background:
		"linear-gradient(180deg, rgba(37,99,235,.035), rgba(37,99,235,.008))",
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
	background: "rgba(255,255,255,.88)",
	border: "1px solid rgba(148,163,184,.18)",
	boxShadow: "0 10px 28px rgba(15,23,42,.07)",
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
	color: "#0f172a",
	fontWeight: 950,
	fontSize: 18,
	letterSpacing: 0.25,
};

const brandSubSx = {
	color: "#64748b",
	fontSize: 10.5,
	fontWeight: 650,
	mt: 0.2,
};

const logoutBtnSx = {
	minHeight: 38,
	borderRadius: "9px",
	px: 2,
	py: 0.8,
	textTransform: "none",
	fontWeight: 850,
	fontSize: 12,
	color: "#1d4ed8",
	background: "#eff6ff",
	border: "1px solid #bfdbfe",
	boxShadow: "none",
	"&:hover": {
		background: "#dbeafe",
		borderColor: "#93c5fd",
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
	background: "#eff6ff",
	border: "1px solid #bfdbfe",
	color: "#2563eb",
	fontSize: 10.5,
	fontWeight: 900,
	letterSpacing: 1,
	"& .MuiChip-label": {
		px: 1.2,
	},
};

const titleSx = {
	color: "#0f172a",
	fontWeight: 950,
	letterSpacing: "-0.045em",
	lineHeight: 1.05,
	mb: 1.2,
	fontSize: { xs: 34, sm: 40, md: 48 },
};

const subtitleSx = {
	color: "#64748b",
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
	background: "rgba(255,255,255,.92)",
	border: "1px solid rgba(148,163,184,.22)",
	boxShadow: "0 12px 32px rgba(15,23,42,.07)",
};

const moduleCardSx = {
	height: "100%",
	minHeight: 274,
	position: "relative",
	overflow: "hidden",
	borderRadius: "14px",
	background: "rgba(255,255,255,.94)",
	border: "1px solid rgba(148,163,184,.20)",
	boxShadow: "0 10px 28px rgba(15,23,42,.065)",
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
		boxShadow: "0 16px 36px rgba(15,23,42,.10)",
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
	color: "#2563eb",
	background: "#eff6ff",
	border: "1px solid #dbeafe",
	boxShadow: "none",
	"& svg": {
		fontSize: 27,
	},
};

const cardChipSx = {
	height: 25,
	borderRadius: "7px",
	color: "#1d4ed8",
	background: "#f5f9ff",
	border: "1px solid #dbeafe",
	fontWeight: 850,
	fontSize: 9.5,
	"& .MuiChip-label": {
		px: 1,
	},
};

const cardTitleSx = {
	color: "#0f172a",
	fontWeight: 950,
	fontSize: { xs: 22, md: 24 },
	mb: 0.7,
	letterSpacing: "-0.035em",
};

const cardSubtitleSx = {
	color: "#64748b",
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
	color: "#475569",
	background: "#f8fafc",
	border: "1px solid #e2e8f0",
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
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	boxShadow: "0 8px 20px rgba(37,99,235,.20)",
	"&:hover": {
		background: "linear-gradient(135deg,#1d4ed8,#2563eb)",
		boxShadow: "0 10px 24px rgba(37,99,235,.24)",
	},
};
