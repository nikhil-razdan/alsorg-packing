import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import {
	Box,
	Button,
	Chip,
	TextField,
	MenuItem,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Switch,
} from "@mui/material";

import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import Drawer from "@mui/material/Drawer";
import { hasModuleAccess } from "../utils/moduleAccess";
import { normalizeRole } from "../utils/permissions";
import AppsIcon from "@mui/icons-material/Apps";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LogoutIcon from "@mui/icons-material/Logout";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import SearchIcon from "@mui/icons-material/Search";
import LockResetIcon from "@mui/icons-material/LockReset";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import InventoryIcon from "@mui/icons-material/Inventory";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import API from "../services/api";

function UsersPage() {

	const navigate = useNavigate();

	const currentRole = normalizeRole(localStorage.getItem("role"));
	const canOpenBOMFlow = hasModuleAccess("BOMFLOW");
	const canOpenVenFlow = hasModuleAccess("VENFLOW");

	const goToModules = () => {
		navigate("/modules");
	};

	const goToPackFlow = () => {
		navigate("/packflow/dashboard");
	};

	const goToBOMFlow = () => {
		navigate("/bomflow/dashboard");
	};

	const goToVenFlow = () => {
		navigate("/venflow/dashboard");
	};

	const logout = () => {
		localStorage.clear();
		navigate("/login", { replace: true });
	};

	const [users, setUsers] = useState([]);
	const [loading, setLoading] = useState(false);

	const [pageNo, setPageNo] = useState(1);
	const [pageSize, setPageSize] = useState(25);

	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [role, setRole] = useState("PACKING");

	const [search, setSearch] = useState("");

	const [editId, setEditId] = useState(null);
	const [editUsername, setEditUsername] = useState("");
	const [editRole, setEditRole] = useState("");

	const [resetOpen, setResetOpen] = useState(false);
	const [resetUser, setResetUser] = useState(null);
	const [newPassword, setNewPassword] = useState("");
	const [snackOpen, setSnackOpen] = useState(false);
	const [snackMsg, setSnackMsg] = useState("");
	const [snackType, setSnackType] = useState("success");
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleteUserId, setDeleteUserId] = useState(null);
	const [createOpen, setCreateOpen] = useState(false);
	const [plants, setPlants] = useState([]);

	const [plantCodes, setPlantCodes] = useState([]);

	const [editPlantCodes, setEditPlantCodes] = useState([]);

	const [drivers, setDrivers] = useState([]);

	const [driverId, setDriverId] = useState("");

	const [editDriverId, setEditDriverId] = useState("");
	const [warehouseAccess, setWarehouseAccess] = useState(false);
	const [editWarehouseAccess, setEditWarehouseAccess] = useState(false);
	const [modules, setModules] = useState(["PACKFLOW"]);
	const [editModules, setEditModules] = useState([]);
	const splitPlantCodes = (value) => {
		if (!value) return [];

		return value
			.split(",")
			.map((x) => x.trim())
			.filter(Boolean);
	};

	const joinPlantCodes = (value) => {
		return Array.isArray(value) ? value.join(",") : "";
	};

	const plantName = (code) => {
		const plant = plants.find((p) => p.plantCode === code);

		if (!plant) return code;

		return `${plant.plantCode} | ${plant.packedAreaCode} → ${plant.fgAreaCode}`;
	};

	const roles = [
		"ADMIN",

		"PACKING",
		"WAREHOUSE",
		"DISPATCH",
		"LOGISTICS",
		"DRIVER",

		"BOMFLOW_EDITOR",
		"BOMFLOW_REVIEWER",
		"BOMFLOW_APPROVER",
		"BOMFLOW_MANAGER",

		"VENFLOW_PRODUCTION",
		"VENFLOW_STORE",
		"VENFLOW_PURCHASE",
		"VENFLOW_MANAGER",
	];

	const moduleOptions = [
		{
			key: "PACKFLOW",
			label: "PackFlow",
		},
		{
			key: "BOMFLOW",
			label: "BOMFlow",
		},
		{
			key: "VENFLOW",
			label: "VenFlow",
		},
	];

	const defaultModulesForRole = (nextRole) => {
		if (nextRole === "ADMIN") {
			return ["PACKFLOW", "BOMFLOW", "VENFLOW"];
		}

		if (
			nextRole === "PACKING" ||
			nextRole === "WAREHOUSE" ||
			nextRole === "DISPATCH" ||
			nextRole === "LOGISTICS" ||
			nextRole === "DRIVER"
		) {
			return ["PACKFLOW"];
		}

		if (nextRole.startsWith("BOMFLOW_")) {
			return ["BOMFLOW"];
		}

		if (nextRole.startsWith("VENFLOW_")) {
			return ["VENFLOW"];
		}

		return [];
	};

	const normalizeArray = (value) => {
		if (Array.isArray(value)) {
			return value.filter(Boolean).map((x) => String(x).trim()).filter(Boolean);
		}

		if (!value) {
			return [];
		}

		return String(value)
			.split(",")
			.map((x) => x.trim())
			.filter(Boolean);
	};

	const normalizeUserPlantCodes = (user) => {
		if (Array.isArray(user?.plantCodes) && user.plantCodes.length > 0) {
			return normalizeArray(user.plantCodes);
		}

		return normalizeArray(user?.plantCode);
	};

	const normalizeUserModules = (user) => {
		if (Array.isArray(user?.modules) && user.modules.length > 0) {
			return normalizeArray(user.modules);
		}

		return defaultModulesForRole(user?.role || "");
	};

	const moduleLabel = (key) => {
		const option = moduleOptions.find((item) => item.key === key);
		return option ? option.label : key;
	};

	const driverName = (id) => {
		if (!id) return "Not Linked";

		const driver = drivers.find(
			(d) => String(d.id) === String(id)
		);

		if (!driver) {
			return String(id).slice(0, 8) + "...";
		}

		return driver.phone
			? `${driver.name} • ${driver.phone}`
			: driver.name;
	};

	useEffect(() => {
		const fetchUsers = async () => {
			setLoading(true);

			try {
				const res = await API.get("/users");
				setUsers(res.data.map((u) => ({ ...u, id: u.id })));
			} catch (err) {
				console.error("Failed to load users", err);
			}

			setLoading(false);
		};

		const fetchPlants = async () => {
			try {
				const res = await API.get("/plants");
				setPlants(Array.isArray(res.data) ? res.data : []);
			} catch (err) {
				console.error("Failed to load plants", err);
				setPlants([]);
			}
		};

		const fetchDrivers = async () => {
			try {
				const res = await API.get("/logistics/drivers");

				setDrivers(
					Array.isArray(res.data) ? res.data : []
				);
			} catch (err) {
				console.error("Failed to load drivers", err);
				setDrivers([]);
			}
		};

		fetchUsers();
		fetchPlants();
		fetchDrivers();
	}, []);

	const createUser = async () => {
		try {
			if (!username.trim()) {
				setSnackMsg("Username is required");
				setSnackType("error");
				setSnackOpen(true);
				return;
			}

			if (!password.trim()) {
				setSnackMsg("Password is required");
				setSnackType("error");
				setSnackOpen(true);
				return;
			}

			if (role === "DRIVER" && !driverId) {
				setSnackMsg("Please select a driver profile for DRIVER user");
				setSnackType("error");
				setSnackOpen(true);
				return;
			}

			await API.post("/users", {
				username: username.trim(),
				password,
				role,
				plantCodes:
					role === "DRIVER"
						? []
						: plantCodes,
				driverId:
					role === "DRIVER"
						? driverId
						: null,
				warehouseAccess:
					role === "WAREHOUSE" || role === "ADMIN"
						? true
						: warehouseAccess,
				modules,
			});

			setUsername("");
			setPassword("");
			setRole("PACKING");
			setPlantCodes([]);
			setDriverId("");
			setWarehouseAccess(false);
			setModules(["PACKFLOW"]);
			setCreateOpen(true);


			const res = await API.get("/users");

			setUsers(
				res.data.map((u) => ({
					...u,
					id: u.id,
				}))
			);

			setCreateOpen(false);

			setSnackMsg("User created successfully");
			setSnackType("success");
			setSnackOpen(true);
		} catch (err) {
			console.error("User creation failed", err);

			setSnackMsg(
				err?.response?.data?.message ||
				err?.response?.data ||
				"User creation failed"
			);

			setSnackType("error");
			setSnackOpen(true);
		}
	};

	const startEdit = (u) => {
		setEditId(u.id);
		setEditUsername(u.username);
		setEditRole(u.role);
		setEditWarehouseAccess(Boolean(u.warehouseAccess));
		setEditModules(normalizeUserModules(u));

		if (u.role === "DRIVER") {
			setEditPlantCodes([]);
			setEditDriverId(u.driverId || "");
		} else {
			setEditPlantCodes(normalizeUserPlantCodes(u));
			setEditDriverId("");
		}
	};

	const cancelEdit = () => {
		setEditId(null);
		setEditPlantCodes([]);
		setEditDriverId("");
		setEditWarehouseAccess(false);
		setEditModules([]);
	};

	const saveEdit = async () => {
		try {
			if (!editUsername.trim()) {
				setSnackMsg("Username is required");
				setSnackType("error");
				setSnackOpen(true);
				return;
			}

			if (editRole === "DRIVER" && !editDriverId) {
				setSnackMsg("Please select a driver profile for DRIVER user");
				setSnackType("error");
				setSnackOpen(true);
				return;
			}

			await API.put(`/users/${editId}`, {
				username: editUsername.trim(),
				role: editRole,
				plantCodes:
					editRole === "DRIVER"
						? []
						: editPlantCodes,
				driverId:
					editRole === "DRIVER"
						? editDriverId
						: null,
				warehouseAccess:
					editRole === "WAREHOUSE" || editRole === "ADMIN"
						? true
						: editWarehouseAccess,
				modules: editModules,
			});

			const res = await API.get("/users");

			setUsers(
				res.data.map((u) => ({
					...u,
					id: u.id,
				}))
			);

			setEditId(null);
			setEditDriverId("");
			setEditPlantCodes([]);
			setEditWarehouseAccess(false);
			setEditModules([]);

			setSnackMsg("User updated successfully");
			setSnackType("success");
			setSnackOpen(true);
		} catch (err) {
			console.error("User update failed", err);

			setSnackMsg(
				err?.response?.data?.message ||
				err?.response?.data ||
				"User update failed"
			);

			setSnackType("error");
			setSnackOpen(true);
		}
	};

	const deleteUser = (id) => {
		setDeleteUserId(id);
		setDeleteOpen(true);
	};

	const hasWarehouseAccess = (user) => {
		return (
			user?.role === "ADMIN" ||
			user?.role === "WAREHOUSE" ||
			Boolean(user?.warehouseAccess)
		);
	};

	const confirmDelete = async () => {

		try {

			await API.delete(`/users/${deleteUserId}`);

			const res = await API.get("/users");
			setUsers(res.data.map(u => ({ ...u, id: u.id })));

			setSnackMsg("User deleted successfully");
			setSnackType("success");
			setSnackOpen(true);

		} catch (err) {

			console.error("Delete failed", err);

			setSnackMsg("Delete failed");
			setSnackType("error");
			setSnackOpen(true);

		}

		setDeleteOpen(false);
	};

	const openReset = (user) => {
		setResetUser(user);
		setNewPassword("");
		setResetOpen(true);
	};

	const resetPassword = async () => {

		try {

			await API.put(
				`/users/${resetUser.id}/password`,
				{
					password: newPassword
				}
			);

			setResetOpen(false);

			setSnackMsg(
				"Password reset successful"
			);

			setSnackType("success");

			setSnackOpen(true);

		} catch (err) {

			console.error(
				"Password reset failed:",
				err
			);

			setSnackMsg(
				"Password reset failed"
			);

			setSnackType("error");

			setSnackOpen(true);
		}
	};

	const filteredRows = useMemo(() => {
		return users.filter(u =>
			u.username.toLowerCase().includes(search.toLowerCase())
		);
	}, [users, search]);

	const totalPages = Math.max(
		1,
		Math.ceil(filteredRows.length / pageSize)
	);

	const currentPage = Math.min(
		pageNo,
		totalPages
	);

	const paginatedRows = useMemo(() => {
		return filteredRows.slice(
			(currentPage - 1) * pageSize,
			currentPage * pageSize
		);
	}, [
		filteredRows,
		currentPage,
		pageSize,
	]);

	const roleIcon = (role) => {
		if (role === "ADMIN") {
			return <AdminPanelSettingsIcon fontSize="small" />;
		}

		if (role === "DISPATCH") {
			return <LocalShippingIcon fontSize="small" />;
		}

		if (role === "LOGISTICS") {
			return <LocalShippingIcon fontSize="small" />;
		}

		if (role === "DRIVER") {
			return <LocalShippingIcon fontSize="small" />;
		}

		if (role === "WAREHOUSE") {
			return <InventoryIcon fontSize="small" />;
		}

		return <InventoryIcon fontSize="small" />;
	};

	const roleChip = (role) => {
		if (role === "ADMIN") return adminChip;

		if (role === "DISPATCH") return dispatchChip;

		if (role === "LOGISTICS") return logisticsChip;

		if (role === "DRIVER") return driverChip;

		if (role === "WAREHOUSE") return warehouseChip;

		return packingChip;
	};

	return (

		<div style={page}>
			<div style={content}>
				<div style={globalHeader}>
					<div style={globalHeaderLeft}>
						<div style={brandBlock}>
							<div style={brandIcon}>
								A
							</div>

							<div>
								<div style={suiteTitle}>
									FlowSuite
								</div>

								<div style={suiteSub}>
									Global User & Access Control
								</div>
							</div>
						</div>

						<div style={pageTitleBlock}>
							<div style={logo}>
								👥 User Management
							</div>

							<div style={subtitle}>
								Manage users, roles, plant access, warehouse access and platform permissions.
							</div>
						</div>
					</div>

					<div style={globalHeaderActions}>
						<button
							style={navButton}
							onClick={goToModules}
						>
							<AppsIcon fontSize="small" />
							All Modules
						</button>

						<button
							style={navButton}
							onClick={goToPackFlow}
						>
							<InventoryIcon fontSize="small" />
							PackFlow
						</button>

						{canOpenBOMFlow && (
							<button
								style={navButton}
								onClick={goToBOMFlow}
							>
								<AccountTreeOutlinedIcon fontSize="small" />
								BOMFlow
							</button>
						)}

						{canOpenVenFlow && (
							<button
								style={navButton}
								onClick={goToVenFlow}
							>
								<LayersOutlinedIcon fontSize="small" />
								VenFlow
							</button>
						)}

						<button
							style={logoutNavButton}
							onClick={logout}
						>
							<LogoutIcon fontSize="small" />
							Logout
						</button>

						<button
							style={moduleButton}
							onClick={() => {
								setUsername("");
								setPassword("");
								setRole("PACKING");
								setPlantCodes([]);
								setDriverId("");
								setWarehouseAccess(false);
								setCreateOpen(true);
							}}
						>
							+ Create User
						</button>
					</div>
				</div>
				<div style={breadcrumbRow}>
					<button style={breadcrumbButton} onClick={goToModules}>
						<ArrowBackIcon fontSize="small" />
						Back to Module Hub
					</button>

					<div style={breadcrumbText}>
						FlowSuite / Administration / User Management
					</div>

					{currentRole === "ADMIN" && (
						<Chip
							size="small"
							label="ADMIN ACCESS"
							sx={adminAccessChip}
						/>
					)}
				</div>

				<Box sx={searchPanel}>
					<SearchIcon
						sx={{
							color: "rgba(255,255,255,.45)",
						}}
					/>

					<TextField
						variant="standard"
						placeholder="Search users..."
						value={search}
						onChange={(e) => {
							setSearch(e.target.value);
							setPageNo(1);
						}}
						InputProps={{
							disableUnderline: true
						}}
						sx={searchInput}
					/>
				</Box>

				<div style={wrap}>
					<div style={tableWrapper}>
						<div style={tableHeader}>
							<div>Username</div>
							<div>Role</div>
							<div>Module Access</div>
							<div>Driver Profile</div>
							<div>Plant Access</div>
							<div>Warehouse Access</div>
							<div>Actions</div>
						</div>

						<div style={tableBody}>

							{paginatedRows.map((u) => (

								<div
									key={u.id}
									style={tableRow}
								>

									{/* USER COLUMN */}

									<div>

										<div style={userInfo}>
											<div style={avatar}>
												{u.username
													.charAt(0)
													.toUpperCase()}
											</div>

											{editId === u.id ? (

												<TextField
													value={editUsername}
													size="small"
													onChange={(e) =>
														setEditUsername(
															e.target.value
														)
													}
													sx={inlineInput}
												/>

											) : (

												<span
													style={{
														color: "#ffffff",

														fontWeight: 500,

														fontSize: 15,

														letterSpacing: 0.2,
													}}
												>
													{u.username}
												</span>

											)}
										</div>

									</div>

									{/* ROLE COLUMN */}

									<div
										style={{
											display: "flex",
											alignItems: "center",
										}}
									>

										{editId === u.id ? (

											<TextField
												select
												size="small"
												value={editRole}
												onChange={(e) => {
													const nextRole = e.target.value;

													setRole(nextRole);
													setModules(defaultModulesForRole(nextRole));

													if (nextRole === "DRIVER") {
														setPlantCodes([]);
													} else {
														setDriverId("");
													}

													if (nextRole === "ADMIN" || nextRole === "WAREHOUSE") {
														setWarehouseAccess(true);
													} else {
														setWarehouseAccess(false);
													}
												}}
												sx={inlineInput}
											>
												{roles.map((r) => (
													<MenuItem
														key={r}
														value={r}
													>
														{r}
													</MenuItem>
												))}
											</TextField>

										) : (

											<Chip
												icon={roleIcon(u.role)}
												label={u.role}
												size="small"
												sx={roleChip(u.role)}
											/>

										)}
									</div>

									<TextField
										select
										label="Module Access"
										value={modules}
										onChange={(e) => {
											const value = e.target.value;
											setModules(
												typeof value === "string"
													? value.split(",")
													: value
											);
										}}
										fullWidth
										sx={formFieldSx}
										SelectProps={{
											multiple: true,
											renderValue: (selected) =>
												selected.length
													? selected.map(moduleLabel).join(", ")
													: "Select Modules",
										}}
										slotProps={{
											select: {
												MenuProps: {
													PaperProps: {
														sx: {
															mt: 1,
															borderRadius: "18px",
															background: "linear-gradient(180deg,#0f172a,#111827)",
															color: "#fff",
															border: "1px solid rgba(255,255,255,.06)",
															"& .MuiMenuItem-root": {
																color: "#fff",
															},
															"& .Mui-selected": {
																background: "rgba(59,130,246,.18) !important",
																color: "#fff",
															},
														},
													},
												},
											},
										}}
									>
										{moduleOptions.map((module) => (
											<MenuItem
												key={module.key}
												value={module.key}
											>
												{module.label}
											</MenuItem>
										))}
									</TextField>

									<div
										style={{
											display: "flex",
											alignItems: "center",
											minWidth: 0,
										}}
									>
										{editId === u.id ? (
											<TextField
												select
												size="small"
												value={editModules}
												onChange={(e) => {
													const value = e.target.value;

													setEditModules(
														typeof value === "string"
															? value.split(",")
															: value
													);
												}}
												sx={inlineInput}
												SelectProps={{
													multiple: true,
													renderValue: (selected) =>
														selected.length
															? selected.map(moduleLabel).join(", ")
															: "Select Modules",
												}}
											>
												{moduleOptions.map((module) => (
													<MenuItem
														key={module.key}
														value={module.key}
													>
														{module.label}
													</MenuItem>
												))}
											</TextField>
										) : (
											<Box
												sx={{
													display: "flex",
													gap: 0.7,
													flexWrap: "wrap",
												}}
											>
												{normalizeUserModules(u).length === 0 ? (
													<Chip
														size="small"
														label="No Modules"
														sx={noWarehouseAccessChip}
													/>
												) : (
													normalizeUserModules(u).map((module) => (
														<Chip
															key={module}
															size="small"
															label={moduleLabel(module)}
															sx={moduleAccessChip}
														/>
													))
												)}
											</Box>
										)}
									</div>

									{/* DRIVER PROFILE COLUMN */}

									<div
										style={{
											display: "flex",
											alignItems: "center",
											minWidth: 0,
										}}
									>
										{editId === u.id ? (
											editRole === "DRIVER" ? (
												<TextField
													select
													size="small"
													value={editDriverId}
													onChange={(e) =>
														setEditDriverId(e.target.value)
													}
													sx={inlineInput}
												>
													{drivers.map((driver) => (
														<MenuItem
															key={driver.id}
															value={driver.id}
														>
															{driver.phone
																? `${driver.name} • ${driver.phone}`
																: driver.name}
														</MenuItem>
													))}
												</TextField>
											) : (
												<Chip
													size="small"
													label="Not Required"
													sx={notRequiredChip}
												/>
											)
										) : u.role === "DRIVER" ? (
											<Chip
												size="small"
												label={driverName(u.driverId)}
												sx={driverProfileChip}
											/>
										) : (
											<Chip
												size="small"
												label="Not Required"
												sx={notRequiredChip}
											/>
										)}
									</div>
									<div
										style={{
											display: "flex",
											alignItems: "center",
											minWidth: 0,
										}}
									>
										{editId === u.id ? (
											editRole === "DRIVER" ? (
												<Chip
													size="small"
													label="Not Required"
													sx={notRequiredChip}
												/>
											) : (
												<TextField
													select
													size="small"
													value={editPlantCodes}
													onChange={(e) => {
														const value = e.target.value;

														setEditPlantCodes(
															typeof value === "string"
																? value.split(",")
																: value
														);
													}}
													sx={inlineInput}
													SelectProps={{
														multiple: true,
														renderValue: (selected) =>
															selected.length
																? selected.join(", ")
																: "Select Plant",
													}}
												>
													{plants.map((plant) => (
														<MenuItem
															key={plant.plantCode}
															value={plant.plantCode}
														>
															{plantName(plant.plantCode)}
														</MenuItem>
													))}
												</TextField>
											)
										) : u.role === "DRIVER" ? (
											<Chip
												size="small"
												label="Not Required"
												sx={notRequiredChip}
											/>
										) : (
											<Box
												sx={{
													display: "flex",
													gap: 0.7,
													flexWrap: "wrap",
												}}
											>
												{normalizeUserPlantCodes(u).length === 0 ? (
													<Chip
														size="small"
														label="All / Legacy"
														sx={legacyPlantChip}
													/>
												) : (
													normalizeUserPlantCodes(u).map((code) => (
														<Chip
															key={code}
															size="small"
															label={code}
															sx={plantChip}
														/>
													))
												)}
											</Box>
										)}
									</div>
									<div
										style={{
											display: "flex",
											alignItems: "center",
											minWidth: 0,
										}}
									>
										{editId === u.id ? (
											<Box
												sx={{
													display: "flex",
													alignItems: "center",
													gap: 1,
												}}
											>
												<Switch
													checked={
														editRole === "ADMIN" ||
														editRole === "WAREHOUSE" ||
														editWarehouseAccess
													}
													disabled={editRole === "ADMIN" || editRole === "WAREHOUSE"}
													onChange={(e) => setEditWarehouseAccess(e.target.checked)}
													sx={{
														"& .MuiSwitch-switchBase.Mui-checked": {
															color: "#fbbf24",
														},
														"& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
															backgroundColor: "#f59e0b",
														},
													}}
												/>

												<Chip
													size="small"
													label={
														editRole === "ADMIN" || editRole === "WAREHOUSE" || editWarehouseAccess
															? "Enabled"
															: "No Access"
													}
													sx={
														editRole === "ADMIN" || editRole === "WAREHOUSE" || editWarehouseAccess
															? warehouseAccessChip
															: noWarehouseAccessChip
													}
												/>
											</Box>
										) : (
											<Chip
												size="small"
												label={hasWarehouseAccess(u) ? "Enabled" : "No Access"}
												sx={hasWarehouseAccess(u) ? warehouseAccessChip : noWarehouseAccessChip}
											/>
										)}
									</div>

									{/* ACTIONS */}

									<div
										style={{
											display: "flex",
											alignItems: "center",
										}}
									>

										{editId === u.id ? (

											<Box sx={actionContainer}>

												<Button
													size="small"
													sx={actionPrimary}
													onClick={saveEdit}
												>
													Save
												</Button>

												<Button
													size="small"
													sx={actionSecondary}
													onClick={cancelEdit}
												>
													Cancel
												</Button>

											</Box>

										) : (

											<Box sx={actionContainer}>

												<Button
													startIcon={<EditIcon />}
													size="small"
													sx={actionSecondary}
													onClick={() =>
														startEdit(u)
													}
												>
													Edit
												</Button>

												<Button
													startIcon={
														<LockResetIcon />
													}
													size="small"
													sx={actionPrimary}
													onClick={() =>
														openReset(u)
													}
												>
													Reset
												</Button>

												<Button
													startIcon={<DeleteIcon />}
													size="small"
													sx={actionDanger}
													onClick={() =>
														deleteUser(u.id)
													}
												>
													Delete
												</Button>

											</Box>

										)}

									</div>

								</div>

							))}

						</div>
					</div>

					<Box
						sx={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							mt: 4,
							gap: 2,
							flexWrap: "wrap",
						}}
					>
						{/* LEFT SIDE */}
						<Box
							sx={{
								display: "flex",
								alignItems: "center",
								gap: 2,
							}}
						>
							<Box
								sx={{
									color: "#94a3b8",
									fontWeight: 600,
									fontSize: 14,
								}}
							>
								Show
							</Box>

							<TextField
								select
								size="small"
								value={pageSize}
								onChange={(e) => {
									setPageSize(Number(e.target.value));
									setPageNo(1);
								}}
								sx={{
									width: 110,

									"& .MuiOutlinedInput-root": {
										height: 36,
										borderRadius: "12px",
										background:
											"rgba(255,255,255,.04)",
										color: "#fff",

										"& fieldset": {
											borderColor:
												"rgba(255,255,255,.08)",
										},

										"&:hover fieldset": {
											borderColor:
												"rgba(59,130,246,.35)",
										},
									},

									"& .MuiSvgIcon-root": {
										color: "#94a3b8",
									},
								}}
							>
								<MenuItem value={25}>25</MenuItem>
								<MenuItem value={50}>50</MenuItem>
							</TextField>

							<Box
								sx={{
									color: "#94a3b8",
									fontSize: 14,
								}}
							>
								items per page
							</Box>
						</Box>

						{/* CENTER PAGINATION */}
						<Box
							sx={{
								display: "flex",
								alignItems: "center",
								gap: 3,
							}}
						>
							<Button
								disabled={currentPage === 1}
								onClick={() =>
									setPageNo(currentPage - 1)
								}
								sx={{
									minWidth: 100,
									height: 30,
									borderRadius: "12px",
									background:
										"linear-gradient(180deg,#1e293b,#0f172a)",
									color: "#fff",
									border:
										"1px solid rgba(255,255,255,.08)",

									fontSize: 10,
									fontWeight: 500,

									"&:disabled": {
										opacity: 0.45,
										color: "#94a3b8",
									},
								}}
							>
								◀ Previous
							</Button>

							<Box
								sx={{
									px: 2.5,
									height: 30,
									display: "flex",
									alignItems: "center",
									borderRadius: "12px",
									background:
										"linear-gradient(180deg,#0f172a,#111827)",
									color: "#cbd5e1",
									border:
										"1px solid rgba(255,255,255,.06)",

									fontSize: 10,
									fontWeight: 500,
								}}
							>
								Page

								<Box
									component="span"
									sx={{
										mx: 1,
										color: "#60a5fa",
									}}
								>
									{currentPage}
								</Box>

								of {totalPages}
							</Box>

							<Button
								disabled={currentPage === totalPages}
								onClick={() =>
									setPageNo(currentPage + 1)
								}
								sx={{
									minWidth: 100,
									height: 30,
									borderRadius: "12px",
									background:
										"linear-gradient(180deg,#2563eb,#1d4ed8)",
									color: "#fff",

									fontSize: 10,
									fontWeight: 500,

									"&:disabled": {
										opacity: 0.45,
										color: "#cbd5e1",
									},
								}}
							>
								Next ▶
							</Button>
						</Box>

						{/* RIGHT SIDE COUNT */}
						<Box
							sx={{
								color: "#94a3b8",
								fontSize: 13,
								fontWeight: 600,
							}}
						>
							Total: {filteredRows.length}
						</Box>
					</Box>
				</div>

				<Drawer
					anchor="right"
					open={createOpen}
					onClose={() => setCreateOpen(false)}
					PaperProps={{
						sx: {
							width: 380,

							background:
								"linear-gradient(180deg,#020617,#0f172a)",

							color: "#fff",

							borderTopLeftRadius: 24,
							borderBottomLeftRadius: 24,
							borderLeft:
								"1px solid rgba(255,255,255,.06)",
							p: 3,
						},
					}}
				>
					<Box
						sx={{
							display: "flex",
							flexDirection: "column",
							height: "100%",
						}}
					>

						<Box sx={{ mb: 3 }}>
							<Box
								sx={{
									fontSize: 24,
									fontWeight: 800,
									mb: 0.5,
								}}
							>
								Create User
							</Box>

							<Box
								sx={{
									fontSize: 13,

									color
										: "#6b7280",
								}}
							>
								Add new system user and permissions
							</Box>
						</Box>

						<Box
							sx={{
								display: "flex",
								flexDirection: "column",
								gap: 2,
							}}
						>

							<TextField
								label="Username"
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								fullWidth
								sx={formFieldSx}
							/>

							<TextField
								label="Password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								fullWidth
								sx={formFieldSx}
							/>

							<TextField
								select
								label="Role"
								value={role}
								onChange={(e) => {
									const nextRole = e.target.value;

									setRole(nextRole);

									if (nextRole === "DRIVER") {
										setPlantCodes([]);
									} else {
										setDriverId("");
									}
								}}
								fullWidth
								sx={formFieldSx}
								slotProps={{
									select: {
										MenuProps: {
											PaperProps: {
												sx: {
													mt: 1,
													borderRadius: "18px",

													background:
														"linear-gradient(180deg,#0f172a,#111827)",

													color: "#fff",

													border:
														"1px solid rgba(255,255,255,.06)",

													"& .MuiMenuItem-root": {
														color: "#fff",
													},

													"& .Mui-selected": {
														background:
															"rgba(59,130,246,.18) !important",

														color: "#fff",
													},
												},
											},
										},
									},
								}}
							>
								{roles.map((r) => (
									<MenuItem
										key={r}
										value={r}
									>
										{r}
									</MenuItem>
								))}
							</TextField>

							{role === "DRIVER" && (
								<TextField
									select
									label="Linked Driver Profile"
									value={driverId}
									onChange={(e) =>
										setDriverId(e.target.value)
									}
									fullWidth
									sx={formFieldSx}
									slotProps={{
										select: {
											MenuProps: {
												PaperProps: {
													sx: {
														mt: 1,
														borderRadius: "18px",
														background:
															"linear-gradient(180deg,#0f172a,#111827)",
														color: "#fff",
														border:
															"1px solid rgba(255,255,255,.06)",

														"& .MuiMenuItem-root": {
															color: "#fff",
														},

														"& .Mui-selected": {
															background:
																"rgba(16,185,129,.18) !important",
															color: "#fff",
														},
													},
												},
											},
										},
									}}
								>
									{drivers.map((driver) => (
										<MenuItem
											key={driver.id}
											value={driver.id}
										>
											{driver.phone
												? `${driver.name} • ${driver.phone}`
												: driver.name}
										</MenuItem>
									))}
								</TextField>
							)}
							{role !== "DRIVER" && (
								<TextField
									select
									label="Plant Access"
									value={plantCodes}
									onChange={(e) => {
										const value = e.target.value;
										setPlantCodes(
											typeof value === "string" ? value.split(",") : value
										);
									}}
									fullWidth
									sx={formFieldSx}
									SelectProps={{
										multiple: true,
										renderValue: (selected) =>
											selected.length ? selected.join(", ") : "Select Plant",
									}}
									slotProps={{
										select: {
											MenuProps: {
												PaperProps: {
													sx: {
														mt: 1,
														borderRadius: "18px",
														background:
															"linear-gradient(180deg,#0f172a,#111827)",
														color: "#fff",
														border:
															"1px solid rgba(255,255,255,.06)",

														"& .MuiMenuItem-root": {
															color: "#fff",
														},

														"& .Mui-selected": {
															background:
																"rgba(59,130,246,.18) !important",
															color: "#fff",
														},
													},
												},
											},
										},
									}}
								>
									{plants.map((plant) => (
										<MenuItem key={plant.plantCode} value={plant.plantCode}>
											{plantName(plant.plantCode)}
										</MenuItem>
									))}
								</TextField>
							)}

						</Box>
						{role !== "DRIVER" && (
							<Box sx={permissionCardSx}>
								<Box>
									<Box
										sx={{
											color: "#fff",
											fontWeight: 900,
											fontSize: 14,
										}}
									>
										Warehouse Page Access
									</Box>

									<Box
										sx={{
											color: "#94a3b8",
											fontSize: 12,
											fontWeight: 600,
											mt: 0.4,
											lineHeight: 1.4,
										}}
									>
										Allow this user to open Warehouse page and view warehouse data
										based on selected plant access.
									</Box>
								</Box>

								<Switch
									checked={role === "ADMIN" || role === "WAREHOUSE" || warehouseAccess}
									disabled={role === "ADMIN" || role === "WAREHOUSE"}
									onChange={(e) => setWarehouseAccess(e.target.checked)}
									sx={{
										"& .MuiSwitch-switchBase.Mui-checked": {
											color: "#fbbf24",
										},
										"& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
											backgroundColor: "#f59e0b",
										},
									}}
								/>
							</Box>
						)}
						<Box sx={{ flex: 1 }} />

						<Box
							sx={{
								display: "flex",
								gap: 1.5,

								mt: 4,
								pt: 2,

								borderTop:
									"1px solid rgba(255,255,255,.06)",
							}}
						>

							<Button
								fullWidth
								variant="outlined"
								onClick={() => setCreateOpen(false)}
								sx={{
									borderRadius: "14px",

									fontWeight: 700,

									color
										: "#fff"
									,

									borderColor
										: "rgba(0,0,0,0.12)",

									background
										: "rgba(255,255,255,.04)",

									"&:hover": {
										borderColor
											: "#111827",

										background
											: "#f9fafb",
									},
								}}
							>
								Cancel
							</Button>

							<Button
								fullWidth
								onClick={createUser}
								sx={actionPrimary}
							>
								Create
							</Button>

						</Box>

					</Box>
				</Drawer>
				<Dialog open={resetOpen} onClose={() => setResetOpen(false)}
					PaperProps={{
						sx: {
							background:
								"linear-gradient(180deg,#0f172a,#111827)",

							color: "#fff",

							borderRadius: "24px",

							border:
								"1px solid rgba(255,255,255,.06)",
						}
					}}>
					<DialogTitle>Reset Password</DialogTitle>

					<DialogContent>

						<TextField
							label="New Password"
							type="password"
							value={newPassword}
							onChange={(e) => setNewPassword(e.target.value)}
							fullWidth
							sx={formFieldSx}
						/>

					</DialogContent>

					<DialogActions>

						<Button onClick={() => setResetOpen(false)}
							sx={actionSecondary}>
							Cancel
						</Button>

						<Button onClick={resetPassword}
							sx={actionPrimary}>
							Reset
						</Button>

					</DialogActions>

				</Dialog>
				<Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}
					PaperProps={{
						sx: {
							background:
								"linear-gradient(180deg,#0f172a,#111827)",

							color: "#fff",

							borderRadius: "24px",

							border:
								"1px solid rgba(255,255,255,.06)",
						}
					}}>

					<DialogTitle>
						Delete User
					</DialogTitle>

					<DialogContent>
						Are you sure you want to delete this user?
					</DialogContent>

					<DialogActions>

						<Button onClick={() => setDeleteOpen(false)}
							sx={actionSecondary}>
							Cancel
						</Button>

						<Button
							sx={actionDanger}
							onClick={confirmDelete}
						>
							Delete
						</Button>

					</DialogActions>

				</Dialog>
				<Snackbar
					open={snackOpen}
					autoHideDuration={3000}
					onClose={() => setSnackOpen(false)}
					anchorOrigin={{ vertical: "top", horizontal: "center" }}
				>

					<Alert
						severity={snackType}
						variant="filled"
						onClose={() => setSnackOpen(false)}
					>
						{snackMsg}
					</Alert>

				</Snackbar>
			</div>
		</div>

	);
}

