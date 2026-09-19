package com.alsorg.packing.service.matflow;

import static com.alsorg.packing.controller.dto.matflow.MatFlowDesignProjectDtos.*;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.ProductionFileStage;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.ReleaseHealth;
import com.alsorg.packing.domain.matflow.MatFlowDesignProjectWork;
import com.alsorg.packing.domain.matflow.MatFlowProductionFile;
import com.alsorg.packing.domain.matflow.MatFlowProject;
import com.alsorg.packing.domain.matflow.MatFlowProjectDrawing;
import com.alsorg.packing.repository.matflow.MatFlowDesignProjectWorkRepository;
import com.alsorg.packing.repository.matflow.MatFlowProductionFileRepository;
import com.alsorg.packing.repository.matflow.MatFlowProjectDrawingRepository;
import com.alsorg.packing.repository.matflow.MatFlowProjectRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Project/PD-level Design execution.
 *
 * A Project is assigned once to Design and owns one shared Production File.
 * Products are internal Design subtasks (TODO / WIP / DONE). The whole Project
 * moves to PPC Gate 1 only after the Design Head has locked/approved the PD work.
 */
@Service
public class MatFlowDesignProjectService {
    private static final Set<ProductionFileStage> DESIGN_STAGES = Set.of(
            ProductionFileStage.DESIGN_DRAFT,
            ProductionFileStage.DESIGN_CLARIFICATION);
    private static final Set<String> PRODUCT_PROGRESS = Set.of("TODO", "WIP", "DONE");
    private static final Set<String> CHECKLIST_STATUSES = Set.of("PENDING", "COMPLETE", "NOT_APPLICABLE");
    private static final int MAX_ACTIVITY_LOGS = 250;

    private final MatFlowDesignProjectWorkRepository repository;
    private final MatFlowProjectRepository projectRepository;
    private final MatFlowProjectDrawingRepository productRepository;
    private final MatFlowProductionFileRepository fileRepository;
    private final MatFlowAccessService accessService;
    private final MatFlowAuditService auditService;
    private final MatFlowWorkflowTemplateService templateService;
    private final ObjectMapper objectMapper;

