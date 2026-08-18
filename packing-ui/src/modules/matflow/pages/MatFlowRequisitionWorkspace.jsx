import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    Checkbox,
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
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { MATFLOW_ROLES, useMatFlow } from "../matflowUi";
import { extractMatFlowPage, matflowApi, readMatFlowError } from "../api/matflowApi";
import { downloadMatFlowExcel } from "../api/matflowExcel";
import {
    Detail,
    EmptyState,
    ErrorBox,
    LoadingBlock,
    MatFlowDeleteDialog,
    MatFlowKanbanBoard,
    MatFlowPagination,
    MatFlowStatusChip,
    MatFlowViewToggle,
    PageHero,
    SummaryCard,
    clean,
    dangerBtnSx,
    dialogActionsSx,
    dialogContentSx,
    dialogPaperSx,
    dialogTitleSx,
    fieldSx,
    formatDate,
    formatQty,
    mainTextSx,
    normalize,
    numeric,
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

const CREATE_ROLES = [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PRODUCTION];
const upperCode = (value) => clean(value).toUpperCase();
const MAIN_PLANT = "AL-P1";
const isMainPlant = (value) => upperCode(value) === MAIN_PLANT;

const MR_KANBAN_COLUMNS = [
    { key: "DRAFT", label: "Draft", subtitle: "Production is preparing the MR" },
    { key: "STORE", label: "Store", subtitle: "Forwarding / Tally availability / allocation" },
    { key: "SHORTAGE", label: "Shortage", subtitle: "Linked PI / Purchase dependency" },
    { key: "HANDOFF", label: "Material Handoff", subtitle: "QC / Processing / Store issue route" },
    { key: "PRODUCTION", label: "Production", subtitle: "Issued, received or in Production" },
    { key: "CLOSED", label: "Closed", subtitle: "Production complete or MR cancelled" },
];

const requisitionKanbanLane = (row) => {
    const status = normalize(row?.status);
    if (["CANCELLED", "PRODUCTION_COMPLETED", "COMPLETED"].includes(status)) return "CLOSED";
    if (["ISSUED_TO_PRODUCTION", "PRODUCTION_STARTED", "PRODUCTION_IN_PROGRESS"].includes(status)) return "PRODUCTION";
    if (["SHORTAGE_PENDING", "PURCHASE_IN_PROGRESS", "PARTIALLY_RESERVED"].includes(status)) return "SHORTAGE";
    if (["READY_TO_ISSUE", "PARTIALLY_ISSUED", "QC_PENDING", "PROCESSING", "MATERIAL_IN_TRANSIT", "TRANSFER_IN_PROGRESS"].includes(status)) return "HANDOFF";
    if (status === "DRAFT") return "DRAFT";
    return "STORE";
};

export function MatFlowRequisitionListPage() {
    const navigate = useNavigate();
    const { hasRole, selectedPlantParam } = useMatFlow();
    const canCreate = hasRole(CREATE_ROLES);

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [viewMode, setViewMode] = useState("KANBAN");
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [working, setWorking] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await matflowApi.listRequisitions();
            setRows(Array.isArray(response?.data) ? response.data : []);
        } catch (requestError) {
            setRows([]);
            setError(readMatFlowError(requestError, "Unable to load Production Material Requisitions."));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = useMemo(() => {
        const term = clean(search).toLowerCase();
        return rows.filter((row) => {
            if (selectedPlantParam && upperCode(row.productionPlantCode) !== upperCode(selectedPlantParam)) return false;
            if (status && normalize(row.status) !== normalize(status)) return false;
            if (!term) return true;
            return [
                row.requisitionNumber,
                row.projectCode,
                row.drawingNo,
                row.bomNumber,
                row.requestedBy,
                row.productionPlantCode,
                row.status,
            ].some((value) => clean(value).toLowerCase().includes(term));
        });
    }, [rows, search, status, selectedPlantParam]);

    const statusOptions = useMemo(() => [
        "",
        ...Array.from(new Set(rows.map((row) => normalize(row.status)).filter(Boolean))).sort(),
    ], [rows]);

    const counts = useMemo(() => ({
        store: filtered.filter((row) => requisitionKanbanLane(row) === "STORE").length,
        shortage: filtered.filter((row) => requisitionKanbanLane(row) === "SHORTAGE").length,
        handoff: filtered.filter((row) => requisitionKanbanLane(row) === "HANDOFF").length,
        production: filtered.filter((row) => requisitionKanbanLane(row) === "PRODUCTION").length,
    }), [filtered]);

    const pagination = useMatFlowPagination(filtered, 20);

    const confirmDelete = async () => {
        if (!deleteTarget?.id || deleteTarget.rowVersion == null) return;
        setWorking(true);
        setError("");
        try {
            await matflowApi.deleteDraftRequisition(deleteTarget.id, deleteTarget.rowVersion);
            setDeleteTarget(null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to delete Draft MR."));
        } finally {
            setWorking(false);
        }
    };

    const routeText = (row) => isMainPlant(row.productionPlantCode)
        ? `${row.requestedBy || "Production"} / AL-P1 → AL-P1 Main Store`
        : `${row.requestedBy || "Production"} / ${row.productionPlantCode || "Plant"} → ${row.productionPlantCode || "Plant"} Store → AL-P1 Main Store`;

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="PRODUCTION MR"
                title="Material Requisitions"
                subtitle="Create the MR once. MatFlow routes it automatically by plant and keeps the exact Production requester attached to the material."
                actions={
                    <>
                        <Button
                            startIcon={<FileDownloadOutlinedIcon />}
                            onClick={() => downloadMatFlowExcel({
                                fileName: "MatFlow_Material_Requisitions",
                                sheetName: "MRs",
                                title: "MatFlow Material Requisitions",
                                rows: filtered,
                            })}
                            sx={secondaryBtnSx}
                        >
                            Excel
                        </Button>
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                        {canCreate && (
                            <Button startIcon={<AddIcon />} onClick={() => navigate("/matflow/requisitions/new")} sx={primaryBtnSx}>
                                Create MR
                            </Button>
                        )}
                    </>
                }
            />

            <ErrorBox>{error}</ErrorBox>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", md: "repeat(4,minmax(0,1fr))" }, gap: 1 }}>
                <SummaryCard label="At Store" value={counts.store} />
                <SummaryCard label="Shortage" value={counts.shortage} />
                <SummaryCard label="In Handoff" value={counts.handoff} />
                <SummaryCard label="In Production" value={counts.production} />
            </Box>

            <Card sx={{ ...panelSx, display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 200px auto" }, gap: 1, alignItems: "center" }}>
                <TextField label="Search MR / PD / Drawing / Requester" value={search} onChange={(event) => setSearch(event.target.value)} sx={fieldSx} />
                <TextField select label="Status" value={status} onChange={(event) => setStatus(event.target.value)} sx={fieldSx}>
                    {statusOptions.map((value) => (
                        <MenuItem key={value || "ALL"} value={value}>{value ? readable(value) : "All"}</MenuItem>
                    ))}
                </TextField>
                <MatFlowViewToggle
                    value={viewMode}
                    onChange={setViewMode}
                    options={[{ value: "KANBAN", label: "Workflow Board" }, { value: "TABLE", label: "Table" }]}
                />
            </Card>

            <Card sx={panelSx}>
                {loading ? <LoadingBlock /> : viewMode === "KANBAN" ? (
                    <MatFlowKanbanBoard
                        columns={MR_KANBAN_COLUMNS}
                        items={filtered}
                        laneFor={requisitionKanbanLane}
                        minColumnWidth={255}
                        boardHeight={{ xs: 560, md: "clamp(480px, calc(100vh - 315px), 690px)" }}
                        completedLaneKeys={["CLOSED"]}
                        completedLaneLimit={10}
                        boardKey={`${status || "ALL"}:${search}:${selectedPlantParam || "ALL"}`}
                        renderCard={(row) => (
                            <Card sx={{ ...panelSx, m: 0, p: 1.05, boxShadow: "none" }}>
                                <Box sx={{ display: "flex", justifyContent: "space-between", gap: .7, alignItems: "flex-start" }}>
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography sx={{ ...mainTextSx, fontSize: 12.5 }}>{row.requisitionNumber || "-"}</Typography>
                                        <Typography sx={subTextSx}>{row.projectCode || "-"} · {row.drawingNo || "-"}</Typography>
                                    </Box>
                                    <MatFlowStatusChip status={row.status} />
                                </Box>
                                <Typography sx={{ ...mainTextSx, mt: .7 }}>{row.requestedBy || "Production"} · {row.productionPlantCode || "-"}</Typography>
                                <Typography sx={{ ...subTextSx, whiteSpace: "normal" }}>{routeText(row)}</Typography>
                                <Typography sx={subTextSx}>{row.bomNumber || "-"} · {formatDate(row.requestedAt)}</Typography>
                                <Box sx={{ display: "flex", gap: .5, mt: .85, flexWrap: "wrap" }}>
                                    <Button onClick={() => navigate(`/matflow/requisitions/${row.id}`)} sx={primaryBtnSx}>Open</Button>
                                    {canCreate && normalize(row.status) === "DRAFT" && row.rowVersion != null && (
                                        <Button startIcon={<DeleteOutlineIcon />} onClick={() => setDeleteTarget(row)} sx={dangerBtnSx}>Delete</Button>
                                    )}
                                </Box>
                            </Card>
                        )}
                    />
                ) : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 180px 140px minmax(230px,1fr) 165px 140px 150px" }}>
                            {["MR", "PD No. / Drawing", "BOM", "Fixed Route", "Status", "Requested", "Action"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {pagination.pageItems.length === 0 ? <EmptyState /> : pagination.pageItems.map((row) => (
                            <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "170px 180px 140px minmax(230px,1fr) 165px 140px 150px" }}>
                                <Box sx={tableCellSx}>
                                    <Typography sx={mainTextSx}>{row.requisitionNumber || "-"}</Typography>
                                    <Typography sx={subTextSx}>By {row.requestedBy || "-"}</Typography>
                                </Box>
                                <Box sx={tableCellSx}>
                                    <Typography sx={mainTextSx}>{row.projectCode || "-"}</Typography>
                                    <Typography sx={subTextSx}>{row.drawingNo || "-"}</Typography>
                                </Box>
                                <Box sx={tableCellSx}>
                                    <Typography sx={mainTextSx}>{row.bomNumber || "-"}</Typography>
                                    <Typography sx={subTextSx}>Rev {row.bomRevisionNo ?? "-"}</Typography>
                                </Box>
                                <Box sx={{ ...tableCellSx, whiteSpace: "normal" }}>
                                    <Typography sx={mainTextSx}>{row.requestedBy || "-"} · {row.productionPlantCode || "-"}</Typography>
                                    <Typography sx={subTextSx}>{routeText(row)}</Typography>
                                </Box>
                                <Box sx={tableCellSx}><MatFlowStatusChip status={row.status} /></Box>
                                <Box sx={tableCellSx}>{formatDate(row.requestedAt)}</Box>
                                <Box sx={{ ...tableCellSx, display: "flex", gap: .5, flexWrap: "wrap" }}>
                                    <Button onClick={() => navigate(`/matflow/requisitions/${row.id}`)} sx={secondaryBtnSx}>Open</Button>
                                    {canCreate && normalize(row.status) === "DRAFT" && row.rowVersion != null && (
                                        <Button startIcon={<DeleteOutlineIcon />} onClick={() => setDeleteTarget(row)} sx={dangerBtnSx}>Delete</Button>
                                    )}
                                </Box>
                            </Box>
                        ))}
                    </Box>
                )}
                {!loading && viewMode === "TABLE" && (
                    <MatFlowPagination {...pagination} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} label="Material Requisitions" />
                )}
            </Card>

            <MatFlowDeleteDialog
                open={Boolean(deleteTarget)}
                title="Delete Draft MR?"
                subject={deleteTarget?.requisitionNumber || "Draft MR"}
                description="Only a Draft MR can be permanently deleted. Submitted MRs remain traceable and must use Cancel instead."
                working={working}
                onClose={() => setDeleteTarget(null)}
                onConfirm={confirmDelete}
            />
        </Box>
    );
}

export function MatFlowRequisitionCreatePage() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const { selectedPlantParam } = useMatFlow();

    const initialBomId = params.get("bomId") || "";
    const [boms, setBoms] = useState([]);
    const [selectedBomId, setSelectedBomId] = useState(initialBomId);
    const [selectedBom, setSelectedBom] = useState(null);
    const [selectionMode, setSelectionMode] = useState("FULL_BOM");
    const [selectedLineIds, setSelectedLineIds] = useState({});
    const [lineInputs, setLineInputs] = useState({});
    const [alreadyRequestedByLineId, setAlreadyRequestedByLineId] = useState({});
    const [remainingByLineId, setRemainingByLineId] = useState({});
    const [remarks, setRemarks] = useState("");
    const [loading, setLoading] = useState(true);
    const [bomLoading, setBomLoading] = useState(false);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            setError("");
            try {
                const bomResponse = await matflowApi.listBoms({ status: "APPROVED", latestOnly: false });
                if (!active) return;

                setBoms(extractMatFlowPage(bomResponse?.data).rows.filter((bom) =>
                    normalize(bom.status) === "APPROVED" &&
                    bom.effective === true &&
                    (!selectedPlantParam || upperCode(bom.plantCode) === upperCode(selectedPlantParam))
                ));
            } catch (requestError) {
                if (active) setError(readMatFlowError(requestError, "Unable to load reviewed BOMs."));
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [selectedPlantParam]);

    useEffect(() => {
        if (!selectedBomId) {
            setSelectedBom(null);
            setSelectedLineIds({});
            setLineInputs({});
            setAlreadyRequestedByLineId({});
            setRemainingByLineId({});
            setSelectionMode("FULL_BOM");
            return;
        }

        let active = true;
        (async () => {
            setBomLoading(true);
            setError("");
            try {
                const [bomResponse, requisitionResponse] = await Promise.all([
                    matflowApi.getBom(selectedBomId),
                    matflowApi.listRequisitions().catch(() => ({ data: [] })),
                ]);
                const loaded = bomResponse?.data || null;
                if (!active) return;
                if (!loaded || normalize(loaded.status) !== "APPROVED" || loaded.effective !== true) {
                    throw new Error("Only a Production-reviewed effective BOM can be requisitioned.");
                }

                const priorRequested = {};
                const existingMrs = Array.isArray(requisitionResponse?.data) ? requisitionResponse.data : [];
                existingMrs
                    .filter((mr) => String(mr?.bomId || "") === String(loaded.id) && normalize(mr?.status) !== "CANCELLED")
                    .forEach((mr) => {
                        (Array.isArray(mr?.lines) ? mr.lines : []).forEach((line) => {
                            const key = String(line?.bomLineId || "");
                            if (!key) return;
                            priorRequested[key] = numeric(priorRequested[key]) + numeric(line?.requestedQty);
                        });
                    });

                const remaining = {};
                const nextSelected = {};
                const nextInputs = {};
                (loaded.lines || []).forEach((line) => {
                    const key = String(line.id);
                    const approvedQty = Math.max(0, numeric(line.netRequiredQty));
                    const usedQty = Math.min(approvedQty, Math.max(0, numeric(priorRequested[key])));
                    const remainingQty = Math.max(0, approvedQty - usedQty);
                    priorRequested[key] = usedQty;
                    remaining[key] = remainingQty;
                    nextSelected[key] = remainingQty > 0.0005;
                    nextInputs[key] = remainingQty > 0.0005 ? String(Number(remainingQty.toFixed(3))) : "";
                });

                setSelectedBom(loaded);
                setAlreadyRequestedByLineId(priorRequested);
                setRemainingByLineId(remaining);
                setSelectedLineIds(nextSelected);
                setLineInputs(nextInputs);
                setSelectionMode("FULL_BOM");
            } catch (requestError) {
                if (active) {
                    setSelectedBom(null);
                    setSelectedLineIds({});
                    setLineInputs({});
                    setAlreadyRequestedByLineId({});
                    setRemainingByLineId({});
                    setError(readMatFlowError(requestError, requestError?.message || "Unable to load selected BOM."));
                }
            } finally {
                if (active) setBomLoading(false);
            }
        })();
        return () => { active = false; };
    }, [selectedBomId]);

    const project = selectedBom?.project || {};

    const lineRows = useMemo(() => (selectedBom?.lines || []).map((line) => {
        const key = String(line.id);
        const approvedQty = Math.max(0, numeric(line.netRequiredQty));
        const alreadyRequestedQty = Math.max(0, numeric(alreadyRequestedByLineId[key]));
        const remainingQty = Math.max(0, numeric(remainingByLineId[key]));
        return {
            ...line,
            key,
            approvedQty,
            alreadyRequestedQty,
            remainingQty,
            fullyRequisitioned: remainingQty <= 0.0005,
        };
    }), [selectedBom, alreadyRequestedByLineId, remainingByLineId]);

    const remainingLineCount = useMemo(
        () => lineRows.filter((line) => !line.fullyRequisitioned).length,
        [lineRows]
    );
    const alreadyCompleteLineCount = lineRows.length - remainingLineCount;
    const selectedCount = useMemo(
        () => lineRows.filter((line) => !line.fullyRequisitioned && Boolean(selectedLineIds[line.key])).length,
        [lineRows, selectedLineIds]
    );

    const useFullBom = () => {
        const nextSelected = {};
        const nextInputs = {};
        lineRows.forEach((line) => {
            nextSelected[line.key] = !line.fullyRequisitioned;
            nextInputs[line.key] = line.fullyRequisitioned ? "" : String(Number(line.remainingQty.toFixed(3)));
        });
        setSelectionMode("FULL_BOM");
        setSelectedLineIds(nextSelected);
        setLineInputs(nextInputs);
        setError("");
    };

    const useSelectedMaterials = () => {
        const nextSelected = {};
        lineRows.forEach((line) => { nextSelected[line.key] = false; });
        setSelectionMode("SELECTED_MATERIALS");
        setSelectedLineIds(nextSelected);
        setError("");
    };

    const selectAllRemaining = () => {
        const nextSelected = {};
        const nextInputs = { ...lineInputs };
        lineRows.forEach((line) => {
            nextSelected[line.key] = !line.fullyRequisitioned;
            if (!line.fullyRequisitioned && numeric(nextInputs[line.key]) <= 0) {
                nextInputs[line.key] = String(Number(line.remainingQty.toFixed(3)));
            }
        });
        setSelectedLineIds(nextSelected);
        setLineInputs(nextInputs);
    };

    const clearSelectedMaterials = () => {
        const nextSelected = {};
        lineRows.forEach((line) => { nextSelected[line.key] = false; });
        setSelectedLineIds(nextSelected);
    };

    const toggleMaterial = (line, checked) => {
        if (selectionMode !== "SELECTED_MATERIALS" || line.fullyRequisitioned) return;
        setSelectedLineIds((current) => ({ ...current, [line.key]: checked }));
        if (checked && numeric(lineInputs[line.key]) <= 0) {
            setLineInputs((current) => ({
                ...current,
                [line.key]: String(Number(line.remainingQty.toFixed(3))),
            }));
        }
    };

    const create = async () => {
        if (!selectedBom?.id) {
            setError("Select an effective BOM.");
            return;
        }

        const selectedRows = lineRows.filter((line) =>
            !line.fullyRequisitioned && Boolean(selectedLineIds[line.key])
        );

        if (!selectedRows.length) {
            setError(selectionMode === "FULL_BOM"
                ? "There is no remaining BOM material quantity available to requisition."
                : "Select at least one material. You can select one material or any number of materials.");
            return;
        }

        const requestLines = [];
        for (const line of selectedRows) {
            const requestedQty = selectionMode === "FULL_BOM"
                ? line.remainingQty
                : Number(lineInputs[line.key] || 0);

            if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
                setError(`Enter a requested quantity greater than zero for ${line.materialCode || line.materialName || "material"}.`);
                return;
            }
            if (requestedQty > line.remainingQty + 0.0005) {
                setError(`Requested quantity for ${line.materialCode || line.materialName || "material"} exceeds the remaining BOM quantity ${formatQty(line.remainingQty)} ${line.uom || ""}.`);
                return;
            }

            requestLines.push({
                bomLineId: line.id,
                requestedQty: Number(requestedQty.toFixed(3)),
                remarks: null,
            });
        }

        setWorking(true);
        setError("");
        try {
            const response = await matflowApi.createRequisition({
                projectDrawingId: project.id,
                bomId: selectedBom.id,
                remarks: clean(remarks) || null,
                lines: requestLines,
            });
            if (!response?.data?.id) throw new Error("Created MR ID was not returned.");
            navigate(`/matflow/requisitions/${response.data.id}`, { replace: true });
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to create Material Requisition."));
        } finally {
            setWorking(false);
        }
    };

    if (loading) return <LoadingBlock />;

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="NEW MR"
                title="Create Material Requisition"
                subtitle="Production can requisition one BOM material, any selected materials, or the full remaining BOM. Separate MRs stay linked to the same approved Product/BOM and cannot exceed its approved quantities."
                actions={<Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/matflow/production")} sx={secondaryBtnSx}>Back</Button>}
            />
            <ErrorBox>{error}</ErrorBox>

            <Card sx={panelSx}>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.4fr 1fr" }, gap: 1.5 }}>
                    <TextField
                        select
                        label="Reviewed Effective BOM *"
                        value={selectedBomId}
                        onChange={(event) => {
                            setSelectedBomId(event.target.value);
                            setSelectedBom(null);
                            setSelectedLineIds({});
                            setLineInputs({});
                            setAlreadyRequestedByLineId({});
                            setRemainingByLineId({});
                        }}
                        sx={fieldSx}
                    >
                        {boms.map((bom) => (
                            <MenuItem key={bom.id} value={bom.id}>
                                {bom.bomNumber} Rev {bom.revisionNo} · {bom.projectCode} · {bom.productName} · {bom.drawingNo}
                            </MenuItem>
                        ))}
                    </TextField>
                    <Box sx={{ ...fieldSx, px: 1.6, py: 1.15, border: "1px solid var(--mf-border)", borderRadius: 2 }}>
                        <Typography sx={subTextSx}>Production Plant / Requester</Typography>
                        <Typography sx={mainTextSx}>{selectedBom?.project?.plantCode || "Derived from selected BOM"} · current Production user</Typography>
                    </Box>
                    <TextField multiline minRows={2} label="MR Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} sx={{ ...fieldSx, gridColumn: "1 / -1" }} />
                </Box>
            </Card>

            {bomLoading && <LoadingBlock />}

            {selectedBom && !bomLoading && (
                <>
                    <Card sx={panelSx}>
                        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 1 }}>
                            <Detail label="PD No. / Project" value={`${project.projectCode || "-"} · ${project.projectName || "-"}`} />
                            <Detail label="Client" value={project.clientName || "-"} />
                            <Detail label="Product" value={project.productName || "-"} />
                            <Detail label="Drawing" value={`${project.drawingNo || "-"} · Rev ${project.drawingRevision || "0"}`} />
                            <Detail label="BOM" value={`${selectedBom.bomNumber} · Rev ${selectedBom.revisionNo}`} />
                        </Box>
                    </Card>

                    <Card sx={panelSx}>
                        <Typography sx={{ fontWeight: 950, fontSize: 17 }}>Requisition Scope</Typography>
                        <Typography sx={{ ...subTextSx, mt: .35 }}>
                            Choose the whole remaining BOM, or explicitly select one / multiple materials for this MR.
                        </Typography>

                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.25 }}>
                            <Button onClick={useFullBom} sx={selectionMode === "FULL_BOM" ? primaryBtnSx : secondaryBtnSx}>
                                Full Remaining BOM
                            </Button>
                            <Button onClick={useSelectedMaterials} sx={selectionMode === "SELECTED_MATERIALS" ? primaryBtnSx : secondaryBtnSx}>
                                Selected Materials
                            </Button>
                            {selectionMode === "SELECTED_MATERIALS" && (
                                <>
                                    <Button onClick={selectAllRemaining} sx={secondaryBtnSx}>Select All Remaining</Button>
                                    <Button onClick={clearSelectedMaterials} sx={secondaryBtnSx}>Clear Selection</Button>
                                </>
                            )}
                        </Box>

                        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 1, mt: 1.25 }}>
                            <Detail label="BOM Material Lines" value={lineRows.length} />
                            <Detail label="Remaining Lines" value={remainingLineCount} />
                            <Detail label="Already Fully Requisitioned" value={alreadyCompleteLineCount} />
                            <Detail label="Selected For This MR" value={selectedCount} />
                        </Box>

                        <Alert severity="info" sx={{ mt: 1.25 }}>
                            {selectionMode === "FULL_BOM"
                                ? `This MR will include all ${remainingLineCount} BOM material line(s) that still have unrequisitioned quantity. Previously requisitioned quantities are automatically excluded.`
                                : "Tick one row for a single-material MR, or tick any number of rows for a multi-material MR. Requested quantity can be lower than the remaining BOM quantity if Production only needs part of that material now."}
                        </Alert>

                        {remainingLineCount === 0 && (
                            <Alert severity="warning" sx={{ mt: 1 }}>
                                Every material on this BOM has already been fully requisitioned across non-cancelled MRs. Create another MR only after the BOM requirement changes through the approved revision workflow.
                            </Alert>
                        )}
                    </Card>

                    <Card sx={panelSx}>
                        <Typography sx={{ fontWeight: 950, fontSize: 17, mb: 1 }}>BOM Materials</Typography>
                        <Box sx={tableShellSx}>
                            <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "70px 210px 145px minmax(210px,1fr) 105px 120px 105px 145px" }}>
                                {[
                                    "Use",
                                    "Material",
                                    "Category",
                                    "Specification",
                                    "BOM Qty",
                                    "Already MR'd",
                                    "Remaining",
                                    "Request Qty",
                                ].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                            </Box>
                            {lineRows.map((line) => {
                                const checked = Boolean(selectedLineIds[line.key]) && !line.fullyRequisitioned;
                                return (
                                    <Box
                                        key={line.id}
                                        sx={{
                                            ...tableRowSx,
                                            gridTemplateColumns: "70px 210px 145px minmax(210px,1fr) 105px 120px 105px 145px",
                                            opacity: line.fullyRequisitioned ? .58 : 1,
                                        }}
                                    >
                                        <Box sx={{ ...tableCellSx, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <Checkbox
                                                checked={checked}
                                                disabled={selectionMode === "FULL_BOM" || line.fullyRequisitioned}
                                                onChange={(event) => toggleMaterial(line, event.target.checked)}
                                                inputProps={{ "aria-label": `Select ${line.materialName || line.materialCode || "material"}` }}
                                                sx={{ color: "var(--mf-muted)" }}
                                            />
                                        </Box>
                                        <Box sx={tableCellSx}>
                                            <Typography sx={mainTextSx}>{line.materialName}</Typography>
                                            <Typography sx={subTextSx}>{line.materialCode} · {line.uom}</Typography>
                                            {line.fullyRequisitioned && <Typography sx={{ ...subTextSx, color: "var(--mf-success, #65d890)" }}>Fully requisitioned</Typography>}
                                        </Box>
                                        <Box sx={tableCellSx}>{readable(line.materialCategorySnapshot)}</Box>
                                        <Box sx={{ ...tableCellSx, whiteSpace: "normal" }}>{line.specification || "-"}</Box>
                                        <Box sx={tableCellSx}>{formatQty(line.approvedQty)}</Box>
                                        <Box sx={tableCellSx}>{formatQty(line.alreadyRequestedQty)}</Box>
                                        <Box sx={tableCellSx}>
                                            <Typography sx={line.remainingQty > 0.0005 ? mainTextSx : subTextSx}>
                                                {formatQty(line.remainingQty)}
                                            </Typography>
                                        </Box>
                                        <Box sx={tableCellSx}>
                                            <TextField
                                                type="number"
                                                size="small"
                                                value={lineInputs[line.key] || ""}
                                                disabled={line.fullyRequisitioned || selectionMode === "FULL_BOM" || !checked}
                                                onChange={(event) => setLineInputs((current) => ({ ...current, [line.key]: event.target.value }))}
                                                inputProps={{ min: 0.001, max: line.remainingQty, step: 0.001 }}
                                                helperText={selectionMode === "FULL_BOM" && !line.fullyRequisitioned ? "Full remaining" : undefined}
                                                sx={fieldSx}
                                            />
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Box>

                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center", flexWrap: "wrap", mt: 1.5 }}>
                            <Typography sx={subTextSx}>
                                Backend protection remains authoritative: cumulative non-cancelled MRs can never exceed the approved quantity of any BOM line.
                            </Typography>
                            <Button
                                startIcon={<AddIcon />}
                                onClick={create}
                                disabled={working || remainingLineCount === 0 || selectedCount === 0}
                                sx={primaryBtnSx}
                            >
                                {working
                                    ? "Creating..."
                                    : selectionMode === "FULL_BOM"
                                        ? "Create Full BOM MR"
                                        : selectedCount === 1
                                            ? "Create Single-Material MR"
                                            : `Create ${selectedCount}-Material MR`}
                            </Button>
                        </Box>
                    </Card>
                </>
            )}
        </Box>
    );
}

export function MatFlowRequisitionDetailPage() {
    const { requisitionId } = useParams();
    const navigate = useNavigate();
    const { hasRole } = useMatFlow();
    const canAct = hasRole(CREATE_ROLES);

    const [snapshot, setSnapshot] = useState(null);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [action, setAction] = useState(null);
    const [actionText, setActionText] = useState("");
    const [deleteTarget, setDeleteTarget] = useState(null);

    const load = useCallback(async () => {
        if (!requisitionId) return;
        setLoading(true);
        setError("");
        try {
            setSnapshot((await matflowApi.getRequisitionPlanning(requisitionId))?.data || null);
        } catch (requestError) {
            setSnapshot(null);
            setError(readMatFlowError(requestError, "Unable to load Material Requisition."));
        } finally {
            setLoading(false);
        }
    }, [requisitionId]);

    useEffect(() => { load(); }, [load]);

    const requisition = snapshot?.requisition || null;
    const lines = Array.isArray(requisition?.lines) ? requisition.lines : [];
    const reservations = Array.isArray(snapshot?.reservations) ? snapshot.reservations : [];
    const indents = Array.isArray(snapshot?.indents) ? snapshot.indents : [];

    const totals = useMemo(() => lines.reduce((sum, line) => ({
        requested: sum.requested + numeric(line.requestedQty),
        reserved: sum.reserved + numeric(line.reservedQty),
        shortage: sum.shortage + numeric(line.shortageQty),
        issued: sum.issued + numeric(line.issuedQty),
        consumed: sum.consumed + numeric(line.consumedQty),
        returned: sum.returned + numeric(line.returnedQty),
    }), { requested: 0, reserved: 0, shortage: 0, issued: 0, consumed: 0, returned: 0 }), [lines]);

    const execute = async () => {
        if (!action || !requisition?.id || requisition.rowVersion == null) return;
        const text = clean(actionText);

        if (action === "CANCEL" && !text) {
            setError("Cancellation reason is required.");
            return;
        }

        setWorking(true);
        setError("");
        try {
            if (action === "SUBMIT") {
                await matflowApi.submitRequisition(requisition.id, {
                    rowVersion: requisition.rowVersion,
                    remarks: text || null,
                });
            }
            if (action === "CANCEL") {
                await matflowApi.cancelRequisition(requisition.id, {
                    rowVersion: requisition.rowVersion,
                    reason: text,
                });
            }
            setAction(null);
            setActionText("");
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to complete MR action."));
        } finally {
            setWorking(false);
        }
    };

    const confirmDelete = async () => {
        if (!requisition?.id || requisition.rowVersion == null) return;
        setWorking(true);
        setError("");
        try {
            await matflowApi.deleteDraftRequisition(requisition.id, requisition.rowVersion);
            navigate("/matflow/production", { replace: true });
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to delete Draft MR."));
        } finally {
            setWorking(false);
            setDeleteTarget(null);
        }
    };

    if (loading) return <LoadingBlock />;
    if (!requisition) return <Box sx={pageSx}><PageHero title="Material Requisition" /><ErrorBox>{error || "MR not found."}</ErrorBox></Box>;

    const status = normalize(requisition.status);

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="MATERIAL REQUISITION"
                title={requisition.requisitionNumber || "MR"}
                subtitle={`${requisition.projectCode || "-"} · ${requisition.drawingNo || "-"} · ${requisition.bomNumber || "-"}`}
                actions={
                    <>
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/matflow/production")} sx={secondaryBtnSx}>Back</Button>
                        {canAct && status === "DRAFT" && (
                            <>
                                <Button startIcon={<DeleteOutlineIcon />} onClick={() => setDeleteTarget(requisition)} sx={dangerBtnSx}>Delete Draft</Button>
                                <Button startIcon={<SendOutlinedIcon />} onClick={() => { setAction("SUBMIT"); setActionText(""); }} sx={primaryBtnSx}>{isMainPlant(requisition.productionPlantCode) ? "Submit to AL-P1 Main Store" : `Submit to ${requisition.productionPlantCode || "Plant"} Store`}</Button>
                            </>
                        )}
                        {canAct && !["DRAFT", "CANCELLED", "PRODUCTION_COMPLETED"].includes(status) && (
                            <Button startIcon={<CancelOutlinedIcon />} onClick={() => { setAction("CANCEL"); setActionText(""); }} sx={dangerBtnSx}>Cancel MR</Button>
                        )}
                    </>
                }
            />

            <ErrorBox>{error}</ErrorBox>

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(6,minmax(0,1fr))", gap: 1 }}>
                <SummaryCard label="Requested" value={formatQty(totals.requested)} />
                <SummaryCard label="Reserved" value={formatQty(totals.reserved)} />
                <SummaryCard label="Shortage" value={formatQty(totals.shortage)} />
                <SummaryCard label="Issued" value={formatQty(totals.issued)} />
                <SummaryCard label="Consumed" value={formatQty(totals.consumed)} />
                <SummaryCard label="Returned" value={formatQty(totals.returned)} />
            </Box>

            <Card sx={panelSx}>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 1 }}>
                    <Detail label="Status" value={<MatFlowStatusChip status={requisition.status} />} />
                    <Detail label="Requested By" value={requisition.requestedBy || "-"} />
                    <Detail label="Requested At" value={formatDate(requisition.requestedAt)} />
                    <Detail label="Submitted To Store" value={formatDate(requisition.submittedAt)} />
                    <Detail label="Production User / Plant" value={`${requisition.requestedBy || "-"} · ${requisition.productionPlantCode || "-"}`} />
                    <Detail label="Origin Plant Store" value={`${requisition.originStorePlantCode || requisition.productionPlantCode || "-"} Store`} />
                    <Detail label="Main Store" value="AL-P1 Main Store" />
                    <Detail label="Forwarded to Main Store" value={requisition.forwardedToMainStoreAt ? `${requisition.forwardedToMainStoreBy || "-"} · ${formatDate(requisition.forwardedToMainStoreAt)}` : (isMainPlant(requisition.productionPlantCode) ? "Direct on submit" : "Pending origin Store forward")} />
                    <Detail label="BOM" value={`${requisition.bomNumber || "-"} · Rev ${requisition.bomRevisionNo ?? "-"}`} />
                </Box>
            </Card>

            <Alert severity={isMainPlant(requisition.productionPlantCode) ? "info" : (requisition.forwardedToMainStoreAt ? "success" : "warning")}>
                {isMainPlant(requisition.productionPlantCode)
                    ? `Routing: ${requisition.requestedBy || "Production"} / AL-P1 → AL-P1 Main Store. Main Store owns planning; issue returns directly to the same Production requester.`
                    : requisition.forwardedToMainStoreAt
                        ? `Routing: ${requisition.requestedBy || "Production"} / ${requisition.productionPlantCode || "Origin Plant"} → ${requisition.productionPlantCode || "Origin Plant"} Store → AL-P1 Main Store. The same MR is forwarded unchanged; issue returns through that Plant Store to the same Production requester.`
                        : `Routing: ${requisition.requestedBy || "Production"} / ${requisition.productionPlantCode || "Origin Plant"} → ${requisition.productionPlantCode || "Origin Plant"} Store first. That Store forwards this same MR unchanged to AL-P1 Main Store before availability review.`}
            </Alert>

            <Card sx={panelSx}>
                <Typography sx={{ fontWeight: 950, fontSize: 17, mb: 1 }}>MR Material Lines</Typography>
                <Box sx={tableShellSx}>
                    <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "210px 150px 100px 100px 100px 100px 100px 120px" }}>
                        {["Material", "Category", "Requested", "Reserved", "Shortage", "Issued", "Consumed", "State"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                    </Box>
                    {lines.length === 0 ? <EmptyState /> : lines.map((line) => (
                        <Box key={line.id} sx={{ ...tableRowSx, gridTemplateColumns: "210px 150px 100px 100px 100px 100px 100px 120px" }}>
                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{line.materialName}</Typography><Typography sx={subTextSx}>{line.materialCode} · {line.uom}</Typography></Box>
                            <Box sx={tableCellSx}>{readable(line.materialCategory)}</Box>
                            <Box sx={tableCellSx}>{formatQty(line.requestedQty)}</Box>
                            <Box sx={tableCellSx}>{formatQty(line.reservedQty)}</Box>
                            <Box sx={tableCellSx}>{formatQty(line.shortageQty)}</Box>
                            <Box sx={tableCellSx}>{formatQty(line.issuedQty)}</Box>
                            <Box sx={tableCellSx}>{formatQty(line.consumedQty)}</Box>
                            <Box sx={tableCellSx}><MatFlowStatusChip status={line.status} /></Box>
                        </Box>
                    ))}
                </Box>
            </Card>

            <Card sx={panelSx}>
                <Typography sx={{ fontWeight: 950, fontSize: 17 }}>Execution Branches</Typography>
                <Typography sx={{ ...subTextSx, mb: 1.2 }}>Store Tally declarations/allocations and linked PIs are shown together. Plant/Store routing comes from the MR plant and exact Production requester; Processing uses only BOM-approved Processing Units.</Typography>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 1.2 }}>
                    <Box>
                        <Typography sx={mainTextSx}>Reservations</Typography>
                        {reservations.length === 0 ? <EmptyState>No reserved lots yet.</EmptyState> : reservations.map((row) => (
                            <Box key={row.id} sx={{ p: 1, mt: .6, border: "1px solid var(--mf-border)", borderRadius: 2 }}>
                                <Typography sx={mainTextSx}>{row.materialCode} · {formatQty(row.reservedQty)}</Typography>
                                <Typography sx={subTextSx}>{readable(row.responsibleDepartment)} · {readable(row.nextAction)} · demand plant {row.demandPlantCode || requisition.productionPlantCode || "-"}</Typography>
                            </Box>
                        ))}
                    </Box>

                    <Box>
                        <Typography sx={mainTextSx}>Linked Purchase Indents</Typography>
                        {indents.length === 0 ? <EmptyState>No shortage PI.</EmptyState> : indents.map((row) => (
                            <Box key={row.id} sx={{ p: 1, mt: .6, border: "1px solid var(--mf-border)", borderRadius: 2 }}>
                                <Typography sx={mainTextSx}>{row.indentNumber}</Typography>
                                <Typography sx={subTextSx}>{readable(row.status)} · Store {row.deliverToPlantCode} · {row.lines?.length || 0} line(s)</Typography>
                            </Box>
                        ))}
                    </Box>
                </Box>

            </Card>

            <Dialog open={Boolean(action)} onClose={() => !working && setAction(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>{action === "SUBMIT" ? "Submit MR to Store" : "Cancel Material Requisition"}</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    {action === "SUBMIT" && <Alert severity="info" sx={{ mb: 1.5 }}>{isMainPlant(requisition.productionPlantCode) ? "This MR goes directly to AL-P1 Main Store for availability/reservation." : `This MR goes first to ${requisition.originStorePlantCode || requisition.productionPlantCode || "the origin Plant Store"}. That Store forwards the same MR unchanged to AL-P1 Main Store; only Main Store performs availability, reservation and shortage PI planning.`}</Alert>}
                    <TextField
                        multiline
                        minRows={3}
                        label={action === "CANCEL" ? "Cancellation Reason *" : "Remarks"}
                        value={actionText}
                        onChange={(event) => setActionText(event.target.value)}
                        sx={fieldSx}
                        fullWidth
                    />
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setAction(null)} disabled={working} sx={secondaryBtnSx}>Back</Button>
                    <Button onClick={execute} disabled={working} sx={action === "CANCEL" ? dangerBtnSx : primaryBtnSx}>{working ? "Working..." : "Confirm"}</Button>
                </DialogActions>
            </Dialog>

            <MatFlowDeleteDialog
                open={Boolean(deleteTarget)}
                title="Delete Draft MR?"
                subject={requisition.requisitionNumber}
                description="This permanently removes only the Draft MR and its Draft lines."
                working={working}
                onClose={() => setDeleteTarget(null)}
                onConfirm={confirmDelete}
            />
        </Box>
    );
}
