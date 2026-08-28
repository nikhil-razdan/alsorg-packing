import API, { publicApiFetch } from "../../services/api";

const BASE = "/hrflow";

const cleanParams = (params = {}) =>
	Object.fromEntries(
		Object.entries(params).filter(([, value]) =>
			value !== undefined &&
			value !== null &&
			String(value).trim() !== ""
		)
	);

const id = (value, label = "ID") => {
	const clean = String(value ?? "").trim();
	if (!clean) {
		throw new Error(`${label} is required.`);
	}
	return encodeURIComponent(clean);
};

const token = (value) => id(value, "Token");

const styledFormKey = (formKey, style) => {
	const key = String(formKey || "").trim();
	const cleanStyle = String(style || "").trim().toUpperCase();
	if (!cleanStyle) return key;
	if (["ORIGINAL", "CLASSIC", "LEGACY"].includes(cleanStyle)) return `${key}_ORIGINAL`;
	if (["MODERN", "UPDATED", "NEW"].includes(cleanStyle)) return `${key}_MODERN`;
	return key;
};

const downloadBlob = async (requestPromise) => {
	const response = await requestPromise;
	return response;
};

const parsePublicJson = async (response) => {
	const text = await response.text();
	if (!text) return null;
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
};

/*
 * Candidate and onboarding links are token-authenticated public HRFlow flows,
 * not FlowSuite-session flows. Use the credential-free native transport so an
 * unrelated browser login cookie is never attached and a bad/expired public
 * token cannot mutate the ordinary authenticated SPA session state.
 */
const publicRequest = async (path, { method = "GET", body, responseType = "json" } = {}) => {
	const headers = { Accept: responseType === "blob" ? "application/octet-stream,application/pdf,*/*" : "application/json" };
	let requestBody = body;

	if (body !== undefined && body !== null && !(body instanceof FormData)) {
		headers["Content-Type"] = "application/json";
		requestBody = JSON.stringify(body);
	}

	const response = await publicApiFetch(`${BASE}${path}`, {
		method,
		headers,
		body: requestBody,
	});

	const responseData = responseType === "blob"
		? await response.blob()
		: await parsePublicJson(response);

	const compatibleResponse = {
		data: responseData,
		status: response.status,
		headers: response.headers,
	};

	if (!response.ok) {
		let message = `Request failed (${response.status})`;
		if (responseType !== "blob") {
			message = (responseData && typeof responseData === "object" && (responseData.message || responseData.error))
				|| (typeof responseData === "string" && responseData)
				|| message;
		}
		const error = new Error(message);
		error.response = compatibleResponse;
		throw error;
	}

	return compatibleResponse;
};

