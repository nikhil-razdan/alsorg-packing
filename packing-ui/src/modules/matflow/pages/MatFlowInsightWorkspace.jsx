import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
    Box,
    Button,
    Card,
    Collapse,
    LinearProgress,
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useNavigate, useParams } from "react-router-dom";

import { useMatFlow } from "../matflowUi";
import { extractMatFlowPage, matflowApi, readMatFlowError } from "../api/matflowApi";
import { downloadMatFlowExcel } from "../api/matflowExcel";
import {
    Detail,
    EmptyState,
    ErrorBox,
    LoadingBlock,
    MatFlowPagination,
    MatFlowStatusChip,
    PageHero,
    SummaryCard,
    TimingHealthChip,
    clean,
    fieldSx,
    formatDate,
    formatDurationMinutes,
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

const FLOW = [
    ["DEMAND", "Production MR"],
    ["STORE", "Store"],
    ["PURCHASE", "Purchase"],
    ["QC", "QC"],
    ["PROCESSING", "Processing"],
    ["PRODUCTION", "Production"],
    ["COMPLETE", "Complete"],
];

const stageBucket = (stage) => {
    switch (normalize(stage)) {
        case "DRAFT": return "DEMAND";
        case "AWAITING_STORE_PLANNING":
        case "MATERIAL_RESERVED":
        case "READY_TO_ISSUE": return "STORE";
        case "SHORTAGE_PENDING": return "PURCHASE";
        case "QC_PENDING":
        case "QC_ROUTING_PENDING": return "QC";
        case "PROCESSING": return "PROCESSING";
        case "TRANSFER_IN_PROGRESS":
        case "PRODUCTION_ISSUE":
        case "PRODUCTION_IN_PROGRESS": return "PRODUCTION";
        case "PRODUCTION_COMPLETED": return "COMPLETE";
        default: return "DEMAND";
    }
};

const nextActionTarget = (row) => {
    const id = row?.requisitionId;
    switch (normalize(row?.currentStage)) {
        case "AWAITING_STORE_PLANNING":
        case "MATERIAL_RESERVED":
        case "SHORTAGE_PENDING":
        case "READY_TO_ISSUE":
            return { label: "Store", path: `/matflow/store/requisitions/${id}` };
        case "QC_PENDING":
        case "QC_ROUTING_PENDING":
            return { label: "QC", path: "/matflow/qc" };
        case "PROCESSING":
            return { label: "Processing", path: "/matflow/processing" };
        case "PRODUCTION_ISSUE":
        case "PRODUCTION_IN_PROGRESS":
            return { label: "Production", path: "/matflow/production-execution" };
        case "TRANSFER_IN_PROGRESS":
            return { label: "Track Route", path: `/matflow/tracker/${id}` };
        default:
            return { label: "Open MR", path: `/matflow/requisitions/${id}` };
    }
};

export function MatFlowDashboardPage() {
    const navigate = useNavigate();
    const { selectedPlantParam } = useMatFlow();
    const [data, setData] = useState(null);
    const [tracker, setTracker] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [dashboardResponse, trackerResponse] = await Promise.all([
                matflowApi.dashboardReport({ plantCode: selectedPlantParam }),
                matflowApi.getTracker({ plantCode: selectedPlantParam }),
            ]);
            setData(dashboardResponse?.data || null);
            setTracker(trackerResponse?.data || null);
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to load MatFlow dashboard."));
        } finally {
            setLoading(false);
        }
    }, [selectedPlantParam]);

    useEffect(() => { load(); }, [load]);

    const totals = data?.totals || {};
    const kpis = tracker?.kpis || {};
    const liveRows = (tracker?.rows || [])
        .filter((row) => !["CANCELLED", "PRODUCTION_COMPLETED"].includes(normalize(row.currentStage)))
        .sort((a, b) => numeric(b.ageHours) - numeric(a.ageHours))
        .slice(0, 8);

    const cards = [
        ["Active Projects", totals.activeProjects ?? 0],
        ["Open MRs", kpis.activeRequisitions ?? totals.openRequisitions ?? 0],
        ["Shortage MRs", kpis.shortagePending ?? totals.shortageRequisitions ?? 0],
        ["Material In Transit", kpis.materialInTransit ?? totals.inTransitOutboundTransfers ?? 0],
        ["Pending QC", totals.pendingQcInspections ?? 0],
        ["Processing Jobs", totals.activeProcessingJobs ?? 0],
    ];

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="MATFLOW"
                title="Material Operations Command Center"
                subtitle="Track Project → Product → Material demand, Store availability, procurement, QC/Processing and Production readiness without separate approval or Transfer desks."
                actions={<Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>}
            />
            <ErrorBox>{error}</ErrorBox>
            {loading ? <LoadingBlock /> : (
                <>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(6,minmax(0,1fr))", gap: 1 }}>
                        {cards.map(([label, value]) => <SummaryCard key={label} label={label} value={value ?? 0} />)}
                    </Box>

                    <Card sx={panelSx}>
                        <Typography sx={{ fontWeight: 950, fontSize: 17 }}>Live Material Execution</Typography>
                        <Typography sx={{ ...subTextSx, mb: 1.2 }}>The highest-age active Project/Product MRs and their current material owner/location.</Typography>
                        <Box sx={tableShellSx}>
                            <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "220px 160px 170px 170px 120px 170px 120px" }}>
                                {["Project / Product", "MR", "Current Department", "Current Location", "Ready %", "Blocker / Next", "Action"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                            </Box>
                            {liveRows.length === 0 ? <EmptyState>No active Material Requisitions.</EmptyState> : liveRows.map((row) => {
                                const target = nextActionTarget(row);
                                return (
                                    <Box key={row.requisitionId} sx={{ ...tableRowSx, gridTemplateColumns: "220px 160px 170px 170px 120px 170px 120px" }}>
                                        <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.projectCode} · {row.productName}</Typography><Typography sx={subTextSx}>{row.clientName} · {row.drawingNo}</Typography></Box>
                                        <Box sx={tableCellSx}>{row.requisitionNumber}</Box>
                                        <Box sx={tableCellSx}><Typography sx={mainTextSx}>{readable(row.currentDepartment || row.responsibleDesk)}</Typography><Typography sx={subTextSx}>{readable(row.currentStage)}</Typography></Box>
                                        <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.currentLocationCode || "-"}</Typography><Typography sx={subTextSx}>{row.currentLocationName || "-"}</Typography></Box>
                                        <Box sx={tableCellSx}>{Math.round(numeric(row.materialReadyPercent))}%</Box>
                                        <Box sx={tableCellSx}><Typography sx={subTextSx}>{readable(row.productionStartBlocker || row.nextDepartment || row.currentStage)}</Typography></Box>
                                        <Box sx={tableCellSx}><Button onClick={() => navigate(target.path)} sx={secondaryBtnSx}>{target.label}</Button></Box>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Card>

                    <Card sx={panelSx}>
                        <Typography sx={{ fontWeight: 950, fontSize: 17, mb: 1 }}>Workflow</Typography>
                        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 1 }}>
                            {[
                                ["Projects", "Project + Products", "/matflow/projects"],
                                ["BOM", "Engineering → Production Review", "/matflow/boms"],
                                ["MR", "Production demand", "/matflow/production"],
                                ["Store", "Reserve / QC / PI", "/matflow/store"],
                                ["Purchase", "PI → PO → GRN", "/matflow/purchase"],
                                ["QC / Processing", "Only when selected", "/matflow/qc"],
                                ["Production", "Receive → account → complete", "/matflow/production-execution"],
                            ].map(([title, subtitle, path]) => (
                                <Card key={title} onClick={() => navigate(path)} sx={{ ...panelSx, m: 0, cursor: "pointer", boxShadow: "none" }}>
                                    <Typography sx={mainTextSx}>{title}</Typography>
                                    <Typography sx={subTextSx}>{subtitle}</Typography>
                                </Card>
                            ))}
                        </Box>
                    </Card>
                </>
            )}
        </Box>
    );
}

