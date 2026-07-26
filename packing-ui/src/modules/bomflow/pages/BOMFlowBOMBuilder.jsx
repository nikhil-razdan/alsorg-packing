import {
	useEffect,
	useMemo,
	useState,
} from "react";

import {
	useNavigate,
	useParams,
} from "react-router-dom";

import bomFlowApi
	from "../api/bomFlowApi.js";

import {
	canApproveBomFlowRevision,
	canEditBomFlowRevision,
	canReleaseBomToMatFlow,
	canReviewBomFlowRevision,
	canSubmitBomFlowRevision,
	getBomFlowRole,
} from "../../../utils/bomflowAccess.js";

import {
	Box,
	Button,
	Card,
	Chip,
	CircularProgress,
	Collapse,
	IconButton,
	LinearProgress,
	Typography,
} from "@mui/material";


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


const formatCurrency = (value) => {
	return `₹ ${Number(value || 0).toLocaleString("en-IN")}`;
};

const sectionColor = (key) => {
	const colors = {
		metal: "#60a5fa",
		wood: "#8b5cf6",
		hardware: "#f59e0b",
		stone: "#14b8a6",
		glass: "#38bdf8",
		upholstery: "#ec4899",
		paint: "#f472b6",
		packaging: "#22c55e",
		miscellaneous: "#94a3b8",
	};

	return colors[key] || "#60a5fa";
};

const quickActions = [
	{
		title: "Product Master",
		subtitle:
			"Return to product selection and revision management.",
		icon: <Inventory2OutlinedIcon />,
		path: "/bomflow/products",
	},
	{
		title: "Rate Master",
		subtitle:
			"Review missing and approved material rates.",
		icon: <PriceChangeOutlinedIcon />,
		path: "/bomflow/rate-master",
	},
	{
		title: "BOM Reports",
		subtitle:
			"Open BOM and costing export reports.",
		icon: <AssessmentOutlinedIcon />,
		path: "/bomflow/reports",
	},
];

