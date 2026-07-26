package com.alsorg.packing.controller.dto;

import com.alsorg.packing.domain.venflow.VenFlowPoVerificationStatus;
import com.alsorg.packing.domain.venflow.VenFlowUnit;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public final class VenFlowPoVerificationDtos {

    private VenFlowPoVerificationDtos() {
    }

    public record PoVerificationResponse(
            UUID id,
            UUID entryId,
            UUID allocationId,
            Integer revision,
            VenFlowPoVerificationStatus status,

            String plantCode,
            String pdNo,
            String drawingNo,
            String clientName,
            String materialName,
            VenFlowUnit unit,

            String purchaseRequestNo,
            BigDecimal plannedQty,

            String vendorName,
            String poNo,
            LocalDate poDate,
            BigDecimal orderedQty,
            BigDecimal poAmount,
            UUID poAttachmentId,

            String createdBy,
            LocalDateTime createdAt,

            String decidedBy,
            LocalDateTime decidedAt,
            String decisionRemarks,

            Long rowVersion) {
    }
}