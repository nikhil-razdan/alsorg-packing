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

import { useAuth } from "../auth/AuthContext";
import API from "../services/api";

/* =========================================================
 * ACCESS CONFIGURATION
 * ========================================================= */

const MODULE_KEYS = Object.freeze({
	PACKFLOW: "PACKFLOW",
	BOMFLOW: "BOMFLOW",
	MATFLOW: "MATFLOW",
});

const ACCESS_GROUPS = [
	{
		key: "ADMIN",
		label: "Platform Administrator",
		shortLabel: "Administrator",
		description:
			"Full access to PackFlow, BOMFlow, MatFlow and user administration.",
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
					"Verify stock, reserve, receive and issue material.",
			},
			{
				value: "MATFLOW_PURCHASE",
				label: "Purchase",
				description:
					"Process material indents and purchase tracking.",
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
					"Inspect received material and record acceptance or rejection.",
			},
			{
				value: "MATFLOW_DIRECTOR",
				label: "Director",
				description:
					"Approve controlled MatFlow decisions and review reports.",
			},
		],
	},
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
		];
	}

	return Array.from(
		new Set(
			cleanRoles
				.map((role) =>
					roleMeta(role).moduleKey
				)
				.filter(Boolean)
		)
	);
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

	return modulesForRole(
		user?.role
	);
};

/* =========================================================
 * PAGE
 * ========================================================= */

