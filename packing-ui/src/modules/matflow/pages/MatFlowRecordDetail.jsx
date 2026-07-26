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
	Typography,
} from "@mui/material";

import {
	useNavigate,
	useParams,
} from "react-router-dom";

import {
	matflowApi,
	readMatFlowError,
} from "../api/matflowApi";

import MatFlowStatusChip
	from "../components/MatFlowStatusChip";

import {
	errorBoxSx,
	heroBadgeSx,
	heroSubSx,
	heroSx,
	heroTitleSx,
	loadingSx,
	pageSx,
	panelSx,
	secondaryBtnSx,
	tableCellSx,
	tableHeaderSx,
	tableRowSx,
	tableShellSx,
} from "../matflowTheme";

import ArrowBackIcon
	from "@mui/icons-material/ArrowBack";

const CONFIG = {
	requisition: {
		param: "requisitionId",
		title: "Material Requisition",
		badge: "PRODUCTION → STORE",
		loader: (id) =>
			matflowApi.getRequisition(id),
		backPath: "/matflow/production",
		numberField: "requisitionNo",
	},

	indent: {
		param: "indentId",
		title: "Material Indent",
		badge: "STORE → PURCHASE",
		loader: (id) =>
			matflowApi.getIndent(id),
		backPath: "/matflow/indents",
		numberField: "indentNo",
	},

	purchaseOrder: {
		param: "purchaseOrderId",
		title: "Purchase Order",
		badge: "PURCHASE APPROVAL",
		loader: (id) =>
			matflowApi.getPurchaseOrder(id),
		backPath: "/matflow/approvals",
		numberField: "purchaseOrderNo",
	},
};

const formatValue = (value) => {
	if (
		value === null ||
		value === undefined ||
		value === ""
	) {
		return "-";
	}

	if (typeof value === "object") {
		return JSON.stringify(value);
	}

	return String(value);
};

