import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
	Alert,
	Box,
	Button,
	Checkbox,
	Chip,
	Divider,
	FormControlLabel,
	IconButton,
	MenuItem,
	Paper,
	Step,
	StepButton,
	Stepper,
	TextField,
	Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";

import hrflowApi from "./hrflowApi";
import {
	apiMessage,
	formatDateTime,
	humanize,
	saveBlob,
} from "./hrflowUtils";
import {
	ErrorAlert,
	LoadingBlock,
	PublicShell,
	StatusChip,
	fieldSx,
	hrColors,
	panelSx,
	primaryButtonSx,
	secondaryButtonSx,
} from "./HrFlowCommon";

const STEPS = [
	"Personal",
	"Address & Identity",
	"Family",
	"Education",
	"Employment",
	"Languages & Additional",
	"Documents",
	"Declaration",
];

const EDITABLE_STAGES = new Set(["NEW", "APPLICATION_SENT", "APPLICATION_IN_PROGRESS"]);

const applicationFromResponse = (payload, fallback = {}) => {
	if (!payload || typeof payload !== "object") return fallback;
	return (
		payload.application ||
		payload.candidate ||
		payload.detail ||
		payload.candidateDetail ||
		payload.data ||
		fallback
	);
};
const DOCUMENT_TYPES = [
	"PHOTO",
	"RESUME",
	"AADHAAR",
	"PAN",
	"DRIVING_LICENSE",
	"EDUCATION_CERTIFICATE",
	"EXPERIENCE_LETTER",
	"ADDRESS_PROOF",
	"OTHER",
];

const EMPTY_FAMILY = { name: "", relation: "", dateOfBirth: "", dependent: false };
const EMPTY_EDUCATION = { examination: "", boardOrUniversity: "", year: "", marksPercent: "" };
const EMPTY_EMPLOYMENT = {
	companyName: "",
	designation: "",
	fromDate: "",
	toDate: "",
	hrName: "",
	hrContact: "",
	lastSalary: "",
	reasonForLeaving: "",
};
const EMPTY_LANGUAGE = { language: "", canRead: false, canWrite: false, canSpeak: false };

function normalizeApplication(application = {}) {
	return {
		rowVersion: application.rowVersion ?? null,
		applicationType: application.applicationType || "STANDARD",
		fullName: application.fullName || "",
		fatherOrHusbandName: application.fatherOrHusbandName || "",
		maritalStatus: application.maritalStatus || "",
		gender: application.gender || "",
		dateOfBirth: application.dateOfBirth || "",
		email: application.email || "",
		mobileNo: application.mobileNo || "",
		postAppliedFor: application.postAppliedFor || "",
		workExperienceSummary: application.workExperienceSummary || "",
		educationalQualificationSummary: application.educationalQualificationSummary || "",
		previousAlsorgExperience: Boolean(application.previousAlsorgExperience),
		previousAlsorgExperienceDetails: application.previousAlsorgExperienceDetails || "",
		familyMemberWorkedAtAlsorg: Boolean(application.familyMemberWorkedAtAlsorg),
		familyMemberWorkedAtAlsorgDetails: application.familyMemberWorkedAtAlsorgDetails || "",
		vaccination: application.vaccination || "",
		presentAddress: application.presentAddress || "",
		permanentAddress: application.permanentAddress || "",
		aadhaarNo: application.aadhaarNo || "",
		panNo: application.panNo || "",
		nationality: application.nationality || "",
		religion: application.religion || "",
		drivingLicenseNo: application.drivingLicenseNo || "",
		familyContactNo: application.familyContactNo || "",
		referenceName: application.referenceName || "",
		salaryDrawn: application.salaryDrawn ?? "",
		salaryExpected: application.salaryExpected ?? "",
		extracurricularActivities: application.extracurricularActivities || "",
		hobbies: application.hobbies || "",
		awardsAppreciations: application.awardsAppreciations || "",
		organizationChartNote: application.organizationChartNote || "",
		declarationAccepted: Boolean(application.declarationAccepted),
		familyMembers: Array.isArray(application.familyMembers) ? application.familyMembers : [],
		educations: Array.isArray(application.educations) ? application.educations : [],
		employments: Array.isArray(application.employments) ? application.employments : [],
		languages: Array.isArray(application.languages) ? application.languages : [],
	};
}

