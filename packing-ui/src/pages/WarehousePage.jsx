import { useEffect, useState, useMemo, useRef } from "react";
import { Button, TextField, Box, Chip, MenuItem, Drawer, IconButton } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { API_BASE_URL } from "../config";
import { secureFetch } from "../services/api";
import {
	canOpenWarehousePage,
	normalizeRole,
} from "../utils/permissions";
import { useAuth } from "../auth/AuthContext";
import usePackFlowDataRefresh
	from "../dashboard/hooks/usePackFlowDataRefresh";
import {
	publishPackFlowDataChanged,
} from "../utils/packFlowDataEvents";


/*
 * Warehouse register table geometry — frontend only.
 *
 * The existing columns[] renderers remain the source of truth for values,
 * permissions and every warehouse action. This layout controls presentation
 * and resize limits only, mirroring the cleaner Dispatch register treatment.
 */
const WAREHOUSE_COLUMN_LAYOUT = [
	{ key: "select", label: "", width: 64, min: 54, max: 110 },
	{ key: "name", label: "Item Name", width: 300, min: 210, max: 680 },
	{ key: "sku", label: "SKU", width: 210, min: 150, max: 560 },
	{ key: "pdNo", label: "PD No", width: 130, min: 90, max: 300 },
	{ key: "drawingNo", label: "DWG No.", width: 155, min: 105, max: 360 },
	{ key: "description", label: "Description", width: 300, min: 180, max: 760 },
	{ key: "clientName", label: "Client", width: 210, min: 150, max: 560 },
	{ key: "plantCode", label: "Plant", width: 155, min: 110, max: 300 },
	{ key: "location", label: "Location", width: 210, min: 130, max: 460 },
	{ key: "status", label: "Movement Status", width: 310, min: 220, max: 560 },
	{ key: "factoryFloor", label: "Factory Floor", width: 155, min: 110, max: 320 },
	{ key: "warehouseCode", label: "Warehouse", width: 200, min: 130, max: 420 },
	{ key: "actions", label: "Actions", width: 540, min: 340, max: 900 },
];

const getWarehouseDrawerStatusLabel = (row) => {
	const status = String(
		row?.status ||
		row?.movementStatus ||
		""
	).trim().toUpperCase();

	const labels = {
		ON_FLOOR: "On Floor / WIP Packed",
		READY_TO_STORE: "Ready To Store",
		WAREHOUSE_REQUESTED: "Warehouse Requested",
		IN_WAREHOUSE: "Stored in Warehouse",
		WAREHOUSE_RETURN_REQUESTED: "Return Requested",
	};

	return labels[status] || status || "—";
};

const formatWarehouseDrawerDateTime = (value) => {
	if (!value) return "—";

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return String(value);
	}

	return new Intl.DateTimeFormat("en-IN", {
		day: "2-digit",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
	}).format(date);
};


