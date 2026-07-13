import React, {
	useEffect,
	useMemo,
	useState,
} from "react";

import {
	Alert,
	Box,
	Button,
	Card,
	CardContent,
	Chip,
	CircularProgress,
	Divider,
	MenuItem,
	TextField,
	Typography,
} from "@mui/material";

import {
	VF_STAGE as STAGE,
	VF_TRACKER_STEPS,
	getCurrentActionText,
	getStageGroupIndex,
	getStageLabel,
} from "../venflowWorkflow";

import GavelOutlinedIcon
	from "@mui/icons-material/GavelOutlined";

import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import DashboardCustomizeOutlinedIcon from "@mui/icons-material/DashboardCustomizeOutlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import PrecisionManufacturingOutlinedIcon from "@mui/icons-material/PrecisionManufacturingOutlined";
import SupervisorAccountOutlinedIcon from "@mui/icons-material/SupervisorAccountOutlined";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RadioButtonCheckedRoundedIcon from "@mui/icons-material/RadioButtonCheckedRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";

import { useNavigate, useParams } from "react-router-dom";

import VenFlowTracker from "../components/VenFlowTracker";
import VenFlowStatusChip from "../components/VenFlowStatusChip";
import VenFlowStageChip from "../components/VenFlowStageChip";

import { venflowApi } from "../api/venflowApi";
import { useAuth } from "../../../auth/AuthContext";

import {
	getVenFlowRole,
	isVenFlowAdmin,
	isVenFlowAdminOrManager,
	isVenFlowEngineering,
	isVenFlowStore,
	isVenFlowPurchase,
	isVenFlowProcessing,
	isVenFlowSupervisor,
	isVenFlowDirector,
} from "../../../utils/venflowAccess";

import {
	cardSx,
	darkMenuProps,
	dividerSx,
	errorAlertSx,
	fieldSx,
	infoLabelSx,
	infoValueSx,
	loadingBoxSx,
	outlineBtnSx,
	premiumScrollbarSx,
	primaryBtnSx,
	secondaryBtnSx,
} from "../venflowTheme";

const STOCK_DECISION_OPTIONS = [
	{
		value: "AVAILABLE",
		label: "Available",
	},
	{
		value: "NOT_AVAILABLE",
		label: "Not Available",
	},
	{
		value: "PARTIALLY_AVAILABLE",
		label: "Partially Available",
	},
	{
		value: "PENDING",
		label: "Pending",
	},
	{
		value: "HOLD",
		label: "Hold",
	},
];

const QC_OPTIONS = [
	{
		value: "OK",
		label: "QC OK",
	},
	{
		value: "NOT_OK",
		label: "QC Not OK",
	},
	{
		value: "PENDING",
		label: "QC Pending",
	},
];

const toNumberOrNull = (value) => {
	if (value === null || value === undefined || value === "") {
		return null;
	}

	const numberValue = Number(value);

	return Number.isFinite(numberValue)
		? numberValue
		: null;
};

const requirePositiveNumber = (value, message) => {
	const numberValue = toNumberOrNull(value);

	if (numberValue === null || numberValue <= 0) {
		throw new Error(message);
	}

	return numberValue;
};

const readError = (err, fallback) => {
	const data = err?.response?.data;

	if (typeof data === "string") {
		return data;
	}

	return (
		data?.message ||
		data?.error ||
		err?.message ||
		fallback
	);
};

const safeNumber = (value) => {
	const numberValue = Number(value || 0);
	return Number.isFinite(numberValue) ? numberValue : 0;
};

const formatDateTime = (value) => {
	if (!value) return "-";

	return String(value)
		.replace("T", " ")
		.slice(0, 16);
};

const formatCurrency = (value) => {
	if (
		value === null ||
		value === undefined ||
		value === ""
	) {
		return "-";
	}

	const numberValue = Number(value);

	if (!Number.isFinite(numberValue)) {
		return String(value);
	}

	return `₹${numberValue.toLocaleString(
		"en-IN",
		{
			minimumFractionDigits: 0,
			maximumFractionDigits: 2,
		}
	)}`;
};

const getDirectorDecisionText = (
	entry
) => {
	const status = String(
		entry?.poStatus || ""
	).toUpperCase();

	switch (status) {
		case "PENDING_DIRECTOR_APPROVAL":
			return "Pending Director Approval";

		case "DIRECTOR_APPROVED":
			return "Approved by Director";

		case "DIRECTOR_REJECTED":
			return "Returned to Purchase";

		case "ORDER_PLACED":
			return "Approved — Vendor Order Placed";

		default:
			return "Not Required Yet";
	}
};

const getDirectorDecisionActor = (
	entry
) => {
	return (
		entry?.directorApprovedBy ||
		entry?.directorRejectedBy ||
		"-"
	);
};

const getDirectorDecisionDate = (
	entry
) => {
	return (
		entry?.directorApprovedAt ||
		entry?.directorRejectedAt ||
		null
	);
};

const calculateBalance = (entry) => {
	if (
		entry?.balanceQty !== null &&
		entry?.balanceQty !== undefined &&
		entry?.balanceQty !== ""
	) {
		return entry.balanceQty;
	}

	const required = safeNumber(entry?.requiredQty);
	const issued = safeNumber(entry?.issuedQty);

	return Math.max(required - issued, 0);
};

// Used only for the header snapshot cards and the Overview "Quick Balance"
// tiles, which reflect stock position (Required - Available) rather than
// production movement. The Remarks tab keeps calculateBalance() above.
const calculateStoreBalance = (entry) => {
	const required = safeNumber(entry?.requiredQty);
	const available = safeNumber(entry?.availableQty);

	return Math.max(required - available, 0);
};

const getBackPathForRole = (role) => {
	const cleanRole =
		String(role || "")
			.trim()
			.toUpperCase();

	if (
		cleanRole === "ADMIN" ||
		cleanRole ===
		"VENFLOW_MANAGER"
	) {
		return "/venflow/entries";
	}

	if (
		cleanRole ===
		"VENFLOW_ENGINEERING"
	) {
		return "/venflow/dashboard";
	}

	if (
		cleanRole ===
		"VENFLOW_PRODUCTION"
	) {
		return "/venflow/production";
	}

	if (
		cleanRole ===
		"VENFLOW_SUPERVISOR"
	) {
		return "/venflow/supervisor";
	}

	if (
		cleanRole === "VENFLOW_STORE"
	) {
		return "/venflow/store";
	}

	if (
		cleanRole ===
		"VENFLOW_PURCHASE"
	) {
		return "/venflow/purchase";
	}

	return "/venflow/dashboard";
};

const firstValue = (entry, keys = []) => {
	for (const key of keys) {
		const value = entry?.[key];

		if (
			value !== null &&
			value !== undefined &&
			String(value).trim() !== ""
		) {
			return value;
		}
	}

	return "";
};

const findAuditForStage = (
	stage,
	auditRows = []
) => {
	const target =
		String(stage || "")
			.toUpperCase();

	return auditRows.find((row) => {
		const bucket = [
			row.action,
			row.oldValue,
			row.newValue,
		]
			.filter(Boolean)
			.join(" ")
			.toUpperCase();

		return bucket.includes(target);
	});
};

const findAuditForWorkflowStep = (
	step,
	auditRows = []
) => {
	const stageKeys =
		step?.stageKeys || [];

	return auditRows.find((row) => {
		const bucket = [
			row.action,
			row.oldValue,
			row.newValue,
		]
			.filter(Boolean)
			.join(" ")
			.toUpperCase();

		return stageKeys.some(
			(stageKey) =>
				bucket.includes(
					String(
						stageKey
					).toUpperCase()
				)
		);
	});
};

