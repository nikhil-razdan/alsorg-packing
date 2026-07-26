package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowIndentDtos.IndentDetailResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowIndentDtos.IndentLineResponse;

import com.alsorg.packing.domain.matflow.MatFlowIndent;
import com.alsorg.packing.domain.matflow.MatFlowIndentLine;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

@Component
public class MatFlowIndentMapper {

    public IndentDetailResponse toDetailResponse(
            MatFlowIndent indent,
            List<MatFlowIndentLine> lines) {

        return new IndentDetailResponse(
                indent.id,
                indent.indentNo,

                indent.requisitionId,
                indent.releaseId,
                indent.requisitionNo,

                indent.plantCode,
                indent.pdNo,
                indent.drawingNo,
                indent.projectCode,
                indent.clientName,
                indent.productName,
                indent.productionDepartment,

                indent.requiredByDate,

                indent.status,

                indent.createdBy,
                indent.createdAt,

                indent.submittedBy,
                indent.submittedAt,

                indent.remarks,
                indent.rowVersion,

                lines.stream()
                        .map(this::toLineResponse)
                        .toList()
        );
    }

    public IndentLineResponse toLineResponse(
            MatFlowIndentLine line) {

        return new IndentLineResponse(
                line.id,
                line.requisitionLineId,
                line.matFlowLineId,
                line.sourceBomItemId,
                line.sourceLineNo,

                line.itemCode,
                line.itemName,
                line.itemDescription,
                line.specification,

                zero(line.shortageQtySnapshot),
                zero(line.indentQty),
                zero(line.orderedQty),
                zero(line.receivedQty),

                line.unit,
                line.status,
                line.remarks,

                line.rowVersion
        );
    }

    private BigDecimal zero(
            BigDecimal value) {

        return value == null
                ? BigDecimal.ZERO
                : value;
    }
}