export function MatFlowTrackerPage() {
    const navigate = useNavigate();
    const { selectedPlantParam } = useMatFlow();
    const [data, setData] = useState({ kpis: {}, rows: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [stage, setStage] = useState("");
    const [expandedProjects, setExpandedProjects] = useState({});

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await matflowApi.getTracker({
                plantCode: selectedPlantParam,
                search: clean(search) || undefined,
                stage: stage || undefined,
            });
            setData(response?.data || { kpis: {}, rows: [] });
        } catch (requestError) {
            setData({ kpis: {}, rows: [] });
            setError(readMatFlowError(requestError, "Unable to load Project Material Tracker."));
        } finally {
            setLoading(false);
        }
    }, [selectedPlantParam, search, stage]);

    useEffect(() => { load(); }, [load]);

    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const kpis = data?.kpis || {};
    const stages = useMemo(() => ["", ...Array.from(new Set(rows.map((row) => normalize(row.currentStage)).filter(Boolean))).sort()], [rows]);
    const projectGroups = useMemo(() => {
        const grouped = new Map();
        rows.forEach((row) => {
            const key = [row.projectCode, row.projectName, row.clientName].map((value) => clean(value).toUpperCase()).join("|") || `PROJECT:${row.projectDrawingId || row.requisitionId}`;
            if (!grouped.has(key)) {
                grouped.set(key, {
                    key,
                    projectCode: row.projectCode,
                    projectName: row.projectName,
                    clientName: row.clientName,
                    plantCode: row.destinationPlantCode,
                    rows: [],
                });
            }
            grouped.get(key).rows.push(row);
        });
        return Array.from(grouped.values()).map((project) => ({
            ...project,
            productCount: new Set(project.rows.map((row) => row.projectDrawingId || `${row.productName}:${row.drawingNo}`)).size,
            shortageQty: project.rows.reduce((sum, row) => sum + numeric(row.shortageQty), 0),
            readyCount: project.rows.filter((row) => row.readyToStartProduction === true).length,
            riskCount: project.rows.filter((row) => ["BREACHED", "COMPLETED_LATE"].includes(normalize(row.timingHealth))).length,
        }));
    }, [rows]);
    const projectPagination = useMatFlowPagination(projectGroups, 8);

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="PROJECT / PRODUCT TRACKER"
                title="Material Execution Tracker"
                subtitle="One row per MR with Product context, current material department/location, readiness, shortage and the next responsible action."
                actions={
                    <>
                        <Button startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMatFlowExcel({ fileName: "MatFlow_Project_Tracker", sheetName: "Tracker", title: "MatFlow Project Material Tracker", rows })} sx={secondaryBtnSx}>Export Excel</Button>
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                    </>
                }
            />

            <ErrorBox>{error}</ErrorBox>

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(6,minmax(0,1fr))", gap: 1 }}>
                <SummaryCard label="Active MRs" value={kpis.activeRequisitions ?? 0} />
                <SummaryCard label="Awaiting Store" value={kpis.awaitingStorePlanning ?? 0} />
                <SummaryCard label="Shortage" value={kpis.shortagePending ?? 0} />
                <SummaryCard label="Reserved" value={kpis.materialReserved ?? 0} />
                <SummaryCard label="In Transit" value={kpis.materialInTransit ?? 0} />
                <SummaryCard label="Production" value={kpis.productionInProgress ?? 0} />
            </Box>

            <Card sx={panelSx}>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 1 }}>
                    <TextField label="Search Project / Product / MR / Material State" value={search} onChange={(e) => setSearch(e.target.value)} sx={fieldSx} />
                    <TextField select label="Current Stage" value={stage} onChange={(e) => setStage(e.target.value)} sx={fieldSx}>
                        {stages.map((value) => <MenuItem key={value || "ALL"} value={value}>{value ? readable(value) : "All Stages"}</MenuItem>)}
                    </TextField>
                </Box>
            </Card>

            <Box sx={{ display: "grid", gap: 1 }}>
                {loading ? <LoadingBlock /> : projectPagination.pageItems.length === 0 ? <EmptyState /> : projectPagination.pageItems.map((project) => {
                    const expanded = expandedProjects[project.key] === true;
                    return (
                        <Card key={project.key} sx={{ ...panelSx, p: 0, overflow: "hidden" }}>
                            <Box
                                role={!expanded ? "button" : undefined}
                                tabIndex={!expanded ? 0 : undefined}
                                onClick={() => {
                                    if (!expanded) setExpandedProjects((current) => ({ ...current, [project.key]: true }));
                                }}
                                onKeyDown={(event) => {
                                    if (!expanded && (event.key === "Enter" || event.key === " ")) {
                                        event.preventDefault();
                                        setExpandedProjects((current) => ({ ...current, [project.key]: true }));
                                    }
                                }}
                                sx={{
                                    px: 1.5,
                                    py: 1.2,
                                    display: "grid",
                                    gridTemplateColumns: "minmax(260px,1fr) 110px 120px 120px 48px",
                                    gap: 1,
                                    alignItems: "center",
                                    cursor: expanded ? "default" : "pointer",
                                    background: expanded ? "var(--mf-surface)" : "var(--mf-panel-bg)",
                                }}
                            >
                                <Box>
                                    <Typography sx={{ ...mainTextSx, fontSize: 14 }}>{project.projectCode || "-"} · {project.projectName || "Project"}</Typography>
                                    <Typography sx={subTextSx}>{project.clientName || "-"} · {project.plantCode || "-"}</Typography>
                                </Box>
                                <Box><Typography sx={mainTextSx}>{project.productCount}</Typography><Typography sx={subTextSx}>Products</Typography></Box>
                                <Box><Typography sx={mainTextSx}>{project.rows.length}</Typography><Typography sx={subTextSx}>MRs</Typography></Box>
                                <Box><Typography sx={mainTextSx}>{formatQty(project.shortageQty)}</Typography><Typography sx={subTextSx}>{project.riskCount ? `${project.riskCount} timing risk` : `${project.readyCount} ready`}</Typography></Box>
                                <Box sx={{ display: "grid", placeItems: "center" }}>
                                    {expanded && (
                                        <Button
                                            aria-label="Collapse project"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setExpandedProjects((current) => ({ ...current, [project.key]: false }));
                                            }}
                                            sx={{ ...secondaryBtnSx, minWidth: 38, width: 38, px: 0 }}
                                        >
                                            <ExpandLessIcon fontSize="small" />
                                        </Button>
                                    )}
                                </Box>
                            </Box>

                            <Collapse in={expanded} unmountOnExit>
                                <Box sx={tableShellSx}>
                                    <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "200px 165px 165px 155px 105px 120px 175px 110px" }}>
                                        {["Product / Drawing", "MR", "Current Owner", "Current Location", "Ready", "Shortage", "Next", "Action"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                                    </Box>
                                    {project.rows.map((row) => (
                                        <Box key={row.requisitionId} sx={{ ...tableRowSx, gridTemplateColumns: "200px 165px 165px 155px 105px 120px 175px 110px" }}>
                                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.productName || "-"}</Typography><Typography sx={subTextSx}>{row.drawingNo || "-"}</Typography></Box>
                                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.requisitionNumber}</Typography><Typography sx={subTextSx}>{readable(row.currentStage)}</Typography></Box>
                                            <Box sx={tableCellSx}>{readable(row.currentDepartment || row.responsibleDesk)}</Box>
                                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.currentLocationCode || "-"}</Typography><Typography sx={subTextSx}>{row.currentLocationName || "-"}</Typography></Box>
                                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{Math.round(numeric(row.materialReadyPercent))}%</Typography><LinearProgress variant="determinate" value={Math.min(100, Math.max(0, numeric(row.materialReadyPercent)))} /></Box>
                                            <Box sx={tableCellSx}>{formatQty(row.shortageQty)}</Box>
                                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{readable(row.nextDepartment || row.productionStartBlocker)}</Typography><TimingHealthChip health={row.timingHealth} /></Box>
                                            <Box sx={tableCellSx}><Button endIcon={<ArrowForwardIcon />} onClick={() => navigate(`/matflow/tracker/${row.requisitionId}`)} sx={secondaryBtnSx}>Track</Button></Box>
                                        </Box>
                                    ))}
                                </Box>
                            </Collapse>
                        </Card>
                    );
                })}
            </Box>
            {!loading && <MatFlowPagination {...projectPagination} onPageChange={projectPagination.setPage} onPageSizeChange={projectPagination.setPageSize} label="Projects" />}
        </Box>
    );
}