export default function VenFlowDetailPage() {
	const { id } = useParams();
	const navigate = useNavigate();

	const { role: authRole } = useAuth();

	const role = getVenFlowRole(authRole);

	const isAdmin = isVenFlowAdmin(role);
	const isAdminManager =
		isVenFlowAdminOrManager(role);

	const isEngineering =
		isVenFlowEngineering(role);

	const isStore =
		isVenFlowStore(role);

	const isPurchase =
		isVenFlowPurchase(role);

	const isProcessing =
		isVenFlowProcessing(role);

	const isSupervisor =
		isVenFlowSupervisor(role);

	const isDirector =
		isVenFlowDirector(role);

	const canSeeEngineering = isAdminManager || isEngineering;
	const canSeeStore = isAdminManager || isStore;
	const canSeePurchase = isAdminManager || isPurchase;
	const canSeeProcessing = isAdminManager || isProcessing;
	const canSeeSupervisor = isAdminManager || isSupervisor;
	const canSeeDirector = isDirector;

	const canDirectorAction = isDirector;
	const canEngineeringAction = isAdmin || isEngineering;
	const canStoreAction = isAdmin || isStore;
	const canPurchaseAction = isAdmin || isPurchase;
	const canProcessingAction = isAdmin || isProcessing;
	const canSupervisorAction = isAdmin || isSupervisor;

	const [entry, setEntry] = useState(null);
	const [auditRows, setAuditRows] = useState([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [activeTab, setActiveTab] = useState("overview");

	const [productForm, setProductForm] = useState({
		productDescription: "",
		veneerType: "",
		size: "",
	});

	const [expectedForm, setExpectedForm] = useState({
		expectedDate: "",
	});

	const [storeReviewForm, setStoreReviewForm] = useState({
		stockDecision: "PENDING",
		availableQty: "",
		remarks: "",
	});

	const [reserveForm, setReserveForm] = useState({
		reservedQty: "",
		remarks: "",
	});

	const [purchaseRequestForm, setPurchaseRequestForm] = useState({
		purchaseRequestNo: "",
		requisitionDate: "",
		remarks: "",
	});

	const [poForm, setPoForm] = useState({
		vendorName: "",
		poNo: "",
		poDate: "",
		poAmount: "",
		poDocumentUrl: "",
		remarks: "",
	});

	const [receivedForm, setReceivedForm] = useState({
		receivedQty: "",
		actualInHouseDate: "",
		remarks: "",
	});

	const [grnForm, setGrnForm] = useState({
		grnNo: "",
		grnDate: "",
		remarks: "",
	});

	const [qcForm, setQcForm] = useState({
		qcStatus: "OK",
		qcRemarks: "",
		rejectionReason: "",
	});

	const [productionDetailsForm, setProductionDetailsForm] = useState({
		productionDetails: "",
		supervisorName: "",
		remarks: "",
	});

	const [issueForm, setIssueForm] = useState({
		issuedQty: "",
		issuedTo: "Harender",
		remarks: "",
	});

	const [vendorOrderForm, setVendorOrderForm] =
		useState({
			vendorOrderReference: "",
			vendorAcknowledgementNo: "",
			vendorExpectedDate: "",
			remarks: "",
		});

	const [directorDecisionForm, setDirectorDecisionForm] =
		useState({
			remarks: "",
		});

	const [processingForm, setProcessingForm] = useState({
		usedQty: "",
		wastageQty: "",
		balanceQty: "",
		outputImageUrl: "",
		remarks: "",
	});

	const [remarksForm, setRemarksForm] = useState({
		remarks: "",
	});

	const tabItems = useMemo(
		() => [
			{
				value: "overview",
				label: "Overview",
				icon: <DashboardCustomizeOutlinedIcon />,
				show: true,
			},
			{
				value: "engineering",
				label: "Engineering",
				icon: <EngineeringOutlinedIcon />,
				show: canSeeEngineering,
			},
			{
				value: "store",
				label: "Store",
				icon: <StorefrontOutlinedIcon />,
				show: canSeeStore,
			},
			{
				value: "purchase",
				label: "Purchase",
				icon: <ShoppingCartOutlinedIcon />,
				show: canSeePurchase,
			},
			{
				value: "director",
				label: "Director Approval",
				icon: <GavelOutlinedIcon />,
				show: canSeeDirector,
			},
			{
				value: "receiving",
				label: "Receiving & QC",
				icon: <FactCheckOutlinedIcon />,
				show: canSeeStore,
			},
			{
				value: "issue",
				label: "Issue",
				icon: <Inventory2OutlinedIcon />,
				show: canSeeStore,
			},
			{
				value: "processing",
				label: "Processing",
				icon: <PrecisionManufacturingOutlinedIcon />,
				show: canSeeProcessing,
			},
			{
				value: "supervisor",
				label: "Supervisor",
				icon: <SupervisorAccountOutlinedIcon />,
				show: canSeeSupervisor,
			},
			{
				value: "remarks",
				label: "Remarks",
				icon: <ChatBubbleOutlineOutlinedIcon />,
				show: true,
			},
		],
		[
			canSeeEngineering,
			canSeeStore,
			canSeePurchase,
			canSeeDirector,
			canSeeProcessing,
			canSeeSupervisor,
		]
	);

	const visibleTabs = useMemo(
		() => tabItems.filter((item) => item.show),
		[tabItems]
	);

	useEffect(() => {
		const allowed = visibleTabs.some((tab) => tab.value === activeTab);

		if (!allowed) {
			setActiveTab(visibleTabs[0]?.value || "overview");
		}
	}, [activeTab, visibleTabs]);

	const load = async () => {
		try {
			setLoading(true);
			setError("");

			const res = await venflowApi.getEntry(id);
			const row = res.data || {};

			setEntry(row);

			setProductForm({
				productDescription:
					row.productDescription ||
					row.materialName ||
					"",
				veneerType: row.veneerType || "",
				size: row.size || "",
			});

			setExpectedForm({
				expectedDate: row.expectedDate || "",
			});

			setStoreReviewForm({
				stockDecision:
					row.stockDecision ||
					row.storeStatus ||
					"PENDING",
				availableQty: row.availableQty ?? "",
				remarks: row.remarks || "",
			});

			setVendorOrderForm({
				vendorOrderReference:
					row.vendorOrderReference || "",
				vendorAcknowledgementNo:
					row.vendorAcknowledgementNo || "",
				vendorExpectedDate:
					row.vendorExpectedDate || "",
				remarks:
					row.vendorOrderRemarks || "",
			});

			setDirectorDecisionForm({
				remarks: "",
			});

			setReserveForm({
				reservedQty:
					row.reservedQty ??
					row.availableQty ??
					row.requiredQty ??
					"",
				remarks: row.remarks || "",
			});

			setPurchaseRequestForm({
				purchaseRequestNo:
					row.purchaseRequestNo ||
					row.requisitionSlipNo ||
					"",
				requisitionDate:
					row.requisitionDate ||
					"",
				remarks: row.remarks || "",
			});

			setPoForm({
				vendorName: row.vendorName || "",
				poNo: row.poNo || "",
				poDate: row.poDate || "",
				poAmount: row.poAmount ?? "",
				poDocumentUrl: row.poDocumentUrl || "",
				remarks: row.remarks || "",
			});

			setReceivedForm({
				receivedQty: row.receivedQty ?? "",
				actualInHouseDate: row.actualInHouseDate || "",
				remarks: row.remarks || "",
			});

			setGrnForm({
				grnNo: row.grnNo || "",
				grnDate: row.grnDate || "",
				remarks: row.remarks || "",
			});

			setQcForm({
				qcStatus:
					row.qcStatus === "NOT_REQUIRED"
						? "OK"
						: row.qcStatus || "OK",
				qcRemarks: row.qcRemarks || "",
				rejectionReason: row.rejectionReason || "",
			});

			setProductionDetailsForm({
				productionDetails: row.productionDetails || "",
				supervisorName: row.supervisorName || "",
				remarks: row.remarks || "",
			});

			setIssueForm({
				issuedQty:
					row.issuedQty ??
					row.reservedQty ??
					row.requiredQty ??
					"",
				issuedTo: row.issuedTo || "Harender",
				remarks: row.remarks || "",
			});

			setProcessingForm({
				usedQty: row.usedQty ?? "",
				wastageQty: row.wastageQty ?? "",
				balanceQty: row.balanceQty ?? "",
				outputImageUrl: row.outputImageUrl || "",
				remarks: row.remarks || "",
			});

			setRemarksForm({
				remarks: row.remarks || "",
			});

			try {
				const auditRes = await venflowApi.getAudit(id);
				setAuditRows(
					Array.isArray(auditRes.data)
						? auditRes.data
						: []
				);
			} catch {
				setAuditRows([]);
			}
		} catch (err) {
			setEntry(null);
			setAuditRows([]);
			setError(readError(err, "Unable to load VenFlow entry."));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [id]);

	const run = async (fn) => {
		try {
			setSaving(true);
			setError("");

			await fn();
			await load();
		} catch (err) {
			setError(readError(err, "Update failed."));
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<Box sx={loadingBoxSx}>
				<CircularProgress />
			</Box>
		);
	}

	if (!entry) {
		return (
			<Alert severity="error" sx={errorAlertSx}>
				{error || "Entry not found."}
			</Alert>
		);
	}

	const stage = entry.stage;
	const stockDecision =
		entry.stockDecision ||
		entry.storeStatus ||
		"PENDING";

	const canSendToStore =
		canEngineeringAction &&
		stage === STAGE.INDENT_CREATED;

	const canStoreReview =
		canStoreAction &&
		[
			STAGE.SENT_TO_STORE,
			STAGE.STORE_REVIEWED,
			STAGE.STOCK_AVAILABLE,
		].includes(stage);

	const canReserveMaterial =
		canStoreAction &&
		[
			STAGE.STOCK_AVAILABLE,
			STAGE.MATERIAL_ACCEPTED_IN_STORE,
		].includes(stage);

	const canRaisePo =
		canPurchaseAction &&
		[
			STAGE.PURCHASE_REQUEST_RAISED,
			STAGE.PO_REJECTED_BY_DIRECTOR,
		].includes(stage);

	const canPlaceVendorOrder =
		canPurchaseAction &&
		stage ===
		STAGE.PO_APPROVED_BY_DIRECTOR &&
		entry.poStatus ===
		"DIRECTOR_APPROVED";

	const canDirectorDecide =
		canDirectorAction &&
		stage ===
		STAGE.PO_PENDING_DIRECTOR_APPROVAL &&
		entry.poStatus ===
		"PENDING_DIRECTOR_APPROVAL";

	const canReceiveMaterial =
		canStoreAction &&
		stage ===
		STAGE.ORDER_PLACED_WITH_VENDOR &&
		entry.poStatus === "ORDER_PLACED";

	const canGrn =
		canStoreAction &&
		stage === STAGE.MATERIAL_RECEIVED_AT_STORE;

	const canQc =
		canStoreAction &&
		[
			STAGE.GRN_DONE,
			STAGE.QC_PENDING,
		].includes(stage);

	const canAcceptInventory =
		canStoreAction &&
		stage === STAGE.QC_OK;

	const canRaisePurchaseRequest =
		canStoreAction &&
		[
			STAGE.STORE_REVIEWED,
			STAGE.STOCK_AVAILABLE,
			STAGE.MATERIAL_RESERVED,
		].includes(stage) &&
		[
			"NOT_AVAILABLE",
			"PARTIALLY_AVAILABLE",
			"HOLD",
		].includes(stockDecision);

	const canIssueMaterial =
		canStoreAction &&
		[
			STAGE.MATERIAL_RESERVED,
			STAGE.MATERIAL_ACCEPTED_IN_STORE,
		].includes(stage);

	const canAddProductionDetails =
		canProcessingAction &&
		[
			STAGE.MATERIAL_ISSUED_TO_PRODUCTION,
			STAGE.PROCESSING_STARTED,
			STAGE.PROCESS_COMPLETED,
		].includes(stage);

	const canStartProcessing =
		canProcessingAction &&
		stage ===
		STAGE.MATERIAL_ISSUED_TO_PRODUCTION;

	const canCompleteProcessing =
		canProcessingAction &&
		stage === STAGE.PROCESSING_STARTED;

	const canInformSupervisor =
		canProcessingAction &&
		stage === STAGE.PROCESS_COMPLETED;

	const canReadyNextStage =
		canSupervisorAction &&
		stage === STAGE.SUPERVISOR_INFORMED;


	const snapshotCards = [
		{
			label: "Required Qty",
			value: entry.requiredQty ?? 0,
			unit: entry.unit || "",
			accent: "#60a5fa",
		},
		{
			label: "Reserved Qty",
			value: entry.reservedQty ?? 0,
			unit: entry.unit || "",
			accent: "#22c55e",
		},
		{
			label: "Issued Qty",
			value: entry.issuedQty ?? 0,
			unit: entry.unit || "",
			accent: "#38bdf8",
		},
		{
			label: "Received Qty",
			value: entry.receivedQty ?? 0,
			unit: entry.unit || "",
			accent: "#34d399",
		},
		{
			label: "Balance Qty",
			value: calculateStoreBalance(entry),
			unit: entry.unit || "",
			accent: "#facc15",
		},
	];

	const renderOverviewTab = () => (
		<Box sx={tabContentSx}>
			<Card sx={sectionCardSx}>
				<CardContent sx={{ p: 0 }}>
					<SectionHeader
						number="01"
						title="Header Summary"
						subtitle="Main indent and order information"
					/>

					<Box sx={infoGridSx}>
						<Info label="Plant" value={entry.plantCode} />
						<Info label="Order Date" value={entry.orderDate} />
						<Info label="PD No." value={entry.pdNo} />
						<Info label="Drawing No." value={entry.drawingNo} />
						<Info label="Client Name" value={entry.clientName} />
						<Info label="Material Name" value={entry.materialName} />
						<Info
							label="Required Qty"
							value={`${entry.requiredQty ?? "-"} ${entry.unit || ""}`}
						/>
						<Info label="BOM Reference" value={entry.bomReference} />
						<Info label="Raised By" value={entry.raisedBy} />
						<Info label="Raised At" value={formatDateTime(entry.raisedAt)} />
					</Box>
				</CardContent>
			</Card>

			<Card sx={activeActionCardSx}>
				<CardContent sx={{ p: 2.2 }}>
					<Typography sx={activeActionTitleSx}>
						Current Stage Action
					</Typography>

					<Typography sx={activeActionTextSx}>
						{getCurrentActionText(entry)}
					</Typography>

					<Box sx={activeActionMetaSx}>
						<Chip
							label={getStageLabel(entry.stage)}
							size="small"
							sx={blueChipSx}
						/>

						<VenFlowStatusChip status={entry.storeStatus || entry.stockDecision} />

						<Chip
							label={entry.poStatus || "NOT_RAISED"}
							size="small"
							sx={purpleChipSx}
						/>
					</Box>
				</CardContent>
			</Card>

			<Card sx={sectionCardSx}>
				<CardContent sx={{ p: 0 }}>
					<SectionHeader
						number="02"
						title="Quick Balance"
						subtitle="Material movement snapshot"
					/>

					<Box sx={miniBalanceGridSx}>
						<BalanceTile label="Required" value={entry.requiredQty} unit={entry.unit} />
						<BalanceTile label="Received" value={entry.receivedQty} unit={entry.unit} />
						<BalanceTile label="Reserved" value={entry.reservedQty} unit={entry.unit} />
						<BalanceTile label="Issued" value={entry.issuedQty} unit={entry.unit} />
						<BalanceTile label="Balance" value={calculateStoreBalance(entry)} unit={entry.unit} accent="#facc15" />
					</Box>
				</CardContent>
			</Card>
		</Box>
	);

	const renderEngineeringTab = () => (
		<Box sx={tabContentSx}>
			<Card sx={sectionCardSx}>
				<CardContent sx={{ p: 0 }}>
					<SectionHeader
						number="01"
						title="Engineering / BOM Control"
						subtitle="Update material details, expected date and send indent to AKG Store"
					/>

					<Box sx={formGridSx}>
						<TextField
							label="Product / Material Description"
							value={productForm.productDescription}
							onChange={(e) =>
								setProductForm((p) => ({
									...p,
									productDescription: e.target.value,
								}))
							}
							disabled={!canEngineeringAction}
							sx={fieldSx}
						/>

						<TextField
							label="Veneer Type"
							value={productForm.veneerType}
							onChange={(e) =>
								setProductForm((p) => ({
									...p,
									veneerType: e.target.value,
								}))
							}
							disabled={!canEngineeringAction}
							sx={fieldSx}
						/>

						<TextField
							label="Size"
							value={productForm.size}
							onChange={(e) =>
								setProductForm((p) => ({
									...p,
									size: e.target.value,
								}))
							}
							disabled={!canEngineeringAction}
							sx={fieldSx}
						/>

						<TextField
							label="Expected Date"
							type="date"
							InputLabelProps={{ shrink: true }}
							value={expectedForm.expectedDate}
							onChange={(e) =>
								setExpectedForm({
									expectedDate: e.target.value,
								})
							}
							disabled={!canEngineeringAction}
							sx={fieldSx}
						/>
					</Box>

					<Box sx={actionRowSx}>
						<Button
							variant="contained"
							disabled={saving || !canEngineeringAction}
							onClick={() =>
								run(() =>
									venflowApi.updateProductDetails(id, productForm)
								)
							}
							sx={primaryBtnSx}
						>
							Save Product Details
						</Button>

						<Button
							variant="outlined"
							disabled={
								saving ||
								!canEngineeringAction ||
								!expectedForm.expectedDate
							}
							onClick={() =>
								run(() =>
									venflowApi.updateExpectedDate(id, expectedForm)
								)
							}
							sx={outlineBtnSx}
						>
							Save Expected Date
						</Button>

						<Button
							variant="contained"
							disabled={saving || !canSendToStore}
							onClick={() =>
								run(() => venflowApi.sendToStore(id))
							}
							sx={primaryBtnSx}
						>
							Send to AKG Store
						</Button>
					</Box>

					<Typography sx={hintSx}>
						“Send to AKG Store” is enabled only when the stage is Indent Created.
					</Typography>
				</CardContent>
			</Card>
		</Box>
	);

	const renderStoreTab = () => (
		<Box sx={tabContentSx}>
			<Box sx={twoColumnSx}>
				<Card sx={sectionCardSx}>
					<CardContent sx={{ p: 0 }}>
						<SectionHeader
							number="01"
							title="AKG Store Review"
							subtitle="Review stock availability and update decision"
						/>

						<Box sx={formGridSx}>
							<TextField
								select
								label="Stock Decision"
								value={storeReviewForm.stockDecision}
								onChange={(e) => {
									const nextDecision = e.target.value;

									setStoreReviewForm((p) => {
										let nextAvailable = p.availableQty;

										if (nextDecision === "AVAILABLE") {
											nextAvailable = entry.requiredQty ?? "";
										} else if (nextDecision === "NOT_AVAILABLE") {
											nextAvailable = 0;
										}

										return {
											...p,
											stockDecision: nextDecision,
											availableQty: nextAvailable,
										};
									});

									if (
										nextDecision === "AVAILABLE" ||
										nextDecision === "NOT_AVAILABLE"
									) {
										const nextAvailable =
											nextDecision === "AVAILABLE"
												? safeNumber(entry.requiredQty)
												: 0;

										setReserveForm((p) => ({
											...p,
											reservedQty: Math.max(nextAvailable, 0),
										}));
									}
								}}
								disabled={!canStoreAction}
								sx={fieldSx}
								SelectProps={{ MenuProps: darkMenuProps }}
							>
								{STOCK_DECISION_OPTIONS.map((item) => (
									<MenuItem key={item.value} value={item.value}>
										{item.label}
									</MenuItem>
								))}
							</TextField>

							<TextField
								label="Available Qty"
								type="number"
								value={storeReviewForm.availableQty}
								onChange={(e) => {
									const nextAvailableRaw = e.target.value;

									setStoreReviewForm((p) => ({
										...p,
										availableQty: nextAvailableRaw,
									}));

									const available = toNumberOrNull(nextAvailableRaw);

									if (available !== null) {
										setReserveForm((p) => ({
											...p,
											reservedQty: Math.max(available, 0),
										}));
									}
								}}
								disabled={!canStoreAction}
								sx={fieldSx}
							/>
						</Box>

						<TextField
							fullWidth
							multiline
							minRows={3}
							label="Store Remarks"
							value={storeReviewForm.remarks}
							onChange={(e) =>
								setStoreReviewForm((p) => ({
									...p,
									remarks: e.target.value,
								}))
							}
							disabled={!canStoreAction}
							sx={{ ...fieldSx, mt: 2 }}
						/>

						<Button
							variant="contained"
							disabled={saving || !canStoreReview}
							onClick={() =>
								run(() =>
									venflowApi.storeReview(id, {
										stockDecision: storeReviewForm.stockDecision,
										availableQty: toNumberOrNull(storeReviewForm.availableQty),
										remarks: storeReviewForm.remarks.trim(),
									})
								)
							}
							sx={{ ...primaryBtnSx, mt: 2 }}
						>
							Save Store Review
						</Button>

						<Typography sx={hintSx}>
							Store Review starts after Engineering sends the indent to AKG Store.
						</Typography>
					</CardContent>
				</Card>

				<Card sx={sectionCardSx}>
					<CardContent sx={{ p: 0 }}>
						<SectionHeader
							number="02"
							title="Store Decision Action"
							subtitle="Reserve material or raise purchase request"
						/>

						<Box sx={formGridSx}>
							<TextField
								label="Reserved Qty"
								type="number"
								value={reserveForm.reservedQty}
								onChange={(e) =>
									setReserveForm((p) => ({
										...p,
										reservedQty: e.target.value,
									}))
								}
								disabled={!canStoreAction}
								sx={fieldSx}
							/>

							<TextField
								label="Purchase Request No."
								value={purchaseRequestForm.purchaseRequestNo}
								onChange={(e) =>
									setPurchaseRequestForm((p) => ({
										...p,
										purchaseRequestNo: e.target.value,
									}))
								}
								disabled={!canStoreAction}
								sx={fieldSx}
							/>

							<TextField
								label="Requisition Date"
								type="date"
								InputLabelProps={{ shrink: true }}
								value={purchaseRequestForm.requisitionDate}
								onChange={(e) =>
									setPurchaseRequestForm((p) => ({
										...p,
										requisitionDate: e.target.value,
									}))
								}
								disabled={!canStoreAction}
								sx={fieldSx}
							/>
						</Box>

						<Box sx={actionRowSx}>
							<Button
								variant="contained"
								disabled={saving || !canReserveMaterial}
								onClick={() =>
									run(() =>
										venflowApi.reserveMaterial(id, {
											reservedQty: requirePositiveNumber(
												reserveForm.reservedQty,
												"Reserved Qty must be greater than zero."
											),
											remarks: reserveForm.remarks.trim(),
										})
									)
								}
								sx={primaryBtnSx}
							>
								Reserve Material
							</Button>

							<Button
								variant="outlined"
								disabled={saving || !canRaisePurchaseRequest}
								onClick={() =>
									run(() => {
										if (!purchaseRequestForm.purchaseRequestNo.trim()) {
											throw new Error("Purchase Request No. is required.");
										}

										return venflowApi.raisePurchaseRequest(id, {
											purchaseRequestNo:
												purchaseRequestForm.purchaseRequestNo.trim(),
											requisitionDate:
												purchaseRequestForm.requisitionDate || null,
											remarks:
												purchaseRequestForm.remarks.trim(),
										});
									})
								}
								sx={outlineBtnSx}
							>
								Raise Purchase Request
							</Button>
						</Box>

						<Typography sx={hintSx}>
							If stock is available, reserve it. If stock is not available / partial / hold,
							raise Purchase Request.
						</Typography>
					</CardContent>
				</Card>
			</Box>
		</Box>
	);

	const renderPurchaseTab = () => (
		<Box sx={tabContentSx}>
			<Card sx={sectionCardSx}>
				<CardContent sx={{ p: 0 }}>
					<SectionHeader
						number="01"
						title="Prepare Purchase Order"
						subtitle="Prepare the PO and submit it for Director approval. This does not place the order with the vendor."
					/>

					<Box sx={formGridSx}>
						<TextField
							label="Vendor Name"
							value={poForm.vendorName}
							onChange={(e) =>
								setPoForm((current) => ({
									...current,
									vendorName:
										e.target.value,
								}))
							}
							disabled={
								!canPurchaseAction ||
								!canRaisePo
							}
							sx={fieldSx}
						/>

						<TextField
							label="PO No."
							value={poForm.poNo}
							onChange={(e) =>
								setPoForm((current) => ({
									...current,
									poNo:
										e.target.value,
								}))
							}
							disabled={
								!canPurchaseAction ||
								!canRaisePo
							}
							sx={fieldSx}
						/>

						<TextField
							label="PO Date"
							type="date"
							InputLabelProps={{
								shrink: true,
							}}
							value={poForm.poDate}
							onChange={(e) =>
								setPoForm((current) => ({
									...current,
									poDate:
										e.target.value,
								}))
							}
							disabled={
								!canPurchaseAction ||
								!canRaisePo
							}
							sx={fieldSx}
						/>

						<TextField
							label="PO Amount"
							type="number"
							value={poForm.poAmount}
							onChange={(e) =>
								setPoForm((current) => ({
									...current,
									poAmount:
										e.target.value,
								}))
							}
							disabled={
								!canPurchaseAction ||
								!canRaisePo
							}
							sx={fieldSx}
						/>

						<TextField
							label="PO Document URL"
							value={
								poForm.poDocumentUrl
							}
							onChange={(e) =>
								setPoForm((current) => ({
									...current,
									poDocumentUrl:
										e.target.value,
								}))
							}
							disabled={
								!canPurchaseAction ||
								!canRaisePo
							}
							sx={fieldSx}
						/>

						<TextField
							label="Purchase Remarks"
							value={poForm.remarks}
							onChange={(e) =>
								setPoForm((current) => ({
									...current,
									remarks:
										e.target.value,
								}))
							}
							disabled={
								!canPurchaseAction ||
								!canRaisePo
							}
							sx={fieldSx}
						/>
					</Box>

					<Box sx={poStatusGridSx}>
						<Info
							label="Purchase Request No."
							value={
								entry.purchaseRequestNo
							}
						/>

						<Info
							label="PO Status"
							value={
								entry.poStatus ||
								"NOT_RAISED"
							}
						/>

						<Info
							label="Submitted By"
							value={
								entry.poApprovalRequestedBy ||
								entry.poRaisedBy
							}
						/>

						<Info
							label="Submitted At"
							value={formatDateTime(
								entry.poApprovalRequestedAt ||
								entry.poRaisedAt
							)}
						/>
					</Box>

					<Box sx={actionRowSx}>
						<Button
							variant="contained"
							disabled={
								saving ||
								!canRaisePo
							}
							onClick={() =>
								run(() => {
									if (
										!poForm.vendorName.trim()
									) {
										throw new Error(
											"Vendor Name is required."
										);
									}

									if (
										!poForm.poNo.trim()
									) {
										throw new Error(
											"PO No. is required."
										);
									}

									if (!poForm.poDate) {
										throw new Error(
											"PO Date is required."
										);
									}

									const amount =
										requirePositiveNumber(
											poForm.poAmount,
											"PO Amount must be greater than zero."
										);

									if (
										!poForm
											.poDocumentUrl
											.trim()
									) {
										throw new Error(
											"PO Document URL is required."
										);
									}

									return venflowApi
										.raisePo(id, {
											vendorName:
												poForm.vendorName.trim(),

											poNo:
												poForm.poNo.trim(),

											poDate:
												poForm.poDate,

											poAmount:
												amount,

											poDocumentUrl:
												poForm
													.poDocumentUrl
													.trim(),

											remarks:
												poForm.remarks.trim(),
										});
								})
							}
							sx={primaryBtnSx}
						>
							Submit PO for Director Approval
						</Button>

						{entry.poDocumentUrl && (
							<Button
								variant="outlined"
								onClick={() =>
									window.open(
										entry.poDocumentUrl,
										"_blank",
										"noopener,noreferrer"
									)
								}
								sx={outlineBtnSx}
							>
								Open PO Document
							</Button>
						)}
					</Box>
				</CardContent>
			</Card>

			<Card sx={sectionCardSx}>
				<CardContent sx={{ p: 0 }}>
					<SectionHeader
						number="02"
						title="Director Approval Gate"
						subtitle="The vendor order remains blocked until the Director approves the PO."
					/>

					<DirectorDecisionPanel
						entry={entry}
					/>
				</CardContent>
			</Card>

			<Card sx={sectionCardSx}>
				<CardContent sx={{ p: 0 }}>
					<SectionHeader
						number="03"
						title="Place Order with Vendor"
						subtitle="Enabled only after Director approval. Record the actual vendor-order reference, acknowledgement and committed delivery date."
					/>

					<Box sx={formGridSx}>
						<TextField
							label="Vendor Order Reference"
							value={
								vendorOrderForm
									.vendorOrderReference
							}
							onChange={(e) =>
								setVendorOrderForm(
									(current) => ({
										...current,
										vendorOrderReference:
											e.target.value,
									})
								)
							}
							disabled={
								!canPlaceVendorOrder
							}
							sx={fieldSx}
						/>

						<TextField
							label="Vendor Acknowledgement No."
							value={
								vendorOrderForm
									.vendorAcknowledgementNo
							}
							onChange={(e) =>
								setVendorOrderForm(
									(current) => ({
										...current,
										vendorAcknowledgementNo:
											e.target.value,
									})
								)
							}
							disabled={
								!canPlaceVendorOrder
							}
							sx={fieldSx}
						/>

						<TextField
							type="date"
							label="Vendor Expected Date"
							InputLabelProps={{
								shrink: true,
							}}
							value={
								vendorOrderForm
									.vendorExpectedDate
							}
							onChange={(e) =>
								setVendorOrderForm(
									(current) => ({
										...current,
										vendorExpectedDate:
											e.target.value,
									})
								)
							}
							disabled={
								!canPlaceVendorOrder
							}
							sx={fieldSx}
						/>

						<TextField
							label="Vendor Order Remarks"
							value={
								vendorOrderForm.remarks
							}
							onChange={(e) =>
								setVendorOrderForm(
									(current) => ({
										...current,
										remarks:
											e.target.value,
									})
								)
							}
							disabled={
								!canPlaceVendorOrder
							}
							sx={fieldSx}
						/>
					</Box>

					<Box sx={poStatusGridSx}>
						<Info
							label="Vendor Order Status"
							value={
								entry.poStatus ||
								"NOT_PLACED"
							}
						/>

						<Info
							label="Vendor Order Reference"
							value={
								entry.vendorOrderReference
							}
						/>

						<Info
							label="Vendor Acknowledgement"
							value={
								entry.vendorAcknowledgementNo
							}
						/>

						<Info
							label="Expected Delivery"
							value={
								entry.vendorExpectedDate
							}
						/>

						<Info
							label="Order Placed By"
							value={
								entry.vendorOrderPlacedBy
							}
						/>

						<Info
							label="Order Placed At"
							value={formatDateTime(
								entry.vendorOrderPlacedAt
							)}
						/>
					</Box>

					<Box sx={actionRowSx}>
						<Button
							variant="contained"
							disabled={
								saving ||
								!canPlaceVendorOrder
							}
							onClick={() =>
								run(() => {
									if (
										!vendorOrderForm
											.vendorOrderReference
											.trim()
									) {
										throw new Error(
											"Vendor Order Reference is required."
										);
									}

									if (
										!vendorOrderForm
											.vendorExpectedDate
									) {
										throw new Error(
											"Vendor Expected Date is required."
										);
									}

									return venflowApi
										.placeVendorOrder(
											id,
											{
												vendorOrderReference:
													vendorOrderForm
														.vendorOrderReference
														.trim(),

												vendorAcknowledgementNo:
													vendorOrderForm
														.vendorAcknowledgementNo
														.trim(),

												vendorExpectedDate:
													vendorOrderForm
														.vendorExpectedDate,

												remarks:
													vendorOrderForm
														.remarks
														.trim(),
											}
										);
								})
							}
							sx={primaryBtnSx}
						>
							Place Order with Vendor
						</Button>
					</Box>

					{!canPlaceVendorOrder &&
						entry.poStatus !==
						"ORDER_PLACED" && (
							<Typography sx={hintSx}>
								This action will become
								available after the Director
								approves the PO.
							</Typography>
						)}
				</CardContent>
			</Card>
		</Box>
	);

	const renderDirectorTab = () => (
		<Box sx={tabContentSx}>
			<Card sx={sectionCardSx}>
				<CardContent sx={{ p: 0 }}>
					<SectionHeader
						number="01"
						title="Director PO Review"
						subtitle="Review the complete commercial and material context before approving or returning the PO."
					/>

					<DirectorDecisionPanel
						entry={entry}
					/>

					<Box
						sx={{
							...infoGridSx,
							mt: 2,
						}}
					>
						<Info
							label="PD No."
							value={entry.pdNo}
						/>

						<Info
							label="Client"
							value={
								entry.clientName
							}
						/>

						<Info
							label="Plant"
							value={
								entry.plantCode
							}
						/>

						<Info
							label="Material"
							value={
								entry.materialName
							}
						/>

						<Info
							label="Veneer Type"
							value={
								entry.veneerType
							}
						/>

						<Info
							label="Required Qty"
							value={`${entry.requiredQty ??
								"-"
								} ${entry.unit || ""
								}`}
						/>

						<Info
							label="Purchase Request"
							value={
								entry.purchaseRequestNo
							}
						/>

						<Info
							label="Vendor"
							value={
								entry.vendorName
							}
						/>

						<Info
							label="PO No."
							value={entry.poNo}
						/>

						<Info
							label="PO Date"
							value={entry.poDate}
						/>

						<Info
							label="PO Amount"
							value={
								entry.poAmount !==
									null &&
									entry.poAmount !==
									undefined
									? `₹${Number(
										entry.poAmount
									).toLocaleString(
										"en-IN"
									)}`
									: "-"
							}
						/>

						<Info
							label="Submitted By"
							value={
								entry.poApprovalRequestedBy ||
								entry.poRaisedBy
							}
						/>

						<Info
							label="Submitted At"
							value={formatDateTime(
								entry.poApprovalRequestedAt ||
								entry.poRaisedAt
							)}
						/>

						<Info
							label="Current Department"
							value={
								entry.currentDepartment
							}
						/>

						<Info
							label="Current Stage Since"
							value={formatDateTime(
								entry.stageEnteredAt
							)}
						/>
					</Box>

					{entry.poDocumentUrl && (
						<Box sx={actionRowSx}>
							<Button
								variant="outlined"
								onClick={() =>
									window.open(
										entry.poDocumentUrl,
										"_blank",
										"noopener,noreferrer"
									)
								}
								sx={outlineBtnSx}
							>
								Open PO Document
							</Button>
						</Box>
					)}
				</CardContent>
			</Card>

			<Card sx={sectionCardSx}>
				<CardContent sx={{ p: 0 }}>
					<SectionHeader
						number="02"
						title="Director Decision"
						subtitle="Approval authorizes Purchase to place the order. Returning the PO requires a correction reason."
					/>

					<TextField
						fullWidth
						multiline
						minRows={4}
						label={
							canDirectorDecide
								? "Approval Remarks / Return Reason"
								: "Decision Remarks"
						}
						value={
							directorDecisionForm.remarks
						}
						onChange={(e) =>
							setDirectorDecisionForm({
								remarks:
									e.target.value,
							})
						}
						disabled={
							!canDirectorDecide
						}
						sx={fieldSx}
					/>

					<Box sx={actionRowSx}>
						<Button
							variant="contained"
							disabled={
								saving ||
								!canDirectorDecide
							}
							onClick={() =>
								run(() =>
									venflowApi
										.directorApprovePo(
											id,
											{
												remarks:
													directorDecisionForm
														.remarks
														.trim(),
											}
										)
								)
							}
							sx={primaryBtnSx}
						>
							Approve PO
						</Button>

						<Button
							variant="outlined"
							disabled={
								saving ||
								!canDirectorDecide
							}
							onClick={() =>
								run(() => {
									const reason =
										directorDecisionForm
											.remarks
											.trim();

									if (!reason) {
										throw new Error(
											"Return / rejection reason is required."
										);
									}

									return venflowApi
										.directorRejectPo(
											id,
											{
												remarks:
													reason,
											}
										);
								})
							}
							sx={directorRejectBtnSx}
						>
							Return to Purchase
						</Button>
					</Box>

					{!canDirectorDecide && (
						<Typography sx={hintSx}>
							Director actions are enabled
							only while the PO is pending
							Director approval.
						</Typography>
					)}
				</CardContent>
			</Card>

			<Card sx={sectionCardSx}>
				<CardContent sx={{ p: 0 }}>
					<SectionHeader
						number="03"
						title="Post-Approval Vendor Status"
						subtitle="Track whether Purchase has actually placed the approved order with the vendor."
					/>

					<Box sx={infoGridSx}>
						<Info
							label="Vendor Order Status"
							value={
								entry.poStatus
							}
						/>

						<Info
							label="Vendor Order Reference"
							value={
								entry.vendorOrderReference
							}
						/>

						<Info
							label="Acknowledgement No."
							value={
								entry.vendorAcknowledgementNo
							}
						/>

						<Info
							label="Vendor Expected Date"
							value={
								entry.vendorExpectedDate
							}
						/>

						<Info
							label="Order Placed By"
							value={
								entry.vendorOrderPlacedBy
							}
						/>

						<Info
							label="Order Placed At"
							value={formatDateTime(
								entry.vendorOrderPlacedAt
							)}
						/>
					</Box>
				</CardContent>
			</Card>
		</Box>
	);

	const renderReceivingTab = () => (
		<Box sx={tabContentSx}>
			<Card sx={sectionCardSx}>
				<CardContent sx={{ p: 0 }}>
					<SectionHeader
						number="01"
						title="Store Receiving / GRN / QC / Inventory"
						subtitle="Receive material, complete GRN, QC and inventory acceptance"
					/>

					<Box sx={formGridSx}>
						<TextField
							label="Received Qty"
							type="number"
							value={receivedForm.receivedQty}
							onChange={(e) =>
								setReceivedForm((p) => ({
									...p,
									receivedQty: e.target.value,
								}))
							}
							disabled={!canStoreAction}
							sx={fieldSx}
						/>

						<TextField
							label="Actual In-house Date"
							type="date"
							InputLabelProps={{ shrink: true }}
							value={receivedForm.actualInHouseDate}
							onChange={(e) =>
								setReceivedForm((p) => ({
									...p,
									actualInHouseDate: e.target.value,
								}))
							}
							disabled={!canStoreAction}
							sx={fieldSx}
						/>

						<TextField
							label="GRN No."
							value={grnForm.grnNo}
							onChange={(e) =>
								setGrnForm((p) => ({
									...p,
									grnNo: e.target.value,
								}))
							}
							disabled={!canStoreAction}
							sx={fieldSx}
						/>

						<TextField
							label="GRN Date"
							type="date"
							InputLabelProps={{ shrink: true }}
							value={grnForm.grnDate}
							onChange={(e) =>
								setGrnForm((p) => ({
									...p,
									grnDate: e.target.value,
								}))
							}
							disabled={!canStoreAction}
							sx={fieldSx}
						/>

						<TextField
							select
							label="QC Status"
							value={qcForm.qcStatus}
							onChange={(e) =>
								setQcForm((p) => ({
									...p,
									qcStatus: e.target.value,
								}))
							}
							disabled={!canStoreAction}
							sx={fieldSx}
							SelectProps={{ MenuProps: darkMenuProps }}
						>
							{QC_OPTIONS.map((item) => (
								<MenuItem key={item.value} value={item.value}>
									{item.label}
								</MenuItem>
							))}
						</TextField>

						<TextField
							label="QC Remarks"
							value={qcForm.qcRemarks}
							onChange={(e) =>
								setQcForm((p) => ({
									...p,
									qcRemarks: e.target.value,
								}))
							}
							disabled={!canStoreAction}
							sx={fieldSx}
						/>
					</Box>

					<TextField
						fullWidth
						label="Rejection / Hold Reason"
						value={qcForm.rejectionReason}
						onChange={(e) =>
							setQcForm((p) => ({
								...p,
								rejectionReason: e.target.value,
							}))
						}
						disabled={!canStoreAction}
						sx={{ ...fieldSx, mt: 2 }}
					/>

					<Box sx={actionRowSx}>
						<Button
							variant="contained"
							disabled={saving || !canReceiveMaterial}
							onClick={() =>
								run(() =>
									venflowApi.materialReceived(id, {
										receivedQty: requirePositiveNumber(
											receivedForm.receivedQty,
											"Received Qty must be greater than zero."
										),
										actualInHouseDate:
											receivedForm.actualInHouseDate || null,
										remarks: receivedForm.remarks.trim(),
									})
								)
							}
							sx={primaryBtnSx}
						>
							Save Receiving
						</Button>

						<Button
							variant="outlined"
							disabled={saving || !canGrn}
							onClick={() =>
								run(() => {
									if (!grnForm.grnNo.trim()) {
										throw new Error("GRN No. is required.");
									}

									if (!grnForm.grnDate) {
										throw new Error("GRN Date is required.");
									}

									return venflowApi.grnEntry(id, {
										grnNo: grnForm.grnNo.trim(),
										grnDate: grnForm.grnDate,
										remarks: grnForm.remarks.trim(),
									});
								})
							}
							sx={outlineBtnSx}
						>
							Save GRN
						</Button>

						<Button
							variant="outlined"
							disabled={saving || !canQc}
							onClick={() =>
								run(() =>
									venflowApi.qualityCheck(id, {
										qcStatus: qcForm.qcStatus,
										qcRemarks: qcForm.qcRemarks.trim(),
										rejectionReason: qcForm.rejectionReason.trim(),
									})
								)
							}
							sx={outlineBtnSx}
						>
							Save QC
						</Button>

						<Button
							variant="contained"
							disabled={saving || !canAcceptInventory}
							onClick={() =>
								run(() => venflowApi.acceptInventory(id))
							}
							sx={primaryBtnSx}
						>
							Accept Inventory
						</Button>
					</Box>
				</CardContent>
			</Card>
		</Box>
	);

	const renderIssueTab = () => (
		<Box sx={tabContentSx}>
			<Card sx={sectionCardSx}>
				<CardContent sx={{ p: 0 }}>
					<SectionHeader
						number="01"
						title="Issue to Production"
						subtitle="Issue reserved or QC OK Store Inventory material to Harender / process team"
					/>

					<Box sx={formGridSx}>
						<TextField
							label="Issued Qty"
							type="number"
							value={issueForm.issuedQty}
							onChange={(e) =>
								setIssueForm((p) => ({
									...p,
									issuedQty: e.target.value,
								}))
							}
							disabled={!canStoreAction}
							sx={fieldSx}
						/>

						<TextField
							label="Issued To"
							value={issueForm.issuedTo}
							onChange={(e) =>
								setIssueForm((p) => ({
									...p,
									issuedTo: e.target.value,
								}))
							}
							disabled={!canStoreAction}
							sx={fieldSx}
						/>
					</Box>

					<Button
						variant="contained"
						disabled={saving || !canIssueMaterial}
						onClick={() =>
							run(() => {
								if (!issueForm.issuedTo.trim()) {
									throw new Error("Issued To is required.");
								}

								return venflowApi.issueMaterial(id, {
									issuedQty: requirePositiveNumber(
										issueForm.issuedQty,
										"Issued Qty must be greater than zero."
									),
									issuedTo: issueForm.issuedTo.trim(),
									remarks: issueForm.remarks.trim(),
								});
							})
						}
						sx={{ ...primaryBtnSx, mt: 2 }}
					>
						Issue Material
					</Button>
				</CardContent>
			</Card>
		</Box>
	);

	const renderProcessingTab = () => (
		<Box sx={tabContentSx}>
			<Card sx={sectionCardSx}>
				<CardContent sx={{ p: 0 }}>
					<SectionHeader
						number="01"
						title="Veneer Processing"
						subtitle="Save processing responsibility, start processing, then record used qty, wastage, balance and output image"
					/>

					<Box sx={formGridSx}>
						<TextField
							label="Processing Details"
							value={productionDetailsForm.productionDetails}
							onChange={(e) =>
								setProductionDetailsForm((p) => ({
									...p,
									productionDetails: e.target.value,
								}))
							}
							disabled={!canProcessingAction}
							sx={fieldSx}
						/>

						<TextField
							label="Supervisor Name"
							value={productionDetailsForm.supervisorName}
							onChange={(e) =>
								setProductionDetailsForm((p) => ({
									...p,
									supervisorName: e.target.value,
								}))
							}
							disabled={!canProcessingAction}
							sx={fieldSx}
						/>

						<TextField
							label="Used Qty"
							type="number"
							value={processingForm.usedQty}
							onChange={(e) =>
								setProcessingForm((p) => ({
									...p,
									usedQty: e.target.value,
								}))
							}
							disabled={!canProcessingAction}
							sx={fieldSx}
						/>

						<TextField
							label="Wastage Qty"
							type="number"
							value={processingForm.wastageQty}
							onChange={(e) =>
								setProcessingForm((p) => ({
									...p,
									wastageQty: e.target.value,
								}))
							}
							disabled={!canProcessingAction}
							sx={fieldSx}
						/>

						<TextField
							label="Balance Qty"
							type="number"
							value={processingForm.balanceQty}
							onChange={(e) =>
								setProcessingForm((p) => ({
									...p,
									balanceQty: e.target.value,
								}))
							}
							disabled={!canProcessingAction}
							sx={fieldSx}
						/>

						<TextField
							label="Output Image URL"
							value={processingForm.outputImageUrl}
							onChange={(e) =>
								setProcessingForm((p) => ({
									...p,
									outputImageUrl: e.target.value,
								}))
							}
							disabled={!canProcessingAction}
							sx={fieldSx}
						/>
					</Box>

					<Box sx={actionRowSx}>
						<Button
							variant="contained"
							disabled={saving || !canAddProductionDetails}
							onClick={() =>
								run(() => {
									if (!productionDetailsForm.productionDetails.trim()) {
										throw new Error("Production details are required.");
									}

									return venflowApi.productionDetails(id, {
										productionDetails:
											productionDetailsForm.productionDetails.trim(),
										supervisorName:
											productionDetailsForm.supervisorName.trim(),
										remarks:
											productionDetailsForm.remarks.trim(),
									});
								})
							}
							sx={primaryBtnSx}
						>
							Save Processing Details
						</Button>

						<Button
							variant="outlined"
							disabled={saving || !canStartProcessing}
							onClick={() =>
								run(() => venflowApi.startProcessing(id))
							}
							sx={outlineBtnSx}
						>
							Start Processing
						</Button>

						<Button
							variant="contained"
							disabled={saving || !canCompleteProcessing}
							onClick={() =>
								run(() => {
									const issued =
										safeNumber(entry.issuedQty);

									const used =
										toNumberOrNull(
											processingForm.usedQty
										);

									const wastage =
										toNumberOrNull(
											processingForm.wastageQty
										);

									if (
										used === null ||
										used < 0
									) {
										throw new Error(
											"Used Qty is required and cannot be negative."
										);
									}

									if (
										wastage === null ||
										wastage < 0
									) {
										throw new Error(
											"Wastage Qty is required and cannot be negative."
										);
									}

									const calculatedBalance =
										issued - used - wastage;

									if (calculatedBalance < 0) {
										throw new Error(
											"Used Qty plus Wastage Qty cannot exceed Issued Qty."
										);
									}

									if (
										!processingForm.outputImageUrl.trim()
									) {
										throw new Error(
											"Output Image URL is required."
										);
									}

									return venflowApi.completeProcess(
										id,
										{
											usedQty: used,
											wastageQty: wastage,
											balanceQty:
												calculatedBalance,
											outputImageUrl:
												processingForm
													.outputImageUrl
													.trim(),
											remarks:
												processingForm
													.remarks
													.trim(),
										}
									);
								})
							}
							sx={primaryBtnSx}
						>
							Complete Process
						</Button>

						<Button
							variant="outlined"
							disabled={saving || !canInformSupervisor}
							onClick={() =>
								run(() => venflowApi.supervisorInformed(id))
							}
							sx={outlineBtnSx}
						>
							Inform Supervisor
						</Button>
					</Box>
				</CardContent>
			</Card>
		</Box>
	);

	const renderSupervisorTab = () => (
		<Box sx={tabContentSx}>
			<Card sx={sectionCardSx}>
				<CardContent sx={{ p: 0 }}>
					<SectionHeader
						number="01"
						title="Supervisor Closure"
						subtitle="Review final production output and mark ready for next stage"
					/>

					<Box sx={infoGridSx}>
						<Info label="Supervisor Name" value={entry.supervisorName} />
						<Info label="Supervisor Informed By" value={entry.supervisorInformedBy} />
						<Info label="Supervisor Informed At" value={formatDateTime(entry.supervisorInformedAt)} />
					</Box>

					<Button
						variant="contained"
						disabled={saving || !canReadyNextStage}
						onClick={() =>
							run(() => venflowApi.readyForNextStage(id))
						}
						sx={{ ...primaryBtnSx, mt: 2 }}
					>
						Mark Ready for Next Stage
					</Button>
				</CardContent>
			</Card>
		</Box>
	);

	const renderRemarksTab = () => (
		<Box sx={tabContentSx}>
			<Card sx={sectionCardSx}>
				<CardContent sx={{ p: 0 }}>
					<SectionHeader
						number="01"
						title="Balance & Remarks"
						subtitle="Final quantity summary and remarks"
					/>

					<Box sx={infoGridSx}>
						<Info label="Required Qty" value={`${entry.requiredQty ?? "-"} ${entry.unit || ""}`} />
						<Info label="Ordered Qty" value={`${entry.orderedQty ?? "-"} ${entry.unit || ""}`} />
						<Info label="Received Qty" value={entry.receivedQty ?? "-"} />
						<Info label="Reserved Qty" value={entry.reservedQty ?? "-"} />
						<Info label="Issued Qty" value={entry.issuedQty ?? "-"} />
						<Info label="Balance Qty" value={calculateBalance(entry)} />
					</Box>

					<TextField
						fullWidth
						multiline
						minRows={5}
						label="Remarks"
						value={remarksForm.remarks}
						onChange={(e) =>
							setRemarksForm({
								remarks: e.target.value,
							})
						}
						sx={{
							...fieldSx,
							mt: 2,
						}}
					/>

					<Button
						variant="outlined"
						disabled={saving}
						onClick={() =>
							run(() => venflowApi.updateRemarks(id, remarksForm))
						}
						sx={{ ...outlineBtnSx, mt: 2 }}
					>
						Save Remarks
					</Button>
				</CardContent>
			</Card>
		</Box>
	);

	const renderActiveTab = () => {
		if (activeTab === "engineering") return renderEngineeringTab();
		if (activeTab === "store") return renderStoreTab();
		if (activeTab === "purchase") return renderPurchaseTab();
		if (activeTab === "director") return renderDirectorTab();
		if (activeTab === "receiving") return renderReceivingTab();
		if (activeTab === "issue") return renderIssueTab();
		if (activeTab === "processing") return renderProcessingTab();
		if (activeTab === "supervisor") return renderSupervisorTab();
		if (activeTab === "remarks") return renderRemarksTab();

		return renderOverviewTab();
	};

	return (
		<Box sx={detailPageSx}>
			<Box sx={topBarSx}>
				<Button
					startIcon={<ArrowBackRoundedIcon />}
					onClick={() => navigate(getBackPathForRole(role))}
					sx={secondaryBtnSx}
				>
					Back
				</Button>

				<Box sx={topActionsSx}>
					<Button
						startIcon={<RefreshRoundedIcon />}
						onClick={load}
						disabled={saving}
						sx={outlineBtnSx}
					>
						Refresh
					</Button>

					<Button
						onClick={() => navigate("/venflow/entries")}
						sx={secondaryBtnSx}
					>
						Full Tracker
					</Button>
				</Box>
			</Box>

			<Card sx={heroCardSx}>
				<CardContent sx={{ p: 0 }}>
					<Box sx={heroHeadSx}>
						<Box sx={{ minWidth: 0 }}>
							<Typography sx={heroTitleSx}>
								{entry.pdNo || "VenFlow Requirement"} — {entry.clientName || "-"}
							</Typography>

							<Box sx={chipsRowSx}>
								<VenFlowStageChip stage={entry.stage} />
								<VenFlowStatusChip status={entry.storeStatus || entry.stockDecision} />

								<Chip
									label={`Plant ${entry.plantCode || "-"}`}
									size="small"
									sx={neutralChipSx}
								/>

								<Chip
									label={`PO ${entry.poNo || entry.poStatus || "Not Raised"}`}
									size="small"
									sx={neutralChipSx}
								/>
								{[
									"PENDING_DIRECTOR_APPROVAL",
									"DIRECTOR_APPROVED",
									"DIRECTOR_REJECTED",
									"ORDER_PLACED",
								].includes(entry.poStatus) && (
										<Chip
											label={getDirectorDecisionText(
												entry
											)}
											size="small"
											sx={
												entry.poStatus ===
													"DIRECTOR_APPROVED"
													? directorApprovedChipSx
													: entry.poStatus ===
														"DIRECTOR_REJECTED"
														? directorRejectedChipSx
														: entry.poStatus ===
															"ORDER_PLACED"
															? directorOrderPlacedChipSx
															: directorPendingChipSx
											}
										/>
									)}
							</Box>
						</Box>

						<Box sx={heroMetaGridSx}>
							<MetaPill label="Material" value={entry.materialName || "-"} />
							<MetaPill label="Raised By" value={entry.raisedBy || "-"} />
							<MetaPill label="Stage" value={getStageLabel(entry.stage)} />
						</Box>
					</Box>

					<Box sx={snapshotGridSx}>
						{snapshotCards.map((item) => (
							<SnapshotCard
								key={item.label}
								item={item}
							/>
						))}
					</Box>

					<Box sx={trackerWrapSx}>
						<VenFlowTracker stage={entry.stage} entry={entry} />
					</Box>
				</CardContent>
			</Card>

			{error && (
				<Alert severity="error" sx={errorAlertSx}>
					{error}
				</Alert>
			)}

			<Card sx={workspaceSx}>
				<Box sx={tabsRowSx}>
					{visibleTabs.map((tab) => (
						<button
							key={tab.value}
							type="button"
							style={tabButtonStyle(activeTab === tab.value)}
							onClick={() => setActiveTab(tab.value)}
						>
							<span style={tabIconStyle(activeTab === tab.value)}>
								{tab.icon}
							</span>
							{tab.label}
						</button>
					))}
				</Box>

				<Box sx={workspaceGridSx}>
					<Box sx={mainPanelSx}>
						{renderActiveTab()}
					</Box>

					<Box sx={sidePanelSx}>
						<TimelinePanel
							entry={entry}
							auditRows={auditRows}
						/>

						<Card sx={sideCardSx}>
							<Typography sx={sideTitleSx}>
								Quick Info
							</Typography>

							<Box sx={sideInfoGridSx}>
								<Info
									label="Client"
									value={entry.clientName}
								/>

								<Info
									label="Material"
									value={entry.materialName}
								/>

								<Info
									label="Veneer"
									value={entry.veneerType}
								/>

								<Info
									label="Size"
									value={entry.size}
								/>

								<Info
									label="Plant"
									value={entry.plantCode}
								/>

								<Info
									label="Required Qty"
									value={
										entry.requiredQty !== null &&
											entry.requiredQty !== undefined
											? `${entry.requiredQty} ${entry.unit || ""}`
											: "-"
									}
								/>

								<Info
									label="Vendor"
									value={entry.vendorName}
								/>

								<Info
									label="PO No."
									value={entry.poNo}
								/>

								<Info
									label="PO Amount"
									value={formatCurrency(
										entry.poAmount
									)}
								/>

								<Info
									label="PO Status"
									value={
										entry.poStatus
											? String(
												entry.poStatus
											).replaceAll("_", " ")
											: "-"
									}
								/>

								<Info
									label="Director Decision"
									value={getDirectorDecisionText(
										entry
									)}
								/>

								<Info
									label="Decision By"
									value={getDirectorDecisionActor(
										entry
									)}
								/>

								<Info
									label="Decision At"
									value={formatDateTime(
										getDirectorDecisionDate(
											entry
										)
									)}
								/>

								<Info
									label="Director Remarks"
									value={
										entry.directorApprovalRemarks
									}
								/>

								<Info
									label="Current Department"
									value={
										entry.currentDepartment ||
										"VENFLOW"
									}
								/>

								<Info
									label="Current Stage"
									value={getStageLabel(
										entry.stage
									)}
								/>

								<Info
									label="Stage Since"
									value={formatDateTime(
										entry.stageEnteredAt
									)}
								/>

								<Info
									label="Last Movement"
									value={formatDateTime(
										entry.lastMovementAt
									)}
								/>

								<Info
									label="Vendor Order Ref."
									value={
										entry.vendorOrderReference
									}
								/>

								<Info
									label="Vendor Acknowledgement"
									value={
										entry.vendorAcknowledgementNo
									}
								/>

								<Info
									label="Vendor Expected Date"
									value={
										entry.vendorExpectedDate
									}
								/>

								<Info
									label="Order Placed By"
									value={
										entry.vendorOrderPlacedBy
									}
								/>
							</Box>
						</Card>

						<Card sx={sideCardSx}>
							<Typography sx={sideTitleSx}>
								Recent Activity
							</Typography>

							<RecentActivity auditRows={auditRows} />
						</Card>
					</Box>
				</Box>
			</Card>
		</Box>
	);
}

function SectionHeader({
	number,
	title,
	subtitle,
}) {
	return (
		<Box sx={sectionHeaderSx}>
			<Box sx={sectionTitleRowSx}>
				<Box sx={sectionNumSx}>{number}</Box>

				<Box>
					<Typography sx={sectionTitleTextSx}>
						{title}
					</Typography>

					{subtitle && (
						<Typography sx={sectionSubTextSx}>
							{subtitle}
						</Typography>
					)}
				</Box>
			</Box>

			<Divider sx={{ ...dividerSx, mt: 1.6, mb: 2 }} />
		</Box>
	);
}

function Info({
	label,
	value,
}) {
	const displayValue =
		value === null ||
			value === undefined ||
			String(value).trim() === ""
			? "-"
			: value;

	return (
		<Box sx={infoItemSx}>
			<Typography sx={infoLabelSx}>
				{label}
			</Typography>

			<Typography sx={infoValueSx}>
				{displayValue}
			</Typography>
		</Box>
	);
}

function DirectorDecisionPanel({
	entry,
}) {
	const status =
		entry?.poStatus ||
		"NOT_RAISED";

	const normalized =
		String(status).toUpperCase();

	const tone =
		normalized ===
			"DIRECTOR_APPROVED"
			? "SUCCESS"
			: normalized ===
				"DIRECTOR_REJECTED"
				? "ERROR"
				: normalized ===
					"PENDING_DIRECTOR_APPROVAL"
					? "WARNING"
					: "NEUTRAL";

	const title =
		normalized ===
			"DIRECTOR_APPROVED"
			? "PO Approved by Director"
			: normalized ===
				"DIRECTOR_REJECTED"
				? "PO Returned to Purchase"
				: normalized ===
					"PENDING_DIRECTOR_APPROVAL"
					? "Awaiting Director Approval"
					: normalized ===
						"ORDER_PLACED"
						? "Approved Order Placed with Vendor"
						: "Director Decision Not Required Yet";

	return (
		<Box
			sx={directorDecisionPanelSx(
				tone
			)}
		>
			<Box
				sx={directorDecisionIconSx(
					tone
				)}
			>
				<GavelOutlinedIcon />
			</Box>

			<Box sx={{ minWidth: 0 }}>
				<Typography
					sx={
						directorDecisionTitleSx
					}
				>
					{title}
				</Typography>

				<Typography
					sx={
						directorDecisionStatusSx
					}
				>
					Status:{" "}
					{normalized.replaceAll(
						"_",
						" "
					)}
				</Typography>

				{entry?.directorApprovalRemarks && (
					<Typography
						sx={
							directorDecisionRemarksSx
						}
					>
						{
							entry.directorApprovalRemarks
						}
					</Typography>
				)}

				<Box
					sx={
						directorDecisionMetaSx
					}
				>
					<span>
						Approved by:{" "}
						{entry?.directorApprovedBy ||
							"-"}
					</span>

					<span>
						Approved at:{" "}
						{formatDateTime(
							entry?.directorApprovedAt
						)}
					</span>

					<span>
						Rejected by:{" "}
						{entry?.directorRejectedBy ||
							"-"}
					</span>

					<span>
						Rejected at:{" "}
						{formatDateTime(
							entry?.directorRejectedAt
						)}
					</span>
				</Box>
			</Box>
		</Box>
	);
}

function MetaPill({
	label,
	value,
}) {
	return (
		<Box sx={metaPillSx}>
			<Typography sx={metaLabelSx}>
				{label}
			</Typography>

			<Typography sx={metaValueSx}>
				{value || "-"}
			</Typography>
		</Box>
	);
}

function SnapshotCard({
	item,
}) {
	return (
		<Card sx={snapshotCardSx(item.accent)}>
			<Box sx={snapshotIconSx(item.accent)}>
				<AssignmentOutlinedIcon fontSize="small" />
			</Box>

			<Box sx={{ minWidth: 0 }}>
				<Typography sx={snapshotLabelSx}>
					{item.label}
				</Typography>

				<Box sx={snapshotValueRowSx}>
					<Typography sx={snapshotValueSx}>
						{item.value ?? 0}
					</Typography>

					<Typography sx={snapshotUnitSx}>
						{item.unit || ""}
					</Typography>
				</Box>
			</Box>
		</Card>
	);
}

function BalanceTile({
	label,
	value,
	unit,
	accent = "#60a5fa",
}) {
	return (
		<Box sx={balanceTileSx(accent)}>
			<Typography sx={balanceLabelSx}>
				{label}
			</Typography>

			<Typography sx={balanceValueSx}>
				{value ?? 0} {unit || ""}
			</Typography>
		</Box>
	);
}

function TimelinePanel({
	entry,
	auditRows,
}) {
	const currentIndex =
		getStageGroupIndex(
			entry?.stage
		);

	return (
		<Card sx={sideCardSx}>
			<Typography sx={sideTitleSx}>
				Stage Timeline
			</Typography>

			<Box sx={timelineListSx}>
				{VF_TRACKER_STEPS.map(
					(step, index) => {
						const status =
							index <
								currentIndex
								? "done"
								: index ===
									currentIndex
									? "active"
									: "pending";

						const audit =
							findAuditForWorkflowStep(
								step,
								auditRows
							);

						const date =
							firstValue(
								entry,
								step.dateKeys ||
								[]
							) ||
							audit?.changedAt ||
							audit?.timestamp ||
							"";

						const actor =
							firstValue(
								entry,
								step.actorKeys ||
								[]
							) ||
							audit?.changedBy ||
							audit?.actor ||
							audit?.createdBy ||
							"";

						return (
							<Box
								key={step.key}
								sx={
									timelineItemSx
								}
							>
								<Box
									sx={
										timelineRailSx
									}
								>
									<Box
										sx={timelineDotSx(
											status
										)}
									>
										{status ===
											"done" && (
												<CheckCircleRoundedIcon
													sx={{
														fontSize: 13,
													}}
												/>
											)}

										{status ===
											"active" && (
												<RadioButtonCheckedRoundedIcon
													sx={{
														fontSize: 13,
													}}
												/>
											)}

										{status ===
											"pending" && (
												<RadioButtonUncheckedRoundedIcon
													sx={{
														fontSize: 13,
													}}
												/>
											)}
									</Box>
								</Box>

								<Box
									sx={{
										minWidth: 0,
									}}
								>
									<Typography
										sx={timelineDateSx(
											status
										)}
									>
										{formatDateTime(
											date
										)}
									</Typography>

									<Typography
										sx={timelineTitleSx(
											status
										)}
									>
										{step.label}
									</Typography>

									<Typography
										sx={
											timelineActorSx
										}
									>
										{actor || "-"}
									</Typography>
								</Box>
							</Box>
						);
					}
				)}
			</Box>
		</Card>
	);
}

function RecentActivity({
	auditRows,
}) {
	if (!auditRows || auditRows.length === 0) {
		return (
			<Typography sx={emptyTextSx}>
				No audit activity found yet.
			</Typography>
		);
	}

	return (
		<Box sx={recentListSx}>
			{auditRows.slice(0, 5).map((row, index) => (
				<Box key={index} sx={recentItemSx}>
					<Typography sx={recentDateSx}>
						{formatDateTime(
							row.changedAt
						)}
					</Typography>

					<Typography sx={recentTitleSx}>
						{row.action || "Activity"}
					</Typography>

					<Typography sx={recentTextSx}>
						{row.newValue ||
							row.oldValue ||
							"Workflow updated"}
					</Typography>
					<Typography sx={recentTextSx}>
						{row.changedBy || "-"}
					</Typography>
				</Box>
			))}
		</Box>
	);
}

/* ===================== STYLES ===================== */

const detailPageSx = {
	display: "flex",
	flexDirection: "column",
	gap: "12px",
	width: "100%",
};

const topBarSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 1.5,
	flexWrap: "wrap",
};

const topActionsSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	flexWrap: "wrap",
};

const heroCardSx = {
	...cardSx,
	borderRadius: "16px",
	background:
		"linear-gradient(180deg, rgba(15,23,42,.92), rgba(15,23,42,.72))",
	border: "1px solid rgba(59,130,246,.18)",
	boxShadow: "0 20px 55px rgba(2,6,23,.40)",
};

const heroHeadSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		lg: "1.15fr .85fr",
	},
	gap: 2,
	p: 2.2,
	borderBottom: "1px solid rgba(255,255,255,.07)",
};

