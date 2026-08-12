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
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import { MATFLOW_ROLES, useMatFlow } from "../matflowUi";
import { matflowApi, readMatFlowError } from "../api/matflowApi";
import { downloadMatFlowExcel } from ".../api/matflowExcel";
import {
    EmptyState,
    ErrorBox,
    LoadingBlock,
    MatFlowDeleteDialog,
    MatFlowPagination,
    MatFlowStatusChip,
    PageHero,
    SummaryCard,
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

const indentDeliveryLocationId = (indent) =>
    indent?.deliveryLocationId ??
    indent?.deliverToLocationId ??
    indent?.deliverToLocation?.id ??
    null;

const indentDeliveryLocationCode = (indent) =>
    indent?.deliveryLocationCode ??
    indent?.deliverToLocationCode ??
    indent?.deliverToLocation?.locationCode ??
    "";

const indentDeliveryPlantCode = (indent) =>
    indent?.deliveryPlantCode ??
    indent?.deliverToPlantCode ??
    indent?.deliverToLocation?.plantCode ??
    "";

const normalizePurchaseIndent = (indent, requisition) => ({
    ...indent,

    /*
     * Current MatFlowPlanningDtos.IndentResponse exposes:
     *   deliverToLocationId
     *   deliverToLocationCode
     *   deliverToPlantCode
     *
     * Older Purchase UI code expected deliveryLocationId / Code / PlantCode.
     * Normalize both contracts here once so every Purchase action uses the
     * Store-owned delivery destination without weakening backend validation.
     */
    deliveryLocationId: indentDeliveryLocationId(indent),
    deliveryLocationCode: indentDeliveryLocationCode(indent),
    deliveryPlantCode: indentDeliveryPlantCode(indent),
    requisition,
});

const openIndentLines = (indent) =>
    (Array.isArray(indent?.lines) ? indent.lines : [])
        .map((line) => ({
            ...line,
            outstanding: Math.max(
                0,
                numeric(line.requiredQty) - numeric(line.orderedQty)
            ),
        }))
        .filter((line) => line.outstanding > 0);

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
        (snapshot.indents || []).forEach((rawIndent) => {
            if (
                [
                    "SUBMITTED_TO_PURCHASE",
                    "PURCHASE_IN_PROGRESS",
                    "PO_CREATED",
                    "PARTIALLY_RECEIVED",
                ].includes(normalize(rawIndent.status))
            ) {
                const indent = normalizePurchaseIndent(
                    rawIndent,
                    snapshot.requisition
                );

                map.set(String(indent.id), indent);
            }
        });
    });

    return Array.from(map.values());
}

