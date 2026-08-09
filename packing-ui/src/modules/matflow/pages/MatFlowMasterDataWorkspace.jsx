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
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";

import {
    MATFLOW_ROLES,
    useMatFlow,

    ErrorBox,
    EmptyState,
    LoadingBlock,
    MATFLOW_MATERIAL_CATEGORIES,
    MatFlowStatusChip,
    PageHero,

    clean,
    dialogActionsSx,
    dialogContentSx,
    dialogPaperSx,
    dialogTitleSx,
    fieldSx,
    mainTextSx,
    normalize,
    pageSx,
    panelSx,
    primaryBtnSx,
    secondaryBtnSx,
    subTextSx,
    tableCellSx,
    tableHeaderSx,
    tableRowSx,
    tableShellSx,
} from "../matflowUi";

import {
    extractMatFlowPage,
    matflowApi,
    readMatFlowError,
} from "../api/matflowApi";


/*
 * =========================================================
 * FALLBACK ENUMS
 * =========================================================
 *
 * These are used only when /matflow/meta is unavailable or
 * the backend response does not contain the corresponding
 * enum.
 *
 * The backend metadata remains the preferred source.
 */

const FALLBACK_LOCATION_TYPES = Object.freeze([
    "STORE",
    "PRODUCTION",
    "PROCESSING",
    "QC",
    "TRANSIT",
    "EXTERNAL_PROCESSOR",
    "SUPPLIER",
]);

const FALLBACK_OWNERSHIP_TYPES = Object.freeze([
    "INTERNAL",
    "EXTERNAL",
]);


/*
 * =========================================================
 * METADATA HELPERS
 * =========================================================
 */

const uniqueStrings = (
    values
) => {
    if (
        !Array.isArray(values)
    ) {
        return [];
    }

    return Array.from(
        new Set(
            values
                .map((value) =>
                    String(
                        value ?? ""
                    )
                        .trim()
                        .toUpperCase()
                )
                .filter(Boolean)
        )
    );
};


const readMetadataEnum = (
    payload,
    key
) => {
    /*
     * Supported response shapes:
     *
     * {
     *   enums: {
     *      locationType: [...]
     *   }
     * }
     *
     * {
     *   data: {
     *      enums: {...}
     *   }
     * }
     *
     * {
     *   locationType: [...]
     * }
     */

    const candidates = [
        payload?.enums?.[key],
        payload?.data?.enums?.[key],
        payload?.[key],
        payload?.data?.[key],
    ];

    for (
        const candidate
        of candidates
    ) {
        const values =
            uniqueStrings(
                candidate
            );

        if (
            values.length > 0
        ) {
            return values;
        }
    }

    return [];
};


/*
 * =========================================================
 * MASTER DEFINITIONS
 * =========================================================
 */

