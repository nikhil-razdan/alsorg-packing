package com.alsorg.packing.controller.dto;

import com.alsorg.packing.domain.venflow.VenFlowAllocationStatus;
import com.alsorg.packing.domain.venflow.VenFlowIssueStatus;
import com.alsorg.packing.domain.venflow.VenFlowMaterialSource;
import com.alsorg.packing.domain.venflow.VenFlowPoStatus;
import com.alsorg.packing.domain.venflow.VenFlowProcessingStatus;
import com.alsorg.packing.domain.venflow.VenFlowQcStatus;
import com.alsorg.packing.domain.venflow.VenFlowStage;
import com.alsorg.packing.domain.venflow.VenFlowStockDecision;
import com.alsorg.packing.domain.venflow.VenFlowStoreStatus;
import com.alsorg.packing.domain.venflow.VenFlowUnit;
import java.util.List;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public final class VenFlowDtos {

        private VenFlowDtos() {
        }

        /*
         * =========================================================
         * NEW MAIN FLOW DTOs
         * Engineering BOM / Indent → Store → Purchase / Inventory
         * → GRN / QC → Issue → Processing → Supervisor Closure
         * =========================================================
         */

        public record CreateRequest(
                        String plantCode,
                        LocalDate orderDate,
                        String pdNo,
                        String drawingNo,
                        String clientName,
                        String materialName,
                        String veneerType,
                        String thickness,
                        String size,
                        BigDecimal requiredQty,
                        VenFlowUnit unit,
                        String bomReference,
                        String bomAttachmentUrl,
                        String sampleImageUrl,
                        String remarks) {
        }

        public record MaterialMovementResponse(
                        UUID id,
                        UUID entryId,
                        UUID allocationId,

                        String movementType,
                        BigDecimal quantity,

                        String referenceNo,
                        String description,
                        String remarks,

                        String performedBy,
                        LocalDateTime createdAt) {
        }

        public record StoreReviewRequest(
                        VenFlowStockDecision stockDecision,
                        BigDecimal availableQty,
                        String remarks) {
        }

        public record StoreDecisionRequest(
                        BigDecimal availableQty,
                        String purchaseRequestNo,
                        LocalDate requisitionDate,
                        String remarks,
                        Boolean hold,
                        Long rowVersion) {
        }

        public record ReserveMaterialRequest(
                        BigDecimal reservedQty,
                        String remarks) {
        }

        public record PurchaseRequestRequest(
                        String purchaseRequestNo,
                        LocalDate requisitionDate,
                        String remarks) {
        }

        public record PoRequest(
                        String vendorName,
                        String poNo,
                        LocalDate poDate,
                        BigDecimal orderedQty,
                        BigDecimal poAmount,
                        String poDocumentUrl,
                        String remarks,
                        Long rowVersion) {
        }

        public record VendorOrderRequest(
                        String vendorOrderReference,
                        String vendorAcknowledgementNo,
                        LocalDate vendorExpectedDate,
                        String remarks) {
        }

        public record DirectorDecisionRequest(
                        String remarks,
                        Long rowVersion) {
        }

        public record MaterialReceivedRequest(
                        BigDecimal receivedQty,
                        LocalDate actualInHouseDate,
                        String remarks) {
        }

        public record GrnRequest(
                        String grnNo,
                        LocalDate grnDate,
                        String remarks) {
        }

        public record QcRequest(
                        VenFlowQcStatus qcStatus,
                        String qcRemarks,
                        String rejectionReason) {
        }

        public record QcInspectionRequest(
                        BigDecimal inspectedQty,
                        BigDecimal acceptedQty,
                        BigDecimal rejectedQty,
                        BigDecimal holdQty,

                        Boolean sampleCompared,
                        Boolean grainMatch,
                        Boolean shadeMatch,
                        Boolean thicknessOk,
                        Boolean sizeOk,
                        Boolean surfaceConditionOk,

                        String qcRemarks,
                        String rejectionReason,

                        List<String> evidenceUrls,
                        Long allocationVersion) {
        }

        public record MaterialAllocationResponse(
                        UUID id,
                        VenFlowMaterialSource sourceType,
                        VenFlowAllocationStatus status,

                        BigDecimal plannedQty,
                        BigDecimal receivedQty,

                        BigDecimal qcInspectedQty,
                        BigDecimal qcAcceptedQty,
                        BigDecimal qcRejectedQty,
                        BigDecimal qcHoldQty,
                        BigDecimal qcPendingQty,

                        BigDecimal issuedQty,
                        BigDecimal issueReadyQty,

                        String purchaseRequestNo,
                        LocalDate requisitionDate,
                        Long rowVersion) {
        }

        public record MaterialSummaryResponse(
                        UUID entryId,

                        BigDecimal requiredQty,
                        BigDecimal storeAvailableQty,
                        BigDecimal toBeOrderedQty,

                        BigDecimal orderedQty,
                        BigDecimal purchasedReceivedQty,
                        BigDecimal vendorOutstandingQty,

                        BigDecimal qcPendingQty,
                        BigDecimal qcAcceptedQty,
                        BigDecimal qcRejectedQty,
                        BigDecimal qcHoldQty,

                        BigDecimal issuedQty,
                        BigDecimal issueReadyQty,

                        BigDecimal finalRequirementGap,

                        BigDecimal usedQty,
                        BigDecimal wastageQty,
                        BigDecimal processingBalanceQty,

                        int storeCoveragePercent,

                        java.util.List<String> activeDepartments,

                        java.util.List<MaterialAllocationResponse> allocations) {
        }

        public record ProductionDetailsRequest(
                        String productionDetails,
                        String supervisorName,
                        String remarks) {
        }

        public record IssueMaterialRequest(
                        BigDecimal issuedQty,
                        String issuedTo,
                        String remarks) {
        }

        public record ProcessingRequest(
                        BigDecimal usedQty,
                        BigDecimal wastageQty,
                        BigDecimal processingBalanceQty,
                        String outputImageUrl,
                        String remarks) {
        }

        /*
         * Optional status update DTOs if later needed directly.
         */
        public record IssueStatusRequest(
                        VenFlowIssueStatus issueStatus) {
        }

        public record ProcessingStatusRequest(
                        VenFlowProcessingStatus processingStatus) {
        }

        public record DirectorDashboardResponse(
                        long totalActiveItems,
                        long pendingPoApprovals,
                        long approvalSlaBreaches,
                        long approvedAwaitingVendorOrder,
                        long openVendorOrders,
                        long vendorDeliveryDelayed,
                        long storeReceivingPending,
                        long qcHoldOrReturn,
                        long productionInProgress,
                        long supervisorClosurePending,
                        long readyForNextStage,
                        BigDecimal pendingApprovalAmount,
                        double averageApprovalHours,
                        double averageOverallCycleHours) {
        }

        public record DirectorTrackerRow(
                        UUID id,
                        String pdNo,
                        String drawingNo,
                        String clientName,
                        String materialName,
                        String veneerType,
                        String plantCode,
                        BigDecimal requiredQty,
                        String unit,
                        VenFlowStage stage,
                        String currentDepartment,
                        LocalDateTime stageEnteredAt,
                        long minutesInCurrentStage,
                        long totalCycleMinutes,
                        LocalDate expectedDate,
                        LocalDate vendorExpectedDate,
                        VenFlowPoStatus poStatus,
                        String poNo,
                        String vendorName,
                        BigDecimal poAmount,
                        String priority,
                        boolean delayed,
                        boolean stageSlaBreached) {
        }

        /*
         * =========================================================
         * LEGACY DTOs
         * Keep these temporarily because old controller/service endpoints
         * still reference them.
         * =========================================================
         */

        public record ProductDetailsRequest(
                        String productDescription,
                        String veneerType,
                        String size) {
        }

        public record StoreStatusRequest(
                        VenFlowStoreStatus storeStatus) {
        }

        public record RequisitionRequest(
                        String requisitionSlipNo,
                        LocalDate requisitionDate) {
        }

        public record OrderedQtyRequest(
                        BigDecimal orderedQty,
                        VenFlowUnit unit) {
        }

        public record ExpectedDateRequest(
                        LocalDate expectedDate) {
        }

        public record ReceivedQtyRequest(
                        BigDecimal receivedQty,
                        LocalDate actualInHouseDate) {
        }

        public record ProductionActionRequest(
                        String remarks) {
        }

        public record RemarksRequest(
                        String remarks) {
        }

        /*
         * =========================================================
         * DASHBOARD / REPORTS
         * =========================================================
         */

        public record DashboardResponse(
                        long totalEntries,

                        long pendingStoreCheck,
                        long pendingRequisition,
                        long pendingOrderQty,
                        long pendingReceiving,
                        long balancePending,
                        long delayedItems,
                        long completedEntries,

                        long sentToPurchase,
                        long pendingPoRaise,
                        long pendingPoApproval,
                        long pendingMaterialReceiving,
                        long materialReceivedNotInformed,
                        long productionNotStarted,
                        long productionStarted,
                        long jobDone,
                        long totalPendingWorkLoading) {
        }

        public record ReportSummaryResponse(
                        long totalOrders,
                        long pendingStoreCheck,
                        long sentToPurchase,
                        long pendingPoRaise,
                        long pendingPoApproval,
                        long pendingMaterialReceiving,
                        long materialReceivedNotInformed,
                        long productionNotStarted,
                        long productionStarted,
                        long jobDone,
                        long delayedItems,
                        long totalPendingWorkLoading) {
        }
}