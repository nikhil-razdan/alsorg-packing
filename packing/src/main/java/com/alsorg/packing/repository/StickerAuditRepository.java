package com.alsorg.packing.repository;

import com.alsorg.packing.domain.audit.StickerAudit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface StickerAuditRepository extends JpaRepository<StickerAudit, UUID> {
}
