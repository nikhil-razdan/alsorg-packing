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
	canApproveVenFlowPo,
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

const STAGE = {
	INDENT_CREATED: "INDENT_CREATED",
	SENT_TO_STORE: "SENT_TO_STORE",
	STORE_REVIEWED: "STORE_REVIEWED",
	STOCK_AVAILABLE: "STOCK_AVAILABLE",
	MATERIAL_RESERVED: "MATERIAL_RESERVED",
	PURCHASE_REQUEST_RAISED: "PURCHASE_REQUEST_RAISED",
	PO_RAISED: "PO_RAISED",
	MATERIAL_RECEIVED_AT_STORE: "MATERIAL_RECEIVED_AT_STORE",
	GRN_DONE: "GRN_DONE",
	QC_PENDING: "QC_PENDING",
	QC_OK: "QC_OK",
	MATERIAL_ACCEPTED_IN_STORE: "MATERIAL_ACCEPTED_IN_STORE",
	MATERIAL_REJECTED_HOLD_RETURN: "MATERIAL_REJECTED_HOLD_RETURN",
	PRODUCTION_INFORMED: "PRODUCTION_INFORMED",
	PRODUCTION_DETAILS_ADDED: "PRODUCTION_DETAILS_ADDED",
	MATERIAL_ISSUED_TO_PRODUCTION: "MATERIAL_ISSUED_TO_PRODUCTION",
	PROCESSING_STARTED: "PROCESSING_STARTED",
	PROCESS_COMPLETED: "PROCESS_COMPLETED",
	SUPERVISOR_INFORMED: "SUPERVISOR_INFORMED",
	READY_FOR_NEXT_STAGE: "READY_FOR_NEXT_STAGE",
};

const WORKFLOW_STEPS = [
	{
		value: STAGE.INDENT_CREATED,
		label: "Indent Created",
		shortLabel: "Indent",
	},
	{
		value: STAGE.SENT_TO_STORE,
		label: "Sent to AKG Store",
		shortLabel: "Store",
	},
	{
		value: STAGE.PURCHASE_REQUEST_RAISED,
		label: "Purchase Request",
		shortLabel: "PR",
	},
	{
		value: STAGE.PO_RAISED,
		label: "PO Raised",
		shortLabel: "PO",
	},
	{
		value: STAGE.MATERIAL_RECEIVED_AT_STORE,
		label: "Material Received",
		shortLabel: "Received",
	},
	{
		value: STAGE.QC_OK,
		label: "QC / Inventory",
		shortLabel: "QC",
	},
	{
		value: STAGE.PRODUCTION_INFORMED,
		label: "Production Informed",
		shortLabel: "Production",
	},
	{
		value: STAGE.MATERIAL_ISSUED_TO_PRODUCTION,
		label: "Issued to Production",
		shortLabel: "Issued",
	},
	{
		value: STAGE.PROCESSING_STARTED,
		label: "Processing Started",
		shortLabel: "Processing",
	},
	{
		value: STAGE.SUPERVISOR_INFORMED,
		label: "Supervisor Informed",
		shortLabel: "Supervisor",
	},
	{
		value: STAGE.READY_FOR_NEXT_STAGE,
		label: "Completed",
		shortLabel: "Done",
	},
];

const STAGE_LABELS = {
	INDENT_CREATED: "Indent Created",
	SENT_TO_STORE: "Sent to AKG Store",
	STORE_REVIEWED: "Store Reviewed",
	STOCK_AVAILABLE: "Stock Available",
	MATERIAL_RESERVED: "Material Reserved",
	PURCHASE_REQUEST_RAISED: "Purchase Request Raised",
	PO_RAISED: "PO Raised",
	MATERIAL_RECEIVED_AT_STORE: "Material Received",
	GRN_DONE: "GRN Done",
	QC_PENDING: "QC Pending",
	QC_OK: "QC OK",
	MATERIAL_ACCEPTED_IN_STORE: "Accepted in Store",
	MATERIAL_REJECTED_HOLD_RETURN: "Hold / Rejected",
	PRODUCTION_INFORMED: "Production Informed",
	PRODUCTION_DETAILS_ADDED: "Production Details Added",
	MATERIAL_ISSUED_TO_PRODUCTION: "Issued to Production",
	PROCESSING_STARTED: "Processing Started",
	PROCESS_COMPLETED: "Process Completed",
	SUPERVISOR_INFORMED: "Supervisor Informed",
	READY_FOR_NEXT_STAGE: "Ready / Completed",
};

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

