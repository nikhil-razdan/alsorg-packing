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

    @GetMapping
    public List<DispatchedItem> getDispatchedItems() {
        return repository.findByStatusIn(
            List.of(ItemDispatchStatus.PACKED, ItemDispatchStatus.DISPATCHED)
        );
    }

    @PostMapping("/{zohoItemId}/request-restore")
    public ResponseEntity<?> requestRestore(
            @PathVariable String zohoItemId,
            HttpSession session
    ) {
        dispatchedItemService.requestRestore(
            zohoItemId,
            (String) session.getAttribute("USER"),
            (String) session.getAttribute("ROLE")
        );
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{zohoItemId}/approve-restore")
    public ResponseEntity<?> approveRestore(
            @PathVariable String zohoItemId,
            HttpSession session
    ) {
        if (!"ADMIN".equals(session.getAttribute("ROLE"))) {
            return ResponseEntity.status(403).build();
        }
        dispatchedItemService.approveRestore(
            zohoItemId,
            (String) session.getAttribute("USER")
        );
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{zohoItemId}/reject-restore")
    public ResponseEntity<?> rejectRestore(
            @PathVariable String zohoItemId,
            HttpSession session
    ) {
        if (!"ADMIN".equals(session.getAttribute("ROLE"))) {
            return ResponseEntity.status(403).build();
        }
        dispatchedItemService.rejectRestore(
            zohoItemId,
            (String) session.getAttribute("USER")
        );
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{zohoItemId}/dispatch")
    public ResponseEntity<?> updateDispatchStatus(
            @PathVariable String zohoItemId,
            @RequestParam ItemDispatchStatus status,
            HttpSession session
    ) {
        if (!"DISPATCH".equals(session.getAttribute("ROLE"))) {
            return ResponseEntity.status(403).build();
        }

        dispatchedItemService.updateDispatchStatus(
            zohoItemId,
            status,
            (String) session.getAttribute("USER")
        );
        return ResponseEntity.ok().build();
    }
}
