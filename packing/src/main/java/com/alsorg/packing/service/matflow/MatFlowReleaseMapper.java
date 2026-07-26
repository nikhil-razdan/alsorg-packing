package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowReleaseDtos.MatFlowLineResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowReleaseDtos.MatFlowReleaseDetailResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowReleaseDtos.MatFlowReleaseResponse;

import com.alsorg.packing.domain.matflow.MatFlowLine;
import com.alsorg.packing.domain.matflow.MatFlowRelease;

import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class MatFlowReleaseMapper {

    public MatFlowReleaseResponse toReleaseResponse(
            MatFlowRelease release) {

        return new MatFlowReleaseResponse(
                release.id,

                release.sourceBomId,
                release.sourceRevisionId,
                release.sourceRevisionNo,

                release.bomNo,
                release.plantCode,
                release.pdNo,
                release.drawingNo,
                release.projectCode,

                release.clientName,
                release.productName,
                release.productCode,
                release.productDescription,

                release.status,

                release.releasedLineCount,
                release.skippedLineCount,

                release.previousReleaseId,
                release.supersededByReleaseId,

                release.releaseRemarks,

                release.releasedBy,
                release.releasedAt,

                release.updatedBy,
                release.updatedAt,

                release.rowVersion);
    }

    public MatFlowLineResponse toLineResponse(
            MatFlowLine line) {

        return new MatFlowLineResponse(
                line.id,
                line.releaseId,

                line.sourceBomItemId,
                line.sourceLineNo,

                line.category,
                line.subCategory,

                line.inventoryItemId,
                line.itemCode,
                line.itemName,
                line.itemDescription,

                line.specification,
                line.grade,
                line.brand,
                line.finish,
                line.colour,

                line.thickness,
                line.size,

                line.length,
                line.width,
                line.height,

                line.baseQty,
                line.wastagePercent,
                line.requiredQty,

                line.unit,

                line.unitRate,
                line.materialAmount,
                line.processingAmount,
                line.totalAmount,

                line.storeIssueRequired,

                line.requisitionedQty,
                line.blockedQty,
                line.shortageQty,
                line.indentedQty,
                line.orderedQty,
                line.receivedQty,
                line.acceptedQty,
                line.rejectedQty,
                line.holdQty,
                line.issuedQty,

                line.status,
                line.active,

                line.rowVersion);
    }

    public MatFlowReleaseDetailResponse toDetailResponse(
            MatFlowRelease release,
            List<MatFlowLine> lines) {

        return new MatFlowReleaseDetailResponse(
                toReleaseResponse(
                        release),

                lines.stream()
                        .map(this::toLineResponse)
                        .toList());
    }
}