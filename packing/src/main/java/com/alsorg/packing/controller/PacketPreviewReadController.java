package com.alsorg.packing.controller;

import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.PacketService;

/**
 * Read-only GET aliases for normal/UTL packet sticker and WR-38 QR previews.
 *
 * Why this is additive instead of replacing the existing controllers:
 * - existing POST preview routes remain available for older clients;
 * - final sticker/QR generation routes remain POST and CSRF protected;
 * - PacketService preview methods are already @Transactional(readOnly = true);
 * - the same user/role/plant/UTL ownership checks are preserved here;
 * - no packet, sticker sequence, routing, dispatch or warehouse state is changed.
 */
@RestController
public class PacketPreviewReadController {

    private static final Set<String> UTL_PLANTS = Set.of("AL-P3", "WR-38");

    private final PacketService packetService;
    private final CurrentUserService currentUserService;

    public PacketPreviewReadController(
            PacketService packetService,
            CurrentUserService currentUserService) {
        this.packetService = packetService;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/api/packets/items/{itemId}/preview-sticker")
    @PreAuthorize("isAuthenticated() and hasAnyAuthority('ADMIN','PACKING')")
    public ResponseEntity<byte[]> previewNormalSticker(
            @PathVariable UUID itemId,
            @RequestParam(required = false) String factoryFloor,
            @RequestParam(defaultValue = "true") boolean showCompanyHeader) {

        User user = requireNormalInventoryUser();

        byte[] pdf = packetService.previewNormalSticker(
                itemId,
                factoryFloor,
                showCompanyHeader,
                user,
                currentUserService.allowedPlants(user));

        return inlinePdf(
                pdf,
                "PREVIEW_STICKER_" + itemId + ".pdf");
    }

    @GetMapping("/api/packets/items/{itemId}/preview-wr38-qr")
    @PreAuthorize("isAuthenticated() and hasAnyAuthority('ADMIN','PACKING')")
    public ResponseEntity<byte[]> previewNormalWr38Qr(
            @PathVariable UUID itemId) {

        User user = requireNormalInventoryUser();

        byte[] pdf = packetService.previewWr38Qr(
                itemId,
                user,
                currentUserService.allowedPlants(user));

        return inlinePdf(
                pdf,
                "PREVIEW_WR38_QR_" + itemId + ".pdf");
    }

    @GetMapping("/api/utl/packets/items/{itemId}/preview-sticker")
    @PreAuthorize("isAuthenticated() and hasAuthority('UTL_PACKING')")
    public ResponseEntity<byte[]> previewUtlSticker(
            @PathVariable UUID itemId,
            @RequestParam(defaultValue = "") String factoryFloor) {

        User user = requireUtlPackingUser();
        Set<String> plants = requireSingleUtlPlant(user);

        byte[] pdf = packetService.previewNormalSticker(
                itemId,
                factoryFloor,
                false,
                user,
                plants);

        return inlinePdf(
                pdf,
                "UTL_STICKER_PREVIEW_" + itemId + ".pdf");
    }

    @GetMapping("/api/utl/packets/items/{itemId}/preview-wr38-qr")
    @PreAuthorize("isAuthenticated() and hasAuthority('UTL_PACKING')")
    public ResponseEntity<byte[]> previewUtlWr38Qr(
            @PathVariable UUID itemId) {

        User user = requireUtlPackingUser();
        Set<String> plants = requireSingleUtlPlant(user);

        String plant = plants.iterator().next();

        if (!"WR-38".equals(plant)) {
            throw new AccessDeniedException(
                    "This endpoint is restricted to WR-38");
        }

        byte[] pdf = packetService.previewWr38Qr(
                itemId,
                user,
                plants);

        return inlinePdf(
                pdf,
                "UTL_WR38_QR_PREVIEW_" + itemId + ".pdf");
    }

    private User requireNormalInventoryUser() {
        User user = currentUserService.requireCurrentUser();
        currentUserService.rejectHardwareUserFromNormalInventory(user);
        return user;
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

        String plantCode = normalizePlant(
                plants.iterator().next());

        if (plantCode == null || !UTL_PLANTS.contains(plantCode)) {
            throw new AccessDeniedException(
                    "UTL identity can operate only in AL-P3 or WR-38");
        }

        return Set.of(plantCode);
    }

    private String normalizePlant(String value) {
        if (value == null) {
            return null;
        }

        String clean = value.trim().toUpperCase(Locale.ROOT);
        return clean.isBlank() ? null : clean;
    }

    private ResponseEntity<byte[]> inlinePdf(
            byte[] pdf,
            String filename) {

        if (pdf == null || pdf.length == 0) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Sticker PDF could not be generated");
        }

        ContentDisposition disposition = ContentDisposition
                .inline()
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
}
