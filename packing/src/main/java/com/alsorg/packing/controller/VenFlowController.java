package com.alsorg.packing.controller;

import com.alsorg.packing.controller.dto.VenFlowDtos.*;
import com.alsorg.packing.domain.venflow.VenFlowAuditLog;
import com.alsorg.packing.domain.venflow.VenFlowEntry;
import com.alsorg.packing.domain.venflow.VenFlowNotification;
import com.alsorg.packing.domain.venflow.VenFlowStageHistory;
import com.alsorg.packing.service.VenFlowNotificationService;
import com.alsorg.packing.service.VenFlowService;

import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/venflow")
public class VenFlowController {

    private final VenFlowService service;
    private final VenFlowNotificationService notificationService;

    public VenFlowController(
            VenFlowService service,
            VenFlowNotificationService notificationService) {
        this.service = service;
        this.notificationService = notificationService;
    }

    /*
     * =========================================================
     * MAIN LIST / DASHBOARD / REPORTS
     * =========================================================
     */

    @GetMapping("/entries")
    public Page<VenFlowEntry> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) String stage,
            @RequestParam(required = false) String storeStatus,
            @RequestParam(required = false) String poStatus,
            @RequestParam(required = false) String productionStatus,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        return service.list(
                search,
                plantCode,
                stage,
                storeStatus,
                poStatus,
                productionStatus,
                page,
                size);
    }

    @GetMapping("/entries/{id}")
    public VenFlowEntry get(
            @PathVariable UUID id) {
        return service.get(id);
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
            @PathVariable UUID entryId) {
        return service.auditLogs(entryId);
    }

    /*
     * =========================================================
     * ENGINEERING DESK
     * Engineering creates BOM / Indent and sends it to AKG Store.
     * =========================================================
     */

    @PostMapping("/entries")
    public VenFlowEntry create(
            @RequestBody CreateRequest req) {
        return service.create(req);
    }

    @PatchMapping("/entries/{id}/send-to-store")
    public VenFlowEntry sendToStore(
            @PathVariable UUID id) {
        return service.sendToStore(id);
    }

    /*
     * =========================================================
     * AKG STORE DESK - STOCK / RESERVE / PR
     * Store checks stock and decides available / not available.
     * =========================================================
     */

    @PatchMapping("/entries/{id}/store-decision")
    public MaterialSummaryResponse submitStoreDecision(
            @PathVariable UUID id,
            @RequestBody StoreDecisionRequest req) {
        return service.submitStoreDecision(
                id,
                req);
    }
    /*
     * =========================================================
     * PURCHASE DESK
     * Purchase sees Store PR, raises PO and follows vendor.
     * =========================================================
     */

    @GetMapping("/purchase-desk")
    public Page<VenFlowEntry> purchaseDesk(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) String poStatus,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        return service.purchaseDesk(
                search,
                plantCode,
                poStatus,
                page,
                size);
    }

    @PatchMapping("/entries/{id}/po-raise")
    public VenFlowEntry raisePo(
            @PathVariable UUID id,
            @RequestBody PoRequest req) {
        return service.raisePo(id, req);
    }

    /*
     * Optional legacy/approval endpoint.
     * If you still want manager/admin PO sign-off, keep this.
     */
    @PatchMapping("/entries/{id}/po-approve")
    public VenFlowEntry approvePo(
            @PathVariable UUID id) {
        return service.approvePo(id);
    }

    @GetMapping("/entries/{id}/material-summary")
    public MaterialSummaryResponse materialSummary(
            @PathVariable UUID id) {
        return service.materialSummary(id);
    }

    @GetMapping("/entries/{id}/material-history")
    public List<MaterialMovementResponse> materialHistory(
            @PathVariable UUID id) {
        return service.materialHistory(id);
    }

    /*
     * =========================================================
     * AKG STORE DESK - RECEIVING / GRN / QC / INVENTORY
     * Store receives material, makes GRN, checks QC and accepts/rejects.
     * =========================================================
     */

    @PatchMapping("/entries/{id}/material-received")
    public VenFlowEntry materialReceived(
            @PathVariable UUID id,
            @RequestBody MaterialReceivedRequest req) {
        return service.materialReceived(id, req);
    }

    @PatchMapping("/entries/{id}/grn")
    public VenFlowEntry grnEntry(
            @PathVariable UUID id,
            @RequestBody GrnRequest req) {
        return service.grnEntry(id, req);
    }

    @PatchMapping("/entries/{id}/qc")
    public VenFlowEntry qualityCheck(
            @PathVariable UUID id,
            @RequestBody QcRequest req) {
        return service.qualityCheck(id, req);
    }

    @PostMapping("/entries/{entryId}/allocations/{allocationId}/qc")
    public MaterialSummaryResponse inspectAllocation(
            @PathVariable UUID entryId,
            @PathVariable UUID allocationId,
            @RequestBody QcInspectionRequest req) {
        return service.inspectAllocation(
                entryId,
                allocationId,
                req);
    }

    @PatchMapping("/entries/{id}/accept-inventory")
    public VenFlowEntry acceptInventory(
            @PathVariable UUID id) {
        return service.acceptInventory(id);
    }

    @PatchMapping("/entries/{id}/inform-production")
    public VenFlowEntry informProduction(
            @PathVariable UUID id) {
        return service.informProduction(id);
    }

    @PatchMapping("/entries/{id}/issue-material")
    public VenFlowEntry issueMaterial(
            @PathVariable UUID id,
            @RequestBody IssueMaterialRequest req) {
        return service.issueMaterial(id, req);
    }

    /*
     * =========================================================
     * PROCESSING / PRODUCTION DESK
     * Production adds process details, starts processing and completes.
     * =========================================================
     */

    @PatchMapping("/entries/{id}/production-details")
    public VenFlowEntry productionDetails(
            @PathVariable UUID id,
            @RequestBody ProductionDetailsRequest req) {
        return service.productionDetails(id, req);
    }

    @PatchMapping("/entries/{id}/processing-start")
    public VenFlowEntry startProcessing(
            @PathVariable UUID id) {
        return service.startProcessing(id);
    }

    @PatchMapping("/entries/{id}/process-complete")
    public VenFlowEntry completeProcess(
            @PathVariable UUID id,
            @RequestBody ProcessingRequest req) {
        return service.completeProcess(id, req);
    }

    /*
     * =========================================================
     * SUPERVISOR CLOSURE
     * Supervisor/person is informed and material is ready for next stage.
     * =========================================================
     */

    @PatchMapping("/entries/{id}/supervisor-informed")
    public VenFlowEntry supervisorInformed(
            @PathVariable UUID id) {
        return service.supervisorInformed(id);
    }

    @PatchMapping("/entries/{id}/ready-next-stage")
    public VenFlowEntry readyForNextStage(
            @PathVariable UUID id) {
        return service.readyForNextStage(id);
    }

    /*
     * =========================================================
     * COMMON
     * =========================================================
     */

    @PatchMapping("/entries/{id}/remarks")
    public VenFlowEntry updateRemarks(
            @PathVariable UUID id,
            @RequestBody RemarksRequest req) {
        return service.updateRemarks(id, req);
    }

    /*
     * =========================================================
     * LEGACY ENDPOINTS - KEEP TEMPORARILY ONLY
     * These prevent your old frontend from breaking during transition.
     * Remove later after new UI is live.
     * =========================================================
     */

    @PatchMapping("/entries/{id}/product-details")
    public VenFlowEntry updateProductDetails(
            @PathVariable UUID id,
            @RequestBody ProductDetailsRequest req) {
        return service.updateProductDetails(id, req);
    }

    @PatchMapping("/entries/{id}/store-status")
    public VenFlowEntry updateStoreStatus(
            @PathVariable UUID id,
            @RequestBody StoreStatusRequest req) {
        return service.updateStoreStatus(id, req);
    }

    @PatchMapping("/entries/{id}/send-to-purchase")
    public VenFlowEntry sendToPurchase(
            @PathVariable UUID id) {
        return service.sendToPurchase(id);
    }

    @PatchMapping("/entries/{id}/director-approve-po")
    public VenFlowEntry directorApprovePo(
            @PathVariable UUID id,
            @RequestBody DirectorDecisionRequest req) {
        return service.directorApprovePo(id, req);
    }

    @PatchMapping("/entries/{id}/director-reject-po")
    public VenFlowEntry directorRejectPo(
            @PathVariable UUID id,
            @RequestBody DirectorDecisionRequest req) {
        return service.directorRejectPo(
                id,
                req);
    }

    @GetMapping("/entries/{id}/stage-history")
    public List<VenFlowStageHistory> stageHistory(
            @PathVariable UUID id) {
        return service.stageHistory(id);
    }

    @PatchMapping("/entries/{id}/place-vendor-order")
    public VenFlowEntry placeVendorOrder(
            @PathVariable UUID id,
            @RequestBody VendorOrderRequest req) {
        return service.placeVendorOrder(id, req);
    }

    @GetMapping("/director/dashboard")
    public DirectorDashboardResponse directorDashboard() {
        return service.directorDashboard();
    }

    @GetMapping("/director/po-queue")
    public Page<VenFlowEntry> directorPoQueue(
            @RequestParam(required = false) String search,

            @RequestParam(required = false) String plantCode,

            @RequestParam(defaultValue = "0") int page,

            @RequestParam(defaultValue = "25") int size) {
        return service.directorPoQueue(
                search,
                plantCode,
                page,
                size);
    }

    @PatchMapping("/entries/{id}/requisition")
    public VenFlowEntry updateRequisition(
            @PathVariable UUID id,
            @RequestBody RequisitionRequest req) {
        return service.updateRequisition(id, req);
    }

    @PatchMapping("/entries/{id}/ordered-qty")
    public VenFlowEntry updateOrderedQty(
            @PathVariable UUID id,
            @RequestBody OrderedQtyRequest req) {
        return service.updateOrderedQty(id, req);
    }

    @PatchMapping("/entries/{id}/expected-date")
    public VenFlowEntry updateExpectedDate(
            @PathVariable UUID id,
            @RequestBody ExpectedDateRequest req) {
        return service.updateExpectedDate(id, req);
    }

    @PatchMapping("/entries/{id}/received-qty")
    public VenFlowEntry updateReceivedQty(
            @PathVariable UUID id,
            @RequestBody ReceivedQtyRequest req) {
        return service.updateReceivedQty(id, req);
    }

    @GetMapping("/supervisor-desk")
    public Page<VenFlowEntry> supervisorDesk(
            @RequestParam(required = false) String search,

            @RequestParam(required = false) String plantCode,

            @RequestParam(defaultValue = "0") int page,

            @RequestParam(defaultValue = "25") int size) {
        return service.supervisorDesk(
                search,
                plantCode,
                page,
                size);
    }

    @GetMapping("/notifications")
    public Page<VenFlowNotification> notifications(
            @RequestParam(defaultValue = "false") boolean unreadOnly,

            @RequestParam(defaultValue = "0") int page,

            @RequestParam(defaultValue = "20") int size) {
        return notificationService.myNotifications(
                unreadOnly,
                page,
                size);
    }

    @GetMapping("/notifications/unread-count")
    public long unreadNotificationCount() {
        return notificationService.unreadCount();
    }

    @PatchMapping("/notifications/{id}/read")
    public VenFlowNotification markNotificationRead(
            @PathVariable UUID id) {
        return notificationService.markRead(id);
    }

    @PatchMapping("/entries/{id}/production-start")
    public VenFlowEntry startProduction(
            @PathVariable UUID id,
            @RequestBody ProductionActionRequest req) {
        return service.startProduction(id, req);
    }

    @PatchMapping("/entries/{id}/job-done")
    public VenFlowEntry jobDone(
            @PathVariable UUID id,
            @RequestBody ProductionActionRequest req) {
        return service.jobDone(id, req);
    }

    @PatchMapping("/entries/{id}/complete")
    public VenFlowEntry complete(
            @PathVariable UUID id) {
        return service.complete(id);
    }
}