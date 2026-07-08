import React, { useMemo, useState } from "react";
import {
	Link,
	Outlet,
	useLocation,
	useNavigate,
} from "react-router-dom";

import {
	Badge,
	Box,
	Button,
	Divider,
	Drawer,
	IconButton,
	Popover,
	Tooltip,
} from "@mui/material";

import AppsIcon from "@mui/icons-material/Apps";
import AppsOutlinedIcon from "@mui/icons-material/AppsOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import FormatListBulletedOutlinedIcon from "@mui/icons-material/FormatListBulletedOutlined";
import AddCircleOutlineOutlinedIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import InventoryIcon from "@mui/icons-material/Inventory";
import PersonIcon from "@mui/icons-material/Person";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import CloseIcon from "@mui/icons-material/Close";
import HealthAndSafetyIcon from "@mui/icons-material/HealthAndSafety";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import MenuIcon from "@mui/icons-material/Menu";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";

import { useAuth } from "../../auth/AuthContext";

import {
	canAccessVenFlowScreen,
	getVenFlowRole,
	venFlowRoleLabel,
} from "../../utils/venflowAccess";

const navItems = [
	{
		label: "Dashboard",
		path: "/venflow/dashboard",
		screen: "dashboard",
		icon: <DashboardOutlinedIcon fontSize="small" />,
	},
	{
		label: "Full Tracker",
		path: "/venflow/entries",
		screen: "entries",
		icon: <FormatListBulletedOutlinedIcon fontSize="small" />,
	},
	{
		label: "Production Desk",
		path: "/venflow/production",
		screen: "production",
		icon: <EngineeringOutlinedIcon fontSize="small" />,
	},
	{
		label: "Store Desk",
		path: "/venflow/store",
		screen: "store",
		icon: <StorefrontOutlinedIcon fontSize="small" />,
	},
	{
		label: "Purchase Desk",
		path: "/venflow/purchase",
		screen: "purchase",
		icon: <ShoppingCartOutlinedIcon fontSize="small" />,
	},
	{
		label: "New Requirement",
		path: "/venflow/create",
		screen: "create",
		icon: <AddCircleOutlineOutlinedIcon fontSize="small" />,
	},
	{
		label: "Reports",
		path: "/venflow/reports",
		screen: "reports",
		icon: <AssessmentOutlinedIcon fontSize="small" />,
	},
];

const VENFLOW_SIDEBAR_COLLAPSED_KEY = "venflowSidebarCollapsed";

export default function VenFlowLayout() {
	const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
		return localStorage.getItem(VENFLOW_SIDEBAR_COLLAPSED_KEY) === "true";
	});

	const toggleSidebar = () => {
		setSidebarCollapsed((prev) => {
			const next = !prev;
			localStorage.setItem(VENFLOW_SIDEBAR_COLLAPSED_KEY, String(next));
			return next;
		});
	};

	return (
		<div style={shell}>
			<VenFlowSidebar collapsed={sidebarCollapsed} />

			<div style={main}>
				<VenFlowHeader
					sidebarCollapsed={sidebarCollapsed}
					onToggleSidebar={toggleSidebar}
				/>

				<div style={contentShell}>
					<div style={contentInner}>
						<Outlet />
					</div>
				</div>
			</div>
		</div>
	);
}

