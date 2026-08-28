package com.alsorg.packing.controller;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.controller.dto.CreateItemRequest;
import com.alsorg.packing.controller.dto.PacketCreateRequest;
import com.alsorg.packing.controller.dto.PacketCreateResponse;
import com.alsorg.packing.controller.dto.PacketItemResponse;
import com.alsorg.packing.controller.dto.PacketListResponse;
import com.alsorg.packing.controller.dto.PlantAssignmentRequest;
import com.alsorg.packing.controller.dto.UpdatePacketItemRequest;
import com.alsorg.packing.domain.common.PacketStatus;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.domain.packet.Packet;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.integration.zoho.ZohoInventoryClient;
import com.alsorg.packing.integration.zoho.dto.ZohoItemDTO;
import com.alsorg.packing.repository.PacketItemRepository;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.PacketService;
import com.alsorg.packing.service.ZohoItemCacheService;
import com.alsorg.packing.service.ZohoStickerService;
import com.alsorg.packing.service.UtlWorkflowService;

@RestController
@RequestMapping("/api/packets")
@PreAuthorize("""
        isAuthenticated() and
        hasAnyAuthority(
            'ADMIN',
            'PACKING',
            'UTL_PACKING',
            'WAREHOUSE',
            'DISPATCH',
            'LOGISTICS'
        )
        """)
public class PacketController {

    private static final int MAX_PACKET_PAGE_SIZE = 100;
    private static final int MAX_INVENTORY_PAGE_SIZE = 100;
    private static final int MAX_LEGACY_PACKET_ITEMS = 500;
    private static final Set<String> PACKET_SORT_FIELDS = Set.of(
            "createdAt",
            "stickerNumber",
            "status",
            "id");

    private final ZohoStickerService zohoStickerService;
    private final PacketService packetService;
    private final ZohoInventoryClient zohoInventoryClient;
    private final ZohoItemCacheService zohoItemCacheService;
    private final CurrentUserService currentUserService;
    private final UtlWorkflowService utlWorkflowService;

