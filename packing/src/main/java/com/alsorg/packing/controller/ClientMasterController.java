package com.alsorg.packing.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.alsorg.packing.controller.dto.client.ClientMasterRequest;
import com.alsorg.packing.controller.dto.client.ClientMasterResponse;
import com.alsorg.packing.controller.dto.client.ClientMasterStatsResponse;
import com.alsorg.packing.service.ClientMasterService;

@RestController
@RequestMapping("/api/client-master")
@PreAuthorize("isAuthenticated()")
public class ClientMasterController {

    private final ClientMasterService clientMasterService;

    public ClientMasterController(
            ClientMasterService clientMasterService) {
        this.clientMasterService = clientMasterService;
    }

    /**
     * Lightweight lookup used by PackFlow autocomplete.
     * It intentionally returns nothing until q has at least two characters.
     */
    @GetMapping("/search")
    public ResponseEntity<List<ClientMasterResponse>> search(
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "12") Integer limit) {

        return ResponseEntity.ok(
                clientMasterService.searchSuggestions(
                        q,
                        limit));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('ADMIN')")
    public Page<ClientMasterResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "ALL") String status) {

        return clientMasterService.list(
                search,
                status,
                page,
                size);
    }

    @GetMapping("/stats")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ClientMasterStatsResponse stats() {
        return clientMasterService.stats();
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ADMIN')")
    public ClientMasterResponse create(
            @RequestBody ClientMasterRequest request,
            Authentication authentication) {

        return clientMasterService.create(
                request,
                actor(authentication));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ClientMasterResponse update(
            @PathVariable UUID id,
            @RequestBody ClientMasterRequest request,
            Authentication authentication) {

        return clientMasterService.update(
                id,
                request,
                actor(authentication));
    }

    @PatchMapping("/{id}/active")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ClientMasterResponse setActive(
            @PathVariable UUID id,
            @RequestParam boolean active,
            Authentication authentication) {

        return clientMasterService.setActive(
                id,
                active,
                actor(authentication));
    }

    private String actor(
            Authentication authentication) {
        if (authentication == null ||
                authentication.getName() == null ||
                authentication.getName().isBlank()) {
            return "SYSTEM";
        }

        return authentication.getName().trim();
    }
}
