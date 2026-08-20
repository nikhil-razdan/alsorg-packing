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
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import WorkOutlineOutlinedIcon from "@mui/icons-material/WorkOutlineOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";

import hrflowApi from "./hrflowApi";
import {
	apiMessage,
	blobApiMessage,
	formatDate,
	formatDateTime,
	humanize,
	saveBlob,
} from "./hrflowUtils";
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

const DOC_TYPES = [
	"PHOTO",
	"AADHAAR",
	"PAN",
	"RESUME",
	"DRIVING_LICENSE",
	"ADDRESS_PROOF",
	"EDUCATION_CERTIFICATE",
	"EXPERIENCE_LETTER",
	"OFFER_ACCEPTANCE",
	"OTHER",
];

const PDF_STYLE = {
	ORIGINAL: "ORIGINAL",
	MODERN: "MODERN",
};

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
			const nextPortal = portalResponse.data || null;
			setPortal(nextPortal);
			setDocuments(Array.isArray(documentsResponse.data) ? documentsResponse.data : []);
			setTypedName((current) => current || nextPortal?.candidateName || "");
		} catch (e) {
			setError(apiMessage(e, "This onboarding link could not be opened."));
		} finally {
			setLoading(false);
		}
	}, [token]);

	useEffect(() => {
		load();
	}, [load]);

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
		if (!documentFile) {
			setError("Choose a file to upload.");
			return;
		}
		await run(async () => {
			await hrflowApi.publicUploadDocument(token, {
				documentType,
				file: documentFile,
				remarks: "Onboarding document",
			});
			setDocumentFile(null);
		}, `${humanize(documentType)} uploaded.`);
	};

	const download = async (doc) => {
		setError("");
		try {
			const response = await hrflowApi.publicDownloadDocument(token, doc.id);
			saveBlob(response, doc.originalFileName || "document");
		} catch (e) {
			setError(await blobApiMessage(e, "Document download failed."));
		}
	};

	const downloadOnboardingPdf = async (formKey, fileName) => {
		setBusy(true);
		setError("");
		try {
			const response = await hrflowApi.publicDownloadOnboardingForm(token, formKey);
			saveBlob(response, fileName);
		} catch (e) {
			setError(await blobApiMessage(e, "Your onboarding PDF could not be downloaded."));
		} finally {
			setBusy(false);
		}
	};

	const downloadCandidatePdf = async (style) => {
		setBusy(true);
		setError("");
		try {
			const response = await hrflowApi.publicDownloadCandidateForm(
				token,
				"CANDIDATE_PACK",
				style
			);
			saveBlob(
				response,
				`${portal?.candidateNumber || "Candidate"}_Candidate_Pack_${style === PDF_STYLE.ORIGINAL ? "Original" : "Modern"}.pdf`
			);
		} catch (e) {
			setError(await blobApiMessage(e, "Your candidate form PDF could not be downloaded."));
		} finally {
			setBusy(false);
		}
	};

	const feedbackQuestions = portal?.feedbackQuestions || [];
	const canSubmitFeedback =
		feedbackQuestions.length > 0 &&
		feedbackQuestions.every((q) => feedbackAnswers[q.code]?.answer);

	const submitFeedback = () =>
		run(
			() =>
				hrflowApi.publicSubmitFeedback(token, {
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
			{
				label: "Joining Report",
				done: Boolean(portal.joiningReport?.employeeAcknowledged),
				helper: portal.joiningReport ? "Ready / available" : "Waiting for HR",
			},
			{
				label: "Policy",
				done: Boolean(portal.policyAcknowledgement),
				helper: portal.policy ? `Version ${portal.policy.version}` : "Waiting for HR",
			},
			{
				label: "NDA",
				done: Boolean(portal.ndaAcceptance),
				helper: portal.nda ? `Version ${portal.nda.version}` : "Waiting for HR",
			},
			{
				label: "Declaration",
				done: Boolean(portal.declarationAcceptance),
				helper: portal.declaration ? `Version ${portal.declaration.version}` : "Waiting for HR",
			},
			{
				label: "Orientation",
				done: Boolean(portal.orientation?.employeeAcknowledged),
				helper: portal.orientation?.allRequiredCompleted ? "Ready to acknowledge" : "In progress",
			},
			{
				label: "Feedback",
				done: Boolean(portal.feedbackSubmission),
				helper: portal.feedbackSubmission ? "Submitted" : "Pending",
			},
		];
	}, [portal]);

	const actionItems = useMemo(() => {
		if (!portal) return [];
		const items = [];
		if (!portal.joiningReport) items.push({ label: "Joining report", owner: "HR", type: "waiting" });
		else if (!portal.joiningReport.employeeAcknowledged) items.push({ label: "Acknowledge joining report", owner: "You", type: "action" });
		if (!portal.policy) items.push({ label: "Holiday / leave policy", owner: "HR", type: "waiting" });
		else if (!portal.policyAcknowledgement) items.push({ label: "Acknowledge current policy", owner: "You", type: "action" });
		if (!portal.nda) items.push({ label: "Mutual NDA", owner: "HR", type: "waiting" });
		else if (!portal.ndaAcceptance) items.push({ label: "Accept current NDA", owner: "You", type: "action" });
		if (!portal.declaration) items.push({ label: "Employment declaration", owner: "HR", type: "waiting" });
		else if (!portal.declarationAcceptance) items.push({ label: "Accept employment declaration", owner: "You", type: "action" });
		if (!portal.orientation?.allRequiredCompleted) items.push({ label: "Complete orientation checklist", owner: "HR / HOD", type: "waiting" });
		else if (!portal.orientation?.employeeAcknowledged) items.push({ label: "Acknowledge orientation", owner: "You", type: "action" });
		if (!portal.feedbackSubmission) items.push({ label: "Submit induction feedback", owner: "You", type: "action" });
		return items;
	}, [portal]);

	if (loading) {
		return (
			<PublicShell title="Employee Onboarding" subtitle="Secure ALSORG onboarding portal.">
				<LoadingBlock />
			</PublicShell>
		);
	}

	return (
		<PublicShell
			title={`Welcome${portal?.candidateName ? `, ${portal.candidateName}` : ""}`}
			subtitle="Your joining documents, acknowledgements, induction activities and official PDF copies are organised here in one secure HRFlow portal."
			topRight={
				<Box sx={{ textAlign: "right" }}>
					<StatusChip value={portal?.status} />
					<Typography sx={{ mt: .6, fontSize: 11.5, color: hrColors.muted }}>
						{portal?.candidateNumber}
					</Typography>
				</Box>
			}
		>
			<ErrorAlert error={error} onRetry={load} />
			{message ? (
				<Alert severity="success" onClose={() => setMessage("")} sx={{ mb: 2, borderRadius: 1.7 }}>
					{message}
				</Alert>
			) : null}

			{portal ? (
				<>
					{/* Progress + next action */}
					<Paper sx={{ ...panelSx, p: { xs: 1.7, md: 2.3 }, mb: 2 }}>
						<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.15fr .85fr" }, gap: 2.2 }}>
							<Box>
								<SectionHeader
									title="Your onboarding"
									subtitle="A live view of what is complete, what is waiting for HR, and what needs your action."
								/>
								<Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", sm: "repeat(3,minmax(0,1fr))" }, gap: 1 }}>
									{cards.map((card) => (
										<MiniStatus key={card.label} {...card} />
									))}
								</Box>
							</Box>

							<Box sx={{ p: 1.7, borderRadius: 1.8, background: "var(--hr-surface)", border: `1px solid ${hrColors.line}` }}>
								<CompletionBar completion={portal.completion} />
								<Box sx={{ mt: 1.6, display: "grid", gap: .75 }}>
									<Typography sx={{ fontSize: 11.3, fontWeight: 950, color: hrColors.muted, textTransform: "uppercase", letterSpacing: .8 }}>
										Next steps
									</Typography>
									{actionItems.slice(0, 5).map((item) => (
										<Box key={`${item.label}-${item.owner}`} sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center", p: .9, borderRadius: 1.25, background: "var(--hr-card-bg)" }}>
											<Box sx={{ minWidth: 0 }}>
												<Typography sx={{ fontSize: 12.2, fontWeight: 850, color: hrColors.ink }}>{item.label}</Typography>
												<Typography sx={{ fontSize: 10.7, color: hrColors.muted }}>Owner: {item.owner}</Typography>
											</Box>
											<Chip
												size="small"
												label={item.type === "action" ? "Action" : "Waiting"}
												sx={{ borderRadius: 1, height: 24, fontSize: 10.2, fontWeight: 900, color: item.type === "action" ? hrColors.blue : hrColors.amber, background: item.type === "action" ? "var(--hr-primary-soft)" : "var(--hr-warning-soft)" }}
											/>
										</Box>
									))}
									{actionItems.length === 0 ? (
										<Alert severity="success" sx={{ borderRadius: 1.4 }}>All onboarding controls are complete.</Alert>
									) : null}
								</Box>
							</Box>
						</Box>
					</Paper>

					{/* PDF centre */}
					<Paper sx={{ ...panelSx, p: { xs: 1.7, md: 2.3 }, mb: 2 }}>
						<SectionHeader
							title="Official PDF centre"
							subtitle="Keep both candidate-form styles. Original uses the approved ALSORG layout with corrected placement; Modern uses the updated HRFlow vector layout."
						/>

						<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.2, mb: 1.7 }}>
							<PdfStyleCard
								icon={<DescriptionOutlinedIcon />}
								title="Original ALSORG form"
								description="Same approved form design, with larger entered text, corrected alignment and cleaner wrapping."
								buttonLabel="Download original candidate pack"
								disabled={busy}
								onClick={() => downloadCandidatePdf(PDF_STYLE.ORIGINAL)}
							/>
							<PdfStyleCard
								icon={<AutoAwesomeOutlinedIcon />}
								title="Modern HRFlow form"
								description="Updated print-ready A4 layout with stronger typography, structured fields and clearer hierarchy."
								buttonLabel="Download modern candidate pack"
								primary
								disabled={busy}
								onClick={() => downloadCandidatePdf(PDF_STYLE.MODERN)}
							/>
						</Box>

						<Divider sx={{ my: 1.5 }} />
						<Typography sx={{ fontSize: 11.2, fontWeight: 950, color: hrColors.muted, textTransform: "uppercase", letterSpacing: .8, mb: .9 }}>
							Onboarding documents
						</Typography>
						<Box sx={{ display: "flex", gap: .7, flexWrap: "wrap" }}>
							{portal.joiningReport ? <PdfButton label="Joining Report" busy={busy} onClick={() => downloadOnboardingPdf("JOINING_REPORT", `${portal.candidateNumber}_Joining_Report.pdf`)} /> : null}
							{portal.policy ? <PdfButton label="Holiday & Leave" busy={busy} onClick={() => downloadOnboardingPdf("HOLIDAY_LEAVE", `${portal.candidateNumber}_Holiday_Leave.pdf`)} /> : null}
							{portal.nda ? <PdfButton label="NDA" busy={busy} onClick={() => downloadOnboardingPdf("NDA", `${portal.candidateNumber}_NDA.pdf`)} /> : null}
							{portal.declaration ? <PdfButton label="Declaration" busy={busy} onClick={() => downloadOnboardingPdf("DECLARATION", `${portal.candidateNumber}_Declaration.pdf`)} /> : null}
							{portal.orientation ? <PdfButton label="Orientation" busy={busy} onClick={() => downloadOnboardingPdf("ORIENTATION", `${portal.candidateNumber}_Orientation.pdf`)} /> : null}
							{portal.feedbackSubmission ? <PdfButton label="Induction Feedback" busy={busy} onClick={() => downloadOnboardingPdf("INDUCTION_FEEDBACK", `${portal.candidateNumber}_Induction_Feedback.pdf`)} /> : null}
							<Button
								variant="contained"
								size="small"
								startIcon={<DownloadOutlinedIcon />}
								disabled={busy}
								onClick={() => downloadOnboardingPdf("ONBOARDING_PACK", `${portal.candidateNumber}_Onboarding_Form_Pack.pdf`)}
								sx={primaryButtonSx}
							>
								Onboarding PDF pack
							</Button>
						</Box>
					</Paper>

					{/* Employment details */}
					<Paper sx={{ ...panelSx, p: { xs: 1.7, md: 2.3 }, mb: 2 }}>
						<SectionHeader title="Employment details" subtitle="Details currently confirmed by HR for your joining." />
						<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5,minmax(0,1fr))" }, gap: 1 }}>
							<Info icon={<ScheduleOutlinedIcon />} label="Joining date" value={formatDate(portal.joiningDate)} />
							<Info icon={<WorkOutlineOutlinedIcon />} label="Department" value={portal.department} />
							<Info icon={<FactCheckOutlinedIcon />} label="Designation" value={portal.designation} />
							<Info label="Location" value={portal.location} />
							<Info label="Reporting manager" value={portal.reportingManager} />
						</Box>
					</Paper>

					{/* Documents */}
					<Paper sx={{ ...panelSx, p: { xs: 1.7, md: 2.3 }, mb: 2 }}>
						<SectionHeader title="Your documents" subtitle="Upload any outstanding identity, qualification or joining documents requested by HR." />
						<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "220px minmax(240px,1fr) auto" }, gap: 1, mb: 1.5 }}>
							<TextField select size="small" label="Document type" value={documentType} onChange={(e) => setDocumentType(e.target.value)} sx={fieldSx}>
								{DOC_TYPES.map((type) => <MenuItem key={type} value={type}>{humanize(type)}</MenuItem>)}
							</TextField>
							<Button component="label" variant="outlined" startIcon={<UploadFileOutlinedIcon />} sx={{ ...secondaryButtonSx, justifyContent: "flex-start", overflow: "hidden" }}>
								<Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{documentFile ? documentFile.name : "Choose file"}</Box>
								<input hidden type="file" onChange={(e) => setDocumentFile(e.target.files?.[0] || null)} />
							</Button>
							<Button variant="contained" disabled={!documentFile || busy} onClick={upload} sx={primaryButtonSx}>Upload</Button>
						</Box>

						{documents.length ? (
							<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2,minmax(0,1fr))" }, gap: .8 }}>
								{documents.map((doc) => (
									<Box key={doc.id} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, p: 1.1, borderRadius: 1.35, background: "var(--hr-surface)", border: `1px solid ${hrColors.line}` }}>
										<Box sx={{ minWidth: 0, display: "flex", gap: .8, alignItems: "center" }}>
											<FolderOutlinedIcon sx={{ fontSize: 18, color: hrColors.blue, flex: "0 0 auto" }} />
											<Box sx={{ minWidth: 0 }}>
												<Typography noWrap sx={{ fontSize: 12.6, fontWeight: 900, color: hrColors.ink }}>{humanize(doc.documentType)}</Typography>
												<Typography noWrap sx={{ fontSize: 10.8, color: hrColors.muted }}>{doc.originalFileName} • {formatDateTime(doc.uploadedAt)}</Typography>
											</Box>
										</Box>
										<Button size="small" startIcon={<DownloadOutlinedIcon />} onClick={() => download(doc)} sx={secondaryButtonSx}>Download</Button>
									</Box>
								))}
							</Box>
						) : (
							<Alert severity="info" sx={{ borderRadius: 1.5 }}>No candidate-uploaded documents are visible yet.</Alert>
						)}
					</Paper>

					{/* Acknowledgement identity */}
					<Paper sx={{ ...panelSx, p: { xs: 1.7, md: 2.3 }, mb: 2 }}>
						<SectionHeader title="Acknowledgement name" subtitle="Type your full name once. HRFlow records it with each policy, NDA, declaration and orientation acceptance you complete." />
						<TextField fullWidth size="small" label="Your full name" value={typedName} onChange={(e) => setTypedName(e.target.value)} sx={fieldSx} />
					</Paper>

					{portal.joiningReport ? (
						<ActionDocument
							title="Joining Report"
							accepted={portal.joiningReport.employeeAcknowledged}
							helper={portal.joiningReport.employeeAcknowledged ? `Acknowledged ${formatDateTime(portal.joiningReport.employeeAcknowledgedAt)}` : "Review and confirm your day-one joining report."}
							body={
								<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" }, gap: 1 }}>
									<Info label="Employee code" value={portal.joiningReport.employeeCode} />
									<Info label="Employee" value={portal.joiningReport.employeeName} />
									<Info label="Department" value={portal.joiningReport.department} />
									<Info label="Designation" value={portal.joiningReport.designation} />
								</Box>
							}
							actionLabel="Acknowledge joining"
							onAction={() => run(() => hrflowApi.publicAcknowledgeJoining(token), "Joining Report acknowledged.")}
							busy={busy}
						/>
					) : (
						<WaitingCard title="Joining Report" text="HR will publish your joining report once joining is confirmed." />
					)}

					<LegalCard
						title="Holiday / Leave & HR Policy"
						snapshot={portal.policy}
						acceptance={portal.policyAcknowledgement}
						typedName={typedName}
						actionLabel="Acknowledge policy"
						onAction={() => run(() => hrflowApi.publicAcknowledgePolicy(token, acceptance), "Policy acknowledged.")}
						busy={busy}
					/>
					<LegalCard
						title="Mutual Non-Disclosure Agreement"
						snapshot={portal.nda}
						acceptance={portal.ndaAcceptance}
						typedName={typedName}
						actionLabel="Accept NDA"
						onAction={() => run(() => hrflowApi.publicAcceptNda(token, acceptance), "NDA accepted.")}
						busy={busy}
					/>
					<LegalCard
						title="Employment Declaration"
						snapshot={portal.declaration}
						acceptance={portal.declarationAcceptance}
						typedName={typedName}
						actionLabel="Accept declaration"
						onAction={() => run(() => hrflowApi.publicAcceptDeclaration(token, acceptance), "Employment declaration accepted.")}
						busy={busy}
					/>

					<Paper sx={{ ...panelSx, p: { xs: 1.7, md: 2.3 }, mb: 2 }}>
						<SectionHeader title="Orientation" subtitle="HR and your department complete the induction checklist. You acknowledge it when all required points are complete." />
						<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2,minmax(0,1fr))" }, gap: .75, maxHeight: 450, overflowY: "auto", pr: .25 }}>
							{(portal.orientation?.tasks || []).map((task) => (
								<Box key={task.code} sx={{ display: "flex", gap: .9, alignItems: "flex-start", p: 1.05, borderRadius: 1.3, background: task.completed ? "var(--hr-success-soft)" : "var(--hr-surface)", border: `1px solid ${task.completed ? "var(--hr-success-border)" : hrColors.line}` }}>
									<TaskAltOutlinedIcon sx={{ fontSize: 18, color: task.completed ? hrColors.green : hrColors.muted, mt: .1 }} />
									<Box>
										<Typography sx={{ fontSize: 12.4, fontWeight: 850, color: hrColors.ink }}>{task.label}</Typography>
										<Typography sx={{ fontSize: 10.7, color: hrColors.muted }}>{humanize(task.section)} {task.completedBy ? `• ${task.completedBy}` : ""}</Typography>
									</Box>
								</Box>
							))}
						</Box>
						<Box sx={{ mt: 1.5 }}>
							<Button
								variant="contained"
								disabled={busy || !portal.orientation?.allRequiredCompleted || portal.orientation?.employeeAcknowledged || !typedName.trim()}
								onClick={() => run(() => hrflowApi.publicAcknowledgeOrientation(token, { acknowledged: true, typedName: typedName.trim() }), "Orientation acknowledged.")}
								sx={primaryButtonSx}
							>
								{portal.orientation?.employeeAcknowledged ? "Orientation acknowledged" : "Acknowledge completed orientation"}
							</Button>
						</Box>
					</Paper>

					<Paper sx={{ ...panelSx, p: { xs: 1.7, md: 2.3 }, mb: 2 }}>
						<SectionHeader title="Induction feedback" subtitle="Tell HR whether your joining and induction gave you the information you needed." />
						{portal.feedbackSubmission ? (
							<Alert severity="success" sx={{ borderRadius: 1.7 }}>
								Feedback submitted on {formatDateTime(portal.feedbackSubmission.submittedAt)}.
							</Alert>
						) : (
							<Box sx={{ display: "grid", gap: 1 }}>
								{feedbackQuestions.map((question, index) => (
									<Box key={question.code} sx={{ p: 1.2, borderRadius: 1.4, background: "var(--hr-surface)", border: `1px solid ${hrColors.line}` }}>
										<Typography sx={{ fontSize: 12.8, fontWeight: 850, color: hrColors.ink }}>{index + 1}. {question.question}</Typography>
										<RadioGroup row value={feedbackAnswers[question.code]?.answer || ""} onChange={(e) => setFeedbackAnswers((current) => ({ ...current, [question.code]: { ...current[question.code], answer: e.target.value } }))}>
											<FormControlLabel value="Y" control={<Radio size="small" />} label="Yes" />
											<FormControlLabel value="N" control={<Radio size="small" />} label="No" />
											<FormControlLabel value="NA" control={<Radio size="small" />} label="N/A" />
										</RadioGroup>
										<TextField fullWidth size="small" label="Suggestion / comment (optional)" value={feedbackAnswers[question.code]?.suggestion || ""} onChange={(e) => setFeedbackAnswers((current) => ({ ...current, [question.code]: { ...current[question.code], suggestion: e.target.value } }))} sx={fieldSx} />
									</Box>
								))}
								<Button variant="contained" disabled={busy || !canSubmitFeedback} onClick={submitFeedback} sx={primaryButtonSx}>Submit feedback</Button>
							</Box>
						)}
					</Paper>
				</>
			) : null}
		</PublicShell>
	);
}

