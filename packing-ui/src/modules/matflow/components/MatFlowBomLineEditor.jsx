import {
	useEffect,
	useMemo,
	useState,
} from "react";

import {
	Box,
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	IconButton,
	MenuItem,
	TextField,
	Typography,
} from "@mui/material";

import AddIcon
	from "@mui/icons-material/Add";
import CloseIcon
	from "@mui/icons-material/Close";
import DeleteOutlineIcon
	from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon
	from "@mui/icons-material/EditOutlined";

import {
	extractMatFlowPage,
	matflowApi,
	readMatFlowError,
} from "../api/matflowApi";

import {
	fieldSx,
	primaryBtnSx,
	secondaryBtnSx,
	tableCellSx,
	tableHeaderSx,
	tableRowSx,
	tableShellSx,
} from "../matflowTheme";

const EMPTY_FORM = {
	lineNo: "",
	materialId: "",
	description: "",
	baseRequiredQty: "",
	wastagePercent: "0",
	remarks: "",
};

const numberValue = (value) => {
	const result = Number(value);

	return Number.isFinite(result)
		? result
		: 0;
};

const clean = (value) => {
	return String(value ?? "").trim();
};

const formatQty = (value) => {
	const result = Number(value);

	if (!Number.isFinite(result)) {
		return "-";
	}

	return result.toLocaleString(
		"en-US",
		{
			maximumFractionDigits: 3,
		}
	);
};

