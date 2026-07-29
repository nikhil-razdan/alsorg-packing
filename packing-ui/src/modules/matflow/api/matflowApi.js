import API from "../../../services/api";

const BASE = "/matflow";

/*
 * The project controller may use either:
 *
 * /api/matflow/project-drawings
 * /api/matflow/projects
 *
 * The first path matches the MatFlowProjectDrawing
 * domain name. The second path is retained only as a
 * frontend compatibility fallback.
 */
const PROJECT_PATHS = [
	`${BASE}/project-drawings`,
	`${BASE}/projects`,
];

const cleanText = (value) => {
	const result =
		String(value ?? "").trim();

	return result || "";
};

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

const unwrap = (response) => {
	return (
		response?.data?.data ??
		response?.data ??
		null
	);
};

/*
 * Existing MatFlow pages are currently inconsistent:
 *
 * some use:
 *     response.data
 *
 * while some use:
 *     response.id
 *
 * This adapter supports both until every page is
 * migrated to one response style.
 */
const adaptResponse = (response) => {
	const payload = unwrap(response);

	if (Array.isArray(payload)) {
		return {
			data: payload,
		};
	}

	if (
		payload !== null &&
		typeof payload === "object"
	) {
		return {
			...payload,
			data: payload,
		};
	}

	return {
		data: payload,
		value: payload,
	};
};

const statusOf = (error) => {
	return Number(
		error?.response?.status || 0
	);
};

const canTryAlternatePath = (error) => {
	return [404, 405].includes(
		statusOf(error)
	);
};

const projectRequest = async ({
	method,
	suffix = "",
	body,
	params,
}) => {
	let previousError = null;

	for (
		let index = 0;
		index < PROJECT_PATHS.length;
		index += 1
	) {
		const path =
			`${PROJECT_PATHS[index]}${suffix}`;

		try {
			let response;

			if (method === "get") {
				response = await API.get(
					path,
					{
						params:
							cleanParams(
								params
							),
					}
				);
			} else if (method === "post") {
				response = await API.post(
					path,
					body
				);
			} else if (method === "put") {
				response = await API.put(
					path,
					body
				);
			} else {
				throw new Error(
					`Unsupported request method: ${method}`
				);
			}

			return adaptResponse(response);
		} catch (error) {
			previousError = error;

			const lastPath =
				index ===
				PROJECT_PATHS.length - 1;

			if (
				lastPath ||
				!canTryAlternatePath(error)
			) {
				throw error;
			}
		}
	}

	throw previousError;
};

const normalGet = async (
	path,
	params = {}
) => {
	const response = await API.get(
		path,
		{
			params:
				cleanParams(params),
		}
	);

	return adaptResponse(response);
};

const normalPost = async (
	path,
	body = {}
) => {
	const response = await API.post(
		path,
		body
	);

	return adaptResponse(response);
};

const normalPut = async (
	path,
	body = {}
) => {
	const response = await API.put(
		path,
		body
	);

	return adaptResponse(response);
};

const normalDelete = async (
	path,
	body = {}
) => {
	const response = await API.delete(
		path,
		{
			data: body,
		}
	);

	return adaptResponse(response);
};

const normalizeFieldErrors = (errors) => {
	if (!errors) {
		return [];
	}

	if (Array.isArray(errors)) {
		return errors
			.map((entry) => {
				if (
					typeof entry === "string"
				) {
					return entry;
				}

				const field =
					entry?.field ||
					entry?.property ||
					entry?.path ||
					"Field";

				const message =
					entry?.message ||
					entry?.defaultMessage ||
					entry?.reason ||
					"Invalid value";

				return `${field}: ${message}`;
			})
			.filter(Boolean);
	}

	if (typeof errors === "object") {
		return Object.entries(errors)
			.flatMap(([field, value]) => {
				if (Array.isArray(value)) {
					return value.map(
						(message) =>
							`${field}: ${message}`
					);
				}

				if (
					value &&
					typeof value === "object"
				) {
					return [
						`${field}: ${value.message ||
						JSON.stringify(value)
						}`,
					];
				}

				return [
					`${field}: ${String(value)}`,
				];
			});
	}

	return [String(errors)];
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

	const fieldMessages = [
		...normalizeFieldErrors(
			data?.fieldErrors
		),
		...normalizeFieldErrors(
			data?.validationErrors
		),
		...normalizeFieldErrors(
			data?.violations
		),
	];

	const mainMessage =
		data?.message ||
		data?.detail ||
		data?.error ||
		error?.message ||
		fallback;

	if (fieldMessages.length > 0) {
		return [
			mainMessage,
			...fieldMessages,
		].join(" | ");
	}

	return mainMessage;
};

