import { useCallback, useEffect, useMemo, useState } from "react";
import {
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
import ApprovalOutlinedIcon from "@mui/icons-material/ApprovalOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import { MATFLOW_ROLES, useMatFlow } from "../matflowUi";
import { matflowApi, readMatFlowError } from "../api/matflowApi";
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
    secondaryBtnSx,
    subTextSx,
    tableCellSx,
    tableHeaderSx,
    tableRowSx,
    tableShellSx,
    useMatFlowPagination,
} from "../matflowUi";

const PURCHASE_ROLES = [
    MATFLOW_ROLES.ADMIN,
    MATFLOW_ROLES.MANAGER,
    MATFLOW_ROLES.PURCHASE,
];

const APPROVAL_ROLES = [
    MATFLOW_ROLES.ADMIN,
    MATFLOW_ROLES.MANAGER,
    MATFLOW_ROLES.DIRECTOR,
];

const upperCode = (value) => clean(value).toUpperCase();

async function discoverPurchaseIndents() {
    const requisitionResponse = await matflowApi.listRequisitions();
    const requisitions = Array.isArray(requisitionResponse?.data)
        ? requisitionResponse.data
        : [];

    const snapshots = await Promise.all(
        requisitions.map(async (requisition) => {
            try {
                return (await matflowApi.getRequisitionPlanning(requisition.id))?.data;
            } catch {
                return null;
            }
        })
    );

    const map = new Map();
    snapshots.filter(Boolean).forEach((snapshot) => {
        (snapshot.indents || []).forEach((indent) => {
            if (
                [
                    "SUBMITTED_TO_PURCHASE",
                    "PURCHASE_IN_PROGRESS",
                    "PO_CREATED",
                    "PARTIALLY_RECEIVED",
                ].includes(normalize(indent.status))
            ) {
                map.set(String(indent.id), {
                    ...indent,
                    requisition: snapshot.requisition,
                });
            }
        });
    });

    return Array.from(map.values());
}

