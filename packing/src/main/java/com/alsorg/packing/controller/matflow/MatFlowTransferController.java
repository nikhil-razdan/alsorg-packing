package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.ReservationResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.TransferActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.TransferResponse;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.TransferStatus;
import com.alsorg.packing.service.matflow.MatFlowTransferExecutionService;

import jakarta.validation.Valid;

import java.util.List;
import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/matflow")
@PreAuthorize("isAuthenticated()")
public class MatFlowTransferController {

        private final MatFlowTransferExecutionService service;

        public MatFlowTransferController(
                        MatFlowTransferExecutionService service) {

                this.service = service;
        }

        @GetMapping("/transfers")
        public List<TransferResponse> transfers(
                        @RequestParam(required = false) TransferStatus status,

                        @RequestParam(required = false) String plantCode) {

                return service.list(
                                status,
                                plantCode);
        }

        @GetMapping("/transfers/{id}")
        public TransferResponse transfer(
                        @PathVariable UUID id) {

                return service.get(id);
        }

        @PostMapping("/transfers/{id}/dispatch")
        public TransferResponse dispatch(
                        @PathVariable UUID id,

                        @Valid @RequestBody TransferActionRequest request) {

                return service.dispatch(
                                id,
                                request);
        }

        @PostMapping("/transfers/{id}/receive")
        public TransferResponse receive(
                        @PathVariable UUID id,

                        @Valid @RequestBody TransferActionRequest request) {

                return service.receive(
                                id,
                                request);
        }

        @PostMapping("/reservations/{id}/issue-direct")
        public ReservationResponse issueDirect(
                        @PathVariable UUID id,

                        @Valid @RequestBody TransferActionRequest request) {

                return service.issueDirectReservation(
                                id,
                                request);
        }
}