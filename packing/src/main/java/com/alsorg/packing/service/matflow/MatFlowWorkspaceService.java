package com.alsorg.packing.service.matflow;

import static com.alsorg.packing.controller.dto.matflow.MatFlowWorkspaceDtos.*;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.domain.matflow.MatFlowAuditLog;
import com.alsorg.packing.domain.matflow.MatFlowBom;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.BomStatus;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.Criticality;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.EngineeringDecision;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.ProductionFileStage;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.ReleaseHealth;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.RevisionStatus;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.RevisionType;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.WorkItemStatus;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.WorkItemType;
import com.alsorg.packing.domain.matflow.MatFlowProductionFile;
import com.alsorg.packing.domain.matflow.MatFlowRevision;
import com.alsorg.packing.domain.matflow.MatFlowWorkItem;
import com.alsorg.packing.repository.matflow.MatFlowBomRepository;
import com.alsorg.packing.repository.matflow.MatFlowProductionFileRepository;
import com.alsorg.packing.repository.matflow.MatFlowRevisionRepository;
import com.alsorg.packing.repository.matflow.MatFlowWorkItemRepository;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * MatFlow V1 workflow engine. This service intentionally ends at
 * PRODUCTION_RELEASED. Production execution through Final QC remains a later,
 * validated workflow plugged into that durable handoff state.
 */
@Service
public class MatFlowWorkspaceService {
    private static final long REVISION_MAX_BYTES = 30L * 1024L * 1024L;
    private static final Set<WorkItemStatus> OPEN_QUERY_STATUSES = Set.of(WorkItemStatus.OPEN, WorkItemStatus.RESPONDED);
    private static final Set<WorkItemStatus> OPEN_TASK_STATUSES = Set.of(WorkItemStatus.TODO, WorkItemStatus.ASSIGNED, WorkItemStatus.IN_PROGRESS, WorkItemStatus.BLOCKED);

    private final MatFlowProductionFileRepository fileRepository;
    private final MatFlowWorkItemRepository workRepository;
    private final MatFlowRevisionRepository revisionRepository;
    private final MatFlowBomRepository bomRepository;
    private final MatFlowAccessService accessService;
    private final MatFlowAuditService auditService;
    private final MatFlowWorkflowTemplateService templateService;
    private final Path revisionRoot;

    public MatFlowWorkspaceService(
            MatFlowProductionFileRepository fileRepository,
            MatFlowWorkItemRepository workRepository,
            MatFlowRevisionRepository revisionRepository,
            MatFlowBomRepository bomRepository,
            MatFlowAccessService accessService,
            MatFlowAuditService auditService,
            MatFlowWorkflowTemplateService templateService,
            @Value("${matflow.revision-attachment-dir:}") String configuredRevisionDir) {
        this.fileRepository = fileRepository;
        this.workRepository = workRepository;
        this.revisionRepository = revisionRepository;
        this.bomRepository = bomRepository;
        this.accessService = accessService;
        this.auditService = auditService;
        this.templateService = templateService;
        this.revisionRoot = resolveRoot(configuredRevisionDir);
        try { Files.createDirectories(revisionRoot); }
        catch (IOException ex) { throw new IllegalStateException("Unable to initialize MatFlow revision directory", ex); }
    }

    @Transactional(readOnly = true)
    public List<ProductionFileResponse> list(String plantCode, String stage, String health, String search) {
        accessService.requireRead();
        String plant = upperOrNull(plantCode);
        if (plant != null) accessService.requirePlantAccess(plant);
        ProductionFileStage stageFilter = enumOrNull(ProductionFileStage.class, stage);
        ReleaseHealth healthFilter = enumOrNull(ReleaseHealth.class, health);
        String q = clean(search);
        q = q == null ? "" : q.toLowerCase(Locale.ROOT);
        final String term = q;
        return fileRepository.findAllByOrderByUpdatedAtDesc().stream()
                .filter(f -> f.isActive() && accessService.canAccessPlant(f.getPlantCode()))
                .filter(f -> plant == null || plant.equalsIgnoreCase(f.getPlantCode()))
                .filter(f -> stageFilter == null || f.getStage() == stageFilter)
                .filter(f -> healthFilter == null || f.getReleaseHealth() == healthFilter)
                .filter(f -> term.isBlank() || contains(f.getProductionFileNo(), term) || contains(f.getProjectCode(), term)
                        || contains(f.getProjectName(), term) || contains(f.getProductName(), term) || contains(f.getDrawingNo(), term)
                        || contains(f.getCurrentOwner(), term))
                .map(this::toFileResponse).toList();
    }

    @Transactional(readOnly = true)
    public ProductionFileDetailResponse get(UUID fileId) {
        accessService.requireRead();
        MatFlowProductionFile file = requireFile(fileId);
        return toDetail(file);
    }

    @Transactional
    public ProductionFileDetailResponse updateSetup(UUID fileId, ProductionFileSetupRequest request) {
        accessService.requireDesignerWrite();
        MatFlowProductionFile file = requireFile(fileId); requireVersion(file.getRowVersion(), request.rowVersion());
        if (request.designer() != null) file.setDesigner(request.designer());
        if (request.ppcOwner() != null) file.setPpcOwner(request.ppcOwner());
        if (request.engineeringHead() != null) file.setEngineeringHead(request.engineeringHead());
        if (request.assignedEngineer() != null) file.setAssignedEngineer(request.assignedEngineer());
        file.setPlannedProductionReleaseDate(request.plannedProductionReleaseDate());
        file.setPlannedDispatchDate(request.plannedDispatchDate());
        if (request.remarks() != null) file.setRemarks(request.remarks());
        if (file.getCurrentOwner() == null) file.setCurrentOwner(file.getDesigner());
        file.setUpdatedBy(accessService.actor()); refreshHealth(file); fileRepository.save(file);
        auditService.log("PRODUCTION_FILE", file.getId(), "FILE_SETUP_UPDATED", file,
                auditService.details("designer", file.getDesigner(), "ppcOwner", file.getPpcOwner(), "engineeringHead", file.getEngineeringHead(), "assignedEngineer", file.getAssignedEngineer()));
        return toDetail(file);
    }

