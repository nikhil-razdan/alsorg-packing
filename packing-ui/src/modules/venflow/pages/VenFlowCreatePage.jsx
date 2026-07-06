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

const safeJson = (key, fallback) => {
    try {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
        return fallback;
    }
};

const readCurrentUser = () => {
    return safeJson("currentUser", {});
};

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

const readStoredPlantCodes = () => {
    const currentUser = readCurrentUser();

    const possibleSources = [
        currentUser.plantCodes,
        currentUser.effectivePlantCodes,
        currentUser.allowedPlantCodes,
        currentUser.plants,
        safeJson("plantCodes", []),
        safeJson("effectivePlantCodes", []),
        safeJson("allowedPlantCodes", []),
        safeJson("plants", []),
    ];

    for (const source of possibleSources) {
        if (Array.isArray(source) && source.length > 0) {
            const plants = uniquePlants(source);

            if (plants.length > 0) {
                return plants;
            }
        }
    }

    return [];
};

export default function VenFlowCreatePage() {
    const navigate = useNavigate();

    const currentUser = useMemo(() => readCurrentUser(), []);

    const role = String(
        currentUser.role ||
        localStorage.getItem("role") ||
        ""
    )
        .trim()
        .toUpperCase();

    const [plantOptions, setPlantOptions] = useState([]);
    const [plantLoading, setPlantLoading] = useState(true);

    const [form, setForm] = useState({
        plantCode: "",
        orderDate: "",
        pdNo: "",
        clientName: "",
        bomReference: "",
    });

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const loadPlants = async () => {
            setPlantLoading(true);

            try {
                const storedPlants = readStoredPlantCodes();

                if (storedPlants.length > 0) {
                    setPlantOptions(storedPlants);

                    setForm((prev) => ({
                        ...prev,
                        plantCode: prev.plantCode || storedPlants[0],
                    }));

                    return;
                }

                /*
                 * Fallback: load plant master.
                 * This is needed when localStorage/currentUser does not contain plantCodes.
                 */
                const res = await API.get("/plants");

                const apiPlants = extractPlantOptionsFromResponse(res.data);

                setPlantOptions(apiPlants);

                setForm((prev) => ({
                    ...prev,
                    plantCode: prev.plantCode || apiPlants[0] || "",
                }));
            } catch (err) {
                console.error("Failed to load VenFlow plants", err);

                setPlantOptions([]);

                setError(
                    "No plant access found for this user. Please assign plant access from User Management or check /plants API response."
                );
            } finally {
                setPlantLoading(false);
            }
        };

        loadPlants();
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
                Create a new veneer indent/BOM requirement. The entry will move
                department-wise from Engineering to Store, Purchase, Processing and
                final next-stage readiness.
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
                    </Box>

                    <Box sx={noteSx}>
                        <Typography sx={noteTitleSx}>
                            Controlled plant-wise VenFlow process
                        </Typography>

                        <Typography sx={noteTextSx}>
                            This requirement will be visible only to users having access
                            to the selected plant. Store, Purchase, Processing and
                            Supervisor actions will open step-by-step based on role and
                            workflow stage.
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