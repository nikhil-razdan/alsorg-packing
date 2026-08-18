import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";
import AddAlertOutlinedIcon from "@mui/icons-material/AddAlertOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PlayCircleOutlineOutlinedIcon from "@mui/icons-material/PlayCircleOutlineOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import { useNavigate, useSearchParams } from "react-router-dom";

import { matflowApi, readMatFlowError } from "../api/matflowApi";
import { downloadMatFlowExcel } from "../api/matflowExcel";
import { MATFLOW_ROLES, useMatFlow } from "../matflowUi";
import {
    EmptyState,
    ErrorBox,
    LoadingBlock,
    MatFlowKanbanBoard,
    MatFlowPagination,
    MatFlowStatusChip,
    MatFlowViewToggle,
    PageHero,
    SummaryCard,
    clean,
    dialogActionsSx,
    dialogContentSx,
    dialogPaperSx,
    dialogTitleSx,
    fieldSx,
    formatDate,
    mainTextSx,
    normalize,
    pageSx,
    panelSx,
    primaryBtnSx,
    readable,
    secondaryBtnSx,
    subTextSx,
    tableCellSx,
    tableHeaderSx,
    tableRowSx,
    tableShellSx,
    useMatFlowPagination,
} from "../matflowUi";

const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const CATEGORIES = [
    "WRONG_QUANTITY",
    "WRONG_SIZE_SPEC",
    "WRONG_MATERIAL",
    "WRONG_NAME_CODE",
    "WRONG_DRAWING_BOM",
    "WRONG_PROCESSING_ROUTE",
    "PROCUREMENT_ERROR",
    "QUALITY_ERROR",
    "PRODUCTION_ERROR",
    "DATA_ENTRY_ERROR",
    "OTHER",
];
const STAGES = [
    "ENGINEERING / BOM",
    "PRODUCTION / MR",
    "ORIGIN PLANT STORE",
    "AL-P1 MAIN STORE",
    "PURCHASE",
    "GRN / RECEIVING",
    "QC",
    "PROCESSING",
    "PRODUCTION",
    "RETURN / RECOVERY",
    "OTHER",
];

const EXCEPTION_KANBAN_COLUMNS = [
    { key: "OPEN", label: "Open", subtitle: "Issue recorded and awaiting containment" },
    { key: "CONTAINED", label: "Contained", subtitle: "Forward workflow is controlled" },
    { key: "RECOVERY_IN_PROGRESS", label: "Recovery", subtitle: "Corrective recovery is being executed" },
    { key: "RESOLVED", label: "Resolved", subtitle: "Root cause / CAPA / closure completed" },
];

const exceptionKanbanLane = (row) => {
    const state = normalize(row?.status);
    return ["OPEN", "CONTAINED", "RECOVERY_IN_PROGRESS", "RESOLVED"].includes(state) ? state : "OPEN";
};

const blankForm = {
    recordType: "MR",
    requisitionId: "",
    bomId: "",
    requisitionLineId: "",
    severity: "HIGH",
    category: "WRONG_QUANTITY",
    detectedStage: "PRODUCTION / MR",
    workflowHold: true,
    whatHappened: "",
    expectedValue: "",
    actualValue: "",
    impact: "",
    delayMinutes: "",
    immediateAction: "",
    assignedTo: "",
};

const text = (value) => clean(value) || "-";
const isOpenStatus = (value) => normalize(value) !== "RESOLVED";
const severityRank = (value) => ({ CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }[normalize(value)] || 0);

const REPORT_COLUMNS = [
    { key: "exceptionNumber", label: "Exception No." },
    { key: "severity", label: "Severity" },
    { key: "status", label: "Status" },
    { key: "workflowHold", label: "Workflow Hold" },
    { key: "plantCode", label: "Plant" },
    { key: "projectCode", label: "PD No." },
    { key: "projectName", label: "Project" },
    { key: "drawingNo", label: "Drawing No." },
    { key: "drawingRevision", label: "Drawing Revision" },
    { key: "productName", label: "Product" },
    { key: "requisitionNumber", label: "MR No." },
    { key: "bomNumber", label: "BOM No." },
    { key: "materialCode", label: "Material Code" },
    { key: "materialName", label: "Material" },
    { key: "category", label: "Exception Category" },
    { key: "detectedStage", label: "Detected Stage" },
    { key: "detectedBy", label: "Detected By" },
    { key: "sourceActor", label: "Source Record Owner" },
    { key: "assignedTo", label: "Assigned Owner / Team" },
    { key: "whatHappened", label: "What Happened" },
    { key: "expectedValue", label: "Expected" },
    { key: "actualValue", label: "Actual / Found" },
    { key: "impact", label: "Impact" },
    { key: "delayMinutes", label: "Estimated Delay (Minutes)" },
    { key: "immediateAction", label: "Immediate / Containment Action" },
    { key: "recoveryAction", label: "Recovery Action" },
    { key: "recoveryPlan", label: "Recovery Plan" },
    { key: "rootCause", label: "Root Cause" },
    { key: "correctiveAction", label: "Corrective Action" },
    { key: "preventiveAction", label: "Preventive Action" },
    { key: "verifiedBy", label: "Verified By" },
    { key: "verificationReference", label: "Verification Reference" },
    { key: "resolution", label: "Resolution" },
    { key: "createdBy", label: "Created By" },
    { key: "createdAt", label: "Created At" },
    { key: "updatedBy", label: "Last Updated By" },
    { key: "updatedAt", label: "Last Updated At" },
    { key: "resolvedBy", label: "Resolved By" },
    { key: "resolvedAt", label: "Resolved At" },
];