export function MatFlowTrackerDetailPage() {
    const { requisitionId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        if (!requisitionId) return;
        setLoading(true);
        setError("");
        try {
            setData((await matflowApi.getTrackerDetail(requisitionId))?.data || null);
        } catch (requestError) {
            setData(null);
            setError(readMatFlowError(requestError, "Unable to load tracker detail."));
        } finally {
            setLoading(false);
        }
    }, [requisitionId]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <LoadingBlock />;
    const summary = data?.summary;
    if (!summary) return <Box sx={pageSx}><PageHero title="Tracker Detail" /><ErrorBox>{error || "Tracker record not found."}</ErrorBox></Box>;

    const stages = Array.isArray(data?.stages) ? data.stages : [];
    const materials = Array.isArray(data?.materials) ? data.materials : [];
    const events = Array.isArray(data?.events) ? data.events : [];

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="MR MATERIAL TRACE"
                title={`${summary.projectCode} · ${summary.productName}`}
                subtitle={`${summary.requisitionNumber} · ${summary.clientName || "-"} · ${summary.drawingNo || "-"}`}
                actions={
                    <>
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                        <Button onClick={() => navigate("/matflow/tracker")} sx={secondaryBtnSx}>Back</Button>
                    </>
                }
            />
            <ErrorBox>{error}</ErrorBox>

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 1 }}>
                <SummaryCard label="Material Ready" value={`${Math.round(numeric(summary.materialReadyPercent))}%`} />
                <SummaryCard label="Shortage" value={formatQty(summary.shortageQty)} />
                <SummaryCard label="Current Owner" value={readable(summary.currentDepartment)} />
                <SummaryCard label="Stage Time" value={formatDurationMinutes(summary.stageDurationMinutes)} />
                <SummaryCard label="Production Start" value={summary.readyToStartProduction ? "READY" : readable(summary.productionStartBlocker)} />
            </Box>

            <Card sx={panelSx}>
                <Typography sx={{ fontWeight: 950, fontSize: 17 }}>Major Workflow</Typography>
                <Box sx={{ mt: 1, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 1 }}>
                    {stages.map((stage) => (
                        <Card key={stage.key} sx={{ ...panelSx, m: 0, boxShadow: "none" }}>
                            <Typography sx={mainTextSx}>{stage.label}</Typography>
                            <Typography sx={subTextSx}>{stage.department} · {stage.locationCode || "-"}</Typography>
                            <Box sx={{ mt: .8, display: "flex", gap: .6, alignItems: "center", flexWrap: "wrap" }}>
                                <MatFlowStatusChip status={stage.state} />
                                <TimingHealthChip health={stage.timingHealth} />
                            </Box>
                            <Typography sx={{ ...subTextSx, mt: .7 }}>{formatDurationMinutes(stage.durationMinutes)}</Typography>
                        </Card>
                    ))}
                </Box>
            </Card>

            <Card sx={panelSx}>
                <Typography sx={{ fontWeight: 950, fontSize: 17 }}>Material Positions</Typography>
                <Typography sx={{ ...subTextSx, mb: 1.1 }}>Specific material custody and next hand-off; internal transfer records are represented only as route state.</Typography>
                <Box sx={tableShellSx}>
                    <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "200px 110px 110px 110px 180px 170px 180px" }}>
                        {["Material", "Requested", "Shortage", "Tracked Qty", "Current", "Location / State", "Next"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                    </Box>
                    {materials.length === 0 ? <EmptyState /> : materials.map((row, index) => (
                        <Box key={`${row.requisitionLineId}:${row.reservationId || index}`} sx={{ ...tableRowSx, gridTemplateColumns: "200px 110px 110px 110px 180px 170px 180px" }}>
                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialName || "-"}</Typography><Typography sx={subTextSx}>{row.currentMaterialCode || row.bomMaterialCode} · {row.uom}</Typography></Box>
                            <Box sx={tableCellSx}>{formatQty(row.requestedQty)}</Box>
                            <Box sx={tableCellSx}>{formatQty(row.shortageQty)}</Box>
                            <Box sx={tableCellSx}>{formatQty(row.trackedQty)}</Box>
                            <Box sx={tableCellSx}>{readable(row.currentDepartment)}</Box>
                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.currentLocationCode || "-"}</Typography><Typography sx={subTextSx}>{readable(row.movementState)}</Typography></Box>
                            <Box sx={tableCellSx}>{readable(row.nextDepartment)}{row.nextLocationCode ? ` · ${row.nextLocationCode}` : ""}</Box>
                        </Box>
                    ))}
                </Box>
            </Card>

            {events.length > 0 && (
                <Card sx={panelSx}>
                    <Typography sx={{ fontWeight: 950, fontSize: 17, mb: 1 }}>Audit Timeline</Typography>
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "180px 160px 160px minmax(260px,1fr)" }}>
                            {["Action", "Actor", "Time", "Details"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {events.slice().reverse().slice(0, 50).map((event) => (
                            <Box key={event.id} sx={{ ...tableRowSx, gridTemplateColumns: "180px 160px 160px minmax(260px,1fr)" }}>
                                <Box sx={tableCellSx}>{readable(event.action)}</Box>
                                <Box sx={tableCellSx}>{event.actor || "-"}</Box>
                                <Box sx={tableCellSx}>{formatDate(event.actionAt)}</Box>
                                <Box sx={{ ...tableCellSx, whiteSpace: "normal" }}>{event.detailsJson || "-"}</Box>
                            </Box>
                        ))}
                    </Box>
                </Card>
            )}
        </Box>
    );
}