const MASTER_CONFIG = {

    /*
     * =====================================================
     * MATERIAL MASTER
     * =====================================================
     *
     * Backend write authority:
     *
     * ADMIN
     * MATFLOW_MANAGER
     * MATFLOW_STORE
     * MATFLOW_PURCHASE
     *
     * Engineering can read materials where permitted,
     * but does not own Material Master maintenance.
     */

    materials: {
        badge:
            "MATFLOW MATERIAL MASTER",

        title:
            "Material Master",

        subtitle:
            "Maintain standardized material codes, categories, UOM and operational stocking controls.",

        canManage: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.STORE,
            MATFLOW_ROLES.PURCHASE,
        ],

        load: (
            search
        ) =>
            matflowApi.listMaterials({
                search:
                    search ||
                    undefined,
            }),

        create:
            matflowApi.createMaterial,

        update:
            matflowApi.updateMaterial,

        columns: [
            "Material",
            "Category",
            "UOM",
            "Minimum / Reorder",
            "Status",
            "Action",
        ],

        empty: {
            materialCode: "",
            materialName: "",
            category: "",
            specification: "",
            uom: "",
            preferredSupplier: "",
            minimumStock: "0",
            reorderLevel: "0",
            active: true,
        },

        fields: [
            [
                "materialCode",
                "Material Code *",
            ],
            [
                "materialName",
                "Material Name *",
            ],
            [
                "category",
                "Category *",
                "category",
            ],
            [
                "uom",
                "UOM *",
            ],
            [
                "specification",
                "Specification",
                "multiline",
            ],
            [
                "preferredSupplier",
                "Preferred Supplier",
            ],
            [
                "minimumStock",
                "Minimum Stock",
                "number",
            ],
            [
                "reorderLevel",
                "Reorder Level",
                "number",
            ],
        ],

        validate(
            form
        ) {
            if (
                !clean(
                    form.materialCode
                )
            ) {
                return "Material code is required.";
            }

            if (
                !clean(
                    form.materialName
                )
            ) {
                return "Material name is required.";
            }

            if (
                !clean(
                    form.category
                )
            ) {
                return "Material category is required.";
            }

            if (
                !clean(
                    form.uom
                )
            ) {
                return "Material UOM is required.";
            }

            const minimumStock =
                Number(
                    form.minimumStock ||
                    0
                );

            const reorderLevel =
                Number(
                    form.reorderLevel ||
                    0
                );

            if (
                !Number.isFinite(
                    minimumStock
                ) ||
                !Number.isFinite(
                    reorderLevel
                )
            ) {
                return "Stock limits must be valid numbers.";
            }

            if (
                minimumStock < 0 ||
                reorderLevel < 0
            ) {
                return "Stock limits cannot be negative.";
            }

            return "";
        },

        body(
            form,
            row
        ) {
            return {
                materialCode:
                    normalize(
                        form.materialCode
                    ),

                materialName:
                    clean(
                        form.materialName
                    ),

                category:
                    normalize(
                        form.category
                    ),

                specification:
                    clean(
                        form.specification
                    ) ||
                    null,

                uom:
                    normalize(
                        form.uom
                    ),

                preferredSupplier:
                    clean(
                        form.preferredSupplier
                    ) ||
                    null,

                minimumStock:
                    Number(
                        form.minimumStock ||
                        0
                    ),

                reorderLevel:
                    Number(
                        form.reorderLevel ||
                        0
                    ),

                active:
                    form.active ===
                    true,

                rowVersion:
                    row?.rowVersion ??
                    null,
            };
        },

        cells(
            row,
            canManage,
            edit
        ) {
            return [
                <Box key="material">
                    <Typography
                        sx={mainTextSx}
                    >
                        {row.materialCode ||
                            "-"}
                    </Typography>

                    <Typography
                        sx={subTextSx}
                    >
                        {row.materialName ||
                            "-"}
                    </Typography>
                </Box>,

                row.category ||
                "-",

                row.uom ||
                "-",

                `${row.minimumStock ?? 0} / ${row.reorderLevel ?? 0}`,

                <MatFlowStatusChip
                    key="status"
                    status={
                        row.active
                            ? "ACTIVE"
                            : "INACTIVE"
                    }
                />,

                canManage
                    ? (
                        <Button
                            key="action"
                            startIcon={
                                <EditOutlinedIcon />
                            }
                            onClick={() =>
                                edit(
                                    row
                                )
                            }
                            sx={
                                secondaryBtnSx
                            }
                        >
                            Edit
                        </Button>
                    )
                    : "-",
            ];
        },
    },


    /*
     * =====================================================
     * PROJECT / PRODUCT / DRAWING MASTER
     * =====================================================
     */

    projects: {
        badge:
            "PROJECT & DRAWING MASTER",

        title:
            "Projects and Product Drawings",

        subtitle:
            "Register the client project, product/drawing and owning plant used by operational BOMs.",

        canManage: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.ENGINEERING,
        ],

        load: (
            search
        ) =>
            matflowApi.listProjects({
                search:
                    search ||
                    undefined,
            }),

        create:
            matflowApi.createProject,

        update:
            matflowApi.updateProject,

        columns: [
            "Project",
            "Product / Drawing",
            "Client",
            "Plant",
            "Required",
            "Status",
            "Action",
        ],

        empty: {
            projectCode: "",
            projectName: "",
            clientName: "",
            drawingNo: "",
            drawingRevision: "0",
            productName: "",
            plantCode: "",
            requiredDate: "",
            remarks: "",
            active: true,
        },

        fields: [
            [
                "projectCode",
                "Project / PD Code *",
            ],
            [
                "projectName",
                "Project Name *",
            ],
            [
                "clientName",
                "Client Name *",
            ],
            [
                "productName",
                "Product / Item *",
            ],
            [
                "drawingNo",
                "Drawing No. *",
            ],
            [
                "drawingRevision",
                "Drawing Revision",
            ],
            [
                "plantCode",
                "Owning Plant *",
                "plant",
            ],
            [
                "requiredDate",
                "Required Date",
                "date",
            ],
            [
                "remarks",
                "Remarks",
                "multiline",
            ],
        ],

        validate(
            form
        ) {
            if (
                !clean(
                    form.projectCode
                )
            ) {
                return "Project / PD code is required.";
            }

            if (
                !clean(
                    form.projectName
                )
            ) {
                return "Project name is required.";
            }

            if (
                !clean(
                    form.clientName
                )
            ) {
                return "Client name is required.";
            }

            if (
                !clean(
                    form.productName
                )
            ) {
                return "Product name is required.";
            }

            if (
                !clean(
                    form.drawingNo
                )
            ) {
                return "Drawing number is required.";
            }

            if (
                !clean(
                    form.plantCode
                )
            ) {
                return "Owning plant is required.";
            }

            return "";
        },

        body(
            form,
            row
        ) {
            return {
                projectCode:
                    normalize(
                        form.projectCode
                    ),

                projectName:
                    clean(
                        form.projectName
                    ),

                clientName:
                    clean(
                        form.clientName
                    ),

                drawingNo:
                    clean(
                        form.drawingNo
                    ),

                drawingRevision:
                    clean(
                        form.drawingRevision
                    ) ||
                    "0",

                productName:
                    clean(
                        form.productName
                    ),

                plantCode:
                    normalize(
                        form.plantCode
                    ),

                requiredDate:
                    clean(
                        form.requiredDate
                    ) ||
                    null,

                remarks:
                    clean(
                        form.remarks
                    ) ||
                    null,

                active:
                    form.active ===
                    true,

                rowVersion:
                    row?.rowVersion ??
                    null,
            };
        },

        cells(
            row,
            canManage,
            edit
        ) {
            return [
                <Box key="project">
                    <Typography
                        sx={mainTextSx}
                    >
                        {row.projectCode ||
                            "-"}
                    </Typography>

                    <Typography
                        sx={subTextSx}
                    >
                        {row.projectName ||
                            "-"}
                    </Typography>
                </Box>,

                <Box key="drawing">
                    <Typography
                        sx={mainTextSx}
                    >
                        {row.productName ||
                            "-"}
                    </Typography>

                    <Typography
                        sx={subTextSx}
                    >
                        {row.drawingNo ||
                            "-"}
                        {" · Rev "}
                        {row.drawingRevision ??
                            "-"}
                    </Typography>
                </Box>,

                row.clientName ||
                "-",

                row.owningPlantCode ||
                row.plantCode ||
                "-",

                row.requiredDate ||
                "-",

                <MatFlowStatusChip
                    key="status"
                    status={
                        row.active
                            ? "ACTIVE"
                            : "INACTIVE"
                    }
                />,

                canManage
                    ? (
                        <Button
                            key="action"
                            startIcon={
                                <EditOutlinedIcon />
                            }
                            onClick={() =>
                                edit(
                                    row
                                )
                            }
                            sx={
                                secondaryBtnSx
                            }
                        >
                            Edit
                        </Button>
                    )
                    : "-",
            ];
        },
    },


    /*
     * =====================================================
     * LOCATION MASTER
     * =====================================================
     */

    locations: {
        badge:
            "MATFLOW LOCATION MASTER",

        title:
            "Material Locations",

        subtitle:
            "Configure Store, Production, Processing, QC and external-processing locations used by material routing.",

        canManage: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.STORE,
        ],

        load: (
            search
        ) =>
            matflowApi.listLocations({
                search:
                    search ||
                    undefined,
            }),

        create:
            matflowApi.createLocation,

        update:
            matflowApi.updateLocation,

        columns: [
            "Location",
            "Plant",
            "Type",
            "Ownership",
            "Stock",
            "Status",
            "Action",
        ],

        empty: {
            locationCode: "",
            locationName: "",
            plantCode: "",
            locationType:
                "STORE",
            ownershipType:
                "INTERNAL",
            supportsStock: true,
            address: "",
            contactPerson: "",
            contactPhone: "",
            active: true,
        },

        fields: [
            [
                "locationCode",
                "Location Code *",
            ],
            [
                "locationName",
                "Location Name *",
            ],
            [
                "plantCode",
                "Plant *",
                "plant",
            ],
            [
                "locationType",
                "Location Type *",
                "locationType",
            ],
            [
                "ownershipType",
                "Ownership *",
                "ownership",
            ],
            [
                "address",
                "Address",
                "multiline",
            ],
            [
                "contactPerson",
                "Contact Person",
            ],
            [
                "contactPhone",
                "Contact Phone",
            ],
        ],

        validate(
            form
        ) {
            if (
                !clean(
                    form.locationCode
                )
            ) {
                return "Location code is required.";
            }

            if (
                !clean(
                    form.locationName
                )
            ) {
                return "Location name is required.";
            }

            if (
                !clean(
                    form.plantCode
                )
            ) {
                return "Plant code is required.";
            }

            if (
                !clean(
                    form.locationType
                )
            ) {
                return "Location type is required.";
            }

            if (
                !clean(
                    form.ownershipType
                )
            ) {
                return "Ownership type is required.";
            }

            return "";
        },

        body(
            form,
            row
        ) {
            return {
                locationCode:
                    normalize(
                        form.locationCode
                    ),

                locationName:
                    clean(
                        form.locationName
                    ),

                plantCode:
                    normalize(
                        form.plantCode
                    ),

                locationType:
                    normalize(
                        form.locationType
                    ),

                ownershipType:
                    normalize(
                        form.ownershipType ||
                        "INTERNAL"
                    ),

                supportsStock:
                    form.supportsStock ===
                    true,

                address:
                    clean(
                        form.address
                    ) ||
                    null,

                contactPerson:
                    clean(
                        form.contactPerson
                    ) ||
                    null,

                contactPhone:
                    clean(
                        form.contactPhone
                    ) ||
                    null,

                active:
                    form.active ===
                    true,

                rowVersion:
                    row?.rowVersion ??
                    null,
            };
        },

        cells(
            row,
            canManage,
            edit
        ) {
            return [
                <Box key="location">
                    <Typography
                        sx={mainTextSx}
                    >
                        {row.locationCode ||
                            "-"}
                    </Typography>

                    <Typography
                        sx={subTextSx}
                    >
                        {row.locationName ||
                            "-"}
                    </Typography>
                </Box>,

                row.plantCode ||
                "-",

                row.locationType ||
                "-",

                row.ownershipType ||
                "-",

                row.supportsStock
                    ? "Yes"
                    : "No",

                <MatFlowStatusChip
                    key="status"
                    status={
                        row.active
                            ? "ACTIVE"
                            : "INACTIVE"
                    }
                />,

                canManage
                    ? (
                        <Button
                            key="action"
                            startIcon={
                                <EditOutlinedIcon />
                            }
                            onClick={() =>
                                edit(
                                    row
                                )
                            }
                            sx={
                                secondaryBtnSx
                            }
                        >
                            Edit
                        </Button>
                    )
                    : "-",
            ];
        },
    },
};


