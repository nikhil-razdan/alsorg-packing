import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    Box,
    Button,
    Card,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    LinearProgress,
    TextField,
    Typography,
} from "@mui/material";

import ArrowBackOutlinedIcon
    from "@mui/icons-material/ArrowBackOutlined";

import RefreshOutlinedIcon
    from "@mui/icons-material/RefreshOutlined";

import LocalShippingOutlinedIcon
    from "@mui/icons-material/LocalShippingOutlined";

import MoveToInboxOutlinedIcon
    from "@mui/icons-material/MoveToInboxOutlined";

import EastOutlinedIcon
    from "@mui/icons-material/EastOutlined";

import {
    useNavigate,
    useParams,
} from "react-router-dom";

import {
    useAuth,
} from "../../../auth/AuthContext";

import {
    getMatFlowRole,
    MATFLOW_ROLES,
} from "../../../utils/matflowAccess";

import {
    matflowApi,
    readMatFlowError,
} from "../api/matflowApi";

import {
    errorBoxSx,
    fieldSx,
    heroBadgeSx,
    heroSubSx,
    heroSx,
    heroTitleSx,
    loadingSx,
    pageSx,
    panelSx,
    primaryBtnSx,
    secondaryBtnSx,
} from "../matflowTheme";

const clean = (
    value
) =>
    String(value ?? "").trim();

const normalizeStatus = (
    value
) =>
    clean(value)
        .toUpperCase();

const numeric = (
    value
) => {
    const parsed =
        Number(value);

    return Number.isFinite(parsed)
        ? parsed
        : 0;
};

const formatQty = (
    value
) =>
    numeric(value)
        .toLocaleString(
            "en-IN",
            {
                maximumFractionDigits: 3,
            }
        );

const readable = (
    value
) =>
    clean(value)
        .toLowerCase()
        .split("_")
        .filter(Boolean)
        .map(
            (part) =>
                part.charAt(0)
                    .toUpperCase() +
                part.slice(1)
        )
        .join(" ");

const clampPercent = (
    value
) =>
    Math.min(
        100,
        Math.max(
            0,
            Math.round(
                numeric(value)
            )
        )
    );

const statusMeta = (
    value
) => {
    switch (
    normalizeStatus(value)
    ) {
        case "PLANNED":
            return {
                label:
                    "Planned",
                color:
                    "#64748b",
                progress:
                    10,
            };

        case "READY":
            return {
                label:
                    "Ready to Dispatch",
                color:
                    "#2563eb",
                progress:
                    25,
            };

        case "PARTIALLY_DISPATCHED":
            return {
                label:
                    "Partially Dispatched",
                color:
                    "#d97706",
                progress:
                    45,
            };

        case "IN_TRANSIT":
            return {
                label:
                    "In Transit",
                color:
                    "#7c3aed",
                progress:
                    65,
            };

        case "PARTIALLY_RECEIVED":
            return {
                label:
                    "Partially Received",
                color:
                    "#ea580c",
                progress:
                    82,
            };

        case "RECEIVED":
            return {
                label:
                    "Received",
                color:
                    "#16a34a",
                progress:
                    100,
            };

        case "CANCELLED":
            return {
                label:
                    "Cancelled",
                color:
                    "#dc2626",
                progress:
                    0,
            };

        default:
            return {
                label:
                    readable(value) ||
                    "Unknown",
                color:
                    "#64748b",
                progress:
                    0,
            };
    }
};

