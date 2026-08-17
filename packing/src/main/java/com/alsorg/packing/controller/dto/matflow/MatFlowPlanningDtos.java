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
 * MatFlow planning/execution contracts.
 *
 * Business rule:
 * - MatFlow has no user-facing Location master or Location selector.
 * - Plant + requisition requester determine Store/Production routing.
 * - AL-P1 Store is the Main Store.
 * - AL-P2/3/4 route through their own Store before/after the Main Store.
 * - Processing Units are the only configurable physical routing master.
 *
 * Existing database custody rows may still use hidden technical routing nodes
 * internally, but those identifiers are intentionally not exposed by this API.
 */
public final class MatFlowPlanningDtos {
        private MatFlowPlanningDtos() {
        }

        /* =========================== PROCESSING =========================== */

        public record ProcessingUnitRequest(
                        @NotNull(message = "Processing Unit code is required.") String processingUnitCode,
                        @NotNull(message = "Processing Unit name is required.") String processingUnitName,
                        @NotNull(message = "Plant code is required.") String plantCode,
                        Boolean external,
                        String address,
                        String contactPerson,
                        String contactPhone,
                        Boolean active,
                        Long rowVersion) {
        }

        public record ProcessingUnitResponse(
                        UUID id,
                        String processingUnitCode,
                        String processingUnitName,
                        String plantCode,
                        boolean external,
                        String address,
                        String contactPerson,
                        String contactPhone,
                        boolean active,
                        Long rowVersion) {
        }

        public record RouteStepRequest(
                        Integer sequenceNo,
                        RouteStepType stepType,
                        @NotNull(message = "Processing Unit is required.") UUID processingUnitId,
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
                        UUID processingUnitId,
                        String processingUnitCode,
                        String processingUnitName,
                        String plantCode,
                        boolean external,
                        String processCode,
                        BigDecimal expectedYieldPercent,
                        String remarks,
                        Long rowVersion) {
        }

        /* ========================== REQUISITION =========================== */

        public record RequisitionLineRequest(
                        @NotNull(message = "BOM line ID is required.") UUID bomLineId,
                        @NotNull(message = "Requested quantity is required.") @DecimalMin(value = "0.001", inclusive = true, message = "Requested quantity must be greater than zero.") BigDecimal requestedQty,
                        @Size(max = 1000, message = "Line remarks cannot exceed 1000 characters.") String remarks) {
        }

        /**
         * One line = one material MR; multiple selected lines = subset MR;
         * all remaining BOM lines = full remaining BOM MR.
         */
        public record RequisitionCreateRequest(
                        @NotNull(message = "Project product ID is required.") UUID projectDrawingId,
                        @NotNull(message = "Operational BOM ID is required.") UUID bomId,
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
         * The Production recipient is the exact user who raised the MR (`requestedBy`)
         * and the Production plant is derived from the Product/BOM.
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
                        String productionPlantCode,
                        String originStorePlantCode,
                        String mainStorePlantCode,
                        RequisitionStatus status,
                        String requestedBy,
                        LocalDateTime requestedAt,
                        String submittedBy,
                        LocalDateTime submittedAt,
                        String forwardedToMainStoreBy,
                        LocalDateTime forwardedToMainStoreAt,
                        String forwardingRemarks,
                        String plannedBy,
                        LocalDateTime plannedAt,
                        String remarks,
                        String cancelledBy,
                        LocalDateTime cancelledAt,
                        String cancellationReason,
                        Long rowVersion,
                        List<RequisitionLineResponse> lines) {
        }

        /* ============================== STORE ============================== */

        public record StoreApprovedRouteStepResponse(
                        UUID routeStepId,
                        Integer sequenceNo,
                        RouteStepType stepType,
                        UUID processingUnitId,
                        String processingUnitCode,
                        String processingUnitName,
                        String plantCode,
                        boolean external,
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
                        String productionPlantCode,
                        String productionUser,
                        List<StoreApprovedRouteStepResponse> processingOptions) {
        }