const heroTitleSx = {
	color: "#fff",
	fontSize: {
		xs: 24,
		md: 30,
	},
	fontWeight: 950,
	lineHeight: 1.05,
	letterSpacing: "-0.04em",
	wordBreak: "break-word",
};

const chipsRowSx = {
	display: "flex",
	gap: 1,
	mt: 1.2,
	flexWrap: "wrap",
	alignItems: "center",
};

const heroMetaGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		sm: "repeat(3, minmax(0,1fr))",
	},
	gap: 1,
	alignItems: "stretch",
};

const metaPillSx = {
	p: 1.2,
	borderRadius: "13px",
	background: "rgba(255,255,255,.04)",
	border: "1px solid rgba(255,255,255,.07)",
	minWidth: 0,
};

const directorDecisionPanelSx = (
	tone
) => {
	const color =
		tone === "SUCCESS"
			? "#22c55e"
			: tone === "ERROR"
				? "#ef4444"
				: tone === "WARNING"
					? "#f59e0b"
					: "#64748b";

	return {
		display: "grid",
		gridTemplateColumns:
			"48px minmax(0,1fr)",
		gap: 1.5,
		p: 1.8,
		borderRadius: "14px",
		background: `${color}10`,
		border: `1px solid ${color}32`,
		boxShadow:
			`0 14px 34px ${color}12`,
	};
};

