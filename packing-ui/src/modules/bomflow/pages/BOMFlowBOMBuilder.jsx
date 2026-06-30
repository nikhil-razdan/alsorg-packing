import React, { useMemo, useState } from "react";

import {
	Box,
	Button,
	Card,
	Chip,
	Collapse,
	IconButton,
	LinearProgress,
	Typography,
} from "@mui/material";

import { useNavigate } from "react-router-dom";

import * as styles from "../styles/bomStyles.js";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import AddIcon from "@mui/icons-material/Add";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CurrencyRupeeOutlinedIcon from "@mui/icons-material/CurrencyRupeeOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import PriceChangeOutlinedIcon from "@mui/icons-material/PriceChangeOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import SpeedOutlinedIcon from "@mui/icons-material/SpeedOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";

const metalRows = [
	{
		item: "MS Pipe 1×1 Inch",
		category: "Mild Steel",
		brand: "Tata Steel",
		unit: "RFT",
		qty: "45.00",
		rate: "₹ 120.00",
		amount: "5,400.00",
		amountValue: 5400,
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
		amountValue: 4250,
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
		amountValue: 0,
		gst: "18%",
		status: "missing",
	},
];

const materialSections = [
	{
		key: "metal",
		title: "Metal",
		count: "3 Items",
		total: "₹ 12,450.00",
		totalValue: 12450,
		accent: "#60a5fa",
		openByDefault: true,
		rows: metalRows,
		validRates: "2/3",
	},
	{
		key: "wood",
		title: "Wood / Material",
		count: "1 Item",
		total: "₹ 15,800.00",
		totalValue: 15800,
		accent: "#8b5cf6",
		rows: [],
		validRates: "1/1",
	},
	{
		key: "hardware",
		title: "Hardware",
		count: "4 Items",
		total: "₹ 6,250.00",
		totalValue: 6250,
		accent: "#f59e0b",
		rows: [],
		validRates: "4/4",
	},
	{
		key: "stone",
		title: "Stone / Glass",
		count: "2 Items",
		total: "₹ 8,900.00",
		totalValue: 8900,
		accent: "#14b8a6",
		rows: [],
		validRates: "2/2",
	},
	{
		key: "paint",
		title: "Paint / Polish",
		count: "1 Item",
		total: "₹ 1,850.00",
		totalValue: 1850,
		accent: "#ec4899",
		rows: [],
		validRates: "1/1",
	},
];

const quickActions = [
	{
		title: "Add Material Row",
		subtitle: "Insert one more item into selected section",
		icon: <AddIcon />,
		path: null,
	},
	{
		title: "Update Missing Rates",
		subtitle: "Open rate master and complete pending rates",
		icon: <PriceChangeOutlinedIcon />,
		path: "/bomflow/rate-master",
	},
	{
		title: "Export BOM Sheet",
		subtitle: "Generate Excel / PDF costing report",
		icon: <AssessmentOutlinedIcon />,
		path: "/bomflow/reports",
	},
];

const formatCurrency = (value) => {
	return `₹ ${Number(value || 0).toLocaleString("en-IN")}`;
};

