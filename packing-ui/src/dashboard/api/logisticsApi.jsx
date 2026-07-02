import { API_BASE_URL } from "../../config";


const requestJson = async (
  path,
  {
    method = "GET",
    body,
    headers = {},
    errorMessage = "Request failed",
  } = {}
) => {
  const finalHeaders = {
    ...headers,
  };

  const hasBody =
    body !== undefined &&
    body !== null;

  if (hasBody && !finalHeaders["Content-Type"]) {
    finalHeaders["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: finalHeaders,
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || errorMessage);
  }

  if (res.status === 204) {
    return null;
  }

  return res.json();
};

const requestBlob = async (
  path,
  {
    method = "GET",
    body,
    headers = {},
    errorMessage = "Download failed",
  } = {}
) => {
  const finalHeaders = {
    ...headers,
  };

  const hasBody =
    body !== undefined &&
    body !== null;

  if (hasBody && !finalHeaders["Content-Type"]) {
    finalHeaders["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: finalHeaders,
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || errorMessage);
  }

  return res;
};

export async function fetchDrivers() {
  return requestJson(
    "/api/logistics/drivers",
    {
      errorMessage: "Failed to fetch drivers",
    }
  );
}

export async function createDriver(
  payload
) {
  return requestJson(
    "/api/logistics/drivers",
    {
      method: "POST",
      body: payload,
      errorMessage: "Failed to create driver",
    }
  );
}

export async function deleteDriver(
  id
) {
  return requestJson(
    `/api/logistics/drivers/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      errorMessage: "Failed to delete driver",
    }
  );
}

export async function fetchShifts() {
  return requestJson(
    "/api/logistics/shifts",
    {
      errorMessage: "Failed shifts",
    }
  );
}

export async function createShift(
  payload
) {
  return requestJson(
    "/api/logistics/shifts",
    {
      method: "POST",
      body: payload,
      errorMessage: "Failed to create shift",
    }
  );
}

export async function deleteShift(
  id
) {
  return requestJson(
    `/api/logistics/shifts/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      errorMessage: "Failed to delete shift",
    }
  );
}

export async function updateShift(
  id,
  payload
) {
  return requestJson(
    `/api/logistics/shifts/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      body: payload,
      errorMessage: "Failed to update shift",
    }
  );
}

export async function updateShiftStatus(
  id,
  status
) {
  return requestJson(
    `/api/logistics/shifts/${encodeURIComponent(id)}/status`,
    {
      method: "PATCH",
      body: {
        status,
      },
      errorMessage: "Failed to update shift status",
    }
  );
}

export async function fetchVehicles() {
  return requestJson(
    "/api/logistics/vehicles",
    {
      errorMessage: "Failed vehicles",
    }
  );
}

export async function createVehicle(
  payload
) {
  return requestJson(
    "/api/logistics/vehicles",
    {
      method: "POST",
      body: payload,
      errorMessage: "Failed to create vehicle",
    }
  );
}

export async function updateVehicle(
  id,
  payload
) {
  return requestJson(
    `/api/logistics/vehicles/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      body: payload,
      errorMessage: "Vehicle update failed",
    }
  );
}

export async function deleteVehicle(
  id
) {
  return requestJson(
    `/api/logistics/vehicles/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      errorMessage: "Failed to delete vehicle",
    }
  );
}

export async function createDispatchChallan({
  itemIds,
  driverId,
  vehicleId,
  dispatchTime,
  tripStart,
  preview = true,
}) {
  const res = await fetch(
    `${API_BASE_URL}/api/chalaan/dispatch?preview=${preview}`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        itemIds,
        driverId,
        vehicleId,
        dispatchTime,
        tripStart,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Challan generation failed");
  }

  const blob = await res.blob();

  return {
    blob,
    challanNo:
      res.headers.get("X-Challan-No") ||
      "CHALAAN",
  };
}

export async function fetchLogisticsTrips() {
  return requestJson(
    "/api/logistics/trips",
    {
      errorMessage: "Failed to fetch trips",
    }
  );
}

export async function endLogisticsTrip(
  id,
  payload
) {
  return requestJson(
    `/api/logistics/trips/${encodeURIComponent(id)}/end`,
    {
      method: "POST",
      body: payload,
      errorMessage: "Failed to end trip",
    }
  );
}

export async function fetchLogisticsTripItems(
  id
) {
  return requestJson(
    `/api/logistics/trips/${encodeURIComponent(id)}/items`,
    {
      errorMessage: "Failed to fetch trip items",
    }
  );
}

export async function downloadTripChallan(
  id
) {
  if (!id) {
    throw new Error("Trip id missing");
  }

  const res = await requestBlob(
    `/api/logistics/trips/${encodeURIComponent(id)}/challan`,
    {
      method: "GET",
      errorMessage: "Failed to download challan",
    }
  );

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

export async function fetchVehicleExpenses(
  vehicleId
) {
  return requestJson(
    `/api/logistics/vehicles/${encodeURIComponent(vehicleId)}/expenses`,
    {
      errorMessage: "Failed to fetch vehicle expenses",
    }
  );
}

export async function createVehicleExpense(
  vehicleId,
  payload
) {
  return requestJson(
    `/api/logistics/vehicles/${encodeURIComponent(vehicleId)}/expenses`,
    {
      method: "POST",
      body: payload,
      errorMessage: "Failed to save vehicle expense",
    }
  );
}

export async function createCustomChallan(
  payload
) {
  const res = await requestBlob(
    "/api/chalaan/custom?preview=true",
    {
      method: "POST",
      body: payload,
      errorMessage: "Custom challan generation failed",
    }
  );

  const blob = await res.blob();

  return {
    blob,
    challanNo:
      res.headers.get("X-Challan-No") ||
      "CUSTOM_CHALLAN",
  };
}