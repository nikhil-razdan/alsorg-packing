import {
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import {
	Box,
	Button,
	Card,
	Chip,
	CircularProgress,
	LinearProgress,
	MenuItem,
	TextField,
	Typography,
} from "@mui/material";

import {
	useNavigate,
	useParams,
} from "react-router-dom";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import StraightenOutlinedIcon from "@mui/icons-material/StraightenOutlined";
import BusinessCenterOutlinedIcon from "@mui/icons-material/BusinessCenterOutlined";
import CameraAltOutlinedIcon from "@mui/icons-material/CameraAltOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";

import bomFlowApi from "../api/bomFlowApi.js";
import BOMFlowPagination, { useBomFlowPagination } from "../BOMFlowPagination.jsx";
import * as styles from "../styles/bomStyles.js";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const DRAWING_EXTENSIONS = ["pdf", "dwg", "dxf", "png", "jpg", "jpeg", "webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_DRAWING_BYTES = 25 * 1024 * 1024;

const cleanError = (requestError, fallback) => {
	return (
		requestError?.response?.data?.message ||
		requestError?.response?.data?.detail ||
		requestError?.message ||
		fallback
	);
};

const formatBytes = (value) => {
	const bytes = Number(value || 0);
	if (!bytes) return "";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (value) => {
	if (!value) return "-";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "-";
	return date.toLocaleString("en-IN", {
		day: "2-digit",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
};

export default function BOMFlowProductMaster() {
	const navigate = useNavigate();
	const { productId } = useParams();

	const imageInputRef = useRef(null);
	const drawingInputRef = useRef(null);

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

	const [savedProduct, setSavedProduct] = useState(null);
	const [revisions, setRevisions] = useState([]);
	const [loading, setLoading] = useState(Boolean(productId));
	const [saving, setSaving] = useState(false);
	const [fileWorking, setFileWorking] = useState("");
	const [error, setError] = useState("");
	const [pendingImage, setPendingImage] = useState(null);
	const [pendingDrawing, setPendingDrawing] = useState(null);
	const [imagePreviewUrl, setImagePreviewUrl] = useState("");

	const revisionPager = useBomFlowPagination(revisions, {
		initialPageSize: 5,
		resetKey: savedProduct?.id || productId || "",
	});

	const updateField = (key, value) => {
		setForm((prev) => ({ ...prev, [key]: value }));
		if (error) setError("");
	};

	const applyProductToForm = (product) => {
		setForm({
			productName: product?.productName || "",
			productCode: product?.productCode || "",
			drawingNumber: product?.drawingNumber || "",
			category: product?.category || "",
			collection: product?.collection || "",
			length: product?.length != null ? String(product.length) : "",
			width: product?.width != null ? String(product.width) : "",
			height: product?.height != null ? String(product.height) : "",
			projectReference: product?.projectReference || "",
			clientEntity: product?.clientEntity || "",
		});
	};

	const loadServerImage = async (product) => {
		if (!product?.id || !product?.hasProductImage) {
			setImagePreviewUrl((old) => {
				if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
				return "";
			});
			return;
		}

		try {
			const blob = await bomFlowApi.getProductImageBlob(product.id);
			if (!blob) return;
			const next = URL.createObjectURL(blob);
			setImagePreviewUrl((old) => {
				if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
				return next;
			});
		} catch {
			setImagePreviewUrl("");
		}
	};

	const loadRevisions = async (id) => {
		if (!id) {
			setRevisions([]);
			return;
		}

		try {
			const data = await bomFlowApi.listProductRevisions(id);
			setRevisions(Array.isArray(data) ? data : data?.content || []);
		} catch {
			setRevisions([]);
		}
	};

	useEffect(() => {
		if (!productId) return;
		let active = true;

		const loadProduct = async () => {
			setLoading(true);
			setError("");

			try {
				const product = await bomFlowApi.getProduct(productId);
				if (!active) return;

				setSavedProduct(product);
				applyProductToForm(product);
				await Promise.all([
					loadRevisions(product.id),
					loadServerImage(product),
				]);
			} catch (requestError) {
				if (active) {
					setError(cleanError(requestError, "Unable to load product."));
				}
			} finally {
				if (active) setLoading(false);
			}
		};

		loadProduct();

		return () => {
			active = false;
		};
	}, [productId]);

	useEffect(() => {
		return () => {
			if (imagePreviewUrl?.startsWith("blob:")) {
				URL.revokeObjectURL(imagePreviewUrl);
			}
		};
	}, [imagePreviewUrl]);

	const hasText = (value) => String(value ?? "").trim().length > 0;
	const hasPositiveNumber = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

	const completion = useMemo(() => {
		const checks = [
			hasText(form.productName),
			hasText(form.productCode),
			hasText(form.category),
			hasPositiveNumber(form.length),
			hasPositiveNumber(form.width),
			hasPositiveNumber(form.height),
		];
		return Math.round((checks.filter(Boolean).length / checks.length) * 100);
	}, [form]);

	const dimensionsReady = [form.length, form.width, form.height].every(hasPositiveNumber);
	const hasImage = Boolean(pendingImage || savedProduct?.hasProductImage);
	const hasDrawing = Boolean(pendingDrawing || savedProduct?.hasDrawingFile);

	const validateForm = () => {
		if (!hasText(form.productName)) return "Product name is required.";
		if (!hasText(form.productCode)) return "Product code is required.";
		if (!hasText(form.category)) return "Product category is required.";
		if (!hasPositiveNumber(form.length)) return "Length must be greater than zero.";
		if (!hasPositiveNumber(form.width)) return "Width must be greater than zero.";
		if (!hasPositiveNumber(form.height)) return "Height must be greater than zero.";
		return "";
	};

	const buildPayload = () => ({
		productName: form.productName.trim(),
		productCode: form.productCode.trim().toUpperCase(),
		drawingNumber: form.drawingNumber.trim() || null,
		category: form.category,
		collection: form.collection.trim() || null,
		length: Number(form.length),
		width: Number(form.width),
		height: Number(form.height),
		projectReference: form.projectReference.trim() || null,
		clientEntity: form.clientEntity.trim() || null,
	});

	const uploadPendingFiles = async (product) => {
		let current = product;

		if (pendingImage) {
			current = await bomFlowApi.uploadProductImage(current.id, pendingImage);
			setPendingImage(null);
		}

		if (pendingDrawing) {
			current = await bomFlowApi.uploadProductDrawing(current.id, pendingDrawing);
			setPendingDrawing(null);
		}

		setSavedProduct(current);
		await loadServerImage(current);
		return current;
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
			let product = savedProduct?.id || productId
				? await bomFlowApi.updateProduct(
					savedProduct?.id || productId,
					payload,
					savedProduct?.rowVersion
				)
				: await bomFlowApi.createProduct(payload);

			setSavedProduct(product);
			product = await uploadPendingFiles(product);
			await loadRevisions(product.id);
			return product;
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to save product."));
			return null;
		} finally {
			setSaving(false);
		}
	};

	const handleSaveDraft = async () => {
		const product = await saveProduct();
		if (product?.id && !productId) {
			navigate(`/bomflow/products/${product.id}/edit`, { replace: true });
		}
	};

	const handleStartBom = async () => {
		const product = await saveProduct();
		if (!product?.id) return;

		try {
			const existing = await bomFlowApi.listProductRevisions(product.id);
			const list = Array.isArray(existing) ? existing : existing?.content || [];
			let revision = list.find((item) => ["DRAFT", "RETURNED"].includes(String(item?.status).toUpperCase()));

			if (!revision) {
				revision = await bomFlowApi.createRevision(product.id, {
					remarks: list.length ? "New BOM revision" : "Initial BOM revision",
				});
			}

			if (!revision?.id) throw new Error("BOM revision ID was not returned.");
			navigate(`/bomflow/revisions/${revision.id}`);
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to start BOM revision."));
		}
	};

	const validateImage = (file) => {
		if (!file) return "No image selected.";
		if (file.size > MAX_IMAGE_BYTES) return "Product image must be 5 MB or smaller.";
		if (!IMAGE_TYPES.includes(file.type)) return "Product image must be PNG, JPG/JPEG or WEBP.";
		return "";
	};

	const validateDrawing = (file) => {
		if (!file) return "No drawing selected.";
		if (file.size > MAX_DRAWING_BYTES) return "Drawing must be 25 MB or smaller.";
		const ext = String(file.name || "").split(".").pop().toLowerCase();
		if (!DRAWING_EXTENSIONS.includes(ext)) return "Drawing must be PDF, DWG, DXF, PNG, JPG/JPEG or WEBP.";
		return "";
	};

	const handleImageSelected = async (file) => {
		const issue = validateImage(file);
		if (issue) {
			setError(issue);
			return;
		}

		if (!savedProduct?.id) {
			setPendingImage(file);
			const url = URL.createObjectURL(file);
			setImagePreviewUrl((old) => {
				if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
				return url;
			});
			return;
		}

		setFileWorking("image");
		setError("");
		try {
			const updated = await bomFlowApi.uploadProductImage(savedProduct.id, file);
			setSavedProduct(updated);
			setPendingImage(null);
			await loadServerImage(updated);
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to upload product image."));
		} finally {
			setFileWorking("");
		}
	};

	const handleDrawingSelected = async (file) => {
		const issue = validateDrawing(file);
		if (issue) {
			setError(issue);
			return;
		}

		if (!savedProduct?.id) {
			setPendingDrawing(file);
			return;
		}

		setFileWorking("drawing");
		setError("");
		try {
			const updated = await bomFlowApi.uploadProductDrawing(savedProduct.id, file);
			setSavedProduct(updated);
			setPendingDrawing(null);
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to upload drawing."));
		} finally {
			setFileWorking("");
		}
	};

	const removeImage = async () => {
		if (pendingImage && !savedProduct?.hasProductImage) {
			setPendingImage(null);
			setImagePreviewUrl("");
			return;
		}
		if (!savedProduct?.id || !savedProduct?.hasProductImage) return;

		setFileWorking("image");
		try {
			const updated = await bomFlowApi.deleteProductImage(savedProduct.id);
			setSavedProduct(updated);
			setPendingImage(null);
			setImagePreviewUrl("");
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to remove product image."));
		} finally {
			setFileWorking("");
		}
	};

	const removeDrawing = async () => {
		if (pendingDrawing && !savedProduct?.hasDrawingFile) {
			setPendingDrawing(null);
			return;
		}
		if (!savedProduct?.id || !savedProduct?.hasDrawingFile) return;

		setFileWorking("drawing");
		try {
			const updated = await bomFlowApi.deleteProductDrawing(savedProduct.id);
			setSavedProduct(updated);
			setPendingDrawing(null);
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to remove drawing."));
		} finally {
			setFileWorking("");
		}
	};

	const downloadDrawing = async (open = false) => {
		if (!savedProduct?.id || !savedProduct?.hasDrawingFile) return;
		setFileWorking("drawing-download");
		try {
			const blob = await bomFlowApi.getProductDrawingBlob(savedProduct.id);
			if (!blob) return;
			const url = URL.createObjectURL(blob);

			if (open && String(savedProduct.drawingFileContentType || "").includes("pdf")) {
				window.open(url, "_blank", "noopener,noreferrer");
				setTimeout(() => URL.revokeObjectURL(url), 60000);
				return;
			}

			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = savedProduct.drawingFileName || "drawing";
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(url);
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to download drawing."));
		} finally {
			setFileWorking("");
		}
	};

	if (loading) {
		return (
			<Box sx={{ minHeight: 320, display: "grid", placeItems: "center" }}>
				<CircularProgress />
			</Box>
		);
	}

	const title = hasText(form.productName)
		? form.productName
		: productId
		? "Edit Product"
		: "Create New Product";

	return (
		<Box sx={pageSx}>
			<Box sx={heroSx}>
				<Box sx={{ minWidth: 280, flex: 1 }}>
					<Box sx={{ display: "flex", gap: "8px", flexWrap: "wrap", mb: "10px" }}>
						<Chip label="PRODUCT BUILDER" sx={labelChipSx} />
						<Chip label={String(savedProduct?.status || "DRAFT")} sx={statusChipSx} />
					</Box>

					<Typography sx={pageTitleSx}>{title}</Typography>
					<Typography sx={pageSubSx}>
						Maintain product identity, dimensions, project/client allocation,
						product image, technical drawing and BOM revision history.
					</Typography>
				</Box>

				<Box sx={heroRightSx}>
					<Box sx={completionCardSx}>
						<Box sx={{ display: "flex", justifyContent: "space-between", gap: "12px", mb: "10px" }}>
							<Box>
								<Typography sx={completionLabelSx}>Profile Completion</Typography>
								<Typography sx={completionValueSx}>{completion}%</Typography>
							</Box>
							<CheckCircleOutlineIcon sx={{ color: completion === 100 ? "#4ade80" : "#fbbf24" }} />
						</Box>
						<LinearProgress variant="determinate" value={completion} sx={completionProgressSx} />
					</Box>

					<Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
						<Button startIcon={<SaveOutlinedIcon />} disabled={saving || Boolean(fileWorking)} onClick={handleSaveDraft} sx={secondaryBtnSx}>
							{saving ? "Saving..." : "Save Draft"}
						</Button>
						<Button endIcon={<ArrowForwardIcon />} disabled={saving || completion < 100 || Boolean(fileWorking)} onClick={handleStartBom} sx={primaryBtnSx}>
							Start BOM
						</Button>
					</Box>

					<Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/bomflow/products")} sx={{ ...secondaryBtnSx, width: "100%" }}>
						Back to Product List
					</Button>
				</Box>
			</Box>

			{error && <Box sx={errorSx}>{error}</Box>}

			<Box sx={summaryGridSx}>
				<MiniStat icon={<InfoOutlinedIcon />} title="Identity" value={hasText(form.productCode) ? "Ready" : "Pending"} subtitle="Code, drawing no. and category" accent="#60a5fa" />
				<MiniStat icon={<StraightenOutlinedIcon />} title="Dimensions" value={dimensionsReady ? "Ready" : "Pending"} subtitle="Length × width × height" accent="#22c55e" />
				<MiniStat icon={<ImageOutlinedIcon />} title="Product Image" value={hasImage ? "Added" : "Optional"} subtitle={pendingImage?.name || savedProduct?.productImageFileName || "PNG, JPG, WEBP"} accent="#f59e0b" />
				<MiniStat icon={<DescriptionOutlinedIcon />} title="Drawing" value={hasDrawing ? "Added" : "Optional"} subtitle={pendingDrawing?.name || savedProduct?.drawingFileName || "PDF, DWG, DXF"} accent="#a855f7" />
			</Box>

			<Box sx={styles.BOM_productMasterGridSx}>
				<Box sx={styles.BOM_productMainColumnSx}>
					<Card sx={panelSx}>
						<SectionTitle icon={<InfoOutlinedIcon />} title="Identification & Taxonomy" subtitle="Core identity used across BOM, costing and reports." />
						<Box sx={styles.BOM_fieldStackSx}>
							<TextField fullWidth label="Product Name *" value={form.productName} onChange={(e) => updateField("productName", e.target.value)} sx={styles.BOM_fieldSx} />
							<Box sx={styles.BOM_twoColumnFieldGridSx}>
								<TextField fullWidth label="Product Code *" value={form.productCode} onChange={(e) => updateField("productCode", e.target.value)} sx={styles.BOM_fieldSx} />
								<TextField fullWidth label="Drawing Number" value={form.drawingNumber} onChange={(e) => updateField("drawingNumber", e.target.value)} sx={styles.BOM_fieldSx} />
							</Box>
							<Box sx={styles.BOM_twoColumnFieldGridSx}>
								<TextField select fullWidth label="Category *" value={form.category} onChange={(e) => updateField("category", e.target.value)} sx={styles.BOM_fieldSx}>
									<MenuItem value="">Select Category</MenuItem>
									<MenuItem value="desk">Desk</MenuItem>
									<MenuItem value="chair">Chair</MenuItem>
									<MenuItem value="table">Table</MenuItem>
									<MenuItem value="wardrobe">Wardrobe</MenuItem>
									<MenuItem value="kitchen">Kitchen</MenuItem>
									<MenuItem value="millwork">Millwork</MenuItem>
									<MenuItem value="other">Other</MenuItem>
								</TextField>
								<TextField fullWidth label="Collection / Series" value={form.collection} onChange={(e) => updateField("collection", e.target.value)} sx={styles.BOM_fieldSx} />
							</Box>
						</Box>
					</Card>

					<Card sx={panelSx}>
						<SectionTitle icon={<StraightenOutlinedIcon />} title="Physical Specifications" subtitle="Used downstream for costing, packing volume and logistics." color="#22c55e" />
						<Box sx={styles.BOM_threeColumnFieldGridSx}>
							<TextField fullWidth type="number" label="Length (mm) *" value={form.length} onChange={(e) => updateField("length", e.target.value)} inputProps={{ min: 0, step: "0.01" }} sx={styles.BOM_fieldSx} />
							<TextField fullWidth type="number" label="Width (mm) *" value={form.width} onChange={(e) => updateField("width", e.target.value)} inputProps={{ min: 0, step: "0.01" }} sx={styles.BOM_fieldSx} />
							<TextField fullWidth type="number" label="Height (mm) *" value={form.height} onChange={(e) => updateField("height", e.target.value)} inputProps={{ min: 0, step: "0.01" }} sx={styles.BOM_fieldSx} />
						</Box>
						<Box sx={dimensionPreviewSx}>
							<Typography sx={dimensionValueSx}>
								{form.length || "0"} × {form.width || "0"} × {form.height || "0"} mm
							</Typography>
						</Box>
					</Card>

					<Card sx={panelSx}>
						<SectionTitle icon={<BusinessCenterOutlinedIcon />} title="Project Allocation" subtitle="Link this product to the project and client." color="#a855f7" />
						<Box sx={styles.BOM_twoColumnFieldGridSx}>
							<TextField fullWidth label="Project Reference" value={form.projectReference} onChange={(e) => updateField("projectReference", e.target.value)} sx={styles.BOM_fieldSx} />
							<TextField fullWidth label="Client Entity" value={form.clientEntity} onChange={(e) => updateField("clientEntity", e.target.value)} sx={styles.BOM_fieldSx} />
						</Box>
					</Card>
				</Box>

				<Box sx={styles.BOM_productSideColumnSx}>
					<Card sx={sidePanelSx}>
						<Box sx={sideHeaderSx}>
							<Box>
								<Typography sx={sideTitleSx}>Product Image</Typography>
								<Typography sx={sideSubSx}>Optional product reference image.</Typography>
							</Box>
							<CameraAltOutlinedIcon sx={{ color: "#93c5fd" }} />
						</Box>

						<input ref={imageInputRef} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) handleImageSelected(file); }} />

						<Box sx={imageBoxSx} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (file) handleImageSelected(file); }}>
							{imagePreviewUrl ? (
								<img src={imagePreviewUrl} alt="Product" style={imageStyle} />
							) : (
								<>
									<ImageOutlinedIcon sx={{ fontSize: 38, color: "#64748b" }} />
									<Typography sx={uploadTitleSx}>Drop product image here</Typography>
									<Typography sx={uploadSubSx}>PNG, JPG/JPEG, WEBP • Max 5 MB</Typography>
								</>
							)}
						</Box>

						<Box sx={fileActionRowSx}>
							<Button disabled={fileWorking === "image"} onClick={() => imageInputRef.current?.click()} sx={browseBtnSx}>
								{fileWorking === "image" ? "Uploading..." : hasImage ? "Replace Image" : "Choose Image"}
							</Button>
							{hasImage && (
								<Button startIcon={<DeleteOutlineIcon />} disabled={fileWorking === "image"} onClick={removeImage} sx={dangerBtnSx}>Remove</Button>
							)}
						</Box>

						{pendingImage && !savedProduct?.id && <Typography sx={pendingHintSx}>Selected: {pendingImage.name}. It will upload when the product is saved.</Typography>}
						{savedProduct?.hasProductImage && <Typography sx={fileMetaSx}>{savedProduct.productImageFileName} {formatBytes(savedProduct.productImageSize) ? `• ${formatBytes(savedProduct.productImageSize)}` : ""} • {formatDate(savedProduct.productImageUploadedAt)}</Typography>}
					</Card>

					<Card sx={sidePanelSx}>
						<Box sx={sideHeaderSx}>
							<Box>
								<Typography sx={sideTitleSx}>Technical Drawing</Typography>
								<Typography sx={sideSubSx}>Optional PDF / CAD drawing attachment.</Typography>
							</Box>
							<UploadFileOutlinedIcon sx={{ color: "#93c5fd" }} />
						</Box>

						<input ref={drawingInputRef} type="file" hidden accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.webp" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) handleDrawingSelected(file); }} />

						<Box sx={drawingBoxSx} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (file) handleDrawingSelected(file); }}>
							<DescriptionOutlinedIcon sx={{ fontSize: 34, color: hasDrawing ? "#4ade80" : "#64748b" }} />
							<Typography sx={uploadTitleSx}>
								{pendingDrawing?.name || savedProduct?.drawingFileName || "Drop drawing file here"}
							</Typography>
							<Typography sx={uploadSubSx}>
								{hasDrawing ? formatBytes(pendingDrawing?.size || savedProduct?.drawingFileSize) || "File attached" : "PDF, DWG, DXF, PNG, JPG • Max 25 MB"}
							</Typography>
						</Box>

						<Box sx={fileActionRowSx}>
							<Button disabled={fileWorking === "drawing"} onClick={() => drawingInputRef.current?.click()} sx={browseBtnSx}>
								{fileWorking === "drawing" ? "Uploading..." : hasDrawing ? "Replace Drawing" : "Browse Files"}
							</Button>
							{savedProduct?.hasDrawingFile && (
								<>
									{String(savedProduct.drawingFileContentType || "").includes("pdf") && <Button startIcon={<OpenInNewOutlinedIcon />} disabled={fileWorking === "drawing-download"} onClick={() => downloadDrawing(true)} sx={smallBtnSx}>Open</Button>}
									<Button startIcon={<DownloadOutlinedIcon />} disabled={fileWorking === "drawing-download"} onClick={() => downloadDrawing(false)} sx={smallBtnSx}>Download</Button>
								</>
							)}
							{hasDrawing && <Button startIcon={<DeleteOutlineIcon />} disabled={fileWorking === "drawing"} onClick={removeDrawing} sx={dangerBtnSx}>Remove</Button>}
						</Box>

						{pendingDrawing && !savedProduct?.id && <Typography sx={pendingHintSx}>Selected: {pendingDrawing.name}. It will upload when the product is saved.</Typography>}
					</Card>

					<Card sx={sidePanelSx}>
						<Box sx={sideHeaderSx}>
							<Box>
								<Typography sx={sideTitleSx}>BOM Revisions</Typography>
								<Typography sx={sideSubSx}>Real revision history for this product.</Typography>
							</Box>
							<HistoryOutlinedIcon sx={{ color: "#93c5fd" }} />
						</Box>

						{revisions.length === 0 ? (
							<Typography sx={emptyRevisionSx}>No BOM revision created yet.</Typography>
						) : revisionPager.pageItems.map((revision) => (
							<Box key={revision.id} sx={revisionRowSx}>
								<Box>
									<Typography sx={revisionTitleSx}>Revision {revision.revisionNo || revision.revisionNumber}</Typography>
									<Typography sx={fileMetaSx}>{revision.itemCount || 0} item(s) • {String(revision.status || "DRAFT")}</Typography>
								</Box>
								<Button onClick={() => navigate(`/bomflow/revisions/${revision.id}`)} sx={smallBtnSx}>Open</Button>
							</Box>
						))}
						{revisions.length > 0 && (
							<Box sx={revisionPagerWrapSx}>
								<BOMFlowPagination
									page={revisionPager.page}
									pageCount={revisionPager.pageCount}
									pageSize={revisionPager.pageSize}
									total={revisionPager.total}
									from={revisionPager.from}
									to={revisionPager.to}
									onPageChange={revisionPager.setPage}
									onPageSizeChange={revisionPager.setPageSize}
									label="revisions"
									pageSizeOptions={[5, 10, 20]}
									compact
								/>
							</Box>
						)}
					</Card>

					<Card sx={checklistPanelSx}>
						<Box sx={sideHeaderSx}>
							<Box>
								<Typography sx={sideTitleSx}>Readiness Checklist</Typography>
								<Typography sx={sideSubSx}>Core fields are required; files are optional.</Typography>
							</Box>
							<WarningAmberOutlinedIcon sx={{ color: "#fbbf24" }} />
						</Box>
						<ChecklistItem done={hasText(form.productName)} label="Product name added" />
						<ChecklistItem done={hasText(form.productCode)} label="Product code assigned" />
						<ChecklistItem done={hasText(form.category)} label="Category selected" />
						<ChecklistItem done={dimensionsReady} label="Dimensions completed" />
						<ChecklistItem done={hasImage} label="Product image (optional)" />
						<ChecklistItem done={hasDrawing} label="Drawing attachment (optional)" />
					</Card>
				</Box>
			</Box>
		</Box>
	);
}