const directorDecisionIconSx = (
	tone
) => {
	const color =
		tone === "SUCCESS"
			? "#22c55e"
			: tone === "ERROR"
				? "#ef4444"
				: tone === "WARNING"
					? "#f59e0b"
					: "#64748b";

	return {
		width: 44,
		height: 44,
		borderRadius: "14px",
		display: "grid",
		placeItems: "center",
		background: `${color}18`,
		color,
		border: `1px solid ${color}30`,
	};
};

const directorDecisionTitleSx = {
	color: "#fff",
	fontSize: 15,
	fontWeight: 950,
};

const directorDecisionStatusSx = {
	mt: 0.45,
	color: "rgba(255,255,255,.62)",
	fontSize: 11,
	fontWeight: 850,
	textTransform: "capitalize",
};

const directorDecisionRemarksSx = {
	mt: 1,
	color: "rgba(255,255,255,.76)",
	fontSize: 12,
	fontWeight: 700,
	lineHeight: 1.55,
};

const directorDecisionMetaSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.5,
	flexWrap: "wrap",
	mt: 1.2,
	color: "rgba(255,255,255,.46)",
	fontSize: 10.5,
	fontWeight: 700,
};

const metaLabelSx = {
	color: "rgba(255,255,255,.50)",
	fontSize: 10,
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".07em",
};

