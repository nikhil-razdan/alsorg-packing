package com.alsorg.packing.controller.dto;

import com.alsorg.packing.domain.venflow.VenFlowAttachmentStorageProvider;
import com.alsorg.packing.domain.venflow.VenFlowAttachmentType;

import java.time.LocalDateTime;
import java.util.UUID;

public final class VenFlowAttachmentDtos {

    private VenFlowAttachmentDtos() {
    }

    public record AttachmentResponse(
            UUID id,
            UUID entryId,
            VenFlowAttachmentType type,
            String originalFileName,
            String contentType,
            long fileSize,
            String checksumSha256,
            VenFlowAttachmentStorageProvider storageProvider,
            boolean active,
            String uploadedBy,
            LocalDateTime uploadedAt,
            String deactivatedBy,
            LocalDateTime deactivatedAt,
            String deactivationReason,
            Long rowVersion) {
    }

    public record DeactivateAttachmentRequest(
            Long rowVersion,
            String reason) {
    }
}