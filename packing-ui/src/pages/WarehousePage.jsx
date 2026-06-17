import { useEffect, useState, useMemo } from "react";
import { Button, TextField, Box, Chip, MenuItem } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { API_BASE_URL } from "../config";
import { canOpenWarehousePage, normalizeRole } from "../utils/permissions";

function WarehousePage() {
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(false);
	const [search, setSearch] = useState("");
	const [gatePassPopup, setGatePassPopup] = useState(null);
	const [approveGatePass, setApproveGatePass] = useState({});
	const token = localStorage.getItem("token");
	const role = normalizeRole(localStorage.getItem("role"));

	const canOpenWarehouse = canOpenWarehousePage();

	const isDispatch = role === "DISPATCH";
	const isPacking = role === "PACKING";
	const DEFAULT_WAREHOUSE_OPTIONS = ["BLS-WH-1", "RTP-WH-2"];
	const [importMode, setImportMode] = useState("");
	const [previewRows, setPreviewRows] = useState([]);
	const [previewOpen, setPreviewOpen] = useState(false);
	const [uploadFile, setUploadFile] = useState(null);
	const [selectionModel, setSelectionModel] = useState([]);
	const [bulkLoading, setBulkLoading] = useState(false);
	const [statusFilter, setStatusFilter] = useState("ALL");
	const [bulkWarehouseApproveOpen, setBulkWarehouseApproveOpen] =
		useState(false);
	const [bulkWarehouseApproveLoading, setBulkWarehouseApproveLoading] =
		useState(false);
	const [bulkGatePassNumber, setBulkGatePassNumber] = useState("");
	const [pageNo, setPageNo] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const isAdmin = role === "ADMIN";

	const [plants, setPlants] = useState([]);
	const [assignmentDrafts, setAssignmentDrafts] = useState({});
	const [savingAssignmentId, setSavingAssignmentId] = useState(null);
	/* ===================== FETCH ===================== */

	const fetchPlants = async () => {
		try {
			const res = await fetch(`${API_BASE_URL}/api/plants`, {
				headers: { Authorization: `Bearer ${token}` },
			});

			if (!res.ok) {
				throw new Error("Failed to fetch plants");
			}

			const data = await res.json();

			setPlants(Array.isArray(data) ? data : []);
		} catch (err) {
			console.error("Failed to load plants", err);
			setPlants([]);
		}
	};

	const fetchItems = async () => {
		if (!canOpenWarehouse) {
			setRows([]);
			return;
		}

		setLoading(true);

		try {
			const [res1, res2] = await Promise.all([
				fetch(`${API_BASE_URL}/api/warehouse/floor`, {
					headers: { Authorization: `Bearer ${token}` },
				}),
				fetch(`${API_BASE_URL}/api/warehouse/items`, {
					headers: { Authorization: `Bearer ${token}` },
				}),
			]);

			if (!res1.ok || !res2.ok) {
				if (res1.status === 403 || res2.status === 403) {
					alert("Warehouse access not allowed for this user");
				}

				throw new Error("Warehouse fetch failed");
			}

			const floorData = await res1.json();
			const warehouseData = await res2.json();

			const combined = [
				...(Array.isArray(floorData) ? floorData : []),
				...(Array.isArray(warehouseData) ? warehouseData : []),
			];

			setRows(
				combined.map((item) => ({
					id: item.zohoItemId || item.sku,
					zohoItemId: item.zohoItemId || item.sku,
					name: item.name || item.itemName,
					sku: item.sku,
					pdNo: item.pdNo,
					drawingNo: item.drawingNo,
					description: item.description,
					clientName: item.clientName,

					plantCode: item.plantCode,
					packedAreaCode: item.packedAreaCode,
					currentLocationCode: item.currentLocationCode,
					fgAreaCode: item.fgAreaCode,
					fgZoneCode: item.fgZoneCode,

					status: item.status,
					location: item.currentLocationCode || item.location || "-",
					factoryFloor: item.floor,
					warehouseCode: item.warehouseCode,
					gatePassNumber: item.gatePassNumber,
				}))
			);

		} catch (err) {
			console.error("Warehouse fetch failed", err);
			setRows([]);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (!canOpenWarehouse) {
			setRows([]);
			return;
		}

		fetchPlants();
		fetchItems();
	}, []);

	const exportCSV = () => {
		const headers = [
			"zohoItemId",
			"name",
			"sku",
			"pdNo",
			"drawingNo",
			"clientName",
			"plantCode",
			"location",
			"currentLocationCode",
			"status",
			"warehouseCode",
		];

		const csv = [
			headers.join(","),
			...rows.map((r) =>
				headers.map((h) => `"${r[h] || ""}"`).join(",")
			),
		].join("\n");

		const blob = new Blob([csv], { type: "text/csv" });
		const url = URL.createObjectURL(blob);

		const a = document.createElement("a");
		a.href = url;
		a.download = "warehouse_export.csv";
		a.click();
	};

	const downloadTemplate = () => {
		const csv = [
			"name,sku,pdNo,drawingNo,description,clientName,location,warehouseCode,gatePass",
			"Item1,SKU1,PD1,DWG1,Desc,Client,Floor-A,WH-01,GP-123",
		].join("\n");

		const blob = new Blob([csv], { type: "text/csv" });
		const url = URL.createObjectURL(blob);

		const a = document.createElement("a");
		a.href = url;
		a.download = "warehouse_template.csv";
		a.click();
	};

	const handleUpload = async (e) => {
		const file = e.target.files[0];
		if (!file || !importMode) return;

		setUploadFile(file);

		const formData = new FormData();
		formData.append("file", file);
		formData.append("mode", importMode);

		const res = await fetch(`${API_BASE_URL}/api/warehouse/import/preview`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
			},
			body: formData,
		});

		const data = await res.json();

		setPreviewRows(data);
		setPreviewOpen(true);
	};

	/* ===================== ACTIONS ===================== */
	const approveWarehouse = async (id) => {
		const gp = approveGatePass[id];

		if (!gp || !gp.trim()) {
			alert("Enter Gate Pass");
			return;
		}

		const res = await fetch(
			`${API_BASE_URL}/api/warehouse/${encodeURIComponent(id)}/approve?gatePass=${encodeURIComponent(gp.trim())}`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"X-Username": localStorage.getItem("username")
				},

			}
		);

		if (!res.ok) {
			alert("Invalid Gate Pass");
			return;
		}

		fetchItems();
	};

	const rejectWarehouse = async (id) => {
		try {
			const res = await fetch(
				`${API_BASE_URL}/api/warehouse/${id}/reject`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"X-Username": localStorage.getItem("username")
					},
				}
			);

			if (!res.ok) throw new Error();

			fetchItems();
		} catch {
			alert("Reject failed");
		}
	};

	const requestReturn = async (id) => {
		try {
			const res = await fetch(
				`${API_BASE_URL}/api/dispatched/${id}/request-return`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"X-Username": localStorage.getItem("username"),
					},
				}
			);

			if (!res.ok) throw new Error();

			fetchItems(); // refresh table
		} catch (err) {
			console.error(err);
			alert("Return request failed");
		}
	};

	const bulkReturnToDispatch = async () => {

		if (selectionModel.length === 0) {
			alert("Select items first");
			return;
		}

		const confirmBulk = window.confirm(
			`Return ${selectionModel.length} selected items to dispatch?`
		);

		if (!confirmBulk) return;

		try {

			setBulkLoading(true);

			await Promise.all(
				selectionModel.map((id) =>
					fetch(
						`${API_BASE_URL}/api/dispatched/${id}/request-return`,
						{
							method: "POST",
							headers: {
								Authorization: `Bearer ${token}`,
								"X-Username": localStorage.getItem("username"),
							},
						}
					)
				)
			);

			setSelectionModel([]);
			fetchItems();

		} catch (err) {

			console.error(err);
			alert("Bulk return failed");

		} finally {

			setBulkLoading(false);

		}
	};

	const selectableStatuses = [
		"WAREHOUSE_REQUESTED",
		"IN_WAREHOUSE",
	];

	const getWarehouseRowId = (row) => {
		return (
			row?.zohoItemId ||
			row?.id ||
			row?.itemId ||
			row?.packetItemId ||
			""
		);
	};

	const getWarehouseStatus = (row) =>
		row.status || row.movementStatus || "";

	const getPlantLabel = (plantCode) => {
		if (!plantCode) return "Not Assigned";

		const plant = plants.find((p) => p.plantCode === plantCode);

		if (!plant) return plantCode;

		return plant.plantName
			? `${plant.plantCode} | ${plant.plantName}`
			: plant.plantCode;
	};

	const getPlantConfig = (plantCode) => {
		return plants.find((p) => p.plantCode === plantCode) || null;
	};

	const getLocationOptions = (plantCode) => {
		const plant = getPlantConfig(plantCode);

		const options = [
			"FLOOR",
			"PKD-1",
			"PKD-2",
			"PKD-3",
			"PKD-4",
			"FG-1",
			"FG-1-A",
			"FG-1-B",
			"FG-1-C",
			"FG-2",
			"FG-3",
			"FG-4",
			...DEFAULT_WAREHOUSE_OPTIONS,
		];

		if (plant) {
			if (plant.packedAreaCode) {
				options.push(plant.packedAreaCode);
			}

			if (plant.fgAreaCode) {
				options.push(plant.fgAreaCode);
			}

			if (Array.isArray(plant.fgZones)) {
				plant.fgZones.forEach((zone) => {
					if (plant.fgAreaCode && zone) {
						options.push(`${plant.fgAreaCode}-${zone}`);
					}
				});
			}

			if (Array.isArray(plant.warehouseCodes)) {
				plant.warehouseCodes.forEach((warehouse) => {
					if (warehouse) {
						options.push(warehouse);
					}
				});
			}
		}

		return Array.from(new Set(options)).filter(Boolean);
	};

	const getWarehouseOptions = (plantCode) => {
		const plant = getPlantConfig(plantCode);

		const plantWarehouses =
			plant && Array.isArray(plant.warehouseCodes)
				? plant.warehouseCodes
				: [];

		return Array.from(
			new Set([
				...plantWarehouses,
				...DEFAULT_WAREHOUSE_OPTIONS,
			])
		).filter(Boolean);
	};

	const getAssignmentDraft = (row) => {
		const id = getWarehouseRowId(row);
		return assignmentDrafts[id] || null;
	};

	const isAssignmentEditing = (row) => {
		return Boolean(getAssignmentDraft(row));
	};

	const updateAssignmentDraft = (row, key, value) => {
		const id = getWarehouseRowId(row);

		setAssignmentDrafts((prev) => {
			const existing = prev[id] || {};

			const next = {
				...existing,
				[key]: value,
			};

			if (key === "plantCode") {
				next.currentLocationCode = "";
				next.warehouseCode = "";
				next.fgZoneCode = "";
			}

			if (key === "warehouseCode") {
				next.warehouseCode = value;

				if (value) {
					next.currentLocationCode = value;
				}
			}

			return {
				...prev,
				[id]: next,
			};
		});
	};

	const cancelAssignmentEdit = (row) => {
		const id = getWarehouseRowId(row);

		setAssignmentDrafts((prev) => {
			const copy = { ...prev };
			delete copy[id];
			return copy;
		});
	};

	const updateAssignmentDraft = (row, key, value) => {
		const id = getWarehouseRowId(row);

		setAssignmentDrafts((prev) => {
			const existing = prev[id] || {};

			const next = {
				...existing,
				[key]: value,
			};

			if (key === "plantCode") {
				next.currentLocationCode = "";
				next.warehouseCode = "";
				next.fgZoneCode = "";
			}

			if (key === "warehouseCode") {
				next.warehouseCode = value;

				if (value) {
					next.currentLocationCode = value;
				}
			}

			return {
				...prev,
				[id]: next,
			};
		});
	};

	const saveAssignment = async (row) => {
		const id = getWarehouseRowId(row);
		const draft = assignmentDrafts[id];

		if (!draft) return;

		if (!draft.plantCode) {
			alert("Please select Plant");
			return;
		}

		try {
			setSavingAssignmentId(id);

			const res = await fetch(
				`${API_BASE_URL}/api/dispatched/${encodeURIComponent(id)}/plant-location`,
				{
					method: "PATCH",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						plantCode: draft.plantCode,
						currentLocationCode: draft.currentLocationCode || null,
						fgZoneCode: draft.fgZoneCode || null,
						warehouseCode: draft.warehouseCode || null,
					}),
				}
			);

			if (!res.ok) {
				const text = await res.text();
				throw new Error(text || "Location assignment failed");
			}

			cancelAssignmentEdit(row);
			await fetchItems();
		} catch (err) {
			console.error("Location assignment failed", err);
			alert(err.message || "Location assignment failed");
		} finally {
			setSavingAssignmentId(null);
		}
	};

	const filteredRows = useMemo(() => {
		return rows.filter((r) => {
			const searchValue = search.trim().toLowerCase();

			if (
				searchValue &&
				!(r.name || "").toLowerCase().includes(searchValue) &&
				!(r.status || "").toLowerCase().includes(searchValue) &&
				!(r.clientName || "").toLowerCase().includes(searchValue) &&
				!(r.pdNo || "").toLowerCase().includes(searchValue) &&
				!(r.sku || "").toLowerCase().includes(searchValue) &&
				!(r.drawingNo || "").toLowerCase().includes(searchValue) &&
				!(r.description || "").toLowerCase().includes(searchValue) &&
				!(r.warehouseCode || "").toLowerCase().includes(searchValue) &&
				!(r.plantCode || "").toLowerCase().includes(searchValue) &&
				!(r.currentLocationCode || "").toLowerCase().includes(searchValue)
			) {
				return false;
			}

			if (statusFilter !== "ALL" && r.status !== statusFilter) {
				return false;
			}

			return true;
		});
	}, [rows, search, statusFilter]);

	const filteredSelectableRows = useMemo(() => {
		return filteredRows.filter((row) => {
			const id = getWarehouseRowId(row);
			const status = getWarehouseStatus(row);

			return !!id && selectableStatuses.includes(status);
		});
	}, [filteredRows]);

	const filteredSelectableIds = useMemo(() => {
		return filteredSelectableRows.map((row) => getWarehouseRowId(row));
	}, [filteredSelectableRows]);

	const allFilteredSelected =
		filteredSelectableIds.length > 0 &&
		filteredSelectableIds.every((id) => selectionModel.includes(id));

	const someFilteredSelected =
		filteredSelectableIds.length > 0 &&
		filteredSelectableIds.some((id) => selectionModel.includes(id));

	const toggleSelectAllFiltered = (checked) => {
		if (checked) {
			setSelectionModel((prev) =>
				Array.from(new Set([...prev, ...filteredSelectableIds]))
			);
		} else {
			setSelectionModel((prev) =>
				prev.filter((id) => !filteredSelectableIds.includes(id))
			);
		}
	};

	const selectedWarehouseItems = useMemo(() => {
		return rows.filter((row) =>
			selectionModel.includes(getWarehouseRowId(row))
		);
	}, [rows, selectionModel]);

	const allWarehouseItems =
		selectedWarehouseItems.length > 0 &&
		selectedWarehouseItems.every(
			(item) => getWarehouseStatus(item) === "IN_WAREHOUSE"
		);

	const allSelectedWarehouseRequested =
		selectedWarehouseItems.length > 0 &&
		selectedWarehouseItems.every(
			(item) => getWarehouseStatus(item) === "WAREHOUSE_REQUESTED"
		);

	const canBulkApproveWarehouseThroughGatePass =
		allSelectedWarehouseRequested &&
		selectedWarehouseItems.length > 0;

	const paginatedRows = useMemo(() => {
		const start = (pageNo - 1) * pageSize;
		return filteredRows.slice(start, start + pageSize);
	}, [filteredRows, pageNo, pageSize]);

	const totalPages = Math.max(
		1,
		Math.ceil(filteredRows.length / pageSize)
	);

	useEffect(() => {
		setPageNo(1);
	}, [pageSize, statusFilter, search]);

	useEffect(() => {
		if (pageNo > totalPages) {
			setPageNo(totalPages);
		}
	}, [pageNo, totalPages]);

	const bulkApproveWarehouseThroughGatePass = async () => {
		if (selectionModel.length === 0) {
			alert("Select items first");
			return;
		}

		if (!allSelectedWarehouseRequested) {
			alert("Only Warehouse Requested items can be approved through gate pass");
			return;
		}

		const gatePass = bulkGatePassNumber.trim();

		if (!gatePass) {
			alert("Enter gate pass number");
			return;
		}

		const confirmBulk = window.confirm(
			`Approve ${selectedWarehouseItems.length} selected warehouse requested items with Gate Pass: ${gatePass}?`
		);

		if (!confirmBulk) return;

		try {
			setBulkWarehouseApproveLoading(true);

			await Promise.all(
				selectedWarehouseItems.map(async (row) => {
					const id = getWarehouseRowId(row);

					const res = await fetch(
						`${API_BASE_URL}/api/warehouse/${encodeURIComponent(id)}/approve?gatePass=${encodeURIComponent(gatePass)}`,
						{
							method: "POST",
							headers: {
								Authorization: `Bearer ${token}`,
								"X-Username": localStorage.getItem("username"),
							},
						}
					);

					if (!res.ok) {
						const text = await res.text();
						throw new Error(text || `Approval failed for ${row.sku || id}`);
					}
				})
			);

			setSelectionModel([]);
			setBulkGatePassNumber("");
			setBulkWarehouseApproveOpen(false);

			await fetchItems();
		} catch (err) {
			console.error(err);
			alert(err.message || "Bulk warehouse approval failed");
		} finally {
			setBulkWarehouseApproveLoading(false);
		}
	};

	/* ===================== COLUMNS ===================== */
	/* ===================== COLUMNS ===================== */

	const columns = [

		{
			field: "select",
			headerName: "",
			width: 60,
			sortable: false,

			renderHeader: () => {
				return (
					<Box sx={selectHeaderCellSx}>
						<input
							type="checkbox"
							ref={(el) => {
								if (el) {
									el.indeterminate =
										someFilteredSelected && !allFilteredSelected;
								}
							}}
							checked={allFilteredSelected}
							disabled={filteredSelectableIds.length === 0}
							title="Select all filtered warehouse action rows"
							style={
								filteredSelectableIds.length === 0
									? selectCheckboxDisabledStyle
									: selectCheckboxStyle
							}
							onChange={(e) => {
								toggleSelectAllFiltered(e.target.checked);
							}}
						/>
					</Box>
				);
			},

			renderCell: (params) => {
				const id = getWarehouseRowId(params.row);
				const status = getWarehouseStatus(params.row);

				const isSelectable =
					!!id && selectableStatuses.includes(status);

				return (
					<Box sx={selectHeaderCellSx}>
						<input
							type="checkbox"
							disabled={!isSelectable}
							checked={isSelectable && selectionModel.includes(id)}
							style={
								isSelectable
									? selectCheckboxStyle
									: selectCheckboxDisabledStyle
							}
							onChange={(e) => {
								if (!isSelectable) return;

								if (e.target.checked) {
									setSelectionModel((prev) =>
										prev.includes(id) ? prev : [...prev, id]
									);
								} else {
									setSelectionModel((prev) =>
										prev.filter((item) => item !== id)
									);
								}
							}}
						/>
					</Box>
				);
			},
		},
		{
			field: "name",
			headerName: "Item Name",
			flex: 1,
			minWidth: 260,

			renderHeader: () => <span>Item Name</span>,

			renderCell: (params) => (
				<span style={simpleCellText} title={params.row.name}>
					{params.row.name || "—"}
				</span>
			),
		},

		{
			field: "sku",
			headerName: "SKU",
			width: 160,

			renderHeader: () => <span>SKU</span>,

			renderCell: (params) => (
				<span style={simpleMutedText} title={params.value}>
					{params.value || "—"}
				</span>
			),
		},
		{
			field: "pdNo",
			headerName: "PD No",
			width: 140,

			renderHeader: () => <span>PD No</span>,

			renderCell: (params) => (
				<span style={simpleMutedText} title={params.value}>
					{params.value || "—"}
				</span>
			),
		},
		{
			field: "drawingNo",
			headerName: "Dwg No.",
			width: 160,

			renderHeader: () => <span>DWG No.</span>,

			renderCell: (params) => (
				<span style={simpleMonoText} title={params.value}>
					{params.value || "N/A"}
				</span>
			),
		},
		{
			field: "description",
			headerName: "Description",
			width: 220,

			renderHeader: () => <span>DWG No.</span>,

			renderCell: (params) => (
				<span style={simpleMonoText} title={params.value}>
					{params.value || "N/A"}
				</span>
			),
		},
		{
			field: "clientName",
			headerName: "Client",
			minWidth: 180,

			renderHeader: () => <span>Description</span>,

			renderCell: (params) => (
				<span style={simpleMutedText} title={params.value}>
					{params.value || "No description"}
				</span>
			),
		},
		{
			field: "plantCode",
			headerName: "Plant",
			width: 150,

			renderHeader: () => <span>Plant</span>,

			renderCell: (params) => {
				const row = params.row;
				const draft = getAssignmentDraft(row);

				if (isAdmin && draft) {
					return (
						<TextField
							select
							size="small"
							value={draft.plantCode || ""}
							onChange={(e) =>
								updateAssignmentDraft(row, "plantCode", e.target.value)
							}
							sx={{
								width: 135,
								...compactActionFieldSx,
							}}
						>
							{plants.map((plant) => (
								<MenuItem
									key={plant.plantCode}
									value={plant.plantCode}
								>
									{plant.plantCode}
								</MenuItem>
							))}
						</TextField>
					);
				}

				return (
					<span style={simpleMutedText} title={getPlantLabel(row.plantCode)}>
						{row.plantCode || "—"}
					</span>
				);
			},
		},
		{
			field: "location",
			headerName: "Location",
			width: 190,

			renderHeader: () => <span>Location</span>,

			renderCell: (params) => {
				const row = params.row;
				const draft = getAssignmentDraft(row);
				const plantCode = draft?.plantCode || row.plantCode;
				const locationOptions = getLocationOptions(plantCode);

				if (isAdmin && draft) {
					return (
						<TextField
							select
							size="small"
							value={draft.currentLocationCode || ""}
							onChange={(e) =>
								updateAssignmentDraft(row, "currentLocationCode", e.target.value)
							}
							sx={{
								width: 175,
								...compactActionFieldSx,
							}}
							SelectProps={{
								displayEmpty: true,
								MenuProps: {
									PaperProps: {
										sx: warehouseSelectMenuSx,
									},
								},
							}}
						>
							<MenuItem value="">
								Select Location
							</MenuItem>

							{locationOptions.map((location) => (
								<MenuItem
									key={location}
									value={location}
								>
									{location}
								</MenuItem>
							))}
						</TextField>
					);
				}

				return (
					<span style={simpleMutedText} title={row.currentLocationCode || row.location}>
						{row.currentLocationCode || row.location || "-"}
					</span>
				);
			},
		},
		{
			field: "status",
			headerName: "Movement Status",
			width: 240,
			renderHeader: () => (
				<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
					📋 <span>Movement Status</span>
				</Box>
			),
			renderCell: (params) => {
				const row = params.row;
				const location = row.location || "-";

				// 🔐 who can view
				const canView =
					(isPacking || role === "ADMIN") &&
					(row.gatePassNumber || row.status !== "ON_FLOOR");

				// 🔥 COMMON VIEW BUTTON
				const ViewButton = () => (
					<Button
						size="small"
						onClick={async () => {
							try {
								const res = await fetch(
									`${API_BASE_URL}/api/gatepass/${row.zohoItemId}/pdf`,
									{
										method: "GET",
										headers: {
											Authorization: `Bearer ${token}`,
										},
									}
								);

								if (!res.ok) throw new Error();

								const blob = await res.blob();
								const url = URL.createObjectURL(blob);

								if (gatePassPopup?.previewUrl) {
									URL.revokeObjectURL(gatePassPopup.previewUrl);
								}

								setGatePassPopup({
									id: row.id,
									gatePass: row.gatePassNumber || "GATEPASS",
									previewUrl: url,
								});

							} catch (err) {
								console.error(err);
								alert("Failed to load gate pass");
							}
						}}
						sx={statusViewButton}
					>
						View
					</Button>
				);

				// ===============================
				// STEP 1: ON FLOOR
				// ===============================
				if (row.status === "ON_FLOOR") {
					return (
						<Chip
							label={`${location} WIP Packed`}
							size="small"
							sx={statusPacked}
						/>
					);
				}

				if (row.status === "READY_TO_STORE") {
					return (
						<Chip
							label="Waiting Dispatch Action"
							size="small"
							sx={pendingChip}
						/>
					)
				}

				// ===============================
				// STEP 2: REQUESTED
				// ===============================
				if (row.status === "WAREHOUSE_REQUESTED") {
					return (
						<Box sx={movementStatusCell}>
							<Chip
								label={`${location} WIP Packed`}
								size="small"
								sx={{
									...pendingChip,
									...movementStatusChipSx,
								}}
							/>

							{canView && <ViewButton />}
						</Box>
					);
				}

				// ===============================
				// STEP 3: STORED
				// ===============================
				if (row.status === "IN_WAREHOUSE") {
					return (
						<Box sx={movementStatusCell}>
							<Chip
								label="Stored in Warehouse"
								size="small"
								sx={{
									...statusStored,
									...movementStatusChipSx,
								}}
							/>

							{canView && <ViewButton />}
						</Box>
					);
				}
				if (row.status === "WAREHOUSE_RETURN_REQUESTED") {
					return (
						<Box sx={movementStatusCell}>
							<Chip
								label="Return Requested"
								size="small"
								sx={{
									...returnChip,
									...movementStatusChipSx,
								}}
							/>

							{canView && <ViewButton />}
						</Box>
					);
				}

				return row.status;
			},
		},

		{
			field: "factoryFloor",
			headerName: "Factory Floor",
			width: 180,

			renderHeader: () => <span>Factory Floor</span>,

			renderCell: (params) => (
				<span style={simpleMutedText} title={params.row.factoryFloor}>
					{params.row.factoryFloor || "—"}
				</span>
			),
		},
		{
			field: "warehouseCode",
			headerName: "Warehouse",
			width: 190,

			renderHeader: () => <span>Warehouse</span>,

			renderCell: (params) => {
				const row = params.row;
				const draft = getAssignmentDraft(row);
				const plantCode = draft?.plantCode || row.plantCode;
				const warehouseOptions = getWarehouseOptions(plantCode);

				if (isAdmin && draft) {
					return (
						<TextField
							select
							size="small"
							value={draft.warehouseCode || ""}
							onChange={(e) =>
								updateAssignmentDraft(row, "warehouseCode", e.target.value)
							}
							sx={{
								width: 175,
								...compactActionFieldSx,
							}}
							SelectProps={{
								displayEmpty: true,
								MenuProps: {
									PaperProps: {
										sx: warehouseSelectMenuSx,
									},
								},
							}}
						>
							<MenuItem value="">
								Select Warehouse
							</MenuItem>

							{warehouseOptions.map((warehouse) => (
								<MenuItem
									key={warehouse}
									value={warehouse}
								>
									{warehouse}
								</MenuItem>
							))}
						</TextField>
					);
				}

				return (
					<span style={simpleMutedText} title={row.warehouseCode}>
						{row.warehouseCode || "—"}
					</span>
				);
			},
		},
		{
			field: "actions",
			headerName: "Action",

			flex: 1,
			minWidth: 520,
			maxWidth: 600,

			sortable: false,

			renderHeader: () => (
				<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
					⚡ <span style={{ fontWeight: 700 }}>Action</span>
				</Box>
			),

			renderCell: (params) => {
				const row = params.row;

				const assignmentEditing = isAssignmentEditing(row);
				const rowId = getWarehouseRowId(row);

				if (isAdmin && assignmentEditing) {
					return (
						<Box sx={actionCell}>
							<Button
								size="small"
								disabled={savingAssignmentId === rowId}
								onClick={() => saveAssignment(row)}
								sx={actionSuccess}
							>
								{savingAssignmentId === rowId ? "Saving..." : "Save"}
							</Button>

							<Button
								size="small"
								disabled={savingAssignmentId === rowId}
								onClick={() => cancelAssignmentEdit(row)}
								sx={actionDanger}
							>
								Cancel
							</Button>
						</Box>
					);
				}
				// WAREHOUSE REQUESTED
				if (row.status === "WAREHOUSE_REQUESTED") {
					// PACKING VIEW
					if (isPacking) {
						return (
							<Chip
								label="Awaiting Dispatch"
								size="small"
								sx={pendingChip}
							/>
						);
					}

					// DISPATCH VIEW
					if (isDispatch) {
						return (
							<Box
								sx={{
									display: "flex",
									alignItems: "center",
									gap: 1.2,
									flexWrap: "wrap",
								}}
							>
								<TextField
									size="small"
									placeholder="Gate Pass"
									value={approveGatePass[row.id] || ""}
									onChange={(e) =>
										setApproveGatePass((prev) => ({
											...prev,
											[row.id]: e.target.value,
										}))
									}
									sx={{
										width: 155,
										...compactActionFieldSx,
									}}
								/>

								<Button
									size="small"
									disabled={!approveGatePass[row.id]}
									onClick={() => approveWarehouse(row.id)}
									sx={actionSuccess}
								>
									Approve
								</Button>

								<Button
									size="small"
									onClick={() => rejectWarehouse(row.id)}
									sx={actionDanger}
								>
									Reject
								</Button>
							</Box>

						);
					}
				}

				// ===============================
				// STEP 3: IN WAREHOUSE (FIXED)
				// ===============================
				if (row.status === "IN_WAREHOUSE") {

					if (isDispatch) {
						return (
							<Button
								size="small"
								onClick={() => requestReturn(row.zohoItemId)}
								sx={actionWarning}
							>
								Return to Dispatch
							</Button>
						);
					}

					if (isAdmin) {
						return (
							<Button
								size="small"
								onClick={() => startAssignmentEdit(row)}
								sx={actionInfo}
							>
								Edit Location
							</Button>
						);
					}

					return (
						<Chip label="Stored" size="small" sx={statusStored} />
					);
				}
				// ===============================
				// RETURN REQUEST FLOW
				// ===============================
				if (row.status === "WAREHOUSE_RETURN_REQUESTED") {

					if (role === "ADMIN") {
						return (
							<Box sx={actionCell}>
								<Button
									size="small"
									onClick={async () => {
										await fetch(
											`${API_BASE_URL}/api/dispatched/${row.zohoItemId}/approve-return`,
											{
												method: "POST",
												headers: {
													Authorization: `Bearer ${token}`,
												},
											}
										);
										fetchItems();
									}}
									sx={actionSuccess}
								>
									Approve
								</Button>

								<Button
									size="small"
									onClick={async () => {
										await fetch(
											`${API_BASE_URL}/api/dispatched/${row.zohoItemId}/reject-return`,
											{
												method: "POST",
												headers: {
													Authorization: `Bearer ${token}`,
												},
											}
										);
										fetchItems();
									}}
									sx={actionDanger}
								>
									Reject
								</Button>
							</Box>
						);
					}

					return (
						<Chip label="Awaiting Admin Approval" size="small" sx={pendingChip} />
					);
				}
				if (isAdmin) {
					return (
						<Button
							size="small"
							onClick={() => startAssignmentEdit(row)}
							sx={actionInfo}
						>
							Edit Location
						</Button>
					);
				}
				return null;
			},
		},
	];

	/* ===================== FILTER ===================== */

	const warehouseGatePassEligibleItems = useMemo(() => {
		return selectedWarehouseItems.filter(
			(row) => getWarehouseStatus(row) === "WAREHOUSE_REQUESTED"
		);
	}, [selectedWarehouseItems]);

	/* ===================== UI ===================== */

	const selectedItems = rows.filter(r =>
		selectionModel?.includes(r.zohoItemId)
	);

	if (!canOpenWarehouse) {
		return (
			<div style={page}>
				<div style={content}>
					<Box
						sx={{
							minHeight: "70vh",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Box
							sx={{
								width: "100%",
								maxWidth: 520,
								p: 4,
								borderRadius: "24px",
								background: "linear-gradient(180deg,#0f172a,#111827)",
								border: "1px solid rgba(255,255,255,.08)",
								boxShadow: "0 30px 80px rgba(0,0,0,.45)",
								textAlign: "center",
							}}
						>
							<Box
								sx={{
									fontSize: 44,
									mb: 1.5,
								}}
							>
								🔒
							</Box>

							<Box
								sx={{
									color: "#fff",
									fontSize: 28,
									fontWeight: 900,
									mb: 1,
								}}
							>
								Warehouse Access Required
							</Box>

							<Box
								sx={{
									color: "#94a3b8",
									fontSize: 14,
									fontWeight: 600,
									lineHeight: 1.6,
									mb: 3,
								}}
							>
								Your user does not currently have permission to open the Warehouse page.
								Ask an Admin to enable Warehouse Page Access from User Management.
							</Box>

							<Button
								onClick={() => {
									window.location.href = "/";
								}}
								sx={actionPrimary}
							>
								Back to Dashboard
							</Button>
						</Box>
					</Box>
				</div>
			</div>
		);
	}

	return (
		<div style={page}>
			<div style={content}>
				<div style={headerRow}>
					<div>
						<Box
							sx={{
								display: "flex",
								alignItems: "center",
								gap: 2,
							}}
						>
							<Box
								sx={{
									fontSize: 34,
									display: "flex",
									alignItems: "center",
									color: "#60a5fa",
								}}
							>
								🏭
							</Box>

							<div>
								<div style={logo}>
									Warehouse
								</div>

								<div style={subtitle}>
									Track warehouse movement and storage operations
								</div>
							</div>
						</Box>
					</div>

					<Box
						sx={{
							color: "#94a3b8",
							fontSize: 14,
							fontWeight: 600,
						}}
					>
						Total Items:{" "}
						<span
							style={{
								color: "#60a5fa",
								fontWeight: 800,
							}}
						>
							{filteredRows.length}
						</span>
					</Box>
				</div>
				<Box sx={searchPanel}>
					<SearchIcon
						sx={{
							color: "rgba(255,255,255,.45)",
						}}
					/>

					<TextField
						variant="standard"
						placeholder="Search by Item, SKU, PD No, Status or Client..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						InputProps={{ disableUnderline: true }}
						sx={{
							flex: 1,

							"& .MuiInputBase-root": {
								color: "#fff",
								fontSize: 14,
							},

							"& input::placeholder": {
								color: "rgba(255,255,255,.42)",
								opacity: 1,
							},
						}}
					/>

					<TextField
						select
						size="small"
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value)}
						sx={{
							minWidth: 210,
							...formFieldSx,

							"& .MuiOutlinedInput-root": {
								height: 44,
								borderRadius: "14px",
								background: "rgba(255,255,255,.04)",
								color: "#fff",

								"& fieldset": {
									borderColor: "rgba(255,255,255,.08)",
								},

								"&:hover fieldset": {
									borderColor: "rgba(59,130,246,.45)",
								},

								"&.Mui-focused fieldset": {
									borderColor: "#3b82f6",
								},
							},

							"& .MuiSelect-select": {
								color: "#fff",
								fontWeight: 500,
							},

							"& .MuiSvgIcon-root": {
								color: "#94a3b8",
							},
						}}
					>
						<MenuItem value="ALL">All Status</MenuItem>
						<MenuItem value="ON_FLOOR">🏭 On Floor</MenuItem>
						<MenuItem value="READY_TO_STORE">📦 Ready To Store</MenuItem>
						<MenuItem value="WAREHOUSE_REQUESTED">⏳ Warehouse Requested</MenuItem>
						<MenuItem value="IN_WAREHOUSE">✅ In Warehouse</MenuItem>
						<MenuItem value="WAREHOUSE_RETURN_REQUESTED">🔁 Return Requested</MenuItem>
					</TextField>
				</Box>
				<Box sx={compactToolbar}>
					<Box sx={toolbarLeft}>
						<Button
							variant="contained"
							onClick={exportCSV}
							sx={toolbarButton}
						>
							Export CSV
						</Button>

						<TextField
							select
							size="small"
							value={importMode}
							onChange={(e) => setImportMode(e.target.value)}
							sx={importModeFieldSx}
							SelectProps={{
								displayEmpty: true,
								renderValue: (selected) => {
									if (!selected) {
										return (
											<Box sx={importModePlaceholderSx}>
												<span>⬇️</span>
												<span>Select Import Mode</span>
											</Box>
										);
									}

									return (
										<Box sx={importModeValueSx}>
											<span>📦</span>
											<span>Create Inventory</span>
										</Box>
									);
								},
								MenuProps: {
									PaperProps: {
										sx: importModeMenuPaperSx,
									},
								},
							}}
						>
							<MenuItem value="" disabled sx={importModeDisabledOptionSx}>
								Select Import Mode
							</MenuItem>

							<MenuItem value="CREATE" sx={importModeOptionSx}>
								<Box sx={importModeOptionInnerSx}>
									<Box sx={importModeOptionIconSx}>
										📦
									</Box>

									<Box>
										<Box sx={importModeOptionTitleSx}>
											Create Inventory
										</Box>

										<Box sx={importModeOptionSubSx}>
											Upload new warehouse inventory records
										</Box>
									</Box>
								</Box>
							</MenuItem>
						</TextField>

						<Button
							component="label"
							variant="contained"
							disabled={!importMode}
							sx={{
								...toolbarButton,
								background: importMode
									? "linear-gradient(135deg,#059669,#10b981)"
									: "rgba(255,255,255,.08)",

								color: importMode
									? "#fff"
									: "rgba(255,255,255,.35)",

								"&:hover": {
									background: importMode
										? "linear-gradient(135deg,#047857,#059669)"
										: "rgba(255,255,255,.08)",
								},
							}}
						>
							Upload Excel
							<input
								type="file"
								hidden
								accept=".csv,.xlsx"
								onChange={handleUpload}
							/>
						</Button>

						<Button
							variant="outlined"
							onClick={async () => {
								const res = await fetch(
									`${API_BASE_URL}/api/warehouse/import/template`,
									{
										headers: { Authorization: `Bearer ${token}` },
									}
								);

								const blob = await res.blob();
								const url = window.URL.createObjectURL(blob);

								const a = document.createElement("a");
								a.href = url;
								a.download = "warehouse_import_template.csv";
								a.click();
							}}
							sx={toolbarButtonSecondary}
						>
							Download Template
						</Button>
					</Box>

					<Box sx={compactLegend}>
						<Chip
							label="Stored"
							sx={statusStored}
						/>

						<Chip
							label="Pending"
							sx={pendingChip}
						/>

						<Chip
							label="Return"
							sx={returnChip}
						/>
					</Box>
				</Box>


				<div style={wrap}>
					{Array.isArray(selectionModel) &&
						selectionModel.length > 0 &&
						isDispatch && (

							<div style={bulkBar}>
								<Box
									sx={{
										display: "flex",
										alignItems: "center",
										gap: 1,
										color: "#cbd5e1",
										fontWeight: 700,
										fontSize: 13,
									}}
								>
									<span>📦</span>

									<Box
										sx={{
											display: "flex",
											alignItems: "center",
											gap: 1,
										}}
									>
										<span>☑️</span>

										<span
											style={{
												fontWeight: 800,
											}}
										>
											{selectionModel.length} Selected
										</span>
									</Box>

									<Chip
										size="small"
										label={
											allSelectedWarehouseRequested
												? "Warehouse Requested"
												: allWarehouseItems
													? "Stored In Warehouse"
													: "Mixed Selection"
										}
										sx={{
											background:
												allSelectedWarehouseRequested || allWarehouseItems
													? "rgba(16,185,129,.15)"
													: "rgba(239,68,68,.15)",

											color:
												allSelectedWarehouseRequested || allWarehouseItems
													? "#34d399"
													: "#f87171",

											fontWeight: 700,
										}}
									/>
								</Box>

								<Box
									sx={{
										width: 1,
										height: 24,
										background: "rgba(255,255,255,.08)",
									}}
								/>

								<Button
									disabled={
										!canBulkApproveWarehouseThroughGatePass ||
										bulkWarehouseApproveLoading
									}
									onClick={() => {
										setBulkGatePassNumber("");
										setBulkWarehouseApproveOpen(true);
									}}
									sx={{
										minWidth: 260,
										height: 44,
										borderRadius: "14px",
										fontWeight: 800,
										textTransform: "none",
										background: canBulkApproveWarehouseThroughGatePass
											? "linear-gradient(180deg,#059669,#10b981)"
											: "#64748b",
										color: "#fff",
										boxShadow: canBulkApproveWarehouseThroughGatePass
											? "0 10px 25px rgba(16,185,129,.35)"
											: "none",

										"&:hover": {
											background: canBulkApproveWarehouseThroughGatePass
												? "linear-gradient(180deg,#10b981,#059669)"
												: "#64748b",
										},
									}}
								>
									{bulkWarehouseApproveLoading
										? "Processing..."
										: "✅ Bulk Approve Through Gate Pass"}
								</Button>

								<Button
									disabled={!allWarehouseItems || bulkLoading}
									onClick={bulkReturnToDispatch}
									sx={{
										minWidth: 220,
										height: 44,
										borderRadius: "14px",
										fontWeight: 800,
										textTransform: "none",
										background: allWarehouseItems
											? "linear-gradient(180deg,#f59e0b,#d97706)"
											: "#64748b",
										color: "#fff",
										boxShadow: allWarehouseItems
											? "0 10px 25px rgba(245,158,11,.35)"
											: "none",

										"&:hover": {
											background: allWarehouseItems
												? "linear-gradient(180deg,#fbbf24,#f59e0b)"
												: "#64748b",
										},
									}}
								>
									{bulkLoading
										? "Processing..."
										: "🔁 Bulk Return To Dispatch"}
								</Button>

								<Button
									size="small"
									onClick={() => {
										setSelectionModel([]);
										setBulkGatePassNumber("");
									}}
									sx={{
										minWidth: 100,
										borderRadius: "14px",
										color: "#94a3b8",
										border: "1px solid rgba(255,255,255,.06)",

										"&:hover": {
											background: "rgba(255,255,255,.04)",
											color: "#fff",
										},
									}}
								>
									Clear
								</Button>
							</div>
						)}
					<Box sx={tableWrapper}>
						<div style={{ width: "max-content", minWidth: "100%" }}>

							<div style={tableHeader}>
								<div>
									{columns[0].renderHeader()}
								</div>
								<div>Item Name</div>
								<div>SKU</div>
								<div>PD No</div>
								<div>DWG No.</div>
								<div>Description</div>
								<div>Client</div>
								<div>Plant</div>
								<div>Location</div>
								<div>Movement Status</div>
								<div>Factory Floor</div>
								<div>Warehouse</div>
								<div>Actions</div>
							</div>

							<div style={tableBody}>
								{paginatedRows.map((row) => (
									<div
										key={getWarehouseRowId(row)}
										style={tableRow}
									>
										<div>
											{columns[0].renderCell({ row })}
										</div>

										<div>
											{columns[1].renderCell({ row })}
										</div>

										<div>
											{columns[2].renderCell({
												value: row.sku,
												row,
											})}
										</div>

										<div>
											{columns[3].renderCell({
												value: row.pdNo,
												row,
											})}
										</div>

										<div>
											{columns[4].renderCell({
												value: row.drawingNo,
												row,
											})}
										</div>

										<div>
											{columns[5].renderCell({
												value: row.description,
												row,
											})}
										</div>

										<div>
											{columns[6].renderCell({
												value: row.clientName,
												row,
											})}
										</div>

										<div>
											{columns[7].renderCell({
												value: row.plantCode,
												row,
											})}
										</div>

										<div>
											{columns[8].renderCell({
												value: row.location,
												row,
											})}
										</div>

										<div style={movementStatusCellWrap}>
											{columns[9].renderCell({ row })}
										</div>

										<div>
											{columns[10].renderCell({ row })}
										</div>

										<div>
											{columns[11].renderCell({ row })}
										</div>

										<div>
											{columns[12].renderCell({ row })}
										</div>
									</div>
								))}
							</div>

						</div>
					</Box>
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
								onChange={(e) => setPageSize(Number(e.target.value))}
								sx={{
									width: 110,

									"& .MuiOutlinedInput-root": {
										height: 36,
										borderRadius: "12px",
										background: "rgba(255,255,255,.04)",
										color: "#fff",

										"& fieldset": {
											borderColor: "rgba(255,255,255,.08)",
										},

										"&:hover fieldset": {
											borderColor: "rgba(59,130,246,.35)",
										},
									},

									"& .MuiSvgIcon-root": {
										color: "#94a3b8",
									},
								}}
							>
								<MenuItem value={20}>20</MenuItem>
								<MenuItem value={30}>30</MenuItem>
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

						<Box
							sx={{
								display: "flex",
								alignItems: "center",
								gap: 3,
							}}
						>
							<Button
								disabled={pageNo === 1}
								onClick={() => setPageNo((p) => p - 1)}
								sx={{
									minWidth: 100,
									height: 30,
									borderRadius: "12px",
									background: "linear-gradient(180deg,#1e293b,#0f172a)",
									color: "#fff",
									border: "1px solid rgba(255,255,255,.08)",
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
									background: "linear-gradient(180deg,#0f172a,#111827)",
									color: "#cbd5e1",
									border: "1px solid rgba(255,255,255,.06)",
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
									{pageNo}
								</Box>
								of {totalPages}
							</Box>

							<Button
								disabled={pageNo === totalPages}
								onClick={() => setPageNo((p) => p + 1)}
								sx={{
									minWidth: 100,
									height: 30,
									borderRadius: "12px",
									background: "linear-gradient(180deg,#2563eb,#1d4ed8)",
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
					</Box>
				</div>
			</div>
			{bulkWarehouseApproveOpen && (
				<div
					style={popupOverlay}
					onClick={() => {
						if (!bulkWarehouseApproveLoading) {
							setBulkWarehouseApproveOpen(false);
						}
					}}
				>
					<div
						style={{
							...popupBox,
							maxWidth: 560,
						}}
						onClick={(e) => e.stopPropagation()}
					>
						<h2
							style={{
								marginBottom: 10,
								fontSize: 24,
								fontWeight: 900,
								color: "#fff",
							}}
						>
							Bulk Approve Warehouse
						</h2>

						<Box
							sx={{
								color: "#94a3b8",
								fontSize: 13,
								fontWeight: 700,
								mb: 2.5,
								lineHeight: 1.6,
							}}
						>
							Enter one gate pass number. It will be applied to all selected
							Warehouse Requested items.
						</Box>

						<Box
							sx={{
								p: 1.5,
								mb: 2,
								borderRadius: "14px",
								background: "rgba(16,185,129,.10)",
								border: "1px solid rgba(16,185,129,.18)",
								color: "#6ee7b7",
								fontWeight: 900,
							}}
						>
							{selectedWarehouseItems.length} item
							{selectedWarehouseItems.length > 1 ? "s" : ""} selected for approval
						</Box>

						<TextField
							fullWidth
							size="small"
							placeholder="Enter Gate Pass Number"
							value={bulkGatePassNumber}
							onChange={(e) => setBulkGatePassNumber(e.target.value)}
							sx={{
								mb: 2.5,
								...compactActionFieldSx,

								"& .MuiOutlinedInput-root": {
									...compactActionFieldSx["& .MuiOutlinedInput-root"],
									height: 44,
								},
							}}
						/>

						<Box
							sx={{
								display: "flex",
								justifyContent: "flex-end",
								gap: 1.5,
							}}
						>
							<Button
								disabled={bulkWarehouseApproveLoading}
								onClick={() => {
									setBulkWarehouseApproveOpen(false);
									setBulkGatePassNumber("");
								}}
								sx={{
									minWidth: 110,
									height: 38,
									borderRadius: "12px",
									color: "#cbd5e1",
									border: "1px solid rgba(255,255,255,.08)",
									textTransform: "none",
									fontWeight: 800,
								}}
							>
								Cancel
							</Button>

							<Button
								disabled={
									bulkWarehouseApproveLoading ||
									!bulkGatePassNumber.trim()
								}
								onClick={bulkApproveWarehouseThroughGatePass}
								sx={{
									minWidth: 170,
									height: 38,
									borderRadius: "12px",
									color: "#fff",
									background: bulkGatePassNumber.trim()
										? "linear-gradient(135deg,#059669,#10b981)"
										: "#64748b",
									textTransform: "none",
									fontWeight: 900,

									"&:hover": {
										background: bulkGatePassNumber.trim()
											? "linear-gradient(135deg,#047857,#059669)"
											: "#64748b",
									},
								}}
							>
								{bulkWarehouseApproveLoading
									? "Approving..."
									: "Approve Selected"}
							</Button>
						</Box>
					</div>
				</div>
			)}
			{gatePassPopup && (
				<div
					style={popupOverlay}
					onClick={() => {
						if (gatePassPopup?.previewUrl) {
							URL.revokeObjectURL(gatePassPopup.previewUrl);
						}
						setGatePassPopup(null);
					}}
				>
					<div
						style={popupBox}
						onClick={(e) => e.stopPropagation()}
					>
						<h2
							style={{
								marginBottom: 20,
								fontSize: 24,
								fontWeight: 800,
								color: "#fff",
							}}
						>
							Gate Pass Preview
						</h2>

						<div style={gatePassNumber}>
							{gatePassPopup.gatePass}
						</div>

						{gatePassPopup?.previewUrl && (
							<iframe
								src={gatePassPopup.previewUrl}
								style={{
									width: "100%",
									height: "420px",
									border: "none",
									borderRadius: 8,
									marginBottom: 12,
								}}
							/>
						)}

						<Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
							<Button
								variant="contained"
								sx={{
									minWidth: 140,

									borderRadius: "14px",

									background:
										"linear-gradient(180deg,#1e293b,#0f172a)",

									border:
										"1px solid rgba(255,255,255,.08)",

									color: "#fff",
								}}
								onClick={() => {
									try {
										if (!gatePassPopup?.previewUrl) {
											alert("No file available");
											return;
										}

										const a = document.createElement("a");
										a.href = gatePassPopup.previewUrl;
										a.download = `GATE_PASS_${gatePassPopup.gatePass}.pdf`;
										a.click();

									} catch (err) {
										console.error(err);
										alert("Download failed");
									}
								}}
							>
								Download Gate Pass
							</Button>
							<Button
								onClick={() => {
									if (gatePassPopup?.previewUrl) {
										URL.revokeObjectURL(gatePassPopup.previewUrl);
									}
									setGatePassPopup(null);
								}}
							>
								Close
							</Button>

						</Box>
					</div>
				</div>
			)}
			{previewOpen && (
				<div style={popupOverlay}>
					<div style={{ ...popupBox, width: 1000 }}>

						<h2
							style={{
								marginBottom: 20,
								fontSize: 24,
								fontWeight: 800,
								color: "#fff",
							}}
						>
							Import Preview
						</h2>

						<div style={{ maxHeight: 400, overflow: "auto" }}>
							{previewRows.map((row, i) => (
								<div
									key={i}
									style={{
										display: "flex",
										justifyContent: "space-between",
										padding: 8,
										borderBottom: "1px solid #eee",
										background: row.valid
											? "rgba(16,185,129,.12)"
											: "rgba(239,68,68,.12)",

										color: "#fff",
									}}
								>
									<span>
										{row.zohoItemId || "New Item"} | 📍 {row.location || "-"}
									</span>
									<span>{row.valid ? "✅ Valid" : `❌ ${row.error}`}</span>
								</div>
							))}
						</div>

						<Box sx={{ display: "flex", gap: 2, mt: 2 }}>

							<Button
								variant="contained"
								onClick={async () => {
									const formData = new FormData();
									formData.append("file", uploadFile);
									formData.append("mode", importMode);

									const res = await fetch(`${API_BASE_URL}/api/warehouse/import/confirm`, {
										method: "POST",
										headers: {
											Authorization: `Bearer ${token}`,
											"X-Username": localStorage.getItem("username"),
										},
										body: formData,
									});

									if (!res.ok) {
										const text = await res.text();
										alert("Import failed: " + text);
										return;
									}

									setPreviewOpen(false);
									fetchItems();
								}}
								sx={{
									minWidth: 140,

									borderRadius: "14px",

									background:
										"linear-gradient(180deg,#1e293b,#0f172a)",

									border:
										"1px solid rgba(255,255,255,.08)",

									color: "#fff",
								}}
							>
								Confirm Import
							</Button>

							<Button
								sx={{
									minWidth: 120,

									borderRadius: "14px",

									color: "#cbd5e1",

									border:
										"1px solid rgba(255,255,255,.08)",
								}}
								onClick={() => setPreviewOpen(false)}
							>
								Cancel
							</Button>

						</Box>
					</div>
				</div>
			)}
		</div>
	);
}

/* ===================== STYLES ===================== */
const warehouseGrid =
	"52px 220px 120px 85px 85px 150px 145px 140px 190px 300px 110px 190px 520px";

const content = {
	padding: "18px 24px",
	display: "flex",
	flexDirection: "column",
	gap: 12,
};

const wrap = {
	background:
		"linear-gradient(180deg,#0f172a,#111827)",
	borderRadius: 20,
	padding: 16,
	border:
		"1px solid rgba(255,255,255,.06)",
};

const tableHeader = {
	position: "sticky",
	top: 0,
	zIndex: 20,

	display: "grid",
	gridTemplateColumns: warehouseGrid,

	padding: "11px 12px",

	background: "#111827",
	color: "#94a3b8",

	fontWeight: 800,
	fontSize: 13,
};

const tableRow = {
	display: "grid",
	gridTemplateColumns: warehouseGrid,

	alignItems: "center",

	padding: "10px 12px",

	color: "#fff",

	borderTop:
		"1px solid rgba(255,255,255,.06)",

	minHeight: 48,

	fontSize: 13,
};

const searchPanel = {
	display: "flex",
	alignItems: "center",
	gap: 10,

	height: 44,

	padding: "0 14px",

	borderRadius: 14,

	background: "rgba(255,255,255,0.03)",

	border:
		"1px solid rgba(255,255,255,.06)",
};

const page = {
	minHeight: "100vh",
	background:
		"linear-gradient(135deg,#020617,#0f172a)",
};

const headerRow = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	marginBottom: 2,
};

const logo = {
	color: "#fff",
	fontSize: 32,
	fontWeight: 900,
	marginBottom: 8,
};

const subtitle = {
	color: "rgba(255,255,255,.62)",
	fontSize: 14,
};

const compactActionFieldSx = {
	"& .MuiOutlinedInput-root": {
		height: 32,
		borderRadius: "12px",
		background: "rgba(255,255,255,.04)",
		color: "#fff",
		fontSize: 12,

		"& fieldset": {
			borderColor: "rgba(255,255,255,.08)",
		},

		"&:hover fieldset": {
			borderColor: "rgba(59,130,246,.35)",
		},

		"&.Mui-focused fieldset": {
			borderColor: "#3b82f6",
		},
	},

	"& input": {
		color: "#fff",
		fontSize: 12,
		fontWeight: 700,
		padding: "7px 10px",
	},

	"& input::placeholder": {
		color: "rgba(255,255,255,.45)",
		opacity: 1,
	},
};

const tableWrapper = {
	overflowX: "auto",
	scrollbarWidth: "thin",
	scrollbarColor: "#3b82f6 #0f172a",
	WebkitOverflowScrolling: "touch",

	"&::-webkit-scrollbar": {
		height: 14,
	},

	"&::-webkit-scrollbar-track": {
		background:
			"linear-gradient(180deg,#0f172a,#111827)",
		borderRadius: 999,
	},

	"&::-webkit-scrollbar-thumb": {
		background:
			"linear-gradient(90deg,#2563eb,#60a5fa)",
		borderRadius: 999,
		border:
			"2px solid #0f172a",
		boxShadow:
			"0 0 16px rgba(59,130,246,.55)",
	},

	"&::-webkit-scrollbar-thumb:hover": {
		background:
			"linear-gradient(90deg,#3b82f6,#93c5fd)",
	},
};

const tableBody = {
	display: "flex",
	flexDirection: "column",
};

const compactToolbar = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 1.5,
	flexWrap: "wrap",
	marginTop: 0,
	marginBottom: 0,
};

const toolbarLeft = {
	display: "flex",
	alignItems: "center",
	gap: 1.2,
	flexWrap: "wrap",
};

const toolbarButton = {
	height: 36,
	px: 2,
	borderRadius: "12px",
	textTransform: "none",
	fontWeight: 700,
	fontSize: 12,
	background: "linear-gradient(135deg,#1e293b,#0f172a)",
	border: "1px solid rgba(255,255,255,.08)",
	color: "#fff",
	boxShadow: "none",

	"&:hover": {
		background: "linear-gradient(135deg,#334155,#1e293b)",
	},
};

const simpleCellText = {
	color: "#ffffff",
	fontWeight: 800,
	fontSize: 13,
	lineHeight: 1.25,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
	display: "block",
};

const simpleMutedText = {
	color: "#f1f5f9",
	fontWeight: 750,
	fontSize: 13,
	lineHeight: 1.25,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
	display: "block",
};

const simpleMonoText = {
	color: "#ffffff",
	fontWeight: 800,
	fontSize: 13,
	lineHeight: 1.25,
	fontFamily: "monospace",
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
	display: "block",
};

const toolbarButtonSecondary = {
	height: 36,
	px: 2,
	borderRadius: "12px",
	textTransform: "none",
	fontWeight: 700,
	fontSize: 12,
	color: "#cbd5e1",
	border: "1px solid rgba(255,255,255,.08)",
	background: "rgba(255,255,255,.03)",

	"&:hover": {
		background: "rgba(255,255,255,.06)",
		borderColor: "rgba(59,130,246,.45)",
	},
};

const compactLegend = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	padding: "6px 10px",
	borderRadius: 14,
	background: "rgba(255,255,255,.03)",
	border: "1px solid rgba(255,255,255,.06)",
};

