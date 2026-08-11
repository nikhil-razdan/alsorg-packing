import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Box,
    Button,
    Card,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import PlayArrowOutlinedIcon from "@mui/icons-material/PlayArrowOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";

import {
    useNavigate,
    useParams,
    useSearchParams,
} from "react-router-dom";

import {
    MATFLOW_ROLES,
    useMatFlow,
} from "../matflowUi";

import {
    extractMatFlowPage,
    matflowApi,
    readMatFlowError,
} from "../api/matflowApi";

import {
    Detail,
    EmptyState,
    ErrorBox,
    LoadingBlock,
    MatFlowStatusChip,
    MatFlowPagination,
    MatFlowDeleteDialog,
    PageHero,
    SummaryCard,
    clean,
    dialogActionsSx,
    dialogContentSx,
    dialogPaperSx,
    dialogTitleSx,
    dangerBtnSx,
    fieldSx,
    formatDate,
    formatQty,
    mainTextSx,
    normalize,
    pageSx,
    panelSx,
    primaryBtnSx,
    readable,
    secondaryBtnSx,
    subTextSx,
    tableCellSx,
    tableHeaderSx,
    tableRowSx,
    tableShellSx,
    useMatFlowPagination,
} from "../matflowUi";

/*
 * ============================================================
 * REQUISITION ACCESS
 * ============================================================
 */

const CREATE_ROLES = [
    MATFLOW_ROLES.ADMIN,
    MATFLOW_ROLES.MANAGER,
    MATFLOW_ROLES.PRODUCTION,
];

/*
 * ============================================================
 * BUSINESS-CODE HELPERS
 * ============================================================
 *
 * IMPORTANT:
 *
 * Do NOT use normalize() for plant codes.
 *
 * normalize("AL-P1")
 * becomes:
 * AL_P1
 *
 * That is correct for enum/status normalization,
 * but WRONG for business identifiers such as plant codes.
 *
 * Plant codes must preserve:
 *
 * AL-P1
 * AL-P2
 * AL-P3
 * AL-P4
 */

const upperCode = (value) =>
    clean(value).toUpperCase();

const sameCode = (left, right) =>
    upperCode(left) === upperCode(right);

/*
 * Supports both the current BomDetailResponse.project contract
 * and older projectDrawing-shaped responses.
 */
const projectOf = (bom) =>
    bom?.project ||
    bom?.projectDrawing ||
    bom?.projectContext ||
    {};

/*
 * Supports the consolidated/current response and any older
 * aliases retained during migration.
 */
const linesOf = (bom) =>
    [
        bom?.lines,
        bom?.bomLines,
        bom?.items,
    ].find(Array.isArray) || [];

/*
 * ============================================================
 * REQUISITION LIST
 * ============================================================
 */

