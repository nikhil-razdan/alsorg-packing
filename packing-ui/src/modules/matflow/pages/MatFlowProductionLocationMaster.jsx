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

import {
    useAuth,
} from "../../../auth/AuthContext";

import {
    getMatFlowRole,
    MATFLOW_ROLES,
} from "../../../utils/matflowAccess";

import {
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
    dialogActionsSx,
    dialogContentSx,
    dialogPaperSx,
    dialogTitleSx,
    emptySx,
    mainTextSx,
    sectionTitleSx,
    subTextSx,
    switchLabelSx,
    tableShellSx,
} from "../matflowTheme";

const EMPTY_FORM = {
    locationCode: "",
    locationName: "",
    plantCode: "",
    address: "",
    contactPerson: "",
    contactPhone: "",
    supportsStock: true,
    active: true,
};

const clean = (value) =>
    String(value ?? "").trim();

export default function MatFlowProductionLocationMaster() {
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
        MATFLOW_ROLES.STORE,
    ].includes(cleanRole);

    const availablePlants =
        useMemo(() => {
            const values = [
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
                    clean(value)
                        .toUpperCase()
                )
                .filter(Boolean);

            return Array.from(
                new Set(values)
            ).sort();
        }, [
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

    const [dialogOpen, setDialogOpen] =
        useState(false);

    const [editingRow, setEditingRow] =
        useState(null);

    const [form, setForm] =
        useState({
            ...EMPTY_FORM,
        });

    const load = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const response =
                await matflowApi
                    .listLocations();

            const data =
                Array.isArray(
                    response?.data
                )
                    ? response.data
                    : [];

            setRows(
                data.filter(
                    (location) =>
                        String(
                            location.locationType ||
                            ""
                        ).toUpperCase() ===
                        "PRODUCTION"
                )
            );
        } catch (requestError) {
            setRows([]);

            setError(
                readMatFlowError(
                    requestError,
                    "Unable to load Production locations."
                )
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const updateForm = (
        key,
        value
    ) => {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));
    };

    const openCreate = () => {
        setEditingRow(null);

        setForm({
            ...EMPTY_FORM,
            plantCode:
                availablePlants[0] ||
                "",
        });

        setError("");
        setDialogOpen(true);
    };

    const openEdit = (row) => {
        setEditingRow(row);

        setForm({
            locationCode:
                row.locationCode || "",

            locationName:
                row.locationName || "",

            plantCode:
                row.plantCode || "",

            address:
                row.address || "",

            contactPerson:
                row.contactPerson || "",

            contactPhone:
                row.contactPhone || "",

            supportsStock:
                row.supportsStock !== false,

            active:
                row.active !== false,
        });

        setError("");
        setDialogOpen(true);
    };

    const closeDialog = () => {
        if (saving) {
            return;
        }

        setDialogOpen(false);
        setEditingRow(null);

        setForm({
            ...EMPTY_FORM,
        });
    };

    const save = async () => {
        if (!clean(form.locationCode)) {
            setError(
                "Location code is required."
            );
            return;
        }

        if (!clean(form.locationName)) {
            setError(
                "Location name is required."
            );
            return;
        }

        if (!clean(form.plantCode)) {
            setError(
                "Plant code is required."
            );
            return;
        }

        const body = {
            locationCode:
                clean(
                    form.locationCode
                ).toUpperCase(),

            locationName:
                clean(
                    form.locationName
                ),

            plantCode:
                clean(
                    form.plantCode
                ).toUpperCase(),

            locationType:
                "PRODUCTION",

            ownershipType:
                "INTERNAL",

            supportsStock:
                form.supportsStock ===
                true,

            address:
                clean(
                    form.address
                ) || null,

            contactPerson:
                clean(
                    form.contactPerson
                ) || null,

            contactPhone:
                clean(
                    form.contactPhone
                ) || null,

            active:
                form.active === true,

            rowVersion:
                editingRow?.rowVersion ??
                null,
        };

        setSaving(true);
        setError("");

        try {
            if (editingRow?.id) {
                await matflowApi
                    .updateLocation(
                        editingRow.id,
                        body
                    );
            } else {
                await matflowApi
                    .createLocation(
                        body
                    );
            }

            setDialogOpen(false);
            setEditingRow(null);

            setForm({
                ...EMPTY_FORM,
            });

            await load();
        } catch (requestError) {
            setError(
                readMatFlowError(
                    requestError,
                    "Unable to save the Production location."
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
                            label="MATFLOW LOCATION CONTROL"
                            sx={heroBadgeSx}
                        />

                        <Typography sx={heroTitleSx}>
                            Production Locations
                        </Typography>

                        <Typography sx={heroSubSx}>
                            Configure the Production destinations
                            used while raising material
                            requisitions.
                        </Typography>
                    </Box>

                    {canManage && (
                        <Button
                            startIcon={<AddIcon />}
                            onClick={openCreate}
                            sx={primaryBtnSx}
                        >
                            Add Production Location
                        </Button>
                    )}
                </Box>
            </Box>

            {error && (
                <Box sx={errorBoxSx}>
                    {error}
                </Box>
            )}

            <Card sx={panelSx}>
                <Box sx={resultHeaderSx}>
                    <Typography sx={sectionTitleSx}>
                        Production Location Register
                    </Typography>

                    <Button
                        startIcon={<RefreshIcon />}
                        onClick={load}
                        disabled={loading}
                        sx={secondaryBtnSx}
                    >
                        Refresh
                    </Button>
                </Box>

                {loading ? (
                    <Box sx={loadingSx}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Box sx={tableShellSx}>
                        <Box sx={locationHeaderSx}>
                            <Box sx={tableCellSx}>
                                Location
                            </Box>

                            <Box sx={tableCellSx}>
                                Plant
                            </Box>

                            <Box sx={tableCellSx}>
                                Type
                            </Box>

                            <Box sx={tableCellSx}>
                                Supports Stock
                            </Box>

                            <Box sx={tableCellSx}>
                                Contact
                            </Box>

                            <Box sx={tableCellSx}>
                                Status
                            </Box>

                            <Box sx={tableCellSx}>
                                Action
                            </Box>
                        </Box>

                        {rows.length === 0 ? (
                            <Box sx={emptySx}>
                                No Production locations are configured.
                            </Box>
                        ) : (
                            rows.map((row) => (
                                <Box
                                    key={row.id}
                                    sx={locationRowSx}
                                >
                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>
                                            {row.locationCode ||
                                                "-"}
                                        </Typography>

                                        <Typography sx={subTextSx}>
                                            {row.locationName ||
                                                "-"}
                                        </Typography>
                                    </Box>

                                    <Box sx={tableCellSx}>
                                        {row.plantCode ||
                                            "-"}
                                    </Box>

                                    <Box sx={tableCellSx}>
                                        {row.locationType ||
                                            "-"}
                                    </Box>

                                    <Box sx={tableCellSx}>
                                        {row.supportsStock
                                            ? "Yes"
                                            : "No"}
                                    </Box>

                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>
                                            {row.contactPerson ||
                                                "-"}
                                        </Typography>

                                        <Typography sx={subTextSx}>
                                            {row.contactPhone ||
                                                "-"}
                                        </Typography>
                                    </Box>

                                    <Box sx={tableCellSx}>
                                        <MatFlowStatusChip
                                            status={
                                                row.active
                                                    ? "ACTIVE"
                                                    : "INACTIVE"
                                            }
                                        />
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
                        <Typography sx={sectionTitleSx}>
                            {editingRow
                                ? "Edit Production Location"
                                : "Create Production Location"}
                        </Typography>
                    </Box>

                    <IconButton
                        onClick={closeDialog}
                        disabled={saving}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent sx={dialogContentSx}>
                    <Box sx={formGridSx}>
                        <TextField
                            label="Location Code *"
                            value={form.locationCode}
                            disabled={
                                saving ||
                                Boolean(editingRow)
                            }
                            onChange={(event) =>
                                updateForm(
                                    "locationCode",
                                    event.target.value
                                )
                            }
                            sx={fieldSx}
                        />

                        <TextField
                            label="Location Name *"
                            value={form.locationName}
                            disabled={saving}
                            onChange={(event) =>
                                updateForm(
                                    "locationName",
                                    event.target.value
                                )
                            }
                            sx={fieldSx}
                        />

                        <TextField
                            select
                            label="Plant Code *"
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
                            label="Location Type"
                            value="PRODUCTION"
                            disabled
                            sx={fieldSx}
                        />

                        <TextField
                            label="Contact Person"
                            value={form.contactPerson}
                            disabled={saving}
                            onChange={(event) =>
                                updateForm(
                                    "contactPerson",
                                    event.target.value
                                )
                            }
                            sx={fieldSx}
                        />

                        <TextField
                            label="Contact Phone"
                            value={form.contactPhone}
                            disabled={saving}
                            onChange={(event) =>
                                updateForm(
                                    "contactPhone",
                                    event.target.value
                                )
                            }
                            sx={fieldSx}
                        />

                        <TextField
                            label="Address"
                            multiline
                            minRows={3}
                            value={form.address}
                            disabled={saving}
                            onChange={(event) =>
                                updateForm(
                                    "address",
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
                                        form.supportsStock
                                    }
                                    disabled={saving}
                                    onChange={(event) =>
                                        updateForm(
                                            "supportsStock",
                                            event.target.checked
                                        )
                                    }
                                />
                            }
                            label="Supports stock"
                        />

                        <FormControlLabel
                            control={
                                <Switch
                                    checked={form.active}
                                    disabled={saving}
                                    onChange={(event) =>
                                        updateForm(
                                            "active",
                                            event.target.checked
                                        )
                                    }
                                />
                            }
                            label="Location is active"
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
                            : "Save Location"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

const headerRowSx = {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    flexWrap: "wrap",
};

const resultHeaderSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    mb: "12px",
};

const sectionTitleSx = {
    color: "#fff",
    fontSize: "17px",
    fontWeight: 950,
};

const locationColumns =
    "210px 110px 120px 110px minmax(170px,1fr) 110px 100px";

const locationHeaderSx = {
    ...tableHeaderSx,
    gridTemplateColumns:
        locationColumns,
};

const locationRowSx = {
    ...tableRowSx,
    gridTemplateColumns:
        locationColumns,
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

const emptySx = {
    minHeight: "170px",
    display: "grid",
    placeItems: "center",
    color:
        "rgba(255,255,255,.50)",
};

const formGridSx = {
    pt: "12px",
    display: "grid",
    gridTemplateColumns:
        "repeat(2,minmax(0,1fr))",
    gap: "12px",

    "@media (max-width: 650px)": {
        gridTemplateColumns:
            "1fr",
    },
};