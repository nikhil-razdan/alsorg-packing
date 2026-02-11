package com.alsorg.packing.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.alsorg.packing.domain.common.ApprovalStatus;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;

@Repository
public interface DispatchedItemRepository extends JpaRepository<DispatchedItem, String> {

    // ===================== STATUS =====================

    List<DispatchedItem> findByStatus(ItemDispatchStatus status);

    List<DispatchedItem> findByStatusIn(List<ItemDispatchStatus> statuses);

    long countByStatus(ItemDispatchStatus status);   // ✅ ADD THIS

    // ===================== APPROVAL =====================

    List<DispatchedItem> findByApprovalStatus(ApprovalStatus status);

    List<DispatchedItem> findByStatusAndApprovalStatus(
            ItemDispatchStatus status,
            ApprovalStatus approvalStatus
    );

    // ===================== EXISTS =====================

    boolean existsByZohoItemId(String zohoItemId);
}
