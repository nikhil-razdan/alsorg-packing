import {
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
    Collapse,
    IconButton,
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";

import ArrowBackIcon
    from "@mui/icons-material/ArrowBack";
import ExpandLessIcon
    from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon
    from "@mui/icons-material/ExpandMore";
import SaveOutlinedIcon
    from "@mui/icons-material/SaveOutlined";

import {
    useNavigate,
    useSearchParams,
} from "react-router-dom";

import {
    extractMatFlowPage,
    matflowApi,
    readMatFlowError,
} from "../api/matflowApi";

import {
    getMatFlowCategoryMeta,
    normalizeMatFlowCategory,
} from "../utils/matflowMaterialCategories";

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
    detailBoxSx,
    detailLabelSx,
    detailValueSx,
    mainTextSx,
    sectionSubSx,
    sectionTitleSx,
    subTextSx,
    tableShellSx,
} from "../matflowTheme";

const clean = (value) => {
    return String(value ?? "")
        .trim();
};

const formatQty = (value) => {
    const number =
        Number(value);

    if (!Number.isFinite(number)) {
        return "-";
    }

    return number.toLocaleString(
        "en-US",
        {
            maximumFractionDigits: 3,
        }
    );
};

const normalizeLocationType = (
    value
) => {
    return String(value ?? "")
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, "_");
};

const lineMaterialName = (line) => {
    return (
        line.materialName ||
        line.materialNameSnapshot ||
        line.material?.materialName ||
        "-"
    );
};

const lineMaterialCode = (line) => {
    return (
        line.materialCode ||
        line.materialCodeSnapshot ||
        line.material?.materialCode ||
        "-"
    );
};

const lineUom = (line) => {
    return (
        line.uom ||
        line.uomSnapshot ||
        line.material?.uom ||
        "-"
    );
};

const lineRequiredQty = (line) => {
    return Number(
        line.netRequiredQty ??
        line.requiredQty ??
        0
    );
};

const lineCategory = (
    line
) => {
    return normalizeMatFlowCategory(
        line?.materialCategorySnapshot ||
        line?.categorySnapshot ||
        line?.materialCategory ||
        line?.category ||
        line?.material?.category ||
        "MISCELLANEOUS"
    );
};