function VenFlowSidebar({ collapsed }) {
	const location = useLocation();
	const navigate = useNavigate();

	const { user, role } = useAuth();

	const venFlowRole = getVenFlowRole(role);

	const username =
		user?.username ||
		localStorage.getItem("username") ||
		"User";

	const filteredNavItems = navItems.filter((item) =>
		canAccessVenFlowScreen(item.screen, venFlowRole)
	);

	const linkStyle = (active) => ({
		display: "flex",
		alignItems: "center",
		justifyContent: collapsed ? "center" : "flex-start",
		gap: collapsed ? 0 : 13,
		padding: collapsed ? "11px 0" : "11px 14px",
		marginBottom: 6,
		borderRadius: 12,
		textDecoration: "none",
		fontWeight: 800,
		fontSize: 13,
		color: active ? "#fff" : "rgba(255,255,255,.72)",
		background: active
			? "linear-gradient(135deg,#1d4ed8,#2563eb)"
			: "transparent",
		border: active
			? "1px solid rgba(59,130,246,.38)"
			: "1px solid transparent",
		boxShadow: active
			? "0 8px 24px rgba(37,99,235,.22)"
			: "none",
		transition: "all .22s ease",
		whiteSpace: "nowrap",
		overflow: "hidden",
	});

	const openQuickAction = (path) => {
		navigate(path);
	};

	return (
		<div style={sidebarStyle(collapsed)}>
			<div style={sidebarGlow} />

			<div style={logoSectionStyle(collapsed)}>
				<div style={logoIcon}>V</div>

				{!collapsed && (
					<div>
						<div style={logoTitle}>VenFlow</div>
						<div style={logoSub}>Veneer Workflow</div>
					</div>
				)}
			</div>

			{!collapsed && (
				<div style={menuTitle}>
					Tracker Menu
				</div>
			)}

			{filteredNavItems.map((item) => {
				const active =
					location.pathname === item.path ||
					location.pathname.startsWith(`${item.path}/`);

				return (
					<Tooltip
						key={item.path}
						title={collapsed ? item.label : ""}
						placement="right"
						arrow
					>
						<Link
							to={item.path}
							style={linkStyle(active)}
						>
							<span style={navIcon}>{item.icon}</span>

							{!collapsed && item.label}
						</Link>
					</Tooltip>
				);
			})}

			<div style={sidebarDivider} />

			<div style={quickActionBoxStyle(collapsed)}>
				{!collapsed && (
					<div style={quickActionHeader}>
						Quick Actions
					</div>
				)}

				<Tooltip
					title={collapsed ? "New Request" : ""}
					placement="right"
					arrow
				>
					<button
						type="button"
						style={quickActionBtnStyle(collapsed)}
						onClick={() => openQuickAction("/venflow/create")}
					>
						<AddIcon fontSize="small" />

						{!collapsed && "New Request"}
					</button>
				</Tooltip>

				<Tooltip
					title={collapsed ? "Raise PO" : ""}
					placement="right"
					arrow
				>
					<button
						type="button"
						style={quickActionBtnStyle(collapsed)}
						onClick={() => openQuickAction("/venflow/purchase")}
					>
						<AddIcon fontSize="small" />

						{!collapsed && "Raise PO"}
					</button>
				</Tooltip>

				<Tooltip
					title={collapsed ? "Reports" : ""}
					placement="right"
					arrow
				>
					<button
						type="button"
						style={quickActionBtnStyle(collapsed)}
						onClick={() => openQuickAction("/venflow/reports")}
					>
						<AddIcon fontSize="small" />

						{!collapsed && "Reports"}
					</button>
				</Tooltip>
			</div>

			<div style={{ flex: 1 }} />

			<Tooltip
				title={
					collapsed
						? `${username} • ${venFlowRoleLabel(venFlowRole)}`
						: ""
				}
				placement="right"
				arrow
			>
				<div style={sidebarUserCardStyle(collapsed)}>
					<div style={sidebarAvatar}>
						{username.charAt(0).toUpperCase()}
					</div>

					{!collapsed && (
						<div style={{ minWidth: 0 }}>
							<div style={sidebarUserName}>{username}</div>
							<div style={sidebarUserRole}>
								{venFlowRoleLabel(venFlowRole)}
							</div>
						</div>
					)}
				</div>
			</Tooltip>
		</div>
	);
}

