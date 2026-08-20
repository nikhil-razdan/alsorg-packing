import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
	Alert,
	Box,
	Button,
	Checkbox,
	Chip,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Divider,
	Drawer,
	FormControlLabel,
	IconButton,
	InputAdornment,
	MenuItem,
	Paper,
	Tab,
	Tabs,
	TextField,
	Tooltip,
	Typography,
} from "@mui/material";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import PersonSearchOutlinedIcon from "@mui/icons-material/PersonSearchOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import AppsIcon from "@mui/icons-material/Apps";

import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import hrflowApi from "./hrflowApi";
import {
	HR_ACCESS_ROLES,
	HR_CANDIDATE_STAGES,
	HR_EMPLOYEE_STATUSES,
	HR_ONBOARDING_STATUSES,
	HR_UPLOAD_DOCUMENT_TYPES,
	apiMessage,
	copyText,
	formatDate,
	formatDateTime,
	humanize,
	money,
	pageContent,
	publicApplicationUrl,
	publicOnboardingUrl,
	saveBlob,
	totalElements,
} from "./hrflowUtils";
import {
	CompletionBar,
	EmptyState,
	ErrorAlert,
	HrBrand,
	HrFlowThemeProvider,
	ThemeToggleButton,
	LoadingBlock,
	MetricCard,
	PageTitle,
	StatusChip,
	fieldSx,
	hrColors,
	panelSx,
	primaryButtonSx,
	secondaryButtonSx,
} from "./HrFlowCommon";

const NAV = [
	{ key: "dashboard", label: "Dashboard", icon: <DashboardOutlinedIcon /> },
	{ key: "candidates", label: "Candidates", icon: <PersonSearchOutlinedIcon /> },
	{ key: "forms", label: "Forms", icon: <DescriptionOutlinedIcon /> },
	{ key: "onboarding", label: "Onboarding", icon: <AssignmentTurnedInOutlinedIcon /> },
	{ key: "employees", label: "Employees", icon: <BadgeOutlinedIcon /> },
];


const HR_HEADER = Object.freeze({
	dashboard: {
		title: "HRFlow Dashboard",
		subtitle: "Recruitment, joining, onboarding and employee control.",
	},
	candidates: {
		title: "Candidates",
		subtitle: "Applications, documents, recruitment stages and selection.",
	},
	forms: {
		title: "HR Forms",
		subtitle: "Integrated candidate and new-joinee forms from the HR pack.",
	},
	onboarding: {
		title: "Onboarding",
		subtitle: "Joining, policy, NDA, declaration, orientation and feedback.",
	},
	employees: {
		title: "Employees",
		subtitle: "Employee master created from confirmed joining records.",
	},
	access: {
		title: "HR Access",
		subtitle: "HRFlow-specific roles and permission administration.",
	},
});

const HR_SECTION_LABELS = Object.freeze({
	HOME: "Home",
	PEOPLE: "People",
	WORKFLOW: "Workflow",
	ADMIN: "Administration",
});

const hrAccessRoles = (payload) => {
	const raw = payload?.roles ?? payload?.hrRoles ?? payload?.accessRoles ?? [];
	return Array.isArray(raw) ? raw.map((value) => String(value || "").trim().toUpperCase()).filter(Boolean) : [];
};

const isHrGlobalAdmin = (payload) => Boolean(
	payload?.globalAdmin === true ||
	payload?.isGlobalAdmin === true ||
	payload?.admin === true
);

const hasHrAccess = (payload) => Boolean(
	payload?.allowed === true ||
	payload?.hasAccess === true ||
	isHrGlobalAdmin(payload) ||
	hrAccessRoles(payload).length > 0
);

const blankCandidate = {
	applicationType: "STANDARD",
	fullName: "",
	email: "",
	mobileNo: "",
	postAppliedFor: "",
	department: "",
	designation: "",
	hrOwner: "",
};

function HrFlowWorkspaceContent() {
	const navigate = useNavigate();
	const { user, logout } = useAuth();
	const [accessLoading, setAccessLoading] = useState(true);
	const [access, setAccess] = useState(null);
	const [accessError, setAccessError] = useState("");
	const [view, setView] = useState("dashboard");
	const [collapsed, setCollapsed] = useState(false);

	const loadAccess = useCallback(async () => {
		setAccessLoading(true);
		setAccessError("");
		try {
			const response = await hrflowApi.me();
			setAccess(response.data || null);
		} catch (e) {
			setAccessError(apiMessage(e, "HRFlow access could not be verified."));
		} finally {
			setAccessLoading(false);
		}
	}, []);

	useEffect(() => { loadAccess(); }, [loadAccess]);

	if (accessLoading) {
		return (
			<Box sx={{ minHeight: "100vh", background: "var(--hr-page-bg)" }}>
				<LoadingBlock minHeight="100vh" />
			</Box>
		);
	}

	if (accessError || !hasHrAccess(access)) {
		return (
			<Box sx={{ minHeight: "100vh", background: "var(--hr-page-bg)", p: 2, display: "grid", placeItems: "center" }}>
				<Paper sx={{ ...panelSx, p: 3, width: "min(560px,100%)" }}>
					<HrBrand />
					<Typography sx={{ mt: 2.5, fontSize: 23, fontWeight: 950, color: hrColors.ink }}>
						HRFlow access required
					</Typography>
					<Alert severity="warning" sx={{ mt: 1.5, borderRadius: 1.6 }}>
						{accessError || "Your FlowSuite account does not currently have an active HRFlow access grant."}
					</Alert>
					<Box sx={{ mt: 2, display: "flex", gap: 1 }}>
						<Button
							variant="outlined"
							startIcon={<ArrowBackOutlinedIcon />}
							onClick={() => navigate("/modules")}
							sx={secondaryButtonSx}
						>
							Module Hub
						</Button>
						<Button variant="contained" onClick={loadAccess} sx={primaryButtonSx}>
							Check again
						</Button>
					</Box>
				</Paper>
			</Box>
		);
	}

	const roles = hrAccessRoles(access);
	const globalAdmin = isHrGlobalAdmin(access);
	const canOperate = globalAdmin || roles.some((r) => ["HR_ADMIN", "HR_HEAD", "HR_EXECUTIVE"].includes(r));
	const canRecruit = canOperate || roles.includes("RECRUITER");
	const canPublish = globalAdmin || roles.some((r) => ["HR_ADMIN", "HR_HEAD"].includes(r));
	const hodOnly = !canOperate && roles.includes("HOD");
	const canOrientation = canOperate || hodOnly;
	const canViewOnboarding = canOperate || roles.includes("HOD");

	const navItems = [
		{ ...NAV[0], section: "HOME" },
		{ ...NAV[1], section: "PEOPLE" },
		{ ...NAV[2], section: "WORKFLOW" },
		...(canViewOnboarding ? [
			{ ...NAV[3], section: "WORKFLOW" },
			{ ...NAV[4], section: "PEOPLE" },
		] : []),
		...(globalAdmin ? [{ key: "access", label: "HR Access", icon: <AdminPanelSettingsOutlinedIcon />, section: "ADMIN" }] : []),
	];

	const groupedNav = navItems.reduce((groups, item) => {
		const section = item.section || "WORKFLOW";
		if (!groups[section]) groups[section] = [];
		groups[section].push(item);
		return groups;
	}, { HOME: [], PEOPLE: [], WORKFLOW: [], ADMIN: [] });

	const currentHeader = HR_HEADER[view] || HR_HEADER.dashboard;
	const roleLabel = globalAdmin
		? "Administrator"
		: roles.length
			? humanize(roles[0])
			: "HRFlow User";
	const roleSummary = globalAdmin ? "GLOBAL ADMIN" : roles.map(humanize).join(" • ");
	const userName = user?.username || user?.name || "User";
	const avatarLetter = String(userName).trim().charAt(0).toUpperCase() || "U";

	const handleLogout = async () => {
		await logout();
		navigate("/login", { replace: true });
	};

	const renderNavItem = (item) => {
		const active = view === item.key;
		return (
			<Tooltip key={item.key} title={collapsed ? item.label : ""} placement="right">
				<Button
					onClick={() => setView(item.key)}
					sx={hrSidebarLinkSx(active, collapsed)}
				>
					<Box component="span" sx={hrSidebarIconSx}>
						{item.icon}
					</Box>
					{!collapsed ? <Box component="span">{item.label}</Box> : null}
				</Button>
			</Tooltip>
		);
	};

	return (
		<Box sx={hrShellSx}>
			<Box component="aside" sx={hrSidebarSx(collapsed)}>
				<Box sx={hrLogoSx}>
					<Box sx={hrMarkSx}>H</Box>
					{!collapsed ? (
						<Box sx={{ minWidth: 0 }}>
							<Typography sx={hrLogoTitleSx}>HRFlow</Typography>
							<Typography sx={hrMutedSx}>People Operations</Typography>
						</Box>
					) : null}
				</Box>

				<Box sx={hrSidebarIdentitySx(collapsed)}>
					<Box sx={hrAvatarSx}>{avatarLetter}</Box>
					{!collapsed ? (
						<Box sx={{ minWidth: 0 }}>
							<Typography noWrap sx={{ color: "var(--hr-text)", fontWeight: 900, fontSize: 12.5 }}>
								{userName}
							</Typography>
							<Typography noWrap sx={hrMutedSx}>{roleLabel}</Typography>
						</Box>
					) : null}
				</Box>

				<Divider sx={{ borderColor: "var(--hr-border)" }} />

				<Box
					component="nav"
					className="hr-sidebar-scroll"
					sx={{ py: .75, overflowY: "auto", overflowX: "hidden", flex: 1, scrollbarGutter: "stable" }}
				>
					{["HOME", "PEOPLE", "WORKFLOW", "ADMIN"].map((section) => {
						const sectionItems = groupedNav[section] || [];
						if (!sectionItems.length) return null;
						return (
							<Box key={section} sx={{ mb: .6 }}>
								{!collapsed ? (
									<Typography sx={hrSectionTitleSx}>
										{HR_SECTION_LABELS[section] || section}
									</Typography>
								) : null}
								{sectionItems.map(renderNavItem)}
							</Box>
						);
					})}
				</Box>

				<Divider sx={{ borderColor: "var(--hr-border)" }} />
				<Button
					onClick={() => setCollapsed((value) => !value)}
					sx={{ ...secondaryButtonSx, m: .8, minWidth: 0, justifyContent: collapsed ? "center" : "flex-start" }}
				>
					<MenuIcon />
					{!collapsed ? <Box component="span" sx={{ ml: .8 }}>Collapse</Box> : null}
				</Button>
			</Box>

			<Box sx={hrMainSx(collapsed)}>
				<Box component="header" sx={hrHeaderSx}>
					<Box sx={{ minWidth: 0 }}>
						<Typography sx={{ color: "var(--hr-text)", fontWeight: 950, fontSize: 17 }}>
							{currentHeader.title}
						</Typography>
						<Typography sx={hrMutedSx}>{currentHeader.subtitle}</Typography>
					</Box>

					<Box sx={{ display: "flex", gap: .7, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
						<Chip
							label={roleSummary || "HRFLOW"}
							size="small"
							sx={hrRoleChipSx}
						/>
						<ThemeToggleButton />
						<Tooltip title="Modules">
							<Button
								onClick={() => navigate("/modules")}
								sx={{ ...secondaryButtonSx, minWidth: 38, px: .8 }}
							>
								<AppsIcon />
							</Button>
						</Tooltip>
						<Tooltip title="Logout">
							<Button
								onClick={handleLogout}
								sx={{ ...secondaryButtonSx, minWidth: 38, px: .8 }}
							>
								<LogoutOutlinedIcon />
							</Button>
						</Tooltip>
					</Box>
				</Box>

				<Box component="main" sx={hrContentSx}>
					{view === "dashboard" ? <DashboardView onNavigate={setView} canViewOnboarding={canViewOnboarding} /> : null}
					{view === "candidates" ? <CandidatesView canRecruit={canRecruit} canOperate={canOperate} globalAdmin={globalAdmin} /> : null}
					{view === "forms" ? <FormsView onNavigate={setView} canViewOnboarding={canViewOnboarding} /> : null}
					{view === "onboarding" && canViewOnboarding ? <OnboardingView canOperate={canOperate} canPublish={canPublish} canOrientation={canOrientation} hodOnly={hodOnly} /> : null}
					{view === "employees" && canViewOnboarding ? <EmployeesView /> : null}
					{view === "access" && globalAdmin ? <AccessView /> : null}
				</Box>
			</Box>
		</Box>
	);
}
export default function HrFlowWorkspace() {
	return (
		<HrFlowThemeProvider>
			<HrFlowWorkspaceContent />
		</HrFlowThemeProvider>
	);
}

function FormsView({ onNavigate, canViewOnboarding }) {
	const forms = [
		{
			title: "Personal Data / Employment Application",
			source: "PDF pages 1 and 3–5",
			who: "Candidate",
			description: "The secure candidate application collects personal details, identity, family, education, last employers, languages, salary and the applicant declaration. Standard and Managerial / Administrative application types use the same candidate master.",
			location: "Candidates → Open candidate → Candidate Form; Generate Application Link for the candidate to fill it.",
			action: "Open Candidates",
			view: "candidates",
		},
		{
			title: "Joining Report by an Employee",
			source: "PDF page 2",
			who: "New joinee",
			description: "Generated from confirmed employee code, name, designation, department and joining date. The joinee acknowledges the report through the secure onboarding portal.",
			location: "Onboarding → Open case → Joining Form / Portal.",
			action: "Open Onboarding",
			view: "onboarding",
		},
		{
			title: "Holiday & Leave / HR Policy",
			source: "PDF page 6",
			who: "New joinee",
			description: "HR publishes the approved version and the employee acknowledges that exact snapshot. Historical accepted versions remain traceable.",
			location: "Onboarding → Policy / NDA / Declaration.",
			action: "Open Onboarding",
			view: "onboarding",
		},
		{
			title: "New Employee Orientation Checklist",
			source: "PDF page 7",
			who: "HR + HOD + New joinee",
			description: "HR orientation, department orientation and workplace visits are digital checklist items with completion, dates, assisted-by details and employee acknowledgement.",
			location: "Onboarding → Orientation Form.",
			action: "Open Onboarding",
			view: "onboarding",
		},
		{
			title: "Induction Feedback",
			source: "PDF page 8",
			who: "New joinee",
			description: "The Y / N / N.A. induction questions and suggestions are filled by the employee in the onboarding portal and reviewed by HR.",
			location: "Onboarding → Induction Feedback.",
			action: "Open Onboarding",
			view: "onboarding",
		},
		{
			title: "Mutual Non-Disclosure Agreement",
			source: "PDF pages 9–11",
			who: "New joinee + HR verification",
			description: "HR publishes the approved NDA version, the employee accepts the frozen text through the portal, and HR verifies the acceptance before onboarding completion.",
			location: "Onboarding → Policy / NDA / Declaration.",
			action: "Open Onboarding",
			view: "onboarding",
		},
		{
			title: "Employment Declaration",
			source: "PDF page 12",
			who: "New joinee",
			description: "The probation, notice and employment declaration is published as an approved snapshot and accepted by the employee through the onboarding portal.",
			location: "Onboarding → Policy / NDA / Declaration.",
			action: "Open Onboarding",
			view: "onboarding",
		},
	];

	return (
		<>
			<PageTitle
				eyebrow="INTEGRATED HR FORMS"
				title="Candidate & employee forms"
				subtitle="These are the digital FlowSuite equivalents of the forms in your HR Module PDF. Candidate forms are filled through the secure application link; joinee forms are completed through the onboarding case and secure employee portal."
			/>
			<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(2,minmax(0,1fr))" }, gap: 1.25 }}>
				{forms.map((form) => {
					const disabled = form.view === "onboarding" && !canViewOnboarding;
					return (
						<Paper key={form.title} sx={{ ...panelSx, p: 1.7, display: "flex", flexDirection: "column", gap: 1.1 }}>
							<Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "flex-start" }}>
								<Box sx={{ minWidth: 0 }}>
									<Typography sx={{ color: hrColors.ink, fontSize: 15.5, fontWeight: 950 }}>{form.title}</Typography>
									<Typography sx={{ mt: .25, color: hrColors.muted, fontSize: 11.5 }}>{form.source}</Typography>
								</Box>
								<Chip label={form.who} size="small" sx={{ borderRadius: 1.2, fontWeight: 850, color: hrColors.blue, background: "var(--hr-primary-soft)" }} />
							</Box>
							<Typography sx={{ color: hrColors.muted, fontSize: 12.5, lineHeight: 1.65 }}>{form.description}</Typography>
							<Box sx={{ mt: "auto", p: 1, borderRadius: 1.3, background: "var(--hr-surface)", border: `1px solid ${hrColors.line}` }}>
								<Typography sx={{ color: hrColors.muted, fontSize: 10.5, fontWeight: 900, textTransform: "uppercase", letterSpacing: .7 }}>Where it is</Typography>
								<Typography sx={{ mt: .3, color: hrColors.ink, fontSize: 12.2, fontWeight: 800 }}>{form.location}</Typography>
							</Box>
							<Button variant="outlined" disabled={disabled} onClick={() => onNavigate(form.view)} sx={secondaryButtonSx}>
								{disabled ? "Role restricted" : form.action}
							</Button>
						</Paper>
					);
				})}
			</Box>
		</>
	);
}

