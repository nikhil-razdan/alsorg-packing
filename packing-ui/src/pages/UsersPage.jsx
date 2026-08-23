import {
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";

import {
	Alert,
	Box,
	Button,
	Checkbox,
	Chip,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Divider,
	Drawer,
	InputAdornment,
	ListItemText,
	MenuItem,
	Snackbar,
	Switch,
	TextField,
	Tooltip,
	Typography,
} from "@mui/material";

import { useNavigate } from "react-router-dom";

import AppsIcon from "@mui/icons-material/Apps";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LogoutIcon from "@mui/icons-material/Logout";
import SearchIcon from "@mui/icons-material/Search";
import LockResetIcon from "@mui/icons-material/LockReset";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import InventoryIcon from "@mui/icons-material/Inventory";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import PrecisionManufacturingOutlinedIcon from "@mui/icons-material/PrecisionManufacturingOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import SupervisorAccountOutlinedIcon from "@mui/icons-material/SupervisorAccountOutlined";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import WarehouseOutlinedIcon from "@mui/icons-material/WarehouseOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import DateRangeOutlinedIcon from "@mui/icons-material/DateRangeOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";

import { useAuth } from "../auth/AuthContext";
import API from "../services/api";
import { PackFlowThemeBoundary } from "../theme/PackFlowThemeContext";

/* =========================================================
 * ACCESS CONFIGURATION
 * ========================================================= */

const MODULE_KEYS = Object.freeze({
	PACKFLOW: "PACKFLOW",
	BOMFLOW: "BOMFLOW",
	MATFLOW: "MATFLOW",
	MACHFLOW: "MACHFLOW",
});

const ACCESS_GROUPS = [
	{
		key: "ADMIN",
		label: "Platform Administrator",
		shortLabel: "Administrator",
		description:
			"Full access to PackFlow, BOMFlow, MatFlow, MachFlow and user administration.",
		accent: "#f59e0b",
		icon: <AdminPanelSettingsIcon />,
		defaultRole: "ADMIN",
		roles: [
			{
				value: "ADMIN",
				label: "Administrator",
				description:
					"Complete FlowSuite access across all plants and modules.",
			},
		],
	},
	{
		key: MODULE_KEYS.PACKFLOW,
		label: "PackFlow",
		shortLabel: "PackFlow",
		description:
			"Packing, hardware packets, warehouse, dispatch and logistics operations.",
		accent: "#3b82f6",
		icon: <InventoryIcon />,
		defaultRole: "PACKING",
		roles: [
			{
				value: "PACKING",
				label: "Packing",
				description:
					"Create and manage normal packing records and stickers.",
			},
			{
				value: "HARDWARE_PACKING",
				label: "Hardware Packing",
				description:
					"Manage isolated hardware packets and hardware stickers.",
			},
			{
				value: "WAREHOUSE",
				label: "Warehouse",
				description:
					"Manage warehouse stock movement and warehouse approvals.",
			},
			{
				value: "DISPATCH",
				label: "Dispatch",
				description:
					"Manage dispatch preparation, challans and trip operations.",
			},
			{
				value: "LOGISTICS",
				label: "Logistics",
				description:
					"Manage logistics, vehicles, drivers and trip coordination.",
			},
			{
				value: "DRIVER",
				label: "Driver",
				description:
					"Mobile driver access linked to one driver profile.",
			},
		],
	},
	{
		key: MODULE_KEYS.BOMFLOW,
		label: "BOMFlow",
		shortLabel: "BOMFlow",
		description:
			"Product costing, costing BOM revisions, rates and commercial approvals.",
		accent: "#8b5cf6",
		icon: <AccountTreeOutlinedIcon />,
		defaultRole: "BOMFLOW_EDITOR",
		roles: [
			{
				value: "BOMFLOW_EDITOR",
				label: "BOM Editor",
				description:
					"Create products and prepare costing BOM revisions.",
			},
			{
				value: "BOMFLOW_REVIEWER",
				label: "BOM Reviewer",
				description:
					"Review and verify submitted costing BOM revisions.",
			},
			{
				value: "BOMFLOW_APPROVER",
				label: "BOM Approver",
				description:
					"Approve verified costing BOM revisions.",
			},
			{
				value: "BOMFLOW_MANAGER",
				label: "BOMFlow Manager",
				description:
					"Manage BOMFlow workflow, costing records and reports.",
			},
		],
	},
	{
		key: MODULE_KEYS.MATFLOW,
		label: "MatFlow",
		shortLabel: "MatFlow",
		description:
			"Operational BOM, stock reservation, purchase, QC, issue and consumption.",
		accent: "#14b8a6",
		icon: <LayersOutlinedIcon />,
		defaultRole: "MATFLOW_ENGINEERING",
		roles: [
			{
				value: "MATFLOW_MANAGER",
				label: "MatFlow Manager",
				description:
					"Monitor and manage the complete material workflow.",
			},
			{
				value: "MATFLOW_ENGINEERING",
				label: "Engineering",
				description:
					"Create, revise and submit operational material BOMs.",
			},
			{
				value: "MATFLOW_STORE",
				label: "Stores",
				description:
					"Forward remote-plant MRs, control AL-P1 Main Store stock, and receive/hand off routed material.",
			},
			{
				value: "MATFLOW_PURCHASE",
				label: "Purchase",
				description:
					"Process Main Store shortage indents and purchase tracking across all plants.",
			},
			{
				value: "MATFLOW_PROCESSING",
				label: "Material Processing",
				description:
					"Receive, process and dispatch material through internal or external processing units.",
			},
			{
				value: "MATFLOW_PRODUCTION",
				label: "Production",
				description:
					"Raise requisitions, record consumption and complete production.",
			},
			{
				value: "MATFLOW_QC",
				label: "Quality Control",
				description:
					"Complete MR-linked QC checks at AL-P1 Main Store; QC has no routing authority.",
			},
			{
				value: "MATFLOW_DIRECTOR",
				label: "Director",
				description:
					"Approve controlled MatFlow decisions and review reports.",
			},
		],
	},
	{
		key: MODULE_KEYS.MACHFLOW,
		label: "MachFlow",
		shortLabel: "MachFlow",
		description:
			"Strictly separated Machine Maintenance and IT Support operations with director oversight, QR assets and controlled Reporter Pass intake.",
		accent: "#0ea5e9",
		icon: <EngineeringOutlinedIcon />,
		defaultRole: "MACHFLOW_MACHINE_TECHNICIAN",
		roles: [
			{
				value: "MACHFLOW_DIRECTOR",
				label: "Director · Maintenance Oversight",
				description:
					"Read-only overall dashboard and reports across Machine Maintenance and IT Support without operational editing rights.",
			},
			{
				value: "MACHFLOW_MACHINE_HEAD",
				label: "Machine Maintenance Head",
				description:
					"Own Machine Maintenance across authorised plants: machine master, teams, preventive plans, work orders and machine-maintenance reporting.",
			},
			{
				value: "MACHFLOW_MACHINE_TECHNICIAN",
				label: "Machine Maintenance Technician",
				description:
					"Execute only Machine Maintenance jobs assigned within authorised plants. IT assets and IT requests remain hidden.",
			},
			{
				value: "MACHFLOW_IT_HEAD",
				label: "IT Head",
				description:
					"Own IT Support: IT Asset Master, IT support teams, IT work orders, preventive tasks and IT-only reporting.",
			},
			{
				value: "MACHFLOW_IT_TECHNICIAN",
				label: "IT Technician",
				description:
					"Execute assigned IT support work only. Machine Maintenance master, work orders and reports remain hidden.",
			},
			{
				value: "MACHFLOW_REQUESTER",
				label: "Legacy / Dedicated Requester",
				description:
					"Optional request-only FlowSuite identity. Prefer linking ordinary employees to a Reporter Pass instead of creating a full FlowSuite account.",
			},
		],
	}
];

const ROLE_META = ACCESS_GROUPS.reduce(
	(result, group) => {
		group.roles.forEach((role) => {
			result[role.value] = {
				...role,
				groupKey: group.key,
				moduleKey:
					group.key === "ADMIN"
						? null
						: group.key,
				groupLabel: group.label,
				accent: group.accent,
			};
		});

		return result;
	},
	{}
);

const DEFAULT_FORM = {
	username: "",
	password: "",
	role: "PACKING",
	roles: ["PACKING"],
	plantCodes: [],
	driverId: "",
	warehouseAccess: false,
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const PERFORMANCE_PERIOD_OPTIONS = [
	{ value: "TODAY", label: "Today" },
	{ value: "7D", label: "Last 7 Days" },
	{ value: "30D", label: "Last 30 Days" },
	{ value: "ALL", label: "All Available" },
];

const USER_SORT_OPTIONS = [
	["USERNAME", "Username"],
	["ACTIVITY", "Activity Index"],
	["OUTPUT", "Pack + Dispatch Output"],
	["RECORDS", "Tracked Records"],
	["STICKERS", "Sticker Generations"],
	["DISPATCH_ITEMS", "Dispatch Items"],
	["LAST_ACTIVITY", "Last Activity"],
	["ACCESS_REVIEW", "Access Review First"],
];

/* =========================================================
 * HELPERS
 * ========================================================= */

const normalizeRole = (value) => {
	return String(value || "")
		.replace("ROLE_", "")
		.trim()
		.toUpperCase();
};

const normalizeArray = (value) => {
	if (Array.isArray(value)) {
		return Array.from(
			new Set(
				value
					.map((item) =>
						String(item || "")
							.trim()
							.toUpperCase()
					)
					.filter(Boolean)
			)
		);
	}

	if (!value) {
		return [];
	}

	return Array.from(
		new Set(
			String(value)
				.split(",")
				.map((item) =>
					item
						.trim()
						.toUpperCase()
				)
				.filter(Boolean)
		)
	);
};

const userRoles = (user) => {
	const explicitRoles =
		normalizeArray(user?.roles)
			.filter((role) => ROLE_META[role]);

	if (explicitRoles.length > 0) {
		return explicitRoles;
	}

	const legacyRole =
		normalizeRole(user?.role);

	return legacyRole
		? [legacyRole]
		: [];
};

const hasAssignedRole = (
	roles,
	requestedRole
) => {
	const cleanRequestedRole =
		normalizeRole(requestedRole);

	return normalizeArray(roles)
		.includes(cleanRequestedRole);
};

const primaryRoleFor = (
	roles,
	preferredRole = ""
) => {
	const cleanRoles =
		normalizeArray(roles)
			.filter((role) => ROLE_META[role]);

	const cleanPreferred =
		normalizeRole(preferredRole);

	if (
		cleanPreferred &&
		cleanRoles.includes(cleanPreferred)
	) {
		return cleanPreferred;
	}

	return cleanRoles[0] || "PACKING";
};

const modulesForRoles = (roles) => {
	const cleanRoles =
		normalizeArray(roles);

	if (cleanRoles.includes("ADMIN")) {
		return [
			MODULE_KEYS.PACKFLOW,
			MODULE_KEYS.BOMFLOW,
			MODULE_KEYS.MATFLOW,
			MODULE_KEYS.MACHFLOW,
		];
	}

	return Array.from(
		new Set(
			cleanRoles
				.filter((role) => role !== "MACHFLOW_REQUESTER")
				.map((role) => roleMeta(role).moduleKey)
				.filter(Boolean)
		)
	);
};

const isAllowedRoleCombination = (roles) => {
	const cleanRoles = normalizeArray(roles);

	if (cleanRoles.length <= 1) return true;
	if (cleanRoles.includes("ADMIN")) return false;

	const packRoles = cleanRoles.filter((role) => roleMeta(role).groupKey === MODULE_KEYS.PACKFLOW);
	const machRoles = cleanRoles.filter((role) => roleMeta(role).groupKey === MODULE_KEYS.MACHFLOW);
	const bomRoles = cleanRoles.filter((role) => roleMeta(role).groupKey === MODULE_KEYS.BOMFLOW);
	const matRoles = cleanRoles.filter((role) => roleMeta(role).groupKey === MODULE_KEYS.MATFLOW);

	if (machRoles.length === 0) {
		return packRoles.length === cleanRoles.length;
	}

	if (machRoles.length !== 1 || bomRoles.length > 1 || matRoles.length > 1) return false;
	if (bomRoles.length && matRoles.length) return false;

	return packRoles.length + machRoles.length + bomRoles.length + matRoles.length === cleanRoles.length;
};

const rolesRequireDriver = (roles) => {
	return hasAssignedRole(
		roles,
		"DRIVER"
	);
};

const rolesRequirePlantAccess = (roles) => {
	const cleanRoles =
		normalizeArray(roles);

	if (cleanRoles.includes("ADMIN")) {
		return false;
	}

	return cleanRoles.some((role) => {
		if (role === "DRIVER") {
			return false;
		}

		if (
			role.startsWith("BOMFLOW_")
		) {
			return false;
		}

		return true;
	});
};

const rolesSupportWarehouseToggle = (roles) => {
	const cleanRoles =
		normalizeArray(roles);

	if (
		cleanRoles.includes("ADMIN") ||
		cleanRoles.includes("WAREHOUSE") ||
		cleanRoles.includes("DISPATCH")
	) {
		return false;
	}

	return (
		cleanRoles.includes("PACKING") ||
		cleanRoles.includes("LOGISTICS")
	);
};

const resolveWarehouseAccessForRoles = (
	roles,
	requestedValue
) => {
	const cleanRoles =
		normalizeArray(roles);

	if (
		cleanRoles.includes("ADMIN") ||
		cleanRoles.includes("WAREHOUSE") ||
		cleanRoles.includes("DISPATCH")
	) {
		return true;
	}

	if (
		!cleanRoles.includes("PACKING") &&
		!cleanRoles.includes("LOGISTICS")
	) {
		return false;
	}

	return requestedValue === true;
};

const readWarehouseAccess = (user) => {
	const roles =
		userRoles(user);

	return (
		hasAssignedRole(roles, "ADMIN") ||
		hasAssignedRole(roles, "WAREHOUSE") ||
		hasAssignedRole(roles, "DISPATCH") ||
		user?.warehouseAccess === true
	);
};

const readError = (
	error,
	fallback = "The operation could not be completed."
) => {
	const data = error?.response?.data;

	if (typeof data === "string") {
		return data;
	}

	return (
		data?.message ||
		data?.error ||
		error?.message ||
		fallback
	);
};

const roleMeta = (role) => {
	const cleanRole =
		normalizeRole(role);

	return (
		ROLE_META[cleanRole] || {
			value: cleanRole,
			label:
				cleanRole || "Unknown Role",
			description:
				"Unknown or legacy role assignment.",
			groupKey: "UNKNOWN",
			moduleKey: null,
			groupLabel: "Unknown",
			accent: "#64748b",
		}
	);
};

const accessGroupForRole = (role) => {
	const meta =
		roleMeta(role);

	return ACCESS_GROUPS.find(
		(group) =>
			group.key === meta.groupKey
	);
};

const modulesForRole = (role) => {
	const cleanRole =
		normalizeRole(role);

	if (cleanRole === "ADMIN") {
		return [
			MODULE_KEYS.PACKFLOW,
			MODULE_KEYS.BOMFLOW,
			MODULE_KEYS.MATFLOW,
			MODULE_KEYS.MACHFLOW,
		];
	}

	const moduleKey =
		roleMeta(cleanRole).moduleKey;

	return moduleKey
		? [moduleKey]
		: [];
};

const roleRequiresPlantAccess = (role) => {
	const cleanRole =
		normalizeRole(role);

	if (
		cleanRole === "ADMIN" ||
		cleanRole === "DRIVER"
	) {
		return false;
	}

	if (
		cleanRole.startsWith(
			"BOMFLOW_"
		)
	) {
		return false;
	}

	return true;
};

const roleRequiresDriver = (role) => {
	return (
		normalizeRole(role) ===
		"DRIVER"
	);
};

const roleSupportsWarehouseToggle = (role) => {
	const cleanRole =
		normalizeRole(role);

	return [
		"PACKING",
		"DISPATCH",
		"LOGISTICS",
	].includes(cleanRole);
};

const resolveWarehouseAccess = (
	role,
	requestedValue
) => {
	const cleanRole =
		normalizeRole(role);

	if (
		cleanRole === "ADMIN" ||
		cleanRole === "WAREHOUSE"
	) {
		return true;
	}

	if (
		cleanRole === "DRIVER" ||
		cleanRole ===
		"HARDWARE_PACKING" ||
		!roleSupportsWarehouseToggle(
			cleanRole
		)
	) {
		return false;
	}

	return requestedValue === true;
};

const userPlantCodes = (user) => {
	if (
		Array.isArray(user?.plantCodes) &&
		user.plantCodes.length > 0
	) {
		return normalizeArray(
			user.plantCodes
		);
	}

	return normalizeArray(
		user?.plantCode
	);
};

const userModules = (user) => {
	if (
		Array.isArray(user?.modules) &&
		user.modules.length > 0
	) {
		return normalizeArray(
			user.modules
		);
	}

	return modulesForRoles(
		userRoles(user)
	);
};

const normalizeUsernameKey = (value) => {
	return String(value || "")
		.trim()
		.toLowerCase();
};

const performanceActor = (row) => {
	return (
		row?.username ||
		row?.performedBy ||
		row?.actor ||
		row?.user ||
		row?.generatedBy ||
		row?.createdBy ||
		""
	);
};

const performanceAction = (row) => {
	return String(
		row?.action ||
		row?.event ||
		row?.eventType ||
		row?.message ||
		row?.activity ||
		"Activity"
	).trim();
};

const performanceTimestamp = (row) => {
	return (
		row?.performedAt ||
		row?.activityAt ||
		row?.packedAt ||
		row?.dispatchedAt ||
		row?.generatedAt ||
		row?.movedAt ||
		row?.createdAt ||
		row?.updatedAt ||
		row?.timestamp ||
		null
	);
};

const parseSmartDate = (value) => {
	if (!value) {
		return null;
	}

	const date =
		value instanceof Date
			? value
			: new Date(value);

	return Number.isNaN(
		date.getTime()
	)
		? null
		: date;
};

const formatSmartDateTime = (value) => {
	const date =
		parseSmartDate(value);

	if (!date) {
		return "No recent activity";
	}

	return new Intl.DateTimeFormat(
		"en-IN",
		{
			day: "2-digit",
			month: "short",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			hour12: true,
		}
	).format(date);
};

const performanceCategory = (row) => {
	const text =
		`${performanceAction(row)} ${row?.role || ""}`
			.toUpperCase();

	if (
		text.includes("PACK") ||
		text.includes("STICKER")
	) {
		return "PACKING";
	}

	if (
		text.includes("DISPATCH") ||
		text.includes("CHALLAN") ||
		text.includes("CHALAAN")
	) {
		return "DISPATCH";
	}

	if (
		text.includes("WAREHOUSE") ||
		text.includes("FG") ||
		text.includes("MOVE") ||
		text.includes("TRANSFER")
	) {
		return "MOVEMENT";
	}

	if (
		text.includes("APPROVE") ||
		text.includes("REJECT") ||
		text.includes("RESTORE") ||
		text.includes("RETURN")
	) {
		return "CONTROL";
	}

	return "OTHER";
};

const toLocalDateTimeParam = (date) => {
	if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
		return "";
	}

	const pad = (value) => String(value).padStart(2, "0");

	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
		date.getDate()
	)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
		date.getSeconds()
	)}`;
};

const getPerformancePeriodWindow = (period) => {
	const now = new Date();
	const end = new Date(now);
	end.setHours(23, 59, 59, 999);

	if (period === "ALL") {
		return {
			key: "ALL",
			label: "All Available",
			start: null,
			end: null,
			fromParam: "",
			toParam: "",
		};
	}

	const start = new Date(now);
	start.setHours(0, 0, 0, 0);

	if (period === "7D") {
		start.setDate(start.getDate() - 6);
	} else if (period === "30D") {
		start.setDate(start.getDate() - 29);
	}

	const label =
		PERFORMANCE_PERIOD_OPTIONS.find((item) => item.value === period)
			?.label || "Today";

	return {
		key: period,
		label,
		start,
		end,
		fromParam: toLocalDateTimeParam(start),
		toParam: toLocalDateTimeParam(end),
	};
};

const isWithinPerformanceWindow = (value, window) => {
	if (!window || window.key === "ALL") {
		return true;
	}

	const date = parseSmartDate(value);

	if (!date) {
		return false;
	}

	return (
		(!window.start || date.getTime() >= window.start.getTime()) &&
		(!window.end || date.getTime() <= window.end.getTime())
	);
};

const localDateKey = (value) => {
	const date = parseSmartDate(value);

	if (!date) return "";

	const pad = (part) => String(part).padStart(2, "0");

	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
		date.getDate()
	)}`;
};

