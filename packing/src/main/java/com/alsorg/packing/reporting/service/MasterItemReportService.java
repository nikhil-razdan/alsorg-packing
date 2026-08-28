package com.alsorg.packing.reporting.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;

import com.alsorg.packing.reporting.dto.MasterItemReportRow;
import com.alsorg.packing.reporting.repository.MasterItemReportRepository;

@Service
public class MasterItemReportService {

    private final MasterItemReportRepository repository;

    public MasterItemReportService(
            MasterItemReportRepository repository
    ) {
        this.repository = repository;
    }

    public List<MasterItemReportRow> getMasterItems(
            String status,
            String search,
            String plantCode,
            String client,
            LocalDateTime from,
            LocalDateTime to,
            int limit,
            int offset
    ) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new IllegalArgumentException("'from' must be before or equal to 'to'");
        }

        return repository.fetchMasterItems(
                status,
                search,
                plantCode,
                client,
                from,
                to,
                Math.min(Math.max(limit, 1), 1000),
                Math.max(offset, 0)
        );
    }
}