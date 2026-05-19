package com.alsorg.packing.controller;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.alsorg.packing.domain.analytics.DriverLog;
import com.alsorg.packing.repository.DriverLogRepository;

@RestController
@RequestMapping("/api/driver")
public class DriverLogController {

    private final DriverLogRepository repo;

    public DriverLogController(DriverLogRepository repo) {
        this.repo = repo;
    }

    @PostMapping
    public void create(@RequestBody DriverLog log) {
        log.setSource("UI");
        repo.save(log);
    }
}