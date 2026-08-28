package com.alsorg.packing.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.alsorg.packing.controller.dto.admin.PacketDeletionRequestDtos.SubmitRequest;
import com.alsorg.packing.controller.dto.admin.PacketDeletionRequestDtos.SubmitResponse;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.PacketDeletionRequestService;

@RestController
@RequestMapping("/api/packet-deletion-requests")
public class PacketDeletionRequestController {

    private final PacketDeletionRequestService requestService;
    private final CurrentUserService currentUserService;

    public PacketDeletionRequestController(
            PacketDeletionRequestService requestService,
            CurrentUserService currentUserService) {
        this.requestService = requestService;
        this.currentUserService = currentUserService;
    }

    @PostMapping
    public ResponseEntity<SubmitResponse> submit(
            @RequestBody SubmitRequest request) {
        User user = currentUserService.requireCurrentUser();
        return ResponseEntity.ok(requestService.submit(request, user));
    }
}