export default function MatFlowTransferDetail() {
    const {
        transferId,
    } = useParams();

    const navigate =
        useNavigate();

    const {
        role,
        user,
    } = useAuth();

    const cleanRole =
        getMatFlowRole(
            role ||
            user?.role
        );

    const canExecute = [
        MATFLOW_ROLES.ADMIN,
        MATFLOW_ROLES.MANAGER,
        MATFLOW_ROLES.STORE,
    ].includes(
        cleanRole
    );

    const [
        transfer,
        setTransfer,
    ] = useState(null);

    const [
        loading,
        setLoading,
    ] = useState(true);

    const [
        working,
        setWorking,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState("");

    const [
        action,
        setAction,
    ] = useState(null);

    const [
        form,
        setForm,
    ] = useState({
        quantity: "",
        batchNo: "",
        remarks: "",
    });

    const load = useCallback(
        async () => {
            if (!transferId) {
                setTransfer(null);
                setLoading(false);
                setError(
                    "Transfer ID is missing."
                );
                return;
            }

            setLoading(true);
            setError("");

            try {
                const response =
                    await matflowApi
                        .getTransfer(
                            transferId
                        );

                setTransfer(
                    response?.data ||
                    null
                );
            } catch (
            requestError
            ) {
                setTransfer(null);

                setError(
                    readMatFlowError(
                        requestError,
                        "Unable to load the material transfer."
                    )
                );
            } finally {
                setLoading(false);
            }
        },
        [transferId]
    );

    useEffect(() => {
        load();
    }, [load]);

    const status =
        normalizeStatus(
            transfer?.status
        );

    const plannedQty =
        numeric(
            transfer?.plannedQty
        );

    const dispatchedQty =
        numeric(
            transfer?.dispatchedQty
        );

    const receivedQty =
        numeric(
            transfer?.receivedQty
        );

    const pendingDispatch =
        Math.max(
            0,
            plannedQty -
            dispatchedQty
        );

    const pendingReceipt =
        Math.max(
            0,
            dispatchedQty -
            receivedQty
        );

    const dispatchable =
        canExecute &&
        [
            "READY",
            "PARTIALLY_DISPATCHED",
            "PARTIALLY_RECEIVED",
        ].includes(status) &&
        pendingDispatch > 0;

    const receivable =
        canExecute &&
        [
            "PARTIALLY_DISPATCHED",
            "IN_TRANSIT",
            "PARTIALLY_RECEIVED",
        ].includes(status) &&
        pendingReceipt > 0;

    const meta =
        useMemo(
            () =>
                statusMeta(
                    transfer?.status
                ),
            [transfer?.status]
        );

    const dispatchPercent =
        plannedQty > 0
            ? clampPercent(
                (
                    dispatchedQty /
                    plannedQty
                ) *
                100
            )
            : 0;

    const receiptPercent =
        plannedQty > 0
            ? clampPercent(
                (
                    receivedQty /
                    plannedQty
                ) *
                100
            )
            : 0;

    const openAction = (
        nextAction
    ) => {
        const quantity =
            nextAction ===
                "DISPATCH"
                ? pendingDispatch
                : pendingReceipt;

        setAction(
            nextAction
        );

        setForm({
            quantity:
                quantity > 0
                    ? String(
                        quantity
                    )
                    : "",

            batchNo: "",
            remarks: "",
        });

        setError("");
    };

    const closeAction = () => {
        if (working) {
            return;
        }

        setAction(null);

        setForm({
            quantity: "",
            batchNo: "",
            remarks: "",
        });
    };

    const updateForm = (
        key,
        value
    ) => {
        setForm(
            (current) => ({
                ...current,
                [key]: value,
            })
        );
    };

    const executeAction =
        async () => {
            if (
                !transfer?.id ||
                !action
            ) {
                return;
            }

            const quantity =
                Number(
                    form.quantity
                );

            if (
                !Number.isFinite(
                    quantity
                ) ||
                quantity <= 0
            ) {
                setError(
                    "Quantity must be greater than zero."
                );
                return;
            }

            const maximum =
                action ===
                    "DISPATCH"
                    ? pendingDispatch
                    : pendingReceipt;

            if (
                quantity >
                maximum
            ) {
                setError(
                    `${action ===
                        "DISPATCH"
                        ? "Dispatch"
                        : "Receipt"
                    } quantity cannot exceed ${formatQty(
                        maximum
                    )} ${transfer.uom ||
                    ""}.`
                );
                return;
            }

            const body = {
                rowVersion:
                    transfer.rowVersion,

                quantity,

                batchNo:
                    clean(
                        form.batchNo
                    ) ||
                    null,

                remarks:
                    clean(
                        form.remarks
                    ) ||
                    null,
            };

            setWorking(true);
            setError("");

            try {
                const response =
                    action ===
                        "DISPATCH"
                        ? await matflowApi
                            .dispatchTransfer(
                                transfer.id,
                                body
                            )
                        : await matflowApi
                            .receiveTransfer(
                                transfer.id,
                                body
                            );

                const updated =
                    response?.data;

                if (updated?.id) {
                    setTransfer(
                        updated
                    );
                } else {
                    await load();
                }

                setAction(null);

                setForm({
                    quantity: "",
                    batchNo: "",
                    remarks: "",
                });
            } catch (
            requestError
            ) {
                setError(
                    readMatFlowError(
                        requestError,
                        action ===
                            "DISPATCH"
                            ? "Unable to dispatch the transfer."
                            : "Unable to receive the transfer."
                    )
                );
            } finally {
                setWorking(false);
            }
        };

    if (loading) {
        return (
            <Box sx={loadingSx}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={pageSx}>
            <Box sx={heroSx}>
                <Box sx={heroRowSx}>
                    <Box>
                        <Chip
                            icon={
                                <LocalShippingOutlinedIcon />
                            }
                            label="TRANSFER EXECUTION"
                            sx={heroBadgeSx}
                        />

                        <Typography sx={heroTitleSx}>
                            {transfer?.transferNumber ||
                                "Material Transfer"}
                        </Typography>

                        <Typography sx={heroSubSx}>
                            {transfer?.materialCode ||
                                "-"}
                            {" · "}
                            {transfer?.materialName ||
                                "-"}
                            {" · Route step "}
                            {transfer?.routeSequenceNo ??
                                "-"}
                        </Typography>
                    </Box>

                    <Box sx={headerActionsSx}>
                        <Button
                            startIcon={
                                <RefreshOutlinedIcon />
                            }
                            onClick={load}
                            disabled={working}
                            sx={secondaryBtnSx}
                        >
                            Refresh
                        </Button>

                        <Button
                            startIcon={
                                <ArrowBackOutlinedIcon />
                            }
                            onClick={() =>
                                navigate(
                                    "/matflow/transfers"
                                )
                            }
                            disabled={working}
                            sx={secondaryBtnSx}
                        >
                            Back
                        </Button>
                    </Box>
                </Box>
            </Box>

            {error && (
                <Box sx={errorBoxSx}>
                    {error}
                </Box>
            )}

            {transfer && (
                <>
                    <Card sx={panelSx}>
                        <Box sx={statusHeaderSx}>
                            <Box>
                                <Typography sx={sectionTitleSx}>
                                    Transfer Position
                                </Typography>

                                <Typography sx={sectionSubSx}>
                                    {readable(
                                        transfer.purpose
                                    )}
                                </Typography>
                            </Box>

                            <Chip
                                label={meta.label}
                                sx={statusChipSx(
                                    meta.color
                                )}
                            />
                        </Box>

                        <Box sx={routeSx}>
                            <LocationCard
                                label="Source"
                                code={
                                    transfer.fromLocationCode
                                }
                                plant={
                                    transfer.fromPlantCode
                                }
                            />

                            <Box sx={routeArrowSx}>
                                <EastOutlinedIcon />

                                <Typography sx={routeArrowTextSx}>
                                    {formatQty(
                                        transfer.plannedQty
                                    )}
                                    {" "}
                                    {transfer.uom ||
                                        ""}
                                </Typography>
                            </Box>

                            <LocationCard
                                label="Destination"
                                code={
                                    transfer.toLocationCode
                                }
                                plant={
                                    transfer.toPlantCode
                                }
                            />
                        </Box>

                        <Box sx={overallProgressHeadSx}>
                            <Typography sx={progressLabelSx}>
                                Workflow Progress
                            </Typography>

                            <Typography sx={progressValueSx}>
                                {meta.progress}%
                            </Typography>
                        </Box>

                        <LinearProgress
                            variant="determinate"
                            value={meta.progress}
                            sx={progressSx(
                                meta.color
                            )}
                        />
                    </Card>

                    <Box sx={summaryGridSx}>
                        <QuantityCard
                            label="Planned Quantity"
                            value={plannedQty}
                            uom={transfer.uom}
                            color="#2563eb"
                        />

                        <QuantityCard
                            label="Dispatched Quantity"
                            value={dispatchedQty}
                            uom={transfer.uom}
                            color="#7c3aed"
                        />

                        <QuantityCard
                            label="Received Quantity"
                            value={receivedQty}
                            uom={transfer.uom}
                            color="#16a34a"
                        />

                        <QuantityCard
                            label="Pending Dispatch"
                            value={pendingDispatch}
                            uom={transfer.uom}
                            color="#d97706"
                        />

                        <QuantityCard
                            label="Pending Receipt"
                            value={pendingReceipt}
                            uom={transfer.uom}
                            color="#ea580c"
                        />
                    </Box>

                    <Card sx={panelSx}>
                        <Typography sx={sectionTitleSx}>
                            Material Context
                        </Typography>

                        <Box sx={detailGridSx}>
                            <Detail
                                label="Material Code"
                                value={
                                    transfer.materialCode
                                }
                            />

                            <Detail
                                label="Material Name"
                                value={
                                    transfer.materialName
                                }
                            />

                            <Detail
                                label="Unit"
                                value={
                                    transfer.uom
                                }
                            />

                            <Detail
                                label="Transfer Purpose"
                                value={
                                    readable(
                                        transfer.purpose
                                    )
                                }
                            />

                            <Detail
                                label="Route Sequence"
                                value={
                                    transfer.routeSequenceNo
                                }
                            />

                            <Detail
                                label="Predecessor"
                                value={
                                    transfer.predecessorTransferId ||
                                    "First route step"
                                }
                            />

                            <Detail
                                label="Row Version"
                                value={
                                    transfer.rowVersion
                                }
                            />
                        </Box>
                    </Card>

                    <Card sx={panelSx}>
                        <Box sx={executionHeaderSx}>
                            <Box>
                                <Typography sx={sectionTitleSx}>
                                    Transfer Actions
                                </Typography>

                                <Typography sx={sectionSubSx}>
                                    Dispatch is deducted from
                                    the source. Receipt clears
                                    in-transit stock and adds it
                                    to the destination.
                                </Typography>
                            </Box>

                            <Box sx={executionActionsSx}>
                                {dispatchable && (
                                    <Button
                                        startIcon={
                                            <LocalShippingOutlinedIcon />
                                        }
                                        onClick={() =>
                                            openAction(
                                                "DISPATCH"
                                            )
                                        }
                                        disabled={working}
                                        sx={primaryBtnSx}
                                    >
                                        Dispatch Material
                                    </Button>
                                )}

                                {receivable && (
                                    <Button
                                        startIcon={
                                            <MoveToInboxOutlinedIcon />
                                        }
                                        onClick={() =>
                                            openAction(
                                                "RECEIVE"
                                            )
                                        }
                                        disabled={working}
                                        sx={receiveBtnSx}
                                    >
                                        Receive Material
                                    </Button>
                                )}
                            </Box>
                        </Box>

                        {!canExecute && (
                            <Box sx={readOnlyBoxSx}>
                                This role has read-only access
                                to transfer execution.
                            </Box>
                        )}

                        {canExecute &&
                            !dispatchable &&
                            !receivable && (
                                <Box sx={readOnlyBoxSx}>
                                    No transfer action is
                                    currently available for status{" "}
                                    <strong>
                                        {meta.label}
                                    </strong>
                                    .
                                </Box>
                            )}
                    </Card>
                </>
            )}

            <Dialog
                open={Boolean(action)}
                onClose={closeAction}
                fullWidth
                maxWidth="sm"
                PaperProps={{
                    sx: dialogPaperSx,
                }}
            >
                <DialogTitle sx={dialogTitleSx}>
                    {action ===
                        "DISPATCH"
                        ? "Dispatch Material"
                        : "Receive Material"}
                </DialogTitle>

                <DialogContent sx={dialogContentSx}>
                    <Typography sx={dialogMessageSx}>
                        {action ===
                            "DISPATCH"
                            ? `Outstanding dispatch quantity: ${formatQty(
                                pendingDispatch
                            )} ${transfer?.uom ||
                            ""}.`
                            : `Outstanding in-transit receipt quantity: ${formatQty(
                                pendingReceipt
                            )} ${transfer?.uom ||
                            ""}.`}
                    </Typography>

                    <Box sx={dialogFormSx}>
                        <TextField
                            label="Quantity *"
                            type="number"
                            value={form.quantity}
                            disabled={working}
                            onChange={(event) =>
                                updateForm(
                                    "quantity",
                                    event.target.value
                                )
                            }
                            inputProps={{
                                min: 0.001,
                                max:
                                    action ===
                                        "DISPATCH"
                                        ? pendingDispatch
                                        : pendingReceipt,
                                step: 0.001,
                            }}
                            sx={fieldSx}
                        />

                        <TextField
                            label="Batch Number"
                            value={form.batchNo}
                            disabled={working}
                            onChange={(event) =>
                                updateForm(
                                    "batchNo",
                                    event.target.value
                                )
                            }
                            sx={fieldSx}
                        />

                        <TextField
                            label="Remarks"
                            multiline
                            minRows={3}
                            value={form.remarks}
                            disabled={working}
                            onChange={(event) =>
                                updateForm(
                                    "remarks",
                                    event.target.value
                                )
                            }
                            sx={{
                                ...fieldSx,
                                gridColumn:
                                    "1 / -1",
                            }}
                        />
                    </Box>
                </DialogContent>

                <DialogActions sx={dialogActionsSx}>
                    <Button
                        onClick={closeAction}
                        disabled={working}
                        sx={secondaryBtnSx}
                    >
                        Cancel
                    </Button>

                    <Button
                        onClick={executeAction}
                        disabled={working}
                        sx={
                            action ===
                                "RECEIVE"
                                ? receiveBtnSx
                                : primaryBtnSx
                        }
                    >
                        {working
                            ? "Processing..."
                            : action ===
                                "DISPATCH"
                                ? "Confirm Dispatch"
                                : "Confirm Receipt"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

function LocationCard({
    label,
    code,
    plant,
}) {
    return (
        <Box sx={locationCardSx}>
            <Typography sx={detailLabelSx}>
                {label}
            </Typography>

            <Typography sx={locationCodeSx}>
                {code || "-"}
            </Typography>

            <Typography sx={locationPlantSx}>
                {plant || "-"}
            </Typography>
        </Box>
    );
}

function QuantityCard({
    label,
    value,
    uom,
    color,
}) {
    return (
        <Card
            sx={{
                ...quantityCardSx,
                borderTop:
                    `3px solid ${color}`,
            }}
        >
            <Typography sx={detailLabelSx}>
                {label}
            </Typography>

            <Typography
                sx={{
                    ...quantityValueSx,
                    color,
                }}
            >
                {formatQty(value)}
            </Typography>

            <Typography sx={quantityUomSx}>
                {uom || "-"}
            </Typography>
        </Card>
    );
}

function Detail({
    label,
    value,
}) {
    return (
        <Box sx={detailBoxSx}>
            <Typography sx={detailLabelSx}>
                {label}
            </Typography>

            <Typography sx={detailValueSx}>
                {value ?? "-"}
            </Typography>
        </Box>
    );
}

const heroRowSx = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "14px",
    flexWrap: "wrap",
};

const headerActionsSx = {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
};

const statusHeaderSx = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
};

const sectionTitleSx = {
    color:
        "var(--mf-text)",
    fontSize: "17px",
    fontWeight: 950,
};

const sectionSubSx = {
    mt: "3px",
    color:
        "var(--mf-text-muted)",
    fontSize: "11px",
    fontWeight: 700,
    lineHeight: 1.45,
};

const statusChipSx = (
    color
) => ({
    height: "27px",
    color,
    background:
        `${color}14`,
    border:
        `1px solid ${color}35`,
    fontSize: "9px",
    fontWeight: 900,
});

const routeSx = {
    mt: "18px",
    display: "grid",
    gridTemplateColumns:
        "minmax(180px,1fr) 120px minmax(180px,1fr)",
    alignItems: "center",
    gap: "14px",

    "@media (max-width: 720px)": {
        gridTemplateColumns:
            "1fr",

        "& > div:nth-of-type(2)": {
            transform:
                "rotate(90deg)",
            justifySelf:
                "center",
        },
    },
};

const locationCardSx = {
    p: "14px",
    borderRadius: "11px",
    background:
        "var(--mf-surface-soft)",
    border:
        "1px solid var(--mf-border)",
    textAlign: "center",
};

const locationCodeSx = {
    mt: "6px",
    color:
        "var(--mf-text)",
    fontSize: "16px",
    fontWeight: 950,
};

const locationPlantSx = {
    mt: "3px",
    color:
        "var(--mf-text-muted)",
    fontSize: "10px",
    fontWeight: 750,
};

const routeArrowSx = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#7c3aed",
};

const routeArrowTextSx = {
    mt: "3px",
    color:
        "var(--mf-text-secondary)",
    fontSize: "9px",
    fontWeight: 850,
};

const overallProgressHeadSx = {
    mt: "18px",
    display: "flex",
    justifyContent: "space-between",
};

const progressLabelSx = {
    color:
        "var(--mf-text-muted)",
    fontSize: "9px",
    fontWeight: 900,
    textTransform: "uppercase",
};

const progressValueSx = {
    color:
        "var(--mf-text)",
    fontSize: "10px",
    fontWeight: 950,
};

const progressSx = (
    color
) => ({
    mt: "6px",
    height: "8px",
    borderRadius: 999,
    background:
        "var(--mf-surface-strong)",

    "& .MuiLinearProgress-bar": {
        background:
            `linear-gradient(90deg,${color},${color}bb)`,
        borderRadius: 999,
    },
});

const summaryGridSx = {
    display: "grid",
    gridTemplateColumns:
        "repeat(5,minmax(0,1fr))",
    gap: "10px",

    "@media (max-width: 1100px)": {
        gridTemplateColumns:
            "repeat(3,minmax(0,1fr))",
    },

    "@media (max-width: 700px)": {
        gridTemplateColumns:
            "repeat(2,minmax(0,1fr))",
    },

    "@media (max-width: 440px)": {
        gridTemplateColumns:
            "1fr",
    },
};

const quantityCardSx = {
    ...panelSx,
    minHeight: "105px",
};

const quantityValueSx = {
    mt: "8px",
    fontSize: "25px",
    fontWeight: 950,
    lineHeight: 1,
};

const quantityUomSx = {
    mt: "5px",
    color:
        "var(--mf-text-muted)",
    fontSize: "9px",
    fontWeight: 850,
};

const detailGridSx = {
    mt: "12px",
    display: "grid",
    gridTemplateColumns:
        "repeat(auto-fit,minmax(180px,1fr))",
    gap: "9px",
};

const detailBoxSx = {
    minWidth: 0,
    p: "11px",
    borderRadius: "9px",
    background:
        "var(--mf-surface-soft)",
    border:
        "1px solid var(--mf-border)",
};

const detailLabelSx = {
    color:
        "var(--mf-text-muted)",
    fontSize: "8.5px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".06em",
};

const detailValueSx = {
    mt: "5px",
    color:
        "var(--mf-text)",
    fontSize: "11px",
    fontWeight: 850,
    overflowWrap: "anywhere",
};

const executionHeaderSx = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "14px",
    flexWrap: "wrap",
};

const executionActionsSx = {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
};

const receiveBtnSx = {
    ...primaryBtnSx,
    background:
        "linear-gradient(135deg,#15803d,#22c55e)",

    "&:hover": {
        background:
            "linear-gradient(135deg,#166534,#16a34a)",
    },
};

const readOnlyBoxSx = {
    mt: "14px",
    p: "12px",
    borderRadius: "9px",
    color:
        "var(--mf-text-muted)",
    background:
        "var(--mf-surface-soft)",
    border:
        "1px solid var(--mf-border)",
    fontSize: "11px",
    fontWeight: 700,
};

const dialogPaperSx = {
    borderRadius: "14px",
    color:
        "var(--mf-text)",
    background:
        "var(--mf-panel-bg-solid)",
    border:
        "1px solid var(--mf-border)",
    backgroundImage: "none",
};

const dialogTitleSx = {
    color:
        "var(--mf-text)",
    fontWeight: 950,
    borderBottom:
        "1px solid var(--mf-border)",
};

const dialogContentSx = {
    pt: "18px !important",
};

const dialogMessageSx = {
    color:
        "var(--mf-text-secondary)",
    fontSize: "11px",
    lineHeight: 1.5,
};

const dialogFormSx = {
    mt: "14px",
    display: "grid",
    gridTemplateColumns:
        "repeat(2,minmax(0,1fr))",
    gap: "12px",

    "@media (max-width: 620px)": {
        gridTemplateColumns:
            "1fr",
    },
};

const dialogActionsSx = {
    p: "14px 24px 20px",
    borderTop:
        "1px solid var(--mf-border)",
};