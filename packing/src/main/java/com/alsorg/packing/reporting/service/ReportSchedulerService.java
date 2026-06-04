package com.alsorg.packing.reporting.service;

import com.alsorg.packing.reporting.dto.ReportSchedule;
import com.alsorg.packing.reporting.repository.ReportScheduleRepository;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;

@Service
public class ReportSchedulerService {

    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    private final ReportScheduleRepository repo;
    private final InventoryReportWorkbookService workbookService;
    private final EmailService emailService;

    public ReportSchedulerService(
            ReportScheduleRepository repo,
            InventoryReportWorkbookService workbookService,
            EmailService emailService
    ) {
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

        List<ReportSchedule> schedules =
                repo.findDueSchedules(now, today);

        if (schedules.isEmpty()) {
            return;
        }

        System.out.println("📩 Due report schedules found: " + schedules.size());

        for (ReportSchedule schedule : schedules) {
            sendSchedule(schedule, today);
        }
    }

    private void sendSchedule(
            ReportSchedule schedule,
            LocalDate today
    ) {
        try {
            String reportType = normalizeReportType(
                    schedule.getReportType()
            );

            byte[] excel = generateExcel(reportType);

            String filename = buildFilename(reportType, today);

            String subject = buildSubject(reportType, today);

            emailService.sendExcel(
                    schedule.getEmail(),
                    subject,
                    excel,
                    filename
            );

            schedule.setLastSent(today);
            repo.save(schedule);

            System.out.println(
                    "✅ Scheduled report sent | ID: "
                            + schedule.getId()
                            + " | Email: "
                            + schedule.getEmail()
            );

        } catch (Exception e) {
            System.out.println(
                    "❌ Scheduled report failed | ID: "
                            + schedule.getId()
                            + " | Email: "
                            + schedule.getEmail()
            );

            e.printStackTrace();
        }
    }

    private byte[] generateExcel(String type) {
        return workbookService.exportInventoryReport(
                type,
                null,
                null
        );
    }

    private String normalizeReportType(String type) {
        if (type == null || type.isBlank()) {
            return "inventory";
        }

        String normalized =
                type.trim().toLowerCase();

        if ("combined".equals(normalized)) {
            return "inventory";
        }

        if (
                "inventory".equals(normalized) ||
                "packing".equals(normalized) ||
                "dispatch".equals(normalized)
        ) {
            return normalized;
        }

        return "inventory";
    }

    private String buildFilename(
            String reportType,
            LocalDate today
    ) {
        return "alsorg-"
                + reportType
                + "-professional-report-"
                + today
                + ".xlsx";
    }

    private String buildSubject(
            String reportType,
            LocalDate today
    ) {
        return "Alsorg "
                + capitalize(reportType)
                + " Report - "
                + today;
    }

    private String capitalize(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }

        return value.substring(0, 1).toUpperCase()
                + value.substring(1).toLowerCase();
    }
}