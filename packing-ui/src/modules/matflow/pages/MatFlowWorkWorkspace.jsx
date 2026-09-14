import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Drawer,
    LinearProgress,
    MenuItem,
    Tab,
    Tabs,
    TextField,
    Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import AssignmentIndOutlinedIcon from "@mui/icons-material/AssignmentIndOutlined";
import AttachFileOutlinedIcon from "@mui/icons-material/AttachFileOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import DesignServicesOutlinedIcon from "@mui/icons-material/DesignServicesOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import { useSearchParams } from "react-router-dom";

import { extractMatFlowPage, matflowApi, readMatFlowError } from "../api/matflowApi";
import { matflowWorkApi } from "../api/matflowWorkApi";
import {
    ErrorBox,
    LoadingBlock,
    MATFLOW_ROLES,
    PageHero,
    SummaryCard,
    clean,
    dialogActionsSx,
    dialogContentSx,
    dialogPaperSx,
    dialogTitleSx,
    fieldSx,
    pageSx,
    panelSx,
    primaryBtnSx,
    readable,
    secondaryBtnSx,
    useMatFlow,
} from "../matflowUi";

const POLL_MS = 10000;
const DESIGN_STATUSES = ["", "DRAFT", "SUBMITTED_TO_ENGINEERING", "RETURNED_FOR_CLARIFICATION", "ACCEPTED", "CANCELLED"];
const TASK_STATUSES = [
    "",
    "AWAITING_ASSIGNMENT",
    "ASSIGNED",
    "IN_PROGRESS",
    "AWAITING_CLARIFICATION",
    "SUBMITTED_TO_PRODUCTION",
    "RETURNED",
    "COMPLETED",
    "SUPERSEDED",
    "CANCELLED",
];

const TASK_LANES = [
    ["AWAITING_ASSIGNMENT", "Awaiting Assignment"],
    ["ASSIGNED", "Assigned"],
    ["IN_PROGRESS", "In Progress"],
    ["AWAITING_CLARIFICATION", "Awaiting Clarification"],
    ["SUBMITTED_TO_PRODUCTION", "Submitted to Production"],
    ["RETURNED", "Returned"],
    ["COMPLETED", "Completed"],
    ["SUPERSEDED", "Superseded Revision"],
    ["CANCELLED", "Cancelled"],
];

const EMPTY_DESIGN = {
    projectId: "",
    productId: "",
    designer: "",
    designDrawingRevision: "",
    engineeringHead: "",
    productionRecipient: "",
    engineeringChecklistTemplateKey: "PYTHA_ENGINEERING_V1",
    reference: "",
    companyCode: "ALSORG",
    remarks: "",
};

const checklistTemplateLabel = (value) => {
    const key = String(value || "").trim().toUpperCase();
    if (key === "PYTHA_ENGINEERING_V1") return "PYTHA Engg. Detail";
    if (key === "GENERAL_ENGINEERING_V1") return "General Engineering Handover Checklist";
    if (key === "WARDROBE_ENGINEERING_V1") return "Legacy Wardrobe Engineering Checklist";
    return readable(value || "Engineering Checklist");
};

const checklistSectionLabel = (value) => {
    const text = clean(value);
    if (!text) return "CHECKLIST";
    if (text === "PYTHA ENGINEERING DETAILS") return "PYTHA Engineering Details";
    if (text === "DRAWINGS CHECK LIST") return "Drawings Check List";
    if (text === "WARDROBE DESIGN CHECKLIST") return "Wardrobe Designing Checklist";
    return readable(text);
};

const toDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString([], { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const openBlob = (blob) => {
    if (!(blob instanceof Blob) || !blob.size) throw new Error("The drawing could not be loaded.");
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
};

const progressTone = (complete) => complete ? "var(--mf-success-text)" : "var(--mf-warning-text)";

const statusChipSx = (status) => {
    const value = String(status || "").toUpperCase();
    const success = ["ACCEPTED", "COMPLETED"].includes(value);
    const warning = ["RETURNED", "RETURNED_FOR_CLARIFICATION", "AWAITING_CLARIFICATION"].includes(value);
    const info = ["SUBMITTED_TO_ENGINEERING", "SUBMITTED_TO_PRODUCTION", "IN_PROGRESS"].includes(value);
    return {
        height: 24,
        borderRadius: 1.4,
        fontWeight: 850,
        fontSize: 10.5,
        border: "1px solid",
        borderColor: success ? "var(--mf-success-border)" : warning ? "var(--mf-warning-border)" : info ? "var(--mf-primary-border)" : "var(--mf-border)",
        background: success ? "var(--mf-success-soft)" : warning ? "var(--mf-warning-soft)" : info ? "var(--mf-primary-soft)" : "var(--mf-surface)",
        color: success ? "var(--mf-success-text)" : warning ? "var(--mf-warning-text)" : info ? "var(--mf-primary-text)" : "var(--mf-text-secondary)",
    };
};

export function MatFlowWorkWorkspacePage() {
    const [params, setParams] = useSearchParams();
    const { hasRole, selectedPlantParam } = useMatFlow();
    const canDesign = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.ENGINEERING);
    const canHead = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER);
    const canEngineer = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.ENGINEERING);
    const canHandover = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.ENGINEERING);

    const [tab, setTab] = useState(params.get("submissionId") ? "DESIGN" : "TASKS");
    const [designRows, setDesignRows] = useState([]);
    const [taskRows, setTaskRows] = useState([]);
    const [people, setPeople] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [designStatus, setDesignStatus] = useState("");
    const [taskStatus, setTaskStatus] = useState("");
    const [taskScope, setTaskScope] = useState("ALL");
    const [createOpen, setCreateOpen] = useState(false);
    const [designForm, setDesignForm] = useState(EMPTY_DESIGN);
    const [detail, setDetail] = useState(null);
    const [detailType, setDetailType] = useState("");
    const [designFile, setDesignFile] = useState(null);
    const [productionFile, setProductionFile] = useState(null);
    const [productionRevision, setProductionRevision] = useState("");
    const [assignForm, setAssignForm] = useState({ assignedTo: "", dueDate: "", priority: "NORMAL", note: "" });
    const [returnNote, setReturnNote] = useState("");
    const [taskNote, setTaskNote] = useState("");
    const [handover, setHandover] = useState({ bomId: "", handoverRemarks: "" });
    const [boms, setBoms] = useState([]);

    const load = useCallback(async ({ quiet = false } = {}) => {
        if (!quiet) setLoading(true);
        if (!quiet) setError("");
        try {
            const [designResponse, taskResponse, peopleResponse, templateResponse] = await Promise.all([
                matflowWorkApi.listDesignSubmissions({
                    plantCode: selectedPlantParam || undefined,
                    status: designStatus || undefined,
                    search: clean(search) || undefined,
                }),
                matflowWorkApi.listTasks({
                    plantCode: selectedPlantParam || undefined,
                    status: taskStatus || undefined,
                    scope: taskScope,
                    search: clean(search) || undefined,
                }),
                matflowWorkApi.people({ plantCode: selectedPlantParam || undefined }),
                matflowWorkApi.templates(),
            ]);
            setDesignRows(Array.isArray(designResponse?.data) ? designResponse.data : []);
            setTaskRows(Array.isArray(taskResponse?.data) ? taskResponse.data : []);
            setPeople(Array.isArray(peopleResponse?.data) ? peopleResponse.data : []);
            setTemplates(Array.isArray(templateResponse?.data) ? templateResponse.data : []);
        } catch (requestError) {
            if (!quiet) setError(readMatFlowError(requestError, "Unable to load Design & Engineering workspace."));
        } finally {
            if (!quiet) setLoading(false);
        }
    }, [selectedPlantParam, designStatus, taskStatus, taskScope, search]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        const timer = window.setInterval(() => load({ quiet: true }), POLL_MS);
        const refresh = () => { if (document.visibilityState === "visible") load({ quiet: true }); };
        window.addEventListener("focus", refresh);
        document.addEventListener("visibilitychange", refresh);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener("focus", refresh);
            document.removeEventListener("visibilitychange", refresh);
        };
    }, [load]);

    useEffect(() => {
        const submissionId = params.get("submissionId");
        const taskId = params.get("taskId");
        if (submissionId) openDesign(submissionId);
        else if (taskId) openTask(taskId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadCreateReferences = async () => {
        try {
            const response = await matflowApi.listProjects({ active: true, plantCode: selectedPlantParam || undefined });
            setProjects(Array.isArray(response?.data) ? response.data : []);
        } catch (requestError) {
            setProjects([]);
            setError(readMatFlowError(requestError, "Unable to load active Projects & Products."));
        }
    };

    const openCreate = async () => {
        setDesignForm({ ...EMPTY_DESIGN, designer: "" });
        setCreateOpen(true);
        await loadCreateReferences();
    };

    const selectedProject = projects.find((row) => String(row.id) === String(designForm.projectId)) || null;
    const selectedProducts = Array.isArray(selectedProject?.products) ? selectedProject.products.filter((row) => row?.active !== false) : [];
    const selectedProduct = selectedProducts.find((row) => String(row.id) === String(designForm.productId)) || null;

    const designPeople = people.filter((row) => row.designUser);
    const heads = people.filter((row) => row.engineeringHead);
    const engineers = people.filter((row) => row.engineer);
    const productionPeople = people.filter((row) => row.productionRecipient);
    const engineeringTemplates = templates.filter((row) => String(row.area || "").startsWith("ENGINEERING"));

    const createDesign = async () => {
        if (![designForm.projectId, designForm.productId].every((value) => clean(value))) {
            setError("Project and Product are required to save a Design submission draft.");
            return;
        }
        setWorking(true);
        setError("");
        try {
            const response = await matflowWorkApi.createDesignSubmission(designForm);
            setCreateOpen(false);
            const created = response?.data?.submission;
            if (created?.id) await openDesign(created.id);
            await load({ quiet: true });
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to create Design submission draft."));
        } finally {
            setWorking(false);
        }
    };

    async function openDesign(id) {
        if (!id) return;
        setWorking(true);
        setError("");
        try {
            const response = await matflowWorkApi.getDesignSubmission(id);
            setDetail(response?.data || null);
            setDetailType("DESIGN");
            setTab("DESIGN");
            setParams({ submissionId: id }, { replace: true });
            const row = response?.data?.submission;
            setAssignForm({ assignedTo: "", dueDate: "", priority: "NORMAL", note: "" });
            setReturnNote(row?.returnReason || "");
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to open Design submission."));
        } finally {
            setWorking(false);
        }
    }

    async function openTask(id) {
        if (!id) return;
        setWorking(true);
        setError("");
        try {
            const [response, bomResponse] = await Promise.all([
                matflowWorkApi.getTask(id),
                matflowApi.listBoms({ latestOnly: false }),
            ]);
            const task = response?.data?.task;
            setDetail(response?.data || null);
            setDetailType("TASK");
            setTab("TASKS");
            setParams({ taskId: id }, { replace: true });
            const allBoms = extractMatFlowPage(bomResponse?.data).rows;
            setBoms(allBoms.filter((row) => String(row.projectDrawingId) === String(task?.productId)));
            setAssignForm({
                assignedTo: task?.assignedTo || "",
                dueDate: task?.dueDate || "",
                priority: task?.priority || "NORMAL",
                note: "",
            });
            setProductionRevision(task?.engineeringDrawingRevision || "");
            setHandover({ bomId: task?.linkedBom?.id || "", handoverRemarks: task?.handoverRemarks || "" });
            setTaskNote("");
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to open Engineering task."));
        } finally {
            setWorking(false);
        }
    }

    const closeDetail = () => {
        setDetail(null);
        setDetailType("");
        setDesignFile(null);
        setProductionFile(null);
        setParams({}, { replace: true });
    };

    const refreshDetail = async () => {
        if (detailType === "DESIGN") await openDesign(detail?.submission?.id);
        if (detailType === "TASK") await openTask(detail?.task?.id);
        await load({ quiet: true });
    };

    const updateChecklist = async (type, item, nextState, naReason = null) => {
        const row = type === "DESIGN" ? detail?.submission : detail?.task;
        if (!row?.id) return;
        setWorking(true);
        setError("");
        try {
            const body = { version: row.version, state: nextState, naReason, remarks: item.remarks || null };
            const response = type === "DESIGN"
                ? await matflowWorkApi.updateDesignChecklist(row.id, item.key, body)
                : await matflowWorkApi.updateTaskChecklist(row.id, item.key, body);
            setDetail(response?.data || detail);
            await load({ quiet: true });
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to update checklist item."));
        } finally {
            setWorking(false);
        }
    };

    const markNa = async (type, item) => {
        const reason = window.prompt("Reason this check is Not applicable:", item.naReason || "");
        if (reason === null) return;
        if (!clean(reason)) {
            setError("Not applicable reason is required.");
            return;
        }
        await updateChecklist(type, item, "NA", clean(reason));
    };

    const updateDesignSetup = async (setup) => {
        const row = detail?.submission;
        if (!row?.id) return;
        setWorking(true);
        setError("");
        try {
            const response = await matflowWorkApi.updateDesignSubmission(row.id, {
                version: row.version,
                designer: clean(setup?.designer) || row.designer || null,
                designDrawingRevision: clean(setup?.designDrawingRevision) || null,
                engineeringHead: clean(setup?.engineeringHead) || null,
                productionRecipient: clean(setup?.productionRecipient) || null,
                engineeringChecklistTemplateKey: clean(setup?.engineeringChecklistTemplateKey) || row.engineeringChecklistTemplateKey,
                reference: setup?.reference ?? row.reference ?? "",
                companyCode: setup?.companyCode ?? row.companyCode ?? "",
                remarks: setup?.remarks ?? row.remarks ?? "",
            });
            setDetail(response?.data || detail);
            await load({ quiet: true });
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to update Design submission setup."));
        } finally {
            setWorking(false);
        }
    };

    const uploadDesign = async () => {
        const row = detail?.submission;
        if (!row?.id || !designFile) return;
        setWorking(true);
        setError("");
        try {
            const response = await matflowWorkApi.uploadDesignDrawing(row.id, designFile, row.designDrawingRevision, row.version);
            setDetail(response?.data || detail);
            setDesignFile(null);
            await load({ quiet: true });
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to upload Design drawing."));
        } finally {
            setWorking(false);
        }
    };

    const viewDesignDrawing = async (id) => {
        try { openBlob((await matflowWorkApi.getDesignDrawing(id))?.data); }
        catch (requestError) { setError(readMatFlowError(requestError, requestError?.message || "Unable to open Design drawing.")); }
    };

    const submitDesign = async () => {
        const row = detail?.submission;
        if (!row?.id) return;
        setWorking(true); setError("");
        try {
            const response = await matflowWorkApi.submitDesignSubmission(row.id, row.version);
            setDetail(response?.data || detail);
            await load({ quiet: true });
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to submit Design package to Engineering."));
        } finally { setWorking(false); }
    };

    const reviewDesign = async (action) => {
        const row = detail?.submission;
        if (!row?.id) return;
        if (action === "RETURN" && !clean(returnNote)) {
            setError("Enter the clarification / return reason.");
            return;
        }
        setWorking(true); setError("");
        try {
            const response = await matflowWorkApi.reviewDesignSubmission(row.id, {
                version: row.version,
                action,
                assignedTo: action === "ACCEPT" ? clean(assignForm.assignedTo) || null : null,
                dueDate: action === "ACCEPT" ? clean(assignForm.dueDate) || null : null,
                priority: action === "ACCEPT" ? assignForm.priority : null,
                note: action === "RETURN" ? clean(returnNote) : clean(assignForm.note) || null,
            });
            setDetail(response?.data || detail);
            await load({ quiet: true });
            if (action === "ACCEPT" && response?.data?.submission?.taskId) {
                await openTask(response.data.submission.taskId);
            }
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to review Design submission."));
        } finally { setWorking(false); }
    };

    const assignTask = async () => {
        const task = detail?.task;
        if (!task?.id || !clean(assignForm.assignedTo)) return;
        setWorking(true); setError("");
        try {
            const response = await matflowWorkApi.assignTask(task.id, {
                version: task.version,
                assignedTo: clean(assignForm.assignedTo),
                dueDate: clean(assignForm.dueDate) || null,
                priority: assignForm.priority,
                note: clean(assignForm.note) || null,
            });
            setDetail(response?.data || detail);
            await load({ quiet: true });
        } catch (requestError) { setError(readMatFlowError(requestError, "Unable to assign Engineering task.")); }
        finally { setWorking(false); }
    };

    const setStatus = async (status) => {
        const task = detail?.task;
        if (!task?.id) return;
        setWorking(true); setError("");
        try {
            const response = await matflowWorkApi.setTaskStatus(task.id, { version: task.version, status, note: clean(taskNote) || null });
            setDetail(response?.data || detail);
            setTaskNote("");
            await load({ quiet: true });
        } catch (requestError) { setError(readMatFlowError(requestError, "Unable to update Engineering task status.")); }
        finally { setWorking(false); }
    };

    const uploadProduction = async () => {
        const task = detail?.task;
        if (!task?.id || !productionFile || !clean(productionRevision)) {
            setError("Select the Production drawing and enter its exact revision.");
            return;
        }
        setWorking(true); setError("");
        try {
            const response = await matflowWorkApi.uploadProductionDrawing(task.id, productionFile, clean(productionRevision), task.version);
            setDetail(response?.data || detail);
            setProductionFile(null);
            await load({ quiet: true });
        } catch (requestError) { setError(readMatFlowError(requestError, "Unable to upload Engineering Production drawing.")); }
        finally { setWorking(false); }
    };

    const viewProductionDrawing = async (id) => {
        try { openBlob((await matflowWorkApi.getProductionDrawing(id))?.data); }
        catch (requestError) { setError(readMatFlowError(requestError, requestError?.message || "Unable to open Production drawing.")); }
    };

    const submitProduction = async () => {
        const task = detail?.task;
        const bom = boms.find((row) => String(row.id) === String(handover.bomId));
        if (!task?.id || !bom?.id) {
            setError("Select the exact Draft / Returned BOM revision for handover.");
            return;
        }
        setWorking(true); setError("");
        try {
            const response = await matflowWorkApi.handover(task.id, {
                version: task.version,
                bomId: bom.id,
                bomRowVersion: bom.rowVersion,
                handoverRemarks: clean(handover.handoverRemarks) || null,
            });
            setDetail(response?.data || detail);
            await load({ quiet: true });
        } catch (requestError) { setError(readMatFlowError(requestError, "Unable to hand over Engineering package / BOM to Production.")); }
        finally { setWorking(false); }
    };

    const designCounts = useMemo(() => ({
        draft: designRows.filter((row) => row.status === "DRAFT" || row.status === "RETURNED_FOR_CLARIFICATION").length,
        waiting: designRows.filter((row) => row.status === "SUBMITTED_TO_ENGINEERING").length,
        accepted: designRows.filter((row) => row.status === "ACCEPTED").length,
        blocked: designRows.filter((row) => !row.checklistProgress?.complete || !row.designDrawing?.available).length,
    }), [designRows]);

    const taskCounts = useMemo(() => ({
        unassigned: taskRows.filter((row) => row.status === "AWAITING_ASSIGNMENT").length,
        active: taskRows.filter((row) => ["ASSIGNED", "IN_PROGRESS", "AWAITING_CLARIFICATION", "RETURNED"].includes(row.status)).length,
        production: taskRows.filter((row) => row.status === "SUBMITTED_TO_PRODUCTION").length,
        revision: taskRows.filter((row) => row.revisionReviewRequired).length,
    }), [taskRows]);

    if (loading) return <LoadingBlock />;

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="DESIGN → ENGINEERING → PRODUCTION"
                title="Design & Engineering Work Center"
                subtitle="Product creation stays approval-free. A Design revision becomes controlled only when Designing submits its drawing + checklist to Engineering; Engineering Head assigns the exact Product/revision, the engineer completes the technical checklist and BOM, then the same package enters MatFlow's existing Production BOM review."
                actions={
                    <>
                        <Button startIcon={<RefreshOutlinedIcon />} onClick={() => load()} sx={secondaryBtnSx}>Refresh</Button>
                        {canDesign && <Button startIcon={<AddIcon />} onClick={openCreate} sx={primaryBtnSx}>New Design Submission</Button>}
                    </>
                }
            />

            <Alert severity="info" sx={{ borderRadius: 2 }}>
                A new Design drawing revision never overwrites an old submitted revision. Open Engineering tasks are flagged for revision review, while historical Product/BOM/task evidence stays intact.
            </Alert>
            <ErrorBox>{error}</ErrorBox>

            <Card sx={{ ...panelSx, p: .5 }}>
                <Tabs value={tab} onChange={(_, value) => setTab(value)}>
                    <Tab value="DESIGN" icon={<DesignServicesOutlinedIcon />} iconPosition="start" label="Design Submissions" />
                    <Tab value="TASKS" icon={<FactCheckOutlinedIcon />} iconPosition="start" label="Engineering Tasks" />
                </Tabs>
            </Card>

            {tab === "DESIGN" ? (
                <>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", md: "repeat(4,1fr)" }, gap: 1 }}>
                        <SummaryCard label="Draft / Clarification" value={designCounts.draft} />
                        <SummaryCard label="Waiting Engineering" value={designCounts.waiting} />
                        <SummaryCard label="Accepted" value={designCounts.accepted} />
                        <SummaryCard label="Submission Gate Pending" value={designCounts.blocked} />
                    </Box>
                    <Card sx={{ ...panelSx, display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 250px" }, gap: 1 }}>
                        <TextField label="Search PD / Product / Drawing / Designer" value={search} onChange={(e) => setSearch(e.target.value)} sx={fieldSx} />
                        <TextField select label="Status" value={designStatus} onChange={(e) => setDesignStatus(e.target.value)} sx={fieldSx}>
                            {DESIGN_STATUSES.map((value) => <MenuItem key={value || "ALL"} value={value}>{value ? readable(value) : "All statuses"}</MenuItem>)}
                        </TextField>
                    </Card>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "repeat(2,minmax(0,1fr))" }, gap: 1 }}>
                        {designRows.map((row) => <DesignCard key={row.id} row={row} onOpen={() => openDesign(row.id)} />)}
                        {!designRows.length && <Card sx={panelSx}><Typography sx={{ color: "var(--mf-text-secondary)" }}>No Design submissions found.</Typography></Card>}
                    </Box>
                </>
            ) : (
                <>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", md: "repeat(4,1fr)" }, gap: 1 }}>
                        <SummaryCard label="Awaiting Assignment" value={taskCounts.unassigned} />
                        <SummaryCard label="Engineering Active" value={taskCounts.active} />
                        <SummaryCard label="With Production" value={taskCounts.production} />
                        <SummaryCard label="New Revision Review" value={taskCounts.revision} />
                    </Box>
                    <Card sx={{ ...panelSx, display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 230px 210px" }, gap: 1 }}>
                        <TextField label="Search task / PD / Product / Drawing / person" value={search} onChange={(e) => setSearch(e.target.value)} sx={fieldSx} />
                        <TextField select label="Status" value={taskStatus} onChange={(e) => setTaskStatus(e.target.value)} sx={fieldSx}>
                            {TASK_STATUSES.map((value) => <MenuItem key={value || "ALL"} value={value}>{value ? readable(value) : "All statuses"}</MenuItem>)}
                        </TextField>
                        <TextField select label="Scope" value={taskScope} onChange={(e) => setTaskScope(e.target.value)} sx={fieldSx}>
                            <MenuItem value="ALL">All visible</MenuItem>
                            <MenuItem value="MY">My assigned work</MenuItem>
                            <MenuItem value="HEAD">My Head queue</MenuItem>
                            <MenuItem value="PRODUCTION">My Production handovers</MenuItem>
                            <MenuItem value="UNASSIGNED">Unassigned</MenuItem>
                        </TextField>
                    </Card>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3,minmax(255px,1fr))", xl: "repeat(7,minmax(255px,1fr))" }, gap: 1, alignItems: "start", overflowX: "auto", pb: 1 }}>
                        {TASK_LANES.map(([key, label]) => (
                            <TaskLane key={key} label={label} rows={taskRows.filter((row) => row.status === key)} onOpen={openTask} />
                        ))}
                    </Box>
                </>
            )}

            <Dialog open={createOpen} onClose={() => !working && setCreateOpen(false)} fullWidth maxWidth="md" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>Create Design Submission Draft</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Typography sx={{ color: "var(--mf-text-secondary)", fontSize: 12.5, mb: 1.5 }}>
                        Saving this draft does not approve the Product. The mandatory Wardrobe Designing checklist + drawing gate applies only when you press Submit to Engineering; the later Engineering task uses the separate PYTHA Engg. Detail checklist.
                    </Typography>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1 }}>
                        <TextField select label="PD / Project *" value={designForm.projectId} onChange={(e) => setDesignForm((c) => ({ ...c, projectId: e.target.value, productId: "" }))} sx={fieldSx}>
                            {projects.map((row) => <MenuItem key={row.id} value={row.id}>{row.projectCode} · {row.projectName}</MenuItem>)}
                        </TextField>
                        <TextField select label="Product / Drawing *" value={designForm.productId} onChange={(e) => {
                            const nextId = e.target.value;
                            const product = selectedProducts.find((row) => String(row.id) === String(nextId));
                            setDesignForm((c) => ({
                                ...c,
                                productId: nextId,
                                designDrawingRevision: clean(c.designDrawingRevision) || product?.drawingRevision || "",
                            }));
                        }} sx={fieldSx}>
                            {selectedProducts.map((row) => <MenuItem key={row.id} value={row.id}>{row.productName} · {row.drawingNo} · Rev {row.drawingRevision || "0"}</MenuItem>)}
                        </TextField>
                        <TextField select label="Designer / Designing owner (draft can be incomplete)" value={designForm.designer} onChange={(e) => setDesignForm((c) => ({ ...c, designer: e.target.value }))} sx={fieldSx}>
                            {designPeople.map((row) => <MenuItem key={row.username} value={row.username}>{row.displayName}</MenuItem>)}
                        </TextField>
                        <TextField label="Design drawing revision (required at submit)" value={designForm.designDrawingRevision} onChange={(e) => setDesignForm((c) => ({ ...c, designDrawingRevision: e.target.value }))} sx={fieldSx} />
                        <TextField select label="Engineering Head (required at submit)" value={designForm.engineeringHead} onChange={(e) => setDesignForm((c) => ({ ...c, engineeringHead: e.target.value }))} sx={fieldSx}>
                            {heads.map((row) => <MenuItem key={row.username} value={row.username}>{row.displayName}</MenuItem>)}
                        </TextField>
                        <TextField select label="Production recipient (required at submit)" value={designForm.productionRecipient} onChange={(e) => setDesignForm((c) => ({ ...c, productionRecipient: e.target.value }))} sx={fieldSx}>
                            {productionPeople.map((row) => <MenuItem key={row.username} value={row.username}>{row.displayName}</MenuItem>)}
                        </TextField>
                        <TextField select label="Engineering task checklist" value={designForm.engineeringChecklistTemplateKey} onChange={(e) => setDesignForm((c) => ({ ...c, engineeringChecklistTemplateKey: e.target.value }))} sx={fieldSx}>
                            {engineeringTemplates.map((row) => <MenuItem key={row.key} value={row.key}>{row.name}</MenuItem>)}
                        </TextField>
                        <TextField select label="Callisto / Alsorg" value={designForm.companyCode} onChange={(e) => setDesignForm((c) => ({ ...c, companyCode: e.target.value }))} sx={fieldSx}>
                            <MenuItem value="ALSORG">Alsorg</MenuItem>
                            <MenuItem value="CALLISTO">Callisto</MenuItem>
                        </TextField>
                        <TextField label="Reference" value={designForm.reference} onChange={(e) => setDesignForm((c) => ({ ...c, reference: e.target.value }))} sx={fieldSx} />
                    </Box>
                    {selectedProduct && <Alert severity="info" sx={{ mt: 1.3 }}>Product master: {selectedProduct.productName} · {selectedProduct.drawingNo} · {selectedProduct.dimensions || "Dimensions not entered"}. The submission revision is archived separately from the live Product master revision.</Alert>}
                    <TextField multiline minRows={3} label="Design remarks / unresolved queries" value={designForm.remarks} onChange={(e) => setDesignForm((c) => ({ ...c, remarks: e.target.value }))} sx={{ ...fieldSx, mt: 1 }} fullWidth />
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setCreateOpen(false)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
                    <Button onClick={createDesign} disabled={working} sx={primaryBtnSx}>Save Draft</Button>
                </DialogActions>
            </Dialog>

            <Drawer anchor="right" open={Boolean(detail)} onClose={closeDetail} PaperProps={{ sx: { width: { xs: "100%", sm: 610 }, p: 0, background: "var(--mf-page-bg)" } }}>
                {detailType === "DESIGN" && detail?.submission && (
                    <DesignDetail
                        detail={detail}
                        canDesign={canDesign}
                        canHead={canHead}
                        designPeople={designPeople}
                        heads={heads}
                        engineers={engineers}
                        productionPeople={productionPeople}
                        engineeringTemplates={engineeringTemplates}
                        working={working}
                        designFile={designFile}
                        setDesignFile={setDesignFile}
                        assignForm={assignForm}
                        setAssignForm={setAssignForm}
                        returnNote={returnNote}
                        setReturnNote={setReturnNote}
                        onClose={closeDetail}
                        onUpdateSetup={updateDesignSetup}
                        onChecklist={updateChecklist}
                        onNa={markNa}
                        onUpload={uploadDesign}
                        onView={viewDesignDrawing}
                        onSubmit={submitDesign}
                        onReview={reviewDesign}
                        onRefresh={refreshDetail}
                    />
                )}
                {detailType === "TASK" && detail?.task && (
                    <TaskDetail
                        detail={detail}
                        canHead={canHead}
                        canEngineer={canEngineer}
                        canHandover={canHandover}
                        engineers={engineers}
                        productionPeople={productionPeople}
                        boms={boms}
                        working={working}
                        assignForm={assignForm}
                        setAssignForm={setAssignForm}
                        productionFile={productionFile}
                        setProductionFile={setProductionFile}
                        productionRevision={productionRevision}
                        setProductionRevision={setProductionRevision}
                        taskNote={taskNote}
                        setTaskNote={setTaskNote}
                        handover={handover}
                        setHandover={setHandover}
                        onClose={closeDetail}
                        onAssign={assignTask}
                        onChecklist={updateChecklist}
                        onNa={markNa}
                        onStatus={setStatus}
                        onUpload={uploadProduction}
                        onViewDesign={viewDesignDrawing}
                        onViewProduction={viewProductionDrawing}
                        onHandover={submitProduction}
                        onRefresh={refreshDetail}
                    />
                )}
            </Drawer>
        </Box>
    );
}

