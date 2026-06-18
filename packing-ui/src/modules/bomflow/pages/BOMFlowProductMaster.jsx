import React from "react";
import {
	Box,
	Button,
	Card,
	Chip,
	Grid,
	TextField,
	Typography,
	MenuItem,
} from "@mui/material";

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
			<Box sx={pageTopSx}>
				<Box>
					<Typography sx={pageTitleSx}>New Product Entity</Typography>
					<Typography sx={pageSubSx}>
						Define core product attributes before initiating the Bill of Materials.
					</Typography>
				</Box>

				<Box sx={statusWrapSx}>
					<Typography sx={statusTextSx}>Current Status:</Typography>
					<Chip label="● Draft" sx={draftChipSx} />
				</Box>
			</Box>

			<Grid container spacing={2}>
				<Grid item xs={12} lg={8}>
					<Card sx={panelSx}>
						<SectionTitle
							icon={<InfoOutlinedIcon />}
							title="Identification & Taxonomy"
						/>

						<TextField
							fullWidth
							label="Product Name *"
							placeholder="e.g. Executive Office Desk - Series X"
							sx={fieldSx}
						/>

						<Grid container spacing={2}>
							<Grid item xs={12} md={6}>
								<TextField
									fullWidth
									label="Product Code *"
									placeholder="E.G. DESK-EX-001"
									sx={fieldSx}
								/>
							</Grid>

							<Grid item xs={12} md={6}>
								<TextField
									fullWidth
									label="Drawing Number"
									placeholder="e.g. DRW-2023-45B"
									sx={fieldSx}
								/>
							</Grid>

							<Grid item xs={12} md={6}>
								<TextField select fullWidth label="Category" defaultValue="" sx={fieldSx}>
									<MenuItem value="">Select Category</MenuItem>
									<MenuItem value="desk">Desk</MenuItem>
									<MenuItem value="chair">Chair</MenuItem>
									<MenuItem value="table">Table</MenuItem>
									<MenuItem value="wardrobe">Wardrobe</MenuItem>
									<MenuItem value="millwork">Millwork</MenuItem>
								</TextField>
							</Grid>

							<Grid item xs={12} md={6}>
								<TextField
									fullWidth
									label="Collection / Series"
									placeholder="e.g. Aether Collection"
									sx={fieldSx}
								/>
							</Grid>
						</Grid>
					</Card>

					<Card sx={panelSx}>
						<SectionTitle
							icon={<StraightenOutlinedIcon />}
							title="Physical Specifications"
							color="#52e08f"
						/>

						<Grid container spacing={2}>
							<Grid item xs={12} md={4}>
								<TextField fullWidth label="Length (mm)" defaultValue="0.00" sx={fieldSx} />
							</Grid>

							<Grid item xs={12} md={4}>
								<TextField fullWidth label="Width/Depth (mm)" defaultValue="0.00" sx={fieldSx} />
							</Grid>

							<Grid item xs={12} md={4}>
								<TextField fullWidth label="Height (mm)" defaultValue="0.00" sx={fieldSx} />
							</Grid>
						</Grid>

						<Box sx={noteSx}>
							<Box sx={noteIconSx}>◉</Box>
							<Typography sx={noteTextSx}>
								Ensure dimensions reflect the final assembled product. These values are used
								to calculate packaging and shipping volume in downstream modules.
							</Typography>
						</Box>
					</Card>

					<Card sx={panelSx}>
						<SectionTitle
							icon={<BusinessCenterOutlinedIcon />}
							title="Project Allocation"
							color="#c084fc"
						/>

						<Grid container spacing={2}>
							<Grid item xs={12} md={6}>
								<TextField
									fullWidth
									label="Project Reference"
									placeholder="Search or create project..."
									sx={fieldSx}
								/>
							</Grid>

							<Grid item xs={12} md={6}>
								<TextField
									fullWidth
									label="Client Entity"
									placeholder="Search client database..."
									sx={fieldSx}
								/>
							</Grid>
						</Grid>
					</Card>
				</Grid>

				<Grid item xs={12} lg={4}>
					<Card sx={sidePanelSx}>
						<Box sx={sideTitleRowSx}>
							<Typography sx={sideTitleSx}>Product Visual</Typography>
							<AutoAwesomeOutlinedIcon sx={{ color: "#cbd5e1" }} />
						</Box>

						<Box sx={uploadBoxSx}>
							<Box sx={uploadIconSx}>
								<CameraAltOutlinedIcon />
							</Box>

							<Typography sx={uploadTitleSx}>Upload Product Photo</Typography>
							<Typography sx={uploadSubSx}>PNG, JPG or WEBP (Max. 5MB)</Typography>
						</Box>
					</Card>

					<Card sx={sidePanelSx}>
						<Box sx={sideTitleRowSx}>
							<Typography sx={sideTitleSx}>Technical CAD/PDF</Typography>
							<Chip label="Req for BOM" size="small" sx={smallDarkChipSx} />
						</Box>

						<Box sx={drawingBoxSx}>
							<UploadFileOutlinedIcon sx={{ color: "#9ca3af", mb: 1 }} />
							<Typography sx={uploadTitleSx}>Drag & Drop Drawing Files</Typography>
							<Typography sx={uploadSubSx}>Supports PDF, DWG, DXF</Typography>
							<Button sx={browseBtnSx}>Browse Files</Button>
						</Box>

						<Typography sx={noFileSx}>ⓘ No drawings attached yet.</Typography>
					</Card>

					<Card sx={sidePanelSx}>
						<Box sx={sideTitleRowSx}>
							<Typography sx={sideTitleSx}>Costing Versions</Typography>
							<HistoryOutlinedIcon sx={{ color: "#9ca3af" }} />
						</Box>

						<VersionRow
							title="V3 - Final Approval"
							date="2023-10-24"
							status="APPROVED"
							icon={<VisibilityOutlinedIcon />}
						/>

						<VersionRow
							title="V2 - Revised Metal Rates"
							date="2023-10-20"
							status="DRAFT"
							icon={<OpenInNewOutlinedIcon />}
						/>

						<VersionRow
							title="V1 - Initial Draft"
							date="2023-10-15"
							status="REJECTED"
							icon={<VisibilityOutlinedIcon />}
						/>

						<Button fullWidth startIcon={<AddCircleOutlineOutlinedIcon />} sx={newVersionBtnSx}>
							Create New Version
						</Button>
					</Card>
				</Grid>
			</Grid>
		</Box>
	);
}

