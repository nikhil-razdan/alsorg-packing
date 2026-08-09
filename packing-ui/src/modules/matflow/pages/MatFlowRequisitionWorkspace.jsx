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
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import PlayArrowOutlinedIcon from "@mui/icons-material/PlayArrowOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MATFLOW_ROLES, useMatFlow } from "../matflowUi";
import { extractMatFlowPage, matflowApi, readMatFlowError } from "../api/matflowApi";
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

const CREATE_ROLES = [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PRODUCTION];
const PAGE_SIZE = 25;

export function MatFlowRequisitionListPage() {
    const navigate = useNavigate();
    const { hasRole, selectedPlantParam } = useMatFlow();
    const canCreate = hasRole(CREATE_ROLES);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [page, setPage] = useState(0);

    const load = useCallback(async () => {
        setLoading(true); setError("");
        try {
            const response = await matflowApi.listRequisitions();
            setRows(Array.isArray(response?.data) ? response.data : []);
        } catch (requestError) {
            setRows([]); setError(readMatFlowError(requestError, "Unable to load Production requisitions."));
        } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const statusOptions = useMemo(() => ["", ...Array.from(new Set(rows.map((row) => normalize(row.status)).filter(Boolean))).sort()], [rows]);
    const filtered = useMemo(() => {
        const term = clean(search).toLowerCase();
        return rows.filter((row) => {
            if (selectedPlantParam && normalize(row.destinationPlantCode) !== normalize(selectedPlantParam)) return false;
            if (status && normalize(row.status) !== normalize(status)) return false;
            if (!term) return true;
            return [row.requisitionNumber, row.projectCode, row.drawingNo, row.bomNumber, row.destinationLocationCode, row.destinationLocationName, row.requestedBy]
                .some((value) => clean(value).toLowerCase().includes(term));
        });
    }, [rows, search, status, selectedPlantParam]);
    const totalPages = filtered.length ? Math.ceil(filtered.length / PAGE_SIZE) : 0;
    const safePage = Math.min(page, Math.max(totalPages - 1, 0));
    const displayed = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

    return (
        <Box sx={pageSx}>
            <PageHero badge="PRODUCTION MATERIAL CONTROL" title="Production Requisitions" subtitle="Raise and track material demand against Production-approved, effective MatFlow BOM revisions." actions={<><Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>{canCreate && <Button startIcon={<AddIcon />} onClick={() => navigate("/matflow/requisitions/new")} sx={primaryBtnSx}>Create Requisition</Button>}</>} />
            <Card sx={panelSx}><Box sx={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 1 }}>
                <TextField label="Search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} sx={fieldSx} />
                <TextField select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} sx={fieldSx}>{statusOptions.map((item) => <MenuItem key={item || "ALL"} value={item}>{item ? readable(item) : "All Statuses"}</MenuItem>)}</TextField>
            </Box></Card>
            <ErrorBox>{error}</ErrorBox>
            <Card sx={panelSx}>{loading ? <LoadingBlock /> : <Box sx={tableShellSx}>
                <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 170px 150px 170px 180px 140px 100px" }}>{["Requisition", "Project / Drawing", "BOM", "Destination", "Status", "Requested", "Action"].map((h) => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>
                {displayed.length === 0 ? <EmptyState /> : displayed.map((row) => <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "170px 170px 150px 170px 180px 140px 100px" }}>
                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.requisitionNumber || "-"}</Typography><Typography sx={subTextSx}>Version {row.rowVersion ?? "-"}</Typography></Box>
                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.projectCode || "-"}</Typography><Typography sx={subTextSx}>{row.drawingNo || "-"}</Typography></Box>
                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.bomNumber || "-"}</Typography><Typography sx={subTextSx}>Rev {row.bomRevisionNo ?? "-"}</Typography></Box>
                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.destinationLocationCode || "-"}</Typography><Typography sx={subTextSx}>{row.destinationPlantCode || "-"}</Typography></Box>
                    <Box sx={tableCellSx}><MatFlowStatusChip status={row.status} /></Box>
                    <Box sx={tableCellSx}>{formatDate(row.requestedAt)}</Box>
                    <Box sx={tableCellSx}><Button onClick={() => navigate(`/matflow/requisitions/${row.id}`)} sx={secondaryBtnSx}>Open</Button></Box>
                </Box>)}
            </Box>}
                <Box sx={{ mt: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}><Button disabled={safePage <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))} sx={secondaryBtnSx}>Previous</Button><Typography sx={subTextSx}>Page {safePage + 1} of {Math.max(totalPages, 1)}</Typography><Button disabled={safePage + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} sx={secondaryBtnSx}>Next</Button></Box>
            </Card>
        </Box>
    );
}

