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
    MATFLOW_ROLES,
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
    detailBoxSx,
    detailLabelSx,
    detailValueSx,
    dialogActionsSx,
    dialogContentSx,
    dialogMessageSx,
    dialogPaperSx,
    dialogTitleSx,
} from "../matflowTheme";

export default function MatFlowBomDetail() {
    const { bomId } = useParams();
    const navigate = useNavigate();

    const {
        role,
        user,
    } = useAuth();

    const cleanRole =
        getMatFlowRole(
            role ||
            user?.role
        );

    const isEngineeringRole = [
        MATFLOW_ROLES.ADMIN,
        MATFLOW_ROLES.MANAGER,
        MATFLOW_ROLES.ENGINEERING,
    ].includes(
        cleanRole
    );

    const isHodRole = [
        MATFLOW_ROLES.ADMIN,
        MATFLOW_ROLES.MANAGER,
    ].includes(
        cleanRole
    );

    const isProductionRole = [
        MATFLOW_ROLES.ADMIN,
        MATFLOW_ROLES.MANAGER,
        MATFLOW_ROLES.PRODUCTION,
    ].includes(
        cleanRole
    );

    const canOpenBomEditor =
        canAccessMatFlowScreen(
            "bom-edit",
            cleanRole
        ) ||
        isEngineeringRole;

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

    const workflow =
        useMemo(() => {
            switch (status) {
                case "DRAFT":
                case "RETURNED":
                    return {
                        department:
                            "Engineering",

                        nextAction:
                            lines.length > 0
                                ? "Submit BOM to HOD"
                                : "Add Material Lines",
                    };

                case "SUBMITTED":
                case "SUBMITTED_TO_HOD":
                    return {
                        department:
                            "HOD / MatFlow Manager",

                        nextAction:
                            "Approve or Return BOM",
                    };

                case "PRODUCTION_REVIEW_PENDING":
                    return {
                        department:
                            "Production",

                        nextAction:
                            "Review Manufacturing Requirements",
                    };

                case "APPROVED":
                    return {
                        department:
                            "Store and Production",

                        nextAction:
                            "Raise Material Requisition",
                    };

                case "SUPERSEDED":
                    return {
                        department:
                            "Engineering",

                        nextAction:
                            "Use Latest Effective Revision",
                    };

                default:
                    return {
                        department:
                            "MatFlow",

                        nextAction:
                            "Review BOM Status",
                    };
            }
        }, [
            lines.length,
            status,
        ]);

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

    const isLatestRevision =
        bom?.latestRevision ===
        true;

    const isEditableStatus =
        [
            "DRAFT",
            "RETURNED",
        ].includes(
            status
        );

    const canEditCurrent =
        isEngineeringRole &&
        isLatestRevision &&
        isEditableStatus;

    const canSubmitCurrent =
        canEditCurrent &&
        lines.length > 0;

    const canHodApproveCurrent =
        isHodRole &&
        [
            "SUBMITTED",
            "SUBMITTED_TO_HOD",
        ].includes(
            status
        );

    const canHodReturnCurrent =
        canHodApproveCurrent;

    const canProductionApproveCurrent =
        isProductionRole &&
        status ===
        "PRODUCTION_REVIEW_PENDING";

    const canProductionReturnCurrent =
        canProductionApproveCurrent;

    const canCreateRevision =
        isEngineeringRole &&
        status ===
        "APPROVED" &&
        bom?.effective ===
        true &&
        isLatestRevision;

    const canRaiseRequisition =
        isProductionRole &&
        status ===
        "APPROVED" &&
        bom?.effective ===
        true &&
        isLatestRevision;

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

        const returnAction =
            [
                "HOD_RETURN",
                "PRODUCTION_RETURN",
            ].includes(
                actionDialog
            );

        if (
            returnAction &&
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

                case "HOD_APPROVE":
                    response =
                        await matflowApi
                            .approveBom(
                                bom.id,
                                body
                            );
                    break;

                case "HOD_RETURN":
                    response =
                        await matflowApi
                            .returnBom(
                                bom.id,
                                body
                            );
                    break;

                case "PRODUCTION_APPROVE":
                    response =
                        await matflowApi
                            .productionApproveBom(
                                bom.id,
                                body
                            );
                    break;

                case "PRODUCTION_RETURN":
                    response =
                        await matflowApi
                            .productionReturnBom(
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
                    throw new Error(
                        "Unsupported BOM action."
                    );
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

                            <Detail
                                label="Responsible Department"
                                value={
                                    workflow.department
                                }
                            />

                            <Detail
                                label="Next Workflow Action"
                                value={
                                    workflow.nextAction
                                }
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

                            {canHodApproveCurrent && (
                                <Button
                                    startIcon={
                                        <ApprovalOutlinedIcon />
                                    }
                                    onClick={() =>
                                        openAction(
                                            "HOD_APPROVE"
                                        )
                                    }
                                    disabled={working}
                                    sx={primaryBtnSx}
                                >
                                    HOD Approve & Send to Production
                                </Button>
                            )}

                            {canHodReturnCurrent && (
                                <Button
                                    startIcon={
                                        <UndoOutlinedIcon />
                                    }
                                    onClick={() =>
                                        openAction(
                                            "HOD_RETURN"
                                        )
                                    }
                                    disabled={working}
                                    sx={secondaryBtnSx}
                                >
                                    Return to Engineering
                                </Button>
                            )}

                            {canProductionApproveCurrent && (
                                <Button
                                    startIcon={
                                        <ApprovalOutlinedIcon />
                                    }
                                    onClick={() =>
                                        openAction(
                                            "PRODUCTION_APPROVE"
                                        )
                                    }
                                    disabled={working}
                                    sx={primaryBtnSx}
                                >
                                    Production Review & Approve
                                </Button>
                            )}

                            {canProductionReturnCurrent && (
                                <Button
                                    startIcon={
                                        <UndoOutlinedIcon />
                                    }
                                    onClick={() =>
                                        openAction(
                                            "PRODUCTION_RETURN"
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
                        canEdit={
                            canEditCurrent
                        }
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
                            [
                                "HOD_RETURN",
                                "PRODUCTION_RETURN",
                            ].includes(
                                actionDialog
                            )
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

function actionTitle(
    action
) {
    switch (action) {
        case "SUBMIT":
            return "Submit Operational BOM";

        case "HOD_APPROVE":
            return "HOD Approval";

        case "HOD_RETURN":
            return "Return BOM to Engineering";

        case "PRODUCTION_APPROVE":
            return "Production Review and Approval";

        case "PRODUCTION_RETURN":
            return "Return BOM from Production Review";

        case "REVISION":
            return "Create New BOM Revision";

        default:
            return "Confirm BOM Action";
    }
}

function actionMessage(
    action
) {
    switch (action) {
        case "SUBMIT":
            return "Engineering will submit this BOM to the HOD for review.";

        case "HOD_APPROVE":
            return "The HOD approval will move this BOM to Production Review. It will not become effective until Production approves it.";

        case "HOD_RETURN":
            return "The BOM will be returned to Engineering for correction.";

        case "PRODUCTION_APPROVE":
            return "Production confirms that this BOM is suitable for manufacturing. This revision will become the effective operational BOM.";

        case "PRODUCTION_RETURN":
            return "Production will return the BOM to Engineering with correction remarks.";

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

const workflowActionsSx = {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    flexWrap: "wrap",
    mt: "14px",
    pt: "14px",
    borderTop:
        "1px solid var(--mf-border)",
};

