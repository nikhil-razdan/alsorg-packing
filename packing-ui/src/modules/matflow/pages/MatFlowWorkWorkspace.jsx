import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, MenuItem, Tab, Tabs, TextField, Typography,
} from "@mui/material";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import LaunchOutlinedIcon from "@mui/icons-material/LaunchOutlined";
import { useSearchParams } from "react-router-dom";
import { matflowApi, readMatFlowError } from "../api/matflowApi";
import {
  ErrorBox, LoadingBlock, MATFLOW_ROLES, PageHero, SummaryCard, clean,
  dialogActionsSx, dialogContentSx, dialogPaperSx, dialogTitleSx, fieldSx,
  pageSx, panelSx, primaryBtnSx, readable, secondaryBtnSx, useMatFlow,
} from "../matflowUi";

const toDateTime = (value) => value ? new Date(value).toLocaleString() : "—";
const healthSx = (health) => ({
  height: 24, borderRadius: 1.2, fontWeight: 950, fontSize: 10,
  color: health === "RED" ? "var(--mf-danger-text)" : health === "AMBER" ? "var(--mf-warning-text)" : "var(--mf-success-text)",
  background: health === "RED" ? "var(--mf-danger-soft)" : health === "AMBER" ? "var(--mf-warning-soft)" : "var(--mf-success-soft)",
  border: "1px solid", borderColor: health === "RED" ? "var(--mf-danger-border)" : health === "AMBER" ? "var(--mf-warning-border)" : "var(--mf-success-border)",
});
const statusSx = { height: 23, borderRadius: 1.1, fontSize: 9.5, fontWeight: 900, color: "var(--mf-text-secondary)", border: "1px solid var(--mf-border)", background: "var(--mf-surface)" };

const EMPTY_SETUP = { designer: "", ppcOwner: "", engineeringHead: "", assignedEngineer: "", plannedProductionReleaseDate: "", plannedDispatchDate: "", remarks: "" };
const EMPTY_ACTION = { kind: "", title: "", decision: "", remarks: "", assignedTo: "", controlledReleaseReason: "", queryTitle: "", description: "", dueAt: "", priority: "NORMAL", response: "", note: "", taskKey: "", blocking: true, item: null, revision: null };

export function MatFlowWorkWorkspacePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedPlantParam, hasRole } = useMatFlow();
  const canDesigner = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.ENGINEERING);
  const canPpc = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER);
  const canEngineering = hasRole(MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.ENGINEERING);
  const [files, setFiles] = useState([]);
  const [detail, setDetail] = useState(null);
  const [selectedId, setSelectedId] = useState(searchParams.get("fileId") || "");
  const [search, setSearch] = useState("");
  const [health, setHealth] = useState("");
  const [stage, setStage] = useState("");
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);
  const [setup, setSetup] = useState(EMPTY_SETUP);
  const [action, setAction] = useState(EMPTY_ACTION);
  const [revisionType, setRevisionType] = useState("DESIGN_DRAWING");
  const [revisionNo, setRevisionNo] = useState("");
  const [revisionSummary, setRevisionSummary] = useState("");
  const [revisionFile, setRevisionFile] = useState(null);

  const loadList = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const response = await matflowApi.listProductionFiles({ plantCode: selectedPlantParam, search: clean(search) || undefined, health: health || undefined, stage: stage || undefined });
      const rows = Array.isArray(response?.data) ? response.data : [];
      setFiles(rows);
      if (!selectedId && rows.length) setSelectedId(rows[0].id);
    } catch (e) { if (!quiet) setError(readMatFlowError(e, "Unable to load Production Files.")); }
    finally { if (!quiet) setLoading(false); }
  }, [selectedPlantParam, search, health, stage, selectedId]);

  const loadDetail = useCallback(async (id, { quiet = false } = {}) => {
    if (!id) { setDetail(null); return; }
    try { const response = await matflowApi.getProductionFile(id); setDetail(response?.data || null); }
    catch (e) { if (!quiet) setError(readMatFlowError(e, "Unable to load Production File.")); }
  }, []);

  useEffect(() => { loadList(); }, [selectedPlantParam, health, stage]);
  useEffect(() => { if (selectedId) { setSearchParams({ fileId: selectedId }, { replace: true }); loadDetail(selectedId); } }, [selectedId, loadDetail, setSearchParams]);

  const refresh = async () => { await loadList({ quiet: true }); await loadDetail(selectedId, { quiet: true }); };
  const file = detail?.productionFile;

  const execute = async (fn, fallback) => {
    setWorking(true); setError("");
    try { const response = await fn(); if (response?.data?.productionFile) setDetail(response.data); await loadList({ quiet: true }); setAction(EMPTY_ACTION); return true; }
    catch (e) { setError(readMatFlowError(e, fallback)); return false; }
    finally { setWorking(false); }
  };

  const openSetup = () => {
    if (!file) return;
    setSetup({ designer: file.designer || "", ppcOwner: file.ppcOwner || "", engineeringHead: file.engineeringHead || "", assignedEngineer: file.assignedEngineer || "", plannedProductionReleaseDate: file.plannedProductionReleaseDate || "", plannedDispatchDate: file.plannedDispatchDate || "", remarks: "" });
    setSetupOpen(true);
  };

  const saveSetup = async () => {
    const ok = await execute(() => matflowApi.updateProductionFileSetup(file.id, { ...setup, rowVersion: file.rowVersion }), "Unable to update Production File setup.");
    if (ok) setSetupOpen(false);
  };

  const saveChecklist = (area, item, nextStatus, remarks = item.remarks || "") => execute(
    () => matflowApi.updateChecklist(file.id, area, item.key, { status: nextStatus, remarks, rowVersion: item.rowVersion }),
    "Unable to update checklist."
  );

  const submitAction = () => {
    if (!file) return;
    const a = action;
    if (a.kind === "DESIGN_SUBMIT") return execute(() => matflowApi.submitDesign(file.id, { controlledReleaseReason: a.controlledReleaseReason, rowVersion: file.rowVersion }), "Unable to submit Design.");
    if (a.kind === "PPC1") return execute(() => matflowApi.ppcGate1(file.id, { decision: a.decision, remarks: a.remarks, assignedTo: a.assignedTo, rowVersion: file.rowVersion }), "Unable to complete PPC Gate 1.");
    if (a.kind === "ENG_DECISION") return execute(() => matflowApi.engineeringDecision(file.id, { decision: a.decision, remarks: a.remarks, rowVersion: file.rowVersion }), "Unable to record Engineering decision.");
    if (a.kind === "QUERY_CREATE") return execute(() => matflowApi.createQuery(file.id, { title: a.queryTitle, description: a.description, assignedTo: a.assignedTo, dueAt: a.dueAt || null, priority: a.priority }), "Unable to create Engineering Query.");
    if (a.kind === "QUERY_RESPOND") return execute(() => matflowApi.respondQuery(file.id, a.item.id, { response: a.response, rowVersion: a.item.rowVersion }), "Unable to respond to query.");
    if (a.kind === "QUERY_CLOSE") return execute(() => matflowApi.closeQuery(file.id, a.item.id, { note: a.note, rowVersion: a.item.rowVersion }), "Unable to close query.");
    if (a.kind === "TASK_CREATE") return execute(() => matflowApi.createEngineeringTask(file.id, { taskKey: a.taskKey, title: a.queryTitle, assignedTo: a.assignedTo, dueAt: a.dueAt || null, priority: a.priority, blocking: a.blocking, description: a.description }), "Unable to create Engineering task.");
    if (a.kind === "TASK_STATUS") return execute(() => matflowApi.setEngineeringTaskStatus(file.id, a.item.id, { status: a.decision, note: a.note, rowVersion: a.item.rowVersion }), "Unable to update task.");
    if (a.kind === "REVISION_IMPACT") return execute(() => matflowApi.reviewRevisionImpact(file.id, a.revision.id, { decision: a.decision, impactNote: a.note, rowVersion: a.revision.rowVersion }), "Unable to review revision impact.");
    if (a.kind === "PPC2") return execute(() => matflowApi.ppcGate2(file.id, { decision: a.decision, remarks: a.remarks, rowVersion: file.rowVersion }), "Unable to complete PPC Gate 2.");
  };

  const uploadRevision = async () => {
    if (!revisionFile || !revisionNo) return setError("Revision number and file are required.");
    await execute(() => matflowApi.uploadRevision(file.id, { type: revisionType, revisionNo, changeSummary: revisionSummary, file: revisionFile }), "Unable to upload revision.");
    setRevisionNo(""); setRevisionSummary(""); setRevisionFile(null);
  };

  const openRevision = async (revision) => {
    try {
      const response = await matflowApi.revisionFile(file.id, revision.id);
      const blob = response?.data;
      const url = URL.createObjectURL(blob); window.open(url, "_blank", "noopener,noreferrer"); setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { setError(readMatFlowError(e, "Unable to open revision.")); }
  };

  if (loading) return <LoadingBlock />;

  return (
    <Box sx={pageSx}>
      <PageHero badge="CONTROL TOWER" title="Designer → PPC → Engineering" subtitle="One Production File, controlled gates, immutable revisions and permanent query/task history. Production execution after release is intentionally not implemented in this version." actions={<Button startIcon={<RefreshOutlinedIcon />} onClick={refresh} sx={secondaryBtnSx}>Refresh</Button>} />
      {error && <ErrorBox>{error}</ErrorBox>}

      <Card sx={{ ...panelSx, p: 1.35 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1.3fr auto" }, gap: 1 }}>
          <TextField size="small" label="Search PD / File / Product / Drawing" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadList()} sx={fieldSx} />
          <TextField select size="small" label="Health" value={health} onChange={(e) => setHealth(e.target.value)} sx={fieldSx}><MenuItem value="">All</MenuItem>{["GREEN","AMBER","RED"].map(x=><MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField>
          <TextField select size="small" label="Stage" value={stage} onChange={(e) => setStage(e.target.value)} sx={fieldSx}><MenuItem value="">All stages</MenuItem>{["DESIGN_DRAFT","DESIGN_CLARIFICATION","PPC_GATE_1","ENGINEERING_REVIEW","ENGINEERING_QUERY","ENGINEERING_WORK","REVISION_REVIEW","PPC_GATE_2","PRODUCTION_RELEASED"].map(x=><MenuItem key={x} value={x}>{readable(x)}</MenuItem>)}</TextField>
          <Button onClick={() => loadList()} sx={secondaryBtnSx}>Search</Button>
        </Box>
      </Card>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "360px minmax(0,1fr)" }, gap: 1.3, alignItems: "start" }}>
        <Card sx={{ ...panelSx, p: 0, maxHeight: { xl: "calc(100vh - 210px)" }, overflow: "auto" }}>
          {files.length === 0 ? <Box sx={{ p: 3, color: "var(--mf-text-muted)", textAlign: "center" }}>No Production Files found.</Box> : files.map((row) => (
            <Box key={row.id} onClick={() => setSelectedId(row.id)} sx={{ p: 1.35, borderBottom: "1px solid var(--mf-border)", cursor: "pointer", background: selectedId === row.id ? "var(--mf-primary-soft)" : "transparent", "&:hover": { background: "var(--mf-hover)" } }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center" }}><Typography sx={{ color: "var(--mf-text)", fontWeight: 950, fontSize: 12 }}>{row.productionFileNo}</Typography><Chip label={row.releaseHealth} sx={healthSx(row.releaseHealth)} /></Box>
              <Typography sx={{ mt: .45, color: "var(--mf-text-secondary)", fontSize: 11, fontWeight: 800 }}>{row.projectCode} · {row.productName}</Typography>
              <Typography sx={{ mt: .2, color: "var(--mf-text-muted)", fontSize: 10 }}>{row.drawingNo} · {readable(row.stage)}</Typography>
              {row.currentOwner && <Typography sx={{ mt: .4, color: "var(--mf-text-muted)", fontSize: 10 }}>Owner: {row.currentOwner}</Typography>}
            </Box>
          ))}
        </Card>

        {!detail ? <Card sx={{ ...panelSx, p: 4, textAlign: "center", color: "var(--mf-text-muted)" }}>Select a Production File.</Card> : (
          <Box sx={{ minWidth: 0 }}>
            <Card sx={{ ...panelSx, p: 1.7, mb: 1.2 }}>
              <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 1.2 }}>
                <Box><Typography sx={{ fontSize: 19, fontWeight: 950, color: "var(--mf-text)" }}>{file.productionFileNo}</Typography><Typography sx={{ mt: .2, color: "var(--mf-text-muted)", fontSize: 11 }}>{file.projectCode} · {file.projectName} · {file.productName} · {file.drawingNo}</Typography></Box>
                <Box sx={{ display: "flex", gap: .7, alignItems: "center" }}><Chip label={file.releaseHealth} sx={healthSx(file.releaseHealth)} /><Chip label={readable(file.stage)} sx={statusSx} />{canDesigner && <Button onClick={openSetup} sx={secondaryBtnSx}>Setup</Button>}</Box>
              </Box>
              <Box sx={{ mt: 1.4, display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5,1fr)" }, gap: .8 }}>
                <SummaryCard label="Design" value={`${file.designChecklistProgress?.percent || 0}%`} helper={`${file.designChecklistProgress?.pending || 0} pending`} />
                <SummaryCard label="Queries" value={file.openQueryCount || 0} tone={file.openQueryCount ? "danger" : "success"} />
                <SummaryCard label="Engineering" value={`${file.engineeringChecklistProgress?.percent || 0}%`} helper={readable(file.engineeringDecision)} />
                <SummaryCard label="Tasks" value={`${file.completedTaskCount || 0}/${(file.completedTaskCount || 0)+(file.pendingTaskCount || 0)}`} helper="Documentation" />
                <SummaryCard label="Gate 2" value={detail.ppcGate2Ready ? "READY" : "BLOCKED"} tone={detail.ppcGate2Ready ? "success" : "warning"} />
              </Box>
            </Card>

            <Card sx={{ ...panelSx, p: 0 }}>
              <Tabs value={tab} onChange={(_,v)=>setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: "1px solid var(--mf-border)", px: 1 }}>
                {["Overview","Design","Engineering","Queries","Tasks","Revisions","Timeline"].map(x=><Tab key={x} label={x} />)}
              </Tabs>
              <Box sx={{ p: 1.7 }}>
                {tab === 0 && <Overview file={file} detail={detail} canDesigner={canDesigner} canPpc={canPpc} canEngineering={canEngineering} setAction={setAction} />}
                {tab === 1 && <Checklist title="Designer Completeness Checklist" area="DESIGN" items={detail.designChecklist || []} progress={file.designChecklistProgress} canEdit={canDesigner && ["DESIGN_DRAFT","DESIGN_CLARIFICATION"].includes(file.stage)} onSave={saveChecklist} />}
                {tab === 2 && <Checklist title="Engineering Technical Checklist" area="ENGINEERING" items={detail.engineeringChecklist || []} progress={file.engineeringChecklistProgress} canEdit={canEngineering && ["ENGINEERING_REVIEW","ENGINEERING_QUERY"].includes(file.stage)} onSave={saveChecklist} />}
                {tab === 3 && <Queries items={detail.queries || []} canCreate={canEngineering} canRespond={canDesigner} canClose={canEngineering} setAction={setAction} />}
                {tab === 4 && <Tasks items={detail.engineeringTasks || []} canEdit={canEngineering} setAction={setAction} />}
                {tab === 5 && <Revisions file={file} rows={detail.revisions || []} canUpload={canDesigner} revisionType={revisionType} setRevisionType={setRevisionType} revisionNo={revisionNo} setRevisionNo={setRevisionNo} summary={revisionSummary} setSummary={setRevisionSummary} setFile={setRevisionFile} upload={uploadRevision} openRevision={openRevision} canReview={canEngineering} setAction={setAction} working={working} />}
                {tab === 6 && <Timeline rows={detail.timeline || []} />}
              </Box>
            </Card>
          </Box>
        )}
      </Box>

      <Dialog open={setupOpen} onClose={() => !working && setSetupOpen(false)} fullWidth maxWidth="md" PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle sx={dialogTitleSx}>Production File Responsibility & Dates</DialogTitle>
        <DialogContent sx={dialogContentSx}><Box sx={{ display:"grid",gridTemplateColumns:{xs:"1fr",md:"1fr 1fr"},gap:1.2,mt:.5 }}>
          {[ ["Designer","designer"],["PPC Owner","ppcOwner"],["Engineering Head","engineeringHead"],["Assigned Engineer","assignedEngineer"] ].map(([label,key])=><TextField key={key} label={label} value={setup[key]} onChange={e=>setSetup(v=>({...v,[key]:e.target.value}))} sx={fieldSx} />)}
          <TextField type="date" label="Planned Production Release" InputLabelProps={{shrink:true}} value={setup.plannedProductionReleaseDate} onChange={e=>setSetup(v=>({...v,plannedProductionReleaseDate:e.target.value}))} sx={fieldSx} />
          <TextField type="date" label="Planned Dispatch" InputLabelProps={{shrink:true}} value={setup.plannedDispatchDate} onChange={e=>setSetup(v=>({...v,plannedDispatchDate:e.target.value}))} sx={fieldSx} />
          <TextField label="Remarks" multiline minRows={2} value={setup.remarks} onChange={e=>setSetup(v=>({...v,remarks:e.target.value}))} sx={{...fieldSx,gridColumn:{md:"1 / -1"}}} />
        </Box></DialogContent>
        <DialogActions sx={dialogActionsSx}><Button onClick={()=>setSetupOpen(false)} sx={secondaryBtnSx}>Cancel</Button><Button disabled={working} onClick={saveSetup} sx={primaryBtnSx}>Save</Button></DialogActions>
      </Dialog>

      <ActionDialog action={action} setAction={setAction} working={working} submit={submitAction} />
    </Box>
  );
}

