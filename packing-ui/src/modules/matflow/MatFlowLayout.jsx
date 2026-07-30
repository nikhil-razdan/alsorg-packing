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

import { useAuth }
    from "../../auth/AuthContext";

import {
    canAccessMatFlowScreen,
    getMatFlowRole,
    matFlowRoleLabel,
} from "../../utils/matflowAccess";

import { useMatFlow }
    from "./MatFlowContext";

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

const SIDEBAR_KEY =
    "matflowSidebarCollapsed";

const navItems = [
    {
        label: "Dashboard",
        path: "/matflow/dashboard",
        screen: "dashboard",
        icon: <DashboardOutlinedIcon />,
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
        match: "/projects",
        title: "Projects and Drawings",
        subtitle:
            "Project, PD and drawing material control",
    },
    {
        match: "/materials",
        title: "Material Master",
        subtitle:
            "Material codes, units and specifications",
    },
    {
        match: "/bom-approvals",
        title: "BOM Approvals",
        subtitle:
            "Operational BOM review and approval",
    },
    {
        match: "/boms",
        title: "Operational BOMs",
        subtitle:
            "Project-specific material planning",
    },
    {
        match: "/production",
        title: "Production Requisitions",
        subtitle:
            "Material demand, issue and consumption",
    },
    {
        match: "/store",
        title: "Store and Reservations",
        subtitle:
            "Stock commitment and material issue",
    },
    {
        match: "/transfers",
        title: "Material Transfers",
        subtitle:
            "Plant, QC and processing movement",
    },
    {
        match: "/indents",
        title: "Material Indents",
        subtitle:
            "Shortage and procurement demand",
    },
    {
        match: "/approvals",
        title: "PO Approvals",
        subtitle:
            "Director commercial approval queue",
    },
    {
        match: "/purchase",
        title: "Purchase and Vendors",
        subtitle:
            "Purchase orders and vendor control",
    },
    {
        match: "/receiving",
        title: "GRN and Receiving",
        subtitle:
            "Purchased material receipt",
    },
    {
        match: "/qc",
        title: "Quality Control",
        subtitle:
            "Incoming and transfer inspection",
    },
    {
        match: "/processing",
        title: "Material Processing",
        subtitle:
            "Input, output, yield and wastage",
    },
    {
        match: "/returns",
        title: "Material Returns",
        subtitle:
            "Return dispatch and receipt",
    },
    {
        match: "/ledger",
        title: "Stock Ledger",
        subtitle:
            "Immutable material movement history",
    },
    {
        match: "/reports",
        title: "MatFlow Reports",
        subtitle:
            "Material operations and shortage reporting",
    },
];

const getHeaderMeta = (pathname) => {
    return (
        headerMeta.find((item) =>
            pathname.includes(item.match)
        ) || {
            title: "MatFlow Dashboard",
            subtitle:
                "Material operations control center",
        }
    );
};

export default function MatFlowLayout() {
    const location = useLocation();
    const navigate = useNavigate();

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

    const [collapsed, setCollapsed] =
        useState(() => {
            return (
                localStorage.getItem(
                    SIDEBAR_KEY
                ) === "true"
            );
        });

    const cleanRole =
        getMatFlowRole(role);

    const username =
        user?.username || "User";

    const visibleItems =
        useMemo(() => {
            return navItems.filter(
                (item) =>
                    canAccessMatFlowScreen(
                        item.screen,
                        cleanRole
                    )
            );
        }, [cleanRole]);

    const pageHeader =
        useMemo(
            () =>
                getHeaderMeta(
                    location.pathname
                ),
            [location.pathname]
        );

    const toggleSidebar = () => {
        setCollapsed((current) => {
            const next = !current;

            localStorage.setItem(
                SIDEBAR_KEY,
                String(next)
            );

            return next;
        });
    };

    const handleLogout = async () => {
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
            <Box sx={sidebarSx(collapsed)}>
                <Box sx={logoRowSx(collapsed)}>
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

                <Box sx={navListSx}>
                    {visibleItems.map((item) => (
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
                                style={({ isActive }) =>
                                    navLinkStyle(
                                        isActive,
                                        collapsed
                                    )
                                }
                            >
                                <span style={navIconStyle}>
                                    {item.icon}
                                </span>

                                {!collapsed && (
                                    <span>
                                        {item.label}
                                    </span>
                                )}
                            </NavLink>
                        </Tooltip>
                    ))}
                </Box>

                <Box sx={userCardSx(collapsed)}>
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
                <Box sx={headerSx}>
                    <Box sx={headerLeftSx}>
                        <IconButton
                            onClick={toggleSidebar}
                            sx={iconButtonSx}
                        >
                            <MenuIcon />
                        </IconButton>

                        <Box>
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
                            value={selectedPlantCode}
                            onChange={(event) =>
                                setSelectedPlantCode(
                                    event.target.value
                                )
                            }
                            size="small"
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

                        <Chip
                            label="● Session Active"
                            sx={healthChipSx}
                        />

                        <Button
                            startIcon={<AppsIcon />}
                            onClick={() =>
                                navigate("/modules")
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
                                color: "#fca5a5",
                            }}
                        >
                            Logout
                        </Button>
                    </Box>
                </Box>

                <Box sx={contentSx}>
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
        "linear-gradient(135deg,#020617 0%,#0f172a 52%,#111827 100%)",
};