export function MatFlowRequisitionCreatePage() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const initialBomId = params.get("bomId") || "";
    const [boms, setBoms] = useState([]);
    const [locations, setLocations] = useState([]);
    const [selectedBomId, setSelectedBomId] = useState(initialBomId);
    const [selectedBom, setSelectedBom] = useState(null);
    const [destinationLocationId, setDestinationLocationId] = useState("");
    const [lineInputs, setLineInputs] = useState({});
    const [remarks, setRemarks] = useState("");
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const [b, l] = await Promise.all([matflowApi.listBoms({ status: "APPROVED", latestOnly: false }), matflowApi.listLocations({ active: true })]);
                if (!active) return;
                setBoms(extractMatFlowPage(b?.data).rows.filter((bom) => normalize(bom.status) === "APPROVED" && bom.effective === true));
                setLocations(extractMatFlowPage(l?.data).rows.filter((location) => location.active !== false && normalize(location.locationType) === "PRODUCTION"));
            } catch (requestError) { if (active) setError(readMatFlowError(requestError, "Unable to load approved BOMs and Production locations.")); }
            finally { if (active) setLoading(false); }
        })();
        return () => { active = false; };
    }, []);

    useEffect(() => {
        if (!selectedBomId) { setSelectedBom(null); setLineInputs({}); return; }
        let active = true;
        (async () => {
            try {
                const response = await matflowApi.getBom(selectedBomId);
                const loaded = response?.data || null;
                if (!active) return;
                setSelectedBom(loaded);
                const next = {};
                ([loaded?.lines, loaded?.bomLines, loaded?.items].find(Array.isArray) || []).forEach((line) => {
                    if (line?.id) next[String(line.id)] = String(Number(line.netRequiredQty ?? line.requiredQty ?? 0) || "");
                });
                setLineInputs(next);
            } catch (requestError) { if (active) setError(readMatFlowError(requestError, "Unable to load selected BOM.")); }
        })();
        return () => { active = false; };
    }, [selectedBomId]);

    const lines = useMemo(() => [selectedBom?.lines, selectedBom?.bomLines, selectedBom?.items].find(Array.isArray) || [], [selectedBom]);
    const project = selectedBom?.projectDrawing || {};
    const plant = normalize(project.plantCode || project.owningPlantCode);
    const destinationOptions = locations.filter((location) => !plant || normalize(location.plantCode) === plant);

    useEffect(() => {
        if (destinationOptions.length === 1) setDestinationLocationId(destinationOptions[0].id);
        else if (!destinationOptions.some((location) => String(location.id) === String(destinationLocationId))) setDestinationLocationId("");
    }, [destinationOptions, destinationLocationId]);

    const create = async () => {
        if (!selectedBom?.id || !project?.id || !destinationLocationId) { setError("Select an approved BOM and Production destination."); return; }
        const requestLines = lines.map((line) => ({ line, qty: Number(lineInputs[String(line.id)] || 0) })).filter((entry) => Number.isFinite(entry.qty) && entry.qty > 0);
        if (!requestLines.length) { setError("Enter a requested quantity for at least one material."); return; }
        for (const entry of requestLines) {
            const max = Number(entry.line.netRequiredQty ?? entry.line.requiredQty ?? 0);
            if (entry.qty > max) { setError(`${entry.line.materialCodeSnapshot || entry.line.materialNameSnapshot}: quantity cannot exceed BOM net requirement ${formatQty(max)}.`); return; }
        }
        setWorking(true); setError("");
        try {
            const response = await matflowApi.createRequisition({
                projectDrawingId: project.id,
                bomId: selectedBom.id,
                destinationLocationId,
                remarks: clean(remarks) || null,
                lines: requestLines.map((entry) => ({ bomLineId: entry.line.id, requestedQty: entry.qty, remarks: null })),
            });
            if (!response?.data?.id) throw new Error("Created requisition ID was not returned.");
            navigate(`/matflow/requisitions/${response.data.id}`, { replace: true });
        } catch (requestError) { setError(readMatFlowError(requestError, "Unable to create Production requisition.")); }
        finally { setWorking(false); }
    };

    if (loading) return <LoadingBlock />;
    return <Box sx={pageSx}>
        <PageHero badge="NEW PRODUCTION REQUISITION" title="Raise Material Requisition" subtitle="Request material directly against an approved, effective MatFlow BOM." actions={<Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/matflow/production")} sx={secondaryBtnSx}>Back</Button>} />
        <ErrorBox>{error}</ErrorBox>
        <Card sx={panelSx}><Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
            <TextField select label="Approved BOM *" value={selectedBomId} onChange={(e) => setSelectedBomId(e.target.value)} sx={fieldSx}>{boms.map((bom) => <MenuItem key={bom.id} value={bom.id}>{bom.bomNumber} · Rev {bom.revisionNo} · {bom.projectCode || bom.productName}</MenuItem>)}</TextField>
            <TextField select label="Production Destination *" value={destinationLocationId} onChange={(e) => setDestinationLocationId(e.target.value)} sx={fieldSx}>{destinationOptions.map((location) => <MenuItem key={location.id} value={location.id}>{location.locationCode} · {location.locationName}</MenuItem>)}</TextField>
            <TextField label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} sx={{ ...fieldSx, gridColumn: "1 / -1" }} />
        </Box></Card>
        {selectedBom && <Card sx={panelSx}><Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 1 }}><Detail label="Project" value={project.projectCode} /><Detail label="Drawing" value={project.drawingNo} /><Detail label="Product" value={project.productName} /><Detail label="Plant" value={project.plantCode || project.owningPlantCode} /><Detail label="BOM" value={`${selectedBom.bomNumber} · Rev ${selectedBom.revisionNo}`} /></Box></Card>}
        <Card sx={panelSx}><Typography sx={{ fontWeight: 950, mb: 1 }}>Requested Materials</Typography><Box sx={tableShellSx}><Box sx={{ ...tableHeaderSx, gridTemplateColumns: "70px 220px 120px 130px 150px" }}>{["Line", "Material", "BOM Net Qty", "UOM", "Request Qty"].map((h) => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>{lines.length === 0 ? <EmptyState>Select a BOM.</EmptyState> : lines.map((line) => <Box key={line.id} sx={{ ...tableRowSx, gridTemplateColumns: "70px 220px 120px 130px 150px" }}><Box sx={tableCellSx}>{line.lineNo}</Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{line.materialCodeSnapshot || line.materialCode}</Typography><Typography sx={subTextSx}>{line.materialNameSnapshot || line.materialName}</Typography></Box><Box sx={tableCellSx}>{formatQty(line.netRequiredQty ?? line.requiredQty)}</Box><Box sx={tableCellSx}>{line.uomSnapshot || line.uom || "-"}</Box><Box sx={tableCellSx}><TextField type="number" size="small" value={lineInputs[String(line.id)] ?? ""} onChange={(e) => setLineInputs((current) => ({ ...current, [String(line.id)]: e.target.value }))} sx={fieldSx} /></Box></Box>)}</Box></Card>
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}><Button startIcon={<AddIcon />} onClick={create} disabled={working || !selectedBomId} sx={primaryBtnSx}>{working ? "Creating..." : "Create Draft Requisition"}</Button></Box>
    </Box>;
}

