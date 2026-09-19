import API from "../../../services/api";

const BASE = "/matflow";
const cleanParams = (params = {}) => Object.fromEntries(
  Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "")
);
const id = (value, label = "ID") => {
  const clean = String(value ?? "").trim();
  if (!clean) throw new Error(`${label} is required.`);
  return encodeURIComponent(clean);
};

/*
 * MatFlow screens frequently share the same Projects / Production Files / BOM
 * reference data during route changes. Keep a tiny in-memory read-through cache
 * and deduplicate identical in-flight GETs. Mutations invalidate the cache both
 * before and after the write, so workflow actions never leave stale operational
 * state behind.
 */
const readCache = new Map();
const inflightReads = new Map();
let readGeneration = 0;

const stableParamsKey = (params = {}) => JSON.stringify(
  Object.entries(cleanParams(params))
    .sort(([left], [right]) => left.localeCompare(right))
);

const readKey = (path, params) => `${path}?${stableParamsKey(params)}`;

const cachedGet = (path, params = {}, ttlMs = 6000) => {
  const cleaned = cleanParams(params);
  const key = readKey(path, cleaned);
  const now = Date.now();
  const cached = readCache.get(key);
  if (cached && cached.expiresAt > now) return Promise.resolve(cached.response);

  if (inflightReads.has(key)) return inflightReads.get(key);

  const generation = readGeneration;
  const request = API.get(path, { params: cleaned })
    .then((response) => {
      if (generation === readGeneration) {
        readCache.set(key, { response, expiresAt: Date.now() + ttlMs });
      }
      return response;
    })
    .finally(() => {
      if (inflightReads.get(key) === request) inflightReads.delete(key);
    });

  inflightReads.set(key, request);
  return request;
};

const invalidateMatFlowReads = () => {
  readGeneration += 1;
  readCache.clear();
  inflightReads.clear();
};

