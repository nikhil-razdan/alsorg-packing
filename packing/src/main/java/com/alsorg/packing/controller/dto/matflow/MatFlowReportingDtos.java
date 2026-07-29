package com.alsorg.packing.controller.dto.matflow;

import com.alsorg.packing.domain.matflow.MatFlowBomStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MovementType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public final class MatFlowReportingDtos {

    private MatFlowReportingDtos() {
    }

    public record PageResponse<T>(
            List<T> content,
            int page,
            int size,
            long totalElements,
            int totalPages) {
    }

    public record PlantDashboardRow(
            String plantCode,

            long activeProjects,
            long effectiveBoms,

            long openRequisitions,
            long shortageRequisitions,

            long readyOutboundTransfers,
            long inTransitOutboundTransfers,
            long expectedInboundTransfers,

            long pendingQcInspections,
            long activeProcessingJobs,

            long openIndents,
            long openPurchaseOrders,

            long stockBalanceLines,
            long lowStockLines,
            long blockedStockLines,
            long inTransitStockLines) {
    }

    public record DashboardTotals(
            long activeProjects,
            long effectiveBoms,

            long openRequisitions,
            long shortageRequisitions,

            long readyOutboundTransfers,
            long inTransitOutboundTransfers,
            long expectedInboundTransfers,

            long pendingQcInspections,
            long activeProcessingJobs,

            long openIndents,
            long openPurchaseOrders,

            long stockBalanceLines,
            long lowStockLines,
            long blockedStockLines,
            long inTransitStockLines) {
    }

    public record DashboardResponse(
            LocalDateTime generatedAt,
            Set<String> plantCodes,
            DashboardTotals totals,
            List<PlantDashboardRow> plants) {
    }

    public record BomRevisionSummary(
            UUID id,
            String bomNumber,
            Integer revisionNo,
            MatFlowBomStatus status,
            boolean latestRevision,
            boolean effective,
            String submittedBy,
            LocalDateTime submittedAt,
            String approvedBy,
            LocalDateTime approvedAt) {
    }

    public record ProjectRequisitionSummary(
            UUID id,
            String requisitionNumber,
            RequisitionStatus status,

            String destinationLocationCode,
            String destinationPlantCode,

            int materialLineCount,
            int shortageLineCount,
            int fullyIssuedLineCount,
            int fullyAccountedLineCount,

            String requestedBy,
            LocalDateTime requestedAt,
            LocalDateTime plannedAt) {
    }

    public record ProjectTrackingResponse(
            UUID projectDrawingId,

            String projectCode,
            String projectName,
            String clientName,

            String drawingNo,
            String drawingRevision,
            String productName,
            String owningPlantCode,

            List<BomRevisionSummary> bomRevisions,
            List<ProjectRequisitionSummary> requisitions,

            long openIndentCount,
            long purchaseOrderCount,
            long goodsReceiptCount,
            long pendingQcCount,
            long activeTransferCount,
            long activeProcessingJobCount) {
    }

    public record ShortageAgeingRow(
            UUID requisitionId,
            String requisitionNumber,
            UUID requisitionLineId,

            String projectCode,
            String drawingNo,

            UUID materialId,
            String materialCode,
            String materialName,
            String uom,

            BigDecimal requestedQty,
            BigDecimal reservedQty,
            BigDecimal shortageQty,

            String destinationLocationCode,
            String destinationPlantCode,

            RequisitionStatus requisitionStatus,
            LocalDateTime ageingStartedAt,
            long ageDays) {
    }

    public record StockLedgerRow(
            UUID id,

            UUID materialId,
            String materialCode,
            String materialName,
            String uom,

            UUID locationId,
            String locationCode,
            String plantCode,

            MovementType movementType,

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

    public record AuditLogRow(
            UUID id,
            String entityType,
            UUID entityId,
            String action,
            String detailsJson,
            String actor,
            String plantCode,
            String projectCode,
            String drawingNo,
            LocalDateTime actionAt) {
    }
}