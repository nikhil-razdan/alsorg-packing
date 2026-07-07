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
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import FormatListBulletedOutlinedIcon from "@mui/icons-material/FormatListBulletedOutlined";
import AddCircleOutlineOutlinedIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import ShoppingCartCheckoutOutlinedIcon from "@mui/icons-material/ShoppingCartCheckoutOutlined";
import WarehouseOutlinedIcon from "@mui/icons-material/WarehouseOutlined";
import PrecisionManufacturingOutlinedIcon from "@mui/icons-material/PrecisionManufacturingOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import InventoryIcon from "@mui/icons-material/Inventory";
import PersonIcon from "@mui/icons-material/Person";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import CloseIcon from "@mui/icons-material/Close";
import HealthAndSafetyIcon from "@mui/icons-material/HealthAndSafety";
import AddIcon from "@mui/icons-material/Add";
import AppsOutlinedIcon from "@mui/icons-material/AppsOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";

import { useAuth } from "../../auth/AuthContext";

import {
	canAccessVenFlowScreen,
	getVenFlowRole,
	venFlowRoleLabel,
} from "./../../utils/venflowAccess";

const BASE_NAV_ITEMS = [
	{
		label: "Dashboard",
		path: "/venflow/dashboard",
		screen: "dashboard",
		icon: <DashboardOutlinedIcon fontSize="small" />,
	},
	{
		label: "Production Desk",
		path: "/venflow/production",
		screen: "production",
		icon: <PrecisionManufacturingOutlinedIcon fontSize="small" />,
	},
	{
		label: "Store Desk",
		path: "/venflow/store",
		screen: "store",
		icon: <WarehouseOutlinedIcon fontSize="small" />,
	},
	{
		label: "Purchase Desk",
		path: "/venflow/purchase",
		screen: "purchase",
		icon: <ShoppingCartCheckoutOutlinedIcon fontSize="small" />,
	},
	{
		label: "Full Tracker",
		path: "/venflow/entries",
		screen: "entries",
		icon: <FormatListBulletedOutlinedIcon fontSize="small" />,
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

export default function VenFlowLayout() {
	const {
		user,
		role,
		modules,
		logout,
	} = useAuth();

	const venFlowRole = getVenFlowRole(role);

	const navItems = useMemo(() => {
		return BASE_NAV_ITEMS.filter((item) =>
			canAccessVenFlowScreen(item.screen, venFlowRole)
		);
	}, [venFlowRole]);

	return (
		<div style={shell}>
			<VenFlowSidebar navItems={navItems} />

			<div style={main}>
				<VenFlowHeader
					user={user}
					role={role}
					modules={modules}
					logout={logout}
					venFlowRole={venFlowRole}
					navItems={navItems}
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

function VenFlowSidebar({ navItems }) {
	const location = useLocation();
	const navigate = useNavigate();

	const [collapsed, setCollapsed] = useState(false);

	const canCreateRequirement = navItems.some(
		(item) => item.path === "/venflow/create"
	);

	const linkStyle = (active) => ({
		display: "flex",
		alignItems: "center",
		gap: collapsed ? 0 : 14,
		padding: "11px 14px",
		marginBottom: 6,
		borderRadius: 14,
		textDecoration: "none",
		fontWeight: 700,
		fontSize: 14,
		color: active ? "#fff" : "rgba(255,255,255,.72)",
		background: active
			? "linear-gradient(135deg,#1d4ed8,#2563eb)"
			: "transparent",
		border: active
			? "1px solid rgba(59,130,246,.35)"
			: "1px solid transparent",
		boxShadow: active
			? "0 6px 18px rgba(37,99,235,.18)"
			: "none",
		transition: "all .22s ease",
		justifyContent: collapsed ? "center" : "flex-start",
	});

	return (
		<div
			style={{
				...sidebar,
				width: collapsed ? 64 : 230,
			}}
		>
			<div style={topHighlight} />

			<div style={logoSection}>
				<div style={logoIcon}>
					V
				</div>

				{!collapsed && (
					<div>
						<div style={logoTitle}>
							ALSORG
						</div>

						<div style={logoSub}>
							VenFlow
						</div>
					</div>
				)}
			</div>

			<div
				style={{
					...toggleRow,
					justifyContent: collapsed
						? "center"
						: "space-between",
				}}
			>
				{!collapsed && (
					<div style={menuTitle}>
						Menu
					</div>
				)}

				<button
					type="button"
					onClick={() => setCollapsed((v) => !v)}
					style={toggleButton}
					title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
				>
					{collapsed ? "›" : "‹"}
				</button>
			</div>

			<Link
				to="/modules"
				style={linkStyle(location.pathname === "/modules")}
			>
				<span style={navIcon}>
					<AppsOutlinedIcon fontSize="small" />
				</span>

				{!collapsed && "All Modules"}
			</Link>

			<div style={smallDivider} />

			{navItems.map((link) => {
				const active =
					location.pathname === link.path ||
					location.pathname.startsWith(`${link.path}/`);

				return (
					<Link
						key={link.path}
						to={link.path}
						style={linkStyle(active)}
					>
						<span style={navIcon}>
							{link.icon}
						</span>

						{!collapsed && link.label}
					</Link>
				);
			})}

			<div style={{ flexGrow: 1 }} />

			{!collapsed && canCreateRequirement && (
				<button
					type="button"
					onClick={() => navigate("/venflow/create")}
					style={newRequirementBtn}
				>
					<AddIcon fontSize="small" />
					New Requirement
				</button>
			)}

			<div style={divider} />
		</div>
	);
}

function VenFlowHeader({
	user,
	role,
	modules,
	logout,
	venFlowRole,
	navItems,
}) {
	const navigate = useNavigate();

	const username =
		user?.username ||
		localStorage.getItem("username") ||
		"User";

	const userInitial =
		username?.charAt(0)?.toUpperCase() || "U";

	const plantText =
		Array.isArray(user?.plantCodes) && user.plantCodes.length > 0
			? user.plantCodes.join(", ")
			: venFlowRole === "ADMIN" || venFlowRole === "VENFLOW_MANAGER"
				? "All Plants"
				: "No Plant";

	const moduleList = Array.isArray(modules)
		? modules
		: [];

	const cleanRole = String(role || "").trim().toUpperCase();

	const canOpenPackFlow =
		moduleList.includes("PACKFLOW") ||
		cleanRole === "ADMIN";

	const canOpenBOMFlow =
		moduleList.includes("BOMFLOW") ||
		cleanRole === "ADMIN";

	const canOpenVenFlow =
		moduleList.includes("VENFLOW") ||
		cleanRole === "ADMIN";

	const [appsAnchor, setAppsAnchor] = useState(null);
	const [notifAnchor, setNotifAnchor] = useState(null);
	const [healthAnchor, setHealthAnchor] = useState(null);
	const [settingsOpen, setSettingsOpen] = useState(false);

	const [notifications, setNotifications] = useState([
		{
			id: 1,
			title: "Store review pending",
			message:
				"New veneer indents may need AKG Store stock review.",
			type: "VENFLOW",
			read: false,
		},
		{
			id: 2,
			title: "Purchase action pending",
			message:
				"Some purchase requests may be waiting for PO creation or approval.",
			type: "PURCHASE",
			read: false,
		},
	]);

	const quickLinks = useMemo(() => {
		return navItems.map((item) => ({
			label: item.label,
			path: item.path,
			icon: item.icon,
		}));
	}, [navItems]);

	const unreadCount =
		notifications.filter((n) => !n.read).length;

	const handleLogout = async () => {
		if (typeof logout === "function") {
			await logout();
		} else {
			localStorage.clear();
		}

		navigate("/login", { replace: true });
	};

	const openModule = (path) => {
		navigate(path);
		setAppsAnchor(null);
	};

	const markAllAsRead = () => {
		setNotifications((prev) =>
			prev.map((n) => ({
				...n,
				read: true,
			}))
		);
	};

	return (
		<>
			<div style={header}>
				<div style={headerLeft}>
					<div style={brandWrap}>
						<div style={brandMark}>
							V
						</div>

						<div>
							<div style={title}>
								VenFlow
							</div>

							<div style={subtitle}>
								Alsorg Operations Suite
							</div>
						</div>
					</div>
				</div>

				<div style={headerRight}>
					<button
						type="button"
						style={statusBadge}
						onClick={(e) =>
							setHealthAnchor(e.currentTarget)
						}
					>
						● SYSTEM HEALTHY
					</button>

					<button
						type="button"
						style={currentUserPill}
						onClick={() => setSettingsOpen(true)}
						title="Current user"
					>
						<span style={currentUserAvatar}>
							{userInitial}
						</span>

						<span style={currentUserTextWrap}>
							<span style={currentUserLabel}>
								Current User
							</span>

							<span style={currentUserName}>
								{username}
							</span>
						</span>
					</button>

					<Tooltip title="Open modules">
						<IconButton
							sx={iconBtnSx}
							onClick={(e) =>
								setAppsAnchor(e.currentTarget)
							}
						>
							<AppsIcon />
						</IconButton>
					</Tooltip>

					<Tooltip title="Notifications">
						<IconButton
							sx={iconBtnSx}
							onClick={(e) =>
								setNotifAnchor(e.currentTarget)
							}
						>
							<Badge
								badgeContent={unreadCount}
								color="error"
								overlap="circular"
							>
								<NotificationsNoneIcon />
							</Badge>
						</IconButton>
					</Tooltip>

					<Tooltip title="Settings">
						<IconButton
							sx={iconBtnSx}
							onClick={() =>
								setSettingsOpen(true)
							}
						>
							<SettingsOutlinedIcon />
						</IconButton>
					</Tooltip>

					<Button
						startIcon={<LogoutIcon />}
						onClick={handleLogout}
						sx={logoutButton}
					>
						Logout
					</Button>
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
				PaperProps={{
					sx: popoverPaper,
				}}
			>
				<Box sx={popoverTitle}>
					Platform Modules
				</Box>

				<Divider sx={dividerSx} />

				<Box sx={moduleGrid}>
					<button
						type="button"
						style={moduleCard}
						onClick={() => openModule("/modules")}
					>
						<span style={moduleIcon}>
							<AppsIcon />
						</span>

						<span>
							All Modules
						</span>
					</button>

					{canOpenPackFlow && (
						<button
							type="button"
							style={moduleCard}
							onClick={() =>
								openModule("/packflow/dashboard")
							}
						>
							<span style={moduleIcon}>
								<InventoryIcon />
							</span>

							<span>
								PackFlow
							</span>
						</button>
					)}

					{canOpenBOMFlow && (
						<button
							type="button"
							style={moduleCard}
							onClick={() =>
								openModule("/bomflow/dashboard")
							}
						>
							<span style={moduleIcon}>
								<AccountTreeOutlinedIcon />
							</span>

							<span>
								BOMFlow
							</span>
						</button>
					)}

					{canOpenVenFlow && (
						<button
							type="button"
							style={moduleCard}
							onClick={() =>
								openModule("/venflow/dashboard")
							}
						>
							<span style={moduleIcon}>
								<LayersOutlinedIcon />
							</span>

							<span>
								VenFlow
							</span>
						</button>
					)}

					{cleanRole === "ADMIN" && (
						<button
							type="button"
							style={moduleCard}
							onClick={() =>
								openModule("/users")
							}
						>
							<span style={moduleIcon}>
								<PersonIcon />
							</span>

							<span>
								User Management
							</span>
						</button>
					)}
				</Box>

				<Divider sx={dividerSx} />

				<Box sx={popoverTitle}>
					VenFlow Quick Links
				</Box>

				<Divider sx={dividerSx} />

				<Box sx={moduleGrid}>
					{quickLinks.map((item) => (
						<button
							key={item.path}
							type="button"
							style={moduleCard}
							onClick={() =>
								openModule(item.path)
							}
						>
							<span style={moduleIcon}>
								{item.icon}
							</span>

							<span>
								{item.label}
							</span>
						</button>
					))}
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
				PaperProps={{
					sx: popoverPaper,
				}}
			>
				<Box sx={popoverHeader}>
					<Box sx={popoverTitle}>
						Notifications
					</Box>

					<Button
						size="small"
						onClick={markAllAsRead}
						sx={smallAction}
					>
						Mark read
					</Button>
				</Box>

				<Divider sx={dividerSx} />

				<Box sx={{ width: 360 }}>
					{notifications.length === 0 && (
						<Box sx={emptyState}>
							No notifications
						</Box>
					)}

					{notifications.map((n) => (
						<Box
							key={n.id}
							sx={{
								...notificationItem,
								opacity: n.read ? 0.58 : 1,
							}}
						>
							<Box sx={notificationDot}>
								{!n.read ? "●" : ""}
							</Box>

							<Box>
								<Box sx={notificationTitle}>
									{n.title}
								</Box>

								<Box sx={notificationMsg}>
									{n.message}
								</Box>

								<Box sx={notificationType}>
									{n.type}
								</Box>
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
				PaperProps={{
					sx: popoverPaper,
				}}
			>
				<Box sx={popoverTitle}>
					System Health
				</Box>

				<Divider sx={dividerSx} />

				<Box sx={healthRow}>
					<HealthAndSafetyIcon fontSize="small" />
					API Connected
				</Box>

				<Box sx={healthRow}>
					<HealthAndSafetyIcon fontSize="small" />
					Auth Session Active
				</Box>

				<Box sx={healthRow}>
					<HealthAndSafetyIcon fontSize="small" />
					VenFlow Module Ready
				</Box>
			</Popover>

			<Drawer
				anchor="right"
				open={settingsOpen}
				onClose={() => setSettingsOpen(false)}
				PaperProps={{
					sx: settingsDrawer,
				}}
			>
				<Box sx={settingsHeader}>
					<Box>
						<Box sx={settingsTitle}>
							Settings
						</Box>

						<Box sx={settingsSub}>
							User and application controls
						</Box>
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
						{userInitial}
					</Box>

					<Box sx={{ minWidth: 0 }}>
						<Box sx={profileName}>
							{username}
						</Box>

						<Box sx={profileRole}>
							{venFlowRoleLabel(venFlowRole)}
						</Box>

						<Box sx={profilePlant}>
							{plantText}
						</Box>
					</Box>
				</Box>

				<Box sx={settingsSection}>
					<Box sx={sectionLabel}>
						Quick Actions
					</Box>

					<button
						type="button"
						style={settingsAction}
						onClick={() => navigate("/modules")}
					>
						All Modules
					</button>

					<button
						type="button"
						style={settingsAction}
						onClick={() => navigate("/venflow/dashboard")}
					>
						VenFlow Dashboard
					</button>

					{navItems.some((item) => item.path === "/venflow/create") && (
						<button
							type="button"
							style={settingsAction}
							onClick={() => navigate("/venflow/create")}
						>
							New Veneer Requirement
						</button>
					)}

					{canOpenBOMFlow && (
						<button
							type="button"
							style={settingsAction}
							onClick={() => navigate("/bomflow/dashboard")}
						>
							Open BOMFlow
						</button>
					)}

					{canOpenPackFlow && (
						<button
							type="button"
							style={settingsAction}
							onClick={() => navigate("/packflow/dashboard")}
						>
							Open PackFlow
						</button>
					)}

					<button
						type="button"
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

/* ===================== MAIN LAYOUT ===================== */

const shell = {
	display: "flex",
	width: "100%",
	minHeight: "100vh",
	background:
		"linear-gradient(135deg,#020617 0%,#0f172a 45%,#111827 100%)",
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
	padding: 24,
	background: `
		radial-gradient(circle at top left, rgba(59,130,246,0.10), transparent 20%),
		radial-gradient(circle at bottom right, rgba(14,165,233,0.08), transparent 20%)
	`,
};

const contentInner = {
	width: "100%",
	minHeight: "100%",
};

/* ===================== SIDEBAR ===================== */

const sidebar = {
	width: 230,
	height: "100vh",
	padding: "22px 14px",
	boxSizing: "border-box",
	display: "flex",
	flexDirection: "column",
	position: "relative",
	background:
		"linear-gradient(180deg,#071120 0%,#0a162b 100%)",
	borderRight:
		"1px solid rgba(255,255,255,.06)",
	boxShadow:
		"8px 0 30px rgba(2,6,23,.45)",
	overflow: "hidden",
	transition: "width .25s ease",
};

const topHighlight = {
	position: "absolute",
	top: 0,
	left: 0,
	right: 0,
	height: 90,
	background:
		"linear-gradient(180deg, rgba(255,255,255,0.16), transparent)",
	pointerEvents: "none",
};

const logoSection = {
	display: "flex",
	alignItems: "center",
	gap: 14,
	marginBottom: 18,
	paddingLeft: 4,
};

const logoIcon = {
	width: 36,
	height: 36,
	borderRadius: 14,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	background:
		"linear-gradient(135deg,#2563eb,#3b82f6)",
	color: "#fff",
	fontWeight: 900,
	fontSize: 16,
	boxShadow:
		"0 10px 24px rgba(37,99,235,.35)",
};

const logoTitle = {
	color: "#fff",
	fontWeight: 900,
	fontSize: 15,
	letterSpacing: 1,
};

const logoSub = {
	color: "rgba(255,255,255,.45)",
	fontSize: 11,
	marginTop: 2,
};

const toggleRow = {
	display: "flex",
	alignItems: "center",
	marginBottom: 18,
	minHeight: 28,
};

const toggleButton = {
	width: 28,
	height: 28,
	borderRadius: 10,
	border:
		"1px solid rgba(255,255,255,.08)",
	background:
		"rgba(255,255,255,.04)",
	color: "#94a3b8",
	cursor: "pointer",
	fontWeight: 900,
	fontSize: 18,
	lineHeight: 1,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	transition: "all .2s ease",
};

const menuTitle = {
	margin: 0,
	paddingLeft: 6,
	fontWeight: 700,
	fontSize: 11,
	color: "rgba(255,255,255,0.55)",
	letterSpacing: "0.12em",
	textTransform: "uppercase",
};

const navIcon = {
	width: 20,
	minWidth: 20,
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	opacity: 0.95,
	color: "inherit",
};

const smallDivider = {
	height: 1,
	background:
		"linear-gradient(90deg, rgba(255,255,255,0.10), transparent)",
	margin: "10px 0 12px",
};

const divider = {
	height: 1,
	background:
		"linear-gradient(90deg, rgba(255,255,255,0.14), transparent)",
	marginTop: 24,
};

const newRequirementBtn = {
	height: 44,
	borderRadius: 14,
	border: "none",
	background:
		"linear-gradient(135deg,#2563eb,#3b82f6)",
	color: "#fff",
	fontWeight: 800,
	cursor: "pointer",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	gap: 8,
	boxShadow:
		"0 10px 25px rgba(37,99,235,.35)",
};

/* ===================== HEADER ===================== */

const header = {
	height: 76,
	padding: "0 28px",
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	background:
		"linear-gradient(180deg,#081225 0%,#0b1730 100%)",
	borderBottom:
		"1px solid rgba(255,255,255,.06)",
	boxShadow:
		"0 10px 30px rgba(2,6,23,.35)",
	position: "sticky",
	top: 0,
	zIndex: 50,
};

const headerLeft = {
	display: "flex",
	alignItems: "center",
};

const brandWrap = {
	display: "flex",
	alignItems: "center",
	gap: 16,
};

const brandMark = {
	width: 48,
	height: 48,
	borderRadius: 16,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	fontWeight: 900,
	fontSize: 20,
	color: "#fff",
	background:
		"linear-gradient(135deg,#2563eb,#3b82f6)",
	boxShadow:
		"0 10px 25px rgba(37,99,235,.35)",
};

const title = {
	fontSize: 18,
	fontWeight: 900,
	letterSpacing: 1,
	color: "#fff",
};

const subtitle = {
	fontSize: 12,
	marginTop: 4,
	color: "rgba(255,255,255,.55)",
	letterSpacing: 0.4,
};

const headerRight = {
	display: "flex",
	alignItems: "center",
	gap: 12,
};

const statusBadge = {
	height: 38,
	padding: "0 16px",
	borderRadius: 999,
	display: "flex",
	alignItems: "center",
	background:
		"rgba(34,197,94,.12)",
	color: "#4ade80",
	border:
		"1px solid rgba(34,197,94,.22)",
	fontWeight: 800,
	fontSize: 12,
	letterSpacing: 1,
	cursor: "pointer",
};

const currentUserPill = {
	height: 42,
	maxWidth: 250,
	borderRadius: 14,
	border:
		"1px solid rgba(255,255,255,.07)",
	background:
		"rgba(255,255,255,.04)",
	color: "#fff",
	cursor: "pointer",
	display: "flex",
	alignItems: "center",
	gap: 10,
	padding: "0 12px",
	fontFamily: "inherit",
};

const currentUserAvatar = {
	width: 28,
	height: 28,
	borderRadius: 10,
	background:
		"linear-gradient(135deg,#2563eb,#3b82f6)",
	color: "#fff",
	fontWeight: 900,
	display: "grid",
	placeItems: "center",
	flexShrink: 0,
};

const currentUserTextWrap = {
	display: "flex",
	flexDirection: "column",
	alignItems: "flex-start",
	minWidth: 0,
};

const currentUserLabel = {
	color: "rgba(255,255,255,.46)",
	fontSize: 9,
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".08em",
	lineHeight: 1.1,
};

const currentUserName = {
	color: "#fff",
	fontSize: 12,
	fontWeight: 900,
	marginTop: 3,
	maxWidth: 150,
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
};

const iconBtnSx = {
	width: 42,
	height: 42,
	borderRadius: "14px",
	color: "rgba(255,255,255,.82)",
	background:
		"rgba(255,255,255,.04)",
	border:
		"1px solid rgba(255,255,255,.06)",

	"&:hover": {
		background:
			"rgba(59,130,246,.16)",
		borderColor:
			"rgba(59,130,246,.35)",
		transform: "translateY(-1px)",
	},
};

const logoutButton = {
	px: 2.2,
	py: 1,
	borderRadius: "14px",
	textTransform: "none",
	fontWeight: 700,
	background:
		"linear-gradient(135deg,#2563eb,#3b82f6)",
	color: "#fff",
	boxShadow:
		"0 10px 25px rgba(37,99,235,.35)",

	"&:hover": {
		background:
			"linear-gradient(135deg,#1d4ed8,#2563eb)",
	},
};

/* ===================== POPOVERS / DRAWER ===================== */

const popoverPaper = {
	mt: 1.5,
	borderRadius: "22px",
	background:
		"linear-gradient(180deg,#0f172a,#111827)",
	color: "#fff",
	border:
		"1px solid rgba(255,255,255,.08)",
	boxShadow:
		"0 24px 70px rgba(0,0,0,.45)",
	p: 2,
};

const popoverTitle = {
	fontSize: 16,
	fontWeight: 900,
	color: "#fff",
};

const popoverHeader = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	width: 360,
};

const dividerSx = {
	borderColor:
		"rgba(255,255,255,.08)",
	my: 1.5,
};

const moduleGrid = {
	width: 360,
	display: "grid",
	gridTemplateColumns:
		"repeat(2, minmax(0,1fr))",
	gap: 1.2,
};

const moduleCard = {
	minHeight: 74,
	borderRadius: 16,
	border:
		"1px solid rgba(255,255,255,.08)",
	background:
		"rgba(255,255,255,.04)",
	color: "#fff",
	cursor: "pointer",
	display: "flex",
	flexDirection: "column",
	alignItems: "flex-start",
	justifyContent: "center",
	gap: 8,
	padding: "12px 14px",
	fontWeight: 800,
	fontFamily: "inherit",
};

const moduleIcon = {
	color: "#60a5fa",
	display: "flex",
};

const smallAction = {
	color: "#60a5fa",
	textTransform: "none",
	fontWeight: 800,
};

const notificationItem = {
	display: "grid",
	gridTemplateColumns: "18px 1fr",
	gap: 1,
	p: 1.4,
	borderRadius: "16px",
	border:
		"1px solid rgba(255,255,255,.06)",
	background:
		"rgba(255,255,255,.035)",
	mb: 1,
};

const notificationDot = {
	color: "#60a5fa",
	fontSize: 12,
	pt: 0.3,
};

const notificationTitle = {
	fontSize: 13,
	fontWeight: 900,
	color: "#fff",
};

const notificationMsg = {
	fontSize: 12,
	color: "#94a3b8",
	mt: 0.5,
	lineHeight: 1.45,
};

const notificationType = {
	display: "inline-flex",
	mt: 1,
	px: 1,
	py: 0.3,
	borderRadius: "999px",
	fontSize: 10,
	fontWeight: 900,
	color: "#60a5fa",
	background:
		"rgba(59,130,246,.12)",
};

const emptyState = {
	color: "#94a3b8",
	fontSize: 13,
	py: 3,
	textAlign: "center",
};

const healthRow = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	color: "#cbd5e1",
	fontWeight: 700,
	fontSize: 13,
	py: 1,
	minWidth: 260,

	"& svg": {
		color: "#4ade80",
	},
};

const settingsDrawer = {
	width: 390,
	background:
		"linear-gradient(180deg,#020617,#0f172a)",
	color: "#fff",
	p: 3,
	borderLeft:
		"1px solid rgba(255,255,255,.08)",
};

const settingsHeader = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
};

const settingsTitle = {
	fontSize: 24,
	fontWeight: 900,
};

const settingsSub = {
	fontSize: 13,
	color: "#94a3b8",
	mt: 0.5,
};

const drawerCloseBtn = {
	color: "#fff",
	background:
		"rgba(255,255,255,.04)",
	border:
		"1px solid rgba(255,255,255,.08)",
};

const profileCard = {
	display: "flex",
	alignItems: "center",
	gap: 2,
	p: 2,
	borderRadius: "18px",
	background:
		"rgba(255,255,255,.04)",
	border:
		"1px solid rgba(255,255,255,.08)",
};

const profileAvatar = {
	width: 44,
	height: 44,
	borderRadius: "16px",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	background:
		"linear-gradient(135deg,#2563eb,#3b82f6)",
	fontWeight: 900,
};

const profileName = {
	fontWeight: 900,
	fontSize: 15,
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
};

const profileRole = {
	color: "#94a3b8",
	fontSize: 12,
	mt: 0.4,
};

const profilePlant = {
	color: "#60a5fa",
	fontSize: 11,
	mt: 0.4,
	fontWeight: 800,
};

const settingsSection = {
	mt: 3,
};

const sectionLabel = {
	color: "#94a3b8",
	textTransform: "uppercase",
	letterSpacing: "0.12em",
	fontSize: 11,
	fontWeight: 900,
	mb: 1.5,
};

const settingsAction = {
	width: "100%",
	height: 44,
	borderRadius: 14,
	border:
		"1px solid rgba(255,255,255,.08)",
	background:
		"rgba(255,255,255,.04)",
	color: "#fff",
	cursor: "pointer",
	fontWeight: 800,
	textAlign: "left",
	padding: "0 14px",
	marginBottom: 10,
	fontFamily: "inherit",
};

const settingsActionDanger = {
	...settingsAction,
	background:
		"rgba(239,68,68,.14)",
	color: "#f87171",
	border:
		"1px solid rgba(239,68,68,.22)",
};