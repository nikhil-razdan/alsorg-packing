package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowIntegrityDtos.IntegrityReport;
import com.alsorg.packing.controller.dto.matflow.MatFlowIntegrityDtos.IntegritySeverity;
import com.alsorg.packing.controller.dto.matflow.MatFlowIntegrityDtos.IntegritySummary;
import com.alsorg.packing.controller.dto.matflow.MatFlowIntegrityDtos.IntegrityViolation;
import com.alsorg.packing.controller.dto.matflow.MatFlowReportingDtos.*;
import com.alsorg.packing.controller.dto.matflow.MatFlowTrackerDtos.*;

import com.alsorg.packing.domain.matflow.*;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.*;
import com.alsorg.packing.repository.matflow.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import jakarta.persistence.criteria.Predicate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Consolidated read-model service for dashboards, tracker, reports, audit
 * searches and integrity diagnostics.
 */
@Service
public class MatFlowInsightService {

    private final ReportingModule reporting;
    private final TrackerModule tracker;
    private final IntegrityModule integrity;

    public MatFlowInsightService(
            MatFlowProjectDrawingRepository projectRepository,
            MatFlowBomRepository bomRepository,
            MatFlowMaterialRequisitionRepository requisitionRepository,
            MatFlowRequisitionLineRepository requisitionLineRepository,
            MatFlowIndentRepository indentRepository,
            MatFlowPurchaseOrderRepository purchaseOrderRepository,
            MatFlowGoodsReceiptRepository receiptRepository,
            MatFlowGoodsReceiptLineRepository receiptLineRepository,
            MatFlowTransferOrderRepository transferRepository,
            MatFlowTransferLineRepository transferLineRepository,
            MatFlowQcInspectionRepository qcRepository,
            MatFlowProcessingJobRepository processingRepository,
            MatFlowStockBalanceRepository stockRepository,
            MatFlowStockLedgerRepository ledgerRepository,
            MatFlowAuditLogRepository auditRepository,
            MatFlowReservationRepository reservationRepository,
            MatFlowAccessService accessService) {

        this.reporting = new ReportingModule(
                projectRepository,
                bomRepository,
                requisitionRepository,
                requisitionLineRepository,
                indentRepository,
                purchaseOrderRepository,
                receiptRepository,
                transferRepository,
                qcRepository,
                processingRepository,
                stockRepository,
                ledgerRepository,
                auditRepository,
                accessService);

        this.tracker = new TrackerModule(
                requisitionRepository,
                requisitionLineRepository,
                reservationRepository,
                indentRepository,
                transferRepository,
                accessService);

        this.integrity = new IntegrityModule(
                stockRepository,
                requisitionLineRepository,
                transferLineRepository,
                receiptLineRepository,
                processingRepository,
                reservationRepository,
                accessService);
    }

    @Transactional(readOnly = true)
    public DashboardResponse dashboard(String plantCode) {
        return reporting.dashboard(plantCode);
    }

    @Transactional(readOnly = true)
    public ProjectTrackingResponse projectTracking(UUID projectDrawingId) {
        return reporting.projectTracking(projectDrawingId);
    }

    @Transactional(readOnly = true)
    public List<ShortageAgeingRow> shortageAgeing(String plantCode, Integer minimumAgeDays) {
        return reporting.shortageAgeing(plantCode, minimumAgeDays);
    }

    @Transactional(readOnly = true)
    public PageResponse<StockLedgerRow> stockLedger(
            String plantCode,
            UUID materialId,
            UUID locationId,
            MovementType movementType,
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String search,
            int page,
            int size) {
        return reporting.stockLedger(
                plantCode, materialId, locationId, movementType, fromDate, toDate, search, page, size);
    }

    @Transactional(readOnly = true)
    public PageResponse<AuditLogRow> auditLogs(
            String plantCode,
            String entityType,
            UUID entityId,
            String action,
            LocalDateTime fromDate,
            LocalDateTime toDate,
            String search,
            int page,
            int size) {
        return reporting.auditLogs(
                plantCode, entityType, entityId, action, fromDate, toDate, search, page, size);
    }

    @Transactional(readOnly = true)
    public TrackerResponse tracker(String search, String plantCode, String stage) {
        return tracker.getTracker(search, plantCode, stage);
    }

    @Transactional(readOnly = true)
    public IntegrityReport inspectIntegrity(String plantCode) {
        return integrity.inspect(plantCode);
    }

    private static final class ReportingModule {

        private final MatFlowProjectDrawingRepository projectRepository;
        private final MatFlowBomRepository bomRepository;
        private final MatFlowMaterialRequisitionRepository requisitionRepository;
        private final MatFlowRequisitionLineRepository requisitionLineRepository;
        private final MatFlowIndentRepository indentRepository;
        private final MatFlowPurchaseOrderRepository purchaseOrderRepository;
        private final MatFlowGoodsReceiptRepository receiptRepository;
        private final MatFlowTransferOrderRepository transferRepository;
        private final MatFlowQcInspectionRepository qcRepository;
        private final MatFlowProcessingJobRepository processingRepository;
        private final MatFlowStockBalanceRepository stockRepository;
        private final MatFlowStockLedgerRepository ledgerRepository;
        private final MatFlowAuditLogRepository auditRepository;
        private final MatFlowAccessService accessService;

        ReportingModule(
                MatFlowProjectDrawingRepository projectRepository,
                MatFlowBomRepository bomRepository,
                MatFlowMaterialRequisitionRepository requisitionRepository,
                MatFlowRequisitionLineRepository requisitionLineRepository,
                MatFlowIndentRepository indentRepository,
                MatFlowPurchaseOrderRepository purchaseOrderRepository,
                MatFlowGoodsReceiptRepository receiptRepository,
                MatFlowTransferOrderRepository transferRepository,
                MatFlowQcInspectionRepository qcRepository,
                MatFlowProcessingJobRepository processingRepository,
                MatFlowStockBalanceRepository stockRepository,
                MatFlowStockLedgerRepository ledgerRepository,
                MatFlowAuditLogRepository auditRepository,
                MatFlowAccessService accessService) {
            this.projectRepository = projectRepository;

            this.bomRepository = bomRepository;

            this.requisitionRepository = requisitionRepository;

            this.requisitionLineRepository = requisitionLineRepository;

            this.indentRepository = indentRepository;

            this.purchaseOrderRepository = purchaseOrderRepository;

            this.receiptRepository = receiptRepository;

            this.transferRepository = transferRepository;

            this.qcRepository = qcRepository;

            this.processingRepository = processingRepository;

            this.stockRepository = stockRepository;

            this.ledgerRepository = ledgerRepository;

            this.auditRepository = auditRepository;

            this.accessService = accessService;
        }

