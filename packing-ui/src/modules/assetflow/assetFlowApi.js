import API, { publicApiFetch } from "../../services/api";

const compactParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) =>
      value !== undefined && value !== null && value !== ""
    )
  );

const data = (response) => response?.data;

const apiBase = String(API?.defaults?.baseURL || "/api").replace(/\/+$/, "");

const pathSegment = (value, label = "ID") => {
  const clean = String(value ?? "").trim();
  if (!clean) throw new Error(`${label} is required.`);
  return encodeURIComponent(clean);
};

/*
 * AssetFlow has an intentionally public Reporter-Pass gateway. The shared
 * publicApiFetch transport uses the browser's native fetch captured before the
 * FlowSuite compatibility patch and forces credentials: "omit". Reporter Code
 * + PIN remains the gateway identity; an unrelated FlowSuite login cookie is
 * never sent with these requests.
 */
const publicJson = async (path, options = {}) => {
  const response = await publicApiFetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  const raw = await response.text();
  let payload = null;

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
    }
  }

  if (!response.ok) {
    const message =
      (payload && typeof payload === "object" && (payload.message || payload.error)) ||
      (typeof payload === "string" && payload) ||
      `Request failed (${response.status})`;

    const error = new Error(message);
    error.status = response.status;
    error.data = payload;
    throw error;
  }

  return payload;
};

export const assetFlowApi = {
  /* Normal FlowSuite session probe used by the standalone request portal. */
  sessionMe: async () => data(await API.get("/auth/me")),

  /* Any authenticated FlowSuite employee - no AssetFlow role required. */
  requesterContext: async () => data(await API.get("/assetflow/requester/context")),
  myRequests: async () => data(await API.get("/assetflow/requester/requests")),
  createRequesterRequest: async (payload) =>
    data(await API.post("/assetflow/requester/requests", payload)),

  /*
   * Controlled non-FlowSuite gateway. Public transport intentionally omits the
   * FlowSuite session cookie and all identity/CSRF headers. Posting is still
   * protected by Reporter Code + PIN inside AssetFlowService.
   */
  publicContext: async ({ asset, desk } = {}) => {
    const params = new URLSearchParams(compactParams({ asset, desk }));
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return publicJson(`/assetflow/public/context${suffix}`);
  },
  publicAuthorise: async (payload) =>
    publicJson("/assetflow/public/authorise", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  publicMyRequests: async (payload) =>
    publicJson("/assetflow/public/requests/mine", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  publicCreateRequest: async (payload) =>
    publicJson("/assetflow/public/requests", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  dashboard: async (plantCode, serviceDomain) =>
    data(await API.get("/assetflow/dashboard", {
      params: compactParams({ plantCode, serviceDomain }),
    })),

  workOrders: async (params = {}) =>
    data(await API.get("/assetflow/work-orders", { params: compactParams(params) })),
  workOrder: async (id) => data(await API.get(`/assetflow/work-orders/${pathSegment(id)}`)),
  createWorkOrder: async (payload) => data(await API.post("/assetflow/work-orders", payload)),
  updateWorkOrder: async (id, payload) =>
    data(await API.put(`/assetflow/work-orders/${pathSegment(id)}`, payload)),
  assignWorkOrder: async (id, payload) =>
    data(await API.post(`/assetflow/work-orders/${pathSegment(id)}/assign`, payload)),
  changeStatus: async (id, payload) =>
    data(await API.post(`/assetflow/work-orders/${pathSegment(id)}/status`, payload)),

  /* Legacy authenticated machine-QR endpoints remain for old printed labels. */
  qrEquipment: async (token) => data(await API.get(`/assetflow/qr/${pathSegment(token, "QR token")}`)),
  createQrComplaint: async (token, payload) =>
    data(await API.post(`/assetflow/qr/${pathSegment(token, "QR token")}/request`, payload)),

  equipment: async (params = {}) =>
    data(await API.get("/assetflow/equipment", { params: compactParams(params) })),
  equipmentOne: async (id) => data(await API.get(`/assetflow/equipment/${pathSegment(id)}`)),
  createEquipment: async (payload) => data(await API.post("/assetflow/equipment", payload)),
  updateEquipment: async (id, payload) =>
    data(await API.put(`/assetflow/equipment/${pathSegment(id)}`, payload)),
  rotateEquipmentQr: async (id) =>
    data(await API.post(`/assetflow/equipment/${pathSegment(id)}/qr/rotate`)),

  teams: async (plantCode, serviceDomain) =>
    data(await API.get("/assetflow/teams", {
      params: compactParams({ plantCode, serviceDomain }),
    })),
  createTeam: async (payload) => data(await API.post("/assetflow/teams", payload)),
  updateTeam: async (id, payload) => data(await API.put(`/assetflow/teams/${pathSegment(id)}`, payload)),

  reporters: async (plantCode, activeOnly = false, search = "") =>
    data(await API.get("/assetflow/reporters", {
      params: compactParams({ plantCode, activeOnly, search }),
    })),
  createReporter: async (payload) => data(await API.post("/assetflow/reporters", payload)),
  updateReporter: async (id, payload) =>
    data(await API.put(`/assetflow/reporters/${pathSegment(id)}`, payload)),

  plans: async (plantCode, serviceDomain, activeOnly = false) =>
    data(await API.get("/assetflow/preventive-plans", {
      params: compactParams({ plantCode, serviceDomain, activeOnly }),
    })),
  createPlan: async (payload) => data(await API.post("/assetflow/preventive-plans", payload)),
  updatePlan: async (id, payload) =>
    data(await API.put(`/assetflow/preventive-plans/${pathSegment(id)}`, payload)),
  generateDuePlans: async (serviceDomain) =>
    data(await API.post("/assetflow/preventive-plans/generate-due", null, {
      params: compactParams({ serviceDomain }),
    })),

  calendar: async (params = {}) =>
    data(await API.get("/assetflow/calendar", { params: compactParams(params) })),
  reports: async (params = {}) =>
    data(await API.get("/assetflow/reports", { params: compactParams(params) })),
  categories: async (serviceDomain) =>
    data(await API.get("/assetflow/categories", { params: compactParams({ serviceDomain }) })),
  plants: async () => data(await API.get("/assetflow/plants")),
  users: async (plantCode, serviceDomain) =>
    data(await API.get("/assetflow/users", {
      params: compactParams({ plantCode, serviceDomain }),
    })),
};

export default assetFlowApi;