function DesignCard({ row, onOpen }) {
    const progress = row.checklistProgress || {};
    return (
        <Card sx={{ ...panelSx, m: 0 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "flex-start" }}>
                <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ color: "var(--mf-text)", fontWeight: 950, fontSize: 14 }}>{row.submissionNumber}</Typography>
                    <Typography sx={{ color: "var(--mf-text-secondary)", fontSize: 12 }}>{row.projectCode} · {row.productName}</Typography>
                </Box>
                <Chip label={readable(row.status)} sx={statusChipSx(row.status)} />
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: .7, mt: 1 }}>
                <Mini label="Drawing" value={`${row.drawingNo || "-"} · Rev ${row.designDrawingRevision || "-"}`} />
                <Mini label="Designer" value={row.designer || "-"} />
                <Mini label="Engineering Head" value={row.engineeringHead || "-"} />
                <Mini label="Production" value={row.productionRecipient || "-"} />
            </Box>
            <Box sx={{ mt: 1 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}><Typography sx={smallSx}>Wardrobe Designing checklist</Typography><Typography sx={{ ...smallSx, color: progressTone(progress.complete) }}>{progress.percent ?? 0}%</Typography></Box>
                <LinearProgress variant="determinate" value={progress.percent || 0} sx={{ mt: .5, height: 6, borderRadius: 9 }} />
            </Box>
            {row.returnReason && <Alert severity="warning" sx={{ mt: 1, py: 0 }}>{row.returnReason}</Alert>}
            <Button onClick={onOpen} sx={{ ...secondaryBtnSx, mt: 1 }}>Open submission</Button>
        </Card>
    );
}

