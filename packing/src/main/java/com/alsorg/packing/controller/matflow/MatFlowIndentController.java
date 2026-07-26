package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowIndentDtos.CreateIndentRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowIndentDtos.IndentActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowIndentDtos.IndentDetailResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowIndentDtos.SaveIndentLineRequest;

import com.alsorg.packing.service.matflow.MatFlowIndentService;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/matflow/indents")
public class MatFlowIndentController {

    private final MatFlowIndentService service;

    public MatFlowIndentController(
            MatFlowIndentService service) {

        this.service = service;
    }

    @PostMapping
    public IndentDetailResponse createDraft(
            @RequestBody
            CreateIndentRequest req) {

        return service.createDraft(req);
    }

    @PostMapping("/{indentId}/lines")
    public IndentDetailResponse saveLine(
            @PathVariable
            UUID indentId,

            @RequestBody
            SaveIndentLineRequest req) {

        return service.saveLine(
                indentId,
                req
        );
    }

    @DeleteMapping("/{indentId}/lines/{lineId}")
    public IndentDetailResponse removeLine(
            @PathVariable
            UUID indentId,

            @PathVariable
            UUID lineId,

            @RequestParam
            Long rowVersion) {

        return service.removeLine(
                indentId,
                lineId,
                rowVersion
        );
    }

    @PatchMapping("/{indentId}/submit-to-purchase")
    public IndentDetailResponse submitToPurchase(
            @PathVariable
            UUID indentId,

            @RequestBody
            IndentActionRequest req) {

        return service.submitToPurchase(
                indentId,
                req
        );
    }

    @PatchMapping("/{indentId}/cancel")
    public IndentDetailResponse cancel(
            @PathVariable
            UUID indentId,

            @RequestBody
            IndentActionRequest req) {

        return service.cancel(
                indentId,
                req
        );
    }

    @GetMapping("/{indentId}")
    public IndentDetailResponse detail(
            @PathVariable
            UUID indentId) {

        return service.detail(indentId);
    }

    @GetMapping("/by-requisition/{requisitionId}")
    public List<IndentDetailResponse> byRequisition(
            @PathVariable
            UUID requisitionId) {

        return service.byRequisition(
                requisitionId
        );
    }
}