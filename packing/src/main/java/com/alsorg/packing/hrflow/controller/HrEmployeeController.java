package com.alsorg.packing.hrflow.controller;

import com.alsorg.packing.hrflow.domain.HrEmployeeStatus;
import com.alsorg.packing.hrflow.dto.HrEmployeeDtos;
import com.alsorg.packing.hrflow.service.HrEmployeeService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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
    @GetMapping(value = "/{id}/form-pdf/{formKey}", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> formPdf(
            @PathVariable UUID id,
            @PathVariable String formKey
    ) {
        HrEmployeeService.FormPdf pdf = employeeService.formPdf(id, formKey);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + pdf.fileName().replace("\"", "") + "\"")
                .body(pdf.bytes());
    }

}
