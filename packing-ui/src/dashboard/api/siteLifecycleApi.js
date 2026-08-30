import { API_BASE_URL } from "../../config";
import { secureFetch } from "../../services/api";

const jsonRequest = async (path, options = {}) => {
  const response = await secureFetch(
    `${API_BASE_URL}${path}`,
    {
      credentials: "include",
      cache: "no-store",
      ...options,
      headers: {
        Accept: "application/json",

        ...(
          options.body
            ? {
                "Content-Type":
                  "application/json",
              }
            : {}
        ),

        ...(options.headers || {}),
      },
    }
  );

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      text ||
        `Request failed (${response.status})`
    );
  }

  return {
    response,

    data:
      response.status === 204
        ? null
        : await response.json(),
  };
};

const headerNumber = (
  response,
  name,
  fallback = 0
) => {
  const parsed =
    Number(
      response?.headers?.get(name)
    );

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
};

/*
 * =========================================================
 * SITE LIFECYCLE REGISTER
 * =========================================================
 *
 * Read-only operational register.
 *
 * Existing PackFlow site lifecycle workflow is untouched.
 */
export async function fetchSiteLifecycleRegister({
  page = 0,
  size = 50,
  search = "",
  plant = "",
} = {}) {
  const params =
    new URLSearchParams({
      page: String(
        Math.max(
          0,
          Number(page) || 0
        )
      ),

      size: String(
        Math.min(
          100,
          Math.max(
            1,
            Number(size) || 50
          )
        )
      ),
    });

  if (
    String(search || "").trim()
  ) {
    params.set(
      "search",
      String(search).trim()
    );
  }

  if (
    String(plant || "").trim()
  ) {
    params.set(
      "plant",
      String(plant).trim()
    );
  }

  const {
    response,
    data,
  } =
    await jsonRequest(
      `/api/site-lifecycle/register?${params.toString()}`
    );

  return {
    rows:
      Array.isArray(data)
        ? data
        : [],

    pageNumber:
      headerNumber(
        response,
        "X-Page-Number",
        page
      ),

    pageSize:
      headerNumber(
        response,
        "X-Page-Size",
        size
      ),

    totalPages:
      Math.max(
        1,
        headerNumber(
          response,
          "X-Total-Pages",
          1
        )
      ),

    totalElements:
      headerNumber(
        response,
        "X-Total-Elements",
        Array.isArray(data)
          ? data.length
          : 0
      ),

    hasNext:
      String(
        response.headers.get(
          "X-Has-Next"
        ) || "false"
      )
        .toLowerCase() ===
      "true",
  };
}

/*
 * =========================================================
 * SITE LIFECYCLE METADATA
 * =========================================================
 *
 * Lightweight read-only metadata for Dispatch / Admin screens.
 *
 * IMPORTANT SECURITY BOUNDARY:
 * The browser must use GET here.  The previous POST crossed Spring
 * Security's CSRF mutation boundary even though this operation only reads
 * metadata, which caused InvalidCsrfTokenException / HTTP 403.
 *
 * SiteLifecycleController already exposes:
 * GET /api/site-lifecycle/metadata?ids=<uuid>&ids=<uuid>...
 *
 * No PackFlow mutation/status/routing behaviour is changed by this call.
 */
const SITE_METADATA_GET_BATCH_SIZE = 50;

const normalizePacketItemIds = (packetItemIds = []) =>
  Array.from(
    new Set(
      (Array.isArray(packetItemIds) ? packetItemIds : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  ).slice(0, 500);

export async function fetchSiteLifecycleMetadata(
  packetItemIds = [],
  { signal } = {}
) {
  const ids = normalizePacketItemIds(packetItemIds);

  if (ids.length === 0) {
    return [];
  }

  const rows = [];

  for (
    let index = 0;
    index < ids.length;
    index += SITE_METADATA_GET_BATCH_SIZE
  ) {
    const batch = ids.slice(
      index,
      index + SITE_METADATA_GET_BATCH_SIZE
    );

    const params = new URLSearchParams();

    batch.forEach((id) => {
      params.append("ids", id);
    });

    const { data } = await jsonRequest(
      `/api/site-lifecycle/metadata?${params.toString()}`,
      {
        method: "GET",
        signal,
      }
    );

    if (Array.isArray(data)) {
      rows.push(...data);
    }
  }

  return rows;
}

/*
 * =========================================================
 * SITE LIFECYCLE DETAIL
 * =========================================================
 *
 * REQUIRED by:
 *
 * src/pages/DispatchedItemsPage.jsx
 *
 * This is the missing export that caused the Vite/Rollup build error:
 *
 * "fetchSiteLifecycleDetail is not exported by
 *  src/dashboard/api/siteLifecycleApi.js"
 *
 * Read-only operation only.
 * It does not change Dispatch status, site status, evidence,
 * Warehouse state, UTL routing, challan state or any other
 * PackFlow workflow state.
 */
export async function fetchSiteLifecycleDetail(
  packetItemId
) {
  const id =
    String(
      packetItemId || ""
    ).trim();

  if (!id) {
    throw new Error(
      "Packet item ID is required"
    );
  }

  const params =
    new URLSearchParams({
      packetItemId:
        id,
    });

  const {
    data,
  } =
    await jsonRequest(
      `/api/site-lifecycle/item?${params.toString()}`
    );

  return (
    data &&
    typeof data === "object" &&
    !Array.isArray(data)
  )
    ? data
    : {};
}

/*
 * =========================================================
 * SITE EVIDENCE
 * =========================================================
 *
 * Protected authenticated evidence-photo read.
 *
 * Evidence remains private and is loaded as a Blob so the
 * Dispatch/Admin UI can create a temporary object URL.
 *
 * No public image URL is exposed.
 */
export async function fetchSiteEvidenceBlob(
  evidenceId
) {
  const id =
    String(
      evidenceId || ""
    ).trim();

  if (!id) {
    throw new Error(
      "Evidence ID is required"
    );
  }

  const response =
    await secureFetch(
      `${API_BASE_URL}/api/site-lifecycle/evidence?id=${encodeURIComponent(
        id
      )}`,
      {
        credentials:
          "include",

        cache:
          "no-store",

        headers: {
          Accept:
            "image/*",
        },
      }
    );

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      text ||
        "Unable to load site evidence"
    );
  }

  return response.blob();
}