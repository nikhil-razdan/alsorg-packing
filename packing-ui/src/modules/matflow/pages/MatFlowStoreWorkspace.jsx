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
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import OutputOutlinedIcon from "@mui/icons-material/OutputOutlined";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import { useNavigate, useParams } from "react-router-dom";
import { useMatFlow } from "../matflowUi";
import { extractMatFlowPage, matflowApi, readMatFlowError } from "../api/matflowApi";
import { downloadMatFlowExcel } from ".../api/matflowExcel";
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

const REVIEWABLE = new Set(["SUBMITTED_TO_STORE", "STORE_REVIEW_IN_PROGRESS"]);
const QUEUE_STATUSES = new Set([
    "SUBMITTED_TO_STORE", "STORE_REVIEW_IN_PROGRESS", "PARTIALLY_RESERVED",
    "SHORTAGE_PENDING", "READY_TO_ISSUE", "PARTIALLY_ISSUED", "ISSUED_TO_PRODUCTION",
]);

export function MatFlowStoreQueuePage() {
    const navigate = useNavigate();
    const { selectedPlantParam } = useMatFlow();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [stockRows, setStockRows] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [stockLocations, setStockLocations] = useState([]);
    const [stockDialog, setStockDialog] = useState(false);
    const [stockWorking, setStockWorking] = useState(false);
    const [stockForm, setStockForm] = useState({ materialId: "", locationId: "", adjustmentQty: "", batchNo: "", remarks: "" });

    const load = useCallback(async () => {
        setLoading(true); setError("");
        try {
            const [queueResponse, stockResponse, materialResponse, locationResponse] = await Promise.all([
                matflowApi.listStoreQueue({ plantCode: selectedPlantParam }),
                matflowApi.listStock({ plantCode: selectedPlantParam }),
                matflowApi.listMaterials({ active: true }),
                matflowApi.listLocations({ active: true }),
            ]);

            setRows((Array.isArray(queueResponse?.data) ? queueResponse.data : [])
                .filter((row) => QUEUE_STATUSES.has(normalize(row.status))));

            const allLocations = extractMatFlowPage(locationResponse?.data).rows;
            const storeLocations = allLocations.filter((location) =>
                location?.active !== false &&
                location?.supportsStock !== false &&
                normalize(location?.locationType) === "STORE" &&
                (!selectedPlantParam || String(location?.plantCode || "").toUpperCase() === String(selectedPlantParam).toUpperCase())
            );

            setStockLocations(storeLocations);
            setMaterials(extractMatFlowPage(materialResponse?.data).rows.filter((material) => material?.active !== false));

            const locationIds = new Set(storeLocations.map((location) => String(location.id)));
            setStockRows((Array.isArray(stockResponse?.data) ? stockResponse.data : [])
                .filter((balance) => locationIds.has(String(balance.locationId))));
        } catch (requestError) {
            setRows([]);
            setStockRows([]);
            setError(readMatFlowError(requestError, "Unable to load Store queue / inventory."));
        }
        finally { setLoading(false); }
    }, [selectedPlantParam]);
    useEffect(() => { load(); }, [load]);

    const filtered = useMemo(() => {
        const term = clean(search).toLowerCase();
        if (!term) return rows;
        return rows.filter((row) => [row.requisitionNumber, row.projectCode, row.drawingNo, row.bomNumber, row.destinationLocationCode, row.status].some((value) => clean(value).toLowerCase().includes(term)));
    }, [rows, search]);

    const counts = useMemo(() => ({
        review: rows.filter((row) => REVIEWABLE.has(normalize(row.status))).length,
        shortage: rows.filter((row) => normalize(row.status) === "SHORTAGE_PENDING").length,
        issue: rows.filter((row) => ["READY_TO_ISSUE", "PARTIALLY_ISSUED"].includes(normalize(row.status))).length,
    }), [rows]);

    const storeStockRows = useMemo(() => {
        const locationIds = new Set(stockLocations.map((location) => String(location.id)));
        return stockRows.filter((row) => locationIds.has(String(row.locationId)));
    }, [stockRows, stockLocations]);

    const openStockAdjustment = () => {
        setStockForm({
            materialId: "",
            locationId: stockLocations.length === 1 ? stockLocations[0].id : "",
            adjustmentQty: "",
            batchNo: "",
            remarks: "",
        });
        setStockDialog(true);
        setError("");
    };

    const saveStockAdjustment = async () => {
        const qty = Number(stockForm.adjustmentQty);
        if (!stockForm.materialId || !stockForm.locationId || !Number.isFinite(qty) || Math.abs(qty) < 0.0005) {
            setError("Material, Store location and a non-zero adjustment quantity are required.");
            return;
        }

        const existing = stockRows.find((row) =>
            String(row.materialId) === String(stockForm.materialId) &&
            String(row.locationId) === String(stockForm.locationId)
        );

        if (!existing && qty < 0) {
            setError("Opening stock must be positive. Negative adjustments are allowed only after a stock balance exists.");
            return;
        }

        setStockWorking(true);
        setError("");
        try {
            await matflowApi.adjustStock({
                materialId: stockForm.materialId,
                locationId: stockForm.locationId,
                adjustmentQty: qty,
                batchNo: clean(stockForm.batchNo) || null,
                remarks: clean(stockForm.remarks) || (existing ? "Store stock adjustment" : "Opening Store stock"),
                rowVersion: existing?.rowVersion ?? null,
            });
            setStockDialog(false);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to adjust Store stock."));
        } finally {
            setStockWorking(false);
        }
    };

    return <Box sx={pageSx}>
        <PageHero badge="STORE MATERIAL CONTROL" title="Store Review & Reservation" subtitle="Review Production demand material-by-material, reserve verified Store stock, create shortage indents for the uncovered balance, and control the first Store → QC hand-off." actions={<><Button startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMatFlowExcel({ fileName: "MatFlow_Store_Queue", sheetName: "Store Queue", title: "MatFlow Store Review & Reservation", rows })} sx={secondaryBtnSx}>Export Excel</Button><Button startIcon={<RefreshOutlinedIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button><Button startIcon={<AddOutlinedIcon />} onClick={openStockAdjustment} disabled={stockLocations.length === 0} sx={primaryBtnSx}>Adjust Stock</Button></>} />
        <ErrorBox>{error}</ErrorBox>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 1 }}><SummaryCard label="Awaiting Store Review" value={counts.review} /><SummaryCard label="Shortage Pending" value={counts.shortage} /><SummaryCard label="Ready / Partial Issue" value={counts.issue} /></Box>
        <Card sx={panelSx}>
            <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center", flexWrap: "wrap", mb: 1 }}>
                <Box><Typography sx={{ fontSize: 17, fontWeight: 950 }}>Store Inventory</Typography><Typography sx={subTextSx}>On-hand stock is operational inventory. Material Master Minimum/Reorder values are thresholds only and do not create stock.</Typography></Box>
                <Button startIcon={<AddOutlinedIcon />} onClick={openStockAdjustment} disabled={stockLocations.length === 0} sx={secondaryBtnSx}>Opening / Adjustment</Button>
            </Box>
            <Box sx={tableShellSx}>
                <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 160px 110px 110px 110px 110px" }}>{["Material", "Store", "On Hand", "Reserved", "Blocked", "Available"].map((h) => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>
                {storeStockRows.length === 0 ? <EmptyState>No Store stock balances are recorded for this plant. Use Opening / Adjustment to enter the verified physical opening stock before Store review.</EmptyState> : storeStockRows.map((row) => <Box key={row.id || `${row.materialId}:${row.locationId}`} sx={{ ...tableRowSx, gridTemplateColumns: "170px 160px 110px 110px 110px 110px" }}><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialName || "-"}</Typography><Typography sx={subTextSx}>{row.materialCode || "-"}</Typography></Box><Box sx={tableCellSx}>{row.locationCode || "-"}</Box><Box sx={tableCellSx}>{formatQty(row.onHandQty)}</Box><Box sx={tableCellSx}>{formatQty(row.reservedQty)}</Box><Box sx={tableCellSx}>{formatQty(row.blockedQty)}</Box><Box sx={tableCellSx}>{formatQty(row.availableQty)}</Box></Box>)}
            </Box>
        </Card>
        <Card sx={panelSx}><TextField label="Search Queue" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Requisition, project, drawing or BOM" sx={{ ...fieldSx, minWidth: 340 }} /></Card>
        <Card sx={panelSx}>{loading ? <LoadingBlock /> : <Box sx={tableShellSx}>
            <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 180px 150px 170px 180px 150px 100px" }}>{["Requisition", "Project / Drawing", "BOM", "Destination", "Status", "Updated", "Action"].map((h) => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>
            {filtered.length === 0 ? <EmptyState /> : filtered.map((row) => <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "170px 180px 150px 170px 180px 150px 100px" }}><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.requisitionNumber || "-"}</Typography><Typography sx={subTextSx}>By {row.requestedBy || "-"}</Typography></Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.projectCode || "-"}</Typography><Typography sx={subTextSx}>{row.drawingNo || "-"}</Typography></Box><Box sx={tableCellSx}>{row.bomNumber || "-"}</Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.destinationLocationCode || "-"}</Typography><Typography sx={subTextSx}>{row.destinationPlantCode || "-"}</Typography></Box><Box sx={tableCellSx}><MatFlowStatusChip status={row.status} /></Box><Box sx={tableCellSx}>{formatDate(row.plannedAt || row.submittedAt || row.requestedAt)}</Box><Box sx={tableCellSx}><Button onClick={() => navigate(`/matflow/store/requisitions/${row.id}`)} sx={secondaryBtnSx}>Open</Button></Box></Box>)}
        </Box>}</Card>
        <Dialog open={stockDialog} onClose={() => !stockWorking && setStockDialog(false)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
            <DialogTitle sx={dialogTitleSx}>Store Opening / Stock Adjustment</DialogTitle>
            <DialogContent sx={dialogContentSx}><Box sx={{ display: "grid", gap: 1.5 }}>
                <TextField select label="Material *" value={stockForm.materialId} onChange={(e) => setStockForm((c) => ({ ...c, materialId: e.target.value }))} sx={fieldSx}>{materials.map((material) => <MenuItem key={material.id} value={material.id}>{material.materialName} · {material.materialCode} · {material.uom}</MenuItem>)}</TextField>
                <TextField select label="Store Location *" value={stockForm.locationId} onChange={(e) => setStockForm((c) => ({ ...c, locationId: e.target.value }))} sx={fieldSx}>{stockLocations.map((location) => <MenuItem key={location.id} value={location.id}>{location.locationCode} · {location.locationName} · {location.plantCode}</MenuItem>)}</TextField>
                <TextField type="number" label="Adjustment Qty *" helperText="Positive adds stock; negative reduces existing free stock. Opening stock must be positive." value={stockForm.adjustmentQty} onChange={(e) => setStockForm((c) => ({ ...c, adjustmentQty: e.target.value }))} sx={fieldSx} />
                <TextField label="Batch No." value={stockForm.batchNo} onChange={(e) => setStockForm((c) => ({ ...c, batchNo: e.target.value }))} sx={fieldSx} />
                <TextField multiline minRows={2} label="Remarks" value={stockForm.remarks} onChange={(e) => setStockForm((c) => ({ ...c, remarks: e.target.value }))} sx={fieldSx} />
            </Box></DialogContent>
            <DialogActions sx={dialogActionsSx}><Button onClick={() => setStockDialog(false)} disabled={stockWorking} sx={secondaryBtnSx}>Cancel</Button><Button onClick={saveStockAdjustment} disabled={stockWorking} sx={primaryBtnSx}>{stockWorking ? "Saving..." : "Post Adjustment"}</Button></DialogActions>
        </Dialog>
    </Box>;
}

