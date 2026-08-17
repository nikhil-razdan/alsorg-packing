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
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.hibernate.Hibernate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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

        private static final Logger LOG = LoggerFactory.getLogger(MatFlowInsightService.class);

        private final ReportingModule reporting;
        private final TrackerModule tracker;
        private final IntegrityModule integrity;

        public MatFlowInsightService(
                        MatFlowProjectDrawingRepository projectRepository,
                        MatFlowProjectRepository projectHeaderRepository,
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
                        MatFlowAccessService accessService,
                        MatFlowPlantRoutingService plantRoutingService) {

                this.reporting = new ReportingModule(
                                projectRepository,
                                projectHeaderRepository,
                                bomRepository,
                                requisitionRepository,
                                requisitionLineRepository,
                                indentRepository,
                                purchaseOrderRepository,
                                receiptRepository,
                                transferRepository,
                                qcRepository,
                                processingRepository,
                                ledgerRepository,
                                auditRepository,
                                reservationRepository,
                                accessService);

                this.tracker = new TrackerModule(
                                requisitionRepository,
                                requisitionLineRepository,
                                reservationRepository,
                                indentRepository,
                                purchaseOrderRepository,
                                receiptRepository,
                                transferRepository,
                                qcRepository,
                                processingRepository,
                                auditRepository,
                                accessService,
                                plantRoutingService);

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
                        MovementType movementType,
                        LocalDateTime fromDate,
                        LocalDateTime toDate,
                        String search,
                        int page,
                        int size) {
                return reporting.stockLedger(
                                plantCode, materialId, movementType, fromDate, toDate, search, page, size);
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
        public TrackerDetailResponse trackerDetail(UUID requisitionId) {
                return tracker.getDetail(requisitionId);
        }

        @Transactional(readOnly = true)
        public IntegrityReport inspectIntegrity(String plantCode) {
                return integrity.inspect(plantCode);
        }

        private static final class ReportingModule {

                private final MatFlowProjectDrawingRepository projectRepository;
                private final MatFlowProjectRepository projectHeaderRepository;
                private final MatFlowBomRepository bomRepository;
                private final MatFlowMaterialRequisitionRepository requisitionRepository;
                private final MatFlowRequisitionLineRepository requisitionLineRepository;
                private final MatFlowIndentRepository indentRepository;
                private final MatFlowPurchaseOrderRepository purchaseOrderRepository;
                private final MatFlowGoodsReceiptRepository receiptRepository;
                private final MatFlowTransferOrderRepository transferRepository;
                private final MatFlowQcInspectionRepository qcRepository;
                private final MatFlowProcessingJobRepository processingRepository;
                private final MatFlowStockLedgerRepository ledgerRepository;
                private final MatFlowAuditLogRepository auditRepository;
                private final MatFlowReservationRepository reservationRepository;
                private final MatFlowAccessService accessService;

                ReportingModule(
                                MatFlowProjectDrawingRepository projectRepository,
                                MatFlowProjectRepository projectHeaderRepository,
                                MatFlowBomRepository bomRepository,
                                MatFlowMaterialRequisitionRepository requisitionRepository,
                                MatFlowRequisitionLineRepository requisitionLineRepository,
                                MatFlowIndentRepository indentRepository,
                                MatFlowPurchaseOrderRepository purchaseOrderRepository,
                                MatFlowGoodsReceiptRepository receiptRepository,
                                MatFlowTransferOrderRepository transferRepository,
                                MatFlowQcInspectionRepository qcRepository,
                                MatFlowProcessingJobRepository processingRepository,
                                MatFlowStockLedgerRepository ledgerRepository,
                                MatFlowAuditLogRepository auditRepository,
                                MatFlowReservationRepository reservationRepository,
                                MatFlowAccessService accessService) {
                        this.projectRepository = projectRepository;
                        this.projectHeaderRepository = projectHeaderRepository;

                        this.bomRepository = bomRepository;

                        this.requisitionRepository = requisitionRepository;

                        this.requisitionLineRepository = requisitionLineRepository;

                        this.indentRepository = indentRepository;

                        this.purchaseOrderRepository = purchaseOrderRepository;

                        this.receiptRepository = receiptRepository;

                        this.transferRepository = transferRepository;

                        this.qcRepository = qcRepository;

                        this.processingRepository = processingRepository;

                        this.ledgerRepository = ledgerRepository;

                        this.auditRepository = auditRepository;

                        this.reservationRepository = reservationRepository;

                        this.accessService = accessService;
                }

                @Transactional(readOnly = true)
                public DashboardResponse dashboard(
                                String plantCode) {
                        accessService.requireRead();

                        Set<String> plants = resolvePlants(plantCode);

                        /* Project/Product ownership decides plant visibility. */
                        List<MatFlowProject> projects = projectHeaderRepository
                                        .findAllByOrderByUpdatedAtDesc()
                                        .stream()
                                        .filter(project -> project.isActive()
                                                        && plants.contains(normalizePlant(project.getPlantCode())))
                                        .toList();

                        List<MatFlowBom> boms = bomRepository.findAll().stream()
                                        .filter(bom -> bom != null && bom.getProjectDrawing() != null)
                                        .filter(bom -> plants.contains(
                                                        normalizePlant(bom.getProjectDrawing().getPlantCode())))
                                        .toList();

                        List<MatFlowMaterialRequisition> requisitions = requisitionRepository
                                        .findAllByOrderByUpdatedAtDesc().stream()
                                        .filter(requisition -> plants.contains(requisitionPlant(requisition)))
                                        .toList();

                        /*
                         * Internal transfer/QC/processing persistence may still reference hidden
                         * compatibility nodes, but dashboard ownership always follows the MR's
                         * originating Production plant. No generic Location is exposed or used as
                         * the business filter.
                         */
                        List<MatFlowTransferOrder> transfers = transferRepository
                                        .findAllByOrderByUpdatedAtDesc().stream()
                                        .filter(transfer -> plants.contains(transferDemandPlant(transfer)))
                                        .toList();

                        List<MatFlowQcInspection> inspections = qcRepository
                                        .findAllByOrderByCreatedAtDesc().stream()
                                        .filter(inspection -> plants.contains(qcDemandPlant(inspection)))
                                        .toList();

                        List<MatFlowProcessingJob> jobs = processingRepository
                                        .findAllByOrderByUpdatedAtDesc().stream()
                                        .filter(job -> plants.contains(processingDemandPlant(job)))
                                        .toList();

                        List<MatFlowIndent> indents = indentRepository.findAll().stream()
                                        .filter(indent -> plants.contains(indentDemandPlant(indent)))
                                        .toList();

                        List<MatFlowPurchaseOrder> purchaseOrders = purchaseOrderRepository
                                        .findAllByOrderByUpdatedAtDesc().stream()
                                        .filter(order -> plants.contains(orderDemandPlant(order)))
                                        .toList();

                        List<PlantDashboardRow> rows = plants.stream()
                                        .sorted()
                                        .map(plant -> buildPlantDashboard(
                                                        plant, projects, boms, requisitions, transfers, inspections,
                                                        jobs, indents, purchaseOrders))
                                        .toList();

                        DashboardTotals totals = new DashboardTotals(
                                        sum(rows, PlantDashboardRow::activeProjects),
                                        sum(rows, PlantDashboardRow::effectiveBoms),
                                        sum(rows, PlantDashboardRow::openRequisitions),
                                        sum(rows, PlantDashboardRow::shortageRequisitions),
                                        sum(rows, PlantDashboardRow::readyToIssueRequisitions),
                                        sum(rows, PlantDashboardRow::materialInTransitRequisitions),
                                        sum(rows, PlantDashboardRow::pendingQcInspections),
                                        sum(rows, PlantDashboardRow::activeProcessingJobs),
                                        sum(rows, PlantDashboardRow::openIndents),
                                        sum(rows, PlantDashboardRow::openPurchaseOrders));

                        return new DashboardResponse(LocalDateTime.now(), plants, totals, rows);
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
                                                        bom.getProductionReviewedBy(),
                                                        bom.getProductionReviewedAt()))
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
                                                                .filter(line -> scale(line.consumedQty)
                                                                                .add(scale(line.returnedQty))
                                                                                .add(productionWasteForLine(
                                                                                                line.getId()))
                                                                                .compareTo(scale(line.issuedQty)) >= 0)
                                                                .count();

                                                return new ProjectRequisitionSummary(
                                                                requisition.getId(),
                                                                requisition.requisitionNumber,
                                                                requisition.status,
                                                                requisitionPlant(requisition),
                                                                requisition.requestedBy,
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

                private BigDecimal productionWasteForLine(UUID requisitionLineId) {
                        if (requisitionLineId == null) {
                                return BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP);
                        }
                        return ledgerRepository.findAll((root, query, cb) -> cb.and(
                                        cb.equal(root.get("movementType"), MovementType.SCRAP),
                                        cb.equal(root.get("referenceType"), "MATFLOW_PRODUCTION_WASTE"),
                                        cb.equal(root.get("referenceId"), requisitionLineId)))
                                        .stream()
                                        .map(entry -> scale(entry.quantityChange).abs())
                                        .reduce(BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP), BigDecimal::add)
                                        .setScale(3, RoundingMode.HALF_UP);
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
                                                                requisitionPlant(line.requisition),
                                                                line.requisition.requestedBy,
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
                                                                        cb.like(cb.lower(cb.coalesce(root.<String>get(
                                                                                        "referenceNumber"), "")), like),
                                                                        cb.like(cb.lower(cb.coalesce(
                                                                                        root.<String>get("projectCode"),
                                                                                        "")), like),
                                                                        cb.like(cb.lower(cb.coalesce(
                                                                                        root.<String>get("drawingNo"),
                                                                                        "")), like),
                                                                        cb.like(cb.lower(cb.coalesce(
                                                                                        root.<String>get("batchNo"),
                                                                                        "")), like),
                                                                        cb.like(cb.lower(cb.coalesce(
                                                                                        root.<String>get("actor"), "")),
                                                                                        like)));
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
                                                                        cb.like(cb.lower(cb.coalesce(
                                                                                        root.<String>get("actor"), "")),
                                                                                        like),
                                                                        cb.like(cb.lower(cb.coalesce(
                                                                                        root.<String>get("projectCode"),
                                                                                        "")), like),
                                                                        cb.like(cb.lower(cb.coalesce(
                                                                                        root.<String>get("drawingNo"),
                                                                                        "")), like),
                                                                        cb.like(cb.lower(cb.coalesce(
                                                                                        root.<String>get("detailsJson"),
                                                                                        "")), like)));
                                }

                                return cb.and(predicates.toArray(Predicate[]::new));
                        };
                }

                private String requisitionPlant(
                                MatFlowMaterialRequisition requisition) {
                        if (requisition == null) {
                                return "";
                        }

                        /*
                         * The Product/Project plant is the business owner of an MR and is
                         * therefore authoritative for reporting. destinationLocation is a
                         * hidden legacy compatibility association only and is used solely as
                         * a fallback for historical rows that lost Project context.
                         */
                        if (requisition.projectDrawing != null
                                        && clean(requisition.projectDrawing.getPlantCode()) != null) {
                                return normalizePlant(requisition.projectDrawing.getPlantCode());
                        }

                        if (requisition.destinationLocation != null
                                        && clean(requisition.destinationLocation.plantCode) != null) {
                                return normalizePlant(requisition.destinationLocation.plantCode);
                        }

                        return "";
                }

                private String transferDemandPlant(MatFlowTransferOrder transfer) {
                        return transfer == null ? "" : requisitionPlant(transfer.requisition);
                }

                private String processingDemandPlant(MatFlowProcessingJob job) {
                        return job == null ? "" : requisitionPlant(job.requisition);
                }

                private String indentDemandPlant(MatFlowIndent indent) {
                        return indent == null ? "" : requisitionPlant(indent.requisition);
                }

                private String orderDemandPlant(MatFlowPurchaseOrder order) {
                        return order == null || order.indent == null ? "" : indentDemandPlant(order.indent);
                }

                private String qcDemandPlant(MatFlowQcInspection inspection) {
                        if (inspection == null) {
                                return "";
                        }

                        if (inspection.routingReservationId != null) {
                                MatFlowReservation reservation = reservationRepository
                                                .findById(inspection.routingReservationId)
                                                .map(value -> (MatFlowReservation) Hibernate.unproxy(value))
                                                .orElse(null);
                                if (reservation != null && reservation.requisitionLine != null) {
                                        MatFlowRequisitionLine line = (MatFlowRequisitionLine) Hibernate
                                                        .unproxy(reservation.requisitionLine);
                                        if (line.requisition != null) {
                                                return requisitionPlant((MatFlowMaterialRequisition) Hibernate
                                                                .unproxy(line.requisition));
                                        }
                                }
                        }

                        if (inspection.sourceType == QcSourceType.TRANSFER_RECEIPT
                                        && inspection.sourceId != null) {
                                MatFlowTransferOrder transfer = transferRepository.findById(inspection.sourceId)
                                                .map(value -> (MatFlowTransferOrder) Hibernate.unproxy(value))
                                                .orElse(null);
                                if (transfer != null) {
                                        return transferDemandPlant(transfer);
                                }
                        }

                        if (inspection.sourceType == QcSourceType.GOODS_RECEIPT
                                        && inspection.sourceId != null) {
                                MatFlowGoodsReceipt receipt = receiptRepository.findById(inspection.sourceId)
                                                .map(value -> (MatFlowGoodsReceipt) Hibernate.unproxy(value))
                                                .orElse(null);
                                if (receipt != null && receipt.purchaseOrder != null) {
                                        MatFlowPurchaseOrder order = (MatFlowPurchaseOrder) Hibernate
                                                        .unproxy(receipt.purchaseOrder);
                                        return orderDemandPlant(order);
                                }
                        }

                        return "";
                }

                private String businessDepartment(MatFlowLocation technicalNode) {
                        if (technicalNode == null || technicalNode.getLocationType() == null) {
                                return "MATFLOW";
                        }
                        return switch (technicalNode.getLocationType()) {
                                case STORE -> "STORE";
                                case PRODUCTION -> "PRODUCTION";
                                case PROCESSING, EXTERNAL_PROCESSOR -> "PROCESSING";
                                case SUPPLIER -> "SUPPLIER / PURCHASE";
                                case TRANSIT -> "IN TRANSIT";
                                case QC -> "QUALITY CONTROL";
                        };
                }

                /**
                 * Converts a hidden compatibility node into a non-selectable business
                 * point label. No generic Location identifier/code is exposed.
                 */
                private String businessPoint(MatFlowLocation technicalNode) {
                        if (technicalNode == null) {
                                return null;
                        }
                        String plant = clean(technicalNode.getPlantCode());
                        LocationType type = technicalNode.getLocationType();
                        if (type == null) {
                                return plant;
                        }
                        return switch (type) {
                                case STORE -> MatFlowPlantRoutingService.MAIN_STORE_PLANT.equalsIgnoreCase(plant)
                                                ? "AL-P1 MAIN STORE"
                                                : (plant == null ? "PLANT STORE" : plant + " STORE");
                                case PRODUCTION -> plant == null ? "PRODUCTION" : plant + " PRODUCTION";
                                case PROCESSING, EXTERNAL_PROCESSOR -> clean(technicalNode.getLocationName()) == null
                                                ? (clean(technicalNode.getLocationCode()) == null
                                                                ? "PROCESSING UNIT"
                                                                : technicalNode.getLocationCode())
                                                : technicalNode.getLocationName();
                                case SUPPLIER -> "SUPPLIER";
                                case TRANSIT -> "IN TRANSIT";
                                case QC -> "QC CHECK";
                        };
                }

                private PlantDashboardRow buildPlantDashboard(
                                String plant,
                                List<MatFlowProject> projects,
                                List<MatFlowBom> boms,
                                List<MatFlowMaterialRequisition> requisitions,
                                List<MatFlowTransferOrder> transfers,
                                List<MatFlowQcInspection> inspections,
                                List<MatFlowProcessingJob> jobs,
                                List<MatFlowIndent> indents,
                                List<MatFlowPurchaseOrder> orders) {
                        long activeProjects = projects.stream()
                                        .filter(project -> plantEquals(project.getPlantCode(), plant))
                                        .count();

                        long effectiveBoms = boms.stream()
                                        .filter(bom -> bom.isEffective()
                                                        && bom.getProjectDrawing() != null
                                                        && plantEquals(bom.getProjectDrawing().getPlantCode(), plant))
                                        .count();

                        long openRequisitions = requisitions.stream()
                                        .filter(requisition -> plantEquals(requisitionPlant(requisition), plant)
                                                        && requisition.status != RequisitionStatus.CANCELLED
                                                        && requisition.status != RequisitionStatus.COMPLETED
                                                        && requisition.status != RequisitionStatus.PRODUCTION_COMPLETED)
                                        .count();

                        long shortageRequisitions = requisitions.stream()
                                        .filter(requisition -> plantEquals(requisitionPlant(requisition), plant)
                                                        && requisition.status == RequisitionStatus.SHORTAGE_PENDING)
                                        .count();

                        long readyToIssue = requisitions.stream()
                                        .filter(requisition -> plantEquals(requisitionPlant(requisition), plant)
                                                        && requisition.status == RequisitionStatus.READY_TO_ISSUE)
                                        .count();

                        long materialInTransit = transfers.stream()
                                        .filter(transfer -> plantEquals(transferDemandPlant(transfer), plant))
                                        .filter(transfer -> transfer != null
                                                        && (transfer.status == TransferStatus.IN_TRANSIT
                                                                        || transfer.status == TransferStatus.PARTIALLY_DISPATCHED
                                                                        || transfer.status == TransferStatus.PARTIALLY_RECEIVED))
                                        .map(transfer -> transfer.requisition == null ? transfer.getId()
                                                        : transfer.requisition.getId())
                                        .filter(java.util.Objects::nonNull)
                                        .distinct()
                                        .count();

                        long pendingQc = inspections.stream()
                                        .filter(inspection -> plantEquals(qcDemandPlant(inspection), plant)
                                                        && inspection.status == QcInspectionStatus.PENDING)
                                        .count();

                        long activeJobs = jobs.stream()
                                        .filter(job -> plantEquals(processingDemandPlant(job), plant)
                                                        && job.status != ProcessingJobStatus.COMPLETED
                                                        && job.status != ProcessingJobStatus.CANCELLED)
                                        .count();

                        long openIndents = indents.stream()
                                        .filter(indent -> plantEquals(indentDemandPlant(indent), plant)
                                                        && indent.status != IndentStatus.RECEIVED
                                                        && indent.status != IndentStatus.CANCELLED)
                                        .count();

                        long openOrders = orders.stream()
                                        .filter(order -> plantEquals(orderDemandPlant(order), plant)
                                                        && order.status != PurchaseOrderStatus.RECEIVED
                                                        && order.status != PurchaseOrderStatus.CANCELLED)
                                        .count();

                        return new PlantDashboardRow(
                                        plant,
                                        Math.toIntExact(activeProjects),
                                        Math.toIntExact(effectiveBoms),
                                        Math.toIntExact(openRequisitions),
                                        Math.toIntExact(shortageRequisitions),
                                        Math.toIntExact(readyToIssue),
                                        Math.toIntExact(materialInTransit),
                                        Math.toIntExact(pendingQc),
                                        Math.toIntExact(activeJobs),
                                        Math.toIntExact(openIndents),
                                        Math.toIntExact(openOrders));
                }

                private StockLedgerRow toLedgerRow(
                                MatFlowStockLedger ledger) {
                        MatFlowLocation technicalNode = ledger == null ? null : ledger.location;
                        return new StockLedgerRow(
                                        ledger.id,
                                        ledger.material.getId(),
                                        ledger.material.getMaterialCode(),
                                        ledger.material.getMaterialName(),
                                        ledger.material.getUom(),
                                        technicalNode == null ? null : normalizePlant(technicalNode.getPlantCode()),
                                        businessDepartment(technicalNode),
                                        businessPoint(technicalNode),
                                        ledger.movementType,
                                        ledger.quantityChange,
                                        ledger.referenceType,
                                        ledger.referenceId,
                                        displayLedgerReferenceNumber(ledger),
                                        ledger.projectCode,
                                        ledger.drawingNo,
                                        ledger.batchNo,
                                        ledger.remarks,
                                        ledger.actor,
                                        ledger.actionAt);
                }

                /**
                 * Historical QC ledger rows may still physically store an old QC
                 * token in referenceNumber. QC has no business document number in
                 * the current workflow, so the read model resolves those rows back
                 * to the owning MR whenever possible. The database audit key remains
                 * untouched; only the user-facing reference is normalized.
                 */
                private String displayLedgerReferenceNumber(MatFlowStockLedger ledger) {
                        if (ledger == null ||
                                        !"MATFLOW_QC".equals(ledger.referenceType) ||
                                        ledger.referenceId == null) {
                                return ledger == null ? null : ledger.referenceNumber;
                        }

                        MatFlowQcInspection inspection = qcRepository.findById(ledger.referenceId)
                                        .map(value -> (MatFlowQcInspection) Hibernate.unproxy(value))
                                        .orElse(null);
                        if (inspection == null) {
                                return ledger.referenceNumber;
                        }

                        if (inspection.routingReservationId != null) {
                                MatFlowReservation reservation = reservationRepository
                                                .findById(inspection.routingReservationId)
                                                .map(value -> (MatFlowReservation) Hibernate.unproxy(value))
                                                .orElse(null);
                                if (reservation != null && reservation.requisitionLine != null) {
                                        MatFlowRequisitionLine line = (MatFlowRequisitionLine) Hibernate
                                                        .unproxy(reservation.requisitionLine);
                                        if (line.requisition != null) {
                                                MatFlowMaterialRequisition requisition = (MatFlowMaterialRequisition) Hibernate
                                                                .unproxy(line.requisition);
                                                if (requisition.requisitionNumber != null &&
                                                                !requisition.requisitionNumber.isBlank()) {
                                                        return requisition.requisitionNumber;
                                                }
                                        }
                                }
                        }

                        if (inspection.sourceType == QcSourceType.TRANSFER_RECEIPT && inspection.sourceId != null) {
                                MatFlowTransferOrder transfer = transferRepository.findById(inspection.sourceId)
                                                .map(value -> (MatFlowTransferOrder) Hibernate.unproxy(value))
                                                .orElse(null);
                                if (transfer != null && transfer.requisition != null) {
                                        MatFlowMaterialRequisition requisition = (MatFlowMaterialRequisition) Hibernate
                                                        .unproxy(transfer.requisition);
                                        if (requisition.requisitionNumber != null
                                                        && !requisition.requisitionNumber.isBlank()) {
                                                return requisition.requisitionNumber;
                                        }
                                }
                        }

                        if (inspection.sourceType == QcSourceType.GOODS_RECEIPT && inspection.sourceId != null) {
                                MatFlowGoodsReceipt receipt = receiptRepository.findById(inspection.sourceId)
                                                .map(value -> (MatFlowGoodsReceipt) Hibernate.unproxy(value))
                                                .orElse(null);
                                if (receipt != null && receipt.purchaseOrder != null) {
                                        MatFlowPurchaseOrder order = (MatFlowPurchaseOrder) Hibernate
                                                        .unproxy(receipt.purchaseOrder);
                                        if (order.indent != null) {
                                                MatFlowIndent indent = (MatFlowIndent) Hibernate.unproxy(order.indent);
                                                if (indent.requisition != null) {
                                                        MatFlowMaterialRequisition requisition = (MatFlowMaterialRequisition) Hibernate
                                                                        .unproxy(indent.requisition);
                                                        if (requisition.requisitionNumber != null &&
                                                                        !requisition.requisitionNumber.isBlank()) {
                                                                return requisition.requisitionNumber;
                                                        }
                                                }
                                        }
                                }
                        }

                        return ledger.referenceNumber;
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

                /**
                 * Normalizes nullable reporting quantities to MatFlow's standard
                 * three-decimal precision. ReportingModule is a static sibling of
                 * TrackerModule, so it must own its own helper instead of relying on
                 * TrackerModule.scale(...).
                 */
                private BigDecimal scale(BigDecimal value) {
                        return value == null
                                        ? BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP)
                                        : value.setScale(3, RoundingMode.HALF_UP);
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
                                "RECEIVED", "COMPLETED", "CANCELLED");

                private static final Set<String> CLOSED_INDENT_STATUSES = Set.of(
                                "RECEIVED", "COMPLETED", "CLOSED", "CANCELLED", "PURCHASE_COMPLETED");

                /*
                 * Operational tracking targets. These are control-tower defaults, not
                 * contractual deadlines.
                 */
                private static final java.util.Map<String, Long> TARGET_MINUTES = java.util.Map.ofEntries(
                                java.util.Map.entry("BOM_ENGINEERING", 1440L),
                                java.util.Map.entry("BOM_PRODUCTION_REVIEW", 480L),
                                java.util.Map.entry("QC_ROUTE", 240L),
                                java.util.Map.entry("DEMAND", 240L),
                                java.util.Map.entry("STORE", 480L),
                                java.util.Map.entry("PURCHASE", 2880L),
                                java.util.Map.entry("ROUTE", 720L),
                                java.util.Map.entry("PRODUCTION_ISSUE", 240L),
                                java.util.Map.entry("PRODUCTION", 1440L),
                                java.util.Map.entry("TRANSFER", 480L),
                                java.util.Map.entry("QC", 480L),
                                java.util.Map.entry("PROCESSING", 1440L),
                                java.util.Map.entry("GRN", 240L));

                private final MatFlowMaterialRequisitionRepository requisitionRepository;
                private final MatFlowRequisitionLineRepository requisitionLineRepository;
                private final MatFlowReservationRepository reservationRepository;
                private final MatFlowIndentRepository indentRepository;
                private final MatFlowPurchaseOrderRepository purchaseOrderRepository;
                private final MatFlowGoodsReceiptRepository receiptRepository;
                private final MatFlowTransferOrderRepository transferRepository;
                private final MatFlowQcInspectionRepository qcRepository;
                private final MatFlowProcessingJobRepository processingRepository;
                private final MatFlowAuditLogRepository auditRepository;
                private final MatFlowAccessService accessService;
                private final MatFlowPlantRoutingService plantRoutingService;

                TrackerModule(
                                MatFlowMaterialRequisitionRepository requisitionRepository,
                                MatFlowRequisitionLineRepository requisitionLineRepository,
                                MatFlowReservationRepository reservationRepository,
                                MatFlowIndentRepository indentRepository,
                                MatFlowPurchaseOrderRepository purchaseOrderRepository,
                                MatFlowGoodsReceiptRepository receiptRepository,
                                MatFlowTransferOrderRepository transferRepository,
                                MatFlowQcInspectionRepository qcRepository,
                                MatFlowProcessingJobRepository processingRepository,
                                MatFlowAuditLogRepository auditRepository,
                                MatFlowAccessService accessService,
                                MatFlowPlantRoutingService plantRoutingService) {
                        this.requisitionRepository = requisitionRepository;
                        this.requisitionLineRepository = requisitionLineRepository;
                        this.reservationRepository = reservationRepository;
                        this.indentRepository = indentRepository;
                        this.purchaseOrderRepository = purchaseOrderRepository;
                        this.receiptRepository = receiptRepository;
                        this.transferRepository = transferRepository;
                        this.qcRepository = qcRepository;
                        this.processingRepository = processingRepository;
                        this.auditRepository = auditRepository;
                        this.accessService = accessService;
                        this.plantRoutingService = plantRoutingService;
                }

                @Transactional(readOnly = true)
                public TrackerResponse getTracker(String search, String plantCode, String stage) {
                        accessService.requireRead();

                        String query = normalizeSearch(search);
                        String requestedPlant = normalizeCode(plantCode);
                        String requestedStage = normalizeCode(stage);

                        if (requestedPlant != null
                                        && !accessService.canAccessPlant(requestedPlant)
                                        && !plantRoutingService.canActAsMainStore()) {
                                accessService.requirePlantAccess(requestedPlant);
                        }

                        List<TrackerRowResponse> rows = new ArrayList<>();

                        for (MatFlowMaterialRequisition raw : requisitionRepository.findAllByOrderByUpdatedAtDesc()) {
                                UUID requisitionId = raw == null ? null : raw.getId();
                                try {
                                        MatFlowMaterialRequisition requisition = unwrapRequisition(raw);
                                        if (!hasReadableProject(requisition)) {
                                                continue;
                                        }
                                        if (!canReadTrackerRequisition(requisition)) {
                                                continue;
                                        }

                                        /*
                                         * Tracker plant selection follows the owning Project/Product plant,
                                         * exactly like Project Portfolio. Destination plant remains a live
                                         * movement/location attribute and must not decide whether a Product
                                         * belongs to the selected Project portfolio.
                                         */
                                        if (requestedPlant != null && !requestedPlant.equals(
                                                        normalizeCode(requisition.projectDrawing.getPlantCode()))) {
                                                continue;
                                        }

                                        TrackerRowResponse row = toTrackerRow(requisition);
                                        if (requestedStage != null && !requestedStage.equals(
                                                        normalizeCode(row.currentStage()))) {
                                                continue;
                                        }

                                        if (!query.isBlank()
                                                        && !matchesProjectSearch(requisition, query)
                                                        && !matchesSearch(row, query)) {
                                                continue;
                                        }

                                        rows.add(row);
                                } catch (RuntimeException ex) {
                                        /*
                                         * Production Readiness reuses this tracker list. One malformed legacy
                                         * requisition or one Hibernate proxy with uninitialised public backing
                                         * fields must not take down the entire Production Execution page.
                                         * Strict tracker detail / write endpoints still surface the bad record.
                                         */
                                        LOG.error("Skipping unreadable MatFlow tracker requisition {} while building list", requisitionId, ex);
                                }
                        }

                        rows = List.copyOf(rows);

                        return new TrackerResponse(createKpis(rows), rows);
                }

                @Transactional(readOnly = true)
                public TrackerDetailResponse getDetail(UUID requisitionId) {
                        accessService.requireRead();
                        if (requisitionId == null) {
                                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Requisition ID is required");
                        }

                        MatFlowMaterialRequisition requisition = requisitionRepository.findDetailById(requisitionId)
                                        .map(this::unwrapRequisition)
                                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                        "Requisition not found"));

                        if (!hasReadableProject(requisition)) {
                                throw new ResponseStatusException(HttpStatus.CONFLICT,
                                                "Requisition has no readable project/plant context");
                        }
                        if (!canReadTrackerRequisition(requisition)) {
                                accessService.requirePlantAccess(requisition.projectDrawing.getPlantCode());
                        }

                        TrackingContext context = loadContext(requisition);
                        TrackerRowResponse summary = toTrackerRow(requisition, context);
                        List<TrackerStageTiming> stages = buildMajorStages(context, summary);
                        List<TrackerStageTiming> operations = buildOperations(context);
                        List<TrackerMaterialPosition> materials = buildMaterialPositions(context);
                        List<TrackerAuditEvent> events = context.audits().stream()
                                        .map(audit -> new TrackerAuditEvent(
                                                        audit.getId(), audit.getEntityType(), audit.getEntityId(),
                                                        audit.getAction(),
                                                        audit.getActor(), audit.getActionAt(), audit.getPlantCode(),
                                                        audit.getProjectCode(),
                                                        audit.getDrawingNo(), audit.getDetailsJson()))
                                        .toList();

                        TrackerCycleSummary cycle = buildCycle(context, stages, summary);
                        return new TrackerDetailResponse(summary, cycle, stages, operations, materials, events,
                                        LocalDateTime.now());
                }

                private TrackerRowResponse toTrackerRow(MatFlowMaterialRequisition requisition) {
                        return toTrackerRow(requisition, loadLightContext(requisition));
                }

                private TrackerRowResponse toTrackerRow(MatFlowMaterialRequisition requisition,
                                TrackingContext context) {
                        List<MatFlowRequisitionLine> lines = context.lines();
                        List<MatFlowReservation> reservations = context.reservations();
                        List<MatFlowIndent> indents = context.indents();
                        List<MatFlowTransferOrder> transfers = context.transfers();

                        BigDecimal requestedQty = sum(lines, QuantityField.REQUESTED);
                        BigDecimal reservedQty = sum(lines, QuantityField.RESERVED);
                        BigDecimal shortageQty = sum(lines, QuantityField.SHORTAGE);
                        BigDecimal issuedQty = sum(lines, QuantityField.ISSUED);
                        BigDecimal consumedQty = sum(lines, QuantityField.CONSUMED);
                        BigDecimal returnedQty = sum(lines, QuantityField.RETURNED);

                        int openIndentCount = (int) indents.stream().filter(this::isOpenIndent).count();
                        int openTransferCount = (int) transfers.stream().filter(this::isOpenTransfer).count();
                        int readyTransferCount = (int) transfers.stream()
                                        .filter(transfer -> "READY".equals(enumName(transfer.status))).count();

                        String currentStage;
                        if (hasPendingQc(context)) {
                                currentStage = "QC_PENDING";
                        } else if (hasActiveProcessing(context)) {
                                currentStage = "PROCESSING";
                        } else {
                                currentStage = resolveCurrentStage(
                                                requisition.status, requestedQty, reservedQty, shortageQty, issuedQty,
                                                consumedQty, openTransferCount);
                        }
                        String responsibleDesk = resolveResponsibleDesk(currentStage);
                        int progressPercent = resolveProgressPercent(currentStage);
                        int materialReadyPercent = requestedQty.compareTo(BigDecimal.ZERO) <= 0
                                        ? 0
                                        : Math.min(100, Math.max(0,
                                                        issuedQty.multiply(new BigDecimal("100"))
                                                                        .divide(requestedQty, 0, RoundingMode.HALF_UP)
                                                                        .intValue()));
                        boolean readyToStartProduction = requisition.status == RequisitionStatus.ISSUED_TO_PRODUCTION;
                        String productionStartBlocker = readyToStartProduction
                                        ? null
                                        : requisition.status == RequisitionStatus.PRODUCTION_STARTED
                                                        ? "PRODUCTION_ALREADY_STARTED"
                                                        : requisition.status == RequisitionStatus.PRODUCTION_COMPLETED
                                                                        ? "PRODUCTION_COMPLETED"
                                                                        : currentStage;

                        MatFlowProjectDrawing project = requisition.projectDrawing;
                        MatFlowLocation destination = requisition.destinationLocation;
                        Position current = resolveCurrentPosition(context, currentStage, shortageQty);
                        Position next = resolveNextPosition(context, currentStage, current);

                        LocalDateTime stageStartedAt = resolveStageStart(context, currentStage, current);
                        LocalDateTime completedAt = resolveCompletionAt(context);
                        LocalDateTime stageEndedAt = "PRODUCTION_COMPLETED".equals(currentStage) ? completedAt : null;
                        long stageMinutes = minutesBetween(stageStartedAt,
                                        stageEndedAt == null ? LocalDateTime.now() : stageEndedAt);
                        long totalLeadMinutes = minutesBetween(
                                        requisition.requestedAt != null ? requisition.requestedAt
                                                        : requisition.getCreatedAt(),
                                        completedAt == null ? LocalDateTime.now() : completedAt);
                        long targetMinutes = targetForCurrentStage(currentStage);
                        String timingHealth = timingHealth(stageStartedAt, stageEndedAt, targetMinutes, false);
                        int actualProgress = resolveActualProgress(currentStage, progressPercent, requestedQty,
                                        consumedQty, transfers);
                        String bottleneckHint = isBreach(timingHealth)
                                        ? readableStage(currentStage) + " is above its operational tracking target"
                                        : null;

                        long ageHours = Math.max(0L, stageMinutes / 60L);

                        return new TrackerRowResponse(
                                        requisition.getId(), requisition.requisitionNumber,
                                        project == null ? null : project.getId(),
                                        project == null ? null : project.getProjectCode(),
                                        project == null ? null : project.getProjectName(),
                                        project == null ? null : project.getClientName(),
                                        project == null ? null : project.getDrawingNo(),
                                        project == null ? null : project.getProductName(),
                                        requisition.bom == null ? null : requisition.bom.getId(),
                                        requisition.bom == null ? null : requisition.bom.getBomNumber(),
                                        requisition.bom == null ? null : requisition.bom.getRevisionNo(),
                                        destination == null ? null : destination.getId(),
                                        destination == null ? null : destination.getLocationCode(),
                                        destination == null ? null : destination.getLocationName(),
                                        destination == null ? (project == null ? null : project.getPlantCode())
                                                        : destination.getPlantCode(),
                                        requisition.status, currentStage, responsibleDesk, progressPercent,
                                        materialReadyPercent, readyToStartProduction, productionStartBlocker,
                                        requestedQty, reservedQty, shortageQty, issuedQty, consumedQty, returnedQty,
                                        reservations.size(), indents.size(), openIndentCount, transfers.size(),
                                        openTransferCount, readyTransferCount,
                                        requisition.requestedAt, requisition.submittedAt, requisition.plannedAt,
                                        requisition.getUpdatedAt(),
                                        ageHours, requisition.getRowVersion(),
                                        current.department(), current.locationId(), current.locationCode(),
                                        current.locationName(), current.locationType(),
                                        stageStartedAt, stageEndedAt, stageMinutes, totalLeadMinutes, targetMinutes,
                                        timingHealth,
                                        next.department(), next.locationId(), next.locationCode(), next.locationName(),
                                        completedAt, actualProgress, bottleneckHint);
                }

                private TrackingContext loadLightContext(MatFlowMaterialRequisition requisition) {
                        UUID id = requisition.getId();
                        List<MatFlowRequisitionLine> lines = requisitionLineRepository
                                        .findByRequisition_IdOrderByLineNoAsc(id)
                                        .stream().map(this::unwrapLine).toList();
                        List<MatFlowReservation> reservations = reservationRepository
                                        .findByRequisitionLine_Requisition_IdOrderByCreatedAtAsc(id)
                                        .stream().map(this::unwrapReservation).toList();
                        List<MatFlowIndent> indents = indentRepository.findByRequisition_IdOrderByCreatedAtAsc(id)
                                        .stream().map(this::unwrapIndent).toList();
                        List<MatFlowTransferOrder> transfers = transferRepository
                                        .findByRequisition_IdOrderByRouteSequenceNoAscCreatedAtAsc(id)
                                        .stream().map(this::unwrapTransfer).toList();
                        return new TrackingContext(requisition, lines, reservations, indents, List.of(), List.of(),
                                        transfers, List.of(), List.of(), List.of());
                }

                private TrackingContext loadContext(MatFlowMaterialRequisition requisition) {
                        UUID id = requisition.getId();
                        List<MatFlowRequisitionLine> lines = requisitionLineRepository
                                        .findByRequisition_IdOrderByLineNoAsc(id)
                                        .stream().map(this::unwrapLine).toList();
                        List<MatFlowReservation> reservations = reservationRepository
                                        .findByRequisitionLine_Requisition_IdOrderByCreatedAtAsc(id)
                                        .stream().map(this::unwrapReservation).toList();
                        List<MatFlowIndent> indents = indentRepository.findByRequisition_IdOrderByCreatedAtAsc(id)
                                        .stream().map(this::unwrapIndent).toList();
                        List<MatFlowPurchaseOrder> orders = indents.stream()
                                        .flatMap(indent -> purchaseOrderRepository.findByIndent_Id(indent.getId())
                                                        .stream())
                                        .toList();
                        List<MatFlowGoodsReceipt> receipts = orders.stream()
                                        .flatMap(order -> receiptRepository
                                                        .findByPurchaseOrder_IdOrderByReceivedAtAsc(order.getId())
                                                        .stream())
                                        .toList();
                        List<MatFlowTransferOrder> transfers = transferRepository
                                        .findByRequisition_IdOrderByRouteSequenceNoAscCreatedAtAsc(id)
                                        .stream().map(this::unwrapTransfer).toList();
                        List<MatFlowProcessingJob> jobs = processingRepository
                                        .findByRequisition_IdOrderByCreatedAtAsc(id)
                                        .stream().map(this::unwrapProcessingJob).toList();

                        Set<UUID> qcSourceIds = new LinkedHashSet<>();
                        receipts.forEach(r -> qcSourceIds.add(r.getId()));
                        transfers.forEach(t -> qcSourceIds.add(t.getId()));
                        List<MatFlowQcInspection> inspections = qcRepository.findAllByOrderByCreatedAtDesc().stream()
                                        .filter(qc -> qc != null && qc.sourceId != null
                                                        && qcSourceIds.contains(qc.sourceId))
                                        .sorted(Comparator.comparing(MatFlowQcInspection::getCreatedAt,
                                                        Comparator.nullsLast(Comparator.naturalOrder())))
                                        .map(this::unwrapQcInspection)
                                        .toList();

                        Set<UUID> referenceIds = new LinkedHashSet<>();
                        referenceIds.add(requisition.getId());
                        if (requisition.projectDrawing != null)
                                referenceIds.add(requisition.projectDrawing.getId());
                        if (requisition.bom != null)
                                referenceIds.add(requisition.bom.getId());
                        reservations.forEach(v -> referenceIds.add(v.getId()));
                        indents.forEach(v -> referenceIds.add(v.getId()));
                        orders.forEach(v -> referenceIds.add(v.getId()));
                        receipts.forEach(v -> referenceIds.add(v.getId()));
                        transfers.forEach(v -> referenceIds.add(v.getId()));
                        inspections.forEach(v -> referenceIds.add(v.getId()));
                        jobs.forEach(v -> referenceIds.add(v.getId()));

                        List<MatFlowAuditLog> audits;
                        if (referenceIds.isEmpty()) {
                                audits = List.of();
                        } else {
                                Specification<MatFlowAuditLog> specification = (root, query, cb) -> root.get("entityId")
                                                .in(referenceIds);
                                audits = auditRepository.findAll(specification,
                                                Sort.by(Sort.Direction.ASC, "actionAt"));
                        }

                        return new TrackingContext(requisition, lines, reservations, indents, orders, receipts,
                                        transfers, inspections, jobs, audits);
                }

                private List<TrackerStageTiming> buildMajorStages(TrackingContext c, TrackerRowResponse summary) {
                        MatFlowMaterialRequisition r = c.requisition();
                        MatFlowProjectDrawing project = r.projectDrawing;
                        MatFlowBom bom = r.bom;
                        MatFlowLocation production = r.destinationLocation;
                        List<TrackerStageTiming> stages = new ArrayList<>();

                        addStage(stages, "BOM_ENGINEERING", "Engineering BOM Preparation", "ENGINEERING", null,
                                        bom == null ? null : bom.getCreatedAt(),
                                        bom == null ? null : bom.getSubmittedAt(),
                                        bom == null ? null : bom.getSubmittedBy(),
                                        "BOM", bom == null ? null : bom.getId(),
                                        bom == null ? null : bom.getBomNumber(), true,
                                        "Engineering prepares the Product BOM, material specifications, quantities and optional Processing choices.");

                        addStage(stages, "BOM_PRODUCTION_REVIEW", "Production BOM Technical Review", "PRODUCTION",
                                        production,
                                        bom == null ? null : bom.getSubmittedAt(),
                                        bom == null ? null : bom.getProductionReviewedAt(),
                                        bom == null ? null : bom.getProductionReviewedBy(),
                                        "BOM", bom == null ? null : bom.getId(),
                                        bom == null ? null : bom.getBomNumber(), true,
                                        "Production performs the final BOM review. A reviewed BOM becomes effective and can be used for Material Requisitions.");

                        addStage(stages, "DEMAND", "Production Material Demand", "PRODUCTION", production,
                                        r.requestedAt != null ? r.requestedAt : r.getCreatedAt(), r.submittedAt,
                                        r.submittedBy,
                                        "REQUISITION", r.getId(), r.requisitionNumber, true,
                                        "Requisition drafting and submission to Store.");

                        addStage(stages, "STORE", "Store Review & Reservation", "STORE", firstStoreLocation(c),
                                        r.submittedAt, r.plannedAt, r.plannedBy,
                                        "REQUISITION", r.getId(), r.requisitionNumber, r.submittedAt != null,
                                        "Availability review, reservation and shortage determination.");

                        boolean purchaseApplicable = !c.indents().isEmpty();
                        LocalDateTime purchaseStart = c.indents().stream().map(MatFlowIndent::getCreatedAt)
                                        .filter(java.util.Objects::nonNull).min(LocalDateTime::compareTo).orElse(null);
                        LocalDateTime purchaseEnd = resolvePurchaseEnd(c);
                        addStage(stages, "PURCHASE", "Shortage Procurement", "PURCHASE", firstIndentLocation(c),
                                        purchaseStart, purchaseEnd, lastActorFor(c.audits(), "PURCHASE_ORDER_PLACED"),
                                        "INDENT", c.indents().isEmpty() ? null : c.indents().get(0).getId(),
                                        c.indents().isEmpty() ? null : c.indents().get(0).indentNumber,
                                        purchaseApplicable,
                                        "Purchase Indent → Purchase Order → vendor supply → GRN into Store. QC is decided later when Store allocates the material to an MR.");

                        boolean routeApplicable = !c.transfers().isEmpty() || !c.jobs().isEmpty()
                                        || !c.inspections().isEmpty();
                        LocalDateTime routeStart = c.transfers().stream().map(MatFlowTransferOrder::getCreatedAt)
                                        .filter(java.util.Objects::nonNull).min(LocalDateTime::compareTo)
                                        .orElse(r.plannedAt);
                        LocalDateTime routeEnd = resolveRouteEnd(c);
                        addStage(stages, "ROUTE", "Material Route Execution", currentRouteDepartment(c),
                                        currentRouteLocation(c),
                                        routeStart, routeEnd, lastRouteActor(c),
                                        "REQUISITION", r.getId(), r.requisitionNumber, routeApplicable,
                                        "Actual material route: Store → Production, or Store → QC → Production / Processing → Production. Internal hand-offs are automatic workflow records, not a separate desk.");

                        LocalDateTime issueStart = routeEnd != null ? routeEnd
                                        : (routeApplicable ? routeStart : r.plannedAt);
                        LocalDateTime issueEnd = allIssued(summary)
                                        ? latestAuditTime(c.audits(), "MATERIAL_ISSUED_TO_PRODUCTION")
                                        : null;
                        if (issueEnd == null && allIssued(summary))
                                issueEnd = r.getUpdatedAt();
                        addStage(stages, "PRODUCTION_ISSUE", "Material Issued to Production", "STORE / PROCESSING",
                                        production,
                                        issueStart, issueEnd, lastActorFor(c.audits(), "MATERIAL_ISSUED_TO_PRODUCTION"),
                                        "REQUISITION", r.getId(), r.requisitionNumber, true,
                                        "Final custody hand-off to the Production user after the selected route is complete.");

                        LocalDateTime productionStart = earliestAuditTime(c.audits(), "PRODUCTION_STARTED");
                        LocalDateTime productionEnd = latestAuditTime(c.audits(), "PRODUCTION_COMPLETED");
                        if (productionEnd == null && "PRODUCTION_COMPLETED".equals(summary.currentStage()))
                                productionEnd = r.getUpdatedAt();
                        if (productionStart == null && "PRODUCTION_IN_PROGRESS".equals(summary.currentStage()))
                                productionStart = r.getUpdatedAt();
                        addStage(stages, "PRODUCTION", "Production Execution", "PRODUCTION", production,
                                        productionStart, productionEnd,
                                        productionEnd != null ? lastActorFor(c.audits(), "PRODUCTION_COMPLETED")
                                                        : lastActorFor(c.audits(), "PRODUCTION_STARTED"),
                                        "REQUISITION", r.getId(), r.requisitionNumber, true,
                                        "Production start → consumption / wastage / return accounting → Product completion.");

                        LocalDateTime complete = resolveCompletionAt(c);
                        stages.add(stageRecord("COMPLETE", "Finished / Traceability Closed", "CLOSED", production,
                                        complete, complete, complete == null ? "WAITING" : "DONE", 0L,
                                        lastActorFor(c.audits(), "PRODUCTION_COMPLETED"), "REQUISITION", r.getId(),
                                        r.requisitionNumber,
                                        "Material execution is fully accounted and traceable."));

                        normalizeMajorStageStates(stages, summary.currentStage());
                        return List.copyOf(stages);
                }

                private void addStage(List<TrackerStageTiming> stages, String key, String label, String department,
                                MatFlowLocation location, LocalDateTime start, LocalDateTime end, String actor,
                                String referenceType, UUID referenceId, String referenceNumber, boolean applicable,
                                String note) {
                        if (!applicable) {
                                stages.add(stageRecord(key, label, department, location, null, null, "SKIPPED",
                                                target(key),
                                                actor, referenceType, referenceId, referenceNumber, note));
                                return;
                        }
                        String state = end != null ? "DONE" : start != null ? "CURRENT" : "WAITING";
                        stages.add(stageRecord(key, label, department, location, start, end, state, target(key),
                                        actor, referenceType, referenceId, referenceNumber, note));
                }

                private TrackerStageTiming stageRecord(String key, String label, String department,
                                MatFlowLocation location,
                                LocalDateTime start, LocalDateTime end, String state, long target, String actor,
                                String referenceType, UUID referenceId, String referenceNumber, String note) {
                        long duration = start == null ? 0L
                                        : minutesBetween(start, end == null ? LocalDateTime.now() : end);
                        long variance = target <= 0 ? 0L : duration - target;
                        String health = "SKIPPED".equals(state) ? "NOT_REQUIRED"
                                        : timingHealth(start, end, target, "DONE".equals(state));
                        return new TrackerStageTiming(key, label, department,
                                        location == null ? null : location.getId(),
                                        location == null ? null : location.getLocationCode(),
                                        location == null ? null : location.getLocationName(),
                                        location == null || location.getLocationType() == null ? null
                                                        : location.getLocationType().name(),
                                        state, start, end, duration, target, variance, health, actor,
                                        referenceType, referenceId, referenceNumber, note);
                }

                private void normalizeMajorStageStates(List<TrackerStageTiming> stages, String currentStage) {
                        String currentKey = majorKeyForCurrentStage(currentStage);
                        boolean reachedCurrent = false;
                        for (int i = 0; i < stages.size(); i++) {
                                TrackerStageTiming stage = stages.get(i);
                                if ("SKIPPED".equals(stage.state()) || "DONE".equals(stage.state()))
                                        continue;
                                if (!reachedCurrent && stage.key().equals(currentKey)) {
                                        reachedCurrent = true;
                                        if (stage.startedAt() != null) {
                                                stages.set(i, copyState(stage, "CURRENT"));
                                        }
                                        continue;
                                }
                                if (!reachedCurrent && stage.startedAt() != null) {
                                        stages.set(i, copyState(stage, "DONE"));
                                } else if (reachedCurrent || stage.startedAt() == null) {
                                        stages.set(i, copyState(stage, "WAITING"));
                                }
                        }
                }

                private TrackerStageTiming copyState(TrackerStageTiming stage, String state) {
                        return new TrackerStageTiming(stage.key(), stage.label(), stage.department(),
                                        stage.custodyId(),
                                        stage.custodyCode(), stage.custodyName(), stage.custodyType(), state,
                                        stage.startedAt(),
                                        stage.endedAt(), stage.durationMinutes(), stage.targetMinutes(),
                                        stage.varianceMinutes(),
                                        stage.timingHealth(), stage.actor(), stage.referenceType(), stage.referenceId(),
                                        stage.referenceNumber(), stage.note());
                }

                private List<TrackerStageTiming> buildOperations(TrackingContext c) {
                        List<TrackerStageTiming> operations = new ArrayList<>();

                        for (MatFlowIndent indent : c.indents()) {
                                MatFlowPurchaseOrder firstPo = c.orders().stream()
                                                .filter(po -> po.indent != null
                                                                && indent.getId().equals(po.indent.getId()))
                                                .min(Comparator.comparing(MatFlowPurchaseOrder::getCreatedAt,
                                                                Comparator.nullsLast(Comparator.naturalOrder())))
                                                .orElse(null);
                                operations.add(stageRecord("INDENT", "Shortage Indent " + safeText(indent.indentNumber),
                                                "STORE / PURCHASE",
                                                indent.deliverToLocation, indent.getCreatedAt(),
                                                firstPo == null ? null : firstPo.getCreatedAt(),
                                                firstPo == null ? "CURRENT" : "DONE", 480L, indent.getCreatedBy(),
                                                "INDENT", indent.getId(),
                                                indent.indentNumber, "Shortage handed from Store to Purchase."));
                        }

                        for (MatFlowPurchaseOrder order : c.orders()) {
                                boolean placed = order.status != PurchaseOrderStatus.DRAFT;
                                LocalDateTime placedAt = placed
                                                ? (order.approvedAt != null ? order.approvedAt : order.getUpdatedAt())
                                                : null;
                                operations.add(stageRecord("PO", "PO " + safeText(order.poNumber),
                                                "PURCHASE",
                                                order.deliveryLocation, order.getCreatedAt(), placedAt,
                                                placed ? "DONE" : "CURRENT", target("PURCHASE"),
                                                order.approvedBy != null ? order.approvedBy : order.getCreatedBy(),
                                                "PURCHASE_ORDER", order.getId(), order.poNumber,
                                                placed
                                                                ? "Purchase placed the vendor PO directly against the linked Store PI."
                                                                : "Purchase is preparing the vendor PO against the linked Store PI."));
                        }

                        for (MatFlowGoodsReceipt receipt : c.receipts()) {
                                operations.add(stageRecord("GRN", "GRN " + safeText(receipt.grnNumber),
                                                "STORE / RECEIVING",
                                                receipt.receiptLocation, receipt.receivedAt, receipt.receivedAt, "DONE",
                                                0L, receipt.receivedBy,
                                                "GOODS_RECEIPT", receipt.getId(), receipt.grnNumber,
                                                "Vendor material physically received and inwarded into Store stock."));
                        }

                        for (MatFlowQcInspection qc : c.inspections()) {
                                boolean done = "COMPLETED".equals(enumName(qc.status));
                                operations.add(stageRecord(
                                                "QC",
                                                done ? "QC Check Completed" : "QC Check Pending",
                                                "QC",
                                                qc.location,
                                                qc.getCreatedAt(),
                                                qc.inspectedAt,
                                                done ? "DONE" : "CURRENT",
                                                target("QC"),
                                                qc.inspectedBy,
                                                "QC_INSPECTION",
                                                qc.getId(),
                                                c.requisition().requisitionNumber,
                                                done
                                                                ? "MR material check completed. QC did not take custody or choose a route."
                                                                : "MR material is waiting for a check/tick while physical custody remains at Store."));
                        }

                        for (MatFlowProcessingJob job : c.jobs()) {
                                boolean done = "COMPLETED".equals(enumName(job.status));
                                LocalDateTime start = job.startedAt != null ? job.startedAt : job.getCreatedAt();
                                operations.add(stageRecord("PROCESSING", "Processing " + safeText(job.jobNumber),
                                                "PROCESSING", job.location,
                                                start, job.completedAt, done ? "DONE" : "CURRENT", target("PROCESSING"),
                                                done ? job.completedBy : job.startedBy, "PROCESSING_JOB", job.getId(),
                                                job.jobNumber,
                                                "Input/output conversion controlled by the BOM route."));
                        }

                        for (MatFlowTransferOrder transfer : c.transfers()) {
                                boolean done = CLOSED_TRANSFER_STATUSES.contains(enumName(transfer.status));
                                String department = transferDepartment(transfer);
                                MatFlowLocation location = transferCurrentLocation(transfer);
                                operations.add(stageRecord("TRANSFER", "Transfer " + safeText(transfer.transferNumber),
                                                department, location,
                                                transfer.getCreatedAt(), done ? transfer.getUpdatedAt() : null,
                                                done ? "DONE" : "CURRENT",
                                                target("TRANSFER"), latestActorForEntity(c.audits(), transfer.getId()),
                                                "TRANSFER",
                                                transfer.getId(), transfer.transferNumber,
                                                routeLabel(transfer.fromLocation, transfer.toLocation)));
                        }

                        c.audits().stream()
                                        .filter(a -> "MATERIAL_ISSUED_TO_PRODUCTION".equalsIgnoreCase(a.getAction()))
                                        .forEach(a -> operations.add(new TrackerStageTiming(
                                                        "STORE_ISSUE", "Store Issue to Production", "STORE",
                                                        c.requisition().destinationLocation == null ? null
                                                                        : c.requisition().destinationLocation.getId(),
                                                        c.requisition().destinationLocation == null ? null
                                                                        : c.requisition().destinationLocation
                                                                                        .getLocationCode(),
                                                        c.requisition().destinationLocation == null ? null
                                                                        : c.requisition().destinationLocation
                                                                                        .getLocationName(),
                                                        c.requisition().destinationLocation == null || c
                                                                        .requisition().destinationLocation
                                                                        .getLocationType() == null
                                                                                        ? null
                                                                                        : c.requisition().destinationLocation
                                                                                                        .getLocationType()
                                                                                                        .name(),
                                                        "DONE", a.getActionAt(), a.getActionAt(), 0L, 0L, 0L,
                                                        "COMPLETED", a.getActor(),
                                                        a.getEntityType(), a.getEntityId(),
                                                        c.requisition().requisitionNumber,
                                                        "Material custody released to Production.")));

                        return operations.stream()
                                        .sorted(Comparator.comparing(TrackerStageTiming::startedAt,
                                                        Comparator.nullsLast(Comparator.naturalOrder())))
                                        .toList();
                }

                private List<TrackerMaterialPosition> buildMaterialPositions(TrackingContext c) {
                        List<TrackerMaterialPosition> rows = new ArrayList<>();
                        MatFlowLocation production = c.requisition().destinationLocation;

                        for (MatFlowRequisitionLine line : c.lines()) {
                                List<MatFlowReservation> lineReservations = c.reservations().stream()
                                                .filter(r -> r.requisitionLine != null
                                                                && line.getId().equals(r.requisitionLine.getId()))
                                                .toList();

                                if (lineReservations.isEmpty()) {
                                        MatFlowMaterial material = line.material;
                                        rows.add(new TrackerMaterialPosition(
                                                        line.getId(), null, material == null ? null : material.getId(),
                                                        material == null ? null : material.getMaterialCode(),
                                                        material == null ? null : material.getMaterialCode(),
                                                        material == null ? null : material.getMaterialName(),
                                                        material == null ? null : material.getCategory(),
                                                        material == null ? null : material.getUom(),
                                                        scale(line.requestedQty), scale(line.reservedQty),
                                                        scale(line.shortageQty), scale(line.issuedQty),
                                                        scale(line.consumedQty), scale(line.returnedQty),
                                                        scale(line.shortageQty),
                                                        safe(line.shortageQty).compareTo(BigDecimal.ZERO) > 0
                                                                        ? "PURCHASE"
                                                                        : "STORE",
                                                        null,
                                                        safe(line.shortageQty).compareTo(BigDecimal.ZERO) > 0
                                                                        ? "AWAITING SUPPLY"
                                                                        : "UNRESERVED",
                                                        null, null,
                                                        safe(line.shortageQty).compareTo(BigDecimal.ZERO) > 0
                                                                        ? "AWAITING_SUPPLY"
                                                                        : "UNRESERVED",
                                                        line.getUpdatedAt(),
                                                        safe(line.shortageQty).compareTo(BigDecimal.ZERO) > 0 ? "QC"
                                                                        : "STORE",
                                                        null, null, null, null, null));
                                        continue;
                                }

                                for (MatFlowReservation reservation : lineReservations) {
                                        rows.add(materialPosition(c, line, reservation, production));
                                }

                                BigDecimal reservedTotal = lineReservations.stream().map(r -> safe(r.reservedQty))
                                                .reduce(BigDecimal.ZERO, BigDecimal::add);
                                BigDecimal residualShortage = safe(line.requestedQty).subtract(reservedTotal)
                                                .max(BigDecimal.ZERO);
                                if (residualShortage.compareTo(BigDecimal.ZERO) > 0) {
                                        MatFlowMaterial material = line.material;
                                        rows.add(new TrackerMaterialPosition(
                                                        line.getId(), null, material == null ? null : material.getId(),
                                                        material == null ? null : material.getMaterialCode(),
                                                        material == null ? null : material.getMaterialCode(),
                                                        material == null ? null : material.getMaterialName(),
                                                        material == null ? null : material.getCategory(),
                                                        material == null ? null : material.getUom(),
                                                        scale(line.requestedQty), scale(line.reservedQty),
                                                        scale(line.shortageQty), scale(line.issuedQty),
                                                        scale(line.consumedQty), scale(line.returnedQty),
                                                        scale(residualShortage),
                                                        "PURCHASE", null, "AWAITING SUPPLY", null, null,
                                                        "AWAITING_SUPPLY", line.getUpdatedAt(),
                                                        "QC",
                                                        firstIndentLocation(c) == null ? null
                                                                        : firstIndentLocation(c).getId(),
                                                        firstIndentLocation(c) == null ? null
                                                                        : firstIndentLocation(c).getLocationCode(),
                                                        "INDENT",
                                                        c.indents().isEmpty() ? null : c.indents().get(0).getId(),
                                                        c.indents().isEmpty() ? null
                                                                        : c.indents().get(0).indentNumber));
                                }
                        }
                        return List.copyOf(rows);
                }

                private TrackerMaterialPosition materialPosition(TrackingContext c, MatFlowRequisitionLine line,
                                MatFlowReservation reservation, MatFlowLocation production) {
                        List<MatFlowTransferOrder> route = c.transfers().stream()
                                        .filter(t -> t.reservation != null
                                                        && reservation.getId().equals(t.reservation.getId()))
                                        .sorted(Comparator
                                                        .comparingInt(t -> t.routeSequenceNo == null ? Integer.MAX_VALUE
                                                                        : t.routeSequenceNo))
                                        .toList();
                        MatFlowTransferOrder openTransfer = route.stream().filter(this::isOpenTransfer).findFirst()
                                        .orElse(null);
                        MatFlowProcessingJob activeJob = c.jobs().stream()
                                        .filter(job -> job.reservation != null
                                                        && reservation.getId().equals(job.reservation.getId()))
                                        .filter(job -> !"COMPLETED".equals(enumName(job.status))
                                                        && !"CANCELLED".equals(enumName(job.status)))
                                        .findFirst().orElse(null);

                        MatFlowMaterial currentMaterial = reservation.material != null ? reservation.material
                                        : line.material;
                        MatFlowProcessingJob latestCompletedJob = c.jobs().stream()
                                        .filter(job -> job.reservation != null
                                                        && reservation.getId().equals(job.reservation.getId()))
                                        .filter(job -> "COMPLETED".equals(enumName(job.status)))
                                        .max(Comparator.comparing(job -> job.completedAt,
                                                        Comparator.nullsLast(Comparator.naturalOrder())))
                                        .orElse(null);
                        if (latestCompletedJob != null && latestCompletedJob.outputMaterial != null)
                                currentMaterial = latestCompletedJob.outputMaterial;

                        String department;
                        MatFlowLocation currentLocation;
                        String currentLocationCode;
                        String movementState;
                        LocalDateTime lastMoved;
                        String nextDepartment;
                        MatFlowLocation nextLocation;
                        String refType;
                        UUID refId;
                        String refNo;

                        if ("ISSUED".equals(enumName(reservation.status))
                                        || "PARTIALLY_ISSUED".equals(enumName(reservation.status))
                                                        && openTransfer == null) {
                                department = "PRODUCTION";
                                currentLocation = production;
                                currentLocationCode = production == null ? null : production.getLocationCode();
                                movementState = "ISSUED_TO_PRODUCTION";
                                lastMoved = reservation.getUpdatedAt();
                                nextDepartment = "PRODUCTION";
                                nextLocation = production;
                                refType = "RESERVATION";
                                refId = reservation.getId();
                                refNo = c.requisition().requisitionNumber;
                        } else if (activeJob != null) {
                                department = "PROCESSING";
                                currentLocation = activeJob.location;
                                currentLocationCode = currentLocation == null ? null
                                                : currentLocation.getLocationCode();
                                movementState = "PROCESSING";
                                lastMoved = activeJob.startedAt != null ? activeJob.startedAt
                                                : activeJob.getUpdatedAt();
                                nextDepartment = "TRANSFER / PRODUCTION";
                                nextLocation = null;
                                refType = "PROCESSING_JOB";
                                refId = activeJob.getId();
                                refNo = activeJob.jobNumber;
                        } else if (openTransfer != null) {
                                String status = enumName(openTransfer.status);
                                boolean transit = Set.of("PARTIALLY_DISPATCHED", "IN_TRANSIT", "PARTIALLY_RECEIVED")
                                                .contains(status);
                                department = transit ? "IN TRANSIT" : departmentForLocation(openTransfer.fromLocation);
                                currentLocation = transit ? null : openTransfer.fromLocation;
                                currentLocationCode = transit
                                                ? routeLabel(openTransfer.fromLocation, openTransfer.toLocation)
                                                : locationCode(currentLocation);
                                movementState = status;
                                lastMoved = openTransfer.getUpdatedAt();
                                nextDepartment = departmentForLocation(openTransfer.toLocation);
                                nextLocation = openTransfer.toLocation;
                                refType = "TRANSFER";
                                refId = openTransfer.getId();
                                refNo = openTransfer.transferNumber;
                        } else if (!route.isEmpty()) {
                                MatFlowTransferOrder last = route.get(route.size() - 1);
                                currentLocation = last.toLocation;
                                currentLocationCode = locationCode(currentLocation);
                                department = departmentForLocation(currentLocation);
                                movementState = "ROUTE_RECEIVED";
                                lastMoved = last.getUpdatedAt();
                                nextDepartment = currentLocation != null
                                                && currentLocation.getLocationType() == LocationType.PRODUCTION
                                                                ? "STORE / PRODUCTION"
                                                                : department;
                                nextLocation = currentLocation;
                                refType = "TRANSFER";
                                refId = last.getId();
                                refNo = last.transferNumber;
                        } else {
                                currentLocation = reservation.sourceLocation;
                                currentLocationCode = locationCode(currentLocation);
                                department = departmentForLocation(currentLocation);
                                movementState = "RESERVED";
                                lastMoved = reservation.getUpdatedAt();
                                nextDepartment = departmentForLocation(reservation.firstDestinationLocation);
                                nextLocation = reservation.firstDestinationLocation;
                                refType = "RESERVATION";
                                refId = reservation.getId();
                                refNo = c.requisition().requisitionNumber;
                        }

                        return new TrackerMaterialPosition(
                                        line.getId(), reservation.getId(),
                                        currentMaterial == null ? null : currentMaterial.getId(),
                                        line.material == null ? null : line.material.getMaterialCode(),
                                        currentMaterial == null ? null : currentMaterial.getMaterialCode(),
                                        currentMaterial == null ? null : currentMaterial.getMaterialName(),
                                        currentMaterial == null ? null : currentMaterial.getCategory(),
                                        currentMaterial == null ? null : currentMaterial.getUom(),
                                        scale(line.requestedQty), scale(line.reservedQty), scale(line.shortageQty),
                                        scale(line.issuedQty),
                                        scale(line.consumedQty), scale(line.returnedQty),
                                        scale(reservation.reservedQty),
                                        department, currentLocation == null ? null : currentLocation.getId(),
                                        currentLocationCode,
                                        currentLocation == null ? null : currentLocation.getLocationName(),
                                        currentLocation == null || currentLocation.getLocationType() == null ? null
                                                        : currentLocation.getLocationType().name(),
                                        movementState, lastMoved, nextDepartment,
                                        nextLocation == null ? null : nextLocation.getId(),
                                        nextLocation == null ? null : nextLocation.getLocationCode(), refType, refId,
                                        refNo);
                }

                private TrackerCycleSummary buildCycle(TrackingContext c, List<TrackerStageTiming> stages,
                                TrackerRowResponse summary) {
                        LocalDateTime projectStart = c.requisition().projectDrawing == null ? null
                                        : c.requisition().projectDrawing.getProject() != null
                                                        ? c.requisition().projectDrawing.getProject().getCreatedAt()
                                                        : c.requisition().projectDrawing.getCreatedAt();
                        LocalDateTime requisitionStart = c.requisition().requestedAt != null
                                        ? c.requisition().requestedAt
                                        : c.requisition().getCreatedAt();
                        LocalDateTime completed = summary.completedAt();
                        long totalProject = minutesBetween(projectStart,
                                        completed == null ? LocalDateTime.now() : completed);
                        long reqLead = minutesBetween(requisitionStart,
                                        completed == null ? LocalDateTime.now() : completed);
                        List<TrackerStageTiming> applicable = stages.stream().filter(s -> !"SKIPPED".equals(s.state()))
                                        .toList();
                        List<TrackerStageTiming> done = applicable.stream().filter(s -> "DONE".equals(s.state()))
                                        .toList();
                        long avg = done.isEmpty() ? 0L
                                        : Math.round(done.stream().mapToLong(TrackerStageTiming::durationMinutes)
                                                        .average().orElse(0));
                        TrackerStageTiming bottleneck = applicable.stream().filter(s -> s.durationMinutes() > 0)
                                        .max(Comparator.comparingLong(TrackerStageTiming::durationMinutes))
                                        .orElse(null);
                        int breached = (int) applicable.stream().filter(s -> isBreach(s.timingHealth())).count();
                        return new TrackerCycleSummary(projectStart, requisitionStart, completed, totalProject, reqLead,
                                        summary.stageDurationMinutes(), done.size(), applicable.size(), avg,
                                        bottleneck == null ? null : bottleneck.label(),
                                        bottleneck == null ? 0L : bottleneck.durationMinutes(),
                                        breached, completed != null);
                }

                private Position resolveCurrentPosition(TrackingContext c, String stage, BigDecimal shortageQty) {
                        MatFlowMaterialRequisition r = c.requisition();
                        MatFlowLocation production = r.destinationLocation;

                        if ("PRODUCTION_COMPLETED".equals(stage)) {
                                return Position.of("PRODUCTION / COMPLETE", production);
                        }
                        if ("CANCELLED".equals(stage))
                                return new Position("CLOSED", null, null, null, null);

                        MatFlowTransferOrder open = c.transfers().stream().filter(this::isOpenTransfer).findFirst()
                                        .orElse(null);
                        boolean someIssued = c.lines().stream()
                                        .anyMatch(line -> safe(line.issuedQty).compareTo(BigDecimal.ZERO) > 0);
                        boolean activeSupplyBranch = shortageQty.compareTo(BigDecimal.ZERO) > 0 || open != null;
                        if (someIssued && activeSupplyBranch) {
                                return new Position(
                                                "MULTI-DEPARTMENT",
                                                null,
                                                "PARALLEL FLOW",
                                                "Material is split across Production and the remaining Purchase / Route branch",
                                                "PARALLEL");
                        }

                        if ("PRODUCTION_IN_PROGRESS".equals(stage) || "PRODUCTION_ISSUE".equals(stage)) {
                                return Position.of("PRODUCTION", production);
                        }

                        if (open != null) {
                                String status = enumName(open.status);
                                if (Set.of("PARTIALLY_DISPATCHED", "IN_TRANSIT", "PARTIALLY_RECEIVED")
                                                .contains(status)) {
                                        return new Position("IN TRANSIT", null,
                                                        routeLabel(open.fromLocation, open.toLocation),
                                                        "Physical movement between departments", "TRANSIT");
                                }
                                return Position.of(departmentForLocation(open.fromLocation), open.fromLocation);
                        }

                        if (shortageQty.compareTo(BigDecimal.ZERO) > 0) {
                                MatFlowLocation target = firstIndentLocation(c);
                                return new Position("PURCHASE", target == null ? null : target.getId(),
                                                "AWAITING SUPPLY",
                                                target == null ? "Vendor / procurement"
                                                                : "Procurement for " + target.getLocationName(),
                                                "EXTERNAL_SUPPLY");
                        }
                        if ("AWAITING_STORE_PLANNING".equals(stage) || "MATERIAL_RESERVED".equals(stage)
                                        || "READY_TO_ISSUE".equals(stage)) {
                                MatFlowLocation store = firstStoreLocation(c);
                                return store == null
                                                ? new Position("STORE", null, "STORE", "Store planning / custody",
                                                                "STORE")
                                                : Position.of("STORE", store);
                        }
                        if ("DRAFT".equals(stage))
                                return Position.of("PRODUCTION", production);
                        return Position.of(resolveResponsibleDesk(stage), production);
                }

                private Position resolveNextPosition(TrackingContext c, String stage, Position current) {
                        MatFlowLocation production = c.requisition().destinationLocation;
                        return switch (stage) {
                                case "DRAFT" -> new Position("STORE", null, "STORE", "Store review", "STORE");
                                case "AWAITING_STORE_PLANNING" -> new Position("STORE / QC", null, "RESERVE / QC",
                                                "Reservation and QC route", "WORKFLOW");
                                case "SHORTAGE_PENDING" -> Position.of("QC", firstIndentLocation(c));
                                case "MATERIAL_RESERVED", "TRANSFER_IN_PROGRESS" -> nextOpenTransferPosition(c);
                                case "READY_TO_ISSUE" -> Position.of("PRODUCTION", production);
                                case "PRODUCTION_ISSUE" -> Position.of("PRODUCTION", production);
                                case "PRODUCTION_IN_PROGRESS" ->
                                        new Position("COMPLETE", production == null ? null : production.getId(),
                                                        production == null ? null : production.getLocationCode(),
                                                        "Finish and close material execution", "PRODUCTION");
                                case "PRODUCTION_COMPLETED", "CANCELLED" ->
                                        new Position("NONE", null, null, "No pending operational hand-off", "CLOSED");
                                default -> current;
                        };
                }

                private Position nextOpenTransferPosition(TrackingContext c) {
                        MatFlowTransferOrder open = c.transfers().stream().filter(this::isOpenTransfer).findFirst()
                                        .orElse(null);
                        if (open == null)
                                return Position.of("PRODUCTION", c.requisition().destinationLocation);
                        return Position.of(departmentForLocation(open.toLocation), open.toLocation);
                }

                private Position qcPosition(TrackingContext context) {
                        MatFlowQcInspection inspection = context.inspections().stream()
                                        .filter(item -> item != null && item.location != null)
                                        .filter(item -> "PENDING".equals(enumName(item.status)))
                                        .min(Comparator.comparing(MatFlowQcInspection::getCreatedAt,
                                                        Comparator.nullsLast(Comparator.naturalOrder())))
                                        .orElse(null);
                        /* inspection.location is the physical Store custody location for new checks. */
                        return inspection == null ? Position.of("QUALITY CONTROL", null)
                                        : Position.of("QUALITY CONTROL", inspection.location);
                }

                private Position processingPosition(TrackingContext context) {
                        MatFlowProcessingJob job = context.jobs().stream()
                                        .filter(item -> item != null &&
                                                        !Set.of("COMPLETED", "CANCELLED")
                                                                        .contains(enumName(item.status)))
                                        .min(Comparator.comparing(MatFlowProcessingJob::getCreatedAt,
                                                        Comparator.nullsLast(Comparator.naturalOrder())))
                                        .orElse(null);
                        return job == null ? Position.of("PROCESSING", null)
                                        : Position.of("PROCESSING", job.location);
                }

                private LocalDateTime resolveStageStart(TrackingContext c, String currentStage, Position current) {
                        MatFlowMaterialRequisition r = c.requisition();
                        return switch (currentStage) {
                                case "DRAFT" -> firstNonNull(r.requestedAt, r.getCreatedAt());
                                case "AWAITING_STORE_PLANNING" ->
                                        firstNonNull(r.submittedAt, r.requestedAt, r.getCreatedAt());
                                case "SHORTAGE_PENDING", "MATERIAL_RESERVED", "READY_TO_ISSUE" ->
                                        firstNonNull(r.plannedAt, r.submittedAt, r.requestedAt);
                                case "TRANSFER_IN_PROGRESS" -> c.transfers().stream().filter(this::isOpenTransfer)
                                                .map(MatFlowTransferOrder::getCreatedAt)
                                                .filter(java.util.Objects::nonNull).min(LocalDateTime::compareTo)
                                                .orElse(firstNonNull(r.plannedAt, r.submittedAt));
                                case "PRODUCTION_ISSUE" ->
                                        firstNonNull(latestAuditTime(c.audits(), "MATERIAL_ISSUED_TO_PRODUCTION"),
                                                        r.getUpdatedAt(), r.plannedAt);
                                case "PRODUCTION_IN_PROGRESS" -> firstNonNull(
                                                earliestAuditTime(c.audits(), "PRODUCTION_STARTED"), r.getUpdatedAt());
                                case "PRODUCTION_COMPLETED" -> resolveCompletionAt(c);
                                case "CANCELLED" -> firstNonNull(r.cancelledAt, r.getUpdatedAt());
                                default -> firstNonNull(r.getUpdatedAt(), r.requestedAt, r.getCreatedAt());
                        };
                }

                private LocalDateTime resolveCompletionAt(TrackingContext c) {
                        LocalDateTime audit = latestAuditTime(c.audits(), "PRODUCTION_COMPLETED");
                        if (audit != null)
                                return audit;
                        String status = enumName(c.requisition().status);
                        return ("PRODUCTION_COMPLETED".equals(status) || "COMPLETED".equals(status))
                                        ? c.requisition().getUpdatedAt()
                                        : null;
                }

                private LocalDateTime resolvePurchaseEnd(TrackingContext c) {
                        if (c.indents().isEmpty())
                                return null;
                        boolean allClosed = c.indents().stream().allMatch(indent -> !isOpenIndent(indent));
                        boolean noShortage = sum(c.lines(), QuantityField.SHORTAGE).compareTo(BigDecimal.ZERO) <= 0;
                        if (!allClosed && !noShortage)
                                return null;
                        LocalDateTime qcEnd = c.inspections().stream().map(q -> q.inspectedAt)
                                        .filter(java.util.Objects::nonNull)
                                        .max(LocalDateTime::compareTo).orElse(null);
                        LocalDateTime receiptEnd = c.receipts().stream().map(g -> g.receivedAt)
                                        .filter(java.util.Objects::nonNull)
                                        .max(LocalDateTime::compareTo).orElse(null);
                        LocalDateTime poEnd = c.orders().stream()
                                        .map(po -> po.approvedAt != null ? po.approvedAt : po.getUpdatedAt())
                                        .filter(java.util.Objects::nonNull)
                                        .max(LocalDateTime::compareTo).orElse(null);
                        return latest(qcEnd, receiptEnd, poEnd);
                }

                private LocalDateTime resolveRouteEnd(TrackingContext c) {
                        if (c.transfers().isEmpty())
                                return null;
                        boolean allClosed = c.transfers().stream()
                                        .allMatch(t -> CLOSED_TRANSFER_STATUSES.contains(enumName(t.status)));
                        if (!allClosed)
                                return null;
                        return c.transfers().stream().map(MatFlowTransferOrder::getUpdatedAt)
                                        .filter(java.util.Objects::nonNull)
                                        .max(LocalDateTime::compareTo).orElse(null);
                }

                private MatFlowLocation firstStoreLocation(TrackingContext c) {
                        return c.reservations().stream().map(r -> r.sourceLocation)
                                        .filter(java.util.Objects::nonNull)
                                        .filter(l -> l.getLocationType() == LocationType.STORE)
                                        .findFirst().orElse(null);
                }

                private MatFlowLocation firstIndentLocation(TrackingContext c) {
                        return c.indents().stream().map(i -> i.deliverToLocation).filter(java.util.Objects::nonNull)
                                        .findFirst().orElse(null);
                }

                private MatFlowLocation currentRouteLocation(TrackingContext c) {
                        MatFlowTransferOrder open = c.transfers().stream().filter(this::isOpenTransfer).findFirst()
                                        .orElse(null);
                        return open == null ? c.requisition().destinationLocation : transferCurrentLocation(open);
                }

                private String currentRouteDepartment(TrackingContext c) {
                        MatFlowTransferOrder open = c.transfers().stream().filter(this::isOpenTransfer).findFirst()
                                        .orElse(null);
                        return open == null ? "ROUTE" : transferDepartment(open);
                }

                private MatFlowLocation transferCurrentLocation(MatFlowTransferOrder transfer) {
                        if (transfer == null)
                                return null;
                        String status = enumName(transfer.status);
                        if (Set.of("PARTIALLY_DISPATCHED", "IN_TRANSIT", "PARTIALLY_RECEIVED").contains(status))
                                return null;
                        if ("RECEIVED".equals(status))
                                return transfer.toLocation;
                        return transfer.fromLocation;
                }

                private String transferDepartment(MatFlowTransferOrder transfer) {
                        if (transfer == null)
                                return "TRANSFER";
                        String status = enumName(transfer.status);
                        if (Set.of("PARTIALLY_DISPATCHED", "IN_TRANSIT", "PARTIALLY_RECEIVED").contains(status))
                                return "IN TRANSIT";
                        return departmentForLocation(transferCurrentLocation(transfer));
                }

                private String departmentForLocation(MatFlowLocation location) {
                        if (location == null || location.getLocationType() == null)
                                return "UNKNOWN";
                        String type = location.getLocationType().name().toUpperCase(Locale.ROOT);
                        return switch (type) {
                                case "STORE" -> "STORE";
                                case "QC" -> "QC";
                                case "PROCESSING", "EXTERNAL_PROCESSOR" -> "PROCESSING";
                                case "PRODUCTION" -> "PRODUCTION";
                                case "SUPPLIER" -> "SUPPLIER / PURCHASE";
                                case "TRANSIT" -> "IN TRANSIT";
                                default -> type;
                        };
                }

                private String routeLabel(MatFlowLocation from, MatFlowLocation to) {
                        return safeText(locationCode(from)) + " → " + safeText(locationCode(to));
                }

                private String locationCode(MatFlowLocation location) {
                        if (location == null) {
                                return null;
                        }
                        String plant = clean(location.getPlantCode());
                        LocationType type = location.getLocationType();
                        if (type == null) {
                                return plant;
                        }
                        return switch (type) {
                                case STORE -> MatFlowPlantRoutingService.MAIN_STORE_PLANT.equalsIgnoreCase(plant)
                                                ? "AL-P1 MAIN STORE"
                                                : (plant == null ? "PLANT STORE" : plant + " STORE");
                                case PRODUCTION -> plant == null ? "PRODUCTION" : plant + " PRODUCTION";
                                case PROCESSING, EXTERNAL_PROCESSOR -> clean(location.getLocationCode()) == null
                                                ? "PROCESSING UNIT"
                                                : location.getLocationCode();
                                case SUPPLIER -> "SUPPLIER";
                                case TRANSIT -> "IN TRANSIT";
                                case QC -> "QC CHECK";
                        };
                }

                private String lastRouteActor(TrackingContext c) {
                        return c.transfers().stream().map(MatFlowTransferOrder::getId)
                                        .map(id -> latestActorForEntity(c.audits(), id))
                                        .filter(java.util.Objects::nonNull).reduce((a, b) -> b).orElse(null);
                }

                private String latestActorForEntity(List<MatFlowAuditLog> audits, UUID id) {
                        if (id == null)
                                return null;
                        return audits.stream().filter(a -> id.equals(a.getEntityId()))
                                        .max(Comparator.comparing(MatFlowAuditLog::getActionAt,
                                                        Comparator.nullsFirst(Comparator.naturalOrder())))
                                        .map(MatFlowAuditLog::getActor).orElse(null);
                }

                private String lastActorFor(List<MatFlowAuditLog> audits, String action) {
                        return audits.stream().filter(a -> action.equalsIgnoreCase(a.getAction()))
                                        .max(Comparator.comparing(MatFlowAuditLog::getActionAt,
                                                        Comparator.nullsFirst(Comparator.naturalOrder())))
                                        .map(MatFlowAuditLog::getActor).orElse(null);
                }

                private LocalDateTime earliestAuditTime(List<MatFlowAuditLog> audits, String action) {
                        return audits.stream().filter(a -> action.equalsIgnoreCase(a.getAction()))
                                        .map(MatFlowAuditLog::getActionAt)
                                        .filter(java.util.Objects::nonNull).min(LocalDateTime::compareTo).orElse(null);
                }

                private LocalDateTime latestAuditTime(List<MatFlowAuditLog> audits, String action) {
                        return audits.stream().filter(a -> action.equalsIgnoreCase(a.getAction()))
                                        .map(MatFlowAuditLog::getActionAt)
                                        .filter(java.util.Objects::nonNull).max(LocalDateTime::compareTo).orElse(null);
                }

                private boolean allIssued(TrackerRowResponse summary) {
                        return summary.requestedQty().compareTo(BigDecimal.ZERO) > 0
                                        && summary.issuedQty().compareTo(summary.requestedQty()) >= 0;
                }

                private int resolveActualProgress(String stage, int base, BigDecimal requested, BigDecimal consumed,
                                List<MatFlowTransferOrder> transfers) {
                        if ("PRODUCTION_COMPLETED".equals(stage))
                                return 100;
                        if ("CANCELLED".equals(stage))
                                return 0;
                        if ("PRODUCTION_IN_PROGRESS".equals(stage) && requested.compareTo(BigDecimal.ZERO) > 0) {
                                double ratio = Math.min(1d, consumed.doubleValue() / requested.doubleValue());
                                return Math.min(99, 92 + (int) Math.round(ratio * 7));
                        }
                        if ("TRANSFER_IN_PROGRESS".equals(stage) && !transfers.isEmpty()) {
                                long closed = transfers.stream()
                                                .filter(t -> CLOSED_TRANSFER_STATUSES.contains(enumName(t.status)))
                                                .count();
                                return Math.min(81, 60 + (int) Math.round((closed * 20d) / transfers.size()));
                        }
                        return base;
                }

                private TrackerKpiResponse createKpis(List<TrackerRowResponse> rows) {
                        int activeRequisitions = (int) rows.stream()
                                        .filter(row -> !"CANCELLED".equals(row.currentStage())
                                                        && !"PRODUCTION_COMPLETED".equals(row.currentStage()))
                                        .count();
                        int awaitingStorePlanning = countStage(rows, "AWAITING_STORE_PLANNING");
                        int shortagePending = countStage(rows, "SHORTAGE_PENDING");
                        int materialReserved = countStage(rows, "MATERIAL_RESERVED");
                        int materialInTransit = countStage(rows, "TRANSFER_IN_PROGRESS");
                        int productionInProgress = countStage(rows, "PRODUCTION_ISSUE")
                                        + countStage(rows, "PRODUCTION_IN_PROGRESS");
                        int openIndents = rows.stream().mapToInt(TrackerRowResponse::openIndentCount).sum();
                        BigDecimal totalRequested = rows.stream().map(TrackerRowResponse::requestedQty)
                                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                        BigDecimal totalReserved = rows.stream().map(TrackerRowResponse::reservedQty)
                                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                        BigDecimal totalShortage = rows.stream().map(TrackerRowResponse::shortageQty)
                                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                        return new TrackerKpiResponse(activeRequisitions, awaitingStorePlanning, shortagePending,
                                        materialReserved,
                                        materialInTransit, productionInProgress, openIndents, scale(totalRequested),
                                        scale(totalReserved), scale(totalShortage));
                }

                private boolean hasPendingQc(TrackingContext context) {
                        return context != null && context.inspections().stream()
                                        .anyMatch(inspection -> inspection != null &&
                                                        "PENDING".equals(enumName(inspection.status)));
                }

                private boolean hasPendingQcRouting(TrackingContext context) {
                        return false;
                }

                private boolean hasActiveProcessing(TrackingContext context) {
                        return context != null && context.jobs().stream()
                                        .anyMatch(job -> job != null &&
                                                        !Set.of("COMPLETED", "CANCELLED")
                                                                        .contains(enumName(job.status)));
                }

                private String resolveCurrentStage(RequisitionStatus status, BigDecimal requestedQty,
                                BigDecimal reservedQty,
                                BigDecimal shortageQty, BigDecimal issuedQty, BigDecimal consumedQty,
                                int openTransferCount) {
                        String statusName = enumName(status);
                        if ("CANCELLED".equals(statusName))
                                return "CANCELLED";
                        if ("PRODUCTION_COMPLETED".equals(statusName) || "COMPLETED".equals(statusName))
                                return "PRODUCTION_COMPLETED";
                        if ("PRODUCTION_STARTED".equals(statusName))
                                return "PRODUCTION_IN_PROGRESS";
                        if ("ISSUED_TO_PRODUCTION".equals(statusName) || "PARTIALLY_ISSUED".equals(statusName) ||
                                        "ISSUED".equals(statusName) || issuedQty.compareTo(BigDecimal.ZERO) > 0)
                                return "PRODUCTION_ISSUE";
                        if (openTransferCount > 0)
                                return "TRANSFER_IN_PROGRESS";
                        if (shortageQty.compareTo(BigDecimal.ZERO) > 0 || "SHORTAGE_PENDING".equals(statusName))
                                return "SHORTAGE_PENDING";
                        if ("READY_TO_ISSUE".equals(statusName))
                                return "READY_TO_ISSUE";
                        if ("PARTIALLY_RESERVED".equals(statusName) || "PLANNED".equals(statusName)
                                        || reservedQty.compareTo(BigDecimal.ZERO) > 0)
                                return "MATERIAL_RESERVED";
                        if ("SUBMITTED_TO_STORE".equals(statusName))
                                return "ORIGIN_STORE_FORWARDING";
                        if ("STORE_REVIEW_IN_PROGRESS".equals(statusName) || "SUBMITTED".equals(statusName))
                                return "AWAITING_MAIN_STORE_PLANNING";
                        if ("DRAFT".equals(statusName))
                                return "DRAFT";
                        return statusName.isBlank() ? "UNKNOWN" : statusName;
                }

                private String resolveResponsibleDesk(String stage) {
                        return switch (stage) {
                                case "DRAFT", "PRODUCTION_ISSUE", "PRODUCTION_IN_PROGRESS", "PRODUCTION_COMPLETED" ->
                                        "PRODUCTION";
                                case "ORIGIN_STORE_FORWARDING" -> "ORIGIN PLANT STORE";
                                case "AWAITING_MAIN_STORE_PLANNING", "MATERIAL_RESERVED", "READY_TO_ISSUE" -> "AL-P1 MAIN STORE";
                                case "SHORTAGE_PENDING" -> "STORE / PURCHASE";
                                case "QC_PENDING" -> "QUALITY CONTROL";
                                case "PROCESSING" -> "PROCESSING";
                                case "TRANSFER_IN_PROGRESS" -> "ROUTE / TRANSFER";
                                case "CANCELLED" -> "CLOSED";
                                default -> "MATFLOW CONTROL";
                        };
                }

                private int resolveProgressPercent(String stage) {
                        return switch (stage) {
                                case "DRAFT" -> 15;
                                case "ORIGIN_STORE_FORWARDING" -> 24;
                                case "AWAITING_MAIN_STORE_PLANNING" -> 30;
                                case "SHORTAGE_PENDING" -> 48;
                                case "MATERIAL_RESERVED" -> 58;
                                case "QC_PENDING" -> 64;
                                case "PROCESSING" -> 74;
                                case "TRANSFER_IN_PROGRESS" -> 72;
                                case "READY_TO_ISSUE" -> 82;
                                case "PRODUCTION_ISSUE" -> 88;
                                case "PRODUCTION_IN_PROGRESS" -> 95;
                                case "PRODUCTION_COMPLETED" -> 100;
                                case "CANCELLED" -> 0;
                                default -> 20;
                        };
                }

                private long targetForCurrentStage(String stage) {
                        return switch (stage) {
                                case "DRAFT" -> target("DEMAND");
                                case "ORIGIN_STORE_FORWARDING", "AWAITING_MAIN_STORE_PLANNING",
                                                "MATERIAL_RESERVED", "READY_TO_ISSUE" -> target("STORE");
                                case "SHORTAGE_PENDING" -> target("PURCHASE");
                                case "QC_PENDING" -> target("QC");
                                case "PROCESSING" -> target("PROCESSING");
                                case "TRANSFER_IN_PROGRESS" -> target("ROUTE");
                                case "PRODUCTION_ISSUE" -> target("PRODUCTION_ISSUE");
                                case "PRODUCTION_IN_PROGRESS" -> target("PRODUCTION");
                                default -> 0L;
                        };
                }

                private long target(String key) {
                        return TARGET_MINUTES.getOrDefault(key, 0L);
                }

                private String timingHealth(LocalDateTime start, LocalDateTime end, long target, boolean completed) {
                        if (start == null)
                                return "NOT_STARTED";
                        if (target <= 0)
                                return completed || end != null ? "COMPLETED" : "ON_TRACK";
                        long duration = minutesBetween(start, end == null ? LocalDateTime.now() : end);
                        if (end != null || completed)
                                return duration > target ? "COMPLETED_LATE" : "COMPLETED";
                        if (duration > target)
                                return "BREACHED";
                        if (duration >= Math.round(target * 0.75d))
                                return "WATCH";
                        return "ON_TRACK";
                }

                private boolean isBreach(String health) {
                        return "BREACHED".equals(health) || "COMPLETED_LATE".equals(health);
                }

                private String majorKeyForCurrentStage(String stage) {
                        return switch (stage) {
                                case "DRAFT" -> "DEMAND";
                                case "ORIGIN_STORE_FORWARDING", "AWAITING_MAIN_STORE_PLANNING",
                                                "MATERIAL_RESERVED" -> "STORE";
                                case "SHORTAGE_PENDING" -> "PURCHASE";
                                case "QC_PENDING", "PROCESSING", "TRANSFER_IN_PROGRESS",
                                                "READY_TO_ISSUE" ->
                                        "ROUTE";
                                case "PRODUCTION_ISSUE" -> "PRODUCTION_ISSUE";
                                case "PRODUCTION_IN_PROGRESS" -> "PRODUCTION";
                                case "PRODUCTION_COMPLETED" -> "COMPLETE";
                                default -> stage;
                        };
                }

                private boolean isOpenTransfer(MatFlowTransferOrder transfer) {
                        return transfer != null && !CLOSED_TRANSFER_STATUSES.contains(enumName(transfer.status));
                }

                private boolean isOpenIndent(MatFlowIndent indent) {
                        return indent != null && !CLOSED_INDENT_STATUSES.contains(enumName(indent.status));
                }

                private boolean canReadTrackerRequisition(MatFlowMaterialRequisition requisition) {
                        if (!hasReadableProject(requisition)) {
                                return false;
                        }
                        String originPlant = normalizeCode(requisition.projectDrawing.getPlantCode());
                        if (accessService.canAccessPlant(originPlant)) {
                                return true;
                        }
                        return plantRoutingService.canActAsMainStore()
                                        && requisition.status != RequisitionStatus.DRAFT
                                        && requisition.status != RequisitionStatus.SUBMITTED_TO_STORE;
                }

                private boolean hasReadableProject(MatFlowMaterialRequisition requisition) {
                        return requisition != null && requisition.projectDrawing != null
                                        && normalizeCode(requisition.projectDrawing.getPlantCode()) != null;
                }

                private boolean matchesProjectSearch(
                                MatFlowMaterialRequisition requisition,
                                String query) {
                        if (requisition == null || requisition.projectDrawing == null) {
                                return false;
                        }

                        MatFlowProjectDrawing product = requisition.projectDrawing;

                        return contains(product.getProjectCode(), query)
                                        || contains(product.getProjectName(), query)
                                        || contains(product.getClientName(), query)
                                        || contains(product.getProductName(), query)
                                        || contains(product.getDrawingNo(), query)
                                        || contains(product.getPlantCode(), query);
                }

                private boolean matchesSearch(TrackerRowResponse row, String query) {
                        return contains(row.requisitionNumber(), query) || contains(row.projectCode(), query)
                                        || contains(row.drawingNo(), query) ||
                                        contains(row.bomNumber(), query)
                                        || contains(row.productionCustodyCode(), query)
                                        || contains(row.productionCustodyName(), query) ||
                                        contains(row.productionPlantCode(), query)
                                        || contains(row.currentStage(), query) || contains(row.responsibleDesk(), query)
                                        ||
                                        contains(row.currentDepartment(), query)
                                        || contains(row.currentCustodyCode(), query)
                                        || contains(row.nextDepartment(), query);
                }

                private int countStage(List<TrackerRowResponse> rows, String stage) {
                        return (int) rows.stream().filter(row -> stage.equals(row.currentStage())).count();
                }

                private BigDecimal sum(List<MatFlowRequisitionLine> lines, QuantityField field) {
                        return scale(lines.stream().map(line -> quantityOf(line, field)).reduce(BigDecimal.ZERO,
                                        BigDecimal::add));
                }

                private BigDecimal quantityOf(MatFlowRequisitionLine line, QuantityField field) {
                        if (line == null)
                                return BigDecimal.ZERO;
                        return switch (field) {
                                case REQUESTED -> safe(line.requestedQty);
                                case RESERVED -> safe(line.reservedQty);
                                case SHORTAGE -> safe(line.shortageQty);
                                case ISSUED -> safe(line.issuedQty);
                                case CONSUMED -> safe(line.consumedQty);
                                case RETURNED -> safe(line.returnedQty);
                        };
                }

                private BigDecimal safe(BigDecimal value) {
                        return value == null ? BigDecimal.ZERO : value;
                }

                private BigDecimal scale(BigDecimal value) {
                        return safe(value).setScale(3, RoundingMode.HALF_UP);
                }

                private long minutesBetween(LocalDateTime start, LocalDateTime end) {
                        if (start == null || end == null)
                                return 0L;
                        return Math.max(0L, Duration.between(start, end).toMinutes());
                }

                private LocalDateTime firstNonNull(LocalDateTime... values) {
                        if (values != null)
                                for (LocalDateTime value : values)
                                        if (value != null)
                                                return value;
                        return null;
                }

                private LocalDateTime latest(LocalDateTime... values) {
                        LocalDateTime result = null;
                        if (values != null)
                                for (LocalDateTime value : values)
                                        if (value != null && (result == null || value.isAfter(result)))
                                                result = value;
                        return result;
                }

                /**
                 * Null-safe text normalizer used by TrackerModule business-label helpers.
                 * ReportingModule has its own helper because both modules are static siblings.
                 */
                private String clean(String value) {
                        if (value == null) {
                                return null;
                        }

                        String result = value.trim();
                        return result.isBlank() ? null : result;
                }

                private String normalizeSearch(String value) {
                        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
                }

                private String normalizeCode(String value) {
                        return value == null || value.trim().isBlank() ? null : value.trim().toUpperCase(Locale.ROOT);
                }

                private boolean contains(String value, String query) {
                        return value != null && value.toLowerCase(Locale.ROOT).contains(query);
                }

                private String enumName(Enum<?> value) {
                        return value == null ? "" : value.name().toUpperCase(Locale.ROOT);
                }

                private String readableStage(String value) {
                        return value == null ? "Current stage" : value.replace('_', ' ');
                }

                private String safeText(String value) {
                        return value == null || value.isBlank() ? "-" : value;
                }

                private MatFlowMaterialRequisition unwrapRequisition(MatFlowMaterialRequisition raw) {
                        if (raw == null)
                                return null;
                        MatFlowMaterialRequisition r = (MatFlowMaterialRequisition) Hibernate.unproxy(raw);
                        if (r.projectDrawing != null)
                                r.projectDrawing = (MatFlowProjectDrawing) Hibernate.unproxy(r.projectDrawing);
                        if (r.bom != null)
                                r.bom = (MatFlowBom) Hibernate.unproxy(r.bom);
                        if (r.destinationLocation != null)
                                r.destinationLocation = (MatFlowLocation) Hibernate.unproxy(r.destinationLocation);
                        if (r.originStore != null)
                                r.originStore = (MatFlowLocation) Hibernate.unproxy(r.originStore);
                        if (r.mainStore != null)
                                r.mainStore = (MatFlowLocation) Hibernate.unproxy(r.mainStore);
                        return r;
                }

                private MatFlowRequisitionLine unwrapLine(MatFlowRequisitionLine raw) {
                        if (raw == null)
                                return null;
                        MatFlowRequisitionLine line = (MatFlowRequisitionLine) Hibernate.unproxy(raw);
                        if (line.requisition != null)
                                line.requisition = unwrapRequisition(line.requisition);
                        if (line.bomLine != null)
                                line.bomLine = (MatFlowBomLine) Hibernate.unproxy(line.bomLine);
                        if (line.material != null)
                                line.material = (MatFlowMaterial) Hibernate.unproxy(line.material);
                        if (line.issuedMaterial != null)
                                line.issuedMaterial = (MatFlowMaterial) Hibernate.unproxy(line.issuedMaterial);
                        return line;
                }

                private MatFlowReservation unwrapReservation(MatFlowReservation raw) {
                        if (raw == null)
                                return null;
                        MatFlowReservation r = (MatFlowReservation) Hibernate.unproxy(raw);
                        if (r.requisitionLine != null)
                                r.requisitionLine = unwrapLine(r.requisitionLine);
                        if (r.material != null)
                                r.material = (MatFlowMaterial) Hibernate.unproxy(r.material);
                        if (r.sourceLocation != null)
                                r.sourceLocation = (MatFlowLocation) Hibernate.unproxy(r.sourceLocation);
                        if (r.firstDestinationLocation != null)
                                r.firstDestinationLocation = (MatFlowLocation) Hibernate
                                                .unproxy(r.firstDestinationLocation);
                        return r;
                }

                private MatFlowIndent unwrapIndent(MatFlowIndent raw) {
                        if (raw == null)
                                return null;
                        MatFlowIndent indent = (MatFlowIndent) Hibernate.unproxy(raw);
                        if (indent.requisition != null)
                                indent.requisition = unwrapRequisition(indent.requisition);
                        if (indent.projectDrawing != null)
                                indent.projectDrawing = (MatFlowProjectDrawing) Hibernate.unproxy(indent.projectDrawing);
                        if (indent.deliverToLocation != null)
                                indent.deliverToLocation = (MatFlowLocation) Hibernate.unproxy(indent.deliverToLocation);
                        return indent;
                }

                private MatFlowProcessingJob unwrapProcessingJob(MatFlowProcessingJob raw) {
                        if (raw == null)
                                return null;
                        MatFlowProcessingJob job = (MatFlowProcessingJob) Hibernate.unproxy(raw);
                        if (job.requisition != null)
                                job.requisition = unwrapRequisition(job.requisition);
                        if (job.reservation != null)
                                job.reservation = unwrapReservation(job.reservation);
                        if (job.location != null)
                                job.location = (MatFlowLocation) Hibernate.unproxy(job.location);
                        if (job.inputMaterial != null)
                                job.inputMaterial = (MatFlowMaterial) Hibernate.unproxy(job.inputMaterial);
                        if (job.outputMaterial != null)
                                job.outputMaterial = (MatFlowMaterial) Hibernate.unproxy(job.outputMaterial);
                        return job;
                }

                private MatFlowQcInspection unwrapQcInspection(MatFlowQcInspection raw) {
                        if (raw == null)
                                return null;
                        MatFlowQcInspection qc = (MatFlowQcInspection) Hibernate.unproxy(raw);
                        if (qc.location != null)
                                qc.location = (MatFlowLocation) Hibernate.unproxy(qc.location);
                        return qc;
                }

                private MatFlowTransferOrder unwrapTransfer(MatFlowTransferOrder raw) {
                        if (raw == null)
                                return null;
                        MatFlowTransferOrder t = (MatFlowTransferOrder) Hibernate.unproxy(raw);
                        if (t.requisition != null)
                                t.requisition = unwrapRequisition(t.requisition);
                        if (t.reservation != null)
                                t.reservation = unwrapReservation(t.reservation);
                        if (t.fromLocation != null)
                                t.fromLocation = (MatFlowLocation) Hibernate.unproxy(t.fromLocation);
                        if (t.toLocation != null)
                                t.toLocation = (MatFlowLocation) Hibernate.unproxy(t.toLocation);
                        return t;
                }

                private enum QuantityField {
                        REQUESTED, RESERVED, SHORTAGE, ISSUED, CONSUMED, RETURNED
                }

                private record Position(String department, UUID locationId, String locationCode, String locationName,
                                String locationType) {
                        static Position of(String department, MatFlowLocation location) {
                                if (location == null) {
                                        return new Position(department, null, null, null, null);
                                }
                                String plant = location.getPlantCode() == null ? null
                                                : location.getPlantCode().trim().toUpperCase(Locale.ROOT);
                                LocationType type = location.getLocationType();
                                String businessCode;
                                String businessName;
                                if (type == LocationType.STORE) {
                                        businessCode = MatFlowPlantRoutingService.MAIN_STORE_PLANT.equals(plant)
                                                        ? "AL-P1 MAIN STORE"
                                                        : (plant == null ? "PLANT STORE" : plant + " STORE");
                                        businessName = businessCode;
                                } else if (type == LocationType.PRODUCTION) {
                                        businessCode = plant == null ? "PRODUCTION" : plant + " PRODUCTION";
                                        businessName = businessCode;
                                } else if (type == LocationType.PROCESSING
                                                || type == LocationType.EXTERNAL_PROCESSOR) {
                                        businessCode = location.getLocationCode();
                                        businessName = location.getLocationName();
                                } else if (type == LocationType.TRANSIT) {
                                        businessCode = businessName = "IN TRANSIT";
                                } else if (type == LocationType.SUPPLIER) {
                                        businessCode = businessName = "SUPPLIER";
                                } else if (type == LocationType.QC) {
                                        businessCode = businessName = "QC CHECK";
                                } else {
                                        businessCode = plant;
                                        businessName = plant;
                                }
                                return new Position(department, location.getId(), businessCode, businessName,
                                                type == null ? null : type.name());
                        }
                }

                private record TrackingContext(
                                MatFlowMaterialRequisition requisition,
                                List<MatFlowRequisitionLine> lines,
                                List<MatFlowReservation> reservations,
                                List<MatFlowIndent> indents,
                                List<MatFlowPurchaseOrder> orders,
                                List<MatFlowGoodsReceipt> receipts,
                                List<MatFlowTransferOrder> transfers,
                                List<MatFlowQcInspection> inspections,
                                List<MatFlowProcessingJob> jobs,
                                List<MatFlowAuditLog> audits) {
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
