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
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import PriceChangeOutlinedIcon from "@mui/icons-material/PriceChangeOutlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
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

import { useAuth } from "../../auth/AuthContext";

const navItems = [
	{
		label: "Dashboard",
		path: "/bomflow/dashboard",
		icon: <DashboardOutlinedIcon fontSize="small" />,
	},
	{
		label: "Product Master",
		path: "/bomflow/products",
		icon: <Inventory2OutlinedIcon fontSize="small" />,
	},
	{
		label: "BOM Builder",
		path: "/bomflow/bom-builder",
		icon: <RuleOutlinedIcon fontSize="small" />,
	},
	{
		label: "Rate Master",
		path: "/bomflow/rate-master",
		icon: <PriceChangeOutlinedIcon fontSize="small" />,
	},
	{
		label: "Labour Master",
		path: "/bomflow/labour-master",
		icon: <EngineeringOutlinedIcon fontSize="small" />,
	},
	{
		label: "Costing Engine",
		path: "/bomflow/costing",
		icon: <CalculateOutlinedIcon fontSize="small" />,
	},
	{
		label: "Reports",
		path: "/bomflow/reports",
		icon: <AssessmentOutlinedIcon fontSize="small" />,
	},
];

export default function BOMFlowLayout() {
	return (
		<div style={shell} className="bomflow-shell">
			<BOMFlowSidebar />

			<div style={main} className="bomflow-main">
				<BOMFlowHeader />

				<div style={contentShell} className="bomflow-content-shell">
					<div style={contentInner}>
						<Outlet />
					</div>
				</div>
			</div>
		</div>
	);
}

