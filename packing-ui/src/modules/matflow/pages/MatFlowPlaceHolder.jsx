import {
	Box,
	Card,
	Chip,
	Typography,
} from "@mui/material";

import {
	heroBadgeSx,
	heroSubSx,
	heroSx,
	heroTitleSx,
	pageSx,
} from "../matflowTheme";

export default function MatFlowPlaceholder({
	title,
	subtitle,
	badge = "MATFLOW WORKSPACE",
}) {
	return (
		<Box sx={pageSx}>
			<Card sx={heroSx}>
				<Chip
					label={badge}
					sx={heroBadgeSx}
				/>

				<Typography sx={heroTitleSx}>
					{title}
				</Typography>

				<Typography sx={heroSubSx}>
					{subtitle}
				</Typography>

				<Box
					sx={{
						mt: "18px",
						p: "14px",
						borderRadius: "10px",
						color:
							"rgba(255,255,255,.65)",
						background:
							"rgba(2,6,23,.38)",
						border:
							"1px solid rgba(255,255,255,.07)",
						fontSize: "12px",
						fontWeight: 700,
					}}
				>
					The backend workflow is available. This
					frontend workspace will be connected in the
					next focused implementation batch.
				</Box>
			</Card>
		</Box>
	);
}