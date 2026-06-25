import React, { useEffect, useState } from "react";

import {
	Alert,
	Box,
	Button,
	Card,
	CardContent,
	CircularProgress,
	Divider,
	MenuItem,
	TextField,
	Typography,
} from "@mui/material";

import { useNavigate, useParams } from "react-router-dom";

import { venflowApi } from "../api/venflowApi";
import VenFlowStatusChip from "../components/VenFlowStatusChip";
import VenFlowStageChip from "../components/VenFlowStageChip";
import { normalizeRole } from "../../../utils/permissions";

import {
	cardSx,
	darkMenuProps,
	dividerSx,
	errorAlertSx,
	fieldSx,
	infoLabelSx,
	infoValueSx,
	loadingBoxSx,
	outlineBtnSx,
	pageHeaderSx,
	pageTitleSx,
	primaryBtnSx,
	secondaryBtnSx,
	sectionTitleSx,
} from "../venflowTheme";

export default function VenFlowDetailPage() {
	const { id } = useParams();
	const navigate = useNavigate();

	const role = normalizeRole(localStorage.getItem("role"));

	const isAdmin = role === "ADMIN";
	const isManager = role === "VENFLOW_MANAGER";

	const isProduction =
		isAdmin ||
		isManager ||
		role === "VENFLOW_PRODUCTION";

	const isStore =
		isAdmin ||
		isManager ||
		role === "VENFLOW_STORE";

	const isPurchase =
		isAdmin ||
		isManager ||
		role === "VENFLOW_PURCHASE";

	const [entry, setEntry] = useState(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	const [productForm, setProductForm] = useState({
		productDescription: "",
		veneerType: "",
		size: "",
	});

	const [storeForm, setStoreForm] = useState({
		storeStatus: "",
	});

	const [requisitionForm, setRequisitionForm] = useState({
		requisitionSlipNo: "",
		requisitionDate: "",
	});

	const [orderedForm, setOrderedForm] = useState({
		orderedQty: "",
		unit: "SHEET",
	});

	const [expectedForm, setExpectedForm] = useState({
		expectedDate: "",
	});

	const [receivedForm, setReceivedForm] = useState({
		receivedQty: "",
		actualInHouseDate: "",
	});

	const [remarksForm, setRemarksForm] = useState({
		remarks: "",
	});

	const load = async () => {
		try {
			setLoading(true);
			setError("");

			const res = await venflowApi.getEntry(id);
			const row = res.data || {};

			setEntry(row);

			setProductForm({
				productDescription: row.productDescription || "",
				veneerType: row.veneerType || "",
				size: row.size || "",
			});

			setStoreForm({
				storeStatus: row.storeStatus || "",
			});

			setRequisitionForm({
				requisitionSlipNo: row.requisitionSlipNo || "",
				requisitionDate: row.requisitionDate || "",
			});

			setOrderedForm({
				orderedQty: row.orderedQty ?? "",
				unit: row.unit || "SHEET",
			});

			setExpectedForm({
				expectedDate: row.expectedDate || "",
			});

			setReceivedForm({
				receivedQty: row.receivedQty ?? "",
				actualInHouseDate: row.actualInHouseDate || "",
			});

			setRemarksForm({
				remarks: row.remarks || "",
			});
		} catch (err) {
			setEntry(null);

			setError(
				err?.response?.data?.message ||
				err?.response?.data?.error ||
				"Unable to load VenFlow entry."
			);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [id]);

	const run = async (fn) => {
		try {
			setSaving(true);
			setError("");

			await fn();
			await load();
		} catch (err) {
			setError(
				err?.response?.data?.message ||
				err?.response?.data?.error ||
				"Update failed."
			);
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<Box sx={loadingBoxSx}>
				<CircularProgress />
			</Box>
		);
	}

	if (!entry) {
		return (
			<Alert severity="error" sx={errorAlertSx}>
				{error || "Entry not found."}
			</Alert>
		);
	}

	return (
		<Box>
			<Box sx={pageHeaderSx}>
				<Box>
					<Typography sx={pageTitleSx}>
						{entry.pdNo} — {entry.clientName}
					</Typography>

					<Box
						sx={{
							display: "flex",
							gap: 1,
							mt: 1,
							flexWrap: "wrap",
						}}
					>
						<VenFlowStageChip stage={entry.stage} />
						<VenFlowStatusChip status={entry.storeStatus} />
					</Box>
				</Box>

				<Button
					onClick={() => navigate("/venflow/entries")}
					sx={secondaryBtnSx}
				>
					Back to Entries
				</Button>
			</Box>

			{error && (
				<Alert severity="error" sx={errorAlertSx}>
					{error}
				</Alert>
			)}

			<Box sx={gridSx}>
				<Card sx={cardSx}>
					<CardContent sx={{ p: 2.6 }}>
						<Typography sx={sectionTitleSx}>
							1. Header
						</Typography>

						<Divider sx={{ ...dividerSx, my: 1.5 }} />

						<Info label="Order Date" value={entry.orderDate} />
						<Info label="PD No." value={entry.pdNo} />
						<Info label="Client Name" value={entry.clientName} />
					</CardContent>
				</Card>

				<Card sx={cardSx}>
					<CardContent sx={{ p: 2.6 }}>
						<Typography sx={sectionTitleSx}>
							2. Product Details
						</Typography>

						<Divider sx={{ ...dividerSx, my: 1.5 }} />

						<Box sx={formGridSx}>
							<TextField
								label="Product Description"
								value={productForm.productDescription}
								onChange={(e) =>
									setProductForm((p) => ({
										...p,
										productDescription: e.target.value,
									}))
								}
								disabled={!isProduction}
								sx={fieldSx}
							/>

							<TextField
								label="Veneer Type"
								value={productForm.veneerType}
								onChange={(e) =>
									setProductForm((p) => ({
										...p,
										veneerType: e.target.value,
									}))
								}
								disabled={!isProduction}
								sx={fieldSx}
							/>

							<TextField
								label="Size"
								value={productForm.size}
								onChange={(e) =>
									setProductForm((p) => ({
										...p,
										size: e.target.value,
									}))
								}
								disabled={!isProduction}
								sx={fieldSx}
							/>
						</Box>

						<Button
							variant="contained"
							disabled={!isProduction || saving}
							onClick={() =>
								run(() =>
									venflowApi.updateProductDetails(id, productForm)
								)
							}
							sx={{ ...primaryBtnSx, mt: 2 }}
						>
							Save Product Details
						</Button>
					</CardContent>
				</Card>

				<Card sx={cardSx}>
					<CardContent sx={{ p: 2.6 }}>
						<Typography sx={sectionTitleSx}>
							3. Store Status
						</Typography>

						<Divider sx={{ ...dividerSx, my: 1.5 }} />

						<TextField
							fullWidth
							select
							label="Veneer Status in Store"
							value={storeForm.storeStatus}
							onChange={(e) =>
								setStoreForm({
									storeStatus: e.target.value,
								})
							}
							disabled={!isStore}
							sx={fieldSx}
							SelectProps={{
								MenuProps: darkMenuProps,
							}}
						>
							<MenuItem value="AVAILABLE_IN_STORE">
								Available in Store
							</MenuItem>
							<MenuItem value="NOT_AVAILABLE">
								Not Available
							</MenuItem>
							<MenuItem value="PARTIALLY_AVAILABLE">
								Partially Available
							</MenuItem>
							<MenuItem value="PENDING">
								Pending
							</MenuItem>
							<MenuItem value="HOLD">
								Hold
							</MenuItem>
						</TextField>

						<Button
							variant="contained"
							disabled={!isStore || saving}
							onClick={() =>
								run(() => venflowApi.updateStoreStatus(id, storeForm))
							}
							sx={{ ...primaryBtnSx, mt: 2 }}
						>
							Save Store Status
						</Button>
					</CardContent>
				</Card>

				<Card sx={cardSx}>
					<CardContent sx={{ p: 2.6 }}>
						<Typography sx={sectionTitleSx}>
							4. Requisition
						</Typography>

						<Divider sx={{ ...dividerSx, my: 1.5 }} />

						<Box sx={formGridSx}>
							<TextField
								label="Requisition Slip No."
								value={requisitionForm.requisitionSlipNo}
								onChange={(e) =>
									setRequisitionForm((p) => ({
										...p,
										requisitionSlipNo: e.target.value,
									}))
								}
								disabled={!isPurchase}
								sx={fieldSx}
							/>

							<TextField
								label="Requisition Date"
								type="date"
								InputLabelProps={{ shrink: true }}
								value={requisitionForm.requisitionDate}
								onChange={(e) =>
									setRequisitionForm((p) => ({
										...p,
										requisitionDate: e.target.value,
									}))
								}
								disabled={!isPurchase}
								sx={fieldSx}
							/>
						</Box>

						<Button
							variant="contained"
							disabled={!isPurchase || saving}
							onClick={() =>
								run(() =>
									venflowApi.updateRequisition(id, requisitionForm)
								)
							}
							sx={{ ...primaryBtnSx, mt: 2 }}
						>
							Save Requisition
						</Button>
					</CardContent>
				</Card>

				<Card sx={cardSx}>
					<CardContent sx={{ p: 2.6 }}>
						<Typography sx={sectionTitleSx}>
							5. Ordered Quantity
						</Typography>

						<Divider sx={{ ...dividerSx, my: 1.5 }} />

						<Box sx={formGridSx}>
							<TextField
								label="Ordered Qty"
								type="number"
								value={orderedForm.orderedQty}
								onChange={(e) =>
									setOrderedForm((p) => ({
										...p,
										orderedQty: e.target.value,
									}))
								}
								disabled={!isPurchase}
								sx={fieldSx}
							/>

							<TextField
								label="Unit"
								select
								value={orderedForm.unit}
								onChange={(e) =>
									setOrderedForm((p) => ({
										...p,
										unit: e.target.value,
									}))
								}
								disabled={!isPurchase}
								sx={fieldSx}
								SelectProps={{
									MenuProps: darkMenuProps,
								}}
							>
								<MenuItem value="SHEET">Sheet</MenuItem>
								<MenuItem value="PCS">Pcs</MenuItem>
								<MenuItem value="NO">No</MenuItem>
								<MenuItem value="SQFT">Sqft</MenuItem>
								<MenuItem value="SQM">Sqm</MenuItem>
								<MenuItem value="METER">Meter</MenuItem>
							</TextField>
						</Box>

						<Button
							variant="contained"
							disabled={!isPurchase || saving}
							onClick={() =>
								run(() =>
									venflowApi.updateOrderedQty(id, orderedForm)
								)
							}
							sx={{ ...primaryBtnSx, mt: 2 }}
						>
							Save Ordered Qty
						</Button>
					</CardContent>
				</Card>

				<Card sx={cardSx}>
					<CardContent sx={{ p: 2.6 }}>
						<Typography sx={sectionTitleSx}>
							6. Expected Date
						</Typography>

						<Divider sx={{ ...dividerSx, my: 1.5 }} />

						<TextField
							fullWidth
							label="Expected Date"
							type="date"
							InputLabelProps={{ shrink: true }}
							value={expectedForm.expectedDate}
							onChange={(e) =>
								setExpectedForm({
									expectedDate: e.target.value,
								})
							}
							disabled={!isProduction}
							sx={fieldSx}
						/>

						<Button
							variant="contained"
							disabled={!isProduction || saving}
							onClick={() =>
								run(() =>
									venflowApi.updateExpectedDate(id, expectedForm)
								)
							}
							sx={{ ...primaryBtnSx, mt: 2 }}
						>
							Save Expected Date
						</Button>
					</CardContent>
				</Card>

				<Card sx={cardSx}>
					<CardContent sx={{ p: 2.6 }}>
						<Typography sx={sectionTitleSx}>
							7. Receiving
						</Typography>

						<Divider sx={{ ...dividerSx, my: 1.5 }} />

						<Box sx={formGridSx}>
							<TextField
								label="Received Qty"
								type="number"
								value={receivedForm.receivedQty}
								onChange={(e) =>
									setReceivedForm((p) => ({
										...p,
										receivedQty: e.target.value,
									}))
								}
								disabled={!isStore}
								sx={fieldSx}
							/>

							<TextField
								label="Actual In-house Date"
								type="date"
								InputLabelProps={{ shrink: true }}
								value={receivedForm.actualInHouseDate}
								onChange={(e) =>
									setReceivedForm((p) => ({
										...p,
										actualInHouseDate: e.target.value,
									}))
								}
								disabled={!isStore}
								sx={fieldSx}
							/>
						</Box>

						<Button
							variant="contained"
							disabled={!isStore || saving}
							onClick={() =>
								run(() =>
									venflowApi.updateReceivedQty(id, receivedForm)
								)
							}
							sx={{ ...primaryBtnSx, mt: 2 }}
						>
							Save Receiving
						</Button>
					</CardContent>
				</Card>

				<Card sx={cardSx}>
					<CardContent sx={{ p: 2.6 }}>
						<Typography sx={sectionTitleSx}>
							8. Balance & Remarks
						</Typography>

						<Divider sx={{ ...dividerSx, my: 1.5 }} />

						<Info
							label="Ordered Qty"
							value={`${entry.orderedQty ?? "-"} ${entry.unit || ""}`}
						/>
						<Info
							label="Received Qty"
							value={entry.receivedQty ?? "-"}
						/>
						<Info
							label="Balance Qty"
							value={entry.balanceQty ?? "-"}
						/>

						<TextField
							fullWidth
							multiline
							minRows={3}
							label="Remarks"
							value={remarksForm.remarks}
							onChange={(e) =>
								setRemarksForm({
									remarks: e.target.value,
								})
							}
							sx={{
								...fieldSx,
								mt: 2,
							}}
						/>

						<Button
							variant="outlined"
							disabled={saving}
							onClick={() =>
								run(() => venflowApi.updateRemarks(id, remarksForm))
							}
							sx={{ ...outlineBtnSx, mt: 2 }}
						>
							Save Remarks
						</Button>
					</CardContent>
				</Card>
			</Box>
		</Box>
	);
}

function Info({ label, value }) {
	return (
		<Box sx={{ mb: 1.2 }}>
			<Typography sx={infoLabelSx}>
				{label}
			</Typography>

			<Typography sx={infoValueSx}>
				{value || "-"}
			</Typography>
		</Box>
	);
}

const gridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		lg: "1fr 1fr",
	},
	gap: 2,
};

const formGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		md: "1fr 1fr",
	},
	gap: 1.5,
};