export default function MatFlowBomLineEditor({
	bom,
	lines,
	onChanged,
	onError,
}) {
	const [materials, setMaterials] =
		useState([]);

	const [materialsLoading, setMaterialsLoading] =
		useState(false);

	const [dialogOpen, setDialogOpen] =
		useState(false);

	const [editingLine, setEditingLine] =
		useState(null);

	const [form, setForm] =
		useState(EMPTY_FORM);

	const [working, setWorking] =
		useState(false);

	const [localError, setLocalError] =
		useState("");

	const editable =
		String(
			bom?.status || ""
		).toUpperCase() === "DRAFT";

	useEffect(() => {
		let active = true;

		const loadMaterials = async () => {
			setMaterialsLoading(true);

			try {
				const response =
					await matflowApi
						.listMaterials({
							page: 0,
							size: 500,
							active: true,
						});

				const result =
					extractMatFlowPage(
						response
					);

				if (active) {
					setMaterials(
						result.rows
					);
				}
			} catch (error) {
				const message =
					readMatFlowError(
						error,
						"Unable to load materials."
					);

				if (active) {
					setLocalError(message);
					onError?.(message);
				}
			} finally {
				if (active) {
					setMaterialsLoading(
						false
					);
				}
			}
		};

		loadMaterials();

		return () => {
			active = false;
		};
	}, [onError]);

	const nextLineNo =
		useMemo(() => {
			const current = (
				Array.isArray(lines)
					? lines
					: []
			)
				.map((line) =>
					Number(line.lineNo)
				)
				.filter(
					(value) =>
						Number.isFinite(value)
				);

			return current.length > 0
				? Math.max(...current) + 1
				: 1;
		}, [lines]);

	const selectedMaterial =
		useMemo(() => {
			return materials.find(
				(material) =>
					String(material.id) ===
					String(form.materialId)
			);
		}, [
			form.materialId,
			materials,
		]);

	const calculatedNetQty =
		useMemo(() => {
			const base =
				numberValue(
					form.baseRequiredQty
				);

			const wastage =
				numberValue(
					form.wastagePercent
				);

			if (
				base <= 0 ||
				wastage < 0
			) {
				return 0;
			}

			return (
				base +
				base * (wastage / 100)
			);
		}, [
			form.baseRequiredQty,
			form.wastagePercent,
		]);

	const updateForm = (
		key,
		value
	) => {
		setForm((current) => ({
			...current,
			[key]: value,
		}));

		if (localError) {
			setLocalError("");
		}
	};

	const openCreate = () => {
		setEditingLine(null);

		setForm({
			...EMPTY_FORM,
			lineNo:
				String(nextLineNo),
		});

		setLocalError("");
		setDialogOpen(true);
	};

	const openEdit = (line) => {
		setEditingLine(line);

		setForm({
			lineNo:
				String(
					line.lineNo ?? ""
				),

			materialId:
				line.materialId ||
				line.material?.id ||
				"",

			description:
				line.description ||
				line.specification ||
				"",

			baseRequiredQty:
				String(
					line.baseRequiredQty ??
					line.requiredQty ??
					""
				),

			wastagePercent:
				String(
					line.wastagePercent ??
					0
				),

			remarks:
				line.remarks || "",
		});

		setLocalError("");
		setDialogOpen(true);
	};

	const closeDialog = () => {
		if (working) {
			return;
		}

		setDialogOpen(false);
		setEditingLine(null);
		setForm(EMPTY_FORM);
		setLocalError("");
	};

	const validate = () => {
		const lineNo =
			numberValue(form.lineNo);

		const baseQty =
			numberValue(
				form.baseRequiredQty
			);

		const wastage =
			numberValue(
				form.wastagePercent
			);

		if (
			!Number.isInteger(lineNo) ||
			lineNo <= 0
		) {
			return "Line number must be a positive whole number.";
		}

		if (!form.materialId) {
			return "Select a material.";
		}

		if (baseQty <= 0) {
			return "Base required quantity must be greater than zero.";
		}

		if (wastage < 0) {
			return "Wastage percentage cannot be negative.";
		}

		return "";
	};

	const save = async () => {
		const validationError =
			validate();

		if (validationError) {
			setLocalError(
				validationError
			);
			return;
		}

		setWorking(true);
		setLocalError("");

		const body = {
			lineNo:
				Number(form.lineNo),

			materialId:
				form.materialId,

			description:
				clean(
					form.description
				) || null,

			baseRequiredQty:
				Number(
					form.baseRequiredQty
				),

			wastagePercent:
				Number(
					form.wastagePercent ||
					0
				),

			remarks:
				clean(
					form.remarks
				) || null,

			rowVersion:
				editingLine?.rowVersion ??
				null,
		};

		try {
			if (editingLine?.id) {
				await matflowApi
					.updateBomLine(
						bom.id,
						editingLine.id,
						body
					);
			} else {
				await matflowApi
					.addBomLine(
						bom.id,
						body
					);
			}

			closeDialog();

			await onChanged?.();
		} catch (error) {
			const message =
				readMatFlowError(
					error,
					"Unable to save the BOM line."
				);

			setLocalError(message);
			onError?.(message);
		} finally {
			setWorking(false);
		}
	};

	const remove = async (line) => {
		if (
			!editable ||
			!line?.id ||
			working
		) {
			return;
		}

		const materialName =
			line.materialName ||
			line.material?.materialName ||
			"this material";

		const confirmed =
			window.confirm(
				`Remove ${materialName} from this BOM revision?`
			);

		if (!confirmed) {
			return;
		}

		setWorking(true);
		setLocalError("");

		try {
			await matflowApi
				.deleteBomLine(
					bom.id,
					line.id,
					line.rowVersion
				);

			await onChanged?.();
		} catch (error) {
			const message =
				readMatFlowError(
					error,
					"Unable to delete the BOM line."
				);

			setLocalError(message);
			onError?.(message);
		} finally {
			setWorking(false);
		}
	};

	return (
		<Box>
			<Box sx={sectionHeaderSx}>
				<Box>
					<Typography sx={sectionTitleSx}>
						Material Lines
					</Typography>

					<Typography sx={sectionSubSx}>
						{lines.length} operational
						material line
						{lines.length === 1
							? ""
							: "s"}
					</Typography>
				</Box>

				{editable && (
					<Button
						startIcon={<AddIcon />}
						onClick={openCreate}
						disabled={
							working ||
							materialsLoading
						}
						sx={primaryBtnSx}
					>
						Add Material
					</Button>
				)}
			</Box>

			{localError && (
				<Box sx={localErrorSx}>
					{localError}
				</Box>
			)}

			<Box sx={tableShellSx}>
				<Box sx={lineHeaderSx}>
					<Box sx={tableCellSx}>
						Line
					</Box>

					<Box sx={tableCellSx}>
						Material
					</Box>

					<Box sx={tableCellSx}>
						Description
					</Box>

					<Box sx={tableCellSx}>
						Base Qty
					</Box>

					<Box sx={tableCellSx}>
						Wastage
					</Box>

					<Box sx={tableCellSx}>
						Net Required
					</Box>

					<Box sx={tableCellSx}>
						Unit
					</Box>

					<Box sx={tableCellSx}>
						Remarks
					</Box>

					<Box sx={tableCellSx}>
						Action
					</Box>
				</Box>

				{lines.length === 0 ? (
					<Box sx={emptySx}>
						No materials have been added to
						this BOM revision.
					</Box>
				) : (
					lines.map(
						(line, index) => (
							<Box
								key={
									line.id ||
									index
								}
								sx={lineRowSx}
							>
								<Box sx={tableCellSx}>
									{line.lineNo ??
										index + 1}
								</Box>

								<Box sx={tableCellSx}>
									<Typography sx={mainTextSx}>
										{line.materialName ||
											line.material
												?.materialName ||
											"-"}
									</Typography>

									<Typography sx={subTextSx}>
										{line.materialCode ||
											line.material
												?.materialCode ||
											"-"}
									</Typography>
								</Box>

								<Box sx={tableCellSx}>
									{line.description ||
										line.specification ||
										"-"}
								</Box>

								<Box sx={tableCellSx}>
									{formatQty(
										line.baseRequiredQty ??
											line.requiredQty
									)}
								</Box>

								<Box sx={tableCellSx}>
									{formatQty(
										line.wastagePercent ??
											0
									)}
									%
								</Box>

								<Box sx={tableCellSx}>
									{formatQty(
										line.netRequiredQty
									)}
								</Box>

								<Box sx={tableCellSx}>
									{line.uom ||
										line.material?.uom ||
										"-"}
								</Box>

								<Box sx={tableCellSx}>
									{line.remarks ||
										"-"}
								</Box>

								<Box sx={actionCellSx}>
									{editable ? (
										<>
											<IconButton
												onClick={() =>
													openEdit(
														line
													)
												}
												disabled={
													working
												}
												sx={editButtonSx}
											>
												<EditOutlinedIcon />
											</IconButton>

											<IconButton
												onClick={() =>
													remove(
														line
													)
												}
												disabled={
													working
												}
												sx={deleteButtonSx}
											>
												<DeleteOutlineIcon />
											</IconButton>
										</>
									) : (
										"-"
									)}
								</Box>
							</Box>
						)
					)
				)}
			</Box>

			<Dialog
				open={dialogOpen}
				onClose={closeDialog}
				fullWidth
				maxWidth="md"
				PaperProps={{
					sx: dialogPaperSx,
				}}
			>
				<DialogTitle sx={dialogTitleSx}>
					<Box>
						<Typography sx={dialogHeadingSx}>
							{editingLine
								? "Edit BOM Material"
								: "Add BOM Material"}
						</Typography>

						<Typography sx={dialogSubSx}>
							Net required quantity is
							calculated from base quantity
							and wastage percentage.
						</Typography>
					</Box>

					<IconButton
						onClick={closeDialog}
						disabled={working}
						sx={closeButtonSx}
					>
						<CloseIcon />
					</IconButton>
				</DialogTitle>

				<DialogContent sx={dialogContentSx}>
					<Box sx={formGridSx}>
						<TextField
							label="Line Number *"
							type="number"
							value={form.lineNo}
							disabled={working}
							onChange={(event) =>
								updateForm(
									"lineNo",
									event.target.value
								)
							}
							inputProps={{
								min: 1,
								step: 1,
							}}
							sx={fieldSx}
						/>

						<TextField
							select
							label="Material *"
							value={form.materialId}
							disabled={
								working ||
								materialsLoading
							}
							onChange={(event) =>
								updateForm(
									"materialId",
									event.target.value
								)
							}
							sx={fieldSx}
						>
							{materials.map(
								(material) => (
									<MenuItem
										key={
											material.id
										}
										value={
											material.id
										}
									>
										{material.materialCode}
										{" · "}
										{material.materialName}
									</MenuItem>
								)
							)}
						</TextField>

						<TextField
							label="Base Required Quantity *"
							type="number"
							value={
								form.baseRequiredQty
							}
							disabled={working}
							onChange={(event) =>
								updateForm(
									"baseRequiredQty",
									event.target.value
								)
							}
							inputProps={{
								min: 0.001,
								step: 0.001,
							}}
							sx={fieldSx}
						/>

						<TextField
							label="Wastage Percentage"
							type="number"
							value={
								form.wastagePercent
							}
							disabled={working}
							onChange={(event) =>
								updateForm(
									"wastagePercent",
									event.target.value
								)
							}
							inputProps={{
								min: 0,
								step: 0.01,
							}}
							sx={fieldSx}
						/>

						<TextField
							label="Material Description"
							multiline
							minRows={3}
							value={
								form.description
							}
							disabled={working}
							onChange={(event) =>
								updateForm(
									"description",
									event.target.value
								)
							}
							sx={{
								...fieldSx,
								gridColumn:
									"1 / -1",
							}}
						/>

						<TextField
							label="Remarks"
							multiline
							minRows={2}
							value={form.remarks}
							disabled={working}
							onChange={(event) =>
								updateForm(
									"remarks",
									event.target.value
								)
							}
							sx={{
								...fieldSx,
								gridColumn:
									"1 / -1",
							}}
						/>
					</Box>

					<Box sx={calculationBoxSx}>
						<Box>
							<Typography sx={calculationLabelSx}>
								Selected Unit
							</Typography>

							<Typography sx={calculationValueSx}>
								{selectedMaterial?.uom ||
									"-"}
							</Typography>
						</Box>

						<Box>
							<Typography sx={calculationLabelSx}>
								Calculated Net Required
							</Typography>

							<Typography sx={calculationValueSx}>
								{formatQty(
									calculatedNetQty
								)}{" "}
								{selectedMaterial?.uom ||
									""}
							</Typography>
						</Box>
					</Box>
				</DialogContent>

				<DialogActions sx={dialogActionsSx}>
					<Button
						onClick={closeDialog}
						disabled={working}
						sx={secondaryBtnSx}
					>
						Cancel
					</Button>

					<Button
						onClick={save}
						disabled={working}
						sx={primaryBtnSx}
					>
						{working
							? "Saving..."
							: "Save Material Line"}
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
}

const sectionHeaderSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "12px",
	mb: "12px",
};

