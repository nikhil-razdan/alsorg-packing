package com.alsorg.packing.controller;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.data.domain.*;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.controller.dto.*;
import com.alsorg.packing.domain.common.PacketStatus;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.domain.packet.Packet;
import com.alsorg.packing.integration.zoho.ZohoInventoryClient;
import com.alsorg.packing.integration.zoho.dto.ZohoItemDTO;
import com.alsorg.packing.service.PacketService;
import com.alsorg.packing.service.ZohoItemCacheService;

@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/api/packets")
public class PacketController {

	private final PacketService packetService;
	private final ZohoInventoryClient zohoInventoryClient;
	private final ZohoItemCacheService zohoItemCacheService;

	public PacketController(PacketService packetService, ZohoInventoryClient zohoInventoryClient,
			ZohoItemCacheService zohoItemCacheService) {
		this.packetService = packetService;
		this.zohoInventoryClient = zohoInventoryClient;
		this.zohoItemCacheService = zohoItemCacheService;
	}

	@PostMapping
	public ResponseEntity<PacketCreateResponse> createPacket(@RequestBody PacketCreateRequest request)
			throws IOException {

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

		Packet packet = packetService.createPacket(request.getCompanyId(), request.getCreatedBy(), items);

		return ResponseEntity
				.ok(new PacketCreateResponse(packet.getId(), packet.getStickerNumber(), packet.getStatus().name()));
	}

	@GetMapping
	public Page<PacketListResponse> getAllPackets(@RequestParam(required = false) UUID companyId,
			@RequestParam(required = false) PacketStatus status, @RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "10") int size, @RequestParam(defaultValue = "createdAt") String sortBy,
			@RequestParam(defaultValue = "desc") String direction) {

		Sort sort = direction.equalsIgnoreCase("asc") ? Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();

		Pageable pageable = PageRequest.of(page, size, sort);

		return packetService.getPackets(companyId, status, pageable).map(packet -> {
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

	@GetMapping("/zoho/sync")
	public ResponseEntity<String> syncZohoItems() {
		List<ZohoItemDTO> items = zohoInventoryClient.fetchAllItems();
		zohoItemCacheService.load(items);
		return ResponseEntity.ok("Zoho cache loaded: " + items.size());
	}

	@GetMapping("/zoho/items/paged")
	public ResponseEntity<Map<String, Object>> fetchZohoItemsPaged(@RequestParam int page, @RequestParam int perPage) {
		return ResponseEntity.ok(Map.of("items", zohoItemCacheService.getPageForUI(page, perPage), "total",
				zohoItemCacheService.totalCount()));
	}

	// -----------------------------
	// STICKER GENERATION
	// -----------------------------

	@PostMapping("/zoho/items/{zohoItemId}/generate-sticker")
	public ResponseEntity<Void> generateSticker(@PathVariable String zohoItemId) throws IOException {
		System.out.println(">>> GENERATE STICKER CONTROLLER HIT: " + zohoItemId);
		packetService.generateStickerForItem(zohoItemId);
		return ResponseEntity.ok().build();
	}
	
	@GetMapping("/zoho/items/{zohoItemId}")
	public ResponseEntity<ZohoItemDTO> getZohoItemDetails(
	        @PathVariable String zohoItemId
	) {
	    return ResponseEntity.ok(
	        zohoInventoryClient.fetchItemDetails(zohoItemId)
	    );
	}
}