export function MatFlowRequisitionDetailPage() {
    const { requisitionId } = useParams();
    const navigate = useNavigate();
    const { hasRole } = useMatFlow();
    const [requisition, setRequisition] = useState(null);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [action, setAction] = useState(null);
    const [remarks, setRemarks] = useState("");

    const load = useCallback(async () => {
        if (!requisitionId) return;
        setLoading(true); setError("");
        try { const response = await matflowApi.getRequisition(requisitionId); setRequisition(response?.data || null); }
        catch (requestError) { setError(readMatFlowError(requestError, "Unable to load material requisition.")); }
        finally { setLoading(false); }
    }, [requisitionId]);
    useEffect(() => { load(); }, [load]);

    const lines = Array.isArray(requisition?.lines) ? requisition.lines : [];
    const totals = useMemo(() => lines.reduce((sum, line) => ({
        requested: sum.requested + Number(line.requestedQty || 0),
        reserved: sum.reserved + Number(line.reservedQty || 0),
        shortage: sum.shortage + Number(line.shortageQty || 0),
        issued: sum.issued + Number(line.issuedQty || 0),
        consumed: sum.consumed + Number(line.consumedQty || 0),
        returned: sum.returned + Number(line.returnedQty || 0),
    }), { requested: 0, reserved: 0, shortage: 0, issued: 0, consumed: 0, returned: 0 }), [lines]);
    const status = normalize(requisition?.status);
    const productionRole = hasRole(CREATE_ROLES);
    const canSubmit = productionRole && status === "DRAFT" && lines.length > 0 && requisition?.rowVersion != null;
    const canStart = productionRole && status === "ISSUED_TO_PRODUCTION" && requisition?.rowVersion != null;
    const canComplete = productionRole && status === "PRODUCTION_STARTED" && requisition?.rowVersion != null;
    const isPartialAvailability = totals.shortage > 0 && (totals.reserved > 0 || totals.issued > 0);
    const partialDecision = normalize(requisition?.partialAvailabilityDecision || "UNDECIDED");
    const canDecidePartial = productionRole && isPartialAvailability && requisition?.rowVersion != null && !["CANCELLED", "PRODUCTION_STARTED", "PRODUCTION_COMPLETED"].includes(status);

    const execute = async () => {
        if (!action || !requisition?.id || requisition.rowVersion == null) return;
        setWorking(true); setError("");
        const body = { rowVersion: requisition.rowVersion, remarks: clean(remarks) || null };
        try {
            if (action === "SUBMIT") await matflowApi.submitRequisition(requisition.id, body);
            if (action === "START") await matflowApi.startProduction(requisition.id, body);
            if (action === "COMPLETE") await matflowApi.completeProduction(requisition.id, body);
            if (action === "PARTIAL_ISSUE") await matflowApi.decidePartialAvailability(requisition.id, { ...body, decision: "ISSUE_AVAILABLE_NOW" });
            if (action === "PARTIAL_HOLD") await matflowApi.decidePartialAvailability(requisition.id, { ...body, decision: "HOLD_UNTIL_SHORTAGE_COMPLETE" });
            setAction(null); setRemarks(""); await load();
        } catch (requestError) { setError(readMatFlowError(requestError, "Unable to complete Production action.")); }
        finally { setWorking(false); }
    };

    if (loading) return <LoadingBlock />;
    return <Box sx={pageSx}>
        <PageHero badge="PRODUCTION MATERIAL REQUISITION" title={requisition?.requisitionNumber || "Requisition"} subtitle={`${requisition?.projectCode || "-"} · ${requisition?.drawingNo || "-"} · ${requisition?.bomNumber || "-"}`} actions={<><Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button><Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/matflow/production")} sx={secondaryBtnSx}>Back</Button></>} />
        <ErrorBox>{error}</ErrorBox>
        {requisition && <>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 1 }}><SummaryCard label="Status" value={<MatFlowStatusChip status={requisition.status} />} /><SummaryCard label="Requested" value={formatQty(totals.requested)} /><SummaryCard label="Reserved" value={formatQty(totals.reserved)} /><SummaryCard label="Shortage" value={formatQty(totals.shortage)} /><SummaryCard label="Issued" value={formatQty(totals.issued)} /><SummaryCard label="Consumed" value={formatQty(totals.consumed)} /></Box>
            <Card sx={panelSx}><Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(175px,1fr))", gap: 1 }}><Detail label="Project" value={requisition.projectCode} /><Detail label="Drawing" value={requisition.drawingNo} /><Detail label="BOM" value={`${requisition.bomNumber || "-"} · Rev ${requisition.bomRevisionNo ?? "-"}`} /><Detail label="Destination" value={requisition.destinationLocationName || requisition.destinationLocationCode} /><Detail label="Plant" value={requisition.destinationPlantCode} /><Detail label="Partial Availability" value={<MatFlowStatusChip status={requisition.partialAvailabilityDecision || "UNDECIDED"} />} /><Detail label="Decision By" value={requisition.partialDecisionBy || "-"} /><Detail label="Requested By" value={requisition.requestedBy} /><Detail label="Requested At" value={formatDate(requisition.requestedAt)} /><Detail label="Submitted At" value={formatDate(requisition.submittedAt)} /><Detail label="Remarks" value={requisition.remarks} /></Box>
                <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 1.5, flexWrap: "wrap" }}>{canSubmit && <Button startIcon={<SendOutlinedIcon />} onClick={() => setAction("SUBMIT")} sx={primaryBtnSx}>Submit to Store</Button>}{canDecidePartial && <Button onClick={() => setAction("PARTIAL_ISSUE")} sx={partialDecision === "ISSUE_AVAILABLE_NOW" ? primaryBtnSx : secondaryBtnSx}>Issue Available Now</Button>}{canDecidePartial && <Button onClick={() => setAction("PARTIAL_HOLD")} sx={partialDecision === "HOLD_UNTIL_SHORTAGE_COMPLETE" ? primaryBtnSx : secondaryBtnSx}>Hold Until Shortage Complete</Button>}{canStart && <Button startIcon={<PlayArrowOutlinedIcon />} onClick={() => setAction("START")} sx={primaryBtnSx}>Start Production</Button>}{canComplete && <Button startIcon={<TaskAltOutlinedIcon />} onClick={() => setAction("COMPLETE")} sx={primaryBtnSx}>Complete Finished Product</Button>}</Box></Card>
            <Card sx={panelSx}><Typography sx={{ fontWeight: 950, mb: 1 }}>Material Lines</Typography><Box sx={tableShellSx}><Box sx={{ ...tableHeaderSx, gridTemplateColumns: "70px 190px 100px 100px 100px 100px 100px 100px 160px" }}>{["Line", "Material", "Requested", "Reserved", "Shortage", "Issued", "Consumed", "Returned", "Status"].map((h) => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>{lines.map((line) => <Box key={line.id} sx={{ ...tableRowSx, gridTemplateColumns: "70px 190px 100px 100px 100px 100px 100px 100px 160px" }}><Box sx={tableCellSx}>{line.lineNo}</Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{line.materialCode}</Typography><Typography sx={subTextSx}>{line.materialName}</Typography></Box><Box sx={tableCellSx}>{formatQty(line.requestedQty)}</Box><Box sx={tableCellSx}>{formatQty(line.reservedQty)}</Box><Box sx={tableCellSx}>{formatQty(line.shortageQty)}</Box><Box sx={tableCellSx}>{formatQty(line.issuedQty)}</Box><Box sx={tableCellSx}>{formatQty(line.consumedQty)}</Box><Box sx={tableCellSx}>{formatQty(line.returnedQty)}</Box><Box sx={tableCellSx}><MatFlowStatusChip status={line.status || requisition.status} /></Box></Box>)}</Box></Card>
        </>}
        <Dialog open={Boolean(action)} onClose={() => !working && setAction(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}><DialogTitle sx={dialogTitleSx}>{action === "SUBMIT" ? "Submit Requisition to Store" : action === "START" ? "Start Production" : action === "COMPLETE" ? "Complete Finished Product" : action === "PARTIAL_ISSUE" ? "Issue Available Quantity Now" : "Hold Available Quantity"}</DialogTitle><DialogContent sx={dialogContentSx}><TextField fullWidth multiline minRows={3} label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} sx={fieldSx} /></DialogContent><DialogActions sx={dialogActionsSx}><Button onClick={() => setAction(null)} sx={secondaryBtnSx}>Cancel</Button><Button onClick={execute} disabled={working} sx={primaryBtnSx}>{working ? "Working..." : "Confirm"}</Button></DialogActions></Dialog>
    </Box>;
}
