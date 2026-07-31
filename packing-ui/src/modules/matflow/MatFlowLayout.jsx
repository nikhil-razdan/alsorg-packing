import {
    useMemo,
    useState,
} from "react";

import {
    Box,
    Button,
    Chip,
    Divider,
    IconButton,
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

import {
    useAuth,
} from "../../auth/AuthContext";

import {
    canAccessMatFlowScreen,
    getMatFlowRole,
    matFlowRoleLabel,
} from "../../utils/matflowAccess";

import {
    useMatFlow,
} from "./MatFlowContext";

import MatFlowThemeToggle
    from "./MatFlowThemeToggle";

import DashboardOutlinedIcon
    from "@mui/icons-material/DashboardOutlined";
import FolderOutlinedIcon
    from "@mui/icons-material/FolderOutlined";
import Inventory2OutlinedIcon
    from "@mui/icons-material/Inventory2Outlined";
import AccountTreeOutlinedIcon
    from "@mui/icons-material/AccountTreeOutlined";
import ApprovalOutlinedIcon
    from "@mui/icons-material/ApprovalOutlined";
import EngineeringOutlinedIcon
    from "@mui/icons-material/EngineeringOutlined";
import StorefrontOutlinedIcon
    from "@mui/icons-material/StorefrontOutlined";
import SwapHorizOutlinedIcon
    from "@mui/icons-material/SwapHorizOutlined";
import DescriptionOutlinedIcon
    from "@mui/icons-material/DescriptionOutlined";
import ShoppingCartOutlinedIcon
    from "@mui/icons-material/ShoppingCartOutlined";
import LocalShippingOutlinedIcon
    from "@mui/icons-material/LocalShippingOutlined";
import FactCheckOutlinedIcon
    from "@mui/icons-material/FactCheckOutlined";
import PrecisionManufacturingOutlinedIcon
    from "@mui/icons-material/PrecisionManufacturingOutlined";
import KeyboardReturnOutlinedIcon
    from "@mui/icons-material/KeyboardReturnOutlined";
import ReceiptLongOutlinedIcon
    from "@mui/icons-material/ReceiptLongOutlined";
import AssessmentOutlinedIcon
    from "@mui/icons-material/AssessmentOutlined";
import MenuIcon
    from "@mui/icons-material/Menu";
import AppsIcon
    from "@mui/icons-material/Apps";
import LogoutIcon
    from "@mui/icons-material/Logout";
import LocationOnOutlinedIcon
    from "@mui/icons-material/LocationOnOutlined";
import TrackChangesOutlinedIcon
    from "@mui/icons-material/TrackChangesOutlined";

const SIDEBAR_KEY =
    "matflowSidebarCollapsed";

const readSidebarState = () => {
    try {
        return (
            window.localStorage.getItem(
                SIDEBAR_KEY
            ) === "true"
        );
    } catch {
        return false;
    }
};

const saveSidebarState = (
    value
) => {
    try {
        window.localStorage.setItem(
            SIDEBAR_KEY,
            String(value)
        );
    } catch {
        // Storage may be unavailable in restricted browsing.
    }
};

const navItems = [
    {
        label: "Dashboard",
        path: "/matflow/dashboard",
        screen: "dashboard",
        icon: <DashboardOutlinedIcon />,
    },
    {
        key: "tracker",
        label: "Control Tower",
        path: "/matflow/tracker",
        screen: "tracking",
        icon: <TrackChangesOutlinedIcon />,
    },
    {
        label: "Projects",
        path: "/matflow/projects",
        screen: "projects",
        icon: <FolderOutlinedIcon />,
    },
    {
        label: "Materials",
        path: "/matflow/materials",
        screen: "materials",
        icon: <Inventory2OutlinedIcon />,
    },
    {
        label: "Operational BOMs",
        path: "/matflow/boms",
        screen: "boms",
        icon: <AccountTreeOutlinedIcon />,
    },
    {
        label: "BOM Approvals",
        path: "/matflow/bom-approvals",
        screen: "bom-approval",
        icon: <ApprovalOutlinedIcon />,
    },
    {
        label: "Production",
        path: "/matflow/production",
        screen: "production",
        icon: <EngineeringOutlinedIcon />,
    },
    {
        label: "Locations",
        path: "/matflow/locations",
        screen: "store",
        icon: <LocationOnOutlinedIcon />,
    },
    {
        label: "Store",
        path: "/matflow/store",
        screen: "store",
        icon: <StorefrontOutlinedIcon />,
    },
    {
        label: "Transfers",
        path: "/matflow/transfers",
        screen: "transfers",
        icon: <SwapHorizOutlinedIcon />,
    },
    {
        label: "Indents",
        path: "/matflow/indents",
        screen: "indents",
        icon: <DescriptionOutlinedIcon />,
    },
    {
        label: "Purchase",
        path: "/matflow/purchase",
        screen: "purchase",
        icon: <ShoppingCartOutlinedIcon />,
    },
    {
        label: "PO Approvals",
        path: "/matflow/approvals",
        screen: "approvals",
        icon: <ApprovalOutlinedIcon />,
    },
    {
        label: "Receiving",
        path: "/matflow/receiving",
        screen: "receiving",
        icon: <LocalShippingOutlinedIcon />,
    },
    {
        label: "Quality Control",
        path: "/matflow/qc",
        screen: "qc",
        icon: <FactCheckOutlinedIcon />,
    },
    {
        label: "Processing",
        path: "/matflow/processing",
        screen: "processing",
        icon: <PrecisionManufacturingOutlinedIcon />,
    },
    {
        label: "Returns",
        path: "/matflow/returns",
        screen: "returns",
        icon: <KeyboardReturnOutlinedIcon />,
    },
    {
        label: "Stock Ledger",
        path: "/matflow/ledger",
        screen: "ledger",
        icon: <ReceiptLongOutlinedIcon />,
    },
    {
        label: "Reports",
        path: "/matflow/reports",
        screen: "reports",
        icon: <AssessmentOutlinedIcon />,
    },
];

const headerMeta = [
    {
        match: "/matflow/tracker",
        title: "Project & Material Control Tower",
        subtitle:
            "Project health, readiness, shortages and material movement",
    },
    {
        match: "/matflow/projects",
        title: "Projects and Drawings",
        subtitle:
            "Project, PD and drawing material control",
    },
    {
        match: "/matflow/materials",
        title: "Material Master",
        subtitle:
            "Material codes, units and specifications",
    },
    {
        match: "/matflow/bom-approvals",
        title: "BOM Approvals",
        subtitle:
            "Operational BOM review and approval",
    },
    {
        match: "/matflow/boms",
        title: "Operational BOMs",
        subtitle:
            "Project-specific material planning",
    },
    {
        match: "/matflow/requisitions/new",
        title: "New Production Requisition",
        subtitle:
            "Raise material demand against an effective operational BOM",
    },
    {
        match: "/matflow/requisitions",
        title: "Material Requisition",
        subtitle:
            "Demand, reservation, shortage and issue tracking",
    },
    {
        match: "/matflow/production",
        title: "Production Requisitions",
        subtitle:
            "Material demand, issue and consumption",
    },
    {
        match: "/matflow/locations",
        title: "MatFlow Locations",
        subtitle:
            "Production, store, processing and movement destinations",
    },
    {
        match: "/matflow/store",
        title: "Store and Reservations",
        subtitle:
            "Stock commitment, shortage and source planning",
    },
    {
        match: "/matflow/transfers",
        title: "Material Transfers",
        subtitle:
            "Plant, QC and processing movement",
    },
    {
        match: "/matflow/indents",
        title: "Material Indents",
        subtitle:
            "Shortage and procurement demand",
    },
    {
        match: "/matflow/approvals",
        title: "PO Approvals",
        subtitle:
            "Director commercial approval queue",
    },
    {
        match: "/matflow/purchase",
        title: "Purchase and Vendors",
        subtitle:
            "Purchase orders and vendor control",
    },
    {
        match: "/matflow/receiving",
        title: "GRN and Receiving",
        subtitle:
            "Purchased material receipt",
    },
    {
        match: "/matflow/qc",
        title: "Quality Control",
        subtitle:
            "Incoming and transfer inspection",
    },
    {
        match: "/matflow/processing",
        title: "Material Processing",
        subtitle:
            "Input, output, yield and wastage",
    },
    {
        match: "/matflow/returns",
        title: "Material Returns",
        subtitle:
            "Return dispatch and receipt",
    },
    {
        match: "/matflow/ledger",
        title: "Stock Ledger",
        subtitle:
            "Immutable material movement history",
    },
    {
        match: "/matflow/reports",
        title: "MatFlow Reports",
        subtitle:
            "Material operations and shortage reporting",
    },
];

const matchesPath = (
    pathname,
    match
) => {
    return (
        pathname === match ||
        pathname.startsWith(
            `${match}/`
        )
    );
};

const getHeaderMeta = (
    pathname
) => {
    return (
        headerMeta.find(
            (item) =>
                matchesPath(
                    pathname,
                    item.match
                )
        ) || {
            title: "MatFlow Dashboard",
            subtitle:
                "Material operations control center",
        }
    );
};

export default function MatFlowLayout() {
    const location =
        useLocation();

    const navigate =
        useNavigate();

    const {
        user,
        role,
        logout,
    } = useAuth();

    const {
        availablePlants,
        selectedPlantCode,
        setSelectedPlantCode,
    } = useMatFlow();

    const [
        collapsed,
        setCollapsed,
    ] = useState(
        readSidebarState
    );

    const cleanRole =
        getMatFlowRole(role);

    const username =
        user?.username ||
        user?.name ||
        "User";

    const visibleItems =
        useMemo(
            () =>
                navItems.filter(
                    (item) =>
                        canAccessMatFlowScreen(
                            item.screen,
                            cleanRole
                        )
                ),
            [cleanRole]
        );

    const pageHeader =
        useMemo(
            () =>
                getHeaderMeta(
                    location.pathname
                ),
            [location.pathname]
        );

    const toggleSidebar = () => {
        setCollapsed(
            (current) => {
                const next =
                    !current;

                saveSidebarState(
                    next
                );

                return next;
            }
        );
    };

    const handleLogout =
        async () => {
            await logout();

            navigate(
                "/login",
                {
                    replace: true,
                }
            );
        };

    return (
        <Box sx={shellSx}>
            <Box
                component="aside"
                sx={sidebarSx(
                    collapsed
                )}
            >
                <Box
                    sx={logoRowSx(
                        collapsed
                    )}
                >
                    <Box sx={logoMarkSx}>
                        M
                    </Box>

                    {!collapsed && (
                        <Box>
                            <Typography sx={logoTitleSx}>
                                MatFlow
                            </Typography>

                            <Typography sx={logoSubSx}>
                                Material Operations
                            </Typography>
                        </Box>
                    )}
                </Box>

                <Divider sx={dividerSx} />

                <Box
                    component="nav"
                    sx={navListSx}
                >
                    {visibleItems.map(
                        (item) => (
                            <Tooltip
                                key={item.path}
                                title={
                                    collapsed
                                        ? item.label
                                        : ""
                                }
                                placement="right"
                                arrow
                            >
                                <NavLink
                                    to={item.path}
                                    style={({
                                        isActive,
                                    }) =>
                                        navLinkStyle(
                                            isActive,
                                            collapsed
                                        )
                                    }
                                >
                                    <span
                                        style={navIconStyle}
                                    >
                                        {item.icon}
                                    </span>

                                    {!collapsed && (
                                        <span>
                                            {item.label}
                                        </span>
                                    )}
                                </NavLink>
                            </Tooltip>
                        )
                    )}
                </Box>

                <Box
                    sx={userCardSx(
                        collapsed
                    )}
                >
                    <Box sx={avatarSx}>
                        {username
                            .charAt(0)
                            .toUpperCase()}
                    </Box>

                    {!collapsed && (
                        <Box sx={{ minWidth: 0 }}>
                            <Typography sx={userNameSx}>
                                {username}
                            </Typography>

                            <Typography sx={userRoleSx}>
                                {matFlowRoleLabel(
                                    cleanRole
                                )}
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Box>

            <Box sx={mainSx}>
                <Box
                    component="header"
                    sx={headerSx}
                >
                    <Box sx={headerLeftSx}>
                        <IconButton
                            onClick={toggleSidebar}
                            aria-label={
                                collapsed
                                    ? "Expand MatFlow navigation"
                                    : "Collapse MatFlow navigation"
                            }
                            sx={iconButtonSx}
                        >
                            <MenuIcon />
                        </IconButton>

                        <Box sx={{ minWidth: 0 }}>
                            <Typography sx={headerTitleSx}>
                                {pageHeader.title}
                            </Typography>

                            <Typography sx={headerSubSx}>
                                {pageHeader.subtitle}
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={headerActionsSx}>
                        <TextField
                            select
                            value={
                                selectedPlantCode ||
                                "ALL"
                            }
                            onChange={(event) =>
                                setSelectedPlantCode(
                                    event.target.value
                                )
                            }
                            size="small"
                            aria-label="Selected MatFlow plant"
                            sx={plantFieldSx}
                        >
                            <MenuItem value="ALL">
                                All Allowed Plants
                            </MenuItem>

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

                        <Box
                            sx={{
                                display: {
                                    xs: "none",
                                    sm: "block",
                                },
                            }}
                        >
                            <MatFlowThemeToggle />
                        </Box>

                        <Box
                            sx={{
                                display: {
                                    xs: "block",
                                    sm: "none",
                                },
                            }}
                        >
                            <MatFlowThemeToggle
                                compact
                            />
                        </Box>

                        <Chip
                            label="● Session Active"
                            sx={healthChipSx}
                        />

                        <Button
                            startIcon={<AppsIcon />}
                            onClick={() =>
                                navigate(
                                    "/modules"
                                )
                            }
                            sx={headerButtonSx}
                        >
                            Modules
                        </Button>

                        <Button
                            startIcon={<LogoutIcon />}
                            onClick={handleLogout}
                            sx={{
                                ...headerButtonSx,
                                color:
                                    "var(--mf-danger-text)",
                            }}
                        >
                            Logout
                        </Button>
                    </Box>
                </Box>

                <Box
                    component="main"
                    sx={contentSx}
                >
                    <Outlet />
                </Box>
            </Box>
        </Box>
    );
}

const shellSx = {
    display: "flex",
    width: "100%",
    minHeight: "100vh",
    background:
        "var(--mf-page-bg)",
    color:
        "var(--mf-text)",
    transition:
        "background-color .22s ease, color .22s ease",
};

const sidebarSx = (
    collapsed
) => ({
    width:
        collapsed
            ? "78px"
            : "244px",

    height: "100dvh",
    position: "sticky",
    top: 0,
    display: "flex",
    flexDirection: "column",

    p:
        collapsed
            ? "16px 8px"
            : "16px 12px",

    boxSizing: "border-box",
    background:
        "var(--mf-sidebar-bg)",

    borderRight:
        "1px solid var(--mf-border)",

    boxShadow:
        "var(--mf-shadow)",

    overflow: "hidden",
    flexShrink: 0,

    transition:
        "width .24s ease, padding .24s ease, background .22s ease",
});

const logoRowSx = (
    collapsed
) => ({
    display: "flex",
    alignItems: "center",

    justifyContent:
        collapsed
            ? "center"
            : "flex-start",

    gap: "11px",
    mb: "15px",
});

const logoMarkSx = {
    width: "38px",
    height: "38px",
    borderRadius: "11px",
    display: "grid",
    placeItems: "center",
    color: "#ffffff",
    fontWeight: 950,
    background:
        "linear-gradient(135deg,#0284c7,#0ea5e9)",
    flexShrink: 0,
    boxShadow:
        "0 8px 18px rgba(14,165,233,.24)",
};

const logoTitleSx = {
    color:
        "var(--mf-sidebar-text)",
    fontSize: "18px",
    fontWeight: 950,
    lineHeight: 1,
};

const logoSubSx = {
    mt: "4px",
    color:
        "var(--mf-sidebar-muted)",
    fontSize: "10px",
    fontWeight: 750,
};

const dividerSx = {
    borderColor:
        "var(--mf-divider)",
};

const navListSx = {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    mt: "14px",
    overflowY: "auto",
    overflowX: "hidden",
    flex: 1,
    pr: "2px",

    "&::-webkit-scrollbar": {
        width: "5px",
    },

    "&::-webkit-scrollbar-thumb": {
        background:
            "var(--mf-scroll-thumb)",
        borderRadius: 999,
    },
};

const navLinkStyle = (
    active,
    collapsed
) => ({
    minHeight: 40,

    padding:
        collapsed
            ? "0"
            : "0 10px",

    borderRadius: 10,
    display: "flex",
    alignItems: "center",

    justifyContent:
        collapsed
            ? "center"
            : "flex-start",

    gap:
        collapsed
            ? 0
            : 10,

    textDecoration: "none",

    color:
        active
            ? "var(--mf-sidebar-text)"
            : "var(--mf-sidebar-muted)",

    background:
        active
            ? "var(--mf-sidebar-active-bg)"
            : "transparent",

    border:
        active
            ? "1px solid var(--mf-sidebar-active-border)"
            : "1px solid transparent",

    fontSize: 11.5,
    fontWeight: 850,
    flexShrink: 0,

    transition:
        "background .16s ease, color .16s ease, border-color .16s ease",
});

const navIconStyle = {
    width: 22,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
};

const userCardSx = (
    collapsed
) => ({
    minHeight: "54px",
    mt: "10px",

    p:
        collapsed
            ? "8px 5px"
            : "8px 9px",

    borderRadius: "12px",
    display: "flex",
    alignItems: "center",

    justifyContent:
        collapsed
            ? "center"
            : "flex-start",

    gap: "9px",

    background:
        "var(--mf-surface-soft)",

    border:
        "1px solid var(--mf-border)",
});

const avatarSx = {
    width: "35px",
    height: "35px",
    borderRadius: "10px",
    display: "grid",
    placeItems: "center",
    color: "#ffffff",
    fontWeight: 950,
    background:
        "linear-gradient(135deg,#0284c7,#0ea5e9)",
    flexShrink: 0,
};

const userNameSx = {
    color:
        "var(--mf-sidebar-text)",
    fontSize: "12px",
    fontWeight: 900,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const userRoleSx = {
    mt: "2px",
    color:
        "var(--mf-sidebar-muted)",
    fontSize: "9.5px",
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const mainSx = {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
};

const headerSx = {
    minHeight: "66px",

    px: {
        xs: "10px",
        md: "20px",
    },

    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",

    position: "sticky",
    top: 0,
    zIndex: 40,

    background:
        "var(--mf-header-bg)",

    borderBottom:
        "1px solid var(--mf-border)",

    boxShadow:
        "0 8px 22px rgba(15,23,42,.05)",

    transition:
        "background .22s ease, border-color .22s ease",
};

const headerLeftSx = {
    display: "flex",
    alignItems: "center",
    gap: "11px",
    minWidth: 0,
};

const headerTitleSx = {
    color:
        "var(--mf-text)",
    fontSize: "17px",
    fontWeight: 950,
    lineHeight: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const headerSubSx = {
    mt: "4px",
    color: "#0284c7",
    fontSize: "10px",
    fontWeight: 800,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const iconButtonSx = {
    width: "38px",
    height: "38px",
    borderRadius: "10px",
    color:
        "var(--mf-text-secondary)",
    background:
        "var(--mf-surface-soft)",
    border:
        "1px solid var(--mf-border)",

    "&:hover": {
        background:
            "var(--mf-hover)",
    },
};

const headerActionsSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "7px",
    minWidth: 0,
};

const plantFieldSx = {
    minWidth: "175px",

    "& .MuiOutlinedInput-root": {
        height: "36px",
        borderRadius: "9px",
        color:
            "var(--mf-text)",
        fontSize: "11px",
        fontWeight: 800,
        background:
            "var(--mf-field-bg)",

        "& fieldset": {
            borderColor:
                "var(--mf-border)",
        },

        "&:hover fieldset": {
            borderColor:
                "var(--mf-border-strong)",
        },
    },

    "& .MuiSvgIcon-root": {
        color:
            "var(--mf-text-muted)",
    },

    "@media (max-width: 1000px)": {
        display: "none",
    },
};

const healthChipSx = {
    height: "28px",
    borderRadius: 999,
    color: "#16a34a",
    background:
        "rgba(34,197,94,.10)",
    border:
        "1px solid rgba(34,197,94,.22)",
    fontSize: "10px",
    fontWeight: 900,

    "@media (max-width: 800px)": {
        display: "none",
    },
};

const headerButtonSx = {
    height: "36px",
    borderRadius: "9px",
    textTransform: "none",
    color:
        "var(--mf-text)",
    fontSize: "11px",
    fontWeight: 850,
    background:
        "var(--mf-surface-soft)",
    border:
        "1px solid var(--mf-border)",

    "&:hover": {
        background:
            "var(--mf-hover)",
    },

    "@media (max-width: 900px)": {
        display: "none",
    },
};

const contentSx = {
    flex: 1,

    p: {
        xs: "10px",
        md: "18px",
    },

    overflow: "auto",
    background:
        "var(--mf-content-bg)",

    transition:
        "background .22s ease",
};