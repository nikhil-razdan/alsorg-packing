package com.alsorg.packing.service.matflow;

import static com.alsorg.packing.controller.dto.matflow.MatFlowInsightDtos.*;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.EngineeringDecision;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.ProductionFileStage;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.ReleaseHealth;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.WorkItemStatus;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.WorkItemType;
import com.alsorg.packing.domain.matflow.MatFlowProductionFile;
import com.alsorg.packing.domain.matflow.MatFlowWorkItem;
import com.alsorg.packing.repository.matflow.MatFlowProductionFileRepository;
import com.alsorg.packing.repository.matflow.MatFlowWorkItemRepository;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MatFlowInsightService {
    private final MatFlowProductionFileRepository fileRepository;
    private final MatFlowWorkItemRepository workRepository;
    private final MatFlowAccessService accessService;
    private final MatFlowAuditService auditService;

    public MatFlowInsightService(MatFlowProductionFileRepository fileRepository, MatFlowWorkItemRepository workRepository,
            MatFlowAccessService accessService, MatFlowAuditService auditService) {
        this.fileRepository=fileRepository; this.workRepository=workRepository; this.accessService=accessService; this.auditService=auditService;
    }

    @Transactional(readOnly = true)
    public DashboardResponse dashboard(String plantCode) {
        accessService.requireRead(); String plant=cleanUpper(plantCode); if(plant!=null)accessService.requirePlantAccess(plant);
        List<MatFlowProductionFile> files=fileRepository.findAllByOrderByUpdatedAtDesc().stream().filter(MatFlowProductionFile::isActive).filter(f->accessService.canAccessPlant(f.getPlantCode())).filter(f->plant==null||plant.equalsIgnoreCase(f.getPlantCode())).toList();
        Map<String,Long> stageCounts=new LinkedHashMap<>(); for(ProductionFileStage s:ProductionFileStage.values())stageCounts.put(s.name(),files.stream().filter(f->f.getStage()==s).count());
        long openQueries=0,overdue=0; List<ProductionRiskRow> attention=new ArrayList<>();
        for(MatFlowProductionFile f:files){ List<MatFlowWorkItem> items=workRepository.findByProductionFile_IdOrderByDisplayOrderAscCreatedAtAsc(f.getId()); long q=items.stream().filter(i->i.getItemType()==WorkItemType.ENGINEERING_QUERY&&Set.of(WorkItemStatus.OPEN,WorkItemStatus.RESPONDED).contains(i.getStatus())).count(); long pending=items.stream().filter(i->i.getItemType()==WorkItemType.ENGINEERING_TASK&&!Set.of(WorkItemStatus.COMPLETE,WorkItemStatus.NOT_APPLICABLE,WorkItemStatus.CANCELLED).contains(i.getStatus())).count(); long late=items.stream().filter(i->i.getDueAt()!=null&&i.getDueAt().isBefore(now())&&!Set.of(WorkItemStatus.COMPLETE,WorkItemStatus.NOT_APPLICABLE,WorkItemStatus.CLOSED,WorkItemStatus.CANCELLED).contains(i.getStatus())).count(); openQueries+=q; overdue+=late;
            if(f.getReleaseHealth()!=ReleaseHealth.GREEN||q>0||late>0){ List<String> blockers=new ArrayList<>(); if(f.isRevisionReviewRequired())blockers.add("Revision review"); if(q>0)blockers.add(q+" open quer"+(q==1?"y":"ies")); if(pending>0)blockers.add(pending+" engineering task"+(pending==1?"":"s")); if(late>0)blockers.add(late+" overdue work item"+(late==1?"":"s")); attention.add(new ProductionRiskRow(f.getId(),f.getProductionFileNo(),f.getProjectCode(),f.getProductName(),f.getStage().name(),f.getReleaseHealth().name(),f.getCurrentOwner(),(int)q,(int)pending,blockers,f.getUpdatedAt())); }
        }
        attention.sort((a,b)->{ int h=Integer.compare(rank(b.health()),rank(a.health())); return h!=0?h:b.updatedAt().compareTo(a.updatedAt()); });
        return new DashboardResponse(files.size(),countHealth(files,ReleaseHealth.GREEN),countHealth(files,ReleaseHealth.AMBER),countHealth(files,ReleaseHealth.RED),countStages(files,ProductionFileStage.DESIGN_DRAFT,ProductionFileStage.DESIGN_CLARIFICATION,ProductionFileStage.DESIGN_SUBMITTED),countStages(files,ProductionFileStage.PPC_GATE_1),countStages(files,ProductionFileStage.ENGINEERING_REVIEW,ProductionFileStage.ENGINEERING_QUERY,ProductionFileStage.ENGINEERING_WORK,ProductionFileStage.REVISION_REVIEW),countStages(files,ProductionFileStage.PPC_GATE_2),countStages(files,ProductionFileStage.PRODUCTION_RELEASED),openQueries,overdue,attention.stream().limit(20).toList(),stageCounts,now());
    }

    @Transactional(readOnly = true)
    public EngineeringKpis engineeringKpis(String plantCode) {
        accessService.requireRead(); String plant=cleanUpper(plantCode); if(plant!=null)accessService.requirePlantAccess(plant);
        List<MatFlowProductionFile> files=fileRepository.findAllByOrderByUpdatedAtDesc().stream().filter(f->accessService.canAccessPlant(f.getPlantCode())).filter(f->plant==null||plant.equalsIgnoreCase(f.getPlantCode())).toList();
        long inEngineering=files.stream().filter(f->Set.of(ProductionFileStage.ENGINEERING_REVIEW,ProductionFileStage.ENGINEERING_QUERY,ProductionFileStage.ENGINEERING_WORK,ProductionFileStage.REVISION_REVIEW).contains(f.getStage())).count(); long approved=files.stream().filter(f->f.getEngineeringDecision()==EngineeringDecision.APPROVED).count();
        List<MatFlowWorkItem> all=new ArrayList<>(); for(MatFlowProductionFile f:files)all.addAll(workRepository.findByProductionFile_IdOrderByDisplayOrderAscCreatedAtAsc(f.getId()));
        long queries=all.stream().filter(i->i.getItemType()==WorkItemType.ENGINEERING_QUERY&&Set.of(WorkItemStatus.OPEN,WorkItemStatus.RESPONDED).contains(i.getStatus())).count(); long pending=all.stream().filter(i->i.getItemType()==WorkItemType.ENGINEERING_TASK&&!Set.of(WorkItemStatus.COMPLETE,WorkItemStatus.NOT_APPLICABLE,WorkItemStatus.CANCELLED).contains(i.getStatus())).count(); List<MatFlowWorkItem> completed=all.stream().filter(i->i.getItemType()==WorkItemType.ENGINEERING_TASK&&i.getStatus()==WorkItemStatus.COMPLETE).toList();
        double avg=completed.stream().filter(i->i.getCompletedAt()!=null&&i.getStartedAt()!=null).mapToLong(i->Duration.between(i.getStartedAt(),i.getCompletedAt()).toMinutes()).average().orElse(0);
        List<MatFlowProductionFile> released=files.stream().filter(f->f.getProductionReleasedAt()!=null).toList(); long firstTimeRight=released.stream().filter(f->auditService.timeline(f.getId()).stream().noneMatch(a->a.getAction()!=null&&(a.getAction().startsWith("REVISION_IMPACT_")||a.getAction().equals("PPC_GATE_2_RETURN")))).count(); double ftr=released.isEmpty()?0:(firstTimeRight*100.0/released.size());
        return new EngineeringKpis(inEngineering,approved,queries,pending,completed.size(),round1(ftr),round1(avg),now());
    }

    private long countHealth(List<MatFlowProductionFile> files,ReleaseHealth h){return files.stream().filter(f->f.getReleaseHealth()==h).count();}
    private long countStages(List<MatFlowProductionFile> files,ProductionFileStage...stages){Set<ProductionFileStage>s=Set.of(stages);return files.stream().filter(f->s.contains(f.getStage())).count();}
    private int rank(String h){return "RED".equals(h)?3:"AMBER".equals(h)?2:1;}
    private double round1(double v){return Math.round(v*10.0)/10.0;}
    private LocalDateTime now(){return LocalDateTime.now(TimeZoneConfig.APP_ZONE);}
    private String cleanUpper(String v){if(v==null)return null;String x=v.trim();return x.isBlank()?null:x.toUpperCase(Locale.ROOT);}
}
