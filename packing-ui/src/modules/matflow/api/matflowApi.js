import API from "../../../services/api";

const BASE = "/matflow";

const unwrap = (response) => {
	return (
		response?.data?.data ??
		response?.data ??
		null
	);
};

const cleanParams = (params = {}) => {
	return Object.fromEntries(
		Object.entries(params).filter(
			([, value]) => {
				return (
					value !== undefined &&
					value !== null &&
					value !== ""
				);
			}
		)
	);
};

const requireId = (
	value,
	label = "Record ID"
) => {
	const id =
		String(value || "").trim();

	if (!id) {
		throw new Error(
			`${label} is required.`
		);
	}

	return id;
};

const get = async (
	path,
	params
) => {
	const response =
		await API.get(
			path,
			params
				? {
					params:
						cleanParams(params),
				}
				: undefined
		);

	return unwrap(response);
};

const post = async (
	path,
	body = {}
) => {
	const response =
		await API.post(
			path,
			body
		);

	return unwrap(response);
};

const put = async (
	path,
	body = {}
) => {
	const response =
		await API.put(
			path,
			body
		);

	return unwrap(response);
};

export const matflowApi = {
	/* =====================================================
	 * DASHBOARD AND REPORTING
	 * ===================================================== */

	getDashboard(params = {}) {
		return get(
			`${BASE}/reports/dashboard`,
			params
		);
	},

	getProjectTracking(
		projectDrawingId
	) {
		return get(
			`${BASE}/reports/projects/${requireId(
				projectDrawingId,
				"Project drawing ID"
			)}`
		);
	},

	listShortages(params = {}) {
		return get(
			`${BASE}/reports/shortages`,
			params
		);
	},

	listStockLedger(params = {}) {
		return get(
			`${BASE}/reports/stock-ledger`,
			params
		);
	},

	listAuditLogs(params = {}) {
		return get(
			`${BASE}/reports/audit`,
			params
		);
	},

	/* =====================================================
	 * MATERIAL MASTER
	 * ===================================================== */

	listMaterials(params = {}) {
		return get(
			`${BASE}/materials`,
			params
		);
	},

	getMaterial(materialId) {
		return get(
			`${BASE}/materials/${requireId(
				materialId,
				"Material ID"
			)}`
		);
	},

	createMaterial(body) {
		return post(
			`${BASE}/materials`,
			body
		);
	},

	updateMaterial(
		materialId,
		body
	) {
		return put(
			`${BASE}/materials/${requireId(
				materialId,
				"Material ID"
			)}`,
			body
		);
	},

	/* =====================================================
	 * LOCATIONS
	 * ===================================================== */

	listLocations(params = {}) {
		return get(
			`${BASE}/locations`,
			params
		);
	},

	createLocation(body) {
		return post(
			`${BASE}/locations`,
			body
		);
	},

	/* =====================================================
	 * PROJECTS AND DRAWINGS
	 * ===================================================== */

	listProjects(params = {}) {
		return get(
			`${BASE}/projects`,
			params
		);
	},

	getProject(projectDrawingId) {
		return get(
			`${BASE}/projects/${requireId(
				projectDrawingId,
				"Project drawing ID"
			)}`
		);
	},

	createProject(body) {
		return post(
			`${BASE}/projects`,
			body
		);
	},

	updateProject(
		projectDrawingId,
		body
	) {
		return put(
			`${BASE}/projects/${requireId(
				projectDrawingId,
				"Project drawing ID"
			)}`,
			body
		);
	},

	/* =====================================================
	 * OPERATIONAL MATFLOW BOMS
	 * ===================================================== */

	listBoms(params = {}) {
		return get(
			`${BASE}/boms`,
			params
		);
	},

	getBom(bomId) {
		return get(
			`${BASE}/boms/${requireId(
				bomId,
				"BOM ID"
			)}`
		);
	},

	createBom(body) {
		return post(
			`${BASE}/boms`,
			body
		);
	},

	updateBom(
		bomId,
		body
	) {
		return put(
			`${BASE}/boms/${requireId(
				bomId,
				"BOM ID"
			)}`,
			body
		);
	},

	submitBom(
		bomId,
		body
	) {
		return post(
			`${BASE}/boms/${requireId(
				bomId,
				"BOM ID"
			)}/submit`,
			body
		);
	},

	approveBom(
		bomId,
		body
	) {
		return post(
			`${BASE}/boms/${requireId(
				bomId,
				"BOM ID"
			)}/approve`,
			body
		);
	},

	returnBom(
		bomId,
		body
	) {
		return post(
			`${BASE}/boms/${requireId(
				bomId,
				"BOM ID"
			)}/return`,
			body
		);
	},

	createBomRevision(
		bomId,
		body = {}
	) {
		return post(
			`${BASE}/boms/${requireId(
				bomId,
				"BOM ID"
			)}/revisions`,
			body
		);
	},

	/* =====================================================
	 * PRODUCTION REQUISITIONS
	 * ===================================================== */

	listRequisitions(params = {}) {
		return get(
			`${BASE}/requisitions`,
			params
		);
	},

	getRequisition(
		requisitionId
	) {
		return get(
			`${BASE}/requisitions/${requireId(
				requisitionId,
				"Requisition ID"
			)}`
		);
	},

	createRequisition(body) {
		return post(
			`${BASE}/requisitions`,
			body
		);
	},

	submitRequisition(
		requisitionId,
		body
	) {
		return post(
			`${BASE}/requisitions/${requireId(
				requisitionId,
				"Requisition ID"
			)}/submit`,
			body
		);
	},

	planRequisition(
		requisitionId,
		body
	) {
		return post(
			`${BASE}/requisitions/${requireId(
				requisitionId,
				"Requisition ID"
			)}/plan`,
			body
		);
	},

	cancelRequisition(
		requisitionId,
		body
	) {
		return post(
			`${BASE}/requisitions/${requireId(
				requisitionId,
				"Requisition ID"
			)}/cancel`,
			body
		);
	},

	/* =====================================================
	 * RESERVATIONS
	 * ===================================================== */

	releaseReservation(
		reservationId,
		body
	) {
		return post(
			`${BASE}/reservations/${requireId(
				reservationId,
				"Reservation ID"
			)}/release`,
			body
		);
	},

	issueDirectReservation(
		reservationId,
		body
	) {
		return post(
			`${BASE}/reservations/${requireId(
				reservationId,
				"Reservation ID"
			)}/issue-direct`,
			body
		);
	},

	/* =====================================================
	 * TRANSFERS
	 * ===================================================== */

	listTransfers(params = {}) {
		return get(
			`${BASE}/transfers`,
			params
		);
	},

	getTransfer(transferId) {
		return get(
			`${BASE}/transfers/${requireId(
				transferId,
				"Transfer ID"
			)}`
		);
	},

	dispatchTransfer(
		transferId,
		body
	) {
		return post(
			`${BASE}/transfers/${requireId(
				transferId,
				"Transfer ID"
			)}/dispatch`,
			body
		);
	},

	receiveTransfer(
		transferId,
		body
	) {
		return post(
			`${BASE}/transfers/${requireId(
				transferId,
				"Transfer ID"
			)}/receive`,
			body
		);
	},

	/* =====================================================
	 * INDENTS
	 * ===================================================== */

	listIndents(params = {}) {
		return get(
			`${BASE}/indents`,
			params
		);
	},

	getIndent(indentId) {
		return get(
			`${BASE}/indents/${requireId(
				indentId,
				"Indent ID"
			)}`
		);
	},

	/* =====================================================
	 * VENDORS
	 * ===================================================== */

	listVendors(params = {}) {
		return get(
			`${BASE}/vendors`,
			params
		);
	},

	createVendor(body) {
		return post(
			`${BASE}/vendors`,
			body
		);
	},

	updateVendor(
		vendorId,
		body
	) {
		return put(
			`${BASE}/vendors/${requireId(
				vendorId,
				"Vendor ID"
			)}`,
			body
		);
	},

	/* =====================================================
	 * PURCHASE ORDERS AND GRN
	 * ===================================================== */

	listPurchaseOrders(params = {}) {
		return get(
			`${BASE}/purchase-orders`,
			params
		);
	},

	getPurchaseOrder(
		purchaseOrderId
	) {
		return get(
			`${BASE}/purchase-orders/${requireId(
				purchaseOrderId,
				"Purchase order ID"
			)}`
		);
	},

	createPurchaseOrder(body) {
		return post(
			`${BASE}/purchase-orders`,
			body
		);
	},

	placePurchaseOrder(
		purchaseOrderId,
		body
	) {
		return post(
			`${BASE}/purchase-orders/${requireId(
				purchaseOrderId,
				"Purchase order ID"
			)}/place`,
			body
		);
	},

	createGoodsReceipt(body) {
		return post(
			`${BASE}/grns`,
			body
		);
	},

	/* =====================================================
	 * QC
	 * ===================================================== */

	listQcInspections(params = {}) {
		return get(
			`${BASE}/qc`,
			params
		);
	},

	getQcInspection(
		inspectionId
	) {
		return get(
			`${BASE}/qc/${requireId(
				inspectionId,
				"QC inspection ID"
			)}`
		);
	},

	decideQc(
		inspectionId,
		body
	) {
		return post(
			`${BASE}/qc/${requireId(
				inspectionId,
				"QC inspection ID"
			)}/decision`,
			body
		);
	},

	returnQcToVendor(
		inspectionId,
		body
	) {
		return post(
			`${BASE}/qc/${requireId(
				inspectionId,
				"QC inspection ID"
			)}/return-to-vendor`,
			body
		);
	},

	/* =====================================================
	 * PROCESSING
	 * ===================================================== */

	listProcessingJobs(params = {}) {
		return get(
			`${BASE}/processing-jobs`,
			params
		);
	},

	getProcessingJob(jobId) {
		return get(
			`${BASE}/processing-jobs/${requireId(
				jobId,
				"Processing job ID"
			)}`
		);
	},

	createProcessingJob(body) {
		return post(
			`${BASE}/processing-jobs`,
			body
		);
	},

	startProcessingJob(
		jobId,
		body
	) {
		return post(
			`${BASE}/processing-jobs/${requireId(
				jobId,
				"Processing job ID"
			)}/start`,
			body
		);
	},

	completeProcessingJob(
		jobId,
		body
	) {
		return post(
			`${BASE}/processing-jobs/${requireId(
				jobId,
				"Processing job ID"
			)}/complete`,
			body
		);
	},

	/* =====================================================
	 * PRODUCTION CONSUMPTION
	 * ===================================================== */

	createProductionConsumption(body) {
		return post(
			`${BASE}/production-consumptions`,
			body
		);
	},

	/* =====================================================
	 * MATERIAL RETURNS
	 * ===================================================== */

	listMaterialReturns(params = {}) {
		return get(
			`${BASE}/material-returns`,
			params
		);
	},

	getMaterialReturn(returnId) {
		return get(
			`${BASE}/material-returns/${requireId(
				returnId,
				"Material return ID"
			)}`
		);
	},

	createMaterialReturn(body) {
		return post(
			`${BASE}/material-returns`,
			body
		);
	},

	dispatchMaterialReturn(
		returnId,
		body
	) {
		return post(
			`${BASE}/material-returns/${requireId(
				returnId,
				"Material return ID"
			)}/dispatch`,
			body
		);
	},

	receiveMaterialReturn(
		returnId,
		body
	) {
		return post(
			`${BASE}/material-returns/${requireId(
				returnId,
				"Material return ID"
			)}/receive`,
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

	const requestId =
		error?.response?.headers?.[
		"x-request-id"
		];

	let message = "";

	if (typeof data === "string") {
		message = data;
	} else {
		message =
			data?.message ||
			data?.detail ||
			data?.error ||
			error?.message ||
			fallback;
	}

	if (requestId) {
		return `${message} Request ID: ${requestId}`;
	}

	return message;
};

export const extractMatFlowPage = (
	responseData
) => {
	const data =
		responseData?.data ??
		responseData;

	if (Array.isArray(data)) {
		return {
			rows: data,
			page: 0,
			size: data.length,
			totalElements: data.length,
			totalPages:
				data.length > 0 ? 1 : 0,
		};
	}

	if (Array.isArray(data?.content)) {
		return {
			rows: data.content,

			page:
				data.page ??
				data.number ??
				0,

			size:
				data.size ??
				data.content.length,

			totalElements:
				data.totalElements ??
				data.content.length,

			totalPages:
				data.totalPages ??
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