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
    FormControlLabel,
    IconButton,
    MenuItem,
    Switch,
    TextField,
    Typography,
} from "@mui/material";

import AddIcon
    from "@mui/icons-material/Add";

import CloseIcon
    from "@mui/icons-material/Close";

import EditOutlinedIcon
    from "@mui/icons-material/EditOutlined";

import RefreshIcon
    from "@mui/icons-material/Refresh";

import SearchIcon
    from "@mui/icons-material/Search";

import VisibilityOutlinedIcon
    from "@mui/icons-material/VisibilityOutlined";

import AccountTreeOutlinedIcon
    from "@mui/icons-material/AccountTreeOutlined";

import PersonOutlineOutlinedIcon
    from "@mui/icons-material/PersonOutlineOutlined";

import FactoryOutlinedIcon
    from "@mui/icons-material/FactoryOutlined";

import EventOutlinedIcon
    from "@mui/icons-material/EventOutlined";

import Inventory2OutlinedIcon
    from "@mui/icons-material/Inventory2Outlined";

import {
    useNavigate,
} from "react-router-dom";

import {
    useAuth,
} from "../../../auth/AuthContext";

import {
    getMatFlowRole,
    MATFLOW_ROLES,
} from "../../../utils/matflowAccess";

import {
    extractMatFlowPage,
    matflowApi,
    readMatFlowError,
} from "../api/matflowApi";

import {
    closeButtonSx,
    dialogActionsSx,
    dialogContentSx,
    dialogHeadingSx,
    dialogPaperSx,
    dialogSubSx,
    dialogTitleSx,
    emptySx,
    errorBoxSx,
    fieldSx,
    heroBadgeSx,
    heroSubSx,
    heroSx,
    heroTitleSx,
    loadingSx,
    mainTextSx,
    pageSx,
    pageTextSx,
    panelSx,
    primaryBtnSx,
    secondaryBtnSx,
    sectionSubSx,
    sectionTitleSx,
    subTextSx,
    switchLabelSx,
    tableCellSx,
    tableHeaderSx,
    tableRowSx,
    tableShellSx,
} from "../matflowTheme";

const DEFAULT_PLANTS = [
    "AL-P1",
    "AL-P2",
    "AL-P3",
    "AL-P4",
];

const PAGE_SIZE = 25;

const DIALOG_MODE = {
    CREATE_PROJECT:
        "CREATE_PROJECT",

    ADD_PRODUCT:
        "ADD_PRODUCT",

    EDIT_PRODUCT:
        "EDIT_PRODUCT",
};

const EMPTY_FORM = {
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
};

const clean = (
    value
) =>
    String(
        value ??
        ""
    ).trim();

const normalize = (
    value
) =>
    clean(value)
        .toUpperCase();

const formatDate = (
    value
) => {
    const cleaned =
        clean(value);

    if (!cleaned) {
        return "Not specified";
    }

    const parsed =
        new Date(
            `${cleaned}T00:00:00`
        );

    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
        return cleaned;
    }

    return parsed.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
        }
    );
};

const groupProjectRows = (
    rows
) => {
    const groups =
        new Map();

    (
        Array.isArray(rows)
            ? rows
            : []
    ).forEach(
        (row) => {
            if (!row?.id) {
                return;
            }

            const projectCode =
                normalize(
                    row.projectCode
                );

            const plantCode =
                normalize(
                    row.owningPlantCode ||
                    row.plantCode
                );

            const key =
                `${plantCode}::${projectCode}`;

            if (
                !groups.has(
                    key
                )
            ) {
                groups.set(
                    key,
                    {
                        key,

                        projectCode:
                            row.projectCode,

                        projectName:
                            row.projectName,

                        clientName:
                            row.clientName,

                        plantCode:
                            row.owningPlantCode ||
                            row.plantCode,

                        requiredDate:
                            row.requiredDate,

                        products: [],
                    }
                );
            }

            groups
                .get(key)
                .products
                .push(row);
        }
    );

    return Array.from(
        groups.values()
    )
        .map(
            (project) => ({
                ...project,

                products:
                    [
                        ...project.products,
                    ].sort(
                        (
                            left,
                            right
                        ) => {
                            const productCompare =
                                String(
                                    left.productName ||
                                    ""
                                ).localeCompare(
                                    String(
                                        right.productName ||
                                        ""
                                    )
                                );

                            if (
                                productCompare !==
                                0
                            ) {
                                return productCompare;
                            }

                            return String(
                                left.drawingNo ||
                                ""
                            ).localeCompare(
                                String(
                                    right.drawingNo ||
                                    ""
                                )
                            );
                        }
                    ),
            })
        )
        .sort(
            (
                left,
                right
            ) =>
                String(
                    left.projectCode ||
                    ""
                ).localeCompare(
                    String(
                        right.projectCode ||
                        ""
                    )
                )
        );
};