    public PacketController(
            PacketService packetService,
            ZohoInventoryClient zohoInventoryClient,
            ZohoItemCacheService zohoItemCacheService,
            ZohoStickerService zohoStickerService,
            PacketItemRepository packetItemRepository,
            CurrentUserService currentUserService,
            UtlWorkflowService utlWorkflowService) {
        this.packetService = packetService;
        this.zohoInventoryClient = zohoInventoryClient;
        this.zohoItemCacheService = zohoItemCacheService;
        this.zohoStickerService = zohoStickerService;
        this.currentUserService = currentUserService;
        this.utlWorkflowService = utlWorkflowService;
        /*
         * PacketItemRepository is retained in the constructor for source/binary
         * compatibility with older wiring/tests; this controller no longer reads
         * it directly.
         */
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ADMIN','PACKING','UTL_PACKING')")
    public ResponseEntity<PacketCreateResponse> createPacket(
            @RequestBody(required = false) PacketCreateRequest request) {

        User user = normalInventoryUser();

        if (request == null
                || request.getItems() == null
                || request.getItems().isEmpty()) {
            throw badRequest("At least one packet item is required");
        }

        if (request.getItems().size() > MAX_LEGACY_PACKET_ITEMS) {
            throw new ResponseStatusException(
                    HttpStatus.PAYLOAD_TOO_LARGE,
                    "A maximum of " + MAX_LEGACY_PACKET_ITEMS
                            + " packet items can be created at once");
        }

        List<PacketItem> items = request.getItems()
                .stream()
                .map(dto -> {
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
                })
                .collect(Collectors.toList());

        Packet packet = packetService.createPacket(
                request.getCompanyId(),
                user.getUsername(),
                items);

        return ResponseEntity.ok(
                new PacketCreateResponse(
                        packet.getId(),
                        packet.getStickerNumber(),
                        packet.getStatus().name()));
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ADMIN','PACKING','UTL_PACKING')")
    public Page<PacketListResponse> getAllPackets(
            @RequestParam(required = false) UUID companyId,
            @RequestParam(required = false) PacketStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String direction) {

        normalInventoryUser();

        String safeSortBy = PACKET_SORT_FIELDS.contains(sortBy)
                ? sortBy
                : "createdAt";

        Sort sort = "asc".equalsIgnoreCase(direction)
                ? Sort.by(safeSortBy).ascending()
                : Sort.by(safeSortBy).descending();

        Pageable pageable = PageRequest.of(
                Math.max(0, page),
                Math.max(1, Math.min(size, MAX_PACKET_PAGE_SIZE)),
                sort);

        return packetService.getPackets(companyId, status, pageable)
                .map(packet -> {
                    PacketListResponse dto = new PacketListResponse();
                    dto.setPacketId(packet.getId());
                    dto.setStickerNumber(packet.getStickerNumber());
                    dto.setCompanyName(
                            packet.getCompany() == null
                                    ? null
                                    : packet.getCompany().getName());
                    dto.setStatus(packet.getStatus() == null ? null : packet.getStatus().name());
                    dto.setCreatedAt(packet.getCreatedAt());
                    dto.setCreatedBy(packet.getCreatedBy());
                    dto.setStickerGenerated(packet.getStickerGenerated());
                    return dto;
                });
    }

    /*
     * Legacy compatibility route. POST is the preferred explicit refresh verb;
     * GET is retained temporarily for older PackFlow clients but is restricted to
     * Inventory roles.
     */
    @RequestMapping(
            value = "/zoho/sync",
            method = {RequestMethod.GET, RequestMethod.POST})
    @PreAuthorize("hasAnyAuthority('ADMIN','PACKING','UTL_PACKING')")
    public ResponseEntity<String> syncZohoItems() {
        normalInventoryUser();
        zohoItemCacheService.refreshCache();
        return ResponseEntity.ok("Zoho cache refresh requested");
    }

    @GetMapping("/zoho/items/paged")
    @PreAuthorize("hasAnyAuthority('ADMIN','PACKING','UTL_PACKING')")
    public ResponseEntity<Map<String, Object>> fetchZohoItemsPaged(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "25") int perPage,
            @RequestParam(required = false) String search) {

        normalInventoryUser();

        return ResponseEntity.ok(Map.of(
                "items", zohoItemCacheService.getPageForUI(page, perPage, search),
                "total", zohoItemCacheService.totalCount(search)));
    }

    @GetMapping("/zoho/items/{zohoItemId}")
    @PreAuthorize("hasAnyAuthority('ADMIN','PACKING','UTL_PACKING')")
    public ResponseEntity<ZohoItemDTO> getZohoItemDetails(
            @PathVariable String zohoItemId) {
        normalInventoryUser();
        return ResponseEntity.ok(
                zohoInventoryClient.fetchItemDetails(requireExternalItemId(zohoItemId)));
    }

    @PostMapping("/zoho/items/{zohoItemId}/generate-sticker")
    @PreAuthorize("hasAnyAuthority('ADMIN','PACKING')")
    public ResponseEntity<byte[]> generateZohoSticker(
            @PathVariable String zohoItemId,
            @RequestParam String factoryFloor) throws IOException {

        User user = normalInventoryUser();
        String cleanItemId = requireExternalItemId(zohoItemId);

        byte[] pdf = zohoStickerService.generateStickerForZohoItem(
                cleanItemId,
                factoryFloor,
                user.getUsername());

        return pdfResponse(
                pdf,
                "STICKER_" + cleanItemId.replaceAll("[^a-zA-Z0-9._-]", "_") + ".pdf",
                false);
    }

    @PostMapping("/create")
    @PreAuthorize("hasAnyAuthority('ADMIN','PACKING','UTL_PACKING')")
    public ResponseEntity<?> createItem(
            @RequestBody CreateItemRequest req) {

        User user = normalInventoryUser();
        String plantCode = currentUserService.resolvePlantForWrite(
                user,
                req == null ? null : req.getPlantCode());

        List<PacketItem> items = packetService.createItemWithPackets(
                req,
                user,
                plantCode);

        return ResponseEntity.ok(items.stream().map(PacketItem::getId).toList());
    }

    @GetMapping(value = "/items/search", produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyAuthority('ADMIN','PACKING','UTL_PACKING')")
    public ResponseEntity<Map<String, Object>> searchInventoryItems(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "ALL") String stickerStatus,
            @RequestParam(defaultValue = "NONE") String groupBy) {

        User user = normalInventoryUser();

        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_INVENTORY_PAGE_SIZE);

        Pageable pageable = PageRequest.of(
                safePage,
                safeSize,
                buildInventoryRegisterSort(groupBy));

        PacketService.InventoryPageResult inventoryPage = packetService
                .getVisibleNormalInventoryItemsPaged(
                        user,
                        currentUserService.allowedPlants(user),
                        search,
                        stickerStatus,
                        pageable);

        Page<PacketItemResponse> result = inventoryPage.page();
        Map<String, Object> response = new LinkedHashMap<>();

        response.put("items", result.getContent());
        response.put("total", result.getTotalElements());
        response.put("totalElements", result.getTotalElements());
        response.put("totalPages", result.getTotalPages());
        response.put("page", result.getNumber());
        response.put("pageSize", result.getSize());
        response.put("hasNext", result.hasNext());
        response.put("maxPacketNumbers", inventoryPage.maxPacketNumbers());

        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate")
                .body(response);
    }

