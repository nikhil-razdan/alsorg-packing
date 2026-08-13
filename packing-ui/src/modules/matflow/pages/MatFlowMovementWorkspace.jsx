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
import { extractMatFlowPage, matflowApi, readMatFlowError } from "../api/matflowApi";
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

export function MatFlowReturnsPage() {
    const { hasRole, selectedPlantParam } = useMatFlow();
    const canCreate = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PRODUCTION);
    const canStoreReceive = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.STORE);

    const [rows, setRows] = useState([]);
    const [requisitions, setRequisitions] = useState([]);
    const [locations, setLocations] = useState([]);
    const [reasons, setReasons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [dialog, setDialog] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [form, setForm] = useState({
        requisitionId: "",
        toLocationId: "",
        reason: "",
        remarks: "",
        quantities: {},
        batches: {},
    });

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [returnResponse, requisitionResponse, locationResponse, metaResponse] = await Promise.all([
                matflowApi.listMaterialReturns(),
                matflowApi.listRequisitions(),
                matflowApi.listLocations({ active: true }),
                matflowApi.metadata(),
            ]);
            setRows((Array.isArray(returnResponse?.data) ? returnResponse.data : []).filter((row) =>
                !selectedPlantParam ||
                String(row.fromPlantCode || row.toPlantCode || "").toUpperCase() === String(selectedPlantParam).toUpperCase()
            ));
            setRequisitions((Array.isArray(requisitionResponse?.data) ? requisitionResponse.data : []).filter((row) =>
                ["ISSUED_TO_PRODUCTION", "PRODUCTION_STARTED"].includes(normalize(row.status)) &&
                (!selectedPlantParam || String(row.destinationPlantCode || "").toUpperCase() === String(selectedPlantParam).toUpperCase())
            ));
            setLocations(extractMatFlowPage(locationResponse?.data).rows.filter((row) => row?.active !== false));
            setReasons(Array.isArray(metaResponse?.data?.enums?.materialReturnReason)
                ? metaResponse.data.enums.materialReturnReason
                : []);
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to load Material Returns."));
        } finally {
            setLoading(false);
        }
    }, [selectedPlantParam]);

    useEffect(() => { load(); }, [load]);

    const selectedReq = requisitions.find((row) => String(row.id) === String(form.requisitionId)) || null;
    const destinationStores = useMemo(() => locations.filter((location) =>
        normalize(location.locationType) === "STORE" &&
        location.supportsStock !== false &&
        (!selectedReq?.destinationPlantCode ||
            String(location.plantCode || "").toUpperCase() === String(selectedReq.destinationPlantCode).toUpperCase())
    ), [locations, selectedReq?.destinationPlantCode]);

    useEffect(() => {
        if (!selectedReq) return;
        const quantities = {};
        const batches = {};
        (selectedReq.lines || []).forEach((line) => {
            quantities[String(line.id)] = "";
            batches[String(line.id)] = "";
        });
        setForm((current) => ({
            ...current,
            quantities,
            batches,
            toLocationId: destinationStores.length === 1 ? destinationStores[0].id : current.toLocationId,
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedReq?.id]);

    const openCreate = () => {
        setForm({
            requisitionId: "",
            toLocationId: "",
            reason: reasons[0] || "",
            remarks: "",
            quantities: {},
            batches: {},
        });
        setDialog({ type: "CREATE" });
        setError("");
    };

    const createReturn = async () => {
        if (!selectedReq?.id || !selectedReq.destinationLocationId || !form.toLocationId || !form.reason) {
            setError("Production MR, destination Store and return reason are required.");
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

        setWorking(true);
        setError("");
        try {
            await matflowApi.createMaterialReturn({
                requisitionId: selectedReq.id,
                fromLocationId: selectedReq.destinationLocationId,
                toLocationId: form.toLocationId,
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
            setError(readMatFlowError(requestError, `Unable to ${type === "DISPATCH" ? "dispatch" : "receive"} Material Return.`));
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

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="PRODUCTION RETURN"
                title="Unused / Excess Material Returns"
                subtitle="Production can return issued material that is not consumed. The return is tracked back into Store stock and contributes to final Production material accounting."
                actions={
                    <>
                        <Button startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMatFlowExcel({ fileName: "MatFlow_Material_Returns", sheetName: "Returns", title: "MatFlow Material Returns", rows })} sx={secondaryBtnSx}>Export Excel</Button>
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                        {canCreate && <Button startIcon={<AddIcon />} onClick={openCreate} sx={primaryBtnSx}>Create Return</Button>}
                    </>
                }
            />

            <ErrorBox>{error}</ErrorBox>

            <Card sx={panelSx}>
                {loading ? <LoadingBlock /> : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 170px 180px 170px 140px 140px 210px" }}>
                            {["Return", "MR", "Route", "Reason", "Status", "Updated", "Action"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {pagination.pageItems.length === 0 ? <EmptyState>No Material Returns.</EmptyState> : pagination.pageItems.map((row) => (
                            <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "170px 170px 180px 170px 140px 140px 210px" }}>
                                <Box sx={tableCellSx}>{row.returnNumber || "-"}</Box>
                                <Box sx={tableCellSx}>{row.requisitionNumber || "-"}</Box>
                                <Box sx={tableCellSx}>{row.fromLocationCode || "-"} → {row.toLocationCode || "-"}</Box>
                                <Box sx={tableCellSx}>{readable(row.reason)}</Box>
                                <Box sx={tableCellSx}><MatFlowStatusChip status={row.status} /></Box>
                                <Box sx={tableCellSx}>{formatDate(row.receivedAt || row.dispatchedAt)}</Box>
                                <Box sx={{ ...tableCellSx, display: "flex", gap: .5, flexWrap: "wrap" }}>
                                    {canCreate && normalize(row.status) === "DRAFT" && (
                                        <>
                                            <Button onClick={() => act(row, "DISPATCH")} disabled={working} sx={primaryBtnSx}>Dispatch</Button>
                                            <Button startIcon={<DeleteOutlineIcon />} onClick={() => setDeleteTarget(row)} disabled={working} sx={dangerBtnSx}>Delete</Button>
                                        </>
                                    )}
                                    {canStoreReceive && normalize(row.status) === "DISPATCHED" && (
                                        <Button onClick={() => act(row, "RECEIVE")} disabled={working} sx={primaryBtnSx}>Receive to Store</Button>
                                    )}
                                </Box>
                            </Box>
                        ))}
                    </Box>
                )}
                {!loading && <MatFlowPagination {...pagination} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} label="Material Returns" />}
            </Card>

            <Dialog open={Boolean(dialog)} onClose={() => !working && setDialog(null)} fullWidth maxWidth="md" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>Create Material Return</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Alert severity="info" sx={{ mb: 1.5 }}>
                        Enter only the quantity being returned now. The backend validates that returned quantity does not exceed the remaining issued material after consumption/wastage.
                    </Alert>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
                        <TextField select label="Production MR *" value={form.requisitionId} onChange={(e) => setForm((c) => ({ ...c, requisitionId: e.target.value, toLocationId: "" }))} sx={fieldSx}>
                            {requisitions.map((row) => <MenuItem key={row.id} value={row.id}>{row.requisitionNumber} · {row.projectCode} · {row.drawingNo}</MenuItem>)}
                        </TextField>
                        <TextField select label="Return to Store *" value={form.toLocationId} onChange={(e) => setForm((c) => ({ ...c, toLocationId: e.target.value }))} sx={fieldSx}>
                            {destinationStores.map((location) => <MenuItem key={location.id} value={location.id}>{location.locationCode} · {location.locationName}</MenuItem>)}
                        </TextField>
                        <TextField select label="Reason *" value={form.reason} onChange={(e) => setForm((c) => ({ ...c, reason: e.target.value }))} sx={fieldSx}>
                            {reasons.map((reason) => <MenuItem key={reason} value={reason}>{readable(reason)}</MenuItem>)}
                        </TextField>
                        <TextField multiline minRows={2} label="Remarks" value={form.remarks} onChange={(e) => setForm((c) => ({ ...c, remarks: e.target.value }))} sx={fieldSx} />
                    </Box>

                    {selectedReq && (
                        <Box sx={{ mt: 1.5 }}>
                            <Typography sx={mainTextSx}>Return Material Lines</Typography>
                            <Box sx={tableShellSx}>
                                <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "220px 100px 100px 100px 150px 150px" }}>
                                    {["Material", "Issued", "Consumed", "Returned", "Return Qty", "Batch"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                                </Box>
                                {(selectedReq.lines || []).map((line) => (
                                    <Box key={line.id} sx={{ ...tableRowSx, gridTemplateColumns: "220px 100px 100px 100px 150px 150px" }}>
                                        <Box sx={tableCellSx}><Typography sx={mainTextSx}>{line.issuedMaterialName || line.materialName}</Typography><Typography sx={subTextSx}>{line.issuedMaterialCode || line.materialCode} · {line.uom}</Typography></Box>
                                        <Box sx={tableCellSx}>{formatQty(line.issuedQty)}</Box>
                                        <Box sx={tableCellSx}>{formatQty(line.consumedQty)}</Box>
                                        <Box sx={tableCellSx}>{formatQty(line.returnedQty)}</Box>
                                        <Box sx={tableCellSx}><TextField type="number" size="small" value={form.quantities[String(line.id)] || ""} onChange={(e) => setForm((c) => ({ ...c, quantities: { ...c.quantities, [String(line.id)]: e.target.value } }))} sx={fieldSx} /></Box>
                                        <Box sx={tableCellSx}><TextField size="small" value={form.batches[String(line.id)] || ""} onChange={(e) => setForm((c) => ({ ...c, batches: { ...c.batches, [String(line.id)]: e.target.value } }))} sx={fieldSx} /></Box>
                                    </Box>
                                ))}
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
                description="Only a Draft return can be permanently deleted. Physical dispatch/receipt history is retained."
                working={working}
                onClose={() => setDeleteTarget(null)}
                onConfirm={confirmDelete}
            />
        </Box>
    );
}
