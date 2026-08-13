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
    MatFlowPagination,
    MatFlowStatusChip,
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
    const [routingRows, setRoutingRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [status, setStatus] = useState("");
    const [dialog, setDialog] = useState(null);
    const [form, setForm] = useState({
        acceptedQty: "",
        rejectedQty: "",
        routingDecision: "DIRECT_TO_PRODUCTION",
        processingRouteStepId: "",
        remarks: "",
    });

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [inspectionResponse, routingResponse] = await Promise.all([
                matflowApi.listQcInspections({ status: status || undefined }),
                matflowApi.listQcRouting(),
            ]);
            setRows(Array.isArray(inspectionResponse?.data) ? inspectionResponse.data : []);
            setRoutingRows(Array.isArray(routingResponse?.data) ? routingResponse.data : []);
        } catch (requestError) {
            setRows([]);
            setRoutingRows([]);
            setError(readMatFlowError(requestError, "Unable to load QC work queue."));
        } finally {
            setLoading(false);
        }
    }, [status]);

    useEffect(() => { load(); }, [load]);

    const routingByInspection = useMemo(
        () => new Map(routingRows.map((row) => [String(row.inspectionId), row])),
        [routingRows]
    );

    const counts = useMemo(() => ({
        pending: rows.filter((row) => normalize(row.status) === "PENDING").length,
        route: routingRows.filter((row) => row.routingRequired === true && row.routingComplete !== true).length,
        processing: routingRows.filter((row) => normalize(row.routingDecision) === "SEND_TO_PROCESSING").length,
        direct: routingRows.filter((row) => normalize(row.routingDecision) === "DIRECT_TO_PRODUCTION").length,
    }), [rows, routingRows]);

    const openInspection = (row) => {
        setDialog({ type: "INSPECT", row });
        setForm({
            acceptedQty: String(row.inspectionQty ?? 0),
            rejectedQty: "0",
            routingDecision: "DIRECT_TO_PRODUCTION",
            processingRouteStepId: "",
            remarks: "",
        });
        setError("");
    };

    const openRoute = async (row) => {
        setWorking(true);
        setError("");
        try {
            const response = await matflowApi.getQcRouting(row.id);
            const routing = response?.data;
            if (!routing?.routingRequired) {
                throw new Error("This accepted quantity is not tied to an active Project/Product reservation.");
            }
            if (routing.routingComplete) {
                throw new Error(`Routing is already completed as ${readable(routing.routingDecision)}.`);
            }
            setDialog({ type: "ROUTE", row, routing });
            setForm({
                acceptedQty: "",
                rejectedQty: "",
                routingDecision: "DIRECT_TO_PRODUCTION",
                processingRouteStepId: "",
                remarks: "",
            });
        } catch (requestError) {
            setError(readMatFlowError(requestError, requestError?.message || "Unable to open QC routing."));
        } finally {
            setWorking(false);
        }
    };

    const execute = async () => {
        const row = dialog?.row;
        if (!row) return;

        setWorking(true);
        setError("");
        try {
            if (dialog.type === "INSPECT") {
                const acceptedQty = Number(form.acceptedQty);
                const rejectedQty = Number(form.rejectedQty);
                if (
                    !Number.isFinite(acceptedQty) || acceptedQty < 0 ||
                    !Number.isFinite(rejectedQty) || rejectedQty < 0 ||
                    Math.abs(acceptedQty + rejectedQty - numeric(row.inspectionQty)) > .0005
                ) {
                    throw new Error("Accepted + Rejected must exactly equal the inspection quantity.");
                }
                await matflowApi.decideQc(row.id, {
                    rowVersion: row.rowVersion,
                    acceptedQty,
                    rejectedQty,
                    remarks: clean(form.remarks) || null,
                });
            } else {
                const routing = dialog.routing;
                const decision = normalize(form.routingDecision);
                if (!["DIRECT_TO_PRODUCTION", "SEND_TO_PROCESSING"].includes(decision)) {
                    throw new Error("Choose Direct to Production or Send to Processing.");
                }
                if (decision === "SEND_TO_PROCESSING" && !form.processingRouteStepId) {
                    throw new Error("Select one approved Processing Unit.");
                }
                await matflowApi.routeQcMaterial(row.id, {
                    rowVersion: routing.rowVersion,
                    routingDecision: decision,
                    processingRouteStepId: decision === "SEND_TO_PROCESSING" ? form.processingRouteStepId : null,
                    remarks: clean(form.remarks) || null,
                });
            }

            setDialog(null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, requestError?.message || "Unable to complete QC action."));
        } finally {
            setWorking(false);
        }
    };

    const pagination = useMatFlowPagination(rows, 20);

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="QUALITY CONTROL"
                title="QC Material Gate"
                subtitle="Only Store-routed QC-required lots appear here. QC first records quality, then accepted Project/Product material is routed Direct to Production or to one approved Processing Unit."
                actions={
                    <>
                        <Button startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMatFlowExcel({ fileName: "MatFlow_QC", sheetName: "QC", title: "MatFlow QC Register", rows })} sx={secondaryBtnSx}>Export Excel</Button>
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                    </>
                }
            />
            <ErrorBox>{error}</ErrorBox>

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 1 }}>
                <SummaryCard label="Pending Inspection" value={counts.pending} />
                <SummaryCard label="Awaiting Route" value={counts.route} />
                <SummaryCard label="Direct Production" value={counts.direct} />
                <SummaryCard label="Sent to Processing" value={counts.processing} />
            </Box>

            <Card sx={panelSx}>
                <TextField select label="QC Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ ...fieldSx, minWidth: 220 }}>
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="PENDING">Pending</MenuItem>
                    <MenuItem value="COMPLETED">Completed</MenuItem>
                </TextField>
            </Card>

            <Card sx={panelSx}>
                {loading ? <LoadingBlock /> : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "165px 190px 150px 90px 90px 90px 140px minmax(230px,1fr)" }}>
                            {["Inspection", "Material", "QC Location", "Qty", "Accepted", "Rejected", "Status", "Action / Route"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {pagination.pageItems.length === 0 ? <EmptyState /> : pagination.pageItems.map((row) => {
                            const routing = routingByInspection.get(String(row.id));
                            const pending = normalize(row.status) === "PENDING";
                            const accepted = numeric(row.acceptedQty) > .0005;
                            const routeWaiting = !pending && accepted && routing?.routingRequired === true && routing?.routingComplete !== true;

                            return (
                                <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "165px 190px 150px 90px 90px 90px 140px minmax(230px,1fr)" }}>
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.inspectionNumber}</Typography><Typography sx={subTextSx}>{readable(row.sourceType)}</Typography></Box>
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialName}</Typography><Typography sx={subTextSx}>{row.materialCode}</Typography></Box>
                                    <Box sx={tableCellSx}>{row.locationCode || "-"}</Box>
                                    <Box sx={tableCellSx}>{formatQty(row.inspectionQty)}</Box>
                                    <Box sx={tableCellSx}>{formatQty(row.acceptedQty)}</Box>
                                    <Box sx={tableCellSx}>{formatQty(row.rejectedQty)}</Box>
                                    <Box sx={tableCellSx}><MatFlowStatusChip status={row.status} /></Box>
                                    <Box sx={{ ...tableCellSx, display: "flex", gap: .6, flexWrap: "wrap" }}>
                                        {canAct && pending && <Button onClick={() => openInspection(row)} sx={primaryBtnSx}>Inspect</Button>}
                                        {canAct && routeWaiting && <Button onClick={() => openRoute(row)} sx={primaryBtnSx}>Choose Route</Button>}
                                        {routing?.routingComplete && (
                                            <Typography sx={subTextSx}>
                                                {readable(routing.routingDecision)}
                                                {routing.selectedProcessingRouteStepId ? " · Processing selected" : ""}
                                                {routing.routedBy ? ` · by ${routing.routedBy}` : ""}
                                            </Typography>
                                        )}
                                        {!pending && accepted && routing?.routingRequired === false && (
                                            <Typography sx={subTextSx}>Accepted free stock; no Project route action.</Typography>
                                        )}
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                )}
                {!loading && <MatFlowPagination {...pagination} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} label="QC Inspections" />}
            </Card>

            <Dialog open={Boolean(dialog)} onClose={() => !working && setDialog(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>{dialog?.type === "INSPECT" ? "QC Quality Decision" : "Post-QC Route"}</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    {dialog?.type === "INSPECT" ? (
                        <Box sx={{ display: "grid", gap: 1.5 }}>
                            <Alert severity="info">Quality decision and route decision are separate. Processing is never automatically selected.</Alert>
                            <TextField type="number" label="Accepted Qty *" value={form.acceptedQty} onChange={(e) => setForm((c) => ({ ...c, acceptedQty: e.target.value }))} sx={fieldSx} />
                            <TextField type="number" label="Rejected Qty *" value={form.rejectedQty} onChange={(e) => setForm((c) => ({ ...c, rejectedQty: e.target.value }))} sx={fieldSx} />
                            <TextField multiline minRows={2} label="Remarks" value={form.remarks} onChange={(e) => setForm((c) => ({ ...c, remarks: e.target.value }))} sx={fieldSx} />
                        </Box>
                    ) : (
                        <Box sx={{ display: "grid", gap: 1.5 }}>
                            <TextField select label="Accepted Material Route *" value={form.routingDecision} onChange={(e) => setForm((c) => ({ ...c, routingDecision: e.target.value, processingRouteStepId: "" }))} sx={fieldSx}>
                                <MenuItem value="DIRECT_TO_PRODUCTION">Direct to Production</MenuItem>
                                <MenuItem value="SEND_TO_PROCESSING">Send to Processing</MenuItem>
                            </TextField>
                            {normalize(form.routingDecision) === "SEND_TO_PROCESSING" && (
                                <TextField select label="Approved Processing Unit *" value={form.processingRouteStepId} onChange={(e) => setForm((c) => ({ ...c, processingRouteStepId: e.target.value }))} sx={fieldSx}>
                                    {(dialog?.routing?.processingOptions || []).map((option) => (
                                        <MenuItem key={option.routeStepId} value={option.routeStepId}>
                                            {option.locationCode} · {option.locationName} · {option.processCode}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            )}
                            <TextField multiline minRows={2} label="Routing Remarks" value={form.remarks} onChange={(e) => setForm((c) => ({ ...c, remarks: e.target.value }))} sx={fieldSx} />
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setDialog(null)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
                    <Button onClick={execute} disabled={working} sx={primaryBtnSx}>{working ? "Saving..." : "Confirm"}</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export function MatFlowProcessingPage() {
    const { hasRole, selectedPlantParam } = useMatFlow();
    const canAct = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PROCESSING);

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
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
                subtitle="Only QC-routed material appears here. The Processor starts the queued job, records output and wastage, then completion automatically releases the material toward Production."
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

            <Card sx={panelSx}>
                {loading ? <LoadingBlock /> : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "165px 165px 170px 170px 110px 110px 130px 170px" }}>
                            {["Job", "MR", "Processing Unit", "Input Material", "Planned", "Output / Waste", "Status", "Action"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {pagination.pageItems.length === 0 ? <EmptyState>No QC-routed Processing jobs.</EmptyState> : pagination.pageItems.map((job) => {
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
                {!loading && <MatFlowPagination {...pagination} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} label="Processing Jobs" />}
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

            <Card sx={panelSx}>
                <TextField
                    label="Search Project / Product / MR / Material State"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    sx={{ ...fieldSx, minWidth: 360 }}
                />
            </Card>

            <Card sx={panelSx}>
                {loading ? <LoadingBlock /> : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "200px 190px 170px 150px 100px 210px 210px" }}>
                            {["Project / Product", "MR", "Current Material State", "Current Location", "Ready", "Production Start Blocker", "Action"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
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
                {!loading && <MatFlowPagination {...pagination} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} label="Production Readiness" />}
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
                                    <Alert severity="info" sx={{ mb: 1.2 }}>Production acknowledges each lot actually sent by Store, QC or Processing. There is no generic Transfer receipt desk.</Alert>
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
