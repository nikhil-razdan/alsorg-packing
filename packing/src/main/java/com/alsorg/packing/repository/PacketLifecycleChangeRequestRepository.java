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

import com.alsorg.packing.domain.admin.PacketLifecycleChangeRequest;
import com.alsorg.packing.domain.admin.PacketLifecycleChangeRequestStatus;

import jakarta.persistence.LockModeType;

public interface PacketLifecycleChangeRequestRepository
        extends JpaRepository<PacketLifecycleChangeRequest, UUID> {

    boolean existsByPacketItemIdAndStatus(
            UUID packetItemId,
            PacketLifecycleChangeRequestStatus status);

    long countByPacketItemIdInAndStatus(
            Collection<UUID> packetItemIds,
            PacketLifecycleChangeRequestStatus status);

    Page<PacketLifecycleChangeRequest> findByStatusOrderByRequestedAtAscIdAsc(
            PacketLifecycleChangeRequestStatus status,
            Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT r
            FROM PacketLifecycleChangeRequest r
            WHERE r.id IN :requestIds
            ORDER BY r.packetItemId ASC, r.id ASC
            """)
    List<PacketLifecycleChangeRequest> findAllByIdForDecision(
            @Param("requestIds") Collection<UUID> requestIds);
}