const formFieldSx = {
	"& .MuiOutlinedInput-root": {
		borderRadius: "16px",

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
			borderColor:
				"#3b82f6",
		},
	},

	"& input": {
		color: "#fff",
	},
};

const compactFieldSx = {
	"& .MuiOutlinedInput-root": {
		height: 36,
		borderRadius: "12px",
		background: "rgba(255,255,255,.04)",
		color: "#fff",
		fontSize: 12,

		"& fieldset": {
			borderColor: "rgba(255,255,255,.08)",
		},

		"&:hover fieldset": {
			borderColor: "rgba(59,130,246,.35)",
		},

		"&.Mui-focused fieldset": {
			borderColor: "#3b82f6",
		},
	},

	"& .MuiSelect-select": {
		color: "#fff",
		fontWeight: 600,
		fontSize: 12,
		paddingTop: "8px",
		paddingBottom: "8px",
	},

	"& .MuiSvgIcon-root": {
		color: "#94a3b8",
	},

	"& input": {
		color: "#fff",
		fontSize: 12,
	},
};

const warehouseSelectMenuSx = {
	mt: 1,
	borderRadius: "14px",
	background: "#f8fafc",
	color: "#0f172a",
	border: "1px solid rgba(15,23,42,.12)",
	boxShadow: "0 20px 50px rgba(0,0,0,.35)",

	"& .MuiMenuItem-root": {
		fontSize: 13,
		fontWeight: 700,
		color: "#0f172a",
		minHeight: 36,
	},

	"& .MuiMenuItem-root:hover": {
		background: "rgba(59,130,246,.12)",
	},

	"& .Mui-selected": {
		background: "rgba(59,130,246,.18) !important",
	},
};