    @Transactional
    public ProductionFileDetailResponse updateChecklist(UUID fileId, String area, String itemKey, ChecklistUpdateRequest request) {
        MatFlowProductionFile file = requireFile(fileId);
        WorkItemType type = "DESIGN".equalsIgnoreCase(area) ? WorkItemType.DESIGN_CHECK : WorkItemType.ENGINEERING_CHECK;
        if (type == WorkItemType.DESIGN_CHECK) {
            accessService.requireDesignerWrite();
            requireStage(file, ProductionFileStage.DESIGN_DRAFT, ProductionFileStage.DESIGN_CLARIFICATION);
        } else {
            accessService.requireEngineeringWrite();
            requireStage(file, ProductionFileStage.ENGINEERING_REVIEW, ProductionFileStage.ENGINEERING_QUERY);
        }
        MatFlowWorkItem item = workRepository.findByProductionFile_IdAndItemTypeAndItemKeyIgnoreCase(fileId, type, itemKey)
                .orElseThrow(() -> notFound("Checklist item not found"));
        requireVersion(item.getRowVersion(), request.rowVersion());
        WorkItemStatus next = enumValue(WorkItemStatus.class, request.status(), "Invalid checklist status");
        if (!Set.of(WorkItemStatus.PENDING, WorkItemStatus.COMPLETE, WorkItemStatus.NOT_APPLICABLE).contains(next)) {
            throw badRequest("Checklist status must be PENDING, COMPLETE or NOT_APPLICABLE");
        }
        if (next == WorkItemStatus.NOT_APPLICABLE && item.getCriticality() == Criticality.CRITICAL) {
            throw conflict("Critical checklist item cannot be marked Not Applicable");
        }
        item.setStatus(next); item.setRemarks(request.remarks()); item.setUpdatedBy(accessService.actor());
        if (next == WorkItemStatus.COMPLETE || next == WorkItemStatus.NOT_APPLICABLE) {
            item.setCompletedBy(accessService.actor()); item.setCompletedAt(now());
        } else { item.setCompletedBy(null); item.setCompletedAt(null); }
        workRepository.save(item); refreshHealth(file); file.setUpdatedBy(accessService.actor()); fileRepository.save(file);
        auditService.log("WORK_ITEM", item.getId(), "CHECKLIST_UPDATED", file,
                auditService.details("area", area, "key", item.getItemKey(), "status", item.getStatus().name(), "remarks", item.getRemarks()));
        return toDetail(file);
    }

    @Transactional
    public ProductionFileDetailResponse submitDesign(UUID fileId, DesignSubmitRequest request) {
        accessService.requireDesignerWrite();
        MatFlowProductionFile file = requireFile(fileId); requireVersion(file.getRowVersion(), request.rowVersion());
        requireStage(file, ProductionFileStage.DESIGN_DRAFT, ProductionFileStage.DESIGN_CLARIFICATION);
        ChecklistProgress progress = progress(fileId, WorkItemType.DESIGN_CHECK);
        ReleaseHealth health = releaseHealth(progress);
        if (health == ReleaseHealth.RED) throw conflict("Design cannot be submitted: critical information is still pending");
        if (health == ReleaseHealth.AMBER && clean(request.controlledReleaseReason()) == null) {
            throw badRequest("Controlled Release reason is mandatory for AMBER submission");
        }
        if (activeRevision(fileId, RevisionType.DESIGN_DRAWING) == null) throw conflict("Upload an active Design Drawing revision before submission");
        if (clean(file.getPpcOwner()) == null) throw conflict("Assign the PPC owner before Designer submission");
        file.setControlledReleaseReason(health == ReleaseHealth.AMBER ? request.controlledReleaseReason() : null);
        file.setReleaseHealth(health); file.setStage(ProductionFileStage.PPC_GATE_1); file.setCurrentDepartment("PPC");
        file.setCurrentOwner(file.getPpcOwner()); file.setDesignSubmittedBy(accessService.actor()); file.setDesignSubmittedAt(now());
        file.setUpdatedBy(accessService.actor()); fileRepository.save(file);
        auditService.log("PRODUCTION_FILE", file.getId(), "DESIGN_SUBMITTED", file,
                auditService.details("health", health.name(), "controlledReleaseReason", file.getControlledReleaseReason()));
        return toDetail(file);
    }

    @Transactional
    public ProductionFileDetailResponse ppcGate1(UUID fileId, GateDecisionRequest request) {
        accessService.requirePpcWrite();
        MatFlowProductionFile file = requireFile(fileId); requireVersion(file.getRowVersion(), request.rowVersion());
        requireStage(file, ProductionFileStage.DESIGN_SUBMITTED, ProductionFileStage.PPC_GATE_1);
        String decision = upper(request.decision());
        if (!Set.of("ACCEPT", "RETURN").contains(decision)) throw badRequest("PPC Gate 1 decision must be ACCEPT or RETURN");
        file.setPpcGate1Decision(decision); file.setPpcGate1By(accessService.actor()); file.setPpcGate1At(now()); file.setPpcGate1Remarks(request.remarks());
        if ("RETURN".equals(decision)) {
            if (clean(request.remarks()) == null) throw badRequest("Return remarks are required");
            file.setStage(ProductionFileStage.DESIGN_CLARIFICATION); file.setCurrentDepartment("DESIGN"); file.setCurrentOwner(file.getDesigner());
        } else {
            if (file.getReleaseHealth() == ReleaseHealth.RED) throw conflict("RED file cannot pass PPC Gate 1");
            if (clean(request.assignedTo()) != null) file.setAssignedEngineer(request.assignedTo());
            if (clean(file.getAssignedEngineer()) == null) throw conflict("Assign an Engineer before accepting PPC Gate 1");
            templateService.seedEngineeringChecklist(file);
            file.setEngineeringDecision(EngineeringDecision.PENDING); file.setStage(ProductionFileStage.ENGINEERING_REVIEW); file.setCurrentDepartment("ENGINEERING");
            file.setCurrentOwner(clean(file.getAssignedEngineer()) != null ? file.getAssignedEngineer() : file.getEngineeringHead());
        }
        file.setUpdatedBy(accessService.actor()); refreshHealth(file); fileRepository.save(file);
        auditService.log("PRODUCTION_FILE", file.getId(), "PPC_GATE_1_" + decision, file,
                auditService.details("remarks", request.remarks(), "assignedTo", request.assignedTo()));
        return toDetail(file);
    }

