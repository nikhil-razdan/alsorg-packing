package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowMaterialTrackerDtos.*;
import com.alsorg.packing.domain.matflow.*;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.*;
import com.alsorg.packing.repository.matflow.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.Predicate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.hibernate.Hibernate;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Executive, material-centric MatFlow read model.
 *
 * <p>
 * This service does not create a second workflow and does not mutate stock.
 * It reconstructs one material's custody from the existing source-of-truth
 * requisition, reservation, purchase, GRN, QC, transfer, processing,
 * consumption, return, stock-ledger and audit records.
 * </p>
 *
 * <p>
 * The result lets a Manager (and every existing MatFlow read role)
 * answer: where is this material now, where was it before, where should it go
 * next, which Project/Product owns the demand, how much is at each branch, and
 * how long every custody state took.
 * </p>
 */
@Service
public class MatFlowMaterialTrackerService {

    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP);

    private static final Set<String> CLOSED_REQUISITIONS = Set.of(
            "CANCELLED", "PRODUCTION_COMPLETED", "COMPLETED", "CLOSED");

    private static final Set<String> CLOSED_TRANSFERS = Set.of("RECEIVED", "CANCELLED", "COMPLETED");

    private static final Map<String, Long> TARGET_MINUTES = Map.ofEntries(
            Map.entry("DEMAND_RAISED", 240L),
            Map.entry("STORE_REVIEW", 480L),
            Map.entry("STORE_PLANNED_AWAITING_ALLOCATION", 240L),
            Map.entry("SHORTAGE_CONFIRMED", 480L),
            Map.entry("PURCHASE_ORDER_DRAFT", 480L),
            Map.entry("SUPPLIER_ORDERED", 2880L),
            Map.entry("QC_PENDING", 480L),
            Map.entry("QC_ACCEPTED_AWAITING_ROUTE", 240L),
            Map.entry("RESERVED", 480L),
            Map.entry("WAITING_TRANSFER", 480L),
            Map.entry("IN_TRANSIT", 480L),
            Map.entry("RECEIVED", 240L),
            Map.entry("PROCESSING_PENDING", 240L),
            Map.entry("PROCESSING", 1440L),
            Map.entry("IN_PRODUCTION", 1440L),
            Map.entry("IN_PRODUCTION_LINE_AGGREGATED", 1440L),
            Map.entry("PARTIALLY_ISSUED", 480L),
            Map.entry("RETURN_PLANNED", 240L),
            Map.entry("RETURN_IN_TRANSIT", 480L));

    private final MatFlowMaterialRepository materialRepository;
    private final MatFlowMaterialRequisitionRepository requisitionRepository;
    private final MatFlowRequisitionLineRepository requisitionLineRepository;
    private final MatFlowReservationRepository reservationRepository;
    private final MatFlowIndentRepository indentRepository;
    private final MatFlowIndentLineRepository indentLineRepository;
    private final MatFlowPurchaseOrderRepository purchaseOrderRepository;
    private final MatFlowPurchaseOrderLineRepository purchaseOrderLineRepository;
    private final MatFlowGoodsReceiptRepository receiptRepository;
    private final MatFlowGoodsReceiptLineRepository receiptLineRepository;
    private final MatFlowTransferOrderRepository transferRepository;
    private final MatFlowProcessingJobRepository processingRepository;
    private final MatFlowProductionConsumptionLineRepository consumptionLineRepository;
    private final MatFlowMaterialReturnLineRepository returnLineRepository;
    private final MatFlowStockLedgerRepository ledgerRepository;
    private final MatFlowAuditLogRepository auditRepository;
    private final MatFlowAccessService accessService;
    private final ObjectMapper objectMapper;
    private final EntityManager entityManager;

    public MatFlowMaterialTrackerService(
            MatFlowMaterialRepository materialRepository,
            MatFlowMaterialRequisitionRepository requisitionRepository,
            MatFlowRequisitionLineRepository requisitionLineRepository,
            MatFlowReservationRepository reservationRepository,
            MatFlowIndentRepository indentRepository,
            MatFlowIndentLineRepository indentLineRepository,
            MatFlowPurchaseOrderRepository purchaseOrderRepository,
            MatFlowPurchaseOrderLineRepository purchaseOrderLineRepository,
            MatFlowGoodsReceiptRepository receiptRepository,
            MatFlowGoodsReceiptLineRepository receiptLineRepository,
            MatFlowTransferOrderRepository transferRepository,
            MatFlowProcessingJobRepository processingRepository,
            MatFlowProductionConsumptionLineRepository consumptionLineRepository,
            MatFlowMaterialReturnLineRepository returnLineRepository,
            MatFlowStockLedgerRepository ledgerRepository,
            MatFlowAuditLogRepository auditRepository,
            MatFlowAccessService accessService,
            ObjectMapper objectMapper,
            EntityManager entityManager) {
        this.materialRepository = materialRepository;
        this.requisitionRepository = requisitionRepository;
        this.requisitionLineRepository = requisitionLineRepository;
        this.reservationRepository = reservationRepository;
        this.indentRepository = indentRepository;
        this.indentLineRepository = indentLineRepository;
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.purchaseOrderLineRepository = purchaseOrderLineRepository;
        this.receiptRepository = receiptRepository;
        this.receiptLineRepository = receiptLineRepository;
        this.transferRepository = transferRepository;
        this.processingRepository = processingRepository;
        this.consumptionLineRepository = consumptionLineRepository;
        this.returnLineRepository = returnLineRepository;
        this.ledgerRepository = ledgerRepository;
        this.auditRepository = auditRepository;
        this.accessService = accessService;
        this.objectMapper = objectMapper;
        this.entityManager = entityManager;
    }

    @Transactional(readOnly = true)
    public MaterialTrackerResponse track(UUID materialId, String plantCode, Boolean activeOnly) {
        accessService.requireRead();
        if (materialId == null) {
            throw badRequest("Material ID is required");
        }

        String requestedPlant = cleanUpper(plantCode);
        if (requestedPlant != null) {
            accessService.requirePlantAccess(requestedPlant);
        }

        MatFlowMaterial material = materialRepository.findById(materialId)
                .map(value -> unproxy(value, MatFlowMaterial.class))
                .orElseThrow(() -> notFound("MatFlow material not found"));

        boolean liveOnly = Boolean.TRUE.equals(activeOnly);

        Map<UUID, MatFlowRequisitionLine> matchingLines = findMatchingLines(materialId);
        Map<UUID, List<MatFlowRequisitionLine>> byRequisition = new LinkedHashMap<>();
        for (MatFlowRequisitionLine line : matchingLines.values()) {
            MatFlowMaterialRequisition requisition = hydrateRequisition(line.requisition);
            if (requisition == null || requisition.getId() == null || !canRead(requisition, requestedPlant)) {
                continue;
            }
            if (liveOnly && CLOSED_REQUISITIONS.contains(enumName(requisition.status))) {
                continue;
            }
            byRequisition.computeIfAbsent(requisition.getId(), ignored -> new ArrayList<>()).add(line);
        }

        List<MaterialTrackerLot> lots = new ArrayList<>();
        Set<String> projectKeys = new LinkedHashSet<>();
        Set<UUID> productIds = new LinkedHashSet<>();
        Set<UUID> requisitionIds = new LinkedHashSet<>();

        BigDecimal requested = ZERO;
        BigDecimal reserved = ZERO;
        BigDecimal shortage = ZERO;
        BigDecimal issued = ZERO;
        BigDecimal consumed = ZERO;
        BigDecimal returned = ZERO;

        for (Map.Entry<UUID, List<MatFlowRequisitionLine>> entry : byRequisition.entrySet()) {
            MatFlowMaterialRequisition requisition = requisitionRepository.findDetailById(entry.getKey())
                    .map(this::hydrateRequisition)
                    .orElse(null);
            if (requisition == null || !canRead(requisition, requestedPlant)) {
                continue;
            }

            TrackingContext context = loadContext(requisition);
            requisitionIds.add(requisition.getId());

            MatFlowProjectDrawing product = requisition.projectDrawing;
            if (product != null) {
                productIds.add(product.getId());
                if (product.getProject() != null && product.getProject().getId() != null) {
                    projectKeys.add("ID:" + product.getProject().getId());
                } else if (safe(product.getProjectCode()) != null) {
                    projectKeys.add("CODE:" + product.getProjectCode().trim().toUpperCase(Locale.ROOT));
                }
            }

            for (MatFlowRequisitionLine rawLine : entry.getValue()) {
                final MatFlowRequisitionLine line = hydrateLine(rawLine);
                if (line == null || line.getId() == null) {
                    continue;
                }
                requested = requested.add(scale(line.requestedQty));
                reserved = reserved.add(scale(line.reservedQty));
                shortage = shortage.add(scale(line.shortageQty));
                issued = issued.add(scale(line.issuedQty));
                consumed = consumed.add(scale(line.consumedQty));
                returned = returned.add(scale(line.returnedQty));

                List<MatFlowReservation> lineReservations = context.reservations().stream()
                        .filter(item -> item.requisitionLine != null
                                && line.getId().equals(item.requisitionLine.getId()))
                        .sorted(Comparator.comparing(MatFlowReservation::getCreatedAt,
                                Comparator.nullsLast(Comparator.naturalOrder())))
                        .toList();

                for (MatFlowReservation reservation : lineReservations) {
                    lots.add(buildReservationLot(material, context, line, reservation));
                }

                BigDecimal reservationTotal = lineReservations.stream()
                        .filter(item -> !"CANCELLED".equals(enumName(item.status))
                                && !"RELEASED".equals(enumName(item.status)))
                        .map(item -> scale(item.reservedQty))
                        .reduce(ZERO, BigDecimal::add);

                BigDecimal residualShortage = scale(line.requestedQty)
                        .subtract(reservationTotal)
                        .max(ZERO);

                // line.shortageQty is authoritative after QC allocation. Use the
                // smaller non-negative value so historical released reservations do
                // not manufacture a false live shortage row.
                residualShortage = residualShortage.min(scale(line.shortageQty).max(ZERO));

                if (residualShortage.compareTo(ZERO) > 0) {
                    lots.add(buildShortageLot(material, context, line, residualShortage));
                } else if (lineReservations.isEmpty()
                        && scale(line.requestedQty).compareTo(ZERO) > 0
                        && !CLOSED_REQUISITIONS.contains(enumName(requisition.status))) {
                    /*
                     * Before Store has created either a reservation or a shortage
                     * branch, the material still needs to be visible in the Control
                     * Tower. This is a real administrative custody state, not a
                     * physical stock location.
                     */
                    lots.add(buildDemandLot(material, context, line));
                }
            }
        }

        lots.sort(Comparator
                .comparing(MaterialTrackerLot::completed)
                .thenComparing(MaterialTrackerLot::currentDwellMinutes, Comparator.reverseOrder())
                .thenComparing(MaterialTrackerLot::projectCode, Comparator.nullsLast(String::compareToIgnoreCase))
                .thenComparing(MaterialTrackerLot::productName, Comparator.nullsLast(String::compareToIgnoreCase)));

        List<MaterialStockPosition> inventory = loadInventory(materialId, requestedPlant);
        BigDecimal onHand = inventory.stream().map(MaterialStockPosition::onHandQty).reduce(ZERO, BigDecimal::add);
        BigDecimal available = inventory.stream().map(MaterialStockPosition::availableQty).reduce(ZERO,
                BigDecimal::add);
        BigDecimal blocked = inventory.stream().map(MaterialStockPosition::blockedQty).reduce(ZERO, BigDecimal::add);
        BigDecimal inTransit = inventory.stream().map(MaterialStockPosition::inTransitQty).reduce(ZERO,
                BigDecimal::add);

        List<MaterialTrackerLot> liveLots = lots.stream().filter(item -> !item.completed()).toList();
        int delayed = (int) liveLots.stream().filter(item -> isBreach(item.timingHealth())).count();
        long avgDwell = liveLots.isEmpty() ? 0L
                : Math.round(liveLots.stream().mapToLong(MaterialTrackerLot::currentDwellMinutes).average().orElse(0));
        long longestDwell = liveLots.stream().mapToLong(MaterialTrackerLot::currentDwellMinutes).max().orElse(0L);

        MaterialTrackerKpis kpis = new MaterialTrackerKpis(
                projectKeys.size(), productIds.size(), requisitionIds.size(), lots.size(), liveLots.size(), delayed,
                scale(requested), scale(reserved), scale(shortage), scale(issued), scale(consumed), scale(returned),
                scale(onHand), scale(available), scale(blocked), scale(inTransit), avgDwell, longestDwell);

        MaterialIdentity identity = new MaterialIdentity(
                material.getId(), material.getMaterialCode(), material.getMaterialName(), material.getCategory(),
                material.getSpecification(), material.getUom(), material.getPreferredSupplier(), material.isActive());

        return new MaterialTrackerResponse(
                identity,
                kpis,
                inventory,
                List.copyOf(lots),
                loadLedger(materialId, requestedPlant),
                LocalDateTime.now());
    }

    private Map<UUID, MatFlowRequisitionLine> findMatchingLines(UUID materialId) {
        Map<UUID, MatFlowRequisitionLine> result = new LinkedHashMap<>();

        /*
         * Material lookup is query-driven rather than scanning the entire
         * requisition-line table. This keeps the Director control tower usable
         * when MatFlow contains years of Project/Product execution history.
         */
        List<MatFlowRequisitionLine> directLines = entityManager.createQuery(
                """
                        select distinct line
                        from MatFlowRequisitionLine line
                        where line.material.id = :materialId
                           or line.issuedMaterial.id = :materialId
                        """,
                MatFlowRequisitionLine.class)
                .setParameter("materialId", materialId)
                .getResultList();

        for (MatFlowRequisitionLine raw : directLines) {
            MatFlowRequisitionLine line = hydrateLine(raw);
            if (line != null && line.getId() != null) {
                result.put(line.getId(), line);
            }
        }

        /*
         * A processed output can exist before it is explicitly issued to
         * Production. Pull its originating requisition line directly through
         * the processing reservation lineage.
         */
        List<MatFlowRequisitionLine> processedLines = entityManager.createQuery(
                """
                        select distinct job.reservation.requisitionLine
                        from MatFlowProcessingJob job
                        where job.inputMaterial.id = :materialId
                           or job.outputMaterial.id = :materialId
                        """,
                MatFlowRequisitionLine.class)
                .setParameter("materialId", materialId)
                .getResultList();

        for (MatFlowRequisitionLine raw : processedLines) {
            MatFlowRequisitionLine line = hydrateLine(raw);
            if (line != null && line.getId() != null) {
                result.put(line.getId(), line);
            }
        }

        return result;
    }

    private TrackingContext loadContext(MatFlowMaterialRequisition requisition) {
        UUID requisitionId = requisition.getId();

        List<MatFlowRequisitionLine> lines = requisitionLineRepository
                .findByRequisition_IdOrderByLineNoAsc(requisitionId).stream()
                .map(this::hydrateLine).toList();

        List<MatFlowReservation> reservations = reservationRepository
                .findByRequisitionLine_Requisition_IdOrderByCreatedAtAsc(requisitionId).stream()
                .map(this::hydrateReservation).toList();

        List<MatFlowIndent> indents = indentRepository.findByRequisition_IdOrderByCreatedAtAsc(requisitionId);
        List<MatFlowIndentLine> indentLines = indents.stream()
                .flatMap(indent -> indentLineRepository.findByIndent_IdOrderByCreatedAtAsc(indent.getId()).stream())
                .map(this::hydrateIndentLine).toList();

        List<MatFlowPurchaseOrder> orders = indents.stream()
                .flatMap(indent -> purchaseOrderRepository.findByIndent_Id(indent.getId()).stream())
                .map(this::hydrateOrder).toList();
        List<MatFlowPurchaseOrderLine> poLines = orders.stream()
                .flatMap(order -> purchaseOrderLineRepository
                        .findByPurchaseOrder_IdOrderByCreatedAtAsc(order.getId()).stream())
                .map(this::hydratePoLine).toList();

        List<MatFlowGoodsReceipt> receipts = orders.stream()
                .flatMap(order -> receiptRepository
                        .findByPurchaseOrder_IdOrderByReceivedAtAsc(order.getId()).stream())
                .map(this::hydrateReceipt).toList();
        List<MatFlowGoodsReceiptLine> receiptLines = receipts.stream()
                .flatMap(receipt -> receiptLineRepository
                        .findByGoodsReceipt_IdOrderByCreatedAtAsc(receipt.getId()).stream())
                .map(this::hydrateReceiptLine).toList();

        List<MatFlowTransferOrder> transfers = transferRepository
                .findByRequisition_IdOrderByRouteSequenceNoAscCreatedAtAsc(requisitionId).stream()
                .map(this::hydrateTransfer).toList();

        List<MatFlowProcessingJob> jobs = processingRepository
                .findByRequisition_IdOrderByCreatedAtAsc(requisitionId).stream()
                .map(this::hydrateJob).toList();

        List<MatFlowProductionConsumption> consumptions = entityManager.createQuery(
                """
                        select consumption
                        from MatFlowProductionConsumption consumption
                        where consumption.requisition.id = :requisitionId
                        order by consumption.consumedAt asc
                        """,
                MatFlowProductionConsumption.class)
                .setParameter("requisitionId", requisitionId)
                .getResultList().stream()
                .map(this::hydrateConsumption)
                .toList();
        List<MatFlowProductionConsumptionLine> consumptionLines = consumptions.stream()
                .flatMap(item -> consumptionLineRepository
                        .findByConsumption_IdOrderByCreatedAtAsc(item.getId()).stream())
                .map(this::hydrateConsumptionLine).toList();

        List<MatFlowMaterialReturn> returns = entityManager.createQuery(
                """
                        select materialReturn
                        from MatFlowMaterialReturn materialReturn
                        where materialReturn.requisition.id = :requisitionId
                        order by materialReturn.createdAt asc
                        """,
                MatFlowMaterialReturn.class)
                .setParameter("requisitionId", requisitionId)
                .getResultList().stream()
                .map(this::hydrateReturn)
                .toList();
        List<MatFlowMaterialReturnLine> returnLines = returns.stream()
                .flatMap(item -> returnLineRepository
                        .findByMaterialReturn_IdOrderByCreatedAtAsc(item.getId()).stream())
                .map(this::hydrateReturnLine).toList();

        Set<UUID> qcSourceIds = new LinkedHashSet<>();
        receipts.forEach(item -> qcSourceIds.add(item.getId()));
        transfers.forEach(item -> qcSourceIds.add(item.getId()));
        Set<UUID> reservationIds = reservations.stream().map(MatFlowReservation::getId)
                .filter(Objects::nonNull).collect(java.util.stream.Collectors.toSet());

        List<MatFlowQcInspection> inspections;
        if (qcSourceIds.isEmpty() && reservationIds.isEmpty()) {
            inspections = List.of();
        } else {
            StringBuilder qcJpql = new StringBuilder(
                    "select inspection from MatFlowQcInspection inspection where ");
            if (!qcSourceIds.isEmpty()) {
                qcJpql.append("inspection.sourceId in :sourceIds");
            }
            if (!qcSourceIds.isEmpty() && !reservationIds.isEmpty()) {
                qcJpql.append(" or ");
            }
            if (!reservationIds.isEmpty()) {
                qcJpql.append("inspection.routingReservationId in :reservationIds");
            }
            qcJpql.append(" order by inspection.createdAt asc");

            var qcQuery = entityManager.createQuery(qcJpql.toString(), MatFlowQcInspection.class);
            if (!qcSourceIds.isEmpty()) {
                qcQuery.setParameter("sourceIds", qcSourceIds);
            }
            if (!reservationIds.isEmpty()) {
                qcQuery.setParameter("reservationIds", reservationIds);
            }
            inspections = qcQuery.getResultList().stream()
                    .map(this::hydrateInspection)
                    .toList();
        }

        Set<UUID> auditIds = new LinkedHashSet<>();
        addId(auditIds, requisition);
        addId(auditIds, requisition.projectDrawing);
        addId(auditIds, requisition.bom);
        lines.forEach(item -> addId(auditIds, item));
        reservations.forEach(item -> addId(auditIds, item));
        indents.forEach(item -> addId(auditIds, item));
        orders.forEach(item -> addId(auditIds, item));
        receipts.forEach(item -> addId(auditIds, item));
        transfers.forEach(item -> addId(auditIds, item));
        inspections.forEach(item -> addId(auditIds, item));
        jobs.forEach(item -> addId(auditIds, item));
        consumptions.forEach(item -> addId(auditIds, item));
        returns.forEach(item -> addId(auditIds, item));

        List<MatFlowAuditLog> audits = auditIds.isEmpty() ? List.of()
                : auditRepository.findAll((root, query, cb) -> root.get("entityId").in(auditIds),
                        Sort.by(Sort.Direction.ASC, "actionAt"));

        return new TrackingContext(
                requisition, lines, reservations, indents, indentLines, orders, poLines, receipts, receiptLines,
                inspections, transfers, jobs, consumptions, consumptionLines, returns, returnLines, audits);
    }

    private MaterialTrackerLot buildReservationLot(
            MatFlowMaterial selectedMaterial,
            TrackingContext context,
            MatFlowRequisitionLine line,
            MatFlowReservation reservation) {

        List<Milestone> milestones = new ArrayList<>();
        MatFlowMaterial currentMaterial = reservation.material != null ? reservation.material : line.material;

        List<MatFlowProcessingJob> jobs = context.jobs().stream()
                .filter(item -> item.reservation != null && reservation.getId().equals(item.reservation.getId()))
                .sorted(Comparator.comparing(MatFlowProcessingJob::getCreatedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        MatFlowProcessingJob latestCompleted = jobs.stream()
                .filter(item -> "COMPLETED".equals(enumName(item.status)))
                .max(Comparator.comparing(item -> item.completedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(null);
        if (latestCompleted != null && latestCompleted.outputMaterial != null) {
            currentMaterial = latestCompleted.outputMaterial;
        }

        List<MatFlowTransferOrder> route = context.transfers().stream()
                .filter(item -> item.reservation != null && reservation.getId().equals(item.reservation.getId()))
                .sorted(Comparator
                        .comparingInt((MatFlowTransferOrder item) -> item.routeSequenceNo == null
                                ? Integer.MAX_VALUE
                                : item.routeSequenceNo)
                        .thenComparing(MatFlowTransferOrder::getCreatedAt,
                                Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();

        List<MatFlowQcInspection> inspections = inspectionsForReservation(context, reservation, route);
        addDemandPlanningMilestones(context, line, milestones);
        addProcurementMilestones(context, line, reservation, inspections, milestones);

        MatFlowLocation reservationOrigin = initialReservationLocation(reservation, route, inspections);
        addMilestone(milestones, "RESERVATION", "Material reserved", departmentFor(reservationOrigin),
                reservationOrigin, "RESERVED", reservation.getCreatedAt(), reservation.getCreatedBy(),
                scale(reservation.reservedQty), "RESERVATION", reservation.getId(),
                context.requisition().requisitionNumber, "RESERVATION_LOT",
                "Project/Product quantity reserved against this material lot.");

        for (MatFlowTransferOrder transfer : route) {
            addTransferMilestones(context, transfer, milestones);
        }

        for (MatFlowQcInspection inspection : inspections) {
            addQcMilestones(inspection, context.requisition().requisitionNumber, milestones);
        }

        for (MatFlowProcessingJob job : jobs) {
            addProcessingMilestones(job, milestones);
        }

        MatFlowAuditLog issueAudit = latestIssueAudit(context, reservation, line);
        if (issueAudit != null) {
            addMilestone(milestones, "PRODUCTION_ISSUE", "Issued to Production", "PRODUCTION",
                    context.requisition().destinationLocation, "IN_PRODUCTION", issueAudit.getActionAt(),
                    issueAudit.getActor(), quantityFromDetails(issueAudit), issueAudit.getEntityType(),
                    issueAudit.getEntityId(), context.requisition().requisitionNumber, "RESERVATION_LOT",
                    "Store released reserved material into Production custody.");
        }

        boolean lineAggregate = context.reservations().stream()
                .filter(item -> item.requisitionLine != null
                        && line.getId().equals(item.requisitionLine.getId()))
                .count() > 1;

        addConsumptionMilestones(context, line, milestones, lineAggregate);
        addProductionWasteMilestones(line, milestones, lineAggregate);
        addReturnMilestones(context, line, milestones, lineAggregate);

        List<MaterialCustodyEvent> history = finalizeHistory(milestones);
        CurrentPosition current = resolveReservationCurrent(context, line, reservation, route, inspections, jobs,
                issueAudit, history);
        NextPosition next = resolveReservationNext(context, line, reservation, route, inspections, jobs, current);
        MaterialCustodyEvent previous = previousHistoryEvent(history, current.enteredAt());

        BigDecimal trackedQty = scale(reservation.reservedQty);
        if (latestCompleted != null
                && latestCompleted.outputMaterial != null
                && selectedMaterial.getId().equals(latestCompleted.outputMaterial.getId())
                && scale(latestCompleted.outputQty).compareTo(ZERO) > 0) {
            trackedQty = scale(latestCompleted.outputQty);
        }

        return toLot(
                selectedMaterial,
                context,
                line,
                reservation,
                "RESERVATION",
                currentMaterial,
                trackedQty,
                current,
                previous,
                next,
                history,
                lineAggregate);
    }

    private MaterialTrackerLot buildDemandLot(
            MatFlowMaterial selectedMaterial,
            TrackingContext context,
            MatFlowRequisitionLine line) {

        List<Milestone> milestones = new ArrayList<>();
        addDemandPlanningMilestones(context, line, milestones);

        MatFlowMaterialRequisition requisition = context.requisition();
        CurrentPosition current;
        NextPosition next;

        if (requisition.submittedAt == null) {
            LocalDateTime enteredAt = requisition.requestedAt != null
                    ? requisition.requestedAt
                    : requisition.getCreatedAt();
            current = current("DEMAND", "PRODUCTION / DEMAND", null, "DEMAND_RAISED", enteredAt,
                    "REQUISITION", requisition.getId(), requisition.requisitionNumber, false);
            next = next("STORE", null,
                    "Submit the Project/Product material demand to Store for availability review.");
        } else if (requisition.plannedAt == null) {
            current = current("STORE", "STORE", null, "STORE_REVIEW", requisition.submittedAt,
                    "REQUISITION", requisition.getId(), requisition.requisitionNumber, false);
            next = next("STORE", null,
                    "Complete availability review and create the required reservation and/or shortage indent.");
        } else {
            addMilestone(milestones, "STORE_PLANNED", "Store planning completed", "STORE", null,
                    "STORE_PLANNED_AWAITING_ALLOCATION", requisition.plannedAt, requisition.plannedBy,
                    scale(line.requestedQty), "REQUISITION", requisition.getId(), requisition.requisitionNumber,
                    "REQUISITION_LINE",
                    "Store planning is marked complete but this line has no reservation or shortage branch yet; allocation needs attention.");
            current = current("STORE", "STORE", null, "STORE_PLANNED_AWAITING_ALLOCATION",
                    requisition.plannedAt, "REQUISITION", requisition.getId(), requisition.requisitionNumber, false);
            next = next("STORE", null,
                    "Create the missing stock reservation or shortage indent for this material line.");
        }

        List<MaterialCustodyEvent> history = finalizeHistory(milestones);
        MaterialCustodyEvent previous = previousHistoryEvent(history, current.enteredAt());
        MatFlowMaterial currentMaterial = line.material == null ? selectedMaterial : line.material;

        return toLot(
                selectedMaterial, context, line, null, "DEMAND", currentMaterial, scale(line.requestedQty),
                current, previous, next, history, false);
    }

    private MaterialTrackerLot buildShortageLot(
            MatFlowMaterial selectedMaterial,
            TrackingContext context,
            MatFlowRequisitionLine line,
            BigDecimal shortageQty) {

        List<Milestone> milestones = new ArrayList<>();
        List<MatFlowIndentLine> indentLines = context.indentLines().stream()
                .filter(item -> item.requisitionLine != null && line.getId().equals(item.requisitionLine.getId()))
                .toList();
        addDemandPlanningMilestones(context, line, milestones);
        addShortageProcurementMilestones(context, line, indentLines, milestones);
        List<MaterialCustodyEvent> history = finalizeHistory(milestones);

        CurrentPosition current = resolveShortageCurrent(context, line, indentLines, history);
        NextPosition next = resolveShortageNext(context, line, indentLines, current);
        MaterialCustodyEvent previous = previousHistoryEvent(history, current.enteredAt());

        MatFlowMaterial currentMaterial = line.material == null ? selectedMaterial : line.material;
        return toLot(
                selectedMaterial,
                context,
                line,
                null,
                "PURCHASE_SHORTAGE",
                currentMaterial,
                scale(shortageQty),
                current,
                previous,
                next,
                history,
                false);
    }

    private MaterialTrackerLot toLot(
            MatFlowMaterial selectedMaterial,
            TrackingContext context,
            MatFlowRequisitionLine line,
            MatFlowReservation reservation,
            String sourceBranch,
            MatFlowMaterial currentMaterial,
            BigDecimal trackedQty,
            CurrentPosition current,
            MaterialCustodyEvent previous,
            NextPosition next,
            List<MaterialCustodyEvent> history,
            boolean lineLevelPostIssueAggregation) {

        MatFlowMaterialRequisition requisition = context.requisition();
        MatFlowProjectDrawing product = requisition.projectDrawing;
        MatFlowProject project = product == null || product.getProject() == null
                ? null
                : unproxy(product.getProject(), MatFlowProject.class);
        MatFlowBom bom = requisition.bom;

        long dwell = current.completed() || current.enteredAt() == null
                ? 0L
                : minutesBetween(current.enteredAt(), LocalDateTime.now());
        long target = targetFor(current.state());
        long variance = target <= 0 ? 0 : dwell - target;
        String health = timingHealth(current.enteredAt(), null, target, current.completed());

        String lotKey = reservation != null
                ? "RESERVATION:" + reservation.getId()
                : "DEMAND".equals(sourceBranch)
                        ? "DEMAND:" + line.getId()
                        : "SHORTAGE:" + line.getId();
        String lotType = reservation != null
                ? "RESERVATION_LOT"
                : "DEMAND".equals(sourceBranch) ? "DEMAND" : "PURCHASE_SHORTAGE";

        return new MaterialTrackerLot(
                lotKey,
                lotType,
                project == null ? null : project.getId(),
                project == null ? product == null ? null : product.getProjectCode() : project.getProjectCode(),
                project == null ? product == null ? null : product.getProjectName() : project.getProjectName(),
                project == null ? product == null ? null : product.getClientName() : project.getClientName(),
                product == null ? null : product.getPlantCode(),
                product == null ? null : product.getId(),
                product == null ? null : product.getProductName(),
                product == null ? null : product.getDrawingNo(),
                product == null ? null : product.getDrawingRevision(),
                bom == null ? null : bom.getId(),
                bom == null ? null : bom.getBomNumber(),
                bom == null ? null : bom.getRevisionNo(),
                requisition.getId(), requisition.requisitionNumber, enumName(requisition.status),
                line.getId(), reservation == null ? null : reservation.getId(), sourceBranch,
                currentMaterial == null ? selectedMaterial.getId() : currentMaterial.getId(),
                currentMaterial == null ? selectedMaterial.getMaterialCode() : currentMaterial.getMaterialCode(),
                currentMaterial == null ? selectedMaterial.getMaterialName() : currentMaterial.getMaterialName(),
                currentMaterial == null ? selectedMaterial.getCategory() : currentMaterial.getCategory(),
                currentMaterial == null ? selectedMaterial.getUom() : currentMaterial.getUom(),
                scale(line.requestedQty), scale(line.reservedQty), scale(line.shortageQty), scale(line.issuedQty),
                scale(line.consumedQty), scale(line.returnedQty), scale(trackedQty),
                current.stage(), current.department(), locationId(current.location()), locationCode(current.location()),
                locationName(current.location()), locationType(current.location()), current.state(),
                current.enteredAt(),
                dwell, target, variance, health,
                previous == null ? null : previous.department(),
                previous == null ? null : previous.locationCode(),
                previous == null ? null : previous.locationName(),
                previous == null ? null : previous.state(),
                next.department(), locationId(next.location()), locationCode(next.location()),
                locationName(next.location()),
                locationType(next.location()), next.action(), current.referenceType(), current.referenceId(),
                current.referenceNumber(), current.completed(), lineLevelPostIssueAggregation, history);
    }

    /*
     * ============================================================
     * Material-specific milestone construction
     * ============================================================
     */

    /**
     * Administrative demand hand-off before physical material custody starts.
     * These milestones intentionally have no physical location because the material
     * has not yet moved; they show who owned the decision and how long the request
     * waited before Store planning.
     */
    private void addDemandPlanningMilestones(
            TrackingContext context,
            MatFlowRequisitionLine line,
            List<Milestone> milestones) {
        MatFlowMaterialRequisition requisition = context.requisition();
        if (requisition == null || line == null)
            return;

        LocalDateTime demandAt = requisition.requestedAt != null
                ? requisition.requestedAt
                : requisition.getCreatedAt();
        String demandActor = safe(requisition.requestedBy) != null
                ? requisition.requestedBy
                : requisition.getCreatedBy();

        addMilestone(milestones, "DEMAND", "Material demand raised", "PRODUCTION / DEMAND", null,
                "DEMAND_RAISED", demandAt, demandActor, scale(line.requestedQty),
                "REQUISITION", requisition.getId(), requisition.requisitionNumber, "REQUISITION_LINE",
                "Project/Product material demand created. This is an administrative stage; physical custody has not started yet.");

        if (requisition.submittedAt != null) {
            addMilestone(milestones, "STORE_REVIEW", "Submitted to Store for availability review", "STORE", null,
                    "STORE_REVIEW", requisition.submittedAt, requisition.submittedBy, scale(line.requestedQty),
                    "REQUISITION", requisition.getId(), requisition.requisitionNumber, "REQUISITION_LINE",
                    "Store owns availability review, reservation and shortage determination. Physical location becomes specific once stock is reserved, received or routed.");
        }
    }

    private void addProcurementMilestones(
            TrackingContext context,
            MatFlowRequisitionLine line,
            MatFlowReservation reservation,
            List<MatFlowQcInspection> inspections,
            List<Milestone> milestones) {

        MatFlowQcInspection purchasedInspection = inspections.stream()
                .filter(item -> item.sourceType == QcSourceType.GOODS_RECEIPT)
                .filter(item -> reservation.getId().equals(item.routingReservationId))
                .findFirst().orElse(null);
        if (purchasedInspection == null || purchasedInspection.sourceLineId == null) {
            return;
        }

        MatFlowGoodsReceiptLine receiptLine = context.receiptLines().stream()
                .filter(item -> purchasedInspection.sourceLineId.equals(item.getId()))
                .findFirst().orElse(null);
        if (receiptLine == null || receiptLine.purchaseOrderLine == null) {
            return;
        }
        MatFlowPurchaseOrderLine poLine = receiptLine.purchaseOrderLine;
        MatFlowIndentLine indentLine = poLine.indentLine;
        MatFlowPurchaseOrder order = poLine.purchaseOrder;
        MatFlowGoodsReceipt receipt = receiptLine.goodsReceipt;

        if (indentLine != null && indentLine.requisitionLine != null
                && line.getId().equals(indentLine.requisitionLine.getId())) {
            addMilestone(milestones, "SHORTAGE", "Shortage confirmed", "STORE / PURCHASE",
                    indentLine.indent == null ? null : indentLine.indent.deliverToLocation,
                    "SHORTAGE_CONFIRMED", indentLine.getCreatedAt(), indentLine.getCreatedBy(),
                    scale(indentLine.requiredQty), "INDENT_LINE", indentLine.getId(),
                    indentLine.indent == null ? null : indentLine.indent.indentNumber,
                    "REQUISITION_LINE", "Store shortage converted to a Purchase requirement.");
        }

        if (order != null) {
            boolean placed = !"DRAFT".equals(enumName(order.status));
            addMilestone(milestones, "PURCHASE_ORDER",
                    placed ? "Purchase Order placed" : "Purchase Order created",
                    "PURCHASE",
                    placed ? null : order.deliveryLocation,
                    placed ? "SUPPLIER_ORDERED" : "PURCHASE_ORDER_DRAFT",
                    placed ? firstNonNull(order.approvedAt, order.getUpdatedAt()) : order.getCreatedAt(),
                    placed && order.approvedBy != null ? order.approvedBy : order.getCreatedBy(),
                    scale(poLine.orderedQty), "PURCHASE_ORDER", order.getId(), order.poNumber,
                    "REQUISITION_LINE",
                    placed
                            ? (order.vendor == null ? "PO placed with supplier."
                                    : "PO placed with " + order.vendor.vendorName + ".")
                            : "Purchase is preparing the PO against the Store PI.");
        }

        if (receipt != null) {
            addMilestone(milestones, "GRN", "Material received / GRN", "STORE / RECEIVING",
                    receipt.receiptLocation, "GRN_RECEIVED", receipt.receivedAt, receipt.receivedBy,
                    scale(receiptLine.receivedQty), "GOODS_RECEIPT", receipt.getId(), receipt.grnNumber,
                    "REQUISITION_LINE",
                    "Vendor material inwarded into Store stock. Store will allocate it to the MR and decide QC or direct Production.");
        }
    }

    private void addShortageProcurementMilestones(
            TrackingContext context,
            MatFlowRequisitionLine line,
            List<MatFlowIndentLine> indentLines,
            List<Milestone> milestones) {

        for (MatFlowIndentLine indentLine : indentLines) {
            addMilestone(milestones, "SHORTAGE", "Shortage confirmed", "STORE / PURCHASE",
                    indentLine.indent == null ? null : indentLine.indent.deliverToLocation,
                    "SHORTAGE_CONFIRMED", indentLine.getCreatedAt(), indentLine.getCreatedBy(),
                    scale(indentLine.requiredQty), "INDENT_LINE", indentLine.getId(),
                    indentLine.indent == null ? null : indentLine.indent.indentNumber,
                    "REQUISITION_LINE", "Open shortage awaiting usable material.");

            List<MatFlowPurchaseOrderLine> poLines = context.poLines().stream()
                    .filter(item -> item.indentLine != null && indentLine.getId().equals(item.indentLine.getId()))
                    .toList();
            for (MatFlowPurchaseOrderLine poLine : poLines) {
                MatFlowPurchaseOrder order = poLine.purchaseOrder;
                if (order == null)
                    continue;
                boolean placed = !"DRAFT".equals(enumName(order.status));
                addMilestone(milestones, "PURCHASE_ORDER",
                        placed ? "Purchase Order placed" : "Purchase Order created",
                        "PURCHASE",
                        placed ? null : order.deliveryLocation,
                        placed ? "SUPPLIER_ORDERED" : "PURCHASE_ORDER_DRAFT",
                        placed ? firstNonNull(order.approvedAt, order.getUpdatedAt()) : order.getCreatedAt(),
                        placed && order.approvedBy != null ? order.approvedBy : order.getCreatedBy(),
                        scale(poLine.orderedQty), "PURCHASE_ORDER", order.getId(), order.poNumber,
                        "REQUISITION_LINE",
                        placed
                                ? (order.vendor == null ? "PO placed with supplier."
                                        : "PO placed with " + order.vendor.vendorName + ".")
                                : "Purchase is preparing the PO against this Store PI line.");

                for (MatFlowGoodsReceiptLine receiptLine : context.receiptLines()) {
                    if (receiptLine.purchaseOrderLine == null
                            || !poLine.getId().equals(receiptLine.purchaseOrderLine.getId())) {
                        continue;
                    }
                    MatFlowGoodsReceipt receipt = receiptLine.goodsReceipt;
                    if (receipt != null) {
                        addMilestone(milestones, "GRN", "Material received / GRN", "STORE / RECEIVING",
                                receipt.receiptLocation, "GRN_RECEIVED", receipt.receivedAt, receipt.receivedBy,
                                scale(receiptLine.receivedQty), "GOODS_RECEIPT", receipt.getId(), receipt.grnNumber,
                                "REQUISITION_LINE",
                                "Physical receipt into Store stock; Store will allocate this quantity and decide whether QC is required.");
                    }
                    context.inspections().stream()
                            .filter(qc -> receiptLine.getId().equals(qc.sourceLineId))
                            .forEach(qc -> addQcMilestones(qc, context.requisition().requisitionNumber, milestones));
                }
            }
        }
    }

    private void addTransferMilestones(
            TrackingContext context,
            MatFlowTransferOrder transfer,
            List<Milestone> milestones) {

        addMilestone(milestones, "TRANSFER_READY", "Ready for transfer", departmentFor(transfer.fromLocation),
                transfer.fromLocation, "WAITING_TRANSFER", transfer.getCreatedAt(), transfer.getCreatedBy(),
                transferQuantity(transfer), "TRANSFER", transfer.getId(), transfer.transferNumber,
                "RESERVATION_LOT", routeLabel(transfer.fromLocation, transfer.toLocation));

        List<MatFlowAuditLog> audits = context.audits().stream()
                .filter(item -> transfer.getId().equals(item.getEntityId()))
                .filter(item -> "TRANSFER_DISPATCHED".equalsIgnoreCase(item.getAction())
                        || "TRANSFER_RECEIVED".equalsIgnoreCase(item.getAction()))
                .sorted(Comparator.comparing(MatFlowAuditLog::getActionAt,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();

        boolean dispatchFound = false;
        boolean receiveFound = false;
        for (MatFlowAuditLog audit : audits) {
            if ("TRANSFER_DISPATCHED".equalsIgnoreCase(audit.getAction())) {
                dispatchFound = true;
                addMilestone(milestones, "TRANSFER_DISPATCHED", "Transfer dispatched", "IN TRANSIT", null,
                        "IN_TRANSIT", audit.getActionAt(), audit.getActor(), quantityFromDetails(audit),
                        "TRANSFER", transfer.getId(), transfer.transferNumber, "RESERVATION_LOT",
                        routeLabel(transfer.fromLocation, transfer.toLocation));
            } else if ("TRANSFER_RECEIVED".equalsIgnoreCase(audit.getAction())) {
                receiveFound = true;
                addMilestone(milestones, "TRANSFER_RECEIVED", "Transfer received",
                        departmentFor(transfer.toLocation), transfer.toLocation, "RECEIVED", audit.getActionAt(),
                        audit.getActor(), quantityFromDetails(audit), "TRANSFER", transfer.getId(),
                        transfer.transferNumber, "RESERVATION_LOT",
                        "Received from " + safeLocationCode(transfer.fromLocation) + ".");
            }
        }

        String status = enumName(transfer.status);
        if (!dispatchFound && Set.of("PARTIALLY_DISPATCHED", "IN_TRANSIT", "PARTIALLY_RECEIVED").contains(status)) {
            addMilestone(milestones, "TRANSFER_DISPATCHED", "Transfer dispatched", "IN TRANSIT", null,
                    "IN_TRANSIT", transfer.getUpdatedAt(), transfer.getCreatedBy(), transferQuantity(transfer),
                    "TRANSFER", transfer.getId(), transfer.transferNumber, "RESERVATION_LOT",
                    routeLabel(transfer.fromLocation, transfer.toLocation));
        }
        if (!receiveFound && "RECEIVED".equals(status)) {
            addMilestone(milestones, "TRANSFER_RECEIVED", "Transfer received", departmentFor(transfer.toLocation),
                    transfer.toLocation, "RECEIVED", transfer.getUpdatedAt(), transfer.getCreatedBy(),
                    transferQuantity(transfer), "TRANSFER", transfer.getId(), transfer.transferNumber,
                    "RESERVATION_LOT", "Transfer receipt confirmed.");
        }
    }

    private void addQcMilestones(MatFlowQcInspection inspection, String requisitionNumber, List<Milestone> milestones) {
        if (inspection == null)
            return;
        addMilestone(milestones, "QC_PENDING", "QC check pending", "QC", inspection.location,
                "QC_PENDING", inspection.getCreatedAt(), inspection.getCreatedBy(), scale(inspection.inspectionQty),
                "QC_INSPECTION", inspection.getId(), requisitionNumber, "MATERIAL_LOT",
                "QC is a check/tick only; physical material remains at the Store custody location.");

        if (inspection.inspectedAt != null) {
            addMilestone(milestones, "QC_COMPLETED", "QC check completed", "QC", inspection.location,
                    "QC_COMPLETED", inspection.inspectedAt, inspection.inspectedBy, scale(inspection.inspectionQty),
                    "QC_INSPECTION", inspection.getId(), requisitionNumber, "MATERIAL_LOT",
                    "Check completed. Store may now send the lot along its already-selected Processing/Production route.");
        }
    }

    private void addProcessingMilestones(MatFlowProcessingJob job, List<Milestone> milestones) {
        if (job == null)
            return;
        addMilestone(milestones, "PROCESSING_QUEUE", "Processing job waiting", "PROCESSING", job.location,
                "PROCESSING_PENDING", job.getCreatedAt(), job.getCreatedBy(), scale(job.plannedInputQty),
                "PROCESSING_JOB", job.getId(), job.jobNumber, "RESERVATION_LOT",
                job.routeStep == null ? "Approved preprocessing step." : "Process: " + safe(job.routeStep.processCode));
        addMilestone(milestones, "PROCESSING_STARTED", "Processing started", "PROCESSING", job.location,
                "PROCESSING", job.startedAt, job.startedBy, scale(job.actualInputQty),
                "PROCESSING_JOB", job.getId(), job.jobNumber, "RESERVATION_LOT", "Material entered processing.");
        addMilestone(milestones, "PROCESSING_COMPLETED", "Processing completed", "PROCESSING", job.location,
                "PROCESSING_COMPLETED", job.completedAt, job.completedBy, scale(job.outputQty),
                "PROCESSING_JOB", job.getId(), job.jobNumber, "RESERVATION_LOT",
                job.outputMaterial == null ? "Processing complete."
                        : "Output material: " + job.outputMaterial.getMaterialCode() + ".");
    }

    private void addConsumptionMilestones(
            TrackingContext context,
            MatFlowRequisitionLine line,
            List<Milestone> milestones,
            boolean lineAggregate) {
        for (MatFlowProductionConsumptionLine consumptionLine : context.consumptionLines()) {
            if (consumptionLine.requisitionLine == null
                    || !line.getId().equals(consumptionLine.requisitionLine.getId())) {
                continue;
            }
            MatFlowProductionConsumption consumption = consumptionLine.consumption;
            if (consumption == null)
                continue;
            addMilestone(milestones, "CONSUMPTION", "Material consumed in Production", "PRODUCTION",
                    consumption.productionLocation, "CONSUMED", consumption.consumedAt, consumption.consumedBy,
                    scale(consumptionLine.consumedQty), "PRODUCTION_CONSUMPTION", consumption.getId(),
                    consumption.consumptionNumber, lineAggregate ? "REQUISITION_LINE" : "RESERVATION_LOT",
                    lineAggregate
                            ? "Consumption is recorded at requisition-line level because multiple reservations feed this line."
                            : "Issued material consumed in Production.");
        }
    }

    private void addProductionWasteMilestones(
            MatFlowRequisitionLine line,
            List<Milestone> milestones,
            boolean lineAggregate) {
        if (line == null || line.getId() == null)
            return;
        for (MatFlowStockLedger ledger : productionWasteEntries(line.getId())) {
            addMilestone(milestones,
                    "PRODUCTION_WASTE",
                    "Material marked wasted in Production",
                    "PRODUCTION",
                    ledger.location,
                    "WASTED",
                    ledger.actionAt,
                    ledger.actor,
                    scale(ledger.quantityChange).abs(),
                    "PRODUCTION_WASTE",
                    line.getId(),
                    ledger.referenceNumber,
                    lineAggregate ? "REQUISITION_LINE" : "RESERVATION_LOT",
                    ledger.remarks == null ? "Issued material accounted as Production wastage." : ledger.remarks);
        }
    }

    private List<MatFlowStockLedger> productionWasteEntries(UUID requisitionLineId) {
        if (requisitionLineId == null)
            return List.of();
        return ledgerRepository.findAll((root, query, cb) -> cb.and(
                cb.equal(root.get("movementType"), MovementType.SCRAP),
                cb.equal(root.get("referenceType"), "MATFLOW_PRODUCTION_WASTE"),
                cb.equal(root.get("referenceId"), requisitionLineId)),
                Sort.by(Sort.Direction.ASC, "actionAt"));
    }

    private BigDecimal productionWasteForLine(UUID requisitionLineId) {
        return productionWasteEntries(requisitionLineId).stream()
                .map(entry -> scale(entry.quantityChange).abs())
                .reduce(ZERO, BigDecimal::add)
                .setScale(3, RoundingMode.HALF_UP);
    }

    private void addReturnMilestones(
            TrackingContext context,
            MatFlowRequisitionLine line,
            List<Milestone> milestones,
            boolean lineAggregate) {
        for (MatFlowMaterialReturnLine returnLine : context.returnLines()) {
            if (returnLine.requisitionLine == null || !line.getId().equals(returnLine.requisitionLine.getId())) {
                continue;
            }
            MatFlowMaterialReturn materialReturn = returnLine.materialReturn;
            if (materialReturn == null)
                continue;
            String scope = lineAggregate ? "REQUISITION_LINE" : "RESERVATION_LOT";
            addMilestone(milestones, "RETURN_PLANNED", "Production material return planned", "PRODUCTION",
                    materialReturn.fromLocation, "RETURN_PLANNED", materialReturn.getCreatedAt(),
                    materialReturn.createdForReturnBy, scale(returnLine.returnQty), "MATERIAL_RETURN",
                    materialReturn.getId(), materialReturn.returnNumber, scope,
                    "Return destination: " + safeLocationCode(materialReturn.toLocation) + ".");
            addMilestone(milestones, "RETURN_DISPATCHED", "Material return dispatched", "IN TRANSIT", null,
                    "RETURN_IN_TRANSIT", materialReturn.dispatchedAt, materialReturn.dispatchedBy,
                    scale(returnLine.dispatchedQty), "MATERIAL_RETURN", materialReturn.getId(),
                    materialReturn.returnNumber, scope,
                    routeLabel(materialReturn.fromLocation, materialReturn.toLocation));
            addMilestone(milestones, "RETURN_RECEIVED", "Material return received",
                    departmentFor(materialReturn.toLocation), materialReturn.toLocation, "RETURNED",
                    materialReturn.receivedAt, materialReturn.receivedBy, scale(returnLine.receivedQty),
                    "MATERIAL_RETURN", materialReturn.getId(), materialReturn.returnNumber, scope,
                    "Returned material entered destination custody.");
        }
    }

    private List<MaterialCustodyEvent> finalizeHistory(List<Milestone> source) {
        List<Milestone> milestones = source.stream()
                .filter(item -> item != null && item.enteredAt() != null)
                .sorted(Comparator.comparing(Milestone::enteredAt)
                        .thenComparing(Milestone::eventType, Comparator.nullsLast(String::compareTo)))
                .toList();

        List<Milestone> deduped = new ArrayList<>();
        for (Milestone item : milestones) {
            if (!deduped.isEmpty()) {
                Milestone previous = deduped.get(deduped.size() - 1);
                if (Objects.equals(previous.enteredAt(), item.enteredAt())
                        && Objects.equals(previous.state(), item.state())
                        && Objects.equals(previous.referenceId(), item.referenceId())) {
                    continue;
                }
            }
            deduped.add(item);
        }

        List<MaterialCustodyEvent> result = new ArrayList<>();
        for (int i = 0; i < deduped.size(); i++) {
            Milestone item = deduped.get(i);
            LocalDateTime exit = i + 1 < deduped.size() ? deduped.get(i + 1).enteredAt() : null;
            boolean terminal = exit == null && isTerminalState(item.state());
            if (terminal) {
                exit = item.enteredAt();
            }
            long duration = minutesBetween(item.enteredAt(), exit == null ? LocalDateTime.now() : exit);
            long target = targetFor(item.state());
            long variance = target <= 0 ? 0L : duration - target;
            String health = timingHealth(item.enteredAt(), exit, target, exit != null || terminal);
            result.add(new MaterialCustodyEvent(
                    i + 1, item.eventType(), item.label(), item.department(), locationId(item.location()),
                    locationCode(item.location()), locationName(item.location()), locationType(item.location()),
                    item.state(), item.enteredAt(), exit, duration, target, variance, health, scale(item.quantity()),
                    item.actor(), item.referenceType(), item.referenceId(), item.referenceNumber(), item.scope(),
                    item.note()));
        }
        return List.copyOf(result);
    }

    /*
     * ============================================================
     * Current / previous / next state resolution
     * ============================================================
     */

    private CurrentPosition resolveReservationCurrent(
            TrackingContext context,
            MatFlowRequisitionLine line,
            MatFlowReservation reservation,
            List<MatFlowTransferOrder> route,
            List<MatFlowQcInspection> inspections,
            List<MatFlowProcessingJob> jobs,
            MatFlowAuditLog issueAudit,
            List<MaterialCustodyEvent> history) {

        String reservationStatus = enumName(reservation.status);
        long reservationCountForLine = context.reservations().stream()
                .filter(item -> item.requisitionLine != null
                        && line.getId().equals(item.requisitionLine.getId()))
                .filter(item -> !"CANCELLED".equals(enumName(item.status))
                        && !"RELEASED".equals(enumName(item.status)))
                .count();
        boolean lineLevelPostIssueAggregation = reservationCountForLine > 1;

        /*
         * A partially issued reservation is physically split: some quantity is in
         * Production custody while the remaining quantity is still reserved. Do
         * not invent one current location for that split.
         */
        if ("PARTIALLY_ISSUED".equals(reservationStatus)) {
            return current(
                    "PRODUCTION / ROUTE",
                    "MULTI-DEPARTMENT",
                    null,
                    "PARTIALLY_ISSUED",
                    issueAudit == null ? reservation.getUpdatedAt() : issueAudit.getActionAt(),
                    "RESERVATION",
                    reservation.getId(),
                    context.requisition().requisitionNumber,
                    false);
        }

        /*
         * Processing/QC/transfer entities are reservation-specific, so they are
         * stronger custody evidence than requisition-line aggregate counters.
         */
        MatFlowProcessingJob activeJob = jobs.stream()
                .filter(item -> !Set.of("COMPLETED", "CANCELLED").contains(enumName(item.status)))
                .findFirst().orElse(null);
        if (activeJob != null) {
            boolean running = "IN_PROGRESS".equals(enumName(activeJob.status));
            return current(
                    "PROCESSING",
                    "PROCESSING",
                    activeJob.location,
                    running ? "PROCESSING" : "PROCESSING_PENDING",
                    running ? activeJob.startedAt : activeJob.getCreatedAt(),
                    "PROCESSING_JOB",
                    activeJob.getId(),
                    activeJob.jobNumber,
                    false);
        }

        MatFlowQcInspection currentQc = inspections.stream()
                .filter(item -> "PENDING".equals(enumName(item.status)))
                .findFirst().orElse(null);
        if (currentQc != null) {
            return current(
                    "QC",
                    "QC",
                    currentQc.location,
                    "QC_PENDING",
                    currentQc.getCreatedAt(),
                    "QC_INSPECTION",
                    currentQc.getId(),
                    context.requisition().requisitionNumber,
                    false);
        }

        MatFlowTransferOrder openTransfer = route.stream()
                .filter(item -> !CLOSED_TRANSFERS.contains(enumName(item.status)))
                .findFirst().orElse(null);
        if (openTransfer != null) {
            String status = enumName(openTransfer.status);
            if (Set.of("PARTIALLY_DISPATCHED", "IN_TRANSIT", "PARTIALLY_RECEIVED").contains(status)) {
                LocalDateTime dispatchAt = latestAuditTime(
                        context,
                        openTransfer.getId(),
                        "TRANSFER_DISPATCHED");
                return current(
                        "TRANSFER",
                        "IN TRANSIT",
                        null,
                        "IN_TRANSIT",
                        firstNonNull(dispatchAt, openTransfer.getUpdatedAt()),
                        "TRANSFER",
                        openTransfer.getId(),
                        openTransfer.transferNumber,
                        false);
            }
            return current(
                    "TRANSFER",
                    departmentFor(openTransfer.fromLocation),
                    openTransfer.fromLocation,
                    "WAITING_TRANSFER",
                    openTransfer.getCreatedAt(),
                    "TRANSFER",
                    openTransfer.getId(),
                    openTransfer.transferNumber,
                    false);
        }

        /*
         * Once this exact reservation is fully issued, its physical custody is
         * Production. Consumption/return rows in the current domain are recorded
         * against the requisition line (not reservation), therefore multiple
         * reservations must remain explicitly marked as line-level aggregation
         * rather than pretending a consumption belongs to a particular lot.
         */
        if ("ISSUED".equals(reservationStatus)) {
            if (lineLevelPostIssueAggregation) {
                boolean requisitionClosed = CLOSED_REQUISITIONS.contains(enumName(context.requisition().status));
                return current(
                        requisitionClosed ? "CLOSED" : "PRODUCTION",
                        requisitionClosed ? "CLOSED / LINE AGGREGATED" : "PRODUCTION / LINE AGGREGATED",
                        requisitionClosed ? null : context.requisition().destinationLocation,
                        requisitionClosed ? "CLOSED_LINE_AGGREGATED" : "IN_PRODUCTION_LINE_AGGREGATED",
                        issueAudit == null ? reservation.getUpdatedAt() : issueAudit.getActionAt(),
                        "RESERVATION",
                        reservation.getId(),
                        context.requisition().requisitionNumber,
                        requisitionClosed);
            }

            MatFlowMaterialReturn latestReturn = latestReturnForLine(context, line);
            if (latestReturn != null) {
                String returnStatus = enumName(latestReturn.status);
                if (Set.of("IN_TRANSIT", "PARTIALLY_RECEIVED").contains(returnStatus)) {
                    return current(
                            "RETURN",
                            "IN TRANSIT",
                            null,
                            "RETURN_IN_TRANSIT",
                            firstNonNull(latestReturn.dispatchedAt, latestReturn.getUpdatedAt()),
                            "MATERIAL_RETURN",
                            latestReturn.getId(),
                            latestReturn.returnNumber,
                            false);
                }
            }

            BigDecimal productionWastedQty = productionWasteForLine(line.getId());
            BigDecimal outstandingIssued = scale(line.issuedQty)
                    .subtract(scale(line.consumedQty))
                    .subtract(scale(line.returnedQty))
                    .subtract(productionWastedQty)
                    .max(ZERO);

            if (outstandingIssued.compareTo(ZERO) > 0) {
                LocalDateTime since = issueAudit == null ? reservation.getUpdatedAt() : issueAudit.getActionAt();
                MaterialCustodyEvent last = lastHistoryEvent(history);
                if (last != null
                        && last.enteredAt() != null
                        && since != null
                        && last.enteredAt().isAfter(since)
                        && !Set.of("CONSUMED", "RETURNED").contains(last.state())) {
                    since = last.enteredAt();
                }
                return current(
                        "PRODUCTION",
                        "PRODUCTION",
                        context.requisition().destinationLocation,
                        "IN_PRODUCTION",
                        since,
                        "RESERVATION",
                        reservation.getId(),
                        context.requisition().requisitionNumber,
                        false);
            }

            if (productionWastedQty.compareTo(ZERO) > 0 && outstandingIssued.compareTo(ZERO) <= 0) {
                String state = scale(line.consumedQty).compareTo(ZERO) > 0
                        ? "CONSUMED_AND_WASTED"
                        : scale(line.returnedQty).compareTo(ZERO) > 0
                                ? "WASTED_AND_RETURNED"
                                : "WASTED";
                MaterialCustodyEvent last = lastHistoryEvent(history);
                return current(
                        "CLOSED", "PRODUCTION", context.requisition().destinationLocation,
                        state, last == null ? line.getUpdatedAt() : last.enteredAt(),
                        "REQUISITION_LINE", line.getId(), context.requisition().requisitionNumber, true);
            }

            if (scale(line.returnedQty).compareTo(ZERO) > 0
                    && scale(line.consumedQty).compareTo(ZERO) > 0) {
                return current(
                        "CLOSED",
                        "CLOSED / SPLIT",
                        null,
                        "CONSUMED_AND_RETURNED",
                        line.getUpdatedAt(),
                        "REQUISITION_LINE",
                        line.getId(),
                        context.requisition().requisitionNumber,
                        true);
            }

            if (scale(line.returnedQty).compareTo(ZERO) > 0
                    && latestReturn != null
                    && "RECEIVED".equals(enumName(latestReturn.status))) {
                return current(
                        "RETURN",
                        departmentFor(latestReturn.toLocation),
                        latestReturn.toLocation,
                        "RETURNED",
                        firstNonNull(latestReturn.receivedAt, latestReturn.getUpdatedAt()),
                        "MATERIAL_RETURN",
                        latestReturn.getId(),
                        latestReturn.returnNumber,
                        true);
            }

            if (scale(line.consumedQty).compareTo(ZERO) > 0) {
                MaterialCustodyEvent last = lastHistoryEvent(history);
                return current(
                        "PRODUCTION",
                        "PRODUCTION",
                        context.requisition().destinationLocation,
                        "CONSUMED",
                        last == null ? line.getUpdatedAt() : last.enteredAt(),
                        "REQUISITION_LINE",
                        line.getId(),
                        context.requisition().requisitionNumber,
                        true);
            }

            return current(
                    "PRODUCTION",
                    "PRODUCTION",
                    context.requisition().destinationLocation,
                    "IN_PRODUCTION",
                    issueAudit == null ? reservation.getUpdatedAt() : issueAudit.getActionAt(),
                    "RESERVATION",
                    reservation.getId(),
                    context.requisition().requisitionNumber,
                    false);
        }

        if ("RELEASED".equals(reservationStatus) || "CANCELLED".equals(reservationStatus)) {
            return current(
                    "CLOSED",
                    departmentFor(reservation.sourceLocation),
                    reservation.sourceLocation,
                    reservationStatus,
                    reservation.getUpdatedAt(),
                    "RESERVATION",
                    reservation.getId(),
                    context.requisition().requisitionNumber,
                    true);
        }

        /*
         * If all physical transfers are closed, the last received location is the
         * current custody point until another explicit operation is created.
         */
        if (!route.isEmpty()) {
            MatFlowTransferOrder last = route.get(route.size() - 1);
            if ("RECEIVED".equals(enumName(last.status))) {
                LocalDateTime receivedAt = latestAuditTime(
                        context,
                        last.getId(),
                        "TRANSFER_RECEIVED");
                return current(
                        "ROUTE",
                        departmentFor(last.toLocation),
                        last.toLocation,
                        "RECEIVED",
                        firstNonNull(receivedAt, last.getUpdatedAt()),
                        "TRANSFER",
                        last.getId(),
                        last.transferNumber,
                        false);
            }
        }

        return current(
                stageForLocation(reservation.sourceLocation),
                departmentFor(reservation.sourceLocation),
                reservation.sourceLocation,
                "RESERVED",
                reservation.getCreatedAt(),
                "RESERVATION",
                reservation.getId(),
                context.requisition().requisitionNumber,
                false);
    }

    private NextPosition resolveReservationNext(
            TrackingContext context,
            MatFlowRequisitionLine line,
            MatFlowReservation reservation,
            List<MatFlowTransferOrder> route,
            List<MatFlowQcInspection> inspections,
            List<MatFlowProcessingJob> jobs,
            CurrentPosition current) {

        if (current.completed()) {
            return next("NONE", null, "No pending hand-off for this tracked quantity.");
        }

        if ("RETURN_IN_TRANSIT".equals(current.state())) {
            MatFlowMaterialReturn latestReturn = latestReturnForLine(context, line);
            return next(departmentFor(latestReturn == null ? null : latestReturn.toLocation),
                    latestReturn == null ? null : latestReturn.toLocation,
                    "Receive the Production return at the destination and reconcile stock.");
        }
        if ("PARTIALLY_ISSUED".equals(current.state())) {
            BigDecimal remaining = scale(reservation.reservedQty)
                    .subtract(scale(reservation.issuedQty))
                    .max(ZERO);
            return next(
                    "PRODUCTION",
                    context.requisition().destinationLocation,
                    "Issue the remaining " + remaining + " "
                            + (reservation.material == null || safe(reservation.material.getUom()) == null
                                    ? ""
                                    : reservation.material.getUom())
                            + " from this reservation while Production controls the already-issued quantity.");
        }
        if ("IN_PRODUCTION_LINE_AGGREGATED".equals(current.state())) {
            return next(
                    "PRODUCTION",
                    context.requisition().destinationLocation,
                    "Continue Production consumption/returns. Post-issue consumption is currently recorded at requisition-line level, so this view preserves that aggregation instead of assigning it to the wrong reservation.");
        }
        if ("IN_PRODUCTION".equals(current.state())) {
            return next("PRODUCTION", context.requisition().destinationLocation,
                    "Record consumption, return unused material if required, then complete Production.");
        }
        if ("PROCESSING".equals(current.state())) {
            return next("PROCESSING", current.location(), "Complete the processing job and release its output.");
        }
        if ("PROCESSING_PENDING".equals(current.state())) {
            return next("PROCESSING", current.location(), "Start the approved processing job.");
        }
        if ("QC_PENDING".equals(current.state())) {
            return next("QC", current.location(),
                    "Complete the QC check/tick. The material remains under Store custody and its route is already selected.");
        }

        MatFlowTransferOrder open = route.stream().filter(item -> !CLOSED_TRANSFERS.contains(enumName(item.status)))
                .findFirst().orElse(null);
        if (open != null) {
            String status = enumName(open.status);
            if (Set.of("PARTIALLY_DISPATCHED", "IN_TRANSIT", "PARTIALLY_RECEIVED").contains(status)) {
                return next(departmentFor(open.toLocation), open.toLocation,
                        "Receive the physical transfer at " + safeLocationCode(open.toLocation) + ".");
            }
            return next(departmentFor(open.toLocation), open.toLocation,
                    "Dispatch the material from " + safeLocationCode(open.fromLocation) + " to "
                            + safeLocationCode(open.toLocation) + ".");
        }

        if (!route.isEmpty()) {
            MatFlowTransferOrder last = route.get(route.size() - 1);
            if (last.toLocation != null && last.toLocation.getLocationType() == LocationType.PRODUCTION
                    && scale(line.issuedQty).compareTo(ZERO) <= 0) {
                return next("PRODUCTION", last.toLocation,
                        "Production must acknowledge receipt of the arriving material before Production can start.");
            }
        }

        if (reservation.firstDestinationLocation != null
                && !sameLocation(reservation.sourceLocation, reservation.firstDestinationLocation)) {
            return next(departmentFor(reservation.firstDestinationLocation), reservation.firstDestinationLocation,
                    "Move reserved material to its approved first destination.");
        }

        return next("PRODUCTION", context.requisition().destinationLocation,
                "Continue the approved material route toward Production.");
    }

    private CurrentPosition resolveShortageCurrent(
            TrackingContext context,
            MatFlowRequisitionLine line,
            List<MatFlowIndentLine> indentLines,
            List<MaterialCustodyEvent> history) {

        MatFlowQcInspection pendingQc = context.inspections().stream()
                .filter(item -> sameMaterial(item.material, line.material == null ? null : line.material.getId()))
                .filter(item -> "PENDING".equals(enumName(item.status)))
                .max(Comparator.comparing(MatFlowQcInspection::getCreatedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(null);
        if (pendingQc != null) {
            return current("PURCHASE / QC", "QC", pendingQc.location, "QC_PENDING", pendingQc.getCreatedAt(),
                    "QC_INSPECTION", pendingQc.getId(), context.requisition().requisitionNumber, false);
        }

        MatFlowPurchaseOrder latestOrder = context.poLines().stream()
                .filter(poLine -> poLine.indentLine != null
                        && indentLines.stream().anyMatch(i -> i.getId().equals(poLine.indentLine.getId())))
                .map(poLine -> poLine.purchaseOrder)
                .filter(Objects::nonNull)
                .max(Comparator.comparing(MatFlowPurchaseOrder::getCreatedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(null);
        if (latestOrder != null) {
            boolean placed = !"DRAFT".equals(enumName(latestOrder.status));
            return current("PURCHASE", placed ? "SUPPLIER / PURCHASE" : "PURCHASE",
                    placed ? null : latestOrder.deliveryLocation, placed ? "SUPPLIER_ORDERED" : "PURCHASE_ORDER_DRAFT",
                    placed ? firstNonNull(latestOrder.approvedAt, latestOrder.getUpdatedAt())
                            : latestOrder.getCreatedAt(),
                    "PURCHASE_ORDER", latestOrder.getId(), latestOrder.poNumber, false);
        }

        MatFlowIndentLine latestIndent = indentLines.stream()
                .max(Comparator.comparing(MatFlowIndentLine::getCreatedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(null);
        if (latestIndent != null) {
            return current("PURCHASE", "STORE / PURCHASE",
                    latestIndent.indent == null ? null : latestIndent.indent.deliverToLocation,
                    "SHORTAGE_CONFIRMED", latestIndent.getCreatedAt(), "INDENT_LINE", latestIndent.getId(),
                    latestIndent.indent == null ? null : latestIndent.indent.indentNumber, false);
        }

        MaterialCustodyEvent last = lastHistoryEvent(history);
        return current("STORE", "STORE", null, "SHORTAGE_PENDING",
                last == null ? line.getUpdatedAt() : last.enteredAt(), "REQUISITION_LINE", line.getId(),
                context.requisition().requisitionNumber, false);
    }

    private NextPosition resolveShortageNext(
            TrackingContext context,
            MatFlowRequisitionLine line,
            List<MatFlowIndentLine> indentLines,
            CurrentPosition current) {

        MatFlowPurchaseOrder latestOrder = context.poLines().stream()
                .filter(poLine -> poLine.indentLine != null
                        && indentLines.stream().anyMatch(i -> i.getId().equals(poLine.indentLine.getId())))
                .map(poLine -> poLine.purchaseOrder)
                .filter(Objects::nonNull)
                .max(Comparator.comparing(MatFlowPurchaseOrder::getCreatedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(null);

        return switch (current.state()) {
            case "QC_PENDING" -> next("QC", current.location(),
                    "Complete QC. Accepted quantity will be allocated to this Project/Product demand.");
            case "SUPPLIER_ORDERED" -> next(
                    "STORE / RECEIVING",
                    latestOrder == null ? null : latestOrder.deliveryLocation,
                    "Receive supplier material through GRN at "
                            + safeLocationCode(latestOrder == null ? null : latestOrder.deliveryLocation)
                            + ". Store then re-reviews the MR and decides QC or direct Production.");
            case "PURCHASE_ORDER_DRAFT" -> next("PURCHASE", current.location(),
                    "Complete and place the Purchase Order against the linked PI and vendor.");
            case "SHORTAGE_CONFIRMED", "SHORTAGE_PENDING" -> next("PURCHASE", current.location(),
                    "Raise/complete a Purchase Order for the open shortage.");
            default -> next("STORE", current.location(),
                    "Complete the shortage supply branch, inward through GRN, then let Store allocate the received stock.");
        };
    }

    /*
     * ============================================================
     * Inventory and immutable ledger
     * ============================================================
     */

    private List<MaterialStockPosition> loadInventory(UUID materialId, String requestedPlant) {
        return entityManager.createQuery(
                """
                        select balance
                        from MatFlowStockBalance balance
                        where balance.material.id = :materialId
                        """,
                MatFlowStockBalance.class)
                .setParameter("materialId", materialId)
                .getResultList().stream()
                .filter(item -> item != null && item.material != null && item.location != null)
                .filter(item -> canAccessPlant(item.location.getPlantCode(), requestedPlant))
                .map(item -> new MaterialStockPosition(
                        item.location.getId(), item.location.getLocationCode(), item.location.getLocationName(),
                        item.location.getLocationType() == null ? null : item.location.getLocationType().name(),
                        item.location.getPlantCode(), scale(item.onHandQty), scale(item.reservedQty),
                        scale(item.blockedQty), scale(item.inTransitQty), scale(item.availableQty()),
                        item.getUpdatedAt()))
                .sorted(Comparator.comparing(MaterialStockPosition::plantCode,
                        Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(MaterialStockPosition::locationCode,
                                Comparator.nullsLast(String::compareToIgnoreCase)))
                .toList();
    }

    private List<MaterialLedgerEvent> loadLedger(UUID materialId, String requestedPlant) {
        Specification<MatFlowStockLedger> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("material").get("id"), materialId));
            if (requestedPlant != null) {
                predicates.add(cb.equal(cb.upper(root.get("location").get("plantCode")), requestedPlant));
            } else {
                predicates.add(cb.upper(root.get("location").<String>get("plantCode"))
                        .in(accessService.allowedPlants()));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };

        return ledgerRepository.findAll(spec, Sort.by(Sort.Direction.DESC, "actionAt")).stream()
                .limit(300)
                .map(item -> new MaterialLedgerEvent(
                        item.id, enumName(item.movementType),
                        item.location == null ? null : item.location.getId(),
                        item.location == null ? null : item.location.getLocationCode(),
                        item.location == null ? null : item.location.getLocationName(),
                        item.location == null || item.location.getLocationType() == null ? null
                                : item.location.getLocationType().name(),
                        item.location == null ? null : item.location.getPlantCode(),
                        scale(item.quantityChange), scale(item.reservedChange), scale(item.blockedChange),
                        scale(item.inTransitChange), scale(item.onHandAfter), scale(item.reservedAfter),
                        scale(item.blockedAfter), scale(item.inTransitAfter), item.referenceType, item.referenceId,
                        item.referenceNumber, item.projectCode, item.drawingNo, item.batchNo, item.remarks, item.actor,
                        item.actionAt))
                .toList();
    }

    /*
     * ============================================================
     * Relationship and audit helpers
     * ============================================================
     */

    private List<MatFlowQcInspection> inspectionsForReservation(
            TrackingContext context,
            MatFlowReservation reservation,
            List<MatFlowTransferOrder> route) {
        Set<UUID> transferIds = route.stream().map(MatFlowTransferOrder::getId)
                .filter(Objects::nonNull).collect(java.util.stream.Collectors.toSet());
        return context.inspections().stream()
                .filter(item -> reservation.getId().equals(item.routingReservationId)
                        || (item.sourceId != null && transferIds.contains(item.sourceId)))
                .filter(item -> item.material == null || reservation.material == null
                        || item.material.getId().equals(reservation.material.getId()))
                .sorted(Comparator.comparing(MatFlowQcInspection::getCreatedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    private MatFlowAuditLog latestIssueAudit(
            TrackingContext context,
            MatFlowReservation reservation,
            MatFlowRequisitionLine line) {
        return context.audits().stream()
                .filter(item -> "MATERIAL_ISSUED_TO_PRODUCTION".equalsIgnoreCase(item.getAction()))
                .filter(item -> reservation.getId().equals(uuidFromDetails(item, "reservationId"))
                        || line.getId().equals(uuidFromDetails(item, "requisitionLineId")))
                .max(Comparator.comparing(MatFlowAuditLog::getActionAt,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(null);
    }

    private LocalDateTime latestAuditTime(TrackingContext context, UUID entityId, String action) {
        return context.audits().stream()
                .filter(item -> entityId != null && entityId.equals(item.getEntityId()))
                .filter(item -> action.equalsIgnoreCase(item.getAction()))
                .map(MatFlowAuditLog::getActionAt)
                .filter(Objects::nonNull)
                .max(LocalDateTime::compareTo)
                .orElse(null);
    }

    private BigDecimal quantityFromDetails(MatFlowAuditLog audit) {
        Object value = detailMap(audit).get("quantity");
        if (value == null)
            return ZERO;
        try {
            return scale(new BigDecimal(String.valueOf(value)));
        } catch (Exception ignored) {
            return ZERO;
        }
    }

    private UUID uuidFromDetails(MatFlowAuditLog audit, String key) {
        Object value = detailMap(audit).get(key);
        if (value == null)
            return null;
        try {
            return UUID.fromString(String.valueOf(value));
        } catch (Exception ignored) {
            return null;
        }
    }

    private Map<String, Object> detailMap(MatFlowAuditLog audit) {
        String json = audit == null ? null : audit.getDetailsJson();
        if (json == null || json.isBlank())
            return Map.of();
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {
            });
        } catch (Exception ignored) {
            return Map.of();
        }
    }

    private MatFlowMaterialReturn latestReturnForLine(TrackingContext context, MatFlowRequisitionLine line) {
        return context.returnLines().stream()
                .filter(item -> item.requisitionLine != null && line.getId().equals(item.requisitionLine.getId()))
                .map(item -> item.materialReturn)
                .filter(Objects::nonNull)
                .max(Comparator.comparing(MatFlowMaterialReturn::getUpdatedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(null);
    }

    private BigDecimal transferQuantity(MatFlowTransferOrder transfer) {
        if (transfer == null)
            return ZERO;
        // Transfer lines are deliberately not injected here; the reservation is
        // the lot identity and its reserved quantity is the safe planned quantity.
        return transfer.reservation == null ? ZERO : scale(transfer.reservation.reservedQty);
    }

    /*
     * ============================================================
     * Hydration helpers: protect public-field entities from lazy proxies.
     * ============================================================
     */

    private MatFlowMaterialRequisition hydrateRequisition(MatFlowMaterialRequisition raw) {
        MatFlowMaterialRequisition item = unproxy(raw, MatFlowMaterialRequisition.class);
        if (item == null)
            return null;
        item.projectDrawing = unproxy(item.projectDrawing, MatFlowProjectDrawing.class);
        item.bom = unproxy(item.bom, MatFlowBom.class);
        item.destinationLocation = unproxy(item.destinationLocation, MatFlowLocation.class);
        return item;
    }

    private MatFlowRequisitionLine hydrateLine(MatFlowRequisitionLine raw) {
        MatFlowRequisitionLine item = unproxy(raw, MatFlowRequisitionLine.class);
        if (item == null)
            return null;
        item.requisition = hydrateRequisition(item.requisition);
        item.material = unproxy(item.material, MatFlowMaterial.class);
        item.issuedMaterial = unproxy(item.issuedMaterial, MatFlowMaterial.class);
        return item;
    }

    private MatFlowReservation hydrateReservation(MatFlowReservation raw) {
        MatFlowReservation item = unproxy(raw, MatFlowReservation.class);
        if (item == null)
            return null;
        item.requisitionLine = hydrateLine(item.requisitionLine);
        item.material = unproxy(item.material, MatFlowMaterial.class);
        item.sourceLocation = unproxy(item.sourceLocation, MatFlowLocation.class);
        item.firstDestinationLocation = unproxy(item.firstDestinationLocation, MatFlowLocation.class);
        return item;
    }

    private MatFlowIndentLine hydrateIndentLine(MatFlowIndentLine raw) {
        MatFlowIndentLine item = unproxy(raw, MatFlowIndentLine.class);
        if (item == null)
            return null;
        item.indent = unproxy(item.indent, MatFlowIndent.class);
        item.requisitionLine = hydrateLine(item.requisitionLine);
        item.material = unproxy(item.material, MatFlowMaterial.class);
        return item;
    }

    private MatFlowPurchaseOrder hydrateOrder(MatFlowPurchaseOrder raw) {
        MatFlowPurchaseOrder item = unproxy(raw, MatFlowPurchaseOrder.class);
        if (item == null)
            return null;
        item.indent = unproxy(item.indent, MatFlowIndent.class);
        item.deliveryLocation = unproxy(item.deliveryLocation, MatFlowLocation.class);
        item.vendor = unproxy(item.vendor, MatFlowVendor.class);
        return item;
    }

    private MatFlowPurchaseOrderLine hydratePoLine(MatFlowPurchaseOrderLine raw) {
        MatFlowPurchaseOrderLine item = unproxy(raw, MatFlowPurchaseOrderLine.class);
        if (item == null)
            return null;
        item.purchaseOrder = hydrateOrder(item.purchaseOrder);
        item.indentLine = hydrateIndentLine(item.indentLine);
        item.material = unproxy(item.material, MatFlowMaterial.class);
        return item;
    }

    private MatFlowGoodsReceipt hydrateReceipt(MatFlowGoodsReceipt raw) {
        MatFlowGoodsReceipt item = unproxy(raw, MatFlowGoodsReceipt.class);
        if (item == null)
            return null;
        item.purchaseOrder = hydrateOrder(item.purchaseOrder);
        item.receiptLocation = unproxy(item.receiptLocation, MatFlowLocation.class);
        return item;
    }

    private MatFlowGoodsReceiptLine hydrateReceiptLine(MatFlowGoodsReceiptLine raw) {
        MatFlowGoodsReceiptLine item = unproxy(raw, MatFlowGoodsReceiptLine.class);
        if (item == null)
            return null;
        item.goodsReceipt = hydrateReceipt(item.goodsReceipt);
        item.purchaseOrderLine = hydratePoLine(item.purchaseOrderLine);
        item.material = unproxy(item.material, MatFlowMaterial.class);
        return item;
    }

    private MatFlowQcInspection hydrateInspection(MatFlowQcInspection raw) {
        MatFlowQcInspection item = unproxy(raw, MatFlowQcInspection.class);
        if (item == null)
            return null;
        item.material = unproxy(item.material, MatFlowMaterial.class);
        item.location = unproxy(item.location, MatFlowLocation.class);
        return item;
    }

    private MatFlowTransferOrder hydrateTransfer(MatFlowTransferOrder raw) {
        MatFlowTransferOrder item = unproxy(raw, MatFlowTransferOrder.class);
        if (item == null)
            return null;
        item.requisition = hydrateRequisition(item.requisition);
        item.reservation = hydrateReservation(item.reservation);
        item.fromLocation = unproxy(item.fromLocation, MatFlowLocation.class);
        item.toLocation = unproxy(item.toLocation, MatFlowLocation.class);
        return item;
    }

    private MatFlowProcessingJob hydrateJob(MatFlowProcessingJob raw) {
        MatFlowProcessingJob item = unproxy(raw, MatFlowProcessingJob.class);
        if (item == null)
            return null;
        item.requisition = hydrateRequisition(item.requisition);
        item.reservation = hydrateReservation(item.reservation);
        item.location = unproxy(item.location, MatFlowLocation.class);
        item.inputMaterial = unproxy(item.inputMaterial, MatFlowMaterial.class);
        item.outputMaterial = unproxy(item.outputMaterial, MatFlowMaterial.class);
        item.routeStep = unproxy(item.routeStep, MatFlowBomRouteStep.class);
        return item;
    }

    private MatFlowProductionConsumption hydrateConsumption(MatFlowProductionConsumption raw) {
        MatFlowProductionConsumption item = unproxy(raw, MatFlowProductionConsumption.class);
        if (item == null)
            return null;
        item.requisition = hydrateRequisition(item.requisition);
        item.productionLocation = unproxy(item.productionLocation, MatFlowLocation.class);
        return item;
    }

    private MatFlowProductionConsumptionLine hydrateConsumptionLine(MatFlowProductionConsumptionLine raw) {
        MatFlowProductionConsumptionLine item = unproxy(raw, MatFlowProductionConsumptionLine.class);
        if (item == null)
            return null;
        item.consumption = hydrateConsumption(item.consumption);
        item.requisitionLine = hydrateLine(item.requisitionLine);
        item.material = unproxy(item.material, MatFlowMaterial.class);
        return item;
    }

    private MatFlowMaterialReturn hydrateReturn(MatFlowMaterialReturn raw) {
        MatFlowMaterialReturn item = unproxy(raw, MatFlowMaterialReturn.class);
        if (item == null)
            return null;
        item.requisition = hydrateRequisition(item.requisition);
        item.fromLocation = unproxy(item.fromLocation, MatFlowLocation.class);
        item.toLocation = unproxy(item.toLocation, MatFlowLocation.class);
        return item;
    }

    private MatFlowMaterialReturnLine hydrateReturnLine(MatFlowMaterialReturnLine raw) {
        MatFlowMaterialReturnLine item = unproxy(raw, MatFlowMaterialReturnLine.class);
        if (item == null)
            return null;
        item.materialReturn = hydrateReturn(item.materialReturn);
        item.requisitionLine = hydrateLine(item.requisitionLine);
        item.material = unproxy(item.material, MatFlowMaterial.class);
        return item;
    }

    private <T> T unproxy(T value, Class<T> type) {
        if (value == null)
            return null;
        return type.cast(Hibernate.unproxy(value));
    }

    /*
     * ============================================================
     * Small value helpers
     * ============================================================
     */

    private void addMilestone(
            List<Milestone> target,
            String eventType,
            String label,
            String department,
            MatFlowLocation location,
            String state,
            LocalDateTime enteredAt,
            String actor,
            BigDecimal quantity,
            String referenceType,
            UUID referenceId,
            String referenceNumber,
            String scope,
            String note) {
        if (enteredAt == null)
            return;
        target.add(new Milestone(eventType, label, department, location, state, enteredAt, actor,
                scale(quantity), referenceType, referenceId, referenceNumber, scope, note));
    }

    private CurrentPosition current(
            String stage,
            String department,
            MatFlowLocation location,
            String state,
            LocalDateTime enteredAt,
            String referenceType,
            UUID referenceId,
            String referenceNumber,
            boolean completed) {
        return new CurrentPosition(stage, department, location, state, enteredAt, referenceType, referenceId,
                referenceNumber, completed);
    }

    private NextPosition next(String department, MatFlowLocation location, String action) {
        return new NextPosition(department, location, action);
    }

    private MaterialCustodyEvent lastHistoryEvent(List<MaterialCustodyEvent> history) {
        return history == null || history.isEmpty() ? null : history.get(history.size() - 1);
    }

    private MaterialCustodyEvent previousHistoryEvent(List<MaterialCustodyEvent> history, LocalDateTime currentSince) {
        if (history == null || history.isEmpty())
            return null;
        MaterialCustodyEvent previous = null;
        for (MaterialCustodyEvent event : history) {
            if (currentSince != null && event.enteredAt() != null && !event.enteredAt().isBefore(currentSince)) {
                break;
            }
            previous = event;
        }
        if (previous != null)
            return previous;
        return history.size() >= 2 ? history.get(history.size() - 2) : null;
    }

    private long targetFor(String state) {
        return TARGET_MINUTES.getOrDefault(enumName(state), 0L);
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

    private boolean isTerminalState(String state) {
        return Set.of(
                "CONSUMED",
                "RETURNED",
                "CONSUMED_AND_RETURNED",
                "RELEASED",
                "CANCELLED",
                "CLOSED_LINE_AGGREGATED").contains(enumName(state));
    }

    private boolean isBreach(String health) {
        return "BREACHED".equals(health) || "COMPLETED_LATE".equals(health);
    }

    private long minutesBetween(LocalDateTime start, LocalDateTime end) {
        if (start == null || end == null || end.isBefore(start))
            return 0L;
        return Math.max(0L, Duration.between(start, end).toMinutes());
    }

    private boolean canRead(MatFlowMaterialRequisition requisition, String requestedPlant) {
        if (requisition == null || requisition.projectDrawing == null)
            return false;
        String plant = cleanUpper(requisition.projectDrawing.getPlantCode());
        return plant != null && canAccessPlant(plant, requestedPlant);
    }

    private boolean canAccessPlant(String plant, String requestedPlant) {
        String normalized = cleanUpper(plant);
        if (normalized == null || !accessService.canAccessPlant(normalized))
            return false;
        return requestedPlant == null || requestedPlant.equals(normalized);
    }

    private boolean sameMaterial(MatFlowMaterial material, UUID id) {
        return material != null && id != null && id.equals(material.getId());
    }

    private boolean sameLocation(MatFlowLocation left, MatFlowLocation right) {
        return left != null && right != null && left.getId() != null && left.getId().equals(right.getId());
    }

    private MatFlowLocation initialReservationLocation(
            MatFlowReservation reservation,
            List<MatFlowTransferOrder> route,
            List<MatFlowQcInspection> inspections) {
        if (route != null && !route.isEmpty()) {
            MatFlowTransferOrder first = route.stream()
                    .min(Comparator.comparing(MatFlowTransferOrder::getCreatedAt,
                            Comparator.nullsLast(Comparator.naturalOrder())))
                    .orElse(null);
            if (first != null && first.fromLocation != null) {
                return first.fromLocation;
            }
        }
        if (inspections != null && !inspections.isEmpty()) {
            MatFlowQcInspection firstInspection = inspections.stream()
                    .min(Comparator.comparing(MatFlowQcInspection::getCreatedAt,
                            Comparator.nullsLast(Comparator.naturalOrder())))
                    .orElse(null);
            if (firstInspection != null && firstInspection.location != null
                    && firstInspection.sourceType == QcSourceType.GOODS_RECEIPT) {
                return firstInspection.location;
            }
        }
        return reservation == null ? null : reservation.sourceLocation;
    }

    private String stageForLocation(MatFlowLocation location) {
        if (location == null || location.getLocationType() == null)
            return "CUSTODY";
        return switch (location.getLocationType()) {
            case STORE -> "STORE";
            case QC -> "QC";
            case PROCESSING, EXTERNAL_PROCESSOR -> "PROCESSING";
            case PRODUCTION -> "PRODUCTION";
            case SUPPLIER -> "PURCHASE";
            case TRANSIT -> "TRANSFER";
            default -> "CUSTODY";
        };
    }

    private String departmentFor(MatFlowLocation location) {
        if (location == null || location.getLocationType() == null)
            return "UNKNOWN";
        return switch (location.getLocationType()) {
            case STORE -> "STORE";
            case QC -> "QC";
            case PROCESSING, EXTERNAL_PROCESSOR -> "PROCESSING";
            case PRODUCTION -> "PRODUCTION";
            case SUPPLIER -> "SUPPLIER";
            case TRANSIT -> "IN TRANSIT";
            default -> enumName(location.getLocationType());
        };
    }

    private String routeLabel(MatFlowLocation from, MatFlowLocation to) {
        return safeLocationCode(from) + " → " + safeLocationCode(to);
    }

    private String safeLocationCode(MatFlowLocation location) {
        return location == null || safe(location.getLocationCode()) == null ? "-" : location.getLocationCode();
    }

    private UUID locationId(MatFlowLocation location) {
        return location == null ? null : location.getId();
    }

    private String locationCode(MatFlowLocation location) {
        return location == null ? null : location.getLocationCode();
    }

    private String locationName(MatFlowLocation location) {
        return location == null ? null : location.getLocationName();
    }

    private String locationType(MatFlowLocation location) {
        return location == null || location.getLocationType() == null ? null : location.getLocationType().name();
    }

    private LocalDateTime firstNonNull(LocalDateTime first, LocalDateTime second) {
        return first != null ? first : second;
    }

    private String enumName(Object value) {
        if (value == null)
            return "";
        return value instanceof Enum<?> enumeration ? enumeration.name()
                : String.valueOf(value).trim().toUpperCase(Locale.ROOT);
    }

    private String safe(String value) {
        if (value == null)
            return null;
        String result = value.trim();
        return result.isBlank() ? null : result;
    }

    private String cleanUpper(String value) {
        String result = safe(value);
        return result == null ? null : result.toUpperCase(Locale.ROOT);
    }

    private BigDecimal scale(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(3, RoundingMode.HALF_UP);
    }

    private void addId(Set<UUID> target, Object entity) {
        if (entity == null)
            return;
        UUID id = null;
        if (entity instanceof MatFlowMaterialRequisition item)
            id = item.getId();
        else if (entity instanceof MatFlowProjectDrawing item)
            id = item.getId();
        else if (entity instanceof MatFlowBom item)
            id = item.getId();
        else if (entity instanceof MatFlowRequisitionLine item)
            id = item.getId();
        else if (entity instanceof MatFlowReservation item)
            id = item.getId();
        else if (entity instanceof MatFlowIndent item)
            id = item.getId();
        else if (entity instanceof MatFlowPurchaseOrder item)
            id = item.getId();
        else if (entity instanceof MatFlowGoodsReceipt item)
            id = item.getId();
        else if (entity instanceof MatFlowTransferOrder item)
            id = item.getId();
        else if (entity instanceof MatFlowQcInspection item)
            id = item.getId();
        else if (entity instanceof MatFlowProcessingJob item)
            id = item.getId();
        else if (entity instanceof MatFlowProductionConsumption item)
            id = item.getId();
        else if (entity instanceof MatFlowMaterialReturn item)
            id = item.getId();
        if (id != null)
            target.add(id);
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }

    private record Milestone(
            String eventType,
            String label,
            String department,
            MatFlowLocation location,
            String state,
            LocalDateTime enteredAt,
            String actor,
            BigDecimal quantity,
            String referenceType,
            UUID referenceId,
            String referenceNumber,
            String scope,
            String note) {
    }

    private record CurrentPosition(
            String stage,
            String department,
            MatFlowLocation location,
            String state,
            LocalDateTime enteredAt,
            String referenceType,
            UUID referenceId,
            String referenceNumber,
            boolean completed) {
    }

    private record NextPosition(String department, MatFlowLocation location, String action) {
    }

    private record TrackingContext(
            MatFlowMaterialRequisition requisition,
            List<MatFlowRequisitionLine> lines,
            List<MatFlowReservation> reservations,
            List<MatFlowIndent> indents,
            List<MatFlowIndentLine> indentLines,
            List<MatFlowPurchaseOrder> orders,
            List<MatFlowPurchaseOrderLine> poLines,
            List<MatFlowGoodsReceipt> receipts,
            List<MatFlowGoodsReceiptLine> receiptLines,
            List<MatFlowQcInspection> inspections,
            List<MatFlowTransferOrder> transfers,
            List<MatFlowProcessingJob> jobs,
            List<MatFlowProductionConsumption> consumptions,
            List<MatFlowProductionConsumptionLine> consumptionLines,
            List<MatFlowMaterialReturn> returns,
            List<MatFlowMaterialReturnLine> returnLines,
            List<MatFlowAuditLog> audits) {
    }
}
