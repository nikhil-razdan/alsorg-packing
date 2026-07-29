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
    TextField,
    Typography,
} from "@mui/material";

import ArrowBackIcon
    from "@mui/icons-material/ArrowBack";
import ApprovalOutlinedIcon
    from "@mui/icons-material/ApprovalOutlined";
import CallSplitOutlinedIcon
    from "@mui/icons-material/CallSplitOutlined";
import RefreshIcon
    from "@mui/icons-material/Refresh";
import SendOutlinedIcon
    from "@mui/icons-material/SendOutlined";
import UndoOutlinedIcon
    from "@mui/icons-material/UndoOutlined";

import MatFlowBomLineEditor
    from "../components/MatFlowBomLineEditor";

import {
    useNavigate,
    useParams,
} from "react-router-dom";

import { useAuth }
    from "../../../auth/AuthContext";

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

export default function MatFlowBomDetail() {
    const { bomId } =
        useParams();

    const navigate =
        useNavigate();

    const { role } =
        useAuth();

    const cleanRole =
        getMatFlowRole(role);

    const canEdit =
        canAccessMatFlowScreen(
            "bom-edit",
            cleanRole
        );

    const canApprove =
        canAccessMatFlowScreen(
            "bom-approval",
            cleanRole
        );

    const [bom, setBom] =
        useState(null);

    const [loading, setLoading] =
        useState(true);

    const [working, setWorking] =
        useState(false);

    const [error, setError] =
        useState("");

    const [actionDialog, setActionDialog] =
        useState(null);

    const [remarks, setRemarks] =
        useState("");

    const load = useCallback(async () => {
        if (!bomId) {
            return;
        }

        setLoading(true);
        setError("");

        try {
            const data =
                await matflowApi.getBom(
                    bomId
                );

            setBom(data || null);
        } catch (requestError) {
            setBom(null);

            setError(
                readMatFlowError(
                    requestError,
                    "Unable to load the operational BOM."
                )
            );
        } finally {
            setLoading(false);
        }
    }, [bomId]);

    useEffect(() => {
        load();
    }, [load]);

    const lines =
        useMemo(() => {
            const candidates = [
                bom?.lines,
                bom?.bomLines,
                bom?.items,
            ];

            return (
                candidates.find(
                    Array.isArray
                ) || []
            );
        }, [bom]);

    const status =
        String(
            bom?.status || ""
        ).toUpperCase();

    const canSubmit =
        canEdit &&
        status === "DRAFT" &&
        lines.length > 0;

    const canApproveCurrent =
        canApprove &&
        [
            "SUBMITTED",
            "UNDER_REVIEW",
        ].includes(status);

    const canReturnCurrent =
        canApprove &&
        [
            "SUBMITTED",
            "UNDER_REVIEW",
        ].includes(status);

    const canCreateRevision =
        canEdit &&
        (
            bom?.effective === true ||
            status === "APPROVED"
        );

    const openAction = (
        action
    ) => {
        setRemarks("");
        setActionDialog(action);
        setError("");
    };

    const closeAction = () => {
        if (working) {
            return;
        }

        setActionDialog(null);
        setRemarks("");
    };

    const executeAction = async () => {
        if (!bom?.id) {
            return;
        }

        if (
            actionDialog === "RETURN" &&
            !remarks.trim()
        ) {
            setError(
                "Return remarks are required."
            );
            return;
        }

        setWorking(true);
        setError("");

        const body = {
            rowVersion:
                bom.rowVersion,

            remarks:
                remarks.trim() ||
                null,
        };

        try {
            let updated = null;

            if (
                actionDialog === "SUBMIT"
            ) {
                updated =
                    await matflowApi
                        .submitBom(
                            bom.id,
                            body
                        );
            }

            if (
                actionDialog === "APPROVE"
            ) {
                updated =
                    await matflowApi
                        .approveBom(
                            bom.id,
                            body
                        );
            }

            if (
                actionDialog === "RETURN"
            ) {
                updated =
                    await matflowApi
                        .returnBom(
                            bom.id,
                            body
                        );
            }

            if (
                actionDialog === "REVISION"
            ) {
                updated =
                    await matflowApi
                        .createBomRevision(
                            bom.id,
                            body
                        );
            }

            closeAction();

            if (
                actionDialog === "REVISION" &&
                updated?.id
            ) {
                navigate(
                    `/matflow/boms/${updated.id}`,
                    {
                        replace: true,
                    }
                );

                return;
            }

            setBom(
                updated || bom
            );

            await load();
        } catch (requestError) {
            setError(
                readMatFlowError(
                    requestError,
                    "Unable to complete the BOM action."
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
                            label="OPERATIONAL BOM REVISION"
                            sx={heroBadgeSx}
                        />

                        <Typography sx={heroTitleSx}>
                            {bom?.bomNumber ||
                                bom?.bomNo ||
                                "Operational BOM"}
                        </Typography>

                        <Typography sx={heroSubSx}>
                            Revision{" "}
                            {bom?.revisionNo ?? "-"}
                            {" · "}
                            {bom?.projectCode ||
                                bom?.pdNo ||
                                "No Project"}
                            {" · "}
                            {bom?.drawingNo ||
                                "No Drawing"}
                        </Typography>
                    </Box>

                    <Box sx={headerActionsSx}>
                        <Button
                            startIcon={<RefreshIcon />}
                            onClick={load}
                            sx={secondaryBtnSx}
                        >
                            Refresh
                        </Button>

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
            </Box>

            {error && (
                <Box sx={errorBoxSx}>
                    {error}
                </Box>
            )}

            {bom && (
                <>
                    <Card sx={panelSx}>
                        <Box sx={summaryGridSx}>
                            <Detail
                                label="Status"
                                value={
                                    <MatFlowStatusChip
                                        status={bom.status}
                                    />
                                }
                            />

                            <Detail
                                label="Effective Revision"
                                value={
                                    <MatFlowStatusChip
                                        status={
                                            bom.effective ===
                                                true
                                                ? "ACTIVE"
                                                : "INACTIVE"
                                        }
                                    />
                                }
                            />

                            <Detail
                                label="Latest Revision"
                                value={
                                    bom.latestRevision ===
                                        true
                                        ? "Yes"
                                        : "No"
                                }
                            />

                            <Detail
                                label="Plant"
                                value={
                                    bom.owningPlantCode ||
                                    bom.plantCode
                                }
                            />

                            <Detail
                                label="Product"
                                value={
                                    bom.productName
                                }
                            />

                            <Detail
                                label="Client"
                                value={
                                    bom.clientName
                                }
                            />

                            <Detail
                                label="Prepared By"
                                value={
                                    bom.createdBy
                                }
                            />

                            <Detail
                                label="Row Version"
                                value={
                                    bom.rowVersion
                                }
                            />
                        </Box>

                        <Box sx={workflowActionsSx}>
                            {canSubmit && (
                                <Button
                                    startIcon={
                                        <SendOutlinedIcon />
                                    }
                                    onClick={() =>
                                        openAction(
                                            "SUBMIT"
                                        )
                                    }
                                    sx={primaryBtnSx}
                                >
                                    Submit BOM
                                </Button>
                            )}

                            {canApproveCurrent && (
                                <Button
                                    startIcon={
                                        <ApprovalOutlinedIcon />
                                    }
                                    onClick={() =>
                                        openAction(
                                            "APPROVE"
                                        )
                                    }
                                    sx={primaryBtnSx}
                                >
                                    Approve BOM
                                </Button>
                            )}

                            {canReturnCurrent && (
                                <Button
                                    startIcon={
                                        <UndoOutlinedIcon />
                                    }
                                    onClick={() =>
                                        openAction(
                                            "RETURN"
                                        )
                                    }
                                    sx={secondaryBtnSx}
                                >
                                    Return to Engineering
                                </Button>
                            )}

                            {canCreateRevision && (
                                <Button
                                    startIcon={
                                        <CallSplitOutlinedIcon />
                                    }
                                    onClick={() =>
                                        openAction(
                                            "REVISION"
                                        )
                                    }
                                    sx={secondaryBtnSx}
                                >
                                    Create New Revision
                                </Button>
                            )}
                        </Box>
                    </Card>

                    <Card sx={panelSx}>
                        <MatFlowBomLineEditor
                            bom={bom}
                            lines={lines}
                            onChanged={load}
                            onError={setError}
                        />
                    </Card>
                </>
            )}

            <Dialog
                open={Boolean(actionDialog)}
                onClose={closeAction}
                fullWidth
                maxWidth="sm"
                PaperProps={{
                    sx: dialogPaperSx,
                }}
            >
                <DialogTitle sx={dialogTitleSx}>
                    {actionTitle(
                        actionDialog
                    )}
                </DialogTitle>

                <DialogContent sx={dialogContentSx}>
                    <Typography sx={dialogMessageSx}>
                        {actionMessage(
                            actionDialog
                        )}
                    </Typography>

                    <TextField
                        label={
                            actionDialog ===
                                "RETURN"
                                ? "Remarks *"
                                : "Remarks"
                        }
                        multiline
                        minRows={3}
                        value={remarks}
                        disabled={working}
                        onChange={(event) =>
                            setRemarks(
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
                        onClick={closeAction}
                        disabled={working}
                        sx={secondaryBtnSx}
                    >
                        Cancel
                    </Button>

                    <Button
                        onClick={executeAction}
                        disabled={working}
                        sx={primaryBtnSx}
                    >
                        {working
                            ? "Working..."
                            : "Confirm"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

function actionTitle(action) {
    switch (action) {
        case "SUBMIT":
            return "Submit Operational BOM";

        case "APPROVE":
            return "Approve Operational BOM";

        case "RETURN":
            return "Return BOM to Engineering";

        case "REVISION":
            return "Create New BOM Revision";

        default:
            return "Confirm Action";
    }
}

function actionMessage(action) {
    switch (action) {
        case "SUBMIT":
            return "The draft will become read-only for Engineering until it is approved or returned.";

        case "APPROVE":
            return "This revision will become the effective operational BOM.";

        case "RETURN":
            return "The revision will be returned to Engineering for correction.";

        case "REVISION":
            return "A new draft revision will be created while the current approved revision remains effective.";

        default:
            return "";
    }
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

const workflowActionsSx = {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    flexWrap: "wrap",
    mt: "14px",
    pt: "14px",
    borderTop:
        "1px solid rgba(255,255,255,.07)",
};

const sectionHeaderSx = {
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
    "60px minmax(210px,1.2fr) minmax(230px,1.4fr) 100px 90px 110px 80px minmax(180px,1fr)";

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

const emptySx = {
    minHeight: "170px",
    display: "grid",
    placeItems: "center",
    color: "rgba(255,255,255,.50)",
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
    color: "rgba(255,255,255,.65)",
    fontSize: "12px",
    lineHeight: 1.55,
};

const dialogActionsSx = {
    p: "14px 24px 20px",
    borderTop:
        "1px solid rgba(255,255,255,.07)",
};