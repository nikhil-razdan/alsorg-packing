import {
    useCallback,
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
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    LinearProgress,
    TextField,
    Typography,
} from "@mui/material";

import ArrowBackIcon
    from "@mui/icons-material/ArrowBack";
import RefreshIcon
    from "@mui/icons-material/Refresh";
import SendOutlinedIcon
    from "@mui/icons-material/SendOutlined";

import {
    useNavigate,
    useParams,
} from "react-router-dom";

import {
    useAuth,
} from "../../../auth/AuthContext";

import {
    canAccessMatFlowScreen,
    getMatFlowRole,
} from "../../../utils/matflowAccess";

import {
    matflowApi,
    readMatFlowError,
} from "../api/matflowApi";

import MatFlowStatusChip
    from "../components/MatFlowStatusChip";

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
    tableCellSx,
    tableHeaderSx,
    tableRowSx,
    tableShellSx,
} from "../matflowTheme";

const formatQty = (value) => {
    const number =
        Number(value);

    if (!Number.isFinite(number)) {
        return "-";
    }

    return number.toLocaleString(
        "en-US",
        {
            maximumFractionDigits: 3,
        }
    );
};

const formatDate = (value) => {
    if (!value) {
        return "-";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return String(value);
    }

    return date.toLocaleString(
        "en-US",
        {
            dateStyle: "medium",
            timeStyle: "short",
        }
    );
};

