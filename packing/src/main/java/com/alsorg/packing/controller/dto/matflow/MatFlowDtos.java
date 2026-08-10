package com.alsorg.packing.controller.dto.matflow;

import com.alsorg.packing.domain.matflow.MatFlowApprovalAction;
import com.alsorg.packing.domain.matflow.MatFlowBomStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ProjectProductApprovalStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class MatFlowDtos {
        private MatFlowDtos() {
        }

        public record MaterialRequest(String materialCode, String materialName, String category,
                        String specification, String uom, String preferredSupplier, BigDecimal minimumStock,
                        BigDecimal reorderLevel, Boolean active, Long rowVersion) {
        }

        public record MaterialResponse(UUID id, String materialCode, String materialName, String category,
                        String specification, String uom, String preferredSupplier, BigDecimal minimumStock,
                        BigDecimal reorderLevel, boolean active, Long rowVersion, String createdBy,
                        LocalDateTime createdAt, String updatedBy, LocalDateTime updatedAt) {
        }

        public record ProjectDrawingRequest(String projectCode, String projectName, String clientName,
                        String drawingNo, String drawingRevision, String productName, String plantCode,
                        LocalDate requiredDate, String remarks, Boolean active, Long rowVersion) {
        }

        public record ProjectProductApprovalRequest(
                        @NotNull(message = "Project product row version is required.") Long rowVersion,
                        @Size(max = 2000, message = "Approval remarks cannot exceed 2000 characters.") String remarks) {
        }

        public record ProjectDrawingResponse(
                        UUID id,
                        String projectCode,
                        String projectName,
                        String clientName,
                        String drawingNo,
                        String drawingRevision,
                        String productName,
                        String plantCode,
                        LocalDate requiredDate,
                        String remarks,
                        boolean active,
                        ProjectProductApprovalStatus productApprovalStatus,
                        String productApprovedBy,
                        LocalDateTime productApprovedAt,
                        String productReturnedBy,
                        LocalDateTime productReturnedAt,
                        String productApprovalRemarks,
                        Long rowVersion,
                        String createdBy,
                        LocalDateTime createdAt,
                        String updatedBy,
                        LocalDateTime updatedAt) {
        }

        public record BomCreateRequest(UUID projectDrawingId, String remarks) {
        }

        public record BomUpdateRequest(UUID projectDrawingId, String remarks, Long rowVersion) {
        }

        public record BomLineRequest(UUID materialId, BigDecimal requiredQty, BigDecimal wastagePercent,
                        String remarks, Long rowVersion) {
        }

        public record BomActionRequest(Long rowVersion, String remarks) {
        }

        public record BomLineResponse(UUID id, Integer lineNo, UUID materialId, String materialCode,
                        String materialName, String materialCategorySnapshot, String specification, String uom,
                        BigDecimal requiredQty, BigDecimal wastagePercent, BigDecimal netRequiredQty,
                        String remarks, Long rowVersion) {
        }

        public record ApprovalHistoryResponse(UUID id, MatFlowApprovalAction action,
                        MatFlowBomStatus fromStatus, MatFlowBomStatus toStatus, String remarks,
                        String actionBy, LocalDateTime actionAt) {
        }

        public record BomSummaryResponse(UUID id, String bomNumber, UUID revisionGroupId,
                        Integer revisionNo, MatFlowBomStatus status, boolean latestRevision, boolean effective,
                        UUID projectDrawingId, String projectCode, String projectName, String drawingNo,
                        String drawingRevision, String productName, String clientName, String plantCode,
                        int lineCount,
                        String productionReviewedBy, LocalDateTime productionReviewedAt, String productionReviewRemarks,
                        Long rowVersion, String updatedBy, LocalDateTime updatedAt) {
        }

        public record BomDetailResponse(UUID id, String bomNumber, UUID revisionGroupId,
                        Integer revisionNo, MatFlowBomStatus status, boolean latestRevision, boolean effective,
                        ProjectDrawingResponse project, String remarks, String submittedBy, LocalDateTime submittedAt,
                        String productionReviewedBy, LocalDateTime productionReviewedAt, String productionReviewRemarks,
                        String approvedBy, LocalDateTime approvedAt, String returnedBy, LocalDateTime returnedAt,
                        String returnRemarks, Long rowVersion, String createdBy, LocalDateTime createdAt,
                        String updatedBy, LocalDateTime updatedAt, List<BomLineResponse> lines,
                        List<ApprovalHistoryResponse> history) {
        }
}
