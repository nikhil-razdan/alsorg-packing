import { useCallback, useEffect, useMemo, useState } from "react";
import {
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
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import PrecisionManufacturingOutlinedIcon from "@mui/icons-material/PrecisionManufacturingOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import { MATFLOW_ROLES, useMatFlow } from "../matflowUi";
import { matflowApi, readMatFlowError } from "../api/matflowApi";
import {
    EmptyState,
    ErrorBox,
    LoadingBlock,
    MatFlowStatusChip,
    PageHero,
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
} from "../matflowUi";

export function MatFlowQcPage() {
    const { hasRole } = useMatFlow();
    const canQcWrite = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.QC);
    const canVendorReturn = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.STORE, MATFLOW_ROLES.PURCHASE);
    const [rows, setRows] = useState([]);
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [status, setStatus] = useState("");
    const [dialog, setDialog] = useState(null);
    const [form, setForm] = useState({ acceptedQty: "", rejectedQty: "", remarks: "", dispositionType: "HOLD", quantity: "", targetLocationId: "" });

    const load = useCallback(async () => {
        setLoading(true); setError("");
        try {
            const [q, l] = await Promise.all([matflowApi.listQcInspections({ status: status || undefined }), matflowApi.listLocations({ active: true })]);
            setRows(Array.isArray(q?.data) ? q.data : []); setLocations(Array.isArray(l?.data) ? l.data : []);
        } catch (requestError) { setError(readMatFlowError(requestError, "Unable to load QC inspections.")); }
        finally { setLoading(false); }
    }, [status]);
    useEffect(() => { load(); }, [load]);

    const openDecision = (row) => {
        setDialog({ type: "DECISION", row }); setForm({ acceptedQty: String(row.inspectionQty ?? 0), rejectedQty: "0", remarks: "", dispositionType: "HOLD", quantity: "", targetLocationId: "" }); setError("");
    };
    const openDisposition = (row) => {
        setDialog({ type: "DISPOSITION", row }); setForm({ acceptedQty: "", rejectedQty: "", remarks: "", dispositionType: "HOLD", quantity: String(row.rejectedQty ?? 0), targetLocationId: "" }); setError("");
    };
    const execute = async () => {
        const row = dialog?.row; if (!row) return;
        setWorking(true); setError("");
        try {
            if (dialog.type === "DECISION") {
                const acceptedQty = Number(form.acceptedQty), rejectedQty = Number(form.rejectedQty);
                if (!Number.isFinite(acceptedQty) || acceptedQty < 0 || !Number.isFinite(rejectedQty) || rejectedQty < 0 || Math.abs((acceptedQty + rejectedQty) - numeric(row.inspectionQty)) > .0005) {
                    throw new Error("Accepted + rejected quantity must exactly equal the inspection quantity.");
                }
                await matflowApi.decideQc(row.id, { rowVersion: row.rowVersion, acceptedQty, rejectedQty, remarks: clean(form.remarks) || null });
            } else if (dialog.type === "VENDOR_RETURN") {
                const returnQty = Number(form.quantity);
                if (!Number.isFinite(returnQty) || returnQty <= 0) throw new Error("Return quantity must be greater than zero.");
                await matflowApi.returnQcToVendor(row.id, { rowVersion: row.rowVersion, returnQty, remarks: clean(form.remarks) || null });
            } else {
                const quantity = Number(form.quantity);
                if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Disposition quantity must be greater than zero.");
                await matflowApi.decideQcDisposition(row.id, { rowVersion: row.rowVersion, dispositionType: form.dispositionType, quantity, targetLocationId: form.targetLocationId || null, remarks: clean(form.remarks) || null });
            }
            setDialog(null); await load();
        } catch (requestError) { setError(readMatFlowError(requestError, requestError?.message || "Unable to complete QC action.")); }
        finally { setWorking(false); }
    };

    return <Box sx={pageSx}>
        <PageHero badge="QUALITY CONTROL" title="Material QC" subtitle="Inspect GRN and transfer receipts before accepted quantity can continue through MatFlow." actions={<Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>} />
        <ErrorBox>{error}</ErrorBox>
        <Card sx={panelSx}><TextField select label="QC Status" value={status} onChange={e => setStatus(e.target.value)} sx={{ ...fieldSx, minWidth: 220 }}><MenuItem value="">All</MenuItem><MenuItem value="PENDING">Pending</MenuItem><MenuItem value="COMPLETED">Completed</MenuItem></TextField></Card>
        <Card sx={panelSx}>{loading ? <LoadingBlock /> : <Box sx={tableShellSx}><Box sx={{ ...tableHeaderSx, gridTemplateColumns: "160px 140px 190px 150px 110px 100px 100px 150px 180px" }}>{["Inspection", "Source", "Material", "Location", "Qty", "Accepted", "Rejected", "Status", "Action"].map(h => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>{rows.length === 0 ? <EmptyState /> : rows.map(row => <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "160px 140px 190px 150px 110px 100px 100px 150px 180px" }}><Box sx={tableCellSx}>{row.inspectionNumber}</Box><Box sx={tableCellSx}>{readable(row.sourceType)}</Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialCode}</Typography><Typography sx={subTextSx}>{row.materialName}</Typography></Box><Box sx={tableCellSx}>{row.locationCode}</Box><Box sx={tableCellSx}>{formatQty(row.inspectionQty)}</Box><Box sx={tableCellSx}>{formatQty(row.acceptedQty)}</Box><Box sx={tableCellSx}>{formatQty(row.rejectedQty)}</Box><Box sx={tableCellSx}><MatFlowStatusChip status={row.status} /></Box><Box sx={{ ...tableCellSx, display: "flex", gap: .5, flexWrap: "wrap" }}>{canQcWrite && normalize(row.status) === "PENDING" && <Button onClick={() => openDecision(row)} sx={primaryBtnSx}>Decide</Button>}{canQcWrite && normalize(row.status) === "COMPLETED" && numeric(row.rejectedQty) > 0 && normalize(row.sourceType) === "TRANSFER_RECEIPT" && <Button onClick={() => openDisposition(row)} sx={secondaryBtnSx}>Disposition</Button>}{canVendorReturn && normalize(row.status) === "COMPLETED" && numeric(row.rejectedQty) > 0 && normalize(row.sourceType) === "GOODS_RECEIPT" && <Button onClick={() => { setDialog({ type: "VENDOR_RETURN", row }); setForm(f => ({ ...f, quantity: String(row.rejectedQty ?? 0), remarks: "" })); }} sx={secondaryBtnSx}>Vendor Return</Button>}</Box></Box>)}</Box>}</Card>
        <Dialog open={Boolean(dialog)} onClose={() => !working && setDialog(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}><DialogTitle sx={dialogTitleSx}>{dialog?.type === "DECISION" ? "QC Decision" : dialog?.type === "VENDOR_RETURN" ? "Return Rejected Material to Vendor" : "Rejected Material Disposition"}</DialogTitle><DialogContent sx={dialogContentSx}><Box sx={{ display: "grid", gap: 1.5 }}>{dialog?.type === "DECISION" ? <><TextField type="number" label="Accepted Qty" value={form.acceptedQty} onChange={e => setForm(c => ({ ...c, acceptedQty: e.target.value }))} sx={fieldSx} /><TextField type="number" label="Rejected Qty" value={form.rejectedQty} onChange={e => setForm(c => ({ ...c, rejectedQty: e.target.value }))} sx={fieldSx} /></> : dialog?.type === "DISPOSITION" ? <><TextField select label="Disposition" value={form.dispositionType} onChange={e => setForm(c => ({ ...c, dispositionType: e.target.value }))} sx={fieldSx}>{["HOLD", "REWORK", "RETURN_TO_SOURCE", "SCRAP"].map(v => <MenuItem key={v} value={v}>{readable(v)}</MenuItem>)}</TextField><TextField type="number" label="Quantity" value={form.quantity} onChange={e => setForm(c => ({ ...c, quantity: e.target.value }))} sx={fieldSx} />{form.dispositionType === "REWORK" && <TextField select label="Rework Processing Location" value={form.targetLocationId} onChange={e => setForm(c => ({ ...c, targetLocationId: e.target.value }))} sx={fieldSx}>{locations.filter(l => ["PROCESSING", "EXTERNAL_PROCESSOR"].includes(normalize(l.locationType))).map(l => <MenuItem key={l.id} value={l.id}>{l.locationCode} · {l.plantCode} · {readable(l.locationType)}</MenuItem>)}</TextField>}</> : <TextField type="number" label="Return Qty" value={form.quantity} onChange={e => setForm(c => ({ ...c, quantity: e.target.value }))} sx={fieldSx} />}<TextField multiline minRows={2} label="Remarks" value={form.remarks} onChange={e => setForm(c => ({ ...c, remarks: e.target.value }))} sx={fieldSx} /></Box></DialogContent><DialogActions sx={dialogActionsSx}><Button onClick={() => setDialog(null)} sx={secondaryBtnSx}>Cancel</Button><Button onClick={execute} disabled={working} sx={primaryBtnSx}>Confirm</Button></DialogActions></Dialog>
    </Box>;
}

