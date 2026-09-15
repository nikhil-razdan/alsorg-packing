import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box, Button, Card, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, TextField, Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { matflowApi, readMatFlowError } from "../api/matflowApi";
import {
  ErrorBox, LoadingBlock, PageHero, EmptyState, MatFlowStatusChip, Detail,
  pageSx, panelSx, fieldSx, primaryBtnSx, secondaryBtnSx,
  dialogPaperSx, dialogTitleSx, dialogContentSx, dialogActionsSx,
  useMatFlow, readable,
} from "../matflowUi";

const projectBlank = { projectCode:"", projectName:"", clientName:"", plantCode:"", requiredDate:"", priority:"NORMAL", projectManager:"", remarks:"", active:true, rowVersion:null };
const productBlank = { productName:"", productType:"", drawingNo:"", drawingRevision:"", unitQuantity:1, dimensionLength:"", dimensionBreadth:"", dimensionHeight:"", requiredDate:"", remarks:"", active:true, rowVersion:null };
const nullableNumber = (value) => value === "" || value === null || value === undefined ? null : Number(value);
const cleanProjectBody = (v) => ({ ...v, requiredDate:v.requiredDate||null });
const cleanProductBody = (v) => ({ ...v, unitQuantity:Number(v.unitQuantity||1), dimensionLength:nullableNumber(v.dimensionLength), dimensionBreadth:nullableNumber(v.dimensionBreadth), dimensionHeight:nullableNumber(v.dimensionHeight), requiredDate:v.requiredDate||null });

function ProductFields({ value, onChange, compact=false }) {
  const set=(key,next)=>onChange({...value,[key]:next});
  return <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",md:"1fr 1fr"},gap:1.05}}>
    <TextField size={compact?"small":"medium"} label="Product Name" value={value.productName} onChange={e=>set("productName",e.target.value)} sx={fieldSx}/>
    <TextField size={compact?"small":"medium"} label="Product Type" value={value.productType||""} onChange={e=>set("productType",e.target.value)} sx={fieldSx}/>
    <TextField size={compact?"small":"medium"} label="Drawing No." value={value.drawingNo} onChange={e=>set("drawingNo",e.target.value)} sx={fieldSx}/>
    <TextField size={compact?"small":"medium"} label="Current Drawing Revision" value={value.drawingRevision||""} onChange={e=>set("drawingRevision",e.target.value)} sx={fieldSx}/>
    <TextField size={compact?"small":"medium"} type="number" inputProps={{min:1}} label="Units" value={value.unitQuantity} onChange={e=>set("unitQuantity",e.target.value)} sx={fieldSx}/>
    <TextField size={compact?"small":"medium"} type="date" InputLabelProps={{shrink:true}} label="Required Date" value={value.requiredDate||""} onChange={e=>set("requiredDate",e.target.value)} sx={fieldSx}/>
    <TextField size={compact?"small":"medium"} type="number" label="Length (mm)" value={value.dimensionLength??""} onChange={e=>set("dimensionLength",e.target.value)} sx={fieldSx}/>
    <TextField size={compact?"small":"medium"} type="number" label="Breadth (mm)" value={value.dimensionBreadth??""} onChange={e=>set("dimensionBreadth",e.target.value)} sx={fieldSx}/>
    <TextField size={compact?"small":"medium"} type="number" label="Height (mm)" value={value.dimensionHeight??""} onChange={e=>set("dimensionHeight",e.target.value)} sx={fieldSx}/>
    <TextField size={compact?"small":"medium"} label="Remarks" value={value.remarks||""} onChange={e=>set("remarks",e.target.value)} sx={fieldSx}/>
  </Box>;
}

