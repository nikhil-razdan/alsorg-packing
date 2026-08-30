import { api } from "./client";

const clean = (value) => String(value ?? "").trim();

export async function resolveSitePacket(scanText, mode) {
  const value = clean(scanText);
  const cleanMode = clean(mode).toUpperCase();

  if (!value) throw new Error("Scan a packet QR or enter Sticker Number.");
  if (!["DELIVERY", "OPENING"].includes(cleanMode)) {
    throw new Error("Site workflow mode is invalid.");
  }

  const response = await api.post("/api/site-lifecycle/resolve", {
    scanText: value,
    mode: cleanMode,
  });

  return response?.data || {};
}

function appendFile(formData, photo, index, prefix) {
  const uri = clean(photo?.uri);
  if (!uri) return;

  const extension = uri.toLowerCase().includes(".png")
    ? "png"
    : uri.toLowerCase().includes(".webp")
      ? "webp"
      : "jpg";

  const type = extension === "png"
    ? "image/png"
    : extension === "webp"
      ? "image/webp"
      : "image/jpeg";

  formData.append("photos", {
    uri,
    name: `${prefix}_${Date.now()}_${index + 1}.${extension}`,
    type,
  });
}

function appendLocation(formData, location) {
  const coords = location?.coords || location || {};
  const latitude = Number(coords.latitude);
  const longitude = Number(coords.longitude);
  const accuracy = Number(coords.accuracy);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Fresh current location is required.");
  }

  formData.append("latitude", String(latitude));
  formData.append("longitude", String(longitude));
  formData.append("accuracy", String(Number.isFinite(accuracy) && accuracy > 0 ? accuracy : 999));
}

export async function submitSiteDelivery({
  scanText,
  location,
  receiverName = "",
  receiverPhone = "",
  remarks = "",
  photos = [],
}) {
  if (!Array.isArray(photos) || photos.length < 1) {
    throw new Error("Take at least one delivery photo.");
  }

  const formData = new FormData();
  formData.append("scanText", clean(scanText));
  appendLocation(formData, location);
  formData.append("receiverName", clean(receiverName));
  formData.append("receiverPhone", clean(receiverPhone));
  formData.append("remarks", clean(remarks));
  photos.slice(0, 4).forEach((photo, index) => appendFile(formData, photo, index, "delivery"));

  const response = await api.post("/api/site-lifecycle/deliver", formData, {
    timeout: 90000,
    headers: { Accept: "application/json" },
  });

  return response?.data || {};
}

export async function submitSiteOpening({
  scanText,
  location,
  remarks = "",
  photos = [],
}) {
  const formData = new FormData();
  formData.append("scanText", clean(scanText));
  appendLocation(formData, location);
  formData.append("remarks", clean(remarks));
  photos.slice(0, 2).forEach((photo, index) => appendFile(formData, photo, index, "opening"));

  const response = await api.post("/api/site-lifecycle/open", formData, {
    timeout: 90000,
    headers: { Accept: "application/json" },
  });

  return response?.data || {};
}
