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

import { MATFLOW_ROLES, useMatFlow } from "../matflowUi";
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
const MAIN_PLANT = "AL-P1";
const samePlant = (left, right) => Boolean(upperCode(left)) && upperCode(left) === upperCode(right);

export function MatFlowStoreQueuePage() {
    const navigate = useNavigate();
    const { hasRole, selectedPlantParam } = useMatFlow();
    const isMainStoreActor = hasRole(MATFLOW_ROLES.STORE) && samePlant(selectedPlantParam, MAIN_PLANT);

    const [rows, setRows] = useState([]);
    const [purchaseIndents, setPurchaseIndents] = useState([]);
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
            const [queueResponse, indentResponse, stockResponse, materialResponse, locationResponse] = await Promise.all([
                matflowApi.listStoreQueue(isMainStoreActor ? {} : { plantCode: selectedPlantParam }),
                matflowApi.listPurchaseIndents(isMainStoreActor ? {} : { plantCode: selectedPlantParam }),
                matflowApi.listStock({ plantCode: selectedPlantParam }),
                matflowApi.listMaterials({ active: true }),
                matflowApi.listLocations({ active: true }),
            ]);

            const indentRows = Array.isArray(indentResponse?.data) ? indentResponse.data : [];
            setPurchaseIndents(indentRows);

            const indentsByMr = new Map();
            indentRows.forEach((indent) => {
                const key = String(indent?.requisitionId || "");
                if (!key) return;
                const current = indentsByMr.get(key) || [];
                current.push(indent);
                indentsByMr.set(key, current);
            });

            setRows((Array.isArray(queueResponse?.data) ? queueResponse.data : [])
                .filter((row) => QUEUE_STATUSES.has(normalize(row.status)))
                .map((row) => ({
                    ...row,
                    _linkedPis: indentsByMr.get(String(row.id)) || [],
                })));

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
            setPurchaseIndents([]);
            setStockRows([]);
            setError(readMatFlowError(requestError, "Unable to load Store queue and inventory."));
        } finally {
            setLoading(false);
        }
    }, [selectedPlantParam, isMainStoreActor]);

    useEffect(() => { load(); }, [load]);

    const filtered = useMemo(() => {
        const term = clean(search).toLowerCase();
        if (!term) return rows;
        return rows.filter((row) => [
            row.requisitionNumber,
            row.projectCode, // compatibility field: PD No.
            row.drawingNo,
            row.bomNumber,
            row.destinationLocationCode,
            row.requestedBy,
            row.status,
            ...(Array.isArray(row._linkedPis) ? row._linkedPis.flatMap((pi) => [pi.indentNumber, pi.status]) : []),
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
                subtitle="Remote Plant Stores forward the same MR to AL-P1 Main Store. AL-P1 Main Store alone checks stock, reserves, raises shortage PI and starts the approved outbound route. Remote Stores later receive and hand material to Production."
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
                <SummaryCard label="Needs Store Action" value={counts.review} />
                <SummaryCard label="Linked PIs" value={purchaseIndents.length} />
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
                    label="Search MR / PI / PD No. / Drawing / BOM / Requester"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    sx={{ ...fieldSx, minWidth: 360 }}
                />
            </Card>

            <Card sx={panelSx}>
                {loading ? <LoadingBlock /> : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "165px 180px 145px minmax(180px,1fr) 165px 150px 135px 95px" }}>
                            {["MR", "PD No. / Drawing", "BOM", "Linked PI(s)", "Production Destination", "Status", "Requested", "Action"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {filtered.length === 0 ? <EmptyState /> : filtered.map((row) => (
                            <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "165px 180px 145px minmax(180px,1fr) 165px 150px 135px 95px" }}>
                                <Box sx={tableCellSx}>
                                    <Typography sx={mainTextSx}>{row.requisitionNumber || "-"}</Typography>
                                    <Typography sx={subTextSx}>By {row.requestedBy || "-"}</Typography>
                                </Box>
                                <Box sx={tableCellSx}>
                                    <Typography sx={mainTextSx}>{row.projectCode || "-"}</Typography>
                                    <Typography sx={subTextSx}>{row.drawingNo || "-"}</Typography>
                                </Box>
                                <Box sx={tableCellSx}>{row.bomNumber || "-"}</Box>
                                <Box sx={{ ...tableCellSx, whiteSpace: "normal" }}>
                                    {Array.isArray(row._linkedPis) && row._linkedPis.length > 0 ? row._linkedPis.map((pi) => (
                                        <Box key={pi.id || pi.indentNumber} sx={{ mb: .35 }}>
                                            <Typography sx={mainTextSx}>{pi.indentNumber || "-"}</Typography>
                                            <Typography sx={subTextSx}>{readable(pi.status)}</Typography>
                                        </Box>
                                    )) : <Typography sx={subTextSx}>No PI</Typography>}
                                </Box>
                                <Box sx={tableCellSx}>
                                    <Typography sx={mainTextSx}>{row.destinationLocationCode || "-"}</Typography>
                                    <Typography sx={subTextSx}>{row.destinationPlantCode || "-"} · Origin Store {row.originStoreCode || "-"} → Main {row.mainStoreCode || "-"}</Typography>
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
    const { hasRole, selectedPlantParam } = useMatFlow();
    const canStoreAct = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.STORE);

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
            const [detailResponse, locationResponse] = await Promise.all([
                matflowApi.getStoreReview(requisitionId),
                matflowApi.listLocations({ active: true }),
            ]);

            const nextSnapshot = detailResponse?.data || null;
            const nextLocations = extractMatFlowPage(locationResponse?.data).rows.filter((row) => row?.active !== false);
            const requisition = nextSnapshot?.requisition || null;
            const originPlant = upperCode(requisition?.destinationPlantCode);
            const remote = Boolean(originPlant) && originPlant !== MAIN_PLANT;
            const mainContext = !selectedPlantParam || samePlant(selectedPlantParam, MAIN_PLANT);
            const forwarded = Boolean(requisition?.forwardedToMainStoreAt);
            const canLoadMainAvailability = mainContext && (!remote || forwarded || normalize(requisition?.status) !== "SUBMITTED_TO_STORE");

            let nextAvailability = [];
            if (canLoadMainAvailability) {
                try {
                    const availabilityResponse = await matflowApi.getStoreAvailability(requisitionId);
                    nextAvailability = Array.isArray(availabilityResponse?.data) ? availabilityResponse.data : [];
                } catch (availabilityError) {
                    // Keep the routed MR usable for origin-Store forwarding/handoff.
                    // The backend is authoritative and may deny Main-Store planning to this actor.
                    if (!remote || forwarded) {
                        setError(readMatFlowError(availabilityError, "Main Store availability could not be loaded."));
                    }
                }
            }

            setSnapshot(nextSnapshot);
            setAvailability(nextAvailability);
            setLocations(nextLocations);

            const nextForms = {};
            (requisition?.lines || []).forEach((line) => {
                const entry = nextAvailability.find((item) => String(item.requisitionLineId) === String(line.id));
                const allocation = autoAllocate(line, entry);
                const allocated = Object.values(allocation).reduce((sum, value) => sum + numeric(value), 0);
                const needed = Math.max(0, numeric(line.requestedQty) - numeric(line.reservedQty));
                nextForms[String(line.id)] = {
                    allocations: allocation,
                    qcRequired: false,
                    processingRequired: false,
                    processingRouteStepId: "",
                    createIndentForShortage: allocated + .0005 < needed,
                    indentDeliveryLocationId: requisition?.mainStoreId || "",
                    remarks: "",
                };
            });
            setForms(nextForms);
        } catch (requestError) {
            setSnapshot(null);
            setAvailability([]);
            setLocations([]);
            setError(readMatFlowError(requestError, "Unable to load Store MR workbench."));
        } finally {
            setLoading(false);
        }
    }, [requisitionId, selectedPlantParam]);

    useEffect(() => { load(); }, [load]);

    const requisition = snapshot?.requisition || null;
    const lines = Array.isArray(requisition?.lines) ? requisition.lines : [];
    const reservations = Array.isArray(snapshot?.reservations) ? snapshot.reservations : [];
    const indents = Array.isArray(snapshot?.indents) ? snapshot.indents : [];
    const internalTransfers = Array.isArray(snapshot?.transfers) ? snapshot.transfers : [];
    const availabilityByLine = useMemo(() => new Map(availability.map((entry) => [String(entry.requisitionLineId), entry])), [availability]);

    const plant = upperCode(requisition?.destinationPlantCode);
    const remoteMr = Boolean(plant) && plant !== MAIN_PLANT;
    const mainStoreContext = !selectedPlantParam || samePlant(selectedPlantParam, MAIN_PLANT);
    const originStoreContext = !selectedPlantParam || samePlant(selectedPlantParam, plant);
    const forwardedToMain = Boolean(requisition?.forwardedToMainStoreAt);
    const forwardable = canStoreAct && remoteMr && originStoreContext &&
        normalize(requisition?.status) === "SUBMITTED_TO_STORE" && !forwardedToMain;

    const openReviewLines = lines.filter((line) =>
        Math.max(0, numeric(line.requestedQty) - numeric(line.reservedQty)) > .0005
    );
    const reviewable = canStoreAct && mainStoreContext && (!remoteMr || forwardedToMain) &&
        REVIEWABLE.has(normalize(requisition?.status)) && openReviewLines.length > 0;

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
                    const processingOptions = Array.isArray(entry?.processingOptions) ? entry.processingOptions : [];
                    if (hasNewAllocation && config.processingRequired) {
                        if (!config.processingRouteStepId) {
                            throw new Error(`Select one approved Processing Unit for ${line.materialCode}.`);
                        }
                        if (!processingOptions.some((option) => String(option.routeStepId) === String(config.processingRouteStepId))) {
                            throw new Error(`The selected Processing Unit is no longer approved for ${line.materialCode}. Refresh the MR.`);
                        }
                    }

                    const shortageAfterAllocation = Math.max(0, outstanding - newlyReserved);
                    const createIndent = shortageAfterAllocation > .0005 && config.createIndentForShortage !== false;
                    if (createIndent && !config.indentDeliveryLocationId) {
                        throw new Error(`AL-P1 Main Store is not resolved as the PI delivery location for ${line.materialCode}. Refresh master data.`);
                    }

                    return {
                        requisitionLineId: line.id,
                        rowVersion: line.rowVersion,
                        allocations: allocations.map(({ sourceLocationId, reserveQty }) => ({
                            sourceLocationId,
                            reserveQty,
                        })),
                        qcRequired: hasNewAllocation ? config.qcRequired === true : false,
                        processingRequired: hasNewAllocation ? config.processingRequired === true : false,
                        processingRouteStepId: hasNewAllocation && config.processingRequired
                            ? config.processingRouteStepId
                            : null,
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

    const forwardToMainStore = async () => {
        if (!forwardable || requisition?.rowVersion == null) return;
        setWorking(true);
        setError("");
        try {
            const response = await matflowApi.forwardRequisitionToMainStore(requisition.id, {
                rowVersion: requisition.rowVersion,
                remarks: clean(remarks) || null,
            });
            if (response?.data) setSnapshot((current) => ({ ...(current || {}), requisition: response.data }));
            setRemarks("");
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to forward the same MR to AL-P1 Main Store."));
        } finally {
            setWorking(false);
        }
    };

    const receiveAtOriginStore = async (reservation) => {
        if (!reservation?.id || reservation.rowVersion == null) return;
        setWorkingId(String(reservation.id));
        setError("");
        try {
            await matflowApi.receiveStoreReservation(reservation.id, {
                rowVersion: reservation.rowVersion,
                batchNo: null,
                remarks: "Received from AL-P1 Main Store at origin Plant Store",
            });
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to receive material from AL-P1 Main Store."));
        } finally {
            setWorkingId("");
        }
    };

    const openIssue = (reservation, transfer) => {
        setIssueDialog({ reservation, transfer });
        setIssueForm({ batchNo: "", remarks: "" });
        setError("");
    };

    const issueReservation = async () => {
        const reservation = issueDialog?.reservation;
        const transfer = issueDialog?.transfer;
        if (!reservation?.id || reservation.rowVersion == null) return;
        setWorkingId(String(reservation.id));
        setError("");
        try {
            await matflowApi.issueStoreReservation(reservation.id, {
                rowVersion: reservation.rowVersion,
                quantity: transfer
                    ? Math.max(0, numeric(transfer.plannedQty) - numeric(transfer.dispatchedQty))
                    : (reservation.remainingIssueQty || reservation.reservedQty),
                batchNo: clean(issueForm.batchNo) || null,
                remarks: clean(issueForm.remarks) || null,
            });
            setIssueDialog(null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to dispatch this Store route leg."));
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
                badge={remoteMr ? "ROUTED STORE MR" : "MAIN STORE MR"}
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
                    <Detail label="Origin Store" value={`${requisition.originStoreCode || "-"} · ${requisition.originStorePlantCode || requisition.destinationPlantCode || "-"}`} />
                    <Detail label="AL-P1 Main Store" value={`${requisition.mainStoreCode || "-"} · ${requisition.mainStorePlantCode || MAIN_PLANT}`} />
                    <Detail label="Submitted" value={formatDate(requisition.submittedAt)} />
                    <Detail label="Forwarded to Main" value={requisition.forwardedToMainStoreAt ? `${requisition.forwardedToMainStoreBy || "-"} · ${formatDate(requisition.forwardedToMainStoreAt)}` : (remoteMr ? "Waiting origin Store" : "Direct")} />
                </Box>
                {forwardable && (
                    <Alert severity="warning" sx={{ mt: 1.5 }} action={
                        <Button onClick={forwardToMainStore} disabled={working} sx={primaryBtnSx}>
                            {working ? "Forwarding..." : "Forward Same MR to AL-P1"}
                        </Button>
                    }>
                        This is the origin Plant Store step. Do not perform stock reservation here. Forward this same MR unchanged to AL-P1 Main Store; project, Product, quantities and Production requester remain linked.
                    </Alert>
                )}
                {remoteMr && forwardedToMain && (
                    <Alert severity="success" sx={{ mt: 1.5 }}>
                        Same MR forwarded by {requisition.forwardedToMainStoreBy || "origin Store"} on {formatDate(requisition.forwardedToMainStoreAt)}. AL-P1 Main Store now owns availability, reservation and shortage PI planning.
                    </Alert>
                )}
                {reviewable && (
                    <Alert severity="info" sx={{ mt: 1.5 }}>
                        For each newly allocated lot, Store makes two independent choices: <b>QC Check Required: Yes/No</b> and <b>Processing Required: Yes/No</b>. QC never chooses the route. If Processing is required, Store selects one BOM-approved Processing Unit.
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
                                            label="QC check required"
                                        />

                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={config.processingRequired === true}
                                                    disabled={allocated <= .0005}
                                                    onChange={(event) => setForms((current) => ({
                                                        ...current,
                                                        [key]: {
                                                            ...current[key],
                                                            processingRequired: event.target.checked,
                                                            processingRouteStepId: event.target.checked
                                                                ? (current[key]?.processingRouteStepId || "")
                                                                : "",
                                                        },
                                                    }))}
                                                />
                                            }
                                            label="Processing required before Production"
                                        />

                                        <TextField
                                            select
                                            label="Processing Unit"
                                            value={config.processingRouteStepId || ""}
                                            disabled={!config.processingRequired || allocated <= .0005}
                                            onChange={(event) => setForms((current) => ({
                                                ...current,
                                                [key]: { ...current[key], processingRouteStepId: event.target.value },
                                            }))}
                                            helperText={config.processingRequired && !(entry?.processingOptions || []).length
                                                ? "No Processing Unit is approved on this BOM material line."
                                                : "Independent of QC. Choose only when this material needs pre-processing."}
                                            sx={{ ...fieldSx, gridColumn: { xs: "1 / -1", md: "1 / -1" } }}
                                        >
                                            {(entry?.processingOptions || []).map((option) => (
                                                <MenuItem key={option.routeStepId} value={option.routeStepId}>
                                                    {option.locationCode} · {option.locationName}{option.processCode ? ` · ${option.processCode}` : ""}
                                                </MenuItem>
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
                                            label="PI Delivery Store"
                                            value={requisition.mainStoreCode || "AL-P1 Main Store"}
                                            helperText="Fixed by MatFlow API v6. Every shortage PI is delivered to AL-P1 Main Store."
                                            InputProps={{ readOnly: true }}
                                            disabled={shortageAfter <= .0005 || config.createIndentForShortage === false}
                                            sx={fieldSx}
                                        />

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
                    Store sends each reserved lot along the Processing/Production route saved during review. A required QC check only gates the send action; it does not change custody or routing. Internal custody records remain hidden.
                </Typography>
                <Box sx={tableShellSx}>
                    <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "160px 135px 150px 130px 150px 100px 145px 145px" }}>
                        {["Material", "Source Store", "Planned Destination", "QC Check", "Processing", "Reserved", "State / Next", "Action"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
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
                        const storeLegBelongsHere = Boolean(pendingStoreLeg) &&
                            (!selectedPlantParam || samePlant(pendingStoreLeg.fromPlantCode, selectedPlantParam));
                        const storeCanSend = storeLegBelongsHere && (!reservation.qcRequired || reservation.qcCompleted);
                        const originStoreCanReceive = canStoreAct &&
                            normalize(reservation.nextAction) === "RECEIVE_FROM_MAIN_STORE" &&
                            (!selectedPlantParam || samePlant(selectedPlantParam, plant));
                        const sendLabel = pendingStoreLeg
                            ? (normalize(pendingStoreLeg.toLocationType) === "PRODUCTION"
                                ? "Hand Over to Production"
                                : samePlant(pendingStoreLeg.fromPlantCode, MAIN_PLANT) && remoteMr
                                    ? "Send to Origin Store"
                                    : normalize(pendingStoreLeg.toLocationType) === "PROCESSING"
                                        ? "Send to Processing"
                                        : "Send Lot")
                            : "Send Lot";
                        return (
                            <Box key={reservation.id} sx={{ ...tableRowSx, gridTemplateColumns: "160px 135px 150px 130px 150px 100px 145px 145px" }}>
                                <Box sx={tableCellSx}>{reservation.materialCode || "-"}</Box>
                                <Box sx={tableCellSx}>{reservation.sourceLocationCode || "-"}</Box>
                                <Box sx={tableCellSx}>{reservation.firstDestinationLocationCode || "-"}</Box>
                                <Box sx={tableCellSx}>
                                    <Typography sx={mainTextSx}>
                                        {reservation.qcRequired
                                            ? (reservation.qcCompleted ? "✓ Checked" : "Pending")
                                            : "Not required"}
                                    </Typography>
                                    {reservation.qcRequired && !reservation.qcCompleted && (
                                        <Typography sx={subTextSx}>No material movement</Typography>
                                    )}
                                </Box>
                                <Box sx={tableCellSx}>
                                    <Typography sx={mainTextSx}>{reservation.processingRequired ? "Required" : "No"}</Typography>
                                    <Typography sx={subTextSx}>{reservation.processingLocationCode || (reservation.processingRequired ? reservation.firstDestinationLocationCode : "Direct Production")}</Typography>
                                </Box>
                                <Box sx={tableCellSx}>{formatQty(reservation.reservedQty)}</Box>
                                <Box sx={tableCellSx}>
                                    <MatFlowStatusChip status={reservation.status} />
                                    <Typography sx={{ ...subTextSx, mt: .4 }}>{readable(reservation.nextAction)}</Typography>
                                </Box>
                                <Box sx={tableCellSx}>
                                    {originStoreCanReceive ? (
                                        <Button
                                            onClick={() => receiveAtOriginStore(reservation)}
                                            disabled={workingId === String(reservation.id)}
                                            sx={primaryBtnSx}
                                        >
                                            Receive from Main Store
                                        </Button>
                                    ) : storeCanSend ? (
                                        <Button
                                            startIcon={<SendOutlinedIcon />}
                                            onClick={() => openIssue(reservation, pendingStoreLeg)}
                                            disabled={workingId === String(reservation.id)}
                                            sx={primaryBtnSx}
                                        >
                                            {sendLabel}
                                        </Button>
                                    ) : reservation.qcRequired && !reservation.qcCompleted ? (
                                        <Typography sx={subTextSx}>Waiting QC tick</Typography>
                                    ) : (
                                        <Typography sx={subTextSx}>{readable(reservation.responsibleDepartment)}</Typography>
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
                <DialogTitle sx={dialogTitleSx}>{normalize(issueDialog?.transfer?.toLocationType) === "PRODUCTION" ? "Hand Over Material to Production" : "Dispatch Store Route Leg"}</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Alert severity="info" sx={{ mb: 1.5 }}>
                        This dispatches only the current Store-owned route leg. Remote routes are Main Store → origin Plant Store → specific Production location/user. Each receiving step remains explicit and auditable.
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
