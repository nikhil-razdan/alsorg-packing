package com.alsorg.packing.reporting.repository;

import com.alsorg.packing.reporting.dto.ReportSchedule;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReportScheduleRepository
        extends JpaRepository<ReportSchedule, Long> {
}