function DashboardView({ onNavigate, canViewOnboarding }) {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [stats, setStats] = useState({ candidates: 0, submitted: 0, selected: 0, onboarding: 0, joined: 0, employees: 0 });
	const [recentCandidates, setRecentCandidates] = useState([]);

	const load = useCallback(async () => {
		setLoading(true); setError("");
		try {
			const candidateRequests = [
				hrflowApi.listCandidates({ page: 0, size: 6, sort: "createdAt,desc" }),
				hrflowApi.listCandidates({ stage: "APPLICATION_SUBMITTED", page: 0, size: 1 }),
				hrflowApi.listCandidates({ stage: "SELECTED", page: 0, size: 1 }),
			];
			const [allCandidates, submitted, selected] = await Promise.all(candidateRequests);
			let onboarding = 0;
			let joined = 0;
			let employees = 0;
			if (canViewOnboarding) {
				const [onboardingResponse, joinedResponse, employeesResponse] = await Promise.all([
					hrflowApi.listOnboarding({ page: 0, size: 1 }),
					hrflowApi.listOnboarding({ status: "JOINED", page: 0, size: 1 }),
					hrflowApi.listEmployees({ page: 0, size: 1 }),
				]);
				onboarding = totalElements(onboardingResponse);
				joined = totalElements(joinedResponse);
				employees = totalElements(employeesResponse);
			}
			setStats({ candidates: totalElements(allCandidates), submitted: totalElements(submitted), selected: totalElements(selected), onboarding, joined, employees });
			setRecentCandidates(pageContent(allCandidates));
		} catch (e) { setError(apiMessage(e, "Dashboard data could not be loaded.")); }
		finally { setLoading(false); }
	}, [canViewOnboarding]);
	useEffect(() => { load(); }, [load]);
	if (loading) return <LoadingBlock />;
	return <>
		<PageTitle eyebrow="HRFLOW CONTROL CENTRE" title="Recruitment & onboarding overview" subtitle="One operational view from candidate application through joining, policy/NDA acknowledgements, orientation and active employee creation." actions={<Button startIcon={<RefreshOutlinedIcon />} onClick={load} sx={secondaryButtonSx}>Refresh</Button>} />
		<ErrorAlert error={error} onRetry={load} />
		<Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", lg: "repeat(6,1fr)" }, gap: 1.2, mb: 2 }}>
			<MetricCard label="Candidates" value={stats.candidates} helper="All records" onClick={() => onNavigate("candidates")} />
			<MetricCard label="Submitted" value={stats.submitted} helper="Awaiting review" tone="amber" onClick={() => onNavigate("candidates")} />
			<MetricCard label="Selected" value={stats.selected} helper="Ready to progress" tone="green" onClick={() => onNavigate("candidates")} />
			<MetricCard label="Onboarding cases" value={canViewOnboarding ? stats.onboarding : "—"} helper={canViewOnboarding ? "Total" : "Role restricted"} tone="violet" onClick={canViewOnboarding ? () => onNavigate("onboarding") : undefined} />
			<MetricCard label="Joined" value={canViewOnboarding ? stats.joined : "—"} helper={canViewOnboarding ? "Induction active" : "Role restricted"} tone="green" onClick={canViewOnboarding ? () => onNavigate("onboarding") : undefined} />
			<MetricCard label="Employees" value={canViewOnboarding ? stats.employees : "—"} helper={canViewOnboarding ? "Employee master" : "Role restricted"} tone="blue" onClick={canViewOnboarding ? () => onNavigate("employees") : undefined} />
		</Box>
		<Paper sx={{ ...panelSx, p: 2 }}><Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.3 }}><Typography sx={{ fontSize: 16, fontWeight: 950 }}>Recent candidates</Typography><Button size="small" onClick={() => onNavigate("candidates")} sx={secondaryButtonSx}>Open recruitment</Button></Box>{recentCandidates.length ? <SimpleCandidateRows rows={recentCandidates} /> : <EmptyState />}</Paper>
	</>;
}

