package com.alsorg.packing.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.alsorg.packing.domain.logistics.LogisticsShift;

public interface LogisticsShiftRepository
        extends JpaRepository<LogisticsShift, UUID> {
}