const importModeFieldSx = {
	width: 230,

	"& .MuiOutlinedInput-root": {
		height: 38,
		borderRadius: "14px",
		background:
			"linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.025))",
		color: "#fff",
		fontSize: 12,
		border: "1px solid rgba(59,130,246,.16)",
		boxShadow:
			"inset 0 1px 0 rgba(255,255,255,.05), 0 8px 22px rgba(2,6,23,.20)",

		"& fieldset": {
			borderColor: "rgba(255,255,255,.08)",
		},

		"&:hover fieldset": {
			borderColor: "rgba(96,165,250,.45)",
		},

		"&.Mui-focused fieldset": {
			borderColor: "#3b82f6",
			boxShadow: "0 0 0 3px rgba(59,130,246,.14)",
		},
	},

	"& .MuiSelect-select": {
		display: "flex",
		alignItems: "center",
		color: "#fff",
		fontWeight: 800,
		fontSize: 12,
		paddingTop: "8px",
		paddingBottom: "8px",
	},

	"& .MuiSvgIcon-root": {
		color: "#60a5fa",
	},
};

const importModePlaceholderSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	color: "#94a3b8",
	fontWeight: 800,
	fontSize: 12,
};

const importModeValueSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	color: "#e0f2fe",
	fontWeight: 900,
	fontSize: 12,
};

