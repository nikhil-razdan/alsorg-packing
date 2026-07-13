export const VF_STAGE = Object.freeze({
	/*
	 * =========================================================
	 * ENGINEERING
	 * =========================================================
	 */

	INDENT_CREATED:
		"INDENT_CREATED",

	/*
	 * =========================================================
	 * AKG STORE REVIEW
	 * =========================================================
	 */

	SENT_TO_STORE:
		"SENT_TO_STORE",

	STORE_REVIEWED:
		"STORE_REVIEWED",

	STOCK_AVAILABLE:
		"STOCK_AVAILABLE",

	MATERIAL_RESERVED:
		"MATERIAL_RESERVED",

	/*
	 * =========================================================
	 * PURCHASE REQUEST / DIRECTOR APPROVAL
	 * =========================================================
	 */

	PURCHASE_REQUEST_RAISED:
		"PURCHASE_REQUEST_RAISED",

	PO_PENDING_DIRECTOR_APPROVAL:
		"PO_PENDING_DIRECTOR_APPROVAL",

	PO_APPROVED_BY_DIRECTOR:
		"PO_APPROVED_BY_DIRECTOR",

	PO_REJECTED_BY_DIRECTOR:
		"PO_REJECTED_BY_DIRECTOR",

	ORDER_PLACED_WITH_VENDOR:
		"ORDER_PLACED_WITH_VENDOR",

	/*
	 * =========================================================
	 * STORE RECEIVING / GRN / QC
	 * =========================================================
	 */

	MATERIAL_RECEIVED_AT_STORE:
		"MATERIAL_RECEIVED_AT_STORE",

	GRN_DONE:
		"GRN_DONE",

	QC_PENDING:
		"QC_PENDING",

	QC_OK:
		"QC_OK",

	QC_NOT_OK:
		"QC_NOT_OK",

	MATERIAL_ACCEPTED_IN_STORE:
		"MATERIAL_ACCEPTED_IN_STORE",

	MATERIAL_REJECTED_HOLD_RETURN:
		"MATERIAL_REJECTED_HOLD_RETURN",

	/*
	 * =========================================================
	 * PRODUCTION / PROCESSING
	 * =========================================================
	 */

	MATERIAL_ISSUED_TO_PRODUCTION:
		"MATERIAL_ISSUED_TO_PRODUCTION",

	PROCESSING_STARTED:
		"PROCESSING_STARTED",

	PROCESS_COMPLETED:
		"PROCESS_COMPLETED",

	SUPERVISOR_INFORMED:
		"SUPERVISOR_INFORMED",

	READY_FOR_NEXT_STAGE:
		"READY_FOR_NEXT_STAGE",

	/*
	 * =========================================================
	 * LEGACY COMPATIBILITY ONLY
	 * =========================================================
	 */

	PO_RAISED:
		"PO_RAISED",

	PRODUCTION_INFORMED:
		"PRODUCTION_INFORMED",

	PRODUCTION_DETAILS_ADDED:
		"PRODUCTION_DETAILS_ADDED",
});

const meta = (
	label,
	color,
	progress,
	group
) =>
	Object.freeze({
		label,
		color,
		progress,
		group,
	});

/*
 * group must always match the zero-based index of VF_TRACKER_STEPS.
 *
 * 0 = Engineering
 * 1 = Store Review
 * 2 = Purchase Request
 * 3 = Director Approval
 * 4 = Vendor Order
 * 5 = Receiving / GRN / QC
 * 6 = Issue to Production
 * 7 = Processing
 * 8 = Supervisor Closure
 * 9 = Ready for Next Stage
 */