        @Transactional(readOnly = true)
        public DashboardResponse dashboard(
                String plantCode) {
            accessService.requireRead();

            Set<String> plants = resolvePlants(plantCode);

            List<MatFlowProjectDrawing> projects = projectRepository
                    .findAll()
                    .stream()
                    .filter(project -> project.isActive() &&
                            plants.contains(
                                    normalizePlant(
                                            project.getPlantCode())))
                    .toList();

            List<MatFlowBom> boms = bomRepository
                    .findAll()
                    .stream()
                    .filter(bom -> plants.contains(
                            normalizePlant(
                                    bom.getProjectDrawing()
                                            .getPlantCode())))
                    .toList();

            List<MatFlowMaterialRequisition> requisitions = requisitionRepository
                    .findAllByOrderByUpdatedAtDesc()
                    .stream()
                    .filter(requisition -> plants.contains(
                            requisitionPlant(requisition)))
                    .toList();

            List<MatFlowTransferOrder> transfers = transferRepository
                    .findAllByOrderByUpdatedAtDesc()
                    .stream()
                    .filter(transfer -> plants.contains(
                            normalizePlant(
                                    transfer.fromLocation.plantCode))
                            ||
                            plants.contains(
                                    normalizePlant(
                                            transfer.toLocation.plantCode)))
                    .toList();

            List<MatFlowQcInspection> inspections = qcRepository
                    .findAllByOrderByCreatedAtDesc()
                    .stream()
                    .filter(inspection -> plants.contains(
                            normalizePlant(
                                    inspection.location.plantCode)))
                    .toList();

            List<MatFlowProcessingJob> jobs = processingRepository
                    .findAllByOrderByUpdatedAtDesc()
                    .stream()
                    .filter(job -> plants.contains(
                            normalizePlant(
                                    job.location.plantCode)))
                    .toList();

            List<MatFlowIndent> indents = indentRepository
                    .findAll()
                    .stream()
                    .filter(indent -> plants.contains(
                            normalizePlant(
                                    indent.deliverToLocation.plantCode)))
                    .toList();

            List<MatFlowPurchaseOrder> purchaseOrders = purchaseOrderRepository
                    .findAllByOrderByUpdatedAtDesc()
                    .stream()
                    .filter(order -> plants.contains(
                            normalizePlant(
                                    order.deliveryLocation.plantCode)))
                    .toList();

            List<MatFlowStockBalance> balances = stockRepository
                    .findVisibleBalances(
                            plants);

            List<PlantDashboardRow> rows = plants.stream()
                    .sorted()
                    .map(plant -> buildPlantDashboard(
                            plant,
                            projects,
                            boms,
                            requisitions,
                            transfers,
                            inspections,
                            jobs,
                            indents,
                            purchaseOrders,
                            balances))
                    .toList();

            DashboardTotals totals = new DashboardTotals(
                    sum(
                            rows,
                            PlantDashboardRow::activeProjects),
                    sum(
                            rows,
                            PlantDashboardRow::effectiveBoms),
                    sum(
                            rows,
                            PlantDashboardRow::openRequisitions),
                    sum(
                            rows,
                            PlantDashboardRow::shortageRequisitions),
                    sum(
                            rows,
                            PlantDashboardRow::readyOutboundTransfers),
                    sum(
                            rows,
                            PlantDashboardRow::inTransitOutboundTransfers),
                    sum(
                            rows,
                            PlantDashboardRow::expectedInboundTransfers),
                    sum(
                            rows,
                            PlantDashboardRow::pendingQcInspections),
                    sum(
                            rows,
                            PlantDashboardRow::activeProcessingJobs),
                    sum(
                            rows,
                            PlantDashboardRow::openIndents),
                    sum(
                            rows,
                            PlantDashboardRow::openPurchaseOrders),
                    sum(
                            rows,
                            PlantDashboardRow::stockBalanceLines),
                    sum(
                            rows,
                            PlantDashboardRow::lowStockLines),
                    sum(
                            rows,
                            PlantDashboardRow::blockedStockLines),
                    sum(
                            rows,
                            PlantDashboardRow::inTransitStockLines));

            return new DashboardResponse(
                    LocalDateTime.now(),
                    plants,
                    totals,
                    rows);
        }

        @Transactional(readOnly = true)
        public ProjectTrackingResponse projectTracking(
                UUID projectDrawingId) {
            accessService.requireRead();

            MatFlowProjectDrawing project = projectRepository
                    .findById(projectDrawingId)
                    .orElseThrow(() -> notFound(
                            "Project drawing not found"));

            accessService.requirePlantAccess(
                    project.getPlantCode());

            List<MatFlowBom> boms = bomRepository
                    .findByProjectDrawing_IdOrderByRevisionNoDesc(
                            project.getId());

            List<MatFlowMaterialRequisition> requisitions = requisitionRepository
                    .findByProjectDrawing_IdOrderByCreatedAtDesc(
                            project.getId());

            List<MatFlowIndent> indents = indentRepository
                    .findByProjectDrawing_IdOrderByCreatedAtDesc(
                            project.getId());

            List<MatFlowPurchaseOrder> orders = indents.stream()
                    .flatMap(indent -> purchaseOrderRepository
                            .findByIndent_Id(
                                    indent.getId())
                            .stream())
                    .toList();

            long receiptCount = orders.stream()
                    .mapToLong(order -> receiptRepository
                            .findByPurchaseOrder_IdOrderByReceivedAtAsc(
                                    order.getId())
                            .size())
                    .sum();

            List<MatFlowTransferOrder> transfers = requisitions.stream()
                    .flatMap(requisition -> transferRepository
                            .findByRequisition_IdOrderByRouteSequenceNoAscCreatedAtAsc(
                                    requisition.getId())
                            .stream())
                    .toList();

            List<MatFlowProcessingJob> jobs = requisitions.stream()
                    .flatMap(requisition -> processingRepository
                            .findByRequisition_IdOrderByCreatedAtAsc(
                                    requisition.getId())
                            .stream())
                    .toList();

            Set<UUID> projectReferenceIds = new LinkedHashSet<>();

            orders.forEach(order -> receiptRepository
                    .findByPurchaseOrder_IdOrderByReceivedAtAsc(
                            order.getId())
                    .forEach(receipt -> projectReferenceIds.add(
                            receipt.getId())));

            transfers.forEach(transfer -> projectReferenceIds.add(
                    transfer.getId()));

            long pendingQc = qcRepository
                    .findByStatusOrderByCreatedAtAsc(
                            QcInspectionStatus.PENDING)
                    .stream()
                    .filter(inspection -> projectReferenceIds.contains(
                            inspection.sourceId))
                    .count();

            List<BomRevisionSummary> bomRows = boms.stream()
                    .map(bom -> new BomRevisionSummary(
                            bom.getId(),
                            bom.getBomNumber(),
                            bom.getRevisionNo(),
                            bom.getStatus(),
                            bom.isLatestRevision(),
                            bom.isEffective(),
                            bom.getSubmittedBy(),
                            bom.getSubmittedAt(),
                            bom.getApprovedBy(),
                            bom.getApprovedAt()))
                    .toList();

            List<ProjectRequisitionSummary> requisitionRows = requisitions.stream()
                    .map(requisition -> {
                        List<MatFlowRequisitionLine> lines = requisitionLineRepository
                                .findByRequisition_IdOrderByLineNoAsc(
                                        requisition.getId());

                        int shortageLines = (int) lines.stream()
                                .filter(line -> line.shortageQty
                                        .compareTo(
                                                BigDecimal.ZERO) > 0)
                                .count();

                        int fullyIssuedLines = (int) lines.stream()
                                .filter(line -> line.issuedQty
                                        .compareTo(
                                                line.requestedQty) >= 0)
                                .count();

                        int accountedLines = (int) lines.stream()
                                .filter(line -> line.consumedQty
                                        .add(
                                                line.returnedQty)
                                        .compareTo(
                                                line.issuedQty) >= 0)
                                .count();

                        return new ProjectRequisitionSummary(
                                requisition.getId(),
                                requisition.requisitionNumber,
                                requisition.status,

                                requisitionDestinationCode(requisition),

                                requisitionPlant(requisition),

                                lines.size(),
                                shortageLines,
                                fullyIssuedLines,
                                accountedLines,

                                requisition.requestedBy,
                                requisition.requestedAt,
                                requisition.plannedAt);
                    })
                    .toList();

            long activeTransfers = transfers.stream()
                    .filter(transfer -> transfer.status != TransferStatus.RECEIVED &&
                            transfer.status != TransferStatus.CANCELLED)
                    .count();

            long activeJobs = jobs.stream()
                    .filter(job -> job.status != ProcessingJobStatus.COMPLETED &&
                            job.status != ProcessingJobStatus.CANCELLED)
                    .count();

            long openIndents = indents.stream()
                    .filter(indent -> indent.status != IndentStatus.RECEIVED &&
                            indent.status != IndentStatus.CANCELLED)
                    .count();

            return new ProjectTrackingResponse(
                    project.getId(),
                    project.getProjectCode(),
                    project.getProjectName(),
                    project.getClientName(),
                    project.getDrawingNo(),
                    project.getDrawingRevision(),
                    project.getProductName(),
                    project.getPlantCode(),

                    bomRows,
                    requisitionRows,

                    openIndents,
                    orders.size(),
                    receiptCount,
                    pendingQc,
                    activeTransfers,
                    activeJobs);
        }

