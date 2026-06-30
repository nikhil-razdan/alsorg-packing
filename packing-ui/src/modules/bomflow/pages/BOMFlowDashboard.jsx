import React from "react";
import {
	Box,
	Button,
	Card,
	Chip,
	Grid,
	Typography,
} from "@mui/material";

import { useNavigate } from "react-router-dom";

import * as styles from "../styles/bomStyles.js";

import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import PriceChangeOutlinedIcon from "@mui/icons-material/PriceChangeOutlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

const cards = [
	{
		title: "Product Master",
		subtitle:
			"Create product details, dimensions, product photos, drawing numbers, categories, collections and project references.",
		path: "/bomflow/products",
		icon: <Inventory2OutlinedIcon />,
		count: "Create",
	},
	{
		title: "BOM Builder",
		subtitle:
			"Build section-wise BOM for Metal, Wood, Hardware, Stone, Glass, Paint, Upholstery and Labour.",
		path: "/bomflow/bom-builder",
		icon: <RuleOutlinedIcon />,
		count: "Build",
	},
	{
		title: "Rate Master",
		subtitle:
			"Maintain approved material rates, vendor rates, GST rules, bill copies and effective dates.",
		path: "/bomflow/rate-master",
		icon: <PriceChangeOutlinedIcon />,
		count: "Rates",
	},
	{
		title: "Labour Master",
		subtitle:
			"Control labour processes, departments, time standards, hourly rates and calculation rules.",
		path: "/bomflow/labour-master",
		icon: <EngineeringOutlinedIcon />,
		count: "Labour",
	},
	{
		title: "Costing Engine",
		subtitle:
			"Calculate direct material, direct labour, overheads, prime cost, factory cost and final costing.",
		path: "/bomflow/costing",
		icon: <CalculateOutlinedIcon />,
		count: "Costing",
	},
	{
		title: "Reports",
		subtitle:
			"Export Price Sheet, Direct Material, Direct Labour, costing summary, change log and PDF reports.",
		path: "/bomflow/reports",
		icon: <AssessmentOutlinedIcon />,
		count: "Export",
	},
];

export default function BOMFlowDashboard() {
	const navigate = useNavigate();

	return (
		<Box sx={styles.BOM_viewShellSx}>
			<Box sx={styles.BOM_pageHeadSx}>
				<Box>
					<Chip
						label="BOMFLOW MODULE"
						sx={styles.BOM_labelChipSx}
					/>

					<Typography sx={styles.BOM_pageTitleSx}>
						Product Costing Control Center
					</Typography>

					<Typography sx={styles.BOM_pageSubSx}>
						Create product profiles, build BOM, maintain live rates,
						calculate costing, control workflow and export final reports.
					</Typography>
				</Box>

				<Card sx={styles.BOM_activeCostingsCardSx}>
					<Typography sx={styles.BOM_costLabelSx}>
						ACTIVE COSTINGS
					</Typography>

					<Typography sx={styles.BOM_activeCostingsValueSx}>
						12
					</Typography>
				</Card>
			</Box>

			<Grid container spacing={2.5}>
				{cards.map((card) => (
					<Grid item xs={12} md={6} xl={4} key={card.title}>
						<Card sx={styles.BOM_moduleCardSx}>
							<Box sx={styles.BOM_cardTopSx}>
								<Box sx={styles.BOM_iconSx}>
									{card.icon}
								</Box>

								<Chip
									label={card.count}
									size="small"
									sx={styles.BOM_miniChipSx}
								/>
							</Box>

							<Typography sx={styles.BOM_cardTitleSx}>
								{card.title}
							</Typography>

							<Typography sx={styles.BOM_cardSubSx}>
								{card.subtitle}
							</Typography>

							<Button
								fullWidth
								endIcon={<ArrowForwardIcon />}
								onClick={() => navigate(card.path)}
								sx={styles.BOM_openBtnSx}
							>
								Open {card.title}
							</Button>
						</Card>
					</Grid>
				))}
			</Grid>
		</Box>
	);
}