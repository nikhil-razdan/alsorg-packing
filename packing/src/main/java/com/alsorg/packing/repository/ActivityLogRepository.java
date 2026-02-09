package com.alsorg.packing.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.alsorg.packing.domain.activity.ActivityLog;

public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {

    List<ActivityLog> findByZohoItemIdOrderByCreatedAtDesc(String zohoItemId);

    List<ActivityLog> findByPerformedByOrderByCreatedAtDesc(String performedBy);
}
