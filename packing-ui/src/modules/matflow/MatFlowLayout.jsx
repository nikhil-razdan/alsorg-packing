import React, {
    useMemo,
    useState,
} from "react";

import {
    Box,
    Button,
    Chip,
    Divider,
    IconButton,
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
} from "../../utils/matflowAccess";

import DashboardOutlinedIcon
    from "@mui/icons-material/DashboardOutlined";
import LayersOutlinedIcon
    from "@mui/icons-material/LayersOutlined";
import EngineeringOutlinedIcon
    from "@mui/icons-material/EngineeringOutlined";
import StorefrontOutlinedIcon
    from "@mui/icons-material/StorefrontOutlined";
import DescriptionOutlinedIcon
    from "@mui/icons-material/DescriptionOutlined";
import ShoppingCartOutlinedIcon
    from "@mui/icons-material/ShoppingCartOutlined";
import ApprovalOutlinedIcon
    from "@mui/icons-material/ApprovalOutlined";
import AssessmentOutlinedIcon
    from "@mui/icons-material/AssessmentOutlined";
import MenuIcon
    from "@mui/icons-material/Menu";
import AppsIcon
    from "@mui/icons-material/Apps";
import LogoutIcon
    from "@mui/icons-material/Logout";

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
        label: "BOM Releases",
        path: "/matflow/releases",
        screen: "releases",
        icon: <LayersOutlinedIcon />,
    },
    {
        label: "Production Desk",
        path: "/matflow/production",
        screen: "production",
        icon: <EngineeringOutlinedIcon />,
    },
    {
        label: "Store Desk",
        path: "/matflow/store",
        screen: "store",
        icon: <StorefrontOutlinedIcon />,
    },
    {
        label: "Material Indents",
        path: "/matflow/indents",
        screen: "indents",
        icon: <DescriptionOutlinedIcon />,
    },
    {
        label: "Purchase Desk",
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
        label: "Reports",
        path: "/matflow/reports",
        screen: "reports",
        icon: <AssessmentOutlinedIcon />,
    },
];

const getHeaderMeta = (pathname) => {
    if (
        pathname.includes("/releases/")
    ) {
        return {
            title: "MatFlow Release",
            subtitle:
                "Immutable approved BOM material snapshot",
        };
    }

    if (
        pathname.includes("/releases")
    ) {
        return {
            title: "BOM Releases",
            subtitle:
                "Approved BOM revisions released into MatFlow",
        };
    }

    if (
        pathname.includes("/production")
    ) {
        return {
            title: "Production Desk",
            subtitle:
                "Material requisition planning and submission",
        };
    }

    if (
        pathname.includes("/store")
    ) {
        return {
            title: "Store Desk",
            subtitle:
                "Stock review, blocking and shortage control",
        };
    }

    if (
        pathname.includes("/indents")
    ) {
        return {
            title: "Material Indents",
            subtitle:
                "Shortage consolidation for procurement",
        };
    }

    if (
        pathname.includes("/purchase-orders")
    ) {
        return {
            title: "Purchase Order",
            subtitle:
                "Purchase order review and approval",
        };
    }

    if (
        pathname.includes("/purchase")
    ) {
        return {
            title: "Purchase Desk",
            subtitle:
                "Quotation and purchase order control",
        };
    }

    if (
        pathname.includes("/approvals")
    ) {
        return {
            title: "PO Approvals",
            subtitle:
                "Purchase order approval queue",
        };
    }

    if (
        pathname.includes("/reports")
    ) {
        return {
            title: "MatFlow Reports",
            subtitle:
                "Material planning and procurement reports",
        };
    }

    return {
        title: "MatFlow Dashboard",
        subtitle:
            "Material planning and procurement control",
    };
};

export default function MatFlowLayout() {
    const location = useLocation();
    const navigate = useNavigate();

    const {
        user,
        role,
        logout,
    } = useAuth();

    const [collapsed, setCollapsed] =
        useState(() => {
            return (
                localStorage.getItem(
                    SIDEBAR_KEY
                ) === "true"
            );
        });

    const cleanRole = getMatFlowRole(role);

    const username =
        user?.username ||
        localStorage.getItem("username") ||
        "User";

    const visibleItems = useMemo(() => {
        return navItems.filter((item) => {
            return canAccessMatFlowScreen(
                item.screen,
                cleanRole
            );
        });
    }, [cleanRole]);

    const headerMeta = useMemo(() => {
        return getHeaderMeta(
            location.pathname
        );
    }, [location.pathname]);

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

        navigate("/login", {
            replace: true,
        });
    };

    return (
        <Box sx={shellSx}>
            <Box sx={sidebarSx(collapsed)}>
                <Box sx={sidebarGlowSx} />

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

                <Box sx={{ flex: 1 }} />

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
                                {headerMeta.title}
                            </Typography>

                            <Typography sx={headerSubSx}>
                                {headerMeta.subtitle}
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={headerActionsSx}>
                        <Chip
                            label="● System Active"
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
    width: collapsed ? "78px" : "238px",
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

    "@media (max-width: 700px)": {
        width: "72px",
        p: "14px 7px",
    },
});

const sidebarGlowSx = {
    position: "absolute",
    inset: "0 0 auto 0",
    height: "120px",
    background:
        "linear-gradient(180deg,rgba(14,165,233,.18),transparent)",
    pointerEvents: "none",
};

const logoRowSx = (collapsed) => ({
    position: "relative",
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
    boxShadow:
        "0 10px 24px rgba(14,165,233,.28)",
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
    borderColor: "rgba(255,255,255,.07)",
};

const navListSx = {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    mt: "14px",
};

const navLinkStyle = (
    active,
    collapsed
) => ({
    minHeight: 42,
    padding: collapsed
        ? "0"
        : "0 11px",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent:
        collapsed
            ? "center"
            : "flex-start",
    gap: collapsed ? 0 : 10,
    textDecoration: "none",
    color: active
        ? "#fff"
        : "rgba(255,255,255,.62)",
    background: active
        ? "linear-gradient(135deg,rgba(2,132,199,.28),rgba(14,165,233,.14))"
        : "transparent",
    border: active
        ? "1px solid rgba(14,165,233,.28)"
        : "1px solid transparent",
    fontSize: 12,
    fontWeight: 850,
    transition: "all .2s ease",
});

const navIconStyle = {
    width: 22,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
};

const userCardSx = (collapsed) => ({
    minHeight: "54px",
    p: collapsed
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
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.07)",
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
    boxShadow:
        "0 10px 28px rgba(2,6,23,.28)",
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
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.07)",
};

const headerActionsSx = {
    display: "flex",
    alignItems: "center",
    gap: "7px",

    "@media (max-width: 850px)": {
        "& .MuiButton-root": {
            display: "none",
        },
    },
};

const healthChipSx = {
    height: "28px",
    borderRadius: 999,
    color: "#86efac",
    background: "rgba(34,197,94,.12)",
    border: "1px solid rgba(34,197,94,.22)",
    fontSize: "10px",
    fontWeight: 900,
};

const headerButtonSx = {
    height: "34px",
    borderRadius: "9px",
    textTransform: "none",
    color: "#fff",
    fontSize: "11px",
    fontWeight: 850,
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.07)",
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