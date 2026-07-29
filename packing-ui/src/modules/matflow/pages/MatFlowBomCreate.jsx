import {
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
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";

import ArrowBackIcon
    from "@mui/icons-material/ArrowBack";
import SaveOutlinedIcon
    from "@mui/icons-material/SaveOutlined";

import {
    useNavigate,
} from "react-router-dom";

import {
    extractMatFlowPage,
    matflowApi,
    readMatFlowError,
} from "../api/matflowApi";

import {
    errorBoxSx,
    fieldSx,
    heroBadgeSx,
    heroSubSx,
    heroSx,
    heroTitleSx,
    loadingSx,
    pageSx,
    panelSx,
    primaryBtnSx,
    secondaryBtnSx,
} from "../matflowTheme";

const clean = (value) => {
    return String(value ?? "").trim();
};

export default function MatFlowBomCreate() {
    const navigate =
        useNavigate();

    const [projects, setProjects] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [saving, setSaving] =
        useState(false);

    const [error, setError] =
        useState("");

    const [form, setForm] =
        useState({
            projectDrawingId: "",
            remarks: "",
        });

    useEffect(() => {
        let active = true;

        const loadProjects = async () => {
            setLoading(true);
            setError("");

            try {
                const response =
                    await matflowApi.listProjects({
                        active: true,
                    });

                const result =
                    extractMatFlowPage(
                        response?.data
                    );

                if (active) {
                    setProjects(result.rows);
                }
            } catch (requestError) {
                if (active) {
                    setError(
                        readMatFlowError(
                            requestError,
                            "Unable to load project drawings."
                        )
                    );
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        loadProjects();

        return () => {
            active = false;
        };
    }, []);

    const selectedProject =
        useMemo(() => {
            return projects.find(
                (project) =>
                    String(project.id) ===
                    String(
                        form.projectDrawingId
                    )
            );
        }, [
            form.projectDrawingId,
            projects,
        ]);

    const updateForm = (
        key,
        value
    ) => {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));
    };

    const save = async () => {
        const projectDrawingId =
            String(
                form.projectDrawingId || ""
            ).trim();

        if (!projectDrawingId) {
            setError(
                "Select a valid project and drawing."
            );
            return;
        }

        if (!selectedProject?.id) {
            setError(
                "The selected project record is no longer available."
            );
            return;
        }

        const body = {
            projectDrawingId,
            remarks:
                String(
                    form.remarks || ""
                ).trim() || null,
        };

        setSaving(true);
        setError("");

        try {
            const response =
                await matflowApi
                    .createBom(body);

            const created =
                response?.data;

            if (!created?.id) {
                throw new Error(
                    "The created BOM ID was not returned."
                );
            }

            navigate(
                `/matflow/boms/${created.id}`,
                {
                    replace: true,
                }
            );
        } catch (requestError) {
            setError(
                readMatFlowError(
                    requestError,
                    "Unable to create the operational BOM."
                )
            );
        } finally {
            setSaving(false);
        }
    };

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
                <Box sx={headerRowSx}>
                    <Box>
                        <Chip
                            label="NEW OPERATIONAL BOM"
                            sx={heroBadgeSx}
                        />

                        <Typography sx={heroTitleSx}>
                            Create Operational BOM
                        </Typography>

                        <Typography sx={heroSubSx}>
                            Select a project drawing and create
                            the first operational BOM revision.
                        </Typography>
                    </Box>

                    <Button
                        startIcon={<ArrowBackIcon />}
                        onClick={() =>
                            navigate(
                                "/matflow/boms"
                            )
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

            <Card sx={panelSx}>
                <Box sx={formGridSx}>
                    <TextField
                        select
                        label="Project / Drawing *"
                        value={
                            form.projectDrawingId
                        }
                        disabled={saving}
                        onChange={(event) =>
                            updateForm(
                                "projectDrawingId",
                                event.target.value
                            )
                        }
                        sx={fieldSx}
                    >
                        {projects.map((project) => (
                            <MenuItem
                                key={project.id}
                                value={project.id}
                            >
                                {project.projectCode ||
                                    "-"}
                                {" · "}
                                {project.drawingNo ||
                                    "-"}
                                {" · "}
                                {project.productName ||
                                    "-"}
                            </MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        label="Remarks"
                        multiline
                        minRows={4}
                        value={form.remarks}
                        disabled={saving}
                        onChange={(event) =>
                            updateForm(
                                "remarks",
                                event.target.value
                            )
                        }
                        sx={{
                            ...fieldSx,
                            gridColumn:
                                "1 / -1",
                        }}
                    />
                </Box>
            </Card>

            {selectedProject && (
                <Card sx={panelSx}>
                    <Typography sx={sectionTitleSx}>
                        Selected Project Context
                    </Typography>

                    <Box sx={contextGridSx}>
                        <Detail
                            label="Project / PD"
                            value={
                                selectedProject.projectCode
                            }
                        />

                        <Detail
                            label="Drawing"
                            value={
                                selectedProject.drawingNo
                            }
                        />

                        <Detail
                            label="Product"
                            value={
                                selectedProject.productName
                            }
                        />

                        <Detail
                            label="Client"
                            value={
                                selectedProject.clientName
                            }
                        />

                        <Detail
                            label="Owning Plant"
                            value={
                                selectedProject.owningPlantCode ||
                                selectedProject.plantCode
                            }
                        />
                    </Box>
                </Card>
            )}

            <Box sx={actionRowSx}>
                <Button
                    startIcon={<SaveOutlinedIcon />}
                    onClick={save}
                    disabled={
                        saving ||
                        !form.projectDrawingId
                    }
                    sx={primaryBtnSx}
                >
                    {saving
                        ? "Creating..."
                        : "Create BOM Draft"}
                </Button>
            </Box>
        </Box>
    );
}

function Detail({
    label,
    value,
}) {
    return (
        <Box sx={detailBoxSx}>
            <Typography sx={detailLabelSx}>
                {label}
            </Typography>

            <Typography sx={detailValueSx}>
                {value || "-"}
            </Typography>
        </Box>
    );
}

const headerRowSx = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "14px",
    flexWrap: "wrap",
};

const formGridSx = {
    display: "grid",
    gridTemplateColumns:
        "repeat(2,minmax(0,1fr))",
    gap: "12px",

    "@media (max-width: 700px)": {
        gridTemplateColumns: "1fr",
    },
};

const sectionTitleSx = {
    color: "#fff",
    fontSize: "17px",
    fontWeight: 950,
};

const contextGridSx = {
    mt: "12px",
    display: "grid",
    gridTemplateColumns:
        "repeat(auto-fit,minmax(180px,1fr))",
    gap: "9px",
};

const detailBoxSx = {
    p: "11px",
    borderRadius: "9px",
    background: "rgba(2,6,23,.34)",
    border:
        "1px solid rgba(255,255,255,.06)",
};

const detailLabelSx = {
    color: "rgba(255,255,255,.48)",
    fontSize: "9.5px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".07em",
};

const detailValueSx = {
    mt: "5px",
    color: "#fff",
    fontSize: "12px",
    fontWeight: 800,
};

const actionRowSx = {
    display: "flex",
    justifyContent: "flex-end",
};