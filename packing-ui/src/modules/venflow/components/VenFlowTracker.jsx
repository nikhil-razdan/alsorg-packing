import React from "react";

import {
	Box,
	Typography,
} from "@mui/material";

import CheckRoundedIcon
	from "@mui/icons-material/CheckRounded";

import {
	VF_TRACKER_STEPS,
	getStageGroupIndex,
} from "../venflowWorkflow";

const firstValue = (entry, keys) => {
	for (const key of keys) {
		const value = entry?.[key];

		if (
			value !== null &&
			value !== undefined &&
			String(value).trim() !== ""
		) {
			return value;
		}
	}

	return "";
};

const formatDateTime = (value) => {
	if (!value) return "—";

	return String(value)
		.replace("T", " ")
		.slice(0, 16);
};

export default function VenFlowTracker({
	stage,
	entry,
}) {
	const activeIndex =
		getStageGroupIndex(stage);

	return (
		<Box sx={trackerSx}>
			{VF_TRACKER_STEPS.map(
				(step, index) => {
					const completed =
						index < activeIndex;

					const active =
						index === activeIndex;

					const pending =
						index > activeIndex;

					const date =
						firstValue(
							entry,
							step.dateKeys
						);

					return (
						<Box
							key={step.key}
							sx={stepWrapSx}
						>
							<Box
								sx={lineSx(
									completed,
									active,
									index
								)}
							/>

							<Box
								sx={circleSx(
									completed,
									active,
									pending
								)}
							>
								{completed ? (
									<CheckRoundedIcon
										sx={{
											fontSize: 18,
										}}
									/>
								) : (
									index + 1
								)}
							</Box>

							<Typography
								sx={labelSx(
									completed,
									active
								)}
							>
								{step.label}
							</Typography>

							<Typography
								sx={dateSx}
							>
								{formatDateTime(
									date
								)}
							</Typography>
						</Box>
					);
				}
			)}
		</Box>
	);
}

const trackerSx = {
	width: "100%",
	display: "grid",

	gridTemplateColumns: {
		xs: "1fr",
		sm: "repeat(2,minmax(0,1fr))",
		md: "repeat(5,minmax(0,1fr))",
		xl: "repeat(10,minmax(0,1fr))",
	},

	alignItems: "start",
	position: "relative",
	py: 2,

	px: {
		xs: 1,
		md: 2,
	},

	rowGap: 2,
};

const stepWrapSx = {
	position: "relative",
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	textAlign: "center",
	minHeight: 92,
};

const lineSx = (
	completed,
	active,
	index
) => ({
	display: {
		xs: "none",
		xl:
			index === 0
				? "none"
				: "block",
	},
	position: "absolute",
	top: 15,
	left: "-50%",
	width: "100%",
	height: 4,
	borderRadius: 999,
	background:
		completed || active
			? "linear-gradient(90deg,#2563eb,#3b82f6)"
			: "rgba(148,163,184,.24)",
	zIndex: 0,
});

const circleSx = (
	completed,
	active,
	pending
) => ({
	width: 34,
	height: 34,
	borderRadius: "50%",
	display: "grid",
	placeItems: "center",
	position: "relative",
	zIndex: 1,
	color: "#fff",
	fontSize: 13,
	fontWeight: 950,
	background: completed
		? "linear-gradient(135deg,#2563eb,#3b82f6)"
		: active
			? "linear-gradient(135deg,#1d4ed8,#60a5fa)"
			: "rgba(148,163,184,.45)",
	border: active
		? "2px solid rgba(147,197,253,.70)"
		: "1px solid rgba(255,255,255,.14)",
	boxShadow: active
		? "0 0 0 5px rgba(59,130,246,.16), 0 12px 28px rgba(37,99,235,.34)"
		: completed
			? "0 10px 24px rgba(37,99,235,.24)"
			: "none",
	opacity: pending ? 0.72 : 1,
});

const labelSx = (
	completed,
	active
) => ({
	mt: 1.1,
	color:
		completed || active
			? "#fff"
			: "rgba(255,255,255,.58)",
	fontSize: 11.5,
	fontWeight:
		completed || active
			? 900
			: 750,
	lineHeight: 1.25,
});

const dateSx = {
	mt: 0.4,
	color: "rgba(255,255,255,.48)",
	fontSize: 10,
	fontWeight: 650,
	lineHeight: 1.25,
};