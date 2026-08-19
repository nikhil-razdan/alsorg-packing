import {
    useCallback,
    useEffect,
    useMemo,
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
    FormControlLabel,
    IconButton,
    MenuItem,
    Snackbar,
    Switch,
    TextField,
    Typography,
} from "@mui/material";

import AppsIcon from "@mui/icons-material/Apps";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import SearchIcon from "@mui/icons-material/Search";

import { useNavigate } from "react-router-dom";
import API from "../services/api";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const EMPTY_FORM = {
    name: "",
    address: "",
    active: true,
};

const getApiMessage = (error, fallback) => {
    const payload = error?.response?.data;

    if (typeof payload === "string" && payload.trim()) {
        return payload;
    }

    return (
        payload?.message ||
        payload?.error ||
        error?.message ||
        fallback
    );
};

export default function ClientMasterPage() {
    const navigate = useNavigate();

    const [rows, setRows] = useState([]);
    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        inactive: 0,
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [status, setStatus] = useState("ALL");
    const [pageNo, setPageNo] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [totalElements, setTotalElements] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingRow, setEditingRow] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [formError, setFormError] = useState("");

    const [snackbar, setSnackbar] = useState({
        open: false,
        severity: "success",
        message: "",
    });

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearch(search.trim());
            setPageNo(1);
        }, 220);

        return () => window.clearTimeout(timer);
    }, [search]);

    const showMessage = useCallback((message, severity = "success") => {
        setSnackbar({
            open: true,
            severity,
            message,
        });
    }, []);

    const loadStats = useCallback(async () => {
        const response = await API.get("/client-master/stats");

        setStats({
            total: Number(response.data?.total || 0),
            active: Number(response.data?.active || 0),
            inactive: Number(response.data?.inactive || 0),
        });
    }, []);

    const loadRows = useCallback(async () => {
        setLoading(true);

        try {
            const response = await API.get("/client-master", {
                params: {
                    page: Math.max(0, pageNo - 1),
                    size: pageSize,
                    search: debouncedSearch,
                    status,
                },
            });

            const payload = response.data || {};
            const content = Array.isArray(payload.content)
                ? payload.content
                : [];

            setRows(content);
            setTotalElements(Number(payload.totalElements || 0));
            setTotalPages(Math.max(1, Number(payload.totalPages || 1)));

            if (pageNo > Math.max(1, Number(payload.totalPages || 1))) {
                setPageNo(Math.max(1, Number(payload.totalPages || 1)));
            }
        } catch (error) {
            setRows([]);
            setTotalElements(0);
            setTotalPages(1);
            showMessage(
                getApiMessage(error, "Failed to load Client Master"),
                "error"
            );
        } finally {
            setLoading(false);
        }
    }, [
        pageNo,
        pageSize,
        debouncedSearch,
        status,
        showMessage,
    ]);

    const refreshAll = useCallback(async () => {
        await Promise.allSettled([
            loadRows(),
            loadStats(),
        ]);
    }, [loadRows, loadStats]);

    useEffect(() => {
        refreshAll();
    }, [refreshAll]);

    const visibleStart =
        totalElements === 0
            ? 0
            : (pageNo - 1) * pageSize + 1;

    const visibleEnd = Math.min(
        totalElements,
        (pageNo - 1) * pageSize + rows.length
    );

    const title = useMemo(
        () => editingRow ? "Edit Client" : "Add Client",
        [editingRow]
    );

    const openCreate = () => {
        setEditingRow(null);
        setForm(EMPTY_FORM);
        setFormError("");
        setDialogOpen(true);
    };

    const openEdit = (row) => {
        setEditingRow(row);
        setForm({
            name: row?.name || "",
            address: row?.address || "",
            active: row?.active !== false,
        });
        setFormError("");
        setDialogOpen(true);
    };

    const saveClient = async () => {
        const cleanName = String(form.name || "").trim();

        if (!cleanName) {
            setFormError("Client name is required");
            return;
        }

        try {
            setSaving(true);
            setFormError("");

            const payload = {
                name: cleanName,
                address: String(form.address || "").trim(),
                active: form.active === true,
            };

            if (editingRow?.id) {
                await API.put(
                    `/client-master/${encodeURIComponent(editingRow.id)}`,
                    payload
                );
            } else {
                await API.post("/client-master", payload);
            }

            setDialogOpen(false);
            showMessage(
                editingRow
                    ? "Client updated successfully"
                    : "Client added successfully"
            );

            await refreshAll();
        } catch (error) {
            setFormError(
                getApiMessage(error, "Failed to save client")
            );
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (row) => {
        if (!row?.id) {
            return;
        }

        try {
            await API.patch(
                `/client-master/${encodeURIComponent(row.id)}/active`,
                null,
                {
                    params: {
                        active: row.active === false,
                    },
                }
            );

            showMessage(
                row.active === false
                    ? "Client reactivated"
                    : "Client archived"
            );

            await refreshAll();
        } catch (error) {
            showMessage(
                getApiMessage(error, "Failed to update client status"),
                "error"
            );
        }
    };

    return (
        <Box sx={pageSx}>
            <Box sx={topBarSx}>
                <Box sx={brandWrapSx}>
                    <Box sx={brandIconSx}>
                        <PeopleAltOutlinedIcon />
                    </Box>

                    <Box>
                        <Typography sx={eyebrowSx}>
                            FLOWSUITE SHARED MASTER DATA
                        </Typography>

                        <Typography sx={pageTitleSx}>
                            Client Master
                        </Typography>

                        <Typography sx={pageSubtitleSx}>
                            A reusable client directory for PackFlow search today and future
                            cross-module client integration.
                        </Typography>
                    </Box>
                </Box>

                <Box sx={topActionsSx}>
                    <Button
                        startIcon={<AppsIcon />}
                        onClick={() => navigate("/modules")}
                        sx={secondaryButtonSx}
                    >
                        Modules
                    </Button>

                    <Button
                        startIcon={<RefreshOutlinedIcon />}
                        onClick={refreshAll}
                        sx={secondaryButtonSx}
                    >
                        Refresh
                    </Button>

                    <Button
                        startIcon={<AddOutlinedIcon />}
                        onClick={openCreate}
                        sx={primaryButtonSx}
                    >
                        Add Client
                    </Button>
                </Box>
            </Box>

            <Box sx={statsGridSx}>
                <StatCard label="Total Clients" value={stats.total} accent="#60a5fa" />
                <StatCard label="Active" value={stats.active} accent="#34d399" />
                <StatCard label="Archived" value={stats.inactive} accent="#f59e0b" />
            </Box>

            <Box sx={panelSx}>
                <Box sx={filterBarSx}>
                    <TextField
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search client name or address"
                        fullWidth
                        sx={fieldSx}
                        InputProps={{
                            startAdornment: (
                                <SearchIcon
                                    sx={{
                                        mr: 1,
                                        color: "#64748b",
                                    }}
                                />
                            ),
                        }}
                    />

                    <TextField
                        select
                        label="Status"
                        value={status}
                        onChange={(event) => {
                            setStatus(event.target.value);
                            setPageNo(1);
                        }}
                        sx={{
                            ...fieldSx,
                            width: 190,
                            flexShrink: 0,
                        }}
                    >
                        <MenuItem value="ALL">All</MenuItem>
                        <MenuItem value="ACTIVE">Active</MenuItem>
                        <MenuItem value="INACTIVE">Archived</MenuItem>
                    </TextField>

                    <TextField
                        select
                        label="Rows"
                        value={pageSize}
                        onChange={(event) => {
                            setPageSize(Number(event.target.value));
                            setPageNo(1);
                        }}
                        sx={{
                            ...fieldSx,
                            width: 130,
                            flexShrink: 0,
                        }}
                    >
                        {PAGE_SIZE_OPTIONS.map((size) => (
                            <MenuItem key={size} value={size}>
                                {size}
                            </MenuItem>
                        ))}
                    </TextField>
                </Box>

                <Box sx={tableHeaderSx}>
                    <div>Client</div>
                    <div>Address</div>
                    <div>Source</div>
                    <div>Status</div>
                    <div>Updated</div>
                    <div>Actions</div>
                </Box>

                {loading ? (
                    <Box sx={loadingSx}>
                        <CircularProgress size={28} />
                        <span>Loading Client Master...</span>
                    </Box>
                ) : rows.length === 0 ? (
                    <Box sx={emptySx}>
                        No clients match the current filters.
                    </Box>
                ) : (
                    rows.map((row) => (
                        <Box key={row.id} sx={tableRowSx}>
                            <Box sx={clientNameSx}>
                                {row.name || "—"}
                            </Box>

                            <Box sx={addressSx}>
                                {row.address || "—"}
                            </Box>

                            <Box>
                                <Chip
                                    size="small"
                                    label={row.source || "MANUAL"}
                                    sx={sourceChipSx}
                                />
                            </Box>

                            <Box>
                                <Chip
                                    size="small"
                                    label={row.active === false ? "Archived" : "Active"}
                                    sx={row.active === false ? inactiveChipSx : activeChipSx}
                                />
                            </Box>

                            <Box sx={mutedSx}>
                                {formatDateTime(row.updatedAt || row.createdAt)}
                            </Box>

                            <Box sx={rowActionsSx}>
                                <IconButton
                                    onClick={() => openEdit(row)}
                                    sx={iconButtonSx}
                                    aria-label="Edit client"
                                >
                                    <EditOutlinedIcon fontSize="small" />
                                </IconButton>

                                <Button
                                    size="small"
                                    onClick={() => toggleActive(row)}
                                    sx={row.active === false ? reactivateButtonSx : archiveButtonSx}
                                >
                                    {row.active === false ? "Reactivate" : "Archive"}
                                </Button>
                            </Box>
                        </Box>
                    ))
                )}

                <Box sx={paginationSx}>
                    <Typography sx={paginationTextSx}>
                        Showing {visibleStart}-{visibleEnd} of {totalElements}
                    </Typography>

                    <Box sx={paginationActionsSx}>
                        <Button
                            disabled={pageNo <= 1 || loading}
                            onClick={() => setPageNo((previous) => Math.max(1, previous - 1))}
                            sx={secondaryButtonSx}
                        >
                            Previous
                        </Button>

                        <Typography sx={paginationTextSx}>
                            Page <b>{pageNo}</b> of <b>{totalPages}</b>
                        </Typography>

                        <Button
                            disabled={pageNo >= totalPages || loading}
                            onClick={() => setPageNo((previous) => Math.min(totalPages, previous + 1))}
                            sx={secondaryButtonSx}
                        >
                            Next
                        </Button>
                    </Box>
                </Box>
            </Box>

            <Alert severity="info" sx={infoSx}>
                PackFlow client fields remain free-text. The suggestion list only appears
                after typing at least two characters, so the full master list is never
                dumped into the packing form.
            </Alert>

            <Dialog
                open={dialogOpen}
                onClose={() => !saving && setDialogOpen(false)}
                fullWidth
                maxWidth="sm"
                PaperProps={{ sx: dialogPaperSx }}
            >
                <DialogTitle sx={dialogTitleSx}>{title}</DialogTitle>

                <DialogContent sx={dialogContentSx}>
                    {formError && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {formError}
                        </Alert>
                    )}

                    <TextField
                        label="Client Name"
                        value={form.name}
                        onChange={(event) =>
                            setForm((previous) => ({
                                ...previous,
                                name: event.target.value,
                            }))
                        }
                        fullWidth
                        autoFocus
                        sx={fieldSx}
                    />

                    <TextField
                        label="Address"
                        value={form.address}
                        onChange={(event) =>
                            setForm((previous) => ({
                                ...previous,
                                address: event.target.value,
                            }))
                        }
                        fullWidth
                        multiline
                        minRows={3}
                        sx={fieldSx}
                        helperText="Optional. The uploaded client XLSX contains names only, so seeded records start without an address."
                    />

                    <FormControlLabel
                        control={
                            <Switch
                                checked={form.active === true}
                                onChange={(event) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        active: event.target.checked,
                                    }))
                                }
                            />
                        }
                        label="Active client"
                        sx={{ color: "#cbd5e1" }}
                    />
                </DialogContent>

                <DialogActions sx={dialogActionsSx}>
                    <Button
                        disabled={saving}
                        onClick={() => setDialogOpen(false)}
                        sx={secondaryButtonSx}
                    >
                        Cancel
                    </Button>

                    <Button
                        disabled={saving}
                        onClick={saveClient}
                        sx={primaryButtonSx}
                    >
                        {saving ? "Saving..." : "Save Client"}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4200}
                onClose={() =>
                    setSnackbar((previous) => ({
                        ...previous,
                        open: false,
                    }))
                }
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            >
                <Alert
                    severity={snackbar.severity}
                    variant="filled"
                    onClose={() =>
                        setSnackbar((previous) => ({
                            ...previous,
                            open: false,
                        }))
                    }
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}

