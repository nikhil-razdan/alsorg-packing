package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowGoodsReceiptLine;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for lines posted against MatFlow Goods Receipts (GRNs).
 *
 * The purchaseOrderLine association is intentionally queryable because
 * procurement reconciliation must be able to aggregate all GRN/QC outcomes
 * created against a particular PO line. This is especially important when a
 * PO line has multiple partial GRNs or QC-rejected quantities that must reopen
 * purchasing capacity for replacement material.
 */
public interface MatFlowGoodsReceiptLineRepository
                extends JpaRepository<MatFlowGoodsReceiptLine, UUID> {

        /**
         * All lines belonging to one GRN, oldest first.
         */
        List<MatFlowGoodsReceiptLine> findByGoodsReceipt_IdOrderByCreatedAtAsc(
                        UUID goodsReceiptId);

        /**
         * Defensive child lookup used when an operation already knows the GRN.
         */
        Optional<MatFlowGoodsReceiptLine> findByIdAndGoodsReceipt_Id(
                        UUID id,
                        UUID goodsReceiptId);

        /**
         * Compatibility query used by the current MatFlow procurement workflow.
         *
         * Spring Data resolves this through:
         * MatFlowGoodsReceiptLine.purchaseOrderLine.id
         */
        List<MatFlowGoodsReceiptLine> findByPurchaseOrderLine_Id(
                        UUID purchaseOrderLineId);

        /**
         * Preferred deterministic form for reconciliation code.
         */
        List<MatFlowGoodsReceiptLine> findByPurchaseOrderLine_IdOrderByCreatedAtAsc(
                        UUID purchaseOrderLineId);
}
