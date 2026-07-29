package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.QcDispositionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.QcDispositionResponse;

import com.alsorg.packing.domain.matflow.MatFlowLocation;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MovementType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcDispositionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcDispositionType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcInspectionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcSourceType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ReservationStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.TransferPurpose;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.TransferStatus;
import com.alsorg.packing.domain.matflow.MatFlowQcDisposition;
import com.alsorg.packing.domain.matflow.MatFlowQcInspection;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionLine;
import com.alsorg.packing.domain.matflow.MatFlowReservation;
import com.alsorg.packing.domain.matflow.MatFlowStockBalance;
import com.alsorg.packing.domain.matflow.MatFlowStockLedger;
import com.alsorg.packing.domain.matflow.MatFlowTransferLine;
import com.alsorg.packing.domain.matflow.MatFlowTransferOrder;

import com.alsorg.packing.repository.matflow.MatFlowLocationRepository;
import com.alsorg.packing.repository.matflow.MatFlowQcDispositionRepository;
import com.alsorg.packing.repository.matflow.MatFlowQcInspectionRepository;
import com.alsorg.packing.repository.matflow.MatFlowRequisitionLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowReservationRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockBalanceRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockLedgerRepository;
import com.alsorg.packing.repository.matflow.MatFlowTransferLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowTransferOrderRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MatFlowQcDispositionService {

    private final MatFlowQcDispositionRepository dispositionRepository;
    private final MatFlowQcInspectionRepository inspectionRepository;
    private final MatFlowTransferOrderRepository transferRepository;
    private final MatFlowTransferLineRepository transferLineRepository;
    private final MatFlowReservationRepository reservationRepository;
    private final MatFlowRequisitionLineRepository requisitionLineRepository;
    private final MatFlowLocationRepository locationRepository;
    private final MatFlowStockBalanceRepository stockRepository;
    private final MatFlowStockLedgerRepository ledgerRepository;
    private final MatFlowAccessService accessService;

    public MatFlowQcDispositionService(
            MatFlowQcDispositionRepository dispositionRepository,
            MatFlowQcInspectionRepository inspectionRepository,
            MatFlowTransferOrderRepository transferRepository,
            MatFlowTransferLineRepository transferLineRepository,
            MatFlowReservationRepository reservationRepository,
            MatFlowRequisitionLineRepository requisitionLineRepository,
            MatFlowLocationRepository locationRepository,
            MatFlowStockBalanceRepository stockRepository,
            MatFlowStockLedgerRepository ledgerRepository,
            MatFlowAccessService accessService
    ) {
        this.dispositionRepository =
                dispositionRepository;

        this.inspectionRepository =
                inspectionRepository;

        this.transferRepository =
                transferRepository;

        this.transferLineRepository =
                transferLineRepository;

        this.reservationRepository =
                reservationRepository;

        this.requisitionLineRepository =
                requisitionLineRepository;

        this.locationRepository =
                locationRepository;

        this.stockRepository =
                stockRepository;

        this.ledgerRepository =
                ledgerRepository;

        this.accessService =
                accessService;
    }

    @Transactional(readOnly = true)
    public List<QcDispositionResponse> list() {
        accessService.requireRead();

        return dispositionRepository
                .findAllByOrderByCreatedAtDesc()
                .stream()
                .filter(disposition ->
                        accessService.canAccessPlant(
                                disposition
                                        .qcInspection
                                        .location
                                        .plantCode
                        )
                )
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public QcDispositionResponse decide(
            UUID inspectionId,
            QcDispositionRequest request
    ) {
        accessService.requireQcDisposition();

        if (
                request == null ||
                request.dispositionType() == null
        ) {
            throw badRequest(
                    "QC disposition request and type are required"
            );
        }

        MatFlowQcInspection inspection =
                inspectionRepository
                        .findById(inspectionId)
                        .orElseThrow(() ->
                                notFound(
                                        "QC inspection not found"
                                )
                        );

        accessService.requirePlantAccess(
                inspection.location
                        .plantCode
        );

        if (
                inspection.sourceType !=
                        QcSourceType.TRANSFER_RECEIPT
        ) {
            throw conflict(
                    "This disposition workflow is only for internally transferred material"
            );
        }

        if (
                inspection.status !=
                        QcInspectionStatus.COMPLETED
        ) {
            throw conflict(
                    "QC inspection must be completed first"
            );
        }

        assertVersion(
                request.rowVersion(),
                inspection.getRowVersion()
        );

        BigDecimal alreadyDisposed =
                dispositionRepository
                        .findByQcInspection_IdOrderByCreatedAtAsc(
                                inspection.getId()
                        )
                        .stream()
                        .filter(disposition ->
                                disposition.status !=
                                        QcDispositionStatus.CANCELLED
                        )
                        .map(disposition ->
                                disposition.dispositionQty
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal outstandingRejected =
                inspection.rejectedQty
                        .subtract(
                                alreadyDisposed
                        );

        BigDecimal quantity =
                positive(
                        request.quantity(),
                        "Disposition quantity"
                );

        if (
                quantity.compareTo(
                        outstandingRejected
                ) > 0
        ) {
            throw conflict(
                    "Disposition quantity exceeds outstanding rejected quantity"
            );
        }

        MatFlowTransferLine sourceTransferLine =
                transferLineRepository
                        .findById(
                                inspection.sourceLineId
                        )
                        .orElseThrow(() ->
                                notFound(
                                        "Source transfer line not found"
                                )
                        );

        MatFlowTransferOrder sourceTransfer =
                sourceTransferLine.transferOrder;

        MatFlowStockBalance qcBalance =
                stockRepository
                        .lockBalance(
                                inspection.material
                                        .getId(),
                                inspection.location
                                        .getId()
                        )
                        .orElseThrow(() ->
                                conflict(
                                        "Rejected QC stock balance not found"
                                )
                        );

        if (
                qcBalance.blockedQty
                        .compareTo(quantity) < 0
        ) {
            throw conflict(
                    "Rejected blocked quantity is no longer available"
            );
        }

        String actor =
                accessService.actor();

        MatFlowQcDisposition disposition =
                new MatFlowQcDisposition();

        disposition.dispositionNumber =
                generateNumber("MFD");

        disposition.qcInspection =
                inspection;

        disposition.dispositionType =
                request.dispositionType();

        disposition.dispositionQty =
                quantity;

        disposition.decidedBy = actor;

        disposition.decidedAt =
                LocalDateTime.now();

        disposition.remarks =
                clean(request.remarks());

        disposition.setCreatedBy(actor);
        disposition.setUpdatedBy(actor);

        if (
                request.dispositionType() ==
                        QcDispositionType.HOLD
        ) {
            disposition.status =
                    QcDispositionStatus.OPEN;

            return toResponse(
                    dispositionRepository.save(
                            disposition
                    )
            );
        }

        if (
                request.dispositionType() ==
                        QcDispositionType.SCRAP
        ) {
            if (
                    qcBalance.onHandQty
                            .compareTo(quantity) < 0
            ) {
                throw conflict(
                        "Rejected physical stock is insufficient"
                );
            }

            qcBalance.onHandQty =
                    scale(
                            qcBalance.onHandQty
                                    .subtract(quantity)
                    );

            qcBalance.blockedQty =
                    scale(
                            qcBalance.blockedQty
                                    .subtract(quantity)
                    );

            qcBalance.setUpdatedBy(actor);

            qcBalance =
                    stockRepository.save(
                            qcBalance
                    );

            disposition.status =
                    QcDispositionStatus.COMPLETED;

            disposition =
                    dispositionRepository.save(
                            disposition
                    );

            saveLedger(
                    qcBalance,
                    MovementType.SCRAP,

                    quantity.negate(),
                    BigDecimal.ZERO,
                    quantity.negate(),

                    disposition,
                    actor
            );

            return toResponse(disposition);
        }

        MatFlowLocation targetLocation =
                resolveTargetLocation(
                        request,
                        sourceTransfer
                );

        qcBalance.blockedQty =
                scale(
                        qcBalance.blockedQty
                                .subtract(quantity)
                );

        qcBalance.reservedQty =
                scale(
                        qcBalance.reservedQty
                                .add(quantity)
                );

        qcBalance.setUpdatedBy(actor);

        qcBalance =
                stockRepository.save(qcBalance);

        MatFlowRequisitionLine requisitionLine =
                sourceTransfer.reservation
                        .requisitionLine;

        MatFlowReservation reservation =
                new MatFlowReservation();

        reservation.requisitionLine =
                requisitionLine;

        reservation.material =
                inspection.material;

        reservation.sourceLocation =
                inspection.location;

        reservation.firstDestinationLocation =
                targetLocation;

        reservation.demandPlantCode =
                requisitionLine.requisition
                        .destinationLocation
                        .plantCode;

        reservation.reservedQty =
                quantity;

        reservation.status =
                ReservationStatus.ACTIVE;

        reservation.routeSnapshotJson =
                "[]";

        reservation.setCreatedBy(actor);
        reservation.setUpdatedBy(actor);

        reservation =
                reservationRepository.save(
                        reservation
                );

        requisitionLine.reservedQty =
                scale(
                        requisitionLine.reservedQty
                                .add(quantity)
                );

        requisitionLine.shortageQty =
                scale(
                        requisitionLine.shortageQty
                                .subtract(quantity)
                                .max(BigDecimal.ZERO)
                );

        requisitionLine.setUpdatedBy(actor);

        requisitionLineRepository.save(
                requisitionLine
        );

        MatFlowTransferOrder transfer =
                new MatFlowTransferOrder();

        transfer.transferNumber =
                generateNumber("MFT");

        transfer.requisition =
                requisitionLine.requisition;

        transfer.reservation =
                reservation;

        transfer.fromLocation =
                inspection.location;

        transfer.toLocation =
                targetLocation;

        transfer.routeSequenceNo =
                9000;

        transfer.predecessorTransferId =
                null;

        transfer.purpose =
                request.dispositionType() ==
                        QcDispositionType.REWORK
                        ? TransferPurpose.QC_TO_REWORK
                        : TransferPurpose.RETURN_TO_SOURCE;

        transfer.status =
                TransferStatus.READY;

        transfer.remarks =
                "Generated from QC rejected-material disposition";

        transfer.setCreatedBy(actor);
        transfer.setUpdatedBy(actor);

        transfer =
                transferRepository.save(transfer);

        MatFlowTransferLine transferLine =
                new MatFlowTransferLine();

        transferLine.transferOrder =
                transfer;

        transferLine.material =
                inspection.material;

        transferLine.plannedQty =
                quantity;

        transferLine.dispatchedQty =
                BigDecimal.ZERO;

        transferLine.receivedQty =
                BigDecimal.ZERO;

        transferLine.uom =
                inspection.material.getUom();

        transferLine.setCreatedBy(actor);
        transferLine.setUpdatedBy(actor);

        transferLineRepository.save(
                transferLine
        );

        disposition.targetLocation =
                targetLocation;

        disposition.generatedReservation =
                reservation;

        disposition.generatedTransfer =
                transfer;

        disposition.status =
                QcDispositionStatus.TRANSFER_CREATED;

        disposition =
                dispositionRepository.save(
                        disposition
                );

        saveLedger(
                qcBalance,
                MovementType.QC_REWORK_RELEASE,

                BigDecimal.ZERO,
                quantity,
                quantity.negate(),

                disposition,
                actor
        );

        return toResponse(disposition);
    }

    private MatFlowLocation resolveTargetLocation(
            QcDispositionRequest request,
            MatFlowTransferOrder sourceTransfer
    ) {
        if (
                request.dispositionType() ==
                        QcDispositionType.RETURN_TO_SOURCE
        ) {
            return sourceTransfer.fromLocation;
        }

        if (request.targetLocationId() == null) {
            throw badRequest(
                    "Target processing location is required for rework"
            );
        }

        MatFlowLocation target =
                locationRepository
                        .findById(
                                request.targetLocationId()
                        )
                        .orElseThrow(() ->
                                notFound(
                                        "Target location not found"
                                )
                        );

        accessService.requirePlantAccess(
                target.plantCode
        );

        boolean processingLocation =
                target.locationType ==
                        MatFlowPlanningTypes.LocationType.PROCESSING ||
                target.locationType ==
                        MatFlowPlanningTypes.LocationType.EXTERNAL_PROCESSOR;

        if (!processingLocation) {
            throw badRequest(
                    "Rework target must be a processing location"
            );
        }

        return target;
    }

    private QcDispositionResponse toResponse(
            MatFlowQcDisposition disposition
    ) {
        return new QcDispositionResponse(
                disposition.getId(),
                disposition.dispositionNumber,
                disposition.qcInspection
                        .getId(),
                disposition.dispositionType,
                disposition.status,

                disposition.targetLocation == null
                        ? null
                        : disposition.targetLocation
                        .getId(),

                disposition.targetLocation == null
                        ? null
                        : disposition.targetLocation
                        .locationCode,

                disposition.dispositionQty,

                disposition.generatedReservation == null
                        ? null
                        : disposition.generatedReservation
                        .getId(),

                disposition.generatedTransfer == null
                        ? null
                        : disposition.generatedTransfer
                        .getId(),

                disposition.decidedBy,
                disposition.decidedAt,
                disposition.remarks,
                disposition.getRowVersion()
        );
    }

    private void saveLedger(
            MatFlowStockBalance balance,
            MovementType movementType,
            BigDecimal quantityChange,
            BigDecimal reservedChange,
            BigDecimal blockedChange,
            MatFlowQcDisposition disposition,
            String actor
    ) {
        MatFlowStockLedger ledger =
                new MatFlowStockLedger();

        ledger.material =
                balance.material;

        ledger.location =
                balance.location;

        ledger.movementType =
                movementType;

        ledger.quantityChange =
                scale(quantityChange);

        ledger.reservedChange =
                scale(reservedChange);

        ledger.blockedChange =
                scale(blockedChange);

        ledger.inTransitChange =
                BigDecimal.ZERO;

        ledger.onHandAfter =
                balance.onHandQty;

        ledger.reservedAfter =
                balance.reservedQty;

        ledger.blockedAfter =
                balance.blockedQty;

        ledger.inTransitAfter =
                balance.inTransitQty;

        ledger.referenceType =
                "MATFLOW_QC_DISPOSITION";

        ledger.referenceId =
                disposition.getId();

        ledger.referenceNumber =
                disposition.dispositionNumber;

        ledger.actor = actor;

        ledgerRepository.save(ledger);
    }

    private BigDecimal positive(
            BigDecimal value,
            String field
    ) {
        BigDecimal result =
                scale(value);

        if (
                result.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            throw badRequest(
                    field +
                            " must be greater than zero"
            );
        }

        return result;
    }

    private BigDecimal scale(
            BigDecimal value
    ) {
        return value == null
                ? BigDecimal.ZERO
                : value.setScale(
                        3,
                        RoundingMode.HALF_UP
                );
    }

    private String generateNumber(
            String prefix
    ) {
        return prefix +
                "-" +
                LocalDate.now().getYear() +
                "-" +
                UUID.randomUUID()
                        .toString()
                        .replace("-", "")
                        .substring(0, 8)
                        .toUpperCase();
    }

    private void assertVersion(
            Long requested,
            Long current
    ) {
        if (requested == null) {
            throw badRequest(
                    "QC inspection rowVersion is required"
            );
        }

        if (!requested.equals(current)) {
            throw conflict(
                    "QC inspection was modified by another user"
            );
        }
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

    private ResponseStatusException badRequest(
            String message
    ) {
        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                message
        );
    }

    private ResponseStatusException conflict(
            String message
    ) {
        return new ResponseStatusException(
                HttpStatus.CONFLICT,
                message
        );
    }

    private ResponseStatusException notFound(
            String message
    ) {
        return new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                message
        );
    }
}