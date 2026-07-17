import API from "../../services/api";

export async function fetchHardwarePackets() {
	const response = await API.get("/api/hardware-packets");
	return response.data;
}

export async function createHardwarePackets(payload) {
	const response = await API.post(
		"/api/hardware-packets",
		payload
	);

	return response.data;
}

export async function updateHardwarePacket(
	itemId,
	payload
) {
	const response = await API.put(
		`/api/hardware-packets/${itemId}`,
		payload
	);

	return response.data;
}

export async function deleteHardwarePacket(itemId) {
	const response = await API.delete(
		`/api/hardware-packets/${itemId}`
	);

	return response.data;
}

export async function previewHardwareSticker(
	itemId,
	factoryFloor,
	showCompanyHeader = true
) {
	const response = await API.post(
		`/api/hardware-packets/${itemId}/preview-sticker`,
		null,
		{
			params: {
				factoryFloor:
					factoryFloor || undefined,
				showCompanyHeader,
			},
			responseType: "blob",
		}
	);

	return response.data;
}

export async function generateHardwareSticker(
	itemId,
	factoryFloor,
	showCompanyHeader = true
) {
	const response = await API.post(
		`/api/hardware-packets/${itemId}/generate-sticker`,
		null,
		{
			params: {
				factoryFloor:
					factoryFloor || undefined,
				showCompanyHeader,
			},
			responseType: "blob",
		}
	);

	return response.data;
}

export async function downloadLatestHardwareSticker(
	itemId
) {
	const response = await API.get(
		`/api/hardware-packets/${itemId}/sticker`,
		{
			responseType: "blob",
		}
	);

	return response.data;
}