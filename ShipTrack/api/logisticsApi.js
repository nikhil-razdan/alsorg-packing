import {
  api,
} from "./client";

export async function fetchDrivers() {
  const res =
    await api.get(
      "/api/logistics/drivers"
    );

  return res.data;
}

export async function fetchVehicles() {
  const res =
    await api.get(
      "/api/logistics/vehicles"
    );

  return res.data;
}

export async function createDriver(payload = {}) {
  const name =
    String(payload.name || "").trim();

  if (!name) {
    throw new Error(
      "Driver name is required."
    );
  }

  const res =
    await api.post(
      "/api/logistics/drivers",
      {
        name,
      }
    );

  return res.data;
}

export async function createVehicle(payload = {}) {
  const vehicleNumber =
    String(
      payload.vehicleNumber || ""
    ).trim();

  if (!vehicleNumber) {
    throw new Error(
      "Vehicle number is required."
    );
  }

  const res =
    await api.post(
      "/api/logistics/vehicles",
      {
        vehicleNumber,
      }
    );

  return res.data;
}

export async function fetchDispatchedChallans() {
  const res =
    await api.get(
      "/api/dispatched/challans"
    );

  return Array.isArray(res.data)
    ? res.data
    : [];
}

/*
 * Legacy aliases.
 * Keep temporarily so old screen imports do not break.
 * These now return dispatched challans, not delivery trips.
 */
export async function fetchTrips() {
  return await fetchDispatchedChallans();
}

export async function fetchTripItems(challanNumber) {
  const challans =
    await fetchDispatchedChallans();

  const challan =
    challans.find(
      (item) =>
        item.challanNumber === challanNumber ||
        item.id === challanNumber
    );

  return challan?.items || [];
}

export async function endTrip() {
  throw new Error(
    "Driver delivery / POD flow has been removed."
  );
}

export async function startTrip() {
  throw new Error(
    "Driver trip start flow has been removed."
  );
}

export async function updateTripLocation() {
  throw new Error(
    "Live location flow has been removed."
  );
}

export async function endDispatchedChallanTrip(
  challanNumber,
  tripEndedAt
) {
  const res =
    await api.post(
      `/api/dispatched/challans/${encodeURIComponent(
        challanNumber
      )}/end-trip`,
      {
        tripEndedAt,
      }
    );

  return res.data;
}

