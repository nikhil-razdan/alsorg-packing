import { API_BASE_URL } from "../../config";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

export async function fetchDrivers() {
  const res = await fetch(
    `${API_BASE_URL}/api/logistics/drivers`,
    {
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    throw new Error(
      "Failed to fetch drivers"
    );
  }

  return res.json();
}

export async function createDriver(
  payload
) {
  const res = await fetch(
    `${API_BASE_URL}/api/logistics/drivers`,
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
    const text = await res.text();

    throw new Error(text);
  }

  return res.json();
}

export async function deleteDriver(
  id
) {
  const res = await fetch(
    `${API_BASE_URL}/api/logistics/drivers/${id}`,
    {
      method: "DELETE",

      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    const text = await res.text();

    throw new Error(text);
  }
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
    const text =
      await res.text();

    throw new Error(text);
  }

  return res.json();
}

export async function deleteShift(
  id
) {
  const res = await fetch(
    `${API_BASE_URL}/api/logistics/shifts/${id}`,
    {
      method: "DELETE",

      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    const text =
      await res.text();

    throw new Error(text);
  }
}

export async function updateShift(
  id,
  payload
) {
  const res = await fetch(
    `${API_BASE_URL}/api/logistics/shifts/${id}`,
    {
      method: "PUT",

      headers: {
        ...authHeaders(),
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const text = await res.text();

    throw new Error(text);
  }

  return res.json();
}

export async function updateShiftStatus(
  id,
  status
) {
  const res = await fetch(
    `${API_BASE_URL}/api/logistics/shifts/${id}/status`,
    {
      method: "PATCH",

      headers: {
        ...authHeaders(),
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        status,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();

    throw new Error(text);
  }

  return res.json();
}


export async function fetchVehicles() {
  const res = await fetch(
    `${API_BASE_URL}/api/logistics/vehicles`,
    {
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    throw new Error("Failed vehicles");
  }

  return res.json();
}

export async function createVehicle(
  payload
) {
  const res = await fetch(
    `${API_BASE_URL}/api/logistics/vehicles`,
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
    const text =
      await res.text();

    throw new Error(text);
  }
  return res.json();
}

export async function deleteVehicle(id) {
  const res = await fetch(
    `${API_BASE_URL}/api/logistics/vehicles/${id}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    const text = await res.text();

    throw new Error(text);
  }
}