const flattenReportRow = (row = {}) => ({
    ...row,
    workflowHold: row.workflowHold === true ? "YES" : "NO",
    recoveryPlan: Array.isArray(row.recoveryPlan) ? row.recoveryPlan.join(" | ") : clean(row.recoveryPlan),
    recoveryAction: clean(row.recoveryAction),
    createdAt: row.createdAt || "",
    updatedAt: row.updatedAt || "",
    resolvedAt: row.resolvedAt || "",
});

const saveBlob = (blob, fileName) => {
    if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error("The report is empty.");
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
};

export function MatFlowExceptionPage() {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const { hasRole, selectedPlantParam } = useMatFlow();
    const canManage = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER);

    const [rows, setRows] = useState([]);
    const [requisitions, setRequisitions] = useState([]);
    const [boms, setBoms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [severity, setSeverity] = useState("");
    const [viewMode, setViewMode] = useState("KANBAN");
    const [createOpen, setCreateOpen] = useState(false);
    const [detail, setDetail] = useState(null);
    const [actionDialog, setActionDialog] = useState(null);
    const [form, setForm] = useState(blankForm);
    const [actionForm, setActionForm] = useState({
        immediateAction: "",
        assignedTo: "",
        recoveryAction: "",
        releaseSafeReservations: true,
        note: "",
        rootCause: "",
        correctiveAction: "",
        preventiveAction: "",
        verifiedBy: "",
        verificationReference: "",
        resolution: "",
        reason: "",
        workflowHold: true,
    });

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [exceptionResponse, requisitionResponse, bomResponse] = await Promise.all([
                matflowApi.listWorkflowExceptions({
                    plantCode: selectedPlantParam || undefined,
                    search: clean(search) || undefined,
                    status: status || undefined,
                    severity: severity || undefined,
                }),
                matflowApi.listRequisitions(),
                matflowApi.listBoms({ latestOnly: false }),
            ]);
            setRows(Array.isArray(exceptionResponse?.data) ? exceptionResponse.data : []);
            setRequisitions(Array.isArray(requisitionResponse?.data) ? requisitionResponse.data : []);
            setBoms(Array.isArray(bomResponse?.data) ? bomResponse.data : []);
        } catch (requestError) {
            setRows([]);
            setError(readMatFlowError(requestError, "Unable to load the Operational Exception & Recovery Register."));
        } finally {
            setLoading(false);
        }
    }, [selectedPlantParam, search, status, severity]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (params.get("new") !== "1") return;
        setCreateOpen(true);
        setParams((current) => {
            const next = new URLSearchParams(current);
            next.delete("new");
            return next;
        }, { replace: true });
    }, [params, setParams]);

    const selectedReq = useMemo(
        () => requisitions.find((row) => String(row.id) === String(form.requisitionId)) || null,
        [requisitions, form.requisitionId]
    );
    useEffect(() => {
        if (!selectedReq) return;
        setForm((current) => ({
            ...current,
            bomId: selectedReq.bomId ? String(selectedReq.bomId) : current.bomId,
        }));
    }, [selectedReq?.id]);

    const counts = useMemo(() => ({
        open: rows.filter((row) => isOpenStatus(row.status)).length,
        holds: rows.filter((row) => isOpenStatus(row.status) && row.workflowHold === true).length,
        severe: rows.filter((row) => isOpenStatus(row.status) && severityRank(row.severity) >= 3).length,
        resolved: rows.filter((row) => normalize(row.status) === "RESOLVED").length,
    }), [rows]);

    const orderedRows = useMemo(() => [...rows].sort((a, b) => {
        const openDelta = Number(isOpenStatus(b.status)) - Number(isOpenStatus(a.status));
        if (openDelta) return openDelta;
        const severityDelta = severityRank(b.severity) - severityRank(a.severity);
        if (severityDelta) return severityDelta;
        return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
    }), [rows]);

    const reportRows = useMemo(() => orderedRows.map(flattenReportRow), [orderedRows]);

    const reportFilterText = useMemo(() => [
        `Plant: ${selectedPlantParam || "All permitted plants"}`,
        `Status: ${status ? readable(status) : "All"}`,
        `Severity: ${severity ? readable(severity) : "All"}`,
        clean(search) ? `Search: ${clean(search)}` : null,
        `Open: ${counts.open}`,
        `Workflow Holds: ${counts.holds}`,
        `High/Critical: ${counts.severe}`,
        `Resolved: ${counts.resolved}`,
    ].filter(Boolean), [selectedPlantParam, status, severity, search, counts]);

    const downloadExcelReport = async () => {
        setWorking(true);
        setError("");
        try {
            await downloadMatFlowExcel({
                fileName: `MATFLOW_Operational_Exception_Recovery_Register_${new Date().toISOString().slice(0, 10)}`,
                sheetName: "Exception Register",
                title: "ALSORG / MATFLOW — Operational Exception & Recovery Register",
                subtitle: "Fact-based operational exception, containment, recovery, root-cause and CAPA register. Source record ownership is evidence of process participation, not an automatic fault verdict.",
                rows: reportRows,
                columns: REPORT_COLUMNS,
                metadata: reportFilterText,
            });
        } catch (reportError) {
            setError(readMatFlowError(reportError, reportError?.message || "Unable to export the Exception Register to Excel."));
        } finally {
            setWorking(false);
        }
    };

    const downloadPdfReport = async () => {
        setWorking(true);
        setError("");
        try {
            const response = await matflowApi.downloadWorkflowExceptionRegisterPdf({
                plantCode: selectedPlantParam || undefined,
                search: clean(search) || undefined,
                status: status || undefined,
                severity: severity || undefined,
            });
            saveBlob(
                response?.data,
                `MATFLOW_Operational_Exception_Recovery_Register_${new Date().toISOString().slice(0, 10)}.pdf`
            );
        } catch (reportError) {
            setError(readMatFlowError(reportError, "Unable to generate the Operational Exception & Recovery PDF report."));
        } finally {
            setWorking(false);
        }
    };

    const downloadCasePdf = async () => {
        if (!detail?.id) return;
        setWorking(true);
        setError("");
        try {
            const response = await matflowApi.downloadWorkflowExceptionCasePdf(detail.id);
            const number = String(detail.exceptionNumber || detail.id || "Exception")
                .replace(/[^a-z0-9._-]+/gi, "_");
            saveBlob(response?.data, `MATFLOW_${number}_Case_File.pdf`);
        } catch (reportError) {
            setError(readMatFlowError(reportError, "Unable to generate the exception case PDF."));
        } finally {
            setWorking(false);
        }
    };

    const pagination = useMatFlowPagination(orderedRows, 15);

    const openCreate = (preset = {}) => {
        setForm({ ...blankForm, ...preset });
        setCreateOpen(true);
        setError("");
    };

    const createException = async () => {
        if (!clean(form.whatHappened)) {
            setError("Describe what happened before creating the exception.");
            return;
        }
        if (form.workflowHold && form.recordType === "GENERAL") {
            setError("A workflow hold must be linked to a BOM or MR. General observations can be recorded without a hold.");
            return;
        }
        if (form.recordType === "MR" && !form.requisitionId) {
            setError("Select the affected Material Requisition.");
            return;
        }
        if (form.recordType === "BOM" && !form.bomId) {
            setError("Select the affected BOM.");
            return;
        }

        setWorking(true);
        setError("");
        try {
            const body = {
                requisitionId: form.recordType === "MR" ? form.requisitionId : null,
                bomId: form.recordType === "BOM" ? form.bomId : (form.recordType === "MR" ? form.bomId || null : null),
                requisitionLineId: form.recordType === "MR" ? form.requisitionLineId || null : null,
                severity: form.severity,
                category: form.category,
                detectedStage: clean(form.detectedStage),
                workflowHold: form.recordType === "GENERAL" ? false : form.workflowHold === true,
                whatHappened: clean(form.whatHappened),
                expectedValue: clean(form.expectedValue) || null,
                actualValue: clean(form.actualValue) || null,
                impact: clean(form.impact) || null,
                delayMinutes: form.delayMinutes === "" ? null : Number(form.delayMinutes),
                immediateAction: clean(form.immediateAction) || null,
                assignedTo: clean(form.assignedTo) || null,
            };
            const response = await matflowApi.createWorkflowException(body);
            setCreateOpen(false);
            setForm(blankForm);
            setDetail(response?.data || null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to create the workflow exception."));
        } finally {
            setWorking(false);
        }
    };

    const openDetail = async (row) => {
        if (!row?.id) return;
        setWorking(true);
        setError("");
        try {
            const response = await matflowApi.getWorkflowException(row.id);
            setDetail(response?.data || row);
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to load exception history."));
        } finally {
            setWorking(false);
        }
    };

    const startAction = (type) => {
        setActionForm({
            immediateAction: detail?.immediateAction || "",
            assignedTo: detail?.assignedTo || "",
            recoveryAction: "",
            releaseSafeReservations: true,
            note: "",
            rootCause: detail?.rootCause || "",
            correctiveAction: detail?.correctiveAction || "",
            preventiveAction: detail?.preventiveAction || "",
            verifiedBy: detail?.verifiedBy || "",
            verificationReference: detail?.verificationReference || "",
            resolution: "",
            reason: "",
            workflowHold: true,
        });
        setActionDialog(type);
        setError("");
    };

    const performAction = async () => {
        if (!detail?.id || !actionDialog) return;
        setWorking(true);
        setError("");
        try {
            let response;
            if (actionDialog === "CONTAIN") {
                response = await matflowApi.containWorkflowException(detail.id, {
                    immediateAction: clean(actionForm.immediateAction) || null,
                    assignedTo: clean(actionForm.assignedTo) || null,
                    eventNote: clean(actionForm.note) || null,
                });
            } else if (actionDialog === "RECOVERY") {
                response = await matflowApi.startWorkflowExceptionRecovery(detail.id, {
                    recoveryAction: clean(actionForm.recoveryAction) || "Begin corrective recovery",
                    assignedTo: clean(actionForm.assignedTo) || null,
                    releaseSafeReservations: actionForm.releaseSafeReservations === true,
                    eventNote: clean(actionForm.note) || null,
                });
            } else if (actionDialog === "NOTE") {
                if (!clean(actionForm.note)) throw new Error("Enter a note.");
                response = await matflowApi.addWorkflowExceptionNote(detail.id, { note: clean(actionForm.note) });
            } else if (actionDialog === "RESOLVE") {
                if (![actionForm.rootCause, actionForm.correctiveAction, actionForm.resolution].every((value) => clean(value))) {
                    throw new Error("Root cause, corrective action and resolution are required to close an exception.");
                }
                response = await matflowApi.resolveWorkflowException(detail.id, {
                    rootCause: clean(actionForm.rootCause),
                    correctiveAction: clean(actionForm.correctiveAction),
                    preventiveAction: clean(actionForm.preventiveAction) || null,
                    verifiedBy: clean(actionForm.verifiedBy) || null,
                    verificationReference: clean(actionForm.verificationReference) || null,
                    resolution: clean(actionForm.resolution),
                });
            } else if (actionDialog === "REOPEN") {
                if (!clean(actionForm.reason)) throw new Error("Reopen reason is required.");
                response = await matflowApi.reopenWorkflowException(detail.id, {
                    reason: clean(actionForm.reason),
                    workflowHold: actionForm.workflowHold === true,
                });
            }
            setDetail(response?.data || detail);
            setActionDialog(null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, requestError?.message || "Unable to update workflow exception."));
        } finally {
            setWorking(false);
        }
    };

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="FACTS → CONTAINMENT → RECOVERY → PREVENTION"
                title="Operational Exception & Recovery Register"
                subtitle="Record the issue → contain the workflow → recover safely → close with root cause and corrective action."
                actions={
                    <>
                        <Button startIcon={<RefreshOutlinedIcon />} onClick={load} disabled={working} sx={secondaryBtnSx}>Refresh</Button>
                        <Button startIcon={<FileDownloadOutlinedIcon />} onClick={downloadExcelReport} disabled={working} sx={secondaryBtnSx}>Excel Report</Button>
                        <Button startIcon={<PictureAsPdfOutlinedIcon />} onClick={downloadPdfReport} disabled={working} sx={secondaryBtnSx}>PDF Report</Button>
                        <Button startIcon={<AddAlertOutlinedIcon />} onClick={() => openCreate()} disabled={working} sx={primaryBtnSx}>Report Issue</Button>
                    </>
                }
            />

            <Alert severity="info" sx={{ borderRadius: 2.2 }}>
                Keep it factual: the reporter, source-record owner, recovery actions and root cause stay separate. MatFlow never erases completed material history.
            </Alert>

            <ErrorBox>{error}</ErrorBox>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", lg: "repeat(4,minmax(0,1fr))" }, gap: 1.2 }}>
                <SummaryCard label="Open Exceptions" value={counts.open} tone="danger" />
                <SummaryCard label="Workflow Holds" value={counts.holds} tone="warning" />
                <SummaryCard label="High / Critical" value={counts.severe} tone="purple" />
                <SummaryCard label="Resolved" value={counts.resolved} tone="success" />
            </Box>

            <Card sx={{ ...panelSx, display: "grid", gridTemplateColumns: { xs: "1fr", xl: "1fr 175px 175px auto" }, gap: 1, alignItems: "center" }}>
                <TextField label="Search exception / MR / BOM / material / owner / root cause" value={search} onChange={(e) => setSearch(e.target.value)} sx={fieldSx} />
                <TextField select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={fieldSx}>
                    <MenuItem value="">All Statuses</MenuItem>
                    {["OPEN", "CONTAINED", "RECOVERY_IN_PROGRESS", "RESOLVED"].map((value) => <MenuItem key={value} value={value}>{readable(value)}</MenuItem>)}
                </TextField>
                <TextField select label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)} sx={fieldSx}>
                    <MenuItem value="">All Severities</MenuItem>
                    {SEVERITIES.map((value) => <MenuItem key={value} value={value}>{readable(value)}</MenuItem>)}
                </TextField>
                <MatFlowViewToggle
                    value={viewMode}
                    onChange={setViewMode}
                    options={[{ value: "KANBAN", label: "Recovery Board" }, { value: "TABLE", label: "Register" }]}
                />
            </Card>

            <Card sx={panelSx}>
                {loading ? <LoadingBlock /> : viewMode === "KANBAN" ? (
                    <MatFlowKanbanBoard
                        columns={EXCEPTION_KANBAN_COLUMNS}
                        items={orderedRows}
                        laneFor={exceptionKanbanLane}
                        minColumnWidth={275}
                        boardHeight={{ xs: 570, md: "clamp(490px, calc(100vh - 335px), 700px)" }}
                        completedLaneKeys={["RESOLVED"]}
                        completedLaneLimit={12}
                        boardKey={`${status || "ALL"}:${severity || "ALL"}:${search}`}
                        renderCard={(row) => (
                            <Card sx={{ ...panelSx, m: 0, p: 1.05, boxShadow: "none" }}>
                                <Box sx={{ display: "flex", justifyContent: "space-between", gap: .6, alignItems: "flex-start" }}>
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography sx={{ ...mainTextSx, fontSize: 12.4 }}>{row.exceptionNumber || "-"}</Typography>
                                        <Typography sx={subTextSx}>{row.plantCode || "General"} · {readable(row.category || "OTHER")}</Typography>
                                    </Box>
                                    <MatFlowStatusChip status={row.severity} />
                                </Box>
                                <Typography
                                    sx={{
                                        ...mainTextSx,
                                        mt: .75,
                                        display: "-webkit-box",
                                        WebkitLineClamp: 3,
                                        WebkitBoxOrient: "vertical",
                                        overflow: "hidden",
                                    }}
                                >
                                    {row.whatHappened || "-"}
                                </Typography>
                                <Typography sx={subTextSx}>{row.requisitionNumber || row.bomNumber || "General record"} · {row.projectCode || "-"}</Typography>
                                <Typography sx={subTextSx}>
                                    {row.workflowHold ? "Workflow Hold · " : ""}Owner: {row.assignedTo || row.sourceActor || "Unassigned"}
                                </Typography>
                                <Box sx={{ mt: .8, display: "flex", justifyContent: "space-between", gap: .5, alignItems: "center" }}>
                                    <MatFlowStatusChip status={row.status} />
                                    <Button onClick={() => openDetail(row)} sx={primaryBtnSx}>Open</Button>
                                </Box>
                            </Card>
                        )}
                    />
                ) : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 120px minmax(250px,1.4fr) minmax(210px,1fr) 150px 150px 110px" }}>
                            {['Exception', 'Severity', 'What happened', 'Linked flow / source', 'Status', 'Updated', 'Action'].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {pagination.pageItems.length === 0 ? <EmptyState>No exception records match the current filter.</EmptyState> : pagination.pageItems.map((row) => (
                            <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "170px 120px minmax(250px,1.4fr) minmax(210px,1fr) 150px 150px 110px" }}>
                                <Box sx={tableCellSx}>
                                    <Typography sx={mainTextSx}>{row.exceptionNumber || "-"}</Typography>
                                    <Typography sx={subTextSx}>{row.plantCode || "General"} · {readable(row.category || "OTHER")}</Typography>
                                </Box>
                                <Box sx={tableCellSx}><MatFlowStatusChip status={row.severity} /></Box>
                                <Box sx={{ ...tableCellSx, whiteSpace: "normal" }}>
                                    <Typography sx={mainTextSx}>{row.whatHappened || "-"}</Typography>
                                    <Typography sx={subTextSx}>{row.detectedStage || "Stage not specified"}{row.workflowHold ? " · WORKFLOW HOLD" : ""}</Typography>
                                </Box>
                                <Box sx={{ ...tableCellSx, whiteSpace: "normal" }}>
                                    <Typography sx={mainTextSx}>{row.requisitionNumber || row.bomNumber || "General record"}</Typography>
                                    <Typography sx={subTextSx}>{row.projectCode || "-"} · {row.drawingNo || "-"}</Typography>
                                    <Typography sx={subTextSx}>Source: {row.sourceActor || "Derived record unavailable"}</Typography>
                                </Box>
                                <Box sx={tableCellSx}><MatFlowStatusChip status={row.status} /></Box>
                                <Box sx={tableCellSx}>{formatDate(row.updatedAt || row.createdAt)}</Box>
                                <Box sx={tableCellSx}><Button onClick={() => openDetail(row)} sx={secondaryBtnSx}>Open</Button></Box>
                            </Box>
                        ))}
                    </Box>
                )}
                {!loading && viewMode === "TABLE" && <MatFlowPagination {...pagination} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} label="Exceptions" />}
            </Card>

            <Dialog open={createOpen} onClose={() => !working && setCreateOpen(false)} fullWidth maxWidth="md" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>Report Operational Exception</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Box sx={{ display: "grid", gap: 1.25 }}>
                        <Alert severity="warning">Describe the wrong information and its impact. Do not type a person to blame; MatFlow derives the source-record owner from the linked BOM/MR when possible.</Alert>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3,1fr)" }, gap: 1 }}>
                            <TextField select label="Link exception to *" value={form.recordType} onChange={(e) => setForm((c) => ({ ...c, recordType: e.target.value, requisitionId: "", bomId: "", requisitionLineId: "", workflowHold: e.target.value === "GENERAL" ? false : c.workflowHold }))} sx={fieldSx}>
                                <MenuItem value="MR">Material Requisition</MenuItem>
                                <MenuItem value="BOM">BOM</MenuItem>
                                <MenuItem value="GENERAL">General / Process Observation</MenuItem>
                            </TextField>
                            <TextField select label="Severity *" value={form.severity} onChange={(e) => setForm((c) => ({ ...c, severity: e.target.value }))} sx={fieldSx}>
                                {SEVERITIES.map((value) => <MenuItem key={value} value={value}>{readable(value)}</MenuItem>)}
                            </TextField>
                            <TextField select label="Issue category *" value={form.category} onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))} sx={fieldSx}>
                                {CATEGORIES.map((value) => <MenuItem key={value} value={value}>{readable(value)}</MenuItem>)}
                            </TextField>
                        </Box>

                        {form.recordType === "MR" && (
                            <>
                                <TextField select label="Affected MR *" value={form.requisitionId} onChange={(e) => setForm((c) => ({ ...c, requisitionId: e.target.value, requisitionLineId: "" }))} sx={fieldSx}>
                                    {requisitions.map((row) => <MenuItem key={row.id} value={row.id}>{row.requisitionNumber} · {row.projectCode} / {row.drawingNo} · {readable(row.status)}</MenuItem>)}
                                </TextField>
                                {selectedReq && Array.isArray(selectedReq.lines) && selectedReq.lines.length > 0 && (
                                    <TextField select label="Affected material line (optional)" value={form.requisitionLineId} onChange={(e) => setForm((c) => ({ ...c, requisitionLineId: e.target.value }))} sx={fieldSx}>
                                        <MenuItem value="">Whole MR / multiple materials</MenuItem>
                                        {selectedReq.lines.map((line) => <MenuItem key={line.id} value={line.id}>{line.materialCode || line.issuedMaterialCode || "Material"} · {line.materialName || ""}</MenuItem>)}
                                    </TextField>
                                )}
                            </>
                        )}
                        {form.recordType === "BOM" && (
                            <TextField select label="Affected BOM *" value={form.bomId} onChange={(e) => setForm((c) => ({ ...c, bomId: e.target.value }))} sx={fieldSx}>
                                {boms.map((row) => <MenuItem key={row.id} value={row.id}>{row.bomNumber} · {row.projectCode} / {row.drawingNo} · Rev {row.revisionNo ?? "-"}</MenuItem>)}
                            </TextField>
                        )}

                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1 }}>
                            <TextField select label="Where was it detected?" value={form.detectedStage} onChange={(e) => setForm((c) => ({ ...c, detectedStage: e.target.value }))} sx={fieldSx}>
                                {STAGES.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                            </TextField>
                            <TextField label="Assigned owner / team" value={form.assignedTo} onChange={(e) => setForm((c) => ({ ...c, assignedTo: e.target.value }))} sx={fieldSx} />
                        </Box>
                        <FormControlLabel
                            control={<Checkbox checked={form.workflowHold} disabled={form.recordType === "GENERAL"} onChange={(e) => setForm((c) => ({ ...c, workflowHold: e.target.checked }))} />}
                            label="Stop new forward workflow on the linked BOM/MR until this exception is resolved"
                        />
                        <TextField multiline minRows={3} label="What happened? *" value={form.whatHappened} onChange={(e) => setForm((c) => ({ ...c, whatHappened: e.target.value }))} sx={fieldSx} />
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1 }}>
                            <TextField multiline minRows={2} label="Expected / correct information" value={form.expectedValue} onChange={(e) => setForm((c) => ({ ...c, expectedValue: e.target.value }))} sx={fieldSx} />
                            <TextField multiline minRows={2} label="Actual / wrong information found" value={form.actualValue} onChange={(e) => setForm((c) => ({ ...c, actualValue: e.target.value }))} sx={fieldSx} />
                        </Box>
                        <TextField multiline minRows={2} label="Impact / risk to production" value={form.impact} onChange={(e) => setForm((c) => ({ ...c, impact: e.target.value }))} sx={fieldSx} />
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "180px 1fr" }, gap: 1 }}>
                            <TextField type="number" label="Delay impact (minutes)" value={form.delayMinutes} onChange={(e) => setForm((c) => ({ ...c, delayMinutes: e.target.value }))} sx={fieldSx} />
                            <TextField label="Immediate containment already taken" value={form.immediateAction} onChange={(e) => setForm((c) => ({ ...c, immediateAction: e.target.value }))} sx={fieldSx} />
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setCreateOpen(false)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
                    <Button startIcon={<AddAlertOutlinedIcon />} onClick={createException} disabled={working} sx={primaryBtnSx}>Create Exception</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(detail)} onClose={() => !working && setDetail(null)} fullWidth maxWidth="lg" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>
                    {detail?.exceptionNumber || "Workflow Exception"}
                </DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    {detail && (
                        <Box sx={{ display: "grid", gap: 1.5 }}>
                            <Box sx={{ display: "flex", gap: .75, flexWrap: "wrap" }}>
                                <MatFlowStatusChip status={detail.severity} />
                                <MatFlowStatusChip status={detail.status} />
                                {detail.workflowHold && <MatFlowStatusChip status="WORKFLOW_HOLD" />}
                            </Box>
                            <Card sx={{ ...panelSx, m: 0 }}>
                                <Typography sx={{ ...mainTextSx, fontSize: 15 }}>What happened</Typography>
                                <Typography sx={{ color: "var(--mf-text)", mt: .6, whiteSpace: "pre-wrap" }}>{detail.whatHappened || "-"}</Typography>
                                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4,1fr)" }, gap: 1.2, mt: 1.5 }}>
                                    <Fact label="Detected at" value={detail.detectedStage} />
                                    <Fact label="Detected by" value={detail.detectedBy} />
                                    <Fact label="Source record owner" value={detail.sourceActor} />
                                    <Fact label="Assigned to" value={detail.assignedTo} />
                                    <Fact label="PD No." value={detail.projectCode} />
                                    <Fact label="Product / Drawing" value={`${text(detail.productName)} / ${text(detail.drawingNo)}`} />
                                    <Fact label="MR / BOM" value={detail.requisitionNumber || detail.bomNumber} />
                                    <Fact label="Material" value={[detail.materialCode, detail.materialName].filter(Boolean).join(" · ") || "Multiple / whole record"} />
                                </Box>
                                <Alert severity="info" sx={{ mt: 1.4 }}>
                                    {detail.sourceOwnerBasis || "Source ownership is derived from linked MatFlow records where available."}
                                </Alert>
                            </Card>

                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 1.2 }}>
                                <Card sx={{ ...panelSx, m: 0 }}>
                                    <Typography sx={{ ...mainTextSx, mb: 1 }}>Wrong vs. correct information</Typography>
                                    <Fact label="Expected / correct" value={detail.expectedValue} multiline />
                                    <Fact label="Actual / found" value={detail.actualValue} multiline />
                                    <Fact label="Impact" value={detail.impact} multiline />
                                    <Fact label="Immediate action" value={detail.immediateAction} multiline />
                                </Card>
                                <Card sx={{ ...panelSx, m: 0 }}>
                                    <Typography sx={{ ...mainTextSx, mb: 1 }}>Recovery plan</Typography>
                                    {(Array.isArray(detail.recoveryPlan) ? detail.recoveryPlan : []).map((step, index) => (
                                        <Box key={`${index}-${step}`} sx={{ display: "grid", gridTemplateColumns: "24px 1fr", gap: .7, mb: .8 }}>
                                            <Box sx={{ width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--mf-primary-soft)", color: "var(--mf-primary)", fontSize: 11, fontWeight: 900 }}>{index + 1}</Box>
                                            <Typography sx={{ color: "var(--mf-text)", fontSize: 12.5 }}>{step}</Typography>
                                        </Box>
                                    ))}
                                    {!Array.isArray(detail.recoveryPlan) && <Typography sx={subTextSx}>Recovery plan is generated when the exception is linked to a BOM/MR.</Typography>}
                                </Card>
                            </Box>

                            {normalize(detail.status) === "RESOLVED" && (
                                <Card sx={{ ...panelSx, m: 0 }}>
                                    <Typography sx={{ ...mainTextSx, mb: 1 }}>Closure / CAPA</Typography>
                                    <Fact label="Root cause" value={detail.rootCause} multiline />
                                    <Fact label="Corrective action" value={detail.correctiveAction} multiline />
                                    <Fact label="Preventive action" value={detail.preventiveAction} multiline />
                                    <Fact label="Verified by" value={detail.verifiedBy || detail.resolvedBy} multiline />
                                    <Fact label="Verification reference" value={detail.verificationReference} multiline />
                                    <Fact label="Resolution" value={detail.resolution} multiline />
                                </Card>
                            )}

                            {Array.isArray(detail.accountabilityTrailAtDetection) && detail.accountabilityTrailAtDetection.length > 0 && (
                                <Card sx={{ ...panelSx, m: 0 }}>
                                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1 }}>
                                        <Typography sx={mainTextSx}><FactCheckOutlinedIcon sx={{ fontSize: 17, verticalAlign: "text-bottom", mr: .6 }} />System accountability trail at detection</Typography>
                                        <Typography sx={subTextSx}>{detail.accountabilityTrailAtDetection.length} recorded actions</Typography>
                                    </Box>
                                    <Alert severity="info" sx={{ mb: 1 }}>
                                        {detail.accountabilityPrinciple || "This shows who performed recorded actions on the linked BOM/MR. It is evidence of participation, not an automatic fault verdict."}
                                    </Alert>
                                    <Box sx={{ display: "grid", gap: .7, maxHeight: 300, overflowY: "auto" }}>
                                        {detail.accountabilityTrailAtDetection.map((event, index) => (
                                            <Box key={`${event.entityId || "event"}-${event.actionAt || index}-${index}`} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "170px 170px 150px 1fr" }, gap: 1, p: .9, border: "1px solid var(--mf-border)", borderRadius: 2 }}>
                                                <Box><Typography sx={mainTextSx}>{readable(event.entityType || "Record")}</Typography><Typography sx={subTextSx}>{formatDate(event.actionAt)}</Typography></Box>
                                                <Typography sx={mainTextSx}>{readable(event.action || "Action")}</Typography>
                                                <Typography sx={mainTextSx}>{event.actor || "SYSTEM"}</Typography>
                                                <Typography sx={{ ...subTextSx, whiteSpace: "normal" }}>PD {event.projectCode || detail.projectCode || "-"} · Drawing {event.drawingNo || detail.drawingNo || "-"}</Typography>
                                            </Box>
                                        ))}
                                    </Box>
                                </Card>
                            )}

                            <Card sx={{ ...panelSx, m: 0 }}>
                                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1 }}>
                                    <Typography sx={mainTextSx}><HistoryOutlinedIcon sx={{ fontSize: 17, verticalAlign: "text-bottom", mr: .6 }} />Immutable event timeline</Typography>
                                    <Typography sx={subTextSx}>{Array.isArray(detail.history) ? detail.history.length : 0} events</Typography>
                                </Box>
                                <Box sx={{ display: "grid", gap: .8 }}>
                                    {(Array.isArray(detail.history) ? detail.history : []).map((event, index) => (
                                        <Box key={event.id || index} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "190px 170px 1fr" }, gap: 1, p: 1, border: "1px solid var(--mf-border)", borderRadius: 2 }}>
                                            <Box><Typography sx={mainTextSx}>{readable(event.action)}</Typography><Typography sx={subTextSx}>{formatDate(event.actionAt)}</Typography></Box>
                                            <Box><Typography sx={mainTextSx}>{event.actor || "-"}</Typography><Typography sx={subTextSx}>{readable(event.status || "")}</Typography></Box>
                                            <Typography sx={{ ...subTextSx, whiteSpace: "normal" }}>{event.note || "System state snapshot recorded"}</Typography>
                                        </Box>
                                    ))}
                                </Box>
                            </Card>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ ...dialogActionsSx, justifyContent: "space-between", flexWrap: "wrap" }}>
                    <Box sx={{ display: "flex", gap: .7, flexWrap: "wrap" }}>
                        {detail && <Button startIcon={<PictureAsPdfOutlinedIcon />} onClick={downloadCasePdf} disabled={working} sx={secondaryBtnSx}>Case PDF</Button>}
                        {detail?.requisitionId && <Button onClick={() => navigate(`/matflow/requisitions/${detail.requisitionId}`)} sx={secondaryBtnSx}>Open MR</Button>}
                        {detail?.bomId && <Button onClick={() => navigate(`/matflow/boms/${detail.bomId}`)} sx={secondaryBtnSx}>Open BOM / Create Revision</Button>}
                        {detail && normalize(detail.status) !== "RESOLVED" && <Button startIcon={<FactCheckOutlinedIcon />} onClick={() => startAction("NOTE")} sx={secondaryBtnSx}>Add Note</Button>}
                    </Box>
                    <Box sx={{ display: "flex", gap: .7, flexWrap: "wrap" }}>
                        {detail && normalize(detail.status) === "OPEN" && <Button startIcon={<LockOutlinedIcon />} onClick={() => startAction("CONTAIN")} sx={secondaryBtnSx}>Contain / Hold</Button>}
                        {detail && canManage && normalize(detail.status) !== "RESOLVED" && <Button startIcon={<PlayCircleOutlineOutlinedIcon />} onClick={() => startAction("RECOVERY")} sx={secondaryBtnSx}>Start Recovery</Button>}
                        {detail && canManage && normalize(detail.status) !== "RESOLVED" && <Button startIcon={<TaskAltOutlinedIcon />} onClick={() => startAction("RESOLVE")} sx={primaryBtnSx}>Resolve & Release</Button>}
                        {detail && canManage && normalize(detail.status) === "RESOLVED" && <Button startIcon={<ReplayOutlinedIcon />} onClick={() => startAction("REOPEN")} sx={secondaryBtnSx}>Reopen</Button>}
                        <Button onClick={() => setDetail(null)} sx={secondaryBtnSx}>Close</Button>
                    </Box>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(actionDialog)} onClose={() => !working && setActionDialog(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>{actionTitle(actionDialog)}</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Box sx={{ display: "grid", gap: 1.2 }}>
                        {actionDialog === "CONTAIN" && (
                            <>
                                <Alert severity="warning">Containment activates/keeps the workflow hold. It does not erase already completed commercial or physical events.</Alert>
                                <TextField multiline minRows={2} label="Immediate containment action" value={actionForm.immediateAction} onChange={(e) => setActionForm((c) => ({ ...c, immediateAction: e.target.value }))} sx={fieldSx} />
                                <TextField label="Assigned owner / team" value={actionForm.assignedTo} onChange={(e) => setActionForm((c) => ({ ...c, assignedTo: e.target.value }))} sx={fieldSx} />
                                <TextField multiline minRows={2} label="Containment note" value={actionForm.note} onChange={(e) => setActionForm((c) => ({ ...c, note: e.target.value }))} sx={fieldSx} />
                            </>
                        )}
                        {actionDialog === "RECOVERY" && (
                            <>
                                <Alert severity="info">Safe release only unwinds untouched, unissued reservation quantities. MatFlow skips any lot whose transfer/processing already started and records exactly what was released or skipped.</Alert>
                                <TextField multiline minRows={2} label="Recovery action" value={actionForm.recoveryAction} onChange={(e) => setActionForm((c) => ({ ...c, recoveryAction: e.target.value }))} sx={fieldSx} />
                                <TextField label="Assigned owner / team" value={actionForm.assignedTo} onChange={(e) => setActionForm((c) => ({ ...c, assignedTo: e.target.value }))} sx={fieldSx} />
                                <FormControlLabel control={<Checkbox checked={actionForm.releaseSafeReservations} onChange={(e) => setActionForm((c) => ({ ...c, releaseSafeReservations: e.target.checked }))} />} label="Release safe untouched/unissued reservation quantities now" />
                                <TextField multiline minRows={2} label="Recovery note" value={actionForm.note} onChange={(e) => setActionForm((c) => ({ ...c, note: e.target.value }))} sx={fieldSx} />
                            </>
                        )}
                        {actionDialog === "NOTE" && <TextField multiline minRows={4} label="Factual update / observation *" value={actionForm.note} onChange={(e) => setActionForm((c) => ({ ...c, note: e.target.value }))} sx={fieldSx} />}
                        {actionDialog === "RESOLVE" && (
                            <>
                                <Alert severity="success">Resolving releases the workflow hold. Close only after the corrected BOM/MR/material path has been verified.</Alert>
                                <TextField multiline minRows={3} label="Root cause *" value={actionForm.rootCause} onChange={(e) => setActionForm((c) => ({ ...c, rootCause: e.target.value }))} sx={fieldSx} />
                                <TextField multiline minRows={3} label="Corrective action *" value={actionForm.correctiveAction} onChange={(e) => setActionForm((c) => ({ ...c, correctiveAction: e.target.value }))} sx={fieldSx} />
                                <TextField multiline minRows={2} label="Preventive action" value={actionForm.preventiveAction} onChange={(e) => setActionForm((c) => ({ ...c, preventiveAction: e.target.value }))} sx={fieldSx} />
                                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1 }}>
                                    <TextField label="Verified by / department" value={actionForm.verifiedBy} onChange={(e) => setActionForm((c) => ({ ...c, verifiedBy: e.target.value }))} sx={fieldSx} />
                                    <TextField label="Corrected BOM/MR / verification ref." value={actionForm.verificationReference} onChange={(e) => setActionForm((c) => ({ ...c, verificationReference: e.target.value }))} sx={fieldSx} />
                                </Box>
                                <TextField multiline minRows={3} label="Resolution / verification *" value={actionForm.resolution} onChange={(e) => setActionForm((c) => ({ ...c, resolution: e.target.value }))} sx={fieldSx} />
                            </>
                        )}
                        {actionDialog === "REOPEN" && (
                            <>
                                <TextField multiline minRows={3} label="Why is this exception being reopened? *" value={actionForm.reason} onChange={(e) => setActionForm((c) => ({ ...c, reason: e.target.value }))} sx={fieldSx} />
                                <FormControlLabel control={<Checkbox checked={actionForm.workflowHold} onChange={(e) => setActionForm((c) => ({ ...c, workflowHold: e.target.checked }))} />} label="Re-apply workflow hold" />
                            </>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setActionDialog(null)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
                    <Button onClick={performAction} disabled={working} sx={primaryBtnSx}>Confirm</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

function Fact({ label, value, multiline = false }) {
    return (
        <Box sx={{ minWidth: 0, mb: multiline ? 1 : 0 }}>
            <Typography sx={{ color: "var(--mf-muted)", fontSize: 10.5, fontWeight: 850, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</Typography>
            <Typography sx={{ color: "var(--mf-text)", fontSize: 12.5, fontWeight: 700, whiteSpace: multiline ? "pre-wrap" : "normal", overflowWrap: "anywhere" }}>{text(value)}</Typography>
        </Box>
    );
}

function actionTitle(type) {
    if (type === "CONTAIN") return "Contain / Hold Workflow";
    if (type === "RECOVERY") return "Start Safe Recovery";
    if (type === "NOTE") return "Add Factual Update";
    if (type === "RESOLVE") return "Resolve Exception & Release Hold";
    if (type === "REOPEN") return "Reopen Exception";
    return "Exception Action";
}
