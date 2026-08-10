import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Box,
    Button,
    Card,
    LinearProgress,
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useNavigate } from "react-router-dom";
import { useMatFlow } from "../matflowUi";
import { extractMatFlowPage, matflowApi, readMatFlowError } from "../api/matflowApi";
import {
    EmptyState,
    ErrorBox,
    LoadingBlock,
    MatFlowStatusChip,
    PageHero,
    SummaryCard,
    clean,
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
} from "../matflowUi";

const STAGES = [
    ["Projects & Drawings", "Engineering project/product context", "/matflow/projects"],
    ["Operational BOMs", "Engineering BOM → direct Production review", "/matflow/boms"],
    ["Production Requisitions", "Material demand against approved BOM", "/matflow/production"],
    ["Store", "Availability, reservation, shortage and issue", "/matflow/store"],
    ["Transfers", "Approved material route movement", "/matflow/transfers"],
    ["Purchase", "Shortage procurement and vendor control", "/matflow/purchase"],
    ["QC", "Receipt and transfer inspection", "/matflow/qc"],
    ["Processing", "Input/output processing jobs", "/matflow/processing"],
];

const TRACKER_FLOW = [
    { key: "DEMAND", label: "Demand", caption: "Production requisition" },
    { key: "STORE", label: "Store", caption: "Review & reserve" },
    { key: "PURCHASE", label: "Purchase", caption: "Only when short" },
    { key: "ROUTE", label: "Route", caption: "QC / Processing" },
    { key: "PRODUCTION", label: "Production", caption: "Issue & consume" },
    { key: "COMPLETE", label: "Complete", caption: "Finished product" },
];

const TRACKER_STAGE_BUCKET = {
    DRAFT: "DEMAND",
    AWAITING_STORE_PLANNING: "STORE",
    SHORTAGE_PENDING: "PURCHASE",
    MATERIAL_RESERVED: "ROUTE",
    TRANSFER_IN_PROGRESS: "ROUTE",
    READY_TO_ISSUE: "ROUTE",
    PRODUCTION_ISSUE: "PRODUCTION",
    PRODUCTION_IN_PROGRESS: "PRODUCTION",
    PRODUCTION_COMPLETED: "COMPLETE",
};

const trackerStageIndex = (stage) => {
    if (normalize(stage) === "CANCELLED") return -1;
    const bucket = TRACKER_STAGE_BUCKET[normalize(stage)] || "DEMAND";
    return Math.max(0, TRACKER_FLOW.findIndex((item) => item.key === bucket));
};

const trackerHealth = (row) => {
    const currentStage = normalize(row?.currentStage);
    if (currentStage === "PRODUCTION_COMPLETED") return { label: "Completed", tone: "success" };
    if (currentStage === "CANCELLED") return { label: "Cancelled", tone: "muted" };

    const age = Math.max(0, Number(row?.ageHours || 0));
    if (age >= 72) return { label: "Ageing 72h+", tone: "danger" };
    if (age >= 24) return { label: "Ageing 24h+", tone: "warning" };
    return { label: "Fresh <24h", tone: "success" };
};

const healthSx = (tone) => ({
    px: 1.05,
    py: .4,
    borderRadius: 999,
    fontSize: 10.5,
    fontWeight: 900,
    letterSpacing: .25,
    border: tone === "danger"
        ? "1px solid var(--mf-danger-border)"
        : tone === "warning"
            ? "1px solid var(--mf-warning-border)"
            : tone === "muted"
                ? "1px solid var(--mf-border)"
                : "1px solid var(--mf-success-border)",
    color: tone === "danger"
        ? "var(--mf-danger-text)"
        : tone === "warning"
            ? "var(--mf-warning-text)"
            : tone === "muted"
                ? "var(--mf-text-muted)"
                : "var(--mf-success-text)",
    background: tone === "danger"
        ? "var(--mf-danger-soft)"
        : tone === "warning"
            ? "var(--mf-warning-soft)"
            : tone === "muted"
                ? "var(--mf-surface)"
                : "var(--mf-success-soft)",
});