const mutate = async (factory) => {
  invalidateMatFlowReads();
  try {
    return await factory();
  } finally {
    invalidateMatFlowReads();
  }
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
  clearReadCache: invalidateMatFlowReads,
  metadata: () => cachedGet(`${BASE}/meta`, {}, 60000),

  // Projects / products
  listProjects: (params = {}) => cachedGet(`${BASE}/projects`, params, 1500),
  getProject: (projectId) => cachedGet(`${BASE}/projects/${id(projectId, "Project ID")}`, {}, 1500),
  createProject: (body) => mutate(() => API.post(`${BASE}/projects`, body)),
  updateProject: (projectId, body) => mutate(() => API.put(`${BASE}/projects/${id(projectId, "Project ID")}`, body)),
  deactivateProject: (projectId, rowVersion) => mutate(() => API.delete(`${BASE}/projects/${id(projectId, "Project ID")}`, { params: { rowVersion } })),
  addProjectProduct: (projectId, body) => mutate(() => API.post(`${BASE}/projects/${id(projectId, "Project ID")}/products`, body)),
  addProjectProducts: (projectId, products) => mutate(() => API.post(`${BASE}/projects/${id(projectId, "Project ID")}/products/bulk`, { products })),
  updateProjectProduct: (projectId, productId, body) => mutate(() => API.put(`${BASE}/projects/${id(projectId)}/products/${id(productId)}`, body)),
  deactivateProjectProduct: (projectId, productId, rowVersion) => mutate(() => API.delete(`${BASE}/projects/${id(projectId)}/products/${id(productId)}`, { params: { rowVersion } })),
  uploadProductImage: (projectId, productId, file) => {
    const form = new FormData(); form.append("file", file);
    return mutate(() => API.post(`${BASE}/projects/${id(projectId)}/products/${id(productId)}/image`, form, { headers: { "Content-Type": "multipart/form-data" } }));
  },
  productImageUrl: (projectId, productId) => `${API.defaults?.baseURL || ""}${BASE}/projects/${id(projectId)}/products/${id(productId)}/image`,
  deleteProductImage: (projectId, productId) => mutate(() => API.delete(`${BASE}/projects/${id(projectId)}/products/${id(productId)}/image`)),

  // Design Department · Project/PD-level assignment workspace
  listDesignProjects: (params = {}) => cachedGet(`${BASE}/design-projects`, params, 1500),
  getDesignProject: (projectId) => cachedGet(`${BASE}/design-projects/${id(projectId, "Project ID")}`, {}, 1200),
  assignDesignProject: (projectId, body) => mutate(() => API.put(`${BASE}/design-projects/${id(projectId, "Project ID")}/assignment`, body)),
  updateDesignProjectChecklist: (projectId, itemKey, body) => mutate(() => API.put(`${BASE}/design-projects/${id(projectId, "Project ID")}/checklist/${encodeURIComponent(String(itemKey || ""))}`, body)),
  setDesignProjectChecklistLock: (projectId, body) => mutate(() => API.post(`${BASE}/design-projects/${id(projectId, "Project ID")}/checklist/lock`, body)),
  updateDesignProductProgress: (projectId, productId, body) => mutate(() => API.put(`${BASE}/design-projects/${id(projectId, "Project ID")}/products/${id(productId, "Product ID")}/progress`, body)),
  addDesignProjectLog: (projectId, body) => mutate(() => API.post(`${BASE}/design-projects/${id(projectId, "Project ID")}/logs`, body)),

  // Production control workspace
  listProductionFiles: (params = {}) => cachedGet(`${BASE}/workspace/files`, params, 1500),
  listDesignTasks: (params = {}) => cachedGet(`${BASE}/workspace/design-tasks`, params, 1500),
  getProductionFile: (fileId) => cachedGet(`${BASE}/workspace/files/${id(fileId, "Production File ID")}`, {}, 1200),
  updateProductionFileSetup: (fileId, body) => mutate(() => API.put(`${BASE}/workspace/files/${id(fileId)}/setup`, body)),
  updateChecklist: (fileId, area, itemKey, body) => mutate(() => API.put(`${BASE}/workspace/files/${id(fileId)}/checklists/${encodeURIComponent(area)}/${encodeURIComponent(itemKey)}`, body)),
  createDesignTask: (fileId, body) => mutate(() => API.post(`${BASE}/workspace/files/${id(fileId)}/design-tasks`, body)),
  updateDesignTask: (fileId, taskId, body) => mutate(() => API.put(`${BASE}/workspace/files/${id(fileId)}/design-tasks/${id(taskId)}`, body)),
  setDesignTaskStatus: (fileId, taskId, body) => mutate(() => API.post(`${BASE}/workspace/files/${id(fileId)}/design-tasks/${id(taskId)}/status`, body)),
  reviewDesignHead: (fileId, body) => mutate(() => API.post(`${BASE}/workspace/files/${id(fileId)}/design-head-review`, body)),
  submitDesign: (fileId, body) => mutate(() => API.post(`${BASE}/workspace/files/${id(fileId)}/designer-submit`, body)),
  ppcGate1: (fileId, body) => mutate(() => API.post(`${BASE}/workspace/files/${id(fileId)}/ppc-gate-1`, body)),
  engineeringDecision: (fileId, body) => mutate(() => API.post(`${BASE}/workspace/files/${id(fileId)}/engineering-decision`, body)),
  createQuery: (fileId, body) => mutate(() => API.post(`${BASE}/workspace/files/${id(fileId)}/queries`, body)),
  respondQuery: (fileId, queryId, body) => mutate(() => API.post(`${BASE}/workspace/files/${id(fileId)}/queries/${id(queryId)}/respond`, body)),
  closeQuery: (fileId, queryId, body) => mutate(() => API.post(`${BASE}/workspace/files/${id(fileId)}/queries/${id(queryId)}/close`, body)),
  createEngineeringTask: (fileId, body) => mutate(() => API.post(`${BASE}/workspace/files/${id(fileId)}/tasks`, body)),
  updateEngineeringTask: (fileId, taskId, body) => mutate(() => API.put(`${BASE}/workspace/files/${id(fileId)}/tasks/${id(taskId)}`, body)),
  setEngineeringTaskStatus: (fileId, taskId, body) => mutate(() => API.post(`${BASE}/workspace/files/${id(fileId)}/tasks/${id(taskId)}/status`, body)),
  uploadRevision: (fileId, { type, revisionNo, changeSummary, file }) => {
    const form = new FormData();
    form.append("type", type);
    form.append("revisionNo", revisionNo);
    if (changeSummary) form.append("changeSummary", changeSummary);
    form.append("file", file);
    return mutate(() => API.post(`${BASE}/workspace/files/${id(fileId)}/revisions`, form, { headers: { "Content-Type": "multipart/form-data" } }));
  },
  revisionFile: (fileId, revisionId) => API.get(`${BASE}/workspace/files/${id(fileId)}/revisions/${id(revisionId)}/file`, { responseType: "blob" }),
  reviewRevisionImpact: (fileId, revisionId, body) => mutate(() => API.post(`${BASE}/workspace/files/${id(fileId)}/revisions/${id(revisionId)}/impact`, body)),
  ppcGate2: (fileId, body) => mutate(() => API.post(`${BASE}/workspace/files/${id(fileId)}/ppc-gate-2`, body)),
  // Notification data is intentionally uncached; layout polling already coalesces it.
  notifications: (params = {}) => API.get(`${BASE}/workspace/notifications`, { params: cleanParams(params) }),
  markNotificationRead: (_referenceType, referenceId, params = {}) => mutate(() => API.post(`${BASE}/workspace/notifications/${id(referenceId)}/read`, null, { params: cleanParams(params) })),
  markAllNotificationsRead: (params = {}) => mutate(() => API.post(`${BASE}/workspace/notifications/read-all`, null, { params: cleanParams(params) })),

  // Materials / BOM
  listMaterials: (params = {}) => cachedGet(`${BASE}/materials`, params, 5000),
  createMaterial: (body) => mutate(() => API.post(`${BASE}/materials`, body)),
  updateMaterial: (materialId, body) => mutate(() => API.put(`${BASE}/materials/${id(materialId)}`, body)),
  listBoms: (params = {}) => cachedGet(`${BASE}/boms`, params, 1500),
  getBom: (bomId) => cachedGet(`${BASE}/boms/${id(bomId, "BOM ID")}`, {}, 1500),
  createBom: (body) => mutate(() => API.post(`${BASE}/boms`, body)),
  updateBom: (bomId, body) => mutate(() => API.put(`${BASE}/boms/${id(bomId)}`, body)),
  addBomLine: (bomId, body) => mutate(() => API.post(`${BASE}/boms/${id(bomId)}/lines`, body)),
  updateBomLine: (bomId, lineId, body) => mutate(() => API.put(`${BASE}/boms/${id(bomId)}/lines/${id(lineId)}`, body)),
  deleteBomLine: (bomId, lineId, rowVersion) => mutate(() => API.delete(`${BASE}/boms/${id(bomId)}/lines/${id(lineId)}`, { params: { rowVersion } })),
  deleteDraftBom: (bomId, rowVersion) => mutate(() => API.delete(`${BASE}/boms/${id(bomId)}`, { params: { rowVersion } })),
  submitBom: (bomId, body) => mutate(() => API.post(`${BASE}/boms/${id(bomId)}/submit`, body)),
  createBomRevision: (bomId, body) => mutate(() => API.post(`${BASE}/boms/${id(bomId)}/revisions`, body)),

  // Management
  dashboard: (params = {}) => cachedGet(`${BASE}/insights/dashboard`, params, 1500),
  engineeringKpis: (params = {}) => cachedGet(`${BASE}/insights/engineering-kpis`, params, 1500),
};

export const clearMatFlowReadCache = invalidateMatFlowReads;
