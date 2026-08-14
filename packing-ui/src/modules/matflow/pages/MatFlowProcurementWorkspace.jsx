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
    FormControlLabel,
    MenuItem,
    Switch,
    TextField,
    Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";

import { MATFLOW_ROLES, useMatFlow } from "../matflowUi";
import { matflowApi, readMatFlowError } from "../api/matflowApi";
import { downloadMatFlowExcel } from "../api/matflowExcel";
import {
    Detail,
    EmptyState,
    ErrorBox,
    LoadingBlock,
    MatFlowKanbanBoard,
    MatFlowPagination,
    MatFlowStatusChip,
    MatFlowViewToggle,
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
    useMatFlowPagination,
} from "../matflowUi";

const PURCHASE_ROLES = [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PURCHASE];
const RECEIVING_ROLES = [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.STORE];
const upperCode = (value) => clean(value).toUpperCase();

const PURCHASE_KANBAN_COLUMNS = [
    { key: "NEW_PI", label: "New PI / PO Required", subtitle: "Store shortage waiting for Purchase" },
    { key: "PO_PLACED", label: "PO Placed", subtitle: "PO created and released to Vendor" },
    { key: "WAITING", label: "Awaiting Material", subtitle: "Vendor delivery pending at AL-P1 Main Store" },
    { key: "PARTIAL", label: "Partially Received", subtitle: "Some PO quantity has reached Main Store" },
    { key: "RECEIVED", label: "Fully Received", subtitle: "PO receipt completed" },
];

const openIndentLines = (indent) =>
    (Array.isArray(indent?.lines) ? indent.lines : [])
        .map((line) => ({
            ...line,
            outstanding: Math.max(0, numeric(line.requiredQty) - numeric(line.orderedQty)),
        }))
        .filter((line) => line.outstanding > .0005);