export default function MatFlowRequisitionDetail() {
    const {
        requisitionId,
    } = useParams();

    const navigate =
        useNavigate();

    const {
        role,
        user,
    } = useAuth();

    const cleanRole =
        getMatFlowRole(
            role ||
            user?.role
        );

    const productionAccess =
        canAccessMatFlowScreen(
            "production",
            cleanRole
        );

    const [
        requisition,
        setRequisition,
    ] = useState(null);

    const [loading, setLoading] =
        useState(true);

    const [working, setWorking] =
        useState(false);

    const [error, setError] =
        useState("");

    const [
        submitDialogOpen,
        setSubmitDialogOpen,
    ] = useState(false);

    const [
        submitRemarks,
        setSubmitRemarks,
    ] = useState("");

    const load = useCallback(async () => {
        if (!requisitionId) {
            setError(
                "Requisition ID is missing."
            );

            setLoading(false);
            return;
        }

        setLoading(true);
        setError("");

        try {
            const response =
                await matflowApi
                    .getRequisition(
                        requisitionId
                    );

            setRequisition(
                response?.data ||
                null
            );
        } catch (requestError) {
            setRequisition(null);

            setError(
                readMatFlowError(
                    requestError,
                    "Unable to load the material requisition."
                )
            );
        } finally {
            setLoading(false);
        }
    }, [requisitionId]);

    useEffect(() => {
        load();
    }, [load]);

    const lines =
        useMemo(() => {
            return Array.isArray(
                requisition?.lines
            )
                ? requisition.lines
                : [];
        }, [requisition]);

    const totals =
        useMemo(() => {
            return lines.reduce(
                (
                    result,
                    line
                ) => {
                    result.requested +=
                        Number(
                            line.requestedQty ||
                            0
                        );

                    result.reserved +=
                        Number(
                            line.reservedQty ||
                            0
                        );

                    result.shortage +=
                        Number(
                            line.shortageQty ||
                            0
                        );

                    result.issued +=
                        Number(
                            line.issuedQty ||
                            0
                        );

                    return result;
                },
                {
                    requested: 0,
                    reserved: 0,
                    shortage: 0,
                    issued: 0,
                }
            );
        }, [lines]);

    const status =
        String(
            requisition?.status ||
            ""
        ).toUpperCase();

    const canSubmit =
        productionAccess &&
        status === "DRAFT" &&
        lines.length > 0 &&
        requisition?.rowVersion !==
        null &&
        requisition?.rowVersion !==
        undefined;

    const reservedPercent =
        totals.requested > 0
            ? Math.min(
                100,
                Math.round(
                    (
                        totals.reserved /
                        totals.requested
                    ) *
                    100
                )
            )
            : 0;

    const submit =
        async () => {
            if (!canSubmit) {
                setError(
                    "This requisition cannot be submitted."
                );
                return;
            }

            const body = {
                rowVersion:
                    requisition.rowVersion,

                remarks:
                    String(
                        submitRemarks ||
                        ""
                    ).trim() ||
                    null,
            };

            setWorking(true);
            setError("");

            try {
                const response =
                    await matflowApi
                        .submitRequisition(
                            requisition.id,
                            body
                        );

                setRequisition(
                    response?.data ||
                    requisition
                );

                setSubmitDialogOpen(
                    false
                );

                setSubmitRemarks("");
            } catch (requestError) {
                setError(
                    readMatFlowError(
                        requestError,
                        "Unable to submit the requisition."
                    )
                );
            } finally {
                setWorking(false);
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
                            label="PRODUCTION MATERIAL REQUISITION"
                            sx={heroBadgeSx}
                        />

                        <Typography sx={heroTitleSx}>
                            {requisition?.requisitionNumber ||
                                "Material Requisition"}
                        </Typography>

                        <Typography sx={heroSubSx}>
                            {requisition?.projectCode ||
                                "No Project"}
                            {" · "}
                            {requisition?.drawingNo ||
                                "No Drawing"}
                            {" · "}
                            {requisition?.bomNumber ||
                                "No BOM"}
                        </Typography>
                    </Box>

                    <Box sx={headerActionsSx}>
                        <Button
                            startIcon={
                                <RefreshIcon />
                            }
                            onClick={load}
                            disabled={working}
                            sx={secondaryBtnSx}
                        >
                            Refresh
                        </Button>

                        <Button
                            startIcon={
                                <ArrowBackIcon />
                            }
                            onClick={() =>
                                navigate(
                                    "/matflow/production"
                                )
                            }
                            sx={secondaryBtnSx}
                        >
                            Back
                        </Button>
                    </Box>
                </Box>
            </Box>

            {error && (
                <Box sx={errorBoxSx}>
                    {error}
                </Box>
            )}

            {requisition && (
                <>
                    <Box sx={summaryGridSx}>
                        <SummaryCard
                            label="Status"
                            value={
                                <MatFlowStatusChip
                                    status={
                                        requisition.status
                                    }
                                />
                            }
                        />

                        <SummaryCard
                            label="Requested"
                            value={
                                formatQty(
                                    totals.requested
                                )
                            }
                        />

                        <SummaryCard
                            label="Reserved"
                            value={
                                formatQty(
                                    totals.reserved
                                )
                            }
                        />

                        <SummaryCard
                            label="Shortage"
                            value={
                                formatQty(
                                    totals.shortage
                                )
                            }
                        />

                        <SummaryCard
                            label="Issued"
                            value={
                                formatQty(
                                    totals.issued
                                )
                            }
                        />
                    </Box>

                    <Card sx={panelSx}>
                        <Box sx={detailGridSx}>
                            <Detail
                                label="Project"
                                value={
                                    requisition.projectCode
                                }
                            />

                            <Detail
                                label="Drawing"
                                value={
                                    requisition.drawingNo
                                }
                            />

                            <Detail
                                label="BOM"
                                value={
                                    requisition.bomNumber
                                }
                            />

                            <Detail
                                label="BOM Revision"
                                value={
                                    requisition.bomRevisionNo
                                }
                            />

                            <Detail
                                label="Destination"
                                value={
                                    requisition.destinationLocationName ||
                                    requisition.destinationLocationCode
                                }
                            />

                            <Detail
                                label="Destination Plant"
                                value={
                                    requisition.destinationPlantCode
                                }
                            />

                            <Detail
                                label="Requested By"
                                value={
                                    requisition.requestedBy
                                }
                            />

                            <Detail
                                label="Requested At"
                                value={
                                    formatDate(
                                        requisition.requestedAt
                                    )
                                }
                            />

                            <Detail
                                label="Submitted By"
                                value={
                                    requisition.submittedBy
                                }
                            />

                            <Detail
                                label="Submitted At"
                                value={
                                    formatDate(
                                        requisition.submittedAt
                                    )
                                }
                            />

                            <Detail
                                label="Planned By"
                                value={
                                    requisition.plannedBy
                                }
                            />

                            <Detail
                                label="Planned At"
                                value={
                                    formatDate(
                                        requisition.plannedAt
                                    )
                                }
                            />

                            <Detail
                                label="Row Version"
                                value={
                                    requisition.rowVersion
                                }
                            />

                            <Detail
                                label="Remarks"
                                value={
                                    requisition.remarks
                                }
                            />
                        </Box>

                        <Box sx={progressAreaSx}>
                            <Box sx={progressHeaderSx}>
                                <Typography sx={progressLabelSx}>
                                    Reservation Progress
                                </Typography>

                                <Typography sx={progressValueSx}>
                                    {reservedPercent}%
                                </Typography>
                            </Box>

                            <LinearProgress
                                variant="determinate"
                                value={
                                    reservedPercent
                                }
                                sx={progressSx}
                            />
                        </Box>

                        {canSubmit && (
                            <Box sx={workflowActionsSx}>
                                <Button
                                    startIcon={
                                        <SendOutlinedIcon />
                                    }
                                    onClick={() => {
                                        setSubmitRemarks(
                                            ""
                                        );

                                        setSubmitDialogOpen(
                                            true
                                        );

                                        setError("");
                                    }}
                                    disabled={working}
                                    sx={primaryBtnSx}
                                >
                                    Submit to Store
                                </Button>
                            </Box>
                        )}
                    </Card>

                    <Card sx={panelSx}>
                        <Typography sx={sectionTitleSx}>
                            Requisition Material Lines
                        </Typography>

                        <Box
                            sx={{
                                ...tableShellSx,
                                mt: "12px",
                            }}
                        >
                            <Box sx={lineHeaderSx}>
                                <Box sx={tableCellSx}>
                                    Line
                                </Box>

                                <Box sx={tableCellSx}>
                                    Material
                                </Box>

                                <Box sx={tableCellSx}>
                                    BOM Quantity
                                </Box>

                                <Box sx={tableCellSx}>
                                    Requested
                                </Box>

                                <Box sx={tableCellSx}>
                                    Reserved
                                </Box>

                                <Box sx={tableCellSx}>
                                    Shortage
                                </Box>

                                <Box sx={tableCellSx}>
                                    Issued
                                </Box>

                                <Box sx={tableCellSx}>
                                    Consumed
                                </Box>

                                <Box sx={tableCellSx}>
                                    Returned
                                </Box>

                                <Box sx={tableCellSx}>
                                    Unit
                                </Box>
                            </Box>

                            {lines.length === 0 ? (
                                <Box sx={emptySx}>
                                    No requisition lines were returned.
                                </Box>
                            ) : (
                                lines.map(
                                    (
                                        line,
                                        index
                                    ) => (
                                        <Box
                                            key={
                                                line.id ||
                                                index
                                            }
                                            sx={lineRowSx}
                                        >
                                            <Box sx={tableCellSx}>
                                                {line.lineNo ??
                                                    index +
                                                    1}
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                <Typography sx={mainTextSx}>
                                                    {line.materialName ||
                                                        "-"}
                                                </Typography>

                                                <Typography sx={subTextSx}>
                                                    {line.materialCode ||
                                                        "-"}
                                                </Typography>
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                {formatQty(
                                                    line.bomRequiredQty
                                                )}
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                {formatQty(
                                                    line.requestedQty
                                                )}
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                {formatQty(
                                                    line.reservedQty
                                                )}
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                {formatQty(
                                                    line.shortageQty
                                                )}
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                {formatQty(
                                                    line.issuedQty
                                                )}
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                {formatQty(
                                                    line.consumedQty
                                                )}
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                {formatQty(
                                                    line.returnedQty
                                                )}
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                {line.uom ||
                                                    "-"}
                                            </Box>
                                        </Box>
                                    )
                                )
                            )}
                        </Box>
                    </Card>
                </>
            )}

            <Dialog
                open={
                    submitDialogOpen
                }
                onClose={() => {
                    if (!working) {
                        setSubmitDialogOpen(
                            false
                        );
                    }
                }}
                fullWidth
                maxWidth="sm"
                PaperProps={{
                    sx: dialogPaperSx,
                }}
            >
                <DialogTitle sx={dialogTitleSx}>
                    Submit Requisition to Store
                </DialogTitle>

                <DialogContent sx={dialogContentSx}>
                    <Typography sx={dialogMessageSx}>
                        After submission, Production cannot
                        change the requisition through the
                        current controller. Store will perform
                        reservation and shortage planning.
                    </Typography>

                    <TextField
                        label="Submission Remarks"
                        multiline
                        minRows={3}
                        fullWidth
                        value={
                            submitRemarks
                        }
                        disabled={working}
                        onChange={(event) =>
                            setSubmitRemarks(
                                event.target.value
                            )
                        }
                        sx={{
                            ...fieldSx,
                            mt: "14px",
                        }}
                    />
                </DialogContent>

                <DialogActions sx={dialogActionsSx}>
                    <Button
                        onClick={() =>
                            setSubmitDialogOpen(
                                false
                            )
                        }
                        disabled={working}
                        sx={secondaryBtnSx}
                    >
                        Cancel
                    </Button>

                    <Button
                        onClick={submit}
                        disabled={working}
                        sx={primaryBtnSx}
                    >
                        {working
                            ? "Submitting..."
                            : "Confirm Submission"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

function SummaryCard({
    label,
    value,
}) {
    return (
        <Card sx={summaryCardSx}>
            <Typography sx={summaryLabelSx}>
                {label}
            </Typography>

            <Box sx={summaryValueSx}>
                {value ?? "-"}
            </Box>
        </Card>
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

            <Box sx={detailValueSx}>
                {value ?? "-"}
            </Box>
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

const headerActionsSx = {
    display: "flex",
    gap: "7px",
};

const summaryGridSx = {
    display: "grid",
    gridTemplateColumns:
        "repeat(auto-fit,minmax(170px,1fr))",
    gap: "10px",
};

const summaryCardSx = {
    p: "13px",
    borderRadius: "11px",
    background:
        "rgba(15,23,42,.82)",
    border:
        "1px solid rgba(255,255,255,.07)",
};

const summaryLabelSx = {
    color:
        "rgba(255,255,255,.50)",
    fontSize: "9.5px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".07em",
};

const summaryValueSx = {
    mt: "6px",
    color: "#fff",
    fontSize: "16px",
    fontWeight: 950,
};

const detailGridSx = {
    display: "grid",
    gridTemplateColumns:
        "repeat(auto-fit,minmax(180px,1fr))",
    gap: "9px",
};

const detailBoxSx = {
    p: "11px",
    borderRadius: "9px",
    background:
        "rgba(2,6,23,.34)",
    border:
        "1px solid rgba(255,255,255,.06)",
};

const detailLabelSx = {
    color:
        "rgba(255,255,255,.48)",
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
    wordBreak: "break-word",
};

const progressAreaSx = {
    mt: "14px",
    pt: "14px",
    borderTop:
        "1px solid rgba(255,255,255,.07)",
};

const progressHeaderSx = {
    display: "flex",
    justifyContent: "space-between",
    mb: "7px",
};

const progressLabelSx = {
    color:
        "rgba(255,255,255,.58)",
    fontSize: "11px",
    fontWeight: 800,
};

const progressValueSx = {
    color: "#fff",
    fontSize: "11px",
    fontWeight: 900,
};

const progressSx = {
    height: "7px",
    borderRadius: 999,
    background:
        "rgba(255,255,255,.07)",

    "& .MuiLinearProgress-bar": {
        borderRadius: 999,
        background:
            "linear-gradient(135deg,#22c55e,#4ade80)",
    },
};

const workflowActionsSx = {
    display: "flex",
    justifyContent: "flex-end",
    mt: "14px",
};

const sectionTitleSx = {
    color: "#fff",
    fontSize: "17px",
    fontWeight: 950,
};

const lineColumns =
    "55px minmax(210px,1.3fr) 110px 105px 100px 100px 90px 95px 90px 70px";

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
    color:
        "rgba(255,255,255,.47)",
    fontSize: "10px",
};

const emptySx = {
    minHeight: "160px",
    display: "grid",
    placeItems: "center",
    color:
        "rgba(255,255,255,.50)",
    fontSize: "12px",
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
    color: "#fff",
    fontWeight: 950,
    borderBottom:
        "1px solid rgba(255,255,255,.07)",
};

const dialogContentSx = {
    pt: "18px !important",
};

const dialogMessageSx = {
    color:
        "rgba(255,255,255,.65)",
    fontSize: "12px",
    lineHeight: 1.55,
};

const dialogActionsSx = {
    p: "14px 24px 20px",
    borderTop:
        "1px solid rgba(255,255,255,.07)",
};