package com.alsorg.packing.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.alsorg.packing.domain.site.PacketSiteLifecycle;

public interface PacketSiteLifecycleRepository extends JpaRepository<PacketSiteLifecycle, UUID> {

    Optional<PacketSiteLifecycle> findByPacketItemId(UUID packetItemId);

    List<PacketSiteLifecycle> findByPacketItemIdIn(Collection<UUID> packetItemIds);

    @Query("""
            SELECT l
            FROM PacketSiteLifecycle l
            WHERE l.challanNumber = :challanNumber
            """)
    List<PacketSiteLifecycle> findByChallanNumber(
            @Param("challanNumber") String challanNumber);
}
