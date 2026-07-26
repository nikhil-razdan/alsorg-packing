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

const formatDate = (value) => {
	if (!value) return "-";

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return String(value);
	}

	return date.toLocaleString(
		"en-US",
		{
			dateStyle: "medium",
			timeStyle: "short",
		}
	);
};

const formatQty = (value) => {
	const numberValue = Number(value);

	if (!Number.isFinite(numberValue)) {
		return value ?? "-";
	}

	return numberValue.toLocaleString(
		"en-US",
		{
			maximumFractionDigits: 3,
		}
	);
};

export default function MatFlowReleaseDetail() {
	const { releaseId } = useParams();
	const navigate = useNavigate();

	const [release, setRelease] =
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
				await matflowApi.getRelease(
					releaseId
				);

			setRelease(
				response.data || null
			);
		} catch (requestError) {
			setRelease(null);

			setError(
				readMatFlowError(
					requestError,
					"Unable to load the MatFlow release."
				)
			);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [releaseId]);

	const lines = useMemo(() => {
		if (Array.isArray(release?.lines)) {
			return release.lines;
		}

		if (
			Array.isArray(
				release?.releaseLines
			)
		) {
			return release.releaseLines;
		}

		if (Array.isArray(release?.items)) {
			return release.items;
		}

		return [];
	}, [release]);

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
							label="IMMUTABLE RELEASE SNAPSHOT"
							sx={heroBadgeSx}
						/>

						<Typography sx={heroTitleSx}>
							{release?.bomNo ||
								"MatFlow Release"}
						</Typography>

						<Typography sx={heroSubSx}>
							{release?.productName ||
								"Product not available"}
							{" • "}
							Revision{" "}
							{release?.sourceRevisionNo ??
								"-"}
						</Typography>
					</Box>

					<Button
						startIcon={<ArrowBackIcon />}
						onClick={() =>
							navigate("/matflow/releases")
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

			{release && (
				<>
					<Box sx={summaryGridSx}>
						<InfoCard
							label="Status"
							value={
								<MatFlowStatusChip
									status={release.status}
								/>
							}
						/>

						<InfoCard
							label="Plant"
							value={
								release.plantCode ||
								"-"
							}
						/>

						<InfoCard
							label="PD No."
							value={
								release.pdNo ||
								"-"
							}
						/>

						<InfoCard
							label="Drawing No."
							value={
								release.drawingNo ||
								"-"
							}
						/>

						<InfoCard
							label="Released Lines"
							value={
								release.releasedLineCount ??
								lines.length
							}
						/>

						<InfoCard
							label="Released By"
							value={
								release.releasedBy ||
								"-"
							}
							subtitle={formatDate(
								release.releasedAt
							)}
						/>
					</Box>

					<Card sx={panelSx}>
						<Typography sx={sectionTitleSx}>
							Product and Project Context
						</Typography>

						<Box sx={detailGridSx}>
							<Detail
								label="Product Name"
								value={release.productName}
							/>
							<Detail
								label="Product Code"
								value={release.productCode}
							/>
							<Detail
								label="Project Code"
								value={release.projectCode}
							/>
							<Detail
								label="Client"
								value={release.clientName}
							/>
							<Detail
								label="Release Remarks"
								value={
									release.releaseRemarks
								}
							/>
							<Detail
								label="Previous Release"
								value={
									release.previousReleaseId
								}
							/>
						</Box>
					</Card>

					<Card sx={panelSx}>
						<Box sx={sectionHeaderSx}>
							<Box>
								<Typography sx={sectionTitleSx}>
									Released Material Lines
								</Typography>

								<Typography sx={sectionSubSx}>
									Source material quantities are
									read-only in MatFlow.
								</Typography>
							</Box>

							<Chip
								label={`${lines.length} LINES`}
								sx={countChipSx}
							/>
						</Box>

						<Box sx={tableShellSx}>
							<Box sx={lineTableHeaderSx}>
								<Box sx={tableCellSx}>
									Line
								</Box>
								<Box sx={tableCellSx}>
									Item
								</Box>
								<Box sx={tableCellSx}>
									Category
								</Box>
								<Box sx={tableCellSx}>
									Specification
								</Box>
								<Box sx={tableCellSx}>
									Required
								</Box>
								<Box sx={tableCellSx}>
									Requisitioned
								</Box>
								<Box sx={tableCellSx}>
									Blocked
								</Box>
								<Box sx={tableCellSx}>
									Shortage
								</Box>
								<Box sx={tableCellSx}>
									Status
								</Box>
							</Box>

							{lines.length === 0 ? (
								<Box sx={emptyLinesSx}>
									No release lines were returned.
								</Box>
							) : (
								lines.map((line) => (
									<Box
										key={
											line.id ||
											line.sourceLineNo
										}
										sx={lineTableRowSx}
									>
										<Box sx={tableCellSx}>
											{line.sourceLineNo ??
												line.lineNo ??
												"-"}
										</Box>

										<Box sx={tableCellSx}>
											<Typography sx={lineItemSx}>
												{line.itemName ||
													"-"}
											</Typography>

											<Typography sx={lineCodeSx}>
												{line.itemCode ||
													"No item code"}
											</Typography>
										</Box>

										<Box sx={tableCellSx}>
											{line.category || "-"}
										</Box>

										<Box sx={tableCellSx}>
											{line.specification ||
												line.itemDescription ||
												"-"}
										</Box>

										<Box sx={tableCellSx}>
											{formatQty(
												line.requiredQty
											)}{" "}
											{line.unit || ""}
										</Box>

										<Box sx={tableCellSx}>
											{formatQty(
												line.requisitionedQty
											)}
										</Box>

										<Box sx={tableCellSx}>
											{formatQty(
												line.blockedQty
											)}
										</Box>

										<Box sx={tableCellSx}>
											{formatQty(
												line.shortageQty
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

function InfoCard({
	label,
	value,
	subtitle,
}) {
	return (
		<Card sx={infoCardSx}>
			<Typography sx={infoLabelSx}>
				{label}
			</Typography>

			<Box sx={infoValueSx}>
				{value}
			</Box>

			{subtitle && (
				<Typography sx={infoSubSx}>
					{subtitle}
				</Typography>
			)}
		</Card>
	);
}

function Detail({ label, value }) {
	return (
		<Box sx={detailBoxSx}>
			<Typography sx={infoLabelSx}>
				{label}
			</Typography>

			<Typography sx={detailValueSx}>
				{value || "-"}
			</Typography>
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

const summaryGridSx = {
	display: "grid",
	gridTemplateColumns:
		"repeat(auto-fit,minmax(170px,1fr))",
	gap: "10px",
};

const infoCardSx = {
	p: "13px",
	borderRadius: "11px",
	background: "rgba(15,23,42,.82)",
	border: "1px solid rgba(255,255,255,.07)",
};

const infoLabelSx = {
	color: "rgba(255,255,255,.50)",
	fontSize: "9.5px",
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".07em",
};

const infoValueSx = {
	mt: "6px",
	color: "#fff",
	fontSize: "15px",
	fontWeight: 900,
};

const infoSubSx = {
	mt: "4px",
	color: "rgba(255,255,255,.46)",
	fontSize: "9.5px",
	fontWeight: 650,
};

const sectionTitleSx = {
	color: "#fff",
	fontSize: "17px",
	fontWeight: 950,
};

const sectionSubSx = {
	mt: "3px",
	color: "rgba(255,255,255,.52)",
	fontSize: "10.5px",
	fontWeight: 650,
};

const detailGridSx = {
	mt: "13px",
	display: "grid",
	gridTemplateColumns:
		"repeat(auto-fit,minmax(210px,1fr))",
	gap: "9px",
};

const detailBoxSx = {
	p: "11px",
	borderRadius: "9px",
	background: "rgba(2,6,23,.32)",
	border: "1px solid rgba(255,255,255,.06)",
};

const detailValueSx = {
	mt: "5px",
	color: "#fff",
	fontSize: "12px",
	fontWeight: 750,
	wordBreak: "break-word",
};

const sectionHeaderSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "12px",
	mb: "12px",
};

const countChipSx = {
	height: "23px",
	borderRadius: 999,
	color: "#7dd3fc",
	background: "rgba(14,165,233,.12)",
	border: "1px solid rgba(14,165,233,.22)",
	fontSize: "9.5px",
	fontWeight: 900,
};

const lineColumns =
	"60px minmax(220px,1.4fr) 120px minmax(220px,1.4fr) 120px 110px 100px 100px 170px";

const lineTableHeaderSx = {
	...tableHeaderSx,
	gridTemplateColumns: lineColumns,
};

const lineTableRowSx = {
	...tableRowSx,
	gridTemplateColumns: lineColumns,
};

const lineItemSx = {
	color: "#fff",
	fontSize: "12px",
	fontWeight: 850,
};

const lineCodeSx = {
	mt: "2px",
	color: "rgba(255,255,255,.46)",
	fontSize: "9.5px",
	fontWeight: 650,
};

const emptyLinesSx = {
	minHeight: "160px",
	display: "grid",
	placeItems: "center",
	color: "rgba(255,255,255,.50)",
	fontSize: "12px",
	fontWeight: 700,
};