export default function BOMFlowBOMBuilder() {
	const navigate = useNavigate();

	const [openSections, setOpenSections] = useState({
		metal: true,
	});

	const toggleSection = (key) => {
		setOpenSections((prev) => ({
			...prev,
			[key]: !prev[key],
		}));
	};

	const totalCost = useMemo(() => {
		return materialSections.reduce(
			(sum, section) => sum + Number(section.totalValue || 0),
			0
		);
	}, []);

	const missingRates = metalRows.filter(
		(row) => row.status === "missing"
	).length;

	const totalRows = materialSections.reduce((sum, section) => {
		const count = Number(String(section.count).split(" ")[0] || 0);
		return sum + count;
	}, 0);

	const validRatePercent =
		Math.round(((totalRows - missingRates) / totalRows) * 100) || 0;

	const completionPercent = 72;

	return (
		<Box sx={styles.BOM_viewShellSx}>
			<Box sx={pageSx}>
				<Box sx={heroSx}>
					<Box sx={heroLeftSx}>
						<Box sx={chipRowSx}>
							<Chip label="BOM BUILDER" sx={labelChipSx} />
							<Chip label="PRJ-2024-089" sx={projectChipSx} />
							<Chip label="● DRAFT" sx={draftChipSx} />
						</Box>

						<Typography sx={pageTitleSx}>
							Executive Office Desk - Mod A
						</Typography>

						<Typography sx={pageSubSx}>
							Build section-wise material structure, validate live rates,
							calculate section totals and prepare the BOM for review,
							approval and final costing export.
						</Typography>

						<Box sx={heroMetaSx}>
							<MetaPill
								label="Revision"
								value="R2"
								accent="#60a5fa"
							/>

							<MetaPill
								label="Created By"
								value="Admin"
								accent="#22c55e"
							/>

							<MetaPill
								label="Valid Rates"
								value={`${validRatePercent}%`}
								accent="#f59e0b"
							/>
						</Box>
					</Box>

					<Box sx={heroRightSx}>
						<Card sx={totalCostCardSx}>
							<Box sx={totalTopSx}>
								<Box>
									<Typography sx={totalLabelSx}>
										Total Estimated Cost
									</Typography>

									<Typography sx={totalValueSx}>
										{formatCurrency(totalCost)}
									</Typography>
								</Box>

								<Box sx={totalIconSx}>
									<CurrencyRupeeOutlinedIcon />
								</Box>
							</Box>

							<LinearProgress
								variant="determinate"
								value={completionPercent}
								sx={completionProgressSx}
							/>

							<Typography sx={totalHintSx}>
								{completionPercent}% BOM structure completed
							</Typography>
						</Card>

						<Box sx={heroActionRowSx}>
							<Button
								startIcon={<SaveOutlinedIcon />}
								sx={secondaryBtnSx}
							>
								Save Draft
							</Button>

							<Button
								endIcon={<ArrowForwardIcon />}
								sx={primaryBtnSx}
							>
								Send Review
							</Button>
						</Box>
					</Box>
				</Box>

				<Box sx={summaryGridSx}>
					<MiniStat
						icon={<Inventory2OutlinedIcon />}
						title="Total Items"
						value={totalRows}
						subtitle="Across all BOM sections"
						accent="#60a5fa"
					/>

					<MiniStat
						icon={<CurrencyRupeeOutlinedIcon />}
						title="Material Cost"
						value={formatCurrency(totalCost)}
						subtitle="Current estimated material total"
						accent="#22c55e"
					/>

					<MiniStat
						icon={<WarningAmberOutlinedIcon />}
						title="Missing Rates"
						value={missingRates}
						subtitle="Items blocking costing approval"
						accent="#ef4444"
					/>

					<MiniStat
						icon={<CheckCircleOutlineIcon />}
						title="Rate Health"
						value={`${validRatePercent}%`}
						subtitle="Valid item rates available"
						accent="#f59e0b"
					/>
				</Box>

				<Box sx={{ ...mainGridSx, mt: 0 }}>
					<Box sx={leftColumnSx}>
						<Card sx={builderToolbarSx}>
							<Box>
								<Typography sx={toolbarTitleSx}>
									BOM Sections
								</Typography>

								<Typography sx={toolbarSubSx}>
									Material structure is grouped by operational category.
								</Typography>
							</Box>

							<Box sx={toolbarActionsSx}>
								<Button
									startIcon={<AddIcon />}
									sx={secondaryBtnSx}
								>
									Add Section
								</Button>

								<Button
									startIcon={<DownloadOutlinedIcon />}
									onClick={() => navigate("/bomflow/reports")}
									sx={secondaryBtnSx}
								>
									Export BOM
								</Button>
							</Box>
						</Card>

						{materialSections.map((section) => {
							const isOpen = Boolean(openSections[section.key]);

							return (
								<Card
									key={section.key}
									sx={sectionCardSx(section.accent, isOpen)}
								>
									<Box sx={sectionHeaderSx}>
										<Box sx={sectionLeftSx}>
											<IconButton
												size="small"
												onClick={() =>
													toggleSection(section.key)
												}
												sx={sectionIconBtnSx}
											>
												{isOpen ? (
													<ExpandLessIcon />
												) : (
													<ExpandMoreIcon />
												)}
											</IconButton>

											<Box>
												<Box sx={sectionTitleRowSx}>
													<Typography sx={sectionTitleSx}>
														{section.title}
													</Typography>

													<Chip
														label={section.count}
														size="small"
														sx={countChipSx}
													/>
												</Box>

												<Typography sx={sectionSubSx}>
													Valid rates: {section.validRates}
												</Typography>
											</Box>
										</Box>

										<Box sx={sectionRightSx}>
											<Box>
												<Typography sx={sectionTotalLabelSx}>
													Section Total
												</Typography>

												<Typography sx={sectionTotalValueSx}>
													{section.total}
												</Typography>
											</Box>

											<IconButton sx={sectionIconBtnSx}>
												<MoreVertIcon />
											</IconButton>
										</Box>
									</Box>

									<Collapse in={isOpen}>
										{section.rows.length > 0 ? (
											<SectionTable rows={section.rows} />
										) : (
											<EmptySection
												accent={section.accent}
												title={section.title}
											/>
										)}
									</Collapse>
								</Card>
							);
						})}
					</Box>

					<Box sx={rightColumnSx}>
						<Card sx={assistantPanelSx}>
							<Box sx={sideTitleRowSx}>
								<Box>
									<Typography sx={sideTitleSx}>
										BOM Assistant
									</Typography>

									<Typography sx={sideSubSx}>
										Smart checks before review.
									</Typography>
								</Box>

								<AutoAwesomeOutlinedIcon sx={{ color: "#93c5fd" }} />
							</Box>

							<AssistantItem
								done
								label="Metal section added"
								subtitle="3 material rows detected"
							/>

							<AssistantItem
								done
								label="Quantity data entered"
								subtitle="All visible quantities are available"
							/>

							<AssistantItem
								done={false}
								label="Missing rate detected"
								subtitle="Brass Handles Custom needs approved rate"
							/>

							<AssistantItem
								done={false}
								label="Review not submitted"
								subtitle="Send to reviewer after rate correction"
							/>
						</Card>

						<Card sx={warningPanelSx}>
							<Box sx={sideTitleRowSx}>
								<Box>
									<Typography sx={sideTitleSx}>
										Rate Attention
									</Typography>

									<Typography sx={sideSubSx}>
										Items blocking final costing.
									</Typography>
								</Box>

								<WarningAmberOutlinedIcon sx={{ color: "#fca5a5" }} />
							</Box>

							<Box sx={missingRateBoxSx}>
								<Box>
									<Typography sx={missingTitleSx}>
										Brass Handles Custom
									</Typography>

									<Typography sx={missingSubSx}>
										Metal • Artisan Metals • NOS
									</Typography>
								</Box>

								<Chip
									label="Missing"
									size="small"
									sx={missingChipSx}
								/>
							</Box>

							<Button
								fullWidth
								onClick={() => navigate("/bomflow/rate-master")}
								sx={warningBtnSx}
							>
								Update Rate Master
							</Button>
						</Card>

						<Card sx={sidePanelSx}>
							<Box sx={sideTitleRowSx}>
								<Box>
									<Typography sx={sideTitleSx}>
										Section Split
									</Typography>

									<Typography sx={sideSubSx}>
										Cost distribution by section.
									</Typography>
								</Box>

								<AccountTreeOutlinedIcon sx={{ color: "#93c5fd" }} />
							</Box>

							<Box sx={splitListSx}>
								{materialSections.map((section) => {
									const percent = Math.round(
										(section.totalValue / totalCost) * 100
									);

									return (
										<Box key={section.key} sx={splitItemSx}>
											<Box sx={splitTopSx}>
												<Box sx={splitNameSx}>
													<span
														style={dotStyle(section.accent)}
													/>
													{section.title}
												</Box>

												<Typography sx={splitValueSx}>
													{percent}%
												</Typography>
											</Box>

											<LinearProgress
												variant="determinate"
												value={percent}
												sx={progressSx(section.accent)}
											/>
										</Box>
									);
								})}
							</Box>
						</Card>

						<Card sx={sidePanelSx}>
							<Box sx={sideTitleRowSx}>
								<Box>
									<Typography sx={sideTitleSx}>
										Quick Actions
									</Typography>

									<Typography sx={sideSubSx}>
										Frequent builder operations.
									</Typography>
								</Box>

								<SpeedOutlinedIcon sx={{ color: "#93c5fd" }} />
							</Box>

							<Box sx={quickActionListSx}>
								{quickActions.map((item) => (
									<button
										key={item.title}
										type="button"
										onClick={() => {
											if (item.path) navigate(item.path);
										}}
										style={quickActionStyle}
									>
										<span style={quickActionIconStyle}>
											{item.icon}
										</span>

										<span style={{ flex: 1 }}>
											<span style={quickActionTitleStyle}>
												{item.title}
											</span>

											<span style={quickActionSubStyle}>
												{item.subtitle}
											</span>
										</span>

										<ArrowForwardIcon fontSize="small" />
									</button>
								))}
							</Box>
						</Card>
					</Box>
				</Box>
			</Box>
		</Box>
	);
}

