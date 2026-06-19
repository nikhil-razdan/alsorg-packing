import React from "react";
import { Box, Button, Card, Chip, Grid, TextField, Typography, MenuItem } from "@mui/material";

import * as styles from "../styles/bomStyles.js";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import StraightenOutlinedIcon from "@mui/icons-material/StraightenOutlined";
import BusinessCenterOutlinedIcon from "@mui/icons-material/BusinessCenterOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CameraAltOutlinedIcon from "@mui/icons-material/CameraAltOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import AddCircleOutlineOutlinedIcon from "@mui/icons-material/AddCircleOutlineOutlined";

export default function BOMFlowProductMaster() {
	return (
		<Box>
			<Box sx={styles.BOM_pageTopSx}>
				<Box>
					<Typography sx={styles.BOM_pageTitleSx}>New Product Entity</Typography>
					<Typography sx={styles.BOM_pageSubSx}>Define core product attributes before initiating the Bill of Materials.</Typography>
				</Box>
				<Box sx={styles.BOM_statusWrapSx}>
					<Typography sx={styles.BOM_statusTextSx}>Current Status:</Typography>
					<Chip label="● Draft" sx={styles.BOM_draftChipSx} />
				</Box>
			</Box>

			<Grid container spacing={2.5}>
				<Grid item xs={12} lg={8}>
					<Card sx={styles.BOM_panelSx}>
						<SectionTitle icon={<InfoOutlinedIcon />} title="Identification & Taxonomy" />
						<TextField fullWidth label="Product Name *" placeholder="e.g. Executive Office Desk - Series X" sx={styles.BOM_fieldSx} />
						<Grid container spacing={2}>
							<Grid item xs={12} md={6}>
								<TextField fullWidth label="Product Code *" placeholder="E.G. DESK-EX-001" sx={styles.BOM_fieldSx} />
							</Grid>
							<Grid item xs={12} md={6}>
								<TextField fullWidth label="Drawing Number" placeholder="e.g. DRW-2023-45B" sx={styles.BOM_fieldSx} />
							</Grid>
							<Grid item xs={12} md={6}>
								<TextField select fullWidth label="Category" defaultValue="" sx={styles.BOM_fieldSx}>
									<MenuItem value="">Select Category</MenuItem>
									<MenuItem value="desk">Desk</MenuItem>
									<MenuItem value="chair">Chair</MenuItem>
									<MenuItem value="table">Table</MenuItem>
								</TextField>
							</Grid>
							<Grid item xs={12} md={6}>
								<TextField fullWidth label="Collection / Series" placeholder="e.g. Aether Collection" sx={styles.BOM_fieldSx} />
							</Grid>
						</Grid>
					</Card>

					<Card sx={styles.BOM_panelSx}>
						<SectionTitle icon={<StraightenOutlinedIcon />} title="Physical Specifications" color="#22c55e" />
						<Grid container spacing={2}>
							<Grid item xs={12} md={4}>
								<TextField fullWidth label="Length (mm)" defaultValue="0.00" sx={styles.BOM_fieldSx} />
							</Grid>
							<Grid item xs={12} md={4}>
								<TextField fullWidth label="Width/Depth (mm)" defaultValue="0.00" sx={styles.BOM_fieldSx} />
							</Grid>
							<Grid item xs={12} md={4}>
								<TextField fullWidth label="Height (mm)" defaultValue="0.00" sx={styles.BOM_fieldSx} />
							</Grid>
						</Grid>
						<Box sx={styles.BOM_noteSx}>
							<Typography sx={styles.BOM_noteTextSx}>
								Ensure dimensions reflect the final assembled product. These values are used to calculate packaging and shipping volume in downstream modules.
							</Typography>
						</Box>
					</Card>

					<Card sx={styles.BOM_panelSx}>
						<SectionTitle icon={<BusinessCenterOutlinedIcon />} title="Project Allocation" color="#a855f7" />
						<Grid container spacing={2}>
							<Grid item xs={12} md={6}>
								<TextField fullWidth label="Project Reference" placeholder="Search or create project..." sx={styles.BOM_fieldSx} />
							</Grid>
							<Grid item xs={12} md={6}>
								<TextField fullWidth label="Client Entity" placeholder="Search client database..." sx={styles.BOM_fieldSx} />
							</Grid>
						</Grid>
					</Card>
				</Grid>

				<Grid item xs={12} lg={4}>
					<Card sx={styles.BOM_sidePanelSx}>
						<Box sx={styles.BOM_sideTitleRowSx}>
							<Typography sx={styles.BOM_sideTitleSx}>Product Visual</Typography>
							<AutoAwesomeOutlinedIcon sx={{ color: "#64748b" }} />
						</Box>
						<Box sx={styles.BOM_uploadBoxSx}>
							<Box sx={styles.BOM_uploadIconSx}><CameraAltOutlinedIcon /></Box>
							<Typography sx={styles.BOM_uploadTitleSx}>Upload Product Photo</Typography>
							<Typography sx={styles.BOM_uploadSubSx}>PNG, JPG or WEBP (Max. 5MB)</Typography>
						</Box>
					</Card>

					<Card sx={styles.BOM_sidePanelSx}>
						<Box sx={styles.BOM_sideTitleRowSx}>
							<Typography sx={styles.BOM_sideTitleSx}>Technical CAD/PDF</Typography>
							<Chip label="Req for BOM" size="small" sx={styles.BOM_smallDarkChipSx} />
						</Box>
						<Box sx={styles.BOM_drawingBoxSx}>
							<UploadFileOutlinedIcon sx={{ color: "#64748b", mb: 1 }} />
							<Typography sx={styles.BOM_uploadTitleSx}>Drag & Drop Drawing Files</Typography>
							<Button sx={styles.BOM_browseBtnSx}>Browse Files</Button>
						</Box>
						<Typography sx={styles.BOM_noFileSx}>ⓘ No drawings attached yet.</Typography>
					</Card>

					<Card sx={styles.BOM_sidePanelSx}>
						<Box sx={styles.BOM_sideTitleRowSx}>
							<Typography sx={styles.BOM_sideTitleSx}>Costing Versions</Typography>
							<HistoryOutlinedIcon sx={{ color: "#64748b" }} />
						</Box>
						<VersionRow title="V3 - Final Approval" date="2023-10-24" status="APPROVED" icon={<VisibilityOutlinedIcon />} />
						<VersionRow title="V2 - Revised Metal Rates" date="2023-10-20" status="DRAFT" icon={<OpenInNewOutlinedIcon />} />
						<Button fullWidth startIcon={<AddCircleOutlineOutlinedIcon />} sx={styles.BOM_newVersionBtnSx}>Create New Version</Button>
					</Card>
				</Grid>
			</Grid>
		</Box>
	);
}

function SectionTitle({ icon, title, color = "#38bdf8" }) {
	return (
		<Box sx={styles.BOM_sectionHeadSx}>
			<Box sx={{ color, display: "flex" }}>{icon}</Box>
			<Typography sx={styles.BOM_sectionTitleSx}>{title}</Typography>
		</Box>
	);
}

function VersionRow({ title, date, status, icon }) {
	const statusSx = status === "APPROVED" ? styles.BOM_approvedSx : styles.BOM_draftMiniSx;
	return (
		<Box sx={styles.BOM_versionRowSx}>
			<Box>
				<Typography sx={styles.BOM_versionTitleSx}>{title}</Typography>
				<Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
					<Typography sx={styles.BOM_versionDateSx}>{date}</Typography>
					<Chip label={status} size="small" sx={statusSx} />
				</Box>
			</Box>
			<Box sx={{ color: "#38bdf8", display: "flex", cursor: "pointer" }}>{icon}</Box>
		</Box>
	);
}
