import React, {
	useEffect,
	useMemo,
	useState,
} from "react";

import {
	Alert,
	Box,
	Button,
	Card,
	MenuItem,
	TextField,
	Typography,
} from "@mui/material";

import { useNavigate } from "react-router-dom";

import API from "../../../services/api";
import { useAuth } from "../../../auth/AuthContext";
import { venflowApi } from "../api/venflowApi";

import {
	darkMenuProps,
	errorAlertSx,
	fieldSx,
	primaryBtnSx,
	secondaryBtnSx,
} from "../venflowTheme";

import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";

const normalizePlantCode = (value) => {
	if (!value) return "";

	if (typeof value === "string") {
		return value.trim().toUpperCase();
	}

	return String(
		value.plantCode ||
		value.code ||
		value.name ||
		value.plant ||
		value.value ||
		""
	)
		.trim()
		.toUpperCase();
};

const uniquePlants = (items = []) => {
	return Array.from(
		new Set(
			items
				.map(normalizePlantCode)
				.filter(Boolean)
		)
	);
};

const extractPlantOptionsFromResponse = (data) => {
	if (Array.isArray(data)) return uniquePlants(data);
	if (Array.isArray(data?.content)) return uniquePlants(data.content);
	if (Array.isArray(data?.data)) return uniquePlants(data.data);
	if (Array.isArray(data?.plants)) return uniquePlants(data.plants);

	return [];
};

const validateOptionalHttpUrl = (
	value,
	fieldName
) => {
	const cleaned = String(value || "").trim();

	if (!cleaned) {
		return null;
	}

	try {
		const url = new URL(cleaned);

		if (
			url.protocol !== "http:" &&
			url.protocol !== "https:"
		) {
			throw new Error();
		}

		return cleaned;
	} catch {
		throw new Error(
			`${fieldName} must be a valid HTTP or HTTPS URL.`
		);
	}
};