async function discoverProcessingCandidates(existingJobs = []) {
    const requisitionResponse = await matflowApi.listRequisitions();
    const requisitions = Array.isArray(requisitionResponse?.data) ? requisitionResponse.data : [];
    const snapshots = await Promise.all(requisitions.map(async (requisition) => {
        try { return (await matflowApi.getRequisitionPlanning(requisition.id))?.data; }
        catch { return null; }
    }));

    const routeCache = new Map();
    const candidates = [];
    const jobs = Array.isArray(existingJobs) ? existingJobs : [];

    for (const snapshot of snapshots.filter(Boolean)) {
        const requisition = snapshot.requisition;
        if (!requisition?.bomId) continue;

        if (!routeCache.has(String(requisition.bomId))) {
            try {
                const routeResponse = await matflowApi.listBomRoutes(requisition.bomId);
                routeCache.set(
                    String(requisition.bomId),
                    Array.isArray(routeResponse?.data) ? routeResponse.data : []
                );
            } catch {
                routeCache.set(String(requisition.bomId), []);
            }
        }

        const routes = routeCache.get(String(requisition.bomId));
        const transfers = Array.isArray(snapshot.transfers) ? snapshot.transfers : [];

        for (const reservation of (snapshot.reservations || [])) {
            if (normalize(reservation.status) !== "ACTIVE") continue;

            const line = (requisition.lines || []).find(
                (item) => String(item.id) === String(reservation.requisitionLineId)
            );
            if (!line?.bomLineId) continue;

            const lineRoute = routes
                .filter((step) => String(step.bomLineId) === String(line.bomLineId))
                .sort((a, b) => Number(a.sequenceNo || 0) - Number(b.sequenceNo || 0));

            const processingSteps = lineRoute.filter(
                (step) => normalize(step.stepType) === "PROCESSING"
            );

            for (const step of processingSteps) {
                const occupied = jobs.some((job) =>
                    String(job.reservationId) === String(reservation.id) &&
                    String(job.routeStepId) === String(step.id) &&
                    normalize(job.status) !== "CANCELLED"
                );
                if (occupied) continue;

                const earlierProcessingSteps = processingSteps.filter(
                    (candidateStep) => Number(candidateStep.sequenceNo || 0) < Number(step.sequenceNo || 0)
                );

                const earlierProcessingComplete = earlierProcessingSteps.every((earlierStep) =>
                    jobs.some((job) =>
                        String(job.reservationId) === String(reservation.id) &&
                        String(job.routeStepId) === String(earlierStep.id) &&
                        normalize(job.status) === "COMPLETED"
                    )
                );

                if (!earlierProcessingComplete) continue;

                const stepIndex = lineRoute.findIndex((candidateStep) => String(candidateStep.id) === String(step.id));
                const previousRouteStep = stepIndex > 0 ? lineRoute[stepIndex - 1] : null;

                const sameLocationPreviousProcessingComplete =
                    normalize(previousRouteStep?.stepType) === "PROCESSING" &&
                    String(previousRouteStep?.locationId || "") === String(step.locationId || "") &&
                    jobs.some((job) =>
                        String(job.reservationId) === String(reservation.id) &&
                        String(job.routeStepId) === String(previousRouteStep?.id) &&
                        normalize(job.status) === "COMPLETED"
                    );

                const inboundComplete = transfers.some((transfer) =>
                    String(transfer.reservationId) === String(reservation.id) &&
                    String(transfer.toLocationId) === String(step.locationId) &&
                    normalize(transfer.status) === "RECEIVED"
                );

                if (inboundComplete || sameLocationPreviousProcessingComplete) {
                    candidates.push({ reservation, step, requisition, line });
                }
            }
        }
    }

    return candidates;
}

