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

export async function createDispatchChallan(payload) {
  const res = await fetch(
    `${API_BASE_URL}/api/logistics/dispatch/chalaan?preview=true`,
    {
      method: "POST",

      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },

      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to create dispatch trip");
  }

  const blob = await res.blob();

  return {
    blob,
    tripId: res.headers.get("X-Trip-Id"),
    challanNo: res.headers.get("X-Challan-No"),
  };
}

export async function fetchLogisticsTrips() {
  const res = await fetch(
    `${API_BASE_URL}/api/logistics/trips`,
    {
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to fetch trips");
  }

  return res.json();
}

export async function endLogisticsTrip(id, payload) {
  const res = await fetch(
    `${API_BASE_URL}/api/logistics/trips/${id}/end`,
    {
      method: "POST",

      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },

      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to end trip");
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

export async function fetchLogisticsTripItems(id) {
  const res = await fetch(
    `${API_BASE_URL}/api/logistics/trips/${id}/items`,
    {
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    const text = await res.text();

    throw new Error(
      text || "Failed to fetch trip items"
    );
  }

  return res.json();
}

export async function downloadTripChallan(id) {
  if (!id) {
    throw new Error("Trip id missing");
  }

  const res = await fetch(
    `${API_BASE_URL}/api/logistics/trips/${id}/challan`,
    {
      method: "GET",
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    const text = await res.text();

    throw new Error(
      text || "Failed to download challan"
    );
  }

  const blob = await res.blob();

  const disposition =
    res.headers.get("Content-Disposition") || "";

  let filename = "challan.pdf";

  const match =
    disposition.match(/filename="?([^"]+)"?/);

  if (match && match[1]) {
    filename = match[1];
  }

  const url =
    window.URL.createObjectURL(blob);

  const a =
    document.createElement("a");

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);

  a.click();

  a.remove();

  window.URL.revokeObjectURL(url);

  return {
    filename,
  };
}