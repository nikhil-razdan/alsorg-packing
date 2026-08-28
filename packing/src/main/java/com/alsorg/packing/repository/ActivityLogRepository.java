package com.alsorg.packing.repository;

import com.alsorg.packing.domain.activity.ActivityLog;

import java.util.Collection;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ActivityLogRepository
        extends JpaRepository<ActivityLog, Long> {

    List<ActivityLog> findByZohoItemIdOrderByCreatedAtDesc(String zohoItemId);

    Page<ActivityLog> findByZohoItemIdOrderByCreatedAtDesc(
            String zohoItemId,
            Pageable pageable);

    List<ActivityLog> findByPerformedByOrderByCreatedAtDesc(String performedBy);

    Page<ActivityLog> findByPerformedByOrderByCreatedAtDesc(
            String performedBy,
            Pageable pageable);

    List<ActivityLog> findByOrderByCreatedAtDesc(Pageable pageable);

    long countByZohoItemIdIn(Collection<String> zohoItemIds);

    @Modifying(flushAutomatically = true, clearAutomatically = false)
    @Query("""
            DELETE FROM ActivityLog a
            WHERE a.zohoItemId IN :lookupIds
            """)
    int deleteByZohoItemIdsForAdminDeletion(
            @Param("lookupIds") Collection<String> lookupIds);
}