    @Transactional
    public ProductionFileDetailResponse engineeringDecision(UUID fileId, EngineeringDecisionRequest request) {
        accessService.requireEngineeringWrite();
        MatFlowProductionFile file = requireFile(fileId); requireVersion(file.getRowVersion(), request.rowVersion());
        requireStage(file, ProductionFileStage.ENGINEERING_REVIEW, ProductionFileStage.ENGINEERING_QUERY);
        String decision = upper(request.decision());
        if ("QUERY_RAISED".equals(decision)) {
            if (openQueryCount(fileId) == 0) throw conflict("Create at least one Engineering Query before selecting QUERY_RAISED");
            file.setEngineeringDecision(EngineeringDecision.QUERY_RAISED); file.setStage(ProductionFileStage.ENGINEERING_QUERY); file.setCurrentDepartment("DESIGN / ENGINEERING QUERY");
        } else if ("APPROVED".equals(decision)) {
            ChecklistProgress p = progress(fileId, WorkItemType.ENGINEERING_CHECK);
            if (p.criticalPending() > 0 || p.requiredPending() > 0) throw conflict("Complete the Engineering checklist before approval");
            if (openQueryCount(fileId) > 0) throw conflict("Close all Engineering Queries before approval");
            file.setEngineeringDecision(EngineeringDecision.APPROVED); templateService.seedEngineeringTasks(file);
            file.setStage(ProductionFileStage.ENGINEERING_WORK); file.setCurrentDepartment("ENGINEERING"); file.setCurrentOwner(file.getAssignedEngineer());
        } else {
            throw badRequest("Engineering decision must be APPROVED or QUERY_RAISED");
        }
        file.setEngineeringDecisionBy(accessService.actor()); file.setEngineeringDecisionAt(now()); file.setEngineeringDecisionRemarks(request.remarks());
        file.setUpdatedBy(accessService.actor()); refreshHealth(file); fileRepository.save(file);
        auditService.log("PRODUCTION_FILE", file.getId(), "ENGINEERING_" + decision, file, auditService.details("remarks", request.remarks()));
        return toDetail(file);
    }

