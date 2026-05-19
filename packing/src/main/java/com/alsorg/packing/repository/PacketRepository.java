package com.alsorg.packing.repository;

import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.alsorg.packing.domain.packet.Packet;
import com.alsorg.packing.domain.common.PacketStatus;

public interface PacketRepository extends JpaRepository<Packet, UUID> {

    Page<Packet> findByCompany_Id(UUID companyId, Pageable pageable);

    Page<Packet> findByStatus(PacketStatus status, Pageable pageable);

    Page<Packet> findByCompany_IdAndStatus(
            UUID companyId,
            PacketStatus status,
            Pageable pageable
    );
}
