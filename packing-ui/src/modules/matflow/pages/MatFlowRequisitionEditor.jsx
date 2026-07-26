import React, {
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
	useParams,
} from "react-router-dom";

import SaveOutlinedIcon
	from "@mui/icons-material/SaveOutlined";

import SendOutlinedIcon
	from "@mui/icons-material/SendOutlined";

import matFlowApi
	from "../api/matflowApi";

const formatQty = (value) => {
	return Number(value || 0).toLocaleString(
		"en-US",
		{
			maximumFractionDigits: 3,
		}
	);
};

export default function MatFlowRequisitionEditor() {
	const navigate = useNavigate();

	const {
		releaseId,
		requisitionId,
	} = useParams();

	const [release, setRelease] =
		useState(null);

	const [requisition, setRequisition] =
		useState(null);

	const [quantities, setQuantities] =
		useState({});

	const [header, setHeader] =
		useState({
			requiredByDate: "",
			productionDepartment: "",
			requestedFor: "",
			remarks: "",
		});

	const [loading, setLoading] =
		useState(true);

	const [working, setWorking] =
		useState(false);

	const [error, setError] =
		useState("");

	const effectiveReleaseId =
		releaseId || requisition?.releaseId;

	const loadData = async () => {
		setLoading(true);
		setError("");

		try {
			if (requisitionId) {
				const requisitionResponse =
					await matFlowApi.getRequisition(
						requisitionId
					);

				setRequisition(
					requisitionResponse
				);

				setHeader({
					requiredByDate:
						requisitionResponse
							?.requiredByDate || "",
					productionDepartment:
						requisitionResponse
							?.productionDepartment ||
						"",
					requestedFor:
						requisitionResponse
							?.requestedFor || "",
					remarks:
						requisitionResponse
							?.remarks || "",
				});

				const lineQuantities = {};

				(
					requisitionResponse?.lines ||
					[]
				).forEach((line) => {
					lineQuantities[
						line.matFlowLineId
					] = String(
						line.requestedQty || ""
					);
				});

				setQuantities(lineQuantities);

				const releaseResponse =
					await matFlowApi.getRelease(
						requisitionResponse.releaseId
					);

				setRelease(releaseResponse);
			} else {
				const releaseResponse =
					await matFlowApi.getRelease(
						releaseId
					);

				setRelease(releaseResponse);
			}
		} catch (requestError) {
			setError(
				requestError?.response?.data?.message ||
				requestError?.message ||
				"Unable to load requisition data."
			);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadData();
	}, [releaseId, requisitionId]);

	const releaseLines = useMemo(() => {
		return release?.lines || [];
	}, [release]);

	const createDraft = async () => {
		const response =
			await matFlowApi.createRequisition(
				effectiveReleaseId,
				{
					requiredByDate:
						header.requiredByDate ||
						null,
					productionDepartment:
						header.productionDepartment
							.trim() || null,
					requestedFor:
						header.requestedFor
							.trim() || null,
					remarks:
						header.remarks.trim() ||
						null,
				}
			);

		setRequisition(response);

		navigate(
			`/matflow/requisitions/${response.id}`,
			{ replace: true }
		);

		return response;
	};

	const ensureDraft = async () => {
		if (requisition?.id) {
			return requisition;
		}

		return createDraft();
	};

	const handleSaveLine = async (line) => {
		const requestedQty = Number(
			quantities[line.id] || 0
		);

		const requiredQty = Number(
			line.requiredQty || 0
		);

		const requisitionedQty = Number(
			line.requisitionedQty || 0
		);

		const remainingQty = Math.max(
			requiredQty - requisitionedQty,
			0
		);

		if (
			!Number.isFinite(requestedQty) ||
			requestedQty <= 0
		) {
			setError(
				"Requested quantity must be greater than zero."
			);
			return;
		}

		if (requestedQty > remainingQty) {
			setError(
				`Requested quantity cannot exceed remaining quantity ${formatQty(
					remainingQty
				)} ${line.unit || ""}.`
			);
			return;
		}

		setWorking(true);
		setError("");

		try {
			const draft = await ensureDraft();

			const updated =
				await matFlowApi.saveRequisitionLine(
					draft.id,
					{
						matFlowLineId: line.id,
						requestedQty,
						productionRemarks:
							null,
						rowVersion:
							draft.rowVersion,
					}
				);

			setRequisition(updated);
		} catch (requestError) {
			setError(
				requestError?.response?.data?.message ||
				requestError?.message ||
				"Unable to save requisition line."
			);
		} finally {
			setWorking(false);
		}
	};

	const handleSubmit = async () => {
		if (!requisition?.id) {
			setError(
				"Save at least one requisition line before submission."
			);
			return;
		}

		const activeLines =
			requisition?.lines || [];

		if (activeLines.length === 0) {
			setError(
				"At least one material line is required."
			);
			return;
		}

		setWorking(true);
		setError("");

		try {
			const updated =
				await matFlowApi.submitRequisition(
					requisition.id,
					requisition.rowVersion
				);

			setRequisition(updated);

			navigate(
				`/matflow/requisitions/${updated.id}`,
				{ replace: true }
			);
		} catch (requestError) {
			setError(
				requestError?.response?.data?.message ||
				requestError?.message ||
				"Unable to submit requisition."
			);
		} finally {
			setWorking(false);
		}
	};

	if (loading) {
		return (
			<Box
				sx={{
					minHeight: "300px",
					display: "grid",
					placeItems: "center",
				}}
			>
				<CircularProgress />
			</Box>
		);
	}

	const editable =
		!requisition ||
		requisition.status === "DRAFT";

	return (
		<Box
			sx={{
				display: "flex",
				flexDirection: "column",
				gap: "14px",
			}}
		>
			<Card
				sx={{
					p: "18px",
					background:
						"linear-gradient(135deg, rgba(37,99,235,.20), rgba(15,23,42,.86))",
				}}
			>
				<Chip
					label={
						requisition?.requisitionNo ||
						"NEW PRODUCTION REQUISITION"
					}
					sx={{
						color: "#93c5fd",
						background:
							"rgba(59,130,246,.12)",
					}}
				/>

				<Typography
					sx={{
						mt: "10px",
						color: "#fff",
						fontSize: "28px",
						fontWeight: 950,
					}}
				>
					{release?.productName ||
						"Production Material Requisition"}
				</Typography>

				<Typography
					sx={{
						mt: "4px",
						color:
							"rgba(255,255,255,.58)",
					}}
				>
					Release {release?.releaseNo || "-"} • PD{" "}
					{release?.pdNo || "-"} • Drawing{" "}
					{release?.drawingNo || "-"}
				</Typography>
			</Card>

			{error && (
				<Card
					sx={{
						p: "12px",
						color: "#fca5a5",
						background:
							"rgba(239,68,68,.12)",
						border:
							"1px solid rgba(239,68,68,.24)",
					}}
				>
					{error}
				</Card>
			)}

			<Card
				sx={{
					p: "15px",
					background:
						"rgba(15,23,42,.82)",
				}}
			>
				<Box
					sx={{
						display: "grid",
						gridTemplateColumns:
							"repeat(auto-fit,minmax(220px,1fr))",
						gap: "12px",
					}}
				>
					<TextField
						type="date"
						label="Required By Date"
						InputLabelProps={{
							shrink: true,
						}}
						disabled={!editable}
						value={
							header.requiredByDate
						}
						onChange={(event) =>
							setHeader((prev) => ({
								...prev,
								requiredByDate:
									event.target.value,
							}))
						}
					/>

					<TextField
						label="Production Department"
						disabled={!editable}
						value={
							header.productionDepartment
						}
						onChange={(event) =>
							setHeader((prev) => ({
								...prev,
								productionDepartment:
									event.target.value,
							}))
						}
					/>

					<TextField
						label="Requested For"
						disabled={!editable}
						value={header.requestedFor}
						onChange={(event) =>
							setHeader((prev) => ({
								...prev,
								requestedFor:
									event.target.value,
							}))
						}
					/>
				</Box>
			</Card>

			<Card
				sx={{
					overflowX: "auto",
					background:
						"rgba(15,23,42,.82)",
				}}
			>
				<Box sx={{ minWidth: "1120px" }}>
					<Box sx={requisitionHeadSx}>
						<div>Line</div>
						<div>Material</div>
						<div>Specification</div>
						<div>Required</div>
						<div>Already Requisitioned</div>
						<div>Remaining</div>
						<div>Request Now</div>
						<div>Unit</div>
						<div>Action</div>
					</Box>

					{releaseLines.map((line) => {
						const requiredQty =
							Number(
								line.requiredQty || 0
							);

						const requisitionedQty =
							Number(
								line.requisitionedQty ||
									0
							);

						const remainingQty =
							Math.max(
								requiredQty -
									requisitionedQty,
								0
							);

						return (
							<Box
								key={line.id}
								sx={requisitionRowSx}
							>
								<div>
									{line.sourceLineNo ||
										"-"}
								</div>

								<div>
									<strong>
										{line.itemName ||
											"-"}
									</strong>
									<br />
									<small>
										{line.itemCode ||
											""}
									</small>
								</div>

								<div>
									{line.specification ||
										line.itemDescription ||
										"-"}
								</div>

								<div>
									{formatQty(
										requiredQty
									)}
								</div>

								<div>
									{formatQty(
										requisitionedQty
									)}
								</div>

								<div>
									{formatQty(
										remainingQty
									)}
								</div>

								<div>
									<TextField
										size="small"
										type="number"
										disabled={
											!editable ||
											remainingQty <= 0
										}
										value={
											quantities[
												line.id
											] || ""
										}
										onChange={(
											event
										) =>
											setQuantities(
												(prev) => ({
													...prev,
													[line.id]:
														event
															.target
															.value,
												})
											)
										}
										inputProps={{
											min: 0,
											max: remainingQty,
											step: "0.001",
										}}
									/>
								</div>

								<div>
									{line.unit || "-"}
								</div>

								<div>
									<Button
										disabled={
											working ||
											!editable ||
											remainingQty <= 0
										}
										startIcon={
											<SaveOutlinedIcon />
										}
										onClick={() =>
											handleSaveLine(
												line
											)
										}
									>
										Save
									</Button>
								</div>
							</Box>
						);
					})}
				</Box>
			</Card>

			{editable && (
				<Box
					sx={{
						display: "flex",
						justifyContent:
							"flex-end",
					}}
				>
					<Button
						disabled={
							working ||
							!requisition?.id
						}
						startIcon={<SendOutlinedIcon />}
						onClick={handleSubmit}
						sx={{
							height: "42px",
							px: "18px",
							color: "#fff",
							textTransform: "none",
							fontWeight: 900,
							background:
								"linear-gradient(135deg,#2563eb,#3b82f6)",
						}}
					>
						Submit to Store
					</Button>
				</Box>
			)}
		</Box>
	);
}

const requisitionHeadSx = {
	display: "grid",
	gridTemplateColumns:
		"65px minmax(200px,1.5fr) minmax(220px,1.5fr) 100px 145px 105px 140px 70px 100px",
	color: "rgba(255,255,255,.52)",
	background: "rgba(2,6,23,.48)",
	fontSize: "10px",
	fontWeight: 900,
	textTransform: "uppercase",

	"& > div": {
		padding: "12px",
	},
};

const requisitionRowSx = {
	display: "grid",
	gridTemplateColumns:
		"65px minmax(200px,1.5fr) minmax(220px,1.5fr) 100px 145px 105px 140px 70px 100px",
	alignItems: "center",
	color: "rgba(255,255,255,.76)",
	fontSize: "12px",
	borderTop:
		"1px solid rgba(255,255,255,.06)",

	"& > div": {
		padding: "10px 12px",
	},
};