    public MatFlowDesignProjectService(
            MatFlowDesignProjectWorkRepository repository,
            MatFlowProjectRepository projectRepository,
            MatFlowProjectDrawingRepository productRepository,
            MatFlowProductionFileRepository fileRepository,
            MatFlowAccessService accessService,
            MatFlowAuditService auditService,
            MatFlowWorkflowTemplateService templateService,
            ObjectMapper objectMapper) {
        this.repository = repository;
        this.projectRepository = projectRepository;
        this.productRepository = productRepository;
        this.fileRepository = fileRepository;
        this.accessService = accessService;
        this.auditService = auditService;
        this.templateService = templateService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public List<DesignProjectResponse> list(String plantCode, String search, String assignee, String status) {
        accessService.requireDesignRead();
        String plant = upperOrNull(plantCode);
        if (plant != null) accessService.requirePlantAccess(plant);
        String q = lower(search);
        String assignedFilter = clean(assignee);
        String statusFilter = upperOrNull(status);
        boolean juniorOnly = accessService.isJuniorDesignerOnly();
        String actor = accessService.actor();

        Map<UUID, MatFlowDesignProjectWork> workByProject = new LinkedHashMap<>();
        for (MatFlowDesignProjectWork work : repository.findAll()) {
            if (work.getProject() != null && work.getProject().getId() != null) {
                workByProject.put(work.getProject().getId(), work);
            }
        }

        Map<UUID, List<MatFlowProjectDrawing>> productsByProject = new LinkedHashMap<>();
        for (MatFlowProjectDrawing product : productRepository.findAll()) {
            if (product.getProject() == null || product.getProject().getId() == null) continue;
            productsByProject.computeIfAbsent(product.getProject().getId(), ignored -> new ArrayList<>()).add(product);
        }
        for (List<MatFlowProjectDrawing> products : productsByProject.values()) {
            products.sort(Comparator.comparing(MatFlowProjectDrawing::getCreatedAt,
                    Comparator.nullsLast(Comparator.naturalOrder())));
        }

        Map<UUID, MatFlowProductionFile> fileByProject = canonicalFilesByProject();

        List<DesignProjectResponse> result = new ArrayList<>();
        for (MatFlowProject project : projectRepository.findAllByOrderByUpdatedAtDesc()) {
            if (!project.isActive() || !accessService.canAccessPlant(project.getPlantCode())) continue;
            if (plant != null && !plant.equalsIgnoreCase(project.getPlantCode())) continue;

            MatFlowDesignProjectWork work = workByProject.get(project.getId());
            if (work == null) {
                // Compatibility fallback only. New Projects are initialized at creation.
                work = ensure(project, false);
                workByProject.put(project.getId(), work);
            }
            if (juniorOnly && !same(work.getAssignedJunior(), actor)) continue;
            if (assignedFilter != null && !same(work.getAssignedJunior(), assignedFilter)) continue;

            DesignProjectResponse response = toResponse(
                    project,
                    work,
                    productsByProject.getOrDefault(project.getId(), List.of()),
                    fileByProject.get(project.getId()));
            if (statusFilter != null && !statusFilter.equalsIgnoreCase(response.status())) continue;
            if (q != null && !containsDesignProject(response, q)) continue;
            result.add(response);
        }

        result.sort(Comparator
                .comparingInt((DesignProjectResponse row) -> statusRank(row.status()))
                .thenComparing(DesignProjectResponse::overdue, Comparator.reverseOrder())
                .thenComparing(DesignProjectResponse::dueAt, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(DesignProjectResponse::updatedAt, Comparator.nullsLast(Comparator.reverseOrder())));
        return result;
    }

    @Transactional
    public DesignProjectResponse get(UUID projectId) {
        accessService.requireDesignRead();
        MatFlowProject project = requireProject(projectId);
        accessService.requirePlantAccess(project.getPlantCode());
        MatFlowDesignProjectWork work = ensure(project, false);
        requireJuniorVisibility(work);
        return toResponse(project, work);
    }

    /** Internal read-only snapshot for dashboard/insight aggregation; never creates workspace state. */
    @Transactional(readOnly = true)
    public DesignProjectResponse findExisting(UUID projectId) {
        if (projectId == null) return null;
        MatFlowProject project = projectRepository.findById(projectId).orElse(null);
        MatFlowDesignProjectWork work = repository.findByProject_Id(projectId).orElse(null);
        if (project == null || work == null || !work.isWorkflowEnabled()) return null;
        return toResponse(project, work);
    }

    /**
     * Batch snapshot used by dashboard/insight aggregation. It performs one read of
     * Design work, Products and canonical Project Production Files instead of one
     * repository round-trip per PD.
     */
    @Transactional(readOnly = true)
    public Map<UUID, DesignProjectResponse> findExistingForProjects(Set<UUID> projectIds) {
        if (projectIds == null || projectIds.isEmpty()) return Map.of();

        Map<UUID, MatFlowProject> projects = new LinkedHashMap<>();
        for (MatFlowProject project : projectRepository.findAllById(projectIds)) {
            projects.put(project.getId(), project);
        }

        Map<UUID, MatFlowDesignProjectWork> workByProject = new LinkedHashMap<>();
        for (MatFlowDesignProjectWork work : repository.findAll()) {
            if (work.getProject() == null || work.getProject().getId() == null || !work.isWorkflowEnabled()) continue;
            UUID projectId = work.getProject().getId();
            if (projectIds.contains(projectId)) workByProject.put(projectId, work);
        }

        Map<UUID, List<MatFlowProjectDrawing>> productsByProject = new LinkedHashMap<>();
        for (MatFlowProjectDrawing product : productRepository.findAll()) {
            if (product.getProject() == null || product.getProject().getId() == null) continue;
            UUID projectId = product.getProject().getId();
            if (projectIds.contains(projectId)) {
                productsByProject.computeIfAbsent(projectId, ignored -> new ArrayList<>()).add(product);
            }
        }
        for (List<MatFlowProjectDrawing> products : productsByProject.values()) {
            products.sort(Comparator.comparing(MatFlowProjectDrawing::getCreatedAt,
                    Comparator.nullsLast(Comparator.naturalOrder())));
        }

        Map<UUID, MatFlowProductionFile> fileByProject = canonicalFilesByProject();
        Map<UUID, DesignProjectResponse> result = new LinkedHashMap<>();
        for (UUID projectId : projectIds) {
            MatFlowProject project = projects.get(projectId);
            MatFlowDesignProjectWork work = workByProject.get(projectId);
            if (project == null || work == null) continue;
            result.put(projectId, toResponse(
                    project,
                    work,
                    productsByProject.getOrDefault(projectId, List.of()),
                    fileByProject.get(projectId)));
        }
        return Map.copyOf(result);
    }

    /** New Projects enter the PD-level Design model immediately. */
    @Transactional
    public void initializeNewProject(MatFlowProject project) {
        if (project == null || project.getId() == null) return;
        MatFlowDesignProjectWork work = ensure(project, true);
        if (!work.isWorkflowEnabled()) {
            work.setWorkflowEnabled(true);
            work.setUpdatedBy(safeActor());
            repository.save(work);
        }
    }

    @Transactional
    public DesignProjectResponse assign(UUID projectId, AssignmentRequest request) {
        accessService.requireDesignHeadWrite();
        MatFlowProject project = requireProject(projectId);
        accessService.requirePlantAccess(project.getPlantCode());
        MatFlowDesignProjectWork work = ensure(project, true);
        requireVersion(work.getRowVersion(), request.rowVersion());
        MatFlowProductionFile file = canonicalFile(projectId);
        requireDesignStage(file, "Assignment can be changed only while the whole Project / PD is inside Design");
        String junior = clean(request.assignedJunior());
        if (junior == null) throw badRequest("Select the Junior Designer / Design team member who owns this Project / PD");

        String previous = work.getAssignedJunior();
        work.setWorkflowEnabled(true);
        work.setAssignedJunior(junior);
        work.setAssignedBy(accessService.actor());
        work.setAssignedAt(now());
        work.setDueAt(request.dueAt());
        work.setBrief(request.brief());
        work.setUpdatedBy(accessService.actor());
        repository.save(work);

        project.setDesigner1(junior);
        project.setUpdatedBy(accessService.actor());
        projectRepository.save(project);

        file.setDesigner(junior);
        file.setDesignHead(project.getDesignHead());
        if (DESIGN_STAGES.contains(file.getStage())) {
            file.setCurrentDepartment("DESIGN");
            file.setCurrentOwner(junior);
        }
        invalidateDesignHeadApproval(file);
        file.setUpdatedBy(accessService.actor());
        fileRepository.save(file);

        appendLog(work, "ASSIGNMENT", previous == null
                ? "Project / PD assigned to " + junior
                : "Project / PD reassigned from " + previous + " to " + junior, accessService.actor());
        repository.save(work);
        auditService.log("PROJECT", projectId, "DESIGN_PD_ASSIGNED", file,
                auditService.details("assignedJunior", junior, "previousAssignee", previous,
                        "dueAt", request.dueAt(), "brief", request.brief()));
        return toResponse(project, work);
    }

    @Transactional
    public DesignProjectResponse updateChecklist(UUID projectId, String itemKey, ChecklistUpdateRequest request) {
        accessService.requireDesignHeadWrite();
        MatFlowProject project = requireProject(projectId);
        accessService.requirePlantAccess(project.getPlantCode());
        MatFlowDesignProjectWork work = ensure(project, true);
        requireVersion(work.getRowVersion(), request.rowVersion());
        requireDesignStage(canonicalFile(projectId), "PD Design checklist can be changed only before the whole Project / PD handoff");
        if (work.isChecklistLocked()) throw conflict("PD Design checklist is locked. Unlock it before making a correction.");
        String key = upper(itemKey);
        String status = upper(request.status());
        if (!CHECKLIST_STATUSES.contains(status)) throw badRequest("Checklist status must be PENDING, COMPLETE or NOT_APPLICABLE");
        String remarks = clean(request.remarks());
        if ("NOT_APPLICABLE".equals(status) && remarks == null) throw badRequest("Reason is required when a PD checklist point is Not Applicable");

        List<StoredChecklistItem> items = new ArrayList<>(checklist(work));
        boolean found = false;
        for (int i = 0; i < items.size(); i++) {
            StoredChecklistItem item = items.get(i);
            if (!upper(item.key()).equals(key)) continue;
            found = true;
            String completedBy = "PENDING".equals(status) ? null : accessService.actor();
            LocalDateTime completedAt = "PENDING".equals(status) ? null : now();
            items.set(i, new StoredChecklistItem(item.key(), item.section(), item.title(), item.criticality(),
                    item.blocking(), status, remarks, completedBy, completedAt));
            break;
        }
        if (!found) throw notFound("PD checklist item not found: " + itemKey);
        work.setChecklistJson(json(items));
        work.setUpdatedBy(accessService.actor());
        repository.save(work);
        MatFlowProductionFile file = canonicalFile(projectId);
        invalidateDesignHeadApproval(file);
        file.setUpdatedBy(accessService.actor());
        fileRepository.save(file);
        auditService.log("PROJECT", projectId, "DESIGN_PD_CHECKLIST_UPDATED", file,
                auditService.details("itemKey", key, "status", status, "remarks", remarks));
        return toResponse(project, work);
    }

    @Transactional
    public DesignProjectResponse setChecklistLock(UUID projectId, ChecklistLockRequest request) {
        accessService.requireDesignHeadWrite();
        MatFlowProject project = requireProject(projectId);
        accessService.requirePlantAccess(project.getPlantCode());
        MatFlowDesignProjectWork work = ensure(project, true);
        requireVersion(work.getRowVersion(), request.rowVersion());
        requireDesignStage(canonicalFile(projectId), "PD Design checklist lock can be changed only before the whole Project / PD handoff");
        if (!request.locked() && work.isChecklistLocked() && clean(request.note()) == null) {
            throw badRequest("Reason is required when unlocking the PD Design checklist");
        }
        work.setChecklistLocked(request.locked());
        work.setChecklistLockedBy(request.locked() ? accessService.actor() : null);
        work.setChecklistLockedAt(request.locked() ? now() : null);
        work.setUpdatedBy(accessService.actor());
        appendLog(work, "CHECKLIST", request.locked()
                ? "Design Head locked the PD Design checklist"
                : "Design Head unlocked the PD Design checklist · " + request.note(), accessService.actor());
        repository.save(work);
        MatFlowProductionFile file = canonicalFile(projectId);
        invalidateDesignHeadApproval(file);
        file.setUpdatedBy(accessService.actor());
        fileRepository.save(file);
        auditService.log("PROJECT", projectId,
                request.locked() ? "DESIGN_PD_CHECKLIST_LOCKED" : "DESIGN_PD_CHECKLIST_UNLOCKED",
                file, auditService.details("note", request.note()));
        return toResponse(project, work);
    }

    @Transactional
    public DesignProjectResponse updateProductProgress(UUID projectId, UUID productId, ProductProgressRequest request) {
        MatFlowProject project = requireProject(projectId);
        accessService.requirePlantAccess(project.getPlantCode());
        MatFlowDesignProjectWork work = ensure(project, true);
        requireDesignContributor(work);
        requireVersion(work.getRowVersion(), request.rowVersion());
        MatFlowProjectDrawing product = requireProduct(projectId, productId);
        MatFlowProductionFile file = canonicalFile(projectId);
        if (!DESIGN_STAGES.contains(file.getStage())) {
            throw conflict("This Project / PD is already outside Design. PPC / Engineering workflow is authoritative.");
        }

        String status = upper(request.status());
        if (!PRODUCT_PROGRESS.contains(status)) throw badRequest("Product work status must be TODO, WIP or DONE");
        Map<String, StoredProductProgress> progress = new LinkedHashMap<>(productProgress(work));
        StoredProductProgress next = new StoredProductProgress(status, clean(request.note()), accessService.actor(), now());
        progress.put(productId.toString(), next);
        work.setProductProgressJson(json(progress));
        work.setUpdatedBy(accessService.actor());
        repository.save(work);

        invalidateDesignHeadApproval(file);
        file.setCurrentDepartment("DESIGN");
        file.setCurrentOwner(clean(work.getAssignedJunior()) == null ? accessService.actor() : work.getAssignedJunior());
        file.setUpdatedBy(accessService.actor());
        fileRepository.save(file);

        appendLog(work, "PRODUCT", product.getProductName() + " marked " + status
                + (next.note() == null ? "" : " · " + next.note()), accessService.actor());
        repository.save(work);
        auditService.log("PRODUCT", productId, "DESIGN_PD_PRODUCT_PROGRESS", file,
                auditService.details("status", status, "note", next.note(), "projectId", projectId));
        return toResponse(project, work);
    }

    @Transactional
    public DesignProjectResponse addLog(UUID projectId, LogRequest request) {
        MatFlowProject project = requireProject(projectId);
        accessService.requirePlantAccess(project.getPlantCode());
        MatFlowDesignProjectWork work = ensure(project, true);
        requireDesignContributor(work);
        requireVersion(work.getRowVersion(), request.rowVersion());
        String message = clean(request.message());
        if (message == null) throw badRequest("Write an update before adding it to the PD activity log");
        String kind = upperOrNull(request.kind());
        appendLog(work, kind == null ? "NOTE" : kind, message, accessService.actor());
        work.setUpdatedBy(accessService.actor());
        repository.save(work);
        auditService.log("PROJECT", projectId, "DESIGN_PD_LOG_ADDED", canonicalFile(projectId),
                auditService.details("kind", kind == null ? "NOTE" : kind, "message", message));
        return toResponse(project, work);
    }

    @Transactional(readOnly = true)
    public boolean isWorkflowEnabled(UUID projectId) {
        if (projectId == null) return false;
        return repository.findByProject_Id(projectId).map(MatFlowDesignProjectWork::isWorkflowEnabled).orElse(false);
    }

    @Transactional(readOnly = true)
    public Set<UUID> workflowEnabledProjectIds(Set<UUID> projectIds) {
        if (projectIds == null || projectIds.isEmpty()) return Set.of();
        Set<UUID> enabled = new java.util.LinkedHashSet<>();
        for (MatFlowDesignProjectWork work : repository.findAll()) {
            if (!work.isWorkflowEnabled() || work.getProject() == null || work.getProject().getId() == null) continue;
            if (projectIds.contains(work.getProject().getId())) enabled.add(work.getProject().getId());
        }
        return java.util.Collections.unmodifiableSet(enabled);
    }

    @Transactional(readOnly = true)
    public boolean isAssignedTo(UUID projectId, String username) {
        String actor = clean(username);
        if (projectId == null || actor == null) return false;
        return repository.findByProject_Id(projectId).map(row -> same(row.getAssignedJunior(), actor)).orElse(false);
    }

    /** Project-level Design Head approval blockers. PD No. is intentionally not a blocker. */
    @Transactional(readOnly = true)
    public List<String> reviewBlockers(UUID projectId) {
        if (projectId == null) return List.of();
        MatFlowProject project = projectRepository.findById(projectId).orElse(null);
        MatFlowDesignProjectWork work = repository.findByProject_Id(projectId).orElse(null);
        if (project == null || work == null || !work.isWorkflowEnabled()) return List.of();
        return handoffBlockers(project, work);
    }

    @Transactional(readOnly = true)
    public ReleaseHealth releaseHealth(UUID projectId) {
        MatFlowDesignProjectWork work = projectId == null ? null : repository.findByProject_Id(projectId).orElse(null);
        if (work == null || !work.isWorkflowEnabled()) return ReleaseHealth.RED;
        List<StoredChecklistItem> rows = checklist(work);
        boolean criticalPending = rows.stream()
                .filter(item -> "CRITICAL".equalsIgnoreCase(item.criticality()))
                .anyMatch(item -> !isResolved(item.status()));
        if (criticalPending) return ReleaseHealth.RED;
        boolean requiredPending = rows.stream()
                .filter(item -> item.blocking() || "REQUIRED".equalsIgnoreCase(item.criticality()))
                .anyMatch(item -> !isResolved(item.status()));
        return requiredPending ? ReleaseHealth.AMBER : ReleaseHealth.GREEN;
    }

    private List<String> handoffBlockers(MatFlowProject project, MatFlowDesignProjectWork work) {
        return handoffBlockers(project, work, productsOf(project.getId()));
    }

    private List<String> handoffBlockers(
            MatFlowProject project,
            MatFlowDesignProjectWork work,
            List<MatFlowProjectDrawing> projectProducts) {
        List<String> blockers = new ArrayList<>();
        if (clean(project.getDesignHead()) == null) blockers.add("Design Head is not assigned");
        if (clean(work.getAssignedJunior()) == null) blockers.add("Project / PD is not assigned to a Junior Designer / Design team member");
        if (!work.isChecklistLocked()) blockers.add("PD Design checklist is not locked by Design Head");
        long pendingChecklist = checklist(work).stream()
                .filter(item -> !isResolved(item.status())).count();
        if (pendingChecklist > 0) blockers.add(pendingChecklist + " blocking PD Design checklist point" + (pendingChecklist == 1 ? " is" : "s are") + " pending");

        List<MatFlowProjectDrawing> products = projectProducts.stream().filter(MatFlowProjectDrawing::isActive).toList();
        if (products.isEmpty()) blockers.add("Add at least one Product before Design handoff");
        Map<String, StoredProductProgress> progress = productProgress(work);
        List<String> pendingProducts = products.stream()
                .filter(product -> {
                    StoredProductProgress item = progress.get(product.getId().toString());
                    return item == null || !"DONE".equalsIgnoreCase(item.status());
                })
                .map(MatFlowProjectDrawing::getProductName)
                .limit(5)
                .toList();
        if (!pendingProducts.isEmpty()) blockers.add("Products still pending in Design: " + String.join(", ", pendingProducts));
        return List.copyOf(blockers);
    }

    private DesignProjectResponse toResponse(MatFlowProject project, MatFlowDesignProjectWork work) {
        return toResponse(project, work, productsOf(project.getId()),
                fileRepository.findFirstByProject_IdAndProductIsNullOrderByCreatedAtAsc(project.getId()).orElse(null));
    }

    private DesignProjectResponse toResponse(
            MatFlowProject project,
            MatFlowDesignProjectWork work,
            List<MatFlowProjectDrawing> projectProducts,
            MatFlowProductionFile file) {
        List<StoredChecklistItem> storedChecklist = checklist(work);
        int complete = (int) storedChecklist.stream().filter(item -> "COMPLETE".equals(upper(item.status()))).count();
        int na = (int) storedChecklist.stream().filter(item -> "NOT_APPLICABLE".equals(upper(item.status()))).count();
        int pending = Math.max(0, storedChecklist.size() - complete - na);
        int percent = storedChecklist.isEmpty() ? 0 : (int) Math.round((complete + na) * 100.0 / storedChecklist.size());
        boolean checklistReady = work.isChecklistLocked() && pending == 0;

        Map<String, StoredProductProgress> progress = productProgress(work);
        List<ProductSubtaskResponse> products = new ArrayList<>();
        int done = 0;
        for (MatFlowProjectDrawing product : projectProducts) {
            if (!product.isActive()) continue;
            StoredProductProgress stored = progress.get(product.getId().toString());
            String productStatus = stored == null ? "TODO" : upper(stored.status());
            if ("DONE".equals(productStatus)) done++;
            products.add(new ProductSubtaskResponse(
                    product.getId(), product.getProductName(), product.getProductType(), product.getDrawingNo(), product.getDrawingRevision(),
                    product.getUnitQuantity() == null ? 1 : product.getUnitQuantity(),
                    product.getDimensionLength(), product.getDimensionBreadth(), product.getDimensionHeight(), product.getDimensionUom(),
                    dimensions(product), product.getRequiredDate(), product.getRemarks(), productStatus,
                    stored == null ? null : stored.note(), stored == null ? null : stored.updatedBy(), stored == null ? null : stored.updatedAt(),
                    product.getRowVersion()));
        }

        boolean downstream = file != null && file.getStage() != null && !DESIGN_STAGES.contains(file.getStage());
        List<String> blockers = handoffBlockers(project, work, projectProducts);
        String status = designStatus(work, products, downstream, blockers.isEmpty());
        boolean overdue = work.getDueAt() != null && work.getDueAt().isBefore(now()) && !downstream;

        List<ChecklistItemResponse> checklistRows = storedChecklist.stream()
                .map(item -> new ChecklistItemResponse(item.key(), item.section(), item.title(), item.criticality(), item.blocking(),
                        upper(item.status()), item.remarks(), item.completedBy(), item.completedAt())).toList();
        List<ActivityLogResponse> logs = logs(work).stream()
                .sorted(Comparator.comparing(StoredLog::at, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(item -> new ActivityLogResponse(item.id(), item.kind(), item.message(), item.actor(), item.at())).toList();

        return new DesignProjectResponse(
                project.getId(), project.getProjectCode(), clean(project.getProjectCode()) == null,
                project.getProjectName(), project.getClientName(), project.getPlantCode(), project.getRequiredDate(), project.getPriority(),
                project.getProjectManager(), project.getDesignHead(), work.isWorkflowEnabled(), work.getAssignedJunior(), work.getAssignedBy(),
                work.getAssignedAt(), work.getDueAt(), work.getBrief(), status, overdue, work.isChecklistLocked(), work.getChecklistLockedBy(),
                work.getChecklistLockedAt(), storedChecklist.size(), complete, na, pending, percent, checklistReady,
                products.size(), done, checklistRows, products, logs, blockers,
                file == null ? null : file.getId(), file == null ? null : file.getProductionFileNo(),
                file == null || file.getStage() == null ? null : file.getStage().name(),
                file == null || file.getReleaseHealth() == null ? null : file.getReleaseHealth().name(),
                file == null ? null : file.getPpcOwner(), file == null ? null : file.getRowVersion(),
                work.getRowVersion(), work.getUpdatedAt());
    }

    private String designStatus(MatFlowDesignProjectWork work, List<ProductSubtaskResponse> products, boolean downstream, boolean ready) {
        if (downstream) return "HANDED_OFF";
        if (ready) return "READY_FOR_HANDOFF";
        if (clean(work.getAssignedJunior()) == null) return "UNASSIGNED";
        if (products.stream().anyMatch(product -> "WIP".equals(product.status()) || "DONE".equals(product.status()))) return "IN_PROGRESS";
        return "ASSIGNED";
    }

    private MatFlowDesignProjectWork ensure(MatFlowProject project, boolean enable) {
        MatFlowDesignProjectWork work = repository.findByProject_Id(project.getId()).orElse(null);
        if (work == null) {
            work = new MatFlowDesignProjectWork();
            work.setProject(project);
            work.setWorkflowEnabled(enable);
            work.setChecklistJson(json(seedChecklist()));
            work.setProductProgressJson("{}");
            work.setLogsJson("[]");
            String actor = safeActor();
            work.setCreatedBy(actor);
            work.setUpdatedBy(actor);
            work = repository.save(work);
        } else if (enable && !work.isWorkflowEnabled()) {
            work.setWorkflowEnabled(true);
            work.setUpdatedBy(safeActor());
            work = repository.save(work);
        }
        if (checklist(work).isEmpty()) {
            work.setChecklistJson(json(seedChecklist()));
            work.setUpdatedBy(safeActor());
            work = repository.save(work);
        }
        return work;
    }

    private List<StoredChecklistItem> seedChecklist() {
        return templateService.designProjectChecklistTemplate().stream()
                .map(seed -> new StoredChecklistItem(seed.key(), seed.section(), seed.title(), seed.criticality(),
                        seed.blocking(), "PENDING", null, null, null))
                .toList();
    }

    private MatFlowProject requireProject(UUID projectId) {
        return projectRepository.findById(projectId).orElseThrow(() -> notFound("Project / PD not found"));
    }

    private MatFlowProjectDrawing requireProduct(UUID projectId, UUID productId) {
        MatFlowProjectDrawing product = productRepository.findById(productId).orElseThrow(() -> notFound("Product not found"));
        if (product.getProject() == null || !projectId.equals(product.getProject().getId())) throw notFound("Product not found in this Project / PD");
        return product;
    }

    private Map<UUID, MatFlowProductionFile> canonicalFilesByProject() {
        Map<UUID, MatFlowProductionFile> result = new LinkedHashMap<>();
        for (MatFlowProductionFile file : fileRepository.findAll()) {
            if (file.getProject() == null || file.getProject().getId() == null || file.getProduct() != null) continue;
            UUID projectId = file.getProject().getId();
            MatFlowProductionFile existing = result.get(projectId);
            if (existing == null
                    || (file.getCreatedAt() != null
                        && (existing.getCreatedAt() == null || file.getCreatedAt().isBefore(existing.getCreatedAt())))) {
                result.put(projectId, file);
            }
        }
        return result;
    }

    private MatFlowProductionFile canonicalFile(UUID projectId) {
        return fileRepository.findFirstByProject_IdAndProductIsNullOrderByCreatedAtAsc(projectId)
                .orElseThrow(() -> conflict("Canonical Project Production File is missing"));
    }

    private List<MatFlowProjectDrawing> productsOf(UUID projectId) {
        return productRepository.findByProject_IdOrderByCreatedAtAsc(projectId);
    }

    private void requireDesignStage(MatFlowProductionFile file, String message) {
        if (file == null || !DESIGN_STAGES.contains(file.getStage())) throw conflict(message);
    }

    private void requireDesignContributor(MatFlowDesignProjectWork work) {
        accessService.requireDesignProjectContributorWrite();
        if (accessService.isJuniorDesignerOnly() && !same(work.getAssignedJunior(), accessService.actor())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This Project / PD is not assigned to your Junior Designer account");
        }
    }

    private void requireJuniorVisibility(MatFlowDesignProjectWork work) {
        if (accessService.isJuniorDesignerOnly() && !same(work.getAssignedJunior(), accessService.actor())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This Project / PD is not assigned to your Junior Designer account");
        }
    }

    private List<StoredChecklistItem> checklist(MatFlowDesignProjectWork work) {
        try {
            String value = work == null ? null : work.getChecklistJson();
            if (value == null || value.isBlank()) return List.of();
            return objectMapper.readValue(value, new TypeReference<List<StoredChecklistItem>>() {});
        } catch (Exception ex) {
            return List.of();
        }
    }

    private Map<String, StoredProductProgress> productProgress(MatFlowDesignProjectWork work) {
        try {
            String value = work == null ? null : work.getProductProgressJson();
            if (value == null || value.isBlank()) return Map.of();
            return objectMapper.readValue(value, new TypeReference<LinkedHashMap<String, StoredProductProgress>>() {});
        } catch (Exception ex) {
            return Map.of();
        }
    }

    private List<StoredLog> logs(MatFlowDesignProjectWork work) {
        try {
            String value = work == null ? null : work.getLogsJson();
            if (value == null || value.isBlank()) return List.of();
            return objectMapper.readValue(value, new TypeReference<List<StoredLog>>() {});
        } catch (Exception ex) {
            return List.of();
        }
    }

    private void appendLog(MatFlowDesignProjectWork work, String kind, String message, String actor) {
        List<StoredLog> values = new ArrayList<>(logs(work));
        values.add(new StoredLog(UUID.randomUUID(), upper(kind), clean(message), clean(actor), now()));
        if (values.size() > MAX_ACTIVITY_LOGS) values = new ArrayList<>(values.subList(values.size() - MAX_ACTIVITY_LOGS, values.size()));
        work.setLogsJson(json(values));
    }

    private String json(Object value) {
        try { return objectMapper.writeValueAsString(value); }
        catch (JsonProcessingException ex) { throw new IllegalStateException("Unable to store Design PD workspace state", ex); }
    }

    private void invalidateDesignHeadApproval(MatFlowProductionFile file) {
        if (file == null || !DESIGN_STAGES.contains(file.getStage())) return;
        if (!"PENDING".equalsIgnoreCase(clean(file.getDesignHeadDecision()))) {
            file.setDesignHeadDecision("PENDING");
            file.setDesignHeadReviewedBy(null);
            file.setDesignHeadReviewedAt(null);
            file.setDesignHeadRemarks(null);
        }
    }

    private String dimensions(MatFlowProjectDrawing product) {
        if (product.getDimensionLength() == null && product.getDimensionBreadth() == null && product.getDimensionHeight() == null) return null;
        return number(product.getDimensionLength()) + " × " + number(product.getDimensionBreadth()) + " × " + number(product.getDimensionHeight())
                + " " + (clean(product.getDimensionUom()) == null ? "MM" : product.getDimensionUom());
    }

    private String number(java.math.BigDecimal value) {
        if (value == null) return "—";
        return value.stripTrailingZeros().toPlainString();
    }

    private boolean containsDesignProject(DesignProjectResponse row, String q) {
        if (contains(row.projectCode(), q) || contains(row.projectName(), q) || contains(row.clientName(), q)
                || contains(row.assignedJunior(), q) || contains(row.designHead(), q)) return true;
        return row.products().stream().anyMatch(product -> contains(product.productName(), q) || contains(product.drawingNo(), q));
    }

    private int statusRank(String status) {
        return switch (upper(status)) {
            case "READY_FOR_HANDOFF" -> 0;
            case "IN_PROGRESS" -> 1;
            case "ASSIGNED" -> 2;
            case "UNASSIGNED" -> 3;
            case "HANDED_OFF" -> 4;
            default -> 5;
        };
    }

    private boolean isResolved(String status) {
        return Set.of("COMPLETE", "NOT_APPLICABLE").contains(upper(status));
    }

    private String safeActor() {
        try {
            String actor = accessService.actor();
            return actor == null || actor.isBlank() ? "SYSTEM" : actor;
        } catch (Exception ex) {
            return "SYSTEM";
        }
    }

    private LocalDateTime now() { return LocalDateTime.now(TimeZoneConfig.APP_ZONE); }
    private static String clean(String value) { if (value == null) return null; String x=value.trim(); return x.isEmpty()?null:x; }
    private static String upper(String value) { String x=clean(value); return x==null?"":x.toUpperCase(Locale.ROOT); }
    private static String upperOrNull(String value) { String x=clean(value); return x==null?null:x.toUpperCase(Locale.ROOT); }
    private static String lower(String value) { String x=clean(value); return x==null?null:x.toLowerCase(Locale.ROOT); }
    private static boolean same(String left, String right) { String a=clean(left), b=clean(right); return a!=null && b!=null && a.equalsIgnoreCase(b); }
    private static boolean contains(String value, String q) { return value != null && q != null && value.toLowerCase(Locale.ROOT).contains(q); }

    private void requireVersion(Long current, Long requested) {
        if (requested == null) throw conflict("This PD workspace changed. Refresh and try again.");
        if (!requested.equals(current)) throw conflict("This PD workspace changed. Refresh and try again.");
    }

    private ResponseStatusException badRequest(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
    private ResponseStatusException conflict(String message) { return new ResponseStatusException(HttpStatus.CONFLICT, message); }
    private ResponseStatusException notFound(String message) { return new ResponseStatusException(HttpStatus.NOT_FOUND, message); }

    private record StoredChecklistItem(
            String key,
            String section,
            String title,
            String criticality,
            boolean blocking,
            String status,
            String remarks,
            String completedBy,
            LocalDateTime completedAt) {}

    private record StoredProductProgress(String status, String note, String updatedBy, LocalDateTime updatedAt) {}
    private record StoredLog(UUID id, String kind, String message, String actor, LocalDateTime at) {}
}
