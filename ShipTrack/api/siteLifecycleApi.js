import * as FileSystem from "expo-file-system/legacy";

import {
  API_BASE_URL,
  api,
  buildBearerToken,
  getStoredToken,
} from "./client";

const MAX_METADATA_IDS = 50;

const clean = (value) =>
  String(value ?? "").trim();

export function getSitePacketItemId(item) {
  return clean(
    item?.packetItemId ||
    item?.packetItem?.id ||
    item?.packetItem?.packetItemId ||
    item?.packetItemUuid ||
    item?.packet_item_id ||
    ""
  );
}

export function normalizeSiteStatus(value) {
  const cleanValue =
    clean(value).toUpperCase();

  if (
    cleanValue === "OPENED_ON_SITE" ||
    cleanValue === "OPENED"
  ) {
    return "OPENED_ON_SITE";
  }

  if (
    cleanValue === "DELIVERED" ||
    cleanValue === "DELIVERED_ON_SITE"
  ) {
    return "DELIVERED";
  }

  return "AWAITING_DELIVERY";
}

export function siteStatusLabel(value) {
  const status =
    normalizeSiteStatus(value);

  if (status === "OPENED_ON_SITE") {
    return "Opened On Site";
  }

  if (status === "DELIVERED") {
    return "Delivered On Site";
  }

  return "Awaiting Site Delivery";
}

export function getSiteMetadataForItem(
  item,
  metadataMap = {}
) {
  const packetItemId =
    getSitePacketItemId(item);

  if (!packetItemId) {
    return null;
  }

  return (
    metadataMap?.[packetItemId] ||
    null
  );
}

/*
 * Challan / list summary. A packet with a physical PacketItem link but no
 * lifecycle row yet is intentionally counted as Awaiting Site Delivery.
 */
export function summarizeSiteLifecycle(
  items = [],
  metadataMap = {}
) {
  const source =
    Array.isArray(items)
      ? items
      : [];

  const summary = {
    linkedPackets: 0,
    awaiting: 0,
    delivered: 0,
    opened: 0,
    evidencePhotos: 0,
    completedSiteActions: 0,
  };

  source.forEach((item) => {
    const packetItemId =
      getSitePacketItemId(item);

    if (!packetItemId) {
      return;
    }

    summary.linkedPackets += 1;

    const metadata =
      metadataMap?.[packetItemId] ||
      null;

    const status =
      normalizeSiteStatus(
        metadata?.siteStatus
      );

    if (status === "OPENED_ON_SITE") {
      summary.opened += 1;
      summary.completedSiteActions += 1;
    } else if (status === "DELIVERED") {
      summary.delivered += 1;
      summary.completedSiteActions += 1;
    } else {
      summary.awaiting += 1;
    }

    summary.evidencePhotos +=
      Number(
        metadata?.deliveryPhotoCount ||
        0
      ) +
      Number(
        metadata?.openingPhotoCount ||
        0
      );
  });

  if (summary.linkedPackets === 0) {
    summary.overallStatus =
      "NO_PACKET_LINK";
  } else if (
    summary.opened ===
    summary.linkedPackets
  ) {
    summary.overallStatus =
      "OPENED_ON_SITE";
  } else if (
    summary.awaiting === 0
  ) {
    summary.overallStatus =
      "DELIVERED";
  } else if (
    summary.completedSiteActions > 0
  ) {
    summary.overallStatus =
      "PARTIAL";
  } else {
    summary.overallStatus =
      "AWAITING_DELIVERY";
  }

  return summary;
}

export function siteSummaryLabel(
  summary
) {
  const status =
    clean(
      summary?.overallStatus
    ).toUpperCase();

  if (status === "OPENED_ON_SITE") {
    return "All Opened On Site";
  }

  if (status === "DELIVERED") {
    return "All Delivered / Opened";
  }

  if (status === "PARTIAL") {
    return "Site Proof In Progress";
  }

  if (status === "NO_PACKET_LINK") {
    return "No Packet Link";
  }

  return "Awaiting Site Delivery";
}