function VenFlowHeader({
	sidebarCollapsed,
	onToggleSidebar,
}) {
	const navigate = useNavigate();

	const location = useLocation();

	const headerMeta = useMemo(() => {
		const path = location.pathname;

		if (path.includes("/venflow/dashboard")) {
			return {
				title: "Veneer Dashboard",
				sub: "Workflow Overview",
			};
		}

		if (path.includes("/venflow/store")) {
			return {
				title: "Store Desk",
				sub: "Material Review & Store Actions",
			};
		}

		if (path.includes("/venflow/purchase")) {
			return {
				title: "Purchase Desk",
				sub: "PO & Purchase Control",
			};
		}

		if (path.includes("/venflow/production")) {
			return {
				title: "Production Desk",
				sub: "Processing & Closure Control",
			};
		}

		if (path.includes("/venflow/create")) {
			return {
				title: "New Veneer Requirement",
				sub: "Controlled Indent Creation",
			};
		}

		if (path.includes("/venflow/entries/")) {
			return {
				title: "Full Tracker",
				sub: "Focused Tracker",
			};
		}

		return {
			title: "Full Tracker",
			sub: "Focused Tracker",
		};
	}, [location.pathname]);

	const {
		user,
		role,
		modules,
		logout,
	} = useAuth();

	const venFlowRole = getVenFlowRole(role);

	const username =
		user?.username ||
		localStorage.getItem("username") ||
		"User";

	const moduleList = Array.isArray(modules)
		? modules
		: [];

	const canOpenPackFlow =
		moduleList.includes("PACKFLOW") ||
		venFlowRole === "ADMIN";

	const canOpenBOMFlow =
		moduleList.includes("BOMFLOW") ||
		venFlowRole === "ADMIN";

	const canOpenVenFlow =
		moduleList.includes("VENFLOW") ||
		venFlowRole === "ADMIN" ||
		String(venFlowRole).startsWith("VENFLOW_");

	const [appsAnchor, setAppsAnchor] = useState(null);
	const [notifAnchor, setNotifAnchor] = useState(null);
	const [healthAnchor, setHealthAnchor] = useState(null);
	const [settingsOpen, setSettingsOpen] = useState(false);

	const notifications = useMemo(
		() => [
			{
				id: 1,
				title: "Store review pending",
				message: "Some veneer indents are waiting for Store action.",
				type: "STORE",
			},
			{
				id: 2,
				title: "PO approval pending",
				message: "Raised PO entries may need manager approval.",
				type: "PURCHASE",
			},
		],
		[]
	);

	const openModule = (path) => {
		navigate(path);
		setAppsAnchor(null);
	};

	const handleLogout = async () => {
		await logout();
		navigate("/login", { replace: true });
	};

	return (
		<>
			<div style={header}>
				<div style={headerLeft}>
					<Tooltip
						title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
						arrow
					>
						<IconButton
							sx={menuBtnSx}
							onClick={onToggleSidebar}
						>
							<MenuIcon />
						</IconButton>
					</Tooltip>

					<div>
						<div style={headerTitle}>{headerMeta.title}</div>
						<div style={headerSub}>{headerMeta.sub}</div>
					</div>
				</div>

				<div style={headerRight}>
					<div style={searchBox}>
						<SearchIcon style={{ fontSize: 18, color: "#94a3b8" }} />
						<span style={searchPlaceholder}>Search VenFlow...</span>
						<span style={searchHint}>⌘ K</span>
					</div>

					<Tooltip title="System health">
						<button
							style={healthBadge}
							onClick={(e) => setHealthAnchor(e.currentTarget)}
						>
							● System Healthy
						</button>
					</Tooltip>

					<Tooltip title="Open modules">
						<IconButton
							sx={iconBtnSx}
							onClick={(e) => setAppsAnchor(e.currentTarget)}
						>
							<AppsIcon />
						</IconButton>
					</Tooltip>

					<Tooltip title="Notifications">
						<IconButton
							sx={iconBtnSx}
							onClick={(e) => setNotifAnchor(e.currentTarget)}
						>
							<Badge badgeContent={notifications.length} color="error">
								<NotificationsNoneIcon />
							</Badge>
						</IconButton>
					</Tooltip>

					<Tooltip title="Settings">
						<IconButton
							sx={iconBtnSx}
							onClick={() => setSettingsOpen(true)}
						>
							<SettingsOutlinedIcon />
						</IconButton>
					</Tooltip>

					<div style={headerUserCard}>
						<div style={headerAvatar}>
							{username.charAt(0).toUpperCase()}
						</div>

						<div>
							<div style={headerUserName}>{username}</div>
							<div style={headerUserRole}>
								{venFlowRoleLabel(venFlowRole)}
							</div>
						</div>
					</div>
				</div>
			</div>

			<Popover
				open={Boolean(appsAnchor)}
				anchorEl={appsAnchor}
				onClose={() => setAppsAnchor(null)}
				anchorOrigin={{
					vertical: "bottom",
					horizontal: "right",
				}}
				transformOrigin={{
					vertical: "top",
					horizontal: "right",
				}}
				PaperProps={{ sx: popoverPaper }}
			>
				<Box sx={popoverTitle}>Platform Modules</Box>
				<Divider sx={dividerSx} />

				<Box sx={moduleGridSx}>
					<button
						style={moduleCard}
						onClick={() => openModule("/modules")}
					>
						<AppsOutlinedIcon />
						<span>All Modules</span>
					</button>

					{canOpenPackFlow && (
						<button
							style={moduleCard}
							onClick={() => openModule("/packflow/dashboard")}
						>
							<InventoryIcon />
							<span>PackFlow</span>
						</button>
					)}

					{canOpenBOMFlow && (
						<button
							style={moduleCard}
							onClick={() => openModule("/bomflow/dashboard")}
						>
							<LayersOutlinedIcon />
							<span>BOMFlow</span>
						</button>
					)}

					{canOpenVenFlow && (
						<button
							style={moduleCard}
							onClick={() => openModule("/venflow/entries")}
						>
							<FormatListBulletedOutlinedIcon />
							<span>VenFlow</span>
						</button>
					)}

					{venFlowRole === "ADMIN" && (
						<button
							style={moduleCard}
							onClick={() => openModule("/users")}
						>
							<PersonIcon />
							<span>User Management</span>
						</button>
					)}
				</Box>
			</Popover>

			<Popover
				open={Boolean(notifAnchor)}
				anchorEl={notifAnchor}
				onClose={() => setNotifAnchor(null)}
				anchorOrigin={{
					vertical: "bottom",
					horizontal: "right",
				}}
				transformOrigin={{
					vertical: "top",
					horizontal: "right",
				}}
				PaperProps={{ sx: popoverPaper }}
			>
				<Box sx={popoverTitle}>Notifications</Box>
				<Divider sx={dividerSx} />

				<Box sx={{ width: 360 }}>
					{notifications.map((n) => (
						<Box key={n.id} sx={notificationItemSx}>
							<Box sx={notificationDotSx}>●</Box>

							<Box>
								<Box sx={notificationTitleSx}>{n.title}</Box>
								<Box sx={notificationMsgSx}>{n.message}</Box>
								<Box sx={notificationTypeSx}>{n.type}</Box>
							</Box>
						</Box>
					))}
				</Box>
			</Popover>

			<Popover
				open={Boolean(healthAnchor)}
				anchorEl={healthAnchor}
				onClose={() => setHealthAnchor(null)}
				anchorOrigin={{
					vertical: "bottom",
					horizontal: "right",
				}}
				transformOrigin={{
					vertical: "top",
					horizontal: "right",
				}}
				PaperProps={{ sx: popoverPaper }}
			>
				<Box sx={popoverTitle}>System Health</Box>
				<Divider sx={dividerSx} />

				<Box sx={healthRowSx}>
					<HealthAndSafetyIcon fontSize="small" />
					API Connected
				</Box>

				<Box sx={healthRowSx}>
					<HealthAndSafetyIcon fontSize="small" />
					Auth Session Active
				</Box>

				<Box sx={healthRowSx}>
					<HealthAndSafetyIcon fontSize="small" />
					VenFlow Module Ready
				</Box>
			</Popover>

			<Drawer
				anchor="right"
				open={settingsOpen}
				onClose={() => setSettingsOpen(false)}
				PaperProps={{ sx: settingsDrawer }}
			>
				<Box sx={settingsHeader}>
					<Box>
						<Box sx={settingsTitle}>Settings</Box>
						<Box sx={settingsSub}>User and application controls</Box>
					</Box>

					<IconButton
						onClick={() => setSettingsOpen(false)}
						sx={drawerCloseBtn}
					>
						<CloseIcon />
					</IconButton>
				</Box>

				<Divider sx={dividerSx} />

				<Box sx={profileCard}>
					<Box sx={profileAvatar}>
						{username.charAt(0).toUpperCase()}
					</Box>

					<Box>
						<Box sx={profileName}>{username}</Box>
						<Box sx={profileRole}>{venFlowRoleLabel(venFlowRole)}</Box>
					</Box>
				</Box>

				<Box sx={settingsSection}>
					<Box sx={sectionLabel}>Quick Actions</Box>

					<button
						style={settingsAction}
						onClick={() => navigate("/modules")}
					>
						All Modules
					</button>

					<button
						style={settingsAction}
						onClick={() => navigate("/venflow/entries")}
					>
						VenFlow Full Tracker
					</button>

					<button
						style={settingsAction}
						onClick={() => navigate("/venflow/create")}
					>
						New Veneer Requirement
					</button>

					<button
						style={settingsActionDanger}
						onClick={handleLogout}
					>
						Logout
					</button>
				</Box>
			</Drawer>
		</>
	);
}