export const VF_STAGE_META = Object.freeze({
	/*
	 * =========================================================
	 * GROUP 0 — ENGINEERING
	 * =========================================================
	 */

	[VF_STAGE.INDENT_CREATED]: meta(
		"Engineering BOM / Indent",
		"#60a5fa",
		10,
		0
	),

	/*
	 * =========================================================
	 * GROUP 1 — STORE REVIEW
	 * =========================================================
	 */

	[VF_STAGE.SENT_TO_STORE]: meta(
		"Sent to AKG Store",
		"#3b82f6",
		18,
		1
	),

	[VF_STAGE.STORE_REVIEWED]: meta(
		"Store Stock Decision",
		"#f59e0b",
		22,
		1
	),

	[VF_STAGE.STOCK_AVAILABLE]: meta(
		"Stock Available",
		"#22c55e",
		24,
		1
	),

	[VF_STAGE.MATERIAL_RESERVED]: meta(
		"Material Reserved",
		"#14b8a6",
		27,
		1
	),

	/*
	 * =========================================================
	 * GROUP 2 — PURCHASE REQUEST
	 * =========================================================
	 */

	[VF_STAGE.PURCHASE_REQUEST_RAISED]: meta(
		"Purchase Request Raised",
		"#a78bfa",
		32,
		2
	),

	/*
	 * =========================================================
	 * GROUP 3 — DIRECTOR APPROVAL
	 * =========================================================
	 */

	[VF_STAGE.PO_PENDING_DIRECTOR_APPROVAL]: meta(
		"Director Approval Pending",
		"#f59e0b",
		40,
		3
	),

	[VF_STAGE.PO_APPROVED_BY_DIRECTOR]: meta(
		"PO Approved by Director",
		"#22c55e",
		44,
		3
	),

	[VF_STAGE.PO_REJECTED_BY_DIRECTOR]: meta(
		"PO Returned to Purchase",
		"#ef4444",
		40,
		3
	),

	/*
	 * Old records using PO_RAISED will still render.
	 * These records should eventually be migrated through
	 * Director approval before vendor-order placement.
	 */
	[VF_STAGE.PO_RAISED]: meta(
		"PO Raised — Legacy",
		"#fb7185",
		40,
		3
	),

	/*
	 * =========================================================
	 * GROUP 4 — VENDOR ORDER
	 * =========================================================
	 */

	[VF_STAGE.ORDER_PLACED_WITH_VENDOR]: meta(
		"Order Placed with Vendor",
		"#06b6d4",
		52,
		4
	),

	/*
	 * =========================================================
	 * GROUP 5 — RECEIVING / GRN / QC
	 * =========================================================
	 */

	[VF_STAGE.MATERIAL_RECEIVED_AT_STORE]: meta(
		"Material Received at Store",
		"#06b6d4",
		60,
		5
	),

	[VF_STAGE.GRN_DONE]: meta(
		"GRN Completed",
		"#38bdf8",
		64,
		5
	),

	[VF_STAGE.QC_PENDING]: meta(
		"QC Pending",
		"#f59e0b",
		67,
		5
	),

	[VF_STAGE.QC_OK]: meta(
		"QC Approved",
		"#22c55e",
		70,
		5
	),

	[VF_STAGE.QC_NOT_OK]: meta(
		"QC Not Approved",
		"#ef4444",
		70,
		5
	),

	[VF_STAGE.MATERIAL_ACCEPTED_IN_STORE]: meta(
		"Accepted into Store Inventory",
		"#22c55e",
		73,
		5
	),

	[VF_STAGE.MATERIAL_REJECTED_HOLD_RETURN]: meta(
		"Material Hold / Return",
		"#ef4444",
		70,
		5
	),

	/*
	 * =========================================================
	 * GROUP 6 — ISSUE TO PRODUCTION
	 * =========================================================
	 */

	[VF_STAGE.MATERIAL_ISSUED_TO_PRODUCTION]: meta(
		"Issued to Production",
		"#f97316",
		78,
		6
	),

	/*
	 * Legacy Production Informed is treated as an Issue-stage event.
	 */
	[VF_STAGE.PRODUCTION_INFORMED]: meta(
		"Production Notified — Legacy",
		"#64748b",
		78,
		6
	),

	/*
	 * =========================================================
	 * GROUP 7 — PROCESSING
	 * =========================================================
	 */

	[VF_STAGE.PRODUCTION_DETAILS_ADDED]: meta(
		"Processing Details Added — Legacy",
		"#64748b",
		80,
		7
	),

	[VF_STAGE.PROCESSING_STARTED]: meta(
		"Veneer / Flitch Processing",
		"#f97316",
		85,
		7
	),

	[VF_STAGE.PROCESS_COMPLETED]: meta(
		"Processing Completed",
		"#22c55e",
		91,
		7
	),

	/*
	 * =========================================================
	 * GROUP 8 — SUPERVISOR
	 * =========================================================
	 */

	[VF_STAGE.SUPERVISOR_INFORMED]: meta(
		"Supervisor Informed",
		"#38bdf8",
		96,
		8
	),

	/*
	 * =========================================================
	 * GROUP 9 — FINAL CLOSURE
	 * =========================================================
	 */

	[VF_STAGE.READY_FOR_NEXT_STAGE]: meta(
		"Ready for Next Stage",
		"#22c55e",
		100,
		9
	),
});

