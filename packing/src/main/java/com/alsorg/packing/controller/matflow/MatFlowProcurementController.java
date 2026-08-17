package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.GoodsReceiptRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.GoodsReceiptResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.PurchaseOrderRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.PurchaseOrderResponse;
import com.alsorg.packing.service.matflow.MatFlowProcurementService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Purchase + GRN boundary.
 *
 * There is no Location input in MatFlow. Every PI/PO/GRN created from an MR is
 * centralized at AL-P1 Main Store by the service from the linked MR/PI lineage.
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