export default function BOMFlowBOMBuilder() {
	const navigate = useNavigate();
	const { revisionId } = useParams();

	const role = getBomFlowRole();

	const [revision, setRevision] =
		useState(null);

	const [loading, setLoading] =
		useState(true);

	const [working, setWorking] =
		useState(false);

	const [error, setError] =
		useState("");

	const [openSections, setOpenSections] =
		useState({});

	const loadRevision = async () => {
		if (!revisionId) {
			setError("BOM revision ID is missing.");
			setLoading(false);
			return;
		}

		setLoading(true);
		setError("");

		try {
			const response =
				await bomFlowApi.getRevision(
					revisionId
				);

			setRevision(response);

			const rows =
				response?.items ||
				response?.lines ||
				[];

			const sectionState = {};

			rows.forEach((row) => {
				const key =
					String(
						row?.section ||
						row?.category ||
						"miscellaneous"
					)
						.trim()
						.toLowerCase()
						.replace(/[^a-z0-9]+/g, "-");

				sectionState[key] = true;
			});

			setOpenSections(sectionState);
		} catch (requestError) {
			setError(
				requestError?.response?.data?.message ||
				requestError?.message ||
				"Unable to load BOM revision."
			);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadRevision();
	}, [revisionId]);

	const revisionRows = useMemo(() => {
		return (
			revision?.items ||
			revision?.lines ||
			[]
		);
	}, [revision]);

	const missingRateRows = useMemo(() => {
		return revisionRows.filter((row) => {
			return Number(row?.rate ?? 0) <= 0;
		});
	}, [revisionRows]);

	const firstMissingRate =
		missingRateRows[0] || null;

	const materialSections = useMemo(() => {
		const grouped = new Map();

		revisionRows.forEach((row) => {
			const title =
				row?.section ||
				row?.category ||
				"Miscellaneous";

			const key = String(title)
				.trim()
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-");

			if (!grouped.has(key)) {
				grouped.set(key, {
					key,
					title,
					rows: [],
					totalValue: 0,
					missingRates: 0,
					accent: sectionColor(key),
				});
			}

			const section = grouped.get(key);

			const quantity = Number(
				row?.requiredQty ??
				row?.quantity ??
				0
			);

			const rate = Number(row?.rate ?? 0);

			const amount = Number(
				row?.amount ??
				quantity * rate
			);

			const normalizedRow = {
				...row,
				qty: quantity,
				rateValue: rate,
				amountValue: amount,
				status:
					rate > 0
						? "valid"
						: "missing",
			};

			section.rows.push(normalizedRow);
			section.totalValue += amount;

			if (rate <= 0) {
				section.missingRates += 1;
			}
		});

		return Array.from(grouped.values()).map(
			(section) => ({
				...section,
				count: `${section.rows.length} ${section.rows.length === 1
					? "Item"
					: "Items"
					}`,
				total: formatCurrency(
					section.totalValue
				),
				validRates: `${section.rows.length -
					section.missingRates
					}/${section.rows.length}`,
			})
		);
	}, [revisionRows]);

	const totalCost = useMemo(() => {
		return materialSections.reduce(
			(sum, section) =>
				sum + section.totalValue,
			0
		);
	}, [materialSections]);

	const totalRows = revisionRows.length;

	const missingRates =
		materialSections.reduce(
			(sum, section) =>
				sum + section.missingRates,
			0
		);

	const validRatePercent =
		totalRows > 0
			? Math.round(
				((totalRows - missingRates) /
					totalRows) *
				100
			)
			: 0;

	const completionPercent =
		totalRows > 0
			? Math.round(
				((totalRows - missingRates) /
					totalRows) *
				100
			)
			: 0;

	const editable =
		revision?.status === "DRAFT" &&
		canEditBomFlowRevision(role);

	const toggleSection = (key) => {
		setOpenSections((prev) => ({
			...prev,
			[key]: !prev[key],
		}));
	};

	const handleSubmit = async () => {
		if (!canSubmitBomFlowRevision(role)) {
			return;
		}

		if (missingRates > 0) {
			setError(
				"Complete all missing rates before submission."
			);
			return;
		}

		setWorking(true);
		setError("");

		try {
			const updated =
				await bomFlowApi.submitRevision(
					revision.id,
					revision.rowVersion
				);

			setRevision(updated);
		} catch (requestError) {
			setError(
				requestError?.response?.data?.message ||
				requestError?.message ||
				"Unable to submit revision."
			);
		} finally {
			setWorking(false);
		}
	};

	const handleVerify = async () => {
		setWorking(true);
		setError("");

		try {
			const updated =
				await bomFlowApi.verifyRevision(
					revision.id,
					"BOM revision verified.",
					revision.rowVersion
				);

			setRevision(updated);
		} catch (requestError) {
			setError(
				requestError?.response?.data?.message ||
				requestError?.message ||
				"Unable to verify revision."
			);
		} finally {
			setWorking(false);
		}
	};

	const handleApprove = async () => {
		setWorking(true);
		setError("");

		try {
			const updated =
				await bomFlowApi.approveRevision(
					revision.id,
					"BOM revision approved.",
					revision.rowVersion
				);

			setRevision(updated);
		} catch (requestError) {
			setError(
				requestError?.response?.data?.message ||
				requestError?.message ||
				"Unable to approve revision."
			);
		} finally {
			setWorking(false);
		}
	};

	const handleRelease = async () => {
		setWorking(true);
		setError("");

		try {
			const release =
				await bomFlowApi.releaseToMatFlow(
					revision.id,
					revision.rowVersion
				);

			if (!release?.id) {
				throw new Error(
					"MatFlow release ID was not returned."
				);
			}

			navigate(
				`/matflow/releases/${release.id}`
			);
		} catch (requestError) {
			setError(
				requestError?.response?.data?.message ||
				requestError?.message ||
				"Unable to release BOM to MatFlow."
			);
		} finally {
			setWorking(false);
		}
	};

	if (loading) {
		return (
			<Box
				sx={{
					minHeight: "340px",
					display: "grid",
					placeItems: "center",
				}}
			>
				<CircularProgress />
			</Box>
		);
	}

	const handleDeleteRow = async (row) => {
		if (
			!editable ||
			!revision?.id ||
			!row?.id
		) {
			return;
		}

		setWorking(true);
		setError("");

		try {
			await bomFlowApi.deleteRevisionLine(
				revision.id,
				row.id,
				row.rowVersion
			);

			await loadRevision();
		} catch (requestError) {
			setError(
				requestError?.response?.data?.message ||
				requestError?.message ||
				"Unable to delete the BOM row."
			);
		} finally {
			setWorking(false);
		}
	};

	return (
		<Box sx={styles.BOM_viewShellSx}>
			<Box sx={pageSx}>
				<Box sx={heroSx}>
					<Box sx={heroLeftSx}>
						<Box sx={chipRowSx}>
							<Chip label="BOM BUILDER" sx={labelChipSx} />
							<Chip
								label={
									revision?.projectCode ||
									revision?.projectReference ||
									"NO PROJECT"
								}
								sx={projectChipSx}
							/>
							<Chip
								label={`● ${revision?.status || "LOADING"}`}
								sx={draftChipSx}
							/>
						</Box>

						<Typography sx={pageTitleSx}>
							{revision?.productName || "BOM Revision"}
						</Typography>

						<Typography sx={pageSubSx}>
							Build section-wise material structure, validate live rates,
							calculate section totals and prepare the BOM for review,
							approval and final costing export.
						</Typography>

						<Box sx={heroMetaSx}>
							<MetaPill
								label="Revision"
								value={
									revision?.revisionNo ||
									revision?.revisionNumber ||
									"-"
								}
								accent="#60a5fa"
							/>

							<MetaPill
								label="Created By"
								value={
									revision?.createdBy ||
									revision?.updatedBy ||
									"-"
								}
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
							{editable && (
								<Button
									disabled={working}
									startIcon={<SaveOutlinedIcon />}
									onClick={loadRevision}
									sx={secondaryBtnSx}
								>
									Refresh Draft
								</Button>
							)}

							{revision?.status === "DRAFT" &&
								canSubmitBomFlowRevision(role) && (
									<Button
										disabled={
											working ||
											missingRates > 0 ||
											totalRows === 0
										}
										endIcon={<ArrowForwardIcon />}
										onClick={handleSubmit}
										sx={primaryBtnSx}
									>
										Send Review
									</Button>
								)}

							{[
								"SUBMITTED",
								"UNDER_REVIEW",
							].includes(revision?.status) &&
								canReviewBomFlowRevision(role) && (
									<Button
										disabled={working}
										onClick={handleVerify}
										sx={primaryBtnSx}
									>
										Verify Revision
									</Button>
								)}

							{revision?.status === "VERIFIED" &&
								canApproveBomFlowRevision(role) && (
									<Button
										disabled={working}
										onClick={handleApprove}
										sx={primaryBtnSx}
									>
										Approve Revision
									</Button>
								)}

							{revision?.status === "APPROVED" &&
								canReleaseBomToMatFlow(role) && (
									<Button
										disabled={working}
										onClick={handleRelease}
										sx={primaryBtnSx}
									>
										Release to MatFlow
									</Button>
								)}
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
											<SectionTable
												rows={section.rows}
												editable={editable && !working}
												onDelete={handleDeleteRow}
												validRates={section.validRates}
											/>
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

							{firstMissingRate ? (
								<Box sx={missingRateBoxSx}>
									<Box>
										<Typography sx={missingTitleSx}>
											{firstMissingRate.itemName ||
												firstMissingRate.item ||
												"Unnamed Material"}
										</Typography>

										<Typography sx={missingSubSx}>
											{firstMissingRate.section ||
												firstMissingRate.category ||
												"Uncategorized"}
											{" • "}
											{firstMissingRate.brand ||
												firstMissingRate.vendorName ||
												"No vendor"}
											{" • "}
											{firstMissingRate.unit || "-"}
										</Typography>
									</Box>

									<Chip
										label={`${missingRateRows.length} Missing`}
										size="small"
										sx={missingChipSx}
									/>
								</Box>
							) : (
								<Box
									sx={{
										...missingRateBoxSx,
										border:
											"1px solid rgba(34,197,94,.20)",
									}}
								>
									<Box>
										<Typography sx={missingTitleSx}>
											All Rates Available
										</Typography>

										<Typography sx={missingSubSx}>
											No material rate is currently blocking review.
										</Typography>
									</Box>

									<Chip
										label="Ready"
										size="small"
										sx={{
											...missingChipSx,
											color: "#4ade80",
											background:
												"rgba(34,197,94,.12)",
											border:
												"1px solid rgba(34,197,94,.22)",
										}}
									/>
								</Box>
							)}

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
									const percent =
										totalCost > 0
											? Math.round(
												(section.totalValue /
													totalCost) *
												100
											)
											: 0;

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

function SectionTable({
	rows,
	editable,
	onDelete,
	validRates,
}) {
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

			{rows.map((row, index) => {
				const missing = row.status === "missing";

				return (
					<Box
						key={
							row.id ||
							row.itemCode ||
							`${row.itemName || "row"}-${index}`
						}
						sx={missing ? missingRowSx : tableRowSx}
					>
						<Box
							sx={{
								...deleteCellSx,
								opacity: editable ? 1 : 0.3,
								pointerEvents: editable
									? "auto"
									: "none",
							}}
							onClick={() => onDelete?.(row)}
						>
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

							<Typography sx={itemNameSx}>
								{row.itemName || row.item}
							</Typography>
						</Box>

						<Typography sx={cellTextSx}>
							{row.category || row.section}
						</Typography>

						<Typography sx={cellTextSx}>
							{row.brand || row.vendorName || "-"}
						</Typography>

						<Typography sx={cellStrongSx}>
							{row.unit}
						</Typography>

						<Typography sx={numberCellSx}>
							{Number(row.qty || 0).toLocaleString(
								"en-US",
								{
									maximumFractionDigits: 3,
								}
							)}
						</Typography>

						<Typography sx={rateCellSx}>
							{formatCurrency(row.rateValue)}
						</Typography>

						<Typography sx={numberCellSx}>
							{formatCurrency(row.amountValue)}
						</Typography>

						<Typography sx={numberCellSx}>
							{Number(
								row.gstPercent ??
								row.gst ??
								0
							).toLocaleString("en-US", {
								maximumFractionDigits: 2,
							})}
							%
						</Typography>
					</Box>
				);
			})}

			<Box sx={tableFooterSx}>
				<Button startIcon={<AddIcon />} sx={addRowBtnSx}>
					Add Row
				</Button>

				<Typography sx={validRateSx}>
					Valid Rates: {validRates || "0/0"}
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