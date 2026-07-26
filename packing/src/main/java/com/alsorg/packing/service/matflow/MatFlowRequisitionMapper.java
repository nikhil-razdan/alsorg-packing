package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowRequisitionDtos.RequisitionDetailResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowRequisitionDtos.RequisitionLineResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowRequisitionDtos.RequisitionListResponse;

import com.alsorg.packing.domain.matflow.MatFlowRequisition;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionLine;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

@Component
public class MatFlowRequisitionMapper {

    public RequisitionDetailResponse toDetailResponse(
            MatFlowRequisition requisition,
            List<MatFlowRequisitionLine> lines) {

        List<RequisitionLineResponse> lineResponses = lines.stream()
                .map(this::toLineResponse)
                .toList();

        return new RequisitionDetailResponse(
                requisition.id,
                requisition.requisitionNo,
                requisition.releaseId,

                requisition.plantCode,
                requisition.pdNo,
                requisition.drawingNo,
                requisition.projectCode,
                requisition.clientName,
                requisition.productName,
                requisition.productCode,

                requisition.requiredByDate,
                requisition.productionDepartment,
                requisition.requestedFor,

                requisition.status,

                requisition.createdBy,
                requisition.createdAt,

                requisition.submittedBy,
                requisition.submittedAt,

                requisition.remarks,
                requisition.rowVersion,

                lineResponses);
    }

    public RequisitionLineResponse toLineResponse(
            MatFlowRequisitionLine line) {

        return new RequisitionLineResponse(
                line.id,
                line.matFlowLineId,
                line.sourceBomItemId,
                line.sourceLineNo,
                line.itemCode,
                line.itemName,
                line.itemDescription,
                line.specification,

                zero(line.requestedQty),
                zero(line.blockedQty),
                zero(line.shortageQty),
                zero(line.issuedQty),

                line.unit,
                line.status,
                line.productionRemarks,

                line.rowVersion);
    }

    public RequisitionListResponse toListResponse(
            MatFlowRequisition requisition,
            List<MatFlowRequisitionLine> lines) {

        BigDecimal totalRequestedQty = lines.stream()
                .map(line -> zero(
                        line.requestedQty))
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add);

        return new RequisitionListResponse(
                requisition.id,
                requisition.requisitionNo,
                requisition.releaseId,

                requisition.plantCode,
                requisition.pdNo,
                requisition.drawingNo,
                requisition.clientName,
                requisition.productName,

                requisition.requiredByDate,
                requisition.productionDepartment,
                requisition.requestedFor,

                requisition.status,

                lines.size(),
                totalRequestedQty,

                requisition.createdBy,
                requisition.createdAt,
                requisition.submittedBy,
                requisition.submittedAt,

                requisition.rowVersion);
    }

    private BigDecimal zero(
            BigDecimal value) {

        return value == null
                ? BigDecimal.ZERO
                : value;
    }
}