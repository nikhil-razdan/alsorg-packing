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
    Collapse,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";

import AddIcon
    from "@mui/icons-material/Add";
import CloseIcon
    from "@mui/icons-material/Close";
import DeleteOutlineIcon
    from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon
    from "@mui/icons-material/EditOutlined";
import ExpandLessIcon
    from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon
    from "@mui/icons-material/ExpandMore";
import Inventory2OutlinedIcon
    from "@mui/icons-material/Inventory2Outlined";
import AccountTreeOutlinedIcon
    from "@mui/icons-material/AccountTreeOutlined";
import RuleOutlinedIcon
    from "@mui/icons-material/RuleOutlined";
import UnfoldLessOutlinedIcon
    from "@mui/icons-material/UnfoldLessOutlined";
import UnfoldMoreOutlinedIcon
    from "@mui/icons-material/UnfoldMoreOutlined";

import {
    extractMatFlowPage,
    matflowApi,
    readMatFlowError,
} from "../api/matflowApi";

import {
    getMatFlowCategoryMeta,
    MATFLOW_MATERIAL_CATEGORIES,
    normalizeMatFlowCategory,
} from "../utils/matflowMaterialCategories";

import {
    fieldSx,
    primaryBtnSx,
    secondaryBtnSx,
    tableCellSx,
    tableHeaderSx,
    tableRowSx,
    tableShellSx,
} from "../matflowTheme";

const EMPTY_FORM = {
    materialId: "",
    requiredQty: "",
    wastagePercent: "0",
    remarks: "",
};

const clean = (value) =>
    String(value ?? "").trim();

const numberOrZero = (value) => {
    const result =
        Number(value);

    return Number.isFinite(result)
        ? result
        : 0;
};

const formatQty = (value) => {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "-";
    }

    const result =
        Number(value);

    if (!Number.isFinite(result)) {
        return "-";
    }

    return result.toLocaleString(
        "en-US",
        {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3,
        }
    );
};

const resolveLineCategory = (
    line
) => {
    return normalizeMatFlowCategory(
        line?.categorySnapshot ||
        line?.materialCategorySnapshot ||
        line?.category ||
        line?.materialCategory ||
        line?.material?.category ||
        "MISCELLANEOUS"
    );
};

const resolveLineMaterialName = (
    line
) => {
    return (
        line?.materialNameSnapshot ||
        line?.materialName ||
        line?.material?.materialName ||
        "-"
    );
};

const resolveLineMaterialCode = (
    line
) => {
    return (
        line?.materialCodeSnapshot ||
        line?.materialCode ||
        line?.material?.materialCode ||
        "-"
    );
};

const resolveLineSpecification = (
    line
) => {
    return (
        line?.specificationSnapshot ||
        line?.specification ||
        line?.material?.specification ||
        "-"
    );
};

const resolveLineUom = (
    line
) => {
    return (
        line?.uomSnapshot ||
        line?.uom ||
        line?.material?.uom ||
        ""
    );
};

const groupLinesByCategory = (
    inputLines
) => {
    const grouped =
        new Map();

    inputLines.forEach(
        (line, index) => {
            const categoryValue =
                resolveLineCategory(
                    line
                );

            const categoryMeta =
                getMatFlowCategoryMeta(
                    categoryValue
                );

            if (
                !grouped.has(
                    categoryValue
                )
            ) {
                grouped.set(
                    categoryValue,
                    {
                        key:
                            categoryValue,

                        value:
                            categoryValue,

                        label:
                            categoryMeta.label,

                        color:
                            categoryMeta.color,

                        order:
                            categoryMeta.order,

                        rows: [],

                        qtyByUom:
                            new Map(),
                    }
                );
            }

            const section =
                grouped.get(
                    categoryValue
                );

            section.rows.push({
                line,
                originalIndex:
                    index,
            });

            const uom =
                resolveLineUom(
                    line
                ) || "UNSPECIFIED";

            const netQty =
                numberOrZero(
                    line?.netRequiredQty ??
                    line?.requiredQty
                );

            section.qtyByUom.set(
                uom,
                (
                    section.qtyByUom.get(
                        uom
                    ) || 0
                ) + netQty
            );
        }
    );

    return Array.from(
        grouped.values()
    ).sort((left, right) => {
        if (
            left.order !==
            right.order
        ) {
            return (
                left.order -
                right.order
            );
        }

        return left.label.localeCompare(
            right.label
        );
    });
};

const sectionQuantityText = (
    section
) => {
    const entries =
        Array.from(
            section.qtyByUom.entries()
        );

    if (entries.length === 0) {
        return "-";
    }

    if (entries.length === 1) {
        const [
            uom,
            quantity,
        ] = entries[0];

        return `${formatQty(
            quantity
        )} ${uom === "UNSPECIFIED"
                ? ""
                : uom
            }`.trim();
    }

    return `${entries.length} UOM groups`;
};