    @Transactional
    public ProductionFileDetailResponse createQuery(UUID fileId, QueryCreateRequest request) {
        accessService.requireEngineeringWrite(); MatFlowProductionFile file=requireFile(fileId);
        if (!Set.of(ProductionFileStage.ENGINEERING_REVIEW, ProductionFileStage.ENGINEERING_QUERY, ProductionFileStage.ENGINEERING_WORK).contains(file.getStage())) {
            throw conflict("Engineering Query can only be raised while the file is with Engineering");
        }
        MatFlowWorkItem item = new MatFlowWorkItem(); item.setProductionFile(file); item.setItemType(WorkItemType.ENGINEERING_QUERY);
        item.setItemKey("Q-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT)); item.setSection("Engineering Query"); item.setTitle(request.title()); item.setDescription(request.description());
        item.setCriticality(Criticality.REQUIRED); item.setBlocking(true); item.setStatus(WorkItemStatus.OPEN); item.setAssignedTo(request.assignedTo()); item.setDueAt(request.dueAt()); item.setPriority(request.priority());
        item.setDisplayOrder((int) (openQueryCount(fileId) + 1)); item.setCreatedBy(accessService.actor()); item.setUpdatedBy(accessService.actor()); workRepository.save(item);
        file.setEngineeringDecision(EngineeringDecision.QUERY_RAISED); file.setStage(ProductionFileStage.ENGINEERING_QUERY); file.setCurrentDepartment("DESIGN / ENGINEERING QUERY"); file.setCurrentOwner(request.assignedTo()); file.setUpdatedBy(accessService.actor()); refreshHealth(file); fileRepository.save(file);
        auditService.log("WORK_ITEM", item.getId(), "ENGINEERING_QUERY_RAISED", file, auditService.details("title", item.getTitle(), "assignedTo", item.getAssignedTo(), "dueAt", item.getDueAt()));
        return toDetail(file);
    }

    @Transactional
    public ProductionFileDetailResponse respondQuery(UUID fileId, UUID queryId, QueryResponseRequest request) {
        accessService.requireDesignerWrite(); MatFlowProductionFile file=requireFile(fileId); MatFlowWorkItem item=requireWork(fileId, queryId, WorkItemType.ENGINEERING_QUERY); requireVersion(item.getRowVersion(), request.rowVersion());
        if (!Set.of(WorkItemStatus.OPEN, WorkItemStatus.RESPONDED).contains(item.getStatus())) throw conflict("Query is already closed");
        item.setResponseText(request.response()); item.setRespondedBy(accessService.actor()); item.setRespondedAt(now()); item.setStatus(WorkItemStatus.RESPONDED); item.setUpdatedBy(accessService.actor()); workRepository.save(item);
        file.setCurrentDepartment("ENGINEERING"); file.setCurrentOwner(file.getAssignedEngineer()); file.setUpdatedBy(accessService.actor()); fileRepository.save(file);
        auditService.log("WORK_ITEM", item.getId(), "ENGINEERING_QUERY_RESPONDED", file, auditService.details("response", request.response()));
        return toDetail(file);
    }

    @Transactional
    public ProductionFileDetailResponse closeQuery(UUID fileId, UUID queryId, QueryCloseRequest request) {
        accessService.requireEngineeringWrite(); MatFlowProductionFile file=requireFile(fileId); MatFlowWorkItem item=requireWork(fileId, queryId, WorkItemType.ENGINEERING_QUERY); requireVersion(item.getRowVersion(), request.rowVersion());
        if (item.getStatus() != WorkItemStatus.RESPONDED && item.getStatus() != WorkItemStatus.OPEN) throw conflict("Query is already closed");
        item.setStatus(WorkItemStatus.CLOSED); item.setCompletionNote(request.note()); item.setClosedBy(accessService.actor()); item.setClosedAt(now()); item.setUpdatedBy(accessService.actor()); workRepository.save(item);
        if (openQueryCount(fileId) == 0) {
            file.setEngineeringDecision(EngineeringDecision.PENDING); file.setStage(ProductionFileStage.ENGINEERING_REVIEW); file.setCurrentDepartment("ENGINEERING"); file.setCurrentOwner(file.getAssignedEngineer());
        }
        file.setUpdatedBy(accessService.actor()); refreshHealth(file); fileRepository.save(file);
        auditService.log("WORK_ITEM", item.getId(), "ENGINEERING_QUERY_CLOSED", file, auditService.details("note", request.note()));
        return toDetail(file);
    }

    @Transactional
    public ProductionFileDetailResponse createTask(UUID fileId, TaskCreateRequest request) {
        accessService.requireEngineeringWrite(); MatFlowProductionFile file=requireFile(fileId);
        if (file.getEngineeringDecision() != EngineeringDecision.APPROVED) throw conflict("Engineering must be approved before documentation tasks are added");
        String key=upper(request.taskKey());
        if (workRepository.findByProductionFile_IdAndItemTypeAndItemKeyIgnoreCase(fileId, WorkItemType.ENGINEERING_TASK, key).isPresent()) throw conflict("Engineering task key already exists: " + key);
        List<MatFlowWorkItem> tasks=items(fileId, WorkItemType.ENGINEERING_TASK);
        MatFlowWorkItem item=new MatFlowWorkItem(); item.setProductionFile(file); item.setItemType(WorkItemType.ENGINEERING_TASK); item.setItemKey(key); item.setSection("Engineering documentation"); item.setTitle(request.title()); item.setDescription(request.description());
        item.setCriticality(Criticality.REQUIRED); item.setBlocking(request.blocking()==null || request.blocking()); item.setDisplayOrder(tasks.size()+1);
        String taskOwner = clean(request.assignedTo()) == null ? file.getAssignedEngineer() : request.assignedTo();
        item.setAssignedTo(taskOwner); item.setDueAt(request.dueAt()); item.setPriority(request.priority());
        item.setStatus(clean(taskOwner)==null?WorkItemStatus.TODO:WorkItemStatus.ASSIGNED); item.setCreatedBy(accessService.actor()); item.setUpdatedBy(accessService.actor()); workRepository.save(item);
        refreshHealth(file); file.setUpdatedBy(accessService.actor()); fileRepository.save(file); auditService.log("WORK_ITEM",item.getId(),"ENGINEERING_TASK_CREATED",file,auditService.details("key",key,"title",item.getTitle())); return toDetail(file);
    }

    @Transactional
    public ProductionFileDetailResponse updateTask(UUID fileId, UUID taskId, TaskUpdateRequest request) {
        accessService.requireEngineeringWrite(); MatFlowProductionFile file=requireFile(fileId); MatFlowWorkItem item=requireWork(fileId, taskId, WorkItemType.ENGINEERING_TASK); requireVersion(item.getRowVersion(),request.rowVersion());
        if (request.assignedTo()!=null) item.setAssignedTo(request.assignedTo()); if (request.dueAt()!=null) item.setDueAt(request.dueAt()); if (request.priority()!=null) item.setPriority(request.priority()); if (request.remarks()!=null) item.setRemarks(request.remarks());
        if (item.getStatus()==WorkItemStatus.TODO && clean(item.getAssignedTo())!=null) item.setStatus(WorkItemStatus.ASSIGNED); item.setUpdatedBy(accessService.actor()); workRepository.save(item); auditService.log("WORK_ITEM",item.getId(),"ENGINEERING_TASK_UPDATED",file,auditService.details("assignedTo",item.getAssignedTo(),"dueAt",item.getDueAt())); return toDetail(file);
    }

    @Transactional
    public ProductionFileDetailResponse setTaskStatus(UUID fileId, UUID taskId, TaskStatusRequest request) {
        accessService.requireEngineeringWrite(); MatFlowProductionFile file=requireFile(fileId); MatFlowWorkItem item=requireWork(fileId,taskId,WorkItemType.ENGINEERING_TASK); requireVersion(item.getRowVersion(),request.rowVersion());
        WorkItemStatus next=enumValue(WorkItemStatus.class,request.status(),"Invalid task status");
        if (!Set.of(WorkItemStatus.TODO,WorkItemStatus.ASSIGNED,WorkItemStatus.IN_PROGRESS,WorkItemStatus.BLOCKED,WorkItemStatus.COMPLETE,WorkItemStatus.NOT_APPLICABLE,WorkItemStatus.CANCELLED).contains(next)) throw badRequest("Unsupported Engineering task status");
        if (next==WorkItemStatus.NOT_APPLICABLE && clean(request.note())==null) throw badRequest("Reason is required when a task is Not Applicable");
        if (next == WorkItemStatus.IN_PROGRESS && item.getStartedAt() == null) {
            item.setStartedAt(now());
            MatFlowRevision designRevision = activeRevision(fileId, RevisionType.DESIGN_DRAWING);
            if (designRevision != null) item.setRevisionContext("DESIGN:" + designRevision.getRevisionNo());
        }
        if ((next == WorkItemStatus.COMPLETE || next == WorkItemStatus.NOT_APPLICABLE) && item.getStartedAt() == null) {
            item.setStartedAt(now());
            MatFlowRevision designRevision = activeRevision(fileId, RevisionType.DESIGN_DRAWING);
            if (designRevision != null) item.setRevisionContext("DESIGN:" + designRevision.getRevisionNo());
        }
        if (next == WorkItemStatus.TODO || next == WorkItemStatus.ASSIGNED) { item.setStartedAt(null); item.setRevisionContext(null); }
        item.setStatus(next); item.setCompletionNote(request.note()); item.setUpdatedBy(accessService.actor());
        if (next==WorkItemStatus.COMPLETE || next==WorkItemStatus.NOT_APPLICABLE) { item.setCompletedBy(accessService.actor()); item.setCompletedAt(now()); }
        else { item.setCompletedBy(null); item.setCompletedAt(null); }
        workRepository.save(item); if (allBlockingTasksDone(fileId)) file.setStage(ProductionFileStage.PPC_GATE_2); else file.setStage(ProductionFileStage.ENGINEERING_WORK); file.setUpdatedBy(accessService.actor()); refreshHealth(file); fileRepository.save(file);
        auditService.log("WORK_ITEM",item.getId(),"ENGINEERING_TASK_STATUS_CHANGED",file,auditService.details("status",next.name(),"note",request.note())); return toDetail(file);
    }

    @Transactional
    public ProductionFileDetailResponse uploadRevision(UUID fileId, String typeValue, String revisionNo, String changeSummary, MultipartFile upload) {
        accessService.requireDesignerWrite(); MatFlowProductionFile file=requireFile(fileId); RevisionType type=enumValue(RevisionType.class,typeValue,"Invalid revision type");
        if (type==RevisionType.ENGINEERING_DRAWING) accessService.requireEngineeringWrite();
        if (upload==null || upload.isEmpty()) throw badRequest("Revision file is required"); if (upload.getSize()>REVISION_MAX_BYTES) throw badRequest("Revision file cannot exceed 30 MB");
        String rev=upper(revisionNo); if (rev.isBlank()) throw badRequest("Revision number is required"); if (revisionRepository.existsByProductionFile_IdAndRevisionTypeAndRevisionNoIgnoreCase(fileId,type,rev)) throw conflict("Revision already exists: "+rev);
        String original=safeFileName(upload.getOriginalFilename(), type.name()+"-"+rev); String content=clean(upload.getContentType()); if(content==null)content="application/octet-stream";
        Path folder=revisionRoot.resolve(fileId.toString()).resolve(type.name()).normalize(); Path target=folder.resolve(UUID.randomUUID()+"-"+original).normalize(); if(!target.startsWith(revisionRoot))throw badRequest("Invalid revision path");
        try { Files.createDirectories(folder); Files.copy(upload.getInputStream(),target,StandardCopyOption.REPLACE_EXISTING); } catch(IOException ex){ throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,"Unable to save revision file"); }
        MatFlowRevision row=new MatFlowRevision(); row.setProductionFile(file); row.setRevisionType(type); row.setRevisionNo(rev); row.setOriginalFileName(original); row.setContentType(content); row.setStoragePath(target.toString()); row.setSizeBytes(upload.getSize()); row.setChangeSummary(changeSummary); row.setCreatedBy(accessService.actor()); row.setUpdatedBy(accessService.actor());
        boolean impact=requiresImpactReview(file,type); row.setRevisionStatus(impact?RevisionStatus.PENDING_IMPACT_REVIEW:RevisionStatus.ACTIVE); if(!impact)row.setActivatedAt(now()); revisionRepository.save(row);
        if(impact){ file.setRevisionReviewRequired(true); file.setStage(ProductionFileStage.REVISION_REVIEW); file.setCurrentDepartment("ENGINEERING"); file.setCurrentOwner(file.getEngineeringHead()); }
        else activateRevision(file,row,false);
        file.setUpdatedBy(accessService.actor()); refreshHealth(file); fileRepository.save(file); auditService.log("REVISION",row.getId(),impact?"REVISION_IMPACT_REVIEW_REQUIRED":"REVISION_ACTIVATED",file,auditService.details("type",type.name(),"revisionNo",rev,"changeSummary",changeSummary)); return toDetail(file);
    }

