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

import {
    useAuth,
} from "../../../auth/AuthContext";

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
    detailBoxSx,
    detailLabelSx,
    detailValueSx,
    dialogActionsSx,
    dialogContentSx,
    dialogMessageSx,
    dialogPaperSx,
    dialogTitleSx,
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

const normalizeStatus = (
    value
) =>
    String(
        value ?? ""
    )
        .trim()
        .toUpperCase();

const hasRowVersion = (
    value
) =>
    value !== null &&
    value !== undefined;

export default function MatFlowBomDetail() {
    const {
        bomId,
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

    /*
     * =====================================================
     * ROLE PERMISSIONS
     * =====================================================
     */

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

    const hasBomEditPermission =
        canAccessMatFlowScreen(
            "bom-edit",
            cleanRole
        ) ||
        isEngineeringRole;

    const hasProductionPermission =
        canAccessMatFlowScreen(
            "production",
            cleanRole
        ) ||
        isProductionRole;

    /*
     * =====================================================
     * STATE
     * =====================================================
     */

    const [
        bom,
        setBom,
    ] = useState(null);

    const [
        loading,
        setLoading,
    ] = useState(true);

    const [
        working,
        setWorking,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState("");

    const [
        actionDialog,
        setActionDialog,
    ] = useState(null);

    const [
        remarks,
        setRemarks,
    ] = useState("");

    /*
     * =====================================================
     * LOAD BOM
     * =====================================================
     */

    const load =
        useCallback(
            async () => {
                if (!bomId) {
                    setBom(null);
                    setLoading(false);

                    setError(
                        "Operational BOM ID is missing."
                    );

                    return;
                }

                setLoading(true);
                setError("");

                try {
                    const response =
                        await matflowApi
                            .getBom(
                                bomId
                            );

                    setBom(
                        response?.data ??
                        null
                    );
                } catch (
                requestError
                ) {
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
            },
            [
                bomId,
            ]
        );

    useEffect(() => {
        load();
    }, [load]);

    /*
     * =====================================================
     * DERIVED BOM DATA
     * =====================================================
     *
     * These values are declared before workflow and action
     * conditions. This avoids temporal-dead-zone errors such as:
     *
     * Cannot access '<symbol>' before initialization.
     */

    const lines =
        useMemo(
            () => {
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
            },
            [
                bom,
            ]
        );

    const project =
        useMemo(
            () => (
                bom?.projectDrawing ||
                bom?.project ||
                bom?.projectContext ||
                {}
            ),
            [
                bom,
            ]
        );

    const status =
        normalizeStatus(
            bom?.status
        );

    const isLatestRevision =
        bom?.latestRevision ===
        true;

    const isEffectiveRevision =
        bom?.effective ===
        true;

    const currentRowVersionAvailable =
        hasRowVersion(
            bom?.rowVersion
        );

    /*
     * =====================================================
     * ACTION AVAILABILITY
     * =====================================================
     */

    const isEditableStatus = [
        "DRAFT",
        "RETURNED",
    ].includes(
        status
    );

    const canEditCurrent =
        hasBomEditPermission &&
        isEngineeringRole &&
        isLatestRevision &&
        isEditableStatus;

    const canSubmitCurrent =
        canEditCurrent &&
        currentRowVersionAvailable &&
        lines.length > 0;

    const canHodApproveCurrent =
        isHodRole &&
        currentRowVersionAvailable &&
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
        currentRowVersionAvailable &&
        status ===
        "PRODUCTION_REVIEW_PENDING";

    const canProductionReturnCurrent =
        canProductionApproveCurrent;

    const canCreateRevision =
        isEngineeringRole &&
        currentRowVersionAvailable &&
        status ===
        "APPROVED" &&
        isEffectiveRevision &&
        isLatestRevision;

    const canRaiseRequisition =
        hasProductionPermission &&
        status ===
        "APPROVED" &&
        isEffectiveRevision &&
        isLatestRevision;

    const hasVisibleWorkflowAction =
        canSubmitCurrent ||
        canHodApproveCurrent ||
        canHodReturnCurrent ||
        canProductionApproveCurrent ||
        canProductionReturnCurrent ||
        canCreateRevision ||
        canRaiseRequisition;

    /*
     * =====================================================
     * RESPONSIBLE DEPARTMENT / NEXT ACTION
     * =====================================================
     */

    const workflow =
        useMemo(
            () => {
                switch (status) {
                    case "DRAFT":
                        return {
                            department:
                                "Engineering",

                            nextAction:
                                lines.length > 0
                                    ? "Submit BOM to HOD"
                                    : "Add Material Lines",
                        };

                    case "RETURNED":
                        return {
                            department:
                                "Engineering",

                            nextAction:
                                lines.length > 0
                                    ? "Correct BOM and Resubmit"
                                    : "Add Corrected Material Lines",
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
                                isEffectiveRevision
                                    ? "Store / Production"
                                    : "MatFlow Manager",

                            nextAction:
                                isEffectiveRevision
                                    ? "Raise Material Requisition"
                                    : "Resolve Effective Revision",
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
            },
            [
                isEffectiveRevision,
                lines.length,
                status,
            ]
        );

    /*
     * =====================================================
     * DIALOG ACTIONS
     * =====================================================
     */

    const openAction = (
        action
    ) => {
        if (!bom?.id) {
            setError(
                "Operational BOM data is unavailable."
            );

            return;
        }

        if (
            !currentRowVersionAvailable
        ) {
            setError(
                "BOM row version is missing. Refresh the page and retry."
            );

            return;
        }

        setActionDialog(
            action
        );

        setRemarks("");
        setError("");
    };

    const closeAction =
        () => {
            if (working) {
                return;
            }

            setActionDialog(null);
            setRemarks("");
        };

    const executeAction =
        async () => {
            if (
                !bom?.id ||
                !actionDialog
            ) {
                return;
            }

            if (
                !hasRowVersion(
                    bom.rowVersion
                )
            ) {
                setError(
                    "BOM row version is missing. Refresh the page and retry."
                );

                return;
            }

            const cleanedRemarks =
                String(
                    remarks ??
                    ""
                ).trim();

            const returnAction = [
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
                    cleanedRemarks ||
                    null,
            };

            setWorking(true);
            setError("");

            try {
                let response;

                switch (
                actionDialog
                ) {
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
                    response?.data ??
                    null;

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
                    setBom(
                        updated
                    );
                } else {
                    await load();
                }
            } catch (
            requestError
            ) {
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

    /*
     * =====================================================
     * LOADING
     * =====================================================
     */

    if (loading) {
        return (
            <Box sx={loadingSx}>
                <CircularProgress />
            </Box>
        );
    }

    /*
     * =====================================================
     * PAGE
     * =====================================================
     */

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
                            {bom?.revisionNo ??
                                "-"}
                            {" · "}
                            {project.projectCode ||
                                bom?.projectCode ||
                                bom?.pdNo ||
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
                            onClick={
                                load
                            }
                            disabled={
                                working
                            }
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
                            disabled={
                                working
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

            {!bom ? (
                <Card sx={panelSx}>
                    <Box sx={missingBomSx}>
                        <Typography sx={missingBomTitleSx}>
                            Operational BOM Not Found
                        </Typography>

                        <Typography sx={missingBomTextSx}>
                            The requested BOM is unavailable,
                            inaccessible or may have been removed.
                        </Typography>

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
                            Return to BOM Register
                        </Button>
                    </Box>
                </Card>
            ) : (
                <>
                    <Card sx={panelSx}>
                        <Box sx={summaryGridSx}>
                            <Detail
                                label="Status"
                                value={
                                    <MatFlowStatusChip
                                        status={
                                            bom.status
                                        }
                                    />
                                }
                            />

                            <Detail
                                label="Effective Revision"
                                value={
                                    <MatFlowStatusChip
                                        status={
                                            isEffectiveRevision
                                                ? "ACTIVE"
                                                : "INACTIVE"
                                        }
                                    />
                                }
                            />

                            <Detail
                                label="Latest Revision"
                                value={
                                    isLatestRevision
                                        ? "Yes"
                                        : "No"
                                }
                            />

                            <Detail
                                label="Plant"
                                value={
                                    project.owningPlantCode ||
                                    project.plantCode ||
                                    bom.owningPlantCode ||
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
                                    disabled={
                                        working
                                    }
                                    sx={primaryBtnSx}
                                >
                                    Submit BOM to HOD
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
                                    disabled={
                                        working
                                    }
                                    sx={primaryBtnSx}
                                >
                                    HOD Approve &amp; Send to Production
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
                                    disabled={
                                        working
                                    }
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
                                    disabled={
                                        working
                                    }
                                    sx={primaryBtnSx}
                                >
                                    Production Review &amp; Approve
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
                                    disabled={
                                        working
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
                                    disabled={
                                        working
                                    }
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
                                            `/matflow/requisitions/new?bomId=${encodeURIComponent(
                                                bom.id
                                            )}`
                                        )
                                    }
                                    disabled={
                                        working
                                    }
                                    sx={primaryBtnSx}
                                >
                                    Raise Production Requisition
                                </Button>
                            )}

                            {!hasVisibleWorkflowAction && (
                                <Box sx={noActionBoxSx}>
                                    <Typography sx={noActionTitleSx}>
                                        Current owner:{" "}
                                        {workflow.department}
                                    </Typography>

                                    <Typography sx={noActionSx}>
                                        {workflow.nextAction}. No direct
                                        action is available for your role
                                        in the current BOM status.
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    </Card>

                    <MatFlowBomLineEditor
                        bom={bom}
                        lines={lines}
                        canEdit={
                            canEditCurrent
                        }
                        onChanged={
                            load
                        }
                        onError={
                            setError
                        }
                    />
                </>
            )}

            <Dialog
                open={
                    Boolean(
                        actionDialog
                    )
                }
                onClose={
                    closeAction
                }
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
                            isReturnAction(
                                actionDialog
                            )
                                ? "Remarks *"
                                : "Remarks"
                        }
                        multiline
                        minRows={3}
                        fullWidth
                        value={
                            remarks
                        }
                        disabled={
                            working
                        }
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
                        onClick={
                            closeAction
                        }
                        disabled={
                            working
                        }
                        sx={secondaryBtnSx}
                    >
                        Cancel
                    </Button>

                    <Button
                        onClick={
                            executeAction
                        }
                        disabled={
                            working ||
                            !actionDialog
                        }
                        sx={primaryBtnSx}
                    >
                        {working
                            ? "Working..."
                            : actionConfirmLabel(
                                actionDialog
                            )}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

function isReturnAction(
    action
) {
    return [
        "HOD_RETURN",
        "PRODUCTION_RETURN",
    ].includes(
        action
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
            return "Engineering will submit this operational BOM to the HOD for review.";

        case "HOD_APPROVE":
            return "HOD approval will move this BOM to Production Review. It will not become effective until Production approves it.";

        case "HOD_RETURN":
            return "The BOM will be returned to Engineering for correction. Return remarks are mandatory.";

        case "PRODUCTION_APPROVE":
            return "Production confirms that this BOM is suitable for manufacturing. This revision will become the effective operational BOM.";

        case "PRODUCTION_RETURN":
            return "Production will return the BOM to Engineering for correction. Return remarks are mandatory.";

        case "REVISION":
            return "A new draft revision will be created while the current approved revision remains effective.";

        default:
            return "";
    }
}

function actionConfirmLabel(
    action
) {
    switch (action) {
        case "SUBMIT":
            return "Submit BOM";

        case "HOD_APPROVE":
            return "Approve & Send";

        case "HOD_RETURN":
        case "PRODUCTION_RETURN":
            return "Return BOM";

        case "PRODUCTION_APPROVE":
            return "Approve BOM";

        case "REVISION":
            return "Create Revision";

        default:
            return "Confirm";
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
                {value ??
                    "-"}
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
    flexWrap: "wrap",
};

const summaryGridSx = {
    display: "grid",
    gridTemplateColumns:
        "repeat(auto-fit,minmax(180px,1fr))",
    gap: "9px",
};

const workflowActionsSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "8px",
    flexWrap: "wrap",
    mt: "14px",
    pt: "14px",
    borderTop:
        "1px solid var(--mf-border)",
};

const noActionBoxSx = {
    minWidth: "260px",
    padding: "8px 10px",
    borderRadius: "9px",
    background:
        "var(--mf-surface-soft)",
    border:
        "1px solid var(--mf-border)",
};

const noActionTitleSx = {
    color: "#7c3aed",
    fontSize: "8.5px",
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: ".04em",
};

const noActionSx = {
    mt: "2px",
    color:
        "var(--mf-text-muted)",
    fontSize: "9px",
    fontWeight: 700,
    lineHeight: 1.4,
};

const missingBomSx = {
    minHeight: "180px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    textAlign: "center",
};

const missingBomTitleSx = {
    color:
        "var(--mf-text)",
    fontSize: "15px",
    fontWeight: 900,
};

const missingBomTextSx = {
    maxWidth: "480px",
    color:
        "var(--mf-text-muted)",
    fontSize: "10px",
    fontWeight: 650,
    lineHeight: 1.5,
};