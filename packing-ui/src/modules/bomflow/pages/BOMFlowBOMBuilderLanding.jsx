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

import {
	useNavigate,
} from "react-router-dom";

import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import RefreshIcon from "@mui/icons-material/Refresh";

import bomFlowApi from "../api/bomFlowApi.js";

import {
	canEditBomFlowRevision,
	getBomFlowRole,
} from "../../../utils/bomflowAccess.js";

const statusSx = (status) => {
	const value = String(status || "").toUpperCase();

	if (value === "APPROVED") {
		return {
			background: "rgba(34,197,94,.12)",
			color: "#4ade80",
			border: "1px solid rgba(34,197,94,.22)",
		};
	}

	if (value === "VERIFIED") {
		return {
			background: "rgba(168,85,247,.12)",
			color: "#c084fc",
			border: "1px solid rgba(168,85,247,.22)",
		};
	}

	if (value === "SUBMITTED") {
		return {
			background: "rgba(14,165,233,.12)",
			color: "#7dd3fc",
			border: "1px solid rgba(14,165,233,.22)",
		};
	}

	if (value === "RETURNED") {
		return {
			background: "rgba(239,68,68,.12)",
			color: "#fca5a5",
			border: "1px solid rgba(239,68,68,.22)",
		};
	}

	return {
		background: "rgba(245,158,11,.12)",
		color: "#fbbf24",
		border: "1px solid rgba(245,158,11,.22)",
	};
};

export default function BOMFlowBOMBuilderLanding() {
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

		if (!query) {
			return products;
		}

		return products.filter((product) => {
			const haystack = [
				product?.productName,
				product?.productCode,
				product?.drawingNumber,
				product?.category,
				product?.collection,
				product?.projectReference,
				product?.clientEntity,
			]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();

			return haystack.includes(query);
		});
	}, [products, search]);

	const openLatest = (product) => {
		if (product?.latestRevisionId) {
			navigate(
				`/bomflow/revisions/${product.latestRevisionId}`
			);
			return;
		}

		if (canCreate) {
			startRevision(product);
		}
	};

	const startRevision = async (product) => {
		if (!canCreate || !product?.id) {
			return;
		}

		setWorkingId(product.id);
		setError("");

		try {
			const revision = await bomFlowApi.createRevision(
				product.id,
				{
					remarks: product?.latestRevisionId
						? "New BOM revision"
						: "Initial BOM revision",
				}
			);

			if (!revision?.id) {
				throw new Error(
					"BOM revision ID was not returned by the server."
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
					"Unable to create BOM revision."
			);
		} finally {
			setWorkingId("");
		}
	};

	return (
		<Box sx={pageSx}>
			<Box sx={heroSx}>
				<Box>
					<Chip
						label="BOM BUILDER"
						sx={labelChipSx}
					/>

					<Typography sx={titleSx}>
						Select a Product Revision
					</Typography>

					<Typography sx={subSx}>
						Open an existing BOM revision or start a new revision for a
						product. The sidebar BOM Builder link now opens this selector
						instead of redirecting back to Product Master.
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
							onClick={() =>
								navigate("/bomflow/products/new")
							}
							sx={primaryBtnSx}
						>
							Create Product
						</Button>
					)}
				</Box>
			</Box>

			{error && (
				<Box sx={errorSx}>
					{error}
				</Box>
			)}

			<Card sx={toolbarSx}>
				<TextField
					fullWidth
					value={search}
					onChange={(event) =>
						setSearch(event.target.value)
					}
					placeholder="Search product, code, drawing, project or client..."
					InputProps={{
						startAdornment: (
							<SearchIcon
								sx={{
									color: "#64748b",
									mr: 1,
								}}
							/>
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
						<RuleOutlinedIcon />
					</Box>

					<Typography sx={emptyTitleSx}>
						No BOMFlow products found
					</Typography>

					<Typography sx={emptySubSx}>
						Create a product first. Once saved, its BOM revision can be
						opened here directly.
					</Typography>

					{canCreate && (
						<Button
							startIcon={<AddIcon />}
							onClick={() =>
								navigate("/bomflow/products/new")
							}
							sx={primaryBtnSx}
						>
							Create First Product
						</Button>
					)}
				</Card>
			) : (
				<Box sx={gridSx}>
					{filtered.map((product) => {
						const hasRevision =
							Boolean(product?.latestRevisionId);

						const latestStatus =
							product?.latestRevisionStatus ||
							"NO REVISION";

						const openRevision =
							["DRAFT", "RETURNED"].includes(
								String(latestStatus).toUpperCase()
							);

						return (
							<Card
								key={product.id}
								sx={productCardSx}
							>
								<Box sx={cardTopSx}>
									<Box sx={productIconSx}>
										<Inventory2OutlinedIcon />
									</Box>

									<Chip
										label={latestStatus}
										size="small"
										sx={{
											height: 24,
											fontSize: 10,
											fontWeight: 900,
											borderRadius: 999,
											...statusSx(latestStatus),
										}}
									/>
								</Box>

								<Typography sx={productNameSx}>
									{product.productName}
								</Typography>

								<Typography sx={productCodeSx}>
									{product.productCode}
								</Typography>

								<Box sx={metaGridSx}>
									<Meta
										label="Drawing"
										value={product.drawingNumber || "-"}
									/>
									<Meta
										label="Category"
										value={product.category || "-"}
									/>
									<Meta
										label="Project"
										value={product.projectReference || "-"}
									/>
									<Meta
										label="Revisions"
										value={product.revisionCount || 0}
									/>
								</Box>

								<Box sx={cardActionsSx}>
									<Button
										onClick={() =>
											navigate(
												`/bomflow/products/${product.id}/edit`
											)
										}
										sx={secondaryBtnSx}
									>
										Product
									</Button>

									<Button
										disabled={
											workingId === product.id ||
											(!hasRevision && !canCreate)
										}
										endIcon={<ArrowForwardIcon />}
										onClick={() =>
											openLatest(product)
										}
										sx={primaryBtnSx}
									>
										{workingId === product.id
											? "Opening..."
											: hasRevision
											? "Open BOM"
											: "Start BOM"}
									</Button>
								</Box>

								{canCreate &&
									hasRevision &&
									!openRevision &&
									String(latestStatus).toUpperCase() ===
										"APPROVED" && (
										<Button
											fullWidth
											startIcon={<AddIcon />}
											disabled={
												workingId === product.id
											}
											onClick={() =>
												startRevision(product)
											}
											sx={{
												...secondaryBtnSx,
												mt: 1,
											}}
										>
											New Revision
										</Button>
									)}
							</Card>
						);
					})}
				</Box>
			)}
		</Box>
	);
}

