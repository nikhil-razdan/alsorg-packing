package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowPurchaseDtos.CreatePurchaseOrderRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPurchaseDtos.PurchaseOrderActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPurchaseDtos.PurchaseOrderResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPurchaseDtos.SavePurchaseOrderLineRequest;

import com.alsorg.packing.service.matflow.MatFlowPurchaseOrderService;

import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/matflow/purchase/orders")
public class MatFlowPurchaseOrderController {

    private final MatFlowPurchaseOrderService service;

    public MatFlowPurchaseOrderController(
            MatFlowPurchaseOrderService service) {

        this.service = service;
    }

    @PostMapping
    public PurchaseOrderResponse createDraft(
            @RequestBody
            CreatePurchaseOrderRequest req) {

        return service.createDraft(req);
    }

    @PostMapping("/{purchaseOrderId}/lines")
    public PurchaseOrderResponse saveLine(
            @PathVariable
            UUID purchaseOrderId,

            @RequestBody
            SavePurchaseOrderLineRequest req) {

        return service.saveLine(
                purchaseOrderId,
                req
        );
    }

    @DeleteMapping("/{purchaseOrderId}/lines/{lineId}")
    public PurchaseOrderResponse removeLine(
            @PathVariable
            UUID purchaseOrderId,

            @PathVariable
            UUID lineId,

            @RequestParam
            Long rowVersion) {

        return service.removeLine(
                purchaseOrderId,
                lineId,
                rowVersion
        );
    }

    @PatchMapping("/{purchaseOrderId}/submit-for-approval")
    public PurchaseOrderResponse submitForApproval(
            @PathVariable
            UUID purchaseOrderId,

            @RequestBody
            PurchaseOrderActionRequest req) {

        return service.submitForApproval(
                purchaseOrderId,
                req
        );
    }

    @PatchMapping("/{purchaseOrderId}/approve")
    public PurchaseOrderResponse approve(
            @PathVariable
            UUID purchaseOrderId,

            @RequestBody
            PurchaseOrderActionRequest req) {

        return service.approve(
                purchaseOrderId,
                req
        );
    }

    @PatchMapping("/{purchaseOrderId}/return")
    public PurchaseOrderResponse returnForCorrection(
            @PathVariable
            UUID purchaseOrderId,

            @RequestBody
            PurchaseOrderActionRequest req) {

        return service.returnForCorrection(
                purchaseOrderId,
                req
        );
    }

    @PatchMapping("/{purchaseOrderId}/cancel")
    public PurchaseOrderResponse cancel(
            @PathVariable
            UUID purchaseOrderId,

            @RequestBody
            PurchaseOrderActionRequest req) {

        return service.cancel(
                purchaseOrderId,
                req
        );
    }

    @GetMapping("/{purchaseOrderId}")
    public PurchaseOrderResponse detail(
            @PathVariable
            UUID purchaseOrderId) {

        return service.detail(
                purchaseOrderId
        );
    }

    @GetMapping("/by-indent/{indentId}")
    public List<PurchaseOrderResponse> byIndent(
            @PathVariable
            UUID indentId) {

        return service.byIndent(
                indentId
        );
    }
}