function SectionHeader({ title, subtitle }) {
	return (
		<Box sx={{ mb: 1.5 }}>
			<Typography sx={{ fontSize: { xs: 16.5, md: 18 }, fontWeight: 950, color: hrColors.ink }}>{title}</Typography>
			{subtitle ? <Typography sx={{ mt: .35, fontSize: 12.3, color: hrColors.muted, lineHeight: 1.55 }}>{subtitle}</Typography> : null}
		</Box>
	);
}

function Info({ icon, label, value }) {
	return (
		<Box sx={{ p: 1.1, minHeight: 64, borderRadius: 1.35, background: "var(--hr-surface)", border: `1px solid ${hrColors.line}` }}>
			<Box sx={{ display: "flex", gap: .5, alignItems: "center" }}>
				{icon ? <Box sx={{ display: "flex", color: hrColors.blue, "& svg": { fontSize: 15 } }}>{icon}</Box> : null}
				<Typography sx={{ color: hrColors.muted, fontSize: 10.5, fontWeight: 850 }}>{label}</Typography>
			</Box>
			<Typography sx={{ color: hrColors.ink, fontSize: 12.8, fontWeight: 900, mt: .35, lineHeight: 1.35 }}>{value || "—"}</Typography>
		</Box>
	);
}

function MiniStatus({ label, done, helper }) {
	return (
		<Box sx={{ p: 1.05, minHeight: 64, borderRadius: 1.4, background: done ? "var(--hr-success-soft)" : "var(--hr-surface)", border: `1px solid ${done ? "var(--hr-success-border)" : hrColors.line}` }}>
			<Box sx={{ display: "flex", justifyContent: "space-between", gap: .5, alignItems: "center" }}>
				<Typography sx={{ fontSize: 11.8, fontWeight: 950, color: done ? hrColors.green : hrColors.ink }}>{label}</Typography>
				{done ? <CheckCircleOutlineOutlinedIcon sx={{ fontSize: 16, color: hrColors.green }} /> : null}
			</Box>
			<Typography sx={{ mt: .35, fontSize: 10.7, color: hrColors.muted }}>{helper}</Typography>
		</Box>
	);
}

