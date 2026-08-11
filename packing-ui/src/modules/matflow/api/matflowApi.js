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

	if (!id) {
		throw new Error(`${label} is required.`);
	}

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

	if (typeof data === "string") {
		return data;
	}

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
 * Compatibility adapter for screens that still consume the historical
 * "ProjectDrawing" flat list (most importantly Operational BOM creation).
 *
 * The authoritative project API is now:
 *     Project -> Products
 *     GET /matflow/project-portfolio
 *
 * Do not call the removed /matflow/projects endpoint. Instead, flatten each
 * Product child into the legacy shape while retaining the real Product UUID as
 * `id` / `projectDrawingId`, because BOMs are owned by Product/Drawing records.
 */
const flattenProjectPortfolioProducts = (portfolio, params = {}) => {
	const projects = Array.isArray(portfolio) ? portfolio : [];
	const requestedActive =
		typeof params?.active === "boolean" ? params.active : undefined;

	return projects.flatMap((project) => {
		const products = Array.isArray(project?.products) ? project.products : [];

		return products
			.filter(
				(product) =>
					requestedActive === undefined ||
					Boolean(product?.active) === requestedActive
			)
			.map((product) => ({
				// IMPORTANT: the Product/Drawing UUID, not the parent Project UUID.
				id: product?.id ?? null,
				projectDrawingId: product?.id ?? null,

				// Parent Project ownership/snapshot fields.
				projectId: project?.id ?? null,
				projectCode: project?.projectCode ?? "",
				projectName: project?.projectName ?? "",
				clientName: project?.clientName ?? "",
				plantCode: project?.plantCode ?? "",
				priority: project?.priority ?? null,
				projectManager: project?.projectManager ?? null,

				// Product / Drawing fields.
				productName: product?.productName ?? "",
				drawingNo: product?.drawingNo ?? "",
				drawingRevision: product?.drawingRevision ?? "0",
				requiredDate:
					product?.requiredDate ?? project?.requiredDate ?? null,
				active: product?.active !== false,

				// Director approval state.
				productApprovalStatus:
					product?.approvalStatus ?? null,
				approvalStatus:
					product?.approvalStatus ?? null,
				productApprovedBy:
					product?.approvedBy ?? null,
				approvedBy:
					product?.approvedBy ?? null,
				productApprovedAt:
					product?.approvedAt ?? null,
				approvedAt:
					product?.approvedAt ?? null,
				productReturnedBy:
					product?.returnedBy ?? null,
				returnedBy:
					product?.returnedBy ?? null,
				productReturnedAt:
					product?.returnedAt ?? null,
				returnedAt:
					product?.returnedAt ?? null,
				productApprovalRemarks:
					product?.approvalRemarks ?? null,
				approvalRemarks:
					product?.approvalRemarks ?? null,

				// Latest BOM readiness, useful to callers that already display it.
				latestBomId: product?.latestBomId ?? null,
				latestBomNumber: product?.latestBomNumber ?? null,
				latestBomRevision: product?.latestBomRevision ?? null,
				latestBomStatus: product?.latestBomStatus ?? null,
				latestBomEffective: product?.latestBomEffective === true,

				// Concurrency/audit fields.
				rowVersion: product?.rowVersion ?? null,
				createdAt: product?.createdAt ?? null,
				updatedAt: product?.updatedAt ?? null,
			}));
	});
};

/**
 * Historical `listProjects()` compatibility contract.
 *
 * It intentionally returns an Axios-like response object so every existing
 * caller can keep doing `response?.data` without changes.
 */
const listProjectProductsCompat = async (params = {}) => {
	const requestParams = cleanParams({
		search: params?.search,
		plantCode: params?.plantCode,
		// Parent active state is still useful server-side. Product active state is
		// filtered again after flattening.
		active: params?.active,
	});

	const response = await API.get(`${BASE}/project-portfolio`, {
		params: requestParams,
	});

	return {
		...response,
		data: flattenProjectPortfolioProducts(response?.data, params),
	};
};

