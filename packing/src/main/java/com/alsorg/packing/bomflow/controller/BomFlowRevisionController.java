package com.alsorg.packing.bomflow.controller;

import com.alsorg.packing.bomflow.dto.BomFlowRevisionDtos.DeleteLineRequest;
import com.alsorg.packing.bomflow.dto.BomFlowRevisionDtos.RevisionActionRequest;
import com.alsorg.packing.bomflow.dto.BomFlowRevisionDtos.RevisionDetailResponse;
import com.alsorg.packing.bomflow.dto.BomFlowRevisionDtos.RevisionLineRequest;
import com.alsorg.packing.bomflow.service.BomFlowRevisionService;

import jakarta.validation.Valid;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@Validated
@PreAuthorize("isAuthenticated()")
@RequestMapping("/api/bomflow/revisions")
public class BomFlowRevisionController {

    private final BomFlowRevisionService service;

    public BomFlowRevisionController(
            BomFlowRevisionService service) {
        this.service = service;
    }

    @GetMapping("/{revisionId}")
    public RevisionDetailResponse get(
            @PathVariable UUID revisionId) {
        return service.get(revisionId);
    }

    @PostMapping("/{revisionId}/items")
    public RevisionDetailResponse addLine(
            @PathVariable UUID revisionId,
            @Valid @RequestBody RevisionLineRequest request) {
        return service.addLine(revisionId, request);
    }

    @PutMapping("/{revisionId}/items/{itemId}")
    public RevisionDetailResponse updateLine(
            @PathVariable UUID revisionId,
            @PathVariable UUID itemId,
            @Valid @RequestBody RevisionLineRequest request) {
        return service.updateLine(revisionId, itemId, request);
    }

    @DeleteMapping("/{revisionId}/items/{itemId}")
    public RevisionDetailResponse deleteLine(
            @PathVariable UUID revisionId,
            @PathVariable UUID itemId,
            @Valid @RequestBody(required = false) DeleteLineRequest request) {
        return service.deleteLine(revisionId, itemId, request);
    }

    @PostMapping("/{revisionId}/submit")
    public RevisionDetailResponse submit(
            @PathVariable UUID revisionId,
            @Valid @RequestBody RevisionActionRequest request) {
        return service.submit(revisionId, request);
    }

    @PostMapping("/{revisionId}/verify")
    public RevisionDetailResponse verify(
            @PathVariable UUID revisionId,
            @Valid @RequestBody RevisionActionRequest request) {
        return service.verify(revisionId, request);
    }

    @PostMapping("/{revisionId}/return")
    public RevisionDetailResponse returnForCorrection(
            @PathVariable UUID revisionId,
            @Valid @RequestBody RevisionActionRequest request) {
        return service.returnForCorrection(revisionId, request);
    }

    @PostMapping("/{revisionId}/approve")
    public RevisionDetailResponse approve(
            @PathVariable UUID revisionId,
            @Valid @RequestBody RevisionActionRequest request) {
        return service.approve(revisionId, request);
    }
}
