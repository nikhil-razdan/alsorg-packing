import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Box,
    Button,
    CircularProgress,
    Divider,
    MenuItem,
    ScopedCssBaseline,
    TextField,
    ThemeProvider,
    Typography,
    createTheme,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import ViewKanbanOutlinedIcon from "@mui/icons-material/ViewKanbanOutlined";
import ViewListOutlinedIcon from "@mui/icons-material/ViewListOutlined";
import { useNavigate, useSearchParams } from "react-router-dom";

import { extractMatFlowPage, matflowApi, readMatFlowError } from "../api/matflowApi";
import { downloadMatFlowExcel } from "../api/matflowExcel";
import { clean, normalize, numeric, readable, useMatFlow } from "../matflowUi";

const C = Object.freeze({
    page: "#ffffff",
    shell: "#fbfcfe",
    text: "#172033",
    muted: "#65748b",
    faint: "#8b98aa",
    border: "#dfe5ec",
    borderStrong: "#cfd7e1",
    primary: "#0868b7",
    primaryDark: "#0d4e80",
    primarySoft: "#eef6fc",
    rowHover: "#f7fafc",
    selected: "#eaf4fb",
    success: "#13824b",
    warning: "#c97900",
    danger: "#d92d32",
    dot: "#24364a",
});

const managementTheme = createTheme({
    palette: {
        mode: "light",
        primary: { main: C.primary },
        background: { default: C.page, paper: C.page },
        text: { primary: C.text, secondary: C.muted },
        divider: C.border,
        success: { main: C.success },
        warning: { main: C.warning },
        error: { main: C.danger },
    },
    typography: {
        fontFamily: 'Inter, "Segoe UI", Roboto, Arial, sans-serif',
        button: { textTransform: "none", fontWeight: 700 },
    },
    shape: { borderRadius: 6 },
    components: {
        MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: {
                root: {
                    minHeight: 36,
                    borderRadius: 5,
                    textTransform: "none",
                    fontSize: 14,
                    fontWeight: 700,
                },
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    borderRadius: 5,
                    background: "#fff",
                    fontSize: 14,
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: C.borderStrong },
                    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#b6c2d1" },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: C.primary, borderWidth: 1 },
                },
            },
        },
        MuiMenuItem: {
            styleOverrides: {
                root: { minHeight: 34, fontSize: 14 },
            },
        },
    },
});

const NAV_TABS = [
    ["overview", "Overview"],
    ["operations", "Operations"],
    ["projects", "Projects"],
    ["materials", "Materials"],
];

const STAGE_COLUMNS = [
    { key: "DEMAND", label: "Production MR" },
    { key: "STORE", label: "Store" },
    { key: "PURCHASE", label: "Purchase" },
    { key: "QC", label: "QC" },
    { key: "PROCESSING", label: "Processing" },
    { key: "PRODUCTION", label: "Production" },
];

const COMPLETED_STAGES = new Set(["PRODUCTION_COMPLETED", "COMPLETED", "CANCELLED"]);

const upper = (value) => clean(value).toUpperCase();

const parseDateOnly = (value) => {
    const raw = clean(value);
    if (!raw) return null;
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (value = new Date()) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

const calendarDeltaDays = (value) => {
    const date = parseDateOnly(value);
    if (!date) return null;
    return Math.round((startOfDay(date).getTime() - startOfDay().getTime()) / 86400000);
};

const formatShortDate = (value) => {
    const date = parseDateOnly(value);
    if (!date) return "—";
    return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(date);
};

const dueLabel = (value) => {
    const days = calendarDeltaDays(value);
    if (days == null) return { label: "No due date", tone: "muted", days: null };
    if (days < 0) return { label: `${Math.abs(days)}d overdue`, tone: "danger", days };
    if (days === 0) return { label: "Today", tone: "warning", days };
    if (days === 1) return { label: "Tomorrow", tone: "default", days };
    return { label: formatShortDate(value), tone: days <= 7 ? "warning" : "default", days };
};

const toneColor = (tone) => ({
    danger: C.danger,
    warning: C.warning,
    success: C.success,
    muted: C.muted,
    default: C.text,
    primary: C.primary,
}[tone] || C.text);

const stageBucket = (stage) => {
    switch (normalize(stage)) {
        case "DRAFT":
            return "DEMAND";
        case "ORIGIN_STORE_FORWARDING":
        case "AWAITING_MAIN_STORE_PLANNING":
        case "AWAITING_STORE_PLANNING":
        case "SUBMITTED_TO_STORE":
        case "STORE_REVIEW_IN_PROGRESS":
        case "PARTIALLY_RESERVED":
        case "MATERIAL_RESERVED":
        case "READY_TO_ISSUE":
        case "PARTIALLY_ISSUED":
            return "STORE";
        case "SHORTAGE_PENDING":
        case "PURCHASE_IN_PROGRESS":
        case "PO_CREATED":
        case "PARTIALLY_RECEIVED":
            return "PURCHASE";
        case "QC_PENDING":
        case "QC_ROUTING_PENDING":
            return "QC";
        case "PROCESSING":
            return "PROCESSING";
        case "TRANSFER_IN_PROGRESS":
        case "MATERIAL_IN_TRANSIT":
        case "PRODUCTION_ISSUE":
        case "ISSUED_TO_PRODUCTION":
        case "PRODUCTION_STARTED":
        case "PRODUCTION_IN_PROGRESS":
            return "PRODUCTION";
        case "PRODUCTION_COMPLETED":
        case "COMPLETED":
            return "COMPLETE";
        default:
            return "DEMAND";
    }
};

const ownerForRow = (row) => {
    const direct = clean(row?.currentDepartment || row?.responsibleDesk);
    if (direct) return readable(direct);
    return ({
        DEMAND: "Production",
        STORE: "Store",
        PURCHASE: "Purchase",
        QC: "QC",
        PROCESSING: "Processing",
        PRODUCTION: "Production",
        COMPLETE: "Complete",
    })[stageBucket(row?.currentStage)] || "Workflow";
};

const nextActionForRow = (row) => {
    const id = row?.requisitionId;
    const bucket = stageBucket(row?.currentStage);
    if (bucket === "STORE") {
        return { label: numeric(row?.shortageQty) > 0 ? "Review stock" : "Release material", path: id ? `/matflow/store/requisitions/${id}` : "/matflow/store" };
    }
    if (bucket === "PURCHASE") return { label: "Confirm supply", path: "/matflow/purchase" };
    if (bucket === "QC") return { label: "Complete QC review", path: "/matflow/qc" };
    if (bucket === "PROCESSING") return { label: "Open processing", path: "/matflow/processing" };
    if (bucket === "PRODUCTION") return { label: "Open production", path: "/matflow/production-execution" };
    return { label: "Review MR", path: id ? `/matflow/requisitions/${id}` : "/matflow/production" };
};

const rowPriority = (row) => {
    const due = dueLabel(row?.requiredDate);
    const timing = normalize(row?.timingHealth);
    return (due.days != null && due.days < 0 ? 50 : 0)
        + (timing === "BREACHED" || timing === "COMPLETED_LATE" ? 35 : timing === "WATCH" ? 18 : 0)
        + (numeric(row?.shortageQty) > 0 ? 25 : 0)
        + (due.days != null && due.days >= 0 && due.days <= 2 ? 15 : 0)
        + Math.min(10, numeric(row?.ageHours) / 24);
};

const rowNeedsAction = (row) => {
    const due = dueLabel(row?.requiredDate);
    const timing = normalize(row?.timingHealth);
    return numeric(row?.shortageQty) > 0
        || ["BREACHED", "COMPLETED_LATE", "WATCH"].includes(timing)
        || (due.days != null && due.days <= 1)
        || ["STORE", "PURCHASE", "QC"].includes(stageBucket(row?.currentStage));
};

const projectStatus = (project, rows) => {
    const due = dueLabel(project?.requiredDate);
    const materialReady = rows.length
        ? rows.reduce((sum, row) => sum + Math.max(0, Math.min(100, numeric(row?.materialReadyPercent))), 0) / rows.length
        : null;
    const shortage = rows.some((row) => numeric(row?.shortageQty) > 0);
    const stageRisk = rows.some((row) => ["BREACHED", "COMPLETED_LATE", "WATCH"].includes(normalize(row?.timingHealth)));
    if (due.days != null && due.days < 0) return { key: "OVERDUE", label: "Overdue", tone: "danger" };
    if (shortage || stageRisk || (due.days != null && due.days <= 7) || (materialReady != null && materialReady < 70)) {
        return { key: "AT_RISK", label: "At risk", tone: "warning" };
    }
    return { key: "ON_TRACK", label: "On track", tone: "success" };
};

const materialLineShortage = (line) => {
    if (line?.shortageQty != null) return Math.max(0, numeric(line.shortageQty));
    if (line?.requestedQty != null && line?.reservedQty != null) {
        return Math.max(0, numeric(line.requestedQty) - numeric(line.reservedQty));
    }
    return 0;
};

const saveBlob = (blob, fileName) => {
    if (!(blob instanceof Blob) || !blob.size) throw new Error("The attachment is empty.");
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
};

function StatusText({ status }) {
    const tone = status?.tone || "default";
    return (
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: .7, color: toneColor(tone), fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "currentColor", flex: "0 0 auto" }} />
            {status?.label || "—"}
        </Box>
    );
}

