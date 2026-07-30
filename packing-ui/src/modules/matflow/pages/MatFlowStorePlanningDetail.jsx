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
    IconButton,
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";

import ArrowBackIcon
    from "@mui/icons-material/ArrowBack";

import RefreshOutlinedIcon
    from "@mui/icons-material/RefreshOutlined";

import PlayArrowOutlinedIcon
    from "@mui/icons-material/PlayArrowOutlined";

import KeyboardArrowUpIcon
    from "@mui/icons-material/KeyboardArrowUp";

import KeyboardArrowDownIcon
    from "@mui/icons-material/KeyboardArrowDown";

import DeleteOutlineIcon
    from "@mui/icons-material/DeleteOutline";

import {
    useNavigate,
    useParams,
} from "react-router-dom";

import {
    extractMatFlowPage,
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

const SOURCE_TYPES = new Set([
    "STORE",
    "PROCESSING",
    "EXTERNAL_PROCESSOR",
]);

const clean = (value) => {
    return String(value ?? "")
        .trim();
};

const normalizeValue = (value) => {
    return clean(value)
        .toUpperCase()
        .replace(/[\s-]+/g, "_");
};

const formatQty = (value) => {
    const number =
        Number(value);

    if (!Number.isFinite(number)) {
        return "0";
    }

    return number.toLocaleString(
        "en-IN",
        {
            maximumFractionDigits: 3,
        }
    );
};

const sumLines = (
    lines,
    field
) => {
    return lines.reduce(
        (
            total,
            line
        ) => {
            const amount =
                Number(
                    line?.[field] ??
                    0
                );

            return total +
                (
                    Number.isFinite(
                        amount
                    )
                        ? amount
                        : 0
                );
        },
        0
    );
};

const emptySnapshot = {
    requisition: null,
    reservations: [],
    indents: [],
    transfers: [],
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
    ] = useState(
        emptySnapshot
    );

    const [
        locations,
        setLocations,
    ] = useState([]);

    const [
        selectedSourceIds,
        setSelectedSourceIds,
    ] = useState([]);

    const [
        sourceToAdd,
        setSourceToAdd,
    ] = useState("");

    const [remarks, setRemarks] =
        useState("");

    const [loading, setLoading] =
        useState(true);

    const [planning, setPlanning] =
        useState(false);

    const [error, setError] =
        useState("");

    const loadPage =
        useCallback(
            async () => {
                if (!requisitionId) {
                    setError(
                        "Requisition ID is missing."
                    );
                    setLoading(false);
                    return;
                }

                setLoading(true);
                setError("");

                try {
                    const [
                        planningResponse,
                        locationResponse,
                    ] =
                        await Promise.all([
                            matflowApi
                                .getRequisitionPlanning(
                                    requisitionId
                                ),

                            matflowApi
                                .listLocations({
                                    active:
                                        true,
                                }),
                        ]);

                    const payload =
                        planningResponse?.data ||
                        {};

                    setSnapshot({
                        requisition:
                            payload.requisition ||
                            null,

                        reservations:
                            Array.isArray(
                                payload.reservations
                            )
                                ? payload.reservations
                                : [],

                        indents:
                            Array.isArray(
                                payload.indents
                            )
                                ? payload.indents
                                : [],

                        transfers:
                            Array.isArray(
                                payload.transfers
                            )
                                ? payload.transfers
                                : [],
                    });

                    const locationResult =
                        extractMatFlowPage(
                            locationResponse?.data
                        );

                    setLocations(
                        locationResult.rows
                    );
                } catch (
                requestError
                ) {
                    setError(
                        readMatFlowError(
                            requestError,
                            "Unable to load the Store planning detail."
                        )
                    );
                } finally {
                    setLoading(false);
                }
            },
            [requisitionId]
        );

    useEffect(() => {
        loadPage();
    }, [loadPage]);

    const requisition =
        snapshot.requisition;

    const lines =
        useMemo(() => {
            return Array.isArray(
                requisition?.lines
            )
                ? requisition.lines
                : [];
        }, [requisition]);

    const sourceOptions =
        useMemo(() => {
            return locations
                .filter(
                    (location) => {
                        return (
                            Boolean(
                                location?.id
                            ) &&
                            location.active !==
                            false &&
                            location.supportsStock ===
                            true &&
                            SOURCE_TYPES.has(
                                normalizeValue(
                                    location.locationType
                                )
                            )
                        );
                    }
                )
                .sort(
                    (
                        left,
                        right
                    ) => {
                        const leftSamePlant =
                            clean(
                                left.plantCode
                            ).toUpperCase() ===
                            clean(
                                requisition?.destinationPlantCode
                            ).toUpperCase();

                        const rightSamePlant =
                            clean(
                                right.plantCode
                            ).toUpperCase() ===
                            clean(
                                requisition?.destinationPlantCode
                            ).toUpperCase();

                        if (
                            leftSamePlant !==
                            rightSamePlant
                        ) {
                            return leftSamePlant
                                ? -1
                                : 1;
                        }

                        return clean(
                            left.locationCode
                        ).localeCompare(
                            clean(
                                right.locationCode
                            )
                        );
                    }
                );
        }, [
            locations,
            requisition,
        ]);

    const sourceById =
        useMemo(() => {
            return new Map(
                sourceOptions.map(
                    (location) => [
                        String(
                            location.id
                        ),
                        location,
                    ]
                )
            );
        }, [sourceOptions]);

    const remainingSources =
        useMemo(() => {
            const selected =
                new Set(
                    selectedSourceIds.map(
                        String
                    )
                );

            return sourceOptions.filter(
                (location) =>
                    !selected.has(
                        String(
                            location.id
                        )
                    )
            );
        }, [
            selectedSourceIds,
            sourceOptions,
        ]);

    const selectedSources =
        useMemo(() => {
            return selectedSourceIds
                .map(
                    (id) =>
                        sourceById.get(
                            String(id)
                        )
                )
                .filter(Boolean);
        }, [
            selectedSourceIds,
            sourceById,
        ]);

    const status =
        normalizeValue(
            requisition?.status
        );

    const canPlan =
        status ===
        "SUBMITTED";

    const totals =
        useMemo(() => {
            return {
                requested:
                    sumLines(
                        lines,
                        "requestedQty"
                    ),

                reserved:
                    sumLines(
                        lines,
                        "reservedQty"
                    ),

                shortage:
                    sumLines(
                        lines,
                        "shortageQty"
                    ),

                issued:
                    sumLines(
                        lines,
                        "issuedQty"
                    ),
            };
        }, [lines]);

    const addPreferredSource = (
        locationId
    ) => {
        if (!locationId) {
            return;
        }

        setSelectedSourceIds(
            (current) => {
                if (
                    current.some(
                        (id) =>
                            String(id) ===
                            String(
                                locationId
                            )
                    )
                ) {
                    return current;
                }

                return [
                    ...current,
                    locationId,
                ];
            }
        );

        setSourceToAdd("");
    };

    const removePreferredSource = (
        locationId
    ) => {
        setSelectedSourceIds(
            (current) =>
                current.filter(
                    (id) =>
                        String(id) !==
                        String(
                            locationId
                        )
                )
        );
    };

    const movePreferredSource = (
        index,
        direction
    ) => {
        setSelectedSourceIds(
            (current) => {
                const target =
                    index +
                    direction;

                if (
                    target < 0 ||
                    target >=
                    current.length
                ) {
                    return current;
                }

                const next =
                    [...current];

                const [
                    moved,
                ] =
                    next.splice(
                        index,
                        1
                    );

                next.splice(
                    target,
                    0,
                    moved
                );

                return next;
            }
        );
    };

    const planRequisition =
        async () => {
            if (
                !requisition?.id
            ) {
                setError(
                    "Requisition data is unavailable."
                );
                return;
            }

            if (!canPlan) {
                setError(
                    "Only a Submitted requisition can be planned."
                );
                return;
            }

            if (
                requisition.rowVersion ===
                undefined ||
                requisition.rowVersion ===
                null
            ) {
                setError(
                    "Requisition rowVersion is missing. Refresh and retry."
                );
                return;
            }

            const confirmed =
                window.confirm(
                    "Plan this requisition against the current available stock? Reservations, shortage indents and transfer orders may be created."
                );

            if (!confirmed) {
                return;
            }

            setPlanning(true);
            setError("");

            try {
                const response =
                    await matflowApi
                        .planRequisition(
                            requisition.id,
                            {
                                rowVersion:
                                    requisition.rowVersion,

                                preferredSourceLocationIds:
                                    selectedSourceIds,

                                remarks:
                                    clean(remarks) ||
                                    null,
                            }
                        );

                const payload =
                    response?.data ||
                    {};

                setSnapshot({
                    requisition:
                        payload.requisition ||
                        null,

                    reservations:
                        Array.isArray(
                            payload.reservations
                        )
                            ? payload.reservations
                            : [],

                    indents:
                        Array.isArray(
                            payload.indents
                        )
                            ? payload.indents
                            : [],

                    transfers:
                        Array.isArray(
                            payload.transfers
                        )
                            ? payload.transfers
                            : [],
                });
            } catch (
            requestError
            ) {
                setError(
                    readMatFlowError(
                        requestError,
                        "Unable to plan the material requisition."
                    )
                );
            } finally {
                setPlanning(false);
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
                            label="STORE PLANNING DETAIL"
                            sx={heroBadgeSx}
                        />

                        <Typography sx={heroTitleSx}>
                            {requisition?.requisitionNumber ||
                                "Material Requisition"}
                        </Typography>

                        <Typography sx={heroSubSx}>
                            Review material demand,
                            prioritize source locations and
                            create reservations, transfers
                            and shortage indents.
                        </Typography>
                    </Box>

                    <Box sx={headerActionsSx}>
                        <Button
                            startIcon={
                                <RefreshOutlinedIcon />
                            }
                            onClick={loadPage}
                            disabled={planning}
                            sx={secondaryBtnSx}
                        >
                            Refresh
                        </Button>

                        <Button
                            startIcon={
                                <ArrowBackIcon />
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

            {requisition && (
                <>
                    <Box sx={contextGridSx}>
                        <Detail
                            label="Status"
                            value={
                                requisition.status
                            }
                        />

                        <Detail
                            label="Project / PD"
                            value={
                                requisition.projectCode
                            }
                        />

                        <Detail
                            label="Drawing"
                            value={
                                requisition.drawingNo
                            }
                        />

                        <Detail
                            label="BOM"
                            value={`${requisition.bomNumber || "-"} · Rev ${requisition.bomRevisionNo ?? "-"}`}
                        />

                        <Detail
                            label="Production Destination"
                            value={
                                requisition.destinationLocationCode
                            }
                        />

                        <Detail
                            label="Plant"
                            value={
                                requisition.destinationPlantCode
                            }
                        />

                        <Detail
                            label="Requested"
                            value={
                                formatQty(
                                    totals.requested
                                )
                            }
                        />

                        <Detail
                            label="Reserved"
                            value={
                                formatQty(
                                    totals.reserved
                                )
                            }
                        />

                        <Detail
                            label="Shortage"
                            value={
                                formatQty(
                                    totals.shortage
                                )
                            }
                        />
                    </Box>

                    {canPlan && (
                        <Card sx={panelSx}>
                            <Typography sx={sectionTitleSx}>
                                Planning Priorities
                            </Typography>

                            <Typography sx={sectionSubSx}>
                                Preferred source locations
                                are optional. When none are
                                selected, the backend ranks
                                stock by plant and available
                                quantity.
                            </Typography>

                            <Box sx={planningGridSx}>
                                <TextField
                                    select
                                    label="Add Preferred Source"
                                    value={sourceToAdd}
                                    onChange={(event) => {
                                        const value =
                                            event.target.value;

                                        setSourceToAdd(
                                            value
                                        );

                                        addPreferredSource(
                                            value
                                        );
                                    }}
                                    sx={fieldSx}
                                >
                                    {remainingSources.length ===
                                        0 ? (
                                        <MenuItem
                                            value=""
                                            disabled
                                        >
                                            No additional stock
                                            locations available
                                        </MenuItem>
                                    ) : (
                                        remainingSources.map(
                                            (location) => (
                                                <MenuItem
                                                    key={
                                                        location.id
                                                    }
                                                    value={
                                                        location.id
                                                    }
                                                >
                                                    {location.locationCode}
                                                    {" · "}
                                                    {location.locationName}
                                                    {" · "}
                                                    {location.plantCode}
                                                    {" · "}
                                                    {location.locationType}
                                                </MenuItem>
                                            )
                                        )
                                    )}
                                </TextField>

                                <TextField
                                    label="Store Planning Remarks"
                                    multiline
                                    minRows={3}
                                    value={remarks}
                                    disabled={planning}
                                    onChange={(event) =>
                                        setRemarks(
                                            event.target.value
                                        )
                                    }
                                    sx={fieldSx}
                                />
                            </Box>

                            <Box sx={priorityListSx}>
                                {selectedSources.length ===
                                    0 ? (
                                    <Box sx={emptyPrioritySx}>
                                        Automatic stock ranking
                                        will be used.
                                    </Box>
                                ) : (
                                    selectedSources.map(
                                        (
                                            location,
                                            index
                                        ) => (
                                            <Box
                                                key={
                                                    location.id
                                                }
                                                sx={priorityRowSx}
                                            >
                                                <Chip
                                                    label={
                                                        index +
                                                        1
                                                    }
                                                    size="small"
                                                    sx={priorityNumberSx}
                                                />

                                                <Box sx={priorityContentSx}>
                                                    <Typography sx={priorityTitleSx}>
                                                        {location.locationCode}
                                                        {" · "}
                                                        {location.locationName}
                                                    </Typography>

                                                    <Typography sx={prioritySubSx}>
                                                        {location.plantCode}
                                                        {" · "}
                                                        {location.locationType}
                                                    </Typography>
                                                </Box>

                                                <IconButton
                                                    disabled={
                                                        index ===
                                                        0 ||
                                                        planning
                                                    }
                                                    onClick={() =>
                                                        movePreferredSource(
                                                            index,
                                                            -1
                                                        )
                                                    }
                                                    sx={iconBtnSx}
                                                >
                                                    <KeyboardArrowUpIcon />
                                                </IconButton>

                                                <IconButton
                                                    disabled={
                                                        index ===
                                                        selectedSources.length -
                                                        1 ||
                                                        planning
                                                    }
                                                    onClick={() =>
                                                        movePreferredSource(
                                                            index,
                                                            1
                                                        )
                                                    }
                                                    sx={iconBtnSx}
                                                >
                                                    <KeyboardArrowDownIcon />
                                                </IconButton>

                                                <IconButton
                                                    disabled={
                                                        planning
                                                    }
                                                    onClick={() =>
                                                        removePreferredSource(
                                                            location.id
                                                        )
                                                    }
                                                    sx={iconBtnSx}
                                                >
                                                    <DeleteOutlineIcon />
                                                </IconButton>
                                            </Box>
                                        )
                                    )
                                )}
                            </Box>

                            <Box sx={planActionSx}>
                                <Button
                                    startIcon={
                                        <PlayArrowOutlinedIcon />
                                    }
                                    onClick={
                                        planRequisition
                                    }
                                    disabled={
                                        planning ||
                                        lines.length ===
                                        0
                                    }
                                    sx={primaryBtnSx}
                                >
                                    {planning
                                        ? "Planning..."
                                        : "Plan Requisition"}
                                </Button>
                            </Box>
                        </Card>
                    )}

                    <MaterialDemandTable
                        lines={lines}
                    />

                    <PlanningResults
                        snapshot={snapshot}
                    />
                </>
            )}
        </Box>
    );
}

function MaterialDemandTable({
    lines,
}) {
    return (
        <Card sx={panelSx}>
            <Typography sx={sectionTitleSx}>
                Material Demand
            </Typography>

            <Box sx={tableShellSx}>
                <Box sx={materialHeaderSx}>
                    <Box sx={tableCellSx}>
                        Line
                    </Box>

                    <Box sx={tableCellSx}>
                        Material
                    </Box>

                    <Box sx={tableCellSx}>
                        UOM
                    </Box>

                    <Box sx={tableCellSx}>
                        BOM Qty
                    </Box>

                    <Box sx={tableCellSx}>
                        Requested
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
                </Box>

                {lines.map(
                    (
                        line,
                        index
                    ) => (
                        <Box
                            key={
                                line.id ||
                                index
                            }
                            sx={materialRowSx}
                        >
                            <Box sx={tableCellSx}>
                                {line.lineNo ??
                                    index +
                                    1}
                            </Box>

                            <Box sx={tableCellSx}>
                                <Typography sx={mainTextSx}>
                                    {line.materialName ||
                                        "-"}
                                </Typography>

                                <Typography sx={subTextSx}>
                                    {line.materialCode ||
                                        "-"}
                                </Typography>
                            </Box>

                            <Box sx={tableCellSx}>
                                {line.uom ||
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
                                {formatQty(
                                    line.reservedQty
                                )}
                            </Box>

                            <Box sx={tableCellSx}>
                                {formatQty(
                                    line.shortageQty
                                )}
                            </Box>

                            <Box sx={tableCellSx}>
                                {formatQty(
                                    line.issuedQty
                                )}
                            </Box>
                        </Box>
                    )
                )}
            </Box>
        </Card>
    );
}

function PlanningResults({
    snapshot,
}) {
    const {
        reservations,
        indents,
        transfers,
    } = snapshot;

    return (
        <>
            <ResultSection
                title="Reservations"
                count={
                    reservations.length
                }
            >
                {reservations.map(
                    (reservation) => (
                        <Box
                            key={
                                reservation.id
                            }
                            sx={resultRowSx}
                        >
                            <ResultValue
                                label="Material"
                                value={
                                    reservation.materialCode
                                }
                            />

                            <ResultValue
                                label="Source"
                                value={
                                    reservation.sourceLocationCode
                                }
                            />

                            <ResultValue
                                label="First Destination"
                                value={
                                    reservation.firstDestinationLocationCode
                                }
                            />

                            <ResultValue
                                label="Reserved"
                                value={
                                    formatQty(
                                        reservation.reservedQty
                                    )
                                }
                            />

                            <ResultValue
                                label="Status"
                                value={
                                    reservation.status
                                }
                            />
                        </Box>
                    )
                )}
            </ResultSection>

            <ResultSection
                title="Shortage Indents"
                count={indents.length}
            >
                {indents.map(
                    (indent) => (
                        <Box
                            key={indent.id}
                            sx={resultRowSx}
                        >
                            <ResultValue
                                label="Indent"
                                value={
                                    indent.indentNumber
                                }
                            />

                            <ResultValue
                                label="Deliver To"
                                value={
                                    indent.deliverToLocationCode
                                }
                            />

                            <ResultValue
                                label="Plant"
                                value={
                                    indent.deliverToPlantCode
                                }
                            />

                            <ResultValue
                                label="Lines"
                                value={
                                    Array.isArray(
                                        indent.lines
                                    )
                                        ? indent.lines
                                            .length
                                        : 0
                                }
                            />

                            <ResultValue
                                label="Status"
                                value={
                                    indent.status
                                }
                            />
                        </Box>
                    )
                )}
            </ResultSection>

            <ResultSection
                title="Transfer Chain"
                count={
                    transfers.length
                }
            >
                {transfers.map(
                    (transfer) => (
                        <Box
                            key={transfer.id}
                            sx={resultRowSx}
                        >
                            <ResultValue
                                label="Transfer"
                                value={
                                    transfer.transferNumber
                                }
                            />

                            <ResultValue
                                label="From"
                                value={
                                    transfer.fromLocationCode
                                }
                            />

                            <ResultValue
                                label="To"
                                value={
                                    transfer.toLocationCode
                                }
                            />

                            <ResultValue
                                label="Planned"
                                value={
                                    formatQty(
                                        transfer.plannedQty
                                    )
                                }
                            />

                            <ResultValue
                                label="Status"
                                value={
                                    transfer.status
                                }
                            />
                        </Box>
                    )
                )}
            </ResultSection>
        </>
    );
}

function ResultSection({
    title,
    count,
    children,
}) {
    return (
        <Card sx={panelSx}>
            <Box sx={resultHeaderSx}>
                <Typography sx={sectionTitleSx}>
                    {title}
                </Typography>

                <Chip
                    label={`${count} RECORD${count === 1 ? "" : "S"}`}
                    size="small"
                    sx={resultChipSx}
                />
            </Box>

            {count === 0 ? (
                <Box sx={emptyPrioritySx}>
                    No {title.toLowerCase()} have
                    been created.
                </Box>
            ) : (
                <Box sx={resultListSx}>
                    {children}
                </Box>
            )}
        </Card>
    );
}

function Detail({
    label,
    value,
}) {
    return (
        <Card sx={panelSx}>
            <Typography sx={detailLabelSx}>
                {label}
            </Typography>

            <Typography sx={detailValueSx}>
                {value ?? "-"}
            </Typography>
        </Card>
    );
}

function ResultValue({
    label,
    value,
}) {
    return (
        <Box>
            <Typography sx={resultLabelSx}>
                {label}
            </Typography>

            <Typography sx={resultValueSx}>
                {value ?? "-"}
            </Typography>
        </Box>
    );
}

const materialColumns =
    "65px minmax(240px,1.4fr) 80px 100px 105px 105px 105px 100px";

const materialHeaderSx = {
    ...tableHeaderSx,
    gridTemplateColumns:
        materialColumns,
};

const materialRowSx = {
    ...tableRowSx,
    gridTemplateColumns:
        materialColumns,
};

const heroRowSx = {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    flexWrap: "wrap",
};

const headerActionsSx = {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
};

const contextGridSx = {
    display: "grid",
    gridTemplateColumns:
        "repeat(auto-fit,minmax(165px,1fr))",
    gap: "10px",
};

const planningGridSx = {
    mt: "13px",
    display: "grid",
    gridTemplateColumns:
        "minmax(260px,1fr) minmax(300px,1.25fr)",
    gap: "12px",

    "@media (max-width: 760px)": {
        gridTemplateColumns:
            "1fr",
    },
};

const sectionTitleSx = {
    color: "#fff",
    fontSize: "16px",
    fontWeight: 950,
};

const sectionSubSx = {
    mt: "3px",
    color:
        "rgba(255,255,255,.52)",
    fontSize: "10.5px",
};

const priorityListSx = {
    mt: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "7px",
};

const priorityRowSx = {
    p: "9px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    borderRadius: "9px",
    background:
        "rgba(2,6,23,.34)",
    border:
        "1px solid rgba(255,255,255,.07)",
};

const priorityContentSx = {
    flex: 1,
    minWidth: 0,
};

const priorityTitleSx = {
    color: "#fff",
    fontSize: "12px",
    fontWeight: 850,
};

const prioritySubSx = {
    mt: "2px",
    color:
        "rgba(255,255,255,.48)",
    fontSize: "10px",
};

const priorityNumberSx = {
    minWidth: "28px",
    color: "#60a5fa",
    background:
        "rgba(96,165,250,.14)",
    border:
        "1px solid rgba(96,165,250,.34)",
    fontWeight: 950,
};

const iconBtnSx = {
    color: "#94a3b8",
    border:
        "1px solid rgba(255,255,255,.07)",
};

const emptyPrioritySx = {
    p: "14px",
    borderRadius: "9px",
    color:
        "rgba(255,255,255,.50)",
    background:
        "rgba(2,6,23,.28)",
    border:
        "1px dashed rgba(255,255,255,.10)",
    fontSize: "11px",
};

const planActionSx = {
    mt: "13px",
    display: "flex",
    justifyContent: "flex-end",
};

const mainTextSx = {
    color: "#fff",
    fontSize: "12px",
    fontWeight: 850,
};

const subTextSx = {
    mt: "2px",
    color:
        "rgba(255,255,255,.48)",
    fontSize: "10px",
};

const detailLabelSx = {
    color:
        "rgba(255,255,255,.48)",
    fontSize: "9.5px",
    fontWeight: 900,
    textTransform: "uppercase",
};

const detailValueSx = {
    mt: "5px",
    color: "#fff",
    fontSize: "12px",
    fontWeight: 850,
};

const resultHeaderSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
};

const resultChipSx = {
    color: "#60a5fa",
    background:
        "rgba(96,165,250,.12)",
    border:
        "1px solid rgba(96,165,250,.28)",
    fontWeight: 900,
    fontSize: "9px",
};

const resultListSx = {
    mt: "11px",
    display: "flex",
    flexDirection: "column",
    gap: "7px",
};

const resultRowSx = {
    p: "10px",
    display: "grid",
    gridTemplateColumns:
        "repeat(5,minmax(130px,1fr))",
    gap: "10px",
    borderRadius: "9px",
    background:
        "rgba(2,6,23,.34)",
    border:
        "1px solid rgba(255,255,255,.07)",
    overflowX: "auto",
};

const resultLabelSx = {
    color:
        "rgba(255,255,255,.45)",
    fontSize: "9px",
    fontWeight: 900,
    textTransform: "uppercase",
};

const resultValueSx = {
    mt: "4px",
    color: "#fff",
    fontSize: "11px",
    fontWeight: 800,
};