package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.RequisitionCancelRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.ReservationReleaseRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.IndentResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.PlanningResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionCreateRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.ReservationResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreForwardRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreIssueRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreLineAvailabilityResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreReceiveRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreReviewRequest;
import com.alsorg.packing.service.matflow.MatFlowRequisitionService;
import com.alsorg.packing.service.matflow.MatFlowWorkflowCoordinatorService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * Material Requisition + four-plant Store control boundary.
 *
 * P1 Production -> P1 Main Store directly.
 * P2/P3/P4 Production -> own Plant Store -> forward same MR -> P1 Main Store.
 * Only P1 Main Store reviews/reserves/raises PI. Ready material returns through
 * the origin Plant Store before the specific remote Production user receives it.
 */
@RestController
@RequestMapping("/api/matflow")
@PreAuthorize("isAuthenticated()")
public class MatFlowRequisitionController {
    private final MatFlowRequisitionService service;
    private final MatFlowWorkflowCoordinatorService workflowCoordinator;

    public MatFlowRequisitionController(
            MatFlowRequisitionService service,
            MatFlowWorkflowCoordinatorService workflowCoordinator) {
        this.service = service;
        this.workflowCoordinator = workflowCoordinator;
    }

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

    @GetMapping("/purchase-indents")
    public List<IndentResponse> purchaseIndents(
            @RequestParam(required = false) String plantCode) {
        validatePlantCode(plantCode);
        return service.listPurchaseIndents(plantCode);
    }

    /** Queue is plant-context aware: remote Stores see forwarding/handover work; P1 sees routed MRs. */
    @GetMapping("/store/requisitions")
    public List<RequisitionResponse> storeQueue(
            @RequestParam(required = false) String plantCode) {
        validatePlantCode(plantCode);
        return service.listStoreQueue(plantCode);
    }

    @GetMapping("/store/requisitions/{id}")
    public PlanningResponse storeDetail(@PathVariable UUID id) {
        return service.getPlanningSnapshot(id);
    }

    /** P2/P3/P4 Store forwards the same MR to P1 Main Store. */
    @PostMapping("/store/requisitions/{id}/forward-to-main-store")
    public RequisitionResponse forwardToMainStore(
            @PathVariable UUID id,
            @Valid @RequestBody StoreForwardRequest request) {
        return service.forwardRequisitionToMainStore(id, request);
    }

    /** Main Store-only centralized availability. */
    @GetMapping("/store/requisitions/{id}/availability")
    public List<StoreLineAvailabilityResponse> availability(@PathVariable UUID id) {
        return service.getStoreAvailability(id);
    }

    /** Main Store-only review/reservation/PI decision. */
    @PostMapping("/store/requisitions/{id}/review")
    public PlanningResponse review(
            @PathVariable UUID id,
            @Valid @RequestBody StoreReviewRequest request) {
        return service.reviewRequisition(id, request);
    }

    /** Current Store sends the complete lot along its already-saved custody route. */
    @PostMapping("/store/reservations/{reservationId}/issue")
    public PlanningResponse issueReservation(
            @PathVariable UUID reservationId,
            @Valid @RequestBody StoreIssueRequest request) {
        return workflowCoordinator.issueStoreReservation(reservationId, request);
    }

    /** P2/P3/P4 Store explicitly receives the inbound lot from P1 Main Store. */
    @PostMapping("/store/reservations/{reservationId}/receive")
    public PlanningResponse receiveAtOriginStore(
            @PathVariable UUID reservationId,
            @Valid @RequestBody StoreReceiveRequest request) {
        return workflowCoordinator.receiveAtOriginStore(reservationId, request);
    }

    @PostMapping("/reservations/{id}/release")
    public ReservationResponse releaseReservation(
            @PathVariable UUID id,
            @Valid @RequestBody ReservationReleaseRequest request) {
        return service.releaseReservation(id, request);
    }

    private void validatePlantCode(String plantCode) {
        if (plantCode != null && plantCode.length() > 32) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Plant code cannot exceed 32 characters");
        }
    }

}
