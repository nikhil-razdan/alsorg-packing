import {
  api,
} from "./client";

export async function fetchDispatchedItems() {
  const res = await api.get(
    "/api/dispatched"
  );

  return res.data;
}

export async function updateDispatchStatus(
  zohoItemId,
  status
) {
  const res = await api.post(
    `/api/dispatched/${encodeURIComponent(
      zohoItemId
    )}/dispatch?status=${encodeURIComponent(status)}`
  );

  return res.data;
}

export async function moveToWarehouse(
  zohoItemId,
  warehouseCode,
  fromLocation = ""
) {
  const params =
    `warehouseCode=${encodeURIComponent(warehouseCode)}` +
    (fromLocation
      ? `&fromLocation=${encodeURIComponent(fromLocation)}`
      : "");

  const res = await api.post(
    `/api/dispatched/${encodeURIComponent(
      zohoItemId
    )}/store?${params}`
  );

  return res.data;
}

export async function requestReturnToDispatch(
  zohoItemId
) {
  const res = await api.post(
    `/api/dispatched/${encodeURIComponent(
      zohoItemId
    )}/request-return`
  );

  return res.data;
}