function TaskLane({ label, rows, onOpen }) {
    return (
        <Card sx={{ ...panelSx, m: 0, p: .8, minHeight: 250 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: .7 }}>
                <Typography sx={{ color: "var(--mf-text)", fontWeight: 950, fontSize: 12.5 }}>{label}</Typography>
                <Chip size="small" label={rows.length} sx={{ height: 20, fontSize: 10 }} />
            </Box>
            <Box sx={{ display: "grid", gap: .7 }}>
                {rows.map((row) => (
                    <Card key={row.id} onClick={() => onOpen(row.id)} sx={{ p: .8, cursor: "pointer", boxShadow: "none", background: "var(--mf-surface)" }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: .5 }}>
                            <Typography sx={{ color: "var(--mf-text)", fontWeight: 900, fontSize: 11.5 }}>{row.taskNumber}</Typography>
                            {row.overdue && <WarningAmberOutlinedIcon sx={{ color: "var(--mf-danger-text)", fontSize: 17 }} />}
                        </Box>
                        <Typography sx={{ color: "var(--mf-text)", fontWeight: 800, fontSize: 12, mt: .35 }}>{row.productName}</Typography>
                        <Typography sx={smallSx}>{row.projectCode} · {row.drawingNo}</Typography>
                        <Typography sx={smallSx}>{row.assignedTo || "Unassigned"}</Typography>
                        {row.revisionReviewRequired && <Chip label={`NEW DESIGN REV ${row.pendingDesignRevision || ""}`} sx={{ ...statusChipSx("RETURNED"), mt: .6 }} />}
                    </Card>
                ))}
                {!rows.length && <Typography sx={{ ...smallSx, p: 1, textAlign: "center" }}>No tasks</Typography>}
            </Box>
        </Card>
    );
}

