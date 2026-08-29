package com.alsorg.packing.controller;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import com.alsorg.packing.controller.dto.CreateItemRequest;
import com.alsorg.packing.controller.dto.PacketItemResponse;
import com.alsorg.packing.controller.dto.UpdatePacketItemRequest;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.PacketService;
import com.alsorg.packing.service.UtlWorkflowService;

/**
 * Strict UTL packing boundary.
 *
 * Why this controller is separate:
 * - the ordinary /api/packets controller remains unchanged for ADMIN/PACKING;
 * - UTL_PACKING never needs to be promoted to PACKING authority;
 * - every UTL write/read stays owner-scoped through PacketService;
 * - the account's single assigned plant (AL-P3 or WR-38) is authoritative;
 * - the final sticker/QR must be routed to one eligible dispatch identity in
 *   the same UTL plant before generation.
 */
@RestController
@RequestMapping("/api/utl/packets")
@PreAuthorize("isAuthenticated() and hasAuthority('UTL_PACKING')")
public class UtlPacketController {

    private static final int MAX_INVENTORY_PAGE_SIZE = 100;
    private static final Set<String> UTL_PLANTS = Set.of("AL-P3", "WR-38");
    private final PacketService packetService;
    private final CurrentUserService currentUserService;
    private final UtlWorkflowService utlWorkflowService;

    public UtlPacketController(
            PacketService packetService,
            CurrentUserService currentUserService,
            UtlWorkflowService utlWorkflowService) {
        this.packetService = packetService;
        this.currentUserService = currentUserService;
        this.utlWorkflowService = utlWorkflowService;
    }