function SectionTable({ rows }) {
	return (
		<Box sx={tableShellSx}>
			<Box sx={tableHeadSx}>
				<div />
				<div>Item Name</div>
				<div>Category</div>
				<div>Brand / Vendor</div>
				<div>Unit</div>
				<div>Qty</div>
				<div>Rate</div>
				<div>Amount</div>
				<div>GST%</div>
			</Box>

			{rows.map((row) => {
				const missing = row.status === "missing";

				return (
					<Box
						key={row.item}
						sx={missing ? missingRowSx : tableRowSx}
					>
						<Box sx={deleteCellSx}>
							<DeleteOutlineIcon fontSize="small" />
						</Box>

						<Box sx={itemNameCellSx}>
							{missing && (
								<WarningAmberIcon
									fontSize="small"
									sx={{
										color: "#fca5a5",
										mr: 0.5,
										flexShrink: 0,
									}}
								/>
							)}

							<Typography
								sx={missing ? missingItemSx : itemNameSx}
							>
								{row.item}
							</Typography>
						</Box>

						<Typography sx={cellTextSx}>
							{row.category}
						</Typography>

						<Typography sx={cellTextSx}>
							{row.brand}
						</Typography>

						<Typography sx={cellStrongSx}>
							{row.unit}
						</Typography>

						<Typography sx={numberCellSx}>
							{row.qty}
						</Typography>

						{missing ? (
							<Box sx={missingRateSx}>
								Missing
							</Box>
						) : (
							<Typography sx={rateCellSx}>
								{row.rate}{" "}
								<span style={{ color: "#22c55e" }}>
									●
								</span>
							</Typography>
						)}

						<Typography sx={numberCellSx}>
							{row.amount}
						</Typography>

						<Typography sx={numberCellSx}>
							{row.gst}
						</Typography>
					</Box>
				);
			})}

			<Box sx={tableFooterSx}>
				<Button startIcon={<AddIcon />} sx={addRowBtnSx}>
					Add Row
				</Button>

				<Typography sx={validRateSx}>
					Valid Rates: 2/3
				</Typography>
			</Box>
		</Box>
	);
}