const importModeMenuPaperSx = {
	mt: 1,
	borderRadius: "18px",
	background:
		"linear-gradient(180deg,#0f172a,#111827)",
	color: "#fff",
	border: "1px solid rgba(255,255,255,.08)",
	boxShadow: "0 24px 70px rgba(0,0,0,.55)",
	overflow: "hidden",

	"& .MuiMenuItem-root": {
		color: "#fff",
	},
};

const importModeDisabledOptionSx = {
	fontSize: 12,
	fontWeight: 800,
	color: "#64748b !important",
	opacity: "1 !important",
};

const importModeOptionSx = {
	px: 1.4,
	py: 1.2,
	borderRadius: "14px",
	mx: 1,
	my: 0.6,

	"&:hover": {
		background: "rgba(59,130,246,.14)",
	},

	"&.Mui-selected": {
		background: "rgba(59,130,246,.18) !important",
	},

	"&.Mui-selected:hover": {
		background: "rgba(59,130,246,.24) !important",
	},
};

const importModeOptionInnerSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.3,
	width: "100%",
};

const importModeOptionIconSx = {
	width: 34,
	height: 34,
	borderRadius: "12px",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	background:
		"linear-gradient(135deg, rgba(37,99,235,.28), rgba(59,130,246,.16))",
	border: "1px solid rgba(96,165,250,.18)",
	boxShadow: "0 8px 20px rgba(37,99,235,.18)",
};