/* ===================== LAYOUT ===================== */

const shell = {
	display: "flex",
	width: "100%",
	minHeight: "100vh",
	background: "linear-gradient(135deg,#020617 0%,#0f172a 48%,#111827 100%)",
	overflow: "hidden",
};

const main = {
	flex: 1,
	minWidth: 0,
	display: "flex",
	flexDirection: "column",
};

const contentShell = {
	flex: 1,
	overflow: "auto",
	padding: 18,
	background: `
		radial-gradient(circle at top left, rgba(59,130,246,.11), transparent 24%),
		radial-gradient(circle at bottom right, rgba(14,165,233,.08), transparent 24%)
	`,
};

const contentInner = {
	width: "100%",
	minHeight: "100%",
};

/* ===================== SIDEBAR ===================== */

const sidebarStyle = (collapsed) => ({
	width: collapsed ? 78 : 230,
	height: "100vh",
	padding: collapsed ? "18px 8px" : "18px 12px",
	boxSizing: "border-box",
	display: "flex",
	flexDirection: "column",
	position: "relative",
	background: "linear-gradient(180deg,#06111f 0%,#081629 100%)",
	borderRight: "1px solid rgba(255,255,255,.06)",
	boxShadow: "8px 0 30px rgba(2,6,23,.45)",
	overflow: "hidden",
	transition: "width .25s ease, padding .25s ease",
	flexShrink: 0,
});

