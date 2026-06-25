import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
	Box,
	Button,
	Chip,
	Stack,
	Typography,
} from "@mui/material";

import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import FormatListBulletedOutlinedIcon from "@mui/icons-material/FormatListBulletedOutlined";
import AddCircleOutlineOutlinedIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import AppsIcon from "@mui/icons-material/Apps";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";

export default function VenFlowLayout() {
	const navigate = useNavigate();
	const location = useLocation();

	const navItems = [
		{
			label: "Dashboard",
			path: "/venflow/dashboard",
			icon: <DashboardOutlinedIcon />,
		},
		{
			label: "Entries",
			path: "/venflow/entries",
			icon: <FormatListBulletedOutlinedIcon />,
		},
		{
			label: "New Requirement",
			path: "/venflow/create",
			icon: <AddCircleOutlineOutlinedIcon />,
		},
		{
			label: "Reports",
			path: "/venflow/reports",
			icon: <AssessmentOutlinedIcon />,
		},
	];

	return (
		<Box sx={pageSx}>
			<Box sx={topBarSx}>
				<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
					<Box sx={logoSx}>
						<LayersOutlinedIcon />
					</Box>

					<Box>
						<Typography sx={titleSx}>
							VenFlow
						</Typography>

						<Typography sx={subtitleSx}>
							Veneer Production & Store Tracking System
						</Typography>
					</Box>
				</Box>

				<Button
					startIcon={<AppsIcon />}
					onClick={() => navigate("/modules")}
					sx={moduleBtnSx}
				>
					Module Hub
				</Button>
			</Box>

			<Stack direction="row" spacing={1.2} sx={navSx}>
				{navItems.map((item) => {
					const active = location.pathname === item.path;

					return (
						<Chip
							key={item.path}
							icon={item.icon}
							label={item.label}
							onClick={() => navigate(item.path)}
							sx={{
								...navChipSx,
								...(active ? activeChipSx : {}),
							}}
						/>
					);
				})}
			</Stack>

			<Box sx={contentSx}>
				<Outlet />
			</Box>
		</Box>
	);
}

const pageSx = {
	minHeight: "100vh",
	background:
		"linear-gradient(135deg, #f8fafc 0%, #eef2f7 45%, #f8fafc 100%)",
	p: { xs: 2, md: 3 },
};

const topBarSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	mb: 2.5,
};

const logoSx = {
	width: 52,
	height: 52,
	borderRadius: "18px",
	display: "grid",
	placeItems: "center",
	background: "linear-gradient(135deg,#92400e,#b45309)",
	color: "#fff",
	boxShadow: "0 16px 34px rgba(146,64,14,.22)",
};

const titleSx = {
	fontSize: 24,
	fontWeight: 950,
	color: "#111827",
	letterSpacing: "-0.04em",
};

const subtitleSx = {
	fontSize: 13,
	color: "#64748b",
	fontWeight: 700,
	mt: 0.2,
};

const moduleBtnSx = {
	borderRadius: "14px",
	textTransform: "none",
	fontWeight: 900,
	color: "#92400e",
	background: "#fff",
	border: "1px solid #fed7aa",
	"&:hover": {
		background: "#fff7ed",
	},
};

const navSx = {
	mb: 3,
	flexWrap: "wrap",
};

const navChipSx = {
	height: 42,
	borderRadius: "14px",
	background: "#fff",
	border: "1px solid #e5e7eb",
	fontWeight: 850,
	color: "#475569",
	cursor: "pointer",
	"& .MuiChip-icon": {
		color: "#92400e",
	},
};

const activeChipSx = {
	background: "#92400e",
	color: "#fff",
	borderColor: "#92400e",
	"& .MuiChip-icon": {
		color: "#fff",
	},
};

const contentSx = {
	maxWidth: 1500,
	mx: "auto",
};