function normalizeIds(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map(clean)
        .filter(Boolean)
    )
  );
}

function buildMetadataQuery(ids) {
  return ids
    .map(
      (id) =>
        `ids=${encodeURIComponent(id)}`
    )
    .join("&");
}

/*
 * Read-only site metadata used by Dispatch/Admin screens.
 *
 * The backend hotfix exposes GET /api/site-lifecycle/metadata specifically so
 * a read does not cross the CSRF mutation boundary. Keep chunks small because
 * the endpoint accepts packet UUIDs in the query string.
 */
export async function fetchSiteLifecycleMetadata(
  packetItemIds = []
) {
  const ids =
    normalizeIds(packetItemIds);

  if (ids.length === 0) {
    return [];
  }

  const rows = [];

  for (
    let index = 0;
    index < ids.length;
    index += MAX_METADATA_IDS
  ) {
    const chunk =
      ids.slice(
        index,
        index + MAX_METADATA_IDS
      );

    const query =
      buildMetadataQuery(chunk);

    const response =
      await api.get(
        `/api/site-lifecycle/metadata?${query}`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

    if (Array.isArray(response?.data)) {
      rows.push(
        ...response.data
      );
    }
  }

  return rows;
}

export async function fetchSiteLifecycleMetadataMap(
  packetItemIds = []
) {
  const rows =
    await fetchSiteLifecycleMetadata(
      packetItemIds
    );

  const map = {};

  rows.forEach((row) => {
    const packetItemId =
      clean(row?.packetItemId);

    if (packetItemId) {
      map[packetItemId] = row;
    }
  });

  return map;
}

export async function fetchSiteLifecycleDetail(
  packetItemId
) {
  const cleanId =
    clean(packetItemId);

  if (!cleanId) {
    throw new Error(
      "Packet item id is required to inspect site proof."
    );
  }

  const response =
    await api.get(
      "/api/site-lifecycle/item",
      {
        params: {
          packetItemId:
            cleanId,
        },
        headers: {
          Accept:
            "application/json",
        },
      }
    );

  return response?.data || {};
}

function cleanBaseUrl(value) {
  return String(value || "")
    .replace(/\/+$/, "");
}

function cleanEvidenceId(value) {
  const id =
    clean(value);

  if (!id) {
    throw new Error(
      "Evidence id is required."
    );
  }

  if (
    id.includes("/") ||
    id.includes("\\") ||
    id.includes("?") ||
    id.includes("#")
  ) {
    throw new Error(
      "Evidence id is invalid."
    );
  }

  return id;
}

function evidenceCacheUri(id) {
  const safeId =
    id.replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

  const base =
    FileSystem.cacheDirectory ||
    FileSystem.documentDirectory;

  if (!base) {
    throw new Error(
      "ShipTrack file cache is unavailable."
    );
  }

  return `${base}shiptrack_site_evidence_${safeId}.img`;
}

/*
 * Evidence is never made public. React Native Image cannot add Authorization
 * headers reliably on every Android version, so download the protected bytes
 * into the app cache with the same bearer token used by the API client, then
 * render the resulting local URI.
 */
export async function downloadSiteEvidence(
  evidenceId
) {
  const id =
    cleanEvidenceId(
      evidenceId
    );

  const token =
    await getStoredToken();

  const bearer =
    buildBearerToken(token);

  if (!bearer) {
    throw new Error(
      "Login token missing. Please logout and login again."
    );
  }

  const destination =
    evidenceCacheUri(id);

  try {
    await FileSystem.deleteAsync(
      destination,
      {
        idempotent: true,
      }
    );
  } catch {
    /* Best-effort cleanup before a fresh authorized download. */
  }

  const url =
    `${cleanBaseUrl(API_BASE_URL)}/api/site-lifecycle/evidence?id=${encodeURIComponent(id)}`;

  const result =
    await FileSystem.downloadAsync(
      url,
      destination,
      {
        headers: {
          Authorization:
            bearer,

          Accept:
            "image/*",

          "X-Client-Type":
            "mobile",
        },
      }
    );

  if (!result?.uri) {
    throw new Error(
      "Evidence photo download failed."
    );
  }

  if (
    result.status &&
    Number(result.status) >= 400
  ) {
    try {
      await FileSystem.deleteAsync(
        result.uri,
        {
          idempotent: true,
        }
      );
    } catch {
      /* Ignore cache cleanup failure. */
    }

    throw new Error(
      `Evidence photo could not be loaded. Backend returned ${result.status}.`
    );
  }

  return {
    evidenceId: id,
    uri: result.uri,
  };
}

export async function deleteSiteEvidenceFiles(
  files = []
) {
  const uris =
    (Array.isArray(files)
      ? files
      : []
    )
      .map((entry) =>
        typeof entry === "string"
          ? clean(entry)
          : clean(entry?.uri)
      )
      .filter(Boolean);

  await Promise.all(
    uris.map((uri) =>
      FileSystem
        .deleteAsync(
          uri,
          {
            idempotent: true,
          }
        )
        .catch(() => {
          /* Cache cleanup must never block modal close/navigation. */
        })
    )
  );
}

export async function resolveSitePacket(scanText, mode) {
  const value = clean(scanText);
  const cleanMode = clean(mode).toUpperCase();

  if (!value) throw new Error("Scan a packet QR or enter Sticker Number.");
  if (!["DELIVERY", "OPENING"].includes(cleanMode)) {
    throw new Error("Site workflow mode is invalid.");
  }

  const response = await api.post("/api/site-lifecycle/resolve", {
    scanText: value,
    mode: cleanMode,
  });

  return response?.data || {};
}

function appendFile(formData, photo, index, prefix) {
  const uri = clean(photo?.uri);
  if (!uri) return;

  const extension = uri.toLowerCase().includes(".png")
    ? "png"
    : uri.toLowerCase().includes(".webp")
      ? "webp"
      : "jpg";

  const type = extension === "png"
    ? "image/png"
    : extension === "webp"
      ? "image/webp"
      : "image/jpeg";

  formData.append("photos", {
    uri,
    name: `${prefix}_${Date.now()}_${index + 1}.${extension}`,
    type,
  });
}

function appendLocation(formData, location) {
  const coords = location?.coords || location || {};
  const latitude = Number(coords.latitude);
  const longitude = Number(coords.longitude);
  const accuracy = Number(coords.accuracy);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Fresh current location is required.");
  }

  formData.append("latitude", String(latitude));
  formData.append("longitude", String(longitude));
  formData.append("accuracy", String(Number.isFinite(accuracy) && accuracy > 0 ? accuracy : 999));
}

