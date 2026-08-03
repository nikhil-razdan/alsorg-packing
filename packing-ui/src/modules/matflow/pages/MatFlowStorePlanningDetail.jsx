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
    Checkbox,
    Chip,
    CircularProgress,
    LinearProgress,
    ListItemText,
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";

import ArrowBackOutlinedIcon
    from "@mui/icons-material/ArrowBackOutlined";

import RefreshOutlinedIcon
    from "@mui/icons-material/RefreshOutlined";

import AutoFixHighOutlinedIcon
    from "@mui/icons-material/AutoFixHighOutlined";

import Inventory2OutlinedIcon
    from "@mui/icons-material/Inventory2Outlined";

import WarningAmberOutlinedIcon
    from "@mui/icons-material/WarningAmberOutlined";

import LocalShippingOutlinedIcon
    from "@mui/icons-material/LocalShippingOutlined";

import OutputOutlinedIcon
    from "@mui/icons-material/OutputOutlined";

import {
    useNavigate,
    useParams,
} from "react-router-dom";

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
    tableCellSx,
    tableHeaderSx,
    tableRowSx,
    tableShellSx,
} from "../matflowTheme";

const ELIGIBLE_SOURCE_TYPES =
    new Set([
        "STORE",
        "PRODUCTION",
        "PROCESSING",
        "EXTERNAL_PROCESSOR",
    ]);

const STORE_REVIEWABLE_STATUSES =
    new Set([
        "SUBMITTED",
        "SUBMITTED_TO_STORE",
        "STORE_REVIEW_IN_PROGRESS",
    ]);

const clean = (value) =>
    String(value ?? "").trim();

const normalize = (value) =>
    clean(value)
        .toUpperCase()
        .replace(/[\s-]+/g, "_");

const numeric = (value) => {
    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : 0;
};

const formatQty = (value) =>
    numeric(value).toLocaleString(
        "en-IN",
        {
            maximumFractionDigits: 3,
        }
    );

const asArray = (value) => {
    if (Array.isArray(value)) {
        return value;
    }

    if (
        Array.isArray(
            value?.content
        )
    ) {
        return value.content;
    }

    if (
        Array.isArray(
            value?.rows
        )
    ) {
        return value.rows;
    }

    return [];
};

const readable = (value) =>
    normalize(value)
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

const lineStatus = (line) => {
    const requested =
        numeric(
            line?.requestedQty
        );

    const reserved =
        numeric(
            line?.reservedQty
        );

    const shortage =
        numeric(
            line?.shortageQty
        );

    const issued =
        numeric(
            line?.issuedQty
        );

    if (
        requested > 0 &&
        issued >= requested
    ) {
        return {
            label:
                "Issued",
            color:
                "#16a34a",
        };
    }

    if (
        shortage > 0 &&
        reserved > 0
    ) {
        return {
            label:
                "Partially Reserved",
            color:
                "#ea580c",
        };
    }

    if (shortage > 0) {
        return {
            label:
                "Shortage",
            color:
                "#dc2626",
        };
    }

    if (
        requested > 0 &&
        reserved >= requested
    ) {
        return {
            label:
                "Fully Reserved",
            color:
                "#16a34a",
        };
    }

    return {
        label:
            "Awaiting Planning",
        color:
            "#2563eb",
    };
};

const lineProgress = (line) => {
    const requested =
        numeric(
            line?.requestedQty
        );

    if (requested <= 0) {
        return 0;
    }

    const covered =
        Math.max(
            numeric(
                line?.reservedQty
            ),
            numeric(
                line?.issuedQty
            )
        );

    return Math.min(
        100,
        Math.max(
            0,
            Math.round(
                (
                    covered /
                    requested
                ) *
                100
            )
        )
    );
};

const resolveLineWorkflow = (
    line,
    reservations,
    transfers,
    indents
) => {
    const lineId =
        String(line?.id ?? "");

    const requested =
        numeric(
            line?.requestedQty
        );

    const issued =
        numeric(
            line?.issuedQty
        );

    const reserved =
        numeric(
            line?.reservedQty
        );

    const shortage =
        numeric(
            line?.shortageQty
        );

    if (
        requested > 0 &&
        issued >= requested
    ) {
        return {
            department:
                "Production",

            action:
                "Material Issued",
        };
    }

    const relatedReservations =
        reservations.filter(
            (reservation) =>
                String(
                    reservation
                        ?.requisitionLineId ??
                    ""
                ) === lineId
        );

    const issueReady =
        relatedReservations.some(
            (reservation) =>
                reservation.issueReady ===
                true &&
                numeric(
                    reservation
                        .remainingIssueQty
                ) > 0
        );

    if (issueReady) {
        return {
            department:
                "Store",

            action:
                "Issue to Production",
        };
    }

    const relatedTransfers =
        transfers.filter(
            (transfer) =>
                String(
                    transfer
                        ?.requisitionLineId ??
                    ""
                ) === lineId
        );

    const openTransfer =
        relatedTransfers.find(
            (transfer) =>
                ![
                    "RECEIVED",
                    "CANCELLED",
                ].includes(
                    normalize(
                        transfer.status
                    )
                )
        );

    if (openTransfer) {
        return {
            department:
                readable(
                    openTransfer
                        .responsibleDepartment ||
                    "Transfer"
                ),

            action:
                readable(
                    openTransfer
                        .nextAction ||
                    openTransfer.status
                ),
        };
    }

    const relatedIndent =
        indents.find(
            (indent) =>
                asArray(
                    indent.lines
                ).some(
                    (indentLine) =>
                        String(
                            indentLine
                                ?.requisitionLineId ??
                            ""
                        ) === lineId
                )
        );

    if (relatedIndent) {
        const indentStatus =
            normalize(
                relatedIndent.status
            );

        if (
            [
                "AUTO_CREATED",
                "DRAFT",
                "RETURNED",
            ].includes(
                indentStatus
            )
        ) {
            return {
                department:
                    "Store",

                action:
                    "Submit to Purchase",
            };
        }

        if (
            indentStatus ===
            "SUBMITTED_TO_PURCHASE"
        ) {
            return {
                department:
                    "Purchase",

                action:
                    "Start Purchase Review",
            };
        }

        if (
            indentStatus ===
            "PURCHASE_IN_PROGRESS"
        ) {
            return {
                department:
                    "Purchase",

                action:
                    "Quotation / Purchase Order",
            };
        }

        if (
            indentStatus ===
            "PO_CREATED"
        ) {
            return {
                department:
                    "Purchase",

                action:
                    "Await Supplier Delivery",
            };
        }

        if (
            indentStatus ===
            "PARTIALLY_RECEIVED"
        ) {
            return {
                department:
                    "Store / QC",

                action:
                    "Complete Receipt and QC",
            };
        }
    }

    if (shortage > 0) {
        return {
            department:
                "Store",

            action:
                "Confirm Shortage",
        };
    }

    if (reserved > 0) {
        return {
            department:
                "Transfer / Processing",

            action:
                "Complete Approved Route",
        };
    }

    return {
        department:
            "Store",

        action:
            "Review Availability",
    };
};