/* ===== ENHANCED GLASS STYLE ===== */

const globalHeader = {
	display: "flex",
	alignItems: "flex-start",
	justifyContent: "space-between",
	gap: 24,
	padding: 24,
	borderRadius: 26,
	background:
		"linear-gradient(180deg, rgba(15,23,42,.94), rgba(15,23,42,.84))",
	border: "1px solid rgba(255,255,255,.08)",
	boxShadow: "0 30px 80px rgba(2,6,23,.42)",
	position: "relative",
	overflow: "hidden",
};

const globalHeaderLeft = {
	display: "flex",
	flexDirection: "column",
	gap: 24,
	minWidth: 0,
};

const brandBlock = {
	display: "flex",
	alignItems: "center",
	gap: 14,
};

const brandIcon = {
	width: 48,
	height: 48,
	borderRadius: 16,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	color: "#fff",
	fontWeight: 900,
	fontSize: 20,
	boxShadow: "0 12px 28px rgba(37,99,235,.35)",
};

const suiteTitle = {
	color: "#fff",
	fontSize: 18,
	fontWeight: 900,
	letterSpacing: 0.6,
};

const suiteSub = {
	color: "rgba(255,255,255,.52)",
	fontSize: 12,
	marginTop: 3,
	fontWeight: 600,
};