const importModeOptionTitleSx = {
	color: "#fff",
	fontSize: 13,
	fontWeight: 900,
	lineHeight: 1.2,
};

const importModeOptionSubSx = {
	color: "#94a3b8",
	fontSize: 11,
	fontWeight: 700,
	mt: 0.3,
};

const actionCell = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	flexWrap: "nowrap",
	whiteSpace: "nowrap",
};

const movementStatusCellWrap = {
	minWidth: 0,
	overflow: "hidden",
};

const movementStatusCell = {
	display: "flex",
	alignItems: "center",
	gap: 0.7,
	flexWrap: "nowrap",
	whiteSpace: "nowrap",
	minWidth: 0,
	maxWidth: "100%",
	overflow: "hidden",
};

const movementStatusChipSx = {
	maxWidth: 210,
	minWidth: 0,
	flexShrink: 1,

	"& .MuiChip-label": {
		display: "block",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
		paddingLeft: "10px",
		paddingRight: "10px",
	},
};

const statusViewButton = {
	minWidth: 52,
	width: 52,
	height: 26,

	borderRadius: "8px",

	px: 0,

	fontSize: 10,
	fontWeight: 900,

	lineHeight: 1,

	flexShrink: 0,

	textTransform: "none",

	background:
		"linear-gradient(135deg,#2563eb,#3b82f6)",

	color: "#fff",

	border:
		"1px solid rgba(59,130,246,.35)",

	boxShadow:
		"0 6px 14px rgba(37,99,235,.25)",

	"&:hover": {
		background:
			"linear-gradient(135deg,#1d4ed8,#2563eb)",
	},
};