export function MatFlowRequisitionListPage() {
    const navigate = useNavigate();

    const {
        hasRole,
        selectedPlantParam,
    } = useMatFlow();

    const canCreate =
        hasRole(CREATE_ROLES);

    const [rows, setRows] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    const [search, setSearch] =
        useState("");

    const [status, setStatus] =
        useState("");

    const [deleteTarget, setDeleteTarget] =
        useState(null);

    const [deleteWorking, setDeleteWorking] =
        useState(false);

    const load = useCallback(
        async () => {
            setLoading(true);
            setError("");

            try {
                const response =
                    await matflowApi.listRequisitions();

                setRows(
                    Array.isArray(
                        response?.data
                    )
                        ? response.data
                        : []
                );
            } catch (requestError) {
                setRows([]);

                setError(
                    readMatFlowError(
                        requestError,
                        "Unable to load Production requisitions."
                    )
                );
            } finally {
                setLoading(false);
            }
        },
        []
    );

    useEffect(
        () => {
            load();
        },
        [load]
    );

    const statusOptions =
        useMemo(
            () => [
                "",
                ...Array.from(
                    new Set(
                        rows
                            .map(
                                (row) =>
                                    normalize(
                                        row.status
                                    )
                            )
                            .filter(Boolean)
                    )
                ).sort(),
            ],
            [rows]
        );

    const filtered =
        useMemo(
            () => {
                const term =
                    clean(search)
                        .toLowerCase();

                return rows.filter(
                    (row) => {
                        /*
                         * CRITICAL:
                         *
                         * Plant codes are business identifiers.
                         *
                         * AL-P1 must remain AL-P1.
                         */
                        if (
                            selectedPlantParam &&
                            !sameCode(
                                row.destinationPlantCode,
                                selectedPlantParam
                            )
                        ) {
                            return false;
                        }

                        /*
                         * Status IS enum-like, therefore
                         * normalize() is correct here.
                         */
                        if (
                            status &&
                            normalize(
                                row.status
                            ) !==
                            normalize(
                                status
                            )
                        ) {
                            return false;
                        }

                        if (!term) {
                            return true;
                        }

                        return [
                            row.requisitionNumber,
                            row.projectCode,
                            row.drawingNo,
                            row.bomNumber,
                            row.destinationLocationCode,
                            row.destinationLocationName,
                            row.requestedBy,
                        ].some(
                            (value) =>
                                clean(value)
                                    .toLowerCase()
                                    .includes(term)
                        );
                    }
                );
            },
            [
                rows,
                search,
                status,
                selectedPlantParam,
            ]
        );

    const requisitionPagination = useMatFlowPagination(filtered, 20);

    const confirmDeleteDraft = async () => {
        if (!deleteTarget?.id || deleteTarget.rowVersion == null) return;

        setDeleteWorking(true);
        setError("");
        try {
            await matflowApi.deleteDraftRequisition(
                deleteTarget.id,
                deleteTarget.rowVersion
            );
            setDeleteTarget(null);
            await load();
        } catch (requestError) {
            setError(
                readMatFlowError(
                    requestError,
                    "Unable to delete the Draft requisition."
                )
            );
        } finally {
            setDeleteWorking(false);
        }
    };

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="PRODUCTION MATERIAL CONTROL"
                title="Production Requisitions"
                subtitle="Raise and track material demand against the latest effective BOM revision after Production technical approval and Director final approval."
                actions={
                    <>
                        <Button
                            startIcon={
                                <RefreshIcon />
                            }
                            onClick={load}
                            sx={secondaryBtnSx}
                        >
                            Refresh
                        </Button>

                        {canCreate && (
                            <Button
                                startIcon={
                                    <AddIcon />
                                }
                                onClick={() =>
                                    navigate(
                                        "/matflow/requisitions/new"
                                    )
                                }
                                sx={primaryBtnSx}
                            >
                                Create
                                Requisition
                            </Button>
                        )}
                    </>
                }
            />

            <Card sx={panelSx}>
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns:
                            "1fr 220px",
                        gap: 1,
                    }}
                >
                    <TextField
                        label="Search"
                        value={search}
                        onChange={(event) => {
                            setSearch(
                                event.target.value
                            );
                        }}
                        sx={fieldSx}
                    />

                    <TextField
                        select
                        label="Status"
                        value={status}
                        onChange={(event) => {
                            setStatus(
                                event.target.value
                            );
                        }}
                        sx={fieldSx}
                    >
                        {statusOptions.map(
                            (item) => (
                                <MenuItem
                                    key={
                                        item ||
                                        "ALL"
                                    }
                                    value={item}
                                >
                                    {item
                                        ? readable(
                                            item
                                        )
                                        : "All Statuses"}
                                </MenuItem>
                            )
                        )}
                    </TextField>
                </Box>
            </Card>

            <ErrorBox>
                {error}
            </ErrorBox>

            <Card sx={panelSx}>
                {loading ? (
                    <LoadingBlock />
                ) : (
                    <Box
                        sx={
                            tableShellSx
                        }
                    >
                        <Box
                            sx={{
                                ...tableHeaderSx,

                                gridTemplateColumns:
                                    "170px 170px 150px 170px 180px 140px 190px",
                            }}
                        >
                            {[
                                "Requisition",
                                "Project / Drawing",
                                "BOM",
                                "Destination",
                                "Status",
                                "Requested",
                                "Action",
                            ].map(
                                (heading) => (
                                    <Box
                                        key={
                                            heading
                                        }
                                        sx={
                                            tableCellSx
                                        }
                                    >
                                        {
                                            heading
                                        }
                                    </Box>
                                )
                            )}
                        </Box>

                        {requisitionPagination.pageItems.length ===
                            0 ? (
                            <EmptyState />
                        ) : (
                            requisitionPagination.pageItems.map(
                                (row) => (
                                    <Box
                                        key={
                                            row.id
                                        }
                                        sx={{
                                            ...tableRowSx,

                                            gridTemplateColumns:
                                                "170px 170px 150px 170px 180px 140px 190px",
                                        }}
                                    >
                                        <Box
                                            sx={
                                                tableCellSx
                                            }
                                        >
                                            <Typography
                                                sx={
                                                    mainTextSx
                                                }
                                            >
                                                {row.requisitionNumber ||
                                                    "-"}
                                            </Typography>

                                            <Typography
                                                sx={
                                                    subTextSx
                                                }
                                            >
                                                Version{" "}
                                                {row.rowVersion ??
                                                    "-"}
                                            </Typography>
                                        </Box>

                                        <Box
                                            sx={
                                                tableCellSx
                                            }
                                        >
                                            <Typography
                                                sx={
                                                    mainTextSx
                                                }
                                            >
                                                {row.projectCode ||
                                                    "-"}
                                            </Typography>

                                            <Typography
                                                sx={
                                                    subTextSx
                                                }
                                            >
                                                {row.drawingNo ||
                                                    "-"}
                                            </Typography>
                                        </Box>

                                        <Box
                                            sx={
                                                tableCellSx
                                            }
                                        >
                                            <Typography
                                                sx={
                                                    mainTextSx
                                                }
                                            >
                                                {row.bomNumber ||
                                                    "-"}
                                            </Typography>

                                            <Typography
                                                sx={
                                                    subTextSx
                                                }
                                            >
                                                Rev{" "}
                                                {row.bomRevisionNo ??
                                                    "-"}
                                            </Typography>
                                        </Box>

                                        <Box
                                            sx={
                                                tableCellSx
                                            }
                                        >
                                            <Typography
                                                sx={
                                                    mainTextSx
                                                }
                                            >
                                                {row.destinationLocationCode ||
                                                    "-"}
                                            </Typography>

                                            <Typography
                                                sx={
                                                    subTextSx
                                                }
                                            >
                                                {row.destinationPlantCode ||
                                                    "-"}
                                            </Typography>
                                        </Box>

                                        <Box
                                            sx={
                                                tableCellSx
                                            }
                                        >
                                            <MatFlowStatusChip
                                                status={
                                                    row.status
                                                }
                                            />
                                        </Box>

                                        <Box
                                            sx={
                                                tableCellSx
                                            }
                                        >
                                            {formatDate(
                                                row.requestedAt
                                            )}
                                        </Box>

                                        <Box
                                            sx={{
                                                ...tableCellSx,
                                                display: "flex",
                                                alignItems: "center",
                                                gap: .65,
                                            }}
                                        >
                                            <Button
                                                onClick={() =>
                                                    navigate(
                                                        `/matflow/requisitions/${row.id}`
                                                    )
                                                }
                                                sx={secondaryBtnSx}
                                            >
                                                Open
                                            </Button>

                                            {canCreate &&
                                                normalize(row.status) === "DRAFT" &&
                                                row.rowVersion != null && (
                                                    <Button
                                                        startIcon={<DeleteOutlineIcon />}
                                                        onClick={() => setDeleteTarget(row)}
                                                        sx={dangerBtnSx}
                                                    >
                                                        Delete
                                                    </Button>
                                                )}
                                        </Box>
                                    </Box>
                                )
                            )
                        )}
                    </Box>
                )}

                <MatFlowPagination
                    {...requisitionPagination}
                    onPageChange={requisitionPagination.setPage}
                    onPageSizeChange={requisitionPagination.setPageSize}
                    label="Production Requisitions"
                />
            </Card>

            <MatFlowDeleteDialog
                open={Boolean(deleteTarget)}
                title="Delete Draft Requisition?"
                subject={deleteTarget?.requisitionNumber || "Draft requisition"}
                description="This permanently removes only this Draft requisition and its Draft material lines. Once a requisition is submitted, MatFlow keeps it as workflow history and uses Cancel Requisition instead."
                working={deleteWorking}
                onClose={() => setDeleteTarget(null)}
                onConfirm={confirmDeleteDraft}
            />
        </Box>
    );
}