function Overview({ file, detail, canDesigner, canPpc, canEngineering, setAction }) {
  return <Box>
    <Box sx={{ display:"grid",gridTemplateColumns:{xs:"1fr",md:"repeat(4,1fr)"},gap:1 }}>
      {[ ["Current Department",file.currentDepartment],["Current Owner",file.currentOwner||"—"],["Designer",file.designer||"—"],["Engineer",file.assignedEngineer||"—"],["PPC Owner",file.ppcOwner||"—"],["Engineering Head",file.engineeringHead||"—"],["Planned Release",file.plannedProductionReleaseDate||"—"],["Planned Dispatch",file.plannedDispatchDate||"—"] ].map(([l,v])=><Box key={l} sx={{p:1.2,border:"1px solid var(--mf-border)",borderRadius:1.6,background:"var(--mf-surface)"}}><Typography sx={{fontSize:9.5,fontWeight:850,color:"var(--mf-text-muted)"}}>{l}</Typography><Typography sx={{mt:.35,fontSize:11.5,fontWeight:900,color:"var(--mf-text)"}}>{v}</Typography></Box>)}
    </Box>
    {file.controlledReleaseReason && <Alert severity="warning" sx={{mt:1.2}}>Controlled AMBER release: {file.controlledReleaseReason}</Alert>}
    {file.revisionReviewRequired && <Alert severity="error" sx={{mt:1.2}}>A revision impact review is required before this file can continue.</Alert>}
    {(detail.ppcGate2Blockers || []).length > 0 && <Alert severity="info" sx={{mt:1.2}}>PPC Gate 2 blockers: {(detail.ppcGate2Blockers || []).join(" · ")}</Alert>}
    <Divider sx={{my:1.6,borderColor:"var(--mf-border)"}} />
    <Typography sx={{fontSize:12,fontWeight:950,color:"var(--mf-text)"}}>Controlled actions</Typography>
    <Box sx={{mt:1,display:"flex",flexWrap:"wrap",gap:.8}}>
      {canDesigner && ["DESIGN_DRAFT","DESIGN_CLARIFICATION"].includes(file.stage) && <Button sx={primaryBtnSx} onClick={()=>setAction({...EMPTY_ACTION,kind:"DESIGN_SUBMIT",title:"Submit for PPC / Engineering"})}>Submit for Engineering</Button>}
      {canPpc && ["DESIGN_SUBMITTED","PPC_GATE_1"].includes(file.stage) && <><Button sx={primaryBtnSx} onClick={()=>setAction({...EMPTY_ACTION,kind:"PPC1",title:"PPC Gate 1 — Accept",decision:"ACCEPT"})}>PPC Gate 1: Accept</Button><Button sx={secondaryBtnSx} onClick={()=>setAction({...EMPTY_ACTION,kind:"PPC1",title:"PPC Gate 1 — Return",decision:"RETURN"})}>Return to Designer</Button></>}
      {canEngineering && ["ENGINEERING_REVIEW","ENGINEERING_QUERY"].includes(file.stage) && <><Button sx={primaryBtnSx} onClick={()=>setAction({...EMPTY_ACTION,kind:"ENG_DECISION",title:"Engineering Decision — Approve",decision:"APPROVED"})}>Engineering Approved</Button><Button sx={secondaryBtnSx} onClick={()=>setAction({...EMPTY_ACTION,kind:"QUERY_CREATE",title:"Raise Engineering Query"})}>Raise Query</Button></>}
      {canPpc && ["ENGINEERING_WORK","PPC_GATE_2"].includes(file.stage) && <><Button disabled={!detail.ppcGate2Ready} sx={primaryBtnSx} onClick={()=>setAction({...EMPTY_ACTION,kind:"PPC2",title:"PPC Gate 2 — Production Release",decision:"RELEASE"})}>Release to Production</Button><Button sx={secondaryBtnSx} onClick={()=>setAction({...EMPTY_ACTION,kind:"PPC2",title:"PPC Gate 2 — Return",decision:"RETURN"})}>Return to Engineering</Button></>}
      {file.stage === "PRODUCTION_RELEASED" && <Chip label="PRODUCTION RELEASED — downstream workflow pending validation" sx={{...statusSx,height:30,color:"var(--mf-success-text)",background:"var(--mf-success-soft)",borderColor:"var(--mf-success-border)"}} />}
    </Box>
  </Box>;
}

