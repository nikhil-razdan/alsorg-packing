package com.alsorg.packing.controller;

import static com.alsorg.packing.controller.dto.hardware.HardwarePacketDtos.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.HardwarePacketService;

@RestController
@RequestMapping("/api/hardware-packets")
public class HardwarePacketController {

    private final HardwarePacketService hardwarePacketService;
    private final CurrentUserService currentUserService;

    public HardwarePacketController(
            HardwarePacketService hardwarePacketService,
            CurrentUserService currentUserService) {
        this.hardwarePacketService = hardwarePacketService;
        this.currentUserService = currentUserService;
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ADMIN', 'HARDWARE_PACKING')")
    public ResponseEntity<List<HardwarePacketResponse>> create(
            @RequestBody HardwarePacketCreateRequest request) {
        User user = currentUserService.requireCurrentUser();
        return ResponseEntity.ok(
                hardwarePacketService.createPackets(request, user));
    }

    @PostMapping("/masters/{masterItemId}/packets")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'HARDWARE_PACKING')")
    public ResponseEntity<List<HardwarePacketResponse>> addPackets(
            @PathVariable UUID masterItemId,
            @RequestBody HardwarePacketAddRequest request) {
        User user = currentUserService.requireCurrentUser();
        return ResponseEntity.ok(
                hardwarePacketService.addPackets(masterItemId, request, user));
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ADMIN', 'DISPATCH', 'HARDWARE_PACKING')")
    public List<HardwarePacketResponse> getVisiblePackets() {
        User user = currentUserService.requireCurrentUser();
        return hardwarePacketService.getVisiblePackets(user);
    }

    @PutMapping("/{itemId}")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'HARDWARE_PACKING')")
    public HardwarePacketResponse update(
            @PathVariable UUID itemId,
            @RequestBody HardwarePacketUpdateRequest request) {
        User user = currentUserService.requireCurrentUser();
        return hardwarePacketService.updatePacket(itemId, request, user);
    }

    @DeleteMapping("/{itemId}")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'HARDWARE_PACKING')")
    public ResponseEntity<Map<String, String>> delete(
            @PathVariable UUID itemId) {
        User user = currentUserService.requireCurrentUser();
        hardwarePacketService.deletePacket(itemId, user);
        return ResponseEntity.ok(Map.of("message", "Hardware packet deleted"));
    }

    @PostMapping("/{itemId}/preview-sticker")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'DISPATCH', 'HARDWARE_PACKING')")
    public ResponseEntity<byte[]> previewSticker(
            @PathVariable UUID itemId,
            @RequestParam(required = false) String factoryFloor,
            @RequestParam(defaultValue = "true") boolean showCompanyHeader) {
        User user = currentUserService.requireCurrentUser();
        byte[] pdf = hardwarePacketService.previewSticker(
                itemId,
                factoryFloor,
                showCompanyHeader,
                user);
        return pdfResponse(pdf, "HARDWARE_PREVIEW_" + itemId + ".pdf", false);
    }

    @PostMapping("/{itemId}/generate-sticker")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'HARDWARE_PACKING')")
    public ResponseEntity<byte[]> generateSticker(
            @PathVariable UUID itemId,
            @RequestParam(required = false) String factoryFloor,
            @RequestParam(defaultValue = "true") boolean showCompanyHeader) {
        User user = currentUserService.requireCurrentUser();
        byte[] pdf = hardwarePacketService.generateSticker(
                itemId,
                factoryFloor,
                showCompanyHeader,
                user);
        return pdfResponse(pdf, "HARDWARE_STICKER_" + itemId + ".pdf", false);
    }

    @GetMapping({"/{itemId}/latest-sticker", "/{itemId}/sticker"})
    @PreAuthorize("hasAnyAuthority('ADMIN', 'DISPATCH', 'HARDWARE_PACKING')")
    public ResponseEntity<byte[]> getLatestSticker(
            @PathVariable UUID itemId,
            @RequestParam(defaultValue = "false") boolean download) {
        User user = currentUserService.requireCurrentUser();
        byte[] pdf = hardwarePacketService.getLatestSticker(itemId, user);
        return pdfResponse(pdf, "HARDWARE_STICKER_" + itemId + ".pdf", download);
    }

    private ResponseEntity<byte[]> pdfResponse(
            byte[] pdf,
            String filename,
            boolean download) {

        if (pdf == null || pdf.length == 0) {
            throw new IllegalStateException("Sticker PDF could not be generated");
        }

        String safeFilename = filename.replaceAll("[^a-zA-Z0-9._-]", "_");
        String disposition = download ? "attachment" : "inline";

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        disposition + "; filename=\"" + safeFilename + "\"")
                .header(
                        HttpHeaders.CACHE_CONTROL,
                        "no-store, no-cache, must-revalidate, max-age=0")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}
