package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowStoreReviewDtos.ReturnToProductionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowStoreReviewDtos.StoreQueueResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowStoreReviewDtos.StoreReviewRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowStoreReviewDtos.StoreReviewResponse;

import com.alsorg.packing.service.matflow.MatFlowStoreReviewService;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/matflow/store/requisitions")
public class MatFlowStoreReviewController {

    private final MatFlowStoreReviewService service;

    public MatFlowStoreReviewController(
            MatFlowStoreReviewService service) {

        this.service = service;
    }

    @GetMapping("/pending")
    public List<StoreQueueResponse> pendingQueue(
            @RequestParam(required = false)
            String plantCode) {

        return service.pendingQueue(
                plantCode
        );
    }

    @GetMapping("/{requisitionId}")
    public StoreReviewResponse detail(
            @PathVariable
            UUID requisitionId) {

        return service.detail(
                requisitionId
        );
    }

    /*
     * The request may review one line or several lines.
     *
     * Unreviewed lines remain STORE_REVIEW_PENDING.
     */
    @PostMapping("/{requisitionId}/review")
    public StoreReviewResponse review(
            @PathVariable
            UUID requisitionId,

            @RequestBody
            StoreReviewRequest req) {

        return service.review(
                requisitionId,
                req
        );
    }

    @PatchMapping("/{requisitionId}/return-to-production")
    public StoreReviewResponse returnToProduction(
            @PathVariable
            UUID requisitionId,

            @RequestBody
            ReturnToProductionRequest req) {

        return service.returnToProduction(
                requisitionId,
                req
        );
    }
}