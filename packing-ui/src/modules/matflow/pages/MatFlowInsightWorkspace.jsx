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

export function MatFlowDashboardPage() {
  const navigate = useNavigate();
  const { selectedPlantParam } = useMatFlow();
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const load=useCallback(async()=>{setLoading(true);setError("");try{setData((await matflowApi.dashboardReport({plantCode:selectedPlantParam}))?.data||null);}catch(e){setError(readMatFlowError(e,"Unable to load MatFlow dashboard."));}finally{setLoading(false);}},[selectedPlantParam]);
  useEffect(()=>{load();},[load]);
  const totals=data?.totals||{};
  const cards=[
    ["Active Projects",totals.activeProjects],["Effective BOMs",totals.effectiveBoms],["Open Requisitions",totals.openRequisitions],["Shortage Requisitions",totals.shortageRequisitions],["Ready Transfers",totals.readyOutboundTransfers],["Pending QC",totals.pendingQcInspections],["Processing Jobs",totals.activeProcessingJobs],["Open Purchase Orders",totals.openPurchaseOrders]
  ];
  return <Box sx={pageSx}><PageHero badge="MATFLOW CONTROL CENTER" title="Material Planning & Execution" subtitle="Project → Engineering BOM → Production approval → requisition → Store → Purchase/QC → Processing → Production completion, with one stock ledger and audit trail." actions={<Button startIcon={<RefreshIcon/>} onClick={load} sx={secondaryBtnSx}>Refresh</Button>} /><ErrorBox>{error}</ErrorBox>{loading?<LoadingBlock/>:<><Box sx={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:1}}>{cards.map(([label,value])=><SummaryCard key={label} label={label} value={value??0}/>)}</Box><Box sx={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:1}}>{STAGES.map(([title,subtitle,path],index)=><Card key={title} sx={panelSx}><Typography sx={subTextSx}>STEP {index+1}</Typography><Typography sx={{fontSize:17,fontWeight:950,mt:.5}}>{title}</Typography><Typography sx={{...subTextSx,minHeight:32}}>{subtitle}</Typography><Button fullWidth endIcon={<ArrowForwardIcon/>} onClick={()=>navigate(path)} sx={{...primaryBtnSx,mt:1.5}}>Open</Button></Card>)}</Box></>}</Box>;
}

export function MatFlowTrackerPage() {
  const navigate=useNavigate();
  const {selectedPlantParam}=useMatFlow();
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [search,setSearch]=useState("");
  const [stage,setStage]=useState("");
  const load=useCallback(async()=>{setLoading(true);setError("");try{setData((await matflowApi.getTracker({search:clean(search)||undefined,plantCode:selectedPlantParam,stage:stage||undefined}))?.data||null);}catch(e){setError(readMatFlowError(e,"Unable to load MatFlow tracker."));}finally{setLoading(false);}},[search,stage,selectedPlantParam]);
  useEffect(()=>{load();},[load]);
  const rows=Array.isArray(data?.rows)?data.rows:[];
  const k=data?.kpis||{};
  const stages=useMemo(()=>["",...Array.from(new Set(rows.map(r=>r.currentStage).filter(Boolean))).sort()],[rows]);
  return <Box sx={pageSx}><PageHero badge="SERVER-SIDE CONTROL TOWER" title="Project & Material Tracker" subtitle="Workflow stage, ownership, ageing and material coverage are calculated by MatFlowInsightService—not re-derived in React." actions={<Button startIcon={<RefreshIcon/>} onClick={load} sx={secondaryBtnSx}>Refresh</Button>} /><ErrorBox>{error}</ErrorBox><Box sx={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:1}}><SummaryCard label="Active Requisitions" value={k.activeRequisitions??rows.length}/><SummaryCard label="Awaiting Store" value={k.awaitingStorePlanning??0}/><SummaryCard label="Shortage Pending" value={k.shortagePending??0}/><SummaryCard label="Material Reserved" value={k.materialReserved??0}/><SummaryCard label="Transfers in Progress" value={k.transfersInProgress??0}/><SummaryCard label="Production in Progress" value={k.productionInProgress??0}/><SummaryCard label="Open Indents" value={k.openIndents??0}/></Box><Card sx={panelSx}><Box sx={{display:"grid",gridTemplateColumns:"1fr 230px",gap:1}}><TextField label="Search" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load()} sx={fieldSx}/><TextField select label="Stage" value={stage} onChange={e=>setStage(e.target.value)} sx={fieldSx}>{stages.map(v=><MenuItem key={v||"ALL"} value={v}>{v?readable(v):"All Stages"}</MenuItem>)}</TextField></Box></Card><Card sx={panelSx}>{loading?<LoadingBlock/>:<Box sx={tableShellSx}><Box sx={{...tableHeaderSx,gridTemplateColumns:"170px 170px 150px 180px 160px 160px 100px"}}>{["Requisition","Project / Drawing","BOM","Stage / Desk","Material Coverage","Updated / Age","Action"].map(h=><Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>{rows.length===0?<EmptyState/>:rows.map(row=><Box key={row.requisitionId||row.id} sx={{...tableRowSx,gridTemplateColumns:"170px 170px 150px 180px 160px 160px 100px"}}><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.requisitionNumber||"-"}</Typography><MatFlowStatusChip status={row.requisitionStatus}/></Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.projectCode||"-"}</Typography><Typography sx={subTextSx}>{row.drawingNo||"-"}</Typography></Box><Box sx={tableCellSx}>{row.bomNumber||"-"} · Rev {row.bomRevisionNo??"-"}</Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{readable(row.currentStage)}</Typography><Typography sx={subTextSx}>{row.responsibleDesk||"-"}</Typography></Box><Box sx={tableCellSx}><Typography sx={subTextSx}>Req {formatQty(row.requestedQty)} · Res {formatQty(row.reservedQty)} · Short {formatQty(row.shortageQty)}</Typography><LinearProgress variant="determinate" value={Math.max(0,Math.min(100,Number(row.progressPercent||0)))} sx={{mt:.6,height:6,borderRadius:999}}/></Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{formatDate(row.updatedAt)}</Typography><Typography sx={subTextSx}>{row.ageHours??0} hr</Typography></Box><Box sx={tableCellSx}><Button onClick={()=>navigate(`/matflow/requisitions/${row.requisitionId||row.id}`)} sx={secondaryBtnSx}>Open</Button></Box></Box>)}</Box>}</Card></Box>;
}