export const VF_TRACKER_STEPS = Object.freeze([
	Object.freeze({
		key: "ENGINEERING",
		label: "Engineering BOM / Indent",

		stageKeys: [
			VF_STAGE.INDENT_CREATED,
		],

		dateKeys: [
			"raisedAt",
			"createdAt",
		],

		actorKeys: [
			"raisedBy",
			"createdBy",
		],
	}),

	Object.freeze({
		key: "STORE_REVIEW",
		label: "AKG Store Review",

		stageKeys: [
			VF_STAGE.SENT_TO_STORE,
			VF_STAGE.STORE_REVIEWED,
			VF_STAGE.STOCK_AVAILABLE,
			VF_STAGE.MATERIAL_RESERVED,
		],

		dateKeys: [
			"storeReviewedAt",
			"sentToStoreAt",
			"reservedAt",
		],

		actorKeys: [
			"storeReviewedBy",
			"sentToStoreBy",
			"reservedBy",
		],
	}),

	Object.freeze({
		key: "PURCHASE_REQUEST",
		label: "Purchase Request",

		stageKeys: [
			VF_STAGE.PURCHASE_REQUEST_RAISED,
		],

		dateKeys: [
			"purchaseRequestAt",
			"purchaseRequestRaisedAt",
			"sentToPurchaseAt",
			"requisitionDate",
		],

		actorKeys: [
			"purchaseRequestBy",
			"purchaseRequestRaisedBy",
			"sentToPurchaseBy",
		],
	}),

	Object.freeze({
		key: "DIRECTOR_APPROVAL",
		label: "Director Approval",

		stageKeys: [
			VF_STAGE.PO_PENDING_DIRECTOR_APPROVAL,
			VF_STAGE.PO_APPROVED_BY_DIRECTOR,
			VF_STAGE.PO_REJECTED_BY_DIRECTOR,
			VF_STAGE.PO_RAISED,
		],

		dateKeys: [
			"directorApprovedAt",
			"directorRejectedAt",
			"poApprovalRequestedAt",
			"poRaisedAt",
		],

		actorKeys: [
			"directorApprovedBy",
			"directorRejectedBy",
			"poApprovalRequestedBy",
			"poRaisedBy",
		],
	}),

	Object.freeze({
		key: "VENDOR_ORDER",
		label: "Vendor Order",

		stageKeys: [
			VF_STAGE.ORDER_PLACED_WITH_VENDOR,
		],

		dateKeys: [
			"vendorOrderPlacedAt",
			"vendorExpectedDate",
		],

		actorKeys: [
			"vendorOrderPlacedBy",
		],
	}),

	Object.freeze({
		key: "RECEIVING_QC",
		label: "Receiving / GRN / QC",

		stageKeys: [
			VF_STAGE.MATERIAL_RECEIVED_AT_STORE,
			VF_STAGE.GRN_DONE,
			VF_STAGE.QC_PENDING,
			VF_STAGE.QC_OK,
			VF_STAGE.QC_NOT_OK,
			VF_STAGE.MATERIAL_ACCEPTED_IN_STORE,
			VF_STAGE.MATERIAL_REJECTED_HOLD_RETURN,
		],

		dateKeys: [
			"materialReceivedAt",
			"actualInHouseDate",
			"grnAt",
			"grnDate",
			"qcCheckedAt",
			"qcAt",
			"inventoryAcceptedAt",
		],

		actorKeys: [
			"materialReceivedBy",
			"grnBy",
			"qcCheckedBy",
			"qcBy",
			"inventoryAcceptedBy",
		],
	}),

	Object.freeze({
		key: "ISSUE",
		label: "Issue to Production",

		stageKeys: [
			VF_STAGE.MATERIAL_ISSUED_TO_PRODUCTION,
			VF_STAGE.PRODUCTION_INFORMED,
		],

		dateKeys: [
			"issuedAt",
			"materialIssuedAt",
			"materialInformedAt",
		],

		actorKeys: [
			"issuedBy",
			"materialInformedBy",
		],
	}),

	Object.freeze({
		key: "PROCESSING",
		label: "Veneer Processing",

		stageKeys: [
			VF_STAGE.PRODUCTION_DETAILS_ADDED,
			VF_STAGE.PROCESSING_STARTED,
			VF_STAGE.PROCESS_COMPLETED,
		],

		dateKeys: [
			"processingStartedAt",
			"productionStartedAt",
			"processCompletedAt",
			"jobDoneAt",
		],

		actorKeys: [
			"processingStartedBy",
			"productionStartedBy",
			"processCompletedBy",
			"jobDoneBy",
		],
	}),

	Object.freeze({
		key: "SUPERVISOR",
		label: "Supervisor Closure",

		stageKeys: [
			VF_STAGE.SUPERVISOR_INFORMED,
		],

		dateKeys: [
			"supervisorInformedAt",
		],

		actorKeys: [
			"supervisorInformedBy",
		],
	}),

	Object.freeze({
		key: "READY",
		label: "Ready for Next Stage",

		stageKeys: [
			VF_STAGE.READY_FOR_NEXT_STAGE,
		],

		dateKeys: [
			"nextStageReadyAt",
			"completedAt",
			"updatedAt",
		],

		actorKeys: [
			"nextStageReadyBy",
			"completedBy",
			"updatedBy",
		],
	}),
]);

