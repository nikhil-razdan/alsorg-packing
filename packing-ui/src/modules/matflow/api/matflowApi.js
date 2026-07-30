import API from "../../../services/api";

const BASE = "/matflow";

const cleanParams = (params = {}) => {
	return Object.fromEntries(
		Object.entries(params).filter(
			([, value]) =>
				value !== undefined &&
				value !== null &&
				value !== ""
		)
	);
};

const localListResponse = (rows = []) => {
	return Promise.resolve({
		data: rows,
	});
};

/*
 * Backend release detail shape:
 *
 * {
 *     release: { ...release header },
 *     lines: [ ...material lines ]
 * }
 *
 * Existing frontend pages expect:
 *
 * {
 *     ...release header,
 *     lines: [...]
 * }
 */
const normalizeReleaseDetail = (
	response
) => {
	const payload = response?.data;

	if (
		payload?.release &&
		typeof payload.release === "object"
	) {
		return {
			...response,
			data: {
				...payload.release,
				lines: Array.isArray(
					payload.lines
				)
					? payload.lines
					: [],
			},
		};
	}

	return response;
};

const normalizeReleaseList = (
	response
) => {
	const payload = response?.data;

	if (!Array.isArray(payload)) {
		return {
			...response,
			data: [],
		};
	}

	return {
		...response,
		data: payload.map((entry) => {
			if (
				entry?.release &&
				typeof entry.release === "object"
			) {
				return {
					...entry.release,
					lines: Array.isArray(
						entry.lines
					)
						? entry.lines
						: [],
				};
			}

			return entry;
		}),
	};
};