const pageTitleBlock = {
	display: "flex",
	flexDirection: "column",
	gap: 4,
};

const globalHeaderActions = {
	display: "flex",
	alignItems: "center",
	justifyContent: "flex-end",
	gap: 10,
	flexWrap: "wrap",
};

const navButton = {
	height: 42,
	padding: "0 14px",
	borderRadius: 14,
	border: "1px solid rgba(255,255,255,.08)",
	background: "rgba(255,255,255,.04)",
	color: "#fff",
	fontWeight: 800,
	cursor: "pointer",
	display: "inline-flex",
	alignItems: "center",
	gap: 8,
};

const logoutNavButton = {
	...navButton,
	color: "#fca5a5",
	background: "rgba(239,68,68,.10)",
	border: "1px solid rgba(239,68,68,.18)",
};

const breadcrumbRow = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 14,
	flexWrap: "wrap",
	padding: "0 4px",
};

const breadcrumbButton = {
	height: 38,
	padding: "0 14px",
	borderRadius: 12,
	border: "1px solid rgba(255,255,255,.08)",
	background: "rgba(255,255,255,.04)",
	color: "#cbd5e1",
	fontWeight: 800,
	cursor: "pointer",
	display: "inline-flex",
	alignItems: "center",
	gap: 8,
};