const trackerNextAction = (row) => {
    switch (normalize(row?.currentStage)) {
        case "DRAFT": return "Complete and submit the Production material requisition.";
        case "AWAITING_STORE_PLANNING": return "Store must review availability and reserve verified stock.";
        case "SHORTAGE_PENDING": return "Close shortage procurement while available stock follows the Production decision.";
        case "MATERIAL_RESERVED": return "Dispatch reserved Store stock into the approved QC / Processing route.";
        case "TRANSFER_IN_PROGRESS": return "Execute the next route hand-off, receipt, QC or Processing action.";
        case "READY_TO_ISSUE": return "Route is complete. Store must explicitly issue material to Production.";
        case "PRODUCTION_ISSUE": return "Complete the Production hand-off and start execution.";
        case "PRODUCTION_IN_PROGRESS": return "Record consumption / returns and complete the finished product.";
        case "PRODUCTION_COMPLETED": return "Material execution is complete and fully traceable.";
        case "CANCELLED": return "This requisition is cancelled.";
        default: return "Open the workflow to inspect the current operational action.";
    }
};

const trackerActionTarget = (row) => {
    const id = row?.requisitionId || row?.id;
    switch (normalize(row?.currentStage)) {
        case "AWAITING_STORE_PLANNING":
        case "MATERIAL_RESERVED":
        case "SHORTAGE_PENDING":
        case "READY_TO_ISSUE":
            return { label: "Open Store Workbench", path: `/matflow/store/requisitions/${id}` };
        case "TRANSFER_IN_PROGRESS":
            return { label: "Open Transfer Desk", path: "/matflow/transfers" };
        case "PRODUCTION_ISSUE":
        case "PRODUCTION_IN_PROGRESS":
            return { label: "Open Production Execution", path: "/matflow/production-execution" };
        default:
            return { label: "Open Workflow", path: `/matflow/requisitions/${id}` };
    }
};

const trackerLaneState = (row, laneIndex) => {
    if (normalize(row?.currentStage) === "CANCELLED") return "SKIPPED";
    const currentIndex = trackerStageIndex(row?.currentStage);
    const hasShortagePath = Number(row?.shortageQty || 0) > 0 || Number(row?.openIndentCount || 0) > 0;

    if (laneIndex === 2 && !hasShortagePath) return "SKIPPED";
    if (laneIndex < currentIndex) return "DONE";
    if (laneIndex === currentIndex) return "CURRENT";
    return "NEXT";
};

const trackerLaneCount = (rows, key) => rows.filter((row) => {
    const stage = normalize(row?.currentStage);
    return stage !== "CANCELLED"
        && (TRACKER_STAGE_BUCKET[stage] || "DEMAND") === key;
}).length;

export function MatFlowDashboardPage() {
    const navigate = useNavigate();
    const { selectedPlantParam } = useMatFlow();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const load = useCallback(async () => { setLoading(true); setError(""); try { setData((await matflowApi.dashboardReport({ plantCode: selectedPlantParam }))?.data || null); } catch (e) { setError(readMatFlowError(e, "Unable to load MatFlow dashboard.")); } finally { setLoading(false); } }, [selectedPlantParam]);
    useEffect(() => { load(); }, [load]);
    const totals = data?.totals || {};
    const cards = [
        ["Active Projects", totals.activeProjects], ["Effective BOMs", totals.effectiveBoms], ["Open Requisitions", totals.openRequisitions], ["Shortage Requisitions", totals.shortageRequisitions], ["Ready Transfers", totals.readyOutboundTransfers], ["Pending QC", totals.pendingQcInspections], ["Processing Jobs", totals.activeProcessingJobs], ["Open Purchase Orders", totals.openPurchaseOrders]
    ];
    return <Box sx={pageSx}><PageHero badge="MATFLOW CONTROL CENTER" title="Material Planning & Execution" subtitle="Project → Engineering BOM → Production approval → requisition → Store → Purchase/QC → Processing → Production completion, with one stock ledger and audit trail." actions={<Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>} /><ErrorBox>{error}</ErrorBox>{loading ? <LoadingBlock /> : <><Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 1 }}>{cards.map(([label, value]) => <SummaryCard key={label} label={label} value={value ?? 0} colorful />)}</Box><Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 1 }}>{STAGES.map(([title, subtitle, path], index) => <Card key={title} sx={panelSx}><Typography sx={subTextSx}>STEP {index + 1}</Typography><Typography sx={{ fontSize: 17, fontWeight: 950, mt: .5 }}>{title}</Typography><Typography sx={{ ...subTextSx, minHeight: 32 }}>{subtitle}</Typography><Button fullWidth endIcon={<ArrowForwardIcon />} onClick={() => navigate(path)} sx={{ ...primaryBtnSx, mt: 1.5 }}>Open</Button></Card>)}</Box></>}</Box>;
}

