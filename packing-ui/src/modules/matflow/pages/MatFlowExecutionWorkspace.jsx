import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import PlayArrowOutlinedIcon from "@mui/icons-material/PlayArrowOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import { useNavigate } from "react-router-dom";

import { MATFLOW_ROLES, useMatFlow } from "../matflowUi";
import { matflowApi, readMatFlowError } from "../api/matflowApi";
import { downloadMatFlowExcel } from "../api/matflowExcel";
import {
    Detail,
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
    formatQty,
    mainTextSx,
    normalize,
    numeric,
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

export function MatFlowQcPage() {
    const { hasRole } = useMatFlow();
    const canAct = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.QC);

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [status, setStatus] = useState("");
    const [dialog, setDialog] = useState(null);
    const [remarks, setRemarks] = useState("");
    const [photo, setPhoto] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await matflowApi.listQcInspections({ status: status || undefined });
            setRows(Array.isArray(response?.data) ? response.data : []);
        } catch (requestError) {
            setRows([]);
            setError(readMatFlowError(requestError, "Unable to load the MR-linked QC checklist."));
        } finally {
            setLoading(false);
        }
    }, [status]);

    useEffect(() => { load(); }, [load]);

    const counts = useMemo(() => ({
        pending: rows.filter((row) => normalize(row.status) === "PENDING").length,
        checked: rows.filter((row) => normalize(row.status) === "COMPLETED").length,
        evidence: rows.filter((row) => row.photoAvailable === true).length,
    }), [rows]);

    const openCheck = (row) => {
        setDialog(row);
        setRemarks("");
        setPhoto(null);
        setError("");
    };

    const completeCheck = async () => {
        const row = dialog;
        if (!row?.id || row.rowVersion == null) return;
        setWorking(true);
        setError("");
        try {
            if (photo) {
                await matflowApi.uploadQcPhoto(row.id, photo);
            }
            await matflowApi.decideQc(row.id, {
                rowVersion: row.rowVersion,
                remarks: clean(remarks) || null,
            });
            setDialog(null);
            setPhoto(null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, requestError?.message || "Unable to complete the QC check."));
        } finally {
            setWorking(false);
        }
    };

    const viewPhoto = async (row) => {
        if (!row?.id) return;
        setWorking(true);
        setError("");
        try {
            const response = await matflowApi.getQcPhoto(row.id);
            const blob = response?.data;
            if (!(blob instanceof Blob)) throw new Error("QC picture could not be loaded.");
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank", "noopener,noreferrer");
            window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (requestError) {
            setError(readMatFlowError(requestError, requestError?.message || "Unable to open the QC picture."));
        } finally {
            setWorking(false);
        }
    };

    const pagination = useMatFlowPagination(rows, 20);

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="QUALITY CHECK"
                title="MR Material QC Checklist"
                subtitle="QC is only a check/tick against an MR material lot. It has no QC location and makes no route decision. Store already decides whether the lot goes directly to Production or through a BOM-approved Processing Unit."
                actions={
                    <>
                        <Button
                            startIcon={<FileDownloadOutlinedIcon />}
                            onClick={() => downloadMatFlowExcel({
                                fileName: "MatFlow_QC_Checklist",
                                sheetName: "QC Checks",
                                title: "MatFlow MR Material QC Checklist",
                                rows,
                            })}
                            sx={secondaryBtnSx}
                        >
                            Export Excel
                        </Button>
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                    </>
                }
            />

            <ErrorBox>{error}</ErrorBox>

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 1 }}>
                <SummaryCard label="Pending Check" value={counts.pending} />
                <SummaryCard label="Checked" value={counts.checked} />
                <SummaryCard label="With Picture" value={counts.evidence} />
            </Box>

            <Card sx={panelSx}>
                <TextField
                    select
                    label="QC State"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    sx={{ ...fieldSx, minWidth: 220 }}
                >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="PENDING">Pending Check</MenuItem>
                    <MenuItem value="COMPLETED">Checked</MenuItem>
                </TextField>
            </Card>

            <Card sx={panelSx}>
                {loading ? <LoadingBlock /> : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "190px 190px minmax(210px,1fr) 90px 130px 135px 165px 150px" }}>
                            {["MR / Procurement", "PD No. / Product", "Material", "Qty", "QC", "Picture", "Checked By / At", "Action"].map((heading) => (
                                <Box key={heading} sx={tableCellSx}>{heading}</Box>
                            ))}
                        </Box>

                        {pagination.pageItems.length === 0 ? (
                            <EmptyState>No material QC checks in this view.</EmptyState>
                        ) : pagination.pageItems.map((row) => {
                            const procurement = [
                                ...(Array.isArray(row.indentNumbers) ? row.indentNumbers : []),
                                ...(Array.isArray(row.purchaseOrderNumbers) ? row.purchaseOrderNumbers : []),
                                ...(Array.isArray(row.grnNumbers) ? row.grnNumbers : []),
                            ];
                            const pending = normalize(row.status) === "PENDING";
                            return (
                                <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "190px 190px minmax(210px,1fr) 90px 130px 135px 165px 150px" }}>
                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>{row.requisitionNumber || "-"}</Typography>
                                        <Typography sx={subTextSx}>{procurement.length ? procurement.join(" · ") : "Store stock MR lot"}</Typography>
                                    </Box>
                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>{row.pdNo || "-"}</Typography>
                                        <Typography sx={subTextSx}>{row.productName || "-"} · {row.drawingNo || "-"}</Typography>
                                    </Box>
                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>{row.materialName || "-"}</Typography>
                                        <Typography sx={subTextSx}>{row.materialCode || "-"}</Typography>
                                    </Box>
                                    <Box sx={tableCellSx}>{formatQty(row.inspectionQty)}</Box>
                                    <Box sx={tableCellSx}><MatFlowStatusChip status={pending ? "PENDING" : "COMPLETED"} /></Box>
                                    <Box sx={tableCellSx}>
                                        {row.photoAvailable ? (
                                            <Button onClick={() => viewPhoto(row)} disabled={working} sx={secondaryBtnSx}>View</Button>
                                        ) : <Typography sx={subTextSx}>Optional</Typography>}
                                    </Box>
                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>{row.inspectedBy || "-"}</Typography>
                                        <Typography sx={subTextSx}>{formatDate(row.inspectedAt)}</Typography>
                                    </Box>
                                    <Box sx={tableCellSx}>
                                        {canAct && pending ? (
                                            <Button onClick={() => openCheck(row)} disabled={working} sx={primaryBtnSx}>✓ Check</Button>
                                        ) : <Typography sx={subTextSx}>{row.remarks || "Checked"}</Typography>}
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                )}

                {!loading && (
                    <MatFlowPagination
                        {...pagination}
                        onPageChange={pagination.setPage}
                        onPageSizeChange={pagination.setPageSize}
                        label="QC Checks"
                    />
                )}
            </Card>

            <Dialog
                open={Boolean(dialog)}
                onClose={() => !working && setDialog(null)}
                fullWidth
                maxWidth="sm"
                PaperProps={{ sx: dialogPaperSx }}
            >
                <DialogTitle sx={dialogTitleSx}>Complete QC Check</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Box sx={{ display: "grid", gap: 1.5 }}>
                        <Alert severity="info">
                            This is only a QC confirmation against {dialog?.requisitionNumber || "the MR"}. QC does not receive the material at a separate location and does not choose Processing or Production.
                        </Alert>
                        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                            <Detail label="MR" value={dialog?.requisitionNumber || "-"} />
                            <Detail label="Material" value={dialog?.materialName || dialog?.materialCode || "-"} />
                            <Detail label="Quantity" value={formatQty(dialog?.inspectionQty)} />
                            <Detail label="Next Route" value="Already selected by Store" />
                        </Box>
                        <Button component="label" sx={secondaryBtnSx}>
                            {photo ? `Picture: ${photo.name}` : "Attach QC Picture (Optional)"}
                            <input
                                hidden
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={(event) => setPhoto(event.target.files?.[0] || null)}
                            />
                        </Button>
                        <Typography sx={subTextSx}>PNG, JPG/JPEG or WEBP. Maximum 8 MB.</Typography>
                        <TextField
                            multiline
                            minRows={3}
                            label="QC Remarks (Optional)"
                            value={remarks}
                            onChange={(event) => setRemarks(event.target.value)}
                            sx={fieldSx}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setDialog(null)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
                    <Button onClick={completeCheck} disabled={working} sx={primaryBtnSx}>
                        {working ? "Saving..." : "✓ Mark Checked"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

const PROCESSING_KANBAN_COLUMNS = [
    { key: "PENDING", label: "Ready to Start", subtitle: "Store-routed material queued at Processing" },
    { key: "IN_PROGRESS", label: "In Processing", subtitle: "Processor has started the batch" },
    { key: "COMPLETED", label: "Completed", subtitle: "Output/wastage recorded and released" },
];

const PRODUCTION_KANBAN_COLUMNS = [
    { key: "BLOCKED", label: "Blocked / Waiting", subtitle: "Material dependency prevents Production start" },
    { key: "INCOMING", label: "Material Incoming", subtitle: "Store/Processing route requires Production receipt" },
    { key: "READY", label: "Ready to Start", subtitle: "All required material is ready at Production" },
    { key: "RUNNING", label: "Production / Accounting", subtitle: "Consume, waste, return and complete" },
    { key: "DONE", label: "Completed", subtitle: "Production material accounting is closed" },
];

const productionReceiveLikely = (row) => {
    const stage = normalize(row?.currentStage);
    return row?.readyToStartProduction !== true && (
        stage === "PRODUCTION_ISSUE" ||
        (stage === "TRANSFER_IN_PROGRESS" &&
            normalize(row?.currentDepartment) === "IN_TRANSIT" &&
            normalize(row?.nextDepartment) === "PRODUCTION")
    );
};

const productionKanbanLane = (row) => {
    const stage = normalize(row?.currentStage);
    if (stage === "PRODUCTION_COMPLETED") return "DONE";
    if (stage === "PRODUCTION_IN_PROGRESS") return "RUNNING";
    if (row?.readyToStartProduction === true) return "READY";
    if (productionReceiveLikely(row)) return "INCOMING";
    return "BLOCKED";
};

export function MatFlowProcessingPage() {
    const { hasRole, selectedPlantParam } = useMatFlow();
    const canAct = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PROCESSING);

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [viewMode, setViewMode] = useState("KANBAN");
    const [dialog, setDialog] = useState(null);
    const [form, setForm] = useState({
        actualInputQty: "",
        outputQty: "",
        wastageQty: "0",
        batchNo: "",
        remarks: "",
    });

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await matflowApi.listProcessingJobs();
            setRows((Array.isArray(response?.data) ? response.data : []).filter((row) =>
                !selectedPlantParam || clean(row.plantCode).toUpperCase() === clean(selectedPlantParam).toUpperCase()
            ));
        } catch (requestError) {
            setRows([]);
            setError(readMatFlowError(requestError, "Unable to load Processing jobs."));
        } finally {
            setLoading(false);
        }
    }, [selectedPlantParam]);

    useEffect(() => { load(); }, [load]);

    const counts = useMemo(() => ({
        pending: rows.filter((row) => normalize(row.status) === "PENDING").length,
        progress: rows.filter((row) => normalize(row.status) === "IN_PROGRESS").length,
        completed: rows.filter((row) => normalize(row.status) === "COMPLETED").length,
    }), [rows]);

    const openStart = (job) => {
        setDialog({ type: "START", job });
        setForm({
            actualInputQty: String(job.plannedInputQty ?? ""),
            outputQty: "",
            wastageQty: "0",
            batchNo: "",
            remarks: "",
        });
        setError("");
    };

    const openComplete = (job) => {
        const actual = numeric(job.actualInputQty || job.plannedInputQty);
        setDialog({ type: "COMPLETE", job });
        setForm({
            actualInputQty: "",
            outputQty: String(actual),
            wastageQty: "0",
            batchNo: "",
            remarks: "",
        });
        setError("");
    };

    const execute = async () => {
        const job = dialog?.job;
        if (!job?.id || job.rowVersion == null) return;

        setWorking(true);
        setError("");
        try {
            if (dialog.type === "START") {
                const actualInputQty = Number(form.actualInputQty);
                if (!Number.isFinite(actualInputQty) || actualInputQty <= 0) {
                    throw new Error("Actual input quantity must be greater than zero.");
                }
                await matflowApi.startProcessingJob(job.id, {
                    rowVersion: job.rowVersion,
                    actualInputQty,
                    batchNo: clean(form.batchNo) || null,
                    remarks: clean(form.remarks) || null,
                });
            } else {
                const outputQty = Number(form.outputQty);
                const wastageQty = Number(form.wastageQty);
                if (!Number.isFinite(outputQty) || outputQty < 0 || !Number.isFinite(wastageQty) || wastageQty < 0) {
                    throw new Error("Output and wastage quantities must be valid non-negative values.");
                }
                const actualInput = numeric(job.actualInputQty);
                if (Math.abs(outputQty + wastageQty - actualInput) > .0005) {
                    throw new Error(`Output + wastage must equal actual input ${formatQty(actualInput)}.`);
                }
                await matflowApi.completeProcessingJob(job.id, {
                    rowVersion: job.rowVersion,
                    outputQty,
                    wastageQty,
                    batchNo: clean(form.batchNo) || null,
                    remarks: clean(form.remarks) || null,
                });
            }
            setDialog(null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, requestError?.message || "Unable to complete Processing action."));
        } finally {
            setWorking(false);
        }
    };

    const pagination = useMatFlowPagination(rows, 20);

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="PROCESSING UNIT"
                title="Material Processing Jobs"
                subtitle="Only Store-selected Processing lots appear here. Processing may be required with or without QC; the Processor starts the queued job, records output/wastage, then completion releases the material toward Production."
                actions={
                    <>
                        <Button startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMatFlowExcel({ fileName: "MatFlow_Processing_Jobs", sheetName: "Processing", title: "MatFlow Processing Jobs", rows })} sx={secondaryBtnSx}>Export Excel</Button>
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                    </>
                }
            />

            <ErrorBox>{error}</ErrorBox>

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 1 }}>
                <SummaryCard label="Queued" value={counts.pending} />
                <SummaryCard label="In Progress" value={counts.progress} />
                <SummaryCard label="Completed" value={counts.completed} />
            </Box>

            <Card sx={{ ...panelSx, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <Box><Typography sx={mainTextSx}>Processing View</Typography><Typography sx={subTextSx}>The workflow board is an execution view; Start/Complete still use the validated Processing actions.</Typography></Box>
                <MatFlowViewToggle value={viewMode} onChange={setViewMode} options={[{ value: "KANBAN", label: "Workflow Board" }, { value: "TABLE", label: "Table" }]} />
            </Card>

            <Card sx={panelSx}>
                {loading ? <LoadingBlock /> : viewMode === "KANBAN" ? (
                    <MatFlowKanbanBoard
                        columns={PROCESSING_KANBAN_COLUMNS}
                        items={rows}
                        laneFor={(job) => normalize(job.status)}
                        minColumnWidth={300}
                        renderCard={(job) => {
                            const state = normalize(job.status);
                            return (
                                <Card sx={{ ...panelSx, m: 0, p: 1.1, boxShadow: "none" }}>
                                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: .6, alignItems: "flex-start" }}>
                                        <Box><Typography sx={{ ...mainTextSx, fontSize: 12.5 }}>{job.jobNumber || "-"}</Typography><Typography sx={subTextSx}>{job.requisitionNumber || "-"}</Typography></Box>
                                        <MatFlowStatusChip status={job.status} />
                                    </Box>
                                    <Typography sx={{ ...subTextSx, mt: .7 }}>{job.locationCode || "-"} · {job.plantCode || "-"}</Typography>
                                    <Typography sx={subTextSx}>{job.inputMaterialCode || "-"} · Planned {formatQty(job.plannedInputQty)}</Typography>
                                    <Typography sx={subTextSx}>Output {formatQty(job.outputQty)} · Waste {formatQty(job.wastageQty)}</Typography>
                                    <Box sx={{ display: "flex", gap: .5, mt: .85, flexWrap: "wrap" }}>
                                        {canAct && state === "PENDING" && <Button startIcon={<PlayArrowOutlinedIcon />} onClick={() => openStart(job)} sx={primaryBtnSx}>Start</Button>}
                                        {canAct && state === "IN_PROGRESS" && <Button startIcon={<TaskAltOutlinedIcon />} onClick={() => openComplete(job)} sx={primaryBtnSx}>Mark Done</Button>}
                                    </Box>
                                </Card>
                            );
                        }}
                    />
                ) : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "165px 165px 170px 170px 110px 110px 130px 170px" }}>
                            {["Job", "MR", "Processing Unit", "Input Material", "Planned", "Output / Waste", "Status", "Action"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {pagination.pageItems.length === 0 ? <EmptyState>No Store-selected Processing jobs.</EmptyState> : pagination.pageItems.map((job) => {
                            const state = normalize(job.status);
                            return (
                                <Box key={job.id} sx={{ ...tableRowSx, gridTemplateColumns: "165px 165px 170px 170px 110px 110px 130px 170px" }}>
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{job.jobNumber}</Typography><Typography sx={subTextSx}>{job.processCode || "-"}</Typography></Box>
                                    <Box sx={tableCellSx}>{job.requisitionNumber || "-"}</Box>
                                    <Box sx={tableCellSx}>{job.locationCode || "-"} · {job.plantCode || "-"}</Box>
                                    <Box sx={tableCellSx}>{job.inputMaterialCode || "-"}</Box>
                                    <Box sx={tableCellSx}>{formatQty(job.plannedInputQty)}</Box>
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{formatQty(job.outputQty)}</Typography><Typography sx={subTextSx}>Waste {formatQty(job.wastageQty)}</Typography></Box>
                                    <Box sx={tableCellSx}><MatFlowStatusChip status={job.status} /></Box>
                                    <Box sx={{ ...tableCellSx, display: "flex", gap: .5, flexWrap: "wrap" }}>
                                        {canAct && state === "PENDING" && <Button startIcon={<PlayArrowOutlinedIcon />} onClick={() => openStart(job)} sx={primaryBtnSx}>Start</Button>}
                                        {canAct && state === "IN_PROGRESS" && <Button startIcon={<TaskAltOutlinedIcon />} onClick={() => openComplete(job)} sx={primaryBtnSx}>Mark Done</Button>}
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                )}
                {!loading && viewMode === "TABLE" && <MatFlowPagination {...pagination} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} label="Processing Jobs" />}
            </Card>

            <Dialog open={Boolean(dialog)} onClose={() => !working && setDialog(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>{dialog?.type === "START" ? "Start Processing Job" : "Complete Processing Job"}</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Box sx={{ display: "grid", gap: 1.5 }}>
                        {dialog?.type === "START" ? (
                            <TextField type="number" label="Actual Input Qty *" value={form.actualInputQty} onChange={(e) => setForm((c) => ({ ...c, actualInputQty: e.target.value }))} sx={fieldSx} />
                        ) : (
                            <>
                                <TextField type="number" label="Output Qty *" value={form.outputQty} onChange={(e) => setForm((c) => ({ ...c, outputQty: e.target.value }))} sx={fieldSx} />
                                <TextField type="number" label="Processing Wastage Qty *" value={form.wastageQty} onChange={(e) => setForm((c) => ({ ...c, wastageQty: e.target.value }))} sx={fieldSx} />
                                <Alert severity="info">Any processing wastage reopens the MR shortage for Store action. Processing never raises a PI directly.</Alert>
                            </>
                        )}
                        <TextField label="Batch No." value={form.batchNo} onChange={(e) => setForm((c) => ({ ...c, batchNo: e.target.value }))} sx={fieldSx} />
                        <TextField multiline minRows={2} label="Remarks" value={form.remarks} onChange={(e) => setForm((c) => ({ ...c, remarks: e.target.value }))} sx={fieldSx} />
                    </Box>
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setDialog(null)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
                    <Button onClick={execute} disabled={working} sx={primaryBtnSx}>{working ? "Saving..." : "Confirm"}</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export function MatFlowProductionExecutionPage() {
    const navigate = useNavigate();
    const { hasRole, selectedPlantParam } = useMatFlow();
    const canAct = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PRODUCTION);

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [workingId, setWorkingId] = useState("");
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [viewMode, setViewMode] = useState("KANBAN");
    const [dialog, setDialog] = useState(null);
    const [planning, setPlanning] = useState(null);
    const [form, setForm] = useState({ quantities: {}, batches: {}, remarks: "" });

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await matflowApi.productionReadiness({
                plantCode: selectedPlantParam,
                search: clean(search) || undefined,
            });
            setRows(Array.isArray(response?.data?.rows) ? response.data.rows : []);
        } catch (requestError) {
            setRows([]);
            setError(readMatFlowError(requestError, "Unable to load Production readiness."));
        } finally {
            setLoading(false);
        }
    }, [selectedPlantParam, search]);

    useEffect(() => { load(); }, [load]);

    const counts = useMemo(() => ({
        ready: rows.filter((row) => row.readyToStartProduction === true).length,
        receiving: rows.filter((row) => {
            const stage = normalize(row.currentStage);
            const currentDepartment = normalize(row.currentDepartment);
            const nextDepartment = normalize(row.nextDepartment);
            return !row.readyToStartProduction && (
                stage === "PRODUCTION_ISSUE" ||
                (stage === "TRANSFER_IN_PROGRESS" && currentDepartment === "IN_TRANSIT" && nextDepartment === "PRODUCTION")
            );
        }).length,
        running: rows.filter((row) => normalize(row.currentStage) === "PRODUCTION_IN_PROGRESS").length,
        blocked: rows.filter((row) =>
            !["PRODUCTION_COMPLETED", "CANCELLED", "PRODUCTION_IN_PROGRESS"].includes(normalize(row.currentStage)) &&
            row.readyToStartProduction !== true
        ).length,
    }), [rows]);

    const openAction = async (type, row) => {
        setWorkingId(String(row.requisitionId));
        setError("");
        try {
            const response = await matflowApi.getRequisitionPlanning(row.requisitionId);
            const snapshot = response?.data || null;
            setPlanning(snapshot);

            const lineList = snapshot?.requisition?.lines || [];
            const quantities = {};
            const batches = {};
            lineList.forEach((line) => {
                const provisionalOutstanding = Math.max(
                    0,
                    numeric(line.issuedQty) - numeric(line.consumedQty) - numeric(line.returnedQty)
                );
                quantities[String(line.id)] = provisionalOutstanding > .0005 ? String(provisionalOutstanding) : "";
                batches[String(line.id)] = "";
            });
            setForm({ quantities, batches, remarks: "" });
            setDialog({ type, row });
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to load Production material detail."));
        } finally {
            setWorkingId("");
        }
    };

    const receiveOne = async (reservation) => {
        if (!reservation?.id || reservation.rowVersion == null) return;
        setWorkingId(String(reservation.id));
        setError("");
        try {
            await matflowApi.receiveProductionMaterial(reservation.id, {
                rowVersion: reservation.rowVersion,
                batchNo: null,
                remarks: clean(form.remarks) || "Production received material in MatFlow.",
            });
            const response = await matflowApi.getRequisitionPlanning(dialog.row.requisitionId);
            setPlanning(response?.data || null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to receive material."));
        } finally {
            setWorkingId("");
        }
    };

    const startProduction = async (row) => {
        const requisition = planning?.requisition;
        if (!requisition?.id || requisition.rowVersion == null) return;
        setWorkingId(String(requisition.id));
        setError("");
        try {
            await matflowApi.startProduction(requisition.id, {
                rowVersion: requisition.rowVersion,
                remarks: clean(form.remarks) || "Production started.",
            });
            setDialog(null);
            setPlanning(null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to start Production."));
        } finally {
            setWorkingId("");
        }
    };

    const recordConsumption = async () => {
        const requisition = planning?.requisition;
        if (!requisition?.id) return;

        const lines = (requisition.lines || []).map((line) => ({
            requisitionLineId: line.id,
            quantity: Number(form.quantities[String(line.id)] || 0),
            batchNo: clean(form.batches[String(line.id)]) || null,
            remarks: null,
        })).filter((line) => Number.isFinite(line.quantity) && line.quantity > .0005);

        if (!lines.length) {
            setError("Enter at least one consumption quantity.");
            return;
        }

        setWorkingId(String(requisition.id));
        setError("");
        try {
            await matflowApi.createConsumption({
                requisitionId: requisition.id,
                productionLocationId: requisition.destinationLocationId,
                remarks: clean(form.remarks) || null,
                lines,
            });
            setDialog(null);
            setPlanning(null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to record Production consumption."));
        } finally {
            setWorkingId("");
        }
    };

    const recordWaste = async () => {
        const requisition = planning?.requisition;
        if (!requisition?.id) return;

        const lines = (requisition.lines || []).map((line) => ({
            requisitionLineId: line.id,
            wastedQty: Number(form.quantities[String(line.id)] || 0),
            batchNo: clean(form.batches[String(line.id)]) || null,
            remarks: null,
        })).filter((line) => Number.isFinite(line.wastedQty) && line.wastedQty > .0005);

        if (!lines.length) {
            setError("Enter at least one Production wastage quantity.");
            return;
        }

        setWorkingId(String(requisition.id));
        setError("");
        try {
            await matflowApi.recordProductionWaste({
                requisitionId: requisition.id,
                productionLocationId: requisition.destinationLocationId,
                remarks: clean(form.remarks) || null,
                lines,
            });
            setDialog(null);
            setPlanning(null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to record Production wastage."));
        } finally {
            setWorkingId("");
        }
    };

    const completeProduction = async () => {
        const requisition = planning?.requisition;
        if (!requisition?.id || requisition.rowVersion == null) return;
        setWorkingId(String(requisition.id));
        setError("");
        try {
            await matflowApi.completeProduction(requisition.id, {
                rowVersion: requisition.rowVersion,
                remarks: clean(form.remarks) || "Production completed.",
            });
            setDialog(null);
            setPlanning(null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(
                requestError,
                "Production can be completed only when every issued quantity is fully accounted as consumed, wasted or returned."
            ));
        } finally {
            setWorkingId("");
        }
    };

    const pagination = useMatFlowPagination(rows, 20);
    const receivingReservations = (planning?.reservations || []).filter((reservation) =>
        normalize(reservation.nextAction) === "RECEIVE_MATERIAL" ||
        (
            normalize(reservation.responsibleDepartment) === "PRODUCTION" &&
            !["ISSUED", "RELEASED", "CANCELLED"].includes(normalize(reservation.status))
        )
    );

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="PRODUCTION EXECUTION"
                title="Product Material Readiness & Execution"
                subtitle="See each Project/Product’s material location and readiness, explicitly receive arriving lots, start Production, record consumption/wastage/returns, and complete only after full material accounting."
                actions={
                    <>
                        <Button startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMatFlowExcel({ fileName: "MatFlow_Production_Readiness", sheetName: "Readiness", title: "MatFlow Production Readiness", rows })} sx={secondaryBtnSx}>Export Excel</Button>
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                    </>
                }
            />

            <ErrorBox>{error}</ErrorBox>

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 1 }}>
                <SummaryCard label="Ready to Start" value={counts.ready} />
                <SummaryCard label="Awaiting / Receiving Material" value={counts.receiving} />
                <SummaryCard label="Production Running" value={counts.running} />
                <SummaryCard label="Blocked Before Start" value={counts.blocked} />
            </Box>

            <Card sx={{ ...panelSx, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <TextField
                    label="Search PD No. / Product / MR / Material State"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    sx={{ ...fieldSx, minWidth: 360, flex: "1 1 360px" }}
                />
                <MatFlowViewToggle value={viewMode} onChange={setViewMode} options={[{ value: "KANBAN", label: "Workflow Board" }, { value: "TABLE", label: "Table" }]} />
            </Card>

            <Card sx={panelSx}>
                {loading ? <LoadingBlock /> : viewMode === "KANBAN" ? (
                    <MatFlowKanbanBoard
                        columns={PRODUCTION_KANBAN_COLUMNS}
                        items={rows}
                        laneFor={productionKanbanLane}
                        minColumnWidth={295}
                        renderCard={(row) => {
                            const stage = normalize(row.currentStage);
                            const canStart = row.readyToStartProduction === true;
                            const isRunning = stage === "PRODUCTION_IN_PROGRESS";
                            const isComplete = stage === "PRODUCTION_COMPLETED";
                            const receiveLikely = productionReceiveLikely(row);
                            return (
                                <Card sx={{ ...panelSx, m: 0, p: 1.1, boxShadow: "none" }}>
                                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: .6, alignItems: "flex-start" }}>
                                        <Box sx={{ minWidth: 0 }}><Typography sx={{ ...mainTextSx, fontSize: 12.5 }}>{row.projectCode || "-"} · {row.productName || "-"}</Typography><Typography sx={subTextSx}>{row.requisitionNumber || "-"} · {row.destinationPlantCode || "-"}</Typography></Box>
                                        <MatFlowStatusChip status={row.currentStage} />
                                    </Box>
                                    <Typography sx={{ ...subTextSx, mt: .7 }}>Location: {row.currentLocationCode || "-"} · Ready {Math.round(numeric(row.materialReadyPercent))}%</Typography>
                                    <Typography sx={subTextSx}>{readable(row.productionStartBlocker || row.currentStage)}</Typography>
                                    <Box sx={{ display: "flex", gap: .45, mt: .85, flexWrap: "wrap" }}>
                                        {canAct && receiveLikely && <Button onClick={() => openAction("RECEIVE", row)} sx={primaryBtnSx}>Receive</Button>}
                                        {canAct && canStart && !isRunning && !isComplete && <Button onClick={() => openAction("START", row)} sx={primaryBtnSx}>Start</Button>}
                                        {canAct && isRunning && <Button onClick={() => openAction("CONSUME", row)} sx={primaryBtnSx}>Consume</Button>}
                                        {canAct && isRunning && <Button onClick={() => openAction("WASTE", row)} sx={secondaryBtnSx}>Waste</Button>}
                                        {canAct && isRunning && <Button onClick={() => navigate("/matflow/returns")} sx={secondaryBtnSx}>Return</Button>}
                                        {canAct && isRunning && <Button onClick={() => openAction("COMPLETE", row)} sx={secondaryBtnSx}>Complete</Button>}
                                        {!isComplete && <Button onClick={() => navigate(`/matflow/tracker/${row.requisitionId}`)} sx={secondaryBtnSx}>Trace</Button>}
                                    </Box>
                                </Card>
                            );
                        }}
                    />
                ) : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "200px 190px 170px 150px 100px 210px 210px" }}>
                            {["PD No. / Product", "MR", "Current Material State", "Current Location", "Ready", "Production Start Blocker", "Action"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {pagination.pageItems.length === 0 ? <EmptyState /> : pagination.pageItems.map((row) => {
                            const stage = normalize(row.currentStage);
                            const canStart = row.readyToStartProduction === true;
                            const isRunning = stage === "PRODUCTION_IN_PROGRESS";
                            const isComplete = stage === "PRODUCTION_COMPLETED";
                            const receiveLikely = !canStart && (
                                stage === "PRODUCTION_ISSUE" ||
                                (stage === "TRANSFER_IN_PROGRESS" &&
                                    normalize(row.currentDepartment) === "IN_TRANSIT" &&
                                    normalize(row.nextDepartment) === "PRODUCTION")
                            );

                            return (
                                <Box key={row.requisitionId} sx={{ ...tableRowSx, gridTemplateColumns: "200px 190px 170px 150px 100px 210px 210px" }}>
                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>{row.projectCode || "-"} · {row.productName || "-"}</Typography>
                                        <Typography sx={subTextSx}>{row.clientName || "-"} · {row.drawingNo || "-"}</Typography>
                                    </Box>
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.requisitionNumber || "-"}</Typography><Typography sx={subTextSx}>{readable(row.requisitionStatus)}</Typography></Box>
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{readable(row.currentDepartment || row.responsibleDesk)}</Typography><Typography sx={subTextSx}>{readable(row.currentStage)}</Typography></Box>
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.currentLocationCode || "-"}</Typography><Typography sx={subTextSx}>{row.currentLocationName || "-"}</Typography></Box>
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{Math.round(numeric(row.materialReadyPercent))}%</Typography><Typography sx={subTextSx}>{row.readyToStartProduction ? "Ready" : "Not ready"}</Typography></Box>
                                    <Box sx={tableCellSx}>
                                        {isComplete ? <MatFlowStatusChip status="COMPLETED" /> : canStart ? <MatFlowStatusChip status="READY_TO_START" /> : <Typography sx={subTextSx}>{readable(row.productionStartBlocker || row.currentStage)}</Typography>}
                                    </Box>
                                    <Box sx={{ ...tableCellSx, display: "flex", gap: .5, flexWrap: "wrap" }}>
                                        {canAct && receiveLikely && <Button onClick={() => openAction("RECEIVE", row)} sx={primaryBtnSx}>Receive Material</Button>}
                                        {canAct && canStart && <Button onClick={() => openAction("START", row)} sx={primaryBtnSx}>Start Production</Button>}
                                        {canAct && isRunning && (
                                            <>
                                                <Button onClick={() => openAction("CONSUME", row)} sx={primaryBtnSx}>Consume</Button>
                                                <Button onClick={() => openAction("WASTE", row)} sx={secondaryBtnSx}>Waste</Button>
                                                <Button onClick={() => navigate("/matflow/returns")} sx={secondaryBtnSx}>Return</Button>
                                                <Button onClick={() => openAction("COMPLETE", row)} sx={secondaryBtnSx}>Complete</Button>
                                            </>
                                        )}
                                        {!isComplete && <Button onClick={() => navigate(`/matflow/tracker/${row.requisitionId}`)} sx={secondaryBtnSx}>Track</Button>}
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                )}
                {!loading && viewMode === "TABLE" && <MatFlowPagination {...pagination} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} label="Production Readiness" />}
            </Card>

            <Dialog open={Boolean(dialog)} onClose={() => { if (!workingId) { setDialog(null); setPlanning(null); } }} fullWidth maxWidth="md" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>
                    {dialog?.type === "RECEIVE" ? "Receive Arriving Material"
                        : dialog?.type === "START" ? "Start Production"
                            : dialog?.type === "CONSUME" ? "Record Material Consumption"
                                : dialog?.type === "WASTE" ? "Record Production Wastage"
                                    : "Complete Production"}
                </DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    {!planning ? <LoadingBlock /> : (
                        <>
                            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 1, mb: 1.5 }}>
                                <Detail label="MR" value={planning.requisition?.requisitionNumber || "-"} />
                                <Detail label="Project" value={planning.requisition?.projectCode || "-"} />
                                <Detail label="Drawing" value={planning.requisition?.drawingNo || "-"} />
                                <Detail label="Production Location" value={planning.requisition?.destinationLocationCode || "-"} />
                            </Box>

                            {dialog?.type === "RECEIVE" && (
                                <>
                                    <Alert severity="info" sx={{ mb: 1.2 }}>Production acknowledges each lot actually sent by Store or Processing. QC is only a check gate and does not physically send material.</Alert>
                                    {receivingReservations.length === 0 ? <EmptyState>No material lot is currently waiting for Production receipt.</EmptyState> : receivingReservations.map((reservation) => (
                                        <Box key={reservation.id} sx={{ p: 1, mb: .8, border: "1px solid var(--mf-border)", borderRadius: 2, display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center" }}>
                                            <Box>
                                                <Typography sx={mainTextSx}>{reservation.materialCode} · {formatQty(reservation.reservedQty)}</Typography>
                                                <Typography sx={subTextSx}>From route destination {reservation.firstDestinationLocationCode || "-"} · {readable(reservation.nextAction)}</Typography>
                                            </Box>
                                            <Button onClick={() => receiveOne(reservation)} disabled={Boolean(workingId)} sx={primaryBtnSx}>
                                                {workingId === String(reservation.id) ? "Receiving..." : "Receive"}
                                            </Button>
                                        </Box>
                                    ))}
                                </>
                            )}

                            {dialog?.type === "START" && (
                                <Alert severity="success">All requested material has reached Production and is issued to this MR. Production can now start.</Alert>
                            )}

                            {["CONSUME", "WASTE"].includes(dialog?.type) && (
                                <>
                                    <Alert severity="info" sx={{ mb: 1.2 }}>
                                        Enter only the quantity being {dialog.type === "CONSUME" ? "consumed" : "wasted"} now. The backend validates against the remaining issued quantity, including prior Production wastage.
                                    </Alert>
                                    <Box sx={tableShellSx}>
                                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "220px 110px 110px 110px 150px 150px" }}>
                                            {["Material", "Issued", "Consumed", "Returned", dialog.type === "CONSUME" ? "Consume Qty" : "Waste Qty", "Batch"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                                        </Box>
                                        {(planning.requisition?.lines || []).map((line) => (
                                            <Box key={line.id} sx={{ ...tableRowSx, gridTemplateColumns: "220px 110px 110px 110px 150px 150px" }}>
                                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{line.issuedMaterialName || line.materialName}</Typography><Typography sx={subTextSx}>{line.issuedMaterialCode || line.materialCode} · {line.uom}</Typography></Box>
                                                <Box sx={tableCellSx}>{formatQty(line.issuedQty)}</Box>
                                                <Box sx={tableCellSx}>{formatQty(line.consumedQty)}</Box>
                                                <Box sx={tableCellSx}>{formatQty(line.returnedQty)}</Box>
                                                <Box sx={tableCellSx}><TextField type="number" size="small" value={form.quantities[String(line.id)] || ""} onChange={(e) => setForm((c) => ({ ...c, quantities: { ...c.quantities, [String(line.id)]: e.target.value } }))} sx={fieldSx} /></Box>
                                                <Box sx={tableCellSx}><TextField size="small" value={form.batches[String(line.id)] || ""} onChange={(e) => setForm((c) => ({ ...c, batches: { ...c.batches, [String(line.id)]: e.target.value } }))} sx={fieldSx} /></Box>
                                            </Box>
                                        ))}
                                    </Box>
                                </>
                            )}

                            {dialog?.type === "COMPLETE" && (
                                <Alert severity="warning">
                                    Completion succeeds only when every requested quantity has been issued and every issued quantity is fully accounted as consumed + Production wasted + returned.
                                </Alert>
                            )}

                            <TextField
                                multiline
                                minRows={2}
                                label="Remarks"
                                value={form.remarks}
                                onChange={(e) => setForm((c) => ({ ...c, remarks: e.target.value }))}
                                sx={{ ...fieldSx, mt: 1.5 }}
                                fullWidth
                            />
                        </>
                    )}
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => { setDialog(null); setPlanning(null); }} disabled={Boolean(workingId)} sx={secondaryBtnSx}>Close</Button>
                    {dialog?.type === "START" && planning && <Button onClick={() => startProduction(dialog.row)} disabled={Boolean(workingId)} sx={primaryBtnSx}>Start Production</Button>}
                    {dialog?.type === "CONSUME" && planning && <Button onClick={recordConsumption} disabled={Boolean(workingId)} sx={primaryBtnSx}>Record Consumption</Button>}
                    {dialog?.type === "WASTE" && planning && <Button onClick={recordWaste} disabled={Boolean(workingId)} sx={primaryBtnSx}>Record Wastage</Button>}
                    {dialog?.type === "COMPLETE" && planning && <Button onClick={completeProduction} disabled={Boolean(workingId)} sx={primaryBtnSx}>Mark Production Complete</Button>}
                </DialogActions>
            </Dialog>
        </Box>
    );
}