function SectionTitle({ icon, title, subtitle, color = "#38bdf8" }) {
	return (
		<Box sx={sectionHeadSx}>
			<Box sx={{ ...sectionIconSx, color, background: `${color}18`, border: `1px solid ${color}33` }}>{icon}</Box>
			<Box>
				<Typography sx={sectionTitleSx}>{title}</Typography>
				<Typography sx={sectionSubSx}>{subtitle}</Typography>
			</Box>
		</Box>
	);
}

function MiniStat({ icon, title, value, subtitle, accent }) {
	return (
		<Card sx={miniStatSx(accent)}>
			<Box sx={{ ...miniIconSx, color: accent, background: `${accent}18`, border: `1px solid ${accent}33` }}>{icon}</Box>
			<Box sx={{ minWidth: 0 }}>
				<Typography sx={miniTitleSx}>{title}</Typography>
				<Typography sx={miniValueSx}>{value}</Typography>
				<Typography sx={miniSubSx} noWrap>{subtitle}</Typography>
			</Box>
		</Card>
	);
}

function ChecklistItem({ done, label }) {
	return (
		<Box sx={checkItemSx}>
			<Box sx={checkDotSx(done)}>{done ? "✓" : "•"}</Box>
			<Typography sx={checkTextSx}>{label}</Typography>
		</Box>
	);
}