export default function UsersPage() {
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

	useEffect(() => {
		loadPageData();
	}, [loadPageData]);

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
		 * Multiple selections are allowed only inside PackFlow.
		 */
		if (cleanRoles.length > 1) {
			const invalidCombination =
				cleanRoles.some(
					(role) =>
						roleMeta(role).groupKey !==
						MODULE_KEYS.PACKFLOW
				);

			if (invalidCombination) {
				cleanRoles = [
					cleanRoles[0],
				];
			}
		}

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

		if (
			roles.length > 1 &&
			roles.some(
				(role) =>
					roleMeta(role).groupKey !==
					MODULE_KEYS.PACKFLOW
			)
		) {
			return "Multiple roles can currently be selected only inside PackFlow.";
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

	const filteredRows = useMemo(() => {
		const query =
			search
				.trim()
				.toLowerCase();

		if (!query) {
			return users;
		}

		return users.filter((user) => {
			const plantsText =
				userPlantCodes(user)
					.join(" ")
					.toLowerCase();

			const modulesText =
				userModules(user)
					.join(" ")
					.toLowerCase();

			const rolesText =
				userRoles(user)
					.join(" ")
					.toLowerCase();

			return (
				String(user.username || "")
					.toLowerCase()
					.includes(query) ||
				rolesText.includes(query) ||
				plantsText.includes(query) ||
				modulesText.includes(query)
			);
		});
	}, [users, search]);

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
		const enabled =
			users.filter(
				(user) =>
					user.enabled === true
			).length;

		const matFlowUsers =
			users.filter((user) =>
				userRoles(user).some(
					(role) =>
						role.startsWith(
							"MATFLOW_"
						)
				)
			).length;

		const bomFlowUsers =
			users.filter((user) =>
				userRoles(user).some(
					(role) =>
						role.startsWith(
							"BOMFLOW_"
						)
				)
			).length;

		return {
			total: users.length,
			enabled,
			disabled:
				users.length - enabled,
			matFlowUsers,
			bomFlowUsers,
		};
	}, [users]);

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
		<Box sx={pageSx}>
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
						User Management
					</Typography>

					<Chip
						label="ADMIN ACCESS"
						size="small"
						sx={adminAccessChipSx}
					/>
				</Box>

				<Box sx={statsGridSx}>
					<StatCard
						label="Total Users"
						value={stats.total}
						accent="#3b82f6"
						icon={
							<SupervisorAccountOutlinedIcon />
						}
					/>

					<StatCard
						label="Enabled"
						value={stats.enabled}
						accent="#22c55e"
						icon={
							<CheckCircleOutlineOutlinedIcon />
						}
					/>

					<StatCard
						label="Disabled"
						value={stats.disabled}
						accent="#ef4444"
						icon={
							<BlockOutlinedIcon />
						}
					/>

					<StatCard
						label="MatFlow Users"
						value={
							stats.matFlowUsers
						}
						accent="#14b8a6"
						icon={
							<LayersOutlinedIcon />
						}
					/>

					<StatCard
						label="BOMFlow Users"
						value={
							stats.bomFlowUsers
						}
						accent="#8b5cf6"
						icon={
							<AccountTreeOutlinedIcon />
						}
					/>
				</Box>

				<Box sx={searchPanelSx}>
					<TextField
						fullWidth
						value={search}
						onChange={(event) => {
							setSearch(
								event.target.value
							);
							setPageNo(1);
						}}
						placeholder="Search by username, role, module or plant..."
						size="small"
						sx={fieldSx}
						InputProps={{
							startAdornment: (
								<InputAdornment position="start">
									<SearchIcon
										sx={{
											color: "#64748b",
										}}
									/>
								</InputAdornment>
							),
						}}
					/>

					<Button
						startIcon={
							<AddOutlinedIcon />
						}
						onClick={
							openCreateDrawer
						}
						sx={primaryButtonSx}
					>
						Create User
					</Button>
				</Box>

				<Box sx={tablePanelSx}>
					<Box sx={tableHeaderSx}>
						<Box>User</Box>
						<Box>Access Profile</Box>
						<Box>Plant Access</Box>
						<Box>Operational Access</Box>
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
										No users match the
										current search.
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
							<Button
								disabled={
									currentPage <= 1
								}
								onClick={() =>
									setPageNo(
										currentPage -
										1
									)
								}
								sx={secondaryButtonSx}
							>
								Previous
							</Button>

							<Chip
								label={`Page ${currentPage} of ${totalPages}`}
								sx={pageChipSx}
							/>

							<Button
								disabled={
									currentPage >=
									totalPages
								}
								onClick={() =>
									setPageNo(
										currentPage +
										1
									)
								}
								sx={primaryButtonSx}
							>
								Next
							</Button>
						</Box>

						<Typography sx={mutedTextSx}>
							{filteredRows.length} user
							{filteredRows.length === 1
								? ""
								: "s"}
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
	onModules,
	onPackFlow,
	onBOMFlow,
	onMatFlow,
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
					User Management
				</Typography>

				<Typography sx={pageSubtitleSx}>
					Create users and assign one controlled
					access profile with its required module,
					role, plants and operational permissions.
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
					icon={
						<WarehouseOutlinedIcon />
					}
					label={
						warehouseAccess
							? "Warehouse Enabled"
							: "No Warehouse Access"
					}
					size="small"
					sx={
						warehouseAccess
							? warehouseChipSx
							: neutralChipSx
					}
				/>
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
								: `${selectedRoles.length} PackFlow Roles`}
						</Typography>

						<Typography sx={summaryDescriptionSx}>
							{selectedRoles.length === 1
								? selectedMeta.description
								: "This user receives the combined permissions of every selected PackFlow role."}
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

	return (
		<Box sx={accessGridSx}>
			{ACCESS_GROUPS.map((group) => {
				const selected =
					selectedGroupKey ===
					group.key;

				const isPackFlow =
					group.key ===
					MODULE_KEYS.PACKFLOW;

				return (
					<Box
						key={group.key}
						role="button"
						tabIndex={0}
						onClick={() => {
							if (!selected) {
								onRolesChange([
									group.defaultRole,
								]);
							}
						}}
						onKeyDown={(event) => {
							if (
								event.key === "Enter" ||
								event.key === " "
							) {
								if (!selected) {
									onRolesChange([
										group.defaultRole,
									]);
								}
							}
						}}
						sx={accessCardSx(
							group.accent,
							selected
						)}
					>
						<Box sx={accessCardHeaderSx}>
							<Box
								sx={accessCardIconSx(
									group.accent
								)}
							>
								{group.icon}
							</Box>

							<Box sx={{ minWidth: 0 }}>
								<Typography
									sx={accessCardTitleSx}
								>
									{group.label}
								</Typography>

								<Typography
									sx={accessCardSubSx}
								>
									{group.description}
								</Typography>
							</Box>

							<Box
								sx={selectionDotSx(
									group.accent,
									selected
								)}
							>
								{selected ? "✓" : ""}
							</Box>
						</Box>

						{selected && isPackFlow && (
							<TextField
								select
								fullWidth
								size="small"
								label="PackFlow Roles"
								value={selectedRoles}
								onClick={(event) =>
									event.stopPropagation()
								}
								onChange={(event) => {
									const value =
										event.target.value;

									onRolesChange(
										typeof value ===
											"string"
											? value.split(",")
											: value
									);
								}}
								SelectProps={{
									multiple: true,

									renderValue: (
										selectedValues
									) =>
										selectedValues
											.map(
												(value) =>
													roleMeta(
														value
													).label
											)
											.join(", "),
								}}
								sx={{
									...fieldSx,
									mt: 1.5,
								}}
							>
								{group.roles.map(
									(roleOption) => {
										const checked =
											selectedRoles.includes(
												roleOption.value
											);

										return (
											<MenuItem
												key={
													roleOption.value
												}
												value={
													roleOption.value
												}
											>
												<Checkbox
													checked={
														checked
													}
												/>

												<ListItemText
													primary={
														roleOption.label
													}
													secondary={
														roleOption.description
													}
												/>
											</MenuItem>
										);
									}
								)}
							</TextField>
						)}

						{selected && !isPackFlow && (
							<TextField
								select
								fullWidth
								size="small"
								label="Role"
								value={primaryRole}
								onClick={(event) =>
									event.stopPropagation()
								}
								onChange={(event) =>
									onRolesChange([
										event.target.value,
									])
								}
								sx={{
									...fieldSx,
									mt: 1.5,
								}}
							>
								{group.roles.map(
									(roleOption) => (
										<MenuItem
											key={
												roleOption.value
											}
											value={
												roleOption.value
											}
										>
											<Box>
												<Typography
													sx={{
														fontWeight: 850,
														fontSize: 13,
													}}
												>
													{
														roleOption.label
													}
												</Typography>

												<Typography
													sx={{
														color: "#64748b",
														fontSize: 11,
													}}
												>
													{
														roleOption.description
													}
												</Typography>
											</Box>
										</MenuItem>
									)
								)}
							</TextField>
						)}
					</Box>
				);
			})}
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
		linear-gradient(135deg,#020617 0%,#0f172a 48%,#111827 100%)
	`,
	color: "#fff",
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
		"linear-gradient(180deg, rgba(15,23,42,.94), rgba(15,23,42,.82))",
	border:
		"1px solid rgba(255,255,255,.08)",
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
	color: "rgba(255,255,255,.52)",
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
	color: "rgba(255,255,255,.62)",
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
	color: "#94a3b8",
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
		lg: "repeat(5,minmax(0,1fr))",
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
		"linear-gradient(180deg,rgba(30,41,59,.76),rgba(15,23,42,.80))",
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
	color: "rgba(255,255,255,.58)",
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
	background: "rgba(15,23,42,.78)",
	border:
		"1px solid rgba(255,255,255,.07)",
	boxShadow:
		"0 18px 38px rgba(2,6,23,.28)",
};

const tablePanelSx = {
	borderRadius: "22px",
	background:
		"linear-gradient(180deg,rgba(15,23,42,.94),rgba(17,24,39,.92))",
	border:
		"1px solid rgba(255,255,255,.07)",
	boxShadow:
		"0 24px 64px rgba(2,6,23,.34)",
	overflowX: "auto",
};

const tableHeaderSx = {
	minWidth: 1260,
	display: "grid",
	gridTemplateColumns:
		"1.15fr 1.45fr 1.2fr 1.2fr .7fr 310px",
	gap: 2,
	alignItems: "center",
	p: "15px 20px",
	color: "#93c5fd",
	background: "rgba(2,6,23,.34)",
	borderBottom:
		"1px solid rgba(255,255,255,.08)",
	fontSize: 10.5,
	fontWeight: 950,
	textTransform: "uppercase",
	letterSpacing: ".07em",
};

const tableRowSx = {
	minWidth: 1260,
	display: "grid",
	gridTemplateColumns:
		"1.15fr 1.45fr 1.2fr 1.2fr .7fr 310px",
	gap: 2,
	alignItems: "center",
	p: "15px 20px",
	borderBottom:
		"1px solid rgba(255,255,255,.06)",
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
	color: "#fff",
	fontSize: 13.5,
	fontWeight: 900,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const smallMutedSx = {
	mt: 0.3,
	color: "rgba(255,255,255,.42)",
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
	color: "#94a3b8",
	background: "rgba(148,163,184,.09)",
	border:
		"1px solid rgba(148,163,184,.14)",
	fontWeight: 800,
	fontSize: 10,

	"& .MuiChip-icon": {
		color: "#94a3b8",
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
	minWidth: 1260,
	minHeight: 340,
	display: "grid",
	placeItems: "center",

	"& .MuiCircularProgress-root": {
		color: "#60a5fa",
	},
};

const emptyStateSx = {
	minWidth: 1260,
	p: 5,
	textAlign: "center",
	color: "#94a3b8",
	fontWeight: 750,
};

const paginationSx = {
	minWidth: 1000,
	p: 1.5,
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 2,
	flexWrap: "wrap",
	background: "rgba(2,6,23,.26)",
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
	color: "#cbd5e1",
	background: "rgba(255,255,255,.05)",
	border:
		"1px solid rgba(255,255,255,.08)",
	fontWeight: 850,
};

const mutedTextSx = {
	color: "#94a3b8",
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
		color: "rgba(255,255,255,.28)",
		background: "rgba(255,255,255,.04)",
	},
};

const secondaryButtonSx = {
	minHeight: 36,
	borderRadius: "11px",
	px: 1.5,
	textTransform: "none",
	fontWeight: 800,
	color: "#cbd5e1",
	background: "rgba(255,255,255,.04)",
	border:
		"1px solid rgba(255,255,255,.08)",

	"&:hover": {
		background:
			"rgba(59,130,246,.12)",
		borderColor:
			"rgba(59,130,246,.28)",
	},

	"&.Mui-disabled": {
		color: "rgba(255,255,255,.25)",
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
		color: "rgba(255,255,255,.25)",
		background: "rgba(255,255,255,.04)",
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
		color: "rgba(255,255,255,.55)",
		fontSize: 12,
		fontWeight: 750,
	},

	"& .MuiInputLabel-root.Mui-focused": {
		color: "#60a5fa",
	},

	"& .MuiOutlinedInput-root": {
		color: "#fff",
		background: "rgba(255,255,255,.04)",
		borderRadius: "13px",
		fontSize: 13,

		"& fieldset": {
			borderColor:
				"rgba(255,255,255,.08)",
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
		color: "#fff",
	},

	"& .MuiFormHelperText-root": {
		color: "#64748b",
	},

	"& .MuiSvgIcon-root": {
		color: "#94a3b8",
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
		"linear-gradient(180deg,#020617,#0f172a)",
	color: "#fff",
	borderLeft:
		"1px solid rgba(255,255,255,.08)",
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
	color: "#64748b",
	fontSize: 12.5,
	fontWeight: 650,
};

const closeButtonSx = {
	minWidth: 38,
	width: 38,
	height: 38,
	borderRadius: "12px",
	color: "#cbd5e1",
	background: "rgba(255,255,255,.04)",
	border:
		"1px solid rgba(255,255,255,.08)",
};

const dividerSx = {
	borderColor:
		"rgba(255,255,255,.08)",
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
	color: "#64748b",
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
		: "rgba(255,255,255,.025)",
	border: selected
		? `1px solid ${accent}55`
		: "1px solid rgba(255,255,255,.07)",
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
	color: "#fff",
	fontSize: 12.5,
	fontWeight: 900,
};

const accessCardSubSx = {
	mt: 0.3,
	color: "#64748b",
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
	color: "#fff",
	background: selected
		? accent
		: "transparent",
	border: selected
		? `1px solid ${accent}`
		: "1px solid rgba(255,255,255,.16)",
	fontSize: 11,
	fontWeight: 950,
});

const accessSummarySx = {
	p: 1.5,
	borderRadius: "15px",
	display: "flex",
	alignItems: "flex-start",
	gap: 1.3,
	background: "rgba(255,255,255,.035)",
	border:
		"1px solid rgba(255,255,255,.07)",
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
	color: "#64748b",
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
	background: "rgba(255,255,255,.035)",
	border:
		"1px solid rgba(255,255,255,.07)",
};

const permissionTitleSx = {
	fontSize: 13,
	fontWeight: 900,
};

const permissionSubSx = {
	mt: 0.4,
	color: "#64748b",
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
		"1px solid rgba(255,255,255,.08)",
	background: "rgba(2,6,23,.65)",
};

const dialogPaperSx = {
	minWidth: {
		xs: "calc(100vw - 32px)",
		sm: 440,
	},
	background:
		"linear-gradient(180deg,#0f172a,#111827)",
	color: "#fff",
	borderRadius: "20px",
	border:
		"1px solid rgba(255,255,255,.08)",
};

const dialogTextSx = {
	color: "#94a3b8",
	fontSize: 13,
	lineHeight: 1.6,
};

const dialogActionsSx = {
	p: 2,
	gap: 1,
};