export default function VenFlowCreatePage() {
	const navigate = useNavigate();

	const {
		user,
		role,
		plantCodes,
	} = useAuth();

	const cleanRole = String(role || "").trim().toUpperCase();

	const assignedPlants = useMemo(() => {
		const fromAuth = Array.isArray(plantCodes)
			? plantCodes
			: [];

		const fromUser = Array.isArray(user?.plantCodes)
			? user.plantCodes
			: [];

		return uniquePlants(
			fromAuth.length > 0 ? fromAuth : fromUser
		);
	}, [plantCodes, user]);

	const [plantOptions, setPlantOptions] = useState([]);
	const [plantLoading, setPlantLoading] = useState(true);

	const [form, setForm] = useState({
		plantCode: "",
		orderDate: "",
		pdNo: "",
		drawingNo: "",
		clientName: "",
		materialName: "",
		veneerType: "",
		thickness: "",
		size: "",
		requiredQty: "",
		unit: "SHEET",
		bomReference: "",
		bomAttachmentUrl: "",
		sampleImageUrl: "",
		remarks: "",
	});

	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		const loadPlants = async () => {
			setPlantLoading(true);
			setError("");

			try {
				if (cleanRole === "ADMIN") {
					const res = await API.get("/plants");
					const apiPlants = extractPlantOptionsFromResponse(res.data);

					setPlantOptions(apiPlants);

					setForm((prev) => ({
						...prev,
						plantCode: prev.plantCode || apiPlants[0] || "",
					}));

					return;
				}

				if (cleanRole === "VENFLOW_MANAGER") {
					if (assignedPlants.length > 0) {
						setPlantOptions(assignedPlants);

						setForm((prev) => ({
							...prev,
							plantCode: prev.plantCode || assignedPlants[0],
						}));

						return;
					}

					const res = await API.get("/plants");
					const apiPlants = extractPlantOptionsFromResponse(res.data);

					setPlantOptions(apiPlants);

					setForm((prev) => ({
						...prev,
						plantCode: prev.plantCode || apiPlants[0] || "",
					}));

					return;
				}

				if (assignedPlants.length > 0) {
					setPlantOptions(assignedPlants);

					setForm((prev) => ({
						...prev,
						plantCode: prev.plantCode || assignedPlants[0],
					}));

					return;
				}

				setPlantOptions([]);
				setError(
					"No plant access found for this user. Please assign plant access from User Management."
				);
			} catch (err) {
				console.error("Failed to load VenFlow plants", err);

				setPlantOptions([]);
				setError(
					err?.response?.data?.message ||
					err?.response?.data?.error ||
					"Failed to load plant list."
				);
			} finally {
				setPlantLoading(false);
			}
		};

		loadPlants();
	}, [assignedPlants, cleanRole]);

	const update = (key, value) => {
		setForm((prev) => ({
			...prev,
			[key]: value,
		}));
	};

	const submit = async () => {
		try {
			setError("");

			if (!form.plantCode) {
				throw new Error("Plant is required.");
			}

			if (!form.orderDate) {
				throw new Error("Order Date is required.");
			}

			if (!form.pdNo.trim()) {
				throw new Error("PD No. is required.");
			}

			if (!form.drawingNo.trim()) {
				throw new Error("Drawing No. is required.");
			}

			if (!form.clientName.trim()) {
				throw new Error("Client Name is required.");
			}

			if (!form.materialName.trim()) {
				throw new Error("Material Name is required.");
			}

			const requiredQty =
				Number(form.requiredQty);

			if (
				!Number.isFinite(requiredQty) ||
				requiredQty <= 0
			) {
				throw new Error(
					"Required Qty must be greater than zero."
				);
			}

			const bomAttachmentUrl =
				validateOptionalHttpUrl(
					form.bomAttachmentUrl,
					"BOM Document URL"
				);

			const sampleImageUrl =
				validateOptionalHttpUrl(
					form.sampleImageUrl,
					"Sample Image URL"
				);

			setSaving(true);

			const res =
				await venflowApi.createEntry({
					plantCode:
						form.plantCode,

					orderDate:
						form.orderDate,

					pdNo:
						form.pdNo.trim(),

					drawingNo:
						form.drawingNo.trim(),

					clientName:
						form.clientName.trim(),

					materialName:
						form.materialName.trim(),

					veneerType:
						form.veneerType.trim(),

					thickness:
						form.thickness.trim(),

					size:
						form.size.trim(),

					requiredQty,

					unit:
						form.unit,

					bomReference:
						form.bomReference.trim(),

					bomAttachmentUrl,
					sampleImageUrl,

					remarks:
						form.remarks.trim(),
				});

			const entryId =
				res.data?.id;

			navigate(
				entryId
					? `/venflow/entries/${entryId}`
					: "/venflow/entries"
			);
		} catch (err) {
			setError(
				err?.response?.data?.message ||
				err?.response?.data?.error ||
				err?.response?.data ||
				err?.message ||
				"Failed to create VenFlow entry."
			);
		} finally {
			setSaving(false);
		}
	};


	return (
		<Box sx={pageSx}>
			<Box sx={headerSx}>
				<Box>
					<Typography sx={titleSx}>
						New Veneer Requirement
					</Typography>

					<Typography sx={subSx}>
						Engineering creates the BOM / Indent and sends it to AKG Store.
						Store will submit one stock decision. Available quantity moves to QC,
						while any shortage automatically creates a Purchase allocation.
					</Typography>
				</Box>
			</Box>

			<Box sx={stepperSx}>
				<Step
					active
					number="1"
					title="Engineering BOM / Indent"
					sub="Requirement and sample"
				/>

				<Step
					number="2"
					title="Store Decision"
					sub="Available and shortage qty"
				/>

				<Step
					number="3"
					title="Allocation QC / Purchase"
					sub="QC and PO workflow"
				/>

				<Step
					number="4"
					title="Issue / Processing"
					sub="Issue approved material"
				/>

				<Step
					number="5"
					title="Supervisor Closure"
					sub="Final review and next stage"
				/>
			</Box>

			<Box sx={mainGridSx}>
				<Card sx={formCardSx}>
					<Box sx={sectionHeaderSx}>
						<Box sx={sectionIconSx}>
							<DescriptionOutlinedIcon />
						</Box>

						<Box>
							<Typography sx={sectionTitleSx}>
								1. Requirement Information
							</Typography>

							<Typography sx={sectionSubSx}>
								Provide the basic details for the veneer requirement.
							</Typography>
						</Box>
					</Box>

					{error && (
						<Alert severity="error" sx={errorAlertSx}>
							{error}
						</Alert>
					)}

					<Box sx={formGridSx}>
						<TextField
							select
							label="Plant"
							value={form.plantCode}
							onChange={(e) => update("plantCode", e.target.value)}
							required
							disabled={plantLoading || plantOptions.length === 0}
							sx={fieldSx}
							SelectProps={{ MenuProps: darkMenuProps }}
						>
							{plantOptions.length === 0 ? (
								<MenuItem value="">
									{plantLoading
										? "Loading plants..."
										: "No plant assigned"}
								</MenuItem>
							) : (
								plantOptions.map((plant) => (
									<MenuItem key={plant} value={plant}>
										{plant}
									</MenuItem>
								))
							)}
						</TextField>

						<TextField
							label="Order Date"
							type="date"
							value={form.orderDate}
							onChange={(e) => update("orderDate", e.target.value)}
							InputLabelProps={{ shrink: true }}
							required
							sx={fieldSx}
						/>

						<TextField
							label="PD No."
							value={form.pdNo}
							onChange={(e) => update("pdNo", e.target.value)}
							required
							sx={fieldSx}
						/>

						<TextField
							label="Drawing No."
							value={form.drawingNo}
							onChange={(e) => update("drawingNo", e.target.value)}
							required
							sx={fieldSx}
						/>

						<TextField
							label="Client Name"
							value={form.clientName}
							onChange={(e) => update("clientName", e.target.value)}
							required
							sx={fieldSx}
						/>

						<TextField
							label="Material Name"
							value={form.materialName}
							onChange={(e) => update("materialName", e.target.value)}
							required
							sx={fieldSx}
						/>

						<TextField
							label="BOM Document URL"
							value={form.bomAttachmentUrl}
							onChange={(e) =>
								update(
									"bomAttachmentUrl",
									e.target.value
								)
							}
							placeholder="https://..."
							sx={fieldSx}
						/>

						<TextField
							label="Sample Image URL"
							value={form.sampleImageUrl}
							onChange={(e) =>
								update(
									"sampleImageUrl",
									e.target.value
								)
							}
							placeholder="https://..."
							sx={fieldSx}
						/>

						<TextField
							label="Veneer Type"
							value={form.veneerType}
							onChange={(e) => update("veneerType", e.target.value)}
							sx={fieldSx}
						/>

						<TextField
							label="Thickness"
							value={form.thickness}
							onChange={(e) => update("thickness", e.target.value)}
							sx={fieldSx}
						/>

						<TextField
							label="Size"
							value={form.size}
							onChange={(e) => update("size", e.target.value)}
							sx={fieldSx}
						/>

						<TextField
							label="Required Qty"
							type="number"
							value={form.requiredQty}
							onChange={(e) => update("requiredQty", e.target.value)}
							required
							sx={fieldSx}
						/>

						<TextField
							select
							label="Unit"
							value={form.unit}
							onChange={(e) => update("unit", e.target.value)}
							required
							sx={fieldSx}
							SelectProps={{ MenuProps: darkMenuProps }}
						>
							<MenuItem value="SHEET">Sheet</MenuItem>
							<MenuItem value="PCS">Pcs</MenuItem>
							<MenuItem value="NO">No</MenuItem>
							<MenuItem value="SQFT">Sqft</MenuItem>
							<MenuItem value="SQM">Sqm</MenuItem>
							<MenuItem value="METER">Meter</MenuItem>
						</TextField>

						<TextField
							label="BOM Reference / BOM No."
							value={form.bomReference}
							onChange={(e) => update("bomReference", e.target.value)}
							sx={fieldSx}
						/>
					</Box>

					<TextField
						fullWidth
						multiline
						minRows={3}
						label="Remarks"
						value={form.remarks}
						onChange={(e) => update("remarks", e.target.value)}
						sx={{ ...fieldSx, mt: 2 }}
					/>

					<Box sx={noteSx}>
						<Box sx={noteIconSx}>
							<InfoOutlinedIcon />
						</Box>

						<Box>
							<Typography sx={noteTitleSx}>
								Plant-wise controlled indent
							</Typography>

							<Typography sx={noteTextSx}>
								This entry will be visible only to users having access to the selected
								plant. After creation, Engineering can send the indent to Store for
								stock review.
							</Typography>
						</Box>
					</Box>

					<Box sx={actionRowSx}>
						<Button
							variant="contained"
							startIcon={<SendOutlinedIcon />}
							onClick={submit}
							disabled={saving || plantLoading || plantOptions.length === 0}
							sx={primaryBtnSx}
						>
							{saving ? "Creating..." : "Create Requirement"}
						</Button>

						<Button
							startIcon={<CloseOutlinedIcon />}
							onClick={() => navigate("/venflow/entries")}
							sx={secondaryBtnSx}
						>
							Cancel
						</Button>
					</Box>
				</Card>

				<Box sx={sidePanelSx}>
					<Card sx={summaryCardSx}>
						<Box sx={summaryHeaderSx}>
							<DescriptionOutlinedIcon />
							<Typography sx={summaryTitleSx}>
								Requirement Summary
							</Typography>
						</Box>

						<SummaryRow label="Plant" value={form.plantCode} />
						<SummaryRow label="Order Date" value={form.orderDate} />
						<SummaryRow label="Client" value={form.clientName} />
						<SummaryRow label="Material" value={form.materialName} />
						<SummaryRow label="Veneer Type" value={form.veneerType} />
						<SummaryRow label="Thickness" value={form.thickness} />
						<SummaryRow label="Size" value={form.size} />
						<SummaryRow
							label="Required Qty"
							value={
								form.requiredQty
									? `${form.requiredQty} ${form.unit}`
									: ""
							}
						/>
					</Card>

					<Card sx={summaryCardSx}>
						<Typography sx={summaryTitleSx}>
							What happens next?
						</Typography>

						<Box sx={nextStepsSx}>
							<NextStep
								active
								title="Store Decision"
								text="AKG Store will enter the physically available quantity and identify the shortage."
							/>

							<NextStep
								title="QC / Purchase"
								text="Available Store stock moves directly to QC. The shortage automatically creates a Purchase allocation."
							/>

							<NextStep
								title="Issue / Processing"
								text="QC-approved quantity becomes issue-ready and can be issued to the veneer processing team."
							/>
						</Box>
					</Card>

					<Card sx={helpCardSx}>
						<Box sx={helpIconSx}>
							<HelpOutlineOutlinedIcon />
						</Box>

						<Box>
							<Typography sx={summaryTitleSx}>
								Need help?
							</Typography>

							<Typography sx={helpTextSx}>
								Reach out to your Store or Engineering team for assistance.
							</Typography>
						</Box>
					</Card>
				</Box>
			</Box>
		</Box>
	);
}

