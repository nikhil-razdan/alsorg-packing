package com.alsorg.packing.controller;

import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.service.DispatchedItemService;

import java.util.List;

@RestController
@RequestMapping("/api/dispatched")
public class DispatchedItemsController {

    private final DispatchedItemRepository repository;
    private final DispatchedItemService dispatchedItemService;

    public DispatchedItemsController(
            DispatchedItemRepository repository,
            DispatchedItemService dispatchedItemService
    ) {
        this.repository = repository;
        this.dispatchedItemService = dispatchedItemService;
    }

    /* ===================== READ ===================== */

    /**
     * Phase 2:
     * - Show PACKED + DISPATCHED items
     */
    @GetMapping
    public List<DispatchedItem> getDispatchedItems() {
        return repository.findByStatusIn(
            List.of(
                ItemDispatchStatus.PACKED,
                ItemDispatchStatus.DISPATCHED
            )
        );
    }

    /* ===================== USER ===================== */

    @PostMapping("/{zohoItemId}/request-restore")
    public ResponseEntity<?> requestRestore(
            @PathVariable String zohoItemId,
            HttpSession session
    ) {
        String role = (String) session.getAttribute("ROLE");
        String user = (String) session.getAttribute("USER");

        if (!"USER".equals(role)) {
            return ResponseEntity.status(403).build();
        }

        dispatchedItemService.requestRestore(zohoItemId, user);
        return ResponseEntity.ok().build();
    }

    /* ===================== ADMIN ===================== */

    @PostMapping("/{zohoItemId}/approve-restore")
    public ResponseEntity<?> approveRestore(
            @PathVariable String zohoItemId,
            HttpSession session
    ) {
        String role = (String) session.getAttribute("ROLE");
        String admin = (String) session.getAttribute("USER");

        if (!"ADMIN".equals(role)) {
            return ResponseEntity.status(403).build();
        }

        dispatchedItemService.approveRestore(zohoItemId, admin);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{zohoItemId}/reject-restore")
    public ResponseEntity<?> rejectRestore(
            @PathVariable String zohoItemId,
            HttpSession session
    ) {
        String role = (String) session.getAttribute("ROLE");
        String admin = (String) session.getAttribute("USER");

        if (!"ADMIN".equals(role)) {
            return ResponseEntity.status(403).build();
        }

        dispatchedItemService.rejectRestore(zohoItemId, admin);
        return ResponseEntity.ok().build();
    }

    /* ===================== DISPATCH ===================== */

    @PostMapping("/{zohoItemId}/dispatch")
    public ResponseEntity<?> dispatchItem(
            @PathVariable String zohoItemId,
            HttpSession session
    ) {
        String role = (String) session.getAttribute("ROLE");
        String user = (String) session.getAttribute("USER");

        if (!"DISPATCH".equals(role)) {
            return ResponseEntity.status(403).build();
        }

        dispatchedItemService.markAsDispatched(zohoItemId, user);
        return ResponseEntity.ok().build();
    }
}
