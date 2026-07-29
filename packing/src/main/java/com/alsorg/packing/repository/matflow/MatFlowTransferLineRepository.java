package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowTransferLine;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowTransferLineRepository
        extends JpaRepository<MatFlowTransferLine, UUID> {

    List<MatFlowTransferLine> findByTransferOrder_IdOrderByCreatedAtAsc(
            UUID transferOrderId);

    Optional<MatFlowTransferLine> findFirstByTransferOrder_IdOrderByCreatedAtAsc(
            UUID transferOrderId);
}