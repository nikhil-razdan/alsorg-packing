package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.PlanningRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.PlanningResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreLineAvailabilityResponse;
import com.alsorg.packing.service.matflow.MatFlowStoreWorkflowService;

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
@RequestMapping("/api/matflow/store")
@PreAuthorize("isAuthenticated()")
public class MatFlowStoreController {

        private final MatFlowStoreWorkflowService service;

        public MatFlowStoreController(
                MatFlowStoreWorkflowService service) {

                this.service = service;
        }

        @GetMapping("/requisitions")
        public List<RequisitionResponse> queue(
                @RequestParam(required = false)
                String plantCode) {

                return service.listStoreQueue(
                        plantCode);
        }

        @GetMapping("/requisitions/{id}")
        public PlanningResponse detail(
                @PathVariable UUID id) {

                return service.getStorePlanning(
                        id);
        }

        @GetMapping("/requisitions/{id}/availability")
        public List<StoreLineAvailabilityResponse> availability(
                @PathVariable UUID id) {

                return service.getAvailability(
                        id);
        }

        @PostMapping("/requisitions/{id}/review")
        public PlanningResponse confirmReview(
                @PathVariable UUID id,

                @Valid
                @RequestBody
                PlanningRequest request) {

                return service.confirmStoreReview(
                        id,
                        request);
        }
}