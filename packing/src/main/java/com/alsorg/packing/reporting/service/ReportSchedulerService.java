package com.alsorg.packing.reporting.service;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.reporting.dto.ReportSchedule;
import com.alsorg.packing.reporting.repository.ReportScheduleRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Locale;

@Service
public class ReportSchedulerService {

    private static final Logger log = LoggerFactory.getLogger(ReportSchedulerService.class);

    private static final java.time.ZoneId ZONE = TimeZoneConfig.APP_ZONE;
    private static final int MAX_DUE_SCHEDULES_PER_RUN = 100;

    private final ReportScheduleRepository repo;
    private final InventoryReportWorkbookService workbookService;
    private final EmailService emailService;

    public ReportSchedulerService(
            ReportScheduleRepository repo,
            InventoryReportWorkbookService workbookService,
            EmailService emailService) {
        this.repo = repo;
        this.workbookService = workbookService;
        this.emailService = emailService;
    }

    @Scheduled(cron = "0 * * * * *", zone = "Asia/Kolkata")
    public void runSchedules() {
        LocalTime now = LocalTime.now(ZONE)
                .withSecond(0)
                .withNano(0);

        LocalDate today = LocalDate.now(ZONE);

        List<ReportSchedule> schedules = repo.findDueSchedules(
                now,
                today,
                PageRequest.of(
                        0,
                        MAX_DUE_SCHEDULES_PER_RUN));

        if (schedules.isEmpty()) {
            return;
        }

        log.info("Due report schedules found: count={}", schedules.size());

        for (ReportSchedule schedule : schedules) {
            sendSchedule(schedule, today);
        }
    }

    private void sendSchedule(
            ReportSchedule schedule,
            LocalDate today) {
        if (schedule == null || schedule.getId() == null) {
            log.warn("Ignoring malformed report schedule without id");
            return;
        }

        try {
            String reportType = normalizeReportType(schedule.getReportType());

            byte[] excel = generateExcel(reportType);
            String filename = buildFilename(reportType, today);
            String subject = buildSubject(reportType, today);

            emailService.sendExcel(
                    schedule.getEmail(),
                    subject,
                    excel,
                    filename);

            schedule.setLastSent(today);
            repo.save(schedule);

            log.info(
                    "Scheduled report completed: scheduleId={}, reportType={}",
                    schedule.getId(),
                    reportType);

        } catch (Exception exception) {
            /*
             * A failed email is intentionally not marked lastSent. The next
             * scheduler run may retry it. Do not log the recipient address.
             */
            log.error(
                    "Scheduled report failed: scheduleId={}",
                    schedule.getId(),
                    exception);
        }
    }

    private byte[] generateExcel(String type) {
        return workbookService.exportInventoryReport(
                type,
                null,
                null);
    }

    private String normalizeReportType(String type) {
        if (type == null || type.isBlank()) {
            return "inventory";
        }

        String normalized = type.trim().toLowerCase(Locale.ROOT);

        if ("combined".equals(normalized)) {
            return "inventory";
        }

        if ("inventory".equals(normalized)
                || "packing".equals(normalized)
                || "dispatch".equals(normalized)) {
            return normalized;
        }

        return "inventory";
    }

    private String buildFilename(
            String reportType,
            LocalDate today) {
        return "alsorg-"
                + reportType
                + "-professional-report-"
                + today
                + ".xlsx";
    }

    private String buildSubject(
            String reportType,
            LocalDate today) {
        return "Alsorg "
                + capitalize(reportType)
                + " Report - "
                + today;
    }

    private String capitalize(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }

        return value.substring(0, 1).toUpperCase(Locale.ROOT)
                + value.substring(1).toLowerCase(Locale.ROOT);
    }
}
