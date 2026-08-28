import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import LogoutIcon from "@mui/icons-material/Logout";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import AppsIcon from "@mui/icons-material/Apps";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import InventoryIcon from "@mui/icons-material/Inventory";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PersonIcon from "@mui/icons-material/Person";
import HealthAndSafetyIcon from "@mui/icons-material/HealthAndSafety";
import CloseIcon from "@mui/icons-material/Close";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";

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

import { useAuth } from "../auth/AuthContext";
import { usePackFlowTheme } from "../theme/PackFlowThemeContext";

import {
	fetchVehicles,
} from "../dashboard/api/logisticsApi";

import {
	buildVehicleComplianceNotifications,
} from "../dashboard/components/logistics/vehicleComplianceUtils";

function Header() {
	const navigate = useNavigate();

	const { mode, setMode, toggleTheme } = usePackFlowTheme();

	const {
		user,
		role,
		roles = [],
		modules = [],
		hasRole,
		hasAnyRole,
		logout,
	} = useAuth();

	const isHardwareOnly =
		hasRole("HARDWARE_PACKING") &&
		!hasAnyRole(
			"ADMIN",
			"PACKING",
			"WAREHOUSE",
			"DISPATCH",
			"LOGISTICS"
		);

	const packFlowHomePath =
		isHardwareOnly
			? "/packflow/zoho-items"
			: "/packflow/dashboard";

	const canOpenBOMFlow =
		modules.includes("BOMFLOW");

	const canOpenMatFlow =
		modules.includes("MATFLOW");

	const username = user?.username || "User";

	const [appsAnchor, setAppsAnchor] =
		useState(null);

	const [notifAnchor, setNotifAnchor] =
		useState(null);

	const [healthAnchor, setHealthAnchor] =
		useState(null);

	const [settingsOpen, setSettingsOpen] =
		useState(false);

	const [notifications, setNotifications] =
		useState([]);

	const [notificationsLoading, setNotificationsLoading] =
		useState(false);

	const canViewFleetCompliance =
		hasAnyRole(
			"ADMIN",
			"LOGISTICS",
			"DISPATCH"
		);

	useEffect(() => {
		if (!canViewFleetCompliance || !user?.id) {
			setNotifications([]);
			return undefined;
		}

		/*
		 * Notification read-state belongs to the current authenticated browser
		 * session. Never carry it across a user switch on a shared workstation.
		 */
		setNotifications([]);

		let active = true;

		async function loadFleetNotifications() {
			if (
				typeof document !== "undefined" &&
				document.visibilityState === "hidden"
			) {
				return;
			}

			try {
				setNotificationsLoading(true);

				const vehicles =
					await fetchVehicles();

				if (!active) return;

				const alerts =
					buildVehicleComplianceNotifications(
						Array.isArray(vehicles)
							? vehicles
							: []
					);

				setNotifications((previous) => {
					const previousReadState =
						new Map(
							previous.map(
								(item) => [
									item.id,
									item.read,
								]
							)
						);

					return alerts.map(
						(alert) => ({
							...alert,
							read:
								previousReadState.get(
									alert.id
								) ?? false,
						})
					);
				});
			} catch (error) {
				console.error(
					"Fleet compliance notifications failed",
					error
				);
			} finally {
				if (active) {
					setNotificationsLoading(false);
				}
			}
		}

		loadFleetNotifications();

		const intervalId =
			window.setInterval(
				loadFleetNotifications,
				5 * 60 * 1000
			);

		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				loadFleetNotifications();
			}
		};

		document.addEventListener(
			"visibilitychange",
			handleVisibilityChange
		);

		return () => {
			active = false;
			window.clearInterval(
				intervalId
			);

			document.removeEventListener(
				"visibilitychange",
				handleVisibilityChange
			);
		};
	}, [canViewFleetCompliance, user?.id]);

	const moduleLinks = useMemo(
		() => [
			{
				label: "Dashboard",
				path: "/packflow/dashboard",
				icon: <DashboardIcon />,
				roles: [
					"ADMIN",
					"DISPATCH",
					"PACKING",
					"WAREHOUSE",
					"LOGISTICS",
				],
			},
			{
				label: "Inventory Items",
				path: "/packflow/zoho-items",
				icon: <InventoryIcon />,
				roles: [
					"ADMIN",
					"PACKING",
					"HARDWARE_PACKING",
				],
			},
			{
				label: "Warehouse",
				path: "/packflow/warehouse",
				icon: <WarehouseIcon />,
				roles: [
					"ADMIN",
					"WAREHOUSE",
					"DISPATCH",
				],
			},
			{
				label: "Dispatched Items",
				path: "/packflow/dispatched-items",
				icon: <LocalShippingIcon />,
				roles: [
					"ADMIN",
					"DISPATCH",
					"WAREHOUSE",
					"PACKING",
				],
			},
			{
				label: "Logistics",
				path: "/packflow/logistics",
				icon: <LocalShippingIcon />,
				roles: ["ADMIN", "LOGISTICS"],
			},
		],
		[]
	);

	const visibleModules =
		moduleLinks.filter((module) =>
			module.roles.some(
				(allowedRole) =>
					hasRole(allowedRole)
			)
		);

	const unreadCount =
		notifications.filter((n) => !n.read)
			.length;

	const criticalNotificationCount =
		notifications.filter(
			(item) =>
				item.severity === "error"
		).length;

	const warningNotificationCount =
		notifications.filter(
			(item) =>
				item.severity === "warning"
		).length;

	const healthLabel =
		criticalNotificationCount > 0
			? "● ACTION NEEDED"
			: warningNotificationCount > 0
				? "● FLEET ATTENTION"
				: "● SYSTEM HEALTHY";

	const healthSeverity =
		criticalNotificationCount > 0
			? "error"
			: warningNotificationCount > 0
				? "warning"
				: "ok";

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
			<div style={header}>
				<div style={left}>
					<div style={brandWrap}>
						<div style={brandMark}>
							A
						</div>

						<div>
							<div style={title}>
								PackFlow
							</div>

							<div style={subtitle}>
								Alsorg Operations Suite
							</div>
						</div>
					</div>
				</div>

				<div style={right}>
					<button
						style={statusBadge(healthSeverity)}
						onClick={(e) =>
							setHealthAnchor(e.currentTarget)
						}
					>
						{healthLabel}
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

					<Tooltip title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
						<IconButton
							sx={iconBtnSx}
							onClick={toggleTheme}
							aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
						>
							{mode === "dark" ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
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

			{/* APPS POPOVER */}
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
					{canOpenMatFlow && (
						<button
							style={moduleCard}
							onClick={() =>
								openModule(
									"/matflow/dashboard"
								)
							}
						>
							<span style={moduleIcon}>
								<LayersOutlinedIcon />
							</span>

							<span>
								MatFlow
							</span>
						</button>
					)}
					{hasRole("ADMIN") && (
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
					PackFlow Quick Links
				</Box>

				<Divider sx={dividerSx} />

				<Box sx={moduleGrid}>
					{visibleModules.map((item) => (
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

			{/* NOTIFICATION POPOVER */}
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
					<Box>
						<Box sx={popoverTitle}>
							Notifications
						</Box>
						<Box sx={notificationHeaderSub}>
							Fleet document compliance alerts
						</Box>
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

				<Box sx={{ width: 390, maxHeight: 460, overflowY: "auto" }}>
					{notificationsLoading &&
						notifications.length === 0 && (
							<Box sx={emptyState}>
								Checking fleet compliance...
							</Box>
						)}

					{!notificationsLoading &&
						notifications.length === 0 && (
							<Box sx={healthyNotificationState}>
								✓ No PUCC, Insurance or Fitness expiry alerts.
							</Box>
						)}

					{notifications.map((n) => (
						<Box
							key={n.id}
							sx={{
								...notificationItem,
								...(n.severity === "error"
									? notificationItemError
									: notificationItemWarning),
								opacity: n.read ? 0.56 : 1,
							}}
						>
							<Box
								sx={notificationDotBySeverity(
									n.severity
								)}
							>
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

			{/* SYSTEM HEALTH POPOVER */}
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
					<HealthAndSafetyIcon
						fontSize="small"
					/>
					API Connected
				</Box>

				<Box sx={healthRow}>
					<HealthAndSafetyIcon
						fontSize="small"
					/>
					Auth Session Active
				</Box>

				<Box sx={healthRow}>
					<HealthAndSafetyIcon
						fontSize="small"
					/>
					Secure Cookie Mode
				</Box>

				<Box sx={healthDivider} />

				<Box
					sx={fleetHealthRow(
						healthSeverity
					)}
				>
					Fleet Compliance: {criticalNotificationCount} critical • {warningNotificationCount} warning
				</Box>
			</Popover>

			{/* SETTINGS DRAWER */}
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
						{username
							.charAt(0)
							.toUpperCase()}
					</Box>

					<Box>
						<Box sx={profileName}>
							{username}
						</Box>

						<Box sx={profileRole}>
							{roles.length > 0
								? roles.join(" • ")
								: role || "User"}
						</Box>
					</Box>
				</Box>

				<Box sx={settingsSection}>
					<Box sx={sectionLabel}>
						Appearance
					</Box>

					<Box sx={themeChoiceRow}>
						<button
							type="button"
							onClick={() => setMode("dark")}
							style={themeChoiceButton(mode === "dark")}
						>
							<DarkModeOutlinedIcon fontSize="small" />
							Dark
						</button>

						<button
							type="button"
							onClick={() => setMode("light")}
							style={themeChoiceButton(mode === "light")}
						>
							<LightModeOutlinedIcon fontSize="small" />
							Light
						</button>
					</Box>

					<Box sx={themeHelpText}>
						PackFlow remembers this choice on this browser and applies it to every PackFlow page using the shared theme tokens.
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
						onClick={() =>
							navigate(packFlowHomePath)
						}
					>
						Go to PackFlow Dashboard
					</button>

					{hasRole("ADMIN") && (
						<button
							style={settingsAction}
							onClick={() =>
								navigate("/users")
							}
						>
							Manage Users
						</button>
					)}

					{canOpenBOMFlow && (
						<button
							style={settingsAction}
							onClick={() =>
								navigate("/bomflow/dashboard")
							}
						>
							Open BOMFlow
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

/* ===================== STYLES ===================== */

const header = {
	height: 66,
	padding: "0 22px",
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	background:
		"linear-gradient(180deg,var(--pf-header-start) 0%,var(--pf-header-end) 100%)",
	borderBottom:
		"1px solid rgba(var(--pf-fg-rgb),.07)",
	boxShadow:
		"0 6px 18px rgba(var(--pf-surface-deep-rgb),.08)",
	position: "sticky",
	top: 0,
	zIndex: 50,
};

const left = {
	display: "flex",
	alignItems: "center",
};

const brandWrap = {
	display: "flex",
	alignItems: "center",
	gap: 12,
};

const brandMark = {
	width: 42,
	height: 42,
	borderRadius: 12,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	fontWeight: 950,
	fontSize: 18,
	color: "#fff",
	background:
		"linear-gradient(135deg,#2563eb,#3b82f6)",
	boxShadow:
		"0 7px 18px rgba(37,99,235,.24)",
};

const title = {
	fontSize: 17,
	fontWeight: 950,
	letterSpacing: .5,
	color: "var(--pf-text-strong)",
};

const subtitle = {
	fontSize: 10.5,
	marginTop: 2,
	color: "var(--pf-text-muted)",
	letterSpacing: 0.25,
	fontWeight: 650,
};

const right = {
	display: "flex",
	alignItems: "center",
	gap: 8,
};

const statusBadge = (severity) => ({
	height: 34,
	padding: "0 13px",
	borderRadius: 999,
	display: "flex",
	alignItems: "center",
	background:
		severity === "error"
			? "rgba(239,68,68,.09)"
			: severity === "warning"
				? "rgba(245,158,11,.10)"
				: "rgba(34,197,94,.09)",
	color:
		severity === "error"
			? "#dc2626"
			: severity === "warning"
				? "#b45309"
				: "#15803d",
	border:
		severity === "error"
			? "1px solid rgba(239,68,68,.22)"
			: severity === "warning"
				? "1px solid rgba(245,158,11,.22)"
				: "1px solid rgba(34,197,94,.20)",
	fontWeight: 900,
	fontSize: 10.5,
	letterSpacing: .7,
	cursor: "pointer",
});

const iconBtnSx = {
	width: 38,
	height: 38,
	borderRadius: "10px",
	color: "var(--pf-text)",
	background: "var(--pf-surface-alt)",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.07)",
	transition:
		"background .16s ease,border-color .16s ease,color .16s ease,transform .16s ease",
	"&:hover": {
		color: "#2563eb",
		background: "rgba(59,130,246,.08)",
		borderColor: "rgba(59,130,246,.24)",
		transform: "translateY(-1px)",
	},
};

const logoutButton = {
	height: 38,
	px: 1.8,
	borderRadius: "10px",
	textTransform: "none",
	fontWeight: 850,
	fontSize: 12,
	background:
		"linear-gradient(135deg,#2563eb,#3b82f6)",
	color: "#fff",
	boxShadow:
		"0 7px 18px rgba(37,99,235,.22)",
	"&:hover": {
		background:
			"linear-gradient(135deg,#1d4ed8,#2563eb)",
	},
};

const popoverPaper = {
	mt: 1,
	borderRadius: "14px",
	background: "var(--pf-surface)",
	color: "var(--pf-text-strong)",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.08)",
	boxShadow:
		"0 20px 54px rgba(var(--pf-surface-deep-rgb),.24)",
	p: 1.5,
};

const popoverTitle = {
	fontSize: 16,
	fontWeight: 900,
	color: "var(--pf-text-strong)",
};

const popoverHeader = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	width: 360,
};

const dividerSx = {
	borderColor:
		"rgba(var(--pf-fg-rgb),.08)",
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
	minHeight: 68,
	borderRadius: 11,
	border:
		"1px solid rgba(var(--pf-fg-rgb),.07)",
	background: "var(--pf-surface-alt)",
	color: "var(--pf-text-strong)",
	cursor: "pointer",
	display: "flex",
	flexDirection: "column",
	alignItems: "flex-start",
	justifyContent: "center",
	gap: 7,
	padding: "10px 12px",
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
	p: 1.25,
	borderRadius: "11px",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.06)",
	background: "var(--pf-surface-alt)",
	mb: 1,
};

const notificationDotBySeverity = (severity) => ({
	color:
		severity === "error"
			? "#f87171"
			: "#fbbf24",
	fontSize: 12,
	pt: 0.3,
});

const notificationItemError = {
	background: "rgba(239,68,68,.065)",
	border: "1px solid rgba(239,68,68,.14)",
};

const notificationItemWarning = {
	background: "rgba(245,158,11,.055)",
	border: "1px solid rgba(245,158,11,.13)",
};

const notificationHeaderSub = {
	mt: 0.35,
	color: "var(--pf-text-dim)",
	fontSize: 10,
	fontWeight: 750,
};

const notificationTitle = {
	fontSize: 13,
	fontWeight: 900,
	color: "var(--pf-text-strong)",
};

const notificationMsg = {
	fontSize: 12,
	color: "var(--pf-text-muted)",
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
	color: "var(--pf-text-muted)",
	fontSize: 13,
	py: 3,
	textAlign: "center",
};

const healthRow = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	color: "var(--pf-text)",
	fontWeight: 700,
	fontSize: 13,
	py: 1,
	minWidth: 260,

	"& svg": {
		color: "#4ade80",
	},
};

const healthyNotificationState = {
	color: "#15803d",
	fontSize: 12,
	py: 2.5,
	px: 2,
	textAlign: "center",
	fontWeight: 800,
	background: "rgba(34,197,94,.06)",
	borderRadius: "11px",
	border: "1px solid rgba(34,197,94,.14)",
};

const healthDivider = {
	height: "1px",
	background: "rgba(var(--pf-fg-rgb),.08)",
	my: 1,
};

const fleetHealthRow = (severity) => ({
	minWidth: 260,
	py: 1,
	color:
		severity === "error"
			? "#f87171"
			: severity === "warning"
				? "#fbbf24"
				: "#4ade80",
	fontSize: 12,
	fontWeight: 850,
});

const settingsDrawer = {
	width: 370,
	background: "var(--pf-surface)",
	color: "var(--pf-text-strong)",
	p: 2.5,
	borderLeft:
		"1px solid rgba(var(--pf-fg-rgb),.08)",
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
	color: "var(--pf-text-muted)",
	mt: 0.5,
};

const drawerCloseBtn = {
	color: "var(--pf-text-strong)",
	background:
		"rgba(var(--pf-fg-rgb),.04)",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.08)",
};

const profileCard = {
	display: "flex",
	alignItems: "center",
	gap: 2,
	p: 1.6,
	borderRadius: "12px",
	background: "var(--pf-surface-alt)",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.07)",
};

const profileAvatar = {
	width: 42,
	height: 42,
	borderRadius: "12px",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	background:
		"linear-gradient(135deg,#2563eb,#3b82f6)",
	color: "#fff",
	fontWeight: 900,
};

const profileName = {
	fontWeight: 900,
	fontSize: 15,
};

const profileRole = {
	color: "var(--pf-text-muted)",
	fontSize: 12,
	mt: 0.4,
};

const settingsSection = {
	mt: 3,
};

const sectionLabel = {
	color: "var(--pf-text-muted)",
	textTransform: "uppercase",
	letterSpacing: "0.12em",
	fontSize: 11,
	fontWeight: 900,
	mb: 1.5,
};

const settingsAction = {
	width: "100%",
	height: 42,
	borderRadius: 10,
	border:
		"1px solid rgba(var(--pf-fg-rgb),.08)",
	background: "var(--pf-surface-alt)",
	color: "var(--pf-text-strong)",
	cursor: "pointer",
	fontWeight: 800,
	textAlign: "left",
	padding: "0 13px",
	marginBottom: 9,
};

const settingsActionDanger = {
	...settingsAction,
	background:
		"rgba(239,68,68,.14)",
	color: "#f87171",
	border:
		"1px solid rgba(239,68,68,.22)",
};

export default Header;

const themeChoiceRow = {
	display: "grid",
	gridTemplateColumns: "1fr 1fr",
	gap: 1,
	mt: 1,
};

const themeChoiceButton = (active) => ({
	height: 42,
	borderRadius: 10,
	border: active
		? "1px solid rgba(59,130,246,.34)"
		: "1px solid rgba(var(--pf-fg-rgb),.08)",
	background: active
		? "rgba(59,130,246,.12)"
		: "var(--pf-surface-alt)",
	color: active ? "#1d4ed8" : "var(--pf-text)",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	gap: 8,
	fontFamily: "inherit",
	fontSize: 12,
	fontWeight: 900,
	cursor: "pointer",
});

const themeHelpText = {
	mt: 1,
	color: "var(--pf-text-dim)",
	fontSize: 10.5,
	fontWeight: 700,
	lineHeight: 1.5,
};