/*
 * ============================================================
 * CREATE REQUISITION
 * ============================================================
 */

export function MatFlowRequisitionCreatePage() {
    const navigate =
        useNavigate();

    const [params] =
        useSearchParams();

    const initialBomId =
        params.get("bomId") || "";

    const [boms, setBoms] =
        useState([]);

    const [
        locations,
        setLocations,
    ] = useState([]);

    const [
        selectedBomId,
        setSelectedBomId,
    ] = useState(
        initialBomId
    );

    const [
        selectedBom,
        setSelectedBom,
    ] = useState(null);

    const [
        destinationLocationId,
        setDestinationLocationId,
    ] = useState("");

    const [
        lineInputs,
        setLineInputs,
    ] = useState({});

    const [remarks, setRemarks] =
        useState("");

    const [loading, setLoading] =
        useState(true);

    const [working, setWorking] =
        useState(false);

    const [error, setError] =
        useState("");

    /*
     * Load:
     * - all APPROVED BOM revisions
     * - active Production destinations
     *
     * latestOnly=false is deliberate.
     *
     * The effective approved revision remains usable even
     * when Engineering has opened a newer draft revision.
     */
    useEffect(
        () => {
            let active = true;

            (async () => {
                try {
                    const [
                        bomResponse,
                        locationResponse,
                    ] =
                        await Promise.all(
                            [
                                matflowApi.listBoms(
                                    {
                                        status:
                                            "APPROVED",

                                        latestOnly:
                                            false,
                                    }
                                ),

                                matflowApi.listLocations(
                                    {
                                        active: true,
                                    }
                                ),
                            ]
                        );

                    if (!active) {
                        return;
                    }

                    const bomRows =
                        extractMatFlowPage(
                            bomResponse?.data
                        ).rows;

                    setBoms(
                        bomRows.filter(
                            (bom) =>
                                normalize(
                                    bom.status
                                ) ===
                                "APPROVED" &&
                                bom.effective ===
                                true
                        )
                    );

                    const locationRows =
                        extractMatFlowPage(
                            locationResponse?.data
                        ).rows;

                    setLocations(
                        locationRows.filter(
                            (location) =>
                                location.active !==
                                false &&
                                normalize(
                                    location.locationType
                                ) ===
                                "PRODUCTION"
                        )
                    );
                } catch (
                requestError
                ) {
                    if (active) {
                        setError(
                            readMatFlowError(
                                requestError,
                                "Unable to load approved BOMs and Production locations."
                            )
                        );
                    }
                } finally {
                    if (active) {
                        setLoading(false);
                    }
                }
            })();

            return () => {
                active = false;
            };
        },
        []
    );

    /*
     * Load complete BOM detail after selection.
     */
    useEffect(
        () => {
            if (!selectedBomId) {
                setSelectedBom(
                    null
                );

                setLineInputs(
                    {}
                );

                return;
            }

            let active = true;

            (async () => {
                try {
                    setError("");

                    const response =
                        await matflowApi.getBom(
                            selectedBomId
                        );

                    const loaded =
                        response?.data ||
                        null;

                    if (!active) {
                        return;
                    }

                    /*
                     * Never trust a query-string BOM ID blindly.
                     *
                     * Requisitions are only valid against:
                     * APPROVED + effective BOM.
                     */
                    if (
                        !loaded ||
                        normalize(
                            loaded.status
                        ) !==
                        "APPROVED" ||
                        loaded.effective !==
                        true
                    ) {
                        setSelectedBom(
                            null
                        );

                        setLineInputs(
                            {}
                        );

                        setDestinationLocationId(
                            ""
                        );

                        setError(
                            "The selected BOM is not an approved, effective operational BOM."
                        );

                        return;
                    }

                    setSelectedBom(
                        loaded
                    );

                    const next = {};

                    linesOf(
                        loaded
                    ).forEach(
                        (line) => {
                            if (
                                !line?.id
                            ) {
                                return;
                            }

                            const quantity =
                                Number(
                                    line.netRequiredQty ??
                                    line.requiredQty ??
                                    0
                                );

                            next[
                                String(
                                    line.id
                                )
                            ] =
                                quantity >
                                    0
                                    ? String(
                                        quantity
                                    )
                                    : "";
                        }
                    );

                    setLineInputs(
                        next
                    );
                } catch (
                requestError
                ) {
                    if (active) {
                        setSelectedBom(
                            null
                        );

                        setLineInputs(
                            {}
                        );

                        setDestinationLocationId(
                            ""
                        );

                        setError(
                            readMatFlowError(
                                requestError,
                                "Unable to load selected BOM."
                            )
                        );
                    }
                }
            })();

            return () => {
                active = false;
            };
        },
        [selectedBomId]
    );

    const lines =
        useMemo(
            () =>
                linesOf(
                    selectedBom
                ),
            [selectedBom]
        );

    /*
     * Current backend BomDetailResponse exposes:
     *
     * project
     *
     * Older responses may expose:
     *
     * projectDrawing
     *
     * Supporting both keeps this workspace migration-safe.
     */
    const project =
        useMemo(
            () =>
                projectOf(
                    selectedBom
                ),
            [selectedBom]
        );

    const projectDrawingId =
        project?.id ||
        selectedBom?.projectDrawingId ||
        null;

    /*
     * CRITICAL PLANT FIX:
     *
     * Preserve AL-P1.
     *
     * Do NOT:
     *
     * normalize("AL-P1")
     *
     * because it produces AL_P1.
     */
    const plant =
        useMemo(
            () =>
                upperCode(
                    project?.plantCode ||
                    project?.owningPlantCode ||
                    selectedBom?.plantCode
                ),
            [
                project?.plantCode,
                project?.owningPlantCode,
                selectedBom?.plantCode,
            ]
        );

    /*
     * Only Production locations belonging to the exact
     * canonical project plant may be selected.
     */
    const destinationOptions =
        useMemo(
            () =>
                locations.filter(
                    (location) =>
                        !plant ||
                        sameCode(
                            location.plantCode,
                            plant
                        )
                ),
            [
                locations,
                plant,
            ]
        );

    /*
     * Auto-select a single valid Production destination.
     *
     * Clear an existing destination if changing BOM means
     * it no longer belongs to the selected project's plant.
     */
    useEffect(
        () => {
            if (
                destinationOptions.length ===
                1
            ) {
                const onlyId =
                    String(
                        destinationOptions[
                            0
                        ].id
                    );

                if (
                    String(
                        destinationLocationId
                    ) !== onlyId
                ) {
                    setDestinationLocationId(
                        destinationOptions[
                            0
                        ].id
                    );
                }

                return;
            }

            const valid =
                destinationOptions.some(
                    (location) =>
                        String(
                            location.id
                        ) ===
                        String(
                            destinationLocationId
                        )
                );

            if (
                destinationLocationId &&
                !valid
            ) {
                setDestinationLocationId(
                    ""
                );
            }
        },
        [
            destinationOptions,
            destinationLocationId,
        ]
    );

    const create =
        async () => {
            if (
                !selectedBom?.id ||
                !projectDrawingId ||
                !destinationLocationId
            ) {
                setError(
                    "Select an approved BOM and Production destination."
                );

                return;
            }

            /*
             * Defensive validation:
             * selected destination must still be one of the
             * project's valid Production locations.
             */
            const destination =
                destinationOptions.find(
                    (location) =>
                        String(
                            location.id
                        ) ===
                        String(
                            destinationLocationId
                        )
                );

            if (!destination) {
                setError(
                    "The selected Production destination is not valid for this project's plant."
                );

                return;
            }

            /*
             * Explicitly verify plant relationship using the
             * punctuation-preserving business-code comparison.
             */
            if (
                plant &&
                !sameCode(
                    destination.plantCode,
                    plant
                )
            ) {
                setError(
                    `Production destination ${destination.locationCode || ""} belongs to plant ${destination.plantCode || "-"}, not project plant ${plant}.`
                );

                return;
            }

            const requestLines =
                lines
                    .map(
                        (line) => ({
                            line,

                            qty: Number(
                                lineInputs[
                                String(
                                    line.id
                                )
                                ] || 0
                            ),
                        })
                    )
                    .filter(
                        (entry) =>
                            Number.isFinite(
                                entry.qty
                            ) &&
                            entry.qty >
                            0
                    );

            if (
                !requestLines.length
            ) {
                setError(
                    "Enter a requested quantity for at least one material."
                );

                return;
            }

            for (const entry of requestLines) {
                const max =
                    Number(
                        entry.line
                            .netRequiredQty ??
                        entry.line
                            .requiredQty ??
                        0
                    );

                if (
                    !Number.isFinite(
                        max
                    ) ||
                    max <= 0
                ) {
                    setError(
                        `${entry.line.materialCodeSnapshot || entry.line.materialCode || entry.line.materialNameSnapshot || "Material"} has an invalid BOM requirement.`
                    );

                    return;
                }

                if (
                    entry.qty >
                    max + 0.0005
                ) {
                    setError(
                        `${entry.line
                            .materialCodeSnapshot ||
                        entry.line
                            .materialCode ||
                        entry.line
                            .materialNameSnapshot ||
                        "Material"
                        }: quantity cannot exceed BOM net requirement ${formatQty(
                            max
                        )}.`
                    );

                    return;
                }
            }

            setWorking(true);
            setError("");

            try {
                const response =
                    await matflowApi.createRequisition(
                        {
                            projectDrawingId,

                            bomId:
                                selectedBom.id,

                            destinationLocationId,

                            remarks:
                                clean(
                                    remarks
                                ) ||
                                null,

                            lines: requestLines.map(
                                (
                                    entry
                                ) => ({
                                    bomLineId:
                                        entry
                                            .line
                                            .id,

                                    requestedQty:
                                        entry.qty,

                                    remarks:
                                        null,
                                })
                            ),
                        }
                    );

                if (
                    !response?.data
                        ?.id
                ) {
                    throw new Error(
                        "Created requisition ID was not returned."
                    );
                }

                navigate(
                    `/matflow/requisitions/${response.data.id}`,
                    {
                        replace: true,
                    }
                );
            } catch (
            requestError
            ) {
                setError(
                    readMatFlowError(
                        requestError,
                        "Unable to create Production requisition."
                    )
                );
            } finally {
                setWorking(false);
            }
        };

    if (loading) {
        return <LoadingBlock />;
    }

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="NEW PRODUCTION REQUISITION"
                title="Raise Material Requisition"
                subtitle="Request material directly against an approved, effective MatFlow BOM."
                actions={
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
                }
            />

            <ErrorBox>
                {error}
            </ErrorBox>

            <Card sx={panelSx}>
                <Box
                    sx={{
                        display: "grid",

                        gridTemplateColumns:
                            "1fr 1fr",

                        gap: 1.5,
                    }}
                >
                    <TextField
                        select
                        label="Approved BOM *"
                        value={
                            selectedBomId
                        }
                        onChange={(
                            event
                        ) => {
                            setSelectedBomId(
                                event
                                    .target
                                    .value
                            );

                            setDestinationLocationId(
                                ""
                            );

                            setError("");
                        }}
                        sx={fieldSx}
                    >
                        {boms.map(
                            (bom) => (
                                <MenuItem
                                    key={
                                        bom.id
                                    }
                                    value={
                                        bom.id
                                    }
                                >
                                    {bom.bomNumber}{" "}
                                    · Rev{" "}
                                    {
                                        bom.revisionNo
                                    }{" "}
                                    ·{" "}
                                    {bom.projectCode ||
                                        bom.productName ||
                                        "-"}
                                </MenuItem>
                            )
                        )}
                    </TextField>

                    <TextField
                        select
                        label="Production Destination *"
                        value={
                            destinationLocationId
                        }
                        disabled={
                            !selectedBom
                        }
                        onChange={(
                            event
                        ) =>
                            setDestinationLocationId(
                                event
                                    .target
                                    .value
                            )
                        }
                        sx={fieldSx}
                    >
                        {destinationOptions.map(
                            (
                                location
                            ) => (
                                <MenuItem
                                    key={
                                        location.id
                                    }
                                    value={
                                        location.id
                                    }
                                >
                                    {location.locationCode}{" "}
                                    ·{" "}
                                    {location.locationName}{" "}
                                    ·{" "}
                                    {location.plantCode}
                                </MenuItem>
                            )
                        )}
                    </TextField>

                    <TextField
                        label="Remarks"
                        value={remarks}
                        onChange={(
                            event
                        ) =>
                            setRemarks(
                                event
                                    .target
                                    .value
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

            {selectedBom && (
                <Card sx={panelSx}>
                    <Box
                        sx={{
                            display: "grid",

                            gridTemplateColumns:
                                "repeat(auto-fit,minmax(170px,1fr))",

                            gap: 1,
                        }}
                    >
                        <Detail
                            label="Project"
                            value={
                                project.projectCode
                            }
                        />

                        <Detail
                            label="Drawing"
                            value={
                                project.drawingNo
                            }
                        />

                        <Detail
                            label="Product"
                            value={
                                project.productName
                            }
                        />

                        <Detail
                            label="Plant"
                            value={
                                project.plantCode ||
                                project.owningPlantCode
                            }
                        />

                        <Detail
                            label="BOM"
                            value={`${selectedBom.bomNumber} · Rev ${selectedBom.revisionNo}`}
                        />
                    </Box>
                </Card>
            )}

            <Card sx={panelSx}>
                <Typography
                    sx={{
                        fontWeight: 950,
                        mb: 1,
                    }}
                >
                    Requested Materials
                </Typography>

                <Box
                    sx={tableShellSx}
                >
                    <Box
                        sx={{
                            ...tableHeaderSx,

                            gridTemplateColumns:
                                "70px 220px 120px 130px 150px",
                        }}
                    >
                        {[
                            "Line",
                            "Material",
                            "BOM Net Qty",
                            "UOM",
                            "Request Qty",
                        ].map(
                            (heading) => (
                                <Box
                                    key={
                                        heading
                                    }
                                    sx={
                                        tableCellSx
                                    }
                                >
                                    {
                                        heading
                                    }
                                </Box>
                            )
                        )}
                    </Box>

                    {lines.length ===
                        0 ? (
                        <EmptyState>
                            Select an
                            approved BOM.
                        </EmptyState>
                    ) : (
                        lines.map(
                            (line) => (
                                <Box
                                    key={
                                        line.id
                                    }
                                    sx={{
                                        ...tableRowSx,

                                        gridTemplateColumns:
                                            "70px 220px 120px 130px 150px",
                                    }}
                                >
                                    <Box
                                        sx={
                                            tableCellSx
                                        }
                                    >
                                        {line.lineNo ??
                                            "-"}
                                    </Box>

                                    <Box
                                        sx={
                                            tableCellSx
                                        }
                                    >
                                        <Typography
                                            sx={
                                                mainTextSx
                                            }
                                        >
                                            {line.materialCodeSnapshot ||
                                                line.materialCode ||
                                                "-"}
                                        </Typography>

                                        <Typography
                                            sx={
                                                subTextSx
                                            }
                                        >
                                            {line.materialNameSnapshot ||
                                                line.materialName ||
                                                "-"}
                                        </Typography>
                                    </Box>

                                    <Box
                                        sx={
                                            tableCellSx
                                        }
                                    >
                                        {formatQty(
                                            line.netRequiredQty ??
                                            line.requiredQty
                                        )}
                                    </Box>

                                    <Box
                                        sx={
                                            tableCellSx
                                        }
                                    >
                                        {line.uomSnapshot ||
                                            line.uom ||
                                            "-"}
                                    </Box>

                                    <Box
                                        sx={
                                            tableCellSx
                                        }
                                    >
                                        <TextField
                                            type="number"
                                            size="small"
                                            inputProps={{
                                                min: 0,
                                                step: 0.001,
                                            }}
                                            value={
                                                lineInputs[
                                                String(
                                                    line.id
                                                )
                                                ] ??
                                                ""
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                setLineInputs(
                                                    (
                                                        current
                                                    ) => ({
                                                        ...current,

                                                        [String(
                                                            line.id
                                                        )]:
                                                            event
                                                                .target
                                                                .value,
                                                    })
                                                )
                                            }
                                            sx={
                                                fieldSx
                                            }
                                        />
                                    </Box>
                                </Box>
                            )
                        )
                    )}
                </Box>
            </Card>

            <Box
                sx={{
                    display: "flex",
                    justifyContent:
                        "flex-end",
                }}
            >
                <Button
                    startIcon={
                        <AddIcon />
                    }
                    onClick={create}
                    disabled={
                        working ||
                        !selectedBomId ||
                        !selectedBom ||
                        !destinationLocationId
                    }
                    sx={primaryBtnSx}
                >
                    {working
                        ? "Creating..."
                        : "Create Draft Requisition"}
                </Button>
            </Box>
        </Box>
    );
}

/*
 * ============================================================
 * REQUISITION DETAIL
 * ============================================================
 */

export function MatFlowRequisitionDetailPage() {
    const {
        requisitionId,
    } = useParams();

    const navigate =
        useNavigate();

    const { hasRole } =
        useMatFlow();

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

    const [action, setAction] =
        useState(null);

    const [remarks, setRemarks] =
        useState("");

    const [deleteTarget, setDeleteTarget] =
        useState(null);

    const load = useCallback(
        async () => {
            if (
                !requisitionId
            ) {
                return;
            }

            setLoading(true);
            setError("");

            try {
                const response =
                    await matflowApi.getRequisition(
                        requisitionId
                    );

                setRequisition(
                    response?.data ||
                    null
                );
            } catch (
            requestError
            ) {
                setRequisition(
                    null
                );

                setError(
                    readMatFlowError(
                        requestError,
                        "Unable to load material requisition."
                    )
                );
            } finally {
                setLoading(false);
            }
        },
        [requisitionId]
    );

    useEffect(
        () => {
            load();
        },
        [load]
    );

    const lines =
        useMemo(
            () =>
                Array.isArray(
                    requisition?.lines
                )
                    ? requisition.lines
                    : [],
            [
                requisition?.lines,
            ]
        );

    const totals =
        useMemo(
            () =>
                lines.reduce(
                    (
                        sum,
                        line
                    ) => ({
                        requested:
                            sum.requested +
                            Number(
                                line.requestedQty ||
                                0
                            ),

                        reserved:
                            sum.reserved +
                            Number(
                                line.reservedQty ||
                                0
                            ),

                        shortage:
                            sum.shortage +
                            Number(
                                line.shortageQty ||
                                0
                            ),

                        issued:
                            sum.issued +
                            Number(
                                line.issuedQty ||
                                0
                            ),

                        consumed:
                            sum.consumed +
                            Number(
                                line.consumedQty ||
                                0
                            ),

                        returned:
                            sum.returned +
                            Number(
                                line.returnedQty ||
                                0
                            ),
                    }),

                    {
                        requested: 0,
                        reserved: 0,
                        shortage: 0,
                        issued: 0,
                        consumed: 0,
                        returned: 0,
                    }
                ),
            [lines]
        );

    const status =
        normalize(
            requisition?.status
        );

    const productionRole =
        hasRole(
            CREATE_ROLES
        );

    const canDeleteDraft =
        productionRole &&
        status === "DRAFT" &&
        requisition?.rowVersion != null;

    const canCancelRequisition =
        productionRole &&
        requisition?.rowVersion != null &&
        ![
            "DRAFT",
            "CANCELLED",
            "ISSUED",
            "PARTIALLY_ISSUED",
            "ISSUED_TO_PRODUCTION",
            "PRODUCTION_STARTED",
            "PRODUCTION_COMPLETED",
            "COMPLETED",
        ].includes(status);

    const canSubmit =
        productionRole &&
        status === "DRAFT" &&
        lines.length > 0 &&
        requisition?.rowVersion !=
        null;

    /*
     * Keep Production start aligned with backend authority.
     *
     * Do not expose Start from PARTIALLY_ISSUED unless the
     * backend explicitly permits that state.
     */
    const canStart =
        productionRole &&
        status ===
        "ISSUED_TO_PRODUCTION" &&
        requisition?.rowVersion !=
        null;

    const fullyAccountedForCompletion =
        lines.length > 0 &&
        lines.every((line) => {
            const requested = Number(line?.requestedQty || 0);
            const issued = Number(line?.issuedQty || 0);
            const accounted =
                Number(line?.consumedQty || 0) +
                Number(line?.returnedQty || 0);

            return issued + 0.0005 >= requested &&
                accounted + 0.0005 >= issued;
        });

    const canComplete =
        productionRole &&
        status ===
        "PRODUCTION_STARTED" &&
        fullyAccountedForCompletion &&
        requisition?.rowVersion !=
        null;

    /*
     * Partial availability exists when:
     *
     * - shortage remains
     * AND
     * - some quantity has already been reserved or issued.
     */
    const isPartialAvailability =
        totals.shortage > 0 &&
        (totals.reserved > 0 ||
            totals.issued > 0);

    const partialDecision =
        normalize(
            requisition?.partialAvailabilityDecision ||
            "UNDECIDED"
        );

    const canDecidePartial =
        productionRole &&
        isPartialAvailability &&
        requisition?.rowVersion !=
        null &&
        ![
            "CANCELLED",
            "PRODUCTION_STARTED",
            "PRODUCTION_COMPLETED",
        ].includes(status);

    const closeAction = () => {
        if (working) {
            return;
        }

        setAction(null);
        setRemarks("");
    };

    const execute =
        async () => {
            if (
                !action ||
                !requisition?.id ||
                requisition.rowVersion ==
                null
            ) {
                return;
            }

            setWorking(true);
            setError("");

            const body = {
                rowVersion:
                    requisition.rowVersion,

                remarks:
                    clean(
                        remarks
                    ) || null,
            };

            try {
                if (
                    action ===
                    "SUBMIT"
                ) {
                    await matflowApi.submitRequisition(
                        requisition.id,
                        body
                    );
                }

                if (
                    action ===
                    "START"
                ) {
                    await matflowApi.startProduction(
                        requisition.id,
                        body
                    );
                }

                if (
                    action ===
                    "COMPLETE"
                ) {
                    await matflowApi.completeProduction(
                        requisition.id,
                        body
                    );
                }

                if (
                    action ===
                    "PARTIAL_ISSUE"
                ) {
                    await matflowApi.decidePartialAvailability(
                        requisition.id,
                        {
                            ...body,

                            decision:
                                "ISSUE_AVAILABLE_NOW",
                        }
                    );
                }

                if (
                    action ===
                    "PARTIAL_HOLD"
                ) {
                    await matflowApi.decidePartialAvailability(
                        requisition.id,
                        {
                            ...body,

                            decision:
                                "HOLD_UNTIL_SHORTAGE_COMPLETE",
                        }
                    );
                }

                if (action === "CANCEL") {
                    const reason = clean(remarks);
                    if (!reason) {
                        throw new Error("Cancellation reason is required.");
                    }
                    await matflowApi.cancelRequisition(
                        requisition.id,
                        {
                            rowVersion: requisition.rowVersion,
                            reason,
                        }
                    );
                }

                setAction(null);
                setRemarks("");

                await load();
            } catch (
            requestError
            ) {
                setError(
                    readMatFlowError(
                        requestError,
                        "Unable to complete Production action."
                    )
                );
            } finally {
                setWorking(false);
            }
        };

    const confirmDeleteDraft = async () => {
        if (!deleteTarget?.id || deleteTarget.rowVersion == null) return;

        setWorking(true);
        setError("");
        try {
            await matflowApi.deleteDraftRequisition(
                deleteTarget.id,
                deleteTarget.rowVersion
            );
            setDeleteTarget(null);
            navigate("/matflow/production", { replace: true });
        } catch (requestError) {
            setError(
                readMatFlowError(
                    requestError,
                    "Unable to delete the Draft requisition."
                )
            );
        } finally {
            setWorking(false);
        }
    };

    if (loading) {
        return <LoadingBlock />;
    }

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="PRODUCTION MATERIAL REQUISITION"
                title={
                    requisition?.requisitionNumber ||
                    "Requisition"
                }
                subtitle={`${requisition?.projectCode || "-"} · ${requisition?.drawingNo || "-"} · ${requisition?.bomNumber || "-"}`}
                actions={
                    <>
                        <Button
                            startIcon={
                                <RefreshIcon />
                            }
                            onClick={load}
                            sx={
                                secondaryBtnSx
                            }
                        >
                            Refresh
                        </Button>

                        {canDeleteDraft && (
                            <Button
                                startIcon={<DeleteOutlineIcon />}
                                onClick={() => setDeleteTarget(requisition)}
                                sx={dangerBtnSx}
                            >
                                Delete Draft
                            </Button>
                        )}

                        <Button
                            startIcon={
                                <ArrowBackIcon />
                            }
                            onClick={() =>
                                navigate(
                                    "/matflow/production"
                                )
                            }
                            sx={
                                secondaryBtnSx
                            }
                        >
                            Back
                        </Button>
                    </>
                }
            />

            <ErrorBox>
                {error}
            </ErrorBox>

            {requisition && (
                <>
                    <Box
                        sx={{
                            display:
                                "grid",

                            gridTemplateColumns:
                                "repeat(auto-fit,minmax(150px,1fr))",

                            gap: 1,
                        }}
                    >
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
                            value={formatQty(
                                totals.requested
                            )}
                        />

                        <SummaryCard
                            label="Reserved"
                            value={formatQty(
                                totals.reserved
                            )}
                        />

                        <SummaryCard
                            label="Shortage"
                            value={formatQty(
                                totals.shortage
                            )}
                        />

                        <SummaryCard
                            label="Issued"
                            value={formatQty(
                                totals.issued
                            )}
                        />

                        <SummaryCard
                            label="Consumed"
                            value={formatQty(
                                totals.consumed
                            )}
                        />
                    </Box>

                    <Card
                        sx={
                            panelSx
                        }
                    >
                        <Box
                            sx={{
                                display:
                                    "grid",

                                gridTemplateColumns:
                                    "repeat(auto-fit,minmax(175px,1fr))",

                                gap: 1,
                            }}
                        >
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
                                value={`${requisition.bomNumber || "-"} · Rev ${requisition.bomRevisionNo ?? "-"}`}
                            />

                            <Detail
                                label="Destination"
                                value={
                                    requisition.destinationLocationName ||
                                    requisition.destinationLocationCode
                                }
                            />

                            <Detail
                                label="Plant"
                                value={
                                    requisition.destinationPlantCode
                                }
                            />

                            <Detail
                                label="Partial Availability"
                                value={
                                    <MatFlowStatusChip
                                        status={
                                            requisition.partialAvailabilityDecision ||
                                            "UNDECIDED"
                                        }
                                    />
                                }
                            />

                            <Detail
                                label="Decision By"
                                value={
                                    requisition.partialDecisionBy ||
                                    "-"
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
                                value={formatDate(
                                    requisition.requestedAt
                                )}
                            />

                            <Detail
                                label="Submitted At"
                                value={formatDate(
                                    requisition.submittedAt
                                )}
                            />

                            <Detail
                                label="Remarks"
                                value={
                                    requisition.remarks ||
                                    "-"
                                }
                            />
                        </Box>

                        <Box
                            sx={{
                                display:
                                    "flex",

                                justifyContent:
                                    "flex-end",

                                gap: 1,

                                mt: 1.5,

                                flexWrap:
                                    "wrap",
                            }}
                        >
                            {canSubmit && (
                                <Button
                                    startIcon={
                                        <SendOutlinedIcon />
                                    }
                                    onClick={() => {
                                        setRemarks(
                                            ""
                                        );

                                        setAction(
                                            "SUBMIT"
                                        );
                                    }}
                                    sx={
                                        primaryBtnSx
                                    }
                                >
                                    Submit to
                                    Store
                                </Button>
                            )}

                            {canDecidePartial && (
                                <Button
                                    onClick={() => {
                                        setRemarks(
                                            ""
                                        );

                                        setAction(
                                            "PARTIAL_ISSUE"
                                        );
                                    }}
                                    sx={
                                        partialDecision ===
                                            "ISSUE_AVAILABLE_NOW"
                                            ? primaryBtnSx
                                            : secondaryBtnSx
                                    }
                                >
                                    Issue Available
                                    Now
                                </Button>
                            )}

                            {canDecidePartial && (
                                <Button
                                    onClick={() => {
                                        setRemarks(
                                            ""
                                        );

                                        setAction(
                                            "PARTIAL_HOLD"
                                        );
                                    }}
                                    sx={
                                        partialDecision ===
                                            "HOLD_UNTIL_SHORTAGE_COMPLETE"
                                            ? primaryBtnSx
                                            : secondaryBtnSx
                                    }
                                >
                                    Hold Until
                                    Shortage
                                    Complete
                                </Button>
                            )}

                            {canCancelRequisition && (
                                <Button
                                    startIcon={<CancelOutlinedIcon />}
                                    onClick={() => {
                                        setRemarks("");
                                        setAction("CANCEL");
                                    }}
                                    sx={dangerBtnSx}
                                >
                                    Cancel Requisition
                                </Button>
                            )}

                            {canStart && (
                                <Button
                                    startIcon={
                                        <PlayArrowOutlinedIcon />
                                    }
                                    onClick={() => {
                                        setRemarks(
                                            ""
                                        );

                                        setAction(
                                            "START"
                                        );
                                    }}
                                    sx={
                                        primaryBtnSx
                                    }
                                >
                                    Start
                                    Production
                                </Button>
                            )}

                            {canComplete && (
                                <Button
                                    startIcon={
                                        <TaskAltOutlinedIcon />
                                    }
                                    onClick={() => {
                                        setRemarks(
                                            ""
                                        );

                                        setAction(
                                            "COMPLETE"
                                        );
                                    }}
                                    sx={
                                        primaryBtnSx
                                    }
                                >
                                    Complete
                                    Finished
                                    Product
                                </Button>
                            )}
                        </Box>
                    </Card>

                    {productionRole &&
                        status === "PRODUCTION_STARTED" &&
                        !fullyAccountedForCompletion && (
                            <Card
                                sx={{
                                    ...panelSx,
                                    border: "1px solid var(--mf-warning-border)",
                                    background: "var(--mf-warning-soft)",
                                }}
                            >
                                <Typography sx={{ ...mainTextSx, color: "var(--mf-warning-text)" }}>
                                    Finished-product completion is waiting for material accounting
                                </Typography>
                                <Typography sx={subTextSx}>
                                    Every requested quantity must first be issued to Production, and every issued quantity must then be consumed or returned. The Complete Finished Product action will unlock automatically when all material lines satisfy that control.
                                </Typography>
                            </Card>
                        )}

                    <Card
                        sx={
                            panelSx
                        }
                    >
                        <Typography
                            sx={{
                                fontWeight:
                                    950,

                                mb: 1,
                            }}
                        >
                            Material Lines
                        </Typography>

                        <Box
                            sx={
                                tableShellSx
                            }
                        >
                            <Box
                                sx={{
                                    ...tableHeaderSx,

                                    gridTemplateColumns:
                                        "70px 190px 100px 100px 100px 100px 100px 100px 160px",
                                }}
                            >
                                {[
                                    "Line",
                                    "Material",
                                    "Requested",
                                    "Reserved",
                                    "Shortage",
                                    "Issued",
                                    "Consumed",
                                    "Returned",
                                    "Status",
                                ].map(
                                    (
                                        heading
                                    ) => (
                                        <Box
                                            key={
                                                heading
                                            }
                                            sx={
                                                tableCellSx
                                            }
                                        >
                                            {
                                                heading
                                            }
                                        </Box>
                                    )
                                )}
                            </Box>

                            {lines.length ===
                                0 ? (
                                <EmptyState>
                                    No
                                    requisition
                                    material
                                    lines.
                                </EmptyState>
                            ) : (
                                lines.map(
                                    (
                                        line
                                    ) => (
                                        <Box
                                            key={
                                                line.id
                                            }
                                            sx={{
                                                ...tableRowSx,

                                                gridTemplateColumns:
                                                    "70px 190px 100px 100px 100px 100px 100px 100px 160px",
                                            }}
                                        >
                                            <Box
                                                sx={
                                                    tableCellSx
                                                }
                                            >
                                                {line.lineNo ??
                                                    "-"}
                                            </Box>

                                            <Box
                                                sx={
                                                    tableCellSx
                                                }
                                            >
                                                <Typography
                                                    sx={
                                                        mainTextSx
                                                    }
                                                >
                                                    {line.issuedMaterialCode ||
                                                        line.materialCode ||
                                                        "-"}
                                                </Typography>

                                                <Typography
                                                    sx={
                                                        subTextSx
                                                    }
                                                >
                                                    {line.issuedMaterialName ||
                                                        line.materialName ||
                                                        "-"}
                                                </Typography>
                                            </Box>

                                            <Box
                                                sx={
                                                    tableCellSx
                                                }
                                            >
                                                {formatQty(
                                                    line.requestedQty
                                                )}
                                            </Box>

                                            <Box
                                                sx={
                                                    tableCellSx
                                                }
                                            >
                                                {formatQty(
                                                    line.reservedQty
                                                )}
                                            </Box>

                                            <Box
                                                sx={
                                                    tableCellSx
                                                }
                                            >
                                                {formatQty(
                                                    line.shortageQty
                                                )}
                                            </Box>

                                            <Box
                                                sx={
                                                    tableCellSx
                                                }
                                            >
                                                {formatQty(
                                                    line.issuedQty
                                                )}
                                            </Box>

                                            <Box
                                                sx={
                                                    tableCellSx
                                                }
                                            >
                                                {formatQty(
                                                    line.consumedQty
                                                )}
                                            </Box>

                                            <Box
                                                sx={
                                                    tableCellSx
                                                }
                                            >
                                                {formatQty(
                                                    line.returnedQty
                                                )}
                                            </Box>

                                            <Box
                                                sx={
                                                    tableCellSx
                                                }
                                            >
                                                <MatFlowStatusChip
                                                    status={
                                                        line.status ||
                                                        requisition.status
                                                    }
                                                />
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
                open={Boolean(
                    action
                )}
                onClose={
                    closeAction
                }
                fullWidth
                maxWidth="sm"
                PaperProps={{
                    sx: dialogPaperSx,
                }}
            >
                <DialogTitle
                    sx={
                        dialogTitleSx
                    }
                >
                    {action ===
                        "SUBMIT"
                        ? "Submit Requisition to Store"
                        : action ===
                            "START"
                            ? "Start Production"
                            : action ===
                                "COMPLETE"
                                ? "Complete Finished Product"
                                : action ===
                                    "PARTIAL_ISSUE"
                                    ? "Issue Available Quantity Now"
                                    : action === "CANCEL"
                                        ? "Cancel Requisition"
                                        : "Hold Available Quantity"}
                </DialogTitle>

                <DialogContent
                    sx={
                        dialogContentSx
                    }
                >
                    {action ===
                        "PARTIAL_ISSUE" && (
                            <Typography
                                sx={{
                                    ...subTextSx,
                                    mb: 1.5,
                                }}
                            >
                                Production
                                is choosing
                                to allow
                                currently
                                available
                                material to
                                continue while
                                the remaining
                                shortage is
                                procured.
                            </Typography>
                        )}

                    {action ===
                        "PARTIAL_HOLD" && (
                            <Typography
                                sx={{
                                    ...subTextSx,
                                    mb: 1.5,
                                }}
                            >
                                Available
                                material will
                                remain reserved
                                until the
                                shortage is
                                completed.
                            </Typography>
                        )}

                    {action === "CANCEL" && (
                        <Typography
                            sx={{
                                ...subTextSx,
                                mb: 1.5,
                                color: "var(--mf-danger-text)",
                                fontWeight: 850,
                            }}
                        >
                            Cancellation preserves the requisition and all workflow history. MatFlow releases/cancels only downstream records that are still safe to unwind; physical execution cannot be cancelled.
                        </Typography>
                    )}

                    <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        label={action === "CANCEL" ? "Cancellation Reason *" : "Remarks"}
                        value={
                            remarks
                        }
                        onChange={(
                            event
                        ) =>
                            setRemarks(
                                event
                                    .target
                                    .value
                            )
                        }
                        sx={fieldSx}
                    />
                </DialogContent>

                <DialogActions
                    sx={
                        dialogActionsSx
                    }
                >
                    <Button
                        onClick={
                            closeAction
                        }
                        disabled={
                            working
                        }
                        sx={
                            secondaryBtnSx
                        }
                    >
                        Cancel
                    </Button>

                    <Button
                        onClick={
                            execute
                        }
                        disabled={
                            working
                        }
                        sx={
                            primaryBtnSx
                        }
                    >
                        {working
                            ? "Working..."
                            : "Confirm"}
                    </Button>
                </DialogActions>
            </Dialog>

            <MatFlowDeleteDialog
                open={Boolean(deleteTarget)}
                title="Delete Draft Requisition?"
                subject={deleteTarget?.requisitionNumber || "Draft requisition"}
                description="This permanently removes only the Draft requisition and its material-demand lines. Submitted or executed requisitions must be cancelled instead so Store, Purchase and material history remain traceable."
                working={working}
                onClose={() => setDeleteTarget(null)}
                onConfirm={confirmDeleteDraft}
            />
        </Box>
    );
}