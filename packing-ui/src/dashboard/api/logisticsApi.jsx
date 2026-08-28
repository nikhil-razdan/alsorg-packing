import { API_BASE_URL } from "../../config";
import { secureFetch } from "../../services/api";

const buildAuthHeaders = (extra = {}) => ({ ...extra });

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

  const res = await secureFetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    cache: "no-store",
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

  const res = await secureFetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    cache: "no-store",
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

const normalizeOptionalHelperCount = (
  value
) => {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const parsed =
    Number(value);

  if (
    !Number.isInteger(parsed)
  ) {
    throw new Error(
      "Helpers/loaders must be a whole number"
    );
  }

  if (parsed < 0) {
    throw new Error(
      "Helpers/loaders cannot be negative"
    );
  }

  if (parsed > 999) {
    throw new Error(
      "Helpers/loaders cannot exceed 999"
    );
  }

  return parsed === 0
    ? null
    : parsed;
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

export async function previewDispatchChallan({
  itemIds,
  driverId,
  vehicleId,
  helperLoaderCount,
  dispatchTime,
  tripStart,
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
      "No items selected for challan preview"
    );
  }

  const finalHelperLoaderCount =
    normalizeOptionalHelperCount(
      helperLoaderCount
    );

  const cleanDriverId =
    String(driverId || "").trim() ||
    null;

  const cleanVehicleId =
    String(vehicleId || "").trim() ||
    null;

  const res =
    await requestBlob(
      "/api/chalaan/dispatch/preview",
      {
        method: "POST",

        body: {
          itemIds,

          driverId:
            cleanDriverId,

          vehicleId:
            cleanVehicleId,

          helperLoaderCount:
            finalHelperLoaderCount,

          dispatchTime:
            finalDispatchTime,

          tripStart:
            finalDispatchTime,
        },

        errorMessage:
          "Challan preview failed",
      }
    );

  return res.blob();
}

export async function updateDispatchChallanHelpers(
  challanNumber,
  helperLoaderCount
) {
  const cleanChallanNumber =
    String(
      challanNumber || ""
    ).trim();

  if (!cleanChallanNumber) {
    throw new Error(
      "Challan number is required"
    );
  }

  return requestJson(
    `/api/dispatched/challans/${encodeURIComponent(
      cleanChallanNumber
    )}/helpers`,
    {
      method: "POST",

      body: {
        helperLoaderCount:
          normalizeOptionalHelperCount(
            helperLoaderCount
          ),
      },

      errorMessage:
        "Failed to update helpers/loaders",
    }
  );
}

