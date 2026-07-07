package com.alsorg.packing.controller;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.alsorg.packing.service.WarehouseService;
import com.alsorg.packing.domain.imports.ImportPreviewRow;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.service.DispatchedItemService;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.security.JwtUtil;
import com.alsorg.packing.service.CurrentUserService;

@RestController
@RequestMapping("/api/warehouse")
public class WarehouseController {

        private final WarehouseService service;
        private final DispatchedItemService dservice;
        private final CurrentUserService currentUserService;

        public WarehouseController(WarehouseService service,
                        DispatchedItemService dservice,
                        CurrentUserService currentUserService) {
                this.service = service;
                this.dservice = dservice;
                this.currentUserService = currentUserService;
        }

        @GetMapping("/floor")
        public List<DispatchedItem> floor(
                        @RequestHeader(value = "Authorization", required = false) String auth) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                assertWarehouseAccess(user);

                return service.getFloorItems(
                                currentUserService.allowedPlants(user),
                                currentUserService.canViewAllWarehouseData(user));
        }

        @GetMapping("/items")
        public List<DispatchedItem> warehouse(
                        @RequestHeader(value = "Authorization", required = false) String auth) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                assertWarehouseAccess(user);

                return service.getWarehouseItems(
                                currentUserService.allowedPlants(user),
                                currentUserService.canViewAllWarehouseData(user));
        }

        @PostMapping("/{zohoItemId}/store")
        public ResponseEntity<?> moveToWarehouse(
                        @PathVariable String zohoItemId,
                        @RequestParam String warehouseCode,
                        @RequestParam String fromLocation,
                        @RequestHeader(value = "Authorization", required = false) String auth) {

                User user = currentUserService.getCurrentUserFromAuth(auth);

                if (!currentUserService.canGenerateWarehouseGatePass(user)) {
                        return ResponseEntity
                                        .status(403)
                                        .body("Only DISPATCH / ADMIN user can generate warehouse gate pass");
                }

                String gatePass = dservice.moveToWarehouse(
                                zohoItemId,
                                warehouseCode,
                                fromLocation,
                                user.getUsername(),
                                currentUserService.allowedPlants(user));

                return ResponseEntity.ok(
                                Map.of(
                                                "gatePass", gatePass,
                                                "status", "WAREHOUSE_REQUESTED"));
        }

        @SuppressWarnings("unchecked")
        @PostMapping("/bulk-move")
        public ResponseEntity<?> bulkMoveToWarehouse(
                        @RequestBody Map<String, Object> body,
                        @RequestHeader(value = "Authorization", required = false) String auth) {

                User user = currentUserService.getCurrentUserFromAuth(auth);

                if (!currentUserService.canGenerateWarehouseGatePass(user)) {
                        return ResponseEntity
                                        .status(403)
                                        .body("Only DISPATCH / ADMIN user can generate warehouse gate pass");
                }

                List<String> itemIds = (List<String>) body.get("itemIds");

                String warehouseCode = (String) body.get("warehouseCode");

                String fromLocation = (String) body.get("fromLocation");

                String gatePass = dservice.bulkMoveToWarehouse(
                                itemIds,
                                warehouseCode,
                                fromLocation,
                                user.getUsername(),
                                currentUserService.allowedPlants(user));

                return ResponseEntity.ok(
                                Map.of(
                                                "gatePass", gatePass,
                                                "status", "WAREHOUSE_REQUESTED"));
        }

        @PostMapping("/{zohoItemId}/approve")
        public ResponseEntity<?> approveWarehouse(
                        @PathVariable String zohoItemId,
                        @RequestParam String gatePass,
                        @RequestHeader(value = "Authorization", required = false) String auth) {

                User user = currentUserService.getCurrentUserFromAuth(auth);

                assertWarehouseAccess(user);

                if (!currentUserService.canApproveWarehouseMove(user)) {
                        return ResponseEntity
                                        .status(403)
                                        .body("Only WAREHOUSE / ADMIN / warehouse-access user can approve warehouse gate pass");
                }

                dservice.approveWarehouseMove(
                                zohoItemId,
                                gatePass,
                                user.getUsername(),
                                currentUserService.allowedPlants(user),
                                user.getRole());

                return ResponseEntity.ok(
                                Map.of(
                                                "message", "Warehouse approved successfully",
                                                "status", "IN_WAREHOUSE"));
        }

        @PostMapping("/import")
        public ResponseEntity<?> importExcel(
                        @RequestParam MultipartFile file,
                        @RequestParam String mode,
                        @RequestParam(required = false) String plantCode,
                        @RequestHeader(value = "Authorization", required = false) String auth,
                        @RequestHeader(value = "X-Username", required = false) String username) {
                User user = currentUserService.getCurrentUserFromAuth(auth);
                assertWarehouseAccess(user);

                String resolvedPlant = currentUserService.resolvePlantForWrite(user, plantCode);

                service.processImport(
                                file,
                                mode,
                                username != null && !username.isBlank()
                                                ? username
                                                : user.getUsername(),
                                resolvedPlant);

                return ResponseEntity.ok("Import successful");
        }

        @PostMapping("/{zohoItemId}/reject")
        public ResponseEntity<?> rejectWarehouse(
                        @PathVariable String zohoItemId,
                        @RequestHeader(value = "Authorization", required = false) String auth) {

                User user = currentUserService.getCurrentUserFromAuth(auth);

                assertWarehouseAccess(user);

                if (!currentUserService.canApproveWarehouseMove(user)) {
                        return ResponseEntity
                                        .status(403)
                                        .body("Only WAREHOUSE / ADMIN / warehouse-access user can reject warehouse gate pass");
                }

                dservice.rejectWarehouseMove(
                                zohoItemId,
                                user.getUsername(),
                                currentUserService.allowedPlants(user),
                                user.getRole());

                return ResponseEntity.ok(
                                Map.of(
                                                "message", "Warehouse request rejected",
                                                "status", "READY_TO_STORE"));
        }

        @PostMapping("/import/preview")
        public List<ImportPreviewRow> preview(
                        @RequestParam MultipartFile file,
                        @RequestParam String mode,
                        @RequestHeader(value = "Authorization", required = false) String auth) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                assertWarehouseAccess(user);

                return service.previewImport(file, mode);
        }

        @PostMapping("/import/confirm")
        public ResponseEntity<?> confirm(
                        @RequestParam MultipartFile file,
                        @RequestParam String mode,
                        @RequestParam(required = false) String plantCode,
                        @RequestHeader(value = "Authorization", required = false) String auth,
                        @RequestHeader(value = "X-Username", required = false) String username) {
                User user = currentUserService.getCurrentUserFromAuth(auth);
                assertWarehouseAccess(user);

                String resolvedPlant = currentUserService.resolvePlantForWrite(user, plantCode);

                service.processImport(
                                file,
                                mode,
                                username != null && !username.isBlank()
                                                ? username
                                                : user.getUsername(),
                                resolvedPlant);

                return ResponseEntity.ok("Import successful");
        }

        @GetMapping("/import/template")
        public ResponseEntity<byte[]> downloadTemplate(
                        @RequestHeader(value = "Authorization", required = false) String auth) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                assertWarehouseAccess(user);

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

                byte[] csv = (header + "\n").getBytes();

                return ResponseEntity.ok()
                                .header("Content-Disposition", "attachment; filename=warehouse_import_template.csv")
                                .header("Content-Type", "text/csv")
                                .body(csv);
        }

        private void assertWarehouseAccess(User user) {
                if (!currentUserService.canAccessWarehouse(user)) {
                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "Warehouse access not allowed");
                }
        }

        @PostMapping("/gatepass/generate-missing")
        public ResponseEntity<Map<String, Object>> generateMissingGatePass(
                        @RequestHeader(value = "Authorization", required = false) String auth) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                assertWarehouseAccess(user);

                if (!currentUserService.isAdmin(user) &&
                                !currentUserService.isDispatch(user)) {
                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "Only ADMIN or DISPATCH can generate missing gate passes");
                }

                int generated = service.generateMissingGatePassForStoredItems(
                                currentUserService.allowedPlants(user),
                                currentUserService.canViewAllWarehouseData(user),
                                user.getUsername());

                return ResponseEntity.ok(
                                Map.of(
                                                "generated", generated,
                                                "message", generated + " missing gate pass number(s) generated"));
        }
}