export function MatFlowProjectsPage(){
  const { selectedPlantParam, availablePlants } = useMatFlow();
  const [rows,setRows]=useState([]), [loading,setLoading]=useState(true), [working,setWorking]=useState(false), [error,setError]=useState(""), [search,setSearch]=useState("");
  const [selected,setSelected]=useState(null), [dialog,setDialog]=useState("");
  const [projectForm,setProjectForm]=useState(projectBlank), [productForms,setProductForms]=useState([productBlank]), [editProduct,setEditProduct]=useState(null);

  const load=useCallback(async()=>{
    setLoading(true); setError("");
    try{const r=await matflowApi.listProjects({search,active:true,plantCode:selectedPlantParam});setRows(r?.data||[]);}
    catch(e){setError(readMatFlowError(e,"Unable to load MatFlow Projects."));}
    finally{setLoading(false);}
  },[search,selectedPlantParam]);
  useEffect(()=>{load();},[load]);
  const current=useMemo(()=>rows.find(x=>x.id===selected?.id)||selected,[rows,selected]);

  const refreshSelected=async(projectId)=>{const p=await matflowApi.getProject(projectId);setSelected(p.data);await load();};
  const run=async(fn)=>{setWorking(true);setError("");try{await fn();return true;}catch(e){setError(readMatFlowError(e));return false;}finally{setWorking(false);}};
  const openNewProject=()=>{setProjectForm({...projectBlank,plantCode:selectedPlantParam||availablePlants?.[0]||""});setDialog("project-new");};
  const openEditProject=()=>{if(!current)return;setProjectForm({projectCode:current.projectCode||"",projectName:current.projectName||"",clientName:current.clientName||"",plantCode:current.plantCode||"",requiredDate:current.requiredDate||"",priority:current.priority||"NORMAL",projectManager:current.projectManager||"",remarks:current.remarks||"",active:current.active!==false,rowVersion:current.rowVersion});setDialog("project-edit");};
  const saveProject=async()=>{const ok=await run(async()=>{if(dialog==="project-edit")await matflowApi.updateProject(current.id,cleanProjectBody(projectForm));else await matflowApi.createProject(cleanProjectBody(projectForm));});if(ok){setDialog("");await load();if(current?.id&&dialog==="project-edit")await refreshSelected(current.id);}};
  const openBulkProducts=()=>{setProductForms([{...productBlank,requiredDate:current?.requiredDate||""}]);setDialog("products-add");};
  const saveProducts=async()=>{if(!current)return;const valid=productForms.filter(p=>String(p.productName||"").trim()&&String(p.drawingNo||"").trim());if(!valid.length){setError("Add at least one Product Name and Drawing No.");return;}const ok=await run(()=>matflowApi.addProjectProducts(current.id,valid.map(cleanProductBody)));if(ok){setDialog("");await refreshSelected(current.id);}};
  const openProductEdit=(product)=>{setEditProduct({...product,requiredDate:product.requiredDate||"",remarks:product.remarks||""});setDialog("product-edit");};
  const saveProductEdit=async()=>{if(!current||!editProduct)return;const ok=await run(()=>matflowApi.updateProjectProduct(current.id,editProduct.id,cleanProductBody(editProduct)));if(ok){setDialog("");await refreshSelected(current.id);}};
  const uploadImage=async(product,file)=>{if(!file||!current)return;const ok=await run(()=>matflowApi.uploadProductImage(current.id,product.id,file));if(ok)await refreshSelected(current.id);};

  if(loading&&!rows.length)return <LoadingBlock/>;
  return <Box sx={pageSx}>
    <PageHero badge="MASTER PRODUCTION IDENTITY" title="Projects & Products" subtitle="PD No. / Project is the stable cross-module identity. Every Product/Drawing receives one MatFlow Production File and later links to PackFlow through the same PD No./Project." actions={<Box sx={{display:"flex",gap:1}}><Button startIcon={<RefreshOutlinedIcon/>} onClick={load} sx={secondaryBtnSx}>Refresh</Button><Button startIcon={<AddOutlinedIcon/>} onClick={openNewProject} sx={primaryBtnSx}>New Project</Button></Box>}/>
    {error&&<ErrorBox>{error}</ErrorBox>}
    <Card sx={{...panelSx,p:1.35}}><TextField size="small" fullWidth label="Search PD No., project, client or product" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load()} sx={fieldSx}/></Card>
    <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",xl:"minmax(340px,.78fr) minmax(0,1.55fr)"},gap:1.3}}>
      <Card sx={{...panelSx,p:0,overflow:"hidden"}}>
        {!rows.length?<EmptyState>No projects found.</EmptyState>:rows.map(row=><Box key={row.id} onClick={()=>setSelected(row)} sx={{p:1.4,borderBottom:"1px solid var(--mf-border)",cursor:"pointer",background:current?.id===row.id?"var(--mf-selected)":"transparent","&:hover":{background:"var(--mf-hover)"}}}>
          <Typography sx={{fontSize:12,fontWeight:950,color:"var(--mf-text)"}}>{row.projectCode}</Typography><Typography sx={{fontSize:11,fontWeight:800,color:"var(--mf-text-secondary)"}}>{row.projectName}</Typography><Typography sx={{mt:.3,fontSize:10,color:"var(--mf-text-muted)"}}>{row.clientName} · {row.plantCode} · {row.productCount||0} products</Typography>
        </Box>)}
      </Card>
      <Card sx={{...panelSx,p:1.8}}>
        {!current?<EmptyState>Select a project.</EmptyState>:<>
          <Box sx={{display:"flex",justifyContent:"space-between",gap:1,alignItems:"flex-start",flexWrap:"wrap"}}><Box><Typography sx={{fontSize:18,fontWeight:950,color:"var(--mf-text)"}}>{current.projectCode} · {current.projectName}</Typography><Typography sx={{fontSize:11,color:"var(--mf-text-muted)"}}>{current.clientName}</Typography></Box><Box sx={{display:"flex",gap:.7}}><Button startIcon={<EditOutlinedIcon/>} onClick={openEditProject} sx={secondaryBtnSx}>Edit Project</Button><Button startIcon={<AddOutlinedIcon/>} onClick={openBulkProducts} sx={primaryBtnSx}>Add Products</Button></Box></Box>
          <Box sx={{mt:1.4,display:"grid",gridTemplateColumns:{xs:"1fr 1fr",md:"repeat(4,1fr)"},gap:1}}><Detail label="Plant" value={current.plantCode}/><Detail label="Priority" value={current.priority}/><Detail label="Required" value={current.requiredDate||"—"}/><Detail label="Project Manager" value={current.projectManager||"—"}/></Box>
          <Typography sx={{mt:2,fontSize:13,fontWeight:950,color:"var(--mf-text)"}}>Products / Production Files</Typography>
          <Box sx={{mt:1,display:"grid",gap:1}}>{(current.products||[]).length===0?<EmptyState>No products added.</EmptyState>:(current.products||[]).map(p=><Box key={p.id} sx={{p:1.3,border:"1px solid var(--mf-border)",borderRadius:2,display:"grid",gridTemplateColumns:{xs:"1fr",lg:"1.45fr .95fr .8fr .6fr auto"},gap:1,alignItems:"center"}}>
            <Box><Typography sx={{fontSize:12,fontWeight:900,color:"var(--mf-text)"}}>{p.productName}</Typography><Typography sx={{fontSize:10,color:"var(--mf-text-muted)"}}>{p.drawingNo} · {p.dimensions||"Dimensions pending"} · Qty {p.unitQuantity||1}</Typography></Box>
            <Box><Typography sx={{fontSize:9,color:"var(--mf-text-muted)"}}>Production File</Typography><Typography sx={{fontSize:11,fontWeight:850,color:"var(--mf-text)"}}>{p.productionFileNo||"Migration pending"}</Typography></Box>
            <Typography sx={{fontSize:10.5,fontWeight:800,color:"var(--mf-text-secondary)"}}>{readable(p.stage||"NOT_STARTED")}</Typography><MatFlowStatusChip status={p.releaseHealth||"PENDING"}/>
            <Box sx={{display:"flex",gap:.5,flexWrap:"wrap",justifyContent:{lg:"flex-end"}}}><Button size="small" startIcon={<EditOutlinedIcon/>} onClick={()=>openProductEdit(p)} sx={secondaryBtnSx}>Edit</Button><Button size="small" component="label" startIcon={<ImageOutlinedIcon/>} sx={secondaryBtnSx}>{p.productImageAvailable?"Replace Image":"Attach Image"}<input hidden type="file" accept="image/*" onChange={e=>uploadImage(p,e.target.files?.[0])}/></Button></Box>
          </Box>)}</Box>
        </>}
      </Card>
    </Box>

    <Dialog open={dialog==="project-new"||dialog==="project-edit"} onClose={()=>!working&&setDialog("")} fullWidth maxWidth="md" PaperProps={{sx:dialogPaperSx}}><DialogTitle sx={dialogTitleSx}>{dialog==="project-edit"?"Edit Project / PD":"Create Project / PD"}<IconButton onClick={()=>setDialog("")} sx={{float:"right"}}><CloseOutlinedIcon/></IconButton></DialogTitle><DialogContent sx={dialogContentSx}><Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",md:"1fr 1fr"},gap:1.2,pt:.5}}>
      <TextField label="PD No. / Project Code" value={projectForm.projectCode} onChange={e=>setProjectForm({...projectForm,projectCode:e.target.value})} sx={fieldSx}/><TextField label="Project Name" value={projectForm.projectName} onChange={e=>setProjectForm({...projectForm,projectName:e.target.value})} sx={fieldSx}/><TextField label="Client Name" value={projectForm.clientName} onChange={e=>setProjectForm({...projectForm,clientName:e.target.value})} sx={fieldSx}/><TextField select label="Plant" value={projectForm.plantCode} onChange={e=>setProjectForm({...projectForm,plantCode:e.target.value})} sx={fieldSx}>{(availablePlants||[]).map(x=><MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField><TextField type="date" InputLabelProps={{shrink:true}} label="Required Date" value={projectForm.requiredDate||""} onChange={e=>setProjectForm({...projectForm,requiredDate:e.target.value})} sx={fieldSx}/><TextField label="Project Manager" value={projectForm.projectManager||""} onChange={e=>setProjectForm({...projectForm,projectManager:e.target.value})} sx={fieldSx}/><TextField label="Remarks" multiline minRows={2} value={projectForm.remarks||""} onChange={e=>setProjectForm({...projectForm,remarks:e.target.value})} sx={{...fieldSx,gridColumn:{md:"1/-1"}}}/>
    </Box></DialogContent><DialogActions sx={dialogActionsSx}><Button onClick={()=>setDialog("")} sx={secondaryBtnSx}>Cancel</Button><Button disabled={working} onClick={saveProject} sx={primaryBtnSx}>Save</Button></DialogActions></Dialog>

    <Dialog open={dialog==="products-add"} onClose={()=>!working&&setDialog("")} fullWidth maxWidth="lg" PaperProps={{sx:dialogPaperSx}}><DialogTitle sx={dialogTitleSx}>Add Multiple Products</DialogTitle><DialogContent sx={dialogContentSx}><Typography sx={{mb:1.2,fontSize:10.5,color:"var(--mf-text-muted)"}}>Each product creates its own Production File automatically. Drawing revisions themselves are managed immutably inside Production Control.</Typography><Box sx={{display:"grid",gap:1}}>{productForms.map((row,index)=><Card key={index} sx={{...panelSx,p:1.3}}><Box sx={{display:"flex",justifyContent:"space-between",alignItems:"center",mb:1}}><Typography sx={{fontSize:11,fontWeight:950,color:"var(--mf-text)"}}>Product {index+1}</Typography>{productForms.length>1&&<IconButton size="small" onClick={()=>setProductForms(v=>v.filter((_,i)=>i!==index))}><DeleteOutlineOutlinedIcon fontSize="small"/></IconButton>}</Box><ProductFields compact value={row} onChange={next=>setProductForms(v=>v.map((x,i)=>i===index?next:x))}/></Card>)}</Box><Button sx={{mt:1,...secondaryBtnSx}} startIcon={<AddOutlinedIcon/>} onClick={()=>setProductForms(v=>[...v,{...productBlank,requiredDate:current?.requiredDate||""}])}>Add another product</Button></DialogContent><DialogActions sx={dialogActionsSx}><Button onClick={()=>setDialog("")} sx={secondaryBtnSx}>Cancel</Button><Button disabled={working} onClick={saveProducts} sx={primaryBtnSx}>Create {productForms.length} Product{productForms.length===1?"":"s"}</Button></DialogActions></Dialog>

    <Dialog open={dialog==="product-edit"} onClose={()=>!working&&setDialog("")} fullWidth maxWidth="md" PaperProps={{sx:dialogPaperSx}}><DialogTitle sx={dialogTitleSx}>Edit Product</DialogTitle><DialogContent sx={dialogContentSx}>{editProduct&&<Box sx={{pt:.5}}><ProductFields value={editProduct} onChange={setEditProduct}/></Box>}</DialogContent><DialogActions sx={dialogActionsSx}><Button onClick={()=>setDialog("")} sx={secondaryBtnSx}>Cancel</Button><Button disabled={working} onClick={saveProductEdit} sx={primaryBtnSx}>Save Product</Button></DialogActions></Dialog>
  </Box>;
}
