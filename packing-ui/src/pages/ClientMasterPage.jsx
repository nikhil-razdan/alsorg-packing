import {
    useCallback,
    useEffect,
    useState,
} from "react";

import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Drawer,
    InputAdornment,
    MenuItem,
    Snackbar,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";

import { useNavigate } from "react-router-dom";

import AppsIcon from "@mui/icons-material/Apps";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LogoutIcon from "@mui/icons-material/Logout";
import SearchIcon from "@mui/icons-material/Search";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import InventoryIcon from "@mui/icons-material/Inventory";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import UnarchiveOutlinedIcon from "@mui/icons-material/UnarchiveOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import SourceOutlinedIcon from "@mui/icons-material/SourceOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";

import { useAuth } from "../auth/AuthContext";
import API from "../services/api";

/* =========================================================
 * CLIENT MASTER CONFIGURATION
 * ========================================================= */

const MODULE_KEYS = Object.freeze({
    PACKFLOW: "PACKFLOW",
    BOMFLOW: "BOMFLOW",
    MATFLOW: "MATFLOW",
});

const PAGE_SIZE_OPTIONS = [
    10,
    25,
    50,
    100,
];

const EMPTY_FORM = {
    name: "",
    address: "",
    active: true,
};

const normalizeArray = (value) => {
    if (Array.isArray(value)) {
        return Array.from(
            new Set(
                value
                    .map((item) =>
                        String(item || "")
                            .trim()
                            .toUpperCase()
                    )
                    .filter(Boolean)
            )
        );
    }

    if (!value) {
        return [];
    }

    return Array.from(
        new Set(
            String(value)
                .split(",")
                .map((item) =>
                    item
                        .trim()
                        .toUpperCase()
                )
                .filter(Boolean)
        )
    );
};

const getApiMessage = (
    error,
    fallback = "The operation could not be completed."
) => {
    const payload =
        error?.response?.data;

    if (
        typeof payload === "string" &&
        payload.trim()
    ) {
        return payload;
    }

    return (
        payload?.message ||
        payload?.error ||
        error?.message ||
        fallback
    );
};

const formatDateTime = (value) => {
    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return String(value);
    }

    return new Intl.DateTimeFormat(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: "Asia/Kolkata",
        }
    ).format(date);
};

const shortId = (value) => {
    const text =
        String(value || "").trim();

    if (!text) {
        return "—";
    }

    return text.length > 12
        ? `${text.slice(0, 8)}…`
        : text;
};

const sourceLabel = (source) => {
    const clean =
        String(source || "")
            .trim();

    if (!clean) {
        return "MANUAL";
    }

    if (
        clean
            .toUpperCase()
            .startsWith("XLSX_SEED")
    ) {
        return "XLSX Seed";
    }

    return clean
        .replaceAll("_", " ");
};

/* =========================================================
 * PAGE
 * ========================================================= */