export default function MatFlowProjectMaster() {
    const navigate =
        useNavigate();

    const {
        role,
        user,
        plantCode,
        plantCodes,
    } = useAuth();

    const cleanRole =
        getMatFlowRole(
            role ||
            user?.role
        );

    const canManage = [
        MATFLOW_ROLES.ADMIN,
        MATFLOW_ROLES.MANAGER,
        MATFLOW_ROLES.ENGINEERING,
    ].includes(
        cleanRole
    );

    const availablePlants =
        useMemo(
            () => {
                const assignedPlants = [
                    ...(
                        Array.isArray(
                            plantCodes
                        )
                            ? plantCodes
                            : []
                    ),

                    ...(
                        Array.isArray(
                            user?.plantCodes
                        )
                            ? user.plantCodes
                            : []
                    ),

                    plantCode,
                    user?.plantCode,
                ]
                    .map(
                        normalize
                    )
                    .filter(
                        Boolean
                    );

                if (
                    assignedPlants.length >
                    0
                ) {
                    return Array.from(
                        new Set(
                            assignedPlants
                        )
                    ).sort();
                }

                if (
                    cleanRole ===
                    MATFLOW_ROLES.ADMIN
                ) {
                    return [
                        ...DEFAULT_PLANTS,
                    ];
                }

                return [];
            },
            [
                cleanRole,
                plantCode,
                plantCodes,
                user?.plantCode,
                user?.plantCodes,
            ]
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
        plantFilter,
        setPlantFilter,
    ] = useState("");

    const [
        page,
        setPage,
    ] = useState(0);

    const [
        totalPages,
        setTotalPages,
    ] = useState(0);

    const [
        totalElements,
        setTotalElements,
    ] = useState(0);

    const [
        dialogOpen,
        setDialogOpen,
    ] = useState(false);

    const [
        dialogMode,
        setDialogMode,
    ] = useState(
        DIALOG_MODE.CREATE_PROJECT
    );

    const [
        editingRow,
        setEditingRow,
    ] = useState(null);

    const [
        form,
        setForm,
    ] = useState(
        EMPTY_FORM
    );

    const load =
        useCallback(
            async (
                targetPage = 0,
                targetSearch = "",
                targetPlant = ""
            ) => {
                setLoading(true);
                setError("");

                try {
                    const response =
                        await matflowApi
                            .listProjects({
                                search:
                                    clean(
                                        targetSearch
                                    ) ||
                                    undefined,
                            });

                    const result =
                        extractMatFlowPage(
                            response?.data
                        );

                    const sourceRows =
                        Array.isArray(
                            result.rows
                        )
                            ? result.rows
                            : [];

                    const normalizedPlant =
                        normalize(
                            targetPlant
                        );

                    const filteredRows =
                        normalizedPlant
                            ? sourceRows.filter(
                                (project) =>
                                    normalize(
                                        project
                                            ?.owningPlantCode ||
                                        project
                                            ?.plantCode
                                    ) ===
                                    normalizedPlant
                            )
                            : sourceRows;

                    const projectGroups =
                        groupProjectRows(
                            filteredRows
                        );

                    const calculatedTotalPages =
                        projectGroups.length ===
                            0
                            ? 0
                            : Math.ceil(
                                projectGroups.length /
                                PAGE_SIZE
                            );

                    const safePage =
                        calculatedTotalPages ===
                            0
                            ? 0
                            : Math.min(
                                Math.max(
                                    targetPage,
                                    0
                                ),
                                calculatedTotalPages -
                                1
                            );

                    const startIndex =
                        safePage *
                        PAGE_SIZE;

                    setRows(
                        projectGroups.slice(
                            startIndex,
                            startIndex +
                            PAGE_SIZE
                        )
                    );

                    setPage(
                        safePage
                    );

                    setTotalElements(
                        projectGroups.length
                    );

                    setTotalPages(
                        calculatedTotalPages
                    );
                } catch (
                requestError
                ) {
                    setRows([]);
                    setPage(0);
                    setTotalElements(0);
                    setTotalPages(0);

                    setError(
                        readMatFlowError(
                            requestError,
                            "Unable to load projects and product drawings."
                        )
                    );
                } finally {
                    setLoading(false);
                }
            },
            []
        );

    useEffect(() => {
        load();
    }, [load]);

    const openCreateProject =
        () => {
            setDialogMode(
                DIALOG_MODE.CREATE_PROJECT
            );

            setEditingRow(null);

            setForm({
                ...EMPTY_FORM,

                plantCode:
                    availablePlants[0] ||
                    "",
            });

            setDialogOpen(true);
            setError("");
        };

    const openAddProduct = (
        project
    ) => {
        setDialogMode(
            DIALOG_MODE.ADD_PRODUCT
        );

        setEditingRow(null);

        setForm({
            ...EMPTY_FORM,

            projectCode:
                project?.projectCode ||
                "",

            projectName:
                project?.projectName ||
                "",

            clientName:
                project?.clientName ||
                "",

            plantCode:
                project?.plantCode ||
                availablePlants[0] ||
                "",

            requiredDate:
                project?.requiredDate ||
                "",
        });

        setDialogOpen(true);
        setError("");
    };

    const openEditProduct = (
        product
    ) => {
        setDialogMode(
            DIALOG_MODE.EDIT_PRODUCT
        );

        setEditingRow(
            product
        );

        setForm({
            projectCode:
                product?.projectCode ||
                "",

            projectName:
                product?.projectName ||
                "",

            clientName:
                product?.clientName ||
                "",

            drawingNo:
                product?.drawingNo ||
                "",

            drawingRevision:
                product?.drawingRevision ||
                "0",

            productName:
                product?.productName ||
                "",

            plantCode:
                product?.owningPlantCode ||
                product?.plantCode ||
                "",

            requiredDate:
                product?.requiredDate ||
                "",

            remarks:
                product?.remarks ||
                "",

            active:
                product?.active !==
                false,
        });

        setDialogOpen(true);
        setError("");
    };

    const closeDialog =
        () => {
            if (saving) {
                return;
            }

            setDialogOpen(false);

            setDialogMode(
                DIALOG_MODE.CREATE_PROJECT
            );

            setEditingRow(null);

            setForm(
                EMPTY_FORM
            );
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

    const validate =
        () => {
            if (
                !clean(
                    form.projectCode
                )
            ) {
                return "Project or PD code is required.";
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
                    form.drawingNo
                )
            ) {
                return "Drawing number is required.";
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
                    form.plantCode
                )
            ) {
                return "Owning plant is required.";
            }

            return "";
        };

    const save =
        async () => {
            const validationError =
                validate();

            if (
                validationError
            ) {
                setError(
                    validationError
                );

                return;
            }

            const editing =
                Boolean(
                    editingRow?.id
                );

            const body = {
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
                    ) ||
                    null,

                drawingNo:
                    normalize(
                        form.drawingNo
                    ),

                drawingRevision:
                    normalize(
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
                    form.requiredDate ||
                    null,

                remarks:
                    clean(
                        form.remarks
                    ) ||
                    null,

                active:
                    form.active !==
                    false,

                rowVersion:
                    editingRow?.rowVersion ??
                    null,
            };

            setSaving(true);
            setError("");

            try {
                const response =
                    editing
                        ? await matflowApi
                            .updateProject(
                                editingRow.id,
                                body
                            )
                        : await matflowApi
                            .createProject(
                                body
                            );

                if (
                    !response
                        ?.data
                        ?.id
                ) {
                    throw new Error(
                        "Product/Drawing ID was not returned."
                    );
                }

                setDialogOpen(false);

                setDialogMode(
                    DIALOG_MODE.CREATE_PROJECT
                );

                setEditingRow(null);

                setForm(
                    EMPTY_FORM
                );

                await load(
                    editing
                        ? page
                        : 0,
                    search,
                    plantFilter
                );
            } catch (
            requestError
            ) {
                setError(
                    readMatFlowError(
                        requestError,
                        "Unable to save the project product drawing."
                    )
                );
            } finally {
                setSaving(false);
            }
        };

    const projectFieldsLocked =
        dialogMode !==
        DIALOG_MODE.CREATE_PROJECT;

    const currentDialogTitle =
        dialogMode ===
            DIALOG_MODE.EDIT_PRODUCT
            ? "Edit Product / Drawing"
            : dialogMode ===
                DIALOG_MODE.ADD_PRODUCT
                ? "Add Product / Drawing"
                : "Create Project and First Product";

    const saveLabel =
        dialogMode ===
            DIALOG_MODE.EDIT_PRODUCT
            ? "Save Product"
            : dialogMode ===
                DIALOG_MODE.ADD_PRODUCT
                ? "Add Product"
                : "Create Project & First Product";

    return (
        <Box sx={pageSx}>
            <Box sx={heroSx}>
                <Box sx={headerRowSx}>
                    <Box>
                        <Chip
                            label="PROJECT / PRODUCT MASTER"
                            sx={heroBadgeSx}
                        />

                        <Typography sx={heroTitleSx}>
                            Projects and Product Drawings
                        </Typography>

                        <Typography sx={heroSubSx}>
                            Create one client project or PD
                            and maintain multiple product
                            drawings under it. Every product
                            drawing receives its own BOM,
                            requisition and material lifecycle.
                        </Typography>
                    </Box>

                    {canManage && (
                        <Button
                            startIcon={
                                <AddIcon />
                            }
                            onClick={
                                openCreateProject
                            }
                            sx={primaryBtnSx}
                        >
                            Create Project
                        </Button>
                    )}
                </Box>
            </Box>

            <Card sx={panelSx}>
                <Box sx={filterGridSx}>
                    <TextField
                        label="Search"
                        placeholder="PD, project, drawing, client or product..."
                        value={search}
                        onChange={(event) =>
                            setSearch(
                                event.target.value
                            )
                        }
                        onKeyDown={(event) => {
                            if (
                                event.key ===
                                "Enter"
                            ) {
                                load(
                                    0,
                                    search,
                                    plantFilter
                                );
                            }
                        }}
                        sx={fieldSx}
                    />

                    <TextField
                        select
                        label="Plant"
                        value={
                            plantFilter
                        }
                        onChange={(event) =>
                            setPlantFilter(
                                event.target.value
                            )
                        }
                        sx={fieldSx}
                    >
                        <MenuItem value="">
                            All Allowed Plants
                        </MenuItem>

                        {availablePlants.map(
                            (plant) => (
                                <MenuItem
                                    key={plant}
                                    value={plant}
                                >
                                    {plant}
                                </MenuItem>
                            )
                        )}
                    </TextField>

                    <Box sx={toolbarActionsSx}>
                        <Button
                            startIcon={
                                <SearchIcon />
                            }
                            onClick={() =>
                                load(
                                    0,
                                    search,
                                    plantFilter
                                )
                            }
                            disabled={loading}
                            sx={primaryBtnSx}
                        >
                            Search
                        </Button>

                        <Button
                            startIcon={
                                <RefreshIcon />
                            }
                            onClick={() =>
                                load(
                                    page,
                                    search,
                                    plantFilter
                                )
                            }
                            disabled={loading}
                            sx={secondaryBtnSx}
                        >
                            Refresh
                        </Button>
                    </Box>
                </Box>
            </Card>

            {error && (
                <Box sx={errorBoxSx}>
                    {error}
                </Box>
            )}

            <Card sx={panelSx}>
                <Box sx={resultHeaderSx}>
                    <Box>
                        <Typography sx={sectionTitleSx}>
                            Project Register
                        </Typography>

                        <Typography sx={sectionSubSx}>
                            {totalElements}
                            {" client project"}
                            {totalElements ===
                                1
                                ? ""
                                : "s"}
                        </Typography>
                    </Box>
                </Box>

                {loading ? (
                    <Box sx={loadingSx}>
                        <CircularProgress />
                    </Box>
                ) : rows.length ===
                    0 ? (
                    <Box sx={emptySx}>
                        No projects or product drawings were found.
                    </Box>
                ) : (
                    <Box sx={projectListSx}>
                        {rows.map(
                            (
                                project,
                                projectIndex
                            ) => {
                                const activeProducts =
                                    project
                                        .products
                                        .filter(
                                            (product) =>
                                                product.active !==
                                                false
                                        ).length;

                                return (
                                    <Box
                                        key={
                                            project.key
                                        }
                                        sx={projectGroupSx}
                                    >
                                        <Box sx={projectTopAccentSx} />

                                        <Box sx={projectGroupHeaderSx}>
                                            <Box sx={projectIdentitySx}>
                                                <Box sx={projectIconSx}>
                                                    <AccountTreeOutlinedIcon />
                                                </Box>

                                                <Box sx={{ minWidth: 0 }}>
                                                    <Box sx={projectTitleRowSx}>
                                                        <Chip
                                                            label={
                                                                project.projectCode ||
                                                                `PROJECT ${projectIndex + 1}`
                                                            }
                                                            sx={projectCodeChipSx}
                                                        />

                                                        <Typography sx={projectNameSx}>
                                                            {project.projectName ||
                                                                "Unnamed Project"}
                                                        </Typography>
                                                    </Box>

                                                    <Typography sx={projectHierarchySx}>
                                                        Client Project
                                                        {" → "}
                                                        Product Drawings
                                                        {" → "}
                                                        Operational BOMs
                                                    </Typography>

                                                    <Box sx={projectMetaGridSx}>
                                                        <ProjectMetaItem
                                                            icon={
                                                                <PersonOutlineOutlinedIcon />
                                                            }
                                                            label="Client"
                                                            value={
                                                                project.clientName ||
                                                                "Not specified"
                                                            }
                                                        />

                                                        <ProjectMetaItem
                                                            icon={
                                                                <FactoryOutlinedIcon />
                                                            }
                                                            label="Owning Plant"
                                                            value={
                                                                project.plantCode ||
                                                                "Not specified"
                                                            }
                                                        />

                                                        <ProjectMetaItem
                                                            icon={
                                                                <EventOutlinedIcon />
                                                            }
                                                            label="Required Date"
                                                            value={
                                                                formatDate(
                                                                    project.requiredDate
                                                                )
                                                            }
                                                        />

                                                        <ProjectMetaItem
                                                            icon={
                                                                <Inventory2OutlinedIcon />
                                                            }
                                                            label="Active Products"
                                                            value={`${activeProducts} of ${project.products.length}`}
                                                        />
                                                    </Box>
                                                </Box>
                                            </Box>

                                            <Box sx={projectActionsSx}>
                                                <Chip
                                                    label={`${project.products.length} Product${project.products.length ===
                                                        1
                                                        ? ""
                                                        : "s"
                                                        }`}
                                                    sx={productCountChipSx}
                                                />

                                                {canManage && (
                                                    <Button
                                                        startIcon={
                                                            <AddIcon />
                                                        }
                                                        onClick={() =>
                                                            openAddProduct(
                                                                project
                                                            )
                                                        }
                                                        sx={projectAddBtnSx}
                                                    >
                                                        Add Product
                                                    </Button>
                                                )}
                                            </Box>
                                        </Box>

                                        <Box sx={productSectionHeadingSx}>
                                            <Box>
                                                <Typography sx={productSectionTitleSx}>
                                                    Product and Drawing Register
                                                </Typography>

                                                <Typography sx={productSectionSubSx}>
                                                    Separate manufacturing
                                                    context and BOM lifecycle
                                                    for every project product.
                                                </Typography>
                                            </Box>
                                        </Box>

                                        <Box sx={productTableShellSx}>
                                            <Box sx={productHeaderSx}>
                                                <Box sx={tableCellSx}>
                                                    Product
                                                </Box>

                                                <Box sx={tableCellSx}>
                                                    Drawing
                                                </Box>

                                                <Box sx={tableCellSx}>
                                                    Revision
                                                </Box>

                                                <Box sx={tableCellSx}>
                                                    Status
                                                </Box>

                                                <Box sx={tableCellSx}>
                                                    Version
                                                </Box>

                                                <Box sx={tableCellSx}>
                                                    Actions
                                                </Box>
                                            </Box>

                                            {project.products.map(
                                                (
                                                    product,
                                                    productIndex
                                                ) => (
                                                    <Box
                                                        key={
                                                            product.id
                                                        }
                                                        sx={productRowSx}
                                                    >
                                                        <Box sx={tableCellSx}>
                                                            <Box sx={productIdentityCellSx}>
                                                                <Box sx={productSequenceSx}>
                                                                    {productIndex +
                                                                        1}
                                                                </Box>

                                                                <Box sx={{ minWidth: 0 }}>
                                                                    <Typography sx={productNameCellSx}>
                                                                        {product.productName ||
                                                                            "-"}
                                                                    </Typography>

                                                                    <Typography sx={subTextSx}>
                                                                        {product.remarks ||
                                                                            "No product remarks"}
                                                                    </Typography>
                                                                </Box>
                                                            </Box>
                                                        </Box>

                                                        <Box sx={tableCellSx}>
                                                            <Typography sx={drawingCodeSx}>
                                                                {product.drawingNo ||
                                                                    "-"}
                                                            </Typography>
                                                        </Box>

                                                        <Box sx={tableCellSx}>
                                                            <Chip
                                                                label={`REV ${product.drawingRevision || "0"}`}
                                                                size="small"
                                                                sx={revisionChipSx}
                                                            />
                                                        </Box>

                                                        <Box sx={tableCellSx}>
                                                            <Chip
                                                                label={
                                                                    product.active ===
                                                                        false
                                                                        ? "Inactive"
                                                                        : "Active"
                                                                }
                                                                size="small"
                                                                sx={
                                                                    product.active ===
                                                                        false
                                                                        ? inactiveChipSx
                                                                        : activeChipSx
                                                                }
                                                            />
                                                        </Box>

                                                        <Box sx={tableCellSx}>
                                                            {product.rowVersion ??
                                                                "-"}
                                                        </Box>

                                                        <Box sx={actionCellSx}>
                                                            <Button
                                                                startIcon={
                                                                    <VisibilityOutlinedIcon />
                                                                }
                                                                onClick={() =>
                                                                    navigate(
                                                                        `/matflow/projects/${product.id}`
                                                                    )
                                                                }
                                                                sx={secondaryBtnSx}
                                                            >
                                                                Track
                                                            </Button>

                                                            {canManage && (
                                                                <Button
                                                                    startIcon={
                                                                        <EditOutlinedIcon />
                                                                    }
                                                                    onClick={() =>
                                                                        openEditProduct(
                                                                            product
                                                                        )
                                                                    }
                                                                    sx={secondaryBtnSx}
                                                                >
                                                                    Edit
                                                                </Button>
                                                            )}
                                                        </Box>
                                                    </Box>
                                                )
                                            )}
                                        </Box>
                                    </Box>
                                );
                            }
                        )}
                    </Box>
                )}

                <Box sx={paginationSx}>
                    <Button
                        disabled={
                            loading ||
                            page <= 0
                        }
                        onClick={() =>
                            load(
                                Math.max(
                                    page -
                                    1,
                                    0
                                ),
                                search,
                                plantFilter
                            )
                        }
                        sx={secondaryBtnSx}
                    >
                        Previous
                    </Button>

                    <Typography sx={pageTextSx}>
                        Page {page + 1} of{" "}
                        {Math.max(
                            totalPages,
                            1
                        )}
                    </Typography>

                    <Button
                        disabled={
                            loading ||
                            page + 1 >=
                            totalPages
                        }
                        onClick={() =>
                            load(
                                page + 1,
                                search,
                                plantFilter
                            )
                        }
                        sx={secondaryBtnSx}
                    >
                        Next
                    </Button>
                </Box>
            </Card>

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
                            {currentDialogTitle}
                        </Typography>

                        <Typography sx={dialogSubSx}>
                            Each Product/Drawing record belongs
                            to one client project or PD. Every
                            product receives a separate
                            operational BOM.
                        </Typography>
                    </Box>

                    <IconButton
                        onClick={
                            closeDialog
                        }
                        disabled={saving}
                        sx={closeButtonSx}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent sx={dialogContentSx}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={
                                    form.active ===
                                    true
                                }
                                disabled={saving}
                                onChange={(event) =>
                                    updateForm(
                                        "active",
                                        event.target.checked
                                    )
                                }
                            />
                        }
                        label="Product / Drawing is active"
                        sx={switchLabelSx}
                    />

                    <Box sx={formGridSx}>
                        <TextField
                            label="PD / Project Code *"
                            value={
                                form.projectCode
                            }
                            disabled={
                                saving ||
                                projectFieldsLocked
                            }
                            onChange={(event) =>
                                updateForm(
                                    "projectCode",
                                    event.target.value
                                )
                            }
                            sx={fieldSx}
                        />

                        <TextField
                            label="Project Name *"
                            value={
                                form.projectName
                            }
                            disabled={
                                saving ||
                                projectFieldsLocked
                            }
                            onChange={(event) =>
                                updateForm(
                                    "projectName",
                                    event.target.value
                                )
                            }
                            sx={fieldSx}
                        />

                        <TextField
                            label="Client Name"
                            value={
                                form.clientName
                            }
                            disabled={
                                saving ||
                                projectFieldsLocked
                            }
                            onChange={(event) =>
                                updateForm(
                                    "clientName",
                                    event.target.value
                                )
                            }
                            sx={fieldSx}
                        />

                        <TextField
                            select
                            label="Owning Plant *"
                            value={
                                form.plantCode
                            }
                            disabled={
                                saving ||
                                projectFieldsLocked
                            }
                            onChange={(event) =>
                                updateForm(
                                    "plantCode",
                                    event.target.value
                                )
                            }
                            sx={fieldSx}
                        >
                            {availablePlants.map(
                                (plant) => (
                                    <MenuItem
                                        key={plant}
                                        value={plant}
                                    >
                                        {plant}
                                    </MenuItem>
                                )
                            )}
                        </TextField>

                        <TextField
                            type="date"
                            label="Required Date"
                            value={
                                form.requiredDate
                            }
                            disabled={
                                saving ||
                                projectFieldsLocked
                            }
                            InputLabelProps={{
                                shrink: true,
                            }}
                            onChange={(event) =>
                                updateForm(
                                    "requiredDate",
                                    event.target.value
                                )
                            }
                            sx={fieldSx}
                        />

                        <TextField
                            label="Product Name *"
                            value={
                                form.productName
                            }
                            disabled={saving}
                            onChange={(event) =>
                                updateForm(
                                    "productName",
                                    event.target.value
                                )
                            }
                            sx={fieldSx}
                        />

                        <TextField
                            label="Drawing Number *"
                            value={
                                form.drawingNo
                            }
                            disabled={saving}
                            onChange={(event) =>
                                updateForm(
                                    "drawingNo",
                                    event.target.value
                                )
                            }
                            sx={fieldSx}
                        />

                        <TextField
                            label="Drawing Revision"
                            value={
                                form.drawingRevision
                            }
                            disabled={saving}
                            onChange={(event) =>
                                updateForm(
                                    "drawingRevision",
                                    event.target.value
                                )
                            }
                            sx={fieldSx}
                        />

                        <TextField
                            label="Product / Drawing Remarks"
                            multiline
                            minRows={3}
                            value={
                                form.remarks
                            }
                            disabled={saving}
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
                        onClick={
                            closeDialog
                        }
                        disabled={saving}
                        sx={secondaryBtnSx}
                    >
                        Cancel
                    </Button>

                    <Button
                        onClick={save}
                        disabled={saving}
                        sx={primaryBtnSx}
                    >
                        {saving
                            ? "Saving..."
                            : saveLabel}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