export default function MatFlowRequisitionCreate() {
    const navigate =
        useNavigate();

    const [
        searchParams,
    ] = useSearchParams();

    const initialBomId =
        searchParams.get("bomId") ||
        "";

    const [boms, setBoms] =
        useState([]);

    const [locations, setLocations] =
        useState([]);

    const [
        selectedBomId,
        setSelectedBomId,
    ] = useState(initialBomId);

    const [
        selectedBom,
        setSelectedBom,
    ] = useState(null);

    const [
        destinationLocationId,
        setDestinationLocationId,
    ] = useState("");

    const [remarks, setRemarks] =
        useState("");

    const [
        locationError,
        setLocationError,
    ] = useState("");

    const [
        lineInputs,
        setLineInputs,
    ] = useState({});

    const [
        openSections,
        setOpenSections,
    ] = useState({});

    const [loading, setLoading] =
        useState(true);

    const [
        bomLoading,
        setBomLoading,
    ] = useState(false);

    const [saving, setSaving] =
        useState(false);

    const [error, setError] =
        useState("");

    useEffect(() => {
        let active = true;

        const loadInitialData =
            async () => {
                setLoading(true);
                setError("");

                try {
                    const [
                        bomResponse,
                        locationResponse,
                    ] =
                        await Promise.all([
                            matflowApi.listBoms({
                                status:
                                    "APPROVED",
                                latestOnly:
                                    true,
                            }),

                            matflowApi.listLocations(),
                        ]);

                    const bomResult =
                        extractMatFlowPage(
                            bomResponse?.data
                        );

                    const approvedBoms =
                        bomResult.rows.filter(
                            (bom) => {
                                return (
                                    String(
                                        bom.status || ""
                                    ).toUpperCase() ===
                                    "APPROVED" &&
                                    bom.effective === true &&
                                    bom.latestRevision === true
                                );
                            }
                        );

                    const locationResult =
                        extractMatFlowPage(
                            locationResponse?.data ??
                            locationResponse
                        );

                    const allLocationRows =
                        Array.isArray(
                            locationResult.rows
                        )
                            ? locationResult.rows
                            : [];

                    const activeLocations =
                        allLocationRows.filter(
                            (location) => {
                                return (
                                    Boolean(location?.id) &&
                                    location.active !== false
                                );
                            }
                        );

                    const productionLocations =
                        activeLocations.filter(
                            (location) => {
                                return (
                                    normalizeLocationType(
                                        location.locationType
                                    ) ===
                                    "PRODUCTION"
                                );
                            }
                        );

                    if (active) {
                        setBoms(
                            approvedBoms
                        );

                        setLocations(
                            productionLocations
                        );

                        if (
                            initialBomId &&
                            !approvedBoms.some(
                                (bom) =>
                                    String(
                                        bom.id
                                    ) ===
                                    String(
                                        initialBomId
                                    )
                            )
                        ) {
                            setSelectedBomId(
                                ""
                            );
                        }
                    }
                } catch (requestError) {
                    if (active) {
                        setError(
                            readMatFlowError(
                                requestError,
                                "Unable to load approved BOMs and Production locations."
                            )
                        );
                    }
                } finally {
                    if (active) {
                        setLoading(false);
                    }
                }
            };

        loadInitialData();

        return () => {
            active = false;
        };
    }, [initialBomId]);

    useEffect(() => {
        if (!selectedBomId) {
            setSelectedBom(null);
            setLineInputs({});
            setOpenSections({});
            return undefined;
        }

        let active = true;

        const loadBom =
            async () => {
                setBomLoading(true);
                setError("");

                try {
                    const response =
                        await matflowApi
                            .getBom(
                                selectedBomId
                            );

                    const loadedBom =
                        response?.data ||
                        null;

                    if (!active) {
                        return;
                    }

                    setSelectedBom(
                        loadedBom
                    );

                    const lines =
                        [
                            loadedBom?.lines,
                            loadedBom?.bomLines,
                            loadedBom?.items,
                        ].find(
                            Array.isArray
                        ) || [];

                    const initialLineInputs = {};

                    lines.forEach((line) => {
                        if (!line?.id) {
                            return;
                        }

                        const bomQuantity =
                            lineRequiredQty(
                                line
                            );

                        initialLineInputs[
                            String(line.id)
                        ] = {
                            requestedQty:
                                Number.isFinite(
                                    bomQuantity
                                ) &&
                                    bomQuantity > 0
                                    ? String(
                                        bomQuantity
                                    )
                                    : "",

                            remarks: "",
                        };
                    });

                    setLineInputs(
                        initialLineInputs
                    );

                    const sections = {};

                    lines.forEach(
                        (line) => {
                            sections[
                                lineCategory(
                                    line
                                )
                            ] = true;
                        }
                    );

                    setOpenSections(
                        sections
                    );
                } catch (requestError) {
                    if (active) {
                        setSelectedBom(null);

                        setError(
                            readMatFlowError(
                                requestError,
                                "Unable to load the selected operational BOM."
                            )
                        );
                    }
                } finally {
                    if (active) {
                        setBomLoading(false);
                    }
                }
            };

        loadBom();

        return () => {
            active = false;
        };
    }, [selectedBomId]);

    const bomLines =
        useMemo(() => {
            const candidates = [
                selectedBom?.lines,
                selectedBom?.bomLines,
                selectedBom?.items,
            ];

            return (
                candidates.find(
                    Array.isArray
                ) || []
            );
        }, [selectedBom]);

    const requestFullBom = () => {
        const next = {};

        bomLines.forEach((line) => {
            if (!line?.id) {
                return;
            }

            const quantity =
                lineRequiredQty(
                    line
                );

            next[
                String(line.id)
            ] = {
                requestedQty:
                    Number.isFinite(
                        quantity
                    ) &&
                        quantity > 0
                        ? String(
                            quantity
                        )
                        : "",

                remarks:
                    lineInputs[
                        String(line.id)
                    ]?.remarks ||
                    "",
            };
        });

        setLineInputs(next);
    };

    const clearRequestedQuantities = () => {
        setLineInputs(
            (current) => {
                const next = {};

                bomLines.forEach(
                    (line) => {
                        if (!line?.id) {
                            return;
                        }

                        next[
                            String(line.id)
                        ] = {
                            requestedQty:
                                "",

                            remarks:
                                current[
                                    String(
                                        line.id
                                    )
                                ]?.remarks ||
                                "",
                        };
                    }
                );

                return next;
            }
        );
    };

    const project =
        useMemo(() => {
            return (
                selectedBom?.projectDrawing ||
                selectedBom?.project ||
                selectedBom?.projectContext ||
                {}
            );
        }, [selectedBom]);

    const bomPlantCode =
        String(
            project.plantCode ||
            selectedBom?.plantCode ||
            selectedBom?.owningPlantCode ||
            ""
        ).toUpperCase();

    const destinationOptions =
        useMemo(() => {
            const activeProductionLocations =
                locations.filter(
                    (location) => {
                        return (
                            Boolean(
                                location?.id
                            ) &&
                            location.active !==
                            false &&
                            normalizeLocationType(
                                location.locationType
                            ) ===
                            "PRODUCTION"
                        );
                    }
                );

            if (!bomPlantCode) {
                return activeProductionLocations;
            }

            return activeProductionLocations.filter(
                (location) => {
                    return (
                        String(
                            location.plantCode ||
                            ""
                        )
                            .trim()
                            .toUpperCase() ===
                        bomPlantCode
                    );
                }
            );
        }, [
            bomPlantCode,
            locations,
        ]);

    useEffect(() => {
        if (
            !selectedBom ||
            bomLoading
        ) {
            setLocationError("");
            return;
        }

        if (
            destinationOptions.length === 0
        ) {
            setDestinationLocationId("");

            setLocationError(
                bomPlantCode
                    ? `No active PRODUCTION location is configured for plant ${bomPlantCode}. Create the Production location in MatFlow Location Master first.`
                    : "No active PRODUCTION location is configured in MatFlow."
            );

            return;
        }

        setLocationError("");

        const currentlySelectedExists =
            destinationOptions.some(
                (location) =>
                    String(location.id) ===
                    String(
                        destinationLocationId
                    )
            );

        if (
            !currentlySelectedExists
        ) {
            setDestinationLocationId(
                destinationOptions.length === 1
                    ? destinationOptions[0].id
                    : ""
            );
        }
    }, [
        selectedBom,
        bomLoading,
        bomPlantCode,
        destinationOptions,
        destinationLocationId,
    ]);

    const sections =
        useMemo(() => {
            const grouped =
                new Map();

            bomLines.forEach(
                (line) => {
                    const category =
                        lineCategory(
                            line
                        );

                    const meta =
                        getMatFlowCategoryMeta(
                            category
                        );

                    if (
                        !grouped.has(
                            category
                        )
                    ) {
                        grouped.set(
                            category,
                            {
                                key:
                                    category,
                                title:
                                    meta.label ||
                                    category,
                                color:
                                    meta.color ||
                                    "#60a5fa",
                                lines: [],
                            }
                        );
                    }

                    grouped
                        .get(category)
                        .lines.push(line);
                }
            );

            return Array.from(
                grouped.values()
            );
        }, [bomLines]);

    const updateLine = (
        lineId,
        key,
        value
    ) => {
        setLineInputs(
            (current) => ({
                ...current,

                [lineId]: {
                    requestedQty:
                        current[lineId]
                            ?.requestedQty ||
                        "",

                    remarks:
                        current[lineId]
                            ?.remarks ||
                        "",

                    [key]: value,
                },
            })
        );
    };

    const selectedRequestLines =
        useMemo(() => {
            return bomLines
                .map((line) => {
                    const input =
                        lineInputs[
                        line.id
                        ] || {};

                    const requestedQty =
                        Number(
                            input.requestedQty
                        );

                    return {
                        line,
                        requestedQty,
                        remarks:
                            clean(
                                input.remarks
                            ) ||
                            null,
                    };
                })
                .filter(
                    (entry) =>
                        Number.isFinite(
                            entry.requestedQty
                        ) &&
                        entry.requestedQty > 0
                );
        }, [
            bomLines,
            lineInputs,
        ]);

    const totalRequested =
        useMemo(() => {
            return selectedRequestLines.reduce(
                (
                    total,
                    entry
                ) =>
                    total +
                    entry.requestedQty,
                0
            );
        }, [selectedRequestLines]);

    const createDisabledReason =
        useMemo(() => {
            if (!selectedBom?.id) {
                return "Select an approved operational BOM.";
            }

            if (
                destinationOptions.length ===
                0
            ) {
                return "No Production destination is configured.";
            }

            if (!destinationLocationId) {
                return "Select a Production destination.";
            }

            if (
                selectedRequestLines.length ===
                0
            ) {
                return "Enter a quantity under Request Now for at least one material.";
            }

            return "";
        }, [
            destinationLocationId,
            destinationOptions.length,
            selectedBom,
            selectedRequestLines.length,
        ]);

    const toggleSection = (
        key
    ) => {
        setOpenSections(
            (current) => ({
                ...current,
                [key]:
                    !current[key],
            })
        );
    };

    const createRequisition =
        async () => {
            if (!selectedBom?.id) {
                setError(
                    "Select an approved operational BOM."
                );
                return;
            }

            if (
                String(
                    selectedBom.status ||
                    ""
                ).toUpperCase() !==
                "APPROVED" ||
                selectedBom.effective !==
                true
            ) {
                setError(
                    "Only an approved and effective BOM revision can be used."
                );
                return;
            }

            const projectDrawingId =
                selectedBom.projectDrawingId ||
                project.id;

            if (!projectDrawingId) {
                setError(
                    "The selected BOM does not contain a project drawing ID."
                );
                return;
            }

            if (!destinationLocationId) {
                setError(
                    "Select a Production destination."
                );
                return;
            }

            if (
                selectedRequestLines.length ===
                0
            ) {
                setError(
                    "Enter a requested quantity for at least one material."
                );
                return;
            }

            for (
                const entry
                of selectedRequestLines
            ) {
                const maximumQty =
                    lineRequiredQty(
                        entry.line
                    );

                if (
                    entry.requestedQty >
                    maximumQty
                ) {
                    setError(
                        `${lineMaterialName(
                            entry.line
                        )}: requested quantity cannot exceed ${formatQty(
                            maximumQty
                        )} ${lineUom(
                            entry.line
                        )}.`
                    );
                    return;
                }
            }

            const body = {
                projectDrawingId:
                    String(
                        projectDrawingId
                    ),

                bomId:
                    String(
                        selectedBom.id
                    ),

                destinationLocationId:
                    String(
                        destinationLocationId
                    ),

                remarks:
                    clean(remarks) ||
                    null,

                lines:
                    selectedRequestLines.map(
                        (entry) => ({
                            bomLineId:
                                String(
                                    entry.line.id
                                ),

                            requestedQty:
                                entry.requestedQty,

                            remarks:
                                entry.remarks,
                        })
                    ),
            };

            setSaving(true);
            setError("");

            try {
                const response =
                    await matflowApi
                        .createRequisition(
                            body
                        );

                const created =
                    response?.data;

                if (!created?.id) {
                    throw new Error(
                        "The created requisition ID was not returned."
                    );
                }

                navigate(
                    `/matflow/requisitions/${created.id}`,
                    {
                        replace: true,
                    }
                );
            } catch (requestError) {
                setError(
                    readMatFlowError(
                        requestError,
                        "Unable to create the production requisition."
                    )
                );
            } finally {
                setSaving(false);
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
                <Box sx={headerRowSx}>
                    <Box>
                        <Chip
                            label="NEW PRODUCTION REQUISITION"
                            sx={heroBadgeSx}
                        />

                        <Typography sx={heroTitleSx}>
                            Raise Material Requisition
                        </Typography>

                        <Typography sx={heroSubSx}>
                            Select an approved operational
                            BOM, choose the Production
                            destination and enter the
                            quantities required now.
                        </Typography>
                    </Box>

                    <Button
                        startIcon={
                            <ArrowBackIcon />
                        }
                        onClick={() =>
                            navigate(
                                "/matflow/production"
                            )
                        }
                        sx={secondaryBtnSx}
                    >
                        Back
                    </Button>
                </Box>
            </Box>

            {error && (
                <Box sx={errorBoxSx}>
                    {error}
                </Box>
            )}

            <Card sx={panelSx}>
                <Box sx={headerFormGridSx}>
                    <TextField
                        select
                        label="Approved Operational BOM *"
                        value={
                            selectedBomId
                        }
                        disabled={
                            saving ||
                            bomLoading
                        }
                        onChange={(event) => {
                            setSelectedBomId(
                                event.target.value
                            );

                            setDestinationLocationId(
                                ""
                            );
                        }}
                        sx={fieldSx}
                    >
                        {boms.map(
                            (bom) => (
                                <MenuItem
                                    key={bom.id}
                                    value={bom.id}
                                >
                                    {bom.bomNumber ||
                                        "-"}
                                    {" · "}
                                    {bom.projectCode ||
                                        bom.pdNo ||
                                        "-"}
                                    {" · "}
                                    {bom.drawingNo ||
                                        "-"}
                                </MenuItem>
                            )
                        )}
                    </TextField>

                    <TextField
                        select
                        label="Production Destination *"
                        value={
                            destinationLocationId
                        }
                        disabled={
                            saving ||
                            bomLoading ||
                            !selectedBom ||
                            destinationOptions.length === 0
                        }
                        onChange={(event) =>
                            setDestinationLocationId(
                                event.target.value
                            )
                        }
                        helperText={
                            !selectedBom
                                ? "Select an approved BOM first."
                                : destinationOptions.length === 0
                                    ? "No matching active Production location is configured."
                                    : `${destinationOptions.length} Production destination${destinationOptions.length === 1
                                        ? ""
                                        : "s"
                                    } available.`
                        }
                        sx={fieldSx}
                    >
                        {destinationOptions.map(
                            (location) => (
                                <MenuItem
                                    key={location.id}
                                    value={location.id}
                                >
                                    {location.locationCode ||
                                        "-"}
                                    {" · "}
                                    {location.locationName ||
                                        "-"}
                                    {" · "}
                                    {location.plantCode ||
                                        "-"}
                                </MenuItem>
                            )
                        )}
                    </TextField>

                    <TextField
                        label="Requisition Remarks"
                        multiline
                        minRows={3}
                        value={remarks}
                        disabled={saving}
                        onChange={(event) =>
                            setRemarks(
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
            </Card>
            {locationError && (
                <Box sx={errorBoxSx}>
                    {locationError}
                </Box>
            )}

            {bomLoading && (
                <Box sx={loadingSx}>
                    <CircularProgress />
                </Box>
            )}

            {selectedBom && !bomLoading && (
                <>
                    <Card sx={panelSx}>
                        <Box sx={contextGridSx}>
                            <Detail
                                label="BOM"
                                value={
                                    selectedBom.bomNumber
                                }
                            />

                            <Detail
                                label="Revision"
                                value={
                                    selectedBom.revisionNo
                                }
                            />

                            <Detail
                                label="Project / PD"
                                value={
                                    project.projectCode ||
                                    selectedBom.projectCode
                                }
                            />

                            <Detail
                                label="Drawing"
                                value={
                                    project.drawingNo ||
                                    selectedBom.drawingNo
                                }
                            />

                            <Detail
                                label="Plant"
                                value={
                                    project.plantCode ||
                                    selectedBom.plantCode
                                }
                            />

                            <Detail
                                label="Selected Lines"
                                value={
                                    selectedRequestLines.length
                                }
                            />

                            <Detail
                                label="Total Requested"
                                value={
                                    formatQty(
                                        totalRequested
                                    )
                                }
                            />
                        </Box>
                    </Card>

                    <Card sx={panelSx}>
                        <Box sx={quantityActionRowSx}>
                            <Box>
                                <Typography sx={quantityActionTitleSx}>
                                    Requisition Quantities
                                </Typography>

                                <Typography sx={quantityActionSubSx}>
                                    Request the complete BOM or enter only
                                    the quantities currently required.
                                </Typography>
                            </Box>

                            <Box sx={quantityButtonsSx}>
                                <Button
                                    onClick={clearRequestedQuantities}
                                    disabled={
                                        saving ||
                                        bomLines.length === 0
                                    }
                                    sx={secondaryBtnSx}
                                >
                                    Clear Quantities
                                </Button>

                                <Button
                                    onClick={requestFullBom}
                                    disabled={
                                        saving ||
                                        bomLines.length === 0
                                    }
                                    sx={primaryBtnSx}
                                >
                                    Request Full BOM
                                </Button>
                            </Box>
                        </Box>
                    </Card>

                    <Box sx={sectionListSx}>
                        {sections.map(
                            (section) => {
                                const open =
                                    openSections[
                                    section.key
                                    ] !== false;

                                return (
                                    <Card
                                        key={
                                            section.key
                                        }
                                        sx={sectionCardSx(
                                            section.color
                                        )}
                                    >
                                        <Box sx={sectionHeaderSx}>
                                            <Box sx={sectionLeftSx}>
                                                <IconButton
                                                    onClick={() =>
                                                        toggleSection(
                                                            section.key
                                                        )
                                                    }
                                                    sx={expandButtonSx}
                                                >
                                                    {open
                                                        ? <ExpandLessIcon />
                                                        : <ExpandMoreIcon />}
                                                </IconButton>

                                                <Box>
                                                    <Typography sx={sectionTitleSx}>
                                                        {section.title}
                                                    </Typography>

                                                    <Typography sx={sectionSubSx}>
                                                        {section.lines.length}
                                                        {" "}
                                                        material line
                                                        {section.lines.length ===
                                                            1
                                                            ? ""
                                                            : "s"}
                                                    </Typography>
                                                </Box>
                                            </Box>

                                            <Chip
                                                label={`${section.lines.length} LINES`}
                                                size="small"
                                                sx={categoryChipSx(
                                                    section.color
                                                )}
                                            />
                                        </Box>

                                        <Collapse in={open}>
                                            <Box sx={tableShellSx}>
                                                <Box sx={lineHeaderSx}>
                                                    <Box sx={tableCellSx}>
                                                        Line
                                                    </Box>

                                                    <Box sx={tableCellSx}>
                                                        Material
                                                    </Box>

                                                    <Box sx={tableCellSx}>
                                                        Specification
                                                    </Box>

                                                    <Box sx={tableCellSx}>
                                                        BOM Quantity
                                                    </Box>

                                                    <Box sx={tableCellSx}>
                                                        Request Now
                                                    </Box>

                                                    <Box sx={tableCellSx}>
                                                        Unit
                                                    </Box>

                                                    <Box sx={tableCellSx}>
                                                        Line Remarks
                                                    </Box>
                                                </Box>

                                                {section.lines.map(
                                                    (
                                                        line,
                                                        index
                                                    ) => {
                                                        const input =
                                                            lineInputs[
                                                            line.id
                                                            ] || {};

                                                        return (
                                                            <Box
                                                                key={
                                                                    line.id ||
                                                                    index
                                                                }
                                                                sx={lineRowSx}
                                                            >
                                                                <Box sx={tableCellSx}>
                                                                    {line.lineNo ??
                                                                        index +
                                                                        1}
                                                                </Box>

                                                                <Box sx={tableCellSx}>
                                                                    <Typography sx={mainTextSx}>
                                                                        {lineMaterialName(
                                                                            line
                                                                        )}
                                                                    </Typography>

                                                                    <Typography sx={subTextSx}>
                                                                        {lineMaterialCode(
                                                                            line
                                                                        )}
                                                                    </Typography>
                                                                </Box>

                                                                <Box sx={tableCellSx}>
                                                                    {line.specification ||
                                                                        line.specificationSnapshot ||
                                                                        "-"}
                                                                </Box>

                                                                <Box sx={tableCellSx}>
                                                                    {formatQty(
                                                                        lineRequiredQty(
                                                                            line
                                                                        )
                                                                    )}
                                                                </Box>

                                                                <Box sx={tableCellSx}>
                                                                    <TextField
                                                                        type="number"
                                                                        size="small"
                                                                        value={
                                                                            input.requestedQty ||
                                                                            ""
                                                                        }
                                                                        disabled={
                                                                            saving
                                                                        }
                                                                        onChange={(event) =>
                                                                            updateLine(
                                                                                line.id,
                                                                                "requestedQty",
                                                                                event.target.value
                                                                            )
                                                                        }
                                                                        inputProps={{
                                                                            min: 0,
                                                                            max:
                                                                                lineRequiredQty(
                                                                                    line
                                                                                ),
                                                                            step:
                                                                                0.001,
                                                                        }}
                                                                        sx={quantityFieldSx}
                                                                    />
                                                                </Box>

                                                                <Box sx={tableCellSx}>
                                                                    {lineUom(
                                                                        line
                                                                    )}
                                                                </Box>

                                                                <Box sx={tableCellSx}>
                                                                    <TextField
                                                                        size="small"
                                                                        value={
                                                                            input.remarks ||
                                                                            ""
                                                                        }
                                                                        disabled={
                                                                            saving
                                                                        }
                                                                        onChange={(event) =>
                                                                            updateLine(
                                                                                line.id,
                                                                                "remarks",
                                                                                event.target.value
                                                                            )
                                                                        }
                                                                        sx={lineRemarksSx}
                                                                    />
                                                                </Box>
                                                            </Box>
                                                        );
                                                    }
                                                )}
                                            </Box>
                                        </Collapse>
                                    </Card>
                                );
                            }
                        )}
                    </Box>
                    <Box sx={actionAreaSx}>
                        {createDisabledReason && (
                            <Typography sx={disabledReasonSx}>
                                {createDisabledReason}
                            </Typography>
                        )}

                        <Button
                            startIcon={
                                <SaveOutlinedIcon />
                            }
                            onClick={
                                createRequisition
                            }
                            disabled={
                                saving ||
                                bomLoading ||
                                Boolean(
                                    createDisabledReason
                                )
                            }
                            sx={primaryBtnSx}
                        >
                            {saving
                                ? "Creating..."
                                : "Create Requisition Draft"}
                        </Button>
                    </Box>
                </>
            )}
        </Box>
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

const headerRowSx = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "14px",
    flexWrap: "wrap",
};

const headerFormGridSx = {
    display: "grid",
    gridTemplateColumns:
        "repeat(2,minmax(0,1fr))",
    gap: "12px",

    "@media (max-width: 760px)": {
        gridTemplateColumns: "1fr",
    },
};

const contextGridSx = {
    display: "grid",
    gridTemplateColumns:
        "repeat(auto-fit,minmax(170px,1fr))",
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
    transition:
        "background .18s ease, border-color .18s ease",

    "&:hover": {
        background:
            "var(--mf-hover)",
        borderColor:
            "var(--mf-border-strong)",
    },
};

const detailLabelSx = {
    color:
        "var(--mf-text-muted)",
    fontSize: "9.5px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".07em",
};

const detailValueSx = {
    mt: "5px",
    color:
        "var(--mf-text)",
    fontSize: "12px",
    fontWeight: 850,
    overflowWrap: "anywhere",
};

const actionAreaSx = {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "7px",
    pt: "2px",

    "@media (max-width: 600px)": {
        alignItems: "stretch",

        "& .MuiButton-root": {
            width: "100%",
        },
    },
};

const disabledReasonSx = {
    maxWidth: "620px",
    color:
        "var(--mf-text-muted)",
    fontSize: "10.5px",
    fontWeight: 700,
    lineHeight: 1.45,
    textAlign: "right",

    "@media (max-width: 600px)": {
        textAlign: "left",
    },
};

const sectionListSx = {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
};

const sectionCardSx = (
    color
) => ({
    overflow: "hidden",
    borderRadius: "11px",
    color:
        "var(--mf-text)",
    background:
        "var(--mf-panel-bg)",
    border:
        `1px solid ${color}38`,
    borderLeft:
        `3px solid ${color}`,
    boxShadow:
        "var(--mf-shadow)",
    backgroundImage: "none",
    transition:
        "background .18s ease, border-color .18s ease, transform .18s ease",

    "&:hover": {
        borderColor:
            `${color}58`,
    },
});

const sectionHeaderSx = {
    minHeight: "58px",
    px: "13px",
    py: "9px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    background:
        "var(--mf-surface-soft)",
    borderBottom:
        "1px solid var(--mf-border)",

    "@media (max-width: 600px)": {
        alignItems: "flex-start",
    },
};

const sectionLeftSx = {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    minWidth: 0,
};

const expandButtonSx = {
    width: "31px",
    height: "31px",
    flexShrink: 0,
    color:
        "var(--mf-text-muted)",
    background:
        "var(--mf-field-bg)",
    border:
        "1px solid var(--mf-border)",

    "&:hover": {
        color:
            "var(--mf-text)",
        background:
            "var(--mf-hover)",
        borderColor:
            "var(--mf-border-strong)",
    },
};

const sectionTitleSx = {
    color:
        "var(--mf-text)",
    fontSize: "15px",
    fontWeight: 950,
    lineHeight: 1.2,
    overflowWrap: "anywhere",
};

const sectionSubSx = {
    mt: "2px",
    color:
        "var(--mf-text-muted)",
    fontSize: "10.5px",
    fontWeight: 650,
};

const categoryChipSx = (
    color
) => ({
    height: "22px",
    flexShrink: 0,
    borderRadius: 999,
    color,
    background:
        `${color}16`,
    border:
        `1px solid ${color}30`,
    fontSize: "9px",
    fontWeight: 900,

    "& .MuiChip-label": {
        px: "9px",
    },
});

const lineColumns =
    "55px minmax(210px,1.25fr) minmax(230px,1.35fr) 115px 135px 75px minmax(190px,1fr)";

const lineHeaderSx = {
    ...tableHeaderSx,
    gridTemplateColumns:
        lineColumns,
    minWidth: "1120px",
};

const lineRowSx = {
    ...tableRowSx,
    gridTemplateColumns:
        lineColumns,
    minWidth: "1120px",

    "&:last-child": {
        borderBottom: 0,
    },
};

const mainTextSx = {
    color:
        "var(--mf-text)",
    fontSize: "12px",
    fontWeight: 850,
    lineHeight: 1.35,
    overflowWrap: "anywhere",
    whiteSpace: "normal",
};

const subTextSx = {
    mt: "2px",
    color:
        "var(--mf-text-muted)",
    fontSize: "10px",
    fontWeight: 650,
    lineHeight: 1.35,
    overflowWrap: "anywhere",
    whiteSpace: "normal",
};

const quantityFieldSx = {
    minWidth: "105px",

    "& .MuiOutlinedInput-root": {
        height: "36px",
        borderRadius: "8px",
        color:
            "var(--mf-text)",
        background:
            "var(--mf-field-bg)",
        fontSize: "12px",
        fontWeight: 800,

        "& fieldset": {
            borderColor:
                "var(--mf-border)",
        },

        "&:hover fieldset": {
            borderColor:
                "var(--mf-border-strong)",
        },

        "&.Mui-focused fieldset": {
            borderColor: "#0284c7",
        },
    },

    "& .MuiInputBase-input": {
        py: "8px",
        color:
            "var(--mf-text)",
        fontSize: "12px",
        fontWeight: 800,
    },

    "& .MuiInputBase-input.Mui-disabled": {
        WebkitTextFillColor:
            "var(--mf-text-muted)",
    },
};

const lineRemarksSx = {
    minWidth: "165px",

    "& .MuiOutlinedInput-root": {
        height: "36px",
        borderRadius: "8px",
        color:
            "var(--mf-text)",
        background:
            "var(--mf-field-bg)",
        fontSize: "11px",

        "& fieldset": {
            borderColor:
                "var(--mf-border)",
        },

        "&:hover fieldset": {
            borderColor:
                "var(--mf-border-strong)",
        },

        "&.Mui-focused fieldset": {
            borderColor: "#0284c7",
        },
    },

    "& .MuiInputBase-input": {
        py: "8px",
        color:
            "var(--mf-text)",
        fontSize: "11px",
    },

    "& .MuiInputBase-input.Mui-disabled": {
        WebkitTextFillColor:
            "var(--mf-text-muted)",
    },
};

const quantityActionRowSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
};

const quantityActionTitleSx = {
    color:
        "var(--mf-text)",
    fontSize: "15px",
    fontWeight: 950,
};

const quantityActionSubSx = {
    mt: "3px",
    maxWidth: "660px",
    color:
        "var(--mf-text-muted)",
    fontSize: "10.5px",
    fontWeight: 650,
    lineHeight: 1.5,
};

const quantityButtonsSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "8px",
    flexWrap: "wrap",

    "@media (max-width: 520px)": {
        width: "100%",

        "& .MuiButton-root": {
            flex: 1,
            minWidth: "150px",
        },
    },
};