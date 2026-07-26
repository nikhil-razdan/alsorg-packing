package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPurchaseOrderLine;
import com.alsorg.packing.domain.matflow.MatFlowPurchaseOrderStatus;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MatFlowPurchaseOrderLineRepository
        extends JpaRepository<MatFlowPurchaseOrderLine, UUID> {

    List<MatFlowPurchaseOrderLine>
    findByPurchaseOrderIdAndActiveTrueOrderBySourceLineNoAsc(
            UUID purchaseOrderId
    );

    Optional<MatFlowPurchaseOrderLine>
    findByPurchaseOrderIdAndIndentLineIdAndActiveTrue(
            UUID purchaseOrderId,
            UUID indentLineId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select line
            from MatFlowPurchaseOrderLine line
            where line.id = :lineId
              and line.purchaseOrderId = :purchaseOrderId
              and line.active = true
            """)
    Optional<MatFlowPurchaseOrderLine> findActiveLineForUpdate(
            @Param("purchaseOrderId")
            UUID purchaseOrderId,

            @Param("lineId")
            UUID lineId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select line
            from MatFlowPurchaseOrderLine line
            where line.purchaseOrderId = :purchaseOrderId
              and line.active = true
            order by line.sourceLineNo asc
            """)
    List<MatFlowPurchaseOrderLine> findActiveByPurchaseOrderIdForUpdate(
            @Param("purchaseOrderId")
            UUID purchaseOrderId
    );

    /*
     * Includes Draft and Pending Approval quantities so Purchase
     * cannot over-allocate the same indent shortage into several
     * simultaneous PO drafts.
     */
    @Query("""
            select coalesce(sum(line.orderedQty), 0)
            from MatFlowPurchaseOrderLine line
            where line.indentLineId = :indentLineId
              and line.active = true
            """)
    BigDecimal sumCommittedQtyByIndentLineId(
            @Param("indentLineId")
            UUID indentLineId
    );

    @Query("""
            select coalesce(sum(line.orderedQty), 0)
            from MatFlowPurchaseOrderLine line
            where line.matFlowLineId = :matFlowLineId
              and line.active = true
            """)
    BigDecimal sumCommittedQtyByMatFlowLineId(
            @Param("matFlowLineId")
            UUID matFlowLineId
    );

    @Query("""
            select coalesce(sum(line.orderedQty), 0)
            from MatFlowPurchaseOrderLine line
            where line.quoteLineId = :quoteLineId
              and line.active = true
            """)
    BigDecimal sumSelectedQtyByQuoteLineId(
            @Param("quoteLineId")
            UUID quoteLineId
    );

    @Query("""
            select coalesce(sum(line.orderedQty), 0)
            from MatFlowPurchaseOrderLine line
            join MatFlowPurchaseOrder purchaseOrder
              on purchaseOrder.id = line.purchaseOrderId
            where line.indentLineId = :indentLineId
              and line.active = true
              and purchaseOrder.status in :approvedStatuses
            """)
    BigDecimal sumApprovedOrderedQtyByIndentLineId(
            @Param("indentLineId")
            UUID indentLineId,

            @Param("approvedStatuses")
            List<MatFlowPurchaseOrderStatus> approvedStatuses
    );

    @Query("""
            select coalesce(sum(line.orderedQty), 0)
            from MatFlowPurchaseOrderLine line
            join MatFlowPurchaseOrder purchaseOrder
              on purchaseOrder.id = line.purchaseOrderId
            where line.matFlowLineId = :matFlowLineId
              and line.active = true
              and purchaseOrder.status in :approvedStatuses
            """)
    BigDecimal sumApprovedOrderedQtyByMatFlowLineId(
            @Param("matFlowLineId")
            UUID matFlowLineId,

            @Param("approvedStatuses")
            List<MatFlowPurchaseOrderStatus> approvedStatuses
    );
}