const pageSx = { width: "100%", display: "flex", flexDirection: "column", gap: "14px" };
const heroSx = { display: "flex", justifyContent: "space-between", alignItems: "stretch", gap: "16px", flexWrap: "wrap", p: "16px", borderRadius: "10px", background: "radial-gradient(circle at top left, rgba(37,99,235,.22), transparent 34%), linear-gradient(180deg, rgba(15,23,42,.86), rgba(15,23,42,.72))", border: "1px solid rgba(255,255,255,.08)" };
const heroRightSx = { width: { xs: "100%", md: 380 }, display: "flex", flexDirection: "column", gap: "8px" };
const labelChipSx = { height: 26, borderRadius: 999, background: "rgba(59,130,246,.14)", color: "#60a5fa", border: "1px solid rgba(59,130,246,.24)", fontWeight: 900, fontSize: 11 };
const statusChipSx = { ...labelChipSx, color: "#fbbf24", background: "rgba(245,158,11,.13)", border: "1px solid rgba(245,158,11,.24)" };
const pageTitleSx = { color: "#fff", fontSize: { xs: 24, md: 32 }, fontWeight: 950, lineHeight: 1.05, letterSpacing: "-0.04em" };
const pageSubSx = { mt: "8px", color: "rgba(255,255,255,.68)", fontSize: 13, fontWeight: 650, lineHeight: 1.5, maxWidth: 760 };
const completionCardSx = { p: "12px", borderRadius: "10px", background: "rgba(2,6,23,.42)", border: "1px solid rgba(255,255,255,.08)" };
const completionLabelSx = { color: "rgba(255,255,255,.62)", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".07em" };
const completionValueSx = { mt: "4px", color: "#fff", fontSize: 24, fontWeight: 950 };
const completionProgressSx = { height: 7, borderRadius: 999, background: "rgba(255,255,255,.07)", "& .MuiLinearProgress-bar": { borderRadius: 999, background: "linear-gradient(135deg,#22c55e,#4ade80)" } };
const primaryBtnSx = { height: 38, borderRadius: "9px", textTransform: "none", fontWeight: 850, color: "#fff", background: "linear-gradient(135deg,#2563eb,#3b82f6)" };
const secondaryBtnSx = { height: 38, borderRadius: "9px", textTransform: "none", fontWeight: 850, color: "#fff", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" };
const errorSx = { p: "11px 13px", borderRadius: "9px", color: "#fca5a5", background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.24)", fontSize: 12, fontWeight: 750 };
const summaryGridSx = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "10px" };
const miniStatSx = (accent) => ({ p: "13px", borderRadius: "10px", background: "rgba(15,23,42,.78)", border: `1px solid ${accent}25`, display: "flex", alignItems: "center", gap: "12px", minHeight: 72 });
const miniIconSx = { width: 38, height: 38, borderRadius: "9px", display: "grid", placeItems: "center", flexShrink: 0 };
const miniTitleSx = { color: "rgba(255,255,255,.58)", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".07em" };
const miniValueSx = { mt: "3px", color: "#fff", fontSize: 17, fontWeight: 950 };
const miniSubSx = { mt: "2px", color: "rgba(255,255,255,.52)", fontSize: 11, fontWeight: 650 };
const panelSx = { p: "15px", borderRadius: "10px", background: "rgba(15,23,42,.78)", border: "1px solid rgba(255,255,255,.07)" };
const sidePanelSx = { ...panelSx };
const checklistPanelSx = { ...sidePanelSx, background: "linear-gradient(180deg, rgba(245,158,11,.08), rgba(15,23,42,.78))", border: "1px solid rgba(245,158,11,.18)" };
const sectionHeadSx = { display: "flex", alignItems: "flex-start", gap: "12px", pb: "12px", mb: "14px", borderBottom: "1px solid rgba(255,255,255,.08)" };
const sectionIconSx = { width: 38, height: 38, borderRadius: "9px", display: "grid", placeItems: "center", flexShrink: 0 };
const sectionTitleSx = { color: "#fff", fontSize: 18, fontWeight: 950 };
const sectionSubSx = { mt: "3px", color: "rgba(255,255,255,.55)", fontSize: 11, fontWeight: 650 };
const dimensionPreviewSx = { mt: "12px", p: "12px", borderRadius: "9px", background: "rgba(2,6,23,.42)", border: "1px solid rgba(255,255,255,.07)" };
const dimensionValueSx = { color: "#fff", fontSize: 16, fontWeight: 950, fontFamily: "monospace" };
const sideHeaderSx = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", mb: "12px" };
const sideTitleSx = { color: "#fff", fontSize: 17, fontWeight: 950 };
const sideSubSx = { mt: "3px", color: "rgba(255,255,255,.52)", fontSize: 11, fontWeight: 650 };
const imageBoxSx = { height: 190, borderRadius: "10px", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "7px", background: "rgba(2,6,23,.45)", border: "1.5px dashed rgba(255,255,255,.12)" };
const imageStyle = { width: "100%", height: "100%", objectFit: "contain", display: "block" };
const drawingBoxSx = { minHeight: 125, borderRadius: "10px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "7px", p: "12px", background: "rgba(2,6,23,.45)", border: "1.5px dashed rgba(255,255,255,.12)" };
const uploadTitleSx = { color: "#fff", fontWeight: 900, fontSize: 12, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const uploadSubSx = { color: "rgba(255,255,255,.48)", fontSize: 10.5, fontWeight: 650 };
const fileActionRowSx = { display: "flex", gap: "7px", flexWrap: "wrap", mt: "10px" };
const browseBtnSx = { height: 34, borderRadius: "9px", textTransform: "none", color: "#93c5fd", border: "1px solid rgba(59,130,246,.28)", background: "rgba(59,130,246,.10)", fontWeight: 850, fontSize: 11 };
const smallBtnSx = { ...browseBtnSx, color: "#cbd5e1", border: "1px solid rgba(255,255,255,.09)", background: "rgba(255,255,255,.04)" };
const dangerBtnSx = { ...browseBtnSx, color: "#fca5a5", border: "1px solid rgba(239,68,68,.24)", background: "rgba(239,68,68,.10)" };
const pendingHintSx = { mt: "8px", color: "#fbbf24", fontSize: 10.5, fontWeight: 700 };
const fileMetaSx = { mt: "8px", color: "rgba(255,255,255,.48)", fontSize: 10.5, fontWeight: 650 };
const emptyRevisionSx = { p: "12px", borderRadius: "9px", color: "rgba(255,255,255,.5)", fontSize: 11, background: "rgba(2,6,23,.38)", border: "1px solid rgba(255,255,255,.06)" };
const revisionRowSx = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", p: "10px", mb: "7px", borderRadius: "9px", background: "rgba(2,6,23,.38)", border: "1px solid rgba(255,255,255,.06)" };
const revisionTitleSx = { color: "#fff", fontSize: 12, fontWeight: 850 };
const checkItemSx = { display: "flex", alignItems: "center", gap: "9px", py: "7px", borderBottom: "1px solid rgba(255,255,255,.06)" };
const checkDotSx = (done) => ({ width: 22, height: 22, borderRadius: 999, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 950, color: done ? "#4ade80" : "#94a3b8", background: done ? "rgba(34,197,94,.12)" : "rgba(255,255,255,.05)", border: done ? "1px solid rgba(34,197,94,.22)" : "1px solid rgba(255,255,255,.08)" });
const checkTextSx = { color: "rgba(255,255,255,.68)", fontSize: 12, fontWeight: 750 };

const revisionPagerWrapSx = { mt: "8px", mx: "-15px", mb: "-15px" };
