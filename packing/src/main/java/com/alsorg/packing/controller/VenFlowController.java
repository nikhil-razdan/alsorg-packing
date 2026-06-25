package com.alsorg.packing.controller;

import com.alsorg.packing.controller.dto.VenFlowDtos.*;
import com.alsorg.packing.domain.venflow.VenFlowAuditLog;
import com.alsorg.packing.domain.venflow.VenFlowEntry;
import com.alsorg.packing.service.VenFlowService;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/venflow")
public class VenFlowController {

    private final VenFlowService service;

    public VenFlowController(VenFlowService service) {
        this.service = service;
    }

    @PostMapping("/entries")
    public VenFlowEntry create(
            @RequestBody CreateRequest req
    ) {
        return service.create(req);
    }

    @GetMapping("/entries")
    public Page<VenFlowEntry> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String stage,
            @RequestParam(required = false) String storeStatus,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        return service.list(search, stage, storeStatus, page, size);
    }

    @GetMapping("/entries/{id}")
    public VenFlowEntry get(
            @PathVariable UUID id
    ) {
        return service.get(id);
    }

    @PatchMapping("/entries/{id}/product-details")
    public VenFlowEntry updateProductDetails(
            @PathVariable UUID id,
            @RequestBody ProductDetailsRequest req
    ) {
        return service.updateProductDetails(id, req);
    }

    @PatchMapping("/entries/{id}/store-status")
    public VenFlowEntry updateStoreStatus(
            @PathVariable UUID id,
            @RequestBody StoreStatusRequest req
    ) {
        return service.updateStoreStatus(id, req);
    }

    @PatchMapping("/entries/{id}/requisition")
    public VenFlowEntry updateRequisition(
            @PathVariable UUID id,
            @RequestBody RequisitionRequest req
    ) {
        return service.updateRequisition(id, req);
    }

    @PatchMapping("/entries/{id}/ordered-qty")
    public VenFlowEntry updateOrderedQty(
            @PathVariable UUID id,
            @RequestBody OrderedQtyRequest req
    ) {
        return service.updateOrderedQty(id, req);
    }

    @PatchMapping("/entries/{id}/expected-date")
    public VenFlowEntry updateExpectedDate(
            @PathVariable UUID id,
            @RequestBody ExpectedDateRequest req
    ) {
        return service.updateExpectedDate(id, req);
    }

    @PatchMapping("/entries/{id}/received-qty")
    public VenFlowEntry updateReceivedQty(
            @PathVariable UUID id,
            @RequestBody ReceivedQtyRequest req
    ) {
        return service.updateReceivedQty(id, req);
    }

    @PatchMapping("/entries/{id}/remarks")
    public VenFlowEntry updateRemarks(
            @PathVariable UUID id,
            @RequestBody RemarksRequest req
    ) {
        return service.updateRemarks(id, req);
    }

    @PatchMapping("/entries/{id}/complete")
    public VenFlowEntry complete(
            @PathVariable UUID id
    ) {
        return service.complete(id);
    }

    @GetMapping("/dashboard")
    public DashboardResponse dashboard() {
        return service.dashboard();
    }

    @GetMapping("/audit/{entryId}")
    public List<VenFlowAuditLog> audit(
            @PathVariable UUID entryId
    ) {
        return service.auditLogs(entryId);
    }
}