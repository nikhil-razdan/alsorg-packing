import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
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
    MatFlowPagination,
    MatFlowStatusChip,
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

export function MatFlowRequisitionListPage() {
    const navigate = useNavigate();
    const { hasRole, selectedPlantParam } = useMatFlow();
    const canCreate = hasRole(CREATE_ROLES);

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
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
            if (selectedPlantParam && upperCode(row.destinationPlantCode) !== upperCode(selectedPlantParam)) return false;
            if (status && normalize(row.status) !== normalize(status)) return false;
            if (!term) return true;
            return [
                row.requisitionNumber,
                row.projectCode,
                row.drawingNo,
                row.bomNumber,
                row.destinationLocationCode,
                row.requestedBy,
                row.status,
            ].some((value) => clean(value).toLowerCase().includes(term));
        });
    }, [rows, search, status, selectedPlantParam]);

    const statusOptions = useMemo(() => [
        "",
        ...Array.from(new Set(rows.map((row) => normalize(row.status)).filter(Boolean))).sort(),
    ], [rows]);

    const pagination = useMatFlowPagination(filtered, 20);

    const confirmDelete = async () => {
        if (!deleteTarget?.id || deleteTarget.rowVersion == null) return;
        setWorking(true);
        setError("");
        try {
            await matflowApi.deleteDraftRequisition(deleteTarget.id, deleteTarget.rowVersion);
            setDeleteTarget(null);
            const response = await matflowApi.listRequisitions();
            setRows(Array.isArray(response?.data) ? response.data : []);
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to delete Draft MR."));
        } finally {
            setWorking(false);
        }
    };

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="PRODUCTION MATERIAL DEMAND"
                title="Material Requisitions"
                subtitle="Production raises one BOM-backed MR. AL-P1 Production submits directly to AL-P1 Main Store; AL-P2/P3/P4 Production submits to its own Plant Store, which forwards the same MR unchanged to Main Store."
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
                            Export Excel
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

            <Card sx={panelSx}>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 210px", gap: 1 }}>
                    <TextField label="Search" value={search} onChange={(event) => setSearch(event.target.value)} sx={fieldSx} />
                    <TextField select label="Status" value={status} onChange={(event) => setStatus(event.target.value)} sx={fieldSx}>
                        {statusOptions.map((value) => (
                            <MenuItem key={value || "ALL"} value={value}>{value ? readable(value) : "All Statuses"}</MenuItem>
                        ))}
                    </TextField>
                </Box>
            </Card>

            <Card sx={panelSx}>
                {loading ? <LoadingBlock /> : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 180px 140px minmax(230px,1fr) 165px 140px 150px" }}>
                            {["MR", "PD No. / Drawing", "BOM", "Plant Routing", "Status", "Requested", "Action"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
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
                                    <Typography sx={mainTextSx}>{row.destinationLocationCode || "-"} · {row.destinationPlantCode || "-"}</Typography>
                                    <Typography sx={subTextSx}>
                                        {isMainPlant(row.destinationPlantCode)
                                            ? `Direct → ${row.mainStoreCode || "AL-P1 Main Store"}`
                                            : `${row.originStoreCode || `${row.destinationPlantCode || "Origin"} Store`} → ${row.mainStoreCode || "AL-P1 Main Store"}`}
                                    </Typography>
                                    {row.forwardedToMainStoreAt && <Typography sx={subTextSx}>Forwarded {formatDate(row.forwardedToMainStoreAt)}</Typography>}
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
                {!loading && <MatFlowPagination {...pagination} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} label="Material Requisitions" />}
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
    const [locations, setLocations] = useState([]);
    const [selectedBomId, setSelectedBomId] = useState(initialBomId);
    const [selectedBom, setSelectedBom] = useState(null);
    const [destinationLocationId, setDestinationLocationId] = useState("");
    const [lineInputs, setLineInputs] = useState({});
    const [remarks, setRemarks] = useState("");
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            setError("");
            try {
                const [bomResponse, locationResponse] = await Promise.all([
                    matflowApi.listBoms({ status: "APPROVED", latestOnly: false }),
                    matflowApi.listLocations({ active: true }),
                ]);
                if (!active) return;

                setBoms(extractMatFlowPage(bomResponse?.data).rows.filter((bom) =>
                    normalize(bom.status) === "APPROVED" &&
                    bom.effective === true &&
                    (!selectedPlantParam || upperCode(bom.plantCode) === upperCode(selectedPlantParam))
                ));
                setLocations(extractMatFlowPage(locationResponse?.data).rows.filter((location) =>
                    location?.active !== false &&
                    normalize(location.locationType) === "PRODUCTION" &&
                    (!selectedPlantParam || upperCode(location.plantCode) === upperCode(selectedPlantParam))
                ));
            } catch (requestError) {
                if (active) setError(readMatFlowError(requestError, "Unable to load reviewed BOMs and Production locations."));
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [selectedPlantParam]);

    useEffect(() => {
        if (!selectedBomId) {
            setSelectedBom(null);
            setLineInputs({});
            return;
        }

        let active = true;
        (async () => {
            setError("");
            try {
                const response = await matflowApi.getBom(selectedBomId);
                const loaded = response?.data || null;
                if (!active) return;
                if (!loaded || normalize(loaded.status) !== "APPROVED" || loaded.effective !== true) {
                    throw new Error("Only a Production-reviewed effective BOM can be requisitioned.");
                }
                setSelectedBom(loaded);
                const next = {};
                (loaded.lines || []).forEach((line) => {
                    next[String(line.id)] = numeric(line.netRequiredQty) > 0 ? String(line.netRequiredQty) : "";
                });
                setLineInputs(next);

                const plant = upperCode(loaded?.project?.plantCode);
                const matching = locations.filter((location) => upperCode(location.plantCode) === plant);
                if (matching.length === 1) setDestinationLocationId(String(matching[0].id));
            } catch (requestError) {
                if (active) {
                    setSelectedBom(null);
                    setLineInputs({});
                    setError(readMatFlowError(requestError, requestError?.message || "Unable to load selected BOM."));
                }
            }
        })();
        return () => { active = false; };
    }, [selectedBomId, locations]);

    const project = selectedBom?.project || {};
    const availableDestinations = locations.filter((location) =>
        !project?.plantCode || upperCode(location.plantCode) === upperCode(project.plantCode)
    );

    const create = async () => {
        if (!selectedBom?.id || !destinationLocationId) {
            setError("Select an effective BOM and Production destination.");
            return;
        }

        const requestLines = (selectedBom.lines || [])
            .map((line) => ({
                bomLineId: line.id,
                requestedQty: Number(lineInputs[String(line.id)] || 0),
                remarks: null,
            }))
            .filter((line) => Number.isFinite(line.requestedQty) && line.requestedQty > 0);

        if (!requestLines.length) {
            setError("Enter at least one requested material quantity.");
            return;
        }

        for (const requestLine of requestLines) {
            const bomLine = selectedBom.lines.find((line) => String(line.id) === String(requestLine.bomLineId));
            if (requestLine.requestedQty > numeric(bomLine?.netRequiredQty) + .0005) {
                setError(`Requested quantity exceeds BOM quantity for ${bomLine?.materialCode || "material"}.`);
                return;
            }
        }

        setWorking(true);
        setError("");
        try {
            const response = await matflowApi.createRequisition({
                projectDrawingId: project.id,
                bomId: selectedBom.id,
                destinationLocationId,
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
                subtitle="Production requests materials against an effective BOM. The MR number is generated by the backend in MR/yyyy/MM/dd/n format."
                actions={<Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/matflow/production")} sx={secondaryBtnSx}>Back</Button>}
            />
            <ErrorBox>{error}</ErrorBox>

            <Card sx={panelSx}>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.4fr 1fr" }, gap: 1.5 }}>
                    <TextField select label="Reviewed Effective BOM *" value={selectedBomId} onChange={(e) => { setSelectedBomId(e.target.value); setDestinationLocationId(""); }} sx={fieldSx}>
                        {boms.map((bom) => (
                            <MenuItem key={bom.id} value={bom.id}>
                                {bom.bomNumber} Rev {bom.revisionNo} · {bom.projectCode} · {bom.productName} · {bom.drawingNo}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField select label="Production Destination *" value={destinationLocationId} disabled={!selectedBom} onChange={(e) => setDestinationLocationId(e.target.value)} sx={fieldSx}>
                        {availableDestinations.map((location) => (
                            <MenuItem key={location.id} value={location.id}>{location.locationCode} · {location.locationName} · {location.plantCode}</MenuItem>
                        ))}
                    </TextField>
                    <TextField multiline minRows={2} label="MR Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} sx={{ ...fieldSx, gridColumn: "1 / -1" }} />
                </Box>
            </Card>

            {selectedBom && (
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
                        <Typography sx={{ fontWeight: 950, fontSize: 17, mb: 1 }}>Requested Material Quantities</Typography>
                        <Box sx={tableShellSx}>
                            <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "210px 160px minmax(220px,1fr) 110px 150px" }}>
                                {["Material", "Category", "Specification", "BOM Qty", "Request Qty"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                            </Box>
                            {(selectedBom.lines || []).map((line) => (
                                <Box key={line.id} sx={{ ...tableRowSx, gridTemplateColumns: "210px 160px minmax(220px,1fr) 110px 150px" }}>
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{line.materialName}</Typography><Typography sx={subTextSx}>{line.materialCode} · {line.uom}</Typography></Box>
                                    <Box sx={tableCellSx}>{readable(line.materialCategorySnapshot)}</Box>
                                    <Box sx={{ ...tableCellSx, whiteSpace: "normal" }}>{line.specification || "-"}</Box>
                                    <Box sx={tableCellSx}>{formatQty(line.netRequiredQty)}</Box>
                                    <Box sx={tableCellSx}>
                                        <TextField
                                            type="number"
                                            size="small"
                                            value={lineInputs[String(line.id)] || ""}
                                            onChange={(event) => setLineInputs((current) => ({ ...current, [String(line.id)]: event.target.value }))}
                                            sx={fieldSx}
                                        />
                                    </Box>
                                </Box>
                            ))}
                        </Box>

                        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1.5 }}>
                            <Button startIcon={<AddIcon />} onClick={create} disabled={working} sx={primaryBtnSx}>
                                {working ? "Creating..." : "Create Draft MR"}
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
    const transfers = Array.isArray(snapshot?.transfers) ? snapshot.transfers : [];

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
                                <Button startIcon={<SendOutlinedIcon />} onClick={() => { setAction("SUBMIT"); setActionText(""); }} sx={primaryBtnSx}>{isMainPlant(requisition.destinationPlantCode) ? "Submit to AL-P1 Main Store" : `Submit to ${requisition.originStoreCode || requisition.destinationPlantCode || "Plant Store"}`}</Button>
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
                    <Detail label="Production Destination" value={`${requisition.destinationLocationCode || "-"} · ${requisition.destinationPlantCode || "-"}`} />
                    <Detail label="Origin Plant Store" value={`${requisition.originStoreCode || "-"} · ${requisition.originStorePlantCode || requisition.destinationPlantCode || "-"}`} />
                    <Detail label="AL-P1 Main Store" value={`${requisition.mainStoreCode || "-"} · ${requisition.mainStorePlantCode || MAIN_PLANT}`} />
                    <Detail label="Forwarded to Main Store" value={requisition.forwardedToMainStoreAt ? `${requisition.forwardedToMainStoreBy || "-"} · ${formatDate(requisition.forwardedToMainStoreAt)}` : (isMainPlant(requisition.destinationPlantCode) ? "Direct on submit" : "Pending origin Store forward")} />
                    <Detail label="BOM" value={`${requisition.bomNumber || "-"} · Rev ${requisition.bomRevisionNo ?? "-"}`} />
                </Box>
            </Card>

            <Alert severity={isMainPlant(requisition.destinationPlantCode) ? "info" : (requisition.forwardedToMainStoreAt ? "success" : "warning")}>
                {isMainPlant(requisition.destinationPlantCode)
                    ? `Routing: Production → ${requisition.mainStoreCode || "AL-P1 Main Store"}. Main Store owns planning and the material returns on the direct route.`
                    : requisition.forwardedToMainStoreAt
                        ? `Routing: Production → ${requisition.originStoreCode || `${requisition.destinationPlantCode} Store`} → ${requisition.mainStoreCode || "AL-P1 Main Store"}. The same MR was forwarded unchanged; outbound issue returns through the origin Store to the specific Production destination.`
                        : `Routing: Production → ${requisition.originStoreCode || `${requisition.destinationPlantCode} Store`} first. That Store must forward this same MR unchanged to ${requisition.mainStoreCode || "AL-P1 Main Store"} before availability/reservation.`}
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
                <Typography sx={{ ...subTextSx, mb: 1.2 }}>Store allocations, linked PIs and route lineage are shown together without exposing a separate Transfer workflow.</Typography>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 1.2 }}>
                    <Box>
                        <Typography sx={mainTextSx}>Reservations</Typography>
                        {reservations.length === 0 ? <EmptyState>No reserved lots yet.</EmptyState> : reservations.map((row) => (
                            <Box key={row.id} sx={{ p: 1, mt: .6, border: "1px solid var(--mf-border)", borderRadius: 2 }}>
                                <Typography sx={mainTextSx}>{row.materialCode} · {formatQty(row.reservedQty)}</Typography>
                                <Typography sx={subTextSx}>{row.sourceLocationCode} → {row.firstDestinationLocationCode} · {readable(row.nextAction)} · owner {readable(row.responsibleDepartment)}</Typography>
                            </Box>
                        ))}
                    </Box>

                    <Box>
                        <Typography sx={mainTextSx}>Linked Purchase Indents</Typography>
                        {indents.length === 0 ? <EmptyState>No shortage PI.</EmptyState> : indents.map((row) => (
                            <Box key={row.id} sx={{ p: 1, mt: .6, border: "1px solid var(--mf-border)", borderRadius: 2 }}>
                                <Typography sx={mainTextSx}>{row.indentNumber}</Typography>
                                <Typography sx={subTextSx}>{readable(row.status)} · Store {row.deliverToLocationCode} · {row.lines?.length || 0} line(s)</Typography>
                            </Box>
                        ))}
                    </Box>
                </Box>

                {transfers.length > 0 && (
                    <Box sx={{ mt: 1.4 }}>
                        <Typography sx={mainTextSx}>Read-only Material Route</Typography>
                        {transfers.map((row) => (
                            <Box key={row.id} sx={{ p: .8, mt: .5, borderLeft: "3px solid var(--mf-primary)", background: "var(--mf-surface)", borderRadius: 1 }}>
                                <Typography sx={subTextSx}>{row.materialCode} · {row.fromLocationCode} → {row.toLocationCode} · {readable(row.status)}</Typography>
                            </Box>
                        ))}
                    </Box>
                )}
            </Card>

            <Dialog open={Boolean(action)} onClose={() => !working && setAction(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>{action === "SUBMIT" ? "Submit MR to Store" : "Cancel Material Requisition"}</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    {action === "SUBMIT" && <Alert severity="info" sx={{ mb: 1.5 }}>{isMainPlant(requisition.destinationPlantCode) ? "This MR goes directly to AL-P1 Main Store for availability/reservation." : `This MR goes first to ${requisition.originStoreCode || requisition.destinationPlantCode || "the origin Plant Store"}. That Store forwards the same MR unchanged to AL-P1 Main Store; only Main Store performs availability, reservation and shortage PI planning.`}</Alert>}
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