    @GetMapping("/items")
    @PreAuthorize("hasAnyAuthority('ADMIN','PACKING','UTL_PACKING')")
    public ResponseEntity<List<PacketItemResponse>> getAllItems() {
        User user = normalInventoryUser();

        return ResponseEntity.ok(
                packetService.getVisibleNormalInventoryItems(
                        user,
                        currentUserService.allowedPlants(user)));
    }

    @PostMapping("/add-more/{masterItemId}")
    @PreAuthorize("hasAnyAuthority('ADMIN','PACKING','UTL_PACKING')")
    public ResponseEntity<?> addMorePackets(
            @PathVariable UUID masterItemId,
            @RequestBody CreateItemRequest req) {

        User user = normalInventoryUser();

        if (req == null || req.getNumberOfPackets() <= 0) {
            throw badRequest("Invalid packet count");
        }

        return ResponseEntity.ok(
                packetService.addPackets(
                        masterItemId,
                        req,
                        user,
                        currentUserService.allowedPlants(user)));
    }

    @PostMapping("/items/{itemId}/generate-sticker")
    @PreAuthorize("hasAnyAuthority('ADMIN','PACKING','UTL_PACKING')")
    public ResponseEntity<byte[]> generateStickerForItem(
            @PathVariable UUID itemId,
            @RequestParam String factoryFloor,
            @RequestParam(defaultValue = "true") boolean showCompanyHeader,
            @RequestParam(required = false) String dispatchMode,
            @RequestParam(required = false) String dispatchTargetUsername,
            @RequestParam(required = false) String dispatchTargetPlantCode) {

        User user = normalInventoryUser();

        byte[] pdf = currentUserService.isUtlPacking(user)
                ? packetService.generateUtlNormalSticker(
                        itemId,
                        factoryFloor,
                        user,
                        currentUserService.allowedPlants(user),
                        dispatchMode,
                        dispatchTargetUsername,
                        dispatchTargetPlantCode)
                : packetService.generateNormalSticker(
                        itemId,
                        factoryFloor,
                        showCompanyHeader,
                        user,
                        currentUserService.allowedPlants(user));

        return pdfResponse(pdf, "STICKER_" + itemId + ".pdf", false);
    }

    @PostMapping("/items/{itemId}/generate-wr38-qr")
    @PreAuthorize("hasAnyAuthority('ADMIN','PACKING','UTL_PACKING')")
    public ResponseEntity<byte[]> generateWr38Qr(
            @PathVariable UUID itemId,
            @RequestParam(required = false) String dispatchMode,
            @RequestParam(required = false) String dispatchTargetUsername,
            @RequestParam(required = false) String dispatchTargetPlantCode) {

        User user = normalInventoryUser();

        byte[] pdf = packetService.generateWr38Qr(
                itemId,
                user,
                currentUserService.allowedPlants(user),
                dispatchMode,
                dispatchTargetUsername,
                dispatchTargetPlantCode);

        return pdfResponse(pdf, "WR38_QR_" + itemId + ".pdf", false);
    }

    @PutMapping("/items/{itemId}")
    @PreAuthorize("hasAnyAuthority('ADMIN','PACKING','UTL_PACKING')")
    public PacketItem updateItem(
            @PathVariable UUID itemId,
            @RequestBody UpdatePacketItemRequest req) {

        User user = normalInventoryUser();

        return packetService.updateNormalPacketItem(
                itemId,
                req,
                user,
                currentUserService.allowedPlants(user));
    }

    @PostMapping("/create-custom")
    @PreAuthorize("hasAnyAuthority('ADMIN','PACKING','UTL_PACKING')")
    public ResponseEntity<?> createCustom(
            @RequestBody CreateItemRequest req) {

        User user = normalInventoryUser();
        String plantCode = currentUserService.resolvePlantForWrite(
                user,
                req == null ? null : req.getPlantCode());

        return ResponseEntity.ok(
                packetService.createCustomPacket(req, user, plantCode));
    }

    @PostMapping("/add-custom/{masterItemId}")
    @PreAuthorize("hasAnyAuthority('ADMIN','PACKING','UTL_PACKING')")
    public ResponseEntity<?> addCustom(
            @PathVariable UUID masterItemId,
            @RequestBody CreateItemRequest req) {

        User user = normalInventoryUser();

        return ResponseEntity.ok(
                packetService.addCustomPacket(
                        masterItemId,
                        req,
                        user,
                        currentUserService.allowedPlants(user)));
    }

    @DeleteMapping("/items/{itemId}")
    @PreAuthorize("hasAnyAuthority('ADMIN','PACKING','UTL_PACKING')")
    public ResponseEntity<Map<String, String>> deleteItem(
            @PathVariable UUID itemId) {

        User user = normalInventoryUser();

        packetService.deleteNormalItem(
                itemId,
                user,
                currentUserService.allowedPlants(user));

        return ResponseEntity.ok(Map.of("message", "Item deleted"));
    }

