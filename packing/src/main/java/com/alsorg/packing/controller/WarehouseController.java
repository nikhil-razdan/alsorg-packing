package com.alsorg.packing.controller;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.controller.dto.PlantAssignmentRequest;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.imports.ImportPreviewRow;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.DispatchedItemService;
import com.alsorg.packing.service.WarehouseService;

@RestController
@RequestMapping("/api/warehouse")
public class WarehouseController {

    private static final int MAX_BULK_IDS = 200;

    private final WarehouseService service;
    private final DispatchedItemService dservice;
    private final CurrentUserService currentUserService;

    public WarehouseController(
            WarehouseService service,
            DispatchedItemService dservice,
            CurrentUserService currentUserService) {
        this.service = service;
        this.dservice = dservice;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/floor")
    public List<DispatchedItem> floor() {
        User user = warehouseUser();
        return service.getFloorItems(
                currentUserService.allowedPlants(user),
                currentUserService.canViewAllWarehouseData(user));
    }

    @GetMapping("/items")
    public List<DispatchedItem> warehouse() {
        User user = warehouseUser();
        return service.getWarehouseItems(
                currentUserService.allowedPlants(user),
                currentUserService.canViewAllWarehouseData(user));
    }

    @PostMapping("/{zohoItemId}/store")
    public ResponseEntity<Map<String, String>> moveToWarehouse(
            @PathVariable String zohoItemId,
            @RequestParam String warehouseCode,
            @RequestParam String fromLocation) {

        User user = currentUserService.requireCurrentUser();
        requireGatePassGenerationAccess(user);

        String gatePass = dservice.moveToWarehouse(
                zohoItemId,
                warehouseCode,
                fromLocation,
                user.getUsername(),
                currentUserService.allowedPlants(user));

        return ResponseEntity.ok(Map.of(
                "gatePass", gatePass,
                "status", "WAREHOUSE_REQUESTED"));
    }

    @PostMapping("/bulk-move")
    public ResponseEntity<Map<String, String>> bulkMoveToWarehouse(
            @RequestBody(required = false) BulkMoveRequest request) {

        User user = currentUserService.requireCurrentUser();
        requireGatePassGenerationAccess(user);

        if (request == null) {
            throw badRequest("Bulk warehouse move request is required");
        }

        List<String> itemIds = cleanIds(request.itemIds());

        String gatePass = dservice.bulkMoveToWarehouse(
                itemIds,
                request.warehouseCode(),
                request.fromLocation(),
                user.getUsername(),
                currentUserService.allowedPlants(user));

        return ResponseEntity.ok(Map.of(
                "gatePass", gatePass,
                "status", "WAREHOUSE_REQUESTED"));
    }

    @PostMapping("/{zohoItemId}/approve")
    public ResponseEntity<Map<String, String>> approveWarehouse(
            @PathVariable String zohoItemId,
            @RequestParam String gatePass) {

        User user = warehouseUser();

        if (!currentUserService.canApproveWarehouseMove(user)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only WAREHOUSE or ADMIN can approve warehouse gate passes");
        }

        dservice.approveWarehouseMove(
                zohoItemId,
                gatePass,
                user.getUsername(),
                currentUserService.allowedPlants(user),
                user.getRole());

        return ResponseEntity.ok(Map.of(
                "message", "Warehouse approved successfully",
                "status", "IN_WAREHOUSE"));
    }

    @PostMapping("/{zohoItemId}/reject")
    public ResponseEntity<Map<String, String>> rejectWarehouse(
            @PathVariable String zohoItemId) {

        User user = warehouseUser();

        if (!currentUserService.canApproveWarehouseMove(user)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only WAREHOUSE or ADMIN can reject warehouse gate passes");
        }

        dservice.rejectWarehouseMove(
                zohoItemId,
                user.getUsername(),
                currentUserService.allowedPlants(user),
                user.getRole());

        return ResponseEntity.ok(Map.of(
                "message", "Warehouse request rejected",
                "status", "READY_TO_STORE"));
    }

    @PostMapping("/import")
    public ResponseEntity<String> importExcel(
            @RequestParam MultipartFile file,
            @RequestParam String mode,
            @RequestParam(required = false) String plantCode) {

        User user = warehouseUser();
        String resolvedPlant = currentUserService.resolvePlantForWrite(user, plantCode);

        /*
         * Audit identity is always the authenticated principal. X-Username is
         * deliberately not accepted here because it is user-controlled input.
         */
        service.processImport(
                file,
                mode,
                user.getUsername(),
                resolvedPlant);

        return ResponseEntity.ok("Import successful");
    }

    @PostMapping("/import/preview")
    public List<ImportPreviewRow> preview(
            @RequestParam MultipartFile file,
            @RequestParam String mode) {
        warehouseUser();
        return service.previewImport(file, mode);
    }

    @PostMapping("/import/confirm")
    public ResponseEntity<String> confirm(
            @RequestParam MultipartFile file,
            @RequestParam String mode,
            @RequestParam(required = false) String plantCode) {

        User user = warehouseUser();
        String resolvedPlant = currentUserService.resolvePlantForWrite(user, plantCode);

        service.processImport(
                file,
                mode,
                user.getUsername(),
                resolvedPlant);

        return ResponseEntity.ok("Import successful");
    }

    @GetMapping("/import/template")
    public ResponseEntity<byte[]> downloadTemplate() {
        warehouseUser();

        String header = String.join(",",
                "name",
                "sku",
                "pdNo",
                "drawingNo",
                "description",
                "clientName",
                "location",
                "warehouseCode",
                "gatePass");

        byte[] csv = (header + "\n").getBytes(StandardCharsets.UTF_8);

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"warehouse_import_template.csv\"")
                .header(
                        HttpHeaders.CACHE_CONTROL,
                        "no-store, no-cache, must-revalidate, max-age=0")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(csv);
    }

