package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowRequisitionDtos.CreateRequisitionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowRequisitionDtos.RequisitionActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowRequisitionDtos.RequisitionDetailResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowRequisitionDtos.SaveRequisitionLineRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowRequisitionDtos.UpdateRequisitionRequest;
import com.alsorg.packing.service.matflow.MatFlowRequisitionService;

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
@RequestMapping("/api/matflow/requisitions")
public class MatFlowRequisitionController {

        private final MatFlowRequisitionService service;

        public MatFlowRequisitionController(
                        MatFlowRequisitionService service) {

                this.service = service;
        }

        /*
         * Production creates an empty Draft requisition header.
         */
        @PostMapping
        public RequisitionDetailResponse createDraft(
                        @RequestBody CreateRequisitionRequest req) {

                return service.createDraft(
                                req);
        }

        /*
         * Production adds or updates one material line.
         *
         * The MatFlow line ID is inside the request body.
         */
        @PostMapping("/{requisitionId}/lines")
        public RequisitionDetailResponse saveLine(
                        @PathVariable UUID requisitionId,
                        @RequestBody SaveRequisitionLineRequest req) {

                return service.saveLine(
                                requisitionId,
                                req);
        }

        /*
         * Remove one line while the requisition is still Draft.
         *
         * rowVersion protects the requisition against concurrent edits.
         */
        @DeleteMapping("/{requisitionId}/lines/{lineId}")
        public RequisitionDetailResponse removeLine(
                        @PathVariable UUID requisitionId,
                        @PathVariable UUID lineId,
                        @RequestParam Long rowVersion) {

                return service.removeLine(
                                requisitionId,
                                lineId,
                                rowVersion);
        }

        /*
         * Production submits the completed requisition to Store.
         */
        @PatchMapping("/{requisitionId}/submit-to-store")
        public RequisitionDetailResponse submitToStore(
                        @PathVariable UUID requisitionId,
                        @RequestBody RequisitionActionRequest req) {

                return service.submitToStore(
                                requisitionId,
                                req);
        }

        /*
         * Production cancels a Draft or Returned requisition.
         */
        @PatchMapping("/{requisitionId}/cancel")
        public RequisitionDetailResponse cancel(
                        @PathVariable UUID requisitionId,
                        @RequestBody RequisitionActionRequest req) {

                return service.cancel(
                                requisitionId,
                                req);
        }

        @GetMapping("/{requisitionId}")
        public RequisitionDetailResponse detail(
                        @PathVariable UUID requisitionId) {

                return service.detail(
                                requisitionId);
        }

        @GetMapping("/by-release/{releaseId}")
        public List<RequisitionDetailResponse> byRelease(
                        @PathVariable UUID releaseId) {

                return service.byRelease(
                                releaseId);
        }

        @PatchMapping("/{requisitionId}")
        public RequisitionDetailResponse updateHeader(
                        @PathVariable UUID requisitionId,

                        @RequestBody UpdateRequisitionRequest req) {

                return service.updateHeader(
                                requisitionId,
                                req);
        }
}