export function MatFlowPurchasePage() {
    const { hasRole, selectedPlantParam } = useMatFlow();
    const canPurchase = hasRole(PURCHASE_ROLES);

    const [orders, setOrders] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [indents, setIndents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [poError, setPoError] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [vendorSearch, setVendorSearch] = useState("");
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
            setOrders([]);
            setVendors([]);
            setIndents([]);
            setError(
                readMatFlowError(
                    requestError,
                    "Unable to load the Purchase procurement workspace."
                )
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const selectedIndent = useMemo(
        () =>
            indents.find(
                (indent) => String(indent.id) === String(poForm.indentId)
            ) || null,
        [indents, poForm.indentId]
    );

    const poLines = useMemo(
        () => openIndentLines(selectedIndent),
        [selectedIndent]
    );

    useEffect(() => {
        if (!selectedIndent) {
            setPoForm((current) => ({ ...current, quantities: {} }));
            return;
        }

        const quantities = {};
        poLines.forEach((line) => {
            quantities[String(line.id)] = String(line.outstanding);
        });

        setPoForm((current) => ({
            ...current,
            quantities,
        }));
    }, [selectedIndent?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const selectedPlant = upperCode(selectedPlantParam);

    const scopedOrders = useMemo(
        () =>
            orders.filter((order) => {
                if (!selectedPlant) return true;

                return upperCode(
                    order.deliveryPlantCode ||
                    order.plantCode ||
                    order.indentPlantCode
                ) === selectedPlant;
            }),
        [orders, selectedPlant]
    );

    const scopedIndents = useMemo(
        () =>
            indents.filter((indent) => {
                if (!selectedPlant) return true;

                return upperCode(
                    indentDeliveryPlantCode(indent) ||
                    indent?.requisition?.destinationPlantCode
                ) === selectedPlant;
            }),
        [indents, selectedPlant]
    );

    const purchaseReadyIndents = useMemo(
        () => scopedIndents.filter((indent) => openIndentLines(indent).length > 0),
        [scopedIndents]
    );

    const statusOptions = useMemo(
        () => [
            "ALL",
            ...Array.from(
                new Set(
                    scopedOrders
                        .map((order) => normalize(order.status))
                        .filter(Boolean)
                )
            ),
        ],
        [scopedOrders]
    );

    const filteredOrders = useMemo(() => {
        const query = clean(search).toLowerCase();

        return scopedOrders.filter((order) => {
            if (
                statusFilter !== "ALL" &&
                normalize(order.status) !== normalize(statusFilter)
            ) {
                return false;
            }

            if (!query) return true;

            return [
                order.poNumber,
                order.vendorName,
                order.vendorCode,
                order.indentNumber,
                order.deliveryLocationCode,
                order.deliveryPlantCode,
                order.projectCode,
                order.drawingNo,
                order.productName,
                order.status,
            ].some((value) =>
                String(value ?? "").toLowerCase().includes(query)
            );
        });
    }, [scopedOrders, search, statusFilter]);

    const filteredVendors = useMemo(() => {
        const query = clean(vendorSearch).toLowerCase();
        if (!query) return vendors;

        return vendors.filter((vendor) =>
            [
                vendor.vendorCode,
                vendor.vendorName,
                vendor.gstin,
                vendor.contactPerson,
                vendor.phone,
                vendor.email,
            ].some((value) =>
                String(value ?? "").toLowerCase().includes(query)
            )
        );
    }, [vendors, vendorSearch]);

    const orderPagination = useMatFlowPagination(filteredOrders, 15);
    const indentPagination = useMatFlowPagination(purchaseReadyIndents, 8);
    const vendorPagination = useMatFlowPagination(filteredVendors, 10);

    const counts = useMemo(() => {
        const statusCount = (statuses) =>
            scopedOrders.filter((order) =>
                statuses.includes(normalize(order.status))
            ).length;

        return {
            openIndents: purchaseReadyIndents.length,
            openIndentLines: purchaseReadyIndents.reduce(
                (total, indent) => total + openIndentLines(indent).length,
                0
            ),
            draft: statusCount(["DRAFT"]),
            placed: statusCount(["PLACED"]),
            partial: statusCount(["PARTIALLY_RECEIVED"]),
            received: statusCount(["RECEIVED", "COMPLETED", "CLOSED"]),
            vendors: vendors.filter((vendor) => vendor.active !== false).length,
            missingDestination: purchaseReadyIndents.filter(
                (indent) => !indentDeliveryLocationId(indent)
            ).length,
        };
    }, [scopedOrders, purchaseReadyIndents, vendors]);

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

    const openPo = (indent = null) => {
        const quantities = {};
        openIndentLines(indent).forEach((line) => {
            quantities[String(line.id)] = String(line.outstanding);
        });

        setPoError("");
        setError("");
        setPoForm({
            indentId: indent?.id ? String(indent.id) : "",
            vendorId: "",
            poNumber: "",
            poDate: new Date().toISOString().slice(0, 10),
            remarks: "",
            quantities,
        });
        setPoDialog(true);
    };

    const closePo = () => {
        if (working) return;
        setPoDialog(false);
        setPoError("");
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
        const requestLines = poLines
            .map((line) => ({
                indentLineId: line.id,
                orderedQty: Number(
                    poForm.quantities[String(line.id)] || 0
                ),
                remarks: null,
            }))
            .filter(
                (line) =>
                    Number.isFinite(line.orderedQty) &&
                    line.orderedQty > 0
            );

        const deliveryLocationId =
            indentDeliveryLocationId(selectedIndent);

        if (!selectedIndent?.id) {
            setPoError("Select a Store-confirmed shortage Indent.");
            return;
        }

        if (!poForm.vendorId) {
            setPoError("Select an active Vendor.");
            return;
        }

        if (!deliveryLocationId) {
            setPoError(
                "The selected Indent has no Store-defined delivery location ID. Refresh the Purchase desk and verify the Store shortage Indent. A PO cannot be created without the exact Indent delivery destination."
            );
            return;
        }

        if (!clean(poForm.poNumber) || !poForm.poDate) {
            setPoError("PO number and PO date are required.");
            return;
        }

        if (!requestLines.length) {
            setPoError(
                "Enter an Order Qty greater than zero for at least one shortage material."
            );
            return;
        }

        for (const requestLine of requestLines) {
            const source = poLines.find(
                (item) =>
                    String(item.id) ===
                    String(requestLine.indentLineId)
            );

            if (
                requestLine.orderedQty >
                numeric(source?.outstanding) + 0.0005
            ) {
                setPoError(
                    `Order quantity exceeds the remaining shortage for ${source?.materialCode || "the selected material"
                    }.`
                );
                return;
            }
        }

        setWorking(true);
        setPoError("");

        try {
            await matflowApi.createPurchaseOrder({
                poNumber: upperCode(poForm.poNumber),
                poDate: poForm.poDate,
                vendorId: poForm.vendorId,
                indentId: selectedIndent.id,

                /*
                 * Delivery is not a free PO choice. Store already fixed it on
                 * the shortage Indent and the backend verifies exact equality.
                 */
                deliveryLocationId,

                remarks: clean(poForm.remarks) || null,
                lines: requestLines,
            });

            setPoDialog(false);
            setPoForm({
                indentId: "",
                vendorId: "",
                poNumber: "",
                poDate: new Date().toISOString().slice(0, 10),
                remarks: "",
                quantities: {},
            });

            await load();
        } catch (requestError) {
            setPoError(
                readMatFlowError(
                    requestError,
                    "Unable to create the Draft Purchase Order."
                )
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
                readMatFlowError(
                    requestError,
                    "Unable to delete the Draft purchase order."
                )
            );
        } finally {
            setWorking(false);
        }
    };

    const selectedIndentLocationCode =
        indentDeliveryLocationCode(selectedIndent);
    const selectedIndentPlantCode =
        indentDeliveryPlantCode(selectedIndent);

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="PURCHASE PROCUREMENT CONTROL"
                title="Shortage Procurement & Purchase Orders"
                subtitle="Convert Store-confirmed material shortages into controlled Purchase Orders. Every PO remains tied to the exact Indent, Vendor and Store-defined delivery destination before independent approval and GRN receipt."
                actions={
                    <>
                        <Button startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMatFlowExcel({ fileName: "MatFlow_Purchase_Orders", sheetName: "Purchase Orders", title: "MatFlow Purchase Orders", rows: orders })} sx={secondaryBtnSx}>Export Excel</Button>
                        <Button
                            startIcon={<RefreshIcon />}
                            onClick={load}
                            sx={secondaryBtnSx}
                        >
                            Refresh
                        </Button>

                        {canPurchase && (
                            <Button
                                startIcon={<AddIcon />}
                                onClick={() => openVendor(null)}
                                sx={secondaryBtnSx}
                            >
                                Add Vendor
                            </Button>
                        )}

                        {canPurchase && (
                            <Button
                                startIcon={<AddIcon />}
                                onClick={() => openPo()}
                                sx={primaryBtnSx}
                            >
                                Create PO
                            </Button>
                        )}
                    </>
                }
            />

            <ErrorBox>{error}</ErrorBox>

            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns:
                        "repeat(auto-fit,minmax(145px,1fr))",
                    gap: 1,
                }}
            >
                <SummaryCard
                    label="Open Shortage Indents"
                    tone="red"
                    value={counts.openIndents}
                    colorful
                />
                <SummaryCard
                    label="Open Material Lines"
                    tone="orange"
                    value={counts.openIndentLines}
                    colorful
                />
                <SummaryCard
                    label="Draft / Approval Queue"
                    tone="amber"
                    value={counts.draft}
                    colorful
                />
                <SummaryCard
                    label="Placed POs"
                    tone="blue"
                    value={counts.placed}
                    colorful
                />
                <SummaryCard
                    label="Partially Received"
                    tone="purple"
                    value={counts.partial}
                    colorful
                />
                <SummaryCard
                    label="Fully Received"
                    tone="green"
                    value={counts.received}
                    colorful
                />
                <SummaryCard
                    label="Active Vendors"
                    tone="indigo"
                    value={counts.vendors}
                    colorful
                />
            </Box>

            {counts.missingDestination > 0 && (
                <Card
                    sx={{
                        ...panelSx,
                        borderColor: "var(--mf-danger-border)",
                        background: "var(--mf-danger-soft)",
                    }}
                >
                    <Typography
                        sx={{
                            color: "var(--mf-danger-text)",
                            fontWeight: 950,
                            fontSize: 13,
                        }}
                    >
                        Procurement configuration attention
                    </Typography>
                    <Typography sx={subTextSx}>
                        {counts.missingDestination} purchase-ready Indent
                        {counts.missingDestination === 1 ? "" : "s"} could not
                        resolve a delivery-location ID. A PO is intentionally
                        blocked until the Store-owned Indent destination is
                        available.
                    </Typography>
                </Card>
            )}

            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: {
                        xs: "1fr",
                        xl: "minmax(0,1.15fr) minmax(360px,.85fr)",
                    },
                    gap: 1.2,
                    alignItems: "start",
                }}
            >
                <Card sx={{ ...panelSx, p: 0, overflow: "hidden" }}>
                    <Box
                        sx={{
                            px: 1.5,
                            py: 1.25,
                            borderBottom: "1px solid var(--mf-border)",
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 1,
                            alignItems: "flex-start",
                            flexWrap: "wrap",
                        }}
                    >
                        <Box>
                            <Typography
                                sx={{ fontSize: 16, fontWeight: 950 }}
                            >
                                Purchase-Ready Shortage Indents
                            </Typography>
                            <Typography sx={subTextSx}>
                                Store-confirmed shortage demand that still has
                                material quantity available to order.
                            </Typography>
                        </Box>
                        <MatFlowStatusChip
                            status={
                                purchaseReadyIndents.length
                                    ? "PURCHASE_REQUIRED"
                                    : "NO_OPEN_SHORTAGE"
                            }
                        />
                    </Box>

                    {loading ? (
                        <LoadingBlock />
                    ) : (
                        <>
                            <Box
                                sx={{
                                    ...tableShellSx,
                                    border: 0,
                                    borderRadius: 0,
                                    overflowX: "auto",
                                }}
                            >
                                <Box
                                    sx={{
                                        ...tableHeaderSx,
                                        minWidth: 940,
                                        gridTemplateColumns:
                                            "165px minmax(210px,1fr) 180px 105px 150px 130px",
                                    }}
                                >
                                    {[
                                        "Indent",
                                        "Project / Product",
                                        "Delivery",
                                        "Open Lines",
                                        "Status",
                                        "Action",
                                    ].map((heading) => (
                                        <Box
                                            key={heading}
                                            sx={tableCellSx}
                                        >
                                            {heading}
                                        </Box>
                                    ))}
                                </Box>

                                {purchaseReadyIndents.length === 0 ? (
                                    <EmptyState>
                                        No Store-confirmed shortage Indent is
                                        currently waiting for Purchase.
                                    </EmptyState>
                                ) : (
                                    indentPagination.pageItems.map(
                                        (indent) => {
                                            const lines =
                                                openIndentLines(indent);
                                            const deliveryId =
                                                indentDeliveryLocationId(
                                                    indent
                                                );

                                            return (
                                                <Box
                                                    key={indent.id}
                                                    sx={{
                                                        ...tableRowSx,
                                                        minWidth: 940,
                                                        gridTemplateColumns:
                                                            "165px minmax(210px,1fr) 180px 105px 150px 130px",
                                                    }}
                                                >
                                                    <Box sx={tableCellSx}>
                                                        <Typography
                                                            sx={mainTextSx}
                                                        >
                                                            {indent.indentNumber ||
                                                                "-"}
                                                        </Typography>
                                                        <Typography
                                                            sx={subTextSx}
                                                        >
                                                            {formatDate(
                                                                indent.updatedAt ||
                                                                indent.createdAt
                                                            )}
                                                        </Typography>
                                                    </Box>

                                                    <Box sx={tableCellSx}>
                                                        <Typography
                                                            sx={mainTextSx}
                                                        >
                                                            {indent.requisition
                                                                ?.projectCode ||
                                                                "-"}
                                                        </Typography>
                                                        <Typography
                                                            sx={subTextSx}
                                                        >
                                                            {indent.requisition
                                                                ?.productName ||
                                                                "-"}{" "}
                                                            ·{" "}
                                                            {indent.requisition
                                                                ?.drawingNo ||
                                                                "-"}
                                                        </Typography>
                                                    </Box>

                                                    <Box sx={tableCellSx}>
                                                        <Typography
                                                            sx={mainTextSx}
                                                        >
                                                            {indentDeliveryLocationCode(
                                                                indent
                                                            ) || "-"}
                                                        </Typography>
                                                        <Typography
                                                            sx={subTextSx}
                                                        >
                                                            {indentDeliveryPlantCode(
                                                                indent
                                                            ) || "-"}
                                                        </Typography>
                                                    </Box>

                                                    <Box sx={tableCellSx}>
                                                        {lines.length}
                                                    </Box>

                                                    <Box sx={tableCellSx}>
                                                        <MatFlowStatusChip
                                                            status={
                                                                indent.status
                                                            }
                                                        />
                                                    </Box>

                                                    <Box sx={tableCellSx}>
                                                        {canPurchase ? (
                                                            <Button
                                                                startIcon={
                                                                    <AddIcon />
                                                                }
                                                                disabled={
                                                                    !deliveryId
                                                                }
                                                                onClick={() =>
                                                                    openPo(
                                                                        indent
                                                                    )
                                                                }
                                                                sx={
                                                                    primaryBtnSx
                                                                }
                                                            >
                                                                Create PO
                                                            </Button>
                                                        ) : (
                                                            <Typography
                                                                sx={subTextSx}
                                                            >
                                                                Read only
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                </Box>
                                            );
                                        }
                                    )
                                )}
                            </Box>

                            <Box sx={{ px: 1.2, pb: 1.2 }}>
                                <MatFlowPagination
                                    {...indentPagination}
                                    onPageChange={indentPagination.setPage}
                                    onPageSizeChange={
                                        indentPagination.setPageSize
                                    }
                                    pageSizeOptions={[5, 8, 15, 25]}
                                    label="Purchase-ready Indents"
                                />
                            </Box>
                        </>
                    )}
                </Card>

                <Card sx={panelSx}>
                    <Typography
                        sx={{ fontSize: 16, fontWeight: 950 }}
                    >
                        Procurement Readiness
                    </Typography>
                    <Typography sx={{ ...subTextSx, mb: 1.15 }}>
                        A Purchase Order should be created only when all three
                        source controls are resolved.
                    </Typography>

                    {[
                        {
                            label: "1 · Store Shortage Indent",
                            value: purchaseReadyIndents.length,
                            caption:
                                "Submitted shortage demand available to Purchase.",
                            status:
                                purchaseReadyIndents.length > 0
                                    ? "READY"
                                    : "WAITING",
                        },
                        {
                            label: "2 · Active Vendor",
                            value: counts.vendors,
                            caption:
                                "Approved active Vendor master available for selection.",
                            status:
                                counts.vendors > 0 ? "READY" : "ACTION_REQUIRED",
                        },
                        {
                            label: "3 · Delivery Destination",
                            value:
                                counts.openIndents -
                                counts.missingDestination,
                            caption:
                                "Exact Store-owned Indent location that the backend will enforce on the PO.",
                            status:
                                counts.missingDestination === 0
                                    ? "READY"
                                    : "ACTION_REQUIRED",
                        },
                    ].map((item) => (
                        <Box
                            key={item.label}
                            sx={{
                                p: 1,
                                mb: .75,
                                borderRadius: 1.7,
                                border: "1px solid var(--mf-border)",
                                background: "var(--mf-surface)",
                            }}
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 1,
                                    alignItems: "center",
                                }}
                            >
                                <Typography sx={mainTextSx}>
                                    {item.label}
                                </Typography>
                                <MatFlowStatusChip status={item.status} />
                            </Box>
                            <Typography
                                sx={{
                                    fontSize: 20,
                                    fontWeight: 950,
                                    mt: .4,
                                }}
                            >
                                {item.value}
                            </Typography>
                            <Typography sx={subTextSx}>
                                {item.caption}
                            </Typography>
                        </Box>
                    ))}

                    <Box
                        sx={{
                            mt: 1,
                            p: 1,
                            borderRadius: 1.7,
                            border: "1px solid var(--mf-primary-border)",
                            background: "var(--mf-primary-soft)",
                        }}
                    >
                        <Typography
                            sx={{
                                fontSize: 11.5,
                                fontWeight: 950,
                                color: "var(--mf-primary-text)",
                            }}
                        >
                            Controlled delivery rule
                        </Typography>
                        <Typography sx={subTextSx}>
                            Purchase does not choose an arbitrary receiving
                            location. The PO inherits the delivery destination
                            from the Store shortage Indent, and the backend
                            verifies that both IDs match.
                        </Typography>
                    </Box>
                </Card>
            </Box>

            <Card sx={panelSx}>
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 1,
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        mb: 1.2,
                    }}
                >
                    <Box>
                        <Typography
                            sx={{ fontSize: 17, fontWeight: 950 }}
                        >
                            Purchase Order Register
                        </Typography>
                        <Typography sx={subTextSx}>
                            Draft → independent approval → placement → partial /
                            full receipt. Historical POs remain protected.
                        </Typography>
                    </Box>

                    <Typography sx={subTextSx}>
                        Showing {filteredOrders.length} of {scopedOrders.length}
                    </Typography>
                </Box>

                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: {
                            xs: "1fr",
                            md: "minmax(260px,1fr) 220px",
                        },
                        gap: 1,
                        mb: 1.2,
                    }}
                >
                    <TextField
                        label="Search PO, Vendor, Indent, Project or Delivery"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        sx={fieldSx}
                    />

                    <TextField
                        select
                        label="PO Status"
                        value={statusFilter}
                        onChange={(event) =>
                            setStatusFilter(event.target.value)
                        }
                        sx={fieldSx}
                    >
                        {statusOptions.map((value) => (
                            <MenuItem key={value} value={value}>
                                {value === "ALL"
                                    ? "All PO Statuses"
                                    : value
                                        .replaceAll("_", " ")
                                        .toLowerCase()
                                        .replace(/\b\w/g, (char) =>
                                            char.toUpperCase()
                                        )}
                            </MenuItem>
                        ))}
                    </TextField>
                </Box>

                {loading ? (
                    <LoadingBlock />
                ) : (
                    <Box
                        sx={{
                            ...tableShellSx,
                            overflowX: "auto",
                        }}
                    >
                        <Box
                            sx={{
                                ...tableHeaderSx,
                                minWidth: 1180,
                                gridTemplateColumns:
                                    "180px 190px 180px 190px 155px 90px 150px",
                            }}
                        >
                            {[
                                "Purchase Order",
                                "Vendor",
                                "Source Indent",
                                "Delivery",
                                "Status",
                                "Lines",
                                "Control",
                            ].map((heading) => (
                                <Box key={heading} sx={tableCellSx}>
                                    {heading}
                                </Box>
                            ))}
                        </Box>

                        {filteredOrders.length === 0 ? (
                            <EmptyState>
                                No Purchase Orders match the selected scope and
                                filters.
                            </EmptyState>
                        ) : (
                            orderPagination.pageItems.map((row) => (
                                <Box
                                    key={row.id}
                                    sx={{
                                        ...tableRowSx,
                                        minWidth: 1180,
                                        gridTemplateColumns:
                                            "180px 190px 180px 190px 155px 90px 150px",
                                    }}
                                >
                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>
                                            {row.poNumber || "-"}
                                        </Typography>
                                        <Typography sx={subTextSx}>
                                            {row.poDate || "-"}
                                        </Typography>
                                    </Box>

                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>
                                            {row.vendorName || "-"}
                                        </Typography>
                                        <Typography sx={subTextSx}>
                                            {row.vendorCode || ""}
                                        </Typography>
                                    </Box>

                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>
                                            {row.indentNumber || "-"}
                                        </Typography>
                                        <Typography sx={subTextSx}>
                                            {row.projectCode || ""}
                                            {row.drawingNo
                                                ? ` · ${row.drawingNo}`
                                                : ""}
                                        </Typography>
                                    </Box>

                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>
                                            {row.deliveryLocationCode || "-"}
                                        </Typography>
                                        <Typography sx={subTextSx}>
                                            {row.deliveryPlantCode || "-"}
                                        </Typography>
                                    </Box>

                                    <Box sx={tableCellSx}>
                                        <MatFlowStatusChip
                                            status={row.status}
                                        />
                                    </Box>

                                    <Box sx={tableCellSx}>
                                        {row.lines?.length || 0}
                                    </Box>

                                    <Box
                                        sx={{
                                            ...tableCellSx,
                                            display: "flex",
                                            gap: .6,
                                            flexWrap: "wrap",
                                        }}
                                    >
                                        {canPurchase &&
                                            normalize(row.status) === "DRAFT" &&
                                            row.rowVersion != null ? (
                                            <Button
                                                startIcon={
                                                    <DeleteOutlineIcon />
                                                }
                                                disabled={working}
                                                onClick={() =>
                                                    setDeleteTarget(row)
                                                }
                                                sx={dangerBtnSx}
                                            >
                                                Delete Draft
                                            </Button>
                                        ) : (
                                            <Typography sx={subTextSx}>
                                                History protected
                                            </Typography>
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
                        pageSizeOptions={[10, 15, 25, 50]}
                        label="Purchase Orders"
                    />
                )}
            </Card>

            <Card sx={panelSx}>
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 1,
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        mb: 1.1,
                    }}
                >
                    <Box>
                        <Typography
                            sx={{ fontSize: 17, fontWeight: 950 }}
                        >
                            Vendor Directory
                        </Typography>
                        <Typography sx={subTextSx}>
                            Active commercial counterparties used for shortage
                            Purchase Orders.
                        </Typography>
                    </Box>

                    {canPurchase && (
                        <Button
                            startIcon={<AddIcon />}
                            onClick={() => openVendor(null)}
                            sx={secondaryBtnSx}
                        >
                            Add Vendor
                        </Button>
                    )}
                </Box>

                <TextField
                    fullWidth
                    label="Search Vendor, GSTIN, Contact or Email"
                    value={vendorSearch}
                    onChange={(event) =>
                        setVendorSearch(event.target.value)
                    }
                    sx={{ ...fieldSx, mb: 1.1 }}
                />

                <Box sx={{ ...tableShellSx, overflowX: "auto" }}>
                    <Box
                        sx={{
                            ...tableHeaderSx,
                            minWidth: 900,
                            gridTemplateColumns:
                                "150px minmax(220px,1fr) 170px 190px 120px",
                        }}
                    >
                        {[
                            "Code",
                            "Vendor",
                            "GSTIN",
                            "Contact",
                            "Action",
                        ].map((heading) => (
                            <Box key={heading} sx={tableCellSx}>
                                {heading}
                            </Box>
                        ))}
                    </Box>

                    {filteredVendors.length === 0 ? (
                        <EmptyState>
                            No Vendors match the current search.
                        </EmptyState>
                    ) : (
                        vendorPagination.pageItems.map((row) => (
                            <Box
                                key={row.id}
                                sx={{
                                    ...tableRowSx,
                                    minWidth: 900,
                                    gridTemplateColumns:
                                        "150px minmax(220px,1fr) 170px 190px 120px",
                                }}
                            >
                                <Box sx={tableCellSx}>
                                    {row.vendorCode || "-"}
                                </Box>
                                <Box sx={tableCellSx}>
                                    <Typography sx={mainTextSx}>
                                        {row.vendorName || "-"}
                                    </Typography>
                                    <Typography sx={subTextSx}>
                                        {row.email || "-"}
                                    </Typography>
                                </Box>
                                <Box sx={tableCellSx}>
                                    {row.gstin || "-"}
                                </Box>
                                <Box sx={tableCellSx}>
                                    <Typography sx={mainTextSx}>
                                        {row.contactPerson || "-"}
                                    </Typography>
                                    <Typography sx={subTextSx}>
                                        {row.phone || "-"}
                                    </Typography>
                                </Box>
                                <Box sx={tableCellSx}>
                                    {canPurchase ? (
                                        <Button
                                            onClick={() =>
                                                openVendor(row)
                                            }
                                            sx={secondaryBtnSx}
                                        >
                                            Edit
                                        </Button>
                                    ) : (
                                        "-"
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
                    pageSizeOptions={[5, 10, 20, 50]}
                    label="Vendors"
                />
            </Card>

            <Dialog
                open={poDialog}
                onClose={closePo}
                fullWidth
                maxWidth="lg"
                PaperProps={{ sx: dialogPaperSx }}
            >
                <DialogTitle sx={dialogTitleSx}>
                    Create Controlled Purchase Order
                </DialogTitle>

                <DialogContent sx={dialogContentSx}>
                    <Box sx={{ mb: 1.25 }}>
                        <Typography
                            sx={{ fontSize: 14.5, fontWeight: 950 }}
                        >
                            1 · Source Shortage & Delivery
                        </Typography>
                        <Typography sx={subTextSx}>
                            Select the Store-confirmed Indent first. The delivery
                            location is inherited from that Indent and cannot be
                            overridden on the PO.
                        </Typography>
                    </Box>

                    {poError && (
                        <Box sx={{ mb: 1.2 }}>
                            <ErrorBox>{poError}</ErrorBox>
                        </Box>
                    )}

                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "1fr",
                                md: "minmax(260px,1.15fr) minmax(220px,.85fr)",
                            },
                            gap: 1.25,
                        }}
                    >
                        <TextField
                            select
                            label="Shortage Indent *"
                            value={poForm.indentId}
                            onChange={(event) => {
                                setPoError("");
                                setPoForm((current) => ({
                                    ...current,
                                    indentId: event.target.value,
                                }));
                            }}
                            sx={fieldSx}
                        >
                            {purchaseReadyIndents.map((indent) => (
                                <MenuItem
                                    key={indent.id}
                                    value={indent.id}
                                >
                                    {indent.indentNumber || "-"} ·{" "}
                                    {indent.requisition?.projectCode ||
                                        "-"}{" "}
                                    ·{" "}
                                    {indentDeliveryLocationCode(indent) ||
                                        "No delivery location"}
                                </MenuItem>
                            ))}
                        </TextField>

                        <TextField
                            label="Delivery Location *"
                            value={
                                selectedIndent
                                    ? `${selectedIndentLocationCode || "Missing"}${selectedIndentPlantCode
                                        ? ` · ${selectedIndentPlantCode}`
                                        : ""
                                    }`
                                    : ""
                            }
                            placeholder="Inherited from selected Indent"
                            disabled
                            error={
                                Boolean(selectedIndent) &&
                                !indentDeliveryLocationId(selectedIndent)
                            }
                            helperText={
                                selectedIndent
                                    ? indentDeliveryLocationId(selectedIndent)
                                        ? "Locked to the Store shortage Indent."
                                        : "Delivery location ID is missing on this Indent."
                                    : "Select an Indent to resolve the delivery destination."
                            }
                            sx={fieldSx}
                        />
                    </Box>

                    {selectedIndent && (
                        <Box
                            sx={{
                                mt: 1,
                                display: "grid",
                                gridTemplateColumns: {
                                    xs: "1fr",
                                    sm: "repeat(2,minmax(0,1fr))",
                                    lg: "repeat(4,minmax(0,1fr))",
                                },
                                gap: .75,
                            }}
                        >
                            {[
                                [
                                    "Project",
                                    selectedIndent.requisition?.projectCode ||
                                    "-",
                                ],
                                [
                                    "Product / Drawing",
                                    `${selectedIndent.requisition
                                        ?.productName || "-"
                                    } · ${selectedIndent.requisition
                                        ?.drawingNo || "-"
                                    }`,
                                ],
                                [
                                    "Indent Status",
                                    String(
                                        selectedIndent.status || "-"
                                    ).replaceAll("_", " "),
                                ],
                                [
                                    "Open Material Lines",
                                    poLines.length,
                                ],
                            ].map(([label, value]) => (
                                <Box
                                    key={label}
                                    sx={{
                                        p: .85,
                                        border: "1px solid var(--mf-border)",
                                        background: "var(--mf-surface)",
                                        borderRadius: 1.5,
                                    }}
                                >
                                    <Typography
                                        sx={{
                                            ...subTextSx,
                                            fontSize: 9,
                                            textTransform: "uppercase",
                                            fontWeight: 900,
                                        }}
                                    >
                                        {label}
                                    </Typography>
                                    <Typography sx={mainTextSx}>
                                        {value}
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                    )}

                    <Box sx={{ mt: 1.7, mb: 1 }}>
                        <Typography
                            sx={{ fontSize: 14.5, fontWeight: 950 }}
                        >
                            2 · Commercial Header
                        </Typography>
                        <Typography sx={subTextSx}>
                            Choose the Vendor and record the external PO
                            identity/date.
                        </Typography>
                    </Box>

                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "1fr",
                                md: "repeat(3,minmax(0,1fr))",
                            },
                            gap: 1.25,
                        }}
                    >
                        <TextField
                            select
                            label="Vendor *"
                            value={poForm.vendorId}
                            onChange={(event) => {
                                setPoError("");
                                setPoForm((current) => ({
                                    ...current,
                                    vendorId: event.target.value,
                                }));
                            }}
                            sx={fieldSx}
                        >
                            {vendors
                                .filter(
                                    (vendor) =>
                                        vendor.active !== false
                                )
                                .map((vendor) => (
                                    <MenuItem
                                        key={vendor.id}
                                        value={vendor.id}
                                    >
                                        {vendor.vendorCode} ·{" "}
                                        {vendor.vendorName}
                                    </MenuItem>
                                ))}
                        </TextField>

                        <TextField
                            label="PO Number *"
                            value={poForm.poNumber}
                            onChange={(event) => {
                                setPoError("");
                                setPoForm((current) => ({
                                    ...current,
                                    poNumber: event.target.value,
                                }));
                            }}
                            sx={fieldSx}
                        />

                        <TextField
                            type="date"
                            label="PO Date *"
                            value={poForm.poDate}
                            onChange={(event) => {
                                setPoError("");
                                setPoForm((current) => ({
                                    ...current,
                                    poDate: event.target.value,
                                }));
                            }}
                            InputLabelProps={{ shrink: true }}
                            sx={fieldSx}
                        />
                    </Box>

                    <Box sx={{ mt: 1.7, mb: 1 }}>
                        <Typography
                            sx={{ fontSize: 14.5, fontWeight: 950 }}
                        >
                            3 · Material Order Quantities
                        </Typography>
                        <Typography sx={subTextSx}>
                            Quantities default to the remaining Indent shortage.
                            Reduce them when creating a partial PO; they can
                            never exceed the outstanding shortage.
                        </Typography>
                    </Box>

                    <Box
                        sx={{
                            border: "1px solid var(--mf-border)",
                            borderRadius: 1.8,
                            overflow: "hidden",
                        }}
                    >
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns:
                                    "minmax(240px,1fr) 140px 140px 170px",
                                gap: 1,
                                px: 1.1,
                                py: .75,
                                minWidth: 760,
                                background: "var(--mf-table-head)",
                                borderBottom:
                                    "1px solid var(--mf-border)",
                            }}
                        >
                            {[
                                "Material",
                                "Required",
                                "Already Ordered",
                                "Order Now",
                            ].map((heading) => (
                                <Typography
                                    key={heading}
                                    sx={{
                                        ...subTextSx,
                                        fontSize: 9.5,
                                        textTransform: "uppercase",
                                        fontWeight: 950,
                                    }}
                                >
                                    {heading}
                                </Typography>
                            ))}
                        </Box>

                        <Box sx={{ overflowX: "auto" }}>
                            {poLines.length === 0 ? (
                                <Box sx={{ p: 1 }}>
                                    <EmptyState>
                                        Select an Indent with an outstanding
                                        material shortage.
                                    </EmptyState>
                                </Box>
                            ) : (
                                poLines.map((line) => (
                                    <Box
                                        key={line.id}
                                        sx={{
                                            display: "grid",
                                            gridTemplateColumns:
                                                "minmax(240px,1fr) 140px 140px 170px",
                                            gap: 1,
                                            alignItems: "center",
                                            px: 1.1,
                                            py: .85,
                                            minWidth: 760,
                                            borderBottom:
                                                "1px solid var(--mf-border)",
                                            "&:last-of-type": {
                                                borderBottom: 0,
                                            },
                                        }}
                                    >
                                        <Box>
                                            <Typography
                                                sx={mainTextSx}
                                            >
                                                {line.materialCode || "-"} ·{" "}
                                                {line.materialName ||
                                                    "Material"}
                                            </Typography>
                                            <Typography
                                                sx={subTextSx}
                                            >
                                                Outstanding{" "}
                                                {formatQty(
                                                    line.outstanding
                                                )}{" "}
                                                {line.uom || ""}
                                            </Typography>
                                        </Box>

                                        <Typography sx={mainTextSx}>
                                            {formatQty(
                                                line.requiredQty
                                            )}{" "}
                                            {line.uom || ""}
                                        </Typography>

                                        <Typography sx={mainTextSx}>
                                            {formatQty(
                                                line.orderedQty
                                            )}{" "}
                                            {line.uom || ""}
                                        </Typography>

                                        <TextField
                                            type="number"
                                            label="Order Qty"
                                            value={
                                                poForm.quantities[
                                                String(line.id)
                                                ] ?? ""
                                            }
                                            inputProps={{
                                                min: 0,
                                                max: line.outstanding,
                                                step: "any",
                                            }}
                                            onChange={(event) => {
                                                setPoError("");
                                                setPoForm(
                                                    (current) => ({
                                                        ...current,
                                                        quantities: {
                                                            ...current.quantities,
                                                            [String(
                                                                line.id
                                                            )]:
                                                                event.target
                                                                    .value,
                                                        },
                                                    })
                                                );
                                            }}
                                            sx={fieldSx}
                                        />
                                    </Box>
                                ))
                            )}
                        </Box>
                    </Box>

                    <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        label="Purchase Remarks"
                        value={poForm.remarks}
                        onChange={(event) =>
                            setPoForm((current) => ({
                                ...current,
                                remarks: event.target.value,
                            }))
                        }
                        sx={{ ...fieldSx, mt: 1.3 }}
                    />
                </DialogContent>

                <DialogActions sx={dialogActionsSx}>
                    <Button
                        onClick={closePo}
                        disabled={working}
                        sx={secondaryBtnSx}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={createPo}
                        disabled={
                            working ||
                            !selectedIndent ||
                            !indentDeliveryLocationId(selectedIndent) ||
                            poLines.length === 0
                        }
                        sx={primaryBtnSx}
                    >
                        {working ? "Creating..." : "Create Draft PO"}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={Boolean(vendorDialog)}
                onClose={() => !working && setVendorDialog(null)}
                fullWidth
                maxWidth="sm"
                PaperProps={{ sx: dialogPaperSx }}
            >
                <DialogTitle sx={dialogTitleSx}>
                    {vendorDialog?.row
                        ? "Edit Vendor"
                        : "Add Vendor"}
                </DialogTitle>

                <DialogContent sx={dialogContentSx}>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "1fr",
                                sm: "1fr 1fr",
                            },
                            gap: 1.5,
                        }}
                    >
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
                                onChange={(event) =>
                                    setVendorForm((current) => ({
                                        ...current,
                                        [key]: event.target.value,
                                    }))
                                }
                                sx={{
                                    ...fieldSx,
                                    ...(key === "address"
                                        ? {
                                            gridColumn: {
                                                sm: "1 / -1",
                                            },
                                        }
                                        : {}),
                                }}
                            />
                        ))}
                    </Box>

                    <FormControlLabel
                        control={
                            <Switch
                                checked={vendorForm.active === true}
                                onChange={(event) =>
                                    setVendorForm((current) => ({
                                        ...current,
                                        active: event.target.checked,
                                    }))
                                }
                            />
                        }
                        label="Active"
                    />
                </DialogContent>

                <DialogActions sx={dialogActionsSx}>
                    <Button
                        onClick={() => setVendorDialog(null)}
                        disabled={working}
                        sx={secondaryBtnSx}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={saveVendor}
                        disabled={working}
                        sx={primaryBtnSx}
                    >
                        Save Vendor
                    </Button>
                </DialogActions>
            </Dialog>

            <MatFlowDeleteDialog
                open={Boolean(deleteTarget)}
                title="Delete Draft Purchase Order?"
                subject={
                    deleteTarget?.poNumber ||
                    "Draft purchase order"
                }
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
    const [approvalTarget, setApprovalTarget] = useState(null);
    const [approvalRemarks, setApprovalRemarks] = useState("Approved for supplier placement.");
    const [approvalError, setApprovalError] = useState("");

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
            setRows([]);
            setError(readMatFlowError(requestError, "Unable to load PO approvals."));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const approvalPagination = useMatFlowPagination(rows, 20);

    const counts = useMemo(() => {
        const vendorIds = new Set(
            rows.map((row) => row.vendorId || row.vendorCode).filter(Boolean)
        );
        return {
            awaiting: rows.length,
            lines: rows.reduce(
                (sum, row) => sum + (Array.isArray(row.lines) ? row.lines.length : 0),
                0
            ),
            vendors: vendorIds.size,
        };
    }, [rows]);

    const openApproval = (row) => {
        setApprovalTarget(row);
        setApprovalRemarks("Approved for supplier placement.");
        setApprovalError("");
        setError("");
    };

    const closeApproval = () => {
        if (working) return;
        setApprovalTarget(null);
        setApprovalRemarks("Approved for supplier placement.");
        setApprovalError("");
    };

    const approve = async () => {
        const row = approvalTarget;
        if (!row?.id) return;

        if (row.rowVersion == null) {
            setApprovalError(
                "PO rowVersion is missing. Refresh the Approval page before approving."
            );
            return;
        }

        setWorking(String(row.id));
        setApprovalError("");
        setError("");

        try {
            await matflowApi.approvePurchaseOrder(row.id, {
                rowVersion: row.rowVersion,
                remarks: clean(approvalRemarks) || null,
            });

            setApprovalTarget(null);
            setApprovalRemarks("Approved for supplier placement.");
            await load();
        } catch (requestError) {
            setApprovalError(
                readMatFlowError(
                    requestError,
                    "Unable to approve purchase order."
                )
            );
        } finally {
            setWorking("");
        }
    };

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="COMMERCIAL APPROVAL"
                title="Purchase Order Approvals"
                subtitle="Independent commercial approval desk. Review the Vendor, shortage Indent, locked delivery destination and material quantities before releasing a Draft PO to the supplier."
                actions={
                    <>
                        <Button startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMatFlowExcel({ fileName: "MatFlow_PO_Approval_Queue", sheetName: "PO Approvals", title: "MatFlow Purchase Order Approval Queue", rows })} sx={secondaryBtnSx}>Export Excel</Button>
                        <Button
                            startIcon={<RefreshIcon />}
                            onClick={load}
                            disabled={loading || Boolean(working)}
                            sx={secondaryBtnSx}
                        >
                            Refresh
                        </Button>
                    </>
                }
            />

            <ErrorBox>{error}</ErrorBox>

            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(3,minmax(0,1fr))",
                    },
                    gap: 1,
                }}
            >
                <SummaryCard
                    label="Awaiting Approval"
                    value={counts.awaiting}
                    tone="amber"
                    colorful
                />
                <SummaryCard
                    label="Material Lines"
                    value={counts.lines}
                    tone="indigo"
                    colorful
                />
                <SummaryCard
                    label="Vendors Represented"
                    value={counts.vendors}
                    tone="blue"
                    colorful
                />
            </Box>

            <Card sx={panelSx}>
                <Box sx={{ mb: 1 }}>
                    <Typography sx={{ fontSize: 17, fontWeight: 950 }}>
                        Draft PO Approval Queue
                    </Typography>
                    <Typography sx={subTextSx}>
                        Approval changes the PO from Draft to Placed. The backend
                        independently re-validates the shortage commitment and Plant
                        access before release.
                    </Typography>
                </Box>

                {loading ? (
                    <LoadingBlock />
                ) : (
                    <Box sx={{ ...tableShellSx, overflowX: "auto" }}>
                        <Box
                            sx={{
                                ...tableHeaderSx,
                                minWidth: 980,
                                gridTemplateColumns:
                                    "170px 190px 170px 175px 90px 150px",
                            }}
                        >
                            {[
                                "PO",
                                "Vendor",
                                "Indent",
                                "Delivery",
                                "Lines",
                                "Approval",
                            ].map((heading) => (
                                <Box key={heading} sx={tableCellSx}>
                                    {heading}
                                </Box>
                            ))}
                        </Box>

                        {rows.length === 0 ? (
                            <EmptyState>
                                No Draft purchase orders are awaiting approval.
                            </EmptyState>
                        ) : (
                            approvalPagination.pageItems.map((row) => (
                                <Box
                                    key={row.id}
                                    sx={{
                                        ...tableRowSx,
                                        minWidth: 980,
                                        gridTemplateColumns:
                                            "170px 190px 170px 175px 90px 150px",
                                    }}
                                >
                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>
                                            {row.poNumber || "-"}
                                        </Typography>
                                        <Typography sx={subTextSx}>
                                            {formatDate(row.poDate)}
                                        </Typography>
                                    </Box>
                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>
                                            {row.vendorName || "-"}
                                        </Typography>
                                        <Typography sx={subTextSx}>
                                            {row.vendorCode || "-"}
                                        </Typography>
                                    </Box>
                                    <Box sx={tableCellSx}>
                                        {row.indentNumber || "-"}
                                    </Box>
                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>
                                            {row.deliveryLocationCode || "-"}
                                        </Typography>
                                        <Typography sx={subTextSx}>
                                            {row.deliveryPlantCode || "-"}
                                        </Typography>
                                    </Box>
                                    <Box sx={tableCellSx}>
                                        {row.lines?.length || 0}
                                    </Box>
                                    <Box sx={tableCellSx}>
                                        {canApprove ? (
                                            <Button
                                                startIcon={<ApprovalOutlinedIcon />}
                                                disabled={
                                                    Boolean(working) ||
                                                    row.rowVersion == null
                                                }
                                                onClick={() => openApproval(row)}
                                                sx={primaryBtnSx}
                                            >
                                                Review & Approve
                                            </Button>
                                        ) : (
                                            "-"
                                        )}
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

            <Dialog
                open={Boolean(approvalTarget)}
                onClose={closeApproval}
                fullWidth
                maxWidth="md"
                PaperProps={{ sx: dialogPaperSx }}
            >
                <DialogTitle sx={dialogTitleSx}>
                    Review & Approve Purchase Order
                </DialogTitle>

                <DialogContent sx={dialogContentSx}>
                    {approvalError && (
                        <Box sx={{ mb: 1.2 }}>
                            <ErrorBox>{approvalError}</ErrorBox>
                        </Box>
                    )}

                    <Typography sx={{ ...subTextSx, mb: 1.2 }}>
                        This action places the PO and commits its quantities against
                        the shortage Indent. MatFlow will re-check outstanding
                        quantity, row version, Plant authorization and procurement
                        lineage on the backend before approval.
                    </Typography>

                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "1fr",
                                sm: "repeat(2,minmax(0,1fr))",
                                lg: "repeat(4,minmax(0,1fr))",
                            },
                            gap: .8,
                            mb: 1.3,
                        }}
                    >
                        {[
                            ["PO", approvalTarget?.poNumber || "-"],
                            ["Vendor", approvalTarget?.vendorName || "-"],
                            ["Indent", approvalTarget?.indentNumber || "-"],
                            [
                                "Delivery",
                                `${approvalTarget?.deliveryLocationCode || "-"}${approvalTarget?.deliveryPlantCode
                                    ? ` · ${approvalTarget.deliveryPlantCode}`
                                    : ""
                                }`,
                            ],
                        ].map(([label, value]) => (
                            <Box
                                key={label}
                                sx={{
                                    p: .9,
                                    border: "1px solid var(--mf-border)",
                                    borderRadius: 1.5,
                                    background: "var(--mf-surface)",
                                }}
                            >
                                <Typography
                                    sx={{
                                        ...subTextSx,
                                        fontSize: 9,
                                        textTransform: "uppercase",
                                        letterSpacing: ".07em",
                                    }}
                                >
                                    {label}
                                </Typography>
                                <Typography sx={mainTextSx}>{value}</Typography>
                            </Box>
                        ))}
                    </Box>

                    <Box sx={{ ...tableShellSx, overflowX: "auto", mb: 1.3 }}>
                        <Box
                            sx={{
                                ...tableHeaderSx,
                                minWidth: 680,
                                gridTemplateColumns:
                                    "160px minmax(220px,1fr) 140px 100px",
                            }}
                        >
                            {["Material", "Name", "Ordered Qty", "UOM"].map(
                                (heading) => (
                                    <Box key={heading} sx={tableCellSx}>
                                        {heading}
                                    </Box>
                                )
                            )}
                        </Box>

                        {(approvalTarget?.lines || []).map((line) => (
                            <Box
                                key={line.id}
                                sx={{
                                    ...tableRowSx,
                                    minWidth: 680,
                                    gridTemplateColumns:
                                        "160px minmax(220px,1fr) 140px 100px",
                                }}
                            >
                                <Box sx={tableCellSx}>
                                    {line.materialCode || "-"}
                                </Box>
                                <Box sx={tableCellSx}>
                                    {line.materialName || "-"}
                                </Box>
                                <Box sx={tableCellSx}>
                                    {formatQty(line.orderedQty)}
                                </Box>
                                <Box sx={tableCellSx}>{line.uom || "-"}</Box>
                            </Box>
                        ))}
                    </Box>

                    <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        label="Approval Remarks / Reason"
                        value={approvalRemarks}
                        onChange={(event) => {
                            setApprovalRemarks(event.target.value);
                            setApprovalError("");
                        }}
                        disabled={Boolean(working)}
                        sx={fieldSx}
                    />
                </DialogContent>

                <DialogActions sx={dialogActionsSx}>
                    <Button
                        onClick={closeApproval}
                        disabled={Boolean(working)}
                        sx={secondaryBtnSx}
                    >
                        Cancel
                    </Button>
                    <Button
                        startIcon={<ApprovalOutlinedIcon />}
                        onClick={approve}
                        disabled={
                            Boolean(working) ||
                            !approvalTarget?.id ||
                            approvalTarget?.rowVersion == null
                        }
                        sx={primaryBtnSx}
                    >
                        {working ? "Approving…" : "Approve & Place PO"}
                    </Button>
                </DialogActions>
            </Dialog>
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
                        <Button startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMatFlowExcel({ fileName: "MatFlow_GRN_Receiving", sheetName: "GRN", title: "MatFlow Goods Receipt Register", rows: receipts })} sx={secondaryBtnSx}>Export Excel</Button>
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
                                    <Typography sx={mainTextSx}>{line.materialName} · {line.materialCode}</Typography>
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
