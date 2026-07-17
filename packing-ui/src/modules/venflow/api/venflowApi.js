import API from "../../../services/api";

export const venflowApi = {
	/* ================= DASHBOARD / LISTS ================= */

	getDashboard: () =>
		API.get("/venflow/dashboard"),

	getEntries: (params) =>
		API.get("/venflow/entries", { params }),

	getPurchaseDesk: (params) =>
		API.get("/venflow/purchase-desk", { params }),

	getSupervisorDesk: (params) =>
		API.get("/venflow/supervisor-desk", { params }),

	getEntry: (id) =>
		API.get(`/venflow/entries/${id}`),

	createEntry: (payload) =>
		API.post("/venflow/entries", payload),

	/* ================= DIRECTOR ================= */

	getDirectorDashboard: () =>
		API.get("/venflow/director/dashboard"),

	getDirectorPoQueue: (params) =>
		API.get("/venflow/director/po-queue", { params }),

	directorApprovePo: (id, payload) =>
		API.patch(
			`/venflow/entries/${id}/director-approve-po`,
			payload
		),

	directorRejectPo: (id, payload) =>
		API.patch(
			`/venflow/entries/${id}/director-reject-po`,
			payload
		),

	/* ================= ENGINEERING ================= */

	updateProductDetails: (id, payload) =>
		API.patch(
			`/venflow/entries/${id}/product-details`,
			payload
		),

	updateExpectedDate: (id, payload) =>
		API.patch(
			`/venflow/entries/${id}/expected-date`,
			payload
		),

	sendToStore: (id) =>
		API.patch(
			`/venflow/entries/${id}/send-to-store`
		),

	/* ================= STORE DECISION ================= */

	submitStoreDecision: (id, payload) =>
		API.patch(
			`/venflow/entries/${id}/store-decision`,
			payload
		),

	getMaterialSummary: (id) =>
		API.get(
			`/venflow/entries/${id}/material-summary`
		),

	getMaterialHistory: (id) =>
		API.get(
			`/venflow/entries/${id}/material-history`
		),

	materialReceived: (id, payload) =>
		API.patch(
			`/venflow/entries/${id}/material-received`,
			payload
		),

	grnEntry: (id, payload) =>
		API.patch(
			`/venflow/entries/${id}/grn`,
			payload
		),

	issueMaterial: (id, payload) =>
		API.patch(
			`/venflow/entries/${id}/issue-material`,
			payload
		),

	/* ================= PURCHASE ================= */

	raisePo: (id, payload) =>
		API.patch(
			`/venflow/entries/${id}/po-raise`,
			payload
		),

	placeVendorOrder: (id, payload) =>
		API.patch(
			`/venflow/entries/${id}/place-vendor-order`,
			payload
		),

	/* ================= ALLOCATION QC ================= */

	submitQcInspection: (
		entryId,
		allocationId,
		payload
	) =>
		API.post(
			`/venflow/entries/${entryId}/allocations/${allocationId}/qc`,
			payload
		),

	/* ================= PROCESSING ================= */

	productionDetails: (id, payload) =>
		API.patch(
			`/venflow/entries/${id}/production-details`,
			payload
		),

	startProcessing: (id) =>
		API.patch(
			`/venflow/entries/${id}/processing-start`
		),

	completeProcess: (id, payload) =>
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

	/* ================= AUDIT / HISTORY ================= */

	getAudit: (id) =>
		API.get(`/venflow/audit/${id}`),

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

	/* ================= COMMON ================= */

	updateRemarks: (id, payload) =>
		API.patch(
			`/venflow/entries/${id}/remarks`,
			payload
		),

	getReportSummary: (params) =>
		API.get(
			"/venflow/reports/summary",
			{ params }
		),
};