const getStageLabel = (stage) => {
	return STAGE_LABELS[stage] || stage || "-";
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
	const cleanRole = String(role || "").trim().toUpperCase();

	if (
		cleanRole === "ADMIN" ||
		cleanRole === "VENFLOW_MANAGER"
	) {
		return "/venflow/entries";
	}

	if (
		cleanRole === "VENFLOW_ENGINEERING" ||
		cleanRole === "VENFLOW_PROCESSING" ||
		cleanRole === "VENFLOW_SUPERVISOR"
	) {
		return "/venflow/production";
	}

	if (cleanRole === "VENFLOW_STORE") {
		return "/venflow/store";
	}

	if (cleanRole === "VENFLOW_PURCHASE") {
		return "/venflow/purchase";
	}

	return "/venflow/dashboard";
};

const getCurrentActionText = (entry) => {
	const stage = entry?.stage;

	if (stage === STAGE.INDENT_CREATED) {
		return "Engineering must send this indent to AKG Store for stock review.";
	}

	if (stage === STAGE.SENT_TO_STORE) {
		return "Store must review stock availability and update the stock decision.";
	}

	if (stage === STAGE.STORE_REVIEWED) {
		return "Store must reserve available stock or raise a purchase request.";
	}

	if (stage === STAGE.STOCK_AVAILABLE) {
		return "Store can reserve the available veneer quantity.";
	}

	if (stage === STAGE.MATERIAL_RESERVED) {
		return "Store can inform Production or issue the reserved material.";
	}

	if (stage === STAGE.PURCHASE_REQUEST_RAISED) {
		return "Purchase must raise the PO for this requirement.";
	}

	if (stage === STAGE.PO_RAISED) {
		return "PO is raised. Approval or material receiving may be pending.";
	}

	if (stage === STAGE.MATERIAL_RECEIVED_AT_STORE) {
		return "Store must complete GRN and QC process.";
	}

	if (stage === STAGE.GRN_DONE || stage === STAGE.QC_PENDING) {
		return "QC must be completed before accepting material into inventory.";
	}

	if (stage === STAGE.QC_OK) {
		return "Store can accept this material into inventory.";
	}

	if (stage === STAGE.MATERIAL_ACCEPTED_IN_STORE) {
		return "Store can inform Production or issue the material.";
	}

	if (stage === STAGE.PRODUCTION_INFORMED) {
		return "Production must add production details, then Store can issue material.";
	}

	if (stage === STAGE.MATERIAL_ISSUED_TO_PRODUCTION) {
		return "Processing team can start production.";
	}

	if (stage === STAGE.PROCESSING_STARTED) {
		return "Processing is in progress. Complete the process after work is done.";
	}

	if (stage === STAGE.PROCESS_COMPLETED) {
		return "Processing team must inform Supervisor for final closure.";
	}

	if (stage === STAGE.SUPERVISOR_INFORMED) {
		return "Supervisor can mark this requirement ready for the next stage.";
	}

	if (stage === STAGE.READY_FOR_NEXT_STAGE) {
		return "This requirement is completed and ready for the next stage.";
	}

	return "Review this requirement and complete the enabled action.";
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

const findAuditForStage = (stage, auditRows = []) => {
	const target = String(stage || "").toUpperCase();

	return auditRows.find((row) => {
		const bucket = [
			row.stage,
			row.toStage,
			row.newStage,
			row.action,
			row.message,
		]
			.filter(Boolean)
			.join(" ")
			.toUpperCase();

		return bucket.includes(target);
	});
};

const getStageIndex = (stage) => {
	const value = String(stage || "").toUpperCase();

	if (value === STAGE.STORE_REVIEWED) {
		return 1;
	}

	if (
		value === STAGE.STOCK_AVAILABLE ||
		value === STAGE.MATERIAL_RESERVED
	) {
		return 2;
	}

	if (value === STAGE.GRN_DONE || value === STAGE.QC_PENDING) {
		return 5;
	}

	if (value === STAGE.MATERIAL_ACCEPTED_IN_STORE) {
		return 5;
	}

	if (value === STAGE.PRODUCTION_DETAILS_ADDED) {
		return 6;
	}

	if (value === STAGE.PROCESS_COMPLETED) {
		return 8;
	}

	const index = WORKFLOW_STEPS.findIndex((step) => step.value === value);

	return index >= 0 ? index : 0;
};

export default function VenFlowDetailPage() {
	const { id } = useParams();
	const navigate = useNavigate();

	const { role: authRole } = useAuth();

	const role = getVenFlowRole(authRole);

	const isAdmin = isVenFlowAdmin(role);
	const isAdminManager = isVenFlowAdminOrManager(role);
	const isEngineering = isVenFlowEngineering(role);
	const isStore = isVenFlowStore(role);
	const isPurchase = isVenFlowPurchase(role);
	const isProcessing = isVenFlowProcessing(role);
	const isSupervisor = isVenFlowSupervisor(role);
	const canApprovePo = canApproveVenFlowPo(role);

	const canSeeEngineering = isAdminManager || isEngineering;
	const canSeeStore = isAdminManager || isStore;
	const canSeePurchase = isAdminManager || isPurchase;
	const canSeeProcessing = isAdminManager || isProcessing;
	const canSeeSupervisor = isAdminManager || isSupervisor;

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

	const canRaisePurchaseRequest =
		canStoreAction &&
		[
			STAGE.STORE_REVIEWED,
			STAGE.STOCK_AVAILABLE,
		].includes(stage) &&
		[
			"NOT_AVAILABLE",
			"PARTIALLY_AVAILABLE",
			"HOLD",
		].includes(stockDecision);

	const canRaisePo =
		canPurchaseAction &&
		[
			STAGE.PURCHASE_REQUEST_RAISED,
			STAGE.PO_RAISED,
		].includes(stage);

	const canReceiveMaterial =
		canStoreAction &&
		stage === STAGE.PO_RAISED;

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

	const canInformProduction =
		canStoreAction &&
		[
			STAGE.MATERIAL_RESERVED,
			STAGE.MATERIAL_ACCEPTED_IN_STORE,
		].includes(stage);

	const canAddProductionDetails =
		canProcessingAction &&
		[
			STAGE.PRODUCTION_INFORMED,
			STAGE.MATERIAL_RESERVED,
		].includes(stage);

	const canIssueMaterial =
		canStoreAction &&
		[
			STAGE.PRODUCTION_INFORMED,
			STAGE.PRODUCTION_DETAILS_ADDED,
			STAGE.MATERIAL_RESERVED,
		].includes(stage);

	const canStartProcessing =
		canProcessingAction &&
		stage === STAGE.MATERIAL_ISSUED_TO_PRODUCTION;

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
						title="Purchase / PO"
						subtitle="Raise PO and complete manager approval"
					/>

					<Box sx={formGridSx}>
						<TextField
							label="Vendor Name"
							value={poForm.vendorName}
							onChange={(e) =>
								setPoForm((p) => ({
									...p,
									vendorName: e.target.value,
								}))
							}
							disabled={!canPurchaseAction}
							sx={fieldSx}
						/>

						<TextField
							label="PO No."
							value={poForm.poNo}
							onChange={(e) =>
								setPoForm((p) => ({
									...p,
									poNo: e.target.value,
								}))
							}
							disabled={!canPurchaseAction}
							sx={fieldSx}
						/>

						<TextField
							label="PO Date"
							type="date"
							InputLabelProps={{ shrink: true }}
							value={poForm.poDate}
							onChange={(e) =>
								setPoForm((p) => ({
									...p,
									poDate: e.target.value,
								}))
							}
							disabled={!canPurchaseAction}
							sx={fieldSx}
						/>

						<TextField
							label="PO Amount"
							type="number"
							value={poForm.poAmount}
							onChange={(e) =>
								setPoForm((p) => ({
									...p,
									poAmount: e.target.value,
								}))
							}
							disabled={!canPurchaseAction}
							sx={fieldSx}
						/>

						<TextField
							label="PO Document URL"
							value={poForm.poDocumentUrl}
							onChange={(e) =>
								setPoForm((p) => ({
									...p,
									poDocumentUrl: e.target.value,
								}))
							}
							disabled={!canPurchaseAction}
							sx={fieldSx}
						/>
					</Box>

					<Box sx={poStatusGridSx}>
						<Info label="PO Status" value={entry.poStatus || "NOT_RAISED"} />
						<Info label="Purchase Request No." value={entry.purchaseRequestNo} />
						<Info label="PO Raised By" value={entry.poRaisedBy} />
						<Info label="PO Raised At" value={formatDateTime(entry.poRaisedAt)} />
						<Info label="PO Approved By" value={entry.poApprovedBy} />
						<Info label="PO Approved At" value={formatDateTime(entry.poApprovedAt)} />
					</Box>

					<Box sx={actionRowSx}>
						<Button
							variant="contained"
							disabled={saving || !canRaisePo}
							onClick={() =>
								run(() => {
									if (!poForm.vendorName.trim()) {
										throw new Error("Vendor Name is required.");
									}

									if (!poForm.poNo.trim()) {
										throw new Error("PO No. is required.");
									}

									if (!poForm.poDate) {
										throw new Error("PO Date is required.");
									}

									return venflowApi.raisePo(id, {
										vendorName: poForm.vendorName.trim(),
										poNo: poForm.poNo.trim(),
										poDate: poForm.poDate,
										poAmount: toNumberOrNull(poForm.poAmount),
										poDocumentUrl: poForm.poDocumentUrl.trim(),
										remarks: poForm.remarks.trim(),
									});
								})
							}
							sx={primaryBtnSx}
						>
							Raise PO
						</Button>

						<Button
							variant="outlined"
							disabled={
								saving ||
								!canApprovePo ||
								entry.poStatus !== "RAISED"
							}
							onClick={() =>
								run(() => venflowApi.approvePo(id))
							}
							sx={outlineBtnSx}
						>
							Approve / Sign PO
						</Button>
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

						<Button
							variant="contained"
							disabled={saving || !canInformProduction}
							onClick={() =>
								run(() => venflowApi.informProduction(id))
							}
							sx={primaryBtnSx}
						>
							Inform Production
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
						title="Issue Material to Production"
						subtitle="Issue reserved or accepted veneer material to production team"
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
						title="Processing / Production"
						subtitle="Add production details, start process and close production work"
					/>

					<Box sx={formGridSx}>
						<TextField
							label="Production Details"
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
							Save Production Details
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
								run(() =>
									venflowApi.completeProcess(id, {
										usedQty: toNumberOrNull(processingForm.usedQty),
										wastageQty: toNumberOrNull(processingForm.wastageQty),
										balanceQty: toNumberOrNull(processingForm.balanceQty),
										outputImageUrl: processingForm.outputImageUrl.trim(),
										remarks: processingForm.remarks.trim(),
									})
								)
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
								<Info label="Client" value={entry.clientName} />
								<Info label="Material" value={entry.materialName} />
								<Info label="Veneer" value={entry.veneerType} />
								<Info label="Size" value={entry.size} />
								<Info label="Vendor" value={entry.vendorName} />
								<Info label="PO No." value={entry.poNo} />
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
	return (
		<Box sx={infoItemSx}>
			<Typography sx={infoLabelSx}>
				{label}
			</Typography>

			<Typography sx={infoValueSx}>
				{value || "-"}
			</Typography>
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
	const currentIndex = getStageIndex(entry?.stage);

	return (
		<Card sx={sideCardSx}>
			<Typography sx={sideTitleSx}>
				Stage Timeline
			</Typography>

			<Box sx={timelineListSx}>
				{WORKFLOW_STEPS.map((step, index) => {
					const status =
						index < currentIndex
							? "done"
							: index === currentIndex
								? "active"
								: "pending";

					const audit = findAuditForStage(step.value, auditRows);

					const date = getDateForTimelineStep(entry, step.value, audit);
					const actor = getActorForTimelineStep(entry, step.value, audit);

					return (
						<Box key={step.value} sx={timelineItemSx}>
							<Box sx={timelineRailSx}>
								<Box sx={timelineDotSx(status)}>
									{status === "done" && (
										<CheckCircleRoundedIcon sx={{ fontSize: 13 }} />
									)}

									{status === "active" && (
										<RadioButtonCheckedRoundedIcon sx={{ fontSize: 13 }} />
									)}

									{status === "pending" && (
										<RadioButtonUncheckedRoundedIcon sx={{ fontSize: 13 }} />
									)}
								</Box>
							</Box>

							<Box sx={{ minWidth: 0 }}>
								<Typography sx={timelineDateSx(status)}>
									{formatDateTime(date)}
								</Typography>

								<Typography sx={timelineTitleSx(status)}>
									{step.label}
								</Typography>

								<Typography sx={timelineActorSx}>
									{actor || "-"}
								</Typography>
							</Box>
						</Box>
					);
				})}
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
						{formatDateTime(row.createdAt || row.timestamp)}
					</Typography>

					<Typography sx={recentTitleSx}>
						{row.action || row.stage || "Activity"}
					</Typography>

					<Typography sx={recentTextSx}>
						{row.message || row.remarks || row.actor || "Workflow updated"}
					</Typography>
				</Box>
			))}
		</Box>
	);
}