function Step({
	active,
	number,
	title,
	sub,
}) {
	return (
		<Box sx={stepSx}>
			<Box sx={stepCircleSx(active)}>
				{number}
			</Box>

			<Box>
				<Typography sx={stepTitleSx(active)}>
					{title}
				</Typography>

				<Typography sx={stepSubSx}>
					{sub}
				</Typography>
			</Box>
		</Box>
	);
}

function SummaryRow({
	label,
	value,
}) {
	return (
		<Box sx={summaryRowSx}>
			<Typography sx={summaryLabelSx}>
				{label}
			</Typography>

			<Typography sx={summaryValueSx}>
				{value || "-"}
			</Typography>
		</Box>
	);
}

function NextStep({
	active,
	title,
	text,
}) {
	return (
		<Box sx={nextStepSx}>
			<Box sx={nextDotSx(active)} />

			<Box>
				<Typography sx={nextTitleSx(active)}>
					{title}
				</Typography>

				<Typography sx={nextTextSx}>
					{text}
				</Typography>
			</Box>
		</Box>
	);
}

const pageSx = {
	display: "flex",
	flexDirection: "column",
	gap: "16px",
};

const headerSx = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "flex-start",
	gap: 2,
};

const titleSx = {
	color: "#fff",
	fontSize: {
		xs: 28,
		md: 36,
	},
	fontWeight: 950,
	letterSpacing: "-.05em",
	lineHeight: 1,
};