const breadcrumbText = {
	color: "#94a3b8",
	fontSize: 13,
	fontWeight: 700,
};

const adminAccessChip = {
	fontWeight: 900,
	color: "#93c5fd",
	background: "rgba(59,130,246,.12)",
	border: "1px solid rgba(59,130,246,.22)",
};

const page = {
	minHeight: "100vh",
	position: "relative",
	overflow: "hidden",
	background: `
		radial-gradient(circle at top left, rgba(59,130,246,0.14), transparent 22%),
		radial-gradient(circle at bottom right, rgba(14,165,233,0.10), transparent 24%),
		linear-gradient(135deg,#020617 0%,#0f172a 45%,#111827 100%)
	`,
};

const content = {
	padding: 28,
	display: "flex",
	flexDirection: "column",
	gap: 22,
	maxWidth: 1500,
	margin: "0 auto",
};

const wrap = {
	background:
		"linear-gradient(180deg, rgba(15,23,42,.94), rgba(17,24,39,.92))",
	borderRadius: 26,
	padding: 28,
	border: "1px solid rgba(255,255,255,.07)",
	boxShadow: "0 24px 70px rgba(2,6,23,.35)",
};

const moduleButton = {
	height: 44,
	padding: "0 18px",
	borderRadius: 14,
	border: "1px solid rgba(59,130,246,.35)",
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	color: "#fff",
	fontWeight: 900,
	cursor: "pointer",
	boxShadow: "0 14px 34px rgba(37,99,235,.35)",
};

