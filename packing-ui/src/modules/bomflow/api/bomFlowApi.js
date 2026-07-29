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
});

export const bomFlowApi = {
	async listProducts(params = {}) {
		const response = await API.get(
			ENDPOINTS.products,
			{ params }
		);

		return unwrap(response);
	},

	async getProduct(productId) {
		if (!productId) {
			throw new Error("Product ID is required.");
		}

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
		if (!productId) {
			throw new Error("Product ID is required.");
		}

		const response = await API.put(
			`${ENDPOINTS.products}/${productId}`,
			{
				...payload,
				rowVersion,
			}
		);

		return unwrap(response);
	},

	async listProductRevisions(productId) {
		const response = await API.get(
			`${ENDPOINTS.products}/${productId}/revisions`
		);

		return unwrap(response);
	},

	async createRevision(productId, payload = {}) {
		const response = await API.post(
			`${ENDPOINTS.products}/${productId}/revisions`,
			payload
		);

		return unwrap(response);
	},

	async getRevision(revisionId) {
		const response = await API.get(
			`${ENDPOINTS.revisions}/${revisionId}`
		);

		return unwrap(response);
	},

	async addRevisionLine(revisionId, payload) {
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
};

export default bomFlowApi;