function BOMFlowSidebar() {
	const location = useLocation();
	const navigate = useNavigate();
	const [collapsed, setCollapsed] = useState(false);

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
		color: active
			? "#fff"
			: "rgba(255,255,255,.72)",
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
		justifyContent: collapsed
			? "center"
			: "flex-start",
	});

	return (
		<div
			className="bomflow-sidebar"
			style={{
				...sidebar,
				width: collapsed ? 64 : 230,
			}}
		>
			<div style={topHighlight} />

			<div style={logoSection}>
				<div style={logoIcon}>
					B
				</div>

				{!collapsed && (
					<div>
						<div style={logoTitle}>
							ALSORG
						</div>

						<div style={logoSub}>
							BOMFlow
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
					onClick={() =>
						setCollapsed((v) => !v)
					}
					style={toggleButton}
					title={
						collapsed
							? "Expand sidebar"
							: "Collapse sidebar"
					}
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
					location.pathname.startsWith(`${link.path}/`) ||
					(
						link.path === "/bomflow/bom-builder" &&
						location.pathname.startsWith(
							"/bomflow/revisions/"
						)
					);

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

			{!collapsed && (
				<button
					type="button"
					onClick={() => navigate("/bomflow/products/new")}
					style={newCostingBtn}
				>
					<AddIcon fontSize="small" />
					New Costing
				</button>
			)}

			<div style={divider} />
		</div>
	);
}

function BOMFlowHeader() {
	const navigate = useNavigate();

	const {
		user,
		role,
		modules,
		logout,
	} = useAuth();

	const username = user?.username || "User";

	const moduleList = Array.isArray(modules)
		? modules
		: [];

	const canOpenPackFlow =
		moduleList.includes("PACKFLOW") ||
		role === "ADMIN";

	const canOpenBOMFlow =
		moduleList.includes("BOMFLOW") ||
		role === "ADMIN";

	const [appsAnchor, setAppsAnchor] = useState(null);
	const [notifAnchor, setNotifAnchor] = useState(null);
	const [healthAnchor, setHealthAnchor] = useState(null);
	const [settingsOpen, setSettingsOpen] = useState(false);

	const [notifications, setNotifications] =
		useState([
			{
				id: 1,
				title: "BOM review pending",
				message:
					"Some product costings may need reviewer action.",
				type: "BOMFLOW",
				read: false,
			},
			{
				id: 2,
				title: "Rate master check",
				message:
					"Material rates should be verified before final approval.",
				type: "RATES",
				read: false,
			},
		]);

	const quickLinks = useMemo(
		() => [
			{
				label: "Product Master",
				path: "/bomflow/products",
				icon: <Inventory2OutlinedIcon />,
			},
			{
				label: "BOM Builder",
				path: "/bomflow/bom-builder",
				icon: <RuleOutlinedIcon />,
			},
			{
				label: "Rate Master",
				path: "/bomflow/rate-master",
				icon: <PriceChangeOutlinedIcon />,
			},
			{
				label: "Labour Master",
				path: "/bomflow/labour-master",
				icon: <EngineeringOutlinedIcon />,
			},
			{
				label: "Costing Engine",
				path: "/bomflow/costing",
				icon: <CalculateOutlinedIcon />,
			},
			{
				label: "Reports",
				path: "/bomflow/reports",
				icon: <AssessmentOutlinedIcon />,
			},
		],
		[]
	);

	const unreadCount =
		notifications.filter((n) => !n.read).length;

	const handleLogout = async () => {
		await logout();
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
			<div style={header} className="bomflow-main-header">
				<div style={headerLeft}>
					<div style={brandWrap}>
						<div style={brandMark}>
							B
						</div>

						<div>
							<div style={title}>
								BOMFlow
							</div>

							<div style={subtitle}>
								Alsorg Operations Suite
							</div>
						</div>
					</div>
				</div>

				<div style={headerRight}>
					<button
						style={statusBadge}
						onClick={(e) =>
							setHealthAnchor(e.currentTarget)
						}
					>
						● SYSTEM HEALTHY
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
				onClose={() =>
					setAppsAnchor(null)
				}
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
						style={moduleCard}
						onClick={() =>
							openModule("/modules")
						}
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

					{role === "ADMIN" && (
						<button
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
					BOMFlow Quick Links
				</Box>

				<Divider sx={dividerSx} />

				<Box sx={moduleGrid}>
					{quickLinks.map((item) => (
						<button
							key={item.path}
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
				onClose={() =>
					setNotifAnchor(null)
				}
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
				onClose={() =>
					setHealthAnchor(null)
				}
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
					BOMFlow Module Ready
				</Box>
			</Popover>

			<Drawer
				anchor="right"
				open={settingsOpen}
				onClose={() =>
					setSettingsOpen(false)
				}
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
						onClick={() =>
							setSettingsOpen(false)
						}
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
						<Box sx={profileName}>
							{username}
						</Box>

						<Box sx={profileRole}>
							{role === "GUEST" ? "Guest User" : role}
						</Box>
					</Box>
				</Box>

				<Box sx={settingsSection}>
					<Box sx={sectionLabel}>
						Quick Actions
					</Box>

					<button
						style={settingsAction}
						onClick={() => navigate("/modules")}
					>
						All Modules
					</button>

					<button
						style={settingsAction}
						onClick={() => navigate("/bomflow/dashboard")}
					>
						BOMFlow Dashboard
					</button>

					<button
						style={settingsAction}
						onClick={() => navigate("/bomflow/products/new")}
					>
						Create New Costing
					</button>

					{canOpenPackFlow && (
						<button
							style={settingsAction}
							onClick={() => navigate("/packflow/dashboard")}
						>
							Open PackFlow
						</button>
					)}

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
		radial-gradient(
			circle at top left,
			rgba(59,130,246,0.10),
			transparent 20%
		),

		radial-gradient(
			circle at bottom right,
			rgba(14,165,233,0.08),
			transparent 20%
		)
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

const newCostingBtn = {
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
};

const settingsActionDanger = {
	...settingsAction,
	background:
		"rgba(239,68,68,.14)",
	color: "#f87171",
	border:
		"1px solid rgba(239,68,68,.22)",
};