export async function createDispatchChallan({
  itemIds,
  driverId,
  vehicleId,
  helperLoaderCount,
  dispatchTime,
  tripStart,
  preview = true,
  utlMode = false,
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

  const cleanHelperLoaderCount =
    helperLoaderCount === null ||
      helperLoaderCount === undefined ||
      String(helperLoaderCount).trim() === ""
      ? null
      : Number(helperLoaderCount);

  if (
    cleanHelperLoaderCount !== null &&
    (
      !Number.isInteger(
        cleanHelperLoaderCount
      ) ||
      cleanHelperLoaderCount < 0 ||
      cleanHelperLoaderCount > 999
    )
  ) {
    throw new Error(
      "Helpers / loaders must be a whole number between 0 and 999"
    );
  }

  const challanBasePath =
    utlMode
      ? "/api/utl/chalaan"
      : "/api/chalaan";

  const res = await requestBlob(
    `${challanBasePath}/dispatch?preview=${preview ? "true" : "false"
    }`,
    {
      method: "POST",

      body: {
        itemIds,
        driverId: cleanDriverId,
        vehicleId: cleanVehicleId,

        helperLoaderCount:
          cleanHelperLoaderCount === 0
            ? null
            : cleanHelperLoaderCount,

        dispatchTime:
          finalDispatchTime,

        /*
         * Backward compatibility for old mobile/backend callers.
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

export async function fetchDispatchChallans({
  pageSize = 100,
} = {}) {
  /*
   * Compatibility helper for analytics/history screens that still need the
   * complete challan set. Never fall back to the legacy unbounded endpoint.
   * Read the server-side paged search contract sequentially so each database
   * request remains bounded while preserving complete results for existing
   * reports until dedicated aggregate/history APIs are introduced.
   */
  const safePageSize = Math.min(
    100,
    Math.max(1, Number(pageSize) || 100)
  );

  const rows = [];
  let page = 0;
  let previousPage = -1;

  while (true) {
    const result =
      await fetchDispatchChallansPage({
        page,
        size: safePageSize,
      });

    const pageRows =
      Array.isArray(result?.rows)
        ? result.rows
        : [];

    rows.push(...pageRows);

    if (!result?.hasNext) {
      return rows;
    }

    if (pageRows.length === 0) {
      throw new Error(
        "Dispatch challan paging stopped because the server returned an empty page with more history still indicated"
      );
    }

    const nextPage =
      Math.max(
        page + 1,
        Number(result?.pageNumber || page) + 1
      );

    if (nextPage <= page || nextPage === previousPage) {
      throw new Error(
        "Dispatch challan paging did not advance"
      );
    }

    previousPage = page;
    page = nextPage;
  }
}

export async function fetchDispatchChallansPage({
  page = 0,
  size = 50,
} = {}) {
  const safePage =
    Math.max(0, Number(page) || 0);

  const safeSize =
    Math.min(
      100,
      Math.max(1, Number(size) || 50)
    );

  const params =
    new URLSearchParams({
      page: String(safePage),
      size: String(safeSize),
    });

  const response =
    await secureFetch(
      `${API_BASE_URL}/api/dispatched/challans/search?${params.toString()}`,
      {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      }
    );

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      text ||
      "Failed to fetch dispatch challan history"
    );
  }

  const payload =
    await response.json();

  const rows =
    Array.isArray(payload)
      ? payload
      : [];

  const readNumberHeader =
    (name, fallback) => {
      const value =
        Number(
          response.headers.get(name)
        );

      return Number.isFinite(value)
        ? value
        : fallback;
    };

  const totalElements =
    Math.max(
      0,
      readNumberHeader(
        "X-Total-Elements",
        rows.length
      )
    );

  const totalPages =
    Math.max(
      0,
      readNumberHeader(
        "X-Total-Pages",
        totalElements > 0 ? 1 : 0
      )
    );

  const pageNumber =
    Math.max(
      0,
      readNumberHeader(
        "X-Page-Number",
        safePage
      )
    );

  const pageSize =
    Math.max(
      1,
      readNumberHeader(
        "X-Page-Size",
        safeSize
      )
    );

  const hasNextHeader =
    String(
      response.headers.get(
        "X-Has-Next"
      ) || ""
    )
      .trim()
      .toLowerCase();

  return {
    rows,
    totalElements,
    totalPages,
    pageNumber,
    pageSize,
    hasNext:
      hasNextHeader === "true" ||
      (
        totalPages > 0 &&
        pageNumber + 1 < totalPages
      ),
  };
}

export async function fetchDispatchChallanDetail(
  challanNumber
) {
  const cleanNumber =
    String(challanNumber || "").trim();

  if (!cleanNumber) {
    throw new Error(
      "Challan number is required"
    );
  }

  return requestJson(
    `/api/dispatched/challans/${encodeURIComponent(
      cleanNumber
    )}`,
    {
      errorMessage:
        "Failed to load dispatch challan",
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

  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 10000);

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

export async function fetchCustomChallanDetails(
  challanNumber
) {
  const cleanNumber =
    String(
      challanNumber || ""
    ).trim();

  if (!cleanNumber) {
    throw new Error(
      "Custom challan number missing"
    );
  }

  return requestJson(
    `/api/chalaan/custom/${encodeURIComponent(
      cleanNumber
    )}`,
    {
      method: "GET",
      errorMessage:
        "Failed to load custom challan details",
    }
  );
}

export async function updateCustomChallan(
  challanNumber,
  payload
) {
  const cleanNumber =
    String(
      challanNumber || ""
    ).trim();

  if (!cleanNumber) {
    throw new Error(
      "Custom challan number missing"
    );
  }

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
    `/api/chalaan/custom/${encodeURIComponent(
      cleanNumber
    )}?preview=true`,
    {
      method: "PUT",
      body: {
        ...payload,
        driverName,
        vehicleNumber,
        dispatchTime:
          finalDispatchTime,
      },
      errorMessage:
        "Custom challan update failed",
    }
  );

  const blob =
    await res.blob();

  return {
    blob,
    challanNo:
      getHeaderValue(
        res,
        "X-Challan-No",
        cleanNumber
      ),
    filename:
      getPdfFilename(
        res,
        `${cleanNumber}.pdf`
      ),
  };
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