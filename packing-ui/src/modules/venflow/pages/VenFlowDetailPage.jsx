import React, { useEffect, useState } from "react";
import VenFlowTracker from "../components/VenFlowTracker";
import {
    getVenFlowRole,
    isVenFlowAdmin,
    isVenFlowAdminOrManager,
    isVenFlowEngineering,
    isVenFlowStore,
    isVenFlowPurchase,
    isVenFlowProcessing,
    isVenFlowSupervisor,
    canApproveVenFlowPo,
} from "./../../../utils/venflowAccess";
import { useAuth } from "../../../auth/AuthContext";
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

const STAGE = {
    INDENT_CREATED: "INDENT_CREATED",
    SENT_TO_STORE: "SENT_TO_STORE",
    STORE_REVIEWED: "STORE_REVIEWED",
    STOCK_AVAILABLE: "STOCK_AVAILABLE",
    MATERIAL_RESERVED: "MATERIAL_RESERVED",
    PURCHASE_REQUEST_RAISED: "PURCHASE_REQUEST_RAISED",
    PO_RAISED: "PO_RAISED",
    MATERIAL_RECEIVED_AT_STORE: "MATERIAL_RECEIVED_AT_STORE",
    GRN_DONE: "GRN_DONE",
    QC_PENDING: "QC_PENDING",
    QC_OK: "QC_OK",
    MATERIAL_ACCEPTED_IN_STORE: "MATERIAL_ACCEPTED_IN_STORE",
    MATERIAL_REJECTED_HOLD_RETURN: "MATERIAL_REJECTED_HOLD_RETURN",
    PRODUCTION_INFORMED: "PRODUCTION_INFORMED",
    PRODUCTION_DETAILS_ADDED: "PRODUCTION_DETAILS_ADDED",
    MATERIAL_ISSUED_TO_PRODUCTION: "MATERIAL_ISSUED_TO_PRODUCTION",
    PROCESSING_STARTED: "PROCESSING_STARTED",
    PROCESS_COMPLETED: "PROCESS_COMPLETED",
    SUPERVISOR_INFORMED: "SUPERVISOR_INFORMED",
    READY_FOR_NEXT_STAGE: "READY_FOR_NEXT_STAGE",
};

const STOCK_DECISION_OPTIONS = [
    {
        value: "AVAILABLE",
        label: "Available",
    },
    {
        value: "NOT_AVAILABLE",
        label: "Not Available",
    },
    {
        value: "PARTIALLY_AVAILABLE",
        label: "Partially Available",
    },
    {
        value: "PENDING",
        label: "Pending",
    },
    {
        value: "HOLD",
        label: "Hold",
    },
];

const QC_OPTIONS = [
    {
        value: "OK",
        label: "QC OK",
    },
    {
        value: "NOT_OK",
        label: "QC Not OK",
    },
    {
        value: "PENDING",
        label: "QC Pending",
    },
];

const toNumberOrNull = (value) => {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const numberValue = Number(value);

    return Number.isFinite(numberValue)
        ? numberValue
        : null;
};

const requirePositiveNumber = (value, message) => {
    const numberValue = toNumberOrNull(value);

    if (numberValue === null || numberValue <= 0) {
        throw new Error(message);
    }

    return numberValue;
};

const readError = (err, fallback) => {
    const data = err?.response?.data;

    if (typeof data === "string") {
        return data;
    }

    return (
        data?.message ||
        data?.error ||
        err?.message ||
        fallback
    );
};