function PdfStyleCard({ icon, title, description, buttonLabel, onClick, primary = false, disabled }) {
	return (
		<Box sx={{ p: 1.4, borderRadius: 1.6, border: primary ? "1px solid var(--hr-primary-border)" : `1px solid ${hrColors.line}`, background: primary ? "var(--hr-primary-soft)" : "var(--hr-surface)" }}>
			<Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
				<Box sx={{ width: 34, height: 34, borderRadius: 1.2, display: "grid", placeItems: "center", flex: "0 0 auto", color: primary ? hrColors.blue : hrColors.ink, background: "var(--hr-card-bg)" }}>{icon}</Box>
				<Box sx={{ minWidth: 0 }}>
					<Typography sx={{ fontSize: 13.5, fontWeight: 950, color: primary ? hrColors.blue : hrColors.ink }}>{title}</Typography>
					<Typography sx={{ mt: .35, fontSize: 11.3, lineHeight: 1.5, color: hrColors.muted }}>{description}</Typography>
				</Box>
			</Box>
			<Button variant={primary ? "contained" : "outlined"} size="small" startIcon={<DownloadOutlinedIcon />} disabled={disabled} onClick={onClick} sx={{ ...(primary ? primaryButtonSx : secondaryButtonSx), mt: 1.15 }}>
				{buttonLabel}
			</Button>
		</Box>
	);
}

