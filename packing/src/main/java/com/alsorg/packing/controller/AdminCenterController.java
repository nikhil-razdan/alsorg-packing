package com.alsorg.packing.controller;

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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.alsorg.packing.controller.dto.admin.AdminPacketRollbackHistoryResponse;
import com.alsorg.packing.controller.dto.admin.AdminPacketRollbackPreviewResponse;
import com.alsorg.packing.controller.dto.admin.AdminPacketRollbackRequest;
import com.alsorg.packing.controller.dto.admin.AdminPacketRollbackResultResponse;
import com.alsorg.packing.controller.dto.admin.PacketDeletionRequestDtos;
import com.alsorg.packing.controller.dto.admin.PacketLifecycleRequestDtos.DecisionRequest;
import com.alsorg.packing.controller.dto.admin.PacketLifecycleRequestDtos.DecisionResponse;
import com.alsorg.packing.controller.dto.admin.PacketLifecycleRequestDtos.RequestResponse;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.AdminPacketLifecycleService;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.PacketDeletionRequestService;
import com.alsorg.packing.service.PacketLifecycleChangeRequestService;

@RestController
@RequestMapping("/api/admin/center")
public class AdminCenterController {

    private static final int MAX_PAGE_SIZE = 100;

    private final AdminPacketLifecycleService lifecycleService;
    private final PacketLifecycleChangeRequestService lifecycleRequestService;
    private final PacketDeletionRequestService deletionRequestService;
    private final CurrentUserService currentUserService;

    public AdminCenterController(
            AdminPacketLifecycleService lifecycleService,
            PacketLifecycleChangeRequestService lifecycleRequestService,
            PacketDeletionRequestService deletionRequestService,
            CurrentUserService currentUserService) {
        this.lifecycleService = lifecycleService;
        this.lifecycleRequestService = lifecycleRequestService;
        this.deletionRequestService = deletionRequestService;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/packet-items/{packetItemId}/rollback-preview")
    public ResponseEntity<AdminPacketRollbackPreviewResponse> previewRollback(
            @PathVariable UUID packetItemId) {
        requireAdmin();

        return ResponseEntity.ok(
                lifecycleService.previewRollback(packetItemId));
    }

    @PostMapping("/packet-items/{packetItemId}/rollback")
    public ResponseEntity<AdminPacketRollbackResultResponse> rollbackOneStep(
            @PathVariable UUID packetItemId,
            @RequestBody AdminPacketRollbackRequest request) {
        User user = requireAdmin();

        return ResponseEntity.ok(
                lifecycleService.rollbackOneStep(
                        packetItemId,
                        request,
                        user.getUsername()));
    }

    @GetMapping("/rollback-history")
    public ResponseEntity<Page<AdminPacketRollbackHistoryResponse>> rollbackHistory(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        requireAdmin();

        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                normalizePageSize(size),
                Sort.by(Sort.Direction.DESC, "changedAt"));

        return ResponseEntity.ok(
                lifecycleService.getHistory(pageable));
    }

    @GetMapping("/lifecycle-requests")
    public ResponseEntity<Page<RequestResponse>> pendingLifecycleRequests(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        User user = requireAdmin();

        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                normalizePageSize(size));

        return ResponseEntity.ok(
                lifecycleRequestService.getPending(
                        pageable,
                        user));
    }

    @PostMapping("/lifecycle-requests/approve")
    public ResponseEntity<DecisionResponse> approveLifecycleRequests(
            @RequestBody DecisionRequest request) {
        User user = requireAdmin();

        return ResponseEntity.ok(
                lifecycleRequestService.approve(
                        request,
                        user));
    }

    @PostMapping("/lifecycle-requests/reject")
    public ResponseEntity<DecisionResponse> rejectLifecycleRequests(
            @RequestBody DecisionRequest request) {
        User user = requireAdmin();

        return ResponseEntity.ok(
                lifecycleRequestService.reject(
                        request,
                        user));
    }

    @GetMapping("/deletion-requests")
    public ResponseEntity<Page<PacketDeletionRequestDtos.RequestResponse>> pendingDeletionRequests(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        User user = requireAdmin();

        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                normalizePageSize(size));

        return ResponseEntity.ok(
                deletionRequestService.getPending(
                        pageable,
                        user));
    }

    @PostMapping("/deletion-requests/approve")
    public ResponseEntity<PacketDeletionRequestDtos.DecisionResponse> approveDeletionRequests(
            @RequestBody PacketDeletionRequestDtos.DecisionRequest request) {
        User user = requireAdmin();

        return ResponseEntity.ok(
                deletionRequestService.approve(
                        request,
                        user));
    }

    @PostMapping("/deletion-requests/reject")
    public ResponseEntity<PacketDeletionRequestDtos.DecisionResponse> rejectDeletionRequests(
            @RequestBody PacketDeletionRequestDtos.DecisionRequest request) {
        User user = requireAdmin();

        return ResponseEntity.ok(
                deletionRequestService.reject(
                        request,
                        user));
    }

    private User requireAdmin() {
        /*
         * Authentication is established centrally by JwtAuthenticationFilter.
         * Do not re-parse a user-controlled Authorization header inside controllers.
         */
        User user = currentUserService.requireCurrentUser();

        if (!currentUserService.isAdmin(user)) {
            throw new org.springframework.security.access.AccessDeniedException(
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
