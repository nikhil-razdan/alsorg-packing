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
import PlaylistAddOutlinedIcon
    from "@mui/icons-material/PlaylistAddOutlined";

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

import MatFlowBomLineEditor
    from "../components/MatFlowBomLineEditor";

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
} from "../matflowTheme";

export default function MatFlowBomDetail() {
    const { bomId } = useParams();
    const navigate = useNavigate();

    const { role } = useAuth();

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
            setBom(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError("");

        try {
            const response =
                await matflowApi.getBom(
                    bomId
                );

            setBom(
                response?.data || null
            );
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

    const project =
        useMemo(() => {
            return (
                bom?.projectDrawing ||
                bom?.project ||
                bom?.projectContext ||
                {}
            );
        }, [bom]);

    const status =
        String(
            bom?.status || ""
        ).toUpperCase();

    const canSubmitCurrent =
        canEdit &&
        [
            "DRAFT",
            "RETURNED",
        ].includes(status) &&
        lines.length > 0;

    const canApproveCurrent =
        canApprove &&
        status === "SUBMITTED";

    const canReturnCurrent =
        canApprove &&
        status === "SUBMITTED";

    const canCreateRevision =
        canEdit &&
        status === "APPROVED" &&
        bom?.effective === true &&
        bom?.latestRevision === true;

    const canRaiseRequisition =
        canAccessMatFlowScreen(
            "production",
            cleanRole
        ) &&
        status === "APPROVED" &&
        bom?.effective === true;

    const openAction = (action) => {
        setActionDialog(action);
        setRemarks("");
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
        if (!bom?.id || !actionDialog) {
            return;
        }

        const cleanedRemarks =
            String(
                remarks || ""
            ).trim();

        if (
            actionDialog === "RETURN" &&
            !cleanedRemarks
        ) {
            setError(
                "Return remarks are required."
            );
            return;
        }

        const body = {
            rowVersion:
                bom.rowVersion,

            remarks:
                cleanedRemarks || null,
        };

        setWorking(true);
        setError("");

        try {
            let response;

            switch (actionDialog) {
                case "SUBMIT":
                    response =
                        await matflowApi
                            .submitBom(
                                bom.id,
                                body
                            );
                    break;

                case "APPROVE":
                    response =
                        await matflowApi
                            .approveBom(
                                bom.id,
                                body
                            );
                    break;

                case "RETURN":
                    response =
                        await matflowApi
                            .returnBom(
                                bom.id,
                                body
                            );
                    break;

                case "REVISION":
                    response =
                        await matflowApi
                            .createBomRevision(
                                bom.id,
                                body
                            );
                    break;

                default:
                    return;
            }

            const updated =
                response?.data;

            const completedAction =
                actionDialog;

            setActionDialog(null);
            setRemarks("");

            if (
                completedAction ===
                "REVISION" &&
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

            if (updated?.id) {
                setBom(updated);
            } else {
                await load();
            }
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
                                "Operational BOM"}
                        </Typography>

                        <Typography sx={heroSubSx}>
                            Revision{" "}
                            {bom?.revisionNo ?? "-"}
                            {" · "}
                            {project.projectCode ||
                                bom?.projectCode ||
                                "No Project"}
                            {" · "}
                            {project.drawingNo ||
                                bom?.drawingNo ||
                                "No Drawing"}
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
                                            bom.effective
                                                ? "ACTIVE"
                                                : "INACTIVE"
                                        }
                                    />
                                }
                            />

                            <Detail
                                label="Latest Revision"
                                value={
                                    bom.latestRevision
                                        ? "Yes"
                                        : "No"
                                }
                            />

                            <Detail
                                label="Plant"
                                value={
                                    project.plantCode ||
                                    bom.plantCode
                                }
                            />

                            <Detail
                                label="Product"
                                value={
                                    project.productName ||
                                    bom.productName
                                }
                            />

                            <Detail
                                label="Client"
                                value={
                                    project.clientName ||
                                    bom.clientName
                                }
                            />

                            <Detail
                                label="Prepared By"
                                value={bom.createdBy}
                            />

                            <Detail
                                label="Row Version"
                                value={bom.rowVersion}
                            />
                        </Box>

                        <Box sx={workflowActionsSx}>
                            {canSubmitCurrent && (
                                <Button
                                    startIcon={
                                        <SendOutlinedIcon />
                                    }
                                    onClick={() =>
                                        openAction(
                                            "SUBMIT"
                                        )
                                    }
                                    disabled={working}
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
                                    disabled={working}
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
                                    disabled={working}
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
                                    disabled={working}
                                    sx={secondaryBtnSx}
                                >
                                    Create New Revision
                                </Button>
                            )}

                            {canRaiseRequisition && (
                                <Button
                                    startIcon={
                                        <PlaylistAddOutlinedIcon />
                                    }
                                    onClick={() =>
                                        navigate(
                                            `/matflow/requisitions/new?bomId=${bom.id}`
                                        )
                                    }
                                    disabled={working}
                                    sx={primaryBtnSx}
                                >
                                    Raise Production Requisition
                                </Button>
                            )}
                        </Box>
                    </Card>

                    <MatFlowBomLineEditor
                        bom={bom}
                        lines={lines}
                        canEdit={canEdit}
                        onChanged={load}
                        onError={setError}
                    />
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
                        fullWidth
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
            return "The BOM will be submitted for authorized review.";

        case "APPROVE":
            return "This revision will become the effective operational BOM.";

        case "RETURN":
            return "The BOM will be returned to Engineering for correction.";

        case "REVISION":
            return "A new draft revision will be created while the approved revision remains effective.";

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