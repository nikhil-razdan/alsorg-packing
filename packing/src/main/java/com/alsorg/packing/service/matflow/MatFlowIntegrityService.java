package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowIntegrityDtos.IntegrityReport;
import com.alsorg.packing.controller.dto.matflow.MatFlowIntegrityDtos.IntegritySeverity;
import com.alsorg.packing.controller.dto.matflow.MatFlowIntegrityDtos.IntegritySummary;
import com.alsorg.packing.controller.dto.matflow.MatFlowIntegrityDtos.IntegrityViolation;

import com.alsorg.packing.domain.matflow.MatFlowGoodsReceiptLine;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ProcessingJobStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ReservationStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.TransferStatus;
import com.alsorg.packing.domain.matflow.MatFlowProcessingJob;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionLine;
import com.alsorg.packing.domain.matflow.MatFlowReservation;
import com.alsorg.packing.domain.matflow.MatFlowStockBalance;
import com.alsorg.packing.domain.matflow.MatFlowTransferLine;

import com.alsorg.packing.repository.matflow.MatFlowGoodsReceiptLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowProcessingJobRepository;
import com.alsorg.packing.repository.matflow.MatFlowRequisitionLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowReservationRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockBalanceRepository;
import com.alsorg.packing.repository.matflow.MatFlowTransferLineRepository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MatFlowIntegrityService {

    private final MatFlowStockBalanceRepository stockRepository;
    private final MatFlowRequisitionLineRepository requisitionLineRepository;
    private final MatFlowTransferLineRepository transferLineRepository;
    private final MatFlowGoodsReceiptLineRepository receiptLineRepository;
    private final MatFlowProcessingJobRepository processingRepository;
    private final MatFlowReservationRepository reservationRepository;
    private final MatFlowAccessService accessService;

    public MatFlowIntegrityService(
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
                        normalizePlant(
                                line.requisition.destinationLocation.plantCode)))
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
                    line.requisition.destinationLocation.plantCode,
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
                    line.requisition.destinationLocation.plantCode,
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
                    line.requisition.destinationLocation.plantCode,
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
                    line.requisition.destinationLocation.plantCode,
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