package com.alsorg.packing.service;

import org.springframework.stereotype.Service;

import com.alsorg.packing.domain.activity.ActivityLog;
import com.alsorg.packing.repository.ActivityLogRepository;

import jakarta.transaction.Transactional;

@Service
@Transactional
public class ActivityLogService {

    private final ActivityLogRepository activityRepo;

    public ActivityLogService(ActivityLogRepository activityRepo) {
        this.activityRepo = activityRepo;
    }

    public void log(
            String zohoItemId,
            String action,
            String username,
            String role,
            String fromStatus,
            String toStatus,
            String remarks
    ) {
        ActivityLog log = new ActivityLog();

        log.setZohoItemId(zohoItemId);
        log.setAction(action);
        log.setPerformedBy(username);
        log.setRole(role);
        log.setFromStatus(fromStatus);
        log.setToStatus(toStatus);
        log.setRemarks(remarks);

        activityRepo.save(log);
    }
}