        public record StoreForwardRequest(
                        @NotNull(message = "Requisition row version is required.") Long rowVersion,
                        @Size(max = 2000, message = "Forwarding remarks cannot exceed 2000 characters.") String remarks) {
        }

        public record StoreIssueRequest(
                        @NotNull(message = "Reservation row version is required.") Long rowVersion,
                        @DecimalMin(value = "0.001", inclusive = true, message = "Issue quantity must be greater than zero.") BigDecimal quantity,
                        @Size(max = 150, message = "Batch number cannot exceed 150 characters.") String batchNo,
                        @Size(max = 2000, message = "Issue remarks cannot exceed 2000 characters.") String remarks) {
        }

        public record StoreReceiveRequest(
                        @NotNull(message = "Reservation row version is required.") Long rowVersion,
                        @Size(max = 150, message = "Batch number cannot exceed 150 characters.") String batchNo,
                        @Size(max = 2000, message = "Receipt remarks cannot exceed 2000 characters.") String remarks) {
        }

        public record StoreLineReviewRequest(
                        @NotNull(message = "Requisition line ID is required.") UUID requisitionLineId,
                        @NotNull(message = "Requisition line row version is required.") Long rowVersion,
                        @NotNull(message = "Store availability decision is required.") StoreAvailabilityDecision availabilityDecision,
                        @DecimalMin(value = "0.001", inclusive = true, message = "Partial available quantity must be greater than zero.") BigDecimal availableQty,
                        @NotNull(message = "QC decision is required.") Boolean qcRequired,
                        @NotNull(message = "Processing decision is required.") Boolean processingRequired,
                        UUID processingRouteStepId,
                        @Size(max = 1000, message = "Line remarks cannot exceed 1000 characters.") String remarks) {
        }

        public record StoreReviewRequest(
                        @NotNull(message = "Requisition row version is required.") Long rowVersion,
                        @NotEmpty(message = "At least one Store review line is required.") List<@Valid StoreLineReviewRequest> lines,
                        @Size(max = 2000, message = "Store review remarks cannot exceed 2000 characters.") String remarks) {
        }

        /* =========================== EXECUTION ============================ */

        public record ReservationResponse(
                        UUID id,
                        UUID requisitionLineId,
                        String materialCode,
                        String sourceCustody,
                        String sourcePlantCode,
                        String firstDestinationCustody,
                        String firstDestinationPlantCode,
                        String demandPlantCode,
                        BigDecimal reservedQty,
                        ReservationStatus status,
                        Long rowVersion,
                        BigDecimal issuedQty,
                        BigDecimal remainingIssueQty,
                        boolean issueReady,
                        String issueFromCustody,
                        String issueFromPlantCode,
                        String responsibleDepartment,
                        String nextAction,
                        boolean qcRequired,
                        boolean qcCompleted,
                        boolean processingRequired,
                        UUID processingRouteStepId,
                        String processingUnitCode) {
        }

        /* =========================== PROCUREMENT ========================== */

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
                        UUID requisitionId,
                        String requisitionNumber,
                        UUID projectDrawingId,
                        String projectCode,
                        String drawingNo,
                        String productName,
                        String clientName,
                        String deliverToPlantCode,
                        IndentStatus status,
                        boolean storeRaised,
                        Long rowVersion,
                        List<IndentLineResponse> lines) {
        }

        /* ======================== INTERNAL CUSTODY TRACE =================== */

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
                        String fromCustody,
                        String fromPlantCode,
                        String toCustody,
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

        /** Internal service command; not a Location API. */
        public record TransferActionRequest(
                        @NotNull(message = "Row version is required.") Long rowVersion,
                        @DecimalMin(value = "0.001", inclusive = true, message = "Quantity must be greater than zero.") BigDecimal quantity,
                        @Size(max = 150, message = "Batch number cannot exceed 150 characters.") String batchNo,
                        @Size(max = 2000, message = "Remarks cannot exceed 2000 characters.") String remarks) {
        }
}
