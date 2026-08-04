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
    LinearProgress,
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
        String(
            line?.id ??
            ""
        );

    const requested =
        numeric(
            line?.requestedQty
        );

    const issued =
        numeric(
            line?.issuedQty
        );

    const consumed =
        numeric(
            line?.consumedQty
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
        consumed >= requested
    ) {
        return {
            department:
                "Production",

            action:
                "Material Consumed",
        };
    }

    if (
        requested > 0 &&
        issued >= requested
    ) {
        return {
            department:
                "Production",

            action:
                "Start / Continue Production",
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

    const readyReservation =
        relatedReservations.find(
            (reservation) =>
                reservation.issueReady ===
                true &&
                numeric(
                    reservation
                        .remainingIssueQty
                ) > 0 &&
                [
                    "ACTIVE",
                    "PARTIALLY_ISSUED",
                ].includes(
                    normalize(
                        reservation.status
                    )
                )
        );

    if (readyReservation) {
        return {
            department:
                readable(
                    readyReservation
                        .responsibleDepartment ||
                    "STORE"
                ),

            action:
                readable(
                    readyReservation
                        .nextAction ||
                    "ISSUE_TO_PRODUCTION"
                ),
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

    const activeTransfer =
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

    if (activeTransfer) {
        return {
            department:
                readable(
                    activeTransfer
                        .responsibleDepartment ||
                    (
                        normalize(
                            activeTransfer.status
                        ) === "IN_TRANSIT"
                            ? "DESTINATION"
                            : "STORE"
                    )
                ),

            action:
                readable(
                    activeTransfer
                        .nextAction ||
                    activeTransfer.status
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

        switch (indentStatus) {
            case "AUTO_CREATED":
            case "DRAFT":
            case "RETURNED":
                return {
                    department:
                        "Store",

                    action:
                        "Submit Indent to Purchase",
                };

            case "SUBMITTED_TO_PURCHASE":
                return {
                    department:
                        "Purchase",

                    action:
                        "Review Material Indent",
                };

            case "PURCHASE_IN_PROGRESS":
                return {
                    department:
                        "Purchase",

                    action:
                        "Create Purchase Order",
                };

            case "PO_CREATED":
            case "ORDERED":
                return {
                    department:
                        "Purchase",

                    action:
                        "Await Supplier Delivery",
                };

            case "PARTIALLY_RECEIVED":
                return {
                    department:
                        "Store / QC",

                    action:
                        "Complete Receipt and QC",
                };

            case "RECEIVED":
            case "QC_PENDING":
                return {
                    department:
                        "QC",

                    action:
                        "Inspect Received Material",
                };

            case "QC_ACCEPTED":
                return {
                    department:
                        "Store",

                    action:
                        "Reserve Accepted Stock",
                };

            default:
                return {
                    department:
                        readable(
                            indentStatus
                        ),

                    action:
                        "Continue Procurement Workflow",
                };
        }
    }

    if (shortage > 0) {
        return {
            department:
                "Store",

            action:
                "Create / Submit Shortage Indent",
        };
    }

    if (reserved > 0) {
        return {
            department:
                "Transfer / Processing",

            action:
                "Complete Approved Material Route",
        };
    }

    return {
        department:
            "Store",

        action:
            "Review Material Availability",
    };
};

const roundQty = (value) =>
    Math.round(
        numeric(value) * 1000
    ) / 1000;

const qtyEquals = (
    left,
    right
) =>
    Math.abs(
        roundQty(left) -
        roundQty(right)
    ) < 0.0005;

const decisionFromAllocation = (
    requestedQty,
    allocatedQty
) => {
    const requested =
        roundQty(
            requestedQty
        );

    const allocated =
        roundQty(
            allocatedQty
        );

    if (requested <= 0) {
        return "UNDECIDED";
    }

    if (
        allocated >= requested
    ) {
        return "AVAILABLE";
    }

    if (allocated > 0) {
        return "PARTIAL";
    }

    return "SHORTAGE";
};

const buildAutomaticAllocation = (
    line,
    availabilityEntry
) => {
    const requestedQty =
        roundQty(
            line?.requestedQty
        );

    let remainingQty =
        requestedQty;

    const allocationQuantities =
        {};

    const stockOptions =
        asArray(
            availabilityEntry
                ?.stockOptions
        )
            .filter(
                (option) =>
                    option?.locationId &&
                    numeric(
                        option.availableQty
                    ) > 0
            );

    for (
        const option
        of stockOptions
    ) {
        if (
            remainingQty <= 0
        ) {
            break;
        }

        const locationId =
            String(
                option.locationId
            );

        const availableQty =
            roundQty(
                option.availableQty
            );

        const reserveQty =
            roundQty(
                Math.min(
                    availableQty,
                    remainingQty
                )
            );

        if (reserveQty <= 0) {
            continue;
        }

        allocationQuantities[
            locationId
        ] =
            reserveQty;

        remainingQty =
            roundQty(
                Math.max(
                    0,
                    remainingQty -
                    reserveQty
                )
            );
    }

    const allocatedQty =
        roundQty(
            requestedQty -
            remainingQty
        );

    return {
        allocationQuantities,

        allocatedQty,

        shortageQty:
            remainingQty,

        decision:
            decisionFromAllocation(
                requestedQty,
                allocatedQty
            ),
    };
};

const deriveStoreDecision = (
    line
) => {
    const requested =
        roundQty(
            line?.requestedQty
        );

    const reserved =
        roundQty(
            line?.reservedQty
        );

    const shortage =
        roundQty(
            line?.shortageQty
        );

    if (requested <= 0) {
        return "UNDECIDED";
    }

    if (
        reserved >= requested &&
        shortage <= 0
    ) {
        return "AVAILABLE";
    }

    if (
        reserved > 0 &&
        shortage > 0
    ) {
        return "PARTIAL";
    }

    if (
        reserved <= 0 &&
        shortage > 0
    ) {
        return "SHORTAGE";
    }

    return "UNDECIDED";
};

const storeDecisionMeta = (
    value
) => {
    switch (normalize(value)) {
        case "AVAILABLE":
            return {
                label:
                    "Available / Reserved",
                color:
                    "#16a34a",
            };

        case "PARTIAL":
            return {
                label:
                    "Partially Available",
                color:
                    "#d97706",
            };

        case "SHORTAGE":
            return {
                label:
                    "Shortage Confirmed",
                color:
                    "#dc2626",
            };

        default:
            return {
                label:
                    "Awaiting Store Review",
                color:
                    "#2563eb",
            };
    }
};

const storeDecisionChipSx = (
    color
) => ({
    height: "25px",
    maxWidth: "100%",
    color,
    background:
        `${color}14`,
    border:
        `1px solid ${color}32`,
    fontSize: "8.5px",
    fontWeight: 900,
});

const summarizeReviewLine = (
    line,
    availabilityEntry,
    review
) => {
    const requestedQty =
        roundQty(
            line?.requestedQty
        );

    const stockOptions =
        asArray(
            availabilityEntry
                ?.stockOptions
        );

    const optionByLocation =
        new Map(
            stockOptions.map(
                (option) => [
                    String(
                        option.locationId
                    ),
                    option,
                ]
            )
        );

    const allocations =
        Object.entries(
            review
                ?.allocationQuantities ||
            {}
        )
            .map(
                ([
                    locationId,
                    rawQty,
                ]) => ({
                    locationId,

                    quantity:
                        roundQty(
                            rawQty
                        ),

                    option:
                        optionByLocation.get(
                            String(
                                locationId
                            )
                        ),
                })
            )
            .filter(
                (item) =>
                    item.quantity > 0
            );

    const allocatedQty =
        roundQty(
            allocations.reduce(
                (sum, item) =>
                    sum +
                    item.quantity,
                0
            )
        );

    const shortageQty =
        roundQty(
            Math.max(
                0,
                requestedQty -
                allocatedQty
            )
        );

    return {
        requestedQty,
        stockOptions,
        allocations,
        allocatedQty,
        shortageQty,
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
        availability,
        setAvailability,
    ] = useState([]);

    const [
        remarks,
        setRemarks,
    ] = useState("");

    const [
        reviewByLine,
        setReviewByLine,
    ] = useState({});

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

    const buildStoreReviewLines =
        () => {
            return lines.map(
                (line) => {
                    const lineId =
                        String(
                            line.id
                        );

                    const availabilityEntry =
                        availabilityByLineId.get(
                            lineId
                        );

                    const review =
                        reviewByLine[
                        lineId
                        ] || {
                            decision:
                                "UNDECIDED",

                            allocationQuantities:
                                {},

                            remarks:
                                "",
                        };

                    const decision =
                        normalize(
                            review.decision
                        );

                    if (
                        decision ===
                        "UNDECIDED"
                    ) {
                        throw new Error(
                            `Select Available, Partial or Shortage for material ${line.materialCode || line.materialName}.`
                        );
                    }

                    const summary =
                        summarizeReviewLine(
                            line,
                            availabilityEntry,
                            review
                        );

                    for (
                        const allocation
                        of summary.allocations
                    ) {
                        if (
                            !allocation.option
                        ) {
                            throw new Error(
                                `An invalid source location was selected for ${line.materialCode || line.materialName}.`
                            );
                        }

                        const availableQty =
                            roundQty(
                                allocation.option
                                    .availableQty
                            );

                        if (
                            allocation.quantity >
                            availableQty
                        ) {
                            throw new Error(
                                `${allocation.option.locationCode} has only ${formatQty(
                                    availableQty
                                )} ${line.uom || ""} available for ${line.materialCode || line.materialName}.`
                            );
                        }
                    }

                    if (
                        summary.allocatedQty >
                        summary.requestedQty
                    ) {
                        throw new Error(
                            `Allocated quantity exceeds requested quantity for ${line.materialCode || line.materialName}.`
                        );
                    }

                    const effectiveDecision =
                        decisionFromAllocation(
                            summary.requestedQty,
                            summary.allocatedQty
                        );

                    if (
                        decision ===
                        "UNDECIDED"
                    ) {
                        throw new Error(
                            `Review the stock position for ${line.materialCode || line.materialName}.`
                        );
                    }

                    if (
                        effectiveDecision ===
                        "SHORTAGE" &&
                        decision !==
                        "SHORTAGE"
                    ) {
                        throw new Error(
                            `No stock quantity has been allocated for ${line.materialCode || line.materialName}. Select Shortage or allocate recorded stock.`
                        );
                    }

                    return {
                        requisitionLineId:
                            line.id,

                        rowVersion:
                            line.rowVersion,

                        allocations:
                            summary.allocations.map(
                                (allocation) => ({
                                    sourceLocationId:
                                        allocation
                                            .option
                                            .locationId,

                                    reserveQty:
                                        allocation
                                            .quantity,
                                })
                            ),

                        processingRequired:
                            availabilityEntry
                                ?.processingRequired ===
                            true,

                        processingLocationId:
                            availabilityEntry
                                ?.processingRequired ===
                                true
                                ? availabilityEntry
                                    ?.firstProcessingLocationId ??
                                null
                                : null,

                        createIndentForShortage:
                            summary.shortageQty >
                            0,

                        remarks:
                            clean(
                                review.remarks
                            ) || null,
                    };
                }
            );
        };

    const updateLineDecision = (
        lineId,
        selectedDecision
    ) => {
        const lineKey =
            String(
                lineId
            );

        const normalizedDecision =
            normalize(
                selectedDecision
            );

        const line =
            lines.find(
                (item) =>
                    String(
                        item?.id ??
                        ""
                    ) ===
                    lineKey
            );

        const availabilityEntry =
            availabilityByLineId.get(
                lineKey
            );

        if (!line) {
            setError(
                "The selected requisition line is unavailable."
            );

            return;
        }

        if (
            normalizedDecision ===
            "UNDECIDED"
        ) {
            setReviewByLine(
                (current) => ({
                    ...current,

                    [lineKey]: {
                        ...(current[
                            lineKey
                        ] || {}),

                        decision:
                            "UNDECIDED",

                        allocationQuantities:
                            {},
                    },
                })
            );

            return;
        }

        if (
            normalizedDecision ===
            "SHORTAGE"
        ) {
            setReviewByLine(
                (current) => ({
                    ...current,

                    [lineKey]: {
                        ...(current[
                            lineKey
                        ] || {}),

                        decision:
                            "SHORTAGE",

                        allocationQuantities:
                            {},
                    },
                })
            );

            setError("");

            return;
        }

        const automatic =
            buildAutomaticAllocation(
                line,
                availabilityEntry
            );

        setReviewByLine(
            (current) => ({
                ...current,

                [lineKey]: {
                    ...(current[
                        lineKey
                    ] || {}),

                    /*
                     * The actual decision is derived from the
                     * quantity that can be reserved.
                     */
                    decision:
                        automatic
                            .decision,

                    allocationQuantities:
                        automatic
                            .allocationQuantities,
                },
            })
        );

        if (
            normalizedDecision ===
            "AVAILABLE" &&
            automatic.decision ===
            "PARTIAL"
        ) {
            setError(
                `${line.materialCode || line.materialName}: only ${formatQty(
                    automatic.allocatedQty
                )} of ${formatQty(
                    line.requestedQty
                )} is recorded as available. MatFlow changed this line to Partially Available and will create an indent for ${formatQty(
                    automatic.shortageQty
                )}.`
            );

            return;
        }

        if (
            automatic.decision ===
            "SHORTAGE"
        ) {
            setError(
                `${line.materialCode || line.materialName}: no recorded stock is available. MatFlow changed this line to Shortage.`
            );

            return;
        }

        setError("");
    };

    const updateAllocationQty = (
        lineId,
        locationId,
        value
    ) => {
        const lineKey =
            String(
                lineId
            );

        const locationKey =
            String(
                locationId
            );

        const line =
            lines.find(
                (item) =>
                    String(
                        item?.id ??
                        ""
                    ) ===
                    lineKey
            );

        const availabilityEntry =
            availabilityByLineId.get(
                lineKey
            );

        const option =
            asArray(
                availabilityEntry
                    ?.stockOptions
            ).find(
                (item) =>
                    String(
                        item?.locationId ??
                        ""
                    ) ===
                    locationKey
            );

        if (
            !line ||
            !option
        ) {
            return;
        }

        setReviewByLine(
            (current) => {
                const existing =
                    current[
                    lineKey
                    ] || {
                        decision:
                            "UNDECIDED",

                        allocationQuantities:
                            {},

                        remarks:
                            "",

                        routeMode:
                            "APPROVED_ROUTE",

                        processingLocationId:
                            "",
                    };

                const existingAllocations = {
                    ...existing
                        .allocationQuantities,
                };

                const otherAllocatedQty =
                    roundQty(
                        Object.entries(
                            existingAllocations
                        )
                            .filter(
                                ([
                                    existingLocationId,
                                ]) =>
                                    existingLocationId !==
                                    locationKey
                            )
                            .reduce(
                                (
                                    sum,
                                    [
                                        ,
                                        rawQty,
                                    ]
                                ) =>
                                    sum +
                                    numeric(
                                        rawQty
                                    ),
                                0
                            )
                    );

                const requestedQty =
                    roundQty(
                        line.requestedQty
                    );

                const locationAvailableQty =
                    roundQty(
                        option.availableQty
                    );

                const maximumForLocation =
                    roundQty(
                        Math.max(
                            0,
                            Math.min(
                                locationAvailableQty,
                                requestedQty -
                                otherAllocatedQty
                            )
                        )
                    );

                const enteredQty =
                    value === ""
                        ? ""
                        : roundQty(
                            Math.max(
                                0,
                                Math.min(
                                    numeric(
                                        value
                                    ),
                                    maximumForLocation
                                )
                            )
                        );

                const nextAllocations = {
                    ...existingAllocations,

                    [locationKey]:
                        enteredQty,
                };

                const allocatedQty =
                    roundQty(
                        Object.values(
                            nextAllocations
                        ).reduce(
                            (
                                sum,
                                rawQty
                            ) =>
                                sum +
                                numeric(
                                    rawQty
                                ),
                            0
                        )
                    );

                return {
                    ...current,

                    [lineKey]: {
                        ...existing,

                        decision:
                            decisionFromAllocation(
                                requestedQty,
                                allocatedQty
                            ),

                        allocationQuantities:
                            nextAllocations,
                    },
                };
            }
        );
    };

    const updateLineRemarks = (
        lineId,
        value
    ) => {
        const key =
            String(lineId);

        setReviewByLine(
            (current) => ({
                ...current,

                [key]: {
                    ...(current[key] || {
                        decision:
                            "UNDECIDED",

                        allocationQuantities:
                            {},
                    }),

                    remarks:
                        value,
                },
            })
        );
    };

    const load = useCallback(
        async () => {
            if (!requisitionId) {
                setSnapshot(null);
                setAvailability([]);
                setReviewByLine({});
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
                ] = await Promise.all([
                    matflowApi.getStoreReview(
                        requisitionId
                    ),

                    matflowApi.getStoreAvailability(
                        requisitionId
                    ),
                ]);

                /*
                 * Declare each response value only once.
                 */
                const planningData =
                    planningResponse?.data ??
                    null;

                const availabilityRows =
                    asArray(
                        availabilityResponse?.data
                    );

                const requisitionLines =
                    asArray(
                        planningData
                            ?.requisition
                            ?.lines
                    );

                /*
                 * Fast lookup of the persisted requisition line.
                 *
                 * This is used to restore the saved Store decision
                 * from reservedQty and shortageQty after refresh.
                 */
                const lineById =
                    new Map(
                        requisitionLines
                            .filter(
                                (line) =>
                                    Boolean(
                                        line?.id
                                    )
                            )
                            .map(
                                (line) => [
                                    String(
                                        line.id
                                    ),
                                    line,
                                ]
                            )
                    );

                /*
                 * Update the API-backed state once only.
                 */
                setSnapshot(
                    planningData
                );

                setAvailability(
                    availabilityRows
                );

                /*
                 * Build one frontend review-state entry for every
                 * requisition line.
                 *
                 * Requisition lines are used as the primary source so
                 * a material still receives a Store decision entry even
                 * when the availability endpoint returns no stock options.
                 */
                setReviewByLine(
                    (current) => {
                        const next = {};

                        requisitionLines.forEach(
                            (line) => {
                                const lineId =
                                    String(
                                        line?.id ??
                                        ""
                                    );

                                if (!lineId) {
                                    return;
                                }

                                const previous =
                                    current[
                                    lineId
                                    ] ?? {};

                                const persistedDecision =
                                    deriveStoreDecision(
                                        line
                                    );

                                const availabilityEntry =
                                    availabilityRows.find(
                                        (entry) =>
                                            String(
                                                entry
                                                    ?.requisitionLineId ??
                                                ""
                                            ) ===
                                            lineId
                                    );

                                const allocationQuantities =
                                    {};

                                asArray(
                                    availabilityEntry
                                        ?.stockOptions
                                ).forEach(
                                    (option) => {
                                        const locationId =
                                            String(
                                                option
                                                    ?.locationId ??
                                                ""
                                            );

                                        if (!locationId) {
                                            return;
                                        }

                                        allocationQuantities[
                                            locationId
                                        ] =
                                            previous
                                                .allocationQuantities?.[
                                            locationId
                                            ] ??
                                            "";
                                    }
                                );

                                const previousDecision =
                                    String(
                                        previous
                                            .decision ??
                                        ""
                                    )
                                        .trim()
                                        .toUpperCase();

                                next[lineId] = {
                                    /*
                                     * Preserve an unsaved decision while the user
                                     * refreshes the review screen. Otherwise,
                                     * restore the persisted decision based on the
                                     * reservation and shortage quantities.
                                     */
                                    decision:
                                        previousDecision &&
                                            previousDecision !==
                                            "UNDECIDED"
                                            ? previousDecision
                                            : persistedDecision,

                                    allocationQuantities,

                                    remarks:
                                        previous
                                            .remarks ??
                                        "",
                                };
                            }
                        );

                        return next;
                    }
                );
            } catch (
            requestError
            ) {
                setSnapshot(null);
                setAvailability([]);
                setReviewByLine({});

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

            let reviewLines;

            try {
                reviewLines =
                    buildStoreReviewLines();
            } catch (
            validationError
            ) {
                setError(
                    validationError.message
                );

                return;
            }

            const body = {
                rowVersion:
                    requisition.rowVersion,

                lines:
                    reviewLines,

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

                <Box sx={planningFormSingleSx}>
                    <TextField
                        label="Overall Store Review Remarks"
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

                                const availabilityEntry =
                                    availabilityByLineId.get(
                                        String(line.id)
                                    );

                                const approvedRouteSteps =
                                    asArray(
                                        availabilityEntry
                                            ?.approvedRouteSteps
                                    );

                                const processingRequired =
                                    availabilityEntry
                                        ?.processingRequired ===
                                    true;

                                const firstProcessingLocationCode =
                                    availabilityEntry
                                        ?.firstProcessingLocationCode ||
                                    "";

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

                                const lineReview =
                                    reviewByLine[
                                    String(line.id)
                                    ] || {
                                        decision:
                                            "UNDECIDED",

                                        allocationQuantities:
                                            {},

                                        remarks:
                                            "",
                                    };

                                const savedDecision =
                                    deriveStoreDecision(
                                        line
                                    );

                                const displayedDecision =
                                    canConfirmStoreReview
                                        ? lineReview.decision
                                        : savedDecision;

                                const decisionMeta =
                                    storeDecisionMeta(
                                        displayedDecision
                                    );

                                const reviewSummary =
                                    summarizeReviewLine(
                                        line,
                                        availabilityEntry,
                                        lineReview
                                    );

                                const decisionSelected =
                                    normalize(
                                        lineReview.decision
                                    ) !== "UNDECIDED";

                                const showReviewPreview =
                                    canConfirmStoreReview &&
                                    decisionSelected;

                                const displayedReserved =
                                    showReviewPreview
                                        ? reviewSummary.allocatedQty
                                        : numeric(
                                            line.reservedQty
                                        );

                                const displayedShortage =
                                    showReviewPreview
                                        ? reviewSummary.shortageQty
                                        : numeric(
                                            line.shortageQty
                                        );

                                const previewLine = {
                                    ...line,

                                    reservedQty:
                                        displayedReserved,

                                    shortageQty:
                                        displayedShortage,
                                };

                                const meta =
                                    lineStatus(
                                        previewLine
                                    );

                                const progress =
                                    lineProgress(
                                        previewLine
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
                                            {canConfirmStoreReview ? (
                                                <>
                                                    <TextField
                                                        select
                                                        label="Store Decision"
                                                        value={
                                                            lineReview.decision
                                                        }
                                                        disabled={planning}
                                                        onChange={(event) =>
                                                            updateLineDecision(
                                                                line.id,
                                                                event.target.value
                                                            )
                                                        }
                                                        size="small"
                                                        sx={compactDecisionSx}
                                                    >
                                                        <MenuItem value="UNDECIDED">
                                                            Select Decision
                                                        </MenuItem>

                                                        <MenuItem value="AVAILABLE">
                                                            Available — Reserve Full
                                                        </MenuItem>

                                                        <MenuItem value="PARTIAL">
                                                            Partially Available
                                                        </MenuItem>

                                                        <MenuItem value="SHORTAGE">
                                                            Shortage — Raise Indent
                                                        </MenuItem>
                                                    </TextField>

                                                    {reviewSummary
                                                        .stockOptions
                                                        .filter(
                                                            (option) =>
                                                                numeric(
                                                                    option.availableQty
                                                                ) > 0
                                                        )
                                                        .map(
                                                            (option) => (
                                                                <Box
                                                                    key={
                                                                        option.locationId
                                                                    }
                                                                    sx={allocationRowSx}
                                                                >
                                                                    <Box sx={{ minWidth: 0 }}>
                                                                        <Typography sx={stockOptionTextSx}>
                                                                            {option.locationCode}
                                                                            {" · Available "}
                                                                            {formatQty(
                                                                                option.availableQty
                                                                            )}
                                                                            {" "}
                                                                            {line.uom || ""}
                                                                        </Typography>

                                                                        <Typography sx={subTextSx}>
                                                                            {option.plantCode || "-"}
                                                                            {" · "}
                                                                            {readable(
                                                                                option.locationType
                                                                            )}
                                                                        </Typography>
                                                                    </Box>

                                                                    <TextField
                                                                        type="number"
                                                                        label="Reserve"
                                                                        value={
                                                                            lineReview
                                                                                .allocationQuantities?.[
                                                                            String(
                                                                                option.locationId
                                                                            )
                                                                            ] ?? ""
                                                                        }
                                                                        disabled={
                                                                            planning ||
                                                                            lineReview.decision ===
                                                                            "SHORTAGE" ||
                                                                            lineReview.decision ===
                                                                            "UNDECIDED"
                                                                        }
                                                                        onChange={(event) =>
                                                                            updateAllocationQty(
                                                                                line.id,
                                                                                option.locationId,
                                                                                event.target.value
                                                                            )
                                                                        }
                                                                        inputProps={{
                                                                            min: 0,
                                                                            max:
                                                                                numeric(
                                                                                    option.availableQty
                                                                                ),
                                                                            step: 0.001,
                                                                        }}
                                                                        size="small"
                                                                        sx={allocationQtyFieldSx}
                                                                    />
                                                                </Box>
                                                            )
                                                        )}

                                                    {reviewSummary
                                                        .stockOptions
                                                        .filter(
                                                            (option) =>
                                                                numeric(
                                                                    option.availableQty
                                                                ) > 0
                                                        ).length === 0 && (
                                                            <Box sx={noStockBoxSx}>
                                                                <Typography sx={noStockTitleSx}>
                                                                    No recorded stock
                                                                </Typography>

                                                                <Typography sx={subTextSx}>
                                                                    Select Shortage, or import/adjust
                                                                    inventory before reserving.
                                                                </Typography>
                                                            </Box>
                                                        )}

                                                    <Typography sx={allocationSummarySx}>
                                                        Planned reserve:{" "}
                                                        {formatQty(
                                                            reviewSummary.allocatedQty
                                                        )}
                                                        {" · Planned shortage: "}
                                                        {formatQty(
                                                            reviewSummary.shortageQty
                                                        )}
                                                    </Typography>
                                                </>
                                            ) : (
                                                <>
                                                    <Chip
                                                        label={decisionMeta.label}
                                                        size="small"
                                                        sx={storeDecisionChipSx(
                                                            decisionMeta.color
                                                        )}
                                                    />

                                                    <Box sx={reviewedResultSx}>
                                                        <Typography sx={reviewedResultLabelSx}>
                                                            Store Review Result
                                                        </Typography>

                                                        <Typography sx={reviewedResultValueSx}>
                                                            Reserved{" "}
                                                            {formatQty(
                                                                line.reservedQty
                                                            )}
                                                            {" · Shortage "}
                                                            {formatQty(
                                                                line.shortageQty
                                                            )}
                                                            {" · Issued "}
                                                            {formatQty(
                                                                line.issuedQty
                                                            )}
                                                        </Typography>
                                                    </Box>
                                                </>
                                            )}
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Chip
                                                label={
                                                    processingRequired
                                                        ? "Processing Required"
                                                        : "Direct Production Route"
                                                }
                                                size="small"
                                                sx={routeModeChipSx(
                                                    processingRequired
                                                )}
                                            />

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

                                            {processingRequired &&
                                                firstProcessingLocationCode && (
                                                    <Typography sx={processingDestinationSx}>
                                                        Approved processing unit:{" "}
                                                        {firstProcessingLocationCode}
                                                    </Typography>
                                                )}

                                            {approvedRouteSteps.length >
                                                0 && (
                                                    <Box sx={approvedRouteStepsSx}>
                                                        {approvedRouteSteps.map(
                                                            (
                                                                step,
                                                                stepIndex
                                                            ) => (
                                                                <Box
                                                                    key={
                                                                        step.routeStepId ||
                                                                        `${line.id}-${stepIndex}`
                                                                    }
                                                                    sx={approvedRouteStepSx}
                                                                >
                                                                    <Box sx={routeStepIndexSx}>
                                                                        {stepIndex + 1}
                                                                    </Box>

                                                                    <Box sx={{ minWidth: 0 }}>
                                                                        <Typography sx={routeStepMainSx}>
                                                                            {step.locationCode ||
                                                                                "-"}
                                                                        </Typography>

                                                                        <Typography sx={routeStepSubSx}>
                                                                            {readable(
                                                                                step.stepType
                                                                            )}
                                                                            {step.processCode
                                                                                ? ` · ${step.processCode}`
                                                                                : ""}
                                                                        </Typography>
                                                                    </Box>
                                                                </Box>
                                                            )
                                                        )}
                                                    </Box>
                                                )}
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Typography sx={reservedQtySx}>
                                                {formatQty(
                                                    displayedReserved
                                                )}
                                            </Typography>
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Typography
                                                sx={
                                                    numeric(
                                                        displayedShortage
                                                    ) > 0
                                                        ? shortageQtySx
                                                        : normalQtySx
                                                }
                                            >
                                                {formatQty(
                                                    displayedShortage
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

const routeSelectionSx = {
    mt: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "7px",
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

const planningFormSingleSx = {
    mt: "15px",
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "12px",
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
    "minmax(230px,1.4fr) 130px 90px 90px minmax(310px,1.55fr) minmax(180px,1fr) 90px 90px 90px 140px 145px 180px";

const materialHeaderSx = {
    ...tableHeaderSx,
    gridTemplateColumns:
        materialColumns,
    minWidth: "1840px",
};

const materialRowSx = {
    ...tableRowSx,
    gridTemplateColumns:
        materialColumns,
    minWidth: "1840px",
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

const reviewedResultSx = {
    mt: "7px",
    p: "7px 8px",
    borderRadius: "7px",
    background:
        "var(--mf-surface-strong)",
    border:
        "1px solid var(--mf-border)",
};

const reviewedResultLabelSx = {
    color:
        "var(--mf-text-muted)",
    fontSize: "8px",
    fontWeight: 900,
    textTransform: "uppercase",
};

const reviewedResultValueSx = {
    mt: "2px",
    color:
        "var(--mf-text)",
    fontSize: "9px",
    fontWeight: 850,
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

const departmentBoxSx = {
    minWidth: "110px",
    padding: "6px 8px",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "2px",
    borderRadius: "8px",
    background:
        "var(--mf-surface-strong)",
    border:
        "1px solid var(--mf-border)",
};

const departmentNameSx = {
    color: "#7c3aed",
    fontSize: "8px",
    fontWeight: 950,
    lineHeight: 1.25,
    textTransform: "uppercase",
    letterSpacing: ".04em",
};

const nextActionSx = {
    color:
        "var(--mf-text-muted)",
    fontSize: "8px",
    fontWeight: 700,
    lineHeight: 1.35,
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

const routeModeChipSx = (
    processingRequired
) => {
    const color =
        processingRequired
            ? "#d97706"
            : "#16a34a";

    return {
        height: "22px",
        mb: "6px",
        color,
        background:
            `${color}14`,
        border:
            `1px solid ${color}32`,
        fontSize: "8px",
        fontWeight: 900,
    };
};

const processingDestinationSx = {
    mt: "5px",
    color: "#d97706",
    fontSize: "8.5px",
    fontWeight: 850,
    lineHeight: 1.4,
};

const approvedRouteStepsSx = {
    mt: "7px",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
};

const approvedRouteStepSx = {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: "6px",
    p: "5px 6px",
    borderRadius: "7px",
    background:
        "var(--mf-surface-strong)",
    border:
        "1px solid var(--mf-border)",
};

const routeStepIndexSx = {
    width: "20px",
    height: "20px",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    borderRadius: "6px",
    color: "#0284c7",
    background:
        "rgba(2,132,199,.09)",
    border:
        "1px solid rgba(2,132,199,.18)",
    fontSize: "8px",
    fontWeight: 950,
};

const routeStepMainSx = {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color:
        "var(--mf-text)",
    fontSize: "8.5px",
    fontWeight: 850,
};

const routeStepSubSx = {
    mt: "1px",
    color:
        "var(--mf-text-muted)",
    fontSize: "7.5px",
    fontWeight: 700,
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

const compactDecisionSx = {
    ...fieldSx,
    width: "100%",

    "& .MuiInputBase-root": {
        minHeight: "34px",
        fontSize: "9px",
    },
};

const allocationRowSx = {
    mt: "6px",
    display: "grid",
    gridTemplateColumns:
        "minmax(0,1fr) 88px",
    alignItems: "center",
    gap: "7px",
};

const allocationQtyFieldSx = {
    ...fieldSx,

    "& .MuiInputBase-root": {
        minHeight: "33px",
        fontSize: "9px",
    },

    "& .MuiInputLabel-root": {
        fontSize: "9px",
    },
};

const allocationSummarySx = {
    mt: "7px",
    color: "#0284c7",
    fontSize: "8.5px",
    fontWeight: 850,
};

const noStockBoxSx = {
    mt: "7px",
    p: "7px",
    borderRadius: "7px",
    background:
        "rgba(220,38,38,.06)",
    border:
        "1px solid rgba(220,38,38,.18)",
};

const noStockTitleSx = {
    color: "#dc2626",
    fontSize: "8.5px",
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