/*
 * =========================================================
 * MASTER CRUD WORKSPACE
 * =========================================================
 */

function MasterCrudPage({
    type,
}) {
    const config =
        MASTER_CONFIG[type];

    const {
        role,
        availablePlants,
    } = useMatFlow();

    const canManage =
        config.canManage.includes(
            role
        );

    const [
        rows,
        setRows,
    ] = useState([]);

    const [
        loading,
        setLoading,
    ] = useState(true);

    const [
        saving,
        setSaving,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState("");

    const [
        search,
        setSearch,
    ] = useState("");

    const [
        dialog,
        setDialog,
    ] = useState(null);

    const [
        form,
        setForm,
    ] = useState({
        ...config.empty,
    });


    /*
     * Backend metadata.
     *
     * Loaded only because Location Master needs enums.
     *
     * Failure is intentionally non-blocking.
     */

    const [
        locationTypes,
        setLocationTypes,
    ] = useState(
        FALLBACK_LOCATION_TYPES
    );

    const [
        ownershipTypes,
        setOwnershipTypes,
    ] = useState(
        FALLBACK_OWNERSHIP_TYPES
    );


    const loadMetadata =
        useCallback(
            async () => {
                if (
                    type !==
                    "locations"
                ) {
                    return;
                }

                try {
                    const response =
                        await matflowApi.metadata();

                    const payload =
                        response?.data ??
                        {};

                    const backendLocationTypes =
                        readMetadataEnum(
                            payload,
                            "locationType"
                        );

                    /*
                     * Ownership metadata is optional.
                     * Keep fallback if backend does not expose it.
                     */
                    const backendOwnershipTypes =
                        readMetadataEnum(
                            payload,
                            "ownershipType"
                        );

                    if (
                        backendLocationTypes.length >
                        0
                    ) {
                        setLocationTypes(
                            backendLocationTypes
                        );
                    }

                    if (
                        backendOwnershipTypes.length >
                        0
                    ) {
                        setOwnershipTypes(
                            backendOwnershipTypes
                        );
                    }
                } catch {
                    /*
                     * Metadata is an enhancement here.
                     *
                     * The page must remain operational using
                     * the known backend-compatible fallback.
                     */
                }
            },
            [
                type,
            ]
        );


    useEffect(
        () => {
            loadMetadata();
        },
        [
            loadMetadata,
        ]
    );


    /*
     * =====================================================
     * LOAD ROWS
     * =====================================================
     */

    const load =
        useCallback(
            async () => {
                setLoading(
                    true
                );

                setError(
                    ""
                );

                try {
                    const response =
                        await config.load(
                            clean(
                                search
                            )
                        );

                    const page =
                        extractMatFlowPage(
                            response?.data
                        );

                    setRows(
                        page.rows
                    );
                } catch (
                requestError
                ) {
                    setRows(
                        []
                    );

                    setError(
                        readMatFlowError(
                            requestError,
                            `Unable to load ${config.title}.`
                        )
                    );
                } finally {
                    setLoading(
                        false
                    );
                }
            },
            [
                config,
                search,
            ]
        );


    useEffect(
        () => {
            load();
        },
        [
            load,
        ]
    );


    /*
     * =====================================================
     * CREATE
     * =====================================================
     */

    const openCreate =
        useCallback(
            () => {
                if (
                    !canManage
                ) {
                    return;
                }

                const firstPlant =
                    availablePlants?.[0] ||
                    "";

                setDialog({
                    row: null,
                });

                setForm({
                    ...config.empty,

                    plantCode:
                        config.empty
                            .plantCode ||
                        firstPlant,
                });

                setError(
                    ""
                );
            },
            [
                availablePlants,
                canManage,
                config,
            ]
        );


    /*
     * =====================================================
     * EDIT
     * =====================================================
     */

    const openEdit =
        useCallback(
            (
                row
            ) => {
                if (
                    !canManage ||
                    !row
                ) {
                    return;
                }

                const next = {
                    ...config.empty,
                };

                Object.keys(
                    next
                ).forEach(
                    (
                        key
                    ) => {
                        if (
                            row[key] !==
                            undefined &&
                            row[key] !==
                            null
                        ) {
                            /*
                             * Preserve booleans as booleans.
                             */
                            if (
                                typeof next[key] ===
                                "boolean"
                            ) {
                                next[key] =
                                    row[key] ===
                                    true;
                            } else {
                                next[key] =
                                    String(
                                        row[key]
                                    );
                            }
                        }
                    }
                );

                /*
                 * Some Project responses may expose the plant
                 * using the owningPlantCode alias.
                 */
                if (
                    type ===
                    "projects" &&
                    !clean(
                        next.plantCode
                    ) &&
                    clean(
                        row.owningPlantCode
                    )
                ) {
                    next.plantCode =
                        row.owningPlantCode;
                }

                next.active =
                    row.active !==
                    false;

                if (
                    "supportsStock" in
                    next
                ) {
                    next.supportsStock =
                        row.supportsStock !==
                        false;
                }

                setDialog({
                    row,
                });

                setForm(
                    next
                );

                setError(
                    ""
                );
            },
            [
                canManage,
                config,
                type,
            ]
        );


    /*
     * =====================================================
     * CLOSE DIALOG
     * =====================================================
     */

    const closeDialog =
        useCallback(
            () => {
                if (
                    saving
                ) {
                    return;
                }

                setDialog(
                    null
                );

                setError(
                    ""
                );
            },
            [
                saving,
            ]
        );


    /*
     * =====================================================
     * SAVE
     * =====================================================
     */

    const save =
        useCallback(
            async () => {
                if (
                    !canManage ||
                    !dialog
                ) {
                    return;
                }

                const message =
                    config.validate(
                        form
                    );

                if (
                    message
                ) {
                    setError(
                        message
                    );

                    return;
                }

                setSaving(
                    true
                );

                setError(
                    ""
                );

                try {
                    const body =
                        config.body(
                            form,
                            dialog?.row
                        );

                    if (
                        dialog?.row?.id
                    ) {
                        await config.update(
                            dialog.row.id,
                            body
                        );
                    } else {
                        await config.create(
                            body
                        );
                    }

                    setDialog(
                        null
                    );

                    await load();
                } catch (
                requestError
                ) {
                    setError(
                        readMatFlowError(
                            requestError,
                            `Unable to save ${config.title}.`
                        )
                    );
                } finally {
                    setSaving(
                        false
                    );
                }
            },
            [
                canManage,
                config,
                dialog,
                form,
                load,
            ]
        );


    /*
     * =====================================================
     * TABLE GRID
     * =====================================================
     */

    const gridColumns =
        useMemo(
            () =>
                `repeat(${config.columns.length}, minmax(135px, 1fr))`,
            [
                config.columns.length,
            ]
        );


    /*
     * =====================================================
     * FIELD RENDERER
     * =====================================================
     */

    const renderField =
        (
            field
        ) => {
            const [
                key,
                label,
                kind,
            ] = field;

            const updateValue =
                (
                    value
                ) => {
                    setForm(
                        (
                            current
                        ) => ({
                            ...current,
                            [key]:
                                value,
                        })
                    );
                };


            const common = {
                key,
                label,

                value:
                    form[key] ??
                    "",

                disabled:
                    saving,

                onChange:
                    (
                        event
                    ) =>
                        updateValue(
                            event
                                .target
                                .value
                        ),

                sx: {
                    ...fieldSx,

                    ...(kind ===
                        "multiline"
                        ? {
                            gridColumn:
                                "1 / -1",
                        }
                        : {}),
                },
            };


            /*
             * MATERIAL CATEGORY
             */

            if (
                kind ===
                "category"
            ) {
                return (
                    <TextField
                        select
                        {...common}
                    >
                        {MATFLOW_MATERIAL_CATEGORIES.map(
                            (
                                item
                            ) => (
                                <MenuItem
                                    key={
                                        item.value
                                    }
                                    value={
                                        item.value
                                    }
                                >
                                    {
                                        item.label
                                    }
                                </MenuItem>
                            )
                        )}
                    </TextField>
                );
            }


            /*
             * PLANT
             *
             * If the authenticated user has known plants,
             * constrain the user to those plants.
             *
             * If none were returned, remain a normal text
             * field instead of presenting an empty select.
             */

            if (
                kind ===
                "plant"
            ) {
                if (
                    availablePlants.length >
                    0
                ) {
                    return (
                        <TextField
                            select
                            {...common}
                        >
                            {availablePlants.map(
                                (
                                    plant
                                ) => (
                                    <MenuItem
                                        key={
                                            plant
                                        }
                                        value={
                                            plant
                                        }
                                    >
                                        {
                                            plant
                                        }
                                    </MenuItem>
                                )
                            )}
                        </TextField>
                    );
                }

                return (
                    <TextField
                        {...common}
                    />
                );
            }


            /*
             * LOCATION TYPE
             */

            if (
                kind ===
                "locationType"
            ) {
                return (
                    <TextField
                        select
                        {...common}
                    >
                        {locationTypes.map(
                            (
                                value
                            ) => (
                                <MenuItem
                                    key={
                                        value
                                    }
                                    value={
                                        value
                                    }
                                >
                                    {
                                        value
                                    }
                                </MenuItem>
                            )
                        )}
                    </TextField>
                );
            }


            /*
             * OWNERSHIP TYPE
             */

            if (
                kind ===
                "ownership"
            ) {
                return (
                    <TextField
                        select
                        {...common}
                    >
                        {ownershipTypes.map(
                            (
                                value
                            ) => (
                                <MenuItem
                                    key={
                                        value
                                    }
                                    value={
                                        value
                                    }
                                >
                                    {
                                        value
                                    }
                                </MenuItem>
                            )
                        )}
                    </TextField>
                );
            }


            /*
             * NORMAL FIELD
             */

            return (
                <TextField
                    {...common}

                    type={
                        kind ===
                            "number" ||
                            kind ===
                            "date"
                            ? kind
                            : "text"
                    }

                    multiline={
                        kind ===
                        "multiline"
                    }

                    minRows={
                        kind ===
                            "multiline"
                            ? 3
                            : undefined
                    }

                    slotProps={
                        kind ===
                            "date"
                            ? {
                                inputLabel: {
                                    shrink:
                                        true,
                                },
                            }
                            : undefined
                    }
                />
            );
        };


    /*
     * =====================================================
     * PAGE
     * =====================================================
     */

    return (
        <Box
            sx={
                pageSx
            }
        >
            <PageHero
                badge={
                    config.badge
                }

                title={
                    config.title
                }

                subtitle={
                    config.subtitle
                }

                actions={
                    canManage
                        ? (
                            <Button
                                startIcon={
                                    <AddIcon />
                                }
                                onClick={
                                    openCreate
                                }
                                sx={
                                    primaryBtnSx
                                }
                            >
                                Add
                            </Button>
                        )
                        : null
                }
            />


            {/* =================================================
                SEARCH / REFRESH
            ================================================= */}

            <Card
                sx={
                    panelSx
                }
            >
                <Box
                    sx={{
                        display:
                            "flex",

                        gap:
                            1,

                        flexWrap:
                            "wrap",

                        justifyContent:
                            "space-between",

                        alignItems:
                            "center",
                    }}
                >
                    <TextField
                        label="Search"

                        value={
                            search
                        }

                        onChange={
                            (
                                event
                            ) =>
                                setSearch(
                                    event
                                        .target
                                        .value
                                )
                        }

                        onKeyDown={
                            (
                                event
                            ) => {
                                if (
                                    event.key ===
                                    "Enter"
                                ) {
                                    load();
                                }
                            }
                        }

                        sx={{
                            ...fieldSx,

                            width: {
                                xs:
                                    "100%",

                                sm:
                                    360,
                            },
                        }}
                    />


                    <Box
                        sx={{
                            display:
                                "flex",

                            gap:
                                1,

                            flexWrap:
                                "wrap",
                        }}
                    >
                        <Button
                            startIcon={
                                <SearchIcon />
                            }

                            onClick={
                                load
                            }

                            disabled={
                                loading
                            }

                            sx={
                                primaryBtnSx
                            }
                        >
                            Search
                        </Button>


                        <Button
                            startIcon={
                                <RefreshIcon />
                            }

                            onClick={
                                () => {
                                    setSearch(
                                        ""
                                    );
                                }
                            }

                            disabled={
                                loading
                            }

                            sx={
                                secondaryBtnSx
                            }
                        >
                            Clear
                        </Button>


                        <Button
                            startIcon={
                                <RefreshIcon />
                            }

                            onClick={
                                load
                            }

                            disabled={
                                loading
                            }

                            sx={
                                secondaryBtnSx
                            }
                        >
                            Refresh
                        </Button>
                    </Box>
                </Box>
            </Card>


            <ErrorBox>
                {
                    error
                }
            </ErrorBox>


            {/* =================================================
                TABLE
            ================================================= */}

            <Card
                sx={
                    panelSx
                }
            >
                {loading
                    ? (
                        <LoadingBlock />
                    )
                    : (
                        <Box
                            sx={
                                tableShellSx
                            }
                        >
                            <Box
                                sx={{
                                    ...tableHeaderSx,

                                    gridTemplateColumns:
                                        gridColumns,
                                }}
                            >
                                {config.columns.map(
                                    (
                                        column
                                    ) => (
                                        <Box
                                            key={
                                                column
                                            }
                                            sx={
                                                tableCellSx
                                            }
                                        >
                                            {
                                                column
                                            }
                                        </Box>
                                    )
                                )}
                            </Box>


                            {rows.length ===
                                0
                                ? (
                                    <EmptyState>
                                        No{" "}
                                        {config.title.toLowerCase()}{" "}
                                        records found.
                                    </EmptyState>
                                )
                                : rows.map(
                                    (
                                        row
                                    ) => {
                                        const cells =
                                            config.cells(
                                                row,
                                                canManage,
                                                openEdit
                                            );

                                        return (
                                            <Box
                                                key={
                                                    row.id ||
                                                    `${type}-${row.materialCode || row.projectCode || row.locationCode}`
                                                }

                                                sx={{
                                                    ...tableRowSx,

                                                    gridTemplateColumns:
                                                        gridColumns,
                                                }}
                                            >
                                                {cells.map(
                                                    (
                                                        cell,
                                                        index
                                                    ) => (
                                                        <Box
                                                            key={
                                                                `${row.id || "row"}-${index}`
                                                            }

                                                            sx={
                                                                tableCellSx
                                                            }
                                                        >
                                                            {
                                                                cell
                                                            }
                                                        </Box>
                                                    )
                                                )}
                                            </Box>
                                        );
                                    }
                                )}
                        </Box>
                    )}
            </Card>


            {/* =================================================
                CREATE / EDIT DIALOG
            ================================================= */}

            <Dialog
                open={
                    Boolean(
                        dialog
                    )
                }

                onClose={
                    closeDialog
                }

                fullWidth

                maxWidth="md"

                PaperProps={{
                    sx:
                        dialogPaperSx,
                }}
            >
                <DialogTitle
                    sx={
                        dialogTitleSx
                    }
                >
                    {dialog?.row
                        ? `Edit ${config.title}`
                        : `Add ${config.title}`}
                </DialogTitle>


                <DialogContent
                    sx={
                        dialogContentSx
                    }
                >
                    <Box
                        sx={{
                            display:
                                "grid",

                            gridTemplateColumns: {
                                xs:
                                    "1fr",

                                md:
                                    "repeat(2,minmax(0,1fr))",
                            },

                            gap:
                                1.5,
                        }}
                    >
                        {config.fields.map(
                            renderField
                        )}
                    </Box>


                    <Box
                        sx={{
                            mt:
                                1.5,

                            display:
                                "flex",

                            alignItems:
                                "center",

                            gap:
                                2,

                            flexWrap:
                                "wrap",
                        }}
                    >
                        {"supportsStock" in
                            form && (
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={
                                                form.supportsStock ===
                                                true
                                            }

                                            disabled={
                                                saving
                                            }

                                            onChange={
                                                (
                                                    event
                                                ) =>
                                                    setForm(
                                                        (
                                                            current
                                                        ) => ({
                                                            ...current,

                                                            supportsStock:
                                                                event
                                                                    .target
                                                                    .checked,
                                                        })
                                                    )
                                            }
                                        />
                                    }

                                    label="Supports stock"
                                />
                            )}


                        <FormControlLabel
                            control={
                                <Switch
                                    checked={
                                        form.active ===
                                        true
                                    }

                                    disabled={
                                        saving
                                    }

                                    onChange={
                                        (
                                            event
                                        ) =>
                                            setForm(
                                                (
                                                    current
                                                ) => ({
                                                    ...current,

                                                    active:
                                                        event
                                                            .target
                                                            .checked,
                                                })
                                            )
                                    }
                                />
                            }

                            label="Active"
                        />
                    </Box>


                    {dialog &&
                        error && (
                            <Box
                                sx={{
                                    mt:
                                        1.5,
                                }}
                            >
                                <ErrorBox>
                                    {
                                        error
                                    }
                                </ErrorBox>
                            </Box>
                        )}
                </DialogContent>


                <DialogActions
                    sx={
                        dialogActionsSx
                    }
                >
                    <Button
                        onClick={
                            closeDialog
                        }

                        disabled={
                            saving
                        }

                        sx={
                            secondaryBtnSx
                        }
                    >
                        Cancel
                    </Button>


                    <Button
                        onClick={
                            save
                        }

                        disabled={
                            saving ||
                            !canManage
                        }

                        sx={
                            primaryBtnSx
                        }
                    >
                        {saving
                            ? "Saving..."
                            : dialog?.row
                                ? "Save Changes"
                                : "Create"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}


/*
 * =========================================================
 * ROUTE PAGE EXPORTS
 * =========================================================
 */

export const MatFlowMaterialsPage =
    () => (
        <MasterCrudPage
            type="materials"
        />
    );


export const MatFlowProjectsPage =
    () => (
        <MasterCrudPage
            type="projects"
        />
    );


export const MatFlowLocationsPage =
    () => (
        <MasterCrudPage
            type="locations"
        />
    );