const sidebarGlow = {
	position: "absolute",
	top: 0,
	left: 0,
	right: 0,
	height: 110,
	background: "linear-gradient(180deg, rgba(37,99,235,.20), transparent)",
	pointerEvents: "none",
};

const logoSectionStyle = (collapsed) => ({
	position: "relative",
	zIndex: 1,
	display: "flex",
	alignItems: "center",
	justifyContent: collapsed ? "center" : "flex-start",
	gap: collapsed ? 0 : 12,
	marginBottom: 20,
	paddingLeft: collapsed ? 0 : 4,
	transition: "all .25s ease",
});

const logoIcon = {
	width: 36,
	height: 36,
	borderRadius: 12,
	display: "grid",
	placeItems: "center",
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	color: "#fff",
	fontWeight: 950,
	fontSize: 16,
	boxShadow: "0 12px 28px rgba(37,99,235,.35)",
};

const logoTitle = {
	color: "#fff",
	fontWeight: 950,
	fontSize: 18,
	lineHeight: 1,
};

const logoSub = {
	color: "rgba(255,255,255,.48)",
	fontSize: 11,
	marginTop: 4,
	fontWeight: 700,
};

const menuTitle = {
	color: "rgba(255,255,255,.42)",
	fontSize: 10,
	fontWeight: 950,
	textTransform: "uppercase",
	letterSpacing: ".12em",
	margin: "0 0 10px 7px",
};

const navIcon = {
	width: 20,
	minWidth: 20,
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	color: "inherit",
};

const sidebarDivider = {
	height: 1,
	background: "linear-gradient(90deg, rgba(255,255,255,.12), transparent)",
	margin: "14px 0",
};

const quickActionHeader = {
	color: "#fff",
	fontSize: 13,
	fontWeight: 900,
	marginBottom: 10,
};

const quickActionBoxStyle = (collapsed) => ({
	padding: collapsed ? "10px 6px" : "12px 10px",
	borderRadius: 16,
	background: "rgba(255,255,255,.035)",
	border: "1px solid rgba(255,255,255,.06)",
	transition: "all .25s ease",
});

const quickActionBtnStyle = (collapsed) => ({
	width: "100%",
	height: 34,
	border: "none",
	borderRadius: 10,
	background: "transparent",
	color: "rgba(255,255,255,.70)",
	display: "flex",
	alignItems: "center",
	justifyContent: collapsed ? "center" : "flex-start",
	gap: collapsed ? 0 : 8,
	cursor: "pointer",
	fontWeight: 750,
	fontSize: 12,
	fontFamily: "inherit",
	padding: collapsed ? 0 : "0 4px",
	marginBottom: collapsed ? 6 : 0,
	transition: "all .2s ease",

	"&:hover": {
		background: "rgba(59,130,246,.12)",
	},
});