    @Transactional(readOnly = true)
    public RevisionFileResource revisionFile(UUID fileId, UUID revisionId) {
        MatFlowProductionFile file=requireFile(fileId); MatFlowRevision row=revisionRepository.findById(revisionId).orElseThrow(()->notFound("Revision not found")); if(!fileId.equals(row.getProductionFile().getId()))throw notFound("Revision not found");
        Path path=Path.of(row.getStoragePath()).normalize(); if(!Files.exists(path)||!Files.isRegularFile(path))throw notFound("Revision file not found"); return new RevisionFileResource(new FileSystemResource(path),row.getOriginalFileName(),row.getContentType());
    }

    @Transactional
    public ProductionFileDetailResponse reviewRevisionImpact(UUID fileId, UUID revisionId, RevisionImpactRequest request) {
        accessService.requireEngineeringWrite(); MatFlowProductionFile file=requireFile(fileId); MatFlowRevision row=revisionRepository.findById(revisionId).orElseThrow(()->notFound("Revision not found")); if(!fileId.equals(row.getProductionFile().getId()))throw notFound("Revision not found"); requireVersion(row.getRowVersion(),request.rowVersion());
        if(row.getRevisionStatus()!=RevisionStatus.PENDING_IMPACT_REVIEW)throw conflict("Revision does not require impact review"); String decision=upper(request.decision()); row.setImpactNote(request.impactNote()); row.setImpactReviewedBy(accessService.actor()); row.setImpactReviewedAt(now()); row.setUpdatedBy(accessService.actor());
        if("ACCEPT".equals(decision)){
            activateRevision(file,row,true); row.setRevisionStatus(RevisionStatus.ACTIVE); row.setActivatedAt(now());
            file.setRevisionReviewRequired(false); file.setPpcGate2Decision(null); file.setPpcGate2By(null); file.setPpcGate2At(null); file.setPpcGate2Remarks(null);
            if(row.getRevisionType()==RevisionType.DESIGN_DRAWING){ resetEngineeringForDesignRevision(file); }
            else { file.setStage(ProductionFileStage.ENGINEERING_WORK); file.setCurrentDepartment("ENGINEERING"); file.setCurrentOwner(file.getAssignedEngineer()); }
            file.setDownstreamWorkflowStatus(file.getProductionReleasedAt()!=null?"RELEASE_INVALIDATED_BY_REVISION":file.getDownstreamWorkflowStatus());
        } else if("REJECT".equals(decision)){
            row.setRevisionStatus(RevisionStatus.REJECTED); file.setRevisionReviewRequired(false); restoreAfterRejectedRevision(file);
        } else throw badRequest("Revision impact decision must be ACCEPT or REJECT");
        revisionRepository.save(row); file.setUpdatedBy(accessService.actor()); refreshHealth(file); fileRepository.save(file); auditService.log("REVISION",row.getId(),"REVISION_IMPACT_"+decision,file,auditService.details("impactNote",request.impactNote())); return toDetail(file);
    }

    @Transactional
    public ProductionFileDetailResponse ppcGate2(UUID fileId, GateDecisionRequest request) {
        accessService.requirePpcWrite(); MatFlowProductionFile file=requireFile(fileId); requireVersion(file.getRowVersion(),request.rowVersion());
        requireStage(file, ProductionFileStage.ENGINEERING_WORK, ProductionFileStage.PPC_GATE_2);
        String decision=upper(request.decision());
        if(!Set.of("RELEASE","RETURN").contains(decision))throw badRequest("PPC Gate 2 decision must be RELEASE or RETURN");
        if("RETURN".equals(decision)){
            if(clean(request.remarks())==null)throw badRequest("Return remarks are required"); file.setPpcGate2Decision("RETURN"); file.setPpcGate2By(accessService.actor()); file.setPpcGate2At(now()); file.setPpcGate2Remarks(request.remarks()); file.setStage(ProductionFileStage.ENGINEERING_WORK); file.setCurrentDepartment("ENGINEERING"); file.setCurrentOwner(file.getAssignedEngineer());
        } else {
            List<String> blockers=gate2Blockers(file); if(!blockers.isEmpty())throw conflict("Production Release is blocked: "+String.join("; ",blockers));
            file.setPpcGate2Decision("RELEASE"); file.setPpcGate2By(accessService.actor()); file.setPpcGate2At(now()); file.setPpcGate2Remarks(request.remarks()); file.setStage(ProductionFileStage.PRODUCTION_RELEASED); file.setCurrentDepartment("PRODUCTION RELEASE"); file.setCurrentOwner(null); file.setProductionReleasedBy(accessService.actor()); file.setProductionReleasedAt(now());
            file.setDownstreamWorkflowKey("PENDING_VALIDATED_PRODUCTION_WORKFLOW"); file.setDownstreamWorkflowStatus("NOT_CONFIGURED"); file.setReleaseHealth(ReleaseHealth.GREEN);
            MatFlowBom bom=latestBom(file.getId()); if(bom!=null && bom.getStatus()==BomStatus.READY_FOR_RELEASE){ bom.setStatus(BomStatus.RELEASED); bom.setReleasedBy(accessService.actor()); bom.setReleasedAt(now()); bom.setUpdatedBy(accessService.actor()); bomRepository.save(bom); }
        }
        file.setUpdatedBy(accessService.actor()); fileRepository.save(file); auditService.log("PRODUCTION_FILE",file.getId(),"PPC_GATE_2_"+decision,file,auditService.details("remarks",request.remarks(),"downstreamWorkflowStatus",file.getDownstreamWorkflowStatus())); return toDetail(file);
    }

