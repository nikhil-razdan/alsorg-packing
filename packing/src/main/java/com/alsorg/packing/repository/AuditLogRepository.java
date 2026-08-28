package com.alsorg.packing.repository;

import com.alsorg.packing.domain.audit.AuditLog;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuditLogRepository
        extends JpaRepository<AuditLog, UUID> {

    List<AuditLog> findByZohoItemIdOrderByPerformedAtDesc(String zohoItemId);

    Page<AuditLog> findByZohoItemIdOrderByPerformedAtDesc(
            String zohoItemId,
            Pageable pageable);

    long countByZohoItemIdIn(Collection<String> zohoItemIds);

    @Modifying(flushAutomatically = true, clearAutomatically = false)
    @Query("""
            DELETE FROM AuditLog a
            WHERE a.zohoItemId IN :lookupIds
            """)
    int deleteByZohoItemIdsForAdminDeletion(
            @Param("lookupIds") Collection<String> lookupIds);
}
