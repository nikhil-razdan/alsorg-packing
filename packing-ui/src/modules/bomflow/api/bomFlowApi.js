import API from "../../../services/api";

const unwrap = (response) => {
	return (
		response?.data?.data ??
		response?.data ??
		null
	);
};

const ENDPOINTS = Object.freeze({
	products: "/bomflow/products",
	revisions: "/bomflow/revisions",
	commercial: "/bomflow/commercial",
});

const requireId = (value, label) => {
	if (!value) {
		throw new Error(`${label} is required.`);
	}
};

const fileForm = (file) => {
	if (!file) {
		throw new Error("File is required.");
	}

	const form = new FormData();
	form.append("file", file);
	return form;
};

export const bomFlowApi = {
	async listProducts(params = {}) {
		const response = await API.get(
			ENDPOINTS.products,
			{ params }
		);

		return unwrap(response);
	},

	async getProduct(productId) {
		requireId(productId, "Product ID");

		const response = await API.get(
			`${ENDPOINTS.products}/${productId}`
		);

		return unwrap(response);
	},

	async createProduct(payload) {
		const response = await API.post(
			ENDPOINTS.products,
			payload
		);

		return unwrap(response);
	},

	async updateProduct(
		productId,
		payload,
		rowVersion
	) {
		requireId(productId, "Product ID");

		const response = await API.put(
			`${ENDPOINTS.products}/${productId}`,
			{
				...payload,
				rowVersion,
			}
		);

		return unwrap(response);
	},

	async uploadProductImage(productId, file) {
		requireId(productId, "Product ID");

		const response = await API.post(
			`${ENDPOINTS.products}/${productId}/image`,
			fileForm(file)
		);

		return unwrap(response);
	},

	async getProductImageBlob(productId) {
		requireId(productId, "Product ID");

		const response = await API.get(
			`${ENDPOINTS.products}/${productId}/image`,
			{
				responseType: "blob",
			}
		);

		return response?.data || null;
	},

	async deleteProductImage(productId) {
		requireId(productId, "Product ID");

		const response = await API.delete(
			`${ENDPOINTS.products}/${productId}/image`
		);

		return unwrap(response);
	},

	async uploadProductDrawing(productId, file) {
		requireId(productId, "Product ID");

		const response = await API.post(
			`${ENDPOINTS.products}/${productId}/drawing`,
			fileForm(file)
		);

		return unwrap(response);
	},

	async getProductDrawingBlob(productId) {
		requireId(productId, "Product ID");

		const response = await API.get(
			`${ENDPOINTS.products}/${productId}/drawing`,
			{
				responseType: "blob",
			}
		);

		return response?.data || null;
	},

	async deleteProductDrawing(productId) {
		requireId(productId, "Product ID");

		const response = await API.delete(
			`${ENDPOINTS.products}/${productId}/drawing`
		);

		return unwrap(response);
	},

	async listProductRevisions(productId) {
		requireId(productId, "Product ID");

		const response = await API.get(
			`${ENDPOINTS.products}/${productId}/revisions`
		);

		return unwrap(response);
	},

	async createRevision(productId, payload = {}) {
		requireId(productId, "Product ID");

		const response = await API.post(
			`${ENDPOINTS.products}/${productId}/revisions`,
			payload
		);

		return unwrap(response);
	},

	async getRevision(revisionId) {
		requireId(revisionId, "Revision ID");

		const response = await API.get(
			`${ENDPOINTS.revisions}/${revisionId}`
		);

		return unwrap(response);
	},

	async addRevisionLine(revisionId, payload) {
		requireId(revisionId, "Revision ID");

		const response = await API.post(
			`${ENDPOINTS.revisions}/${revisionId}/items`,
			payload
		);

		return unwrap(response);
	},

	async updateRevisionLine(
		revisionId,
		itemId,
		payload,
		rowVersion
	) {
		requireId(revisionId, "Revision ID");
		requireId(itemId, "Item ID");

		const response = await API.put(
			`${ENDPOINTS.revisions}/${revisionId}/items/${itemId}`,
			{
				...payload,
				rowVersion,
			}
		);

		return unwrap(response);
	},

	async deleteRevisionLine(
		revisionId,
		itemId,
		rowVersion
	) {
		requireId(revisionId, "Revision ID");
		requireId(itemId, "Item ID");

		const response = await API.delete(
			`${ENDPOINTS.revisions}/${revisionId}/items/${itemId}`,
			{
				data: {
					rowVersion,
				},
			}
		);

		return unwrap(response);
	},

	async submitRevision(revisionId, rowVersion) {
		const response = await API.post(
			`${ENDPOINTS.revisions}/${revisionId}/submit`,
			{
				rowVersion,
			}
		);

		return unwrap(response);
	},

	async verifyRevision(
		revisionId,
		remarks,
		rowVersion
	) {
		const response = await API.post(
			`${ENDPOINTS.revisions}/${revisionId}/verify`,
			{
				remarks: remarks || null,
				rowVersion,
			}
		);

		return unwrap(response);
	},

	async returnRevision(
		revisionId,
		remarks,
		rowVersion
	) {
		const response = await API.post(
			`${ENDPOINTS.revisions}/${revisionId}/return`,
			{
				remarks,
				rowVersion,
			}
		);

		return unwrap(response);
	},

	async approveRevision(
		revisionId,
		remarks,
		rowVersion
	) {
		const response = await API.post(
			`${ENDPOINTS.revisions}/${revisionId}/approve`,
			{
				remarks: remarks || null,
				rowVersion,
			}
		);

		return unwrap(response);
	},

	/* ================= RATE MASTER ================= */

	async listMaterialRates(params = {}) {
		const response = await API.get(
			`${ENDPOINTS.commercial}/rates`,
			{ params }
		);
		return unwrap(response);
	},

	async createMaterialRate(payload) {
		const response = await API.post(
			`${ENDPOINTS.commercial}/rates`,
			payload
		);
		return unwrap(response);
	},

	async updateMaterialRate(rateId, payload) {
		requireId(rateId, "Material Rate ID");
		const response = await API.put(
			`${ENDPOINTS.commercial}/rates/${rateId}`,
			payload
		);
		return unwrap(response);
	},

	async setMaterialRateActive(rateId, active, rowVersion) {
		requireId(rateId, "Material Rate ID");
		const response = await API.post(
			`${ENDPOINTS.commercial}/rates/${rateId}/active`,
			null,
			{ params: { active, rowVersion } }
		);
		return unwrap(response);
	},

	async uploadMaterialRateEvidence(rateId, file) {
		requireId(rateId, "Material rate ID");
		const response = await API.post(
			`${ENDPOINTS.commercial}/rates/${rateId}/evidence`,
			fileForm(file)
		);
		return unwrap(response);
	},

	async getMaterialRateEvidenceBlob(rateId) {
		requireId(rateId, "Material rate ID");
		const response = await API.get(
			`${ENDPOINTS.commercial}/rates/${rateId}/evidence`,
			{ responseType: "blob" }
		);
		return response?.data || null;
	},

	async deleteMaterialRateEvidence(rateId) {
		requireId(rateId, "Material rate ID");
		const response = await API.delete(
			`${ENDPOINTS.commercial}/rates/${rateId}/evidence`
		);
		return unwrap(response);
	},

	async applyMaterialRates(revisionId) {
		requireId(revisionId, "Revision ID");
		const response = await API.post(
			`${ENDPOINTS.commercial}/rates/apply/${revisionId}`
		);
		return unwrap(response);
	},

	/* ================= LABOUR MASTER ================= */

	async listLabourRates(params = {}) {
		const response = await API.get(
			`${ENDPOINTS.commercial}/labour-rates`,
			{ params }
		);
		return unwrap(response);
	},

	async createLabourRate(payload) {
		const response = await API.post(
			`${ENDPOINTS.commercial}/labour-rates`,
			payload
		);
		return unwrap(response);
	},

	async updateLabourRate(rateId, payload) {
		requireId(rateId, "Labour Rate ID");
		const response = await API.put(
			`${ENDPOINTS.commercial}/labour-rates/${rateId}`,
			payload
		);
		return unwrap(response);
	},

	async setLabourRateActive(rateId, active, rowVersion) {
		requireId(rateId, "Labour Rate ID");
		const response = await API.post(
			`${ENDPOINTS.commercial}/labour-rates/${rateId}/active`,
			null,
			{ params: { active, rowVersion } }
		);
		return unwrap(response);
	},

	/* ================= COSTING ENGINE ================= */

	async getCosting(revisionId) {
		requireId(revisionId, "Revision ID");
		const response = await API.get(
			`${ENDPOINTS.commercial}/costing/${revisionId}`
		);
		return unwrap(response);
	},

	async saveCostingSettings(revisionId, payload) {
		requireId(revisionId, "Revision ID");
		const response = await API.put(
			`${ENDPOINTS.commercial}/costing/${revisionId}/settings`,
			payload
		);
		return unwrap(response);
	},

	async syncCostingLabourMaster(revisionId) {
		requireId(revisionId, "Revision ID");
		const response = await API.post(
			`${ENDPOINTS.commercial}/costing/${revisionId}/labour-lines/sync`
		);
		return unwrap(response);
	},

	async addCostingLabourLine(revisionId, payload) {
		requireId(revisionId, "Revision ID");
		const response = await API.post(
			`${ENDPOINTS.commercial}/costing/${revisionId}/labour-lines`,
			payload
		);
		return unwrap(response);
	},

	async updateCostingLabourLine(revisionId, lineId, payload) {
		requireId(revisionId, "Revision ID");
		requireId(lineId, "Labour Line ID");
		const response = await API.put(
			`${ENDPOINTS.commercial}/costing/${revisionId}/labour-lines/${lineId}`,
			payload
		);
		return unwrap(response);
	},

	async deleteCostingLabourLine(revisionId, lineId, rowVersion) {
		requireId(revisionId, "Revision ID");
		requireId(lineId, "Labour Line ID");
		await API.delete(
			`${ENDPOINTS.commercial}/costing/${revisionId}/labour-lines/${lineId}`,
			{ params: { rowVersion } }
		);
	},

	async getDashboardSummary() {
		const response = await API.get(
			`${ENDPOINTS.commercial}/dashboard`
		);
		return unwrap(response);
	},

	/* ================= REPORTS ================= */

	async downloadCommercialReport(revisionId, type) {
		requireId(revisionId, "Revision ID");
		const allowed = ["materials", "labour", "costing", "change-log", "workbook"];
		if (!allowed.includes(type)) {
			throw new Error("Unsupported report type.");
		}
		const response = await API.get(
			`${ENDPOINTS.commercial}/reports/${revisionId}/${type}.${type === "workbook" ? "xlsx" : "csv"}`,
			{ responseType: "blob" }
		);
		return {
			blob: response?.data || null,
			contentDisposition:
				response?.headers?.["content-disposition"] || "",
		};
	},

};

export default bomFlowApi;