const autoAllocation = (line, availability) => {
    let remaining = numeric(line?.requestedQty);
    const quantities = {};
    for (const option of Array.isArray(availability?.stockOptions) ? availability.stockOptions : []) {
        const available = Math.max(0, numeric(option?.availableQty));
        if (!option?.locationId || available <= 0 || remaining <= 0) continue;
        const reserve = Math.min(available, remaining);
        quantities[String(option.locationId)] = String(Math.round(reserve * 1000) / 1000);
        remaining -= reserve;
    }
    return quantities;
};

export function MatFlowStoreDetailPage() {
    const { requisitionId } = useParams();
    const navigate = useNavigate();
    const [snapshot, setSnapshot] = useState(null);
    const [availability, setAvailability] = useState([]);
    const [allocations, setAllocations] = useState({});
    const [remarks, setRemarks] = useState("");
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [workingId, setWorkingId] = useState("");
    const [error, setError] = useState("");
    const [dispatchTarget, setDispatchTarget] = useState(null);
    const [dispatchForm, setDispatchForm] = useState({ quantity: "", batchNo: "", remarks: "" });

    const load = useCallback(async () => {
        if (!requisitionId) return;
        setLoading(true); setError("");
        try {
            const [detailResponse, availabilityResponse] = await Promise.all([
                matflowApi.getStoreReview(requisitionId),
                matflowApi.getStoreAvailability(requisitionId),
            ]);
            const nextSnapshot = detailResponse?.data || null;
            const nextAvailability = Array.isArray(availabilityResponse?.data) ? availabilityResponse.data : [];
            setSnapshot(nextSnapshot); setAvailability(nextAvailability);
            const requisition = nextSnapshot?.requisition;
            if (REVIEWABLE.has(normalize(requisition?.status))) {
                const next = {};
                (Array.isArray(requisition?.lines) ? requisition.lines : []).forEach((line) => {
                    const entry = nextAvailability.find((item) => String(item.requisitionLineId) === String(line.id));
                    next[String(line.id)] = autoAllocation(line, entry);
                });
                setAllocations(next);
            }
        } catch (requestError) { setSnapshot(null); setAvailability([]); setError(readMatFlowError(requestError, "Unable to load Store review.")); }
        finally { setLoading(false); }
    }, [requisitionId]);
    useEffect(() => { load(); }, [load]);

    const requisition = snapshot?.requisition || null;
    const lines = Array.isArray(requisition?.lines) ? requisition.lines : [];
    const reservations = Array.isArray(snapshot?.reservations) ? snapshot.reservations : [];
    const indents = Array.isArray(snapshot?.indents) ? snapshot.indents : [];
    const transfers = Array.isArray(snapshot?.transfers) ? snapshot.transfers : [];
    const availabilityByLine = useMemo(() => new Map(availability.map((entry) => [String(entry.requisitionLineId), entry])), [availability]);
    const reviewable = REVIEWABLE.has(normalize(requisition?.status)) && requisition?.rowVersion != null;

    const transfersByReservation = useMemo(() => {
        const grouped = new Map();

        transfers.forEach((transfer) => {
            const key = String(transfer?.reservationId || "");
            if (!key) return;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(transfer);
        });

        grouped.forEach((route) => route.sort((left, right) =>
            numeric(left?.routeSequenceNo) - numeric(right?.routeSequenceNo)
        ));

        return grouped;
    }, [transfers]);

    const routeForReservation = (reservation) =>
        transfersByReservation.get(String(reservation?.id || "")) || [];

    const currentTransferForReservation = (reservation) => {
        const route = routeForReservation(reservation);
        return route.find((transfer) => !["RECEIVED", "COMPLETED", "CANCELLED"].includes(normalize(transfer?.status)))
            || route[route.length - 1]
            || null;
    };

    const storeDispatchForReservation = (reservation) => routeForReservation(reservation).find((transfer) => {
        const status = normalize(transfer?.status);
        const remaining = numeric(transfer?.plannedQty) - numeric(transfer?.dispatchedQty);
        return normalize(transfer?.fromLocationType) === "STORE"
            && ["READY", "PARTIALLY_DISPATCHED", "PARTIALLY_RECEIVED"].includes(status)
            && remaining > 0.0005;
    }) || null;

    const totals = useMemo(() => lines.reduce((sum, line) => ({
        requested: sum.requested + numeric(line.requestedQty), reserved: sum.reserved + numeric(line.reservedQty), shortage: sum.shortage + numeric(line.shortageQty), issued: sum.issued + numeric(line.issuedQty),
    }), { requested: 0, reserved: 0, shortage: 0, issued: 0 }), [lines]);

    const storeActionsReady = reservations.filter((reservation) =>
        (reservation?.issueReady && numeric(reservation?.remainingIssueQty) > 0)
        || Boolean(storeDispatchForReservation(reservation))
    ).length;

    const confirmReview = async () => {
        if (!reviewable) return;

        let reviewLines;

        try {
            reviewLines = lines.map((line) => {
                const entry = availabilityByLine.get(String(line.id));
                const quantities = allocations[String(line.id)] || {};
                const stockOptions = Array.isArray(entry?.stockOptions) ? entry.stockOptions : [];
                const sourceById = new Map(stockOptions.map((option) => [String(option.locationId), option]));
                const selected = Object.entries(quantities)
                    .map(([locationId, value]) => ({ locationId, qty: numeric(value), option: sourceById.get(String(locationId)) }))
                    .filter((item) => item.option && item.qty > 0);
                const reserved = selected.reduce((sum, item) => sum + item.qty, 0);
                const requested = numeric(line.requestedQty);

                for (const item of selected) {
                    if (item.qty > numeric(item.option.availableQty) + 0.0005) {
                        throw new Error(`${item.option.locationCode} does not have enough free stock for ${line.materialCode}.`);
                    }
                }

                if (reserved > requested + 0.0005) {
                    throw new Error(`Reserved quantity exceeds requested quantity for ${line.materialCode}.`);
                }

                return {
                    requisitionLineId: line.id,
                    rowVersion: line.rowVersion,
                    allocations: selected.map((item) => ({ sourceLocationId: item.locationId, reserveQty: item.qty })),
                    // Store does not choose Processing. QC owns the post-inspection route decision.
                    processingRequired: false,
                    processingLocationId: null,
                    createIndentForShortage: reserved + 0.0005 < requested,
                    remarks: null,
                };
            });
        } catch (validationError) {
            setError(validationError?.message || "Store allocation is invalid.");
            return;
        }

        setWorking(true);
        setError("");

        try {
            await matflowApi.submitStoreReview(requisition.id, {
                rowVersion: requisition.rowVersion,
                lines: reviewLines,
                remarks: clean(remarks) || null,
            });
            setRemarks("");
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to confirm Store review."));
        } finally {
            setWorking(false);
        }
    };

    const issue = async (reservation) => {
        const remaining = numeric(reservation.remainingIssueQty ?? reservation.reservedQty) - numeric(reservation.issuedQty && reservation.remainingIssueQty == null ? reservation.issuedQty : 0);
        const qty = Math.max(0, remaining);
        if (qty <= 0) return;
        setWorkingId(String(reservation.id)); setError("");
        try { await matflowApi.issueStoreReservation(reservation.id, { rowVersion: reservation.rowVersion, quantity: qty, batchNo: null, remarks: "Issued by Store against the material requisition." }); await load(); }
        catch (requestError) { setError(readMatFlowError(requestError, "Unable to issue reserved material.")); }
        finally { setWorkingId(""); }
    };

    const openDispatch = (transfer) => {
        const pending = Math.max(0, numeric(transfer?.plannedQty) - numeric(transfer?.dispatchedQty));
        setDispatchTarget(transfer);
        setDispatchForm({
            quantity: pending > 0 ? String(pending) : "",
            batchNo: "",
            remarks: `Store dispatch ${transfer?.fromLocationCode || "Store"} → ${transfer?.toLocationCode || "next route location"}.`,
        });
        setError("");
    };

    const closeDispatch = () => {
        if (workingId) return;
        setDispatchTarget(null);
        setDispatchForm({ quantity: "", batchNo: "", remarks: "" });
    };

    const dispatchReservedMaterial = async () => {
        if (!dispatchTarget?.id) return;

        const pending = Math.max(0, numeric(dispatchTarget.plannedQty) - numeric(dispatchTarget.dispatchedQty));
        const quantity = numeric(dispatchForm.quantity);

        if (quantity <= 0 || quantity > pending + 0.0005) {
            setError(`Dispatch quantity must be greater than zero and not exceed ${formatQty(pending)}.`);
            return;
        }

        setWorkingId(String(dispatchTarget.id));
        setError("");

        try {
            await matflowApi.dispatchTransfer(dispatchTarget.id, {
                rowVersion: dispatchTarget.rowVersion,
                quantity,
                batchNo: clean(dispatchForm.batchNo) || null,
                remarks: clean(dispatchForm.remarks) || "Reserved Store material dispatched to the controlled QC gate.",
            });
            setDispatchTarget(null);
            setDispatchForm({ quantity: "", batchNo: "", remarks: "" });
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to dispatch reserved Store material."));
        } finally {
            setWorkingId("");
        }
    };

    const submitIndent = async (indent) => {
        setWorkingId(String(indent.id)); setError("");
        try { await matflowApi.submitIndent(indent.id, { rowVersion: indent.rowVersion, remarks: "Shortage confirmed by Store and submitted to Purchase." }); await load(); }
        catch (requestError) { setError(readMatFlowError(requestError, "Unable to submit shortage indent.")); }
        finally { setWorkingId(""); }
    };

    if (loading) return <LoadingBlock />;
    return <Box sx={pageSx}>
        <PageHero badge="STORE MATERIAL WORKBENCH" title={requisition?.requisitionNumber || "Store Review"} subtitle={`${requisition?.projectCode || "-"} · ${requisition?.drawingNo || "-"} · ${requisition?.bomNumber || "-"}`} actions={<><Button startIcon={<RefreshOutlinedIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button><Button startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate("/matflow/store")} sx={secondaryBtnSx}>Back</Button></>} />
        <ErrorBox>{error}</ErrorBox>
        {requisition && <>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 1 }}><SummaryCard label="Requested" value={formatQty(totals.requested)} /><SummaryCard label="Reserved" value={formatQty(totals.reserved)} /><SummaryCard label="Shortage" value={formatQty(totals.shortage)} /><SummaryCard label="Issued" value={formatQty(totals.issued)} /><SummaryCard label="Store Actions Ready" value={storeActionsReady} /></Box>

            {normalize(requisition.status) === "ISSUED_TO_PRODUCTION" && <Card sx={{ ...panelSx, border: "1px solid var(--mf-success-border)", background: "var(--mf-success-soft)" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
                    <Box>
                        <Typography sx={{ ...mainTextSx, color: "var(--mf-success-text)", fontSize: 16 }}>Material hand-off complete</Typography>
                        <Typography sx={subTextSx}>All requisition quantities have been explicitly issued to the Production destination. Store control is complete; Production can now start execution, record consumption and complete the finished product.</Typography>
                    </Box>
                    <Button onClick={() => navigate("/matflow/production-execution")} sx={primaryBtnSx}>Open Production Execution</Button>
                </Box>
            </Card>}

            <Card sx={panelSx}><Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 1 }}><Detail label="Status" value={<MatFlowStatusChip status={requisition.status} />} /><Detail label="Destination" value={requisition.destinationLocationName || requisition.destinationLocationCode} /><Detail label="Plant" value={requisition.destinationPlantCode} /><Detail label="Partial Availability" value={<MatFlowStatusChip status={requisition.partialAvailabilityDecision || "UNDECIDED"} />} /><Detail label="Production Decision By" value={requisition.partialDecisionBy || "-"} /><Detail label="Submitted" value={formatDate(requisition.submittedAt)} /><Detail label="Reservations" value={reservations.length} /><Detail label="Transfers" value={transfers.length} /><Detail label="Indents" value={indents.length} /></Box></Card>

            {reviewable && <Card sx={panelSx}>
                <Typography sx={{ fontSize: 17, fontWeight: 950 }}>Store Availability Review</Typography><Typography sx={subTextSx}>Quantities are prefilled from free recorded stock. Adjust the allocation if required; any uncovered quantity becomes a shortage indent.</Typography>
                {lines.map((line) => {
                    const entry = availabilityByLine.get(String(line.id));
                    const options = Array.isArray(entry?.stockOptions) ? entry.stockOptions : [];
                    return <Card key={line.id} sx={{ ...panelSx, mt: 1.25 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}><Box><Typography sx={mainTextSx}>{line.materialName} · {line.materialCode}</Typography><Typography sx={subTextSx}>Requested {formatQty(line.requestedQty)} {line.uom || ""} · First controlled destination: {entry?.firstDestinationLocationCode || "QC"}. QC decides whether Processing is required after inspection.</Typography></Box><Box sx={{ display: "flex", gap: .5, alignItems: "center", flexWrap: "wrap" }}><MatFlowStatusChip status={line.status || "PENDING_STORE_REVIEW"} /><MatFlowStatusChip status="QC_FIRST" /></Box></Box>
                        <Box sx={{ ...tableShellSx, mt: 1 }}><Box sx={{ ...tableHeaderSx, gridTemplateColumns: "160px 120px 100px 100px 100px 140px" }}>{["Source", "Plant", "On Hand", "Reserved", "Available", "Reserve Now"].map((h) => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>{options.length === 0 ? <EmptyState>No free stock source was returned; full quantity will become shortage.</EmptyState> : options.map((option) => <Box key={option.locationId} sx={{ ...tableRowSx, gridTemplateColumns: "160px 120px 100px 100px 100px 140px" }}><Box sx={tableCellSx}><Typography sx={mainTextSx}>{option.locationCode}</Typography><Typography sx={subTextSx}>{option.locationName}</Typography></Box><Box sx={tableCellSx}>{option.plantCode}</Box><Box sx={tableCellSx}>{formatQty(option.onHandQty)}</Box><Box sx={tableCellSx}>{formatQty(option.reservedQty)}</Box><Box sx={tableCellSx}>{formatQty(option.availableQty)}</Box><Box sx={tableCellSx}><TextField type="number" size="small" value={allocations[String(line.id)]?.[String(option.locationId)] ?? ""} onChange={(e) => setAllocations((current) => ({ ...current, [String(line.id)]: { ...(current[String(line.id)] || {}), [String(option.locationId)]: e.target.value } }))} sx={fieldSx} /></Box></Box>)}</Box>
                    </Card>;
                })}
                <TextField fullWidth label="Store Review Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} sx={{ ...fieldSx, mt: 1.5 }} />
                <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1.5 }}><Button startIcon={<Inventory2OutlinedIcon />} onClick={confirmReview} disabled={working} sx={primaryBtnSx}>{working ? "Reserving..." : "Confirm Review & Reserve"}</Button></Box>
            </Card>}

            {totals.shortage > 0 && totals.reserved > 0 && <Card sx={panelSx}><Typography sx={mainTextSx}>Production partial-availability decision</Typography><Typography sx={subTextSx}>{normalize(requisition.partialAvailabilityDecision) === "ISSUE_AVAILABLE_NOW" ? "Production has authorized available quantity to continue to QC now. QC will decide Direct-to-Production or optional Processing after inspection." : normalize(requisition.partialAvailabilityDecision) === "HOLD_UNTIL_SHORTAGE_COMPLETE" ? "Production has instructed Store to hold the available quantity until shortage procurement is completed." : "Production decision is pending. Store can reserve and procure shortage, but final issue is blocked until Production decides."}</Typography></Card>}
            <Card sx={panelSx}>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "flex-start", flexWrap: "wrap", mb: 1 }}>
                    <Box>
                        <Typography sx={{ fontSize: 17, fontWeight: 950 }}>Reservations & Route Control</Typography>
                        <Typography sx={subTextSx}>Store owns reservation and the first physical hand-off only. Dispatch READY Store stock to QC. After inspection, QC owns the Direct-to-Production vs optional Processing decision; Store issues only when the accepted route reaches Production staging.</Typography>
                    </Box>
                    <Button onClick={() => navigate("/matflow/transfers")} sx={secondaryBtnSx}>Open Transfer Desk</Button>
                </Box>
                <Box sx={tableShellSx}>
                    <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "165px 135px 105px minmax(280px,1fr) 155px 175px" }}>{["Material", "Source", "Reserved", "Live Route / Custody", "Next Owner", "Action"].map((h) => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>
                    {reservations.length === 0 ? <EmptyState>No reservations created yet.</EmptyState> : reservations.map((reservation) => {
                        const route = routeForReservation(reservation);
                        const currentTransfer = currentTransferForReservation(reservation);
                        const dispatchableTransfer = storeDispatchForReservation(reservation);
                        const remainingIssue = numeric(reservation?.remainingIssueQty);
                        const nextOwner = reservation?.issueReady
                            ? "STORE · ISSUE"
                            : currentTransfer?.responsibleDepartment || reservation?.responsibleDepartment || "ROUTE";
                        const nextAction = reservation?.issueReady
                            ? "ISSUE_TO_PRODUCTION"
                            : currentTransfer?.nextAction || reservation?.nextAction || "COMPLETE_ROUTE";

                        return <Box key={reservation.id} sx={{ ...tableRowSx, gridTemplateColumns: "165px 135px 105px minmax(280px,1fr) 155px 175px", alignItems: "center" }}>
                            <Box sx={tableCellSx}>
                                <Typography sx={mainTextSx}>{reservation.materialCode || "-"}</Typography>
                                <MatFlowStatusChip status={reservation.status} />
                            </Box>
                            <Box sx={tableCellSx}>{reservation.sourceLocationCode || "-"}</Box>
                            <Box sx={tableCellSx}>{formatQty(reservation.reservedQty)}</Box>
                            <Box sx={tableCellSx}>
                                {route.length === 0 ? <Typography sx={subTextSx}>Route not generated.</Typography> : <Box sx={{ display: "flex", gap: .7, alignItems: "stretch", flexWrap: "wrap" }}>
                                    <Box sx={{ px: 1, py: .65, border: "1px solid var(--mf-border)", borderRadius: 1.5, minWidth: 88 }}>
                                        <Typography sx={{ ...subTextSx, fontSize: 10 }}>SOURCE</Typography>
                                        <Typography sx={{ ...mainTextSx, fontSize: 12 }}>{reservation.sourceLocationCode || "STORE"}</Typography>
                                    </Box>
                                    {route.map((transfer) => <Box key={transfer.id} sx={{ px: 1, py: .65, border: "1px solid var(--mf-border)", borderRadius: 1.5, minWidth: 110, background: normalize(transfer.status) === "READY" ? "var(--mf-primary-soft)" : "transparent" }}>
                                        <Typography sx={{ ...subTextSx, fontSize: 10 }}>→ {transfer.toLocationCode || "NEXT"}</Typography>
                                        <Box sx={{ mt: .35 }}><MatFlowStatusChip status={transfer.status} /></Box>
                                    </Box>)}
                                </Box>}
                            </Box>
                            <Box sx={tableCellSx}>
                                <Typography sx={mainTextSx}>{readable(nextOwner)}</Typography>
                                <Typography sx={subTextSx}>{readable(nextAction)}</Typography>
                            </Box>
                            <Box sx={tableCellSx}>
                                {reservation.issueReady && remainingIssue > 0 ? <Button startIcon={<OutputOutlinedIcon />} disabled={workingId === String(reservation.id)} onClick={() => issue(reservation)} sx={primaryBtnSx}>Issue</Button>
                                    : dispatchableTransfer ? <Button startIcon={<OutputOutlinedIcon />} disabled={workingId === String(dispatchableTransfer.id)} onClick={() => openDispatch(dispatchableTransfer)} sx={primaryBtnSx}>Dispatch to {dispatchableTransfer.toLocationCode || "Route"}</Button>
                                        : currentTransfer ? <Button onClick={() => navigate(`/matflow/transfers/${currentTransfer.id}`)} sx={secondaryBtnSx}>View Route</Button>
                                            : <Typography sx={subTextSx}>Waiting for route</Typography>}
                            </Box>
                        </Box>;
                    })}
                </Box>
            </Card>

            <Card sx={panelSx}><Typography sx={{ fontSize: 17, fontWeight: 950, mb: 1 }}>Shortage Indents</Typography><Box sx={tableShellSx}><Box sx={{ ...tableHeaderSx, gridTemplateColumns: "180px 150px 150px 180px 120px" }}>{["Indent", "Deliver To", "Status", "Lines", "Action"].map((h) => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>{indents.length === 0 ? <EmptyState>No shortage indent exists.</EmptyState> : indents.map((indent) => <Box key={indent.id} sx={{ ...tableRowSx, gridTemplateColumns: "180px 150px 150px 180px 120px" }}><Box sx={tableCellSx}>{indent.indentNumber || "-"}</Box><Box sx={tableCellSx}>{indent.deliverToLocationCode || "-"}</Box><Box sx={tableCellSx}><MatFlowStatusChip status={indent.status} /></Box><Box sx={tableCellSx}>{(indent.lines || []).map((line) => `${line.materialCode}: ${formatQty(line.requiredQty)}`).join(" · ") || "-"}</Box><Box sx={tableCellSx}>{["AUTO_CREATED", "DRAFT", "RETURNED"].includes(normalize(indent.status)) ? <Button startIcon={<ShoppingCartOutlinedIcon />} disabled={workingId === String(indent.id)} onClick={() => submitIndent(indent)} sx={primaryBtnSx}>Send to Purchase</Button> : "-"}</Box></Box>)}</Box></Card>
        </>}

        <Dialog open={Boolean(dispatchTarget)} onClose={closeDispatch} PaperProps={{ sx: dialogPaperSx }}>
            <DialogTitle sx={dialogTitleSx}>Dispatch Reserved Material</DialogTitle>
            <DialogContent sx={dialogContentSx}>
                <Typography sx={mainTextSx}>{dispatchTarget?.transferNumber || "Transfer"}</Typography>
                <Typography sx={{ ...subTextSx, mb: 1.5 }}>{dispatchTarget?.materialCode || "Material"} · {dispatchTarget?.fromLocationCode || "Store"} → {dispatchTarget?.toLocationCode || "Next route location"}</Typography>
                <Box sx={{ display: "grid", gap: 1.25 }}>
                    <TextField type="number" label="Dispatch Quantity" value={dispatchForm.quantity} onChange={(e) => setDispatchForm((current) => ({ ...current, quantity: e.target.value }))} sx={fieldSx} />
                    <TextField label="Batch / Lot (optional)" value={dispatchForm.batchNo} onChange={(e) => setDispatchForm((current) => ({ ...current, batchNo: e.target.value }))} sx={fieldSx} />
                    <TextField multiline minRows={2} label="Dispatch Remarks" value={dispatchForm.remarks} onChange={(e) => setDispatchForm((current) => ({ ...current, remarks: e.target.value }))} sx={fieldSx} />
                </Box>
            </DialogContent>
            <DialogActions sx={dialogActionsSx}>
                <Button onClick={closeDispatch} disabled={Boolean(workingId)} sx={secondaryBtnSx}>Cancel</Button>
                <Button startIcon={<OutputOutlinedIcon />} onClick={dispatchReservedMaterial} disabled={!dispatchTarget || Boolean(workingId)} sx={primaryBtnSx}>{workingId ? "Dispatching..." : `Dispatch to ${dispatchTarget?.toLocationCode || "Route"}`}</Button>
            </DialogActions>
        </Dialog>
    </Box>;
}