function DesignDetail({ detail, canDesign, canHead, designPeople, heads, engineers, productionPeople, engineeringTemplates, working, designFile, setDesignFile, assignForm, setAssignForm, returnNote, setReturnNote, onClose, onUpdateSetup, onChecklist, onNa, onUpload, onView, onSubmit, onReview, onRefresh }) {
    const row = detail.submission;
    const editable = ["DRAFT", "RETURNED_FOR_CLARIFICATION"].includes(row.status);
    const waiting = row.status === "SUBMITTED_TO_ENGINEERING";
    const [setup, setSetup] = useState({
        designer: row.designer || "",
        designDrawingRevision: row.designDrawingRevision || "",
        engineeringHead: row.engineeringHead || "",
        productionRecipient: row.productionRecipient || "",
        engineeringChecklistTemplateKey: row.engineeringChecklistTemplateKey || "PYTHA_ENGINEERING_V1",
        reference: row.reference || "",
        companyCode: row.companyCode || "ALSORG",
        remarks: row.remarks || "",
    });
    useEffect(() => {
        setSetup({
            designer: row.designer || "",
            designDrawingRevision: row.designDrawingRevision || "",
            engineeringHead: row.engineeringHead || "",
            productionRecipient: row.productionRecipient || "",
            engineeringChecklistTemplateKey: row.engineeringChecklistTemplateKey || "PYTHA_ENGINEERING_V1",
            reference: row.reference || "",
            companyCode: row.companyCode || "ALSORG",
            remarks: row.remarks || "",
        });
    }, [row.id, row.version]);
    const routingComplete = [row.designer, row.designDrawingRevision, row.engineeringHead, row.productionRecipient].every((value) => clean(value));
    return (
        <Box sx={{ p: 1.4 }}>
            <DetailHeader title="Design Submission" number={row.submissionNumber} status={row.status} onClose={onClose} onRefresh={onRefresh} />
            <Card sx={{ ...panelSx, m: 0 }}>
                <Typography sx={titleSx}>{row.projectCode} · {row.productName}</Typography>
                <Typography sx={smallSx}>{row.clientName} · {row.plantCode} · {row.drawingNo} · Design Rev {row.designDrawingRevision}</Typography>
                <Divider sx={{ my: 1, borderColor: "var(--mf-border)" }} />
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: .7 }}>
                    <Mini label="Designer" value={row.designer} />
                    <Mini label="Engineering Head" value={row.engineeringHead} />
                    <Mini label="Production Recipient" value={row.productionRecipient} />
                    <Mini label="Engineering Checklist" value={readable(row.engineeringChecklistTemplateKey)} />
                    <Mini label="Callisto / Alsorg" value={row.companyCode || "-"} />
                    <Mini label="Reference" value={row.reference || "-"} />
                    <Mini label="Submitted" value={toDateTime(row.submittedAt)} />
                    <Mini label="Reviewed" value={toDateTime(row.reviewedAt)} />
                </Box>
            </Card>

            {editable && canDesign && (
                <Section title="Design Submission Setup" subtitle="Draft-safe metadata. Complete this before Submit to Engineering; saving here does not approve the Product or submit the package.">
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: .8 }}>
                        <TextField select label="Designer / Designing owner" value={setup.designer} onChange={(e) => setSetup((c) => ({ ...c, designer: e.target.value }))} sx={fieldSx}>
                            {designPeople.map((person) => <MenuItem key={person.username} value={person.username}>{person.displayName}</MenuItem>)}
                        </TextField>
                        <TextField label="Design drawing revision" value={setup.designDrawingRevision} onChange={(e) => setSetup((c) => ({ ...c, designDrawingRevision: e.target.value }))} sx={fieldSx} />
                        <TextField select label="Engineering Head" value={setup.engineeringHead} onChange={(e) => setSetup((c) => ({ ...c, engineeringHead: e.target.value }))} sx={fieldSx}>
                            <MenuItem value=""><em>Not selected yet</em></MenuItem>
                            {heads.map((person) => <MenuItem key={person.username} value={person.username}>{person.displayName}</MenuItem>)}
                        </TextField>
                        <TextField select label="Production recipient" value={setup.productionRecipient} onChange={(e) => setSetup((c) => ({ ...c, productionRecipient: e.target.value }))} sx={fieldSx}>
                            <MenuItem value=""><em>Not selected yet</em></MenuItem>
                            {productionPeople.map((person) => <MenuItem key={person.username} value={person.username}>{person.displayName}</MenuItem>)}
                        </TextField>
                        <TextField select label="Engineering task checklist template" value={setup.engineeringChecklistTemplateKey} onChange={(e) => setSetup((c) => ({ ...c, engineeringChecklistTemplateKey: e.target.value }))} sx={fieldSx}>
                            {engineeringTemplates.map((template) => <MenuItem key={template.key} value={template.key}>{template.name}</MenuItem>)}
                        </TextField>
                        <TextField select label="Callisto / Alsorg" value={setup.companyCode} onChange={(e) => setSetup((c) => ({ ...c, companyCode: e.target.value }))} sx={fieldSx}>
                            <MenuItem value="ALSORG">Alsorg</MenuItem>
                            <MenuItem value="CALLISTO">Callisto</MenuItem>
                        </TextField>
                        <TextField label="Reference" value={setup.reference} onChange={(e) => setSetup((c) => ({ ...c, reference: e.target.value }))} sx={fieldSx} />
                    </Box>
                    <TextField multiline minRows={2} label="Design remarks / unresolved queries" value={setup.remarks} onChange={(e) => setSetup((c) => ({ ...c, remarks: e.target.value }))} sx={{ ...fieldSx, mt: .8 }} fullWidth />
                    <Button disabled={working} onClick={() => onUpdateSetup(setup)} sx={{ ...primaryBtnSx, mt: .9 }}>Save Draft Setup</Button>
                </Section>
            )}

            <Section title="Initial Design Drawing" subtitle="Exact submission revision; retained with this submission even when Product master revision changes later.">
                <Box sx={{ display: "flex", gap: .7, flexWrap: "wrap", alignItems: "center" }}>
                    <Chip label={row.designDrawing?.available ? `${row.designDrawing.originalFileName} · Rev ${row.designDrawing.revision}` : "No drawing uploaded"} sx={statusChipSx(row.designDrawing?.available ? "ACCEPTED" : "RETURNED")} />
                    {row.designDrawing?.available && <Button startIcon={<VisibilityOutlinedIcon />} onClick={() => onView(row.id)} sx={secondaryBtnSx}>View</Button>}
                </Box>
                {editable && canDesign && <Box sx={{ mt: 1, display: "flex", gap: .7, flexWrap: "wrap" }}>
                    <Button component="label" startIcon={<AttachFileOutlinedIcon />} sx={secondaryBtnSx}>Choose Drawing<input hidden type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.dwg,.dxf" onChange={(e) => setDesignFile(e.target.files?.[0] || null)} /></Button>
                    {designFile && <Typography sx={smallSx}>{designFile.name}</Typography>}
                    <Button startIcon={<UploadFileOutlinedIcon />} disabled={!designFile || !clean(row.designDrawingRevision) || working} onClick={onUpload} sx={primaryBtnSx}>Upload Revision {row.designDrawingRevision}</Button>
                </Box>}
            </Section>

            <ChecklistSection type="DESIGN" title="Wardrobe Designing Checklist" row={row} editable={editable && canDesign} working={working} onChecklist={onChecklist} onNa={onNa} />

            {row.returnReason && <Alert severity="warning" sx={{ mt: 1 }}>{row.returnReason}</Alert>}

            {editable && canDesign && (
                <Card sx={{ ...panelSx, mt: 1, m: 0 }}>
                    <Typography sx={titleSx}>Submit to Engineering</Typography>
                    <Typography sx={smallSx}>Submission is blocked until Designer, Design revision, Engineering Head and Production recipient are set, the drawing is attached, and the 32-point Wardrobe Designing checklist is Done or validly N/A. The Engineering task receives its separate PYTHA checklist only after Engineering Head acceptance.</Typography>
                    <Button startIcon={<SendOutlinedIcon />} disabled={working || !routingComplete || !row.designDrawing?.available || !row.checklistProgress?.complete} onClick={onSubmit} sx={{ ...primaryBtnSx, mt: 1 }}>Submit to Engineering Head</Button>
                </Card>
            )}

            {waiting && canHead && (
                <Card sx={{ ...panelSx, mt: 1, m: 0 }}>
                    <Typography sx={titleSx}>Engineering Head Review & Assignment</Typography>
                    <Box sx={{ display: "grid", gap: .8, mt: 1 }}>
                        <TextField select label="Assigned engineer (optional at acceptance)" value={assignForm.assignedTo} onChange={(e) => setAssignForm((c) => ({ ...c, assignedTo: e.target.value }))} sx={fieldSx}>
                            <MenuItem value="">Accept into Awaiting Assignment</MenuItem>
                            {engineers.map((person) => <MenuItem key={person.username} value={person.username}>{person.displayName}</MenuItem>)}
                        </TextField>
                        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: .8 }}>
                            <TextField type="date" label="Due date" InputLabelProps={{ shrink: true }} value={assignForm.dueDate} onChange={(e) => setAssignForm((c) => ({ ...c, dueDate: e.target.value }))} sx={fieldSx} />
                            <TextField select label="Priority" value={assignForm.priority} onChange={(e) => setAssignForm((c) => ({ ...c, priority: e.target.value }))} sx={fieldSx}>{["LOW", "NORMAL", "HIGH", "URGENT"].map((v) => <MenuItem key={v} value={v}>{readable(v)}</MenuItem>)}</TextField>
                        </Box>
                        <TextField multiline minRows={2} label="Assignment / acceptance note" value={assignForm.note} onChange={(e) => setAssignForm((c) => ({ ...c, note: e.target.value }))} sx={fieldSx} />
                        <Button startIcon={<CheckCircleOutlineOutlinedIcon />} onClick={() => onReview("ACCEPT")} disabled={working} sx={primaryBtnSx}>Accept & Create Engineering Task</Button>
                        <Divider sx={{ borderColor: "var(--mf-border)" }} />
                        <TextField multiline minRows={2} label="Clarification / return reason" value={returnNote} onChange={(e) => setReturnNote(e.target.value)} sx={fieldSx} />
                        <Button onClick={() => onReview("RETURN")} disabled={working || !clean(returnNote)} sx={secondaryBtnSx}>Return to Designing</Button>
                    </Box>
                </Card>
            )}

            <History rows={detail.history} />
        </Box>
    );
}