const subSx = {
	mt: 1,
	color: "rgba(255,255,255,.68)",
	fontSize: 13,
	fontWeight: 650,
	lineHeight: 1.55,
	maxWidth: 820,
};

const stepperSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		md: "repeat(5,1fr)",
	},
	gap: 1,
	p: 2,
	borderRadius: "18px",
	background: "rgba(15,23,42,.50)",
	border: "1px solid rgba(255,255,255,.06)",
};

const stepSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	minWidth: 0,
};

const stepCircleSx = (active) => ({
	width: 34,
	height: 34,
	borderRadius: "50%",
	display: "grid",
	placeItems: "center",
	color: "#fff",
	fontSize: 13,
	fontWeight: 950,
	background: active
		? "linear-gradient(135deg,#2563eb,#3b82f6)"
		: "rgba(148,163,184,.22)",
	border: active
		? "2px solid rgba(147,197,253,.70)"
		: "1px solid rgba(255,255,255,.12)",
	boxShadow: active
		? "0 0 0 5px rgba(59,130,246,.12)"
		: "none",
});

const stepTitleSx = (active) => ({
	color: active ? "#fff" : "rgba(255,255,255,.68)",
	fontSize: 12,
	fontWeight: 950,
	whiteSpace: "nowrap",
});

const stepSubSx = {
	mt: 0.3,
	color: "rgba(255,255,255,.48)",
	fontSize: 11,
	fontWeight: 650,
	whiteSpace: "nowrap",
};

const mainGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		xl: "minmax(700px,1fr) 380px",
	},
	gap: "16px",
	alignItems: "start",
};

const formCardSx = {
	p: 3,
	borderRadius: "18px",
	background:
		"linear-gradient(180deg, rgba(30,41,59,.70), rgba(15,23,42,.76))",
	border: "1px solid rgba(255,255,255,.075)",
	boxShadow: "0 18px 42px rgba(2,6,23,.34)",
	color: "#fff",
};

