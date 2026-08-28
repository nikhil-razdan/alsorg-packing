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
        validateRange(from, to);

        return repository.fetchCombinedReport(from, to);
    }

    private void validateRange(
            LocalDateTime from,
            LocalDateTime to) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new IllegalArgumentException("'from' must be before or equal to 'to'");
        }
    }
}
