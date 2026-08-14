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
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";

import { MATFLOW_ROLES, useMatFlow } from "../matflowUi";
import { matflowApi, readMatFlowError } from "../api/matflowApi";
import { downloadMatFlowExcel } from "../api/matflowExcel";
import {
    EmptyState,
    ErrorBox,
    LoadingBlock,
    MatFlowDeleteDialog,
    MatFlowPagination,
    MatFlowStatusChip,
    PageHero,
    clean,
    dangerBtnSx,
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

const MAIN_PLANT = "AL-P1";
const upperCode = (value) => clean(value).toUpperCase();
const samePlant = (left, right) => upperCode(left) && upperCode(left) === upperCode(right);

const rowTouchesPlant = (row, plantCode) => {
    if (!plantCode) return true;
    return [row?.fromPlantCode, row?.viaPlantCode, row?.toPlantCode]
        .some((value) => samePlant(value, plantCode));
};

const returnRouteText = (row) => {
    const from = row?.fromLocationCode || row?.fromPlantCode || "Production";
    const via = row?.viaLocationCode || row?.viaPlantCode;
    const to = row?.toLocationCode || row?.toPlantCode || "AL-P1 Main Store";
    return via ? `${from} → ${via} → ${to}` : `${from} → ${to}`;
};

const returnUpdatedAt = (row) =>
    row?.receivedAt || row?.forwardedAt || row?.originStoreReceivedAt || row?.dispatchedAt || row?.createdAt;

const remainingReturnable = (line) => Math.max(
    0,
    numeric(line?.issuedQty)
    - numeric(line?.consumedQty)
    - numeric(line?.productionWasteQty ?? line?.wastageQty)
    - numeric(line?.returnedQty)
);

export function MatFlowReturnsPage() {
    const { hasRole, selectedPlantParam } = useMatFlow();
    const canProductionAct = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PRODUCTION);
    const canStoreAct = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.STORE);

    const [rows, setRows] = useState([]);
    const [requisitions, setRequisitions] = useState([]);
    const [reasons, setReasons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [dialog, setDialog] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [form, setForm] = useState({
        requisitionId: "",
        reason: "",
        remarks: "",
        quantities: {},
        batches: {},
    });

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [returnResponse, requisitionResponse, metaResponse] = await Promise.all([
                matflowApi.listMaterialReturns(),
                matflowApi.listRequisitions(),
                matflowApi.metadata(),
            ]);

            const returnRows = Array.isArray(returnResponse?.data) ? returnResponse.data : [];
            setRows(returnRows.filter((row) => rowTouchesPlant(row, selectedPlantParam)));

            const requestRows = Array.isArray(requisitionResponse?.data) ? requisitionResponse.data : [];
            setRequisitions(requestRows.filter((row) =>
                ["ISSUED_TO_PRODUCTION", "PRODUCTION_STARTED"].includes(normalize(row.status)) &&
                (!selectedPlantParam || samePlant(row.destinationPlantCode, selectedPlantParam))
            ));

            const enumReasons = Array.isArray(metaResponse?.data?.enums?.materialReturnReason)
                ? metaResponse.data.enums.materialReturnReason
                : [];
            setReasons(enumReasons);
            setForm((current) => ({
                ...current,
                reason: enumReasons.includes(current.reason) ? current.reason : (enumReasons[0] || ""),
            }));
        } catch (requestError) {
            setRows([]);
            setRequisitions([]);
            setError(readMatFlowError(requestError, "Unable to load Material Returns."));
        } finally {
            setLoading(false);
        }
    }, [selectedPlantParam]);

    useEffect(() => { load(); }, [load]);

    const selectedReq = requisitions.find((row) => String(row.id) === String(form.requisitionId)) || null;

    useEffect(() => {
        if (!selectedReq) return;
        const quantities = {};
        const batches = {};
        (selectedReq.lines || []).forEach((line) => {
            quantities[String(line.id)] = "";
            batches[String(line.id)] = "";
        });
        setForm((current) => ({ ...current, quantities, batches }));
    }, [selectedReq?.id]);

    const openCreate = () => {
        setForm({
            requisitionId: "",
            reason: reasons[0] || "",
            remarks: "",
            quantities: {},
            batches: {},
        });
        setDialog({ type: "CREATE" });
        setError("");
    };

    const createReturn = async () => {
        if (!selectedReq?.id || !selectedReq.destinationLocationId || !form.reason) {
            setError("Production MR and return reason are required.");
            return;
        }

        const lines = (selectedReq.lines || []).map((line) => ({
            requisitionLineId: line.id,
            returnQty: Number(form.quantities[String(line.id)] || 0),
            batchNo: clean(form.batches[String(line.id)]) || null,
            remarks: null,
        })).filter((line) => Number.isFinite(line.returnQty) && line.returnQty > .0005);

        if (!lines.length) {
            setError("Enter at least one return quantity.");
            return;
        }

        for (const requestLine of lines) {
            const source = (selectedReq.lines || []).find((line) => String(line.id) === String(requestLine.requisitionLineId));
            if (requestLine.returnQty > remainingReturnable(source) + .0005) {
                setError(`Return quantity exceeds currently returnable quantity for ${source?.materialCode || source?.issuedMaterialCode || "material"}.`);
                return;
            }
        }

        setWorking(true);
        setError("");
        try {
            await matflowApi.createMaterialReturn({
                requisitionId: selectedReq.id,
                fromLocationId: selectedReq.destinationLocationId,
                // API v6 resolves the final destination to AL-P1 Main Store and
                // inserts the origin Plant Store automatically for remote plants.
                toLocationId: null,
                reason: form.reason,
                remarks: clean(form.remarks) || null,
                lines,
            });
            setDialog(null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to create Material Return."));
        } finally {
            setWorking(false);
        }
    };

    const act = async (row, type) => {
        if (!row?.id || row.rowVersion == null) return;
        setWorking(true);
        setError("");
        try {
            const body = { rowVersion: row.rowVersion, remarks: null };
            if (type === "DISPATCH") await matflowApi.dispatchMaterialReturn(row.id, body);
            else await matflowApi.receiveMaterialReturn(row.id, body);
            await load();
        } catch (requestError) {
            const verb = type === "DISPATCH" ? "dispatch / forward" : "receive";
            setError(readMatFlowError(requestError, `Unable to ${verb} Material Return.`));
        } finally {
            setWorking(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget?.id || deleteTarget.rowVersion == null) return;
        setWorking(true);
        setError("");
        try {
            await matflowApi.deleteDraftMaterialReturn(deleteTarget.id, deleteTarget.rowVersion);
            setDeleteTarget(null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to delete Draft Material Return."));
        } finally {
            setWorking(false);
        }
    };

    const pagination = useMatFlowPagination(rows, 20);

    const canActAtPlant = (plantCode) => !selectedPlantParam || samePlant(selectedPlantParam, plantCode);

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="PRODUCTION RETURN · API V6"
                title="Unused / Excess Material Returns"
                subtitle="Return routing is fixed by the four-plant workflow: AL-P1 Production returns directly to the Main Store; AL-P2/P3/P4 Production returns through its own Plant Store and then to the AL-P1 Main Store. Returned quantity is finalized only after Main Store receipt."
                actions={
                    <>
                        <Button startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMatFlowExcel({ fileName: "MatFlow_Material_Returns", sheetName: "Returns", title: "MatFlow Material Returns", rows })} sx={secondaryBtnSx}>Export Excel</Button>
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                        {canProductionAct && <Button startIcon={<AddIcon />} onClick={openCreate} sx={primaryBtnSx}>Create Return</Button>}
                    </>
                }
            />

            <ErrorBox>{error}</ErrorBox>

            <Card sx={panelSx}>
                {loading ? <LoadingBlock /> : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "165px 165px minmax(245px,1fr) 150px 170px 170px 250px" }}>
                            {["Return", "MR", "Fixed Return Route", "Reason", "Status", "Last Movement", "Action / Handoff"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {pagination.pageItems.length === 0 ? <EmptyState>No Material Returns.</EmptyState> : pagination.pageItems.map((row) => {
                            const status = normalize(row.status);
                            const productionDispatch = status === "DRAFT" && canProductionAct && canActAtPlant(row.fromPlantCode);
                            const originReceive = status === "IN_TRANSIT_TO_ORIGIN_STORE" && canStoreAct && canActAtPlant(row.viaPlantCode);
                            const originForward = status === "AT_ORIGIN_STORE" && canStoreAct && canActAtPlant(row.viaPlantCode);
                            const mainReceive = ["IN_TRANSIT_TO_MAIN_STORE", "IN_TRANSIT", "PARTIALLY_RECEIVED"].includes(status) &&
                                canStoreAct && canActAtPlant(row.toPlantCode || MAIN_PLANT);

                            return (
                                <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "165px 165px minmax(245px,1fr) 150px 170px 170px 250px" }}>
                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>{row.returnNumber || "-"}</Typography>
                                        <Typography sx={subTextSx}>{row.fromPlantCode || "-"}</Typography>
                                    </Box>
                                    <Box sx={tableCellSx}>{row.requisitionNumber || "-"}</Box>
                                    <Box sx={{ ...tableCellSx, whiteSpace: "normal" }}>
                                        <Typography sx={mainTextSx}>{returnRouteText(row)}</Typography>
                                        <Typography sx={subTextSx}>
                                            {row.viaLocationCode
                                                ? `Origin Store received: ${formatDate(row.originStoreReceivedAt)} · Forwarded: ${formatDate(row.forwardedAt)}`
                                                : "Direct Production → AL-P1 Main Store return"}
                                        </Typography>
                                    </Box>
                                    <Box sx={tableCellSx}>{readable(row.reason)}</Box>
                                    <Box sx={tableCellSx}><MatFlowStatusChip status={row.status} /></Box>
                                    <Box sx={tableCellSx}>{formatDate(returnUpdatedAt(row))}</Box>
                                    <Box sx={{ ...tableCellSx, display: "flex", gap: .5, flexWrap: "wrap" }}>
                                        {productionDispatch && (
                                            <>
                                                <Button onClick={() => act(row, "DISPATCH")} disabled={working} sx={primaryBtnSx}>
                                                    {row.viaLocationCode ? "Send to Plant Store" : "Send to Main Store"}
                                                </Button>
                                                <Button startIcon={<DeleteOutlineIcon />} onClick={() => setDeleteTarget(row)} disabled={working} sx={dangerBtnSx}>Delete</Button>
                                            </>
                                        )}
                                        {originReceive && <Button onClick={() => act(row, "RECEIVE")} disabled={working} sx={primaryBtnSx}>Receive at Origin Store</Button>}
                                        {originForward && <Button onClick={() => act(row, "DISPATCH")} disabled={working} sx={primaryBtnSx}>Forward to AL-P1 Main Store</Button>}
                                        {mainReceive && <Button onClick={() => act(row, "RECEIVE")} disabled={working} sx={primaryBtnSx}>Receive at Main Store</Button>}
                                        {status === "RECEIVED" && <Typography sx={subTextSx}>Final receipt complete · {row.receivedBy || "Main Store"}</Typography>}
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                )}
                {!loading && <MatFlowPagination {...pagination} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} label="Material Returns" />}
            </Card>

            <Dialog open={Boolean(dialog)} onClose={() => !working && setDialog(null)} fullWidth maxWidth="md" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>Create Material Return</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Alert severity="info" sx={{ mb: 1.5 }}>
                        You do not choose a Store destination. MatFlow derives the route from the MR plant: AL-P1 goes directly to Main Store; AL-P2/P3/P4 goes Production → own Plant Store → AL-P1 Main Store.
                    </Alert>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
                        <TextField select label="Production MR *" value={form.requisitionId} onChange={(e) => setForm((current) => ({ ...current, requisitionId: e.target.value }))} sx={fieldSx}>
                            {requisitions.map((row) => <MenuItem key={row.id} value={row.id}>{row.requisitionNumber} · {row.projectCode} · {row.drawingNo}</MenuItem>)}
                        </TextField>
                        <TextField select label="Reason *" value={form.reason} onChange={(e) => setForm((current) => ({ ...current, reason: e.target.value }))} sx={fieldSx}>
                            {reasons.map((reason) => <MenuItem key={reason} value={reason}>{readable(reason)}</MenuItem>)}
                        </TextField>
                        <TextField
                            label="Resolved Return Route"
                            value={selectedReq
                                ? (samePlant(selectedReq.destinationPlantCode, MAIN_PLANT)
                                    ? `${selectedReq.destinationLocationCode || "Production"} → ${selectedReq.mainStoreCode || "AL-P1 Main Store"}`
                                    : `${selectedReq.destinationLocationCode || "Production"} → ${selectedReq.originStoreCode || `${selectedReq.destinationPlantCode} Store`} → ${selectedReq.mainStoreCode || "AL-P1 Main Store"}`)
                                : "Select an MR"}
                            InputProps={{ readOnly: true }}
                            sx={fieldSx}
                        />
                        <TextField multiline minRows={2} label="Remarks" value={form.remarks} onChange={(e) => setForm((current) => ({ ...current, remarks: e.target.value }))} sx={fieldSx} />
                    </Box>

                    {selectedReq && (
                        <Box sx={{ mt: 1.5 }}>
                            <Typography sx={mainTextSx}>Return Material Lines</Typography>
                            <Box sx={tableShellSx}>
                                <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "220px 90px 90px 90px 105px 140px 145px" }}>
                                    {["Material", "Issued", "Consumed", "Waste", "Returned", "Returnable / Qty", "Batch"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                                </Box>
                                {(selectedReq.lines || []).map((line) => {
                                    const returnable = remainingReturnable(line);
                                    return (
                                        <Box key={line.id} sx={{ ...tableRowSx, gridTemplateColumns: "220px 90px 90px 90px 105px 140px 145px" }}>
                                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{line.issuedMaterialName || line.materialName}</Typography><Typography sx={subTextSx}>{line.issuedMaterialCode || line.materialCode} · {line.uom}</Typography></Box>
                                            <Box sx={tableCellSx}>{formatQty(line.issuedQty)}</Box>
                                            <Box sx={tableCellSx}>{formatQty(line.consumedQty)}</Box>
                                            <Box sx={tableCellSx}>{formatQty(line.productionWasteQty ?? line.wastageQty)}</Box>
                                            <Box sx={tableCellSx}>{formatQty(line.returnedQty)}</Box>
                                            <Box sx={tableCellSx}>
                                                <Typography sx={subTextSx}>Max {formatQty(returnable)}</Typography>
                                                <TextField type="number" size="small" value={form.quantities[String(line.id)] || ""} onChange={(e) => setForm((current) => ({ ...current, quantities: { ...current.quantities, [String(line.id)]: e.target.value } }))} sx={fieldSx} />
                                            </Box>
                                            <Box sx={tableCellSx}><TextField size="small" value={form.batches[String(line.id)] || ""} onChange={(e) => setForm((current) => ({ ...current, batches: { ...current.batches, [String(line.id)]: e.target.value } }))} sx={fieldSx} /></Box>
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setDialog(null)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
                    <Button onClick={createReturn} disabled={working} sx={primaryBtnSx}>{working ? "Saving..." : "Create Draft Return"}</Button>
                </DialogActions>
            </Dialog>

            <MatFlowDeleteDialog
                open={Boolean(deleteTarget)}
                title="Delete Draft Material Return?"
                subject={deleteTarget?.returnNumber || "Draft Return"}
                description="Only a Draft return can be permanently deleted. Once dispatched, every Plant Store and Main Store handoff remains traceable."
                working={working}
                onClose={() => setDeleteTarget(null)}
                onConfirm={confirmDelete}
            />
        </Box>
    );
}
