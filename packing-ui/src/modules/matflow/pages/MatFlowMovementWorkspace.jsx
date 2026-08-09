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
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import MoveToInboxOutlinedIcon from "@mui/icons-material/MoveToInboxOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import AddIcon from "@mui/icons-material/Add";
import { useNavigate, useParams } from "react-router-dom";
import { MATFLOW_ROLES, useMatFlow } from "../matflowUi";
import { matflowApi, readMatFlowError } from "../api/matflowApi";
import {
    Detail,
    EmptyState,
    ErrorBox,
    LoadingBlock,
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
} from "../matflowUi";

const TRANSFER_STATUSES = ["ALL", "PLANNED", "READY", "PARTIALLY_DISPATCHED", "IN_TRANSIT", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"];

const canRoleActAtLocationType = (hasRole, locationType) => {
    if (hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER)) return true;
    switch (normalize(locationType)) {
        case "STORE": return hasRole(MATFLOW_ROLES.STORE);
        case "PRODUCTION": return hasRole(MATFLOW_ROLES.PRODUCTION);
        case "QC": return hasRole(MATFLOW_ROLES.QC);
        case "PROCESSING":
        case "EXTERNAL_PROCESSOR": return hasRole(MATFLOW_ROLES.PROCESSING);
        default: return false;
    }
};

export function MatFlowTransfersPage() {
    const navigate = useNavigate();
    const { selectedPlantParam } = useMatFlow();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("ALL");

    const load = useCallback(async () => {
        setLoading(true); setError("");
        try {
            const response = await matflowApi.listTransfers({ status: status === "ALL" ? undefined : status, plantCode: selectedPlantParam });
            setRows(Array.isArray(response?.data) ? response.data : []);
        } catch (requestError) { setRows([]); setError(readMatFlowError(requestError, "Unable to load material transfers.")); }
        finally { setLoading(false); }
    }, [status, selectedPlantParam]);
    useEffect(() => { load(); }, [load]);

    const filtered = useMemo(() => {
        const term = clean(search).toLowerCase();
        if (!term) return rows;
        return rows.filter((row) => [row.transferNumber, row.materialCode, row.materialName, row.fromLocationCode, row.toLocationCode, row.requisitionNumber, row.projectCode, row.drawingNo, row.status].some((v) => clean(v).toLowerCase().includes(term)));
    }, [rows, search]);

    const counts = useMemo(() => ({
        ready: rows.filter((r) => normalize(r.status) === "READY").length,
        transit: rows.filter((r) => ["PARTIALLY_DISPATCHED", "IN_TRANSIT"].includes(normalize(r.status))).length,
        partial: rows.filter((r) => normalize(r.status) === "PARTIALLY_RECEIVED").length,
        received: rows.filter((r) => normalize(r.status) === "RECEIVED").length,
    }), [rows]);

    return <Box sx={pageSx}>
        <PageHero badge="TRANSFER CONTROL DESK" title="Material Transfers" subtitle="Dispatch and receive reserved material through the approved Store → QC/Processing → Production route." actions={<Button startIcon={<RefreshOutlinedIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>} />
        <ErrorBox>{error}</ErrorBox>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 1 }}><SummaryCard label="Ready" value={counts.ready} /><SummaryCard label="In Transit" value={counts.transit} /><SummaryCard label="Partial Receipt" value={counts.partial} /><SummaryCard label="Received" value={counts.received} /></Box>
        <Card sx={panelSx}><Box sx={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 1 }}><TextField label="Search Transfers" value={search} onChange={(e) => setSearch(e.target.value)} sx={fieldSx} /><TextField select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={fieldSx}>{TRANSFER_STATUSES.map((value) => <MenuItem key={value} value={value}>{value === "ALL" ? "All Transfers" : readable(value)}</MenuItem>)}</TextField></Box></Card>
        <Card sx={panelSx}>{loading ? <LoadingBlock /> : <Box sx={tableShellSx}><Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 180px 180px 180px 100px 100px 160px 100px" }}>{["Transfer", "Project / Requisition", "Material", "Route", "Planned", "Received", "Status", "Action"].map((h) => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>{filtered.length === 0 ? <EmptyState /> : filtered.map((row) => <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "170px 180px 180px 180px 100px 100px 160px 100px" }}><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.transferNumber || "-"}</Typography><Typography sx={subTextSx}>{row.purpose || "-"}</Typography></Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.projectCode || row.requisitionNumber || "-"}</Typography><Typography sx={subTextSx}>{row.drawingNo || row.requisitionNumber || "-"}</Typography></Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialCode || "-"}</Typography><Typography sx={subTextSx}>{row.materialName || "-"}</Typography></Box><Box sx={tableCellSx}>{row.fromLocationCode || "-"} → {row.toLocationCode || "-"}</Box><Box sx={tableCellSx}>{formatQty(row.plannedQty)}</Box><Box sx={tableCellSx}>{formatQty(row.receivedQty)}</Box><Box sx={tableCellSx}><MatFlowStatusChip status={row.status} /></Box><Box sx={tableCellSx}><Button onClick={() => navigate(`/matflow/transfers/${row.id}`)} sx={secondaryBtnSx}>Open</Button></Box></Box>)}</Box>}</Card>
    </Box>;
}

