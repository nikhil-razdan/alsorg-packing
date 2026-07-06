import React, { useEffect, useMemo, useState } from "react";
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
import { useAuth } from "../../../auth/AuthContext";
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

const normalizePlantCode = (value) => {
    if (!value) return "";

    if (typeof value === "string") {
        return value.trim().toUpperCase();
    }

    return String(
        value.plantCode ||
        value.code ||
        value.name ||
        value.plant ||
        value.value ||
        ""
    )
        .trim()
        .toUpperCase();
};

const uniquePlants = (items = []) => {
    return Array.from(
        new Set(
            items
                .map(normalizePlantCode)
                .filter(Boolean)
        )
    );
};

const extractPlantOptionsFromResponse = (data) => {
    if (Array.isArray(data)) {
        return uniquePlants(data);
    }

    if (Array.isArray(data?.content)) {
        return uniquePlants(data.content);
    }

    if (Array.isArray(data?.data)) {
        return uniquePlants(data.data);
    }

    if (Array.isArray(data?.plants)) {
        return uniquePlants(data.plants);
    }

    return [];
};

export default function VenFlowCreatePage() {
    const navigate = useNavigate();

    const {
        user,
        role,
        plantCodes,
    } = useAuth();

    const cleanRole = String(role || "").trim().toUpperCase();

    const assignedPlants = useMemo(() => {
        const fromAuth = Array.isArray(plantCodes)
            ? plantCodes
            : [];

        const fromUser = Array.isArray(user?.plantCodes)
            ? user.plantCodes
            : [];

        return uniquePlants(
            fromAuth.length > 0 ? fromAuth : fromUser
        );
    }, [plantCodes, user]);

    const [plantOptions, setPlantOptions] = useState([]);
    const [plantLoading, setPlantLoading] = useState(true);

    const [form, setForm] = useState({
        plantCode: "",
        orderDate: "",
        pdNo: "",
        drawingNo: "",
        clientName: "",
        materialName: "",
        veneerType: "",
        thickness: "",
        size: "",
        requiredQty: "",
        unit: "SHEET",
        bomReference: "",
        remarks: "",
    });

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const loadPlants = async () => {
            setPlantLoading(true);
            setError("");

            try {
                if (assignedPlants.length > 0) {
                    setPlantOptions(assignedPlants);

                    setForm((prev) => ({
                        ...prev,
                        plantCode: prev.plantCode || assignedPlants[0],
                    }));

                    return;
                }

                /*
                 * Admin / VenFlow Manager can load all plants if no explicit plant access.
                 */
                if (cleanRole === "ADMIN" || cleanRole === "VENFLOW_MANAGER") {
                    const res = await API.get("/plants");

                    const apiPlants = extractPlantOptionsFromResponse(res.data);

                    setPlantOptions(apiPlants);

                    setForm((prev) => ({
                        ...prev,
                        plantCode: prev.plantCode || apiPlants[0] || "",
                    }));

                    return;
                }

                setPlantOptions([]);
                setError(
                    "No plant access found for this user. Please assign plant access from User Management."
                );
            } catch (err) {
                console.error("Failed to load VenFlow plants", err);

                setPlantOptions([]);
                setError(
                    err?.response?.data?.message ||
                    err?.response?.data?.error ||
                    "Failed to load plant list."
                );
            } finally {
                setPlantLoading(false);
            }
        };

        loadPlants();
    }, [assignedPlants, cleanRole]);

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

            if (!form.drawingNo.trim()) {
                setError("Drawing No. is required.");
                return;
            }

            if (!form.clientName.trim()) {
                setError("Client Name is required.");
                return;
            }

            if (!form.materialName.trim()) {
                setError("Material Name is required.");
                return;
            }

            if (!form.requiredQty || Number(form.requiredQty) <= 0) {
                setError("Required Qty must be greater than zero.");
                return;
            }

            if (!form.unit) {
                setError("Unit is required.");
                return;
            }

            setSaving(true);

            const res = await venflowApi.createEntry({
                plantCode: form.plantCode,
                orderDate: form.orderDate,
                pdNo: form.pdNo.trim(),
                drawingNo: form.drawingNo.trim(),
                clientName: form.clientName.trim(),
                materialName: form.materialName.trim(),
                veneerType: form.veneerType.trim(),
                thickness: form.thickness.trim(),
                size: form.size.trim(),
                requiredQty: form.requiredQty,
                unit: form.unit,
                bomReference: form.bomReference.trim(),
                remarks: form.remarks.trim(),
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
        <Box sx={{ maxWidth: 980 }}>
            <Typography sx={pageTitleSx}>
                New Veneer Requirement
            </Typography>

            <Typography sx={pageSubSx}>
                Engineering creates the BOM / Indent and sends it to AKG Store.
                Store will review stock, reserve material or raise purchase request
                based on availability.
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
                            disabled={plantLoading || plantOptions.length === 0}
                            sx={fieldSx}
                            SelectProps={{
                                MenuProps: darkMenuProps,
                            }}
                        >
                            {plantOptions.length === 0 ? (
                                <MenuItem value="">
                                    {plantLoading
                                        ? "Loading plants..."
                                        : "No plant assigned"}
                                </MenuItem>
                            ) : (
                                plantOptions.map((plant) => (
                                    <MenuItem
                                        key={plant}
                                        value={plant}
                                    >
                                        {plant}
                                    </MenuItem>
                                ))
                            )}
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
                            label="Drawing No."
                            value={form.drawingNo}
                            onChange={(e) =>
                                update("drawingNo", e.target.value)
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
                            label="Material Name"
                            value={form.materialName}
                            onChange={(e) =>
                                update("materialName", e.target.value)
                            }
                            required
                            sx={fieldSx}
                        />

                        <TextField
                            label="Veneer Type"
                            value={form.veneerType}
                            onChange={(e) =>
                                update("veneerType", e.target.value)
                            }
                            sx={fieldSx}
                        />

                        <TextField
                            label="Thickness"
                            value={form.thickness}
                            onChange={(e) =>
                                update("thickness", e.target.value)
                            }
                            sx={fieldSx}
                        />

                        <TextField
                            label="Size"
                            value={form.size}
                            onChange={(e) =>
                                update("size", e.target.value)
                            }
                            sx={fieldSx}
                        />

                        <TextField
                            label="Required Qty"
                            type="number"
                            value={form.requiredQty}
                            onChange={(e) =>
                                update("requiredQty", e.target.value)
                            }
                            required
                            sx={fieldSx}
                        />

                        <TextField
                            select
                            label="Unit"
                            value={form.unit}
                            onChange={(e) =>
                                update("unit", e.target.value)
                            }
                            required
                            sx={fieldSx}
                            SelectProps={{
                                MenuProps: darkMenuProps,
                            }}
                        >
                            <MenuItem value="SHEET">Sheet</MenuItem>
                            <MenuItem value="PCS">Pcs</MenuItem>
                            <MenuItem value="NO">No</MenuItem>
                            <MenuItem value="SQFT">Sqft</MenuItem>
                            <MenuItem value="SQM">Sqm</MenuItem>
                            <MenuItem value="METER">Meter</MenuItem>
                        </TextField>

                        <TextField
                            label="BOM Reference / BOM No."
                            value={form.bomReference}
                            onChange={(e) =>
                                update("bomReference", e.target.value)
                            }
                            sx={fieldSx}
                        />
                    </Box>

                    <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        label="Remarks"
                        value={form.remarks}
                        onChange={(e) =>
                            update("remarks", e.target.value)
                        }
                        sx={{ ...fieldSx, mt: 2 }}
                    />

                    <Box sx={noteSx}>
                        <Typography sx={noteTitleSx}>
                            Plant-wise controlled indent
                        </Typography>

                        <Typography sx={noteTextSx}>
                            This entry will be visible only to users having access
                            to the selected plant. After creation, Engineering can send
                            the indent to Store for stock review.
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
                            disabled={
                                saving ||
                                plantLoading ||
                                plantOptions.length === 0
                            }
                            sx={primaryBtnSx}
                        >
                            {saving ? "Creating..." : "Create Requirement"}
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