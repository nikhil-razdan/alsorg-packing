import API from "../../../services/api";

const BASE = "/matflow/workspace";

const cleanParams = (params = {}) =>
    Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "")
    );

const requiredId = (value, label = "ID") => {
    const id = String(value ?? "").trim();
    if (!id) throw new Error(`${label} is required.`);
    return encodeURIComponent(id);
};

const upload = (url, file, params = {}) => {
    const body = new FormData();
    body.append("file", file);
    return API.post(url, body, {
        params: cleanParams(params),
        headers: { "Content-Type": "multipart/form-data" },
    });
};

/** Dedicated Design / Engineering workspace client. */
export const matflowWorkApi = {
    listDesignSubmissions: (params = {}) =>
        API.get(`${BASE}/design-submissions`, { params: cleanParams(params) }),
    getDesignSubmission: (id) =>
        API.get(`${BASE}/design-submissions/${requiredId(id, "Design submission ID")}`),
    createDesignSubmission: (body) =>
        API.post(`${BASE}/design-submissions`, body),
    updateDesignSubmission: (id, body) =>
        API.put(`${BASE}/design-submissions/${requiredId(id, "Design submission ID")}`, body),
    updateDesignChecklist: (id, itemKey, body) =>
        API.put(
            `${BASE}/design-submissions/${requiredId(id, "Design submission ID")}/checklist/${requiredId(itemKey, "Checklist item")}`,
            body
        ),
    uploadDesignDrawing: (id, file, revision, version) =>
        upload(`${BASE}/design-submissions/${requiredId(id, "Design submission ID")}/drawing`, file, {
            revision,
            version,
        }),
    getDesignDrawing: (id) =>
        API.get(`${BASE}/design-submissions/${requiredId(id, "Design submission ID")}/drawing`, {
            responseType: "blob",
        }),
    submitDesignSubmission: (id, version) =>
        API.post(`${BASE}/design-submissions/${requiredId(id, "Design submission ID")}/submit`, null, {
            params: { version },
        }),
    reviewDesignSubmission: (id, body) =>
        API.post(`${BASE}/design-submissions/${requiredId(id, "Design submission ID")}/review`, body),

    listTasks: (params = {}) =>
        API.get(`${BASE}/tasks`, { params: cleanParams(params) }),
    getTask: (id) =>
        API.get(`${BASE}/tasks/${requiredId(id, "Engineering task ID")}`),
    assignTask: (id, body) =>
        API.post(`${BASE}/tasks/${requiredId(id, "Engineering task ID")}/assign`, body),
    updateTask: (id, body) =>
        API.put(`${BASE}/tasks/${requiredId(id, "Engineering task ID")}`, body),
    updateTaskChecklist: (id, itemKey, body) =>
        API.put(
            `${BASE}/tasks/${requiredId(id, "Engineering task ID")}/checklist/${requiredId(itemKey, "Checklist item")}`,
            body
        ),
    setTaskStatus: (id, body) =>
        API.post(`${BASE}/tasks/${requiredId(id, "Engineering task ID")}/status`, body),
    uploadProductionDrawing: (id, file, revision, version) =>
        upload(`${BASE}/tasks/${requiredId(id, "Engineering task ID")}/production-drawing`, file, {
            revision,
            version,
        }),
    getProductionDrawing: (id) =>
        API.get(`${BASE}/tasks/${requiredId(id, "Engineering task ID")}/production-drawing`, {
            responseType: "blob",
        }),
    handover: (id, body) =>
        API.post(`${BASE}/tasks/${requiredId(id, "Engineering task ID")}/handover`, body),

    productContext: (projectId, productId) =>
        API.get(`${BASE}/product-context`, {
            params: { projectId, productId },
        }),
    people: (params = {}) =>
        API.get(`${BASE}/people`, { params: cleanParams(params) }),
    templates: () =>
        API.get(`${BASE}/checklist-templates`),

    notifications: (params = {}) =>
        API.get(`${BASE}/notifications`, { params: cleanParams(params) }),
    markNotificationRead: (referenceType, referenceId, params = {}) =>
        API.post(
            `${BASE}/notifications/${requiredId(referenceType, "Notification type")}/${requiredId(referenceId, "Notification reference")}/read`,
            null,
            { params: cleanParams(params) }
        ),
    markAllNotificationsRead: (params = {}) =>
        API.post(`${BASE}/notifications/read-all`, null, { params: cleanParams(params) }),
};

export default matflowWorkApi;