    @Transactional(readOnly = true)
    public NotificationFeedResponse notifications(Integer limit) {
        accessService.requireRead(); String actor=accessService.actor(); int max=limit==null?30:Math.max(1,Math.min(100,limit));
        List<WorkItemStatus> open=List.of(WorkItemStatus.OPEN,WorkItemStatus.RESPONDED,WorkItemStatus.TODO,WorkItemStatus.ASSIGNED,WorkItemStatus.IN_PROGRESS,WorkItemStatus.BLOCKED);
        List<NotificationResponse> rows=workRepository.findByAssignedToIgnoreCaseAndStatusInOrderByDueAtAsc(actor,open).stream().filter(w->accessService.canAccessPlant(w.getProductionFile().getPlantCode())).limit(max).map(w->{
            MatFlowProductionFile f=w.getProductionFile(); String message=w.getItemType()==WorkItemType.ENGINEERING_QUERY?"Engineering query requires attention":w.getTitle()+" is pending";
            return new NotificationResponse(w.getItemType().name(),w.getId(),w.getTitle(),message,w.getPriority(),w.getDueAt(),f.getProjectCode(),f.getProductionFileNo(),"/matflow/work?fileId="+f.getId(),w.getReadAt()!=null); }).toList();
        int unread=(int)rows.stream().filter(r->!r.read()).count(); return new NotificationFeedResponse(unread,rows,now());
    }

    @Transactional
    public NotificationFeedResponse markNotificationRead(UUID workItemId, Integer limit) {
        accessService.requireRead(); MatFlowWorkItem item=workRepository.findById(workItemId).orElseThrow(()->notFound("Work item not found")); requireFile(item.getProductionFile().getId());
        if(item.getAssignedTo()!=null && item.getAssignedTo().equalsIgnoreCase(accessService.actor())){ item.setReadAt(now()); item.setUpdatedBy(accessService.actor()); workRepository.save(item); }
        return notifications(limit);
    }

    @Transactional
    public NotificationFeedResponse markAllNotificationsRead(Integer limit) {
        accessService.requireRead(); String actor=accessService.actor();
        List<WorkItemStatus> open=List.of(WorkItemStatus.OPEN,WorkItemStatus.RESPONDED,WorkItemStatus.TODO,WorkItemStatus.ASSIGNED,WorkItemStatus.IN_PROGRESS,WorkItemStatus.BLOCKED);
        for(MatFlowWorkItem item:workRepository.findByAssignedToIgnoreCaseAndStatusInOrderByDueAtAsc(actor,open)){
            if(accessService.canAccessPlant(item.getProductionFile().getPlantCode())){item.setReadAt(now());item.setUpdatedBy(actor);workRepository.save(item);}
        }
        return notifications(limit);
    }

    private void resetEngineeringForDesignRevision(MatFlowProductionFile file) {
        file.setEngineeringDecision(EngineeringDecision.PENDING); file.setEngineeringDecisionBy(null); file.setEngineeringDecisionAt(null); file.setEngineeringDecisionRemarks(null); file.setStage(ProductionFileStage.ENGINEERING_REVIEW); file.setCurrentDepartment("ENGINEERING"); file.setCurrentOwner(file.getAssignedEngineer());
        for(MatFlowWorkItem item:items(file.getId(),WorkItemType.ENGINEERING_CHECK)){ item.setStatus(WorkItemStatus.PENDING); item.setCompletedAt(null); item.setCompletedBy(null); item.setUpdatedBy(accessService.actor()); workRepository.save(item); }
        for(MatFlowWorkItem item:items(file.getId(),WorkItemType.ENGINEERING_TASK)){ if(item.getStatus()!=WorkItemStatus.CANCELLED){ item.setStatus(clean(item.getAssignedTo()) == null ? WorkItemStatus.TODO : WorkItemStatus.ASSIGNED); item.setStartedAt(null); item.setRevisionContext(null); item.setCompletedAt(null); item.setCompletedBy(null); item.setUpdatedBy(accessService.actor()); workRepository.save(item); } }
        MatFlowBom bom=latestBom(file.getId()); if(bom!=null){ bom.setStatus(BomStatus.SUPERSEDED); bom.setLatestRevision(false); bom.setUpdatedBy(accessService.actor()); bomRepository.save(bom); }
    }

    private void restoreAfterRejectedRevision(MatFlowProductionFile file){
        if(file.getProductionReleasedAt()!=null){ file.setStage(ProductionFileStage.PRODUCTION_RELEASED); file.setCurrentDepartment("PRODUCTION RELEASE"); file.setCurrentOwner(null); }
        else if(file.getEngineeringDecision()==EngineeringDecision.APPROVED){ file.setStage(allBlockingTasksDone(file.getId())?ProductionFileStage.PPC_GATE_2:ProductionFileStage.ENGINEERING_WORK); file.setCurrentDepartment(allBlockingTasksDone(file.getId())?"PPC":"ENGINEERING"); file.setCurrentOwner(allBlockingTasksDone(file.getId())?file.getPpcOwner():file.getAssignedEngineer()); }
        else if("ACCEPT".equalsIgnoreCase(file.getPpcGate1Decision())){ file.setStage(ProductionFileStage.ENGINEERING_REVIEW); file.setCurrentDepartment("ENGINEERING"); file.setCurrentOwner(file.getAssignedEngineer()); }
        else { file.setStage(ProductionFileStage.DESIGN_DRAFT); file.setCurrentDepartment("DESIGN"); file.setCurrentOwner(file.getDesigner()); }
    }

    private void activateRevision(MatFlowProductionFile file, MatFlowRevision row, boolean keepRowStatus) {
        MatFlowRevision active=activeRevision(file.getId(),row.getRevisionType());
        if(active!=null && !Objects.equals(active.getId(),row.getId())){ active.setRevisionStatus(RevisionStatus.SUPERSEDED); active.setSupersededAt(now()); active.setUpdatedBy(accessService.actor()); revisionRepository.save(active); }
        if(!keepRowStatus){ row.setRevisionStatus(RevisionStatus.ACTIVE); row.setActivatedAt(now()); revisionRepository.save(row); }
        if(row.getRevisionType()==RevisionType.DESIGN_DRAWING){ file.getProduct().setDrawingRevision(row.getRevisionNo()); file.getProduct().setUpdatedBy(accessService.actor()); }
    }

