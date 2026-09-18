import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Badge,
    Box,
    Button,
    Divider,
    Drawer,
    MenuItem,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import {
    NavLink,
    Outlet,
    useLocation,
    useNavigate,
} from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import {
    MATFLOW_ROLES,
    canAccessMatFlowScreenForContext,
    matFlowRoleLabel,
    secondaryBtnSx,
    useMatFlow,
    useMatFlowTheme,
} from "./matflowUi";
import { matflowApi, readMatFlowError } from "./api/matflowApi";

import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import PrecisionManufacturingOutlinedIcon from "@mui/icons-material/PrecisionManufacturingOutlined";
import KeyboardReturnOutlinedIcon from "@mui/icons-material/KeyboardReturnOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import AppsIcon from "@mui/icons-material/Apps";
import LogoutIcon from "@mui/icons-material/Logout";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import DoneAllOutlinedIcon from "@mui/icons-material/DoneAllOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";

const NAV = [
    ["Dashboard", "/matflow/dashboard", "dashboard", <DashboardOutlinedIcon />],
    ["Work", "/matflow/work", "work", <AssignmentTurnedInOutlinedIcon />],
    ["Projects", "/matflow/projects", "projects", <FolderOutlinedIcon />],
    ["BOMs", "/matflow/boms", "boms", <AccountTreeOutlinedIcon />],
    ["Materials", "/matflow/materials", "materials", <Inventory2OutlinedIcon />],
    ["Production Release", "/matflow/release", "release", <EngineeringOutlinedIcon />],
    ["Reports", "/matflow/reports", "reports", <AssessmentOutlinedIcon />],
].map(([label, path, screen, icon]) => ({ label, path, screen, icon }));

const PRIMARY_SCREENS = Object.freeze({
    [MATFLOW_ROLES.ADMIN]: new Set(["work", "projects", "boms", "materials", "release"]),
    [MATFLOW_ROLES.MANAGER]: new Set(["work", "projects", "boms", "materials", "release"]),
    [MATFLOW_ROLES.DESIGN_HEAD]: new Set(["work", "projects"]),
    [MATFLOW_ROLES.DESIGNER]: new Set(["work", "projects"]),
    [MATFLOW_ROLES.DESIGNER_JUNIOR]: new Set(["work", "projects"]),
    [MATFLOW_ROLES.PPC]: new Set(["work", "projects", "release"]),
    [MATFLOW_ROLES.ENGINEERING_HEAD]: new Set(["work", "projects", "boms", "materials"]),
    [MATFLOW_ROLES.ENGINEERING]: new Set(["work", "projects", "boms", "materials"]),
    [MATFLOW_ROLES.ENGINEERING_JUNIOR]: new Set(["work", "projects"]),
    [MATFLOW_ROLES.PRODUCTION]: new Set(["release"]),
    [MATFLOW_ROLES.DIRECTOR]: new Set(["projects", "release"]),
});

const CONTROL_SCREENS = new Set(["release", "reports"]);
const REFERENCE_SCREENS = new Set(["projects", "materials", "boms"]);

const HEADER = [
    ["/matflow/dashboard", "Dashboard", "A quiet, role-focused view of the work that needs attention."],
    ["/matflow/work", "Work", "Department work stays focused while Product Name + PD No. remain the common identity."],
    ["/matflow/projects", "Projects & Products", "PD / Project and Product / Drawing master."],
    ["/matflow/boms", "Engineering BOM", "Engineering-only material documentation for the Production File."],
    ["/matflow/materials", "Material Reference", "Engineering material catalogue used by BOM."],
    ["/matflow/release", "Production Release", "PPC-controlled handoff boundary before the future validated production workflow."],
    ["/matflow/reports", "Reports", "Department-focused operational reports with Product Name + PD No. as the common reference."],
];

const sectionLabel = (section) => ({
    HOME: "Home",
    PRIMARY: "My Work",
    REFERENCE: "Reference",
    CONTROL: "Control & Reports",
}[section] || section);

const isManagementRole = (role) => [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.DIRECTOR].includes(role);

