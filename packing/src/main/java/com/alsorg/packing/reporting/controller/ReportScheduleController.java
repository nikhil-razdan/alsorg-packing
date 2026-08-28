package com.alsorg.packing.reporting.controller;

import com.alsorg.packing.reporting.dto.ReportSchedule;
import com.alsorg.packing.reporting.repository.ReportScheduleRepository;

import jakarta.mail.internet.InternetAddress;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalTime;
import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/report-schedules")
@PreAuthorize("hasAuthority('ADMIN')")
public class ReportScheduleController {

    private static final int MAX_EMAIL_LENGTH = 320;

    private final ReportScheduleRepository repo;

    public ReportScheduleController(ReportScheduleRepository repo) {
        this.repo = repo;
    }

    @GetMapping
    public List<ReportSchedule> all() {
        /*
         * Scheduled-report definitions are administrative configuration, not an
         * unbounded business-history feed. Keep the existing List response shape
         * while preventing an accidental full-table read.
         */
        return repo.findTop100ByOrderByIdDesc();
    }

    @PostMapping
    public ReportSchedule create(
            @RequestBody(required = false) ReportSchedule request) {
        if (request == null) {
            throw badRequest("Schedule request is required");
        }

        String email = validateEmail(request.getEmail());
        String type = normalizeReportType(request.getReportType());
        LocalTime sendTime = request.getSendTime() == null
                ? LocalTime.of(18, 0)
                : request.getSendTime().withSecond(0).withNano(0);

        /*
         * Do not persist the request entity itself. That would allow fields such
         * as id, lastSent or enabled to be mass-assigned by the client.
         */
        ReportSchedule schedule = new ReportSchedule();
        schedule.setEmail(email);
        schedule.setReportType(type);
        schedule.setSendTime(sendTime);
        schedule.setEnabled(true);
        schedule.setLastSent(null);

        return repo.save(schedule);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        if (id == null || id <= 0) {
            throw badRequest("Invalid schedule id");
        }

        if (!repo.existsById(id)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Report schedule not found");
        }

        repo.deleteById(id);
    }

    private String validateEmail(String value) {
        String clean = value == null ? "" : value.trim();

        if (clean.isBlank()) {
            throw badRequest("Email is required");
        }

        if (clean.length() > MAX_EMAIL_LENGTH
                || clean.indexOf('\r') >= 0
                || clean.indexOf('\n') >= 0) {
            throw badRequest("Invalid email address");
        }

        try {
            InternetAddress address = new InternetAddress(clean, true);
            address.validate();
            if (!clean.equals(address.getAddress())) {
                throw badRequest("Invalid email address");
            }
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (Exception exception) {
            throw badRequest("Invalid email address");
        }

        return clean;
    }

    private String normalizeReportType(String value) {
        String type = value == null || value.isBlank()
                ? "inventory"
                : value.trim().toLowerCase(Locale.ROOT);

        if ("combined".equals(type)) {
            type = "inventory";
        }

        if (!"packing".equals(type)
                && !"dispatch".equals(type)
                && !"inventory".equals(type)) {
            throw badRequest("Invalid report type");
        }

        return type;
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