const metaValueSx = {
	mt: 0.5,
	color: "#fff",
	fontSize: 12,
	fontWeight: 850,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const snapshotGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "repeat(1, minmax(0,1fr))",
		sm: "repeat(2, minmax(0,1fr))",
		md: "repeat(5, minmax(0,1fr))",
	},
	gap: "10px",
	p: "12px 16px",
};

const directorRejectBtnSx = {
	...outlineBtnSx,
	color: "#fca5a5",
	background: "rgba(239,68,68,.10)",
	border:
		"1px solid rgba(239,68,68,.28)",

	"&:hover": {
		background: "rgba(239,68,68,.18)",
		borderColor:
			"rgba(239,68,68,.42)",
	},
};

const snapshotCardSx = (accent) => ({
	position: "relative",
	p: "13px",
	borderRadius: "14px",
	background:
		"linear-gradient(180deg, rgba(30,41,59,.66), rgba(15,23,42,.72))",
	border: `1px solid ${accent}33`,
	boxShadow: `0 14px 32px ${accent}14`,
	color: "#fff",
	display: "flex",
	alignItems: "center",
	gap: 1.2,
	overflow: "hidden",
});

const snapshotIconSx = (accent) => ({
	width: 34,
	height: 34,
	borderRadius: "12px",
	display: "grid",
	placeItems: "center",
	background: `${accent}18`,
	border: `1px solid ${accent}30`,
	color: accent,
	flexShrink: 0,
});

