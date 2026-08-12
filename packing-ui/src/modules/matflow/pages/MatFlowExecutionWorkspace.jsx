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
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useNavigate } from "react-router-dom";
import { MATFLOW_ROLES, useMatFlow } from "../matflowUi";
import { extractMatFlowPage, matflowApi, readMatFlowError } from "../api/matflowApi";
import {
    EmptyState,
    ErrorBox,
    LoadingBlock,
    MatFlowStatusChip,
    MatFlowPagination,
    MatFlowDeleteDialog,
    PageHero,
    SummaryCard,
    clean,
    dialogActionsSx,
    dialogContentSx,
    dialogPaperSx,
    dialogTitleSx,
    dangerBtnSx,
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
    const navigate = useNavigate();
    const { hasRole } = useMatFlow();
    const canQcWrite = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.QC);
    const canVendorReturn = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.STORE, MATFLOW_ROLES.PURCHASE);

    const [rows, setRows] = useState([]);
    const [routingRows, setRoutingRows] = useState([]);
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [status, setStatus] = useState("");
    const [dialog, setDialog] = useState(null);
    const [form, setForm] = useState({
        acceptedQty: "",
        rejectedQty: "",
        remarks: "",
        dispositionType: "HOLD",
        quantity: "",
        targetLocationId: "",
        routingDecision: "DIRECT_TO_PRODUCTION",
        processingRouteStepId: "",
    });
    const qcPagination = useMatFlowPagination(rows, 20);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [q, routing, l] = await Promise.all([
                matflowApi.listQcInspections({ status: status || undefined }),
                matflowApi.listQcRouting(),
                matflowApi.listLocations({ active: true }),
            ]);
            setRows(Array.isArray(q?.data) ? q.data : []);
            setRoutingRows(Array.isArray(routing?.data) ? routing.data : []);
            setLocations(Array.isArray(l?.data) ? l.data : []);
        } catch (requestError) {
            setRows([]);
            setRoutingRows([]);
            setError(readMatFlowError(requestError, "Unable to load QC inspections and routing controls."));
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
        awaitingRoute: routingRows.filter((row) => row.routingRequired === true && row.routingComplete !== true).length,
        direct: routingRows.filter((row) => normalize(row.routingDecision) === "DIRECT_TO_PRODUCTION").length,
        processing: routingRows.filter((row) => normalize(row.routingDecision) === "SEND_TO_PROCESSING").length,
        rejectedOpen: rows.filter((row) => normalize(row.status) === "COMPLETED" && numeric(row.rejectedQty) > 0).length,
    }), [rows, routingRows]);

    const openDecision = (row) => {
        setDialog({ type: "DECISION", row });
        setForm((current) => ({
            ...current,
            acceptedQty: String(row.inspectionQty ?? 0),
            rejectedQty: "0",
            remarks: "",
        }));
        setError("");
    };

    const openDisposition = (row) => {
        setDialog({ type: "DISPOSITION", row });
        setForm((current) => ({
            ...current,
            remarks: "",
            dispositionType: "HOLD",
            quantity: String(row.rejectedQty ?? 0),
            targetLocationId: "",
        }));
        setError("");
    };

    const openRoute = async (row) => {
        setWorking(true);
        setError("");
        try {
            const response = await matflowApi.getQcRouting(row.id);
            const routing = response?.data;
            if (!routing?.routingRequired) {
                throw new Error("This accepted QC quantity is free stock or has no active Project/Product reservation, so no project route decision is required.");
            }
            if (routing?.routingComplete) {
                throw new Error(`Routing is already completed as ${readable(routing.routingDecision)}.`);
            }
            setDialog({ type: "ROUTE", row, routing });
            setForm((current) => ({
                ...current,
                remarks: "",
                routingDecision: "DIRECT_TO_PRODUCTION",
                processingRouteStepId: "",
            }));
        } catch (requestError) {
            setError(readMatFlowError(requestError, requestError?.message || "Unable to open QC routing decision."));
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
            if (dialog.type === "DECISION") {
                const acceptedQty = Number(form.acceptedQty);
                const rejectedQty = Number(form.rejectedQty);
                if (
                    !Number.isFinite(acceptedQty) || acceptedQty < 0 ||
                    !Number.isFinite(rejectedQty) || rejectedQty < 0 ||
                    Math.abs((acceptedQty + rejectedQty) - numeric(row.inspectionQty)) > .0005
                ) {
                    throw new Error("Accepted + rejected quantity must exactly equal the inspection quantity.");
                }
                await matflowApi.decideQc(row.id, {
                    rowVersion: row.rowVersion,
                    acceptedQty,
                    rejectedQty,
                    remarks: clean(form.remarks) || null,
                });
            } else if (dialog.type === "ROUTE") {
                const routing = dialog.routing;
                const decision = normalize(form.routingDecision);
                if (!["DIRECT_TO_PRODUCTION", "SEND_TO_PROCESSING"].includes(decision)) {
                    throw new Error("Select a valid post-QC routing decision.");
                }
                const alreadyAtProduction =
                    routing?.currentLocationId &&
                    routing?.productionLocationId &&
                    String(routing.currentLocationId) === String(routing.productionLocationId);

                if (alreadyAtProduction && decision === "SEND_TO_PROCESSING") {
                    throw new Error(
                        "This historical QC lot is already recorded at its Production destination. Confirm Direct to Production; a backward Production-to-Processing movement is not permitted."
                    );
                }

                if (decision === "SEND_TO_PROCESSING" && !form.processingRouteStepId) {
                    throw new Error("Select the approved Processing Unit for this material lot.");
                }
                await matflowApi.routeQcMaterial(row.id, {
                    rowVersion: routing.rowVersion,
                    routingDecision: decision,
                    processingRouteStepId: decision === "SEND_TO_PROCESSING" ? form.processingRouteStepId : null,
                    remarks: clean(form.remarks) || null,
                });
            } else if (dialog.type === "VENDOR_RETURN") {
                const returnQty = Number(form.quantity);
                if (!Number.isFinite(returnQty) || returnQty <= 0) {
                    throw new Error("Return quantity must be greater than zero.");
                }
                await matflowApi.returnQcToVendor(row.id, {
                    rowVersion: row.rowVersion,
                    returnQty,
                    remarks: clean(form.remarks) || null,
                });
            } else {
                const quantity = Number(form.quantity);
                if (!Number.isFinite(quantity) || quantity <= 0) {
                    throw new Error("Disposition quantity must be greater than zero.");
                }
                await matflowApi.decideQcDisposition(row.id, {
                    rowVersion: row.rowVersion,
                    dispositionType: form.dispositionType,
                    quantity,
                    targetLocationId: form.targetLocationId || null,
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

    const sourceTransferButton = (row, label = "Source Transfer") =>
        normalize(row?.sourceType) === "TRANSFER_RECEIPT" && row?.sourceId
            ? <Button onClick={() => navigate(`/matflow/transfers/${row.sourceId}`)} sx={secondaryBtnSx}>{label}</Button>
            : null;

    return <Box sx={pageSx}>
        <PageHero
            badge="QUALITY & ROUTING CONTROL GATE"
            title="Material QC"
            subtitle="QC first decides quality. Accepted Project/Product material then remains controlled at QC until the QC actor explicitly chooses Direct to Production or an approved Processing Unit. Processing is optional per inspected lot."
            actions={<>
                <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                <Button onClick={() => navigate("/matflow/transfers")} sx={secondaryBtnSx}>Transfer Desk</Button>
            </>}
        />
        <ErrorBox>{error}</ErrorBox>

        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 1 }}>
            <Card sx={panelSx}><Typography sx={subTextSx}>PENDING INSPECTION</Typography><Typography sx={{ fontSize: 20, fontWeight: 950 }}>{counts.pending}</Typography></Card>
            <Card sx={panelSx}><Typography sx={subTextSx}>AWAITING QC ROUTE</Typography><Typography sx={{ fontSize: 20, fontWeight: 950 }}>{counts.awaitingRoute}</Typography></Card>
            <Card sx={panelSx}><Typography sx={subTextSx}>DIRECT TO PRODUCTION</Typography><Typography sx={{ fontSize: 20, fontWeight: 950 }}>{counts.direct}</Typography></Card>
            <Card sx={panelSx}><Typography sx={subTextSx}>SENT TO PROCESSING</Typography><Typography sx={{ fontSize: 20, fontWeight: 950 }}>{counts.processing}</Typography></Card>
            <Card sx={panelSx}><Typography sx={subTextSx}>REJECTED / DISPOSITION</Typography><Typography sx={{ fontSize: 20, fontWeight: 950 }}>{counts.rejectedOpen}</Typography></Card>
        </Box>

        <Card sx={panelSx}>
            <Box sx={{ display: "flex", gap: 1, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                <TextField select label="QC Status" value={status} onChange={e => setStatus(e.target.value)} sx={{ ...fieldSx, minWidth: 220 }}>
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="PENDING">Pending</MenuItem>
                    <MenuItem value="COMPLETED">Completed</MenuItem>
                </TextField>
                <Typography sx={subTextSx}>
                    Quality decision and physical routing are deliberately separate audited controls.
                </Typography>
            </Box>
        </Card>

        <Card sx={panelSx}>{loading ? <LoadingBlock /> : <Box sx={tableShellSx}>
            <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "160px 135px 180px 130px 80px 90px 90px 125px minmax(280px,1fr)" }}>
                {["Inspection", "Source", "Material", "QC Location", "Qty", "Accepted", "Rejected", "Status", "QC Route / Control"].map(h => <Box key={h} sx={tableCellSx}>{h}</Box>)}
            </Box>
            {rows.length === 0 ? <EmptyState /> : qcPagination.pageItems.map(row => {
                const pending = normalize(row.status) === "PENDING";
                const transferReceipt = normalize(row.sourceType) === "TRANSFER_RECEIPT";
                const completedAccepted = normalize(row.status) === "COMPLETED" && numeric(row.acceptedQty) > 0;
                const routing = routingByInspection.get(String(row.id));
                const routeWaiting = completedAccepted && routing?.routingRequired === true && routing?.routingComplete !== true;
                const routed = routing?.routingComplete === true;

                return <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "160px 135px 180px 130px 80px 90px 90px 125px minmax(280px,1fr)" }}>
                    <Box sx={tableCellSx}>
                        <Typography sx={mainTextSx}>{row.inspectionNumber}</Typography>
                        <Typography sx={subTextSx}>{row.inspectedBy ? `By ${row.inspectedBy}` : "Awaiting QC"}</Typography>
                    </Box>
                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{readable(row.sourceType)}</Typography>{transferReceipt && <Typography sx={subTextSx}>Route receipt</Typography>}</Box>
                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialCode}</Typography><Typography sx={subTextSx}>{row.materialName}</Typography></Box>
                    <Box sx={tableCellSx}>
                        <Typography sx={mainTextSx}>{row.locationCode}</Typography>
                        <Typography sx={subTextSx}>
                            {routing?.currentLocationId &&
                                routing?.productionLocationId &&
                                String(routing.currentLocationId) === String(routing.productionLocationId)
                                ? "Production custody · legacy QC record"
                                : "QC custody"}
                        </Typography>
                    </Box>
                    <Box sx={tableCellSx}>{formatQty(row.inspectionQty)}</Box>
                    <Box sx={tableCellSx}>{formatQty(row.acceptedQty)}</Box>
                    <Box sx={tableCellSx}>{formatQty(row.rejectedQty)}</Box>
                    <Box sx={tableCellSx}><MatFlowStatusChip status={row.status} /></Box>
                    <Box sx={{ ...tableCellSx, whiteSpace: "normal", display: "flex", gap: .6, flexWrap: "wrap", alignItems: "center" }}>
                        {canQcWrite && pending && <Button onClick={() => openDecision(row)} sx={primaryBtnSx}>Inspect / Decide</Button>}
                        {canQcWrite && routeWaiting && <Button onClick={() => openRoute(row)} sx={primaryBtnSx}>Route Material</Button>}
                        {sourceTransferButton(row)}
                        {canQcWrite && normalize(row.status) === "COMPLETED" && numeric(row.rejectedQty) > 0 && transferReceipt && <Button onClick={() => openDisposition(row)} sx={secondaryBtnSx}>Disposition</Button>}
                        {canVendorReturn && normalize(row.status) === "COMPLETED" && numeric(row.rejectedQty) > 0 && normalize(row.sourceType) === "GOODS_RECEIPT" && <Button onClick={() => { setDialog({ type: "VENDOR_RETURN", row }); setForm(c => ({ ...c, quantity: String(row.rejectedQty ?? 0), remarks: "" })); }} sx={secondaryBtnSx}>Vendor Return</Button>}
                        {routeWaiting && <Typography sx={{ ...subTextSx, flexBasis: "100%" }}>Accepted material is reserved at QC and waiting for the QC routing decision.</Typography>}
                        {routed && <Typography sx={{ ...subTextSx, flexBasis: "100%" }}><b>{readable(routing.routingDecision)}</b>{routing.nextTransferNumber ? ` · Next ${routing.nextTransferNumber}` : ""}{routing.routedBy ? ` · By ${routing.routedBy}` : ""}</Typography>}
                        {completedAccepted && !routing && <Typography sx={{ ...subTextSx, flexBasis: "100%" }}>Accepted free/unallocated QC stock. No Project/Product route decision is required.</Typography>}
                        {pending && <Typography sx={{ ...subTextSx, flexBasis: "100%" }}>Inspection does not automatically choose Processing. Routing is a separate decision after acceptance.</Typography>}
                    </Box>
                </Box>;
            })}
        </Box>}
            {!loading && (
                <MatFlowPagination
                    {...qcPagination}
                    onPageChange={qcPagination.setPage}
                    onPageSizeChange={qcPagination.setPageSize}
                    label="QC Inspections"
                />
            )}
        </Card>

        <Dialog open={Boolean(dialog)} onClose={() => !working && setDialog(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
            <DialogTitle sx={dialogTitleSx}>
                {dialog?.type === "DECISION" ? "QC Quality Decision" : dialog?.type === "ROUTE" ? "Post-QC Material Routing" : dialog?.type === "VENDOR_RETURN" ? "Return Rejected Material to Vendor" : "Rejected Material Disposition"}
            </DialogTitle>
            <DialogContent sx={dialogContentSx}><Box sx={{ display: "grid", gap: 1.5 }}>
                {dialog?.type === "DECISION" && <Typography sx={subTextSx}>Decide only material quality here. Accepted Project/Product quantity stays controlled at QC until a separate routing decision is recorded.</Typography>}
                {dialog?.type === "DECISION" ? <>
                    <TextField type="number" label="Accepted Qty" value={form.acceptedQty} onChange={e => setForm(c => ({ ...c, acceptedQty: e.target.value }))} sx={fieldSx} />
                    <TextField type="number" label="Rejected Qty" value={form.rejectedQty} onChange={e => setForm(c => ({ ...c, rejectedQty: e.target.value }))} sx={fieldSx} />
                </> : dialog?.type === "ROUTE" ? <>
                    <Typography sx={subTextSx}>Current custody: <b>{dialog?.routing?.currentLocationCode || dialog?.row?.locationCode || "QC"}</b> · Production destination: <b>{dialog?.routing?.productionLocationCode || "-"}</b></Typography>
                    {dialog?.routing?.currentLocationId &&
                        dialog?.routing?.productionLocationId &&
                        String(dialog.routing.currentLocationId) === String(dialog.routing.productionLocationId) && (
                            <Box sx={{
                                p: 1,
                                borderRadius: 1.5,
                                border: "1px solid var(--mf-border)",
                                background: "var(--mf-surface)",
                            }}>
                                <Typography sx={{ ...mainTextSx, fontSize: 12 }}>
                                    Historical custody compatibility
                                </Typography>
                                <Typography sx={subTextSx}>
                                    This accepted lot is already physically recorded at its exact Production destination from an older BOM/Indent route. Confirm Direct to Production; MatFlow will close the routing decision without creating a false self-transfer.
                                </Typography>
                            </Box>
                        )}
                    <TextField select label="Route Decision *" value={form.routingDecision} onChange={e => setForm(c => ({ ...c, routingDecision: e.target.value, processingRouteStepId: "" }))} sx={fieldSx}>
                        <MenuItem value="DIRECT_TO_PRODUCTION">Direct to Production</MenuItem>
                        <MenuItem
                            value="SEND_TO_PROCESSING"
                            disabled={
                                (dialog?.routing?.processingOptions || []).length === 0 ||
                                Boolean(
                                    dialog?.routing?.currentLocationId &&
                                    dialog?.routing?.productionLocationId &&
                                    String(dialog.routing.currentLocationId) === String(dialog.routing.productionLocationId)
                                )
                            }
                        >
                            Send to Processing Unit
                        </MenuItem>
                    </TextField>
                    {form.routingDecision === "SEND_TO_PROCESSING" && <TextField select label="Approved Processing Unit *" value={form.processingRouteStepId} onChange={e => setForm(c => ({ ...c, processingRouteStepId: e.target.value }))} sx={fieldSx}>
                        {(dialog?.routing?.processingOptions || []).map(option => <MenuItem key={option.routeStepId} value={option.routeStepId}>{option.locationCode} · {option.locationName || "Processing"}{option.processCode ? ` · ${option.processCode}` : ""}</MenuItem>)}
                    </TextField>}
                    {(dialog?.routing?.processingOptions || []).length === 0 && <Typography sx={subTextSx}>No Processing candidate is approved on this BOM material. QC can route this lot directly to Production.</Typography>}
                </> : dialog?.type === "DISPOSITION" ? <>
                    <TextField select label="Disposition" value={form.dispositionType} onChange={e => setForm(c => ({ ...c, dispositionType: e.target.value }))} sx={fieldSx}>{["HOLD", "REWORK", "RETURN_TO_SOURCE", "SCRAP"].map(v => <MenuItem key={v} value={v}>{readable(v)}</MenuItem>)}</TextField>
                    <TextField type="number" label="Quantity" value={form.quantity} onChange={e => setForm(c => ({ ...c, quantity: e.target.value }))} sx={fieldSx} />
                    {form.dispositionType === "REWORK" && <TextField select label="Rework Processing Location" value={form.targetLocationId} onChange={e => setForm(c => ({ ...c, targetLocationId: e.target.value }))} sx={fieldSx}>{locations.filter(l => ["PROCESSING", "EXTERNAL_PROCESSOR"].includes(normalize(l.locationType))).map(l => <MenuItem key={l.id} value={l.id}>{l.locationCode} · {l.plantCode} · {readable(l.locationType)}</MenuItem>)}</TextField>}
                </> : <TextField type="number" label="Return Qty" value={form.quantity} onChange={e => setForm(c => ({ ...c, quantity: e.target.value }))} sx={fieldSx} />}
                <TextField multiline minRows={2} label="Remarks" value={form.remarks} onChange={e => setForm(c => ({ ...c, remarks: e.target.value }))} sx={fieldSx} />
            </Box></DialogContent>
            <DialogActions sx={dialogActionsSx}>
                <Button onClick={() => setDialog(null)} sx={secondaryBtnSx}>Cancel</Button>
                <Button onClick={execute} disabled={working} sx={primaryBtnSx}>{working ? "Processing..." : dialog?.type === "ROUTE" ? "Confirm Route" : "Confirm"}</Button>
            </DialogActions>
        </Dialog>
    </Box>;
}

async function discoverProcessingCandidates(existingJobs = []) {
    /*
     * Processing candidates must come from the QC routing decision, not from
     * the mere presence/order of PROCESSING rows in the BOM. Those rows are
     * approved options. A reservation belongs on this desk only when QC chose
     * SEND_TO_PROCESSING for the exact route step and the transfer has arrived.
     */
    const [requisitionResponse, routingResponse] = await Promise.all([
        matflowApi.listRequisitions(),
        matflowApi.listQcRouting(),
    ]);

    const requisitions = Array.isArray(requisitionResponse?.data)
        ? requisitionResponse.data
        : [];
    const routingRows = Array.isArray(routingResponse?.data)
        ? routingResponse.data
        : [];

    const selectedRouteByReservation = new Map(
        routingRows
            .filter((routing) =>
                routing?.routingComplete === true &&
                normalize(routing?.routingDecision) === "SEND_TO_PROCESSING" &&
                routing?.reservationId &&
                routing?.selectedProcessingRouteStepId
            )
            .map((routing) => [String(routing.reservationId), routing])
    );

    if (selectedRouteByReservation.size === 0) return [];

    const snapshots = await Promise.all(
        requisitions.map(async (requisition) => {
            try {
                return (await matflowApi.getRequisitionPlanning(requisition.id))?.data;
            } catch {
                return null;
            }
        })
    );

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
                    extractMatFlowPage(routeResponse?.data).rows
                );
            } catch {
                routeCache.set(String(requisition.bomId), []);
            }
        }

        const routes = routeCache.get(String(requisition.bomId));
        const transfers = Array.isArray(snapshot.transfers) ? snapshot.transfers : [];

        for (const reservation of (snapshot.reservations || [])) {
            if (normalize(reservation.status) !== "ACTIVE") continue;

            const routing = selectedRouteByReservation.get(String(reservation.id));
            if (!routing) continue;

            const selectedStep = routes.find(
                (step) =>
                    String(step.id) === String(routing.selectedProcessingRouteStepId) &&
                    normalize(step.stepType) === "PROCESSING"
            );

            if (!selectedStep) continue;

            const line = (requisition.lines || []).find(
                (item) => String(item.id) === String(reservation.requisitionLineId)
            );

            if (!line?.bomLineId ||
                String(selectedStep.bomLineId) !== String(line.bomLineId)) {
                continue;
            }

            const occupied = jobs.some((job) =>
                String(job.reservationId) === String(reservation.id) &&
                String(job.routeStepId) === String(selectedStep.id) &&
                normalize(job.status) !== "CANCELLED"
            );

            if (occupied) continue;

            const inboundComplete = transfers.some((transfer) =>
                String(transfer.reservationId) === String(reservation.id) &&
                String(transfer.toLocationId) === String(selectedStep.locationId) &&
                normalize(transfer.status) === "RECEIVED"
            );

            if (!inboundComplete) continue;

            candidates.push({
                reservation,
                step: selectedStep,
                requisition,
                line,
                routing,
            });
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
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [form, setForm] = useState({ candidateKey: "", plannedInputQty: "", outputMaterialId: "", actualInputQty: "", outputQty: "", wastageQty: "0", batchNo: "", remarks: "" });
    const jobPagination = useMatFlowPagination(jobs, 20);
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
    const confirmDeletePending = async () => { if (!deleteTarget?.id || deleteTarget.rowVersion == null) return; setWorking(true); setError(""); try { await matflowApi.deletePendingProcessingJob(deleteTarget.id, deleteTarget.rowVersion); setDeleteTarget(null); await load(); } catch (e) { setError(readMatFlowError(e, "Unable to delete the Pending processing job.")); } finally { setWorking(false); } };
    return <Box sx={pageSx}><PageHero badge="MATERIAL PROCESSING" title="Processing Jobs" subtitle="Execute only Processing Units explicitly selected by QC for an accepted material lot. Materials not selected for Processing bypass this desk and route directly to Production." actions={<><Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button><Button startIcon={<AddIcon />} onClick={() => setDialog({ type: "CREATE" })} sx={primaryBtnSx}>Create Job</Button></>} /><ErrorBox>{error}</ErrorBox><Card sx={panelSx}>{loading ? <LoadingBlock /> : <Box sx={tableShellSx}><Box sx={{ ...tableHeaderSx, gridTemplateColumns: "160px 170px 150px 150px 110px 110px 150px 230px" }}>{["Job", "Requisition", "Process", "Material", "Input", "Output", "Status", "Action"].map(h => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>{jobs.length === 0 ? <EmptyState /> : jobPagination.pageItems.map(job => <Box key={job.id} sx={{ ...tableRowSx, gridTemplateColumns: "160px 170px 150px 150px 110px 110px 150px 230px" }}><Box sx={tableCellSx}>{job.jobNumber}</Box><Box sx={tableCellSx}>{job.requisitionNumber}</Box><Box sx={tableCellSx}>{job.processCode || job.locationCode}</Box><Box sx={tableCellSx}>{job.inputMaterialCode} → {job.outputMaterialCode}</Box><Box sx={tableCellSx}>{formatQty(job.actualInputQty ?? job.plannedInputQty)}</Box><Box sx={tableCellSx}>{formatQty(job.outputQty)}</Box><Box sx={tableCellSx}><MatFlowStatusChip status={job.status} /></Box><Box sx={{ ...tableCellSx, display: "flex", gap: .5 }}>{normalize(job.status) === "PENDING" && <Button onClick={() => act(job, "START")} sx={primaryBtnSx}>Start</Button>}{normalize(job.status) === "PENDING" && job.rowVersion != null && <Button startIcon={<DeleteOutlineIcon />} disabled={working} onClick={() => setDeleteTarget(job)} sx={dangerBtnSx}>Delete</Button>}{normalize(job.status) === "IN_PROGRESS" && <Button onClick={() => act(job, "COMPLETE")} sx={primaryBtnSx}>Complete</Button>}</Box></Box>)}</Box>}
        {!loading && (
            <MatFlowPagination
                {...jobPagination}
                onPageChange={jobPagination.setPage}
                onPageSizeChange={jobPagination.setPageSize}
                label="Processing Jobs"
            />
        )}
    </Card><Dialog open={Boolean(dialog)} onClose={() => !working && setDialog(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}><DialogTitle sx={dialogTitleSx}>{dialog?.type === "CREATE" ? "Create Processing Job" : dialog?.type === "START" ? "Start Processing Job" : "Complete Processing Job"}</DialogTitle><DialogContent sx={dialogContentSx}><Box sx={{ display: "grid", gap: 1.5 }}>{dialog?.type === "CREATE" ? <><TextField select label="Reservation / Route *" value={form.candidateKey} onChange={e => { const key = e.target.value; const found = candidates.find(c => `${c.reservation.id}:${c.step.id}` === key); setForm(c => ({ ...c, candidateKey: key, plannedInputQty: String(found?.reservation?.reservedQty ?? ""), outputMaterialId: "" })); }} sx={fieldSx}>{candidates.map(c => <MenuItem key={`${c.reservation.id}:${c.step.id}`} value={`${c.reservation.id}:${c.step.id}`}>{c.requisition.requisitionNumber} · {c.reservation.materialCode} · {c.step.locationCode} · {c.step.processCode}</MenuItem>)}</TextField><TextField type="number" label="Reserved Input Qty" value={form.plannedInputQty} disabled helperText="This candidate exists only because QC routed the accepted reserved lot to this approved Processing Unit." sx={fieldSx} /><TextField select label="Output Material" value={form.outputMaterialId} onChange={e => setForm(c => ({ ...c, outputMaterialId: e.target.value }))} helperText="Leave as Same as Input when processing does not change the material master identity." sx={fieldSx}><MenuItem value="">Same as Input · {candidate?.reservation?.materialCode || candidate?.line?.materialCode || "Material"}</MenuItem>{materials.filter(material => !candidate?.line?.uom || String(material.uom || "").toUpperCase() === String(candidate.line.uom || "").toUpperCase()).map(material => <MenuItem key={material.id} value={material.id}>{material.materialCode} · {material.materialName} · {material.uom}</MenuItem>)}</TextField></> : dialog?.type === "START" ? <><TextField type="number" label="Actual Input Qty" value={form.actualInputQty} onChange={e => setForm(c => ({ ...c, actualInputQty: e.target.value }))} sx={fieldSx} /><TextField label="Batch No." value={form.batchNo} onChange={e => setForm(c => ({ ...c, batchNo: e.target.value }))} sx={fieldSx} /></> : <><TextField type="number" label="Output Qty" value={form.outputQty} onChange={e => setForm(c => ({ ...c, outputQty: e.target.value }))} sx={fieldSx} /><TextField type="number" label="Wastage Qty" value={form.wastageQty} onChange={e => setForm(c => ({ ...c, wastageQty: e.target.value }))} sx={fieldSx} /><TextField label="Batch No." value={form.batchNo} onChange={e => setForm(c => ({ ...c, batchNo: e.target.value }))} sx={fieldSx} /></>}<TextField multiline minRows={2} label="Remarks" value={form.remarks} onChange={e => setForm(c => ({ ...c, remarks: e.target.value }))} sx={fieldSx} /></Box></DialogContent><DialogActions sx={dialogActionsSx}><Button onClick={() => setDialog(null)} sx={secondaryBtnSx}>Cancel</Button><Button onClick={dialog?.type === "CREATE" ? create : execute} disabled={working} sx={primaryBtnSx}>Confirm</Button></DialogActions></Dialog><MatFlowDeleteDialog open={Boolean(deleteTarget)} title="Delete Pending Processing Job?" subject={deleteTarget?.jobNumber || "Pending processing job"} description="This removes only a Processing Job that has not started. Once processing starts, stock and ledger movements make the job permanent execution history." working={working} onClose={() => setDeleteTarget(null)} onConfirm={confirmDeletePending} /></Box>;
}

export function MatFlowProductionExecutionPage() {
    const navigate = useNavigate();
    const { hasRole } = useMatFlow();
    const canExecute = hasRole(
        MATFLOW_ROLES.ADMIN,
        MATFLOW_ROLES.MANAGER,
        MATFLOW_ROLES.PRODUCTION
    );

    const [consumptions, setConsumptions] = useState([]);
    const [requisitions, setRequisitions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [workingId, setWorkingId] = useState("");
    const [error, setError] = useState("");
    const [dialog, setDialog] = useState(null);
    const [form, setForm] = useState({
        requisitionId: "",
        remarks: "",
        quantities: {},
        batches: {},
    });

    const load = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const [consumptionResponse, requisitionResponse] = await Promise.all([
                matflowApi.listConsumptions(),
                matflowApi.listRequisitions(),
            ]);

            setConsumptions(
                Array.isArray(consumptionResponse?.data)
                    ? consumptionResponse.data
                    : []
            );
            setRequisitions(
                Array.isArray(requisitionResponse?.data)
                    ? requisitionResponse.data
                    : []
            );
        } catch (requestError) {
            setConsumptions([]);
            setRequisitions([]);
            setError(
                readMatFlowError(
                    requestError,
                    "Unable to load Production execution."
                )
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const accounting = useCallback((requisition) => {
        const lines = Array.isArray(requisition?.lines) ? requisition.lines : [];

        return lines.reduce(
            (result, line) => {
                const requested = numeric(line?.requestedQty);
                const issued = numeric(line?.issuedQty);
                const consumed = numeric(line?.consumedQty);
                const returned = numeric(line?.returnedQty);
                const accounted = consumed + returned;

                result.requested += requested;
                result.issued += issued;
                result.consumed += consumed;
                result.returned += returned;
                result.outstanding += Math.max(0, issued - accounted);
                result.fullyIssued =
                    result.fullyIssued && issued + 0.0005 >= requested;
                result.fullyAccounted =
                    result.fullyAccounted &&
                    issued + 0.0005 >= requested &&
                    accounted + 0.0005 >= issued;

                return result;
            },
            {
                requested: 0,
                issued: 0,
                consumed: 0,
                returned: 0,
                outstanding: 0,
                fullyIssued: lines.length > 0,
                fullyAccounted: lines.length > 0,
            }
        );
    }, []);

    const executionRows = useMemo(
        () =>
            requisitions.filter((row) =>
                ["ISSUED_TO_PRODUCTION", "PRODUCTION_STARTED"].includes(
                    normalize(row?.status)
                )
            ),
        [requisitions]
    );

    const executionPagination = useMatFlowPagination(executionRows, 20);
    const consumptionPagination = useMatFlowPagination(consumptions, 20);

    const completedCount = useMemo(
        () =>
            requisitions.filter(
                (row) => normalize(row?.status) === "PRODUCTION_COMPLETED"
            ).length,
        [requisitions]
    );

    const startedCount = executionRows.filter(
        (row) => normalize(row?.status) === "PRODUCTION_STARTED"
    ).length;
    const awaitingStartCount = executionRows.filter(
        (row) => normalize(row?.status) === "ISSUED_TO_PRODUCTION"
    ).length;
    const awaitingAccountingCount = executionRows.filter((row) => {
        if (normalize(row?.status) !== "PRODUCTION_STARTED") return false;
        return !accounting(row).fullyAccounted;
    }).length;

    const openConsumption = (requisition) => {
        const lines = (Array.isArray(requisition?.lines) ? requisition.lines : [])
            .map((line) => ({
                ...line,
                outstanding: Math.max(
                    0,
                    numeric(line?.issuedQty) -
                    numeric(line?.consumedQty) -
                    numeric(line?.returnedQty)
                ),
            }))
            .filter((line) => line.outstanding > 0.0005);

        const quantities = {};
        const batches = {};
        lines.forEach((line) => {
            quantities[String(line.id)] = String(line.outstanding);
            batches[String(line.id)] = "";
        });

        setForm({
            requisitionId: requisition.id,
            remarks: "",
            quantities,
            batches,
        });
        setDialog({ type: "CONSUME", requisition, lines });
        setError("");
    };

    const start = async (requisition) => {
        if (!requisition?.id || requisition?.rowVersion == null) return;
        setWorkingId(String(requisition.id));
        setError("");

        try {
            await matflowApi.startProduction(requisition.id, {
                rowVersion: requisition.rowVersion,
                remarks: "Production started from the MatFlow Production desk.",
            });
            await load();
        } catch (requestError) {
            setError(
                readMatFlowError(requestError, "Unable to start Production.")
            );
        } finally {
            setWorkingId("");
        }
    };

    const complete = async (requisition) => {
        if (!requisition?.id || requisition?.rowVersion == null) return;
        const position = accounting(requisition);

        if (!position.fullyAccounted) {
            setError(
                "Finished Product cannot be completed until every requested quantity is issued and every issued quantity is consumed or returned."
            );
            return;
        }

        setWorkingId(String(requisition.id));
        setError("");

        try {
            await matflowApi.completeProduction(requisition.id, {
                rowVersion: requisition.rowVersion,
                remarks: "Finished Product completed from the MatFlow Production desk.",
            });
            await load();
        } catch (requestError) {
            setError(
                readMatFlowError(
                    requestError,
                    "Unable to complete the Finished Product."
                )
            );
        } finally {
            setWorkingId("");
        }
    };

    const consume = async () => {
        const requisition = dialog?.requisition;
        const lines = Array.isArray(dialog?.lines) ? dialog.lines : [];
        if (!requisition?.id) return;

        const requestLines = lines
            .map((line) => ({
                requisitionLineId: line.id,
                quantity: Number(form.quantities[String(line.id)] || 0),
                batchNo: clean(form.batches[String(line.id)]) || null,
                remarks: null,
            }))
            .filter(
                (line) => Number.isFinite(line.quantity) && line.quantity > 0
            );

        if (!requestLines.length) {
            setError("Enter at least one Production consumption quantity.");
            return;
        }

        for (const requestLine of requestLines) {
            const source = lines.find(
                (line) => String(line.id) === String(requestLine.requisitionLineId)
            );
            if (
                !source ||
                requestLine.quantity > numeric(source.outstanding) + 0.0005
            ) {
                setError(
                    `Consumption exceeds outstanding issued quantity for ${source?.issuedMaterialCode || source?.materialCode || "material"
                    }.`
                );
                return;
            }
        }

        setWorkingId(String(requisition.id));
        setError("");

        try {
            await matflowApi.createConsumption({
                requisitionId: requisition.id,
                productionLocationId: requisition.destinationLocationId,
                remarks: clean(form.remarks) || null,
                lines: requestLines,
            });
            setDialog(null);
            await load();
        } catch (requestError) {
            setError(
                readMatFlowError(
                    requestError,
                    "Unable to record Production consumption."
                )
            );
        } finally {
            setWorkingId("");
        }
    };

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="PRODUCTION EXECUTION CONTROL"
                title="Production & Finished Product"
                subtitle="Start Production only after the complete requisition is issued. Record actual material consumption or returns, then complete the finished Product only after every issued quantity is fully accounted."
                actions={
                    <>
                        <Button
                            startIcon={<RefreshIcon />}
                            onClick={load}
                            sx={secondaryBtnSx}
                        >
                            Refresh
                        </Button>
                        <Button
                            onClick={() => navigate("/matflow/returns")}
                            sx={secondaryBtnSx}
                        >
                            Material Returns
                        </Button>
                    </>
                }
            />

            <ErrorBox>{error}</ErrorBox>

            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
                    gap: 1,
                }}
            >
                <SummaryCard label="Awaiting Start" value={awaitingStartCount} tone="amber" colorful />
                <SummaryCard label="In Production" value={startedCount} tone="sky" colorful />
                <SummaryCard
                    label="Awaiting Material Accounting"
                    value={awaitingAccountingCount}
                    tone="orange"
                    colorful
                />
                <SummaryCard label="Products Completed" value={completedCount} tone="green" colorful />
            </Box>

            <Card sx={panelSx}>
                <Typography sx={{ fontSize: 17, fontWeight: 950, mb: 1 }}>
                    Production Execution Queue
                </Typography>
                <Typography sx={{ ...subTextSx, mb: 1.25 }}>
                    This queue is the Production-side hand-off after Store/QC/optional Processing. Material quantities remain traceable to the exact Project, Product/Drawing and requisition.
                </Typography>

                {loading ? (
                    <LoadingBlock />
                ) : (
                    <Box sx={tableShellSx}>
                        <Box
                            sx={{
                                ...tableHeaderSx,
                                gridTemplateColumns:
                                    "170px 185px 155px minmax(235px,1fr) 165px minmax(250px,1fr)",
                            }}
                        >
                            {[
                                "Requisition",
                                "Project / Drawing",
                                "Status",
                                "Material Accounting",
                                "Next Control",
                                "Action",
                            ].map((heading) => (
                                <Box key={heading} sx={tableCellSx}>
                                    {heading}
                                </Box>
                            ))}
                        </Box>

                        {executionRows.length === 0 ? (
                            <EmptyState>
                                No requisition is currently awaiting Production start or Production completion.
                            </EmptyState>
                        ) : (
                            executionPagination.pageItems.map((row) => {
                                const position = accounting(row);
                                const status = normalize(row.status);
                                const busy = workingId === String(row.id);

                                return (
                                    <Box
                                        key={row.id}
                                        sx={{
                                            ...tableRowSx,
                                            gridTemplateColumns:
                                                "170px 185px 155px minmax(235px,1fr) 165px minmax(250px,1fr)",
                                        }}
                                    >
                                        <Box sx={tableCellSx}>
                                            <Typography sx={mainTextSx}>
                                                {row.requisitionNumber || "-"}
                                            </Typography>
                                            <Typography sx={subTextSx}>
                                                {row.bomNumber || "-"} · Rev {row.bomRevisionNo ?? "-"}
                                            </Typography>
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Typography sx={mainTextSx}>
                                                {row.projectCode || "-"}
                                            </Typography>
                                            <Typography sx={subTextSx}>
                                                {row.drawingNo || "-"} · {row.destinationLocationCode || "-"}
                                            </Typography>
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <MatFlowStatusChip status={row.status} />
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Typography sx={mainTextSx}>
                                                Issued {formatQty(position.issued)} / Requested {formatQty(position.requested)}
                                            </Typography>
                                            <Typography sx={subTextSx}>
                                                Consumed {formatQty(position.consumed)} · Returned {formatQty(position.returned)} · Unaccounted {formatQty(position.outstanding)}
                                            </Typography>
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Typography sx={mainTextSx}>
                                                {status === "ISSUED_TO_PRODUCTION"
                                                    ? "START PRODUCTION"
                                                    : position.fullyAccounted
                                                        ? "COMPLETE PRODUCT"
                                                        : "CONSUME / RETURN"}
                                            </Typography>
                                            <Typography sx={subTextSx}>
                                                {position.fullyAccounted
                                                    ? "Material account closed"
                                                    : `${formatQty(position.outstanding)} issued qty pending accounting`}
                                            </Typography>
                                        </Box>

                                        <Box
                                            sx={{
                                                ...tableCellSx,
                                                display: "flex",
                                                gap: 0.6,
                                                flexWrap: "wrap",
                                            }}
                                        >
                                            {canExecute && status === "ISSUED_TO_PRODUCTION" && (
                                                <Button
                                                    disabled={busy}
                                                    onClick={() => start(row)}
                                                    sx={primaryBtnSx}
                                                >
                                                    Start Production
                                                </Button>
                                            )}

                                            {canExecute &&
                                                status === "PRODUCTION_STARTED" &&
                                                position.outstanding > 0.0005 && (
                                                    <Button
                                                        disabled={busy}
                                                        onClick={() => openConsumption(row)}
                                                        sx={primaryBtnSx}
                                                    >
                                                        Record Consumption
                                                    </Button>
                                                )}

                                            {canExecute &&
                                                status === "PRODUCTION_STARTED" &&
                                                position.fullyAccounted && (
                                                    <Button
                                                        disabled={busy}
                                                        onClick={() => complete(row)}
                                                        sx={primaryBtnSx}
                                                    >
                                                        Complete Product
                                                    </Button>
                                                )}

                                            {status === "PRODUCTION_STARTED" &&
                                                position.outstanding > 0.0005 && (
                                                    <Button
                                                        disabled={busy}
                                                        onClick={() => navigate("/matflow/returns")}
                                                        sx={secondaryBtnSx}
                                                    >
                                                        Return Unused
                                                    </Button>
                                                )}

                                            <Button
                                                onClick={() =>
                                                    navigate(`/matflow/requisitions/${row.id}`)
                                                }
                                                sx={secondaryBtnSx}
                                            >
                                                Requisition
                                            </Button>
                                        </Box>
                                    </Box>
                                );
                            })
                        )}
                    </Box>
                )}
                {!loading && (
                    <MatFlowPagination
                        {...executionPagination}
                        onPageChange={executionPagination.setPage}
                        onPageSizeChange={executionPagination.setPageSize}
                        label="Production Queue"
                    />
                )}
            </Card>

            <Card sx={panelSx}>
                <Typography sx={{ fontSize: 17, fontWeight: 950, mb: 1 }}>
                    Production Consumption Register
                </Typography>
                {loading ? (
                    <LoadingBlock />
                ) : (
                    <Box sx={tableShellSx}>
                        <Box
                            sx={{
                                ...tableHeaderSx,
                                gridTemplateColumns: "170px 180px 160px 160px 100px",
                            }}
                        >
                            {[
                                "Consumption",
                                "Requisition",
                                "Location",
                                "Consumed By",
                                "Lines",
                            ].map((heading) => (
                                <Box key={heading} sx={tableCellSx}>
                                    {heading}
                                </Box>
                            ))}
                        </Box>

                        {consumptions.length === 0 ? (
                            <EmptyState>No Production consumption has been recorded.</EmptyState>
                        ) : (
                            consumptionPagination.pageItems.map((row) => (
                                <Box
                                    key={row.id}
                                    sx={{
                                        ...tableRowSx,
                                        gridTemplateColumns: "170px 180px 160px 160px 100px",
                                    }}
                                >
                                    <Box sx={tableCellSx}>{row.consumptionNumber}</Box>
                                    <Box sx={tableCellSx}>{row.requisitionNumber}</Box>
                                    <Box sx={tableCellSx}>{row.productionLocationCode}</Box>
                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>
                                            {row.consumedBy || "-"}
                                        </Typography>
                                        <Typography sx={subTextSx}>
                                            {formatDate(row.consumedAt)}
                                        </Typography>
                                    </Box>
                                    <Box sx={tableCellSx}>{row.lines?.length || 0}</Box>
                                </Box>
                            ))
                        )}
                    </Box>
                )}
                {!loading && (
                    <MatFlowPagination
                        {...consumptionPagination}
                        onPageChange={consumptionPagination.setPage}
                        onPageSizeChange={consumptionPagination.setPageSize}
                        label="Consumption Register"
                    />
                )}
            </Card>

            <Dialog
                open={dialog?.type === "CONSUME"}
                onClose={() => !workingId && setDialog(null)}
                fullWidth
                maxWidth="md"
                PaperProps={{ sx: dialogPaperSx }}
            >
                <DialogTitle sx={dialogTitleSx}>
                    Record Production Consumption
                </DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Typography sx={mainTextSx}>
                        {dialog?.requisition?.requisitionNumber || "Requisition"} · {dialog?.requisition?.projectCode || "-"} · {dialog?.requisition?.drawingNo || "-"}
                    </Typography>
                    <Typography sx={{ ...subTextSx, mb: 1.5 }}>
                        Enter only actual consumption. Unused issued quantity must be returned through the Material Return workflow before Finished Product completion.
                    </Typography>

                    {(dialog?.lines || []).map((line) => (
                        <Box
                            key={line.id}
                            sx={{
                                display: "grid",
                                gridTemplateColumns: { xs: "1fr", md: "1fr 160px 170px" },
                                gap: 1,
                                alignItems: "center",
                                mb: 1,
                            }}
                        >
                            <Box>
                                <Typography sx={mainTextSx}>
                                    {line.issuedMaterialCode || line.materialCode} · {line.issuedMaterialName || line.materialName}
                                </Typography>
                                <Typography sx={subTextSx}>
                                    Outstanding issued {formatQty(line.outstanding)} {line.uom || ""}
                                </Typography>
                            </Box>
                            <TextField
                                type="number"
                                label="Consume Qty"
                                value={form.quantities[String(line.id)] ?? ""}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        quantities: {
                                            ...current.quantities,
                                            [String(line.id)]: event.target.value,
                                        },
                                    }))
                                }
                                sx={fieldSx}
                            />
                            <TextField
                                label="Batch No."
                                value={form.batches[String(line.id)] ?? ""}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        batches: {
                                            ...current.batches,
                                            [String(line.id)]: event.target.value,
                                        },
                                    }))
                                }
                                sx={fieldSx}
                            />
                        </Box>
                    ))}

                    <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        label="Consumption Remarks"
                        value={form.remarks}
                        onChange={(event) =>
                            setForm((current) => ({
                                ...current,
                                remarks: event.target.value,
                            }))
                        }
                        sx={{ ...fieldSx, mt: 1 }}
                    />
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button
                        onClick={() => setDialog(null)}
                        disabled={Boolean(workingId)}
                        sx={secondaryBtnSx}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={consume}
                        disabled={Boolean(workingId)}
                        sx={primaryBtnSx}
                    >
                        Record Consumption
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

