import API from "../../services/api";

const compactParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) =>
      value !== undefined && value !== null && value !== ""
    )
  );

const data = (response) => response?.data;

const apiBase = String(API?.defaults?.baseURL || "/api").replace(/\/+$/, "");

const publicJson = async (path, options = {}) => {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    credentials: "omit",
    cache: "no-store",
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

export const machFlowApi = {
  /* Normal FlowSuite session probe used by the standalone request portal. */
  sessionMe: async () => data(await API.get("/auth/me")),

  /* Any authenticated FlowSuite employee - no MachFlow role required. */
  requesterContext: async () => data(await API.get("/machflow/requester/context")),
  myRequests: async () => data(await API.get("/machflow/requester/requests")),
  createRequesterRequest: async (payload) =>
    data(await API.post("/machflow/requester/requests", payload)),

  /*
   * Controlled non-FlowSuite gateway. Raw fetch intentionally omits browser
   * credentials and the shared Axios Authorization interceptor. Posting is still
   * protected by Reporter Code + PIN inside MachFlowService.
   */
  publicContext: async ({ asset, desk } = {}) => {
    const params = new URLSearchParams(compactParams({ asset, desk }));
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return publicJson(`/machflow/public/context${suffix}`);
  },
  publicAuthorise: async (payload) =>
    publicJson("/machflow/public/authorise", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  publicMyRequests: async (payload) =>
    publicJson("/machflow/public/requests/mine", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  publicCreateRequest: async (payload) =>
    publicJson("/machflow/public/requests", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  dashboard: async (plantCode, serviceDomain) =>
    data(await API.get("/machflow/dashboard", {
      params: compactParams({ plantCode, serviceDomain }),
    })),

  workOrders: async (params = {}) =>
    data(await API.get("/machflow/work-orders", { params: compactParams(params) })),
  workOrder: async (id) => data(await API.get(`/machflow/work-orders/${id}`)),
  createWorkOrder: async (payload) => data(await API.post("/machflow/work-orders", payload)),
  updateWorkOrder: async (id, payload) =>
    data(await API.put(`/machflow/work-orders/${id}`, payload)),
  assignWorkOrder: async (id, payload) =>
    data(await API.post(`/machflow/work-orders/${id}/assign`, payload)),
  changeStatus: async (id, payload) =>
    data(await API.post(`/machflow/work-orders/${id}/status`, payload)),

  /* Legacy authenticated machine-QR endpoints remain for old printed labels. */
  qrEquipment: async (token) => data(await API.get(`/machflow/qr/${token}`)),
  createQrComplaint: async (token, payload) =>
    data(await API.post(`/machflow/qr/${token}/request`, payload)),

  equipment: async (params = {}) =>
    data(await API.get("/machflow/equipment", { params: compactParams(params) })),
  equipmentOne: async (id) => data(await API.get(`/machflow/equipment/${id}`)),
  createEquipment: async (payload) => data(await API.post("/machflow/equipment", payload)),
  updateEquipment: async (id, payload) =>
    data(await API.put(`/machflow/equipment/${id}`, payload)),
  rotateEquipmentQr: async (id) =>
    data(await API.post(`/machflow/equipment/${id}/qr/rotate`)),

  teams: async (plantCode, serviceDomain) =>
    data(await API.get("/machflow/teams", {
      params: compactParams({ plantCode, serviceDomain }),
    })),
  createTeam: async (payload) => data(await API.post("/machflow/teams", payload)),
  updateTeam: async (id, payload) => data(await API.put(`/machflow/teams/${id}`, payload)),

  reporters: async (plantCode, activeOnly = false, search = "") =>
    data(await API.get("/machflow/reporters", {
      params: compactParams({ plantCode, activeOnly, search }),
    })),
  createReporter: async (payload) => data(await API.post("/machflow/reporters", payload)),
  updateReporter: async (id, payload) =>
    data(await API.put(`/machflow/reporters/${id}`, payload)),

  plans: async (plantCode, serviceDomain, activeOnly = false) =>
    data(await API.get("/machflow/preventive-plans", {
      params: compactParams({ plantCode, serviceDomain, activeOnly }),
    })),
  createPlan: async (payload) => data(await API.post("/machflow/preventive-plans", payload)),
  updatePlan: async (id, payload) =>
    data(await API.put(`/machflow/preventive-plans/${id}`, payload)),
  generateDuePlans: async (serviceDomain) =>
    data(await API.post("/machflow/preventive-plans/generate-due", null, {
      params: compactParams({ serviceDomain }),
    })),

  calendar: async (params = {}) =>
    data(await API.get("/machflow/calendar", { params: compactParams(params) })),
  reports: async (params = {}) =>
    data(await API.get("/machflow/reports", { params: compactParams(params) })),
  categories: async (serviceDomain) =>
    data(await API.get("/machflow/categories", { params: compactParams({ serviceDomain }) })),
  plants: async () => data(await API.get("/machflow/plants")),
  users: async (plantCode, serviceDomain) =>
    data(await API.get("/machflow/users", {
      params: compactParams({ plantCode, serviceDomain }),
    })),
};

export default machFlowApi;