export function MatFlowTransferDetailPage() {
    const { transferId } = useParams();
    const navigate = useNavigate();
    const { hasRole } = useMatFlow();
    const [transfer, setTransfer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [action, setAction] = useState(null);
    const [form, setForm] = useState({ quantity: "", batchNo: "", remarks: "" });

    const load = useCallback(async () => {
        setLoading(true); setError("");
        try { const response = await matflowApi.getTransfer(transferId); setTransfer(response?.data || null); }
        catch (requestError) { setError(readMatFlowError(requestError, "Unable to load material transfer.")); }
        finally { setLoading(false); }
    }, [transferId]);
    useEffect(() => { load(); }, [load]);

    const status = normalize(transfer?.status);
    const planned = numeric(transfer?.plannedQty);
    const dispatched = numeric(transfer?.dispatchedQty);
    const received = numeric(transfer?.receivedQty);
    const pendingDispatch = Math.max(0, planned - dispatched);
    const pendingReceipt = Math.max(0, dispatched - received);
    const dispatchable = canRoleActAtLocationType(hasRole, transfer?.fromLocationType) && ["READY", "PARTIALLY_DISPATCHED", "PARTIALLY_RECEIVED"].includes(status) && pendingDispatch > 0;
    const receivable = canRoleActAtLocationType(hasRole, transfer?.toLocationType) && ["PARTIALLY_DISPATCHED", "IN_TRANSIT", "PARTIALLY_RECEIVED"].includes(status) && pendingReceipt > 0;

    const openAction = (next) => {
        setAction(next); setForm({ quantity: String(next === "DISPATCH" ? pendingDispatch : pendingReceipt), batchNo: "", remarks: "" }); setError("");
    };
    const execute = async () => {
        const qty = Number(form.quantity);
        const max = action === "DISPATCH" ? pendingDispatch : pendingReceipt;
        if (!Number.isFinite(qty) || qty <= 0 || qty > max) { setError(`Quantity must be greater than zero and not exceed ${formatQty(max)}.`); return; }
        setWorking(true); setError("");
        const body = { rowVersion: transfer.rowVersion, quantity: qty, batchNo: clean(form.batchNo) || null, remarks: clean(form.remarks) || null };
        try {
            const response = action === "DISPATCH" ? await matflowApi.dispatchTransfer(transfer.id, body) : await matflowApi.receiveTransfer(transfer.id, body);
            if (response?.data?.id) setTransfer(response.data); else await load();
            setAction(null);
        } catch (requestError) { setError(readMatFlowError(requestError, action === "DISPATCH" ? "Unable to dispatch transfer." : "Unable to receive transfer.")); }
        finally { setWorking(false); }
    };

    if (loading) return <LoadingBlock />;
    return <Box sx={pageSx}>
        <PageHero badge="TRANSFER EXECUTION" title={transfer?.transferNumber || "Material Transfer"} subtitle={`${transfer?.materialCode || "-"} · ${transfer?.materialName || "-"}`} actions={<><Button startIcon={<RefreshOutlinedIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button><Button startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate("/matflow/transfers")} sx={secondaryBtnSx}>Back</Button></>} />
        <ErrorBox>{error}</ErrorBox>
        {transfer && <>
            <Card sx={panelSx}><Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 1 }}><Detail label="Status" value={<MatFlowStatusChip status={transfer.status} />} /><Detail label="Purpose" value={transfer.purpose} /><Detail label="From" value={`${transfer.fromLocationCode || "-"} · ${transfer.fromPlantCode || "-"}`} /><Detail label="To" value={`${transfer.toLocationCode || "-"} · ${transfer.toPlantCode || "-"}`} /><Detail label="Planned" value={`${formatQty(planned)} ${transfer.uom || ""}`} /><Detail label="Dispatched" value={formatQty(dispatched)} /><Detail label="Received" value={formatQty(received)} /><Detail label="Next" value={transfer.nextAction} /></Box><Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 1.5 }}>{dispatchable && <Button startIcon={<LocalShippingOutlinedIcon />} onClick={() => openAction("DISPATCH")} sx={primaryBtnSx}>Dispatch</Button>}{receivable && <Button startIcon={<MoveToInboxOutlinedIcon />} onClick={() => openAction("RECEIVE")} sx={primaryBtnSx}>Receive</Button>}</Box></Card>
        </>}
        <Dialog open={Boolean(action)} onClose={() => !working && setAction(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}><DialogTitle sx={dialogTitleSx}>{action === "DISPATCH" ? "Dispatch Material" : "Receive Material"}</DialogTitle><DialogContent sx={dialogContentSx}><Box sx={{ display: "grid", gap: 1.5 }}><TextField type="number" label="Quantity *" value={form.quantity} onChange={(e) => setForm((c) => ({ ...c, quantity: e.target.value }))} sx={fieldSx} /><TextField label="Batch No." value={form.batchNo} onChange={(e) => setForm((c) => ({ ...c, batchNo: e.target.value }))} sx={fieldSx} /><TextField multiline minRows={2} label="Remarks" value={form.remarks} onChange={(e) => setForm((c) => ({ ...c, remarks: e.target.value }))} sx={fieldSx} /></Box></DialogContent><DialogActions sx={dialogActionsSx}><Button onClick={() => setAction(null)} sx={secondaryBtnSx}>Cancel</Button><Button onClick={execute} disabled={working} sx={primaryBtnSx}>Confirm</Button></DialogActions></Dialog>
    </Box>;
}

