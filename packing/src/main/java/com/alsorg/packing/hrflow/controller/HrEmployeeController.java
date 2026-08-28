package com.alsorg.packing.hrflow.controller;

import com.alsorg.packing.hrflow.domain.HrEmployeeStatus;
import com.alsorg.packing.hrflow.dto.HrEmployeeDtos;
import com.alsorg.packing.hrflow.service.HrEmployeeService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
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
        byte[] bytes = pdf.bytes() == null ? new byte[0] : pdf.bytes();
        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(safeFileName(pdf.fileName()), StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.PRAGMA, "no-cache")
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(bytes.length)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(bytes);
    }

    private String safeFileName(String value) {
        if (value == null || value.isBlank()) {
            return "hrflow-employee-form.pdf";
        }
        String clean = value.replaceAll("[\\r\\n\\t]", "_").trim();
        return clean.isBlank() ? "hrflow-employee-form.pdf" : clean;
    }

}
