import API from "../../../services/api";

const BASE = "/matflow";
const cleanParams = (params = {}) => Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""));
const id = (value, label = "ID") => {
  const clean = String(value ?? "").trim();
  if (!clean) throw new Error(`${label} is required.`);
  return encodeURIComponent(clean);
};

export const readMatFlowError = (error, fallback = "The MatFlow request failed.") => {
  const data = error?.response?.data;
  if (typeof data === "string") return data;
  const fields = data?.details?.fields && typeof data.details.fields === "object"
    ? Object.entries(data.details.fields).map(([key, value]) => `${key}: ${value}`)
    : [];
  const message = data?.message || data?.detail || error?.message || fallback;
  return fields.length ? [message, ...fields].join(" | ") : message;
};

export const matflowApi = {
  metadata: () => API.get(`${BASE}/meta`),

  // Projects / products
  listProjects: (params = {}) => API.get(`${BASE}/projects`, { params: cleanParams(params) }),
  getProject: (projectId) => API.get(`${BASE}/projects/${id(projectId, "Project ID")}`),
  createProject: (body) => API.post(`${BASE}/projects`, body),
  updateProject: (projectId, body) => API.put(`${BASE}/projects/${id(projectId, "Project ID")}`, body),
  deactivateProject: (projectId, rowVersion) => API.delete(`${BASE}/projects/${id(projectId, "Project ID")}`, { params: { rowVersion } }),
  addProjectProduct: (projectId, body) => API.post(`${BASE}/projects/${id(projectId, "Project ID")}/products`, body),
  addProjectProducts: (projectId, products) => API.post(`${BASE}/projects/${id(projectId, "Project ID")}/products/bulk`, { products }),
  updateProjectProduct: (projectId, productId, body) => API.put(`${BASE}/projects/${id(projectId)}/products/${id(productId)}`, body),
  deactivateProjectProduct: (projectId, productId, rowVersion) => API.delete(`${BASE}/projects/${id(projectId)}/products/${id(productId)}`, { params: { rowVersion } }),
  uploadProductImage: (projectId, productId, file) => {
    const form = new FormData(); form.append("file", file);
    return API.post(`${BASE}/projects/${id(projectId)}/products/${id(productId)}/image`, form, { headers: { "Content-Type": "multipart/form-data" } });
  },
  productImageUrl: (projectId, productId) => `${API.defaults?.baseURL || ""}${BASE}/projects/${id(projectId)}/products/${id(productId)}/image`,
  deleteProductImage: (projectId, productId) => API.delete(`${BASE}/projects/${id(projectId)}/products/${id(productId)}/image`),

  // Production control workspace
  listProductionFiles: (params = {}) => API.get(`${BASE}/workspace/files`, { params: cleanParams(params) }),
  listDesignTasks: (params = {}) => API.get(`${BASE}/workspace/design-tasks`, { params: cleanParams(params) }),
  getProductionFile: (fileId) => API.get(`${BASE}/workspace/files/${id(fileId, "Production File ID")}`),
  updateProductionFileSetup: (fileId, body) => API.put(`${BASE}/workspace/files/${id(fileId)}/setup`, body),
  updateChecklist: (fileId, area, itemKey, body) => API.put(`${BASE}/workspace/files/${id(fileId)}/checklists/${encodeURIComponent(area)}/${encodeURIComponent(itemKey)}`, body),
  createDesignTask: (fileId, body) => API.post(`${BASE}/workspace/files/${id(fileId)}/design-tasks`, body),
  updateDesignTask: (fileId, taskId, body) => API.put(`${BASE}/workspace/files/${id(fileId)}/design-tasks/${id(taskId)}`, body),
  setDesignTaskStatus: (fileId, taskId, body) => API.post(`${BASE}/workspace/files/${id(fileId)}/design-tasks/${id(taskId)}/status`, body),
  reviewDesignHead: (fileId, body) => API.post(`${BASE}/workspace/files/${id(fileId)}/design-head-review`, body),
  submitDesign: (fileId, body) => API.post(`${BASE}/workspace/files/${id(fileId)}/designer-submit`, body),
  ppcGate1: (fileId, body) => API.post(`${BASE}/workspace/files/${id(fileId)}/ppc-gate-1`, body),
  engineeringDecision: (fileId, body) => API.post(`${BASE}/workspace/files/${id(fileId)}/engineering-decision`, body),
  createQuery: (fileId, body) => API.post(`${BASE}/workspace/files/${id(fileId)}/queries`, body),
  respondQuery: (fileId, queryId, body) => API.post(`${BASE}/workspace/files/${id(fileId)}/queries/${id(queryId)}/respond`, body),
  closeQuery: (fileId, queryId, body) => API.post(`${BASE}/workspace/files/${id(fileId)}/queries/${id(queryId)}/close`, body),
  createEngineeringTask: (fileId, body) => API.post(`${BASE}/workspace/files/${id(fileId)}/tasks`, body),
  updateEngineeringTask: (fileId, taskId, body) => API.put(`${BASE}/workspace/files/${id(fileId)}/tasks/${id(taskId)}`, body),
  setEngineeringTaskStatus: (fileId, taskId, body) => API.post(`${BASE}/workspace/files/${id(fileId)}/tasks/${id(taskId)}/status`, body),
  uploadRevision: (fileId, { type, revisionNo, changeSummary, file }) => {
    const form = new FormData(); form.append("type", type); form.append("revisionNo", revisionNo); if (changeSummary) form.append("changeSummary", changeSummary); form.append("file", file);
    return API.post(`${BASE}/workspace/files/${id(fileId)}/revisions`, form, { headers: { "Content-Type": "multipart/form-data" } });
  },
  revisionFile: (fileId, revisionId) => API.get(`${BASE}/workspace/files/${id(fileId)}/revisions/${id(revisionId)}/file`, { responseType: "blob" }),
  reviewRevisionImpact: (fileId, revisionId, body) => API.post(`${BASE}/workspace/files/${id(fileId)}/revisions/${id(revisionId)}/impact`, body),
  ppcGate2: (fileId, body) => API.post(`${BASE}/workspace/files/${id(fileId)}/ppc-gate-2`, body),
  notifications: (params = {}) => API.get(`${BASE}/workspace/notifications`, { params: cleanParams(params) }),
  markNotificationRead: (_referenceType, referenceId, params = {}) => API.post(`${BASE}/workspace/notifications/${id(referenceId)}/read`, null, { params: cleanParams(params) }),
  markAllNotificationsRead: (params = {}) => API.post(`${BASE}/workspace/notifications/read-all`, null, { params: cleanParams(params) }),

  // Materials / BOM
  listMaterials: (params = {}) => API.get(`${BASE}/materials`, { params: cleanParams(params) }),
  createMaterial: (body) => API.post(`${BASE}/materials`, body),
  updateMaterial: (materialId, body) => API.put(`${BASE}/materials/${id(materialId)}`, body),
  listBoms: (params = {}) => API.get(`${BASE}/boms`, { params: cleanParams(params) }),
  getBom: (bomId) => API.get(`${BASE}/boms/${id(bomId, "BOM ID")}`),
  createBom: (body) => API.post(`${BASE}/boms`, body),
  updateBom: (bomId, body) => API.put(`${BASE}/boms/${id(bomId)}`, body),
  addBomLine: (bomId, body) => API.post(`${BASE}/boms/${id(bomId)}/lines`, body),
  updateBomLine: (bomId, lineId, body) => API.put(`${BASE}/boms/${id(bomId)}/lines/${id(lineId)}`, body),
  deleteBomLine: (bomId, lineId, rowVersion) => API.delete(`${BASE}/boms/${id(bomId)}/lines/${id(lineId)}`, { params: { rowVersion } }),
  deleteDraftBom: (bomId, rowVersion) => API.delete(`${BASE}/boms/${id(bomId)}`, { params: { rowVersion } }),
  submitBom: (bomId, body) => API.post(`${BASE}/boms/${id(bomId)}/submit`, body),
  createBomRevision: (bomId, body) => API.post(`${BASE}/boms/${id(bomId)}/revisions`, body),

  // Management
  dashboard: (params = {}) => API.get(`${BASE}/insights/dashboard`, { params: cleanParams(params) }),
  engineeringKpis: (params = {}) => API.get(`${BASE}/insights/engineering-kpis`, { params: cleanParams(params) }),
};
