package com.alsorg.packing.service.bomflow;

import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.BomDetailResponse;
import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.BomItemResponse;
import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.BomListResponse;
import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.BomRevisionResponse;
import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.RevisionDetailResponse;
import com.alsorg.packing.domain.bomflow.BomFlowBom;
import com.alsorg.packing.domain.bomflow.BomFlowItem;
import com.alsorg.packing.domain.bomflow.BomFlowRevision;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

@Component
public class BomFlowMapper {

    public BomListResponse toBomResponse(
            BomFlowBom bom) {

        return new BomListResponse(
                bom.id,
                bom.bomNo,
                bom.plantCode,
                bom.pdNo,
                bom.drawingNo,
                bom.projectCode,
                bom.clientName,
                bom.productName,
                bom.productCode,
                bom.productDescription,
                bom.currentRevisionNo,
                bom.status,
                bom.remarks,
                bom.createdBy,
                bom.createdAt,
                bom.updatedBy,
                bom.updatedAt,
                bom.rowVersion);
    }

    public BomItemResponse toItemResponse(
            BomFlowItem item) {

        return new BomItemResponse(
                item.id,
                item.revisionId,
                item.lineNo,
                item.category,
                item.subCategory,
                item.inventoryItemId,
                item.itemCode,
                item.itemName,
                item.itemDescription,
                item.specification,
                item.grade,
                item.brand,
                item.finish,
                item.colour,
                item.thickness,
                item.size,
                item.length,
                item.width,
                item.height,
                item.baseQty,
                item.wastagePercent,
                item.requiredQty,
                item.unit,
                item.unitRate,
                item.materialAmount,
                item.processingAmount,
                item.totalAmount,
                item.storeIssueRequired,
                item.active,
                item.remarks,
                item.createdBy,
                item.createdAt,
                item.updatedBy,
                item.updatedAt,
                item.rowVersion);
    }

    public BomRevisionResponse toRevisionResponse(
            BomFlowRevision revision,
            List<BomFlowItem> items) {

        List<BomFlowItem> activeItems = items == null
                ? List.of()
                : items.stream()
                        .filter(item -> item.active)
                        .toList();

        BigDecimal materialTotal = activeItems.stream()
                .map(item -> zero(
                        item.materialAmount))
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add);

        BigDecimal processingTotal = activeItems.stream()
                .map(item -> zero(
                        item.processingAmount))
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add);

        BigDecimal grandTotal = activeItems.stream()
                .map(item -> zero(
                        item.totalAmount))
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add);

        return new BomRevisionResponse(
                revision.id,
                revision.bomId,
                revision.revisionNo,
                revision.status,
                revision.revisionReason,
                revision.engineeringRemarks,
                revision.bomDocumentAttachmentId,
                revision.drawingAttachmentId,
                revision.sampleAttachmentId,
                revision.preparedBy,
                revision.preparedAt,
                revision.submittedBy,
                revision.submittedAt,
                revision.approvedBy,
                revision.approvedAt,
                revision.returnedBy,
                revision.returnedAt,
                revision.returnRemarks,
                revision.releasedBy,
                revision.releasedAt,
                activeItems.size(),
                materialTotal,
                processingTotal,
                grandTotal,
                revision.rowVersion);
    }

    public RevisionDetailResponse toRevisionDetailResponse(
            BomFlowBom bom,
            BomFlowRevision revision,
            List<BomFlowItem> items) {

        return new RevisionDetailResponse(
                toBomResponse(bom),
                toRevisionResponse(
                        revision,
                        items),
                items.stream()
                        .map(this::toItemResponse)
                        .toList());
    }

    public BomDetailResponse toBomDetailResponse(
            BomFlowBom bom,
            List<BomFlowRevision> revisions,
            BomFlowRevision currentRevision,
            List<BomFlowItem> currentItems,
            java.util.Map<java.util.UUID, List<BomFlowItem>> itemsByRevision) {

        List<BomRevisionResponse> revisionResponses = revisions.stream()
                .map(revision -> toRevisionResponse(
                        revision,
                        itemsByRevision
                                .getOrDefault(
                                        revision.id,
                                        List.of())))
                .toList();

        return new BomDetailResponse(
                toBomResponse(bom),
                revisionResponses,
                toRevisionResponse(
                        currentRevision,
                        currentItems),
                currentItems.stream()
                        .map(this::toItemResponse)
                        .toList());
    }

    private BigDecimal zero(
            BigDecimal value) {

        return value == null
                ? BigDecimal.ZERO
                : value;
    }
}