const extractApiRows = (payload) => {
	if (Array.isArray(payload)) {
		return payload;
	}

	const candidates = [
		payload?.rows,
		payload?.content,
		payload?.items,
		payload?.results,
		payload?.data,
	];

	return candidates.find(Array.isArray) || [];
};

const stickerTimestamp = (row) =>
	row?.generatedAt || row?.createdAt || row?.updatedAt || null;

const dispatchTimestamp = (row) =>
	row?.dispatchedAt ||
	row?.tripStartedAt ||
	row?.generatedAt ||
	row?.createdAt ||
	null;

const customChallanTimestamp = (row) =>
	row?.generatedAt || row?.dispatchTime || row?.createdAt || null;

const dispatchActor = (row) =>
	row?.dispatchedBy || row?.generatedBy || row?.createdBy || "";

const customChallanActor = (row) =>
	row?.generatedBy || row?.createdBy || row?.dispatchedBy || "";

const dispatchItemCount = (row) => {
	const total = Number(row?.totalItems);

	if (Number.isFinite(total) && total > 0) {
		return total;
	}

	return Array.isArray(row?.items) ? row.items.length : 0;
};

const packingReportActor = (row) =>
	row?.packedBy ||
	row?.createdBy ||
	row?.generatedBy ||
	performanceActor(row);

const dispatchReportActor = (row) =>
	row?.dispatchedBy ||
	row?.createdBy ||
	performanceActor(row);

const reportClientName = (row) =>
	String(
		row?.clientName ||
		row?.client ||
		row?.siteName ||
		""
	).trim();

const getPackFlowAccessMatrix = (user) => {
	const roles = userRoles(user);
	const has = (...requested) =>
		requested.some((role) => roles.includes(role));

	const warehouse = readWarehouseAccess(user);

	return [
		{
			key: "DASHBOARD",
			label: "Dashboard",
			granted: has("ADMIN", "DISPATCH", "PACKING", "WAREHOUSE", "LOGISTICS"),
		},
		{
			key: "NORMAL_INVENTORY",
			label: "Inventory Items",
			granted: has("ADMIN", "PACKING"),
		},
		{
			key: "HARDWARE_INVENTORY",
			label: "Hardware Inventory",
			granted: has("ADMIN", "HARDWARE_PACKING"),
		},
		{
			key: "WAREHOUSE",
			label: "Warehouse",
			granted: warehouse,
		},
		{
			key: "DISPATCH",
			label: "Dispatched Items",
			granted: has("ADMIN", "DISPATCH", "WAREHOUSE", "PACKING"),
		},
		{
			key: "LOGISTICS",
			label: "Logistics",
			granted: has("ADMIN", "LOGISTICS"),
		},
		{
			key: "USER_ADMIN",
			label: "User Administration",
			granted: has("ADMIN"),
		},
		{
			key: "DRIVER_MOBILE",
			label: "Driver Mobile",
			granted: has("DRIVER"),
		},
	];
};

const getUserAccessHealth = (user) => {
	const roles =
		userRoles(user);

	const modules =
		userModules(user);

	const plants =
		userPlantCodes(user);

	const issues = [];

	const requiredModules =
		modulesForRoles(roles);

	requiredModules.forEach(
		(module) => {
			if (
				!modules.includes(module)
			) {
				issues.push(
					`${module} module missing for assigned role.`
				);
			}
		}
	);

	if (
		rolesRequirePlantAccess(
			roles
		) &&
		plants.length === 0
	) {
		issues.push(
			"Plant access is required but no plant is assigned."
		);
	}

	if (
		rolesRequireDriver(roles) &&
		!user?.driverId
	) {
		issues.push(
			"DRIVER role has no linked driver profile."
		);
	}

	if (
		roles.includes("DISPATCH") &&
		!readWarehouseAccess(user)
	) {
		issues.push(
			"DISPATCH role should include warehouse access."
		);
	}

	const hardwareOnly =
		roles.includes(
			"HARDWARE_PACKING"
		) &&
		!roles.some((role) =>
			[
				"ADMIN",
				"PACKING",
				"WAREHOUSE",
				"DISPATCH",
				"LOGISTICS",
			].includes(role)
		);

	if (
		hardwareOnly &&
		readWarehouseAccess(user)
	) {
		issues.push(
			"Hardware-only profile has unexpected warehouse access."
		);
	}

	return {
		status:
			issues.length === 0
				? "HEALTHY"
				: "REVIEW",
		issues,
	};
};

/* =========================================================
 * PAGE
 * ========================================================= */

