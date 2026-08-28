package com.alsorg.packing.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.alsorg.packing.domain.utl.UtlPacketRouting;

@Repository
public interface UtlPacketRoutingRepository
        extends JpaRepository<UtlPacketRouting, UUID> {

    Optional<UtlPacketRouting> findByPacketItemId(UUID packetItemId);

    List<UtlPacketRouting> findByPacketItemIdIn(Collection<UUID> packetItemIds);

    List<UtlPacketRouting> findByDispatchTargetUsernameIgnoreCase(String username);
}
