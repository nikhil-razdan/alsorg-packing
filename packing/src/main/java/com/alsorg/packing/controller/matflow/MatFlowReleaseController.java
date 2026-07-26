package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowReleaseDtos.MatFlowAuditResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowReleaseDtos.MatFlowReleaseDetailResponse;

import com.alsorg.packing.service.matflow.MatFlowReleaseQueryService;

import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/matflow/releases")
public class MatFlowReleaseController {

    private final MatFlowReleaseQueryService queryService;

    public MatFlowReleaseController(
            MatFlowReleaseQueryService queryService) {

        this.queryService = queryService;
    }

    @GetMapping("/{releaseId}")
    public MatFlowReleaseDetailResponse get(
            @PathVariable UUID releaseId) {

        return queryService.get(
                releaseId);
    }

    @GetMapping("/by-source-revision/{revisionId}")
    public MatFlowReleaseDetailResponse getBySourceRevision(
            @PathVariable UUID revisionId) {

        return queryService
                .getBySourceRevision(
                        revisionId);
    }

    @GetMapping
    public List<MatFlowReleaseDetailResponse> listBySourceBom(
            @RequestParam UUID sourceBomId) {

        return queryService
                .listBySourceBom(
                        sourceBomId);
    }

    @GetMapping("/{releaseId}/audit")
    public List<MatFlowAuditResponse> audit(
            @PathVariable UUID releaseId) {

        return queryService.audit(
                releaseId);
    }
}