export function MatFlowTrackerPage() {
    const navigate = useNavigate();
    const { selectedPlantParam } = useMatFlow();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [stage, setStage] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            setData((await matflowApi.getTracker({
                search: clean(search) || undefined,
                plantCode: selectedPlantParam,
                stage: stage || undefined,
            }))?.data || null);
        } catch (e) {
            setError(readMatFlowError(e, "Unable to load MatFlow tracker."));
        } finally {
            setLoading(false);
        }
    }, [search, stage, selectedPlantParam]);

    useEffect(() => { load(); }, [load]);

    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const k = data?.kpis || {};
    const stages = useMemo(() => ["", ...Array.from(new Set(rows.map((row) => row.currentStage).filter(Boolean))).sort()], [rows]);
    const pipeline = useMemo(() => TRACKER_FLOW.map((lane) => ({
        ...lane,
        count: trackerLaneCount(rows, lane.key),
    })), [rows]);

    return <Box sx={pageSx}>
        <PageHero
            badge="MATFLOW LIVE CONTROL TOWER"
            title="Project & Material Tracker"
            subtitle="A live project-material control board: current desk, route progress, shortage exposure, ageing, ownership and the next operational action are visible in one place."
            actions={<Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>}
        />
        <ErrorBox>{error}</ErrorBox>

        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 1 }}>
            <SummaryCard label="Active Requisitions" value={k.activeRequisitions ?? rows.length} />
            <SummaryCard label="Awaiting Store" value={k.awaitingStorePlanning ?? 0} />
            <SummaryCard label="Shortage Pending" value={k.shortagePending ?? 0} />
            <SummaryCard label="Material Reserved" value={k.materialReserved ?? 0} />
            <SummaryCard label="Transfers Running" value={k.transfersInProgress ?? 0} />
            <SummaryCard label="Production Running" value={k.productionInProgress ?? 0} />
            <SummaryCard label="Open Indents" value={k.openIndents ?? 0} />
        </Box>

        <Card sx={{ ...panelSx, p: 0, overflow: "hidden" }}>
            <Box sx={{ px: 1.8, pt: 1.6, pb: 1.2, borderBottom: "1px solid var(--mf-border)" }}>
                <Typography sx={{ fontSize: 17, fontWeight: 950 }}>Flow Pipeline</Typography>
                <Typography sx={subTextSx}>Where every active requisition currently sits in the material lifecycle.</Typography>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", md: "repeat(6,minmax(0,1fr))" } }}>
                {pipeline.map((lane, index) => <Box key={lane.key} sx={{ px: 1.5, py: 1.45, borderRight: { xs: "none", md: index < pipeline.length - 1 ? "1px solid var(--mf-border)" : "none" }, borderBottom: { xs: "1px solid var(--mf-border)", md: "none" } }}>
                    <Typography sx={{ ...subTextSx, fontSize: 10 }}>0{index + 1} · {lane.label.toUpperCase()}</Typography>
                    <Typography sx={{ fontSize: 24, fontWeight: 950, lineHeight: 1.15, mt: .35 }}>{lane.count}</Typography>
                    <Typography sx={{ ...subTextSx, mt: .2 }}>{lane.caption}</Typography>
                </Box>)}
            </Box>
        </Card>

        <Card sx={panelSx}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 230px" }, gap: 1 }}>
                <TextField label="Search Project / Drawing / Requisition / BOM" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} sx={fieldSx} />
                <TextField select label="Current Stage" value={stage} onChange={(e) => setStage(e.target.value)} sx={fieldSx}>
                    {stages.map((value) => <MenuItem key={value || "ALL"} value={value}>{value ? readable(value) : "All Stages"}</MenuItem>)}
                </TextField>
            </Box>
        </Card>

        {loading ? <LoadingBlock /> : rows.length === 0 ? <Card sx={panelSx}><EmptyState>No project-material workflows match the selected filters.</EmptyState></Card> : <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "repeat(2,minmax(0,1fr))" }, gap: 1.25 }}>
            {rows.map((row) => {
                const id = row.requisitionId || row.id;
                const health = trackerHealth(row);
                const action = trackerActionTarget(row);
                const progress = Math.max(0, Math.min(100, Number(row.progressPercent || 0)));

                return <Card key={id} sx={{ ...panelSx, p: 0, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 390 }}>
                    <Box sx={{ px: 1.7, py: 1.5, background: "linear-gradient(105deg,var(--mf-primary-soft),var(--mf-panel-solid) 56%,var(--mf-surface))", borderBottom: "1px solid var(--mf-border)" }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}>
                            <Box>
                                <Typography sx={{ ...subTextSx, fontSize: 10, letterSpacing: .55 }}>PROJECT / DRAWING</Typography>
                                <Typography sx={{ fontSize: 20, fontWeight: 950, lineHeight: 1.2 }}>{row.projectCode || "Unassigned Project"}</Typography>
                                <Typography sx={{ ...mainTextSx, mt: .25 }}>{row.drawingNo || "No Drawing"}</Typography>
                            </Box>
                            <Box sx={{ display: "flex", gap: .7, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                                <MatFlowStatusChip status={row.requisitionStatus} />
                                <Box sx={healthSx(health.tone)}>{health.label}</Box>
                            </Box>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap", mt: 1.15 }}>
                            <Box><Typography sx={subTextSx}>REQUISITION</Typography><Typography sx={mainTextSx}>{row.requisitionNumber || "-"}</Typography></Box>
                            <Box><Typography sx={subTextSx}>BOM</Typography><Typography sx={mainTextSx}>{row.bomNumber || "-"} · Rev {row.bomRevisionNo ?? "-"}</Typography></Box>
                            <Box><Typography sx={subTextSx}>DESTINATION</Typography><Typography sx={mainTextSx}>{row.destinationLocationCode || row.destinationLocationName || "-"}</Typography></Box>
                        </Box>
                    </Box>

                    <Box sx={{ px: 1.7, py: 1.45 }}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: .75, overflowX: "auto", pb: .35 }}>
                            {TRACKER_FLOW.map((lane, laneIndex) => {
                                const state = trackerLaneState(row, laneIndex);
                                return <Box key={lane.key} sx={{ minWidth: 78, flex: 1, position: "relative" }}>
                                    <Box sx={{ height: 5, borderRadius: 999, background: state === "DONE" ? "var(--mf-success-text)" : state === "CURRENT" ? "var(--mf-primary)" : state === "SKIPPED" ? "var(--mf-border)" : "var(--mf-border-strong)" }} />
                                    <Typography sx={{ fontSize: 10.5, fontWeight: state === "CURRENT" ? 950 : 800, mt: .6, color: state === "CURRENT" ? "var(--mf-primary-text)" : state === "DONE" ? "var(--mf-success-text)" : "var(--mf-text-secondary)" }}>{lane.label}</Typography>
                                    <Typography sx={{ ...subTextSx, fontSize: 9 }}>{state === "SKIPPED" ? "Not required" : state === "DONE" ? "Done" : state === "CURRENT" ? "Current" : "Next"}</Typography>
                                </Box>;
                            })}
                        </Box>

                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", sm: "repeat(5,minmax(0,1fr))" }, gap: .7, mt: 1.45 }}>
                            {[
                                ["Requested", row.requestedQty],
                                ["Reserved", row.reservedQty],
                                ["Shortage", row.shortageQty],
                                ["Issued", row.issuedQty],
                                ["Consumed", row.consumedQty],
                            ].map(([label, value]) => <Box key={label} sx={{ p: .9, border: "1px solid var(--mf-border)", borderRadius: 1.5, minWidth: 0 }}>
                                <Typography sx={{ ...subTextSx, fontSize: 9.5 }}>{label}</Typography>
                                <Typography sx={{ fontSize: 16, fontWeight: 950, mt: .2 }}>{formatQty(value)}</Typography>
                            </Box>)}
                        </Box>

                        <Box sx={{ mt: 1.4 }}>
                            <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center" }}>
                                <Box>
                                    <Typography sx={{ ...subTextSx, fontSize: 10 }}>CURRENT CONTROL POINT</Typography>
                                    <Typography sx={{ fontSize: 17, fontWeight: 950 }}>{readable(row.currentStage)}</Typography>
                                    <Typography sx={subTextSx}>Owner: {row.responsibleDesk || "MATFLOW CONTROL"}</Typography>
                                </Box>
                                <Typography sx={{ fontSize: 22, fontWeight: 950 }}>{progress}%</Typography>
                            </Box>
                            <LinearProgress variant="determinate" value={progress} sx={{ mt: .8, height: 7, borderRadius: 999 }} />
                        </Box>

                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(0,1fr) auto" }, gap: 1, mt: 1.35, alignItems: "center", p: 1.1, borderRadius: 1.5, border: "1px solid var(--mf-primary-border)", background: "var(--mf-primary-soft)" }}>
                            <Box>
                                <Typography sx={{ ...subTextSx, fontSize: 10 }}>NEXT OPERATIONAL ACTION</Typography>
                                <Typography sx={{ ...mainTextSx, mt: .25 }}>{trackerNextAction(row)}</Typography>
                            </Box>
                            <Button endIcon={<ArrowForwardIcon />} onClick={() => navigate(action.path)} sx={primaryBtnSx}>{action.label}</Button>
                        </Box>
                    </Box>

                    <Box sx={{ mt: "auto", px: 1.7, py: 1.1, borderTop: "1px solid var(--mf-border)", display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", sm: "repeat(4,minmax(0,1fr))" }, gap: .8 }}>
                        <Box><Typography sx={subTextSx}>Reservations</Typography><Typography sx={mainTextSx}>{row.reservationCount ?? 0}</Typography></Box>
                        <Box><Typography sx={subTextSx}>Open Indents</Typography><Typography sx={mainTextSx}>{row.openIndentCount ?? 0}</Typography></Box>
                        <Box><Typography sx={subTextSx}>Open Transfers</Typography><Typography sx={mainTextSx}>{row.openTransferCount ?? 0}</Typography></Box>
                        <Box><Typography sx={subTextSx}>Updated / Age</Typography><Typography sx={{ ...mainTextSx, fontSize: 11 }}>{formatDate(row.updatedAt)}</Typography><Typography sx={subTextSx}>{row.ageHours ?? 0} hr at current flow</Typography></Box>
                    </Box>
                </Card>;
            })}
        </Box>}
    </Box>;
}

