import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Box,
    Button,
    Card,
    Chip,
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
import ApprovalOutlinedIcon from "@mui/icons-material/ApprovalOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import UndoOutlinedIcon from "@mui/icons-material/UndoOutlined";
import { useNavigate, useParams } from "react-router-dom";
import { MATFLOW_ROLES, useMatFlow } from "../matflowUi";
import { extractMatFlowPage, matflowApi, readMatFlowError } from "../api/matflowApi";
import {
    Detail,
    EmptyState,
    ErrorBox,
    LoadingBlock,
    MatFlowStatusChip,
    PageHero,
    clean,
    dialogActionsSx,
    dialogContentSx,
    dialogPaperSx,
    dialogTitleSx,
    fieldSx,
    formatQty,
    mainTextSx,
    normalize,
    pageSx,
    panelSx,
    primaryBtnSx,
    readable,
    secondaryBtnSx,
    sectionSubSx,
    sectionTitleSx,
    subTextSx,
    tableCellSx,
    tableHeaderSx,
    tableRowSx,
    tableShellSx,
} from "../matflowUi";

const BOM_STATUSES = ["", "DRAFT", "SUBMITTED", "APPROVED", "RETURNED", "SUPERSEDED"];
const EDIT_ROLES = [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.ENGINEERING];
const REVIEW_ROLES = [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PRODUCTION];
const REQUISITION_ROLES = [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PRODUCTION];

const projectOf = (bom) => bom?.projectDrawing || bom?.project || bom?.projectContext || {};
const linesOf = (bom) => [bom?.lines, bom?.bomLines, bom?.items].find(Array.isArray) || [];

const workflowFor = (bom) => {
    const status = normalize(bom?.status);
    if (status === "DRAFT") return ["Engineering", "Add material lines/routes and submit directly to Production"];
    if (status === "RETURNED") return ["Engineering", "Correct the returned BOM and resubmit to Production"];
    if (status === "SUBMITTED") return ["Production", "Approve or return the submitted BOM"];
    if (status === "APPROVED") return ["Production / Store", bom?.effective ? "Raise material requisition against this effective BOM" : "Resolve effective revision"];
    if (status === "SUPERSEDED") return ["Engineering", "Use the current approved revision"];
    return ["MatFlow", "Review BOM status"];
};