export const matflowApi = {


	/* =====================================================
 * MATFLOW PROFESSIONAL TRACKER
 * ===================================================== */

	getTracker(params = {}) {
		return API.get(
			`${BASE}/tracker`,
			{
				params:
					cleanParams(params),
			}
		);
	},

	/* =====================================================
 * MATERIAL MASTER
 * Backend: MatFlowMasterController
 * ===================================================== */

	listMaterials(params = {}) {
		return API.get(
			`${BASE}/materials`,
			{
				params: cleanParams(params),
			}
		);
	},

	async getMaterial(materialId) {
		if (!materialId) {
			throw new Error(
				"Material ID is required."
			);
		}

		/*
		 * The current backend has no:
		 * GET /materials/{id}
		 *
		 * Therefore obtain the master list and locate
		 * the requested record locally.
		 */
		const response =
			await API.get(
				`${BASE}/materials`
			);

		const rows =
			Array.isArray(response.data)
				? response.data
				: [];

		const material =
			rows.find(
				(row) =>
					String(row.id) ===
					String(materialId)
			);

		if (!material) {
			const error =
				new Error(
					"Material not found."
				);

			error.response = {
				status: 404,
				data: {
					message:
						"Material not found.",
				},
			};

			throw error;
		}

		return {
			...response,
			data: material,
		};
	},


	createMaterial(body) {
		return API.post(
			`${BASE}/materials`,
			body
		);
	},

	updateMaterial(
		materialId,
		body
	) {
		return API.put(
			`${BASE}/materials/${materialId}`,
			body
		);
	},

	/* =====================================================
	 * PROJECT / DRAWING MASTER
	 * Exact backend endpoint: /projects
	 * ===================================================== */

	listProjects(params = {}) {
		return API.get(
			`${BASE}/projects`,
			{
				params: cleanParams(params),
			}
		);
	},

	async getProject(projectId) {
		if (!projectId) {
			throw new Error(
				"Project ID is required."
			);
		}

		/*
		 * The current backend has no:
		 * GET /projects/{id}
		 *
		 * Use the list endpoint and locate the project.
		 */
		const response =
			await API.get(
				`${BASE}/projects`
			);

		const rows =
			Array.isArray(response.data)
				? response.data
				: [];

		const project =
			rows.find(
				(row) =>
					String(row.id) ===
					String(projectId)
			);

		if (!project) {
			const error =
				new Error(
					"Project drawing not found."
				);

			error.response = {
				status: 404,
				data: {
					message:
						"Project drawing not found.",
				},
			};

			throw error;
		}

		return {
			...response,
			data: project,
		};
	},

	createProject(body) {
		return API.post(
			`${BASE}/projects`,
			body
		);
	},

	updateProject(
		projectId,
		body
	) {
		return API.put(
			`${BASE}/projects/${projectId}`,
			body
		);
	},

	/* =====================================================
	 * MATFLOW OPERATIONAL BOM
	 * ===================================================== */

	listBoms(params = {}) {
		return API.get(
			`${BASE}/boms`,
			{
				params: cleanParams(params),
			}
		);
	},

	getBom(bomId) {
		return API.get(
			`${BASE}/boms/${bomId}`
		);
	},

	createBom(body) {
		return API.post(
			`${BASE}/boms`,
			body
		);
	},

	updateBom(
		bomId,
		body
	) {
		return API.put(
			`${BASE}/boms/${bomId}`,
			body
		);
	},

	addBomLine(
		bomId,
		body
	) {
		return API.post(
			`${BASE}/boms/${bomId}/lines`,
			body
		);
	},

	updateBomLine(
		bomId,
		lineId,
		body
	) {
		return API.put(
			`${BASE}/boms/${bomId}/lines/${lineId}`,
			body
		);
	},

	deleteBomLine(
		bomId,
		lineId,
		rowVersion
	) {
		return API.delete(
			`${BASE}/boms/${bomId}/lines/${lineId}`,
			{
				params: {
					rowVersion,
				},
			}
		);
	},

	submitBom(
		bomId,
		body
	) {
		return API.post(
			`${BASE}/boms/${bomId}/submit`,
			body
		);
	},

	returnBom(
		bomId,
		body
	) {
		return API.post(
			`${BASE}/boms/${bomId}/return`,
			body
		);
	},

	approveBom(
		bomId,
		body
	) {
		return API.post(
			`${BASE}/boms/${bomId}/approve`,
			body
		);
	},

	createBomRevision(
		bomId,
		body
	) {
		return API.post(
			`${BASE}/boms/${bomId}/revisions`,
			body
		);
	},

	/* =====================================================
	 * INVENTORY
	 * Exact backend: MatFlowInventoryController
	 * ===================================================== */

	listLocations(params = {}) {
		return API.get(
			`${BASE}/locations`,
			{
				params: cleanParams(params),
			}
		);
	},

	createLocation(body) {
		return API.post(
			`${BASE}/locations`,
			body
		);
	},

	updateLocation(
		locationId,
		body
	) {
		return API.put(
			`${BASE}/locations/${locationId}`,
			body
		);
	},

	listStock(params = {}) {
		return API.get(
			`${BASE}/stock`,
			{
				params: cleanParams(params),
			}
		);
	},

	adjustStock(body) {
		return API.post(
			`${BASE}/stock/adjustments`,
			body
		);
	},

	/* =====================================================
	 * CONTROL ACTIONS
	 * Exact backend: MatFlowControlController
	 * ===================================================== */

	releaseReservation(
		reservationId,
		body
	) {
		return API.post(
			`${BASE}/reservations/${reservationId}/release`,
			body
		);
	},
	/* =====================================================
	 * MATFLOW RELEASES
	 * ===================================================== */

	async getRelease(releaseId) {
		const response = await API.get(
			`${BASE}/releases/${releaseId}`
		);

		return normalizeReleaseDetail(
			response
		);
	},

	async getReleaseBySourceRevision(
		revisionId
	) {
		const response = await API.get(
			`${BASE}/releases/by-source-revision/${revisionId}`
		);

		return normalizeReleaseDetail(
			response
		);
	},

	async listReleases(params = {}) {
		const sourceBomId =
			params.sourceBomId;

		/*
		 * Current backend does not have a global release-list
		 * endpoint. Its GET /releases endpoint requires
		 * sourceBomId.
		 *
		 * Returning an empty local list prevents unnecessary
		 * 400 errors until a source BOM is supplied.
		 */
		if (!sourceBomId) {
			return localListResponse([]);
		}

		const response = await API.get(
			`${BASE}/releases`,
			{
				params: {
					sourceBomId,
				},
			}
		);

		return normalizeReleaseList(
			response
		);
	},

	getReleaseAudit(releaseId) {
		return API.get(
			`${BASE}/releases/${releaseId}/audit`
		);
	},

	/* =====================================================
 * PRODUCTION MATERIAL REQUISITIONS
 *
 * Exact backend:
 * MatFlowPlanningController
 * ===================================================== */

	listRequisitions() {
		return API.get(
			`${BASE}/requisitions`
		);
	},

	getRequisition(
		requisitionId
	) {
		if (!requisitionId) {
			throw new Error(
				"Requisition ID is required."
			);
		}

		return API.get(
			`${BASE}/requisitions/${encodeURIComponent(
				String(requisitionId)
			)}`
		);
	},

	getRequisitionPlanning(
		requisitionId
	) {
		if (!requisitionId) {
			throw new Error(
				"Requisition ID is required."
			);
		}

		return API.get(
			`${BASE}/requisitions/${encodeURIComponent(
				String(requisitionId)
			)}/planning`
		);
	},

	createRequisition(body) {
		return API.post(
			`${BASE}/requisitions`,
			body
		);
	},

	submitRequisition(
		requisitionId,
		body
	) {
		if (!requisitionId) {
			throw new Error(
				"Requisition ID is required."
			);
		}

		return API.post(
			`${BASE}/requisitions/${encodeURIComponent(
				String(requisitionId)
			)}/submit`,
			body
		);
	},

	planRequisition(
		requisitionId,
		body
	) {
		if (!requisitionId) {
			throw new Error(
				"Requisition ID is required."
			);
		}

		return API.post(
			`${BASE}/requisitions/${encodeURIComponent(
				String(requisitionId)
			)}/plan`,
			body
		);
	},

	/* =====================================================
	 * STORE REVIEW
	 * ===================================================== */

	listStoreQueue(params = {}) {
		return API.get(
			`${BASE}/store/requisitions/pending`,
			{
				params:
					cleanParams(params),
			}
		);
	},

	getStoreReview(requisitionId) {
		return API.get(
			`${BASE}/store/requisitions/${requisitionId}`
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
		return API.patch(
			`${BASE}/store/requisitions/${requisitionId}/return-to-production`,
			body
		);
	},

	/* =====================================================
	 * MATERIAL INDENTS
	 * ===================================================== */

	createIndent(body) {
		return API.post(
			`${BASE}/indents`,
			body
		);
	},

	getIndent(indentId) {
		return API.get(
			`${BASE}/indents/${indentId}`
		);
	},

	listIndentsByRequisition(
		requisitionId
	) {
		return API.get(
			`${BASE}/indents/by-requisition/${requisitionId}`
		);
	},

	listIndents(params = {}) {
		if (!params.requisitionId) {
			return localListResponse([]);
		}

		return API.get(
			`${BASE}/indents/by-requisition/${params.requisitionId}`
		);
	},

	saveIndentLine(
		indentId,
		body
	) {
		return API.post(
			`${BASE}/indents/${indentId}/lines`,
			body
		);
	},

	removeIndentLine(
		indentId,
		lineId,
		rowVersion
	) {
		return API.delete(
			`${BASE}/indents/${indentId}/lines/${lineId}`,
			{
				params: {
					rowVersion,
				},
			}
		);
	},

	submitIndent(
		indentId,
		body
	) {
		return API.patch(
			`${BASE}/indents/${indentId}/submit-to-purchase`,
			body
		);
	},

	cancelIndent(
		indentId,
		body
	) {
		return API.patch(
			`${BASE}/indents/${indentId}/cancel`,
			body
		);
	},

	/* =====================================================
	 * PURCHASE QUEUE
	 * ===================================================== */

	listPurchaseQueue(params = {}) {
		return API.get(
			`${BASE}/purchase/indents/pending`,
			{
				params:
					cleanParams(params),
			}
		);
	},

	/* =====================================================
	 * VENDOR QUOTATIONS
	 * ===================================================== */

	createVendorQuote(body) {
		return API.post(
			`${BASE}/purchase/quotes`,
			body
		);
	},

	getVendorQuote(quoteId) {
		return API.get(
			`${BASE}/purchase/quotes/${quoteId}`
		);
	},

	saveVendorQuoteLine(
		quoteId,
		body
	) {
		return API.post(
			`${BASE}/purchase/quotes/${quoteId}/lines`,
			body
		);
	},

	submitVendorQuote(
		quoteId,
		body
	) {
		return API.patch(
			`${BASE}/purchase/quotes/${quoteId}/submit`,
			body
		);
	},

	cancelVendorQuote(
		quoteId,
		body
	) {
		return API.patch(
			`${BASE}/purchase/quotes/${quoteId}/cancel`,
			body
		);
	},

	getQuoteComparison(indentId) {
		return API.get(
			`${BASE}/purchase/indents/${indentId}/quote-comparison`
		);
	},

	/* =====================================================
	 * PURCHASE ORDERS
	 * ===================================================== */

	createPurchaseOrder(body) {
		return API.post(
			`${BASE}/purchase/orders`,
			body
		);
	},

	getPurchaseOrder(
		purchaseOrderId
	) {
		return API.get(
			`${BASE}/purchase/orders/${purchaseOrderId}`
		);
	},

	listPurchaseOrdersByIndent(
		indentId
	) {
		return API.get(
			`${BASE}/purchase/orders/by-indent/${indentId}`
		);
	},

	listPurchaseOrders(params = {}) {
		if (!params.indentId) {
			return localListResponse([]);
		}

		return API.get(
			`${BASE}/purchase/orders/by-indent/${params.indentId}`
		);
	},

	savePurchaseOrderLine(
		purchaseOrderId,
		body
	) {
		return API.post(
			`${BASE}/purchase/orders/${purchaseOrderId}/lines`,
			body
		);
	},

	removePurchaseOrderLine(
		purchaseOrderId,
		lineId,
		rowVersion
	) {
		return API.delete(
			`${BASE}/purchase/orders/${purchaseOrderId}/lines/${lineId}`,
			{
				params: {
					rowVersion,
				},
			}
		);
	},

	submitPurchaseOrder(
		purchaseOrderId,
		body
	) {
		return API.patch(
			`${BASE}/purchase/orders/${purchaseOrderId}/submit-for-approval`,
			body
		);
	},

	approvePurchaseOrder(
		purchaseOrderId,
		body
	) {
		return API.patch(
			`${BASE}/purchase/orders/${purchaseOrderId}/approve`,
			body
		);
	},

	returnPurchaseOrder(
		purchaseOrderId,
		body
	) {
		return API.patch(
			`${BASE}/purchase/orders/${purchaseOrderId}/return`,
			body
		);
	},

	cancelPurchaseOrder(
		purchaseOrderId,
		body
	) {
		return API.patch(
			`${BASE}/purchase/orders/${purchaseOrderId}/cancel`,
			body
		);
	},
};

export const readMatFlowError = (
	error,
	fallback = "The MatFlow request failed."
) => {
	const data =
		error?.response?.data;

	if (typeof data === "string") {
		return data;
	}

	const validationErrors =
		data?.validationErrors &&
			typeof data.validationErrors === "object"
			? Object.entries(
				data.validationErrors
			).map(
				([field, message]) =>
					`${field}: ${message}`
			)
			: [];

	const mainMessage =
		data?.message ||
		data?.detail ||
		data?.error ||
		error?.message ||
		fallback;

	return validationErrors.length > 0
		? [
			mainMessage,
			...validationErrors,
		].join(" | ")
		: mainMessage;
};

export const extractMatFlowPage = (
	responseData
) => {
	if (Array.isArray(responseData)) {
		return {
			rows: responseData,
			page: 0,
			size: responseData.length,
			totalElements:
				responseData.length,
			totalPages:
				responseData.length > 0
					? 1
					: 0,
		};
	}

	if (
		Array.isArray(
			responseData?.content
		)
	) {
		return {
			rows:
				responseData.content,

			page:
				responseData.number ??
				responseData.page ??
				0,

			size:
				responseData.size ??
				responseData.content
					.length,

			totalElements:
				responseData.totalElements ??
				responseData.content
					.length,

			totalPages:
				responseData.totalPages ??
				1,
		};
	}

	if (
		Array.isArray(
			responseData?.data
		)
	) {
		return {
			rows:
				responseData.data,

			page:
				responseData.page ?? 0,

			size:
				responseData.size ??
				responseData.data
					.length,

			totalElements:
				responseData.totalElements ??
				responseData.data
					.length,

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

export default matflowApi;