export const STORE_VIEW_OPTIONS = Object.freeze([
	Object.freeze([
		"",
		"All Store Stages",
	]),

	Object.freeze([
		VF_STAGE.SENT_TO_STORE,
		"Pending AKG Store Review",
	]),

	Object.freeze([
		VF_STAGE.STORE_REVIEWED,
		"Stock Decision / PR Pending",
	]),

	Object.freeze([
		VF_STAGE.STOCK_AVAILABLE,
		"Stock Available / Reserve Pending",
	]),

	Object.freeze([
		VF_STAGE.MATERIAL_RESERVED,
		"Reserved / Issue Pending",
	]),

	Object.freeze([
		VF_STAGE.PURCHASE_REQUEST_RAISED,
		"Purchase Request Raised",
	]),

	Object.freeze([
		VF_STAGE.PO_PENDING_DIRECTOR_APPROVAL,
		"PO Awaiting Director Approval",
	]),

	Object.freeze([
		VF_STAGE.PO_APPROVED_BY_DIRECTOR,
		"PO Approved / Vendor Order Pending",
	]),

	Object.freeze([
		VF_STAGE.ORDER_PLACED_WITH_VENDOR,
		"Vendor Order / Receiving Pending",
	]),

	Object.freeze([
		VF_STAGE.MATERIAL_RECEIVED_AT_STORE,
		"Material Received / GRN Pending",
	]),

	Object.freeze([
		VF_STAGE.GRN_DONE,
		"GRN Done / QC Pending",
	]),

	Object.freeze([
		VF_STAGE.QC_PENDING,
		"QC Pending",
	]),

	Object.freeze([
		VF_STAGE.QC_OK,
		"QC Approved / Inventory Pending",
	]),

	Object.freeze([
		VF_STAGE.QC_NOT_OK,
		"QC Not Approved",
	]),

	Object.freeze([
		VF_STAGE.MATERIAL_ACCEPTED_IN_STORE,
		"Store Inventory / Issue Pending",
	]),

	Object.freeze([
		VF_STAGE.MATERIAL_REJECTED_HOLD_RETURN,
		"Material Hold / Return",
	]),

	Object.freeze([
		VF_STAGE.MATERIAL_ISSUED_TO_PRODUCTION,
		"Issued to Production",
	]),
]);

export const PURCHASE_VIEW_OPTIONS = Object.freeze([
	Object.freeze([
		"",
		"All Purchase Stages",
	]),

	Object.freeze([
		VF_STAGE.PURCHASE_REQUEST_RAISED,
		"PO Preparation Pending",
	]),

	Object.freeze([
		VF_STAGE.PO_PENDING_DIRECTOR_APPROVAL,
		"Director Approval Pending",
	]),

	Object.freeze([
		VF_STAGE.PO_REJECTED_BY_DIRECTOR,
		"Returned by Director",
	]),

	Object.freeze([
		VF_STAGE.PO_APPROVED_BY_DIRECTOR,
		"Approved / Vendor Order Pending",
	]),

	Object.freeze([
		VF_STAGE.ORDER_PLACED_WITH_VENDOR,
		"Order Placed with Vendor",
	]),

	Object.freeze([
		VF_STAGE.MATERIAL_RECEIVED_AT_STORE,
		"Material Received",
	]),
]);

