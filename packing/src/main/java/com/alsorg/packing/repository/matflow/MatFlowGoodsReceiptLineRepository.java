package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowGoodsReceiptLine;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowGoodsReceiptLineRepository
        extends JpaRepository<MatFlowGoodsReceiptLine, UUID> {

    List<MatFlowGoodsReceiptLine> findByGoodsReceipt_IdOrderByCreatedAtAsc(UUID goodsReceiptId);

    Optional<MatFlowGoodsReceiptLine> findByIdAndGoodsReceipt_Id(UUID id, UUID goodsReceiptId);

    List<MatFlowGoodsReceiptLine> findByPurchaseOrderLine_Id(UUID purchaseOrderLineId);

    List<MatFlowGoodsReceiptLine> findByPurchaseOrderLine_IdOrderByCreatedAtAsc(
            UUID purchaseOrderLineId);
}
