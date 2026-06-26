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
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) String stage,
            @RequestParam(required = false) String storeStatus,
            @RequestParam(required = false) String poStatus,
            @RequestParam(required = false) String productionStatus,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        return service.list(
                search,
                plantCode,
                stage,
                storeStatus,
                poStatus,
                productionStatus,
                page,
                size
        );
    }

    @GetMapping("/purchase-desk")
    public Page<VenFlowEntry> purchaseDesk(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) String poStatus,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        return service.purchaseDesk(
                search,
                plantCode,
                poStatus,
                page,
                size
        );
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

    @PatchMapping("/entries/{id}/send-to-purchase")
    public VenFlowEntry sendToPurchase(
            @PathVariable UUID id
    ) {
        return service.sendToPurchase(id);
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

    @PatchMapping("/entries/{id}/po-raise")
    public VenFlowEntry raisePo(
            @PathVariable UUID id,
            @RequestBody PoRequest req
    ) {
        return service.raisePo(id, req);
    }

    @PatchMapping("/entries/{id}/po-approve")
    public VenFlowEntry approvePo(
            @PathVariable UUID id
    ) {
        return service.approvePo(id);
    }

    @PatchMapping("/entries/{id}/expected-date")
    public VenFlowEntry updateExpectedDate(
            @PathVariable UUID id,
            @RequestBody ExpectedDateRequest req
    ) {
        return service.updateExpectedDate(id, req);
    }

    /*
     * Old endpoint kept.
     */
    @PatchMapping("/entries/{id}/received-qty")
    public VenFlowEntry updateReceivedQty(
            @PathVariable UUID id,
            @RequestBody ReceivedQtyRequest req
    ) {
        return service.updateReceivedQty(id, req);
    }

    /*
     * New better endpoint name.
     */
    @PatchMapping("/entries/{id}/material-received")
    public VenFlowEntry materialReceived(
            @PathVariable UUID id,
            @RequestBody MaterialReceivedRequest req
    ) {
        return service.materialReceived(id, req);
    }

    @PatchMapping("/entries/{id}/inform-production")
    public VenFlowEntry informProduction(
            @PathVariable UUID id
    ) {
        return service.informProduction(id);
    }

    @PatchMapping("/entries/{id}/production-start")
    public VenFlowEntry startProduction(
            @PathVariable UUID id,
            @RequestBody ProductionActionRequest req
    ) {
        return service.startProduction(id, req);
    }

    @PatchMapping("/entries/{id}/job-done")
    public VenFlowEntry jobDone(
            @PathVariable UUID id,
            @RequestBody ProductionActionRequest req
    ) {
        return service.jobDone(id, req);
    }

    @PatchMapping("/entries/{id}/remarks")
    public VenFlowEntry updateRemarks(
            @PathVariable UUID id,
            @RequestBody RemarksRequest req
    ) {
        return service.updateRemarks(id, req);
    }

    /*
     * Old endpoint kept for safety.
     * Internally maps to JOB_DONE logic.
     */
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

    @GetMapping("/reports/summary")
    public ReportSummaryResponse reportSummary() {
        return service.reportSummary();
    }

    @GetMapping("/audit/{entryId}")
    public List<VenFlowAuditLog> audit(
            @PathVariable UUID entryId
    ) {
        return service.auditLogs(entryId);
    }
}