const sectionTitleSx = {
	color: "#fff",
	fontSize: "17px",
	fontWeight: 950,
};

const sectionSubSx = {
	mt: "3px",
	color: "rgba(255,255,255,.52)",
	fontSize: "11px",
	fontWeight: 700,
};

const lineColumns =
	"55px minmax(210px,1.2fr) minmax(220px,1.3fr) 100px 90px 110px 75px minmax(170px,1fr) 90px";

const lineHeaderSx = {
	...tableHeaderSx,
	gridTemplateColumns:
		lineColumns,
};

const lineRowSx = {
	...tableRowSx,
	gridTemplateColumns:
		lineColumns,
};

const mainTextSx = {
	color: "#fff",
	fontSize: "12px",
	fontWeight: 850,
};

const subTextSx = {
	mt: "2px",
	color: "rgba(255,255,255,.47)",
	fontSize: "10px",
};

const actionCellSx = {
	...tableCellSx,
	display: "flex",
	alignItems: "center",
	gap: "4px",
};

const editButtonSx = {
	width: "31px",
	height: "31px",
	color: "#7dd3fc",
	background:
		"rgba(14,165,233,.10)",
	border:
		"1px solid rgba(14,165,233,.20)",
};

const deleteButtonSx = {
	width: "31px",
	height: "31px",
	color: "#fca5a5",
	background:
		"rgba(239,68,68,.10)",
	border:
		"1px solid rgba(239,68,68,.20)",
};

