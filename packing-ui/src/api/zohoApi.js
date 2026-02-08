import API from "../services/api";

export async function fetchZohoItemsPaged(page, perPage) {
  const res = await API.get("/packets/zoho/items/paged", {
    params: { page, perPage },
  });

  console.log("ZOHO PAGED RESPONSE:", res.data);
  console.log("FIRST ITEM:", res.data?.items?.[0]);

  return res.data;
}

// Generate sticker
export async function generateSticker(zohoItemId) {
  await API.post(`/packets/zoho/items/${zohoItemId}/generate-sticker`);
}
