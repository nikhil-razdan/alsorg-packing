import API from "../../../services/api";

const BASE = "/api/matflow";

const cleanParams = (params = {}) => {
	return Object.fromEntries(
		Object.entries(params).filter(([, value]) => {
			return (
				value !== undefined &&
				value !== null &&
				value !== ""
			);
		})
	);
};

export const matflowApi = {
	/* =====================================================
	 * RELEASES
	 * ===================================================== */

	listReleases(params = {}) {
		return API.get(
			`${BASE}/releases`,
			{
				params: cleanParams(params),
			}
		);
	},

	getRelease(releaseId) {
		return API.get(
			`${BASE}/releases/${releaseId}`
		);
	},

	/* =====================================================
	 * PRODUCTION REQUISITIONS
	 * ===================================================== */

	listRequisitions(params = {}) {
		return API.get(
			`${BASE}/requisitions`,
			{
				params: cleanParams(params),
			}
		);
	},

	getRequisition(requisitionId) {
		return API.get(
			`${BASE}/requisitions/${requisitionId}`
		);
	},

	createRequisition(releaseId, body) {
		return API.post(
			`${BASE}/requisitions/release/${releaseId}`,
			body
		);
	},

	submitRequisition(requisitionId, body) {
		return API.post(
			`${BASE}/requisitions/${requisitionId}/submit`,
			body
		);
	},

	/* =====================================================
	 * STORE REVIEW
	 * ===================================================== */

	listStoreQueue(params = {}) {
		/*
		 * Uses the requisition list endpoint as the source of truth.
		 * The backend may filter by status/desk.
		 */
		return API.get(
			`${BASE}/requisitions`,
			{
				params: cleanParams({
					...params,
					desk: "STORE",
				}),
			}
		);
	},

	submitStoreReview(
		requisitionId,
		body
	) {
		return API.post(
			`${BASE}/store/requisitions/${requisitionId}/review`,
			body
		);
	},

	returnRequisitionToProduction(
		requisitionId,
		body
	) {
		return API.post(
			`${BASE}/store/requisitions/${requisitionId}/return`,
			body
		);
	},

	listStockBlocks(params = {}) {
		return API.get(
			`${BASE}/store/stock-blocks`,
			{
				params: cleanParams(params),
			}
		);
	},

	/* =====================================================
	 * MATERIAL INDENTS
	 * ===================================================== */

	listIndents(params = {}) {
		return API.get(
			`${BASE}/indents`,
			{
				params: cleanParams(params),
			}
		);
	},

	getIndent(indentId) {
		return API.get(
			`${BASE}/indents/${indentId}`
		);
	},

	submitIndent(indentId, body) {
		return API.post(
			`${BASE}/indents/${indentId}/submit`,
			body
		);
	},

	/* =====================================================
	 * PURCHASE QUEUE / QUOTATIONS
	 * ===================================================== */

	listPurchaseQueue(params = {}) {
		return API.get(
			`${BASE}/indents`,
			{
				params: cleanParams({
					...params,
					desk: "PURCHASE",
				}),
			}
		);
	},

	listVendorQuotes(params = {}) {
		return API.get(
			`${BASE}/vendor-quotes`,
			{
				params: cleanParams(params),
			}
		);
	},

	getVendorQuote(quoteId) {
		return API.get(
			`${BASE}/vendor-quotes/${quoteId}`
		);
	},

	createVendorQuote(body) {
		return API.post(
			`${BASE}/vendor-quotes`,
			body
		);
	},

	/* =====================================================
	 * PURCHASE ORDERS
	 * ===================================================== */

	listPurchaseOrders(params = {}) {
		return API.get(
			`${BASE}/purchase-orders`,
			{
				params: cleanParams(params),
			}
		);
	},

	getPurchaseOrder(purchaseOrderId) {
		return API.get(
			`${BASE}/purchase-orders/${purchaseOrderId}`
		);
	},

	createPurchaseOrder(body) {
		return API.post(
			`${BASE}/purchase-orders`,
			body
		);
	},

	submitPurchaseOrder(
		purchaseOrderId,
		body
	) {
		return API.post(
			`${BASE}/purchase-orders/${purchaseOrderId}/submit`,
			body
		);
	},

	approvePurchaseOrder(
		purchaseOrderId,
		body
	) {
		return API.post(
			`${BASE}/purchase-orders/${purchaseOrderId}/approve`,
			body
		);
	},

	returnPurchaseOrder(
		purchaseOrderId,
		body
	) {
		return API.post(
			`${BASE}/purchase-orders/${purchaseOrderId}/return`,
			body
		);
	},
};

export const readMatFlowError = (
	error,
	fallback = "The MatFlow request failed."
) => {
	const data = error?.response?.data;

	if (typeof data === "string") {
		return data;
	}

	return (
		data?.message ||
		data?.detail ||
		data?.error ||
		error?.message ||
		fallback
	);
};

export const extractMatFlowPage = (
	responseData
) => {
	if (Array.isArray(responseData)) {
		return {
			rows: responseData,
			page: 0,
			size: responseData.length,
			totalElements: responseData.length,
			totalPages: 1,
		};
	}

	if (
		Array.isArray(
			responseData?.content
		)
	) {
		return {
			rows: responseData.content,
			page:
				responseData.number ??
				responseData.page ??
				0,
			size:
				responseData.size ??
				responseData.content.length,
			totalElements:
				responseData.totalElements ??
				responseData.content.length,
			totalPages:
				responseData.totalPages ??
				1,
		};
	}

	if (Array.isArray(responseData?.data)) {
		return {
			rows: responseData.data,
			page: responseData.page ?? 0,
			size:
				responseData.size ??
				responseData.data.length,
			totalElements:
				responseData.totalElements ??
				responseData.data.length,
			totalPages:
				responseData.totalPages ??
				1,
		};
	}

	return {
		rows: [],
		page: 0,
		size: 0,
		totalElements: 0,
		totalPages: 0,
	};
};