function UsersPageContent() {
	const navigate = useNavigate();

	const {
		hasRole,
		modules: currentModules = [],
		logout: authLogout,
	} = useAuth();

	const safeCurrentModules =
		normalizeArray(currentModules);

	const isCurrentAdmin =
		hasRole("ADMIN");

	const canOpenPackFlow =
		isCurrentAdmin ||
		safeCurrentModules.includes(
			MODULE_KEYS.PACKFLOW
		);

	const canOpenBOMFlow =
		isCurrentAdmin ||
		safeCurrentModules.includes(
			MODULE_KEYS.BOMFLOW
		);

	const canOpenMatFlow =
		isCurrentAdmin ||
		safeCurrentModules.includes(
			MODULE_KEYS.MATFLOW
		);

	const canOpenMachFlow =
		isCurrentAdmin ||
		safeCurrentModules.includes(
			MODULE_KEYS.MACHFLOW
		);

	const [users, setUsers] =
		useState([]);

	const [plants, setPlants] =
		useState([]);

	const [drivers, setDrivers] =
		useState([]);

	const [loading, setLoading] =
		useState(true);

	const [saving, setSaving] =
		useState(false);

	const [search, setSearch] =
		useState("");

	const [statusFilter, setStatusFilter] =
		useState("ALL");

	const [moduleFilter, setModuleFilter] =
		useState("ALL");

	const [roleFilter, setRoleFilter] =
		useState("ALL");

	const [plantFilter, setPlantFilter] =
		useState("ALL");

	const [activityFilter, setActivityFilter] =
		useState("ALL");

	const [performancePeriod, setPerformancePeriod] =
		useState("7D");

	const [sortBy, setSortBy] =
		useState("ACTIVITY");

	const [exportingReport, setExportingReport] =
		useState(false);

	const [performanceLoading, setPerformanceLoading] =
		useState(false);

	const [performanceData, setPerformanceData] =
		useState({
			packingRows: [],
			dispatchRows: [],
			packingReportRows: [],
			dispatchReportRows: [],
			activityRows: [],
			stickerRows: [],
			dispatchChallans: [],
			customChallans: [],
			loadedAt: null,
			errors: [],
			sources: {},
		});

	const [performanceOpen, setPerformanceOpen] =
		useState(false);

	const [performanceUser, setPerformanceUser] =
		useState(null);

	const [pageNo, setPageNo] =
		useState(1);

	const [pageSize, setPageSize] =
		useState(25);

	const [drawerOpen, setDrawerOpen] =
		useState(false);

	const [drawerMode, setDrawerMode] =
		useState("create");

	const [editingUserId, setEditingUserId] =
		useState(null);

	const [form, setForm] =
		useState(DEFAULT_FORM);

	const [resetOpen, setResetOpen] =
		useState(false);

	const [resetUser, setResetUser] =
		useState(null);

	const [newPassword, setNewPassword] =
		useState("");

	const [deleteOpen, setDeleteOpen] =
		useState(false);

	const [deleteUser, setDeleteUser] =
		useState(null);

	const [snackbar, setSnackbar] =
		useState({
			open: false,
			message: "",
			severity: "success",
		});

	const showMessage = useCallback(
		(
			message,
			severity = "success"
		) => {
			setSnackbar({
				open: true,
				message,
				severity,
			});
		},
		[]
	);

	const loadUsers = useCallback(
		async () => {
			const response =
				await API.get("/users");

			const data =
				Array.isArray(response.data)
					? response.data
					: [];

			setUsers(data);
		},
		[]
	);

	const loadPageData = useCallback(
		async () => {
			setLoading(true);

			const [
				usersResult,
				plantsResult,
				driversResult,
			] = await Promise.allSettled([
				API.get("/users"),
				API.get("/plants"),
				API.get(
					"/logistics/drivers"
				),
			]);

			if (
				usersResult.status ===
				"fulfilled"
			) {
				setUsers(
					Array.isArray(
						usersResult.value.data
					)
						? usersResult.value.data
						: []
				);
			} else {
				setUsers([]);

				showMessage(
					readError(
						usersResult.reason,
						"Unable to load users."
					),
					"error"
				);
			}

			if (
				plantsResult.status ===
				"fulfilled"
			) {
				setPlants(
					Array.isArray(
						plantsResult.value.data
					)
						? plantsResult.value.data
						: []
				);
			} else {
				setPlants([]);
			}

			if (
				driversResult.status ===
				"fulfilled"
			) {
				setDrivers(
					Array.isArray(
						driversResult.value.data
					)
						? driversResult.value.data
						: []
				);
			} else {
				setDrivers([]);
			}

			setLoading(false);
		},
		[showMessage]
	);

	const performanceWindow = useMemo(
		() => getPerformancePeriodWindow(performancePeriod),
		[performancePeriod]
	);

	const loadPerformance = useCallback(
		async () => {
			setPerformanceLoading(true);

			const traceParams = {
				type: "all",
				limit: 2000,
				offset: 0,
			};

			if (performanceWindow.fromParam) {
				traceParams.from = performanceWindow.fromParam;
			}

			if (performanceWindow.toParam) {
				traceParams.to = performanceWindow.toParam;
			}

			const reportFrom =
				performanceWindow.fromParam ||
				"2000-01-01T00:00:00";

			const reportTo =
				performanceWindow.toParam ||
				toLocalDateTimeParam(new Date());

			const [
				packingResult,
				dispatchResult,
				packingReportResult,
				dispatchReportResult,
				traceResult,
				recentActivityResult,
				stickerResult,
				dispatchChallanResult,
				customChallanResult,
			] = await Promise.allSettled([
				API.get("/reports/dashboard/daily-throughput/users", {
					params: { type: "packing" },
				}),
				API.get("/reports/dashboard/daily-throughput/users", {
					params: { type: "dispatch" },
				}),
				API.get("/reports/packing", {
					params: { from: reportFrom, to: reportTo },
				}),
				API.get("/reports/dispatch", {
					params: { from: reportFrom, to: reportTo },
				}),
				API.get("/reports/dashboard/inventory-trace", {
					params: traceParams,
				}),
				API.get("/reports/dashboard/activity", {
					params: { limit: 500 },
				}),
				API.get("/stickers/generated-history"),
				API.get("/dispatched/challans"),
				API.get("/chalaan/custom"),
			]);

			const errors = [];
			const sources = {};

			const unpackRows = (result, label, sourceKey) => {
				if (result.status === "fulfilled") {
					const rows = extractApiRows(result.value?.data);
					sources[sourceKey] = {
						ok: true,
						count: rows.length,
					};
					return rows;
				}

				const message = readError(result.reason, "Unavailable");
				errors.push(`${label}: ${message}`);
				sources[sourceKey] = {
					ok: false,
					count: 0,
					message,
				};
				return [];
			};

			const traceRows = unpackRows(
				traceResult,
				"Inventory trace",
				"trace"
			);

			const recentRows = unpackRows(
				recentActivityResult,
				"Recent activity",
				"activity"
			);

			/*
			 * Trace is the preferred period-aware source. The dashboard activity
			 * feed remains a safe fallback and also fills gaps when trace rows do
			 * not expose an actor/action shape.
			 */
			const actorTraceRows = traceRows.filter((row) =>
				Boolean(normalizeUsernameKey(performanceActor(row)))
			);

			const activityRows =
				actorTraceRows.length > 0 ? actorTraceRows : recentRows;

			setPerformanceData({
				packingRows: unpackRows(
					packingResult,
					"Packing throughput today",
					"packingToday"
				),
				dispatchRows: unpackRows(
					dispatchResult,
					"Dispatch throughput today",
					"dispatchToday"
				),
				packingReportRows: unpackRows(
					packingReportResult,
					"Period packing report",
					"packingReport"
				),
				dispatchReportRows: unpackRows(
					dispatchReportResult,
					"Period dispatch report",
					"dispatchReport"
				),
				activityRows,
				stickerRows: unpackRows(
					stickerResult,
					"Sticker history",
					"stickers"
				),
				dispatchChallans: unpackRows(
					dispatchChallanResult,
					"Dispatch challans",
					"challans"
				),
				customChallans: unpackRows(
					customChallanResult,
					"Custom challans",
					"customChallans"
				),
				loadedAt: new Date(),
				errors,
				sources,
			});

			setPerformanceLoading(false);
		},
		[performanceWindow]
	);

	useEffect(() => {
		loadPageData();
		loadPerformance();
	}, [
		loadPageData,
		loadPerformance,
	]);

	const plantName = useCallback(
		(code) => {
			const plant =
				plants.find(
					(item) =>
						String(
							item?.plantCode ||
							""
						)
							.trim()
							.toUpperCase() ===
						String(code || "")
							.trim()
							.toUpperCase()
				);

			if (!plant) {
				return code;
			}

			return (
				plant.plantName
					? `${plant.plantCode} — ${plant.plantName}`
					: plant.plantCode
			);
		},
		[plants]
	);

	const driverName = useCallback(
		(driverId) => {
			if (!driverId) {
				return "Not linked";
			}

			const driver =
				drivers.find(
					(item) =>
						String(item?.id) ===
						String(driverId)
				);

			if (!driver) {
				return `${String(driverId).slice(
					0,
					8
				)}…`;
			}

			return driver.phone
				? `${driver.name} • ${driver.phone}`
				: driver.name;
		},
		[drivers]
	);

	const openCreateDrawer = () => {
		setDrawerMode("create");
		setEditingUserId(null);
		setForm(DEFAULT_FORM);
		setDrawerOpen(true);
	};

	const openEditDrawer = (user) => {
		const assignedRoles =
			userRoles(user);

		const primaryRole =
			primaryRoleFor(
				assignedRoles,
				user.role
			);

		setDrawerMode("edit");
		setEditingUserId(user.id);

		setForm({
			username:
				user.username || "",

			password: "",

			role:
				primaryRole,

			roles:
				assignedRoles.length
					? assignedRoles
					: [primaryRole],

			plantCodes:
				userPlantCodes(user),

			driverId:
				assignedRoles.includes("DRIVER")
					? user.driverId || ""
					: "",

			warehouseAccess:
				readWarehouseAccess(user),
		});

		setDrawerOpen(true);
	};

	const closeDrawer = () => {
		if (saving) {
			return;
		}

		setDrawerOpen(false);
		setEditingUserId(null);
		setForm(DEFAULT_FORM);
	};

	const updateForm = (
		key,
		value
	) => {
		setForm((previous) => ({
			...previous,
			[key]: value,
		}));
	};

	const handleRolesChange = (
		nextRoles
	) => {
		let cleanRoles =
			normalizeArray(nextRoles)
				.filter((role) => ROLE_META[role]);

		if (cleanRoles.length === 0) {
			return;
		}

		/*
		 * ADMIN is exclusive.
		 */
		if (cleanRoles.includes("ADMIN")) {
			cleanRoles = ["ADMIN"];
		}

		/*
		 * Keep the old PackFlow multi-role behaviour and allow one MachFlow
		 * role to coexist with an existing operational profile. Invalid
		 * combinations remain visible temporarily so validation can explain
		 * exactly what must be changed instead of silently deleting a role.
		 */

		setForm((previous) => {
			const nextPrimaryRole =
				primaryRoleFor(
					cleanRoles,
					previous.role
				);

			const next = {
				...previous,
				role: nextPrimaryRole,
				roles: cleanRoles,
			};

			if (
				!rolesRequireDriver(
					cleanRoles
				)
			) {
				next.driverId = "";
			}

			if (
				!rolesRequirePlantAccess(
					cleanRoles
				)
			) {
				next.plantCodes = [];
			}

			next.warehouseAccess =
				resolveWarehouseAccessForRoles(
					cleanRoles,
					previous.warehouseAccess
				);

			return next;
		});
	};

	const validateForm = () => {
		const roles =
			normalizeArray(form.roles);

		if (!form.username.trim()) {
			return "Username is required.";
		}

		if (
			drawerMode === "create" &&
			!form.password
		) {
			return "Password is required.";
		}

		if (
			drawerMode === "create" &&
			form.password.length < 8
		) {
			return "Password must be at least 8 characters.";
		}

		if (roles.length === 0) {
			return "Select at least one role.";
		}

		if (
			roles.some(
				(role) => !ROLE_META[role]
			)
		) {
			return "One or more selected roles are invalid.";
		}

		if (
			roles.includes("ADMIN") &&
			roles.length > 1
		) {
			return "Administrator cannot be combined with another role.";
		}

		if (!isAllowedRoleCombination(roles)) {
			return "Invalid role combination. PackFlow roles can be combined as before; add only one MachFlow role alongside PackFlow or one BOMFlow/MatFlow role.";
		}

		if (
			rolesRequireDriver(roles) &&
			!form.driverId
		) {
			return "Select a linked driver profile.";
		}

		if (
			rolesRequirePlantAccess(roles) &&
			form.plantCodes.length === 0
		) {
			return "Select at least one plant.";
		}

		return "";
	};

	const buildPayload = () => {
		const roles =
			normalizeArray(form.roles);

		const primaryRole =
			primaryRoleFor(
				roles,
				form.role
			);

		return {
			username:
				form.username.trim(),

			...(drawerMode === "create"
				? {
					password:
						form.password,
				}
				: {}),

			/*
			 * Legacy/primary role.
			 */
			role:
				primaryRole,

			/*
			 * Actual effective role assignments.
			 */
			roles,

			plantCodes:
				rolesRequirePlantAccess(roles)
					? normalizeArray(
						form.plantCodes
					)
					: [],

			driverId:
				rolesRequireDriver(roles)
					? form.driverId
					: null,

			warehouseAccess:
				resolveWarehouseAccessForRoles(
					roles,
					form.warehouseAccess
				),

			modules:
				modulesForRoles(roles),
		};
	};

	const saveUser = async () => {
		const validationError =
			validateForm();

		if (validationError) {
			showMessage(
				validationError,
				"error"
			);

			return;
		}

		setSaving(true);

		try {
			const payload =
				buildPayload();

			if (
				drawerMode === "create"
			) {
				await API.post(
					"/users",
					payload
				);
			} else {
				await API.put(
					`/users/${editingUserId}`,
					payload
				);
			}

			await loadUsers();

			showMessage(
				drawerMode === "create"
					? "User created successfully."
					: "User updated successfully."
			);

			setDrawerOpen(false);
			setEditingUserId(null);
			setForm(DEFAULT_FORM);
		} catch (error) {
			showMessage(
				readError(
					error,
					drawerMode === "create"
						? "User creation failed."
						: "User update failed."
				),
				"error"
			);
		} finally {
			setSaving(false);
		}
	};

	const openResetDialog = (user) => {
		setResetUser(user);
		setNewPassword("");
		setResetOpen(true);
	};

	const resetPassword = async () => {
		if (
			!resetUser?.id
		) {
			return;
		}

		if (
			newPassword.length < 8
		) {
			showMessage(
				"Password must be at least 8 characters.",
				"error"
			);

			return;
		}

		try {
			await API.put(
				`/users/${resetUser.id}/password`,
				{
					password:
						newPassword,
				}
			);

			setResetOpen(false);
			setResetUser(null);
			setNewPassword("");

			showMessage(
				"Password reset successfully."
			);
		} catch (error) {
			showMessage(
				readError(
					error,
					"Password reset failed."
				),
				"error"
			);
		}
	};

	const openDisableDialog = (user) => {
		setDeleteUser(user);
		setDeleteOpen(true);
	};

	const confirmDisable = async () => {
		if (!deleteUser?.id) {
			return;
		}

		try {
			await API.delete(
				`/users/${deleteUser.id}`
			);

			await loadUsers();

			setDeleteOpen(false);
			setDeleteUser(null);

			showMessage(
				"User disabled successfully."
			);
		} catch (error) {
			showMessage(
				readError(
					error,
					"Unable to disable user."
				),
				"error"
			);
		}
	};

	const performanceByUser = useMemo(() => {
		const map = new Map();

		users.forEach((user) => {
			const key = normalizeUsernameKey(user.username);
			if (!key) return;

			map.set(key, {
				packingToday: 0,
				dispatchToday: 0,
				todayOutput: 0,
				packingPeriod: 0,
				dispatchPeriod: 0,
				periodOutput: 0,
				clientsTouched: 0,
				recentActions: 0,
				packingActions: 0,
				dispatchActions: 0,
				movementActions: 0,
				controlActions: 0,
				otherActions: 0,
				stickersGenerated: 0,
				initialStickers: 0,
				reprints: 0,
				dispatchChallans: 0,
				customChallans: 0,
				dispatchItems: 0,
				activeDays: 0,
				trackedRecords: 0,
				lastActivityAt: null,
				recentRows: [],
				activityScore: 0,
				activityBand: "No recorded work",
				_activeDayKeys: new Set(),
				_clientKeys: new Set(),
			});
		});

		const touchActivity = (target, timestamp) => {
			const parsed = parseSmartDate(timestamp);
			if (!parsed) return;

			const currentLast = parseSmartDate(target.lastActivityAt);
			if (!currentLast || parsed.getTime() > currentLast.getTime()) {
				target.lastActivityAt = timestamp;
			}

			const dayKey = localDateKey(timestamp);
			if (dayKey) target._activeDayKeys.add(dayKey);
		};

		const addDailyCount = (rows, field) => {
			rows.forEach((row) => {
				const key = normalizeUsernameKey(
					row?.username || row?.performedBy || row?.user
				);
				const target = map.get(key);
				if (!target) return;
				target[field] += Number(row?.count || 0) || 0;
			});
		};

		addDailyCount(performanceData.packingRows, "packingToday");
		addDailyCount(performanceData.dispatchRows, "dispatchToday");

		const addPeriodReportRows = (rows, actorGetter, field) => {
			rows.forEach((row) => {
				const target = map.get(
					normalizeUsernameKey(actorGetter(row))
				);

				if (!target) return;

				target[field] += 1;
				touchActivity(target, performanceTimestamp(row));

				const client = reportClientName(row);
				if (client) {
					target._clientKeys.add(client.toUpperCase());
				}
			});
		};

		addPeriodReportRows(
			performanceData.packingReportRows || [],
			packingReportActor,
			"packingPeriod"
		);

		addPeriodReportRows(
			performanceData.dispatchReportRows || [],
			dispatchReportActor,
			"dispatchPeriod"
		);

		performanceData.activityRows.forEach((row) => {
			const timestamp = performanceTimestamp(row);
			if (!isWithinPerformanceWindow(timestamp, performanceWindow)) return;

			const target = map.get(normalizeUsernameKey(performanceActor(row)));
			if (!target) return;

			target.recentActions += 1;
			const category = performanceCategory(row);

			if (category === "PACKING") target.packingActions += 1;
			else if (category === "DISPATCH") target.dispatchActions += 1;
			else if (category === "MOVEMENT") target.movementActions += 1;
			else if (category === "CONTROL") target.controlActions += 1;
			else target.otherActions += 1;

			touchActivity(target, timestamp);

			if (target.recentRows.length < 12) {
				target.recentRows.push(row);
			}
		});

		performanceData.stickerRows.forEach((row) => {
			const timestamp = stickerTimestamp(row);
			if (!isWithinPerformanceWindow(timestamp, performanceWindow)) return;

			const target = map.get(normalizeUsernameKey(row?.generatedBy));
			if (!target) return;

			target.stickersGenerated += 1;
			const isReprint =
				String(row?.reason || "").toUpperCase() === "REPRINT" ||
				Number(row?.printIteration || 1) > 1;

			if (isReprint) target.reprints += 1;
			else target.initialStickers += 1;

			touchActivity(target, timestamp);
		});

		performanceData.dispatchChallans.forEach((row) => {
			const timestamp = dispatchTimestamp(row);
			if (!isWithinPerformanceWindow(timestamp, performanceWindow)) return;

			const target = map.get(normalizeUsernameKey(dispatchActor(row)));
			if (!target) return;

			target.dispatchChallans += 1;
			target.dispatchItems += dispatchItemCount(row);
			touchActivity(target, timestamp);
		});

		performanceData.customChallans.forEach((row) => {
			const timestamp = customChallanTimestamp(row);
			if (!isWithinPerformanceWindow(timestamp, performanceWindow)) return;

			const target = map.get(normalizeUsernameKey(customChallanActor(row)));
			if (!target) return;

			target.customChallans += 1;
			target.dispatchItems += dispatchItemCount(row);
			touchActivity(target, timestamp);
		});

		let maxPeriodOutput = 0;
		let maxTrackedRecords = 0;
		let maxActions = 0;
		let maxActiveDays = 0;

		map.forEach((value) => {
			value.todayOutput = value.packingToday + value.dispatchToday;
			value.periodOutput = value.packingPeriod + value.dispatchPeriod;
			value.clientsTouched = value._clientKeys.size;
			value.activeDays = value._activeDayKeys.size;
			value.trackedRecords =
				value.stickersGenerated +
				value.dispatchChallans +
				value.customChallans;

			maxPeriodOutput = Math.max(maxPeriodOutput, value.periodOutput);
			maxTrackedRecords = Math.max(maxTrackedRecords, value.trackedRecords);
			maxActions = Math.max(maxActions, value.recentActions);
			maxActiveDays = Math.max(maxActiveDays, value.activeDays);
		});

		map.forEach((value) => {
			const outputIndex = maxPeriodOutput
				? value.periodOutput / maxPeriodOutput
				: 0;
			const recordIndex = maxTrackedRecords
				? value.trackedRecords / maxTrackedRecords
				: 0;
			const actionIndex = maxActions
				? value.recentActions / maxActions
				: 0;
			const dayIndex = maxActiveDays
				? value.activeDays / maxActiveDays
				: 0;

			value.activityScore = Math.round(
				Math.min(
					100,
					outputIndex * 55 +
					recordIndex * 20 +
					actionIndex * 15 +
					dayIndex * 10
				)
			);

			value.activityBand =
				value.activityScore >= 80
					? "High recorded activity"
					: value.activityScore >= 50
						? "Strong recorded activity"
						: value.activityScore > 0
							? "Recorded activity"
							: "No recorded work";

			delete value._activeDayKeys;
			delete value._clientKeys;
		});

		return map;
	}, [users, performanceData, performanceWindow]);

	const accessHealthByUser = useMemo(() => {
		const map = new Map();

		users.forEach((user) => {
			map.set(
				String(user.id),
				getUserAccessHealth(user)
			);
		});

		return map;
	}, [users]);

	const filteredRows = useMemo(() => {
		const query = search.trim().toLowerCase();

		const list = users.filter((user) => {
			const roles = userRoles(user);
			const plants = userPlantCodes(user);
			const modules = userModules(user);
			const performance =
				performanceByUser.get(normalizeUsernameKey(user.username)) || {};
			const accessHealth =
				accessHealthByUser.get(String(user.id)) || {
					status: "HEALTHY",
					issues: [],
				};
			const screenAccess = getPackFlowAccessMatrix(user)
				.filter((item) => item.granted)
				.map((item) => item.label);

			if (statusFilter === "ENABLED" && user.enabled !== true) return false;
			if (statusFilter === "DISABLED" && user.enabled === true) return false;
			if (moduleFilter !== "ALL" && !modules.includes(moduleFilter)) return false;
			if (roleFilter !== "ALL" && !roles.includes(roleFilter)) return false;
			if (plantFilter !== "ALL" && !plants.includes(plantFilter)) return false;

			const hasPeriodActivity =
				Number(performance.periodOutput || 0) > 0 ||
				Number(performance.trackedRecords || 0) > 0 ||
				Number(performance.recentActions || 0) > 0 ||
				(performancePeriod === "TODAY" && Number(performance.todayOutput || 0) > 0);

			if (activityFilter === "ACTIVE_TODAY" && Number(performance.todayOutput || 0) <= 0) {
				return false;
			}
			if (activityFilter === "ACTIVE_PERIOD" && !hasPeriodActivity) return false;
			if (activityFilter === "NO_ACTIVITY" && hasPeriodActivity) return false;
			if (activityFilter === "MULTI_ROLE" && roles.length <= 1) return false;
			if (activityFilter === "ACCESS_REVIEW" && accessHealth.status !== "REVIEW") {
				return false;
			}

			if (!query) return true;

			const searchable = [
				user.username,
				...roles,
				...plants,
				...modules,
				...screenAccess,
				...accessHealth.issues,
				performance.activityBand,
			]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();

			return searchable.includes(query);
		});

		return [...list].sort((a, b) => {
			const aPerf = performanceByUser.get(normalizeUsernameKey(a.username)) || {};
			const bPerf = performanceByUser.get(normalizeUsernameKey(b.username)) || {};
			const aHealth = accessHealthByUser.get(String(a.id)) || { issues: [] };
			const bHealth = accessHealthByUser.get(String(b.id)) || { issues: [] };

			if (sortBy === "USERNAME") {
				return String(a.username || "").localeCompare(String(b.username || ""));
			}
			if (sortBy === "OUTPUT") {
				return Number(bPerf.periodOutput || 0) - Number(aPerf.periodOutput || 0);
			}
			if (sortBy === "RECORDS") {
				return Number(bPerf.trackedRecords || 0) - Number(aPerf.trackedRecords || 0);
			}
			if (sortBy === "STICKERS") {
				return Number(bPerf.stickersGenerated || 0) - Number(aPerf.stickersGenerated || 0);
			}
			if (sortBy === "DISPATCH_ITEMS") {
				return Number(bPerf.dispatchItems || 0) - Number(aPerf.dispatchItems || 0);
			}
			if (sortBy === "LAST_ACTIVITY") {
				return (
					(parseSmartDate(bPerf.lastActivityAt)?.getTime() || 0) -
					(parseSmartDate(aPerf.lastActivityAt)?.getTime() || 0)
				);
			}
			if (sortBy === "ACCESS_REVIEW") {
				return (bHealth.issues?.length || 0) - (aHealth.issues?.length || 0);
			}

			return Number(bPerf.activityScore || 0) - Number(aPerf.activityScore || 0);
		});
	}, [
		users,
		search,
		statusFilter,
		moduleFilter,
		roleFilter,
		plantFilter,
		activityFilter,
		performancePeriod,
		sortBy,
		performanceByUser,
		accessHealthByUser,
	]);

	const totalPages = Math.max(
		1,
		Math.ceil(
			filteredRows.length /
			pageSize
		)
	);

	const currentPage = Math.min(
		pageNo,
		totalPages
	);

	const paginatedRows = useMemo(() => {
		const start =
			(currentPage - 1) *
			pageSize;

		return filteredRows.slice(
			start,
			start + pageSize
		);
	}, [
		filteredRows,
		currentPage,
		pageSize,
	]);

	const stats = useMemo(() => {
		const enabled = users.filter((user) => user.enabled === true).length;
		const packFlowUsers = users.filter((user) =>
			userModules(user).includes(MODULE_KEYS.PACKFLOW)
		).length;
		const matFlowUsers = users.filter((user) =>
			userRoles(user).some((role) => role.startsWith("MATFLOW_"))
		).length;
		const bomFlowUsers = users.filter((user) =>
			userRoles(user).some((role) => role.startsWith("BOMFLOW_"))
		).length;
		const machFlowUsers = users.filter((user) =>
			userRoles(user).some((role) => role.startsWith("MACHFLOW_"))
		).length;
		const multiRoleUsers = users.filter((user) => userRoles(user).length > 1).length;

		let workToday = 0;
		let activeToday = 0;
		let activePeriod = 0;
		let trackedRecords = 0;
		let stickers = 0;
		let reprints = 0;
		let dispatchItems = 0;
		let packedPeriod = 0;
		let dispatchedPeriod = 0;
		let activityEvents = 0;

		users.forEach((user) => {
			const performance =
				performanceByUser.get(normalizeUsernameKey(user.username)) || {};
			const todayOutput = Number(performance.todayOutput || 0);
			workToday += todayOutput;
			if (todayOutput > 0) activeToday += 1;

			const hasPeriodActivity =
				Number(performance.periodOutput || 0) > 0 ||
				Number(performance.trackedRecords || 0) > 0 ||
				Number(performance.recentActions || 0) > 0 ||
				(performancePeriod === "TODAY" && todayOutput > 0);
			if (hasPeriodActivity) activePeriod += 1;

			trackedRecords += Number(performance.trackedRecords || 0);
			stickers += Number(performance.stickersGenerated || 0);
			reprints += Number(performance.reprints || 0);
			dispatchItems += Number(performance.dispatchItems || 0);
			packedPeriod += Number(performance.packingPeriod || 0);
			dispatchedPeriod += Number(performance.dispatchPeriod || 0);
			activityEvents += Number(performance.recentActions || 0);
		});

		const accessIssues = users.filter(
			(user) =>
				(accessHealthByUser.get(String(user.id))?.issues || []).length > 0
		).length;

		return {
			total: users.length,
			enabled,
			disabled: users.length - enabled,
			packFlowUsers,
			matFlowUsers,
			bomFlowUsers,
			machFlowUsers,
			multiRoleUsers,
			workToday,
			activeToday,
			activePeriod,
			trackedRecords,
			stickers,
			reprints,
			dispatchItems,
			packedPeriod,
			dispatchedPeriod,
			activityEvents,
			accessIssues,
		};
	}, [users, performanceByUser, accessHealthByUser, performancePeriod]);

	const exportUserManagementReport = useCallback(async () => {
		if (filteredRows.length === 0) {
			showMessage("No users match the current filters.", "warning");
			return;
		}

		setExportingReport(true);

		try {
			const [{ default: ExcelJS }, fileSaverModule] = await Promise.all([
				import("exceljs"),
				import("file-saver"),
			]);
			const saveAs = fileSaverModule.saveAs || fileSaverModule.default;
			const workbook = new ExcelJS.Workbook();
			workbook.creator = "ALSORG FlowSuite";
			workbook.company = "ALSORG";
			workbook.subject = "Smart User Management & PackFlow Tracker";
			workbook.created = new Date();

			const border = {
				top: { style: "thin", color: { argb: "FFE2E8F0" } },
				left: { style: "thin", color: { argb: "FFE2E8F0" } },
				bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
				right: { style: "thin", color: { argb: "FFE2E8F0" } },
			};

			const prepareSheet = (sheet, title, subtitle, columnCount) => {
				sheet.views = [{ state: "frozen", ySplit: 4 }];
				sheet.mergeCells(1, 1, 1, columnCount);
				sheet.getCell(1, 1).value = title;
				sheet.getCell(1, 1).font = {
					bold: true,
					size: 18,
					color: { argb: "FFFFFFFF" },
				};
				sheet.getCell(1, 1).fill = {
					type: "pattern",
					pattern: "solid",
					fgColor: { argb: "FF0F172A" },
				};
				sheet.getCell(1, 1).alignment = { vertical: "middle", horizontal: "left" };
				sheet.getRow(1).height = 30;

				sheet.mergeCells(2, 1, 2, columnCount);
				sheet.getCell(2, 1).value = subtitle;
				sheet.getCell(2, 1).font = { italic: true, color: { argb: "FF475569" } };
				sheet.getRow(2).height = 22;
			};

			const styleHeader = (row) => {
				row.height = 24;
				row.eachCell((cell) => {
					cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
					cell.fill = {
						type: "pattern",
						pattern: "solid",
						fgColor: { argb: "FF2563EB" },
					};
					cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
					cell.border = border;
				});
			};

			const finishRows = (sheet, startRow = 5) => {
				for (let r = startRow; r <= sheet.rowCount; r += 1) {
					const row = sheet.getRow(r);
					row.eachCell((cell) => {
						cell.border = border;
						cell.alignment = { vertical: "top", wrapText: true };
					});
				}
				sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: sheet.columnCount } };
				sheet.pageSetup = {
					orientation: "landscape",
					fitToPage: true,
					fitToWidth: 1,
					fitToHeight: 0,
				};
			};

			const exportedUserKeys = new Set(
				filteredRows.map((user) => normalizeUsernameKey(user.username))
			);

			const summarySheet = workbook.addWorksheet("Executive Summary");
			prepareSheet(
				summarySheet,
				"ALSORG — Smart User Management & Tracker",
				`Period: ${performanceWindow.label} | Exported: ${formatSmartDateTime(new Date())} | Users in current filters: ${filteredRows.length}`,
				4
			);
			const summaryHeader = summarySheet.getRow(4);
			summaryHeader.values = ["Metric", "Value", "Metric", "Value"];
			styleHeader(summaryHeader);
			[
				["Total Users", stats.total, "Enabled Users", stats.enabled],
				["PackFlow Users", stats.packFlowUsers, "Multi-Role Users", stats.multiRoleUsers],
				["Active in Period", stats.activePeriod, "Access Reviews", stats.accessIssues],
				["Packed in Period", stats.packedPeriod, "Dispatched in Period", stats.dispatchedPeriod],
				["Sticker Generations", stats.stickers, "Reprints", stats.reprints],
				["Dispatch Items in Challans", stats.dispatchItems, "Tracked Activity Events", stats.activityEvents],
				["Today Packing + Dispatch", stats.workToday, "Disabled Users", stats.disabled],
			].forEach((values) => summarySheet.addRow(values));
			summarySheet.columns = [
				{ width: 30 }, { width: 16 }, { width: 30 }, { width: 16 },
			];
			finishRows(summarySheet);

			const performanceSheet = workbook.addWorksheet("User Performance");
			const performanceHeaders = [
				"Username", "Status", "Roles", "Modules", "Plants", "Today Packing", "Today Dispatch",
				"Period Packing", "Period Dispatch", "Period Output", "Clients Touched",
				"Sticker Generations", "Initial Stickers", "Reprints", "Standard Challans", "Custom Challans",
				"Dispatch Items in Challans", "Activity Events", "Active Days", "Tracked Records", "Activity Index %", "Last Activity", "Access Health",
			];
			prepareSheet(performanceSheet, "User Performance Register", `Period: ${performanceWindow.label}`, performanceHeaders.length);
			performanceSheet.getRow(4).values = performanceHeaders;
			styleHeader(performanceSheet.getRow(4));

			filteredRows.forEach((user) => {
				const perf = performanceByUser.get(normalizeUsernameKey(user.username)) || {};
				const health = accessHealthByUser.get(String(user.id)) || { status: "HEALTHY", issues: [] };
				performanceSheet.addRow([
					user.username,
					user.enabled === true ? "Enabled" : "Disabled",
					userRoles(user).join(", "),
					userModules(user).join(", "),
					userRoles(user).includes("ADMIN") ? "All Plants" : userPlantCodes(user).join(", "),
					Number(perf.packingToday || 0),
					Number(perf.dispatchToday || 0),
					Number(perf.packingPeriod || 0),
					Number(perf.dispatchPeriod || 0),
					Number(perf.periodOutput || 0),
					Number(perf.clientsTouched || 0),
					Number(perf.stickersGenerated || 0),
					Number(perf.initialStickers || 0),
					Number(perf.reprints || 0),
					Number(perf.dispatchChallans || 0),
					Number(perf.customChallans || 0),
					Number(perf.dispatchItems || 0),
					Number(perf.recentActions || 0),
					Number(perf.activeDays || 0),
					Number(perf.trackedRecords || 0),
					Number(perf.activityScore || 0),
					formatSmartDateTime(perf.lastActivityAt),
					health.status === "HEALTHY" ? "Healthy" : health.issues.join(" | "),
				]);
			});
			performanceSheet.columns = performanceHeaders.map((header) => ({ width: Math.max(14, Math.min(30, header.length + 5)) }));
			finishRows(performanceSheet);

			const accessSheet = workbook.addWorksheet("Access Matrix");
			const accessLabels = [
				"Dashboard", "Inventory Items", "Hardware Inventory", "Warehouse",
				"Dispatched Items", "Logistics", "User Administration", "Driver Mobile",
			];
			const accessHeaders = ["Username", "Roles", "Modules", "Plants", "Warehouse Flag", ...accessLabels];
			prepareSheet(accessSheet, "Effective PackFlow Access Matrix", "Matches the current PackFlow navigation / warehouse access rules.", accessHeaders.length);
			accessSheet.getRow(4).values = accessHeaders;
			styleHeader(accessSheet.getRow(4));
			filteredRows.forEach((user) => {
				const matrix = getPackFlowAccessMatrix(user);
				accessSheet.addRow([
					user.username,
					userRoles(user).join(", "),
					userModules(user).join(", "),
					userRoles(user).includes("ADMIN") ? "All Plants" : userPlantCodes(user).join(", "),
					readWarehouseAccess(user) ? "YES" : "NO",
					...matrix.map((item) => (item.granted ? "YES" : "NO")),
				]);
			});
			accessSheet.columns = accessHeaders.map((header) => ({ width: Math.max(14, Math.min(26, header.length + 4)) }));
			finishRows(accessSheet);

			const sourceSheet = workbook.addWorksheet("Data Health");
			const sourceHeaders = ["Source", "Status", "Records", "Message"];
			prepareSheet(sourceSheet, "Tracker Data Source Health", `Snapshot: ${formatSmartDateTime(performanceData.loadedAt)}`, sourceHeaders.length);
			sourceSheet.getRow(4).values = sourceHeaders;
			styleHeader(sourceSheet.getRow(4));
			Object.entries(performanceData.sources || {}).forEach(([key, source]) => {
				sourceSheet.addRow([
					key.replace(/([A-Z])/g, " $1").trim(),
					source?.ok ? "Loaded" : "Unavailable",
					Number(source?.count || 0),
					source?.message || "",
				]);
			});
			sourceSheet.columns = [26, 18, 14, 60].map((width) => ({ width }));
			finishRows(sourceSheet);

			const packingPeriodSheet = workbook.addWorksheet("Packing Period");
			const packingPeriodHeaders = ["Packed At", "Packed By", "Item", "Client", "PD No", "DWG No", "Packet", "Sticker No", "Status"];
			prepareSheet(packingPeriodSheet, "Period Packing Register", `Period: ${performanceWindow.label}`, packingPeriodHeaders.length);
			packingPeriodSheet.getRow(4).values = packingPeriodHeaders;
			styleHeader(packingPeriodSheet.getRow(4));
			(performanceData.packingReportRows || [])
				.filter((row) => exportedUserKeys.has(normalizeUsernameKey(packingReportActor(row))))
				.forEach((row) => packingPeriodSheet.addRow([
					formatSmartDateTime(performanceTimestamp(row)),
					packingReportActor(row),
					row?.itemName || row?.name || row?.description || "",
					reportClientName(row),
					row?.pdNo || row?.pdNumber || "",
					row?.drawingNo || row?.dwgNo || row?.drawingName || "",
					row?.packetNumber || row?.packetNo || row?.pktNo || "",
					row?.stickerNumber || row?.stickerNo || "",
					row?.status || row?.packingStatus || "",
				]));
			packingPeriodSheet.columns = [22, 20, 34, 28, 18, 18, 14, 20, 18].map((width) => ({ width }));
			finishRows(packingPeriodSheet);

			const dispatchPeriodSheet = workbook.addWorksheet("Dispatch Period");
			const dispatchPeriodHeaders = ["Dispatched At", "Dispatched By", "Item", "Client", "PD No", "DWG No", "Packet", "Challan No", "Status"];
			prepareSheet(dispatchPeriodSheet, "Period Dispatch Register", `Period: ${performanceWindow.label}`, dispatchPeriodHeaders.length);
			dispatchPeriodSheet.getRow(4).values = dispatchPeriodHeaders;
			styleHeader(dispatchPeriodSheet.getRow(4));
			(performanceData.dispatchReportRows || [])
				.filter((row) => exportedUserKeys.has(normalizeUsernameKey(dispatchReportActor(row))))
				.forEach((row) => dispatchPeriodSheet.addRow([
					formatSmartDateTime(performanceTimestamp(row)),
					dispatchReportActor(row),
					row?.itemName || row?.name || row?.description || "",
					reportClientName(row),
					row?.pdNo || row?.pdNumber || "",
					row?.drawingNo || row?.dwgNo || row?.drawingName || "",
					row?.packetNumber || row?.packetNo || row?.pktNo || "",
					row?.challanNumber || row?.chalaanNumber || "",
					row?.status || row?.dispatchStatus || "",
				]));
			dispatchPeriodSheet.columns = [22, 20, 34, 28, 18, 18, 14, 22, 18].map((width) => ({ width }));
			finishRows(dispatchPeriodSheet);

			const activitySheet = workbook.addWorksheet("Activity Detail");
			const activityHeaders = ["Date / Time", "User", "Category", "Action", "Role", "From Status", "To Status", "Reference / Remarks"];
			prepareSheet(activitySheet, "Recorded PackFlow Activity", `Period: ${performanceWindow.label}`, activityHeaders.length);
			activitySheet.getRow(4).values = activityHeaders;
			styleHeader(activitySheet.getRow(4));
			performanceData.activityRows
				.filter((row) => exportedUserKeys.has(normalizeUsernameKey(performanceActor(row))))
				.filter((row) => isWithinPerformanceWindow(performanceTimestamp(row), performanceWindow))
				.forEach((row) => {
					activitySheet.addRow([
						formatSmartDateTime(performanceTimestamp(row)),
						performanceActor(row),
						performanceCategory(row),
						performanceAction(row),
						row?.role || row?.performedByRole || row?.userRole || "",
						row?.fromStatus || row?.oldStatus || row?.previousStatus || "",
						row?.toStatus || row?.newStatus || row?.currentStatus || "",
						row?.remarks || row?.referenceNo || row?.challanNumber || row?.zohoItemId || "",
					]);
				});
			activitySheet.columns = [22, 20, 15, 40, 18, 18, 18, 36].map((width) => ({ width }));
			finishRows(activitySheet);

			const stickerSheet = workbook.addWorksheet("Sticker History");
			const stickerHeaders = ["Generated At", "Generated By", "Reason", "Print Iteration", "Sticker No", "Packet No", "Item", "Client", "PD No", "DWG No", "SKU"];
			prepareSheet(stickerSheet, "Sticker Generation Register", `Period: ${performanceWindow.label}`, stickerHeaders.length);
			stickerSheet.getRow(4).values = stickerHeaders;
			styleHeader(stickerSheet.getRow(4));
			performanceData.stickerRows
				.filter((row) => exportedUserKeys.has(normalizeUsernameKey(row?.generatedBy)))
				.filter((row) => isWithinPerformanceWindow(stickerTimestamp(row), performanceWindow))
				.forEach((row) => stickerSheet.addRow([
					formatSmartDateTime(stickerTimestamp(row)), row?.generatedBy || "", row?.reason || (Number(row?.printIteration || 1) > 1 ? "REPRINT" : "INITIAL"),
					row?.printIteration || 1, row?.stickerNumber || "", row?.packetNumber || "", row?.itemName || "", row?.clientName || "", row?.pdNo || "", row?.drawingNo || "", row?.sku || "",
				]));
			stickerSheet.columns = [22, 20, 14, 14, 20, 14, 32, 26, 18, 18, 22].map((width) => ({ width }));
			finishRows(stickerSheet);

			const dispatchSheet = workbook.addWorksheet("Dispatch Register");
			const dispatchHeaders = ["Type", "Date / Time", "User", "Challan No", "Items", "Client / From-To", "Driver", "Vehicle", "Trip Status / Challan Type"];
			prepareSheet(dispatchSheet, "Dispatch & Custom Challan Register", `Period: ${performanceWindow.label}`, dispatchHeaders.length);
			dispatchSheet.getRow(4).values = dispatchHeaders;
			styleHeader(dispatchSheet.getRow(4));
			performanceData.dispatchChallans
				.filter((row) => exportedUserKeys.has(normalizeUsernameKey(dispatchActor(row))))
				.filter((row) => isWithinPerformanceWindow(dispatchTimestamp(row), performanceWindow))
				.forEach((row) => dispatchSheet.addRow([
					"Standard Dispatch", formatSmartDateTime(dispatchTimestamp(row)), dispatchActor(row), row?.challanNumber || row?.chalaanNumber || "", dispatchItemCount(row),
					row?.clientName || row?.destination || row?.toLocation || "", row?.driverName || "", row?.vehicleNumber || "", row?.tripStatus || "",
				]));
			performanceData.customChallans
				.filter((row) => exportedUserKeys.has(normalizeUsernameKey(customChallanActor(row))))
				.filter((row) => isWithinPerformanceWindow(customChallanTimestamp(row), performanceWindow))
				.forEach((row) => dispatchSheet.addRow([
					"Custom Challan", formatSmartDateTime(customChallanTimestamp(row)), customChallanActor(row), row?.challanNumber || "", dispatchItemCount(row),
					row?.clientName || `${row?.fromLocation || ""} → ${row?.toLocation || ""}`, row?.driverName || "", row?.vehicleNumber || "", row?.challanTypeLabel || row?.challanType || "",
				]));
			dispatchSheet.columns = [18, 22, 20, 22, 12, 34, 22, 20, 24].map((width) => ({ width }));
			finishRows(dispatchSheet);

			const reviewSheet = workbook.addWorksheet("Access Review");
			const reviewHeaders = ["Username", "Status", "Roles", "Modules", "Plants", "Issue"];
			prepareSheet(reviewSheet, "Access Review Queue", "Only users with access consistency findings are listed.", reviewHeaders.length);
			reviewSheet.getRow(4).values = reviewHeaders;
			styleHeader(reviewSheet.getRow(4));
			filteredRows.forEach((user) => {
				const health = accessHealthByUser.get(String(user.id));
				(health?.issues || []).forEach((issue) => reviewSheet.addRow([
					user.username, user.enabled === true ? "Enabled" : "Disabled", userRoles(user).join(", "), userModules(user).join(", "), userPlantCodes(user).join(", "), issue,
				]));
			});
			reviewSheet.columns = [20, 14, 34, 24, 24, 60].map((width) => ({ width }));
			finishRows(reviewSheet);

			const buffer = await workbook.xlsx.writeBuffer();
			const stamp = new Date().toISOString().slice(0, 10);
			saveAs(
				new Blob([buffer], {
					type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				}),
				`ALSORG_Smart_User_Tracker_${performancePeriod}_${stamp}.xlsx`
			);
			showMessage("Smart User Tracker report exported successfully.");
		} catch (error) {
			console.error(error);
			showMessage(readError(error, "Unable to export user tracker report."), "error");
		} finally {
			setExportingReport(false);
		}
	}, [
		filteredRows,
		performanceByUser,
		accessHealthByUser,
		performanceData,
		performanceWindow,
		performancePeriod,
		stats,
		showMessage,
	]);

	const clearSmartFilters = () => {
		setSearch("");
		setStatusFilter("ALL");
		setModuleFilter("ALL");
		setRoleFilter("ALL");
		setPlantFilter("ALL");
		setActivityFilter("ALL");
		setPageNo(1);
	};

	const activeFilterCount = [
		Boolean(search.trim()),
		statusFilter !== "ALL",
		moduleFilter !== "ALL",
		roleFilter !== "ALL",
		plantFilter !== "ALL",
		activityFilter !== "ALL",
	].filter(Boolean).length;

	const logout = async () => {
		await authLogout();

		navigate(
			"/login",
			{
				replace: true,
			}
		);
	};

	return (
		<Box sx={pageSx} className="packflow-theme-root">
			<Box sx={contentSx}>
				<PageHeader
					canOpenPackFlow={
						canOpenPackFlow
					}
					canOpenBOMFlow={
						canOpenBOMFlow
					}
					canOpenMatFlow={
						canOpenMatFlow
					}
					canOpenMachFlow={
						canOpenMachFlow
					}
					onModules={() =>
						navigate("/modules")
					}
					onPackFlow={() =>
						navigate(
							"/packflow/dashboard"
						)
					}
					onBOMFlow={() =>
						navigate(
							"/bomflow/dashboard"
						)
					}
					onMatFlow={() =>
						navigate(
							"/matflow/dashboard"
						)
					}
					onMachFlow={() =>
						navigate(
							"/modules?module=machflow"
						)
					}
					onLogout={logout}
					onCreate={
						openCreateDrawer
					}
				/>

				<Box sx={breadcrumbSx}>
					<Button
						startIcon={
							<ArrowBackIcon />
						}
						onClick={() =>
							navigate("/modules")
						}
						sx={secondaryButtonSx}
					>
						Module Hub
					</Button>

					<Typography
						sx={breadcrumbTextSx}
					>
						FlowSuite / Administration /
						Smart User Management
					</Typography>

					<Chip
						label="ADMIN ACCESS"
						size="small"
						sx={adminAccessChipSx}
					/>
				</Box>

				<Box sx={statsGridSx}>
					<StatCard label="Total Users" value={stats.total} accent="#3b82f6" icon={<SupervisorAccountOutlinedIcon />} />
					<StatCard label="Enabled Users" value={stats.enabled} accent="#22c55e" icon={<CheckCircleOutlineOutlinedIcon />} />
					<StatCard label="PackFlow Users" value={stats.packFlowUsers} accent="#38bdf8" icon={<InventoryIcon />} />
					<StatCard label="Multi-Role Users" value={stats.multiRoleUsers} accent="#a78bfa" icon={<SecurityOutlinedIcon />} />
					<StatCard label={`Active • ${performanceWindow.label}`} value={stats.activePeriod} accent="#14b8a6" icon={<TimelineOutlinedIcon />} />
					<StatCard label={`Packed • ${performanceWindow.label}`} value={stats.packedPeriod} accent="#22c55e" icon={<FactCheckOutlinedIcon />} />
					<StatCard label={`Dispatched • ${performanceWindow.label}`} value={stats.dispatchedPeriod} accent="#f97316" icon={<LocalShippingIcon />} />
					<StatCard label={`Sticker Events • ${performanceWindow.label}`} value={stats.stickers} accent="#06b6d4" icon={<TimelineOutlinedIcon />} />
					<StatCard label="Access Reviews" value={stats.accessIssues} accent={stats.accessIssues > 0 ? "#f59e0b" : "#22c55e"} icon={<AdminPanelSettingsIcon />} />
					<StatCard label="Today Pack + Dispatch" value={stats.workToday} accent="#60a5fa" icon={<AssessmentOutlinedIcon />} />
					<StatCard label="BOMFlow Users" value={stats.bomFlowUsers} accent="#8b5cf6" icon={<AccountTreeOutlinedIcon />} />
					<StatCard label="MatFlow Users" value={stats.matFlowUsers} accent="#2dd4bf" icon={<LayersOutlinedIcon />} />
					<StatCard label="MachFlow Users" value={stats.machFlowUsers} accent="#0ea5e9" icon={<EngineeringOutlinedIcon />} />
					<StatCard label="Disabled Users" value={stats.disabled} accent="#64748b" icon={<BlockOutlinedIcon />} />
				</Box>

				<Box sx={smartControlPanelSx}>
					<Box sx={smartControlHeaderSx}>
						<Box>
							<Box sx={smartControlEyebrowSx}>
								SMART USER MANAGEMENT
							</Box>

							<Typography sx={smartControlTitleSx}>
								Access, Performance & User Intelligence
							</Typography>

							<Typography sx={smartControlSubSx}>
								Manage effective access while tracking PackFlow sticker generation, dispatch records, activity, active days and access consistency across a selected period.
							</Typography>
						</Box>

						<Box sx={smartControlActionsSx}>
							<Button
								startIcon={
									<RefreshOutlinedIcon />
								}
								onClick={loadPerformance}
								disabled={performanceLoading}
								sx={secondaryButtonSx}
							>
								{performanceLoading
									? "Refreshing..."
									: "Refresh Intelligence"}
							</Button>

							<Button
								startIcon={<DownloadOutlinedIcon />}
								onClick={exportUserManagementReport}
								disabled={exportingReport || performanceLoading}
								sx={reportButtonSx}
							>
								{exportingReport ? "Building Excel..." : "Export Smart Report"}
							</Button>

							<Button
								startIcon={
									<AddOutlinedIcon />
								}
								onClick={openCreateDrawer}
								sx={primaryButtonSx}
							>
								Create User
							</Button>
						</Box>
					</Box>

					<Box sx={intelligenceToolbarSx}>
						<Box sx={intelligenceToolbarGroupSx}>
							<DateRangeOutlinedIcon sx={{ color: "#60a5fa", fontSize: 18 }} />
							<Typography sx={intelligenceToolbarLabelSx}>Tracker Period</Typography>
							<TextField
								select
								size="small"
								value={performancePeriod}
								onChange={(event) => {
									setPerformancePeriod(event.target.value);
									setPageNo(1);
								}}
								sx={{ ...fieldSx, minWidth: 165 }}
							>
								{PERFORMANCE_PERIOD_OPTIONS.map((option) => (
									<MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
								))}
							</TextField>
						</Box>

						<Box sx={intelligenceToolbarGroupSx}>
							<AssessmentOutlinedIcon sx={{ color: "#a78bfa", fontSize: 18 }} />
							<Typography sx={intelligenceToolbarLabelSx}>Sort</Typography>
							<TextField
								select
								size="small"
								value={sortBy}
								onChange={(event) => {
									setSortBy(event.target.value);
									setPageNo(1);
								}}
								sx={{ ...fieldSx, minWidth: 190 }}
							>
								{USER_SORT_OPTIONS.map(([value, label]) => (
									<MenuItem key={value} value={value}>{label}</MenuItem>
								))}
							</TextField>
						</Box>

						<Box sx={dataSourceHealthSx}>
							<Typography sx={intelligenceToolbarLabelSx}>Data Sources</Typography>
							{Object.entries(performanceData.sources || {}).map(([key, source]) => (
								<Tooltip key={key} title={source.ok ? `${source.count} records loaded` : source.message || "Unavailable"}>
									<Chip
										label={key.replace(/([A-Z])/g, " $1")}
										size="small"
										sx={sourceHealthChipSx(source.ok)}
									/>
								</Tooltip>
							))}
						</Box>
					</Box>

					<Box sx={smartSearchRowSx}>
						<TextField
							fullWidth
							value={search}
							onChange={(event) => {
								setSearch(
									event.target.value
								);
								setPageNo(1);
							}}
							placeholder="Smart search: username, role, module, plant, access issue or activity band..."
							size="small"
							sx={fieldSx}
							InputProps={{
								startAdornment: (
									<InputAdornment position="start">
										<SearchIcon
											sx={{
												color: "var(--pf-text-muted)",
											}}
										/>
									</InputAdornment>
								),
							}}
						/>
					</Box>

					<Box sx={smartFiltersGridSx}>
						<SmartFilterSelect
							label="Status"
							value={statusFilter}
							onChange={(value) => {
								setStatusFilter(value);
								setPageNo(1);
							}}
							options={[
								["ALL", "All Statuses"],
								["ENABLED", "Enabled"],
								["DISABLED", "Disabled"],
							]}
						/>

						<SmartFilterSelect
							label="Module"
							value={moduleFilter}
							onChange={(value) => {
								setModuleFilter(value);
								setPageNo(1);
							}}
							options={[
								["ALL", "All Modules"],
								[MODULE_KEYS.PACKFLOW, "PackFlow"],
								[MODULE_KEYS.BOMFLOW, "BOMFlow"],
								[MODULE_KEYS.MATFLOW, "MatFlow"],
								[MODULE_KEYS.MACHFLOW, "MachFlow"],
							]}
						/>

						<SmartFilterSelect
							label="Role"
							value={roleFilter}
							onChange={(value) => {
								setRoleFilter(value);
								setPageNo(1);
							}}
							options={[
								["ALL", "All Roles"],
								...Object.values(ROLE_META).map(
									(meta) => [
										meta.value,
										meta.label,
									]
								),
							]}
						/>

						<SmartFilterSelect
							label="Plant"
							value={plantFilter}
							onChange={(value) => {
								setPlantFilter(value);
								setPageNo(1);
							}}
							options={[
								["ALL", "All Plants"],
								...plants.map((plant) => [
									plant.plantCode,
									plantName(
										plant.plantCode
									),
								]),
							]}
						/>

						<SmartFilterSelect
							label="Intelligence"
							value={activityFilter}
							onChange={(value) => {
								setActivityFilter(value);
								setPageNo(1);
							}}
							options={[
								["ALL", "All Users"],
								["ACTIVE_PERIOD", `Active • ${performanceWindow.label}`],
								["ACTIVE_TODAY", "Worked Today"],
								["NO_ACTIVITY", `No Activity • ${performanceWindow.label}`],
								["MULTI_ROLE", "Multi-Role Users"],
								["ACCESS_REVIEW", "Access Review Needed"],
							]}
						/>
					</Box>

					<Box sx={smartFilterFooterSx}>
						<Box sx={smartFilterSummarySx}>
							<FilterAltOutlinedIcon
								sx={{
									fontSize: 17,
									color: "#60a5fa",
								}}
							/>

							<Typography sx={mutedTextSx}>
								Showing {filteredRows.length} of {users.length} users
							</Typography>

							{activeFilterCount > 0 && (
								<Chip
									label={`${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}`}
									size="small"
									sx={smartFilterChipSx}
								/>
							)}

							<Typography sx={smartLoadedAtSx}>
								Tracker snapshot: {performanceData.loadedAt
									? formatSmartDateTime(performanceData.loadedAt)
									: "Loading..."}
							</Typography>
						</Box>

						<Button
							onClick={clearSmartFilters}
							disabled={activeFilterCount === 0}
							sx={secondaryButtonSx}
						>
							Clear Filters
						</Button>
					</Box>
				</Box>

				{performanceData.errors.length > 0 && (
					<Alert
						severity="warning"
						sx={performanceWarningSx}
					>
						User administration is available, but part of the performance snapshot could not be loaded. {performanceData.errors.join(" • ")}
					</Alert>
				)}

				<Box sx={tablePanelSx}>
					<Box sx={tableHeaderSx}>
						<Box>User</Box>
						<Box>Access Profile</Box>
						<Box>Plant Access</Box>
						<Box>Operational Access</Box>
						<Box>{performanceWindow.label} Tracker</Box>
						<Box>Access Health</Box>
						<Box>Status</Box>
						<Box>Actions</Box>
					</Box>

					{loading ? (
						<Box sx={loadingSx}>
							<CircularProgress />
						</Box>
					) : (
						<Box>
							{paginatedRows.map(
								(user) => (
									<UserRow
										key={user.id}
										user={user}
										plantName={
											plantName
										}
										driverName={
											driverName
										}
										performance={
											performanceByUser.get(
												normalizeUsernameKey(
													user.username
												)
											)
										}
										accessHealth={
											accessHealthByUser.get(
												String(user.id)
											)
										}
										periodLabel={performanceWindow.label}
										onPerformance={() => {
											setPerformanceUser(user);
											setPerformanceOpen(true);
										}}
										onEdit={() =>
											openEditDrawer(
												user
											)
										}
										onReset={() =>
											openResetDialog(
												user
											)
										}
										onDisable={() =>
											openDisableDialog(
												user
											)
										}
									/>
								)
							)}

							{paginatedRows.length ===
								0 && (
									<Box sx={emptyStateSx}>
										No users match the current smart filters.
									</Box>
								)}
						</Box>
					)}

					<Box sx={paginationSx}>
						<Box sx={pageSizeSx}>
							<Typography sx={mutedTextSx}>
								Rows per page
							</Typography>

							<TextField
								select
								size="small"
								value={pageSize}
								onChange={(event) => {
									setPageSize(
										Number(
											event.target
												.value
										)
									);
									setPageNo(1);
								}}
								sx={{
									...fieldSx,
									width: 92,
								}}
							>
								{PAGE_SIZE_OPTIONS.map(
									(option) => (
										<MenuItem
											key={option}
											value={option}
										>
											{option}
										</MenuItem>
									)
								)}
							</TextField>
						</Box>

						<Box sx={pageControlsSx}>
							<Button disabled={currentPage <= 1} onClick={() => setPageNo(1)} sx={pagerMiniButtonSx}>First</Button>
							<Button disabled={currentPage <= 1} onClick={() => setPageNo(currentPage - 1)} sx={pagerMiniButtonSx}>‹</Button>
							<Chip label={`Page ${currentPage} / ${totalPages}`} sx={pageChipSx} />
							<Button disabled={currentPage >= totalPages} onClick={() => setPageNo(currentPage + 1)} sx={pagerMiniButtonSx}>›</Button>
							<Button disabled={currentPage >= totalPages} onClick={() => setPageNo(totalPages)} sx={pagerMiniButtonSx}>Last</Button>
						</Box>

						<Typography sx={mutedTextSx}>
							Showing {filteredRows.length === 0
								? 0
								: (currentPage - 1) * pageSize + 1}
							–{Math.min(
								currentPage * pageSize,
								filteredRows.length
							)} of {filteredRows.length} users
						</Typography>
					</Box>
				</Box>
			</Box>

			<UserEditorDrawer
				open={drawerOpen}
				mode={drawerMode}
				form={form}
				plants={plants}
				drivers={drivers}
				saving={saving}
				onClose={closeDrawer}
				onSave={saveUser}
				onUpdate={updateForm}
				onRolesChange={
					handleRolesChange
				}
				plantName={plantName}
			/>

			<UserPerformanceDialog
				open={performanceOpen}
				user={performanceUser}
				performance={
					performanceUser
						? performanceByUser.get(
							normalizeUsernameKey(
								performanceUser.username
							)
						)
						: null
				}
				accessHealth={
					performanceUser
						? accessHealthByUser.get(
							String(performanceUser.id)
						)
						: null
				}
				periodLabel={performanceWindow.label}
				onClose={() => {
					setPerformanceOpen(false);
					setPerformanceUser(null);
				}}
			/>

			<PasswordResetDialog
				open={resetOpen}
				user={resetUser}
				password={newPassword}
				onPasswordChange={
					setNewPassword
				}
				onClose={() => {
					setResetOpen(false);
					setResetUser(null);
					setNewPassword("");
				}}
				onReset={resetPassword}
			/>

			<DisableUserDialog
				open={deleteOpen}
				user={deleteUser}
				onClose={() => {
					setDeleteOpen(false);
					setDeleteUser(null);
				}}
				onConfirm={confirmDisable}
			/>

			<Snackbar
				open={snackbar.open}
				autoHideDuration={3500}
				onClose={() =>
					setSnackbar((previous) => ({
						...previous,
						open: false,
					}))
				}
				anchorOrigin={{
					vertical: "top",
					horizontal: "center",
				}}
			>
				<Alert
					severity={
						snackbar.severity
					}
					variant="filled"
					onClose={() =>
						setSnackbar(
							(previous) => ({
								...previous,
								open: false,
							})
						)
					}
				>
					{snackbar.message}
				</Alert>
			</Snackbar>
		</Box>
	);
}