    @PostMapping("/admin/{zohoItemId}/request-return-to-dispatch")
    public ResponseEntity<Map<String, Object>> adminRequestReturnToDispatch(
            @PathVariable String zohoItemId) {

        User user = adminUser();
        service.adminRequestReturnToDispatch(zohoItemId, user.getUsername());

        return ResponseEntity.ok(Map.of(
                "message", "Return to Dispatch requested",
                "status", "WAREHOUSE_RETURN_REQUESTED",
                "zohoItemId", zohoItemId));
    }

    @PostMapping("/admin/returns/bulk/request")
    public ResponseEntity<Map<String, Object>> adminBulkRequestReturnToDispatch(
            @RequestBody List<String> itemIds) {

        User user = adminUser();
        List<String> cleanIds = cleanIds(itemIds);

        int updated = service.adminBulkRequestReturnToDispatch(
                cleanIds,
                user.getUsername());

        return ResponseEntity.ok(Map.of(
                "message", updated + " return request(s) created",
                "updated", updated,
                "status", "WAREHOUSE_RETURN_REQUESTED"));
    }

    @PostMapping("/admin/returns/bulk/approve")
    public ResponseEntity<Map<String, Object>> adminBulkApproveReturnRequests(
            @RequestBody List<String> itemIds) {

        User user = adminUser();
        List<String> cleanIds = cleanIds(itemIds);

        int updated = service.adminBulkApproveReturnRequests(
                cleanIds,
                user.getUsername());

        return ResponseEntity.ok(Map.of(
                "message", updated + " return request(s) approved",
                "updated", updated,
                "status", "READY"));
    }

    @PostMapping("/admin/returns/bulk/reject")
    public ResponseEntity<Map<String, Object>> adminBulkRejectReturnRequests(
            @RequestBody List<String> itemIds) {

        User user = adminUser();
        List<String> cleanIds = cleanIds(itemIds);

        int updated = service.adminBulkRejectReturnRequests(
                cleanIds,
                user.getUsername());

        return ResponseEntity.ok(Map.of(
                "message", updated + " return request(s) rejected",
                "updated", updated,
                "status", "IN_WAREHOUSE"));
    }

