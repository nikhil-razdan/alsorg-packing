package com.alsorg.packing.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.service.DispatchedItemService;
import com.alsorg.packing.controller.dto.PlantAssignmentRequest;
import java.util.List;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;

@RestController
@RequestMapping("/api/dispatched")
public class DispatchedItemsController {

    private final DispatchedItemRepository repository;
    private final DispatchedItemService dispatchedItemService;
    private final CurrentUserService currentUserService;

    public DispatchedItemsController(
            DispatchedItemRepository repository,
            DispatchedItemService dispatchedItemService,
            CurrentUserService currentUserService) {
        this.repository = repository;
        this.dispatchedItemService = dispatchedItemService;
        this.currentUserService = currentUserService;
    }

    /* ===================== FETCH ===================== */

    @GetMapping
    public List<DispatchedItem> getDispatchedItems(
            @RequestHeader(value = "Authorization", required = false) String auth) {
        User user = currentUserService.getCurrentUserFromAuth(auth);

        List<ItemDispatchStatus> statuses = List.of(
                ItemDispatchStatus.READY,
                ItemDispatchStatus.READY_TO_STORE,
                ItemDispatchStatus.WAREHOUSE_REQUESTED,
                ItemDispatchStatus.IN_WAREHOUSE,
                ItemDispatchStatus.READY_TO_DISPATCH,
                ItemDispatchStatus.DISPATCHED,
                ItemDispatchStatus.AVAILABLE,
                ItemDispatchStatus.WAREHOUSE_RETURN_REQUESTED);

        if (currentUserService.isAdmin(user)) {
            return repository.findByStatusIn(statuses);
        }

        return repository.findVisibleByStatusesAndPlantsIncludingLegacy(
                statuses,
                currentUserService.allowedPlants(user));
    }

    @PostMapping("/{zohoItemId:.+}/move-to-fg")
    public ResponseEntity<?> moveToFg(
            @PathVariable String zohoItemId,
            @RequestParam(required = false) String fgZoneCode,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        User user = currentUserService.getCurrentUserFromAuth(auth);

        if (!currentUserService.isDispatch(user)
                && !currentUserService.isAdmin(user)) {
            return ResponseEntity
                    .status(403)
                    .body("Only DISPATCH / ADMIN user can move item to FG");
        }

        dispatchedItemService.movePackedItemToFg(
                zohoItemId,
                fgZoneCode,
                user.getUsername(),
                currentUserService.allowedPlants(user));

        return ResponseEntity.ok(
                java.util.Map.of(
                        "message", "Moved to FG successfully",
                        "zohoItemId", zohoItemId,
                        "fgZoneCode", fgZoneCode == null ? "" : fgZoneCode));
    }

    /* ===================== REQUEST RESTORE ===================== */

    @PostMapping("/{zohoItemId:.+}/request-restore")
    public ResponseEntity<?> requestRestore(
            @PathVariable String zohoItemId,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        User user = currentUserService.getCurrentUserFromAuth(auth);

        dispatchedItemService.requestRestore(
                zohoItemId,
                user.getUsername(),
                user.getRole());

        return ResponseEntity.ok().build();
    }

    /* ===================== APPROVE RESTORE ===================== */

    @PostMapping("/{zohoItemId:.+}/approve-restore")
    public ResponseEntity<?> approveRestore(
            @PathVariable String zohoItemId,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        User user = currentUserService.getCurrentUserFromAuth(auth);

        if (!currentUserService.isAdmin(user)) {
            return ResponseEntity.status(403).build();
        }

        dispatchedItemService.approveRestore(
                zohoItemId,
                user.getUsername());

        return ResponseEntity.ok().build();
    }

    /* ===================== REJECT RESTORE ===================== */

    @PostMapping("/{zohoItemId:.+}/reject-restore")
    public ResponseEntity<?> rejectRestore(
            @PathVariable String zohoItemId,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        User user = currentUserService.getCurrentUserFromAuth(auth);

        if (!currentUserService.isAdmin(user)) {
            return ResponseEntity.status(403).build();
        }

        dispatchedItemService.rejectRestore(
                zohoItemId,
                user.getUsername());

        return ResponseEntity.ok().build();
    }