function StatCard({ label, value, accent }) {
    return (
        <Box sx={statCardSx(accent)}>
            <Typography sx={statValueSx}>{value}</Typography>
            <Typography sx={statLabelSx}>{label}</Typography>
        </Box>
    );
}

function formatDateTime(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
    }).format(date);
}

const pageSx = {
    minHeight: "100vh",
    p: { xs: 2, md: 3.5 },
    color: "#fff",
    fontFamily: "Inter, system-ui, sans-serif",
    background:
        "radial-gradient(circle at top left, rgba(59,130,246,.12), transparent 24%), linear-gradient(135deg,#020617,#0f172a 50%,#111827)",
};

const topBarSx = {
    display: "flex",
    alignItems: { xs: "flex-start", md: "center" },
    justifyContent: "space-between",
    flexDirection: { xs: "column", md: "row" },
    gap: 2.5,
    maxWidth: 1440,
    mx: "auto",
    mb: 3,
};

const brandWrapSx = {
    display: "flex",
    gap: 2,
    alignItems: "flex-start",
};

const brandIconSx = {
    width: 56,
    height: 56,
    borderRadius: "18px",
    display: "grid",
    placeItems: "center",
    color: "#bfdbfe",
    background: "rgba(37,99,235,.18)",
    border: "1px solid rgba(96,165,250,.22)",
};

