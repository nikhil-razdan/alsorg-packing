import API from "../services/api";

export async function fetchZohoItemsPaged(page, perPage) {
  const res = await API.get("/packets/zoho/items/paged", {
    params: { page, perPage },
  });
  return res.data;
}

// Generate sticker
export async function generateSticker(zohoItemId) {
  await API.post(`/packets/zoho/items/${zohoItemId}/generate-sticker`);
}