        @Transactional(readOnly = true)
        public List<ShortageAgeingRow> shortageAgeing(
                String plantCode,
                Integer minimumAgeDays) {
            accessService.requireRead();

            Set<String> plants = resolvePlants(plantCode);

            int minimumAge = minimumAgeDays == null
                    ? 0
                    : Math.max(
                            minimumAgeDays,
                            0);

            return requisitionLineRepository
                    .findOpenShortages(
                            EnumSet.of(
                                    RequisitionStatus.CANCELLED,
                                    RequisitionStatus.COMPLETED,
                                    RequisitionStatus.PRODUCTION_COMPLETED))
                    .stream()
                    .filter(line -> plants.contains(
                            requisitionPlant(line == null ? null : line.requisition)))
                    .map(line -> {
                        LocalDateTime startedAt = line.requisition.plannedAt != null
                                ? line.requisition.plannedAt
                                : line.requisition.submittedAt != null
                                        ? line.requisition.submittedAt
                                        : line.requisition.getCreatedAt();

                        long ageDays = ChronoUnit.DAYS.between(
                                startedAt.toLocalDate(),
                                LocalDate.now());

                        return new ShortageAgeingRow(
                                line.requisition.getId(),
                                line.requisition.requisitionNumber,
                                line.getId(),

                                line.requisition.projectDrawing
                                        .getProjectCode(),

                                line.requisition.projectDrawing
                                        .getDrawingNo(),

                                line.material.getId(),
                                line.material
                                        .getMaterialCode(),
                                line.material
                                        .getMaterialName(),
                                line.material.getUom(),

                                line.requestedQty,
                                line.reservedQty,
                                line.shortageQty,

                                requisitionDestinationCode(line.requisition),

                                requisitionPlant(line.requisition),

                                line.requisition.status,
                                startedAt,
                                ageDays);
                    })
                    .filter(row -> row.ageDays() >= minimumAge)
                    .sorted(
                            Comparator
                                    .comparingLong(
                                            ShortageAgeingRow::ageDays)
                                    .reversed()
                                    .thenComparing(
                                            ShortageAgeingRow::requisitionNumber))
                    .toList();
        }

        @Transactional(readOnly = true)
        public PageResponse<StockLedgerRow> stockLedger(
                String plantCode,
                UUID materialId,
                UUID locationId,
                MovementType movementType,
                LocalDateTime fromDate,
                LocalDateTime toDate,
                String search,
                int page,
                int size) {
            accessService.requireRead();

            Set<String> plants = resolvePlants(plantCode);

            PageRequest pageable = PageRequest.of(
                    safePage(page),
                    safeSize(size),
                    Sort.by(
                            Sort.Direction.DESC,
                            "actionAt"));

            Page<MatFlowStockLedger> result = ledgerRepository.findAll(
                    stockLedgerSpecification(
                            plants,
                            materialId,
                            locationId,
                            movementType,
                            fromDate,
                            toDate,
                            search),
                    pageable);

            return new PageResponse<>(
                    result.getContent()
                            .stream()
                            .map(this::toLedgerRow)
                            .toList(),

                    result.getNumber(),
                    result.getSize(),
                    result.getTotalElements(),
                    result.getTotalPages());
        }

        @Transactional(readOnly = true)
        public PageResponse<AuditLogRow> auditLogs(
                String plantCode,
                String entityType,
                UUID entityId,
                String action,
                LocalDateTime fromDate,
                LocalDateTime toDate,
                String search,
                int page,
                int size) {
            accessService.requireRead();

            Set<String> plants = resolvePlants(plantCode);

            PageRequest pageable = PageRequest.of(
                    safePage(page),
                    safeSize(size),
                    Sort.by(
                            Sort.Direction.DESC,
                            "actionAt"));

            Page<MatFlowAuditLog> result = auditRepository.findAll(
                    auditSpecification(
                            plants,
                            entityType,
                            entityId,
                            action,
                            fromDate,
                            toDate,
                            search),
                    pageable);

            List<AuditLogRow> rows = result.getContent()
                    .stream()
                    .map(audit -> new AuditLogRow(
                            audit.getId(),
                            audit.getEntityType(),
                            audit.getEntityId(),
                            audit.getAction(),
                            audit.getDetailsJson(),
                            audit.getActor(),
                            audit.getPlantCode(),
                            audit.getProjectCode(),
                            audit.getDrawingNo(),
                            audit.getActionAt()))
                    .toList();

            return new PageResponse<>(
                    rows,
                    result.getNumber(),
                    result.getSize(),
                    result.getTotalElements(),
                    result.getTotalPages());
        }

        private Specification<MatFlowStockLedger> stockLedgerSpecification(
                Set<String> plants,
                UUID materialId,
                UUID locationId,
                MovementType movementType,
                LocalDateTime fromDate,
                LocalDateTime toDate,
                String search) {

            return (root, query, cb) -> {
                List<Predicate> predicates = new ArrayList<>();

                predicates.add(
                        cb.upper(
                                root.get("location")
                                        .<String>get("plantCode"))
                                .in(plants));

                if (materialId != null) {
                    predicates.add(
                            cb.equal(
                                    root.get("material").get("id"),
                                    materialId));
                }

                if (locationId != null) {
                    predicates.add(
                            cb.equal(
                                    root.get("location").get("id"),
                                    locationId));
                }

                if (movementType != null) {
                    predicates.add(
                            cb.equal(
                                    root.get("movementType"),
                                    movementType));
                }

                if (fromDate != null) {
                    predicates.add(
                            cb.greaterThanOrEqualTo(
                                    root.<LocalDateTime>get("actionAt"),
                                    fromDate));
                }

                if (toDate != null) {
                    predicates.add(
                            cb.lessThanOrEqualTo(
                                    root.<LocalDateTime>get("actionAt"),
                                    toDate));
                }

                String term = clean(search);
                if (term != null) {
                    String like = "%" + term.toLowerCase(Locale.ROOT) + "%";
                    predicates.add(
                            cb.or(
                                    cb.like(cb.lower(cb.coalesce(root.<String>get("referenceNumber"), "")), like),
                                    cb.like(cb.lower(cb.coalesce(root.<String>get("projectCode"), "")), like),
                                    cb.like(cb.lower(cb.coalesce(root.<String>get("drawingNo"), "")), like),
                                    cb.like(cb.lower(cb.coalesce(root.<String>get("batchNo"), "")), like),
                                    cb.like(cb.lower(cb.coalesce(root.<String>get("actor"), "")), like)));
                }

                return cb.and(predicates.toArray(Predicate[]::new));
            };
        }

        private Specification<MatFlowAuditLog> auditSpecification(
                Set<String> plants,
                String entityType,
                UUID entityId,
                String action,
                LocalDateTime fromDate,
                LocalDateTime toDate,
                String search) {

            return (root, query, cb) -> {
                List<Predicate> predicates = new ArrayList<>();

                predicates.add(
                        cb.or(
                                cb.isNull(root.get("plantCode")),
                                cb.upper(root.<String>get("plantCode")).in(plants)));

                String entityFilter = clean(entityType);
                if (entityFilter != null) {
                    predicates.add(
                            cb.equal(
                                    cb.upper(root.<String>get("entityType")),
                                    entityFilter.toUpperCase(Locale.ROOT)));
                }

                if (entityId != null) {
                    predicates.add(
                            cb.equal(
                                    root.get("entityId"),
                                    entityId));
                }

                String actionFilter = clean(action);
                if (actionFilter != null) {
                    predicates.add(
                            cb.equal(
                                    cb.upper(root.<String>get("action")),
                                    actionFilter.toUpperCase(Locale.ROOT)));
                }

                if (fromDate != null) {
                    predicates.add(
                            cb.greaterThanOrEqualTo(
                                    root.<LocalDateTime>get("actionAt"),
                                    fromDate));
                }

                if (toDate != null) {
                    predicates.add(
                            cb.lessThanOrEqualTo(
                                    root.<LocalDateTime>get("actionAt"),
                                    toDate));
                }

                String term = clean(search);
                if (term != null) {
                    String like = "%" + term.toLowerCase(Locale.ROOT) + "%";
                    predicates.add(
                            cb.or(
                                    cb.like(cb.lower(cb.coalesce(root.<String>get("actor"), "")), like),
                                    cb.like(cb.lower(cb.coalesce(root.<String>get("projectCode"), "")), like),
                                    cb.like(cb.lower(cb.coalesce(root.<String>get("drawingNo"), "")), like),
                                    cb.like(cb.lower(cb.coalesce(root.<String>get("detailsJson"), "")), like)));
                }

                return cb.and(predicates.toArray(Predicate[]::new));
            };
        }

        private String requisitionPlant(
                MatFlowMaterialRequisition requisition) {
            if (requisition == null) {
                return "";
            }

            if (requisition.destinationLocation != null &&
                    clean(requisition.destinationLocation.plantCode) != null) {
                return normalizePlant(requisition.destinationLocation.plantCode);
            }

            if (requisition.projectDrawing != null) {
                return normalizePlant(requisition.projectDrawing.getPlantCode());
            }

            return "";
        }