/* =========================================================
 * HEADER
 * ========================================================= */

function PageHeader({
	canOpenPackFlow,
	canOpenBOMFlow,
	canOpenMatFlow,
	canOpenMachFlow,
	onModules,
	onPackFlow,
	onBOMFlow,
	onMatFlow,
	onMachFlow,
	onLogout,
	onCreate,
}) {
	return (
		<Box sx={headerSx}>
			<Box>
				<Box sx={brandRowSx}>
					<Box sx={brandMarkSx}>
						A
					</Box>

					<Box>
						<Typography
							sx={suiteTitleSx}
						>
							FlowSuite
						</Typography>

						<Typography
							sx={suiteSubSx}
						>
							Global User & Access Control
						</Typography>
					</Box>
				</Box>

				<Typography sx={pageTitleSx}>
					Smart User Management
				</Typography>

				<Typography sx={pageSubtitleSx}>
					Create and govern users, combine PackFlow responsibilities,
					monitor access health and review recorded operational performance
					from one administrator workspace.
				</Typography>
			</Box>

			<Box sx={headerActionsSx}>
				<Button
					startIcon={<AppsIcon />}
					onClick={onModules}
					sx={secondaryButtonSx}
				>
					Modules
				</Button>

				{canOpenPackFlow && (
					<Button
						startIcon={
							<InventoryIcon />
						}
						onClick={onPackFlow}
						sx={secondaryButtonSx}
					>
						PackFlow
					</Button>
				)}

				{canOpenBOMFlow && (
					<Button
						startIcon={
							<AccountTreeOutlinedIcon />
						}
						onClick={onBOMFlow}
						sx={secondaryButtonSx}
					>
						BOMFlow
					</Button>
				)}

				{canOpenMatFlow && (
					<Button
						startIcon={
							<LayersOutlinedIcon />
						}
						onClick={onMatFlow}
						sx={secondaryButtonSx}
					>
						MatFlow
					</Button>
				)}

				{canOpenMachFlow && (
					<Button
						startIcon={
							<EngineeringOutlinedIcon />
						}
						onClick={onMachFlow}
						sx={secondaryButtonSx}
					>
						MachFlow
					</Button>
				)}

				<Button
					startIcon={
						<LogoutIcon />
					}
					onClick={onLogout}
					sx={dangerOutlineButtonSx}
				>
					Logout
				</Button>

				<Button
					startIcon={
						<AddOutlinedIcon />
					}
					onClick={onCreate}
					sx={primaryButtonSx}
				>
					Create User
				</Button>
			</Box>
		</Box>
	);
}

