package com.alsorg.packing.repository;

import com.alsorg.packing.domain.item.HardwarePacketLine;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import org.springframework.data.repository.query.Param;

public interface HardwarePacketLineRepository
        extends JpaRepository<HardwarePacketLine, UUID> {

    @Query("""
            select line
            from HardwarePacketLine line
            where line.packetItem.id in :packetItemIds
            order by line.packetItem.id asc, line.lineNo asc
            """)
    List<HardwarePacketLine> findForAdminDeletion(
            @Param("packetItemIds") Collection<UUID> packetItemIds);

    long countByPacketItem_IdIn(
            Collection<UUID> packetItemIds);

    @Modifying(flushAutomatically = true, clearAutomatically = false)
    @Query("""
            delete from HardwarePacketLine line
            where line.packetItem.id in :packetItemIds
            """)
    int deleteByPacketItemIdsForAdminDeletion(
            @Param("packetItemIds") Collection<UUID> packetItemIds);
}