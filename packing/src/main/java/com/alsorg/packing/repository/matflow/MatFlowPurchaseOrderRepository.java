package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPurchaseOrder;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MatFlowPurchaseOrderRepository
        extends JpaRepository<MatFlowPurchaseOrder, UUID> {

    List<MatFlowPurchaseOrder> findByIndentIdOrderByCreatedAtDesc(
            UUID indentId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select purchaseOrder
            from MatFlowPurchaseOrder purchaseOrder
            where purchaseOrder.id = :purchaseOrderId
            """)
    Optional<MatFlowPurchaseOrder> findByIdForUpdate(
            @Param("purchaseOrderId") UUID purchaseOrderId);
}