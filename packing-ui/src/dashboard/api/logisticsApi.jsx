import { API_BASE_URL } from "../../config";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

export async function fetchDrivers() {
  const res = await fetch(
    `${API_BASE_URL}/api/logistics/master/drivers`,
    {
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    throw new Error("Failed drivers");
  }

  return res.json();
}

export async function fetchVehicles() {
  const res = await fetch(
    `${API_BASE_URL}/api/logistics/master/vehicles`,
    {
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    throw new Error("Failed vehicles");
  }

  return res.json();
}

export async function fetchShifts() {
  const res = await fetch(
    `${API_BASE_URL}/api/logistics/shifts`,
    {
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    throw new Error("Failed shifts");
  }

  return res.json();
}

export async function createShift(
  payload
) {
  const res = await fetch(
    `${API_BASE_URL}/api/logistics/shifts`,
    {
      method: "POST",

      headers: {
        ...authHeaders(),
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    throw new Error(
      "Failed create shift"
    );
  }

  return res.json();
}