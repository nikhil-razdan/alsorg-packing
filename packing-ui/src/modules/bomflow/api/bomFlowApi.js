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
	const clean = String(value ?? "").trim();
	if (!clean) {
		throw new Error(`${label} is required.`);
	}
	return clean;
};

const pathId = (value, label = "ID") =>
	encodeURIComponent(requireId(value, label));

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
			`${ENDPOINTS.products}/${pathId(productId, "Product ID")}`
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
			`${ENDPOINTS.products}/${pathId(productId, "Product ID")}`,
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
			`${ENDPOINTS.products}/${pathId(productId, "Product ID")}/image`,
			fileForm(file)
		);

		return unwrap(response);
	},

	async getProductImageBlob(productId) {
		requireId(productId, "Product ID");

		const response = await API.get(
			`${ENDPOINTS.products}/${pathId(productId, "Product ID")}/image`,
			{
				responseType: "blob",
			}
		);

		return response?.data || null;
	},

	async deleteProductImage(productId) {
		requireId(productId, "Product ID");

		const response = await API.delete(
			`${ENDPOINTS.products}/${pathId(productId, "Product ID")}/image`
		);

		return unwrap(response);
	},

	async uploadProductDrawing(productId, file) {
		requireId(productId, "Product ID");

		const response = await API.post(
			`${ENDPOINTS.products}/${pathId(productId, "Product ID")}/drawing`,
			fileForm(file)
		);

		return unwrap(response);
	},

	async getProductDrawingBlob(productId) {
		requireId(productId, "Product ID");

		const response = await API.get(
			`${ENDPOINTS.products}/${pathId(productId, "Product ID")}/drawing`,
			{
				responseType: "blob",
			}
		);

		return response?.data || null;
	},

	async deleteProductDrawing(productId) {
		requireId(productId, "Product ID");

		const response = await API.delete(
			`${ENDPOINTS.products}/${pathId(productId, "Product ID")}/drawing`
		);

		return unwrap(response);
	},

	async listProductRevisions(productId) {
		requireId(productId, "Product ID");

		const response = await API.get(
			`${ENDPOINTS.products}/${pathId(productId, "Product ID")}/revisions`
		);

		return unwrap(response);
	},

	async createRevision(productId, payload = {}) {
		requireId(productId, "Product ID");

		const response = await API.post(
			`${ENDPOINTS.products}/${pathId(productId, "Product ID")}/revisions`,
			payload
		);

		return unwrap(response);
	},

	async getRevision(revisionId) {
		requireId(revisionId, "Revision ID");

		const response = await API.get(
			`${ENDPOINTS.revisions}/${pathId(revisionId, "Revision ID")}`
		);

		return unwrap(response);
	},

	async addRevisionLine(revisionId, payload) {
		requireId(revisionId, "Revision ID");

		const response = await API.post(
			`${ENDPOINTS.revisions}/${pathId(revisionId, "Revision ID")}/items`,
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
			`${ENDPOINTS.revisions}/${pathId(revisionId, "Revision ID")}/items/${pathId(itemId, "Item ID")}`,
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
			`${ENDPOINTS.revisions}/${pathId(revisionId, "Revision ID")}/items/${pathId(itemId, "Item ID")}`,
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
			`${ENDPOINTS.revisions}/${pathId(revisionId, "Revision ID")}/submit`,
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
			`${ENDPOINTS.revisions}/${pathId(revisionId, "Revision ID")}/verify`,
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
			`${ENDPOINTS.revisions}/${pathId(revisionId, "Revision ID")}/return`,
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
			`${ENDPOINTS.revisions}/${pathId(revisionId, "Revision ID")}/approve`,
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
			`${ENDPOINTS.commercial}/rates/${pathId(rateId, "Rate ID")}`,
			payload
		);
		return unwrap(response);
	},

	async setMaterialRateActive(rateId, active, rowVersion) {
		requireId(rateId, "Material Rate ID");
		const response = await API.post(
			`${ENDPOINTS.commercial}/rates/${pathId(rateId, "Rate ID")}/active`,
			null,
			{ params: { active, rowVersion } }
		);
		return unwrap(response);
	},

	async uploadMaterialRateEvidence(rateId, file) {
		requireId(rateId, "Material rate ID");
		const response = await API.post(
			`${ENDPOINTS.commercial}/rates/${pathId(rateId, "Rate ID")}/evidence`,
			fileForm(file)
		);
		return unwrap(response);
	},

	async getMaterialRateEvidenceBlob(rateId) {
		requireId(rateId, "Material rate ID");
		const response = await API.get(
			`${ENDPOINTS.commercial}/rates/${pathId(rateId, "Rate ID")}/evidence`,
			{ responseType: "blob" }
		);
		return response?.data || null;
	},

	async deleteMaterialRateEvidence(rateId) {
		requireId(rateId, "Material rate ID");
		const response = await API.delete(
			`${ENDPOINTS.commercial}/rates/${pathId(rateId, "Rate ID")}/evidence`
		);
		return unwrap(response);
	},

	async applyMaterialRates(revisionId) {
		requireId(revisionId, "Revision ID");
		const response = await API.post(
			`${ENDPOINTS.commercial}/rates/apply/${pathId(revisionId, "Revision ID")}`
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
			`${ENDPOINTS.commercial}/labour-rates/${pathId(rateId, "Rate ID")}`,
			payload
		);
		return unwrap(response);
	},

	async setLabourRateActive(rateId, active, rowVersion) {
		requireId(rateId, "Labour Rate ID");
		const response = await API.post(
			`${ENDPOINTS.commercial}/labour-rates/${pathId(rateId, "Rate ID")}/active`,
			null,
			{ params: { active, rowVersion } }
		);
		return unwrap(response);
	},

	/* ================= COSTING ENGINE ================= */

	async getCosting(revisionId) {
		requireId(revisionId, "Revision ID");
		const response = await API.get(
			`${ENDPOINTS.commercial}/costing/${pathId(revisionId, "Revision ID")}`
		);
		return unwrap(response);
	},

	async saveCostingSettings(revisionId, payload) {
		requireId(revisionId, "Revision ID");
		const response = await API.put(
			`${ENDPOINTS.commercial}/costing/${pathId(revisionId, "Revision ID")}/settings`,
			payload
		);
		return unwrap(response);
	},

	async getRevisionIntelligence(revisionId, compareToRevisionId = null) {
		requireId(revisionId, "Revision ID");
		const response = await API.get(
			`${ENDPOINTS.commercial}/costing/${pathId(revisionId, "Revision ID")}/revision-intelligence`,
			{
				params: compareToRevisionId
					? { compareToRevisionId }
					: {},
			}
		);
		return unwrap(response);
	},

	async syncCostingLabourMaster(revisionId) {
		requireId(revisionId, "Revision ID");
		const response = await API.post(
			`${ENDPOINTS.commercial}/costing/${pathId(revisionId, "Revision ID")}/labour-lines/sync`
		);
		return unwrap(response);
	},

	async addCostingLabourLine(revisionId, payload) {
		requireId(revisionId, "Revision ID");
		const response = await API.post(
			`${ENDPOINTS.commercial}/costing/${pathId(revisionId, "Revision ID")}/labour-lines`,
			payload
		);
		return unwrap(response);
	},

	async updateCostingLabourLine(revisionId, lineId, payload) {
		requireId(revisionId, "Revision ID");
		requireId(lineId, "Labour Line ID");
		const response = await API.put(
			`${ENDPOINTS.commercial}/costing/${pathId(revisionId, "Revision ID")}/labour-lines/${pathId(lineId, "Labour Line ID")}`,
			payload
		);
		return unwrap(response);
	},

	async deleteCostingLabourLine(revisionId, lineId, rowVersion) {
		requireId(revisionId, "Revision ID");
		requireId(lineId, "Labour Line ID");
		await API.delete(
			`${ENDPOINTS.commercial}/costing/${pathId(revisionId, "Revision ID")}/labour-lines/${pathId(lineId, "Labour Line ID")}`,
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
			`${ENDPOINTS.commercial}/reports/${pathId(revisionId, "Revision ID")}/${encodeURIComponent(type)}.${type === "workbook" ? "xlsx" : "csv"}`,
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
