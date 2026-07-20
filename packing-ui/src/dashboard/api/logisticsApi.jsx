import { API_BASE_URL } from "../../config";

const getStoredToken = () => {
  const possibleKeys = [
    "token",
    "authToken",
    "jwt",
    "accessToken",
  ];

  for (const key of possibleKeys) {
    const value = localStorage.getItem(key);

    if (value && value.trim()) {
      const token = value.trim();

      return token.startsWith("Bearer ")
        ? token
        : `Bearer ${token}`;
    }
  }

  return "";
};

const buildAuthHeaders = (extra = {}) => {
  const headers = {
    ...extra,
  };

  const token = getStoredToken();

  if (token && !headers.Authorization) {
    headers.Authorization = token;
  }

  return headers;
};

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
    headers: buildAuthHeaders(finalHeaders),
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
    headers: buildAuthHeaders(finalHeaders),
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || errorMessage);
  }

  return res;
};

const normalizeLocalDateTime = (value) => {
  if (!value) {
    return undefined;
  }

  /*
   * IMPORTANT:
   * Do not convert using new Date(value).toISOString().
   * datetime-local already gives local business time:
   * 2026-07-03T14:30
   *
   * Backend LocalDateTime expects this local format.
   */
  return String(value)
    .trim()
    .replace(" ", "T")
    .slice(0, 16);
};

const getHeaderValue = (
  res,
  headerName,
  fallback = ""
) => {
  return res.headers.get(headerName) || fallback;
};

const getPdfFilename = (
  res,
  fallback = "challan.pdf"
) => {
  const disposition =
    res.headers.get("Content-Disposition") || "";

  const match =
    disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i);

  const filename =
    match?.[1] || match?.[2];

  return filename
    ? decodeURIComponent(filename)
    : fallback;
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
  const finalDispatchTime =
    normalizeLocalDateTime(
      dispatchTime || tripStart
    );

  if (
    !Array.isArray(itemIds) ||
    itemIds.length === 0
  ) {
    throw new Error(
      "No items selected for challan"
    );
  }

  if (!finalDispatchTime) {
    throw new Error(
      "Challan date and time is required"
    );
  }

  const cleanDriverId =
    String(driverId || "").trim() ||
    null;

  const cleanVehicleId =
    String(vehicleId || "").trim() ||
    null;

  const res = await requestBlob(
    `/api/chalaan/dispatch?preview=${preview ? "true" : "false"
    }`,
    {
      method: "POST",

      body: {
        itemIds,

        /*
         * Both fields are intentionally nullable.
         */
        driverId: cleanDriverId,
        vehicleId: cleanVehicleId,

        dispatchTime:
          finalDispatchTime,

        /*
         * Backward compatibility.
         */
        tripStart:
          finalDispatchTime,
      },

      errorMessage:
        "Challan generation failed",
    }
  );

  const blob = await res.blob();

  return {
    blob,

    challanNo:
      getHeaderValue(
        res,
        "X-Challan-No",
        "CHALAAN"
      ),

    filename:
      getPdfFilename(
        res,
        "challan.pdf"
      ),
  };
}

/*
 * =========================================================
 * CURRENT DISPATCH-CHALLAN FLOW
 * =========================================================
 *
 * This is the current source of truth for item-based trips.
 * Do not redirect these functions to /api/logistics/trips.
 */

export async function fetchDispatchChallans() {
  return requestJson(
    "/api/dispatched/challans",
    {
      errorMessage:
        "Failed to fetch dispatch challans",
    }
  );
}

export async function endDispatchChallanTrip(
  challanNumber,
  tripEndedAt
) {
  if (!challanNumber) {
    throw new Error(
      "Challan number is required"
    );
  }

  if (!tripEndedAt) {
    throw new Error(
      "Trip end time is required"
    );
  }

  return requestJson(
    `/api/dispatched/challans/${encodeURIComponent(
      challanNumber
    )}/end-trip`,
    {
      method: "POST",

      body: {
        tripEndedAt:
          normalizeLocalDateTime(
            tripEndedAt
          ),
      },

      errorMessage:
        "Failed to save trip end time",
    }
  );
}

export async function fetchDispatchChallanPdf(
  challanNumber
) {
  if (!challanNumber) {
    throw new Error(
      "Challan number is required"
    );
  }

  const response =
    await requestBlob(
      `/api/chalaan/dispatched/${encodeURIComponent(
        challanNumber
      )}/download`,
      {
        method: "GET",

        headers: {
          Accept: "application/pdf",
        },

        errorMessage:
          "Failed to load challan PDF",
      }
    );

  return response.blob();
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
  const finalDispatchTime =
    normalizeLocalDateTime(
      payload?.dispatchTime
    );

  if (!finalDispatchTime) {
    throw new Error(
      "Custom challan date and time is required"
    );
  }

  const driverName =
    String(
      payload?.driverName || ""
    ).trim() || null;

  const vehicleNumber =
    String(
      payload?.vehicleNumber || ""
    ).trim() || null;

  const res = await requestBlob(
    "/api/chalaan/custom?preview=true",
    {
      method: "POST",

      body: {
        ...payload,

        driverName,
        vehicleNumber,

        dispatchTime:
          finalDispatchTime,
      },

      errorMessage:
        "Custom challan generation failed",
    }
  );

  const blob = await res.blob();

  return {
    blob,

    challanNo:
      getHeaderValue(
        res,
        "X-Challan-No",
        "CUSTOM_CHALLAN"
      ),

    filename:
      getPdfFilename(
        res,
        "custom-challan.pdf"
      ),
  };
}

export async function fetchCustomChallans() {
  return requestJson(
    "/api/chalaan/custom",
    {
      errorMessage: "Failed to fetch custom challans",
    }
  );
}

export async function downloadCustomChallan(
  challanNumber
) {
  if (!challanNumber) {
    throw new Error("Custom challan number missing");
  }

  const res = await requestBlob(
    `/api/chalaan/custom/${encodeURIComponent(challanNumber)}/download?preview=true`,
    {
      method: "GET",
      errorMessage: "Failed to download custom challan",
    }
  );

  const blob = await res.blob();

  return {
    blob,
    challanNo:
      getHeaderValue(
        res,
        "X-Challan-No",
        challanNumber
      ),
    filename:
      getPdfFilename(
        res,
        `${challanNumber}.pdf`
      ),
  };
}