function EmptySection({ accent, title }) {
	return (
		<Box sx={emptySectionSx}>
			<Box sx={emptyIconSx(accent)}>
				<RuleOutlinedIcon />
			</Box>

			<Box>
				<Typography sx={emptyTitleSx}>
					No visible rows in {title}
				</Typography>

				<Typography sx={emptySubSx}>
					Add material items, quantities and rates to calculate this
					section accurately.
				</Typography>
			</Box>

			<Button startIcon={<AddIcon />} sx={addRowBtnSx}>
				Add Row
			</Button>
		</Box>
	);
}

function MiniStat({ icon, title, value, subtitle, accent }) {
	return (
		<Card sx={miniStatSx(accent)}>
			<Box sx={miniIconSx(accent)}>
				{icon}
			</Box>

			<Box>
				<Typography sx={miniTitleSx}>
					{title}
				</Typography>

				<Typography sx={miniValueSx}>
					{value}
				</Typography>

				<Typography sx={miniSubSx}>
					{subtitle}
				</Typography>
			</Box>
		</Card>
	);
}

function MetaPill({ label, value, accent }) {
	return (
		<Box sx={metaPillSx(accent)}>
			<Typography sx={metaLabelSx}>
				{label}
			</Typography>

			<Typography sx={metaValueSx}>
				{value}
			</Typography>
		</Box>
	);
}

function AssistantItem({ done, label, subtitle }) {
	return (
		<Box sx={assistantItemSx}>
			<Box sx={assistantDotSx(done)}>
				{done ? "✓" : "!"}
			</Box>

			<Box>
				<Typography sx={assistantLabelSx(done)}>
					{label}
				</Typography>

				<Typography sx={assistantSubSx}>
					{subtitle}
				</Typography>
			</Box>
		</Box>
	);
}

/* ===================== STYLES ===================== */

const pageSx = {
	width: "100%",
	display: "flex",
	flexDirection: "column",
	gap: "14px",
};

const heroSx = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "stretch",
	gap: "16px",
	flexWrap: "wrap",
	p: "16px",
	borderRadius: "10px",
	background:
		"radial-gradient(circle at top left, rgba(37,99,235,.22), transparent 34%), linear-gradient(180deg, rgba(15,23,42,.86), rgba(15,23,42,.72))",
	border: "1px solid rgba(255,255,255,.08)",
	boxShadow: "0 16px 32px rgba(2,6,23,.28)",
	backdropFilter: "blur(18px)",
};

const heroLeftSx = {
	minWidth: 280,
	flex: 1,
};

const heroRightSx = {
	width: {
		xs: "100%",
		md: 380,
	},
	display: "flex",
	flexDirection: "column",
	gap: "10px",
};

const chipRowSx = {
	display: "flex",
	alignItems: "center",
	gap: "8px",
	flexWrap: "wrap",
	mb: "10px",
};

