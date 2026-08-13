package com.alsorg.packing.controller;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.data.domain.*;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.controller.dto.*;
import com.alsorg.packing.domain.common.PacketStatus;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.domain.packet.Packet;
import com.alsorg.packing.integration.zoho.ZohoInventoryClient;
import com.alsorg.packing.integration.zoho.dto.ZohoItemDTO;
import com.alsorg.packing.repository.PacketItemRepository;
import com.alsorg.packing.service.PacketService;
import com.alsorg.packing.service.ZohoItemCacheService;
import com.alsorg.packing.service.ZohoStickerService;
import com.alsorg.packing.domain.users.User;
import org.springframework.security.access.prepost.PreAuthorize;
import com.alsorg.packing.service.CurrentUserService;

@RestController
@RequestMapping("/api/packets")
@PreAuthorize("""
                isAuthenticated() and
                hasAnyAuthority(
                    'ADMIN',
                    'PACKING',
                    'WAREHOUSE',
                    'DISPATCH',
                    'LOGISTICS'
                )
                """)
public class PacketController {

        private final ZohoStickerService zohoStickerService;
        private final PacketService packetService;
        private final ZohoInventoryClient zohoInventoryClient;
        private final ZohoItemCacheService zohoItemCacheService;
        private final CurrentUserService currentUserService;

        public PacketController(
                        PacketService packetService,
                        ZohoInventoryClient zohoInventoryClient,
                        ZohoItemCacheService zohoItemCacheService,
                        ZohoStickerService zohoStickerService,
                        PacketItemRepository packetItemRepository,
                        CurrentUserService currentUserService) {
                this.packetService = packetService;
                this.zohoInventoryClient = zohoInventoryClient;
                this.zohoItemCacheService = zohoItemCacheService;
                this.zohoStickerService = zohoStickerService;
                this.currentUserService = currentUserService;
        }

        // =====================================================
        // PACKETS
        // =====================================================

        @PostMapping
        public ResponseEntity<PacketCreateResponse> createPacket(
                        @RequestBody PacketCreateRequest request,
                        @RequestHeader(value = "Authorization", required = false) String auth) {

                User user = currentUserService
                                .getCurrentUserFromAuth(auth);

                currentUserService
                                .rejectHardwareUserFromNormalInventory(
                                                user);

                List<PacketItem> items = request.getItems().stream().map(dto -> {
                        PacketItem item = new PacketItem();
                        item.setItemName(dto.getItemName());
                        item.setSku(dto.getSku());
                        item.setZohoItemId(dto.getZohoItemId());
                        item.setQuantity(dto.getQuantity());
                        item.setDescription(dto.getDescription());
                        item.setLocation(dto.getLocation());
                        item.setFloor(dto.getFloor());
                        item.setPdNo(dto.getPdNo());
                        item.setDrawingNo(dto.getDrawingNo());
                        item.setClientName(dto.getClientName());
                        item.setClientAddress(dto.getClientAddress());
                        return item;
                }).collect(Collectors.toList());

                Packet packet = packetService.createPacket(
                                request.getCompanyId(),
                                request.getCreatedBy(),
                                items);

                return ResponseEntity.ok(
                                new PacketCreateResponse(
                                                packet.getId(),
                                                packet.getStickerNumber(),
                                                packet.getStatus().name()));
        }

        @GetMapping
        public Page<PacketListResponse> getAllPackets(
                        @RequestParam(required = false) UUID companyId,
                        @RequestParam(required = false) PacketStatus status,
                        @RequestParam(defaultValue = "0") int page,
                        @RequestParam(defaultValue = "10") int size,
                        @RequestParam(defaultValue = "createdAt") String sortBy,
                        @RequestParam(defaultValue = "desc") String direction) {

                Sort sort = direction.equalsIgnoreCase("asc")
                                ? Sort.by(sortBy).ascending()
                                : Sort.by(sortBy).descending();

                Pageable pageable = PageRequest.of(page, size, sort);

                return packetService.getPackets(companyId, status, pageable)
                                .map(packet -> {
                                        PacketListResponse dto = new PacketListResponse();
                                        dto.setPacketId(packet.getId());
                                        dto.setStickerNumber(packet.getStickerNumber());
                                        dto.setCompanyName(packet.getCompany().getName());
                                        dto.setStatus(packet.getStatus().name());
                                        dto.setCreatedAt(packet.getCreatedAt());
                                        dto.setCreatedBy(packet.getCreatedBy());
                                        dto.setStickerGenerated(packet.getStickerGenerated());
                                        return dto;
                                });
        }

        // =====================================================
        // ZOHO ITEMS
        // =====================================================

        @GetMapping("/zoho/sync")
        public ResponseEntity<String> syncZohoItems() {
                List<ZohoItemDTO> items = zohoInventoryClient.fetchAllItems();
                zohoItemCacheService.load(items);
                return ResponseEntity.ok("Zoho cache loaded: " + items.size());
        }

