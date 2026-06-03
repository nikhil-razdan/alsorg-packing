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
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

@RestController
@RequestMapping("/api/packets")
public class PacketController {

    private final ZohoStickerService zohoStickerService;
    private final PacketService packetService;
    private final ZohoInventoryClient zohoInventoryClient;
    private final ZohoItemCacheService zohoItemCacheService;
    private final PacketItemRepository packetItemRepository;

    public PacketController(
            PacketService packetService,
            ZohoInventoryClient zohoInventoryClient,
            ZohoItemCacheService zohoItemCacheService,
            ZohoStickerService zohoStickerService,
            PacketItemRepository packetItemRepository
    ) {
        this.packetService = packetService;
        this.zohoInventoryClient = zohoInventoryClient;
        this.zohoItemCacheService = zohoItemCacheService;
        this.zohoStickerService = zohoStickerService;
        this.packetItemRepository = packetItemRepository;
    }

    // =====================================================
    // PACKETS
    // =====================================================

    @PostMapping
    public ResponseEntity<PacketCreateResponse> createPacket(
            @RequestBody PacketCreateRequest request
    ) {

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
                items
        );

        return ResponseEntity.ok(
                new PacketCreateResponse(
                        packet.getId(),
                        packet.getStickerNumber(),
                        packet.getStatus().name()
                )
        );
    }

    @GetMapping
    public Page<PacketListResponse> getAllPackets(
            @RequestParam(required = false) UUID companyId,
            @RequestParam(required = false) PacketStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String direction
    ) {

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
    	                "items", zohoItemCacheService.getPageForUI(page, perPage, search), // 🔥 PASS SEARCH
    	                "total", zohoItemCacheService.totalCount(search) // 🔥 FILTERED COUNT
    	        )
    	);
    }

    @GetMapping("/zoho/items/{zohoItemId}")
    public ResponseEntity<ZohoItemDTO> getZohoItemDetails(
            @PathVariable String zohoItemId
    ) {
        return ResponseEntity.ok(
                zohoInventoryClient.fetchItemDetails(zohoItemId)
        );
    }

    // =====================================================
    // STICKER GENERATION (FINAL FIX)
    // =====================================================

    @PostMapping("/zoho/items/{zohoItemId}/generate-sticker")
    public ResponseEntity<byte[]> generateSticker(@PathVariable String zohoItemId, @RequestParam String factoryFloor )
            throws IOException {

        byte[] pdf = zohoStickerService.generateStickerForZohoItem(zohoItemId, factoryFloor);
        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=STICKER_" + zohoItemId + ".pdf"
                )
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
    
    @PostMapping("/create")
    public ResponseEntity<?> createItem(@RequestBody CreateItemRequest req) {

        List<PacketItem> items = packetService.createItemWithPackets(req);

        return ResponseEntity.ok(
                items.stream().map(PacketItem::getId).toList()
        );
    }
    
    @GetMapping("/items")
    public List<PacketItemResponse> getAllItems() {

        return packetItemRepository.findAll()
                .stream()
                .filter(item ->
                        "CREATED".equals(item.getStatus()) ||
                        "RESTORED".equals(item.getStatus())
                )
                .map(item -> {
                    PacketItemResponse dto = new PacketItemResponse();

                    dto.setItemId(item.getId());
                    dto.setItemName(item.getItemName());
                    dto.setSku(item.getSku());
                    dto.setLocation(item.getLocation());
                    dto.setFloor(item.getFloor());
                    dto.setPdNo(item.getPdNo());
                    dto.setDrawingNo(item.getDrawingNo());
                    dto.setClientName(item.getClientName());
                    dto.setClientAddress(item.getClientAddress());
                    dto.setQuantity(
                            item.getQuantity() != null ? item.getQuantity() : 1
                    );
                    dto.setDescription(item.getDescription());
                    dto.setDimensions(item.getDimensions());
                    dto.setWeight(item.getWeight());
                    dto.setRemarks(item.getRemarks());
                    dto.setStickerNumber(item.getStickerNumber());

                    if (item.getMasterItem() != null) {
                        dto.setMasterItemId(item.getMasterItem().getId());
                        dto.setTotalPackets(item.getMasterItem().getTotalPackets());
                    }

                    return dto;
                })
                .toList();
    }
    
    @PostMapping("/add-more/{masterItemId}")
    public ResponseEntity<?> addMorePackets(
            @PathVariable UUID masterItemId,
            @RequestBody CreateItemRequest req
    ) {

    	if (req.getNumberOfPackets() <= 0) {
    	    throw new RuntimeException("Invalid packet count");
    	}
        return ResponseEntity.ok(
            packetService.addPackets(masterItemId, req)
        );
    }
    
    @PostMapping("/items/{itemId}/generate-sticker")
    public ResponseEntity<byte[]> generateStickerForItem(
            @PathVariable UUID itemId,
            @RequestParam String factoryFloor,
            @RequestParam(defaultValue = "true") boolean showCompanyHeader
    ) {

        String generatedBy = currentUsernameOrSystem();

        byte[] pdf = packetService.generateStickerForPacketItem(
                itemId,
                factoryFloor,
                showCompanyHeader,
                generatedBy
        );

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=STICKER_" + itemId + ".pdf"
                )
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
    
    @PutMapping("/items/{itemId}")
    public PacketItem updateItem(
            @PathVariable UUID itemId,
            @RequestBody UpdatePacketItemRequest req
    ) {

        return packetService.updatePacketItem(itemId, req);
    }
    
    @PostMapping("/create-custom")
    public ResponseEntity<?> createCustom(@RequestBody CreateItemRequest req) {
        return ResponseEntity.ok(packetService.createCustomPacket(req));
    }

    @PostMapping("/add-custom/{masterItemId}")
    public ResponseEntity<?> addCustom(
            @PathVariable UUID masterItemId,
            @RequestBody CreateItemRequest req
    ) {
        return ResponseEntity.ok(
                packetService.addCustomPacket(masterItemId, req)
        );
    }
    
    @DeleteMapping("/items/{itemId}")
    public ResponseEntity<?> deleteItem(@PathVariable UUID itemId) {

        packetService.deleteItem(itemId);
        return ResponseEntity.ok("Item deleted");
    }
    
    private String currentUsernameOrSystem() {

        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null) {
            return "SYSTEM";
        }

        String username = authentication.getName();

        if (username == null
                || username.isBlank()
                || "anonymousUser".equalsIgnoreCase(username)) {
            return "SYSTEM";
        }

        return username;
    }
}