const snapshotLabelSx = {
	color: "rgba(255,255,255,.56)",
	fontSize: 11,
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".05em",
};

const snapshotValueRowSx = {
	display: "flex",
	alignItems: "baseline",
	gap: 0.8,
	mt: 0.5,
};

const snapshotValueSx = {
	color: "#fff",
	fontSize: 24,
	fontWeight: 950,
	lineHeight: 1,
};

const snapshotUnitSx = {
	color: "rgba(255,255,255,.62)",
	fontSize: 11,
	fontWeight: 850,
	textTransform: "uppercase",
};

const trackerWrapSx = {
	px: 1,
	pb: 1,
	borderTop: "1px solid rgba(255,255,255,.06)",
};

const workspaceSx = {
	borderRadius: "16px",
	background: "rgba(15,23,42,.74)",
	border: "1px solid rgba(255,255,255,.07)",
	boxShadow: "0 24px 70px rgba(2,6,23,.38)",
	overflow: "hidden",
	color: "#fff",
};

const tabsRowSx = {
	minHeight: 66,
	display: "flex",
	alignItems: "center",
	gap: "8px",
	overflowX: "auto",
	px: 1.5,
	borderBottom: "1px solid rgba(255,255,255,.07)",
	background:
		"linear-gradient(180deg, rgba(15,23,42,.92), rgba(15,23,42,.74))",
	...premiumScrollbarSx,
};

const workspaceGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		xl: "minmax(0,1fr) 380px",
	},
	gap: "12px",
	p: "12px",
	alignItems: "start",
};

const mainPanelSx = {
	minWidth: 0,
};

const sidePanelSx = {
	display: "flex",
	flexDirection: "column",
	gap: "12px",
	position: {
		xs: "static",
		xl: "sticky",
	},
	top: 82,
};

const tabContentSx = {
	display: "flex",
	flexDirection: "column",
	gap: "12px",
};

const sectionCardSx = {
	...cardSx,
	borderRadius: "14px",
	p: 2,
	background:
		"linear-gradient(180deg, rgba(15,23,42,.74), rgba(2,6,23,.28))",
	border: "1px solid rgba(255,255,255,.07)",
	boxShadow: "0 16px 34px rgba(2,6,23,.28)",
};

const sectionHeaderSx = {
	width: "100%",
};

const sectionTitleRowSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.2,
};

const sectionNumSx = {
	width: 34,
	height: 34,
	borderRadius: "12px",
	display: "grid",
	placeItems: "center",
	color: "#93c5fd",
	background: "rgba(59,130,246,.14)",
	border: "1px solid rgba(59,130,246,.28)",
	fontSize: 12,
	fontWeight: 950,
	flexShrink: 0,
};

