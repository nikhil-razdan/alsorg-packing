package com.alsorg.packing.service.matflow;

import static com.alsorg.packing.controller.dto.matflow.MatFlowBomDtos.*;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.domain.matflow.MatFlowBom;
import com.alsorg.packing.domain.matflow.MatFlowBomLine;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.BomStatus;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.EngineeringDecision;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.WorkItemStatus;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.WorkItemType;
import com.alsorg.packing.domain.matflow.MatFlowMaterial;
import com.alsorg.packing.domain.matflow.MatFlowProductionFile;
import com.alsorg.packing.domain.matflow.MatFlowWorkItem;
import com.alsorg.packing.repository.matflow.MatFlowBomLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowBomRepository;
import com.alsorg.packing.repository.matflow.MatFlowMaterialRepository;
import com.alsorg.packing.repository.matflow.MatFlowProductionFileRepository;
import com.alsorg.packing.repository.matflow.MatFlowWorkItemRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Engineering BOM/documentation service. Production routing is intentionally absent from V1. */
@Service
public class MatFlowBomService {
    private final MatFlowBomRepository bomRepository;
    private final MatFlowBomLineRepository lineRepository;
    private final MatFlowMaterialRepository materialRepository;
    private final MatFlowProductionFileRepository fileRepository;
    private final MatFlowWorkItemRepository workRepository;
    private final MatFlowAccessService accessService;
    private final MatFlowAuditService auditService;

    public MatFlowBomService(MatFlowBomRepository bomRepository, MatFlowBomLineRepository lineRepository,
            MatFlowMaterialRepository materialRepository, MatFlowProductionFileRepository fileRepository,
            MatFlowWorkItemRepository workRepository, MatFlowAccessService accessService, MatFlowAuditService auditService) {
        this.bomRepository=bomRepository; this.lineRepository=lineRepository; this.materialRepository=materialRepository;
        this.fileRepository=fileRepository; this.workRepository=workRepository; this.accessService=accessService; this.auditService=auditService;
    }

