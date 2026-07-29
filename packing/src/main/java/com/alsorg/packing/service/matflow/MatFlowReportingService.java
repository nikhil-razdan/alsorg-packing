package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowReportingDtos.AuditLogRow;
import com.alsorg.packing.controller.dto.matflow.MatFlowReportingDtos.BomRevisionSummary;
import com.alsorg.packing.controller.dto.matflow.MatFlowReportingDtos.DashboardResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowReportingDtos.DashboardTotals;
import com.alsorg.packing.controller.dto.matflow.MatFlowReportingDtos.PageResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowReportingDtos.PlantDashboardRow;
import com.alsorg.packing.controller.dto.matflow.MatFlowReportingDtos.ProjectRequisitionSummary;
import com.alsorg.packing.controller.dto.matflow.MatFlowReportingDtos.ProjectTrackingResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowReportingDtos.ShortageAgeingRow;
import com.alsorg.packing.controller.dto.matflow.MatFlowReportingDtos.StockLedgerRow;

import com.alsorg.packing.domain.matflow.MatFlowAuditLog;
import com.alsorg.packing.domain.matflow.MatFlowBom;
import com.alsorg.packing.domain.matflow.MatFlowIndent;
import com.alsorg.packing.domain.matflow.MatFlowMaterialRequisition;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.IndentStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MovementType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ProcessingJobStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.PurchaseOrderStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcInspectionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.TransferStatus;
import com.alsorg.packing.domain.matflow.MatFlowProcessingJob;
import com.alsorg.packing.domain.matflow.MatFlowProjectDrawing;
import com.alsorg.packing.domain.matflow.MatFlowPurchaseOrder;
import com.alsorg.packing.domain.matflow.MatFlowQcInspection;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionLine;
import com.alsorg.packing.domain.matflow.MatFlowStockBalance;
import com.alsorg.packing.domain.matflow.MatFlowStockLedger;
import com.alsorg.packing.domain.matflow.MatFlowTransferOrder;

import com.alsorg.packing.repository.matflow.MatFlowAuditLogRepository;
import com.alsorg.packing.repository.matflow.MatFlowBomRepository;
import com.alsorg.packing.repository.matflow.MatFlowGoodsReceiptRepository;
import com.alsorg.packing.repository.matflow.MatFlowIndentRepository;
import com.alsorg.packing.repository.matflow.MatFlowMaterialRequisitionRepository;
import com.alsorg.packing.repository.matflow.MatFlowProcessingJobRepository;
import com.alsorg.packing.repository.matflow.MatFlowProjectDrawingRepository;
import com.alsorg.packing.repository.matflow.MatFlowPurchaseOrderRepository;
import com.alsorg.packing.repository.matflow.MatFlowQcInspectionRepository;
import com.alsorg.packing.repository.matflow.MatFlowRequisitionLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockBalanceRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockLedgerRepository;
import com.alsorg.packing.repository.matflow.MatFlowTransferOrderRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MatFlowReportingService {

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

    public MatFlowReportingService(
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
                        normalizePlant(
                                requisition.destinationLocation.plantCode)))
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

                            requisition.destinationLocation.locationCode,

                            requisition.destinationLocation.plantCode,

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
                                RequisitionStatus.COMPLETED))
                .stream()
                .filter(line -> plants.contains(
                        normalizePlant(
                                line.requisition.destinationLocation.plantCode)))
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

                            line.requisition.destinationLocation.locationCode,

                            line.requisition.destinationLocation.plantCode,

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

        Page<MatFlowStockLedger> result = ledgerRepository.search(
                plants,
                materialId,
                locationId,
                movementType,
                fromDate,
                toDate,
                clean(search),
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

        Page<MatFlowAuditLog> result = auditRepository.search(
                plants,
                clean(entityType),
                entityId,
                clean(action),
                fromDate,
                toDate,
                clean(search),
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
                        requisition.destinationLocation.plantCode,
                        plant) &&
                        requisition.status != RequisitionStatus.CANCELLED &&
                        requisition.status != RequisitionStatus.COMPLETED)
                .count();

        long shortageRequisitions = requisitions.stream()
                .filter(requisition -> plantEquals(
                        requisition.destinationLocation.plantCode,
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