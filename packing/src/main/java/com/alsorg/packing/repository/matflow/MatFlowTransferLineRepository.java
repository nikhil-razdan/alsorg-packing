package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowTransferLine;

import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MatFlowTransferLineRepository
        extends JpaRepository<MatFlowTransferLine, UUID> {

    List<MatFlowTransferLine> findByTransferOrder_IdOrderByCreatedAtAsc(UUID transferOrderId);

    Optional<MatFlowTransferLine> findFirstByTransferOrder_IdOrderByCreatedAtAsc(UUID transferOrderId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select line
            from MatFlowTransferLine line
            where line.transferOrder.id = :transferOrderId
            order by line.createdAt asc, line.id asc
            """)
    List<MatFlowTransferLine> lockByTransferOrderId(
            @Param("transferOrderId") UUID transferOrderId);
}
