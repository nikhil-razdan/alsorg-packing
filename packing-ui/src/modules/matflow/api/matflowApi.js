import API from "../../../services/api";

const BASE = "/matflow";

/*
 * Removes undefined, null and blank-string query parameters.
 * This keeps requests clean and avoids sending values such as:
 *
 * ?status=&plantCode=&search=
 */
const cleanParams = (params = {}) =>
	Object.fromEntries(
		Object.entries(params).filter(
			([, value]) =>
				value !== undefined &&
				value !== null &&
				value !== ""
		)
	);

/*
 * Validates path IDs before the request is made.
 *
 * This prevents accidental requests such as:
 *
 * /boms/undefined
 * /requisitions/null
 */
const requiredId = (
	value,
	label = "ID"
) => {
	const id =
		String(
			value ?? ""
		).trim();

	if (!id) {
		throw new Error(
			`${label} is required.`
		);
	}

	return encodeURIComponent(
		id
	);
};

/*
 * =========================================================
 * COMMON RESPONSE HELPERS
 * =========================================================
 */

/*
 * Supports:
 *
 * 1. Plain arrays:
 *    [...]
 *
 * 2. Spring Page:
 *    {
 *      content: [],
 *      number: 0,
 *      size: 20,
 *      totalElements: 100,
 *      totalPages: 5
 *    }
 *
 * 3. Generic rows:
 *    {
 *      rows: []
 *    }
 *
 * 4. Generic data wrapper:
 *    {
 *      data: []
 *    }
 */
export const extractMatFlowPage = (
	data
) => {
	if (
		Array.isArray(
			data
		)
	) {
		return {
			rows: data,

			page: 0,

			size:
				data.length,

			totalElements:
				data.length,

			totalPages:
				data.length
					? 1
					: 0,
		};
	}

	const rows =
		Array.isArray(
			data?.content
		)
			? data.content
			: Array.isArray(
				data?.rows
			)
				? data.rows
				: Array.isArray(
					data?.data
				)
					? data.data
					: [];

	return {
		rows,

		page:
			Number(
				data?.number ??
				data?.page ??
				0
			),

		size:
			Number(
				data?.size ??
				rows.length
			),

		totalElements:
			Number(
				data?.totalElements ??
				rows.length
			),

		totalPages:
			Number(
				data?.totalPages ??
				(
					rows.length
						? 1
						: 0
				)
			),
	};
};

/*
 * Reads both the new MatFlowApiError contract and
 * normal Spring / Axios error payloads.
 */
export const readMatFlowError = (
	error,
	fallback =
		"The MatFlow request failed."
) => {
	const data =
		error?.response?.data;

	if (
		typeof data ===
		"string"
	) {
		return data;
	}

	const validationErrors =
		data?.validationErrors &&
			typeof data.validationErrors ===
			"object"
			? Object.entries(
				data.validationErrors
			).map(
				(
					[
						field,
						message,
					]
				) =>
					`${field}: ${message}`
			)
			: [];

	const message =
		data?.message ||
		data?.detail ||
		data?.error ||
		error?.message ||
		fallback;

	return validationErrors.length
		? [
			message,
			...validationErrors,
		].join(
			" | "
		)
		: message;
};

/*
 * =========================================================
 * MATFLOW API
 * =========================================================
 *
 * This client is aligned with the refactored backend:
 *
 * - MatFlowMasterDataController
 * - MatFlowBomController
 * - MatFlowRequisitionController
 * - MatFlowProcurementController
 * - MatFlowQcController
 * - MatFlowMovementController
 * - MatFlowProductionController
 * - MatFlowInsightController
 *
 * Old release/HOD/plan/direct-issue endpoints are
 * intentionally not present.
 */
