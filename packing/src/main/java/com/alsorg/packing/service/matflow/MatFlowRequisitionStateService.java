package com.alsorg.packing.service.matflow;

import com.alsorg.packing.domain.matflow.MatFlowMaterialRequisition;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionStatus;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionLine;

import com.alsorg.packing.repository.matflow.MatFlowMaterialRequisitionRepository;
import com.alsorg.packing.repository.matflow.MatFlowRequisitionLineRepository;

import java.math.BigDecimal;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MatFlowRequisitionStateService {

    private final MatFlowMaterialRequisitionRepository requisitionRepository;

    private final MatFlowRequisitionLineRepository lineRepository;

    public MatFlowRequisitionStateService(
            MatFlowMaterialRequisitionRepository requisitionRepository,
            MatFlowRequisitionLineRepository lineRepository) {

        this.requisitionRepository = requisitionRepository;

        this.lineRepository = lineRepository;
    }

    @Transactional
    public void refresh(
            UUID requisitionId,
            String actor) {

        MatFlowMaterialRequisition requisition = requisitionRepository
                .lockById(
                        requisitionId)
                .orElseThrow();

        if (requisition.status == RequisitionStatus.CANCELLED ||
                requisition.status == RequisitionStatus.PRODUCTION_COMPLETED) {

            return;
        }

        List<MatFlowRequisitionLine> lines = lineRepository
                .findByRequisition_IdOrderByLineNoAsc(
                        requisitionId);

        if (lines.isEmpty()) {
            return;
        }

        boolean allIssued = lines.stream()
                .allMatch(line -> zero(
                        line.issuedQty)
                        .compareTo(
                                zero(
                                        line.requestedQty)) >= 0);

        boolean anyIssued = lines.stream()
                .anyMatch(line -> zero(
                        line.issuedQty)
                        .compareTo(
                                BigDecimal.ZERO) > 0);

        boolean anyShortage = lines.stream()
                .anyMatch(line -> zero(
                        line.shortageQty)
                        .compareTo(
                                BigDecimal.ZERO) > 0);

        boolean allReserved = lines.stream()
                .allMatch(line -> zero(
                        line.reservedQty)
                        .compareTo(
                                zero(
                                        line.requestedQty)) >= 0);

        /*
         * Keep shortages visible until Purchase/GRN/QC
         * replenishment removes the shortage.
         */
        if (allIssued) {

            requisition.status = RequisitionStatus.ISSUED_TO_PRODUCTION;

        } else if (anyShortage) {

            requisition.status = RequisitionStatus.SHORTAGE_PENDING;

        } else if (anyIssued) {

            requisition.status = RequisitionStatus.PARTIALLY_ISSUED;

        } else if (allReserved) {

            /*
             * Material may still be in transfer or processing.
             * READY_TO_ISSUE should later be applied when every
             * reservation is physically issue-ready.
             */
            requisition.status = RequisitionStatus.PLANNED;
        }

        requisition.setUpdatedBy(
                actor);

        requisitionRepository.save(
                requisition);
    }

    private BigDecimal zero(
            BigDecimal value) {

        return value == null
                ? BigDecimal.ZERO
                : value;
    }
}