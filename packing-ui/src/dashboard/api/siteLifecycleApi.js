import { API_BASE_URL } from "../../config";
import { secureFetch } from "../../services/api";

const jsonRequest = async (path, options = {}) => {
  const response = await secureFetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    cache: "no-store",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed (${response.status})`);
  }

  return { response, data: response.status === 204 ? null : await response.json() };
};

const headerNumber = (response, name, fallback = 0) => {
  const parsed = Number(response?.headers?.get(name));
  return Number.isFinite(parsed) ? parsed : fallback;
};

export async function fetchSiteLifecycleRegister({
  page = 0,
  size = 50,
  search = "",
  plant = "",
} = {}) {
  const params = new URLSearchParams({
    page: String(Math.max(0, Number(page) || 0)),
    size: String(Math.min(100, Math.max(1, Number(size) || 50))),
  });

  if (String(search || "").trim()) params.set("search", String(search).trim());
  if (String(plant || "").trim()) params.set("plant", String(plant).trim());

  const { response, data } = await jsonRequest(
    `/api/site-lifecycle/register?${params.toString()}`
  );

  return {
    rows: Array.isArray(data) ? data : [],
    pageNumber: headerNumber(response, "X-Page-Number", page),
    pageSize: headerNumber(response, "X-Page-Size", size),
    totalPages: Math.max(1, headerNumber(response, "X-Total-Pages", 1)),
    totalElements: headerNumber(response, "X-Total-Elements", Array.isArray(data) ? data.length : 0),
    hasNext: String(response.headers.get("X-Has-Next") || "false").toLowerCase() === "true",
  };
}

export async function fetchSiteLifecycleMetadata(packetItemIds = [], { signal } = {}) {
  const ids = Array.from(
    new Set(
      (Array.isArray(packetItemIds) ? packetItemIds : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  ).slice(0, 500);

  if (ids.length === 0) return [];

  /*
   * This is a read-only enrichment request. Use GET so browser metadata refresh
   * does not participate in the CSRF mutation boundary. Chunking keeps each URL
   * comfortably below common proxy/request-line limits even for UUID values.
   * The legacy POST endpoint remains on the backend for compatibility.
   */
  const rows = [];
  const chunkSize = 50;

  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize);
    const params = new URLSearchParams();
    chunk.forEach((id) => params.append("ids", id));

    const { data } = await jsonRequest(
      `/api/site-lifecycle/metadata?${params.toString()}`,
      { signal }
    );

    if (Array.isArray(data)) rows.push(...data);
  }

  return rows;
}

export async function fetchSiteLifecycleDetail(packetItemId, { signal } = {}) {
  const id = String(packetItemId || "").trim();
  if (!id) throw new Error("Packet item ID is required");

  const { data } = await jsonRequest(
    `/api/site-lifecycle/item?packetItemId=${encodeURIComponent(id)}`,
    { signal }
  );

  return data || null;
}

export async function fetchSiteEvidenceBlob(evidenceId) {
  const id = String(evidenceId || "").trim();
  if (!id) throw new Error("Evidence ID is required");

  const response = await secureFetch(
    `${API_BASE_URL}/api/site-lifecycle/evidence?id=${encodeURIComponent(id)}`,
    {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "image/*" },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Unable to load site evidence");
  }

  return response.blob();
}