    @PatchMapping("/items/{itemId}/plant-location")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<?> assignPlantLocation(
            @PathVariable UUID itemId,
            @RequestBody PlantAssignmentRequest req) {

        requireAdmin();

        if (req == null || req.getPlantCode() == null || req.getPlantCode().isBlank()) {
            throw badRequest("Plant code required");
        }

        return ResponseEntity.ok(
                packetService.assignPlantToPacketItem(
                        itemId,
                        req.getPlantCode()));
    }

    @PostMapping("/items/{itemId}/preview-sticker")
    @PreAuthorize("hasAnyAuthority('ADMIN','PACKING','UTL_PACKING')")
    public ResponseEntity<byte[]> previewStickerForItem(
            @PathVariable UUID itemId,
            @RequestParam(required = false) String factoryFloor,
            @RequestParam(defaultValue = "true") boolean showCompanyHeader) {

        User user = normalInventoryUser();

        byte[] pdf = packetService.previewNormalSticker(
                itemId,
                factoryFloor,
                showCompanyHeader,
                user,
                currentUserService.allowedPlants(user));

        return pdfResponse(pdf, "PREVIEW_STICKER_" + itemId + ".pdf", false);
    }

    @PostMapping("/items/{itemId}/preview-wr38-qr")
    @PreAuthorize("hasAnyAuthority('ADMIN','PACKING','UTL_PACKING')")
    public ResponseEntity<byte[]> previewWr38Qr(
            @PathVariable UUID itemId) {

        User user = normalInventoryUser();

        byte[] pdf = packetService.previewWr38Qr(
                itemId,
                user,
                currentUserService.allowedPlants(user));

        return pdfResponse(pdf, "PREVIEW_WR38_QR_" + itemId + ".pdf", false);
    }

    @GetMapping("/utl-dispatch-targets")
    @PreAuthorize("hasAnyAuthority('ADMIN','UTL_PACKING')")
    public ResponseEntity<List<UtlWorkflowService.DispatchTarget>> getUtlDispatchTargets(
            @RequestParam String plantCode) {

        User user = normalInventoryUser();

        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate")
                .body(utlWorkflowService.getEligibleDispatchTargets(user, plantCode));
    }

    @PutMapping("/items/{itemId}/admin-sticker-details")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<?> adminUpdateStickerDetails(
            @PathVariable UUID itemId,
            @RequestBody UpdatePacketItemRequest req) {

        requireAdmin();
        return ResponseEntity.ok(packetService.adminUpdateStickerDetails(itemId, req));
    }

    @PutMapping("/dispatched/{zohoItemId:.+}/admin-packing-date")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<?> adminUpdatePackingDate(
            @PathVariable String zohoItemId,
            @RequestBody(required = false) AdminPackingDateRequest req) {

        User user = requireAdmin();

        if (req == null || req.packingDate() == null || req.packingDate().isBlank()) {
            throw badRequest("Packing date is required");
        }

        return ResponseEntity.ok(
                packetService.adminUpdatePackingDateForDispatchedItem(
                        requireExternalItemId(zohoItemId),
                        req.packingDate(),
                        user.getUsername()));
    }

    private User normalInventoryUser() {
        User user = currentUserService.requireCurrentUser();
        currentUserService.rejectHardwareUserFromNormalInventory(user);
        return user;
    }

    private User requireAdmin() {
        User user = currentUserService.requireCurrentUser();

        if (!currentUserService.isAdmin(user)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only ADMIN can perform this action");
        }

        return user;
    }

    private Sort buildInventoryRegisterSort(String groupBy) {
        String cleanGroup = groupBy == null
                ? "NONE"
                : groupBy.trim().toUpperCase();

        if ("SKU".equals(cleanGroup)) {
            return Sort.by(
                    Sort.Order.asc("sku").ignoreCase(),
                    Sort.Order.asc("itemName").ignoreCase(),
                    Sort.Order.asc("id"));
        }

        return Sort.by(
                Sort.Order.asc("itemName").ignoreCase(),
                Sort.Order.asc("packetNumber"),
                Sort.Order.asc("id"));
    }

    private ResponseEntity<byte[]> pdfResponse(
            byte[] pdf,
            String filename,
            boolean download) {

        if (pdf == null || pdf.length == 0) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Sticker PDF could not be generated");
        }

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        (download ? "attachment" : "inline")
                                + "; filename=\"" + filename + "\"")
                .header(
                        HttpHeaders.CACHE_CONTROL,
                        "no-store, no-cache, must-revalidate, max-age=0")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    private String requireExternalItemId(String value) {
        if (value == null || value.trim().isBlank()) {
            throw badRequest("Item id is required");
        }

        String clean = value.trim();

        if (clean.length() > 300) {
            throw badRequest("Item id is too long");
        }

        return clean;
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    public record AdminPackingDateRequest(
            String packingDate) {
    }
}