const sectionFor = (item, role) => {
    if (item.screen === "dashboard") return "HOME";
    if (item.screen === "work") return "PRIMARY";
    // For department users the Reports route is their Team surface, so keep it
    // beside day-to-day work. Management retains it under Control & Reports.
    if (item.screen === "reports" && !isManagementRole(role)) return "PRIMARY";
    if (PRIMARY_SCREENS[role]?.has(item.screen)) return "PRIMARY";
    if (CONTROL_SCREENS.has(item.screen)) return "CONTROL";
    if (REFERENCE_SCREENS.has(item.screen)) return "REFERENCE";
    return "REFERENCE";
};

export default function MatFlowLayout() {
    const { user, logout } = useAuth();
    const {
        availablePlants,
        selectedPlantCode,
        selectedPlantParam,
        canViewAllPlants,
        setSelectedPlantCode,
        roles,
        role,
    } = useMatFlow();
    const { isDark, toggleMode } = useMatFlowTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [notificationFeed, setNotificationFeed] = useState({ unreadCount: 0, notifications: [] });
    const [notificationError, setNotificationError] = useState("");
    const [globalProductSearch, setGlobalProductSearch] = useState("");

    const loadNotifications = useCallback(async ({ quiet = false } = {}) => {
        try {
            const response = await matflowApi.notifications({
                plantCode: selectedPlantParam,
                limit: 30,
            });
            setNotificationFeed(response?.data || { unreadCount: 0, notifications: [] });
            if (!quiet) setNotificationError("");
        } catch (requestError) {
            if (!quiet) {
                setNotificationError(readMatFlowError(requestError, "Unable to load alerts and notifications."));
            }
        }
    }, [selectedPlantParam]);

    useEffect(() => {
        loadNotifications();
        const timer = window.setInterval(() => {
            if (document.visibilityState === "visible") loadNotifications({ quiet: true });
        }, 10000);
        const onVisible = () => {
            if (document.visibilityState === "visible") loadNotifications({ quiet: true });
        };
        window.addEventListener("focus", onVisible);
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener("focus", onVisible);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [loadNotifications]);

    const items = useMemo(
        () => NAV.filter((item) => canAccessMatFlowScreenForContext(
            item.screen,
            roles,
            selectedPlantParam ? [selectedPlantParam] : availablePlants
        )),
        [roles, selectedPlantParam, availablePlants]
    );

    const grouped = useMemo(() => {
        const sections = { HOME: [], PRIMARY: [], REFERENCE: [], CONTROL: [] };
        items.forEach((item) => sections[sectionFor(item, role)].push(item));
        return sections;
    }, [items, role]);

    const header = useMemo(
        () => HEADER.find(([path]) => location.pathname === path || location.pathname.startsWith(`${path}/`)) ||
            ["", "MatFlow", "Production control"],
        [location.pathname]
    );

    const canUseGlobalProductFinder = items.some((item) => item.screen === "work") && !location.pathname.startsWith("/matflow/work");
    const openGlobalProductFinder = () => {
        const term = String(globalProductSearch || "").trim();
        if (!term) return;
        navigate(`/matflow/work?q=${encodeURIComponent(term)}`);
        setGlobalProductSearch("");
    };

    const handleLogout = async () => {
        await logout();
        navigate("/login", { replace: true });
    };

    const openTaskNotification = async (notification) => {
        try {
            const response = await matflowApi.markNotificationRead(
                notification.referenceType,
                notification.referenceId,
                { plantCode: selectedPlantParam }
            );
            if (response?.data) setNotificationFeed(response.data);
        } catch {
            // Opening the linked work item is more important than the read receipt.
        }
        setNotificationsOpen(false);
        navigate(notification.path || `/matflow/work?taskId=${encodeURIComponent(notification.referenceId || "")}`);
    };

    const markAllNotificationsRead = async () => {
        try {
            const response = await matflowApi.markAllNotificationsRead({ plantCode: selectedPlantParam });
            setNotificationFeed(response?.data || { unreadCount: 0, notifications: [] });
            setNotificationError("");
        } catch (requestError) {
            setNotificationError(readMatFlowError(requestError, "Unable to mark alerts and notifications as read."));
        }
    };

    const juniorDesignerOnly = role === MATFLOW_ROLES.DESIGNER_JUNIOR;
    const managementReports = isManagementRole(role);
    const teamLabel = juniorDesignerOnly
        ? "My Tasks"
        : [MATFLOW_ROLES.DESIGN_HEAD, MATFLOW_ROLES.DESIGNER].includes(role)
            ? "Design Team"
            : [MATFLOW_ROLES.ENGINEERING_HEAD, MATFLOW_ROLES.ENGINEERING, MATFLOW_ROLES.ENGINEERING_JUNIOR].includes(role)
                ? "Engineering Team"
                : role === MATFLOW_ROLES.PPC
                    ? "PPC Team"
                    : role === MATFLOW_ROLES.PRODUCTION
                        ? "Production Team"
                        : "Team";
    const workLabel = (
        juniorDesignerOnly
            ? "My Design Work"
            : [MATFLOW_ROLES.DESIGN_HEAD, MATFLOW_ROLES.DESIGNER].includes(role)
                ? "Design Work"
                : [MATFLOW_ROLES.ENGINEERING_HEAD, MATFLOW_ROLES.ENGINEERING, MATFLOW_ROLES.ENGINEERING_JUNIOR].includes(role)
                    ? "Engineering Work"
                    : role === MATFLOW_ROLES.PPC ? "PPC Control" : "Work"
    );
    const displayNavLabel = (item) => {
        if (item.screen === "work") return workLabel;
        if (juniorDesignerOnly && item.screen === "projects") return "My Assigned Products";
        if (item.screen === "reports") return managementReports ? "Reports" : teamLabel;
        return item.label;
    };
    const effectiveHeader = location.pathname.startsWith("/matflow/work")
        ? ["", workLabel, juniorDesignerOnly ? "Only your assigned task and related Product / PD information." : "Department work on the shared Product / PD Production File."]
        : juniorDesignerOnly && location.pathname.startsWith("/matflow/projects")
            ? ["", "My Assigned Products", "Only PDs and Products linked to your assigned Design tasks."]
            : location.pathname.startsWith("/matflow/reports") && !managementReports
                ? ["", teamLabel, juniorDesignerOnly ? "Your assigned Design tasks and related Product / PD context." : "Department team workload, task ownership and handoff visibility."]
                : header;

    const renderNavItem = (item) => {
        const label = displayNavLabel(item);
        return (
            <Tooltip key={item.path} title={collapsed ? label : ""} placement="right">
                <NavLink to={item.path} end={item.path === "/matflow/dashboard"} style={({ isActive }) => linkStyle(isActive, collapsed)}>
                    <span style={{ display: "grid", placeItems: "center" }}>{item.icon}</span>
                    {!collapsed && <span>{label}</span>}
                </NavLink>
            </Tooltip>
        );
    };

    return (
        <Box sx={shellSx}>
            <Box component="aside" sx={sidebarSx(collapsed)}>
                <Box sx={logoSx}>
                    <Box sx={markSx}>M</Box>
                    {!collapsed && (
                        <Box sx={{ minWidth: 0 }}>
                            <Typography sx={logoTitleSx}>MatFlow</Typography>
                            <Typography sx={mutedSx}>Material Workflow</Typography>
                        </Box>
                    )}
                </Box>

                <Box sx={sidebarIdentitySx(collapsed)}>
                    <Box sx={avatarSx}>{String(user?.username || user?.name || "U").trim().charAt(0).toUpperCase() || "U"}</Box>
                    {!collapsed && (
                        <Box sx={{ minWidth: 0 }}>
                            <Typography noWrap sx={{ color: "var(--mf-text)", fontWeight: 900, fontSize: 12.5 }}>
                                {user?.username || user?.name || "User"}
                            </Typography>
                            <Typography noWrap sx={mutedSx}>{matFlowRoleLabel(role)}</Typography>
                        </Box>
                    )}
                </Box>
                <Divider sx={{ borderColor: "var(--mf-border)" }} />

                <Box component="nav" className="mf-sidebar-scroll" sx={{ py: .75, overflowY: "auto", overflowX: "hidden", flex: 1, scrollbarGutter: "stable" }}>
                    {["HOME", "PRIMARY", "REFERENCE", "CONTROL"].map((section) => {
                        const sectionItems = grouped[section] || [];
                        if (!sectionItems.length) return null;
                        return (
                            <Box key={section} sx={{ mb: .6 }}>
                                {!collapsed && (
                                    <Typography sx={sectionTitleSx}>
                                        {sectionLabel(section)}
                                    </Typography>
                                )}
                                {sectionItems.map(renderNavItem)}
                            </Box>
                        );
                    })}
                </Box>

                <Divider sx={{ borderColor: "var(--mf-border)" }} />
                <Button onClick={() => setCollapsed((value) => !value)} sx={{ ...secondaryBtnSx, m: .8, minWidth: 0 }}>
                    <MenuIcon />{!collapsed && <Box component="span" sx={{ ml: .8 }}>Collapse</Box>}
                </Button>
            </Box>

            <Box sx={mainSx(collapsed)}>
                <Box component="header" sx={headerSx}>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ color: "var(--mf-text)", fontWeight: 950, fontSize: 17 }}>{effectiveHeader[1]}</Typography>
                        <Typography sx={mutedSx}>{effectiveHeader[2]}</Typography>
                    </Box>

                    <Box sx={{ display: "flex", gap: .7, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {canUseGlobalProductFinder && (
                            <TextField
                                size="small"
                                value={globalProductSearch}
                                onChange={(event) => setGlobalProductSearch(event.target.value)}
                                onKeyDown={(event) => event.key === "Enter" && openGlobalProductFinder()}
                                placeholder="Find Product / PD No."
                                inputProps={{ "aria-label": "Find Product Name or PD No. anywhere in MatFlow" }}
                                InputProps={{
                                    startAdornment: <SearchOutlinedIcon sx={{ mr: .7, fontSize: 17, color: "var(--mf-text-muted)" }} />,
                                }}
                                sx={{
                                    display: { xs: "none", md: "block" },
                                    width: 220,
                                    "& .MuiOutlinedInput-root": { height: 36 },
                                }}
                            />
                        )}
                        {(canViewAllPlants || availablePlants.length > 1) && (
                            <TextField
                                select
                                size="small"
                                label="Plant"
                                value={selectedPlantCode}
                                onChange={(event) => setSelectedPlantCode(event.target.value)}
                                sx={{ minWidth: 135, "& .MuiOutlinedInput-root": { height: 36 } }}
                            >
                                {canViewAllPlants && <MenuItem value="ALL">All Plants</MenuItem>}
                                {availablePlants.map((plant) => <MenuItem key={plant} value={plant}>{plant}</MenuItem>)}
                            </TextField>
                        )}
                        <Tooltip title="Alerts & notifications">
                            <Button
                                onClick={() => {
                                    setNotificationsOpen(true);
                                    loadNotifications();
                                }}
                                sx={{ ...secondaryBtnSx, minWidth: 38, px: .8 }}
                            >
                                <Badge
                                    color="error"
                                    badgeContent={Math.min(Number(notificationFeed?.unreadCount || 0), 99)}
                                    invisible={!notificationFeed?.unreadCount}
                                    max={99}
                                >
                                    <NotificationsNoneOutlinedIcon />
                                </Badge>
                            </Button>
                        </Tooltip>
                        <Tooltip title={isDark ? "Light mode" : "Dark mode"}>
                            <Button onClick={toggleMode} sx={{ ...secondaryBtnSx, minWidth: 38, px: .8 }}>
                                {isDark ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
                            </Button>
                        </Tooltip>
                        <Tooltip title="Modules">
                            <Button onClick={() => navigate("/modules")} sx={{ ...secondaryBtnSx, minWidth: 38, px: .8 }}>
                                <AppsIcon />
                            </Button>
                        </Tooltip>
                        <Tooltip title="Logout">
                            <Button onClick={handleLogout} sx={{ ...secondaryBtnSx, minWidth: 38, px: .8 }}>
                                <LogoutIcon />
                            </Button>
                        </Tooltip>
                    </Box>
                </Box>

                <Box component="main" sx={contentSx}><Outlet /></Box>
            </Box>

            <Drawer
                anchor="right"
                open={notificationsOpen}
                onClose={() => setNotificationsOpen(false)}
                PaperProps={{
                    sx: {
                        width: { xs: "100%", sm: 410 },
                        maxWidth: "100vw",
                        background: "var(--mf-page-bg)",
                        color: "var(--mf-text)",
                        borderLeft: "1px solid var(--mf-border)",
                    },
                }}
            >
                <Box sx={{ p: 1.4, position: "sticky", top: 0, zIndex: 2, background: "var(--mf-header-bg)", backdropFilter: "blur(14px)", borderBottom: "1px solid var(--mf-border)" }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                        <Box>
                            <Typography sx={{ fontSize: 14, fontWeight: 950, color: "var(--mf-text)" }}>Alerts & notifications</Typography>
                            <Typography sx={mutedSx}>{notificationFeed?.unreadCount || 0} unread · updates automatically</Typography>
                        </Box>
                        <Button
                            startIcon={<DoneAllOutlinedIcon />}
                            onClick={markAllNotificationsRead}
                            disabled={!notificationFeed?.unreadCount}
                            sx={secondaryBtnSx}
                        >
                            Read all
                        </Button>
                    </Box>
                    {notificationError && (
                        <Typography sx={{ mt: .8, fontSize: 9.5, fontWeight: 750, color: "#ef4444" }}>
                            {notificationError}
                        </Typography>
                    )}
                </Box>

                <Box sx={{ p: 1, display: "grid", gap: .65 }}>
                    {(notificationFeed?.notifications || []).length === 0 ? (
                        <Box sx={{ p: 2.4, textAlign: "center", border: "1px dashed var(--mf-border)", borderRadius: 2 }}>
                            <NotificationsNoneOutlinedIcon sx={{ color: "var(--mf-text-muted)" }} />
                            <Typography sx={{ mt: .4, fontSize: 10, fontWeight: 800, color: "var(--mf-text-muted)" }}>No alerts or task notifications</Typography>
                        </Box>
                    ) : (notificationFeed?.notifications || []).map((notification) => {
                        const issueAlert = String(notification.referenceType || "").toUpperCase() === "ENGINEERING_QUERY";
                        const unreadBorder = issueAlert ? "var(--mf-warning-border)" : "var(--mf-primary-border)";
                        const unreadBackground = issueAlert ? "var(--mf-warning-soft)" : "var(--mf-primary-soft)";
                        const alertAccent = issueAlert ? "var(--mf-warning-text)" : "var(--mf-primary-text)";
                        return (
                            <Box
                                key={`${notification.referenceId}-${notification.updatedAt || notification.message || ""}`}
                                component="button"
                                type="button"
                                onClick={() => openTaskNotification(notification)}
                                sx={{
                                    width: "100%",
                                    textAlign: "left",
                                    p: 1,
                                    borderRadius: 2,
                                    border: notification.read ? "1px solid var(--mf-border)" : `1px solid ${unreadBorder}`,
                                    background: notification.read ? "var(--mf-panel-bg)" : unreadBackground,
                                    color: "inherit",
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                    "&:hover": { borderColor: issueAlert ? "var(--mf-warning-text)" : "var(--mf-primary)" },
                                }}
                            >
                                <Box sx={{ display: "flex", justifyContent: "space-between", gap: .7, alignItems: "center" }}>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: .45, minWidth: 0 }}>
                                        {issueAlert && <ForumOutlinedIcon sx={{ fontSize: 13, color: alertAccent, flex: "0 0 auto" }} />}
                                        <Typography noWrap sx={{ fontSize: 9, fontWeight: 950, color: alertAccent, letterSpacing: ".025em" }}>
                                            {issueAlert ? "ISSUE ALERT · " : ""}
                                            {notification.projectCode ? `PD No. ${notification.projectCode}` : "PD No. —"}
                                            {notification.referenceNumber ? ` · File ${notification.referenceNumber}` : ""}
                                        </Typography>
                                    </Box>
                                    {!notification.read && <Box sx={{ mt: .05, width: 7, height: 7, borderRadius: 99, bgcolor: issueAlert ? "var(--mf-warning-text)" : "var(--mf-primary)", flex: "0 0 auto" }} />}
                                </Box>
                                <Typography sx={{ mt: .3, fontSize: 11.2, fontWeight: 950, color: "var(--mf-text)" }}>
                                    {notification.productName || notification.title || "Product"}
                                </Typography>
                                <Typography sx={{ mt: .22, fontSize: 9.5, lineHeight: 1.45, fontWeight: 700, color: "var(--mf-text-secondary)" }}>
                                    {notification.message}
                                </Typography>
                                <Typography sx={{ mt: .5, fontSize: 8.7, fontWeight: 700, color: "var(--mf-text-muted)" }}>
                                    {issueAlert ? "Issue Chat" : readableNotificationStatus(notification.status)}
                                </Typography>
                            </Box>
                        );
                    })}
                </Box>
            </Drawer>
        </Box>
    );
}

const readableNotificationStatus = (value) => String(value || "").trim().toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Updated";


const shellSx = {
    minHeight: "100vh",
    background: "var(--mf-page-bg)",
};
const sidebarSx = (collapsed) => ({
    position: "fixed",
    inset: "0 auto 0 0",
    width: collapsed ? 64 : 208,
    zIndex: 1200,
    display: "flex",
    flexDirection: "column",
    background: "var(--mf-sidebar-bg)",
    borderRight: "1px solid var(--mf-border)",
    transition: "width .2s ease",
});
const mainSx = (collapsed) => ({
    ml: collapsed ? "64px" : "208px",
    minHeight: "100vh",
    transition: "margin-left .2s ease",
});
const logoSx = {
    minHeight: 58,
    px: 1.15,
    py: .9,
    display: "flex",
    gap: .8,
    alignItems: "center",
};
const markSx = {
    width: 32,
    height: 32,
    borderRadius: 2,
    display: "grid",
    placeItems: "center",
    background: "var(--mf-primary)",
    color: "#fff",
    fontWeight: 950,
};
const logoTitleSx = { color: "var(--mf-text)", fontWeight: 950, fontSize: 14.5, lineHeight: 1.1 };
const mutedSx = { color: "var(--mf-text-muted)", fontSize: 9.5, fontWeight: 700 };
const sidebarIdentitySx = (collapsed) => ({
    px: collapsed ? .7 : 1,
    py: .85,
    display: "flex",
    alignItems: "center",
    justifyContent: collapsed ? "center" : "flex-start",
    gap: .75,
});
const avatarSx = {
    width: 30,
    height: 30,
    flex: "0 0 auto",
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    color: "var(--mf-primary-text)",
    background: "var(--mf-primary-soft)",
    border: "1px solid var(--mf-primary-border)",
    fontSize: 11,
    fontWeight: 950,
};
const sectionTitleSx = {
    px: 1.15,
    pt: .55,
    pb: .2,
    color: "var(--mf-text-muted)",
    fontSize: 8.8,
    fontWeight: 950,
    letterSpacing: ".08em",
    textTransform: "uppercase",
};
const headerSx = {
    minHeight: 58,
    px: { xs: 1.25, md: 1.7 },
    py: .65,
    position: "sticky",
    top: 0,
    zIndex: 1100,
    display: "flex",
    justifyContent: "space-between",
    gap: 1.2,
    alignItems: "center",
    background: "var(--mf-header-bg)",
    backdropFilter: "blur(14px)",
    borderBottom: "1px solid var(--mf-border)",
};
const contentSx = {
    width: "100%",
    minWidth: 0,
    p: { xs: 1.05, md: 1.45 },
    maxWidth: "none",
    mx: 0,
};
const linkStyle = (active, collapsed) => ({
    display: "flex",
    alignItems: "center",
    gap: 9,
    minHeight: 34,
    margin: "2px 7px",
    padding: collapsed ? "7px 12px" : "7px 9px",
    borderRadius: 8,
    textDecoration: "none",
    fontSize: 10.8,
    fontWeight: active ? 900 : 760,
    color: active ? "var(--mf-primary-text)" : "var(--mf-text-secondary)",
    background: active ? "var(--mf-primary-soft)" : "transparent",
    border: active ? "1px solid var(--mf-primary-border)" : "1px solid transparent",
    transition: "background .14s ease,color .14s ease,border-color .14s ease",
});