export function MatFlowMaterialTrackerPage() {
    const { materialId } = useParams();
    const navigate = useNavigate();
    const { selectedPlantParam } = useMatFlow();

    const [materials, setMaterials] = useState([]);
    const [selectedId, setSelectedId] = useState(materialId || "");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [activeOnly, setActiveOnly] = useState(true);
    const [expandedLotKey, setExpandedLotKey] = useState("");

    useEffect(() => {
        matflowApi.listMaterials({ active: true })
            .then((response) => setMaterials(extractMatFlowPage(response?.data).rows))
            .catch(() => setMaterials([]));
    }, []);

    const load = useCallback(async () => {
        const id = selectedId || materialId;
        if (!id) {
            setData(null);
            return;
        }
        setLoading(true);
        setError("");
        try {
            setData((await matflowApi.getMaterialTracker(id, {
                plantCode: selectedPlantParam,
                activeOnly,
            }))?.data || null);
        } catch (requestError) {
            setData(null);
            setError(readMatFlowError(requestError, "Unable to load Material Control Tower."));
        } finally {
            setLoading(false);
        }
    }, [selectedId, materialId, selectedPlantParam, activeOnly]);

    useEffect(() => { if (selectedId || materialId) load(); }, [load, selectedId, materialId]);

    const lots = Array.isArray(data?.lots) ? data.lots : [];
    const filteredLots = useMemo(() => {
        const term = clean(search).toLowerCase();
        if (!term) return lots;
        return lots.filter((row) => [
            row.projectCode,
            row.projectName,
            row.clientName,
            row.productName,
            row.drawingNo,
            row.requisitionNumber,
            row.currentStage,
            row.currentDepartment,
            row.currentLocationCode,
            row.nextDepartment,
            row.nextAction,
        ].some((value) => clean(value).toLowerCase().includes(term)));
    }, [lots, search]);

    const pagination = useMatFlowPagination(filteredLots, 20);
    const identity = data?.material || {};
    const kpis = data?.kpis || {};

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="MATERIAL CONTROL TOWER"
                title={identity.materialName || "Track One Material"}
                subtitle={identity.materialCode
                    ? `${identity.materialCode} · ${identity.category || "-"} · ${identity.uom || "-"}`
                    : "Select a Material Inventory item to see every Project/Product allocation, current route and next action."}
                actions={<Button startIcon={<RefreshIcon />} onClick={load} disabled={!selectedId && !materialId} sx={secondaryBtnSx}>Refresh</Button>}
            />

            <ErrorBox>{error}</ErrorBox>

            <Card sx={panelSx}>
                <Box sx={{ display: "grid", gridTemplateColumns: "minmax(280px,1fr) 220px 180px", gap: 1 }}>
                    <TextField select label="Material *" value={selectedId} onChange={(e) => { setSelectedId(e.target.value); navigate(`/matflow/tracker/materials/${e.target.value}`, { replace: true }); }} sx={fieldSx}>
                        {materials.map((material) => <MenuItem key={material.id} value={material.id}>{material.materialName} · {material.materialCode}</MenuItem>)}
                    </TextField>
                    <TextField label="Search allocations" value={search} onChange={(e) => setSearch(e.target.value)} sx={fieldSx} />
                    <TextField select label="Scope" value={activeOnly ? "ACTIVE" : "ALL"} onChange={(e) => setActiveOnly(e.target.value === "ACTIVE")} sx={fieldSx}>
                        <MenuItem value="ACTIVE">Live only</MenuItem>
                        <MenuItem value="ALL">All history</MenuItem>
                    </TextField>
                </Box>
            </Card>

            {loading ? <LoadingBlock /> : data && (
                <>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(6,minmax(0,1fr))", gap: 1 }}>
                        <SummaryCard label="Projects" value={kpis.projectCount ?? 0} />
                        <SummaryCard label="Products" value={kpis.productCount ?? 0} />
                        <SummaryCard label="Live Lots" value={kpis.liveLotCount ?? 0} />
                        <SummaryCard label="Shortage Qty" value={formatQty(kpis.shortageQty)} />
                        <SummaryCard label="Available Stock" value={formatQty(kpis.availableQty)} />
                        <SummaryCard label="Delayed Lots" value={kpis.delayedLotCount ?? 0} />
                    </Box>

                    <Card sx={panelSx}>
                        <Typography sx={{ fontWeight: 950, fontSize: 17 }}>Material Routes by Project/Product</Typography>
                        <Typography sx={{ ...subTextSx, mb: 1.2 }}>Each row follows the actual branch taken by this material, including Store, Purchase, QC, Processing and Production custody.</Typography>
                        <Box sx={tableShellSx}>
                            <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "220px 175px 130px 180px 150px 190px 150px 105px" }}>
                                {["Project / Product", "MR", "Tracked Qty", "Current", "Location", "Next Action", "Timing", "Route"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                            </Box>
                            {pagination.pageItems.length === 0 ? <EmptyState /> : pagination.pageItems.map((row) => {
                                const history = Array.isArray(row.history) ? row.history : [];
                                const expanded = expandedLotKey === row.lotKey;
                                return (
                                    <Fragment key={row.lotKey}>
                                        <Box sx={{ ...tableRowSx, gridTemplateColumns: "220px 175px 130px 180px 150px 190px 150px 105px" }}>
                                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.projectCode} · {row.productName}</Typography><Typography sx={subTextSx}>{row.clientName} · {row.drawingNo}</Typography></Box>
                                            <Box sx={tableCellSx}>{row.requisitionNumber || "-"}</Box>
                                            <Box sx={tableCellSx}>{formatQty(row.trackedQty)}</Box>
                                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{readable(row.currentDepartment)}</Typography><Typography sx={subTextSx}>{readable(row.currentStage)}</Typography></Box>
                                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.currentLocationCode || "-"}</Typography><Typography sx={subTextSx}>{row.currentLocationName || "-"}</Typography></Box>
                                            <Box sx={tableCellSx}><Typography sx={mainTextSx}>{readable(row.nextDepartment)}</Typography><Typography sx={subTextSx}>{readable(row.nextAction)}</Typography></Box>
                                            <Box sx={tableCellSx}><TimingHealthChip health={row.timingHealth} /><Typography sx={subTextSx}>{formatDurationMinutes(row.currentDwellMinutes)}</Typography></Box>
                                            <Box sx={tableCellSx}>
                                                <Button
                                                    onClick={() => setExpandedLotKey((current) => current === row.lotKey ? "" : row.lotKey)}
                                                    sx={secondaryBtnSx}
                                                >
                                                    {expanded ? "Hide" : "Route"}
                                                </Button>
                                            </Box>
                                        </Box>
                                        <Collapse in={expanded} unmountOnExit>
                                            <Box sx={{ p: 1.2, borderBottom: "1px solid var(--mf-border)", background: "var(--mf-surface)" }}>
                                                <Typography sx={{ fontWeight: 900, mb: .8 }}>Specific Material Route & Custody History</Typography>
                                                {history.length === 0 ? (
                                                    <Typography sx={subTextSx}>No custody events have been recorded for this lot yet.</Typography>
                                                ) : (
                                                    <Box sx={tableShellSx}>
                                                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "70px 190px 170px 170px 145px 145px 125px 150px" }}>
                                                            {["#", "State", "Department / Location", "Time In", "Time Out", "Duration", "Actor", "Reference"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                                                        </Box>
                                                        {history.map((event) => (
                                                            <Box key={`${row.lotKey}:${event.sequence}`} sx={{ ...tableRowSx, gridTemplateColumns: "70px 190px 170px 170px 145px 145px 125px 150px" }}>
                                                                <Box sx={tableCellSx}>{event.sequence}</Box>
                                                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{event.label || readable(event.state)}</Typography><Typography sx={subTextSx}>{readable(event.state)} · {formatQty(event.quantity)} {row.uom || ""}</Typography></Box>
                                                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{readable(event.department)}</Typography><Typography sx={subTextSx}>{event.locationCode || event.locationName || "Administrative / external"}</Typography></Box>
                                                                <Box sx={tableCellSx}>{formatDate(event.enteredAt)}</Box>
                                                                <Box sx={tableCellSx}>{event.exitedAt ? formatDate(event.exitedAt) : "Current"}</Box>
                                                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{formatDurationMinutes(event.durationMinutes)}</Typography><TimingHealthChip health={event.timingHealth} /></Box>
                                                                <Box sx={tableCellSx}>{event.actor || "-"}</Box>
                                                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{event.referenceNumber || event.referenceType || "-"}</Typography><Typography sx={subTextSx}>{event.note || ""}</Typography></Box>
                                                            </Box>
                                                        ))}
                                                    </Box>
                                                )}
                                            </Box>
                                        </Collapse>
                                    </Fragment>
                                );
                            })}
                        </Box>
                        <MatFlowPagination {...pagination} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} label="Material Lots" />
                    </Card>
                </>
            )}
        </Box>
    );
}

