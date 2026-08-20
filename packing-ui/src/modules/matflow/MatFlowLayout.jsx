import { useMemo, useState } from "react";
import {
    Box,
    Button,
    Divider,
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

const NAV = [
    ["Dashboard", "/matflow/dashboard", "dashboard", <DashboardOutlinedIcon />],
    ["Projects", "/matflow/projects", "projects", <FolderOutlinedIcon />],
    ["Materials", "/matflow/materials", "materials", <Inventory2OutlinedIcon />],
    ["BOMs", "/matflow/boms", "boms", <AccountTreeOutlinedIcon />],
    ["Requisitions", "/matflow/production", "production", <EngineeringOutlinedIcon />],
    ["Store", "/matflow/store", "store", <StorefrontOutlinedIcon />],
    ["Purchase", "/matflow/purchase", "purchase", <ShoppingCartOutlinedIcon />],
    ["Receiving", "/matflow/receiving", "receiving", <LocalShippingOutlinedIcon />],
    ["QC", "/matflow/qc", "qc", <FactCheckOutlinedIcon />],
    ["Processing", "/matflow/processing", "processing", <PrecisionManufacturingOutlinedIcon />],
    ["Processing Units", "/matflow/processing-units", "processing-units", <PrecisionManufacturingOutlinedIcon />],
    ["Production", "/matflow/production-execution", "production-execution", <PrecisionManufacturingOutlinedIcon />],
    ["Returns", "/matflow/returns", "returns", <KeyboardReturnOutlinedIcon />],
    ["Exceptions", "/matflow/exceptions", "exceptions", <WarningAmberOutlinedIcon />],
    ["Usage Register", "/matflow/material-register", "material-register", <ReceiptLongOutlinedIcon />],
    ["Movement Audit", "/matflow/ledger", "ledger", <ReceiptLongOutlinedIcon />],
    ["Reports", "/matflow/reports", "reports", <AssessmentOutlinedIcon />],
].map(([label, path, screen, icon]) => ({ label, path, screen, icon }));

const PRIMARY_SCREENS = Object.freeze({
    [MATFLOW_ROLES.ADMIN]: new Set(["projects", "boms", "production", "store", "purchase", "receiving", "qc", "processing", "production-execution", "returns"]),
    [MATFLOW_ROLES.MANAGER]: new Set(["projects", "boms", "production", "store", "purchase", "receiving", "qc", "processing", "production-execution", "returns"]),
    [MATFLOW_ROLES.ENGINEERING]: new Set(["projects", "boms", "processing-units"]),
    [MATFLOW_ROLES.PRODUCTION]: new Set(["production", "production-execution", "returns"]),
    [MATFLOW_ROLES.STORE]: new Set(["store", "receiving", "returns"]),
    [MATFLOW_ROLES.PURCHASE]: new Set(["purchase"]),
    [MATFLOW_ROLES.QC]: new Set(["qc"]),
    [MATFLOW_ROLES.PROCESSING]: new Set(["processing"]),
    [MATFLOW_ROLES.DIRECTOR]: new Set([]),
});

const CONTROL_SCREENS = new Set(["exceptions", "ledger", "reports"]);
const REFERENCE_SCREENS = new Set(["projects", "materials", "boms", "processing-units", "material-register"]);

const HEADER = [
    ["/matflow/dashboard", "MatFlow Dashboard", "Overall workflow, tracker and bottlenecks."],
    ["/matflow/production-execution", "Production", "Receive material, start work and close material accounting."],
    ["/matflow/boms", "BOMs", "Engineering BOM creation and Production review."],
    ["/matflow/store", "Store", "Forward MR, check availability, allocate and hand over material."],
    ["/matflow/production", "Requisitions", "Production material demand against an effective BOM."],
    ["/matflow/purchase", "Purchase", "Shortage PI to vendor PO."],
    ["/matflow/receiving", "Receiving", "GRN at AL-P1 Main Store."],
    ["/matflow/qc", "Quality Control", "Simple MR-linked material check."],
    ["/matflow/processing-units", "Processing Units", "Approved Processing Unit master."],
    ["/matflow/processing", "Processing", "Start and complete BOM-routed processing jobs."],
    ["/matflow/returns", "Returns", "Unused/excess material back through the fixed plant route."],
    ["/matflow/exceptions", "Exceptions & Recovery", "Record, contain, recover and close operational mistakes."],
    ["/matflow/material-register", "Usage Register", "Purchased, issued, consumed, waste and returned quantities."],
    ["/matflow/ledger", "Movement Audit", "Immutable material movement and actor/time trail."],
    ["/matflow/reports", "Reports", "Management and workflow reports."],
    ["/matflow/projects", "Projects", "PD / Project and Product / Drawing setup."],
    ["/matflow/materials", "Materials", "Material catalogue and usage reference."],
];

const sectionLabel = (section) => ({
    HOME: "Home",
    PRIMARY: "My Work",
    REFERENCE: "Reference",
    CONTROL: "Control & Reports",
}[section] || section);

const sectionFor = (item, role) => {
    if (item.screen === "dashboard") return "HOME";
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
            ["", "MatFlow", "Material workflow"],
        [location.pathname]
    );

    const handleLogout = async () => {
        await logout();
        navigate("/login", { replace: true });
    };

    const renderNavItem = (item) => (
        <Tooltip key={item.path} title={collapsed ? item.label : ""} placement="right">
            <NavLink to={item.path} end={item.path === "/matflow/dashboard"} style={({ isActive }) => linkStyle(isActive, collapsed)}>
                <span style={{ display: "grid", placeItems: "center" }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
            </NavLink>
        </Tooltip>
    );

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
                        <Typography sx={{ color: "var(--mf-text)", fontWeight: 950, fontSize: 17 }}>{header[1]}</Typography>
                        <Typography sx={mutedSx}>{header[2]}</Typography>
                    </Box>

                    <Box sx={{ display: "flex", gap: .7, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
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
                        <Button
                            startIcon={<WarningAmberOutlinedIcon />}
                            onClick={() => navigate(`/matflow/exceptions?new=1&from=${encodeURIComponent(location.pathname)}`)}
                            sx={secondaryBtnSx}
                        >
                            Report Issue
                        </Button>
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
        </Box>
    );
}

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
    p: { xs: 1.05, md: 1.45 },
    maxWidth: 1640,
    mx: "auto",
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