export const matflowApi = {
	/* ============================================================
	 * MASTER DATA
	 * ============================================================ */

	listMaterials: (params = {}) =>
		API.get(`${BASE}/materials`, {
			params: cleanParams(params),
		}),

	createMaterial: (body) =>
		API.post(`${BASE}/materials`, body),

	updateMaterial: (id, body) =>
		API.put(
			`${BASE}/materials/${requiredId(id, "Material ID")}`,
			body
		),

	// True Project -> Products aggregate (vNext primary project API)
	listProjectPortfolio: (params = {}) =>
		API.get(`${BASE}/project-portfolio`, {
			params: cleanParams(params),
		}),

	getProjectPortfolio: (projectId) =>
		API.get(`${BASE}/project-portfolio/${requiredId(projectId, "Project ID")}`),

	createProjectPortfolio: (body) =>
		API.post(`${BASE}/project-portfolio`, body),

	updateProjectPortfolio: (projectId, body) =>
		API.put(`${BASE}/project-portfolio/${requiredId(projectId, "Project ID")}`, body),

	deleteProjectPortfolio: (projectId, rowVersion) =>
		API.delete(
			`${BASE}/project-portfolio/${requiredId(projectId, "Project ID")}`,
			{ params: cleanParams({ rowVersion }) }
		),

	addProjectProduct: (projectId, body) =>
		API.post(`${BASE}/project-portfolio/${requiredId(projectId, "Project ID")}/products`, body),

	updateProjectProduct: (projectId, productId, body) =>
		API.put(
			`${BASE}/project-portfolio/${requiredId(projectId, "Project ID")}/products/${requiredId(productId, "Product ID")}`,
			body
		),

	deleteProjectProduct: (projectId, productId, rowVersion) =>
		API.delete(
			`${BASE}/project-portfolio/${requiredId(projectId, "Project ID")}/products/${requiredId(productId, "Product ID")}`,
			{ params: cleanParams({ rowVersion }) }
		),

	approvePortfolioProduct: (projectId, productId, body) =>
		API.post(
			`${BASE}/project-portfolio/${requiredId(projectId, "Project ID")}/products/${requiredId(productId, "Product ID")}/approve`,
			body
		),

	returnPortfolioProduct: (projectId, productId, body) =>
		API.post(
			`${BASE}/project-portfolio/${requiredId(projectId, "Project ID")}/products/${requiredId(productId, "Product ID")}/return`,
			body
		),

	/*
	 * Backward-compatible flat Product/Drawing list.
	 *
	 * IMPORTANT:
	 * /api/matflow/projects no longer exists in the vNext hierarchy.
	 * Read the authoritative Project Portfolio and flatten Product children.
	 */
	listProjects: (params = {}) =>
		listProjectProductsCompat(params),

	createProject: (body) =>
		API.post(`${BASE}/projects`, body),

	updateProject: (id, body) =>
		API.put(
			`${BASE}/projects/${requiredId(id, "Project drawing ID")}`,
			body
		),

	approveProjectProduct: (id, body) =>
		API.post(
			`${BASE}/projects/${requiredId(
				id,
				"Project drawing ID"
			)}/approve-product`,
			body
		),

	returnProjectProduct: (id, body) =>
		API.post(
			`${BASE}/projects/${requiredId(
				id,
				"Project drawing ID"
			)}/return-product`,
			body
		),

	listLocations: (params = {}) =>
		API.get(`${BASE}/locations`, {
			params: cleanParams(params),
		}),

	createLocation: (body) =>
		API.post(`${BASE}/locations`, body),

	updateLocation: (id, body) =>
		API.put(
			`${BASE}/locations/${requiredId(id, "Location ID")}`,
			body
		),

	listStock: (params = {}) =>
		API.get(`${BASE}/stock`, {
			params: cleanParams(params),
		}),

	adjustStock: (body) =>
		API.post(`${BASE}/stock/adjustments`, body),

	listVendors: (params = {}) =>
		API.get(`${BASE}/vendors`, {
			params: cleanParams(params),
		}),

	createVendor: (body) =>
		API.post(`${BASE}/vendors`, body),

	updateVendor: (id, body) =>
		API.put(
			`${BASE}/vendors/${requiredId(id, "Vendor ID")}`,
			body
		),

	metadata: () =>
		API.get(`${BASE}/meta`),

	/* ============================================================
	 * BOM + ROUTING
	 * ============================================================ */

	listBoms: (params = {}) =>
		API.get(`${BASE}/boms`, {
			params: cleanParams(params),
		}),

	getBom: (id) =>
		API.get(
			`${BASE}/boms/${requiredId(id, "BOM ID")}`
		),

	createBom: (body) =>
		API.post(`${BASE}/boms`, body),

	updateBom: (id, body) =>
		API.put(
			`${BASE}/boms/${requiredId(id, "BOM ID")}`,
			body
		),

	deleteDraftBom: (id, rowVersion) =>
		API.delete(
			`${BASE}/boms/${requiredId(id, "BOM ID")}`,
			{ params: cleanParams({ rowVersion }) }
		),

	addBomLine: (id, body) =>
		API.post(
			`${BASE}/boms/${requiredId(id, "BOM ID")}/lines`,
			body
		),

	updateBomLine: (id, lineId, body) =>
		API.put(
			`${BASE}/boms/${requiredId(
				id,
				"BOM ID"
			)}/lines/${requiredId(
				lineId,
				"BOM line ID"
			)}`,
			body
		),

	deleteBomLine: (id, lineId, rowVersion) =>
		API.delete(
			`${BASE}/boms/${requiredId(
				id,
				"BOM ID"
			)}/lines/${requiredId(
				lineId,
				"BOM line ID"
			)}`,
			{
				params: cleanParams({
					rowVersion,
				}),
			}
		),

	submitBom: (id, body) =>
		API.post(
			`${BASE}/boms/${requiredId(id, "BOM ID")}/submit`,
			body
		),

	productionApproveBom: (id, body) =>
		API.post(
			`${BASE}/boms/${requiredId(
				id,
				"BOM ID"
			)}/production-approve`,
			body
		),

	productionReturnBom: (id, body) =>
		API.post(
			`${BASE}/boms/${requiredId(
				id,
				"BOM ID"
			)}/production-return`,
			body
		),

	directorApproveBom: (id, body) =>
		API.post(
			`${BASE}/boms/${requiredId(id, "BOM ID")}/director-approve`,
			body
		),

	directorReturnBom: (id, body) =>
		API.post(
			`${BASE}/boms/${requiredId(id, "BOM ID")}/director-return`,
			body
		),

	createBomRevision: (id, body) =>
		API.post(
			`${BASE}/boms/${requiredId(
				id,
				"BOM ID"
			)}/revisions`,
			body
		),

	listBomRoutes: (id) =>
		API.get(
			`${BASE}/boms/${requiredId(
				id,
				"BOM ID"
			)}/routes`
		),

	addBomRouteStep: (id, lineId, body) =>
		API.post(
			`${BASE}/boms/${requiredId(
				id,
				"BOM ID"
			)}/lines/${requiredId(
				lineId,
				"BOM line ID"
			)}/route-steps`,
			body
		),

	updateBomRouteStep: (
		id,
		lineId,
		stepId,
		body
	) =>
		API.put(
			`${BASE}/boms/${requiredId(
				id,
				"BOM ID"
			)}/lines/${requiredId(
				lineId,
				"BOM line ID"
			)}/route-steps/${requiredId(
				stepId,
				"Route step ID"
			)}`,
			body
		),

	deleteBomRouteStep: (
		id,
		lineId,
		stepId,
		rowVersion
	) =>
		API.delete(
			`${BASE}/boms/${requiredId(
				id,
				"BOM ID"
			)}/lines/${requiredId(
				lineId,
				"BOM line ID"
			)}/route-steps/${requiredId(
				stepId,
				"Route step ID"
			)}`,
			{
				params: cleanParams({
					rowVersion,
				}),
			}
		),

	/* ============================================================
	 * REQUISITIONS + STORE
	 * ============================================================ */

	listRequisitions: (params = {}) =>
		API.get(`${BASE}/requisitions`, {
			params: cleanParams(params),
		}),

	getRequisition: (id) =>
		API.get(
			`${BASE}/requisitions/${requiredId(
				id,
				"Requisition ID"
			)}`
		),

	getRequisitionPlanning: (id) =>
		API.get(
			`${BASE}/requisitions/${requiredId(
				id,
				"Requisition ID"
			)}/planning`
		),

	createRequisition: (body) =>
		API.post(`${BASE}/requisitions`, body),

	deleteDraftRequisition: (id, rowVersion) =>
		API.delete(
			`${BASE}/requisitions/${requiredId(id, "Requisition ID")}`,
			{ params: cleanParams({ rowVersion }) }
		),

	submitRequisition: (id, body) =>
		API.post(
			`${BASE}/requisitions/${requiredId(
				id,
				"Requisition ID"
			)}/submit`,
			body
		),

	cancelRequisition: (id, body) =>
		API.post(
			`${BASE}/requisitions/${requiredId(
				id,
				"Requisition ID"
			)}/cancel`,
			body
		),

	decidePartialAvailability: (id, body) =>
		API.post(
			`${BASE}/requisitions/${requiredId(
				id,
				"Requisition ID"
			)}/partial-availability-decision`,
			body
		),

	listStoreQueue: (params = {}) =>
		API.get(`${BASE}/store/requisitions`, {
			params: cleanParams(params),
		}),

	getStoreReview: (id) =>
		API.get(
			`${BASE}/store/requisitions/${requiredId(
				id,
				"Requisition ID"
			)}`
		),

	getStoreAvailability: (id) =>
		API.get(
			`${BASE}/store/requisitions/${requiredId(
				id,
				"Requisition ID"
			)}/availability`
		),

	submitStoreReview: (id, body) =>
		API.post(
			`${BASE}/store/requisitions/${requiredId(
				id,
				"Requisition ID"
			)}/review`,
			body
		),

	issueStoreReservation: (id, body) =>
		API.post(
			`${BASE}/store/reservations/${requiredId(
				id,
				"Reservation ID"
			)}/issue`,
			body
		),

	releaseReservation: (id, body) =>
		API.post(
			`${BASE}/reservations/${requiredId(
				id,
				"Reservation ID"
			)}/release`,
			body
		),

	submitIndent: (id, body) =>
		API.patch(
			`${BASE}/indents/${requiredId(
				id,
				"Indent ID"
			)}/submit-to-purchase`,
			body
		),

	/* ============================================================
	 * PROCUREMENT
	 * ============================================================ */

	listPurchaseOrders: (params = {}) =>
		API.get(`${BASE}/purchase-orders`, {
			params: cleanParams(params),
		}),

	createPurchaseOrder: (body) =>
		API.post(`${BASE}/purchase-orders`, body),

	deleteDraftPurchaseOrder: (id, rowVersion) =>
		API.delete(
			`${BASE}/purchase-orders/${requiredId(id, "Purchase order ID")}`,
			{ params: cleanParams({ rowVersion }) }
		),

	approvePurchaseOrder: (id, body) =>
		API.post(
			`${BASE}/purchase-orders/${requiredId(
				id,
				"Purchase order ID"
			)}/approve`,
			body
		),

	listGoodsReceipts: (params = {}) =>
		API.get(`${BASE}/grns`, {
			params: cleanParams(params),
		}),

	createGoodsReceipt: (body) =>
		API.post(`${BASE}/grns`, body),

	/* ============================================================
	 * QUALITY CONTROL
	 * ============================================================ */

	listQcInspections: (params = {}) =>
		API.get(`${BASE}/qc`, {
			params: cleanParams(params),
		}),

	decideQc: (id, body) =>
		API.post(
			`${BASE}/qc/${requiredId(
				id,
				"QC inspection ID"
			)}/decision`,
			body
		),

	listQcRouting: () =>
		API.get(`${BASE}/qc-routing`),

	getQcRouting: (id) =>
		API.get(`${BASE}/qc/${requiredId(id, "QC inspection ID")}/routing`),

	routeQcMaterial: (id, body) =>
		API.post(
			`${BASE}/qc/${requiredId(id, "QC inspection ID")}/route`,
			body
		),

	returnQcToVendor: (id, body) =>
		API.post(
			`${BASE}/qc/${requiredId(
				id,
				"QC inspection ID"
			)}/return-to-vendor`,
			body
		),

	listQcDispositions: (params = {}) =>
		API.get(`${BASE}/qc-dispositions`, {
			params: cleanParams(params),
		}),

	decideQcDisposition: (inspectionId, body) =>
		API.post(
			`${BASE}/qc-dispositions/${requiredId(
				inspectionId,
				"QC inspection ID"
			)}`,
			body
		),

	/* ============================================================
	 * TRANSFERS + RETURNS
	 * ============================================================ */

	listTransfers: (params = {}) =>
		API.get(`${BASE}/transfers`, {
			params: cleanParams(params),
		}),

	getTransfer: (id) =>
		API.get(
			`${BASE}/transfers/${requiredId(
				id,
				"Transfer ID"
			)}`
		),

	dispatchTransfer: (id, body) =>
		API.post(
			`${BASE}/transfers/${requiredId(
				id,
				"Transfer ID"
			)}/dispatch`,
			body
		),

	receiveTransfer: (id, body) =>
		API.post(
			`${BASE}/transfers/${requiredId(
				id,
				"Transfer ID"
			)}/receive`,
			body
		),

	listMaterialReturns: (params = {}) =>
		API.get(`${BASE}/material-returns`, {
			params: cleanParams(params),
		}),

	createMaterialReturn: (body) =>
		API.post(`${BASE}/material-returns`, body),

	deleteDraftMaterialReturn: (id, rowVersion) =>
		API.delete(
			`${BASE}/material-returns/${requiredId(id, "Material return ID")}`,
			{ params: cleanParams({ rowVersion }) }
		),

	dispatchMaterialReturn: (id, body) =>
		API.post(
			`${BASE}/material-returns/${requiredId(
				id,
				"Material return ID"
			)}/dispatch`,
			body
		),

	receiveMaterialReturn: (id, body) =>
		API.post(
			`${BASE}/material-returns/${requiredId(
				id,
				"Material return ID"
			)}/receive`,
			body
		),

	/* ============================================================
	 * PROCESSING + PRODUCTION
	 * ============================================================ */

	listProcessingJobs: (params = {}) =>
		API.get(`${BASE}/processing-jobs`, {
			params: cleanParams(params),
		}),

	createProcessingJob: (body) =>
		API.post(`${BASE}/processing-jobs`, body),

	deletePendingProcessingJob: (id, rowVersion) =>
		API.delete(
			`${BASE}/processing-jobs/${requiredId(id, "Processing job ID")}`,
			{ params: cleanParams({ rowVersion }) }
		),

	startProcessingJob: (id, body) =>
		API.post(
			`${BASE}/processing-jobs/${requiredId(
				id,
				"Processing job ID"
			)}/start`,
			body
		),

	completeProcessingJob: (id, body) =>
		API.post(
			`${BASE}/processing-jobs/${requiredId(
				id,
				"Processing job ID"
			)}/complete`,
			body
		),

	startProduction: (id, body) =>
		API.post(
			`${BASE}/requisitions/${requiredId(
				id,
				"Requisition ID"
			)}/production/start`,
			body
		),

	completeProduction: (id, body) =>
		API.post(
			`${BASE}/requisitions/${requiredId(
				id,
				"Requisition ID"
			)}/production/complete`,
			body
		),

	listConsumptions: (params = {}) =>
		API.get(`${BASE}/production-consumptions`, {
			params: cleanParams(params),
		}),

	createConsumption: (body) =>
		API.post(`${BASE}/production-consumptions`, body),

	/* ============================================================
	 * INSIGHT / PROFESSIONAL TRACKER
	 * ============================================================ */

	dashboardReport: (params = {}) =>
		API.get(`${BASE}/reports/dashboard`, {
			params: cleanParams(params),
		}),

	projectReport: (projectDrawingId) =>
		API.get(
			`${BASE}/reports/projects/${requiredId(
				projectDrawingId,
				"Project drawing ID"
			)}`
		),

	shortageReport: (params = {}) =>
		API.get(`${BASE}/reports/shortages`, {
			params: cleanParams(params),
		}),

	stockLedger: (params = {}) =>
		API.get(`${BASE}/reports/stock-ledger`, {
			params: cleanParams(params),
		}),

	auditLogs: (params = {}) =>
		API.get(`${BASE}/reports/audit`, {
			params: cleanParams(params),
		}),

	/*
	 * Main professional Project & Material Tracker.
	 *
	 * GET /api/matflow/tracker
	 */
	getTracker: (params = {}) =>
		API.get(`${BASE}/tracker`, {
			params: cleanParams(params),
		}),

	/*
	 * Professional requisition-level tracker.
	 *
	 * Expected to expose:
	 * - current workflow stage
	 * - current department
	 * - current physical/material location
	 * - stage owner
	 * - stage start
	 * - stage end
	 * - elapsed duration
	 * - total lead time
	 * - material positions
	 * - bottlenecks
	 * - timeline
	 * - next department
	 * - next action
	 *
	 * GET /api/matflow/tracker/requisitions/{id}
	 */
	getTrackerDetail: (id) =>
		API.get(
			`${BASE}/tracker/requisitions/${requiredId(
				id,
				"Requisition ID"
			)}`
		),

	/*
	 * Executive material-centric custody control tower.
	 *
	 * GET /api/matflow/tracker/materials/{materialId}
	 */
	getMaterialTracker: (materialId, params = {}) =>
		API.get(
			`${BASE}/tracker/materials/${requiredId(
				materialId,
				"Material ID"
			)}`,
			{ params: cleanParams(params) }
		),

	integrity: (params = {}) =>
		API.get(`${BASE}/admin/integrity`, {
			params: cleanParams(params),
		}),
};

export default matflowApi;