export function MatFlowPurchasePage() {
    const { hasRole, selectedPlantParam } = useMatFlow();
    const canPurchase = hasRole(PURCHASE_ROLES);
    const centralPurchaseUser = hasRole(MATFLOW_ROLES.PURCHASE) && !hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER);
    const procurementPlantParam = centralPurchaseUser ? undefined : selectedPlantParam;

    const [orders, setOrders] = useState([]);
    const [indents, setIndents] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [viewMode, setViewMode] = useState("KANBAN");
    const [poDialog, setPoDialog] = useState(false);
    const [vendorDialog, setVendorDialog] = useState(null);
    const [poForm, setPoForm] = useState({
        indentId: "",
        vendorId: "",
        poDate: new Date().toISOString().slice(0, 10),
        remarks: "",
        quantities: {},
    });
    const [vendorForm, setVendorForm] = useState({
        vendorCode: "",
        vendorName: "",
        gstin: "",
        contactPerson: "",
        contactPhone: "",
        email: "",
        address: "",
        active: true,
    });

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [poResponse, piResponse, vendorResponse] = await Promise.all([
                matflowApi.listPurchaseOrders(),
                matflowApi.listPurchaseIndents({ plantCode: procurementPlantParam }),
                matflowApi.listVendors({ active: true }),
            ]);
            setOrders(Array.isArray(poResponse?.data) ? poResponse.data : []);
            setIndents(Array.isArray(piResponse?.data) ? piResponse.data : []);
            setVendors(Array.isArray(vendorResponse?.data) ? vendorResponse.data : []);
        } catch (requestError) {
            setOrders([]);
            setIndents([]);
            setVendors([]);
            setError(readMatFlowError(requestError, "Unable to load Purchase workspace."));
        } finally {
            setLoading(false);
        }
    }, [procurementPlantParam]);

    useEffect(() => { load(); }, [load]);

    const scopedOrders = useMemo(() => orders.filter((order) =>
        !procurementPlantParam || upperCode(order.plantCode) === upperCode(procurementPlantParam)
    ), [orders, procurementPlantParam]);

    const purchaseReadyIndents = useMemo(() => indents.filter((indent) =>
        ["SUBMITTED_TO_PURCHASE", "PURCHASE_IN_PROGRESS", "PO_CREATED", "PARTIALLY_RECEIVED"].includes(normalize(indent.status)) &&
        openIndentLines(indent).length > 0
    ), [indents]);

    const filteredOrders = useMemo(() => {
        const term = clean(search).toLowerCase();
        if (!term) return scopedOrders;
        return scopedOrders.filter((order) => [
            order.poNumber,
            order.indentNumber,
            order.requisitionNumber,
            order.vendorName,
            order.projectCode,
            order.productName,
            order.drawingNo,
            order.deliveryLocationCode,
            order.status,
        ].some((value) => clean(value).toLowerCase().includes(term)));
    }, [scopedOrders, search]);

    const orderPagination = useMatFlowPagination(filteredOrders, 15);
    const indentPagination = useMatFlowPagination(purchaseReadyIndents, 10);
    const vendorPagination = useMatFlowPagination(vendors, 10);

    const selectedIndent = purchaseReadyIndents.find((indent) => String(indent.id) === String(poForm.indentId)) || null;
    const poLines = openIndentLines(selectedIndent);

    const counts = useMemo(() => ({
        openPis: purchaseReadyIndents.length,
        placed: scopedOrders.filter((order) => normalize(order.status) === "PLACED").length,
        partial: scopedOrders.filter((order) => normalize(order.status) === "PARTIALLY_RECEIVED").length,
        received: scopedOrders.filter((order) => normalize(order.status) === "RECEIVED").length,
    }), [purchaseReadyIndents, scopedOrders]);

    const purchaseKanbanCards = useMemo(() => {
        const term = clean(search).toLowerCase();
        const piCards = purchaseReadyIndents.map((indent) => ({
            ...indent,
            _cardType: "PI",
            _lane: normalize(indent.status) === "PO_CREATED" ? "PO_PLACED" : "NEW_PI",
        }));
        const poCards = scopedOrders.map((order) => {
            const status = normalize(order.status);
            return {
                ...order,
                _cardType: "PO",
                _lane: status === "RECEIVED" ? "RECEIVED"
                    : status === "PARTIALLY_RECEIVED" ? "PARTIAL"
                        : status === "PLACED" ? "WAITING" : "PO_PLACED",
            };
        });
        const cards = [...piCards, ...poCards];
        if (!term) return cards;
        return cards.filter((row) => [
            row.indentNumber, row.poNumber, row.requisitionNumber, row.projectCode,
            row.productName, row.drawingNo, row.vendorName, row.status,
        ].some((value) => clean(value).toLowerCase().includes(term)));
    }, [purchaseReadyIndents, scopedOrders, search]);

    const openPo = (indent = null) => {
        const quantities = {};
        openIndentLines(indent).forEach((line) => {
            quantities[String(line.id)] = String(line.outstanding);
        });
        setPoForm({
            indentId: indent?.id ? String(indent.id) : "",
            vendorId: "",
            poDate: new Date().toISOString().slice(0, 10),
            remarks: "",
            quantities,
        });
        setPoDialog(true);
        setError("");
    };

    useEffect(() => {
        if (!selectedIndent) return;
        const quantities = {};
        poLines.forEach((line) => { quantities[String(line.id)] = String(line.outstanding); });
        setPoForm((current) => ({ ...current, quantities }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedIndent?.id]);

    const createPo = async () => {
        if (!selectedIndent?.id || !poForm.vendorId || !poForm.poDate) {
            setError("Select a Store-raised PI, Vendor and PO date.");
            return;
        }
        if (!selectedIndent.deliverToLocationId) {
            setError("The selected PI has no Store delivery location.");
            return;
        }

        const lines = poLines
            .map((line) => ({
                indentLineId: line.id,
                orderedQty: Number(poForm.quantities[String(line.id)] || 0),
                remarks: null,
            }))
            .filter((line) => Number.isFinite(line.orderedQty) && line.orderedQty > .0005);

        if (!lines.length) {
            setError("Enter at least one PO quantity.");
            return;
        }

        for (const requestLine of lines) {
            const source = poLines.find((line) => String(line.id) === String(requestLine.indentLineId));
            if (requestLine.orderedQty > numeric(source?.outstanding) + .0005) {
                setError(`PO quantity exceeds outstanding PI quantity for ${source?.materialCode || "material"}.`);
                return;
            }
        }

        setWorking(true);
        setError("");
        try {
            await matflowApi.createPurchaseOrder({
                poNumber: null,
                poDate: poForm.poDate,
                vendorId: poForm.vendorId,
                indentId: selectedIndent.id,
                deliveryLocationId: selectedIndent.deliverToLocationId,
                lines,
                remarks: clean(poForm.remarks) || null,
            });
            setPoDialog(false);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to place Purchase Order."));
        } finally {
            setWorking(false);
        }
    };

    const openVendor = (vendor = null) => {
        setVendorDialog({ vendor });
        setVendorForm({
            vendorCode: vendor?.vendorCode || "",
            vendorName: vendor?.vendorName || "",
            gstin: vendor?.gstin || "",
            contactPerson: vendor?.contactPerson || "",
            contactPhone: vendor?.contactPhone || "",
            email: vendor?.email || "",
            address: vendor?.address || "",
            active: vendor?.active !== false,
        });
        setError("");
    };

    const saveVendor = async () => {
        if (!clean(vendorForm.vendorCode) || !clean(vendorForm.vendorName)) {
            setError("Vendor code and Vendor name are required.");
            return;
        }
        setWorking(true);
        setError("");
        try {
            const body = {
                vendorCode: upperCode(vendorForm.vendorCode),
                vendorName: clean(vendorForm.vendorName),
                gstin: clean(vendorForm.gstin) || null,
                contactPerson: clean(vendorForm.contactPerson) || null,
                contactPhone: clean(vendorForm.contactPhone) || null,
                email: clean(vendorForm.email) || null,
                address: clean(vendorForm.address) || null,
                active: vendorForm.active === true,
                rowVersion: vendorDialog?.vendor?.rowVersion ?? null,
            };
            if (vendorDialog?.vendor?.id) await matflowApi.updateVendor(vendorDialog.vendor.id, body);
            else await matflowApi.createVendor(body);
            setVendorDialog(null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to save Vendor."));
        } finally {
            setWorking(false);
        }
    };

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="PURCHASE"
                title="Purchase Indents & Purchase Orders"
                subtitle="Purchase works centrally from AL-P1 Main Store shortage PIs linked to MRs from all four plants. PO/GRN delivery remains fixed to AL-P1 Main Store; there is no PO approval desk."
                actions={
                    <>
                        <Button
                            startIcon={<FileDownloadOutlinedIcon />}
                            onClick={() => downloadMatFlowExcel({
                                fileName: "MatFlow_Purchase_Orders",
                                sheetName: "Purchase Orders",
                                title: "MatFlow Purchase Orders",
                                rows: filteredOrders,
                            })}
                            sx={secondaryBtnSx}
                        >
                            Export Excel
                        </Button>
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                        {canPurchase && <Button startIcon={<AddIcon />} onClick={() => openVendor()} sx={secondaryBtnSx}>Add Vendor</Button>}
                        {canPurchase && <Button startIcon={<AddIcon />} onClick={() => openPo()} sx={primaryBtnSx}>Create PO</Button>}
                    </>
                }
            />

            <ErrorBox>{error}</ErrorBox>

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 1 }}>
                <SummaryCard label="Open PIs" value={counts.openPis} />
                <SummaryCard label="Placed POs" value={counts.placed} />
                <SummaryCard label="Partially Received" value={counts.partial} />
                <SummaryCard label="Received POs" value={counts.received} />
            </Box>

            <Card sx={{ ...panelSx, display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                <TextField label="Search PI / PO / MR / Vendor / Product" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ ...fieldSx, minWidth: 320, flex: "1 1 320px" }} />
                <MatFlowViewToggle value={viewMode} onChange={setViewMode} options={[{ value: "KANBAN", label: "Kanban" }, { value: "TABLE", label: "Table" }]} />
            </Card>

            {viewMode === "KANBAN" && (
                <Card sx={panelSx}>
                    {loading ? <LoadingBlock /> : (
                        <MatFlowKanbanBoard
                            columns={PURCHASE_KANBAN_COLUMNS}
                            items={purchaseKanbanCards}
                            laneFor={(row) => row._lane}
                            minColumnWidth={280}
                            renderCard={(row) => (
                                <Card sx={{ ...panelSx, m: 0, p: 1.1, boxShadow: "none" }}>
                                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: .6, alignItems: "flex-start" }}>
                                        <Box sx={{ minWidth: 0 }}>
                                            <Typography sx={{ ...mainTextSx, fontSize: 12.5 }}>{row._cardType === "PI" ? row.indentNumber : row.poNumber}</Typography>
                                            <Typography sx={subTextSx}>{row.requisitionNumber || "-"} · {row.projectCode || "-"}</Typography>
                                        </Box>
                                        <MatFlowStatusChip status={row.status} />
                                    </Box>
                                    <Typography sx={{ ...subTextSx, mt: .7 }}>{row.productName || "-"} · {row.drawingNo || "-"}</Typography>
                                    <Typography sx={subTextSx}>{row._cardType === "PO" ? `Vendor: ${row.vendorName || "-"}` : `${openIndentLines(row).length} open PI line(s)`}</Typography>
                                    <Typography sx={subTextSx}>Delivery: {row.deliveryLocationCode || row.deliverToLocationCode || "AL-P1 Main Store"}</Typography>
                                    {row._cardType === "PI" && canPurchase && (
                                        <Button onClick={() => openPo(row)} sx={{ ...primaryBtnSx, mt: .85 }}>Raise / Continue PO</Button>
                                    )}
                                </Card>
                            )}
                        />
                    )}
                </Card>
            )}

            {viewMode === "TABLE" && <Card sx={panelSx}>
                <Typography sx={{ fontWeight: 950, fontSize: 17 }}>Store-raised Purchase Indents</Typography>
                <Typography sx={{ ...subTextSx, mb: 1.2 }}>Each PI stays linked to its originating MR, Project/Product and shortage material lines.</Typography>
                {loading ? <LoadingBlock /> : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 170px 210px 160px 140px 150px" }}>
                            {["PI", "Linked MR", "PD No. / Product", "Delivery Store", "Status", "Action"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {indentPagination.pageItems.length === 0 ? <EmptyState>No open Store-raised PI.</EmptyState> : indentPagination.pageItems.map((indent) => (
                            <Box key={indent.id} sx={{ ...tableRowSx, gridTemplateColumns: "170px 170px 210px 160px 140px 150px" }}>
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{indent.indentNumber}</Typography><Typography sx={subTextSx}>{openIndentLines(indent).length} open line(s)</Typography></Box>
                                <Box sx={tableCellSx}>{indent.requisitionNumber || "-"}</Box>
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{indent.projectCode || "-"}</Typography><Typography sx={subTextSx}>{indent.productName || "-"} · {indent.drawingNo || "-"}</Typography></Box>
                                <Box sx={tableCellSx}>{indent.deliverToLocationCode || "-"}</Box>
                                <Box sx={tableCellSx}><MatFlowStatusChip status={indent.status} /></Box>
                                <Box sx={tableCellSx}>{canPurchase && <Button onClick={() => openPo(indent)} sx={primaryBtnSx}>Raise PO</Button>}</Box>
                            </Box>
                        ))}
                    </Box>
                )}
                {!loading && <MatFlowPagination {...indentPagination} onPageChange={indentPagination.setPage} onPageSizeChange={indentPagination.setPageSize} label="Purchase Indents" />}
            </Card>}

            {viewMode === "TABLE" && <Card sx={panelSx}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1 }}>
                    <Box><Typography sx={{ fontWeight: 950, fontSize: 17 }}>Purchase Orders</Typography><Typography sx={subTextSx}>PO numbers are generated by the backend as PO/yyyy/MM/dd/n.</Typography></Box>
                    <Typography sx={subTextSx}>Filtered by the search above.</Typography>
                </Box>
                {loading ? <LoadingBlock /> : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 170px 170px 200px 160px 130px" }}>
                            {["PO", "PI / MR", "Vendor", "PD No. / Product", "Delivery", "Status"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {orderPagination.pageItems.length === 0 ? <EmptyState /> : orderPagination.pageItems.map((order) => (
                            <Box key={order.id} sx={{ ...tableRowSx, gridTemplateColumns: "170px 170px 170px 200px 160px 130px" }}>
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{order.poNumber}</Typography><Typography sx={subTextSx}>{order.poDate || "-"}</Typography></Box>
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{order.indentNumber || "-"}</Typography><Typography sx={subTextSx}>{order.requisitionNumber || "-"}</Typography></Box>
                                <Box sx={tableCellSx}>{order.vendorName || "-"}</Box>
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{order.projectCode || "-"}</Typography><Typography sx={subTextSx}>{order.productName || "-"} · {order.drawingNo || "-"}</Typography></Box>
                                <Box sx={tableCellSx}>{order.deliveryLocationCode || "-"} · {order.plantCode || "-"}</Box>
                                <Box sx={tableCellSx}><MatFlowStatusChip status={order.status} /></Box>
                            </Box>
                        ))}
                    </Box>
                )}
                {!loading && <MatFlowPagination {...orderPagination} onPageChange={orderPagination.setPage} onPageSizeChange={orderPagination.setPageSize} label="Purchase Orders" />}
            </Card>}

            <Card sx={panelSx}>
                <Typography sx={{ fontWeight: 950, fontSize: 17, mb: 1 }}>Vendors</Typography>
                <Box sx={tableShellSx}>
                    <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "140px 200px 170px 160px 200px 100px" }}>
                        {["Code", "Vendor", "Contact", "Phone", "Email", "Action"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                    </Box>
                    {vendorPagination.pageItems.length === 0 ? <EmptyState /> : vendorPagination.pageItems.map((vendor) => (
                        <Box key={vendor.id} sx={{ ...tableRowSx, gridTemplateColumns: "140px 200px 170px 160px 200px 100px" }}>
                            <Box sx={tableCellSx}>{vendor.vendorCode}</Box>
                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{vendor.vendorName}</Typography><Typography sx={subTextSx}>{vendor.gstin || "-"}</Typography></Box>
                            <Box sx={tableCellSx}>{vendor.contactPerson || "-"}</Box>
                            <Box sx={tableCellSx}>{vendor.contactPhone || "-"}</Box>
                            <Box sx={tableCellSx}>{vendor.email || "-"}</Box>
                            <Box sx={tableCellSx}>{canPurchase && <Button onClick={() => openVendor(vendor)} sx={secondaryBtnSx}>Edit</Button>}</Box>
                        </Box>
                    ))}
                </Box>
                <MatFlowPagination {...vendorPagination} onPageChange={vendorPagination.setPage} onPageSizeChange={vendorPagination.setPageSize} label="Vendors" />
            </Card>

            <Dialog open={poDialog} onClose={() => !working && setPoDialog(false)} fullWidth maxWidth="md" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>Create & Place Purchase Order</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Alert severity="info" sx={{ mb: 1.5 }}>
                        The backend generates the PO number. The PO is immediately placed against the selected PI; no approval step follows.
                    </Alert>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
                        <TextField select label="Store PI *" value={poForm.indentId} onChange={(e) => setPoForm((c) => ({ ...c, indentId: e.target.value }))} sx={fieldSx}>
                            {purchaseReadyIndents.map((indent) => <MenuItem key={indent.id} value={indent.id}>{indent.indentNumber} · {indent.requisitionNumber} · {indent.projectCode} · {indent.productName}</MenuItem>)}
                        </TextField>
                        <TextField select label="Vendor *" value={poForm.vendorId} onChange={(e) => setPoForm((c) => ({ ...c, vendorId: e.target.value }))} sx={fieldSx}>
                            {vendors.filter((vendor) => vendor.active !== false).map((vendor) => <MenuItem key={vendor.id} value={vendor.id}>{vendor.vendorName} · {vendor.vendorCode}</MenuItem>)}
                        </TextField>
                        <TextField type="date" label="PO Date *" InputLabelProps={{ shrink: true }} value={poForm.poDate} onChange={(e) => setPoForm((c) => ({ ...c, poDate: e.target.value }))} sx={fieldSx} />
                        <TextField label="Delivery Store" value={selectedIndent?.deliverToLocationCode || ""} disabled sx={fieldSx} />
                        <TextField multiline minRows={2} label="Remarks" value={poForm.remarks} onChange={(e) => setPoForm((c) => ({ ...c, remarks: e.target.value }))} sx={{ ...fieldSx, gridColumn: "1 / -1" }} />
                    </Box>

                    {selectedIndent && (
                        <Box sx={{ mt: 1.5 }}>
                            <Typography sx={mainTextSx}>PI Material Lines</Typography>
                            <Box sx={tableShellSx}>
                                <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "220px 120px 120px 150px" }}>
                                    {["Material", "PI Qty", "Outstanding", "Order Qty"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                                </Box>
                                {poLines.map((line) => (
                                    <Box key={line.id} sx={{ ...tableRowSx, gridTemplateColumns: "220px 120px 120px 150px" }}>
                                        <Box sx={tableCellSx}><Typography sx={mainTextSx}>{line.materialName}</Typography><Typography sx={subTextSx}>{line.materialCode} · {line.uom}</Typography></Box>
                                        <Box sx={tableCellSx}>{formatQty(line.requiredQty)}</Box>
                                        <Box sx={tableCellSx}>{formatQty(line.outstanding)}</Box>
                                        <Box sx={tableCellSx}><TextField type="number" size="small" value={poForm.quantities[String(line.id)] || ""} onChange={(e) => setPoForm((c) => ({ ...c, quantities: { ...c.quantities, [String(line.id)]: e.target.value } }))} sx={fieldSx} /></Box>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setPoDialog(false)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
                    <Button onClick={createPo} disabled={working} sx={primaryBtnSx}>{working ? "Placing..." : "Place PO"}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(vendorDialog)} onClose={() => !working && setVendorDialog(null)} fullWidth maxWidth="md" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>{vendorDialog?.vendor ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
                        <TextField label="Vendor Code *" value={vendorForm.vendorCode} onChange={(e) => setVendorForm((c) => ({ ...c, vendorCode: e.target.value }))} sx={fieldSx} />
                        <TextField label="Vendor Name *" value={vendorForm.vendorName} onChange={(e) => setVendorForm((c) => ({ ...c, vendorName: e.target.value }))} sx={fieldSx} />
                        <TextField label="GSTIN" value={vendorForm.gstin} onChange={(e) => setVendorForm((c) => ({ ...c, gstin: e.target.value }))} sx={fieldSx} />
                        <TextField label="Contact Person" value={vendorForm.contactPerson} onChange={(e) => setVendorForm((c) => ({ ...c, contactPerson: e.target.value }))} sx={fieldSx} />
                        <TextField label="Contact Phone" value={vendorForm.contactPhone} onChange={(e) => setVendorForm((c) => ({ ...c, contactPhone: e.target.value }))} sx={fieldSx} />
                        <TextField label="Email" value={vendorForm.email} onChange={(e) => setVendorForm((c) => ({ ...c, email: e.target.value }))} sx={fieldSx} />
                        <TextField multiline minRows={2} label="Address" value={vendorForm.address} onChange={(e) => setVendorForm((c) => ({ ...c, address: e.target.value }))} sx={{ ...fieldSx, gridColumn: "1 / -1" }} />
                        <FormControlLabel control={<Switch checked={vendorForm.active === true} onChange={(e) => setVendorForm((c) => ({ ...c, active: e.target.checked }))} />} label="Active" />
                    </Box>
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setVendorDialog(null)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
                    <Button onClick={saveVendor} disabled={working} sx={primaryBtnSx}>{working ? "Saving..." : "Save Vendor"}</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export function MatFlowReceivingPage() {
    const { hasRole, selectedPlantParam } = useMatFlow();
    const centralReceivingUser = hasRole(MATFLOW_ROLES.STORE) && !hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER);
    const receivingPlantParam = centralReceivingUser ? undefined : selectedPlantParam;
    const canReceive = hasRole(RECEIVING_ROLES);

    const [orders, setOrders] = useState([]);
    const [receipts, setReceipts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [dialog, setDialog] = useState(false);
    const [form, setForm] = useState({
        purchaseOrderId: "",
        vendorChallanNo: "",
        vendorInvoiceNo: "",
        remarks: "",
        quantities: {},
        batches: {},
    });

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [poResponse, grnResponse] = await Promise.all([
                matflowApi.listPurchaseOrders(),
                matflowApi.listGoodsReceipts(),
            ]);
            setOrders((Array.isArray(poResponse?.data) ? poResponse.data : []).filter((order) =>
                ["PLACED", "PARTIALLY_RECEIVED"].includes(normalize(order.status)) &&
                (!receivingPlantParam || upperCode(order.plantCode) === upperCode(receivingPlantParam))
            ));
            setReceipts((Array.isArray(grnResponse?.data) ? grnResponse.data : []).filter((receipt) =>
                !receivingPlantParam || upperCode(receipt.plantCode) === upperCode(receivingPlantParam)
            ));
        } catch (requestError) {
            setOrders([]);
            setReceipts([]);
            setError(readMatFlowError(requestError, "Unable to load GRN / Receiving."));
        } finally {
            setLoading(false);
        }
    }, [receivingPlantParam]);

    useEffect(() => { load(); }, [load]);

    const selectedOrder = orders.find((order) => String(order.id) === String(form.purchaseOrderId)) || null;
    const openLines = (selectedOrder?.lines || []).map((line) => ({
        ...line,
        outstanding: Math.max(0, numeric(line.orderedQty) - numeric(line.receivedQty)),
    })).filter((line) => line.outstanding > .0005);

    useEffect(() => {
        if (!selectedOrder) return;
        const quantities = {};
        const batches = {};
        openLines.forEach((line) => {
            quantities[String(line.id)] = String(line.outstanding);
            batches[String(line.id)] = "";
        });
        setForm((current) => ({ ...current, quantities, batches }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedOrder?.id]);

    const createGrn = async () => {
        if (!selectedOrder?.id || !selectedOrder.deliveryLocationId) {
            setError("Select an open Purchase Order with a Store delivery location.");
            return;
        }

        const lines = openLines.map((line) => ({
            purchaseOrderLineId: line.id,
            receivedQty: Number(form.quantities[String(line.id)] || 0),
            batchNo: clean(form.batches[String(line.id)]) || null,
        })).filter((line) => Number.isFinite(line.receivedQty) && line.receivedQty > .0005);

        if (!lines.length) {
            setError("Enter at least one received quantity.");
            return;
        }

        for (const requestLine of lines) {
            const source = openLines.find((line) => String(line.id) === String(requestLine.purchaseOrderLineId));
            if (requestLine.receivedQty > numeric(source?.outstanding) + .0005) {
                setError(`GRN quantity exceeds PO outstanding quantity for ${source?.materialCode || "material"}.`);
                return;
            }
        }

        setWorking(true);
        setError("");
        try {
            await matflowApi.createGoodsReceipt({
                purchaseOrderId: selectedOrder.id,
                receiptLocationId: selectedOrder.deliveryLocationId,
                vendorChallanNo: clean(form.vendorChallanNo) || null,
                vendorInvoiceNo: clean(form.vendorInvoiceNo) || null,
                lines,
                remarks: clean(form.remarks) || null,
            });
            setDialog(false);
            setForm({
                purchaseOrderId: "",
                vendorChallanNo: "",
                vendorInvoiceNo: "",
                remarks: "",
                quantities: {},
                batches: {},
            });
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to post GRN."));
        } finally {
            setWorking(false);
        }
    };

    const receiptPagination = useMatFlowPagination(receipts, 20);

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="STORE RECEIVING"
                title="GRN / Goods Receipt"
                subtitle="GRN/receiving is centralized at AL-P1 Main Store for POs raised from all four plants. Accepted inward quantity enters Main Store stock; QC remains an optional Main Store checklist and routing stays with Store planning."
                actions={
                    <>
                        <Button
                            startIcon={<FileDownloadOutlinedIcon />}
                            onClick={() => downloadMatFlowExcel({
                                fileName: "MatFlow_GRNs",
                                sheetName: "GRN",
                                title: "MatFlow Goods Receipt Notes",
                                rows: receipts,
                            })}
                            sx={secondaryBtnSx}
                        >
                            Export Excel
                        </Button>
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                        {canReceive && <Button startIcon={<AddIcon />} onClick={() => setDialog(true)} sx={primaryBtnSx}>Create GRN</Button>}
                    </>
                }
            />

            <ErrorBox>{error}</ErrorBox>

            <Card sx={panelSx}>
                <Alert severity="info">
                    After GRN, return to the Store MR workbench. The newly inwarded quantity becomes Store stock and can then be reserved against the MR shortage.
                </Alert>
            </Card>

            <Card sx={panelSx}>
                {loading ? <LoadingBlock /> : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 160px 160px 170px 200px 130px" }}>
                            {["GRN", "PO / PI", "Linked MR", "Store", "PD No. / Product", "Received"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {receiptPagination.pageItems.length === 0 ? <EmptyState>No GRN records.</EmptyState> : receiptPagination.pageItems.map((receipt) => (
                            <Box key={receipt.id} sx={{ ...tableRowSx, gridTemplateColumns: "170px 160px 160px 170px 200px 130px" }}>
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{receipt.grnNumber}</Typography><Typography sx={subTextSx}>{formatDate(receipt.receivedAt)}</Typography></Box>
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{receipt.poNumber || "-"}</Typography><Typography sx={subTextSx}>{receipt.indentNumber || "-"}</Typography></Box>
                                <Box sx={tableCellSx}>{receipt.requisitionNumber || "-"}</Box>
                                <Box sx={tableCellSx}>{receipt.receiptLocationCode || "-"} · {receipt.plantCode || "-"}</Box>
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{receipt.projectCode || "-"}</Typography><Typography sx={subTextSx}>{receipt.productName || "-"} · {receipt.drawingNo || "-"}</Typography></Box>
                                <Box sx={tableCellSx}><MatFlowStatusChip status={receipt.status} /></Box>
                            </Box>
                        ))}
                    </Box>
                )}
                {!loading && <MatFlowPagination {...receiptPagination} onPageChange={receiptPagination.setPage} onPageSizeChange={receiptPagination.setPageSize} label="GRNs" />}
            </Card>

            <Dialog open={dialog} onClose={() => !working && setDialog(false)} fullWidth maxWidth="md" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>Create Goods Receipt Note</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
                        <TextField select label="Open PO *" value={form.purchaseOrderId} onChange={(e) => setForm((c) => ({ ...c, purchaseOrderId: e.target.value }))} sx={{ ...fieldSx, gridColumn: "1 / -1" }}>
                            {orders.map((order) => (
                                <MenuItem key={order.id} value={order.id}>
                                    {order.poNumber} · {order.vendorName} · {order.indentNumber} · {order.requisitionNumber}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField label="Vendor Challan No." value={form.vendorChallanNo} onChange={(e) => setForm((c) => ({ ...c, vendorChallanNo: e.target.value }))} sx={fieldSx} />
                        <TextField label="Vendor Invoice No." value={form.vendorInvoiceNo} onChange={(e) => setForm((c) => ({ ...c, vendorInvoiceNo: e.target.value }))} sx={fieldSx} />
                        <TextField label="Receipt Store" value={selectedOrder?.deliveryLocationCode || ""} disabled sx={fieldSx} />
                        <TextField label="Linked MR" value={selectedOrder?.requisitionNumber || ""} disabled sx={fieldSx} />
                        <TextField multiline minRows={2} label="Remarks" value={form.remarks} onChange={(e) => setForm((c) => ({ ...c, remarks: e.target.value }))} sx={{ ...fieldSx, gridColumn: "1 / -1" }} />
                    </Box>

                    {selectedOrder && (
                        <Box sx={{ mt: 1.5 }}>
                            <Typography sx={mainTextSx}>PO Receipt Lines</Typography>
                            <Box sx={tableShellSx}>
                                <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "220px 120px 120px 150px 150px" }}>
                                    {["Material", "Ordered", "Outstanding", "Receive Qty", "Batch"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                                </Box>
                                {openLines.map((line) => (
                                    <Box key={line.id} sx={{ ...tableRowSx, gridTemplateColumns: "220px 120px 120px 150px 150px" }}>
                                        <Box sx={tableCellSx}><Typography sx={mainTextSx}>{line.materialName}</Typography><Typography sx={subTextSx}>{line.materialCode} · {line.uom}</Typography></Box>
                                        <Box sx={tableCellSx}>{formatQty(line.orderedQty)}</Box>
                                        <Box sx={tableCellSx}>{formatQty(line.outstanding)}</Box>
                                        <Box sx={tableCellSx}><TextField type="number" size="small" value={form.quantities[String(line.id)] || ""} onChange={(e) => setForm((c) => ({ ...c, quantities: { ...c.quantities, [String(line.id)]: e.target.value } }))} sx={fieldSx} /></Box>
                                        <Box sx={tableCellSx}><TextField size="small" value={form.batches[String(line.id)] || ""} onChange={(e) => setForm((c) => ({ ...c, batches: { ...c.batches, [String(line.id)]: e.target.value } }))} sx={fieldSx} /></Box>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setDialog(false)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
                    <Button onClick={createGrn} disabled={working} sx={primaryBtnSx}>{working ? "Posting..." : "Post GRN"}</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