    @Transactional(readOnly = true)
    public List<BomResponse> list(String search, String status, UUID productionFileId) {
        accessService.requireRead(); String q=clean(search); q=q==null?"":q.toLowerCase(Locale.ROOT); final String term=q;
        BomStatus filter=status==null||status.isBlank()?null:parseStatus(status);
        return bomRepository.findAllByOrderByUpdatedAtDesc().stream()
                .filter(b->accessService.canAccessPlant(b.getProductionFile().getPlantCode()))
                .filter(b->productionFileId==null||productionFileId.equals(b.getProductionFile().getId()))
                .filter(b->filter==null||b.getStatus()==filter)
                .filter(b->term.isBlank()||contains(b.getBomNumber(),term)||contains(b.getProductionFile().getProjectCode(),term)||contains(b.getProductionFile().getProductName(),term)||contains(b.getProductionFile().getDrawingNo(),term))
                .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public BomResponse get(UUID id){ MatFlowBom b=requireBom(id); return toResponse(b); }

    @Transactional
    public BomResponse create(BomCreateRequest request){
        accessService.requireEngineeringWrite(); MatFlowProductionFile file=requireFile(request.productionFileId());
        if(file.getEngineeringDecision()!=EngineeringDecision.APPROVED) throw conflict("Engineering approval is required before BOM creation");
        MatFlowBom latest=bomRepository.findFirstByProductionFile_IdAndLatestRevisionTrue(file.getId()).orElse(null);
        if(latest!=null && latest.getStatus()!=BomStatus.SUPERSEDED) throw conflict("An active BOM already exists. Create a revision instead.");
        int revision=latest==null?1:latest.getRevisionNo()+1;
        MatFlowBom row=new MatFlowBom(); row.setProductionFile(file); row.setProjectDrawing(file.getProduct()); row.setRevisionNo(revision); row.setBomNumber(buildBomNo(file,revision)); row.setStatus(BomStatus.DRAFT); row.setLatestRevision(true); row.setRemarks(request.remarks()); row.setCreatedBy(accessService.actor()); row.setUpdatedBy(accessService.actor()); bomRepository.save(row);
        auditService.log("BOM",row.getId(),"BOM_CREATED",file,auditService.details("bomNumber",row.getBomNumber(),"revision",revision)); return toResponse(row);
    }

    @Transactional
    public BomResponse update(UUID id,BomUpdateRequest request){ accessService.requireEngineeringWrite(); MatFlowBom row=requireBom(id); requireEditable(row); requireVersion(row.getRowVersion(),request.rowVersion()); row.setRemarks(request.remarks()); row.setUpdatedBy(accessService.actor()); bomRepository.save(row); return toResponse(row); }

    @Transactional
    public BomResponse addLine(UUID bomId,BomLineRequest request){
        accessService.requireEngineeringWrite(); MatFlowBom bom=requireBom(bomId); requireEditable(bom); MatFlowBomLine line=new MatFlowBomLine(); line.setBom(bom); applyLine(line,request); line.setLineNo((int)lineRepository.countByBom_Id(bomId)+1); line.setCreatedBy(accessService.actor()); line.setUpdatedBy(accessService.actor()); lineRepository.save(line); auditService.log("BOM",bom.getId(),"BOM_LINE_ADDED",bom.getProductionFile(),auditService.details("materialCode",line.getMaterialCodeSnapshot(),"qty",line.getNetRequiredQty())); return toResponse(bom);
    }

    @Transactional
    public BomResponse updateLine(UUID bomId,UUID lineId,BomLineRequest request){ accessService.requireEngineeringWrite(); MatFlowBom bom=requireBom(bomId); requireEditable(bom); MatFlowBomLine line=requireLine(bomId,lineId); requireVersion(line.getRowVersion(),request.rowVersion()); applyLine(line,request); line.setUpdatedBy(accessService.actor()); lineRepository.save(line); return toResponse(bom); }

    @Transactional
    public BomResponse deleteLine(UUID bomId,UUID lineId,Long rowVersion){ accessService.requireEngineeringWrite(); MatFlowBom bom=requireBom(bomId); requireEditable(bom); MatFlowBomLine line=requireLine(bomId,lineId); requireVersion(line.getRowVersion(),rowVersion); lineRepository.delete(line); renumber(bomId); return toResponse(bom); }

    @Transactional
    public void deleteDraft(UUID id,Long rowVersion){ accessService.requireEngineeringWrite(); MatFlowBom bom=requireBom(id); requireVersion(bom.getRowVersion(),rowVersion); if(bom.getStatus()!=BomStatus.DRAFT)throw conflict("Only Draft BOM can be deleted"); lineRepository.deleteByBom_Id(id); bomRepository.delete(bom); }

    @Transactional
    public BomResponse submit(UUID id,BomActionRequest request){
        accessService.requireEngineeringWrite(); MatFlowBom bom=requireBom(id); requireVersion(bom.getRowVersion(),request.rowVersion()); requireEditable(bom);
        if(lineRepository.countByBom_Id(id)==0)throw conflict("Add at least one BOM line before submission");
        bom.setStatus(BomStatus.READY_FOR_RELEASE); bom.setSubmittedBy(accessService.actor()); bom.setSubmittedAt(now()); if(request.remarks()!=null)bom.setRemarks(request.remarks()); bom.setUpdatedBy(accessService.actor()); bomRepository.save(bom);
        workRepository.findByProductionFile_IdAndItemTypeAndItemKeyIgnoreCase(bom.getProductionFile().getId(),WorkItemType.ENGINEERING_TASK,"BOM").ifPresent(task->{ task.setStatus(WorkItemStatus.COMPLETE); task.setCompletedBy(accessService.actor()); task.setCompletedAt(now()); task.setCompletionNote("BOM "+bom.getBomNumber()+" submitted Ready for Release"); task.setUpdatedBy(accessService.actor()); workRepository.save(task); });
        auditService.log("BOM",bom.getId(),"BOM_READY_FOR_RELEASE",bom.getProductionFile(),auditService.details("bomNumber",bom.getBomNumber(),"revision",bom.getRevisionNo())); return toResponse(bom);
    }

    @Transactional
    public BomResponse createRevision(UUID id,BomActionRequest request){
        accessService.requireEngineeringWrite(); MatFlowBom source=requireBom(id); requireVersion(source.getRowVersion(),request.rowVersion());
        source.setLatestRevision(false); source.setStatus(BomStatus.SUPERSEDED); source.setUpdatedBy(accessService.actor()); bomRepository.save(source);
        MatFlowBom next=new MatFlowBom(); next.setProductionFile(source.getProductionFile()); next.setProjectDrawing(source.getProjectDrawing()); next.setRevisionNo(source.getRevisionNo()+1); next.setBomNumber(buildBomNo(source.getProductionFile(),next.getRevisionNo())); next.setStatus(BomStatus.DRAFT); next.setLatestRevision(true); next.setRemarks(request.remarks()); next.setCreatedBy(accessService.actor()); next.setUpdatedBy(accessService.actor()); bomRepository.save(next);
        int no=0; for(MatFlowBomLine old:lineRepository.findByBom_IdOrderByLineNoAsc(source.getId())){ MatFlowBomLine copy=new MatFlowBomLine(); copy.setBom(next); copy.setLineNo(++no); copy.setMaterial(old.getMaterial()); copy.setMaterialCodeSnapshot(old.getMaterialCodeSnapshot()); copy.setMaterialNameSnapshot(old.getMaterialNameSnapshot()); copy.setMaterialCategorySnapshot(old.getMaterialCategorySnapshot()); copy.setSpecificationSnapshot(old.getSpecificationSnapshot()); copy.setUomSnapshot(old.getUomSnapshot()); copy.setRequiredQty(old.getRequiredQty()); copy.setWastagePercent(old.getWastagePercent()); copy.setNetRequiredQty(old.getNetRequiredQty()); copy.setRemarks(old.getRemarks()); copy.setCreatedBy(accessService.actor()); copy.setUpdatedBy(accessService.actor()); lineRepository.save(copy); }
        workRepository.findByProductionFile_IdAndItemTypeAndItemKeyIgnoreCase(source.getProductionFile().getId(),WorkItemType.ENGINEERING_TASK,"BOM").ifPresent(task->{task.setStatus(WorkItemStatus.IN_PROGRESS);task.setCompletedAt(null);task.setCompletedBy(null);task.setUpdatedBy(accessService.actor());workRepository.save(task);});
        auditService.log("BOM",next.getId(),"BOM_REVISION_CREATED",source.getProductionFile(),auditService.details("fromRevision",source.getRevisionNo(),"toRevision",next.getRevisionNo())); return toResponse(next);
    }

    private void applyLine(MatFlowBomLine line,BomLineRequest request){
        MatFlowMaterial material=request.materialId()==null?null:materialRepository.findById(request.materialId()).orElseThrow(()->notFound("Material not found"));
        line.setMaterial(material); line.setMaterialCodeSnapshot(request.materialCode()); line.setMaterialNameSnapshot(request.materialName()); line.setMaterialCategorySnapshot(request.category()); line.setSpecificationSnapshot(request.specification()); line.setUomSnapshot(request.uom()); line.setRequiredQty(request.requiredQty()); BigDecimal wastage=request.wastagePercent()==null?BigDecimal.ZERO:request.wastagePercent(); line.setWastagePercent(wastage);
        BigDecimal multiplier=BigDecimal.ONE.add(wastage.divide(BigDecimal.valueOf(100),6,RoundingMode.HALF_UP)); line.setNetRequiredQty(request.requiredQty().multiply(multiplier).setScale(3,RoundingMode.HALF_UP)); line.setRemarks(request.remarks());
    }

    private BomResponse toResponse(MatFlowBom bom){ List<BomLineResponse> lines=lineRepository.findByBom_IdOrderByLineNoAsc(bom.getId()).stream().map(this::toLine).toList(); MatFlowProductionFile f=bom.getProductionFile(); return new BomResponse(bom.getId(),bom.getBomNumber(),f.getId(),f.getProductionFileNo(),f.getProjectCode(),f.getProductName(),f.getDrawingNo(),bom.getRevisionNo(),bom.getStatus().name(),bom.isLatestRevision(),bom.getRemarks(),bom.getSubmittedBy(),bom.getSubmittedAt(),bom.getReleasedBy(),bom.getReleasedAt(),bom.getRowVersion(),bom.getUpdatedAt(),lines); }
    private BomLineResponse toLine(MatFlowBomLine x){ return new BomLineResponse(x.getId(),x.getLineNo(),x.getMaterial()==null?null:x.getMaterial().getId(),x.getMaterialCodeSnapshot(),x.getMaterialNameSnapshot(),x.getMaterialCategorySnapshot(),x.getSpecificationSnapshot(),x.getUomSnapshot(),x.getRequiredQty(),x.getWastagePercent(),x.getNetRequiredQty(),x.getRemarks(),x.getRowVersion()); }
    private void renumber(UUID bomId){ int no=0; for(MatFlowBomLine x:lineRepository.findByBom_IdOrderByLineNoAsc(bomId)){x.setLineNo(++no);x.setUpdatedBy(accessService.actor());lineRepository.save(x);} }
    private MatFlowBom requireBom(UUID id){ MatFlowBom b=bomRepository.findById(id).orElseThrow(()->notFound("BOM not found")); accessService.requirePlantAccess(b.getProductionFile().getPlantCode()); return b; }
    private MatFlowProductionFile requireFile(UUID id){ MatFlowProductionFile f=fileRepository.findById(id).orElseThrow(()->notFound("Production File not found")); accessService.requirePlantAccess(f.getPlantCode()); return f; }
    private MatFlowBomLine requireLine(UUID bomId,UUID id){ MatFlowBomLine x=lineRepository.findById(id).orElseThrow(()->notFound("BOM line not found")); if(!bomId.equals(x.getBom().getId()))throw notFound("BOM line not found"); return x; }
    private void requireEditable(MatFlowBom b){ if(b.getStatus()!=BomStatus.DRAFT)throw conflict("Only Draft BOM can be edited"); }
    private String buildBomNo(MatFlowProductionFile f,int revision){ return ("BOM-"+f.getProductionFileNo()+"-R"+String.format("%02d",revision)).replaceAll("[^A-Z0-9._-]+","-"); }
    private BomStatus parseStatus(String value){ try{return BomStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));}catch(Exception ex){throw badRequest("Invalid BOM status: "+value);} }
    private void requireVersion(Long actual,Long supplied){ if(supplied==null||!supplied.equals(actual))throw conflict("Record changed. Refresh and retry."); }
    private String clean(String v){if(v==null)return null;String x=v.trim();return x.isBlank()?null:x;}
    private boolean contains(String v,String q){return v!=null&&v.toLowerCase(Locale.ROOT).contains(q);}
    private LocalDateTime now(){return LocalDateTime.now(TimeZoneConfig.APP_ZONE);}
    private ResponseStatusException notFound(String m){return new ResponseStatusException(HttpStatus.NOT_FOUND,m);} private ResponseStatusException conflict(String m){return new ResponseStatusException(HttpStatus.CONFLICT,m);} private ResponseStatusException badRequest(String m){return new ResponseStatusException(HttpStatus.BAD_REQUEST,m);}
}
