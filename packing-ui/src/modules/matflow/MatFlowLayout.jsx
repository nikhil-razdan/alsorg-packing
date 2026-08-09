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
    canAccessMatFlowScreen,
    getMatFlowRole,
    matFlowRoleLabel,
    useMatFlow,
} from "./matflowUi";
import { secondaryBtnSx, useMatFlowTheme } from "./matflowUi";

import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import TrackChangesOutlinedIcon from "@mui/icons-material/TrackChangesOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import ApprovalOutlinedIcon from "@mui/icons-material/ApprovalOutlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import SwapHorizOutlinedIcon from "@mui/icons-material/SwapHorizOutlined";
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
    ["Dashboard", "/matflow/dashboard", "dashboard", <DashboardOutlinedIcon />],
    ["Control Tower", "/matflow/tracker", "tracking", <TrackChangesOutlinedIcon />],
    ["Projects", "/matflow/projects", "projects", <FolderOutlinedIcon />],
    ["Materials", "/matflow/materials", "materials", <Inventory2OutlinedIcon />],
    ["Locations", "/matflow/locations", "locations", <LocationOnOutlinedIcon />],
    ["Operational BOMs", "/matflow/boms", "boms", <AccountTreeOutlinedIcon />],
    ["Production BOM Review", "/matflow/bom-approvals", "bom-review", <ApprovalOutlinedIcon />],
    ["Production Requisitions", "/matflow/production", "production", <EngineeringOutlinedIcon />],
    ["Production Execution", "/matflow/production-execution", "production-execution", <PrecisionManufacturingOutlinedIcon />],
    ["Store", "/matflow/store", "store", <StorefrontOutlinedIcon />],
    ["Transfers", "/matflow/transfers", "transfers", <SwapHorizOutlinedIcon />],
    ["Purchase", "/matflow/purchase", "purchase", <ShoppingCartOutlinedIcon />],
    ["PO Approvals", "/matflow/approvals", "approvals", <ApprovalOutlinedIcon />],
    ["Receiving", "/matflow/receiving", "receiving", <LocalShippingOutlinedIcon />],
    ["Quality Control", "/matflow/qc", "qc", <FactCheckOutlinedIcon />],
    ["Processing", "/matflow/processing", "processing", <PrecisionManufacturingOutlinedIcon />],
    ["Returns", "/matflow/returns", "returns", <KeyboardReturnOutlinedIcon />],
    ["Stock Ledger", "/matflow/ledger", "ledger", <ReceiptLongOutlinedIcon />],
    ["Reports", "/matflow/reports", "reports", <AssessmentOutlinedIcon />],
].map(([label, path, screen, icon]) => ({ label, path, screen, icon }));

const HEADER = [
    ["/matflow/production-execution", "Production Execution", "Production start, material consumption and finished-product completion"],
    ["/matflow/bom-approvals", "Production BOM Review", "Approve or return Engineering-submitted BOM revisions"],
    ["/matflow/boms", "Operational BOMs", "Engineering material structure and approved route control"],
    ["/matflow/store", "Store Material Control", "Availability, reservation, shortage, indent and issue"],
    ["/matflow/production", "Production Material Control", "Requisitions, issue readiness and finished-product lifecycle"],
    ["/matflow/transfers", "Material Transfers", "Movement between Store, QC, Processing and Production"],
    ["/matflow/purchase", "Purchase", "Purchase orders and vendors"],
    ["/matflow/approvals", "PO Approvals", "Independent Manager/Director commercial approval"],
    ["/matflow/receiving", "GRN & Receiving", "Receive approved purchase orders into QC-blocked stock"],
    ["/matflow/qc", "Quality Control", "Inspect received and transferred material"],
    ["/matflow/processing", "Material Processing", "Processing inputs, outputs, yield and wastage"],
    ["/matflow/returns", "Material Returns", "Controlled return movements"],
    ["/matflow/tracker", "MatFlow Control Tower", "Server-computed project and material workflow status"],
    ["/matflow/ledger", "Stock Ledger", "Immutable material movement history"],
    ["/matflow/reports", "Reports", "Shortage, project, stock and audit reporting"],
    ["/matflow/projects", "Projects & Drawings", "Client project and product/drawing master"],
    ["/matflow/materials", "Material Master", "Standardized operational material records"],
    ["/matflow/locations", "Locations", "Store, Production, Processing and QC destinations"],
];

export default function MatFlowLayout() {
    const { user, role, logout } = useAuth();
    const { availablePlants, selectedPlantCode, setSelectedPlantCode } = useMatFlow();
    const { isDark, toggleMode } = useMatFlowTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);
    const cleanRole = getMatFlowRole(role || user?.role);

    const items = useMemo(
        () => NAV.filter((item) => canAccessMatFlowScreen(item.screen, cleanRole)),
        [cleanRole]
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
                <Box component="nav" sx={{ py: 1, overflowY: "auto", flex: 1 }}>
                    {items.map((item) => (
                        <Tooltip key={item.path} title={collapsed ? item.label : ""} placement="right">
                            <NavLink to={item.path} style={({ isActive }) => linkStyle(isActive, collapsed)}>
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
                                <MenuItem value="ALL">All Plants</MenuItem>
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
                    <Typography sx={mutedSx}>{matFlowRoleLabel(cleanRole)}</Typography>
                </Box>

                <Box component="main" sx={contentSx}><Outlet /></Box>
            </Box>
        </Box>
    );
}

const shellSx = { minHeight: "100vh", background: "var(--mf-page-bg)" };
const sidebarSx = (collapsed) => ({
    position: "fixed", inset: "0 auto 0 0", width: collapsed ? 74 : 248, zIndex: 1200,
    display: "flex", flexDirection: "column", background: "var(--mf-sidebar-bg)",
    borderRight: "1px solid var(--mf-border)", transition: "width .2s ease",
});
const mainSx = (collapsed) => ({ ml: collapsed ? "74px" : "248px", minHeight: "100vh", transition: "margin-left .2s ease" });
const logoSx = { minHeight: 72, p: 1.5, display: "flex", gap: 1.2, alignItems: "center" };
const markSx = { width: 40, height: 40, borderRadius: 2.5, display: "grid", placeItems: "center", background: "linear-gradient(135deg,#0284c7,#38bdf8)", color: "#fff", fontWeight: 950 };
const logoTitleSx = { color: "var(--mf-text)", fontWeight: 950, fontSize: 17 };
const mutedSx = { color: "var(--mf-text-muted)", fontSize: 10.5, fontWeight: 700 };
const headerSx = { minHeight: 72, px: { xs: 2, md: 2.5 }, py: 1.2, position: "sticky", top: 0, zIndex: 1100, display: "flex", justifyContent: "space-between", gap: 2, alignItems: "center", background: "var(--mf-header-bg)", borderBottom: "1px solid var(--mf-border)" };
const identitySx = { display: "none" };
const contentSx = { p: { xs: 1.5, md: 2.25 }, maxWidth: 1700, mx: "auto" };
const linkStyle = (active, collapsed) => ({
    display: "flex", alignItems: "center", gap: 12, margin: "4px 8px", padding: collapsed ? "10px 16px" : "10px 12px",
    borderRadius: 10, textDecoration: "none", fontSize: 12, fontWeight: active ? 900 : 750,
    color: active ? "#7dd3fc" : "var(--mf-text-secondary)",
    background: active ? "rgba(14,165,233,.13)" : "transparent",
    border: active ? "1px solid rgba(14,165,233,.22)" : "1px solid transparent",
});
