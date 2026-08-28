package com.alsorg.packing.controller.dto.matflow;

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
 * Production wastage is recorded against the MR and its exact requesting
 * Production user/plant. No Production Location is submitted by the client.
 */
public final class MatFlowProductionWasteDtos {
        private MatFlowProductionWasteDtos() {
        }

        public record ProductionWasteLineRequest(
                        @NotNull(message = "Requisition material line is required.") UUID requisitionLineId,
                        @NotNull(message = "Wastage quantity is required.")
                        @DecimalMin(value = "0.001", inclusive = true, message = "Wastage quantity must be greater than zero.")
                        BigDecimal wastedQty,
                        @Size(max = 150, message = "Batch number cannot exceed 150 characters.") String batchNo,
                        @Size(max = 1000, message = "Line remarks cannot exceed 1000 characters.") String remarks) {
        }

        public record ProductionWasteRequest(
                        @NotNull(message = "Requisition is required.") UUID requisitionId,
                        @Size(max = 2000, message = "Remarks cannot exceed 2000 characters.") String remarks,
                        @NotEmpty(message = "At least one wastage line is required.")
                        @Size(max = 500, message = "A maximum of 500 wastage lines is allowed.")
                        List<@Valid ProductionWasteLineRequest> lines) {
        }

        public record ProductionWasteLineResponse(
                        UUID requisitionLineId,
                        UUID materialId,
                        String materialCode,
                        String materialName,
                        BigDecimal wastedQty,
                        String uom,
                        String batchNo) {
        }

        public record ProductionWasteResponse(
                        UUID requisitionId,
                        String requisitionNumber,
                        String plantCode,
                        String recordedBy,
                        LocalDateTime recordedAt,
                        String remarks,
                        List<ProductionWasteLineResponse> lines) {
        }
}