const sidebarUserCardStyle = (collapsed) => ({
	minHeight: 56,
	borderRadius: 16,
	background: "rgba(255,255,255,.045)",
	border: "1px solid rgba(255,255,255,.08)",
	display: "flex",
	alignItems: "center",
	justifyContent: collapsed ? "center" : "flex-start",
	gap: collapsed ? 0 : 10,
	padding: collapsed ? "9px 6px" : "9px 10px",
	transition: "all .25s ease",
});

const sidebarAvatar = {
	width: 36,
	height: 36,
	borderRadius: 12,
	display: "grid",
	placeItems: "center",
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	color: "#fff",
	fontWeight: 950,
};

const sidebarUserName = {
	color: "#fff",
	fontSize: 12,
	fontWeight: 900,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const sidebarUserRole = {
	color: "rgba(255,255,255,.50)",
	fontSize: 10.5,
	fontWeight: 700,
	marginTop: 3,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

/* ===================== HEADER ===================== */

const header = {
	height: 66,
	padding: "0 20px",
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	background: "linear-gradient(180deg,#06111f 0%,#081629 100%)",
	borderBottom: "1px solid rgba(255,255,255,.06)",
	boxShadow: "0 10px 30px rgba(2,6,23,.35)",
	position: "sticky",
	top: 0,
	zIndex: 50,
};

const headerLeft = {
	display: "flex",
	alignItems: "center",
	gap: 14,
};

const menuBtnSx = {
	width: 38,
	height: 38,
	borderRadius: "12px",
	color: "#cbd5e1",
	background: "rgba(255,255,255,.04)",
	border: "1px solid rgba(255,255,255,.06)",
};

const headerTitle = {
	color: "#fff",
	fontSize: 18,
	fontWeight: 950,
	lineHeight: 1,
};

const headerSub = {
	color: "#60a5fa",
	fontSize: 11,
	fontWeight: 850,
	marginTop: 5,
};

const headerRight = {
	display: "flex",
	alignItems: "center",
	gap: 10,
};

const searchBox = {
	width: 260,
	height: 38,
	borderRadius: 12,
	background: "rgba(255,255,255,.045)",
	border: "1px solid rgba(255,255,255,.08)",
	display: "flex",
	alignItems: "center",
	gap: 8,
	padding: "0 10px",
};

const searchPlaceholder = {
	color: "rgba(255,255,255,.50)",
	fontSize: 12,
	fontWeight: 650,
	flex: 1,
};

const searchHint = {
	color: "rgba(255,255,255,.45)",
	background: "rgba(255,255,255,.06)",
	border: "1px solid rgba(255,255,255,.08)",
	borderRadius: 7,
	fontSize: 10,
	fontWeight: 850,
	padding: "2px 6px",
};

const healthBadge = {
	height: 36,
	padding: "0 13px",
	borderRadius: 999,
	background: "rgba(34,197,94,.12)",
	color: "#86efac",
	border: "1px solid rgba(34,197,94,.22)",
	fontWeight: 900,
	fontSize: 11,
	cursor: "pointer",
	fontFamily: "inherit",
};

const iconBtnSx = {
	width: 38,
	height: 38,
	borderRadius: "12px",
	color: "rgba(255,255,255,.82)",
	background: "rgba(255,255,255,.04)",
	border: "1px solid rgba(255,255,255,.06)",

	"&:hover": {
		background: "rgba(59,130,246,.16)",
		borderColor: "rgba(59,130,246,.35)",
	},
};

const headerUserCard = {
	height: 42,
	display: "flex",
	alignItems: "center",
	gap: 9,
	padding: "0 10px",
	borderRadius: 14,
	background: "rgba(255,255,255,.045)",
	border: "1px solid rgba(255,255,255,.08)",
};

const headerAvatar = {
	width: 30,
	height: 30,
	borderRadius: 11,
	display: "grid",
	placeItems: "center",
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	color: "#fff",
	fontWeight: 950,
	fontSize: 12,
};

const headerUserName = {
	color: "#fff",
	fontWeight: 900,
	fontSize: 12,
	lineHeight: 1,
};

const headerUserRole = {
	color: "rgba(255,255,255,.52)",
	fontWeight: 650,
	fontSize: 10,
	marginTop: 4,
};

/* ===================== POPOVERS ===================== */

const popoverPaper = {
	mt: 1.2,
	borderRadius: "18px",
	background: "linear-gradient(180deg,#0f172a,#111827)",
	color: "#fff",
	border: "1px solid rgba(255,255,255,.08)",
	boxShadow: "0 24px 70px rgba(0,0,0,.45)",
	p: 2,
};

const popoverTitle = {
	fontSize: 15,
	fontWeight: 950,
	color: "#fff",
};

const dividerSx = {
	borderColor: "rgba(255,255,255,.08)",
	my: 1.4,
};

const moduleGridSx = {
	width: 340,
	display: "grid",
	gridTemplateColumns: "repeat(2, minmax(0,1fr))",
	gap: 1.1,
};

const moduleCard = {
	minHeight: 72,
	borderRadius: 14,
	border: "1px solid rgba(255,255,255,.08)",
	background: "rgba(255,255,255,.04)",
	color: "#fff",
	cursor: "pointer",
	display: "flex",
	flexDirection: "column",
	alignItems: "flex-start",
	justifyContent: "center",
	gap: 8,
	padding: "12px 14px",
	fontWeight: 850,
	fontFamily: "inherit",
};

const notificationItemSx = {
	display: "grid",
	gridTemplateColumns: "18px 1fr",
	gap: 1,
	p: 1.4,
	borderRadius: "14px",
	border: "1px solid rgba(255,255,255,.06)",
	background: "rgba(255,255,255,.035)",
	mb: 1,
};

const notificationDotSx = {
	color: "#60a5fa",
	fontSize: 12,
	pt: 0.3,
};

const notificationTitleSx = {
	fontSize: 13,
	fontWeight: 900,
	color: "#fff",
};

const notificationMsgSx = {
	fontSize: 12,
	color: "#94a3b8",
	mt: 0.5,
	lineHeight: 1.45,
};

const notificationTypeSx = {
	display: "inline-flex",
	mt: 1,
	px: 1,
	py: 0.3,
	borderRadius: "999px",
	fontSize: 10,
	fontWeight: 900,
	color: "#60a5fa",
	background: "rgba(59,130,246,.12)",
};

const healthRowSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	color: "#cbd5e1",
	fontWeight: 800,
	fontSize: 13,
	py: 1,
	minWidth: 260,

	"& svg": {
		color: "#4ade80",
	},
};

const settingsDrawer = {
	width: 390,
	background: "linear-gradient(180deg,#020617,#0f172a)",
	color: "#fff",
	p: 3,
	borderLeft: "1px solid rgba(255,255,255,.08)",
};

const settingsHeader = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
};

