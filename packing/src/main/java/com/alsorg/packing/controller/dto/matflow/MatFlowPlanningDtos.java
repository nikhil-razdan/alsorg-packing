package com.alsorg.packing.controller.dto.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.IndentStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.LocationType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.OwnershipType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ReservationStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RouteStepType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.TransferPurpose;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.TransferStatus;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class MatFlowPlanningDtos {

        private MatFlowPlanningDtos() {
        }

        public record LocationRequest(
                        String locationCode,
                        String locationName,
                        String plantCode,
                        LocationType locationType,
                        OwnershipType ownershipType,
                        Boolean supportsStock,
                        String address,
                        String contactPerson,
                        String contactPhone,
                        Boolean active,
                        Long rowVersion) {
        }

        public record LocationResponse(
                        UUID id,
                        String locationCode,
                        String locationName,
                        String plantCode,
                        LocationType locationType,
                        OwnershipType ownershipType,
                        boolean supportsStock,
                        String address,
                        String contactPerson,
                        String contactPhone,
                        boolean active,
                        Long rowVersion) {
        }

        public record RouteStepRequest(
                        Integer sequenceNo,
                        RouteStepType stepType,
                        UUID locationId,
                        String processCode,
                        BigDecimal expectedYieldPercent,
                        String remarks,
                        Long rowVersion) {
        }

        public record RouteStepResponse(
                        UUID id,
                        UUID bomId,
                        UUID bomLineId,
                        Integer bomLineNo,
                        Integer sequenceNo,
                        RouteStepType stepType,
                        UUID locationId,
                        String locationCode,
                        String locationName,
                        String plantCode,
                        LocationType locationType,
                        OwnershipType ownershipType,
                        String processCode,
                        BigDecimal expectedYieldPercent,
                        String remarks,
                        Long rowVersion) {
        }

        public record StockAdjustmentRequest(
                        UUID materialId,
                        UUID locationId,
                        BigDecimal adjustmentQty,
                        String batchNo,
                        String remarks,
                        Long rowVersion) {
        }

        public record StockBalanceResponse(
                        UUID id,
                        UUID materialId,
                        String materialCode,
                        String materialName,
                        String uom,
                        UUID locationId,
                        String locationCode,
                        String locationName,
                        String plantCode,
                        LocationType locationType,
                        BigDecimal onHandQty,
                        BigDecimal reservedQty,
                        BigDecimal blockedQty,
                        BigDecimal inTransitQty,
                        BigDecimal availableQty,
                        Long rowVersion) {
        }

        public record RequisitionLineRequest(

                        @NotNull(message = "BOM line ID is required.") UUID bomLineId,

                        @NotNull(message = "Requested quantity is required.") @DecimalMin(value = "0.001", inclusive = true, message = "Requested quantity must be greater than zero.") BigDecimal requestedQty,

                        @Size(max = 1000, message = "Line remarks cannot exceed 1000 characters.") String remarks) {
        }

        public record RequisitionCreateRequest(

                        @NotNull(message = "Project drawing ID is required.") UUID projectDrawingId,

                        @NotNull(message = "Operational BOM ID is required.") UUID bomId,

                        @NotNull(message = "Production destination location is required.") UUID destinationLocationId,

                        @Size(max = 2000, message = "Requisition remarks cannot exceed 2000 characters.") String remarks,

                        @NotEmpty(message = "At least one material line is required.") List<@Valid RequisitionLineRequest> lines) {
        }

        public record RequisitionActionRequest(

                        @NotNull(message = "Requisition row version is required.") Long rowVersion,

                        @Size(max = 2000, message = "Action remarks cannot exceed 2000 characters.") String remarks) {
        }

        public record PlanningRequest(

                        @NotNull(message = "Requisition row version is required.") Long rowVersion,

                        List<UUID> preferredSourceLocationIds,

                        @Size(max = 2000, message = "Planning remarks cannot exceed 2000 characters.") String remarks) {
        }

        public record RequisitionLineResponse(
                        UUID id,
                        Integer lineNo,
                        UUID bomLineId,

                        UUID materialId,
                        String materialCode,
                        String materialName,
                        String materialCategory,

                        UUID issuedMaterialId,
                        String issuedMaterialCode,
                        String issuedMaterialName,

                        String uom,

                        BigDecimal bomRequiredQty,
                        BigDecimal requestedQty,
                        BigDecimal reservedQty,
                        BigDecimal shortageQty,
                        BigDecimal issuedQty,
                        BigDecimal consumedQty,
                        BigDecimal returnedQty,

                        String remarks,
                        Long rowVersion) {
        }

        public record RequisitionResponse(
                        UUID id,
                        String requisitionNumber,

                        UUID projectDrawingId,
                        String projectCode,
                        String drawingNo,

                        UUID bomId,
                        String bomNumber,
                        Integer bomRevisionNo,

                        UUID destinationLocationId,
                        String destinationLocationCode,
                        String destinationLocationName,
                        String destinationPlantCode,

                        RequisitionStatus status,

                        String requestedBy,
                        LocalDateTime requestedAt,

                        String submittedBy,
                        LocalDateTime submittedAt,

                        String plannedBy,
                        LocalDateTime plannedAt,

                        String remarks,

                        String cancelledBy,
                        LocalDateTime cancelledAt,
                        String cancellationReason,

                        Long rowVersion,
                        List<RequisitionLineResponse> lines) {
        }

        public record ReservationResponse(
                        UUID id,
                        UUID requisitionLineId,
                        String materialCode,

                        UUID sourceLocationId,
                        String sourceLocationCode,
                        String sourcePlantCode,

                        UUID firstDestinationLocationId,
                        String firstDestinationLocationCode,

                        String demandPlantCode,
                        BigDecimal reservedQty,
                        ReservationStatus status,
                        Long rowVersion) {
        }

        public record IndentLineResponse(
                        UUID id,

                        UUID requisitionLineId,

                        UUID materialId,
                        String materialCode,
                        String materialName,

                        BigDecimal requiredQty,
                        BigDecimal orderedQty,
                        BigDecimal receivedQty,

                        String uom) {
        }

        public record IndentResponse(
                        UUID id,
                        String indentNumber,
                        UUID deliverToLocationId,
                        String deliverToLocationCode,
                        String deliverToPlantCode,
                        IndentStatus status,
                        boolean autoGenerated,
                        Long rowVersion,
                        List<IndentLineResponse> lines) {
        }

        public record TransferResponse(
                        UUID id,
                        String transferNumber,

                        UUID reservationId,
                        UUID requisitionLineId,

                        UUID fromLocationId,
                        String fromLocationCode,
                        String fromPlantCode,

                        UUID toLocationId,
                        String toLocationCode,
                        String toPlantCode,

                        Integer routeSequenceNo,
                        UUID predecessorTransferId,

                        TransferPurpose purpose,
                        TransferStatus status,

                        UUID materialId,
                        String materialCode,
                        String materialName,

                        BigDecimal plannedQty,
                        BigDecimal dispatchedQty,
                        BigDecimal receivedQty,

                        String uom,
                        Long rowVersion) {
        }

        public record PlanningResponse(
                        RequisitionResponse requisition,
                        List<ReservationResponse> reservations,
                        List<IndentResponse> indents,
                        List<TransferResponse> transfers) {
        }

        public record TransferActionRequest(
                        Long rowVersion,
                        BigDecimal quantity,
                        String batchNo,
                        String remarks) {
        }
}