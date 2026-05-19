package com.alsorg.packing.reporting.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.alsorg.packing.reporting.dto.InventoryAgingRow;
import com.alsorg.packing.reporting.repository.InventoryAgingReportRepository;

@Service
public class InventoryAgingReportService {

    private final InventoryAgingReportRepository repository;

    public InventoryAgingReportService(
            InventoryAgingReportRepository repository
    ) {
        this.repository = repository;
    }

    public List<InventoryAgingRow> getInventoryAgingReport() {
        return repository.fetchInventoryAging();
    }
}