/* =========================================================
 * USER ROW
 * ========================================================= */

function UserRow({
	user,
	plantName,
	driverName,
	performance,
	accessHealth,
	periodLabel,
	onPerformance,
	onEdit,
	onReset,
	onDisable,
}) {
	const roles =
		userRoles(user);

	const primaryRole =
		primaryRoleFor(
			roles,
			user.role
		);

	const primaryMeta =
		roleMeta(primaryRole);

	const plants =
		userPlantCodes(user);

	const modules =
		userModules(user);

	const warehouseAccess =
		readWarehouseAccess(user);

	const enabled =
		user.enabled === true;

	const smartPerformance =
		performance || {
			packingToday: 0,
			dispatchToday: 0,
			todayOutput: 0,
			packingPeriod: 0,
			dispatchPeriod: 0,
			periodOutput: 0,
			clientsTouched: 0,
			recentActions: 0,
			stickersGenerated: 0,
			initialStickers: 0,
			reprints: 0,
			dispatchChallans: 0,
			customChallans: 0,
			dispatchItems: 0,
			activeDays: 0,
			trackedRecords: 0,
			activityScore: 0,
			activityBand: "No recorded work",
			lastActivityAt: null,
		};

	const smartAccessHealth =
		accessHealth || {
			status: "HEALTHY",
			issues: [],
		};

	return (
		<Box
			sx={{
				...tableRowSx,
				opacity: enabled ? 1 : 0.58,
			}}
		>
			<Box sx={userCellSx}>
				<Box sx={avatarSx(primaryMeta.accent)}>
					{String(
						user.username || "U"
					)
						.charAt(0)
						.toUpperCase()}
				</Box>

				<Box sx={{ minWidth: 0 }}>
					<Typography sx={usernameSx}>
						{user.username}
					</Typography>

					<Typography sx={smallMutedSx}>
						User ID: {user.id}
					</Typography>
				</Box>
			</Box>

			<Box sx={{ minWidth: 0 }}>
				<Box sx={chipWrapSx}>
					{(
						roles.length > 0
							? roles
							: [primaryRole]
					).map((assignedRole) => {
						const assignedMeta =
							roleMeta(
								assignedRole
							);

						return (
							<Chip
								key={assignedRole}
								icon={roleIcon(
									assignedRole
								)}
								label={
									assignedMeta.label
								}
								size="small"
								sx={roleChipSx(
									assignedMeta.accent
								)}
							/>
						);
					})}
				</Box>

				<Box sx={moduleChipRowSx}>
					{modules.map((module) => (
						<Chip
							key={module}
							size="small"
							label={module}
							sx={moduleChipSx}
						/>
					))}
				</Box>
			</Box>

			<Box sx={chipWrapSx}>
				{roles.includes("ADMIN") ? (
					<Chip
						label="All Plants"
						size="small"
						sx={allPlantChipSx}
					/>
				) : (
					roles.length === 1 &&
					roles.includes("DRIVER")
				) ? (
					<Chip
						label="Not Required"
						size="small"
						sx={neutralChipSx}
					/>
				) : plants.length === 0 ? (
					<Chip
						label="No Plant Assigned"
						size="small"
						sx={warningChipSx}
					/>
				) : (
					plants.map((plant) => (
						<Tooltip
							key={plant}
							title={plantName(plant)}
						>
							<Chip
								label={plant}
								size="small"
								sx={plantChipSx}
							/>
						</Tooltip>
					))
				)}
			</Box>

			<Box sx={operationalCellSx}>
				{roles.includes("DRIVER") && (
					<Chip
						label={driverName(
							user.driverId
						)}
						size="small"
						sx={driverChipSx}
					/>
				)}

				<Chip
					icon={<WarehouseOutlinedIcon />}
					label={warehouseAccess ? "Warehouse Enabled" : "No Warehouse Access"}
					size="small"
					sx={warehouseAccess ? warehouseChipSx : neutralChipSx}
				/>

				<Tooltip title={getPackFlowAccessMatrix(user).filter((item) => item.granted).map((item) => item.label).join(" • ") || "No PackFlow screen entitlement"}>
					<Chip
						icon={<VisibilityOutlinedIcon />}
						label={`${getPackFlowAccessMatrix(user).filter((item) => item.granted).length} screens`}
						size="small"
						sx={screenCountChipSx}
					/>
				</Tooltip>
			</Box>

			<Box sx={performanceCellSx}>
				<Box sx={performanceTopSx}>
					<Box>
						<Typography sx={performanceTotalSx}>
							{smartPerformance.periodOutput}
						</Typography>
						<Typography sx={performancePeriodCaptionSx}>{periodLabel || "Period"} output</Typography>
					</Box>

					<Chip
						label={`${smartPerformance.activityScore}%`}
						size="small"
						sx={performanceScoreChipSx(
							smartPerformance.activityScore
						)}
					/>
				</Box>

				<Box sx={performanceSplitSx}>
					<span>Pack <strong>{smartPerformance.packingPeriod}</strong></span>
					<span>Dispatch <strong>{smartPerformance.dispatchPeriod}</strong></span>
					<span>Sticker <strong>{smartPerformance.stickersGenerated}</strong></span>
					<span>Reprint <strong>{smartPerformance.reprints}</strong></span>
					<span>Days <strong>{smartPerformance.activeDays}</strong></span>
				</Box>

				<Typography sx={performanceBandSx}>
					{smartPerformance.activityBand}
				</Typography>

				<Typography sx={performanceLastSx}>
					{formatSmartDateTime(
						smartPerformance.lastActivityAt
					)}
				</Typography>
			</Box>

			<Box sx={accessHealthCellSx}>
				<Chip
					icon={
						smartAccessHealth.status === "HEALTHY"
							? <CheckCircleOutlineOutlinedIcon />
							: <AdminPanelSettingsIcon />
					}
					label={
						smartAccessHealth.status === "HEALTHY"
							? "Healthy"
							: `${smartAccessHealth.issues.length} Review${smartAccessHealth.issues.length === 1 ? "" : "s"}`
					}
					size="small"
					sx={
						smartAccessHealth.status === "HEALTHY"
							? accessHealthyChipSx
							: accessReviewChipSx
					}
				/>

				{smartAccessHealth.issues.length > 0 && (
					<Tooltip
						title={smartAccessHealth.issues.join(" • ")}
					>
						<Typography sx={accessIssueHintSx}>
							Review access
						</Typography>
					</Tooltip>
				)}
			</Box>

			<Box>
				<Chip
					icon={
						enabled ? (
							<CheckCircleOutlineOutlinedIcon />
						) : (
							<BlockOutlinedIcon />
						)
					}
					label={
						enabled
							? "Enabled"
							: "Disabled"
					}
					size="small"
					sx={
						enabled
							? enabledChipSx
							: disabledChipSx
					}
				/>
			</Box>

			<Box sx={actionsSx}>
				<Button
					startIcon={<InsightsOutlinedIcon />}
					onClick={onPerformance}
					sx={insightsButtonSx}
				>
					Insights
				</Button>

				<Button
					startIcon={<EditIcon />}
					onClick={onEdit}
					disabled={!enabled}
					sx={secondaryButtonSx}
				>
					Edit
				</Button>

				<Button
					startIcon={
						<LockResetIcon />
					}
					onClick={onReset}
					disabled={!enabled}
					sx={primaryButtonSx}
				>
					Reset
				</Button>

				<Button
					startIcon={<DeleteIcon />}
					onClick={onDisable}
					disabled={!enabled}
					sx={dangerButtonSx}
				>
					Disable
				</Button>
			</Box>
		</Box>
	);
}

/* =========================================================
 * USER EDITOR DRAWER
 * ========================================================= */

