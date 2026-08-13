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
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import { useNavigate, useParams } from "react-router-dom";

import { useMatFlow } from "../matflowUi";
import { extractMatFlowPage, matflowApi, readMatFlowError } from "../api/matflowApi";
import { downloadMatFlowExcel } from "../api/matflowExcel";
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

const REVIEWABLE = new Set([
    "SUBMITTED_TO_STORE",
    "STORE_REVIEW_IN_PROGRESS",
    "PARTIALLY_RESERVED",
    "SHORTAGE_PENDING",
]);

const QUEUE_STATUSES = new Set([
    "SUBMITTED_TO_STORE",
    "STORE_REVIEW_IN_PROGRESS",
    "PARTIALLY_RESERVED",
    "SHORTAGE_PENDING",
    "READY_TO_ISSUE",
    "PARTIALLY_ISSUED",
    "ISSUED_TO_PRODUCTION",
]);

const upperCode = (value) => clean(value).toUpperCase();

export function MatFlowStoreQueuePage() {
    const navigate = useNavigate();
    const { selectedPlantParam } = useMatFlow();

    const [rows, setRows] = useState([]);
    const [stockRows, setStockRows] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [storeLocations, setStoreLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [stockDialog, setStockDialog] = useState(false);
    const [stockForm, setStockForm] = useState({
        materialId: "",
        locationId: "",
        adjustmentQty: "",
        batchNo: "",
        remarks: "",
    });

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
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
            const stores = allLocations.filter((location) =>
                location?.active !== false &&
                location?.supportsStock !== false &&
                normalize(location?.locationType) === "STORE" &&
                (!selectedPlantParam || upperCode(location?.plantCode) === upperCode(selectedPlantParam))
            );
            setStoreLocations(stores);
            setMaterials(extractMatFlowPage(materialResponse?.data).rows.filter((row) => row?.active !== false));

            const storeIds = new Set(stores.map((location) => String(location.id)));
            setStockRows((Array.isArray(stockResponse?.data) ? stockResponse.data : [])
                .filter((balance) => storeIds.has(String(balance.locationId))));
        } catch (requestError) {
            setRows([]);
            setStockRows([]);
            setError(readMatFlowError(requestError, "Unable to load Store queue and inventory."));
        } finally {
            setLoading(false);
        }
    }, [selectedPlantParam]);

    useEffect(() => { load(); }, [load]);

    const filtered = useMemo(() => {
        const term = clean(search).toLowerCase();
        if (!term) return rows;
        return rows.filter((row) => [
            row.requisitionNumber,
            row.projectCode,
            row.drawingNo,
            row.bomNumber,
            row.destinationLocationCode,
            row.requestedBy,
            row.status,
        ].some((value) => clean(value).toLowerCase().includes(term)));
    }, [rows, search]);

    const counts = useMemo(() => ({
        review: rows.filter((row) => REVIEWABLE.has(normalize(row.status))).length,
        shortage: rows.filter((row) => normalize(row.status) === "SHORTAGE_PENDING").length,
        activeIssue: rows.filter((row) => ["PARTIALLY_RESERVED", "READY_TO_ISSUE", "PARTIALLY_ISSUED"].includes(normalize(row.status))).length,
    }), [rows]);

    const openStock = () => {
        setStockForm({
            materialId: "",
            locationId: storeLocations.length === 1 ? storeLocations[0].id : "",
            adjustmentQty: "",
            batchNo: "",
            remarks: "",
        });
        setStockDialog(true);
        setError("");
    };

    const saveStock = async () => {
        const qty = Number(stockForm.adjustmentQty);
        if (!stockForm.materialId || !stockForm.locationId || !Number.isFinite(qty) || Math.abs(qty) < .0005) {
            setError("Material, Store location and a non-zero stock adjustment are required.");
            return;
        }
        const existing = stockRows.find((row) =>
            String(row.materialId) === String(stockForm.materialId) &&
            String(row.locationId) === String(stockForm.locationId)
        );
        if (!existing && qty < 0) {
            setError("Opening stock must be positive.");
            return;
        }

        setWorking(true);
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
            setWorking(false);
        }
    };

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="STORE"
                title="Material Requisitions & Store Inventory"
                subtitle="Check physical stock against Production MRs, reserve available material, decide whether each allocated lot needs QC, and raise linked PIs for shortage quantities."
                actions={
                    <>
                        <Button
                            startIcon={<FileDownloadOutlinedIcon />}
                            onClick={() => downloadMatFlowExcel({
                                fileName: "MatFlow_Store_MR_Queue",
                                sheetName: "Store MR Queue",
                                title: "MatFlow Store Material Requisitions",
                                rows: filtered,
                            })}
                            sx={secondaryBtnSx}
                        >
                            Export Excel
                        </Button>
                        <Button startIcon={<RefreshOutlinedIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                        <Button startIcon={<AddOutlinedIcon />} onClick={openStock} disabled={!storeLocations.length} sx={primaryBtnSx}>
                            Opening / Adjust Stock
                        </Button>
                    </>
                }
            />

            <ErrorBox>{error}</ErrorBox>

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 1 }}>
                <SummaryCard label="Needs Store Review" value={counts.review} />
                <SummaryCard label="Shortage / PI Branch" value={counts.shortage} />
                <SummaryCard label="Reserved / Send Action" value={counts.activeIssue} />
            </Box>

            <Card sx={panelSx}>
                <Typography sx={{ fontWeight: 950, fontSize: 17 }}>Store Stock</Typography>
                <Typography sx={{ ...subTextSx, mb: 1.2 }}>
                    Available = On Hand − Reserved − Blocked. Opening/adjustment is an audited inventory action.
                </Typography>
                <Box sx={tableShellSx}>
                    <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "200px 150px 100px 100px 100px 100px" }}>
                        {["Material", "Store", "On Hand", "Reserved", "Blocked", "Available"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                    </Box>
                    {stockRows.length === 0 ? <EmptyState>No Store stock recorded for this scope.</EmptyState> : stockRows.map((row) => (
                        <Box key={row.id || `${row.materialId}:${row.locationId}`} sx={{ ...tableRowSx, gridTemplateColumns: "200px 150px 100px 100px 100px 100px" }}>
                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialName || "-"}</Typography><Typography sx={subTextSx}>{row.materialCode || "-"}</Typography></Box>
                            <Box sx={tableCellSx}>{row.locationCode || "-"}</Box>
                            <Box sx={tableCellSx}>{formatQty(row.onHandQty)}</Box>
                            <Box sx={tableCellSx}>{formatQty(row.reservedQty)}</Box>
                            <Box sx={tableCellSx}>{formatQty(row.blockedQty)}</Box>
                            <Box sx={tableCellSx}>{formatQty(row.availableQty)}</Box>
                        </Box>
                    ))}
                </Box>
            </Card>

            <Card sx={panelSx}>
                <TextField
                    label="Search MR / Project / Drawing / BOM / Requester"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    sx={{ ...fieldSx, minWidth: 360 }}
                />
            </Card>

            <Card sx={panelSx}>
                {loading ? <LoadingBlock /> : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 190px 150px 170px 170px 150px 100px" }}>
                            {["MR", "Project / Drawing", "BOM", "Production Destination", "Status", "Requested", "Action"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {filtered.length === 0 ? <EmptyState /> : filtered.map((row) => (
                            <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "170px 190px 150px 170px 170px 150px 100px" }}>
                                <Box sx={tableCellSx}>
                                    <Typography sx={mainTextSx}>{row.requisitionNumber || "-"}</Typography>
                                    <Typography sx={subTextSx}>By {row.requestedBy || "-"}</Typography>
                                </Box>
                                <Box sx={tableCellSx}>
                                    <Typography sx={mainTextSx}>{row.projectCode || "-"}</Typography>
                                    <Typography sx={subTextSx}>{row.drawingNo || "-"}</Typography>
                                </Box>
                                <Box sx={tableCellSx}>{row.bomNumber || "-"}</Box>
                                <Box sx={tableCellSx}>
                                    <Typography sx={mainTextSx}>{row.destinationLocationCode || "-"}</Typography>
                                    <Typography sx={subTextSx}>{row.destinationPlantCode || "-"}</Typography>
                                </Box>
                                <Box sx={tableCellSx}><MatFlowStatusChip status={row.status} /></Box>
                                <Box sx={tableCellSx}>{formatDate(row.submittedAt || row.requestedAt)}</Box>
                                <Box sx={tableCellSx}>
                                    <Button onClick={() => navigate(`/matflow/store/requisitions/${row.id}`)} sx={secondaryBtnSx}>Open</Button>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                )}
            </Card>

            <Dialog open={stockDialog} onClose={() => !working && setStockDialog(false)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>Store Opening / Stock Adjustment</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Box sx={{ display: "grid", gap: 1.5 }}>
                        <TextField select label="Material *" value={stockForm.materialId} onChange={(e) => setStockForm((c) => ({ ...c, materialId: e.target.value }))} sx={fieldSx}>
                            {materials.map((material) => <MenuItem key={material.id} value={material.id}>{material.materialName} · {material.materialCode} · {material.uom}</MenuItem>)}
                        </TextField>
                        <TextField select label="Store Location *" value={stockForm.locationId} onChange={(e) => setStockForm((c) => ({ ...c, locationId: e.target.value }))} sx={fieldSx}>
                            {storeLocations.map((location) => <MenuItem key={location.id} value={location.id}>{location.locationCode} · {location.locationName}</MenuItem>)}
                        </TextField>
                        <TextField type="number" label="Adjustment Qty *" value={stockForm.adjustmentQty} onChange={(e) => setStockForm((c) => ({ ...c, adjustmentQty: e.target.value }))} sx={fieldSx} />
                        <TextField label="Batch No." value={stockForm.batchNo} onChange={(e) => setStockForm((c) => ({ ...c, batchNo: e.target.value }))} sx={fieldSx} />
                        <TextField multiline minRows={2} label="Remarks" value={stockForm.remarks} onChange={(e) => setStockForm((c) => ({ ...c, remarks: e.target.value }))} sx={fieldSx} />
                    </Box>
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setStockDialog(false)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
                    <Button onClick={saveStock} disabled={working} sx={primaryBtnSx}>{working ? "Saving..." : "Post Adjustment"}</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

const autoAllocate = (line, availability) => {
    const needed = Math.max(0, numeric(line?.requestedQty) - numeric(line?.reservedQty));
    let remaining = needed;
    const quantities = {};

    for (const option of Array.isArray(availability?.stockOptions) ? availability.stockOptions : []) {
        const free = Math.max(0, numeric(option?.availableQty));
        if (!option?.locationId || free <= 0 || remaining <= .0005) continue;
        const take = Math.min(free, remaining);
        quantities[String(option.locationId)] = String(Math.round(take * 1000) / 1000);
        remaining -= take;
    }
    return quantities;
};

export function MatFlowStoreDetailPage() {
    const { requisitionId } = useParams();
    const navigate = useNavigate();

    const [snapshot, setSnapshot] = useState(null);
    const [availability, setAvailability] = useState([]);
    const [locations, setLocations] = useState([]);
    const [forms, setForms] = useState({});
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [workingId, setWorkingId] = useState("");
    const [error, setError] = useState("");
    const [remarks, setRemarks] = useState("");
    const [issueDialog, setIssueDialog] = useState(null);
    const [issueForm, setIssueForm] = useState({ batchNo: "", remarks: "" });

    const load = useCallback(async () => {
        if (!requisitionId) return;
        setLoading(true);
        setError("");
        try {
            const [detailResponse, availabilityResponse, locationResponse] = await Promise.all([
                matflowApi.getStoreReview(requisitionId),
                matflowApi.getStoreAvailability(requisitionId),
                matflowApi.listLocations({ active: true }),
            ]);

            const nextSnapshot = detailResponse?.data || null;
            const nextAvailability = Array.isArray(availabilityResponse?.data) ? availabilityResponse.data : [];
            const nextLocations = extractMatFlowPage(locationResponse?.data).rows.filter((row) => row?.active !== false);

            setSnapshot(nextSnapshot);
            setAvailability(nextAvailability);
            setLocations(nextLocations);

            const requisition = nextSnapshot?.requisition;
            const plant = upperCode(requisition?.destinationPlantCode);
            const qcLocations = nextLocations.filter((location) =>
                normalize(location.locationType) === "QC" &&
                (!plant || upperCode(location.plantCode) === plant)
            );
            const storeLocations = nextLocations.filter((location) =>
                normalize(location.locationType) === "STORE" &&
                location.supportsStock !== false &&
                (!plant || upperCode(location.plantCode) === plant)
            );

            const nextForms = {};
            (requisition?.lines || []).forEach((line) => {
                const entry = nextAvailability.find((item) => String(item.requisitionLineId) === String(line.id));
                const allocation = autoAllocate(line, entry);
                const allocated = Object.values(allocation).reduce((sum, value) => sum + numeric(value), 0);
                const needed = Math.max(0, numeric(line.requestedQty) - numeric(line.reservedQty));
                nextForms[String(line.id)] = {
                    allocations: allocation,
                    qcRequired: false,
                    qcLocationId: qcLocations.length === 1 ? qcLocations[0].id : "",
                    createIndentForShortage: allocated + .0005 < needed,
                    indentDeliveryLocationId: storeLocations.length === 1 ? storeLocations[0].id : "",
                    remarks: "",
                };
            });
            setForms(nextForms);
        } catch (requestError) {
            setSnapshot(null);
            setAvailability([]);
            setLocations([]);
            setError(readMatFlowError(requestError, "Unable to load Store MR review."));
        } finally {
            setLoading(false);
        }
    }, [requisitionId]);

    useEffect(() => { load(); }, [load]);

    const requisition = snapshot?.requisition || null;
    const lines = Array.isArray(requisition?.lines) ? requisition.lines : [];
    const reservations = Array.isArray(snapshot?.reservations) ? snapshot.reservations : [];
    const indents = Array.isArray(snapshot?.indents) ? snapshot.indents : [];
    const internalTransfers = Array.isArray(snapshot?.transfers) ? snapshot.transfers : [];
    const availabilityByLine = useMemo(() => new Map(availability.map((entry) => [String(entry.requisitionLineId), entry])), [availability]);

    const plant = upperCode(requisition?.destinationPlantCode);
    const qcLocations = useMemo(() => locations.filter((location) =>
        normalize(location.locationType) === "QC" &&
        (!plant || upperCode(location.plantCode) === plant)
    ), [locations, plant]);
    const storeLocations = useMemo(() => locations.filter((location) =>
        normalize(location.locationType) === "STORE" &&
        location.supportsStock !== false &&
        (!plant || upperCode(location.plantCode) === plant)
    ), [locations, plant]);

    const openReviewLines = lines.filter((line) =>
        Math.max(0, numeric(line.requestedQty) - numeric(line.reservedQty)) > .0005
    );
    const reviewable = REVIEWABLE.has(normalize(requisition?.status)) && openReviewLines.length > 0;

    const totals = useMemo(() => lines.reduce((sum, line) => ({
        requested: sum.requested + numeric(line.requestedQty),
        reserved: sum.reserved + numeric(line.reservedQty),
        shortage: sum.shortage + numeric(line.shortageQty),
        issued: sum.issued + numeric(line.issuedQty),
    }), { requested: 0, reserved: 0, shortage: 0, issued: 0 }), [lines]);

    const confirmReview = async () => {
        if (!reviewable || requisition?.rowVersion == null) return;

        let reviewLines;
        try {
            reviewLines = lines
                .filter((line) => Math.max(0, numeric(line.requestedQty) - numeric(line.reservedQty)) > .0005)
                .map((line) => {
                    const lineKey = String(line.id);
                    const config = forms[lineKey] || {};
                    const entry = availabilityByLine.get(lineKey);
                    const sourceOptions = Array.isArray(entry?.stockOptions) ? entry.stockOptions : [];
                    const sourceById = new Map(sourceOptions.map((option) => [String(option.locationId), option]));
                    const allocations = Object.entries(config.allocations || {})
                        .map(([sourceLocationId, value]) => ({
                            sourceLocationId,
                            reserveQty: numeric(value),
                            option: sourceById.get(String(sourceLocationId)),
                        }))
                        .filter((item) => item.option && item.reserveQty > .0005);

                    const newlyReserved = allocations.reduce((sum, item) => sum + item.reserveQty, 0);
                    const outstanding = Math.max(0, numeric(line.requestedQty) - numeric(line.reservedQty));

                    for (const allocation of allocations) {
                        if (allocation.reserveQty > numeric(allocation.option.availableQty) + .0005) {
                            throw new Error(`${allocation.option.locationCode} does not have enough available ${line.materialCode}.`);
                        }
                    }
                    if (newlyReserved > outstanding + .0005) {
                        throw new Error(`New reservation exceeds the remaining MR demand for ${line.materialCode}.`);
                    }

                    const hasNewAllocation = newlyReserved > .0005;
                    if (hasNewAllocation && config.qcRequired && !config.qcLocationId) {
                        throw new Error(`Select a QC location for ${line.materialCode}.`);
                    }

                    const shortageAfterAllocation = Math.max(0, outstanding - newlyReserved);
                    const createIndent = shortageAfterAllocation > .0005 && config.createIndentForShortage !== false;
                    if (createIndent && !config.indentDeliveryLocationId) {
                        throw new Error(`Select the Store delivery location for the shortage PI of ${line.materialCode}.`);
                    }

                    return {
                        requisitionLineId: line.id,
                        rowVersion: line.rowVersion,
                        allocations: allocations.map(({ sourceLocationId, reserveQty }) => ({
                            sourceLocationId,
                            reserveQty,
                        })),
                        qcRequired: hasNewAllocation ? config.qcRequired === true : false,
                        qcLocationId: hasNewAllocation && config.qcRequired ? config.qcLocationId : null,
                        createIndentForShortage: createIndent,
                        indentDeliveryLocationId: createIndent ? config.indentDeliveryLocationId : null,
                        remarks: clean(config.remarks) || null,
                    };
                });

            if (!reviewLines.length) {
                throw new Error("Every MR material line is already fully allocated. No Store re-review is required until a shortage/replacement demand reopens.");
            }
        } catch (validationError) {
            setError(validationError?.message || "Store review data is invalid.");
            return;
        }

        setWorking(true);
        setError("");
        try {
            const response = await matflowApi.submitStoreReview(requisition.id, {
                rowVersion: requisition.rowVersion,
                lines: reviewLines,
                remarks: clean(remarks) || null,
            });
            if (response?.data) setSnapshot(response.data);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to complete Store review."));
        } finally {
            setWorking(false);
        }
    };

    const openIssue = (reservation) => {
        setIssueDialog(reservation);
        setIssueForm({ batchNo: "", remarks: "" });
        setError("");
    };

    const issueReservation = async () => {
        const reservation = issueDialog;
        if (!reservation?.id || reservation.rowVersion == null) return;
        setWorkingId(String(reservation.id));
        setError("");
        try {
            await matflowApi.issueStoreReservation(reservation.id, {
                rowVersion: reservation.rowVersion,
                quantity: reservation.remainingIssueQty || reservation.reservedQty,
                batchNo: clean(issueForm.batchNo) || null,
                remarks: clean(issueForm.remarks) || null,
            });
            setIssueDialog(null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to send the reserved material lot."));
        } finally {
            setWorkingId("");
        }
    };

    if (loading) return <LoadingBlock />;

    if (!requisition) {
        return <Box sx={pageSx}><PageHero title="Store MR" /><ErrorBox>{error || "MR not found."}</ErrorBox></Box>;
    }

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="STORE MR WORKBENCH"
                title={requisition.requisitionNumber || "Material Requisition"}
                subtitle={`${requisition.projectCode || "-"} · ${requisition.drawingNo || "-"} · requested by ${requisition.requestedBy || "-"}`}
                actions={
                    <>
                        <Button startIcon={<RefreshOutlinedIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                        <Button startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate("/matflow/store")} sx={secondaryBtnSx}>Back</Button>
                    </>
                }
            />

            <ErrorBox>{error}</ErrorBox>

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 1 }}>
                <SummaryCard label="Requested" value={formatQty(totals.requested)} />
                <SummaryCard label="Reserved" value={formatQty(totals.reserved)} />
                <SummaryCard label="Shortage" value={formatQty(totals.shortage)} />
                <SummaryCard label="Issued / Received by Production" value={formatQty(totals.issued)} />
            </Box>

            <Card sx={panelSx}>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 1 }}>
                    <Detail label="Status" value={<MatFlowStatusChip status={requisition.status} />} />
                    <Detail label="BOM" value={`${requisition.bomNumber || "-"} · Rev ${requisition.bomRevisionNo ?? "-"}`} />
                    <Detail label="Production Destination" value={`${requisition.destinationLocationCode || "-"} · ${requisition.destinationPlantCode || "-"}`} />
                    <Detail label="Submitted" value={formatDate(requisition.submittedAt)} />
                </Box>
                {reviewable && (
                    <Alert severity="info" sx={{ mt: 1.5 }}>
                        For each newly allocated lot, Store chooses only <b>QC Required: Yes/No</b>. If QC is not required, Store sends it toward Production. If QC is required, QC later decides Direct Production or one approved Processing Unit.
                    </Alert>
                )}
            </Card>

            {reviewable && (
                <Card sx={panelSx}>
                    <Typography sx={{ fontWeight: 950, fontSize: 17 }}>Availability Review</Typography>
                    <Typography sx={{ ...subTextSx, mb: 1.3 }}>
                        After a GRN adds Store stock, reopen this same MR and allocate the newly available shortage quantity.
                    </Typography>

                    <Box sx={{ display: "grid", gap: 1.3 }}>
                        {lines.map((line) => {
                            const key = String(line.id);
                            const entry = availabilityByLine.get(key);
                            const config = forms[key] || {};
                            const outstanding = Math.max(0, numeric(line.requestedQty) - numeric(line.reservedQty));
                            const allocated = Object.values(config.allocations || {}).reduce((sum, value) => sum + numeric(value), 0);
                            const shortageAfter = Math.max(0, outstanding - allocated);

                            return (
                                <Card key={line.id} sx={{ ...panelSx, m: 0, boxShadow: "none" }}>
                                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
                                        <Box>
                                            <Typography sx={mainTextSx}>{line.materialName} · {line.materialCode}</Typography>
                                            <Typography sx={subTextSx}>
                                                Requested {formatQty(line.requestedQty)} {line.uom} · Already reserved {formatQty(line.reservedQty)} · Remaining {formatQty(outstanding)}
                                            </Typography>
                                        </Box>
                                        <MatFlowStatusChip status={line.status} />
                                    </Box>

                                    <Box sx={{ mt: 1, display: "grid", gap: .8 }}>
                                        {(entry?.stockOptions || []).length === 0 ? (
                                            <Alert severity="warning">No free Store stock is currently available for this material.</Alert>
                                        ) : (entry.stockOptions || []).map((option) => (
                                            <Box key={option.locationId} sx={{ display: "grid", gridTemplateColumns: "minmax(220px,1fr) 130px 150px", gap: 1, alignItems: "center" }}>
                                                <Box>
                                                    <Typography sx={mainTextSx}>{option.locationCode} · {option.locationName}</Typography>
                                                    <Typography sx={subTextSx}>Available {formatQty(option.availableQty)} · On hand {formatQty(option.onHandQty)}</Typography>
                                                </Box>
                                                <Typography sx={subTextSx}>Reserve now</Typography>
                                                <TextField
                                                    size="small"
                                                    type="number"
                                                    value={config.allocations?.[String(option.locationId)] || ""}
                                                    onChange={(event) => setForms((current) => ({
                                                        ...current,
                                                        [key]: {
                                                            ...current[key],
                                                            allocations: {
                                                                ...(current[key]?.allocations || {}),
                                                                [String(option.locationId)]: event.target.value,
                                                            },
                                                        },
                                                    }))}
                                                    sx={fieldSx}
                                                />
                                            </Box>
                                        ))}
                                    </Box>

                                    <Box sx={{ mt: 1.2, display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1 }}>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={config.qcRequired === true}
                                                    disabled={allocated <= .0005}
                                                    onChange={(event) => setForms((current) => ({
                                                        ...current,
                                                        [key]: { ...current[key], qcRequired: event.target.checked },
                                                    }))}
                                                />
                                            }
                                            label="QC required for newly allocated lot"
                                        />

                                        <TextField
                                            select
                                            label="QC Location"
                                            value={config.qcLocationId || ""}
                                            disabled={!config.qcRequired || allocated <= .0005}
                                            onChange={(event) => setForms((current) => ({
                                                ...current,
                                                [key]: { ...current[key], qcLocationId: event.target.value },
                                            }))}
                                            sx={fieldSx}
                                        >
                                            {qcLocations.map((location) => (
                                                <MenuItem key={location.id} value={location.id}>{location.locationCode} · {location.locationName}</MenuItem>
                                            ))}
                                        </TextField>

                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={shortageAfter > .0005 && config.createIndentForShortage !== false}
                                                    disabled={shortageAfter <= .0005}
                                                    onChange={(event) => setForms((current) => ({
                                                        ...current,
                                                        [key]: { ...current[key], createIndentForShortage: event.target.checked },
                                                    }))}
                                                />
                                            }
                                            label={`Raise linked PI for shortage ${formatQty(shortageAfter)} ${line.uom || ""}`}
                                        />

                                        <TextField
                                            select
                                            label="PI Delivery Store"
                                            value={config.indentDeliveryLocationId || ""}
                                            disabled={shortageAfter <= .0005 || config.createIndentForShortage === false}
                                            onChange={(event) => setForms((current) => ({
                                                ...current,
                                                [key]: { ...current[key], indentDeliveryLocationId: event.target.value },
                                            }))}
                                            sx={fieldSx}
                                        >
                                            {storeLocations.map((location) => (
                                                <MenuItem key={location.id} value={location.id}>{location.locationCode} · {location.locationName}</MenuItem>
                                            ))}
                                        </TextField>

                                        <TextField
                                            multiline
                                            minRows={2}
                                            label="Line Remarks"
                                            value={config.remarks || ""}
                                            onChange={(event) => setForms((current) => ({
                                                ...current,
                                                [key]: { ...current[key], remarks: event.target.value },
                                            }))}
                                            sx={{ ...fieldSx, gridColumn: "1 / -1" }}
                                        />
                                    </Box>
                                </Card>
                            );
                        })}
                    </Box>

                    <TextField
                        multiline
                        minRows={2}
                        label="Store Review Remarks"
                        value={remarks}
                        onChange={(event) => setRemarks(event.target.value)}
                        sx={{ ...fieldSx, mt: 1.5 }}
                        fullWidth
                    />
                    <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1.3 }}>
                        <Button onClick={confirmReview} disabled={working} sx={primaryBtnSx}>
                            {working ? "Saving Review..." : "Confirm Store Review"}
                        </Button>
                    </Box>
                </Card>
            )}

            <Card sx={panelSx}>
                <Typography sx={{ fontWeight: 950, fontSize: 17 }}>Allocated Material Lots</Typography>
                <Typography sx={{ ...subTextSx, mb: 1.2 }}>
                    Store sends each reserved lot according to the QC decision captured during review. Internal custody records remain hidden from the user-facing workflow.
                </Typography>
                <Box sx={tableShellSx}>
                    <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 150px 160px 130px 150px 170px 150px" }}>
                        {["Material", "Source Store", "First Destination", "Reserved", "State", "Next Action", "Action"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                    </Box>
                    {reservations.length === 0 ? <EmptyState>No Store allocation has been created yet.</EmptyState> : reservations.map((reservation) => {
                        const pendingStoreLeg = internalTransfers
                            .filter((transfer) => String(transfer?.reservationId || "") === String(reservation.id))
                            .filter((transfer) => normalize(transfer?.fromLocationType) === "STORE")
                            .find((transfer) => {
                                const status = normalize(transfer?.status);
                                const remainingDispatch = Math.max(
                                    0,
                                    numeric(transfer?.plannedQty) - numeric(transfer?.dispatchedQty)
                                );
                                return ["READY", "PARTIALLY_DISPATCHED", "PARTIALLY_RECEIVED"].includes(status) &&
                                    remainingDispatch > .0005;
                            });
                        const storeCanSend = Boolean(pendingStoreLeg) &&
                            numeric(reservation.remainingIssueQty) > .0005;
                        return (
                            <Box key={reservation.id} sx={{ ...tableRowSx, gridTemplateColumns: "170px 150px 160px 130px 150px 170px 150px" }}>
                                <Box sx={tableCellSx}>{reservation.materialCode || "-"}</Box>
                                <Box sx={tableCellSx}>{reservation.sourceLocationCode || "-"}</Box>
                                <Box sx={tableCellSx}>{reservation.firstDestinationLocationCode || "-"}</Box>
                                <Box sx={tableCellSx}>{formatQty(reservation.reservedQty)}</Box>
                                <Box sx={tableCellSx}><MatFlowStatusChip status={reservation.status} /></Box>
                                <Box sx={tableCellSx}>
                                    <Typography sx={mainTextSx}>{readable(reservation.nextAction)}</Typography>
                                    <Typography sx={subTextSx}>{readable(reservation.responsibleDepartment)}</Typography>
                                </Box>
                                <Box sx={tableCellSx}>
                                    {storeCanSend && (
                                        <Button
                                            startIcon={<SendOutlinedIcon />}
                                            onClick={() => openIssue(reservation)}
                                            disabled={workingId === String(reservation.id)}
                                            sx={primaryBtnSx}
                                        >
                                            Send Lot
                                        </Button>
                                    )}
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            </Card>

            <Card sx={panelSx}>
                <Typography sx={{ fontWeight: 950, fontSize: 17 }}>Linked Purchase Indents</Typography>
                <Typography sx={{ ...subTextSx, mb: 1.1 }}>Every PI is raised by Store against a specific uncovered MR shortage.</Typography>
                <Box sx={tableShellSx}>
                    <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 180px 160px 130px 120px" }}>
                        {["PI", "Linked MR", "Delivery Store", "Status", "Lines"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                    </Box>
                    {indents.length === 0 ? <EmptyState>No shortage PI exists for this MR.</EmptyState> : indents.map((indent) => (
                        <Box key={indent.id} sx={{ ...tableRowSx, gridTemplateColumns: "170px 180px 160px 130px 120px" }}>
                            <Box sx={tableCellSx}>{indent.indentNumber}</Box>
                            <Box sx={tableCellSx}>{indent.requisitionNumber || requisition.requisitionNumber}</Box>
                            <Box sx={tableCellSx}>{indent.deliverToLocationCode}</Box>
                            <Box sx={tableCellSx}><MatFlowStatusChip status={indent.status} /></Box>
                            <Box sx={tableCellSx}>{indent.lines?.length || 0}</Box>
                        </Box>
                    ))}
                </Box>
            </Card>

            {internalTransfers.length > 0 && (
                <Card sx={panelSx}>
                    <Typography sx={{ fontWeight: 950, fontSize: 17 }}>Material Route Trace</Typography>
                    <Typography sx={subTextSx}>
                        Read-only internal custody lineage for this MR. There is intentionally no separate Transfers desk.
                    </Typography>
                    <Box sx={{ mt: 1, display: "grid", gap: .6 }}>
                        {internalTransfers.map((transfer) => (
                            <Box key={transfer.id} sx={{ p: 1, border: "1px solid var(--mf-border)", borderRadius: 2, display: "flex", gap: 1, justifyContent: "space-between", flexWrap: "wrap" }}>
                                <Typography sx={mainTextSx}>{transfer.materialCode} · {transfer.fromLocationCode} → {transfer.toLocationCode}</Typography>
                                <Typography sx={subTextSx}>{readable(transfer.status)} · {formatQty(transfer.receivedQty)}/{formatQty(transfer.plannedQty)}</Typography>
                            </Box>
                        ))}
                    </Box>
                </Card>
            )}

            <Dialog open={Boolean(issueDialog)} onClose={() => !workingId && setIssueDialog(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>Send Reserved Material Lot</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Alert severity="info" sx={{ mb: 1.5 }}>
                        This sends the complete reservation lot toward its Store-selected destination. If the destination is Production, Production must still explicitly acknowledge receipt.
                    </Alert>
                    <Box sx={{ display: "grid", gap: 1.5 }}>
                        <TextField label="Batch No." value={issueForm.batchNo} onChange={(e) => setIssueForm((c) => ({ ...c, batchNo: e.target.value }))} sx={fieldSx} />
                        <TextField multiline minRows={2} label="Remarks" value={issueForm.remarks} onChange={(e) => setIssueForm((c) => ({ ...c, remarks: e.target.value }))} sx={fieldSx} />
                    </Box>
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setIssueDialog(null)} disabled={Boolean(workingId)} sx={secondaryBtnSx}>Cancel</Button>
                    <Button onClick={issueReservation} disabled={Boolean(workingId)} sx={primaryBtnSx}>
                        {workingId ? "Sending..." : "Confirm Send"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