    /* ===================== DISPATCH STATUS ===================== */

    @PostMapping("/{zohoItemId:.+}/dispatch")
    public ResponseEntity<?> updateDispatchStatus(
            @PathVariable String zohoItemId,
            @RequestParam String status,
            @RequestHeader(value = "Authorization", required = false) String auth) {
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
                currentUserService.allowedPlants(user));
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
            @RequestParam(required = false) String fromLocation) {
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
                currentUserService.allowedPlants(user));

        return ResponseEntity.ok(
                java.util.Map.of("gatePass", gatePass));
    }

    @PostMapping("/bulk/store")
    public ResponseEntity<?> bulkMoveToWarehouse(
            @RequestBody List<String> itemIds,
            @RequestParam String warehouseCode,
            @RequestParam(required = false) String fromLocation,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        User user = currentUserService.getCurrentUserFromAuth(auth);

        if (!currentUserService.isDispatch(user)) {
            return ResponseEntity.status(403).build();
        }

        String gatePass = dispatchedItemService.bulkMoveToWarehouse(
                itemIds,
                warehouseCode,
                fromLocation,
                user.getUsername(),
                currentUserService.allowedPlants(user));

        return ResponseEntity.ok(
                java.util.Map.of("gatePass", gatePass));
    }

    @PostMapping("/bulk/status")
    public ResponseEntity<?> bulkStatusUpdate(
            @RequestBody List<String> ids,
            @RequestParam String status,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        User user = currentUserService.getCurrentUserFromAuth(auth);

        if (!currentUserService.isDispatch(user)) {
            return ResponseEntity.status(403).build();
        }

        dispatchedItemService.bulkUpdateStatus(
                ids,
                ItemDispatchStatus.valueOf(status),
                user.getUsername(),
                currentUserService.allowedPlants(user));

        return ResponseEntity.ok().build();
    }

    @PostMapping("/{zohoItemId:.+}/request-return")
    public ResponseEntity<?> requestReturn(
            @PathVariable String zohoItemId,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        User user = currentUserService.getCurrentUserFromAuth(auth);

        if (!currentUserService.isDispatch(user)) {
            return ResponseEntity.status(403).build();
        }

        dispatchedItemService.requestReturnToDispatch(
                zohoItemId,
                user.getUsername());

        return ResponseEntity.ok().build();
    }

    @PostMapping("/{zohoItemId:.+}/approve-return")
    public ResponseEntity<?> approveReturn(
            @PathVariable String zohoItemId,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        User user = currentUserService.getCurrentUserFromAuth(auth);

        if (!currentUserService.isAdmin(user)) {
            return ResponseEntity.status(403).build();
        }

        dispatchedItemService.approveReturnToDispatch(
                zohoItemId,
                user.getUsername());

        return ResponseEntity.ok().build();
    }

    @PostMapping("/{zohoItemId:.+}/reject-return")
    public ResponseEntity<?> rejectReturn(
            @PathVariable String zohoItemId,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        User user = currentUserService.getCurrentUserFromAuth(auth);

        if (!currentUserService.isAdmin(user)) {
            return ResponseEntity.status(403).build();
        }

        dispatchedItemService.rejectReturnToDispatch(
                zohoItemId,
                user.getUsername());

        return ResponseEntity.ok().build();
    }

    @PatchMapping("/{zohoItemId:.+}/plant-location")
    public ResponseEntity<?> assignPlantLocation(
            @PathVariable String zohoItemId,
            @RequestBody PlantAssignmentRequest req,
            @RequestHeader(value = "Authorization", required = false) String auth) {
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
                        user.getUsername()));
    }

    @GetMapping("/challans")
    public ResponseEntity<List<DispatchedChallanResponse>> getDispatchedChallans(
            @RequestHeader(value = "Authorization", required = false) String auth) {
        User user = currentUserService.getCurrentUserFromAuth(auth);

        List<ItemDispatchStatus> statuses = List.of(ItemDispatchStatus.DISPATCHED);

        List<DispatchedItem> sourceItems;

        if (currentUserService.isAdmin(user)) {
            sourceItems = repository.findByStatusIn(statuses);
        } else {
            sourceItems = repository.findVisibleByStatusesAndPlantsIncludingLegacy(
                    statuses,
                    currentUserService.allowedPlants(user));
        }

        List<DispatchedItem> dispatchedItems = sourceItems
                .stream()
                .filter(item -> item.getChalaanNumber() != null
                        && !item.getChalaanNumber().isBlank())
                .toList();

        LinkedHashMap<String, List<DispatchedItem>> grouped = new LinkedHashMap<>();

        for (DispatchedItem item : dispatchedItems) {
            String challanNumber = item.getChalaanNumber().trim();

            grouped
                    .computeIfAbsent(
                            challanNumber,
                            key -> new ArrayList<>())
                    .add(item);
        }

        List<DispatchedChallanResponse> response = new ArrayList<>();

        for (Map.Entry<String, List<DispatchedItem>> entry : grouped.entrySet()) {
            List<DispatchedItem> items = entry.getValue();

            DispatchedItem first = items.get(0);

            LocalDateTime dispatchedAt = items
                    .stream()
                    .map(DispatchedItem::getDispatchedAt)
                    .filter(date -> date != null)
                    .max(LocalDateTime::compareTo)
                    .orElse(null);

            List<DispatchedChallanItemResponse> itemResponses = items
                    .stream()
                    .map(this::toDispatchedChallanItemResponse)
                    .toList();

            response.add(
                    new DispatchedChallanResponse(
                            entry.getKey(),
                            first.getDriverId(),
                            first.getDriverName(),
                            first.getVehicleId(),
                            first.getVehicleNumber(),
                            dispatchedAt,
                            first.getDispatchedBy(),
                            items.size(),
                            itemResponses));
        }

        response.sort(
                Comparator
                        .comparing(
                                DispatchedChallanResponse::dispatchedAt,
                                Comparator.nullsLast(Comparator.reverseOrder())));

        return ResponseEntity.ok(response);
    }

    private DispatchedChallanItemResponse toDispatchedChallanItemResponse(
            DispatchedItem item) {
        return new DispatchedChallanItemResponse(
                item.getZohoItemId(),
                item.getName(),
                item.getSku(),
                item.getPdNo(),
                item.getDrawingNo(),
                item.getClientName(),
                item.getClientAddress(),
                item.getDescription(),
                item.getRemarks(),
                item.getPlantCode(),
                firstNonBlank(
                        item.getCurrentLocationCode(),
                        item.getLocation()),
                item.getStatus() == null
                        ? ""
                        : item.getStatus().name(),
                item.getQuantity(),
                item.getDispatchedAt(),
                item.getDispatchedBy());
    }

    private String firstNonBlank(
            String... values) {
        if (values == null) {
            return "";
        }

        for (String value : values) {
            if (value != null && !value.trim().isBlank()) {
                return value.trim();
            }
        }

        return "";
    }

    public record DispatchedChallanResponse(
            String challanNumber,
            java.util.UUID driverId,
            String driverName,
            java.util.UUID vehicleId,
            String vehicleNumber,
            LocalDateTime dispatchedAt,
            String dispatchedBy,
            int totalItems,
            List<DispatchedChallanItemResponse> items) {
    }

    public record DispatchedChallanItemResponse(
            String zohoItemId,
            String name,
            String sku,
            String pdNo,
            String drawingNo,
            String clientName,
            String clientAddress,
            String description,
            String remarks,
            String plantCode,
            String currentLocationCode,
            String status,
            Integer quantity,
            LocalDateTime dispatchedAt,
            String dispatchedBy) {
    }
}