const logisticsChip = {
	fontWeight: 700,
	color: "#a78bfa",
	background: "rgba(139,92,246,.12)",
	border: "1px solid rgba(139,92,246,.18)",
};

const driverChip = {
	fontWeight: 700,
	color: "#6ee7b7",
	background: "rgba(16,185,129,.12)",
	border: "1px solid rgba(16,185,129,.18)",
};

const driverProfileChip = {
	fontWeight: 800,
	color: "#6ee7b7",
	background: "rgba(16,185,129,.12)",
	border: "1px solid rgba(16,185,129,.18)",
};

const notRequiredChip = {
	fontWeight: 800,
	color: "#94a3b8",
	background: "rgba(148,163,184,.10)",
	border: "1px solid rgba(148,163,184,.14)",
};

const searchPanel = {
	display: "flex",

	alignItems: "center",

	gap: 14,

	padding: "10px 18px",

	borderRadius: 18,

	background:
		"rgba(15,23,42,.72)",

	border:
		"1px solid rgba(255,255,255,.06)",

	backdropFilter: "blur(18px)",

	boxShadow:
		"0 10px 30px rgba(0,0,0,.25)",
};

const searchInput = {
	flex: 1,

	"& .MuiInputBase-root": {
		color: "#fff",

		fontSize: 14,
	},

	"& input::placeholder": {
		color: "rgba(255,255,255,.42)",
		opacity: 1,
	},
};

