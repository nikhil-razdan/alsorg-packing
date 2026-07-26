package com.alsorg.packing.controller.bomflow;

import com.alsorg.packing.controller.dto.bomflow.CreateBomRequest;
import com.alsorg.packing.controller.dto.bomflow.SaveBomItemRequest;

import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.ApproveBomRequest;
import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.BomAuditResponse;
import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.BomDetailResponse;
import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.BomItemResponse;
import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.BomListResponse;
import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.BomRevisionResponse;
import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.CreateRevisionRequest;
import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.DeactivateBomItemRequest;
import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.ReturnBomRequest;
import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.RevisionDetailResponse;
import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.SubmitBomRequest;
import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.UpdateBomRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowReleaseDtos.MatFlowReleaseDetailResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowReleaseDtos.ReleaseToMatFlowRequest;

import com.alsorg.packing.service.bomflow.BomFlowReleaseService;
import com.alsorg.packing.service.bomflow.BomFlowApprovalService;
import com.alsorg.packing.service.bomflow.BomFlowService;

import org.springframework.data.domain.Page;

import org.springframework.http.HttpStatus;

import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/bomflow")
public class BomFlowController {

    private final BomFlowService bomService;
    private final BomFlowApprovalService approvalService;
    private final BomFlowReleaseService releaseService;

    public BomFlowController(
            BomFlowService bomService,
            BomFlowApprovalService approvalService,
            BomFlowReleaseService releaseService) {

        this.bomService = bomService;

        this.approvalService = approvalService;

        this.releaseService = releaseService;
    }

    /*
     * =========================================================
     * BOM HEADER
     * =========================================================
     */

    @PostMapping("/boms")
    @ResponseStatus(HttpStatus.CREATED)
    public BomDetailResponse create(
            @RequestBody CreateBomRequest req) {

        return bomService.create(
                req);
    }

    @GetMapping("/boms")
    public Page<BomListResponse> list(
            @RequestParam(required = false) String search,

            @RequestParam(required = false) String plantCode,

            @RequestParam(required = false) String status,

            @RequestParam(defaultValue = "0") int page,

            @RequestParam(defaultValue = "25") int size) {

        return bomService.list(
                search,
                plantCode,
                status,
                page,
                size);
    }

    @GetMapping("/boms/{bomId}")
    public BomDetailResponse get(
            @PathVariable UUID bomId) {

        return bomService.get(
                bomId);
    }

    @PatchMapping("/boms/{bomId}")
    public BomDetailResponse update(
            @PathVariable UUID bomId,

            @RequestBody UpdateBomRequest req) {

        return bomService.updateBom(
                bomId,
                req);
    }

    /*
     * =========================================================
     * REVISIONS
     * =========================================================
     */

    @GetMapping("/boms/{bomId}/revisions")
    public List<BomRevisionResponse> revisions(
            @PathVariable UUID bomId) {

        return bomService.revisions(
                bomId);
    }

    @PostMapping("/boms/{bomId}/revisions")
    @ResponseStatus(HttpStatus.CREATED)
    public RevisionDetailResponse createRevision(
            @PathVariable UUID bomId,

            @RequestBody CreateRevisionRequest req) {

        return bomService.createRevision(
                bomId,
                req);
    }

    @GetMapping("/revisions/{revisionId}")
    public RevisionDetailResponse getRevision(
            @PathVariable UUID revisionId) {

        return bomService.getRevision(
                revisionId);
    }

    /*
     * =========================================================
     * MATERIAL ITEMS
     * =========================================================
     */

    @PostMapping("/revisions/{revisionId}/items")
    @ResponseStatus(HttpStatus.CREATED)
    public BomItemResponse addItem(
            @PathVariable UUID revisionId,

            @RequestBody SaveBomItemRequest req) {

        return bomService.addItem(
                revisionId,
                req);
    }

    @PatchMapping("/revisions/{revisionId}/items/{itemId}")
    public BomItemResponse updateItem(
            @PathVariable UUID revisionId,

            @PathVariable UUID itemId,

            @RequestBody SaveBomItemRequest req) {

        return bomService.updateItem(
                revisionId,
                itemId,
                req);
    }

    @PatchMapping("/revisions/{revisionId}/items/"
            + "{itemId}/deactivate")
    public BomItemResponse deactivateItem(
            @PathVariable UUID revisionId,

            @PathVariable UUID itemId,

            @RequestBody DeactivateBomItemRequest req) {

        return bomService.deactivateItem(
                revisionId,
                itemId,
                req);
    }

    /*
     * =========================================================
     * APPROVAL WORKFLOW
     * =========================================================
     */

    @PostMapping("/revisions/{revisionId}/submit")
    public RevisionDetailResponse submit(
            @PathVariable UUID revisionId,

            @RequestBody SubmitBomRequest req) {

        return approvalService.submit(
                revisionId,
                req);
    }

    @PostMapping("/revisions/{revisionId}/approve")
    public RevisionDetailResponse approve(
            @PathVariable UUID revisionId,

            @RequestBody ApproveBomRequest req) {

        return approvalService.approve(
                revisionId,
                req);
    }

    @PostMapping("/revisions/{revisionId}/return")
    public RevisionDetailResponse returnForCorrection(
            @PathVariable UUID revisionId,

            @RequestBody ReturnBomRequest req) {

        return approvalService
                .returnForCorrection(
                        revisionId,
                        req);
    }

    /*
     * =========================================================
     * RELEASE TO MATFLOW
     * =========================================================
     */

    @PostMapping("/revisions/{revisionId}/release-to-matflow")
    public MatFlowReleaseDetailResponse releaseToMatFlow(
            @PathVariable UUID revisionId,

            @RequestBody ReleaseToMatFlowRequest req) {

        return releaseService
                .releaseToMatFlow(
                        revisionId,
                        req);
    }

    /*
     * =========================================================
     * AUDIT
     * =========================================================
     */

    @GetMapping("/boms/{bomId}/audit")
    public List<BomAuditResponse> audit(
            @PathVariable UUID bomId) {

        return bomService.audit(
                bomId);
    }
}