const eyebrowSx = {
    color: "#60a5fa",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.5,
};

const pageTitleSx = {
    mt: 0.6,
    fontSize: { xs: 32, md: 42 },
    fontWeight: 950,
    letterSpacing: "-.045em",
};

const pageSubtitleSx = {
    mt: 0.8,
    maxWidth: 720,
    color: "#94a3b8",
    lineHeight: 1.65,
};

const topActionsSx = {
    display: "flex",
    flexWrap: "wrap",
    gap: 1,
};

const statsGridSx = {
    maxWidth: 1440,
    mx: "auto",
    mb: 2.5,
    display: "grid",
    gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
    gap: 1.5,
};

const statCardSx = (accent) => ({
    p: 2.2,
    borderRadius: "18px",
    background: "rgba(15,23,42,.80)",
    border: `1px solid ${accent}33`,
    boxShadow: "0 18px 50px rgba(2,6,23,.28)",
});

const statValueSx = {
    fontSize: 30,
    fontWeight: 950,
};

const statLabelSx = {
    mt: 0.3,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0.8,
};

const panelSx = {
    maxWidth: 1440,
    mx: "auto",
    borderRadius: "22px",
    overflow: "hidden",
    background: "rgba(15,23,42,.88)",
    border: "1px solid rgba(148,163,184,.12)",
    boxShadow: "0 24px 70px rgba(2,6,23,.38)",
};