export default function MatFlowStorePlanningDetail() {
    const {
        requisitionId,
    } = useParams();

    const navigate =
        useNavigate();

    const [
        snapshot,
        setSnapshot,
    ] = useState(null);

    const [
        locations,
        setLocations,
    ] = useState([]);

    const [
        availability,
        setAvailability,
    ] = useState([]);

    const [
        selectedSourceIds,
        setSelectedSourceIds,
    ] = useState([]);

    const [
        remarks,
        setRemarks,
    ] = useState("");

    const [
        submittingIndentId,
        setSubmittingIndentId,
    ] = useState("");

    const [
        loading,
        setLoading,
    ] = useState(true);

    const [
        planning,
        setPlanning,
    ] = useState(false);

    const [
        issuingReservationId,
        setIssuingReservationId,
    ] = useState("");

    const [
        error,
        setError,
    ] = useState("");

    const load = useCallback(
        async () => {
            if (!requisitionId) {
                setSnapshot(null);
                setAvailability([]);
                setLocations([]);
                setLoading(false);

                setError(
                    "Requisition ID is missing."
                );

                return;
            }

            setLoading(true);
            setError("");

            try {
                const [
                    planningResponse,
                    availabilityResponse,
                    locationResponse,
                ] = await Promise.all([
                    matflowApi.getStoreReview(
                        requisitionId
                    ),

                    matflowApi.getStoreAvailability(
                        requisitionId
                    ),

                    matflowApi.listLocations({
                        active: true,
                    }),
                ]);

                setSnapshot(
                    planningResponse?.data ||
                    null
                );

                setAvailability(
                    asArray(
                        availabilityResponse?.data
                    )
                );

                setLocations(
                    asArray(
                        locationResponse?.data
                    )
                );
            } catch (requestError) {
                setSnapshot(null);
                setAvailability([]);
                setLocations([]);

                setError(
                    readMatFlowError(
                        requestError,
                        "Unable to load the Store requisition review."
                    )
                );
            } finally {
                setLoading(false);
            }
        },
        [requisitionId]
    );

    useEffect(() => {
        load();
    }, [load]);

    const requisition =
        snapshot?.requisition ||
        null;

    const lines =
        useMemo(
            () =>
                Array.isArray(
                    requisition?.lines
                )
                    ? requisition.lines
                    : [],
            [requisition]
        );

    const reservations =
        useMemo(
            () =>
                Array.isArray(
                    snapshot?.reservations
                )
                    ? snapshot.reservations
                    : [],
            [snapshot]
        );

    const indents =
        useMemo(
            () =>
                Array.isArray(
                    snapshot?.indents
                )
                    ? snapshot.indents
                    : [],
            [snapshot]
        );

    const transfers =
        useMemo(
            () =>
                Array.isArray(
                    snapshot?.transfers
                )
                    ? snapshot.transfers
                    : [],
            [snapshot]
        );

    const availabilityByLineId =
        useMemo(() => {
            const result =
                new Map();

            availability.forEach(
                (entry) => {
                    const lineId =
                        String(
                            entry?.requisitionLineId ??
                            ""
                        );

                    if (lineId) {
                        result.set(
                            lineId,
                            entry
                        );
                    }
                }
            );

            return result;
        }, [availability]);

    const sourceOptions =
        useMemo(() => {
            return locations
                .filter(
                    (location) =>
                        Boolean(
                            location?.id
                        ) &&
                        location.active !==
                        false &&
                        location.supportsStock ===
                        true &&
                        ELIGIBLE_SOURCE_TYPES.has(
                            normalize(
                                location.locationType
                            )
                        )
                )
                .sort(
                    (left, right) =>
                        String(
                            left.locationCode ||
                            ""
                        ).localeCompare(
                            String(
                                right.locationCode ||
                                ""
                            )
                        )
                );
        }, [locations]);

    const totals =
        useMemo(() => {
            return lines.reduce(
                (result, line) => {
                    result.requested +=
                        numeric(
                            line.requestedQty
                        );

                    result.reserved +=
                        numeric(
                            line.reservedQty
                        );

                    result.shortage +=
                        numeric(
                            line.shortageQty
                        );

                    result.issued +=
                        numeric(
                            line.issuedQty
                        );

                    return result;
                },
                {
                    requested: 0,
                    reserved: 0,
                    shortage: 0,
                    issued: 0,
                }
            );
        }, [lines]);

    const status =
        normalize(
            requisition?.status
        );

    const hasValidRowVersion =
        requisition?.rowVersion !==
        null &&
        requisition?.rowVersion !==
        undefined;

    const canConfirmStoreReview =
        Boolean(
            requisition?.id
        ) &&
        hasValidRowVersion &&
        STORE_REVIEWABLE_STATUSES.has(
            status
        );

    const storeReviewCompleted =
        Boolean(
            requisition?.id
        ) &&
        !canConfirmStoreReview;

    const updateSelectedSources = (
        event
    ) => {
        const value =
            event.target.value;

        setSelectedSourceIds(
            typeof value ===
                "string"
                ? value
                    .split(",")
                    .filter(Boolean)
                : value.map(String)
        );
    };

    const confirmStoreReview =
        async () => {
            if (!requisition?.id) {
                setError(
                    "Requisition data is unavailable."
                );

                return;
            }

            if (!hasValidRowVersion) {
                setError(
                    "Requisition row version is missing. Refresh the page and retry."
                );

                return;
            }

            if (!canConfirmStoreReview) {
                setError(
                    `Requisition status ${readable(
                        requisition.status
                    )} cannot be reviewed again.`
                );

                return;
            }

            const body = {
                rowVersion:
                    requisition.rowVersion,

                /*
                 * Empty means automatic location ranking.
                 * Selected IDs are treated as preferred priority.
                 */
                preferredSourceLocationIds:
                    selectedSourceIds,

                remarks:
                    clean(remarks) ||
                    null,
            };

            setPlanning(true);
            setError("");

            try {
                const response =
                    await matflowApi
                        .submitStoreReview(
                            requisition.id,
                            body
                        );

                if (
                    response?.data
                        ?.requisition
                ) {
                    setSnapshot(
                        response.data
                    );

                    /*
                     * Stock balances and availability change after
                     * reservation, so reload the complete workbench.
                     */
                    await load();
                } else {
                    await load();
                }

                setRemarks("");
                setSelectedSourceIds([]);
            } catch (requestError) {
                setError(
                    readMatFlowError(
                        requestError,
                        "Unable to confirm the Store review and reserve materials."
                    )
                );
            } finally {
                setPlanning(false);
            }
        };

    const issueReservation =
        async (
            reservation
        ) => {
            if (!reservation?.id) {
                return;
            }

            const remainingQty =
                numeric(
                    reservation
                        .remainingIssueQty ??
                    reservation
                        .reservedQty
                );

            if (remainingQty <= 0) {
                setError(
                    "This reservation has no remaining quantity to issue."
                );

                return;
            }

            setIssuingReservationId(
                reservation.id
            );

            setError("");

            try {
                const response =
                    await matflowApi
                        .issueStoreReservation(
                            reservation.id,
                            {
                                rowVersion:
                                    reservation
                                        .rowVersion,

                                quantity:
                                    remainingQty,

                                batchNo:
                                    null,

                                remarks:
                                    "Issued by Store against the material requisition.",
                            }
                        );

                if (
                    response?.data
                        ?.requisition
                ) {
                    setSnapshot(
                        response.data
                    );
                }

                await load();
            } catch (
            requestError
            ) {
                setError(
                    readMatFlowError(
                        requestError,
                        "Unable to issue material to Production."
                    )
                );
            } finally {
                setIssuingReservationId(
                    ""
                );
            }
        };

    const submitIndentToPurchase =
        async (
            indent
        ) => {
            if (!indent?.id) {
                return;
            }

            setSubmittingIndentId(
                indent.id
            );

            setError("");

            try {
                await matflowApi
                    .submitIndent(
                        indent.id,
                        {
                            rowVersion:
                                indent.rowVersion,

                            remarks:
                                "Shortage confirmed by Store and submitted to Purchase.",
                        }
                    );

                await load();
            } catch (
            requestError
            ) {
                setError(
                    readMatFlowError(
                        requestError,
                        "Unable to submit the shortage indent to Purchase."
                    )
                );
            } finally {
                setSubmittingIndentId(
                    ""
                );
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
                            label="STORE PLANNING WORKBENCH"
                            sx={heroBadgeSx}
                        />

                        <Typography sx={heroTitleSx}>
                            {requisition?.requisitionNumber ||
                                "Material Requisition"}
                        </Typography>

                        <Typography sx={heroSubSx}>
                            {requisition?.projectCode ||
                                "-"}
                            {" · "}
                            {requisition?.drawingNo ||
                                "-"}
                            {" · "}
                            {requisition?.destinationLocationCode ||
                                "-"}
                            {" · "}
                            {requisition?.destinationPlantCode ||
                                "-"}
                        </Typography>
                    </Box>

                    <Box sx={headerActionsSx}>
                        <Button
                            startIcon={
                                <RefreshOutlinedIcon />
                            }
                            onClick={load}
                            disabled={
                                planning
                            }
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
                                    "/matflow/store"
                                )
                            }
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

            <Box sx={kpiGridSx}>
                <Kpi
                    label="Material Lines"
                    value={lines.length}
                    color="#2563eb"
                    icon={
                        <Inventory2OutlinedIcon />
                    }
                />

                <Kpi
                    label="Requested"
                    value={formatQty(
                        totals.requested
                    )}
                    color="#0284c7"
                />

                <Kpi
                    label="Reserved"
                    value={formatQty(
                        totals.reserved
                    )}
                    color="#16a34a"
                />

                <Kpi
                    label="Shortage"
                    value={formatQty(
                        totals.shortage
                    )}
                    color="#dc2626"
                    icon={
                        <WarningAmberOutlinedIcon />
                    }
                />

                <Kpi
                    label="Transfers"
                    value={
                        transfers.length
                    }
                    color="#7c3aed"
                    icon={
                        <LocalShippingOutlinedIcon />
                    }
                />

                <Kpi
                    label="Indents"
                    value={indents.length}
                    color="#d97706"
                />
            </Box>

            <Card sx={panelSx}>
                <Box sx={planningHeaderSx}>
                    <Box>
                        <Typography sx={sectionTitleSx}>
                            Store Planning Action
                        </Typography>

                        <Typography sx={sectionSubSx}>
                            MatFlow will check available
                            stock, create reservations,
                            generate transfers for remote
                            stock and create shortage
                            indents where required.
                        </Typography>
                    </Box>

                    <Chip
                        label={readable(
                            requisition?.status
                        )}
                        sx={headerStatusChipSx(
                            status
                        )}
                    />
                </Box>

                <Box sx={planningFormSx}>
                    <TextField
                        select
                        label="Preferred Source Priority"
                        value={
                            selectedSourceIds
                        }
                        disabled={
                            planning ||
                            !canConfirmStoreReview
                        }
                        onChange={
                            updateSelectedSources
                        }
                        helperText={
                            sourceOptions.length ===
                                0
                                ? "No eligible stock-supporting source locations are configured."
                                : "Leave blank for automatic source selection. Selected locations are tried first."
                        }
                        SelectProps={{
                            multiple: true,

                            renderValue:
                                (selected) => {
                                    if (
                                        selected.length ===
                                        0
                                    ) {
                                        return "Automatic Selection";
                                    }

                                    return selected
                                        .map(
                                            (id) =>
                                                sourceOptions.find(
                                                    (location) =>
                                                        String(
                                                            location.id
                                                        ) ===
                                                        String(
                                                            id
                                                        )
                                                )
                                                    ?.locationCode ||
                                                id
                                        )
                                        .join(
                                            " → "
                                        );
                                },
                        }}
                        sx={fieldSx}
                    >
                        {sourceOptions.map(
                            (location) => (
                                <MenuItem
                                    key={
                                        location.id
                                    }
                                    value={String(
                                        location.id
                                    )}
                                >
                                    <Checkbox
                                        checked={selectedSourceIds.includes(
                                            String(
                                                location.id
                                            )
                                        )}
                                    />

                                    <ListItemText
                                        primary={`${location.locationCode} · ${location.locationName}`}
                                        secondary={`${location.plantCode} · ${readable(
                                            location.locationType
                                        )}`}
                                    />
                                </MenuItem>
                            )
                        )}
                    </TextField>

                    <TextField
                        label="Store Review Remarks"
                        value={remarks}
                        disabled={
                            planning ||
                            !canConfirmStoreReview
                        }
                        onChange={(event) =>
                            setRemarks(
                                event.target.value
                            )
                        }
                        multiline
                        minRows={3}
                        sx={fieldSx}
                    />
                </Box>

                <Box sx={planningActionSx}>
                    {!canConfirmStoreReview && (
                        <Typography sx={disabledNoteSx}>
                            {storeReviewCompleted
                                ? "Store review is already completed. Use the generated reservation, transfer and indent actions below."
                                : "This requisition cannot be reviewed in its current status."}
                        </Typography>
                    )}

                    {canConfirmStoreReview && (
                        <Button
                            startIcon={
                                <AutoFixHighOutlinedIcon />
                            }
                            onClick={
                                confirmStoreReview
                            }
                            disabled={
                                planning
                            }
                            sx={primaryBtnSx}
                        >
                            {planning
                                ? "Reserving Materials..."
                                : "Confirm Store Review & Reserve"}
                        </Button>
                    )}
                </Box>
            </Card>

            <Card sx={panelSx}>
                <Box sx={sectionHeaderSx}>
                    <Box>
                        <Typography sx={sectionTitleSx}>
                            Store Material Review
                        </Typography>

                        <Typography sx={sectionSubSx}>
                            Review actual stock availability for every requested
                            material. On confirmation, MatFlow reserves available
                            stock, creates transfers where movement is required,
                            and creates shortage indents for unavailable quantities.
                        </Typography>
                    </Box>
                </Box>

                <Box sx={tableShellSx}>
                    <Box sx={materialHeaderSx}>
                        <Box sx={tableCellSx}>
                            Material
                        </Box>

                        <Box sx={tableCellSx}>
                            Category
                        </Box>

                        <Box sx={tableCellSx}>
                            BOM Qty
                        </Box>

                        <Box sx={tableCellSx}>
                            Requested
                        </Box>

                        <Box sx={tableCellSx}>
                            Available Stock
                        </Box>

                        <Box sx={tableCellSx}>
                            Approved Route
                        </Box>

                        <Box sx={tableCellSx}>
                            Reserved
                        </Box>

                        <Box sx={tableCellSx}>
                            Shortage
                        </Box>

                        <Box sx={tableCellSx}>
                            Issued
                        </Box>

                        <Box sx={tableCellSx}>
                            Coverage
                        </Box>

                        <Box sx={tableCellSx}>
                            Status
                        </Box>

                        <Box sx={tableCellSx}>
                            Responsible / Next Action
                        </Box>
                    </Box>

                    {lines.length === 0 ? (
                        <Box sx={emptySx}>
                            This requisition contains no
                            material lines.
                        </Box>
                    ) : (
                        lines.map(
                            (line) => {
                                const meta =
                                    lineStatus(
                                        line
                                    );

                                const progress =
                                    lineProgress(
                                        line
                                    );

                                const availabilityEntry =
                                    availabilityByLineId.get(
                                        String(line.id)
                                    );

                                const workflow =
                                    resolveLineWorkflow(
                                        line,
                                        reservations,
                                        transfers,
                                        indents
                                    );

                                const stockOptions =
                                    asArray(
                                        availabilityEntry?.stockOptions
                                    );

                                const totalAvailable =
                                    stockOptions.reduce(
                                        (sum, option) =>
                                            sum +
                                            numeric(
                                                option.availableQty
                                            ),
                                        0
                                    );

                                return (
                                    <Box
                                        key={
                                            line.id
                                        }
                                        sx={materialRowSx}
                                    >
                                        <Box sx={tableCellSx}>
                                            <Typography sx={mainTextSx}>
                                                {line.materialName ||
                                                    "-"}
                                            </Typography>

                                            <Typography sx={subTextSx}>
                                                {line.materialCode ||
                                                    "-"}
                                                {" · "}
                                                {line.uom ||
                                                    "-"}
                                            </Typography>
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            {readable(
                                                line.materialCategory
                                            ) ||
                                                "-"}
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            {formatQty(
                                                line.bomRequiredQty
                                            )}
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            {formatQty(
                                                line.requestedQty
                                            )}
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Typography sx={availableTotalSx}>
                                                {formatQty(
                                                    totalAvailable
                                                )}
                                                {" "}
                                                {line.uom || ""}
                                            </Typography>

                                            {stockOptions.length === 0 ? (
                                                <Typography sx={subTextSx}>
                                                    No available stock
                                                </Typography>
                                            ) : (
                                                <Box sx={stockOptionListSx}>
                                                    {stockOptions
                                                        .filter(
                                                            (option) =>
                                                                numeric(
                                                                    option.availableQty
                                                                ) > 0
                                                        )
                                                        .slice(0, 3)
                                                        .map(
                                                            (option) => (
                                                                <Typography
                                                                    key={
                                                                        option.locationId
                                                                    }
                                                                    sx={stockOptionTextSx}
                                                                >
                                                                    {option.locationCode}
                                                                    {": "}
                                                                    {formatQty(
                                                                        option.availableQty
                                                                    )}
                                                                </Typography>
                                                            )
                                                        )}
                                                </Box>
                                            )}
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Typography sx={routeTextSx}>
                                                {availabilityEntry
                                                    ?.approvedRoute ||
                                                    requisition
                                                        ?.destinationLocationCode ||
                                                    "-"}
                                            </Typography>

                                            <Typography sx={subTextSx}>
                                                First destination:{" "}
                                                {availabilityEntry
                                                    ?.firstDestinationLocationCode ||
                                                    requisition
                                                        ?.destinationLocationCode ||
                                                    "-"}
                                            </Typography>
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Typography sx={reservedQtySx}>
                                                {formatQty(
                                                    line.reservedQty
                                                )}
                                            </Typography>
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Typography
                                                sx={
                                                    numeric(
                                                        line.shortageQty
                                                    ) >
                                                        0
                                                        ? shortageQtySx
                                                        : normalQtySx
                                                }
                                            >
                                                {formatQty(
                                                    line.shortageQty
                                                )}
                                            </Typography>
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            {formatQty(
                                                line.issuedQty
                                            )}
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Box sx={progressHeadSx}>
                                                <Typography sx={progressTextSx}>
                                                    {progress}%
                                                </Typography>
                                            </Box>

                                            <LinearProgress
                                                variant="determinate"
                                                value={
                                                    progress
                                                }
                                                sx={progressBarSx(
                                                    meta.color
                                                )}
                                            />
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Chip
                                                label={
                                                    meta.label
                                                }
                                                size="small"
                                                sx={statusChipSx(
                                                    meta.color
                                                )}
                                            />
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Box sx={departmentBoxSx}>
                                                <Typography sx={departmentNameSx}>
                                                    {workflow.department}
                                                </Typography>

                                                <Typography sx={nextActionSx}>
                                                    {workflow.action}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Box>
                                );
                            }
                        )
                    )}
                </Box>
            </Card>

            <PlanningResults
                reservations={reservations}
                indents={indents}
                transfers={transfers}

                issuingReservationId={
                    issuingReservationId
                }

                submittingIndentId={
                    submittingIndentId
                }

                onIssueReservation={
                    issueReservation
                }

                onSubmitIndent={
                    submitIndentToPurchase
                }

                onOpenTransfer={(
                    transfer
                ) =>
                    navigate(
                        `/matflow/transfers/${transfer.id}`
                    )
                }
            />
        </Box>
    );
}

