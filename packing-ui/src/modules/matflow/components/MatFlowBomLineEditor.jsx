import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";

import AddIcon
    from "@mui/icons-material/Add";
import CloseIcon
    from "@mui/icons-material/Close";
import DeleteOutlineIcon
    from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon
    from "@mui/icons-material/EditOutlined";

import {
    extractMatFlowPage,
    matflowApi,
    readMatFlowError,
} from "../api/matflowApi";

import {
    fieldSx,
    primaryBtnSx,
    secondaryBtnSx,
    tableCellSx,
    tableHeaderSx,
    tableRowSx,
    tableShellSx,
} from "../matflowTheme";

const EMPTY_FORM = {
    materialId: "",
    requiredQty: "",
    wastagePercent: "0",
    remarks: "",
};

const clean = (value) =>
    String(value ?? "").trim();

const formatQty = (value) => {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "-";
    }

    const result =
        Number(value);

    if (!Number.isFinite(result)) {
        return "-";
    }

    return result.toLocaleString(
        "en-US",
        {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3,
        }
    );
};

export default function MatFlowBomLineEditor({
    bom,
    lines = [],
    canEdit = false,
    onChanged,
    onError,
}) {
    const [materials, setMaterials] =
        useState([]);

    const [
        materialsLoading,
        setMaterialsLoading,
    ] = useState(false);

    const [dialogOpen, setDialogOpen] =
        useState(false);

    const [editingLine, setEditingLine] =
        useState(null);

    const [form, setForm] =
        useState(EMPTY_FORM);

    const [working, setWorking] =
        useState(false);

    const [localError, setLocalError] =
        useState("");

    const editable =
        canEdit &&
        [
            "DRAFT",
            "RETURNED",
        ].includes(
            String(
                bom?.status || ""
            ).toUpperCase()
        );

    const safeLines =
        Array.isArray(lines)
            ? lines
            : [];

    useEffect(() => {
        if (!editable) {
            setMaterials([]);
            setMaterialsLoading(false);

            setDialogOpen(false);
            setEditingLine(null);
            setForm({
                ...EMPTY_FORM,
            });

            return undefined;
        }

        let active = true;

        const loadMaterials = async () => {
            setMaterialsLoading(true);

            try {
                const response =
                    await matflowApi
                        .listMaterials({
                            active: true,
                        });

                const result =
                    extractMatFlowPage(
                        response?.data
                    );

                if (active) {
                    setMaterials(
                        result.rows
                    );
                }
            } catch (requestError) {
                const message =
                    readMatFlowError(
                        requestError,
                        "Unable to load materials."
                    );

                if (active) {
                    setLocalError(message);
                    onError?.(message);
                }
            } finally {
                if (active) {
                    setMaterialsLoading(
                        false
                    );
                }
            }
        };

        loadMaterials();

        return () => {
            active = false;
        };
    }, [
        editable,
        onError,
    ]);

    const selectedMaterial =
        useMemo(() => {
            return materials.find(
                (material) =>
                    String(material.id) ===
                    String(form.materialId)
            );
        }, [
            form.materialId,
            materials,
        ]);

    const calculatedNetQty =
        useMemo(() => {
            const required =
                Number(
                    form.requiredQty
                );

            const wastage =
                Number(
                    form.wastagePercent ||
                    0
                );

            if (
                !Number.isFinite(required) ||
                required <= 0 ||
                !Number.isFinite(wastage) ||
                wastage < 0
            ) {
                return 0;
            }

            return (
                required +
                required *
                (wastage / 100)
            );
        }, [
            form.requiredQty,
            form.wastagePercent,
        ]);

    const updateForm = (
        key,
        value
    ) => {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));

        if (localError) {
            setLocalError("");
        }
    };

    const openCreate = () => {
        if (!editable || working) {
            return;
        }

        setEditingLine(null);
        setForm({
            ...EMPTY_FORM,
        });
        setLocalError("");
        onError?.("");
        setDialogOpen(true);
    };

    const openEdit = (line) => {
        if (
            !editable ||
            working ||
            !line?.id
        ) {
            return;
        }

        setEditingLine(line);

        setForm({
            materialId:
                line.materialId ||
                line.material?.id ||
                "",

            requiredQty:
                String(
                    line.requiredQty ??
                    ""
                ),

            wastagePercent:
                String(
                    line.wastagePercent ??
                    0
                ),

            remarks:
                line.remarks || "",
        });

        setLocalError("");
        onError?.("");
        setDialogOpen(true);
    };

    const closeDialog = () => {
        if (working) {
            return;
        }

        setDialogOpen(false);
        setEditingLine(null);
        setForm(EMPTY_FORM);
        setLocalError("");
    };

    const validate = () => {
        const requiredQty =
            Number(
                form.requiredQty
            );

        const wastagePercent =
            Number(
                form.wastagePercent ||
                0
            );

        if (!form.materialId) {
            return "Select a material.";
        }

        if (
            !Number.isFinite(
                requiredQty
            ) ||
            requiredQty <= 0
        ) {
            return "Required quantity must be greater than zero.";
        }

        if (
            !Number.isFinite(
                wastagePercent
            ) ||
            wastagePercent < 0 ||
            wastagePercent > 1000
        ) {
            return "Wastage percentage must be between 0 and 1000.";
        }

        return "";
    };

    const save = async () => {
        const validationError =
            validate();

        if (validationError) {
            setLocalError(
                validationError
            );
            onError?.(
                validationError
            );
            return;
        }

        if (!editable) {
            const message =
                "This BOM revision is not editable.";

            setLocalError(message);
            onError?.(message);
            return;
        }

        if (!bom?.id) {
            const message =
                "The BOM ID is missing. Refresh the page and try again.";

            setLocalError(message);
            onError?.(message);
            return;
        }

        if (
            editingLine?.id &&
            (
                editingLine.rowVersion ===
                null ||
                editingLine.rowVersion ===
                undefined
            )
        ) {
            const message =
                "The BOM line version is missing. Refresh the BOM and try again.";

            setLocalError(message);
            onError?.(message);
            return;
        }

        const requiredQty =
            Number(
                form.requiredQty
            );

        const wastagePercent =
            Number(
                form.wastagePercent ||
                0
            );

        const body = {
            materialId:
                String(
                    form.materialId
                ).trim(),

            requiredQty,

            wastagePercent,

            remarks:
                clean(
                    form.remarks
                ) || null,

            /*
             * New lines do not need a row version.
             * Existing lines do.
             */
            rowVersion:
                editingLine?.id
                    ? editingLine.rowVersion
                    : null,
        };

        setWorking(true);
        setLocalError("");
        onError?.("");

        try {
            if (editingLine?.id) {
                await matflowApi
                    .updateBomLine(
                        bom.id,
                        editingLine.id,
                        body
                    );
            } else {
                await matflowApi
                    .addBomLine(
                        bom.id,
                        body
                    );
            }

            setDialogOpen(false);
            setEditingLine(null);
            setForm(EMPTY_FORM);

            await onChanged?.();
        } catch (requestError) {
            const message =
                readMatFlowError(
                    requestError,
                    "Unable to save the BOM line."
                );

            setLocalError(message);
            onError?.(message);
        } finally {
            setWorking(false);
        }
    };

    const remove = async (line) => {
        if (
            !editable ||
            !line?.id ||
            working
        ) {
            return;
        }

        if (!bom?.id) {
            const message =
                "The BOM ID is missing. Refresh the BOM and try again.";

            setLocalError(message);
            onError?.(message);
            return;
        }

        if (
            line.rowVersion === null ||
            line.rowVersion === undefined
        ) {
            const message =
                "The BOM line version is missing. Refresh the BOM and try again.";

            setLocalError(message);
            onError?.(message);
            return;
        }

        const materialName =
            line.materialName ||
            line.materialNameSnapshot ||
            line.material?.materialName ||
            "this material";

        const confirmed =
            window.confirm(
                `Remove ${materialName} from this BOM revision?`
            );

        if (!confirmed) {
            return;
        }

        setWorking(true);
        setLocalError("");
        onError?.("");

        try {
            await matflowApi
                .deleteBomLine(
                    bom.id,
                    line.id,
                    line.rowVersion
                );

            await onChanged?.();
        } catch (requestError) {
            const message =
                readMatFlowError(
                    requestError,
                    "Unable to delete the BOM line."
                );

            setLocalError(message);
            onError?.(message);
        } finally {
            setWorking(false);
        }
    };

    return (
        <Box>
            <Box sx={sectionHeaderSx}>
                <Box>
                    <Typography sx={sectionTitleSx}>
                        Material Lines
                    </Typography>

                    <Typography sx={sectionSubSx}>
                        {safeLines.length} operational
                        material line
                        {safeLines.length === 1
                            ? ""
                            : "s"}
                    </Typography>
                </Box>

                {editable && (
                    <Button
                        startIcon={<AddIcon />}
                        onClick={openCreate}
                        disabled={
                            working ||
                            materialsLoading
                        }
                        sx={primaryBtnSx}
                    >
                        Add Material
                    </Button>
                )}
            </Box>

            {localError && (
                <Box sx={localErrorSx}>
                    {localError}
                </Box>
            )}

            <Box sx={tableShellSx}>
                <Box sx={lineHeaderSx}>
                    <Box sx={tableCellSx}>
                        Line
                    </Box>

                    <Box sx={tableCellSx}>
                        Material
                    </Box>

                    <Box sx={tableCellSx}>
                        Specification
                    </Box>

                    <Box sx={tableCellSx}>
                        Required
                    </Box>

                    <Box sx={tableCellSx}>
                        Wastage
                    </Box>

                    <Box sx={tableCellSx}>
                        Net Required
                    </Box>

                    <Box sx={tableCellSx}>
                        Unit
                    </Box>

                    <Box sx={tableCellSx}>
                        Remarks
                    </Box>

                    <Box sx={tableCellSx}>
                        Action
                    </Box>
                </Box>

                {safeLines.length === 0 ? (
                    <Box sx={emptySx}>
                        No materials have been added to
                        this BOM revision.
                    </Box>
                ) : (
                    safeLines.map(
                        (line, index) => (
                            <Box
                                key={
                                    line.id ||
                                    index
                                }
                                sx={lineRowSx}
                            >
                                <Box sx={tableCellSx}>
                                    {line.lineNo ??
                                        index + 1}
                                </Box>

                                <Box sx={tableCellSx}>
                                    <Typography sx={mainTextSx}>
                                        {line.materialName ||
                                            line.materialNameSnapshot ||
                                            line.material
                                                ?.materialName ||
                                            "-"}
                                    </Typography>

                                    <Typography sx={subTextSx}>
                                        {line.materialCode ||
                                            line.materialCodeSnapshot ||
                                            line.material
                                                ?.materialCode ||
                                            "-"}
                                    </Typography>
                                </Box>

                                <Box sx={tableCellSx}>
                                    {line.specification ||
                                        line.specificationSnapshot ||
                                        "-"}
                                </Box>

                                <Box sx={tableCellSx}>
                                    {formatQty(
                                        line.requiredQty
                                    )}
                                </Box>

                                <Box sx={tableCellSx}>
                                    {formatQty(
                                        line.wastagePercent ??
                                        0
                                    )}
                                    %
                                </Box>

                                <Box sx={tableCellSx}>
                                    {formatQty(
                                        line.netRequiredQty
                                    )}
                                </Box>

                                <Box sx={tableCellSx}>
                                    {line.uom ||
                                        line.uomSnapshot ||
                                        line.material?.uom ||
                                        "-"}
                                </Box>

                                <Box sx={tableCellSx}>
                                    {line.remarks || "-"}
                                </Box>

                                <Box sx={actionCellSx}>
                                    {editable ? (
                                        <>
                                            <IconButton
                                                onClick={() =>
                                                    openEdit(
                                                        line
                                                    )
                                                }
                                                disabled={working}
                                                sx={editButtonSx}
                                            >
                                                <EditOutlinedIcon />
                                            </IconButton>

                                            <IconButton
                                                onClick={() =>
                                                    remove(
                                                        line
                                                    )
                                                }
                                                disabled={working}
                                                sx={deleteButtonSx}
                                            >
                                                <DeleteOutlineIcon />
                                            </IconButton>
                                        </>
                                    ) : (
                                        "-"
                                    )}
                                </Box>
                            </Box>
                        )
                    )
                )}
            </Box>

            <Dialog
                open={dialogOpen}
                onClose={closeDialog}
                fullWidth
                maxWidth="sm"
                PaperProps={{
                    sx: dialogPaperSx,
                }}
            >
                <DialogTitle sx={dialogTitleSx}>
                    <Box>
                        <Typography sx={dialogHeadingSx}>
                            {editingLine
                                ? "Edit BOM Material"
                                : "Add BOM Material"}
                        </Typography>

                        <Typography sx={dialogSubSx}>
                            The backend generates the line
                            number and calculates the net
                            required quantity.
                        </Typography>
                    </Box>

                    <IconButton
                        onClick={closeDialog}
                        disabled={working}
                        sx={closeButtonSx}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent sx={dialogContentSx}>
                    <Box sx={formGridSx}>
                        <TextField
                            select
                            label="Material *"
                            value={form.materialId}
                            disabled={
                                working ||
                                materialsLoading
                            }
                            onChange={(event) =>
                                updateForm(
                                    "materialId",
                                    event.target.value
                                )
                            }
                            sx={fieldSx}
                        >
                            {materials.map(
                                (material) => (
                                    <MenuItem
                                        key={material.id}
                                        value={material.id}
                                    >
                                        {material.materialCode}
                                        {" · "}
                                        {material.materialName}
                                    </MenuItem>
                                )
                            )}
                        </TextField>

                        <TextField
                            label="Required Quantity *"
                            type="number"
                            value={form.requiredQty}
                            disabled={working}
                            onChange={(event) =>
                                updateForm(
                                    "requiredQty",
                                    event.target.value
                                )
                            }
                            inputProps={{
                                min: 0.001,
                                step: 0.001,
                            }}
                            sx={fieldSx}
                        />

                        <TextField
                            label="Wastage Percentage"
                            type="number"
                            value={
                                form.wastagePercent
                            }
                            disabled={working}
                            onChange={(event) =>
                                updateForm(
                                    "wastagePercent",
                                    event.target.value
                                )
                            }
                            inputProps={{
                                min: 0,
                                max: 1000,
                                step: 0.01,
                            }}
                            sx={fieldSx}
                        />

                        <TextField
                            label="Remarks"
                            multiline
                            minRows={2}
                            value={form.remarks}
                            disabled={working}
                            onChange={(event) =>
                                updateForm(
                                    "remarks",
                                    event.target.value
                                )
                            }
                            sx={fieldSx}
                        />
                    </Box>

                    <Box sx={calculationBoxSx}>
                        <Box>
                            <Typography sx={calculationLabelSx}>
                                Selected Unit
                            </Typography>

                            <Typography sx={calculationValueSx}>
                                {selectedMaterial?.uom ||
                                    "-"}
                            </Typography>
                        </Box>

                        <Box>
                            <Typography sx={calculationLabelSx}>
                                Calculated Net Required
                            </Typography>

                            <Typography sx={calculationValueSx}>
                                {formatQty(
                                    calculatedNetQty
                                )}{" "}
                                {selectedMaterial?.uom ||
                                    ""}
                            </Typography>
                        </Box>
                    </Box>
                </DialogContent>

                <DialogActions sx={dialogActionsSx}>
                    <Button
                        onClick={closeDialog}
                        disabled={working}
                        sx={secondaryBtnSx}
                    >
                        Cancel
                    </Button>

                    <Button
                        onClick={save}
                        disabled={
                            working ||
                            materialsLoading ||
                            !editable ||
                            !form.materialId ||
                            !form.requiredQty
                        }
                        sx={primaryBtnSx}
                    >
                        {working
                            ? "Saving..."
                            : "Save Material Line"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

const sectionHeaderSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    mb: "12px",
};

const sectionTitleSx = {
    color: "#fff",
    fontSize: "17px",
    fontWeight: 950,
};

const sectionSubSx = {
    mt: "3px",
    color: "rgba(255,255,255,.52)",
    fontSize: "11px",
    fontWeight: 700,
};

const lineColumns =
    "55px minmax(210px,1.2fr) minmax(220px,1.3fr) 100px 90px 110px 75px minmax(170px,1fr) 90px";

const lineHeaderSx = {
    ...tableHeaderSx,
    gridTemplateColumns:
        lineColumns,
};

const lineRowSx = {
    ...tableRowSx,
    gridTemplateColumns:
        lineColumns,
};

const mainTextSx = {
    color: "#fff",
    fontSize: "12px",
    fontWeight: 850,
};

const subTextSx = {
    mt: "2px",
    color: "rgba(255,255,255,.47)",
    fontSize: "10px",
};

const actionCellSx = {
    ...tableCellSx,
    display: "flex",
    alignItems: "center",
    gap: "4px",
};

const editButtonSx = {
    width: "31px",
    height: "31px",
    color: "#7dd3fc",
    background:
        "rgba(14,165,233,.10)",
    border:
        "1px solid rgba(14,165,233,.20)",
};

const deleteButtonSx = {
    width: "31px",
    height: "31px",
    color: "#fca5a5",
    background:
        "rgba(239,68,68,.10)",
    border:
        "1px solid rgba(239,68,68,.20)",
};

const emptySx = {
    minHeight: "160px",
    display: "grid",
    placeItems: "center",
    color: "rgba(255,255,255,.50)",
    fontSize: "12px",
    fontWeight: 750,
};

const localErrorSx = {
    mb: "12px",
    p: "10px 12px",
    borderRadius: "9px",
    color: "#fca5a5",
    background:
        "rgba(239,68,68,.12)",
    border:
        "1px solid rgba(239,68,68,.24)",
    fontSize: "11px",
    fontWeight: 750,
};

const dialogPaperSx = {
    borderRadius: "14px",
    color: "#fff",
    background:
        "linear-gradient(180deg,#0f172a,#111827)",
    border:
        "1px solid rgba(255,255,255,.08)",
};

const dialogTitleSx = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    borderBottom:
        "1px solid rgba(255,255,255,.07)",
};

const dialogHeadingSx = {
    color: "#fff",
    fontSize: "19px",
    fontWeight: 950,
};

const dialogSubSx = {
    mt: "4px",
    color: "rgba(255,255,255,.52)",
    fontSize: "11px",
    lineHeight: 1.45,
};

const closeButtonSx = {
    color: "#94a3b8",
};

const dialogContentSx = {
    pt: "18px !important",
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

const calculationBoxSx = {
    mt: "14px",
    p: "12px",
    borderRadius: "9px",
    display: "grid",
    gridTemplateColumns:
        "repeat(2,minmax(0,1fr))",
    gap: "12px",
    background:
        "rgba(2,6,23,.36)",
    border:
        "1px solid rgba(255,255,255,.07)",
};

const calculationLabelSx = {
    color: "rgba(255,255,255,.48)",
    fontSize: "9.5px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".07em",
};

const calculationValueSx = {
    mt: "4px",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 950,
};

const dialogActionsSx = {
    p: "14px 24px 20px",
    borderTop:
        "1px solid rgba(255,255,255,.07)",
};