import React, { useEffect, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";

import { useNavigate } from "react-router-dom";

import API from "../../../services/api";
import { venflowApi } from "../api/venflowApi";

import {
    cardSx,
    darkMenuProps,
    errorAlertSx,
    fieldSx,
    pageSubSx,
    pageTitleSx,
    primaryBtnSx,
    secondaryBtnSx,
} from "../venflowTheme";

const readCurrentUser = () => {
    try {
        return JSON.parse(localStorage.getItem("currentUser") || "{}");
    } catch {
        return {};
    }
};

const readLocalPlantCodes = () => {
    try {
        return JSON.parse(localStorage.getItem("plantCodes") || "[]");
    } catch {
        return [];
    }
};

export default function VenFlowCreatePage() {
    const navigate = useNavigate();

    const currentUser = readCurrentUser();

    const role = String(
        currentUser.role ||
        localStorage.getItem("role") ||
        ""
    ).toUpperCase();

    const [plantOptions, setPlantOptions] = useState([]);

    const [form, setForm] = useState({
        plantCode: "",
        orderDate: "",
        pdNo: "",
        clientName: "",
        bomReference: "",
        bomAttachmentUrl: "",
    });

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const loadPlants = async () => {
            const assignedPlants =
                Array.isArray(currentUser.plantCodes) &&
                    currentUser.plantCodes.length > 0
                    ? currentUser.plantCodes
                    : readLocalPlantCodes();

            if (assignedPlants.length > 0) {
                setPlantOptions(assignedPlants);

                setForm((prev) => ({
                    ...prev,
                    plantCode:
                        prev.plantCode ||
                        assignedPlants[0],
                }));

                return;
            }

            /*
             * Admin / Manager may have empty plantCodes meaning all plants.
             * In that case, load all plant options.
             */
            if (role === "ADMIN" || role === "VENFLOW_MANAGER") {
                try {
                    const res = await API.get("/plants");

                    const rows = Array.isArray(res.data)
                        ? res.data
                        : [];

                    const plantCodes = rows
                        .map((p) => p.plantCode)
                        .filter(Boolean);

                    setPlantOptions(plantCodes);

                    setForm((prev) => ({
                        ...prev,
                        plantCode:
                            prev.plantCode ||
                            plantCodes[0] ||
                            "",
                    }));
                } catch (err) {
                    console.error("Failed to load plants", err);
                    setPlantOptions([]);
                }
            }
        };

        loadPlants();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const update = (key, value) => {
        setForm((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    const submit = async () => {
        try {
            setError("");

            if (!form.plantCode) {
                setError("Plant is required.");
                return;
            }

            if (!form.orderDate) {
                setError("Order Date is required.");
                return;
            }

            if (!form.pdNo.trim()) {
                setError("PD No. is required.");
                return;
            }

            if (!form.clientName.trim()) {
                setError("Client Name is required.");
                return;
            }

            setSaving(true);

            const res = await venflowApi.createEntry({
                plantCode: form.plantCode,
                orderDate: form.orderDate,
                pdNo: form.pdNo.trim(),
                clientName: form.clientName.trim(),
                bomReference: form.bomReference.trim(),
                bomAttachmentUrl: form.bomAttachmentUrl.trim(),
            });

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
                err?.response?.data ||
                "Failed to create VenFlow entry."
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 920 }}>
            <Typography sx={pageTitleSx}>
                New Veneer Requirement
            </Typography>

            <Typography sx={pageSubSx}>
                Start the veneer tracking flow. The entry will move department-wise:
                Production Raised → Store Reviewed → Sent to Purchase → PO Raised →
                PO Approved → Material Received → Production Informed → Production Started → Job Done.
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
                            select
                            label="Plant"
                            value={form.plantCode}
                            onChange={(e) =>
                                update("plantCode", e.target.value)
                            }
                            required
                            sx={fieldSx}
                            SelectProps={{
                                MenuProps: darkMenuProps,
                            }}
                        >
                            {plantOptions.map((plant) => (
                                <MenuItem
                                    key={plant}
                                    value={plant}
                                >
                                    {plant}
                                </MenuItem>
                            ))}
                        </TextField>

                        <TextField
                            label="Order Date"
                            type="date"
                            value={form.orderDate}
                            onChange={(e) =>
                                update("orderDate", e.target.value)
                            }
                            InputLabelProps={{ shrink: true }}
                            required
                            sx={fieldSx}
                        />

                        <TextField
                            label="PD No."
                            value={form.pdNo}
                            onChange={(e) =>
                                update("pdNo", e.target.value)
                            }
                            required
                            sx={fieldSx}
                        />

                        <TextField
                            label="Client Name"
                            value={form.clientName}
                            onChange={(e) =>
                                update("clientName", e.target.value)
                            }
                            required
                            sx={fieldSx}
                        />

                        <TextField
                            label="BOM Reference / BOM No."
                            value={form.bomReference}
                            onChange={(e) =>
                                update("bomReference", e.target.value)
                            }
                            sx={fieldSx}
                        />

                        <TextField
                            label="BOM Attachment URL"
                            value={form.bomAttachmentUrl}
                            onChange={(e) =>
                                update("bomAttachmentUrl", e.target.value)
                            }
                            sx={fieldSx}
                        />
                    </Box>

                    <Box sx={noteSx}>
                        <Typography sx={noteTitleSx}>
                            Controlled plant-wise VenFlow process
                        </Typography>

                        <Typography sx={noteTextSx}>
                            This requirement will be visible only to users having access to
                            the selected plant. Store, Purchase and Production actions will
                            open step-by-step based on role and workflow stage.
                        </Typography>
                    </Box>

                    <Box
                        sx={{
                            display: "flex",
                            gap: 1.5,
                            mt: 3,
                            flexWrap: "wrap",
                        }}
                    >
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