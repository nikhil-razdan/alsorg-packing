package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.RequisitionCancelRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.ReservationReleaseRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.ReservationResponse;
import com.alsorg.packing.service.matflow.MatFlowControlService;

import jakarta.validation.Valid;

import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/matflow")
@PreAuthorize("isAuthenticated()")
public class MatFlowControlController {

    private final MatFlowControlService service;

    public MatFlowControlController(
            MatFlowControlService service) {

        this.service = service;
    }

    @PostMapping("/reservations/{id}/release")
    public ReservationResponse releaseReservation(
            @PathVariable UUID id,

            @Valid @RequestBody ReservationReleaseRequest request) {

        return service.releaseReservation(
                id,
                request);
    }

    @PostMapping("/requisitions/{id}/cancel")
    public RequisitionResponse cancelRequisition(
            @PathVariable UUID id,

            @Valid @RequestBody RequisitionCancelRequest request) {

        return service.cancelRequisition(
                id,
                request);
    }
}