const settingsTitle = {
	fontSize: 24,
	fontWeight: 950,
};

const settingsSub = {
	fontSize: 13,
	color: "#94a3b8",
	mt: 0.5,
};

const drawerCloseBtn = {
	color: "#fff",
	background: "rgba(255,255,255,.04)",
	border: "1px solid rgba(255,255,255,.08)",
};

const profileCard = {
	display: "flex",
	alignItems: "center",
	gap: 2,
	p: 2,
	borderRadius: "16px",
	background: "rgba(255,255,255,.04)",
	border: "1px solid rgba(255,255,255,.08)",
};

const profileAvatar = {
	width: 44,
	height: 44,
	borderRadius: "15px",
	display: "grid",
	placeItems: "center",
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	fontWeight: 950,
};

const profileName = {
	fontWeight: 950,
	fontSize: 15,
};

const profileRole = {
	color: "#94a3b8",
	fontSize: 12,
	mt: 0.4,
};

const settingsSection = {
	mt: 3,
};

const sectionLabel = {
	color: "#94a3b8",
	textTransform: "uppercase",
	letterSpacing: "0.12em",
	fontSize: 11,
	fontWeight: 950,
	mb: 1.5,
};

const settingsAction = {
	width: "100%",
	height: 44,
	borderRadius: 14,
	border: "1px solid rgba(255,255,255,.08)",
	background: "rgba(255,255,255,.04)",
	color: "#fff",
	cursor: "pointer",
	fontWeight: 850,
	textAlign: "left",
	padding: "0 14px",
	marginBottom: 10,
	fontFamily: "inherit",
};

const settingsActionDanger = {
	...settingsAction,
	background: "rgba(239,68,68,.14)",
	color: "#f87171",
	border: "1px solid rgba(239,68,68,.22)",
};