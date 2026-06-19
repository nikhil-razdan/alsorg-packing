import React from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Box, Button, Chip, IconButton, Tooltip, Typography } from "@mui/material";

import * as styles from "./styles/bomStyles.js";

import AppsIcon from "@mui/icons-material/Apps";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import PriceChangeOutlinedIcon from "@mui/icons-material/PriceChangeOutlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import AddIcon from "@mui/icons-material/Add";

const navItems = [
	{ label: "Dashboard", path: "/bomflow/dashboard", icon: <DashboardOutlinedIcon /> },
	{ label: "Product Master", path: "/bomflow/products", icon: <Inventory2OutlinedIcon /> },
	{ label: "BOM Builder", path: "/bomflow/bom-builder", icon: <RuleOutlinedIcon /> },
	{ label: "Rate Master", path: "/bomflow/rate-master", icon: <PriceChangeOutlinedIcon /> },
	{ label: "Labour Master", path: "/bomflow/labour-master", icon: <EngineeringOutlinedIcon /> },
	{ label: "Costing Engine", path: "/bomflow/costing", icon: <CalculateOutlinedIcon /> },
	{ label: "Reports", path: "/bomflow/reports", icon: <AssessmentOutlinedIcon /> },
];

const bomSections = ["Metal", "Wood", "Hardware", "Stone", "Glass"];

export default function BOMFlowLayout() {
	const navigate = useNavigate();
	const location = useLocation();
	const username = localStorage.getItem("username") || "User";

	const logout = () => {
		localStorage.clear();
		navigate("/login", { replace: true });
	};

	const activeLabel = navItems.find((item) => location.pathname.startsWith(item.path))?.label || "Dashboard";
	const isBOMBuilder = location.pathname.startsWith("/bomflow/bom-builder");
	const showDraftActions =
		location.pathname.startsWith("/bomflow/products") ||
		location.pathname.startsWith("/bomflow/bom-builder") ||
		location.pathname.startsWith("/bomflow/costing");

	return (
		<Box sx={styles.BOM_shellSx}>
			<Box sx={styles.BOM_sidebarSx}>
				<Box sx={styles.BOM_brandSx}>
					<Box sx={styles.BOM_brandMarkSx}>B</Box>
					<Box sx={{ minWidth: 0 }}>
						<Typography sx={styles.BOM_brandTitleSx}>Alsorg</Typography>
						<Typography sx={styles.BOM_brandSubSx}>BOMFlow</Typography>
					</Box>
				</Box>

				<Box sx={styles.BOM_navSx}>
					{navItems.map((item) => {
						const active = location.pathname.startsWith(item.path);
						return (
							<button
								key={item.path}
								type="button"
								style={{
									...styles.BOM_navItemStyle,
									...(active ? styles.BOM_navItemActiveStyle : {}),
								}}
								onClick={() => navigate(item.path)}
							>
								<span style={styles.BOM_navIconStyle}>{item.icon}</span>
								<span>{item.label}</span>
							</button>
						);
					})}
				</Box>

				<Box sx={{ flex: 1 }} />

				<Box sx={styles.BOM_sidebarFooterSx}>
					<Button fullWidth startIcon={<AddIcon />} onClick={() => navigate("/bomflow/products")} sx={styles.BOM_newCostingBtnSx}>
						New Costing
					</Button>
					<Button fullWidth startIcon={<AppsIcon />} onClick={() => navigate("/modules")} sx={styles.BOM_allModulesBtnSx}>
						All Modules
					</Button>
				</Box>
			</Box>

			<Box sx={styles.BOM_mainSx}>
				<Box sx={styles.BOM_topbarSx}>
					<Box sx={styles.BOM_topbarLeftSx}>
						<Box sx={styles.BOM_systemTitleBlockSx}>
							<Typography sx={styles.BOM_systemTitleSx}>BOMFlow</Typography>
							<Typography sx={styles.BOM_systemSubtitleSx}>Alsorg Operations Suite</Typography>
						</Box>
						<Box sx={styles.BOM_topbarDividerSx} />
						<Chip label={activeLabel} size="small" sx={styles.BOM_breadcrumbChipSx} />
					</Box>

					<Box sx={{ flex: 1, display: "flex", justifyContent: "center" }}>
						{isBOMBuilder && (
							<Box sx={styles.BOM_sectionTabsSx}>
								{bomSections.map((item, index) => (
									<Chip
										key={item}
										label={item}
										size="small"
										sx={index === 0 ? styles.BOM_activeSectionChipSx : styles.BOM_sectionChipSx}
									/>
								))}
							</Box>
						)}
					</Box>

					<Box sx={styles.BOM_topbarRightSx}>
						<Box sx={styles.BOM_iconGroupSx}>
							<IconButton sx={styles.BOM_topIconBtnSx}><NotificationsNoneOutlinedIcon /></IconButton>
							<IconButton sx={styles.BOM_topIconBtnSx}><SettingsOutlinedIcon /></IconButton>
							<IconButton sx={styles.BOM_topIconBtnSx}><HelpOutlineOutlinedIcon /></IconButton>
						</Box>

						{showDraftActions && (
							<Box sx={{ display: "flex", gap: 1 }}>
								<Button sx={styles.BOM_saveBtnSx}>Save Draft</Button>
								<Button sx={styles.BOM_approveBtnSx}>Approve BOM</Button>
							</Box>
						)}

						<Box sx={styles.BOM_userPillSx}>
							<Box sx={styles.BOM_avatarSx}>{username.charAt(0).toUpperCase()}</Box>
							<Box>
								<Typography sx={styles.BOM_userNameSx}>{username}</Typography>
								<Typography sx={styles.BOM_userRoleSx}>Active User</Typography>
							</Box>
						</Box>

						<IconButton onClick={logout} sx={{ color: "#ef4444" }}><LogoutIcon /></IconButton>
					</Box>
				</Box>

				<Box sx={styles.BOM_contentSx}>
					<Outlet />
				</Box>
			</Box>
		</Box>
	);
}