function SectionTitle({ icon, title, color = "#a8c3ff" }) {
	return (
		<Box sx={sectionHeadSx}>
			<Box sx={{ color, display: "flex" }}>{icon}</Box>
			<Typography sx={sectionTitleSx}>{title}</Typography>
		</Box>
	);
}

function VersionRow({ title, date, status, icon }) {
	const statusSx =
		status === "APPROVED"
			? approvedSx
			: status === "REJECTED"
				? rejectedSx
				: draftMiniSx;

	return (
		<Box sx={versionRowSx}>
			<Box>
				<Typography sx={versionTitleSx}>{title}</Typography>
				<Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
					<Typography sx={versionDateSx}>{date}</Typography>
					<Chip label={status} size="small" sx={statusSx} />
				</Box>
			</Box>

			<Box sx={{ color: "#a8c3ff", display: "flex" }}>{icon}</Box>
		</Box>
	);
}

const pageTopSx = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "flex-start",
	gap: 2,
	mb: 2.8,
};

const pageTitleSx = {
	color: "#f8fafc",
	fontSize: 38,
	lineHeight: 1,
	fontWeight: 950,
	letterSpacing: "-0.045em",
};

const pageSubSx = {
	mt: 1,
	color: "rgba(255,255,255,.70)",
	fontWeight: 650,
};

const statusWrapSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
};

const statusTextSx = {
	color: "#e5e7eb",
	fontWeight: 800,
	fontSize: 13,
};

const draftChipSx = {
	height: 30,
	borderRadius: "999px",
	background: "#252a34",
	color: "#e5e7eb",
	border: "1px solid rgba(255,255,255,.10)",
	fontWeight: 850,
	"& .MuiChip-label": {
		px: 1.4,
	},
};

const panelSx = {
	mb: 2,
	p: 2.4,
	background: "#1a1e27",
	border: "1px solid rgba(255,255,255,.12)",
	borderRadius: "8px",
	boxShadow: "0 14px 34px rgba(0,0,0,.24)",
};

const sectionHeadSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.2,
	pb: 1.6,
	mb: 2,
	borderBottom: "1px solid rgba(255,255,255,.08)",
};