export default function ClientMasterPage() {
    const navigate = useNavigate();

    const {
        hasRole,
        modules: currentModules = [],
        logout: authLogout,
    } = useAuth();

    const safeCurrentModules =
        normalizeArray(
            currentModules
        );

    const isCurrentAdmin =
        hasRole("ADMIN");

    const canOpenPackFlow =
        isCurrentAdmin ||
        safeCurrentModules.includes(
            MODULE_KEYS.PACKFLOW
        );

    const canOpenBOMFlow =
        isCurrentAdmin ||
        safeCurrentModules.includes(
            MODULE_KEYS.BOMFLOW
        );

    const canOpenMatFlow =
        isCurrentAdmin ||
        safeCurrentModules.includes(
            MODULE_KEYS.MATFLOW
        );

    const [rows, setRows] =
        useState([]);

    const [stats, setStats] =
        useState({
            total: 0,
            active: 0,
            inactive: 0,
        });

    const [loading, setLoading] =
        useState(true);

    const [saving, setSaving] =
        useState(false);

    const [search, setSearch] =
        useState("");

    const [
        debouncedSearch,
        setDebouncedSearch,
    ] = useState("");

    const [status, setStatus] =
        useState("ALL");

    const [pageNo, setPageNo] =
        useState(1);

    const [pageSize, setPageSize] =
        useState(25);

    const [
        totalElements,
        setTotalElements,
    ] = useState(0);

    const [
        totalPages,
        setTotalPages,
    ] = useState(1);

    const [
        drawerOpen,
        setDrawerOpen,
    ] = useState(false);

    const [
        drawerMode,
        setDrawerMode,
    ] = useState("create");

    const [
        editingRow,
        setEditingRow,
    ] = useState(null);

    const [form, setForm] =
        useState(EMPTY_FORM);

    const [
        formError,
        setFormError,
    ] = useState("");

    const [
        confirmOpen,
        setConfirmOpen,
    ] = useState(false);

    const [
        statusTarget,
        setStatusTarget,
    ] = useState(null);

    const [
        statusSaving,
        setStatusSaving,
    ] = useState(false);

    const [
        snackbar,
        setSnackbar,
    ] = useState({
        open: false,
        severity: "success",
        message: "",
    });

    useEffect(() => {
        const timer =
            window.setTimeout(
                () => {
                    setDebouncedSearch(
                        search.trim()
                    );
                    setPageNo(1);
                },
                220
            );

        return () =>
            window.clearTimeout(
                timer
            );
    }, [search]);

    const showMessage = useCallback(
        (
            message,
            severity = "success"
        ) => {
            setSnackbar({
                open: true,
                severity,
                message,
            });
        },
        []
    );

    const loadStats = useCallback(
        async () => {
            try {
                const response =
                    await API.get(
                        "/client-master/stats"
                    );

                setStats({
                    total:
                        Number(
                            response.data
                                ?.total || 0
                        ),
                    active:
                        Number(
                            response.data
                                ?.active || 0
                        ),
                    inactive:
                        Number(
                            response.data
                                ?.inactive || 0
                        ),
                });
            } catch (error) {
                showMessage(
                    getApiMessage(
                        error,
                        "Unable to load Client Master statistics."
                    ),
                    "error"
                );
            }
        },
        [showMessage]
    );

    const loadRows = useCallback(
        async () => {
            setLoading(true);

            try {
                const response =
                    await API.get(
                        "/client-master",
                        {
                            params: {
                                page:
                                    Math.max(
                                        0,
                                        pageNo - 1
                                    ),
                                size:
                                    pageSize,
                                search:
                                    debouncedSearch,
                                status,
                            },
                        }
                    );

                const payload =
                    response.data || {};

                const content =
                    Array.isArray(
                        payload.content
                    )
                        ? payload.content
                        : [];

                const nextTotalPages =
                    Math.max(
                        1,
                        Number(
                            payload.totalPages ||
                            1
                        )
                    );

                setRows(content);

                setTotalElements(
                    Number(
                        payload.totalElements ||
                        0
                    )
                );

                setTotalPages(
                    nextTotalPages
                );

                if (
                    pageNo >
                    nextTotalPages
                ) {
                    setPageNo(
                        nextTotalPages
                    );
                }
            } catch (error) {
                setRows([]);
                setTotalElements(0);
                setTotalPages(1);

                showMessage(
                    getApiMessage(
                        error,
                        "Unable to load Client Master."
                    ),
                    "error"
                );
            } finally {
                setLoading(false);
            }
        },
        [
            pageNo,
            pageSize,
            debouncedSearch,
            status,
            showMessage,
        ]
    );

    const refreshAll = useCallback(
        async () => {
            await Promise.allSettled([
                loadRows(),
                loadStats(),
            ]);
        },
        [
            loadRows,
            loadStats,
        ]
    );

    useEffect(() => {
        refreshAll();
    }, [refreshAll]);

    const currentPage =
        Math.min(
            pageNo,
            totalPages
        );

    const visibleStart =
        totalElements === 0
            ? 0
            : (
                (currentPage - 1) *
                pageSize
            ) + 1;

    const visibleEnd =
        Math.min(
            totalElements,
            (
                (currentPage - 1) *
                pageSize
            ) + rows.length
        );

    const activeFilterCount =
        [
            Boolean(
                search.trim()
            ),
            status !== "ALL",
        ].filter(Boolean).length;

    const openCreateDrawer =
        () => {
            setDrawerMode(
                "create"
            );

            setEditingRow(null);

            setForm({
                ...EMPTY_FORM,
            });

            setFormError("");

            setDrawerOpen(true);
        };

    const openEditDrawer =
        (row) => {
            setDrawerMode(
                "edit"
            );

            setEditingRow(row);

            setForm({
                name:
                    row?.name || "",
                address:
                    row?.address || "",
                active:
                    row?.active !== false,
            });

            setFormError("");

            setDrawerOpen(true);
        };

    const closeDrawer =
        () => {
            if (saving) {
                return;
            }

            setDrawerOpen(false);
            setEditingRow(null);

            setForm({
                ...EMPTY_FORM,
            });

            setFormError("");
        };

    const updateForm = (
        key,
        value
    ) => {
        setForm(
            (previous) => ({
                ...previous,
                [key]: value,
            })
        );

        if (
            key === "name" &&
            formError
        ) {
            setFormError("");
        }
    };

    const validateForm =
        () => {
            const cleanName =
                String(
                    form.name || ""
                ).trim();

            if (!cleanName) {
                return "Client name is required.";
            }

            if (
                cleanName.length >
                250
            ) {
                return "Client name cannot exceed 250 characters.";
            }

            return "";
        };

    const saveClient =
        async () => {
            const validationError =
                validateForm();

            if (validationError) {
                setFormError(
                    validationError
                );

                return;
            }

            setSaving(true);
            setFormError("");

            try {
                const payload = {
                    name:
                        String(
                            form.name || ""
                        ).trim(),
                    address:
                        String(
                            form.address ||
                            ""
                        ).trim(),
                    active:
                        form.active ===
                        true,
                };

                if (
                    drawerMode ===
                    "edit" &&
                    editingRow?.id
                ) {
                    await API.put(
                        `/client-master/${encodeURIComponent(
                            editingRow.id
                        )}`,
                        payload
                    );
                } else {
                    await API.post(
                        "/client-master",
                        payload
                    );
                }

                showMessage(
                    drawerMode ===
                        "edit"
                        ? "Client updated successfully."
                        : "Client created successfully."
                );

                setDrawerOpen(false);
                setEditingRow(null);

                setForm({
                    ...EMPTY_FORM,
                });

                await refreshAll();
            } catch (error) {
                setFormError(
                    getApiMessage(
                        error,
                        drawerMode ===
                            "edit"
                            ? "Unable to update client."
                            : "Unable to create client."
                    )
                );
            } finally {
                setSaving(false);
            }
        };

    const openStatusConfirm =
        (row) => {
            setStatusTarget(row);
            setConfirmOpen(true);
        };

    const closeStatusConfirm =
        () => {
            if (statusSaving) {
                return;
            }

            setConfirmOpen(false);
            setStatusTarget(null);
        };

    const confirmStatusChange =
        async () => {
            if (
                !statusTarget?.id
            ) {
                return;
            }

            setStatusSaving(true);

            try {
                const nextActive =
                    statusTarget.active ===
                    false;

                await API.patch(
                    `/client-master/${encodeURIComponent(
                        statusTarget.id
                    )}/active`,
                    null,
                    {
                        params: {
                            active:
                                nextActive,
                        },
                    }
                );

                showMessage(
                    nextActive
                        ? "Client reactivated successfully."
                        : "Client archived successfully."
                );

                setConfirmOpen(false);
                setStatusTarget(null);

                await refreshAll();
            } catch (error) {
                showMessage(
                    getApiMessage(
                        error,
                        "Unable to update client status."
                    ),
                    "error"
                );
            } finally {
                setStatusSaving(false);
            }
        };

    const clearFilters =
        () => {
            setSearch("");
            setDebouncedSearch("");
            setStatus("ALL");
            setPageNo(1);
        };

    const logout =
        async () => {
            await authLogout();

            navigate(
                "/login",
                {
                    replace: true,
                }
            );
        };

    return (
        <Box sx={pageSx}>
            <Box sx={contentSx}>
                <PageHeader
                    canOpenPackFlow={
                        canOpenPackFlow
                    }
                    canOpenBOMFlow={
                        canOpenBOMFlow
                    }
                    canOpenMatFlow={
                        canOpenMatFlow
                    }
                    onModules={() =>
                        navigate(
                            "/modules"
                        )
                    }
                    onPackFlow={() =>
                        navigate(
                            "/packflow/dashboard"
                        )
                    }
                    onBOMFlow={() =>
                        navigate(
                            "/bomflow/dashboard"
                        )
                    }
                    onMatFlow={() =>
                        navigate(
                            "/matflow/dashboard"
                        )
                    }
                    onLogout={logout}
                    onCreate={
                        openCreateDrawer
                    }
                />

                <Box sx={breadcrumbSx}>
                    <Button
                        startIcon={
                            <ArrowBackIcon />
                        }
                        onClick={() =>
                            navigate(
                                "/modules"
                            )
                        }
                        sx={
                            secondaryButtonSx
                        }
                    >
                        Module Hub
                    </Button>

                    <Typography
                        sx={
                            breadcrumbTextSx
                        }
                    >
                        FlowSuite / Shared Master Data /
                        Client Master
                    </Typography>

                    <Chip
                        label="ADMIN ACCESS"
                        size="small"
                        sx={
                            adminAccessChipSx
                        }
                    />
                </Box>

                <Box sx={statsGridSx}>
                    <StatCard
                        label="Total Clients"
                        value={stats.total}
                        accent="#3b82f6"
                        icon={
                            <PeopleAltOutlinedIcon />
                        }
                    />

                    <StatCard
                        label="Active Clients"
                        value={stats.active}
                        accent="#22c55e"
                        icon={
                            <CheckCircleOutlineOutlinedIcon />
                        }
                    />

                    <StatCard
                        label="Archived Clients"
                        value={stats.inactive}
                        accent="#64748b"
                        icon={
                            <BlockOutlinedIcon />
                        }
                    />

                    <StatCard
                        label="Current Result"
                        value={totalElements}
                        accent="#a78bfa"
                        icon={
                            <VisibilityOutlinedIcon />
                        }
                    />
                </Box>

                <Box
                    sx={
                        smartControlPanelSx
                    }
                >
                    <Box
                        sx={
                            smartControlHeaderSx
                        }
                    >
                        <Box>
                            <Box
                                sx={
                                    smartControlEyebrowSx
                                }
                            >
                                SMART CLIENT MASTER
                            </Box>

                            <Typography
                                sx={
                                    smartControlTitleSx
                                }
                            >
                                Client Directory & Shared Master Control
                            </Typography>

                            <Typography
                                sx={
                                    smartControlSubSx
                                }
                            >
                                Maintain one reusable client directory for PackFlow
                                search today and future FlowSuite module integrations.
                                Client creation in PackFlow remains free-text; this master
                                adds controlled reusable suggestions without changing the
                                existing packet workflow.
                            </Typography>
                        </Box>

                        <Box
                            sx={
                                smartControlActionsSx
                            }
                        >
                            <Button
                                startIcon={
                                    <RefreshOutlinedIcon />
                                }
                                onClick={
                                    refreshAll
                                }
                                disabled={
                                    loading
                                }
                                sx={
                                    secondaryButtonSx
                                }
                            >
                                {loading
                                    ? "Refreshing..."
                                    : "Refresh"}
                            </Button>

                            <Button
                                startIcon={
                                    <AddOutlinedIcon />
                                }
                                onClick={
                                    openCreateDrawer
                                }
                                sx={
                                    primaryButtonSx
                                }
                            >
                                Add Client
                            </Button>
                        </Box>
                    </Box>

                    <Box
                        sx={
                            smartSearchRowSx
                        }
                    >
                        <TextField
                            fullWidth
                            value={search}
                            onChange={(
                                event
                            ) => {
                                setSearch(
                                    event.target
                                        .value
                                );
                                setPageNo(1);
                            }}
                            placeholder="Smart search: client name..."
                            size="small"
                            sx={fieldSx}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon
                                            sx={{
                                                color: "#94a3b8",
                                            }}
                                        />
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Box>

                    <Box
                        sx={
                            smartFiltersGridSx
                        }
                    >
                        <TextField
                            select
                            size="small"
                            label="Status"
                            value={status}
                            onChange={(
                                event
                            ) => {
                                setStatus(
                                    event.target
                                        .value
                                );
                                setPageNo(1);
                            }}
                            sx={fieldSx}
                        >
                            <MenuItem value="ALL">
                                All Statuses
                            </MenuItem>

                            <MenuItem value="ACTIVE">
                                Active
                            </MenuItem>

                            <MenuItem value="INACTIVE">
                                Archived
                            </MenuItem>
                        </TextField>

                        <TextField
                            select
                            size="small"
                            label="Rows per page"
                            value={pageSize}
                            onChange={(
                                event
                            ) => {
                                setPageSize(
                                    Number(
                                        event.target
                                            .value
                                    )
                                );
                                setPageNo(1);
                            }}
                            sx={fieldSx}
                        >
                            {PAGE_SIZE_OPTIONS.map(
                                (option) => (
                                    <MenuItem
                                        key={option}
                                        value={option}
                                    >
                                        {option}
                                    </MenuItem>
                                )
                            )}
                        </TextField>

                        <Box
                            sx={
                                filterInsightCardSx
                            }
                        >
                            <PeopleAltOutlinedIcon />

                            <Box>
                                <Typography
                                    sx={
                                        filterInsightLabelSx
                                    }
                                >
                                    Visible Register
                                </Typography>

                                <Typography
                                    sx={
                                        filterInsightValueSx
                                    }
                                >
                                    {totalElements} client
                                    {totalElements === 1
                                        ? ""
                                        : "s"}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>

                    <Box
                        sx={
                            smartFilterFooterSx
                        }
                    >
                        <Box
                            sx={
                                smartFilterSummarySx
                            }
                        >
                            <FilterAltOutlinedIcon
                                sx={{
                                    fontSize: 17,
                                    color: "#60a5fa",
                                }}
                            />

                            <Typography
                                sx={mutedTextSx}
                            >
                                Showing {visibleStart}–{visibleEnd} of {totalElements} matching clients
                            </Typography>

                            {activeFilterCount >
                                0 && (
                                    <Chip
                                        label={`${activeFilterCount} active filter${activeFilterCount === 1
                                            ? ""
                                            : "s"}`}
                                        size="small"
                                        sx={
                                            smartFilterChipSx
                                        }
                                    />
                                )}
                        </Box>

                        <Button
                            onClick={
                                clearFilters
                            }
                            disabled={
                                activeFilterCount ===
                                0
                            }
                            sx={
                                secondaryButtonSx
                            }
                        >
                            Clear Filters
                        </Button>
                    </Box>
                </Box>

                <Box sx={tablePanelSx}>
                    <Box sx={tableHeaderSx}>
                        <Box>Client</Box>
                        <Box>Address</Box>
                        <Box>Source</Box>
                        <Box>Created By</Box>
                        <Box>Updated By / Time</Box>
                        <Box>Status</Box>
                        <Box>Actions</Box>
                    </Box>

                    {loading ? (
                        <Box sx={loadingSx}>
                            <CircularProgress />
                        </Box>
                    ) : rows.length ===
                        0 ? (
                        <Box
                            sx={
                                emptyStateSx
                            }
                        >
                            No clients match the current filters.
                        </Box>
                    ) : (
                        <Box>
                            {rows.map(
                                (row) => (
                                    <ClientRow
                                        key={
                                            row.id
                                        }
                                        row={
                                            row
                                        }
                                        onEdit={() =>
                                            openEditDrawer(
                                                row
                                            )
                                        }
                                        onToggle={() =>
                                            openStatusConfirm(
                                                row
                                            )
                                        }
                                    />
                                )
                            )}
                        </Box>
                    )}

                    <Box sx={paginationSx}>
                        <Box
                            sx={
                                pageSizeSx
                            }
                        >
                            <Typography
                                sx={mutedTextSx}
                            >
                                Rows per page
                            </Typography>

                            <TextField
                                select
                                size="small"
                                value={pageSize}
                                onChange={(
                                    event
                                ) => {
                                    setPageSize(
                                        Number(
                                            event
                                                .target
                                                .value
                                        )
                                    );
                                    setPageNo(
                                        1
                                    );
                                }}
                                sx={{
                                    ...fieldSx,
                                    width: 92,
                                }}
                            >
                                {PAGE_SIZE_OPTIONS.map(
                                    (
                                        option
                                    ) => (
                                        <MenuItem
                                            key={
                                                option
                                            }
                                            value={
                                                option
                                            }
                                        >
                                            {
                                                option
                                            }
                                        </MenuItem>
                                    )
                                )}
                            </TextField>
                        </Box>

                        <Box
                            sx={
                                pageControlsSx
                            }
                        >
                            <Button
                                disabled={
                                    currentPage <=
                                    1 ||
                                    loading
                                }
                                onClick={() =>
                                    setPageNo(
                                        1
                                    )
                                }
                                sx={
                                    pagerMiniButtonSx
                                }
                            >
                                First
                            </Button>

                            <Button
                                disabled={
                                    currentPage <=
                                    1 ||
                                    loading
                                }
                                onClick={() =>
                                    setPageNo(
                                        Math.max(
                                            1,
                                            currentPage -
                                            1
                                        )
                                    )
                                }
                                sx={
                                    pagerMiniButtonSx
                                }
                            >
                                ‹
                            </Button>

                            <Chip
                                label={`Page ${currentPage} / ${totalPages}`}
                                sx={pageChipSx}
                            />

                            <Button
                                disabled={
                                    currentPage >=
                                    totalPages ||
                                    loading
                                }
                                onClick={() =>
                                    setPageNo(
                                        Math.min(
                                            totalPages,
                                            currentPage +
                                            1
                                        )
                                    )
                                }
                                sx={
                                    pagerMiniButtonSx
                                }
                            >
                                ›
                            </Button>

                            <Button
                                disabled={
                                    currentPage >=
                                    totalPages ||
                                    loading
                                }
                                onClick={() =>
                                    setPageNo(
                                        totalPages
                                    )
                                }
                                sx={
                                    pagerMiniButtonSx
                                }
                            >
                                Last
                            </Button>
                        </Box>

                        <Typography
                            sx={mutedTextSx}
                        >
                            Showing {visibleStart}–{visibleEnd} of {totalElements} clients
                        </Typography>
                    </Box>
                </Box>

                <Alert
                    severity="info"
                    sx={infoAlertSx}
                >
                    PackFlow client fields remain free-text. The searchable
                    suggestion list uses this Client Master only after the packing
                    user types at least two characters, so the entire client list is
                    never dumped into the creation form.
                </Alert>
            </Box>

            <ClientEditorDrawer
                open={drawerOpen}
                mode={drawerMode}
                form={form}
                saving={saving}
                formError={
                    formError
                }
                onClose={
                    closeDrawer
                }
                onSave={saveClient}
                onUpdate={
                    updateForm
                }
            />

            <ClientStatusDialog
                open={confirmOpen}
                row={statusTarget}
                saving={
                    statusSaving
                }
                onClose={
                    closeStatusConfirm
                }
                onConfirm={
                    confirmStatusChange
                }
            />

            <Snackbar
                open={snackbar.open}
                autoHideDuration={3500}
                onClose={() =>
                    setSnackbar(
                        (previous) => ({
                            ...previous,
                            open: false,
                        })
                    )
                }
                anchorOrigin={{
                    vertical: "top",
                    horizontal: "center",
                }}
            >
                <Alert
                    severity={
                        snackbar.severity
                    }
                    variant="filled"
                    onClose={() =>
                        setSnackbar(
                            (previous) => ({
                                ...previous,
                                open: false,
                            })
                        )
                    }
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}

/* =========================================================
 * HEADER
 * ========================================================= */

function PageHeader({
    canOpenPackFlow,
    canOpenBOMFlow,
    canOpenMatFlow,
    onModules,
    onPackFlow,
    onBOMFlow,
    onMatFlow,
    onLogout,
    onCreate,
}) {
    return (
        <Box sx={headerSx}>
            <Box>
                <Box sx={brandRowSx}>
                    <Box sx={brandMarkSx}>
                        A
                    </Box>

                    <Box>
                        <Typography
                            sx={suiteTitleSx}
                        >
                            FlowSuite
                        </Typography>

                        <Typography
                            sx={suiteSubSx}
                        >
                            Global Client & Shared Master Control
                        </Typography>
                    </Box>
                </Box>

                <Typography sx={pageTitleSx}>
                    Client Master
                </Typography>

                <Typography sx={pageSubtitleSx}>
                    Maintain a controlled client directory for searchable PackFlow
                    selection and future cross-module reuse without changing the
                    existing packet creation workflow.
                </Typography>
            </Box>

            <Box sx={headerActionsSx}>
                <Button
                    startIcon={
                        <AppsIcon />
                    }
                    onClick={onModules}
                    sx={
                        secondaryButtonSx
                    }
                >
                    Modules
                </Button>

                {canOpenPackFlow && (
                    <Button
                        startIcon={
                            <InventoryIcon />
                        }
                        onClick={
                            onPackFlow
                        }
                        sx={
                            secondaryButtonSx
                        }
                    >
                        PackFlow
                    </Button>
                )}

                {canOpenBOMFlow && (
                    <Button
                        startIcon={
                            <AccountTreeOutlinedIcon />
                        }
                        onClick={
                            onBOMFlow
                        }
                        sx={
                            secondaryButtonSx
                        }
                    >
                        BOMFlow
                    </Button>
                )}

                {canOpenMatFlow && (
                    <Button
                        startIcon={
                            <LayersOutlinedIcon />
                        }
                        onClick={
                            onMatFlow
                        }
                        sx={
                            secondaryButtonSx
                        }
                    >
                        MatFlow
                    </Button>
                )}

                <Button
                    startIcon={
                        <LogoutIcon />
                    }
                    onClick={onLogout}
                    sx={
                        dangerOutlineButtonSx
                    }
                >
                    Logout
                </Button>

                <Button
                    startIcon={
                        <AddOutlinedIcon />
                    }
                    onClick={onCreate}
                    sx={primaryButtonSx}
                >
                    Add Client
                </Button>
            </Box>
        </Box>
    );
}

/* =========================================================
 * CLIENT ROW
 * ========================================================= */

function ClientRow({
    row,
    onEdit,
    onToggle,
}) {
    const active =
        row?.active !== false;

    const initial =
        String(
            row?.name || "C"
        )
            .trim()
            .charAt(0)
            .toUpperCase() ||
        "C";

    const xlsxSeeded =
        String(
            row?.source || ""
        )
            .toUpperCase()
            .startsWith(
                "XLSX_SEED"
            );

    return (
        <Box
            sx={{
                ...tableRowSx,
                opacity: active
                    ? 1
                    : 0.62,
            }}
        >
            <Box sx={clientCellSx}>
                <Box
                    sx={avatarSx(
                        active
                            ? "#3b82f6"
                            : "#64748b"
                    )}
                >
                    {initial}
                </Box>

                <Box sx={{ minWidth: 0 }}>
                    <Typography
                        sx={clientNameSx}
                    >
                        {row?.name || "—"}
                    </Typography>

                    <Typography
                        sx={smallMutedSx}
                    >
                        Client ID: {shortId(
                            row?.id
                        )}
                    </Typography>
                </Box>
            </Box>

            <Box sx={addressCellSx}>
                <HomeWorkOutlinedIcon
                    sx={{
                        fontSize: 17,
                        color: row?.address
                            ? "#60a5fa"
                            : "#475569",
                        flexShrink: 0,
                    }}
                />

                <Typography
                    sx={
                        row?.address
                            ? addressTextSx
                            : addressEmptySx
                    }
                >
                    {row?.address ||
                        "No address recorded"}
                </Typography>
            </Box>

            <Box>
                <Tooltip
                    title={
                        row?.source ||
                        "MANUAL"
                    }
                >
                    <Chip
                        icon={
                            xlsxSeeded
                                ? <SourceOutlinedIcon />
                                : <BusinessOutlinedIcon />
                        }
                        label={
                            sourceLabel(
                                row?.source
                            )
                        }
                        size="small"
                        sx={
                            xlsxSeeded
                                ? sourceSeedChipSx
                                : sourceManualChipSx
                        }
                    />
                </Tooltip>
            </Box>

            <Box sx={auditCellSx}>
                <Typography
                    sx={auditPrimarySx}
                >
                    {row?.createdBy ||
                        "SYSTEM"}
                </Typography>

                <Typography
                    sx={smallMutedSx}
                >
                    {formatDateTime(
                        row?.createdAt
                    )}
                </Typography>
            </Box>

            <Box sx={auditCellSx}>
                <Typography
                    sx={auditPrimarySx}
                >
                    {row?.updatedBy ||
                        row?.createdBy ||
                        "SYSTEM"}
                </Typography>

                <Typography
                    sx={smallMutedSx}
                >
                    {formatDateTime(
                        row?.updatedAt ||
                        row?.createdAt
                    )}
                </Typography>
            </Box>

            <Box>
                <Chip
                    icon={
                        active ? (
                            <CheckCircleOutlineOutlinedIcon />
                        ) : (
                            <BlockOutlinedIcon />
                        )
                    }
                    label={
                        active
                            ? "Active"
                            : "Archived"
                    }
                    size="small"
                    sx={
                        active
                            ? enabledChipSx
                            : disabledChipSx
                    }
                />
            </Box>

            <Box sx={actionsSx}>
                <Button
                    startIcon={
                        <EditOutlinedIcon />
                    }
                    onClick={onEdit}
                    sx={
                        secondaryButtonSx
                    }
                >
                    Edit
                </Button>

                <Button
                    startIcon={
                        active
                            ? <ArchiveOutlinedIcon />
                            : <UnarchiveOutlinedIcon />
                    }
                    onClick={onToggle}
                    sx={
                        active
                            ? archiveButtonSx
                            : reactivateButtonSx
                    }
                >
                    {active
                        ? "Archive"
                        : "Reactivate"}
                </Button>
            </Box>
        </Box>
    );
}

/* =========================================================
 * CLIENT EDITOR DRAWER
 * ========================================================= */

function ClientEditorDrawer({
    open,
    mode,
    form,
    saving,
    formError,
    onClose,
    onSave,
    onUpdate,
}) {
    const editing =
        mode === "edit";

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: drawerPaperSx,
            }}
        >
            <Box sx={drawerHeaderSx}>
                <Box>
                    <Typography
                        sx={drawerTitleSx}
                    >
                        {editing
                            ? "Edit Client"
                            : "Add Client"}
                    </Typography>

                    <Typography
                        sx={drawerSubSx}
                    >
                        {editing
                            ? "Update the shared client master record."
                            : "Create a reusable client master record."}
                    </Typography>
                </Box>

                <Button
                    onClick={onClose}
                    disabled={saving}
                    sx={closeButtonSx}
                >
                    <CloseOutlinedIcon />
                </Button>
            </Box>

            <Divider sx={dividerSx} />

            <Box sx={drawerBodySx}>
                {formError && (
                    <Alert
                        severity="error"
                        sx={
                            errorAlertSx
                        }
                    >
                        {formError}
                    </Alert>
                )}

                <Box sx={sectionSx}>
                    <Typography
                        sx={sectionTitleSx}
                    >
                        Client Details
                    </Typography>

                    <Typography
                        sx={
                            sectionDescriptionSx
                        }
                    >
                        Client name is the searchable master key used by PackFlow
                        autocomplete. Address is optional and can be maintained
                        later.
                    </Typography>

                    <TextField
                        fullWidth
                        label="Client Name"
                        value={form.name}
                        onChange={(
                            event
                        ) =>
                            onUpdate(
                                "name",
                                event.target
                                    .value
                            )
                        }
                        autoFocus
                        sx={fieldSx}
                        helperText="Required. Duplicate names are blocked by the backend using normalized-name matching."
                    />

                    <TextField
                        fullWidth
                        label="Client Address"
                        value={
                            form.address
                        }
                        onChange={(
                            event
                        ) =>
                            onUpdate(
                                "address",
                                event.target
                                    .value
                            )
                        }
                        multiline
                        minRows={4}
                        sx={fieldSx}
                        helperText="Optional. XLSX-seeded records initially have no address because the source workbook contains names only."
                    />
                </Box>

                <Box
                    sx={
                        permissionCardSx
                    }
                >
                    <Box>
                        <Typography
                            sx={
                                permissionTitleSx
                            }
                        >
                            Active Client
                        </Typography>

                        <Typography
                            sx={
                                permissionSubSx
                            }
                        >
                            Only active clients appear in the PackFlow searchable
                            suggestion list.
                        </Typography>
                    </Box>

                    <Switch
                        checked={
                            form.active ===
                            true
                        }
                        onChange={(
                            event
                        ) =>
                            onUpdate(
                                "active",
                                event.target
                                    .checked
                            )
                        }
                    />
                </Box>

                <Alert
                    severity="info"
                    sx={infoAlertSx}
                >
                    PackFlow remains free-text. Deactivating a client only removes it
                    from Client Master suggestions; it does not rewrite or delete
                    existing packet, sticker, warehouse or dispatch records.
                </Alert>
            </Box>

            <Box sx={drawerFooterSx}>
                <Button
                    fullWidth
                    onClick={onClose}
                    disabled={saving}
                    sx={
                        secondaryButtonSx
                    }
                >
                    Cancel
                </Button>

                <Button
                    fullWidth
                    onClick={onSave}
                    disabled={saving}
                    sx={
                        primaryButtonSx
                    }
                >
                    {saving
                        ? "Saving..."
                        : editing
                            ? "Save Changes"
                            : "Add Client"}
                </Button>
            </Box>
        </Drawer>
    );
}