export default function MatFlowRecordDetail({
	type,
}) {
	const params = useParams();
	const navigate = useNavigate();

	const config =
		CONFIG[type] ||
		CONFIG.requisition;

	const recordId =
		params[config.param];

	const [record, setRecord] =
		useState(null);
	const [loading, setLoading] =
		useState(true);
	const [error, setError] =
		useState("");

	const load = async () => {
		try {
			setLoading(true);
			setError("");

			const response =
				await config.loader(recordId);

			setRecord(
				response.data || null
			);
		} catch (requestError) {
			setRecord(null);

			setError(
				readMatFlowError(
					requestError,
					`Unable to load ${config.title}.`
				)
			);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [recordId, type]);

	const lines = useMemo(() => {
		const candidates = [
			record?.lines,
			record?.items,
			record?.requisitionLines,
			record?.indentLines,
			record?.purchaseOrderLines,
		];

		return (
			candidates.find(
				Array.isArray
			) || []
		);
	}, [record]);

	if (loading) {
		return (
			<Box sx={loadingSx}>
				<CircularProgress />
			</Box>
		);
	}

	return (
		<Box sx={pageSx}>
			<Box sx={heroSx}>
				<Box sx={heroHeaderSx}>
					<Box>
						<Chip
							label={config.badge}
							sx={heroBadgeSx}
						/>

						<Typography sx={heroTitleSx}>
							{record?.[
								config.numberField
							] || config.title}
						</Typography>

						<Typography sx={heroSubSx}>
							{record?.productName ||
								record?.clientName ||
								"MatFlow controlled document"}
						</Typography>
					</Box>

					<Button
						startIcon={<ArrowBackIcon />}
						onClick={() =>
							navigate(
								config.backPath
							)
						}
						sx={secondaryBtnSx}
					>
						Back
					</Button>
				</Box>
			</Box>

			{error && (
				<Box sx={errorBoxSx}>
					{error}
				</Box>
			)}

			{record && (
				<>
					<Card sx={panelSx}>
						<Box sx={detailGridSx}>
							<Detail
								label="Status"
								value={
									<MatFlowStatusChip
										status={record.status}
									/>
								}
							/>
							<Detail
								label="Plant"
								value={record.plantCode}
							/>
							<Detail
								label="PD No."
								value={record.pdNo}
							/>
							<Detail
								label="Drawing No."
								value={record.drawingNo}
							/>
							<Detail
								label="Product"
								value={record.productName}
							/>
							<Detail
								label="Client"
								value={record.clientName}
							/>
							<Detail
								label="Created By"
								value={
									record.createdBy ||
									record.submittedBy
								}
							/>
							<Detail
								label="Row Version"
								value={record.rowVersion}
							/>
						</Box>
					</Card>

					<Card sx={panelSx}>
						<Typography sx={sectionTitleSx}>
							Document Lines
						</Typography>

						<Box
							sx={{
								...tableShellSx,
								mt: "12px",
							}}
						>
							<Box sx={detailHeaderSx}>
								<Box sx={tableCellSx}>
									Line
								</Box>
								<Box sx={tableCellSx}>
									Item
								</Box>
								<Box sx={tableCellSx}>
									Description
								</Box>
								<Box sx={tableCellSx}>
									Quantity
								</Box>
								<Box sx={tableCellSx}>
									Processed
								</Box>
								<Box sx={tableCellSx}>
									Status
								</Box>
							</Box>

							{lines.length === 0 ? (
								<Box sx={emptyLinesSx}>
									No document lines returned.
								</Box>
							) : (
								lines.map((line, index) => (
									<Box
										key={
											line.id ||
											index
										}
										sx={detailRowSx}
									>
										<Box sx={tableCellSx}>
											{line.sourceLineNo ??
												line.lineNo ??
												index + 1}
										</Box>

										<Box sx={tableCellSx}>
											<Typography sx={itemNameSx}>
												{line.itemName ||
													"-"}
											</Typography>

											<Typography sx={itemCodeSx}>
												{line.itemCode ||
													"-"}
											</Typography>
										</Box>

										<Box sx={tableCellSx}>
											{line.specification ||
												line.itemDescription ||
												"-"}
										</Box>

										<Box sx={tableCellSx}>
											{formatValue(
												line.requisitionQty ??
													line.indentQty ??
													line.orderedQty ??
													line.requiredQty
											)}{" "}
											{line.unit || ""}
										</Box>

										<Box sx={tableCellSx}>
											{formatValue(
												line.blockedQty ??
													line.orderedQty ??
													line.receivedQty
											)}
										</Box>

										<Box sx={tableCellSx}>
											<MatFlowStatusChip
												status={line.status}
											/>
										</Box>
									</Box>
								))
							)}
						</Box>
					</Card>
				</>
			)}
		</Box>
	);
}

function Detail({ label, value }) {
	return (
		<Box sx={detailBoxSx}>
			<Typography sx={detailLabelSx}>
				{label}
			</Typography>

			<Box sx={detailValueSx}>
				{value ?? "-"}
			</Box>
		</Box>
	);
}

const heroHeaderSx = {
	display: "flex",
	alignItems: "flex-start",
	justifyContent: "space-between",
	gap: "12px",
	flexWrap: "wrap",
};

const detailGridSx = {
	display: "grid",
	gridTemplateColumns:
		"repeat(auto-fit,minmax(190px,1fr))",
	gap: "9px",
};

const detailBoxSx = {
	p: "11px",
	borderRadius: "9px",
	background: "rgba(2,6,23,.34)",
	border: "1px solid rgba(255,255,255,.06)",
};

const detailLabelSx = {
	color: "rgba(255,255,255,.48)",
	fontSize: "9.5px",
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".07em",
};

const detailValueSx = {
	mt: "5px",
	color: "#fff",
	fontSize: "12px",
	fontWeight: 800,
	wordBreak: "break-word",
};

const sectionTitleSx = {
	color: "#fff",
	fontSize: "17px",
	fontWeight: 950,
};

const detailColumns =
	"60px minmax(220px,1.2fr) minmax(260px,1.4fr) 130px 120px 170px";

const detailHeaderSx = {
	...tableHeaderSx,
	gridTemplateColumns: detailColumns,
};

const detailRowSx = {
	...tableRowSx,
	gridTemplateColumns: detailColumns,
};

const itemNameSx = {
	color: "#fff",
	fontSize: "12px",
	fontWeight: 850,
};

const itemCodeSx = {
	mt: "2px",
	color: "rgba(255,255,255,.45)",
	fontSize: "9.5px",
	fontWeight: 650,
};

const emptyLinesSx = {
	minHeight: "160px",
	display: "grid",
	placeItems: "center",
	color: "rgba(255,255,255,.48)",
	fontSize: "12px",
	fontWeight: 700,
};