export function MatFlowLedgerPage() {
  const {selectedPlantParam}=useMatFlow();
  const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [search,setSearch]=useState(""),[movementType,setMovementType]=useState("");
  const load=useCallback(async()=>{setLoading(true);setError("");try{const r=await matflowApi.stockLedger({plantCode:selectedPlantParam,movementType:movementType||undefined,search:clean(search)||undefined,page:0,size:100});setRows(extractMatFlowPage(r?.data).rows);}catch(e){setError(readMatFlowError(e,"Unable to load stock ledger."));}finally{setLoading(false);}},[selectedPlantParam,movementType,search]);
  useEffect(()=>{load();},[load]);
  return <Box sx={pageSx}><PageHero badge="IMMUTABLE STOCK LEDGER" title="Stock Ledger" subtitle="Quantity, reservation, blocked and in-transit deltas generated by MatFlow transactions." actions={<Button startIcon={<RefreshIcon/>} onClick={load} sx={secondaryBtnSx}>Refresh</Button>} /><ErrorBox>{error}</ErrorBox><Card sx={panelSx}><Box sx={{display:"grid",gridTemplateColumns:"1fr 230px",gap:1}}><TextField label="Search" value={search} onChange={e=>setSearch(e.target.value)} sx={fieldSx}/><TextField label="Movement Type" value={movementType} onChange={e=>setMovementType(normalize(e.target.value))} sx={fieldSx}/></Box></Card><Card sx={panelSx}>{loading?<LoadingBlock/>:<Box sx={tableShellSx}><Box sx={{...tableHeaderSx,gridTemplateColumns:"170px 160px 140px 100px 100px 100px 170px 150px"}}>{["Material","Location","Movement","Qty Δ","Reserved Δ","Blocked Δ","Reference","Actor / Time"].map(h=><Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>{rows.length===0?<EmptyState/>:rows.map((row,index)=><Box key={row.id||index} sx={{...tableRowSx,gridTemplateColumns:"170px 160px 140px 100px 100px 100px 170px 150px"}}><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialCode}</Typography><Typography sx={subTextSx}>{row.materialName}</Typography></Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.locationCode}</Typography><Typography sx={subTextSx}>{row.plantCode}</Typography></Box><Box sx={tableCellSx}>{readable(row.movementType)}</Box><Box sx={tableCellSx}>{formatQty(row.quantityChange)}</Box><Box sx={tableCellSx}>{formatQty(row.reservedChange)}</Box><Box sx={tableCellSx}>{formatQty(row.blockedChange)}</Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.referenceNumber||row.referenceType}</Typography><Typography sx={subTextSx}>{row.projectCode||"-"} · {row.drawingNo||"-"}</Typography></Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.actor||"-"}</Typography><Typography sx={subTextSx}>{formatDate(row.actionAt)}</Typography></Box></Box>)}</Box>}</Card></Box>;
}

