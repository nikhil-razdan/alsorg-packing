package com.alsorg.packing.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
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
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.ClientMasterService;
import com.alsorg.packing.service.CurrentUserService;

@RestController
@RequestMapping("/api/client-master")
@PreAuthorize("isAuthenticated()")
public class ClientMasterController {

    private final ClientMasterService clientMasterService;
    private final CurrentUserService currentUserService;

    public ClientMasterController(
            ClientMasterService clientMasterService,
            CurrentUserService currentUserService) {
        this.clientMasterService = clientMasterService;
        this.currentUserService = currentUserService;
    }

    /**
     * Shared lightweight lookup used by PackFlow and MatFlow autocomplete.
     * ClientMasterService intentionally returns no rows until q contains at
     * least two characters, so this remains safe for normal authenticated use.
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

    /** Full Client Master administration stays ADMIN-only. */
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

    /**
     * ADMIN keeps normal Client Master creation rights.
     *
     * MatFlow roles that are already permitted to create Project/PD records may
     * also create a missing client directly from the Project client dropdown.
     * This permission does not grant list-admin, edit, archive or restore access.
     */
    @PostMapping
    @PreAuthorize("hasAnyAuthority('ADMIN','MATFLOW_MANAGER','MATFLOW_DESIGN_HEAD','MATFLOW_DESIGNER','MATFLOW_DESIGNER_JUNIOR','MATFLOW_ENGINEERING_HEAD','MATFLOW_ENGINEERING')")
    public ClientMasterResponse create(
            @RequestBody ClientMasterRequest request,
            Authentication authentication) {

        requireClientCreateAccess();

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

    private void requireClientCreateAccess() {
        User user = currentUserService.requireCurrentUser();

        if (currentUserService.isAdmin(user)) {
            return;
        }

        if (!currentUserService.hasModule(user, "MATFLOW")) {
            throw new AccessDeniedException(
                    "MatFlow module access required to create a client from a Project / PD");
        }

        if (!currentUserService.hasAnyRole(
                user,
                "MATFLOW_MANAGER",
                "MATFLOW_DESIGN_HEAD",
                "MATFLOW_DESIGNER",
                "MATFLOW_DESIGNER_JUNIOR",
                "MATFLOW_ENGINEERING_HEAD",
                "MATFLOW_ENGINEERING")) {
            throw new AccessDeniedException(
                    "This MatFlow role cannot create Client Master entries");
        }
    }

    private String actor(
            Authentication authentication) {
        if (authentication == null
                || authentication.getName() == null
                || authentication.getName().isBlank()) {
            throw new AccessDeniedException(
                    "Authentication required");
        }

        return authentication.getName().trim();
    }
}
