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
    canAccessMatFlowScreenForContext,
    matFlowRoleLabel,
    useMatFlow,
} from "./matflowUi";
import { secondaryBtnSx, useMatFlowTheme } from "./matflowUi";

import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
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
import MenuIcon from "@mui/icons-material/Menu";
import AppsIcon from "@mui/icons-material/Apps";
import LogoutIcon from "@mui/icons-material/Logout";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";

const NAV = [
    ["Universal Dashboard", "/matflow/dashboard", "dashboard", <DashboardOutlinedIcon />],
    ["Projects & Products", "/matflow/projects", "projects", <FolderOutlinedIcon />],
    ["Material Inventory", "/matflow/materials", "materials", <Inventory2OutlinedIcon />],
    ["Locations", "/matflow/locations", "locations", <LocationOnOutlinedIcon />],
    ["Operational BOMs", "/matflow/boms", "boms", <AccountTreeOutlinedIcon />],
    ["Production Requisitions", "/matflow/production", "production", <EngineeringOutlinedIcon />],
    ["Store", "/matflow/store", "store", <StorefrontOutlinedIcon />],
    ["Purchase", "/matflow/purchase", "purchase", <ShoppingCartOutlinedIcon />],
    ["GRN / Receiving", "/matflow/receiving", "receiving", <LocalShippingOutlinedIcon />],
    ["Quality Control", "/matflow/qc", "qc", <FactCheckOutlinedIcon />],
    ["Processing", "/matflow/processing", "processing", <PrecisionManufacturingOutlinedIcon />],
    ["Production Execution", "/matflow/production-execution", "production-execution", <PrecisionManufacturingOutlinedIcon />],
    ["Returns", "/matflow/returns", "returns", <KeyboardReturnOutlinedIcon />],
    ["Material Register", "/matflow/material-register", "material-register", <ReceiptLongOutlinedIcon />],
    ["Stock Ledger", "/matflow/ledger", "ledger", <ReceiptLongOutlinedIcon />],
    ["Reports", "/matflow/reports", "reports", <AssessmentOutlinedIcon />],
].map(([label, path, screen, icon]) => ({ label, path, screen, icon }));

const HEADER = [
    ["/matflow/dashboard", "MatFlow Universal Dashboard", "Overall insights + Work Kanban + Project tracker + Material tracker in one plant-aware command center"],
    ["/matflow/production-execution", "Production Execution", "Receive material → start Production → consume / waste / return → complete"],
    ["/matflow/boms", "Operational BOMs", "Section-wise MatFlow BOM Builder with Engineering authoring and Production review on the same page"],
    ["/matflow/store", "Store Material Control", "MR availability, reservation, QC choice, Store issue and shortage PI"],
    ["/matflow/production", "Production Material Requisitions", "BOM-backed MR demand and Production ownership"],
    ["/matflow/purchase", "Purchase", "Store-raised PI → vendor PO for exact shortage quantities"],
    ["/matflow/receiving", "GRN & Receiving", "PO receipt into Store stock before Store re-allocation"],
    ["/matflow/qc", "Quality Control", "MR-linked quality checks with PI / PO / GRN lineage when procurement is involved"],
    ["/matflow/processing", "Material Processing", "QC-routed jobs only: start, complete and release toward Production"],
    ["/matflow/returns", "Material Returns", "Production unused / excess material return control"],
    ["/matflow/material-register", "Material Register", "Derived purchased, issued, consumed, wasted, returned and stock quantities"],
    ["/matflow/ledger", "Stock Ledger", "Immutable physical inventory movement history"],
    ["/matflow/reports", "Reports", "Shortage, Product, stock and audit reporting"],
    ["/matflow/projects", "Projects & Products", "Approval-free Project → Product / Drawing administration"],
    ["/matflow/materials", "Material Inventory", "Operational material master and stock helper inputs"],
    ["/matflow/locations", "Locations", "Store, Processing and Production locations (QC is a Main Store checklist, not a location)"],
];