export function MatFlowLedgerPage() {
    const { selectedPlantParam } = useMatFlow();
    const [rows, setRows] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
    const [search, setSearch] = useState(""), [movementType, setMovementType] = useState("");
    const load = useCallback(async () => { setLoading(true); setError(""); try { const r = await matflowApi.stockLedger({ plantCode: selectedPlantParam, movementType: movementType || undefined, search: clean(search) || undefined, page: 0, size: 100 }); setRows(extractMatFlowPage(r?.data).rows); } catch (e) { setError(readMatFlowError(e, "Unable to load stock ledger.")); } finally { setLoading(false); } }, [selectedPlantParam, movementType, search]);
    useEffect(() => { load(); }, [load]);
    return <Box sx={pageSx}><PageHero badge="IMMUTABLE STOCK LEDGER" title="Stock Ledger" subtitle="Quantity, reservation, blocked and in-transit deltas generated by MatFlow transactions." actions={<Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>} /><ErrorBox>{error}</ErrorBox><Card sx={panelSx}><Box sx={{ display: "grid", gridTemplateColumns: "1fr 230px", gap: 1 }}><TextField label="Search" value={search} onChange={e => setSearch(e.target.value)} sx={fieldSx} /><TextField label="Movement Type" value={movementType} onChange={e => setMovementType(normalize(e.target.value))} sx={fieldSx} /></Box></Card><Card sx={panelSx}>{loading ? <LoadingBlock /> : <Box sx={tableShellSx}><Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 160px 140px 100px 100px 100px 170px 150px" }}>{["Material", "Location", "Movement", "Qty Δ", "Reserved Δ", "Blocked Δ", "Reference", "Actor / Time"].map(h => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>{rows.length === 0 ? <EmptyState /> : rows.map((row, index) => <Box key={row.id || index} sx={{ ...tableRowSx, gridTemplateColumns: "170px 160px 140px 100px 100px 100px 170px 150px" }}><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialCode}</Typography><Typography sx={subTextSx}>{row.materialName}</Typography></Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.locationCode}</Typography><Typography sx={subTextSx}>{row.plantCode}</Typography></Box><Box sx={tableCellSx}>{readable(row.movementType)}</Box><Box sx={tableCellSx}>{formatQty(row.quantityChange)}</Box><Box sx={tableCellSx}>{formatQty(row.reservedChange)}</Box><Box sx={tableCellSx}>{formatQty(row.blockedChange)}</Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.referenceNumber || row.referenceType}</Typography><Typography sx={subTextSx}>{row.projectCode || "-"} · {row.drawingNo || "-"}</Typography></Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.actor || "-"}</Typography><Typography sx={subTextSx}>{formatDate(row.actionAt)}</Typography></Box></Box>)}</Box>}</Card></Box>;
}

export function MatFlowReportsPage() {
    const { selectedPlantParam } = useMatFlow();
    const [shortages, setShortages] = useState([]), [audits, setAudits] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
    const [minimumAgeDays, setMinimumAgeDays] = useState(0);
    const load = useCallback(async () => { setLoading(true); setError(""); try { const [s, a] = await Promise.all([matflowApi.shortageReport({ plantCode: selectedPlantParam, minimumAgeDays }), matflowApi.auditLogs({ plantCode: selectedPlantParam, page: 0, size: 100 })]); setShortages(Array.isArray(s?.data) ? s.data : []); setAudits(extractMatFlowPage(a?.data).rows); } catch (e) { setError(readMatFlowError(e, "Unable to load MatFlow reports.")); } finally { setLoading(false); } }, [selectedPlantParam, minimumAgeDays]);
    useEffect(() => { load(); }, [load]);
    return <Box sx={pageSx}><PageHero badge="MATFLOW REPORTING" title="Operational Reports" subtitle="Shortage ageing and centralized audit trail from the backend reporting authority." actions={<Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>} /><ErrorBox>{error}</ErrorBox><Card sx={panelSx}><TextField type="number" label="Minimum Shortage Age (days)" value={minimumAgeDays} onChange={e => setMinimumAgeDays(Math.max(0, Number(e.target.value || 0)))} sx={{ ...fieldSx, minWidth: 260 }} /></Card>{loading ? <LoadingBlock /> : <><Card sx={panelSx}><Typography sx={{ fontWeight: 950, mb: 1 }}>Shortage Ageing</Typography><Box sx={tableShellSx}><Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px 170px 180px 110px 110px 120px 100px" }}>{["Requisition", "Project / Drawing", "Material", "Requested", "Reserved", "Shortage", "Age"].map(h => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>{shortages.length === 0 ? <EmptyState>No shortages match the selected age.</EmptyState> : shortages.map((row, index) => <Box key={row.requisitionLineId || index} sx={{ ...tableRowSx, gridTemplateColumns: "170px 170px 180px 110px 110px 120px 100px" }}><Box sx={tableCellSx}>{row.requisitionNumber}</Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.projectCode}</Typography><Typography sx={subTextSx}>{row.drawingNo}</Typography></Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialCode}</Typography><Typography sx={subTextSx}>{row.materialName}</Typography></Box><Box sx={tableCellSx}>{formatQty(row.requestedQty)}</Box><Box sx={tableCellSx}>{formatQty(row.reservedQty)}</Box><Box sx={tableCellSx}>{formatQty(row.shortageQty)}</Box><Box sx={tableCellSx}>{row.ageDays}d</Box></Box>)}</Box></Card><Card sx={panelSx}><Typography sx={{ fontWeight: 950, mb: 1 }}>Audit Trail</Typography><Box sx={tableShellSx}><Box sx={{ ...tableHeaderSx, gridTemplateColumns: "150px 180px 170px 160px 150px 170px" }}>{["Entity", "Action", "Project / Drawing", "Plant", "Actor", "Time"].map(h => <Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>{audits.length === 0 ? <EmptyState /> : audits.map((row, index) => <Box key={row.id || index} sx={{ ...tableRowSx, gridTemplateColumns: "150px 180px 170px 160px 150px 170px" }}><Box sx={tableCellSx}>{row.entityType}</Box><Box sx={tableCellSx}>{readable(row.action)}</Box><Box sx={tableCellSx}>{row.projectCode || "-"} · {row.drawingNo || "-"}</Box><Box sx={tableCellSx}>{row.plantCode || "-"}</Box><Box sx={tableCellSx}>{row.actor || "-"}</Box><Box sx={tableCellSx}>{formatDate(row.actionAt)}</Box></Box>)}</Box></Card></>}</Box>;
}