function Checklist({ title, area, items, progress, canEdit, onSave }) {
  return <Box><Box sx={{display:"flex",justifyContent:"space-between",gap:1,mb:1.1}}><Box><Typography sx={{fontWeight:950,color:"var(--mf-text)"}}>{title}</Typography><Typography sx={{fontSize:10.5,color:"var(--mf-text-muted)"}}>{progress?.complete || 0} complete · {progress?.pending || 0} pending · {progress?.criticalPending || 0} critical pending</Typography></Box><Chip label={`${progress?.percent || 0}%`} sx={statusSx} /></Box>
    <Box sx={{border:"1px solid var(--mf-border)",borderRadius:1.8,overflow:"hidden"}}>{items.map(item=><ChecklistRow key={item.id} item={item} area={area} canEdit={canEdit} onSave={onSave} />)}</Box></Box>;
}
function ChecklistRow({ item, area, canEdit, onSave }) {
  const [status,setStatus]=useState(item.status); const [remarks,setRemarks]=useState(item.remarks||"");
  useEffect(()=>{setStatus(item.status);setRemarks(item.remarks||"");},[item.status,item.remarks]);
  return <Box sx={{p:1.1,display:"grid",gridTemplateColumns:{xs:"1fr",md:"90px minmax(180px,1fr) 170px minmax(160px,.8fr) auto"},gap:.8,alignItems:"center",borderBottom:"1px solid var(--mf-border)","&:last-child":{borderBottom:0}}}>
    <Chip label={item.criticality} sx={{...statusSx,color:item.criticality==="CRITICAL"?"var(--mf-danger-text)":"var(--mf-text-secondary)"}} /><Box><Typography sx={{fontSize:11.5,fontWeight:900,color:"var(--mf-text)"}}>{item.title}</Typography><Typography sx={{fontSize:9.5,color:"var(--mf-text-muted)"}}>{item.section}</Typography></Box>
    <TextField select size="small" value={status} disabled={!canEdit} onChange={e=>setStatus(e.target.value)} sx={fieldSx}><MenuItem value="PENDING">Pending</MenuItem><MenuItem value="COMPLETE">Complete</MenuItem>{item.criticality!=="CRITICAL"&&<MenuItem value="NOT_APPLICABLE">Not Applicable</MenuItem>}</TextField>
    <TextField size="small" value={remarks} disabled={!canEdit} placeholder="Remarks" onChange={e=>setRemarks(e.target.value)} sx={fieldSx} />
    {canEdit&&<Button size="small" onClick={()=>onSave(area,item,status,remarks)} sx={secondaryBtnSx}>Save</Button>}
  </Box>;
}

