package com.alsorg.packing.repository;

import com.alsorg.packing.domain.venflow.VenFlowPoVerification;
import com.alsorg.packing.domain.venflow.VenFlowPoVerificationStatus;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VenFlowPoVerificationRepository
        extends JpaRepository<VenFlowPoVerification, UUID> {

    List<VenFlowPoVerification>
    findByEntryIdOrderByRevisionDesc(
            UUID entryId);

    Optional<VenFlowPoVerification>
    findByIdAndEntryId(
            UUID id,
            UUID entryId);

    Optional<VenFlowPoVerification>
    findFirstByEntryIdAndStatusOrderByRevisionDesc(
            UUID entryId,
            VenFlowPoVerificationStatus status);

    @Query("""
            select coalesce(max(v.revision), 0)
            from VenFlowPoVerification v
            where v.entryId = :entryId
            """)
    int findMaximumRevision(
            @Param("entryId") UUID entryId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select v
            from VenFlowPoVerification v
            where v.id = :verificationId
              and v.entryId = :entryId
              and v.revision = :revision
            """)
    Optional<VenFlowPoVerification>
    findForDecision(
            @Param("entryId")
            UUID entryId,

            @Param("verificationId")
            UUID verificationId,

            @Param("revision")
            Integer revision);
}