function getDateForTimelineStep(entry, stage, audit) {
	const map = {
		INDENT_CREATED: ["raisedAt", "createdAt"],
		SENT_TO_STORE: ["sentToStoreAt"],
		PURCHASE_REQUEST_RAISED: ["purchaseRequestRaisedAt", "sentToPurchaseAt"],
		PO_RAISED: ["poRaisedAt"],
		MATERIAL_RECEIVED_AT_STORE: ["materialReceivedAt", "actualInHouseDate"],
		QC_OK: ["qcAt", "qcDoneAt"],
		PRODUCTION_INFORMED: ["materialInformedAt", "productionInformedAt"],
		MATERIAL_ISSUED_TO_PRODUCTION: ["issuedAt", "materialIssuedAt"],
		PROCESSING_STARTED: ["processingStartedAt", "productionStartedAt"],
		SUPERVISOR_INFORMED: ["supervisorInformedAt"],
		READY_FOR_NEXT_STAGE: ["readyAt", "completedAt", "updatedAt"],
	};

	return (
		firstValue(entry, map[stage] || []) ||
		audit?.createdAt ||
		audit?.timestamp ||
		""
	);
}

function getActorForTimelineStep(entry, stage, audit) {
	const map = {
		INDENT_CREATED: ["raisedBy", "createdBy"],
		SENT_TO_STORE: ["sentToStoreBy"],
		PURCHASE_REQUEST_RAISED: ["purchaseRequestRaisedBy", "sentToPurchaseBy"],
		PO_RAISED: ["poRaisedBy"],
		MATERIAL_RECEIVED_AT_STORE: ["materialReceivedBy"],
		QC_OK: ["qcBy"],
		PRODUCTION_INFORMED: ["materialInformedBy", "productionInformedBy"],
		MATERIAL_ISSUED_TO_PRODUCTION: ["issuedBy"],
		PROCESSING_STARTED: ["processingStartedBy", "productionStartedBy"],
		SUPERVISOR_INFORMED: ["supervisorInformedBy"],
		READY_FOR_NEXT_STAGE: ["readyBy", "completedBy"],
	};

	return (
		firstValue(entry, map[stage] || []) ||
		audit?.actor ||
		audit?.createdBy ||
		""
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
