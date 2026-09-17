package com.alsorg.packing.service.matflow;

import static com.alsorg.packing.controller.dto.matflow.MatFlowInsightDtos.*;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.DesignTaskStatus;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.EngineeringDecision;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.ProductionFileStage;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.ReleaseHealth;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.WorkItemStatus;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.WorkItemType;
import com.alsorg.packing.domain.matflow.MatFlowDesignTask;
import com.alsorg.packing.domain.matflow.MatFlowProductionFile;
import com.alsorg.packing.domain.matflow.MatFlowWorkItem;
import com.alsorg.packing.repository.matflow.MatFlowDesignTaskRepository;
import com.alsorg.packing.repository.matflow.MatFlowProductionFileRepository;
import com.alsorg.packing.repository.matflow.MatFlowWorkItemRepository;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MatFlowInsightService {
    private static final Set<WorkItemStatus> OPEN_QUERY_STATUSES = Set.of(WorkItemStatus.OPEN, WorkItemStatus.RESPONDED);
    private static final Set<WorkItemStatus> CLOSED_WORK_STATUSES = Set.of(
            WorkItemStatus.COMPLETE,
            WorkItemStatus.NOT_APPLICABLE,
            WorkItemStatus.CLOSED,
            WorkItemStatus.CANCELLED);

    private final MatFlowProductionFileRepository fileRepository;
    private final MatFlowDesignTaskRepository designTaskRepository;
    private final MatFlowWorkItemRepository workRepository;
    private final MatFlowAccessService accessService;
    private final MatFlowAuditService auditService;

    public MatFlowInsightService(
            MatFlowProductionFileRepository fileRepository,
            MatFlowDesignTaskRepository designTaskRepository,
            MatFlowWorkItemRepository workRepository,
            MatFlowAccessService accessService,
            MatFlowAuditService auditService) {
        this.fileRepository = fileRepository;
        this.designTaskRepository = designTaskRepository;
        this.workRepository = workRepository;
        this.accessService = accessService;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public DashboardResponse dashboard(String plantCode) {
        accessService.requireRead();
        String plant = cleanUpper(plantCode);
        if (plant != null) accessService.requirePlantAccess(plant);

        List<MatFlowProductionFile> files = readableFiles(plant, true);
        Map<String, Long> stageCounts = new LinkedHashMap<>();
        for (ProductionFileStage stage : ProductionFileStage.values()) {
            stageCounts.put(stage.name(), files.stream().filter(file -> file.getStage() == stage).count());
        }

        long openQueries = 0;
        long overdue = 0;
        List<ProductionRiskRow> attention = new ArrayList<>();

        for (MatFlowProductionFile file : files) {
            List<MatFlowWorkItem> items = workRepository.findByProductionFile_IdOrderByDisplayOrderAscCreatedAtAsc(file.getId());
            long queries = items.stream()
                    .filter(item -> item.getItemType() == WorkItemType.ENGINEERING_QUERY)
                    .filter(item -> OPEN_QUERY_STATUSES.contains(item.getStatus()))
                    .count();
            long pendingTasks = items.stream()
                    .filter(item -> item.getItemType() == WorkItemType.ENGINEERING_TASK)
                    .filter(item -> !CLOSED_WORK_STATUSES.contains(item.getStatus()))
                    .count();
            long overdueItems = items.stream()
                    .filter(item -> item.getDueAt() != null && item.getDueAt().isBefore(now()))
                    .filter(item -> !CLOSED_WORK_STATUSES.contains(item.getStatus()))
                    .count();
            List<MatFlowDesignTask> designTasks = designTaskRepository.findByProductionFile_IdOrderByReceivedAtAscCreatedAtAsc(file.getId());
            long pendingDesignTasks = designTasks.stream()
                    .filter(task -> !Set.of(DesignTaskStatus.DONE, DesignTaskStatus.CANCELLED).contains(task.getStatus()))
                    .count();
            long designHolds = designTasks.stream().filter(task -> task.getStatus() == DesignTaskStatus.HOLD).count();
            long overdueDesignTasks = designTasks.stream()
                    .filter(task -> task.getDueAt() != null && task.getDueAt().isBefore(now()))
                    .filter(task -> !Set.of(DesignTaskStatus.DONE, DesignTaskStatus.CANCELLED).contains(task.getStatus()))
                    .count();
            long totalOverdue = overdueItems + overdueDesignTasks;

            openQueries += queries;
            overdue += totalOverdue;

            boolean needsAttention = file.getReleaseHealth() != ReleaseHealth.GREEN
                    || file.isRevisionReviewRequired()
                    || queries > 0
                    || totalOverdue > 0
                    || designHolds > 0;
            if (!needsAttention) continue;

            List<String> blockers = new ArrayList<>();
            if (file.isRevisionReviewRequired()) blockers.add("Revision review");
            if (pendingDesignTasks > 0 && Set.of(ProductionFileStage.DESIGN_DRAFT, ProductionFileStage.DESIGN_CLARIFICATION).contains(file.getStage())) blockers.add(pendingDesignTasks + " Design task" + (pendingDesignTasks == 1 ? "" : "s") + " pending");
            if (designHolds > 0) blockers.add(designHolds + " Design task" + (designHolds == 1 ? "" : "s") + " on hold");
            if (queries > 0) blockers.add(queries + " open issue" + (queries == 1 ? "" : "s"));
            if (pendingTasks > 0) blockers.add(pendingTasks + " engineering task" + (pendingTasks == 1 ? "" : "s"));
            if (totalOverdue > 0) blockers.add(totalOverdue + " overdue work item" + (totalOverdue == 1 ? "" : "s"));
            if (blockers.isEmpty() && file.getReleaseHealth() == ReleaseHealth.RED) blockers.add("Critical release information pending");
            if (blockers.isEmpty() && file.getReleaseHealth() == ReleaseHealth.AMBER) blockers.add("Controlled release limitation");

            attention.add(new ProductionRiskRow(
                    file.getId(),
                    file.getProductionFileNo(),
                    file.getProjectCode(),
                    file.getProjectName(),
                    file.getProductName(),
                    file.getDrawingNo(),
                    file.getStage().name(),
                    file.getReleaseHealth().name(),
                    file.getCurrentDepartment(),
                    file.getCurrentOwner(),
                    file.getPlannedProductionReleaseDate(),
                    file.getPlannedDispatchDate(),
                    (int) queries,
                    (int) pendingTasks,
                    (int) totalOverdue,
                    blockers,
                    file.getUpdatedAt()));
        }

        attention.sort(Comparator
                .comparingInt((ProductionRiskRow row) -> attentionRank(row)).reversed()
                .thenComparing(ProductionRiskRow::updatedAt, Comparator.nullsLast(Comparator.reverseOrder())));

        long activeProjects = files.stream()
                .map(MatFlowProductionFile::getProjectCode)
                .filter(value -> value != null && !value.isBlank())
                .map(value -> value.trim().toUpperCase(Locale.ROOT))
                .distinct()
                .count();

        return new DashboardResponse(
                activeProjects,
                files.size(),
                countHealth(files, ReleaseHealth.GREEN),
                countHealth(files, ReleaseHealth.AMBER),
                countHealth(files, ReleaseHealth.RED),
                attention.size(),
                countStages(files, ProductionFileStage.DESIGN_DRAFT, ProductionFileStage.DESIGN_CLARIFICATION, ProductionFileStage.DESIGN_SUBMITTED),
                countStages(files, ProductionFileStage.PPC_GATE_1),
                countStages(files, ProductionFileStage.ENGINEERING_REVIEW, ProductionFileStage.ENGINEERING_QUERY, ProductionFileStage.ENGINEERING_WORK, ProductionFileStage.REVISION_REVIEW),
                countStages(files, ProductionFileStage.PPC_GATE_2),
                countStages(files, ProductionFileStage.PRODUCTION_RELEASED),
                openQueries,
                overdue,
                attention.stream().limit(50).toList(),
                stageCounts,
                now());
    }

    @Transactional(readOnly = true)
    public EngineeringKpis engineeringKpis(String plantCode) {
        accessService.requireEngineeringRead();
        String plant = cleanUpper(plantCode);
        if (plant != null) accessService.requirePlantAccess(plant);

        List<MatFlowProductionFile> files = readableFiles(plant, false);
        long inEngineering = files.stream()
                .filter(file -> Set.of(
                        ProductionFileStage.ENGINEERING_REVIEW,
                        ProductionFileStage.ENGINEERING_QUERY,
                        ProductionFileStage.ENGINEERING_WORK,
                        ProductionFileStage.REVISION_REVIEW).contains(file.getStage()))
                .count();
        long approved = files.stream().filter(file -> file.getEngineeringDecision() == EngineeringDecision.APPROVED).count();

        List<MatFlowWorkItem> all = new ArrayList<>();
        for (MatFlowProductionFile file : files) {
            all.addAll(workRepository.findByProductionFile_IdOrderByDisplayOrderAscCreatedAtAsc(file.getId()));
        }

        long queries = all.stream()
                .filter(item -> item.getItemType() == WorkItemType.ENGINEERING_QUERY)
                .filter(item -> OPEN_QUERY_STATUSES.contains(item.getStatus()))
                .count();
        long pending = all.stream()
                .filter(item -> item.getItemType() == WorkItemType.ENGINEERING_TASK)
                .filter(item -> !CLOSED_WORK_STATUSES.contains(item.getStatus()))
                .count();
        List<MatFlowWorkItem> completed = all.stream()
                .filter(item -> item.getItemType() == WorkItemType.ENGINEERING_TASK && item.getStatus() == WorkItemStatus.COMPLETE)
                .toList();

        double averageMinutes = completed.stream()
                .filter(item -> item.getCompletedAt() != null && item.getStartedAt() != null)
                .mapToLong(item -> Math.max(0, Duration.between(item.getStartedAt(), item.getCompletedAt()).toMinutes()))
                .average()
                .orElse(0);

        List<MatFlowProductionFile> released = files.stream().filter(file -> file.getProductionReleasedAt() != null).toList();
        long firstTimeRight = released.stream().filter(file -> auditService.timeline(file.getId()).stream()
                .noneMatch(audit -> audit.getAction() != null
                        && (audit.getAction().startsWith("REVISION_IMPACT_") || audit.getAction().equals("PPC_GATE_2_RETURN"))))
                .count();
        double ftr = released.isEmpty() ? 0 : (firstTimeRight * 100.0 / released.size());

        return new EngineeringKpis(
                inEngineering,
                approved,
                queries,
                pending,
                completed.size(),
                round1(ftr),
                round1(averageMinutes),
                now());
    }

    private List<MatFlowProductionFile> readableFiles(String plant, boolean activeOnly) {
        return fileRepository.findAllByOrderByUpdatedAtDesc().stream()
                .filter(file -> !activeOnly || file.isActive())
                .filter(file -> accessService.canAccessPlant(file.getPlantCode()))
                .filter(file -> plant == null || plant.equalsIgnoreCase(file.getPlantCode()))
                .toList();
    }

    private long countHealth(List<MatFlowProductionFile> files, ReleaseHealth health) {
        return files.stream().filter(file -> file.getReleaseHealth() == health).count();
    }

    private long countStages(List<MatFlowProductionFile> files, ProductionFileStage... stages) {
        Set<ProductionFileStage> values = Set.of(stages);
        return files.stream().filter(file -> values.contains(file.getStage())).count();
    }

    private int attentionRank(ProductionRiskRow row) {
        int score = "RED".equals(row.health()) ? 300 : "AMBER".equals(row.health()) ? 200 : 100;
        score += Math.min(80, row.overdueItems() * 20);
        score += Math.min(60, row.openQueries() * 15);
        if (row.plannedProductionReleaseDate() != null && row.plannedProductionReleaseDate().isBefore(java.time.LocalDate.now(TimeZoneConfig.APP_ZONE))) {
            score += 50;
        }
        return score;
    }

    private double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private LocalDateTime now() {
        return LocalDateTime.now(TimeZoneConfig.APP_ZONE);
    }

    private String cleanUpper(String value) {
        if (value == null) return null;
        String clean = value.trim();
        return clean.isBlank() ? null : clean.toUpperCase(Locale.ROOT);
    }
}