const filterBarSx = {
    p: 2,
    display: "flex",
    flexDirection: { xs: "column", md: "row" },
    gap: 1.2,
    borderBottom: "1px solid rgba(148,163,184,.10)",
};

const fieldSx = {
    "& .MuiInputLabel-root": { color: "#94a3b8" },
    "& .MuiInputLabel-root.Mui-focused": { color: "#60a5fa" },
    "& .MuiOutlinedInput-root": {
        color: "#fff",
        background: "rgba(2,6,23,.32)",
        borderRadius: "14px",
        "& fieldset": { borderColor: "rgba(148,163,184,.16)" },
        "&:hover fieldset": { borderColor: "rgba(96,165,250,.34)" },
        "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
    },
    "& .MuiFormHelperText-root": { color: "#64748b" },
    "& .MuiSvgIcon-root": { color: "#94a3b8" },
};

const tableHeaderSx = {
    display: "grid",
    gridTemplateColumns: "minmax(220px,1.2fr) minmax(280px,1.6fr) 150px 120px 190px 210px",
    minWidth: 1170,
    px: 2,
    py: 1.4,
    color: "#64748b",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    background: "rgba(2,6,23,.38)",
};

const tableRowSx = {
    display: "grid",
    gridTemplateColumns: "minmax(220px,1.2fr) minmax(280px,1.6fr) 150px 120px 190px 210px",
    minWidth: 1170,
    px: 2,
    py: 1.45,
    alignItems: "center",
    borderTop: "1px solid rgba(148,163,184,.08)",
    "&:hover": { background: "rgba(59,130,246,.045)" },
};

