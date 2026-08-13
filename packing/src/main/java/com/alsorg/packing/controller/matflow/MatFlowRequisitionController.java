package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.RequisitionCancelRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.ReservationReleaseRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.IndentResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.PlanningResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionCreateRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.ReservationResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreIssueRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreLineAvailabilityResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreReviewRequest;
import com.alsorg.packing.service.matflow.MatFlowWorkflowCoordinatorService;
import com.alsorg.packing.service.matflow.MatFlowRequisitionService;
import com.alsorg.packing.service.matflow.MatFlowSafeDeleteService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Material Requisition + Store control boundary.
 *
 * Production raises/submits the MR. Store allocates Store stock and makes two
 * independent per-lot decisions: whether QC is required and whether Processing
 * is required. If Processing is selected, Store chooses one BOM-approved unit.
 * QC has no location/routing authority. Internal custody rows remain hidden.
 */
@RestController
@RequestMapping("/api/matflow")
@PreAuthorize("isAuthenticated()")
public class MatFlowRequisitionController {
    private final MatFlowRequisitionService service;
    private final MatFlowWorkflowCoordinatorService workflowCoordinator;
    private final MatFlowSafeDeleteService safeDeleteService;

    public MatFlowRequisitionController(
            MatFlowRequisitionService service,
            MatFlowWorkflowCoordinatorService workflowCoordinator,
            MatFlowSafeDeleteService safeDeleteService) {
        this.service = service;
        this.workflowCoordinator = workflowCoordinator;
        this.safeDeleteService = safeDeleteService;
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

    @DeleteMapping("/requisitions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDraftRequisition(
            @PathVariable UUID id,
            @RequestParam Long rowVersion) {
        safeDeleteService.deleteDraftRequisition(id, rowVersion);
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
        return service.listPurchaseIndents(plantCode);
    }

    @GetMapping("/store/requisitions")
    public List<RequisitionResponse> storeQueue(
            @RequestParam(required = false) String plantCode) {
        return service.listStoreQueue(plantCode);
    }

    @GetMapping("/store/requisitions/{id}")
    public PlanningResponse storeDetail(@PathVariable UUID id) {
        return service.getPlanningSnapshot(id);
    }

    @GetMapping("/store/requisitions/{id}/availability")
    public List<StoreLineAvailabilityResponse> availability(@PathVariable UUID id) {
        return service.getStoreAvailability(id);
    }

    @PostMapping("/store/requisitions/{id}/review")
    public PlanningResponse review(
            @PathVariable UUID id,
            @Valid @RequestBody StoreReviewRequest request) {
        return service.reviewRequisition(id, request);
    }

    /** Store sends one complete allocated lot along its saved Processing/Production route. */
    @PostMapping("/store/reservations/{reservationId}/issue")
    public PlanningResponse issueReservation(
            @PathVariable UUID reservationId,
            @Valid @RequestBody StoreIssueRequest request) {
        return workflowCoordinator.issueStoreReservation(reservationId, request);
    }

    @PostMapping("/reservations/{id}/release")
    public ReservationResponse releaseReservation(
            @PathVariable UUID id,
            @Valid @RequestBody ReservationReleaseRequest request) {
        return service.releaseReservation(id, request);
    }
}
