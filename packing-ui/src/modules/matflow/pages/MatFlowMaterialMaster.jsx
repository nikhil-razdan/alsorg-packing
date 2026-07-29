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
} from "../matflowTheme";

const EMPTY_FORM = {
    materialCode: "",
    materialName: "",
    uom: "",
    description: "",
    active: true,
};

const clean = (value) => {
    const result =
        String(value ?? "").trim();

    return result || "";
};

export default function MatFlowMaterialMaster() {
    const { role } = useAuth();

    const cleanRole =
        getMatFlowRole(role);

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
        targetPage = page,
        targetSearch = search
    ) => {
        setLoading(true);
        setError("");

        try {
            const data =
                await matflowApi.listMaterials({
                    page: targetPage,
                    size,
                    search:
                        clean(targetSearch) ||
                        undefined,
                });

            const result =
                extractMatFlowPage(data);

            setRows(result.rows);
            setTotalPages(
                result.totalPages
            );
            setTotalElements(
                result.totalElements
            );
        } catch (requestError) {
            setRows([]);

            setError(
                readMatFlowError(
                    requestError,
                    "Unable to load the material master."
                )
            );
        } finally {
            setLoading(false);
        }
    }, [
        page,
        search,
    ]);

    useEffect(() => {
        load(page, search);
    }, [
        load,
        page,
    ]);

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
            uom:
                row.uom || "",
            description:
                row.description ||
                row.specification ||
                "",
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

        if (!clean(form.uom)) {
            return "Material unit is required.";
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

        setSaving(true);
        setError("");

        const body = {
            materialCode:
                clean(
                    form.materialCode
                ).toUpperCase(),

            materialName:
                clean(
                    form.materialName
                ),

            uom:
                clean(
                    form.uom
                ).toUpperCase(),

            description:
                clean(
                    form.description
                ) || null,

            active:
                form.active === true,

            rowVersion:
                editingRow?.rowVersion ??
                null,
        };

        try {
            if (editingRow?.id) {
                await matflowApi
                    .updateMaterial(
                        editingRow.id,
                        body
                    );
            } else {
                await matflowApi
                    .createMaterial(body);
            }

            closeDialog();

            setPage(0);
            await load(0, search);
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
                            onClick={() => {
                                setPage(0);
                                load(0, search);
                            }}
                            sx={primaryBtnSx}
                        >
                            Search
                        </Button>

                        <Button
                            startIcon={<RefreshIcon />}
                            onClick={() =>
                                load(page, search)
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
                                Unit
                            </Box>

                            <Box sx={tableCellSx}>
                                Description
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
                            rows.map((row) => (
                                <Box
                                    key={row.id}
                                    sx={materialRowSx}
                                >
                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>
                                            {row.materialCode ||
                                                "-"}
                                        </Typography>
                                    </Box>

                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>
                                            {row.materialName ||
                                                "-"}
                                        </Typography>
                                    </Box>

                                    <Box sx={tableCellSx}>
                                        {row.uom || "-"}
                                    </Box>

                                    <Box sx={tableCellSx}>
                                        {row.description ||
                                            row.specification ||
                                            "-"}
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
                                        {row.rowVersion ??
                                            "-"}
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
                            setPage(
                                (current) =>
                                    Math.max(
                                        current - 1,
                                        0
                                    )
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
                            setPage(
                                (current) =>
                                    current + 1
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
                            label="Description"
                            multiline
                            minRows={3}
                            value={form.description}
                            disabled={saving}
                            onChange={(event) =>
                                updateForm(
                                    "description",
                                    event.target.value
                                )
                            }
                            sx={{
                                ...fieldSx,
                                gridColumn:
                                    "1 / -1",
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

const sectionTitleSx = {
    color: "#fff",
    fontSize: "17px",
    fontWeight: 950,
};

const sectionSubSx = {
    mt: "3px",
    color: "rgba(255,255,255,.52)",
    fontSize: "11px",
    fontWeight: 700,
};

const materialColumns =
    "145px minmax(220px,1.3fr) 90px minmax(260px,1.6fr) 110px 80px 100px";

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

const mainTextSx = {
    color: "#fff",
    fontSize: "12px",
    fontWeight: 850,
};

const emptySx = {
    minHeight: "170px",
    display: "grid",
    placeItems: "center",
    color: "rgba(255,255,255,.50)",
    fontSize: "12px",
    fontWeight: 750,
};

const paginationSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "9px",
    mt: "12px",
};

const pageTextSx = {
    color: "rgba(255,255,255,.62)",
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
    alignItems: "flex-start",
    justifyContent: "space-between",
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
    color: "rgba(255,255,255,.52)",
    fontSize: "11px",
    fontWeight: 650,
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

    "@media (max-width: 620px)": {
        gridTemplateColumns: "1fr",
    },
};

const switchLabelSx = {
    color: "rgba(255,255,255,.72)",
    fontSize: "12px",
};

const dialogActionsSx = {
    p: "14px 24px 20px",
    borderTop:
        "1px solid rgba(255,255,255,.07)",
};