function HeaderSearch({ value, onChange, placeholder, sx = {} }) {
    return (
        <Box sx={{ position: "relative", minWidth: 0, ...sx }}>
            <SearchOutlinedIcon sx={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.muted, fontSize: 21, zIndex: 2 }} />
            <TextField
                fullWidth
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                inputProps={{ "aria-label": placeholder }}
                sx={{
                    "& .MuiOutlinedInput-root": { height: 48, pl: 4.2 },
                    "& input": { py: 1.15, fontSize: 15 },
                }}
            />
        </Box>
    );
}

function PlantSelect() {
    return null;
}

function ManagementDashboardFrame({ view, onViewChange, children }) {
    return (
        <ThemeProvider theme={managementTheme}>
            <ScopedCssBaseline>
                <Box
                    sx={{
                        width: "100%",
                        minHeight: "calc(100vh - 128px)",
                        bgcolor: C.page,
                        color: C.text,
                        border: `1px solid ${C.border}`,
                        borderRadius: 1.4,
                        overflow: "hidden",
                        boxShadow: "0 1px 2px rgba(15,23,42,.03)",
                    }}
                >
                    <Box
                        sx={{
                            minHeight: 56,
                            px: { xs: 1.25, md: 2.25 },
                            display: "flex",
                            alignItems: "stretch",
                            borderBottom: `1px solid ${C.border}`,
                            bgcolor: "#fff",
                            overflowX: "auto",
                        }}
                    >
                        <Box component="nav" sx={{ display: "flex", alignItems: "stretch", gap: { xs: .4, md: 1.1 } }}>
                            {NAV_TABS.map(([key, label]) => {
                                const active = view === key || (view === "work" && key === "overview");
                                return (
                                    <Button
                                        key={key}
                                        onClick={() => onViewChange(key)}
                                        sx={{
                                            minWidth: { xs: 88, md: 104 },
                                            px: { xs: 1, md: 1.4 },
                                            borderRadius: 0,
                                            color: active ? C.primaryDark : C.text,
                                            fontSize: { xs: 13.5, md: 15 },
                                            fontWeight: active ? 800 : 550,
                                            borderBottom: active ? `3px solid ${C.primary}` : "3px solid transparent",
                                            "&:hover": { bgcolor: "transparent", color: C.primaryDark },
                                        }}
                                    >
                                        {label}
                                    </Button>
                                );
                            })}
                        </Box>
                    </Box>

                    <Box
                        component="main"
                        sx={{
                            width: "100%",
                            px: { xs: 1.5, md: 2.5, xl: 3 },
                            py: { xs: 2, md: 2.7 },
                            bgcolor: C.page,
                        }}
                    >
                        {children}
                    </Box>
                </Box>
            </ScopedCssBaseline>
        </ThemeProvider>
    );
}

function PageHeading({ title, subtitle = null, right = null }) {
    return (
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, alignItems: { xs: "flex-start", sm: "center" }, flexWrap: "wrap", mb: 3 }}>
            <Box>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.2, flexWrap: "wrap" }}>
                    <Typography component="h1" sx={{ fontSize: { xs: 30, md: 40 }, fontWeight: 800, letterSpacing: "-.035em", lineHeight: 1.08 }}>{title}</Typography>
                    {subtitle && <Typography sx={{ color: C.muted, fontSize: { xs: 15, md: 18 }, fontWeight: 500 }}>{subtitle}</Typography>}
                </Box>
            </Box>
            {right && <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>{right}</Box>}
        </Box>
    );
}

function ThinButton({ children, onClick, startIcon = null, endIcon = null, disabled = false, sx = {} }) {
    return (
        <Button
            variant="outlined"
            startIcon={startIcon}
            endIcon={endIcon}
            onClick={onClick}
            disabled={disabled}
            sx={{ borderColor: C.borderStrong, color: C.text, bgcolor: "#fff", px: 1.6, "&:hover": { borderColor: "#aebaca", bgcolor: C.rowHover }, ...sx }}
        >
            {children}
        </Button>
    );
}

function LinkAction({ children, onClick, tone = "primary", endIcon = <ArrowForwardIcon sx={{ fontSize: 18 }} /> }) {
    return (
        <Button
            onClick={onClick}
            endIcon={endIcon}
            sx={{ p: 0, minHeight: 0, minWidth: 0, color: toneColor(tone), fontSize: 14, fontWeight: 650, justifyContent: "flex-start", "&:hover": { bgcolor: "transparent", textDecoration: "underline" } }}
        >
            {children}
        </Button>
    );
}

function EmptyLine({ children = "No records in this view." }) {
    return <Box sx={{ py: 5, px: 2, textAlign: "center", color: C.muted, borderBottom: `1px solid ${C.border}` }}>{children}</Box>;
}

function KpiRail({ items }) {
    return (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: `repeat(${Math.min(3, items.length)}, minmax(0,1fr))` }, borderBottom: `1px solid ${C.border}`, pb: 3.2, mb: 3.3 }}>
            {items.map((item, index) => (
                <Box
                    key={item.label}
                    onClick={item.onClick}
                    role={item.onClick ? "button" : undefined}
                    tabIndex={item.onClick ? 0 : undefined}
                    sx={{
                        px: { xs: 0, sm: index === 0 ? 0 : 4 },
                        py: { xs: 1.2, sm: 0 },
                        borderLeft: { xs: "none", sm: index === 0 ? "none" : `1px solid ${C.border}` },
                        cursor: item.onClick ? "pointer" : "default",
                    }}
                >
                    <Typography sx={{ fontSize: 39, fontWeight: 760, lineHeight: 1 }}>{item.value}</Typography>
                    <Typography sx={{ mt: .7, fontSize: 17, color: C.text }}>{item.label}</Typography>
                </Box>
            ))}
        </Box>
    );
}

const tableHeaderSx = (columns) => ({
    display: "grid",
    gridTemplateColumns: columns,
    alignItems: "center",
    minHeight: 50,
    bgcolor: "#f4f6f8",
    borderBottom: `1px solid ${C.border}`,
    color: "#394a61",
    fontSize: 13,
    fontWeight: 700,
});

const tableRowSx = (columns, selected = false) => ({
    display: "grid",
    gridTemplateColumns: columns,
    alignItems: "center",
    minHeight: 73,
    borderBottom: `1px solid ${C.border}`,
    bgcolor: selected ? C.selected : "#fff",
    "&:hover": { bgcolor: selected ? C.selected : C.rowHover },
});

const cellSx = { px: 2, py: 1.2, minWidth: 0 };

function LoadingView() {
    return (
        <Box sx={{ minHeight: 360, display: "grid", placeItems: "center" }}>
            <Box sx={{ textAlign: "center" }}>
                <CircularProgress size={30} />
                <Typography sx={{ mt: 1.2, color: C.muted, fontSize: 14 }}>Loading MatFlow…</Typography>
            </Box>
        </Box>
    );
}