export default function MatFlowBomLineEditor({
    bom,
    lines = [],
    canEdit = false,
    onChanged,
    onError,
}) {
    const safeLines =
        useMemo(
            () =>
                Array.isArray(lines)
                    ? lines
                    : [],
            [lines]
        );

    const editable =
        canEdit &&
        [
            "DRAFT",
            "RETURNED",
        ].includes(
            String(
                bom?.status || ""
            ).toUpperCase()
        );

    const [materials, setMaterials] =
        useState([]);

    const [
        materialsLoading,
        setMaterialsLoading,
    ] = useState(false);

    const [
        materialCategoryFilter,
        setMaterialCategoryFilter,
    ] = useState("");

    const [
        lineSearch,
        setLineSearch,
    ] = useState("");

    const [
        openSections,
        setOpenSections,
    ] = useState({});

    const [dialogOpen, setDialogOpen] =
        useState(false);

    const [editingLine, setEditingLine] =
        useState(null);

    const [form, setForm] =
        useState({
            ...EMPTY_FORM,
        });

    const [working, setWorking] =
        useState(false);

    const [localError, setLocalError] =
        useState("");

    useEffect(() => {
        if (!editable) {
            setMaterials([]);
            setMaterialsLoading(false);
            setDialogOpen(false);
            setEditingLine(null);
            setForm({
                ...EMPTY_FORM,
            });

            return undefined;
        }

        let active = true;

        const loadMaterials =
            async () => {
                setMaterialsLoading(
                    true
                );

                try {
                    const response =
                        await matflowApi
                            .listMaterials({
                                page: 0,
                                size: 1000,
                                active: true,
                            });

                    const result =
                        extractMatFlowPage(
                            response?.data
                        );

                    if (active) {
                        const activeRows =
                            result.rows
                                .filter(
                                    (material) =>
                                        material?.active !==
                                        false
                                )
                                .sort(
                                    (
                                        left,
                                        right
                                    ) => {
                                        const leftCategory =
                                            getMatFlowCategoryMeta(
                                                left?.category
                                            ).order;

                                        const rightCategory =
                                            getMatFlowCategoryMeta(
                                                right?.category
                                            ).order;

                                        if (
                                            leftCategory !==
                                            rightCategory
                                        ) {
                                            return (
                                                leftCategory -
                                                rightCategory
                                            );
                                        }

                                        return String(
                                            left?.materialName ||
                                            ""
                                        ).localeCompare(
                                            String(
                                                right?.materialName ||
                                                ""
                                            )
                                        );
                                    }
                                );

                        setMaterials(
                            activeRows
                        );
                    }
                } catch (
                requestError
                ) {
                    const message =
                        readMatFlowError(
                            requestError,
                            "Unable to load materials."
                        );

                    if (active) {
                        setLocalError(
                            message
                        );

                        onError?.(
                            message
                        );
                    }
                } finally {
                    if (active) {
                        setMaterialsLoading(
                            false
                        );
                    }
                }
            };

        loadMaterials();

        return () => {
            active = false;
        };
    }, [
        editable,
        onError,
    ]);

    const allSections =
        useMemo(
            () =>
                groupLinesByCategory(
                    safeLines
                ),
            [safeLines]
        );

    const sectionKeySignature =
        useMemo(
            () =>
                allSections
                    .map(
                        (section) =>
                            section.key
                    )
                    .join("|"),
            [allSections]
        );

    useEffect(() => {
        setOpenSections(
            (current) => {
                const next = {
                    ...current,
                };

                allSections.forEach(
                    (section) => {
                        if (
                            typeof next[
                            section.key
                            ] !==
                            "boolean"
                        ) {
                            next[
                                section.key
                            ] = true;
                        }
                    }
                );

                return next;
            }
        );
    }, [
        allSections,
        sectionKeySignature,
    ]);

    const filteredLines =
        useMemo(() => {
            const term =
                clean(
                    lineSearch
                ).toLowerCase();

            if (!term) {
                return safeLines;
            }

            return safeLines.filter(
                (line) => {
                    const searchable =
                        [
                            resolveLineMaterialCode(
                                line
                            ),
                            resolveLineMaterialName(
                                line
                            ),
                            resolveLineSpecification(
                                line
                            ),
                            resolveLineCategory(
                                line
                            ),
                            line?.remarks,
                            line?.lineNo,
                        ]
                            .filter(
                                (value) =>
                                    value !==
                                    null &&
                                    value !==
                                    undefined
                            )
                            .join(" ")
                            .toLowerCase();

                    return searchable.includes(
                        term
                    );
                }
            );
        }, [
            lineSearch,
            safeLines,
        ]);

    const visibleSections =
        useMemo(
            () =>
                groupLinesByCategory(
                    filteredLines
                ),
            [filteredLines]
        );

    const overallUomCount =
        useMemo(() => {
            return new Set(
                safeLines
                    .map(
                        resolveLineUom
                    )
                    .filter(Boolean)
            ).size;
        }, [safeLines]);

    const calculatedNetQty =
        useMemo(() => {
            const required =
                Number(
                    form.requiredQty
                );

            const wastage =
                Number(
                    form.wastagePercent ||
                    0
                );

            if (
                !Number.isFinite(
                    required
                ) ||
                required <= 0 ||
                !Number.isFinite(
                    wastage
                ) ||
                wastage < 0
            ) {
                return 0;
            }

            return (
                required +
                required *
                (
                    wastage /
                    100
                )
            );
        }, [
            form.requiredQty,
            form.wastagePercent,
        ]);

    const editingMaterialOption =
        useMemo(() => {
            if (
                !editingLine?.id
            ) {
                return null;
            }

            const materialId =
                editingLine.materialId ||
                editingLine.material?.id;

            if (!materialId) {
                return null;
            }

            return {
                id:
                    materialId,

                materialCode:
                    resolveLineMaterialCode(
                        editingLine
                    ),

                materialName:
                    resolveLineMaterialName(
                        editingLine
                    ),

                category:
                    resolveLineCategory(
                        editingLine
                    ),

                uom:
                    resolveLineUom(
                        editingLine
                    ),

                specification:
                    resolveLineSpecification(
                        editingLine
                    ),

                active: true,
            };
        }, [editingLine]);

    const materialOptions =
        useMemo(() => {
            const result = [
                ...materials,
            ];

            if (
                editingMaterialOption &&
                !result.some(
                    (material) =>
                        String(
                            material.id
                        ) ===
                        String(
                            editingMaterialOption.id
                        )
                )
            ) {
                result.push(
                    editingMaterialOption
                );
            }

            return result;
        }, [
            editingMaterialOption,
            materials,
        ]);

    const dynamicCategoryOptions =
        useMemo(() => {
            const categoryMap =
                new Map(
                    MATFLOW_MATERIAL_CATEGORIES.map(
                        (category) => [
                            category.value,
                            category,
                        ]
                    )
                );

            materialOptions.forEach(
                (material) => {
                    const meta =
                        getMatFlowCategoryMeta(
                            material?.category
                        );

                    categoryMap.set(
                        meta.value,
                        meta
                    );
                }
            );

            return Array.from(
                categoryMap.values()
            ).sort(
                (left, right) =>
                    (
                        left.order ??
                        999
                    ) -
                    (
                        right.order ??
                        999
                    )
            );
        }, [materialOptions]);

    const filteredMaterials =
        useMemo(() => {
            if (
                !materialCategoryFilter
            ) {
                return materialOptions;
            }

            return materialOptions.filter(
                (material) =>
                    normalizeMatFlowCategory(
                        material?.category
                    ) ===
                    materialCategoryFilter
            );
        }, [
            materialCategoryFilter,
            materialOptions,
        ]);

    const selectedMaterial =
        useMemo(() => {
            return materialOptions.find(
                (material) =>
                    String(
                        material.id
                    ) ===
                    String(
                        form.materialId
                    )
            );
        }, [
            form.materialId,
            materialOptions,
        ]);

    const updateForm = (
        key,
        value
    ) => {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));

        if (localError) {
            setLocalError("");
        }
    };

    const changeMaterialCategory = (
        value
    ) => {
        const normalized =
            value
                ? normalizeMatFlowCategory(
                    value
                )
                : "";

        setMaterialCategoryFilter(
            normalized
        );

        if (
            form.materialId &&
            normalized
        ) {
            const currentMaterial =
                materialOptions.find(
                    (material) =>
                        String(
                            material.id
                        ) ===
                        String(
                            form.materialId
                        )
                );

            if (
                currentMaterial &&
                normalizeMatFlowCategory(
                    currentMaterial.category
                ) !== normalized
            ) {
                updateForm(
                    "materialId",
                    ""
                );
            }
        }
    };

    const changeMaterial = (
        materialId
    ) => {
        updateForm(
            "materialId",
            materialId
        );

        const material =
            materialOptions.find(
                (candidate) =>
                    String(
                        candidate.id
                    ) ===
                    String(
                        materialId
                    )
            );

        if (material) {
            setMaterialCategoryFilter(
                normalizeMatFlowCategory(
                    material.category
                )
            );
        }
    };

    const openCreate = (
        category = ""
    ) => {
        if (
            !editable ||
            working
        ) {
            return;
        }

        setEditingLine(null);

        setForm({
            ...EMPTY_FORM,
        });

        setMaterialCategoryFilter(
            category
                ? normalizeMatFlowCategory(
                    category
                )
                : ""
        );

        setLocalError("");
        onError?.("");
        setDialogOpen(true);
    };

    const openEdit = (
        line
    ) => {
        if (
            !editable ||
            working ||
            !line?.id
        ) {
            return;
        }

        setEditingLine(line);

        setForm({
            materialId:
                line.materialId ||
                line.material?.id ||
                "",

            requiredQty:
                String(
                    line.requiredQty ??
                    ""
                ),

            wastagePercent:
                String(
                    line.wastagePercent ??
                    0
                ),

            remarks:
                line.remarks ||
                "",
        });

        setMaterialCategoryFilter(
            resolveLineCategory(
                line
            )
        );

        setLocalError("");
        onError?.("");
        setDialogOpen(true);
    };

    const closeDialog = () => {
        if (working) {
            return;
        }

        setDialogOpen(false);
        setEditingLine(null);
        setMaterialCategoryFilter("");
        setForm({
            ...EMPTY_FORM,
        });
        setLocalError("");
    };

    const validate = () => {
        const requiredQty =
            Number(
                form.requiredQty
            );

        const wastagePercent =
            Number(
                form.wastagePercent ||
                0
            );

        if (!form.materialId) {
            return "Select a material.";
        }

        if (
            !Number.isFinite(
                requiredQty
            ) ||
            requiredQty <= 0
        ) {
            return "Required quantity must be greater than zero.";
        }

        if (
            !Number.isFinite(
                wastagePercent
            ) ||
            wastagePercent < 0 ||
            wastagePercent > 1000
        ) {
            return "Wastage percentage must be between 0 and 1000.";
        }

        return "";
    };

    const save = async () => {
        const validationError =
            validate();

        if (validationError) {
            setLocalError(
                validationError
            );
            onError?.(
                validationError
            );
            return;
        }

        if (!editable) {
            const message =
                "This BOM revision is not editable.";

            setLocalError(message);
            onError?.(message);
            return;
        }

        if (!bom?.id) {
            const message =
                "The BOM ID is missing. Refresh the page and try again.";

            setLocalError(message);
            onError?.(message);
            return;
        }

        if (
            editingLine?.id &&
            (
                editingLine.rowVersion ===
                null ||
                editingLine.rowVersion ===
                undefined
            )
        ) {
            const message =
                "The BOM line version is missing. Refresh the BOM and try again.";

            setLocalError(message);
            onError?.(message);
            return;
        }

        const body = {
            materialId:
                String(
                    form.materialId
                ).trim(),

            requiredQty:
                Number(
                    form.requiredQty
                ),

            wastagePercent:
                Number(
                    form.wastagePercent ||
                    0
                ),

            remarks:
                clean(
                    form.remarks
                ) || null,

            rowVersion:
                editingLine?.id
                    ? editingLine.rowVersion
                    : null,
        };

        setWorking(true);
        setLocalError("");
        onError?.("");

        try {
            if (editingLine?.id) {
                await matflowApi
                    .updateBomLine(
                        bom.id,
                        editingLine.id,
                        body
                    );
            } else {
                await matflowApi
                    .addBomLine(
                        bom.id,
                        body
                    );
            }

            setDialogOpen(false);
            setEditingLine(null);
            setMaterialCategoryFilter("");
            setForm({
                ...EMPTY_FORM,
            });

            await onChanged?.();
        } catch (
        requestError
        ) {
            const message =
                readMatFlowError(
                    requestError,
                    "Unable to save the BOM line."
                );

            setLocalError(message);
            onError?.(message);
        } finally {
            setWorking(false);
        }
    };

    const remove = async (
        line
    ) => {
        if (
            !editable ||
            !line?.id ||
            working
        ) {
            return;
        }

        if (!bom?.id) {
            const message =
                "The BOM ID is missing. Refresh the BOM and try again.";

            setLocalError(message);
            onError?.(message);
            return;
        }

        if (
            line.rowVersion ===
            null ||
            line.rowVersion ===
            undefined
        ) {
            const message =
                "The BOM line version is missing. Refresh the BOM and try again.";

            setLocalError(message);
            onError?.(message);
            return;
        }

        const materialName =
            resolveLineMaterialName(
                line
            );

        const confirmed =
            window.confirm(
                `Remove ${materialName} from this BOM revision?`
            );

        if (!confirmed) {
            return;
        }

        setWorking(true);
        setLocalError("");
        onError?.("");

        try {
            await matflowApi
                .deleteBomLine(
                    bom.id,
                    line.id,
                    line.rowVersion
                );

            await onChanged?.();
        } catch (
        requestError
        ) {
            const message =
                readMatFlowError(
                    requestError,
                    "Unable to delete the BOM line."
                );

            setLocalError(message);
            onError?.(message);
        } finally {
            setWorking(false);
        }
    };

    const toggleSection = (
        sectionKey
    ) => {
        setOpenSections(
            (current) => ({
                ...current,

                [sectionKey]:
                    !current[
                    sectionKey
                    ],
            })
        );
    };

    const expandAll = () => {
        const next = {};

        allSections.forEach(
            (section) => {
                next[
                    section.key
                ] = true;
            }
        );

        setOpenSections(next);
    };

    const collapseAll = () => {
        const next = {};

        allSections.forEach(
            (section) => {
                next[
                    section.key
                ] = false;
            }
        );

        setOpenSections(next);
    };

    return (
        <Box sx={builderShellSx}>
            <Card sx={builderToolbarSx}>
                <Box>
                    <Box sx={titleRowSx}>
                        <AccountTreeOutlinedIcon
                            sx={{
                                color:
                                    "#7dd3fc",
                            }}
                        />

                        <Box>
                            <Typography sx={builderTitleSx}>
                                Operational BOM Sections
                            </Typography>

                            <Typography sx={builderSubSx}>
                                Materials are grouped using the
                                category maintained in the
                                MatFlow Material Master.
                            </Typography>
                        </Box>
                    </Box>
                </Box>

                <Box sx={builderActionsSx}>
                    <TextField
                        label="Search BOM Materials"
                        placeholder="Code, material, specification..."
                        value={lineSearch}
                        onChange={(event) =>
                            setLineSearch(
                                event.target.value
                            )
                        }
                        size="small"
                        sx={searchFieldSx}
                    />

                    <Button
                        startIcon={
                            <UnfoldMoreOutlinedIcon />
                        }
                        onClick={expandAll}
                        disabled={
                            allSections.length ===
                            0
                        }
                        sx={secondaryBtnSx}
                    >
                        Expand
                    </Button>

                    <Button
                        startIcon={
                            <UnfoldLessOutlinedIcon />
                        }
                        onClick={collapseAll}
                        disabled={
                            allSections.length ===
                            0
                        }
                        sx={secondaryBtnSx}
                    >
                        Collapse
                    </Button>

                    {editable && (
                        <Button
                            startIcon={
                                <AddIcon />
                            }
                            onClick={() =>
                                openCreate()
                            }
                            disabled={
                                working ||
                                materialsLoading
                            }
                            sx={primaryBtnSx}
                        >
                            Add Material
                        </Button>
                    )}
                </Box>
            </Card>

            <Box sx={summaryGridSx}>
                <MiniStat
                    icon={
                        <Inventory2OutlinedIcon />
                    }
                    title="Material Lines"
                    value={safeLines.length}
                    subtitle="Operational BOM lines"
                    accent="#60a5fa"
                />

                <MiniStat
                    icon={
                        <AccountTreeOutlinedIcon />
                    }
                    title="Categories"
                    value={
                        allSections.length
                    }
                    subtitle="Material sections"
                    accent="#8b5cf6"
                />

                <MiniStat
                    icon={
                        <RuleOutlinedIcon />
                    }
                    title="UOM Groups"
                    value={
                        overallUomCount
                    }
                    subtitle="Distinct operational units"
                    accent="#14b8a6"
                />

                <MiniStat
                    icon={
                        editable
                            ? "✎"
                            : "✓"
                    }
                    title="Revision Mode"
                    value={
                        editable
                            ? "Editable"
                            : "Read Only"
                    }
                    subtitle={
                        editable
                            ? "Draft material structure"
                            : "Controlled approved revision"
                    }
                    accent={
                        editable
                            ? "#f59e0b"
                            : "#22c55e"
                    }
                />
            </Box>

            {localError && (
                <Box sx={localErrorSx}>
                    {localError}
                </Box>
            )}

            {safeLines.length === 0 ? (
                <Card sx={emptyBuilderSx}>
                    <Box sx={emptyIconSx}>
                        <RuleOutlinedIcon />
                    </Box>

                    <Box>
                        <Typography sx={emptyTitleSx}>
                            No operational materials added
                        </Typography>

                        <Typography sx={emptySubSx}>
                            Add materials from the MatFlow
                            Material Master and assign their
                            required quantities.
                        </Typography>
                    </Box>

                    {editable && (
                        <Button
                            startIcon={
                                <AddIcon />
                            }
                            onClick={() =>
                                openCreate()
                            }
                            disabled={
                                working ||
                                materialsLoading
                            }
                            sx={primaryBtnSx}
                        >
                            Add First Material
                        </Button>
                    )}
                </Card>
            ) : visibleSections.length === 0 ? (
                <Card sx={emptyBuilderSx}>
                    <Typography sx={emptyTitleSx}>
                        No BOM lines match the current search.
                    </Typography>
                </Card>
            ) : (
                visibleSections.map(
                    (section) => {
                        const isOpen =
                            openSections[
                            section.key
                            ] !== false;

                        return (
                            <Card
                                key={
                                    section.key
                                }
                                sx={sectionCardSx(
                                    section.color,
                                    isOpen
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
                                            sx={sectionToggleSx}
                                        >
                                            {isOpen ? (
                                                <ExpandLessIcon />
                                            ) : (
                                                <ExpandMoreIcon />
                                            )}
                                        </IconButton>

                                        <Box>
                                            <Box sx={sectionTitleRowSx}>
                                                <Typography sx={sectionTitleSx}>
                                                    {section.label}
                                                </Typography>

                                                <Chip
                                                    label={`${section.rows.length} ${section.rows.length ===
                                                            1
                                                            ? "ITEM"
                                                            : "ITEMS"
                                                        }`}
                                                    size="small"
                                                    sx={sectionCountSx}
                                                />
                                            </Box>

                                            <Typography sx={sectionSubSx}>
                                                Net requirement:{" "}
                                                {sectionQuantityText(
                                                    section
                                                )}
                                            </Typography>
                                        </Box>
                                    </Box>

                                    <Box sx={sectionRightSx}>
                                        {editable && (
                                            <Button
                                                startIcon={
                                                    <AddIcon />
                                                }
                                                onClick={() =>
                                                    openCreate(
                                                        section.value
                                                    )
                                                }
                                                disabled={
                                                    working ||
                                                    materialsLoading
                                                }
                                                sx={secondaryBtnSx}
                                            >
                                                Add to {section.label}
                                            </Button>
                                        )}
                                    </Box>
                                </Box>

                                <Collapse in={isOpen}>
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
                                                Required
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                Wastage
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                Net Required
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                Unit
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                Remarks
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                Action
                                            </Box>
                                        </Box>

                                        {section.rows.map(
                                            ({
                                                line,
                                                originalIndex,
                                            }) => (
                                                <Box
                                                    key={
                                                        line.id ||
                                                        originalIndex
                                                    }
                                                    sx={lineRowSx}
                                                >
                                                    <Box sx={tableCellSx}>
                                                        {line.lineNo ??
                                                            originalIndex +
                                                            1}
                                                    </Box>

                                                    <Box sx={tableCellSx}>
                                                        <Typography sx={mainTextSx}>
                                                            {resolveLineMaterialName(
                                                                line
                                                            )}
                                                        </Typography>

                                                        <Typography sx={subTextSx}>
                                                            {resolveLineMaterialCode(
                                                                line
                                                            )}
                                                        </Typography>
                                                    </Box>

                                                    <Box sx={tableCellSx}>
                                                        {resolveLineSpecification(
                                                            line
                                                        )}
                                                    </Box>

                                                    <Box sx={quantityCellSx}>
                                                        {formatQty(
                                                            line.requiredQty
                                                        )}
                                                    </Box>

                                                    <Box sx={quantityCellSx}>
                                                        {formatQty(
                                                            line.wastagePercent ??
                                                            0
                                                        )}
                                                        %
                                                    </Box>

                                                    <Box sx={netQuantityCellSx}>
                                                        {formatQty(
                                                            line.netRequiredQty ??
                                                            line.requiredQty
                                                        )}
                                                    </Box>

                                                    <Box sx={tableCellSx}>
                                                        {resolveLineUom(
                                                            line
                                                        ) || "-"}
                                                    </Box>

                                                    <Box sx={tableCellSx}>
                                                        {line.remarks ||
                                                            "-"}
                                                    </Box>

                                                    <Box sx={actionCellSx}>
                                                        {editable ? (
                                                            <>
                                                                <IconButton
                                                                    onClick={() =>
                                                                        openEdit(
                                                                            line
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        working
                                                                    }
                                                                    sx={editButtonSx}
                                                                >
                                                                    <EditOutlinedIcon />
                                                                </IconButton>

                                                                <IconButton
                                                                    onClick={() =>
                                                                        remove(
                                                                            line
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        working
                                                                    }
                                                                    sx={deleteButtonSx}
                                                                >
                                                                    <DeleteOutlineIcon />
                                                                </IconButton>
                                                            </>
                                                        ) : (
                                                            <Chip
                                                                label="LOCKED"
                                                                size="small"
                                                                sx={lockedChipSx}
                                                            />
                                                        )}
                                                    </Box>
                                                </Box>
                                            )
                                        )}
                                    </Box>
                                </Collapse>
                            </Card>
                        );
                    }
                )
            )}

            <Dialog
                open={dialogOpen}
                onClose={closeDialog}
                fullWidth
                maxWidth="md"
                PaperProps={{
                    sx: dialogPaperSx,
                }}
            >
                <DialogTitle sx={dialogTitleSx}>
                    <Box>
                        <Typography sx={dialogHeadingSx}>
                            {editingLine
                                ? "Edit Operational Material"
                                : "Add Operational Material"}
                        </Typography>

                        <Typography sx={dialogSubSx}>
                            Select a standardized material,
                            required quantity and permitted
                            wastage.
                        </Typography>
                    </Box>

                    <IconButton
                        onClick={closeDialog}
                        disabled={working}
                        sx={closeButtonSx}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent sx={dialogContentSx}>
                    <Box sx={formGridSx}>
                        <TextField
                            select
                            label="Material Category"
                            value={
                                materialCategoryFilter
                            }
                            disabled={
                                working ||
                                materialsLoading
                            }
                            onChange={(event) =>
                                changeMaterialCategory(
                                    event.target.value
                                )
                            }
                            sx={fieldSx}
                        >
                            <MenuItem value="">
                                All Categories
                            </MenuItem>

                            {dynamicCategoryOptions.map(
                                (category) => (
                                    <MenuItem
                                        key={
                                            category.value
                                        }
                                        value={
                                            category.value
                                        }
                                    >
                                        {category.label}
                                    </MenuItem>
                                )
                            )}
                        </TextField>

                        <TextField
                            select
                            label="Material *"
                            value={form.materialId}
                            disabled={
                                working ||
                                materialsLoading
                            }
                            onChange={(event) =>
                                changeMaterial(
                                    event.target.value
                                )
                            }
                            sx={fieldSx}
                        >
                            {filteredMaterials.length ===
                                0 ? (
                                <MenuItem
                                    value=""
                                    disabled
                                >
                                    No active materials in this category
                                </MenuItem>
                            ) : (
                                filteredMaterials.map(
                                    (material) => (
                                        <MenuItem
                                            key={
                                                material.id
                                            }
                                            value={
                                                material.id
                                            }
                                        >
                                            {material.materialCode}
                                            {" · "}
                                            {material.materialName}
                                        </MenuItem>
                                    )
                                )
                            )}
                        </TextField>

                        <TextField
                            label="Required Quantity *"
                            type="number"
                            value={form.requiredQty}
                            disabled={working}
                            onChange={(event) =>
                                updateForm(
                                    "requiredQty",
                                    event.target.value
                                )
                            }
                            inputProps={{
                                min: 0.001,
                                step: 0.001,
                            }}
                            sx={fieldSx}
                        />

                        <TextField
                            label="Wastage Percentage"
                            type="number"
                            value={
                                form.wastagePercent
                            }
                            disabled={working}
                            onChange={(event) =>
                                updateForm(
                                    "wastagePercent",
                                    event.target.value
                                )
                            }
                            inputProps={{
                                min: 0,
                                max: 1000,
                                step: 0.01,
                            }}
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

                    <Box sx={selectedMaterialGridSx}>
                        <MaterialInfo
                            label="Category"
                            value={
                                selectedMaterial
                                    ? getMatFlowCategoryMeta(
                                        selectedMaterial.category
                                    ).label
                                    : "-"
                            }
                        />

                        <MaterialInfo
                            label="Unit"
                            value={
                                selectedMaterial?.uom ||
                                "-"
                            }
                        />

                        <MaterialInfo
                            label="Specification"
                            value={
                                selectedMaterial?.specification ||
                                "-"
                            }
                        />

                        <MaterialInfo
                            label="Calculated Net Required"
                            value={`${formatQty(
                                calculatedNetQty
                            )} ${selectedMaterial?.uom ||
                                ""
                                }`.trim()}
                            emphasis
                        />
                    </Box>
                </DialogContent>

                <DialogActions sx={dialogActionsSx}>
                    <Button
                        onClick={closeDialog}
                        disabled={working}
                        sx={secondaryBtnSx}
                    >
                        Cancel
                    </Button>

                    <Button
                        onClick={save}
                        disabled={
                            working ||
                            materialsLoading ||
                            !editable ||
                            !form.materialId ||
                            !form.requiredQty
                        }
                        sx={primaryBtnSx}
                    >
                        {working
                            ? "Saving..."
                            : "Save Material Line"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

function MiniStat({
    icon,
    title,
    value,
    subtitle,
    accent,
}) {
    return (
        <Card sx={miniStatSx(accent)}>
            <Box sx={miniIconSx(accent)}>
                {icon}
            </Box>

            <Box>
                <Typography sx={miniTitleSx}>
                    {title}
                </Typography>

                <Typography sx={miniValueSx}>
                    {value}
                </Typography>

                <Typography sx={miniSubSx}>
                    {subtitle}
                </Typography>
            </Box>
        </Card>
    );
}

function MaterialInfo({
    label,
    value,
    emphasis = false,
}) {
    return (
        <Box sx={materialInfoSx}>
            <Typography sx={materialInfoLabelSx}>
                {label}
            </Typography>

            <Typography
                sx={{
                    ...materialInfoValueSx,

                    color:
                        emphasis
                            ? "#4ade80"
                            : "#fff",
                }}
            >
                {value || "-"}
            </Typography>
        </Box>
    );
}

const builderShellSx = {
    display: "flex",
    flexDirection: "column",
    gap: "11px",
};

const builderToolbarSx = {
    p: "14px",
    borderRadius: "11px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    background:
        "rgba(15,23,42,.80)",
    border:
        "1px solid rgba(255,255,255,.07)",
};

const titleRowSx = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
};

const builderTitleSx = {
    color: "#fff",
    fontSize: "17px",
    fontWeight: 950,
};

const builderSubSx = {
    mt: "3px",
    color:
        "rgba(255,255,255,.52)",
    fontSize: "11px",
    fontWeight: 650,
};

const builderActionsSx = {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    flexWrap: "wrap",
};

const searchFieldSx = {
    ...fieldSx,
    width: {
        xs: "100%",
        md: "270px",
    },
};

const summaryGridSx = {
    display: "grid",
    gridTemplateColumns:
        "repeat(auto-fit,minmax(210px,1fr))",
    gap: "9px",
};

const miniStatSx = (accent) => ({
    p: "12px",
    minHeight: "70px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    position: "relative",
    overflow: "hidden",
    background:
        "rgba(15,23,42,.78)",
    border:
        "1px solid rgba(255,255,255,.07)",

    "&:before": {
        content: '""',
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "3px",
        background: accent,
    },
});

const miniIconSx = (accent) => ({
    width: "38px",
    height: "38px",
    borderRadius: "9px",
    display: "grid",
    placeItems: "center",
    color: accent,
    background:
        `${accent}18`,
    border:
        `1px solid ${accent}33`,
    flexShrink: 0,
    fontSize: "18px",
    fontWeight: 950,
});

const miniTitleSx = {
    color:
        "rgba(255,255,255,.52)",
    fontSize: "9.5px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".07em",
};

const miniValueSx = {
    mt: "3px",
    color: "#fff",
    fontSize: "16px",
    fontWeight: 950,
};

const miniSubSx = {
    mt: "2px",
    color:
        "rgba(255,255,255,.46)",
    fontSize: "10px",
    fontWeight: 650,
};

const sectionCardSx = (
    accent,
    open
) => ({
    overflow: "hidden",
    borderRadius: "10px",
    background:
        open
            ? `linear-gradient(180deg,${accent}10,rgba(15,23,42,.80))`
            : "rgba(15,23,42,.78)",
    border:
        open
            ? `1px solid ${accent}40`
            : "1px solid rgba(255,255,255,.07)",
    borderLeft:
        `3px solid ${accent}`,
});

const sectionHeaderSx = {
    minHeight: "55px",
    px: "13px",
    py: "9px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    background:
        "rgba(2,6,23,.24)",
    borderBottom:
        "1px solid rgba(255,255,255,.07)",
};

const sectionLeftSx = {
    display: "flex",
    alignItems: "center",
    gap: "9px",
};

const sectionRightSx = {
    display: "flex",
    alignItems: "center",
    gap: "7px",
};

const sectionToggleSx = {
    width: "31px",
    height: "31px",
    borderRadius: "8px",
    color: "#94a3b8",
    background:
        "rgba(255,255,255,.04)",
    border:
        "1px solid rgba(255,255,255,.07)",
};

const sectionTitleRowSx = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
};

const sectionTitleSx = {
    color: "#fff",
    fontSize: "17px",
    fontWeight: 950,
};

const sectionSubSx = {
    mt: "3px",
    color:
        "rgba(255,255,255,.50)",
    fontSize: "10.5px",
    fontWeight: 650,
};

const sectionCountSx = {
    height: "21px",
    borderRadius: 999,
    color: "#cbd5e1",
    background:
        "rgba(255,255,255,.06)",
    border:
        "1px solid rgba(255,255,255,.08)",
    fontSize: "9px",
    fontWeight: 900,
};

const lineColumns =
    "55px minmax(210px,1.2fr) minmax(230px,1.3fr) 100px 90px 110px 75px minmax(170px,1fr) 95px";

const lineHeaderSx = {
    ...tableHeaderSx,
    gridTemplateColumns:
        lineColumns,
    minWidth: "1160px",
};

const lineRowSx = {
    ...tableRowSx,
    gridTemplateColumns:
        lineColumns,
    minWidth: "1160px",
};

const mainTextSx = {
    color: "#fff",
    fontSize: "12px",
    fontWeight: 850,
};

const subTextSx = {
    mt: "2px",
    color:
        "rgba(255,255,255,.47)",
    fontSize: "10px",
};

const quantityCellSx = {
    ...tableCellSx,
    color: "#fff",
    fontFamily: "monospace",
    fontWeight: 800,
};

const netQuantityCellSx = {
    ...quantityCellSx,
    color: "#4ade80",
    fontWeight: 950,
};

const actionCellSx = {
    ...tableCellSx,
    display: "flex",
    alignItems: "center",
    gap: "4px",
};

const editButtonSx = {
    width: "31px",
    height: "31px",
    color: "#7dd3fc",
    background:
        "rgba(14,165,233,.10)",
    border:
        "1px solid rgba(14,165,233,.20)",
};

const deleteButtonSx = {
    width: "31px",
    height: "31px",
    color: "#fca5a5",
    background:
        "rgba(239,68,68,.10)",
    border:
        "1px solid rgba(239,68,68,.20)",
};

const lockedChipSx = {
    height: "21px",
    color: "#86efac",
    background:
        "rgba(34,197,94,.11)",
    border:
        "1px solid rgba(34,197,94,.20)",
    fontSize: "8.5px",
    fontWeight: 900,
};

const emptyBuilderSx = {
    minHeight: "145px",
    p: "18px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "14px",
    flexWrap: "wrap",
    textAlign: "left",
    background:
        "rgba(15,23,42,.78)",
    border:
        "1px solid rgba(255,255,255,.07)",
};

const emptyIconSx = {
    width: "42px",
    height: "42px",
    borderRadius: "10px",
    display: "grid",
    placeItems: "center",
    color: "#7dd3fc",
    background:
        "rgba(14,165,233,.12)",
    border:
        "1px solid rgba(14,165,233,.22)",
};

const emptyTitleSx = {
    color: "#fff",
    fontSize: "14px",
    fontWeight: 900,
};

const emptySubSx = {
    mt: "3px",
    color:
        "rgba(255,255,255,.50)",
    fontSize: "11px",
};

const localErrorSx = {
    p: "10px 12px",
    borderRadius: "9px",
    color: "#fca5a5",
    background:
        "rgba(239,68,68,.12)",
    border:
        "1px solid rgba(239,68,68,.24)",
    fontSize: "11px",
    fontWeight: 750,
};

const dialogPaperSx = {
    borderRadius: "14px",
    color: "#fff",
    background:
        "linear-gradient(180deg,#0f172a,#111827)",
    border:
        "1px solid rgba(255,255,255,.08)",
};

const dialogTitleSx = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    borderBottom:
        "1px solid rgba(255,255,255,.07)",
};

const dialogHeadingSx = {
    color: "#fff",
    fontSize: "19px",
    fontWeight: 950,
};

const dialogSubSx = {
    mt: "4px",
    color:
        "rgba(255,255,255,.52)",
    fontSize: "11px",
};

const closeButtonSx = {
    color: "#94a3b8",
};

const dialogContentSx = {
    pt: "18px !important",
};

const formGridSx = {
    display: "grid",
    gridTemplateColumns:
        "repeat(2,minmax(0,1fr))",
    gap: "12px",

    "@media (max-width: 700px)": {
        gridTemplateColumns:
            "1fr",
    },
};

const selectedMaterialGridSx = {
    mt: "14px",
    p: "12px",
    borderRadius: "9px",
    display: "grid",
    gridTemplateColumns:
        "repeat(4,minmax(0,1fr))",
    gap: "10px",
    background:
        "rgba(2,6,23,.36)",
    border:
        "1px solid rgba(255,255,255,.07)",

    "@media (max-width: 800px)": {
        gridTemplateColumns:
            "repeat(2,minmax(0,1fr))",
    },

    "@media (max-width: 520px)": {
        gridTemplateColumns:
            "1fr",
    },
};

const materialInfoSx = {
    minWidth: 0,
};

const materialInfoLabelSx = {
    color:
        "rgba(255,255,255,.48)",
    fontSize: "9px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".07em",
};

const materialInfoValueSx = {
    mt: "4px",
    color: "#fff",
    fontSize: "12px",
    fontWeight: 850,
    wordBreak: "break-word",
};

const dialogActionsSx = {
    p: "14px 24px 20px",
    borderTop:
        "1px solid rgba(255,255,255,.07)",
};