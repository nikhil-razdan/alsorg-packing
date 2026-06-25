import API from "../../../services/api";

export const venflowApi = {
	getDashboard: () => API.get("/venflow/dashboard"),

	getEntries: (params) =>
		API.get("/venflow/entries", { params }),

	getEntry: (id) =>
		API.get(`/venflow/entries/${id}`),

	createEntry: (payload) =>
		API.post("/venflow/entries", payload),

	updateProductDetails: (id, payload) =>
		API.patch(`/venflow/entries/${id}/product-details`, payload),

	updateStoreStatus: (id, payload) =>
		API.patch(`/venflow/entries/${id}/store-status`, payload),

	updateRequisition: (id, payload) =>
		API.patch(`/venflow/entries/${id}/requisition`, payload),

	updateOrderedQty: (id, payload) =>
		API.patch(`/venflow/entries/${id}/ordered-qty`, payload),

	updateExpectedDate: (id, payload) =>
		API.patch(`/venflow/entries/${id}/expected-date`, payload),

	updateReceivedQty: (id, payload) =>
		API.patch(`/venflow/entries/${id}/received-qty`, payload),

	updateRemarks: (id, payload) =>
		API.patch(`/venflow/entries/${id}/remarks`, payload),

	completeEntry: (id) =>
		API.patch(`/venflow/entries/${id}/complete`),

	getAudit: (id) =>
		API.get(`/venflow/audit/${id}`),
};