export function MatFlowMaterialRegisterPage() {
    const { selectedPlantParam } = useMatFlow();
    const [data, setData] = useState({ rows: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            setData((await matflowApi.materialRegister({
                plantCode: selectedPlantParam,
                search: clean(search) || undefined,
            }))?.data || { rows: [] });
        } catch (requestError) {
            setData({ rows: [] });
            setError(readMatFlowError(requestError, "Unable to load Material Register."));
        } finally {
            setLoading(false);
        }
    }, [selectedPlantParam, search]);

    useEffect(() => { load(); }, [load]);

    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const pagination = useMatFlowPagination(rows, 20);

    const totals = useMemo(() => rows.reduce((sum, row) => ({
        purchased: sum.purchased + numeric(row.purchasedQty),
        issued: sum.issued + numeric(row.issuedQty),
        consumed: sum.consumed + numeric(row.consumedQty),
        waste: sum.waste + numeric(row.productionWastedQty) + numeric(row.processingWastedQty),
        onHand: sum.onHand + numeric(row.onHandQty),
    }), { purchased: 0, issued: 0, consumed: 0, waste: 0, onHand: 0 }), [rows]);

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="DERIVED INVENTORY HELPER"
                title="Material Register"
                subtitle="Calculated from immutable stock ledger, balances and Processing records—purchased, issued, consumed, wasted, returned and current stock are never maintained in a duplicate register table."
                actions={
                    <>
                        <Button startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMatFlowExcel({ fileName: "MatFlow_Material_Register", sheetName: "Material Register", title: "MatFlow Material Register", rows })} sx={secondaryBtnSx}>Export Excel</Button>
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                    </>
                }
            />
            <ErrorBox>{error}</ErrorBox>

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 1 }}>
                <SummaryCard label="Purchased" value={formatQty(totals.purchased)} />
                <SummaryCard label="Issued to Production" value={formatQty(totals.issued)} />
                <SummaryCard label="Consumed" value={formatQty(totals.consumed)} />
                <SummaryCard label="Total Waste" value={formatQty(totals.waste)} />
                <SummaryCard label="On Hand" value={formatQty(totals.onHand)} />
            </Box>

            <Card sx={panelSx}>
                <TextField label="Search Material" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ ...fieldSx, minWidth: 320 }} />
            </Card>

            <Card sx={panelSx}>
                {loading ? <LoadingBlock /> : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "210px 110px 110px 110px 110px 110px 110px 110px 110px 140px" }}>
                            {["Material", "Purchased", "Issued", "Consumed", "Prod Waste", "Proc Waste", "Returned", "On Hand", "Available", "Last Movement"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {pagination.pageItems.length === 0 ? <EmptyState /> : pagination.pageItems.map((row) => (
                            <Box key={row.materialId} sx={{ ...tableRowSx, gridTemplateColumns: "210px 110px 110px 110px 110px 110px 110px 110px 110px 140px" }}>
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialName}</Typography><Typography sx={subTextSx}>{row.materialCode} · {row.uom}</Typography></Box>
                                <Box sx={tableCellSx}>{formatQty(row.purchasedQty)}</Box>
                                <Box sx={tableCellSx}>{formatQty(row.issuedQty)}</Box>
                                <Box sx={tableCellSx}>{formatQty(row.consumedQty)}</Box>
                                <Box sx={tableCellSx}>{formatQty(row.productionWastedQty)}</Box>
                                <Box sx={tableCellSx}>{formatQty(row.processingWastedQty)}</Box>
                                <Box sx={tableCellSx}>{formatQty(row.returnedQty)}</Box>
                                <Box sx={tableCellSx}>{formatQty(row.onHandQty)}</Box>
                                <Box sx={tableCellSx}>{formatQty(row.availableQty)}</Box>
                                <Box sx={tableCellSx}>{formatDate(row.lastMovementAt)}</Box>
                            </Box>
                        ))}
                    </Box>
                )}
                {!loading && <MatFlowPagination {...pagination} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} label="Material Register" />}
            </Card>
        </Box>
    );
}