        @GetMapping("/zoho/items/paged")
        public ResponseEntity<Map<String, Object>> fetchZohoItemsPaged(
                        @RequestParam int page,
                        @RequestParam int perPage,
                        @RequestParam(required = false) String search // 🔥 ADD THIS
        ) {
                return ResponseEntity.ok(
                                Map.of(
                                                "items", zohoItemCacheService.getPageForUI(page, perPage, search), // 🔥
                                                                                                                   // PASS
                                                                                                                   // SEARCH
                                                "total", zohoItemCacheService.totalCount(search) // 🔥 FILTERED COUNT
                                ));
        }

        @GetMapping("/zoho/items/{zohoItemId}")
        public ResponseEntity<ZohoItemDTO> getZohoItemDetails(
                        @PathVariable String zohoItemId) {
                return ResponseEntity.ok(
                                zohoInventoryClient.fetchItemDetails(zohoItemId));
        }

        // =====================================================
        // STICKER GENERATION (FINAL FIX)
        // =====================================================

        @PostMapping("/zoho/items/{zohoItemId}/generate-sticker")
        public ResponseEntity<byte[]> generateSticker(@PathVariable String zohoItemId,
                        @RequestParam String factoryFloor)
                        throws IOException {

                byte[] pdf = zohoStickerService.generateStickerForZohoItem(zohoItemId, factoryFloor);
                return ResponseEntity.ok()
                                .header(
                                                HttpHeaders.CONTENT_DISPOSITION,
                                                "inline; filename=STICKER_" + zohoItemId + ".pdf")
                                .contentType(MediaType.APPLICATION_PDF)
                                .body(pdf);
        }

        @PostMapping("/create")
        public ResponseEntity<?> createItem(
                        @RequestBody CreateItemRequest req,
                        @RequestHeader(value = "Authorization", required = false) String auth) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                currentUserService.rejectHardwareUserFromNormalInventory(user);

                String plantCode = currentUserService.resolvePlantForWrite(user, req.getPlantCode());

                List<PacketItem> items = packetService.createItemWithPackets(
                                req,
                                user,
                                plantCode);

