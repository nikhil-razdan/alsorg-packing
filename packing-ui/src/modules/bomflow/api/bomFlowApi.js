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
};

export default bomFlowApi;