function Meta({ label, value }) {
	return (
		<Box sx={metaItemSx}>
			<Typography sx={metaLabelSx}>
				{label}
			</Typography>

			<Typography sx={metaValueSx}>
				{value}
			</Typography>
		</Box>
	);
}

const pageSx = {
	width: "100%",
	display: "flex",
	flexDirection: "column",
	gap: "14px",
};

const heroSx = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "flex-start",
	gap: "16px",
	flexWrap: "wrap",
	p: "16px",
	borderRadius: "10px",
	background:
		"radial-gradient(circle at top left, rgba(37,99,235,.20), transparent 34%), rgba(15,23,42,.78)",
	border: "1px solid rgba(255,255,255,.08)",
};

const heroActionsSx = {
	display: "flex",
	gap: "8px",
	flexWrap: "wrap",
};

const labelChipSx = {
	height: 26,
	borderRadius: 999,
	background: "rgba(59,130,246,.14)",
	color: "#60a5fa",
	border: "1px solid rgba(59,130,246,.24)",
	fontWeight: 900,
	fontSize: 11,
	mb: "10px",
};

const titleSx = {
	color: "#fff",
	fontSize: {
		xs: 24,
		md: 32,
	},
	fontWeight: 950,
	letterSpacing: "-0.04em",
	lineHeight: 1.05,
};

const subSx = {
	mt: "8px",
	maxWidth: 800,
	color: "rgba(255,255,255,.64)",
	fontSize: 13,
	fontWeight: 650,
	lineHeight: 1.5,
};

