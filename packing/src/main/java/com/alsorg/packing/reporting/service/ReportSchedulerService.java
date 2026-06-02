package com.alsorg.packing.reporting.service;

import com.alsorg.packing.reporting.dto.ReportSchedule;
import com.alsorg.packing.reporting.export.ExcelExportUtil;
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
    private final PackingReportService packingService;
    private final DispatchReportService dispatchService;
    private final CombinedReportService combinedService;
    private final EmailService emailService;

    public ReportSchedulerService(
            ReportScheduleRepository repo,
            PackingReportService packingService,
            DispatchReportService dispatchService,
            CombinedReportService combinedService,
            EmailService emailService
    ) {
        this.repo = repo;
        this.packingService = packingService;
        this.dispatchService = dispatchService;
        this.combinedService = combinedService;
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

        if ("packing".equals(type)) {
            return ExcelExportUtil.exportToExcel(
                    packingService.getPackingReport(null, null),
                    "Packing"
            );
        }

        if ("dispatch".equals(type)) {
            return ExcelExportUtil.exportToExcel(
                    dispatchService.getDispatchReport(null, null),
                    "Dispatch"
            );
        }

        if ("combined".equals(type)) {
            return ExcelExportUtil.exportToExcel(
                    combinedService.getCombinedReport(null, null),
                    "Combined"
            );
        }

        throw new IllegalArgumentException(
                "Invalid report type: " + type
        );
    }

    private String normalizeReportType(String type) {
        if (type == null || type.isBlank()) {
            return "combined";
        }

        return type.trim().toLowerCase();
    }

    private String buildFilename(
            String reportType,
            LocalDate today
    ) {
        return "alsorg-"
                + reportType
                + "-report-"
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