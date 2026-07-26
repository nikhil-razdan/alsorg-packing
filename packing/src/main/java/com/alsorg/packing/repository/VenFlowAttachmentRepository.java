package com.alsorg.packing.repository;

import com.alsorg.packing.domain.venflow.VenFlowAttachment;
import com.alsorg.packing.domain.venflow.VenFlowAttachmentType;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VenFlowAttachmentRepository
        extends JpaRepository<VenFlowAttachment, UUID> {

    List<VenFlowAttachment>
    findByEntryIdAndActiveTrueOrderByUploadedAtDesc(
            UUID entryId);

    List<VenFlowAttachment>
    findByEntryIdAndTypeAndActiveTrueOrderByUploadedAtDesc(
            UUID entryId,
            VenFlowAttachmentType type);

    Optional<VenFlowAttachment>
    findByIdAndEntryIdAndActiveTrue(
            UUID id,
            UUID entryId);

    boolean existsByEntryIdAndTypeAndActiveTrue(
            UUID entryId,
            VenFlowAttachmentType type);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select a
            from VenFlowAttachment a
            where a.id = :attachmentId
              and a.entryId = :entryId
            """)
    Optional<VenFlowAttachment>
    findByIdAndEntryIdForUpdate(
            @Param("entryId") UUID entryId,
            @Param("attachmentId") UUID attachmentId);
}