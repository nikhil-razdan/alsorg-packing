package com.alsorg.packing.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.alsorg.packing.domain.admin.PacketDeletionRequest;
import com.alsorg.packing.domain.admin.PacketDeletionRequestStatus;

import jakarta.persistence.LockModeType;

public interface PacketDeletionRequestRepository
        extends JpaRepository<PacketDeletionRequest, UUID> {

    boolean existsByTargetKeyAndStatus(
            String targetKey,
            PacketDeletionRequestStatus status);

    long countByTargetKeyInAndStatus(
            Collection<String> targetKeys,
            PacketDeletionRequestStatus status);

    long countByTargetKeyInAndStatusAndIdNot(
            Collection<String> targetKeys,
            PacketDeletionRequestStatus status,
            UUID excludedId);

    Page<PacketDeletionRequest> findByStatusOrderByRequestedAtAscIdAsc(
            PacketDeletionRequestStatus status,
            Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT r
            FROM PacketDeletionRequest r
            WHERE r.id IN :requestIds
            ORDER BY r.targetKey ASC, r.id ASC
            """)
    List<PacketDeletionRequest> findAllByIdForDecision(
            @Param("requestIds") Collection<UUID> requestIds);
}
