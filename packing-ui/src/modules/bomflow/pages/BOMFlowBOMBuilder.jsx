import React, { useState } from "react";
import { Box, Button, Card, Chip, Collapse, IconButton, Typography } from "@mui/material";

import * as styles from "../styles/bomStyles.js";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AddIcon from "@mui/icons-material/Add";

const metalRows = [
	{ item: "MS Pipe 1×1 Inch", category: "Mild Steel", brand: "Tata Steel", unit: "RFT", qty: "45.00", rate: "₹ 120.00", amount: "5,400.00", gst: "18%", status: "valid" },
	{ item: "MS Sheet 2mm", category: "Mild Steel", brand: "Local Vendor", unit: "SQF", qty: "12.50", rate: "₹ 340.00", amount: "4,250.00", gst: "18%", status: "valid" },
	{ item: "Brass Handles Custom", category: "Brass", brand: "Artisan Metals", unit: "NOS", qty: "3.00", rate: "Missing", amount: "-", gst: "18%", status: "missing" },
];

export default function BOMFlowBOMBuilder() {
	const [metalOpen, setMetalOpen] = useState(true);
	const [woodOpen, setWoodOpen] = useState(false);

	return (
		<Box>
			<Box sx={styles.BOM_pageHeaderSx}>
				<Box>
					<Box sx={styles.BOM_statusLineSx}>
						<Chip label="PRJ-2024-089" size="small" sx={styles.BOM_projectChipSx} />
						<Chip label="DRAFT" size="small" sx={styles.BOM_draftProjectChipSx} />
					</Box>
					<Typography sx={styles.BOM_pageTitle}>Executive Office Desk - Mod A</Typography>
					<Typography sx={styles.BOM_pageSubSx}>Costing Sheet Revision 2 • Created by Admin</Typography>
				</Box>

				<Card sx={styles.BOM_costCardSx}>
					<Typography sx={styles.BOM_costLabelSx}>TOTAL ESTIMATED COST</Typography>
					<Typography sx={styles.BOM_costValueSx}>₹ 45,250.00</Typography>
				</Card>
			</Box>

			<Card sx={styles.BOM_sectionCardSx}>
				<Box sx={styles.BOM_sectionHeaderSx}>
					<Box sx={styles.BOM_sectionLeftSx}>
						<IconButton size="small" onClick={() => setMetalOpen((v) => !v)} sx={styles.BOM_sectionIconBtnSx}>
							{metalOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
						</IconButton>
						<Typography sx={styles.BOM_sectionTitleSx}>Metal</Typography>
						<Chip label="3 Items" size="small" sx={styles.BOM_countChipSx} />
					</Box>

					<Box sx={styles.BOM_sectionRightSx}>
						<Box>
							<Typography sx={styles.BOM_sectionTotalLabelSx}>SECTION TOTAL</Typography>
							<Typography sx={styles.BOM_sectionTotalValueSx}>₹ 12,450.00</Typography>
						</Box>
						<IconButton sx={styles.BOM_sectionIconBtnSx}><MoreVertIcon /></IconButton>
					</Box>
				</Box>

				<Collapse in={metalOpen}>
					<Box sx={styles.BOM_tableSx}>
						<Box sx={styles.BOM_tableHeadSx}>
							<div />
							<div>ITEM NAME</div>
							<div>CATEGORY</div>
							<div>BRAND/VENDOR</div>
							<div>UNIT</div>
							<div>QTY</div>
							<div>RATE</div>
							<div>AMOUNT</div>
							<div>GST%</div>
						</Box>

						{metalRows.map((row) => (
							<Box key={row.item} sx={row.status === "missing" ? styles.BOM_missingRowSx : styles.BOM_tableRowSx}>
								<Box sx={styles.BOM_deleteCellSx}><DeleteOutlineIcon fontSize="small" /></Box>
								<Box sx={styles.BOM_itemNameCellSx}>
									{row.status === "missing" && <WarningAmberIcon fontSize="small" sx={{ color: "#fca5a5", mr: 0.5 }} />}
									<Typography sx={row.status === "missing" ? styles.BOM_missingItemSx : styles.BOM_itemNameSx}>
										{row.item}
									</Typography>
								</Box>
								<Typography sx={styles.BOM_cellTextSx}>{row.category}</Typography>
								<Typography sx={styles.BOM_cellTextSx}>{row.brand}</Typography>
								<Typography sx={styles.BOM_cellStrongSx}>{row.unit}</Typography>
								<Typography sx={styles.BOM_numberCellSx}>{row.qty}</Typography>
								{row.status === "missing" ? (
									<Box sx={styles.BOM_missingRateSx}>Missing</Box>
								) : (
									<Typography sx={styles.BOM_rateCellSx}>{row.rate} <span style={{ color: "#22c55e" }}>●</span></Typography>
								)}
								<Typography sx={styles.BOM_numberCellSx}>{row.amount}</Typography>
								<Typography sx={styles.BOM_numberCellSx}>{row.gst}</Typography>
							</Box>
						))}

						<Box sx={styles.BOM_tableFooterSx}>
							<Button startIcon={<AddIcon />} sx={styles.BOM_addRowBtnSx}>Add Row</Button>
							<Typography sx={styles.BOM_validRateSx}>Valid Rates: 2/3</Typography>
						</Box>
					</Box>
				</Collapse>
			</Card>

			<Card sx={styles.BOM_collapsedSectionSx}>
				<Box sx={styles.BOM_sectionLeftSx}>
					<IconButton size="small" onClick={() => setWoodOpen((v) => !v)} sx={styles.BOM_sectionIconBtnSx}>
						{woodOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
					</IconButton>
					<Typography sx={styles.BOM_sectionTitleSx}>Wood / Material</Typography>
					<Chip label="1 Item" size="small" sx={styles.BOM_countChipSx} />
				</Box>

				<Box sx={styles.BOM_sectionRightSx}>
					<Box>
						<Typography sx={styles.BOM_sectionTotalLabelSx}>SECTION TOTAL</Typography>
						<Typography sx={styles.BOM_sectionTotalValueSx}>₹ 15,800.00</Typography>
					</Box>
					<IconButton sx={styles.BOM_sectionIconBtnSx}><MoreVertIcon /></IconButton>
				</Box>
			</Card>
		</Box>
	);
}
