package com.alsorg.packing.repository;

import com.alsorg.packing.domain.item.PacketItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PacketItemRepository extends JpaRepository<PacketItem, UUID> {

    List<PacketItem> findByPacketId(UUID packetId);

    Optional<PacketItem> findBySku(String sku);

    Optional<PacketItem> findByZohoItemId(String zohoItemId);
}
