package com.alsorg.packing.hrflow.controller;

import com.alsorg.packing.hrflow.domain.HrEmployeeStatus;
import com.alsorg.packing.hrflow.dto.HrEmployeeDtos;
import com.alsorg.packing.hrflow.service.HrEmployeeService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/hrflow/employees")
public class HrEmployeeController {

    private final HrEmployeeService employeeService;

    public HrEmployeeController(HrEmployeeService employeeService) {
        this.employeeService = employeeService;
    }

    @GetMapping
    public Page<HrEmployeeDtos.EmployeeSummaryResponse> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) HrEmployeeStatus status,
            Pageable pageable
    ) {
        return employeeService.list(q, status, pageable);
    }

    @GetMapping("/{id}")
    public HrEmployeeDtos.EmployeeDetailResponse get(@PathVariable UUID id) {
        return employeeService.get(id);
    }
}
