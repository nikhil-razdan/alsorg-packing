import React, { useState } from "react";
import {
	Alert,
	Box,
	Button,
	Card,
	CardContent,
	TextField,
	Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { venflowApi } from "../api/venflowApi";

import {
	cardSx,
	errorAlertSx,
	fieldSx,
	pageSubSx,
	pageTitleSx,
	primaryBtnSx,
	secondaryBtnSx,
} from "../venflowTheme";

export default function VenFlowCreatePage() {
	const navigate = useNavigate();

	const [form, setForm] = useState({
		orderDate: "",
		pdNo: "",
		clientName: "",
	});

	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	const update = (key, value) => {
		setForm((prev) => ({
			...prev,
			[key]: value,
		}));
	};

	const submit = async () => {
		try {
			setSaving(true);
			setError("");

			const res = await venflowApi.createEntry(form);
			const id = res.data?.id;

			if (id) {
				navigate(`/venflow/entries/${id}`);
			} else {
				navigate("/venflow/entries");
			}
		} catch (err) {
			setError(
				err?.response?.data?.message ||
				err?.response?.data?.error ||
				"Failed to create VenFlow entry."
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Box sx={{ maxWidth: 860 }}>
			<Typography sx={pageTitleSx}>
				New Veneer Requirement
			</Typography>

			<Typography sx={pageSubSx}>
				Start the veneer tracking flow. Store status, requisition, ordered quantity,
				expected date and receiving will open step-by-step after this.
			</Typography>

			<Card sx={{ ...cardSx, mt: 2.5 }}>
				<CardContent sx={{ p: 3 }}>
					{error && (
						<Alert severity="error" sx={errorAlertSx}>
							{error}
						</Alert>
					)}

					<Box sx={formGridSx}>
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
							label="Client Name"
							value={form.clientName}
							onChange={(e) => update("clientName", e.target.value)}
							required
							sx={fieldSx}
						/>
					</Box>

					<Box sx={noteSx}>
						<Typography sx={noteTitleSx}>
							Controlled flow enabled
						</Typography>

						<Typography sx={noteTextSx}>
							After creating the header, users can update the next stages only
							as per role and sequence: Product Details → Store Status →
							Requisition → Ordered Qty → Expected Date → Receiving.
						</Typography>
					</Box>

					<Box sx={{ display: "flex", gap: 1.5, mt: 3, flexWrap: "wrap" }}>
						<Button
							variant="contained"
							onClick={submit}
							disabled={saving}
							sx={primaryBtnSx}
						>
							{saving ? "Creating..." : "Create & Continue"}
						</Button>

						<Button
							onClick={() => navigate("/venflow/entries")}
							sx={secondaryBtnSx}
						>
							Cancel
						</Button>
					</Box>
				</CardContent>
			</Card>
		</Box>
	);
}

const formGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		md: "1fr 1fr",
	},
	gap: 2,
};

const noteSx = {
	mt: 2.5,
	p: 2,
	borderRadius: "18px",
	background: "rgba(59,130,246,.10)",
	border: "1px solid rgba(59,130,246,.20)",
};

const noteTitleSx = {
	color: "#bfdbfe",
	fontWeight: 950,
	fontSize: 14,
};

const noteTextSx = {
	mt: 0.8,
	color: "rgba(255,255,255,.58)",
	fontWeight: 650,
	fontSize: 13,
	lineHeight: 1.7,
};