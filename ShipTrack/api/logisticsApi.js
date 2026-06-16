import {
  api,
} from "./client";

export async function fetchDrivers() {
  const res = await api.get(
    "/api/logistics/drivers"
  );

  return res.data;
}

export async function fetchVehicles() {
  const res = await api.get(
    "/api/logistics/vehicles"
  );

  return res.data;
}

export async function fetchTrips() {
  const res = await api.get(
    "/api/logistics/trips"
  );

  return res.data;
}

export async function fetchTripItems(tripId) {
  const res = await api.get(
    `/api/logistics/trips/${tripId}/items`
  );

  return res.data;
}

export async function endTrip(
  tripId,
  payload
) {
  const res = await api.post(
    `/api/logistics/trips/${tripId}/end`,
    payload
  );

  return res.data;
}

export async function startTrip(
  tripId,
  payload = {}
) {
  const res = await api.post(
    `/api/logistics/trips/${tripId}/start`,
    payload
  );

  return res.data;
}

export async function updateTripLocation(
  tripId,
  payload
) {
  const res = await api.post(
    `/api/logistics/trips/${tripId}/location`,
    payload
  );

  return res.data;
}