        private String requisitionDestinationCode(
                MatFlowMaterialRequisition requisition) {
            return requisition != null && requisition.destinationLocation != null
                    ? requisition.destinationLocation.locationCode
                    : null;
        }

        private PlantDashboardRow buildPlantDashboard(
                String plant,
                List<MatFlowProjectDrawing> projects,
                List<MatFlowBom> boms,
                List<MatFlowMaterialRequisition> requisitions,
                List<MatFlowTransferOrder> transfers,
                List<MatFlowQcInspection> inspections,
                List<MatFlowProcessingJob> jobs,
                List<MatFlowIndent> indents,
                List<MatFlowPurchaseOrder> orders,
                List<MatFlowStockBalance> balances) {
            long activeProjects = projects.stream()
                    .filter(project -> plantEquals(
                            project.getPlantCode(),
                            plant))
                    .count();

            long effectiveBoms = boms.stream()
                    .filter(bom -> bom.isEffective() &&
                            plantEquals(
                                    bom.getProjectDrawing()
                                            .getPlantCode(),
                                    plant))
                    .count();

            long openRequisitions = requisitions.stream()
                    .filter(requisition -> plantEquals(
                            requisitionPlant(requisition),
                            plant) &&
                            requisition.status != RequisitionStatus.CANCELLED &&
                            requisition.status != RequisitionStatus.COMPLETED &&
                            requisition.status != RequisitionStatus.PRODUCTION_COMPLETED)
                    .count();

            long shortageRequisitions = requisitions.stream()
                    .filter(requisition -> plantEquals(
                            requisitionPlant(requisition),
                            plant) &&
                            requisition.status == RequisitionStatus.SHORTAGE_PENDING)
                    .count();

            long readyOutbound = transfers.stream()
                    .filter(transfer -> plantEquals(
                            transfer.fromLocation.plantCode,
                            plant) &&
                            transfer.status == TransferStatus.READY)
                    .count();

            long inTransitOutbound = transfers.stream()
                    .filter(transfer -> plantEquals(
                            transfer.fromLocation.plantCode,
                            plant) &&
                            (transfer.status == TransferStatus.IN_TRANSIT ||
                                    transfer.status == TransferStatus.PARTIALLY_DISPATCHED ||
                                    transfer.status == TransferStatus.PARTIALLY_RECEIVED))
                    .count();

            long expectedInbound = transfers.stream()
                    .filter(transfer -> plantEquals(
                            transfer.toLocation.plantCode,
                            plant) &&
                            (transfer.status == TransferStatus.IN_TRANSIT ||
                                    transfer.status == TransferStatus.PARTIALLY_DISPATCHED ||
                                    transfer.status == TransferStatus.PARTIALLY_RECEIVED))
                    .count();

            long pendingQc = inspections.stream()
                    .filter(inspection -> plantEquals(
                            inspection.location.plantCode,
                            plant) &&
                            inspection.status == QcInspectionStatus.PENDING)
                    .count();

            long activeJobs = jobs.stream()
                    .filter(job -> plantEquals(
                            job.location.plantCode,
                            plant) &&
                            job.status != ProcessingJobStatus.COMPLETED &&
                            job.status != ProcessingJobStatus.CANCELLED)
                    .count();

            long openIndents = indents.stream()
                    .filter(indent -> plantEquals(
                            indent.deliverToLocation.plantCode,
                            plant) &&
                            indent.status != IndentStatus.RECEIVED &&
                            indent.status != IndentStatus.CANCELLED)
                    .count();

            long openOrders = orders.stream()
                    .filter(order -> plantEquals(
                            order.deliveryLocation.plantCode,
                            plant) &&
                            order.status != PurchaseOrderStatus.RECEIVED &&
                            order.status != PurchaseOrderStatus.CANCELLED)
                    .count();

            List<MatFlowStockBalance> plantBalances = balances.stream()
                    .filter(balance -> plantEquals(
                            balance.location.plantCode,
                            plant))
                    .toList();

            long lowStockLines = plantBalances.stream()
                    .filter(this::isLowStock)
                    .count();

            long blockedLines = plantBalances.stream()
                    .filter(balance -> balance.blockedQty
                            .compareTo(
                                    BigDecimal.ZERO) > 0)
                    .count();

            long transitLines = plantBalances.stream()
                    .filter(balance -> balance.inTransitQty
                            .compareTo(
                                    BigDecimal.ZERO) > 0)
                    .count();

            return new PlantDashboardRow(
                    plant,
                    activeProjects,
                    effectiveBoms,
                    openRequisitions,
                    shortageRequisitions,
                    readyOutbound,
                    inTransitOutbound,
                    expectedInbound,
                    pendingQc,
                    activeJobs,
                    openIndents,
                    openOrders,
                    plantBalances.size(),
                    lowStockLines,
                    blockedLines,
                    transitLines);
        }

        private boolean isLowStock(
                MatFlowStockBalance balance) {
            BigDecimal reorderLevel = balance.material
                    .getReorderLevel();

            return reorderLevel != null &&
                    reorderLevel.compareTo(
                            BigDecimal.ZERO) > 0
                    &&
                    balance.availableQty()
                            .compareTo(
                                    reorderLevel) <= 0;
        }

        private StockLedgerRow toLedgerRow(
                MatFlowStockLedger ledger) {
            return new StockLedgerRow(
                    ledger.id,

                    ledger.material.getId(),
                    ledger.material
                            .getMaterialCode(),
                    ledger.material
                            .getMaterialName(),
                    ledger.material.getUom(),

                    ledger.location.getId(),
                    ledger.location.locationCode,
                    ledger.location.plantCode,

                    ledger.movementType,

                    ledger.quantityChange,
                    ledger.reservedChange,
                    ledger.blockedChange,
                    ledger.inTransitChange,

                    ledger.onHandAfter,
                    ledger.reservedAfter,
                    ledger.blockedAfter,
                    ledger.inTransitAfter,

                    ledger.referenceType,
                    ledger.referenceId,
                    ledger.referenceNumber,

                    ledger.projectCode,
                    ledger.drawingNo,
                    ledger.batchNo,

                    ledger.remarks,
                    ledger.actor,
                    ledger.actionAt);
        }

        private Set<String> resolvePlants(
                String plantCode) {
            if (plantCode != null &&
                    !plantCode.trim().isBlank()) {
                String normalized = normalizePlant(plantCode);

                accessService.requirePlantAccess(
                        normalized);

                return Set.of(normalized);
            }

            return accessService
                    .allowedPlants()
                    .stream()
                    .map(this::normalizePlant)
                    .collect(
                            java.util.stream.Collectors
                                    .toCollection(
                                            LinkedHashSet::new));
        }

        private String normalizePlant(
                String value) {
            return value == null
                    ? ""
                    : value.trim()
                            .toUpperCase();
        }

        private boolean plantEquals(
                String left,
                String right) {
            return normalizePlant(left)
                    .equals(
                            normalizePlant(right));
        }

        private long sum(
                List<PlantDashboardRow> rows,
                java.util.function.ToLongFunction<PlantDashboardRow> mapper) {
            return rows.stream()
                    .mapToLong(mapper)
                    .sum();
        }

        private int safePage(int page) {
            return Math.max(page, 0);
        }

        private int safeSize(int size) {
            if (size <= 0) {
                return 25;
            }

            return Math.min(size, 200);
        }

        private String likePattern(String value) {
            String cleaned = clean(value);
            return cleaned == null
                    ? ""
                    : "%" + cleaned.toLowerCase(Locale.ROOT) + "%";
        }

        private String upperFilter(String value) {
            String cleaned = clean(value);
            return cleaned == null ? "" : cleaned.toUpperCase(Locale.ROOT);
        }

        private String clean(String value) {
            if (value == null) {
                return null;
            }

            String result = value.trim();

            return result.isBlank()
                    ? null
                    : result;
        }