function ErrorBanner({ error }) {
    if (!error) return null;
    return (
        <Box sx={{ border: "1px solid #f1c7c9", bgcolor: "#fff5f5", color: C.danger, px: 1.5, py: 1.1, mb: 2, borderRadius: 1, fontSize: 13.5, fontWeight: 600 }}>
            {error}
        </Box>
    );
}

function DueText({ value }) {
    const due = dueLabel(value);
    return <Typography sx={{ color: toneColor(due.tone), fontSize: 14, fontWeight: due.tone === "danger" || due.tone === "warning" ? 650 : 500 }}>{due.label}</Typography>;
}

function OverviewView({ activeRows, projects, needsActionRows, lastUpdated, onRefresh, refreshing, onViewChange, navigate }) {
    const [search, setSearch] = useState("");
    const activeWork = useMemo(() => {
        const term = clean(search).toLowerCase();
        return [...activeRows]
            .filter((row) => !term || [row.projectCode, row.projectName, row.productName, row.drawingNo, row.requisitionNumber, ownerForRow(row)].some((value) => clean(value).toLowerCase().includes(term)))
            .sort((a, b) => rowPriority(b) - rowPriority(a))
            .slice(0, 5);
    }, [activeRows, search]);

    return (
        <>
            <PageHeading
                title="Overview"
                right={
                    <>
                        <PlantSelect />
                        <ThinButton onClick={onRefresh} disabled={refreshing} startIcon={<RefreshOutlinedIcon />}>Updated {lastUpdated || "—"}</ThinButton>
                    </>
                }
            />

            <KpiRail items={[
                { label: "Active projects", value: projects.length, onClick: () => onViewChange("projects") },
                { label: "Open MRs", value: activeRows.length, onClick: () => onViewChange("operations") },
                { label: "Need action", value: needsActionRows.length, onClick: () => onViewChange("work") },
            ]} />

            <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1.5, alignItems: "center", flexWrap: "wrap", mb: 1.5 }}>
                <Typography sx={{ fontSize: 25, fontWeight: 760, letterSpacing: "-.025em" }}>Active work</Typography>
                <Box sx={{ display: "flex", gap: 1, alignItems: "center", flex: "0 1 500px" }}>
                    <HeaderSearch value={search} onChange={setSearch} placeholder="Find project or MR" sx={{ flex: 1 }} />
                    <ThinButton startIcon={<FilterAltOutlinedIcon />}>Filter</ThinButton>
                </Box>
            </Box>

            <Box sx={{ overflowX: "auto" }}>
                <Box sx={{ minWidth: 860 }}>
                    <Box sx={tableHeaderSx("minmax(300px,1.35fr) minmax(180px,.8fr) 160px minmax(210px,.8fr)")}> 
                        {[
                            "Project / product",
                            "Owner",
                            "Due",
                            "Next action",
                        ].map((heading) => <Box key={heading} sx={cellSx}>{heading}</Box>)}
                    </Box>
                    {activeWork.length === 0 ? <EmptyLine>No active work matches this view.</EmptyLine> : activeWork.map((row) => {
                        const action = nextActionForRow(row);
                        const overdue = dueLabel(row.requiredDate).tone === "danger";
                        return (
                            <Box key={row.requisitionId || row.requisitionNumber} sx={tableRowSx("minmax(300px,1.35fr) minmax(180px,.8fr) 160px minmax(210px,.8fr)")}> 
                                <Box sx={cellSx}>
                                    <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{row.projectCode || "—"} · {row.projectName || "Project"}</Typography>
                                    <Typography sx={{ color: C.muted, fontSize: 13.5, mt: .15 }}>{row.productName || row.drawingNo || "Product"} · {row.requisitionNumber || "MR"}</Typography>
                                </Box>
                                <Box sx={cellSx}><Typography sx={{ fontSize: 14.5 }}>{ownerForRow(row)} · {row.productionPlantCode || row.plantCode || "—"}</Typography></Box>
                                <Box sx={cellSx}><DueText value={row.requiredDate} /></Box>
                                <Box sx={cellSx}><LinkAction tone={overdue ? "danger" : stageBucket(row.currentStage) === "PRODUCTION" ? "success" : "primary"} onClick={() => navigate(action.path)}>{action.label}</LinkAction></Box>
                            </Box>
                        );
                    })}
                </Box>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1.5, color: C.muted, fontSize: 13 }}>
                <Typography sx={{ color: C.muted, fontSize: 13 }}>Showing {activeWork.length} of {activeRows.length} open MRs</Typography>
                <LinkAction onClick={() => onViewChange("work")}>View all work</LinkAction>
            </Box>
        </>
    );
}

