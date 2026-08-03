package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomCreateRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomDetailResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomLineRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomSummaryResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomUpdateRequest;

import com.alsorg.packing.domain.matflow.MatFlowBomStatus;

import com.alsorg.packing.service.matflow.MatFlowBomService;

import jakarta.validation.Valid;

import java.util.List;
import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/matflow/boms")
@PreAuthorize("isAuthenticated()")
public class MatFlowBomController {

    private final MatFlowBomService service;

    public MatFlowBomController(
            MatFlowBomService service) {

        this.service = service;
    }

    /*
     * =====================================================
     * BOM REGISTER
     * =====================================================
     */

    @GetMapping
    public List<BomSummaryResponse> list(
            @RequestParam(required = false)
            String search,

            @RequestParam(required = false)
            MatFlowBomStatus status,

            @RequestParam(
                    required = false,
                    defaultValue = "true")
            Boolean latestOnly) {

        return service.list(
                search,
                status,
                latestOnly);
    }

    /*
     * =====================================================
     * BOM CREATE / DETAIL / UPDATE
     * =====================================================
     */

    @PostMapping
    public BomDetailResponse create(
            @Valid
            @RequestBody
            BomCreateRequest request) {

        return service.create(
                request);
    }

    @GetMapping("/{id}")
    public BomDetailResponse get(
            @PathVariable UUID id) {

        return service.get(
                id);
    }

    @PutMapping("/{id}")
    public BomDetailResponse update(
            @PathVariable UUID id,

            @Valid
            @RequestBody
            BomUpdateRequest request) {

        return service.update(
                id,
                request);
    }

    /*
     * =====================================================
     * BOM MATERIAL LINES
     * =====================================================
     */

    @PostMapping("/{id}/lines")
    public BomDetailResponse addLine(
            @PathVariable UUID id,

            @Valid
            @RequestBody
            BomLineRequest request) {

        return service.addLine(
                id,
                request);
    }

    @PutMapping("/{id}/lines/{lineId}")
    public BomDetailResponse updateLine(
            @PathVariable UUID id,

            @PathVariable UUID lineId,

            @Valid
            @RequestBody
            BomLineRequest request) {

        return service.updateLine(
                id,
                lineId,
                request);
    }

    @DeleteMapping("/{id}/lines/{lineId}")
    public BomDetailResponse deleteLine(
            @PathVariable UUID id,

            @PathVariable UUID lineId,

            @RequestParam Long rowVersion) {

        return service.deleteLine(
                id,
                lineId,
                rowVersion);
    }

    /*
     * =====================================================
     * ENGINEERING SUBMISSION
     * =====================================================
     */

    @PostMapping("/{id}/submit")
    public BomDetailResponse submit(
            @PathVariable UUID id,

            @Valid
            @RequestBody
            BomActionRequest request) {

        return service.submit(
                id,
                request);
    }

    /*
     * =====================================================
     * HOD REVIEW
     * =====================================================
     */

    @PostMapping("/{id}/approve")
    public BomDetailResponse approve(
            @PathVariable UUID id,

            @Valid
            @RequestBody
            BomActionRequest request) {

        return service.approve(
                id,
                request);
    }

    @PostMapping("/{id}/return")
    public BomDetailResponse returnBom(
            @PathVariable UUID id,

            @Valid
            @RequestBody
            BomActionRequest request) {

        return service.returnBom(
                id,
                request);
    }

    /*
     * =====================================================
     * PRODUCTION REVIEW
     * =====================================================
     *
     * The class-level path already contains:
     *
     * /api/matflow/boms
     *
     * Therefore these method paths must NOT begin with /boms.
     */

    @PostMapping("/{id}/production-approve")
    public BomDetailResponse productionApprove(
            @PathVariable UUID id,

            @Valid
            @RequestBody
            BomActionRequest request) {

        return service.productionApprove(
                id,
                request);
    }

    @PostMapping("/{id}/production-return")
    public BomDetailResponse productionReturn(
            @PathVariable UUID id,

            @Valid
            @RequestBody
            BomActionRequest request) {

        return service.productionReturn(
                id,
                request);
    }

    /*
     * =====================================================
     * REVISION
     * =====================================================
     */

    @PostMapping("/{id}/revisions")
    public BomDetailResponse createRevision(
            @PathVariable UUID id,

            @Valid
            @RequestBody
            BomActionRequest request) {

        return service.createRevision(
                id,
                request);
    }
}