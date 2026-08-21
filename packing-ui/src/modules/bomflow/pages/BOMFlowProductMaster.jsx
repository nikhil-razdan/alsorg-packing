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
	from "../api/bomFlowApi";

import {
	Box,
	Button,
	Card,
	Chip,
	LinearProgress,
	MenuItem,
	TextField,
	Typography,
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
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";

export default function BOMFlowProductMaster() {
	const navigate = useNavigate();
	const { productId } = useParams();

	const [form, setForm] = useState({
		productName: "",
		productCode: "",
		drawingNumber: "",
		category: "",
		collection: "",
		length: "",
		width: "",
		height: "",
		projectReference: "",
		clientEntity: "",
	});

	const [savedProduct, setSavedProduct] =
		useState(null);

	const [loading, setLoading] =
		useState(Boolean(productId));

	const [saving, setSaving] =
		useState(false);

	const [error, setError] =
		useState("");

	const updateField = (key, value) => {
		setForm((prev) => ({
			...prev,
			[key]: value,
		}));

		if (error) {
			setError("");
		}
	};

	useEffect(() => {
		if (!productId) {
			return;
		}

		let active = true;

		const loadProduct = async () => {
			setLoading(true);
			setError("");

			try {
				const product =
					await bomFlowApi.getProduct(productId);

				if (!active) {
					return;
				}

				setSavedProduct(product);

				setForm({
					productName:
						product?.productName || "",
					productCode:
						product?.productCode || "",
					drawingNumber:
						product?.drawingNumber || "",
					category:
						product?.category || "",
					collection:
						product?.collection || "",
					length:
						product?.length != null
							? String(product.length)
							: "",
					width:
						product?.width != null
							? String(product.width)
							: "",
					height:
						product?.height != null
							? String(product.height)
							: "",
					projectReference:
						product?.projectReference || "",
					clientEntity:
						product?.clientEntity || "",
				});
			} catch (requestError) {
				if (active) {
					setError(
						requestError?.response?.data?.message ||
						requestError?.response?.data?.detail ||
						requestError?.message ||
						"Unable to load product."
					);
				}
			} finally {
				if (active) {
					setLoading(false);
				}
			}
		};

		loadProduct();

		return () => {
			active = false;
		};
	}, [productId]);

	const hasText = (value) => {
		return String(value ?? "").trim().length > 0;
	};

	const hasPositiveNumber = (value) => {
		const numericValue = Number(value);

		return (
			Number.isFinite(numericValue) &&
			numericValue > 0
		);
	};

	const completion = useMemo(() => {
		const checks = [
			hasText(form.productName),
			hasText(form.productCode),
			hasText(form.category),
			hasPositiveNumber(form.length),
			hasPositiveNumber(form.width),
			hasPositiveNumber(form.height),
		];

		const completed =
			checks.filter(Boolean).length;

		return Math.round(
			(completed / checks.length) * 100
		);
	}, [form]);

	const productTitle = useMemo(() => {
		const name = String(
			form.productName || ""
		).trim();

		if (name) {
			return name;
		}

		return productId
			? "Edit Product"
			: "Create New Product";
	}, [
		form.productName,
		productId,
	]);

	const productCode = useMemo(() => {
		const code = String(
			form.productCode || ""
		).trim();

		return code
			? code.toUpperCase()
			: "CODE PENDING";
	}, [form.productCode]);

	const productStatus =
		String(
			savedProduct?.status || "DRAFT"
		).toUpperCase();

	const dimensionsReady = [
		form.length,
		form.width,
		form.height,
	].every(hasPositiveNumber);

	const validateForm = () => {
		if (!hasText(form.productName)) {
			return "Product name is required.";
		}

		if (!hasText(form.productCode)) {
			return "Product code is required.";
		}

		if (!hasText(form.category)) {
			return "Product category is required.";
		}

		if (!hasPositiveNumber(form.length)) {
			return "Length must be greater than zero.";
		}

		if (!hasPositiveNumber(form.width)) {
			return "Width must be greater than zero.";
		}

		if (!hasPositiveNumber(form.height)) {
			return "Height must be greater than zero.";
		}

		return "";
	};

	const buildPayload = () => {
		return {
			productName: form.productName.trim(),
			productCode:
				form.productCode.trim().toUpperCase(),
			drawingNumber:
				form.drawingNumber.trim() || null,
			category: form.category,
			collection:
				form.collection.trim() || null,
			length: Number(form.length),
			width: Number(form.width),
			height: Number(form.height),
			projectReference:
				form.projectReference.trim() || null,
			clientEntity:
				form.clientEntity.trim() || null,
		};
	};

	const saveProduct = async () => {
		const validationError = validateForm();

		if (validationError) {
			setError(validationError);
			return null;
		}

		setSaving(true);
		setError("");

		try {
			const payload = buildPayload();

			const product =
				savedProduct?.id || productId
					? await bomFlowApi.updateProduct(
						savedProduct?.id || productId,
						payload,
						savedProduct?.rowVersion
					)
					: await bomFlowApi.createProduct(
						payload
					);

			setSavedProduct(product);

			return product;
		} catch (requestError) {
			setError(
				requestError?.response?.data?.message ||
				requestError?.response?.data?.detail ||
				requestError?.message ||
				"Unable to save product."
			);

			return null;
		} finally {
			setSaving(false);
		}
	};

	const handleSaveDraft = async () => {
		const product = await saveProduct();

		if (
			product?.id &&
			!productId
		) {
			navigate(
				`/bomflow/products/${product.id}/edit`,
				{ replace: true }
			);
		}
	};

	const handleStartBom = async () => {
		const product = await saveProduct();

		if (!product?.id) {
			return;
		}

		try {
			const existing =
				await bomFlowApi.listProductRevisions(
					product.id
				);

			const revisions = Array.isArray(existing)
				? existing
				: existing?.content || [];

			let revision = revisions.find(
				(item) =>
					["DRAFT", "RETURNED"].includes(
						item?.status
					)
			);

			if (!revision) {
				revision =
					await bomFlowApi.createRevision(
						product.id,
						{
							remarks:
								"Initial BOM revision",
						}
					);
			}

			if (!revision?.id) {
				throw new Error(
					"BOM revision ID was not returned."
				);
			}

			navigate(
				`/bomflow/revisions/${revision.id}`
			);
		} catch (requestError) {
			setError(
				requestError?.response?.data?.message ||
				requestError?.response?.data?.detail ||
				requestError?.message ||
				"Unable to start BOM revision."
			);
		}
	};

	if (loading) {
		return (
			<Box
				sx={{
					minHeight: "320px",
					display: "grid",
					placeItems: "center",
					color: "#fff",
				}}
			>
				<Typography
					sx={{
						color:
							"rgba(255,255,255,.68)",
						fontWeight: 800,
					}}
				>
					Loading product...
				</Typography>
			</Box>
		);
	}

	return (
		<Box sx={pageSx}>
			<Box sx={heroSx}>
				<Box sx={heroLeftSx}>
					<Chip label="PRODUCT MASTER" sx={labelChipSx} />

					<Typography sx={pageTitleSx}>
						{productTitle}
					</Typography>

					<Typography sx={pageSubSx}>
						Create a clean product profile with identification, dimensions,
						project allocation, visual files, drawings and costing version
						history before building the BOM.
					</Typography>

					<Box sx={heroMetaRowSx}>
						<Chip label={productCode} sx={metaChipSx} />
						<Chip
							label={`● ${productStatus}`}
							sx={draftChipSx}
						/>
						<Chip label={`${completion}% Complete`} sx={completeChipSx} />
					</Box>
				</Box>

				<Box sx={heroRightSx}>
					<Box sx={completionCardSx}>
						<Box sx={completionTopSx}>
							<Box>
								<Typography sx={completionLabelSx}>
									Profile Completion
								</Typography>

								<Typography sx={completionValueSx}>
									{completion}%
								</Typography>
							</Box>

							<Box sx={completionIconSx}>
								<CheckCircleOutlineIcon />
							</Box>
						</Box>

						<LinearProgress
							variant="determinate"
							value={completion}
							sx={completionProgressSx}
						/>

						<Typography sx={completionHintSx}>
							Fill required fields to activate BOM creation.
						</Typography>
					</Box>

					<Box sx={heroActionRowSx}>
						<Button
							disabled={saving || loading}
							onClick={handleSaveDraft}
							startIcon={<SaveOutlinedIcon />}
							sx={secondaryBtnSx}
						>
							{saving ? "Saving..." : "Save Draft"}
						</Button>

						<Button
							disabled={
								saving ||
								loading ||
								completion < 100
							}
							onClick={handleStartBom}
							endIcon={<ArrowForwardIcon />}
							sx={primaryBtnSx}
						>
							Start BOM
						</Button>
					</Box>
				</Box>
			</Box>
			{error && (
				<Box
					sx={{
						p: "11px 13px",
						borderRadius: "9px",
						color: "#fca5a5",
						background: "rgba(239,68,68,.12)",
						border:
							"1px solid rgba(239,68,68,.24)",
						fontSize: "12px",
						fontWeight: 750,
					}}
				>
					{error}
				</Box>
			)}
			<Box sx={summaryGridSx}>
				<MiniStat
					icon={<InfoOutlinedIcon />}
					title="Product Identity"
					value={form.productCode ? "Ready" : "Pending"}
					subtitle="Code, drawing and category"
					accent="#60a5fa"
				/>

				<MiniStat
					icon={<StraightenOutlinedIcon />}
					title="Dimensions"
					value={
						dimensionsReady
							? "Ready"
							: "Pending"
					}
					subtitle="Length, width and height"
					accent="#22c55e"
				/>

				<MiniStat
					icon={<ImageOutlinedIcon />}
					title="Product Visual"
					value="Not Added"
					subtitle="Photo upload required"
					accent="#f59e0b"
				/>

				<MiniStat
					icon={<DescriptionOutlinedIcon />}
					title="Drawing File"
					value="Pending"
					subtitle="CAD / PDF attachment"
					accent="#a855f7"
				/>
			</Box>

			<Box sx={mainGridSx}>
				<Box sx={leftColumnSx}>
					<Card sx={panelSx}>
						<SectionTitle
							icon={<InfoOutlinedIcon />}
							title="Identification & Taxonomy"
							subtitle="Define the core product identity used across BOM, costing and reports."
						/>

						<Box sx={fieldStackSx}>
							<TextField
								fullWidth
								label="Product Name *"
								placeholder="e.g. Executive Office Desk - Series X"
								value={form.productName}
								onChange={(e) =>
									updateField("productName", e.target.value)
								}
								sx={fieldSx}
							/>

							<Box sx={twoColumnGridSx}>
								<TextField
									fullWidth
									label="Product Code *"
									placeholder="e.g. DESK-EX-001"
									value={form.productCode}
									onChange={(e) =>
										updateField("productCode", e.target.value)
									}
									sx={fieldSx}
								/>

								<TextField
									fullWidth
									label="Drawing Number"
									placeholder="e.g. DRW-2023-45B"
									value={form.drawingNumber}
									onChange={(e) =>
										updateField("drawingNumber", e.target.value)
									}
									sx={fieldSx}
								/>
							</Box>

							<Box sx={twoColumnGridSx}>
								<TextField
									select
									fullWidth
									label="Category *"
									value={form.category}
									onChange={(e) =>
										updateField("category", e.target.value)
									}
									sx={fieldSx}
								>
									<MenuItem value="">Select Category</MenuItem>
									<MenuItem value="desk">Desk</MenuItem>
									<MenuItem value="chair">Chair</MenuItem>
									<MenuItem value="table">Table</MenuItem>
									<MenuItem value="wardrobe">Wardrobe</MenuItem>
									<MenuItem value="kitchen">Kitchen</MenuItem>
									<MenuItem value="millwork">Millwork</MenuItem>
								</TextField>

								<TextField
									fullWidth
									label="Collection / Series"
									placeholder="e.g. Aether Collection"
									value={form.collection}
									onChange={(e) =>
										updateField("collection", e.target.value)
									}
									sx={fieldSx}
								/>
							</Box>
						</Box>
					</Card>

					<Card sx={panelSx}>
						<SectionTitle
							icon={<StraightenOutlinedIcon />}
							title="Physical Specifications"
							subtitle="These values support downstream volume, packaging and logistics calculations."
							color="#22c55e"
						/>

						<Box sx={threeColumnGridSx}>
							<TextField
								fullWidth
								type="number"
								label="Length (mm) *"
								value={form.length}
								onChange={(e) =>
									updateField("length", e.target.value)
								}
								inputProps={{
									min: 0,
									step: "0.01",
								}}
								sx={fieldSx}
							/>

							<TextField
								fullWidth
								type="number"
								label="Width (mm) *"
								value={form.width}
								onChange={(e) =>
									updateField("width", e.target.value)
								}
								inputProps={{
									min: 0,
									step: "0.01",
								}}
								sx={fieldSx}
							/>

							<TextField
								fullWidth
								type="number"
								label="Height (mm) *"
								value={form.height}
								onChange={(e) =>
									updateField("height", e.target.value)
								}
								inputProps={{
									min: 0,
									step: "0.01",
								}}
								sx={fieldSx}
							/>
						</Box>

						<Box sx={dimensionPreviewSx}>
							<Box>
								<Typography sx={previewLabelSx}>
									Dimension Preview
								</Typography>

								<Typography sx={previewValueSx}>
									{form.length || "0.00"} × {form.width || "0.00"} ×{" "}
									{form.height || "0.00"} mm
								</Typography>
							</Box>

							<Box sx={previewBadgeSx}>
								Used for packing volume
							</Box>
						</Box>
					</Card>

					<Card sx={panelSx}>
						<SectionTitle
							icon={<BusinessCenterOutlinedIcon />}
							title="Project Allocation"
							subtitle="Link the product to project and client records for costing traceability."
							color="#a855f7"
						/>

						<Box sx={twoColumnGridSx}>
							<TextField
								fullWidth
								label="Project Reference"
								placeholder="Search or create project..."
								value={form.projectReference}
								onChange={(e) =>
									updateField("projectReference", e.target.value)
								}
								sx={fieldSx}
							/>

							<TextField
								fullWidth
								label="Client Entity"
								placeholder="Search client database..."
								value={form.clientEntity}
								onChange={(e) =>
									updateField("clientEntity", e.target.value)
								}
								sx={fieldSx}
							/>
						</Box>
					</Card>
				</Box>

				<Box sx={rightColumnSx}>
					<Card sx={sidePanelSx}>
						<Box sx={sideTitleRowSx}>
							<Box>
								<Typography sx={sideTitleSx}>
									Product Visual
								</Typography>

								<Typography sx={sideSubSx}>
									Add a reference image for quick product identification.
								</Typography>
							</Box>

							<AutoAwesomeOutlinedIcon sx={{ color: "#93c5fd" }} />
						</Box>

						<Box sx={uploadBoxSx}>
							<Box sx={uploadIconSx}>
								<CameraAltOutlinedIcon />
							</Box>

							<Typography sx={uploadTitleSx}>
								Upload Product Photo
							</Typography>

							<Typography sx={uploadSubSx}>
								PNG, JPG or WEBP • Max 5MB
							</Typography>

							<Button sx={browseBtnSx}>
								Choose Image
							</Button>
						</Box>
					</Card>

					<Card sx={sidePanelSx}>
						<Box sx={sideTitleRowSx}>
							<Box>
								<Typography sx={sideTitleSx}>
									Technical CAD / PDF
								</Typography>

								<Typography sx={sideSubSx}>
									Attach drawings required for BOM validation.
								</Typography>
							</Box>

							<Chip
								label="Required"
								size="small"
								sx={requiredChipSx}
							/>
						</Box>

						<Box sx={drawingBoxSx}>
							<UploadFileOutlinedIcon
								sx={{
									color: "#93c5fd",
									mb: 1,
								}}
							/>

							<Typography sx={uploadTitleSx}>
								Drag & Drop Drawing Files
							</Typography>

							<Typography sx={uploadSubSx}>
								Supports PDF, DWG and DXF files
							</Typography>

							<Button sx={browseBtnSx}>
								Browse Files
							</Button>
						</Box>

						<Typography sx={noFileSx}>
							ⓘ No drawings attached yet.
						</Typography>
					</Card>

					<Card sx={sidePanelSx}>
						<Box sx={sideTitleRowSx}>
							<Box>
								<Typography sx={sideTitleSx}>
									Costing Versions
								</Typography>

								<Typography sx={sideSubSx}>
									Track revisions and approved costing history.
								</Typography>
							</Box>

							<HistoryOutlinedIcon sx={{ color: "#93c5fd" }} />
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

						<Button
							fullWidth
							startIcon={<AddCircleOutlineOutlinedIcon />}
							sx={newVersionBtnSx}
						>
							Create New Version
						</Button>
					</Card>

					<Card sx={checklistPanelSx}>
						<Box sx={sideTitleRowSx}>
							<Box>
								<Typography sx={sideTitleSx}>
									Readiness Checklist
								</Typography>

								<Typography sx={sideSubSx}>
									Before starting BOM builder
								</Typography>
							</Box>

							<WarningAmberOutlinedIcon sx={{ color: "#fbbf24" }} />
						</Box>

						<ChecklistItem
							done={hasText(form.productName)}
							label="Product name added"
						/>

						<ChecklistItem
							done={hasText(form.productCode)}
							label="Product code assigned"
						/>

						<ChecklistItem
							done={hasText(form.category)}
							label="Category selected"
						/>

						<ChecklistItem
							done={dimensionsReady}
							label="Dimensions completed"
						/>

						<ChecklistItem
							done={false}
							label="Product image uploaded"
						/>

						<ChecklistItem
							done={false}
							label="Drawing attached"
						/>
					</Card>
				</Box>
			</Box>
		</Box>
	);
}

function SectionTitle({
	icon,
	title,
	subtitle,
	color = "#38bdf8",
}) {
	return (
		<Box sx={sectionHeadSx}>
			<Box sx={sectionIconSx(color)}>
				{icon}
			</Box>

			<Box>
				<Typography sx={sectionTitleSx}>
					{title}
				</Typography>

				{subtitle && (
					<Typography sx={sectionSubSx}>
						{subtitle}
					</Typography>
				)}
			</Box>
		</Box>
	);
}

function MiniStat({
	icon,
	title,
	value,
	subtitle,
	accent,
}) {
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

function VersionRow({
	title,
	date,
	status,
	icon,
}) {
	const approved = status === "APPROVED";

	return (
		<Box sx={versionRowSx}>
			<Box sx={{ minWidth: 0 }}>
				<Typography sx={versionTitleSx}>
					{title}
				</Typography>

				<Box sx={versionMetaSx}>
					<Typography sx={versionDateSx}>
						{date}
					</Typography>

					<Chip
						label={status}
						size="small"
						sx={approved ? approvedChipSx : draftMiniChipSx}
					/>
				</Box>
			</Box>

			<Box sx={versionIconSx}>
				{icon}
			</Box>
		</Box>
	);
}

function ChecklistItem({
	done,
	label,
}) {
	return (
		<Box sx={checkItemSx}>
			<Box sx={checkDotSx(done)}>
				{done ? "✓" : "!"}
			</Box>

			<Typography sx={checkTextSx(done)}>
				{label}
			</Typography>
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
	minWidth: "280px",
	flex: 1,
};

const heroRightSx = {
	width: {
		xs: "100%",
		md: "360px",
	},
	display: "flex",
	flexDirection: "column",
	gap: "10px",
};

const labelChipSx = {
	height: "26px",
	borderRadius: 999,
	background: "rgba(59,130,246,.14)",
	color: "#60a5fa",
	border: "1px solid rgba(59,130,246,.24)",
	fontWeight: 900,
	fontSize: "11px",
	letterSpacing: ".07em",
	mb: "10px",
};

const pageTitleSx = {
	color: "#fff",
	fontSize: {
		xs: "24px",
		md: "32px",
	},
	fontWeight: 950,
	lineHeight: 1.05,
	letterSpacing: "-0.04em",
};

const pageSubSx = {
	mt: "8px",
	color: "rgba(255,255,255,.68)",
	fontSize: "13px",
	fontWeight: 650,
	lineHeight: 1.5,
	maxWidth: "760px",
};

const heroMetaRowSx = {
	display: "flex",
	alignItems: "center",
	gap: "8px",
	flexWrap: "wrap",
	mt: "14px",
};

const metaChipSx = {
	height: "26px",
	borderRadius: 999,
	background: "rgba(255,255,255,.06)",
	color: "#cbd5e1",
	border: "1px solid rgba(255,255,255,.10)",
	fontWeight: 850,
	fontSize: "11px",
};

const draftChipSx = {
	...metaChipSx,
	color: "#fbbf24",
	background: "rgba(245,158,11,.13)",
	border: "1px solid rgba(245,158,11,.24)",
};

const completeChipSx = {
	...metaChipSx,
	color: "#4ade80",
	background: "rgba(34,197,94,.13)",
	border: "1px solid rgba(34,197,94,.24)",
};

const completionCardSx = {
	p: "14px",
	borderRadius: "10px",
	background: "rgba(2,6,23,.42)",
	border: "1px solid rgba(255,255,255,.08)",
};

const completionTopSx = {
	display: "flex",
	alignItems: "flex-start",
	justifyContent: "space-between",
	gap: "14px",
	mb: "10px",
};

const completionLabelSx = {
	color: "rgba(255,255,255,.62)",
	fontSize: "10px",
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".07em",
};

const completionValueSx = {
	mt: "5px",
	color: "#fff",
	fontSize: "28px",
	fontWeight: 950,
	lineHeight: 1,
};

const completionIconSx = {
	width: "38px",
	height: "38px",
	borderRadius: "9px",
	display: "grid",
	placeItems: "center",
	background: "rgba(34,197,94,.13)",
	color: "#4ade80",
	border: "1px solid rgba(34,197,94,.24)",
};

const completionProgressSx = {
	height: "7px",
	borderRadius: 999,
	background: "rgba(255,255,255,.07)",

	"& .MuiLinearProgress-bar": {
		borderRadius: 999,
		background: "linear-gradient(135deg,#22c55e,#4ade80)",
	},
};

const completionHintSx = {
	mt: "8px",
	color: "rgba(255,255,255,.55)",
	fontSize: "11px",
	fontWeight: 650,
};

const heroActionRowSx = {
	display: "grid",
	gridTemplateColumns: "1fr 1fr",
	gap: "8px",
};

const primaryBtnSx = {
	height: "38px",
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
	height: "38px",
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
	minHeight: "72px",

	"&:before": {
		content: '""',
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: "3px",
		background: accent,
	},
});

const miniIconSx = (accent) => ({
	width: "38px",
	height: "38px",
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
	fontSize: "10px",
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".07em",
};

const miniValueSx = {
	mt: "3px",
	color: "#fff",
	fontSize: "17px",
	fontWeight: 950,
};

const miniSubSx = {
	mt: "2px",
	color: "rgba(255,255,255,.52)",
	fontSize: "11px",
	fontWeight: 650,
};

const mainGridSx = {
	display: "grid",
	gridTemplateColumns: "minmax(0, 1.65fr) minmax(340px, .75fr)",
	gap: "14px",
	alignItems: "start",

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

const panelSx = {
	p: "15px",
	borderRadius: "10px",
	background: "rgba(15,23,42,.78)",
	border: "1px solid rgba(255,255,255,.07)",
	boxShadow: "0 14px 28px rgba(2,6,23,.26)",
	backdropFilter: "blur(18px)",
	overflow: "hidden",
};

const sidePanelSx = {
	...panelSx,
	p: "15px",
};

const checklistPanelSx = {
	...sidePanelSx,
	background:
		"linear-gradient(180deg, rgba(245,158,11,.10), rgba(15,23,42,.78))",
	border: "1px solid rgba(245,158,11,.20)",
};

const sectionHeadSx = {
	display: "flex",
	alignItems: "flex-start",
	gap: "12px",
	pb: "12px",
	mb: "14px",
	borderBottom: "1px solid rgba(255,255,255,.08)",
};

const sectionIconSx = (color) => ({
	width: "38px",
	height: "38px",
	borderRadius: "9px",
	display: "grid",
	placeItems: "center",
	color,
	background: `${color}18`,
	border: `1px solid ${color}33`,
	flexShrink: 0,
});

const sectionTitleSx = {
	color: "#fff",
	fontSize: "18px",
	fontWeight: 950,
	lineHeight: 1.1,
	letterSpacing: "-0.02em",
};

const sectionSubSx = {
	mt: "3px",
	color: "rgba(255,255,255,.55)",
	fontSize: "11px",
	fontWeight: 650,
	lineHeight: 1.4,
};

const fieldStackSx = {
	display: "flex",
	flexDirection: "column",
	gap: "12px",
};

const twoColumnGridSx = {
	display: "grid",
	gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
	gap: "12px",

	"@media (max-width: 760px)": {
		gridTemplateColumns: "1fr",
	},
};

const threeColumnGridSx = {
	display: "grid",
	gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
	gap: "12px",

	"@media (max-width: 900px)": {
		gridTemplateColumns: "1fr",
	},
};

const fieldSx = {
	"& .MuiInputLabel-root": {
		color: "rgba(255,255,255,.58)",
		fontSize: "12px",
		fontWeight: 750,
	},

	"& .MuiInputLabel-root.Mui-focused": {
		color: "#60a5fa",
	},

	"& .MuiOutlinedInput-root": {
		minHeight: "48px",
		color: "#fff",
		background: "rgba(255,255,255,.04)",
		borderRadius: "9px",
		fontSize: "13px",
		fontWeight: 700,
		transition: "all .22s ease",

		"& fieldset": {
			borderColor: "rgba(255,255,255,.08)",
		},

		"&:hover fieldset": {
			borderColor: "rgba(59,130,246,.35)",
		},

		"&.Mui-focused fieldset": {
			borderColor: "#3b82f6",
			boxShadow: "0 0 0 3px rgba(59,130,246,.12)",
		},
	},

	"& .MuiInputBase-input": {
		color: "#fff",
		fontWeight: 650,
	},

	"& .MuiInputBase-input::placeholder": {
		color: "rgba(255,255,255,.34)",
		opacity: 1,
	},

	"& .MuiSvgIcon-root": {
		color: "#94a3b8",
	},
};

const dimensionPreviewSx = {
	mt: "12px",
	p: "13px",
	borderRadius: "9px",
	background: "rgba(2,6,23,.42)",
	border: "1px solid rgba(255,255,255,.07)",
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "12px",
	flexWrap: "wrap",
};

const previewLabelSx = {
	color: "rgba(255,255,255,.58)",
	fontSize: "10px",
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".07em",
};

const previewValueSx = {
	mt: "3px",
	color: "#fff",
	fontSize: "16px",
	fontWeight: 950,
	fontFamily: "monospace",
};

const previewBadgeSx = {
	height: "26px",
	display: "flex",
	alignItems: "center",
	px: "11px",
	borderRadius: 999,
	color: "#4ade80",
	background: "rgba(34,197,94,.12)",
	border: "1px solid rgba(34,197,94,.22)",
	fontSize: "11px",
	fontWeight: 850,
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
	fontSize: "17px",
	fontWeight: 950,
	lineHeight: 1.1,
	letterSpacing: "-0.02em",
};

const sideSubSx = {
	mt: "3px",
	color: "rgba(255,255,255,.52)",
	fontSize: "11px",
	fontWeight: 650,
	lineHeight: 1.4,
};

const uploadBoxSx = {
	minHeight: "185px",
	border: "1.5px dashed rgba(255,255,255,.12)",
	background:
		"linear-gradient(180deg, rgba(2,6,23,.50), rgba(2,6,23,.36))",
	borderRadius: "9px",
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	textAlign: "center",
	p: "16px",
	transition: "all .25s ease",

	"&:hover": {
		borderColor: "rgba(59,130,246,.50)",
		background: "rgba(59,130,246,.08)",
	},
};

const uploadIconSx = {
	width: "42px",
	height: "42px",
	borderRadius: "9px",
	background: "rgba(59,130,246,.14)",
	border: "1px solid rgba(59,130,246,.24)",
	display: "grid",
	placeItems: "center",
	color: "#93c5fd",
	mb: "10px",
};

const uploadTitleSx = {
	color: "#fff",
	fontWeight: 950,
	fontSize: "13px",
	lineHeight: 1.35,
};

const uploadSubSx = {
	color: "rgba(255,255,255,.52)",
	fontSize: "11px",
	fontWeight: 650,
	mt: "4px",
};

const browseBtnSx = {
	mt: "12px",
	height: "32px",
	borderRadius: "999px",
	color: "#93c5fd",
	border: "1px solid rgba(59,130,246,.32)",
	background: "rgba(59,130,246,.10)",
	textTransform: "none",
	fontSize: "12px",
	fontWeight: 900,
	px: "14px",

	"&:hover": {
		background: "rgba(59,130,246,.18)",
		borderColor: "rgba(59,130,246,.55)",
	},
};

const requiredChipSx = {
	height: "22px",
	borderRadius: 999,
	color: "#fbbf24",
	background: "rgba(245,158,11,.13)",
	border: "1px solid rgba(245,158,11,.24)",
	fontWeight: 850,
	fontSize: "10px",
};

const drawingBoxSx = {
	minHeight: "132px",
	border: "1px solid rgba(255,255,255,.08)",
	background:
		"linear-gradient(180deg, rgba(2,6,23,.50), rgba(2,6,23,.36))",
	borderRadius: "9px",
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	textAlign: "center",
	p: "14px",
	mb: "10px",
};

const noFileSx = {
	color: "#94a3b8",
	fontStyle: "italic",
	fontSize: "11px",
	fontWeight: 650,
};

const versionRowSx = {
	background:
		"linear-gradient(180deg, rgba(2,6,23,.48), rgba(2,6,23,.34))",
	border: "1px solid rgba(255,255,255,.06)",
	p: "12px",
	borderRadius: "9px",
	mb: "8px",
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	gap: "12px",
};

const versionTitleSx = {
	color: "#fff",
	fontWeight: 850,
	fontSize: "12px",
	mb: "3px",
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
};

const versionMetaSx = {
	display: "flex",
	gap: "8px",
	alignItems: "center",
	flexWrap: "wrap",
};

const versionDateSx = {
	color: "#94a3b8",
	fontSize: "10.5px",
	fontWeight: 700,
};

const approvedChipSx = {
	height: "20px",
	borderRadius: "999px",
	background: "rgba(34,197,94,.12)",
	color: "#4ade80",
	border: "1px solid rgba(34,197,94,.20)",
	fontSize: "10px",
	fontWeight: 850,
};

const draftMiniChipSx = {
	height: "20px",
	borderRadius: "999px",
	background: "rgba(255,255,255,.06)",
	color: "#94a3b8",
	border: "1px solid rgba(255,255,255,.08)",
	fontSize: "10px",
	fontWeight: 850,
};

const versionIconSx = {
	color: "#38bdf8",
	display: "flex",
	cursor: "pointer",
	flexShrink: 0,
};

const newVersionBtnSx = {
	height: "38px",
	borderRadius: "9px",
	border: "1px dashed rgba(255,255,255,.14)",
	color: "#93c5fd",
	background: "rgba(255,255,255,.03)",
	textTransform: "none",
	fontSize: "12px",
	fontWeight: 850,

	"&:hover": {
		background: "rgba(59,130,246,.10)",
		borderColor: "rgba(59,130,246,.35)",
	},
};

const checkItemSx = {
	display: "flex",
	alignItems: "center",
	gap: "9px",
	py: "8px",
	borderBottom: "1px solid rgba(255,255,255,.06)",

	"&:last-of-type": {
		borderBottom: "none",
	},
};

const checkDotSx = (done) => ({
	width: "22px",
	height: "22px",
	borderRadius: 999,
	display: "grid",
	placeItems: "center",
	fontSize: "11px",
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

const checkTextSx = (done) => ({
	color: done ? "#fff" : "rgba(255,255,255,.62)",
	fontSize: "12px",
	fontWeight: 750,
});