        private ResponseStatusException notFound(
                String message) {
            return new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    message);
        }

    }

    private static final class TrackerModule {

        private static final Set<String> CLOSED_TRANSFER_STATUSES = Set.of(
                "RECEIVED",
                "COMPLETED",
                "CANCELLED");

        private static final Set<String> CLOSED_INDENT_STATUSES = Set.of(
                "COMPLETED",
                "CLOSED",
                "CANCELLED",
                "PURCHASE_COMPLETED");

        private final MatFlowMaterialRequisitionRepository requisitionRepository;
        private final MatFlowRequisitionLineRepository requisitionLineRepository;
        private final MatFlowReservationRepository reservationRepository;
        private final MatFlowIndentRepository indentRepository;
        private final MatFlowTransferOrderRepository transferRepository;
        private final MatFlowAccessService accessService;

        TrackerModule(
                MatFlowMaterialRequisitionRepository requisitionRepository,
                MatFlowRequisitionLineRepository requisitionLineRepository,
                MatFlowReservationRepository reservationRepository,
                MatFlowIndentRepository indentRepository,
                MatFlowTransferOrderRepository transferRepository,
                MatFlowAccessService accessService) {

            this.requisitionRepository = requisitionRepository;
            this.requisitionLineRepository = requisitionLineRepository;
            this.reservationRepository = reservationRepository;
            this.indentRepository = indentRepository;
            this.transferRepository = transferRepository;
            this.accessService = accessService;
        }

        @Transactional(readOnly = true)
        public TrackerResponse getTracker(
                String search,
                String plantCode,
                String stage) {

            accessService.requireRead();

            String query = normalizeSearch(
                    search);

            String requestedPlant = normalizeCode(
                    plantCode);

            String requestedStage = normalizeCode(
                    stage);

            if (requestedPlant != null) {
                accessService.requirePlantAccess(
                        requestedPlant);
            }

            List<TrackerRowResponse> rows = requisitionRepository
                    .findAllByOrderByUpdatedAtDesc()
                    .stream()
                    .filter(this::hasReadableProject)
                    .filter(requisition -> accessService.canAccessPlant(
                            requisition.projectDrawing
                                    .getPlantCode()))
                    .map(this::toTrackerRow)
                    .filter(row -> requestedPlant == null ||
                            requestedPlant.equals(
                                    normalizeCode(
                                            row.destinationPlantCode())))
                    .filter(row -> requestedStage == null ||
                            requestedStage.equals(
                                    normalizeCode(
                                            row.currentStage())))
                    .filter(row -> query.isBlank() ||
                            matchesSearch(
                                    row,
                                    query))
                    .toList();

            return new TrackerResponse(
                    createKpis(
                            rows),
                    rows);
        }

        private TrackerRowResponse toTrackerRow(
                MatFlowMaterialRequisition requisition) {

            List<MatFlowRequisitionLine> lines = requisitionLineRepository
                    .findByRequisition_IdOrderByLineNoAsc(
                            requisition.getId());

            List<MatFlowReservation> reservations = reservationRepository
                    .findByRequisitionLine_Requisition_IdOrderByCreatedAtAsc(
                            requisition.getId());

            List<MatFlowIndent> indents = indentRepository
                    .findByRequisition_IdOrderByCreatedAtAsc(
                            requisition.getId());

            List<MatFlowTransferOrder> transfers = transferRepository
                    .findByRequisition_IdOrderByRouteSequenceNoAscCreatedAtAsc(
                            requisition.getId());

            BigDecimal requestedQty = sum(
                    lines,
                    QuantityField.REQUESTED);

            BigDecimal reservedQty = sum(
                    lines,
                    QuantityField.RESERVED);

            BigDecimal shortageQty = sum(
                    lines,
                    QuantityField.SHORTAGE);

            BigDecimal issuedQty = sum(
                    lines,
                    QuantityField.ISSUED);

            BigDecimal consumedQty = sum(
                    lines,
                    QuantityField.CONSUMED);

            BigDecimal returnedQty = sum(
                    lines,
                    QuantityField.RETURNED);

            int openIndentCount = (int) indents.stream()
                    .filter(this::isOpenIndent)
                    .count();

            int openTransferCount = (int) transfers.stream()
                    .filter(this::isOpenTransfer)
                    .count();

            int readyTransferCount = (int) transfers.stream()
                    .filter(transfer -> "READY".equals(
                            enumName(
                                    transfer.status)))
                    .count();

            String currentStage = resolveCurrentStage(
                    requisition.status,
                    requestedQty,
                    reservedQty,
                    shortageQty,
                    issuedQty,
                    consumedQty,
                    openTransferCount);

            String responsibleDesk = resolveResponsibleDesk(
                    currentStage);

            int progressPercent = resolveProgressPercent(
                    currentStage);

            MatFlowProjectDrawing project = requisition.projectDrawing;

            MatFlowLocation destination = requisition.destinationLocation;

            LocalDateTime ageAnchor = resolveAgeAnchor(
                    requisition,
                    currentStage);

            long ageHours = calculateAgeHours(
                    ageAnchor);

            return new TrackerRowResponse(
                    requisition.getId(),
                    requisition.requisitionNumber,

                    project == null
                            ? null
                            : project.getId(),

                    project == null
                            ? null
                            : project.getProjectCode(),

                    project == null
                            ? null
                            : project.getDrawingNo(),

                    requisition.bom == null
                            ? null
                            : requisition.bom.getId(),

                    requisition.bom == null
                            ? null
                            : requisition.bom.getBomNumber(),

                    requisition.bom == null
                            ? null
                            : requisition.bom.getRevisionNo(),

                    destination == null
                            ? null
                            : destination.getId(),

                    destination == null
                            ? null
                            : destination.getLocationCode(),

                    destination == null
                            ? null
                            : destination.getLocationName(),

                    destination == null
                            ? project == null
                                    ? null
                                    : project.getPlantCode()
                            : destination.getPlantCode(),

                    requisition.status,
                    currentStage,
                    responsibleDesk,
                    progressPercent,

                    requestedQty,
                    reservedQty,
                    shortageQty,
                    issuedQty,
                    consumedQty,
                    returnedQty,

                    reservations.size(),
                    indents.size(),
                    openIndentCount,
                    transfers.size(),
                    openTransferCount,
                    readyTransferCount,

                    requisition.requestedAt,
                    requisition.submittedAt,
                    requisition.plannedAt,
                    requisition.getUpdatedAt(),

                    ageHours,
                    requisition.getRowVersion());
        }

        private TrackerKpiResponse createKpis(
                List<TrackerRowResponse> rows) {

            int activeRequisitions = (int) rows.stream()
                    .filter(row -> !"CANCELLED".equals(
                            row.currentStage()) &&
                            !"PRODUCTION_COMPLETED".equals(
                                    row.currentStage()))
                    .count();

            int awaitingStorePlanning = countStage(
                    rows,
                    "AWAITING_STORE_PLANNING");

            int shortagePending = countStage(
                    rows,
                    "SHORTAGE_PENDING");

            int materialReserved = countStage(
                    rows,
                    "MATERIAL_RESERVED");

            int transfersInProgress = countStage(
                    rows,
                    "TRANSFER_IN_PROGRESS");

            int productionInProgress = countStage(
                    rows,
                    "PRODUCTION_ISSUE") +
                    countStage(
                            rows,
                            "PRODUCTION_IN_PROGRESS");

            int openIndents = rows.stream()
                    .mapToInt(
                            TrackerRowResponse::openIndentCount)
                    .sum();

            BigDecimal totalRequested = rows.stream()
                    .map(
                            TrackerRowResponse::requestedQty)
                    .reduce(
                            BigDecimal.ZERO,
                            BigDecimal::add);

            BigDecimal totalReserved = rows.stream()
                    .map(
                            TrackerRowResponse::reservedQty)
                    .reduce(
                            BigDecimal.ZERO,
                            BigDecimal::add);

            BigDecimal totalShortage = rows.stream()
                    .map(
                            TrackerRowResponse::shortageQty)
                    .reduce(
                            BigDecimal.ZERO,
                            BigDecimal::add);

            return new TrackerKpiResponse(
                    activeRequisitions,
                    awaitingStorePlanning,
                    shortagePending,
                    materialReserved,
                    transfersInProgress,
                    productionInProgress,
                    openIndents,
                    scale(
                            totalRequested),
                    scale(
                            totalReserved),
                    scale(
                            totalShortage));
        }

        private String resolveCurrentStage(
                RequisitionStatus status,
                BigDecimal requestedQty,
                BigDecimal reservedQty,
                BigDecimal shortageQty,
                BigDecimal issuedQty,
                BigDecimal consumedQty,
                int openTransferCount) {

            String statusName = enumName(
                    status);

            if ("CANCELLED".equals(statusName)) {
                return "CANCELLED";
            }

            if ("PRODUCTION_COMPLETED".equals(statusName) ||
                    "COMPLETED".equals(statusName)) {
                return "PRODUCTION_COMPLETED";
            }

            if ("PRODUCTION_STARTED".equals(statusName)) {
                return "PRODUCTION_IN_PROGRESS";
            }

            if ("ISSUED_TO_PRODUCTION".equals(statusName) ||
                    "PARTIALLY_ISSUED".equals(statusName) ||
                    "ISSUED".equals(statusName) ||
                    issuedQty.compareTo(BigDecimal.ZERO) > 0) {
                return "PRODUCTION_ISSUE";
            }

            if (openTransferCount > 0) {
                return "TRANSFER_IN_PROGRESS";
            }

            if (shortageQty.compareTo(BigDecimal.ZERO) > 0 ||
                    "SHORTAGE_PENDING".equals(statusName)) {
                return "SHORTAGE_PENDING";
            }

            if ("READY_TO_ISSUE".equals(statusName)) {
                return "READY_TO_ISSUE";
            }

            if ("PARTIALLY_RESERVED".equals(statusName) ||
                    "PLANNED".equals(statusName) ||
                    reservedQty.compareTo(BigDecimal.ZERO) > 0) {
                return "MATERIAL_RESERVED";
            }

            if ("SUBMITTED_TO_STORE".equals(statusName) ||
                    "STORE_REVIEW_IN_PROGRESS".equals(statusName) ||
                    "SUBMITTED".equals(statusName)) {
                return "AWAITING_STORE_PLANNING";
            }

            if ("DRAFT".equals(statusName)) {
                return "DRAFT";
            }

            return statusName.isBlank()
                    ? "UNKNOWN"
                    : statusName;
        }

        private String resolveResponsibleDesk(
                String stage) {

            return switch (stage) {
                case "DRAFT",
                        "PRODUCTION_ISSUE",
                        "PRODUCTION_IN_PROGRESS",
                        "PRODUCTION_COMPLETED" ->
                    "PRODUCTION";

                case "AWAITING_STORE_PLANNING",
                        "MATERIAL_RESERVED",
                        "READY_TO_ISSUE" ->
                    "STORE";

                case "SHORTAGE_PENDING" ->
                    "STORE / PURCHASE";

                case "TRANSFER_IN_PROGRESS" ->
                    "TRANSFER DESK";

                case "CANCELLED" ->
                    "CLOSED";

                default ->
                    "MATFLOW CONTROL";
            };
        }

        private int resolveProgressPercent(
                String stage) {

            return switch (stage) {
                case "DRAFT" -> 15;
                case "AWAITING_STORE_PLANNING" -> 30;
                case "SHORTAGE_PENDING" -> 48;
                case "MATERIAL_RESERVED" -> 58;
                case "TRANSFER_IN_PROGRESS" -> 72;
                case "READY_TO_ISSUE" -> 82;
                case "PRODUCTION_ISSUE" -> 88;
                case "PRODUCTION_IN_PROGRESS" -> 95;
                case "PRODUCTION_COMPLETED" -> 100;
                case "CANCELLED" -> 0;
                default -> 20;
            };
        }

        private LocalDateTime resolveAgeAnchor(
                MatFlowMaterialRequisition requisition,
                String currentStage) {

            if (currentStage.equals(
                    "AWAITING_STORE_PLANNING") &&
                    requisition.submittedAt != null) {

                return requisition.submittedAt;
            }

            if ((currentStage.equals(
                    "SHORTAGE_PENDING") ||
                    currentStage.equals(
                            "MATERIAL_RESERVED")
                    ||
                    currentStage.equals(
                            "TRANSFER_IN_PROGRESS"))
                    &&
                    requisition.plannedAt != null) {

                return requisition.plannedAt;
            }

            if (requisition.requestedAt != null) {
                return requisition.requestedAt;
            }

            return requisition.getCreatedAt();
        }

        private long calculateAgeHours(
                LocalDateTime value) {

            if (value == null) {
                return 0;
            }

            long hours = Duration.between(
                    value,
                    LocalDateTime.now())
                    .toHours();

            return Math.max(
                    hours,
                    0);
        }

        private boolean isOpenTransfer(
                MatFlowTransferOrder transfer) {

            if (transfer == null) {
                return false;
            }

            return !CLOSED_TRANSFER_STATUSES.contains(
                    enumName(
                            transfer.status));
        }

        private boolean isOpenIndent(
                MatFlowIndent indent) {

            if (indent == null) {
                return false;
            }

            return !CLOSED_INDENT_STATUSES.contains(
                    enumName(
                            indent.status));
        }

        private boolean hasReadableProject(
                MatFlowMaterialRequisition requisition) {

            return requisition != null &&
                    requisition.projectDrawing != null &&
                    normalizeCode(
                            requisition.projectDrawing
                                    .getPlantCode()) != null;
        }

        private boolean matchesSearch(
                TrackerRowResponse row,
                String query) {

            return contains(
                    row.requisitionNumber(),
                    query) ||
                    contains(
                            row.projectCode(),
                            query)
                    ||
                    contains(
                            row.drawingNo(),
                            query)
                    ||
                    contains(
                            row.bomNumber(),
                            query)
                    ||
                    contains(
                            row.destinationLocationCode(),
                            query)
                    ||
                    contains(
                            row.destinationLocationName(),
                            query)
                    ||
                    contains(
                            row.destinationPlantCode(),
                            query)
                    ||
                    contains(
                            row.currentStage(),
                            query)
                    ||
                    contains(
                            row.responsibleDesk(),
                            query);
        }

        private int countStage(
                List<TrackerRowResponse> rows,
                String stage) {

            return (int) rows.stream()
                    .filter(row -> stage.equals(
                            row.currentStage()))
                    .count();
        }

        private BigDecimal sum(
                List<MatFlowRequisitionLine> lines,
                QuantityField field) {

            return scale(
                    lines.stream()
                            .map(line -> quantityOf(
                                    line,
                                    field))
                            .reduce(
                                    BigDecimal.ZERO,
                                    BigDecimal::add));
        }

        private BigDecimal quantityOf(
                MatFlowRequisitionLine line,
                QuantityField field) {

            if (line == null) {
                return BigDecimal.ZERO;
            }

            return switch (field) {
                case REQUESTED ->
                    safe(
                            line.requestedQty);

                case RESERVED ->
                    safe(
                            line.reservedQty);

                case SHORTAGE ->
                    safe(
                            line.shortageQty);

                case ISSUED ->
                    safe(
                            line.issuedQty);

                case CONSUMED ->
                    safe(
                            line.consumedQty);

                case RETURNED ->
                    safe(
                            line.returnedQty);
            };
        }

        private BigDecimal safe(
                BigDecimal value) {

            return value == null
                    ? BigDecimal.ZERO
                    : value;
        }

        private BigDecimal scale(
                BigDecimal value) {

            return safe(
                    value).setScale(
                            3,
                            RoundingMode.HALF_UP);
        }

        private String normalizeSearch(
                String value) {

            return value == null
                    ? ""
                    : value.trim()
                            .toLowerCase(
                                    Locale.ROOT);
        }

        private String normalizeCode(
                String value) {

            if (value == null ||
                    value.trim().isBlank()) {

                return null;
            }

            return value.trim()
                    .toUpperCase(
                            Locale.ROOT);
        }

        private boolean contains(
                String value,
                String query) {

            return value != null &&
                    value.toLowerCase(
                            Locale.ROOT)
                            .contains(
                                    query);
        }

        private String enumName(
                Enum<?> value) {

            return value == null
                    ? ""
                    : value.name()
                            .toUpperCase(
                                    Locale.ROOT);
        }

        private enum QuantityField {
            REQUESTED,
            RESERVED,
            SHORTAGE,
            ISSUED,
            CONSUMED,
            RETURNED
        }
    }

    private static final class IntegrityModule {

        private final MatFlowStockBalanceRepository stockRepository;
        private final MatFlowRequisitionLineRepository requisitionLineRepository;
        private final MatFlowTransferLineRepository transferLineRepository;
        private final MatFlowGoodsReceiptLineRepository receiptLineRepository;
        private final MatFlowProcessingJobRepository processingRepository;
        private final MatFlowReservationRepository reservationRepository;
        private final MatFlowAccessService accessService;

        IntegrityModule(
                MatFlowStockBalanceRepository stockRepository,
                MatFlowRequisitionLineRepository requisitionLineRepository,
                MatFlowTransferLineRepository transferLineRepository,
                MatFlowGoodsReceiptLineRepository receiptLineRepository,
                MatFlowProcessingJobRepository processingRepository,
                MatFlowReservationRepository reservationRepository,
                MatFlowAccessService accessService) {
            this.stockRepository = stockRepository;

            this.requisitionLineRepository = requisitionLineRepository;

            this.transferLineRepository = transferLineRepository;

            this.receiptLineRepository = receiptLineRepository;

            this.processingRepository = processingRepository;

            this.reservationRepository = reservationRepository;

            this.accessService = accessService;
        }

        @Transactional(readOnly = true)
        public IntegrityReport inspect(
                String plantCode) {
            accessService.requireIntegrityRead();

            Set<String> plants = resolvePlants(plantCode);

            List<IntegrityViolation> violations = new ArrayList<>();

            long checkedRecords = 0;

            List<MatFlowStockBalance> balances = stockRepository.findAll()
                    .stream()
                    .filter(balance -> plants.contains(
                            normalizePlant(
                                    balance.location.plantCode)))
                    .toList();

            checkedRecords += balances.size();

            for (MatFlowStockBalance balance : balances) {
                inspectStockBalance(
                        balance,
                        violations);
            }

            List<MatFlowRequisitionLine> requisitionLines = requisitionLineRepository.findAll()
                    .stream()
                    .filter(line -> plants.contains(
                            requisitionPlant(line == null ? null : line.requisition)))
                    .toList();

            checkedRecords += requisitionLines.size();

            for (MatFlowRequisitionLine line : requisitionLines) {
                inspectRequisitionLine(
                        line,
                        violations);
            }

            List<MatFlowTransferLine> transferLines = transferLineRepository.findAll()
                    .stream()
                    .filter(line -> plants.contains(
                            normalizePlant(
                                    line.transferOrder.fromLocation.plantCode))
                            ||
                            plants.contains(
                                    normalizePlant(
                                            line.transferOrder.toLocation.plantCode)))
                    .toList();

            checkedRecords += transferLines.size();

            for (MatFlowTransferLine line : transferLines) {
                inspectTransferLine(
                        line,
                        violations);
            }

            List<MatFlowGoodsReceiptLine> receiptLines = receiptLineRepository.findAll()
                    .stream()
                    .filter(line -> plants.contains(
                            normalizePlant(
                                    line.goodsReceipt.receiptLocation.plantCode)))
                    .toList();

            checkedRecords += receiptLines.size();

            for (MatFlowGoodsReceiptLine line : receiptLines) {
                inspectReceiptLine(
                        line,
                        violations);
            }

            List<MatFlowProcessingJob> jobs = processingRepository.findAll()
                    .stream()
                    .filter(job -> plants.contains(
                            normalizePlant(
                                    job.location.plantCode)))
                    .toList();

            checkedRecords += jobs.size();

            for (MatFlowProcessingJob job : jobs) {
                inspectProcessingJob(
                        job,
                        violations);
            }

            List<MatFlowReservation> reservations = reservationRepository.findAll()
                    .stream()
                    .filter(reservation -> plants.contains(
                            normalizePlant(
                                    reservation.sourceLocation.plantCode))
                            ||
                            plants.contains(
                                    normalizePlant(
                                            reservation.demandPlantCode)))
                    .toList();

            checkedRecords += reservations.size();

            for (MatFlowReservation reservation : reservations) {
                inspectReservation(
                        reservation,
                        violations);
            }

            violations.sort(
                    Comparator
                            .comparing(
                                    IntegrityViolation::severity)
                            .thenComparing(
                                    IntegrityViolation::entityType)
                            .thenComparing(
                                    violation -> violation.reference() == null
                                            ? ""
                                            : violation.reference()));

            long criticalCount = violations.stream()
                    .filter(violation -> violation.severity() == IntegritySeverity.CRITICAL)
                    .count();

            long warningCount = violations.stream()
                    .filter(violation -> violation.severity() == IntegritySeverity.WARNING)
                    .count();

            IntegritySummary summary = new IntegritySummary(
                    checkedRecords,
                    criticalCount,
                    warningCount,
                    criticalCount == 0);

            return new IntegrityReport(
                    LocalDateTime.now(),
                    plants,
                    summary,
                    violations);
        }

        private void inspectStockBalance(
                MatFlowStockBalance balance,
                List<IntegrityViolation> violations) {
            BigDecimal onHand = value(balance.onHandQty);

            BigDecimal reserved = value(balance.reservedQty);

            BigDecimal blocked = value(balance.blockedQty);

            BigDecimal inTransit = value(balance.inTransitQty);

            String reference = balance.material.getMaterialCode() +
                    " @ " +
                    balance.location.locationCode;

            if (isNegative(onHand) ||
                    isNegative(reserved) ||
                    isNegative(blocked) ||
                    isNegative(inTransit)) {
                add(
                        violations,
                        IntegritySeverity.CRITICAL,
                        "NEGATIVE_STOCK_COMPONENT",
                        "STOCK_BALANCE",
                        balance.getId(),
                        reference,
                        balance.location.plantCode,
                        "Stock quantities cannot be negative.");
            }

            if (reserved.add(blocked)
                    .compareTo(onHand) > 0) {
                add(
                        violations,
                        IntegritySeverity.CRITICAL,
                        "RESERVED_BLOCKED_EXCEEDS_ON_HAND",
                        "STOCK_BALANCE",
                        balance.getId(),
                        reference,
                        balance.location.plantCode,
                        "Reserved plus blocked quantity exceeds physical on-hand stock.");
            }

            boolean containsStock = onHand.compareTo(
                    BigDecimal.ZERO) != 0 ||
                    reserved.compareTo(
                            BigDecimal.ZERO) != 0
                    ||
                    blocked.compareTo(
                            BigDecimal.ZERO) != 0
                    ||
                    inTransit.compareTo(
                            BigDecimal.ZERO) != 0;

            if (containsStock &&
                    !balance.location.supportsStock) {
                add(
                        violations,
                        IntegritySeverity.WARNING,
                        "NON_STOCK_LOCATION_HAS_BALANCE",
                        "STOCK_BALANCE",
                        balance.getId(),
                        reference,
                        balance.location.plantCode,
                        "A location that does not support stock has a non-zero balance.");
            }
        }

        private String requisitionPlant(
                MatFlowMaterialRequisition requisition) {
            if (requisition == null) {
                return "";
            }

            if (requisition.destinationLocation != null &&
                    requisition.destinationLocation.plantCode != null &&
                    !requisition.destinationLocation.plantCode.isBlank()) {
                return normalizePlant(requisition.destinationLocation.plantCode);
            }

            if (requisition.projectDrawing != null) {
                return normalizePlant(requisition.projectDrawing.getPlantCode());
            }

            return "";
        }

        private void inspectRequisitionLine(
                MatFlowRequisitionLine line,
                List<IntegrityViolation> violations) {
            BigDecimal requested = value(line.requestedQty);

            BigDecimal reserved = value(line.reservedQty);

            BigDecimal shortage = value(line.shortageQty);

            BigDecimal issued = value(line.issuedQty);

            BigDecimal consumed = value(line.consumedQty);

            BigDecimal returned = value(line.returnedQty);

            String reference = line.requisition.requisitionNumber +
                    " / line " +
                    line.lineNo;

            if (line.requisition.destinationLocation == null) {
                add(
                        violations,
                        IntegritySeverity.CRITICAL,
                        "REQUISITION_DESTINATION_MISSING",
                        "REQUISITION",
                        line.requisition.getId(),
                        line.requisition.requisitionNumber,
                        requisitionPlant(line.requisition),
                        "Requisition has no destination location. Repair legacy data before further execution.");
            }

            if (isNegative(requested) ||
                    isNegative(reserved) ||
                    isNegative(shortage) ||
                    isNegative(issued) ||
                    isNegative(consumed) ||
                    isNegative(returned)) {
                add(
                        violations,
                        IntegritySeverity.CRITICAL,
                        "NEGATIVE_REQUISITION_QUANTITY",
                        "REQUISITION_LINE",
                        line.getId(),
                        reference,
                        requisitionPlant(line.requisition),
                        "Requisition quantities cannot be negative.");
            }

            if (consumed.add(returned)
                    .compareTo(issued) > 0) {
                add(
                        violations,
                        IntegritySeverity.CRITICAL,
                        "CONSUMED_RETURNED_EXCEEDS_ISSUED",
                        "REQUISITION_LINE",
                        line.getId(),
                        reference,
                        requisitionPlant(line.requisition),
                        "Consumed plus returned quantity exceeds issued quantity.");
            }

            if (shortage.compareTo(requested) > 0) {
                add(
                        violations,
                        IntegritySeverity.CRITICAL,
                        "SHORTAGE_EXCEEDS_REQUESTED",
                        "REQUISITION_LINE",
                        line.getId(),
                        reference,
                        requisitionPlant(line.requisition),
                        "Shortage quantity exceeds requested quantity.");
            }

            if (issued.compareTo(requested) > 0) {
                add(
                        violations,
                        IntegritySeverity.WARNING,
                        "ISSUED_EXCEEDS_REQUESTED",
                        "REQUISITION_LINE",
                        line.getId(),
                        reference,
                        requisitionPlant(line.requisition),
                        "Issued quantity exceeds requested quantity.");
            }
        }

        private void inspectTransferLine(
                MatFlowTransferLine line,
                List<IntegrityViolation> violations) {
            BigDecimal planned = value(line.plannedQty);

            BigDecimal dispatched = value(line.dispatchedQty);

            BigDecimal received = value(line.receivedQty);

            String reference = line.transferOrder.transferNumber +
                    " / " +
                    line.material
                            .getMaterialCode();

            String plant = line.transferOrder.fromLocation.plantCode;

            if (isNegative(planned) ||
                    isNegative(dispatched) ||
                    isNegative(received)) {
                add(
                        violations,
                        IntegritySeverity.CRITICAL,
                        "NEGATIVE_TRANSFER_QUANTITY",
                        "TRANSFER_LINE",
                        line.getId(),
                        reference,
                        plant,
                        "Transfer quantities cannot be negative.");
            }

            if (dispatched.compareTo(
                    planned) > 0) {
                add(
                        violations,
                        IntegritySeverity.CRITICAL,
                        "DISPATCHED_EXCEEDS_PLANNED",
                        "TRANSFER_LINE",
                        line.getId(),
                        reference,
                        plant,
                        "Dispatched quantity exceeds planned quantity.");
            }

            if (received.compareTo(
                    dispatched) > 0) {
                add(
                        violations,
                        IntegritySeverity.CRITICAL,
                        "RECEIVED_EXCEEDS_DISPATCHED",
                        "TRANSFER_LINE",
                        line.getId(),
                        reference,
                        plant,
                        "Received quantity exceeds dispatched quantity.");
            }

            if (line.transferOrder.status == TransferStatus.RECEIVED &&
                    received.compareTo(planned) < 0) {
                add(
                        violations,
                        IntegritySeverity.WARNING,
                        "RECEIVED_STATUS_WITH_OPEN_QUANTITY",
                        "TRANSFER_LINE",
                        line.getId(),
                        reference,
                        plant,
                        "Transfer is marked Received but planned quantity is not fully received.");
            }
        }

        private void inspectReceiptLine(
                MatFlowGoodsReceiptLine line,
                List<IntegrityViolation> violations) {
            BigDecimal received = value(line.receivedQty);

            BigDecimal accepted = value(line.acceptedQty);

            BigDecimal rejected = value(line.rejectedQty);

            BigDecimal returned = value(line.returnedQty);

            String reference = line.goodsReceipt.grnNumber +
                    " / " +
                    line.material.getMaterialCode();

            String plant = line.goodsReceipt.receiptLocation.plantCode;

            if (accepted.add(rejected)
                    .compareTo(received) > 0) {
                add(
                        violations,
                        IntegritySeverity.CRITICAL,
                        "QC_DECISION_EXCEEDS_GRN",
                        "GOODS_RECEIPT_LINE",
                        line.getId(),
                        reference,
                        plant,
                        "Accepted plus rejected quantity exceeds received quantity.");
            }

            if (returned.compareTo(rejected) > 0) {
                add(
                        violations,
                        IntegritySeverity.CRITICAL,
                        "VENDOR_RETURN_EXCEEDS_REJECTED",
                        "GOODS_RECEIPT_LINE",
                        line.getId(),
                        reference,
                        plant,
                        "Returned quantity exceeds QC-rejected quantity.");
            }
        }

        private void inspectProcessingJob(
                MatFlowProcessingJob job,
                List<IntegrityViolation> violations) {
            BigDecimal actualInput = value(job.actualInputQty);

            BigDecimal output = value(job.outputQty);

            BigDecimal wastage = value(job.wastageQty);

            if (job.status == ProcessingJobStatus.COMPLETED &&
                    output.add(wastage)
                            .compareTo(actualInput) != 0) {
                add(
                        violations,
                        IntegritySeverity.CRITICAL,
                        "PROCESSING_NOT_BALANCED",
                        "PROCESSING_JOB",
                        job.getId(),
                        job.jobNumber,
                        job.location.plantCode,
                        "Completed processing output plus wastage does not equal actual input.");
            }

            if (job.status == ProcessingJobStatus.IN_PROGRESS &&
                    actualInput.compareTo(
                            BigDecimal.ZERO) <= 0) {
                add(
                        violations,
                        IntegritySeverity.CRITICAL,
                        "PROCESSING_STARTED_WITHOUT_INPUT",
                        "PROCESSING_JOB",
                        job.getId(),
                        job.jobNumber,
                        job.location.plantCode,
                        "Processing is in progress without a positive actual input quantity.");
            }
        }

        private void inspectReservation(
                MatFlowReservation reservation,
                List<IntegrityViolation> violations) {
            BigDecimal quantity = value(
                    reservation.reservedQty);

            if (reservation.status == ReservationStatus.ACTIVE &&
                    quantity.compareTo(
                            BigDecimal.ZERO) <= 0) {
                add(
                        violations,
                        IntegritySeverity.CRITICAL,
                        "ACTIVE_ZERO_RESERVATION",
                        "RESERVATION",
                        reservation.getId(),
                        reservation.requisitionLine.requisition.requisitionNumber,
                        reservation.sourceLocation.plantCode,
                        "An active reservation must have a positive reserved quantity.");
            }

            if (reservation.status == ReservationStatus.ACTIVE &&
                    !reservation.sourceLocation.active) {
                add(
                        violations,
                        IntegritySeverity.WARNING,
                        "ACTIVE_RESERVATION_AT_INACTIVE_LOCATION",
                        "RESERVATION",
                        reservation.getId(),
                        reservation.requisitionLine.requisition.requisitionNumber,
                        reservation.sourceLocation.plantCode,
                        "An active reservation points to an inactive location.");
            }
        }

        private void add(
                List<IntegrityViolation> violations,
                IntegritySeverity severity,
                String checkCode,
                String entityType,
                java.util.UUID entityId,
                String reference,
                String plantCode,
                String message) {
            violations.add(
                    new IntegrityViolation(
                            severity,
                            checkCode,
                            entityType,
                            entityId,
                            reference,
                            normalizePlant(plantCode),
                            message));
        }

        private Set<String> resolvePlants(
                String plantCode) {
            if (plantCode != null &&
                    !plantCode.trim().isBlank()) {
                String normalized = normalizePlant(plantCode);

                accessService.requirePlantAccess(
                        normalized);

                return Set.of(normalized);
            }

            return accessService
                    .allowedPlants()
                    .stream()
                    .map(this::normalizePlant)
                    .collect(
                            java.util.stream.Collectors
                                    .toCollection(
                                            LinkedHashSet::new));
        }

        private BigDecimal value(
                BigDecimal value) {
            return value == null
                    ? BigDecimal.ZERO
                    : value;
        }

        private boolean isNegative(
                BigDecimal value) {
            return value.compareTo(
                    BigDecimal.ZERO) < 0;
        }

        private String normalizePlant(
                String plantCode) {
            return plantCode == null
                    ? ""
                    : plantCode.trim()
                            .toUpperCase();
        }
    }
}
