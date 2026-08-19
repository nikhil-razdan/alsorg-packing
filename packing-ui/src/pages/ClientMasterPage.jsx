/*
 * VERIFIED BASE: ClientMasterPage(7).jsx
 * INSIGHT REFERENCE: UsersPage(5).jsx
 * BUILD: 2026-08-19 16:33 IST
 * CHANGE: Client insights added; Source table column removed.
 */

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
	Chip,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Divider,
	Drawer,
	InputAdornment,
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
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import InventoryIcon from "@mui/icons-material/Inventory";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import UnarchiveOutlinedIcon from "@mui/icons-material/UnarchiveOutlined";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import DateRangeOutlinedIcon from "@mui/icons-material/DateRangeOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";

import { useAuth } from "../auth/AuthContext";
import API from "../services/api";
import { PackFlowThemeBoundary } from "../theme/PackFlowThemeContext";

/* =========================================================
 * CLIENT MASTER CONFIGURATION
 * ========================================================= */

const MODULE_KEYS = Object.freeze({
	PACKFLOW: "PACKFLOW",
	BOMFLOW: "BOMFLOW",
	MATFLOW: "MATFLOW",
});

const PAGE_SIZE_OPTIONS = [
	10,
	25,
	50,
	100,
];

const INSIGHT_PERIOD_OPTIONS = [
	{ value: "TODAY", label: "Today" },
	{ value: "7D", label: "Last 7 Days" },
	{ value: "30D", label: "Last 30 Days" },
	{ value: "ALL", label: "All Available" },
];

const EMPTY_FORM = {
	name: "",
	address: "",
	active: true,
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

const getApiMessage = (
	error,
	fallback = "The operation could not be completed."
) => {
	const payload =
		error?.response?.data;

	if (
		typeof payload === "string" &&
		payload.trim()
	) {
		return payload;
	}

	return (
		payload?.message ||
		payload?.error ||
		error?.message ||
		fallback
	);
};

const formatDateTime = (value) => {
	if (!value) {
		return "—";
	}

	const date =
		new Date(value);

	if (
		Number.isNaN(
			date.getTime()
		)
	) {
		return String(value);
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
			timeZone: "Asia/Kolkata",
		}
	).format(date);
};

const shortId = (value) => {
	const text =
		String(value || "").trim();

	if (!text) {
		return "—";
	}

	return text.length > 12
		? `${text.slice(0, 8)}…`
		: text;
};

