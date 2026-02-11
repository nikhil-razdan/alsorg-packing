package com.alsorg.packing.reporting.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;

import com.alsorg.packing.reporting.dto.PackingReportRow;
import com.alsorg.packing.reporting.repository.PackingReportRepository;

@Service
public class PackingReportService {

    private final PackingReportRepository repository;

    public PackingReportService(PackingReportRepository repository) {
        this.repository = repository;
    }

    public List<PackingReportRow> getPackingReport(
            LocalDateTime from,
            LocalDateTime to
    ) {
        return repository.fetchPackingReport(from, to);
    }
}