const emptySx = {
	minHeight: "160px",
	display: "grid",
	placeItems: "center",
	color: "rgba(255,255,255,.50)",
	fontSize: "12px",
	fontWeight: 750,
};

const localErrorSx = {
	mb: "12px",
	p: "10px 12px",
	borderRadius: "9px",
	color: "#fca5a5",
	background:
		"rgba(239,68,68,.12)",
	border:
		"1px solid rgba(239,68,68,.24)",
	fontSize: "11px",
	fontWeight: 750,
};

const dialogPaperSx = {
	borderRadius: "14px",
	color: "#fff",
	background:
		"linear-gradient(180deg,#0f172a,#111827)",
	border:
		"1px solid rgba(255,255,255,.08)",
};

const dialogTitleSx = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "flex-start",
	gap: "12px",
	borderBottom:
		"1px solid rgba(255,255,255,.07)",
};

const dialogHeadingSx = {
	color: "#fff",
	fontSize: "19px",
	fontWeight: 950,
};

const dialogSubSx = {
	mt: "4px",
	color: "rgba(255,255,255,.52)",
	fontSize: "11px",
	lineHeight: 1.45,
};

const closeButtonSx = {
	color: "#94a3b8",
};

const dialogContentSx = {
	pt: "18px !important",
};

const formGridSx = {
	display: "grid",
	gridTemplateColumns:
		"repeat(2,minmax(0,1fr))",
	gap: "12px",

	"@media (max-width: 700px)": {
		gridTemplateColumns: "1fr",
	},
};

const calculationBoxSx = {
	mt: "14px",
	p: "12px",
	borderRadius: "9px",
	display: "grid",
	gridTemplateColumns:
		"repeat(2,minmax(0,1fr))",
	gap: "12px",
	background:
		"rgba(2,6,23,.36)",
	border:
		"1px solid rgba(255,255,255,.07)",
};

const calculationLabelSx = {
	color: "rgba(255,255,255,.48)",
	fontSize: "9.5px",
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".07em",
};

const calculationValueSx = {
	mt: "4px",
	color: "#fff",
	fontSize: "14px",
	fontWeight: 950,
};

const dialogActionsSx = {
	p: "14px 24px 20px",
	borderTop:
		"1px solid rgba(255,255,255,.07)",
};