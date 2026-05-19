package com.alsorg.packing.reporting.service;

import com.alsorg.packing.reporting.repository.ReportScheduleRepository;
import com.alsorg.packing.reporting.dto.ReportSchedule;
import com.alsorg.packing.reporting.export.ExcelExportUtil;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;

@Service
public class ReportSchedulerService {

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
    ){
        this.repo = repo;
        this.packingService = packingService;
        this.dispatchService = dispatchService;
        this.combinedService = combinedService;
        this.emailService = emailService;
    }

    @Scheduled(fixedRate = 60000)
    public void runSchedules(){

        System.out.println("Scheduler running...");

        ZoneId zone = ZoneId.of("Asia/Kolkata");

        LocalTime now = LocalTime.now(zone)
                .withSecond(0)
                .withNano(0);

        LocalDate today = LocalDate.now(zone);

        List<ReportSchedule> schedules = repo.findAll();

        for(ReportSchedule s : schedules){

            if(!Boolean.TRUE.equals(s.getEnabled())) {
                continue;
            }

            if(s.getEmail() == null || s.getEmail().isBlank()){
                System.out.println("Skipping empty email schedule");
                continue;
            }

            LocalTime scheduled = s.getSendTime();

            if(scheduled == null){
                System.out.println("Skipping schedule with no time");
                continue;
            }

            System.out.println("Schedule found:");
            System.out.println("Email: " + s.getEmail());
            System.out.println("Scheduled time: " + scheduled);
            System.out.println("Current time: " + now);

            // ✅ Exact match check (reliable)
            if(scheduled.equals(now)){

                // ✅ Prevent duplicate sending in same day
                if(s.getLastSent() != null && s.getLastSent().equals(today)){
                    System.out.println("Already sent today. Skipping.");
                    continue;
                }

                try {

                    System.out.println("Sending report to: " + s.getEmail());

                    byte[] excel = generateExcel(s.getReportType());

                    System.out.println("Excel size: " + excel.length);

                    emailService.sendExcel(
                            s.getEmail(),
                            "Alsorg Daily Report",
                            excel,
                            "report.xlsx"
                    );

                    // ✅ Update last sent date
                    s.setLastSent(today);
                    repo.save(s);

                    System.out.println("✅ Report sent and schedule updated");

                } catch(Exception e){
                    System.out.println("❌ Email sending failed:");
                    e.printStackTrace();
                }
            }
        }
    }

    private byte[] generateExcel(String type){

        if("packing".equalsIgnoreCase(type)){
            return ExcelExportUtil.exportToExcel(
                    packingService.getPackingReport(null, null),
                    "Packing"
            );
        }

        if("dispatch".equalsIgnoreCase(type)){
            return ExcelExportUtil.exportToExcel(
                    dispatchService.getDispatchReport(null, null),
                    "Dispatch"
            );
        }

        return ExcelExportUtil.exportToExcel(
                combinedService.getCombinedReport(null, null),
                "Combined"
        );
    }
}