package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPurchaseOrderLine;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowPurchaseOrderLineRepository
        extends JpaRepository<MatFlowPurchaseOrderLine, UUID> {

    List<MatFlowPurchaseOrderLine> findByPurchaseOrder_IdOrderByCreatedAtAsc(UUID purchaseOrderId);

    Optional<MatFlowPurchaseOrderLine> findByIdAndPurchaseOrder_Id(UUID id, UUID purchaseOrderId);

    List<MatFlowPurchaseOrderLine> findByIndentLine_Id(UUID indentLineId);
}
