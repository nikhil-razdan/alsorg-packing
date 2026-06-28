import API from "../services/api";

/*
 * Current Packet Items API
 * This no longer calls old Zoho endpoints.
 */

export async function fetchPacketItems() {
	const res = await API.get("/packets/items");

	return Array.isArray(res.data) ? res.data : [];
}

export async function fetchPacketItemsPaged(page = 1, perPage = 25) {
	const res = await API.get("/packets/items", {
		params: {
			page,
			perPage,
		},
	});

	/*
	 * Supports both backend response styles:
	 * 1. plain array
	 * 2. paged object
	 */
	if (Array.isArray(res.data)) {
		return {
			items: res.data,
			total: res.data.length,
			page,
			perPage,
		};
	}

	return {
		items: Array.isArray(res.data?.items) ? res.data.items : [],
		total: Number(res.data?.total || res.data?.totalElements || 0),
		page: Number(res.data?.page || page),
		perPage: Number(res.data?.perPage || res.data?.size || perPage),
	};
}

export async function previewSticker(itemId, factoryFloor = "", showCompanyHeader = true) {
	const res = await API.post(
		`/packets/items/${encodeURIComponent(itemId)}/preview-sticker`,
		null,
		{
			params: {
				factoryFloor,
				showCompanyHeader,
			},
			responseType: "blob",
		}
	);

	return res.data;
}

export async function generateSticker(itemId, factoryFloor = "", showCompanyHeader = true) {
	const res = await API.post(
		`/packets/items/${encodeURIComponent(itemId)}/generate-sticker`,
		null,
		{
			params: {
				factoryFloor,
				showCompanyHeader,
			},
			responseType: "blob",
		}
	);

	return res.data;
}