export default function MatFlowLayout() {
    const { user, logout } = useAuth();
    const { availablePlants, selectedPlantCode, selectedPlantParam, canViewAllPlants, setSelectedPlantCode, roles, role } = useMatFlow();
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

    const header = useMemo(
        () => HEADER.find(([path]) => location.pathname === path || location.pathname.startsWith(`${path}/`)) ||
            ["", "MatFlow", "Material operations control center"],
        [location.pathname]
    );

    const handleLogout = async () => {
        await logout();
        navigate("/login", { replace: true });
    };

    return (
        <Box sx={shellSx}>
            <Box component="aside" sx={sidebarSx(collapsed)}>
                <Box sx={logoSx}>
                    <Box sx={markSx}>M</Box>
                    {!collapsed && <Box><Typography sx={logoTitleSx}>MatFlow</Typography><Typography sx={mutedSx}>Material Operations</Typography></Box>}
                </Box>
                <Divider sx={{ borderColor: "var(--mf-border)" }} />
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
                <Box component="nav" className="mf-sidebar-scroll" sx={{ py: .9, px: .15, overflowY: "auto", overflowX: "hidden", flex: 1, scrollbarGutter: "stable" }}>
                    {items.map((item) => (
                        <Tooltip key={item.path} title={collapsed ? item.label : ""} placement="right">
                            <NavLink to={item.path} end={item.path === "/matflow/dashboard"} style={({ isActive }) => linkStyle(isActive, collapsed)}>
                                <span style={{ display: "grid", placeItems: "center" }}>{item.icon}</span>
                                {!collapsed && <span>{item.label}</span>}
                            </NavLink>
                        </Tooltip>
                    ))}
                </Box>
                <Divider sx={{ borderColor: "var(--mf-border)" }} />
                <Button onClick={() => setCollapsed((value) => !value)} sx={{ ...secondaryBtnSx, m: 1, minWidth: 0 }}>
                    <MenuIcon />{!collapsed && <Box component="span" sx={{ ml: 1 }}>Collapse</Box>}
                </Button>
            </Box>

            <Box sx={mainSx(collapsed)}>
                <Box component="header" sx={headerSx}>
                    <Box>
                        <Typography sx={{ color: "var(--mf-text)", fontWeight: 950, fontSize: 18 }}>{header[1]}</Typography>
                        <Typography sx={mutedSx}>{header[2]}</Typography>
                    </Box>

                    <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {availablePlants.length > 0 && (
                            <TextField
                                select
                                size="small"
                                label="Plant"
                                value={selectedPlantCode}
                                onChange={(event) => setSelectedPlantCode(event.target.value)}
                                sx={{ minWidth: 150, "& .MuiOutlinedInput-root": { height: 38 } }}
                            >
                                {canViewAllPlants && <MenuItem value="ALL">All Plants</MenuItem>}
                                {availablePlants.map((plant) => <MenuItem key={plant} value={plant}>{plant}</MenuItem>)}
                            </TextField>
                        )}
                        <Tooltip title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
                            <Button onClick={toggleMode} sx={{ ...secondaryBtnSx, minWidth: 42, px: 1 }}>
                                {isDark ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
                            </Button>
                        </Tooltip>
                        <Button startIcon={<AppsIcon />} onClick={() => navigate("/modules")} sx={secondaryBtnSx}>Modules</Button>
                        <Button startIcon={<LogoutIcon />} onClick={handleLogout} sx={secondaryBtnSx}>Logout</Button>
                    </Box>
                </Box>

                <Box sx={identitySx}>
                    <Typography sx={{ color: "var(--mf-text)", fontWeight: 850 }}>{user?.username || user?.name || "User"}</Typography>
                    <Typography sx={mutedSx}>{matFlowRoleLabel(role)}</Typography>
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
    width: collapsed ? 68 : 224,
    zIndex: 1200,
    display: "flex",
    flexDirection: "column",
    background: "var(--mf-sidebar-bg)",
    borderRight: "1px solid var(--mf-border)",
    boxShadow: "none",
    transition: "width .2s ease",
});
const mainSx = (collapsed) => ({
    ml: collapsed ? "68px" : "224px",
    minHeight: "100vh",
    transition: "margin-left .2s ease",
});
const logoSx = {
    minHeight: 66,
    px: 1.45,
    py: 1.15,
    display: "flex",
    gap: 1,
    alignItems: "center",
};
const markSx = {
    width: 36,
    height: 36,
    borderRadius: 2.2,
    display: "grid",
    placeItems: "center",
    background: "var(--mf-primary)",
    boxShadow: "0 7px 18px rgba(59,130,246,.16)",
    color: "#fff",
    fontWeight: 950,
};
const logoTitleSx = { color: "var(--mf-text)", fontWeight: 950, fontSize: 15.5, lineHeight: 1.1 };
const mutedSx = { color: "var(--mf-text-muted)", fontSize: 9.5, fontWeight: 700 };
const sidebarIdentitySx = (collapsed) => ({
    px: collapsed ? .9 : 1.2,
    py: 1.05,
    display: "flex",
    alignItems: "center",
    justifyContent: collapsed ? "center" : "flex-start",
    gap: .9,
});
const avatarSx = {
    width: 32,
    height: 32,
    flex: "0 0 auto",
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    color: "var(--mf-primary-text)",
    background: "var(--mf-primary-soft)",
    border: "1px solid var(--mf-primary-border)",
    fontSize: 11.5,
    fontWeight: 950,
};
const headerSx = {
    minHeight: 64,
    px: { xs: 1.6, md: 2.2 },
    py: .85,
    position: "sticky",
    top: 0,
    zIndex: 1100,
    display: "flex",
    justifyContent: "space-between",
    gap: 2,
    alignItems: "center",
    background: "var(--mf-header-bg)",
    backdropFilter: "blur(14px)",
    borderBottom: "1px solid var(--mf-border)",
};
const identitySx = { display: "none" };
const contentSx = {
    p: { xs: 1.35, md: 2 },
    maxWidth: 1640,
    mx: "auto",
};
const linkStyle = (active, collapsed) => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    minHeight: 38,
    margin: "3px 8px",
    padding: collapsed ? "8px 13px" : "8px 10px",
    borderRadius: 8,
    textDecoration: "none",
    fontSize: 11.2,
    fontWeight: active ? 900 : 760,
    color: active ? "var(--mf-primary-text)" : "var(--mf-text-secondary)",
    background: active ? "var(--mf-primary-soft)" : "transparent",
    border: active ? "1px solid var(--mf-primary-border)" : "1px solid transparent",
    transition: "background .14s ease,color .14s ease,border-color .14s ease",
});