function WarehousePage() {
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(false);
	const [search, setSearch] = useState("");
	const [gatePassPopup, setGatePassPopup] = useState(null);
	const [approveGatePass, setApproveGatePass] = useState({});

	const {
		user,
		hasRole,
	} = useAuth();

	const canOpenWarehouse =
		canOpenWarehousePage(user);

	const isAdmin =
		hasRole("ADMIN");

	const isDispatch =
		hasRole("DISPATCH");

	const isPacking =
		hasRole("PACKING");

	const isWarehouse =
		hasRole("WAREHOUSE");

	const isLogistics =
		hasRole("LOGISTICS");

	/*
	 * Important:
	 * warehouseAccess permits opening the page.
	 *
	 * It must not grant warehouse approval authority.
	 * Backend approval is ADMIN or WAREHOUSE only.
	 */
	const canApproveWarehouse =
		isAdmin ||
		isWarehouse;

	const WAREHOUSE_OPTIONS = [
		"BLS-WH-1",
		"RTP-WH-2",
		"AL-P1",
		"AL-P2",
		"AL-P3",
		"AL-P4",
	];

	const FROM_LOCATION_OPTIONS = [
		"AL-P1-FG-1-A",
		"AL-P1-FG-1-B",
		"AL-P1-FG-1-C",
		"AL-P2-FG-2",
		"AL-P3-FG-3",
		"AL-P4-FG-4",
		"AL-P1",
		"AL-P2",
		"AL-P3",
		"AL-P4",
		"AL-P1-PKD-1",
		"AL-P2-PKD-2",
		"AL-P3-PKD-3",
		"AL-P4-PKD-4",
	];
	const [importMode, setImportMode] = useState("");
	const [previewRows, setPreviewRows] = useState([]);
	const [previewOpen, setPreviewOpen] = useState(false);
	const [uploadFile, setUploadFile] = useState(null);
	const [selectionModel, setSelectionModel] = useState([]);
	const [bulkLoading, setBulkLoading] = useState(false);
	const [bulkReturnDecisionLoading, setBulkReturnDecisionLoading] = useState("");
	const [statusFilter, setStatusFilter] = useState("ALL");
	const [bulkWarehouseApproveOpen, setBulkWarehouseApproveOpen] =
		useState(false);
	const [bulkWarehouseApproveLoading, setBulkWarehouseApproveLoading] =
		useState(false);
	const [bulkGatePassNumber, setBulkGatePassNumber] = useState("");
	const [bulkLocationOpen, setBulkLocationOpen] = useState(false);
	const [bulkLocationLoading, setBulkLocationLoading] = useState(false);
	const [bulkLocationForm, setBulkLocationForm] = useState({
		plantCode: "",
		currentLocationCode: "",
		warehouseCode: "",
		fgZoneCode: "",
	});
	const [pageNo, setPageNo] = useState(1);
	const [pageSize, setPageSize] = useState(20);

	const [
		warehouseColumnWidths,
		setWarehouseColumnWidths,
	] = useState(() =>
		WAREHOUSE_COLUMN_LAYOUT.map(
			(column) => column.width
		)
	);

	const warehouseColumnResizeRef =
		useRef(null);

	const [
		warehouseItemDrawerRow,
		setWarehouseItemDrawerRow,
	] = useState(null);


	const [plants, setPlants] = useState([]);
	const [assignmentDrafts, setAssignmentDrafts] = useState({});
	const [savingAssignmentId, setSavingAssignmentId] = useState(null);
	const [generatingMissingGatePass, setGeneratingMissingGatePass] =
		useState(false);

	/*
	 * ADMIN-only permanent Warehouse deletion.
	 *
	 * Warehouse Excel imports are standalone DispatchedItem rows and may not
	 * have PacketItem linkage. The dedicated Admin deletion API resolves both
	 * standalone imports and linked PackFlow rows safely before deletion.
	 */
	const [warehouseDeleteOpen, setWarehouseDeleteOpen] = useState(false);
	const [warehouseDeleteMode, setWarehouseDeleteMode] = useState("SINGLE");
	const [warehouseDeleteRows, setWarehouseDeleteRows] = useState([]);
	const [warehouseDeletePreview, setWarehouseDeletePreview] = useState(null);
	const [warehouseDeletePreviewLoading, setWarehouseDeletePreviewLoading] = useState(false);
	const [warehouseDeleteReason, setWarehouseDeleteReason] = useState("");
	const [warehouseDeleteConfirmation, setWarehouseDeleteConfirmation] = useState("");
	const [warehouseDeleteExecuting, setWarehouseDeleteExecuting] = useState(false);
	const [warehouseDeleteError, setWarehouseDeleteError] = useState("");
	/* ===================== FETCH ===================== */

	const fetchPlants = async () => {
		try {
			const res = await secureFetch(`${API_BASE_URL}/api/plants`, {
				credentials: "include",
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

	const fetchItems = async ({ background = false } = {}) => {
		if (!canOpenWarehouse) {
			setRows([]);
			return;
		}

		if (!background) {
			setLoading(true);
		}

		try {
			const [res1, res2] = await Promise.all([
				secureFetch(`${API_BASE_URL}/api/warehouse/floor`, {
					credentials: "include",
				}),
				secureFetch(`${API_BASE_URL}/api/warehouse/items`, {
					credentials: "include",
				}),
			]);

			if (!res1.ok || !res2.ok) {
				if (
					!background &&
					(res1.status === 403 || res2.status === 403)
				) {
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
					/*
					 * Keep backend-supplied read-only metadata available to the
					 * details drawer while preserving the existing normalized
					 * Warehouse fields below as the authoritative values.
					 */
					...item,
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

			/*
			 * A transient background-sync failure must not blank the live register.
			 * Foreground/manual initial loading keeps the original failure behaviour.
			 */
			if (!background) {
				setRows([]);
			}
		} finally {
			if (!background) {
				setLoading(false);
			}
		}
	};

	usePackFlowDataRefresh(
		"warehouse",
		async (detail) => {
			if (!canOpenWarehouse) {
				setRows([]);
				return;
			}

			await fetchItems({
				background:
					Boolean(detail?.background),
			});
		},
		{
			intervalMs: 6000,
		}
	);

	useEffect(() => {
		if (!canOpenWarehouse) {
			setRows([]);
			return;
		}

		fetchPlants();
		fetchItems();
	}, [canOpenWarehouse]);

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
			"gatePassNumber",
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

		const res = await secureFetch(`${API_BASE_URL}/api/warehouse/import/preview`, {
			method: "POST",
			credentials: "include",
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

		const res = await secureFetch(
			`${API_BASE_URL}/api/warehouse/${encodeURIComponent(id)}/approve?gatePass=${encodeURIComponent(gp.trim())}`,
			{
				method: "POST",
				credentials: "include",
			}
		);

		if (!res.ok) {
			const text = await res.text();
			alert(text || "Gate pass approval failed");
			return;
		}

		setApproveGatePass((prev) => {
			const copy = { ...prev };
			delete copy[id];
			return copy;
		});

		fetchItems();
	};

	const rejectWarehouse = async (id) => {
		try {
			const res = await secureFetch(
				`${API_BASE_URL}/api/warehouse/${id}/reject`,
				{
					method: "POST",
					credentials: "include",
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
			const endpoint = isAdmin
				? `${API_BASE_URL}/api/warehouse/admin/${encodeURIComponent(id)}/request-return-to-dispatch`
				: `${API_BASE_URL}/api/dispatched/${encodeURIComponent(id)}/request-return`;

			const res = await secureFetch(endpoint, {
				method: "POST",
				credentials: "include",
			});

			if (!res.ok) {
				const text = await res.text();
				throw new Error(text || "Return request failed");
			}

			await fetchItems();
		} catch (err) {
			console.error(err);
			alert(err.message || "Return request failed");
		}
	};

	const bulkReturnToDispatch = async () => {

		if (!isAdmin) {
			alert("Only Admin can bulk return warehouse items to Dispatch");
			return;
		}

		if (selectionModel.length === 0) {
			alert("Select items first");
			return;
		}

		if (!allWarehouseItems) {
			alert("Bulk Return is available only for items currently stored in Warehouse");
			return;
		}

		const confirmBulk = window.confirm(
			`Request Return to Dispatch for ${selectionModel.length} selected warehouse item(s)?`
		);

		if (!confirmBulk) return;

		try {
			setBulkLoading(true);

			const res = await secureFetch(
				`${API_BASE_URL}/api/warehouse/admin/returns/bulk/request`,
				{
					method: "POST",
					credentials: "include",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(selectionModel),
				}
			);

			if (!res.ok) {
				const text = await res.text();
				throw new Error(text || "Bulk return request failed");
			}

			setSelectionModel([]);
			await fetchItems();

		} catch (err) {

			console.error(err);
			alert(err.message || "Bulk return request failed");

		} finally {

			setBulkLoading(false);

		}
	};

	const selectableStatuses = [
		"WAREHOUSE_REQUESTED",
		"IN_WAREHOUSE",
		"WAREHOUSE_RETURN_REQUESTED",
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

	const isWarehouseRowSelectable = (row) => {
		const id = getWarehouseRowId(row);
		const status = getWarehouseStatus(row);

		if (!id) {
			return false;
		}

		/* ADMIN may select any row visible on this Warehouse page for delete. */
		if (isAdmin) {
			return true;
		}

		/* Preserve the original non-Admin bulk-action selection rules. */
		return selectableStatuses.includes(status);
	};

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

	const getLocationOptions = (plantCode, currentValue = "") => {
		const options = [
			...FROM_LOCATION_OPTIONS,
		];

		if (currentValue && currentValue !== "-") {
			options.unshift(currentValue);
		}

		return Array.from(new Set(options)).filter(Boolean);
	};

	const getWarehouseOptions = (plantCode, currentValue = "") => {
		const options = [
			...WAREHOUSE_OPTIONS,
		];

		if (currentValue && currentValue !== "-") {
			options.unshift(currentValue);
		}

		return Array.from(new Set(options)).filter(Boolean);
	};

	const getAssignmentDraft = (row) => {
		const id = getWarehouseRowId(row);
		return assignmentDrafts[id] || null;
	};

	const isAssignmentEditing = (row) => {
		return Boolean(getAssignmentDraft(row));
	};

	const startAssignmentEdit = (row) => {
		if (!isAdmin) {
			return;
		}

		const id = getWarehouseRowId(row);

		if (!id) {
			alert("Row ID missing. Cannot edit location.");
			return;
		}

		setAssignmentDrafts((prev) => ({
			...prev,
			[id]: {
				plantCode: row.plantCode || "",
				currentLocationCode:
					row.currentLocationCode && row.currentLocationCode !== "-"
						? row.currentLocationCode
						: row.location && row.location !== "-"
							? row.location
							: "",
				warehouseCode:
					row.warehouseCode && row.warehouseCode !== "-"
						? row.warehouseCode
						: "",
				fgZoneCode: row.fgZoneCode || "",
			},
		}));
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

			const res = await secureFetch(
				`${API_BASE_URL}/api/warehouse/admin/${encodeURIComponent(id)}/location`,
				{
					method: "PATCH",
					credentials: "include",
					headers: {
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

	const openBulkLocationEdit = () => {
		if (!isAdmin) {
			return;
		}

		if (!allWarehouseItems || selectedWarehouseItems.length === 0) {
			alert("Select only items currently stored in Warehouse");
			return;
		}

		const commonValue = (getter) => {
			const values = Array.from(
				new Set(
					selectedWarehouseItems
						.map((row) => String(getter(row) || "").trim())
						.filter(Boolean)
				)
			);

			return values.length === 1 ? values[0] : "";
		};

		setBulkLocationForm({
			plantCode: commonValue((row) => row.plantCode),
			currentLocationCode: commonValue(
				(row) => row.currentLocationCode || row.location
			),
			warehouseCode: commonValue((row) => row.warehouseCode),
			fgZoneCode: commonValue((row) => row.fgZoneCode),
		});

		setBulkLocationOpen(true);
	};

	const saveBulkLocation = async () => {
		if (!isAdmin) {
			return;
		}

		if (!bulkLocationForm.plantCode) {
			alert("Please select Plant");
			return;
		}

		if (selectedWarehouseItems.length === 0 || !allWarehouseItems) {
			alert("Selected warehouse items are no longer valid for bulk location edit");
			setBulkLocationOpen(false);
			return;
		}

		try {
			setBulkLocationLoading(true);

			const res = await secureFetch(
				`${API_BASE_URL}/api/warehouse/admin/bulk-location`,
				{
					method: "PATCH",
					credentials: "include",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						itemIds: selectedWarehouseItems.map((row) =>
							getWarehouseRowId(row)
						),
						plantCode: bulkLocationForm.plantCode,
						currentLocationCode:
							bulkLocationForm.currentLocationCode || null,
						warehouseCode:
							bulkLocationForm.warehouseCode || null,
						fgZoneCode:
							bulkLocationForm.fgZoneCode || null,
					}),
				}
			);

			if (!res.ok) {
				const text = await res.text();
				throw new Error(text || "Bulk location update failed");
			}

			setBulkLocationOpen(false);
			setSelectionModel([]);
			await fetchItems();
		} catch (err) {
			console.error(err);
			alert(err.message || "Bulk location update failed");
		} finally {
			setBulkLocationLoading(false);
		}
	};

	const generateMissingGatePasses = async () => {
		const confirmGenerate = window.confirm(
			"Generate gate pass numbers for all stored warehouse items that do not have a gate pass?"
		);

		if (!confirmGenerate) return;

		try {
			setGeneratingMissingGatePass(true);

			const res = await secureFetch(
				`${API_BASE_URL}/api/warehouse/gatepass/generate-missing`,
				{
					method: "POST",
					credentials: "include",
				}
			);

			if (!res.ok) {
				const text = await res.text();
				throw new Error(text || "Failed to generate missing gate passes");
			}

			const data = await res.json();

			alert(
				data?.message ||
				`${data?.generated || 0} missing gate pass number(s) generated`
			);

			await fetchItems();
		} catch (err) {
			console.error(err);
			alert(err.message || "Missing gate pass generation failed");
		} finally {
			setGeneratingMissingGatePass(false);
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
		return filteredRows.filter((row) =>
			isWarehouseRowSelectable(row)
		);
	}, [filteredRows, isAdmin]);

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

	const allSelectedReturnRequested =
		selectedWarehouseItems.length > 0 &&
		selectedWarehouseItems.every(
			(item) => getWarehouseStatus(item) === "WAREHOUSE_RETURN_REQUESTED"
		);

	const bulkResolveReturnRequests = async (decision) => {
		if (!isAdmin) {
			alert("Only Admin can approve or reject return requests");
			return;
		}

		if (!allSelectedReturnRequested) {
			alert("Select only pending Return to Dispatch requests");
			return;
		}

		const normalizedDecision =
			String(decision || "").toUpperCase();

		const action =
			normalizedDecision === "APPROVE" ? "approve" : "reject";

		const itemIds = selectedWarehouseItems
			.map((row) => getWarehouseRowId(row))
			.filter(Boolean);

		if (itemIds.length === 0) {
			alert("Select return requests first");
			return;
		}

		const confirmed = window.confirm(
			`${action === "approve" ? "Approve" : "Reject"} ${itemIds.length} selected Return to Dispatch request(s)?`
		);

		if (!confirmed) return;

		try {
			setBulkReturnDecisionLoading(action);

			const res = await secureFetch(
				`${API_BASE_URL}/api/warehouse/admin/returns/bulk/${action}`,
				{
					method: "POST",
					credentials: "include",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(itemIds),
				}
			);

			if (!res.ok) {
				const text = await res.text();
				throw new Error(
					text || `Bulk return ${action} failed`
				);
			}

			setSelectionModel([]);
			await fetchItems();
		} catch (err) {
			console.error(`Bulk return ${action} failed`, err);
			alert(err.message || `Bulk return ${action} failed`);
		} finally {
			setBulkReturnDecisionLoading("");
		}
	};

	const canBulkApproveWarehouseThroughGatePass =
		allSelectedWarehouseRequested &&
		selectedWarehouseItems.length > 0;

	const totalPages =
		Math.max(
			1,
			Math.ceil(
				filteredRows.length /
				pageSize
			)
		);

	const safePageNo =
		Math.min(
			Math.max(
				1,
				pageNo
			),
			totalPages
		);

	const paginatedRows =
		useMemo(() => {
			const start =
				(safePageNo - 1) *
				pageSize;

			return filteredRows.slice(
				start,
				start + pageSize
			);
		}, [
			filteredRows,
			safePageNo,
			pageSize,
		]);

	const warehouseGridTemplate =
		useMemo(
			() =>
				warehouseColumnWidths
					.map(
						(width) =>
							`${Math.round(width)}px`
					)
					.join(" "),
			[
				warehouseColumnWidths,
			]
		);

	const warehouseTableWidth =
		useMemo(
			() =>
				warehouseColumnWidths.reduce(
					(total, width) =>
						total +
						Number(width || 0),
					0
				),
			[
				warehouseColumnWidths,
			]
		);

	const stopWarehouseColumnResize =
		() => {
			const active =
				warehouseColumnResizeRef.current;

			if (!active) {
				return;
			}

			window.removeEventListener(
				"pointermove",
				active.onMove
			);

			window.removeEventListener(
				"pointerup",
				active.onUp
			);

			window.removeEventListener(
				"pointercancel",
				active.onUp
			);

			warehouseColumnResizeRef.current =
				null;

			document.body.style.cursor =
				"";

			document.body.style.userSelect =
				"";
		};

	const beginWarehouseColumnResize =
		(event, columnIndex) => {
			event.preventDefault();
			event.stopPropagation();

			stopWarehouseColumnResize();

			const config =
				WAREHOUSE_COLUMN_LAYOUT[
				columnIndex
				];

			if (!config) {
				return;
			}

			const startX =
				event.clientX;

			const startWidth =
				warehouseColumnWidths[
				columnIndex
				] ??
				config.width;

			const onMove =
				(moveEvent) => {
					moveEvent.preventDefault();

					const nextWidth =
						Math.max(
							config.min,
							Math.min(
								config.max,
								startWidth +
								(moveEvent.clientX -
									startX)
							)
						);

					setWarehouseColumnWidths(
						(previous) => {
							if (
								previous[
								columnIndex
								] ===
								nextWidth
							) {
								return previous;
							}

							const next =
								[
									...previous,
								];

							next[
								columnIndex
							] =
								nextWidth;

							return next;
						}
					);
				};

			const onUp =
				() => {
					stopWarehouseColumnResize();
				};

			warehouseColumnResizeRef.current =
			{
				onMove,
				onUp,
			};

			document.body.style.cursor =
				"col-resize";

			document.body.style.userSelect =
				"none";

			window.addEventListener(
				"pointermove",
				onMove,
				{
					passive: false,
				}
			);

			window.addEventListener(
				"pointerup",
				onUp
			);

			window.addEventListener(
				"pointercancel",
				onUp
			);
		};

	const resetWarehouseColumnWidth =
		(columnIndex) => {
			const config =
				WAREHOUSE_COLUMN_LAYOUT[
				columnIndex
				];

			if (!config) {
				return;
			}

			setWarehouseColumnWidths(
				(previous) => {
					const next =
						[
							...previous,
						];

					next[
						columnIndex
					] =
						config.width;

					return next;
				}
			);
		};

	const renderWarehouseResizeHandle =
		(columnIndex) => (
			<Box
				className="warehouse-column-resize-handle"
				data-warehouse-no-row-open="true"
				title="Drag to resize • Double-click to reset"
				onPointerDown={(event) =>
					beginWarehouseColumnResize(
						event,
						columnIndex
					)
				}
				onDoubleClick={(event) => {
					event.preventDefault();
					event.stopPropagation();

					resetWarehouseColumnWidth(
						columnIndex
					);
				}}
				sx={warehouseColumnResizeHandleSx}
			/>
		);

	const isWarehouseRowInteractiveTarget =
		(target) => {
			if (
				!target ||
				typeof target.closest !==
				"function"
			) {
				return false;
			}

			return Boolean(
				target.closest(
					[
						"button",
						"a",
						"input",
						"select",
						"textarea",
						"[role='button']",
						"[role='checkbox']",
						"[role='menuitem']",
						".MuiButtonBase-root",
						".MuiChip-clickable",
						"[data-warehouse-no-row-open='true']",
					].join(",")
				)
			);
		};

	const handleWarehouseRowClick =
		(event, row) => {
			if (
				isWarehouseRowInteractiveTarget(
					event.target
				)
			) {
				return;
			}

			setWarehouseItemDrawerRow(
				row
			);
		};

	const getWarehouseDrawerValue =
		(...values) => {
			for (const value of values) {
				if (
					value !== null &&
					value !== undefined &&
					String(value).trim() !== ""
				) {
					return String(value);
				}
			}

			return "—";
		};

	const buildWarehouseItemDrawerSections =
		(row) => [
			{
				title: "Item & Packet",
				fields: [
					{
						label: "Item Name",
						value: getWarehouseDrawerValue(
							row?.name,
							row?.itemName
						),
						full: true,
					},
					{
						label: "SKU",
						value: getWarehouseDrawerValue(
							row?.sku
						),
					},
					{
						label: "Packet No.",
						value: getWarehouseDrawerValue(
							row?.packetNumber,
							row?.packetNo,
							row?.pktNo
						),
					},
					{
						label: "PD No.",
						value: getWarehouseDrawerValue(
							row?.pdNo,
							row?.pdNumber
						),
					},
					{
						label: "Drawing No.",
						value: getWarehouseDrawerValue(
							row?.drawingNo,
							row?.dwgNo
						),
					},
					{
						label: "Description",
						value: getWarehouseDrawerValue(
							row?.description
						),
						full: true,
					},
				],
			},
			{
				title: "Client & Factory",
				fields: [
					{
						label: "Client",
						value: getWarehouseDrawerValue(
							row?.clientName,
							row?.client
						),
					},
					{
						label: "Factory Floor",
						value: getWarehouseDrawerValue(
							row?.factoryFloor,
							row?.floor
						),
					},
					{
						label: "Client Address",
						value: getWarehouseDrawerValue(
							row?.clientAddress,
							row?.address,
							row?.siteAddress,
							row?.deliveryAddress
						),
						full: true,
					},
				],
			},
			{
				title: "Plant & Warehouse Location",
				fields: [
					{
						label: "Plant",
						value: getWarehouseDrawerValue(
							getPlantLabel(
								row?.plantCode
							)
						),
					},
					{
						label: "Current Location",
						value: getWarehouseDrawerValue(
							row?.currentLocationCode,
							row?.location
						),
					},
					{
						label: "Packed Area",
						value: getWarehouseDrawerValue(
							row?.packedAreaCode
						),
					},
					{
						label: "FG Area",
						value: getWarehouseDrawerValue(
							row?.fgAreaCode
						),
					},
					{
						label: "FG Zone",
						value: getWarehouseDrawerValue(
							row?.fgZoneCode
						),
					},
					{
						label: "Warehouse",
						value: getWarehouseDrawerValue(
							row?.warehouseCode
						),
					},
				],
			},
			{
				title: "Movement & Gate Pass",
				fields: [
					{
						label: "Movement Status",
						value: getWarehouseDrawerStatusLabel(
							row
						),
					},
					{
						label: "Gate Pass",
						value: getWarehouseDrawerValue(
							row?.gatePassNumber,
							row?.gatePass,
							row?.gatePassNo
						),
					},
					{
						label: "Packing Date / Time",
						value: formatWarehouseDrawerDateTime(
							row?.packedAt ||
							row?.packingDate ||
							row?.packedDate
						),
					},
					{
						label: "Created",
						value: formatWarehouseDrawerDateTime(
							row?.createdAt
						),
					},
					{
						label: "Last Updated",
						value: formatWarehouseDrawerDateTime(
							row?.updatedAt
						),
					},
				],
			},
			{
				title: "Physical Details",
				fields: [
					{
						label: "Dimensions",
						value: getWarehouseDrawerValue(
							row?.dimensions
						),
					},
					{
						label: "Weight",
						value: getWarehouseDrawerValue(
							row?.weight
						),
					},
					{
						label: "Remarks",
						value: getWarehouseDrawerValue(
							row?.remarks
						),
						full: true,
					},
				],
			},
			{
				title: "Record Reference",
				fields: [
					{
						label: "Warehouse Item ID",
						value: getWarehouseDrawerValue(
							getWarehouseRowId(
								row
							)
						),
						full: true,
					},
					{
						label: "Packet Item ID",
						value: getWarehouseDrawerValue(
							row?.packetItemId
						),
						full: true,
					},
				],
			},
		];

	useEffect(() => {
		return () => {
			stopWarehouseColumnResize();
		};
	}, []);

	useEffect(() => {
		if (!warehouseItemDrawerRow) {
			return;
		}

		const currentId =
			String(
				getWarehouseRowId(
					warehouseItemDrawerRow
				) || ""
			).trim();

		if (!currentId) {
			return;
		}

		const refreshedRow =
			(rows || []).find(
				(row) =>
					String(
						getWarehouseRowId(
							row
						) || ""
					).trim() ===
					currentId
			);

		if (
			refreshedRow &&
			refreshedRow !==
			warehouseItemDrawerRow
		) {
			setWarehouseItemDrawerRow(
				refreshedRow
			);
		}
	}, [
		rows,
		warehouseItemDrawerRow,
	]);

	useEffect(() => {
		setPageNo(1);
	}, [pageSize, statusFilter, search]);

	useEffect(() => {
		if (pageNo > totalPages) {
			setPageNo(totalPages);
		}
	}, [pageNo, totalPages]);

	useEffect(() => {
		const validIds =
			new Set(
				rows
					.map((row) =>
						getWarehouseRowId(
							row
						)
					)
					.filter(Boolean)
			);

		setSelectionModel((current) =>
			current.filter((id) =>
				validIds.has(id)
			)
		);
	}, [rows]);
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

					const res = await secureFetch(
						`${API_BASE_URL}/api/warehouse/${encodeURIComponent(id)}/approve?gatePass=${encodeURIComponent(gatePass)}`,
						{
							method: "POST",
							credentials: "include",
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

	/* ===================== ADMIN PERMANENT DELETE ===================== */

	const readWarehouseDeleteResponse = async (
		response,
		fallbackMessage
	) => {
		const text = await response.text();

		let data = null;

		if (text) {
			try {
				data = JSON.parse(text);
			} catch {
				data = text;
			}
		}

		if (!response.ok) {
			const message =
				typeof data === "object" && data
					? data.message || data.error || text
					: text;

			throw new Error(
				message || fallbackMessage
			);
		}

		return data;
	};

	const closeWarehouseDelete = () => {
		if (warehouseDeleteExecuting) {
			return;
		}

		setWarehouseDeleteOpen(false);
		setWarehouseDeleteRows([]);
		setWarehouseDeletePreview(null);
		setWarehouseDeleteReason("");
		setWarehouseDeleteConfirmation("");
		setWarehouseDeleteError("");
	};

	const openWarehouseDelete = async (
		targetRows,
		mode = "SINGLE"
	) => {
		if (!isAdmin) {
			alert("Only ADMIN can permanently delete Warehouse items");
			return;
		}

		const cleanRows = (
			Array.isArray(targetRows)
				? targetRows
				: [targetRows]
		)
			.filter(Boolean)
			.filter((row) =>
				Boolean(
					String(
						getWarehouseRowId(row) || ""
					).trim()
				)
			);

		if (cleanRows.length === 0) {
			alert("Select at least one Warehouse item");
			return;
		}

		const cleanMode =
			mode === "BULK" || cleanRows.length > 1
				? "BULK"
				: "SINGLE";

		setWarehouseDeleteMode(cleanMode);
		setWarehouseDeleteRows(cleanRows);
		setWarehouseDeletePreview(null);
		setWarehouseDeleteReason("");
		setWarehouseDeleteConfirmation("");
		setWarehouseDeleteError("");
		setWarehouseDeleteOpen(true);
		setWarehouseDeletePreviewLoading(true);

		try {
			let response;

			if (cleanMode === "BULK") {
				response = await secureFetch(
					`${API_BASE_URL}/api/admin/deletions/warehouse-items/bulk/preview`,
					{
						method: "POST",
						credentials: "include",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify(
							cleanRows.map((row) =>
								getWarehouseRowId(row)
							)
						),
					}
				);
			} else {
				const itemId = getWarehouseRowId(cleanRows[0]);

				response = await secureFetch(
					`${API_BASE_URL}/api/admin/deletions/warehouse-items/${encodeURIComponent(
						itemId
					)}/preview`,
					{
						credentials: "include",
					}
				);
			}

			const data = await readWarehouseDeleteResponse(
				response,
				"Unable to calculate Warehouse deletion impact"
			);

			setWarehouseDeletePreview(data);
		} catch (error) {
			console.error(
				"Warehouse delete preview failed",
				error
			);

			setWarehouseDeleteError(
				error?.message ||
				"Unable to calculate Warehouse deletion impact"
			);
		} finally {
			setWarehouseDeletePreviewLoading(false);
		}
	};

	const executeWarehouseDelete = async () => {
		if (!isAdmin || !warehouseDeletePreview) {
			return;
		}

		const reason = warehouseDeleteReason.trim();
		const confirmation = warehouseDeleteConfirmation.trim();
		const requiredConfirmation = String(
			warehouseDeletePreview?.requiredConfirmation || ""
		).trim();

		if (reason.length < 5) {
			setWarehouseDeleteError(
				"Deletion reason must contain at least 5 characters"
			);
			return;
		}

		if (confirmation !== requiredConfirmation) {
			setWarehouseDeleteError(
				`Type the exact confirmation: ${requiredConfirmation}`
			);
			return;
		}

		try {
			setWarehouseDeleteExecuting(true);
			setWarehouseDeleteError("");

			let response;

			if (warehouseDeleteMode === "BULK") {
				response = await secureFetch(
					`${API_BASE_URL}/api/admin/deletions/warehouse-items/bulk/execute`,
					{
						method: "POST",
						credentials: "include",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							itemIds: warehouseDeleteRows.map((row) =>
								getWarehouseRowId(row)
							),
							confirmationText: confirmation,
							reason,
						}),
					}
				);
			} else {
				const itemId = getWarehouseRowId(
					warehouseDeleteRows[0]
				);

				response = await secureFetch(
					`${API_BASE_URL}/api/admin/deletions/warehouse-items/${encodeURIComponent(
						itemId
					)}/execute`,
					{
						method: "POST",
						credentials: "include",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							confirmationText: confirmation,
							reason,
						}),
					}
				);
			}

			const result = await readWarehouseDeleteResponse(
				response,
				"Warehouse permanent deletion failed"
			);

			setWarehouseDeleteOpen(false);
			setWarehouseDeleteRows([]);
			setWarehouseDeletePreview(null);
			setWarehouseDeleteReason("");
			setWarehouseDeleteConfirmation("");
			setSelectionModel([]);
			setWarehouseItemDrawerRow(null);

			await fetchItems();

			publishPackFlowDataChanged({
				action:
					warehouseDeleteMode === "BULK"
						? "WAREHOUSE_BULK_DELETION"
						: "WAREHOUSE_ITEM_DELETION",
				targetType:
					warehouseDeleteMode === "BULK"
						? "WAREHOUSE_BULK"
						: "WAREHOUSE_ITEM",
				result,
				scopes: [
					"inventory",
					"warehouse",
					"dispatch",
					"dashboard",
				],
			});

			alert(
				result?.message ||
				"Warehouse item(s) permanently deleted"
			);
		} catch (error) {
			console.error(
				"Warehouse permanent deletion failed",
				error
			);

			setWarehouseDeleteError(
				error?.message ||
				"Warehouse permanent deletion failed"
			);
		} finally {
			setWarehouseDeleteExecuting(false);
		}
	};

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
							title={
								isAdmin
									? "Select all filtered Warehouse rows"
									: "Select all filtered warehouse action rows"
							}
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

				const isSelectable =
					isWarehouseRowSelectable(params.row);

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

			renderHeader: () => <span>Descriptiom</span>,

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

			renderHeader: () => <span>Client</span>,

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
				const locationOptions = getLocationOptions(
					plantCode,
					row.currentLocationCode || row.location
				);

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

				const hasGatePass =
					row.gatePassNumber &&
					String(row.gatePassNumber).trim();

				const canView =
					(isPacking || isAdmin || isDispatch || canApproveWarehouse) &&
					hasGatePass &&
					row.status !== "ON_FLOOR";

				const ViewButton = () => (
					<Button
						size="small"
						onClick={async () => {
							try {
								const res = await secureFetch(
									`${API_BASE_URL}/api/gatepass/${row.zohoItemId}/pdf`,
									{
										method: "GET",
										credentials: "include",
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
								label={
									hasGatePass
										? "Stored in Warehouse"
										: "Stored - GP Missing"
								}
								size="small"
								sx={{
									...(hasGatePass ? statusStored : missingGatePassChip),
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
				const warehouseOptions = getWarehouseOptions(
					plantCode,
					row.warehouseCode
				);

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

				let actionContent = null;

				if (isAdmin && assignmentEditing) {
					actionContent = (
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
				} else if (row.status === "WAREHOUSE_REQUESTED") {
					if (isPacking) {
						actionContent = (
							<Chip
								label="Awaiting Warehouse"
								size="small"
								sx={pendingChip}
							/>
						);
					} else if (canApproveWarehouse) {
						actionContent = (
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
									value={approveGatePass[rowId] || ""}
									onChange={(e) =>
										setApproveGatePass((prev) => ({
											...prev,
											[rowId]: e.target.value,
										}))
									}
									sx={{
										width: 165,
										...compactActionFieldSx,
									}}
								/>

								<Button
									size="small"
									disabled={!approveGatePass[rowId]}
									onClick={() => approveWarehouse(rowId)}
									sx={actionSuccess}
								>
									Approve
								</Button>

								<Button
									size="small"
									onClick={() => rejectWarehouse(rowId)}
									sx={actionDanger}
								>
									Reject
								</Button>
							</Box>
						);
					} else if (isDispatch) {
						actionContent = (
							<Chip
								label="Awaiting Warehouse Approval"
								size="small"
								sx={pendingChip}
							/>
						);
					} else {
						actionContent = (
							<Chip
								label="Warehouse Requested"
								size="small"
								sx={pendingChip}
							/>
						);
					}
				} else if (row.status === "IN_WAREHOUSE") {
					if (isAdmin) {
						actionContent = (
							<Box sx={actionCell}>
								<Button
									size="small"
									onClick={() => requestReturn(row.zohoItemId)}
									sx={actionWarning}
								>
									Request Return
								</Button>

								<Button
									size="small"
									onClick={() => startAssignmentEdit(row)}
									sx={actionInfo}
								>
									Edit Location
								</Button>
							</Box>
						);
					} else if (isDispatch) {
						actionContent = (
							<Button
								size="small"
								onClick={() => requestReturn(row.zohoItemId)}
								sx={actionWarning}
							>
								Request Return
							</Button>
						);
					} else {
						actionContent = (
							<Chip label="Stored" size="small" sx={statusStored} />
						);
					}
				} else if (row.status === "WAREHOUSE_RETURN_REQUESTED") {
					if (isAdmin) {
						actionContent = (
							<Box sx={actionCell}>
								<Button
									size="small"
									onClick={async () => {
										await secureFetch(
											`${API_BASE_URL}/api/dispatched/${row.zohoItemId}/approve-return`,
											{
												method: "POST",
												credentials: "include",
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
										await secureFetch(
											`${API_BASE_URL}/api/dispatched/${row.zohoItemId}/reject-return`,
											{
												method: "POST",
												credentials: "include",
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
					} else {
						actionContent = (
							<Chip
								label="Awaiting Admin Approval"
								size="small"
								sx={pendingChip}
							/>
						);
					}
				} else if (isAdmin) {
					actionContent = (
						<Button
							size="small"
							onClick={() => startAssignmentEdit(row)}
							sx={actionInfo}
						>
							Edit Location
						</Button>
					);
				}

				if (!isAdmin) {
					return actionContent;
				}

				return (
					<Box sx={actionCell}>
						{actionContent}

						<Button
							size="small"
							disabled={
								warehouseDeleteExecuting ||
								warehouseDeletePreviewLoading
							}
							onClick={() =>
								openWarehouseDelete(
									[row],
									"SINGLE"
								)
							}
							sx={warehouseDeleteButtonSx}
						>
							🗑 Delete
						</Button>
					</Box>
				);
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
			<div className="packflow-theme-page packflow-warehouse-page" style={page}>
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
								background: "linear-gradient(180deg,var(--pf-surface),var(--pf-surface-alt))",
								border: "1px solid rgba(var(--pf-fg-rgb),.08)",
								boxShadow: "0 20px 54px rgba(var(--pf-shadow-rgb),.14)",
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
									color: "var(--pf-text-strong)",
									fontSize: 28,
									fontWeight: 900,
									mb: 1,
								}}
							>
								Warehouse Access Required
							</Box>

							<Box
								sx={{
									color: "var(--pf-text-muted)",
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
		<div className="packflow-theme-page packflow-warehouse-page" style={page}>
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
									color: "color-mix(in srgb,#2563eb 78%,var(--pf-text-strong))",
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
							color: "var(--pf-text-muted)",
							fontSize: 14,
							fontWeight: 600,
						}}
					>
						Total Items:{" "}
						<span
							style={{
								color: "color-mix(in srgb,#2563eb 76%,var(--pf-text-strong))",
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
							color: "rgba(var(--pf-fg-rgb),.45)",
						}}
					/>

					<TextField
						variant="standard"
						placeholder="Search by Item, SKU, PD No, Status or Client..."
						value={search}
						onChange={(e) => {
							setSearch(
								e.target.value
							);

							setPageNo(1);
						}}
						InputProps={{ disableUnderline: true }}
						sx={{
							flex: 1,

							"& .MuiInputBase-root": {
								color: "var(--pf-text-strong)",
								fontSize: 14,
							},

							"& input::placeholder": {
								color: "rgba(var(--pf-fg-rgb),.42)",
								opacity: 1,
							},
						}}
					/>

					<TextField
						select
						size="small"
						value={statusFilter}
						onChange={(e) => {
							setStatusFilter(
								e.target.value
							);

							setPageNo(1);
						}}
						sx={{
							minWidth: 210,
							...formFieldSx,

							"& .MuiOutlinedInput-root": {
								height: 44,
								borderRadius: "14px",
								background: "rgba(var(--pf-fg-rgb),.04)",
								color: "var(--pf-text-strong)",

								"& fieldset": {
									borderColor: "rgba(var(--pf-fg-rgb),.08)",
								},

								"&:hover fieldset": {
									borderColor: "rgba(59,130,246,.45)",
								},

								"&.Mui-focused fieldset": {
									borderColor: "#3b82f6",
								},
							},

							"& .MuiSelect-select": {
								color: "var(--pf-text-strong)",
								fontWeight: 500,
							},

							"& .MuiSvgIcon-root": {
								color: "var(--pf-text-muted)",
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

						{(isAdmin || isDispatch) && (
							<Button
								variant="contained"
								disabled={generatingMissingGatePass}
								onClick={generateMissingGatePasses}
								sx={{
									...toolbarButton,
									background: generatingMissingGatePass
										? "rgba(var(--pf-fg-rgb),.08)"
										: "linear-gradient(135deg,#7c3aed,#a855f7)",

									color: generatingMissingGatePass
										? "rgba(var(--pf-fg-rgb),.45)"
										: "#fff",

									"&:hover": {
										background: generatingMissingGatePass
											? "rgba(var(--pf-fg-rgb),.08)"
											: "linear-gradient(135deg,#6d28d9,#9333ea)",
									},
								}}
							>
								{generatingMissingGatePass
									? "Generating..."
									: "Generate Missing Gate Pass"}
							</Button>
						)}

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
									: "rgba(var(--pf-fg-rgb),.08)",

								color: importMode
									? "#fff"
									: "rgba(var(--pf-fg-rgb),.35)",

								"&:hover": {
									background: importMode
										? "linear-gradient(135deg,#047857,#059669)"
										: "rgba(var(--pf-fg-rgb),.08)",
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
								const res = await secureFetch(
									`${API_BASE_URL}/api/warehouse/import/template`,
									{
										credentials: "include",
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
						canApproveWarehouse && (

							<div style={bulkBar}>
								<Box
									sx={{
										display: "flex",
										alignItems: "center",
										gap: 1,
										color: "var(--pf-text-soft)",
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
													: allSelectedReturnRequested
														? "Return Requests"
														: "Mixed Selection"
										}
										sx={{
											background:
												allSelectedWarehouseRequested || allWarehouseItems || allSelectedReturnRequested
													? "rgba(16,185,129,.15)"
													: "rgba(239,68,68,.15)",

											color:
												allSelectedWarehouseRequested || allWarehouseItems || allSelectedReturnRequested
													? "color-mix(in srgb,#059669 78%,var(--pf-text-strong))"
													: "color-mix(in srgb,#dc2626 78%,var(--pf-text-strong))",

											fontWeight: 800,
										}}
									/>
								</Box>

								<Box
									sx={{
										width: 1,
										height: 24,
										background: "rgba(var(--pf-fg-rgb),.08)",
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

								{isAdmin && allSelectedReturnRequested && (
									<>
										<Button
											disabled={Boolean(bulkReturnDecisionLoading)}
											onClick={() => bulkResolveReturnRequests("APPROVE")}
											sx={{
												minWidth: 190,
												height: 44,
												borderRadius: "14px",
												fontWeight: 800,
												textTransform: "none",
												background: "linear-gradient(180deg,#059669,#10b981)",
												color: "#fff",
											}}
										>
											{bulkReturnDecisionLoading === "approve"
												? "Approving..."
												: "✅ Bulk Approve Return"}
										</Button>

										<Button
											disabled={Boolean(bulkReturnDecisionLoading)}
											onClick={() => bulkResolveReturnRequests("REJECT")}
											sx={{
												minWidth: 180,
												height: 44,
												borderRadius: "14px",
												fontWeight: 800,
												textTransform: "none",
												background: "linear-gradient(180deg,#dc2626,#b91c1c)",
												color: "#fff",
											}}
										>
											{bulkReturnDecisionLoading === "reject"
												? "Rejecting..."
												: "❌ Bulk Reject Return"}
										</Button>
									</>
								)}

								{isAdmin && (
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
											color: "var(--pf-text-strong)",
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
											: "🔁 Bulk Request Return"}
									</Button>
								)}

								{isAdmin && (
									<Button
										disabled={!allWarehouseItems || bulkLocationLoading}
										onClick={openBulkLocationEdit}
										sx={{
											minWidth: 190,
											height: 44,
											borderRadius: "14px",
											fontWeight: 800,
											textTransform: "none",
											background: allWarehouseItems
												? "linear-gradient(180deg,#2563eb,#1d4ed8)"
												: "#64748b",
											color: "#fff",
											boxShadow: allWarehouseItems
												? "0 10px 25px rgba(37,99,235,.30)"
												: "none",
										}}
									>
										📍 Bulk Edit Location
									</Button>
								)}

								{isAdmin && (
									<Button
										disabled={
											selectedWarehouseItems.length === 0 ||
											warehouseDeleteExecuting ||
											warehouseDeletePreviewLoading
										}
										onClick={() =>
											openWarehouseDelete(
												selectedWarehouseItems,
												"BULK"
											)
										}
										sx={warehouseBulkDeleteButtonSx}
									>
										🗑 Bulk Delete
									</Button>
								)}

								<Button
									size="small"
									onClick={() => {
										setSelectionModel([]);
										setBulkGatePassNumber("");
									}}
									sx={{
										minWidth: 100,
										borderRadius: "14px",
										color: "var(--pf-text-muted)",
										border: "1px solid rgba(var(--pf-fg-rgb),.06)",

										"&:hover": {
											background: "rgba(var(--pf-fg-rgb),.04)",
											color: "var(--pf-text-strong)",
										},
									}}
								>
									Clear
								</Button>
							</div>
						)}
					<Box sx={tableWrapper}>
						<Box
							sx={{
								width: `${warehouseTableWidth}px`,
								minWidth: "100%",
							}}
						>
							<Box
								sx={{
									...tableHeader,
									gridTemplateColumns:
										warehouseGridTemplate,
									minWidth:
										warehouseTableWidth,
								}}
							>
								<Box
									sx={{
										...warehouseSelectCellSx(
											true
										),
										"&:hover .warehouse-column-resize-handle":
										{
											opacity: 1,
										},
									}}
								>
									{columns[0].renderHeader()}
									{renderWarehouseResizeHandle(0)}
								</Box>

								{WAREHOUSE_COLUMN_LAYOUT
									.slice(1, 12)
									.map((column, index) => {
										const columnIndex =
											index + 1;

										return (
											<Box
												key={column.key}
												sx={warehouseResizableHeaderCellSx}
											>
												<Box
													component="span"
													sx={{
														minWidth: 0,
														overflow: "hidden",
														textOverflow: "ellipsis",
													}}
												>
													{column.label}
												</Box>

												{renderWarehouseResizeHandle(
													columnIndex
												)}
											</Box>
										);
									})}

								<Box
									sx={{
										...warehouseActionCellSx(
											true
										),
										pr: 2.1,
										"&:hover .warehouse-column-resize-handle":
										{
											opacity: 1,
										},
									}}
								>
									Actions
									{renderWarehouseResizeHandle(12)}
								</Box>
							</Box>

							<Box sx={tableBody}>
								{paginatedRows.map((row) => (
									<Box
										key={getWarehouseRowId(row)}
										onClick={(event) =>
											handleWarehouseRowClick(
												event,
												row
											)
										}
										sx={{
											...warehouseTableRowSx,
											gridTemplateColumns:
												warehouseGridTemplate,
											minWidth:
												warehouseTableWidth,
										}}
									>
										<Box
											data-warehouse-no-row-open="true"
											sx={warehouseSelectCellSx(
												false
											)}
										>
											{columns[0].renderCell({ row })}
										</Box>

										<Box sx={warehouseTableCellWrap}>
											{columns[1].renderCell({ row })}
										</Box>

										<Box sx={warehouseTableCellWrap}>
											{columns[2].renderCell({
												value: row.sku,
												row,
											})}
										</Box>

										<Box sx={warehouseTableCellWrap}>
											{columns[3].renderCell({
												value: row.pdNo,
												row,
											})}
										</Box>

										<Box sx={warehouseTableCellWrap}>
											{columns[4].renderCell({
												value: row.drawingNo,
												row,
											})}
										</Box>

										<Box sx={warehouseTableCellWrap}>
											{columns[5].renderCell({
												value: row.description,
												row,
											})}
										</Box>

										<Box sx={warehouseTableCellWrap}>
											{columns[6].renderCell({
												value: row.clientName,
												row,
											})}
										</Box>

										<Box sx={warehouseTableCellWrap}>
											{columns[7].renderCell({
												value: row.plantCode,
												row,
											})}
										</Box>

										<Box sx={warehouseTableCellWrap}>
											{columns[8].renderCell({
												value:
													row.currentLocationCode ||
													row.location,
												row,
											})}
										</Box>

										<Box
											sx={{
												...warehouseTableCellWrap,
												...movementStatusCellWrap,
											}}
										>
											{columns[9].renderCell({ row })}
										</Box>

										<Box sx={warehouseTableCellWrap}>
											{columns[10].renderCell({ row })}
										</Box>

										<Box sx={warehouseTableCellWrap}>
											{columns[11].renderCell({ row })}
										</Box>

										<Box
											data-warehouse-no-row-open="true"
											sx={warehouseActionCellSx(
												false
											)}
										>
											{columns[12].renderCell({ row })}
										</Box>
									</Box>
								))}
							</Box>
						</Box>
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
									color: "var(--pf-text-muted)",
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
									setPageSize(
										Number(e.target.value)
									);
									setPageNo(1);
								}}
								sx={{
									width: 110,

									"& .MuiOutlinedInput-root": {
										height: 36,
										borderRadius: "12px",
										background: "rgba(var(--pf-fg-rgb),.04)",
										color: "var(--pf-text-strong)",

										"& fieldset": {
											borderColor: "rgba(var(--pf-fg-rgb),.08)",
										},

										"&:hover fieldset": {
											borderColor: "rgba(59,130,246,.35)",
										},
									},

									"& .MuiSvgIcon-root": {
										color: "var(--pf-text-muted)",
									},
								}}
							>
								<MenuItem value={20}>20</MenuItem>
								<MenuItem value={30}>30</MenuItem>
								<MenuItem value={50}>50</MenuItem>
							</TextField>

							<Box
								sx={{
									color: "var(--pf-text-muted)",
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
								disabled={
									safePageNo === 1
								}
								onClick={() =>
									setPageNo((currentPage) =>
										Math.max(
											1,
											currentPage - 1
										)
									)
								}
								sx={{
									minWidth: 100,
									height: 30,
									borderRadius: "12px",
									background: "linear-gradient(180deg,var(--pf-surface-raised),var(--pf-surface))",
									color: "var(--pf-text-strong)",
									border: "1px solid rgba(var(--pf-fg-rgb),.08)",
									fontSize: 10,
									fontWeight: 500,

									"&:disabled": {
										opacity: 0.45,
										color: "var(--pf-text-muted)",
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
									background: "linear-gradient(180deg,var(--pf-surface),var(--pf-surface-alt))",
									color: "var(--pf-text-soft)",
									border: "1px solid rgba(var(--pf-fg-rgb),.06)",
									fontSize: 10,
									fontWeight: 500,
								}}
							>
								Page
								<Box
									component="span"
									sx={{
										mx: 1,
										color: "color-mix(in srgb,#2563eb 76%,var(--pf-text-strong))",
									}}
								>
									{safePageNo}
								</Box>
								of {totalPages}
							</Box>

							<Button
								disabled={
									safePageNo ===
									totalPages
								}
								onClick={() =>
									setPageNo((currentPage) =>
										Math.min(
											totalPages,
											currentPage + 1
										)
									)
								}
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
										color: "var(--pf-text-soft)",
									},
								}}
							>
								Next ▶
							</Button>
						</Box>
					</Box>
				</div>
			</div>
			<Drawer
				anchor="right"
				open={Boolean(
					warehouseItemDrawerRow
				)}
				onClose={() =>
					setWarehouseItemDrawerRow(
						null
					)
				}
				PaperProps={{
					sx: warehouseItemDrawerPaperSx,
				}}
				ModalProps={{
					keepMounted: true,
				}}
			>
				{warehouseItemDrawerRow && (
					<>
						<Box sx={warehouseItemDrawerHeaderSx}>
							<Box sx={{ minWidth: 0, flex: 1 }}>
								<Box
									component="span"
									sx={{
										color: "color-mix(in srgb,#3b82f6 74%,var(--pf-text-strong))",
										fontSize: 10,
										fontWeight: 950,
										letterSpacing: ".11em",
										textTransform: "uppercase",
									}}
								>
									Warehouse Item Details
								</Box>

								<Box
									sx={{
										mt: 0.55,
										color: "var(--pf-text-strong)",
										fontSize: 20,
										fontWeight: 950,
										lineHeight: 1.15,
										wordBreak: "break-word",
									}}
								>
									{warehouseItemDrawerRow?.name ||
										warehouseItemDrawerRow?.itemName ||
										"Warehouse Item"}
								</Box>

								<Box
									sx={{
										mt: 0.75,
										display: "flex",
										alignItems: "center",
										gap: 0.8,
										flexWrap: "wrap",
									}}
								>
									<Chip
										size="small"
										label={getWarehouseDrawerStatusLabel(
											warehouseItemDrawerRow
										)}
										sx={warehouseDrawerStatusChipSx(
											warehouseItemDrawerRow?.status
										)}
									/>

									<Box
										component="span"
										sx={{
											color: "var(--pf-text-muted)",
											fontSize: 11,
											fontWeight: 800,
										}}
									>
										{warehouseItemDrawerRow?.pdNo ||
											"PD —"}
										{" • "}
										{warehouseItemDrawerRow?.sku ||
											"SKU —"}
									</Box>
								</Box>
							</Box>

							<IconButton
								aria-label="Close warehouse item details"
								onClick={() =>
									setWarehouseItemDrawerRow(
										null
									)
								}
								sx={warehouseDrawerCloseButtonSx}
							>
								<Box
									component="span"
									sx={{
										fontSize: 22,
										lineHeight: 1,
									}}
								>
									×
								</Box>
							</IconButton>
						</Box>

						<Box sx={warehouseItemDrawerBodySx}>
							{isAdmin &&
								isAssignmentEditing(
									warehouseItemDrawerRow
								) && (
									<Box sx={warehouseItemDrawerSectionSx}>
										<Box sx={warehouseItemDrawerSectionTitleSx}>
											Admin Location Editor
										</Box>

										<Box sx={warehouseItemDrawerGridSx}>
											<TextField
												select
												size="small"
												label="Plant"
												value={
													getAssignmentDraft(
														warehouseItemDrawerRow
													)?.plantCode || ""
												}
												onChange={(e) =>
													updateAssignmentDraft(
														warehouseItemDrawerRow,
														"plantCode",
														e.target.value
													)
												}
												sx={warehouseDrawerEditFieldSx}
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

											<TextField
												select
												size="small"
												label="Location"
												value={
													getAssignmentDraft(
														warehouseItemDrawerRow
													)?.currentLocationCode || ""
												}
												onChange={(e) =>
													updateAssignmentDraft(
														warehouseItemDrawerRow,
														"currentLocationCode",
														e.target.value
													)
												}
												sx={warehouseDrawerEditFieldSx}
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

												{getLocationOptions(
													getAssignmentDraft(
														warehouseItemDrawerRow
													)?.plantCode ||
													warehouseItemDrawerRow?.plantCode,
													getAssignmentDraft(
														warehouseItemDrawerRow
													)?.currentLocationCode ||
													warehouseItemDrawerRow?.currentLocationCode ||
													warehouseItemDrawerRow?.location
												).map((location) => (
													<MenuItem
														key={location}
														value={location}
													>
														{location}
													</MenuItem>
												))}
											</TextField>

											<TextField
												select
												size="small"
												label="Warehouse"
												value={
													getAssignmentDraft(
														warehouseItemDrawerRow
													)?.warehouseCode || ""
												}
												onChange={(e) =>
													updateAssignmentDraft(
														warehouseItemDrawerRow,
														"warehouseCode",
														e.target.value
													)
												}
												sx={warehouseDrawerEditFieldSx}
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

												{getWarehouseOptions(
													getAssignmentDraft(
														warehouseItemDrawerRow
													)?.plantCode ||
													warehouseItemDrawerRow?.plantCode,
													getAssignmentDraft(
														warehouseItemDrawerRow
													)?.warehouseCode ||
													warehouseItemDrawerRow?.warehouseCode
												).map((warehouse) => (
													<MenuItem
														key={warehouse}
														value={warehouse}
													>
														{warehouse}
													</MenuItem>
												))}
											</TextField>

											<TextField
												size="small"
												label="FG Zone"
												value={
													getAssignmentDraft(
														warehouseItemDrawerRow
													)?.fgZoneCode || ""
												}
												onChange={(e) =>
													updateAssignmentDraft(
														warehouseItemDrawerRow,
														"fgZoneCode",
														e.target.value
													)
												}
												sx={warehouseDrawerEditFieldSx}
											/>
										</Box>
									</Box>
								)}

							<Box sx={warehouseItemDrawerHeroSx}>
								<Box sx={warehouseItemDrawerSectionTitleSx}>
									Movement / Gate Pass
								</Box>

								<Box
									sx={{
										...warehouseItemDrawerActionPanelSx,
										background:
											"rgba(37,99,235,.055)",
										borderColor:
											"rgba(96,165,250,.14)",
									}}
								>
									{columns[9].renderCell({
										row:
											warehouseItemDrawerRow,
									})}
								</Box>
							</Box>

							{buildWarehouseItemDrawerSections(
								warehouseItemDrawerRow
							).map((section) => (
								<Box
									key={section.title}
									sx={warehouseItemDrawerSectionSx}
								>
									<Box sx={warehouseItemDrawerSectionTitleSx}>
										{section.title}
									</Box>

									<Box sx={warehouseItemDrawerGridSx}>
										{section.fields.map((field) => (
											<Box
												key={field.label}
												sx={{
													...warehouseItemDrawerFieldSx,
													gridColumn:
														field.full
															? "1 / -1"
															: "auto",
												}}
											>
												<Box sx={warehouseItemDrawerFieldLabelSx}>
													{field.label}
												</Box>

												<Box
													sx={warehouseItemDrawerFieldValueSx}
													title={String(
														field.value ||
														""
													)}
												>
													{field.value ||
														"—"}
												</Box>
											</Box>
										))}
									</Box>
								</Box>
							))}

							<Box sx={warehouseItemDrawerSectionSx}>
								<Box sx={warehouseItemDrawerSectionTitleSx}>
									Available Actions
								</Box>

								<Box sx={warehouseItemDrawerActionPanelSx}>
									{columns[12].renderCell({
										row:
											warehouseItemDrawerRow,
									})}
								</Box>
							</Box>
						</Box>
					</>
				)}
			</Drawer>


			{warehouseDeleteOpen && isAdmin && (
				<Box
					sx={warehouseDeleteOverlaySx}
					onClick={closeWarehouseDelete}
				>
					<Box
						sx={warehouseDeleteModalSx}
						onClick={(event) => event.stopPropagation()}
					>
						<Box sx={warehouseDeleteHeaderSx}>
							<Box>
								<Box sx={warehouseDeleteEyebrowSx}>
									ADMIN • PERMANENT DELETE
								</Box>

								<Box sx={warehouseDeleteTitleSx}>
									{warehouseDeleteMode === "BULK"
										? `Delete ${warehouseDeleteRows.length} Warehouse Items`
										: `Delete ${warehouseDeleteRows[0]?.name || "Warehouse Item"}`}
								</Box>

								<Box sx={warehouseDeleteSubtitleSx}>
									Deletes the selected Warehouse record(s) and every linked PackFlow operational record discovered by the Admin deletion engine.
								</Box>
							</Box>

							<IconButton
								disabled={warehouseDeleteExecuting}
								onClick={closeWarehouseDelete}
								sx={warehouseDeleteCloseSx}
							>
								×
							</IconButton>
						</Box>

						<Box sx={warehouseDeleteBodySx}>
							<Box sx={warehouseDeleteSelectionCardSx}>
								<Box sx={warehouseDeleteSectionLabelSx}>
									Selected Warehouse Records
								</Box>

								<Box sx={warehouseDeleteSelectedListSx}>
									{warehouseDeleteRows.map((row) => (
										<Box
											key={getWarehouseRowId(row)}
											sx={warehouseDeleteSelectedRowSx}
										>
											<Box sx={{ minWidth: 0 }}>
												<Box sx={warehouseDeleteSelectedNameSx}>
													{row.name || row.itemName || "Warehouse Item"}
												</Box>

												<Box sx={warehouseDeleteSelectedMetaSx}>
													{[
														row.sku,
														row.pdNo,
														row.drawingNo,
														row.warehouseCode || row.location,
													]
														.filter(Boolean)
														.join(" • ") || getWarehouseRowId(row)}
												</Box>
											</Box>

											<Chip
												size="small"
												label={row.status || "UNKNOWN"}
												sx={warehouseDeleteStatusChipSx}
											/>
										</Box>
									))}
								</Box>
							</Box>

							{warehouseDeletePreviewLoading && (
								<Box sx={warehouseDeleteLoadingSx}>
									Calculating every linked record before deletion...
								</Box>
							)}

							{warehouseDeleteError && (
								<Box sx={warehouseDeleteErrorSx}>
									{warehouseDeleteError}
								</Box>
							)}

							{warehouseDeletePreview && (
								<>
									<Box sx={warehouseDeleteWarningSx}>
										<Box sx={{ fontWeight: 950, color: "color-mix(in srgb,#dc2626 76%,var(--pf-text-strong))" }}>
											⚠ This action cannot be undone
										</Box>
										<Box sx={{ mt: 0.7, color: "var(--pf-text-soft)", fontSize: 12, lineHeight: 1.55 }}>
											{warehouseDeletePreview.warning}
										</Box>
									</Box>

									<Box sx={warehouseDeleteImpactGridSx}>
										{Object.entries(
											warehouseDeletePreview.affectedRows || {}
										)
											.sort(([a], [b]) => a.localeCompare(b))
											.map(([key, value]) => (
												<Box key={key} sx={warehouseDeleteImpactCardSx}>
													<Box sx={warehouseDeleteImpactLabelSx}>
														{key.replace(/([a-z])([A-Z])/g, "$1 $2")}
													</Box>
													<Box sx={warehouseDeleteImpactValueSx}>
														{Number(value || 0)}
													</Box>
												</Box>
											))}
									</Box>

									<TextField
										fullWidth
										multiline
										minRows={2}
										label="Deletion Reason"
										placeholder="Required: explain why these Warehouse records should be permanently removed"
										value={warehouseDeleteReason}
										onChange={(event) =>
											setWarehouseDeleteReason(event.target.value)
										}
										disabled={warehouseDeleteExecuting}
										sx={warehouseDeleteFieldSx}
									/>

									<TextField
										fullWidth
										label="Exact Confirmation"
										value={warehouseDeleteConfirmation}
										onChange={(event) =>
											setWarehouseDeleteConfirmation(event.target.value)
										}
										placeholder={warehouseDeletePreview.requiredConfirmation}
										disabled={warehouseDeleteExecuting}
										sx={warehouseDeleteFieldSx}
									/>

									<Box sx={warehouseDeleteConfirmationHintSx}>
										Type exactly: <strong>{warehouseDeletePreview.requiredConfirmation}</strong>
									</Box>
								</>
							)}
						</Box>

						<Box sx={warehouseDeleteFooterSx}>
							<Button
								disabled={warehouseDeleteExecuting}
								onClick={closeWarehouseDelete}
								sx={warehouseDeleteCancelSx}
							>
								Cancel
							</Button>

							<Button
								disabled={
									!warehouseDeletePreview ||
									warehouseDeleteExecuting ||
									warehouseDeleteReason.trim().length < 5 ||
									warehouseDeleteConfirmation.trim() !==
									String(
										warehouseDeletePreview?.requiredConfirmation || ""
									).trim()
								}
								onClick={executeWarehouseDelete}
								sx={warehouseDeleteConfirmSx}
							>
								{warehouseDeleteExecuting
									? "Deleting permanently..."
									: warehouseDeleteMode === "BULK"
										? `Permanently Delete ${warehouseDeleteRows.length} Items`
										: "Permanently Delete Item"}
							</Button>
						</Box>
					</Box>
				</Box>
			)}

			{bulkLocationOpen && (
				<div
					style={popupOverlay}
					onClick={() => {
						if (!bulkLocationLoading) {
							setBulkLocationOpen(false);
						}
					}}
				>
					<div
						style={{
							...popupBox,
							maxWidth: 720,
						}}
						onClick={(e) => e.stopPropagation()}
					>
						<h2
							style={{
								marginBottom: 8,
								fontSize: 24,
								fontWeight: 900,
								color: "var(--pf-text-strong)",
							}}
						>
							Bulk Edit Warehouse Location
						</h2>

						<Box
							sx={{
								color: "var(--pf-text-muted)",
								fontSize: 13,
								fontWeight: 700,
								mb: 2.5,
							}}
						>
							Admin will update {selectedWarehouseItems.length} stored item
							{selectedWarehouseItems.length === 1 ? "" : "s"}.
						</Box>

						<Box
							sx={{
								display: "grid",
								gridTemplateColumns: "repeat(2,minmax(0,1fr))",
								gap: 1.5,
								mb: 2.5,
							}}
						>
							<TextField
								select
								fullWidth
								size="small"
								label="Plant"
								value={bulkLocationForm.plantCode}
								onChange={(e) =>
									setBulkLocationForm((prev) => ({
										...prev,
										plantCode: e.target.value,
									}))
								}
								sx={compactActionFieldSx}
							>
								{plants.map((plant) => (
									<MenuItem key={plant.plantCode} value={plant.plantCode}>
										{plant.plantCode}
									</MenuItem>
								))}
							</TextField>

							<TextField
								select
								fullWidth
								size="small"
								label="Location"
								value={bulkLocationForm.currentLocationCode}
								onChange={(e) =>
									setBulkLocationForm((prev) => ({
										...prev,
										currentLocationCode: e.target.value,
									}))
								}
								sx={compactActionFieldSx}
							>
								<MenuItem value="">Auto / Keep Existing Warehouse</MenuItem>
								{getLocationOptions(
									bulkLocationForm.plantCode,
									bulkLocationForm.currentLocationCode
								).map((location) => (
									<MenuItem key={location} value={location}>
										{location}
									</MenuItem>
								))}
							</TextField>

							<TextField
								select
								fullWidth
								size="small"
								label="Warehouse"
								value={bulkLocationForm.warehouseCode}
								onChange={(e) =>
									setBulkLocationForm((prev) => ({
										...prev,
										warehouseCode: e.target.value,
										currentLocationCode:
											e.target.value || prev.currentLocationCode,
									}))
								}
								sx={compactActionFieldSx}
							>
								<MenuItem value="">No Warehouse</MenuItem>
								{getWarehouseOptions(
									bulkLocationForm.plantCode,
									bulkLocationForm.warehouseCode
								).map((warehouse) => (
									<MenuItem key={warehouse} value={warehouse}>
										{warehouse}
									</MenuItem>
								))}
							</TextField>

							<TextField
								fullWidth
								size="small"
								label="FG Zone (optional)"
								value={bulkLocationForm.fgZoneCode}
								onChange={(e) =>
									setBulkLocationForm((prev) => ({
										...prev,
										fgZoneCode: e.target.value,
									}))
								}
								sx={compactActionFieldSx}
							/>
						</Box>

						<Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5 }}>
							<Button
								disabled={bulkLocationLoading}
								onClick={() => setBulkLocationOpen(false)}
								sx={{
									minWidth: 110,
									height: 38,
									borderRadius: "12px",
									color: "var(--pf-text-soft)",
									border: "1px solid rgba(var(--pf-fg-rgb),.08)",
									textTransform: "none",
									fontWeight: 800,
								}}
							>
								Cancel
							</Button>

							<Button
								disabled={bulkLocationLoading || !bulkLocationForm.plantCode}
								onClick={saveBulkLocation}
								sx={{
									minWidth: 165,
									height: 38,
									borderRadius: "12px",
									color: "#fff",
									background: "linear-gradient(135deg,#2563eb,#3b82f6)",
									textTransform: "none",
									fontWeight: 900,
								}}
							>
								{bulkLocationLoading ? "Saving..." : "Save All Locations"}
							</Button>
						</Box>
					</div>
				</div>
			)}
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
								color: "var(--pf-text-strong)",
							}}
						>
							Bulk Approve Warehouse
						</h2>

						<Box
							sx={{
								color: "var(--pf-text-muted)",
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
								color: "color-mix(in srgb,#059669 76%,var(--pf-text-strong))",
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
									color: "var(--pf-text-soft)",
									border: "1px solid rgba(var(--pf-fg-rgb),.08)",
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
								color: "var(--pf-text-strong)",
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

									background: "linear-gradient(135deg,#2563eb,#3b82f6)",
									border: "1px solid rgba(37,99,235,.28)",
									color: "#fff",
									WebkitTextFillColor: "#fff",
									fontWeight: 850,
									boxShadow: "0 6px 16px rgba(37,99,235,.18)",
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
								color: "var(--pf-text-strong)",
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
										borderBottom: "1px solid var(--pf-border-soft)",
										background: row.valid
											? "rgba(16,185,129,.12)"
											: "rgba(239,68,68,.12)",

										color: "var(--pf-text-strong)",
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

									const res = await secureFetch(`${API_BASE_URL}/api/warehouse/import/confirm`, {
										method: "POST",
										credentials: "include",
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

									background: "linear-gradient(135deg,#059669,#10b981)",
									border: "1px solid rgba(5,150,105,.28)",
									color: "#fff",
									WebkitTextFillColor: "#fff",
									fontWeight: 850,
									boxShadow: "0 6px 16px rgba(5,150,105,.18)",
								}}
							>
								Confirm Import
							</Button>

							<Button
								sx={{
									minWidth: 120,

									borderRadius: "14px",

									color: "var(--pf-text-soft)",

									border:
										"1px solid rgba(var(--pf-fg-rgb),.08)",
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
	background: "var(--pf-surface)",
	borderRadius: 18,
	padding: 14,
	border: "1px solid var(--pf-border)",
	boxShadow: "var(--pf-card-shadow)",
};

const tableHeader = {
	position: "sticky",
	top: 0,
	zIndex: 30,

	display: "grid",
	gridTemplateColumns: warehouseGrid,
	alignItems: "stretch",

	padding: 0,

	background: "linear-gradient(180deg,var(--pf-surface-alt),var(--pf-surface))",
	color: "var(--pf-text-muted)",

	fontWeight: 950,
	fontSize: 10.5,
	letterSpacing: ".075em",
	textTransform: "uppercase",

	borderBottom: "1px solid var(--pf-border)",

	boxShadow: "0 5px 14px rgba(var(--pf-shadow-rgb),.06)",

	backdropFilter: "blur(18px)",
	WebkitBackdropFilter: "blur(18px)",
};

const tableRow = {
	display: "grid",
	gridTemplateColumns: warehouseGrid,
	alignItems: "stretch",
	padding: 0,
	color: "var(--pf-text-strong)",
	borderBottom:
		"1px solid rgba(148,163,184,.075)",
	minHeight: 68,
	fontSize: 13,
	background: "var(--pf-surface)",
	transition:
		"background .16s ease, border-color .16s ease, box-shadow .16s ease",
};

const searchPanel = {
	display: "flex",
	alignItems: "center",
	gap: 10,
	minHeight: 46,
	padding: "0 14px",
	borderRadius: 14,
	background: "var(--pf-surface)",
	border: "1px solid var(--pf-border)",
	boxShadow: "0 4px 14px rgba(var(--pf-shadow-rgb),.05)",
};

const page = {
	minHeight: "100vh",
	background:
		"linear-gradient(135deg,var(--pf-bg),var(--pf-surface))",
};

const headerRow = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	gap: 16,
	flexWrap: "wrap",
	padding: "14px 16px",
	marginBottom: 2,
	borderRadius: 16,
	background: "linear-gradient(135deg,var(--pf-surface),var(--pf-surface-alt))",
	border: "1px solid var(--pf-border-soft)",
	boxShadow: "0 6px 18px rgba(var(--pf-shadow-rgb),.05)",
};

const logo = {
	color: "var(--pf-text-strong)",
	fontSize: 30,
	fontWeight: 950,
	letterSpacing: "-.025em",
	marginBottom: 4,
};

const subtitle = {
	color: "var(--pf-text-muted)",
	fontSize: 12.5,
	fontWeight: 650,
};

const compactActionFieldSx = {
	colorScheme: "var(--pf-color-scheme)",
	"& .MuiOutlinedInput-root": {
		height: 32,
		borderRadius: "12px",
		background: "rgba(var(--pf-fg-rgb),.04)",
		color: "var(--pf-text-strong)",
		fontSize: 12,

		"& fieldset": {
			borderColor: "rgba(var(--pf-fg-rgb),.08)",
		},

		"&:hover fieldset": {
			borderColor: "rgba(59,130,246,.35)",
		},

		"&.Mui-focused fieldset": {
			borderColor: "#3b82f6",
		},
	},

	"& input": {
		color: "var(--pf-text-strong)",
		fontSize: 12,
		fontWeight: 700,
		padding: "7px 10px",
	},

	"& input::placeholder": {
		color: "rgba(var(--pf-fg-rgb),.45)",
		opacity: 1,
	},
};

const tableWrapper = {
	position: "relative",
	overflowX: "auto",
	overflowY: "visible",

	borderRadius: "18px",

	background: "var(--pf-surface)",

	border: "1px solid var(--pf-border)",

	boxShadow: "0 8px 24px rgba(var(--pf-shadow-rgb),.07)",

	scrollbarWidth: "thin",
	scrollbarColor: "#3b82f6 var(--pf-surface)",

	WebkitOverflowScrolling: "touch",
	overscrollBehaviorX: "contain",
	scrollbarGutter: "stable",

	"&::-webkit-scrollbar": {
		height: 12,
	},

	"&::-webkit-scrollbar-track": {
		background:
			"linear-gradient(180deg,var(--pf-surface),var(--pf-surface-alt))",
		borderRadius: 999,
	},

	"&::-webkit-scrollbar-thumb": {
		background:
			"linear-gradient(90deg,#2563eb,#60a5fa)",
		borderRadius: 999,
		border: "2px solid var(--pf-surface)",
		boxShadow: "0 2px 8px rgba(59,130,246,.24)",
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


const warehouseResizableHeaderCellSx = {
	minWidth: 0,
	minHeight: 50,
	position: "relative",

	display: "flex",
	alignItems: "center",

	px: 1.5,
	py: 1.15,
	pr: 2.1,

	borderRight:
		"1px solid rgba(var(--pf-fg-rgb),.045)",

	whiteSpace: "nowrap",
	overflow: "visible",

	"&:hover .warehouse-column-resize-handle": {
		opacity: 1,
	},
};

const warehouseColumnResizeHandleSx = {
	position: "absolute",
	top: 0,
	right: -4,
	width: 9,
	height: "100%",
	zIndex: 60,
	cursor: "col-resize",
	touchAction: "none",
	opacity: 0,
	transition:
		"opacity .14s ease, background .14s ease",
	background:
		"linear-gradient(90deg,transparent,rgba(96,165,250,.58),transparent)",

	"&::after": {
		content: '""',
		position: "absolute",
		top: "20%",
		bottom: "20%",
		left: "4px",
		width: "1px",
		borderRadius: 999,
		background: "#60a5fa",
		boxShadow:
			"0 0 10px rgba(96,165,250,.72)",
	},

	"&:hover": {
		opacity: 1,
		background:
			"linear-gradient(90deg,transparent,rgba(96,165,250,.92),transparent)",
	},
};

const warehouseTableCellWrap = {
	minWidth: 0,
	overflow: "hidden",

	display: "flex",
	alignItems: "center",

	minHeight: 68,

	padding: "10px 14px",

	borderRight:
		"1px solid rgba(var(--pf-fg-rgb),.038)",
};

const warehouseTableRowSx = {
	...tableRow,

	"&:nth-of-type(even)": {
		background: "var(--pf-surface-alt)",
	},

	"&:hover": {
		background:
			"linear-gradient(90deg,rgba(37,99,235,.075),rgba(var(--pf-surface-raised-rgb),.58))",

		borderBottomColor:
			"rgba(96,165,250,.18)",

		boxShadow:
			"inset 0 1px 0 rgba(var(--pf-fg-rgb),.018), inset 0 -1px 0 rgba(96,165,250,.035)",

		cursor: "pointer",
	},

	"&:focus-within": {
		background:
			"linear-gradient(90deg,rgba(37,99,235,.085),rgba(var(--pf-surface-raised-rgb),.60))",
	},
};

const warehouseSelectCellSx = (
	header = false
) => ({
	minWidth: 0,

	display: "flex",
	alignItems: "center",
	justifyContent: "center",

	position: "sticky",
	left: 0,
	zIndex: header ? 42 : 8,

	minHeight: header ? 50 : 68,

	background: header
		? "linear-gradient(180deg,rgba(var(--pf-surface-rgb),.998),rgba(var(--pf-surface-alt-rgb),.995))"
		: "rgba(var(--pf-surface-rgb),.985)",

	borderRight:
		"1px solid rgba(148,163,184,.13)",

	boxShadow:
		"8px 0 18px rgba(var(--pf-shadow-rgb),.07)",
});

const warehouseActionCellSx = (
	header = false
) => ({
	minWidth: 0,

	display: "flex",
	alignItems: "center",

	position: "sticky",
	right: 0,
	zIndex: header ? 42 : 8,

	minHeight: header ? 50 : 68,

	px: header ? 1.5 : 1.25,
	py: header ? 1.15 : 0.85,

	background: header
		? "linear-gradient(180deg,rgba(var(--pf-surface-rgb),.998),rgba(var(--pf-surface-alt-rgb),.995))"
		: "linear-gradient(90deg,rgba(var(--pf-surface-rgb),.95),rgba(var(--pf-surface-rgb),.995))",

	borderLeft:
		"1px solid rgba(148,163,184,.13)",

	boxShadow:
		"-8px 0 18px rgba(var(--pf-shadow-rgb),.08)",

	"& > *": {
		minWidth: 0,
	},
});

const warehouseItemDrawerPaperSx = {
	width: "min(760px, 96vw)",
	maxWidth: "96vw",
	color: "var(--pf-text-strong)",
	background: "linear-gradient(180deg,var(--pf-surface),var(--pf-surface-alt))",
	borderLeft: "1px solid var(--pf-border)",
	boxShadow: "-18px 0 54px rgba(var(--pf-shadow-rgb),.16)",
};

const warehouseItemDrawerHeaderSx = {
	position: "sticky",
	top: 0,
	zIndex: 4,

	px: 2.5,
	py: 2,

	display: "flex",
	alignItems: "flex-start",
	justifyContent: "space-between",
	gap: 2,

	background: "linear-gradient(180deg,var(--pf-surface),var(--pf-surface-alt))",

	borderBottom:
		"1px solid rgba(var(--pf-fg-rgb),.07)",

	backdropFilter: "blur(18px)",
};

const warehouseItemDrawerBodySx = {
	p: 2.25,
	overflowY: "auto",
	scrollbarWidth: "thin",
	scrollbarColor:
		"#60a5fa rgba(var(--pf-surface-rgb),.78)",

	"&::-webkit-scrollbar": {
		width: 10,
	},

	"&::-webkit-scrollbar-track": {
		background:
			"rgba(var(--pf-surface-rgb),.92)",
		borderRadius: 999,
	},

	"&::-webkit-scrollbar-thumb": {
		background:
			"linear-gradient(180deg,#2563eb,#60a5fa)",
		borderRadius: 999,
		border: "2px solid var(--pf-surface)",
	},
};

const warehouseItemDrawerHeroSx = {
	mb: 1.5,
	p: 1.55,
	borderRadius: "18px",

	background:
		"linear-gradient(135deg,rgba(37,99,235,.15),rgba(var(--pf-fg-rgb),.025))",

	border:
		"1px solid rgba(96,165,250,.18)",

	boxShadow:
		"0 14px 32px rgba(var(--pf-shadow-rgb),.09)",
};

const warehouseItemDrawerSectionSx = {
	mb: 1.4,
	p: 1.45,
	borderRadius: "17px",
	background:
		"rgba(var(--pf-fg-rgb),.026)",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.065)",
};

const warehouseItemDrawerSectionTitleSx = {
	mb: 1,
	color: "color-mix(in srgb,#3b82f6 74%,var(--pf-text-strong))",
	fontSize: 10,
	fontWeight: 950,
	letterSpacing: ".11em",
	textTransform: "uppercase",
};

const warehouseItemDrawerGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		sm: "repeat(2,minmax(0,1fr))",
	},
	gap: 0.85,
};

const warehouseItemDrawerFieldSx = {
	minWidth: 0,
	p: 1.05,
	borderRadius: "12px",
	background: "var(--pf-surface-alt)",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.055)",
};

const warehouseItemDrawerFieldLabelSx = {
	color: "var(--pf-text-dim)",
	fontSize: 8.5,
	fontWeight: 950,
	letterSpacing: ".07em",
	textTransform: "uppercase",
};

const warehouseItemDrawerFieldValueSx = {
	mt: 0.4,
	color: "var(--pf-text-strong)",
	fontSize: 11.5,
	fontWeight: 850,
	lineHeight: 1.42,
	wordBreak: "break-word",
	whiteSpace: "pre-wrap",
};

const warehouseItemDrawerActionPanelSx = {
	p: 1.35,
	borderRadius: "15px",

	background:
		"linear-gradient(135deg,rgba(16,185,129,.08),rgba(var(--pf-fg-rgb),.025))",

	border:
		"1px solid rgba(16,185,129,.14)",

	"& .MuiButton-root": {
		minHeight: 34,
	},

	"& > .MuiBox-root": {
		flexWrap: "wrap",
	},
};

const warehouseDrawerCloseButtonSx = {
	width: 36,
	height: 36,
	borderRadius: "8px",
	color: "var(--pf-text-muted)",
	background:
		"rgba(var(--pf-fg-rgb),.04)",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.06)",

	"&:hover": {
		color: "var(--pf-text-strong)",
		background:
			"rgba(239,68,68,.16)",
		borderColor:
			"rgba(239,68,68,.28)",
	},
};

const warehouseDrawerEditFieldSx = {
	colorScheme: "var(--pf-color-scheme)",
	"& .MuiInputLabel-root": {
		color: "var(--pf-text-muted)",
		fontSize: 11,
		fontWeight: 800,
	},

	"& .MuiInputLabel-root.Mui-focused": {
		color: "color-mix(in srgb,#3b82f6 74%,var(--pf-text-strong))",
	},

	"& .MuiOutlinedInput-root": {
		minHeight: 42,
		borderRadius: "12px",
		color: "var(--pf-text-strong)",
		background:
			"rgba(var(--pf-fg-rgb),.04)",

		"& fieldset": {
			borderColor:
				"rgba(var(--pf-fg-rgb),.09)",
		},

		"&:hover fieldset": {
			borderColor:
				"rgba(96,165,250,.36)",
		},

		"&.Mui-focused fieldset": {
			borderColor: "#60a5fa",
			boxShadow:
				"0 0 0 3px rgba(96,165,250,.12)",
		},
	},

	"& input, & .MuiSelect-select": {
		color: "var(--pf-text-strong)",
		fontSize: 11.5,
		fontWeight: 850,
	},

	"& .MuiSvgIcon-root": {
		color: "var(--pf-text-muted)",
	},
};

const warehouseDrawerStatusChipSx = (
	status
) => {
	const cleanStatus =
		String(status || "")
			.trim()
			.toUpperCase();

	if (
		cleanStatus ===
		"IN_WAREHOUSE"
	) {
		return {
			...statusStored,
			height: 25,
		};
	}

	if (
		cleanStatus ===
		"WAREHOUSE_RETURN_REQUESTED"
	) {
		return {
			...returnChip,
			height: 25,
		};
	}

	return {
		...pendingChip,
		height: 25,
	};
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
	borderRadius: "10px",
	textTransform: "none",
	fontWeight: 850,
	fontSize: 11.5,
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	border: "1px solid rgba(37,99,235,.28)",
	color: "#fff",
	WebkitTextFillColor: "#fff",
	boxShadow: "0 6px 16px rgba(37,99,235,.18)",

	"&:hover": {
		background: "linear-gradient(135deg,#1d4ed8,#2563eb)",
		color: "#fff",
		WebkitTextFillColor: "#fff",
	},
};

const simpleCellText = {
	color: "var(--pf-text-strong)",
	fontWeight: 800,
	fontSize: 13,
	lineHeight: 1.25,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
	display: "block",
};

const missingGatePassChip = {
	background: "rgba(245,158,11,.14)",
	color: "color-mix(in srgb,#d97706 82%,var(--pf-text-strong))",
	border: "1px solid rgba(245,158,11,.24)",
	fontWeight: 800,
};

const simpleMutedText = {
	color: "var(--pf-text)",
	fontWeight: 750,
	fontSize: 13,
	lineHeight: 1.25,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
	display: "block",
};

const simpleMonoText = {
	color: "var(--pf-text-strong)",
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
	borderRadius: "10px",
	textTransform: "none",
	fontWeight: 800,
	fontSize: 11.5,
	color: "var(--pf-text-strong)",
	border: "1px solid var(--pf-border)",
	background: "var(--pf-surface-alt)",

	"&:hover": {
		background: "rgba(var(--pf-fg-rgb),.06)",
		borderColor: "rgba(59,130,246,.45)",
	},
};

const compactLegend = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	padding: "6px 10px",
	borderRadius: 14,
	background: "rgba(var(--pf-fg-rgb),.03)",
	border: "1px solid rgba(var(--pf-fg-rgb),.06)",
};

const formFieldSx = {
	colorScheme: "var(--pf-color-scheme)",
	"& .MuiOutlinedInput-root": {
		borderRadius: "16px",

		background:
			"rgba(var(--pf-fg-rgb),.04)",

		color: "var(--pf-text-strong)",

		"& fieldset": {
			borderColor:
				"rgba(var(--pf-fg-rgb),.08)",
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
		color: "var(--pf-text-strong)",
	},
};

const compactFieldSx = {
	colorScheme: "var(--pf-color-scheme)",
	"& .MuiOutlinedInput-root": {
		height: 36,
		borderRadius: "12px",
		background: "rgba(var(--pf-fg-rgb),.04)",
		color: "var(--pf-text-strong)",
		fontSize: 12,

		"& fieldset": {
			borderColor: "rgba(var(--pf-fg-rgb),.08)",
		},

		"&:hover fieldset": {
			borderColor: "rgba(59,130,246,.35)",
		},

		"&.Mui-focused fieldset": {
			borderColor: "#3b82f6",
		},
	},

	"& .MuiSelect-select": {
		color: "var(--pf-text-strong)",
		fontWeight: 600,
		fontSize: 12,
		paddingTop: "8px",
		paddingBottom: "8px",
	},

	"& .MuiSvgIcon-root": {
		color: "var(--pf-text-muted)",
	},

	"& input": {
		color: "var(--pf-text-strong)",
		fontSize: 12,
	},
};

const warehouseSelectMenuSx = {
	mt: 1,
	borderRadius: "14px",
	background: "var(--pf-surface)",
	color: "var(--pf-text-strong)",
	border: "1px solid var(--pf-border)",
	boxShadow: "0 18px 46px rgba(var(--pf-shadow-rgb),.14)",

	"& .MuiMenuItem-root": {
		fontSize: 13,
		fontWeight: 750,
		color: "var(--pf-text-strong)",
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
			"linear-gradient(180deg, rgba(var(--pf-fg-rgb),.055), rgba(var(--pf-fg-rgb),.025))",
		color: "var(--pf-text-strong)",
		fontSize: 12,
		border: "1px solid rgba(59,130,246,.16)",
		boxShadow:
			"inset 0 1px 0 rgba(var(--pf-fg-rgb),.05), 0 8px 22px rgba(var(--pf-shadow-rgb),.08)",

		"& fieldset": {
			borderColor: "rgba(var(--pf-fg-rgb),.08)",
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
		color: "var(--pf-text-strong)",
		fontWeight: 800,
		fontSize: 12,
		paddingTop: "8px",
		paddingBottom: "8px",
	},

	"& .MuiSvgIcon-root": {
		color: "color-mix(in srgb,#2563eb 76%,var(--pf-text-strong))",
	},
};

const importModePlaceholderSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	color: "var(--pf-text-muted)",
	fontWeight: 800,
	fontSize: 12,
};

const importModeValueSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	color: "color-mix(in srgb,#2563eb 72%,var(--pf-text-strong))",
	fontWeight: 900,
	fontSize: 12,
};

const importModeMenuPaperSx = {
	mt: 1,
	borderRadius: "18px",
	background:
		"linear-gradient(180deg,var(--pf-surface),var(--pf-surface-alt))",
	color: "var(--pf-text-strong)",
	border: "1px solid rgba(var(--pf-fg-rgb),.08)",
	boxShadow: "0 20px 54px rgba(var(--pf-shadow-rgb),.16)",
	overflow: "hidden",

	"& .MuiMenuItem-root": {
		color: "var(--pf-text-strong)",
	},
};

const importModeDisabledOptionSx = {
	fontSize: 12,
	fontWeight: 800,
	color: "var(--pf-text-dim) !important",
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
	color: "var(--pf-text-strong)",
	fontSize: 13,
	fontWeight: 900,
	lineHeight: 1.2,
};

const importModeOptionSubSx = {
	color: "var(--pf-text-muted)",
	fontSize: 11,
	fontWeight: 700,
	mt: 0.3,
};

const actionCell = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	flexWrap: "wrap",
	whiteSpace: "nowrap",
	minWidth: 0,
	width: "100%",
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
	fontSize: 11,
	fontWeight: 900,
	height: 27,
	borderRadius: "999px",
	px: 1.5,
	letterSpacing: ".08px",
	border: "1px solid var(--pf-border-soft)",
	boxShadow: "0 2px 7px rgba(var(--pf-shadow-rgb),.05)",
};

const statusPacked = {
	...statusBase,
	color: "color-mix(in srgb,#2563eb 78%,var(--pf-text-strong))",
	background: "rgba(37,99,235,.10)",
	border: "1px solid rgba(37,99,235,.18)",
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
	color: "color-mix(in srgb,#059669 80%,var(--pf-text-strong))",
	background: "rgba(16,185,129,.10)",
	border: "1px solid rgba(16,185,129,.19)",
};

const pendingChip = {
	...statusBase,
	color: "color-mix(in srgb,#b45309 82%,var(--pf-text-strong))",
	background: "rgba(245,158,11,.10)",
	border: "1px solid rgba(245,158,11,.20)",
};

const returnChip = {
	...statusBase,
	color: "color-mix(in srgb,#b91c1c 82%,var(--pf-text-strong))",
	background: "rgba(239,68,68,.09)",
	border: "1px solid rgba(239,68,68,.19)",
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
		"rgba(var(--pf-surface-rgb),.94)",

	border:
		"1px solid rgba(var(--pf-fg-rgb),.08)",

	borderRadius: 18,

	backdropFilter: "blur(24px)",

	boxShadow:
		"0 20px 50px rgba(var(--pf-shadow-rgb),.18)",

	color: "var(--pf-text-strong)",

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
	WebkitTextFillColor: "#fff",

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
	WebkitTextFillColor: "#fff",

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
	WebkitTextFillColor: "#fff",

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
	WebkitTextFillColor: "#fff",

	boxShadow:
		"0 8px 18px rgba(245,158,11,.22)",

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
	WebkitTextFillColor: "#fff",

	border:
		"1px solid rgba(59,130,246,.35)",

	boxShadow:
		"0 10px 24px rgba(37,99,235,.35)",

	"&:hover": {
		background:
			"linear-gradient(135deg,#1d4ed8,#2563eb)",
	},
};

const warehouseDeleteButtonSx = {
	...tableActionButton,
	minWidth: 92,
	background: "linear-gradient(135deg,#dc2626,#ef4444)",
	color: "#fff",
	WebkitTextFillColor: "#fff",
	border: "1px solid rgba(220,38,38,.24)",
	boxShadow: "0 7px 16px rgba(220,38,38,.20)",

	"&:hover": {
		background: "linear-gradient(135deg,#b91c1c,#dc2626)",
		color: "#fff",
	},
};

const warehouseBulkDeleteButtonSx = {
	minWidth: 160,
	height: 44,
	borderRadius: "14px",
	fontWeight: 900,
	textTransform: "none",
	color: "#fff",
	background: "linear-gradient(180deg,#dc2626,#991b1b)",
	border: "1px solid rgba(248,113,113,.26)",
	boxShadow: "0 10px 25px rgba(220,38,38,.28)",

	"&:hover": {
		background: "linear-gradient(180deg,#ef4444,#b91c1c)",
	},
};

const warehouseDeleteOverlaySx = {
	position: "fixed",
	inset: 0,
	zIndex: 12000,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	p: 2,
	background: "var(--pf-overlay)",
	backdropFilter: "blur(14px)",
};

const warehouseDeleteModalSx = {
	width: "min(920px,96vw)",
	maxHeight: "92vh",
	display: "flex",
	flexDirection: "column",
	overflow: "hidden",
	borderRadius: "24px",
	color: "var(--pf-text-strong)",
	background:
		"radial-gradient(circle at top right,rgba(220,38,38,.12),transparent 34%),linear-gradient(180deg,var(--pf-surface),var(--pf-surface-alt))",
	border: "1px solid rgba(248,113,113,.20)",
	boxShadow: "0 34px 90px rgba(var(--pf-shadow-rgb),.24)",
};

const warehouseDeleteHeaderSx = {
	px: 2.5,
	py: 2.1,
	display: "flex",
	alignItems: "flex-start",
	justifyContent: "space-between",
	gap: 2,
	borderBottom: "1px solid rgba(var(--pf-fg-rgb),.07)",
	background: "rgba(127,29,29,.08)",
};

const warehouseDeleteEyebrowSx = {
	color: "color-mix(in srgb,#dc2626 74%,var(--pf-text-strong))",
	fontSize: 9.5,
	fontWeight: 950,
	letterSpacing: ".13em",
};

const warehouseDeleteTitleSx = {
	mt: 0.5,
	color: "var(--pf-text-strong)",
	fontSize: 22,
	fontWeight: 950,
};

const warehouseDeleteSubtitleSx = {
	mt: 0.55,
	maxWidth: 690,
	color: "var(--pf-text-muted)",
	fontSize: 11,
	fontWeight: 650,
	lineHeight: 1.5,
};

const warehouseDeleteCloseSx = {
	width: 36,
	height: 36,
	borderRadius: "10px",
	color: "color-mix(in srgb,#dc2626 74%,var(--pf-text-strong))",
	background: "rgba(239,68,68,.08)",
	border: "1px solid rgba(248,113,113,.16)",
};

const warehouseDeleteBodySx = {
	flex: 1,
	minHeight: 0,
	overflowY: "auto",
	p: 2.2,
};

const warehouseDeleteSelectionCardSx = {
	p: 1.4,
	mb: 1.4,
	borderRadius: "16px",
	background: "rgba(var(--pf-fg-rgb),.026)",
	border: "1px solid rgba(var(--pf-fg-rgb),.065)",
};

const warehouseDeleteSectionLabelSx = {
	mb: 0.9,
	color: "var(--pf-text-muted)",
	fontSize: 9,
	fontWeight: 950,
	letterSpacing: ".10em",
	textTransform: "uppercase",
};

const warehouseDeleteSelectedListSx = {
	display: "flex",
	flexDirection: "column",
	gap: 0.7,
	maxHeight: 190,
	overflowY: "auto",
};

const warehouseDeleteSelectedRowSx = {
	p: 1,
	borderRadius: "12px",
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 1.2,
	background: "var(--pf-surface-alt)",
	border: "1px solid rgba(var(--pf-fg-rgb),.055)",
};

const warehouseDeleteSelectedNameSx = {
	color: "var(--pf-text-strong)",
	fontSize: 11.5,
	fontWeight: 900,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const warehouseDeleteSelectedMetaSx = {
	mt: 0.25,
	color: "var(--pf-text-dim)",
	fontSize: 9.5,
	fontWeight: 700,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const warehouseDeleteStatusChipSx = {
	flexShrink: 0,
	color: "color-mix(in srgb,#d97706 78%,var(--pf-text-strong))",
	background: "rgba(245,158,11,.10)",
	border: "1px solid rgba(245,158,11,.20)",
	fontWeight: 900,
	fontSize: 9,
};

const warehouseDeleteLoadingSx = {
	p: 1.6,
	mb: 1.3,
	borderRadius: "14px",
	textAlign: "center",
	color: "color-mix(in srgb,#2563eb 72%,var(--pf-text-strong))",
	fontSize: 11.5,
	fontWeight: 800,
	background: "rgba(37,99,235,.08)",
	border: "1px solid rgba(96,165,250,.15)",
};

const warehouseDeleteErrorSx = {
	p: 1.3,
	mb: 1.3,
	borderRadius: "13px",
	color: "color-mix(in srgb,#dc2626 76%,var(--pf-text-strong))",
	fontSize: 11,
	fontWeight: 800,
	background: "rgba(127,29,29,.18)",
	border: "1px solid rgba(248,113,113,.20)",
};

const warehouseDeleteWarningSx = {
	p: 1.4,
	mb: 1.3,
	borderRadius: "14px",
	background: "rgba(127,29,29,.15)",
	border: "1px solid rgba(248,113,113,.20)",
};

const warehouseDeleteImpactGridSx = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit,minmax(125px,1fr))",
	gap: 0.8,
	mb: 1.5,
};

const warehouseDeleteImpactCardSx = {
	p: 1,
	borderRadius: "12px",
	background: "rgba(var(--pf-fg-rgb),.025)",
	border: "1px solid rgba(var(--pf-fg-rgb),.06)",
};

const warehouseDeleteImpactLabelSx = {
	color: "var(--pf-text-dim)",
	fontSize: 8.5,
	fontWeight: 900,
	textTransform: "uppercase",
};

const warehouseDeleteImpactValueSx = {
	mt: 0.4,
	color: "var(--pf-text-strong)",
	fontSize: 20,
	fontWeight: 950,
};

const warehouseDeleteFieldSx = {
	colorScheme: "var(--pf-color-scheme)",
	mb: 1.2,

	"& .MuiInputLabel-root": {
		color: "var(--pf-text-muted)",
	},

	"& .MuiOutlinedInput-root": {
		borderRadius: "13px",
		color: "var(--pf-text-strong)",
		background: "rgba(var(--pf-fg-rgb),.035)",

		"& fieldset": {
			borderColor: "rgba(var(--pf-fg-rgb),.09)",
		},

		"&.Mui-focused fieldset": {
			borderColor: "#f87171",
		},
	},
};

const warehouseDeleteConfirmationHintSx = {
	p: 1,
	borderRadius: "11px",
	color: "color-mix(in srgb,#dc2626 74%,var(--pf-text-strong))",
	fontSize: 10,
	background: "rgba(239,68,68,.055)",
	border: "1px dashed rgba(248,113,113,.20)",
};

const warehouseDeleteFooterSx = {
	px: 2.4,
	py: 1.7,
	display: "flex",
	alignItems: "center",
	justifyContent: "flex-end",
	gap: 1,
	borderTop: "1px solid rgba(var(--pf-fg-rgb),.07)",
	background: "var(--pf-surface-alt)",
};

const warehouseDeleteCancelSx = {
	height: 38,
	px: 2,
	borderRadius: "11px",
	textTransform: "none",
	fontWeight: 850,
	color: "var(--pf-text-soft)",
	background: "rgba(var(--pf-fg-rgb),.04)",
	border: "1px solid rgba(var(--pf-fg-rgb),.08)",
};

const warehouseDeleteConfirmSx = {
	height: 38,
	px: 2.2,
	borderRadius: "11px",
	textTransform: "none",
	fontWeight: 950,
	color: "#fff",
	background: "linear-gradient(135deg,#b91c1c,#dc2626)",
	boxShadow: "0 10px 24px rgba(220,38,38,.24)",

	"&:hover": {
		background: "linear-gradient(135deg,#991b1b,#b91c1c)",
	},
};

const popupOverlay = {
	position: "fixed",
	top: 0,
	left: 0,
	width: "100%",
	height: "100%",
	background: "var(--pf-overlay)",
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
		"linear-gradient(180deg,var(--pf-surface),var(--pf-surface-alt))",

	color: "var(--pf-text-strong)",

	border:
		"1px solid rgba(var(--pf-fg-rgb),.06)",

	boxShadow: "0 28px 72px rgba(var(--pf-shadow-rgb),.20)",
};


const gatePassNumber = {
	fontSize: 28,
	fontWeight: 950,
	color: "color-mix(in srgb,#2563eb 78%,var(--pf-text-strong))",

	letterSpacing: 2,

	marginBottom: 24,
};

export default WarehousePage;