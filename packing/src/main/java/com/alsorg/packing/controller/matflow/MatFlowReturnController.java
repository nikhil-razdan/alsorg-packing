package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.MaterialReturnActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.MaterialReturnCreateRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.MaterialReturnResponse;
import com.alsorg.packing.service.matflow.MatFlowReturnService;

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
@RequestMapping("/api/matflow/material-returns")
@PreAuthorize("isAuthenticated()")
public class MatFlowReturnController {

    private final MatFlowReturnService service;

    public MatFlowReturnController(
            MatFlowReturnService service) {
        this.service = service;
    }

    @GetMapping
    public List<MaterialReturnResponse> list() {
        return service.list();
    }

    @PostMapping
    public MaterialReturnResponse create(
            @RequestBody MaterialReturnCreateRequest request) {
        return service.create(request);
    }

    @PostMapping("/{id}/dispatch")
    public MaterialReturnResponse dispatch(
            @PathVariable UUID id,
            @RequestBody MaterialReturnActionRequest request) {
        return service.dispatch(
                id,
                request);
    }

    @PostMapping("/{id}/receive")
    public MaterialReturnResponse receive(
            @PathVariable UUID id,
            @RequestBody MaterialReturnActionRequest request) {
        return service.receive(
                id,
                request);
    }
}