function TaskDetail({ detail, canHead, canEngineer, canHandover, engineers, productionPeople, boms, working, assignForm, setAssignForm, productionFile, setProductionFile, productionRevision, setProductionRevision, taskNote, setTaskNote, handover, setHandover, onClose, onAssign, onChecklist, onNa, onStatus, onUpload, onViewDesign, onViewProduction, onHandover, onRefresh }) {
    const row = detail.task;
    const checklistLocked = ["SUBMITTED_TO_PRODUCTION", "COMPLETED", "SUPERSEDED", "CANCELLED"].includes(row.status);
    const handoverBoms = boms.filter((bom) => ["DRAFT", "RETURNED"].includes(String(bom.status || "").toUpperCase()));
    return (
        <Box sx={{ p: 1.4 }}>
            <DetailHeader title="Engineering Task" number={row.taskNumber} status={row.status} onClose={onClose} onRefresh={onRefresh} />
            {row.revisionReviewRequired && <Alert severity="warning" sx={{ mb: 1 }}>New Design revision <strong>{row.pendingDesignRevision}</strong> is available. Review the new submission before continuing this task; the current task remains tied to Design Rev {row.designDrawingRevision} until explicitly superseded.</Alert>}
            {row.status === "SUPERSEDED" && <Alert severity="info" sx={{ mb: 1 }}>This Engineering task is archived because Engineering accepted a newer Design revision. Its drawing, checklist, BOM linkage and history remain available for traceability; continue on the replacement task created from the accepted revision.</Alert>}
            {row.productionReturnPending && <Alert severity="error" sx={{ mb: 1 }}>Production has returned the linked BOM. Use “Acknowledge Production Return” to move this Engineering task back to Returned and correct the package.</Alert>}

            <Card sx={{ ...panelSx, m: 0 }}>
                <Typography sx={titleSx}>{row.projectCode} · {row.productName}</Typography>
                <Typography sx={smallSx}>{row.clientName} · {row.plantCode} · {row.drawingNo}</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: .7, mt: 1 }}>
                    <Mini label="Design revision" value={row.designDrawingRevision || "-"} />
                    <Mini label="Production drawing revision" value={row.engineeringDrawingRevision || "Not uploaded"} />
                    <Mini label="Engineering Head" value={row.engineeringHead || "-"} />
                    <Mini label="Assigned engineer" value={row.assignedTo || "Awaiting assignment"} />
                    <Mini label="Production recipient" value={row.productionRecipient || "-"} />
                    <Mini label="Due date" value={row.dueDate || "-"} />
                </Box>
            </Card>

            {canHead && row.status === "AWAITING_ASSIGNMENT" && (
                <Section title="Assign Engineering Work" subtitle="Assignment is against this exact Design revision.">
                    <TextField select label="Engineer *" value={assignForm.assignedTo} onChange={(e) => setAssignForm((c) => ({ ...c, assignedTo: e.target.value }))} sx={fieldSx} fullWidth>
                        {engineers.map((person) => <MenuItem key={person.username} value={person.username}>{person.displayName}</MenuItem>)}
                    </TextField>
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: .7, mt: .7 }}>
                        <TextField type="date" label="Due date" InputLabelProps={{ shrink: true }} value={assignForm.dueDate} onChange={(e) => setAssignForm((c) => ({ ...c, dueDate: e.target.value }))} sx={fieldSx} />
                        <TextField select label="Priority" value={assignForm.priority} onChange={(e) => setAssignForm((c) => ({ ...c, priority: e.target.value }))} sx={fieldSx}>{["LOW", "NORMAL", "HIGH", "URGENT"].map((v) => <MenuItem key={v} value={v}>{readable(v)}</MenuItem>)}</TextField>
                    </Box>
                    <TextField multiline minRows={2} label="Assignment note" value={assignForm.note} onChange={(e) => setAssignForm((c) => ({ ...c, note: e.target.value }))} sx={{ ...fieldSx, mt: .7 }} fullWidth />
                    <Button startIcon={<AssignmentIndOutlinedIcon />} onClick={onAssign} disabled={working || !clean(assignForm.assignedTo)} sx={{ ...primaryBtnSx, mt: .8 }}>Assign Task</Button>
                </Section>
            )}

            <Section title="Drawing Package" subtitle="Initial Design drawing and Engineering Production drawing remain separate revision-controlled evidence.">
                <Box sx={{ display: "grid", gap: .7 }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: .7, flexWrap: "wrap" }}>
                        <Typography sx={smallSx}>Design: {row.designDrawing?.originalFileName || "-"} · Rev {row.designDrawingRevision || "-"}</Typography>
                        {row.designDrawing?.available && <Button startIcon={<VisibilityOutlinedIcon />} onClick={() => onViewDesign(row.submissionId)} sx={secondaryBtnSx}>View Design</Button>}
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: .7, flexWrap: "wrap" }}>
                        <Typography sx={smallSx}>Engineering: {row.productionDrawing?.originalFileName || "Not uploaded"} · Rev {row.engineeringDrawingRevision || "-"}</Typography>
                        {row.productionDrawing?.available && <Button startIcon={<VisibilityOutlinedIcon />} onClick={() => onViewProduction(row.id)} sx={secondaryBtnSx}>View Production Drawing</Button>}
                    </Box>
                </Box>
                {!checklistLocked && canEngineer && (
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: .7, mt: 1 }}>
                        <TextField label="Production drawing revision *" value={productionRevision} onChange={(e) => setProductionRevision(e.target.value)} sx={fieldSx} />
                        <Button component="label" startIcon={<AttachFileOutlinedIcon />} sx={secondaryBtnSx}>Choose Production Drawing<input hidden type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.dwg,.dxf" onChange={(e) => setProductionFile(e.target.files?.[0] || null)} /></Button>
                        {productionFile && <Typography sx={smallSx}>{productionFile.name}</Typography>}
                        <Button startIcon={<UploadFileOutlinedIcon />} onClick={onUpload} disabled={working || !productionFile || !clean(productionRevision)} sx={primaryBtnSx}>Upload / Replace Draft Drawing</Button>
                    </Box>
                )}
            </Section>

            <ChecklistSection type="TASK" title={checklistTemplateLabel(row.checklistTemplateKey)} row={row} editable={canEngineer && !checklistLocked} working={working} onChecklist={onChecklist} onNa={onNa} />

            {canEngineer && ["ASSIGNED", "IN_PROGRESS", "AWAITING_CLARIFICATION", "RETURNED"].includes(row.status) && (
                <Section title="Task Progress" subtitle="Human task progress remains separate from BOM approval / release.">
                    <TextField multiline minRows={2} label="Progress / clarification note" value={taskNote} onChange={(e) => setTaskNote(e.target.value)} sx={fieldSx} fullWidth />
                    <Box sx={{ display: "flex", gap: .7, flexWrap: "wrap", mt: .8 }}>
                        {row.status === "ASSIGNED" && <Button onClick={() => onStatus("IN_PROGRESS")} sx={primaryBtnSx}>Start Work</Button>}
                        {["ASSIGNED", "IN_PROGRESS", "RETURNED"].includes(row.status) && <Button onClick={() => onStatus("AWAITING_CLARIFICATION")} sx={secondaryBtnSx}>Await Clarification</Button>}
                        {row.status === "AWAITING_CLARIFICATION" && <Button onClick={() => onStatus("IN_PROGRESS")} sx={primaryBtnSx}>Resume Work</Button>}
                        {row.status === "RETURNED" && <Button onClick={() => onStatus("IN_PROGRESS")} sx={primaryBtnSx}>Start Correction</Button>}
                    </Box>
                </Section>
            )}

            {canHandover && ["ASSIGNED", "IN_PROGRESS", "RETURNED", "AWAITING_CLARIFICATION"].includes(row.status) && (
                <Section title="Handover to Production" subtitle="This submits the selected existing MatFlow BOM revision through the current Production technical-review flow. It does not mark the Engineering task completed.">
                    <TextField select label="BOM revision *" value={handover.bomId} onChange={(e) => setHandover((c) => ({ ...c, bomId: e.target.value }))} sx={fieldSx} fullWidth>
                        {handoverBoms.map((bom) => <MenuItem key={bom.id} value={bom.id}>{bom.bomNumber} · Rev {bom.revisionNo ?? "-"} · {readable(bom.status)}</MenuItem>)}
                    </TextField>
                    <TextField multiline minRows={2} label="Handover remarks" value={handover.handoverRemarks} onChange={(e) => setHandover((c) => ({ ...c, handoverRemarks: e.target.value }))} sx={{ ...fieldSx, mt: .7 }} fullWidth />
                    <Button startIcon={<SendOutlinedIcon />} onClick={onHandover} disabled={working || row.revisionReviewRequired || !handover.bomId || !row.checklistProgress?.complete || !row.productionDrawing?.available} sx={{ ...primaryBtnSx, mt: .8 }}>Submit Drawing + BOM to Production</Button>
                </Section>
            )}

            {row.linkedBom && (
                <Section title="Existing MatFlow Production Review" subtitle="Live BOM status; task and BOM approvals stay separate.">
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: .7 }}>
                        <Mini label="BOM" value={`${row.linkedBom.bomNumber || "-"} · Rev ${row.linkedBom.revisionNo ?? "-"}`} />
                        <Mini label="BOM status" value={readable(row.linkedBom.status)} />
                        <Mini label="Production reviewed by" value={row.linkedBom.productionReviewedBy || "-"} />
                        <Mini label="Review time" value={toDateTime(row.linkedBom.productionReviewedAt)} />
                    </Box>
                    {row.linkedBom.returnRemarks && <Alert severity="error" sx={{ mt: .8 }}>{row.linkedBom.returnRemarks}</Alert>}
                    <Box sx={{ display: "flex", gap: .7, flexWrap: "wrap", mt: .8 }}>
                        {row.productionReturnPending && <Button onClick={() => onStatus("RETURNED")} sx={secondaryBtnSx}>Acknowledge Production Return</Button>}
                        {row.status === "SUBMITTED_TO_PRODUCTION" && row.linkedBom.effective && row.linkedBom.status === "APPROVED" && <Button onClick={() => onStatus("COMPLETED")} sx={primaryBtnSx}>Close Engineering Task</Button>}
                    </Box>
                </Section>
            )}

            <History rows={detail.history} />
        </Box>
    );
}