function UserEditorDrawer({
	open,
	mode,
	form,
	plants,
	drivers,
	saving,
	onClose,
	onSave,
	onUpdate,
	onRolesChange,
	plantName,
}) {
	const selectedRoles =
		normalizeArray(form.roles);

	const primaryRole =
		primaryRoleFor(
			selectedRoles,
			form.role
		);

	const selectedMeta =
		roleMeta(primaryRole);

	const selectedModules =
		modulesForRoles(selectedRoles);

	const requiresPlants =
		rolesRequirePlantAccess(
			selectedRoles
		);

	const requiresDriver =
		rolesRequireDriver(
			selectedRoles
		);

	const supportsWarehouse =
		rolesSupportWarehouseToggle(
			selectedRoles
		);

	const resolvedWarehouseAccess =
		resolveWarehouseAccessForRoles(
			selectedRoles,
			form.warehouseAccess
		);

	return (
		<Drawer
			anchor="right"
			open={open}
			onClose={onClose}
			PaperProps={{
				sx: drawerPaperSx,
			}}
		>
			<Box sx={drawerHeaderSx}>
				<Box>
					<Typography
						sx={drawerTitleSx}
					>
						{mode === "create"
							? "Create User"
							: "Edit User"}
					</Typography>

					<Typography sx={drawerSubSx}>
						Assign a controlled module-role
						access profile.
					</Typography>
				</Box>

				<Button
					onClick={onClose}
					disabled={saving}
					sx={closeButtonSx}
				>
					<CloseOutlinedIcon />
				</Button>
			</Box>

			<Divider sx={dividerSx} />

			<Box sx={drawerBodySx}>
				<Box sx={sectionSx}>
					<Typography
						sx={sectionTitleSx}
					>
						Account Details
					</Typography>

					<TextField
						fullWidth
						label="Username"
						value={form.username}
						onChange={(event) =>
							onUpdate(
								"username",
								event.target.value
							)
						}
						sx={fieldSx}
					/>

					{mode === "create" && (
						<TextField
							fullWidth
							label="Password"
							type="password"
							value={form.password}
							onChange={(event) =>
								onUpdate(
									"password",
									event.target
										.value
								)
							}
							helperText="Minimum 8 characters"
							sx={fieldSx}
						/>
					)}
				</Box>

				<Box sx={sectionSx}>
					<Box>
						<Typography
							sx={sectionTitleSx}
						>
							Access Profile
						</Typography>

						<Typography
							sx={sectionDescriptionSx}
						>
							Choose the module first, then
							select the user’s responsibility
							inside that module.
						</Typography>
					</Box>

					<AccessProfileSelector
						roles={selectedRoles}
						onRolesChange={
							onRolesChange
						}
					/>

					{selectedMeta.groupKey !== "ADMIN" &&
						selectedMeta.groupKey !== MODULE_KEYS.MACHFLOW && (
						<Box sx={{ mt: 1.5 }}>
							<TextField
								select
								fullWidth
								size="small"
								label="Additional MachFlow Access"
								value={selectedRoles.find((role) => roleMeta(role).groupKey === MODULE_KEYS.MACHFLOW) || ""}
								onChange={(event) => {
									const baseRoles = selectedRoles.filter((role) => roleMeta(role).groupKey !== MODULE_KEYS.MACHFLOW);
									const machRole = event.target.value;
									onRolesChange(machRole ? [...baseRoles, machRole] : baseRoles);
								}}
								helperText="Keep the user's existing FlowSuite responsibility and add one MachFlow responsibility. This avoids duplicate complainant accounts."
								sx={fieldSx}
							>
								<MenuItem value="">No additional MachFlow access</MenuItem>
								{ACCESS_GROUPS.find((group) => group.key === MODULE_KEYS.MACHFLOW)?.roles.map((roleOption) => (
									<MenuItem key={roleOption.value} value={roleOption.value}>
										<Box>
											<Typography sx={{ fontWeight: 850, fontSize: 13 }}>{roleOption.label}</Typography>
											<Typography sx={{ color: "var(--pf-text-dim)", fontSize: 11 }}>{roleOption.description}</Typography>
										</Box>
									</MenuItem>
								))}
							</TextField>
						</Box>
					)}
				</Box>

				<Box sx={accessSummarySx}>
					<Box sx={summaryIconSx(
						selectedMeta.accent
					)}>
						{accessGroupForRole(
							form.role
						)?.icon || (
								<AdminPanelSettingsIcon />
							)}
					</Box>

					<Box sx={{ minWidth: 0 }}>
						<Typography sx={summaryTitleSx}>
							{selectedRoles.length === 1
								? selectedMeta.label
								: `${selectedRoles.length} Assigned Roles`}
						</Typography>

						<Typography sx={summaryDescriptionSx}>
							{selectedRoles.length === 1
								? selectedMeta.description
								: "Combined access keeps the existing operational role profile and adds only the selected MachFlow responsibility."}
						</Typography>

						<Box sx={chipWrapSx}>
							{selectedRoles.map(
								(assignedRole) => {
									const assignedMeta =
										roleMeta(
											assignedRole
										);

									return (
										<Chip
											key={assignedRole}
											icon={roleIcon(
												assignedRole
											)}
											label={
												assignedMeta.label
											}
											size="small"
											sx={roleChipSx(
												assignedMeta.accent
											)}
										/>
									);
								}
							)}
						</Box>

						<Box sx={moduleChipRowSx}>
							{selectedModules.map((module) => (
								<Chip
									key={module}
									label={module}
									size="small"
									sx={moduleChipSx}
								/>
							))}
						</Box>
					</Box>
				</Box>

				{requiresDriver && (
					<Box sx={sectionSx}>
						<Typography
							sx={sectionTitleSx}
						>
							Driver Profile
						</Typography>

						<TextField
							select
							fullWidth
							label="Linked Driver"
							value={form.driverId}
							onChange={(event) =>
								onUpdate(
									"driverId",
									event.target
										.value
								)
							}
							sx={fieldSx}
						>
							{drivers.map(
								(driver) => (
									<MenuItem
										key={driver.id}
										value={driver.id}
									>
										{driver.phone
											? `${driver.name} • ${driver.phone}`
											: driver.name}
									</MenuItem>
								)
							)}
						</TextField>
					</Box>
				)}

				{requiresPlants && (
					<Box sx={sectionSx}>
						<Typography
							sx={sectionTitleSx}
						>
							Plant Access
						</Typography>

						<TextField
							select
							fullWidth
							label="Allowed Plants"
							value={form.plantCodes}
							onChange={(event) => {
								const value =
									event.target.value;

								onUpdate(
									"plantCodes",
									typeof value ===
										"string"
										? value.split(",")
										: value
								);
							}}
							sx={fieldSx}
							SelectProps={{
								multiple: true,
								renderValue: (
									selected
								) =>
									selected.length
										? selected.join(
											", "
										)
										: "Select plants",
							}}
						>
							{plants.map((plant) => {
								const code =
									plant.plantCode;

								return (
									<MenuItem
										key={code}
										value={code}
									>
										<Checkbox
											checked={form.plantCodes.includes(
												code
											)}
										/>

										<ListItemText
											primary={plantName(
												code
											)}
										/>
									</MenuItem>
								);
							})}
						</TextField>
					</Box>
				)}

				{supportsWarehouse && (
					<Box sx={permissionCardSx}>
						<Box>
							<Typography
								sx={permissionTitleSx}
							>
								Warehouse Page Access
							</Typography>

							<Typography
								sx={permissionSubSx}
							>
								Allow this PackFlow user to
								open warehouse screens within
								their assigned plants.
							</Typography>
						</Box>

						<Switch
							checked={
								resolvedWarehouseAccess
							}
							onChange={(event) =>
								onUpdate(
									"warehouseAccess",
									event.target
										.checked
								)
							}
						/>
					</Box>
				)}

				{(
					selectedRoles.includes("WAREHOUSE") ||
					selectedRoles.includes("DISPATCH")
				) && (
						<Alert
							severity="info"
							sx={infoAlertSx}
						>
							Warehouse page access is automatically enabled
							because Warehouse or Dispatch access is assigned.
						</Alert>
					)}

				{(
					selectedRoles.length === 1 &&
					selectedRoles.includes(
						"HARDWARE_PACKING"
					)
				) && (
						<Alert
							severity="info"
							sx={infoAlertSx}
						>
							This is a hardware-only user and remains restricted
							to their own hardware packet workspace.
						</Alert>
					)}

				{(
					selectedRoles.includes(
						"HARDWARE_PACKING"
					) &&
					selectedRoles.length > 1
				) && (
						<Alert
							severity="success"
							sx={infoAlertSx}
						>
							This user can access the hardware workspace as well
							as the other selected PackFlow responsibilities.
						</Alert>
					)}

				{selectedRoles.includes("ADMIN") && (
					<Alert
						severity="warning"
						sx={infoAlertSx}
					>
						Administrators automatically receive all modules,
						all plants and warehouse access.
					</Alert>
				)}
			</Box>

			<Box sx={drawerFooterSx}>
				<Button
					fullWidth
					onClick={onClose}
					disabled={saving}
					sx={secondaryButtonSx}
				>
					Cancel
				</Button>

				<Button
					fullWidth
					onClick={onSave}
					disabled={saving}
					sx={primaryButtonSx}
				>
					{saving
						? "Saving..."
						: mode === "create"
							? "Create User"
							: "Save Changes"}
				</Button>
			</Box>
		</Drawer>
	);
}

/* =========================================================
 * ACCESS PROFILE SELECTOR
 * ========================================================= */

function AccessProfileSelector({
	roles,
	onRolesChange,
}) {
	const selectedRoles =
		normalizeArray(roles)
			.filter((role) => ROLE_META[role]);

	const primaryRole =
		primaryRoleFor(selectedRoles);

	const selectedGroupKey =
		roleMeta(primaryRole).groupKey;

	const selectedMachRoles = selectedRoles.filter(
		(role) => roleMeta(role).groupKey === MODULE_KEYS.MACHFLOW
	);

	const selectedPackRoles = selectedRoles.filter(
		(role) => roleMeta(role).groupKey === MODULE_KEYS.PACKFLOW
	);

	const switchPrimaryGroup = (group) => {
		if (group.key === "ADMIN" || group.key === MODULE_KEYS.MACHFLOW) {
			onRolesChange([group.defaultRole]);
			return;
		}

		/* Preserve optional MachFlow responsibility while changing the user's
		 * ordinary operational profile. Other cross-module combinations stay
		 * intentionally blocked by validation. */
		onRolesChange([group.defaultRole, ...selectedMachRoles]);
	};

	return (
		<Box sx={accessGridSx}>
			{ACCESS_GROUPS.map((group) => {
				const selected = selectedGroupKey === group.key;
				const isPackFlow = group.key === MODULE_KEYS.PACKFLOW;
				const groupRole = selectedRoles.find(
					(role) => roleMeta(role).groupKey === group.key
				) || group.defaultRole;

				return (
					<Box
						key={group.key}
						role="button"
						tabIndex={0}
						onClick={() => {
							if (!selected) switchPrimaryGroup(group);
						}}
						onKeyDown={(event) => {
							if ((event.key === "Enter" || event.key === " ") && !selected) {
								switchPrimaryGroup(group);
							}
						}}
						sx={accessCardSx(group.accent, selected)}
					>
						<Box sx={accessCardHeaderSx}>
							<Box sx={accessCardIconSx(group.accent)}>{group.icon}</Box>

							<Box sx={{ minWidth: 0 }}>
								<Typography sx={accessCardTitleSx}>{group.label}</Typography>
								<Typography sx={accessCardSubSx}>{group.description}</Typography>
							</Box>

							<Box sx={selectionDotSx(group.accent, selected)}>{selected ? "✓" : ""}</Box>
						</Box>

						{selected && isPackFlow && (
							<TextField
								select
								fullWidth
								size="small"
								label="PackFlow Roles"
								value={selectedPackRoles}
								onClick={(event) => event.stopPropagation()}
								onChange={(event) => {
									const value = event.target.value;
									const nextPackRoles = typeof value === "string" ? value.split(",") : value;
									onRolesChange([...nextPackRoles, ...selectedMachRoles]);
								}}
								SelectProps={{
									multiple: true,
									renderValue: (selectedValues) =>
										selectedValues.map((value) => roleMeta(value).label).join(", "),
								}}
								sx={{ ...fieldSx, mt: 1.5 }}
							>
								{group.roles.map((roleOption) => {
									const checked = selectedPackRoles.includes(roleOption.value);
									return (
										<MenuItem key={roleOption.value} value={roleOption.value}>
											<Checkbox checked={checked} />
											<ListItemText primary={roleOption.label} secondary={roleOption.description} />
										</MenuItem>
									);
								})}
							</TextField>
						)}

						{selected && !isPackFlow && (
							<TextField
								select
								fullWidth
								size="small"
								label="Role"
								value={groupRole}
								onClick={(event) => event.stopPropagation()}
								onChange={(event) => {
									const nextRole = event.target.value;
									onRolesChange(
										group.key === MODULE_KEYS.MACHFLOW
											? [nextRole]
											: [nextRole, ...selectedMachRoles]
									);
								}}
								sx={{ ...fieldSx, mt: 1.5 }}
							>
								{group.roles.map((roleOption) => (
									<MenuItem key={roleOption.value} value={roleOption.value}>
										<Box>
											<Typography sx={{ fontWeight: 850, fontSize: 13 }}>{roleOption.label}</Typography>
											<Typography sx={{ color: "var(--pf-text-dim)", fontSize: 11 }}>{roleOption.description}</Typography>
										</Box>
									</MenuItem>
								))}
							</TextField>
						)}
					</Box>
				);
			})}
		</Box>
	);
}

function SmartFilterSelect({
	label,
	value,
	onChange,
	options = [],
}) {
	return (
		<TextField
			select
			size="small"
			label={label}
			value={value}
			onChange={(event) =>
				onChange(
					event.target.value
				)
			}
			sx={fieldSx}
		>
			{options.map(
				([optionValue, optionLabel]) => (
					<MenuItem
						key={optionValue}
						value={optionValue}
					>
						{optionLabel}
					</MenuItem>
				)
			)}
		</TextField>
	);
}

function UserPerformanceDialog({
	open,
	user,
	performance,
	accessHealth,
	periodLabel,
	onClose,
}) {
	if (!user) {
		return null;
	}

	const roles =
		userRoles(user);

	const modules =
		userModules(user);

	const plants =
		userPlantCodes(user);

	const data =
		performance || {
			packingToday: 0,
			dispatchToday: 0,
			todayOutput: 0,
			packingPeriod: 0,
			dispatchPeriod: 0,
			periodOutput: 0,
			clientsTouched: 0,
			recentActions: 0,
			packingActions: 0,
			dispatchActions: 0,
			movementActions: 0,
			controlActions: 0,
			otherActions: 0,
			stickersGenerated: 0,
			initialStickers: 0,
			reprints: 0,
			dispatchChallans: 0,
			customChallans: 0,
			dispatchItems: 0,
			activeDays: 0,
			trackedRecords: 0,
			activityScore: 0,
			activityBand: "No recorded work",
			lastActivityAt: null,
			recentRows: [],
		};

	const health =
		accessHealth || {
			status: "HEALTHY",
			issues: [],
		};

	return (
		<Dialog
			open={open}
			onClose={onClose}
			fullWidth
			maxWidth="lg"
			PaperProps={{
				sx: performanceDialogPaperSx,
			}}
		>
			<DialogTitle sx={performanceDialogTitleSx}>
				<Box sx={performanceDialogTitleRowSx}>
					<Box sx={performanceDialogIdentitySx}>
						<Box sx={performanceAvatarSx}>
							{String(
								user.username || "U"
							)
								.charAt(0)
								.toUpperCase()}
						</Box>

						<Box>
							<Typography sx={performanceDialogNameSx}>
								{user.username}
							</Typography>

							<Typography sx={performanceDialogSubSx}>
								PackFlow activity, access and traceability intelligence
							</Typography>
						</Box>
					</Box>

					<Button
						onClick={onClose}
						sx={closeButtonSx}
					>
						<CloseOutlinedIcon />
					</Button>
				</Box>
			</DialogTitle>

			<DialogContent sx={performanceDialogContentSx}>
				<Box sx={performanceHeroGridSx}>
					<PerformanceMetricCard
						label={`${periodLabel || "Period"} Output`}
						value={data.periodOutput}
						detail={`${data.packingPeriod} packed • ${data.dispatchPeriod} dispatched • ${data.clientsTouched} clients`}
						accent="#3b82f6"
					/>

					<PerformanceMetricCard
						label="Activity Index"
						value={`${data.activityScore}%`}
						detail={data.activityBand}
						accent="#22c55e"
					/>

					<PerformanceMetricCard
						label="Active Days"
						value={data.activeDays}
						detail={`${data.recentActions} tracked activity events`}
						accent="#a78bfa"
					/>

					<PerformanceMetricCard
						label="Access Health"
						value={
							health.status === "HEALTHY"
								? "Healthy"
								: `${health.issues.length} review${health.issues.length === 1 ? "" : "s"}`
						}
						detail={
							health.status === "HEALTHY"
								? "Role and module assignment is consistent"
								: "Review access configuration"
						}
						accent={
							health.status === "HEALTHY"
								? "#14b8a6"
								: "#f59e0b"
						}
					/>
				</Box>

				<Box sx={performanceSectionGridSx}>
					<Box sx={performanceSectionCardSx}>
						<Typography sx={performanceSectionTitleSx}>
							Access Profile
						</Typography>

						<Box sx={chipWrapSx}>
							{roles.map((role) => (
								<Chip
									key={role}
									label={roleMeta(role).label}
									size="small"
									sx={roleChipSx(
										roleMeta(role).accent
									)}
								/>
							))}
						</Box>

						<Box sx={performanceAccessListSx}>
							<div>
								<span>Modules</span>
								<strong>{modules.join(", ") || "None"}</strong>
							</div>

							<div>
								<span>Plants</span>
								<strong>{roles.includes("ADMIN") ? "All Plants" : plants.join(", ") || "None"}</strong>
							</div>

							<div>
								<span>Warehouse</span>
								<strong>{readWarehouseAccess(user) ? "Enabled" : "Not enabled"}</strong>
							</div>

							<div>
								<span>Last Activity</span>
								<strong>{formatSmartDateTime(data.lastActivityAt)}</strong>
							</div>
						</Box>

						<Typography sx={{ ...performanceSectionTitleSx, mt: 1.4 }}>Effective PackFlow Screens</Typography>
						<Box sx={effectiveScreensGridSx}>
							{getPackFlowAccessMatrix(user).map((screen) => (
								<Chip
									key={screen.key}
									icon={screen.granted ? <VerifiedUserOutlinedIcon /> : <BlockOutlinedIcon />}
									label={screen.label}
									size="small"
									sx={effectiveScreenChipSx(screen.granted)}
								/>
							))}
						</Box>
					</Box>

					<Box sx={performanceSectionCardSx}>
						<Typography sx={performanceSectionTitleSx}>
							PackFlow Operational Record
						</Typography>

						<Box sx={performanceMixGridSx}>
							<PerformanceMixItem label="Packed" value={data.packingPeriod} accent="#22c55e" />
							<PerformanceMixItem label="Dispatched" value={data.dispatchPeriod} accent="#f97316" />
							<PerformanceMixItem label="Clients" value={data.clientsTouched} accent="#14b8a6" />
							<PerformanceMixItem label="Stickers" value={data.stickersGenerated} accent="#22c55e" />
							<PerformanceMixItem label="Initial" value={data.initialStickers} accent="#38bdf8" />
							<PerformanceMixItem label="Reprints" value={data.reprints} accent="#f59e0b" />
							<PerformanceMixItem label="Dispatch Items" value={data.dispatchItems} accent="#f97316" />
							<PerformanceMixItem label="Std. Challans" value={data.dispatchChallans} accent="#a78bfa" />
							<PerformanceMixItem label="Custom Challans" value={data.customChallans} accent="#ec4899" />
							<PerformanceMixItem label="Movement Events" value={data.movementActions} accent="#06b6d4" />
							<PerformanceMixItem label="Control Events" value={data.controlActions} accent="#8b5cf6" />
						</Box>

						<Typography sx={performanceNoteSx}>
							Activity Index is a relative operational index built from recorded PackFlow records, activity events and active days for the selected period. It is not an attendance, quality or HR rating.
						</Typography>
					</Box>
				</Box>

				{health.issues.length > 0 && (
					<Box sx={performanceReviewCardSx}>
						<Typography sx={performanceSectionTitleSx}>
							Access Review Required
						</Typography>

						{health.issues.map((issue) => (
							<Box
								key={issue}
								sx={performanceIssueRowSx}
							>
								<span>!</span>
								{issue}
							</Box>
						))}
					</Box>
				)}

				<Box sx={performanceRecentCardSx}>
					<Box sx={performanceRecentHeaderSx}>
						<Typography sx={performanceSectionTitleSx}>
							Recent Recorded Actions
						</Typography>

						<Chip
							label={`${data.recentRows?.length || 0} shown`}
							size="small"
							sx={moduleChipSx}
						/>
					</Box>

					{(!data.recentRows || data.recentRows.length === 0) ? (
						<Box sx={performanceEmptySx}>
							No recent activity was found in the loaded snapshot.
						</Box>
					) : (
						<Box sx={performanceRecentListSx}>
							{data.recentRows.map((row, index) => (
								<Box
									key={`${performanceAction(row)}-${index}`}
									sx={performanceRecentRowSx}
								>
									<Box sx={performanceRecentDotSx(
										performanceCategory(row)
									)} />

									<Box sx={{ minWidth: 0 }}>
										<Typography sx={performanceRecentActionSx}>
											{performanceAction(row)}
										</Typography>

										<Typography sx={performanceRecentMetaSx}>
											{formatSmartDateTime(performanceTimestamp(row))}
										</Typography>
									</Box>
								</Box>
							))}
						</Box>
					)}
				</Box>
			</DialogContent>

			<DialogActions sx={dialogActionsSx}>
				<Button
					onClick={onClose}
					sx={primaryButtonSx}
				>
					Close Insights
				</Button>
			</DialogActions>
		</Dialog>
	);
}

