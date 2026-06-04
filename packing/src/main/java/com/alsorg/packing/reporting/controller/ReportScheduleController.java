package com.alsorg.packing.reporting.controller;

import com.alsorg.packing.reporting.dto.ReportSchedule;
import com.alsorg.packing.reporting.repository.ReportScheduleRepository;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalTime;
import java.util.List;

@RestController
@RequestMapping("/api/report-schedules")
public class ReportScheduleController {

    private final ReportScheduleRepository repo;

    public ReportScheduleController(ReportScheduleRepository repo) {
        this.repo = repo;
    }

    @GetMapping
    public List<ReportSchedule> all() {
        return repo.findAll();
    }

    @PostMapping
    public ReportSchedule create(@RequestBody ReportSchedule s) {

        if (s.getEmail() == null || s.getEmail().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Email is required"
            );
        }

        if (!s.getEmail().contains("@")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid email address"
            );
        }

        if (s.getReportType() == null || s.getReportType().isBlank()) {
            s.setReportType("inventory");
        }

        String type = s.getReportType().trim().toLowerCase();

        if ("combined".equals(type)) {
            type = "inventory";
        }

        if (!type.equals("packing")
                && !type.equals("dispatch")
                && !type.equals("inventory")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid report type"
            );
        }

        s.setReportType(type);
        s.setEmail(s.getEmail().trim());

        if (s.getSendTime() == null) {
            s.setSendTime(LocalTime.of(18, 0));
        }

        s.setEnabled(true);

        return repo.save(s);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        repo.deleteById(id);
    }
}