package com.alsorg.packing.controller.dto.matflow;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Read-only DTO contract for the MatFlow material-centric control tower.
 *
 * <p>The tracker deliberately keeps physical execution owned by the existing
 * Store / Purchase / QC / Processing / Production services.  This contract is
 * only an executive read model over those source-of-truth records.</p>
 */
public final class MatFlowMaterialTrackerDtos {

    private MatFlowMaterialTrackerDtos() {
    }

    public record MaterialIdentity(
            UUID materialId,
            String materialCode,
            String materialName,
            String category,
            String specification,
            String uom,
            String preferredSupplier,
            boolean active) {
    }

    public record MaterialTrackerKpis(
            int projectCount,
            int productCount,
            int requisitionCount,
            int trackedLotCount,
            int liveLotCount,
            int delayedLotCount,
            BigDecimal requestedQty,
            BigDecimal reservedQty,
            BigDecimal shortageQty,
            BigDecimal issuedQty,
            BigDecimal consumedQty,
            BigDecimal returnedQty,
            BigDecimal onHandQty,
            BigDecimal availableQty,
            BigDecimal blockedQty,
            BigDecimal inTransitQty,
            long averageCurrentDwellMinutes,
            long longestCurrentDwellMinutes) {
    }

    public record MaterialStockPosition(
            UUID locationId,
            String locationCode,
            String locationName,
            String locationType,
            String plantCode,
            BigDecimal onHandQty,
            BigDecimal reservedQty,
            BigDecimal blockedQty,
            BigDecimal inTransitQty,
            BigDecimal availableQty,
            LocalDateTime updatedAt) {
    }

    /**
     * One material trace branch for one Product requisition line. A
     * reservation-backed row is a real reserved lot. A row with a null
     * reservationId can represent either the pre-allocation demand/Store-review
     * stage or the still-open purchase shortage branch.
     */
    public record MaterialTrackerLot(
            String lotKey,
            String traceabilityLevel,
            UUID projectId,
            String projectCode,
            String projectName,
            String clientName,
            String plantCode,
            UUID productId,
            String productName,
            String drawingNo,
            String drawingRevision,
            UUID bomId,
            String bomNumber,
            Integer bomRevision,
            UUID requisitionId,
            String requisitionNumber,
            String requisitionStatus,
            UUID requisitionLineId,
            UUID reservationId,
            String sourceBranch,
            UUID currentMaterialId,
            String currentMaterialCode,
            String currentMaterialName,
            String currentMaterialCategory,
            String uom,
            BigDecimal lineRequestedQty,
            BigDecimal lineReservedQty,
            BigDecimal lineShortageQty,
            BigDecimal lineIssuedQty,
            BigDecimal lineConsumedQty,
            BigDecimal lineReturnedQty,
            BigDecimal trackedQty,
            String currentStage,
            String currentDepartment,
            UUID currentLocationId,
            String currentLocationCode,
            String currentLocationName,
            String currentLocationType,
            String movementState,
            LocalDateTime enteredCurrentStateAt,
            long currentDwellMinutes,
            long currentTargetMinutes,
            long currentVarianceMinutes,
            String timingHealth,
            String previousDepartment,
            String previousLocationCode,
            String previousLocationName,
            String previousState,
            String nextDepartment,
            UUID nextLocationId,
            String nextLocationCode,
            String nextLocationName,
            String nextLocationType,
            String nextAction,
            String activeReferenceType,
            UUID activeReferenceId,
            String activeReferenceNumber,
            boolean completed,
            boolean lineLevelPostIssueAggregation,
            List<MaterialCustodyEvent> history) {
    }

    /**
     * A sequential material custody state. durationMinutes is computed from the
     * current event's enteredAt to the next event's enteredAt (or now when the
     * state is still current).
     */
    public record MaterialCustodyEvent(
            int sequence,
            String eventType,
            String label,
            String department,
            UUID locationId,
            String locationCode,
            String locationName,
            String locationType,
            String state,
            LocalDateTime enteredAt,
            LocalDateTime exitedAt,
            long durationMinutes,
            long targetMinutes,
            long varianceMinutes,
            String timingHealth,
            BigDecimal quantity,
            String actor,
            String referenceType,
            UUID referenceId,
            String referenceNumber,
            String scope,
            String note) {
    }

    public record MaterialLedgerEvent(
            UUID ledgerId,
            String movementType,
            UUID locationId,
            String locationCode,
            String locationName,
            String locationType,
            String plantCode,
            BigDecimal quantityChange,
            BigDecimal reservedChange,
            BigDecimal blockedChange,
            BigDecimal inTransitChange,
            BigDecimal onHandAfter,
            BigDecimal reservedAfter,
            BigDecimal blockedAfter,
            BigDecimal inTransitAfter,
            String referenceType,
            UUID referenceId,
            String referenceNumber,
            String projectCode,
            String drawingNo,
            String batchNo,
            String remarks,
            String actor,
            LocalDateTime actionAt) {
    }

    public record MaterialTrackerResponse(
            MaterialIdentity material,
            MaterialTrackerKpis kpis,
            List<MaterialStockPosition> inventory,
            List<MaterialTrackerLot> lots,
            List<MaterialLedgerEvent> movementHistory,
            LocalDateTime generatedAt) {
    }
}
