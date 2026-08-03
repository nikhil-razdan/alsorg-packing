package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionActionRequest;
import com.alsorg.packing.service.matflow.MatFlowStoreWorkflowService;

import jakarta.validation.Valid;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;

import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/matflow/indents")
@PreAuthorize("isAuthenticated()")
public class MatFlowIndentController {

    private final MatFlowStoreWorkflowService storeWorkflowService;

    public MatFlowIndentController(
            MatFlowStoreWorkflowService storeWorkflowService) {

        this.storeWorkflowService = storeWorkflowService;
    }

    @PatchMapping("/{id}/submit-to-purchase")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void submitToPurchase(
            @PathVariable UUID id,

            @Valid @RequestBody RequisitionActionRequest request) {

        storeWorkflowService
                .submitIndentToPurchase(
                        id,
                        request);
    }
}