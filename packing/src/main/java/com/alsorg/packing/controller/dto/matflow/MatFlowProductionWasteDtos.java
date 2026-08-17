package com.alsorg.packing.controller.dto.matflow;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

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
                        @NotNull UUID requisitionLineId,
                        @NotNull @DecimalMin(value = "0.001") BigDecimal wastedQty,
                        String batchNo,
                        String remarks) {
        }

        public record ProductionWasteRequest(
                        @NotNull UUID requisitionId,
                        String remarks,
                        @NotEmpty List<@Valid ProductionWasteLineRequest> lines) {
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
