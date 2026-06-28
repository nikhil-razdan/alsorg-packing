package com.alsorg.packing.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.service.DispatchedItemService;
import com.alsorg.packing.security.JwtUtil;
import com.alsorg.packing.controller.dto.PlantAssignmentRequest;
import java.util.List;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;

@RestController
@RequestMapping("/api/dispatched")
public class DispatchedItemsController {

    private final DispatchedItemRepository repository;
    private final DispatchedItemService dispatchedItemService;
    private final CurrentUserService currentUserService;

    public DispatchedItemsController(
            DispatchedItemRepository repository,
            DispatchedItemService dispatchedItemService,
            CurrentUserService currentUserService
    ) {
        this.repository = repository;
        this.dispatchedItemService = dispatchedItemService;
        this.currentUserService = currentUserService;
    }

    /* ===================== FETCH ===================== */

    @GetMapping
    public List<DispatchedItem> getDispatchedItems(
            @RequestHeader(value = "authheaders", required = false) String auth
    ) {
        User user = currentUserService.getCurrentUserFromAuth(auth);

        List<ItemDispatchStatus> statuses = List.of(
                ItemDispatchStatus.READY,
                ItemDispatchStatus.READY_TO_STORE,
                ItemDispatchStatus.WAREHOUSE_REQUESTED,
                ItemDispatchStatus.IN_WAREHOUSE,
                ItemDispatchStatus.READY_TO_DISPATCH,
                ItemDispatchStatus.LOADED,
                ItemDispatchStatus.DISPATCHED,
                ItemDispatchStatus.OUT_FOR_DELIVERY,
                ItemDispatchStatus.DELIVERED,
                ItemDispatchStatus.AVAILABLE,
                ItemDispatchStatus.WAREHOUSE_RETURN_REQUESTED
        );

        if (currentUserService.isAdmin(user)) {
            return repository.findByStatusIn(statuses);
        }

        return repository.findVisibleByStatusesAndPlantsIncludingLegacy(
                statuses,
                currentUserService.allowedPlants(user)
        );
    }
    
    @PostMapping("/{zohoItemId:.+}/move-to-fg")
    public ResponseEntity<?> moveToFg(
            @PathVariable String zohoItemId,
            @RequestParam(required = false) String fgZoneCode,
            @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        User user = currentUserService.getCurrentUserFromAuth(auth);

        System.out.println(
                "MOVE_TO_FG USER = " + user.getUsername()
                + " | ROLE = " + user.getRole()
        );
        
        if (!currentUserService.isDispatch(user)) {
            return ResponseEntity
                    .status(403)
                    .body("Only DISPATCH user can move item to FG");
        }

        dispatchedItemService.movePackedItemToFg(
                zohoItemId,
                fgZoneCode,
                user.getUsername(),
                currentUserService.allowedPlants(user)
        );

        return ResponseEntity.ok().build();
    }

    /* ===================== REQUEST RESTORE ===================== */

    @PostMapping("/{zohoItemId:.+}/request-restore")
    public ResponseEntity<?> requestRestore(
            @PathVariable String zohoItemId,
            @RequestHeader(value = "Authorization", required = false) String auth
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
            @RequestHeader(value = "Authorization", required = false) String auth
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
            @RequestHeader(value = "Authorization", required = false) String auth
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
            @RequestHeader(value = "Authorization", required = false) String auth
    ) {
    	User user = currentUserService.getCurrentUserFromAuth(auth);

    	if (!currentUserService.isDispatch(user)) {
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
                user.getUsername(),
                currentUserService.allowedPlants(user)
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
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestParam(required = false) String fromLocation
    ) {
        User user = currentUserService.getCurrentUserFromAuth(auth);

        if (!currentUserService.isDispatch(user)) {
            return ResponseEntity.status(403).build();
        }

        if (warehouseCode == null || warehouseCode.isBlank()) {
            return ResponseEntity.badRequest().body("Warehouse code required");
        }

        String gatePass = dispatchedItemService.moveToWarehouse(
                zohoItemId,
                warehouseCode,
                fromLocation,
                user.getUsername(),
                currentUserService.allowedPlants(user)
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
            @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        User user = currentUserService.getCurrentUserFromAuth(auth);

        if (!currentUserService.isDispatch(user)) {
            return ResponseEntity.status(403).build();
        }

        String gatePass = dispatchedItemService.bulkMoveToWarehouse(
                itemIds,
                warehouseCode,
                fromLocation,
                user.getUsername(),
                currentUserService.allowedPlants(user)
        );

        return ResponseEntity.ok(
                java.util.Map.of("gatePass", gatePass)
        );
    }
    
    @PostMapping("/bulk/status")
    public ResponseEntity<?> bulkStatusUpdate(
            @RequestBody List<String> ids,
            @RequestParam String status,
            @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        User user = currentUserService.getCurrentUserFromAuth(auth);

        if (!currentUserService.isDispatch(user)) {
            return ResponseEntity.status(403).build();
        }

        dispatchedItemService.bulkUpdateStatus(
                ids,
                ItemDispatchStatus.valueOf(status),
                user.getUsername(),
                currentUserService.allowedPlants(user)
        );

        return ResponseEntity.ok().build();
    }

    @PostMapping("/{zohoItemId:.+}/request-return")
    public ResponseEntity<?> requestReturn(
            @PathVariable String zohoItemId,
            @RequestHeader(value = "Authorization", required = false) String auth
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
            @RequestHeader(value = "Authorization", required = false) String auth
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
            @RequestHeader(value = "Authorization", required = false) String auth
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
    
    @PatchMapping("/{zohoItemId:.+}/plant-location")
    public ResponseEntity<?> assignPlantLocation(
            @PathVariable String zohoItemId,
            @RequestBody PlantAssignmentRequest req,
            @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        User user = currentUserService.getCurrentUserFromAuth(auth);

        if (!currentUserService.isAdmin(user)) {
            return ResponseEntity.status(403)
                    .body("Only ADMIN can assign plant/location");
        }

        if (req.getPlantCode() == null || req.getPlantCode().isBlank()) {
            return ResponseEntity.badRequest().body("Plant code required");
        }

        return ResponseEntity.ok(
                dispatchedItemService.assignPlantLocationToDispatchedItem(
                        zohoItemId,
                        req.getPlantCode(),
                        req.getCurrentLocationCode(),
                        req.getFgZoneCode(),
                        req.getWarehouseCode(),
                        user.getUsername()
                )
        );
    }
    /* ===================== HELPER ===================== */

    private String extractToken(String auth) {
        if (auth == null || !auth.startsWith("Bearer ")) {
            throw new RuntimeException("Missing or invalid Authorization header");
        }
        return auth.replace("Bearer ", "");
    }
}
