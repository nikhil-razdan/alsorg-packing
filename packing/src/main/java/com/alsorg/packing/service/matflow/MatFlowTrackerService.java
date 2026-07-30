package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowTrackerDtos.TrackerKpiResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowTrackerDtos.TrackerResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowTrackerDtos.TrackerRowResponse;

import com.alsorg.packing.domain.matflow.MatFlowIndent;
import com.alsorg.packing.domain.matflow.MatFlowLocation;
import com.alsorg.packing.domain.matflow.MatFlowMaterialRequisition;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionStatus;
import com.alsorg.packing.domain.matflow.MatFlowProjectDrawing;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionLine;
import com.alsorg.packing.domain.matflow.MatFlowReservation;
import com.alsorg.packing.domain.matflow.MatFlowTransferOrder;

import com.alsorg.packing.repository.matflow.MatFlowIndentRepository;
import com.alsorg.packing.repository.matflow.MatFlowMaterialRequisitionRepository;
import com.alsorg.packing.repository.matflow.MatFlowRequisitionLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowReservationRepository;
import com.alsorg.packing.repository.matflow.MatFlowTransferOrderRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;

import java.time.Duration;
import java.time.LocalDateTime;

import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MatFlowTrackerService {

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

    public MatFlowTrackerService(
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
                        !"CONSUMPTION_COMPLETE".equals(
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
                "PRODUCTION_ISSUE");

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

        if ("CANCELLED".equals(
                statusName)) {

            return "CANCELLED";
        }

        if (requestedQty.compareTo(
                BigDecimal.ZERO) > 0 &&
                consumedQty.compareTo(
                        requestedQty) >= 0) {

            return "CONSUMPTION_COMPLETE";
        }

        if (issuedQty.compareTo(
                BigDecimal.ZERO) > 0) {

            return "PRODUCTION_ISSUE";
        }

        if (openTransferCount > 0) {
            return "TRANSFER_IN_PROGRESS";
        }

        if (shortageQty.compareTo(
                BigDecimal.ZERO) > 0 ||
                "SHORTAGE_PENDING".equals(
                        statusName)) {

            return "SHORTAGE_PENDING";
        }

        if ("PLANNED".equals(
                statusName) ||
                reservedQty.compareTo(
                        BigDecimal.ZERO) > 0) {

            return "MATERIAL_RESERVED";
        }

        if ("SUBMITTED".equals(
                statusName)) {

            return "AWAITING_STORE_PLANNING";
        }

        if ("DRAFT".equals(
                statusName)) {

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
                    "CONSUMPTION_COMPLETE" ->
                "PRODUCTION";

            case "AWAITING_STORE_PLANNING",
                    "MATERIAL_RESERVED" ->
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
            case "PRODUCTION_ISSUE" -> 88;
            case "CONSUMPTION_COMPLETE" -> 100;
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