/* =========================================================
 * STATUS DIALOG
 * ========================================================= */

function ClientStatusDialog({
    open,
    row,
    saving,
    onClose,
    onConfirm,
}) {
    const willReactivate =
        row?.active === false;

    return (
        <Dialog
            open={open}
            onClose={
                saving
                    ? undefined
                    : onClose
            }
            PaperProps={{
                sx: dialogPaperSx,
            }}
        >
            <DialogTitle>
                {willReactivate
                    ? "Reactivate Client"
                    : "Archive Client"}
            </DialogTitle>

            <DialogContent>
                <Typography
                    sx={dialogTextSx}
                >
                    {willReactivate ? (
                        <>
                            Reactivate{" "}
                            <strong>
                                {row?.name ||
                                    "this client"}
                            </strong>
                            ? It will become searchable again in PackFlow
                            Client Master suggestions.
                        </>
                    ) : (
                        <>
                            Archive{" "}
                            <strong>
                                {row?.name ||
                                    "this client"}
                            </strong>
                            ? Existing FlowSuite packet/history data will remain
                            untouched; only future Client Master suggestion lookup
                            will exclude it.
                        </>
                    )}
                </Typography>
            </DialogContent>

            <DialogActions
                sx={dialogActionsSx}
            >
                <Button
                    onClick={onClose}
                    disabled={saving}
                    sx={
                        secondaryButtonSx
                    }
                >
                    Cancel
                </Button>

                <Button
                    onClick={
                        onConfirm
                    }
                    disabled={saving}
                    sx={
                        willReactivate
                            ? reactivateButtonSx
                            : archiveButtonSx
                    }
                >
                    {saving
                        ? "Saving..."
                        : willReactivate
                            ? "Reactivate"
                            : "Archive"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

/* =========================================================
 * SMALL COMPONENTS
 * ========================================================= */

function StatCard({
    label,
    value,
    accent,
    icon,
}) {
    return (
        <Box
            sx={statCardSx(
                accent
            )}
        >
            <Box
                sx={statIconSx(
                    accent
                )}
            >
                {icon}
            </Box>

            <Box>
                <Typography
                    sx={statLabelSx}
                >
                    {label}
                </Typography>

                <Typography
                    sx={statValueSx}
                >
                    {value}
                </Typography>
            </Box>
        </Box>
    );
}

/* =========================================================
 * STYLES
 * ========================================================= */

const pageSx = {
    minHeight: "100vh",
    background: `
		radial-gradient(circle at top left, rgba(59,130,246,.14), transparent 24%),
		radial-gradient(circle at bottom right, rgba(20,184,166,.10), transparent 24%),
		linear-gradient(135deg,#020617 0%,#0f172a 48%,#111827 100%)
	`,
    color: "#fff",
};

const contentSx = {
    width: "100%",
    maxWidth: 1600,
    mx: "auto",
    p: {
        xs: 2,
        md: 3,
    },
    display: "flex",
    flexDirection: "column",
    gap: 2,
    boxSizing: "border-box",
};

const headerSx = {
    p: {
        xs: 2,
        md: 3,
    },
    borderRadius: "24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 2,
    flexWrap: "wrap",
    background:
        "linear-gradient(180deg, rgba(15,23,42,.94), rgba(15,23,42,.82))",
    border:
        "1px solid rgba(255,255,255,.08)",
    boxShadow:
        "0 28px 70px rgba(2,6,23,.38)",
};

const brandRowSx = {
    display: "flex",
    alignItems: "center",
    gap: 1.5,
    mb: 2,
};

const brandMarkSx = {
    width: 46,
    height: 46,
    borderRadius: "14px",
    display: "grid",
    placeItems: "center",
    background:
        "linear-gradient(135deg,#2563eb,#3b82f6)",
    fontWeight: 950,
    fontSize: 18,
    boxShadow:
        "0 12px 28px rgba(37,99,235,.35)",
};

const suiteTitleSx = {
    fontSize: 17,
    fontWeight: 950,
};

const suiteSubSx = {
    mt: 0.3,
    color:
        "rgba(255,255,255,.52)",
    fontSize: 11.5,
    fontWeight: 700,
};

const pageTitleSx = {
    fontSize: {
        xs: 25,
        md: 34,
    },
    fontWeight: 950,
    letterSpacing: "-.04em",
};

const pageSubtitleSx = {
    mt: 0.8,
    maxWidth: 760,
    color:
        "rgba(255,255,255,.62)",
    fontSize: 13,
    fontWeight: 650,
    lineHeight: 1.6,
};

const headerActionsSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 1,
    flexWrap: "wrap",
};

const breadcrumbSx = {
    display: "flex",
    alignItems: "center",
    justifyContent:
        "space-between",
    gap: 1.5,
    flexWrap: "wrap",
    px: 0.5,
};

const breadcrumbTextSx = {
    color: "#94a3b8",
    fontSize: 12.5,
    fontWeight: 750,
};

const adminAccessChipSx = {
    color: "#fbbf24",
    background:
        "rgba(245,158,11,.12)",
    border:
        "1px solid rgba(245,158,11,.24)",
    fontWeight: 900,
};

const statsGridSx = {
    display: "grid",
    gridTemplateColumns: {
        xs: "1fr",
        sm:
            "repeat(2,minmax(0,1fr))",
        lg:
            "repeat(4,minmax(0,1fr))",
    },
    gap: 1.2,
};

const statCardSx = (
    accent
) => ({
    p: 1.6,
    minHeight: 78,
    borderRadius: "16px",
    display: "flex",
    alignItems: "center",
    gap: 1.3,
    background:
        "linear-gradient(180deg,rgba(30,41,59,.76),rgba(15,23,42,.80))",
    border:
        `1px solid ${accent}30`,
    boxShadow:
        "0 16px 32px rgba(2,6,23,.28)",
});

const statIconSx = (
    accent
) => ({
    width: 40,
    height: 40,
    borderRadius: "12px",
    display: "grid",
    placeItems: "center",
    color: accent,
    background:
        `${accent}16`,
    border:
        `1px solid ${accent}30`,
});

const statLabelSx = {
    color:
        "rgba(255,255,255,.58)",
    fontSize: 10.5,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".06em",
};

const statValueSx = {
    mt: 0.3,
    fontSize: 23,
    fontWeight: 950,
    lineHeight: 1,
};

const smartControlPanelSx = {
    p: 1.5,
    borderRadius: "20px",
    background:
        "radial-gradient(circle at top left,rgba(59,130,246,.10),transparent 35%),linear-gradient(180deg,rgba(15,23,42,.88),rgba(2,6,23,.68))",
    border:
        "1px solid rgba(96,165,250,.10)",
    boxShadow:
        "0 18px 42px rgba(2,6,23,.28)",
};

const smartControlHeaderSx = {
    display: "flex",
    justifyContent:
        "space-between",
    alignItems: "flex-start",
    gap: 2,
    flexWrap: "wrap",
};

const smartControlEyebrowSx = {
    color: "#60a5fa",
    fontSize: 10,
    fontWeight: 950,
    letterSpacing: ".11em",
};

const smartControlTitleSx = {
    mt: 0.3,
    fontSize: 20,
    fontWeight: 950,
    color: "#f8fafc",
};

const smartControlSubSx = {
    mt: 0.4,
    maxWidth: 900,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 650,
    lineHeight: 1.5,
};

const smartControlActionsSx = {
    display: "flex",
    alignItems: "center",
    gap: 1,
    flexWrap: "wrap",
};

const smartSearchRowSx = {
    mt: 1.3,
};

const smartFiltersGridSx = {
    mt: 1.1,
    display: "grid",
    gridTemplateColumns: {
        xs: "1fr",
        sm:
            "repeat(2,minmax(0,1fr))",
        lg:
            "minmax(180px,.8fr) minmax(180px,.8fr) minmax(260px,1.4fr)",
    },
    gap: 1,
};

const filterInsightCardSx = {
    minHeight: 40,
    borderRadius: "13px",
    display: "flex",
    alignItems: "center",
    gap: 1,
    px: 1.3,
    background:
        "rgba(59,130,246,.06)",
    border:
        "1px solid rgba(96,165,250,.12)",
    color: "#60a5fa",

    "& svg": {
        fontSize: 20,
    },
};

const filterInsightLabelSx = {
    color: "#64748b",
    fontSize: 9.5,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".06em",
};

const filterInsightValueSx = {
    mt: 0.1,
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 900,
};

const smartFilterFooterSx = {
    mt: 1.1,
    pt: 1,
    borderTop:
        "1px solid rgba(148,163,184,.07)",
    display: "flex",
    justifyContent:
        "space-between",
    alignItems: "center",
    gap: 1,
    flexWrap: "wrap",
};

const smartFilterSummarySx = {
    display: "flex",
    alignItems: "center",
    gap: 1,
    flexWrap: "wrap",
};

const smartFilterChipSx = {
    height: 23,
    color: "#93c5fd",
    background:
        "rgba(59,130,246,.10)",
    border:
        "1px solid rgba(96,165,250,.16)",
    fontWeight: 900,
    fontSize: 9.5,
};

const tablePanelSx = {
    borderRadius: "22px",
    background:
        "linear-gradient(180deg,rgba(15,23,42,.94),rgba(17,24,39,.92))",
    border:
        "1px solid rgba(255,255,255,.07)",
    boxShadow:
        "0 24px 64px rgba(2,6,23,.34)",
    overflowX: "auto",
    scrollbarWidth: "thin",
    scrollbarColor:
        "rgba(96,165,250,.72) rgba(15,23,42,.35)",

    "&::-webkit-scrollbar": {
        height: 10,
    },

    "&::-webkit-scrollbar-track": {
        background:
            "rgba(15,23,42,.35)",
        borderRadius: 999,
    },

    "&::-webkit-scrollbar-thumb": {
        background:
            "linear-gradient(90deg,#334155,#3b82f6,#60a5fa)",
        borderRadius: 999,
        border:
            "2px solid #0f172a",
    },
};

const tableHeaderSx = {
    minWidth: 1490,
    display: "grid",
    gridTemplateColumns:
        "1.15fr 1.55fr .82fr .82fr 1.08fr .66fr 260px",
    gap: 2,
    alignItems: "center",
    p: "15px 20px",
    color: "#93c5fd",
    background:
        "rgba(2,6,23,.34)",
    borderBottom:
        "1px solid rgba(255,255,255,.08)",
    fontSize: 10.5,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: ".07em",
};

const tableRowSx = {
    minWidth: 1490,
    display: "grid",
    gridTemplateColumns:
        "1.15fr 1.55fr .82fr .82fr 1.08fr .66fr 260px",
    gap: 2,
    alignItems: "center",
    p: "15px 20px",
    borderBottom:
        "1px solid rgba(255,255,255,.06)",
    transition:
        "background .2s ease",

    "&:hover": {
        background:
            "rgba(59,130,246,.055)",
    },
};

const clientCellSx = {
    display: "flex",
    alignItems: "center",
    gap: 1.2,
    minWidth: 0,
};

const avatarSx = (
    accent
) => ({
    width: 38,
    height: 38,
    borderRadius: "12px",
    display: "grid",
    placeItems: "center",
    background:
        `${accent}22`,
    color: accent,
    border:
        `1px solid ${accent}35`,
    fontWeight: 950,
    flexShrink: 0,
});

const clientNameSx = {
    color: "#fff",
    fontSize: 13.5,
    fontWeight: 900,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
};

const smallMutedSx = {
    mt: 0.3,
    color:
        "rgba(255,255,255,.42)",
    fontSize: 10.5,
    fontWeight: 650,
};

const addressCellSx = {
    display: "flex",
    alignItems: "flex-start",
    gap: 0.8,
    minWidth: 0,
};

const addressTextSx = {
    color: "#cbd5e1",
    fontSize: 11.5,
    fontWeight: 700,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
};

const addressEmptySx = {
    ...addressTextSx,
    color: "#64748b",
    fontStyle: "italic",
    fontWeight: 650,
};

const auditCellSx = {
    minWidth: 0,
};

const auditPrimarySx = {
    color: "#cbd5e1",
    fontSize: 11.5,
    fontWeight: 850,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
};

const sourceSeedChipSx = {
    height: 25,
    color: "#7dd3fc",
    background:
        "rgba(14,165,233,.12)",
    border:
        "1px solid rgba(14,165,233,.24)",
    fontWeight: 900,
    fontSize: 9.5,

    "& .MuiChip-icon": {
        color: "#38bdf8",
    },
};

const sourceManualChipSx = {
    height: 25,
    color: "#c4b5fd",
    background:
        "rgba(139,92,246,.12)",
    border:
        "1px solid rgba(139,92,246,.24)",
    fontWeight: 900,
    fontSize: 9.5,

    "& .MuiChip-icon": {
        color: "#a78bfa",
    },
};

const enabledChipSx = {
    height: 24,
    color: "#4ade80",
    background:
        "rgba(34,197,94,.12)",
    border:
        "1px solid rgba(34,197,94,.22)",
    fontWeight: 900,
    fontSize: 10,

    "& .MuiChip-icon": {
        color: "#4ade80",
    },
};

const disabledChipSx = {
    height: 24,
    color: "#fbbf24",
    background:
        "rgba(245,158,11,.12)",
    border:
        "1px solid rgba(245,158,11,.22)",
    fontWeight: 900,
    fontSize: 10,

    "& .MuiChip-icon": {
        color: "#fbbf24",
    },
};

const actionsSx = {
    display: "flex",
    gap: 0.7,
    alignItems: "center",
    flexWrap: "nowrap",

    "& .MuiButton-root": {
        minWidth: "auto",
        whiteSpace: "nowrap",
        fontSize: 11,
    },
};

const loadingSx = {
    minWidth: 1490,
    minHeight: 320,
    display: "grid",
    placeItems: "center",

    "& .MuiCircularProgress-root": {
        color: "#60a5fa",
    },
};

const emptyStateSx = {
    minWidth: 1490,
    p: 5,
    textAlign: "center",
    color: "#94a3b8",
    fontWeight: 750,
};

const paginationSx = {
    minWidth: 1250,
    p: 1.5,
    display: "flex",
    alignItems: "center",
    justifyContent:
        "space-between",
    gap: 2,
    flexWrap: "wrap",
    background:
        "rgba(2,6,23,.26)",
};

const pageSizeSx = {
    display: "flex",
    alignItems: "center",
    gap: 1,
};

const pageControlsSx = {
    display: "flex",
    alignItems: "center",
    gap: 1,
};

const pageChipSx = {
    color: "#cbd5e1",
    background:
        "rgba(255,255,255,.05)",
    border:
        "1px solid rgba(255,255,255,.08)",
    fontWeight: 850,
};

const pagerMiniButtonSx = {
    minWidth: 38,
    height: 34,
    borderRadius: "10px",
    px: 1,
    textTransform: "none",
    fontWeight: 900,
    color: "#cbd5e1",
    background:
        "rgba(255,255,255,.035)",
    border:
        "1px solid rgba(148,163,184,.12)",

    "&:hover": {
        background:
            "rgba(59,130,246,.12)",
        borderColor:
            "rgba(96,165,250,.24)",
    },
};

const mutedTextSx = {
    color: "#94a3b8",
    fontSize: 11.5,
    fontWeight: 750,
};

const primaryButtonSx = {
    minHeight: 36,
    borderRadius: "11px",
    px: 1.6,
    textTransform: "none",
    fontWeight: 850,
    color: "#fff",
    background:
        "linear-gradient(135deg,#2563eb,#3b82f6)",
    border:
        "1px solid rgba(59,130,246,.34)",
    boxShadow:
        "0 8px 20px rgba(37,99,235,.24)",

    "&:hover": {
        background:
            "linear-gradient(135deg,#1d4ed8,#2563eb)",
    },

    "&.Mui-disabled": {
        color:
            "rgba(255,255,255,.28)",
        background:
            "rgba(255,255,255,.04)",
    },
};

const secondaryButtonSx = {
    minHeight: 36,
    borderRadius: "11px",
    px: 1.5,
    textTransform: "none",
    fontWeight: 800,
    color: "#cbd5e1",
    background:
        "rgba(255,255,255,.04)",
    border:
        "1px solid rgba(255,255,255,.08)",

    "&:hover": {
        background:
            "rgba(59,130,246,.12)",
        borderColor:
            "rgba(59,130,246,.28)",
    },

    "&.Mui-disabled": {
        color:
            "rgba(255,255,255,.25)",
    },
};

const dangerOutlineButtonSx = {
    ...secondaryButtonSx,
    color: "#fca5a5",
    background:
        "rgba(239,68,68,.08)",
    border:
        "1px solid rgba(239,68,68,.18)",
};

const archiveButtonSx = {
    minHeight: 36,
    borderRadius: "11px",
    px: 1.4,
    textTransform: "none",
    fontWeight: 850,
    color: "#fbbf24",
    background:
        "rgba(245,158,11,.08)",
    border:
        "1px solid rgba(245,158,11,.18)",

    "&:hover": {
        background:
            "rgba(245,158,11,.14)",
        borderColor:
            "rgba(245,158,11,.30)",
    },
};

const reactivateButtonSx = {
    minHeight: 36,
    borderRadius: "11px",
    px: 1.4,
    textTransform: "none",
    fontWeight: 850,
    color: "#86efac",
    background:
        "rgba(34,197,94,.08)",
    border:
        "1px solid rgba(34,197,94,.18)",

    "&:hover": {
        background:
            "rgba(34,197,94,.14)",
        borderColor:
            "rgba(34,197,94,.30)",
    },
};

const fieldSx = {
    "& .MuiInputLabel-root": {
        color:
            "rgba(255,255,255,.55)",
        fontSize: 12,
        fontWeight: 750,
    },

    "& .MuiInputLabel-root.Mui-focused": {
        color: "#60a5fa",
    },

    "& .MuiOutlinedInput-root": {
        color: "#fff",
        background:
            "rgba(255,255,255,.04)",
        borderRadius: "13px",
        fontSize: 13,

        "& fieldset": {
            borderColor:
                "rgba(255,255,255,.08)",
        },

        "&:hover fieldset": {
            borderColor:
                "rgba(59,130,246,.36)",
        },

        "&.Mui-focused fieldset": {
            borderColor: "#3b82f6",
            boxShadow:
                "0 0 0 3px rgba(59,130,246,.10)",
        },
    },

    "& .MuiInputBase-input": {
        color: "#fff",
    },

    "& .MuiFormHelperText-root": {
        color: "#64748b",
    },

    "& .MuiSvgIcon-root": {
        color: "#94a3b8",
    },
};

const drawerPaperSx = {
    width: {
        xs: "100%",
        sm: 600,
        md: 680,
    },
    maxWidth: "100vw",
    background:
        "linear-gradient(180deg,#020617,#0f172a)",
    color: "#fff",
    borderLeft:
        "1px solid rgba(255,255,255,.08)",
    display: "flex",
    flexDirection: "column",
};

const drawerHeaderSx = {
    p: 2.5,
    display: "flex",
    justifyContent:
        "space-between",
    alignItems: "flex-start",
    gap: 2,
};

const drawerTitleSx = {
    fontSize: 24,
    fontWeight: 950,
};

const drawerSubSx = {
    mt: 0.5,
    color: "#64748b",
    fontSize: 12.5,
    fontWeight: 650,
};

const closeButtonSx = {
    minWidth: 38,
    width: 38,
    height: 38,
    borderRadius: "12px",
    color: "#cbd5e1",
    background:
        "rgba(255,255,255,.04)",
    border:
        "1px solid rgba(255,255,255,.08)",
};

const dividerSx = {
    borderColor:
        "rgba(255,255,255,.08)",
};

const drawerBodySx = {
    flex: 1,
    overflowY: "auto",
    p: 2.5,
    display: "flex",
    flexDirection: "column",
    gap: 2.2,
};

const drawerFooterSx = {
    p: 2,
    display: "grid",
    gridTemplateColumns:
        "1fr 1fr",
    gap: 1.2,
    borderTop:
        "1px solid rgba(255,255,255,.08)",
    background:
        "rgba(2,6,23,.65)",
};

const sectionSx = {
    display: "flex",
    flexDirection: "column",
    gap: 1.3,
};

const sectionTitleSx = {
    fontSize: 14,
    fontWeight: 950,
};

const sectionDescriptionSx = {
    mt: 0.4,
    color: "#64748b",
    fontSize: 11.5,
    fontWeight: 650,
    lineHeight: 1.5,
};

const permissionCardSx = {
    p: 1.5,
    borderRadius: "15px",
    display: "flex",
    alignItems: "center",
    justifyContent:
        "space-between",
    gap: 2,
    background:
        "rgba(255,255,255,.035)",
    border:
        "1px solid rgba(255,255,255,.07)",
};

const permissionTitleSx = {
    fontSize: 13,
    fontWeight: 900,
};

const permissionSubSx = {
    mt: 0.4,
    color: "#64748b",
    fontSize: 11,
    fontWeight: 650,
    lineHeight: 1.5,
};

const infoAlertSx = {
    borderRadius: "14px",
    background:
        "rgba(59,130,246,.08)",
    color: "#bfdbfe",
    border:
        "1px solid rgba(59,130,246,.18)",

    "& .MuiAlert-icon": {
        color: "#60a5fa",
    },
};

const errorAlertSx = {
    borderRadius: "14px",
    background:
        "rgba(239,68,68,.08)",
    border:
        "1px solid rgba(239,68,68,.18)",
    color: "#fecaca",
};

const dialogPaperSx = {
    minWidth: {
        xs:
            "calc(100vw - 32px)",
        sm: 440,
    },
    background:
        "linear-gradient(180deg,#0f172a,#111827)",
    color: "#fff",
    borderRadius: "20px",
    border:
        "1px solid rgba(255,255,255,.08)",
};

const dialogTextSx = {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 1.6,
};

const dialogActionsSx = {
    p: 2,
    gap: 1,
};