export async function submitSiteDelivery({
  scanText,
  location,
  receiverName = "",
  receiverPhone = "",
  remarks = "",
  photos = [],
}) {
  if (!Array.isArray(photos) || photos.length < 1) {
    throw new Error("Take at least one delivery photo.");
  }

  const formData = new FormData();
  formData.append("scanText", clean(scanText));
  appendLocation(formData, location);
  formData.append("receiverName", clean(receiverName));
  formData.append("receiverPhone", clean(receiverPhone));
  formData.append("remarks", clean(remarks));
  photos.slice(0, 4).forEach((photo, index) => appendFile(formData, photo, index, "delivery"));

  const response = await api.post("/api/site-lifecycle/deliver", formData, {
    timeout: 90000,
    headers: { Accept: "application/json" },
  });

  return response?.data || {};
}

export async function submitSiteOpening({
  scanText,
  location,
  remarks = "",
  photos = [],
}) {
  const formData = new FormData();
  formData.append("scanText", clean(scanText));
  appendLocation(formData, location);
  formData.append("remarks", clean(remarks));
  photos.slice(0, 2).forEach((photo, index) => appendFile(formData, photo, index, "opening"));

  const response = await api.post("/api/site-lifecycle/open", formData, {
    timeout: 90000,
    headers: { Accept: "application/json" },
  });

  return response?.data || {};
}
