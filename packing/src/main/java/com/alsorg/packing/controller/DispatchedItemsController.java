package com.alsorg.packing.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.service.DispatchedItemService;
import com.alsorg.packing.security.JwtUtil;

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

    /* ===================== FETCH ===================== */

    @GetMapping
    public List<DispatchedItem> getDispatchedItems() {
        return repository.findByStatusIn(
                List.of(
                		ItemDispatchStatus.READY,
                        ItemDispatchStatus.READY_TO_STORE,
                        ItemDispatchStatus.WAREHOUSE_REQUESTED,
                        ItemDispatchStatus.IN_WAREHOUSE,
                        ItemDispatchStatus.READY_TO_DISPATCH,
                        ItemDispatchStatus.DISPATCHED,
                        ItemDispatchStatus.AVAILABLE,
                        ItemDispatchStatus.WAREHOUSE_RETURN_REQUESTED
                )
        );
    }

    /* ===================== REQUEST RESTORE ===================== */

    @PostMapping("/{zohoItemId:.+}/request-restore")
    public ResponseEntity<?> requestRestore(
            @PathVariable String zohoItemId,
            @RequestHeader("Authorization") String auth
    ) {
        String token = extractToken(auth);

        dispatchedItemService.requestRestore(
                zohoItemId,
                JwtUtil.getUsername(token),
                JwtUtil.getRole(token)
        );

        return ResponseEntity.ok().build();
    }

    /* ===================== APPROVE RESTORE ===================== */

    @PostMapping("/{zohoItemId:.+}/approve-restore")
    public ResponseEntity<?> approveRestore(
            @PathVariable String zohoItemId,
            @RequestHeader("Authorization") String auth
    ) {
        String token = extractToken(auth);

        if (!"ADMIN".equals(JwtUtil.getRole(token))) {
            return ResponseEntity.status(403).build();
        }

        dispatchedItemService.approveRestore(
                zohoItemId,
                JwtUtil.getUsername(token)
        );

        return ResponseEntity.ok().build();
    }

    /* ===================== REJECT RESTORE ===================== */

    @PostMapping("/{zohoItemId:.+}/reject-restore")
    public ResponseEntity<?> rejectRestore(
            @PathVariable String zohoItemId,
            @RequestHeader("Authorization") String auth
    ) {
        String token = extractToken(auth);

        if (!"ADMIN".equals(JwtUtil.getRole(token))) {
            return ResponseEntity.status(403).build();
        }

        dispatchedItemService.rejectRestore(
                zohoItemId,
                JwtUtil.getUsername(token)
        );

        return ResponseEntity.ok().build();
    }

    /* ===================== DISPATCH STATUS ===================== */

    @PostMapping("/{zohoItemId:.+}/dispatch")
    public ResponseEntity<?> updateDispatchStatus(
            @PathVariable String zohoItemId,
            @RequestParam String status,
            @RequestHeader("Authorization") String auth
    ) {
        String token = extractToken(auth);

        System.out.println("🔥 API HIT BEFORE ROLE CHECK");
        System.out.println("TOKEN ROLE: " + JwtUtil.getRole(token));
        if (!"DISPATCH".equals(JwtUtil.getRole(token))) {
            return ResponseEntity.status(403).build();
        }
        ItemDispatchStatus parsedStatus;

        try {
            parsedStatus = ItemDispatchStatus.valueOf(status);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Invalid status: " + status);
        }

        dispatchedItemService.updateDispatchStatus(
                zohoItemId,
                parsedStatus,
                JwtUtil.getUsername(token)
        );
        System.out.println("➡ CONTROLLER HIT ID: " + zohoItemId);
        System.out.println("➡ STATUS: " + status);
        return ResponseEntity.ok().build();
        
    }

    /* ===================== MOVE TO WAREHOUSE ===================== */

    @PostMapping("/{zohoItemId:.+}/store")
    public ResponseEntity<?> moveToWarehouse(
            @PathVariable String zohoItemId,
            @RequestParam String warehouseCode,
            @RequestHeader("Authorization") String auth,
            @RequestParam(required = false) String fromLocation,
            @RequestHeader(value = "X-Username", required = false) String usernameHeader
    ) {
        String token = extractToken(auth);

        if (!"DISPATCH".equals(JwtUtil.getRole(token))) {
            return ResponseEntity.status(403).build();
        }

        String username = (usernameHeader != null && !usernameHeader.isBlank())
                ? usernameHeader
                : JwtUtil.getUsername(token);

        if (warehouseCode == null || warehouseCode.isBlank()) {
            return ResponseEntity.badRequest().body("Warehouse code required");
        }

        // ✅ DEBUG LOG (helps a LOT)
        System.out.println("➡ STORE: " + zohoItemId + " → " + warehouseCode);

        String gatePass = dispatchedItemService.moveToWarehouse(
                zohoItemId,
                warehouseCode,
                fromLocation,
                username
        );

        
        return ResponseEntity.ok(
                java.util.Map.of("gatePass", gatePass)
        );
    }
    
    @PostMapping("/bulk/store")
    public ResponseEntity<?> bulkMoveToWarehouse(
            @RequestBody List<String> itemIds,
            @RequestParam String warehouseCode,
            @RequestParam(required = false) String fromLocation,
            @RequestHeader("Authorization") String auth
    ) {
        String token = extractToken(auth);

        if (!"DISPATCH".equals(JwtUtil.getRole(token))) {
            return ResponseEntity.status(403).build();
        }

        String gatePass = dispatchedItemService.bulkMoveToWarehouse(
                itemIds,
                warehouseCode,
                fromLocation,
                JwtUtil.getUsername(token)
        );

        return ResponseEntity.ok(java.util.Map.of("gatePass", gatePass));
    }
    
    @PostMapping("/bulk/status")
    public ResponseEntity<?> bulkStatusUpdate(
            @RequestBody List<String> ids,
            @RequestParam String status,
            @RequestHeader("Authorization") String auth
    ) {
        String token = extractToken(auth);

        dispatchedItemService.bulkUpdateStatus(
                ids,
                ItemDispatchStatus.valueOf(status),
                JwtUtil.getUsername(token)
        );

        return ResponseEntity.ok().build();
    }

    @PostMapping("/{zohoItemId:.+}/request-return")
    public ResponseEntity<?> requestReturn(
            @PathVariable String zohoItemId,
            @RequestHeader("Authorization") String auth
    ) {
        String token = extractToken(auth);

        // ✅ ADD THIS
        if (!"DISPATCH".equals(JwtUtil.getRole(token))) {
            return ResponseEntity.status(403).build();
        }

        dispatchedItemService.requestReturnToDispatch(
            zohoItemId,
            JwtUtil.getUsername(token)
        );

        return ResponseEntity.ok().build();
    }
    
    @PostMapping("/{zohoItemId:.+}/approve-return")
    public ResponseEntity<?> approveReturn(
            @PathVariable String zohoItemId,
            @RequestHeader("Authorization") String auth
    ) {
        String token = extractToken(auth);

        if (!"ADMIN".equals(JwtUtil.getRole(token))) {
            return ResponseEntity.status(403).build();
        }

        dispatchedItemService.approveReturnToDispatch(
            zohoItemId,
            JwtUtil.getUsername(token)
        );

        return ResponseEntity.ok().build();
    }
    
    @PostMapping("/{zohoItemId:.+}/reject-return")
    public ResponseEntity<?> rejectReturn(
            @PathVariable String zohoItemId,
            @RequestHeader("Authorization") String auth
    ) {
        String token = extractToken(auth);

        if (!"ADMIN".equals(JwtUtil.getRole(token))) {
            return ResponseEntity.status(403).build();
        }

        dispatchedItemService.rejectReturnToDispatch(
            zohoItemId,
            JwtUtil.getUsername(token)
        );

        return ResponseEntity.ok().build();
    }
    /* ===================== HELPER ===================== */

    private String extractToken(String auth) {
        if (auth == null || !auth.startsWith("Bearer ")) {
            throw new RuntimeException("Missing or invalid Authorization header");
        }
        return auth.replace("Bearer ", "");
    }
}