export function MatFlowBomListPage({ submittedOnly = false }) {
    const navigate = useNavigate();
    const { role } = useMatFlow();
    const canCreate = EDIT_ROLES.includes(role);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState(submittedOnly ? "SUBMITTED" : "");

    const load = useCallback(async () => {
        setLoading(true); setError("");
        try {
            const response = await matflowApi.listBoms({
                search: clean(search) || undefined,
                status: submittedOnly ? "SUBMITTED" : status || undefined,
                latestOnly: status === "SUPERSEDED" ? false : true,
            });
            setRows(extractMatFlowPage(response?.data).rows);
        } catch (requestError) {
            setRows([]); setError(readMatFlowError(requestError, "Unable to load operational BOMs."));
        } finally { setLoading(false); }
    }, [search, status, submittedOnly]);

    useEffect(() => { load(); }, [load]);

    return (
        <Box sx={pageSx}>
            <PageHero
                badge={submittedOnly ? "PRODUCTION BOM REVIEW" : "OPERATIONAL BOM CONTROL"}
                title={submittedOnly ? "Submitted BOM Review" : "Operational BOMs"}
                subtitle={submittedOnly
                    ? "Production reviews Engineering-submitted BOMs directly before the revision becomes effective for material requisitions."
                    : "Engineering authors project-specific BOMs and routes; Production directly approves the submitted revision."}
                actions={!submittedOnly && canCreate ? <Button startIcon={<AddIcon />} onClick={() => navigate("/matflow/boms/new")} sx={primaryBtnSx}>Create BOM</Button> : null}
            />
            <Card sx={panelSx}>
                <Box sx={{ display: "grid", gridTemplateColumns: submittedOnly ? "1fr auto" : "1fr 220px auto", gap: 1, alignItems: "center" }}>
                    <TextField label="Search" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} sx={fieldSx} />
                    {!submittedOnly && <TextField select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={fieldSx}>{BOM_STATUSES.map((item) => <MenuItem key={item || "ALL"} value={item}>{item ? readable(item) : "All Statuses"}</MenuItem>)}</TextField>}
                    <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                </Box>
            </Card>
            <ErrorBox>{error}</ErrorBox>
            <Card sx={panelSx}>
                {loading ? <LoadingBlock /> : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "170px minmax(220px,1fr) 140px 120px 170px 200px 100px" }}>
                            {["BOM / Revision", "Project / Product", "Drawing", "Plant", "Status", "Responsible / Next", "Action"].map((h) => <Box key={h} sx={tableCellSx}>{h}</Box>)}
                        </Box>
                        {rows.length === 0 ? <EmptyState>No BOM records match the current view.</EmptyState> : rows.map((row) => {
                            const flow = workflowFor(row);
                            return (
                                <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "170px minmax(220px,1fr) 140px 120px 170px 200px 100px" }}>
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.bomNumber || "-"}</Typography><Typography sx={subTextSx}>Revision {row.revisionNo ?? "-"}{row.effective ? " · Effective" : ""}</Typography></Box>
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.projectCode || row.productName || "-"}</Typography><Typography sx={subTextSx}>{row.productName || row.clientName || "-"}</Typography></Box>
                                    <Box sx={tableCellSx}>{row.drawingNo || "-"}</Box>
                                    <Box sx={tableCellSx}>{row.plantCode || "-"}</Box>
                                    <Box sx={tableCellSx}><MatFlowStatusChip status={row.status} /></Box>
                                    <Box sx={tableCellSx}><Typography sx={mainTextSx}>{flow[0]}</Typography><Typography sx={subTextSx}>{flow[1]}</Typography></Box>
                                    <Box sx={tableCellSx}><Button onClick={() => navigate(`/matflow/boms/${row.id}`)} sx={secondaryBtnSx}>{normalize(row.status) === "SUBMITTED" ? "Review" : "Open"}</Button></Box>
                                </Box>
                            );
                        })}
                    </Box>
                )}
            </Card>
        </Box>
    );
}

export const MatFlowBomReviewPage = () => <MatFlowBomListPage submittedOnly />;

export function MatFlowBomCreatePage() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState({ projectDrawingId: "", remarks: "" });

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const response = await matflowApi.listProjects({ active: true });
                if (active) setProjects(extractMatFlowPage(response?.data).rows.filter((row) => row.active !== false));
            } catch (requestError) {
                if (active) setError(readMatFlowError(requestError, "Unable to load project drawings."));
            } finally { if (active) setLoading(false); }
        })();
        return () => { active = false; };
    }, []);

    const selected = projects.find((project) => String(project.id) === String(form.projectDrawingId));
    const save = async () => {
        if (!selected?.id) { setError("Select a valid project / drawing."); return; }
        setSaving(true); setError("");
        try {
            const response = await matflowApi.createBom({ projectDrawingId: selected.id, remarks: clean(form.remarks) || null });
            if (!response?.data?.id) throw new Error("Created BOM ID was not returned.");
            navigate(`/matflow/boms/${response.data.id}`, { replace: true });
        } catch (requestError) { setError(readMatFlowError(requestError, "Unable to create BOM draft.")); }
        finally { setSaving(false); }
    };

    if (loading) return <LoadingBlock />;
    return (
        <Box sx={pageSx}>
            <PageHero badge="NEW OPERATIONAL BOM" title="Create Operational BOM" subtitle="Create the first Draft revision for a project/product drawing." actions={<Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/matflow/boms")} sx={secondaryBtnSx}>Back</Button>} />
            <ErrorBox>{error}</ErrorBox>
            <Card sx={panelSx}>
                <Box sx={{ display: "grid", gridTemplateColumns: "minmax(280px,1fr) minmax(280px,1fr)", gap: 1.5 }}>
                    <TextField select label="Project / Drawing *" value={form.projectDrawingId} onChange={(e) => setForm((c) => ({ ...c, projectDrawingId: e.target.value }))} sx={fieldSx}>
                        {projects.map((project) => <MenuItem key={project.id} value={project.id}>{project.projectCode || "-"} · {project.drawingNo || "-"} · {project.productName || "-"}</MenuItem>)}
                    </TextField>
                    <TextField label="Remarks" value={form.remarks} onChange={(e) => setForm((c) => ({ ...c, remarks: e.target.value }))} sx={fieldSx} />
                </Box>
            </Card>
            {selected && <Card sx={panelSx}><Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 1 }}>
                <Detail label="Project" value={selected.projectCode} /><Detail label="Drawing" value={selected.drawingNo} /><Detail label="Product" value={selected.productName} /><Detail label="Client" value={selected.clientName} /><Detail label="Plant" value={selected.owningPlantCode || selected.plantCode} />
            </Box></Card>}
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}><Button startIcon={<SaveOutlinedIcon />} onClick={save} disabled={saving || !form.projectDrawingId} sx={primaryBtnSx}>{saving ? "Creating..." : "Create BOM Draft"}</Button></Box>
        </Box>
    );
}

