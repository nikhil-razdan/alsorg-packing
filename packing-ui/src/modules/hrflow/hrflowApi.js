import API from "../../services/api";

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

const downloadBlob = async (requestPromise) => {
	const response = await requestPromise;
	return response;
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

	listEmployees: (params = {}) =>
		API.get(`${BASE}/employees`, { params: cleanParams(params) }),
	getEmployee: (employeeId) =>
		API.get(`${BASE}/employees/${id(employeeId, "Employee ID")}`),

	publicGetApplication: (rawToken) =>
		API.get(`${BASE}/public/applications/${token(rawToken)}`),
	publicSaveApplication: (rawToken, body) =>
		API.put(`${BASE}/public/applications/${token(rawToken)}`, body),
	publicSubmitApplication: (rawToken, body) =>
		API.post(`${BASE}/public/applications/${token(rawToken)}/submit`, body),
	publicListDocuments: (rawToken) =>
		API.get(`${BASE}/public/applications/${token(rawToken)}/documents`),
	publicUploadDocument: (rawToken, { documentType, remarks, file }) => {
		const form = new FormData();
		form.append("documentType", documentType);
		if (String(remarks || "").trim()) form.append("remarks", String(remarks).trim());
		form.append("file", file);
		return API.post(
			`${BASE}/public/applications/${token(rawToken)}/documents`,
			form
		);
	},
	publicDownloadDocument: (rawToken, documentId) =>
		downloadBlob(
			API.get(
				`${BASE}/public/applications/${token(rawToken)}/documents/${id(documentId, "Document ID")}/download`,
				{ responseType: "blob" }
			)
		),

	publicOnboardingPortal: (rawToken) =>
		API.get(`${BASE}/public/onboarding/${token(rawToken)}`),
	publicAcknowledgeJoining: (rawToken) =>
		API.post(`${BASE}/public/onboarding/${token(rawToken)}/joining-report/acknowledge`),
	publicAcknowledgePolicy: (rawToken, body) =>
		API.post(`${BASE}/public/onboarding/${token(rawToken)}/policy/acknowledge`, body),
	publicAcceptNda: (rawToken, body) =>
		API.post(`${BASE}/public/onboarding/${token(rawToken)}/nda/accept`, body),
	publicAcceptDeclaration: (rawToken, body) =>
		API.post(`${BASE}/public/onboarding/${token(rawToken)}/declaration/accept`, body),
	publicAcknowledgeOrientation: (rawToken, body) =>
		API.post(`${BASE}/public/onboarding/${token(rawToken)}/orientation/acknowledge`, body),
	publicFeedbackQuestions: (rawToken) =>
		API.get(`${BASE}/public/onboarding/${token(rawToken)}/feedback/questions`),
	publicSubmitFeedback: (rawToken, body) =>
		API.post(`${BASE}/public/onboarding/${token(rawToken)}/feedback`, body),
};

export default hrflowApi;
