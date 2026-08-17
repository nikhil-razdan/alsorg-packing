package com.alsorg.packing.controller.dto.matflow;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Material-centric read model expressed only in business workflow terms.
 *
 * Generic MatFlow Location/stock-position concepts are deliberately absent.
 * Tally remains the physical stock authority. MatFlow reports Project/Product
 * demand, declared allocation, shortage, procurement, QC, Processing,
 * inter-plant hand-off, Production usage/return and immutable movement history.
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
            long averageCurrentDwellMinutes,
            long longestCurrentDwellMinutes) {
    }

    /**
     * One business branch of this material inside one Project/Product MR.
     * BusinessPoint is a human label such as AL-P1 MAIN STORE, AL-P3 STORE,
     * a Processing Unit, IN TRANSIT or AL-P3 PRODUCTION. It is not a selectable
     * Location master record.
     */
    public record MaterialTrackerLot(
            String lotKey,
            String traceabilityLevel,
            UUID projectId,
            String projectCode,
            String projectName,
            String clientName,
            String plantCode,
            String productionUser,
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
            String currentPlantCode,
            String currentBusinessPoint,
            String movementState,
            LocalDateTime enteredCurrentStateAt,
            long currentDwellMinutes,
            long currentTargetMinutes,
            long currentVarianceMinutes,
            String timingHealth,
            String previousDepartment,
            String previousPlantCode,
            String previousBusinessPoint,
            String previousState,
            String nextDepartment,
            String nextPlantCode,
            String nextBusinessPoint,
            String nextAction,
            String activeReferenceType,
            UUID activeReferenceId,
            String activeReferenceNumber,
            boolean completed,
            boolean lineLevelPostIssueAggregation,
            List<MaterialCustodyEvent> history) {
    }

    /**
     * Historical workflow/custody event. The record name is retained for source
     * compatibility, but it contains no generic Location identifier or stock
     * balance fields.
     */
    public record MaterialCustodyEvent(
            int sequence,
            String eventType,
            String label,
            String department,
            String plantCode,
            String businessPoint,
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

    /**
     * Immutable MatFlow movement/usage audit event. This is not a physical stock
     * balance and intentionally excludes on-hand/available/blocked quantities.
     */
    public record MaterialLedgerEvent(
            UUID ledgerId,
            String movementType,
            String department,
            String plantCode,
            String businessPoint,
            BigDecimal quantityChange,
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
            List<MaterialTrackerLot> lots,
            List<MaterialLedgerEvent> movementHistory,
            LocalDateTime generatedAt) {
    }
}