function PerformanceMetricCard({
	label,
	value,
	detail,
	accent,
}) {
	return (
		<Box sx={performanceMetricCardSx(accent)}>
			<Typography sx={performanceMetricLabelSx}>
				{label}
			</Typography>

			<Typography sx={performanceMetricValueSx}>
				{value}
			</Typography>

			<Typography sx={performanceMetricDetailSx}>
				{detail}
			</Typography>
		</Box>
	);
}

function PerformanceMixItem({
	label,
	value,
	accent,
}) {
	return (
		<Box sx={performanceMixItemSx(accent)}>
			<span>{label}</span>
			<strong>{value}</strong>
		</Box>
	);
}

/* =========================================================
 * DIALOGS
 * ========================================================= */

function PasswordResetDialog({
	open,
	user,
	password,
	onPasswordChange,
	onClose,
	onReset,
}) {
	return (
		<Dialog
			open={open}
			onClose={onClose}
			PaperProps={{
				sx: dialogPaperSx,
			}}
		>
			<DialogTitle>
				Reset Password
			</DialogTitle>

			<DialogContent>
				<Typography sx={dialogTextSx}>
					Set a new password for{" "}
					<strong>
						{user?.username || "this user"}
					</strong>
					.
				</Typography>

				<TextField
					fullWidth
					type="password"
					label="New Password"
					value={password}
					onChange={(event) =>
						onPasswordChange(
							event.target.value
						)
					}
					helperText="Minimum 8 characters"
					sx={{
						...fieldSx,
						mt: 2,
					}}
				/>
			</DialogContent>

			<DialogActions sx={dialogActionsSx}>
				<Button
					onClick={onClose}
					sx={secondaryButtonSx}
				>
					Cancel
				</Button>

				<Button
					onClick={onReset}
					sx={primaryButtonSx}
				>
					Reset Password
				</Button>
			</DialogActions>
		</Dialog>
	);
}

function DisableUserDialog({
	open,
	user,
	onClose,
	onConfirm,
}) {
	return (
		<Dialog
			open={open}
			onClose={onClose}
			PaperProps={{
				sx: dialogPaperSx,
			}}
		>
			<DialogTitle>
				Disable User
			</DialogTitle>

			<DialogContent>
				<Typography sx={dialogTextSx}>
					Disable{" "}
					<strong>
						{user?.username || "this user"}
					</strong>
					? Their existing session will stop
					working after the backend security update.
				</Typography>
			</DialogContent>

			<DialogActions sx={dialogActionsSx}>
				<Button
					onClick={onClose}
					sx={secondaryButtonSx}
				>
					Cancel
				</Button>

				<Button
					onClick={onConfirm}
					sx={dangerButtonSx}
				>
					Disable User
				</Button>
			</DialogActions>
		</Dialog>
	);
}

/* =========================================================
 * SMALL COMPONENTS
 * ========================================================= */

function StatCard({
	label,
	value,
	accent,
	icon,
}) {
	return (
		<Box sx={statCardSx(accent)}>
			<Box sx={statIconSx(accent)}>
				{icon}
			</Box>

			<Box>
				<Typography sx={statLabelSx}>
					{label}
				</Typography>

				<Typography sx={statValueSx}>
					{value}
				</Typography>
			</Box>
		</Box>
	);
}

function roleIcon(role) {
	const cleanRole =
		normalizeRole(role);

	if (cleanRole === "ADMIN") {
		return (
			<AdminPanelSettingsIcon />
		);
	}

	if (
		cleanRole.startsWith(
			"BOMFLOW_"
		)
	) {
		return (
			<AccountTreeOutlinedIcon />
		);
	}

	if (
		cleanRole.startsWith(
			"MACHFLOW_"
		)
	) {
		return <EngineeringOutlinedIcon />;
	}

	if (
		cleanRole.startsWith(
			"MATFLOW_"
		)
	) {
		if (
			cleanRole ===
			"MATFLOW_ENGINEERING"
		) {
			return <EngineeringOutlinedIcon />;
		}

		if (
			cleanRole ===
			"MATFLOW_STORE"
		) {
			return <StorefrontOutlinedIcon />;
		}

		if (
			cleanRole ===
			"MATFLOW_PURCHASE"
		) {
			return <ShoppingCartOutlinedIcon />;
		}

		if (
			cleanRole ===
			"MATFLOW_PRODUCTION"
		) {
			return (
				<PrecisionManufacturingOutlinedIcon />
			);
		}

		if (
			cleanRole ===
			"MATFLOW_QC"
		) {
			return <FactCheckOutlinedIcon />;
		}

		if (
			cleanRole ===
			"MATFLOW_DIRECTOR"
		) {
			return <GavelOutlinedIcon />;
		}

		return <LayersOutlinedIcon />;
	}

	if (
		[
			"DISPATCH",
			"LOGISTICS",
			"DRIVER",
		].includes(cleanRole)
	) {
		return <LocalShippingIcon />;
	}

	return <InventoryIcon />;
}

/* =========================================================
 * STYLES
 * ========================================================= */

const pageSx = {
	minHeight: "100vh",
	background: `
		radial-gradient(circle at top left, rgba(59,130,246,.14), transparent 24%),
		radial-gradient(circle at bottom right, rgba(20,184,166,.10), transparent 24%),
		linear-gradient(135deg,var(--pf-bg) 0%,var(--pf-surface) 48%,var(--pf-surface-alt) 100%)
	`,
	color: "var(--pf-text-strong)",
};

const contentSx = {
	width: "100%",
	maxWidth: 1600,
	mx: "auto",
	p: {
		xs: 2,
		md: 3,
	},
	display: "flex",
	flexDirection: "column",
	gap: 2,
	boxSizing: "border-box",
};

const headerSx = {
	p: {
		xs: 2,
		md: 3,
	},
	borderRadius: "24px",
	display: "flex",
	justifyContent: "space-between",
	alignItems: "flex-start",
	gap: 2,
	flexWrap: "wrap",
	background:
		"linear-gradient(180deg, rgba(var(--pf-surface-rgb),.94), rgba(var(--pf-surface-rgb),.82))",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.08)",
	boxShadow:
		"0 28px 70px rgba(2,6,23,.38)",
};

const brandRowSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.5,
	mb: 2,
};

const brandMarkSx = {
	width: 46,
	height: 46,
	borderRadius: "14px",
	display: "grid",
	placeItems: "center",
	background:
		"linear-gradient(135deg,#2563eb,#3b82f6)",
	fontWeight: 950,
	fontSize: 18,
	boxShadow:
		"0 12px 28px rgba(37,99,235,.35)",
};

const suiteTitleSx = {
	fontSize: 17,
	fontWeight: 950,
};

const suiteSubSx = {
	mt: 0.3,
	color: "rgba(var(--pf-fg-rgb),.52)",
	fontSize: 11.5,
	fontWeight: 700,
};

const pageTitleSx = {
	fontSize: {
		xs: 25,
		md: 34,
	},
	fontWeight: 950,
	letterSpacing: "-.04em",
};

const pageSubtitleSx = {
	mt: 0.8,
	maxWidth: 760,
	color: "rgba(var(--pf-fg-rgb),.62)",
	fontSize: 13,
	fontWeight: 650,
	lineHeight: 1.6,
};

const headerActionsSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "flex-end",
	gap: 1,
	flexWrap: "wrap",
};

const breadcrumbSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 1.5,
	flexWrap: "wrap",
	px: 0.5,
};

const breadcrumbTextSx = {
	color: "var(--pf-text-muted)",
	fontSize: 12.5,
	fontWeight: 750,
};

const adminAccessChipSx = {
	color: "#fbbf24",
	background: "rgba(245,158,11,.12)",
	border:
		"1px solid rgba(245,158,11,.24)",
	fontWeight: 900,
};

const statsGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		sm: "repeat(2,minmax(0,1fr))",
		lg: "repeat(4,minmax(0,1fr))",
	},
	gap: 1.2,
};

const statCardSx = (accent) => ({
	p: 1.6,
	minHeight: 78,
	borderRadius: "16px",
	display: "flex",
	alignItems: "center",
	gap: 1.3,
	background:
		"linear-gradient(180deg,rgba(var(--pf-surface-raised-rgb),.76),rgba(var(--pf-surface-rgb),.80))",
	border: `1px solid ${accent}30`,
	boxShadow:
		"0 16px 32px rgba(2,6,23,.28)",
});

const statIconSx = (accent) => ({
	width: 40,
	height: 40,
	borderRadius: "12px",
	display: "grid",
	placeItems: "center",
	color: accent,
	background: `${accent}16`,
	border: `1px solid ${accent}30`,
});

const statLabelSx = {
	color: "rgba(var(--pf-fg-rgb),.58)",
	fontSize: 10.5,
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".06em",
};

const statValueSx = {
	mt: 0.3,
	fontSize: 23,
	fontWeight: 950,
	lineHeight: 1,
};

const searchPanelSx = {
	p: 1.2,
	borderRadius: "18px",
	display: "flex",
	alignItems: "center",
	gap: 1.2,
	background: "rgba(var(--pf-surface-rgb),.78)",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.07)",
	boxShadow:
		"0 18px 38px rgba(2,6,23,.28)",
};

const smartControlPanelSx = {
	p: 1.5,
	borderRadius: "20px",
	background:
		"radial-gradient(circle at top left,rgba(59,130,246,.10),transparent 35%),linear-gradient(180deg,rgba(var(--pf-surface-rgb),.88),rgba(var(--pf-surface-deep-rgb),.68))",
	border:
		"1px solid rgba(96,165,250,.10)",
	boxShadow:
		"0 18px 42px rgba(2,6,23,.28)",
};

const smartControlHeaderSx = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "flex-start",
	gap: 2,
	flexWrap: "wrap",
};

const smartControlEyebrowSx = {
	color: "#60a5fa",
	fontSize: 10,
	fontWeight: 950,
	letterSpacing: ".11em",
};

const smartControlTitleSx = {
	mt: 0.3,
	fontSize: 20,
	fontWeight: 950,
	color: "var(--pf-text-strong)",
};

const smartControlSubSx = {
	mt: 0.4,
	maxWidth: 850,
	color: "var(--pf-text-muted)",
	fontSize: 12,
	fontWeight: 650,
	lineHeight: 1.5,
};

const smartControlActionsSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	flexWrap: "wrap",
};

const smartSearchRowSx = {
	mt: 1.3,
};

const smartFiltersGridSx = {
	mt: 1.1,
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		sm: "repeat(2,minmax(0,1fr))",
		lg: "repeat(5,minmax(0,1fr))",
	},
	gap: 1,
};

const smartFilterFooterSx = {
	mt: 1.1,
	pt: 1,
	borderTop:
		"1px solid rgba(148,163,184,.07)",
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	gap: 1,
	flexWrap: "wrap",
};

const smartFilterSummarySx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	flexWrap: "wrap",
};

const smartFilterChipSx = {
	height: 23,
	color: "#93c5fd",
	background: "rgba(59,130,246,.10)",
	border:
		"1px solid rgba(96,165,250,.16)",
	fontWeight: 900,
	fontSize: 9.5,
};

const smartLoadedAtSx = {
	color: "var(--pf-text-dim)",
	fontSize: 10.5,
	fontWeight: 700,
};

const performanceWarningSx = {
	borderRadius: "14px",
	background: "rgba(245,158,11,.08)",
	border:
		"1px solid rgba(245,158,11,.18)",
	color: "#fde68a",
};

const performanceCellSx = {
	minWidth: 0,
	padding: "7px 8px",
	borderRadius: "11px",
	background: "rgba(var(--pf-surface-deep-rgb),.25)",
	border:
		"1px solid rgba(148,163,184,.06)",
};

const performanceTopSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 1,
};

const performanceTotalSx = {
	fontSize: 20,
	fontWeight: 950,
	color: "var(--pf-text-strong)",
	lineHeight: 1,
};

const performanceScoreChipSx = (score) => {
	const accent =
		score >= 80
			? "#22c55e"
			: score >= 50
				? "#3b82f6"
				: score > 0
					? "#f59e0b"
					: "#64748b";

	return {
		height: 21,
		color: accent,
		background: `${accent}14`,
		border: `1px solid ${accent}2b`,
		fontWeight: 950,
		fontSize: 9,
	};
};

const performanceSplitSx = {
	mt: 0.6,
	display: "flex",
	gap: 1,
	flexWrap: "wrap",
	color: "var(--pf-text-muted)",
	fontSize: 9.5,
	fontWeight: 700,
};

const performanceBandSx = {
	mt: 0.4,
	color: "var(--pf-text-soft)",
	fontSize: 9.5,
	fontWeight: 850,
};

const performanceLastSx = {
	mt: 0.25,
	color: "var(--pf-text-dim)",
	fontSize: 8.8,
	fontWeight: 650,
};

const accessHealthCellSx = {
	display: "flex",
	flexDirection: "column",
	alignItems: "flex-start",
	gap: 0.5,
};

const accessHealthyChipSx = {
	height: 24,
	color: "#4ade80",
	background: "rgba(34,197,94,.10)",
	border:
		"1px solid rgba(34,197,94,.20)",
	fontWeight: 900,
	fontSize: 9.5,
	"& .MuiChip-icon": {
		color: "#4ade80",
	},
};

const accessReviewChipSx = {
	height: 24,
	color: "#fbbf24",
	background: "rgba(245,158,11,.10)",
	border:
		"1px solid rgba(245,158,11,.20)",
	fontWeight: 900,
	fontSize: 9.5,
	"& .MuiChip-icon": {
		color: "#fbbf24",
	},
};

const accessIssueHintSx = {
	color: "#fcd34d",
	fontSize: 9,
	fontWeight: 750,
	cursor: "help",
};

const insightsButtonSx = {
	minHeight: 36,
	borderRadius: "11px",
	px: 1.35,
	textTransform: "none",
	fontWeight: 850,
	color: "#bfdbfe",
	background: "rgba(59,130,246,.08)",
	border:
		"1px solid rgba(96,165,250,.16)",
	"&:hover": {
		background:
			"rgba(59,130,246,.15)",
		borderColor:
			"rgba(96,165,250,.30)",
	},
};

const reportButtonSx = {
	minHeight: 38,
	borderRadius: "12px",
	px: 1.6,
	textTransform: "none",
	fontWeight: 900,
	color: "#bbf7d0",
	background: "rgba(34,197,94,.08)",
	border: "1px solid rgba(34,197,94,.20)",
	"&:hover": {
		background: "rgba(34,197,94,.14)",
		borderColor: "rgba(34,197,94,.34)",
	},
};

const intelligenceToolbarSx = {
	mt: 1.3,
	p: 1,
	borderRadius: "14px",
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 1,
	flexWrap: "wrap",
	background: "rgba(var(--pf-surface-deep-rgb),.34)",
	border: "1px solid rgba(148,163,184,.08)",
};

const intelligenceToolbarGroupSx = {
	display: "flex",
	alignItems: "center",
	gap: 0.8,
	flexWrap: "wrap",
};

const intelligenceToolbarLabelSx = {
	color: "var(--pf-text-muted)",
	fontSize: 10.5,
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".05em",
};

const dataSourceHealthSx = {
	display: "flex",
	alignItems: "center",
	gap: 0.55,
	flexWrap: "wrap",
	maxWidth: 650,
};

const sourceHealthChipSx = (ok) => ({
	height: 22,
	fontSize: 9,
	fontWeight: 900,
	textTransform: "capitalize",
	color: ok ? "#86efac" : "#fca5a5",
	background: ok ? "rgba(34,197,94,.08)" : "rgba(239,68,68,.08)",
	border: `1px solid ${ok ? "rgba(34,197,94,.18)" : "rgba(239,68,68,.18)"}`,
});

const screenCountChipSx = {
	height: 24,
	color: "#93c5fd",
	background: "rgba(59,130,246,.08)",
	border: "1px solid rgba(96,165,250,.16)",
	fontWeight: 900,
	fontSize: 9.5,
	"& .MuiChip-icon": { color: "#60a5fa" },
};

const performancePeriodCaptionSx = {
	mt: 0.25,
	color: "var(--pf-text-dim)",
	fontSize: 8.5,
	fontWeight: 800,
	textTransform: "uppercase",
	letterSpacing: ".05em",
};

const pagerMiniButtonSx = {
	minWidth: 38,
	height: 34,
	borderRadius: "10px",
	px: 1,
	textTransform: "none",
	fontWeight: 900,
	color: "var(--pf-text-soft)",
	background: "rgba(var(--pf-fg-rgb),.035)",
	border: "1px solid rgba(148,163,184,.12)",
	"&:hover": {
		background: "rgba(59,130,246,.12)",
		borderColor: "rgba(96,165,250,.24)",
	},
};

const effectiveScreensGridSx = {
	mt: 0.8,
	display: "flex",
	gap: 0.6,
	flexWrap: "wrap",
};

const effectiveScreenChipSx = (granted) => ({
	height: 24,
	fontSize: 9.2,
	fontWeight: 850,
	color: granted ? "#86efac" : "var(--pf-text-muted)",
	background: granted ? "rgba(34,197,94,.08)" : "rgba(100,116,139,.07)",
	border: `1px solid ${granted ? "rgba(34,197,94,.18)" : "rgba(100,116,139,.14)"}`,
	"& .MuiChip-icon": { color: granted ? "#4ade80" : "var(--pf-text-dim)" },
});

const tablePanelSx = {
	borderRadius: "22px",
	background:
		"linear-gradient(180deg,rgba(var(--pf-surface-rgb),.94),rgba(var(--pf-surface-alt-rgb),.92))",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.07)",
	boxShadow:
		"0 24px 64px rgba(2,6,23,.34)",
	overflowX: "auto",
	scrollbarWidth: "thin",
	scrollbarColor:
		"rgba(96,165,250,.72) rgba(var(--pf-surface-rgb),.35)",
	"&::-webkit-scrollbar": {
		height: 10,
	},
	"&::-webkit-scrollbar-track": {
		background: "rgba(var(--pf-surface-rgb),.35)",
		borderRadius: 999,
	},
	"&::-webkit-scrollbar-thumb": {
		background:
			"linear-gradient(90deg,#334155,#3b82f6,#60a5fa)",
		borderRadius: 999,
		border: "2px solid #0f172a",
	},
};

const tableHeaderSx = {
	minWidth: 1780,
	display: "grid",
	gridTemplateColumns:
		"1.05fr 1.35fr 1fr 1.15fr 1.25fr .85fr .62fr 390px",
	gap: 2,
	alignItems: "center",
	p: "15px 20px",
	color: "#93c5fd",
	background: "rgba(var(--pf-surface-deep-rgb),.34)",
	borderBottom:
		"1px solid rgba(var(--pf-fg-rgb),.08)",
	fontSize: 10.5,
	fontWeight: 950,
	textTransform: "uppercase",
	letterSpacing: ".07em",
};

const tableRowSx = {
	minWidth: 1780,
	display: "grid",
	gridTemplateColumns:
		"1.05fr 1.35fr 1fr 1.15fr 1.25fr .85fr .62fr 390px",
	gap: 2,
	alignItems: "center",
	p: "15px 20px",
	borderBottom:
		"1px solid rgba(var(--pf-fg-rgb),.06)",
	transition: "background .2s ease",

	"&:hover": {
		background:
			"rgba(59,130,246,.055)",
	},
};

const userCellSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.2,
	minWidth: 0,
};

const avatarSx = (accent) => ({
	width: 38,
	height: 38,
	borderRadius: "12px",
	display: "grid",
	placeItems: "center",
	background: `${accent}22`,
	color: accent,
	border: `1px solid ${accent}35`,
	fontWeight: 950,
	flexShrink: 0,
});