function ChecklistSection({ type, title, row, editable, working, onChecklist, onNa }) {
    const progress = row.checklistProgress || {};
    const items = Array.isArray(row.checklist) ? row.checklist : [];
    const groups = items.reduce((result, item) => {
        const section = clean(item.section) || "CHECKLIST";
        if (!result.has(section)) result.set(section, []);
        result.get(section).push(item);
        return result;
    }, new Map());
    const showSectionHeaders = groups.size > 1 || [...groups.keys()].some((section) => section !== "CHECKLIST");

    return (
        <Section title={title} subtitle={`${progress.done || 0} Done · ${progress.notApplicable || 0} N/A · ${progress.pending || 0} Pending`}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: .5 }}><Typography sx={smallSx}>Completion</Typography><Typography sx={{ ...smallSx, color: progressTone(progress.complete) }}>{progress.percent || 0}%</Typography></Box>
            <LinearProgress variant="determinate" value={progress.percent || 0} sx={{ height: 7, borderRadius: 9, mb: 1 }} />
            <Box sx={{ display: "grid", gap: .9 }}>
                {[...groups.entries()].map(([section, sectionItems]) => (
                    <Box key={section}>
                        {showSectionHeaders && (
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: .7, mb: .55, mt: .2 }}>
                                <Typography sx={{ color: "var(--mf-text)", fontSize: 11.2, fontWeight: 950, letterSpacing: ".035em", textTransform: "uppercase" }}>
                                    {checklistSectionLabel(section)}
                                </Typography>
                                {type === "TASK" && section === "PYTHA ENGINEERING DETAILS" && <Chip size="small" label="20 deliverables" sx={statusChipSx("DRAFT")} />}
                                {type === "TASK" && section === "DRAWINGS CHECK LIST" && <Chip size="small" label="20 drawing checks" sx={statusChipSx("DRAFT")} />}
                            </Box>
                        )}
                        <Box sx={{ display: "grid", gap: .65 }}>
                            {sectionItems.map((item) => {
                                const itemNo = Number(item.displayNo || item.no || 0);
                                return (
                                    <Card key={item.key} sx={{ p: .75, boxShadow: "none", background: "var(--mf-surface)" }}>
                                        <Box sx={{ display: "flex", gap: .7, justifyContent: "space-between", alignItems: "flex-start" }}>
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography sx={{ color: "var(--mf-text)", fontSize: 12, fontWeight: 800 }}>{itemNo ? `${itemNo}. ` : ""}{item.text}</Typography>
                                                {item.state === "NA" && <Typography sx={{ ...smallSx, color: "var(--mf-warning-text)" }}>N/A: {item.naReason}</Typography>}
                                                {item.checkedBy && <Typography sx={smallSx}>{readable(item.state)} · {item.checkedBy} · {toDateTime(item.checkedAt)}</Typography>}
                                            </Box>
                                            <Chip label={item.state === "NA" ? "N/A" : readable(item.state)} sx={statusChipSx(item.state === "DONE" ? "ACCEPTED" : item.state === "NA" ? "RETURNED" : "DRAFT")} />
                                        </Box>
                                        {editable && <Box sx={{ display: "flex", gap: .5, flexWrap: "wrap", mt: .6 }}>
                                            <Button disabled={working || item.state === "DONE"} onClick={() => onChecklist(type, item, "DONE")} sx={secondaryBtnSx}>Done</Button>
                                            {item.naAllowed && <Button disabled={working || item.state === "NA"} onClick={() => onNa(type, item)} sx={secondaryBtnSx}>N/A</Button>}
                                            <Button disabled={working || item.state === "PENDING"} onClick={() => onChecklist(type, item, "PENDING")} sx={secondaryBtnSx}>Reset</Button>
                                        </Box>}
                                    </Card>
                                );
                            })}
                        </Box>
                    </Box>
                ))}
            </Box>
        </Section>
    );
}