export function MatFlowLedgerPage() {
    const { selectedPlantParam } = useMatFlow();
    const [data, setData] = useState({ rows: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [movementType, setMovementType] = useState("");
    const [page, setPage] = useState(0);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            setData(extractMatFlowPage((await matflowApi.stockLedger({
                plantCode: selectedPlantParam,
                search: clean(search) || undefined,
                movementType: movementType || undefined,
                page,
                size: 25,
            }))?.data));
        } catch (requestError) {
            setData({ rows: [], page: 0, totalPages: 0, totalElements: 0 });
            setError(readMatFlowError(requestError, "Unable to load Stock Ledger."));
        } finally {
            setLoading(false);
        }
    }, [selectedPlantParam, search, movementType, page]);

    useEffect(() => { load(); }, [load]);

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="IMMUTABLE STOCK HISTORY"
                title="Stock Ledger"
                subtitle="Physical stock, reservation, QC, issue, consumption, wastage and return movements with reference and actor traceability."
                actions={
                    <>
                        <Button startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMatFlowExcel({ fileName: "MatFlow_Stock_Ledger", sheetName: "Ledger", title: "MatFlow Stock Ledger", rows: data.rows || [] })} sx={secondaryBtnSx}>Export Page</Button>
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                    </>
                }
            />
            <ErrorBox>{error}</ErrorBox>

            <Card sx={panelSx}>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 1 }}>
                    <TextField label="Search reference / Project / Drawing / batch / actor" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} sx={fieldSx} />
                    <TextField label="Movement Type" value={movementType} onChange={(e) => { setMovementType(e.target.value); setPage(0); }} sx={fieldSx} />
                </Box>
            </Card>

            <Card sx={panelSx}>
                {loading ? <LoadingBlock /> : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "180px 170px 150px 150px 110px 130px 170px 140px" }}>
                            {["Material", "Location", "Movement", "Qty Change", "On Hand", "Reference", "Project / Drawing", "Actor / Time"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {(data.rows || []).length === 0 ? <EmptyState /> : data.rows.map((row) => (
                            <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "180px 170px 150px 150px 110px 130px 170px 140px" }}>
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialName}</Typography><Typography sx={subTextSx}>{row.materialCode}</Typography></Box>
                                <Box sx={tableCellSx}>{row.locationCode} · {row.plantCode}</Box>
                                <Box sx={tableCellSx}><MatFlowStatusChip status={row.movementType} /></Box>
                                <Box sx={tableCellSx}>{formatQty(row.quantityChange)}</Box>
                                <Box sx={tableCellSx}>{formatQty(row.onHandAfter)}</Box>
                                <Box sx={tableCellSx}>{row.referenceNumber || row.referenceType || "-"}</Box>
                                <Box sx={tableCellSx}>{row.projectCode || "-"} · {row.drawingNo || "-"}</Box>
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.actor || "-"}</Typography><Typography sx={subTextSx}>{formatDate(row.actionAt)}</Typography></Box>
                            </Box>
                        ))}
                    </Box>
                )}

                <Box sx={{ mt: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography sx={subTextSx}>{data.totalElements || 0} ledger rows</Typography>
                    <Box sx={{ display: "flex", gap: 1 }}>
                        <Button disabled={page <= 0} onClick={() => setPage((value) => Math.max(0, value - 1))} sx={secondaryBtnSx}>Previous</Button>
                        <Button disabled={page + 1 >= (data.totalPages || 0)} onClick={() => setPage((value) => value + 1)} sx={secondaryBtnSx}>Next</Button>
                    </Box>
                </Box>
            </Card>
        </Box>
    );
}