const usernameSx = {
	color: "var(--pf-text-strong)",
	fontSize: 13.5,
	fontWeight: 900,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const smallMutedSx = {
	mt: 0.3,
	color: "rgba(var(--pf-fg-rgb),.42)",
	fontSize: 10.5,
	fontWeight: 650,
};

const chipWrapSx = {
	display: "flex",
	gap: 0.6,
	flexWrap: "wrap",
	alignItems: "center",
};

const operationalCellSx = {
	display: "flex",
	alignItems: "center",
	gap: 0.6,
	flexWrap: "wrap",
	minWidth: 0,
};

const actionsSx = {
	display: "flex",
	gap: 0.7,
	alignItems: "center",
	flexWrap: "nowrap",

	"& .MuiButton-root": {
		minWidth: "auto",
		whiteSpace: "nowrap",
		fontSize: 11,
	},
};

const moduleChipRowSx = {
	mt: 0.7,
	display: "flex",
	gap: 0.5,
	flexWrap: "wrap",
};

const moduleChipSx = {
	height: 20,
	color: "#7dd3fc",
	background: "rgba(14,165,233,.12)",
	border:
		"1px solid rgba(14,165,233,.24)",
	fontWeight: 900,
	fontSize: 9.5,
};

const roleChipSx = (accent) => ({
	height: 27,
	color: accent,
	background: `${accent}17`,
	border: `1px solid ${accent}32`,
	fontWeight: 900,
	fontSize: 10.5,

	"& .MuiChip-icon": {
		color: accent,
	},
});

const plantChipSx = {
	height: 23,
	color: "#93c5fd",
	background: "rgba(59,130,246,.12)",
	border:
		"1px solid rgba(59,130,246,.22)",
	fontWeight: 850,
	fontSize: 10,
};

const allPlantChipSx = {
	...plantChipSx,
	color: "#4ade80",
	background: "rgba(34,197,94,.12)",
	border:
		"1px solid rgba(34,197,94,.22)",
};

const neutralChipSx = {
	height: 23,
	color: "var(--pf-text-muted)",
	background: "rgba(148,163,184,.09)",
	border:
		"1px solid rgba(148,163,184,.14)",
	fontWeight: 800,
	fontSize: 10,

	"& .MuiChip-icon": {
		color: "var(--pf-text-muted)",
	},
};

const warningChipSx = {
	height: 23,
	color: "#fbbf24",
	background: "rgba(245,158,11,.12)",
	border:
		"1px solid rgba(245,158,11,.22)",
	fontWeight: 850,
	fontSize: 10,
};

const warehouseChipSx = {
	height: 23,
	color: "#fbbf24",
	background: "rgba(245,158,11,.12)",
	border:
		"1px solid rgba(245,158,11,.22)",
	fontWeight: 850,
	fontSize: 10,

	"& .MuiChip-icon": {
		color: "#fbbf24",
	},
};

const driverChipSx = {
	height: 23,
	color: "#6ee7b7",
	background: "rgba(16,185,129,.12)",
	border:
		"1px solid rgba(16,185,129,.22)",
	fontWeight: 850,
	fontSize: 10,
};

const enabledChipSx = {
	height: 24,
	color: "#4ade80",
	background: "rgba(34,197,94,.12)",
	border:
		"1px solid rgba(34,197,94,.22)",
	fontWeight: 900,
	fontSize: 10,

	"& .MuiChip-icon": {
		color: "#4ade80",
	},
};

const disabledChipSx = {
	height: 24,
	color: "#f87171",
	background: "rgba(239,68,68,.12)",
	border:
		"1px solid rgba(239,68,68,.22)",
	fontWeight: 900,
	fontSize: 10,

	"& .MuiChip-icon": {
		color: "#f87171",
	},
};

const loadingSx = {
	minWidth: 1660,
	minHeight: 340,
	display: "grid",
	placeItems: "center",

	"& .MuiCircularProgress-root": {
		color: "#60a5fa",
	},
};

const emptyStateSx = {
	minWidth: 1660,
	p: 5,
	textAlign: "center",
	color: "var(--pf-text-muted)",
	fontWeight: 750,
};

const paginationSx = {
	minWidth: 1400,
	p: 1.5,
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 2,
	flexWrap: "wrap",
	background: "rgba(var(--pf-surface-deep-rgb),.26)",
};

const pageSizeSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
};

const pageControlsSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
};

const pageChipSx = {
	color: "var(--pf-text-soft)",
	background: "rgba(var(--pf-fg-rgb),.05)",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.08)",
	fontWeight: 850,
};

const mutedTextSx = {
	color: "var(--pf-text-muted)",
	fontSize: 11.5,
	fontWeight: 750,
};

const primaryButtonSx = {
	minHeight: 36,
	borderRadius: "11px",
	px: 1.6,
	textTransform: "none",
	fontWeight: 850,
	color: "#fff",
	background:
		"linear-gradient(135deg,#2563eb,#3b82f6)",
	border:
		"1px solid rgba(59,130,246,.34)",
	boxShadow:
		"0 8px 20px rgba(37,99,235,.24)",

	"&:hover": {
		background:
			"linear-gradient(135deg,#1d4ed8,#2563eb)",
	},

	"&.Mui-disabled": {
		color: "rgba(var(--pf-fg-rgb),.28)",
		background: "rgba(var(--pf-fg-rgb),.04)",
	},
};

const secondaryButtonSx = {
	minHeight: 36,
	borderRadius: "11px",
	px: 1.5,
	textTransform: "none",
	fontWeight: 800,
	color: "var(--pf-text-soft)",
	background: "rgba(var(--pf-fg-rgb),.04)",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.08)",

	"&:hover": {
		background:
			"rgba(59,130,246,.12)",
		borderColor:
			"rgba(59,130,246,.28)",
	},

	"&.Mui-disabled": {
		color: "rgba(var(--pf-fg-rgb),.25)",
	},
};

const dangerButtonSx = {
	minHeight: 36,
	borderRadius: "11px",
	px: 1.5,
	textTransform: "none",
	fontWeight: 850,
	color: "#fff",
	background:
		"linear-gradient(135deg,#dc2626,#ef4444)",
	boxShadow:
		"0 8px 20px rgba(239,68,68,.22)",

	"&:hover": {
		background:
			"linear-gradient(135deg,#b91c1c,#dc2626)",
	},

	"&.Mui-disabled": {
		color: "rgba(var(--pf-fg-rgb),.25)",
		background: "rgba(var(--pf-fg-rgb),.04)",
	},
};

const dangerOutlineButtonSx = {
	...secondaryButtonSx,
	color: "#fca5a5",
	background: "rgba(239,68,68,.08)",
	border:
		"1px solid rgba(239,68,68,.18)",
};

const fieldSx = {
	"& .MuiInputLabel-root": {
		color: "rgba(var(--pf-fg-rgb),.55)",
		fontSize: 12,
		fontWeight: 750,
	},

	"& .MuiInputLabel-root.Mui-focused": {
		color: "#60a5fa",
	},

	"& .MuiOutlinedInput-root": {
		color: "var(--pf-text-strong)",
		background: "rgba(var(--pf-fg-rgb),.04)",
		borderRadius: "13px",
		fontSize: 13,

		"& fieldset": {
			borderColor:
				"rgba(var(--pf-fg-rgb),.08)",
		},

		"&:hover fieldset": {
			borderColor:
				"rgba(59,130,246,.36)",
		},

		"&.Mui-focused fieldset": {
			borderColor: "#3b82f6",
			boxShadow:
				"0 0 0 3px rgba(59,130,246,.10)",
		},
	},

	"& .MuiInputBase-input": {
		color: "var(--pf-text-strong)",
	},

	"& .MuiFormHelperText-root": {
		color: "var(--pf-text-dim)",
	},

	"& .MuiSvgIcon-root": {
		color: "var(--pf-text-muted)",
	},
};

const drawerPaperSx = {
	width: {
		xs: "100%",
		sm: 600,
		md: 680,
	},
	maxWidth: "100vw",
	background:
		"linear-gradient(180deg,var(--pf-bg),var(--pf-surface))",
	color: "var(--pf-text-strong)",
	borderLeft:
		"1px solid rgba(var(--pf-fg-rgb),.08)",
};

const drawerHeaderSx = {
	p: 2.5,
	display: "flex",
	justifyContent: "space-between",
	alignItems: "flex-start",
	gap: 2,
};

const drawerTitleSx = {
	fontSize: 24,
	fontWeight: 950,
};

const drawerSubSx = {
	mt: 0.5,
	color: "var(--pf-text-dim)",
	fontSize: 12.5,
	fontWeight: 650,
};

const closeButtonSx = {
	minWidth: 38,
	width: 38,
	height: 38,
	borderRadius: "12px",
	color: "var(--pf-text-soft)",
	background: "rgba(var(--pf-fg-rgb),.04)",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.08)",
};

const dividerSx = {
	borderColor:
		"rgba(var(--pf-fg-rgb),.08)",
};

const drawerBodySx = {
	flex: 1,
	overflowY: "auto",
	p: 2.5,
	display: "flex",
	flexDirection: "column",
	gap: 2.2,
};

const sectionSx = {
	display: "flex",
	flexDirection: "column",
	gap: 1.3,
};

const sectionTitleSx = {
	fontSize: 14,
	fontWeight: 950,
};

const sectionDescriptionSx = {
	mt: 0.4,
	color: "var(--pf-text-dim)",
	fontSize: 11.5,
	fontWeight: 650,
	lineHeight: 1.5,
};

const accessGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		md: "repeat(2,minmax(0,1fr))",
	},
	gap: 1,
};

const accessCardSx = (
	accent,
	selected
) => ({
	p: 1.4,
	borderRadius: "15px",
	cursor: "pointer",
	background: selected
		? `${accent}12`
		: "rgba(var(--pf-fg-rgb),.025)",
	border: selected
		? `1px solid ${accent}55`
		: "1px solid rgba(var(--pf-fg-rgb),.07)",
	transition: "all .2s ease",
	outline: "none",

	"&:hover": {
		borderColor: `${accent}45`,
		background: `${accent}0d`,
	},
});

const accessCardHeaderSx = {
	display: "grid",
	gridTemplateColumns: "38px 1fr 22px",
	gap: 1,
	alignItems: "start",
};

const accessCardIconSx = (accent) => ({
	width: 38,
	height: 38,
	borderRadius: "11px",
	display: "grid",
	placeItems: "center",
	color: accent,
	background: `${accent}16`,
	border: `1px solid ${accent}30`,
});

const accessCardTitleSx = {
	color: "var(--pf-text-strong)",
	fontSize: 12.5,
	fontWeight: 900,
};

const accessCardSubSx = {
	mt: 0.3,
	color: "var(--pf-text-dim)",
	fontSize: 10.5,
	fontWeight: 650,
	lineHeight: 1.4,
};

const selectionDotSx = (
	accent,
	selected
) => ({
	width: 21,
	height: 21,
	borderRadius: "50%",
	display: "grid",
	placeItems: "center",
	color: "var(--pf-text-strong)",
	background: selected
		? accent
		: "transparent",
	border: selected
		? `1px solid ${accent}`
		: "1px solid rgba(var(--pf-fg-rgb),.16)",
	fontSize: 11,
	fontWeight: 950,
});

const accessSummarySx = {
	p: 1.5,
	borderRadius: "15px",
	display: "flex",
	alignItems: "flex-start",
	gap: 1.3,
	background: "rgba(var(--pf-fg-rgb),.035)",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.07)",
};

const summaryIconSx = (accent) => ({
	width: 42,
	height: 42,
	borderRadius: "12px",
	display: "grid",
	placeItems: "center",
	color: accent,
	background: `${accent}16`,
	border: `1px solid ${accent}30`,
	flexShrink: 0,
});

const summaryTitleSx = {
	fontSize: 14,
	fontWeight: 950,
};

const summaryDescriptionSx = {
	mt: 0.3,
	color: "var(--pf-text-dim)",
	fontSize: 11.5,
	fontWeight: 650,
	lineHeight: 1.5,
};

const permissionCardSx = {
	p: 1.5,
	borderRadius: "15px",
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 2,
	background: "rgba(var(--pf-fg-rgb),.035)",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.07)",
};

const permissionTitleSx = {
	fontSize: 13,
	fontWeight: 900,
};

const permissionSubSx = {
	mt: 0.4,
	color: "var(--pf-text-dim)",
	fontSize: 11,
	fontWeight: 650,
	lineHeight: 1.5,
};

const infoAlertSx = {
	borderRadius: "14px",
	background: "rgba(59,130,246,.08)",
	color: "#bfdbfe",
	border:
		"1px solid rgba(59,130,246,.18)",

	"& .MuiAlert-icon": {
		color: "#60a5fa",
	},
};

const drawerFooterSx = {
	p: 2,
	display: "grid",
	gridTemplateColumns: "1fr 1fr",
	gap: 1.2,
	borderTop:
		"1px solid rgba(var(--pf-fg-rgb),.08)",
	background: "rgba(var(--pf-surface-deep-rgb),.65)",
};

const performanceDialogPaperSx = {
	background:
		"linear-gradient(180deg,#071120,var(--pf-surface))",
	color: "var(--pf-text-strong)",
	borderRadius: "22px",
	border:
		"1px solid rgba(96,165,250,.12)",
	boxShadow:
		"0 30px 80px rgba(2,6,23,.58)",
	maxHeight: "90vh",
};

const performanceDialogTitleSx = {
	p: 2.2,
	borderBottom:
		"1px solid rgba(148,163,184,.08)",
};

const performanceDialogTitleRowSx = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	gap: 2,
};

const performanceDialogIdentitySx = {
	display: "flex",
	alignItems: "center",
	gap: 1.2,
};

const performanceAvatarSx = {
	width: 44,
	height: 44,
	borderRadius: "13px",
	display: "grid",
	placeItems: "center",
	color: "#bfdbfe",
	background:
		"linear-gradient(135deg,rgba(37,99,235,.24),rgba(59,130,246,.10))",
	border:
		"1px solid rgba(96,165,250,.22)",
	fontWeight: 950,
};

const performanceDialogNameSx = {
	fontSize: 20,
	fontWeight: 950,
};

const performanceDialogSubSx = {
	mt: 0.25,
	color: "var(--pf-text-muted)",
	fontSize: 11.5,
	fontWeight: 650,
};

const performanceDialogContentSx = {
	p: 2.2,
	"&::-webkit-scrollbar": {
		width: 8,
	},
	"&::-webkit-scrollbar-thumb": {
		background: "#334155",
		borderRadius: 999,
	},
};

const performanceHeroGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "repeat(2,minmax(0,1fr))",
		md: "repeat(4,minmax(0,1fr))",
	},
	gap: 1,
};

const performanceMetricCardSx = (accent) => ({
	p: 1.4,
	borderRadius: "14px",
	background:
		`radial-gradient(circle at top right,${accent}18,transparent 45%),rgba(var(--pf-surface-deep-rgb),.28)`,
	border: `1px solid ${accent}26`,
});

const performanceMetricLabelSx = {
	color: "var(--pf-text-muted)",
	fontSize: 9.5,
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".06em",
};

const performanceMetricValueSx = {
	mt: 0.6,
	fontSize: 24,
	fontWeight: 950,
	color: "var(--pf-text-strong)",
};

const performanceMetricDetailSx = {
	mt: 0.4,
	color: "var(--pf-text-dim)",
	fontSize: 9.5,
	fontWeight: 700,
	lineHeight: 1.4,
};

const performanceSectionGridSx = {
	mt: 1.5,
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		md: "repeat(2,minmax(0,1fr))",
	},
	gap: 1.2,
};

const performanceSectionCardSx = {
	p: 1.5,
	borderRadius: "15px",
	background: "rgba(var(--pf-surface-deep-rgb),.25)",
	border:
		"1px solid rgba(148,163,184,.07)",
};

const performanceSectionTitleSx = {
	color: "var(--pf-text)",
	fontSize: 12.5,
	fontWeight: 950,
	mb: 1,
};

const performanceAccessListSx = {
	mt: 1.2,
	display: "flex",
	flexDirection: "column",
	gap: 0.7,
	"& > div": {
		display: "flex",
		justifyContent: "space-between",
		gap: 1,
		color: "var(--pf-text-dim)",
		fontSize: 10.5,
	},
	"& strong": {
		color: "var(--pf-text-soft)",
		fontWeight: 850,
		textAlign: "right",
	},
};

const performanceMixGridSx = {
	display: "grid",
	gridTemplateColumns:
		"repeat(2,minmax(0,1fr))",
	gap: 0.8,
};

const performanceMixItemSx = (accent) => ({
	p: 1,
	borderRadius: "10px",
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	color: "var(--pf-text-muted)",
	background: `${accent}0d`,
	border: `1px solid ${accent}1f`,
	fontSize: 10,
	fontWeight: 800,
	"& strong": {
		color: accent,
		fontSize: 15,
	},
});

const performanceNoteSx = {
	mt: 1.1,
	color: "var(--pf-text-dim)",
	fontSize: 9.5,
	fontWeight: 650,
	lineHeight: 1.45,
};

const performanceReviewCardSx = {
	mt: 1.3,
	p: 1.5,
	borderRadius: "15px",
	background: "rgba(245,158,11,.06)",
	border:
		"1px solid rgba(245,158,11,.16)",
};

const performanceIssueRowSx = {
	display: "flex",
	alignItems: "center",
	gap: 0.8,
	py: 0.55,
	color: "#fde68a",
	fontSize: 10.5,
	fontWeight: 750,
	"& span": {
		width: 18,
		height: 18,
		borderRadius: "50%",
		display: "grid",
		placeItems: "center",
		background: "rgba(245,158,11,.14)",
		fontWeight: 950,
	},
};

const performanceRecentCardSx = {
	mt: 1.3,
	p: 1.5,
	borderRadius: "15px",
	background: "rgba(var(--pf-surface-deep-rgb),.25)",
	border:
		"1px solid rgba(148,163,184,.07)",
};

const performanceRecentHeaderSx = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	gap: 1,
};

const performanceRecentListSx = {
	maxHeight: 250,
	overflowY: "auto",
	display: "flex",
	flexDirection: "column",
	gap: 0.6,
	pr: 0.5,
	scrollbarWidth: "thin",
	scrollbarColor: "#334155 transparent",
};

const performanceRecentRowSx = {
	display: "grid",
	gridTemplateColumns: "9px minmax(0,1fr)",
	gap: 1,
	alignItems: "center",
	p: 0.9,
	borderRadius: "10px",
	background: "rgba(var(--pf-fg-rgb),.025)",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.045)",
};

const performanceRecentDotSx = (category) => {
	const colors = {
		PACKING: "#22c55e",
		DISPATCH: "#f97316",
		MOVEMENT: "#38bdf8",
		CONTROL: "#a78bfa",
		OTHER: "#64748b",
	};

	const color =
		colors[category] ||
		colors.OTHER;

	return {
		width: 7,
		height: 7,
		borderRadius: "50%",
		background: color,
		boxShadow: `0 0 8px ${color}66`,
	};
};

const performanceRecentActionSx = {
	color: "var(--pf-text)",
	fontSize: 10.5,
	fontWeight: 850,
};

const performanceRecentMetaSx = {
	mt: 0.2,
	color: "var(--pf-text-dim)",
	fontSize: 9,
	fontWeight: 650,
};

const performanceEmptySx = {
	p: 2,
	borderRadius: "12px",
	textAlign: "center",
	color: "var(--pf-text-dim)",
	background: "rgba(var(--pf-fg-rgb),.02)",
	fontSize: 10.5,
};

const dialogPaperSx = {
	minWidth: {
		xs: "calc(100vw - 32px)",
		sm: 440,
	},
	background:
		"linear-gradient(180deg,var(--pf-surface),var(--pf-surface-alt))",
	color: "var(--pf-text-strong)",
	borderRadius: "20px",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.08)",
};

const dialogTextSx = {
	color: "var(--pf-text-muted)",
	fontSize: 13,
	lineHeight: 1.6,
};

const dialogActionsSx = {
	p: 2,
	gap: 1,
};

export default function UsersPage() {
	return (
		<PackFlowThemeBoundary>
			<UsersPageContent />
		</PackFlowThemeBoundary>
	);
}