                return ResponseEntity.ok(
                                items.stream().map(PacketItem::getId).toList());
        }

        @GetMapping("/items")
        public ResponseEntity<List<PacketItemResponse>> getAllItems(
                        @RequestHeader(value = "Authorization", required = false) String auth) {

                User user = currentUserService
                                .getCurrentUserFromAuth(
                                                auth);

                currentUserService
                                .rejectHardwareUserFromNormalInventory(
                                                user);

                List<PacketItemResponse> response = packetService
                                .getVisibleNormalInventoryItems(
                                                user,
                                                currentUserService
                                                                .allowedPlants(
                                                                                user));

                return ResponseEntity.ok(
                                response);
        }

        @PostMapping("/add-more/{masterItemId}")
        public ResponseEntity<?> addMorePackets(
                        @PathVariable UUID masterItemId,
                        @RequestBody CreateItemRequest req,
                        @RequestHeader(value = "Authorization", required = false) String auth) {
                if (req.getNumberOfPackets() <= 0) {
                        throw new RuntimeException("Invalid packet count");
                }

                User user = currentUserService.getCurrentUserFromAuth(auth);
                currentUserService.rejectHardwareUserFromNormalInventory(user);

                return ResponseEntity.ok(
                                packetService.addPackets(
                                                masterItemId,
                                                req,
                                                user,
                                                currentUserService.allowedPlants(user)));
        }

        @PostMapping("/items/{itemId}/generate-sticker")
        public ResponseEntity<byte[]> generateStickerForItem(
                        @PathVariable UUID itemId,
                        @RequestParam String factoryFloor,
                        @RequestParam(defaultValue = "true") boolean showCompanyHeader,
                        @RequestHeader(value = "Authorization", required = false) String auth) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                byte[] pdf = packetService.generateNormalSticker(
                                itemId,
                                factoryFloor,
                                showCompanyHeader,
                                user,
                                currentUserService.allowedPlants(user));

                return ResponseEntity.ok()
                                .header(
                                                HttpHeaders.CONTENT_DISPOSITION,
                                                "inline; filename=STICKER_" + itemId + ".pdf")
                                .contentType(MediaType.APPLICATION_PDF)
                                .body(pdf);
        }

        @PutMapping("/items/{itemId}")
        public PacketItem updateItem(
                        @PathVariable UUID itemId,
                        @RequestBody UpdatePacketItemRequest req,
                        @RequestHeader(value = "Authorization", required = false) String auth) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                currentUserService.rejectHardwareUserFromNormalInventory(user);

                return packetService.updateNormalPacketItem(
                                itemId,
                                req,
                                user,
                                currentUserService.allowedPlants(user));
        }

        @PostMapping("/create-custom")
        public ResponseEntity<?> createCustom(
                        @RequestBody CreateItemRequest req,
                        @RequestHeader(value = "Authorization", required = false) String auth) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                currentUserService.rejectHardwareUserFromNormalInventory(user);

                String plantCode = currentUserService.resolvePlantForWrite(user, req.getPlantCode());

                return ResponseEntity.ok(
                                packetService.createCustomPacket(
                                                req,
                                                user,
                                                plantCode));
        }

        @PostMapping("/add-custom/{masterItemId}")
        public ResponseEntity<?> addCustom(
                        @PathVariable UUID masterItemId,
                        @RequestBody CreateItemRequest req,
                        @RequestHeader(value = "Authorization", required = false) String auth) {
                User user = currentUserService.getCurrentUserFromAuth(auth);
                currentUserService.rejectHardwareUserFromNormalInventory(user);

                return ResponseEntity.ok(
                                packetService.addCustomPacket(
                                                masterItemId,
                                                req,
                                                user,
                                                currentUserService.allowedPlants(user)));
        }

        @DeleteMapping("/items/{itemId}")
        public ResponseEntity<?> deleteItem(
                        @PathVariable UUID itemId,
                        @RequestHeader(value = "Authorization", required = false) String auth) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                currentUserService.rejectHardwareUserFromNormalInventory(user);

                packetService.deleteNormalItem(
                                itemId,
                                user,
                                currentUserService.allowedPlants(user));

                return ResponseEntity.ok("Item deleted");
        }

        @PatchMapping("/items/{itemId}/plant-location")
        public ResponseEntity<?> assignPlantLocation(
                        @PathVariable UUID itemId,
                        @RequestBody PlantAssignmentRequest req,
                        @RequestHeader(value = "Authorization", required = false) String auth) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                if (!currentUserService.isAdmin(user)) {
                        return ResponseEntity.status(403)
                                        .body("Only ADMIN can assign old item plant location");
                }

                if (req.getPlantCode() == null || req.getPlantCode().isBlank()) {
                        return ResponseEntity.badRequest().body("Plant code required");
                }

                return ResponseEntity.ok(
                                packetService.assignPlantToPacketItem(
                                                itemId,
                                                req.getPlantCode()));
        }

        @PostMapping("/items/{itemId}/preview-sticker")
        public ResponseEntity<byte[]> previewStickerForItem(
                        @PathVariable UUID itemId,
                        @RequestParam(required = false) String factoryFloor,
                        @RequestParam(defaultValue = "true") boolean showCompanyHeader,
                        @RequestHeader(value = "Authorization", required = false) String auth) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                byte[] pdf = packetService.previewNormalSticker(
                                itemId,
                                factoryFloor,
                                showCompanyHeader,
                                user,
                                currentUserService.allowedPlants(user));

                return ResponseEntity.ok()
                                .header(
                                                HttpHeaders.CONTENT_DISPOSITION,
                                                "inline; filename=PREVIEW_STICKER_" + itemId + ".pdf")
                                .contentType(MediaType.APPLICATION_PDF)
                                .body(pdf);
        }

        @PutMapping("/items/{itemId}/admin-sticker-details")
        public ResponseEntity<?> adminUpdateStickerDetails(
                        @PathVariable UUID itemId,
                        @RequestBody UpdatePacketItemRequest req,
                        @RequestHeader(value = "Authorization", required = false) String auth) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                if (!currentUserService.isAdmin(user)) {
                        return ResponseEntity.status(403)
                                        .body("Only ADMIN can edit sticker details");
                }

                return ResponseEntity.ok(
                                packetService.adminUpdateStickerDetails(
                                                itemId,
                                                req));
        }

        /**
         * Correct an already-packed item's packing date from Dispatch Admin Edit.
         * The service also synchronizes DispatchedItem.packedAt and rebuilds the
         * stored PDFs in StickerHistory, so no separate history endpoint is needed.
         */
        @PutMapping("/dispatched/{zohoItemId:.+}/admin-packing-date")
        public ResponseEntity<?> adminUpdatePackingDate(
                        @PathVariable String zohoItemId,
                        @RequestBody AdminPackingDateRequest req,
                        @RequestHeader(value = "Authorization", required = false) String auth) {

                User user = currentUserService.getCurrentUserFromAuth(auth);

                if (!currentUserService.isAdmin(user)) {
                        return ResponseEntity.status(403)
                                        .body("Only ADMIN can edit packing date");
                }

                if (req == null ||
                                req.packingDate() == null ||
                                req.packingDate().isBlank()) {
                        return ResponseEntity.badRequest()
                                        .body("Packing date is required");
                }

                return ResponseEntity.ok(
                                packetService.adminUpdatePackingDateForDispatchedItem(
                                                zohoItemId,
                                                req.packingDate(),
                                                user.getUsername()));
        }

        public record AdminPackingDateRequest(
                        String packingDate) {
        }
}