function OperationsCard({ row, onOpen }) {
    const action = nextActionForRow(row);
    const due = dueLabel(row.requiredDate);
    return (
        <Box sx={{ border: `1px solid ${C.borderStrong}`, borderRadius: 1, p: 2, bgcolor: "#fff", minHeight: 177, display: "flex", flexDirection: "column" }}>
            <Typography sx={{ fontSize: 16, fontWeight: 750 }}>{row.projectName || row.projectCode || "Project"}</Typography>
            <Typography sx={{ color: C.muted, fontSize: 13.5, mt: .5 }}>{row.productName || row.drawingNo || "Product"} · {row.requisitionNumber || "MR"}</Typography>
            <Typography sx={{ color: C.muted, fontSize: 13.5, mt: .35 }}>{ownerForRow(row)} · {row.productionPlantCode || "—"}</Typography>
            <Box sx={{ mt: "auto", pt: 2, display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center" }}>
                <Typography sx={{ color: toneColor(due.tone), fontSize: 14, fontWeight: due.tone === "danger" || due.tone === "warning" ? 700 : 500 }}>{due.label}</Typography>
                <LinkAction tone={due.tone === "danger" ? "danger" : stageBucket(row.currentStage) === "PRODUCTION" ? "success" : "primary"} onClick={() => onOpen(action.path)}>{action.label}</LinkAction>
            </Box>
        </Box>
    );
}

function OperationsView({ activeRows, allRows, navigate }) {
    const [search, setSearch] = useState("");
    const [stageFilter, setStageFilter] = useState("ALL");
    const [mode, setMode] = useState("BOARD");
    const filtered = useMemo(() => {
        const term = clean(search).toLowerCase();
        return activeRows.filter((row) => {
            const bucket = stageBucket(row.currentStage);
            if (stageFilter !== "ALL" && bucket !== stageFilter) return false;
            if (!term) return true;
            return [row.projectCode, row.projectName, row.productName, row.drawingNo, row.requisitionNumber, ownerForRow(row)].some((value) => clean(value).toLowerCase().includes(term));
        });
    }, [activeRows, search, stageFilter]);

    const counts = useMemo(() => Object.fromEntries(STAGE_COLUMNS.map((column) => [column.key, filtered.filter((row) => stageBucket(row.currentStage) === column.key).length])), [filtered]);
    const visibleColumns = STAGE_COLUMNS.filter((column) => counts[column.key] > 0 || ["DEMAND", "STORE", "PURCHASE", "PRODUCTION"].includes(column.key));

    return (
        <>
            <PageHeading title="Operations" subtitle={`${activeRows.length} open MRs`} right={<PlantSelect />} />

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(320px,1fr) 150px auto" }, gap: 1.4, alignItems: "center", mb: 3 }}>
                <HeaderSearch value={search} onChange={setSearch} placeholder="Find project, product or MR" />
                <TextField select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)} inputProps={{ "aria-label": "Stages" }} sx={{ "& .MuiOutlinedInput-root": { height: 48 } }}>
                    <MenuItem value="ALL">Stages</MenuItem>
                    {STAGE_COLUMNS.map((column) => <MenuItem key={column.key} value={column.key}>{column.label}</MenuItem>)}
                </TextField>
                <Box sx={{ display: "flex", justifyContent: { xs: "flex-start", md: "flex-end" }, gap: 1 }}>
                    <Button onClick={() => setMode("BOARD")} startIcon={<ViewKanbanOutlinedIcon />} sx={{ borderRadius: 0, color: mode === "BOARD" ? C.text : C.muted, borderBottom: mode === "BOARD" ? `3px solid ${C.primary}` : "3px solid transparent" }}>Board</Button>
                    <Button onClick={() => setMode("LIST")} startIcon={<ViewListOutlinedIcon />} sx={{ borderRadius: 0, color: mode === "LIST" ? C.text : C.muted, borderBottom: mode === "LIST" ? `3px solid ${C.primary}` : "3px solid transparent" }}>List</Button>
                </Box>
            </Box>

            {mode === "BOARD" ? (
                <Box sx={{ overflowX: "auto", pb: .5 }}>
                    <Box sx={{ minWidth: Math.max(940, visibleColumns.length * 300), display: "grid", gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(280px,1fr))`, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
                        {visibleColumns.map((column, columnIndex) => {
                            const rows = filtered.filter((row) => stageBucket(row.currentStage) === column.key).sort((a, b) => rowPriority(b) - rowPriority(a));
                            return (
                                <Box key={column.key} sx={{ minHeight: 590, px: 2, py: 2.2, borderLeft: columnIndex ? `1px solid ${C.border}` : "none" }}>
                                    <Box sx={{ display: "flex", gap: .8, alignItems: "baseline", mb: 1.7 }}>
                                        <Typography sx={{ fontSize: 19, fontWeight: 760 }}>{column.label}</Typography>
                                        <Typography sx={{ color: C.muted, fontSize: 16 }}>{rows.length}</Typography>
                                    </Box>
                                    <Box sx={{ display: "grid", gap: 1.4 }}>
                                        {rows.length ? rows.map((row) => <OperationsCard key={row.requisitionId || row.requisitionNumber} row={row} onOpen={navigate} />) : <Typography sx={{ color: C.faint, fontSize: 13 }}>No open work</Typography>}
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
            ) : (
                <Box sx={{ overflowX: "auto" }}>
                    <Box sx={{ minWidth: 880 }}>
                        <Box sx={tableHeaderSx("minmax(280px,1.2fr) 160px 160px 150px minmax(200px,.8fr)")}>{["Project / product", "Stage", "Owner · Plant", "Due", "Next action"].map((h) => <Box key={h} sx={cellSx}>{h}</Box>)}</Box>
                        {filtered.length === 0 ? <EmptyLine /> : filtered.map((row) => {
                            const action = nextActionForRow(row);
                            return <Box key={row.requisitionId || row.requisitionNumber} sx={tableRowSx("minmax(280px,1.2fr) 160px 160px 150px minmax(200px,.8fr)")}>
                                <Box sx={cellSx}><Typography sx={{ fontWeight: 700 }}>{row.projectCode || "—"} · {row.projectName || "Project"}</Typography><Typography sx={{ color: C.muted, fontSize: 13.5 }}>{row.productName || "Product"} · {row.requisitionNumber || "MR"}</Typography></Box>
                                <Box sx={cellSx}>{readable(row.currentStage || stageBucket(row.currentStage))}</Box>
                                <Box sx={cellSx}>{ownerForRow(row)} · {row.productionPlantCode || "—"}</Box>
                                <Box sx={cellSx}><DueText value={row.requiredDate} /></Box>
                                <Box sx={cellSx}><LinkAction onClick={() => navigate(action.path)}>{action.label}</LinkAction></Box>
                            </Box>;
                        })}
                    </Box>
                </Box>
            )}

            <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center", mt: 2, pt: 2, borderTop: `1px solid ${C.border}`, color: C.muted }}>
                <Typography sx={{ fontSize: 13.5 }}>QC {counts.QC || 0} &nbsp;·&nbsp; Processing {counts.PROCESSING || 0} &nbsp;|&nbsp; Empty stages hidden</Typography>
                <Typography sx={{ fontSize: 13.5 }}>Completed {(allRows || []).filter((row) => stageBucket(row.currentStage) === "COMPLETE").length}</Typography>
            </Box>
        </>
    );
}

function projectKey(project) {
    return String(project?.id || upper(project?.projectCode) || upper(project?.projectName));
}

function productRowFor(product, project, rows) {
    return rows.find((row) => product?.id && String(row?.projectDrawingId || "") === String(product.id))
        || rows.find((row) => upper(row?.projectCode) === upper(project?.projectCode) && upper(row?.drawingNo) === upper(product?.drawingNo))
        || rows.find((row) => upper(row?.projectCode) === upper(project?.projectCode) && clean(row?.productName).toLowerCase() === clean(product?.productName).toLowerCase())
        || null;
}

function ProjectsView({ projects, allRows, navigate, searchParams, setSearchParams, onAttachmentError }) {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [productDetail, setProductDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const selectedProjectId = clean(searchParams.get("project"));
    const selectedProductId = clean(searchParams.get("product"));

    const summaries = useMemo(() => projects.map((project) => {
        const rows = allRows.filter((row) => upper(row.projectCode) === upper(project.projectCode) || (project.id && String(row.projectId || "") === String(project.id)));
        const active = rows.filter((row) => !COMPLETED_STAGES.has(normalize(row.currentStage)));
        const readiness = rows.length ? Math.round(rows.reduce((sum, row) => sum + Math.max(0, Math.min(100, numeric(row.materialReadyPercent))), 0) / rows.length) : 0;
        const priorityRow = [...active].sort((a, b) => rowPriority(b) - rowPriority(a))[0] || rows[0] || null;
        return {
            project,
            rows,
            active,
            readiness,
            priorityRow,
            status: projectStatus(project, active.length ? active : rows),
            productCount: (Array.isArray(project.products) ? project.products : []).filter((product) => product?.active !== false).length,
        };
    }), [projects, allRows]);

    const filtered = useMemo(() => {
        const term = clean(search).toLowerCase();
        return summaries.filter((summary) => {
            if (statusFilter !== "ALL" && summary.status.key !== statusFilter) return false;
            if (!term) return true;
            const project = summary.project;
            return [project.projectCode, project.projectName, project.clientName, project.projectManager].some((value) => clean(value).toLowerCase().includes(term));
        });
    }, [summaries, search, statusFilter]);

    const counts = useMemo(() => ({
        onTrack: summaries.filter((summary) => summary.status.key === "ON_TRACK").length,
        atRisk: summaries.filter((summary) => summary.status.key === "AT_RISK").length,
        overdue: summaries.filter((summary) => summary.status.key === "OVERDUE").length,
    }), [summaries]);

    const selectedSummary = summaries.find((summary) => projectKey(summary.project) === selectedProjectId || String(summary.project.id || "") === selectedProjectId) || null;
    const selectedProject = selectedSummary?.project || null;
    const products = (Array.isArray(selectedProject?.products) ? selectedProject.products : []).filter((product) => product?.active !== false);
    const selectedProduct = products.find((product) => String(product.id || "") === selectedProductId) || products[0] || null;
    const selectedRow = selectedProduct && selectedSummary ? productRowFor(selectedProduct, selectedProject, selectedSummary.rows) : null;

    useEffect(() => {
        let active = true;
        setProductDetail(null);
        if (!selectedRow?.requisitionId) return () => { active = false; };
        setDetailLoading(true);
        matflowApi.getTrackerDetail(selectedRow.requisitionId)
            .then((response) => { if (active) setProductDetail(response?.data || null); })
            .catch(() => { if (active) setProductDetail(null); })
            .finally(() => { if (active) setDetailLoading(false); });
        return () => { active = false; };
    }, [selectedRow?.requisitionId]);

    const chooseProject = (project) => {
        const next = new URLSearchParams(searchParams);
        next.set("view", "projects");
        next.set("project", projectKey(project));
        next.delete("product");
        setSearchParams(next, { replace: true });
    };

    const chooseProduct = (product) => {
        const next = new URLSearchParams(searchParams);
        next.set("view", "projects");
        if (selectedProject) next.set("project", projectKey(selectedProject));
        if (product?.id) next.set("product", String(product.id));
        else next.delete("product");
        setSearchParams(next, { replace: true });
    };

    const backToRegister = () => {
        const next = new URLSearchParams(searchParams);
        next.set("view", "projects");
        next.delete("project");
        next.delete("product");
        setSearchParams(next, { replace: true });
    };

    const openProductAttachment = async (kind) => {
        if (!selectedProject?.id || !selectedProduct?.id) return;
        try {
            const response = kind === "IMAGE"
                ? await matflowApi.getProjectProductImage(selectedProject.id, selectedProduct.id)
                : await matflowApi.getProjectProductDrawing(selectedProject.id, selectedProduct.id);
            const suffix = kind === "IMAGE" ? "product-image" : "drawing";
            saveBlob(response?.data, `${clean(selectedProject.projectCode) || "project"}-${clean(selectedProduct.drawingNo) || clean(selectedProduct.productName) || "product"}-${suffix}`);
        } catch (error) {
            onAttachmentError(readMatFlowError(error, `${kind === "IMAGE" ? "Product image" : "Drawing"} is not available for this Product.`));
        }
    };

    if (selectedProject) {
        const shortageMaterial = (Array.isArray(productDetail?.materials) ? productDetail.materials : [])
            .map((material) => ({ ...material, _shortage: Math.max(0, numeric(material.shortageQty ?? material.lineShortageQty ?? material.remainingQty)) }))
            .sort((a, b) => b._shortage - a._shortage)[0] || null;
        const action = selectedRow ? nextActionForRow(selectedRow) : null;

        return (
            <Box sx={{ mx: { xs: -2, md: -3.2 }, mt: { xs: -2.5, md: -3.5 }, mb: { xs: -2.5, md: -3.5 } }}>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "350px minmax(0,1fr)" }, minHeight: "calc(100vh - 68px)" }}>
                    <Box sx={{ borderRight: { lg: `1px solid ${C.border}` }, bgcolor: "#fff" }}>
                        <Box sx={{ px: 3.2, pt: 3.2, pb: 1.6, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                            <Typography sx={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.03em" }}>Projects</Typography>
                            <Typography sx={{ color: C.muted, fontSize: 18 }}>{summaries.length}</Typography>
                        </Box>
                        <Box sx={{ px: 3.2, pb: 1.5 }}><HeaderSearch value={search} onChange={setSearch} placeholder="Find a project" /></Box>
                        <Box>
                            {filtered.map((summary) => {
                                const project = summary.project;
                                const selected = projectKey(project) === projectKey(selectedProject);
                                return (
                                    <Box
                                        key={projectKey(project)}
                                        onClick={() => chooseProject(project)}
                                        sx={{ px: 3.2, py: 2, borderBottom: `1px solid ${C.border}`, borderLeft: selected ? `5px solid ${C.primary}` : "5px solid transparent", bgcolor: selected ? C.selected : "#fff", cursor: "pointer", "&:hover": { bgcolor: selected ? C.selected : C.rowHover } }}
                                    >
                                        <Typography sx={{ fontSize: 15.5, fontWeight: selected ? 750 : 600 }}>{project.projectCode || "—"} · {project.projectName || "Project"}</Typography>
                                        <Typography sx={{ color: C.muted, mt: .35, fontSize: 13.5 }}>{summary.productCount} products</Typography>
                                    </Box>
                                );
                            })}
                        </Box>
                        <Box sx={{ px: 3.2, py: 2.2 }}><LinkAction onClick={backToRegister}>View all {summaries.length} projects</LinkAction></Box>
                    </Box>

                    <Box sx={{ px: { xs: 2.3, md: 4.2 }, py: 3.2, minWidth: 0 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, alignItems: "flex-start" }}>
                            <Box>
                                <Typography sx={{ fontSize: 36, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-.035em" }}>{selectedProject.projectName || selectedProject.projectCode || "Project"}</Typography>
                                <Typography sx={{ color: C.muted, fontSize: 16, mt: .6 }}>{selectedProject.projectCode || "—"} · {selectedProject.plantCode || "—"} · Due {formatShortDate(selectedProject.requiredDate)}</Typography>
                                <Typography sx={{ color: C.muted, fontSize: 16, mt: .7 }}>{products.length} products · {selectedSummary.active.length} open MRs · <Box component="span" sx={{ color: toneColor(selectedSummary.status.tone), fontWeight: 700 }}>{selectedSummary.status.label}</Box></Typography>
                            </Box>
                            <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                                <PlantSelect />
                                <ThinButton onClick={backToRegister} sx={{ minWidth: 40, px: 1 }}>•••</ThinButton>
                            </Box>
                        </Box>

                        <Typography sx={{ mt: 3.2, mb: 1.2, fontSize: 24, fontWeight: 760 }}>Products</Typography>
                        <Box sx={{ overflowX: "auto" }}>
                            <Box sx={{ minWidth: 760 }}>
                                <Box sx={tableHeaderSx("minmax(260px,1.2fr) 180px 140px minmax(190px,.8fr)")}>{["Product / MR", "Current stage", "Ready", "Next action"].map((h) => <Box key={h} sx={cellSx}>{h}</Box>)}</Box>
                                {products.length === 0 ? <EmptyLine>No Products on this Project.</EmptyLine> : products.map((product) => {
                                    const row = productRowFor(product, selectedProject, selectedSummary.rows);
                                    const actionForProduct = row ? nextActionForRow(row) : { label: "Open product", path: "/matflow/projects" };
                                    const ready = row ? Math.round(Math.max(0, Math.min(100, numeric(row.materialReadyPercent)))) : 0;
                                    const isSelected = selectedProduct && String(product.id || "") === String(selectedProduct.id || "");
                                    return (
                                        <Box key={product.id || product.drawingNo || product.productName} onClick={() => chooseProduct(product)} sx={{ ...tableRowSx("minmax(260px,1.2fr) 180px 140px minmax(190px,.8fr)", isSelected), cursor: "pointer" }}>
                                            <Box sx={cellSx}><Typography sx={{ fontSize: 15.5, fontWeight: 700 }}>{product.productName || "Product"}</Typography><Typography sx={{ color: C.muted, fontSize: 13.5, mt: .15 }}>{row?.requisitionNumber || product.drawingNo || "No MR"}</Typography></Box>
                                            <Box sx={cellSx}>{row ? ownerForRow(row) : product.bomEffective ? "BOM ready" : "Engineering"}</Box>
                                            <Box sx={cellSx}><Typography sx={{ color: ready >= 100 ? C.success : ready >= 60 ? C.warning : C.danger, fontWeight: 700 }}>{ready}%</Typography></Box>
                                            <Box sx={cellSx}><LinkAction onClick={(event) => { event?.stopPropagation?.(); navigate(actionForProduct.path); }}>{actionForProduct.label}</LinkAction></Box>
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Box>

                        {selectedProduct && (
                            <Box sx={{ borderTop: `1px solid ${C.border}`, mt: 2.4, pt: 2.3 }}>
                                <Typography sx={{ color: C.muted, textTransform: "uppercase", letterSpacing: ".04em", fontSize: 12.5, fontWeight: 700 }}>Selected product</Typography>
                                <Typography sx={{ mt: .4, fontSize: 27, fontWeight: 780, letterSpacing: "-.025em" }}>{selectedProduct.productName || "Product"}</Typography>
                                <Box sx={{ mt: 1.5, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "120px minmax(0,1fr)" }, columnGap: 1.5, rowGap: .6, maxWidth: 760 }}>
                                    <Typography sx={{ color: C.muted }}>Owner:</Typography><Typography>{selectedRow ? `${ownerForRow(selectedRow)} · ${selectedRow.productionPlantCode || selectedProject.plantCode || "—"}` : "Engineering · " + (selectedProject.plantCode || "—")}</Typography>
                                    <Typography sx={{ color: C.muted }}>Material:</Typography><Typography>{detailLoading ? "Loading…" : shortageMaterial?.materialName || shortageMaterial?.materialCode || "No current shortage material"}</Typography>
                                    <Typography sx={{ color: C.muted }}>Shortage:</Typography><Typography sx={{ color: shortageMaterial?._shortage > 0 ? C.danger : C.text }}>{shortageMaterial?._shortage > 0 ? `${shortageMaterial._shortage} ${shortageMaterial.uom || ""}` : selectedRow && numeric(selectedRow.shortageQty) > 0 ? `${numeric(selectedRow.shortageQty)} total` : "None"}</Typography>
                                </Box>
                                <Typography sx={{ mt: 1.5, fontSize: 15.5 }}>{action ? action.label + "." : "Review Product readiness and engineering handover."}</Typography>
                                <Box sx={{ mt: 1.5, display: "flex", gap: 2.4, alignItems: "center", flexWrap: "wrap" }}>
                                    {action && <Button onClick={() => navigate(action.path)} variant="contained" sx={{ bgcolor: C.primaryDark, px: 2.4, "&:hover": { bgcolor: "#083d64" } }}>{action.label}</Button>}
                                    {selectedRow?.requisitionId && <LinkAction endIcon={null} onClick={() => navigate(`/matflow/tracker/${selectedRow.requisitionId}`)}>Material history</LinkAction>}
                                </Box>
                                <Box sx={{ borderTop: `1px solid ${C.border}`, mt: 1.7, pt: 1.3, display: "flex", gap: 2.2, flexWrap: "wrap" }}>
                                    <LinkAction endIcon={null} onClick={() => openProductAttachment("DRAWING")}>Drawing Rev {selectedProduct.drawingRevision || "—"}</LinkAction>
                                    <LinkAction endIcon={null} onClick={() => openProductAttachment("IMAGE")}>Product image</LinkAction>
                                    <LinkAction endIcon={null} onClick={() => navigate("/matflow/work")}>Design checklist</LinkAction>
                                    <LinkAction endIcon={null} onClick={() => navigate("/matflow/work")}>Engineering checklist</LinkAction>
                                </Box>
                            </Box>
                        )}
                    </Box>
                </Box>
            </Box>
        );
    }

    return (
        <>
            <PageHeading title="Projects" subtitle={`${summaries.length} active`} right={<PlantSelect />} />
            <Box sx={{ display: "flex", gap: 3, alignItems: "center", mb: 3, flexWrap: "wrap" }}>
                <Typography sx={{ color: C.success, fontSize: 15.5, fontWeight: 700 }}>{counts.onTrack} &nbsp; On track</Typography>
                <Divider orientation="vertical" flexItem />
                <Typography sx={{ color: C.warning, fontSize: 15.5, fontWeight: 700 }}>{counts.atRisk} &nbsp; At risk</Typography>
                <Divider orientation="vertical" flexItem />
                <Typography sx={{ color: C.danger, fontSize: 15.5, fontWeight: 700 }}>{counts.overdue} &nbsp; Overdue</Typography>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(280px,1fr) 120px 118px" }, gap: 1.3, mb: 2.2 }}>
                <HeaderSearch value={search} onChange={setSearch} placeholder="Find project or PD number" />
                <TextField select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} inputProps={{ "aria-label": "Status" }} sx={{ "& .MuiOutlinedInput-root": { height: 48 } }}>
                    <MenuItem value="ALL">Status</MenuItem>
                    <MenuItem value="ON_TRACK">On track</MenuItem>
                    <MenuItem value="AT_RISK">At risk</MenuItem>
                    <MenuItem value="OVERDUE">Overdue</MenuItem>
                </TextField>
                <ThinButton startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMatFlowExcel({ fileName: "MatFlow_Projects_Management", sheetName: "Projects", title: "MatFlow Projects", rows: filtered.map((s) => ({ ...s.project, productCount: s.productCount, materialReadyPercent: s.readiness, currentOwner: s.priorityRow ? ownerForRow(s.priorityRow) : "—", managementStatus: s.status.label })) })}>Export</ThinButton>
            </Box>

            <Box sx={{ overflowX: "auto" }}>
                <Box sx={{ minWidth: 940 }}>
                    <Box sx={tableHeaderSx("minmax(300px,1.2fr) 110px 145px 220px 125px 150px 48px")}>{["Project", "Products", "Material ready", "Current owner", "Due", "Status", ""].map((h) => <Box key={h || "arrow"} sx={cellSx}>{h}</Box>)}</Box>
                    {filtered.length === 0 ? <EmptyLine>No Projects match the selected filters.</EmptyLine> : filtered.map((summary) => {
                        const project = summary.project;
                        const owner = summary.priorityRow ? `${ownerForRow(summary.priorityRow)} · ${summary.priorityRow.productionPlantCode || project.plantCode || "—"}` : `Engineering · ${project.plantCode || "—"}`;
                        return (
                            <Box key={projectKey(project)} onClick={() => chooseProject(project)} sx={{ ...tableRowSx("minmax(300px,1.2fr) 110px 145px 220px 125px 150px 48px"), cursor: "pointer" }}>
                                <Box sx={cellSx}><Typography sx={{ fontSize: 15.5, fontWeight: 650 }}>{project.projectCode || "—"} · {project.projectName || "Project"}</Typography></Box>
                                <Box sx={{ ...cellSx, textAlign: "center" }}>{summary.productCount}</Box>
                                <Box sx={{ ...cellSx, textAlign: "center" }}>{summary.readiness}%</Box>
                                <Box sx={cellSx}>{owner}</Box>
                                <Box sx={cellSx}>{formatShortDate(project.requiredDate)}</Box>
                                <Box sx={cellSx}><StatusText status={summary.status} /></Box>
                                <Box sx={{ ...cellSx, px: 1 }}><ChevronRightIcon sx={{ color: C.text }} /></Box>
                            </Box>
                        );
                    })}
                </Box>
            </Box>
            <Box sx={{ mt: 1.7, color: C.muted }}><Typography sx={{ fontSize: 13.5 }}>{filtered.length} projects</Typography></Box>
        </>
    );
}

function WorkQueueView({ activeRows, needsActionRows, navigate, onViewChange }) {
    const [search, setSearch] = useState("");
    const [tab, setTab] = useState("ALL");
    const rows = useMemo(() => {
        const term = clean(search).toLowerCase();
        return [...needsActionRows]
            .filter((row) => {
                const days = dueLabel(row.requiredDate).days;
                if (tab === "OVERDUE" && !(days != null && days < 0)) return false;
                if (tab === "TODAY" && days !== 0) return false;
                return !term || [row.projectCode, row.projectName, row.productName, row.requisitionNumber, ownerForRow(row)].some((value) => clean(value).toLowerCase().includes(term));
            })
            .sort((a, b) => {
                const ad = dueLabel(a.requiredDate).days;
                const bd = dueLabel(b.requiredDate).days;
                if (ad != null && bd != null && ad !== bd) return ad - bd;
                return rowPriority(b) - rowPriority(a);
            });
    }, [needsActionRows, search, tab]);

    const groups = [
        { key: "OVERDUE", label: "Overdue", rows: rows.filter((row) => (dueLabel(row.requiredDate).days ?? 999) < 0) },
        { key: "TODAY", label: "Today", rows: rows.filter((row) => dueLabel(row.requiredDate).days === 0) },
        { key: "UPCOMING", label: "Upcoming", rows: rows.filter((row) => (dueLabel(row.requiredDate).days ?? 999) > 0) },
    ];

    return (
        <>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5, mb: 2.2 }}>
                <Button onClick={() => onViewChange("overview")} sx={{ p: 0, minWidth: 0, minHeight: 0, color: C.muted, fontWeight: 500 }}>MatFlow</Button>
                <Typography sx={{ color: C.faint }}>/</Typography>
                <Typography sx={{ color: C.muted }}>Work queue</Typography>
            </Box>
            <PageHeading title="Work queue" subtitle={`${needsActionRows.length} open tasks`} right={<PlantSelect />} />

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap", mb: 1.6 }}>
                <Box sx={{ display: "flex", gap: 3.2 }}>
                    {[
                        ["ALL", `All  ${needsActionRows.length}`],
                        ["OVERDUE", `Overdue  ${needsActionRows.filter((row) => (dueLabel(row.requiredDate).days ?? 999) < 0).length}`],
                        ["TODAY", `Today  ${needsActionRows.filter((row) => dueLabel(row.requiredDate).days === 0).length}`],
                    ].map(([key, label]) => <Button key={key} onClick={() => setTab(key)} sx={{ borderRadius: 0, px: .2, color: tab === key ? C.text : C.muted, borderBottom: tab === key ? `3px solid #0d6f73` : "3px solid transparent" }}>{label}</Button>)}
                </Box>
                <HeaderSearch value={search} onChange={setSearch} placeholder="Find a task" sx={{ width: { xs: "100%", sm: 310 } }} />
            </Box>

            <Box sx={{ overflowX: "auto" }}>
                <Box sx={{ minWidth: 940 }}>
                    <Box sx={tableHeaderSx("minmax(300px,1fr) minmax(270px,1fr) 200px 150px 45px")}>{["Task", "Project · Product · MR", "Owner · Plant", "Due date", ""].map((h) => <Box key={h || "open"} sx={cellSx}>{h}</Box>)}</Box>
                    {groups.map((group) => group.rows.length ? (
                        <Box key={group.key}>
                            <Box sx={{ px: 2, py: 1.25, bgcolor: "#f8fafb", borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 700 }}>{group.label}</Box>
                            {group.rows.map((row) => {
                                const action = nextActionForRow(row);
                                const due = dueLabel(row.requiredDate);
                                return (
                                    <Box key={`${group.key}:${row.requisitionId || row.requisitionNumber}`} onClick={() => navigate(action.path)} sx={{ ...tableRowSx("minmax(300px,1fr) minmax(270px,1fr) 200px 150px 45px"), cursor: "pointer" }}>
                                        <Box sx={cellSx}><Box sx={{ display: "flex", alignItems: "center", gap: 1.6 }}><Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: due.tone === "danger" ? C.danger : due.tone === "warning" ? "#28a765" : "#f0ae1d" }} /><Typography sx={{ fontSize: 15.5 }}>{action.label}</Typography></Box></Box>
                                        <Box sx={cellSx}>{row.projectCode || "—"} · {row.productName || row.drawingNo || "Product"} · {row.requisitionNumber || "MR"}</Box>
                                        <Box sx={cellSx}>{ownerForRow(row)} · {row.productionPlantCode || "—"}</Box>
                                        <Box sx={cellSx}><Typography sx={{ color: toneColor(due.tone), fontWeight: due.tone === "danger" ? 700 : 500 }}>{due.label}</Typography></Box>
                                        <Box sx={{ ...cellSx, px: 1 }}><ChevronRightIcon /></Box>
                                    </Box>
                                );
                            })}
                        </Box>
                    ) : null)}
                    {rows.length === 0 && <EmptyLine>No open tasks in this filter.</EmptyLine>}
                </Box>
            </Box>
        </>
    );
}

function buildMaterialSummaries(requisitions, trackerRows) {
    const trackerByReq = new Map(trackerRows.map((row) => [String(row.requisitionId || ""), row]));
    const map = new Map();
    requisitions.forEach((requisition) => {
        if (!requisition || normalize(requisition.status) === "CANCELLED") return;
        const row = trackerByReq.get(String(requisition.id || "")) || null;
        (Array.isArray(requisition.lines) ? requisition.lines : []).forEach((line) => {
            if (!line || normalize(line.status) === "CANCELLED") return;
            const key = String(line.materialId || upper(line.materialCode) || upper(line.materialName));
            if (!key) return;
            const entry = map.get(key) || {
                key,
                materialId: line.materialId || null,
                materialCode: line.materialCode || "",
                materialName: line.materialName || line.materialCode || "Material",
                category: line.materialCategory || "",
                uom: line.uom || "",
                requestedQty: 0,
                shortageQty: 0,
                projectKeys: new Set(),
                productKeys: new Set(),
                mrKeys: new Set(),
                usages: [],
            };
            entry.requestedQty += numeric(line.requestedQty ?? line.requiredQty);
            entry.shortageQty += materialLineShortage(line);
            if (requisition.projectCode) entry.projectKeys.add(upper(requisition.projectCode));
            if (requisition.projectDrawingId || requisition.drawingNo || requisition.productName) entry.productKeys.add(String(requisition.projectDrawingId || `${requisition.drawingNo}:${requisition.productName}`));
            if (requisition.id) entry.mrKeys.add(String(requisition.id));
            entry.usages.push({ requisition, line, row });
            map.set(key, entry);
        });
    });
    return Array.from(map.values()).map((entry) => ({
        ...entry,
        projectCount: entry.projectKeys.size,
        productCount: entry.productKeys.size,
        mrCount: entry.mrKeys.size,
    })).sort((a, b) => clean(a.materialName).localeCompare(clean(b.materialName), undefined, { sensitivity: "base" }));
}

function MaterialsView({ materials, navigate, searchParams, setSearchParams }) {
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("ALL");
    const selectedKey = clean(searchParams.get("materialId"));
    const categories = useMemo(() => Array.from(new Set(materials.map((material) => normalize(material.category)).filter(Boolean))).sort(), [materials]);
    const filtered = useMemo(() => {
        const term = clean(search).toLowerCase();
        return materials.filter((material) => {
            if (category !== "ALL" && normalize(material.category) !== category) return false;
            if (!term) return true;
            return [material.materialCode, material.materialName, material.category].some((value) => clean(value).toLowerCase().includes(term));
        });
    }, [materials, search, category]);
    const selected = materials.find((material) => String(material.materialId || material.key) === selectedKey) || null;

    const selectMaterial = (material) => {
        const next = new URLSearchParams(searchParams);
        next.set("view", "materials");
        next.set("materialId", String(material.materialId || material.key));
        setSearchParams(next, { replace: true });
    };

    if (selected) {
        return (
            <>
                <PageHeading title={selected.materialName} subtitle={selected.materialCode || "Material"} right={<><PlantSelect /><ThinButton onClick={() => { const next = new URLSearchParams(searchParams); next.set("view", "materials"); next.delete("materialId"); setSearchParams(next, { replace: true }); }}>All materials</ThinButton></>} />
                <KpiRail items={[
                    { label: "Projects", value: selected.projectCount },
                    { label: "Open MRs", value: selected.mrCount },
                    { label: "Shortage qty", value: `${Number(selected.shortageQty || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${selected.uom || ""}` },
                ]} />
                <Typography sx={{ fontSize: 24, fontWeight: 760, mb: 1.4 }}>Material work</Typography>
                <Box sx={{ overflowX: "auto" }}>
                    <Box sx={{ minWidth: 900 }}>
                        <Box sx={tableHeaderSx("minmax(280px,1fr) 170px 170px 130px minmax(190px,.8fr)")}>{["Project / product", "MR", "Current owner", "Shortage", "Next action"].map((h) => <Box key={h} sx={cellSx}>{h}</Box>)}</Box>
                        {selected.usages.map((usage, index) => {
                            const row = usage.row;
                            const action = row ? nextActionForRow(row) : { label: "Open MR", path: usage.requisition?.id ? `/matflow/requisitions/${usage.requisition.id}` : "/matflow/production" };
                            return <Box key={`${selected.key}:${usage.requisition?.id || index}:${usage.line?.id || index}`} sx={tableRowSx("minmax(280px,1fr) 170px 170px 130px minmax(190px,.8fr)")}>
                                <Box sx={cellSx}><Typography sx={{ fontWeight: 700 }}>{usage.requisition?.projectCode || row?.projectCode || "—"} · {usage.requisition?.productName || row?.productName || usage.requisition?.drawingNo || "Product"}</Typography><Typography sx={{ color: C.muted, fontSize: 13.5 }}>{usage.requisition?.drawingNo || row?.drawingNo || "—"}</Typography></Box>
                                <Box sx={cellSx}>{usage.requisition?.requisitionNumber || row?.requisitionNumber || "—"}</Box>
                                <Box sx={cellSx}>{row ? `${ownerForRow(row)} · ${row.productionPlantCode || "—"}` : readable(usage.requisition?.status || "Workflow")}</Box>
                                <Box sx={cellSx}>{materialLineShortage(usage.line).toLocaleString(undefined, { maximumFractionDigits: 2 })} {selected.uom}</Box>
                                <Box sx={cellSx}><LinkAction onClick={() => navigate(action.path)}>{action.label}</LinkAction></Box>
                            </Box>;
                        })}
                    </Box>
                </Box>
            </>
        );
    }

    return (
        <>
            <PageHeading title="Materials" subtitle={`${materials.length} in active demand`} right={<PlantSelect />} />
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(300px,1fr) 180px" }, gap: 1.3, mb: 2.2 }}>
                <HeaderSearch value={search} onChange={setSearch} placeholder="Find material or code" />
                <TextField select value={category} onChange={(event) => setCategory(event.target.value)} inputProps={{ "aria-label": "Category" }} sx={{ "& .MuiOutlinedInput-root": { height: 48 } }}>
                    <MenuItem value="ALL">All categories</MenuItem>
                    {categories.map((value) => <MenuItem key={value} value={value}>{readable(value)}</MenuItem>)}
                </TextField>
            </Box>
            <Box sx={{ overflowX: "auto" }}>
                <Box sx={{ minWidth: 930 }}>
                    <Box sx={tableHeaderSx("minmax(280px,1fr) 160px 110px 110px 120px 160px 48px")}>{["Material", "Category", "Projects", "Products", "Open MRs", "Shortage", ""].map((h) => <Box key={h || "open"} sx={cellSx}>{h}</Box>)}</Box>
                    {filtered.length === 0 ? <EmptyLine>No active-demand materials match this view.</EmptyLine> : filtered.map((material) => (
                        <Box key={material.key} onClick={() => selectMaterial(material)} sx={{ ...tableRowSx("minmax(280px,1fr) 160px 110px 110px 120px 160px 48px"), cursor: "pointer" }}>
                            <Box sx={cellSx}><Typography sx={{ fontWeight: 700 }}>{material.materialName}</Typography><Typography sx={{ color: C.muted, fontSize: 13.5 }}>{material.materialCode || "—"} · {material.uom || "—"}</Typography></Box>
                            <Box sx={cellSx}>{readable(material.category || "Other")}</Box>
                            <Box sx={{ ...cellSx, textAlign: "center" }}>{material.projectCount}</Box>
                            <Box sx={{ ...cellSx, textAlign: "center" }}>{material.productCount}</Box>
                            <Box sx={{ ...cellSx, textAlign: "center" }}>{material.mrCount}</Box>
                            <Box sx={cellSx}><Typography sx={{ color: material.shortageQty > 0 ? C.danger : C.success, fontWeight: 650 }}>{Number(material.shortageQty || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} {material.uom || ""}</Typography></Box>
                            <Box sx={{ ...cellSx, px: 1 }}><ChevronRightIcon /></Box>
                        </Box>
                    ))}
                </Box>
            </Box>
        </>
    );
}

export default function MatFlowManagementDashboardContent() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { selectedPlantParam } = useMatFlow();
    const rawView = clean(searchParams.get("view") || "overview").toLowerCase();
    const requestedView = rawView === "kanban" ? "operations" : rawView;
    const view = ["overview", "operations", "projects", "materials", "work"].includes(requestedView) ? requestedView : "overview";

    const [trackerRows, setTrackerRows] = useState([]);
    const [projects, setProjects] = useState([]);
    const [requisitions, setRequisitions] = useState([]);
    const [exceptions, setExceptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [attachmentError, setAttachmentError] = useState("");
    const [lastUpdated, setLastUpdated] = useState("");

    const changeView = useCallback((nextView) => {
        const next = new URLSearchParams(searchParams);
        next.set("view", nextView);
        if (nextView !== "projects") {
            next.delete("project");
            next.delete("product");
        }
        if (nextView !== "materials") next.delete("materialId");
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    const load = useCallback(async ({ quiet = false } = {}) => {
        if (!quiet) setLoading(true);
        else setRefreshing(true);
        setError("");
        try {
            const [trackerResponse, projectResponse, requisitionResponse, exceptionResponse] = await Promise.all([
                matflowApi.getTracker({ plantCode: selectedPlantParam || undefined }),
                matflowApi.listProjects({ active: true, plantCode: selectedPlantParam || undefined }),
                matflowApi.listRequisitions(),
                matflowApi.listWorkflowExceptions({ plantCode: selectedPlantParam || undefined }),
            ]);
            const projectRows = extractMatFlowPage(projectResponse?.data).rows;
            const productIndex = new Map();
            projectRows.forEach((project) => {
                (Array.isArray(project.products) ? project.products : []).forEach((product) => {
                    if (product?.id) productIndex.set(String(product.id), { project, product });
                });
            });
            const enriched = (Array.isArray(trackerResponse?.data?.rows) ? trackerResponse.data.rows : [])
                .filter((row) => !selectedPlantParam || upper(row.productionPlantCode || row.plantCode) === upper(selectedPlantParam))
                .map((row) => {
                    const context = productIndex.get(String(row.projectDrawingId || ""));
                    return {
                        ...row,
                        projectId: row.projectId || context?.project?.id || null,
                        projectName: row.projectName || context?.project?.projectName || "",
                        requiredDate: row.requiredDate || context?.product?.requiredDate || context?.project?.requiredDate || null,
                    };
                });
            const reqRows = (Array.isArray(requisitionResponse?.data) ? requisitionResponse.data : [])
                .filter((row) => !selectedPlantParam || upper(row.productionPlantCode) === upper(selectedPlantParam));
            setProjects(projectRows);
            setTrackerRows(enriched);
            setRequisitions(reqRows);
            setExceptions(Array.isArray(exceptionResponse?.data) ? exceptionResponse.data : []);
            setLastUpdated(new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit" }).format(new Date()));
        } catch (requestError) {
            setTrackerRows([]);
            setProjects([]);
            setRequisitions([]);
            setExceptions([]);
            setError(readMatFlowError(requestError, "Unable to load the MatFlow management dashboard."));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedPlantParam]);

    useEffect(() => { load(); }, [load]);

    const activeRows = useMemo(() => trackerRows.filter((row) => !COMPLETED_STAGES.has(normalize(row.currentStage))), [trackerRows]);
    const needsActionRows = useMemo(() => activeRows.filter(rowNeedsAction).sort((a, b) => rowPriority(b) - rowPriority(a)), [activeRows]);
    const materialSummaries = useMemo(() => buildMaterialSummaries(requisitions, trackerRows), [requisitions, trackerRows]);

    return (
        <ManagementDashboardFrame view={view} onViewChange={changeView}>
            <ErrorBanner error={error || attachmentError} />
            {loading ? <LoadingView /> : (
                <>
                    {view === "overview" && <OverviewView activeRows={activeRows} projects={projects} needsActionRows={needsActionRows} lastUpdated={lastUpdated} onRefresh={() => load({ quiet: true })} refreshing={refreshing} onViewChange={changeView} navigate={navigate} />}
                    {view === "operations" && <OperationsView activeRows={activeRows} allRows={trackerRows} navigate={navigate} />}
                    {view === "projects" && <ProjectsView projects={projects} allRows={trackerRows} navigate={navigate} searchParams={searchParams} setSearchParams={setSearchParams} onAttachmentError={setAttachmentError} />}
                    {view === "materials" && <MaterialsView materials={materialSummaries} navigate={navigate} searchParams={searchParams} setSearchParams={setSearchParams} />}
                    {view === "work" && <WorkQueueView activeRows={activeRows} needsActionRows={needsActionRows} navigate={navigate} onViewChange={changeView} />}
                </>
            )}
            {!loading && exceptions.filter((row) => normalize(row.status) !== "RESOLVED" && row.workflowHold === true).length > 0 && view === "overview" && (
                <Box sx={{ mt: 3, borderTop: `1px solid ${C.border}`, pt: 1.5, display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center" }}>
                    <Typography sx={{ color: C.muted, fontSize: 13.5 }}>{exceptions.filter((row) => normalize(row.status) !== "RESOLVED" && row.workflowHold === true).length} workflow hold(s) require management attention.</Typography>
                    <LinkAction onClick={() => navigate("/matflow/exceptions")}>Open exceptions</LinkAction>
                </Box>
            )}
        </ManagementDashboardFrame>
    );
}

export { MatFlowManagementDashboardContent };