export function MatFlowReportsPage() {
    const { selectedPlantParam } = useMatFlow();
    const [shortages, setShortages] = useState([]);
    const [audits, setAudits] = useState({ rows: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [shortageResponse, auditResponse] = await Promise.all([
                matflowApi.shortageReport({ plantCode: selectedPlantParam, minimumAgeDays: 0 }),
                matflowApi.auditLogs({ plantCode: selectedPlantParam, page: 0, size: 25 }),
            ]);
            setShortages(Array.isArray(shortageResponse?.data) ? shortageResponse.data : []);
            setAudits(extractMatFlowPage(auditResponse?.data));
        } catch (requestError) {
            setShortages([]);
            setAudits({ rows: [] });
            setError(readMatFlowError(requestError, "Unable to load MatFlow reports."));
        } finally {
            setLoading(false);
        }
    }, [selectedPlantParam]);

    useEffect(() => { load(); }, [load]);

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="REPORTING"
                title="Operational Reports"
                subtitle="Shortage ageing and recent audit activity. Material stock roll-up lives in Material Register and physical movement detail lives in Stock Ledger."
                actions={<Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>}
            />
            <ErrorBox>{error}</ErrorBox>

            <Card sx={panelSx}>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center", mb: 1 }}>
                    <Box><Typography sx={{ fontWeight: 950, fontSize: 17 }}>Shortage Ageing</Typography><Typography sx={subTextSx}>Open MR shortages waiting on Store/Purchase closure.</Typography></Box>
                    <Button startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMatFlowExcel({ fileName: "MatFlow_Shortage_Ageing", sheetName: "Shortages", title: "MatFlow Shortage Ageing", rows: shortages })} sx={secondaryBtnSx}>Export</Button>
                </Box>
                {loading ? <LoadingBlock /> : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 190px 190px 100px 110px 120px 140px" }}>
                            {["MR", "Project / Drawing", "Material", "Requested", "Shortage", "Age", "Plant"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                        </Box>
                        {shortages.length === 0 ? <EmptyState>No open shortages.</EmptyState> : shortages.slice(0, 50).map((row) => (
                            <Box key={row.requisitionLineId} sx={{ ...tableRowSx, gridTemplateColumns: "170px 190px 190px 100px 110px 120px 140px" }}>
                                <Box sx={tableCellSx}>{row.requisitionNumber}</Box>
                                <Box sx={tableCellSx}>{row.projectCode} · {row.drawingNo}</Box>
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialName}</Typography><Typography sx={subTextSx}>{row.materialCode}</Typography></Box>
                                <Box sx={tableCellSx}>{formatQty(row.requestedQty)}</Box>
                                <Box sx={tableCellSx}>{formatQty(row.shortageQty)}</Box>
                                <Box sx={tableCellSx}>{row.ageDays} day(s)</Box>
                                <Box sx={tableCellSx}>{row.plantCode}</Box>
                            </Box>
                        ))}
                    </Box>
                )}
            </Card>

            <Card sx={panelSx}>
                <Typography sx={{ fontWeight: 950, fontSize: 17, mb: 1 }}>Recent Audit Activity</Typography>
                <Box sx={tableShellSx}>
                    <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "180px 170px 150px 170px minmax(240px,1fr)" }}>
                        {["Action", "Entity", "Actor", "Time", "Project / Details"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                    </Box>
                    {(audits.rows || []).length === 0 ? <EmptyState /> : audits.rows.map((row) => (
                        <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "180px 170px 150px 170px minmax(240px,1fr)" }}>
                            <Box sx={tableCellSx}>{readable(row.action)}</Box>
                            <Box sx={tableCellSx}>{row.entityType}</Box>
                            <Box sx={tableCellSx}>{row.actor || "-"}</Box>
                            <Box sx={tableCellSx}>{formatDate(row.actionAt)}</Box>
                            <Box sx={{ ...tableCellSx, whiteSpace: "normal" }}>{row.projectCode || "-"} · {row.drawingNo || "-"} · {row.detailsJson || ""}</Box>
                        </Box>
                    ))}
                </Box>
            </Card>
        </Box>
    );
}
