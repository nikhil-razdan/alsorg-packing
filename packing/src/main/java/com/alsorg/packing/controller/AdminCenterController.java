package com.alsorg.packing.controller;

import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.controller.dto.admin.AdminPacketRollbackHistoryResponse;
import com.alsorg.packing.controller.dto.admin.AdminPacketRollbackPreviewResponse;
import com.alsorg.packing.controller.dto.admin.AdminPacketRollbackRequest;
import com.alsorg.packing.controller.dto.admin.AdminPacketRollbackResultResponse;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.AdminPacketLifecycleService;
import com.alsorg.packing.service.CurrentUserService;

@RestController
@RequestMapping("/api/admin/center")
public class AdminCenterController {

    private final AdminPacketLifecycleService lifecycleService;
    private final CurrentUserService currentUserService;

    public AdminCenterController(
            AdminPacketLifecycleService lifecycleService,
            CurrentUserService currentUserService
    ) {
        this.lifecycleService = lifecycleService;
        this.currentUserService = currentUserService;
    }

    @GetMapping(
            "/packet-items/{packetItemId}/rollback-preview"
    )
    public ResponseEntity<AdminPacketRollbackPreviewResponse>
    previewRollback(
            @PathVariable UUID packetItemId,
            @RequestHeader(
                    value = "Authorization",
                    required = false
            ) String auth
    ) {
        requireAdmin(auth);

        return ResponseEntity.ok(
                lifecycleService.previewRollback(
                        packetItemId
                )
        );
    }

    @PostMapping(
            "/packet-items/{packetItemId}/rollback"
    )
    public ResponseEntity<AdminPacketRollbackResultResponse>
    rollbackOneStep(
            @PathVariable UUID packetItemId,
            @RequestBody AdminPacketRollbackRequest request,
            @RequestHeader(
                    value = "Authorization",
                    required = false
            ) String auth
    ) {
        User user =
                requireAdmin(auth);

        return ResponseEntity.ok(
                lifecycleService.rollbackOneStep(
                        packetItemId,
                        request,
                        user.getUsername()
                )
        );
    }

    @GetMapping("/rollback-history")
    public ResponseEntity<Page<AdminPacketRollbackHistoryResponse>>
    rollbackHistory(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestHeader(
                    value = "Authorization",
                    required = false
            ) String auth
    ) {
        requireAdmin(auth);

        int safePage =
                Math.max(page, 0);

        int safeSize =
                Math.min(
                        Math.max(size, 1),
                        100
                );

        return ResponseEntity.ok(
                lifecycleService.getHistory(
                        PageRequest.of(
                                safePage,
                                safeSize
                        )
                )
        );
    }

    private User requireAdmin(
            String auth
    ) {
        User user =
                currentUserService
                        .getCurrentUserFromAuth(auth);

        if (!currentUserService.isAdmin(user)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only ADMIN can access Admin Center lifecycle correction"
            );
        }

        return user;
    }
}