function Queries({ items, canCreate, canRespond, canClose, setAction }) {
  return <Box><Box sx={{display:"flex",justifyContent:"space-between",alignItems:"center",mb:1}}><Typography sx={{fontWeight:950,color:"var(--mf-text)"}}>Engineering Queries</Typography>{canCreate&&<Button startIcon={<AddOutlinedIcon/>} sx={secondaryBtnSx} onClick={()=>setAction({...EMPTY_ACTION,kind:"QUERY_CREATE",title:"Raise Engineering Query"})}>New Query</Button>}</Box>
    {items.length===0?<Box sx={{p:3,textAlign:"center",color:"var(--mf-text-muted)"}}>No Engineering Queries.</Box>:items.map(item=><Card key={item.id} sx={{...panelSx,p:1.3,mb:.8}}><Box sx={{display:"flex",justifyContent:"space-between",gap:1}}><Box><Typography sx={{fontSize:12,fontWeight:950,color:"var(--mf-text)"}}>{item.title}</Typography><Typography sx={{mt:.25,fontSize:10,color:"var(--mf-text-muted)"}}>{item.description}</Typography></Box><Chip label={item.status} sx={statusSx}/></Box><Box sx={{mt:.8,display:"flex",flexWrap:"wrap",gap:1,fontSize:10,color:"var(--mf-text-muted)"}}><span>Assigned: {item.assignedTo||"—"}</span><span>Due: {toDateTime(item.dueAt)}</span><span>Priority: {item.priority}</span></Box>{item.responseText&&<Alert severity="info" sx={{mt:.8}}>Response: {item.responseText}</Alert>}<Box sx={{mt:.8,display:"flex",gap:.6}}>{canRespond&&item.status!=="CLOSED"&&<Button size="small" sx={secondaryBtnSx} onClick={()=>setAction({...EMPTY_ACTION,kind:"QUERY_RESPOND",title:"Respond to Query",item})}>Respond</Button>}{canClose&&item.status!=="CLOSED"&&<Button size="small" sx={secondaryBtnSx} onClick={()=>setAction({...EMPTY_ACTION,kind:"QUERY_CLOSE",title:"Close Query",item})}>Close</Button>}</Box></Card>)}</Box>;
}

