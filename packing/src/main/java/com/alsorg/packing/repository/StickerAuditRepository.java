package com.alsorg.packing.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.alsorg.packing.domain.audit.StickerAudit;

public interface StickerAuditRepository extends JpaRepository<StickerAudit, UUID> {
}