const hrflowApi = {
	me: () => API.get(`${BASE}/me`),

	listAccessGrants: () => API.get(`${BASE}/access-grants`),
	grantAccess: (body) => API.post(`${BASE}/access-grants`, body),
	revokeAccess: (grantId) => API.delete(`${BASE}/access-grants/${id(grantId, "Grant ID")}`),

	listCandidates: (params = {}) =>
		API.get(`${BASE}/candidates`, { params: cleanParams(params) }),
	createCandidate: (body) => API.post(`${BASE}/candidates`, body),
	getCandidate: (candidateId) =>
		API.get(`${BASE}/candidates/${id(candidateId, "Candidate ID")}`),
	updateCandidate: (candidateId, body) =>
		API.patch(`${BASE}/candidates/${id(candidateId, "Candidate ID")}`, body),
	deleteCandidate: (candidateId, rowVersion) =>
		API.delete(`${BASE}/candidates/${id(candidateId, "Candidate ID")}`, {
			params: { rowVersion },
		}),
	changeCandidateStage: (candidateId, body) =>
		API.post(`${BASE}/candidates/${id(candidateId, "Candidate ID")}/stage`, body),
	createApplicationLink: (candidateId) =>
		API.post(`${BASE}/candidates/${id(candidateId, "Candidate ID")}/application-link`),
	candidateAudit: (candidateId) =>
		API.get(`${BASE}/candidates/${id(candidateId, "Candidate ID")}/audit`),
	downloadFormTemplate: (formKey, style) =>
		downloadBlob(
			API.get(`${BASE}/candidates/reference/form-template/${id(styledFormKey(formKey, style), "Form key")}`, { responseType: "blob" })
		),
	downloadCandidateForm: (candidateId, formKey, style) =>
		downloadBlob(
			API.get(`${BASE}/candidates/${id(candidateId, "Candidate ID")}/form-pdf/${id(styledFormKey(formKey, style), "Form key")}`, { responseType: "blob" })
		),

	listCandidateDocuments: (candidateId, includeArchived = false) =>
		API.get(`${BASE}/candidates/${id(candidateId, "Candidate ID")}/documents`, {
			params: { includeArchived },
		}),
	candidateDocumentCompleteness: (candidateId) =>
		API.get(`${BASE}/candidates/${id(candidateId, "Candidate ID")}/documents/completeness`),
	uploadCandidateDocument: (candidateId, { documentType, remarks, file }) => {
		const form = new FormData();
		form.append("documentType", documentType);
		if (String(remarks || "").trim()) form.append("remarks", String(remarks).trim());
		form.append("file", file);
		return API.post(
			`${BASE}/candidates/${id(candidateId, "Candidate ID")}/documents`,
			form
		);
	},
	downloadCandidateDocument: (candidateId, documentId) =>
		downloadBlob(
			API.get(
				`${BASE}/candidates/${id(candidateId, "Candidate ID")}/documents/${id(documentId, "Document ID")}/download`,
				{ responseType: "blob" }
			)
		),
	archiveCandidateDocument: (candidateId, documentId) =>
		API.delete(
			`${BASE}/candidates/${id(candidateId, "Candidate ID")}/documents/${id(documentId, "Document ID")}`
		),

	listOnboarding: (params = {}) =>
		API.get(`${BASE}/onboarding`, { params: cleanParams(params) }),
	createOnboardingFromCandidate: (candidateId, body = {}) =>
		API.post(`${BASE}/onboarding/from-candidate/${id(candidateId, "Candidate ID")}`, body),
	getOnboarding: (onboardingId) =>
		API.get(`${BASE}/onboarding/${id(onboardingId, "Onboarding ID")}`),
	updateOnboarding: (onboardingId, body) =>
		API.patch(`${BASE}/onboarding/${id(onboardingId, "Onboarding ID")}`, body),
	createOnboardingPortalLink: (onboardingId) =>
		API.post(`${BASE}/onboarding/${id(onboardingId, "Onboarding ID")}/portal-link`),
	confirmJoining: (onboardingId, body = {}) =>
		API.post(`${BASE}/onboarding/${id(onboardingId, "Onboarding ID")}/confirm-joining`, body),
	getJoiningReport: (onboardingId) =>
		API.get(`${BASE}/onboarding/${id(onboardingId, "Onboarding ID")}/joining-report`),
	getPolicy: (onboardingId) =>
		API.get(`${BASE}/onboarding/${id(onboardingId, "Onboarding ID")}/policy`),
	setPolicy: (onboardingId, body) =>
		API.put(`${BASE}/onboarding/${id(onboardingId, "Onboarding ID")}/policy`, body),
	getNda: (onboardingId) =>
		API.get(`${BASE}/onboarding/${id(onboardingId, "Onboarding ID")}/nda`),
	setNda: (onboardingId, body) =>
		API.put(`${BASE}/onboarding/${id(onboardingId, "Onboarding ID")}/nda`, body),
	verifyNda: (onboardingId) =>
		API.post(`${BASE}/onboarding/${id(onboardingId, "Onboarding ID")}/nda/verify`),
	getDeclaration: (onboardingId) =>
		API.get(`${BASE}/onboarding/${id(onboardingId, "Onboarding ID")}/declaration`),
	setDeclaration: (onboardingId, body) =>
		API.put(`${BASE}/onboarding/${id(onboardingId, "Onboarding ID")}/declaration`, body),
	getOrientation: (onboardingId) =>
		API.get(`${BASE}/onboarding/${id(onboardingId, "Onboarding ID")}/orientation`),
	updateOrientation: (onboardingId, body) =>
		API.patch(`${BASE}/onboarding/${id(onboardingId, "Onboarding ID")}/orientation`, body),
	feedbackQuestions: () => API.get(`${BASE}/onboarding/reference/feedback-questions`),
	getFeedback: (onboardingId) =>
		API.get(`${BASE}/onboarding/${id(onboardingId, "Onboarding ID")}/feedback`),
	getCompletion: (onboardingId) =>
		API.get(`${BASE}/onboarding/${id(onboardingId, "Onboarding ID")}/completion`),
	completeOnboarding: (onboardingId) =>
		API.post(`${BASE}/onboarding/${id(onboardingId, "Onboarding ID")}/complete`),
	downloadOnboardingForm: (onboardingId, formKey) =>
		downloadBlob(
			API.get(`${BASE}/onboarding/${id(onboardingId, "Onboarding ID")}/form-pdf/${id(formKey, "Form key")}`, { responseType: "blob" })
		),

	listEmployees: (params = {}) =>
		API.get(`${BASE}/employees`, { params: cleanParams(params) }),
	getEmployee: (employeeId) =>
		API.get(`${BASE}/employees/${id(employeeId, "Employee ID")}`),
	downloadEmployeeForm: (employeeId, formKey, style) =>
		downloadBlob(
			API.get(`${BASE}/employees/${id(employeeId, "Employee ID")}/form-pdf/${id(styledFormKey(formKey, style), "Form key")}`, { responseType: "blob" })
		),

	publicGetApplication: (rawToken) =>
		publicRequest(`/public/applications/${token(rawToken)}`),
	publicSaveApplication: (rawToken, body) =>
		publicRequest(`/public/applications/${token(rawToken)}`, { method: "PUT", body }),
	publicSubmitApplication: (rawToken, body) =>
		publicRequest(`/public/applications/${token(rawToken)}/submit`, { method: "POST", body }),
	publicDownloadCandidateForm: (rawToken, formKey, style) =>
		downloadBlob(
			publicRequest(`/public/applications/${token(rawToken)}/form-pdf/${id(styledFormKey(formKey, style), "Form key")}`, { responseType: "blob" })
		),
	publicListDocuments: (rawToken) =>
		publicRequest(`/public/applications/${token(rawToken)}/documents`),
	publicUploadDocument: (rawToken, { documentType, remarks, file }) => {
		const form = new FormData();
		form.append("documentType", documentType);
		if (String(remarks || "").trim()) form.append("remarks", String(remarks).trim());
		form.append("file", file);
		return publicRequest(`/public/applications/${token(rawToken)}/documents`, {
			method: "POST",
			body: form,
		});
	},
	publicDownloadDocument: (rawToken, documentId) =>
		downloadBlob(
			publicRequest(
				`/public/applications/${token(rawToken)}/documents/${id(documentId, "Document ID")}/download`,
				{ responseType: "blob" }
			)
		),

	publicOnboardingPortal: (rawToken) =>
		publicRequest(`/public/onboarding/${token(rawToken)}`),
	publicDownloadOnboardingForm: (rawToken, formKey) =>
		downloadBlob(
			publicRequest(`/public/onboarding/${token(rawToken)}/form-pdf/${id(formKey, "Form key")}`, { responseType: "blob" })
		),
	publicAcknowledgeJoining: (rawToken) =>
		publicRequest(`/public/onboarding/${token(rawToken)}/joining-report/acknowledge`, { method: "POST" }),
	publicAcknowledgePolicy: (rawToken, body) =>
		publicRequest(`/public/onboarding/${token(rawToken)}/policy/acknowledge`, { method: "POST", body }),
	publicAcceptNda: (rawToken, body) =>
		publicRequest(`/public/onboarding/${token(rawToken)}/nda/accept`, { method: "POST", body }),
	publicAcceptDeclaration: (rawToken, body) =>
		publicRequest(`/public/onboarding/${token(rawToken)}/declaration/accept`, { method: "POST", body }),
	publicAcknowledgeOrientation: (rawToken, body) =>
		publicRequest(`/public/onboarding/${token(rawToken)}/orientation/acknowledge`, { method: "POST", body }),
	publicFeedbackQuestions: (rawToken) =>
		publicRequest(`/public/onboarding/${token(rawToken)}/feedback/questions`),
	publicSubmitFeedback: (rawToken, body) =>
		publicRequest(`/public/onboarding/${token(rawToken)}/feedback`, { method: "POST", body }),
};

export default hrflowApi;