export const extractMatFlowPage = (
	responseData
) => {
	/*
	 * Support the compatibility API response.
	 */
	const source =
		responseData?.data ??
		responseData;

	if (Array.isArray(source)) {
		return {
			rows: source,
			page: 0,
			size: source.length,
			totalElements:
				source.length,
			totalPages:
				source.length > 0
					? 1
					: 0,
		};
	}

	if (
		Array.isArray(
			source?.content
		)
	) {
		return {
			rows:
				source.content,

			page:
				source.number ??
				source.page ??
				0,

			size:
				source.size ??
				source.content.length,

			totalElements:
				source.totalElements ??
				source.content.length,

			totalPages:
				source.totalPages ??
				1,
		};
	}

	if (
		Array.isArray(
			source?.data
		)
	) {
		return {
			rows:
				source.data,

			page:
				source.page ?? 0,

			size:
				source.size ??
				source.data.length,

			totalElements:
				source.totalElements ??
				source.data.length,

			totalPages:
				source.totalPages ??
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

export const matflowApi = {
	/* =====================================================
	 * MATERIAL MASTER
	 * ===================================================== */

	listMaterials(params = {}) {
		return normalGet(
			`${BASE}/materials`,
			params
		);
	},

	getMaterial(materialId) {
		return normalGet(
			`${BASE}/materials/${materialId}`
		);
	},

	createMaterial(body) {
		return normalPost(
			`${BASE}/materials`,
			body
		);
	},

	updateMaterial(
		materialId,
		body
	) {
		return normalPut(
			`${BASE}/materials/${materialId}`,
			body
		);
	},

	/* =====================================================
	 * PROJECT / DRAWING MASTER
	 * ===================================================== */

	listProjects(params = {}) {
		return projectRequest({
			method: "get",
			params,
		});
	},

	getProject(projectDrawingId) {
		return projectRequest({
			method: "get",
			suffix:
				`/${projectDrawingId}`,
		});
	},

	createProject(body) {
		return projectRequest({
			method: "post",
			body,
		});
	},

	updateProject(
		projectDrawingId,
		body
	) {
		return projectRequest({
			method: "put",
			suffix:
				`/${projectDrawingId}`,
			body,
		});
	},

	/* =====================================================
	 * OPERATIONAL BOM
	 * ===================================================== */

	listBoms(params = {}) {
		return normalGet(
			`${BASE}/boms`,
			params
		);
	},

	getBom(bomId) {
		return normalGet(
			`${BASE}/boms/${bomId}`
		);
	},

	createBom(body) {
		return normalPost(
			`${BASE}/boms`,
			body
		);
	},

	updateBom(
		bomId,
		body
	) {
		return normalPut(
			`${BASE}/boms/${bomId}`,
			body
		);
	},

	submitBom(
		bomId,
		body
	) {
		return normalPost(
			`${BASE}/boms/${bomId}/submit`,
			body
		);
	},

	approveBom(
		bomId,
		body
	) {
		return normalPost(
			`${BASE}/boms/${bomId}/approve`,
			body
		);
	},

	returnBom(
		bomId,
		body
	) {
		return normalPost(
			`${BASE}/boms/${bomId}/return`,
			body
		);
	},

	createBomRevision(
		bomId,
		body
	) {
		return normalPost(
			`${BASE}/boms/${bomId}/revisions`,
			body
		);
	},

	/* =====================================================
	 * OPERATIONAL BOM LINES
	 * ===================================================== */

	addBomLine(
		bomId,
		body
	) {
		return normalPost(
			`${BASE}/boms/${bomId}/lines`,
			body
		);
	},

	updateBomLine(
		bomId,
		lineId,
		body
	) {
		return normalPut(
			`${BASE}/boms/${bomId}/lines/${lineId}`,
			body
		);
	},

	deleteBomLine(
		bomId,
		lineId,
		rowVersion
	) {
		return normalDelete(
			`${BASE}/boms/${bomId}/lines/${lineId}`,
			{
				rowVersion,
			}
		);
	},

	/* =====================================================
	 * LOCATIONS
	 * ===================================================== */

	listLocations(params = {}) {
		return normalGet(
			`${BASE}/locations`,
			params
		);
	},

	/* =====================================================
	 * EXISTING PLANNING / EXECUTION
	 * ===================================================== */

	listRequisitions(params = {}) {
		return normalGet(
			`${BASE}/requisitions`,
			params
		);
	},

	getRequisition(requisitionId) {
		return normalGet(
			`${BASE}/requisitions/${requisitionId}`
		);
	},

	createRequisition(
		bomId,
		body
	) {
		return normalPost(
			`${BASE}/requisitions/bom/${bomId}`,
			body
		);
	},

	submitRequisition(
		requisitionId,
		body
	) {
		return normalPost(
			`${BASE}/requisitions/${requisitionId}/submit`,
			body
		);
	},

	saveRequisitionLine(
		requisitionId,
		body
	) {
		return normalPost(
			`${BASE}/requisitions/${requisitionId}/lines`,
			body
		);
	},

	listIndents(params = {}) {
		return normalGet(
			`${BASE}/indents`,
			params
		);
	},

	getIndent(indentId) {
		return normalGet(
			`${BASE}/indents/${indentId}`
		);
	},

	listPurchaseOrders(params = {}) {
		return normalGet(
			`${BASE}/purchase-orders`,
			params
		);
	},

	getPurchaseOrder(
		purchaseOrderId
	) {
		return normalGet(
			`${BASE}/purchase-orders/${purchaseOrderId}`
		);
	},

	listTransfers(params = {}) {
		return normalGet(
			`${BASE}/transfers`,
			params
		);
	},

	getTransfer(transferId) {
		return normalGet(
			`${BASE}/transfers/${transferId}`
		);
	},

	listQcInspections(params = {}) {
		return normalGet(
			`${BASE}/qc/inspections`,
			params
		);
	},

	listProcessingJobs(params = {}) {
		return normalGet(
			`${BASE}/processing/jobs`,
			params
		);
	},

	/* =====================================================
	 * LEGACY RELEASE COMPATIBILITY
	 * ===================================================== */

	listReleases(params = {}) {
		return normalGet(
			`${BASE}/boms`,
			{
				...params,
				effective: true,
			}
		);
	},

	getRelease(releaseId) {
		return normalGet(
			`${BASE}/boms/${releaseId}`
		);
	},
};

export default matflowApi;