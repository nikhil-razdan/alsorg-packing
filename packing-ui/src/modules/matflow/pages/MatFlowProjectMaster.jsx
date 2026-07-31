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
    IconButton,
    MenuItem,
    TextField,
    Typography,
    FormControlLabel,
    Switch
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

import { useNavigate }
    from "react-router-dom";

import { useAuth }
    from "../../../auth/AuthContext";

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
    closeButtonSx,
    dialogActionsSx,
    dialogContentSx,
    dialogHeadingSx,
    dialogPaperSx,
    dialogSubSx,
    dialogTitleSx,
    emptySx,
    mainTextSx,
    pageTextSx,
    sectionSubSx,
    sectionTitleSx,
    subTextSx,
    switchLabelSx,
    tableShellSx,
} from "../matflowTheme";

const DEFAULT_PLANTS = [
    "AL-P1",
    "AL-P2",
    "AL-P3",
    "AL-P4",
];

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

const clean = (value) => {
    return String(value ?? "").trim();
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
    ].includes(cleanRole);

    const availablePlants =
        useMemo(() => {
            const assignedPlants = [
                ...(Array.isArray(plantCodes)
                    ? plantCodes
                    : []),

                ...(Array.isArray(
                    user?.plantCodes
                )
                    ? user.plantCodes
                    : []),

                plantCode,
                user?.plantCode,
            ]
                .map((value) =>
                    String(value || "")
                        .trim()
                        .toUpperCase()
                )
                .filter(Boolean);

            if (assignedPlants.length > 0) {
                return Array.from(
                    new Set(
                        assignedPlants
                    )
                ).sort();
            }

            /*
             * Admin can operate across all company plants.
             * These names must correspond to the plant codes
             * accepted by your backend.
             */
            if (
                cleanRole ===
                MATFLOW_ROLES.ADMIN
            ) {
                return [...DEFAULT_PLANTS];
            }

            return [];
        }, [
            cleanRole,
            plantCode,
            plantCodes,
            user,
        ]);

    const [rows, setRows] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [saving, setSaving] =
        useState(false);

    const [error, setError] =
        useState("");

    const [search, setSearch] =
        useState("");

    const [plantFilter, setPlantFilter] =
        useState("");

    const [page, setPage] =
        useState(0);

    const [totalPages, setTotalPages] =
        useState(0);

    const [totalElements, setTotalElements] =
        useState(0);

    const [dialogOpen, setDialogOpen] =
        useState(false);

    const [editingRow, setEditingRow] =
        useState(null);

    const [form, setForm] =
        useState(EMPTY_FORM);

    const size = 25;

    const load = useCallback(async (
        targetPage = 0,
        targetSearch = "",
        targetPlant = ""
    ) => {
        setLoading(true);
        setError("");

        try {
            const response =
                await matflowApi.listProjects({
                    search:
                        clean(targetSearch) ||
                        undefined,
                });

            const result =
                extractMatFlowPage(
                    response?.data
                );

            const normalizedPlant =
                clean(
                    targetPlant
                ).toUpperCase();

            const filteredRows =
                normalizedPlant
                    ? result.rows.filter(
                        (project) =>
                            String(
                                project.plantCode ||
                                ""
                            )
                                .trim()
                                .toUpperCase() ===
                            normalizedPlant
                    )
                    : result.rows;

            const calculatedTotalPages =
                filteredRows.length === 0
                    ? 0
                    : Math.ceil(
                        filteredRows.length /
                        size
                    );

            const safePage =
                calculatedTotalPages === 0
                    ? 0
                    : Math.min(
                        Math.max(
                            targetPage,
                            0
                        ),
                        calculatedTotalPages - 1
                    );

            const startIndex =
                safePage * size;

            const visibleRows =
                filteredRows.slice(
                    startIndex,
                    startIndex + size
                );

            setRows(visibleRows);
            setPage(safePage);

            setTotalElements(
                filteredRows.length
            );

            setTotalPages(
                calculatedTotalPages
            );
        } catch (requestError) {
            setRows([]);
            setPage(0);
            setTotalElements(0);
            setTotalPages(0);

            setError(
                readMatFlowError(
                    requestError,
                    "Unable to load projects and drawings."
                )
            );
        } finally {
            setLoading(false);
        }
    }, [size]);

    useEffect(() => {
        load(
            0,
            "",
            ""
        );
    }, [load]);

    const openCreate = () => {
        setEditingRow(null);

        setForm({
            ...EMPTY_FORM,
            plantCode:
                availablePlants[0] || "",
        });

        setDialogOpen(true);
        setError("");
    };

    const openEdit = (row) => {
        setEditingRow(row);

        setForm({
            projectCode:
                row.projectCode || "",

            projectName:
                row.projectName || "",

            clientName:
                row.clientName || "",

            drawingNo:
                row.drawingNo || "",

            drawingRevision:
                row.drawingRevision || "0",

            productName:
                row.productName || "",

            plantCode:
                row.plantCode || "",

            requiredDate:
                row.requiredDate || "",

            remarks:
                row.remarks || "",

            active:
                row.active !== false,
        });

        setDialogOpen(true);
        setError("");
    };
    const closeDialog = () => {
        if (saving) {
            return;
        }

        setDialogOpen(false);
        setEditingRow(null);
        setForm(EMPTY_FORM);
    };

    const updateForm = (
        key,
        value
    ) => {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));
    };

    const validate = () => {
        if (!clean(form.projectCode)) {
            return "Project or PD code is required.";
        }

        if (!clean(form.projectName)) {
            return "Project name is required.";
        }

        if (!clean(form.drawingNo)) {
            return "Drawing number is required.";
        }

        if (!clean(form.productName)) {
            return "Product name is required.";
        }

        if (!clean(form.plantCode)) {
            return "Plant is required.";
        }

        return "";
    };

    const save = async () => {
        const validationError =
            validate();

        if (validationError) {
            setError(validationError);
            return;
        }

        const body = {
            projectCode:
                clean(
                    form.projectCode
                ).toUpperCase(),

            projectName:
                clean(
                    form.projectName
                ),

            clientName:
                clean(
                    form.clientName
                ) || null,

            drawingNo:
                clean(
                    form.drawingNo
                ).toUpperCase(),

            drawingRevision:
                clean(
                    form.drawingRevision
                ).toUpperCase() || "0",

            productName:
                clean(
                    form.productName
                ),

            plantCode:
                clean(
                    form.plantCode
                ).toUpperCase(),

            requiredDate:
                form.requiredDate || null,

            remarks:
                clean(
                    form.remarks
                ) || null,

            active:
                form.active !== false,

            rowVersion:
                editingRow?.rowVersion ??
                null,
        };

        setSaving(true);
        setError("");

        try {
            let response;

            if (editingRow?.id) {
                response =
                    await matflowApi
                        .updateProject(
                            editingRow.id,
                            body
                        );
            } else {
                response =
                    await matflowApi
                        .createProject(body);
            }

            const savedProject =
                response?.data;

            if (!savedProject?.id) {
                throw new Error(
                    "Project ID was not returned."
                );
            }

            setDialogOpen(false);
            setEditingRow(null);
            setForm(EMPTY_FORM);

            await load(
                0,
                search,
                plantFilter
            );
        } catch (requestError) {
            setError(
                readMatFlowError(
                    requestError,
                    "Unable to save the project drawing."
                )
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={pageSx}>
            <Box sx={heroSx}>
                <Box sx={headerRowSx}>
                    <Box>
                        <Chip
                            label="PROJECT AND DRAWING MASTER"
                            sx={heroBadgeSx}
                        />

                        <Typography sx={heroTitleSx}>
                            Projects and Drawings
                        </Typography>

                        <Typography sx={heroSubSx}>
                            Create the PD, project and drawing
                            context used by operational BOMs,
                            requisitions, purchasing and material
                            tracking.
                        </Typography>
                    </Box>

                    {canManage && (
                        <Button
                            startIcon={<AddIcon />}
                            onClick={openCreate}
                            sx={primaryBtnSx}
                        >
                            Add Project Drawing
                        </Button>
                    )}
                </Box>
            </Box>

            <Card sx={panelSx}>
                <Box sx={filterGridSx}>
                    <TextField
                        label="Search"
                        placeholder="PD, drawing, client or product..."
                        value={search}
                        onChange={(event) =>
                            setSearch(
                                event.target.value
                            )
                        }
                        sx={fieldSx}
                    />

                    <TextField
                        select
                        label="Plant"
                        value={plantFilter}
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
                            startIcon={<SearchIcon />}
                            onClick={() =>
                                load(
                                    0,
                                    search,
                                    plantFilter
                                )
                            }
                            sx={primaryBtnSx}
                        >
                            Search
                        </Button>

                        <Button
                            startIcon={<RefreshIcon />}
                            onClick={() =>
                                load(
                                    page,
                                    search,
                                    plantFilter
                                )
                            }
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
                            Project Drawing Register
                        </Typography>

                        <Typography sx={sectionSubSx}>
                            {totalElements} records
                        </Typography>
                    </Box>
                </Box>

                {loading ? (
                    <Box sx={loadingSx}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Box sx={tableShellSx}>
                        <Box sx={projectHeaderSx}>
                            <Box sx={tableCellSx}>
                                PD / Project
                            </Box>

                            <Box sx={tableCellSx}>
                                Drawing
                            </Box>

                            <Box sx={tableCellSx}>
                                Product
                            </Box>

                            <Box sx={tableCellSx}>
                                Client
                            </Box>

                            <Box sx={tableCellSx}>
                                Owning Plant
                            </Box>

                            <Box sx={tableCellSx}>
                                Version
                            </Box>

                            <Box sx={tableCellSx}>
                                Action
                            </Box>
                        </Box>

                        {rows.length === 0 ? (
                            <Box sx={emptySx}>
                                No project drawing records were found.
                            </Box>
                        ) : (
                            rows.map((row) => (
                                <Box
                                    key={row.id}
                                    sx={projectRowSx}
                                >
                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>
                                            {row.projectCode ||
                                                "-"}
                                        </Typography>

                                        <Typography sx={subTextSx}>
                                            {row.projectName ||
                                                "-"}
                                        </Typography>
                                    </Box>

                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>
                                            {row.drawingNo ||
                                                "-"}
                                        </Typography>

                                        <Typography sx={subTextSx}>
                                            Revision{" "}
                                            {row.drawingRevision ||
                                                "-"}
                                        </Typography>
                                    </Box>

                                    <Box sx={tableCellSx}>
                                        {row.productName ||
                                            "-"}
                                    </Box>

                                    <Box sx={tableCellSx}>
                                        {row.clientName ||
                                            "-"}
                                    </Box>

                                    <Box sx={tableCellSx}>
                                        {row.owningPlantCode ||
                                            row.plantCode ||
                                            "-"}
                                    </Box>

                                    <Box sx={tableCellSx}>
                                        {row.rowVersion ??
                                            "-"}
                                    </Box>

                                    <Box sx={actionCellSx}>
                                        <Button
                                            startIcon={
                                                <VisibilityOutlinedIcon />
                                            }
                                            onClick={() =>
                                                navigate(
                                                    `/matflow/projects/${row.id}`
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
                                                    openEdit(row)
                                                }
                                                sx={secondaryBtnSx}
                                            >
                                                Edit
                                            </Button>
                                        )}
                                    </Box>
                                </Box>
                            ))
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
                                    page - 1,
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
                        {Math.max(totalPages, 1)}
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
                            {editingRow
                                ? "Edit Project Drawing"
                                : "Create Project Drawing"}
                        </Typography>

                        <Typography sx={dialogSubSx}>
                            One record represents one project and
                            drawing combination.
                        </Typography>
                    </Box>

                    <IconButton
                        onClick={closeDialog}
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
                                    form.active === true
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
                        label="Project drawing is active"
                        sx={switchLabelSx}
                    />
                    <Box sx={formGridSx}>
                        <TextField
                            label="PD / Project Code *"
                            value={form.projectCode}
                            disabled={saving}
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
                            value={form.projectName}
                            disabled={saving}
                            onChange={(event) =>
                                updateForm(
                                    "projectName",
                                    event.target.value
                                )
                            }
                            sx={fieldSx}
                        />

                        <TextField
                            label="Drawing Number *"
                            value={form.drawingNo}
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
                            label="Product Name *"
                            value={form.productName}
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
                            label="Client Name"
                            value={form.clientName}
                            disabled={saving}
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
                            value={form.plantCode}
                            disabled={saving}
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
                            label="Remarks"
                            multiline
                            minRows={3}
                            value={form.remarks}
                            disabled={saving}
                            onChange={(event) =>
                                updateForm(
                                    "remarks",
                                    event.target.value
                                )
                            }
                            sx={fieldSx}
                        />

                        <TextField
                            type="date"
                            label="Required Date"
                            value={form.requiredDate}
                            disabled={saving}
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
                    </Box>
                </DialogContent>

                <DialogActions sx={dialogActionsSx}>
                    <Button
                        onClick={closeDialog}
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
                            : "Save Project"}
                    </Button>
                </DialogActions>
            </Dialog>
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
        gridTemplateColumns: "1fr",
    },
};

const toolbarActionsSx = {
    display: "flex",
    gap: "7px",
};

const resultHeaderSx = {
    mb: "12px",
};

const projectColumns =
    "170px 150px minmax(220px,1.3fr) 180px 125px 70px 200px";

const projectHeaderSx = {
    ...tableHeaderSx,
    gridTemplateColumns:
        projectColumns,
};

const projectRowSx = {
    ...tableRowSx,
    gridTemplateColumns:
        projectColumns,
};

const actionCellSx = {
    ...tableCellSx,
    display: "flex",
    gap: "6px",
};

const paginationSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "9px",
    mt: "12px",
};


const formGridSx = {
    display: "grid",
    gridTemplateColumns:
        "repeat(2,minmax(0,1fr))",
    gap: "12px",

    "@media (max-width: 700px)": {
        gridTemplateColumns: "1fr",
    },
};