    private boolean requiresImpactReview(MatFlowProductionFile file, RevisionType type){
        if(type==RevisionType.DESIGN_DRAWING){ return Set.of(ProductionFileStage.ENGINEERING_REVIEW,ProductionFileStage.ENGINEERING_QUERY,ProductionFileStage.ENGINEERING_WORK,ProductionFileStage.PPC_GATE_2,ProductionFileStage.PRODUCTION_RELEASED,ProductionFileStage.REVISION_REVIEW).contains(file.getStage()); }
        return Set.of(ProductionFileStage.PPC_GATE_2,ProductionFileStage.PRODUCTION_RELEASED,ProductionFileStage.REVISION_REVIEW).contains(file.getStage());
    }

    private List<String> gate2Blockers(MatFlowProductionFile file){
        List<String> blockers=new ArrayList<>(); if(file.isRevisionReviewRequired())blockers.add("Revision impact review is pending"); if(file.getEngineeringDecision()!=EngineeringDecision.APPROVED)blockers.add("Engineering is not approved");
        ChecklistProgress ep=progress(file.getId(),WorkItemType.ENGINEERING_CHECK); if(ep.criticalPending()>0||ep.requiredPending()>0)blockers.add("Engineering checklist is incomplete"); if(openQueryCount(file.getId())>0)blockers.add("Engineering Queries are still open");
        List<MatFlowWorkItem> pending=items(file.getId(),WorkItemType.ENGINEERING_TASK).stream().filter(MatFlowWorkItem::isBlocking).filter(x->!Set.of(WorkItemStatus.COMPLETE,WorkItemStatus.NOT_APPLICABLE).contains(x.getStatus())).toList(); if(!pending.isEmpty())blockers.add("Engineering documentation tasks pending: "+pending.stream().map(MatFlowWorkItem::getTitle).limit(4).reduce((a,b)->a+", "+b).orElse("pending"));
        MatFlowBom bom=latestBom(file.getId()); if(bom==null||bom.getStatus()!=BomStatus.READY_FOR_RELEASE)blockers.add("BOM is not Ready for Release"); if(activeRevision(file.getId(),RevisionType.ENGINEERING_DRAWING)==null)blockers.add("Active Production/Engineering Drawing revision is missing"); return blockers;
    }

    private boolean allBlockingTasksDone(UUID fileId){ List<MatFlowWorkItem> rows=items(fileId,WorkItemType.ENGINEERING_TASK); return !rows.isEmpty() && rows.stream().filter(MatFlowWorkItem::isBlocking).allMatch(x->Set.of(WorkItemStatus.COMPLETE,WorkItemStatus.NOT_APPLICABLE).contains(x.getStatus())); }
    private long openQueryCount(UUID fileId){ return workRepository.countByProductionFile_IdAndItemTypeAndStatusIn(fileId,WorkItemType.ENGINEERING_QUERY,OPEN_QUERY_STATUSES); }

    private void refreshHealth(MatFlowProductionFile file){
        ChecklistProgress dp=progress(file.getId(),WorkItemType.DESIGN_CHECK); ReleaseHealth health=releaseHealth(dp);
        if(file.isRevisionReviewRequired()||openQueryCount(file.getId())>0)health=ReleaseHealth.RED;
        else if(file.getEngineeringDecision()==EngineeringDecision.APPROVED && !gate2BlockersWithoutRecursion(file).isEmpty() && health==ReleaseHealth.GREEN)health=ReleaseHealth.AMBER;
        if(file.getStage()==ProductionFileStage.PRODUCTION_RELEASED && !file.isRevisionReviewRequired())health=ReleaseHealth.GREEN; file.setReleaseHealth(health);
    }

    private List<String> gate2BlockersWithoutRecursion(MatFlowProductionFile file){
        List<String>b=new ArrayList<>(); if(file.getEngineeringDecision()!=EngineeringDecision.APPROVED)b.add("engineering"); if(openQueryCount(file.getId())>0)b.add("query");
        if(file.getEngineeringDecision()==EngineeringDecision.APPROVED&&!allBlockingTasksDone(file.getId()))b.add("tasks"); MatFlowBom bom=latestBom(file.getId()); if(file.getEngineeringDecision()==EngineeringDecision.APPROVED&&(bom==null||bom.getStatus()!=BomStatus.READY_FOR_RELEASE))b.add("bom"); return b;
    }

    private ReleaseHealth releaseHealth(ChecklistProgress p){ if(p.criticalPending()>0)return ReleaseHealth.RED; if(p.requiredPending()>0)return ReleaseHealth.AMBER; return ReleaseHealth.GREEN; }
    private ChecklistProgress progress(UUID fileId, WorkItemType type){
        List<MatFlowWorkItem> rows=items(fileId,type); int complete=(int)rows.stream().filter(x->x.getStatus()==WorkItemStatus.COMPLETE).count(); int na=(int)rows.stream().filter(x->x.getStatus()==WorkItemStatus.NOT_APPLICABLE).count(); int pending=rows.size()-complete-na;
        int critical=(int)rows.stream().filter(x->x.getCriticality()==Criticality.CRITICAL&&!Set.of(WorkItemStatus.COMPLETE,WorkItemStatus.NOT_APPLICABLE).contains(x.getStatus())).count(); int required=(int)rows.stream().filter(x->x.getCriticality()==Criticality.REQUIRED&&!Set.of(WorkItemStatus.COMPLETE,WorkItemStatus.NOT_APPLICABLE).contains(x.getStatus())).count(); int percent=rows.isEmpty()?0:(int)Math.round(((complete+na)*100.0)/rows.size()); return new ChecklistProgress(rows.size(),complete,na,pending,critical,required,percent);
    }

    private ProductionFileDetailResponse toDetail(MatFlowProductionFile file){
        List<String> blockers=gate2Blockers(file); return new ProductionFileDetailResponse(toFileResponse(file),mapItems(items(file.getId(),WorkItemType.DESIGN_CHECK)),mapItems(items(file.getId(),WorkItemType.ENGINEERING_CHECK)),mapItems(items(file.getId(),WorkItemType.ENGINEERING_QUERY)),mapItems(items(file.getId(),WorkItemType.ENGINEERING_TASK)),revisionRepository.findByProductionFile_IdOrderByCreatedAtDesc(file.getId()).stream().map(this::toRevision).toList(),auditService.timeline(file.getId()).stream().map(this::toAudit).toList(),blockers.isEmpty(),blockers);
    }