function CandidatesView({ canRecruit, canOperate, globalAdmin }) {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [rows, setRows] = useState([]);
	const [total, setTotal] = useState(0);
	const [search, setSearch] = useState("");
	const [stage, setStage] = useState("");
	const [createOpen, setCreateOpen] = useState(false);
	const [createForm, setCreateForm] = useState(blankCandidate);
	const [selectedId, setSelectedId] = useState(null);

	const load = useCallback(async () => {
		setLoading(true); setError("");
		try { const response = await hrflowApi.listCandidates({ q: search, stage, page: 0, size: 50, sort: "createdAt,desc" }); setRows(pageContent(response)); setTotal(totalElements(response)); }
		catch (e) { setError(apiMessage(e, "Candidates could not be loaded.")); }
		finally { setLoading(false); }
	}, [search, stage]);
	useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [load]);

	const create = async () => {
		setError("");
		try { const response = await hrflowApi.createCandidate(createForm); setCreateOpen(false); setCreateForm(blankCandidate); await load(); setSelectedId(response.data?.id || null); }
		catch (e) { setError(apiMessage(e, "Candidate could not be created.")); }
	};

	return <>
		<PageTitle eyebrow="RECRUITMENT" title="Candidates" subtitle="Create candidate records, send secure application links, review submitted information, maintain HR fields, manage documents and progress candidates into onboarding." actions={<><Button startIcon={<RefreshOutlinedIcon />} onClick={load} sx={secondaryButtonSx}>Refresh</Button>{canRecruit ? <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => setCreateOpen(true)} sx={primaryButtonSx}>Add candidate</Button> : null}</>} />
		<ErrorAlert error={error} onRetry={load} />
		<Paper sx={{ ...panelSx, p: 1.4, mb: 1.5 }}><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(260px,1fr) 230px auto" }, gap: 1 }}><TextField size="small" placeholder="Search candidate, mobile, post…" value={search} onChange={(e) => setSearch(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlinedIcon fontSize="small" /></InputAdornment> }} sx={fieldSx} /><TextField select size="small" label="Stage" value={stage} onChange={(e) => setStage(e.target.value)} sx={fieldSx}><MenuItem value="">All stages</MenuItem>{HR_CANDIDATE_STAGES.map((value) => <MenuItem key={value} value={value}>{humanize(value)}</MenuItem>)}</TextField><Chip label={`${total} candidate${total === 1 ? "" : "s"}`} sx={{ alignSelf: "center", borderRadius: 1.2, fontWeight: 850 }} /></Box></Paper>
		<Paper sx={{ ...panelSx, overflow: "hidden" }}>{loading ? <LoadingBlock /> : rows.length ? <CandidateTable rows={rows} onOpen={(row) => setSelectedId(row.id)} /> : <EmptyState title="No candidates found" description="Create the first candidate or change your filters." />}</Paper>
		<CreateCandidateDialog open={createOpen} form={createForm} setForm={setCreateForm} onClose={() => setCreateOpen(false)} onCreate={create} />
		<CandidateDrawer candidateId={selectedId} open={Boolean(selectedId)} onClose={() => setSelectedId(null)} onChanged={load} canRecruit={canRecruit} canOperate={canOperate} globalAdmin={globalAdmin} />
	</>;
}

function CandidateTable({ rows, onOpen }) {
	return <Box sx={{ overflowX: "auto" }}><Box sx={{ minWidth: 940 }}><TableHead columns={["Candidate", "Applied For", "Stage", "Department", "HR Owner", "Submitted", ""]} />{rows.map((row) => <Box key={row.id} sx={tableRowSx}><Cell><Typography sx={mainCellSx}>{row.fullName || "Unnamed candidate"}</Typography><Typography sx={subCellSx}>{row.candidateNumber} • {row.mobileNo || row.email || "No contact"}</Typography></Cell><Cell>{row.postAppliedFor || "—"}</Cell><Cell><StatusChip value={row.stage} /></Cell><Cell>{row.department || "—"}</Cell><Cell>{row.hrOwner || "—"}</Cell><Cell>{formatDateTime(row.lastSubmittedAt)}</Cell><Cell><Button size="small" onClick={() => onOpen(row)} sx={secondaryButtonSx}>Open</Button></Cell></Box>)}</Box></Box>;
}

function CandidateDrawer({ candidateId, open, onClose, onChanged, canRecruit, canOperate, globalAdmin }) {
	const [loading, setLoading] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");
	const [candidate, setCandidate] = useState(null);
	const [documents, setDocuments] = useState([]);
	const [completeness, setCompleteness] = useState(null);
	const [audit, setAudit] = useState([]);
	const [tab, setTab] = useState(0);
	const [edit, setEdit] = useState({});
	const [stageForm, setStageForm] = useState({ stage: "", remarks: "" });
	const [upload, setUpload] = useState({ documentType: "PHOTO", remarks: "", file: null });
	const [generatedLink, setGeneratedLink] = useState("");
	const [onboardingForm, setOnboardingForm] = useState({ joiningDate: "", department: "", designation: "", location: "", reportingManager: "", appointedBy: "", remarks: "" });
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleteConfirm, setDeleteConfirm] = useState("");

	const load = useCallback(async () => {
		if (!candidateId) return;
		setLoading(true); setError("");
		try {
			const [candidateResponse, documentResponse, completenessResponse, auditResponse] = await Promise.all([
				hrflowApi.getCandidate(candidateId),
				hrflowApi.listCandidateDocuments(candidateId),
				hrflowApi.candidateDocumentCompleteness(candidateId),
				hrflowApi.candidateAudit(candidateId),
			]);
			const c = candidateResponse.data;
			setCandidate(c); setDocuments(documentResponse.data || []); setCompleteness(completenessResponse.data || null); setAudit(auditResponse.data || []);
			setEdit({ rowVersion: c.rowVersion, fullName: c.fullName || "", email: c.email || "", mobileNo: c.mobileNo || "", postAppliedFor: c.postAppliedFor || "", salaryApproved: c.salaryApproved ?? "", proposedJoiningDate: c.proposedJoiningDate || "", department: c.department || "", designation: c.designation || "", appointedBy: c.appointedBy || "", hrOwner: c.hrOwner || "" });
			setStageForm({ stage: c.stage || "", remarks: "" });
			setOnboardingForm((current) => ({ ...current, joiningDate: c.proposedJoiningDate || current.joiningDate, department: c.department || current.department, designation: c.designation || c.postAppliedFor || current.designation, appointedBy: c.appointedBy || current.appointedBy }));
		} catch (e) { setError(apiMessage(e, "Candidate could not be loaded.")); }
		finally { setLoading(false); }
	}, [candidateId]);
	useEffect(() => { if (open) { setTab(0); setGeneratedLink(""); setDeleteOpen(false); setDeleteConfirm(""); load(); } }, [open, load]);

	const run = async (fn, success) => { setBusy(true); setError(""); setMessage(""); try { await fn(); setMessage(success); await load(); await onChanged?.(); } catch (e) { setError(apiMessage(e)); } finally { setBusy(false); } };
	const saveEdit = () => run(() => hrflowApi.updateCandidate(candidateId, { ...edit, salaryApproved: edit.salaryApproved === "" ? null : Number(edit.salaryApproved) }), "Candidate HR details updated.");
	const changeStage = () => run(() => hrflowApi.changeCandidateStage(candidateId, stageForm), "Candidate stage updated.");
	const applicationLink = async () => { setBusy(true); setError(""); try { const response = await hrflowApi.createApplicationLink(candidateId); const url = publicApplicationUrl(response.data.token); setGeneratedLink(url); setMessage("New application link generated. Previous active application links are revoked."); await load(); await onChanged?.(); } catch (e) { setError(apiMessage(e)); } finally { setBusy(false); } };
	const createOnboarding = () => run(async () => { const body = Object.fromEntries(Object.entries(onboardingForm).map(([k,v]) => [k, String(v || "").trim() || null])); await hrflowApi.createOnboardingFromCandidate(candidateId, body); }, "Onboarding case created.");
	const uploadDoc = () => run(async () => { if (!upload.file) throw new Error("Choose a file first."); await hrflowApi.uploadCandidateDocument(candidateId, upload); setUpload({ documentType: "PHOTO", remarks: "", file: null }); }, "Document uploaded.");
	const archiveDoc = (doc) => run(() => hrflowApi.archiveCandidateDocument(candidateId, doc.id), "Document archived.");
	const downloadDoc = async (doc) => { try { const response = await hrflowApi.downloadCandidateDocument(candidateId, doc.id); saveBlob(response, doc.originalFileName || "document"); } catch (e) { setError(apiMessage(e)); } };

	const deleteCandidate = async () => {
		if (!globalAdmin || !candidate) return;
		const expected = String(candidate.candidateNumber || "").trim();
		if (!expected || deleteConfirm.trim().toUpperCase() !== expected.toUpperCase()) {
			setError(`Type ${expected || "the candidate number"} exactly to confirm permanent deletion.`);
			return;
		}

		setBusy(true);
		setError("");
		setMessage("");
		try {
			await hrflowApi.deleteCandidate(candidateId, candidate.rowVersion);
			setDeleteOpen(false);
			setDeleteConfirm("");
			onClose();
			await onChanged?.();
		} catch (e) {
			setError(apiMessage(e, "Candidate could not be deleted."));
		} finally {
			setBusy(false);
		}
	};

	const canOnboard = ["SELECTED", "OFFERED", "PRE_JOINING"].includes(candidate?.stage);
	return <Drawer anchor="right" open={open} onClose={busy ? undefined : onClose} PaperProps={{ sx: { width: { xs: "100%", sm: 720, lg: 860 }, maxWidth: "100%", borderRadius: 0 } }}>
		<Box sx={{ p: 1.7, borderBottom: `1px solid ${hrColors.line}`, display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center" }}>
			<Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 950, fontSize: 19 }}>{candidate?.fullName || "Candidate"}</Typography><Typography sx={{ color: hrColors.muted, fontSize: 12 }}>{candidate?.candidateNumber}</Typography></Box>
			<Box sx={{ display: "flex", gap: .7, alignItems: "center" }}>
				{globalAdmin && candidate ? <Button size="small" startIcon={<DeleteOutlineOutlinedIcon />} disabled={busy} onClick={() => { setDeleteConfirm(""); setDeleteOpen(true); }} sx={dangerButtonSx}>Delete candidate</Button> : null}
				<IconButton onClick={onClose} disabled={busy}><CloseOutlinedIcon /></IconButton>
			</Box>
		</Box>
		<Box sx={{ px: 1.5, borderBottom: `1px solid ${hrColors.line}` }}><Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto"><Tab label="Overview" /><Tab label="Candidate Form" /><Tab label="Documents" /><Tab label="Audit" /><Tab label="Onboarding" /></Tabs></Box>
		<Box sx={{ p: 2, overflowY: "auto" }}>{loading ? <LoadingBlock /> : <><ErrorAlert error={error} onRetry={load} />{message ? <Alert severity="success" onClose={() => setMessage("")} sx={{ mb: 1.5, borderRadius: 1.5 }}>{message}</Alert> : null}{tab === 0 ? <CandidateOverview candidate={candidate} edit={edit} setEdit={setEdit} canOperate={canOperate} busy={busy} onSave={saveEdit} stageForm={stageForm} setStageForm={setStageForm} canRecruit={canRecruit} onStage={changeStage} onApplicationLink={applicationLink} generatedLink={generatedLink} /> : null}{tab === 1 ? <CandidateApplicationView candidate={candidate} /> : null}{tab === 2 ? <CandidateDocuments documents={documents} completeness={completeness} upload={upload} setUpload={setUpload} canRecruit={canRecruit} canArchive={canOperate} busy={busy} onUpload={uploadDoc} onDownload={downloadDoc} onArchive={archiveDoc} /> : null}{tab === 3 ? <AuditList rows={audit} /> : null}{tab === 4 ? <CandidateOnboardingStarter candidate={candidate} canOnboard={canOnboard} canOperate={canOperate} form={onboardingForm} setForm={setOnboardingForm} busy={busy} onCreate={createOnboarding} /> : null}</>}</Box>

		<Dialog open={deleteOpen} onClose={busy ? undefined : () => setDeleteOpen(false)} fullWidth maxWidth="sm">
			<DialogTitle sx={{ fontWeight: 950, color: hrColors.red }}>Permanently delete candidate?</DialogTitle>
			<DialogContent dividers>
				<Alert severity="warning" sx={{ mb: 1.5, borderRadius: 1.5 }}>
					This is a FlowSuite ADMIN-only action. It permanently removes the candidate, uploaded/generated candidate documents, secure candidate links and any pre-joining onboarding case. Candidates already converted to an employee are protected and the backend will refuse deletion.
				</Alert>
				<Typography sx={{ color: hrColors.muted, fontSize: 12.5, mb: 1 }}>
					Type <Box component="span" sx={{ color: hrColors.ink, fontWeight: 950 }}>{candidate?.candidateNumber || "candidate number"}</Box> to confirm.
				</Typography>
				<TextField
					fullWidth
					size="small"
					label="Candidate number"
					value={deleteConfirm}
					onChange={(e) => setDeleteConfirm(e.target.value)}
					disabled={busy}
					sx={fieldSx}
				/>
			</DialogContent>
			<DialogActions sx={{ p: 1.5 }}>
				<Button onClick={() => setDeleteOpen(false)} disabled={busy} sx={secondaryButtonSx}>Cancel</Button>
				<Button
					variant="contained"
					startIcon={<DeleteOutlineOutlinedIcon />}
					disabled={busy || !candidate?.candidateNumber || deleteConfirm.trim().toUpperCase() !== String(candidate.candidateNumber).trim().toUpperCase()}
					onClick={deleteCandidate}
					sx={dangerButtonSx}
				>
					Delete permanently
				</Button>
			</DialogActions>
		</Dialog>
	</Drawer>;
}