export const DIRECTOR_VIEW_OPTIONS = Object.freeze([
	Object.freeze([
		"",
		"All Director-Controlled Stages",
	]),

	Object.freeze([
		VF_STAGE.PO_PENDING_DIRECTOR_APPROVAL,
		"Approval Required",
	]),

	Object.freeze([
		VF_STAGE.PO_APPROVED_BY_DIRECTOR,
		"Approved / Order Not Placed",
	]),

	Object.freeze([
		VF_STAGE.PO_REJECTED_BY_DIRECTOR,
		"Returned to Purchase",
	]),

	Object.freeze([
		VF_STAGE.ORDER_PLACED_WITH_VENDOR,
		"Vendor Order Active",
	]),

	Object.freeze([
		VF_STAGE.MATERIAL_RECEIVED_AT_STORE,
		"Material Received",
	]),
]);

export const PRODUCTION_VIEW_OPTIONS = Object.freeze([
	Object.freeze([
		"",
		"All Production Stages",
	]),

	Object.freeze([
		VF_STAGE.MATERIAL_ISSUED_TO_PRODUCTION,
		"Issued / Processing Start Pending",
	]),

	Object.freeze([
		VF_STAGE.PROCESSING_STARTED,
		"Veneer / Flitch Processing",
	]),

	Object.freeze([
		VF_STAGE.PROCESS_COMPLETED,
		"Processing Completed",
	]),

	Object.freeze([
		VF_STAGE.SUPERVISOR_INFORMED,
		"Supervisor Informed",
	]),

	Object.freeze([
		VF_STAGE.READY_FOR_NEXT_STAGE,
		"Ready for Next Stage",
	]),
]);

export const SUPERVISOR_VIEW_OPTIONS = Object.freeze([
	Object.freeze([
		"",
		"All Supervisor Stages",
	]),

	Object.freeze([
		VF_STAGE.SUPERVISOR_INFORMED,
		"Closure Review Pending",
	]),

	Object.freeze([
		VF_STAGE.READY_FOR_NEXT_STAGE,
		"Ready for Next Stage",
	]),
]);

export const getStageMeta = (stage) => {
	const normalizedStage =
		typeof stage === "string"
			? stage.trim().toUpperCase()
			: "";

	return (
		VF_STAGE_META[normalizedStage] || {
			label:
				normalizedStage
					? normalizedStage.replaceAll("_", " ")
					: "Draft",

			color: "#94a3b8",
			progress: 0,
			group: 0,
		}
	);
};

export const getStageLabel = (stage) =>
	getStageMeta(stage).label;

export const getStageColor = (stage) =>
	getStageMeta(stage).color;

export const getStageProgress = (stage) =>
	getStageMeta(stage).progress;

export const getStageGroupIndex = (stage) =>
	getStageMeta(stage).group;

export const isVenFlowClosed = (stage) =>
	stage === VF_STAGE.READY_FOR_NEXT_STAGE;

export const isVenFlowCompletionUpdated = (
	stage
) =>
	[
		VF_STAGE.PROCESS_COMPLETED,
		VF_STAGE.SUPERVISOR_INFORMED,
		VF_STAGE.READY_FOR_NEXT_STAGE,
	].includes(stage);

export const isDirectorControlledStage = (
	stage
) =>
	[
		VF_STAGE.PO_PENDING_DIRECTOR_APPROVAL,
		VF_STAGE.PO_APPROVED_BY_DIRECTOR,
		VF_STAGE.PO_REJECTED_BY_DIRECTOR,
		VF_STAGE.ORDER_PLACED_WITH_VENDOR,
	].includes(stage);

/*
 * Accepts either:
 *
 * getCurrentActionText(entry)
 *
 * or:
 *
 * getCurrentActionText(entry.stage)
 *
 * This keeps old and new page calls compatible.
 */
