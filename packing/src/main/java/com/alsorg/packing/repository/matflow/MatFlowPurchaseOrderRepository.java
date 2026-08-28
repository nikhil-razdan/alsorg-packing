package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPurchaseOrder;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowPurchaseOrderRepository
        extends JpaRepository<MatFlowPurchaseOrder, UUID> {

    boolean existsByPoNumberIgnoreCase(String poNumber);

    boolean existsByPoNumberIgnoreCaseAndIdNot(String poNumber, UUID id);

    List<MatFlowPurchaseOrder> findAllByOrderByUpdatedAtDesc();

    Page<MatFlowPurchaseOrder> findAllByOrderByUpdatedAtDesc(Pageable pageable);

    List<MatFlowPurchaseOrder> findByIndent_Id(UUID indentId);
}
