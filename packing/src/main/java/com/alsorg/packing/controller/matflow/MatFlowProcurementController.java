package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.GoodsReceiptRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.GoodsReceiptResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.PurchaseOrderActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.PurchaseOrderRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.PurchaseOrderResponse;
import com.alsorg.packing.service.matflow.MatFlowProcurementService;

import jakarta.validation.Valid;

import java.util.List;
import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Purchase + receipt controller.
 *
 * Purchase creates a DRAFT PO. Manager/Director/Admin approves it through
 * /approve. The old Purchase-user /place action is intentionally removed.
 */
@RestController
@RequestMapping("/api/matflow")
@PreAuthorize("isAuthenticated()")
public class MatFlowProcurementController {

    private final MatFlowProcurementService service;

    public MatFlowProcurementController(MatFlowProcurementService service) {
        this.service = service;
    }

    @GetMapping("/purchase-orders")
    public List<PurchaseOrderResponse> purchaseOrders() {
        return service.listPurchaseOrders();
    }

    @PostMapping("/purchase-orders")
    public PurchaseOrderResponse createPurchaseOrder(
            @Valid @RequestBody PurchaseOrderRequest request) {
        return service.createPurchaseOrder(request);
    }

    @PostMapping("/purchase-orders/{id}/approve")
    public PurchaseOrderResponse approvePurchaseOrder(
            @PathVariable UUID id,
            @Valid @RequestBody PurchaseOrderActionRequest request) {
        return service.approvePurchaseOrder(id, request);
    }

    @GetMapping("/grns")
    public List<GoodsReceiptResponse> goodsReceipts() {
        return service.listGoodsReceipts();
    }

    @PostMapping("/grns")
    public GoodsReceiptResponse createGoodsReceipt(
            @Valid @RequestBody GoodsReceiptRequest request) {
        return service.createGoodsReceipt(request);
    }
}