function CandidateOverview({ candidate, edit, setEdit, canOperate, busy, onSave, stageForm, setStageForm, canRecruit, onStage, onApplicationLink, generatedLink }) {
	const set = (key) => (e) => setEdit((current) => ({ ...current, [key]: e.target.value }));
	return <Box sx={{ display: "grid", gap: 1.5 }}>
		<Paper variant="outlined" sx={sectionCardSx}><SectionTitle title="HR control fields" /><Box sx={formGridSx}><TextField size="small" label="Name" value={edit.fullName || ""} onChange={set("fullName")} disabled={!canOperate || busy} sx={fieldSx} /><TextField size="small" label="Mobile" value={edit.mobileNo || ""} onChange={set("mobileNo")} disabled={!canOperate || busy} sx={fieldSx} /><TextField size="small" label="Email" value={edit.email || ""} onChange={set("email")} disabled={!canOperate || busy} sx={fieldSx} /><TextField size="small" label="Post applied for" value={edit.postAppliedFor || ""} onChange={set("postAppliedFor")} disabled={!canOperate || busy} sx={fieldSx} /><TextField size="small" label="Department" value={edit.department || ""} onChange={set("department")} disabled={!canOperate || busy} sx={fieldSx} /><TextField size="small" label="Designation" value={edit.designation || ""} onChange={set("designation")} disabled={!canOperate || busy} sx={fieldSx} /><TextField size="small" label="HR owner" value={edit.hrOwner || ""} onChange={set("hrOwner")} disabled={!canOperate || busy} sx={fieldSx} /><TextField size="small" label="Appointed by" value={edit.appointedBy || ""} onChange={set("appointedBy")} disabled={!canOperate || busy} sx={fieldSx} /><TextField type="date" InputLabelProps={{ shrink: true }} size="small" label="Proposed joining date" value={edit.proposedJoiningDate || ""} onChange={set("proposedJoiningDate")} disabled={!canOperate || busy} sx={fieldSx} /><TextField type="number" size="small" label="Approved salary" value={edit.salaryApproved ?? ""} onChange={set("salaryApproved")} disabled={!canOperate || busy} sx={fieldSx} /></Box>{canOperate ? <Box sx={{ mt: 1.4 }}><Button variant="contained" disabled={busy} onClick={onSave} sx={primaryButtonSx}>Save HR details</Button></Box> : null}</Paper>
		<Paper variant="outlined" sx={sectionCardSx}><SectionTitle title="Recruitment stage" /><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "230px 1fr auto" }, gap: 1 }}><TextField select size="small" label="Stage" value={stageForm.stage || ""} onChange={(e) => setStageForm((c) => ({ ...c, stage: e.target.value }))} disabled={!canRecruit || busy} sx={fieldSx}>{HR_CANDIDATE_STAGES.filter((x) => x !== "JOINED").map((value) => <MenuItem key={value} value={value}>{humanize(value)}</MenuItem>)}</TextField><TextField size="small" label="Remarks" value={stageForm.remarks || ""} onChange={(e) => setStageForm((c) => ({ ...c, remarks: e.target.value }))} disabled={!canRecruit || busy} sx={fieldSx} />{canRecruit ? <Button variant="outlined" disabled={busy} onClick={onStage} sx={secondaryButtonSx}>Update stage</Button> : null}</Box></Paper>
		<Paper variant="outlined" sx={sectionCardSx}><SectionTitle title="Candidate application link" subtitle="Generate a secure external link. The raw token is returned only now, so copy the URL before closing this record." />{canRecruit ? <Button variant="contained" startIcon={<OpenInNewOutlinedIcon />} disabled={busy || ["REJECTED", "WITHDRAWN", "JOINED"].includes(candidate?.stage)} onClick={onApplicationLink} sx={primaryButtonSx}>Generate application link</Button> : null}{generatedLink ? <Box sx={{ mt: 1.2, display: "grid", gridTemplateColumns: "1fr auto", gap: 1 }}><TextField size="small" value={generatedLink} InputProps={{ readOnly: true }} sx={fieldSx} /><Tooltip title="Copy"><IconButton onClick={() => copyText(generatedLink)}><ContentCopyOutlinedIcon /></IconButton></Tooltip></Box> : null}</Paper>
	</Box>;
}

function CandidateApplicationView({ candidate }) {
	if (!candidate) return null;
	const info = [
		["Application type", humanize(candidate.applicationType)],
		["Post applied for", candidate.postAppliedFor],
		["Name", candidate.fullName],
		["Father / Husband", candidate.fatherOrHusbandName],
		["DOB", formatDate(candidate.dateOfBirth)],
		["Gender", humanize(candidate.gender)],
		["Marital status", humanize(candidate.maritalStatus)],
		["Mobile", candidate.mobileNo],
		["Email", candidate.email],
		["Present address", candidate.presentAddress],
		["Permanent address", candidate.permanentAddress],
		["Aadhaar", candidate.aadhaarNo],
		["PAN", candidate.panNo],
		["Driving licence", candidate.drivingLicenseNo],
		["Nationality", candidate.nationality],
		["Religion", candidate.religion],
		["Vaccination", candidate.vaccination],
		["Family contact", candidate.familyContactNo],
		["Reference", candidate.referenceName],
		["Work experience summary", candidate.workExperienceSummary],
		["Education summary", candidate.educationalQualificationSummary],
		["Previously worked at Alsorg", candidate.previousAlsorgExperience ? "Yes" : "No"],
		["Previous Alsorg details", candidate.previousAlsorgExperienceDetails],
		["Family / blood relation at Alsorg", candidate.familyMemberWorkedAtAlsorg ? "Yes" : "No"],
		["Family relation details", candidate.familyMemberWorkedAtAlsorgDetails],
		["Current salary", money(candidate.salaryDrawn)],
		["Expected salary", money(candidate.salaryExpected)],
		["Approved salary", money(candidate.salaryApproved)],
		["Extracurricular activities", candidate.extracurricularActivities],
		["Hobbies", candidate.hobbies],
		["Awards / appreciations", candidate.awardsAppreciations],
		["Organization chart / position note", candidate.organizationChartNote],
		["Applicant declaration", candidate.declarationAccepted ? `Accepted ${formatDateTime(candidate.declarationAcceptedAt)}` : "Not accepted"],
	];
	return (
		<Box sx={{ display: "grid", gap: 1.5 }}>
			<Paper variant="outlined" sx={sectionCardSx}>
				<SectionTitle title="Candidate form" subtitle={`Digital Personal Data / Employment Application • ${humanize(candidate.applicationType)} • ${humanize(candidate.stage)}`} />
				<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1 }}>
					{info.map(([label, value]) => <Info key={label} label={label} value={value} />)}
				</Box>
			</Paper>
			<ArraySummary title="Family details" rows={candidate.familyMembers} render={(r) => `${r.name || "—"} • ${r.relation || "—"} • ${formatDate(r.dateOfBirth)} • ${r.dependent ? "Dependent" : "Not dependent"}`} />
			<ArraySummary title="Educational qualifications" rows={candidate.educations} render={(r) => `${r.examination || "—"} • ${r.boardOrUniversity || "—"} • ${r.year || "—"} • ${r.marksPercent ?? "—"}%`} />
			<ArraySummary title="Previous company details" rows={candidate.employments} render={(r) => `${r.companyName || "—"} • ${r.designation || "—"} • ${formatDate(r.fromDate)} - ${formatDate(r.toDate)} • HR: ${r.hrName || "—"} / ${r.hrContact || "—"}`} />
			<ArraySummary title="Languages known" rows={candidate.languages} render={(r) => `${r.language || "—"} • ${r.canRead ? "Read " : ""}${r.canWrite ? "Write " : ""}${r.canSpeak ? "Speak" : ""}`} />
		</Box>
	);
}

