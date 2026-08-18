import API from "../../../services/api";

const BASE = "/matflow";

const cleanParams = (params = {}) =>
	Object.fromEntries(
		Object.entries(params).filter(
			([, value]) => value !== undefined && value !== null && value !== ""
		)
	);

const requiredId = (value, label = "ID") => {
	const id = String(value ?? "").trim();
	if (!id) throw new Error(`${label} is required.`);
	return encodeURIComponent(id);
};

export const extractMatFlowPage = (data) => {
	if (Array.isArray(data)) {
		return {
			rows: data,
			page: 0,
			size: data.length,
			totalElements: data.length,
			totalPages: data.length ? 1 : 0,
		};
	}

	const rows = Array.isArray(data?.content)
		? data.content
		: Array.isArray(data?.rows)
			? data.rows
			: Array.isArray(data?.data)
				? data.data
				: [];

	return {
		rows,
		page: Number(data?.number ?? data?.page ?? 0),
		size: Number(data?.size ?? rows.length),
		totalElements: Number(data?.totalElements ?? rows.length),
		totalPages: Number(data?.totalPages ?? (rows.length ? 1 : 0)),
	};
};

export const readMatFlowError = (
	error,
	fallback = "The MatFlow request failed."
) => {
	const data = error?.response?.data;
	if (typeof data === "string") return data;

	const validationErrors =
		data?.validationErrors && typeof data.validationErrors === "object"
			? Object.entries(data.validationErrors).map(
				([field, message]) => `${field}: ${message}`
			)
			: [];

	const message =
		data?.message ||
		data?.detail ||
		data?.error ||
		error?.message ||
		fallback;

	return validationErrors.length
		? [message, ...validationErrors].join(" | ")
		: message;
};

/**
 * MatFlow frontend API v9-compatible four-plant routing.
 *
 * Deliberately absent:
 * - Project/Product approval actions
 * - Director BOM actions
 * - Production partial-availability decision
 * - Manual PI submit
 * - PO approval/draft-delete actions
 * - Generic routing-node / Location CRUD
 * - Public Transfer CRUD
 * - Manual Processing-job creation/delete
 * - Legacy QC routing/disposition actions
 *
 * Canonical four-plant behavior:
 * - AL-P1 Production submits directly to AL-P1 Main Store
 * - AL-P2/P3/P4 Production submits to its own Plant Store, which forwards the same MR unchanged to AL-P1
 * - Main Store planning is keyed by MR plant + requester; operators never choose a Location
 * - Final issue returns through the origin Plant Store for remote plants and ends with the exact Production requester
 * - Production returns follow the reverse Plant Store route back to AL-P1 Main Store
 */