function PdfButton({ label, busy, onClick }) {
	return <Button size="small" startIcon={<DownloadOutlinedIcon />} disabled={busy} onClick={onClick} sx={secondaryButtonSx}>{label}</Button>;
}

function WaitingCard({ title, text }) {
	return (
		<Paper sx={{ ...panelSx, p: { xs: 1.7, md: 2.1 }, mb: 2 }}>
			<Box sx={{ display: "flex", gap: 1.1, alignItems: "flex-start" }}>
				<Box sx={{ width: 34, height: 34, borderRadius: 1.25, display: "grid", placeItems: "center", background: "var(--hr-warning-soft)", color: hrColors.amber }}><ScheduleOutlinedIcon sx={{ fontSize: 18 }} /></Box>
				<Box>
					<Typography sx={{ fontSize: 15, fontWeight: 950, color: hrColors.ink }}>{title}</Typography>
					<Typography sx={{ mt: .35, fontSize: 12, color: hrColors.muted }}>{text}</Typography>
					<Chip size="small" label="Waiting for HR" sx={{ mt: .8, borderRadius: 1, color: hrColors.amber, background: "var(--hr-warning-soft)", fontWeight: 900 }} />
				</Box>
			</Box>
		</Paper>
	);
}

function ActionDocument({ title, accepted, helper, body, actionLabel, onAction, busy }) {
	return (
		<Paper sx={{ ...panelSx, p: { xs: 1.7, md: 2.3 }, mb: 2 }}>
			<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
				<Box>
					<Typography sx={{ fontSize: 17, fontWeight: 950, color: hrColors.ink }}>{title}</Typography>
					<Typography sx={{ color: hrColors.muted, fontSize: 12.3, mt: .3 }}>{helper}</Typography>
				</Box>
				{accepted ? <Chip icon={<CheckCircleOutlineOutlinedIcon />} label="Completed" sx={{ color: hrColors.green, background: "var(--hr-success-soft)", fontWeight: 850 }} /> : null}
			</Box>
			{body}
			<Box sx={{ mt: 1.5 }}>
				<Button variant="contained" disabled={accepted || busy} onClick={onAction} sx={primaryButtonSx}>{accepted ? "Acknowledged" : actionLabel}</Button>
			</Box>
		</Paper>
	);
}