const labelChipSx = {
	height: 26,
	borderRadius: 999,
	background: "rgba(59,130,246,.14)",
	color: "#60a5fa",
	border: "1px solid rgba(59,130,246,.24)",
	fontWeight: 900,
	fontSize: 11,
	letterSpacing: ".07em",
};

const projectChipSx = {
	height: 26,
	borderRadius: 999,
	background: "rgba(255,255,255,.06)",
	color: "#cbd5e1",
	border: "1px solid rgba(255,255,255,.10)",
	fontWeight: 850,
	fontSize: 11,
};

const draftChipSx = {
	...projectChipSx,
	color: "#fbbf24",
	background: "rgba(245,158,11,.13)",
	border: "1px solid rgba(245,158,11,.24)",
};

const pageTitleSx = {
	color: "#fff",
	fontSize: {
		xs: 24,
		md: 32,
	},
	fontWeight: 950,
	lineHeight: 1.05,
	letterSpacing: "-0.04em",
};

const pageSubSx = {
	mt: "8px",
	color: "rgba(255,255,255,.68)",
	fontSize: 13,
	fontWeight: 650,
	lineHeight: 1.5,
	maxWidth: 820,
};

const heroMetaSx = {
	display: "flex",
	alignItems: "stretch",
	gap: "8px",
	flexWrap: "wrap",
	mt: "14px",
};

const metaPillSx = (accent) => ({
	minWidth: 105,
	p: "9px 11px",
	borderRadius: "10px",
	background: `${accent}10`,
	border: `1px solid ${accent}26`,
});

const metaLabelSx = {
	color: "rgba(255,255,255,.56)",
	fontSize: 10,
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".08em",
};

const metaValueSx = {
	mt: "4px",
	color: "#fff",
	fontSize: 14,
	fontWeight: 950,
};

const totalCostCardSx = {
	p: "14px",
	borderRadius: "10px",
	background: "rgba(2,6,23,.42)",
	border: "1px solid rgba(255,255,255,.08)",
};

const totalTopSx = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "flex-start",
	gap: "14px",
	mb: "10px",
};

const totalLabelSx = {
	color: "rgba(255,255,255,.62)",
	fontSize: 10,
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".07em",
};

const totalValueSx = {
	mt: "5px",
	color: "#4ade80",
	fontSize: 28,
	fontWeight: 950,
	fontFamily: "monospace",
	lineHeight: 1,
};

const totalIconSx = {
	width: 38,
	height: 38,
	borderRadius: "9px",
	display: "grid",
	placeItems: "center",
	background: "rgba(34,197,94,.13)",
	color: "#4ade80",
	border: "1px solid rgba(34,197,94,.24)",
};

const completionProgressSx = {
	height: 7,
	borderRadius: 999,
	background: "rgba(255,255,255,.07)",

	"& .MuiLinearProgress-bar": {
		borderRadius: 999,
		background: "linear-gradient(135deg,#22c55e,#4ade80)",
	},
};

const totalHintSx = {
	mt: "8px",
	color: "rgba(255,255,255,.55)",
	fontSize: 11,
	fontWeight: 650,
};

const heroActionRowSx = {
	display: "grid",
	gridTemplateColumns: "1fr 1fr",
	gap: "8px",
};

const primaryBtnSx = {
	height: 38,
	borderRadius: "9px",
	textTransform: "none",
	fontWeight: 850,
	color: "#fff",
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	boxShadow: "0 10px 22px rgba(37,99,235,.30)",

	"&:hover": {
		background: "linear-gradient(135deg,#1d4ed8,#2563eb)",
	},
};

const secondaryBtnSx = {
	height: 38,
	borderRadius: "9px",
	textTransform: "none",
	fontWeight: 850,
	color: "#fff",
	background: "rgba(255,255,255,.04)",
	border: "1px solid rgba(255,255,255,.08)",

	"&:hover": {
		background: "rgba(59,130,246,.14)",
		borderColor: "rgba(59,130,246,.30)",
	},
};

const summaryGridSx = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
	gap: "10px",
};

const miniStatSx = (accent) => ({
	p: "13px",
	borderRadius: "10px",
	background: "rgba(15,23,42,.78)",
	border: "1px solid rgba(255,255,255,.07)",
	boxShadow: "0 14px 28px rgba(2,6,23,.26)",
	backdropFilter: "blur(18px)",
	display: "flex",
	alignItems: "center",
	gap: "12px",
	position: "relative",
	overflow: "hidden",
	minHeight: 72,

	"&:before": {
		content: '""',
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: 3,
		background: accent,
	},
});

const miniIconSx = (accent) => ({
	width: 38,
	height: 38,
	borderRadius: "9px",
	display: "grid",
	placeItems: "center",
	color: accent,
	background: `${accent}18`,
	border: `1px solid ${accent}33`,
	flexShrink: 0,
});

