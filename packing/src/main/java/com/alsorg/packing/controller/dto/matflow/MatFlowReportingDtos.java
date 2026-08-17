package com.alsorg.packing.controller.dto.matflow;

import com.alsorg.packing.domain.matflow.MatFlowBomStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MovementType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionStatus;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Read-only reporting contracts expressed only in Plant / department / business
 * workflow terms. Generic Location and physical stock-balance fields are not
 * part of the public MatFlow reporting contract; Tally remains stock authority.
 */
public final class MatFlowReportingDtos {
        private MatFlowReportingDtos() {
        }

        public record PageResponse<T>(
                        List<T> rows,
                        int page,
                        int size,
                        long totalElements,
                        int totalPages) {
        }

        public record PlantDashboardRow(
                        String plantCode,
                        int activeProjects,
                        int effectiveBoms,
                        int openRequisitions,
                        int shortageRequisitions,
                        int readyToIssueRequisitions,
                        int materialInTransitRequisitions,
                        int pendingQcInspections,
                        int activeProcessingJobs,
                        int openIndents,
                        int openPurchaseOrders) {
        }

        /**
         * Aggregate totals are longs because ReportingModule sums per-plant integer
         * counters with a ToLongFunction. This avoids narrowing/overflow and matches
         * the service constructor call exactly.
         */
        public record DashboardTotals(
                        long activeProjects,
                        long effectiveBoms,
                        long openRequisitions,
                        long shortageRequisitions,
                        long readyToIssueRequisitions,
                        long materialInTransitRequisitions,
                        long pendingQcInspections,
                        long activeProcessingJobs,
                        long openIndents,
                        long openPurchaseOrders) {
        }

        public record DashboardResponse(
                        LocalDateTime generatedAt,
                        Set<String> plantCodes,
                        DashboardTotals totals,
                        List<PlantDashboardRow> plants) {
        }

        public record BomRevisionSummary(
                        UUID bomId,
                        String bomNumber,
                        Integer revisionNo,
                        MatFlowBomStatus status,
                        boolean latestRevision,
                        boolean effective,
                        String submittedBy,
                        LocalDateTime submittedAt,
                        String productionReviewedBy,
                        LocalDateTime productionReviewedAt) {
        }

        public record ProjectRequisitionSummary(
                        UUID requisitionId,
                        String requisitionNumber,
                        RequisitionStatus status,
                        String productionPlantCode,
                        String productionUser,
                        int lineCount,
                        int shortageLineCount,
                        int fullyIssuedLineCount,
                        int accountedLineCount,
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
                        String plantCode,
                        List<BomRevisionSummary> boms,
                        List<ProjectRequisitionSummary> requisitions,
                        long openIndents,
                        long purchaseOrders,
                        long goodsReceipts,
                        long pendingQcChecks,
                        long activeTransfers,
                        long activeProcessingJobs) {
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
                        String productionPlantCode,
                        String productionUser,
                        RequisitionStatus requisitionStatus,
                        LocalDateTime shortageStartedAt,
                        long ageDays) {
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

        /**
         * Technical class name retained for endpoint/source compatibility. The
         * payload is a Material Movement Audit row, not a stock-balance row.
         */
        public record StockLedgerRow(
                        UUID id,
                        UUID materialId,
                        String materialCode,
                        String materialName,
                        String uom,
                        String plantCode,
                        String department,
                        String businessPoint,
                        MovementType movementType,
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
}