const normalizeClientKey = (value) => {
	return String(value || "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.replace(/\s+/g, " ");
};

const parseSmartDate = (value) => {
	if (!value) {
		return null;
	}

	const date =
		value instanceof Date
			? value
			: new Date(value);

	return Number.isNaN(date.getTime())
		? null
		: date;
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

const getInsightPeriodWindow = (period) => {
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

	return {
		key: period,
		label:
			INSIGHT_PERIOD_OPTIONS.find((option) => option.value === period)
				?.label || "Today",
		start,
		end,
		fromParam: toLocalDateTimeParam(start),
		toParam: toLocalDateTimeParam(end),
	};
};

const isWithinInsightWindow = (value, window) => {
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

	if (!date) {
		return "";
	}

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

const reportClientName = (row) => {
	return String(
		row?.clientName ||
		row?.client ||
		row?.siteName ||
		row?.customerName ||
		""
	).trim();
};

const packingTimestamp = (row) =>
	row?.packedAt ||
	row?.packingDate ||
	row?.generatedAt ||
	row?.createdAt ||
	row?.updatedAt ||
	null;

const dispatchReportTimestamp = (row) =>
	row?.dispatchedAt ||
	row?.dispatchTime ||
	row?.generatedAt ||
	row?.createdAt ||
	row?.updatedAt ||
	null;

const stickerTimestamp = (row) =>
	row?.generatedAt ||
	row?.createdAt ||
	row?.updatedAt ||
	null;

const standardChallanTimestamp = (row) =>
	row?.dispatchedAt ||
	row?.tripStartedAt ||
	row?.generatedAt ||
	row?.createdAt ||
	null;

const customChallanTimestamp = (row) =>
	row?.generatedAt ||
	row?.dispatchTime ||
	row?.createdAt ||
	null;

const packingActor = (row) =>
	String(
		row?.packedBy ||
		row?.generatedBy ||
		row?.createdBy ||
		row?.performedBy ||
		""
	).trim();

const dispatchActor = (row) =>
	String(
		row?.dispatchedBy ||
		row?.generatedBy ||
		row?.createdBy ||
		row?.performedBy ||
		""
	).trim();

const standardChallanNumber = (row, index = 0) =>
	String(
		row?.challanNumber ||
		row?.challanNo ||
		row?.number ||
		row?.id ||
		`STANDARD-${index}`
	).trim();

const customChallanNumber = (row, index = 0) =>
	String(
		row?.challanNumber ||
		row?.challanNo ||
		row?.number ||
		row?.id ||
		`CUSTOM-${index}`
	).trim();

const safeSetValues = (setValue) =>
	Array.from(setValue || []).filter(Boolean);

const buildEmptyClientInsight = (name = "") => ({
	clientName: name,
	packingPeriod: 0,
	dispatchPeriod: 0,
	periodOutput: 0,
	stickersGenerated: 0,
	initialStickers: 0,
	reprints: 0,
	standardChallans: 0,
	customChallans: 0,
	challanItems: 0,
	activeDays: 0,
	uniqueItems: 0,
	uniquePdNos: 0,
	uniqueDrawingNos: 0,
	uniqueSkus: 0,
	plants: [],
	packingUsers: [],
	dispatchUsers: [],
	activityScore: 0,
	activityBand: "No recorded work",
	firstActivityAt: null,
	lastActivityAt: null,
	recentRows: [],
});


/* =========================================================
 * PAGE
 * ========================================================= */

function ClientMasterPageContent() {
	const navigate = useNavigate();

	const {
		hasRole,
		modules: currentModules = [],
		logout: authLogout,
	} = useAuth();

	const safeCurrentModules =
		normalizeArray(
			currentModules
		);

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

	const [rows, setRows] =
		useState([]);

	const [stats, setStats] =
		useState({
			total: 0,
			active: 0,
			inactive: 0,
		});

	const [insightPeriod, setInsightPeriod] =
		useState("7D");

	const [intelligenceLoading, setIntelligenceLoading] =
		useState(false);

	const [intelligenceData, setIntelligenceData] =
		useState({
			packingRows: [],
			dispatchRows: [],
			stickerRows: [],
			standardChallans: [],
			customChallans: [],
			loadedAt: null,
			errors: [],
			sources: {},
		});

	const [insightOpen, setInsightOpen] =
		useState(false);

	const [insightClient, setInsightClient] =
		useState(null);

	const [loading, setLoading] =
		useState(true);

	const [saving, setSaving] =
		useState(false);

	const [search, setSearch] =
		useState("");

	const [
		debouncedSearch,
		setDebouncedSearch,
	] = useState("");

	const [status, setStatus] =
		useState("ALL");

	const [pageNo, setPageNo] =
		useState(1);

	const [pageSize, setPageSize] =
		useState(25);

	const [
		totalElements,
		setTotalElements,
	] = useState(0);

	const [
		totalPages,
		setTotalPages,
	] = useState(1);

	const [
		drawerOpen,
		setDrawerOpen,
	] = useState(false);

	const [
		drawerMode,
		setDrawerMode,
	] = useState("create");

	const [
		editingRow,
		setEditingRow,
	] = useState(null);

	const [form, setForm] =
		useState(EMPTY_FORM);

	const [
		formError,
		setFormError,
	] = useState("");

	const [
		confirmOpen,
		setConfirmOpen,
	] = useState(false);

	const [
		statusTarget,
		setStatusTarget,
	] = useState(null);

	const [
		statusSaving,
		setStatusSaving,
	] = useState(false);

	const [
		snackbar,
		setSnackbar,
	] = useState({
			open: false,
			severity: "success",
			message: "",
		});

	useEffect(() => {
		const timer =
			window.setTimeout(
				() => {
					setDebouncedSearch(
						search.trim()
					);
					setPageNo(1);
				},
				220
			);

		return () =>
			window.clearTimeout(
				timer
			);
	}, [search]);

	const showMessage = useCallback(
		(
			message,
			severity = "success"
		) => {
			setSnackbar({
				open: true,
				severity,
				message,
			});
		},
		[]
	);


	const insightWindow = useMemo(
		() => getInsightPeriodWindow(insightPeriod),
		[insightPeriod]
	);

	const loadIntelligence = useCallback(
		async () => {
			setIntelligenceLoading(true);

			const reportFrom =
				insightWindow.fromParam ||
				"2000-01-01T00:00:00";

			const reportTo =
				insightWindow.toParam ||
				toLocalDateTimeParam(new Date());

			const [
				packingResult,
				dispatchResult,
				stickerResult,
				standardChallanResult,
				customChallanResult,
			] = await Promise.allSettled([
				API.get("/reports/packing", {
					params: {
						from: reportFrom,
						to: reportTo,
					},
				}),
				API.get("/reports/dispatch", {
					params: {
						from: reportFrom,
						to: reportTo,
					},
				}),
				API.get("/stickers/generated-history"),
				API.get("/dispatched/challans"),
				API.get("/chalaan/custom"),
			]);

			const errors = [];
			const sources = {};

			const unpack = (result, label, key) => {
				if (result.status === "fulfilled") {
					const loadedRows = extractApiRows(
						result.value?.data
					);

					sources[key] = {
						ok: true,
						count: loadedRows.length,
					};

					return loadedRows;
				}

				const message = getApiMessage(
					result.reason,
					"Unavailable"
				);

				errors.push(`${label}: ${message}`);
				sources[key] = {
					ok: false,
					count: 0,
					message,
				};

				return [];
			};

			setIntelligenceData({
				packingRows: unpack(
					packingResult,
					"Packing report",
					"packing"
				),
				dispatchRows: unpack(
					dispatchResult,
					"Dispatch report",
					"dispatch"
				),
				stickerRows: unpack(
					stickerResult,
					"Sticker history",
					"stickers"
				),
				standardChallans: unpack(
					standardChallanResult,
					"Standard challans",
					"challans"
				),
				customChallans: unpack(
					customChallanResult,
					"Custom challans",
					"customChallans"
				),
				loadedAt: new Date(),
				errors,
				sources,
			});

			setIntelligenceLoading(false);
		},
		[insightWindow]
	);

	const loadStats = useCallback(
		async () => {
			try {
				const response =
					await API.get(
						"/client-master/stats"
					);

				setStats({
					total:
						Number(
							response.data
								?.total || 0
						),
					active:
						Number(
							response.data
								?.active || 0
						),
					inactive:
						Number(
							response.data
								?.inactive || 0
						),
				});
			} catch (error) {
				showMessage(
					getApiMessage(
						error,
						"Unable to load Client Master statistics."
					),
					"error"
				);
			}
		},
		[showMessage]
	);

	const loadRows = useCallback(
		async () => {
			setLoading(true);

			try {
				const response =
					await API.get(
						"/client-master",
						{
							params: {
								page:
									Math.max(
										0,
										pageNo - 1
									),
								size:
									pageSize,
								search:
									debouncedSearch,
								status,
							},
						}
					);

				const payload =
					response.data || {};

				const content =
					Array.isArray(
						payload.content
					)
						? payload.content
						: [];

				const nextTotalPages =
					Math.max(
						1,
						Number(
							payload.totalPages ||
							1
						)
					);

				setRows(content);

				setTotalElements(
					Number(
						payload.totalElements ||
						0
					)
				);

				setTotalPages(
					nextTotalPages
				);

				if (
					pageNo >
					nextTotalPages
				) {
					setPageNo(
						nextTotalPages
					);
				}
			} catch (error) {
				setRows([]);
				setTotalElements(0);
				setTotalPages(1);

				showMessage(
					getApiMessage(
						error,
						"Unable to load Client Master."
					),
					"error"
				);
			} finally {
				setLoading(false);
			}
		},
		[
			pageNo,
			pageSize,
			debouncedSearch,
			status,
			showMessage,
		]
	);

	const refreshAll = useCallback(
		async () => {
			await Promise.allSettled([
				loadRows(),
				loadStats(),
			]);
		},
		[
			loadRows,
			loadStats,
		]
	);

	useEffect(() => {
		refreshAll();
	}, [refreshAll]);

	useEffect(() => {
		loadIntelligence();
	}, [loadIntelligence]);

	const clientInsightsByKey = useMemo(() => {
		const map = new Map();

		const getTarget = (clientName) => {
			const cleanName = String(clientName || "").trim();
			const key = normalizeClientKey(cleanName);

			if (!key) {
				return null;
			}

			if (!map.has(key)) {
				map.set(key, {
					clientName: cleanName,
					packingPeriod: 0,
					dispatchPeriod: 0,
					stickersGenerated: 0,
					initialStickers: 0,
					reprints: 0,
					challanItems: 0,
					_standardChallanKeys: new Set(),
					_customChallanKeys: new Set(),
					_activeDayKeys: new Set(),
					_itemKeys: new Set(),
					_pdKeys: new Set(),
					_drawingKeys: new Set(),
					_skuKeys: new Set(),
					_plantKeys: new Set(),
					_packingUsers: new Set(),
					_dispatchUsers: new Set(),
					firstActivityAt: null,
					lastActivityAt: null,
					recentRows: [],
				});
			}

			return map.get(key);
		};

		const addDistinct = (setValue, value) => {
			const clean = String(value || "").trim();
			if (clean) {
				setValue.add(clean);
			}
		};

		const touch = (target, timestamp) => {
			if (!target || !timestamp) {
				return;
			}

			const parsed = parseSmartDate(timestamp);
			if (!parsed) {
				return;
			}

			const first = parseSmartDate(target.firstActivityAt);
			const last = parseSmartDate(target.lastActivityAt);

			if (!first || parsed.getTime() < first.getTime()) {
				target.firstActivityAt = timestamp;
			}

			if (!last || parsed.getTime() > last.getTime()) {
				target.lastActivityAt = timestamp;
			}

			const dayKey = localDateKey(timestamp);
			if (dayKey) {
				target._activeDayKeys.add(dayKey);
			}
		};

		const captureRowDimensions = (target, row) => {
			if (!target || !row) return;

			addDistinct(target._itemKeys, row?.itemName || row?.name || row?.description);
			addDistinct(target._pdKeys, row?.pdNo);
			addDistinct(target._drawingKeys, row?.drawingNo);
			addDistinct(target._skuKeys, row?.sku || row?.codeSku);
			addDistinct(target._plantKeys, row?.plantCode);
		};

		const addRecent = (target, category, action, timestamp, detail = "") => {
			if (!target || !timestamp || !isWithinInsightWindow(timestamp, insightWindow)) {
				return;
			}

			target.recentRows.push({
				category,
				action,
				timestamp,
				detail,
			});
		};

		(intelligenceData.packingRows || []).forEach((row) => {
			const timestamp = packingTimestamp(row);
			if (!isWithinInsightWindow(timestamp, insightWindow)) return;

			const target = getTarget(reportClientName(row));
			if (!target) return;

			target.packingPeriod += 1;
			touch(target, timestamp);
			captureRowDimensions(target, row);
			addDistinct(target._packingUsers, packingActor(row));
			addRecent(
				target,
				"PACKING",
				"Packed item",
				timestamp,
				[row?.itemName || row?.name, row?.pdNo, row?.sku]
					.filter(Boolean)
					.join(" • ")
			);
		});

		(intelligenceData.dispatchRows || []).forEach((row) => {
			const timestamp = dispatchReportTimestamp(row);
			if (!isWithinInsightWindow(timestamp, insightWindow)) return;

			const target = getTarget(reportClientName(row));
			if (!target) return;

			target.dispatchPeriod += 1;
			touch(target, timestamp);
			captureRowDimensions(target, row);
			addDistinct(target._dispatchUsers, dispatchActor(row));
			addRecent(
				target,
				"DISPATCH",
				"Dispatched item",
				timestamp,
				[row?.itemName || row?.name, row?.pdNo, row?.sku]
					.filter(Boolean)
					.join(" • ")
			);
		});

		(intelligenceData.stickerRows || []).forEach((row) => {
			const timestamp = stickerTimestamp(row);
			if (!isWithinInsightWindow(timestamp, insightWindow)) return;

			const target = getTarget(reportClientName(row));
			if (!target) return;

			target.stickersGenerated += 1;

			const isReprint =
				String(row?.reason || "").trim().toUpperCase() === "REPRINT" ||
				Number(row?.printIteration || 1) > 1;

			if (isReprint) {
				target.reprints += 1;
			} else {
				target.initialStickers += 1;
			}

			touch(target, timestamp);
			captureRowDimensions(target, row);
			addDistinct(target._packingUsers, row?.generatedBy);
			addRecent(
				target,
				"STICKER",
				isReprint ? "Sticker reprint" : "Sticker generated",
				timestamp,
				[row?.stickerNumber, row?.itemName, row?.pdNo]
					.filter(Boolean)
					.join(" • ")
			);
		});

		(intelligenceData.standardChallans || []).forEach((challan, challanIndex) => {
			const timestamp = standardChallanTimestamp(challan);
			if (!isWithinInsightWindow(timestamp, insightWindow)) return;

			const items = Array.isArray(challan?.items) ? challan.items : [];
			const byClient = new Map();

			items.forEach((item) => {
				const clientName = reportClientName(item);
				const clientKey = normalizeClientKey(clientName);
				if (!clientKey) return;

				if (!byClient.has(clientKey)) {
					byClient.set(clientKey, {
						clientName,
						items: [],
					});
				}

				byClient.get(clientKey).items.push(item);
			});

			byClient.forEach((entry) => {
				const target = getTarget(entry.clientName);
				if (!target) return;

				const challanKey = standardChallanNumber(challan, challanIndex);
				target._standardChallanKeys.add(challanKey);
				target.challanItems += entry.items.length;
				touch(target, timestamp);
				addDistinct(target._dispatchUsers, dispatchActor(challan));

				entry.items.forEach((item) => captureRowDimensions(target, item));

				addRecent(
					target,
					"CHALLAN",
					`Standard challan ${challanKey}`,
					timestamp,
					`${entry.items.length} client item${entry.items.length === 1 ? "" : "s"}`
				);
			});
		});

		(intelligenceData.customChallans || []).forEach((challan, challanIndex) => {
			const timestamp = customChallanTimestamp(challan);
			if (!isWithinInsightWindow(timestamp, insightWindow)) return;

			const target = getTarget(reportClientName(challan));
			if (!target) return;

			const challanKey = customChallanNumber(challan, challanIndex);
			target._customChallanKeys.add(challanKey);
			const items = Array.isArray(challan?.items) ? challan.items : [];
			target.challanItems += items.length;
			touch(target, timestamp);
			addDistinct(target._dispatchUsers, dispatchActor(challan));
			items.forEach((item) => captureRowDimensions(target, item));
			addRecent(
				target,
				"CHALLAN",
				`Custom challan ${challanKey}`,
				timestamp,
				`${items.length} item${items.length === 1 ? "" : "s"}`
			);
		});

		let maxOutput = 0;
		let maxTracked = 0;
		let maxDays = 0;

		map.forEach((value) => {
			value.periodOutput =
				value.packingPeriod + value.dispatchPeriod;
			value.standardChallans = value._standardChallanKeys.size;
			value.customChallans = value._customChallanKeys.size;
			value.activeDays = value._activeDayKeys.size;
			value.uniqueItems = value._itemKeys.size;
			value.uniquePdNos = value._pdKeys.size;
			value.uniqueDrawingNos = value._drawingKeys.size;
			value.uniqueSkus = value._skuKeys.size;
			value.plants = safeSetValues(value._plantKeys).sort();
			value.packingUsers = safeSetValues(value._packingUsers).sort();
			value.dispatchUsers = safeSetValues(value._dispatchUsers).sort();
			value.trackedRecords =
				value.stickersGenerated +
				value.standardChallans +
				value.customChallans;

			value.recentRows = [...value.recentRows]
				.sort(
					(a, b) =>
						(parseSmartDate(b.timestamp)?.getTime() || 0) -
						(parseSmartDate(a.timestamp)?.getTime() || 0)
				)
				.slice(0, 14);

			maxOutput = Math.max(maxOutput, value.periodOutput);
			maxTracked = Math.max(maxTracked, value.trackedRecords);
			maxDays = Math.max(maxDays, value.activeDays);
		});

		map.forEach((value) => {
			const outputIndex = maxOutput ? value.periodOutput / maxOutput : 0;
			const recordIndex = maxTracked ? value.trackedRecords / maxTracked : 0;
			const dayIndex = maxDays ? value.activeDays / maxDays : 0;

			value.activityScore = Math.round(
				Math.min(
					100,
					outputIndex * 60 +
						recordIndex * 25 +
						dayIndex * 15
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

			delete value._standardChallanKeys;
			delete value._customChallanKeys;
			delete value._activeDayKeys;
			delete value._itemKeys;
			delete value._pdKeys;
			delete value._drawingKeys;
			delete value._skuKeys;
			delete value._plantKeys;
			delete value._packingUsers;
			delete value._dispatchUsers;
		});

		return map;
	}, [intelligenceData, insightWindow]);

	const intelligenceSummary = useMemo(() => {
		const values = Array.from(clientInsightsByKey.values());

		return values.reduce(
			(result, item) => {
				result.operationalClients += item.periodOutput > 0 || item.trackedRecords > 0 ? 1 : 0;
				result.packed += item.packingPeriod;
				result.dispatched += item.dispatchPeriod;
				result.stickers += item.stickersGenerated;
				result.challans += item.standardChallans + item.customChallans;
				return result;
			},
			{
				operationalClients: 0,
				packed: 0,
				dispatched: 0,
				stickers: 0,
				challans: 0,
			}
		);
	}, [clientInsightsByKey]);

	const insightForClient = useCallback(
		(client) => {
			if (!client) {
				return buildEmptyClientInsight();
			}

			return (
				clientInsightsByKey.get(
					normalizeClientKey(client.name)
				) || buildEmptyClientInsight(client.name)
			);
		},
		[clientInsightsByKey]
	);

	const currentPage =
		Math.min(
			pageNo,
			totalPages
		);

	const visibleStart =
		totalElements === 0
			? 0
			: (
				(currentPage - 1) *
				pageSize
			) + 1;

	const visibleEnd =
		Math.min(
			totalElements,
			(
				(currentPage - 1) *
				pageSize
			) + rows.length
		);

	const activeFilterCount =
		[
			Boolean(
				search.trim()
			),
			status !== "ALL",
		].filter(Boolean).length;

	const openCreateDrawer =
		() => {
			setDrawerMode(
				"create"
			);

			setEditingRow(null);

			setForm({
				...EMPTY_FORM,
			});

			setFormError("");

			setDrawerOpen(true);
		};

	const openEditDrawer =
		(row) => {
			setDrawerMode(
				"edit"
			);

			setEditingRow(row);

			setForm({
				name:
					row?.name || "",
				address:
					row?.address || "",
				active:
					row?.active !== false,
			});

			setFormError("");

			setDrawerOpen(true);
		};

	const closeDrawer =
		() => {
			if (saving) {
				return;
			}

			setDrawerOpen(false);
			setEditingRow(null);

			setForm({
				...EMPTY_FORM,
			});

			setFormError("");
		};

	const updateForm = (
		key,
		value
	) => {
		setForm(
			(previous) => ({
				...previous,
				[key]: value,
			})
		);

		if (
			key === "name" &&
			formError
		) {
			setFormError("");
		}
	};

	const validateForm =
		() => {
			const cleanName =
				String(
					form.name || ""
				).trim();

			if (!cleanName) {
				return "Client name is required.";
			}

			if (
				cleanName.length >
				250
			) {
				return "Client name cannot exceed 250 characters.";
			}

			return "";
		};

	const saveClient =
		async () => {
			const validationError =
				validateForm();

			if (validationError) {
				setFormError(
					validationError
				);

				return;
			}

			setSaving(true);
			setFormError("");

			try {
				const payload = {
					name:
						String(
							form.name || ""
						).trim(),
					address:
						String(
							form.address ||
							""
						).trim(),
					active:
						form.active ===
						true,
				};

				if (
					drawerMode ===
					"edit" &&
					editingRow?.id
				) {
					await API.put(
						`/client-master/${encodeURIComponent(
							editingRow.id
						)}`,
						payload
					);
				} else {
					await API.post(
						"/client-master",
						payload
					);
				}

				showMessage(
					drawerMode ===
						"edit"
						? "Client updated successfully."
						: "Client created successfully."
				);

				setDrawerOpen(false);
				setEditingRow(null);

				setForm({
					...EMPTY_FORM,
				});

				await refreshAll();
			} catch (error) {
				setFormError(
					getApiMessage(
						error,
						drawerMode ===
							"edit"
							? "Unable to update client."
							: "Unable to create client."
					)
				);
			} finally {
				setSaving(false);
			}
		};

	const openStatusConfirm =
		(row) => {
			setStatusTarget(row);
			setConfirmOpen(true);
		};

	const closeStatusConfirm =
		() => {
			if (statusSaving) {
				return;
			}

			setConfirmOpen(false);
			setStatusTarget(null);
		};

	const confirmStatusChange =
		async () => {
			if (
				!statusTarget?.id
			) {
				return;
			}

			setStatusSaving(true);

			try {
				const nextActive =
					statusTarget.active ===
					false;

				await API.patch(
					`/client-master/${encodeURIComponent(
						statusTarget.id
					)}/active`,
					null,
					{
						params: {
							active:
								nextActive,
						},
					}
				);

				showMessage(
					nextActive
						? "Client reactivated successfully."
						: "Client archived successfully."
				);

				setConfirmOpen(false);
				setStatusTarget(null);

				await refreshAll();
			} catch (error) {
				showMessage(
					getApiMessage(
						error,
						"Unable to update client status."
					),
					"error"
				);
			} finally {
				setStatusSaving(false);
			}
		};

	const clearFilters =
		() => {
			setSearch("");
			setDebouncedSearch("");
			setStatus("ALL");
			setPageNo(1);
		};

	const logout =
		async () => {
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
					onModules={() =>
						navigate(
							"/modules"
						)
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
							navigate(
								"/modules"
							)
						}
						sx={
							secondaryButtonSx
						}
					>
						Module Hub
					</Button>

					<Typography
						sx={
							breadcrumbTextSx
						}
					>
						FlowSuite / Shared Master Data /
						Client Master
					</Typography>

					<Chip
						label="ADMIN ACCESS"
						size="small"
						sx={
							adminAccessChipSx
						}
					/>
				</Box>

				<Box sx={statsGridSx}>
					<StatCard label="Total Clients" value={stats.total} accent="#3b82f6" icon={<PeopleAltOutlinedIcon />} />
					<StatCard label="Active Clients" value={stats.active} accent="#22c55e" icon={<CheckCircleOutlineOutlinedIcon />} />
					<StatCard label="Archived Clients" value={stats.inactive} accent="#64748b" icon={<BlockOutlinedIcon />} />
					<StatCard label="Current Result" value={totalElements} accent="#a78bfa" icon={<VisibilityOutlinedIcon />} />
					<StatCard label={`Active • ${insightWindow.label}`} value={intelligenceSummary.operationalClients} accent="#14b8a6" icon={<TimelineOutlinedIcon />} />
					<StatCard label={`Packed • ${insightWindow.label}`} value={intelligenceSummary.packed} accent="#22c55e" icon={<FactCheckOutlinedIcon />} />
					<StatCard label={`Dispatched • ${insightWindow.label}`} value={intelligenceSummary.dispatched} accent="#f97316" icon={<LocalShippingOutlinedIcon />} />
					<StatCard label={`Sticker Events • ${insightWindow.label}`} value={intelligenceSummary.stickers} accent="#06b6d4" icon={<AssessmentOutlinedIcon />} />
				</Box>

				<Box
					sx={
						smartControlPanelSx
					}
				>
					<Box
						sx={
							smartControlHeaderSx
						}
					>
						<Box>
							<Box
								sx={
									smartControlEyebrowSx
								}
							>
								SMART CLIENT MASTER
							</Box>

							<Typography
								sx={
									smartControlTitleSx
								}
							>
								Client Directory & Operational Intelligence
							</Typography>

							<Typography
								sx={
									smartControlSubSx
								}
							>
								Maintain reusable client master data while reviewing PackFlow packing, dispatch, sticker and challan activity for each client across a selected period. Existing packet creation and free-text client entry remain unchanged.
							</Typography>
						</Box>

						<Box
							sx={
								smartControlActionsSx
							}
						>
							<Button
								startIcon={<InsightsOutlinedIcon />}
								onClick={loadIntelligence}
								disabled={intelligenceLoading}
								sx={insightsButtonSx}
							>
								{intelligenceLoading ? "Refreshing..." : "Refresh Intelligence"}
							</Button>

							<Button
								startIcon={
									<RefreshOutlinedIcon />
								}
								onClick={
									refreshAll
								}
								disabled={
									loading
								}
								sx={
									secondaryButtonSx
								}
							>
								{loading
									? "Refreshing..."
									: "Refresh"}
							</Button>

							<Button
								startIcon={
									<AddOutlinedIcon />
								}
								onClick={
									openCreateDrawer
								}
								sx={
									primaryButtonSx
								}
							>
								Add Client
							</Button>
						</Box>
					</Box>

					<Box sx={intelligenceToolbarSx}>
						<Box sx={intelligenceToolbarGroupSx}>
							<DateRangeOutlinedIcon sx={{ color: "#60a5fa", fontSize: 18 }} />
							<Typography sx={intelligenceToolbarLabelSx}>Insight Period</Typography>
							<TextField
								select
								size="small"
								value={insightPeriod}
								onChange={(event) => {
									setInsightPeriod(event.target.value);
									setPageNo(1);
								}}
								sx={{ ...fieldSx, minWidth: 165 }}
							>
								{INSIGHT_PERIOD_OPTIONS.map((option) => (
									<MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
								))}
							</TextField>
						</Box>

						<Box sx={dataSourceHealthSx}>
							<Typography sx={intelligenceToolbarLabelSx}>Data Sources</Typography>
							{Object.entries(intelligenceData.sources || {}).map(([key, source]) => (
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

					<Box
						sx={
							smartSearchRowSx
						}
					>
						<TextField
							fullWidth
							value={search}
							onChange={(
								event
							) => {
								setSearch(
									event.target
										.value
								);
								setPageNo(1);
							}}
							placeholder="Smart search: client name..."
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

					<Box
						sx={
							smartFiltersGridSx
						}
					>
						<TextField
							select
							size="small"
							label="Status"
							value={status}
							onChange={(
								event
							) => {
								setStatus(
									event.target
										.value
								);
								setPageNo(1);
							}}
							sx={fieldSx}
						>
							<MenuItem value="ALL">
								All Statuses
							</MenuItem>

							<MenuItem value="ACTIVE">
								Active
							</MenuItem>

							<MenuItem value="INACTIVE">
								Archived
							</MenuItem>
						</TextField>

						<TextField
							select
							size="small"
							label="Rows per page"
							value={pageSize}
							onChange={(
								event
							) => {
								setPageSize(
									Number(
										event.target
											.value
									)
								);
								setPageNo(1);
							}}
							sx={fieldSx}
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

						<Box
							sx={
								filterInsightCardSx
							}
						>
							<PeopleAltOutlinedIcon />

							<Box>
								<Typography
									sx={
										filterInsightLabelSx
									}
								>
									Visible Register
								</Typography>

								<Typography
									sx={
										filterInsightValueSx
									}
								>
									{totalElements} client
									{totalElements === 1
										? ""
										: "s"}
								</Typography>
							</Box>
						</Box>
					</Box>

					<Box
						sx={
							smartFilterFooterSx
						}
					>
						<Box
							sx={
								smartFilterSummarySx
							}
						>
							<FilterAltOutlinedIcon
								sx={{
									fontSize: 17,
									color: "#60a5fa",
								}}
							/>

							<Typography
								sx={mutedTextSx}
							>
								Showing {visibleStart}–{visibleEnd} of {totalElements} matching clients
							</Typography>

							{activeFilterCount >
								0 && (
								<Chip
									label={`${activeFilterCount} active filter${activeFilterCount === 1
										? ""
										: "s"}`}
									size="small"
									sx={
										smartFilterChipSx
									}
								/>
							)}

							<Typography sx={smartLoadedAtSx}>
								Insight snapshot: {intelligenceData.loadedAt ? formatDateTime(intelligenceData.loadedAt) : "Loading..."}
							</Typography>
						</Box>

						<Button
							onClick={
								clearFilters
							}
							disabled={
								activeFilterCount ===
								0
							}
							sx={
								secondaryButtonSx
							}
						>
							Clear Filters
						</Button>
					</Box>
				</Box>

				{intelligenceData.errors.length > 0 && (
					<Alert severity="warning" sx={performanceWarningSx}>
						Client Master remains available, but part of the insight snapshot could not be loaded. {intelligenceData.errors.join(" • ")}
					</Alert>
				)}

				<Box sx={tablePanelSx}>
					<Box sx={tableHeaderSx}>
						<Box>Client</Box>
						<Box>Address</Box>
						<Box>{insightWindow.label} Tracker</Box>
						<Box>Created By</Box>
						<Box>Updated By / Time</Box>
						<Box>Status</Box>
						<Box>Actions</Box>
					</Box>

					{loading ? (
						<Box sx={loadingSx}>
							<CircularProgress />
						</Box>
					) : rows.length ===
						0 ? (
						<Box
							sx={
								emptyStateSx
							}
						>
							No clients match the current filters.
						</Box>
					) : (
						<Box>
							{rows.map(
								(row) => (
									<ClientRow
										key={
											row.id
										}
										row={
											row
										}
										insight={insightForClient(row)}
										periodLabel={insightWindow.label}
										onInsights={() => {
											setInsightClient(row);
											setInsightOpen(true);
										}}
										onEdit={() =>
											openEditDrawer(
												row
											)
										}
										onToggle={() =>
											openStatusConfirm(
												row
											)
										}
									/>
								)
							)}
						</Box>
					)}

					<Box sx={paginationSx}>
						<Box
							sx={
								pageSizeSx
							}
						>
							<Typography
								sx={mutedTextSx}
							>
								Rows per page
							</Typography>

							<TextField
								select
								size="small"
								value={pageSize}
								onChange={(
									event
								) => {
									setPageSize(
										Number(
											event
												.target
												.value
										)
									);
									setPageNo(
										1
									);
								}}
								sx={{
									...fieldSx,
									width: 92,
								}}
							>
								{PAGE_SIZE_OPTIONS.map(
									(
										option
									) => (
										<MenuItem
											key={
												option
											}
											value={
												option
											}
										>
											{
												option
											}
										</MenuItem>
									)
								)}
							</TextField>
						</Box>

						<Box
							sx={
								pageControlsSx
							}
						>
							<Button
								disabled={
									currentPage <=
									1 ||
									loading
								}
								onClick={() =>
									setPageNo(
										1
									)
								}
								sx={
									pagerMiniButtonSx
								}
							>
								First
							</Button>

							<Button
								disabled={
									currentPage <=
									1 ||
									loading
								}
								onClick={() =>
									setPageNo(
										Math.max(
											1,
											currentPage -
											1
										)
									)
								}
								sx={
									pagerMiniButtonSx
								}
							>
								‹
							</Button>

							<Chip
								label={`Page ${currentPage} / ${totalPages}`}
								sx={pageChipSx}
							/>

							<Button
								disabled={
									currentPage >=
									totalPages ||
									loading
								}
								onClick={() =>
									setPageNo(
										Math.min(
											totalPages,
											currentPage +
											1
										)
									)
								}
								sx={
									pagerMiniButtonSx
								}
							>
								›
							</Button>

							<Button
								disabled={
									currentPage >=
									totalPages ||
									loading
								}
								onClick={() =>
									setPageNo(
										totalPages
									)
								}
								sx={
									pagerMiniButtonSx
								}
							>
								Last
							</Button>
						</Box>

						<Typography
							sx={mutedTextSx}
						>
							Showing {visibleStart}–{visibleEnd} of {totalElements} clients
						</Typography>
					</Box>
				</Box>

				<Alert
					severity="info"
					sx={infoAlertSx}
				>
					PackFlow client fields remain free-text. The searchable
					suggestion list uses this Client Master only after the packing
					user types at least two characters, so the entire client list is
					never dumped into the creation form.
				</Alert>
			</Box>

			<ClientEditorDrawer
				open={drawerOpen}
				mode={drawerMode}
				form={form}
				saving={saving}
				formError={
					formError
				}
				onClose={
					closeDrawer
				}
				onSave={saveClient}
				onUpdate={
					updateForm
				}
			/>

			<ClientStatusDialog
				open={confirmOpen}
				row={statusTarget}
				saving={
					statusSaving
				}
				onClose={
					closeStatusConfirm
				}
				onConfirm={
					confirmStatusChange
				}
			/>

			<ClientInsightsDialog
				open={insightOpen}
				client={insightClient}
				insight={insightClient ? insightForClient(insightClient) : null}
				periodLabel={insightWindow.label}
				sources={intelligenceData.sources}
				onClose={() => {
					setInsightOpen(false);
					setInsightClient(null);
				}}
			/>

			<Snackbar
				open={snackbar.open}
				autoHideDuration={3500}
				onClose={() =>
					setSnackbar(
						(previous) => ({
							...previous,
							open: false,
						})
					)
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
							Global Client & Shared Master Control
						</Typography>
					</Box>
				</Box>

				<Typography sx={pageTitleSx}>
					Client Master
				</Typography>

				<Typography sx={pageSubtitleSx}>
					Maintain a controlled client directory for searchable PackFlow
					selection and future cross-module reuse without changing the
					existing packet creation workflow.
				</Typography>
			</Box>

			<Box sx={headerActionsSx}>
				<Button
					startIcon={
						<AppsIcon />
					}
					onClick={onModules}
					sx={
						secondaryButtonSx
					}
				>
					Modules
				</Button>

				{canOpenPackFlow && (
					<Button
						startIcon={
							<InventoryIcon />
						}
						onClick={
							onPackFlow
						}
						sx={
							secondaryButtonSx
						}
					>
						PackFlow
					</Button>
				)}

				{canOpenBOMFlow && (
					<Button
						startIcon={
							<AccountTreeOutlinedIcon />
						}
						onClick={
							onBOMFlow
						}
						sx={
							secondaryButtonSx
						}
					>
						BOMFlow
					</Button>
				)}

				{canOpenMatFlow && (
					<Button
						startIcon={
							<LayersOutlinedIcon />
						}
						onClick={
							onMatFlow
						}
						sx={
							secondaryButtonSx
						}
					>
						MatFlow
					</Button>
				)}

				<Button
					startIcon={
						<LogoutIcon />
					}
					onClick={onLogout}
					sx={
						dangerOutlineButtonSx
					}
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
					Add Client
				</Button>
			</Box>
		</Box>
	);
}

/* =========================================================
 * CLIENT ROW
 * ========================================================= */

function ClientRow({
	row,
	insight,
	periodLabel,
	onInsights,
	onEdit,
	onToggle,
}) {
	const active =
		row?.active !== false;

	const initial =
		String(
			row?.name || "C"
		)
			.trim()
			.charAt(0)
			.toUpperCase() ||
		"C";

	const smartInsight =
		insight ||
		buildEmptyClientInsight(
			row?.name
		);

	return (
		<Box
			sx={{
				...tableRowSx,
				opacity: active
					? 1
					: 0.62,
			}}
		>
			<Box sx={clientCellSx}>
				<Box
					sx={avatarSx(
						active
							? "#3b82f6"
							: "#64748b"
					)}
				>
					{initial}
				</Box>

				<Box sx={{ minWidth: 0 }}>
					<Typography
						sx={clientNameSx}
					>
						{row?.name || "—"}
					</Typography>

					<Typography
						sx={smallMutedSx}
					>
						Client ID: {shortId(
							row?.id
						)}
					</Typography>
				</Box>
			</Box>

			<Box sx={addressCellSx}>
				<HomeWorkOutlinedIcon
					sx={{
						fontSize: 17,
						color: row?.address
							? "#60a5fa"
							: "var(--pf-text-soft)",
						flexShrink: 0,
					}}
				/>

				<Typography
					sx={
						row?.address
							? addressTextSx
							: addressEmptySx
					}
				>
					{row?.address ||
						"No address recorded"}
				</Typography>
			</Box>

			<Box sx={clientInsightCellSx}>
				<Box sx={performanceTopSx}>
					<Box>
						<Typography sx={performanceTotalSx}>
							{smartInsight.periodOutput}
						</Typography>
						<Typography sx={performancePeriodCaptionSx}>
							{periodLabel || "Period"} output
						</Typography>
					</Box>

					<Chip
						label={`${smartInsight.activityScore}%`}
						size="small"
						sx={performanceScoreChipSx(
							smartInsight.activityScore
						)}
					/>
				</Box>

				<Box sx={performanceSplitSx}>
					<span>Pack <strong>{smartInsight.packingPeriod}</strong></span>
					<span>Dispatch <strong>{smartInsight.dispatchPeriod}</strong></span>
					<span>Sticker <strong>{smartInsight.stickersGenerated}</strong></span>
					<span>Challan <strong>{smartInsight.standardChallans + smartInsight.customChallans}</strong></span>
					<span>Days <strong>{smartInsight.activeDays}</strong></span>
				</Box>

				<Typography sx={performanceBandSx}>
					{smartInsight.activityBand}
				</Typography>

				<Typography sx={performanceLastSx}>
					{smartInsight.lastActivityAt
						? formatDateTime(smartInsight.lastActivityAt)
						: "No recorded activity"}
				</Typography>
			</Box>

			<Box sx={auditCellSx}>
				<Typography
					sx={auditPrimarySx}
				>
					{row?.createdBy ||
						"SYSTEM"}
				</Typography>

				<Typography
					sx={smallMutedSx}
				>
					{formatDateTime(
						row?.createdAt
					)}
				</Typography>
			</Box>

			<Box sx={auditCellSx}>
				<Typography
					sx={auditPrimarySx}
				>
					{row?.updatedBy ||
						row?.createdBy ||
						"SYSTEM"}
				</Typography>

				<Typography
					sx={smallMutedSx}
				>
					{formatDateTime(
						row?.updatedAt ||
						row?.createdAt
					)}
				</Typography>
			</Box>

			<Box>
				<Chip
					icon={
						active ? (
							<CheckCircleOutlineOutlinedIcon />
						) : (
							<BlockOutlinedIcon />
						)
					}
					label={
						active
							? "Active"
							: "Archived"
					}
					size="small"
					sx={
						active
							? enabledChipSx
							: disabledChipSx
					}
				/>
			</Box>

			<Box sx={actionsSx}>
				<Button
					startIcon={<InsightsOutlinedIcon />}
					onClick={onInsights}
					sx={insightsButtonSx}
				>
					Insights
				</Button>

				<Button
					startIcon={
						<EditOutlinedIcon />
					}
					onClick={onEdit}
					sx={
						secondaryButtonSx
					}
				>
					Edit
				</Button>

				<Button
					startIcon={
						active
							? <ArchiveOutlinedIcon />
							: <UnarchiveOutlinedIcon />
					}
					onClick={onToggle}
					sx={
						active
							? archiveButtonSx
							: reactivateButtonSx
					}
				>
					{active
						? "Archive"
						: "Reactivate"}
				</Button>
			</Box>
		</Box>
	);
}


/* =========================================================
 * CLIENT EDITOR DRAWER
 * ========================================================= */

function ClientEditorDrawer({
	open,
	mode,
	form,
	saving,
	formError,
	onClose,
	onSave,
	onUpdate,
}) {
	const editing =
		mode === "edit";

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
						{editing
							? "Edit Client"
							: "Add Client"}
					</Typography>

					<Typography
						sx={drawerSubSx}
					>
						{editing
							? "Update the shared client master record."
							: "Create a reusable client master record."}
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
				{formError && (
					<Alert
						severity="error"
						sx={
							errorAlertSx
						}
					>
						{formError}
					</Alert>
				)}

				<Box sx={sectionSx}>
					<Typography
						sx={sectionTitleSx}
					>
						Client Details
					</Typography>

					<Typography
						sx={
							sectionDescriptionSx
						}
					>
						Client name is the searchable master key used by PackFlow
						autocomplete. Address is optional and can be maintained
						later.
					</Typography>

					<TextField
						fullWidth
						label="Client Name"
						value={form.name}
						onChange={(
							event
						) =>
							onUpdate(
								"name",
								event.target
									.value
							)
						}
						autoFocus
						sx={fieldSx}
						helperText="Required. Duplicate names are blocked by the backend using normalized-name matching."
					/>

					<TextField
						fullWidth
						label="Client Address"
						value={
							form.address
						}
						onChange={(
							event
						) =>
							onUpdate(
								"address",
								event.target
									.value
							)
						}
						multiline
						minRows={4}
						sx={fieldSx}
						helperText="Optional. XLSX-seeded records initially have no address because the source workbook contains names only."
					/>
				</Box>

				<Box
					sx={
						permissionCardSx
					}
				>
					<Box>
						<Typography
							sx={
								permissionTitleSx
							}
						>
							Active Client
						</Typography>

						<Typography
							sx={
								permissionSubSx
							}
						>
							Only active clients appear in the PackFlow searchable
							suggestion list.
						</Typography>
					</Box>

					<Switch
						checked={
							form.active ===
							true
						}
						onChange={(
							event
						) =>
							onUpdate(
								"active",
								event.target
									.checked
							)
						}
					/>
				</Box>

				<Alert
					severity="info"
					sx={infoAlertSx}
				>
					PackFlow remains free-text. Deactivating a client only removes it
					from Client Master suggestions; it does not rewrite or delete
					existing packet, sticker, warehouse or dispatch records.
				</Alert>
			</Box>

			<Box sx={drawerFooterSx}>
				<Button
					fullWidth
					onClick={onClose}
					disabled={saving}
					sx={
						secondaryButtonSx
					}
				>
					Cancel
				</Button>

				<Button
					fullWidth
					onClick={onSave}
					disabled={saving}
					sx={
						primaryButtonSx
					}
				>
					{saving
						? "Saving..."
						: editing
							? "Save Changes"
							: "Add Client"}
				</Button>
			</Box>
		</Drawer>
	);
}


/* =========================================================
 * CLIENT INSIGHTS DIALOG
 * ========================================================= */

function ClientInsightsDialog({
	open,
	client,
	insight,
	periodLabel,
	sources,
	onClose,
}) {
	if (!client) {
		return null;
	}

	const data =
		insight ||
		buildEmptyClientInsight(client.name);

	const sourceEntries =
		Object.entries(sources || {});

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
							{String(client.name || "C")
								.charAt(0)
								.toUpperCase()}
						</Box>

						<Box>
							<Typography sx={performanceDialogNameSx}>
								{client.name}
							</Typography>

							<Typography sx={performanceDialogSubSx}>
								PackFlow packing, dispatch, sticker and challan intelligence
							</Typography>
						</Box>
					</Box>

					<Button onClick={onClose} sx={closeButtonSx}>
						<CloseOutlinedIcon />
					</Button>
				</Box>
			</DialogTitle>

			<DialogContent sx={performanceDialogContentSx}>
				<Box sx={performanceHeroGridSx}>
					<PerformanceMetricCard
						label={`${periodLabel || "Period"} Output`}
						value={data.periodOutput}
						detail={`${data.packingPeriod} packed • ${data.dispatchPeriod} dispatched`}
						accent="#3b82f6"
					/>

					<PerformanceMetricCard
						label="Client Activity Index"
						value={`${data.activityScore}%`}
						detail={data.activityBand}
						accent="#22c55e"
					/>

					<PerformanceMetricCard
						label="Active Days"
						value={data.activeDays}
						detail={data.lastActivityAt ? `Last: ${formatDateTime(data.lastActivityAt)}` : "No recorded activity"}
						accent="#a78bfa"
					/>

					<PerformanceMetricCard
						label="Tracked Documents"
						value={data.stickersGenerated + data.standardChallans + data.customChallans}
						detail={`${data.stickersGenerated} sticker events • ${data.standardChallans + data.customChallans} challans`}
						accent="#14b8a6"
					/>
				</Box>

				<Box sx={performanceSectionGridSx}>
					<Box sx={performanceSectionCardSx}>
						<Typography sx={performanceSectionTitleSx}>
							Client Master Profile
						</Typography>

						<Box sx={performanceAccessListSx}>
							<div>
								<span>Status</span>
								<strong>{client.active === false ? "Archived" : "Active"}</strong>
							</div>
							<div>
								<span>Address</span>
								<strong>{client.address || "No address recorded"}</strong>
							</div>
							<div>
								<span>Created By</span>
								<strong>{client.createdBy || "SYSTEM"}</strong>
							</div>
							<div>
								<span>Created</span>
								<strong>{formatDateTime(client.createdAt)}</strong>
							</div>
							<div>
								<span>First Operational Activity</span>
								<strong>{data.firstActivityAt ? formatDateTime(data.firstActivityAt) : "No recorded activity"}</strong>
							</div>
							<div>
								<span>Last Operational Activity</span>
								<strong>{data.lastActivityAt ? formatDateTime(data.lastActivityAt) : "No recorded activity"}</strong>
							</div>
						</Box>

						<Typography sx={{ ...performanceSectionTitleSx, mt: 1.4 }}>
							Operational Footprint
						</Typography>

						<Box sx={insightTagWrapSx}>
							{data.plants.length > 0 ? data.plants.map((plant) => (
								<Chip key={plant} label={plant} size="small" sx={insightTagSx("#38bdf8")} />
							)) : <Chip label="No plant data" size="small" sx={neutralInsightChipSx} />}
						</Box>
					</Box>

					<Box sx={performanceSectionCardSx}>
						<Typography sx={performanceSectionTitleSx}>
							PackFlow Operational Record
						</Typography>

						<Box sx={performanceMixGridSx}>
							<PerformanceMixItem label="Packed" value={data.packingPeriod} accent="#22c55e" />
							<PerformanceMixItem label="Dispatched" value={data.dispatchPeriod} accent="#f97316" />
							<PerformanceMixItem label="Stickers" value={data.stickersGenerated} accent="#06b6d4" />
							<PerformanceMixItem label="Initial Stickers" value={data.initialStickers} accent="#38bdf8" />
							<PerformanceMixItem label="Reprints" value={data.reprints} accent="#f59e0b" />
							<PerformanceMixItem label="Std. Challans" value={data.standardChallans} accent="#a78bfa" />
							<PerformanceMixItem label="Custom Challans" value={data.customChallans} accent="#ec4899" />
							<PerformanceMixItem label="Challan Items" value={data.challanItems} accent="#f97316" />
							<PerformanceMixItem label="Unique Items" value={data.uniqueItems} accent="#14b8a6" />
							<PerformanceMixItem label="Unique PD Nos" value={data.uniquePdNos} accent="#60a5fa" />
							<PerformanceMixItem label="Unique DWG Nos" value={data.uniqueDrawingNos} accent="#8b5cf6" />
							<PerformanceMixItem label="Unique SKUs" value={data.uniqueSkus} accent="#22c55e" />
						</Box>

						<Typography sx={performanceNoteSx}>
							Client Activity Index is a relative operational index built from recorded packing, dispatch, sticker/challan events and active days for the selected period. It is not a commercial value, client-quality rating or business priority score.
						</Typography>
					</Box>
				</Box>

				<Box sx={performanceSectionGridSx}>
					<Box sx={performanceSectionCardSx}>
						<Typography sx={performanceSectionTitleSx}>
							Recorded Operators
						</Typography>

						<Typography sx={insightMiniHeadingSx}>Packing / Sticker Users</Typography>
						<Box sx={insightTagWrapSx}>
							{data.packingUsers.length > 0 ? data.packingUsers.map((user) => (
								<Chip key={user} label={user} size="small" sx={insightTagSx("#22c55e")} />
							)) : <Chip label="No recorded user" size="small" sx={neutralInsightChipSx} />}
						</Box>

						<Typography sx={{ ...insightMiniHeadingSx, mt: 1.2 }}>Dispatch / Challan Users</Typography>
						<Box sx={insightTagWrapSx}>
							{data.dispatchUsers.length > 0 ? data.dispatchUsers.map((user) => (
								<Chip key={user} label={user} size="small" sx={insightTagSx("#f97316")} />
							)) : <Chip label="No recorded user" size="small" sx={neutralInsightChipSx} />}
						</Box>
					</Box>

					<Box sx={performanceSectionCardSx}>
						<Typography sx={performanceSectionTitleSx}>
							Data Source Health
						</Typography>

						<Box sx={insightSourceGridSx}>
							{sourceEntries.length === 0 ? (
								<Box sx={performanceEmptySx}>Insight sources are still loading.</Box>
							) : sourceEntries.map(([key, source]) => (
								<Box key={key} sx={insightSourceRowSx(source.ok)}>
									<span>{key.replace(/([A-Z])/g, " $1")}</span>
									<strong>{source.ok ? `${source.count} loaded` : "Unavailable"}</strong>
								</Box>
							))}
						</Box>
					</Box>
				</Box>

				<Box sx={performanceRecentCardSx}>
					<Box sx={performanceRecentHeaderSx}>
						<Typography sx={performanceSectionTitleSx}>
							Recent Client Activity
						</Typography>

						<Chip
							label={`${data.recentRows?.length || 0} shown`}
							size="small"
							sx={clientInsightCountChipSx}
						/>
					</Box>

					{(!data.recentRows || data.recentRows.length === 0) ? (
						<Box sx={performanceEmptySx}>
							No client activity was found in the loaded snapshot for this period.
						</Box>
					) : (
						<Box sx={performanceRecentListSx}>
							{data.recentRows.map((activity, index) => (
								<Box
									key={`${activity.action}-${activity.timestamp}-${index}`}
									sx={performanceRecentRowSx}
								>
									<Box sx={performanceRecentDotSx(activity.category)} />

									<Box sx={{ minWidth: 0 }}>
										<Typography sx={performanceRecentActionSx}>
											{activity.action}
										</Typography>
										<Typography sx={performanceRecentMetaSx}>
											{formatDateTime(activity.timestamp)}{activity.detail ? ` • ${activity.detail}` : ""}
										</Typography>
									</Box>
								</Box>
							))}
						</Box>
					)}
				</Box>
			</DialogContent>

			<DialogActions sx={dialogActionsSx}>
				<Button onClick={onClose} sx={primaryButtonSx}>
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
			<Typography sx={performanceMetricLabelSx}>{label}</Typography>
			<Typography sx={performanceMetricValueSx}>{value}</Typography>
			<Typography sx={performanceMetricDetailSx}>{detail}</Typography>
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
 * STATUS DIALOG
 * ========================================================= */

function ClientStatusDialog({
	open,
	row,
	saving,
	onClose,
	onConfirm,
}) {
	const willReactivate =
		row?.active === false;

	return (
		<Dialog
			open={open}
			onClose={
				saving
					? undefined
					: onClose
			}
			PaperProps={{
				sx: dialogPaperSx,
			}}
		>
			<DialogTitle>
				{willReactivate
					? "Reactivate Client"
					: "Archive Client"}
			</DialogTitle>

			<DialogContent>
				<Typography
					sx={dialogTextSx}
				>
					{willReactivate ? (
						<>
							Reactivate{" "}
							<strong>
								{row?.name ||
									"this client"}
							</strong>
							? It will become searchable again in PackFlow
							Client Master suggestions.
						</>
					) : (
						<>
							Archive{" "}
							<strong>
								{row?.name ||
									"this client"}
							</strong>
							? Existing FlowSuite packet/history data will remain
							untouched; only future Client Master suggestion lookup
							will exclude it.
						</>
					)}
				</Typography>
			</DialogContent>

			<DialogActions
				sx={dialogActionsSx}
			>
				<Button
					onClick={onClose}
					disabled={saving}
					sx={
						secondaryButtonSx
					}
				>
					Cancel
				</Button>

				<Button
					onClick={
						onConfirm
					}
					disabled={saving}
					sx={
						willReactivate
							? reactivateButtonSx
							: archiveButtonSx
					}
				>
					{saving
						? "Saving..."
						: willReactivate
							? "Reactivate"
							: "Archive"}
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
		<Box
			sx={statCardSx(
				accent
			)}
		>
			<Box
				sx={statIconSx(
					accent
				)}
			>
				{icon}
			</Box>

			<Box>
				<Typography
					sx={statLabelSx}
				>
					{label}
				</Typography>

				<Typography
					sx={statValueSx}
				>
					{value}
				</Typography>
			</Box>
		</Box>
	);
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
	color:
		"rgba(var(--pf-fg-rgb),.52)",
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
	color:
		"rgba(var(--pf-fg-rgb),.62)",
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
	justifyContent:
		"space-between",
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
	background:
		"rgba(245,158,11,.12)",
	border:
		"1px solid rgba(245,158,11,.24)",
	fontWeight: 900,
};

const statsGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		sm:
			"repeat(2,minmax(0,1fr))",
		lg:
			"repeat(4,minmax(0,1fr))",
	},
	gap: 1.2,
};

const statCardSx = (
	accent
) => ({
	p: 1.6,
	minHeight: 78,
	borderRadius: "16px",
	display: "flex",
	alignItems: "center",
	gap: 1.3,
	background:
		"linear-gradient(180deg,rgba(var(--pf-surface-raised-rgb),.76),rgba(var(--pf-surface-rgb),.80))",
	border:
		`1px solid ${accent}30`,
	boxShadow:
		"0 16px 32px rgba(2,6,23,.28)",
});

const statIconSx = (
	accent
) => ({
	width: 40,
	height: 40,
	borderRadius: "12px",
	display: "grid",
	placeItems: "center",
	color: accent,
	background:
		`${accent}16`,
	border:
		`1px solid ${accent}30`,
});

const statLabelSx = {
	color:
		"rgba(var(--pf-fg-rgb),.58)",
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
	justifyContent:
		"space-between",
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
	maxWidth: 900,
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
		sm:
			"repeat(2,minmax(0,1fr))",
		lg:
			"minmax(180px,.8fr) minmax(180px,.8fr) minmax(260px,1.4fr)",
	},
	gap: 1,
};

const filterInsightCardSx = {
	minHeight: 40,
	borderRadius: "13px",
	display: "flex",
	alignItems: "center",
	gap: 1,
	px: 1.3,
	background:
		"rgba(59,130,246,.06)",
	border:
		"1px solid rgba(96,165,250,.12)",
	color: "#60a5fa",

	"& svg": {
		fontSize: 20,
	},
};

const filterInsightLabelSx = {
	color: "var(--pf-text-dim)",
	fontSize: 9.5,
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".06em",
};

const filterInsightValueSx = {
	mt: 0.1,
	color: "var(--pf-text-soft)",
	fontSize: 12,
	fontWeight: 900,
};

const smartFilterFooterSx = {
	mt: 1.1,
	pt: 1,
	borderTop:
		"1px solid rgba(148,163,184,.07)",
	display: "flex",
	justifyContent:
		"space-between",
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
	background:
		"rgba(59,130,246,.10)",
	border:
		"1px solid rgba(96,165,250,.16)",
	fontWeight: 900,
	fontSize: 9.5,
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

const smartLoadedAtSx = {
	color: "var(--pf-text-dim)",
	fontSize: 9.8,
	fontWeight: 700,
};

const performanceWarningSx = {
	borderRadius: "14px",
	background: "rgba(245,158,11,.07)",
	border: "1px solid rgba(245,158,11,.16)",
	color: "#fde68a",
	"& .MuiAlert-icon": {
		color: "#f59e0b",
	},
};

const insightsButtonSx = {
	minHeight: 36,
	borderRadius: "11px",
	px: 1.45,
	textTransform: "none",
	fontWeight: 900,
	color: "#c4b5fd",
	background: "rgba(139,92,246,.09)",
	border: "1px solid rgba(167,139,250,.20)",
	"&:hover": {
		color: "var(--pf-text-strong)",
		background: "rgba(139,92,246,.16)",
		borderColor: "rgba(167,139,250,.34)",
	},
};

const clientInsightCellSx = {
	minWidth: 0,
	p: 1,
	borderRadius: "12px",
	background: "rgba(var(--pf-surface-deep-rgb),.22)",
	border: "1px solid rgba(96,165,250,.08)",
};

const performanceTopSx = {
	display: "flex",
	alignItems: "flex-start",
	justifyContent: "space-between",
	gap: 0.8,
};

const performanceTotalSx = {
	color: "var(--pf-text-strong)",
	fontSize: 21,
	fontWeight: 950,
	lineHeight: 1,
};

const performancePeriodCaptionSx = {
	mt: 0.25,
	color: "var(--pf-text-dim)",
	fontSize: 8.5,
	fontWeight: 800,
	textTransform: "uppercase",
	letterSpacing: ".05em",
};

const performanceScoreChipSx = (score) => {
	const numeric = Number(score || 0);
	const accent = numeric >= 80 ? "#22c55e" : numeric >= 50 ? "#60a5fa" : numeric > 0 ? "#f59e0b" : "#64748b";

	return {
		height: 23,
		color: accent,
		background: `${accent}12`,
		border: `1px solid ${accent}28`,
		fontWeight: 950,
		fontSize: 9.5,
	};
};

const performanceSplitSx = {
	mt: 0.8,
	display: "flex",
	gap: 0.7,
	flexWrap: "wrap",
	color: "var(--pf-text-dim)",
	fontSize: 8.8,
	fontWeight: 800,
	"& strong": {
		color: "var(--pf-text-soft)",
		fontWeight: 950,
	},
};

const performanceBandSx = {
	mt: 0.65,
	color: "var(--pf-text-muted)",
	fontSize: 9.4,
	fontWeight: 850,
};

const performanceLastSx = {
	mt: 0.25,
	color: "var(--pf-text-soft)",
	fontSize: 8.9,
	fontWeight: 700,
};

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
		background:
			"rgba(var(--pf-surface-rgb),.35)",
		borderRadius: 999,
	},

	"&::-webkit-scrollbar-thumb": {
		background:
			"linear-gradient(90deg,#334155,#3b82f6,#60a5fa)",
		borderRadius: 999,
		border:
			"2px solid #0f172a",
	},
};

const tableHeaderSx = {
	minWidth: 1660,
	display: "grid",
	gridTemplateColumns:
		"1.05fr 1.30fr 1.45fr .72fr .92fr .58fr 330px",
	gap: 2,
	alignItems: "center",
	p: "15px 20px",
	color: "#93c5fd",
	background:
		"rgba(var(--pf-surface-deep-rgb),.34)",
	borderBottom:
		"1px solid rgba(var(--pf-fg-rgb),.08)",
	fontSize: 10.5,
	fontWeight: 950,
	textTransform: "uppercase",
	letterSpacing: ".07em",
};

const tableRowSx = {
	minWidth: 1660,
	display: "grid",
	gridTemplateColumns:
		"1.05fr 1.30fr 1.45fr .72fr .92fr .58fr 330px",
	gap: 2,
	alignItems: "center",
	p: "15px 20px",
	borderBottom:
		"1px solid rgba(var(--pf-fg-rgb),.06)",
	transition:
		"background .2s ease",

	"&:hover": {
		background:
			"rgba(59,130,246,.055)",
	},
};

const clientCellSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.2,
	minWidth: 0,
};

const avatarSx = (
	accent
) => ({
	width: 38,
	height: 38,
	borderRadius: "12px",
	display: "grid",
	placeItems: "center",
	background:
		`${accent}22`,
	color: accent,
	border:
		`1px solid ${accent}35`,
	fontWeight: 950,
	flexShrink: 0,
});

const clientNameSx = {
	color: "var(--pf-text-strong)",
	fontSize: 13.5,
	fontWeight: 900,
	whiteSpace: "normal",
	overflowWrap: "anywhere",
};

const smallMutedSx = {
	mt: 0.3,
	color:
		"rgba(var(--pf-fg-rgb),.42)",
	fontSize: 10.5,
	fontWeight: 650,
};

const addressCellSx = {
	display: "flex",
	alignItems: "flex-start",
	gap: 0.8,
	minWidth: 0,
};

const addressTextSx = {
	color: "var(--pf-text-soft)",
	fontSize: 11.5,
	fontWeight: 700,
	lineHeight: 1.45,
	overflowWrap: "anywhere",
};

const addressEmptySx = {
	...addressTextSx,
	color: "var(--pf-text-dim)",
	fontStyle: "italic",
	fontWeight: 650,
};

const auditCellSx = {
	minWidth: 0,
};

const auditPrimarySx = {
	color: "var(--pf-text-soft)",
	fontSize: 11.5,
	fontWeight: 850,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};





const enabledChipSx = {
	height: 24,
	color: "#4ade80",
	background:
		"rgba(34,197,94,.12)",
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
	color: "#fbbf24",
	background:
		"rgba(245,158,11,.12)",
	border:
		"1px solid rgba(245,158,11,.22)",
	fontWeight: 900,
	fontSize: 10,

	"& .MuiChip-icon": {
		color: "#fbbf24",
	},
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

const loadingSx = {
	minWidth: 1660,
	minHeight: 320,
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
	minWidth: 1250,
	p: 1.5,
	display: "flex",
	alignItems: "center",
	justifyContent:
		"space-between",
	gap: 2,
	flexWrap: "wrap",
	background:
		"rgba(var(--pf-surface-deep-rgb),.26)",
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
	background:
		"rgba(var(--pf-fg-rgb),.05)",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.08)",
	fontWeight: 850,
};

const pagerMiniButtonSx = {
	minWidth: 38,
	height: 34,
	borderRadius: "10px",
	px: 1,
	textTransform: "none",
	fontWeight: 900,
	color: "var(--pf-text-soft)",
	background:
		"rgba(var(--pf-fg-rgb),.035)",
	border:
		"1px solid rgba(148,163,184,.12)",

	"&:hover": {
		background:
			"rgba(59,130,246,.12)",
		borderColor:
			"rgba(96,165,250,.24)",
	},
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
		color:
			"rgba(var(--pf-fg-rgb),.28)",
		background:
			"rgba(var(--pf-fg-rgb),.04)",
	},
};

const secondaryButtonSx = {
	minHeight: 36,
	borderRadius: "11px",
	px: 1.5,
	textTransform: "none",
	fontWeight: 800,
	color: "var(--pf-text-soft)",
	background:
		"rgba(var(--pf-fg-rgb),.04)",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.08)",

	"&:hover": {
		background:
			"rgba(59,130,246,.12)",
		borderColor:
			"rgba(59,130,246,.28)",
	},

	"&.Mui-disabled": {
		color:
			"rgba(var(--pf-fg-rgb),.25)",
	},
};

const dangerOutlineButtonSx = {
	...secondaryButtonSx,
	color: "#fca5a5",
	background:
		"rgba(239,68,68,.08)",
	border:
		"1px solid rgba(239,68,68,.18)",
};

const archiveButtonSx = {
	minHeight: 36,
	borderRadius: "11px",
	px: 1.4,
	textTransform: "none",
	fontWeight: 850,
	color: "#fbbf24",
	background:
		"rgba(245,158,11,.08)",
	border:
		"1px solid rgba(245,158,11,.18)",

	"&:hover": {
		background:
			"rgba(245,158,11,.14)",
		borderColor:
			"rgba(245,158,11,.30)",
	},
};

const reactivateButtonSx = {
	minHeight: 36,
	borderRadius: "11px",
	px: 1.4,
	textTransform: "none",
	fontWeight: 850,
	color: "#86efac",
	background:
		"rgba(34,197,94,.08)",
	border:
		"1px solid rgba(34,197,94,.18)",

	"&:hover": {
		background:
			"rgba(34,197,94,.14)",
		borderColor:
			"rgba(34,197,94,.30)",
	},
};

const fieldSx = {
	"& .MuiInputLabel-root": {
		color:
			"rgba(var(--pf-fg-rgb),.55)",
		fontSize: 12,
		fontWeight: 750,
	},

	"& .MuiInputLabel-root.Mui-focused": {
		color: "#60a5fa",
	},

	"& .MuiOutlinedInput-root": {
		color: "var(--pf-text-strong)",
		background:
			"rgba(var(--pf-fg-rgb),.04)",
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
	display: "flex",
	flexDirection: "column",
};

const drawerHeaderSx = {
	p: 2.5,
	display: "flex",
	justifyContent:
		"space-between",
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
	background:
		"rgba(var(--pf-fg-rgb),.04)",
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

const drawerFooterSx = {
	p: 2,
	display: "grid",
	gridTemplateColumns:
		"1fr 1fr",
	gap: 1.2,
	borderTop:
		"1px solid rgba(var(--pf-fg-rgb),.08)",
	background:
		"rgba(var(--pf-surface-deep-rgb),.65)",
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

const permissionCardSx = {
	p: 1.5,
	borderRadius: "15px",
	display: "flex",
	alignItems: "center",
	justifyContent:
		"space-between",
	gap: 2,
	background:
		"rgba(var(--pf-fg-rgb),.035)",
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
	background:
		"rgba(59,130,246,.08)",
	color: "#bfdbfe",
	border:
		"1px solid rgba(59,130,246,.18)",

	"& .MuiAlert-icon": {
		color: "#60a5fa",
	},
};

const errorAlertSx = {
	borderRadius: "14px",
	background:
		"rgba(239,68,68,.08)",
	border:
		"1px solid rgba(239,68,68,.18)",
	color: "#fecaca",
};

const performanceDialogPaperSx = {
	background: "linear-gradient(180deg,#071120,var(--pf-surface))",
	color: "var(--pf-text-strong)",
	borderRadius: "22px",
	border: "1px solid rgba(96,165,250,.12)",
	boxShadow: "0 30px 80px rgba(2,6,23,.58)",
	maxHeight: "90vh",
};

const performanceDialogTitleSx = {
	p: 2.2,
	borderBottom: "1px solid rgba(148,163,184,.08)",
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
	background: "linear-gradient(135deg,rgba(37,99,235,.24),rgba(59,130,246,.10))",
	border: "1px solid rgba(96,165,250,.22)",
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
	background: `radial-gradient(circle at top right,${accent}18,transparent 45%),rgba(var(--pf-surface-deep-rgb),.28)`,
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
	border: "1px solid rgba(148,163,184,.07)",
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
		maxWidth: "65%",
		overflowWrap: "anywhere",
	},
};

const performanceMixGridSx = {
	display: "grid",
	gridTemplateColumns: "repeat(2,minmax(0,1fr))",
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

const performanceRecentCardSx = {
	mt: 1.3,
	p: 1.5,
	borderRadius: "15px",
	background: "rgba(var(--pf-surface-deep-rgb),.25)",
	border: "1px solid rgba(148,163,184,.07)",
};

const performanceRecentHeaderSx = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	gap: 1,
};

const performanceRecentListSx = {
	maxHeight: 280,
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
	border: "1px solid rgba(var(--pf-fg-rgb),.045)",
};

const performanceRecentDotSx = (category) => {
	const colors = {
		PACKING: "#22c55e",
		DISPATCH: "#f97316",
		STICKER: "#06b6d4",
		CHALLAN: "#a78bfa",
		OTHER: "#64748b",
	};

	const color = colors[category] || colors.OTHER;

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

const insightTagWrapSx = {
	display: "flex",
	gap: 0.6,
	flexWrap: "wrap",
};

const insightTagSx = (accent) => ({
	height: 24,
	color: accent,
	background: `${accent}10`,
	border: `1px solid ${accent}24`,
	fontWeight: 850,
	fontSize: 9.5,
});

const neutralInsightChipSx = {
	height: 24,
	color: "var(--pf-text-muted)",
	background: "rgba(100,116,139,.08)",
	border: "1px solid rgba(100,116,139,.16)",
	fontWeight: 800,
	fontSize: 9.5,
};

const insightMiniHeadingSx = {
	color: "var(--pf-text-dim)",
	fontSize: 9.5,
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".05em",
	mb: 0.7,
};

const insightSourceGridSx = {
	display: "flex",
	flexDirection: "column",
	gap: 0.65,
};

const insightSourceRowSx = (ok) => ({
	display: "flex",
	justifyContent: "space-between",
	gap: 1,
	p: 0.8,
	borderRadius: "9px",
	color: "var(--pf-text-muted)",
	background: ok ? "rgba(34,197,94,.04)" : "rgba(239,68,68,.04)",
	border: `1px solid ${ok ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.12)"}`,
	fontSize: 9.8,
	fontWeight: 800,
	textTransform: "capitalize",
	"& strong": {
		color: ok ? "#86efac" : "#fca5a5",
		fontWeight: 900,
	},
});

const clientInsightCountChipSx = {
	height: 22,
	color: "#c4b5fd",
	background: "rgba(139,92,246,.09)",
	border: "1px solid rgba(167,139,250,.18)",
	fontWeight: 900,
	fontSize: 9,
};

const dialogPaperSx = {
	minWidth: {
		xs:
			"calc(100vw - 32px)",
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


export default function ClientMasterPage() {
	return (
		<PackFlowThemeBoundary>
			<ClientMasterPageContent />
		</PackFlowThemeBoundary>
	);
}
