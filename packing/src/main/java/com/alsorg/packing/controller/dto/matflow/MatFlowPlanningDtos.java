package com.alsorg.packing.controller.dto.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * MatFlow planning/execution API contracts.
 *
 * The public workflow is deliberately small: Production raises an MR, Store
 * allocates Store stock and decides QC vs direct Production, Store creates a PI
 * for shortage, and all transfer rows remain internal custody history.
 */
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

    /** Optional Processing capability approved on a BOM material line. */
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
            @NotNull(message = "Requested quantity is required.")
            @DecimalMin(value = "0.001", inclusive = true, message = "Requested quantity must be greater than zero.") BigDecimal requestedQty,
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

    /** Approved Processing Units Store may optionally select for an allocated MR lot. */
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
            UUID productionDestinationLocationId,
            String productionDestinationLocationCode,
            List<StoreApprovedRouteStepResponse> processingOptions,
            List<StoreStockOptionResponse> stockOptions) {
    }

    /** Store Issue/Send always advances the complete reservation lot. */
    public record StoreIssueRequest(
            @NotNull(message = "Reservation row version is required.") Long rowVersion,
            @DecimalMin(value = "0.001", inclusive = true, message = "Issue quantity must be greater than zero.") BigDecimal quantity,
            @Size(max = 150, message = "Batch number cannot exceed 150 characters.") String batchNo,
            @Size(max = 2000, message = "Issue remarks cannot exceed 2000 characters.") String remarks) {
    }

    public record RequisitionCreateRequest(
            @NotNull(message = "Project product ID is required.") UUID projectDrawingId,
            @NotNull(message = "Operational BOM ID is required.") UUID bomId,
            @NotNull(message = "Production destination location is required.") UUID destinationLocationId,
            @Size(max = 2000, message = "Requisition remarks cannot exceed 2000 characters.") String remarks,
            @NotEmpty(message = "At least one material line is required.") List<@Valid RequisitionLineRequest> lines) {
    }

    public record RequisitionActionRequest(
            @NotNull(message = "Requisition row version is required.") Long rowVersion,
            @Size(max = 2000, message = "Action remarks cannot exceed 2000 characters.") String remarks) {
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
            RequisitionLineStatus status,
            String remarks,
            Long rowVersion) {
    }

    /**
     * MR response intentionally has no Production partial-availability decision.
     * Available lots may proceed while a Store-raised PI closes the shortage.
     */
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
            String nextAction,
            boolean qcRequired,
            boolean qcCompleted,
            boolean processingRequired,
            UUID processingRouteStepId,
            String processingLocationCode) {
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

    /** Every PI is linked to its MR through the Indent aggregate. */
    public record IndentResponse(
            UUID id,
            String indentNumber,
            UUID requisitionId,
            String requisitionNumber,
            UUID projectDrawingId,
            String projectCode,
            String drawingNo,
            String productName,
            String clientName,
            UUID deliverToLocationId,
            String deliverToLocationCode,
            String deliverToPlantCode,
            IndentStatus status,
            boolean storeRaised,
            Long rowVersion,
            List<IndentLineResponse> lines) {
    }

    /**
     * Internal custody history only. There is intentionally no public Transfers
     * desk/controller in the normal MatFlow workflow.
     */
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

    /** Internal movement command used only by MatFlow service orchestration. */
    public record TransferActionRequest(
            @NotNull(message = "Row version is required.") Long rowVersion,
            @DecimalMin(value = "0.001", inclusive = true, message = "Quantity must be greater than zero.") BigDecimal quantity,
            @Size(max = 150, message = "Batch number cannot exceed 150 characters.") String batchNo,
            @Size(max = 2000, message = "Remarks cannot exceed 2000 characters.") String remarks) {
    }

    public record StoreSourceAllocationRequest(
            @NotNull(message = "Source location is required.") UUID sourceLocationId,
            @NotNull(message = "Reserve quantity is required.")
            @DecimalMin(value = "0.001", inclusive = true, message = "Reserve quantity must be greater than zero.") BigDecimal reserveQty) {
    }

    /**
     * Store owns two independent per-lot decisions:
     * 1) whether the allocated material requires a QC check; and
     * 2) whether the material must visit one approved Processing Unit before Production.
     *
     * QC has no location and does not choose the route. processingRouteStepId is
     * required only when processingRequired=true and must identify one PROCESSING
     * option approved on the Product BOM material line.
     */
    public record StoreLineReviewRequest(
            @NotNull(message = "Requisition line ID is required.") UUID requisitionLineId,
            @NotNull(message = "Requisition line row version is required.") Long rowVersion,
            List<@Valid StoreSourceAllocationRequest> allocations,
            @NotNull(message = "QC decision is required for each allocated material line.") Boolean qcRequired,
            @NotNull(message = "Processing decision is required for each allocated material line.") Boolean processingRequired,
            UUID processingRouteStepId,
            @NotNull(message = "Shortage-indent decision is required.") Boolean createIndentForShortage,
            UUID indentDeliveryLocationId,
            @Size(max = 1000, message = "Line remarks cannot exceed 1000 characters.") String remarks) {
    }

    /** Store may review the same MR again after a GRN adds stock. */
    public record StoreReviewRequest(
            @NotNull(message = "Requisition row version is required.") Long rowVersion,
            @NotEmpty(message = "At least one Store review line is required.") List<@Valid StoreLineReviewRequest> lines,
            @Size(max = 2000, message = "Store review remarks cannot exceed 2000 characters.") String remarks) {
    }

    /* Compatibility read models retained for existing Store UI composition. */
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
