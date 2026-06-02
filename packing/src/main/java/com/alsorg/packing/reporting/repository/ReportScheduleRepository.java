package com.alsorg.packing.reporting.repository;

import com.alsorg.packing.reporting.dto.ReportSchedule;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public interface ReportScheduleRepository
        extends JpaRepository<ReportSchedule, Long> {

    @Query("""
        select s
        from ReportSchedule s
        where s.enabled = true
          and s.email is not null
          and s.email <> ''
          and s.sendTime is not null
          and s.sendTime <= :now
          and (s.lastSent is null or s.lastSent <> :today)
    """)
    List<ReportSchedule> findDueSchedules(
            @Param("now") LocalTime now,
            @Param("today") LocalDate today
    );
}