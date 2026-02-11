package com.alsorg.packing.reporting.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;

import com.alsorg.packing.reporting.dto.CombinedReportRow;
import com.alsorg.packing.reporting.repository.CombinedReportRepository;

@Service
public class CombinedReportService {

    private final CombinedReportRepository repository;

    public CombinedReportService(CombinedReportRepository repository) {
        this.repository = repository;
    }

    public List<CombinedReportRow> getCombinedReport(
            LocalDateTime from,
            LocalDateTime to
    ) {
        return repository.fetchCombinedReport(from, to);
    }
}
