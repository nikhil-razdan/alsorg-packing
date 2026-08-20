import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
	Alert,
	Box,
	Button,
	Chip,
	Divider,
	FormControlLabel,
	MenuItem,
	Paper,
	Radio,
	RadioGroup,
	TextField,
	Typography,
} from "@mui/material";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";

import hrflowApi from "./hrflowApi";
import { apiMessage, formatDate, formatDateTime, humanize, saveBlob } from "./hrflowUtils";
import {
	CompletionBar,
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

const DOC_TYPES = ["PHOTO", "AADHAAR", "PAN", "RESUME", "DRIVING_LICENSE", "ADDRESS_PROOF", "EDUCATION_CERTIFICATE", "EXPERIENCE_LETTER", "OFFER_ACCEPTANCE", "OTHER"];

export default function HrOnboardingPortalPage({ token }) {
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");
	const [portal, setPortal] = useState(null);
	const [typedName, setTypedName] = useState("");
	const [documents, setDocuments] = useState([]);
	const [documentType, setDocumentType] = useState("PHOTO");
	const [documentFile, setDocumentFile] = useState(null);
	const [feedbackAnswers, setFeedbackAnswers] = useState({});

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const [portalResponse, documentsResponse] = await Promise.all([
				hrflowApi.publicOnboardingPortal(token),
				hrflowApi.publicListDocuments(token).catch(() => ({ data: [] })),
			]);
			setPortal(portalResponse.data || null);
			setDocuments(documentsResponse.data || []);
			setTypedName((current) => current || portalResponse.data?.candidateName || "");
		} catch (e) {
			setError(apiMessage(e, "This onboarding link could not be opened."));
		} finally {
			setLoading(false);
		}
	}, [token]);

	useEffect(() => { load(); }, [load]);

	const run = async (action, successMessage) => {
		setBusy(true);
		setError("");
		setMessage("");
		try {
			await action();
			setMessage(successMessage);
			await load();
		} catch (e) {
			setError(apiMessage(e));
		} finally {
			setBusy(false);
		}
	};

	const acceptance = { accepted: true, typedName: typedName.trim() };

	const upload = async () => {
		if (!documentFile) return setError("Choose a file to upload.");
		await run(async () => {
			await hrflowApi.publicUploadDocument(token, { documentType, file: documentFile, remarks: "Onboarding document" });
			setDocumentFile(null);
		}, `${humanize(documentType)} uploaded.`);
	};

	const download = async (doc) => {
		try {
			const response = await hrflowApi.publicDownloadDocument(token, doc.id);
			saveBlob(response, doc.originalFileName || "document");
		} catch (e) {
			setError(apiMessage(e, "Document download failed."));
		}
	};

	const downloadFormPdf = async (formKey, fileName) => {
		setBusy(true);
		setError("");
		try {
			const response = await hrflowApi.publicDownloadOnboardingForm(token, formKey);
			saveBlob(response, fileName);
		} catch (e) {
			setError(apiMessage(e, "Your onboarding PDF could not be downloaded."));
		} finally {
			setBusy(false);
		}
	};

	const feedbackQuestions = portal?.feedbackQuestions || [];
	const canSubmitFeedback = feedbackQuestions.length > 0 && feedbackQuestions.every((q) => feedbackAnswers[q.code]?.answer);
	const submitFeedback = () => run(
		() => hrflowApi.publicSubmitFeedback(token, {
			answers: feedbackQuestions.map((question) => ({
				code: question.code,
				answer: feedbackAnswers[question.code]?.answer,
				suggestion: feedbackAnswers[question.code]?.suggestion || null,
			})),
		}),
		"Induction feedback submitted."
	);

	const cards = useMemo(() => {
		if (!portal) return [];
		return [
			["Joining Report", Boolean(portal.joiningReport?.employeeAcknowledged), portal.joiningReport ? "Available" : "Waiting for HR"],
			["Policy", Boolean(portal.policyAcknowledgement), portal.policy ? `Version ${portal.policy.version}` : "Waiting for HR"],
			["NDA", Boolean(portal.ndaAcceptance), portal.nda ? `Version ${portal.nda.version}` : "Waiting for HR"],
			["Declaration", Boolean(portal.declarationAcceptance), portal.declaration ? `Version ${portal.declaration.version}` : "Waiting for HR"],
			["Orientation", Boolean(portal.orientation?.employeeAcknowledged), portal.orientation?.allRequiredCompleted ? "Ready to acknowledge" : "In progress"],
			["Feedback", Boolean(portal.feedbackSubmission), portal.feedbackSubmission ? "Submitted" : "Pending"],
		];
	}, [portal]);

	if (loading) return <PublicShell title="Employee Onboarding" subtitle="Secure ALSORG onboarding portal."><LoadingBlock /></PublicShell>;

	return (
		<PublicShell
			title={`Welcome${portal?.candidateName ? `, ${portal.candidateName}` : ""}`}
			subtitle="Complete your joining acknowledgements, documents, orientation confirmation and induction feedback from one secure onboarding portal."
			topRight={<Box sx={{ textAlign: "right" }}><StatusChip value={portal?.status} /><Typography sx={{ mt: .5, fontSize: 11.5, color: hrColors.muted }}>{portal?.candidateNumber}</Typography></Box>}
		>
			<ErrorAlert error={error} onRetry={load} />
			{message ? <Alert severity="success" onClose={() => setMessage("")} sx={{ mb: 2, borderRadius: 1.7 }}>{message}</Alert> : null}

			{portal ? (
				<>
					<Paper sx={{ ...panelSx, p: 2.2, mb: 2 }}>
						<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.1fr .9fr" }, gap: 2 }}>
							<Box>
								<Typography sx={{ fontSize: 18, fontWeight: 950, color: hrColors.ink }}>Your onboarding</Typography>
								<Box sx={{ mt: 1.3, display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3,1fr)" }, gap: 1 }}>
									{cards.map(([label, done, helper]) => <MiniStatus key={label} label={label} done={done} helper={helper} />)}
								</Box>
							</Box>
							<Box sx={{ p: 1.7, borderRadius: 1.7, background: "var(--hr-surface)", border: `1px solid ${hrColors.line}` }}>
								<CompletionBar completion={portal.completion} />
								{portal.completion?.pending?.length ? <Typography sx={{ mt: 1, color: hrColors.muted, fontSize: 12 }}>{portal.completion.pending.length} control point(s) still pending.</Typography> : <Alert severity="success" sx={{ mt: 1.2, borderRadius: 1.4 }}>All onboarding controls are complete.</Alert>}
							</Box>
						</Box>
					</Paper>

					<Paper sx={{ ...panelSx, p: 2.2, mb: 2 }}>
						<SectionHeader title="Official PDF copies" subtitle="Download the HR forms in the same layout as the original ALSORG HR form pack. Buttons appear when that workflow record exists." />
						<Box sx={{ display: "flex", gap: .7, flexWrap: "wrap" }}>
							{portal.joiningReport ? <Button size="small" startIcon={<DownloadOutlinedIcon />} disabled={busy} onClick={() => downloadFormPdf("JOINING_REPORT", `${portal.candidateNumber}_Joining_Report.pdf`)} sx={secondaryButtonSx}>Joining Report</Button> : null}
							{portal.policy ? <Button size="small" startIcon={<DownloadOutlinedIcon />} disabled={busy} onClick={() => downloadFormPdf("HOLIDAY_LEAVE", `${portal.candidateNumber}_Holiday_Leave.pdf`)} sx={secondaryButtonSx}>Holiday & Leave</Button> : null}
							{portal.nda ? <Button size="small" startIcon={<DownloadOutlinedIcon />} disabled={busy} onClick={() => downloadFormPdf("NDA", `${portal.candidateNumber}_NDA.pdf`)} sx={secondaryButtonSx}>NDA</Button> : null}
							{portal.declaration ? <Button size="small" startIcon={<DownloadOutlinedIcon />} disabled={busy} onClick={() => downloadFormPdf("DECLARATION", `${portal.candidateNumber}_Declaration.pdf`)} sx={secondaryButtonSx}>Declaration</Button> : null}
							{portal.orientation ? <Button size="small" startIcon={<DownloadOutlinedIcon />} disabled={busy} onClick={() => downloadFormPdf("ORIENTATION", `${portal.candidateNumber}_Orientation.pdf`)} sx={secondaryButtonSx}>Orientation</Button> : null}
							{portal.feedbackSubmission ? <Button size="small" startIcon={<DownloadOutlinedIcon />} disabled={busy} onClick={() => downloadFormPdf("INDUCTION_FEEDBACK", `${portal.candidateNumber}_Induction_Feedback.pdf`)} sx={secondaryButtonSx}>Induction Feedback</Button> : null}
							<Button variant="contained" size="small" startIcon={<DownloadOutlinedIcon />} disabled={busy} onClick={() => downloadFormPdf("ONBOARDING_PACK", `${portal.candidateNumber}_Onboarding_Form_Pack.pdf`)} sx={primaryButtonSx}>Onboarding PDF pack</Button>
						</Box>
					</Paper>

					<Paper sx={{ ...panelSx, p: 2.2, mb: 2 }}>
						<SectionHeader title="Employment details" subtitle="Details confirmed by HR for your joining." />
						<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" }, gap: 1.2 }}>
							<Info label="Joining date" value={formatDate(portal.joiningDate)} />
							<Info label="Department" value={portal.department} />
							<Info label="Designation" value={portal.designation} />
							<Info label="Location" value={portal.location} />
							<Info label="Reporting manager" value={portal.reportingManager} />
						</Box>
					</Paper>

					<Paper sx={{ ...panelSx, p: 2.2, mb: 2 }}>
						<SectionHeader title="Your documents" subtitle="Upload any outstanding documents requested by HR." />
						<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "220px minmax(220px,1fr) auto" }, gap: 1, mb: 1.5 }}>
							<TextField select size="small" label="Document type" value={documentType} onChange={(e) => setDocumentType(e.target.value)} sx={fieldSx}>{DOC_TYPES.map((type) => <MenuItem key={type} value={type}>{humanize(type)}</MenuItem>)}</TextField>
							<Button component="label" variant="outlined" startIcon={<UploadFileOutlinedIcon />} sx={secondaryButtonSx}>{documentFile ? documentFile.name : "Choose file"}<input hidden type="file" onChange={(e) => setDocumentFile(e.target.files?.[0] || null)} /></Button>
							<Button variant="contained" disabled={!documentFile || busy} onClick={upload} sx={primaryButtonSx}>Upload</Button>
						</Box>
						<Box sx={{ display: "grid", gap: .8 }}>{documents.map((doc) => <Paper variant="outlined" key={doc.id} sx={{ p: 1.1, borderRadius: 1.4, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap" }}><Box><Typography sx={{ fontSize: 13, fontWeight: 850 }}>{humanize(doc.documentType)}</Typography><Typography sx={{ fontSize: 11.5, color: hrColors.muted }}>{doc.originalFileName} • {formatDateTime(doc.uploadedAt)}</Typography></Box><Button size="small" startIcon={<DownloadOutlinedIcon />} onClick={() => download(doc)} sx={secondaryButtonSx}>Download</Button></Paper>)}</Box>
					</Paper>

					<Paper sx={{ ...panelSx, p: 2.2, mb: 2 }}>
						<SectionHeader title="Acknowledgement name" subtitle="Type your name once; it will be recorded with each acceptance you complete." />
						<TextField fullWidth size="small" label="Your full name" value={typedName} onChange={(e) => setTypedName(e.target.value)} sx={fieldSx} />
					</Paper>

					{portal.joiningReport ? <ActionDocument title="Joining Report" accepted={portal.joiningReport.employeeAcknowledged} helper={portal.joiningReport.employeeAcknowledged ? `Acknowledged ${formatDateTime(portal.joiningReport.employeeAcknowledgedAt)}` : "Confirm your day-one joining report."} body={<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" }, gap: 1 }}><Info label="Employee code" value={portal.joiningReport.employeeCode} /><Info label="Employee" value={portal.joiningReport.employeeName} /><Info label="Department" value={portal.joiningReport.department} /><Info label="Designation" value={portal.joiningReport.designation} /></Box>} actionLabel="Acknowledge joining" onAction={() => run(() => hrflowApi.publicAcknowledgeJoining(token), "Joining Report acknowledged.")} busy={busy} /> : null}

					<LegalCard title="Holiday / Leave & HR Policy" snapshot={portal.policy} acceptance={portal.policyAcknowledgement} typedName={typedName} actionLabel="Acknowledge policy" onAction={() => run(() => hrflowApi.publicAcknowledgePolicy(token, acceptance), "Policy acknowledged.")} busy={busy} />
					<LegalCard title="Mutual Non-Disclosure Agreement" snapshot={portal.nda} acceptance={portal.ndaAcceptance} typedName={typedName} actionLabel="Accept NDA" onAction={() => run(() => hrflowApi.publicAcceptNda(token, acceptance), "NDA accepted.")} busy={busy} />
					<LegalCard title="Employment Declaration" snapshot={portal.declaration} acceptance={portal.declarationAcceptance} typedName={typedName} actionLabel="Accept declaration" onAction={() => run(() => hrflowApi.publicAcceptDeclaration(token, acceptance), "Employment declaration accepted.")} busy={busy} />

					<Paper sx={{ ...panelSx, p: 2.2, mb: 2 }}>
						<SectionHeader title="Orientation" subtitle="HR and your department complete the induction checklist; you acknowledge it after all required points are completed." />
						<Box sx={{ display: "grid", gap: .7, maxHeight: 420, overflowY: "auto", pr: .5 }}>
							{(portal.orientation?.tasks || []).map((task) => <Box key={task.code} sx={{ display: "flex", gap: 1, alignItems: "flex-start", p: 1, borderRadius: 1.2, background: task.completed ? "var(--hr-success-soft)" : "var(--hr-surface)", border: `1px solid ${task.completed ? "var(--hr-success-border)" : hrColors.line}` }}><TaskAltOutlinedIcon sx={{ fontSize: 18, color: task.completed ? hrColors.green : hrColors.muted, mt: .1 }} /><Box><Typography sx={{ fontSize: 12.5, fontWeight: 800, color: hrColors.ink }}>{task.label}</Typography><Typography sx={{ fontSize: 11, color: hrColors.muted }}>{humanize(task.section)} {task.completedBy ? `• ${task.completedBy}` : ""}</Typography></Box></Box>)}
						</Box>
						<Box sx={{ mt: 1.5 }}><Button variant="contained" disabled={busy || !portal.orientation?.allRequiredCompleted || portal.orientation?.employeeAcknowledged || !typedName.trim()} onClick={() => run(() => hrflowApi.publicAcknowledgeOrientation(token, { acknowledged: true, typedName: typedName.trim() }), "Orientation acknowledged." )} sx={primaryButtonSx}>{portal.orientation?.employeeAcknowledged ? "Orientation acknowledged" : "Acknowledge completed orientation"}</Button></Box>
					</Paper>

					<Paper sx={{ ...panelSx, p: 2.2, mb: 2 }}>
						<SectionHeader title="Induction feedback" subtitle="Tell HR whether the induction covered the joining, company, department and workplace information you needed." />
						{portal.feedbackSubmission ? <Alert severity="success" sx={{ borderRadius: 1.7 }}>Feedback submitted on {formatDateTime(portal.feedbackSubmission.submittedAt)}.</Alert> : <Box sx={{ display: "grid", gap: 1.5 }}>{feedbackQuestions.map((question, index) => <Paper key={question.code} variant="outlined" sx={{ p: 1.35, borderRadius: 1.5 }}><Typography sx={{ fontSize: 13, fontWeight: 850, color: hrColors.ink }}>{index + 1}. {question.question}</Typography><RadioGroup row value={feedbackAnswers[question.code]?.answer || ""} onChange={(e) => setFeedbackAnswers((current) => ({ ...current, [question.code]: { ...current[question.code], answer: e.target.value } }))}><FormControlLabel value="Y" control={<Radio size="small" />} label="Yes" /><FormControlLabel value="N" control={<Radio size="small" />} label="No" /><FormControlLabel value="NA" control={<Radio size="small" />} label="N/A" /></RadioGroup><TextField fullWidth size="small" label="Suggestion / comment (optional)" value={feedbackAnswers[question.code]?.suggestion || ""} onChange={(e) => setFeedbackAnswers((current) => ({ ...current, [question.code]: { ...current[question.code], suggestion: e.target.value } }))} sx={fieldSx} /></Paper>)}<Button variant="contained" disabled={busy || !canSubmitFeedback} onClick={submitFeedback} sx={primaryButtonSx}>Submit feedback</Button></Box>}
					</Paper>
				</>
			) : null}
		</PublicShell>
	);
}

function SectionHeader({ title, subtitle }) { return <Box sx={{ mb: 1.6 }}><Typography sx={{ fontSize: 17, fontWeight: 950, color: hrColors.ink }}>{title}</Typography><Typography sx={{ mt: .35, fontSize: 12.5, color: hrColors.muted, lineHeight: 1.55 }}>{subtitle}</Typography></Box>; }
function Info({ label, value }) { return <Box sx={{ p: 1, borderRadius: 1.2, background: "var(--hr-surface)", border: `1px solid ${hrColors.line}` }}><Typography sx={{ color: hrColors.muted, fontSize: 10.5, fontWeight: 800 }}>{label}</Typography><Typography sx={{ color: hrColors.ink, fontSize: 12.5, fontWeight: 850, mt: .25 }}>{value || "—"}</Typography></Box>; }
function MiniStatus({ label, done, helper }) { return <Box sx={{ p: 1, borderRadius: 1.3, background: done ? "var(--hr-success-soft)" : "var(--hr-surface)", border: `1px solid ${done ? "var(--hr-success-border)" : hrColors.line}` }}><Typography sx={{ fontSize: 11.5, fontWeight: 900, color: done ? hrColors.green : hrColors.ink }}>{label}</Typography><Typography sx={{ mt: .2, fontSize: 10.5, color: hrColors.muted }}>{helper}</Typography></Box>; }

function ActionDocument({ title, accepted, helper, body, actionLabel, onAction, busy }) {
	return <Paper sx={{ ...panelSx, p: 2.2, mb: 2 }}><Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1.5 }}><Box><Typography sx={{ fontSize: 17, fontWeight: 950 }}>{title}</Typography><Typography sx={{ color: hrColors.muted, fontSize: 12.5, mt: .3 }}>{helper}</Typography></Box>{accepted ? <Chip icon={<CheckCircleOutlineOutlinedIcon />} label="Completed" sx={{ color: hrColors.green, background: "var(--hr-success-soft)", fontWeight: 850 }} /> : null}</Box>{body}<Box sx={{ mt: 1.5 }}><Button variant="contained" disabled={accepted || busy} onClick={onAction} sx={primaryButtonSx}>{accepted ? "Acknowledged" : actionLabel}</Button></Box></Paper>;
}

function LegalCard({ title, snapshot, acceptance, typedName, actionLabel, onAction, busy }) {
	if (!snapshot) return <Paper sx={{ ...panelSx, p: 2.2, mb: 2 }}><SectionHeader title={title} subtitle="HR has not published the approved version for your onboarding yet." /><Alert severity="info" sx={{ borderRadius: 1.6 }}>No document is available yet.</Alert></Paper>;
	return <Paper sx={{ ...panelSx, p: 2.2, mb: 2 }}><Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}><SectionHeader title={title} subtitle={`Version ${snapshot.version} • Published ${formatDateTime(snapshot.publishedAt)}`} />{acceptance ? <Chip icon={<CheckCircleOutlineOutlinedIcon />} label="Accepted" sx={{ color: hrColors.green, background: "var(--hr-success-soft)", fontWeight: 850 }} /> : null}</Box><Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, maxHeight: 340, overflowY: "auto", whiteSpace: "pre-wrap", background: "var(--hr-card-bg-elevated)" }}><Typography sx={{ fontSize: 12.5, lineHeight: 1.7, color: hrColors.ink }}>{snapshot.body}</Typography></Paper><Divider sx={{ my: 1.5 }} /><Button variant="contained" disabled={Boolean(acceptance) || busy || !typedName.trim()} onClick={onAction} sx={primaryButtonSx}>{acceptance ? `Accepted ${formatDateTime(acceptance.acceptedAt)}` : actionLabel}</Button></Paper>;
}
