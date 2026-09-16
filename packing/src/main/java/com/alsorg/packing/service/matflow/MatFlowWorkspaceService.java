package com.alsorg.packing.service.matflow;

import static com.alsorg.packing.controller.dto.matflow.MatFlowWorkspaceDtos.*;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.domain.matflow.MatFlowAuditLog;
import com.alsorg.packing.domain.matflow.MatFlowBom;
import com.alsorg.packing.domain.matflow.MatFlowDesignTask;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.BomStatus;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.Criticality;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.DesignTaskStatus;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.DesignTaskType;
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
import com.alsorg.packing.repository.matflow.MatFlowDesignTaskRepository;
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
    private final MatFlowDesignTaskRepository designTaskRepository;
    private final MatFlowAccessService accessService;
    private final MatFlowAuditService auditService;
    private final MatFlowWorkflowTemplateService templateService;
    private final Path revisionRoot;

    public MatFlowWorkspaceService(
            MatFlowProductionFileRepository fileRepository,
            MatFlowWorkItemRepository workRepository,
            MatFlowRevisionRepository revisionRepository,
            MatFlowBomRepository bomRepository,
            MatFlowDesignTaskRepository designTaskRepository,
            MatFlowAccessService accessService,
            MatFlowAuditService auditService,
            MatFlowWorkflowTemplateService templateService,
            @Value("${matflow.revision-attachment-dir:}") String configuredRevisionDir) {
        this.fileRepository = fileRepository;
        this.workRepository = workRepository;
        this.revisionRepository = revisionRepository;
        this.bomRepository = bomRepository;
        this.designTaskRepository = designTaskRepository;
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

    @Transactional(readOnly = true)
    public List<DesignTaskQueueResponse> listDesignTasks(String plantCode, String assignee, String status, String search) {
        accessService.requireRead();
        String plant = upperOrNull(plantCode);
        if (plant != null) accessService.requirePlantAccess(plant);
        DesignTaskStatus statusFilter = enumOrNull(DesignTaskStatus.class, status);
        String assigned = clean(assignee);
        String term = clean(search);
        term = term == null ? "" : term.toLowerCase(Locale.ROOT);
        final String q = term;
        return designTaskRepository.findAllForQueue().stream()
                .filter(task -> task.getProductionFile() != null && task.getProductionFile().isActive())
                .filter(task -> accessService.canAccessPlant(task.getProductionFile().getPlantCode()))
                .filter(task -> plant == null || plant.equalsIgnoreCase(task.getProductionFile().getPlantCode()))
                .filter(task -> statusFilter == null || task.getStatus() == statusFilter)
                .filter(task -> assigned == null || task.getAssignees().stream().anyMatch(value -> value.equalsIgnoreCase(assigned)))
                .filter(task -> q.isBlank() || designTaskContains(task, q))
                .sorted(Comparator
                        .comparing((MatFlowDesignTask task) -> Set.of(DesignTaskStatus.DONE, DesignTaskStatus.CANCELLED).contains(task.getStatus()))
                        .thenComparing(MatFlowDesignTask::getDueAt, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(MatFlowDesignTask::getReceivedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toDesignTaskQueue)
                .toList();
    }

    @Transactional
    public ProductionFileDetailResponse updateSetup(UUID fileId, ProductionFileSetupRequest request) {
        accessService.requireDesignerWrite();
        MatFlowProductionFile file = requireFile(fileId);
        requireVersion(file.getRowVersion(), request.rowVersion());

        boolean designIdentityChanged = false;
        if (request.designer() != null && !Objects.equals(clean(file.getDesigner()), clean(request.designer()))) {
            file.setDesigner(request.designer());
            designIdentityChanged = true;
        }
        if (request.designHead() != null && !Objects.equals(clean(file.getDesignHead()), clean(request.designHead()))) {
            file.setDesignHead(request.designHead());
            designIdentityChanged = true;
        }
        if (request.ppcOwner() != null) file.setPpcOwner(request.ppcOwner());
        if (request.engineeringHead() != null) file.setEngineeringHead(request.engineeringHead());
        if (request.assignedEngineer() != null) file.setAssignedEngineer(request.assignedEngineer());
        file.setPlannedProductionReleaseDate(request.plannedProductionReleaseDate());
        file.setPlannedDispatchDate(request.plannedDispatchDate());
        if (request.remarks() != null) file.setRemarks(request.remarks());

        if (isDesignStage(file)) {
            file.setCurrentDepartment("DESIGN");
            file.setCurrentOwner(clean(file.getDesignHead()) != null ? file.getDesignHead() : file.getDesigner());
            if (designIdentityChanged) invalidateDesignHeadApproval(file);
        } else if (file.getCurrentOwner() == null) {
            file.setCurrentOwner(file.getDesigner());
        }

        file.setUpdatedBy(accessService.actor());
        refreshHealth(file);
        fileRepository.save(file);
        auditService.log("PRODUCTION_FILE", file.getId(), "FILE_SETUP_UPDATED", file,
                auditService.details("designer1", file.getDesigner(), "designHead", file.getDesignHead(),
                        "ppcOwner", file.getPpcOwner(), "engineeringHead", file.getEngineeringHead(),
                        "assignedEngineer", file.getAssignedEngineer()));
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
        if (type == WorkItemType.DESIGN_CHECK && next == WorkItemStatus.NOT_APPLICABLE && clean(request.remarks()) == null) {
            throw badRequest("Reason is required when a Design checklist item is Not Applicable");
        }
        if (type == WorkItemType.DESIGN_CHECK) invalidateDesignHeadApproval(file);
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
    public ProductionFileDetailResponse createDesignTask(UUID fileId, DesignTaskCreateRequest request) {
        accessService.requireDesignHeadWrite();
        MatFlowProductionFile file = requireFile(fileId);
        requireDesignStage(file);
        if (clean(file.getDesigner()) == null) throw conflict("Assign Designer-1 before delegating Design tasks");
        if (clean(file.getDesignHead()) == null) throw conflict("Assign the Design Head before delegating Design tasks");

        List<String> assignees = normalizeAssignees(request.assignees());
        if (assignees.isEmpty()) throw badRequest("Assign at least one Designer-2 / Design team member");
        LocalDateTime received = request.receivedAt() == null ? now() : request.receivedAt();
        if (request.dueAt() != null && request.dueAt().isBefore(received)) throw badRequest("Due date cannot be before received date");

        MatFlowDesignTask row = new MatFlowDesignTask();
        row.setProductionFile(file);
        row.setTaskNo(nextDesignTaskNo(file));
        row.setTaskType(enumValue(DesignTaskType.class, request.taskType(), "Invalid Design task type"));
        row.setTitle(request.title());
        row.setDescription(request.description());
        row.setDesigner1(file.getDesigner());
        row.setAssignedBy(accessService.actor());
        row.setAssignees(assignees);
        row.setStatus(DesignTaskStatus.ASSIGNED);
        row.setPriority(request.priority());
        row.setBlocking(request.blocking() == null || request.blocking());
        row.setReceivedAt(received);
        row.setDueAt(request.dueAt());
        row.setRemarks(request.remarks());
        row.setCreatedBy(accessService.actor());
        row.setUpdatedBy(accessService.actor());
        row = designTaskRepository.save(row);

        invalidateDesignHeadApproval(file);
        file.setCurrentDepartment("DESIGN");
        file.setCurrentOwner(file.getDesignHead());
        file.setUpdatedBy(accessService.actor());
        refreshHealth(file);
        fileRepository.save(file);
        auditService.log("DESIGN_TASK", row.getId(), "DESIGN_TASK_CREATED", file,
                auditService.details("taskNo", row.getTaskNo(), "taskType", row.getTaskType().name(),
                        "designer1", row.getDesigner1(), "assignees", row.getAssignees(), "dueAt", row.getDueAt()));
        return toDetail(file);
    }

    @Transactional
    public ProductionFileDetailResponse updateDesignTask(UUID fileId, UUID taskId, DesignTaskUpdateRequest request) {
        accessService.requireDesignHeadWrite();
        MatFlowProductionFile file = requireFile(fileId);
        requireDesignStage(file);
        MatFlowDesignTask row = requireDesignTask(fileId, taskId);
        requireVersion(row.getRowVersion(), request.rowVersion());
        if (Set.of(DesignTaskStatus.DONE, DesignTaskStatus.CANCELLED).contains(row.getStatus())) {
            throw conflict("Completed/Cancelled Design tasks are historical. Create a follow-up or Revision task instead.");
        }

        if (request.taskType() != null) row.setTaskType(enumValue(DesignTaskType.class, request.taskType(), "Invalid Design task type"));
        if (request.title() != null) {
            if (clean(request.title()) == null) throw badRequest("Design task title cannot be blank");
            row.setTitle(request.title());
        }
        if (request.description() != null) row.setDescription(request.description());
        if (request.assignees() != null) {
            List<String> assignees = normalizeAssignees(request.assignees());
            row.setAssignees(assignees);
            if (assignees.isEmpty() && row.getStatus() != DesignTaskStatus.DONE && row.getStatus() != DesignTaskStatus.CANCELLED) row.setStatus(DesignTaskStatus.NEED_TO_START);
            else if (!assignees.isEmpty() && row.getStatus() == DesignTaskStatus.NEED_TO_START) row.setStatus(DesignTaskStatus.ASSIGNED);
        }
        if (request.receivedAt() != null) row.setReceivedAt(request.receivedAt());
        if (request.dueAt() != null || request.receivedAt() != null) row.setDueAt(request.dueAt());
        if (row.getDueAt() != null && row.getReceivedAt() != null && row.getDueAt().isBefore(row.getReceivedAt())) throw badRequest("Due date cannot be before received date");
        if (request.priority() != null) row.setPriority(request.priority());
        if (request.blocking() != null) row.setBlocking(request.blocking());
        if (request.remarks() != null) row.setRemarks(request.remarks());
        row.setUpdatedBy(accessService.actor());
        designTaskRepository.save(row);

        invalidateDesignHeadApproval(file);
        file.setUpdatedBy(accessService.actor());
        refreshHealth(file);
        fileRepository.save(file);
        auditService.log("DESIGN_TASK", row.getId(), "DESIGN_TASK_UPDATED", file,
                auditService.details("taskNo", row.getTaskNo(), "assignees", row.getAssignees(), "blocking", row.isBlocking()));
        return toDetail(file);
    }

    @Transactional
    public ProductionFileDetailResponse setDesignTaskStatus(UUID fileId, UUID taskId, DesignTaskStatusRequest request) {
        accessService.requireDesignTaskWrite();
        MatFlowProductionFile file = requireFile(fileId);
        requireDesignStage(file);
        MatFlowDesignTask row = requireDesignTask(fileId, taskId);
        requireVersion(row.getRowVersion(), request.rowVersion());
        DesignTaskStatus next = enumValue(DesignTaskStatus.class, request.status(), "Invalid Design task status");
        requireDesignTaskTransition(row.getStatus(), next);
        if (next == DesignTaskStatus.CANCELLED) accessService.requireDesignHeadWrite();
        String note = clean(request.note());
        if ((next == DesignTaskStatus.HOLD || next == DesignTaskStatus.CANCELLED) && note == null) {
            throw badRequest("Reason is required for Hold or Cancelled Design tasks");
        }
        if (next != DesignTaskStatus.NEED_TO_START && next != DesignTaskStatus.CANCELLED && row.getAssignees().isEmpty()) {
            throw conflict("Assign at least one Designer-2 before starting this task");
        }

        if ((next == DesignTaskStatus.WORKING || next == DesignTaskStatus.DONE) && row.getStartedAt() == null) row.setStartedAt(now());
        row.setStatus(next);
        if (next == DesignTaskStatus.HOLD) row.setHoldReason(note);
        else if (next != DesignTaskStatus.HOLD) row.setHoldReason(null);
        if (next == DesignTaskStatus.DONE || next == DesignTaskStatus.CANCELLED) {
            if (next == DesignTaskStatus.CANCELLED) row.setBlocking(false);
            row.setCompletedAt(now());
            row.setCompletedBy(accessService.actor());
            if (note != null) row.setRemarks(note);
        } else {
            row.setCompletedAt(null);
            row.setCompletedBy(null);
        }
        if (next == DesignTaskStatus.NEED_TO_START) row.setStartedAt(null);
        row.setUpdatedBy(accessService.actor());
        designTaskRepository.save(row);

        invalidateDesignHeadApproval(file);
        file.setUpdatedBy(accessService.actor());
        refreshHealth(file);
        fileRepository.save(file);
        auditService.log("DESIGN_TASK", row.getId(), "DESIGN_TASK_STATUS_CHANGED", file,
                auditService.details("taskNo", row.getTaskNo(), "status", next.name(), "note", note));
        return toDetail(file);
    }

    @Transactional
    public ProductionFileDetailResponse designHeadReview(UUID fileId, DesignHeadReviewRequest request) {
        accessService.requireDesignHeadWrite();
        MatFlowProductionFile file = requireFile(fileId);
        requireVersion(file.getRowVersion(), request.rowVersion());
        requireDesignStage(file);
        String decision = upper(request.decision());
        if (!Set.of("APPROVE", "RETURN").contains(decision)) throw badRequest("Design Head decision must be APPROVE or RETURN");

        if ("RETURN".equals(decision)) {
            if (clean(request.remarks()) == null) throw badRequest("Return remarks are required");
            file.setDesignHeadDecision("RETURNED");
        } else {
            List<String> blockers = designReviewBlockers(file);
            if (!blockers.isEmpty()) throw conflict("Design Head approval is blocked: " + String.join("; ", blockers));
            ChecklistProgress checklist = progress(fileId, WorkItemType.DESIGN_CHECK);
            if (checklist.requiredPending() > 0 && clean(request.remarks()) == null) {
                throw badRequest("Review remarks are required when Design checklist items remain pending");
            }
            file.setDesignHeadDecision("APPROVED");
        }
        file.setDesignHeadReviewedBy(accessService.actor());
        file.setDesignHeadReviewedAt(now());
        file.setDesignHeadRemarks(request.remarks());
        file.setCurrentDepartment("DESIGN");
        file.setCurrentOwner(file.getDesignHead());
        file.setUpdatedBy(accessService.actor());
        refreshHealth(file);
        fileRepository.save(file);
        auditService.log("PRODUCTION_FILE", file.getId(), "DESIGN_HEAD_" + decision, file,
                auditService.details("remarks", request.remarks(), "designHead", file.getDesignHead()));
        return toDetail(file);
    }

    @Transactional
    public ProductionFileDetailResponse submitDesign(UUID fileId, DesignSubmitRequest request) {
        accessService.requireDesignHeadWrite();
        MatFlowProductionFile file = requireFile(fileId);
        requireVersion(file.getRowVersion(), request.rowVersion());
        requireDesignStage(file);
        List<String> handoffBlockers = designHandoffBlockers(file);
        if (!handoffBlockers.isEmpty()) throw conflict("Design handoff is blocked: " + String.join("; ", handoffBlockers));

        ChecklistProgress progress = progress(fileId, WorkItemType.DESIGN_CHECK);
        ReleaseHealth health = releaseHealth(progress);
        if (health == ReleaseHealth.RED) throw conflict("Design cannot be submitted: critical information is still pending");
        if (health == ReleaseHealth.AMBER && clean(request.controlledReleaseReason()) == null) {
            throw badRequest("Controlled Release reason is mandatory for AMBER submission");
        }
        if (clean(file.getPpcOwner()) == null) throw conflict("Assign the PPC owner before Designer submission");

        file.setControlledReleaseReason(health == ReleaseHealth.AMBER ? request.controlledReleaseReason() : null);
        file.setReleaseHealth(health);
        file.setStage(ProductionFileStage.PPC_GATE_1);
        file.setCurrentDepartment("PPC");
        file.setCurrentOwner(file.getPpcOwner());
        file.setDesignSubmittedBy(accessService.actor());
        file.setDesignSubmittedAt(now());
        file.setUpdatedBy(accessService.actor());
        fileRepository.save(file);
        auditService.log("PRODUCTION_FILE", file.getId(), "DESIGN_SUBMITTED", file,
                auditService.details("health", health.name(), "controlledReleaseReason", file.getControlledReleaseReason(),
                        "designHeadReviewedBy", file.getDesignHeadReviewedBy()));
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
            file.setStage(ProductionFileStage.DESIGN_CLARIFICATION); file.setCurrentDepartment("DESIGN");
            file.setCurrentOwner(clean(file.getDesignHead()) != null ? file.getDesignHead() : file.getDesigner());
            invalidateDesignHeadApproval(file);
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
        item.setDisplayOrder((int) (openQueryCount(fileId) + 1)); item.setCreatedBy(accessService.actor()); item.setUpdatedBy(accessService.actor()); item = workRepository.save(item);
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
        item.setStatus(clean(taskOwner)==null?WorkItemStatus.TODO:WorkItemStatus.ASSIGNED); item.setCreatedBy(accessService.actor()); item.setUpdatedBy(accessService.actor()); item = workRepository.save(item);
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
        boolean impact=requiresImpactReview(file,type); row.setRevisionStatus(impact?RevisionStatus.PENDING_IMPACT_REVIEW:RevisionStatus.ACTIVE); if(!impact)row.setActivatedAt(now()); row = revisionRepository.save(row);
        if(impact){ file.setRevisionReviewRequired(true); file.setStage(ProductionFileStage.REVISION_REVIEW); file.setCurrentDepartment("ENGINEERING"); file.setCurrentOwner(file.getEngineeringHead()); }
        else {
            activateRevision(file,row,false);
            if (type == RevisionType.DESIGN_DRAWING && isDesignStage(file)) invalidateDesignHeadApproval(file);
        }
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
        else { file.setStage(ProductionFileStage.DESIGN_DRAFT); file.setCurrentDepartment("DESIGN"); file.setCurrentOwner(clean(file.getDesignHead()) != null ? file.getDesignHead() : file.getDesigner()); }
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
        ChecklistProgress dp = progress(file.getId(), WorkItemType.DESIGN_CHECK);
        ReleaseHealth health = releaseHealth(dp);
        if (isDesignStage(file) && !designHandoffBlockers(file).isEmpty()) {
            health = ReleaseHealth.RED;
        } else if(file.isRevisionReviewRequired()||openQueryCount(file.getId())>0) {
            health=ReleaseHealth.RED;
        } else if(file.getEngineeringDecision()==EngineeringDecision.APPROVED && !gate2BlockersWithoutRecursion(file).isEmpty() && health==ReleaseHealth.GREEN) {
            health=ReleaseHealth.AMBER;
        }
        if(file.getStage()==ProductionFileStage.PRODUCTION_RELEASED && !file.isRevisionReviewRequired()) health=ReleaseHealth.GREEN;
        file.setReleaseHealth(health);
    }

    private List<String> designReviewBlockers(MatFlowProductionFile file) {
        List<String> blockers = new ArrayList<>();
        if (clean(file.getDesigner()) == null) blockers.add("Designer-1 is not assigned");
        if (clean(file.getDesignHead()) == null) blockers.add("Design Head is not assigned");
        List<MatFlowDesignTask> tasks = designTasks(file.getId());
        if (tasks.isEmpty()) blockers.add("No Design task has been delegated");
        List<MatFlowDesignTask> pending = tasks.stream().filter(MatFlowDesignTask::isBlocking)
                .filter(task -> task.getStatus() != DesignTaskStatus.DONE).toList();
        if (!pending.isEmpty()) blockers.add("Blocking Design tasks pending: " + pending.stream().map(MatFlowDesignTask::getTitle).limit(4).reduce((a,b)->a+", "+b).orElse("pending"));
        ChecklistProgress checklist = progress(file.getId(), WorkItemType.DESIGN_CHECK);
        if (checklist.criticalPending() > 0) blockers.add("Critical Design checklist items are pending");
        if (activeRevision(file.getId(), RevisionType.DESIGN_DRAWING) == null) blockers.add("Active Design Drawing revision is missing");
        return blockers;
    }

    private List<String> designHandoffBlockers(MatFlowProductionFile file) {
        List<String> blockers = new ArrayList<>(designReviewBlockers(file));
        if (!"APPROVED".equalsIgnoreCase(file.getDesignHeadDecision())) blockers.add("Design Head approval is pending");
        return blockers;
    }

    private List<String> gate2BlockersWithoutRecursion(MatFlowProductionFile file){
        List<String>b=new ArrayList<>(); if(file.getEngineeringDecision()!=EngineeringDecision.APPROVED)b.add("engineering"); if(openQueryCount(file.getId())>0)b.add("query");
        if(file.getEngineeringDecision()==EngineeringDecision.APPROVED&&!allBlockingTasksDone(file.getId()))b.add("tasks"); MatFlowBom bom=latestBom(file.getId()); if(file.getEngineeringDecision()==EngineeringDecision.APPROVED&&(bom==null||bom.getStatus()!=BomStatus.READY_FOR_RELEASE))b.add("bom"); return b;
    }

    private ReleaseHealth releaseHealth(ChecklistProgress p){ if(p.criticalPending()>0)return ReleaseHealth.RED; if(p.requiredPending()>0)return ReleaseHealth.AMBER; return ReleaseHealth.GREEN; }
    private ChecklistProgress progress(UUID fileId, WorkItemType type){
        List<MatFlowWorkItem> rows=items(fileId,type).stream().filter(x->x.getStatus()!=WorkItemStatus.CANCELLED).toList(); int complete=(int)rows.stream().filter(x->x.getStatus()==WorkItemStatus.COMPLETE).count(); int na=(int)rows.stream().filter(x->x.getStatus()==WorkItemStatus.NOT_APPLICABLE).count(); int pending=rows.size()-complete-na;
        int critical=(int)rows.stream().filter(x->x.getCriticality()==Criticality.CRITICAL&&!Set.of(WorkItemStatus.COMPLETE,WorkItemStatus.NOT_APPLICABLE).contains(x.getStatus())).count(); int required=(int)rows.stream().filter(x->x.getCriticality()==Criticality.REQUIRED&&!Set.of(WorkItemStatus.COMPLETE,WorkItemStatus.NOT_APPLICABLE).contains(x.getStatus())).count(); int percent=rows.isEmpty()?0:(int)Math.round(((complete+na)*100.0)/rows.size()); return new ChecklistProgress(rows.size(),complete,na,pending,critical,required,percent);
    }

    private ProductionFileDetailResponse toDetail(MatFlowProductionFile file){
        List<String> designBlockers = designHandoffBlockers(file);
        List<String> gate2 = gate2Blockers(file);
        return new ProductionFileDetailResponse(
                toFileResponse(file),
                mapItems(items(file.getId(),WorkItemType.DESIGN_CHECK).stream().filter(x->x.getStatus()!=WorkItemStatus.CANCELLED).toList()),
                designTasks(file.getId()).stream().map(this::toDesignTask).toList(),
                mapItems(items(file.getId(),WorkItemType.ENGINEERING_CHECK)),
                mapItems(items(file.getId(),WorkItemType.ENGINEERING_QUERY)),
                mapItems(items(file.getId(),WorkItemType.ENGINEERING_TASK)),
                revisionRepository.findByProductionFile_IdOrderByCreatedAtDesc(file.getId()).stream().map(this::toRevision).toList(),
                auditService.timeline(file.getId()).stream().map(this::toAudit).toList(),
                designBlockers.isEmpty(), designBlockers, gate2.isEmpty(), gate2);
    }

    private ProductionFileResponse toFileResponse(MatFlowProductionFile file){
        List<MatFlowWorkItem> tasks=items(file.getId(),WorkItemType.ENGINEERING_TASK);
        int completed=(int)tasks.stream().filter(x->Set.of(WorkItemStatus.COMPLETE,WorkItemStatus.NOT_APPLICABLE).contains(x.getStatus())).count();
        int pending=tasks.size()-completed;
        MatFlowBom bom=latestBom(file.getId());
        return new ProductionFileResponse(
                file.getId(),file.getProductionFileNo(),file.getProject().getId(),file.getProduct().getId(),file.getProjectCode(),file.getProjectName(),file.getClientName(),file.getProductName(),file.getDrawingNo(),file.getPlantCode(),
                file.getStage().name(),file.getReleaseHealth().name(),file.getEngineeringDecision().name(),file.getCurrentDepartment(),file.getCurrentOwner(),
                file.getDesigner(),file.getDesignHead(),file.getDesignHeadDecision(),file.getDesignHeadReviewedBy(),file.getDesignHeadReviewedAt(),file.getDesignHeadRemarks(),
                file.getPpcOwner(),file.getEngineeringHead(),file.getAssignedEngineer(),file.getControlledReleaseReason(),file.getPlannedProductionReleaseDate(),file.getPlannedDispatchDate(),
                file.getPpcGate1Decision(),file.getPpcGate2Decision(),file.isRevisionReviewRequired(),file.getDownstreamWorkflowKey(),file.getDownstreamWorkflowStatus(),file.getProductionReleasedAt(),file.getProjectCode(),
                progress(file.getId(),WorkItemType.DESIGN_CHECK),designTaskProgress(file.getId()),progress(file.getId(),WorkItemType.ENGINEERING_CHECK),
                (int)openQueryCount(file.getId()),pending,completed,bom==null?null:bom.getId(),bom==null?null:bom.getStatus().name(),file.getRowVersion(),file.getUpdatedAt());
    }

    private DesignTaskResponse toDesignTask(MatFlowDesignTask x) {
        return new DesignTaskResponse(x.getId(),x.getTaskNo(),x.getTaskType().name(),x.getTitle(),x.getDescription(),x.getDesigner1(),x.getAssignedBy(),
                List.copyOf(x.getAssignees()),x.getStatus().name(),x.getPriority(),x.isBlocking(),x.getReceivedAt(),x.getDueAt(),x.getStartedAt(),x.getCompletedAt(),
                x.getCompletedBy(),x.getHoldReason(),x.getRemarks(),x.getRowVersion(),x.getCreatedAt(),x.getUpdatedAt());
    }

    private DesignTaskQueueResponse toDesignTaskQueue(MatFlowDesignTask task) {
        MatFlowProductionFile file = task.getProductionFile();
        return new DesignTaskQueueResponse(toDesignTask(task), file.getId(), file.getProductionFileNo(),
                file.getProjectCode(), file.getProjectName(), file.getClientName(), file.getProductName(),
                file.getDrawingNo(), file.getStage().name(), file.getReleaseHealth().name(), file.getDesignHead());
    }

    private boolean designTaskContains(MatFlowDesignTask task, String q) {
        MatFlowProductionFile file = task.getProductionFile();
        return contains(task.getTaskNo(), q) || contains(task.getTitle(), q) || contains(task.getDescription(), q)
                || contains(task.getDesigner1(), q) || task.getAssignees().stream().anyMatch(value -> contains(value, q))
                || contains(file.getProjectCode(), q) || contains(file.getProjectName(), q) || contains(file.getClientName(), q)
                || contains(file.getProductName(), q) || contains(file.getDrawingNo(), q);
    }

    private DesignTaskProgress designTaskProgress(UUID fileId) {
        List<MatFlowDesignTask> rows = designTasks(fileId);
        int need=(int)rows.stream().filter(x->x.getStatus()==DesignTaskStatus.NEED_TO_START).count();
        int assigned=(int)rows.stream().filter(x->x.getStatus()==DesignTaskStatus.ASSIGNED).count();
        int working=(int)rows.stream().filter(x->x.getStatus()==DesignTaskStatus.WORKING).count();
        int hold=(int)rows.stream().filter(x->x.getStatus()==DesignTaskStatus.HOLD).count();
        int done=(int)rows.stream().filter(x->x.getStatus()==DesignTaskStatus.DONE).count();
        int cancelled=(int)rows.stream().filter(x->x.getStatus()==DesignTaskStatus.CANCELLED).count();
        int overdue=(int)rows.stream().filter(x->x.getDueAt()!=null&&x.getDueAt().isBefore(now())&&!Set.of(DesignTaskStatus.DONE,DesignTaskStatus.CANCELLED).contains(x.getStatus())).count();
        int denominator=Math.max(0,rows.size()-cancelled);
        int percent=denominator==0?0:(int)Math.round(done*100.0/denominator);
        return new DesignTaskProgress(rows.size(),need,assigned,working,hold,done,cancelled,overdue,percent);
    }

    private List<WorkItemResponse> mapItems(List<MatFlowWorkItem> rows){ return rows.stream().map(this::toWork).toList(); }
    private WorkItemResponse toWork(MatFlowWorkItem x){ return new WorkItemResponse(x.getId(),x.getItemType().name(),x.getItemKey(),x.getSection(),x.getTitle(),x.getDescription(),x.getCriticality().name(),x.isBlocking(),x.getDisplayOrder(),x.getStatus().name(),x.getAssignedTo(),x.getDueAt(),x.getStartedAt(),x.getRevisionContext(),x.getPriority(),x.getResponseText(),x.getRemarks(),x.getCompletionNote(),x.getCompletedBy(),x.getCompletedAt(),x.getRespondedBy(),x.getRespondedAt(),x.getClosedBy(),x.getClosedAt(),x.getRowVersion(),x.getUpdatedAt()); }
    private RevisionResponse toRevision(MatFlowRevision x){ return new RevisionResponse(x.getId(),x.getRevisionType().name(),x.getRevisionNo(),x.getRevisionStatus().name(),x.getOriginalFileName(),x.getContentType(),x.getSizeBytes()==null?0:x.getSizeBytes(),x.getChangeSummary(),x.getImpactNote(),x.getImpactReviewedBy(),x.getImpactReviewedAt(),x.getActivatedAt(),x.getRowVersion(),x.getCreatedAt()); }
    private AuditEventResponse toAudit(MatFlowAuditLog x){ return new AuditEventResponse(x.getEntityType(),x.getEntityId(),x.getAction(),x.getActor(),x.getActionAt(),x.getDetailsJson()); }

    private List<MatFlowDesignTask> designTasks(UUID fileId) {
        return designTaskRepository.findByProductionFile_IdOrderByReceivedAtAscCreatedAtAsc(fileId);
    }

    private MatFlowDesignTask requireDesignTask(UUID fileId, UUID taskId) {
        MatFlowDesignTask row = designTaskRepository.findById(taskId).orElseThrow(() -> notFound("Design task not found"));
        if (row.getProductionFile() == null || !fileId.equals(row.getProductionFile().getId())) throw notFound("Design task not found in this Production File");
        return row;
    }

    private List<String> normalizeAssignees(Collection<String> values) {
        if (values == null) return List.of();
        LinkedHashSet<String> result = new LinkedHashSet<>();
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        for (String value : values) {
            String clean = clean(value);
            if (clean == null) continue;
            String key = clean.toLowerCase(Locale.ROOT);
            if (seen.add(key)) result.add(clean);
            if (result.size() >= 12) break;
        }
        return List.copyOf(result);
    }

    private String nextDesignTaskNo(MatFlowProductionFile file) {
        long next = designTaskRepository.countByProductionFile_Id(file.getId()) + 1;
        String base = ("DT-" + file.getProductionFileNo()).toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9._-]+", "-");
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 4).toUpperCase(Locale.ROOT);
        return base + "-" + String.format("%03d", next) + "-" + suffix;
    }

    private void requireDesignTaskTransition(DesignTaskStatus current, DesignTaskStatus next) {
        if (current == next) return;
        if (Set.of(DesignTaskStatus.DONE, DesignTaskStatus.CANCELLED).contains(current)) {
            throw conflict("Completed/Cancelled Design task cannot be reopened. Create a follow-up or Revision task.");
        }
        boolean allowed = switch (current) {
            case NEED_TO_START -> Set.of(DesignTaskStatus.ASSIGNED, DesignTaskStatus.CANCELLED).contains(next);
            case ASSIGNED -> Set.of(DesignTaskStatus.WORKING, DesignTaskStatus.HOLD, DesignTaskStatus.DONE, DesignTaskStatus.CANCELLED).contains(next);
            case WORKING -> Set.of(DesignTaskStatus.HOLD, DesignTaskStatus.DONE, DesignTaskStatus.CANCELLED).contains(next);
            case HOLD -> Set.of(DesignTaskStatus.WORKING, DesignTaskStatus.DONE, DesignTaskStatus.CANCELLED).contains(next);
            case DONE, CANCELLED -> false;
        };
        if (!allowed) throw conflict("Design task cannot move from " + current + " to " + next);
    }

    private boolean isDesignStage(MatFlowProductionFile file) {
        return file != null && Set.of(ProductionFileStage.DESIGN_DRAFT, ProductionFileStage.DESIGN_CLARIFICATION).contains(file.getStage());
    }

    private void requireDesignStage(MatFlowProductionFile file) {
        requireStage(file, ProductionFileStage.DESIGN_DRAFT, ProductionFileStage.DESIGN_CLARIFICATION);
    }

    private void invalidateDesignHeadApproval(MatFlowProductionFile file) {
        if (!isDesignStage(file)) return;
        if (!"PENDING".equalsIgnoreCase(file.getDesignHeadDecision())) {
            file.setDesignHeadDecision("PENDING");
            file.setDesignHeadReviewedBy(null);
            file.setDesignHeadReviewedAt(null);
            file.setDesignHeadRemarks(null);
        }
    }

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
