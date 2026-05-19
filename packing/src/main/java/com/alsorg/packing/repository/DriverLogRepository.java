package com.alsorg.packing.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.alsorg.packing.domain.analytics.DriverLog;


public interface DriverLogRepository extends JpaRepository<DriverLog, Long> {
}