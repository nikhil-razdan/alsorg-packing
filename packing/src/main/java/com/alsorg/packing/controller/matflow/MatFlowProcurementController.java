package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.*;
import com.alsorg.packing.service.matflow.MatFlowProcurementService;

import java.util.List;
import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/matflow")
@PreAuthorize("isAuthenticated()")
public class MatFlowProcurementController {

    private final MatFlowProcurementService service;

    public MatFlowProcurementController(
            MatFlowProcurementService service) {
        this.service = service;
    }

    @GetMapping("/purchase-orders")
    public List<PurchaseOrderResponse> purchaseOrders() {
        return service.listPurchaseOrders();
    }

    @PostMapping("/purchase-orders")
    public PurchaseOrderResponse createPurchaseOrder(
            @RequestBody PurchaseOrderRequest request) {
        return service.createPurchaseOrder(request);
    }

    @PostMapping("/purchase-orders/{id}/place")
    public PurchaseOrderResponse placePurchaseOrder(
            @PathVariable UUID id,
            @RequestBody PurchaseOrderActionRequest request) {
        return service.placePurchaseOrder(
                id,
                request);
    }

    @GetMapping("/grns")
    public List<GoodsReceiptResponse> goodsReceipts() {
        return service.listGoodsReceipts();
    }

    @PostMapping("/grns")
    public GoodsReceiptResponse createGoodsReceipt(
            @RequestBody GoodsReceiptRequest request) {
        return service.createGoodsReceipt(request);
    }
}