import React, { useState } from "react";
import {
	Box,
	Button,
	Card,
	Chip,
	Collapse,
	IconButton,
	Typography,
} from "@mui/material";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AddIcon from "@mui/icons-material/Add";

const metalRows = [
	{
		item: "MS Pipe 1×1 Inch",
		category: "Mild Steel",
		brand: "Tata Steel",
		unit: "RFT",
		qty: "45.00",
		rate: "₹ 120.00",
		amount: "5,400.00",
		gst: "18%",
		status: "valid",
	},
	{
		item: "MS Sheet 2mm",
		category: "Mild Steel",
		brand: "Local Vendor",
		unit: "SQF",
		qty: "12.50",
		rate: "₹ 340.00",
		amount: "4,250.00",
		gst: "18%",
		status: "valid",
	},
	{
		item: "Brass Handles Custom",
		category: "Brass",
		brand: "Artisan Metals",
		unit: "NOS",
		qty: "3.00",
		rate: "Missing",
		amount: "-",
		gst: "18%",
		status: "missing",
	},
];

export default function BOMFlowBOMBuilder() {
	const [metalOpen, setMetalOpen] = useState(true);
	const [woodOpen, setWoodOpen] = useState(false);

	return (
		<Box>
			<Box sx={pageHeaderSx}>
				<Box>
					<Box sx={statusLineSx}>
						<Chip label="PRJ-2024-089" size="small" sx={projectChipSx} />
						<Chip label="DRAFT" size="small" sx={draftChipSx} />
					</Box>

					<Typography sx={pageTitleSx}>
						Executive Office Desk - Mod A
					</Typography>

					<Typography sx={pageSubSx}>
						Costing Sheet Revision 2 • Created by Admin
					</Typography>
				</Box>

				<Card sx={costCardSx}>
					<Typography sx={costLabelSx}>TOTAL ESTIMATED COST</Typography>
					<Typography sx={costValueSx}>₹ 45,250.00</Typography>
				</Card>
			</Box>

			<Card sx={sectionCardSx}>
				<Box sx={sectionHeaderSx}>
					<Box sx={sectionLeftSx}>
						<IconButton size="small" onClick={() => setMetalOpen((v) => !v)} sx={sectionIconBtnSx}>
							{metalOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
						</IconButton>

						<Typography sx={sectionTitleSx}>Metal</Typography>

						<Chip label="3 Items" size="small" sx={countChipSx} />
					</Box>

					<Box sx={sectionRightSx}>
						<Box>
							<Typography sx={sectionTotalLabelSx}>SECTION TOTAL</Typography>
							<Typography sx={sectionTotalValueSx}>₹ 12,450.00</Typography>
						</Box>

						<IconButton sx={sectionIconBtnSx}>
							<MoreVertIcon />
						</IconButton>
					</Box>
				</Box>

				<Collapse in={metalOpen}>
					<Box sx={tableSx}>
						<Box sx={tableHeadSx}>
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

						{metalRows.map((row, index) => (
							<Box
								key={row.item}
								sx={row.status === "missing" ? missingRowSx : tableRowSx}
							>
								<Box sx={deleteCellSx}>
									<DeleteOutlineIcon fontSize="small" />
								</Box>

								<Box sx={itemNameCellSx}>
									{row.status === "missing" && (
										<WarningAmberIcon fontSize="small" sx={{ color: "#fca5a5" }} />
									)}
									<Typography sx={row.status === "missing" ? missingItemSx : itemNameSx}>
										{row.item}
									</Typography>
								</Box>

								<Typography sx={cellTextSx}>{row.category}</Typography>
								<Typography sx={cellTextSx}>{row.brand}</Typography>
								<Typography sx={cellStrongSx}>{row.unit}</Typography>
								<Typography sx={numberCellSx}>{row.qty}</Typography>

								{row.status === "missing" ? (
									<Box sx={missingRateSx}>Missing</Box>
								) : (
									<Typography sx={rateCellSx}>{row.rate} <span style={{ color: "#52e08f" }}>●</span></Typography>
								)}

								<Typography sx={numberCellSx}>{row.amount}</Typography>
								<Typography sx={numberCellSx}>{row.gst}</Typography>
							</Box>
						))}

						<Box sx={tableFooterSx}>
							<Button startIcon={<AddIcon />} sx={addRowBtnSx}>
								Add Row
							</Button>

							<Typography sx={validRateSx}>Valid Rates: 2/3</Typography>
						</Box>
					</Box>
				</Collapse>
			</Card>

			<Card sx={collapsedSectionSx}>
				<Box sx={sectionLeftSx}>
					<IconButton size="small" onClick={() => setWoodOpen((v) => !v)} sx={sectionIconBtnSx}>
						{woodOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
					</IconButton>

					<Typography sx={sectionTitleSx}>Wood / Material</Typography>

					<Chip label="1 Item" size="small" sx={countChipSx} />
				</Box>

				<Box sx={sectionRightSx}>
					<Box>
						<Typography sx={sectionTotalLabelSx}>SECTION TOTAL</Typography>
						<Typography sx={sectionTotalValueSx}>₹ 15,800.00</Typography>
					</Box>

					<IconButton sx={sectionIconBtnSx}>
						<MoreVertIcon />
					</IconButton>
				</Box>
			</Card>
		</Box>
	);
}

const pageHeaderSx = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "flex-start",
	mb: 2.4,
	gap: 2,
};

const statusLineSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	mb: 1,
};