const logo = {
	color: "#fff",

	fontSize: 32,

	fontWeight: 900,

	marginBottom: 8,
};

const subtitle = {
	color: "#94a3b8",
	fontSize: 14,
};

const tableWrapper = {
	overflow: "hidden",

	borderRadius: 18,
};

const avatar = {
	width: 28,
	height: 28,
	borderRadius: 10,
	background: "linear-gradient(135deg,#6366f1,#4f46e5)",
	color: "#fff",
	fontWeight: 700,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
};

const adminChip = {
	fontWeight: 700,
	color: "#cbd5e1",
	background:
		"rgba(148,163,184,.12)",
	border:
		"1px solid rgba(148,163,184,.18)",
};

const dispatchChip = {
	fontWeight: 700,
	color: "#4ade80",
	background:
		"rgba(34,197,94,.12)",
	border:
		"1px solid rgba(34,197,94,.18)",
};

const warehouseChip = {
	fontWeight: 700,
	color: "#fbbf24",
	background:
		"rgba(251,191,36,.12)",
	border:
		"1px solid rgba(251,191,36,.18)",
};

const packingChip = {
	fontWeight: 700,
	color: "#60a5fa",
	background:
		"rgba(59,130,246,.12)",
	border:
		"1px solid rgba(59,130,246,.18)",
};

