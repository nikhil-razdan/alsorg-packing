package com.alsorg.packing.repository;

import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.alsorg.packing.domain.admin.AdminPacketRollbackAudit;

public interface AdminPacketRollbackAuditRepository
        extends JpaRepository<AdminPacketRollbackAudit, UUID> {

    Page<AdminPacketRollbackAudit> findAllByOrderByChangedAtDesc(
            Pageable pageable
    );
}