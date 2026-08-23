import API from "../../services/api";

const compactParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) =>
      value !== undefined && value !== null && value !== ""
    )
  );

const data = (response) => response?.data;

export const machFlowApi = {
  dashboard: async (plantCode) => data(await API.get("/machflow/dashboard", { params: compactParams({ plantCode }) })),

  workOrders: async (params = {}) => data(await API.get("/machflow/work-orders", { params: compactParams(params) })),
  workOrder: async (id) => data(await API.get(`/machflow/work-orders/${id}`)),
  createWorkOrder: async (payload) => data(await API.post("/machflow/work-orders", payload)),
  updateWorkOrder: async (id, payload) => data(await API.put(`/machflow/work-orders/${id}`, payload)),
  changeStatus: async (id, payload) => data(await API.post(`/machflow/work-orders/${id}/status`, payload)),

  equipment: async (params = {}) => data(await API.get("/machflow/equipment", { params: compactParams(params) })),
  equipmentOne: async (id) => data(await API.get(`/machflow/equipment/${id}`)),
  createEquipment: async (payload) => data(await API.post("/machflow/equipment", payload)),
  updateEquipment: async (id, payload) => data(await API.put(`/machflow/equipment/${id}`, payload)),

  teams: async (plantCode) => data(await API.get("/machflow/teams", { params: compactParams({ plantCode }) })),
  createTeam: async (payload) => data(await API.post("/machflow/teams", payload)),
  updateTeam: async (id, payload) => data(await API.put(`/machflow/teams/${id}`, payload)),

  plans: async (plantCode, activeOnly = false) => data(await API.get("/machflow/preventive-plans", {
    params: compactParams({ plantCode, activeOnly }),
  })),
  createPlan: async (payload) => data(await API.post("/machflow/preventive-plans", payload)),
  updatePlan: async (id, payload) => data(await API.put(`/machflow/preventive-plans/${id}`, payload)),
  generateDuePlans: async () => data(await API.post("/machflow/preventive-plans/generate-due")),

  calendar: async (params = {}) => data(await API.get("/machflow/calendar", { params: compactParams(params) })),
  reports: async (params = {}) => data(await API.get("/machflow/reports", { params: compactParams(params) })),
  categories: async () => data(await API.get("/machflow/categories")),
  plants: async () => data(await API.get("/machflow/plants")),
  users: async (plantCode) => data(await API.get("/machflow/users", { params: compactParams({ plantCode }) })),
};

export default machFlowApi;