const sectionHeaderSx = {
	display: "flex",
	alignItems: "flex-start",
	gap: 1.4,
	mb: 2.5,
};

const sectionIconSx = {
	width: 38,
	height: 38,
	borderRadius: "12px",
	display: "grid",
	placeItems: "center",
	color: "#60a5fa",
	background: "rgba(59,130,246,.14)",
	border: "1px solid rgba(59,130,246,.28)",
};

const sectionTitleSx = {
	color: "#fff",
	fontSize: 18,
	fontWeight: 950,
};

const sectionSubSx = {
	mt: 0.5,
	color: "rgba(255,255,255,.56)",
	fontSize: 12,
	fontWeight: 650,
};

const formGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		md: "1fr 1fr",
	},
	gap: 1.5,
};

const noteSx = {
	mt: 2.5,
	p: 2,
	borderRadius: "16px",
	background:
		"linear-gradient(135deg, rgba(59,130,246,.14), rgba(37,99,235,.08))",
	border: "1px solid rgba(59,130,246,.26)",
	display: "flex",
	gap: 1.3,
};

const noteIconSx = {
	width: 32,
	height: 32,
	borderRadius: "50%",
	display: "grid",
	placeItems: "center",
	color: "#60a5fa",
	background: "rgba(59,130,246,.18)",
	flexShrink: 0,
};

const noteTitleSx = {
	color: "#bfdbfe",
	fontWeight: 950,
	fontSize: 14,
};

const noteTextSx = {
	mt: 0.7,
	color: "rgba(255,255,255,.62)",
	fontWeight: 650,
	fontSize: 13,
	lineHeight: 1.65,
};

const actionRowSx = {
	display: "flex",
	gap: 1.5,
	mt: 3,
	flexWrap: "wrap",
};

const sidePanelSx = {
	display: "flex",
	flexDirection: "column",
	gap: 1.5,
};

const summaryCardSx = {
	p: 2,
	borderRadius: "18px",
	background:
		"linear-gradient(180deg, rgba(30,41,59,.70), rgba(15,23,42,.76))",
	border: "1px solid rgba(255,255,255,.075)",
	boxShadow: "0 18px 42px rgba(2,6,23,.30)",
	color: "#fff",
};

const summaryHeaderSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	mb: 1.5,
	color: "#60a5fa",
};

const summaryTitleSx = {
	color: "#fff",
	fontSize: 15,
	fontWeight: 950,
};

const summaryRowSx = {
	display: "grid",
	gridTemplateColumns: "130px 1fr",
	gap: 1,
	py: 1,
	borderBottom: "1px solid rgba(255,255,255,.065)",
};

const summaryLabelSx = {
	color: "rgba(255,255,255,.55)",
	fontSize: 12,
	fontWeight: 800,
};

const summaryValueSx = {
	color: "#fff",
	fontSize: 12,
	fontWeight: 850,
	textAlign: "right",
};

const nextStepsSx = {
	mt: 2,
	display: "flex",
	flexDirection: "column",
	gap: 1.8,
};

const nextStepSx = {
	display: "grid",
	gridTemplateColumns: "22px 1fr",
	gap: 1.2,
};

const nextDotSx = (active) => ({
	width: 15,
	height: 15,
	borderRadius: "50%",
	mt: 0.3,
	background: active ? "#3b82f6" : "transparent",
	border: active
		? "4px solid rgba(59,130,246,.30)"
		: "2px solid rgba(148,163,184,.45)",
	boxSizing: "border-box",
});

const nextTitleSx = (active) => ({
	color: active ? "#bfdbfe" : "rgba(255,255,255,.72)",
	fontSize: 13,
	fontWeight: 950,
});

const nextTextSx = {
	mt: 0.4,
	color: "rgba(255,255,255,.54)",
	fontSize: 12,
	fontWeight: 650,
	lineHeight: 1.5,
};

const helpCardSx = {
	p: 2,
	borderRadius: "18px",
	background: "rgba(59,130,246,.08)",
	border: "1px solid rgba(59,130,246,.20)",
	color: "#fff",
	display: "flex",
	gap: 1.3,
};

const helpIconSx = {
	width: 42,
	height: 42,
	borderRadius: "50%",
	display: "grid",
	placeItems: "center",
	color: "#fff",
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	flexShrink: 0,
};

const helpTextSx = {
	mt: 0.6,
	color: "rgba(255,255,255,.62)",
	fontSize: 12,
	fontWeight: 650,
	lineHeight: 1.5,
};