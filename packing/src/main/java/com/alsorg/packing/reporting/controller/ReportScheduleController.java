package com.alsorg.packing.reporting.controller;

import com.alsorg.packing.reporting.dto.ReportSchedule;
import com.alsorg.packing.reporting.repository.ReportScheduleRepository;
import org.springframework.web.bind.annotation.*;

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
        return repo.save(s);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        repo.deleteById(id);
    }
}