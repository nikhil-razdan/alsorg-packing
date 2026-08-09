import API from "../../../services/api";

const BASE = "/matflow";

const cleanParams = (params = {}) => Object.fromEntries(
	Object.entries(params).filter(([, value]) =>
		value !== undefined && value !== null && value !== ""
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
		data?.message || data?.detail || data?.error || error?.message || fallback;

	return validationErrors.length
		? [message, ...validationErrors].join(" | ")
		: message;
};

export const matflowApi = {
	/* Master data */
	listMaterials: (params = {}) =>
		API.get(`${BASE}/materials`, { params: cleanParams(params) }),
	createMaterial: (body) => API.post(`${BASE}/materials`, body),
	updateMaterial: (id, body) =>
		API.put(`${BASE}/materials/${requiredId(id, "Material ID")}`, body),

	listProjects: (params = {}) =>
		API.get(`${BASE}/projects`, { params: cleanParams(params) }),
	createProject: (body) => API.post(`${BASE}/projects`, body),
	updateProject: (id, body) =>
		API.put(`${BASE}/projects/${requiredId(id, "Project drawing ID")}`, body),
	approveProjectProduct: (id, body) =>
		API.post(`${BASE}/projects/${requiredId(id, "Project drawing ID")}/approve-product`, body),
	returnProjectProduct: (id, body) =>
		API.post(`${BASE}/projects/${requiredId(id, "Project drawing ID")}/return-product`, body),

	listLocations: (params = {}) =>
		API.get(`${BASE}/locations`, { params: cleanParams(params) }),
	createLocation: (body) => API.post(`${BASE}/locations`, body),
	updateLocation: (id, body) =>
		API.put(`${BASE}/locations/${requiredId(id, "Location ID")}`, body),

	listStock: (params = {}) =>
		API.get(`${BASE}/stock`, { params: cleanParams(params) }),
	adjustStock: (body) => API.post(`${BASE}/stock/adjustments`, body),

	listVendors: (params = {}) =>
		API.get(`${BASE}/vendors`, { params: cleanParams(params) }),
	createVendor: (body) => API.post(`${BASE}/vendors`, body),
	updateVendor: (id, body) =>
		API.put(`${BASE}/vendors/${requiredId(id, "Vendor ID")}`, body),
	metadata: () => API.get(`${BASE}/meta`),

	/* BOM + routing */
	listBoms: (params = {}) =>
		API.get(`${BASE}/boms`, { params: cleanParams(params) }),
	getBom: (id) => API.get(`${BASE}/boms/${requiredId(id, "BOM ID")}`),
	createBom: (body) => API.post(`${BASE}/boms`, body),
	updateBom: (id, body) =>
		API.put(`${BASE}/boms/${requiredId(id, "BOM ID")}`, body),
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
			{ params: { rowVersion } }
		),
	submitBom: (id, body) =>
		API.post(`${BASE}/boms/${requiredId(id, "BOM ID")}/submit`, body),
	productionApproveBom: (id, body) =>
		API.post(`${BASE}/boms/${requiredId(id, "BOM ID")}/production-approve`, body),
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
			{ params: { rowVersion } }
		),

	/* Requisition + Store */
	listRequisitions: () => API.get(`${BASE}/requisitions`),
	getRequisition: (id) =>
		API.get(`${BASE}/requisitions/${requiredId(id, "Requisition ID")}`),
	getRequisitionPlanning: (id) =>
		API.get(`${BASE}/requisitions/${requiredId(id, "Requisition ID")}/planning`),
	createRequisition: (body) => API.post(`${BASE}/requisitions`, body),
	submitRequisition: (id, body) =>
		API.post(`${BASE}/requisitions/${requiredId(id, "Requisition ID")}/submit`, body),
	cancelRequisition: (id, body) =>
		API.post(`${BASE}/requisitions/${requiredId(id, "Requisition ID")}/cancel`, body),
	decidePartialAvailability: (id, body) =>
		API.post(`${BASE}/requisitions/${requiredId(id, "Requisition ID")}/partial-availability-decision`, body),
	listStoreQueue: (params = {}) =>
		API.get(`${BASE}/store/requisitions`, { params: cleanParams(params) }),
	getStoreReview: (id) =>
		API.get(`${BASE}/store/requisitions/${requiredId(id, "Requisition ID")}`),
	getStoreAvailability: (id) =>
		API.get(`${BASE}/store/requisitions/${requiredId(id, "Requisition ID")}/availability`),
	submitStoreReview: (id, body) =>
		API.post(`${BASE}/store/requisitions/${requiredId(id, "Requisition ID")}/review`, body),
	issueStoreReservation: (id, body) =>
		API.post(`${BASE}/store/reservations/${requiredId(id, "Reservation ID")}/issue`, body),
	releaseReservation: (id, body) =>
		API.post(`${BASE}/reservations/${requiredId(id, "Reservation ID")}/release`, body),
	submitIndent: (id, body) =>
		API.patch(`${BASE}/indents/${requiredId(id, "Indent ID")}/submit-to-purchase`, body),

	/* Procurement */
	listPurchaseOrders: () => API.get(`${BASE}/purchase-orders`),
	createPurchaseOrder: (body) => API.post(`${BASE}/purchase-orders`, body),
	approvePurchaseOrder: (id, body) =>
		API.post(`${BASE}/purchase-orders/${requiredId(id, "Purchase order ID")}/approve`, body),
	listGoodsReceipts: () => API.get(`${BASE}/grns`),
	createGoodsReceipt: (body) => API.post(`${BASE}/grns`, body),

	/* QC */
	listQcInspections: (params = {}) =>
		API.get(`${BASE}/qc`, { params: cleanParams(params) }),
	decideQc: (id, body) =>
		API.post(`${BASE}/qc/${requiredId(id, "QC inspection ID")}/decision`, body),
	returnQcToVendor: (id, body) =>
		API.post(`${BASE}/qc/${requiredId(id, "QC inspection ID")}/return-to-vendor`, body),
	listQcDispositions: () => API.get(`${BASE}/qc-dispositions`),
	decideQcDisposition: (inspectionId, body) =>
		API.post(`${BASE}/qc-dispositions/${requiredId(inspectionId, "QC inspection ID")}`, body),

	/* Transfers + returns */
	listTransfers: (params = {}) =>
		API.get(`${BASE}/transfers`, { params: cleanParams(params) }),
	getTransfer: (id) =>
		API.get(`${BASE}/transfers/${requiredId(id, "Transfer ID")}`),
	dispatchTransfer: (id, body) =>
		API.post(`${BASE}/transfers/${requiredId(id, "Transfer ID")}/dispatch`, body),
	receiveTransfer: (id, body) =>
		API.post(`${BASE}/transfers/${requiredId(id, "Transfer ID")}/receive`, body),
	listMaterialReturns: () => API.get(`${BASE}/material-returns`),
	createMaterialReturn: (body) => API.post(`${BASE}/material-returns`, body),
	dispatchMaterialReturn: (id, body) =>
		API.post(`${BASE}/material-returns/${requiredId(id, "Material return ID")}/dispatch`, body),
	receiveMaterialReturn: (id, body) =>
		API.post(`${BASE}/material-returns/${requiredId(id, "Material return ID")}/receive`, body),

	/* Processing + Production */
	listProcessingJobs: () => API.get(`${BASE}/processing-jobs`),
	createProcessingJob: (body) => API.post(`${BASE}/processing-jobs`, body),
	startProcessingJob: (id, body) =>
		API.post(`${BASE}/processing-jobs/${requiredId(id, "Processing job ID")}/start`, body),
	completeProcessingJob: (id, body) =>
		API.post(`${BASE}/processing-jobs/${requiredId(id, "Processing job ID")}/complete`, body),
	startProduction: (id, body) =>
		API.post(`${BASE}/requisitions/${requiredId(id, "Requisition ID")}/production/start`, body),
	completeProduction: (id, body) =>
		API.post(`${BASE}/requisitions/${requiredId(id, "Requisition ID")}/production/complete`, body),
	listConsumptions: () => API.get(`${BASE}/production-consumptions`),
	createConsumption: (body) => API.post(`${BASE}/production-consumptions`, body),

	/* Insight */
	dashboardReport: (params = {}) =>
		API.get(`${BASE}/reports/dashboard`, { params: cleanParams(params) }),
	projectReport: (projectDrawingId) =>
		API.get(`${BASE}/reports/projects/${requiredId(projectDrawingId, "Project drawing ID")}`),
	shortageReport: (params = {}) =>
		API.get(`${BASE}/reports/shortages`, { params: cleanParams(params) }),
	stockLedger: (params = {}) =>
		API.get(`${BASE}/reports/stock-ledger`, { params: cleanParams(params) }),
	auditLogs: (params = {}) =>
		API.get(`${BASE}/reports/audit`, { params: cleanParams(params) }),
	getTracker: (params = {}) =>
		API.get(`${BASE}/tracker`, { params: cleanParams(params) }),
	integrity: (params = {}) =>
		API.get(`${BASE}/admin/integrity`, { params: cleanParams(params) }),
};

export default matflowApi;