function Tasks({ items, canEdit, setAction }) {
  return <Box><Box sx={{display:"flex",justifyContent:"space-between",mb:1}}><Typography sx={{fontWeight:950,color:"var(--mf-text)"}}>Engineering Documentation Tasks</Typography>{canEdit&&<Button startIcon={<AddOutlinedIcon/>} sx={secondaryBtnSx} onClick={()=>setAction({...EMPTY_ACTION,kind:"TASK_CREATE",title:"Add Engineering Task"})}>Add Task</Button>}</Box>
    <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",lg:"1fr 1fr"},gap:.8}}>{items.map(item=><Card key={item.id} sx={{...panelSx,p:1.2}}><Box sx={{display:"flex",justifyContent:"space-between",gap:1}}><Box><Typography sx={{fontSize:11.5,fontWeight:950,color:"var(--mf-text)"}}>{item.title}</Typography><Typography sx={{fontSize:9.5,color:"var(--mf-text-muted)"}}>{item.key} · {item.blocking?"Release blocking":"Non-blocking"}</Typography></Box><Chip label={readable(item.status)} sx={statusSx}/></Box><Typography sx={{mt:.7,fontSize:10,color:"var(--mf-text-muted)"}}>Owner: {item.assignedTo||"Unassigned"} · Due: {toDateTime(item.dueAt)}</Typography><Typography sx={{mt:.25,fontSize:9.5,color:"var(--mf-text-muted)"}}>Started: {toDateTime(item.startedAt)} · Revision: {item.revisionContext||"—"} · Completed: {toDateTime(item.completedAt)}</Typography>{canEdit&&<Box sx={{mt:.8,display:"flex",gap:.5,flexWrap:"wrap"}}>{["IN_PROGRESS","BLOCKED","COMPLETE","NOT_APPLICABLE"].map(status=><Button key={status} size="small" sx={secondaryBtnSx} onClick={()=>setAction({...EMPTY_ACTION,kind:"TASK_STATUS",title:`Set ${item.title}: ${readable(status)}`,decision:status,item})}>{readable(status)}</Button>)}</Box>}</Card>)}</Box>
  </Box>;
}