export function MatFlowReturnsPage() {
    const { hasRole } = useMatFlow();
    const canCreateReturn = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PRODUCTION);
    const [rows, setRows] = useState([]);
    const [requisitions, setRequisitions] = useState([]);
    const [locations, setLocations] = useState([]);
    const [returnReasons, setReturnReasons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [dialog, setDialog] = useState(false);
    const [form, setForm] = useState({ requisitionId: "", fromLocationId: "", toLocationId: "", reason: "", remarks: "", lines: {} });

    const load = useCallback(async () => {
        setLoading(true); setError("");
        try {
            const [r, q, l, metadata] = await Promise.all([
                matflowApi.listMaterialReturns(),
                matflowApi.listRequisitions(),
                matflowApi.listLocations({ active: true }),
                matflowApi.metadata(),
            ]);
            const reasons = Array.isArray(metadata?.data?.enums?.materialReturnReason)
                ? metadata.data.enums.materialReturnReason
                : [];
            setRows(Array.isArray(r?.data) ? r.data : []);
            setRequisitions(Array.isArray(q?.data) ? q.data : []);
            setLocations(Array.isArray(l?.data) ? l.data : []);
            setReturnReasons(reasons);
            setForm((current) => ({
                ...current,
                reason: reasons.includes(current.reason) ? current.reason : (reasons[0] || ""),
            }));
        } catch (requestError) { setError(readMatFlowError(requestError, "Unable to load material returns.")); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const selectedReq = requisitions.find((r) => String(r.id) === String(form.requisitionId));
    const returnableLines = (selectedReq?.lines || []).filter((line) => Math.max(0, numeric(line.issuedQty) - numeric(line.consumedQty) - numeric(line.returnedQty)) > 0);

    const createReturn = async () => {
        const lines = returnableLines.map((line) => ({ requisitionLineId: line.id, returnQty: Number(form.lines[String(line.id)] || 0), batchNo: null, remarks: null })).filter((line) => Number.isFinite(line.returnQty) && line.returnQty > 0);
        if (!form.requisitionId || !form.fromLocationId || !form.toLocationId || !form.reason || !lines.length) { setError("Requisition, source, destination, reason and at least one return quantity are required."); return; }
        setWorking(true); setError("");
        try { await matflowApi.createMaterialReturn({ requisitionId: form.requisitionId, fromLocationId: form.fromLocationId, toLocationId: form.toLocationId, reason: form.reason, remarks: clean(form.remarks) || null, lines }); setDialog(false); await load(); }
        catch (requestError) { setError(readMatFlowError(requestError, "Unable to create material return.")); }
        finally { setWorking(false); }
    };
    const act = async (row, action) => {
        setWorking(true); setError("");
        try { const body = { rowVersion: row.rowVersion, remarks: `${action === "dispatch" ? "Dispatched" : "Received"} through MatFlow return workflow.` }; if (action === "dispatch") await matflowApi.dispatchMaterialReturn(row.id, body); else await matflowApi.receiveMaterialReturn(row.id, body); await load(); }
        catch (requestError) { setError(readMatFlowError(requestError, `Unable to ${action} material return.`)); }
        finally { setWorking(false); }
    };

    return <Box sx={pageSx}>
        <PageHero badge="MATERIAL RETURN CONTROL" title="Material Returns" subtitle="Return unused issued material from Production through controlled stock movement." actions={<><Button startIcon={<RefreshOutlinedIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>{canCreateReturn && <Button startIcon={<AddIcon />} onClick={() => setDialog(true)} sx={primaryBtnSx}>Create Return</Button>}</>} />
        <ErrorBox>{error}</ErrorBox>
        <Card sx={panelSx}>{loading ? <LoadingBlock /> : <Box sx={tableShellSx}><Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 170px 180px 150px 160px 140px" }}>{["Return", "Requisition", "Route", "Reason", "Status", "Action"].map((h) => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>{rows.length === 0 ? <EmptyState /> : rows.map((row) => <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "170px 170px 180px 150px 160px 140px" }}><Box sx={tableCellSx}>{row.returnNumber}</Box><Box sx={tableCellSx}>{row.requisitionNumber}</Box><Box sx={tableCellSx}>{row.fromLocationCode} → {row.toLocationCode}</Box><Box sx={tableCellSx}>{readable(row.reason)}</Box><Box sx={tableCellSx}><MatFlowStatusChip status={row.status} /></Box><Box sx={{ ...tableCellSx, display: "flex", gap: .5 }}>{normalize(row.status) === "DRAFT" && canRoleActAtLocationType(hasRole, locations.find((l) => String(l.id) === String(row.fromLocationId))?.locationType) && <Button disabled={working} onClick={() => act(row, "dispatch")} sx={primaryBtnSx}>Dispatch</Button>}{["IN_TRANSIT", "PARTIALLY_RECEIVED"].includes(normalize(row.status)) && canRoleActAtLocationType(hasRole, locations.find((l) => String(l.id) === String(row.toLocationId))?.locationType) && <Button disabled={working} onClick={() => act(row, "receive")} sx={primaryBtnSx}>Receive</Button>}</Box></Box>)}</Box>}</Card>
        <Dialog open={dialog} onClose={() => !working && setDialog(false)} fullWidth maxWidth="md" PaperProps={{ sx: dialogPaperSx }}><DialogTitle sx={dialogTitleSx}>Create Material Return</DialogTitle><DialogContent sx={dialogContentSx}><Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}><TextField select label="Requisition *" value={form.requisitionId} onChange={(e) => { const nextId = e.target.value; const req = requisitions.find((item) => String(item.id) === String(nextId)); setForm((c) => ({ ...c, requisitionId: nextId, fromLocationId: req?.destinationLocationId || "", toLocationId: "", lines: {} })); }} sx={fieldSx}>{requisitions.map((r) => <MenuItem key={r.id} value={r.id}>{r.requisitionNumber} · {r.projectCode}</MenuItem>)}</TextField><TextField select label="Reason *" value={form.reason} onChange={(e) => setForm((c) => ({ ...c, reason: e.target.value }))} sx={fieldSx}>{returnReasons.map((v) => <MenuItem key={v} value={v}>{readable(v)}</MenuItem>)}</TextField><TextField select label="From Production Location *" value={form.fromLocationId} disabled sx={fieldSx}>{locations.filter((l) => String(l.id) === String(form.fromLocationId)).map((l) => <MenuItem key={l.id} value={l.id}>{l.locationCode} · {l.plantCode}</MenuItem>)}</TextField><TextField select label="Return To Location *" value={form.toLocationId} onChange={(e) => setForm((c) => ({ ...c, toLocationId: e.target.value }))} sx={fieldSx}>{locations.filter((l) => l.supportsStock !== false && normalize(l.locationType) !== "PRODUCTION" && String(l.id) !== String(form.fromLocationId)).map((l) => <MenuItem key={l.id} value={l.id}>{l.locationCode} · {l.plantCode} · {readable(l.locationType)}</MenuItem>)}</TextField><TextField label="Remarks" value={form.remarks} onChange={(e) => setForm((c) => ({ ...c, remarks: e.target.value }))} sx={{ ...fieldSx, gridColumn: "1 / -1" }} /></Box><Box sx={{ mt: 1.5 }}>{returnableLines.map((line) => { const max = Math.max(0, numeric(line.issuedQty) - numeric(line.consumedQty) - numeric(line.returnedQty)); return <Box key={line.id} sx={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 1, alignItems: "center", mb: 1 }}><Box><Typography sx={mainTextSx}>{line.materialCode} · {line.materialName}</Typography><Typography sx={subTextSx}>Returnable {formatQty(max)} {line.uom || ""}</Typography></Box><TextField type="number" label="Return Qty" value={form.lines[String(line.id)] ?? ""} onChange={(e) => setForm((c) => ({ ...c, lines: { ...c.lines, [String(line.id)]: e.target.value } }))} sx={fieldSx} /></Box>; })}</Box></DialogContent><DialogActions sx={dialogActionsSx}><Button onClick={() => setDialog(false)} sx={secondaryBtnSx}>Cancel</Button><Button onClick={createReturn} disabled={working} sx={primaryBtnSx}>Create Return</Button></DialogActions></Dialog>
    </Box>;
}