const statusBase = {
	fontSize: 12,

	fontWeight: 800,

	height: 28,

	borderRadius: "999px",

	px: 1.8,

	letterSpacing: ".25px",

	border:
		"1px solid rgba(255,255,255,.08)",

	backdropFilter: "blur(10px)",

	boxShadow:
		"0 6px 16px rgba(0,0,0,.18)",
};

const statusPacked = {
	...statusBase,

	color: "#93c5fd",

	background:
		"rgba(37,99,235,.15)",
};

const selectHeaderCellSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
};

const selectCheckboxStyle = {
	width: 16,
	height: 16,
	cursor: "pointer",
	accentColor: "#3b82f6",
};

const selectCheckboxDisabledStyle = {
	...selectCheckboxStyle,
	opacity: 0.35,
	cursor: "not-allowed",
};

const statusStored = {
	...statusBase,

	color: "#6ee7b7",

	background:
		"rgba(16,185,129,.15)",
};

const pendingChip = {
	...statusBase,

	color: "#fcd34d",

	background:
		"rgba(245,158,11,.15)",
};

const returnChip = {
	...statusBase,

	color: "#fca5a5",

	background:
		"rgba(239,68,68,.15)",
};

const bulkBar = {
	position: "fixed",

	bottom: 24,

	left: "50%",

	transform: "translateX(-50%)",

	display: "flex",

	alignItems: "center",

	gap: 14,

	padding: "12px 18px",

	background:
		"rgba(15,23,42,.94)",

	border:
		"1px solid rgba(255,255,255,.08)",

	borderRadius: 18,

	backdropFilter: "blur(24px)",

	boxShadow:
		"0 20px 50px rgba(0,0,0,.45)",

	color: "#fff",

	zIndex: 3000,
};

