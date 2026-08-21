package com.alsorg.packing.bomflow.service;

import com.alsorg.packing.bomflow.dto.BomFlowProductDtos.ProductResponse;
import com.alsorg.packing.bomflow.dto.BomFlowRevisionDtos.RevisionDetailResponse;
import com.alsorg.packing.bomflow.dto.BomFlowRevisionDtos.RevisionItemResponse;
import com.alsorg.packing.bomflow.dto.BomFlowRevisionDtos.RevisionSummaryResponse;

import com.alsorg.packing.bomflow.domain.BomFlowProduct;
import com.alsorg.packing.bomflow.domain.BomFlowRevision;
import com.alsorg.packing.bomflow.domain.BomFlowRevisionItem;

import com.alsorg.packing.bomflow.repository.BomFlowRevisionItemRepository;
import com.alsorg.packing.bomflow.repository.BomFlowRevisionRepository;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

@Component
public class BomFlowMapper {

    private final BomFlowRevisionRepository revisionRepository;
    private final BomFlowRevisionItemRepository itemRepository;

    public BomFlowMapper(
            BomFlowRevisionRepository revisionRepository,
            BomFlowRevisionItemRepository itemRepository) {

        this.revisionRepository = revisionRepository;
        this.itemRepository = itemRepository;
    }

    public ProductResponse toProductResponse(
            BomFlowProduct product) {

        BomFlowRevision latest = revisionRepository
                .findTopByProductIdOrderByRevisionNoDesc(product.id)
                .orElse(null);

        long revisionCount = revisionRepository
                .countByProductId(product.id);

        boolean hasProductImage = hasText(product.productImageStorageKey);
        boolean hasDrawingFile = hasText(product.drawingFileStorageKey);

        return new ProductResponse(
                product.id,
                product.productName,
                product.productCode,
                product.drawingNumber,
                product.category,
                product.collection,
                product.length,
                product.width,
                product.height,
                product.projectReference,
                product.clientEntity,
                product.status,
                product.currentRevisionNo,
                revisionCount,
                latest == null ? null : latest.id,
                latest == null ? null : latest.revisionNo,
                latest == null || latest.status == null
                        ? null
                        : latest.status.name(),
                hasProductImage,
                product.productImageOriginalName,
                product.productImageContentType,
                product.productImageSize,
                product.productImageUploadedBy,
                product.productImageUploadedAt,
                hasDrawingFile,
                product.drawingFileOriginalName,
                product.drawingFileContentType,
                product.drawingFileSize,
                product.drawingFileUploadedBy,
                product.drawingFileUploadedAt,
                product.createdBy,
                product.createdAt,
                product.updatedBy,
                product.updatedAt,
                product.rowVersion);
    }

    public RevisionSummaryResponse toRevisionSummary(
            BomFlowRevision revision) {

        List<BomFlowRevisionItem> items = itemRepository
                .findByRevisionIdOrderByLineNoAsc(revision.id);

        BigDecimal total = items.stream()
                .map(item -> zero(item.amount))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new RevisionSummaryResponse(
                revision.id,
                revision.product.id,
                revision.revisionNo,
                revision.revisionNo,
                revision.status,
                revision.remarks,
                items.size(),
                total,
                revision.createdBy,
                revision.createdAt,
                revision.updatedBy,
                revision.updatedAt,
                revision.rowVersion);
    }

    public RevisionDetailResponse toRevisionDetail(
            BomFlowRevision revision) {

        List<RevisionItemResponse> items = itemRepository
                .findByRevisionIdOrderByLineNoAsc(revision.id)
                .stream()
                .map(this::toRevisionItem)
                .toList();

        BomFlowProduct product = revision.product;

        return new RevisionDetailResponse(
                revision.id,
                product.id,
                product.productName,
                product.productCode,
                product.drawingNumber,
                product.category,
                product.collection,
                product.length,
                product.width,
                product.height,
                product.projectReference,
                product.projectReference,
                product.clientEntity,
                revision.revisionNo,
                revision.revisionNo,
                revision.status,
                revision.remarks,
                revision.submittedBy,
                revision.submittedAt,
                revision.verifiedBy,
                revision.verifiedAt,
                revision.approvedBy,
                revision.approvedAt,
                revision.returnedBy,
                revision.returnedAt,
                revision.returnRemarks,
                revision.createdBy,
                revision.createdAt,
                revision.updatedBy,
                revision.updatedAt,
                revision.rowVersion,
                items,
                items);
    }

    public RevisionItemResponse toRevisionItem(
            BomFlowRevisionItem item) {

        return new RevisionItemResponse(
                item.id,
                item.lineNo,
                item.section,
                item.category,
                item.itemName,
                item.itemName,
                item.brand,
                item.vendorName,
                item.unit,
                item.requiredQty,
                item.requiredQty,
                item.rate,
                item.amount,
                item.gstPercent,
                item.gstPercent,
                item.remarks,
                item.createdBy,
                item.createdAt,
                item.updatedBy,
                item.updatedAt,
                item.rowVersion);
    }

    private BigDecimal zero(
            BigDecimal value) {

        return value == null
                ? BigDecimal.ZERO
                : value;
    }

    private boolean hasText(
            String value) {

        return value != null
                && !value.trim().isEmpty();
    }
}
