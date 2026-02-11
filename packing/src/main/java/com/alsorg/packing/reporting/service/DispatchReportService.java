package com.alsorg.packing.reporting.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;

import com.alsorg.packing.reporting.dto.DispatchReportRow;
import com.alsorg.packing.reporting.repository.DispatchReportRepository;

@Service
public class DispatchReportService {

    private final DispatchReportRepository repository;

    public DispatchReportService(DispatchReportRepository repository) {
        this.repository = repository;
    }

    public List<DispatchReportRow> getDispatchReport(
            LocalDateTime from,
            LocalDateTime to
    ) {
        return repository.fetchDispatchReport(from, to);
    }
}