const sidebarSx = (collapsed) => ({
    width: collapsed ? "78px" : "244px",
    height: "100vh",
    position: "sticky",
    top: 0,
    display: "flex",
    flexDirection: "column",
    p: collapsed
        ? "16px 8px"
        : "16px 12px",
    boxSizing: "border-box",
    background:
        "linear-gradient(180deg,#06111f 0%,#081629 100%)",
    borderRight:
        "1px solid rgba(255,255,255,.06)",
    boxShadow:
        "8px 0 30px rgba(2,6,23,.42)",
    overflow: "hidden",
    flexShrink: 0,
    transition:
        "width .24s ease, padding .24s ease",
});

const logoRowSx = (collapsed) => ({
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
    color: "#fff",
    fontWeight: 950,
    background:
        "linear-gradient(135deg,#0284c7,#0ea5e9)",
    flexShrink: 0,
};

const logoTitleSx = {
    color: "#fff",
    fontSize: "18px",
    fontWeight: 950,
    lineHeight: 1,
};

const logoSubSx = {
    mt: "4px",
    color: "rgba(255,255,255,.48)",
    fontSize: "10px",
    fontWeight: 750,
};

const dividerSx = {
    borderColor:
        "rgba(255,255,255,.07)",
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
            "rgba(148,163,184,.20)",
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
        collapsed ? 0 : 10,
    textDecoration: "none",
    color:
        active
            ? "#fff"
            : "rgba(255,255,255,.62)",
    background:
        active
            ? "linear-gradient(135deg,rgba(2,132,199,.28),rgba(14,165,233,.14))"
            : "transparent",
    border:
        active
            ? "1px solid rgba(14,165,233,.28)"
            : "1px solid transparent",
    fontSize: 11.5,
    fontWeight: 850,
    flexShrink: 0,
});

const navIconStyle = {
    width: 22,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
};

const userCardSx = (collapsed) => ({
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
        "rgba(255,255,255,.04)",
    border:
        "1px solid rgba(255,255,255,.07)",
});

const avatarSx = {
    width: "35px",
    height: "35px",
    borderRadius: "10px",
    display: "grid",
    placeItems: "center",
    color: "#fff",
    fontWeight: 950,
    background:
        "linear-gradient(135deg,#0284c7,#0ea5e9)",
    flexShrink: 0,
};

const userNameSx = {
    color: "#fff",
    fontSize: "12px",
    fontWeight: 900,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const userRoleSx = {
    mt: "2px",
    color: "rgba(255,255,255,.48)",
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
        xs: "12px",
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
        "linear-gradient(180deg,rgba(6,17,31,.98),rgba(8,22,41,.96))",
    borderBottom:
        "1px solid rgba(255,255,255,.06)",
};

const headerLeftSx = {
    display: "flex",
    alignItems: "center",
    gap: "11px",
    minWidth: 0,
};

const headerTitleSx = {
    color: "#fff",
    fontSize: "17px",
    fontWeight: 950,
    lineHeight: 1,
};

const headerSubSx = {
    mt: "4px",
    color: "#7dd3fc",
    fontSize: "10px",
    fontWeight: 800,
};

const iconButtonSx = {
    width: "38px",
    height: "38px",
    borderRadius: "10px",
    color: "#cbd5e1",
    background:
        "rgba(255,255,255,.04)",
    border:
        "1px solid rgba(255,255,255,.07)",
};

const headerActionsSx = {
    display: "flex",
    alignItems: "center",
    gap: "7px",
};

const plantFieldSx = {
    minWidth: "175px",

    "& .MuiOutlinedInput-root": {
        height: "34px",
        borderRadius: "9px",
        color: "#fff",
        fontSize: "11px",
        fontWeight: 800,
        background:
            "rgba(255,255,255,.04)",

        "& fieldset": {
            borderColor:
                "rgba(255,255,255,.08)",
        },
    },

    "& .MuiSvgIcon-root": {
        color: "#94a3b8",
    },

    "@media (max-width: 900px)": {
        display: "none",
    },
};

const healthChipSx = {
    height: "28px",
    borderRadius: 999,
    color: "#86efac",
    background:
        "rgba(34,197,94,.12)",
    border:
        "1px solid rgba(34,197,94,.22)",
    fontSize: "10px",
    fontWeight: 900,

    "@media (max-width: 720px)": {
        display: "none",
    },
};

const headerButtonSx = {
    height: "34px",
    borderRadius: "9px",
    textTransform: "none",
    color: "#fff",
    fontSize: "11px",
    fontWeight: 850,
    background:
        "rgba(255,255,255,.04)",
    border:
        "1px solid rgba(255,255,255,.07)",

    "@media (max-width: 850px)": {
        display: "none",
    },
};

const contentSx = {
    flex: 1,
    p: {
        xs: "12px",
        md: "18px",
    },
    overflow: "auto",
    background: `
		radial-gradient(circle at top left, rgba(14,165,233,.10), transparent 26%),
		radial-gradient(circle at bottom right, rgba(59,130,246,.07), transparent 25%)
	`,
};