const clientNameSx = {
    pr: 2,
    color: "#f8fafc",
    fontWeight: 850,
    overflowWrap: "anywhere",
};

const addressSx = {
    pr: 2,
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 1.5,
    overflowWrap: "anywhere",
};

const mutedSx = {
    color: "#94a3b8",
    fontSize: 12,
};

const sourceChipSx = {
    color: "#93c5fd",
    background: "rgba(37,99,235,.12)",
    border: "1px solid rgba(96,165,250,.16)",
    fontWeight: 800,
};

const activeChipSx = {
    color: "#6ee7b7",
    background: "rgba(16,185,129,.12)",
    border: "1px solid rgba(52,211,153,.16)",
    fontWeight: 850,
};

const inactiveChipSx = {
    color: "#fbbf24",
    background: "rgba(245,158,11,.12)",
    border: "1px solid rgba(251,191,36,.16)",
    fontWeight: 850,
};

const rowActionsSx = {
    display: "flex",
    gap: 0.8,
    alignItems: "center",
};

const iconButtonSx = {
    color: "#93c5fd",
    background: "rgba(37,99,235,.10)",
    border: "1px solid rgba(96,165,250,.14)",
};

const archiveButtonSx = {
    color: "#fbbf24",
    textTransform: "none",
    fontWeight: 850,
    borderRadius: "10px",
    background: "rgba(245,158,11,.10)",
};

const reactivateButtonSx = {
    color: "#6ee7b7",
    textTransform: "none",
    fontWeight: 850,
    borderRadius: "10px",
    background: "rgba(16,185,129,.10)",
};

const loadingSx = {
    minHeight: 260,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 1.5,
    color: "#94a3b8",
};

const emptySx = {
    minHeight: 220,
    display: "grid",
    placeItems: "center",
    color: "#64748b",
};

const paginationSx = {
    p: 2,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 1.2,
    borderTop: "1px solid rgba(148,163,184,.10)",
};

const paginationActionsSx = {
    display: "flex",
    alignItems: "center",
    gap: 1,
};

const paginationTextSx = {
    color: "#94a3b8",
    fontSize: 12,
};

const primaryButtonSx = {
    px: 2,
    py: 1,
    borderRadius: "12px",
    textTransform: "none",
    fontWeight: 900,
    color: "#fff",
    background: "linear-gradient(135deg,#2563eb,#3b82f6)",
    "&:hover": { background: "linear-gradient(135deg,#1d4ed8,#2563eb)" },
};

const secondaryButtonSx = {
    px: 1.8,
    py: 0.9,
    borderRadius: "12px",
    textTransform: "none",
    fontWeight: 850,
    color: "#cbd5e1",
    border: "1px solid rgba(148,163,184,.14)",
    background: "rgba(255,255,255,.035)",
    "&:hover": { background: "rgba(59,130,246,.10)" },
};

const infoSx = {
    maxWidth: 1440,
    mx: "auto",
    mt: 2,
    borderRadius: "14px",
    color: "#bfdbfe",
    background: "rgba(37,99,235,.08)",
    border: "1px solid rgba(96,165,250,.12)",
};

const dialogPaperSx = {
    color: "#fff",
    borderRadius: "20px",
    background: "linear-gradient(180deg,#111827,#0f172a)",
    border: "1px solid rgba(148,163,184,.14)",
};

const dialogTitleSx = {
    fontWeight: 950,
};

const dialogContentSx = {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    pt: "10px !important",
};

const dialogActionsSx = {
    p: 2.5,
};