export function MatFlowReportsPage() {
  const {selectedPlantParam}=useMatFlow();
  const [shortages,setShortages]=useState([]),[audits,setAudits]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [minimumAgeDays,setMinimumAgeDays]=useState(0);
  const load=useCallback(async()=>{setLoading(true);setError("");try{const[s,a]=await Promise.all([matflowApi.shortageReport({plantCode:selectedPlantParam,minimumAgeDays}),matflowApi.auditLogs({plantCode:selectedPlantParam,page:0,size:100})]);setShortages(Array.isArray(s?.data)?s.data:[]);setAudits(extractMatFlowPage(a?.data).rows);}catch(e){setError(readMatFlowError(e,"Unable to load MatFlow reports."));}finally{setLoading(false);}},[selectedPlantParam,minimumAgeDays]);
  useEffect(()=>{load();},[load]);
  return <Box sx={pageSx}><PageHero badge="MATFLOW REPORTING" title="Operational Reports" subtitle="Shortage ageing and centralized audit trail from the backend reporting authority." actions={<Button startIcon={<RefreshIcon/>} onClick={load} sx={secondaryBtnSx}>Refresh</Button>} /><ErrorBox>{error}</ErrorBox><Card sx={panelSx}><TextField type="number" label="Minimum Shortage Age (days)" value={minimumAgeDays} onChange={e=>setMinimumAgeDays(Math.max(0,Number(e.target.value||0)))} sx={{...fieldSx,minWidth:260}}/></Card>{loading?<LoadingBlock/>:<><Card sx={panelSx}><Typography sx={{fontWeight:950,mb:1}}>Shortage Ageing</Typography><Box sx={tableShellSx}><Box sx={{...tableHeaderSx,gridTemplateColumns:"170px 170px 180px 110px 110px 120px 100px"}}>{["Requisition","Project / Drawing","Material","Requested","Reserved","Shortage","Age"].map(h=><Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>{shortages.length===0?<EmptyState>No shortages match the selected age.</EmptyState>:shortages.map((row,index)=><Box key={row.requisitionLineId||index} sx={{...tableRowSx,gridTemplateColumns:"170px 170px 180px 110px 110px 120px 100px"}}><Box sx={tableCellSx}>{row.requisitionNumber}</Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.projectCode}</Typography><Typography sx={subTextSx}>{row.drawingNo}</Typography></Box><Box sx={tableCellSx}><Typography sx={mainTextSx}>{row.materialCode}</Typography><Typography sx={subTextSx}>{row.materialName}</Typography></Box><Box sx={tableCellSx}>{formatQty(row.requestedQty)}</Box><Box sx={tableCellSx}>{formatQty(row.reservedQty)}</Box><Box sx={tableCellSx}>{formatQty(row.shortageQty)}</Box><Box sx={tableCellSx}>{row.ageDays}d</Box></Box>)}</Box></Card><Card sx={panelSx}><Typography sx={{fontWeight:950,mb:1}}>Audit Trail</Typography><Box sx={tableShellSx}><Box sx={{...tableHeaderSx,gridTemplateColumns:"150px 180px 170px 160px 150px 170px"}}>{["Entity","Action","Project / Drawing","Plant","Actor","Time"].map(h=><Box key={h} sx={tableCellSx}>{h}</Box>)}</Box>{audits.length===0?<EmptyState/>:audits.map((row,index)=><Box key={row.id||index} sx={{...tableRowSx,gridTemplateColumns:"150px 180px 170px 160px 150px 170px"}}><Box sx={tableCellSx}>{row.entityType}</Box><Box sx={tableCellSx}>{readable(row.action)}</Box><Box sx={tableCellSx}>{row.projectCode||"-"} · {row.drawingNo||"-"}</Box><Box sx={tableCellSx}>{row.plantCode||"-"}</Box><Box sx={tableCellSx}>{row.actor||"-"}</Box><Box sx={tableCellSx}>{formatDate(row.actionAt)}</Box></Box>)}</Box></Card></>}</Box>;
}