export const matflowApi = {

	/*
	 * =====================================================
	 * MASTER DATA
	 * =====================================================
	 */

	/*
	 * MATERIALS
	 */

	listMaterials(
		params = {}
	) {
		return API.get(
			`${BASE}/materials`,
			{
				params:
					cleanParams(
						params
					),
			}
		);
	},

	createMaterial(
		body
	) {
		return API.post(
			`${BASE}/materials`,
			body
		);
	},

	updateMaterial(
		id,
		body
	) {
		return API.put(
			`${BASE}/materials/${requiredId(
				id,
				"Material ID"
			)}`,
			body
		);
	},


	/*
	 * PROJECTS / DRAWINGS / PRODUCTS
	 */

	listProjects(
		params = {}
	) {
		return API.get(
			`${BASE}/projects`,
			{
				params:
					cleanParams(
						params
					),
			}
		);
	},

	createProject(
		body
	) {
		return API.post(
			`${BASE}/projects`,
			body
		);
	},

	updateProject(
		id,
		body
	) {
		return API.put(
			`${BASE}/projects/${requiredId(
				id,
				"Project drawing ID"
			)}`,
			body
		);
	},


	/*
	 * LOCATIONS
	 */

	listLocations(
		params = {}
	) {
		return API.get(
			`${BASE}/locations`,
			{
				params:
					cleanParams(
						params
					),
			}
		);
	},

	createLocation(
		body
	) {
		return API.post(
			`${BASE}/locations`,
			body
		);
	},

	updateLocation(
		id,
		body
	) {
		return API.put(
			`${BASE}/locations/${requiredId(
				id,
				"Location ID"
			)}`,
			body
		);
	},


	/*
	 * STOCK
	 */

	listStock(
		params = {}
	) {
		return API.get(
			`${BASE}/stock`,
			{
				params:
					cleanParams(
						params
					),
			}
		);
	},

	adjustStock(
		body
	) {
		return API.post(
			`${BASE}/stock/adjustments`,
			body
		);
	},


	/*
	 * VENDORS
	 */

	listVendors(
		params = {}
	) {
		return API.get(
			`${BASE}/vendors`,
			{
				params:
					cleanParams(
						params
					),
			}
		);
	},

	createVendor(
		body
	) {
		return API.post(
			`${BASE}/vendors`,
			body
		);
	},

	updateVendor(
		id,
		body
	) {
		return API.put(
			`${BASE}/vendors/${requiredId(
				id,
				"Vendor ID"
			)}`,
			body
		);
	},


	/*
	 * MATFLOW ENUM / METADATA
	 */

	metadata() {
		return API.get(
			`${BASE}/meta`
		);
	},


	/*
	 * =====================================================
	 * OPERATIONAL BOM + ROUTING
	 * =====================================================
	 */

	listBoms(
		params = {}
	) {
		return API.get(
			`${BASE}/boms`,
			{
				params:
					cleanParams(
						params
					),
			}
		);
	},

	getBom(
		id
	) {
		return API.get(
			`${BASE}/boms/${requiredId(
				id,
				"BOM ID"
			)}`
		);
	},

	createBom(
		body
	) {
		return API.post(
			`${BASE}/boms`,
			body
		);
	},

	updateBom(
		id,
		body
	) {
		return API.put(
			`${BASE}/boms/${requiredId(
				id,
				"BOM ID"
			)}`,
			body
		);
	},

	addBomLine(
		id,
		body
	) {
		return API.post(
			`${BASE}/boms/${requiredId(
				id,
				"BOM ID"
			)}/lines`,
			body
		);
	},

	updateBomLine(
		id,
		lineId,
		body
	) {
		return API.put(
			`${BASE}/boms/${requiredId(
				id,
				"BOM ID"
			)}/lines/${requiredId(
				lineId,
				"BOM line ID"
			)}`,
			body
		);
	},

	deleteBomLine(
		id,
		lineId,
		rowVersion
	) {
		return API.delete(
			`${BASE}/boms/${requiredId(
				id,
				"BOM ID"
			)}/lines/${requiredId(
				lineId,
				"BOM line ID"
			)}`,
			{
				params: {
					rowVersion,
				},
			}
		);
	},


	/*
	 * ENGINEERING
	 *
	 * Direct workflow:
	 *
	 * DRAFT / RETURNED
	 *      ↓
	 * SUBMITTED
	 *      ↓
	 * PRODUCTION
	 */

	submitBom(
		id,
		body
	) {
		return API.post(
			`${BASE}/boms/${requiredId(
				id,
				"BOM ID"
			)}/submit`,
			body
		);
	},


	/*
	 * PRODUCTION BOM REVIEW
	 *
	 * HOD approval has intentionally been removed.
	 */

	productionApproveBom(
		id,
		body
	) {
		return API.post(
			`${BASE}/boms/${requiredId(
				id,
				"BOM ID"
			)}/production-approve`,
			body
		);
	},

	productionReturnBom(
		id,
		body
	) {
		return API.post(
			`${BASE}/boms/${requiredId(
				id,
				"BOM ID"
			)}/production-return`,
			body
		);
	},


	/*
	 * BOM REVISION
	 */

	createBomRevision(
		id,
		body
	) {
		return API.post(
			`${BASE}/boms/${requiredId(
				id,
				"BOM ID"
			)}/revisions`,
			body
		);
	},


	/*
	 * BOM MATERIAL ROUTING
	 */

	listBomRoutes(
		id
	) {
		return API.get(
			`${BASE}/boms/${requiredId(
				id,
				"BOM ID"
			)}/routes`
		);
	},

	addBomRouteStep(
		id,
		lineId,
		body
	) {
		return API.post(
			`${BASE}/boms/${requiredId(
				id,
				"BOM ID"
			)}/lines/${requiredId(
				lineId,
				"BOM line ID"
			)}/route-steps`,
			body
		);
	},

	updateBomRouteStep(
		id,
		lineId,
		stepId,
		body
	) {
		return API.put(
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
		);
	},

	deleteBomRouteStep(
		id,
		lineId,
		stepId,
		rowVersion
	) {
		return API.delete(
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
				params: {
					rowVersion,
				},
			}
		);
	},


	/*
	 * =====================================================
	 * PRODUCTION REQUISITION + STORE
	 * =====================================================
	 */

	/*
	 * REQUISITIONS
	 */

	listRequisitions() {
		return API.get(
			`${BASE}/requisitions`
		);
	},

	getRequisition(
		id
	) {
		return API.get(
			`${BASE}/requisitions/${requiredId(
				id,
				"Requisition ID"
			)}`
		);
	},

	/*
	 * Combined requisition planning snapshot:
	 *
	 * reservations
	 * shortages
	 * transfers
	 * indents
	 * downstream planning
	 */
	getRequisitionPlanning(
		id
	) {
		return API.get(
			`${BASE}/requisitions/${requiredId(
				id,
				"Requisition ID"
			)}/planning`
		);
	},

	createRequisition(
		body
	) {
		return API.post(
			`${BASE}/requisitions`,
			body
		);
	},

	submitRequisition(
		id,
		body
	) {
		return API.post(
			`${BASE}/requisitions/${requiredId(
				id,
				"Requisition ID"
			)}/submit`,
			body
		);
	},

	cancelRequisition(
		id,
		body
	) {
		return API.post(
			`${BASE}/requisitions/${requiredId(
				id,
				"Requisition ID"
			)}/cancel`,
			body
		);
	},


	/*
	 * STORE REVIEW QUEUE
	 */

	listStoreQueue(
		params = {}
	) {
		return API.get(
			`${BASE}/store/requisitions`,
			{
				params:
					cleanParams(
						params
					),
			}
		);
	},

	getStoreReview(
		id
	) {
		return API.get(
			`${BASE}/store/requisitions/${requiredId(
				id,
				"Requisition ID"
			)}`
		);
	},

	getStoreAvailability(
		id
	) {
		return API.get(
			`${BASE}/store/requisitions/${requiredId(
				id,
				"Requisition ID"
			)}/availability`
		);
	},

	submitStoreReview(
		id,
		body
	) {
		return API.post(
			`${BASE}/store/requisitions/${requiredId(
				id,
				"Requisition ID"
			)}/review`,
			body
		);
	},


	/*
	 * STORE ISSUE
	 *
	 * This is the single authoritative reservation issue
	 * endpoint after backend refactoring.
	 */
	issueStoreReservation(
		id,
		body
	) {
		return API.post(
			`${BASE}/store/reservations/${requiredId(
				id,
				"Reservation ID"
			)}/issue`,
			body
		);
	},


	/*
	 * RELEASE RESERVED QUANTITY
	 */

	releaseReservation(
		id,
		body
	) {
		return API.post(
			`${BASE}/reservations/${requiredId(
				id,
				"Reservation ID"
			)}/release`,
			body
		);
	},


	/*
	 * SHORTAGE INDENT → PURCHASE
	 */

	submitIndent(
		id,
		body
	) {
		return API.patch(
			`${BASE}/indents/${requiredId(
				id,
				"Indent ID"
			)}/submit-to-purchase`,
			body
		);
	},


	/*
	 * =====================================================
	 * PROCUREMENT
	 * =====================================================
	 */

	/*
	 * PURCHASE ORDERS
	 */

	listPurchaseOrders() {
		return API.get(
			`${BASE}/purchase-orders`
		);
	},

	createPurchaseOrder(
		body
	) {
		return API.post(
			`${BASE}/purchase-orders`,
			body
		);
	},

	/*
	 * Higher-authority approval.
	 *
	 * Current backend moves the approved PO from
	 * DRAFT → PLACED and records approval in audit.
	 */
	approvePurchaseOrder(
		id,
		body
	) {
		return API.post(
			`${BASE}/purchase-orders/${requiredId(
				id,
				"Purchase order ID"
			)}/approve`,
			body
		);
	},


	/*
	 * GOODS RECEIPT / GRN
	 */

	listGoodsReceipts() {
		return API.get(
			`${BASE}/grns`
		);
	},

	createGoodsReceipt(
		body
	) {
		return API.post(
			`${BASE}/grns`,
			body
		);
	},


	/*
	 * =====================================================
	 * QUALITY CONTROL
	 * =====================================================
	 */

	listQcInspections(
		params = {}
	) {
		return API.get(
			`${BASE}/qc`,
			{
				params:
					cleanParams(
						params
					),
			}
		);
	},

	decideQc(
		id,
		body
	) {
		return API.post(
			`${BASE}/qc/${requiredId(
				id,
				"QC inspection ID"
			)}/decision`,
			body
		);
	},

	returnQcToVendor(
		id,
		body
	) {
		return API.post(
			`${BASE}/qc/${requiredId(
				id,
				"QC inspection ID"
			)}/return-to-vendor`,
			body
		);
	},


	/*
	 * QC DISPOSITION
	 *
	 * Used when a rejected transferred material needs a
	 * controlled disposition decision.
	 */

	listQcDispositions() {
		return API.get(
			`${BASE}/qc-dispositions`
		);
	},

	decideQcDisposition(
		inspectionId,
		body
	) {
		return API.post(
			`${BASE}/qc-dispositions/${requiredId(
				inspectionId,
				"QC inspection ID"
			)}`,
			body
		);
	},


	/*
	 * =====================================================
	 * MOVEMENT — TRANSFERS + RETURNS
	 * =====================================================
	 */

	/*
	 * TRANSFERS
	 */

	listTransfers(
		params = {}
	) {
		return API.get(
			`${BASE}/transfers`,
			{
				params:
					cleanParams(
						params
					),
			}
		);
	},

	getTransfer(
		id
	) {
		return API.get(
			`${BASE}/transfers/${requiredId(
				id,
				"Transfer ID"
			)}`
		);
	},

	dispatchTransfer(
		id,
		body
	) {
		return API.post(
			`${BASE}/transfers/${requiredId(
				id,
				"Transfer ID"
			)}/dispatch`,
			body
		);
	},

	receiveTransfer(
		id,
		body
	) {
		return API.post(
			`${BASE}/transfers/${requiredId(
				id,
				"Transfer ID"
			)}/receive`,
			body
		);
	},


	/*
	 * MATERIAL RETURNS
	 */

	listMaterialReturns() {
		return API.get(
			`${BASE}/material-returns`
		);
	},

	createMaterialReturn(
		body
	) {
		return API.post(
			`${BASE}/material-returns`,
			body
		);
	},

	dispatchMaterialReturn(
		id,
		body
	) {
		return API.post(
			`${BASE}/material-returns/${requiredId(
				id,
				"Material return ID"
			)}/dispatch`,
			body
		);
	},

	receiveMaterialReturn(
		id,
		body
	) {
		return API.post(
			`${BASE}/material-returns/${requiredId(
				id,
				"Material return ID"
			)}/receive`,
			body
		);
	},


	/*
	 * =====================================================
	 * PROCESSING + PRODUCTION
	 * =====================================================
	 */

	/*
	 * PROCESSING JOBS
	 */

	listProcessingJobs() {
		return API.get(
			`${BASE}/processing-jobs`
		);
	},

	createProcessingJob(
		body
	) {
		return API.post(
			`${BASE}/processing-jobs`,
			body
		);
	},

	startProcessingJob(
		id,
		body
	) {
		return API.post(
			`${BASE}/processing-jobs/${requiredId(
				id,
				"Processing job ID"
			)}/start`,
			body
		);
	},

	completeProcessingJob(
		id,
		body
	) {
		return API.post(
			`${BASE}/processing-jobs/${requiredId(
				id,
				"Processing job ID"
			)}/complete`,
			body
		);
	},


	/*
	 * PRODUCTION EXECUTION
	 */

	startProduction(
		id,
		body
	) {
		return API.post(
			`${BASE}/requisitions/${requiredId(
				id,
				"Requisition ID"
			)}/production/start`,
			body
		);
	},

	completeProduction(
		id,
		body
	) {
		return API.post(
			`${BASE}/requisitions/${requiredId(
				id,
				"Requisition ID"
			)}/production/complete`,
			body
		);
	},


	/*
	 * PRODUCTION CONSUMPTION
	 */

	listConsumptions() {
		return API.get(
			`${BASE}/production-consumptions`
		);
	},

	createConsumption(
		body
	) {
		return API.post(
			`${BASE}/production-consumptions`,
			body
		);
	},


	/*
	 * =====================================================
	 * REPORTING + TRACKER + INTEGRITY
	 * =====================================================
	 */

	/*
	 * DASHBOARD REPORT
	 */

	dashboardReport(
		params = {}
	) {
		return API.get(
			`${BASE}/reports/dashboard`,
			{
				params:
					cleanParams(
						params
					),
			}
		);
	},


	/*
	 * PROJECT / DRAWING REPORT
	 */

	projectReport(
		projectDrawingId
	) {
		return API.get(
			`${BASE}/reports/projects/${requiredId(
				projectDrawingId,
				"Project drawing ID"
			)}`
		);
	},


	/*
	 * SHORTAGES
	 */

	shortageReport(
		params = {}
	) {
		return API.get(
			`${BASE}/reports/shortages`,
			{
				params:
					cleanParams(
						params
					),
			}
		);
	},


	/*
	 * STOCK LEDGER
	 */

	stockLedger(
		params = {}
	) {
		return API.get(
			`${BASE}/reports/stock-ledger`,
			{
				params:
					cleanParams(
						params
					),
			}
		);
	},


	/*
	 * AUDIT
	 */

	auditLogs(
		params = {}
	) {
		return API.get(
			`${BASE}/reports/audit`,
			{
				params:
					cleanParams(
						params
					),
			}
		);
	},


	/*
	 * PROFESSIONAL MATFLOW CONTROL TOWER
	 */

	getTracker(
		params = {}
	) {
		return API.get(
			`${BASE}/tracker`,
			{
				params:
					cleanParams(
						params
					),
			}
		);
	},


	/*
	 * ADMIN INTEGRITY CHECK
	 */

	integrity(
		params = {}
	) {
		return API.get(
			`${BASE}/admin/integrity`,
			{
				params:
					cleanParams(
						params
					),
			}
		);
	},
};

export default matflowApi;