function applicationPayload(form) {
	const numberOrNull = (value) => {
		if (value === "" || value === null || value === undefined) return null;
		const number = Number(value);
		return Number.isFinite(number) ? number : null;
	};
	const emptyToNull = (value) => {
		if (typeof value !== "string") return value;
		const clean = value.trim();
		return clean || null;
	};
	return {
		...form,
		salaryDrawn: numberOrNull(form.salaryDrawn),
		salaryExpected: numberOrNull(form.salaryExpected),
		familyMembers: form.familyMembers.map((row) => ({
			...row,
			name: emptyToNull(row.name),
			relation: emptyToNull(row.relation),
			dateOfBirth: emptyToNull(row.dateOfBirth),
		})),
		educations: form.educations.map((row) => ({
			...row,
			examination: emptyToNull(row.examination),
			boardOrUniversity: emptyToNull(row.boardOrUniversity),
			year: numberOrNull(row.year),
			marksPercent: numberOrNull(row.marksPercent),
		})),
		employments: form.employments.map((row) => ({
			...row,
			companyName: emptyToNull(row.companyName),
			designation: emptyToNull(row.designation),
			fromDate: emptyToNull(row.fromDate),
			toDate: emptyToNull(row.toDate),
			hrName: emptyToNull(row.hrName),
			hrContact: emptyToNull(row.hrContact),
			lastSalary: numberOrNull(row.lastSalary),
			reasonForLeaving: emptyToNull(row.reasonForLeaving),
		})),
		languages: form.languages.map((row) => ({
			...row,
			language: emptyToNull(row.language),
		})),
	};
}