export function MatFlowBomDetailPage() {
    const { bomId } = useParams();
    const navigate = useNavigate();
    const { role } = useMatFlow();
    const [bom, setBom] = useState(null);
    const [routes, setRoutes] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [action, setAction] = useState(null);
    const [remarks, setRemarks] = useState("");
    const [lineDialog, setLineDialog] = useState(null);
    const [lineForm, setLineForm] = useState({ materialId: "", requiredQty: "", wastagePercent: "0", remarks: "" });
    const [routeDialog, setRouteDialog] = useState(null);
    const [routeForm, setRouteForm] = useState({ sequenceNo: "1", stepType: "PROCESSING", locationId: "", processCode: "", expectedYieldPercent: "100", remarks: "" });

    const load = useCallback(async () => {
        if (!bomId) return;
        setLoading(true); setError("");
        try {
            const [bomResponse, routeResponse] = await Promise.all([matflowApi.getBom(bomId), matflowApi.listBomRoutes(bomId)]);
            setBom(bomResponse?.data || null);
            setRoutes(extractMatFlowPage(routeResponse?.data).rows);
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to load the operational BOM."));
        } finally { setLoading(false); }
    }, [bomId]);
    useEffect(() => { load(); }, [load]);

    const lines = useMemo(() => linesOf(bom), [bom]);
    const project = useMemo(() => projectOf(bom), [bom]);
    const status = normalize(bom?.status);
    const canEdit = EDIT_ROLES.includes(role) && bom?.latestRevision === true && ["DRAFT", "RETURNED"].includes(status);
    const canReview = REVIEW_ROLES.includes(role) && status === "SUBMITTED" && bom?.rowVersion != null;
    const canRevision = EDIT_ROLES.includes(role) && status === "APPROVED" && bom?.effective === true && bom?.latestRevision === true;
    const canRequisition = REQUISITION_ROLES.includes(role) && status === "APPROVED" && bom?.effective === true && bom?.latestRevision === true;
    const workflow = workflowFor(bom);

    useEffect(() => {
        if (!canEdit) return;
        let active = true;
        (async () => {
            try {
                const [m, l] = await Promise.all([matflowApi.listMaterials({ active: true }), matflowApi.listLocations({ active: true })]);
                if (active) {
                    setMaterials(extractMatFlowPage(m?.data).rows.filter((x) => x.active !== false));
                    setLocations(extractMatFlowPage(l?.data).rows.filter((x) => x.active !== false));
                }
            } catch { /* detail can still be read */ }
        })();
        return () => { active = false; };
    }, [canEdit]);

    const executeAction = async () => {
        if (!action || !bom?.id || bom.rowVersion == null) return;
        const cleaned = clean(remarks);
        if (action === "PRODUCTION_RETURN" && !cleaned) { setError("Return remarks are required."); return; }
        setWorking(true); setError("");
        const body = { rowVersion: bom.rowVersion, remarks: cleaned || null };
        try {
            let response;
            if (action === "SUBMIT") response = await matflowApi.submitBom(bom.id, body);
            if (action === "PRODUCTION_APPROVE") response = await matflowApi.productionApproveBom(bom.id, body);
            if (action === "PRODUCTION_RETURN") response = await matflowApi.productionReturnBom(bom.id, body);
            if (action === "REVISION") response = await matflowApi.createBomRevision(bom.id, body);
            setAction(null); setRemarks("");
            if (action === "REVISION" && response?.data?.id) navigate(`/matflow/boms/${response.data.id}`, { replace: true });
            else if (response?.data?.id) { setBom(response.data); await load(); }
            else await load();
        } catch (requestError) { setError(readMatFlowError(requestError, "Unable to complete the BOM action.")); }
        finally { setWorking(false); }
    };

    const saveLine = async () => {
        if (!bom?.id) return;
        const qty = Number(lineForm.requiredQty);
        const wastage = Number(lineForm.wastagePercent || 0);
        if (!lineForm.materialId || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(wastage) || wastage < 0) { setError("Material and a valid positive quantity are required."); return; }
        setWorking(true); setError("");
        try {
            const body = { materialId: lineForm.materialId, requiredQty: qty, wastagePercent: wastage, remarks: clean(lineForm.remarks) || null, rowVersion: lineDialog?.line?.rowVersion ?? null };
            if (lineDialog?.line?.id) await matflowApi.updateBomLine(bom.id, lineDialog.line.id, body);
            else await matflowApi.addBomLine(bom.id, body);
            setLineDialog(null); await load();
        } catch (requestError) { setError(readMatFlowError(requestError, "Unable to save BOM material line.")); }
        finally { setWorking(false); }
    };

    const removeLine = async (line) => {
        if (!window.confirm(`Remove ${line.materialCode || line.materialName || "this material"} from the BOM?`)) return;
        setWorking(true); setError("");
        try { await matflowApi.deleteBomLine(bom.id, line.id, line.rowVersion); await load(); }
        catch (requestError) { setError(readMatFlowError(requestError, "Unable to remove BOM line.")); }
        finally { setWorking(false); }
    };

    const openRoute = (line, step = null) => {
        setRouteDialog({ line, step });
        setRouteForm(step ? {
            sequenceNo: String(step.sequenceNo ?? 1), stepType: step.stepType || "PROCESSING", locationId: step.locationId || "",
            processCode: step.processCode || "", expectedYieldPercent: String(step.expectedYieldPercent ?? 100), remarks: step.remarks || "",
        } : { sequenceNo: String((routes.filter((item) => String(item.bomLineId) === String(line.id)).length + 1)), stepType: "PROCESSING", locationId: "", processCode: "", expectedYieldPercent: "100", remarks: "" });
    };

    const saveRoute = async () => {
        if (!routeDialog?.line?.id || !routeForm.locationId) { setError("Route location is required."); return; }
        const body = {
            sequenceNo: Number(routeForm.sequenceNo), stepType: routeForm.stepType, locationId: routeForm.locationId,
            processCode: routeForm.stepType === "PROCESSING" ? clean(routeForm.processCode) : null,
            expectedYieldPercent: Number(routeForm.expectedYieldPercent || 100), remarks: clean(routeForm.remarks) || null,
            rowVersion: routeDialog?.step?.rowVersion ?? null,
        };
        setWorking(true); setError("");
        try {
            if (routeDialog.step?.id) await matflowApi.updateBomRouteStep(bom.id, routeDialog.line.id, routeDialog.step.id, body);
            else await matflowApi.addBomRouteStep(bom.id, routeDialog.line.id, body);
            setRouteDialog(null); await load();
        } catch (requestError) { setError(readMatFlowError(requestError, "Unable to save route step.")); }
        finally { setWorking(false); }
    };

    const deleteRoute = async (line, step) => {
        if (!window.confirm("Delete this route step?")) return;
        try { await matflowApi.deleteBomRouteStep(bom.id, line.id, step.id, step.rowVersion); await load(); }
        catch (requestError) { setError(readMatFlowError(requestError, "Unable to delete route step.")); }
    };

    if (loading) return <LoadingBlock />;
    return (
        <Box sx={pageSx}>
            <PageHero badge="OPERATIONAL BOM" title={bom?.bomNumber || "BOM"} subtitle={`${project.projectCode || "-"} · ${project.drawingNo || "-"} · Revision ${bom?.revisionNo ?? "-"}`} actions={<><Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button><Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/matflow/boms")} sx={secondaryBtnSx}>Back</Button></>} />
            <ErrorBox>{error}</ErrorBox>
            {bom && <>
                <Card sx={panelSx}>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 1 }}>
                        <Detail label="Status" value={<MatFlowStatusChip status={bom.status} />} />
                        <Detail label="Effective" value={bom.effective ? "Yes" : "No"} />
                        <Detail label="Latest Revision" value={bom.latestRevision ? "Yes" : "No"} />
                        <Detail label="Project" value={project.projectCode} /><Detail label="Product" value={project.productName} /><Detail label="Drawing" value={project.drawingNo} /><Detail label="Plant" value={project.plantCode || project.owningPlantCode} />
                        <Detail label="Responsible Department" value={workflow[0]} /><Detail label="Next Action" value={workflow[1]} />
                    </Box>
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "flex-end", mt: 1.5 }}>
                        {canEdit && lines.length > 0 && <Button startIcon={<SendOutlinedIcon />} onClick={() => setAction("SUBMIT")} sx={primaryBtnSx}>Submit to Production</Button>}
                        {canReview && <Button startIcon={<ApprovalOutlinedIcon />} onClick={() => setAction("PRODUCTION_APPROVE")} sx={primaryBtnSx}>Production Approve</Button>}
                        {canReview && <Button startIcon={<UndoOutlinedIcon />} onClick={() => setAction("PRODUCTION_RETURN")} sx={secondaryBtnSx}>Return to Engineering</Button>}
                        {canRevision && <Button onClick={() => setAction("REVISION")} sx={secondaryBtnSx}>Create Revision</Button>}
                        {canRequisition && <Button onClick={() => navigate(`/matflow/requisitions/new?bomId=${bom.id}`)} sx={primaryBtnSx}>Raise Requisition</Button>}
                    </Box>
                </Card>

                <Card sx={panelSx}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center" }}>
                        <Box><Typography sx={sectionTitleSx}>Material Lines</Typography><Typography sx={sectionSubSx}>{lines.length} line(s)</Typography></Box>
                        {canEdit && <Button startIcon={<AddIcon />} onClick={() => { setLineDialog({ line: null }); setLineForm({ materialId: "", requiredQty: "", wastagePercent: "0", remarks: "" }); }} sx={primaryBtnSx}>Add Material</Button>}
                    </Box>
                    <Box sx={{ ...tableShellSx, mt: 1.5 }}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "65px 190px minmax(200px,1fr) 100px 110px 130px 170px" }}>
                            {["Line", "Material", "Specification", "Required", "Wastage %", "Net Required", "Actions"].map((h) => <Box key={h} sx={tableCellSx}>{h}</Box>)}
                        </Box>
                        {lines.length === 0 ? <EmptyState>Add at least one material line before submission.</EmptyState> : lines.map((line) => (
                            <Box key={line.id} sx={{ ...tableRowSx, gridTemplateColumns: "65px 190px minmax(200px,1fr) 100px 110px 130px 170px" }}>
                                <Box sx={tableCellSx}>{line.lineNo ?? "-"}</Box>
                                <Box sx={tableCellSx}><Typography sx={mainTextSx}>{line.materialCodeSnapshot || line.materialCode || "-"}</Typography><Typography sx={subTextSx}>{line.materialNameSnapshot || line.materialName || "-"}</Typography></Box>
                                <Box sx={tableCellSx}>{line.specificationSnapshot || line.specification || "-"}</Box>
                                <Box sx={tableCellSx}>{formatQty(line.requiredQty)} {line.uomSnapshot || line.uom || ""}</Box>
                                <Box sx={tableCellSx}>{formatQty(line.wastagePercent)}</Box>
                                <Box sx={tableCellSx}>{formatQty(line.netRequiredQty)}</Box>
                                <Box sx={{ ...tableCellSx, display: "flex", gap: .5 }}>
                                    {canEdit && <Button onClick={() => { setLineDialog({ line }); setLineForm({ materialId: line.materialId || line.material?.id || "", requiredQty: String(line.requiredQty ?? ""), wastagePercent: String(line.wastagePercent ?? 0), remarks: line.remarks || "" }); }} sx={secondaryBtnSx}><EditOutlinedIcon fontSize="small" /></Button>}
                                    {canEdit && <Button onClick={() => removeLine(line)} sx={secondaryBtnSx}><DeleteOutlineIcon fontSize="small" /></Button>}
                                    {canEdit && <Button onClick={() => openRoute(line)} sx={secondaryBtnSx}>Route</Button>}
                                </Box>
                            </Box>
                        ))}
                    </Box>
                </Card>

                <Card sx={panelSx}>
                    <Typography sx={sectionTitleSx}>Approved Material Route</Typography>
                    <Typography sx={sectionSubSx}>Configured route must end in one Production step when a route is used.</Typography>
                    <Box sx={{ ...tableShellSx, mt: 1.5 }}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "90px 80px 140px 180px 130px 110px 160px" }}>
                            {["BOM Line", "Sequence", "Step", "Location", "Process", "Yield %", "Action"].map((h) => <Box key={h} sx={tableCellSx}>{h}</Box>)}
                        </Box>
                        {routes.length === 0 ? <EmptyState>No explicit route configured. Add route steps from the material line actions.</EmptyState> : routes.map((step) => {
                            const line = lines.find((item) => String(item.id) === String(step.bomLineId));
                            return <Box key={step.id} sx={{ ...tableRowSx, gridTemplateColumns: "90px 80px 140px 180px 130px 110px 160px" }}>
                                <Box sx={tableCellSx}>{step.bomLineNo ?? line?.lineNo ?? "-"}</Box><Box sx={tableCellSx}>{step.sequenceNo}</Box><Box sx={tableCellSx}>{step.stepType}</Box><Box sx={tableCellSx}>{step.locationCode || step.locationName || "-"}</Box><Box sx={tableCellSx}>{step.processCode || "-"}</Box><Box sx={tableCellSx}>{step.expectedYieldPercent ?? 100}</Box>
                                <Box sx={{ ...tableCellSx, display: "flex", gap: .5 }}>{canEdit && line ? <><Button onClick={() => openRoute(line, step)} sx={secondaryBtnSx}>Edit</Button><Button onClick={() => deleteRoute(line, step)} sx={secondaryBtnSx}>Delete</Button></> : "-"}</Box>
                            </Box>;
                        })}
                    </Box>
                </Card>
            </>}

            <Dialog open={Boolean(action)} onClose={() => !working && setAction(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>{action === "SUBMIT" ? "Submit BOM to Production" : action === "PRODUCTION_APPROVE" ? "Approve BOM" : action === "PRODUCTION_RETURN" ? "Return BOM" : "Create BOM Revision"}</DialogTitle>
                <DialogContent sx={dialogContentSx}><TextField fullWidth multiline minRows={3} label={action === "PRODUCTION_RETURN" ? "Return Remarks *" : "Remarks"} value={remarks} onChange={(e) => setRemarks(e.target.value)} sx={fieldSx} /></DialogContent>
                <DialogActions sx={dialogActionsSx}><Button onClick={() => setAction(null)} sx={secondaryBtnSx}>Cancel</Button><Button onClick={executeAction} disabled={working} sx={primaryBtnSx}>{working ? "Working..." : "Confirm"}</Button></DialogActions>
            </Dialog>

            <Dialog open={Boolean(lineDialog)} onClose={() => !working && setLineDialog(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>{lineDialog?.line ? "Edit BOM Material" : "Add BOM Material"}</DialogTitle>
                <DialogContent sx={dialogContentSx}><Box sx={{ display: "grid", gap: 1.5 }}>
                    <TextField select label="Material *" value={lineForm.materialId} onChange={(e) => setLineForm((c) => ({ ...c, materialId: e.target.value }))} sx={fieldSx}>{materials.map((m) => <MenuItem key={m.id} value={m.id}>{m.materialCode} · {m.materialName} · {m.uom}</MenuItem>)}</TextField>
                    <TextField type="number" label="Required Quantity *" value={lineForm.requiredQty} onChange={(e) => setLineForm((c) => ({ ...c, requiredQty: e.target.value }))} sx={fieldSx} />
                    <TextField type="number" label="Wastage %" value={lineForm.wastagePercent} onChange={(e) => setLineForm((c) => ({ ...c, wastagePercent: e.target.value }))} sx={fieldSx} />
                    <TextField multiline minRows={2} label="Remarks" value={lineForm.remarks} onChange={(e) => setLineForm((c) => ({ ...c, remarks: e.target.value }))} sx={fieldSx} />
                </Box></DialogContent>
                <DialogActions sx={dialogActionsSx}><Button onClick={() => setLineDialog(null)} sx={secondaryBtnSx}>Cancel</Button><Button onClick={saveLine} disabled={working} sx={primaryBtnSx}>Save</Button></DialogActions>
            </Dialog>

            <Dialog open={Boolean(routeDialog)} onClose={() => !working && setRouteDialog(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>{routeDialog?.step ? "Edit Route Step" : "Add Route Step"}</DialogTitle>
                <DialogContent sx={dialogContentSx}><Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                    <TextField type="number" label="Sequence *" value={routeForm.sequenceNo} onChange={(e) => setRouteForm((c) => ({ ...c, sequenceNo: e.target.value }))} sx={fieldSx} />
                    <TextField select label="Step Type *" value={routeForm.stepType} onChange={(e) => setRouteForm((c) => ({ ...c, stepType: e.target.value }))} sx={fieldSx}>{["PROCESSING", "QC", "PRODUCTION"].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}</TextField>
                    <TextField select label="Location *" value={routeForm.locationId} onChange={(e) => setRouteForm((c) => ({ ...c, locationId: e.target.value }))} sx={{ ...fieldSx, gridColumn: "1 / -1" }}>{locations.filter((location) => routeForm.stepType === "PROCESSING" ? ["PROCESSING", "EXTERNAL_PROCESSOR"].includes(normalize(location.locationType)) : normalize(location.locationType) === routeForm.stepType).map((location) => <MenuItem key={location.id} value={location.id}>{location.locationCode} · {location.locationName} · {location.plantCode}</MenuItem>)}</TextField>
                    {routeForm.stepType === "PROCESSING" && <TextField label="Process Code *" value={routeForm.processCode} onChange={(e) => setRouteForm((c) => ({ ...c, processCode: e.target.value }))} sx={fieldSx} />}
                    <TextField type="number" label="Expected Yield %" value={routeForm.expectedYieldPercent} onChange={(e) => setRouteForm((c) => ({ ...c, expectedYieldPercent: e.target.value }))} sx={fieldSx} />
                    <TextField multiline minRows={2} label="Remarks" value={routeForm.remarks} onChange={(e) => setRouteForm((c) => ({ ...c, remarks: e.target.value }))} sx={{ ...fieldSx, gridColumn: "1 / -1" }} />
                </Box></DialogContent>
                <DialogActions sx={dialogActionsSx}><Button onClick={() => setRouteDialog(null)} sx={secondaryBtnSx}>Cancel</Button><Button onClick={saveRoute} disabled={working} sx={primaryBtnSx}>Save Route</Button></DialogActions>
            </Dialog>
        </Box>
    );
}
