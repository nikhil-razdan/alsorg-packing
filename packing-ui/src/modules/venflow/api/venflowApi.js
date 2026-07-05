import API from "../../../services/api";

export const venflowApi = {
	getDashboard: () =>
		API.get("/venflow/dashboard"),

	getEntries: (params) =>
		API.get("/venflow/entries", { params }),

	getPurchaseDesk: (params) =>
		API.get("/venflow/purchase-desk", { params }),

	getEntry: (id) =>
		API.get(`/venflow/entries/${id}`),

	createEntry: (payload) =>
		API.post("/venflow/entries", payload),

	updateProductDetails: (id, payload) =>
		API.patch(`/venflow/entries/${id}/product-details`, payload),

	updateStoreStatus: (id, payload) =>
		API.patch(`/venflow/entries/${id}/store-status`, payload),

	sendToPurchase: (id) =>
		API.patch(`/venflow/entries/${id}/send-to-purchase`),

	updateRequisition: (id, payload) =>
		API.patch(`/venflow/entries/${id}/requisition`, payload),

	updateOrderedQty: (id, payload) =>
		API.patch(`/venflow/entries/${id}/ordered-qty`, payload),

	raisePo: (id, payload) =>
		API.patch(`/venflow/entries/${id}/po-raise`, payload),

	approvePo: (id) =>
		API.patch(`/venflow/entries/${id}/po-approve`),

	updateExpectedDate: (id, payload) =>
		API.patch(`/venflow/entries/${id}/expected-date`, payload),

	updateReceivedQty: (id, payload) =>
		API.patch(`/venflow/entries/${id}/received-qty`, payload),

	materialReceived: (id, payload) =>
		API.patch(`/venflow/entries/${id}/material-received`, payload),

	informProduction: (id) =>
		API.patch(`/venflow/entries/${id}/inform-production`),

	startProduction: (id, payload) =>
		API.patch(`/venflow/entries/${id}/production-start`, payload),

	jobDone: (id, payload) =>
		API.patch(`/venflow/entries/${id}/job-done`, payload),

	updateRemarks: (id, payload) =>
		API.patch(`/venflow/entries/${id}/remarks`, payload),

	completeEntry: (id) =>
		API.patch(`/venflow/entries/${id}/complete`),

	getReportSummary: () =>
		API.get("/venflow/reports/summary"),

	getAudit: (id) =>
		API.get(`/venflow/audit/${id}`),

	sendToStore: (id) =>
		API.patch(`/venflow/entries/${id}/send-to-store`),

	storeReview: (id, payload) =>
		API.patch(`/venflow/entries/${id}/store-review`, payload),

	reserveMaterial: (id, payload) =>
		API.patch(`/venflow/entries/${id}/reserve-material`, payload),

	raisePurchaseRequest: (id, payload) =>
		API.patch(`/venflow/entries/${id}/purchase-request`, payload),

	grnEntry: (id, payload) =>
		API.patch(`/venflow/entries/${id}/grn`, payload),

	qualityCheck: (id, payload) =>
		API.patch(`/venflow/entries/${id}/qc`, payload),

	acceptInventory: (id) =>
		API.patch(`/venflow/entries/${id}/accept-inventory`),

	productionDetails: (id, payload) =>
		API.patch(`/venflow/entries/${id}/production-details`, payload),

	issueMaterial: (id, payload) =>
		API.patch(`/venflow/entries/${id}/issue-material`, payload),

	startProcessing: (id) =>
		API.patch(`/venflow/entries/${id}/processing-start`),

	completeProcess: (id, payload) =>
		API.patch(`/venflow/entries/${id}/process-complete`, payload),

	supervisorInformed: (id) =>
		API.patch(`/venflow/entries/${id}/supervisor-informed`),

	readyForNextStage: (id) =>
		API.patch(`/venflow/entries/${id}/ready-next-stage`),
};