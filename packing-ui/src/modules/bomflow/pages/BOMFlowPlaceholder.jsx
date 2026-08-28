import {
	useEffect,
	useMemo,
	useState,
} from "react";

import {
	Box,
	Button,
	Card,
	Checkbox,
	Chip,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	FormControlLabel,
	IconButton,
	MenuItem,
	Switch,
	TextField,
	Typography,
} from "@mui/material";

import {
	useNavigate,
	useSearchParams,
} from "react-router-dom";

import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PriceChangeOutlinedIcon from "@mui/icons-material/PriceChangeOutlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import SyncOutlinedIcon from "@mui/icons-material/SyncOutlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import TrendingDownOutlinedIcon from "@mui/icons-material/TrendingDownOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";

import bomFlowApi from "../api/bomFlowApi.js";
import BOMFlowPagination, { useBomFlowPagination } from "../BOMFlowPagination.jsx";

import {
	canEditBomFlowRevision,
	getBomFlowRole,
} from "../../../utils/bomflowAccess.js";

const localBusinessDateKey = (date = new Date()) => {
	const pad = (value) => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const parseBomDateTime = (value) => {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value;
	}
	const raw = String(value || "").trim();
	if (!raw) return null;
	const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (dateOnly) {
		const parsed = new Date(
			Number(dateOnly[1]),
			Number(dateOnly[2]) - 1,
			Number(dateOnly[3]),
			0, 0, 0, 0
		);
		return Number.isNaN(parsed.getTime()) ? null : parsed;
	}
	const local = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?$/);
	if (local) {
		const ms = Number(String(local[7] || "").padEnd(3, "0").slice(0, 3) || 0);
		const parsed = new Date(
			Number(local[1]),
			Number(local[2]) - 1,
			Number(local[3]),
			Number(local[4]),
			Number(local[5]),
			Number(local[6] || 0),
			ms
		);
		return Number.isNaN(parsed.getTime()) ? null : parsed;
	}
	const parsed = new Date(raw);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const safeFileName = (value, fallback = "download") =>
	String(value || fallback)
		.replace(/[\/\\?%*:|"<>\u0000-\u001f]/g, "_")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 180) || fallback;

const downloadBlob = (blob, fileName) => {
	if (!(blob instanceof Blob) || blob.size <= 0) {
		throw new Error("Downloaded file is empty.");
	}
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = safeFileName(fileName);
	anchor.rel = "noopener";
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

const createMaterialRateEmpty = () => ({
	category: "Metal",
	itemName: "",
	brand: "",
	vendorName: "",
	unit: "NOS",
	rateType: "PURCHASE",
	rate: "",
	gstPercent: "18",
	effectiveFrom: localBusinessDateKey(),
	effectiveTo: "",
	sourceReference: "",
	notes: "",
	active: true,
});

const createLabourRateEmpty = () => ({
	department: "Metal",
	processCode: "",
	processName: "",
	basis: "PER_HOUR",
	unit: "HOUR",
	rate: "",
	defaultLabourCount: "1",
	defaultWorkingHours: "0",
	effectiveFrom: localBusinessDateKey(),
	effectiveTo: "",
	notes: "",
	active: true,
});

const LABOUR_LINE_EMPTY = {
	labourRateId: "",
	basis: "PER_HOUR",
	unit: "HOUR",
	labourCount: "1",
	workingHours: "",
	quantity: "",
	rate: "",
	remarks: "",
};

const BASIS_OPTIONS = [
	["PER_HOUR", "Per Hour"],
	["PER_ITEM", "Per Item"],
	["PER_SQFT", "Per Sq. Ft."],
	["PER_SQIN", "Per Sq. Inch"],
	["PER_METER", "Per Meter"],
	["PER_KG", "Per Kg"],
	["FIXED", "Fixed"],
];

const RATE_TYPE_OPTIONS = [
	["PURCHASE", "Purchase"],
	["STANDARD", "Standard"],
	["CONTRACT", "Contract"],
	["PROCESS", "Process"],
	["OTHER", "Other"],
];

const CATEGORY_OPTIONS = [
	"Metal",
	"Wood",
	"Stone",
	"Glass",
	"Hardware",
	"Upholstery",
	"Fabric",
	"Paint",
	"Packaging",
	"Miscellaneous",
];

const DEPARTMENT_OPTIONS = [
	"Metal",
	"Wood",
	"Stone",
	"Glass",
	"Fabric",
	"Packing",
	"Polishing",
	"Assembly",
	"Miscellaneous",
];

const cleanError = (error, fallback) => (
	error?.response?.data?.message ||
	error?.response?.data?.detail ||
	error?.message ||
	fallback
);

const money = (value) =>
	`₹ ${Number(value || 0).toLocaleString("en-IN", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;

const decimal = (value, digits = 3) =>
	Number(value || 0).toLocaleString("en-IN", {
		maximumFractionDigits: digits,
	});

const signedMoney = (value) => {
	const number = Number(value || 0);
	const prefix = number > 0 ? "+" : number < 0 ? "−" : "";
	return `${prefix}${money(Math.abs(number))}`;
};

const signedPercent = (value) => {
	if (value === null || value === undefined) return "New baseline";
	const number = Number(value || 0);
	const prefix = number > 0 ? "+" : number < 0 ? "−" : "";
	return `${prefix}${Math.abs(number).toFixed(2)}%`;
};

const labourBasisUnit = (basis, fallback = "UNIT") => {
	const map = {
		PER_HOUR: "HOUR",
		PER_ITEM: "NOS",
		PER_SQFT: "SQFT",
		PER_SQIN: "SQIN",
		PER_METER: "METER",
		PER_KG: "KG",
		FIXED: fallback || "JOB",
	};
	return map[String(basis || "").toUpperCase()] || fallback || "UNIT";
};

const formatDate = (value) => {
	if (!value) return "-";
	const date = parseBomDateTime(value);
	if (!date) return String(value);
	return date.toLocaleDateString("en-IN", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
};

export default function BOMFlowPlaceholder({
	mode,
	title,
	subtitle,
}) {
	if (mode === "rate-master" || title === "Rate Master") {
		return <RateMaster />;
	}

	if (mode === "labour-master" || title === "Labour Master") {
		return <LabourMaster />;
	}

	if (mode === "costing" || title === "Costing Engine") {
		return <CostingEngine />;
	}

	if (mode === "reports" || title === "Reports") {
		return <ReportsWorkspace />;
	}

	return (
		<Card sx={panelSx}>
			<Typography sx={pageTitleSx}>{title}</Typography>
			<Typography sx={pageSubSx}>{subtitle}</Typography>
		</Card>
	);
}

/* ========================================================================
   RATE MASTER
   ======================================================================== */

function RateMaster() {
	const role = getBomFlowRole();
	const canEdit = canEditBomFlowRevision(role);
	const navigate = useNavigate();

	const [rates, setRates] = useState([]);
	const [products, setProducts] = useState([]);
	const [search, setSearch] = useState("");
	const [activeOnly, setActiveOnly] = useState(false);
	const [revisionId, setRevisionId] = useState("");
	const [loading, setLoading] = useState(true);
	const [working, setWorking] = useState(false);
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");
	const [dialog, setDialog] = useState({
		open: false,
		editing: null,
		form: createMaterialRateEmpty(),
	});

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const [rateData, productData] = await Promise.all([
				bomFlowApi.listMaterialRates({ activeOnly }),
				bomFlowApi.listProducts(),
			]);
			setRates(Array.isArray(rateData) ? rateData : rateData?.content || []);
			setProducts(Array.isArray(productData) ? productData : productData?.content || []);
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to load Rate Master."));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, [activeOnly]);

	const filtered = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) return rates;
		return rates.filter((row) => [
			row.category,
			row.itemName,
			row.brand,
			row.vendorName,
			row.unit,
			row.rateType,
			row.sourceReference,
			row.evidenceFileName,
		].filter(Boolean).join(" ").toLowerCase().includes(query));
	}, [rates, search]);

	const ratePager = useBomFlowPagination(filtered, {
		initialPageSize: 10,
		resetKey: `${search}|${activeOnly}`,
	});

	const stats = useMemo(() => ({
		total: rates.length,
		active: rates.filter((row) => row.active).length,
		inactive: rates.filter((row) => !row.active).length,
		avg: rates.length
			? rates.reduce((sum, row) => sum + Number(row.rate || 0), 0) / rates.length
			: 0,
	}), [rates]);

	const openCreate = () => setDialog({
		open: true,
		editing: null,
		form: createMaterialRateEmpty(),
	});

	const openEdit = (row) => setDialog({
		open: true,
		editing: row,
		form: {
			category: row.category || "Metal",
			itemName: row.itemName || "",
			brand: row.brand || "",
			vendorName: row.vendorName || "",
			unit: row.unit || "NOS",
			rateType: row.rateType || "PURCHASE",
			rate: String(row.rate ?? ""),
			gstPercent: String(row.gstPercent ?? 0),
			effectiveFrom: row.effectiveFrom || "",
			effectiveTo: row.effectiveTo || "",
			sourceReference: row.sourceReference || "",
			notes: row.notes || "",
			active: Boolean(row.active),
		},
	});

	const save = async () => {
		const form = dialog.form;
		if (!form.itemName.trim()) {
			setError("Item name is required.");
			return;
		}
		if (!form.category.trim() || !form.unit.trim()) {
			setError("Category and unit are required.");
			return;
		}
		if (!Number.isFinite(Number(form.rate)) || Number(form.rate) < 0) {
			setError("Rate must be zero or greater.");
			return;
		}

		setWorking(true);
		setError("");
		try {
			const payload = {
				...form,
				rate: Number(form.rate),
				gstPercent: Number(form.gstPercent || 0),
				effectiveTo: form.effectiveTo || null,
				brand: form.brand.trim() || null,
				vendorName: form.vendorName.trim() || null,
				sourceReference: form.sourceReference.trim() || null,
				notes: form.notes.trim() || null,
				rowVersion: dialog.editing?.rowVersion,
			};

			if (dialog.editing?.id) {
				await bomFlowApi.updateMaterialRate(dialog.editing.id, payload);
			} else {
				await bomFlowApi.createMaterialRate(payload);
			}

			setDialog({ open: false, editing: null, form: createMaterialRateEmpty() });
			setMessage(dialog.editing ? "Material rate updated." : "Material rate created.");
			await load();
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to save material rate."));
		} finally {
			setWorking(false);
		}
	};

	const toggleActive = async (row) => {
		setWorking(true);
		setError("");
		try {
			await bomFlowApi.setMaterialRateActive(row.id, !row.active, row.rowVersion);
			await load();
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to change rate status."));
		} finally {
			setWorking(false);
		}
	};

	const uploadEvidence = (row) => {
		if (!canEdit || !row?.id) return;
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".pdf,.png,.jpg,.jpeg,.webp,.xls,.xlsx,.csv";
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;
			setWorking(true);
			setError("");
			try {
				await bomFlowApi.uploadMaterialRateEvidence(row.id, file);
				setMessage("Rate evidence uploaded.");
				await load();
			} catch (requestError) {
				setError(cleanError(requestError, "Unable to upload rate evidence."));
			} finally {
				setWorking(false);
			}
		};
		input.click();
	};

	const downloadEvidence = async (row) => {
		if (!row?.id || !row?.hasEvidence) return;
		setWorking(true);
		try {
			const blob = await bomFlowApi.getMaterialRateEvidenceBlob(row.id);
			downloadBlob(blob, row.evidenceFileName || "rate-evidence");
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to download rate evidence."));
		} finally {
			setWorking(false);
		}
	};

	const deleteEvidence = async (row) => {
		if (!canEdit || !row?.id || !row?.hasEvidence) return;
		setWorking(true);
		setError("");
		try {
			await bomFlowApi.deleteMaterialRateEvidence(row.id);
			setMessage("Rate evidence removed.");
			await load();
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to remove rate evidence."));
		} finally {
			setWorking(false);
		}
	};

	const applyRates = async () => {
		if (!revisionId) {
			setError("Select a BOM revision before applying rates.");
			return;
		}
		setWorking(true);
		setError("");
		setMessage("");
		try {
			const result = await bomFlowApi.applyMaterialRates(revisionId);
			setMessage(
				`${result?.message || "Rate Master applied."} ${result?.unmatchedRows || 0} unmatched row(s).`
			);
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to apply Rate Master."));
		} finally {
			setWorking(false);
		}
	};

	return (
		<Box sx={pageSx}>
			<ModuleHero
				chip="RATE MASTER"
				title="Material Rate Control"
				subtitle="Maintain approved material rates, GST, vendor/brand context and effective dates, then apply exact item-name matches back to editable BOM revisions."
				icon={<PriceChangeOutlinedIcon />}
				actions={canEdit ? (
					<Button startIcon={<AddIcon />} onClick={openCreate} sx={primaryBtnSx}>
						Add Material Rate
					</Button>
				) : null}
			/>

			<Feedback error={error} message={message} />

			<Box sx={summaryGridSx}>
				<SummaryCard title="Total Rates" value={stats.total} />
				<SummaryCard title="Active" value={stats.active} accent="#22c55e" />
				<SummaryCard title="Inactive" value={stats.inactive} accent="#94a3b8" />
				<SummaryCard title="Average Rate" value={money(stats.avg)} accent="#f59e0b" />
			</Box>

			<Card sx={toolbarSx}>
				<Box sx={toolbarGridSx}>
					<TextField
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Search item, category, rate type, brand, vendor, unit, source or evidence..."
						InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: "#64748b" }} /> }}
						sx={fieldSx}
					/>

					<FormControlLabel
						control={<Switch checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)} />}
						label="Active only"
						sx={switchLabelSx}
					/>

					<Button startIcon={<RefreshIcon />} onClick={load} disabled={loading} sx={secondaryBtnSx}>
						Refresh
					</Button>
				</Box>
			</Card>

			<Card sx={applyCardSx}>
				<Box sx={{ minWidth: 260, flex: 1 }}>
					<Typography sx={panelTitleSx}>Apply Rate Master to BOM</Typography>
					<Typography sx={panelSubSx}>
						Only exact normalized material names are applied. Category, brand, unit and vendor improve match priority; unmatched rows are left unchanged.
					</Typography>
				</Box>

				<TextField
					select
					label="Latest Product BOM"
					value={revisionId}
					onChange={(event) => setRevisionId(event.target.value)}
					sx={{ ...fieldSx, minWidth: 330 }}
				>
					<MenuItem value="">Select revision</MenuItem>
					{products.filter((product) => product.latestRevisionId).map((product) => (
						<MenuItem key={product.id} value={product.latestRevisionId}>
							{product.productName} • R{product.latestRevisionNo || "-"} • {product.latestRevisionStatus || "-"}
						</MenuItem>
					))}
				</TextField>

				<Button
					startIcon={<SyncOutlinedIcon />}
					disabled={!revisionId || working || !canEdit}
					onClick={applyRates}
					sx={primaryBtnSx}
				>
					Apply Rates
				</Button>

				{revisionId && (
					<Button
						onClick={() => navigate(`/bomflow/revisions/${revisionId}`)}
						sx={secondaryBtnSx}
					>
						Open BOM
					</Button>
				)}
			</Card>

			{loading ? <Loading /> : (
				<Card sx={tableCardSx}>
					<Box sx={tableScrollSx}>
						<Box sx={rateHeadSx}>
							<div>Material</div><div>Category</div><div>Brand / Vendor</div><div>Unit</div>
							<div>Rate</div><div>GST</div><div>Effective</div><div>Status</div><div>Action</div>
						</Box>
						{ratePager.pageItems.map((row) => (
							<Box key={row.id} sx={rateRowSx}>
								<Box>
									<Typography sx={cellStrongSx}>{row.itemName}</Typography>
									<Typography sx={mutedTextSx}>{row.rateType || "PURCHASE"} • {row.sourceReference || "No source reference"}</Typography>
								</Box>
								<Typography sx={cellTextSx}>{row.category}</Typography>
								<Box>
									<Typography sx={cellTextSx}>{row.brand || "-"}</Typography>
									<Typography sx={mutedTextSx}>{row.vendorName || "No vendor"}</Typography>
								</Box>
								<Typography sx={monoTextSx}>{row.unit}</Typography>
								<Typography sx={moneyTextSx}>{money(row.rate)}</Typography>
								<Typography sx={monoTextSx}>{decimal(row.gstPercent, 2)}%</Typography>
								<Box>
									<Typography sx={cellTextSx}>{formatDate(row.effectiveFrom)}</Typography>
									<Typography sx={mutedTextSx}>{row.effectiveTo ? `to ${formatDate(row.effectiveTo)}` : "Open ended"}</Typography>
								</Box>
								<StatusChip active={row.active} />
								<Box sx={actionRowSx}>
									{canEdit && <IconButton size="small" onClick={() => openEdit(row)} sx={iconBtnSx}><EditOutlinedIcon fontSize="small" /></IconButton>}
									{row.hasEvidence && <IconButton size="small" disabled={working} onClick={() => downloadEvidence(row)} sx={iconBtnSx} title="Download evidence"><DownloadOutlinedIcon fontSize="small" /></IconButton>}
									{canEdit && <Button disabled={working} onClick={() => uploadEvidence(row)} sx={tinyBtnSx}>{row.hasEvidence ? "Replace Proof" : "Add Proof"}</Button>}
									{canEdit && row.hasEvidence && <IconButton size="small" disabled={working} onClick={() => deleteEvidence(row)} sx={deleteBtnSx} title="Remove evidence"><DeleteOutlineIcon fontSize="small" /></IconButton>}
									{canEdit && <Button disabled={working} onClick={() => toggleActive(row)} sx={tinyBtnSx}>{row.active ? "Deactivate" : "Activate"}</Button>}
								</Box>
							</Box>
						))}
						{filtered.length === 0 && <EmptyTable text="No material rates found." />}
					</Box>
					<BOMFlowPagination
						page={ratePager.page}
						pageCount={ratePager.pageCount}
						pageSize={ratePager.pageSize}
						total={ratePager.total}
						from={ratePager.from}
						to={ratePager.to}
						onPageChange={ratePager.setPage}
						onPageSizeChange={ratePager.setPageSize}
						label="material rates"
						pageSizeOptions={[5, 10, 20, 50]}
					/>
				</Card>
			)}

			<MaterialRateDialog dialog={dialog} setDialog={setDialog} working={working} onSave={save} />
		</Box>
	);
}

function MaterialRateDialog({ dialog, setDialog, working, onSave }) {
	const form = dialog.form;
	const update = (key, value) => setDialog((prev) => ({
		...prev,
		form: { ...prev.form, [key]: value },
	}));

	return (
		<Dialog open={dialog.open} onClose={() => !working && setDialog({ open: false, editing: null, form: createMaterialRateEmpty() })} fullWidth maxWidth="md" PaperProps={{ sx: dialogPaperSx }}>
			<DialogTitle sx={dialogTitleSx}>{dialog.editing ? "Edit Material Rate" : "Add Material Rate"}</DialogTitle>
			<DialogContent sx={dialogContentSx}>
				<Box sx={formGrid2Sx}>
					<TextField select label="Category *" value={form.category} onChange={(e) => update("category", e.target.value)} sx={fieldSx}>
						{CATEGORY_OPTIONS.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
					</TextField>
					<TextField label="Item Name *" value={form.itemName} onChange={(e) => update("itemName", e.target.value)} sx={fieldSx} />
					<TextField label="Brand" value={form.brand} onChange={(e) => update("brand", e.target.value)} sx={fieldSx} />
					<TextField label="Vendor" value={form.vendorName} onChange={(e) => update("vendorName", e.target.value)} sx={fieldSx} />
					<TextField label="Unit *" value={form.unit} onChange={(e) => update("unit", e.target.value.toUpperCase())} sx={fieldSx} />
					<TextField select label="Rate Type" value={form.rateType} onChange={(e) => update("rateType", e.target.value)} sx={fieldSx}>
						{RATE_TYPE_OPTIONS.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
					</TextField>
					<TextField type="number" label="Rate *" value={form.rate} onChange={(e) => update("rate", e.target.value)} sx={fieldSx} />
					<TextField type="number" label="GST %" value={form.gstPercent} onChange={(e) => update("gstPercent", e.target.value)} sx={fieldSx} />
					<TextField label="Source / Bill / PO Reference" value={form.sourceReference} onChange={(e) => update("sourceReference", e.target.value)} sx={fieldSx} />
					<TextField type="date" label="Effective From" value={form.effectiveFrom} onChange={(e) => update("effectiveFrom", e.target.value)} InputLabelProps={{ shrink: true }} sx={fieldSx} />
					<TextField type="date" label="Effective To" value={form.effectiveTo} onChange={(e) => update("effectiveTo", e.target.value)} InputLabelProps={{ shrink: true }} sx={fieldSx} />
				</Box>
				<TextField fullWidth multiline minRows={3} label="Notes" value={form.notes} onChange={(e) => update("notes", e.target.value)} sx={{ ...fieldSx, mt: 2 }} />
				<FormControlLabel control={<Checkbox checked={form.active} onChange={(e) => update("active", e.target.checked)} />} label="Active rate" sx={switchLabelSx} />
			</DialogContent>
			<DialogActions sx={dialogActionsSx}>
				<Button disabled={working} onClick={() => setDialog({ open: false, editing: null, form: createMaterialRateEmpty() })} sx={secondaryBtnSx}>Cancel</Button>
				<Button disabled={working} onClick={onSave} sx={primaryBtnSx}>{working ? "Saving..." : "Save Rate"}</Button>
			</DialogActions>
		</Dialog>
	);
}

/* ========================================================================
   LABOUR MASTER
   ======================================================================== */

function LabourMaster() {
	const role = getBomFlowRole();
	const canEdit = canEditBomFlowRevision(role);
	const [rates, setRates] = useState([]);
	const [search, setSearch] = useState("");
	const [activeOnly, setActiveOnly] = useState(false);
	const [loading, setLoading] = useState(true);
	const [working, setWorking] = useState(false);
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");
	const [dialog, setDialog] = useState({ open: false, editing: null, form: createLabourRateEmpty() });

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const data = await bomFlowApi.listLabourRates({ activeOnly });
			setRates(Array.isArray(data) ? data : data?.content || []);
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to load Labour Master."));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => { load(); }, [activeOnly]);

	const filtered = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) return rates;
		return rates.filter((row) => [row.department, row.processCode, row.processName, row.basis, row.unit]
			.filter(Boolean).join(" ").toLowerCase().includes(query));
	}, [rates, search]);

	const labourRatePager = useBomFlowPagination(filtered, {
		initialPageSize: 10,
		resetKey: `${search}|${activeOnly}`,
	});

	const openEdit = (row) => setDialog({
		open: true,
		editing: row,
		form: {
			department: row.department || "Metal",
			processCode: row.processCode || "",
			processName: row.processName || "",
			basis: row.basis || "PER_HOUR",
			unit: row.unit || "HOUR",
			rate: String(row.rate ?? ""),
			defaultLabourCount: String(row.defaultLabourCount ?? 1),
			defaultWorkingHours: String(row.defaultWorkingHours ?? 0),
			effectiveFrom: row.effectiveFrom || "",
			effectiveTo: row.effectiveTo || "",
			notes: row.notes || "",
			active: Boolean(row.active),
		},
	});

	const save = async () => {
		const form = dialog.form;
		if (!form.department.trim() || !form.processName.trim()) {
			setError("Department and process name are required.");
			return;
		}
		if (!Number.isFinite(Number(form.rate)) || Number(form.rate) < 0) {
			setError("Labour rate must be zero or greater.");
			return;
		}

		setWorking(true);
		setError("");
		try {
			const payload = {
				...form,
				rate: Number(form.rate),
				defaultLabourCount: Number(form.defaultLabourCount || 0),
				defaultWorkingHours: Number(form.defaultWorkingHours || 0),
				effectiveTo: form.effectiveTo || null,
				processCode: form.processCode.trim() || null,
				notes: form.notes.trim() || null,
				rowVersion: dialog.editing?.rowVersion,
			};
			if (dialog.editing?.id) {
				await bomFlowApi.updateLabourRate(dialog.editing.id, payload);
			} else {
				await bomFlowApi.createLabourRate(payload);
			}
			setMessage(dialog.editing ? "Labour rate updated." : "Labour rate created.");
			setDialog({ open: false, editing: null, form: createLabourRateEmpty() });
			await load();
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to save labour rate."));
		} finally {
			setWorking(false);
		}
	};

	const toggleActive = async (row) => {
		setWorking(true);
		setError("");
		try {
			await bomFlowApi.setLabourRateActive(row.id, !row.active, row.rowVersion);
			await load();
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to change labour rate status."));
		} finally {
			setWorking(false);
		}
	};

	return (
		<Box sx={pageSx}>
			<ModuleHero
				chip="LABOUR MASTER"
				title="Process & Labour Rate Control"
				subtitle="Maintain department/process labour rates with effective dates and multiple charging bases. These masters feed revision-specific labour costing in the Costing Engine."
				icon={<EngineeringOutlinedIcon />}
				actions={canEdit ? <Button startIcon={<AddIcon />} onClick={() => setDialog({ open: true, editing: null, form: createLabourRateEmpty() })} sx={primaryBtnSx}>Add Labour Rate</Button> : null}
			/>
			<Feedback error={error} message={message} />

			<Box sx={summaryGridSx}>
				<SummaryCard title="Processes" value={rates.length} />
				<SummaryCard title="Active" value={rates.filter((row) => row.active).length} accent="#22c55e" />
				<SummaryCard title="Departments" value={new Set(rates.map((row) => row.department)).size} accent="#a855f7" />
				<SummaryCard title="Per Hour" value={rates.filter((row) => row.basis === "PER_HOUR").length} accent="#f59e0b" />
			</Box>

			<Card sx={toolbarSx}>
				<Box sx={toolbarGridSx}>
					<TextField value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search department, process, code, basis or unit..." InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: "#64748b" }} /> }} sx={fieldSx} />
					<FormControlLabel control={<Switch checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />} label="Active only" sx={switchLabelSx} />
					<Button startIcon={<RefreshIcon />} onClick={load} disabled={loading} sx={secondaryBtnSx}>Refresh</Button>
				</Box>
			</Card>

			{loading ? <Loading /> : (
				<Card sx={tableCardSx}>
					<Box sx={tableScrollSx}>
						<Box sx={labourHeadSx}>
							<div>Department / Process</div><div>Code</div><div>Basis</div><div>Unit</div><div>Rate</div><div>Standard</div><div>Effective</div><div>Status</div><div>Action</div>
						</Box>
						{labourRatePager.pageItems.map((row) => (
							<Box key={row.id} sx={labourRowSx}>
								<Box><Typography sx={cellStrongSx}>{row.processName}</Typography><Typography sx={mutedTextSx}>{row.department}</Typography></Box>
								<Typography sx={monoTextSx}>{row.processCode || "-"}</Typography>
								<Typography sx={cellTextSx}>{row.basis?.replaceAll("_", " ")}</Typography>
								<Typography sx={monoTextSx}>{row.unit}</Typography>
								<Typography sx={moneyTextSx}>{money(row.rate)}</Typography>
								<Box><Typography sx={monoTextSx}>{decimal(row.defaultLabourCount)} labour</Typography><Typography sx={mutedTextSx}>{decimal(row.defaultWorkingHours)} hr std.</Typography></Box>
								<Box><Typography sx={cellTextSx}>{formatDate(row.effectiveFrom)}</Typography><Typography sx={mutedTextSx}>{row.effectiveTo ? `to ${formatDate(row.effectiveTo)}` : "Open ended"}</Typography></Box>
								<StatusChip active={row.active} />
								<Box sx={actionRowSx}>
									{canEdit && <IconButton size="small" onClick={() => openEdit(row)} sx={iconBtnSx}><EditOutlinedIcon fontSize="small" /></IconButton>}
									{canEdit && <Button disabled={working} onClick={() => toggleActive(row)} sx={tinyBtnSx}>{row.active ? "Deactivate" : "Activate"}</Button>}
								</Box>
							</Box>
						))}
						{filtered.length === 0 && <EmptyTable text="No labour rates found." />}
					</Box>
					<BOMFlowPagination
						page={labourRatePager.page}
						pageCount={labourRatePager.pageCount}
						pageSize={labourRatePager.pageSize}
						total={labourRatePager.total}
						from={labourRatePager.from}
						to={labourRatePager.to}
						onPageChange={labourRatePager.setPage}
						onPageSizeChange={labourRatePager.setPageSize}
						label="labour rates"
						pageSizeOptions={[5, 10, 20, 50]}
					/>
				</Card>
			)}

			<LabourRateDialog dialog={dialog} setDialog={setDialog} working={working} onSave={save} />
		</Box>
	);
}

function LabourRateDialog({ dialog, setDialog, working, onSave }) {
	const form = dialog.form;
	const update = (key, value) => setDialog((prev) => ({ ...prev, form: { ...prev.form, [key]: value } }));
	return (
		<Dialog open={dialog.open} onClose={() => !working && setDialog({ open: false, editing: null, form: createLabourRateEmpty() })} fullWidth maxWidth="md" PaperProps={{ sx: dialogPaperSx }}>
			<DialogTitle sx={dialogTitleSx}>{dialog.editing ? "Edit Labour Rate" : "Add Labour Rate"}</DialogTitle>
			<DialogContent sx={dialogContentSx}>
				<Box sx={formGrid2Sx}>
					<TextField select label="Department *" value={form.department} onChange={(e) => update("department", e.target.value)} sx={fieldSx}>{DEPARTMENT_OPTIONS.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
					<TextField label="Process Code" value={form.processCode} onChange={(e) => update("processCode", e.target.value)} sx={fieldSx} />
					<TextField label="Process Name *" value={form.processName} onChange={(e) => update("processName", e.target.value)} sx={fieldSx} />
					<TextField select label="Rate Basis *" value={form.basis} onChange={(e) => update("basis", e.target.value)} sx={fieldSx}>{BASIS_OPTIONS.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
					<TextField label="Unit" value={form.unit} onChange={(e) => update("unit", e.target.value.toUpperCase())} sx={fieldSx} />
					<TextField type="number" label="Rate *" value={form.rate} onChange={(e) => update("rate", e.target.value)} sx={fieldSx} />
					<TextField type="number" label="Default Labour Count" value={form.defaultLabourCount} onChange={(e) => update("defaultLabourCount", e.target.value)} sx={fieldSx} />
					<TextField type="number" label="Default Working Hours" value={form.defaultWorkingHours} onChange={(e) => update("defaultWorkingHours", e.target.value)} sx={fieldSx} />
					<Box />
					<TextField type="date" label="Effective From" value={form.effectiveFrom} onChange={(e) => update("effectiveFrom", e.target.value)} InputLabelProps={{ shrink: true }} sx={fieldSx} />
					<TextField type="date" label="Effective To" value={form.effectiveTo} onChange={(e) => update("effectiveTo", e.target.value)} InputLabelProps={{ shrink: true }} sx={fieldSx} />
				</Box>
				<TextField fullWidth multiline minRows={3} label="Notes" value={form.notes} onChange={(e) => update("notes", e.target.value)} sx={{ ...fieldSx, mt: 2 }} />
				<FormControlLabel control={<Checkbox checked={form.active} onChange={(e) => update("active", e.target.checked)} />} label="Active process rate" sx={switchLabelSx} />
			</DialogContent>
			<DialogActions sx={dialogActionsSx}>
				<Button disabled={working} onClick={() => setDialog({ open: false, editing: null, form: createLabourRateEmpty() })} sx={secondaryBtnSx}>Cancel</Button>
				<Button disabled={working} onClick={onSave} sx={primaryBtnSx}>{working ? "Saving..." : "Save Labour Rate"}</Button>
			</DialogActions>
		</Dialog>
	);
}

/* ========================================================================
   COSTING ENGINE
   ======================================================================== */

function CostingEngine() {
	const navigate = useNavigate();
	const role = getBomFlowRole();
	const canEdit = canEditBomFlowRevision(role);
	const [searchParams, setSearchParams] = useSearchParams();

	const [products, setProducts] = useState([]);
	const [revisions, setRevisions] = useState([]);
	const [productId, setProductId] = useState(searchParams.get("productId") || "");
	const [revisionId, setRevisionId] = useState(searchParams.get("revisionId") || "");
	const [costing, setCosting] = useState(null);
	const [intelligence, setIntelligence] = useState(null);
	const [compareRevisionId, setCompareRevisionId] = useState("");
	const [labourRates, setLabourRates] = useState([]);
	const [settings, setSettings] = useState(null);
	const [loading, setLoading] = useState(true);
	const [working, setWorking] = useState(false);
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");
	const [labourDialog, setLabourDialog] = useState({ open: false, editing: null, form: { ...LABOUR_LINE_EMPTY } });

	const materialPager = useBomFlowPagination(costing?.materialLines || [], {
		initialPageSize: 8,
		resetKey: revisionId,
	});

	const costingLabourPager = useBomFlowPagination(costing?.labourLines || [], {
		initialPageSize: 8,
		resetKey: revisionId,
	});

	useEffect(() => {
		const start = async () => {
			setLoading(true);
			try {
				const [productData, labourData] = await Promise.all([
					bomFlowApi.listProducts(),
					bomFlowApi.listLabourRates({ activeOnly: true }),
				]);
				const list = Array.isArray(productData) ? productData : productData?.content || [];
				setProducts(list);
				setLabourRates(Array.isArray(labourData) ? labourData : labourData?.content || []);
				let nextProduct = productId;
				if (!nextProduct && revisionId) {
					nextProduct = list.find((item) => item.latestRevisionId === revisionId)?.id || "";
					if (nextProduct) setProductId(nextProduct);
				}
				if (nextProduct) await loadRevisions(nextProduct, revisionId);
				if (revisionId) await loadCosting(revisionId);
			} catch (requestError) {
				setError(cleanError(requestError, "Unable to load Costing Engine."));
			} finally {
				setLoading(false);
			}
		};
		start();
	}, []);

	const loadRevisions = async (id, preferredRevision = "") => {
		if (!id) {
			setRevisions([]);
			return;
		}
		const data = await bomFlowApi.listProductRevisions(id);
		const list = Array.isArray(data) ? data : data?.content || [];
		setRevisions(list);
		if (!preferredRevision && list[0]?.id) {
			setRevisionId(list[0].id);
			setSearchParams({ productId: id, revisionId: list[0].id });
			await loadCosting(list[0].id);
		}
	};

	const loadCosting = async (id, compareId = null) => {
		if (!id) {
			setCosting(null);
			setSettings(null);
			setIntelligence(null);
			setCompareRevisionId("");
			return;
		}

		const [data, revisionIntel] = await Promise.all([
			bomFlowApi.getCosting(id),
			bomFlowApi.getRevisionIntelligence(id, compareId),
		]);

		setCosting(data);
		setIntelligence(revisionIntel);
		setCompareRevisionId(revisionIntel?.previousRevisionId || "");
		setSettings({
			markupPercent: String(data?.settings?.markupPercent ?? 5),
			factoryFixedOverheadPercent: String(data?.settings?.factoryFixedOverheadPercent ?? 40),
			factoryVariableOverheadPercent: String(data?.settings?.factoryVariableOverheadPercent ?? 10),
			adminOverheadPercent: String(data?.settings?.adminOverheadPercent ?? 0),
			sellingOverheadPercent: String(data?.settings?.sellingOverheadPercent ?? 0),
			profitPercent: String(data?.settings?.profitPercent ?? 0),
			franchisePercent: String(data?.settings?.franchisePercent ?? 0),
			gstPercent: String(data?.settings?.gstPercent ?? 18),
			roundOff: Boolean(data?.settings?.roundOff),
			rowVersion: data?.settings?.rowVersion ?? null,
		});
	};

	const selectProduct = async (id) => {
		setProductId(id);
		setRevisionId("");
		setCosting(null);
		setIntelligence(null);
		setCompareRevisionId("");
		setError("");
		if (!id) {
			setRevisions([]);
			setSearchParams({});
			return;
		}
		setWorking(true);
		try {
			await loadRevisions(id);
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to load product revisions."));
		} finally {
			setWorking(false);
		}
	};

	const selectRevision = async (id) => {
		setRevisionId(id);
		setCompareRevisionId("");
		if (!id) {
			setCosting(null);
			setIntelligence(null);
			return;
		}
		setSearchParams({ productId, revisionId: id });
		setWorking(true);
		setError("");
		try {
			await loadCosting(id);
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to load costing."));
		} finally {
			setWorking(false);
		}
	};

	const selectComparison = async (id) => {
		if (!revisionId) return;
		setCompareRevisionId(id);
		setWorking(true);
		setError("");
		try {
			const data = await bomFlowApi.getRevisionIntelligence(revisionId, id || null);
			setIntelligence(data);
			setCompareRevisionId(data?.previousRevisionId || "");
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to compare revisions."));
		} finally {
			setWorking(false);
		}
	};

	const refreshCurrent = async () => {
		if (!revisionId) return;
		await loadCosting(revisionId, compareRevisionId || null);
	};

	const createCostRevision = async () => {
		if (!productId || !costing?.revisionId || !canEdit) return;
		setWorking(true);
		setError("");
		setMessage("");
		try {
			const revision = await bomFlowApi.createRevision(productId, {
				remarks: "Cost revision created from the latest product cost snapshot",
			});
			if (!revision?.id) throw new Error("New revision ID was not returned.");
			await loadRevisions(productId, revision.id);
			setRevisionId(revision.id);
			setSearchParams({ productId, revisionId: revision.id });
			await loadCosting(revision.id);
			setMessage(`R${revision.revisionNo || revision.revisionNumber || "new"} created from the latest product cost snapshot. Change only the material, labour or commercial assumptions that actually changed.`);
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to create cost revision."));
		} finally {
			setWorking(false);
		}
	};

	const saveSettings = async () => {
		if (!revisionId || !settings) return;
		setWorking(true);
		setError("");
		try {
			await bomFlowApi.saveCostingSettings(revisionId, {
				...settings,
				markupPercent: Number(settings.markupPercent || 0),
				factoryFixedOverheadPercent: Number(settings.factoryFixedOverheadPercent || 0),
				factoryVariableOverheadPercent: Number(settings.factoryVariableOverheadPercent || 0),
				adminOverheadPercent: Number(settings.adminOverheadPercent || 0),
				sellingOverheadPercent: Number(settings.sellingOverheadPercent || 0),
				profitPercent: Number(settings.profitPercent || 0),
				franchisePercent: Number(settings.franchisePercent || 0),
				gstPercent: Number(settings.gstPercent || 0),
			});
			setMessage("Costing settings saved. Revision variance has been recalculated.");
			await refreshCurrent();
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to save costing settings."));
		} finally {
			setWorking(false);
		}
	};

	const applyRates = async () => {
		if (!revisionId) return;
		setWorking(true);
		setError("");
		try {
			const result = await bomFlowApi.applyMaterialRates(revisionId);
			setMessage(result?.message || "Rate Master applied.");
			await refreshCurrent();
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to apply material rates."));
		} finally {
			setWorking(false);
		}
	};

	const selectLabourMaster = (rateId) => {
		const master = labourRates.find((item) => item.id === rateId);
		const basis = master?.basis || "PER_HOUR";
		setLabourDialog((prev) => ({
			...prev,
			form: {
				...prev.form,
				labourRateId: rateId,
				basis,
				unit: master?.unit || labourBasisUnit(basis),
				labourCount: String(master?.defaultLabourCount ?? 1),
				rate: String(master?.rate ?? ""),
				workingHours: String(master?.defaultWorkingHours ?? ""),
				quantity: prev.form.quantity || (basis === "PER_ITEM" ? "1" : ""),
			},
		}));
	};

	const syncLabourMaster = async () => {
		if (!revisionId) return;
		setWorking(true);
		setError("");
		setMessage("");
		try {
			const result = await bomFlowApi.syncCostingLabourMaster(revisionId);
			setMessage(result?.message || "Labour Master synchronized.");
			await refreshCurrent();
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to sync Labour Master."));
		} finally {
			setWorking(false);
		}
	};

	const openNewLabour = () => {
		setLabourDialog({ open: true, editing: null, form: { ...LABOUR_LINE_EMPTY } });
	};

	const openEditLabour = (line) => {
		setLabourDialog({
			open: true,
			editing: line,
			form: {
				labourRateId: line?.labourRateId || "",
				basis: line?.basis || "PER_HOUR",
				unit: line?.unit || labourBasisUnit(line?.basis),
				labourCount: String(line?.labourCount ?? ""),
				workingHours: String(line?.workingHours ?? ""),
				quantity: String(line?.quantity ?? ""),
				rate: String(line?.rate ?? ""),
				remarks: line?.remarks || "",
				rowVersion: line?.rowVersion ?? null,
			},
		});
	};

	const saveLabour = async () => {
		const form = labourDialog.form;
		if (!revisionId || !form.labourRateId) {
			setError("Select a Labour Master process.");
			return;
		}
		if (!form.basis) {
			setError("Select a labour costing basis.");
			return;
		}
		setWorking(true);
		setError("");
		setMessage("");
		try {
			const payload = {
				labourRateId: form.labourRateId,
				basis: form.basis,
				unit: String(form.unit || labourBasisUnit(form.basis)).trim().toUpperCase(),
				labourCount: Number(form.labourCount || 0),
				workingHours: Number(form.workingHours || 0),
				quantity: Number(form.quantity || 0),
				rate: form.rate === "" ? null : Number(form.rate),
				remarks: form.remarks.trim() || null,
				rowVersion: form.rowVersion ?? null,
			};

			if (labourDialog.editing?.id) {
				await bomFlowApi.updateCostingLabourLine(revisionId, labourDialog.editing.id, payload);
				setMessage("Labour process updated. Cost and revision variance recalculated.");
			} else {
				await bomFlowApi.addCostingLabourLine(revisionId, payload);
				setMessage("Labour process added to this revision.");
			}

			setLabourDialog({ open: false, editing: null, form: { ...LABOUR_LINE_EMPTY } });
			await refreshCurrent();
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to save labour line."));
		} finally {
			setWorking(false);
		}
	};

	const deleteLabour = async (line) => {
		setWorking(true);
		setError("");
		try {
			await bomFlowApi.deleteCostingLabourLine(revisionId, line.id, line.rowVersion);
			await refreshCurrent();
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to remove labour line."));
		} finally {
			setWorking(false);
		}
	};

	if (loading) return <Loading />;

	const revisionStatus = String(costing?.revisionStatus || "").toUpperCase();
	const materialEditable = canEdit && ["DRAFT", "RETURNED"].includes(revisionStatus);
	const commercialEditable = canEdit && !["CANCELLED", "SUPERSEDED"].includes(revisionStatus);
	const commercialLocked = Boolean(costing) && !commercialEditable;

	return (
		<Box sx={pageSx}>
			<ModuleHero
				chip="COSTING ENGINE"
				title="Product Costing & Revision Intelligence"
				subtitle="Calculate live material, labour, overhead and selling economics, then measure exactly what changed between product cost revisions and how that change affects profit and price."
				icon={<CalculateOutlinedIcon />}
				actions={revisionId ? <Button startIcon={<AssessmentOutlinedIcon />} onClick={() => navigate(`/bomflow/reports?productId=${productId}&revisionId=${revisionId}`)} sx={secondaryBtnSx}>Reports</Button> : null}
			/>

			<Feedback error={error} message={message} />

			{costing && canEdit && ["SUBMITTED", "VERIFIED", "APPROVED", "RELEASED"].includes(revisionStatus) && (
				<Box sx={infoSx}>
					<CheckCircleOutlineIcon fontSize="small" />
					BOM revision {costing.revisionStatus}: material structure/rates remain workflow-controlled; revision-specific labour and commercial settings stay audit-tracked so costing can be analysed without altering the approved BOM structure.
				</Box>
			)}

			{costing && commercialLocked && (
				<Box sx={warningSx}>
					<WarningAmberOutlinedIcon fontSize="small" />
					This {costing.revisionStatus} revision is fully read-only for commercial costing.
				</Box>
			)}

			<Card sx={selectorCardSx}>
				<TextField select label="Product" value={productId} onChange={(e) => selectProduct(e.target.value)} sx={fieldSx}>
					<MenuItem value="">Select product</MenuItem>
					{products.map((product) => <MenuItem key={product.id} value={product.id}>{product.productName} • {product.productCode || "NO CODE"}</MenuItem>)}
				</TextField>
				<TextField select label="BOM Revision" value={revisionId} onChange={(e) => selectRevision(e.target.value)} disabled={!productId} sx={fieldSx}>
					<MenuItem value="">Select revision</MenuItem>
					{revisions.map((revision) => <MenuItem key={revision.id} value={revision.id}>R{revision.revisionNo || revision.revisionNumber} • {revision.status}</MenuItem>)}
				</TextField>
				{revisionId && <Button startIcon={<RuleOutlinedIcon />} onClick={() => navigate(`/bomflow/revisions/${revisionId}`)} sx={secondaryBtnSx}>Open BOM</Button>}
				{costing && canEdit && !["DRAFT", "RETURNED"].includes(revisionStatus) && <Button startIcon={<AddIcon />} disabled={working} onClick={createCostRevision} sx={secondaryBtnSx}>New Cost Revision</Button>}
				{revisionId && materialEditable && <Button startIcon={<SyncOutlinedIcon />} disabled={working} onClick={applyRates} sx={primaryBtnSx}>Sync Rates</Button>}
			</Card>

			{!costing ? (
				<Card sx={emptyPanelSx}><CalculateOutlinedIcon sx={{ fontSize: 42, color: "#64748b" }} /><Typography sx={emptyTitleSx}>Select a product and BOM revision</Typography><Typography sx={emptySubSx}>Costing and revision intelligence will load from the selected product version.</Typography></Card>
			) : (
				<>
					<Box sx={summaryGridSx}>
						<SummaryCard title="Direct Material" value={money(costing.directMaterial)} accent="#60a5fa" />
						<SummaryCard title="Direct Labour" value={money(costing.directLabour)} accent="#a855f7" />
						<SummaryCard title="Cost / Product" value={money(costing.costPerProduct)} accent="#f59e0b" />
						<SummaryCard title="MRP" value={money(costing.mrp)} accent="#22c55e" />
					</Box>

					<RevisionIntelligencePanel
						intelligence={intelligence}
						revisions={revisions}
						currentRevisionId={revisionId}
						compareRevisionId={compareRevisionId}
						onCompare={selectComparison}
						working={working}
					/>

					{costing.missingMaterialRates > 0 && (
						<Box sx={warningSx}><WarningAmberOutlinedIcon fontSize="small" />{costing.missingMaterialRates} BOM material row(s) still have missing rates.</Box>
					)}

					<Box sx={costingGridSx}>
						<Card sx={panelSx}>
							<Box sx={panelHeaderSx}><Box><Typography sx={panelTitleSx}>Cost Build-Up</Typography><Typography sx={panelSubSx}>Live calculation from material, labour and percentage settings.</Typography></Box><CalculateOutlinedIcon sx={{ color: "#93c5fd" }} /></Box>
							<CostRows costing={costing} />
						</Card>

						<Card sx={panelSx}>
							<Box sx={panelHeaderSx}><Box><Typography sx={panelTitleSx}>Costing Settings</Typography><Typography sx={panelSubSx}>Revision-specific commercial assumptions. Changes immediately flow into revision variance and profit impact.</Typography></Box>{commercialEditable && <Button disabled={working} onClick={saveSettings} sx={primaryBtnSx}>Save Settings</Button>}</Box>
							{settings && <CostingSettingsForm settings={settings} setSettings={setSettings} disabled={!commercialEditable || working} />}
						</Card>
					</Box>

					<Card sx={panelSx}>
						<Box sx={panelHeaderSx}><Box><Typography sx={panelTitleSx}>Direct Material</Typography><Typography sx={panelSubSx}>Snapshot of material quantity, rate and processing cost for this revision.</Typography></Box><Chip label={`${costing.materialItemCount} items`} sx={countChipSx} /></Box>
						<Box sx={tableScrollSx}>
							<Box sx={materialHeadSx}><div>Item</div><div>Section</div><div>Qty</div><div>Rate</div><div>Material</div><div>Processing</div><div>Total</div></Box>
							{materialPager.pageItems.map((row) => <Box key={row.id} sx={materialRowSx}><Box><Typography sx={cellStrongSx}>{row.itemName}</Typography><Typography sx={mutedTextSx}>{row.brand || row.vendorName || "-"}</Typography></Box><Typography sx={cellTextSx}>{row.section}</Typography><Typography sx={monoTextSx}>{decimal(row.quantity)} {row.unit}</Typography><Typography sx={moneyTextSx}>{money(row.rate)}</Typography><Typography sx={cellTextSx}>{money(row.materialAmount)}</Typography><Typography sx={cellTextSx}>{money(row.processingAmount)}</Typography><Typography sx={moneyTextSx}>{money(row.totalAmount)}</Typography></Box>)}
						</Box>
						<BOMFlowPagination
							page={materialPager.page}
							pageCount={materialPager.pageCount}
							pageSize={materialPager.pageSize}
							total={materialPager.total}
							from={materialPager.from}
							to={materialPager.to}
							onPageChange={materialPager.setPage}
							onPageSizeChange={materialPager.setPageSize}
							label="material lines"
							pageSizeOptions={[5, 8, 15, 25]}
							compact
						/>
					</Card>

					<Card sx={panelSx}>
						<Box sx={panelHeaderSx}>
							<Box>
								<Typography sx={panelTitleSx}>Direct Labour</Typography>
								<Typography sx={panelSubSx}>Revision-specific process costing. Basis, quantity, labour count, hours, unit and rate can all be overridden for the selected product version.</Typography>
							</Box>
							{commercialEditable && (
								<Box sx={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
									<Button startIcon={<SyncOutlinedIcon />} disabled={working || labourRates.length === 0} onClick={syncLabourMaster} sx={secondaryBtnSx}>Sync Labour Master</Button>
									<Button startIcon={<AddIcon />} disabled={working} onClick={openNewLabour} sx={primaryBtnSx}>Add Process</Button>
								</Box>
							)}
						</Box>

						{commercialEditable && labourRates.length > 0 && costing.labourLines.length === 0 && (
							<Box sx={labourHintSx}><EngineeringOutlinedIcon fontSize="small" />{labourRates.length} active Labour Master rate(s) are available. Sync imports applicable processes, after which basis/quantity/time can be adjusted for this revision.</Box>
						)}

						<Box sx={tableScrollSx}>
							<Box sx={costLabourHeadSx}><div>Process</div><div>Basis</div><div>Labour</div><div>Hours</div><div>Qty</div><div>Rate</div><div>Amount</div><div /></Box>
							{costingLabourPager.pageItems.map((row) => {
								const incomplete = row.basis === "PER_HOUR"
									? Number(row.workingHours || 0) <= 0 || Number(row.labourCount || 0) <= 0
									: row.basis === "FIXED"
										? false
										: Number(row.quantity || 0) <= 0;

								return (
									<Box key={row.id} sx={costLabourRowSx}>
										<Box><Typography sx={cellStrongSx}>{row.processName}</Typography><Typography sx={mutedTextSx}>{row.department}{incomplete ? " • Input required" : ""}</Typography></Box>
										<Typography sx={cellTextSx}>{row.basis?.replaceAll("_", " ")}</Typography>
										<Typography sx={monoTextSx}>{decimal(row.labourCount)}</Typography>
										<Typography sx={monoTextSx}>{decimal(row.workingHours)}</Typography>
										<Typography sx={monoTextSx}>{decimal(row.quantity)}</Typography>
										<Typography sx={moneyTextSx}>{money(row.rate)}</Typography>
										<Typography sx={{ ...moneyTextSx, color: incomplete ? "#fbbf24" : "#4ade80" }}>{money(row.amount)}</Typography>
										{commercialEditable ? <Box sx={{ display: "flex", gap: "4px" }}><IconButton disabled={working} onClick={() => openEditLabour(row)} sx={editBtnSx}><EditOutlinedIcon fontSize="small" /></IconButton><IconButton disabled={working} onClick={() => deleteLabour(row)} sx={deleteBtnSx}><DeleteOutlineIcon fontSize="small" /></IconButton></Box> : <Box />}
									</Box>
								);
							})}
							{costing.labourLines.length === 0 && <EmptyTable text="No labour processes are linked yet. Use Sync Labour Master or Add Process." />}
						</Box>
						<BOMFlowPagination
							page={costingLabourPager.page}
							pageCount={costingLabourPager.pageCount}
							pageSize={costingLabourPager.pageSize}
							total={costingLabourPager.total}
							from={costingLabourPager.from}
							to={costingLabourPager.to}
							onPageChange={costingLabourPager.setPage}
							onPageSizeChange={costingLabourPager.setPageSize}
							label="labour lines"
							pageSizeOptions={[5, 8, 15, 25]}
							compact
						/>
					</Card>
				</>
			)}

			<LabourLineDialog open={labourDialog.open} editing={labourDialog.editing} form={labourDialog.form} setDialog={setLabourDialog} labourRates={labourRates} onSelectMaster={selectLabourMaster} onSave={saveLabour} working={working} />
		</Box>
	);
}

function RevisionIntelligencePanel({ intelligence, revisions, currentRevisionId, compareRevisionId, onCompare, working }) {
	const history = intelligence?.history || [];
	const historyPager = useBomFlowPagination(history, {
		initialPageSize: 5,
		resetKey: `${currentRevisionId || ""}|${compareRevisionId || ""}`,
	});

	if (!intelligence) return null;

	const materialChanges = intelligence.materialChanges || [];
	const labourChanges = intelligence.labourChanges || [];
	const hasPrevious = Boolean(intelligence.hasPreviousRevision);
	const costDelta = Number(intelligence.costPerProductDelta || 0);
	const directionColor = costDelta > 0 ? "#f87171" : costDelta < 0 ? "#4ade80" : "#93c5fd";

	return (
		<Card sx={{ ...panelSx, border: `1px solid ${directionColor}33`, background: `linear-gradient(180deg, ${directionColor}0D, rgba(15,23,42,.82))` }}>
			<Box sx={panelHeaderSx}>
				<Box>
					<Box sx={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
						<InsightsOutlinedIcon sx={{ color: directionColor }} />
						<Typography sx={panelTitleSx}>Revision Intelligence</Typography>
						<Chip label={hasPrevious ? `${intelligence.overallDirection} VS R${intelligence.previousRevisionNo}` : "BASELINE REVISION"} size="small" sx={{ ...countChipSx, color: directionColor, borderColor: `${directionColor}55`, background: `${directionColor}16` }} />
					</Box>
					<Typography sx={panelSubSx}>Track material, labour, product-cost, selling-price and margin movement across BOM versions. Positive cost variance means the product became more expensive to manufacture.</Typography>
				</Box>
				{revisions.length > 1 && (
					<TextField select label="Compare R" value={compareRevisionId || ""} onChange={(e) => onCompare(e.target.value)} disabled={working} sx={{ ...fieldSx, minWidth: 210 }}>
						<MenuItem value="">Auto previous revision</MenuItem>
						{revisions.filter((item) => item.id !== currentRevisionId).map((revision) => <MenuItem key={revision.id} value={revision.id}>R{revision.revisionNo || revision.revisionNumber} • {revision.status}</MenuItem>)}
					</TextField>
				)}
			</Box>

			{!hasPrevious ? (
				<Box sx={labourHintSx}><TimelineOutlinedIcon fontSize="small" />This is the product cost baseline. Create the next revision to measure material, labour, overhead, price and profit movement against it.</Box>
			) : (
				<>
					<Box sx={revisionKpiGridSx}>
						<VarianceKpi label="Cost / Product Δ" value={signedMoney(intelligence.costPerProductDelta)} rawValue={intelligence.costPerProductDelta} hint={signedPercent(intelligence.costPerProductDeltaPercent)} badWhenPositive accent={directionColor} />
						<VarianceKpi label="Material Δ" value={signedMoney(intelligence.directMaterialDelta)} rawValue={intelligence.directMaterialDelta} hint="Material + processing movement" badWhenPositive />
						<VarianceKpi label="Labour Δ" value={signedMoney(intelligence.directLabourDelta)} rawValue={intelligence.directLabourDelta} hint="Revision-specific labour movement" badWhenPositive />
						<VarianceKpi label="Profit Impact @ Old Price" value={signedMoney(intelligence.profitImpactAtPreviousPrice)} rawValue={intelligence.profitImpactAtPreviousPrice} hint={intelligence.marginAtPreviousPricePercent == null ? "No previous price baseline" : `${Number(intelligence.marginAtPreviousPricePercent).toFixed(2)}% margin at previous ex-factory`} badWhenPositive={false} />
						<VarianceKpi label="Required Ex-Factory Δ" value={signedMoney(intelligence.requiredExFactoryIncrease)} rawValue={intelligence.requiredExFactoryIncrease} hint="Price movement to retain configured economics" badWhenPositive />
						<VarianceKpi label="MRP Δ" value={signedMoney(intelligence.mrpDelta)} rawValue={intelligence.mrpDelta} hint={signedPercent(intelligence.mrpDeltaPercent)} badWhenPositive />
					</Box>

					<Box sx={revisionDetailGridSx}>
						<Box sx={variancePanelSx}>
							<Typography sx={varianceTitleSx}>Material Change Drivers</Typography>
							{materialChanges.length === 0 ? <Typography sx={varianceEmptySx}>No material cost/quantity/rate change versus the comparison revision.</Typography> : materialChanges.slice(0, 8).map((row) => <VarianceDriver key={row.key} title={row.itemName} subtitle={`${row.section} • ${row.changeType} • Qty ${decimal(row.previousQuantity)} → ${decimal(row.currentQuantity)} • Rate ${money(row.previousRate)} → ${money(row.currentRate)}`} delta={row.deltaAmount} />)}
						</Box>
						<Box sx={variancePanelSx}>
							<Typography sx={varianceTitleSx}>Labour Change Drivers</Typography>
							{labourChanges.length === 0 ? <Typography sx={varianceEmptySx}>No labour cost/basis/time/quantity change versus the comparison revision.</Typography> : labourChanges.slice(0, 8).map((row) => <VarianceDriver key={row.key} title={`${row.department} • ${row.processName}`} subtitle={`${row.changeType} • ${(row.previousBasis || "-").replaceAll("_", " ")} → ${(row.currentBasis || "-").replaceAll("_", " ")} • Hrs ${decimal(row.previousWorkingHours)} → ${decimal(row.currentWorkingHours)} • Qty ${decimal(row.previousQuantity)} → ${decimal(row.currentQuantity)}`} delta={row.deltaAmount} />)}
						</Box>
					</Box>
				</>
			)}

			{history.length > 0 && (
				<Box sx={{ mt: "14px" }}>
					<Typography sx={varianceTitleSx}>Product Cost History</Typography>
					<Box sx={historyScrollSx}>
						<Box sx={historyHeadSx}><div>Revision</div><div>Status</div><div>Material</div><div>Labour</div><div>Cost / Product</div><div>Profit</div><div>Ex-Factory</div><div>MRP</div></Box>
						{historyPager.pageItems.map((row) => <Box key={row.revisionId} sx={{ ...historyRowSx, ...(row.revisionId === currentRevisionId ? historyCurrentRowSx : {}) }}><div>R{row.revisionNo}</div><div>{row.status}</div><div>{money(row.directMaterial)}</div><div>{money(row.directLabour)}</div><div>{money(row.costPerProduct)}</div><div>{money(row.profitAmount)}</div><div>{money(row.exFactory)}</div><div>{money(row.mrp)}</div></Box>)}
					</Box>
					<BOMFlowPagination
						page={historyPager.page}
						pageCount={historyPager.pageCount}
						pageSize={historyPager.pageSize}
						total={historyPager.total}
						from={historyPager.from}
						to={historyPager.to}
						onPageChange={historyPager.setPage}
						onPageSizeChange={historyPager.setPageSize}
						label="cost revisions"
						pageSizeOptions={[5, 10, 20]}
						compact
					/>
				</Box>
			)}
		</Card>
	);
}

function VarianceKpi({ label, value, rawValue = 0, hint, badWhenPositive = true, accent }) {
	const numeric = Number(rawValue || 0);
	const positive = numeric > 0;
	const negative = numeric < 0;
	const tone = accent || (positive ? (badWhenPositive ? "#f87171" : "#4ade80") : negative ? (badWhenPositive ? "#4ade80" : "#f87171") : "#93c5fd");
	return <Box sx={{ ...varianceKpiSx, borderColor: `${tone}33` }}><Typography sx={varianceKpiLabelSx}>{label}</Typography><Typography sx={{ ...varianceKpiValueSx, color: tone }}>{value}</Typography><Typography sx={varianceKpiHintSx}>{hint}</Typography></Box>;
}

function VarianceDriver({ title, subtitle, delta }) {
	const number = Number(delta || 0);
	const tone = number > 0 ? "#f87171" : number < 0 ? "#4ade80" : "#93c5fd";
	return <Box sx={varianceDriverSx}><Box sx={{ minWidth: 0 }}><Typography sx={cellStrongSx}>{title}</Typography><Typography sx={mutedTextSx}>{subtitle}</Typography></Box><Typography sx={{ ...moneyTextSx, color: tone, whiteSpace: "nowrap" }}>{signedMoney(delta)}</Typography></Box>;
}

function CostingSettingsForm({ settings, setSettings, disabled }) {
	const update = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));
	const fields = [
		["markupPercent", "Mark-up %"],
		["factoryFixedOverheadPercent", "Factory Fixed OH %"],
		["factoryVariableOverheadPercent", "Factory Variable OH %"],
		["adminOverheadPercent", "Admin OH %"],
		["sellingOverheadPercent", "Selling OH %"],
		["profitPercent", "Profit %"],
		["franchisePercent", "Franchise %"],
		["gstPercent", "GST %"],
	];
	return (
		<Box sx={formGrid2Sx}>
			{fields.map(([key, label]) => <TextField key={key} type="number" label={label} value={settings[key]} disabled={disabled} onChange={(e) => update(key, e.target.value)} sx={fieldSx} />)}
			<FormControlLabel control={<Switch checked={settings.roundOff} disabled={disabled} onChange={(e) => update("roundOff", e.target.checked)} />} label="Round final MRP" sx={switchLabelSx} />
		</Box>
	);
}

function LabourLineDialog({ open, editing, form, setDialog, labourRates, onSelectMaster, onSave, working }) {
	const master = labourRates.find((item) => item.id === form.labourRateId);
	const update = (key, value) => setDialog((prev) => ({ ...prev, form: { ...prev.form, [key]: value } }));
	const changeBasis = (value) => setDialog((prev) => ({
		...prev,
		form: {
			...prev.form,
			basis: value,
			unit: labourBasisUnit(value, prev.form.unit),
		},
	}));
	const basis = form.basis || master?.basis || "PER_HOUR";
	const formula = basis === "PER_HOUR"
		? "Amount = Labour Count × Working Hours × Rate. Quantity is available for productivity/reference tracking."
		: basis === "FIXED"
			? "Amount = Fixed Rate. Quantity can still be recorded for reference."
			: "Amount = Quantity × Rate.";

	return (
		<Dialog open={open} onClose={() => !working && setDialog({ open: false, editing: null, form: { ...LABOUR_LINE_EMPTY } })} fullWidth maxWidth="md" PaperProps={{ sx: dialogPaperSx }}>
			<DialogTitle sx={dialogTitleSx}>{editing ? "Edit Revision Labour Process" : "Add Revision Labour Process"}</DialogTitle>
			<DialogContent sx={dialogContentSx}>
				<Box sx={labourHintSx}><CalculateOutlinedIcon fontSize="small" />Labour Master provides the default process/rate. Basis, unit, labour count, hours, quantity and rate below are revision-specific and intentionally editable.</Box>
				<Box sx={{ ...formGrid2Sx, mt: 2 }}>
					<TextField select label="Labour Master Process *" value={form.labourRateId} onChange={(e) => onSelectMaster(e.target.value)} sx={fieldSx}>
						<MenuItem value="">Select process</MenuItem>
						{labourRates.map((row) => <MenuItem key={row.id} value={row.id}>{row.department} • {row.processName} • {money(row.rate)} / {row.unit}</MenuItem>)}
					</TextField>
					<TextField select label="Costing Basis *" value={basis} onChange={(e) => changeBasis(e.target.value)} sx={fieldSx}>{BASIS_OPTIONS.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
					<TextField label="Unit *" value={form.unit || labourBasisUnit(basis, master?.unit)} onChange={(e) => update("unit", e.target.value)} sx={fieldSx} />
					<TextField type="number" label="Rate" value={form.rate} onChange={(e) => update("rate", e.target.value)} sx={fieldSx} />
					<TextField type="number" label="Labour Count" value={form.labourCount} onChange={(e) => update("labourCount", e.target.value)} inputProps={{ min: 0, step: "0.001" }} sx={fieldSx} />
					<TextField type="number" label="Working Hours" value={form.workingHours} onChange={(e) => update("workingHours", e.target.value)} inputProps={{ min: 0, step: "0.001" }} sx={fieldSx} />
					<TextField type="number" label="Quantity" value={form.quantity} onChange={(e) => update("quantity", e.target.value)} inputProps={{ min: 0, step: "0.001" }} sx={fieldSx} />
				</Box>
				<Typography sx={{ ...panelSubSx, mt: 1.2, color: "#93c5fd" }}>{formula}</Typography>
				<TextField fullWidth multiline minRows={2} label="Remarks / reason for revision labour change" value={form.remarks} onChange={(e) => update("remarks", e.target.value)} sx={{ ...fieldSx, mt: 2 }} />
			</DialogContent>
			<DialogActions sx={dialogActionsSx}><Button disabled={working} onClick={() => setDialog({ open: false, editing: null, form: { ...LABOUR_LINE_EMPTY } })} sx={secondaryBtnSx}>Cancel</Button><Button disabled={working || !form.labourRateId || !basis} onClick={onSave} sx={primaryBtnSx}>{working ? "Saving..." : editing ? "Save Labour" : "Add Process"}</Button></DialogActions>
		</Dialog>
	);
}

function CostRows({ costing }) {
	const rows = [
		["Direct Material", costing.directMaterial],
		["Direct Labour", costing.directLabour],
		["Direct Cost", costing.directCost, true],
		["Mark-up", costing.markupAmount],
		["Prime Cost", costing.primeCost, true],
		["Factory Fixed Overhead", costing.factoryFixedOverhead],
		["Factory Variable Overhead", costing.factoryVariableOverhead],
		["Factory Cost", costing.factoryCost, true],
		["Admin Overhead", costing.adminOverhead],
		["Selling Overhead", costing.sellingOverhead],
		["Cost / Product", costing.costPerProduct, true],
		["Profit", costing.profitAmount],
		["Ex-Factory", costing.exFactory, true],
		["Franchise", costing.franchiseAmount],
		["Taxable Value", costing.taxableValue],
		["GST", costing.gstAmount],
		["MRP", costing.mrp, true, true],
	];
	return <Box sx={costRowsSx}>{rows.map(([label, value, strong, hero]) => <Box key={label} sx={{ ...costRowSx, ...(strong ? costStrongRowSx : {}), ...(hero ? costHeroRowSx : {}) }}><Typography sx={{ ...costLabelSx, ...(strong ? { color: "#fff" } : {}) }}>{label}</Typography><Typography sx={{ ...costValueSx, ...(hero ? { color: "#4ade80", fontSize: 20 } : {}) }}>{money(value)}</Typography></Box>)}</Box>;
}

/* ========================================================================
   REPORTS
   ======================================================================== */

function ReportsWorkspace() {
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const [products, setProducts] = useState([]);
	const [revisions, setRevisions] = useState([]);
	const [productId, setProductId] = useState(searchParams.get("productId") || "");
	const [revisionId, setRevisionId] = useState(searchParams.get("revisionId") || "");
	const [costing, setCosting] = useState(null);
	const [loading, setLoading] = useState(true);
	const [working, setWorking] = useState("");
	const [error, setError] = useState("");

	useEffect(() => {
		const start = async () => {
			setLoading(true);
			try {
				const data = await bomFlowApi.listProducts();
				const list = Array.isArray(data) ? data : data?.content || [];
				setProducts(list);
				if (productId) {
					const revisionData = await bomFlowApi.listProductRevisions(productId);
					setRevisions(Array.isArray(revisionData) ? revisionData : revisionData?.content || []);
				}
				if (revisionId) setCosting(await bomFlowApi.getCosting(revisionId));
			} catch (requestError) {
				setError(cleanError(requestError, "Unable to load Reports."));
			} finally {
				setLoading(false);
			}
		};
		start();
	}, []);

	const selectProduct = async (id) => {
		setProductId(id);
		setRevisionId("");
		setCosting(null);
		setError("");
		if (!id) { setRevisions([]); setSearchParams({}); return; }
		try {
			const data = await bomFlowApi.listProductRevisions(id);
			const list = Array.isArray(data) ? data : data?.content || [];
			setRevisions(list);
			if (list[0]?.id) await selectRevision(list[0].id, id);
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to load revisions."));
		}
	};

	const selectRevision = async (id, selectedProductId = productId) => {
		setRevisionId(id);
		if (!id) { setCosting(null); return; }
		setSearchParams({ productId: selectedProductId, revisionId: id });
		try {
			setCosting(await bomFlowApi.getCosting(id));
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to build report preview."));
		}
	};

	const download = async (type, fallback) => {
		if (!revisionId) return;
		setWorking(type);
		setError("");
		try {
			const result = await bomFlowApi.downloadCommercialReport(revisionId, type);
			downloadBlob(result?.blob, fallback);
		} catch (requestError) {
			setError(cleanError(requestError, "Unable to download report."));
		} finally {
			setWorking("");
		}
	};

	if (loading) return <Loading />;

	return (
		<Box sx={pageSx} className="bomflow-report-root">
			<style>{`
				@media print {
					.bomflow-sidebar, .bomflow-main-header { display: none !important; }
					.bomflow-shell, .bomflow-main, .bomflow-content-shell {
						background: #fff !important;
						min-height: auto !important;
						overflow: visible !important;
					}
					.bomflow-content-shell { padding: 0 !important; }
					body { background: #fff !important; }
				}
			`}</style>
			<ModuleHero chip="REPORTS" title="BOMFlow Report Center" subtitle="Preview product costing, download an editable Excel workbook or CSV detail reports, and use Print / Save PDF for the formatted report preview." icon={<AssessmentOutlinedIcon />} />
			<Feedback error={error} />

			<Card sx={{ ...selectorCardSx, "@media print": { display: "none" } }}>
				<TextField select label="Product" value={productId} onChange={(e) => selectProduct(e.target.value)} sx={fieldSx}><MenuItem value="">Select product</MenuItem>{products.map((product) => <MenuItem key={product.id} value={product.id}>{product.productName} • {product.productCode || "NO CODE"}</MenuItem>)}</TextField>
				<TextField select label="Revision" value={revisionId} onChange={(e) => selectRevision(e.target.value)} disabled={!productId} sx={fieldSx}><MenuItem value="">Select revision</MenuItem>{revisions.map((revision) => <MenuItem key={revision.id} value={revision.id}>R{revision.revisionNo || revision.revisionNumber} • {revision.status}</MenuItem>)}</TextField>
				<Button startIcon={<PrintOutlinedIcon />} disabled={!costing} onClick={() => window.print()} sx={primaryBtnSx}>Print / Save PDF</Button>
				{revisionId && <Button onClick={() => navigate(`/bomflow/costing?productId=${productId}&revisionId=${revisionId}`)} sx={secondaryBtnSx}>Costing Engine</Button>}
			</Card>

			{costing && (
				<Card sx={{ ...downloadPanelSx, "@media print": { display: "none" } }}>
					<ReportDownload label="Excel Workbook (.xlsx)" busy={working === "workbook"} onClick={() => download("workbook", "BOMFlow_Costing_Workbook.xlsx")} />
					<ReportDownload label="Direct Material CSV" busy={working === "materials"} onClick={() => download("materials", "BOMFlow_Direct_Material.csv")} />
					<ReportDownload label="Direct Labour CSV" busy={working === "labour"} onClick={() => download("labour", "BOMFlow_Direct_Labour.csv")} />
					<ReportDownload label="Costing Summary CSV" busy={working === "costing"} onClick={() => download("costing", "BOMFlow_Costing_Summary.csv")} />
					<ReportDownload label="Change Log CSV" busy={working === "change-log"} onClick={() => download("change-log", "BOMFlow_Change_Log.csv")} />
				</Card>
			)}

			{!costing ? <Card sx={emptyPanelSx}><AssessmentOutlinedIcon sx={{ fontSize: 42, color: "#64748b" }} /><Typography sx={emptyTitleSx}>Select a product and revision</Typography><Typography sx={emptySubSx}>The report preview and download controls will appear here.</Typography></Card> : <PrintableReport costing={costing} />}
		</Box>
	);
}

function ReportDownload({ label, busy, onClick }) {
	return <Button startIcon={<DownloadOutlinedIcon />} disabled={busy} onClick={onClick} sx={secondaryBtnSx}>{busy ? "Preparing..." : label}</Button>;
}

function PrintableReport({ costing }) {
	return (
		<Box sx={reportPaperSx}>
			<Box sx={reportHeaderSx}>
				<Box><Typography sx={reportBrandSx}>ALSORG</Typography><Typography sx={reportSubSx}>BOMFlow Product Costing Report</Typography></Box>
				<Box sx={{ textAlign: "right" }}><Typography sx={reportTitleSx}>{costing.productName}</Typography><Typography sx={reportMetaSx}>{costing.productCode || "NO CODE"} • Revision {costing.revisionNo} • {costing.revisionStatus}</Typography></Box>
			</Box>

			<Box sx={reportMetaGridSx}><ReportMeta label="Project" value={costing.projectReference || "-"} /><ReportMeta label="Client" value={costing.clientEntity || "-"} /><ReportMeta label="Material Items" value={costing.materialItemCount} /><ReportMeta label="Labour Processes" value={costing.labourLineCount} /></Box>

			<Box sx={reportSummaryGridSx}><ReportMetric label="Direct Material" value={money(costing.directMaterial)} /><ReportMetric label="Direct Labour" value={money(costing.directLabour)} /><ReportMetric label="Cost / Product" value={money(costing.costPerProduct)} /><ReportMetric label="MRP" value={money(costing.mrp)} strong /></Box>

			<Typography sx={reportSectionTitleSx}>Cost Build-Up</Typography>
			<Box sx={reportCostGridSx}>
				{[
					["Direct Cost", costing.directCost], ["Markup", costing.markupAmount], ["Prime Cost", costing.primeCost],
					["Factory Fixed OH", costing.factoryFixedOverhead], ["Factory Variable OH", costing.factoryVariableOverhead], ["Factory Cost", costing.factoryCost],
					["Admin OH", costing.adminOverhead], ["Selling OH", costing.sellingOverhead], ["Profit", costing.profitAmount],
					["Ex-Factory", costing.exFactory], ["Franchise", costing.franchiseAmount], ["GST", costing.gstAmount],
				].map(([label, value]) => <Box key={label} sx={reportCostCellSx}><Typography sx={reportCostLabelSx}>{label}</Typography><Typography sx={reportCostValueSx}>{money(value)}</Typography></Box>)}
			</Box>

			<Typography sx={reportSectionTitleSx}>Direct Material</Typography>
			<Box sx={reportTableSx}>
				<Box sx={reportMaterialHeadSx}><div>Item</div><div>Section</div><div>Qty</div><div>Rate</div><div>Total</div></Box>
				{costing.materialLines.map((row) => <Box key={row.id} sx={reportMaterialRowSx}><div>{row.itemName}</div><div>{row.section}</div><div>{decimal(row.quantity)} {row.unit}</div><div>{money(row.rate)}</div><div>{money(row.totalAmount)}</div></Box>)}
			</Box>

			<Typography sx={reportSectionTitleSx}>Direct Labour</Typography>
			<Box sx={reportTableSx}>
				<Box sx={reportLabourHeadSx}><div>Department</div><div>Process</div><div>Basis</div><div>Rate</div><div>Amount</div></Box>
				{costing.labourLines.map((row) => <Box key={row.id} sx={reportLabourRowSx}><div>{row.department}</div><div>{row.processName}</div><div>{row.basis?.replaceAll("_", " ")}</div><div>{money(row.rate)}</div><div>{money(row.amount)}</div></Box>)}
				{costing.labourLines.length === 0 && <Box sx={{ p: 1.5, color: "#475569" }}>No direct labour assigned.</Box>}
			</Box>
		</Box>
	);
}

function ReportMeta({ label, value }) { return <Box sx={reportMetaCellSx}><Typography sx={reportCostLabelSx}>{label}</Typography><Typography sx={reportMetaValueSx}>{value}</Typography></Box>; }
function ReportMetric({ label, value, strong }) { return <Box sx={{ ...reportMetricSx, ...(strong ? { borderColor: "#16a34a" } : {}) }}><Typography sx={reportCostLabelSx}>{label}</Typography><Typography sx={{ ...reportMetricValueSx, ...(strong ? { color: "#15803d" } : {}) }}>{value}</Typography></Box>; }

/* ========================================================================
   SHARED COMPONENTS
   ======================================================================== */

function ModuleHero({ chip, title, subtitle, icon, actions }) {
	return (
		<Box sx={heroSx}>
			<Box sx={{ minWidth: 280, flex: 1 }}>
				<Chip label={chip} sx={labelChipSx} />
				<Typography sx={pageTitleSx}>{title}</Typography>
				<Typography sx={pageSubSx}>{subtitle}</Typography>
			</Box>
			<Box sx={heroIconWrapSx}>{icon}</Box>
			{actions && <Box sx={heroActionsSx}>{actions}</Box>}
		</Box>
	);
}

function Feedback({ error, message }) {
	if (!error && !message) return null;
	return <Box sx={error ? errorSx : successSx}>{error || message}</Box>;
}

function SummaryCard({ title, value, accent = "#60a5fa" }) {
	return <Card sx={{ ...summaryCardSx, borderTop: `3px solid ${accent}` }}><Typography sx={summaryTitleSx}>{title}</Typography><Typography sx={summaryValueSx}>{value}</Typography></Card>;
}

function StatusChip({ active }) {
	return <Chip label={active ? "ACTIVE" : "INACTIVE"} size="small" sx={active ? activeChipSx : inactiveChipSx} />;
}

function Loading() {
	return <Box sx={loadingSx}><CircularProgress /></Box>;
}

function EmptyTable({ text }) {
	return <Box sx={emptyTableSx}>{text}</Box>;
}

/* ========================================================================
   STYLES
   ======================================================================== */

const pageSx = { width: "100%", display: "flex", flexDirection: "column", gap: "14px" };
const heroSx = { display: "flex", alignItems: "flex-start", gap: "14px", flexWrap: "wrap", p: "16px", borderRadius: "10px", background: "radial-gradient(circle at top left, rgba(37,99,235,.20), transparent 34%), rgba(15,23,42,.78)", border: "1px solid rgba(255,255,255,.08)", boxShadow: "0 16px 32px rgba(2,6,23,.24)" };
const heroIconWrapSx = { width: 46, height: 46, borderRadius: "11px", display: "grid", placeItems: "center", color: "#93c5fd", background: "rgba(59,130,246,.12)", border: "1px solid rgba(59,130,246,.24)" };
const heroActionsSx = { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" };
const labelChipSx = { height: 26, borderRadius: 999, background: "rgba(59,130,246,.14)", color: "#60a5fa", border: "1px solid rgba(59,130,246,.24)", fontWeight: 900, fontSize: 11, letterSpacing: ".07em", mb: "10px" };
const pageTitleSx = { color: "#fff", fontSize: { xs: 24, md: 32 }, fontWeight: 950, lineHeight: 1.05, letterSpacing: "-0.04em" };
const pageSubSx = { mt: "8px", color: "rgba(255,255,255,.66)", fontSize: 13, fontWeight: 650, lineHeight: 1.5, maxWidth: 880 };
const panelSx = { p: "15px", borderRadius: "10px", background: "rgba(15,23,42,.78)", border: "1px solid rgba(255,255,255,.07)", boxShadow: "0 14px 28px rgba(2,6,23,.24)" };
const panelHeaderSx = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px", mb: "13px", flexWrap: "wrap" };
const panelTitleSx = { color: "#fff", fontSize: 17, fontWeight: 950 };
const panelSubSx = { mt: "3px", color: "rgba(255,255,255,.52)", fontSize: 11, fontWeight: 650, lineHeight: 1.45 };
const primaryBtnSx = { height: 38, borderRadius: "9px", textTransform: "none", fontWeight: 850, color: "#fff", background: "linear-gradient(135deg,#2563eb,#3b82f6)", boxShadow: "0 10px 22px rgba(37,99,235,.25)", "&:hover": { background: "linear-gradient(135deg,#1d4ed8,#2563eb)" } };
const secondaryBtnSx = { height: 38, borderRadius: "9px", textTransform: "none", fontWeight: 850, color: "#fff", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", "&:hover": { background: "rgba(59,130,246,.12)" } };
const tinyBtnSx = { ...secondaryBtnSx, height: 30, minWidth: 0, px: "8px", fontSize: 10 };
const iconBtnSx = { width: 30, height: 30, borderRadius: "8px", color: "#93c5fd", background: "rgba(59,130,246,.09)", border: "1px solid rgba(59,130,246,.18)" };
const deleteBtnSx = { ...iconBtnSx, color: "#fca5a5", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.18)" };
const fieldSx = { "& .MuiInputLabel-root": { color: "rgba(255,255,255,.56)", fontWeight: 700 }, "& .MuiOutlinedInput-root": { minHeight: 46, color: "#fff", background: "rgba(255,255,255,.04)", borderRadius: "9px", "& fieldset": { borderColor: "rgba(255,255,255,.09)" }, "&:hover fieldset": { borderColor: "rgba(59,130,246,.34)" }, "&.Mui-focused fieldset": { borderColor: "#3b82f6" } }, "& .MuiInputBase-input::placeholder": { color: "rgba(255,255,255,.36)", opacity: 1 }, "& .MuiSvgIcon-root": { color: "#94a3b8" }, "& .MuiInputBase-input.Mui-disabled": { WebkitTextFillColor: "rgba(255,255,255,.55)" } };
const switchLabelSx = { color: "rgba(255,255,255,.72)", m: 0, "& .MuiFormControlLabel-label": { fontSize: 12, fontWeight: 750 } };
const errorSx = { p: "11px 13px", borderRadius: "9px", color: "#fca5a5", background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.24)", fontSize: 12, fontWeight: 750 };
const successSx = { ...errorSx, color: "#86efac", background: "rgba(34,197,94,.10)", border: "1px solid rgba(34,197,94,.22)" };
const warningSx = { ...errorSx, display: "flex", alignItems: "center", gap: "8px", color: "#fbbf24", background: "rgba(245,158,11,.10)", border: "1px solid rgba(245,158,11,.22)" };
const infoSx = { display: "flex", alignItems: "center", gap: "8px", p: "10px 12px", borderRadius: "9px", color: "#93c5fd", background: "rgba(59,130,246,.10)", border: "1px solid rgba(59,130,246,.24)", fontSize: 11.5, fontWeight: 750 };
const revisionKpiGridSx = { display: "grid", gridTemplateColumns: "repeat(6,minmax(0,1fr))", gap: "8px", mt: "14px", "@media (max-width: 1450px)": { gridTemplateColumns: "repeat(3,minmax(0,1fr))" }, "@media (max-width: 780px)": { gridTemplateColumns: "1fr" } };
const varianceKpiSx = { p: "11px", borderRadius: "9px", background: "rgba(2,6,23,.34)", border: "1px solid rgba(255,255,255,.07)", minWidth: 0 };
const varianceKpiLabelSx = { color: "rgba(255,255,255,.48)", fontSize: 9.5, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".05em" };
const varianceKpiValueSx = { mt: "5px", fontSize: 17, fontWeight: 950, fontFamily: "monospace" };
const varianceKpiHintSx = { mt: "4px", color: "rgba(255,255,255,.48)", fontSize: 9.5, fontWeight: 650, lineHeight: 1.35 };
const revisionDetailGridSx = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", mt: "12px", "@media (max-width: 950px)": { gridTemplateColumns: "1fr" } };
const variancePanelSx = { p: "11px", borderRadius: "9px", background: "rgba(2,6,23,.30)", border: "1px solid rgba(255,255,255,.06)" };
const varianceTitleSx = { color: "#fff", fontSize: 12, fontWeight: 900, mb: "7px" };
const varianceEmptySx = { color: "rgba(255,255,255,.46)", fontSize: 10.5, fontWeight: 650, py: "8px" };
const varianceDriverSx = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", py: "8px", borderTop: "1px solid rgba(255,255,255,.05)", "&:first-of-type": { borderTop: 0 } };
const historyScrollSx = {
	overflowX: "auto",
	overflowY: "hidden",
	scrollbarGutter: "stable",
	overscrollBehaviorX: "auto",
	borderRadius: "8px",
	border: "1px solid rgba(255,255,255,.06)",
	pb: "3px",
};
const historyHeadSx = { minWidth: 920, display: "grid", gridTemplateColumns: "80px 130px repeat(6,minmax(120px,1fr))", px: "10px", py: "8px", background: "rgba(2,6,23,.45)", color: "rgba(255,255,255,.48)", fontSize: 9, fontWeight: 900, textTransform: "uppercase" };
const historyRowSx = { minWidth: 920, display: "grid", gridTemplateColumns: "80px 130px repeat(6,minmax(120px,1fr))", px: "10px", py: "9px", color: "rgba(255,255,255,.72)", fontSize: 10.5, fontWeight: 750, borderTop: "1px solid rgba(255,255,255,.05)", "& > div:nth-of-type(n+3)": { fontFamily: "monospace" } };
const historyCurrentRowSx = { background: "rgba(59,130,246,.10)", color: "#fff" };

const labourHintSx = { display: "flex", alignItems: "center", gap: "8px", mb: "10px", p: "9px 10px", borderRadius: "8px", color: "#c4b5fd", background: "rgba(168,85,247,.08)", border: "1px solid rgba(168,85,247,.20)", fontSize: 10.5, fontWeight: 700 };
const editBtnSx = { width: 30, height: 30, borderRadius: "8px", color: "#93c5fd", background: "rgba(59,130,246,.10)", border: "1px solid rgba(59,130,246,.20)" };
const summaryGridSx = { display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: "10px", "@media (max-width: 1000px)": { gridTemplateColumns: "repeat(2,minmax(0,1fr))" }, "@media (max-width: 560px)": { gridTemplateColumns: "1fr" } };
const summaryCardSx = { p: "13px", borderRadius: "10px", background: "rgba(15,23,42,.78)", border: "1px solid rgba(255,255,255,.07)" };
const summaryTitleSx = { color: "rgba(255,255,255,.55)", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".07em" };
const summaryValueSx = { mt: "5px", color: "#fff", fontSize: 21, fontWeight: 950 };
const toolbarSx = { ...panelSx, p: "12px" };
const toolbarGridSx = { display: "grid", gridTemplateColumns: "minmax(260px,1fr) auto auto", gap: "10px", alignItems: "center", "@media (max-width: 760px)": { gridTemplateColumns: "1fr" } };
const applyCardSx = { ...panelSx, display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" };
const selectorCardSx = { ...panelSx, display: "grid", gridTemplateColumns: "minmax(240px,1fr) minmax(220px,.75fr) auto auto", gap: "10px", alignItems: "center", "@media (max-width: 1050px)": { gridTemplateColumns: "1fr 1fr" }, "@media (max-width: 650px)": { gridTemplateColumns: "1fr" } };
const tableCardSx = { borderRadius: "10px", background: "rgba(15,23,42,.78)", border: "1px solid rgba(255,255,255,.07)", overflow: "hidden" };
const tableScrollSx = {
	overflowX: "auto",
	overflowY: "hidden",
	scrollbarGutter: "stable",
	overscrollBehaviorX: "auto",
	WebkitOverflowScrolling: "touch",
	pb: "3px",
};
const rateHeadSx = { minWidth: 1350, display: "grid", gridTemplateColumns: "minmax(250px,1.5fr) 130px 200px 80px 120px 80px 170px 95px 180px", background: "rgba(2,6,23,.38)", color: "rgba(255,255,255,.50)", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".06em", "& > div": { padding: "12px 13px" } };
const rateRowSx = { minWidth: 1350, display: "grid", gridTemplateColumns: "minmax(250px,1.5fr) 130px 200px 80px 120px 80px 170px 95px 180px", alignItems: "center", borderTop: "1px solid rgba(255,255,255,.06)", "& > p, & > div": { padding: "10px 13px" } };
const labourHeadSx = { minWidth: 1300, display: "grid", gridTemplateColumns: "minmax(260px,1.5fr) 110px 130px 80px 120px 90px 170px 95px 180px", background: "rgba(2,6,23,.38)", color: "rgba(255,255,255,.50)", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".06em", "& > div": { padding: "12px 13px" } };
const labourRowSx = { minWidth: 1300, display: "grid", gridTemplateColumns: "minmax(260px,1.5fr) 110px 130px 80px 120px 90px 170px 95px 180px", alignItems: "center", borderTop: "1px solid rgba(255,255,255,.06)", "& > p, & > div": { padding: "10px 13px" } };
const materialHeadSx = { minWidth: 1000, display: "grid", gridTemplateColumns: "minmax(260px,1.5fr) 120px 140px 130px 140px 140px 140px", background: "rgba(2,6,23,.38)", color: "rgba(255,255,255,.50)", fontSize: 10, fontWeight: 900, textTransform: "uppercase", "& > div": { padding: "11px" } };
const materialRowSx = { minWidth: 1000, display: "grid", gridTemplateColumns: "minmax(260px,1.5fr) 120px 140px 130px 140px 140px 140px", alignItems: "center", borderTop: "1px solid rgba(255,255,255,.06)", "& > p, & > div": { padding: "9px 11px" } };
const costLabourHeadSx = { minWidth: 1050, display: "grid", gridTemplateColumns: "minmax(260px,1.5fr) 140px 90px 90px 100px 120px 130px 50px", background: "rgba(2,6,23,.38)", color: "rgba(255,255,255,.50)", fontSize: 10, fontWeight: 900, textTransform: "uppercase", "& > div": { padding: "11px" } };
const costLabourRowSx = { minWidth: 1050, display: "grid", gridTemplateColumns: "minmax(260px,1.5fr) 140px 90px 90px 100px 120px 130px 50px", alignItems: "center", borderTop: "1px solid rgba(255,255,255,.06)", "& > p, & > div, & > button": { margin: "8px 10px" } };
const cellStrongSx = { color: "#fff", fontSize: 12, fontWeight: 850 };
const cellTextSx = { color: "rgba(255,255,255,.68)", fontSize: 11.5, fontWeight: 700 };
const mutedTextSx = { mt: "2px", color: "rgba(255,255,255,.46)", fontSize: 10, fontWeight: 650 };
const monoTextSx = { color: "rgba(255,255,255,.76)", fontSize: 11.5, fontWeight: 800, fontFamily: "monospace" };
const moneyTextSx = { color: "#4ade80", fontSize: 12, fontWeight: 900, fontFamily: "monospace" };
const actionRowSx = { display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" };
const activeChipSx = { height: 22, borderRadius: 999, color: "#4ade80", background: "rgba(34,197,94,.12)", border: "1px solid rgba(34,197,94,.22)", fontSize: 9.5, fontWeight: 900 };
const inactiveChipSx = { ...activeChipSx, color: "#94a3b8", background: "rgba(148,163,184,.08)", border: "1px solid rgba(148,163,184,.18)" };
const countChipSx = { ...activeChipSx, color: "#93c5fd", background: "rgba(59,130,246,.10)", border: "1px solid rgba(59,130,246,.20)" };
const loadingSx = { minHeight: 300, display: "grid", placeItems: "center" };
const emptyTableSx = { minWidth: 700, py: "30px", textAlign: "center", color: "#64748b", fontSize: 12, fontWeight: 750 };
const emptyPanelSx = { ...panelSx, minHeight: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "8px" };
const emptyTitleSx = { color: "#fff", fontSize: 18, fontWeight: 950 };
const emptySubSx = { color: "rgba(255,255,255,.52)", fontSize: 12, fontWeight: 650 };
const dialogPaperSx = { background: "linear-gradient(180deg,#0f172a,#111827)", color: "#fff", border: "1px solid rgba(255,255,255,.09)", borderRadius: "14px" };
const dialogTitleSx = { color: "#fff", fontWeight: 950 };
const dialogContentSx = { pt: "12px !important" };
const dialogActionsSx = { p: "16px 24px", borderTop: "1px solid rgba(255,255,255,.07)" };
const formGrid2Sx = { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "12px", "@media (max-width: 650px)": { gridTemplateColumns: "1fr" } };
const costingGridSx = { display: "grid", gridTemplateColumns: "minmax(0,1.05fr) minmax(360px,.95fr)", gap: "14px", "@media (max-width: 1050px)": { gridTemplateColumns: "1fr" } };
const costRowsSx = { display: "flex", flexDirection: "column" };
const costRowSx = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", py: "8px", borderBottom: "1px solid rgba(255,255,255,.06)" };
const costStrongRowSx = { background: "rgba(59,130,246,.06)", px: "8px", borderRadius: "6px" };
const costHeroRowSx = { background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.16)", mt: "6px" };
const costLabelSx = { color: "rgba(255,255,255,.62)", fontSize: 12, fontWeight: 750 };
const costValueSx = { color: "#fff", fontSize: 13, fontWeight: 900, fontFamily: "monospace" };
const downloadPanelSx = { ...panelSx, display: "flex", gap: "8px", flexWrap: "wrap" };

const reportPaperSx = { p: "28px", borderRadius: "10px", background: "#fff", color: "#0f172a", boxShadow: "0 18px 45px rgba(0,0,0,.25)", "@media print": { boxShadow: "none", p: "0", borderRadius: 0 } };
const reportHeaderSx = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "20px", pb: "18px", borderBottom: "2px solid #0f172a" };
const reportBrandSx = { color: "#0f172a", fontSize: 24, fontWeight: 950, letterSpacing: ".08em" };
const reportSubSx = { color: "#475569", fontSize: 11, fontWeight: 700, mt: "3px" };
const reportTitleSx = { color: "#0f172a", fontSize: 19, fontWeight: 950 };
const reportMetaSx = { color: "#475569", fontSize: 10.5, fontWeight: 700, mt: "4px" };
const reportMetaGridSx = { display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: "8px", my: "14px" };
const reportMetaCellSx = { p: "9px", border: "1px solid #e2e8f0", borderRadius: "6px" };
const reportMetaValueSx = { color: "#0f172a", fontSize: 11, fontWeight: 850, mt: "3px" };
const reportSummaryGridSx = { display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: "8px", mb: "18px" };
const reportMetricSx = { p: "11px", border: "1px solid #cbd5e1", borderRadius: "6px" };
const reportMetricValueSx = { color: "#0f172a", fontSize: 16, fontWeight: 950, mt: "4px" };
const reportSectionTitleSx = { color: "#0f172a", fontSize: 13, fontWeight: 950, mt: "17px", mb: "7px", textTransform: "uppercase", letterSpacing: ".05em" };
const reportCostGridSx = { display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: "6px" };
const reportCostCellSx = { p: "8px", border: "1px solid #e2e8f0", borderRadius: "5px" };
const reportCostLabelSx = { color: "#64748b", fontSize: 8.5, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".05em" };
const reportCostValueSx = { color: "#0f172a", fontSize: 11, fontWeight: 900, mt: "3px" };
const reportTableSx = {
	border: "1px solid #cbd5e1",
	borderRadius: "5px",
	overflowX: "auto",
	overflowY: "hidden",
	scrollbarGutter: "stable",
};
const reportMaterialHeadSx = { display: "grid", gridTemplateColumns: "2fr .8fr .8fr .8fr .9fr", background: "#e2e8f0", fontSize: 8.5, fontWeight: 900, textTransform: "uppercase", "& > div": { padding: "7px" } };
const reportMaterialRowSx = { display: "grid", gridTemplateColumns: "2fr .8fr .8fr .8fr .9fr", fontSize: 9.5, borderTop: "1px solid #e2e8f0", "& > div": { padding: "7px" } };
const reportLabourHeadSx = { display: "grid", gridTemplateColumns: ".8fr 1.6fr 1fr .8fr .9fr", background: "#e2e8f0", fontSize: 8.5, fontWeight: 900, textTransform: "uppercase", "& > div": { padding: "7px" } };
const reportLabourRowSx = { display: "grid", gridTemplateColumns: ".8fr 1.6fr 1fr .8fr .9fr", fontSize: 9.5, borderTop: "1px solid #e2e8f0", "& > div": { padding: "7px" } };
