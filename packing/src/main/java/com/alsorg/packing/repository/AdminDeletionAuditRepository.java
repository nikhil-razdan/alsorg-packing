package com.alsorg.packing.repository;

import com.alsorg.packing.domain.audit.AdminDeletionAudit;

import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminDeletionAuditRepository
        extends JpaRepository<AdminDeletionAudit, UUID> {

    Page<AdminDeletionAudit>
    findAllByOrderByDeletedAtDesc(
            Pageable pageable
    );
}