export const matflowApi = {
	/* ========================= MASTER / PROJECT ========================= */
	listMaterials: (params = {}) =>
		API.get(`${BASE}/materials`, { params: cleanParams(params) }),
	createMaterial: (body) =>
		API.post(`${BASE}/materials`, body),
	updateMaterial: (id, body) =>
		API.put(`${BASE}/materials/${requiredId(id, "Material ID")}`, body),

	listProjects: (params = {}) =>
		API.get(`${BASE}/projects`, { params: cleanParams(params) }),
	getProject: (projectId) =>
		API.get(`${BASE}/projects/${requiredId(projectId, "Project ID")}`),
	createProject: (body) =>
		API.post(`${BASE}/projects`, body),
	updateProject: (projectId, body) =>
		API.put(`${BASE}/projects/${requiredId(projectId, "Project ID")}`, body),
	deleteProject: (projectId, rowVersion) =>
		API.delete(`${BASE}/projects/${requiredId(projectId, "Project ID")}`, {
			params: cleanParams({ rowVersion }),
		}),
	addProjectProduct: (projectId, body) =>
		API.post(
			`${BASE}/projects/${requiredId(projectId, "Project ID")}/products`,
			body
		),
	updateProjectProduct: (projectId, productId, body) =>
		API.put(
			`${BASE}/projects/${requiredId(projectId, "Project ID")}/products/${requiredId(productId, "Product ID")}`,
			body
		),
	deleteProjectProduct: (projectId, productId, rowVersion) =>
		API.delete(
			`${BASE}/projects/${requiredId(projectId, "Project ID")}/products/${requiredId(productId, "Product ID")}`,
			{ params: cleanParams({ rowVersion }) }
		),

	listProcessingUnits: (params = {}) =>
		API.get(`${BASE}/processing-units`, { params: cleanParams(params) }),
	createProcessingUnit: (body) =>
		API.post(`${BASE}/processing-units`, body),
	updateProcessingUnit: (id, body) =>
		API.put(`${BASE}/processing-units/${requiredId(id, "Processing Unit ID")}`, body),


	listVendors: (params = {}) =>
		API.get(`${BASE}/vendors`, { params: cleanParams(params) }),
	createVendor: (body) =>
		API.post(`${BASE}/vendors`, body),
	updateVendor: (id, body) =>
		API.put(`${BASE}/vendors/${requiredId(id, "Vendor ID")}`, body),

	metadata: () => API.get(`${BASE}/meta`),

	/* =============================== BOM =============================== */
	listBoms: (params = {}) =>
		API.get(`${BASE}/boms`, { params: cleanParams(params) }),
	getBom: (id) =>
		API.get(`${BASE}/boms/${requiredId(id, "BOM ID")}`),
	createBom: (body) =>
		API.post(`${BASE}/boms`, body),
	updateBom: (id, body) =>
		API.put(`${BASE}/boms/${requiredId(id, "BOM ID")}`, body),
	deleteDraftBom: (id, rowVersion) =>
		API.delete(`${BASE}/boms/${requiredId(id, "BOM ID")}`, {
			params: cleanParams({ rowVersion }),
		}),
	addBomLine: (id, body) =>
		API.post(`${BASE}/boms/${requiredId(id, "BOM ID")}/lines`, body),
	updateBomLine: (id, lineId, body) =>
		API.put(
			`${BASE}/boms/${requiredId(id, "BOM ID")}/lines/${requiredId(lineId, "BOM line ID")}`,
			body
		),
	deleteBomLine: (id, lineId, rowVersion) =>
		API.delete(
			`${BASE}/boms/${requiredId(id, "BOM ID")}/lines/${requiredId(lineId, "BOM line ID")}`,
			{ params: cleanParams({ rowVersion }) }
		),
	submitBom: (id, body) =>
		API.post(`${BASE}/boms/${requiredId(id, "BOM ID")}/submit`, body),
	productionReviewBom: (id, body) =>
		API.post(`${BASE}/boms/${requiredId(id, "BOM ID")}/production-review`, body),
	productionReturnBom: (id, body) =>
		API.post(`${BASE}/boms/${requiredId(id, "BOM ID")}/production-return`, body),
	createBomRevision: (id, body) =>
		API.post(`${BASE}/boms/${requiredId(id, "BOM ID")}/revisions`, body),

	listBomRoutes: (id) =>
		API.get(`${BASE}/boms/${requiredId(id, "BOM ID")}/routes`),
	addBomRouteStep: (id, lineId, body) =>
		API.post(
			`${BASE}/boms/${requiredId(id, "BOM ID")}/lines/${requiredId(lineId, "BOM line ID")}/route-steps`,
			body
		),
	updateBomRouteStep: (id, lineId, stepId, body) =>
		API.put(
			`${BASE}/boms/${requiredId(id, "BOM ID")}/lines/${requiredId(lineId, "BOM line ID")}/route-steps/${requiredId(stepId, "Route step ID")}`,
			body
		),
	deleteBomRouteStep: (id, lineId, stepId, rowVersion) =>
		API.delete(
			`${BASE}/boms/${requiredId(id, "BOM ID")}/lines/${requiredId(lineId, "BOM line ID")}/route-steps/${requiredId(stepId, "Route step ID")}`,
			{ params: cleanParams({ rowVersion }) }
		),

	/* ========================= MR / STORE / PI ========================= */
	listRequisitions: (params = {}) =>
		API.get(`${BASE}/requisitions`, { params: cleanParams(params) }),
	getRequisition: (id) =>
		API.get(`${BASE}/requisitions/${requiredId(id, "Requisition ID")}`),
	getRequisitionPlanning: (id) =>
		API.get(`${BASE}/requisitions/${requiredId(id, "Requisition ID")}/planning`),
	createRequisition: (body) =>
		API.post(`${BASE}/requisitions`, body),
	deleteDraftRequisition: (id, rowVersion) =>
		API.delete(`${BASE}/requisitions/${requiredId(id, "Requisition ID")}`, {
			params: cleanParams({ rowVersion }),
		}),
	submitRequisition: (id, body) =>
		API.post(`${BASE}/requisitions/${requiredId(id, "Requisition ID")}/submit`, body),
	cancelRequisition: (id, body) =>
		API.post(`${BASE}/requisitions/${requiredId(id, "Requisition ID")}/cancel`, body),

	listPurchaseIndents: (params = {}) =>
		API.get(`${BASE}/purchase-indents`, { params: cleanParams(params) }),

	listStoreQueue: (params = {}) =>
		API.get(`${BASE}/store/requisitions`, { params: cleanParams(params) }),
	forwardRequisitionToMainStore: (id, body) =>
		API.post(
			`${BASE}/store/requisitions/${requiredId(id, "Requisition ID")}/forward-to-main-store`,
			body
		),
	getStoreReview: (id) =>
		API.get(`${BASE}/store/requisitions/${requiredId(id, "Requisition ID")}`),
	getStoreAvailability: (id) =>
		API.get(`${BASE}/store/requisitions/${requiredId(id, "Requisition ID")}/availability`),
	submitStoreReview: (id, body) =>
		API.post(`${BASE}/store/requisitions/${requiredId(id, "Requisition ID")}/review`, body),
	issueStoreReservation: (reservationId, body) =>
		API.post(
			`${BASE}/store/reservations/${requiredId(reservationId, "Reservation ID")}/issue`,
			body
		),
	receiveStoreReservation: (reservationId, body) =>
		API.post(
			`${BASE}/store/reservations/${requiredId(reservationId, "Reservation ID")}/receive`,
			body
		),
	releaseReservation: (id, body) =>
		API.post(`${BASE}/reservations/${requiredId(id, "Reservation ID")}/release`, body),

	/* =========================== PROCUREMENT =========================== */
	listPurchaseOrders: (params = {}) =>
		API.get(`${BASE}/purchase-orders`, { params: cleanParams(params) }),
	createPurchaseOrder: (body) =>
		API.post(`${BASE}/purchase-orders`, body),

	listGoodsReceipts: (params = {}) =>
		API.get(`${BASE}/grns`, { params: cleanParams(params) }),
	createGoodsReceipt: (body) =>
		API.post(`${BASE}/grns`, body),

	/* =============================== QC ================================ */
	listQcInspections: (params = {}) =>
		API.get(`${BASE}/qc`, { params: cleanParams(params) }),
	decideQc: (id, body) =>
		API.post(`${BASE}/qc/${requiredId(id, "QC record ID")}/decision`, body),
	uploadQcPhoto: (id, file) => {
		const formData = new FormData();
		formData.append("file", file);
		return API.post(
			`${BASE}/qc/${requiredId(id, "QC record ID")}/photo`,
			formData
		);
	},
	getQcPhoto: (id) =>
		API.get(`${BASE}/qc/${requiredId(id, "QC record ID")}/photo`, { responseType: "blob" }),
	/* ========================== RETURNS ONLY =========================== */
	listMaterialReturns: (params = {}) =>
		API.get(`${BASE}/material-returns`, { params: cleanParams(params) }),
	createMaterialReturn: (body) =>
		API.post(`${BASE}/material-returns`, body),
	deleteDraftMaterialReturn: (id, rowVersion) =>
		API.delete(`${BASE}/material-returns/${requiredId(id, "Material return ID")}`, {
			params: cleanParams({ rowVersion }),
		}),
	dispatchMaterialReturn: (id, body) =>
		API.post(`${BASE}/material-returns/${requiredId(id, "Material return ID")}/dispatch`, body),
	receiveMaterialReturn: (id, body) =>
		API.post(`${BASE}/material-returns/${requiredId(id, "Material return ID")}/receive`, body),

	/* ================= PROCESSING / PRODUCTION ================= */
	listProcessingJobs: (params = {}) =>
		API.get(`${BASE}/processing-jobs`, { params: cleanParams(params) }),
	startProcessingJob: (id, body) =>
		API.post(`${BASE}/processing-jobs/${requiredId(id, "Processing job ID")}/start`, body),
	completeProcessingJob: (id, body) =>
		API.post(`${BASE}/processing-jobs/${requiredId(id, "Processing job ID")}/complete`, body),

	receiveProductionMaterial: (reservationId, body) =>
		API.post(
			`${BASE}/production/reservations/${requiredId(reservationId, "Reservation ID")}/receive`,
			body
		),
	startProduction: (id, body) =>
		API.post(`${BASE}/requisitions/${requiredId(id, "Requisition ID")}/production/start`, body),
	completeProduction: (id, body) =>
		API.post(`${BASE}/requisitions/${requiredId(id, "Requisition ID")}/production/complete`, body),
	recordProductionWaste: (body) =>
		API.post(`${BASE}/production-wastages`, body),
	listConsumptions: (params = {}) =>
		API.get(`${BASE}/production-consumptions`, { params: cleanParams(params) }),
	createConsumption: (body) =>
		API.post(`${BASE}/production-consumptions`, body),

	/* ================= EXCEPTIONS / RECOVERY ================= */
	listWorkflowExceptions: (params = {}) =>
		API.get(`${BASE}/exceptions`, { params: cleanParams(params) }),
	getWorkflowException: (id) =>
		API.get(`${BASE}/exceptions/${requiredId(id, "Exception ID")}`),
	downloadWorkflowExceptionRegisterPdf: (params = {}) =>
		API.get(`${BASE}/exceptions/report.pdf`, {
			params: cleanParams(params),
			responseType: "blob",
		}),
	downloadWorkflowExceptionCasePdf: (id) =>
		API.get(`${BASE}/exceptions/${requiredId(id, "Exception ID")}/report.pdf`, {
			responseType: "blob",
		}),
	createWorkflowException: (body) =>
		API.post(`${BASE}/exceptions`, body),
	containWorkflowException: (id, body = {}) =>
		API.post(`${BASE}/exceptions/${requiredId(id, "Exception ID")}/contain`, body),
	startWorkflowExceptionRecovery: (id, body = {}) =>
		API.post(`${BASE}/exceptions/${requiredId(id, "Exception ID")}/recovery`, body),
	addWorkflowExceptionNote: (id, body) =>
		API.post(`${BASE}/exceptions/${requiredId(id, "Exception ID")}/notes`, body),
	resolveWorkflowException: (id, body) =>
		API.post(`${BASE}/exceptions/${requiredId(id, "Exception ID")}/resolve`, body),
	reopenWorkflowException: (id, body) =>
		API.post(`${BASE}/exceptions/${requiredId(id, "Exception ID")}/reopen`, body),

	/* ========================= READ MODELS ========================= */
	dashboardReport: (params = {}) =>
		API.get(`${BASE}/reports/dashboard`, { params: cleanParams(params) }),
	projectReport: (projectDrawingId) =>
		API.get(`${BASE}/reports/products/${requiredId(projectDrawingId, "Product ID")}`),
	shortageReport: (params = {}) =>
		API.get(`${BASE}/reports/shortages`, { params: cleanParams(params) }),
	materialMovementAudit: (params = {}) =>
		// Backend route name is retained for compatibility; the payload is a workflow movement audit, not a stock/location screen.
		API.get(`${BASE}/reports/stock-ledger`, { params: cleanParams(params) }),
	/** @deprecated Use materialMovementAudit. */
	stockLedger: (params = {}) =>
		API.get(`${BASE}/reports/stock-ledger`, { params: cleanParams(params) }),
	auditLogs: (params = {}) =>
		API.get(`${BASE}/reports/audit`, { params: cleanParams(params) }),

	productionReadiness: (params = {}) =>
		API.get(`${BASE}/production-readiness`, { params: cleanParams(params) }),
	getTracker: (params = {}) =>
		API.get(`${BASE}/tracker`, { params: cleanParams(params) }),
	getTrackerDetail: (id) =>
		API.get(`${BASE}/tracker/requisitions/${requiredId(id, "Requisition ID")}`),
	getMaterialTracker: (materialId, params = {}) =>
		API.get(`${BASE}/tracker/materials/${requiredId(materialId, "Material ID")}`, {
			params: cleanParams(params),
		}),

	materialRegister: (params = {}) =>
		API.get(`${BASE}/material-register`, { params: cleanParams(params) }),
	integrity: (params = {}) =>
		API.get(`${BASE}/admin/integrity`, { params: cleanParams(params) }),
};
