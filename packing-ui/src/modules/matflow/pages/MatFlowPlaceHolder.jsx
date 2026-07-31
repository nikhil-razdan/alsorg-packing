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
	softSurfaceSx,
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
						...softSurfaceSx,
						mt: "18px",
					}}
				>
					The backend workflow is available. This frontend workspace
					will be connected in the next focused implementation batch.
				</Box>
			</Card>
		</Box>
	);
}