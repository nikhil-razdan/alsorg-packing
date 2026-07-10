package com.alsorg.packing.controller;

import com.alsorg.packing.controller.dto.admin.AdminDeletePreviewResponse;
import com.alsorg.packing.controller.dto.admin.AdminDeleteRequest;
import com.alsorg.packing.controller.dto.admin.AdminDeleteResultResponse;
import com.alsorg.packing.controller.dto.admin.AdminDeleteSearchResult;
import com.alsorg.packing.controller.dto.admin.AdminDeletionHistoryResponse;

import com.alsorg.packing.domain.users.User;

import com.alsorg.packing.service.AdminDeletionService;
import com.alsorg.packing.service.CurrentUserService;

import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import org.springframework.http.ResponseEntity;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/deletions")
public class AdminDeletionController {

    private final AdminDeletionService deletionService;

    private final CurrentUserService currentUserService;

    public AdminDeletionController(
            AdminDeletionService deletionService,
            CurrentUserService currentUserService
    ) {
        this.deletionService = deletionService;
        this.currentUserService = currentUserService;
    }

    /* =====================================================
       SEARCH PACKETS
       ===================================================== */

    @GetMapping("/packet-items/search")
    public ResponseEntity<Page<AdminDeleteSearchResult>>
    searchPacketItems(
            @RequestParam String query,

            @RequestParam(defaultValue = "0")
            int page,

            @RequestParam(defaultValue = "20")
            int size,

            @RequestHeader(
                    value = "Authorization",
                    required = false
            )
            String auth
    ) {
        User user =
                currentUserService
                        .requireAdminUser(auth);

        Pageable pageable =
                PageRequest.of(
                        Math.max(page, 0),
                        normalizePageSize(size),
                        Sort.by(
                                Sort.Direction.DESC,
                                "id"
                        )
                );

        return ResponseEntity.ok(
                deletionService.searchPacketItems(
                        query,
                        pageable,
                        user
                )
        );
    }

    /* =====================================================
       SEARCH MASTER ITEMS
       ===================================================== */

    @GetMapping("/master-items/search")
    public ResponseEntity<Page<AdminDeleteSearchResult>>
    searchMasterItems(
            @RequestParam String query,

            @RequestParam(defaultValue = "0")
            int page,

            @RequestParam(defaultValue = "20")
            int size,

            @RequestHeader(
                    value = "Authorization",
                    required = false
            )
            String auth
    ) {
        User user =
                currentUserService
                        .requireAdminUser(auth);

        Pageable pageable =
                PageRequest.of(
                        Math.max(page, 0),
                        normalizePageSize(size),
                        Sort.by(
                                Sort.Direction.DESC,
                                "id"
                        )
                );

        return ResponseEntity.ok(
                deletionService.searchMasterItems(
                        query,
                        pageable,
                        user
                )
        );
    }

    /* =====================================================
       PACKET PREVIEW
       ===================================================== */

    @GetMapping("/packet-items/{itemId}/preview")
    public ResponseEntity<AdminDeletePreviewResponse>
    previewPacketItem(
            @PathVariable UUID itemId,

            @RequestHeader(
                    value = "Authorization",
                    required = false
            )
            String auth
    ) {
        User user =
                currentUserService
                        .requireAdminUser(auth);

        return ResponseEntity.ok(
                deletionService.previewPacketItem(
                        itemId,
                        user
                )
        );
    }

    /* =====================================================
       PACKET DELETE
       ===================================================== */

    @PostMapping("/packet-items/{itemId}/execute")
    public ResponseEntity<AdminDeleteResultResponse>
    deletePacketItem(
            @PathVariable UUID itemId,

            @RequestBody AdminDeleteRequest request,

            @RequestHeader(
                    value = "Authorization",
                    required = false
            )
            String auth
    ) {
        User user =
                currentUserService
                        .requireAdminUser(auth);

        return ResponseEntity.ok(
                deletionService.deletePacketItem(
                        itemId,
                        request,
                        user
                )
        );
    }

    /* =====================================================
       MASTER PREVIEW
       ===================================================== */

    @GetMapping("/master-items/{masterItemId}/preview")
    public ResponseEntity<AdminDeletePreviewResponse>
    previewMasterItem(
            @PathVariable UUID masterItemId,

            @RequestHeader(
                    value = "Authorization",
                    required = false
            )
            String auth
    ) {
        User user =
                currentUserService
                        .requireAdminUser(auth);

        return ResponseEntity.ok(
                deletionService.previewMasterItem(
                        masterItemId,
                        user
                )
        );
    }

    /* =====================================================
       MASTER DELETE
       ===================================================== */

    @PostMapping("/master-items/{masterItemId}/execute")
    public ResponseEntity<AdminDeleteResultResponse>
    deleteMasterItem(
            @PathVariable UUID masterItemId,

            @RequestBody AdminDeleteRequest request,

            @RequestHeader(
                    value = "Authorization",
                    required = false
            )
            String auth
    ) {
        User user =
                currentUserService
                        .requireAdminUser(auth);

        return ResponseEntity.ok(
                deletionService.deleteMasterItem(
                        masterItemId,
                        request,
                        user
                )
        );
    }

    /* =====================================================
       DELETION HISTORY
       ===================================================== */

    @GetMapping("/history")
    public ResponseEntity<Page<AdminDeletionHistoryResponse>>
    getDeletionHistory(
            @RequestParam(defaultValue = "0")
            int page,

            @RequestParam(defaultValue = "20")
            int size,

            @RequestHeader(
                    value = "Authorization",
                    required = false
            )
            String auth
    ) {
        User user =
                currentUserService
                        .requireAdminUser(auth);

        Pageable pageable =
                PageRequest.of(
                        Math.max(page, 0),
                        normalizePageSize(size)
                );

        return ResponseEntity.ok(
                deletionService.getDeletionHistory(
                        pageable,
                        user
                )
        );
    }

    private int normalizePageSize(
            int size
    ) {
        if (size <= 0) {
            return 20;
        }

        return Math.min(size, 100);
    }
}