function LegalCard({ title, snapshot, acceptance, typedName, actionLabel, onAction, busy }) {
	if (!snapshot) {
		return <WaitingCard title={title} text="HR has not published the approved version for your onboarding yet." />;
	}

	return (
		<Paper sx={{ ...panelSx, p: { xs: 1.7, md: 2.3 }, mb: 2 }}>
			<Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}>
				<SectionHeader title={title} subtitle={`Version ${snapshot.version} • Published ${formatDateTime(snapshot.publishedAt)}`} />
				{acceptance ? <Chip icon={<CheckCircleOutlineOutlinedIcon />} label="Accepted" sx={{ color: hrColors.green, background: "var(--hr-success-soft)", fontWeight: 850 }} /> : null}
			</Box>
			<Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, maxHeight: 340, overflowY: "auto", whiteSpace: "pre-wrap", background: "var(--hr-card-bg-elevated)" }}>
				<Typography sx={{ fontSize: 12.5, lineHeight: 1.75, color: hrColors.ink }}>{snapshot.body}</Typography>
			</Paper>
			<Divider sx={{ my: 1.5 }} />
			<Button variant="contained" disabled={Boolean(acceptance) || busy || !typedName.trim()} onClick={onAction} sx={primaryButtonSx}>
				{acceptance ? `Accepted ${formatDateTime(acceptance.acceptedAt)}` : actionLabel}
			</Button>
		</Paper>
	);
}
