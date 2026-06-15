import {
  api,
} from "./client";

export async function resolveScan(scanText) {
  const res = await api.post(
    "/api/scanner/resolve",
    {
      scanText,
    }
  );

  return res.data;
}

export async function moveItemToFg(
  zohoItemId,
  fgZoneCode = ""
) {
  const query = fgZoneCode
    ? `?fgZoneCode=${encodeURIComponent(fgZoneCode)}`
    : "";

  const res = await api.post(
    `/api/dispatched/${encodeURIComponent(
      zohoItemId
    )}/move-to-fg${query}`
  );

  return res.data;
}

export async function dispatchSingleScan(payload) {
  const res = await api.post(
    "/api/scanner/dispatch-single?preview=true",
    payload,
    {
      responseType: "arraybuffer",
    }
  );

  return {
    success: true,
    tripId: res.headers?.["x-trip-id"],
    challanNo: res.headers?.["x-challan-no"],
  };
}

export async function dispatchBulkScans(payload) {
  const res = await api.post(
    "/api/scanner/dispatch-bulk?preview=true",
    payload,
    {
      responseType: "arraybuffer",
    }
  );

  return {
    success: true,
    tripId: res.headers?.["x-trip-id"],
    challanNo: res.headers?.["x-challan-no"],
  };
}