const actionContainer = {
	display: "flex",

	alignItems: "center",

	gap: 8,

	flexWrap: "nowrap",
};

const actionPrimary = {
	borderRadius: 12,

	textTransform: "none",

	fontWeight: 700,

	background:
		"linear-gradient(135deg,#2563eb,#3b82f6)",

	color: "#fff",

	border:
		"1px solid rgba(59,130,246,.35)",

	boxShadow:
		"0 10px 24px rgba(37,99,235,.35)",

	"&:hover": {
		background:
			"linear-gradient(135deg,#1d4ed8,#2563eb)",
	},
};

const actionSecondary = {
	borderRadius: 12,

	textTransform: "none",

	fontWeight: 700,

	background:
		"rgba(255,255,255,.04)",

	color: "#fff",

	border:
		"1px solid rgba(255,255,255,.08)",

	"&:hover": {
		background:
			"rgba(255,255,255,.08)",
	},
};

const actionDanger = {
	borderRadius: 12,

	textTransform: "none",

	fontWeight: 700,

	background:
		"linear-gradient(135deg,#dc2626,#ef4444)",

	color: "#fff",

	boxShadow:
		"0 10px 24px rgba(239,68,68,.28)",
};

const formFieldSx = {
	"& .MuiFormLabel-root": {
		color: "rgba(255,255,255,.62)",
	},

	"& .MuiFormLabel-root.Mui-focused": {
		color: "#60a5fa",
	},

	"& .MuiOutlinedInput-root": {
		borderRadius: "16px",

		background:
			"rgba(255,255,255,.04)",

		color: "#fff",

		transition: "all .22s ease",

		"& fieldset": {
			borderColor:
				"rgba(255,255,255,.08)",
		},

		"&:hover fieldset": {
			borderColor:
				"rgba(59,130,246,.45)",
		},

		"&.Mui-focused fieldset": {
			borderColor:
				"#3b82f6",

			boxShadow:
				"0 0 0 3px rgba(59,130,246,.14)",
		},
	},

	"& .MuiInputBase-input": {
		color: "#fff",
	},

	"& .MuiSvgIcon-root": {
		color: "#94a3b8",
	},
};

