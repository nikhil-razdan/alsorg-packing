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
        return repository.fetchMasterItems(
                status,
                search,
                plantCode,
                client,
                from,
                to,
                limit,
                offset
        );
    }
}