package com.alsorg.packing.controller.dto.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.IndentLineResponse;
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

        public record StoreStockOptionResponse(

                        UUID stockBalanceId,

                        UUID materialId,
                        String materialCode,
                        String materialName,

                        UUID locationId,
                        String locationCode,
                        String locationName,
                        String plantCode,
                        LocationType locationType,

                        BigDecimal onHandQty,
                        BigDecimal reservedQty,
                        BigDecimal blockedQty,
                        BigDecimal availableQty,

                        boolean firstRouteDestination,
                        boolean productionDestination,
                        boolean transferRequired) {
        }

        public record StoreLineAvailabilityResponse(
                        UUID requisitionLineId,
                        Integer lineNo,

                        UUID materialId,
                        String materialCode,
                        String materialName,
                        String materialCategory,
                        String uom,

                        BigDecimal requestedQty,
                        BigDecimal reservedQty,
                        BigDecimal shortageQty,

                        UUID firstDestinationLocationId,
                        String firstDestinationLocationCode,

                        String approvedRoute,

                        Boolean processingRequired,

                        UUID firstProcessingLocationId,
                        String firstProcessingLocationCode,

                        List<StoreApprovedRouteStepResponse> approvedRouteSteps,

                        List<StoreStockOptionResponse> stockOptions) {
        }

        public record StoreIssueRequest(

                        @NotNull(message = "Reservation row version is required.") Long rowVersion,

                        /*
                         * Null means issue the complete remaining quantity.
                         */
                        @DecimalMin(value = "0.001", inclusive = true, message = "Issue quantity must be greater than zero.") BigDecimal quantity,

                        @Size(max = 150, message = "Batch number cannot exceed 150 characters.") String batchNo,

                        @Size(max = 2000, message = "Issue remarks cannot exceed 2000 characters.") String remarks) {
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
                        Long rowVersion,

                        BigDecimal issuedQty,
                        BigDecimal remainingIssueQty,
                        boolean issueReady,

                        UUID issueLocationId,
                        String issueLocationCode,

                        String responsibleDepartment,
                        String nextAction) {
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

                        UUID requisitionId,
                        String requisitionNumber,

                        UUID projectDrawingId,
                        String projectCode,
                        String drawingNo,
                        String productName,
                        String clientName,

                        UUID bomId,
                        String bomNumber,
                        Integer bomRevisionNo,

                        UUID reservationId,
                        UUID requisitionLineId,

                        UUID fromLocationId,
                        String fromLocationCode,
                        String fromPlantCode,
                        LocationType fromLocationType,

                        UUID toLocationId,
                        String toLocationCode,
                        String toPlantCode,
                        LocationType toLocationType,

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

                        String responsibleDepartment,
                        String nextAction,

                        Long rowVersion) {
        }

        public record PlanningResponse(
                        RequisitionResponse requisition,
                        List<ReservationResponse> reservations,
                        List<IndentResponse> indents,
                        List<TransferResponse> transfers) {
        }

        public record TransferActionRequest(

                        @NotNull(message = "Row version is required.") Long rowVersion,

                        /*
                         * Quantity remains nullable because direct issue may
                         * default to the complete reservation quantity.
                         *
                         * Dispatch and receipt explicitly require it inside
                         * their service methods.
                         */
                        @DecimalMin(value = "0.001", inclusive = true, message = "Quantity must be greater than zero.") BigDecimal quantity,

                        @Size(max = 150, message = "Batch number cannot exceed 150 characters.") String batchNo,

                        @Size(max = 2000, message = "Remarks cannot exceed 2000 characters.") String remarks) {
        }

        public record StoreSourceAllocationRequest(

                        @NotNull(message = "Source location is required.") UUID sourceLocationId,

                        @NotNull(message = "Reserve quantity is required.") @DecimalMin(value = "0.001", inclusive = true, message = "Reserve quantity must be greater than zero.") BigDecimal reserveQty) {
        }

        public record StoreLineReviewRequest(

                        @NotNull(message = "Requisition line ID is required.") UUID requisitionLineId,

                        @NotNull(message = "Requisition line row version is required.") Long rowVersion,

                        /*
                         * Empty means no stock is being reserved for this line.
                         */
                        List<@Valid StoreSourceAllocationRequest> allocations,

                        /*
                         * The approved BOM route remains authoritative.
                         * These fields are retained for later processing UI.
                         */
                        Boolean processingRequired,

                        UUID processingLocationId,

                        @NotNull(message = "Shortage-indent decision is required.") Boolean createIndentForShortage,

                        @Size(max = 1000, message = "Line remarks cannot exceed 1000 characters.") String remarks) {
        }

        public record StoreReviewRequest(

                        @NotNull(message = "Requisition row version is required.") Long rowVersion,

                        @NotEmpty(message = "At least one Store review line is required.") List<@Valid StoreLineReviewRequest> lines,

                        @Size(max = 2000, message = "Store review remarks cannot exceed 2000 characters.") String remarks) {
        }

        public record StoreApprovedRouteStepResponse(
                        UUID routeStepId,
                        Integer sequenceNo,
                        RouteStepType stepType,
                        UUID locationId,
                        String locationCode,
                        String locationName,
                        String plantCode,
                        LocationType locationType,
                        String processCode) {
        }

        public record StockOptionResponse(

                        UUID materialId,

                        UUID locationId,
                        String locationCode,
                        String locationName,
                        String plantCode,
                        LocationType locationType,

                        BigDecimal onHandQty,
                        BigDecimal reservedQty,
                        BigDecimal blockedQty,
                        BigDecimal availableQty,

                        boolean sameAsProductionDestination,
                        boolean transferRequired) {
        }

        public record StoreLinePlanningResponse(

                        RequisitionLineResponse requisitionLine,

                        List<StockOptionResponse> stockOptions,

                        List<ReservationResponse> reservations,

                        List<TransferResponse> transfers,

                        List<IndentLineResponse> indentLines) {
        }

        public record StorePlanningResponse(

                        RequisitionResponse requisition,

                        List<StoreLinePlanningResponse> lines,

                        List<IndentResponse> indents) {
        }
}