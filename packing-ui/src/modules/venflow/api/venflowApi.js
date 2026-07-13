import API from "../../../services/api";

export const venflowApi = {
	/*
	 * =========================================================
	 * DASHBOARD / LISTS
	 * =========================================================
	 */

	getDashboard: () =>
		API.get("/venflow/dashboard"),

	getEntries: (params) =>
		API.get(
			"/venflow/entries",
			{ params }
		),

	getPurchaseDesk: (params) =>
		API.get(
			"/venflow/purchase-desk",
			{ params }
		),

	getSupervisorDesk: (params) =>
		API.get(
			"/venflow/supervisor-desk",
			{ params }
		),

	getEntry: (id) =>
		API.get(
			`/venflow/entries/${id}`
		),

	createEntry: (payload) =>
		API.post(
			"/venflow/entries",
			payload
		),

	/*
	 * =========================================================
	 * DIRECTOR DESK
	 * =========================================================
	 */

	getDirectorDashboard: (params) =>
		API.get(
			"/venflow/director/dashboard",
			{ params }
		),

	getDirectorPoQueue: (params) =>
		API.get(
			"/venflow/director/po-queue",
			{ params }
		),

	directorApprovePo: (
		id,
		payload
	) =>
		API.patch(
			`/venflow/entries/${id}/director-approve-po`,
			payload
		),

	directorRejectPo: (
		id,
		payload
	) =>
		API.patch(
			`/venflow/entries/${id}/director-reject-po`,
			payload
		),

	placeVendorOrder: (
		id,
		payload
	) =>
		API.patch(
			`/venflow/entries/${id}/place-vendor-order`,
			payload
		),

	/*
	 * =========================================================
	 * ENGINEERING
	 * =========================================================
	 */

	updateProductDetails: (
		id,
		payload
	) =>
		API.patch(
			`/venflow/entries/${id}/product-details`,
			payload
		),

	updateExpectedDate: (
		id,
		payload
	) =>
		API.patch(
			`/venflow/entries/${id}/expected-date`,
			payload
		),

	sendToStore: (id) =>
		API.patch(
			`/venflow/entries/${id}/send-to-store`
		),

	/*
	 * =========================================================
	 * STORE
	 * =========================================================
	 */

	storeReview: (
		id,
		payload
	) =>
		API.patch(
			`/venflow/entries/${id}/store-review`,
			payload
		),

	reserveMaterial: (
		id,
		payload
	) =>
		API.patch(
			`/venflow/entries/${id}/reserve-material`,
			payload
		),

	raisePurchaseRequest: (
		id,
		payload
	) =>
		API.patch(
			`/venflow/entries/${id}/purchase-request`,
			payload
		),

	materialReceived: (
		id,
		payload
	) =>
		API.patch(
			`/venflow/entries/${id}/material-received`,
			payload
		),

	grnEntry: (
		id,
		payload
	) =>
		API.patch(
			`/venflow/entries/${id}/grn`,
			payload
		),

	qualityCheck: (
		id,
		payload
	) =>
		API.patch(
			`/venflow/entries/${id}/qc`,
			payload
		),

	acceptInventory: (id) =>
		API.patch(
			`/venflow/entries/${id}/accept-inventory`
		),

	issueMaterial: (
		id,
		payload
	) =>
		API.patch(
			`/venflow/entries/${id}/issue-material`,
			payload
		),

	/*
	 * =========================================================
	 * PURCHASE
	 * =========================================================
	 */

	raisePo: (
		id,
		payload
	) =>
		API.patch(
			`/venflow/entries/${id}/po-raise`,
			payload
		),

	/*
	 * =========================================================
	 * PROCESSING
	 * =========================================================
	 */

	productionDetails: (
		id,
		payload
	) =>
		API.patch(
			`/venflow/entries/${id}/production-details`,
			payload
		),

	startProcessing: (id) =>
		API.patch(
			`/venflow/entries/${id}/processing-start`
		),

	completeProcess: (
		id,
		payload
	) =>
		API.patch(
			`/venflow/entries/${id}/process-complete`,
			payload
		),

	supervisorInformed: (id) =>
		API.patch(
			`/venflow/entries/${id}/supervisor-informed`
		),

	readyForNextStage: (id) =>
		API.patch(
			`/venflow/entries/${id}/ready-next-stage`
		),

	/*
	 * =========================================================
	 * AUDIT / STAGE HISTORY / NOTIFICATIONS
	 * =========================================================
	 */

	getAudit: (id) =>
		API.get(
			`/venflow/audit/${id}`
		),

	getStageHistory: (id) =>
		API.get(
			`/venflow/entries/${id}/stage-history`
		),

	getNotifications: (params) =>
		API.get(
			"/venflow/notifications",
			{ params }
		),

	getUnreadNotificationCount: () =>
		API.get(
			"/venflow/notifications/unread-count"
		),

	markNotificationRead: (id) =>
		API.patch(
			`/venflow/notifications/${id}/read`
		),

	/*
	 * =========================================================
	 * REPORTS
	 * =========================================================
	 */

	getReportSummary: (params) =>
		API.get(
			"/venflow/reports/summary",
			{ params }
		),

	/*
	 * =========================================================
	 * LEGACY COMPATIBILITY
	 * =========================================================
	 */

	updateStoreStatus: (
		id,
		payload
	) =>
		API.patch(
			`/venflow/entries/${id}/store-status`,
			payload
		),

	sendToPurchase: (id) =>
		API.patch(
			`/venflow/entries/${id}/send-to-purchase`
		),

	updateRequisition: (
		id,
		payload
	) =>
		API.patch(
			`/venflow/entries/${id}/requisition`,
			payload
		),

	updateOrderedQty: (
		id,
		payload
	) =>
		API.patch(
			`/venflow/entries/${id}/ordered-qty`,
			payload
		),

	updateReceivedQty: (
		id,
		payload
	) =>
		API.patch(
			`/venflow/entries/${id}/received-qty`,
			payload
		),

	informProduction: (id) =>
		API.patch(
			`/venflow/entries/${id}/inform-production`
		),

	startProduction: (
		id,
		payload
	) =>
		API.patch(
			`/venflow/entries/${id}/production-start`,
			payload
		),

	jobDone: (
		id,
		payload
	) =>
		API.patch(
			`/venflow/entries/${id}/job-done`,
			payload
		),

	updateRemarks: (
		id,
		payload
	) =>
		API.patch(
			`/venflow/entries/${id}/remarks`,
			payload
		),

	completeEntry: (id) =>
		API.patch(
			`/venflow/entries/${id}/complete`
		),
};