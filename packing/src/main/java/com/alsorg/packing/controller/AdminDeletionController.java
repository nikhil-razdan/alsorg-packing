package com.alsorg.packing.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.alsorg.packing.controller.dto.admin.AdminDeletePreviewResponse;
import com.alsorg.packing.controller.dto.admin.AdminDeleteRequest;
import com.alsorg.packing.controller.dto.admin.AdminDeleteResultResponse;
import com.alsorg.packing.controller.dto.admin.AdminDeleteSearchResult;
import com.alsorg.packing.controller.dto.admin.AdminDeletionHistoryResponse;
import com.alsorg.packing.controller.dto.admin.AdminWarehouseBulkDeleteRequest;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.AdminDeletionService;
import com.alsorg.packing.service.CurrentUserService;

@RestController
@RequestMapping("/api/admin/deletions")
public class AdminDeletionController {

    private static final int MAX_PAGE_SIZE = 100;

    private final AdminDeletionService deletionService;
    private final CurrentUserService currentUserService;

    public AdminDeletionController(
            AdminDeletionService deletionService,
            CurrentUserService currentUserService) {
        this.deletionService = deletionService;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/packet-items/search")
    public ResponseEntity<Page<AdminDeleteSearchResult>> searchPacketItems(
            @RequestParam String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        User user = requireAdmin();

        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                normalizePageSize(size),
                Sort.by(Sort.Direction.DESC, "id"));

        return ResponseEntity.ok(
                deletionService.searchPacketItems(
                        query,
                        pageable,
                        user));
    }

    @GetMapping("/master-items/search")
    public ResponseEntity<Page<AdminDeleteSearchResult>> searchMasterItems(
            @RequestParam String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        User user = requireAdmin();

        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                normalizePageSize(size),
                Sort.by(Sort.Direction.DESC, "id"));

        return ResponseEntity.ok(
                deletionService.searchMasterItems(
                        query,
                        pageable,
                        user));
    }

    @GetMapping("/packet-items/{itemId}/preview")
    public ResponseEntity<AdminDeletePreviewResponse> previewPacketItem(
            @PathVariable UUID itemId) {
        User user = requireAdmin();

        return ResponseEntity.ok(
                deletionService.previewPacketItem(
                        itemId,
                        user));
    }

    @PostMapping("/packet-items/{itemId}/execute")
    public ResponseEntity<AdminDeleteResultResponse> deletePacketItem(
            @PathVariable UUID itemId,
            @RequestBody AdminDeleteRequest request) {
        User user = requireAdmin();

        return ResponseEntity.ok(
                deletionService.deletePacketItem(
                        itemId,
                        request,
                        user));
    }

    @GetMapping("/master-items/{masterItemId}/preview")
    public ResponseEntity<AdminDeletePreviewResponse> previewMasterItem(
            @PathVariable UUID masterItemId) {
        User user = requireAdmin();

        return ResponseEntity.ok(
                deletionService.previewMasterItem(
                        masterItemId,
                        user));
    }

    @PostMapping("/master-items/{masterItemId}/execute")
    public ResponseEntity<AdminDeleteResultResponse> deleteMasterItem(
            @PathVariable UUID masterItemId,
            @RequestBody AdminDeleteRequest request) {
        User user = requireAdmin();

        return ResponseEntity.ok(
                deletionService.deleteMasterItem(
                        masterItemId,
                        request,
                        user));
    }

    @GetMapping("/warehouse-items/search")
    public ResponseEntity<Page<AdminDeleteSearchResult>> searchWarehouseItems(
            @RequestParam String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        User user = requireAdmin();

        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                normalizePageSize(size),
                Sort.by(
                        Sort.Order.desc("createdAt"),
                        Sort.Order.asc("zohoItemId")));

        return ResponseEntity.ok(
                deletionService.searchWarehouseItems(
                        query,
                        pageable,
                        user));
    }

    @GetMapping("/warehouse-items/{itemId:.+}/preview")
    public ResponseEntity<AdminDeletePreviewResponse> previewWarehouseItem(
            @PathVariable String itemId) {
        User user = requireAdmin();

        return ResponseEntity.ok(
                deletionService.previewWarehouseItem(
                        itemId,
                        user));
    }

    @PostMapping("/warehouse-items/{itemId:.+}/execute")
    public ResponseEntity<AdminDeleteResultResponse> deleteWarehouseItem(
            @PathVariable String itemId,
            @RequestBody AdminDeleteRequest request) {
        User user = requireAdmin();

        return ResponseEntity.ok(
                deletionService.deleteWarehouseItem(
                        itemId,
                        request,
                        user));
    }

    @PostMapping("/warehouse-items/bulk/preview")
    public ResponseEntity<AdminDeletePreviewResponse> previewWarehouseItemsBulk(
            @RequestBody List<String> itemIds) {
        User user = requireAdmin();

        return ResponseEntity.ok(
                deletionService.previewWarehouseItemsBulk(
                        itemIds,
                        user));
    }

    @PostMapping("/warehouse-items/bulk/execute")
    public ResponseEntity<AdminDeleteResultResponse> deleteWarehouseItemsBulk(
            @RequestBody AdminWarehouseBulkDeleteRequest request) {
        User user = requireAdmin();

        return ResponseEntity.ok(
                deletionService.deleteWarehouseItemsBulk(
                        request,
                        user));
    }

    @GetMapping("/dispatch-items/{itemId:.+}/preview")
    public ResponseEntity<AdminDeletePreviewResponse> previewDispatchItem(
            @PathVariable String itemId) {
        User user = requireAdmin();

        return ResponseEntity.ok(
                deletionService.previewDispatchItem(
                        itemId,
                        user));
    }

    @PostMapping("/dispatch-items/{itemId:.+}/execute")
    public ResponseEntity<AdminDeleteResultResponse> deleteDispatchItem(
            @PathVariable String itemId,
            @RequestBody AdminDeleteRequest request) {
        User user = requireAdmin();

        return ResponseEntity.ok(
                deletionService.deleteDispatchItem(
                        itemId,
                        request,
                        user));
    }

    @PostMapping("/dispatch-items/bulk/preview")
    public ResponseEntity<AdminDeletePreviewResponse> previewDispatchItemsBulk(
            @RequestBody List<String> itemIds) {
        User user = requireAdmin();

        return ResponseEntity.ok(
                deletionService.previewDispatchItemsBulk(
                        itemIds,
                        user));
    }

    @PostMapping("/dispatch-items/bulk/execute")
    public ResponseEntity<AdminDeleteResultResponse> deleteDispatchItemsBulk(
            @RequestBody AdminWarehouseBulkDeleteRequest request) {
        User user = requireAdmin();

        return ResponseEntity.ok(
                deletionService.deleteDispatchItemsBulk(
                        request,
                        user));
    }

    @GetMapping("/history")
    public ResponseEntity<Page<AdminDeletionHistoryResponse>> getDeletionHistory(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        User user = requireAdmin();

        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                normalizePageSize(size));

        return ResponseEntity.ok(
                deletionService.getDeletionHistory(
                        pageable,
                        user));
    }

    private User requireAdmin() {
        User user = currentUserService.requireCurrentUser();

        if (!currentUserService.isAdmin(user)) {
            throw new AccessDeniedException(
                    "Only ADMIN can perform this action");
        }

        return user;
    }

    private int normalizePageSize(
            int size) {
        return Math.max(
                1,
                Math.min(size, MAX_PAGE_SIZE));
    }
}
