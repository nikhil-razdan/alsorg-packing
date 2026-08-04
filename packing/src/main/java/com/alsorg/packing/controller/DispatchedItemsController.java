package com.alsorg.packing.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.service.DispatchedItemService;
import com.alsorg.packing.controller.dto.PlantAssignmentRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import java.util.Set;
import java.util.List;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

import org.springframework.http.MediaType;

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

        private static final int MAX_DISPATCH_PAGE_SIZE = 200;

        @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
        public ResponseEntity<List<DispatchedItem>> getDispatchedItems(

                        @RequestParam(defaultValue = "0") int page,

                        @RequestParam(defaultValue = "200") int size,

                        @RequestHeader(value = "Authorization", required = false) String auth) {

                User user = currentUserService
                                .getCurrentUserFromAuth(
                                                auth);

                /*
                 * Keep the server protected from a client requesting
                 * 8,500 records in one HTTP response.
                 */
                int safePage = Math.max(
                                page,
                                0);

                int safeSize = Math.min(
                                Math.max(
                                                size,
                                                1),
                                MAX_DISPATCH_PAGE_SIZE);

                /*
                 * Include every ItemDispatchStatus value.
                 *
                 * Your previous list omitted statuses used by the frontend,
                 * including LOADED, OUT_FOR_DELIVERY, DELIVERED and RESTORED.
                 *
                 * Using values() also prevents new status values from silently
                 * disappearing from the Dispatch page later.
                 */
                List<ItemDispatchStatus> statuses = List.of(
                                ItemDispatchStatus.values());

                /*
                 * Stable pagination:
                 *
                 * createdAt handles normal newest-first sorting.
                 * zohoItemId breaks ties where multiple rows have the same timestamp.
                 */
                Sort stableSort = Sort.by(
                                Sort.Direction.DESC,
                                "createdAt").and(
                                                Sort.by(
                                                                Sort.Direction.ASC,
                                                                "zohoItemId"));

                Pageable pageable = PageRequest.of(
                                safePage,
                                safeSize,
                                stableSort);

                boolean admin = currentUserService.isAdmin(
                                user);

                Set<String> allowedPlants = admin
                                ? Set.of()
                                : currentUserService
                                                .allowedPlants(
                                                                user);

                Page<DispatchedItem> result;

                if (admin) {

                        result = repository.findByStatusIn(
                                        statuses,
                                        pageable);

                } else if (allowedPlants == null ||
                                allowedPlants.isEmpty()) {

                        /*
                         * Preserve your existing legacy-data visibility rule.
                         */
                        result = repository
                                        .findLegacyVisiblePageByStatuses(
                                                        statuses,
                                                        pageable);

                } else {

                        result = repository
                                        .findVisiblePageByStatusesAndPlantsIncludingLegacy(
                                                        statuses,
                                                        allowedPlants,
                                                        pageable);
                }

                return ResponseEntity
                                .ok()
                                .contentType(
                                                MediaType.APPLICATION_JSON)
                                .header(
                                                HttpHeaders.CACHE_CONTROL,
                                                "no-store, no-cache, must-revalidate")
                                .header(
                                                "X-Total-Pages",
                                                String.valueOf(
                                                                result.getTotalPages()))
                                .header(
                                                "X-Total-Elements",
                                                String.valueOf(
                                                                result.getTotalElements()))
                                .header(
                                                "X-Page-Number",
                                                String.valueOf(
                                                                result.getNumber()))
                                .header(
                                                "X-Page-Size",
                                                String.valueOf(
                                                                result.getSize()))
                                .header(
                                                "X-Has-Next",
                                                String.valueOf(
                                                                result.hasNext()))
                                .body(
                                                result.getContent());
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

                if (!currentUserService.canGenerateWarehouseGatePass(user)) {
                        return ResponseEntity
                                        .status(403)
                                        .body("Only DISPATCH / ADMIN user can generate warehouse gate pass");
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
                                java.util.Map.of(
                                                "gatePass", gatePass,
                                                "status", "WAREHOUSE_REQUESTED",
                                                "message", "Gate pass generated. Awaiting warehouse approval."));
        }

        @PostMapping("/bulk/store")
        public ResponseEntity<?> bulkMoveToWarehouse(
                        @RequestBody List<String> itemIds,
                        @RequestParam String warehouseCode,
                        @RequestParam(required = false) String fromLocation,
                        @RequestHeader(value = "Authorization", required = false) String auth) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                if (!currentUserService.canGenerateWarehouseGatePass(user)) {
                        return ResponseEntity
                                        .status(403)
                                        .body("Only DISPATCH / ADMIN user can generate warehouse gate pass");
                }

                String gatePass = dispatchedItemService.bulkMoveToWarehouse(
                                itemIds,
                                warehouseCode,
                                fromLocation,
                                user.getUsername(),
                                currentUserService.allowedPlants(user));

                return ResponseEntity.ok(
                                java.util.Map.of(
                                                "gatePass", gatePass,
                                                "status", "WAREHOUSE_REQUESTED",
                                                "message", "Bulk gate pass generated. Awaiting warehouse approval."));
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

                String currentUsername = cleanLower(user.getUsername());

                List<DispatchedItem> dispatchedItems = sourceItems
                                .stream()
                                .filter(item -> item.getChalaanNumber() != null
                                                && !item.getChalaanNumber().isBlank())
                                .filter(item -> {
                                        if (currentUserService.isAdmin(user)) {
                                                return true;
                                        }

                                        return cleanLower(item.getDispatchedBy())
                                                        .equals(currentUsername);
                                })
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
                                        .min(LocalDateTime::compareTo)
                                        .orElse(null);

                        LocalDateTime tripStartedAt = items
                                        .stream()
                                        .map(DispatchedItem::getTripStartedAt)
                                        .filter(date -> date != null)
                                        .min(LocalDateTime::compareTo)
                                        .orElse(dispatchedAt);

                        LocalDateTime tripEndedAt = items
                                        .stream()
                                        .map(DispatchedItem::getTripEndedAt)
                                        .filter(date -> date != null)
                                        .max(LocalDateTime::compareTo)
                                        .orElse(null);

                        LocalDateTime durationEnd = tripEndedAt != null
                                        ? tripEndedAt
                                        : LocalDateTime.now(
                                                        ZoneId.of("Asia/Kolkata"));

                        Long tripDurationMinutes = tripStartedAt == null
                                        ? null
                                        : ChronoUnit.MINUTES.between(
                                                        tripStartedAt,
                                                        durationEnd);

                        String tripStatus = tripEndedAt == null
                                        ? "RUNNING"
                                        : "ENDED";

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
                                                        tripStartedAt,
                                                        tripEndedAt,
                                                        tripDurationMinutes,
                                                        tripStatus,
                                                        items.size(),
                                                        itemResponses));
                }

                response.sort((a, b) -> {
                        LocalDateTime da = a.dispatchedAt();
                        LocalDateTime db = b.dispatchedAt();

                        if (da == null && db == null) {
                                return 0;
                        }

                        if (da == null) {
                                return 1;
                        }

                        if (db == null) {
                                return -1;
                        }

                        return db.compareTo(da);
                });

                return ResponseEntity.ok(response);
        }

        @PostMapping("/challans/{challanNumber:.+}/end-trip")
        public ResponseEntity<?> endDispatchedChallanTrip(
                        @PathVariable String challanNumber,
                        @RequestBody(required = false) EndTripRequest request,
                        @RequestHeader(value = "Authorization", required = false) String auth) {

                User user = currentUserService.getCurrentUserFromAuth(auth);

                if (!currentUserService.isLogistics(user)
                                && !currentUserService.isAdmin(user)) {
                        return ResponseEntity
                                        .status(403)
                                        .body("Only LOGISTICS / ADMIN user can end trip");
                }

                String cleanChallanNumber = challanNumber == null
                                ? ""
                                : challanNumber.trim();

                if (cleanChallanNumber.isBlank()) {
                        return ResponseEntity
                                        .badRequest()
                                        .body(
                                                        "Challan number is required");
                }

                List<DispatchedItem> items;

                if (currentUserService.isAdmin(
                                user)) {

                        items = repository
                                        .findByStatusAndChalaanNumber(
                                                        ItemDispatchStatus.DISPATCHED,
                                                        cleanChallanNumber);

                } else {

                        Set<String> allowedPlants = currentUserService
                                        .allowedPlants(
                                                        user);

                        if (allowedPlants == null ||
                                        allowedPlants.isEmpty()) {

                                items = repository
                                                .findLegacyByStatusAndChalaanNumber(
                                                                ItemDispatchStatus.DISPATCHED,
                                                                cleanChallanNumber);

                        } else {

                                items = repository
                                                .findVisibleByStatusAndChalaanNumberIncludingLegacy(
                                                                ItemDispatchStatus.DISPATCHED,
                                                                cleanChallanNumber,
                                                                allowedPlants);
                        }
                }

                if (items.isEmpty()) {
                        return ResponseEntity
                                        .badRequest()
                                        .body("No dispatched items found for challan: " + challanNumber);
                }

                LocalDateTime nowIst = LocalDateTime.now(
                                ZoneId.of("Asia/Kolkata"));

                LocalDateTime selectedEndTime = firstNonNull(
                                request == null ? null : request.tripEndedAt(),
                                request == null ? null : request.endTime(),
                                request == null ? null : request.tripEnd());

                LocalDateTime finalEndTime = selectedEndTime != null
                                ? selectedEndTime
                                : nowIst;

                LocalDateTime tripStartedAt = items
                                .stream()
                                .map(DispatchedItem::getTripStartedAt)
                                .filter(date -> date != null)
                                .min(LocalDateTime::compareTo)
                                .orElse(null);

                if (tripStartedAt == null) {
                        tripStartedAt = items
                                        .stream()
                                        .map(DispatchedItem::getDispatchedAt)
                                        .filter(date -> date != null)
                                        .min(LocalDateTime::compareTo)
                                        .orElse(finalEndTime);
                }

                if (finalEndTime.isBefore(tripStartedAt)) {
                        return ResponseEntity
                                        .badRequest()
                                        .body("Trip end time cannot be before trip start time");
                }

                for (DispatchedItem item : items) {
                        if (item.getTripStartedAt() == null) {
                                item.setTripStartedAt(
                                                item.getDispatchedAt() != null
                                                                ? item.getDispatchedAt()
                                                                : tripStartedAt);
                        }

                        item.setTripEndedAt(finalEndTime);
                }

                repository.saveAll(items);

                Long durationMinutes = ChronoUnit.MINUTES.between(
                                tripStartedAt,
                                finalEndTime);

                return ResponseEntity.ok(
                                Map.of(
                                                "message", "Trip end time saved successfully",
                                                "challanNumber", cleanChallanNumber,
                                                "tripStartedAt", tripStartedAt.toString(),
                                                "tripEndedAt", finalEndTime.toString(),
                                                "tripDurationMinutes", durationMinutes));
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
                        LocalDateTime tripStartedAt,
                        LocalDateTime tripEndedAt,
                        Long tripDurationMinutes,
                        String tripStatus,
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

        private LocalDateTime firstNonNull(
                        LocalDateTime first,
                        LocalDateTime second,
                        LocalDateTime third) {
                if (first != null) {
                        return first;
                }

                if (second != null) {
                        return second;
                }

                return third;
        }

        public record EndTripRequest(
                        LocalDateTime tripEndedAt,
                        LocalDateTime endTime,
                        LocalDateTime tripEnd) {
        }

        private String cleanLower(String value) {
                if (value == null) {
                        return "";
                }

                return value.trim().toLowerCase();
        }
}