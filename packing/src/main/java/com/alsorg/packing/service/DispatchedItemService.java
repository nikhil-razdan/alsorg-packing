package com.alsorg.packing.service;

import java.time.LocalDateTime;

import org.springframework.stereotype.Service;

import com.alsorg.packing.domain.common.ApprovalStatus;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.repository.DispatchedItemRepository;

import jakarta.transaction.Transactional;

@Service
@Transactional
public class DispatchedItemService {

    private final DispatchedItemRepository dispatchedRepo;

    public DispatchedItemService(DispatchedItemRepository dispatchedRepo) {
        this.dispatchedRepo = dispatchedRepo;
    }

    /* ================= USER ACTION ================= */

    public void requestRestore(String zohoItemId, String username) {

        DispatchedItem item = dispatchedRepo.findById(zohoItemId)
                .orElseThrow(() -> new IllegalStateException("Item not found"));

        // ✅ Only PACKED / DISPATCHED items can be restored
        if (item.getStatus() != ItemDispatchStatus.PACKED &&
            item.getStatus() != ItemDispatchStatus.DISPATCHED) {
            throw new IllegalStateException("Item cannot be restored in current state");
        }

        // ✅ Prevent duplicate requests
        if (item.getApprovalStatus() == ApprovalStatus.PENDING) {
            throw new IllegalStateException("Restore already requested");
        }

        item.setApprovalStatus(ApprovalStatus.PENDING);
        item.setApprovalRequestedBy(username);
        item.setApprovalRequestedAt(LocalDateTime.now());

        dispatchedRepo.save(item);
    }

    /* ================= ADMIN ACTION ================= */

    public void approveRestore(String zohoItemId, String admin) {

        DispatchedItem item = dispatchedRepo.findById(zohoItemId)
                .orElseThrow(() -> new IllegalStateException("Item not found"));

        if (item.getApprovalStatus() != ApprovalStatus.PENDING) {
            throw new IllegalStateException("No pending restore request");
        }

        item.setApprovalStatus(ApprovalStatus.APPROVED);
        item.setApprovedBy(admin);
        item.setApprovedAt(LocalDateTime.now());

        // ✅ Restore back to inventory
        item.setStock(1);               // IMPORTANT: never null
        item.setStatus(ItemDispatchStatus.AVAILABLE);

        // Remove from dispatched list entirely
        dispatchedRepo.delete(item);
    }

    public void rejectRestore(String zohoItemId, String admin) {

        DispatchedItem item = dispatchedRepo.findById(zohoItemId)
                .orElseThrow(() -> new IllegalStateException("Item not found"));

        if (item.getApprovalStatus() != ApprovalStatus.PENDING) {
            throw new IllegalStateException("No pending restore request");
        }

        item.setApprovalStatus(ApprovalStatus.REJECTED);
        item.setApprovedBy(admin);
        item.setApprovedAt(LocalDateTime.now());

        dispatchedRepo.save(item);
    }

    /* ================= DISPATCH ACTION ================= */

    public void markAsDispatched(String zohoItemId, String username) {

        DispatchedItem item = dispatchedRepo.findById(zohoItemId)
                .orElseThrow(() -> new IllegalStateException("Item not found"));

        // ✅ Only PACKED items can be dispatched
        if (item.getStatus() != ItemDispatchStatus.PACKED) {
            throw new IllegalStateException("Only PACKED items can be dispatched");
        }

        item.setStatus(ItemDispatchStatus.DISPATCHED);
        item.setDispatchedBy(username);
        item.setDispatchedAt(LocalDateTime.now());

        // Stock is now logically zero
        item.setStock(0);

        dispatchedRepo.save(item);
    }
}