const miniTitleSx = {
	color: "rgba(255,255,255,.58)",
	fontSize: 10,
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".07em",
};

const miniValueSx = {
	mt: "3px",
	color: "#fff",
	fontSize: 17,
	fontWeight: 950,
};

const miniSubSx = {
	mt: "2px",
	color: "rgba(255,255,255,.52)",
	fontSize: 11,
	fontWeight: 650,
};

const mainGridSx = {
	display: "grid",
	gridTemplateColumns: "minmax(0, 1.7fr) minmax(340px, .75fr)",
	gap: "14px",
	alignItems: "start",
	marginTop: 0,

	"@media (max-width: 1180px)": {
		gridTemplateColumns: "1fr",
	},
};

const leftColumnSx = {
	display: "flex",
	flexDirection: "column",
	gap: "10px",
	minWidth: 0,
};

const rightColumnSx = {
	display: "flex",
	flexDirection: "column",
	gap: "10px",
	minWidth: 0,
};

const builderToolbarSx = {
	p: "13px 16px",
	borderRadius: "10px",
	background: "rgba(15,23,42,.78)",
	border: "1px solid rgba(255,255,255,.07)",
	boxShadow: "0 14px 28px rgba(2,6,23,.26)",
	backdropFilter: "blur(18px)",
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	gap: "12px",
	flexWrap: "wrap",
	marginBottom: 0,
};

const toolbarTitleSx = {
	color: "#fff",
	fontSize: 17,
	fontWeight: 950,
};

const toolbarSubSx = {
	mt: "3px",
	color: "rgba(255,255,255,.55)",
	fontSize: 11,
	fontWeight: 650,
};

const toolbarActionsSx = {
	display: "flex",
	alignItems: "center",
	gap: "8px",
	flexWrap: "wrap",
};

const sectionCardSx = (accent, open) => ({
	borderRadius: "10px",
	background: open
		? `linear-gradient(180deg, ${accent}11, rgba(15,23,42,.78))`
		: "rgba(15,23,42,.78)",
	border: open
		? `1px solid ${accent}44`
		: "1px solid rgba(255,255,255,.07)",
	borderLeft: `3px solid ${accent}`,
	boxShadow: open
		? `0 14px 28px ${accent}15`
		: "0 14px 28px rgba(2,6,23,.24)",
	backdropFilter: "blur(18px)",
	overflow: "hidden",
	transition: "all .25s ease",
	marginTop: 0,
});

const sectionHeaderSx = {
	minHeight: 52,
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "12px",
	px: "13px",
	py: "9px",
	background: "rgba(2,6,23,.22)",
	borderBottom: "1px solid rgba(255,255,255,.07)",
};

const sectionLeftSx = {
	display: "flex",
	alignItems: "center",
	gap: "10px",
	minWidth: 0,
};

const sectionRightSx = {
	display: "flex",
	alignItems: "center",
	gap: "12px",
	flexShrink: 0,
};

const sectionIconBtnSx = {
	color: "#94a3b8",
	background: "rgba(255,255,255,.04)",
	border: "1px solid rgba(255,255,255,.06)",
	width: 30,
	height: 30,
	borderRadius: "8px",

	"&:hover": {
		background: "rgba(59,130,246,.14)",
		color: "#fff",
	},
};

const sectionTitleRowSx = {
	display: "flex",
	alignItems: "center",
	gap: "8px",
	flexWrap: "wrap",
};

const sectionTitleSx = {
	color: "#fff",
	fontSize: 18,
	fontWeight: 950,
	letterSpacing: "-0.02em",
};

const sectionSubSx = {
	mt: "2px",
	color: "rgba(255,255,255,.50)",
	fontSize: 10.5,
	fontWeight: 650,
};

const countChipSx = {
	height: 20,
	borderRadius: 999,
	background: "rgba(255,255,255,.06)",
	color: "#94a3b8",
	fontWeight: 850,
	fontSize: 10,
};

const sectionTotalLabelSx = {
	color: "#94a3b8",
	fontSize: 9.5,
	textTransform: "uppercase",
	textAlign: "right",
	fontWeight: 850,
	letterSpacing: ".06em",
};

const sectionTotalValueSx = {
	mt: "3px",
	color: "#fff",
	fontWeight: 950,
	fontFamily: "monospace",
	fontSize: 13,
};

const tableShellSx = {
	background: "rgba(2,6,23,.18)",
	overflowX: "auto",
};