const sectionTitleSx = {
	color: "#fff",
	fontWeight: 950,
	fontSize: 22,
};

const fieldSx = {
	mb: 2,
	"& .MuiInputLabel-root": {
		color: "rgba(255,255,255,.70)",
		fontWeight: 800,
	},
	"& .MuiInputLabel-root.Mui-focused": {
		color: "#a8c3ff",
	},
	"& .MuiOutlinedInput-root": {
		background: "#0d1119",
		color: "#fff",
		borderRadius: "4px",
		fontWeight: 750,
		"& fieldset": {
			borderColor: "rgba(148,163,184,.24)",
		},
		"&:hover fieldset": {
			borderColor: "rgba(168,195,255,.42)",
		},
		"&.Mui-focused fieldset": {
			borderColor: "#8fb5ff",
		},
	},
	"& .MuiSvgIcon-root": {
		color: "#9ca3af",
	},
};

const noteSx = {
	mt: 1,
	p: 2,
	background: "#0d1119",
	display: "flex",
	gap: 1.4,
	alignItems: "flex-start",
};

const noteIconSx = {
	color: "#9ca3af",
	fontSize: 18,
	lineHeight: 1,
};

const noteTextSx = {
	color: "#e5e7eb",
	fontWeight: 650,
	lineHeight: 1.55,
};

const sidePanelSx = {
	mb: 2,
	p: 2.4,
	background: "#1a1e27",
	border: "1px solid rgba(255,255,255,.12)",
	borderRadius: "8px",
	boxShadow: "0 14px 34px rgba(0,0,0,.24)",
};

const sideTitleRowSx = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	mb: 2,
};

const sideTitleSx = {
	color: "#fff",
	fontSize: 22,
	fontWeight: 950,
	lineHeight: 1.1,
};

const uploadBoxSx = {
	height: 240,
	border: "2px dashed rgba(255,255,255,.16)",
	background: "#0d1119",
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	textAlign: "center",
};

const uploadIconSx = {
	width: 64,
	height: 64,
	borderRadius: "14px",
	background: "#2c313b",
	display: "grid",
	placeItems: "center",
	color: "#d1d5db",
	mb: 1.5,
	"& svg": {
		fontSize: 36,
	},
};

const uploadTitleSx = {
	color: "#fff",
	fontWeight: 950,
	fontSize: 13,
};

const uploadSubSx = {
	color: "#d1d5db",
	fontSize: 12,
	fontWeight: 700,
};

const smallDarkChipSx = {
	background: "#2c313b",
	color: "#d1d5db",
	borderRadius: "3px",
	fontWeight: 850,
};

const drawingBoxSx = {
	height: 150,
	border: "1px solid rgba(255,255,255,.14)",
	background: "#0d1119",
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	textAlign: "center",
	mb: 1.6,
};

const browseBtnSx = {
	mt: 1,
	height: 30,
	borderRadius: "3px",
	color: "#fff",
	border: "1px solid rgba(255,255,255,.22)",
	textTransform: "none",
	fontWeight: 850,
};

const noFileSx = {
	color: "rgba(255,255,255,.50)",
	fontStyle: "italic",
	fontWeight: 700,
	fontSize: 13,
};

const versionRowSx = {
	background: "#0d1119",
	border: "1px solid rgba(255,255,255,.08)",
	p: 1.4,
	mb: 1.2,
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
};

const versionTitleSx = {
	color: "#fff",
	fontWeight: 900,
	fontSize: 13,
	mb: 0.6,
};

const versionDateSx = {
	color: "#d1d5db",
	fontSize: 11,
	fontWeight: 700,
};

const approvedSx = {
	height: 18,
	borderRadius: "2px",
	background: "rgba(34,197,94,.18)",
	color: "#4ade80",
	fontSize: 10,
	fontWeight: 950,
};

const rejectedSx = {
	...approvedSx,
	background: "rgba(239,68,68,.18)",
	color: "#fca5a5",
};

const draftMiniSx = {
	...approvedSx,
	background: "rgba(255,255,255,.08)",
	color: "#e5e7eb",
};

const newVersionBtnSx = {
	height: 44,
	borderRadius: "4px",
	border: "1px dashed rgba(255,255,255,.16)",
	color: "#d1d5db",
	textTransform: "none",
	fontWeight: 850,
};