const projectChipSx = {
	height: 22,
	borderRadius: "3px",
	background: "#222733",
	color: "#fff",
	border: "1px solid rgba(255,255,255,.12)",
	fontWeight: 950,
	fontSize: 10,
};

const draftChipSx = {
	...projectChipSx,
	background: "rgba(79,141,247,.16)",
	color: "#a8c3ff",
};

const pageTitleSx = {
	color: "#f8fafc",
	fontSize: 30,
	lineHeight: 1.1,
	fontWeight: 950,
	letterSpacing: "-0.04em",
};

const pageSubSx = {
	mt: 1,
	color: "rgba(255,255,255,.72)",
	fontWeight: 650,
};

const costCardSx = {
	minWidth: 158,
	background: "#1c212b",
	border: "1px solid rgba(255,255,255,.10)",
	borderRadius: "8px",
	p: 1.8,
	boxShadow: "0 16px 40px rgba(0,0,0,.35)",
};

const costLabelSx = {
	color: "rgba(255,255,255,.65)",
	fontSize: 10,
	fontWeight: 950,
	letterSpacing: ".08em",
};

const costValueSx = {
	mt: 0.8,
	color: "#52e08f",
	fontSize: 22,
	fontWeight: 950,
	fontFamily: "monospace",
};

const sectionCardSx = {
	background: "#1a1e27",
	border: "1px solid rgba(255,255,255,.14)",
	borderRadius: "8px",
	boxShadow: "0 18px 44px rgba(0,0,0,.32)",
	overflow: "hidden",
	mb: 2,
	borderLeft: "4px solid #9bbcff",
};

const sectionHeaderSx = {
	height: 64,
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	px: 2,
	borderBottom: "1px solid rgba(255,255,255,.10)",
};

const sectionLeftSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.4,
};

const sectionRightSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.4,
};

const sectionIconBtnSx = {
	color: "#cbd5e1",
	width: 30,
	height: 30,
};

const sectionTitleSx = {
	color: "#fff",
	fontSize: 18,
	fontWeight: 950,
};

const countChipSx = {
	height: 24,
	borderRadius: "3px",
	background: "rgba(255,255,255,.08)",
	color: "#d1d5db",
	fontWeight: 850,
	fontFamily: "monospace",
};

const sectionTotalLabelSx = {
	color: "rgba(255,255,255,.65)",
	fontSize: 10,
	fontWeight: 950,
	textAlign: "right",
};

const sectionTotalValueSx = {
	color: "#fff",
	fontWeight: 950,
	fontFamily: "monospace",
	fontSize: 16,
};

const tableSx = {
	background: "#11151d",
};

const tableHeadSx = {
	display: "grid",
	gridTemplateColumns: "44px 1.8fr 1fr 1.2fr .6fr .7fr .9fr .9fr .6fr",
	color: "rgba(255,255,255,.70)",
	fontSize: 11,
	fontWeight: 950,
	borderBottom: "1px solid rgba(255,255,255,.12)",
	"& > div": {
		padding: "11px 10px",
		borderRight: "1px solid rgba(255,255,255,.06)",
	},
};

const tableRowSx = {
	display: "grid",
	gridTemplateColumns: "44px 1.8fr 1fr 1.2fr .6fr .7fr .9fr .9fr .6fr",
	alignItems: "center",
	borderBottom: "1px solid rgba(255,255,255,.06)",
	minHeight: 46,
	background: "#191d27",
};

const missingRowSx = {
	...tableRowSx,
	background: "rgba(127,29,29,.34)",
};

const deleteCellSx = {
	color: "rgba(255,255,255,.55)",
	display: "grid",
	placeItems: "center",
};

const itemNameCellSx = {
	display: "flex",
	alignItems: "center",
	gap: 0.8,
	px: 1.2,
	minWidth: 0,
};

const itemNameSx = {
	color: "#fff",
	fontWeight: 900,
	fontSize: 14,
};

const missingItemSx = {
	...itemNameSx,
	color: "#fee2e2",
};

const cellTextSx = {
	color: "rgba(255,255,255,.82)",
	fontWeight: 700,
	px: 1.2,
};

const cellStrongSx = {
	color: "#fff",
	fontWeight: 950,
	px: 1.2,
};

const numberCellSx = {
	color: "#fff",
	fontWeight: 950,
	fontFamily: "monospace",
	px: 1.2,
};

const rateCellSx = {
	color: "#fff",
	fontWeight: 950,
	fontFamily: "monospace",
	px: 1.2,
};

const missingRateSx = {
	mx: 1.2,
	height: 32,
	borderRadius: "3px",
	border: "1px solid rgba(248,113,113,.60)",
	background: "rgba(127,29,29,.40)",
	color: "#fecaca",
	fontWeight: 950,
	fontFamily: "monospace",
	display: "grid",
	placeItems: "center",
};

const tableFooterSx = {
	height: 44,
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	px: 2,
	background: "#191d27",
};

const addRowBtnSx = {
	color: "#a8c3ff",
	textTransform: "none",
	fontWeight: 850,
};

const validRateSx = {
	color: "#d1d5db",
	fontSize: 12,
	fontWeight: 900,
	fontFamily: "monospace",
};

const collapsedSectionSx = {
	height: 64,
	background: "#1a1e27",
	border: "1px solid rgba(255,255,255,.14)",
	borderRadius: "8px",
	boxShadow: "0 18px 44px rgba(0,0,0,.32)",
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	px: 2,
	borderLeft: "4px solid #8b2cf5",
};