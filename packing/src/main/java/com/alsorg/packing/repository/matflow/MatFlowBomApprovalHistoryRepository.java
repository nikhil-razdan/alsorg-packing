package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowBomApprovalHistory;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowBomApprovalHistoryRepository
        extends JpaRepository<MatFlowBomApprovalHistory, UUID> {

    List<MatFlowBomApprovalHistory> findByBomIdOrderByActionAtAsc(
            UUID bomId);
}