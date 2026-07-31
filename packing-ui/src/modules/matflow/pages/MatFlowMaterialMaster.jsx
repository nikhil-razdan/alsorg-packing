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
    Switch,
    TextField,
    Typography,
    MenuItem
} from "@mui/material";


import {
    getMatFlowCategoryMeta,
    MATFLOW_MATERIAL_CATEGORIES,
    normalizeMatFlowCategory,
} from "../utils/matflowMaterialCategories";

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

import MatFlowStatusChip
    from "../components/MatFlowStatusChip";

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
} from "../matflowTheme";

const EMPTY_FORM = {
    materialCode: "",
    materialName: "",
    category: "",
    specification: "",
    uom: "",
    preferredSupplier: "",
    minimumStock: "0",
    reorderLevel: "0",
    active: true,
};

const clean = (value) => {
    const result =
        String(value ?? "").trim();

    return result || "";
};

export default function MatFlowMaterialMaster() {
    const {
        role,
        user,
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
        targetSearch = ""
    ) => {
        setLoading(true);
        setError("");

        try {
            const response =
                await matflowApi.listMaterials({
                    search:
                        clean(targetSearch) ||
                        undefined,
                });

            const result =
                extractMatFlowPage(
                    response?.data
                );

            const calculatedTotalPages =
                result.rows.length === 0
                    ? 0
                    : Math.ceil(
                        result.rows.length /
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

            setRows(
                result.rows.slice(
                    startIndex,
                    startIndex + size
                )
            );

            setPage(safePage);

            setTotalElements(
                result.rows.length
            );

            setTotalPages(
                calculatedTotalPages
            );
        } catch (requestError) {
            setRows([]);
            setPage(0);
            setTotalPages(0);
            setTotalElements(0);

            setError(
                readMatFlowError(
                    requestError,
                    "Unable to load the material master."
                )
            );
        } finally {
            setLoading(false);
        }
    }, [size]);

    useEffect(() => {
        load(
            0,
            ""
        );
    }, [load]);

    const openCreate = () => {
        setEditingRow(null);
        setForm(EMPTY_FORM);
        setDialogOpen(true);
        setError("");
    };

    const openEdit = (row) => {
        setEditingRow(row);

        setForm({
            materialCode:
                row.materialCode || "",

            materialName:
                row.materialName || "",

            category:
                row.category || "",

            specification:
                row.specification || "",

            uom:
                row.uom || "",

            preferredSupplier:
                row.preferredSupplier || "",

            minimumStock:
                String(
                    row.minimumStock ?? 0
                ),

            reorderLevel:
                String(
                    row.reorderLevel ?? 0
                ),

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
        if (!clean(form.materialCode)) {
            return "Material code is required.";
        }

        if (!clean(form.materialName)) {
            return "Material name is required.";
        }

        if (!clean(form.category)) {
            return "Material category is required.";
        }

        if (!clean(form.uom)) {
            return "Material unit is required.";
        }

        const minimumStock =
            Number(
                form.minimumStock || 0
            );

        const reorderLevel =
            Number(
                form.reorderLevel || 0
            );

        if (
            !Number.isFinite(
                minimumStock
            ) ||
            minimumStock < 0
        ) {
            return "Minimum stock cannot be negative.";
        }

        if (
            !Number.isFinite(
                reorderLevel
            ) ||
            reorderLevel < 0
        ) {
            return "Reorder level cannot be negative.";
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
            materialCode:
                clean(
                    form.materialCode
                ).toUpperCase(),

            materialName:
                clean(
                    form.materialName
                ),

            category:
                normalizeMatFlowCategory(
                    form.category
                ),

            specification:
                clean(
                    form.specification
                ) || null,

            uom:
                clean(
                    form.uom
                ).toUpperCase(),

            preferredSupplier:
                clean(
                    form.preferredSupplier
                ) || null,

            minimumStock:
                Number(
                    form.minimumStock || 0
                ),

            reorderLevel:
                Number(
                    form.reorderLevel || 0
                ),

            active:
                form.active === true,

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
                        .updateMaterial(
                            editingRow.id,
                            body
                        );
            } else {
                response =
                    await matflowApi
                        .createMaterial(body);
            }

            const savedMaterial =
                response?.data;

            if (!savedMaterial?.id) {
                throw new Error(
                    "Material ID was not returned."
                );
            }

            setDialogOpen(false);
            setEditingRow(null);
            setForm(EMPTY_FORM);

            await load(
                0,
                search
            );
        } catch (requestError) {
            setError(
                readMatFlowError(
                    requestError,
                    "Unable to save the material."
                )
            );
        } finally {
            setSaving(false);
        }
    };

    const displayedCount =
        useMemo(
            () => rows.length,
            [rows]
        );

    return (
        <Box sx={pageSx}>
            <Box sx={heroSx}>
                <Box sx={headerRowSx}>
                    <Box>
                        <Chip
                            label="MATFLOW MATERIAL MASTER"
                            sx={heroBadgeSx}
                        />

                        <Typography sx={heroTitleSx}>
                            Material Master
                        </Typography>

                        <Typography sx={heroSubSx}>
                            Maintain standardized material codes,
                            names, units and operational
                            descriptions used throughout MatFlow.
                        </Typography>
                    </Box>

                    {canManage && (
                        <Button
                            startIcon={<AddIcon />}
                            onClick={openCreate}
                            sx={primaryBtnSx}
                        >
                            Add Material
                        </Button>
                    )}
                </Box>
            </Box>

            <Card sx={panelSx}>
                <Box sx={toolbarSx}>
                    <TextField
                        label="Search Materials"
                        placeholder="Code or material name..."
                        value={search}
                        onChange={(event) =>
                            setSearch(
                                event.target.value
                            )
                        }
                        onKeyDown={(event) => {
                            if (
                                event.key === "Enter"
                            ) {
                                setPage(0);
                                load(
                                    0,
                                    search
                                );
                            }
                        }}
                        sx={{
                            ...fieldSx,
                            minWidth: {
                                xs: "100%",
                                md: "360px",
                            },
                        }}
                    />

                    <Box sx={toolbarActionsSx}>
                        <Button
                            startIcon={<SearchIcon />}
                            onClick={() =>
                                load(
                                    0,
                                    search
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
                                    search
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
                            Material Register
                        </Typography>

                        <Typography sx={sectionSubSx}>
                            {totalElements} total materials ·{" "}
                            {displayedCount} shown
                        </Typography>
                    </Box>
                </Box>

                {loading ? (
                    <Box sx={loadingSx}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Box sx={tableShellSx}>
                        <Box sx={materialHeaderSx}>
                            <Box sx={tableCellSx}>
                                Material Code
                            </Box>

                            <Box sx={tableCellSx}>
                                Material Name
                            </Box>

                            <Box sx={tableCellSx}>
                                Category
                            </Box>

                            <Box sx={tableCellSx}>
                                Unit
                            </Box>

                            <Box sx={tableCellSx}>
                                Specification
                            </Box>

                            <Box sx={tableCellSx}>
                                Status
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
                                No material records were found.
                            </Box>
                        ) : (
                            rows.map((row) => {
                                const categoryMeta =
                                    getMatFlowCategoryMeta(
                                        row.category
                                    );

                                return (
                                    <Box
                                        key={row.id}
                                        sx={materialRowSx}
                                    >
                                        <Box sx={tableCellSx}>
                                            <Typography sx={mainTextSx}>
                                                {row.materialCode || "-"}
                                            </Typography>
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Typography sx={mainTextSx}>
                                                {row.materialName || "-"}
                                            </Typography>

                                            {row.preferredSupplier && (
                                                <Typography sx={subTextSx}>
                                                    Preferred:{" "}
                                                    {row.preferredSupplier}
                                                </Typography>
                                            )}
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Chip
                                                label={categoryMeta.label}
                                                size="small"
                                                sx={{
                                                    height: "22px",
                                                    maxWidth: "125px",
                                                    color:
                                                        categoryMeta.color,
                                                    background:
                                                        `${categoryMeta.color}16`,
                                                    border:
                                                        `1px solid ${categoryMeta.color}30`,
                                                    fontSize: "9px",
                                                    fontWeight: 900,

                                                    "& .MuiChip-label": {
                                                        overflow: "hidden",
                                                        textOverflow:
                                                            "ellipsis",
                                                        whiteSpace:
                                                            "nowrap",
                                                    },
                                                }}
                                            />
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            {row.uom || "-"}
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Typography sx={specificationTextSx}>
                                                {row.specification || "-"}
                                            </Typography>

                                            {(
                                                row.minimumStock !== null &&
                                                row.minimumStock !== undefined
                                            ) && (
                                                    <Typography sx={subTextSx}>
                                                        Min stock:{" "}
                                                        {row.minimumStock}
                                                        {" · "}
                                                        Reorder:{" "}
                                                        {row.reorderLevel ?? 0}
                                                    </Typography>
                                                )}
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <MatFlowStatusChip
                                                status={
                                                    row.active === false
                                                        ? "INACTIVE"
                                                        : "ACTIVE"
                                                }
                                            />
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            {row.rowVersion ?? "-"}
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            {canManage ? (
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
                                            ) : (
                                                "-"
                                            )}
                                        </Box>
                                    </Box>
                                );
                            })
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
                                search
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
                                search
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
                maxWidth="sm"
                PaperProps={{
                    sx: dialogPaperSx,
                }}
            >
                <DialogTitle sx={dialogTitleSx}>
                    <Box>
                        <Typography sx={dialogHeadingSx}>
                            {editingRow
                                ? "Edit Material"
                                : "Create Material"}
                        </Typography>

                        <Typography sx={dialogSubSx}>
                            Use a unique material code and a
                            standard operational unit.
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
                    <Box sx={formGridSx}>
                        <TextField
                            label="Material Code *"
                            value={form.materialCode}
                            disabled={
                                saving ||
                                Boolean(editingRow)
                            }
                            onChange={(event) =>
                                updateForm(
                                    "materialCode",
                                    event.target.value
                                )
                            }
                            sx={fieldSx}
                        />

                        <TextField
                            label="Unit *"
                            placeholder="PCS, KG, MTR..."
                            value={form.uom}
                            disabled={saving}
                            onChange={(event) =>
                                updateForm(
                                    "uom",
                                    event.target.value
                                )
                            }
                            sx={fieldSx}
                        />

                        <TextField
                            label="Material Name *"
                            value={form.materialName}
                            disabled={saving}
                            onChange={(event) =>
                                updateForm(
                                    "materialName",
                                    event.target.value
                                )
                            }
                            sx={{
                                ...fieldSx,
                                gridColumn:
                                    "1 / -1",
                            }}
                        />


                        <TextField
                            select
                            label="Category *"
                            value={form.category}
                            disabled={saving}
                            onChange={(event) =>
                                updateForm(
                                    "category",
                                    event.target.value
                                )
                            }
                            sx={fieldSx}
                        >
                            {MATFLOW_MATERIAL_CATEGORIES.map(
                                (category) => (
                                    <MenuItem
                                        key={category.value}
                                        value={category.value}
                                    >
                                        {category.label}
                                    </MenuItem>
                                )
                            )}
                        </TextField>

                        <TextField
                            label="Preferred Supplier"
                            value={
                                form.preferredSupplier
                            }
                            disabled={saving}
                            onChange={(event) =>
                                updateForm(
                                    "preferredSupplier",
                                    event.target.value
                                )
                            }
                            sx={fieldSx}
                        />

                        <TextField
                            label="Minimum Stock"
                            type="number"
                            value={form.minimumStock}
                            disabled={saving}
                            onChange={(event) =>
                                updateForm(
                                    "minimumStock",
                                    event.target.value
                                )
                            }
                            inputProps={{
                                min: 0,
                                step: 0.001,
                            }}
                            sx={fieldSx}
                        />

                        <TextField
                            label="Reorder Level"
                            type="number"
                            value={form.reorderLevel}
                            disabled={saving}
                            onChange={(event) =>
                                updateForm(
                                    "reorderLevel",
                                    event.target.value
                                )
                            }
                            inputProps={{
                                min: 0,
                                step: 0.001,
                            }}
                            sx={fieldSx}
                        />

                        <TextField
                            label="Specification"
                            multiline
                            minRows={3}
                            value={form.specification}
                            disabled={saving}
                            onChange={(event) =>
                                updateForm(
                                    "specification",
                                    event.target.value
                                )
                            }
                            sx={{
                                ...fieldSx,
                                gridColumn: "1 / -1",
                            }}
                        />

                        <FormControlLabel
                            control={
                                <Switch
                                    checked={
                                        form.active
                                    }
                                    onChange={(event) =>
                                        updateForm(
                                            "active",
                                            event.target
                                                .checked
                                        )
                                    }
                                />
                            }
                            label="Material is active"
                            sx={switchLabelSx}
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
                            : "Save Material"}
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

const toolbarSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    flexWrap: "wrap",
};

const toolbarActionsSx = {
    display: "flex",
    gap: "7px",
};

const resultHeaderSx = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    mb: "12px",
};

const materialColumns =
    "145px minmax(210px,1.25fr) 135px 80px minmax(250px,1.5fr) 105px 75px 100px";

const materialHeaderSx = {
    ...tableHeaderSx,
    gridTemplateColumns:
        materialColumns,
    minWidth: "1120px",
};

const materialRowSx = {
    ...tableRowSx,
    gridTemplateColumns:
        materialColumns,
    minWidth: "1120px",
};

const specificationTextSx = {
    color:
        "var(--mf-text-secondary)",
    fontSize: "11px",
    fontWeight: 700,
    lineHeight: 1.4,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
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

    "@media (max-width: 620px)": {
        gridTemplateColumns: "1fr",
    },
};