function CandidateDocuments({ documents, completeness, upload, setUpload, canRecruit, canArchive, busy, onUpload, onDownload, onArchive }) {
	return <Box sx={{ display: "grid", gap: 1.5 }}><Paper variant="outlined" sx={sectionCardSx}><SectionTitle title="Document completeness" /><Box sx={{ display: "flex", gap: .8, flexWrap: "wrap" }}>{[["Photo",completeness?.hasPhoto],["Resume",completeness?.hasResume],["Aadhaar",completeness?.hasAadhaar],["PAN",completeness?.hasPan]].map(([label,ok]) => <Chip key={label} label={`${label}: ${ok ? "Yes" : "No"}`} sx={{ borderRadius: 1.2, fontWeight: 850, color: ok ? hrColors.green : hrColors.red, background: ok ? "var(--hr-success-soft)" : "var(--hr-danger-soft)" }} />)}</Box></Paper>{canRecruit ? <Paper variant="outlined" sx={sectionCardSx}><SectionTitle title="Upload document" /><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "200px 1fr auto auto" }, gap: 1 }}><TextField select size="small" label="Type" value={upload.documentType} onChange={(e) => setUpload((c) => ({ ...c, documentType: e.target.value }))} sx={fieldSx}>{HR_UPLOAD_DOCUMENT_TYPES.map((type) => <MenuItem key={type} value={type}>{humanize(type)}</MenuItem>)}</TextField><TextField size="small" label="Remarks" value={upload.remarks} onChange={(e) => setUpload((c) => ({ ...c, remarks: e.target.value }))} sx={fieldSx} /><Button component="label" variant="outlined" startIcon={<UploadFileOutlinedIcon />} sx={secondaryButtonSx}>{upload.file ? upload.file.name : "Choose file"}<input hidden type="file" onChange={(e) => setUpload((c) => ({ ...c, file: e.target.files?.[0] || null }))} /></Button><Button variant="contained" disabled={busy || !upload.file} onClick={onUpload} sx={primaryButtonSx}>Upload</Button></Box></Paper> : null}<Paper variant="outlined" sx={sectionCardSx}><SectionTitle title="Active documents" />{documents.length ? <Box sx={{ display: "grid", gap: .8 }}>{documents.map((doc) => <Box key={doc.id} sx={{ p: 1, borderRadius: 1.3, border: `1px solid ${hrColors.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap" }}><Box><Typography sx={mainCellSx}>{humanize(doc.documentType)}</Typography><Typography sx={subCellSx}>{doc.originalFileName} • {formatDateTime(doc.uploadedAt)} • {doc.uploadedBy}</Typography></Box><Box sx={{ display: "flex", gap: .7 }}><Button size="small" startIcon={<DownloadOutlinedIcon />} onClick={() => onDownload(doc)} sx={secondaryButtonSx}>Download</Button>{canArchive ? <Button size="small" color="error" startIcon={<ArchiveOutlinedIcon />} onClick={() => onArchive(doc)} sx={{ ...secondaryButtonSx, color: hrColors.red }}>Archive</Button> : null}</Box></Box>)}</Box> : <EmptyState title="No documents" />}</Paper></Box>;
}

function CandidateOnboardingStarter({ candidate, canOnboard, canOperate, form, setForm, busy, onCreate }) {
	const set = (key) => (e) => setForm((c) => ({ ...c, [key]: e.target.value }));
	return <Paper variant="outlined" sx={sectionCardSx}><SectionTitle title="Convert to onboarding" subtitle="Only SELECTED, OFFERED or PRE_JOINING candidates can enter onboarding. The backend prevents duplicate onboarding cases." />{!canOnboard ? <Alert severity="info" sx={{ borderRadius: 1.5 }}>Current stage is {humanize(candidate?.stage)}. Move the candidate to SELECTED / OFFERED / PRE_JOINING first.</Alert> : <><Box sx={formGridSx}><TextField type="date" InputLabelProps={{ shrink: true }} size="small" label="Joining date" value={form.joiningDate} onChange={set("joiningDate")} sx={fieldSx} /><TextField size="small" label="Department" value={form.department} onChange={set("department")} sx={fieldSx} /><TextField size="small" label="Designation" value={form.designation} onChange={set("designation")} sx={fieldSx} /><TextField size="small" label="Location" value={form.location} onChange={set("location")} sx={fieldSx} /><TextField size="small" label="Reporting manager" value={form.reportingManager} onChange={set("reportingManager")} sx={fieldSx} /><TextField size="small" label="Appointed by" value={form.appointedBy} onChange={set("appointedBy")} sx={fieldSx} /><TextField size="small" label="Remarks" value={form.remarks} onChange={set("remarks")} sx={fieldSx} /></Box>{canOperate ? <Button variant="contained" disabled={busy || !form.department.trim() || !form.designation.trim()} onClick={onCreate} sx={{ ...primaryButtonSx, mt: 1.5 }}>Create onboarding case</Button> : <Alert severity="info" sx={{ mt: 1.5 }}>Your HRFlow role can review this candidate but cannot create onboarding cases.</Alert>}</>}</Paper>;
}

function OnboardingView({ canOperate, canPublish, canOrientation, hodOnly }) {
	const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [rows, setRows] = useState([]); const [total, setTotal] = useState(0); const [status, setStatus] = useState(""); const [selectedId, setSelectedId] = useState(null);
	const load = useCallback(async () => { setLoading(true); setError(""); try { const response = await hrflowApi.listOnboarding({ status, page: 0, size: 50, sort: "createdAt,desc" }); setRows(pageContent(response)); setTotal(totalElements(response)); } catch (e) { setError(apiMessage(e, "Onboarding cases could not be loaded.")); } finally { setLoading(false); } }, [status]);
	useEffect(() => { load(); }, [load]);
	return <><PageTitle eyebrow="JOINING & INDUCTION" title="Onboarding" subtitle="Control pre-joining details, candidate documents, joining confirmation, policies, NDA, declaration, HR/HOD orientation, employee feedback and final onboarding completion." actions={<Button startIcon={<RefreshOutlinedIcon />} onClick={load} sx={secondaryButtonSx}>Refresh</Button>} /><ErrorAlert error={error} onRetry={load} /><Paper sx={{ ...panelSx, p: 1.4, mb: 1.5 }}><Box sx={{ display: "flex", gap: 1, justifyContent: "space-between", flexWrap: "wrap" }}><TextField select size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ ...fieldSx, minWidth: 230 }}><MenuItem value="">All statuses</MenuItem>{HR_ONBOARDING_STATUSES.map((value) => <MenuItem key={value} value={value}>{humanize(value)}</MenuItem>)}</TextField><Chip label={`${total} case${total === 1 ? "" : "s"}`} sx={{ borderRadius: 1.2, fontWeight: 850 }} /></Box></Paper><Paper sx={{ ...panelSx, overflow: "hidden" }}>{loading ? <LoadingBlock /> : rows.length ? <OnboardingTable rows={rows} onOpen={(row) => setSelectedId(row.id)} /> : <EmptyState title="No onboarding cases" />}</Paper><OnboardingDrawer onboardingId={selectedId} open={Boolean(selectedId)} onClose={() => setSelectedId(null)} onChanged={load} canOperate={canOperate} canPublish={canPublish} canOrientation={canOrientation} hodOnly={hodOnly} /></>;
}

function OnboardingTable({ rows, onOpen }) { return <Box sx={{ overflowX: "auto" }}><Box sx={{ minWidth: 900 }}><TableHead columns={["Candidate", "Status", "Joining", "Department", "Designation", "Location", ""]} />{rows.map((row) => <Box key={row.id} sx={tableRowSx}><Cell><Typography sx={mainCellSx}>{row.candidateName}</Typography><Typography sx={subCellSx}>{row.candidateNumber}</Typography></Cell><Cell><StatusChip value={row.status} /></Cell><Cell>{formatDate(row.joiningDate)}</Cell><Cell>{row.department || "—"}</Cell><Cell>{row.designation || "—"}</Cell><Cell>{row.location || "—"}</Cell><Cell><Button size="small" onClick={() => onOpen(row)} sx={secondaryButtonSx}>Open</Button></Cell></Box>)}</Box></Box>; }

function OnboardingDrawer({ onboardingId, open, onClose, onChanged, canOperate, canPublish, canOrientation, hodOnly }) {
	const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [detail, setDetail] = useState(null); const [completion, setCompletion] = useState(null); const [joining, setJoining] = useState(null); const [policy, setPolicy] = useState(null); const [nda, setNda] = useState(null); const [declaration, setDeclaration] = useState(null); const [orientation, setOrientation] = useState(null); const [feedback, setFeedback] = useState(null); const [tab, setTab] = useState(0); const [portalLink, setPortalLink] = useState(""); const [edit, setEdit] = useState({}); const [joinForm, setJoinForm] = useState({ employeeCode: "", joiningDate: "", employeeAcknowledged: false }); const [legalDraft, setLegalDraft] = useState({ policy: { version: "2026.1", title: "Holiday & Leave / HR Policy", body: "" }, nda: { version: "1.0", title: "Mutual Non-Disclosure Agreement", body: "" }, declaration: { version: "1.0", title: "Employment Declaration", body: "" } }); const [orientationDraft, setOrientationDraft] = useState([]);
	const safeGet = async (fn) => { try { const r = await fn(); return r.data || null; } catch (e) { if (e?.response?.status === 404) return null; throw e; } };
	const load = useCallback(async () => { if (!onboardingId) return; setLoading(true); setError(""); try { const detailResponse = await hrflowApi.getOnboarding(onboardingId); const d = detailResponse.data; const [c,j,p,n,dec,o,f] = await Promise.all([safeGet(() => hrflowApi.getCompletion(onboardingId)), safeGet(() => hrflowApi.getJoiningReport(onboardingId)), safeGet(() => hrflowApi.getPolicy(onboardingId)), safeGet(() => hrflowApi.getNda(onboardingId)), safeGet(() => hrflowApi.getDeclaration(onboardingId)), safeGet(() => hrflowApi.getOrientation(onboardingId)), safeGet(() => hrflowApi.getFeedback(onboardingId))]); setDetail(d); setCompletion(c); setJoining(j); setPolicy(p); setNda(n); setDeclaration(dec); setOrientation(o); setFeedback(f); setEdit({ rowVersion: d.rowVersion, status: d.status, joiningDate: d.joiningDate || "", department: d.department || "", designation: d.designation || "", location: d.location || "", reportingManager: d.reportingManager || "", appointedBy: d.appointedBy || "", remarks: d.remarks || "" }); setJoinForm((current) => ({ ...current, joiningDate: d.joiningDate || current.joiningDate })); setLegalDraft({ policy: p ? { version: p.version, title: p.title, body: p.body } : { version: "2026.1", title: "Holiday & Leave / HR Policy", body: "" }, nda: n ? { version: n.version, title: n.title, body: n.body } : { version: "1.0", title: "Mutual Non-Disclosure Agreement", body: "" }, declaration: dec ? { version: dec.version, title: dec.title, body: dec.body } : { version: "1.0", title: "Employment Declaration", body: "" } }); setOrientationDraft((o?.tasks || []).map((task) => ({ ...task }))); } catch (e) { setError(apiMessage(e, "Onboarding case could not be loaded.")); } finally { setLoading(false); } }, [onboardingId]);
	useEffect(() => { if (open) { setTab(0); setPortalLink(""); load(); } }, [open, load]);
	const run = async (fn, success) => { setBusy(true); setError(""); setMessage(""); try { await fn(); setMessage(success); await load(); await onChanged?.(); } catch (e) { setError(apiMessage(e)); } finally { setBusy(false); } };
	const createPortal = async () => { setBusy(true); setError(""); try { const r = await hrflowApi.createOnboardingPortalLink(onboardingId); setPortalLink(publicOnboardingUrl(r.data.token)); setMessage("New onboarding portal link generated. Copy it before closing this record."); } catch (e) { setError(apiMessage(e)); } finally { setBusy(false); } };
	const updateDetail = () => run(() => hrflowApi.updateOnboarding(onboardingId, { ...edit, status: ["JOINED","ONBOARDING_COMPLETE"].includes(edit.status) ? null : edit.status }), "Onboarding details updated.");
	const confirmJoining = () => run(() => hrflowApi.confirmJoining(onboardingId, { employeeCode: joinForm.employeeCode.trim() || null, joiningDate: joinForm.joiningDate || null, employeeAcknowledged: Boolean(joinForm.employeeAcknowledged) }), "Joining confirmed and employee master created.");
	const setLegal = (kind) => run(() => ({ policy: hrflowApi.setPolicy, nda: hrflowApi.setNda, declaration: hrflowApi.setDeclaration }[kind])(onboardingId, legalDraft[kind]), `${humanize(kind)} snapshot published.`);
	const verifyNda = () => run(() => hrflowApi.verifyNda(onboardingId), "NDA acceptance verified.");
	const saveOrientation = () => run(() => hrflowApi.updateOrientation(onboardingId, { expectedStateSha256: orientation?.stateSha256 || null, tasks: orientationDraft.filter((task) => !hodOnly || ["DEPARTMENT", "VISIT"].includes(task.section)).map((task) => ({ code: task.code, completed: Boolean(task.completed), remarks: task.remarks || null, visitDate: task.visitDate || null, assistedBy: task.assistedBy || null })) }), "Orientation checklist updated.");
	const complete = () => run(() => hrflowApi.completeOnboarding(onboardingId), "Onboarding marked complete.");
	return <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: "100%", sm: 820, lg: 980 }, maxWidth: "100%" } }}><Box sx={{ p: 1.7, borderBottom: `1px solid ${hrColors.line}`, display: "flex", justifyContent: "space-between", gap: 1 }}><Box><Typography sx={{ fontWeight: 950, fontSize: 19 }}>{detail?.candidateName || "Onboarding"}</Typography><Typography sx={{ color: hrColors.muted, fontSize: 12 }}>{detail?.candidateNumber} • {humanize(detail?.status)}</Typography></Box><IconButton onClick={onClose}><CloseOutlinedIcon /></IconButton></Box><Box sx={{ px: 1.5, borderBottom: `1px solid ${hrColors.line}` }}><Tabs value={tab} onChange={(_,v) => setTab(v)} variant="scrollable" scrollButtons="auto"><Tab label="Joining Form" /><Tab label="Policy / NDA / Declaration" /><Tab label="Orientation Form" /><Tab label="Induction Feedback" /><Tab label="Completion" /></Tabs></Box><Box sx={{ p: 2, overflowY: "auto" }}>{loading ? <LoadingBlock /> : <><ErrorAlert error={error} onRetry={load} />{message ? <Alert severity="success" onClose={() => setMessage("")} sx={{ mb: 1.5, borderRadius: 1.5 }}>{message}</Alert> : null}{tab === 0 ? <OnboardingOverview detail={detail} edit={edit} setEdit={setEdit} canOperate={canOperate} busy={busy} onSave={updateDetail} portalLink={portalLink} onPortal={createPortal} joining={joining} joinForm={joinForm} setJoinForm={setJoinForm} onConfirm={confirmJoining} /> : null}{tab === 1 ? <LegalEditor canPublish={canPublish} busy={busy} drafts={legalDraft} setDrafts={setLegalDraft} policy={policy} nda={nda} declaration={declaration} completion={completion} onPublish={setLegal} onVerifyNda={verifyNda} /> : null}{tab === 2 ? <OrientationEditor orientation={orientation} draft={orientationDraft} setDraft={setOrientationDraft} canOrientation={canOrientation} hodOnly={hodOnly} busy={busy} onSave={saveOrientation} /> : null}{tab === 3 ? <FeedbackView feedback={feedback} /> : null}{tab === 4 ? <CompletionView completion={completion} canOperate={canOperate} busy={busy} onComplete={complete} /> : null}</>}</Box></Drawer>;
}

function OnboardingOverview({ detail, edit, setEdit, canOperate, busy, onSave, portalLink, onPortal, joining, joinForm, setJoinForm, onConfirm }) {
	if (!detail) return null; const locked = ["JOINED","ONBOARDING_COMPLETE"].includes(detail.status); const set = (key) => (e) => setEdit((c) => ({ ...c, [key]: e.target.value }));
	return <Box sx={{ display: "grid", gap: 1.5 }}><Paper variant="outlined" sx={sectionCardSx}><SectionTitle title="Employment & joining setup" /><Box sx={formGridSx}><TextField type="date" InputLabelProps={{ shrink: true }} size="small" label="Joining date" value={edit.joiningDate || ""} onChange={set("joiningDate")} disabled={!canOperate || busy || locked} sx={fieldSx} /><TextField size="small" label="Department" value={edit.department || ""} onChange={set("department")} disabled={!canOperate || busy || locked} sx={fieldSx} /><TextField size="small" label="Designation" value={edit.designation || ""} onChange={set("designation")} disabled={!canOperate || busy || locked} sx={fieldSx} /><TextField size="small" label="Location" value={edit.location || ""} onChange={set("location")} disabled={!canOperate || busy || locked} sx={fieldSx} /><TextField size="small" label="Reporting manager" value={edit.reportingManager || ""} onChange={set("reportingManager")} disabled={!canOperate || busy || locked} sx={fieldSx} /><TextField size="small" label="Appointed by" value={edit.appointedBy || ""} onChange={set("appointedBy")} disabled={!canOperate || busy || locked} sx={fieldSx} /><TextField size="small" label="Remarks" value={edit.remarks || ""} onChange={set("remarks")} disabled={!canOperate || busy || locked} sx={fieldSx} /></Box>{canOperate && !locked ? <Button variant="contained" disabled={busy} onClick={onSave} sx={{ ...primaryButtonSx, mt: 1.3 }}>Save onboarding details</Button> : null}</Paper><Paper variant="outlined" sx={sectionCardSx}><SectionTitle title="Secure joinee portal" subtitle="The onboarding token is separate from the candidate application token and is intended for the complete joining/induction period." />{canOperate ? <Button variant="contained" startIcon={<OpenInNewOutlinedIcon />} disabled={busy || detail.status === "CANCELLED" || detail.status === "ONBOARDING_COMPLETE"} onClick={onPortal} sx={primaryButtonSx}>Generate onboarding link</Button> : null}{portalLink ? <Box sx={{ mt: 1.2, display: "grid", gridTemplateColumns: "1fr auto", gap: 1 }}><TextField size="small" value={portalLink} InputProps={{ readOnly: true }} sx={fieldSx} /><IconButton onClick={() => copyText(portalLink)}><ContentCopyOutlinedIcon /></IconButton></Box> : null}</Paper><Paper variant="outlined" sx={sectionCardSx}><SectionTitle title="Joining Report & Employee Master" subtitle="Joining is a controlled workflow action. It creates the employee record and freezes the joining report snapshot." />{joining ? <Alert icon={<CheckCircleOutlineOutlinedIcon />} severity="success" sx={{ borderRadius: 1.5 }}>Joining confirmed. Employee code: <b>{joining.employeeCode}</b>. Employee acknowledgement: {joining.employeeAcknowledged ? "Yes" : "Pending"}.</Alert> : <><Box sx={formGridSx}><TextField size="small" label="Employee code (optional)" value={joinForm.employeeCode} onChange={(e) => setJoinForm((c) => ({ ...c, employeeCode: e.target.value }))} disabled={!canOperate || busy} sx={fieldSx} /><TextField type="date" InputLabelProps={{ shrink: true }} size="small" label="Actual joining date" value={joinForm.joiningDate} onChange={(e) => setJoinForm((c) => ({ ...c, joiningDate: e.target.value }))} disabled={!canOperate || busy} sx={fieldSx} /><FormControlLabel control={<Checkbox checked={Boolean(joinForm.employeeAcknowledged)} onChange={(e) => setJoinForm((c) => ({ ...c, employeeAcknowledged: e.target.checked }))} disabled={!canOperate || busy} />} label="Employee is acknowledging at the same time" /></Box>{canOperate ? <Button variant="contained" disabled={busy || !joinForm.joiningDate} onClick={onConfirm} sx={{ ...primaryButtonSx, mt: 1.2 }}>Confirm joining</Button> : null}</>}</Paper></Box>;
}

function LegalEditor({ canPublish, busy, drafts, setDrafts, policy, nda, declaration, completion, onPublish, onVerifyNda }) {
	return <Box sx={{ display: "grid", gap: 1.5 }}><LegalEditorCard kind="policy" title="Holiday / Leave & HR Policy" current={policy} draft={drafts.policy} setDraft={(next) => setDrafts((c) => ({ ...c, policy: next }))} canPublish={canPublish} busy={busy} onPublish={() => onPublish("policy")} /><LegalEditorCard kind="nda" title="Mutual Non-Disclosure Agreement" current={nda} draft={drafts.nda} setDraft={(next) => setDrafts((c) => ({ ...c, nda: next }))} canPublish={canPublish} busy={busy} onPublish={() => onPublish("nda")} extra={canPublish && nda ? <Button variant="outlined" disabled={busy || !completion?.ndaAccepted || completion?.ndaVerified} onClick={onVerifyNda} sx={secondaryButtonSx}>{completion?.ndaVerified ? "NDA verified" : "Verify employee NDA acceptance"}</Button> : null} /><LegalEditorCard kind="declaration" title="Employment Declaration" current={declaration} draft={drafts.declaration} setDraft={(next) => setDrafts((c) => ({ ...c, declaration: next }))} canPublish={canPublish} busy={busy} onPublish={() => onPublish("declaration")} /></Box>;
}

function LegalEditorCard({ title, current, draft, setDraft, canPublish, busy, onPublish, extra }) { return <Paper variant="outlined" sx={sectionCardSx}><Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}><SectionTitle title={title} subtitle={current ? `Current version ${current.version} • ${formatDateTime(current.publishedAt)}` : "No version published yet."} />{current ? <Chip label={`v${current.version}`} sx={{ borderRadius: 1.2, fontWeight: 850 }} /> : null}</Box>{canPublish ? <><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "160px 1fr" }, gap: 1, mb: 1 }}><TextField size="small" label="Version" value={draft.version} onChange={(e) => setDraft({ ...draft, version: e.target.value })} sx={fieldSx} /><TextField size="small" label="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} sx={fieldSx} /></Box><TextField fullWidth multiline minRows={8} label="Approved document text" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} sx={fieldSx} /><Box sx={{ mt: 1.2, display: "flex", gap: 1, flexWrap: "wrap" }}><Button variant="contained" disabled={busy || !draft.version.trim() || !draft.body.trim()} onClick={onPublish} sx={primaryButtonSx}>Publish / replace current version</Button>{extra}</Box></> : current ? <Paper variant="outlined" sx={{ p: 1.3, borderRadius: 1.4, whiteSpace: "pre-wrap", maxHeight: 320, overflowY: "auto", background: "var(--hr-card-bg-elevated)" }}><Typography sx={{ fontSize: 12.5, lineHeight: 1.65 }}>{current.body}</Typography></Paper> : <Alert severity="info">Only HR Admin / HR Head can publish the approved text.</Alert>}</Paper>; }

function OrientationEditor({ orientation, draft, setDraft, canOrientation, hodOnly, busy, onSave }) { const update = (index,key,value) => setDraft((rows) => rows.map((row,i) => i === index ? { ...row, [key]: value } : row)); const groups = [...new Set(draft.map((t) => t.section))]; return <Paper variant="outlined" sx={sectionCardSx}><SectionTitle title="Employee Orientation Checklist" subtitle="HR completes HR topics. HOD-only access is restricted by the backend to DEPARTMENT and VISIT items." />{orientation?.employeeAcknowledged ? <Alert severity="success" sx={{ mb: 1.5 }}>Employee acknowledged the completed orientation on {formatDateTime(orientation.employeeAcknowledgedAt)}. The checklist is frozen.</Alert> : null}{groups.map((group) => <Box key={group} sx={{ mb: 1.7 }}><Typography sx={{ mb: .7, color: hrColors.blue, fontSize: 11, fontWeight: 950, letterSpacing: .8 }}>{humanize(group)}</Typography><Box sx={{ display: "grid", gap: .65 }}>{draft.filter((t) => t.section === group).map((task) => { const index = draft.findIndex((x) => x.code === task.code); const taskEditable = canOrientation && (!hodOnly || ["DEPARTMENT", "VISIT"].includes(task.section)); return <Box key={task.code} sx={{ p: 1, borderRadius: 1.2, background: task.completed ? "var(--hr-success-soft)" : "var(--hr-surface)", border: `1px solid ${task.completed ? "var(--hr-success-border)" : hrColors.line}` }}><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(240px,1fr) 150px 180px" }, gap: 1, alignItems: "center" }}><FormControlLabel control={<Checkbox checked={Boolean(task.completed)} onChange={(e) => update(index,"completed",e.target.checked)} disabled={!taskEditable || busy || orientation?.employeeAcknowledged} />} label={<Box><Typography sx={{ fontSize: 12.5, fontWeight: 800 }}>{task.label}</Typography><Typography sx={{ fontSize: 10.5, color: hrColors.muted }}>{task.code} {task.completedBy ? `• ${task.completedBy}` : ""}</Typography></Box>} /><TextField type="date" InputLabelProps={{ shrink: true }} size="small" label="Visit date" value={task.visitDate || ""} onChange={(e) => update(index,"visitDate",e.target.value)} disabled={!taskEditable || busy || orientation?.employeeAcknowledged} sx={fieldSx} /><TextField size="small" label="Assisted by" value={task.assistedBy || ""} onChange={(e) => update(index,"assistedBy",e.target.value)} disabled={!taskEditable || busy || orientation?.employeeAcknowledged} sx={fieldSx} /></Box><TextField fullWidth size="small" label="Remarks" value={task.remarks || ""} onChange={(e) => update(index,"remarks",e.target.value)} disabled={!taskEditable || busy || orientation?.employeeAcknowledged} sx={{ ...fieldSx, mt: .7 }} /></Box>; })}</Box></Box>)}{canOrientation && !orientation?.employeeAcknowledged ? <Button variant="contained" disabled={busy || !draft.length} onClick={onSave} sx={primaryButtonSx}>Save orientation checklist</Button> : null}</Paper>; }

function FeedbackView({ feedback }) { return <Paper variant="outlined" sx={sectionCardSx}><SectionTitle title="Induction feedback" subtitle="Submitted by the joinee through the secure onboarding portal." />{feedback ? <Box sx={{ display: "grid", gap: .8 }}>{feedback.answers?.map((answer, index) => <Box key={answer.code} sx={{ p: 1, borderRadius: 1.2, background: "var(--hr-surface)", border: `1px solid ${hrColors.line}` }}><Typography sx={{ fontSize: 12.5, fontWeight: 850 }}>{index + 1}. {answer.question}</Typography><Box sx={{ mt: .4, display: "flex", gap: .7, alignItems: "center", flexWrap: "wrap" }}><StatusChip value={answer.answer === "Y" ? "YES" : answer.answer === "N" ? "NO" : "N/A"} /><Typography sx={{ fontSize: 11.5, color: hrColors.muted }}>{answer.suggestion || "No suggestion"}</Typography></Box></Box>)}<Typography sx={{ mt: 1, color: hrColors.muted, fontSize: 11.5 }}>Submitted {formatDateTime(feedback.submittedAt)} by {feedback.submittedBy}</Typography></Box> : <EmptyState title="Feedback not submitted" description="The joinee will submit this from the onboarding portal." />}</Paper>; }

function CompletionView({ completion, canOperate, busy, onComplete }) { if (!completion) return <EmptyState title="Completion state unavailable" />; const checks = [["Required identity documents",completion.requiredDocumentsComplete],["Joining Report acknowledged",completion.joiningReportAcknowledged],["Current policy acknowledged",completion.policyAcknowledged],["Orientation completed & acknowledged",completion.orientationCompleted],["Induction feedback submitted",completion.inductionFeedbackSubmitted],["Current NDA accepted",completion.ndaAccepted],["NDA verified by HR",completion.ndaVerified],["Employment declaration accepted",completion.declarationAccepted]]; return <Box sx={{ display: "grid", gap: 1.5 }}><Paper variant="outlined" sx={sectionCardSx}><CompletionBar completion={completion} /><Box sx={{ mt: 1.5, display: "grid", gap: .7 }}>{checks.map(([label,done]) => <Box key={label} sx={{ display: "flex", alignItems: "center", gap: .8, p: .9, borderRadius: 1.2, background: done ? "var(--hr-success-soft)" : "var(--hr-warning-soft)", border: `1px solid ${done ? "var(--hr-success-border)" : "var(--hr-warning-border)"}` }}><CheckCircleOutlineOutlinedIcon sx={{ color: done ? hrColors.green : hrColors.amber, fontSize: 18 }} /><Typography sx={{ fontSize: 12.5, fontWeight: 800 }}>{label}</Typography></Box>)}</Box>{completion.pending?.length ? <Alert severity="warning" sx={{ mt: 1.4, borderRadius: 1.5 }}>{completion.pending.join(" • ")}</Alert> : null}{canOperate ? <Button variant="contained" disabled={busy || !completion.complete || completion.status === "ONBOARDING_COMPLETE"} onClick={onComplete} sx={{ ...primaryButtonSx, mt: 1.4 }}>{completion.status === "ONBOARDING_COMPLETE" ? "Onboarding complete" : "Finalize onboarding"}</Button> : null}</Paper></Box>; }

function EmployeesView() { const [loading,setLoading] = useState(true); const [error,setError] = useState(""); const [rows,setRows] = useState([]); const [total,setTotal] = useState(0); const [search,setSearch] = useState(""); const [status,setStatus] = useState(""); const [selectedId,setSelectedId] = useState(null); const load = useCallback(async () => { setLoading(true); setError(""); try { const response = await hrflowApi.listEmployees({ q: search, status, page:0, size:50, sort:"createdAt,desc" }); setRows(pageContent(response)); setTotal(totalElements(response)); } catch(e) { setError(apiMessage(e,"Employees could not be loaded.")); } finally { setLoading(false); } },[search,status]); useEffect(() => { const t=setTimeout(load,250); return () => clearTimeout(t); },[load]); return <><PageTitle eyebrow="EMPLOYEE MASTER" title="Employees" subtitle="Authoritative employee records created only through controlled joining confirmation. FlowSuite user linkage remains optional and separate." actions={<Button startIcon={<RefreshOutlinedIcon />} onClick={load} sx={secondaryButtonSx}>Refresh</Button>} /><ErrorAlert error={error} onRetry={load} /><Paper sx={{ ...panelSx,p:1.4,mb:1.5 }}><Box sx={{ display:"grid",gridTemplateColumns:{xs:"1fr",md:"1fr 220px auto"},gap:1 }}><TextField size="small" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search employee…" InputProps={{startAdornment:<InputAdornment position="start"><SearchOutlinedIcon fontSize="small" /></InputAdornment>}} sx={fieldSx}/><TextField select size="small" label="Status" value={status} onChange={(e)=>setStatus(e.target.value)} sx={fieldSx}><MenuItem value="">All statuses</MenuItem>{HR_EMPLOYEE_STATUSES.map((v)=><MenuItem key={v} value={v}>{humanize(v)}</MenuItem>)}</TextField><Chip label={`${total} employee${total===1?"":"s"}`} sx={{alignSelf:"center",borderRadius:1.2,fontWeight:850}}/></Box></Paper><Paper sx={{...panelSx,overflow:"hidden"}}>{loading?<LoadingBlock/>:rows.length?<Box sx={{overflowX:"auto"}}><Box sx={{minWidth:850}}><TableHead columns={["Employee","Status","Department","Designation","Location","Joined",""]}/>{rows.map((r)=><Box key={r.id} sx={tableRowSx}><Cell><Typography sx={mainCellSx}>{r.fullName}</Typography><Typography sx={subCellSx}>{r.employeeCode} • {r.mobileNo||"—"}</Typography></Cell><Cell><StatusChip value={r.status}/></Cell><Cell>{r.department||"—"}</Cell><Cell>{r.designation||"—"}</Cell><Cell>{r.location||"—"}</Cell><Cell>{formatDate(r.dateOfJoining)}</Cell><Cell><Button size="small" onClick={()=>setSelectedId(r.id)} sx={secondaryButtonSx}>Open</Button></Cell></Box>)}</Box></Box>:<EmptyState title="No employees found"/>}</Paper><EmployeeDrawer id={selectedId} open={Boolean(selectedId)} onClose={()=>setSelectedId(null)}/></>; }

function EmployeeDrawer({ id, open, onClose }) { const [loading,setLoading]=useState(false); const [error,setError]=useState(""); const [employee,setEmployee]=useState(null); useEffect(()=>{ if(!open||!id)return; setLoading(true); setError(""); hrflowApi.getEmployee(id).then(r=>setEmployee(r.data)).catch(e=>setError(apiMessage(e))).finally(()=>setLoading(false)); },[id,open]); return <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{sx:{width:{xs:"100%",sm:620},maxWidth:"100%"}}}><Box sx={{p:1.7,borderBottom:`1px solid ${hrColors.line}`,display:"flex",justifyContent:"space-between"}}><Box><Typography sx={{fontSize:19,fontWeight:950}}>{employee?.fullName||"Employee"}</Typography><Typography sx={{fontSize:12,color:hrColors.muted}}>{employee?.employeeCode}</Typography></Box><IconButton onClick={onClose}><CloseOutlinedIcon/></IconButton></Box><Box sx={{p:2}}>{loading?<LoadingBlock/>:<><ErrorAlert error={error}/>{employee?<Paper variant="outlined" sx={sectionCardSx}><SectionTitle title="Employee profile"/><Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",md:"1fr 1fr"},gap:1 }}>{[["Status",humanize(employee.status)],["Department",employee.department],["Designation",employee.designation],["Location",employee.location],["Reporting manager",employee.reportingManager],["Appointed by",employee.appointedBy],["Date of joining",formatDate(employee.dateOfJoining)],["DOB",formatDate(employee.dateOfBirth)],["Mobile",employee.mobileNo],["Email",employee.email],["Present address",employee.presentAddress],["Permanent address",employee.permanentAddress],["FlowSuite user",employee.flowSuiteUserId||"Not linked"]].map(([l,v])=><Info key={l} label={l} value={v}/>)}</Box></Paper>:null}</>}</Box></Drawer>; }

function AccessView() { const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [rows,setRows]=useState([]); const [principal,setPrincipal]=useState(""); const [role,setRole]=useState("HR_EXECUTIVE"); const load=useCallback(async()=>{setLoading(true);setError("");try{const r=await hrflowApi.listAccessGrants();setRows(r.data||[]);}catch(e){setError(apiMessage(e));}finally{setLoading(false);}},[]); useEffect(()=>{load();},[load]); const grant=async()=>{try{await hrflowApi.grantAccess({principalName:principal.trim(),role});setPrincipal("");await load();}catch(e){setError(apiMessage(e));}}; const revoke=async(row)=>{try{await hrflowApi.revokeAccess(row.id);await load();}catch(e){setError(apiMessage(e));}}; return <><PageTitle eyebrow="GLOBAL ADMIN" title="HRFlow access grants" subtitle="HRFlow roles are intentionally separate from the global FlowSuite role enum. Global ADMIN can grant or revoke HR-specific permissions here." actions={<Button startIcon={<RefreshOutlinedIcon/>} onClick={load} sx={secondaryButtonSx}>Refresh</Button>}/><ErrorAlert error={error} onRetry={load}/><Paper sx={{...panelSx,p:1.5,mb:1.5}}><Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",md:"1fr 230px auto"},gap:1}}><TextField size="small" label="Username / principal name" value={principal} onChange={(e)=>setPrincipal(e.target.value)} sx={fieldSx}/><TextField select size="small" label="HRFlow role" value={role} onChange={(e)=>setRole(e.target.value)} sx={fieldSx}>{HR_ACCESS_ROLES.map((r)=><MenuItem key={r} value={r}>{humanize(r)}</MenuItem>)}</TextField><Button variant="contained" disabled={!principal.trim()} onClick={grant} sx={primaryButtonSx}>Grant access</Button></Box></Paper><Paper sx={{...panelSx,overflow:"hidden"}}>{loading?<LoadingBlock/>:rows.length?<Box>{rows.map((row)=><Box key={row.id} sx={{display:"grid",gridTemplateColumns:{xs:"1fr",md:"1.2fr .8fr 120px auto"},gap:1,p:1.2,borderBottom:`1px solid ${hrColors.line}`,alignItems:"center"}}><Box><Typography sx={mainCellSx}>{row.principalName}</Typography><Typography sx={subCellSx}>Updated {formatDateTime(row.updatedAt)}</Typography></Box><StatusChip value={row.role}/><StatusChip value={row.active?"ACTIVE":"REVOKED"}/><Button size="small" color="error" disabled={!row.active} onClick={()=>revoke(row)} sx={{...secondaryButtonSx,color:hrColors.red}}>Revoke</Button></Box>)}</Box>:<EmptyState title="No HR access grants"/>}</Paper></>; }

function CreateCandidateDialog({ open, form, setForm, onClose, onCreate }) { const set=(key)=>(e)=>setForm((c)=>({...c,[key]:e.target.value})); return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{sx:{borderRadius:2.1}}}><DialogTitle sx={{fontWeight:950}}>Add candidate</DialogTitle><DialogContent dividers><Box sx={formGridSx}><TextField select size="small" label="Application type" value={form.applicationType} onChange={set("applicationType")} sx={fieldSx}><MenuItem value="STANDARD">Standard</MenuItem><MenuItem value="MANAGERIAL_ADMINISTRATIVE">Managerial / Administrative</MenuItem></TextField><TextField size="small" label="Full name" value={form.fullName} onChange={set("fullName")} sx={fieldSx}/><TextField size="small" label="Mobile" value={form.mobileNo} onChange={set("mobileNo")} sx={fieldSx}/><TextField size="small" type="email" label="Email" value={form.email} onChange={set("email")} sx={fieldSx}/><TextField size="small" label="Post applied for" value={form.postAppliedFor} onChange={set("postAppliedFor")} sx={fieldSx}/><TextField size="small" label="Department" value={form.department} onChange={set("department")} sx={fieldSx}/><TextField size="small" label="Designation" value={form.designation} onChange={set("designation")} sx={fieldSx}/><TextField size="small" label="HR owner" value={form.hrOwner} onChange={set("hrOwner")} sx={fieldSx}/></Box></DialogContent><DialogActions sx={{p:1.5}}><Button onClick={onClose} sx={secondaryButtonSx}>Cancel</Button><Button variant="contained" disabled={!form.applicationType} onClick={onCreate} sx={primaryButtonSx}>Create candidate</Button></DialogActions></Dialog>; }

function SimpleCandidateRows({ rows }) { return <Box sx={{display:"grid",gap:.7}}>{rows.map((row)=><Box key={row.id} sx={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:1,p:1,borderRadius:1.3,background:"var(--hr-surface)"}}><Box><Typography sx={mainCellSx}>{row.fullName||"Unnamed"}</Typography><Typography sx={subCellSx}>{row.candidateNumber} • {row.postAppliedFor||"No post"}</Typography></Box><StatusChip value={row.stage}/></Box>)}</Box>; }
function TableHead({ columns }) { return <Box sx={{...tableRowSx,background:"var(--hr-surface)",fontSize:11,fontWeight:950,color:"var(--hr-text-secondary)",textTransform:"uppercase",letterSpacing:.55}}>{columns.map((c,i)=><Cell key={`${c}-${i}`}>{c}</Cell>)}</Box>; }
function Cell({ children }) { return <Box sx={{minWidth:0,fontSize:12.5,color:hrColors.ink}}>{children}</Box>; }
function SectionTitle({ title, subtitle }) { return <Box sx={{mb:1.25}}><Typography sx={{fontSize:15.5,fontWeight:950,color:hrColors.ink}}>{title}</Typography>{subtitle?<Typography sx={{mt:.3,fontSize:11.8,color:hrColors.muted,lineHeight:1.55}}>{subtitle}</Typography>:null}</Box>; }
function Info({ label, value }) { return <Box sx={{p:.9,borderRadius:1.2,background:"var(--hr-surface)",border:`1px solid ${hrColors.line}`}}><Typography sx={{fontSize:10.5,fontWeight:800,color:hrColors.muted}}>{label}</Typography><Typography sx={{mt:.2,fontSize:12.2,fontWeight:800,color:hrColors.ink,whiteSpace:"pre-wrap"}}>{value||"—"}</Typography></Box>; }
function ArraySummary({ title, rows, render }) { return <Paper variant="outlined" sx={sectionCardSx}><SectionTitle title={title}/>{rows?.length?<Box sx={{display:"grid",gap:.6}}>{rows.map((r,i)=><Box key={i} sx={{p:.9,borderRadius:1.1,background:"var(--hr-surface)",fontSize:12.3}}>{render(r)}</Box>)}</Box>:<Typography sx={subCellSx}>No entries.</Typography>}</Paper>; }


const hrShellSx = {
	minHeight: "100vh",
	background: "var(--hr-page-bg)",
	color: "var(--hr-text)",
};

const hrSidebarSx = (collapsed) => ({
	position: "fixed",
	inset: "0 auto 0 0",
	width: collapsed ? 64 : 208,
	zIndex: 1200,
	display: "flex",
	flexDirection: "column",
	background: "var(--hr-sidebar-bg)",
	borderRight: "1px solid var(--hr-border)",
	transition: "width .2s ease",
});

const hrMainSx = (collapsed) => ({
	ml: collapsed ? "64px" : "208px",
	minHeight: "100vh",
	transition: "margin-left .2s ease",
});

const hrLogoSx = {
	minHeight: 58,
	px: 1.15,
	py: .9,
	display: "flex",
	gap: .8,
	alignItems: "center",
};

const hrMarkSx = {
	width: 32,
	height: 32,
	borderRadius: 2,
	display: "grid",
	placeItems: "center",
	background: "var(--hr-primary)",
	color: "#fff",
	fontWeight: 950,
};

const hrLogoTitleSx = {
	color: "var(--hr-text)",
	fontWeight: 950,
	fontSize: 14.5,
	lineHeight: 1.1,
};

const hrMutedSx = {
	color: "var(--hr-text-muted)",
	fontSize: 9.5,
	fontWeight: 700,
};

const hrSidebarIdentitySx = (collapsed) => ({
	px: collapsed ? .7 : 1,
	py: .85,
	display: "flex",
	alignItems: "center",
	justifyContent: collapsed ? "center" : "flex-start",
	gap: .75,
});

const hrAvatarSx = {
	width: 30,
	height: 30,
	flex: "0 0 auto",
	borderRadius: "50%",
	display: "grid",
	placeItems: "center",
	color: "var(--hr-primary-text)",
	background: "var(--hr-primary-soft)",
	border: "1px solid var(--hr-primary-border)",
	fontSize: 11,
	fontWeight: 950,
};

const hrSectionTitleSx = {
	px: 1.15,
	pt: .55,
	pb: .2,
	color: "var(--hr-text-muted)",
	fontSize: 8.8,
	fontWeight: 950,
	letterSpacing: ".08em",
	textTransform: "uppercase",
};

const hrSidebarIconSx = {
	display: "grid",
	placeItems: "center",
	flex: "0 0 auto",
	"& svg": { fontSize: 19 },
};

const hrSidebarLinkSx = (active, collapsed) => ({
	width: "calc(100% - 14px)",
	minWidth: 0,
	minHeight: 34,
	mx: .875,
	my: .25,
	px: collapsed ? 1.45 : 1.1,
	py: .8,
	borderRadius: 1,
	justifyContent: collapsed ? "center" : "flex-start",
	gap: collapsed ? 0 : 1.1,
	textTransform: "none",
	fontSize: 10.8,
	fontWeight: active ? 900 : 760,
	color: active ? "var(--hr-primary-text)" : "var(--hr-text-secondary)",
	background: active ? "var(--hr-primary-soft)" : "transparent",
	border: active ? "1px solid var(--hr-primary-border)" : "1px solid transparent",
	whiteSpace: "nowrap",
	overflow: "hidden",
	transition: "background .14s ease,color .14s ease,border-color .14s ease",
	"&:hover": {
		background: active ? "var(--hr-primary-soft)" : "var(--hr-hover)",
		borderColor: active ? "var(--hr-primary-border)" : "transparent",
	},
});

const hrHeaderSx = {
	minHeight: 58,
	px: { xs: 1.25, md: 1.7 },
	py: .65,
	position: "sticky",
	top: 0,
	zIndex: 1100,
	display: "flex",
	justifyContent: "space-between",
	gap: 1.2,
	alignItems: "center",
	background: "var(--hr-header-bg)",
	backdropFilter: "blur(14px)",
	borderBottom: "1px solid var(--hr-border)",
};

const hrContentSx = {
	p: { xs: 1.05, md: 1.45 },
	maxWidth: 1640,
	mx: "auto",
	minWidth: 0,
};

const hrRoleChipSx = {
	display: { xs: "none", md: "inline-flex" },
	borderRadius: 1.2,
	fontWeight: 850,
	fontSize: 10,
	color: "var(--hr-primary-text)",
	background: "var(--hr-primary-soft)",
	border: "1px solid var(--hr-primary-border)",
};

const dangerButtonSx = {
	...secondaryButtonSx,
	color: "var(--hr-danger-text)",
	borderColor: "var(--hr-danger-border)",
	background: "var(--hr-danger-soft)",
	"&:hover": {
		color: "var(--hr-danger-text)",
		borderColor: "var(--hr-danger-text)",
		background: "var(--hr-danger-soft)",
	},
};
const sectionCardSx={p:1.5,borderRadius:1.7,borderColor:hrColors.line,background:"var(--hr-card-bg)"};
const formGridSx={display:"grid",gridTemplateColumns:{xs:"1fr",md:"repeat(2,minmax(0,1fr))"},gap:1};
const tableRowSx={display:"grid",gridTemplateColumns:"minmax(190px,1.4fr) minmax(130px,1fr) minmax(130px,.9fr) minmax(120px,.8fr) minmax(120px,.8fr) minmax(120px,.8fr) 80px",gap:1,p:1.25,alignItems:"center",borderBottom:`1px solid ${hrColors.line}`};
const mainCellSx={fontSize:12.8,fontWeight:850,color:hrColors.ink,lineHeight:1.35};
const subCellSx={fontSize:10.8,color:hrColors.muted,mt:.2,lineHeight:1.4};