const tableHeader = {
	display: "grid",

	gridTemplateColumns: "1.25fr .9fr 1.25fr 1.25fr 1.25fr 1.15fr 1.7fr",

	padding: "14px 16px",

	background: "#111827",

	color: "#94a3b8",

	fontWeight: 700,
};

const tableBody = {
	display: "flex",

	flexDirection: "column",
};

const tableRow = {
	display: "grid",

	gridTemplateColumns: "1.25fr .9fr 1.25fr 1.25fr 1.25fr 1.15fr 1.7fr",

	alignItems: "center",

	padding: "14px 16px",

	color: "#fff",

	borderTop:
		"1px solid rgba(255,255,255,0.06)",
};

const userInfo = {
	display: "flex",

	alignItems: "center",

	gap: 14,
};

const moduleAccessChip = {
	background: "rgba(14,165,233,.15)",
	color: "#7dd3fc",
	border: "1px solid rgba(14,165,233,.28)",
	fontWeight: 800,
};

const permissionCardSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 2,

	p: 1.6,
	borderRadius: "16px",

	background: "rgba(255,255,255,.04)",

	border: "1px solid rgba(255,255,255,.08)",
};

const warehouseAccessChip = {
	fontWeight: 800,
	color: "#fbbf24",
	background: "rgba(251,191,36,.12)",
	border: "1px solid rgba(251,191,36,.18)",
};

const noWarehouseAccessChip = {
	fontWeight: 800,
	color: "#94a3b8",
	background: "rgba(148,163,184,.10)",
	border: "1px solid rgba(148,163,184,.14)",
};

const inlineInput = {
	minWidth: 180,

	"& .MuiOutlinedInput-root": {
		borderRadius: "14px",

		background:
			"rgba(255,255,255,.04)",

		color: "#fff",

		"& fieldset": {
			borderColor:
				"rgba(255,255,255,.08)",
		},

		"&:hover fieldset": {
			borderColor:
				"rgba(59,130,246,.45)",
		},

		"&.Mui-focused fieldset": {
			borderColor: "#3b82f6",
		},
	},

	"& input": {
		color: "#fff",
	},

	"& .MuiSvgIcon-root": {
		color: "#94a3b8",
	},
};

const plantChip = {
	fontWeight: 800,
	color: "#93c5fd",
	background: "rgba(59,130,246,.12)",
	border: "1px solid rgba(59,130,246,.18)",
};

const legacyPlantChip = {
	fontWeight: 800,
	color: "#fbbf24",
	background: "rgba(251,191,36,.12)",
	border: "1px solid rgba(251,191,36,.18)",
};

export default UsersPage;