function PlanningResults({
    reservations,
    indents,
    transfers,
    issuingReservationId,
    submittingIndentId,
    onIssueReservation,
    onSubmitIndent,
    onOpenTransfer,
}) {
    return (
        <Box sx={resultsGridSx}>
            <Card sx={panelSx}>
                <Typography sx={sectionTitleSx}>
                    Reservations
                </Typography>

                <Typography sx={sectionSubSx}>
                    Stock committed to this
                    requisition and its current
                    fulfilment action.
                </Typography>

                <Box sx={resultListSx}>
                    {reservations.length === 0 ? (
                        <Box sx={smallEmptySx}>
                            No reservations created.
                        </Box>
                    ) : (
                        reservations.map(
                            (reservation) => {
                                const remainingQty =
                                    numeric(
                                        reservation
                                            .remainingIssueQty
                                    );

                                const canIssue =
                                    reservation.issueReady ===
                                    true &&
                                    remainingQty > 0 &&
                                    [
                                        "ACTIVE",
                                        "PARTIALLY_ISSUED",
                                    ].includes(
                                        normalize(
                                            reservation.status
                                        )
                                    );

                                return (
                                    <Box
                                        key={
                                            reservation.id
                                        }
                                        sx={reservationRowSx}
                                    >
                                        <Box sx={reservationMainSx}>
                                            <Typography sx={resultMainSx}>
                                                {reservation.materialCode ||
                                                    "-"}
                                            </Typography>

                                            <Typography sx={resultSubSx}>
                                                {reservation.sourceLocationCode ||
                                                    "-"}
                                                {" → "}
                                                {reservation.firstDestinationLocationCode ||
                                                    "-"}
                                            </Typography>

                                            <Typography sx={resultSubSx}>
                                                Reserved:{" "}
                                                {formatQty(
                                                    reservation.reservedQty
                                                )}
                                                {" · Issued: "}
                                                {formatQty(
                                                    reservation.issuedQty
                                                )}
                                                {" · Remaining: "}
                                                {formatQty(
                                                    reservation.remainingIssueQty
                                                )}
                                            </Typography>
                                        </Box>

                                        {canIssue ? (
                                            <Button
                                                startIcon={
                                                    <OutputOutlinedIcon />
                                                }
                                                onClick={() =>
                                                    onIssueReservation(
                                                        reservation
                                                    )
                                                }
                                                disabled={
                                                    issuingReservationId ===
                                                    reservation.id
                                                }
                                                sx={miniPrimarySx}
                                            >
                                                {issuingReservationId ===
                                                    reservation.id
                                                    ? "Issuing..."
                                                    : "Issue to Production"}
                                            </Button>
                                        ) : (
                                            <Box sx={departmentBoxSx}>
                                                <Typography sx={departmentNameSx}>
                                                    {readable(
                                                        reservation
                                                            .responsibleDepartment ||
                                                        "Store"
                                                    )}
                                                </Typography>

                                                <Typography sx={nextActionSx}>
                                                    {readable(
                                                        reservation
                                                            .nextAction ||
                                                        reservation.status
                                                    )}
                                                </Typography>
                                            </Box>
                                        )}
                                    </Box>
                                );
                            }
                        )
                    )}
                </Box>
            </Card>

            <Card sx={panelSx}>
                <Typography sx={sectionTitleSx}>
                    Transfers
                </Typography>

                <Typography sx={sectionSubSx}>
                    Physical movements generated from
                    reserved stock and approved BOM routes.
                </Typography>

                <Box sx={resultListSx}>
                    {transfers.length === 0 ? (
                        <Box sx={smallEmptySx}>
                            No transfer is required or
                            the material is already at
                            the Production destination.
                        </Box>
                    ) : (
                        transfers.map(
                            (transfer) => (
                                <Box
                                    key={transfer.id}
                                    sx={transferResultRowSx}
                                >
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography sx={resultMainSx}>
                                            {transfer.transferNumber ||
                                                "-"}
                                        </Typography>

                                        <Typography sx={resultSubSx}>
                                            {transfer.fromLocationCode ||
                                                "-"}
                                            {" → "}
                                            {transfer.toLocationCode ||
                                                "-"}
                                        </Typography>

                                        <Typography sx={resultSubSx}>
                                            Responsible:{" "}
                                            {readable(
                                                transfer
                                                    .responsibleDepartment ||
                                                "Store"
                                            )}
                                            {" · "}
                                            {readable(
                                                transfer.nextAction ||
                                                transfer.status
                                            )}
                                        </Typography>
                                    </Box>

                                    <Typography sx={resultQtySx}>
                                        {formatQty(
                                            transfer.plannedQty
                                        )}
                                        {" "}
                                        {transfer.uom || ""}
                                    </Typography>

                                    <Button
                                        onClick={() =>
                                            onOpenTransfer(
                                                transfer
                                            )
                                        }
                                        sx={miniPrimarySx}
                                    >
                                        Open
                                    </Button>
                                </Box>
                            )
                        )
                    )}
                </Box>
            </Card>

            <Card sx={panelSx}>
                <Typography sx={sectionTitleSx}>
                    Shortage Indents
                </Typography>

                <Typography sx={sectionSubSx}>
                    Shortage demand requiring Store
                    confirmation and Purchase action.
                </Typography>

                <Box sx={resultListSx}>
                    {indents.length === 0 ? (
                        <Box sx={smallEmptySx}>
                            No shortage indent created.
                        </Box>
                    ) : (
                        indents.map(
                            (indent) => {
                                const indentStatus =
                                    normalize(
                                        indent.status
                                    );

                                const canSubmitToPurchase =
                                    [
                                        "AUTO_CREATED",
                                        "DRAFT",
                                        "RETURNED",
                                    ].includes(
                                        indentStatus
                                    );

                                const responsibleDepartment =
                                    canSubmitToPurchase
                                        ? "Store"
                                        : [
                                            "SUBMITTED_TO_PURCHASE",
                                            "PURCHASE_IN_PROGRESS",
                                            "PO_CREATED",
                                            "PARTIALLY_RECEIVED",
                                        ].includes(
                                            indentStatus
                                        )
                                            ? "Purchase"
                                            : readable(
                                                indentStatus
                                            );

                                return (
                                    <Box
                                        key={indent.id}
                                        sx={indentBoxSx}
                                    >
                                        <Box sx={indentHeaderSx}>
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography sx={resultMainSx}>
                                                    {indent.indentNumber ||
                                                        "-"}
                                                </Typography>

                                                <Typography sx={resultSubSx}>
                                                    Responsible:{" "}
                                                    {responsibleDepartment}
                                                </Typography>

                                                <Typography sx={resultSubSx}>
                                                    Status:{" "}
                                                    {readable(
                                                        indent.status
                                                    )}
                                                </Typography>
                                            </Box>

                                            {canSubmitToPurchase ? (
                                                <Button
                                                    onClick={() =>
                                                        onSubmitIndent(
                                                            indent
                                                        )
                                                    }
                                                    disabled={
                                                        submittingIndentId ===
                                                        indent.id
                                                    }
                                                    sx={miniPurchaseBtnSx}
                                                >
                                                    {submittingIndentId ===
                                                        indent.id
                                                        ? "Submitting..."
                                                        : "Submit to Purchase"}
                                                </Button>
                                            ) : (
                                                <Chip
                                                    label={readable(
                                                        indent.status
                                                    )}
                                                    size="small"
                                                    sx={smallStatusSx}
                                                />
                                            )}
                                        </Box>

                                        {asArray(
                                            indent.lines
                                        ).map(
                                            (line) => (
                                                <Box
                                                    key={line.id}
                                                    sx={indentLineSx}
                                                >
                                                    <Box>
                                                        <Typography sx={resultMainSx}>
                                                            {line.materialName ||
                                                                line.materialCode ||
                                                                "-"}
                                                        </Typography>

                                                        <Typography sx={resultSubSx}>
                                                            {line.materialCode ||
                                                                "-"}
                                                        </Typography>
                                                    </Box>

                                                    <Typography sx={resultQtySx}>
                                                        {formatQty(
                                                            line.requiredQty
                                                        )}
                                                        {" "}
                                                        {line.uom || ""}
                                                    </Typography>
                                                </Box>
                                            )
                                        )}
                                    </Box>
                                );
                            }
                        )
                    )}
                </Box>
            </Card>
        </Box>
    );
}