export function MatFlowPurchasePage() {
    const { hasRole } = useMatFlow();
    const canPurchase = hasRole(PURCHASE_ROLES);

    const [orders, setOrders] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [indents, setIndents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [poDialog, setPoDialog] = useState(false);
    const [vendorDialog, setVendorDialog] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const [poForm, setPoForm] = useState({
        indentId: "",
        vendorId: "",
        poNumber: "",
        poDate: new Date().toISOString().slice(0, 10),
        remarks: "",
        quantities: {},
    });

    const [vendorForm, setVendorForm] = useState({
        vendorCode: "",
        vendorName: "",
        gstin: "",
        contactPerson: "",
        phone: "",
        email: "",
        address: "",
        active: true,
    });

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [orderResponse, vendorResponse, purchaseIndents] =
                await Promise.all([
                    matflowApi.listPurchaseOrders(),
                    matflowApi.listVendors({ active: true }),
                    discoverPurchaseIndents(),
                ]);

            setOrders(Array.isArray(orderResponse?.data) ? orderResponse.data : []);
            setVendors(Array.isArray(vendorResponse?.data) ? vendorResponse.data : []);
            setIndents(purchaseIndents);
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to load Purchase workspace."));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const selectedIndent = indents.find(
        (indent) => String(indent.id) === String(poForm.indentId)
    );

    const poLines = useMemo(
        () =>
            (selectedIndent?.lines || [])
                .map((line) => ({
                    ...line,
                    outstanding: Math.max(
                        0,
                        numeric(line.requiredQty) - numeric(line.orderedQty)
                    ),
                }))
                .filter((line) => line.outstanding > 0),
        [selectedIndent]
    );

    useEffect(() => {
        if (!selectedIndent) return;
        const quantities = {};
        poLines.forEach((line) => {
            quantities[String(line.id)] = String(line.outstanding);
        });
        setPoForm((current) => ({ ...current, quantities }));
    }, [poForm.indentId]); // eslint-disable-line react-hooks/exhaustive-deps

    const orderPagination = useMatFlowPagination(orders, 20);
    const vendorPagination = useMatFlowPagination(vendors, 20);

    const openVendor = (row = null) => {
        setVendorDialog({ row });
        setVendorForm({
            vendorCode: row?.vendorCode || "",
            vendorName: row?.vendorName || "",
            gstin: row?.gstin || "",
            contactPerson: row?.contactPerson || "",
            phone: row?.phone || "",
            email: row?.email || "",
            address: row?.address || "",
            active: row?.active !== false,
        });
        setError("");
    };

    const saveVendor = async () => {
        if (!clean(vendorForm.vendorCode) || !clean(vendorForm.vendorName)) {
            setError("Vendor code and vendor name are required.");
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
                phone: clean(vendorForm.phone) || null,
                email: clean(vendorForm.email) || null,
                address: clean(vendorForm.address) || null,
                active: vendorForm.active === true,
                rowVersion: vendorDialog?.row?.rowVersion ?? null,
            };

            if (vendorDialog?.row?.id) {
                await matflowApi.updateVendor(vendorDialog.row.id, body);
            } else {
                await matflowApi.createVendor(body);
            }

            setVendorDialog(null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to save vendor."));
        } finally {
            setWorking(false);
        }
    };

    const createPo = async () => {
        const lines = poLines
            .map((line) => ({
                indentLineId: line.id,
                orderedQty: Number(poForm.quantities[String(line.id)] || 0),
                remarks: null,
            }))
            .filter(
                (line) => Number.isFinite(line.orderedQty) && line.orderedQty > 0
            );

        if (
            !selectedIndent?.id ||
            !poForm.vendorId ||
            !clean(poForm.poNumber) ||
            !poForm.poDate ||
            !lines.length
        ) {
            setError(
                "Indent, vendor, PO number/date and at least one ordered quantity are required."
            );
            return;
        }

        for (const line of lines) {
            const source = poLines.find(
                (item) => String(item.id) === String(line.indentLineId)
            );
            if (line.orderedQty > numeric(source?.outstanding) + 0.0005) {
                setError(
                    `Ordered quantity exceeds shortage balance for ${source?.materialCode || "material"}.`
                );
                return;
            }
        }

        setWorking(true);
        setError("");
        try {
            await matflowApi.createPurchaseOrder({
                poNumber: upperCode(poForm.poNumber),
                poDate: poForm.poDate,
                vendorId: poForm.vendorId,
                indentId: selectedIndent.id,
                deliveryLocationId: selectedIndent.deliveryLocationId,
                remarks: clean(poForm.remarks) || null,
                lines,
            });
            setPoDialog(false);
            setPoForm((current) => ({
                ...current,
                indentId: "",
                vendorId: "",
                poNumber: "",
                remarks: "",
                quantities: {},
            }));
            await load();
        } catch (requestError) {
            setError(
                readMatFlowError(requestError, "Unable to create purchase order.")
            );
        } finally {
            setWorking(false);
        }
    };

    const confirmDeleteDraft = async () => {
        if (!deleteTarget?.id || deleteTarget.rowVersion == null) return;
        setWorking(true);
        setError("");
        try {
            await matflowApi.deleteDraftPurchaseOrder(
                deleteTarget.id,
                deleteTarget.rowVersion
            );
            setDeleteTarget(null);
            await load();
        } catch (requestError) {
            setError(
                readMatFlowError(requestError, "Unable to delete the Draft purchase order.")
            );
        } finally {
            setWorking(false);
        }
    };

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="PURCHASE PROCUREMENT"
                title="Purchase Orders & Vendors"
                subtitle="Create Purchase Orders only against Store-confirmed shortage indents. Draft POs may be deleted before independent approval; placed/received POs remain procurement history."
                actions={
                    <>
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>
                            Refresh
                        </Button>
                        {canPurchase && (
                            <Button startIcon={<AddIcon />} onClick={() => openVendor(null)} sx={secondaryBtnSx}>
                                Vendor
                            </Button>
                        )}
                        {canPurchase && (
                            <Button startIcon={<AddIcon />} onClick={() => setPoDialog(true)} sx={primaryBtnSx}>
                                Create PO
                            </Button>
                        )}
                    </>
                }
            />

            <ErrorBox>{error}</ErrorBox>

            <Card sx={panelSx}>
                <Typography sx={{ fontWeight: 950, mb: 1 }}>Purchase Order Register</Typography>
                {loading ? (
                    <LoadingBlock />
                ) : (
                    <Box sx={tableShellSx}>
                        <Box
                            sx={{
                                ...tableHeaderSx,
                                gridTemplateColumns:
                                    "170px 150px 170px 170px 150px 90px 190px",
                            }}
                        >
                            {["PO", "Vendor", "Indent", "Delivery", "Status", "Lines", "Action"].map(
                                (heading) => (
                                    <Box key={heading} sx={tableCellSx}>
                                        {heading}
                                    </Box>
                                )
                            )}
                        </Box>

                        {orders.length === 0 ? (
                            <EmptyState />
                        ) : (
                            orderPagination.pageItems.map((row) => (
                                <Box
                                    key={row.id}
                                    sx={{
                                        ...tableRowSx,
                                        gridTemplateColumns:
                                            "170px 150px 170px 170px 150px 90px 190px",
                                    }}
                                >
                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>{row.poNumber || "-"}</Typography>
                                        <Typography sx={subTextSx}>{row.poDate || "-"}</Typography>
                                    </Box>
                                    <Box sx={tableCellSx}>{row.vendorName || "-"}</Box>
                                    <Box sx={tableCellSx}>{row.indentNumber || "-"}</Box>
                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>{row.deliveryLocationCode || "-"}</Typography>
                                        <Typography sx={subTextSx}>{row.deliveryPlantCode || "-"}</Typography>
                                    </Box>
                                    <Box sx={tableCellSx}>
                                        <MatFlowStatusChip status={row.status} />
                                    </Box>
                                    <Box sx={tableCellSx}>{row.lines?.length || 0}</Box>
                                    <Box sx={{ ...tableCellSx, display: "flex", gap: .6 }}>
                                        {canPurchase && normalize(row.status) === "DRAFT" && row.rowVersion != null ? (
                                            <Button
                                                startIcon={<DeleteOutlineIcon />}
                                                disabled={working}
                                                onClick={() => setDeleteTarget(row)}
                                                sx={dangerBtnSx}
                                            >
                                                Delete Draft
                                            </Button>
                                        ) : (
                                            <Typography sx={subTextSx}>History protected</Typography>
                                        )}
                                    </Box>
                                </Box>
                            ))
                        )}
                    </Box>
                )}
                {!loading && (
                    <MatFlowPagination
                        {...orderPagination}
                        onPageChange={orderPagination.setPage}
                        onPageSizeChange={orderPagination.setPageSize}
                        label="Purchase Orders"
                    />
                )}
            </Card>

            <Card sx={panelSx}>
                <Typography sx={{ fontWeight: 950, mb: 1 }}>Vendor Register</Typography>
                <Box sx={tableShellSx}>
                    <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "150px 210px 160px 160px 120px" }}>
                        {["Code", "Vendor", "GSTIN", "Contact", "Action"].map((heading) => (
                            <Box key={heading} sx={tableCellSx}>{heading}</Box>
                        ))}
                    </Box>
                    {vendors.length === 0 ? (
                        <EmptyState />
                    ) : (
                        vendorPagination.pageItems.map((row) => (
                            <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "150px 210px 160px 160px 120px" }}>
                                <Box sx={tableCellSx}>{row.vendorCode}</Box>
                                <Box sx={tableCellSx}>
                                    <Typography sx={mainTextSx}>{row.vendorName}</Typography>
                                    <Typography sx={subTextSx}>{row.email || "-"}</Typography>
                                </Box>
                                <Box sx={tableCellSx}>{row.gstin || "-"}</Box>
                                <Box sx={tableCellSx}>{row.contactPerson || row.phone || "-"}</Box>
                                <Box sx={tableCellSx}>
                                    {canPurchase && (
                                        <Button onClick={() => openVendor(row)} sx={secondaryBtnSx}>
                                            Edit
                                        </Button>
                                    )}
                                </Box>
                            </Box>
                        ))
                    )}
                </Box>
                <MatFlowPagination
                    {...vendorPagination}
                    onPageChange={vendorPagination.setPage}
                    onPageSizeChange={vendorPagination.setPageSize}
                    label="Vendors"
                />
            </Card>

            <Dialog
                open={poDialog}
                onClose={() => !working && setPoDialog(false)}
                fullWidth
                maxWidth="md"
                PaperProps={{ sx: dialogPaperSx }}
            >
                <DialogTitle sx={dialogTitleSx}>Create Purchase Order</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                        <TextField
                            select
                            label="Shortage Indent *"
                            value={poForm.indentId}
                            onChange={(event) => setPoForm((current) => ({ ...current, indentId: event.target.value }))}
                            sx={fieldSx}
                        >
                            {indents.map((indent) => (
                                <MenuItem key={indent.id} value={indent.id}>
                                    {indent.indentNumber} · {indent.requisition?.projectCode || "-"} · {indent.deliveryPlantCode || "-"}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            select
                            label="Vendor *"
                            value={poForm.vendorId}
                            onChange={(event) => setPoForm((current) => ({ ...current, vendorId: event.target.value }))}
                            sx={fieldSx}
                        >
                            {vendors.filter((vendor) => vendor.active !== false).map((vendor) => (
                                <MenuItem key={vendor.id} value={vendor.id}>
                                    {vendor.vendorCode} · {vendor.vendorName}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField label="PO Number *" value={poForm.poNumber} onChange={(event) => setPoForm((current) => ({ ...current, poNumber: event.target.value }))} sx={fieldSx} />
                        <TextField type="date" label="PO Date *" value={poForm.poDate} onChange={(event) => setPoForm((current) => ({ ...current, poDate: event.target.value }))} InputLabelProps={{ shrink: true }} sx={fieldSx} />
                        <TextField label="Remarks" value={poForm.remarks} onChange={(event) => setPoForm((current) => ({ ...current, remarks: event.target.value }))} sx={{ ...fieldSx, gridColumn: "1 / -1" }} />
                    </Box>
                    <Box sx={{ mt: 1.5 }}>
                        {poLines.map((line) => (
                            <Box key={line.id} sx={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 1, alignItems: "center", mb: 1 }}>
                                <Box>
                                    <Typography sx={mainTextSx}>{line.materialCode} · {line.materialName}</Typography>
                                    <Typography sx={subTextSx}>Outstanding {formatQty(line.outstanding)} {line.uom || ""}</Typography>
                                </Box>
                                <TextField type="number" label="Order Qty" value={poForm.quantities[String(line.id)] ?? ""} onChange={(event) => setPoForm((current) => ({ ...current, quantities: { ...current.quantities, [String(line.id)]: event.target.value } }))} sx={fieldSx} />
                            </Box>
                        ))}
                    </Box>
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setPoDialog(false)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
                    <Button onClick={createPo} disabled={working} sx={primaryBtnSx}>Create Draft PO</Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={Boolean(vendorDialog)}
                onClose={() => !working && setVendorDialog(null)}
                fullWidth
                maxWidth="sm"
                PaperProps={{ sx: dialogPaperSx }}
            >
                <DialogTitle sx={dialogTitleSx}>{vendorDialog?.row ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                        {[
                            ["vendorCode", "Vendor Code *"],
                            ["vendorName", "Vendor Name *"],
                            ["gstin", "GSTIN"],
                            ["contactPerson", "Contact Person"],
                            ["phone", "Phone"],
                            ["email", "Email"],
                            ["address", "Address"],
                        ].map(([key, label]) => (
                            <TextField
                                key={key}
                                label={label}
                                value={vendorForm[key] || ""}
                                onChange={(event) => setVendorForm((current) => ({ ...current, [key]: event.target.value }))}
                                sx={{ ...fieldSx, ...(key === "address" ? { gridColumn: "1 / -1" } : {}) }}
                            />
                        ))}
                    </Box>
                    <FormControlLabel
                        control={<Switch checked={vendorForm.active === true} onChange={(event) => setVendorForm((current) => ({ ...current, active: event.target.checked }))} />}
                        label="Active"
                    />
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setVendorDialog(null)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
                    <Button onClick={saveVendor} disabled={working} sx={primaryBtnSx}>Save Vendor</Button>
                </DialogActions>
            </Dialog>

            <MatFlowDeleteDialog
                open={Boolean(deleteTarget)}
                title="Delete Draft Purchase Order?"
                subject={deleteTarget?.poNumber || "Draft purchase order"}
                description="This removes only a Draft PO and its lines before approval/placement. Placed or received POs and their GRNs are protected procurement and stock history."
                working={working}
                onClose={() => setDeleteTarget(null)}
                onConfirm={confirmDeleteDraft}
            />
        </Box>
    );
}

export function MatFlowPoApprovalPage() {
    const { hasRole } = useMatFlow();
    const canApprove = hasRole(APPROVAL_ROLES);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState("");
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await matflowApi.listPurchaseOrders();
            setRows(
                (Array.isArray(response?.data) ? response.data : []).filter(
                    (row) => normalize(row.status) === "DRAFT"
                )
            );
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to load PO approvals."));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const approvalPagination = useMatFlowPagination(rows, 20);

    const approve = async (row) => {
        setWorking(String(row.id));
        setError("");
        try {
            await matflowApi.approvePurchaseOrder(row.id, {
                rowVersion: row.rowVersion,
                remarks: "Approved for placement.",
            });
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to approve purchase order."));
        } finally {
            setWorking("");
        }
    };

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="COMMERCIAL APPROVAL"
                title="Purchase Order Approvals"
                subtitle="Purchase creates Draft POs; Manager/Director/Admin independently approves them for placement. Deletion remains owned by the Purchase creation desk."
                actions={<Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>}
            />
            <ErrorBox>{error}</ErrorBox>
            <Card sx={panelSx}>
                {loading ? (
                    <LoadingBlock />
                ) : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 180px 180px 170px 100px 130px" }}>
                            {["PO", "Vendor", "Indent", "Delivery", "Lines", "Action"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {rows.length === 0 ? (
                            <EmptyState>No Draft purchase orders are awaiting approval.</EmptyState>
                        ) : (
                            approvalPagination.pageItems.map((row) => (
                                <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "170px 180px 180px 170px 100px 130px" }}>
                                    <Box sx={tableCellSx}>{row.poNumber}</Box>
                                    <Box sx={tableCellSx}>{row.vendorName}</Box>
                                    <Box sx={tableCellSx}>{row.indentNumber}</Box>
                                    <Box sx={tableCellSx}>{row.deliveryLocationCode}</Box>
                                    <Box sx={tableCellSx}>{row.lines?.length || 0}</Box>
                                    <Box sx={tableCellSx}>
                                        {canApprove ? (
                                            <Button startIcon={<ApprovalOutlinedIcon />} disabled={working === String(row.id)} onClick={() => approve(row)} sx={primaryBtnSx}>
                                                Approve
                                            </Button>
                                        ) : "-"}
                                    </Box>
                                </Box>
                            ))
                        )}
                    </Box>
                )}
                {!loading && (
                    <MatFlowPagination
                        {...approvalPagination}
                        onPageChange={approvalPagination.setPage}
                        onPageSizeChange={approvalPagination.setPageSize}
                        label="PO Approvals"
                    />
                )}
            </Card>
        </Box>
    );
}

export function MatFlowReceivingPage() {
    const { hasRole } = useMatFlow();
    const canReceive = hasRole(
        MATFLOW_ROLES.ADMIN,
        MATFLOW_ROLES.MANAGER,
        MATFLOW_ROLES.STORE
    );

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
            const [orderResponse, receiptResponse] = await Promise.all([
                matflowApi.listPurchaseOrders(),
                matflowApi.listGoodsReceipts(),
            ]);
            setOrders(
                (Array.isArray(orderResponse?.data) ? orderResponse.data : []).filter(
                    (row) => ["PLACED", "PARTIALLY_RECEIVED"].includes(normalize(row.status))
                )
            );
            setReceipts(
                Array.isArray(receiptResponse?.data) ? receiptResponse.data : []
            );
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to load receiving workspace."));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const selected = orders.find(
        (order) => String(order.id) === String(form.purchaseOrderId)
    );

    const lines = useMemo(
        () =>
            (selected?.lines || [])
                .map((line) => ({
                    ...line,
                    outstanding: Math.max(
                        0,
                        numeric(line.orderedQty) - numeric(line.receivedQty)
                    ),
                }))
                .filter((line) => line.outstanding > 0),
        [selected]
    );

    useEffect(() => {
        if (!selected) return;
        const quantities = {};
        const batches = {};
        lines.forEach((line) => {
            quantities[String(line.id)] = String(line.outstanding);
            batches[String(line.id)] = "";
        });
        setForm((current) => ({ ...current, quantities, batches }));
    }, [form.purchaseOrderId]); // eslint-disable-line react-hooks/exhaustive-deps

    const receiptPagination = useMatFlowPagination(receipts, 20);

    const receive = async () => {
        const requestLines = lines
            .map((line) => ({
                purchaseOrderLineId: line.id,
                receivedQty: Number(form.quantities[String(line.id)] || 0),
                batchNo: clean(form.batches[String(line.id)]) || null,
            }))
            .filter(
                (line) => Number.isFinite(line.receivedQty) && line.receivedQty > 0
            );

        if (!selected?.id || !requestLines.length) {
            setError("Select a placed PO and enter at least one receipt quantity.");
            return;
        }

        setWorking(true);
        setError("");
        try {
            await matflowApi.createGoodsReceipt({
                purchaseOrderId: selected.id,
                receiptLocationId: selected.deliveryLocationId,
                vendorChallanNo: clean(form.vendorChallanNo) || null,
                vendorInvoiceNo: clean(form.vendorInvoiceNo) || null,
                remarks: clean(form.remarks) || null,
                lines: requestLines,
            });
            setDialog(false);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to create GRN."));
        } finally {
            setWorking(false);
        }
    };

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="GOODS RECEIPT"
                title="GRN & Receiving"
                subtitle="Receive approved Purchase Orders. Posted GRNs immediately become blocked stock / QC history and are intentionally non-deletable."
                actions={
                    <>
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                        {canReceive && <Button startIcon={<AddIcon />} onClick={() => setDialog(true)} sx={primaryBtnSx}>Create GRN</Button>}
                    </>
                }
            />
            <ErrorBox>{error}</ErrorBox>
            <Card sx={panelSx}>
                {loading ? (
                    <LoadingBlock />
                ) : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "160px 170px 160px 160px 160px 100px" }}>
                            {["GRN", "PO", "Location", "Received By", "Status", "Lines"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {receipts.length === 0 ? (
                            <EmptyState />
                        ) : (
                            receiptPagination.pageItems.map((row) => (
                                <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "160px 170px 160px 160px 160px 100px" }}>
                                    <Box sx={tableCellSx}>{row.grnNumber}</Box>
                                    <Box sx={tableCellSx}>{row.poNumber}</Box>
                                    <Box sx={tableCellSx}>{row.receiptLocationCode}</Box>
                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>{row.receivedBy || "-"}</Typography>
                                        <Typography sx={subTextSx}>{formatDate(row.receivedAt)}</Typography>
                                    </Box>
                                    <Box sx={tableCellSx}><MatFlowStatusChip status={row.status} /></Box>
                                    <Box sx={tableCellSx}>{row.lines?.length || 0}</Box>
                                </Box>
                            ))
                        )}
                    </Box>
                )}
                {!loading && (
                    <MatFlowPagination
                        {...receiptPagination}
                        onPageChange={receiptPagination.setPage}
                        onPageSizeChange={receiptPagination.setPageSize}
                        label="Goods Receipts"
                    />
                )}
            </Card>

            <Dialog open={dialog} onClose={() => !working && setDialog(false)} fullWidth maxWidth="md" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>Create Goods Receipt</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                        <TextField select label="Purchase Order *" value={form.purchaseOrderId} onChange={(event) => setForm((current) => ({ ...current, purchaseOrderId: event.target.value }))} sx={fieldSx}>
                            {orders.map((order) => <MenuItem key={order.id} value={order.id}>{order.poNumber} · {order.vendorName}</MenuItem>)}
                        </TextField>
                        <TextField label="Receipt Location" value={selected?.deliveryLocationCode || ""} disabled sx={fieldSx} />
                        <TextField label="Vendor Challan No." value={form.vendorChallanNo} onChange={(event) => setForm((current) => ({ ...current, vendorChallanNo: event.target.value }))} sx={fieldSx} />
                        <TextField label="Vendor Invoice No." value={form.vendorInvoiceNo} onChange={(event) => setForm((current) => ({ ...current, vendorInvoiceNo: event.target.value }))} sx={fieldSx} />
                    </Box>
                    <Box sx={{ mt: 1.5 }}>
                        {lines.map((line) => (
                            <Box key={line.id} sx={{ display: "grid", gridTemplateColumns: "1fr 160px 180px", gap: 1, alignItems: "center", mb: 1 }}>
                                <Box>
                                    <Typography sx={mainTextSx}>{line.materialCode} · {line.materialName}</Typography>
                                    <Typography sx={subTextSx}>Outstanding {formatQty(line.outstanding)} {line.uom || ""}</Typography>
                                </Box>
                                <TextField type="number" label="Receive Qty" value={form.quantities[String(line.id)] ?? ""} onChange={(event) => setForm((current) => ({ ...current, quantities: { ...current.quantities, [String(line.id)]: event.target.value } }))} sx={fieldSx} />
                                <TextField label="Batch No." value={form.batches[String(line.id)] ?? ""} onChange={(event) => setForm((current) => ({ ...current, batches: { ...current.batches, [String(line.id)]: event.target.value } }))} sx={fieldSx} />
                            </Box>
                        ))}
                    </Box>
                    <TextField fullWidth label="Remarks" value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} sx={{ ...fieldSx, mt: 1 }} />
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setDialog(false)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
                    <Button onClick={receive} disabled={working} sx={primaryBtnSx}>Receive & Send to QC</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