function ProjectMetaItem({
    icon,
    label,
    value,
}) {
    return (
        <Box sx={projectMetaItemSx}>
            <Box sx={projectMetaIconSx}>
                {icon}
            </Box>

            <Box sx={{ minWidth: 0 }}>
                <Typography sx={projectMetaLabelSx}>
                    {label}
                </Typography>

                <Typography sx={projectMetaValueSx}>
                    {value}
                </Typography>
            </Box>
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

const filterGridSx = {
    display: "grid",
    gridTemplateColumns:
        "minmax(260px,1.4fr) minmax(190px,.7fr) auto",
    gap: "10px",
    alignItems: "center",

    "@media (max-width: 800px)": {
        gridTemplateColumns:
            "1fr",
    },
};

const toolbarActionsSx = {
    display: "flex",
    gap: "7px",
    flexWrap: "wrap",
};

const resultHeaderSx = {
    mb: "14px",
};

const projectListSx = {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
};

const projectGroupSx = {
    position: "relative",
    overflow: "hidden",
    borderRadius: "16px",
    border:
        "1px solid var(--mf-border)",
    background:
        "var(--mf-panel-bg-solid)",
    boxShadow:
        "0 8px 26px rgba(15,23,42,.07)",
    transition:
        "transform .18s ease, box-shadow .18s ease, border-color .18s ease",

    "&:hover": {
        transform:
            "translateY(-1px)",
        borderColor:
            "rgba(37,99,235,.28)",
        boxShadow:
            "0 12px 32px rgba(15,23,42,.10)",
    },
};

const projectTopAccentSx = {
    height: "4px",
    background:
        "linear-gradient(90deg,#2563eb 0%,#7c3aed 48%,#0284c7 100%)",
};

const projectGroupHeaderSx = {
    p: "18px",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "18px",
    flexWrap: "wrap",
    background:
        "linear-gradient(135deg,rgba(37,99,235,.09),rgba(124,58,237,.045) 58%,transparent)",
    borderBottom:
        "1px solid var(--mf-border)",
};

const projectIdentitySx = {
    minWidth: 0,
    flex: "1 1 620px",
    display: "flex",
    alignItems: "flex-start",
    gap: "13px",
};

const projectIconSx = {
    width: "46px",
    height: "46px",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    borderRadius: "13px",
    color: "#2563eb",
    background:
        "rgba(37,99,235,.10)",
    border:
        "1px solid rgba(37,99,235,.20)",

    "& svg": {
        fontSize: "23px",
    },
};

const projectTitleRowSx = {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    flexWrap: "wrap",
};

const projectCodeChipSx = {
    height: "27px",
    color: "#fff",
    background:
        "linear-gradient(135deg,#2563eb,#1d4ed8)",
    border:
        "1px solid rgba(37,99,235,.35)",
    boxShadow:
        "0 4px 12px rgba(37,99,235,.20)",
    fontSize: "9px",
    fontWeight: 950,
    letterSpacing: ".05em",
};

const projectNameSx = {
    color:
        "var(--mf-text)",
    fontSize: "19px",
    fontWeight: 950,
    lineHeight: 1.2,
    letterSpacing: "-.015em",
};

const projectHierarchySx = {
    mt: "6px",
    color: "#7c3aed",
    fontSize: "9px",
    fontWeight: 850,
    textTransform: "uppercase",
    letterSpacing: ".045em",
};

const projectMetaGridSx = {
    mt: "12px",
    display: "grid",
    gridTemplateColumns:
        "repeat(4,minmax(120px,1fr))",
    gap: "8px",

    "@media (max-width: 930px)": {
        gridTemplateColumns:
            "repeat(2,minmax(150px,1fr))",
    },

    "@media (max-width: 520px)": {
        gridTemplateColumns:
            "1fr",
    },
};

const projectMetaItemSx = {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: "7px",
    p: "7px 9px",
    borderRadius: "9px",
    background:
        "var(--mf-surface-soft)",
    border:
        "1px solid var(--mf-border)",
};

const projectMetaIconSx = {
    width: "26px",
    height: "26px",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    borderRadius: "7px",
    color: "#0284c7",
    background:
        "rgba(2,132,199,.09)",

    "& svg": {
        fontSize: "15px",
    },
};

const projectMetaLabelSx = {
    color:
        "var(--mf-text-muted)",
    fontSize: "7.5px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".04em",
};

const projectMetaValueSx = {
    mt: "1px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color:
        "var(--mf-text-secondary)",
    fontSize: "9px",
    fontWeight: 800,
};

const projectActionsSx = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
};

const productCountChipSx = {
    height: "28px",
    color: "#7c3aed",
    background:
        "rgba(124,58,237,.10)",
    border:
        "1px solid rgba(124,58,237,.22)",
    fontSize: "9px",
    fontWeight: 900,
};

const projectAddBtnSx = {
    ...primaryBtnSx,
    minHeight: "34px",
};

const productSectionHeadingSx = {
    p: "12px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background:
        "var(--mf-panel-bg-solid)",
};

const productSectionTitleSx = {
    color:
        "var(--mf-text)",
    fontSize: "12px",
    fontWeight: 900,
};

const productSectionSubSx = {
    mt: "2px",
    color:
        "var(--mf-text-muted)",
    fontSize: "8.5px",
    fontWeight: 650,
};

const productTableShellSx = {
    ...tableShellSx,
    border: "none",
    borderRadius: 0,
    borderTop:
        "1px solid var(--mf-border)",
};

const productColumns =
    "minmax(250px,1.4fr) 180px 100px 100px 80px 210px";

const productHeaderSx = {
    ...tableHeaderSx,
    gridTemplateColumns:
        productColumns,
    minWidth: "1020px",
    background:
        "rgba(37,99,235,.045)",
};

const productRowSx = {
    ...tableRowSx,
    gridTemplateColumns:
        productColumns,
    minWidth: "1020px",

    "&:hover": {
        background:
            "var(--mf-hover)",
    },
};

const productIdentityCellSx = {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    minWidth: 0,
};

const productSequenceSx = {
    width: "27px",
    height: "27px",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    borderRadius: "8px",
    color: "#2563eb",
    background:
        "rgba(37,99,235,.09)",
    border:
        "1px solid rgba(37,99,235,.18)",
    fontSize: "9px",
    fontWeight: 950,
};

const productNameCellSx = {
    color:
        "var(--mf-text)",
    fontSize: "11.5px",
    fontWeight: 900,
};

const drawingCodeSx = {
    color: "#7c3aed",
    fontSize: "10.5px",
    fontWeight: 900,
};

const revisionChipSx = {
    height: "22px",
    color: "#0284c7",
    background:
        "rgba(2,132,199,.09)",
    border:
        "1px solid rgba(2,132,199,.20)",
    fontSize: "8px",
    fontWeight: 900,
};

const actionCellSx = {
    ...tableCellSx,
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
};

const activeChipSx = {
    height: "22px",
    color: "#16a34a",
    background:
        "rgba(22,163,74,.10)",
    border:
        "1px solid rgba(22,163,74,.22)",
    fontSize: "8px",
    fontWeight: 900,
};

const inactiveChipSx = {
    height: "22px",
    color: "#dc2626",
    background:
        "rgba(220,38,38,.10)",
    border:
        "1px solid rgba(220,38,38,.22)",
    fontSize: "8px",
    fontWeight: 900,
};

const paginationSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "9px",
    mt: "14px",
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