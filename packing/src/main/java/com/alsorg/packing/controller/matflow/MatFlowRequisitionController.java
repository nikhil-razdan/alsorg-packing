package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.RequisitionCancelRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.ReservationReleaseRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.PlanningResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionCreateRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.ReservationResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreIssueRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreLineAvailabilityResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreReviewRequest;
import com.alsorg.packing.service.matflow.MatFlowRequisitionService;

import jakarta.validation.Valid;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Single authority for requisition, Store review, reservations, shortages,
 * indent submission, Store issue and requisition control.
 *
 * Replaces PlanningController, StoreController, ControlController and
 * IndentController. Legacy automatic /requisitions/{id}/plan is removed.
 */
@RestController
@RequestMapping("/api/matflow")
@PreAuthorize("isAuthenticated()")
public class MatFlowRequisitionController {

    private final MatFlowRequisitionService service;

    public MatFlowRequisitionController(MatFlowRequisitionService service) {
        this.service = service;
    }

    /* -------------------- Production requisition -------------------- */

    @GetMapping("/requisitions")
    public List<RequisitionResponse> requisitions() {
        return service.listRequisitions();
    }

    @GetMapping("/requisitions/{id}")
    public RequisitionResponse requisition(@PathVariable UUID id) {
        return service.getRequisition(id);
    }

    @GetMapping("/requisitions/{id}/planning")
    public PlanningResponse planning(@PathVariable UUID id) {
        return service.getPlanningSnapshot(id);
    }

    @PostMapping("/requisitions")
    public RequisitionResponse createRequisition(
            @Valid @RequestBody RequisitionCreateRequest request) {
        return service.createRequisition(request);
    }

    @PostMapping("/requisitions/{id}/submit")
    public RequisitionResponse submitRequisition(
            @PathVariable UUID id,
            @Valid @RequestBody RequisitionActionRequest request) {
        return service.submitRequisition(id, request);
    }

    @PostMapping("/requisitions/{id}/cancel")
    public RequisitionResponse cancelRequisition(
            @PathVariable UUID id,
            @Valid @RequestBody RequisitionCancelRequest request) {
        return service.cancelRequisition(id, request);
    }

    /* -------------------- Store desk -------------------- */

    @GetMapping("/store/requisitions")
    @PreAuthorize("hasAnyAuthority('ADMIN','MATFLOW_MANAGER','MATFLOW_STORE')")
    public List<RequisitionResponse> storeQueue(
            @RequestParam(required = false) String plantCode) {
        return service.listStoreQueue(plantCode);
    }

    @GetMapping("/store/requisitions/{id}")
    @PreAuthorize("hasAnyAuthority('ADMIN','MATFLOW_MANAGER','MATFLOW_STORE')")
    public PlanningResponse storeDetail(@PathVariable UUID id) {
        return service.getPlanningSnapshot(id);
    }

    @GetMapping("/store/requisitions/{id}/availability")
    @PreAuthorize("hasAnyAuthority('ADMIN','MATFLOW_MANAGER','MATFLOW_STORE')")
    public List<StoreLineAvailabilityResponse> availability(@PathVariable UUID id) {
        return service.getStoreAvailability(id);
    }

    @PostMapping("/store/requisitions/{id}/review")
    @PreAuthorize("hasAnyAuthority('ADMIN','MATFLOW_MANAGER','MATFLOW_STORE')")
    public PlanningResponse review(
            @PathVariable UUID id,
            @Valid @RequestBody StoreReviewRequest request) {
        return service.reviewRequisition(id, request);
    }

    @PostMapping("/store/reservations/{reservationId}/issue")
    @PreAuthorize("hasAnyAuthority('ADMIN','MATFLOW_MANAGER','MATFLOW_STORE')")
    public PlanningResponse issueReservation(
            @PathVariable UUID reservationId,
            @Valid @RequestBody StoreIssueRequest request) {
        return service.issueReservation(reservationId, request);
    }

    /* -------------------- Reservation control -------------------- */

    @PostMapping("/reservations/{id}/release")
    @PreAuthorize("hasAnyAuthority('ADMIN','MATFLOW_MANAGER','MATFLOW_STORE')")
    public ReservationResponse releaseReservation(
            @PathVariable UUID id,
            @Valid @RequestBody ReservationReleaseRequest request) {
        return service.releaseReservation(id, request);
    }

    /* -------------------- Shortage indent -------------------- */

    @PatchMapping("/indents/{id}/submit-to-purchase")
    @PreAuthorize("hasAnyAuthority('ADMIN','MATFLOW_MANAGER','MATFLOW_STORE')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void submitIndentToPurchase(
            @PathVariable UUID id,
            @Valid @RequestBody RequisitionActionRequest request) {
        service.submitIndentToPurchase(id, request);
    }
}