function Kpi({
    label,
    value,
    color,
    icon,
}) {
    return (
        <Card
            sx={{
                ...kpiCardSx,
                borderTop:
                    `3px solid ${color}`,
            }}
        >
            {icon && (
                <Box
                    sx={{
                        ...kpiIconSx,
                        color,
                        background:
                            `${color}14`,
                        border:
                            `1px solid ${color}30`,
                    }}
                >
                    {icon}
                </Box>
            )}

            <Box>
                <Typography sx={kpiLabelSx}>
                    {label}
                </Typography>

                <Typography sx={kpiValueSx}>
                    {value}
                </Typography>
            </Box>
        </Card>
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

const kpiGridSx = {
    display: "grid",
    gridTemplateColumns:
        "repeat(6,minmax(0,1fr))",
    gap: "10px",

    "@media (max-width: 1150px)": {
        gridTemplateColumns:
            "repeat(3,minmax(0,1fr))",
    },

    "@media (max-width: 650px)": {
        gridTemplateColumns:
            "1fr",
    },
};

const kpiCardSx = {
    ...panelSx,
    minHeight: "86px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
};

const kpiIconSx = {
    width: "38px",
    height: "38px",
    display: "grid",
    placeItems: "center",
    borderRadius: "10px",
    flexShrink: 0,
};

const kpiLabelSx = {
    color:
        "var(--mf-text-muted)",
    fontSize: "9px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".05em",
};

const kpiValueSx = {
    mt: "4px",
    color:
        "var(--mf-text)",
    fontSize: "21px",
    fontWeight: 950,
};

const planningHeaderSx = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
};

const planningFormSx = {
    mt: "15px",
    display: "grid",
    gridTemplateColumns:
        "minmax(0,1.2fr) minmax(0,1fr)",
    gap: "12px",

    "@media (max-width: 760px)": {
        gridTemplateColumns:
            "1fr",
    },
};

const planningActionSx = {
    mt: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "10px",
    flexWrap: "wrap",
};

const disabledNoteSx = {
    color:
        "var(--mf-text-muted)",
    fontSize: "10px",
    fontWeight: 700,
};

const sectionHeaderSx = {
    display: "flex",
    justifyContent: "space-between",
    mb: "12px",
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
    fontSize: "10.5px",
    fontWeight: 650,
    lineHeight: 1.45,
};

const headerStatusChipSx = (
    status
) => {
    const color =
        status ===
            "SHORTAGE_PENDING"
            ? "#dc2626"
            : status ===
                "PLANNED"
                ? "#16a34a"
                : "#2563eb";

    return {
        color,
        background:
            `${color}14`,
        border:
            `1px solid ${color}32`,
        fontSize: "9px",
        fontWeight: 900,
    };
};

const materialColumns =
    "minmax(230px,1.4fr) 130px 90px 90px minmax(220px,1.2fr) minmax(180px,1fr) 90px 90px 90px 140px 145px 180px";

const materialHeaderSx = {
    ...tableHeaderSx,
    gridTemplateColumns:
        materialColumns,
    minWidth: "1740px",
};

const materialRowSx = {
    ...tableRowSx,
    gridTemplateColumns:
        materialColumns,
    minWidth: "1740px",
};

const departmentNameSx = {
    color: "#7c3aed",
    fontSize: "8px",
    fontWeight: 950,
    textTransform: "uppercase",
};

const nextActionSx = {
    mt: "2px",
    color:
        "var(--mf-text-muted)",
    fontSize: "8px",
    fontWeight: 700,
};

const mainTextSx = {
    color:
        "var(--mf-text)",
    fontSize: "11.5px",
    fontWeight: 850,
};

const subTextSx = {
    mt: "2px",
    color:
        "var(--mf-text-muted)",
    fontSize: "9px",
    fontWeight: 650,
};

const reservedQtySx = {
    color: "#16a34a",
    fontWeight: 900,
};

const shortageQtySx = {
    color: "#dc2626",
    fontWeight: 900,
};

const normalQtySx = {
    color:
        "var(--mf-text-secondary)",
    fontWeight: 800,
};

const availableTotalSx = {
    color: "#16a34a",
    fontSize: "11px",
    fontWeight: 950,
};

const stockOptionListSx = {
    mt: "3px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
};

const stockOptionTextSx = {
    color:
        "var(--mf-text-muted)",
    fontSize: "8.5px",
    fontWeight: 700,
};

const routeTextSx = {
    color: "#7c3aed",
    fontSize: "9.5px",
    fontWeight: 850,
    lineHeight: 1.4,
};

const progressHeadSx = {
    display: "flex",
    justifyContent: "flex-end",
};

const miniPurchaseBtnSx = {
    minWidth: "110px",
    height: "28px",
    borderRadius: "8px",
    textTransform: "none",
    color: "#fff",
    background: "#d97706",
    fontSize: "8px",
    fontWeight: 900,

    "&:hover": {
        background: "#b45309",
    },
};

const progressTextSx = {
    color:
        "var(--mf-text-secondary)",
    fontSize: "8px",
    fontWeight: 900,
};

const progressBarSx = (
    color
) => ({
    mt: "5px",
    height: "6px",
    borderRadius: 999,
    background:
        "var(--mf-surface-strong)",

    "& .MuiLinearProgress-bar": {
        backgroundColor:
            color,
        borderRadius: 999,
    },
});

const statusChipSx = (
    color
) => ({
    height: "23px",
    color,
    background:
        `${color}14`,
    border:
        `1px solid ${color}32`,
    fontSize: "8px",
    fontWeight: 900,
});

const reservationRowSx = {
    p: "10px",
    display: "grid",
    gridTemplateColumns:
        "minmax(0,1fr) auto",
    alignItems: "center",
    gap: "10px",
    borderRadius: "9px",
    background:
        "var(--mf-surface-soft)",
    border:
        "1px solid var(--mf-border)",
};

const reservationMainSx = {
    minWidth: 0,
};

const transferResultRowSx = {
    p: "9px",
    display: "grid",
    gridTemplateColumns:
        "minmax(0,1fr) auto auto",
    alignItems: "center",
    gap: "8px",
    borderRadius: "9px",
    background:
        "var(--mf-surface-soft)",
    border:
        "1px solid var(--mf-border)",
};

const resultsGridSx = {
    display: "grid",
    gridTemplateColumns:
        "repeat(3,minmax(0,1fr))",
    gap: "10px",

    "@media (max-width: 1000px)": {
        gridTemplateColumns:
            "1fr",
    },
};

const resultListSx = {
    mt: "13px",
    display: "flex",
    flexDirection: "column",
    gap: "7px",
};

const resultRowSx = {
    p: "9px",
    display: "grid",
    gridTemplateColumns:
        "minmax(0,1fr) auto auto",
    alignItems: "center",
    gap: "8px",
    borderRadius: "9px",
    background:
        "var(--mf-surface-soft)",
    border:
        "1px solid var(--mf-border)",
};

const resultMainSx = {
    color:
        "var(--mf-text)",
    fontSize: "10.5px",
    fontWeight: 900,
};

const resultSubSx = {
    mt: "2px",
    color:
        "var(--mf-text-muted)",
    fontSize: "8.5px",
    fontWeight: 650,
};

const resultQtySx = {
    color:
        "var(--mf-text)",
    fontSize: "10px",
    fontWeight: 900,
};

const miniPrimarySx = {
    minWidth: "60px",
    height: "28px",
    borderRadius: "8px",
    textTransform: "none",
    color: "#fff",
    background: "#0284c7",
    fontSize: "8px",
    fontWeight: 900,
};

const smallStatusSx = {
    height: "22px",
    color: "#0284c7",
    background:
        "rgba(2,132,199,.10)",
    border:
        "1px solid rgba(2,132,199,.22)",
    fontSize: "8px",
    fontWeight: 900,
};

const indentBoxSx = {
    p: "9px",
    borderRadius: "9px",
    background:
        "var(--mf-surface-soft)",
    border:
        "1px solid var(--mf-border)",
};

const indentHeaderSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
};

const indentLineSx = {
    mt: "6px",
    display: "flex",
    justifyContent: "space-between",
    gap: "8px",
};

const smallEmptySx = {
    p: "18px",
    textAlign: "center",
    color:
        "var(--mf-text-muted)",
    fontSize: "9.5px",
    borderRadius: "9px",
    border:
        "1px dashed var(--mf-border)",
};

const emptySx = {
    minHeight: "170px",
    display: "grid",
    placeItems: "center",
    color:
        "var(--mf-text-muted)",
    fontSize: "11px",
};