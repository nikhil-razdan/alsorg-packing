package com.alsorg.packing.hrflow.dto;

import com.alsorg.packing.hrflow.domain.HrDocumentType;

import java.time.LocalDateTime;
import java.util.UUID;

public final class HrDocumentDtos {

    private HrDocumentDtos() {}

    public record DocumentResponse(
            UUID id,
            UUID candidateId,
            HrDocumentType documentType,
            String originalFileName,
            String contentType,
            long fileSize,
            String sha256,
            String remarks,
            boolean active,
            String uploadedBy,
            LocalDateTime uploadedAt,
            String archivedBy,
            LocalDateTime archivedAt
    ) {}

    public record DocumentCompletenessResponse(
            UUID candidateId,
            boolean hasPhoto,
            boolean hasResume,
            boolean hasAadhaar,
            boolean hasPan,
            long activeDocumentCount
    ) {}
}