export default function VenFlowDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const { role: authRole } = useAuth();

    const role = getVenFlowRole(authRole);

    const isAdmin = isVenFlowAdmin(role);
    const isAdminManager = isVenFlowAdminOrManager(role);
    const isEngineering = isVenFlowEngineering(role);
    const isStore = isVenFlowStore(role);
    const isPurchase = isVenFlowPurchase(role);
    const isProcessing = isVenFlowProcessing(role);
    const isSupervisor = isVenFlowSupervisor(role);
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

    const [expectedForm, setExpectedForm] = useState({
        expectedDate: "",
    });

    const [storeReviewForm, setStoreReviewForm] = useState({
        stockDecision: "PENDING",
        availableQty: "",
        remarks: "",
    });

    const [reserveForm, setReserveForm] = useState({
        reservedQty: "",
        remarks: "",
    });

    const [purchaseRequestForm, setPurchaseRequestForm] = useState({
        purchaseRequestNo: "",
        requisitionDate: "",
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

    const [receivedForm, setReceivedForm] = useState({
        receivedQty: "",
        actualInHouseDate: "",
        remarks: "",
    });

    const [grnForm, setGrnForm] = useState({
        grnNo: "",
        grnDate: "",
        remarks: "",
    });

    const [qcForm, setQcForm] = useState({
        qcStatus: "OK",
        qcRemarks: "",
        rejectionReason: "",
    });

    const [productionDetailsForm, setProductionDetailsForm] = useState({
        productionDetails: "",
        supervisorName: "",
        remarks: "",
    });

    const [issueForm, setIssueForm] = useState({
        issuedQty: "",
        issuedTo: "Harender",
        remarks: "",
    });

    const [processingForm, setProcessingForm] = useState({
        usedQty: "",
        wastageQty: "",
        balanceQty: "",
        outputImageUrl: "",
        remarks: "",
    });

    const [remarksForm, setRemarksForm] = useState({
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
                productDescription:
                    row.productDescription ||
                    row.materialName ||
                    "",
                veneerType: row.veneerType || "",
                size: row.size || "",
            });

            setExpectedForm({
                expectedDate: row.expectedDate || "",
            });

            setStoreReviewForm({
                stockDecision: row.stockDecision || "PENDING",
                availableQty: row.availableQty ?? "",
                remarks: row.remarks || "",
            });

            setReserveForm({
                reservedQty:
                    row.reservedQty ??
                    row.availableQty ??
                    row.requiredQty ??
                    "",
                remarks: row.remarks || "",
            });

            setPurchaseRequestForm({
                purchaseRequestNo:
                    row.purchaseRequestNo ||
                    row.requisitionSlipNo ||
                    "",
                requisitionDate: row.requisitionDate || "",
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

            setReceivedForm({
                receivedQty: row.receivedQty ?? "",
                actualInHouseDate: row.actualInHouseDate || "",
                remarks: row.remarks || "",
            });

            setGrnForm({
                grnNo: row.grnNo || "",
                grnDate: row.grnDate || "",
                remarks: row.remarks || "",
            });

            setQcForm({
                qcStatus: row.qcStatus === "NOT_REQUIRED"
                    ? "OK"
                    : row.qcStatus || "OK",
                qcRemarks: row.qcRemarks || "",
                rejectionReason: row.rejectionReason || "",
            });

            setProductionDetailsForm({
                productionDetails: row.productionDetails || "",
                supervisorName: row.supervisorName || "",
                remarks: row.remarks || "",
            });

            setIssueForm({
                issuedQty:
                    row.issuedQty ??
                    row.reservedQty ??
                    row.requiredQty ??
                    "",
                issuedTo: row.issuedTo || "Harender",
                remarks: row.remarks || "",
            });

            setProcessingForm({
                usedQty: row.usedQty ?? "",
                wastageQty: row.wastageQty ?? "",
                balanceQty: row.balanceQty ?? "",
                outputImageUrl: row.outputImageUrl || "",
                remarks: row.remarks || "",
            });

            setRemarksForm({
                remarks: row.remarks || "",
            });
        } catch (err) {
            setEntry(null);
            setError(readError(err, "Unable to load VenFlow entry."));
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
            setError(readError(err, "Update failed."));
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

    const stage = entry.stage;

    const canSendToStore =
        isEngineering &&
        stage === STAGE.INDENT_CREATED;

    const canStoreReview =
        isStore &&
        [
            STAGE.SENT_TO_STORE,
            STAGE.STORE_REVIEWED,
            STAGE.STOCK_AVAILABLE,
        ].includes(stage);

    const canReserveMaterial =
        isStore &&
        [
            STAGE.STOCK_AVAILABLE,
            STAGE.MATERIAL_ACCEPTED_IN_STORE,
        ].includes(stage);

    const canRaisePurchaseRequest =
        isStore &&
        [
            STAGE.STORE_REVIEWED,
            STAGE.STOCK_AVAILABLE,
        ].includes(stage) &&
        [
            "NOT_AVAILABLE",
            "PARTIALLY_AVAILABLE",
            "HOLD",
        ].includes(entry.stockDecision);

    const canRaisePo =
        isPurchase &&
        [
            STAGE.PURCHASE_REQUEST_RAISED,
            STAGE.PO_RAISED,
        ].includes(stage);

    const canReceiveMaterial =
        isStore &&
        stage === STAGE.PO_RAISED;

    const canGrn =
        isStore &&
        stage === STAGE.MATERIAL_RECEIVED_AT_STORE;

    const canQc =
        isStore &&
        [
            STAGE.GRN_DONE,
            STAGE.QC_PENDING,
        ].includes(stage);

    const canAcceptInventory =
        isStore &&
        stage === STAGE.QC_OK;

    const canInformProduction =
        isStore &&
        [
            STAGE.MATERIAL_RESERVED,
            STAGE.MATERIAL_ACCEPTED_IN_STORE,
        ].includes(stage);

    const canAddProductionDetails =
        isProcessing &&
        [
            STAGE.PRODUCTION_INFORMED,
            STAGE.MATERIAL_RESERVED,
        ].includes(stage);

    const canIssueMaterial =
        isStore &&
        [
            STAGE.PRODUCTION_INFORMED,
            STAGE.PRODUCTION_DETAILS_ADDED,
            STAGE.MATERIAL_RESERVED,
        ].includes(stage);

    const canStartProcessing =
        isProcessing &&
        stage === STAGE.MATERIAL_ISSUED_TO_PRODUCTION;

    const canCompleteProcessing =
        isProcessing &&
        stage === STAGE.PROCESSING_STARTED;

    const canInformSupervisor =
        isProcessing &&
        stage === STAGE.PROCESS_COMPLETED;

    const canReadyNextStage =
        isSupervisor &&
        stage === STAGE.SUPERVISOR_INFORMED;

    return (
        <Box>
            <Box sx={pageHeaderSx}>
                <Box>
                    <Typography sx={pageTitleSx}>
                        {entry.pdNo} — {entry.clientName}
                    </Typography>

                    <Box sx={chipsRowSx}>
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

            <VenFlowTracker stage={entry.stage} entry={entry} />

            <Box sx={rolePanelSx}>
                <Typography sx={rolePanelTitleSx}>
                    Current Action
                </Typography>

                <Typography sx={rolePanelTextSx}>
                    Current stage is <b>{entry.stage}</b>. Use the enabled action button below
                    to move this item to the next department.
                </Typography>
            </Box>

            {entry.stage === "INDENT_CREATED" && isEngineering && (
                <Card sx={{ ...cardSx, mb: 2 }}>
                    <CardContent sx={{ p: 2.4 }}>
                        <Typography sx={sectionTitleSx}>
                            Next Step Required
                        </Typography>

                        <Divider sx={{ ...dividerSx, my: 1.5 }} />

                        <Typography sx={quickActionTextSx}>
                            This BOM / Indent has been created successfully. Send it to AKG Store
                            so Store can review veneer availability and continue the workflow.
                        </Typography>

                        <Button
                            variant="contained"
                            disabled={saving}
                            onClick={() =>
                                run(() => venflowApi.sendToStore(id))
                            }
                            sx={{ ...primaryBtnSx, mt: 2 }}
                        >
                            Send to AKG Store
                        </Button>
                    </CardContent>
                </Card>
            )}

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

                        <Info label="Plant" value={entry.plantCode} />
                        <Info label="Order Date" value={entry.orderDate} />
                        <Info label="PD No." value={entry.pdNo} />
                        <Info label="Drawing No." value={entry.drawingNo} />
                        <Info label="Client Name" value={entry.clientName} />
                        <Info label="Material Name" value={entry.materialName} />
                        <Info label="Required Qty" value={`${entry.requiredQty ?? "-"} ${entry.unit || ""}`} />
                        <Info label="BOM Reference" value={entry.bomReference} />
                        <Info label="Raised By" value={entry.raisedBy} />
                        <Info label="Raised At" value={entry.raisedAt} />
                    </CardContent>
                </Card>

                {isEngineering && (
                    <Card sx={cardSx}>
                        <CardContent sx={{ p: 2.6 }}>
                            <Typography sx={sectionTitleSx}>
                                2. Engineering / BOM Control
                            </Typography>

                            <Divider sx={{ ...dividerSx, my: 1.5 }} />

                            <Box sx={formGridSx}>
                                <TextField
                                    label="Product / Material Description"
                                    value={productForm.productDescription}
                                    onChange={(e) =>
                                        setProductForm((p) => ({
                                            ...p,
                                            productDescription: e.target.value,
                                        }))
                                    }
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
                                    sx={fieldSx}
                                />

                                <TextField
                                    label="Expected Date"
                                    type="date"
                                    InputLabelProps={{ shrink: true }}
                                    value={expectedForm.expectedDate}
                                    onChange={(e) =>
                                        setExpectedForm({
                                            expectedDate: e.target.value,
                                        })
                                    }
                                    sx={fieldSx}
                                />
                            </Box>

                            <Box sx={actionRowSx}>
                                <Button
                                    variant="contained"
                                    disabled={saving}
                                    onClick={() =>
                                        run(() =>
                                            venflowApi.updateProductDetails(id, productForm)
                                        )
                                    }
                                    sx={primaryBtnSx}
                                >
                                    Save Product Details
                                </Button>

                                <Button
                                    variant="outlined"
                                    disabled={saving || !expectedForm.expectedDate}
                                    onClick={() =>
                                        run(() =>
                                            venflowApi.updateExpectedDate(id, expectedForm)
                                        )
                                    }
                                    sx={outlineBtnSx}
                                >
                                    Save Expected Date
                                </Button>

                                <Button
                                    variant="contained"
                                    disabled={saving || !canSendToStore}
                                    onClick={() =>
                                        run(() => venflowApi.sendToStore(id))
                                    }
                                    sx={primaryBtnSx}
                                >
                                    Send to AKG Store
                                </Button>
                            </Box>

                            <Typography sx={hintSx}>
                                “Send to AKG Store” is enabled only when the stage is BOM / Indent Created.
                            </Typography>
                        </CardContent>
                    </Card>
                )}

                {isStore && (
                    <Card sx={cardSx}>
                        <CardContent sx={{ p: 2.6 }}>
                            <Typography sx={sectionTitleSx}>
                                3. AKG Store Review
                            </Typography>

                            <Divider sx={{ ...dividerSx, my: 1.5 }} />

                            <Box sx={formGridSx}>
                                <TextField
                                    select
                                    label="Stock Decision"
                                    value={storeReviewForm.stockDecision}
                                    onChange={(e) =>
                                        setStoreReviewForm((p) => ({
                                            ...p,
                                            stockDecision: e.target.value,
                                        }))
                                    }
                                    sx={fieldSx}
                                    SelectProps={{ MenuProps: darkMenuProps }}
                                >
                                    {STOCK_DECISION_OPTIONS.map((item) => (
                                        <MenuItem key={item.value} value={item.value}>
                                            {item.label}
                                        </MenuItem>
                                    ))}
                                </TextField>

                                <TextField
                                    label="Available Qty"
                                    type="number"
                                    value={storeReviewForm.availableQty}
                                    onChange={(e) =>
                                        setStoreReviewForm((p) => ({
                                            ...p,
                                            availableQty: e.target.value,
                                        }))
                                    }
                                    sx={fieldSx}
                                />
                            </Box>

                            <TextField
                                fullWidth
                                multiline
                                minRows={2}
                                label="Store Remarks"
                                value={storeReviewForm.remarks}
                                onChange={(e) =>
                                    setStoreReviewForm((p) => ({
                                        ...p,
                                        remarks: e.target.value,
                                    }))
                                }
                                sx={{ ...fieldSx, mt: 2 }}
                            />

                            <Button
                                variant="contained"
                                disabled={saving || !canStoreReview}
                                onClick={() =>
                                    run(() =>
                                        venflowApi.storeReview(id, {
                                            stockDecision: storeReviewForm.stockDecision,
                                            availableQty: toNumberOrNull(storeReviewForm.availableQty),
                                            remarks: storeReviewForm.remarks.trim(),
                                        })
                                    )
                                }
                                sx={{ ...primaryBtnSx, mt: 2 }}
                            >
                                Save Store Review
                            </Button>

                            <Typography sx={hintSx}>
                                Store Review starts after Engineering sends the indent to AKG Store.
                            </Typography>
                        </CardContent>
                    </Card>
                )}

                {isStore && (
                    <Card sx={cardSx}>
                        <CardContent sx={{ p: 2.6 }}>
                            <Typography sx={sectionTitleSx}>
                                4. Store Decision Action
                            </Typography>

                            <Divider sx={{ ...dividerSx, my: 1.5 }} />

                            <Box sx={formGridSx}>
                                <TextField
                                    label="Reserved Qty"
                                    type="number"
                                    value={reserveForm.reservedQty}
                                    onChange={(e) =>
                                        setReserveForm((p) => ({
                                            ...p,
                                            reservedQty: e.target.value,
                                        }))
                                    }
                                    sx={fieldSx}
                                />

                                <TextField
                                    label="Purchase Request No."
                                    value={purchaseRequestForm.purchaseRequestNo}
                                    onChange={(e) =>
                                        setPurchaseRequestForm((p) => ({
                                            ...p,
                                            purchaseRequestNo: e.target.value,
                                        }))
                                    }
                                    sx={fieldSx}
                                />

                                <TextField
                                    label="Requisition Date"
                                    type="date"
                                    InputLabelProps={{ shrink: true }}
                                    value={purchaseRequestForm.requisitionDate}
                                    onChange={(e) =>
                                        setPurchaseRequestForm((p) => ({
                                            ...p,
                                            requisitionDate: e.target.value,
                                        }))
                                    }
                                    sx={fieldSx}
                                />
                            </Box>

                            <Box sx={actionRowSx}>
                                <Button
                                    variant="contained"
                                    disabled={saving || !canReserveMaterial}
                                    onClick={() =>
                                        run(() =>
                                            venflowApi.reserveMaterial(id, {
                                                reservedQty: requirePositiveNumber(
                                                    reserveForm.reservedQty,
                                                    "Reserved Qty must be greater than zero."
                                                ),
                                                remarks: reserveForm.remarks.trim(),
                                            })
                                        )
                                    }
                                    sx={primaryBtnSx}
                                >
                                    Reserve Material
                                </Button>

                                <Button
                                    variant="outlined"
                                    disabled={saving || !canRaisePurchaseRequest}
                                    onClick={() =>
                                        run(() => {
                                            if (!purchaseRequestForm.purchaseRequestNo.trim()) {
                                                throw new Error("Purchase Request No. is required.");
                                            }

                                            return venflowApi.raisePurchaseRequest(id, {
                                                purchaseRequestNo:
                                                    purchaseRequestForm.purchaseRequestNo.trim(),
                                                requisitionDate:
                                                    purchaseRequestForm.requisitionDate || null,
                                                remarks:
                                                    purchaseRequestForm.remarks.trim(),
                                            });
                                        })
                                    }
                                    sx={outlineBtnSx}
                                >
                                    Raise Purchase Request
                                </Button>
                            </Box>

                            <Typography sx={hintSx}>
                                If stock is available, reserve it. If stock is not available / partial / hold,
                                raise Purchase Request.
                            </Typography>
                        </CardContent>
                    </Card>
                )}

                {(isPurchase || isAdminManager) && (
                    <Card sx={cardSx}>
                        <CardContent sx={{ p: 2.6 }}>
                            <Typography sx={sectionTitleSx}>
                                5. Purchase / PO
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
                                <Info label="Purchase Request No." value={entry.purchaseRequestNo} />
                                <Info label="PO Raised By" value={entry.poRaisedBy} />
                                <Info label="PO Raised At" value={entry.poRaisedAt} />
                                <Info label="PO Approved By" value={entry.poApprovedBy} />
                                <Info label="PO Approved At" value={entry.poApprovedAt} />
                            </Box>

                            <Box sx={actionRowSx}>
                                <Button
                                    variant="contained"
                                    disabled={saving || !canRaisePo}
                                    onClick={() =>
                                        run(() => {
                                            if (!poForm.vendorName.trim()) {
                                                throw new Error("Vendor Name is required.");
                                            }

                                            if (!poForm.poNo.trim()) {
                                                throw new Error("PO No. is required.");
                                            }

                                            if (!poForm.poDate) {
                                                throw new Error("PO Date is required.");
                                            }

                                            return venflowApi.raisePo(id, {
                                                vendorName: poForm.vendorName.trim(),
                                                poNo: poForm.poNo.trim(),
                                                poDate: poForm.poDate,
                                                poAmount: toNumberOrNull(poForm.poAmount),
                                                poDocumentUrl: poForm.poDocumentUrl.trim(),
                                                remarks: poForm.remarks.trim(),
                                            });
                                        })
                                    }
                                    sx={primaryBtnSx}
                                >
                                    Raise PO
                                </Button>

                                <Button
                                    variant="outlined"
                                    disabled={saving || !canApprovePo || entry.poStatus !== "RAISED"}
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

                {isStore && (
                    <Card sx={cardSx}>
                        <CardContent sx={{ p: 2.6 }}>
                            <Typography sx={sectionTitleSx}>
                                6. Store Receiving / GRN / QC / Inventory
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
                                    sx={fieldSx}
                                />

                                <TextField
                                    label="GRN No."
                                    value={grnForm.grnNo}
                                    onChange={(e) =>
                                        setGrnForm((p) => ({
                                            ...p,
                                            grnNo: e.target.value,
                                        }))
                                    }
                                    sx={fieldSx}
                                />

                                <TextField
                                    label="GRN Date"
                                    type="date"
                                    InputLabelProps={{ shrink: true }}
                                    value={grnForm.grnDate}
                                    onChange={(e) =>
                                        setGrnForm((p) => ({
                                            ...p,
                                            grnDate: e.target.value,
                                        }))
                                    }
                                    sx={fieldSx}
                                />

                                <TextField
                                    select
                                    label="QC Status"
                                    value={qcForm.qcStatus}
                                    onChange={(e) =>
                                        setQcForm((p) => ({
                                            ...p,
                                            qcStatus: e.target.value,
                                        }))
                                    }
                                    sx={fieldSx}
                                    SelectProps={{ MenuProps: darkMenuProps }}
                                >
                                    {QC_OPTIONS.map((item) => (
                                        <MenuItem key={item.value} value={item.value}>
                                            {item.label}
                                        </MenuItem>
                                    ))}
                                </TextField>

                                <TextField
                                    label="QC Remarks"
                                    value={qcForm.qcRemarks}
                                    onChange={(e) =>
                                        setQcForm((p) => ({
                                            ...p,
                                            qcRemarks: e.target.value,
                                        }))
                                    }
                                    sx={fieldSx}
                                />
                            </Box>

                            <TextField
                                fullWidth
                                label="Rejection / Hold Reason"
                                value={qcForm.rejectionReason}
                                onChange={(e) =>
                                    setQcForm((p) => ({
                                        ...p,
                                        rejectionReason: e.target.value,
                                    }))
                                }
                                sx={{ ...fieldSx, mt: 2 }}
                            />

                            <Box sx={actionRowSx}>
                                <Button
                                    variant="contained"
                                    disabled={saving || !canReceiveMaterial}
                                    onClick={() =>
                                        run(() =>
                                            venflowApi.materialReceived(id, {
                                                receivedQty: requirePositiveNumber(
                                                    receivedForm.receivedQty,
                                                    "Received Qty must be greater than zero."
                                                ),
                                                actualInHouseDate:
                                                    receivedForm.actualInHouseDate || null,
                                                remarks: receivedForm.remarks.trim(),
                                            })
                                        )
                                    }
                                    sx={primaryBtnSx}
                                >
                                    Save Receiving
                                </Button>

                                <Button
                                    variant="outlined"
                                    disabled={saving || !canGrn}
                                    onClick={() =>
                                        run(() => {
                                            if (!grnForm.grnNo.trim()) {
                                                throw new Error("GRN No. is required.");
                                            }

                                            if (!grnForm.grnDate) {
                                                throw new Error("GRN Date is required.");
                                            }

                                            return venflowApi.grnEntry(id, {
                                                grnNo: grnForm.grnNo.trim(),
                                                grnDate: grnForm.grnDate,
                                                remarks: grnForm.remarks.trim(),
                                            });
                                        })
                                    }
                                    sx={outlineBtnSx}
                                >
                                    Save GRN
                                </Button>

                                <Button
                                    variant="outlined"
                                    disabled={saving || !canQc}
                                    onClick={() =>
                                        run(() =>
                                            venflowApi.qualityCheck(id, {
                                                qcStatus: qcForm.qcStatus,
                                                qcRemarks: qcForm.qcRemarks.trim(),
                                                rejectionReason: qcForm.rejectionReason.trim(),
                                            })
                                        )
                                    }
                                    sx={outlineBtnSx}
                                >
                                    Save QC
                                </Button>

                                <Button
                                    variant="contained"
                                    disabled={saving || !canAcceptInventory}
                                    onClick={() =>
                                        run(() => venflowApi.acceptInventory(id))
                                    }
                                    sx={primaryBtnSx}
                                >
                                    Accept Inventory
                                </Button>

                                <Button
                                    variant="contained"
                                    disabled={saving || !canInformProduction}
                                    onClick={() =>
                                        run(() => venflowApi.informProduction(id))
                                    }
                                    sx={primaryBtnSx}
                                >
                                    Inform Production
                                </Button>
                            </Box>
                        </CardContent>
                    </Card>
                )}

                {isStore && (
                    <Card sx={cardSx}>
                        <CardContent sx={{ p: 2.6 }}>
                            <Typography sx={sectionTitleSx}>
                                7. Issue Material to Production
                            </Typography>

                            <Divider sx={{ ...dividerSx, my: 1.5 }} />

                            <Box sx={formGridSx}>
                                <TextField
                                    label="Issued Qty"
                                    type="number"
                                    value={issueForm.issuedQty}
                                    onChange={(e) =>
                                        setIssueForm((p) => ({
                                            ...p,
                                            issuedQty: e.target.value,
                                        }))
                                    }
                                    sx={fieldSx}
                                />

                                <TextField
                                    label="Issued To"
                                    value={issueForm.issuedTo}
                                    onChange={(e) =>
                                        setIssueForm((p) => ({
                                            ...p,
                                            issuedTo: e.target.value,
                                        }))
                                    }
                                    sx={fieldSx}
                                />
                            </Box>

                            <Button
                                variant="contained"
                                disabled={saving || !canIssueMaterial}
                                onClick={() =>
                                    run(() => {
                                        if (!issueForm.issuedTo.trim()) {
                                            throw new Error("Issued To is required.");
                                        }

                                        return venflowApi.issueMaterial(id, {
                                            issuedQty: requirePositiveNumber(
                                                issueForm.issuedQty,
                                                "Issued Qty must be greater than zero."
                                            ),
                                            issuedTo: issueForm.issuedTo.trim(),
                                            remarks: issueForm.remarks.trim(),
                                        });
                                    })
                                }
                                sx={{ ...primaryBtnSx, mt: 2 }}
                            >
                                Issue Material
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {isProcessing && (
                    <Card sx={cardSx}>
                        <CardContent sx={{ p: 2.6 }}>
                            <Typography sx={sectionTitleSx}>
                                8. Processing / Production
                            </Typography>

                            <Divider sx={{ ...dividerSx, my: 1.5 }} />

                            <Box sx={formGridSx}>
                                <TextField
                                    label="Production Details"
                                    value={productionDetailsForm.productionDetails}
                                    onChange={(e) =>
                                        setProductionDetailsForm((p) => ({
                                            ...p,
                                            productionDetails: e.target.value,
                                        }))
                                    }
                                    sx={fieldSx}
                                />

                                <TextField
                                    label="Supervisor Name"
                                    value={productionDetailsForm.supervisorName}
                                    onChange={(e) =>
                                        setProductionDetailsForm((p) => ({
                                            ...p,
                                            supervisorName: e.target.value,
                                        }))
                                    }
                                    sx={fieldSx}
                                />

                                <TextField
                                    label="Used Qty"
                                    type="number"
                                    value={processingForm.usedQty}
                                    onChange={(e) =>
                                        setProcessingForm((p) => ({
                                            ...p,
                                            usedQty: e.target.value,
                                        }))
                                    }
                                    sx={fieldSx}
                                />

                                <TextField
                                    label="Wastage Qty"
                                    type="number"
                                    value={processingForm.wastageQty}
                                    onChange={(e) =>
                                        setProcessingForm((p) => ({
                                            ...p,
                                            wastageQty: e.target.value,
                                        }))
                                    }
                                    sx={fieldSx}
                                />

                                <TextField
                                    label="Balance Qty"
                                    type="number"
                                    value={processingForm.balanceQty}
                                    onChange={(e) =>
                                        setProcessingForm((p) => ({
                                            ...p,
                                            balanceQty: e.target.value,
                                        }))
                                    }
                                    sx={fieldSx}
                                />

                                <TextField
                                    label="Output Image URL"
                                    value={processingForm.outputImageUrl}
                                    onChange={(e) =>
                                        setProcessingForm((p) => ({
                                            ...p,
                                            outputImageUrl: e.target.value,
                                        }))
                                    }
                                    sx={fieldSx}
                                />
                            </Box>

                            <Box sx={actionRowSx}>
                                <Button
                                    variant="contained"
                                    disabled={saving || !canAddProductionDetails}
                                    onClick={() =>
                                        run(() => {
                                            if (!productionDetailsForm.productionDetails.trim()) {
                                                throw new Error("Production details are required.");
                                            }

                                            return venflowApi.productionDetails(id, {
                                                productionDetails:
                                                    productionDetailsForm.productionDetails.trim(),
                                                supervisorName:
                                                    productionDetailsForm.supervisorName.trim(),
                                                remarks:
                                                    productionDetailsForm.remarks.trim(),
                                            });
                                        })
                                    }
                                    sx={primaryBtnSx}
                                >
                                    Save Production Details
                                </Button>

                                <Button
                                    variant="outlined"
                                    disabled={saving || !canStartProcessing}
                                    onClick={() =>
                                        run(() => venflowApi.startProcessing(id))
                                    }
                                    sx={outlineBtnSx}
                                >
                                    Start Processing
                                </Button>

                                <Button
                                    variant="contained"
                                    disabled={saving || !canCompleteProcessing}
                                    onClick={() =>
                                        run(() =>
                                            venflowApi.completeProcess(id, {
                                                usedQty: toNumberOrNull(processingForm.usedQty),
                                                wastageQty: toNumberOrNull(processingForm.wastageQty),
                                                balanceQty: toNumberOrNull(processingForm.balanceQty),
                                                outputImageUrl: processingForm.outputImageUrl.trim(),
                                                remarks: processingForm.remarks.trim(),
                                            })
                                        )
                                    }
                                    sx={primaryBtnSx}
                                >
                                    Complete Process
                                </Button>

                                <Button
                                    variant="outlined"
                                    disabled={saving || !canInformSupervisor}
                                    onClick={() =>
                                        run(() => venflowApi.supervisorInformed(id))
                                    }
                                    sx={outlineBtnSx}
                                >
                                    Inform Supervisor
                                </Button>
                            </Box>
                        </CardContent>
                    </Card>
                )}

                {isSupervisor && (
                    <Card sx={cardSx}>
                        <CardContent sx={{ p: 2.6 }}>
                            <Typography sx={sectionTitleSx}>
                                9. Supervisor Closure
                            </Typography>

                            <Divider sx={{ ...dividerSx, my: 1.5 }} />

                            <Info label="Supervisor Name" value={entry.supervisorName} />
                            <Info label="Supervisor Informed By" value={entry.supervisorInformedBy} />
                            <Info label="Supervisor Informed At" value={entry.supervisorInformedAt} />

                            <Button
                                variant="contained"
                                disabled={saving || !canReadyNextStage}
                                onClick={() =>
                                    run(() => venflowApi.readyForNextStage(id))
                                }
                                sx={{ ...primaryBtnSx, mt: 2 }}
                            >
                                Mark Ready for Next Stage
                            </Button>
                        </CardContent>
                    </Card>
                )}

                <Card sx={cardSx}>
                    <CardContent sx={{ p: 2.6 }}>
                        <Typography sx={sectionTitleSx}>
                            10. Balance & Remarks
                        </Typography>

                        <Divider sx={{ ...dividerSx, my: 1.5 }} />

                        <Info label="Required Qty" value={`${entry.requiredQty ?? "-"} ${entry.unit || ""}`} />
                        <Info label="Ordered Qty" value={`${entry.orderedQty ?? "-"} ${entry.unit || ""}`} />
                        <Info label="Received Qty" value={entry.receivedQty ?? "-"} />
                        <Info label="Reserved Qty" value={entry.reservedQty ?? "-"} />
                        <Info label="Issued Qty" value={entry.issuedQty ?? "-"} />
                        <Info label="Balance Qty" value={entry.balanceQty ?? "-"} />

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

const chipsRowSx = {
    display: "flex",
    gap: 1,
    mt: 1,
    flexWrap: "wrap",
};

const quickActionTextSx = {
    color: "rgba(255,255,255,.68)",
    fontWeight: 650,
    fontSize: 13,
    lineHeight: 1.7,
};

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

const actionRowSx = {
    display: "flex",
    gap: 1.5,
    mt: 2,
    flexWrap: "wrap",
};

const hintSx = {
    mt: 1.2,
    color: "rgba(255,255,255,.48)",
    fontWeight: 650,
    fontSize: 12,
    lineHeight: 1.6,
};