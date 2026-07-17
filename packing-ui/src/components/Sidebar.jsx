import { Link, useLocation } from "react-router-dom";
import { useState } from "react";

import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import WarehouseOutlinedIcon from "@mui/icons-material/WarehouseOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import AppsOutlinedIcon from "@mui/icons-material/AppsOutlined";

import { useAuth } from "../auth/AuthContext";

function Sidebar() {
	const location = useLocation();
	const [collapsed, setCollapsed] = useState(false);

	const {
		role,
		warehouseAccess,
	} = useAuth();

	const cleanRole = String(role || "")
		.replace(/^ROLE_/i, "")
		.trim()
		.toUpperCase();

	const hasWarehousePageAccess =
		warehouseAccess === true ||
		String(warehouseAccess || "")
			.trim()
			.toLowerCase() === "true";

	const canOpenWarehouse =
		cleanRole === "ADMIN" ||
		cleanRole === "DISPATCH" ||
		cleanRole === "WAREHOUSE" ||
		hasWarehousePageAccess; const links = [
			{
				path: "/packflow/dashboard",
				label: "Dashboard",
				roles: [
					"ADMIN",
					"DISPATCH",
					"PACKING",
					"WAREHOUSE",
					"LOGISTICS",
				],
				icon: (
					<DashboardOutlinedIcon
						fontSize="small"
					/>
				),
			},

			{
				path: "/packflow/zoho-items",
				label:
					cleanRole === "HARDWARE_PACKING"
						? "Hardware Inventory"
						: "Inventory Items",
				roles: [
					"ADMIN",
					"PACKING",
					"HARDWARE_PACKING",
				],
				icon: (
					<Inventory2OutlinedIcon
						fontSize="small"
					/>
				),
			},

			{
				path: "/packflow/warehouse",
				label: "Warehouse",
				roles: [],
				customAccess: canOpenWarehouse,
				icon: (
					<WarehouseOutlinedIcon
						fontSize="small"
					/>
				),
			},

			{
				path: "/packflow/dispatched-items",
				label: "Dispatched Items",
				roles: [
					"ADMIN",
					"DISPATCH",
					"WAREHOUSE",
					"PACKING",
				],
				icon: (
					<LocalShippingOutlinedIcon
						fontSize="small"
					/>
				),
			},

			{
				path: "/packflow/logistics",
				label: "Logistics",
				roles: [
					"ADMIN",
					"LOGISTICS",
				],
				icon: (
					<AltRouteOutlinedIcon
						fontSize="small"
					/>
				),
			},
		];

	const links = [
		{
			path: "/packflow/dashboard",
			label: "Dashboard",
			roles: [
				"ADMIN",
				"DISPATCH",
				"PACKING",
				"WAREHOUSE",
				"LOGISTICS",
			],
			icon: (
				<DashboardOutlinedIcon
					fontSize="small"
				/>
			),
		},

		{
			path: "/packflow/zoho-items",
			label:
				cleanRole === "HARDWARE_PACKING"
					? "Hardware Inventory"
					: "Inventory Items",
			roles: [
				"ADMIN",
				"PACKING",
				"HARDWARE_PACKING",
			],
			icon: (
				<Inventory2OutlinedIcon
					fontSize="small"
				/>
			),
		},

		{
			path: "/packflow/warehouse",
			label: "Warehouse",
			roles: [],
			customAccess: canOpenWarehouse,
			icon: (
				<WarehouseOutlinedIcon
					fontSize="small"
				/>
			),
		},

		{
			path: "/packflow/dispatched-items",
			label: "Dispatched Items",
			roles: [
				"ADMIN",
				"DISPATCH",
				"WAREHOUSE",
				"PACKING",
			],
			icon: (
				<LocalShippingOutlinedIcon
					fontSize="small"
				/>
			),
		},

		{
			path: "/packflow/logistics",
			label: "Logistics",
			roles: [
				"ADMIN",
				"LOGISTICS",
			],
			icon: (
				<AltRouteOutlinedIcon
					fontSize="small"
				/>
			),
		},
	];

	const visibleLinks =
		links.filter((link) => {
			if (
				typeof link.customAccess ===
				"boolean"
			) {
				return link.customAccess;
			}

			return link.roles.includes(
				cleanRole
			);
		});

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
			style={{
				...sidebar,
				width: collapsed ? 64 : 210,
			}}
		>
			<div style={topHighlight} />

			<div style={logoSection}>
				<div style={logoIcon}>
					A
				</div>

				{!collapsed && (
					<div>
						<div style={logoTitle}>
							ALSORG
						</div>

						<div style={logoSub}>
							PackFlow
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
				<span style={icon}>
					<AppsOutlinedIcon fontSize="small" />
				</span>

				{!collapsed && "All Modules"}
			</Link>

			<div style={smallDivider} />

			{visibleLinks.map((link) => {
				const active =
					location.pathname === link.path ||
					location.pathname.startsWith(`${link.path}/`);

				return (
					<Link
						key={link.path}
						to={link.path}
						style={linkStyle(active)}
					>
						<span style={icon}>
							{link.icon}
						</span>

						{!collapsed && link.label}
					</Link>
				);
			})}

			<div style={{ flexGrow: 1 }} />

			<div style={divider} />
		</div>
	);
}

/* ===================== STYLES ===================== */

const sidebar = {
	width: 220,
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

const toggleRow = {
	display: "flex",
	alignItems: "center",
	marginBottom: 18,
	minHeight: 28,
};

const icon = {
	width: 20,
	minWidth: 20,
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	opacity: 0.95,
	color: "inherit",
};

const divider = {
	height: 1,
	background:
		"linear-gradient(90deg, rgba(255,255,255,0.14), transparent)",
	marginTop: 24,
};

const smallDivider = {
	height: 1,
	background:
		"linear-gradient(90deg, rgba(255,255,255,0.10), transparent)",
	margin: "10px 0 12px",
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

export default Sidebar;