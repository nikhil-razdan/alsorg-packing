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

import EngineeringOutlinedIcon
	from "@mui/icons-material/EngineeringOutlined";

import AdminPanelSettingsOutlinedIcon
	from "@mui/icons-material/AdminPanelSettingsOutlined";

import PeopleAltOutlinedIcon
	from "@mui/icons-material/PeopleAltOutlined";

import BadgeOutlinedIcon
	from "@mui/icons-material/BadgeOutlined";

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

import HrFlowWorkspace
	from "../modules/hrflow/HrFlowWorkspace";

import hrflowApi
	from "../modules/hrflow/hrflowApi";

import MachFlowWorkspace
	from "../modules/machflow/MachFlowWorkspace";

import MachFlowRequestPortal
	from "../modules/machflow/MachFlowRequestPortal";

import machFlowApi
	from "../modules/machflow/machFlowApi";

import {
	MODULE_KEYS,
	hasModuleAccessFromUser,
} from "../utils/moduleAccess";

const hasHrFlowBackendAccess = (payload) => {
	const roles = Array.isArray(payload?.roles)
		? payload.roles
		: Array.isArray(payload?.hrRoles)
			? payload.hrRoles
			: Array.isArray(payload?.accessRoles)
				? payload.accessRoles
				: [];

	return Boolean(
		payload?.allowed === true ||
		payload?.hasAccess === true ||
		payload?.globalAdmin === true ||
		payload?.isGlobalAdmin === true ||
		payload?.admin === true ||
		roles.length > 0
	);
};

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
	 * HRFlow uses its own backend access grants instead of the ordinary
	 * FlowSuite user.modules list.  Verify that grant independently so an
	 * HR_EXECUTIVE / HR_HEAD / RECRUITER / HOD user can see HRFlow even if
	 * HRFLOW is not present in /auth/me modules. Global ADMIN always passes.
	 */
	const [hrFlowAllowed, setHrFlowAllowed] =
		React.useState(() => Boolean(hasRole("ADMIN")));

	const [machFlowRequestAllowed, setMachFlowRequestAllowed] =
		React.useState(false);

	React.useEffect(() => {
		let active = true;

		if (hasRole("ADMIN")) {
			setHrFlowAllowed(true);
			return () => {
				active = false;
			};
		}

		hrflowApi
			.me()
			.then((response) => {
				if (!active) return;

				setHrFlowAllowed(
					hasHrFlowBackendAccess(response?.data)
				);
			})
			.catch(() => {
				if (!active) return;
				setHrFlowAllowed(false);
			});

		return () => {
			active = false;
		};
	}, [user?.username, role, roles, hasRole]);

	React.useEffect(() => {
		let active = true;

		machFlowApi.requesterContext()
			.then((payload) => {
				if (!active) return;
				setMachFlowRequestAllowed(payload?.allowed === true);
			})
			.catch(() => {
				if (!active) return;
				setMachFlowRequestAllowed(false);
			});

		return () => { active = false; };
	}, [user?.username, role, roles]);

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

	const hrFlowView =
		requestedSharedModule === "hrflow" ||
		requestedSharedModule === "hr";

	const machFlowView =
		requestedSharedModule === "machflow" ||
		requestedSharedModule === "maintenance";

	const machFlowRequestView =
		requestedSharedModule === "machflow-request" ||
		requestedSharedModule === "service-request" ||
		requestedSharedModule === "maintenance-request";

	if (clientMasterView) {
		return (
			<RequireRole allowed={["ADMIN"]}>
				<ClientMasterPage />
			</RequireRole>
		);
	}

	if (hrFlowView) {
		return <HrFlowWorkspace />;
	}

	if (machFlowRequestView) {
		return <MachFlowRequestPortal />;
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

	const machFlowAllowed =
		hasModuleAccessFromUser(
			accessUser,
			MODULE_KEYS.MACHFLOW
		);

	if (machFlowView && machFlowAllowed) {
		return <MachFlowWorkspace />;
	}

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
			key: "MACHFLOW_REQUEST",
			title: "Maintenance Request",
			subtitle:
				"Raise a controlled Machine Maintenance or IT Support request through an approved linked Reporter profile.",
			icon: (
				<EngineeringOutlinedIcon
					fontSize="large"
				/>
			),
			path: "/modules?module=machflow-request",
			tags: [
				"Machine Maintenance",
				"IT Support",
				"Asset QR",
				"My Requests",
			],
			visible: machFlowRequestAllowed,
			accent: "Approved Request Portal",
		},
		{
			key: MODULE_KEYS.MACHFLOW,
			title: "MachFlow",
			subtitle:
				"Department-separated Machine Maintenance and IT Support with controlled request intake, asset QR, preventive planning and management intelligence.",
			icon: (
				<EngineeringOutlinedIcon
					fontSize="large"
				/>
			),
			path: "/modules?module=machflow",
			tags: [
				"Service Requests",
				"Machine Master",
				"IT Asset Master",
				"Department Reports",
			],
			visible: canAccess(
				MODULE_KEYS.MACHFLOW
			),
			accent: "Maintenance Control",
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
			key: MODULE_KEYS.HRFLOW,
			title: "HRFlow",
			subtitle:
				"Recruitment, joining, employee documents, policies, orientation and onboarding.",
			icon: (
				<BadgeOutlinedIcon
					fontSize="large"
				/>
			),
			path: "/modules?module=hrflow",
			tags: [
				"Recruitment",
				"Joining",
				"Onboarding",
				"Employees",
			],
			visible: hrFlowAllowed,
			accent: "People Operations",
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
							Please contact Admin to assign access to the required
							FlowSuite module.
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
		radial-gradient(circle at 7% 0%, rgba(59,130,246,.10), transparent 24%),
		radial-gradient(circle at 94% 100%, rgba(14,165,233,.06), transparent 26%),
		linear-gradient(180deg,var(--pf-bg) 0%,var(--pf-bg-alt) 100%)
	`,
	color: "var(--pf-text-strong)",
	p: { xs: 1.25, sm: 1.5, md: 2 },
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
	maxWidth: 1320,
	mx: "auto",
	mb: { xs: 2, md: 2.25 },
	minHeight: 58,
	px: { xs: 1.25, md: 1.6 },
	py: 0.75,
	borderRadius: "12px",
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
	width: 36,
	height: 36,
	borderRadius: "9px",
	display: "grid",
	placeItems: "center",
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	color: "#fff",
	fontWeight: 950,
	fontSize: 15,
	boxShadow: "0 7px 16px rgba(37,99,235,.20)",
};

const brandTitleSx = {
	color: "var(--pf-text-strong)",
	fontWeight: 950,
	fontSize: 16.5,
	letterSpacing: 0.2,
};

const brandSubSx = {
	color: "var(--pf-text-muted)",
	fontSize: 9.5,
	fontWeight: 650,
	mt: 0.1,
};

const topBarActionsSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
};

const themeToggleSx = {
	width: 34,
	height: 34,
	borderRadius: "8px",
	color: "var(--pf-text)",
	background: "rgba(var(--pf-fg-rgb),.045)",
	border: "1px solid var(--pf-border)",
	"& svg": { fontSize: 19 },
	"&:hover": {
		color: "#2563eb",
		background: "rgba(59,130,246,.11)",
		borderColor: "rgba(59,130,246,.26)",
	},
};

const logoutBtnSx = {
	minHeight: 34,
	borderRadius: "8px",
	px: 1.5,
	py: 0.55,
	textTransform: "none",
	fontWeight: 850,
	fontSize: 11,
	color: "#2563eb",
	background: "rgba(59,130,246,.09)",
	border: "1px solid rgba(59,130,246,.22)",
	boxShadow: "none",
	"& .MuiButton-startIcon svg": { fontSize: 17 },
	"&:hover": {
		color: "#fff",
		background: "linear-gradient(135deg,#2563eb,#3b82f6)",
		borderColor: "rgba(59,130,246,.38)",
	},
};

const containerSx = {
	position: "relative",
	zIndex: 1,
	maxWidth: 1320,
	mx: "auto",
};

const heroSx = {
	mb: { xs: 2, md: 2.25 },
	maxWidth: 800,
	px: { xs: 0.25, md: 0.5 },
};

const badgeSx = {
	mb: 1,
	height: 24,
	borderRadius: "7px",
	background: "rgba(59,130,246,.10)",
	border: "1px solid rgba(59,130,246,.22)",
	color: "#3b82f6",
	fontSize: 8.8,
	fontWeight: 900,
	letterSpacing: 0.9,
	"& .MuiChip-label": { px: 1 },
};

const titleSx = {
	color: "var(--pf-text-strong)",
	fontWeight: 950,
	letterSpacing: "-0.04em",
	lineHeight: 1.04,
	mb: 0.75,
	fontSize: { xs: 29, sm: 33, md: 38 },
};

const subtitleSx = {
	color: "var(--pf-text-muted)",
	fontSize: { xs: 12, md: 13 },
	fontWeight: 600,
	lineHeight: 1.55,
	maxWidth: 720,
};

const moduleGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		sm: "repeat(2, minmax(0, 1fr))",
		lg: "repeat(3, minmax(0, 1fr))",
		xl: "repeat(4, minmax(0, 1fr))",
	},
	gap: { xs: 1.1, md: 1.35 },
	alignItems: "stretch",
};

const emptyCardSx = {
	borderRadius: "12px",
	p: 2.5,
	background: "rgba(var(--pf-surface-rgb),.94)",
	border: "1px solid var(--pf-border)",
	boxShadow: "var(--pf-card-shadow)",
};

const moduleCardSx = {
	height: "100%",
	minHeight: 218,
	position: "relative",
	overflow: "hidden",
	borderRadius: "12px",
	background:
		"linear-gradient(180deg,rgba(var(--pf-surface-rgb),.97),rgba(var(--pf-surface-alt-rgb),.94))",
	border: "1px solid var(--pf-border)",
	boxShadow: "0 8px 24px rgba(var(--pf-fg-rgb),.055)",
	backdropFilter: "blur(12px)",
	transition: "transform .16s ease, box-shadow .16s ease, border-color .16s ease",
	"&:before": {
		content: '""',
		position: "absolute",
		top: 0,
		left: 0,
		bottom: 0,
		width: 3,
		background: "linear-gradient(180deg,#2563eb,#60a5fa)",
		pointerEvents: "none",
	},
	"&:hover": {
		transform: "translateY(-2px)",
		boxShadow: "0 14px 30px rgba(37,99,235,.11)",
		borderColor: "rgba(59,130,246,.28)",
	},
};

const cardContentSx = {
	p: { xs: 1.65, md: 1.8 },
	pl: { xs: 1.85, md: 2 },
	position: "relative",
	zIndex: 1,
	height: "100%",
	display: "flex",
	flexDirection: "column",
	"&:last-child": {
		pb: { xs: 1.65, md: 1.8 },
	},
};

const cardTopSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 1,
	mb: 1.15,
};

const iconBoxSx = {
	width: 40,
	height: 40,
	borderRadius: "10px",
	display: "grid",
	placeItems: "center",
	color: "#3b82f6",
	background: "rgba(59,130,246,.10)",
	border: "1px solid rgba(59,130,246,.18)",
	boxShadow: "none",
	"& svg": {
		fontSize: 22,
	},
};

const cardChipSx = {
	height: 22,
	maxWidth: "58%",
	borderRadius: "6px",
	color: "#3b82f6",
	background: "rgba(59,130,246,.08)",
	border: "1px solid rgba(59,130,246,.18)",
	fontWeight: 850,
	fontSize: 8.2,
	"& .MuiChip-label": {
		px: 0.8,
		overflow: "hidden",
		textOverflow: "ellipsis",
	},
};

const cardTitleSx = {
	color: "var(--pf-text-strong)",
	fontWeight: 950,
	fontSize: { xs: 18, md: 19 },
	mb: 0.45,
	letterSpacing: "-0.03em",
};

const cardSubtitleSx = {
	color: "var(--pf-text-muted)",
	fontSize: 10.8,
	fontWeight: 600,
	lineHeight: 1.45,
	minHeight: 47,
	mb: 1.1,
	display: "-webkit-box",
	WebkitLineClamp: 3,
	WebkitBoxOrient: "vertical",
	overflow: "hidden",
};

const tagWrapSx = {
	display: "flex",
	flexWrap: "wrap",
	gap: 0.45,
	mb: 1.2,
	mt: "auto",
};

const tagSx = {
	height: 20,
	borderRadius: "6px",
	color: "var(--pf-text-soft)",
	background: "rgba(var(--pf-fg-rgb),.04)",
	border: "1px solid var(--pf-border)",
	fontWeight: 750,
	fontSize: 8.1,
	"& .MuiChip-label": {
		px: 0.72,
	},
};

const openBtnSx = {
	minHeight: 34,
	borderRadius: "8px",
	py: 0.55,
	textTransform: "none",
	fontWeight: 900,
	fontSize: 11,
	color: "#fff",
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	boxShadow: "0 6px 16px rgba(37,99,235,.18)",
	"& .MuiButton-endIcon svg": { fontSize: 17 },
	"&:hover": {
		background: "linear-gradient(135deg,#1d4ed8,#2563eb)",
		boxShadow: "0 8px 19px rgba(37,99,235,.22)",
	},
};