function Revisions({ file, rows, canUpload, revisionType, setRevisionType, revisionNo, setRevisionNo, summary, setSummary, setFile, upload, openRevision, canReview, setAction, working }) {
  return <Box><Typography sx={{fontWeight:950,color:"var(--mf-text)"}}>Immutable Drawing Revisions</Typography><Typography sx={{mt:.2,fontSize:10.5,color:"var(--mf-text-muted)"}}>Old drawings are never deleted. A post-handover Design revision triggers Engineering impact review and revalidation.</Typography>
    {canUpload&&<Card sx={{...panelSx,p:1.2,mt:1.1}}><Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",md:"180px 130px 1fr auto auto"},gap:.8,alignItems:"center"}}><TextField select size="small" label="Type" value={revisionType} onChange={e=>setRevisionType(e.target.value)} sx={fieldSx}><MenuItem value="DESIGN_DRAWING">Design Drawing</MenuItem><MenuItem value="ENGINEERING_DRAWING">Production / Engineering Drawing</MenuItem></TextField><TextField size="small" label="Revision" value={revisionNo} onChange={e=>setRevisionNo(e.target.value)} sx={fieldSx}/><TextField size="small" label="Change summary" value={summary} onChange={e=>setSummary(e.target.value)} sx={fieldSx}/><Button component="label" startIcon={<UploadFileOutlinedIcon/>} sx={secondaryBtnSx}>Choose<input hidden type="file" onChange={e=>setFile(e.target.files?.[0]||null)}/></Button><Button disabled={working} onClick={upload} sx={primaryBtnSx}>Upload</Button></Box></Card>}
    <Box sx={{mt:1}}>{rows.length===0?<Box sx={{p:3,textAlign:"center",color:"var(--mf-text-muted)"}}>No revisions uploaded.</Box>:rows.map(row=><Box key={row.id} sx={{p:1.1,display:"grid",gridTemplateColumns:{xs:"1fr",md:"120px 100px 1fr 160px auto"},gap:1,alignItems:"center",borderBottom:"1px solid var(--mf-border)"}}><Typography sx={{fontSize:11,fontWeight:900,color:"var(--mf-text)"}}>{readable(row.type)}</Typography><Typography sx={{fontSize:11,fontWeight:950,color:"var(--mf-text)"}}>Rev {row.revisionNo}</Typography><Typography sx={{fontSize:10,color:"var(--mf-text-muted)"}}>{row.changeSummary||row.originalFileName}</Typography><Chip label={readable(row.status)} sx={statusSx}/><Box sx={{display:"flex",gap:.5}}><Button size="small" startIcon={<LaunchOutlinedIcon/>} onClick={()=>openRevision(row)} sx={secondaryBtnSx}>Open</Button>{canReview&&row.status==="PENDING_IMPACT_REVIEW"&&<Button size="small" onClick={()=>setAction({...EMPTY_ACTION,kind:"REVISION_IMPACT",title:`Revision Impact — ${row.revisionNo}`,revision:row,decision:"ACCEPT"})} sx={primaryBtnSx}>Review</Button>}</Box></Box>)}</Box>
    {file.downstreamWorkflowStatus==="RELEASE_INVALIDATED_BY_REVISION"&&<Alert severity="error" sx={{mt:1}}>The previous Production Release is invalidated by an accepted revision. Engineering and PPC Gate 2 must run again.</Alert>}
  </Box>;
}

function Timeline({ rows }) {
  return <Box>{rows.length===0?<Box sx={{p:3,textAlign:"center",color:"var(--mf-text-muted)"}}>No audit events yet.</Box>:rows.map((row,index)=><Box key={`${row.entityId}-${index}`} sx={{display:"grid",gridTemplateColumns:"150px 170px 1fr",gap:1,p:1,borderBottom:"1px solid var(--mf-border)"}}><Typography sx={{fontSize:10,color:"var(--mf-text-muted)"}}>{toDateTime(row.at)}</Typography><Typography sx={{fontSize:10.5,fontWeight:900,color:"var(--mf-text)"}}>{readable(row.action)}</Typography><Typography sx={{fontSize:10,color:"var(--mf-text-secondary)"}}>{row.actor}</Typography></Box>)}</Box>;
}

function ActionDialog({ action, setAction, working, submit }) {
  const open=Boolean(action.kind); const close=()=>!working&&setAction(EMPTY_ACTION);
  const needsDecision=["PPC1","ENG_DECISION","TASK_STATUS","REVISION_IMPACT","PPC2"].includes(action.kind);
  return <Dialog open={open} onClose={close} fullWidth maxWidth="sm" PaperProps={{sx:dialogPaperSx}}><DialogTitle sx={dialogTitleSx}>{action.title||"MatFlow Action"}</DialogTitle><DialogContent sx={dialogContentSx}><Box sx={{display:"grid",gap:1.1,mt:.5}}>
    {action.kind==="DESIGN_SUBMIT"&&<TextField label="Controlled Release reason (mandatory for AMBER)" multiline minRows={3} value={action.controlledReleaseReason} onChange={e=>setAction(v=>({...v,controlledReleaseReason:e.target.value}))} sx={fieldSx}/>} 
    {action.kind==="PPC1"&&action.decision==="ACCEPT"&&<TextField label="Assign Engineer / username" value={action.assignedTo} onChange={e=>setAction(v=>({...v,assignedTo:e.target.value}))} sx={fieldSx}/>} 
    {["PPC1","ENG_DECISION","PPC2"].includes(action.kind)&&<TextField label="Remarks" multiline minRows={3} value={action.remarks} onChange={e=>setAction(v=>({...v,remarks:e.target.value}))} sx={fieldSx}/>} 
    {action.kind==="QUERY_CREATE"&&<><TextField label="Query title" value={action.queryTitle} onChange={e=>setAction(v=>({...v,queryTitle:e.target.value}))} sx={fieldSx}/><TextField label="Detail" multiline minRows={3} value={action.description} onChange={e=>setAction(v=>({...v,description:e.target.value}))} sx={fieldSx}/><TextField label="Assigned to / Designer username" value={action.assignedTo} onChange={e=>setAction(v=>({...v,assignedTo:e.target.value}))} sx={fieldSx}/><TextField type="datetime-local" label="Due" InputLabelProps={{shrink:true}} value={action.dueAt} onChange={e=>setAction(v=>({...v,dueAt:e.target.value}))} sx={fieldSx}/></>}
    {action.kind==="QUERY_RESPOND"&&<TextField label="Response" multiline minRows={4} value={action.response} onChange={e=>setAction(v=>({...v,response:e.target.value}))} sx={fieldSx}/>} 
    {action.kind==="QUERY_CLOSE"&&<TextField label="Closure note" multiline minRows={3} value={action.note} onChange={e=>setAction(v=>({...v,note:e.target.value}))} sx={fieldSx}/>} 
    {action.kind==="TASK_CREATE"&&<><TextField label="Task key" value={action.taskKey} onChange={e=>setAction(v=>({...v,taskKey:e.target.value}))} sx={fieldSx}/><TextField label="Task title" value={action.queryTitle} onChange={e=>setAction(v=>({...v,queryTitle:e.target.value}))} sx={fieldSx}/><TextField label="Assigned to" value={action.assignedTo} onChange={e=>setAction(v=>({...v,assignedTo:e.target.value}))} sx={fieldSx}/><TextField label="Description" multiline minRows={2} value={action.description} onChange={e=>setAction(v=>({...v,description:e.target.value}))} sx={fieldSx}/></>}
    {action.kind==="TASK_STATUS"&&<TextField label="Note / reason" multiline minRows={2} value={action.note} onChange={e=>setAction(v=>({...v,note:e.target.value}))} sx={fieldSx}/>} 
    {action.kind==="REVISION_IMPACT"&&<><TextField select label="Decision" value={action.decision} onChange={e=>setAction(v=>({...v,decision:e.target.value}))} sx={fieldSx}><MenuItem value="ACCEPT">Accept and revalidate</MenuItem><MenuItem value="REJECT">Reject revision</MenuItem></TextField><TextField label="Impact assessment / note" multiline minRows={4} value={action.note} onChange={e=>setAction(v=>({...v,note:e.target.value}))} sx={fieldSx}/></>}
    {needsDecision&&!["REVISION_IMPACT"].includes(action.kind)&&<Typography sx={{fontSize:10.5,color:"var(--mf-text-muted)"}}>Decision: <b>{readable(action.decision)}</b></Typography>}
  </Box></DialogContent><DialogActions sx={dialogActionsSx}><Button onClick={close} sx={secondaryBtnSx}>Cancel</Button><Button disabled={working} onClick={submit} sx={primaryBtnSx}>Confirm</Button></DialogActions></Dialog>;
}
