package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowGoodsReceipt;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowGoodsReceiptRepository
        extends JpaRepository<MatFlowGoodsReceipt, UUID> {

    List<MatFlowGoodsReceipt> findAllByOrderByReceivedAtDesc();

    Page<MatFlowGoodsReceipt> findAllByOrderByReceivedAtDesc(Pageable pageable);

    List<MatFlowGoodsReceipt> findByPurchaseOrder_IdOrderByReceivedAtAsc(UUID purchaseOrderId);

    Page<MatFlowGoodsReceipt> findByPurchaseOrder_IdOrderByReceivedAtAsc(
            UUID purchaseOrderId,
            Pageable pageable);
}