export default function HrCandidateApplicationPage({ token }) {
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");
	const [stage, setStage] = useState("");
	const [candidateNumber, setCandidateNumber] = useState("");
	const [form, setForm] = useState(() => normalizeApplication());
	const [activeStep, setActiveStep] = useState(0);
	const [documents, setDocuments] = useState([]);
	const [documentType, setDocumentType] = useState("PHOTO");
	const [documentRemarks, setDocumentRemarks] = useState("");
	const [documentFile, setDocumentFile] = useState(null);

	const editable = EDITABLE_STAGES.has(stage);
	const isManagerial = form.applicationType === "MANAGERIAL_ADMINISTRATIVE";

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const [applicationResponse, documentResponse] = await Promise.all([
				hrflowApi.publicGetApplication(token),
				hrflowApi.publicListDocuments(token).catch(() => ({ data: [] })),
			]);
			const payload = applicationResponse.data || {};
			setStage(payload.stage || "");
			setCandidateNumber(payload.candidateNumber || "");
			setForm(normalizeApplication(applicationFromResponse(payload, {})));
			setDocuments(documentResponse.data || []);
		} catch (e) {
			setError(apiMessage(e, "This application link could not be opened."));
		} finally {
			setLoading(false);
		}
	}, [token]);

	useEffect(() => {
		load();
	}, [load]);

	const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

	const setArrayRow = (key, index, field, value) => {
		setForm((current) => ({
			...current,
			[key]: current[key].map((row, rowIndex) =>
				rowIndex === index ? { ...row, [field]: value } : row
			),
		}));
	};

	const addRow = (key, empty) => setForm((current) => ({ ...current, [key]: [...current[key], { ...empty }] }));
	const removeRow = (key, index) => setForm((current) => ({ ...current, [key]: current[key].filter((_, i) => i !== index) }));

	const save = async (submit = false) => {
		if (!editable) return;
		setSaving(true);
		setError("");
		setMessage("");
		try {
			const response = submit
				? await hrflowApi.publicSubmitApplication(token, applicationPayload(form))
				: await hrflowApi.publicSaveApplication(token, applicationPayload(form));
			const payload = response.data || {};
			setStage(payload.stage || stage);
			setForm(normalizeApplication(applicationFromResponse(payload, form)));
			setMessage(submit ? "Application submitted successfully." : "Draft saved successfully.");
			if (submit) setActiveStep(STEPS.length - 1);
		} catch (e) {
			setError(apiMessage(e, submit ? "Application could not be submitted." : "Draft could not be saved."));
		} finally {
			setSaving(false);
		}
	};

	const uploadDocument = async () => {
		if (!documentFile) {
			setError("Choose a file to upload.");
			return;
		}
		setSaving(true);
		setError("");
		try {
			await hrflowApi.publicUploadDocument(token, {
				documentType,
				remarks: documentRemarks,
				file: documentFile,
			});
			const response = await hrflowApi.publicListDocuments(token);
			setDocuments(response.data || []);
			setDocumentFile(null);
			setDocumentRemarks("");
			setMessage(`${humanize(documentType)} uploaded.`);
		} catch (e) {
			setError(apiMessage(e, "Document upload failed."));
		} finally {
			setSaving(false);
		}
	};

	const downloadDocument = async (doc) => {
		try {
			const response = await hrflowApi.publicDownloadDocument(token, doc.id);
			saveBlob(response, doc.originalFileName || "document");
		} catch (e) {
			setError(apiMessage(e, "Document download failed."));
		}
	};

	const stepContent = useMemo(() => {
		const disabled = !editable || saving;
		switch (activeStep) {
			case 0:
				return (
					<Section title="Personal information" subtitle="Basic details used across your application and joining records.">
						<Grid>
							<SelectField label="Application type" value={form.applicationType} onChange={(v) => update("applicationType", v)} disabled={disabled} options={["STANDARD", "MANAGERIAL_ADMINISTRATIVE"]} />
							<Field label="Post applied for *" value={form.postAppliedFor} onChange={(v) => update("postAppliedFor", v)} disabled={disabled} />
							<Field label="Full name *" value={form.fullName} onChange={(v) => update("fullName", v)} disabled={disabled} />
							<Field label="Father / Husband name" value={form.fatherOrHusbandName} onChange={(v) => update("fatherOrHusbandName", v)} disabled={disabled} />
							<Field type="date" label="Date of birth *" value={form.dateOfBirth} onChange={(v) => update("dateOfBirth", v)} disabled={disabled} shrink />
							<SelectField label="Gender" value={form.gender} onChange={(v) => update("gender", v)} disabled={disabled} options={["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]} />
							<SelectField label="Marital status" value={form.maritalStatus} onChange={(v) => update("maritalStatus", v)} disabled={disabled} options={["SINGLE", "MARRIED", "DIVORCED", "WIDOWED", "OTHER"]} />
							<Field label="Mobile number *" value={form.mobileNo} onChange={(v) => update("mobileNo", v)} disabled={disabled} />
							<Field label="Email" type="email" value={form.email} onChange={(v) => update("email", v)} disabled={disabled} />
							<Field label="Family contact number" value={form.familyContactNo} onChange={(v) => update("familyContactNo", v)} disabled={disabled} />
						</Grid>
					</Section>
				);
			case 1:
				return (
					<Section title="Address & identity" subtitle="Identity details are protected by the HRFlow backend and shown only to authorised HR users.">
						<Grid>
							<Field multiline rows={3} label="Present address *" value={form.presentAddress} onChange={(v) => update("presentAddress", v)} disabled={disabled} />
							<Field multiline rows={3} label="Permanent address *" value={form.permanentAddress} onChange={(v) => update("permanentAddress", v)} disabled={disabled} />
							<Field label="Aadhaar number" value={form.aadhaarNo} onChange={(v) => update("aadhaarNo", v)} disabled={disabled} />
							<Field label="PAN number" value={form.panNo} onChange={(v) => update("panNo", v)} disabled={disabled} />
							<Field label="Driving licence number" value={form.drivingLicenseNo} onChange={(v) => update("drivingLicenseNo", v)} disabled={disabled} />
							<Field label="Nationality" value={form.nationality} onChange={(v) => update("nationality", v)} disabled={disabled} />
							<Field label="Religion" value={form.religion} onChange={(v) => update("religion", v)} disabled={disabled} />
							<Field label="Vaccination status" value={form.vaccination} onChange={(v) => update("vaccination", v)} disabled={disabled} />
						</Grid>
					</Section>
				);
			case 2:
				return (
					<DynamicSection title="Family details" subtitle="Add family members as applicable." onAdd={() => addRow("familyMembers", EMPTY_FAMILY)} addLabel="Add family member" disabled={disabled}>
						{form.familyMembers.length === 0 ? <Hint text="No family members added yet." /> : form.familyMembers.map((row, index) => (
							<RowCard key={`family-${index}`} index={index} onRemove={() => removeRow("familyMembers", index)} disabled={disabled}>
								<Grid>
									<Field label="Name" value={row.name || ""} onChange={(v) => setArrayRow("familyMembers", index, "name", v)} disabled={disabled} />
									<Field label="Relation" value={row.relation || ""} onChange={(v) => setArrayRow("familyMembers", index, "relation", v)} disabled={disabled} />
									<Field type="date" label="Date of birth" value={row.dateOfBirth || ""} onChange={(v) => setArrayRow("familyMembers", index, "dateOfBirth", v)} disabled={disabled} shrink />
									<FormControlLabel control={<Checkbox checked={Boolean(row.dependent)} onChange={(e) => setArrayRow("familyMembers", index, "dependent", e.target.checked)} disabled={disabled} />} label="Dependent" />
								</Grid>
							</RowCard>
						))}
					</DynamicSection>
				);
			case 3:
				return (
					<DynamicSection title="Educational qualifications" subtitle="Add each relevant qualification." onAdd={() => addRow("educations", EMPTY_EDUCATION)} addLabel="Add education" disabled={disabled}>
						<Field multiline rows={2} label="Qualification summary" value={form.educationalQualificationSummary} onChange={(v) => update("educationalQualificationSummary", v)} disabled={disabled} />
						<Box sx={{ mt: 1.5 }} />
						{form.educations.map((row, index) => (
							<RowCard key={`education-${index}`} index={index} onRemove={() => removeRow("educations", index)} disabled={disabled}>
								<Grid>
									<Field label="Examination / Qualification" value={row.examination || ""} onChange={(v) => setArrayRow("educations", index, "examination", v)} disabled={disabled} />
									<Field label="Board / University" value={row.boardOrUniversity || ""} onChange={(v) => setArrayRow("educations", index, "boardOrUniversity", v)} disabled={disabled} />
									<Field type="number" label="Year" value={row.year ?? ""} onChange={(v) => setArrayRow("educations", index, "year", v)} disabled={disabled} />
									<Field type="number" label="Marks %" value={row.marksPercent ?? ""} onChange={(v) => setArrayRow("educations", index, "marksPercent", v)} disabled={disabled} />
								</Grid>
							</RowCard>
						))}
					</DynamicSection>
				);
			case 4:
				return (
					<DynamicSection title="Employment history" subtitle={isManagerial ? "The original managerial application requests the last two employers; add more if needed." : "Add previous employment where applicable."} onAdd={() => addRow("employments", EMPTY_EMPLOYMENT)} addLabel="Add employer" disabled={disabled}>
						<Field multiline rows={2} label="Work experience summary" value={form.workExperienceSummary} onChange={(v) => update("workExperienceSummary", v)} disabled={disabled} />
						<Box sx={{ mt: 1.5 }} />
						{form.employments.map((row, index) => (
							<RowCard key={`employment-${index}`} index={index} onRemove={() => removeRow("employments", index)} disabled={disabled}>
								<Grid>
									<Field label="Company" value={row.companyName || ""} onChange={(v) => setArrayRow("employments", index, "companyName", v)} disabled={disabled} />
									<Field label="Designation" value={row.designation || ""} onChange={(v) => setArrayRow("employments", index, "designation", v)} disabled={disabled} />
									<Field type="date" label="From" value={row.fromDate || ""} onChange={(v) => setArrayRow("employments", index, "fromDate", v)} disabled={disabled} shrink />
									<Field type="date" label="To" value={row.toDate || ""} onChange={(v) => setArrayRow("employments", index, "toDate", v)} disabled={disabled} shrink />
									<Field label="HR name" value={row.hrName || ""} onChange={(v) => setArrayRow("employments", index, "hrName", v)} disabled={disabled} />
									<Field label="HR contact" value={row.hrContact || ""} onChange={(v) => setArrayRow("employments", index, "hrContact", v)} disabled={disabled} />
									<Field type="number" label="Last salary" value={row.lastSalary ?? ""} onChange={(v) => setArrayRow("employments", index, "lastSalary", v)} disabled={disabled} />
									<Field label="Reason for leaving" value={row.reasonForLeaving || ""} onChange={(v) => setArrayRow("employments", index, "reasonForLeaving", v)} disabled={disabled} />
								</Grid>
							</RowCard>
						))}
					</DynamicSection>
				);
			case 5:
				return (
					<Section title="Languages & additional information" subtitle="Complete the additional information relevant to your application.">
						<Grid>
							<Field type="number" label="Current salary" value={form.salaryDrawn} onChange={(v) => update("salaryDrawn", v)} disabled={disabled} />
							<Field type="number" label="Expected salary" value={form.salaryExpected} onChange={(v) => update("salaryExpected", v)} disabled={disabled} />
							<Field label="Reference name" value={form.referenceName} onChange={(v) => update("referenceName", v)} disabled={disabled} />
							<Field label="Hobbies" value={form.hobbies} onChange={(v) => update("hobbies", v)} disabled={disabled} />
							<Field multiline rows={2} label="Extracurricular activities" value={form.extracurricularActivities} onChange={(v) => update("extracurricularActivities", v)} disabled={disabled} />
							<Field multiline rows={2} label="Awards / Appreciations" value={form.awardsAppreciations} onChange={(v) => update("awardsAppreciations", v)} disabled={disabled} />
						</Grid>
						<Box sx={{ mt: 2, display: "grid", gap: 1 }}>
							<FormControlLabel control={<Checkbox checked={form.previousAlsorgExperience} onChange={(e) => update("previousAlsorgExperience", e.target.checked)} disabled={disabled} />} label="Previously worked at Alsorg" />
							{form.previousAlsorgExperience ? <Field label="Previous Alsorg employment details" value={form.previousAlsorgExperienceDetails} onChange={(v) => update("previousAlsorgExperienceDetails", v)} disabled={disabled} /> : null}
							<FormControlLabel control={<Checkbox checked={form.familyMemberWorkedAtAlsorg} onChange={(e) => update("familyMemberWorkedAtAlsorg", e.target.checked)} disabled={disabled} />} label="Family member / blood relation works or worked at Alsorg" />
							{form.familyMemberWorkedAtAlsorg ? <Field label="Family member details" value={form.familyMemberWorkedAtAlsorgDetails} onChange={(v) => update("familyMemberWorkedAtAlsorgDetails", v)} disabled={disabled} /> : null}
						</Box>
						<Divider sx={{ my: 2.2 }} />
						<DynamicSection title="Language proficiency" subtitle="Mark your read, write and speak ability." onAdd={() => addRow("languages", EMPTY_LANGUAGE)} addLabel="Add language" disabled={disabled} nested>
							{form.languages.map((row, index) => (
								<RowCard key={`language-${index}`} index={index} onRemove={() => removeRow("languages", index)} disabled={disabled}>
									<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.4fr repeat(3,auto)" }, gap: 1, alignItems: "center" }}>
										<Field label="Language" value={row.language || ""} onChange={(v) => setArrayRow("languages", index, "language", v)} disabled={disabled} />
										<FormControlLabel control={<Checkbox checked={Boolean(row.canRead)} onChange={(e) => setArrayRow("languages", index, "canRead", e.target.checked)} disabled={disabled} />} label="Read" />
										<FormControlLabel control={<Checkbox checked={Boolean(row.canWrite)} onChange={(e) => setArrayRow("languages", index, "canWrite", e.target.checked)} disabled={disabled} />} label="Write" />
										<FormControlLabel control={<Checkbox checked={Boolean(row.canSpeak)} onChange={(e) => setArrayRow("languages", index, "canSpeak", e.target.checked)} disabled={disabled} />} label="Speak" />
									</Box>
								</RowCard>
							))}
						</DynamicSection>
					</Section>
				);
			case 6:
				return (
					<Section title="Documents" subtitle="Upload the documents requested by HR. Files are encrypted by the HRFlow backend. Document access remains available after final application submission while this secure link is active.">
						<Paper variant="outlined" sx={{ p: 1.7, borderRadius: 1.7, mb: 2, background: "var(--hr-surface)" }}>
								<Grid>
									<SelectField label="Document type" value={documentType} onChange={setDocumentType} disabled={saving} options={DOCUMENT_TYPES} />
									<Field label="Remarks" value={documentRemarks} onChange={setDocumentRemarks} disabled={saving} />
									<Button component="label" variant="outlined" startIcon={<UploadFileOutlinedIcon />} sx={secondaryButtonSx}>
										{documentFile ? documentFile.name : "Choose file"}
										<input hidden type="file" onChange={(e) => setDocumentFile(e.target.files?.[0] || null)} />
									</Button>
									<Button variant="contained" onClick={uploadDocument} disabled={saving || !documentFile} sx={primaryButtonSx}>
										Upload
									</Button>
								</Grid>
						</Paper>
						<Box sx={{ display: "grid", gap: 1 }}>
							{documents.length === 0 ? <Hint text="No documents uploaded yet." /> : documents.map((doc) => (
								<Paper key={doc.id} variant="outlined" sx={{ p: 1.35, borderRadius: 1.5, display: "flex", justifyContent: "space-between", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
									<Box>
										<Typography sx={{ fontWeight: 850, color: hrColors.ink, fontSize: 13.5 }}>{humanize(doc.documentType)}</Typography>
										<Typography sx={{ color: hrColors.muted, fontSize: 12, mt: .2 }}>{doc.originalFileName} • {formatDateTime(doc.uploadedAt)}</Typography>
									</Box>
									<Button size="small" startIcon={<DownloadOutlinedIcon />} onClick={() => downloadDocument(doc)} sx={secondaryButtonSx}>Download</Button>
								</Paper>
							))}
						</Box>
					</Section>
				);
			default:
				return (
					<Section title="Applicant declaration" subtitle="Review your information carefully before final submission.">
						<Alert severity="info" sx={{ borderRadius: 1.7, mb: 2 }}>
							By accepting this declaration, you confirm that the information provided in this employment application is true and complete to the best of your knowledge and may be verified by the company.
						</Alert>
						<FormControlLabel
							control={<Checkbox checked={form.declarationAccepted} onChange={(e) => update("declarationAccepted", e.target.checked)} disabled={disabled} />}
							label="I accept the applicant declaration and confirm the information provided is correct."
						/>
						{!editable ? (
							<Alert icon={<CheckCircleOutlineOutlinedIcon />} severity="success" sx={{ mt: 2, borderRadius: 1.7 }}>
								This application is no longer editable. Current status: {humanize(stage)}.
							</Alert>
						) : null}
					</Section>
				);
		}
	}, [activeStep, editable, form, saving, documentType, documentRemarks, documentFile, documents, isManagerial]);

	if (loading) return <PublicShell title="Employment Application" subtitle="Secure candidate application portal."><LoadingBlock /></PublicShell>;

	return (
		<PublicShell
			title="Employment Application"
			subtitle="Complete your application once. HRFlow will reuse approved information through the candidate-to-employee onboarding lifecycle."
			topRight={<Box sx={{ textAlign: "right" }}><StatusChip value={stage} /><Typography sx={{ mt: .5, fontSize: 11.5, color: hrColors.muted }}>{candidateNumber}</Typography></Box>}
		>
			<ErrorAlert error={error} onRetry={load} />
			{message ? <Alert severity="success" onClose={() => setMessage("")} sx={{ mb: 2, borderRadius: 1.7 }}>{message}</Alert> : null}

			<Paper sx={{ ...panelSx, p: { xs: 1, md: 1.5 }, mb: 2, overflowX: "auto" }}>
				<Stepper nonLinear activeStep={activeStep} alternativeLabel sx={{ minWidth: 760 }}>
					{STEPS.map((label, index) => (
						<Step key={label} completed={index < activeStep && Boolean(form.fullName)}>
							<StepButton onClick={() => setActiveStep(index)}>{label}</StepButton>
						</Step>
					))}
				</Stepper>
			</Paper>

			<Paper sx={{ ...panelSx, p: { xs: 1.8, md: 2.5 } }}>
				{stepContent}
				<Divider sx={{ my: 2.5 }} />
				<Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
					<Button variant="outlined" disabled={activeStep === 0 || saving} onClick={() => setActiveStep((s) => Math.max(0, s - 1))} sx={secondaryButtonSx}>Previous</Button>
					<Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
						{editable ? <Button variant="outlined" startIcon={<SaveOutlinedIcon />} disabled={saving} onClick={() => save(false)} sx={secondaryButtonSx}>Save draft</Button> : null}
						{activeStep < STEPS.length - 1 ? (
							<Button variant="contained" disabled={saving} onClick={() => setActiveStep((s) => Math.min(STEPS.length - 1, s + 1))} sx={primaryButtonSx}>Continue</Button>
						) : editable ? (
							<Button variant="contained" startIcon={<SendOutlinedIcon />} disabled={saving || !form.declarationAccepted} onClick={() => save(true)} sx={primaryButtonSx}>Submit application</Button>
						) : null}
					</Box>
				</Box>
			</Paper>
		</PublicShell>
	);
}

function Section({ title, subtitle, children }) {
	return <Box><Typography sx={{ fontSize: 18, fontWeight: 950, color: hrColors.ink }}>{title}</Typography><Typography sx={{ color: hrColors.muted, fontSize: 12.5, mt: .4, mb: 2 }}>{subtitle}</Typography>{children}</Box>;
}

function DynamicSection({ title, subtitle, children, onAdd, addLabel, disabled, nested = false }) {
	return (
		<Box>
			<Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center", flexWrap: "wrap", mb: nested ? 1.3 : 2 }}>
				<Box><Typography sx={{ fontSize: nested ? 15 : 18, fontWeight: 950, color: hrColors.ink }}>{title}</Typography><Typography sx={{ color: hrColors.muted, fontSize: 12.5, mt: .35 }}>{subtitle}</Typography></Box>
				<Button size="small" startIcon={<AddOutlinedIcon />} onClick={onAdd} disabled={disabled} sx={secondaryButtonSx}>{addLabel}</Button>
			</Box>
			{children}
		</Box>
	);
}

function Grid({ children }) {
	return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2,minmax(0,1fr))" }, gap: 1.4, alignItems: "start" }}>{children}</Box>;
}

function Field({ label, value, onChange, disabled, type = "text", multiline = false, rows, shrink = false }) {
	return <TextField fullWidth size="small" label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} type={type} multiline={multiline} rows={rows} InputLabelProps={shrink ? { shrink: true } : undefined} sx={fieldSx} />;
}

function SelectField({ label, value, onChange, disabled, options }) {
	return (
		<TextField select fullWidth size="small" label={label} value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} sx={fieldSx}>
			<MenuItem value=""><em>Not specified</em></MenuItem>
			{options.map((option) => <MenuItem key={option} value={option}>{humanize(option)}</MenuItem>)}
		</TextField>
	);
}

function RowCard({ index, onRemove, disabled, children }) {
	return (
		<Paper variant="outlined" sx={{ p: 1.4, borderRadius: 1.5, mb: 1.2, position: "relative", background: "var(--hr-card-bg-elevated)" }}>
			<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
				<Chip label={`Row ${index + 1}`} size="small" sx={{ borderRadius: 1, fontWeight: 800 }} />
				<IconButton size="small" onClick={onRemove} disabled={disabled} color="error"><DeleteOutlineOutlinedIcon fontSize="small" /></IconButton>
			</Box>
			{children}
		</Paper>
	);
}

function Hint({ text }) {
	return <Paper variant="outlined" sx={{ p: 2, borderRadius: 1.5, color: hrColors.muted, background: "var(--hr-surface)", borderStyle: "dashed" }}><Typography sx={{ fontSize: 13 }}>{text}</Typography></Paper>;
}
