import {
	useEffect,
	useMemo,
	useState,
} from "react";

import {
	Box,
	Button,
	Card,
	Chip,
	CircularProgress,
	TextField,
	Typography,
} from "@mui/material";

import { useNavigate } from "react-router-dom";

import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

import bomFlowApi from "../api/bomFlowApi.js";
import BOMFlowPagination, { useBomFlowPagination } from "../BOMFlowPagination.jsx";

import {
	canEditBomFlowRevision,
	getBomFlowRole,
} from "../../../utils/bomflowAccess.js";

const statusStyle = (status) => {
	const value = String(status || "DRAFT").toUpperCase();

	if (["ACTIVE", "APPROVED", "RELEASED"].includes(value)) {
		return {
			color: "#4ade80",
			background: "rgba(34,197,94,.12)",
			border: "1px solid rgba(34,197,94,.22)",
		};
	}

	if (["RETURNED", "CANCELLED"].includes(value)) {
		return {
			color: "#fca5a5",
			background: "rgba(239,68,68,.12)",
			border: "1px solid rgba(239,68,68,.22)",
		};
	}

	if (value === "VERIFIED") {
		return {
			color: "#c084fc",
			background: "rgba(168,85,247,.12)",
			border: "1px solid rgba(168,85,247,.22)",
		};
	}

	if (["SUBMITTED", "PENDING_ENGINEERING_APPROVAL"].includes(value)) {
		return {
			color: "#7dd3fc",
			background: "rgba(14,165,233,.12)",
			border: "1px solid rgba(14,165,233,.22)",
		};
	}

	if (["ARCHIVED", "SUPERSEDED"].includes(value)) {
		return {
			color: "#94a3b8",
			background: "rgba(148,163,184,.10)",
			border: "1px solid rgba(148,163,184,.20)",
		};
	}

	return {
		color: "#fbbf24",
		background: "rgba(245,158,11,.12)",
		border: "1px solid rgba(245,158,11,.22)",
	};
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

export default function BOMFlowProductList() {
	const navigate = useNavigate();
	const role = getBomFlowRole();
	const canCreate = canEditBomFlowRevision(role);

	const [products, setProducts] = useState([]);
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(true);
	const [workingId, setWorkingId] = useState("");
	const [error, setError] = useState("");

	const loadProducts = async () => {
		setLoading(true);
		setError("");

		try {
			const data = await bomFlowApi.listProducts();
			setProducts(
				Array.isArray(data)
					? data
					: data?.content || []
			);
		} catch (requestError) {
			setProducts([]);
			setError(
				requestError?.response?.data?.message ||
					requestError?.response?.data?.detail ||
					requestError?.message ||
					"Unable to load BOMFlow products."
			);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadProducts();
	}, []);

	const filtered = useMemo(() => {
		const query = search.trim().toLowerCase();

		if (!query) return products;

		return products.filter((product) => {
			const haystack = [
				product?.productName,
				product?.productCode,
				product?.drawingNumber,
				product?.category,
				product?.collection,
				product?.projectReference,
				product?.clientEntity,
				product?.latestRevisionStatus,
			]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();

			return haystack.includes(query);
		});
	}, [products, search]);

	const productPager = useBomFlowPagination(filtered, {
		initialPageSize: 10,
		resetKey: search,
	});

	const totals = useMemo(() => {
		return {
			total: products.length,
			withBom: products.filter((p) => p?.latestRevisionId).length,
			withImage: products.filter((p) => p?.hasProductImage).length,
			withDrawing: products.filter((p) => p?.hasDrawingFile).length,
		};
	}, [products]);

	const openBom = async (product) => {
		if (!product?.id) return;

		if (product?.latestRevisionId) {
			navigate(`/bomflow/revisions/${product.latestRevisionId}`);
			return;
		}

		if (!canCreate) return;

		setWorkingId(product.id);
		setError("");

		try {
			const revision = await bomFlowApi.createRevision(
				product.id,
				{ remarks: "Initial BOM revision" }
			);

			if (!revision?.id) {
				throw new Error("BOM revision ID was not returned.");
			}

			navigate(`/bomflow/revisions/${revision.id}`);
		} catch (requestError) {
			setError(
				requestError?.response?.data?.message ||
					requestError?.response?.data?.detail ||
					requestError?.message ||
					"Unable to start BOM."
			);
		} finally {
			setWorkingId("");
		}
	};

	return (
		<Box sx={pageSx}>
			<Box sx={heroSx}>
				<Box>
					<Chip label="PRODUCT MASTER" sx={labelChipSx} />

					<Typography sx={titleSx}>
						Products
					</Typography>

					<Typography sx={subSx}>
						Open an existing product, review its files and BOM revision,
						or create a new product before entering the Product Builder.
					</Typography>
				</Box>

				<Box sx={heroActionsSx}>
					<Button
						startIcon={<RefreshIcon />}
						onClick={loadProducts}
						disabled={loading}
						sx={secondaryBtnSx}
					>
						Refresh
					</Button>

					{canCreate && (
						<Button
							startIcon={<AddIcon />}
							onClick={() => navigate("/bomflow/products/new")}
							sx={primaryBtnSx}
						>
							Create Product
						</Button>
					)}
				</Box>
			</Box>

			{error && <Box sx={errorSx}>{error}</Box>}

			<Box sx={summaryGridSx}>
				<SummaryCard title="Total Products" value={totals.total} icon={<Inventory2OutlinedIcon />} />
				<SummaryCard title="Products With BOM" value={totals.withBom} icon={<RuleOutlinedIcon />} />
				<SummaryCard title="Product Images" value={totals.withImage} icon={<ImageOutlinedIcon />} />
				<SummaryCard title="Drawing Files" value={totals.withDrawing} icon={<DescriptionOutlinedIcon />} />
			</Box>

			<Card sx={toolbarSx}>
				<TextField
					fullWidth
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					placeholder="Search product, code, drawing, project, client or status..."
					InputProps={{
						startAdornment: (
							<SearchIcon sx={{ color: "#64748b", mr: 1 }} />
						),
					}}
					sx={fieldSx}
				/>
			</Card>

			{loading ? (
				<Box sx={loadingSx}>
					<CircularProgress />
				</Box>
			) : filtered.length === 0 ? (
				<Card sx={emptySx}>
					<Box sx={emptyIconSx}>
						<Inventory2OutlinedIcon />
					</Box>

					<Typography sx={emptyTitleSx}>
						No products found
					</Typography>

					<Typography sx={emptySubSx}>
						Create the first product or change your search.
					</Typography>

					{canCreate && (
						<Button
							startIcon={<AddIcon />}
							onClick={() => navigate("/bomflow/products/new")}
							sx={primaryBtnSx}
						>
							Create Product
						</Button>
					)}
				</Card>
			) : (
				<Card sx={tableCardSx}>
					<Box sx={tableScrollSx}>
						<Box sx={tableHeadSx}>
							<div>Product</div>
							<div>Category</div>
							<div>Dimensions</div>
							<div>Project / Client</div>
							<div>Files</div>
							<div>BOM</div>
							<div>Updated</div>
							<div>Actions</div>
						</Box>

						{productPager.pageItems.map((product) => (
							<Box key={product.id} sx={tableRowSx}>
								<Box sx={productCellSx}>
									<ProductThumbnail product={product} />

									<Box sx={{ minWidth: 0 }}>
										<Typography sx={productNameSx}>
											{product.productName || "Unnamed Product"}
										</Typography>
										<Typography sx={productCodeSx}>
											{product.productCode || "NO CODE"}
										</Typography>
										<Typography sx={mutedTextSx}>
											Drawing No: {product.drawingNumber || "-"}
										</Typography>
									</Box>
								</Box>

								<Typography sx={cellTextSx}>
									{product.category || "-"}
								</Typography>

								<Typography sx={monoTextSx}>
									{product.length || 0} × {product.width || 0} × {product.height || 0} mm
								</Typography>

								<Box>
									<Typography sx={cellStrongSx}>
										{product.projectReference || "-"}
									</Typography>
									<Typography sx={mutedTextSx}>
										{product.clientEntity || "No client"}
									</Typography>
								</Box>

								<Box sx={fileChipsSx}>
									<Chip
										label={product.hasProductImage ? "Image" : "No Image"}
										size="small"
										sx={product.hasProductImage ? readyChipSx : pendingChipSx}
									/>
									<Chip
										label={product.hasDrawingFile ? "Drawing" : "No Drawing"}
										size="small"
										sx={product.hasDrawingFile ? readyChipSx : pendingChipSx}
									/>
								</Box>

								<Box>
									<Chip
										label={product.latestRevisionStatus || "NO REVISION"}
										size="small"
										sx={{
											height: 22,
											fontSize: 10,
											fontWeight: 900,
											borderRadius: 999,
											...statusStyle(product.latestRevisionStatus),
										}}
									/>
									<Typography sx={{ ...mutedTextSx, mt: "5px" }}>
										{product.revisionCount || 0} revision(s)
									</Typography>
								</Box>

								<Typography sx={mutedTextSx}>
									{formatDate(product.updatedAt)}
								</Typography>

								<Box sx={actionCellSx}>
									<Button
										startIcon={<EditOutlinedIcon />}
										onClick={() => navigate(`/bomflow/products/${product.id}/edit`)}
										sx={smallSecondaryBtnSx}
									>
										Open
									</Button>

									<Button
										disabled={workingId === product.id || (!product.latestRevisionId && !canCreate)}
										endIcon={<ArrowForwardIcon />}
										onClick={() => openBom(product)}
										sx={smallPrimaryBtnSx}
									>
										{workingId === product.id
											? "Opening..."
											: product.latestRevisionId
											? "BOM"
											: "Start BOM"}
									</Button>
								</Box>
							</Box>
						))}
					</Box>
					<BOMFlowPagination
						page={productPager.page}
						pageCount={productPager.pageCount}
						pageSize={productPager.pageSize}
						total={productPager.total}
						from={productPager.from}
						to={productPager.to}
						onPageChange={productPager.setPage}
						onPageSizeChange={productPager.setPageSize}
						label="products"
						pageSizeOptions={[5, 10, 20, 50]}
					/>
				</Card>
			)}
		</Box>
	);
}

function ProductThumbnail({ product }) {
	const [src, setSrc] = useState("");

	useEffect(() => {
		let active = true;
		let objectUrl = "";

		const load = async () => {
			if (!product?.id || !product?.hasProductImage) {
				setSrc("");
				return;
			}

			try {
				const blob = await bomFlowApi.getProductImageBlob(product.id);
				if (!active || !blob) return;

				objectUrl = URL.createObjectURL(blob);
				setSrc(objectUrl);
			} catch {
				if (active) setSrc("");
			}
		};

		load();

		return () => {
			active = false;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [product?.id, product?.hasProductImage, product?.productImageUploadedAt]);

	return (
		<Box sx={thumbnailSx}>
			{src ? (
				<img src={src} alt={product?.productName || "Product"} style={thumbnailImgStyle} />
			) : (
				<ImageOutlinedIcon sx={{ color: "#64748b" }} />
			)}
		</Box>
	);
}

function SummaryCard({ title, value, icon }) {
	return (
		<Card sx={summaryCardSx}>
			<Box sx={summaryIconSx}>{icon}</Box>
			<Box>
				<Typography sx={summaryTitleSx}>{title}</Typography>
				<Typography sx={summaryValueSx}>{value}</Typography>
			</Box>
		</Card>
	);
}

const pageSx = { width: "100%", display: "flex", flexDirection: "column", gap: "14px" };
const heroSx = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap", p: "16px", borderRadius: "10px", background: "radial-gradient(circle at top left, rgba(37,99,235,.20), transparent 34%), rgba(15,23,42,.78)", border: "1px solid rgba(255,255,255,.08)" };
const heroActionsSx = { display: "flex", gap: "8px", flexWrap: "wrap" };
const labelChipSx = { height: 26, borderRadius: 999, background: "rgba(59,130,246,.14)", color: "#60a5fa", border: "1px solid rgba(59,130,246,.24)", fontWeight: 900, fontSize: 11, mb: "10px" };
const titleSx = { color: "#fff", fontSize: { xs: 24, md: 32 }, fontWeight: 950, letterSpacing: "-0.04em", lineHeight: 1.05 };
const subSx = { mt: "8px", maxWidth: 800, color: "rgba(255,255,255,.64)", fontSize: 13, fontWeight: 650, lineHeight: 1.5 };
const primaryBtnSx = { height: 38, borderRadius: "9px", textTransform: "none", fontWeight: 850, color: "#fff", background: "linear-gradient(135deg,#2563eb,#3b82f6)", boxShadow: "0 10px 22px rgba(37,99,235,.26)" };
const secondaryBtnSx = { height: 38, borderRadius: "9px", textTransform: "none", fontWeight: 850, color: "#fff", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" };
const smallPrimaryBtnSx = { ...primaryBtnSx, height: 34, minWidth: 88, px: "10px", fontSize: 11 };
const smallSecondaryBtnSx = { ...secondaryBtnSx, height: 34, minWidth: 82, px: "10px", fontSize: 11 };
const errorSx = { p: "11px 13px", borderRadius: "9px", color: "#fca5a5", background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.24)", fontSize: 12, fontWeight: 750 };
const summaryGridSx = { display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: "10px", "@media (max-width: 1000px)": { gridTemplateColumns: "repeat(2,minmax(0,1fr))" }, "@media (max-width: 560px)": { gridTemplateColumns: "1fr" } };
const summaryCardSx = { p: "13px", borderRadius: "10px", background: "rgba(15,23,42,.78)", border: "1px solid rgba(255,255,255,.07)", display: "flex", alignItems: "center", gap: "12px" };
const summaryIconSx = { width: 38, height: 38, borderRadius: "9px", display: "grid", placeItems: "center", color: "#93c5fd", background: "rgba(59,130,246,.12)", border: "1px solid rgba(59,130,246,.22)" };
const summaryTitleSx = { color: "rgba(255,255,255,.58)", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".06em" };
const summaryValueSx = { mt: "3px", color: "#fff", fontSize: 20, fontWeight: 950 };
const toolbarSx = { p: "12px", borderRadius: "10px", background: "rgba(15,23,42,.78)", border: "1px solid rgba(255,255,255,.07)" };
const fieldSx = { "& .MuiOutlinedInput-root": { minHeight: 46, color: "#fff", background: "rgba(255,255,255,.04)", borderRadius: "9px", "& fieldset": { borderColor: "rgba(255,255,255,.08)" } }, "& .MuiInputBase-input::placeholder": { color: "rgba(255,255,255,.36)", opacity: 1 } };
const loadingSx = { minHeight: 320, display: "grid", placeItems: "center" };
const emptySx = { minHeight: 300, p: "28px", borderRadius: "10px", background: "rgba(15,23,42,.78)", border: "1px solid rgba(255,255,255,.07)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "10px" };
const emptyIconSx = { width: 48, height: 48, borderRadius: "12px", display: "grid", placeItems: "center", color: "#93c5fd", background: "rgba(59,130,246,.12)", border: "1px solid rgba(59,130,246,.22)" };
const emptyTitleSx = { color: "#fff", fontSize: 18, fontWeight: 950 };
const emptySubSx = { color: "rgba(255,255,255,.58)", fontSize: 12, fontWeight: 650, mb: "6px" };
const tableCardSx = { borderRadius: "10px", background: "rgba(15,23,42,.78)", border: "1px solid rgba(255,255,255,.07)", overflow: "hidden" };
const tableScrollSx = {
	overflowX: "auto",
	overflowY: "hidden",
	scrollbarGutter: "stable",
	overscrollBehaviorX: "contain",
	pb: "3px",
};
const tableHeadSx = { minWidth: 1500, display: "grid", gridTemplateColumns: "minmax(330px,1.7fr) 140px 220px minmax(230px,1.2fr) 170px 150px 180px 210px", background: "rgba(2,6,23,.38)", color: "rgba(255,255,255,.52)", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".06em", "& > div": { padding: "12px 13px" } };
const tableRowSx = { minWidth: 1500, display: "grid", gridTemplateColumns: "minmax(330px,1.7fr) 140px 220px minmax(230px,1.2fr) 170px 150px 180px 210px", alignItems: "center", borderTop: "1px solid rgba(255,255,255,.06)", background: "rgba(255,255,255,.018)", "& > p, & > div": { padding: "10px 13px" } };
const productCellSx = { display: "flex", alignItems: "center", gap: "11px", minWidth: 0 };
const thumbnailSx = { width: 54, height: 54, borderRadius: "10px", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0, background: "rgba(2,6,23,.52)", border: "1px solid rgba(255,255,255,.08)" };
const thumbnailImgStyle = { width: "100%", height: "100%", objectFit: "cover", display: "block" };
const productNameSx = { color: "#fff", fontSize: 13, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const productCodeSx = { mt: "2px", color: "#60a5fa", fontSize: 11, fontWeight: 850, fontFamily: "monospace" };
const cellTextSx = { color: "rgba(255,255,255,.68)", fontSize: 12, fontWeight: 700 };
const cellStrongSx = { color: "#fff", fontSize: 12, fontWeight: 850 };
const mutedTextSx = { color: "rgba(255,255,255,.48)", fontSize: 10.5, fontWeight: 650 };
const monoTextSx = { color: "rgba(255,255,255,.74)", fontSize: 11.5, fontWeight: 800, fontFamily: "monospace" };
const fileChipsSx = { display: "flex", flexWrap: "wrap", gap: "5px" };
const readyChipSx = { height: 22, borderRadius: 999, color: "#4ade80", background: "rgba(34,197,94,.12)", border: "1px solid rgba(34,197,94,.22)", fontSize: 9.5, fontWeight: 850 };
const pendingChipSx = { height: 22, borderRadius: 999, color: "#94a3b8", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", fontSize: 9.5, fontWeight: 850 };
const actionCellSx = { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" };
