package com.alsorg.packing.service;

import java.time.LocalDateTime;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.domain.common.ApprovalStatus;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.repository.DispatchedItemRepository;

import jakarta.transaction.Transactional;

@Service
@Transactional
public class DispatchedItemService {

    private final DispatchedItemRepository dispatchedRepo;
    private final AuditLogService auditLogService;
    private final ActivityLogService activityLogService;

    public DispatchedItemService(
            DispatchedItemRepository dispatchedRepo,
            AuditLogService auditLogService,
            ActivityLogService activityLogService
    ) {
        this.dispatchedRepo = dispatchedRepo;
        this.auditLogService = auditLogService;
        this.activityLogService = activityLogService;
    }

    public void requestRestore(String zohoItemId, String username, String role) {

        if ("DISPATCH".equals(role)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Dispatch cannot request restore"
            );
        }

        DispatchedItem item = dispatchedRepo.findById(zohoItemId)
                .orElseThrow(() -> new IllegalStateException("Item not found"));

        if ("USER".equals(role) && item.getStatus() != ItemDispatchStatus.PACKED) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "User can request restore only when PACKED"
            );
        }

        if (item.getApprovalStatus() == ApprovalStatus.PENDING) {
            throw new IllegalStateException("Restore already requested");
        }

        item.setApprovalStatus(ApprovalStatus.PENDING);
        item.setApprovalRequestedBy(username);
        item.setApprovalRequestedAt(LocalDateTime.now());

        dispatchedRepo.save(item);

        auditLogService.log(
                zohoItemId,
                "Restore requested",
                username,
                role
        );

        activityLogService.log(
                zohoItemId,
                "RESTORE REQUESTED",
                username,
                role,
                item.getStatus().name(),
                item.getStatus().name(),
                null
        );

    }

    public void approveRestore(String zohoItemId, String admin) {

        DispatchedItem item = dispatchedRepo.findById(zohoItemId)
                .orElseThrow(() -> new IllegalStateException("Item not found"));

        if (item.getApprovalStatus() != ApprovalStatus.PENDING) {
            throw new IllegalStateException("No pending restore request");
        }

        item.setApprovalStatus(ApprovalStatus.APPROVED);
        item.setApprovedBy(admin);
        item.setApprovedAt(LocalDateTime.now());
        item.setStatus(ItemDispatchStatus.AVAILABLE);
        item.setStock(1);

        dispatchedRepo.delete(item);

        auditLogService.log(
                zohoItemId,
                "Restore approved",
                admin,
                "ADMIN"
        );
        
        activityLogService.log(
                zohoItemId,
                "RESTORE APPROVED",
                admin,
                "ADMIN",
                "PENDING",
                "AVAILABLE",
                null
        );
    }

    public void rejectRestore(String zohoItemId, String admin) {

        DispatchedItem item = dispatchedRepo.findById(zohoItemId)
                .orElseThrow(() -> new IllegalStateException("Item not found"));

        item.setApprovalStatus(ApprovalStatus.REJECTED);
        item.setApprovedBy(admin);
        item.setApprovedAt(LocalDateTime.now());

        dispatchedRepo.save(item);

        auditLogService.log(
                zohoItemId,
                "Restore rejected",
                admin,
                "ADMIN"
        );
        
        activityLogService.log(
                zohoItemId,
                "RESTORE REJECTED",
                admin,
                "ADMIN",
                "PENDING",
                "REJECTED",
                null
        );

    }

    public void updateDispatchStatus(
            String zohoItemId,
            ItemDispatchStatus newStatus,
            String username
    ) {

        DispatchedItem item = dispatchedRepo.findById(zohoItemId)
                .orElseThrow(() -> new IllegalStateException("Item not found"));

        // ================= PACKING =================

        if (newStatus == ItemDispatchStatus.PACKED &&
            item.getStatus() == ItemDispatchStatus.AVAILABLE) {

            item.setStatus(ItemDispatchStatus.PACKED);
            item.setPackedAt(LocalDateTime.now());
            item.setPackedBy(username);
            item.setStock(1);

            auditLogService.log(
                    zohoItemId,
                    "Status changed to PACKED",
                    username,
                    "PACKING"
            );
        }

        // ================= DISPATCH =================

        else if (newStatus == ItemDispatchStatus.DISPATCHED &&
                 item.getStatus() == ItemDispatchStatus.PACKED) {

            item.setStatus(ItemDispatchStatus.DISPATCHED);
            item.setDispatchedBy(username);
            item.setDispatchedAt(LocalDateTime.now());
            item.setStock(0);

            auditLogService.log(
                    zohoItemId,
                    "Status changed to DISPATCHED",
                    username,
                    "DISPATCH"
            );
        }

        // ================= REVERT TO PACKED =================

        else if (newStatus == ItemDispatchStatus.PACKED &&
                 item.getStatus() == ItemDispatchStatus.DISPATCHED) {

            item.setStatus(ItemDispatchStatus.PACKED);
            item.setDispatchedBy(null);
            item.setDispatchedAt(null);
            item.setStock(1);

            auditLogService.log(
                    zohoItemId,
                    "Status reverted to PACKED",
                    username,
                    "DISPATCH"
            );
        }

        else {
            throw new IllegalStateException("Invalid status transition");
        }

        dispatchedRepo.save(item);
    }
}
