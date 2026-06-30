import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import {
	Box,
	Button,
	Chip,
	Typography,
} from "@mui/material";

import AppsIcon from "@mui/icons-material/Apps";
import AddIcon from "@mui/icons-material/Add";

import * as styles from "./styles/bomStyles.js";

const navItems = [
	{
		label: "Dashboard",
		path: "/bomflow/dashboard",
	},
	{
		label: "Product Master",
		path: "/bomflow/products",
	},
	{
		label: "BOM Builder",
		path: "/bomflow/bom-builder",
	},
	{
		label: "Rate Master",
		path: "/bomflow/rate-master",
	},
	{
		label: "Labour Master",
		path: "/bomflow/labour-master",
	},
	{
		label: "Costing Engine",
		path: "/bomflow/costing",
	},
	{
		label: "Reports",
		path: "/bomflow/reports",
	},
];

export default function BOMFlowLayout() {
	const navigate = useNavigate();
	const location = useLocation();

	const activeItem =
		navItems.find((item) =>
			location.pathname.startsWith(item.path)
		) || navItems[0];

	return (
		<Box sx={styles.BOM_modulePageSx}>
			<Box sx={styles.BOM_moduleContentSx}>
				<Box sx={styles.BOM_moduleHeaderRowSx}>
					<Box>
						<Box sx={styles.BOM_moduleLogoRowSx}>
							<Box sx={styles.BOM_moduleLogoMarkSx}>
								B
							</Box>

							<Box>
								<Typography sx={styles.BOM_moduleLogoSx}>
									BOMFlow
								</Typography>

								<Typography sx={styles.BOM_moduleSubtitleSx}>
									Product BOM, costing, rate master and approval workflow
								</Typography>
							</Box>
						</Box>
					</Box>

					<Box sx={styles.BOM_moduleHeaderActionsSx}>
						<Chip
							label={activeItem.label}
							size="small"
							sx={styles.BOM_activePageChipSx}
						/>

						<Button
							startIcon={<AppsIcon />}
							onClick={() => navigate("/modules")}
							sx={styles.BOM_secondaryActionBtnSx}
						>
							All Modules
						</Button>

						<Button
							startIcon={<AddIcon />}
							onClick={() => navigate("/bomflow/products")}
							sx={styles.BOM_primaryActionBtnSx}
						>
							New Costing
						</Button>
					</Box>
				</Box>

				<Box sx={styles.BOM_tabsRowSx}>
					{navItems.map((item) => {
						const active =
							location.pathname.startsWith(item.path);

						return (
							<button
								key={item.path}
								type="button"
								onClick={() => navigate(item.path)}
								style={{
									...styles.BOM_tabButtonStyle,
									...(active
										? styles.BOM_tabButtonActiveStyle
										: {}),
								}}
							>
								{item.label}
							</button>
						);
					})}
				</Box>

				<Box sx={styles.BOM_viewShellSx}>
					<Outlet />
				</Box>
			</Box>
		</Box>
	);
}