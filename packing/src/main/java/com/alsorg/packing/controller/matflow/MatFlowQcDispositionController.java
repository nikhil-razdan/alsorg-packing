package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.QcDispositionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.QcDispositionResponse;
import com.alsorg.packing.service.matflow.MatFlowQcDispositionService;

import java.util.List;
import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/matflow/qc-dispositions")
@PreAuthorize("isAuthenticated()")
public class MatFlowQcDispositionController {

    private final MatFlowQcDispositionService service;

    public MatFlowQcDispositionController(
            MatFlowQcDispositionService service) {
        this.service = service;
    }

    @GetMapping
    public List<QcDispositionResponse> list() {
        return service.list();
    }

    @PostMapping("/{inspectionId}")
    public QcDispositionResponse decide(
            @PathVariable UUID inspectionId,
            @RequestBody QcDispositionRequest request) {
        return service.decide(
                inspectionId,
                request);
    }
}