    @PatchMapping("/admin/{zohoItemId}/location")
    public ResponseEntity<DispatchedItem> adminEditLocation(
            @PathVariable String zohoItemId,
            @RequestBody PlantAssignmentRequest request) {

        User user = adminUser();
        validateLocationRequest(request);

        return ResponseEntity.ok(
                service.adminEditLocation(
                        zohoItemId,
                        request.getPlantCode(),
                        request.getCurrentLocationCode(),
                        request.getFgZoneCode(),
                        request.getWarehouseCode(),
                        user.getUsername()));
    }

    @PatchMapping("/admin/bulk-location")
    public ResponseEntity<Map<String, Object>> adminBulkEditLocation(
            @RequestBody(required = false) AdminBulkLocationRequest request) {

        User user = adminUser();

        if (request == null) {
            throw badRequest("Bulk location request is required");
        }

        List<String> uniqueIds = cleanIds(request.itemIds());

        if (request.plantCode() == null || request.plantCode().isBlank()) {
            throw badRequest("Plant code required");
        }

        int updated = service.adminBulkEditLocation(
                uniqueIds,
                request.plantCode(),
                request.currentLocationCode(),
                request.fgZoneCode(),
                request.warehouseCode(),
                user.getUsername());

        return ResponseEntity.ok(Map.of(
                "message", updated + " item location(s) updated",
                "updated", updated));
    }

    @PostMapping("/gatepass/generate-missing")
    public ResponseEntity<Map<String, Object>> generateMissingGatePass() {

        User user = warehouseUser();

        if (!currentUserService.hasAnyRole(user, "ADMIN", "DISPATCH")) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only ADMIN or DISPATCH can generate missing gate passes");
        }

        int generated = service.generateMissingGatePassForStoredItems(
                currentUserService.allowedPlants(user),
                currentUserService.canViewAllWarehouseData(user),
                user.getUsername());

        return ResponseEntity.ok(Map.of(
                "generated", generated,
                "message", generated + " missing gate pass number(s) generated"));
    }

    private User warehouseUser() {
        User user = currentUserService.requireCurrentUser();

        if (!currentUserService.canAccessWarehouse(user)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Warehouse access not allowed");
        }

        return user;
    }

    private User adminUser() {
        User user = currentUserService.requireCurrentUser();

        if (!currentUserService.isAdmin(user)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only ADMIN can perform this warehouse action");
        }

        return user;
    }

    private void requireGatePassGenerationAccess(User user) {
        if (!currentUserService.canGenerateWarehouseGatePass(user)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only DISPATCH or ADMIN can generate warehouse gate passes");
        }
    }

    private List<String> cleanIds(List<String> itemIds) {
        if (itemIds == null) {
            throw badRequest("Select at least one item");
        }

        List<String> result = itemIds.stream()
                .filter(id -> id != null && !id.trim().isBlank())
                .map(String::trim)
                .distinct()
                .toList();

        if (result.isEmpty()) {
            throw badRequest("Select at least one item");
        }

        if (result.size() > MAX_BULK_IDS) {
            throw new ResponseStatusException(
                    HttpStatus.PAYLOAD_TOO_LARGE,
                    "A maximum of " + MAX_BULK_IDS + " items can be processed at once");
        }

        return result;
    }

    private void validateLocationRequest(
            PlantAssignmentRequest request) {
        if (request == null
                || request.getPlantCode() == null
                || request.getPlantCode().isBlank()) {
            throw badRequest("Plant code required");
        }
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    public record BulkMoveRequest(
            List<String> itemIds,
            String warehouseCode,
            String fromLocation) {
    }

    public record AdminBulkLocationRequest(
            List<String> itemIds,
            String plantCode,
            String currentLocationCode,
            String fgZoneCode,
            String warehouseCode) {
    }
}