const sectionTitleTextSx = {
	color: "#fff",
	fontSize: 17,
	fontWeight: 950,
	lineHeight: 1.1,
};

const sectionSubTextSx = {
	mt: 0.4,
	color: "rgba(255,255,255,.50)",
	fontSize: 12,
	fontWeight: 700,
	lineHeight: 1.45,
};

const infoGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		sm: "repeat(2, minmax(0,1fr))",
		lg: "repeat(3, minmax(0,1fr))",
	},
	gap: "12px",
};

const infoItemSx = {
	p: 1.2,
	borderRadius: "12px",
	background: "rgba(255,255,255,.025)",
	border: "1px solid rgba(255,255,255,.055)",
	minWidth: 0,
};

const activeActionCardSx = {
	...cardSx,
	borderRadius: "14px",
	background:
		"linear-gradient(135deg, rgba(37,99,235,.20), rgba(15,23,42,.78))",
	border: "1px solid rgba(59,130,246,.28)",
	boxShadow: "0 16px 38px rgba(37,99,235,.14)",
};

const activeActionTitleSx = {
	color: "#bfdbfe",
	fontSize: 13,
	fontWeight: 950,
	textTransform: "uppercase",
	letterSpacing: ".06em",
};

const activeActionTextSx = {
	mt: 0.8,
	color: "rgba(255,255,255,.75)",
	fontSize: 13,
	fontWeight: 700,
	lineHeight: 1.6,
};

const directorPendingChipSx = {
	height: 24,
	borderRadius: "999px",
	background:
		"rgba(245,158,11,.14)",
	color: "#fbbf24",
	border:
		"1px solid rgba(245,158,11,.28)",
	fontWeight: 850,
	fontSize: 11,
};

const directorApprovedChipSx = {
	height: 24,
	borderRadius: "999px",
	background:
		"rgba(34,197,94,.14)",
	color: "#86efac",
	border:
		"1px solid rgba(34,197,94,.28)",
	fontWeight: 850,
	fontSize: 11,
};

const directorRejectedChipSx = {
	height: 24,
	borderRadius: "999px",
	background:
		"rgba(239,68,68,.14)",
	color: "#fca5a5",
	border:
		"1px solid rgba(239,68,68,.28)",
	fontWeight: 850,
	fontSize: 11,
};

const directorOrderPlacedChipSx = {
	height: 24,
	borderRadius: "999px",
	background:
		"rgba(6,182,212,.14)",
	color: "#67e8f9",
	border:
		"1px solid rgba(6,182,212,.28)",
	fontWeight: 850,
	fontSize: 11,
};

const activeActionMetaSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	flexWrap: "wrap",
	mt: 1.5,
};

const formGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		md: "1fr 1fr",
	},
	gap: 1.5,
};

const twoColumnSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		lg: "1fr 1fr",
	},
	gap: "12px",
};

const actionRowSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.2,
	mt: 2,
	flexWrap: "wrap",
};

const hintSx = {
	mt: 1.2,
	color: "rgba(255,255,255,.48)",
	fontWeight: 650,
	fontSize: 12,
	lineHeight: 1.6,
};

const poStatusGridSx = {
	...infoGridSx,
	mt: 2,
};

const miniBalanceGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		sm: "repeat(2, minmax(0,1fr))",
		md: "repeat(5, minmax(0,1fr))",
	},
	gap: "10px",
};

const balanceTileSx = (accent) => ({
	p: 1.4,
	borderRadius: "13px",
	background: `${accent}10`,
	border: `1px solid ${accent}25`,
});

const balanceLabelSx = {
	color: "rgba(255,255,255,.55)",
	fontSize: 11,
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".05em",
};

const balanceValueSx = {
	mt: 0.6,
	color: "#fff",
	fontSize: 18,
	fontWeight: 950,
};

const sideCardSx = {
	p: 2,
	borderRadius: "14px",
	background:
		"linear-gradient(180deg, rgba(15,23,42,.78), rgba(2,6,23,.30))",
	border: "1px solid rgba(255,255,255,.07)",
	boxShadow: "0 16px 34px rgba(2,6,23,.28)",
	color: "#fff",
};

const sideTitleSx = {
	color: "#fff",
	fontSize: 14,
	fontWeight: 950,
	mb: 1.5,
};

const sideInfoGridSx = {
	display: "grid",
	gridTemplateColumns: "1fr 1fr",
	gap: "10px",
};

const timelineListSx = {
	display: "flex",
	flexDirection: "column",
	maxHeight: 430,
	overflow: "auto",
	pr: 0.5,
	...premiumScrollbarSx,
};

const timelineItemSx = {
	display: "grid",
	gridTemplateColumns: "28px 1fr",
	gap: 1,
	position: "relative",
	pb: 1.5,
};

const timelineRailSx = {
	position: "relative",
	display: "flex",
	justifyContent: "center",

	"&:after": {
		content: '""',
		position: "absolute",
		top: 22,
		bottom: -4,
		width: 1,
		background: "rgba(148,163,184,.20)",
	},
};

const timelineDotSx = (status) => {
	const color =
		status === "done"
			? "#22c55e"
			: status === "active"
				? "#3b82f6"
				: "#64748b";

	return {
		width: 22,
		height: 22,
		borderRadius: "50%",
		display: "grid",
		placeItems: "center",
		background: `${color}22`,
		border: `1px solid ${color}55`,
		color,
		zIndex: 1,
		boxShadow:
			status === "active"
				? "0 0 0 5px rgba(59,130,246,.12)"
				: "none",
	};
};

const timelineDateSx = (status) => ({
	color:
		status === "active"
			? "#93c5fd"
			: "rgba(255,255,255,.48)",
	fontSize: 10.5,
	fontWeight: 850,
});

const timelineTitleSx = (status) => ({
	mt: 0.3,
	color:
		status === "pending"
			? "rgba(255,255,255,.50)"
			: "#fff",
	fontSize: 12,
	fontWeight: 900,
	lineHeight: 1.25,
});

const timelineActorSx = {
	mt: 0.25,
	color: "rgba(255,255,255,.45)",
	fontSize: 11,
	fontWeight: 650,
};

const recentListSx = {
	display: "flex",
	flexDirection: "column",
	gap: "9px",
};

const recentItemSx = {
	p: 1.2,
	borderRadius: "12px",
	background: "rgba(255,255,255,.035)",
	border: "1px solid rgba(255,255,255,.06)",
};

const recentDateSx = {
	color: "rgba(255,255,255,.48)",
	fontSize: 10.5,
	fontWeight: 800,
};

const recentTitleSx = {
	mt: 0.35,
	color: "#fff",
	fontSize: 12,
	fontWeight: 900,
};

const recentTextSx = {
	mt: 0.3,
	color: "rgba(255,255,255,.56)",
	fontSize: 11,
	fontWeight: 650,
	lineHeight: 1.45,
};

const emptyTextSx = {
	color: "#94a3b8",
	fontSize: 12,
	fontWeight: 750,
};

const neutralChipSx = {
	height: 24,
	borderRadius: "999px",
	background: "rgba(255,255,255,.05)",
	color: "#cbd5e1",
	border: "1px solid rgba(255,255,255,.08)",
	fontWeight: 850,
	fontSize: 11,
};

const blueChipSx = {
	height: 24,
	borderRadius: "999px",
	background: "rgba(59,130,246,.14)",
	color: "#93c5fd",
	border: "1px solid rgba(59,130,246,.28)",
	fontWeight: 850,
	fontSize: 11,
};

const purpleChipSx = {
	height: 24,
	borderRadius: "999px",
	background: "rgba(139,92,246,.14)",
	color: "#c4b5fd",
	border: "1px solid rgba(139,92,246,.28)",
	fontWeight: 850,
	fontSize: 11,
};

const tabButtonStyle = (active) => ({
	height: 44,
	border: active
		? "1px solid rgba(59,130,246,.42)"
		: "1px solid rgba(255,255,255,.07)",
	background: active
		? "linear-gradient(135deg, rgba(37,99,235,.30), rgba(59,130,246,.12))"
		: "rgba(255,255,255,.035)",
	color: active ? "#fff" : "rgba(255,255,255,.64)",
	borderRadius: 13,
	padding: "0 14px",
	display: "inline-flex",
	alignItems: "center",
	gap: 8,
	cursor: "pointer",
	fontWeight: 900,
	fontSize: 12,
	fontFamily: "inherit",
	whiteSpace: "nowrap",
	boxShadow: active
		? "0 10px 24px rgba(37,99,235,.18)"
		: "none",
});

const tabIconStyle = (active) => ({
	width: 20,
	height: 20,
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	color: active ? "#93c5fd" : "rgba(255,255,255,.48)",
});