export const getCurrentActionText = (
	entryOrStage
) => {
	const entry =
		entryOrStage &&
		typeof entryOrStage === "object"
			? entryOrStage
			: null;

	const stage =
		typeof entryOrStage === "string"
			? entryOrStage
			: entry?.stage;

	switch (stage) {
		case VF_STAGE.INDENT_CREATED:
			return "Engineering must verify the BOM / Indent details and send the requirement to AKG Store for stock review.";

		case VF_STAGE.SENT_TO_STORE:
			return "AKG Store must review stock availability against the required project quantity.";

		case VF_STAGE.STORE_REVIEWED:
			return "Store must reserve available stock or raise a Purchase Request when stock is unavailable, partially available, or on hold.";

		case VF_STAGE.STOCK_AVAILABLE:
			return "Stock is available. Store must reserve the required project quantity before material issue.";

		case VF_STAGE.MATERIAL_RESERVED:
			return "Material is reserved. Store can issue the material to Production. Any remaining shortage must continue through Purchase.";

		case VF_STAGE.PURCHASE_REQUEST_RAISED:
			return "Purchase must prepare the PO with vendor, amount, PO document and commercial details, then submit it for Director approval.";

		case VF_STAGE.PO_PENDING_DIRECTOR_APPROVAL:
			return "Director approval is pending. Purchase cannot place the order with the vendor until the Director approves the PO.";

		case VF_STAGE.PO_REJECTED_BY_DIRECTOR:
			return "The Director returned the PO. Purchase must review the Director remarks, correct the PO and resubmit it for approval.";

		case VF_STAGE.PO_APPROVED_BY_DIRECTOR:
			return "The Director approved the PO. Purchase must now place the approved order with the vendor and record vendor acknowledgement and expected delivery.";

		case VF_STAGE.ORDER_PLACED_WITH_VENDOR:
			return "The approved order is active with the vendor. Purchase must follow delivery commitments and Store must record receiving when the material arrives.";

		case VF_STAGE.PO_RAISED:
			return "This is a legacy PO-raised record. Route it through Director approval before allowing vendor-order placement or material receiving.";

		case VF_STAGE.MATERIAL_RECEIVED_AT_STORE:
			return "Store has received the material. Complete GRN before the quality-check process.";

		case VF_STAGE.GRN_DONE:
		case VF_STAGE.QC_PENDING:
			return "Store must complete QC. QC approval moves the material to Store Inventory; QC failure moves it to hold or return.";

		case VF_STAGE.QC_OK:
			return "QC is approved. Store must accept the material into controlled Store Inventory.";

		case VF_STAGE.QC_NOT_OK:
			return "QC has failed. Record the rejection or hold reason and resolve return, replacement, or corrective action.";

		case VF_STAGE.MATERIAL_ACCEPTED_IN_STORE:
			return "The material is accepted in Store Inventory and can now be reserved and issued to Production.";

		case VF_STAGE.MATERIAL_REJECTED_HOLD_RETURN:
			return "The material is on hold or return. Store, Purchase and the vendor must resolve the rejection before the workflow continues.";

		case VF_STAGE.MATERIAL_ISSUED_TO_PRODUCTION:
			return "Material is issued to Production. Add processing responsibility and start veneer / flitch processing.";

		case VF_STAGE.PRODUCTION_INFORMED:
			return "Production has been notified through a legacy workflow. Continue by recording processing details and starting the process.";

		case VF_STAGE.PRODUCTION_DETAILS_ADDED:
			return "Processing details are available. Start veneer / flitch processing.";

		case VF_STAGE.PROCESSING_STARTED:
			return "Processing is in progress. At completion, record used quantity, wastage, balance quantity and the output image.";

		case VF_STAGE.PROCESS_COMPLETED:
			return "Processing is complete. Inform the responsible Supervisor for output review and closure.";

		case VF_STAGE.SUPERVISOR_INFORMED:
			return "The Supervisor has been informed. Complete final review and mark the requirement Ready for Next Stage.";

		case VF_STAGE.READY_FOR_NEXT_STAGE:
			return "The VenFlow requirement is complete, traceability is closed and the processed veneer is ready for the next production stage.";

		default:
			return "Review the requirement and complete the currently enabled workflow action.";
	}
};