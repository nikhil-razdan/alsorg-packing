import React from "react";
import { Box, Card, Chip, Typography } from "@mui/material";

import * as styles from "../styles/bomStyles.js";

export default function BOMFlowPlaceholder({ title, subtitle }) {
	return (
		<Box>
			<Card sx={styles.BOM_panelPlaceholderSx}>
				<Chip label="COMING NEXT" sx={styles.BOM_chipPlaceholderSx} />
				<Typography sx={styles.BOM_titlePlaceholderSx}>{title}</Typography>
				<Typography sx={styles.BOM_subtitlePlaceholderSx}>{subtitle}</Typography>
				<Typography sx={styles.BOM_notePlaceholderSx}>
					This module will be connected after Product Master and BOM Builder are finalized.
				</Typography>
			</Card>
		</Box>
	);
}
