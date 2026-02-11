package com.alsorg.packing.reporting.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.alsorg.packing.reporting.dto.DashboardActivityRow;
import com.alsorg.packing.reporting.repository.DashboardActivityRepository;

@Service
public class DashboardActivityService {

    private final DashboardActivityRepository repository;

    public DashboardActivityService(
            DashboardActivityRepository repository
    ) {
        this.repository = repository;
    }

    public List<DashboardActivityRow> getRecentActivity(
            int limit,
            int offset
    ) {
        return repository.fetchRecent(limit, offset);
    }
}