export function MatFlowProcessingPage() {
    const [jobs, setJobs] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [dialog, setDialog] = useState(null);
    const [form, setForm] = useState({ candidateKey: "", plannedInputQty: "", outputMaterialId: "", actualInputQty: "", outputQty: "", wastageQty: "0", batchNo: "", remarks: "" });
    const load = useCallback(async () => {
        setLoading(true); setError("");
        try {
            const [jobResponse, materialResponse] = await Promise.all([
                matflowApi.listProcessingJobs(),
                matflowApi.listMaterials({ active: true }),
            ]);
            const jobRows = Array.isArray(jobResponse?.data) ? jobResponse.data : [];
            const materialRows = Array.isArray(materialResponse?.data) ? materialResponse.data : [];
            const discovered = await discoverProcessingCandidates(jobRows);
            setJobs(jobRows);
            setMaterials(materialRows.filter((material) => material?.active !== false));
            setCandidates(discovered);
        } catch (e) {
            setError(readMatFlowError(e, "Unable to load Processing workspace."));
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { load(); }, [load]);
    const candidate = candidates.find((c) => `${c.reservation.id}:${c.step.id}` === form.candidateKey);
    const create = async () => { if (!candidate) { setError("Select a reservation and approved processing route step."); return; } const plannedInputQty = Number(form.plannedInputQty || candidate.reservation.reservedQty); if (!Number.isFinite(plannedInputQty) || plannedInputQty <= 0) { setError("Planned input quantity must be greater than zero."); return; } setWorking(true); setError(""); try { await matflowApi.createProcessingJob({ reservationId: candidate.reservation.id, routeStepId: candidate.step.id, outputMaterialId: form.outputMaterialId || null, plannedInputQty, remarks: clean(form.remarks) || null }); setDialog(null); await load(); } catch (e) { setError(readMatFlowError(e, "Unable to create processing job.")); } finally { setWorking(false); } };
    const act = async (job, type) => { setDialog({ type, job }); setForm({ candidateKey: "", plannedInputQty: "", outputMaterialId: "", actualInputQty: String(job.plannedInputQty ?? ""), outputQty: String(job.actualInputQty ?? job.plannedInputQty ?? ""), wastageQty: "0", batchNo: "", remarks: "" }); };
    const execute = async () => { const job = dialog?.job; if (!job) return; setWorking(true); setError(""); try { if (dialog.type === "START") await matflowApi.startProcessingJob(job.id, { rowVersion: job.rowVersion, actualInputQty: Number(form.actualInputQty), batchNo: clean(form.batchNo) || null, remarks: clean(form.remarks) || null }); else await matflowApi.completeProcessingJob(job.id, { rowVersion: job.rowVersion, outputQty: Number(form.outputQty), wastageQty: Number(form.wastageQty || 0), batchNo: clean(form.batchNo) || null, remarks: clean(form.remarks) || null }); setDialog(null); await load(); } catch (e) { setError(readMatFlowError(e, "Unable to update processing job.")); } finally { setWorking(false); } };
    return <Box sx={pageSx}><PageHero badge="MATERIAL PROCESSING" title="Processing Jobs" subtitle="Convert reserved input material through the Engineering-approved processing route before Production issue." actions={<><Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button><Button startIcon={<AddIcon />} onClick={() => setDialog({ type: "CREATE" })} sx={primaryBtnSx}>Create Job</Button></>} /><ErrorBox>{error}</ErrorBox><Card sx={panelSx}>{loading ? <LoadingBlock /> : <Box sx={tableShellSx}><Box sx={{ ...tableHeaderSx, gridTemplateColumns: "160px 170px 150px 150px 110px 110px 150px 160px" }}>{["Job", "Requisition", "Process", "Material", "Input", "Output", "Status", "Action"].map(h => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>{jobs.length === 0 ? <EmptyState /> : jobs.map(job => <Box key={job.id} sx={{ ...tableRowSx, gridTemplateColumns: "160px 170px 150px 150px 110px 110px 150px 160px" }}><Box sx={tableCellSx}>{job.jobNumber}</Box><Box sx={tableCellSx}>{job.requisitionNumber}</Box><Box sx={tableCellSx}>{job.processCode || job.locationCode}</Box><Box sx={tableCellSx}>{job.inputMaterialCode} → {job.outputMaterialCode}</Box><Box sx={tableCellSx}>{formatQty(job.actualInputQty ?? job.plannedInputQty)}</Box><Box sx={tableCellSx}>{formatQty(job.outputQty)}</Box><Box sx={tableCellSx}><MatFlowStatusChip status={job.status} /></Box><Box sx={{ ...tableCellSx, display: "flex", gap: .5 }}>{normalize(job.status) === "PENDING" && <Button onClick={() => act(job, "START")} sx={primaryBtnSx}>Start</Button>}{normalize(job.status) === "IN_PROGRESS" && <Button onClick={() => act(job, "COMPLETE")} sx={primaryBtnSx}>Complete</Button>}</Box></Box>)}</Box>}</Card><Dialog open={Boolean(dialog)} onClose={() => !working && setDialog(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}><DialogTitle sx={dialogTitleSx}>{dialog?.type === "CREATE" ? "Create Processing Job" : dialog?.type === "START" ? "Start Processing Job" : "Complete Processing Job"}</DialogTitle><DialogContent sx={dialogContentSx}><Box sx={{ display: "grid", gap: 1.5 }}>{dialog?.type === "CREATE" ? <><TextField select label="Reservation / Route *" value={form.candidateKey} onChange={e => { const key = e.target.value; const found = candidates.find(c => `${c.reservation.id}:${c.step.id}` === key); setForm(c => ({ ...c, candidateKey: key, plannedInputQty: String(found?.reservation?.reservedQty ?? ""), outputMaterialId: "" })); }} sx={fieldSx}>{candidates.map(c => <MenuItem key={`${c.reservation.id}:${c.step.id}`} value={`${c.reservation.id}:${c.step.id}`}>{c.requisition.requisitionNumber} · {c.reservation.materialCode} · {c.step.locationCode} · {c.step.processCode}</MenuItem>)}</TextField><TextField type="number" label="Reserved Input Qty" value={form.plannedInputQty} disabled helperText="One processing job consumes the complete reserved lot for this approved route step." sx={fieldSx} /><TextField select label="Output Material" value={form.outputMaterialId} onChange={e => setForm(c => ({ ...c, outputMaterialId: e.target.value }))} helperText="Leave as Same as Input when processing does not change the material master identity." sx={fieldSx}><MenuItem value="">Same as Input · {candidate?.reservation?.materialCode || candidate?.line?.materialCode || "Material"}</MenuItem>{materials.filter(material => !candidate?.line?.uom || String(material.uom || "").toUpperCase() === String(candidate.line.uom || "").toUpperCase()).map(material => <MenuItem key={material.id} value={material.id}>{material.materialCode} · {material.materialName} · {material.uom}</MenuItem>)}</TextField></> : dialog?.type === "START" ? <><TextField type="number" label="Actual Input Qty" value={form.actualInputQty} onChange={e => setForm(c => ({ ...c, actualInputQty: e.target.value }))} sx={fieldSx} /><TextField label="Batch No." value={form.batchNo} onChange={e => setForm(c => ({ ...c, batchNo: e.target.value }))} sx={fieldSx} /></> : <><TextField type="number" label="Output Qty" value={form.outputQty} onChange={e => setForm(c => ({ ...c, outputQty: e.target.value }))} sx={fieldSx} /><TextField type="number" label="Wastage Qty" value={form.wastageQty} onChange={e => setForm(c => ({ ...c, wastageQty: e.target.value }))} sx={fieldSx} /><TextField label="Batch No." value={form.batchNo} onChange={e => setForm(c => ({ ...c, batchNo: e.target.value }))} sx={fieldSx} /></>}<TextField multiline minRows={2} label="Remarks" value={form.remarks} onChange={e => setForm(c => ({ ...c, remarks: e.target.value }))} sx={fieldSx} /></Box></DialogContent><DialogActions sx={dialogActionsSx}><Button onClick={() => setDialog(null)} sx={secondaryBtnSx}>Cancel</Button><Button onClick={dialog?.type === "CREATE" ? create : execute} disabled={working} sx={primaryBtnSx}>Confirm</Button></DialogActions></Dialog></Box>;
}

export function MatFlowProductionExecutionPage() {
    const { hasRole } = useMatFlow();
    const canConsume = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PRODUCTION);
    const [consumptions, setConsumptions] = useState([]);
    const [requisitions, setRequisitions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [dialog, setDialog] = useState(false);
    const [form, setForm] = useState({ requisitionId: "", remarks: "", quantities: {}, batches: {} });
    const load = useCallback(async () => { setLoading(true); setError(""); try { const [c, r] = await Promise.all([matflowApi.listConsumptions(), matflowApi.listRequisitions()]); setConsumptions(Array.isArray(c?.data) ? c.data : []); setRequisitions((Array.isArray(r?.data) ? r.data : []).filter(row => normalize(row.status) === "PRODUCTION_STARTED")); } catch (e) { setError(readMatFlowError(e, "Unable to load Production consumption.")); } finally { setLoading(false); } }, []);
    useEffect(() => { load(); }, [load]);
    const req = requisitions.find(r => String(r.id) === String(form.requisitionId));
    const lines = (req?.lines || []).map(line => ({ ...line, outstanding: Math.max(0, numeric(line.issuedQty) - numeric(line.consumedQty) - numeric(line.returnedQty)) })).filter(line => line.outstanding > 0);
    useEffect(() => { if (!req) return; const q = {}, b = {}; lines.forEach(line => { q[String(line.id)] = String(line.outstanding); b[String(line.id)] = ""; }); setForm(c => ({ ...c, quantities: q, batches: b })); }, [form.requisitionId]); // eslint-disable-line react-hooks/exhaustive-deps
    const consume = async () => { const requestLines = lines.map(line => ({ requisitionLineId: line.id, quantity: Number(form.quantities[String(line.id)] || 0), batchNo: clean(form.batches[String(line.id)]) || null, remarks: null })).filter(line => Number.isFinite(line.quantity) && line.quantity > 0); if (!req?.id || !requestLines.length) { setError("Select a started requisition and enter at least one consumption quantity."); return; } setWorking(true); setError(""); try { await matflowApi.createConsumption({ requisitionId: req.id, productionLocationId: req.destinationLocationId, remarks: clean(form.remarks) || null, lines: requestLines }); setDialog(false); await load(); } catch (e) { setError(readMatFlowError(e, "Unable to record Production consumption.")); } finally { setWorking(false); } };
    return <Box sx={pageSx}><PageHero badge="PRODUCTION EXECUTION" title="Material Consumption" subtitle="Record actual consumption only after the requisition has explicitly entered Production Started." actions={<><Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>{canConsume && <Button startIcon={<AddIcon />} onClick={() => setDialog(true)} sx={primaryBtnSx}>Record Consumption</Button>}</>} /><ErrorBox>{error}</ErrorBox><Card sx={panelSx}>{loading ? <LoadingBlock /> : <Box sx={tableShellSx}><Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 180px 160px 160px 100px" }}>{["Consumption", "Requisition", "Location", "Consumed By", "Lines"].map(h => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>{consumptions.length === 0 ? <EmptyState /> : consumptions.map(row => <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "170px 180px 160px 160px 100px" }}><Box sx={tableCellSx}>{row.consumptionNumber}</Box><Box sx={tableCellSx}>{row.requisitionNumber}</Box><Box sx={tableCellSx}>{row.productionLocationCode}</Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.consumedBy}</Typography><Typography sx={subTextSx}>{formatDate(row.consumedAt)}</Typography></Box><Box sx={tableCellSx}>{row.lines?.length || 0}</Box></Box>)}</Box>}</Card><Dialog open={dialog} onClose={() => !working && setDialog(false)} fullWidth maxWidth="md" PaperProps={{ sx: dialogPaperSx }}><DialogTitle sx={dialogTitleSx}>Record Production Consumption</DialogTitle><DialogContent sx={dialogContentSx}><TextField select fullWidth label="Started Requisition *" value={form.requisitionId} onChange={e => setForm(c => ({ ...c, requisitionId: e.target.value, quantities: {}, batches: {} }))} sx={fieldSx}>{requisitions.map(r => <MenuItem key={r.id} value={r.id}>{r.requisitionNumber} · {r.projectCode} · {r.destinationLocationCode}</MenuItem>)}</TextField><Box sx={{ mt: 1.5 }}>{lines.map(line => <Box key={line.id} sx={{ display: "grid", gridTemplateColumns: "1fr 160px 170px", gap: 1, alignItems: "center", mb: 1 }}><Box><Typography sx={mainTextSx}>{line.issuedMaterialCode || line.materialCode} · {line.issuedMaterialName || line.materialName}</Typography><Typography sx={subTextSx}>Outstanding issued {formatQty(line.outstanding)} {line.uom || ""}</Typography></Box><TextField type="number" label="Consume Qty" value={form.quantities[String(line.id)] ?? ""} onChange={e => setForm(c => ({ ...c, quantities: { ...c.quantities, [String(line.id)]: e.target.value } }))} sx={fieldSx} /><TextField label="Batch No." value={form.batches[String(line.id)] ?? ""} onChange={e => setForm(c => ({ ...c, batches: { ...c.batches, [String(line.id)]: e.target.value } }))} sx={fieldSx} /></Box>)}</Box><TextField fullWidth label="Remarks" value={form.remarks} onChange={e => setForm(c => ({ ...c, remarks: e.target.value }))} sx={fieldSx} /></DialogContent><DialogActions sx={dialogActionsSx}><Button onClick={() => setDialog(false)} sx={secondaryBtnSx}>Cancel</Button><Button onClick={consume} disabled={working} sx={primaryBtnSx}>Record Consumption</Button></DialogActions></Dialog></Box>;
}
