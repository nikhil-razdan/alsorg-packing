package com.alsorg.packing.service;

import java.time.LocalDateTime;
import java.time.ZoneId;

import org.springframework.stereotype.Service;

import com.alsorg.packing.domain.activity.ActivityLog;
import com.alsorg.packing.repository.ActivityLogRepository;

import jakarta.transaction.Transactional;

@Service
@Transactional
public class ActivityLogService {

    private static final ZoneId APP_ZONE =
            ZoneId.of("Asia/Kolkata");

    private final ActivityLogRepository activityRepo;

    public ActivityLogService(
            ActivityLogRepository activityRepo
    ) {
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
        ActivityLog log =
                new ActivityLog();

        log.setZohoItemId(clean(zohoItemId));
        log.setAction(clean(action));
        log.setPerformedBy(safe(username, "SYSTEM"));
        log.setRole(safe(role, "SYSTEM"));
        log.setFromStatus(clean(fromStatus));
        log.setToStatus(clean(toStatus));
        log.setRemarks(clean(remarks));

        /*
         * IMPORTANT:
         * Save India local time explicitly.
         * Do not depend on Render server timezone.
         */
        log.setCreatedAt(
                LocalDateTime.now(APP_ZONE)
        );

        activityRepo.save(log);
    }

    private String clean(
            String value
    ) {
        if (value == null) {
            return null;
        }

        String text =
                value.trim();

        return text.isBlank()
                ? null
                : text;
    }

    private String safe(
            String value,
            String fallback
    ) {
        String text =
                clean(value);

        return text == null
                ? fallback
                : text;
    }
}