    @GetMapping(value = "/items/search", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> searchInventoryItems(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "ALL") String stickerStatus,
            @RequestParam(defaultValue = "NONE") String groupBy) {

        User user = requireUtlPackingUser();
        Set<String> plants = requireSingleUtlPlant(user);

        int safePage = Math.max(0, page);
        int safeSize = Math.min(
                MAX_INVENTORY_PAGE_SIZE,
                Math.max(1, size));

        Pageable pageable = PageRequest.of(
                safePage,
                safeSize,
                buildInventorySort(groupBy));

        PacketService.InventoryPageResult inventoryPage =
                packetService.getVisibleNormalInventoryItemsPaged(
                        user,
                        plants,
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
        response.put("utl", true);
        response.put("plantCode", plants.iterator().next());

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(response);
    }

    @GetMapping("/items")
    public ResponseEntity<List<PacketItemResponse>> getAllItems() {
        User user = requireUtlPackingUser();
        Set<String> plants = requireSingleUtlPlant(user);

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(
                        packetService.getVisibleNormalInventoryItems(
                                user,
                                plants));
    }

    @PostMapping("/create")
    public ResponseEntity<List<UUID>> createItem(
            @RequestBody CreateItemRequest request) {

        User user = requireUtlPackingUser();
        String plantCode = requireSingleUtlPlant(user)
                .iterator()
                .next();

        assertRequestedPlantMatchesUtlIdentity(
                request == null ? null : request.getPlantCode(),
                plantCode);

        List<PacketItem> items = packetService.createItemWithPackets(
                request,
                user,
                plantCode);

        return ResponseEntity.ok(
                items.stream()
                        .map(PacketItem::getId)
                        .toList());
    }

    @PostMapping("/create-custom")
    public ResponseEntity<PacketItem> createCustom(
            @RequestBody CreateItemRequest request) {

        User user = requireUtlPackingUser();
        String plantCode = requireSingleUtlPlant(user)
                .iterator()
                .next();

        assertRequestedPlantMatchesUtlIdentity(
                request == null ? null : request.getPlantCode(),
                plantCode);

        return ResponseEntity.ok(
                packetService.createCustomPacket(
                        request,
                        user,
                        plantCode));
    }

    @PostMapping("/add-more/{masterItemId}")
    public ResponseEntity<List<PacketItem>> addPackets(
            @PathVariable UUID masterItemId,
            @RequestBody CreateItemRequest request) {

        User user = requireUtlPackingUser();
        Set<String> plants = requireSingleUtlPlant(user);

        return ResponseEntity.ok(
                packetService.addPackets(
                        masterItemId,
                        request,
                        user,
                        plants));
    }

    @PostMapping("/add-custom/{masterItemId}")
    public ResponseEntity<PacketItem> addCustom(
            @PathVariable UUID masterItemId,
            @RequestBody CreateItemRequest request) {

        User user = requireUtlPackingUser();
        Set<String> plants = requireSingleUtlPlant(user);

        return ResponseEntity.ok(
                packetService.addCustomPacket(
                        masterItemId,
                        request,
                        user,
                        plants));
    }

    @PutMapping("/items/{itemId}")
    public PacketItem updateItem(
            @PathVariable UUID itemId,
            @RequestBody UpdatePacketItemRequest request) {

        User user = requireUtlPackingUser();

        return packetService.updateNormalPacketItem(
                itemId,
                request,
                user,
                requireSingleUtlPlant(user));
    }

    @DeleteMapping("/items/{itemId}")
    public ResponseEntity<Map<String, String>> deleteItem(
            @PathVariable UUID itemId) {

        User user = requireUtlPackingUser();

        packetService.deleteNormalItem(
                itemId,
                user,
                requireSingleUtlPlant(user));

        return ResponseEntity.ok(
                Map.of("message", "UTL packet item deleted"));
    }

    @GetMapping("/dispatch-targets")
    public ResponseEntity<List<UtlWorkflowService.DispatchTarget>> dispatchTargets() {
        User user = requireUtlPackingUser();
        String plantCode = requireSingleUtlPlant(user)
                .iterator()
                .next();

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(utlWorkflowService.getEligibleDispatchTargets(
                        user,
                        plantCode));
    }

    @PostMapping("/items/{itemId}/preview-sticker")
    public ResponseEntity<byte[]> previewSticker(
            @PathVariable UUID itemId,
            @RequestParam(defaultValue = "") String factoryFloor) {

        User user = requireUtlPackingUser();

        byte[] pdf = packetService.previewNormalSticker(
                itemId,
                factoryFloor,
                false,
                user,
                requireSingleUtlPlant(user));

        return pdfResponse(
                pdf,
                "UTL_STICKER_PREVIEW_" + itemId + ".pdf",
                true);
    }

    @PostMapping("/items/{itemId}/preview-wr38-qr")
    public ResponseEntity<byte[]> previewWr38Qr(
            @PathVariable UUID itemId) {

        User user = requireUtlPackingUser();
        requirePlant(user, "WR-38");

        byte[] pdf = packetService.previewWr38Qr(
                itemId,
                user,
                requireSingleUtlPlant(user));

        return pdfResponse(
                pdf,
                "UTL_WR38_QR_PREVIEW_" + itemId + ".pdf",
                true);
    }

    @PostMapping("/items/{itemId}/generate-sticker")
    public ResponseEntity<byte[]> generateSticker(
            @PathVariable UUID itemId,
            @RequestParam(defaultValue = "") String factoryFloor,
            @RequestParam String dispatchMode,
            @RequestParam String dispatchTargetUsername,
            @RequestParam(required = false) String dispatchTargetPlantCode) {

        User user = requireUtlPackingUser();
        String sourcePlant = requireSingleUtlPlant(user)
                .iterator()
                .next();

        if ("WR-38".equals(sourcePlant)) {
            throw badRequest(
                    "WR-38 UTL packets use the QR-only generation endpoint");
        }

        UtlWorkflowService.DispatchTarget selected = validateRoutingTarget(
                user,
                dispatchMode,
                dispatchTargetUsername,
                dispatchTargetPlantCode,
                sourcePlant);

        byte[] pdf = packetService.generateUtlNormalSticker(
                itemId,
                factoryFloor,
                user,
                Set.of(sourcePlant),
                selected.dispatchMode(),
                selected.username(),
                selected.plantCode());

        return pdfResponse(
                pdf,
                "UTL_STICKER_" + itemId + ".pdf",
                false);
    }

    @PostMapping("/items/{itemId}/generate-wr38-qr")
    public ResponseEntity<byte[]> generateWr38Qr(
            @PathVariable UUID itemId,
            @RequestParam String dispatchMode,
            @RequestParam String dispatchTargetUsername,
            @RequestParam(required = false) String dispatchTargetPlantCode) {

        User user = requireUtlPackingUser();
        requirePlant(user, "WR-38");

        UtlWorkflowService.DispatchTarget selected = validateRoutingTarget(
                user,
                dispatchMode,
                dispatchTargetUsername,
                dispatchTargetPlantCode,
                "WR-38");

        byte[] pdf = packetService.generateWr38Qr(
                itemId,
                user,
                Set.of("WR-38"),
                selected.dispatchMode(),
                selected.username(),
                selected.plantCode());

        return pdfResponse(
                pdf,
                "UTL_WR38_QR_" + itemId + ".pdf",
                false);
    }

    private UtlWorkflowService.DispatchTarget validateRoutingTarget(
            User packingUser,
            String dispatchMode,
            String dispatchTargetUsername,
            String dispatchTargetPlantCode,
            String sourcePlant) {

        String cleanMode = normalizeCode(dispatchMode);
        String cleanTargetUsername = clean(dispatchTargetUsername);
        String requestedTargetPlant = normalizeCode(dispatchTargetPlantCode);

        if (!UtlWorkflowService.MODE_UTL.equals(cleanMode)
                && !UtlWorkflowService.MODE_INTERNAL.equals(cleanMode)) {
            throw badRequest(
                    "Select UTL Dispatch or normal same-plant Dispatch before final sticker / QR generation");
        }

        if (cleanTargetUsername == null) {
            throw badRequest(
                    "Select a dispatch user before final sticker / QR generation");
        }

        String finalTargetPlant = requestedTargetPlant == null
                ? sourcePlant
                : requestedTargetPlant;

        if (!sourcePlant.equals(finalTargetPlant)) {
            throw new AccessDeniedException(
                    "UTL packets can be routed only within their source plant: "
                            + sourcePlant);
        }

        return utlWorkflowService.getEligibleDispatchTargets(
                        packingUser,
                        sourcePlant)
                .stream()
                .filter(target -> cleanMode.equals(target.dispatchMode()))
                .filter(target -> sourcePlant.equalsIgnoreCase(target.plantCode()))
                .filter(target -> cleanTargetUsername.equalsIgnoreCase(target.username()))
                .findFirst()
                .orElseThrow(() -> new AccessDeniedException(
                        "Selected dispatch user is not eligible for this UTL packet"));
    }

    private User requireUtlPackingUser() {
        User user = currentUserService.requireCurrentUser();

        if (!currentUserService.isUtlPacking(user)) {
            throw new AccessDeniedException(
                    "UTL_PACKING access required");
        }

        requireSingleUtlPlant(user);
        return user;
    }

    private Set<String> requireSingleUtlPlant(User user) {
        Set<String> plants = currentUserService.allowedPlants(user);

        if (plants == null || plants.size() != 1) {
            throw new AccessDeniedException(
                    "UTL identity must have exactly one plant");
        }

        String plantCode = normalizeCode(
                plants.iterator().next());

        if (plantCode == null || !UTL_PLANTS.contains(plantCode)) {
            throw new AccessDeniedException(
                    "UTL identity can operate only in AL-P3 or WR-38");
        }

        return Set.of(plantCode);
    }

    private void requirePlant(
            User user,
            String expectedPlant) {
        String actualPlant = requireSingleUtlPlant(user)
                .iterator()
                .next();

        if (!expectedPlant.equals(actualPlant)) {
            throw new AccessDeniedException(
                    "This endpoint is restricted to "
                            + expectedPlant);
        }
    }

    private void assertRequestedPlantMatchesUtlIdentity(
            String requestedPlant,
            String assignedPlant) {
        String cleanRequested = normalizeCode(requestedPlant);

        if (cleanRequested != null
                && !assignedPlant.equals(cleanRequested)) {
            throw new AccessDeniedException(
                    "UTL users cannot create data for another plant");
        }
    }

    private Sort buildInventorySort(String groupBy) {
        String cleanGroup = normalizeCode(groupBy);

        if ("MASTER".equals(cleanGroup)
                || "MASTER_ITEM".equals(cleanGroup)) {
            return Sort.by(
                    Sort.Order.asc("itemName").ignoreCase(),
                    Sort.Order.asc("packetNumber").ignoreCase(),
                    Sort.Order.asc("id"));
        }

        return Sort.by(
                Sort.Order.desc("packedAt"),
                Sort.Order.asc("id"));
    }

    private ResponseEntity<byte[]> pdfResponse(
            byte[] pdf,
            String filename,
            boolean inline) {

        ContentDisposition disposition = inline
                ? ContentDisposition.inline()
                        .filename(filename)
                        .build()
                : ContentDisposition.attachment()
                        .filename(filename)
                        .build();

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .cacheControl(CacheControl.noStore())
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        disposition.toString())
                .body(pdf);
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                message);
    }

    private String normalizeCode(String value) {
        String clean = clean(value);
        return clean == null
                ? null
                : clean.toUpperCase(Locale.ROOT);
    }

    private String clean(String value) {
        if (value == null) {
            return null;
        }

        String clean = value.trim();
        return clean.isBlank()
                ? null
                : clean;
    }
}