const tableHeadSx = {
	display: "grid",
	gridTemplateColumns:
		"38px minmax(230px,2fr) minmax(130px,1.1fr) minmax(160px,1.1fr) 74px 74px 115px 115px 65px",
	color: "rgba(255,255,255,.54)",
	fontSize: 10,
	fontWeight: 900,
	borderBottom: "1px solid rgba(255,255,255,.08)",
	background: "rgba(2,6,23,.34)",
	textTransform: "uppercase",
	letterSpacing: ".06em",
	minWidth: 1060,

	"& > div": {
		padding: "10px 9px",
	},
};

const tableRowSx = {
	display: "grid",
	gridTemplateColumns:
		"38px minmax(230px,2fr) minmax(130px,1.1fr) minmax(160px,1.1fr) 74px 74px 115px 115px 65px",
	alignItems: "center",
	borderBottom: "1px solid rgba(255,255,255,.06)",
	minHeight: 44,
	background: "rgba(255,255,255,.025)",
	minWidth: 1060,

	"& > p, & > div": {
		padding: "5px 9px",
	},
};

const missingRowSx = {
	...tableRowSx,
	background: "rgba(239,68,68,.08)",
	borderBottom: "1px solid rgba(239,68,68,.16)",
};

const deleteCellSx = {
	color: "#94a3b8",
	display: "grid",
	placeItems: "center",
	cursor: "pointer",

	"&:hover": {
		color: "#ef4444",
	},
};

const itemNameCellSx = {
	display: "flex",
	alignItems: "center",
	gap: "4px",
	minWidth: 0,
};

const itemNameSx = {
	color: "#fff",
	fontWeight: 800,
	fontSize: 12.5,
};

const missingItemSx = {
	color: "#fca5a5",
	fontWeight: 850,
	fontSize: 12.5,
};

const cellTextSx = {
	color: "#cbd5e1",
	fontSize: 12,
	fontWeight: 650,
};

const cellStrongSx = {
	color: "#fff",
	fontWeight: 800,
	fontSize: 12,
};

const numberCellSx = {
	color: "#fff",
	fontFamily: "monospace",
	fontSize: 12,
	fontWeight: 800,
};

const rateCellSx = {
	color: "#fff",
	fontFamily: "monospace",
	fontSize: 12,
	fontWeight: 850,
};

const missingRateSx = {
	background: "rgba(239,68,68,.14)",
	color: "#f87171",
	border: "1px solid rgba(239,68,68,.24)",
	borderRadius: "8px",
	textAlign: "center",
	fontWeight: 900,
	fontSize: 11,
	py: "3px",
};

const tableFooterSx = {
	height: 40,
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	px: "14px",
	background: "rgba(2,6,23,.30)",
};

const addRowBtnSx = {
	color: "#60a5fa",
	textTransform: "none",
	fontSize: 12,
	fontWeight: 850,
};

const validRateSx = {
	color: "#94a3b8",
	fontSize: 11,
	fontFamily: "monospace",
	fontWeight: 800,
};

const emptySectionSx = {
	p: "14px",
	display: "flex",
	alignItems: "center",
	gap: "12px",
	background: "rgba(2,6,23,.22)",
	borderTop: "1px solid rgba(255,255,255,.06)",
	flexWrap: "wrap",
};

const emptyIconSx = (accent) => ({
	width: 36,
	height: 36,
	borderRadius: "8px",
	display: "grid",
	placeItems: "center",
	color: accent,
	background: `${accent}15`,
	border: `1px solid ${accent}30`,
});

const emptyTitleSx = {
	color: "#fff",
	fontSize: 13,
	fontWeight: 900,
};

const emptySubSx = {
	mt: "2px",
	color: "rgba(255,255,255,.52)",
	fontSize: 11,
	fontWeight: 650,
	maxWidth: 520,
};

const sidePanelSx = {
	p: "15px",
	borderRadius: "10px",
	background: "rgba(15,23,42,.78)",
	border: "1px solid rgba(255,255,255,.07)",
	boxShadow: "0 14px 28px rgba(2,6,23,.26)",
	backdropFilter: "blur(18px)",
	overflow: "hidden",
};

const assistantPanelSx = {
	...sidePanelSx,
	background:
		"radial-gradient(circle at top right, rgba(59,130,246,.18), transparent 38%), rgba(15,23,42,.78)",
};

const warningPanelSx = {
	...sidePanelSx,
	background:
		"linear-gradient(180deg, rgba(239,68,68,.11), rgba(15,23,42,.78))",
	border: "1px solid rgba(239,68,68,.22)",
};

const sideTitleRowSx = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "flex-start",
	gap: "12px",
	mb: "12px",
};

const sideTitleSx = {
	color: "#fff",
	fontSize: 17,
	fontWeight: 950,
	lineHeight: 1.1,
	letterSpacing: "-0.02em",
};