const primaryBtnSx = {
	height: 38,
	borderRadius: "9px",
	textTransform: "none",
	fontWeight: 850,
	color: "#fff",
	background:
		"linear-gradient(135deg,#2563eb,#3b82f6)",
	boxShadow:
		"0 10px 22px rgba(37,99,235,.26)",
};

const secondaryBtnSx = {
	height: 38,
	borderRadius: "9px",
	textTransform: "none",
	fontWeight: 850,
	color: "#fff",
	background: "rgba(255,255,255,.04)",
	border: "1px solid rgba(255,255,255,.08)",
};

const errorSx = {
	p: "11px 13px",
	borderRadius: "9px",
	color: "#fca5a5",
	background: "rgba(239,68,68,.12)",
	border: "1px solid rgba(239,68,68,.24)",
	fontSize: 12,
	fontWeight: 750,
};

const toolbarSx = {
	p: "12px",
	borderRadius: "10px",
	background: "rgba(15,23,42,.78)",
	border: "1px solid rgba(255,255,255,.07)",
};

const fieldSx = {
	"& .MuiOutlinedInput-root": {
		minHeight: 46,
		color: "#fff",
		background: "rgba(255,255,255,.04)",
		borderRadius: "9px",

		"& fieldset": {
			borderColor: "rgba(255,255,255,.08)",
		},
	},

	"& .MuiInputBase-input::placeholder": {
		color: "rgba(255,255,255,.36)",
		opacity: 1,
	},
};

const loadingSx = {
	minHeight: 320,
	display: "grid",
	placeItems: "center",
};

const gridSx = {
	display: "grid",
	gridTemplateColumns:
		"repeat(auto-fit, minmax(300px, 1fr))",
	gap: "12px",
};

const productCardSx = {
	p: "15px",
	borderRadius: "10px",
	background: "rgba(15,23,42,.78)",
	border: "1px solid rgba(255,255,255,.07)",
	boxShadow: "0 14px 28px rgba(2,6,23,.25)",
};

const cardTopSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "10px",
	mb: "12px",
};

const productIconSx = {
	width: 38,
	height: 38,
	borderRadius: "9px",
	display: "grid",
	placeItems: "center",
	color: "#93c5fd",
	background: "rgba(59,130,246,.12)",
	border: "1px solid rgba(59,130,246,.22)",
};

const productNameSx = {
	color: "#fff",
	fontSize: 18,
	fontWeight: 950,
};

const productCodeSx = {
	mt: "4px",
	color: "#60a5fa",
	fontSize: 12,
	fontWeight: 850,
	fontFamily: "monospace",
};

const metaGridSx = {
	display: "grid",
	gridTemplateColumns: "1fr 1fr",
	gap: "8px",
	mt: "14px",
};

const metaItemSx = {
	p: "9px",
	borderRadius: "8px",
	background: "rgba(2,6,23,.34)",
	border: "1px solid rgba(255,255,255,.06)",
	minWidth: 0,
};

const metaLabelSx = {
	color: "rgba(255,255,255,.45)",
	fontSize: 9,
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".06em",
};

const metaValueSx = {
	mt: "3px",
	color: "rgba(255,255,255,.78)",
	fontSize: 11,
	fontWeight: 800,
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
};

const cardActionsSx = {
	display: "grid",
	gridTemplateColumns: "1fr 1fr",
	gap: "8px",
	mt: "14px",
};

const emptySx = {
	minHeight: 320,
	p: 3,
	borderRadius: "10px",
	background: "rgba(15,23,42,.78)",
	border: "1px solid rgba(255,255,255,.07)",
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	textAlign: "center",
};

const emptyIconSx = {
	width: 52,
	height: 52,
	borderRadius: "12px",
	display: "grid",
	placeItems: "center",
	color: "#93c5fd",
	background: "rgba(59,130,246,.12)",
	border: "1px solid rgba(59,130,246,.22)",
	mb: 1.5,
};

const emptyTitleSx = {
	color: "#fff",
	fontSize: 18,
	fontWeight: 950,
};

const emptySubSx = {
	mt: 0.7,
	mb: 2,
	maxWidth: 520,
	color: "rgba(255,255,255,.55)",
	fontSize: 12,
	fontWeight: 650,
	lineHeight: 1.5,
};
