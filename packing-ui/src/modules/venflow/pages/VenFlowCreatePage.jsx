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
		<Box sx={{ maxWidth: 760 }}>
			<Typography sx={titleSx}>
				New Veneer Requirement
			</Typography>

			<Typography sx={subSx}>
				Start the veneer tracking flow. Product, store, requisition, ordered quantity and receiving will open step-by-step after this.
			</Typography>

			<Card sx={cardSx}>
				<CardContent sx={{ p: 3 }}>
					{error && (
						<Alert severity="error" sx={{ mb: 2 }}>
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
						/>

						<TextField
							label="PD No."
							value={form.pdNo}
							onChange={(e) => update("pdNo", e.target.value)}
							required
						/>

						<TextField
							label="Client Name"
							value={form.clientName}
							onChange={(e) => update("clientName", e.target.value)}
							required
						/>
					</Box>

					<Box sx={{ display: "flex", gap: 1.5, mt: 3 }}>
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
							sx={cancelBtnSx}
						>
							Cancel
						</Button>
					</Box>
				</CardContent>
			</Card>
		</Box>
	);
}

const titleSx = {
	fontSize: 28,
	fontWeight: 950,
	color: "#111827",
	letterSpacing: "-0.04em",
};

const subSx = {
	mt: 0.6,
	mb: 2.5,
	color: "#64748b",
	fontWeight: 650,
	lineHeight: 1.7,
};

const cardSx = {
	borderRadius: 4,
	border: "1px solid #e5e7eb",
	boxShadow: "0 18px 45px rgba(15,23,42,.06)",
};

const formGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		md: "1fr 1fr",
	},
	gap: 2,
};

const primaryBtnSx = {
	borderRadius: "14px",
	textTransform: "none",
	fontWeight: 900,
	background: "linear-gradient(135deg,#92400e,#b45309)",
};

const cancelBtnSx = {
	borderRadius: "14px",
	textTransform: "none",
	fontWeight: 900,
	color: "#64748b",
};