    private ProductionFileResponse toFileResponse(MatFlowProductionFile file){
        List<MatFlowWorkItem> tasks=items(file.getId(),WorkItemType.ENGINEERING_TASK); int completed=(int)tasks.stream().filter(x->Set.of(WorkItemStatus.COMPLETE,WorkItemStatus.NOT_APPLICABLE).contains(x.getStatus())).count(); int pending=tasks.size()-completed; MatFlowBom bom=latestBom(file.getId());
        return new ProductionFileResponse(file.getId(),file.getProductionFileNo(),file.getProject().getId(),file.getProduct().getId(),file.getProjectCode(),file.getProjectName(),file.getClientName(),file.getProductName(),file.getDrawingNo(),file.getPlantCode(),file.getStage().name(),file.getReleaseHealth().name(),file.getEngineeringDecision().name(),file.getCurrentDepartment(),file.getCurrentOwner(),file.getDesigner(),file.getPpcOwner(),file.getEngineeringHead(),file.getAssignedEngineer(),file.getControlledReleaseReason(),file.getPlannedProductionReleaseDate(),file.getPlannedDispatchDate(),file.getPpcGate1Decision(),file.getPpcGate2Decision(),file.isRevisionReviewRequired(),file.getDownstreamWorkflowKey(),file.getDownstreamWorkflowStatus(),file.getProductionReleasedAt(),file.getProjectCode(),progress(file.getId(),WorkItemType.DESIGN_CHECK),progress(file.getId(),WorkItemType.ENGINEERING_CHECK),(int)openQueryCount(file.getId()),pending,completed,bom==null?null:bom.getId(),bom==null?null:bom.getStatus().name(),file.getRowVersion(),file.getUpdatedAt());
    }

    private List<WorkItemResponse> mapItems(List<MatFlowWorkItem> rows){ return rows.stream().map(this::toWork).toList(); }
    private WorkItemResponse toWork(MatFlowWorkItem x){ return new WorkItemResponse(x.getId(),x.getItemType().name(),x.getItemKey(),x.getSection(),x.getTitle(),x.getDescription(),x.getCriticality().name(),x.isBlocking(),x.getDisplayOrder(),x.getStatus().name(),x.getAssignedTo(),x.getDueAt(),x.getStartedAt(),x.getRevisionContext(),x.getPriority(),x.getResponseText(),x.getRemarks(),x.getCompletionNote(),x.getCompletedBy(),x.getCompletedAt(),x.getRespondedBy(),x.getRespondedAt(),x.getClosedBy(),x.getClosedAt(),x.getRowVersion(),x.getUpdatedAt()); }
    private RevisionResponse toRevision(MatFlowRevision x){ return new RevisionResponse(x.getId(),x.getRevisionType().name(),x.getRevisionNo(),x.getRevisionStatus().name(),x.getOriginalFileName(),x.getContentType(),x.getSizeBytes()==null?0:x.getSizeBytes(),x.getChangeSummary(),x.getImpactNote(),x.getImpactReviewedBy(),x.getImpactReviewedAt(),x.getActivatedAt(),x.getRowVersion(),x.getCreatedAt()); }
    private AuditEventResponse toAudit(MatFlowAuditLog x){ return new AuditEventResponse(x.getEntityType(),x.getEntityId(),x.getAction(),x.getActor(),x.getActionAt(),x.getDetailsJson()); }

    private MatFlowProductionFile requireFile(UUID id){ MatFlowProductionFile file=fileRepository.findById(id).orElseThrow(()->notFound("Production File not found")); accessService.requirePlantAccess(file.getPlantCode()); return file; }
    private MatFlowWorkItem requireWork(UUID fileId,UUID id,WorkItemType type){ MatFlowWorkItem x=workRepository.findById(id).orElseThrow(()->notFound("Work item not found")); if(!fileId.equals(x.getProductionFile().getId())||x.getItemType()!=type)throw notFound("Work item not found"); return x; }
    private List<MatFlowWorkItem> items(UUID fileId,WorkItemType type){ return workRepository.findByProductionFile_IdAndItemTypeOrderByDisplayOrderAscCreatedAtAsc(fileId,type); }
    private MatFlowRevision activeRevision(UUID fileId,RevisionType type){ return revisionRepository.findFirstByProductionFile_IdAndRevisionTypeAndRevisionStatusOrderByActivatedAtDesc(fileId,type,RevisionStatus.ACTIVE).orElse(null); }
    private MatFlowBom latestBom(UUID fileId){ return bomRepository.findFirstByProductionFile_IdAndLatestRevisionTrue(fileId).orElse(null); }
    private void requireStage(MatFlowProductionFile file,ProductionFileStage...allowed){ if(java.util.Arrays.stream(allowed).noneMatch(x->x==file.getStage()))throw conflict("Action is not allowed while file is at stage "+file.getStage()); }
    private void requireVersion(Long actual,Long supplied){ if(supplied==null||!supplied.equals(actual))throw conflict("Record changed. Refresh and retry."); }
    private boolean contains(String value,String term){ return value!=null&&value.toLowerCase(Locale.ROOT).contains(term); }
    private String clean(String value){ if(value==null)return null; String x=value.trim(); return x.isBlank()?null:x; }
    private String upper(String value){ String x=clean(value); return x==null?"":x.toUpperCase(Locale.ROOT); }
    private String upperOrNull(String value){ String x=clean(value); return x==null?null:x.toUpperCase(Locale.ROOT); }
    private <E extends Enum<E>> E enumValue(Class<E> type,String value,String message){ try{return Enum.valueOf(type,upper(value));}catch(Exception ex){throw badRequest(message+": "+value);} }
    private <E extends Enum<E>> E enumOrNull(Class<E> type,String value){ String x=clean(value); if(x==null)return null; return enumValue(type,x,"Invalid filter"); }
    private LocalDateTime now(){ return LocalDateTime.now(TimeZoneConfig.APP_ZONE); }
    private Path resolveRoot(String configured){ String x=clean(configured); Path p=x==null?Path.of(System.getProperty("java.io.tmpdir"),"alsorg","matflow","revisions"):Path.of(x); return p.toAbsolutePath().normalize(); }
    private String safeFileName(String value,String fallback){ String x=clean(value); if(x==null)x=fallback; x=x.replaceAll("[\\/\r\n\"]","_"); return x.length()>180?x.substring(0,180):x; }
    private ResponseStatusException badRequest(String m){ return new ResponseStatusException(HttpStatus.BAD_REQUEST,m); }
    private ResponseStatusException notFound(String m){ return new ResponseStatusException(HttpStatus.NOT_FOUND,m); }
    private ResponseStatusException conflict(String m){ return new ResponseStatusException(HttpStatus.CONFLICT,m); }

    public record RevisionFileResource(Resource resource,String fileName,String contentType) {}
}
