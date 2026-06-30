import React from "react";
import { Box, Button, Card, CardContent, Chip, Grid, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

import * as styles from "../styles/bomStyles.js";

import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import PriceChangeOutlinedIcon from "@mui/icons-material/PriceChangeOutlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AppsIcon from "@mui/icons-material/Apps";
import LogoutIcon from "@mui/icons-material/Logout";

const modules = [
	{ title: "Product Master", subtitle: "Create product details, drawing number, collection, size, category and product photo.", icon: <Inventory2OutlinedIcon />, status: "Ready to Start", action: "Create Product", path: "/bomflow/products", enabled: true },
	{ title: "BOM Builder", subtitle: "Create section-wise BOM for metal, wood, hardware, stone, glass, upholstery, paint and labour.", icon: <RuleOutlinedIcon />, status: "Planned", action: "Open BOM Builder", path: "/bomflow/bom-builder", enabled: false },
	{ title: "Rate Master", subtitle: "Maintain material rates, vendor rates, purchase register rates, bill copies and effective dates.", icon: <PriceChangeOutlinedIcon />, status: "Planned", action: "Open Rate Master", path: "/bomflow/rate-master", enabled: false },
	{ title: "Labour Master", subtitle: "Maintain process-wise labour rates, departments, working time and labour calculation rules.", icon: <EngineeringOutlinedIcon />, status: "Planned", action: "Open Labour Master", path: "/bomflow/labour-master", enabled: false },
	{ title: "Costing Engine", subtitle: "Calculate direct material, direct labour, overheads, prime cost and final product costing.", icon: <CalculateOutlinedIcon />, status: "Planned", action: "View Costing", path: "/bomflow/costing", enabled: false },
	{ title: "Reports", subtitle: "Export Price Sheet, Direct Material, Direct Labour, Change Log, PDF approval and summaries.", icon: <AssessmentOutlinedIcon />, status: "Planned", action: "View Reports", path: "/bomflow/reports", enabled: false },
];

export default function BOMFlowHome() {
	const navigate = useNavigate();
	const username = localStorage.getItem("username") || "User";

	const logout = () => {
		localStorage.clear();
		navigate("/login", { replace: true });
	};

	return (
		<Box sx={styles.BOM_pageSx}>
			<Box sx={styles.BOM_ambientGlowOne} />
			<Box sx={styles.BOM_ambientGlowTwo} />
			<Box sx={styles.BOM_backgroundText}>BOMFlow</Box>

			<Box sx={styles.BOM_topBarSx}>
				<Box sx={styles.BOM_brandWrapSx || { display: "flex", alignItems: "center", gap: 1.5 }}>
					<Box sx={styles.BOM_brandMarkSx}>B</Box>
					<Box>
						<Typography sx={styles.BOM_brandTitleSx}>BOMFlow</Typography>
						<Typography sx={styles.BOM_brandSubSx}>Product Costing & BOM Control</Typography>
					</Box>
				</Box>

				<Box sx={{ display: "flex", gap: 1.5 }}>
					<Button startIcon={<AppsIcon />} onClick={() => navigate("/modules")} sx={styles.BOM_allModulesBtnSx}>All Modules</Button>
					<Button startIcon={<LogoutIcon />} onClick={logout} sx={{ color: "#ef4444" }}>Logout</Button>
				</Box>
			</Box>

			<Box sx={{ position: "relative", zIndex: 1, maxWidth: 1300, mx: "auto" }}>
				<Box sx={styles.BOM_heroSx}>
					<Chip label="BOMFLOW MODULE" sx={styles.BOM_heroBadgeSx} />
					<Typography variant="h4" sx={styles.BOM_heroTitleSx}>BOMFlow Portal</Typography>
					<Typography sx={styles.BOM_heroSubtitleSx}>
						Welcome, {username}. Create product entities, formulate sectioned structures, establish standardized live rates, and compute direct product margins.
					</Typography>
					<Box sx={styles.BOM_heroChipWrapSx}>
						<Chip label="Product Master" sx={styles.BOM_heroChipSx} />
						<Chip label="BOM Builder" sx={styles.BOM_heroChipSx} />
						<Chip label="Rate Master" sx={styles.BOM_heroChipSx} />
					</Box>
				</Box>

				<Grid container spacing={2.5}>
					{modules.map((item) => (
						<Grid item xs={12} sm={6} lg={4} key={item.title}>
							<Card sx={styles.BOM_portalModuleCardSx(item.enabled)}>
								<CardContent sx={{ p: 3 }}>
									<Box sx={styles.BOM_cardTopSx}>
										<Box sx={styles.BOM_iconSx}>{item.icon}</Box>
										<Chip size="small" label={item.status} sx={item.enabled ? styles.BOM_statusReadySx : styles.BOM_statusPlannedSx} />
									</Box>
									<Typography sx={styles.BOM_moduleTitleSx}>{item.title}</Typography>
									<Typography sx={styles.BOM_portalModuleSubtitleSx}>
										{item.subtitle}
									</Typography>
									<Button
										fullWidth
										variant={item.enabled ? "contained" : "outlined"}
										disabled={!item.enabled}
										endIcon={<ArrowForwardIcon />}
										onClick={() => navigate(item.path)}
										sx={item.enabled ? styles.BOM_openBtnSx : { borderColor: "rgba(255,255,255,.05)", color: "rgba(255,255,255,.3)" }}
									>
										{item.enabled ? item.action : "Coming Soon"}
									</Button>
								</CardContent>
							</Card>
						</Grid>
					))}
				</Grid>
			</Box>
		</Box>
	);
}