function Section({ title, subtitle, children }) {
    return (
        <Card sx={{ ...panelSx, mt: 1, m: 0 }}>
            <Typography sx={titleSx}>{title}</Typography>
            {subtitle && <Typography sx={{ ...smallSx, mb: 1 }}>{subtitle}</Typography>}
            {children}
        </Card>
    );
}

function DetailHeader({ title, number, status, onClose, onRefresh }) {
    return (
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center", mb: 1 }}>
            <Box>
                <Typography sx={{ color: "var(--mf-text)", fontWeight: 950, fontSize: 18 }}>{title}</Typography>
                <Box sx={{ display: "flex", gap: .6, alignItems: "center", mt: .3 }}><Typography sx={smallSx}>{number}</Typography><Chip label={readable(status)} sx={statusChipSx(status)} /></Box>
            </Box>
            <Box sx={{ display: "flex", gap: .5 }}><Button onClick={onRefresh} sx={secondaryBtnSx}>Refresh</Button><Button onClick={onClose} sx={secondaryBtnSx}>Close</Button></Box>
        </Box>
    );
}

function History({ rows }) {
    if (!Array.isArray(rows) || !rows.length) return null;
    return (
        <Section title="Activity & Audit History" subtitle="Append-only actor/time trail.">
            <Box sx={{ display: "grid", gap: .55 }}>
                {rows.slice().reverse().map((row, index) => (
                    <Box key={`${row.at}-${index}`} sx={{ borderLeft: "2px solid var(--mf-primary-border)", pl: .8 }}>
                        <Typography sx={{ color: "var(--mf-text)", fontWeight: 800, fontSize: 11.5 }}>{readable(row.action)}</Typography>
                        <Typography sx={smallSx}>{row.actor || "-"} · {toDateTime(row.at)}</Typography>
                        {row.note && <Typography sx={{ ...smallSx, color: "var(--mf-text)" }}>{row.note}</Typography>}
                    </Box>
                ))}
            </Box>
        </Section>
    );
}

function Mini({ label, value }) {
    return <Box><Typography sx={{ color: "var(--mf-text-muted)", fontSize: 9.5, fontWeight: 850, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</Typography><Typography sx={{ color: "var(--mf-text)", fontSize: 11.7, fontWeight: 750, overflowWrap: "anywhere" }}>{value || "-"}</Typography></Box>;
}

const titleSx = { color: "var(--mf-text)", fontWeight: 950, fontSize: 14 };
const smallSx = { color: "var(--mf-text-secondary)", fontSize: 10.8, lineHeight: 1.45 };

export default MatFlowWorkWorkspacePage;
