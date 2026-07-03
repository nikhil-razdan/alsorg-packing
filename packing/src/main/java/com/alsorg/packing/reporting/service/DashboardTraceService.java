package com.alsorg.packing.reporting.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;

import com.alsorg.packing.reporting.dto.DashboardTraceRow;
import com.alsorg.packing.reporting.repository.DashboardTraceRepository;

@Service
public class DashboardTraceService {

    private final DashboardTraceRepository repository;

    public DashboardTraceService(
            DashboardTraceRepository repository
    ) {
        this.repository = repository;
    }

    public List<DashboardTraceRow> getInventoryTrace(
            String type,
            LocalDateTime from,
            LocalDateTime to,
            String search,
            int limit,
            int offset
    ) {
        return repository.fetchTrace(
                type,
                from,
                to,
                search,
                limit,
                offset
        );
    }
}