const tableActionButton = {
	minWidth: 82,
	height: 32,
	borderRadius: 12,
	fontWeight: 800,
	fontSize: 11.5,
	textTransform: "none",
	px: 1.5,
};

const actionPrimary = {
	...tableActionButton,

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

const actionSuccess = {
	...tableActionButton,

	background:
		"linear-gradient(135deg,#059669,#10b981)",

	color: "#fff",

	border:
		"1px solid rgba(16,185,129,.35)",

	boxShadow:
		"0 10px 24px rgba(16,185,129,.28)",

	"&:hover": {
		background:
			"linear-gradient(135deg,#047857,#059669)",
	},
};

const actionDanger = {
	...tableActionButton,

	background:
		"linear-gradient(135deg,#dc2626,#ef4444)",

	color: "#fff",

	boxShadow:
		"0 10px 24px rgba(239,68,68,.28)",

	"&:hover": {
		background:
			"linear-gradient(135deg,#b91c1c,#dc2626)",
	},
};

const actionWarning = {
	...tableActionButton,

	minWidth: 150,

	background:
		"linear-gradient(135deg,#f59e0b,#d97706)",

	color: "#fff",

	boxShadow:
		"0 10px 24px rgba(245,158,11,.30)",

	"&:hover": {
		background:
			"linear-gradient(135deg,#fbbf24,#f59e0b)",
	},
};

const actionInfo = {
	...tableActionButton,

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

const popupOverlay = {
	position: "fixed",
	top: 0,
	left: 0,
	width: "100%",
	height: "100%",
	background: "rgba(15,23,42,0.55)",
	backdropFilter: "blur(8px)",
	WebkitBackdropFilter: "blur(8px)",
	display: "flex",
	justifyContent: "center",
	alignItems: "center",
	zIndex: 9999,
};

const popupBox = {
	width: "90%",
	maxWidth: 1100,

	maxHeight: "90vh",

	overflow: "auto",

	borderRadius: 24,

	padding: 24,

	background:
		"linear-gradient(180deg,#0f172a,#111827)",

	color: "#fff",

	border:
		"1px solid rgba(255,255,255,.06)",

	boxShadow:
		"0 30px 80px rgba(0,0,0,.55)",
};


const gatePassNumber = {
	fontSize: 30,

	fontWeight: 900,

	color: "#60a5fa",

	letterSpacing: 2,

	marginBottom: 24,
};

export default WarehousePage;