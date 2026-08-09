import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Box,
    Button,
    Card,
    TextField,
    Typography,
} from "@mui/material";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import OutputOutlinedIcon from "@mui/icons-material/OutputOutlined";
import { useNavigate, useParams } from "react-router-dom";
import { useMatFlow } from "../matflowUi";
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
    fieldSx,
    formatDate,
    formatQty,
    mainTextSx,
    normalize,
    numeric,
    pageSx,
    panelSx,
    primaryBtnSx,
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

    const load = useCallback(async () => {
        setLoading(true); setError("");
        try {
            const response = await matflowApi.listStoreQueue({ plantCode: selectedPlantParam });
            setRows((Array.isArray(response?.data) ? response.data : []).filter((row) => QUEUE_STATUSES.has(normalize(row.status))));
        } catch (requestError) { setRows([]); setError(readMatFlowError(requestError, "Unable to load Store material queue.")); }
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

    return <Box sx={pageSx}>
        <PageHero badge="STORE MATERIAL CONTROL" title="Store Review & Reservation" subtitle="Review Production demand, reserve recorded stock, create shortage indents and issue route-complete material to Production." actions={<Button startIcon={<RefreshOutlinedIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>} />
        <ErrorBox>{error}</ErrorBox>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 1 }}><SummaryCard label="Awaiting Store Review" value={counts.review} /><SummaryCard label="Shortage Pending" value={counts.shortage} /><SummaryCard label="Ready / Partial Issue" value={counts.issue} /></Box>
        <Card sx={panelSx}><TextField label="Search Queue" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Requisition, project, drawing or BOM" sx={{ ...fieldSx, minWidth: 340 }} /></Card>
        <Card sx={panelSx}>{loading ? <LoadingBlock /> : <Box sx={tableShellSx}>
            <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 180px 150px 170px 180px 150px 100px" }}>{["Requisition", "Project / Drawing", "BOM", "Destination", "Status", "Updated", "Action"].map((h) => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>
            {filtered.length === 0 ? <EmptyState /> : filtered.map((row) => <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "170px 180px 150px 170px 180px 150px 100px" }}><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.requisitionNumber || "-"}</Typography><Typography sx={subTextSx}>By {row.requestedBy || "-"}</Typography></Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.projectCode || "-"}</Typography><Typography sx={subTextSx}>{row.drawingNo || "-"}</Typography></Box><Box sx={tableCellSx}>{row.bomNumber || "-"}</Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.destinationLocationCode || "-"}</Typography><Typography sx={subTextSx}>{row.destinationPlantCode || "-"}</Typography></Box><Box sx={tableCellSx}><MatFlowStatusChip status={row.status} /></Box><Box sx={tableCellSx}>{formatDate(row.plannedAt || row.submittedAt || row.requestedAt)}</Box><Box sx={tableCellSx}><Button onClick={() => navigate(`/matflow/store/requisitions/${row.id}`)} sx={secondaryBtnSx}>Open</Button></Box></Box>)}
        </Box>}</Card>
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

    const totals = useMemo(() => lines.reduce((sum, line) => ({
        requested: sum.requested + numeric(line.requestedQty), reserved: sum.reserved + numeric(line.reservedQty), shortage: sum.shortage + numeric(line.shortageQty), issued: sum.issued + numeric(line.issuedQty),
    }), { requested: 0, reserved: 0, shortage: 0, issued: 0 }), [lines]);

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
                    processingRequired: entry?.processingRequired === true,
                    processingLocationId: entry?.processingRequired === true ? entry?.firstProcessingLocationId ?? null : null,
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
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 1 }}><SummaryCard label="Requested" value={formatQty(totals.requested)} /><SummaryCard label="Reserved" value={formatQty(totals.reserved)} /><SummaryCard label="Shortage" value={formatQty(totals.shortage)} /><SummaryCard label="Issued" value={formatQty(totals.issued)} /></Box>
            <Card sx={panelSx}><Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 1 }}><Detail label="Status" value={<MatFlowStatusChip status={requisition.status} />} /><Detail label="Destination" value={requisition.destinationLocationName || requisition.destinationLocationCode} /><Detail label="Plant" value={requisition.destinationPlantCode} /><Detail label="Partial Availability" value={<MatFlowStatusChip status={requisition.partialAvailabilityDecision || "UNDECIDED"} />} /><Detail label="Production Decision By" value={requisition.partialDecisionBy || "-"} /><Detail label="Submitted" value={formatDate(requisition.submittedAt)} /><Detail label="Reservations" value={reservations.length} /><Detail label="Transfers" value={transfers.length} /><Detail label="Indents" value={indents.length} /></Box></Card>

            {reviewable && <Card sx={panelSx}>
                <Typography sx={{ fontSize: 17, fontWeight: 950 }}>Store Availability Review</Typography><Typography sx={subTextSx}>Quantities are prefilled from free recorded stock. Adjust the allocation if required; any uncovered quantity becomes a shortage indent.</Typography>
                {lines.map((line) => {
                    const entry = availabilityByLine.get(String(line.id));
                    const options = Array.isArray(entry?.stockOptions) ? entry.stockOptions : [];
                    return <Card key={line.id} sx={{ ...panelSx, mt: 1.25 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}><Box><Typography sx={mainTextSx}>{line.materialCode} · {line.materialName}</Typography><Typography sx={subTextSx}>Requested {formatQty(line.requestedQty)} {line.uom || ""} · Approved route: {entry?.approvedRoute || entry?.firstDestinationLocationCode || requisition.destinationLocationCode}</Typography></Box><MatFlowStatusChip status={entry?.processingRequired ? "PROCESSING_REQUIRED" : "READY"} /></Box>
                        <Box sx={{ ...tableShellSx, mt: 1 }}><Box sx={{ ...tableHeaderSx, gridTemplateColumns: "160px 120px 100px 100px 100px 140px" }}>{["Source", "Plant", "On Hand", "Reserved", "Available", "Reserve Now"].map((h) => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>{options.length === 0 ? <EmptyState>No free stock source was returned; full quantity will become shortage.</EmptyState> : options.map((option) => <Box key={option.locationId} sx={{ ...tableRowSx, gridTemplateColumns: "160px 120px 100px 100px 100px 140px" }}><Box sx={tableCellSx}><Typography sx={mainTextSx}>{option.locationCode}</Typography><Typography sx={subTextSx}>{option.locationName}</Typography></Box><Box sx={tableCellSx}>{option.plantCode}</Box><Box sx={tableCellSx}>{formatQty(option.onHandQty)}</Box><Box sx={tableCellSx}>{formatQty(option.reservedQty)}</Box><Box sx={tableCellSx}>{formatQty(option.availableQty)}</Box><Box sx={tableCellSx}><TextField type="number" size="small" value={allocations[String(line.id)]?.[String(option.locationId)] ?? ""} onChange={(e) => setAllocations((current) => ({ ...current, [String(line.id)]: { ...(current[String(line.id)] || {}), [String(option.locationId)]: e.target.value } }))} sx={fieldSx} /></Box></Box>)}</Box>
                    </Card>;
                })}
                <TextField fullWidth label="Store Review Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} sx={{ ...fieldSx, mt: 1.5 }} />
                <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1.5 }}><Button startIcon={<Inventory2OutlinedIcon />} onClick={confirmReview} disabled={working} sx={primaryBtnSx}>{working ? "Reserving..." : "Confirm Review & Reserve"}</Button></Box>
            </Card>}

            {totals.shortage > 0 && totals.reserved > 0 && <Card sx={panelSx}><Typography sx={mainTextSx}>Production partial-availability decision</Typography><Typography sx={subTextSx}>{normalize(requisition.partialAvailabilityDecision) === "ISSUE_AVAILABLE_NOW" ? "Production has authorized available quantity to continue through QC/Processing and be issued when route-complete." : normalize(requisition.partialAvailabilityDecision) === "HOLD_UNTIL_SHORTAGE_COMPLETE" ? "Production has instructed Store to hold the available quantity until shortage procurement is completed." : "Production decision is pending. Store can reserve and procure shortage, but final issue is blocked until Production decides."}</Typography></Card>}
            <Card sx={panelSx}><Typography sx={{ fontSize: 17, fontWeight: 950, mb: 1 }}>Reservations & Issue</Typography><Box sx={tableShellSx}><Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 150px 110px 160px 150px 120px" }}>{["Material", "Source", "Reserved", "Status", "Next", "Action"].map((h) => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>{reservations.length === 0 ? <EmptyState>No reservations created yet.</EmptyState> : reservations.map((reservation) => <Box key={reservation.id} sx={{ ...tableRowSx, gridTemplateColumns: "170px 150px 110px 160px 150px 120px" }}><Box sx={tableCellSx}>{reservation.materialCode || "-"}</Box><Box sx={tableCellSx}>{reservation.sourceLocationCode || "-"}</Box><Box sx={tableCellSx}>{formatQty(reservation.reservedQty)}</Box><Box sx={tableCellSx}><MatFlowStatusChip status={reservation.status} /></Box><Box sx={tableCellSx}>{reservation.nextAction || (reservation.issueReady ? "ISSUE_TO_PRODUCTION" : "COMPLETE_ROUTE")}</Box><Box sx={tableCellSx}>{reservation.issueReady && numeric(reservation.remainingIssueQty) > 0 ? <Button startIcon={<OutputOutlinedIcon />} disabled={workingId === String(reservation.id)} onClick={() => issue(reservation)} sx={primaryBtnSx}>Issue</Button> : "-"}</Box></Box>)}</Box></Card>

            <Card sx={panelSx}><Typography sx={{ fontSize: 17, fontWeight: 950, mb: 1 }}>Shortage Indents</Typography><Box sx={tableShellSx}><Box sx={{ ...tableHeaderSx, gridTemplateColumns: "180px 150px 150px 180px 120px" }}>{["Indent", "Deliver To", "Status", "Lines", "Action"].map((h) => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>{indents.length === 0 ? <EmptyState>No shortage indent exists.</EmptyState> : indents.map((indent) => <Box key={indent.id} sx={{ ...tableRowSx, gridTemplateColumns: "180px 150px 150px 180px 120px" }}><Box sx={tableCellSx}>{indent.indentNumber || "-"}</Box><Box sx={tableCellSx}>{indent.deliveryLocationCode || "-"}</Box><Box sx={tableCellSx}><MatFlowStatusChip status={indent.status} /></Box><Box sx={tableCellSx}>{(indent.lines || []).map((line) => `${line.materialCode}: ${formatQty(line.requiredQty)}`).join(" · ") || "-"}</Box><Box sx={tableCellSx}>{["AUTO_CREATED", "DRAFT", "RETURNED"].includes(normalize(indent.status)) ? <Button startIcon={<ShoppingCartOutlinedIcon />} disabled={workingId === String(indent.id)} onClick={() => submitIndent(indent)} sx={primaryBtnSx}>Send to Purchase</Button> : "-"}</Box></Box>)}</Box></Card>
        </>}
    </Box>;
}