const sideSubSx = {
	mt: "3px",
	color: "rgba(255,255,255,.52)",
	fontSize: 11,
	fontWeight: 650,
	lineHeight: 1.4,
};

const assistantItemSx = {
	display: "flex",
	gap: "9px",
	alignItems: "flex-start",
	py: "9px",
	borderBottom: "1px solid rgba(255,255,255,.06)",

	"&:last-of-type": {
		borderBottom: "none",
	},
};

const assistantDotSx = (done) => ({
	width: 22,
	height: 22,
	borderRadius: 999,
	display: "grid",
	placeItems: "center",
	fontSize: 11,
	fontWeight: 950,
	color: done ? "#4ade80" : "#fbbf24",
	background: done
		? "rgba(34,197,94,.12)"
		: "rgba(245,158,11,.12)",
	border: done
		? "1px solid rgba(34,197,94,.22)"
		: "1px solid rgba(245,158,11,.22)",
	flexShrink: 0,
});

const assistantLabelSx = (done) => ({
	color: done ? "#fff" : "rgba(255,255,255,.72)",
	fontSize: 12,
	fontWeight: 850,
});

const assistantSubSx = {
	mt: "2px",
	color: "rgba(255,255,255,.50)",
	fontSize: 10.5,
	fontWeight: 650,
};

const missingRateBoxSx = {
	p: "12px",
	borderRadius: "8px",
	background: "rgba(2,6,23,.38)",
	border: "1px solid rgba(239,68,68,.18)",
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "8px",
	mb: "12px",
};

const missingTitleSx = {
	color: "#fff",
	fontSize: 12,
	fontWeight: 850,
};

const missingSubSx = {
	mt: "2px",
	color: "rgba(255,255,255,.50)",
	fontSize: 10.5,
	fontWeight: 650,
};

const missingChipSx = {
	height: 22,
	borderRadius: 999,
	background: "rgba(239,68,68,.14)",
	color: "#fca5a5",
	border: "1px solid rgba(239,68,68,.24)",
	fontWeight: 850,
	fontSize: 10,
};

const warningBtnSx = {
	height: 38,
	borderRadius: "9px",
	background: "rgba(239,68,68,.16)",
	color: "#fca5a5",
	border: "1px solid rgba(239,68,68,.28)",
	textTransform: "none",
	fontWeight: 900,
	fontSize: 12,

	"&:hover": {
		background: "rgba(239,68,68,.24)",
	},
};

const splitListSx = {
	display: "flex",
	flexDirection: "column",
	gap: "11px",
};

const splitItemSx = {
	display: "flex",
	flexDirection: "column",
	gap: "6px",
};

const splitTopSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "8px",
};

const splitNameSx = {
	display: "flex",
	alignItems: "center",
	gap: "7px",
	color: "#fff",
	fontSize: 12,
	fontWeight: 850,
};

const splitValueSx = {
	color: "rgba(255,255,255,.72)",
	fontSize: 11,
	fontWeight: 850,
};

const dotStyle = (accent) => ({
	width: 8,
	height: 8,
	borderRadius: 999,
	background: accent,
	boxShadow: `0 0 12px ${accent}`,
});

const progressSx = (accent) => ({
	height: 7,
	borderRadius: 999,
	background: "rgba(255,255,255,.06)",

	"& .MuiLinearProgress-bar": {
		borderRadius: 999,
		background: accent,
	},
});

const quickActionListSx = {
	display: "flex",
	flexDirection: "column",
	gap: "8px",
};

const quickActionStyle = {
	width: "100%",
	minHeight: 54,
	padding: "10px 12px",
	borderRadius: 8,
	background: "rgba(255,255,255,.04)",
	border: "1px solid rgba(255,255,255,.07)",
	color: "#fff",
	display: "flex",
	alignItems: "center",
	gap: 10,
	textAlign: "left",
	cursor: "pointer",
	fontFamily: "inherit",
	transition: "all .22s ease",
};

const quickActionIconStyle = {
	width: 32,
	height: 32,
	borderRadius: 8,
	background: "rgba(59,130,246,.13)",
	border: "1px solid rgba(59,130,246,.20)",
	color: "#93c5fd",
	display: "grid",
	placeItems: "center",
	flexShrink: 0,
};

const quickActionTitleStyle = {
	display: "block",
	color: "#fff",
	fontSize: 12,
	fontWeight: 900,
};

const quickActionSubStyle = {
	display: "block",
	marginTop: 3,
	color: "rgba(255,255,255,.52)",
	fontSize: 10.5,
	fontWeight: 650,
	lineHeight: 1.3,
};