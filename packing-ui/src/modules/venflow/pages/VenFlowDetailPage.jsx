import React, { useEffect, useState } from "react";

import VenFlowTracker from "../components/VenFlowTracker";

import {
    getVenFlowRole,
    isVenFlowAdminOrManager,
    isVenFlowProduction,
    isVenFlowStore,
    isVenFlowPurchase,
    canApproveVenFlowPo,
} from "../utils/venflowAccess";

import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Divider,
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";

import { useNavigate, useParams } from "react-router-dom";

import { venflowApi } from "../api/venflowApi";
import VenFlowStatusChip from "../components/VenFlowStatusChip";
import VenFlowStageChip from "../components/VenFlowStageChip";


import {
    cardSx,
    darkMenuProps,
    dividerSx,
    errorAlertSx,
    fieldSx,
    infoLabelSx,
    infoValueSx,
    loadingBoxSx,
    outlineBtnSx,
    pageHeaderSx,
    pageTitleSx,
    primaryBtnSx,
    secondaryBtnSx,
    sectionTitleSx,
} from "../venflowTheme";

export default function VenFlowDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const role = getVenFlowRole();

    const isAdminManager = isVenFlowAdminOrManager(role);
    const isProduction = isVenFlowProduction(role);
    const isStore = isVenFlowStore(role);
    const isPurchase = isVenFlowPurchase(role);
    const canApprovePo = canApproveVenFlowPo(role);

    const [entry, setEntry] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const [productForm, setProductForm] = useState({
        productDescription: "",
        veneerType: "",
        size: "",
    });

    const [storeForm, setStoreForm] = useState({
        storeStatus: "",
    });

    const [requisitionForm, setRequisitionForm] = useState({
        requisitionSlipNo: "",
        requisitionDate: "",
    });

    const [orderedForm, setOrderedForm] = useState({
        orderedQty: "",
        unit: "SHEET",
    });

    const [expectedForm, setExpectedForm] = useState({
        expectedDate: "",
    });

    const [receivedForm, setReceivedForm] = useState({
        receivedQty: "",
        actualInHouseDate: "",
    });

    const [remarksForm, setRemarksForm] = useState({
        remarks: "",
    });

    const [poForm, setPoForm] = useState({
        vendorName: "",
        poNo: "",
        poDate: "",
        poAmount: "",
        poDocumentUrl: "",
        remarks: "",
    });

    const load = async () => {
        try {
            setLoading(true);
            setError("");

            const res = await venflowApi.getEntry(id);
            const row = res.data || {};

            setEntry(row);

            setProductForm({
                productDescription: row.productDescription || "",
                veneerType: row.veneerType || "",
                size: row.size || "",
            });

            setStoreForm({
                storeStatus: row.storeStatus || "",
            });

            setRequisitionForm({
                requisitionSlipNo: row.requisitionSlipNo || "",
                requisitionDate: row.requisitionDate || "",
            });

            setOrderedForm({
                orderedQty: row.orderedQty ?? "",
                unit: row.unit || "SHEET",
            });

            setExpectedForm({
                expectedDate: row.expectedDate || "",
            });

            setReceivedForm({
                receivedQty: row.receivedQty ?? "",
                actualInHouseDate: row.actualInHouseDate || "",
            });

            setRemarksForm({
                remarks: row.remarks || "",
            });

            setPoForm({
                vendorName: row.vendorName || "",
                poNo: row.poNo || "",
                poDate: row.poDate || "",
                poAmount: row.poAmount ?? "",
                poDocumentUrl: row.poDocumentUrl || "",
                remarks: row.remarks || "",
            });
        } catch (err) {
            setEntry(null);

            setError(
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                "Unable to load VenFlow entry."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const run = async (fn) => {
        try {
            setSaving(true);
            setError("");

            await fn();
            await load();
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                "Update failed."
            );
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Box sx={loadingBoxSx}>
                <CircularProgress />
            </Box>
        );
    }

    if (!entry) {
        return (
            <Alert severity="error" sx={errorAlertSx}>
                {error || "Entry not found."}
            </Alert>
        );
    }

    return (
        <Box>
            <Box sx={pageHeaderSx}>
                <Box>
                    <Typography sx={pageTitleSx}>
                        {entry.pdNo} — {entry.clientName}
                    </Typography>

                    <Box
                        sx={{
                            display: "flex",
                            gap: 1,
                            mt: 1,
                            flexWrap: "wrap",
                        }}
                    >
                        <VenFlowStageChip stage={entry.stage} />
                        <VenFlowStatusChip status={entry.storeStatus} />
                    </Box>
                </Box>

                <Button
                    onClick={() => navigate("/venflow/entries")}
                    sx={secondaryBtnSx}
                >
                    Back to Entries
                </Button>
            </Box>
            <VenFlowTracker stage={entry.stage} />
            <Box sx={rolePanelSx}>
                <Typography sx={rolePanelTitleSx}>
                    Your Action Area
                </Typography>

                <Typography sx={rolePanelTextSx}>
                    {isAdminManager
                        ? "You can monitor the full tracker and approve PO/sign-off."
                        : role === "VENFLOW_PRODUCTION"
                            ? "You can raise requirements, update product details, set expected date, start production and mark job done."
                            : role === "VENFLOW_STORE"
                                ? "You can review store availability, send to purchase, receive material and inform production."
                                : role === "VENFLOW_PURCHASE"
                                    ? "You can update requisition, ordered quantity and raise PO."
                                    : "You have view-only VenFlow access."}
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={errorAlertSx}>
                    {error}
                </Alert>
            )}

            <Box sx={gridSx}>
                <Card sx={cardSx}>
                    <CardContent sx={{ p: 2.6 }}>
                        <Typography sx={sectionTitleSx}>
                            1. Header
                        </Typography>

                        <Divider sx={{ ...dividerSx, my: 1.5 }} />

                        <Info label="Order Date" value={entry.orderDate} />
                        <Info label="PD No." value={entry.pdNo} />
                        <Info label="Client Name" value={entry.clientName} />
                        <Info label="Plant" value={entry.plantCode} />
                        <Info label="BOM Reference" value={entry.bomReference} />
                        <Info label="BOM Attachment" value={entry.bomAttachmentUrl} />
                        <Info label="Raised By" value={entry.raisedBy} />
                        <Info label="Raised At" value={entry.raisedAt} />
                    </CardContent>
                </Card>

                {isProduction && (
                    <Card sx={cardSx}>
                        <CardContent sx={{ p: 2.6 }}>
                            <Typography sx={sectionTitleSx}>
                                2. Product Details
                            </Typography>

                            <Divider sx={{ ...dividerSx, my: 1.5 }} />

                            <Box sx={formGridSx}>
                                <TextField
                                    label="Product Description"
                                    value={productForm.productDescription}
                                    onChange={(e) =>
                                        setProductForm((p) => ({
                                            ...p,
                                            productDescription: e.target.value,
                                        }))
                                    }
                                    disabled={!isProduction}
                                    sx={fieldSx}
                                />

                                <TextField
                                    label="Veneer Type"
                                    value={productForm.veneerType}
                                    onChange={(e) =>
                                        setProductForm((p) => ({
                                            ...p,
                                            veneerType: e.target.value,
                                        }))
                                    }
                                    disabled={!isProduction}
                                    sx={fieldSx}
                                />

                                <TextField
                                    label="Size"
                                    value={productForm.size}
                                    onChange={(e) =>
                                        setProductForm((p) => ({
                                            ...p,
                                            size: e.target.value,
                                        }))
                                    }
                                    disabled={!isProduction}
                                    sx={fieldSx}
                                />
                            </Box>

                            <Button
                                variant="contained"
                                disabled={!isProduction || saving}
                                onClick={() =>
                                    run(() =>
                                        venflowApi.updateProductDetails(id, productForm)
                                    )
                                }
                                sx={{ ...primaryBtnSx, mt: 2 }}
                            >
                                Save Product Details
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {isStore && (
                    <Card sx={cardSx}>
                        <CardContent sx={{ p: 2.6 }}>
                            <Typography sx={sectionTitleSx}>
                                3. Store Status
                            </Typography>

                            <Divider sx={{ ...dividerSx, my: 1.5 }} />

                            <TextField
                                fullWidth
                                select
                                label="Veneer Status in Store"
                                value={storeForm.storeStatus}
                                onChange={(e) =>
                                    setStoreForm({
                                        storeStatus: e.target.value,
                                    })
                                }
                                disabled={!isStore}
                                sx={fieldSx}
                                SelectProps={{
                                    MenuProps: darkMenuProps,
                                }}
                            >
                                <MenuItem value="AVAILABLE_IN_STORE">
                                    Available in Store
                                </MenuItem>
                                <MenuItem value="NOT_AVAILABLE">
                                    Not Available
                                </MenuItem>
                                <MenuItem value="PARTIALLY_AVAILABLE">
                                    Partially Available
                                </MenuItem>
                                <MenuItem value="PENDING">
                                    Pending
                                </MenuItem>
                                <MenuItem value="HOLD">
                                    Hold
                                </MenuItem>
                            </TextField>

                            <Button
                                variant="contained"
                                disabled={!isStore || saving}
                                onClick={() =>
                                    run(() => venflowApi.updateStoreStatus(id, storeForm))
                                }
                                sx={{ ...primaryBtnSx, mt: 2 }}
                            >
                                Save Store Status
                            </Button>
                            <Button
                                variant="outlined"
                                disabled={!isStore || saving}
                                onClick={() =>
                                    run(() => venflowApi.sendToPurchase(id))
                                }
                                sx={{ ...outlineBtnSx, mt: 2, ml: { xs: 0, sm: 1 } }}
                            >
                                Send to Purchase
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {isPurchase && (
                    <Card sx={cardSx}>
                        <CardContent sx={{ p: 2.6 }}>
                            <Typography sx={sectionTitleSx}>
                                4. Requisition
                            </Typography>

                            <Divider sx={{ ...dividerSx, my: 1.5 }} />

                            <Box sx={formGridSx}>
                                <TextField
                                    label="Requisition Slip No."
                                    value={requisitionForm.requisitionSlipNo}
                                    onChange={(e) =>
                                        setRequisitionForm((p) => ({
                                            ...p,
                                            requisitionSlipNo: e.target.value,
                                        }))
                                    }
                                    disabled={!isPurchase}
                                    sx={fieldSx}
                                />

                                <TextField
                                    label="Requisition Date"
                                    type="date"
                                    InputLabelProps={{ shrink: true }}
                                    value={requisitionForm.requisitionDate}
                                    onChange={(e) =>
                                        setRequisitionForm((p) => ({
                                            ...p,
                                            requisitionDate: e.target.value,
                                        }))
                                    }
                                    disabled={!isPurchase}
                                    sx={fieldSx}
                                />
                            </Box>

                            <Button
                                variant="contained"
                                disabled={!isPurchase || saving}
                                onClick={() =>
                                    run(() =>
                                        venflowApi.updateRequisition(id, requisitionForm)
                                    )
                                }
                                sx={{ ...primaryBtnSx, mt: 2 }}
                            >
                                Save Requisition
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {isPurchase && (
                    <Card sx={cardSx}>
                        <CardContent sx={{ p: 2.6 }}>
                            <Typography sx={sectionTitleSx}>
                                5. Ordered Quantity
                            </Typography>

                            <Divider sx={{ ...dividerSx, my: 1.5 }} />

                            <Box sx={formGridSx}>
                                <TextField
                                    label="Ordered Qty"
                                    type="number"
                                    value={orderedForm.orderedQty}
                                    onChange={(e) =>
                                        setOrderedForm((p) => ({
                                            ...p,
                                            orderedQty: e.target.value,
                                        }))
                                    }
                                    disabled={!isPurchase}
                                    sx={fieldSx}
                                />

                                <TextField
                                    label="Unit"
                                    select
                                    value={orderedForm.unit}
                                    onChange={(e) =>
                                        setOrderedForm((p) => ({
                                            ...p,
                                            unit: e.target.value,
                                        }))
                                    }
                                    disabled={!isPurchase}
                                    sx={fieldSx}
                                    SelectProps={{
                                        MenuProps: darkMenuProps,
                                    }}
                                >
                                    <MenuItem value="SHEET">Sheet</MenuItem>
                                    <MenuItem value="PCS">Pcs</MenuItem>
                                    <MenuItem value="NO">No</MenuItem>
                                    <MenuItem value="SQFT">Sqft</MenuItem>
                                    <MenuItem value="SQM">Sqm</MenuItem>
                                    <MenuItem value="METER">Meter</MenuItem>
                                </TextField>
                            </Box>

                            <Button
                                variant="contained"
                                disabled={!isPurchase || saving}
                                onClick={() =>
                                    run(() =>
                                        venflowApi.updateOrderedQty(id, orderedForm)
                                    )
                                }
                                sx={{ ...primaryBtnSx, mt: 2 }}
                            >
                                Save Ordered Qty
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {(isPurchase || isAdminManager) && (
                    <Card sx={cardSx}>
                        <CardContent sx={{ p: 2.6 }}>
                            <Typography sx={sectionTitleSx}>
                                6. Purchase / PO
                            </Typography>

                            <Divider sx={{ ...dividerSx, my: 1.5 }} />

                            <Box sx={formGridSx}>
                                <TextField
                                    label="Vendor Name"
                                    value={poForm.vendorName}
                                    onChange={(e) =>
                                        setPoForm((p) => ({
                                            ...p,
                                            vendorName: e.target.value,
                                        }))
                                    }
                                    disabled={!isPurchase}
                                    sx={fieldSx}
                                />

                                <TextField
                                    label="PO No."
                                    value={poForm.poNo}
                                    onChange={(e) =>
                                        setPoForm((p) => ({
                                            ...p,
                                            poNo: e.target.value,
                                        }))
                                    }
                                    disabled={!isPurchase}
                                    sx={fieldSx}
                                />

                                <TextField
                                    label="PO Date"
                                    type="date"
                                    InputLabelProps={{ shrink: true }}
                                    value={poForm.poDate}
                                    onChange={(e) =>
                                        setPoForm((p) => ({
                                            ...p,
                                            poDate: e.target.value,
                                        }))
                                    }
                                    disabled={!isPurchase}
                                    sx={fieldSx}
                                />

                                <TextField
                                    label="PO Amount"
                                    type="number"
                                    value={poForm.poAmount}
                                    onChange={(e) =>
                                        setPoForm((p) => ({
                                            ...p,
                                            poAmount: e.target.value,
                                        }))
                                    }
                                    disabled={!isPurchase}
                                    sx={fieldSx}
                                />

                                <TextField
                                    label="PO Document URL"
                                    value={poForm.poDocumentUrl}
                                    onChange={(e) =>
                                        setPoForm((p) => ({
                                            ...p,
                                            poDocumentUrl: e.target.value,
                                        }))
                                    }
                                    disabled={!isPurchase}
                                    sx={fieldSx}
                                />
                            </Box>

                            <Box sx={{ mt: 2 }}>
                                <Info label="PO Status" value={entry.poStatus || "NOT_RAISED"} />
                                <Info label="PO Raised By" value={entry.poRaisedBy} />
                                <Info label="PO Raised At" value={entry.poRaisedAt} />
                                <Info label="PO Approved By" value={entry.poApprovedBy} />
                                <Info label="PO Approved At" value={entry.poApprovedAt} />
                            </Box>

                            <Box sx={{ display: "flex", gap: 1.5, mt: 2, flexWrap: "wrap" }}>
                                <Button
                                    variant="contained"
                                    disabled={!isPurchase || saving}
                                    onClick={() =>
                                        run(() => venflowApi.raisePo(id, poForm))
                                    }
                                    sx={primaryBtnSx}
                                >
                                    Raise PO
                                </Button>

                                <Button
                                    variant="outlined"
                                    disabled={!canApprovePo || saving}
                                    onClick={() =>
                                        run(() => venflowApi.approvePo(id))
                                    }
                                    sx={outlineBtnSx}
                                >
                                    Approve / Sign PO
                                </Button>
                            </Box>
                        </CardContent>
                    </Card>

                )}

                <Card sx={cardSx}>
                    <CardContent sx={{ p: 2.6 }}>
                        <Typography sx={sectionTitleSx}>
                            6. Expected Date
                        </Typography>

                        <Divider sx={{ ...dividerSx, my: 1.5 }} />

                        <TextField
                            fullWidth
                            label="Expected Date"
                            type="date"
                            InputLabelProps={{ shrink: true }}
                            value={expectedForm.expectedDate}
                            onChange={(e) =>
                                setExpectedForm({
                                    expectedDate: e.target.value,
                                })
                            }
                            disabled={!isProduction}
                            sx={fieldSx}
                        />

                        <Button
                            variant="contained"
                            disabled={!isProduction || saving}
                            onClick={() =>
                                run(() =>
                                    venflowApi.updateExpectedDate(id, expectedForm)
                                )
                            }
                            sx={{ ...primaryBtnSx, mt: 2 }}
                        >
                            Save Expected Date
                        </Button>
                    </CardContent>
                </Card>

                {isStore && (
                    <Card sx={cardSx}>
                        <CardContent sx={{ p: 2.6 }}>
                            <Typography sx={sectionTitleSx}>
                                7. Receiving
                            </Typography>

                            <Divider sx={{ ...dividerSx, my: 1.5 }} />

                            <Box sx={formGridSx}>
                                <TextField
                                    label="Received Qty"
                                    type="number"
                                    value={receivedForm.receivedQty}
                                    onChange={(e) =>
                                        setReceivedForm((p) => ({
                                            ...p,
                                            receivedQty: e.target.value,
                                        }))
                                    }
                                    disabled={!isStore}
                                    sx={fieldSx}
                                />

                                <TextField
                                    label="Actual In-house Date"
                                    type="date"
                                    InputLabelProps={{ shrink: true }}
                                    value={receivedForm.actualInHouseDate}
                                    onChange={(e) =>
                                        setReceivedForm((p) => ({
                                            ...p,
                                            actualInHouseDate: e.target.value,
                                        }))
                                    }
                                    disabled={!isStore}
                                    sx={fieldSx}
                                />
                            </Box>

                            <Button
                                variant="contained"
                                disabled={!isStore || saving}
                                onClick={() =>
                                    run(() =>
                                        venflowApi.materialReceived(id, {
                                            ...receivedForm,
                                            remarks: remarksForm.remarks,
                                        })
                                    )
                                }
                                sx={{ ...primaryBtnSx, mt: 2 }}
                            >
                                Save Receiving
                            </Button>

                            <Button
                                variant="outlined"
                                disabled={!isStore || saving}
                                onClick={() =>
                                    run(() => venflowApi.informProduction(id))
                                }
                                sx={{ ...outlineBtnSx, mt: 2, ml: { xs: 0, sm: 1 } }}
                            >
                                Inform Production
                            </Button>
                        </CardContent>
                    </Card>
                )}

                <Card sx={cardSx}>
                    <CardContent sx={{ p: 2.6 }}>
                        <Typography sx={sectionTitleSx}>
                            8. Balance & Remarks
                        </Typography>

                        <Divider sx={{ ...dividerSx, my: 1.5 }} />

                        <Info
                            label="Ordered Qty"
                            value={`${entry.orderedQty ?? "-"} ${entry.unit || ""}`}
                        />
                        <Info
                            label="Received Qty"
                            value={entry.receivedQty ?? "-"}
                        />
                        <Info
                            label="Balance Qty"
                            value={entry.balanceQty ?? "-"}
                        />

                        <TextField
                            fullWidth
                            multiline
                            minRows={3}
                            label="Remarks"
                            value={remarksForm.remarks}
                            onChange={(e) =>
                                setRemarksForm({
                                    remarks: e.target.value,
                                })
                            }
                            sx={{
                                ...fieldSx,
                                mt: 2,
                            }}
                        />

                        <Button
                            variant="outlined"
                            disabled={saving}
                            onClick={() =>
                                run(() => venflowApi.updateRemarks(id, remarksForm))
                            }
                            sx={{ ...outlineBtnSx, mt: 2 }}
                        >
                            Save Remarks
                        </Button>
                    </CardContent>
                </Card>

                {isProduction && (
                    <Card sx={cardSx}>
                        <CardContent sx={{ p: 2.6 }}>
                            <Typography sx={sectionTitleSx}>
                                10. Production Action
                            </Typography>

                            <Divider sx={{ ...dividerSx, my: 1.5 }} />

                            <Info
                                label="Production Status"
                                value={entry.productionStatus || "NOT_STARTED"}
                            />
                            <Info label="Production Started By" value={entry.productionStartedBy} />
                            <Info label="Production Started At" value={entry.productionStartedAt} />
                            <Info label="Job Done By" value={entry.jobDoneBy} />
                            <Info label="Job Done At" value={entry.jobDoneAt} />

                            <Box sx={{ display: "flex", gap: 1.5, mt: 2, flexWrap: "wrap" }}>
                                <Button
                                    variant="contained"
                                    disabled={!isProduction || saving}
                                    onClick={() =>
                                        run(() =>
                                            venflowApi.startProduction(id, {
                                                remarks: remarksForm.remarks,
                                            })
                                        )
                                    }
                                    sx={primaryBtnSx}
                                >
                                    Start Production
                                </Button>

                                <Button
                                    variant="outlined"
                                    disabled={!isProduction || saving}
                                    onClick={() =>
                                        run(() =>
                                            venflowApi.jobDone(id, {
                                                remarks: remarksForm.remarks,
                                            })
                                        )
                                    }
                                    sx={outlineBtnSx}
                                >
                                    Mark Job Done
                                </Button>
                            </Box>
                        </CardContent>
                    </Card>
                )}
            </Box>
        </Box>
    );
}

function Info({ label, value }) {
    return (
        <Box sx={{ mb: 1.2 }}>
            <Typography sx={infoLabelSx}>
                {label}
            </Typography>

            <Typography sx={infoValueSx}>
                {value || "-"}
            </Typography>
        </Box>
    );
}

const rolePanelSx = {
    mb: 2,
    p: 2,
    borderRadius: "20px",
    background: "rgba(59,130,246,.10)",
    border: "1px solid rgba(59,130,246,.22)",
};

const rolePanelTitleSx = {
    color: "#bfdbfe",
    fontWeight: 950,
    fontSize: 14,
};

const rolePanelTextSx = {
    mt: 0.6,
    color: "rgba(255,255,255,.62)",
    fontWeight: 650,
    fontSize: 13,
    lineHeight: 1.7,
};

const gridSx = {
    display: "grid",
    gridTemplateColumns: {
        xs: "1fr",
        lg: "1fr 1fr",
    },
    gap: 2,
};

const formGridSx = {
    display: "grid",
    gridTemplateColumns: {
        xs: "1fr",
        md: "1fr 1fr",
    },
    gap: 1.5,
};