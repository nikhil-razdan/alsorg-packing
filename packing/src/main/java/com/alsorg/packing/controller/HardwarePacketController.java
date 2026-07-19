package com.alsorg.packing.controller;

import static com.alsorg.packing.controller.dto.hardware.HardwarePacketDtos.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

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
            CurrentUserService currentUserService
    ) {
        this.hardwarePacketService = hardwarePacketService;
        this.currentUserService = currentUserService;
    }

    /*
     * Create a completely new hardware master with
     * Packet 1, Packet 2, Packet 3, etc.
     */
    @PostMapping
    @PreAuthorize(
            "hasAnyAuthority('ADMIN', 'HARDWARE_PACKING')"
    )
    public ResponseEntity<List<HardwarePacketResponse>> create(
            @RequestBody HardwarePacketCreateRequest request,
            @RequestHeader(
                    value = "Authorization",
                    required = false
            ) String auth
    ) {
        User user =
                currentUserService.getCurrentUserFromAuth(auth);

        return ResponseEntity.ok(
                hardwarePacketService.createPackets(
                        request,
                        user
                )
        );
    }

    /*
     * Add Packet 2, Packet 3, etc. to an existing
     * hardware MasterItem.
     *
     * Master information is not supplied again.
     */
    @PostMapping("/masters/{masterItemId}/packets")
    @PreAuthorize(
            "hasAnyAuthority('ADMIN', 'HARDWARE_PACKING')"
    )
    public ResponseEntity<List<HardwarePacketResponse>> addPackets(
            @PathVariable UUID masterItemId,
            @RequestBody HardwarePacketAddRequest request,
            @RequestHeader(
                    value = "Authorization",
                    required = false
            ) String auth
    ) {
        User user =
                currentUserService.getCurrentUserFromAuth(auth);

        return ResponseEntity.ok(
                hardwarePacketService.addPackets(
                        masterItemId,
                        request,
                        user
                )
        );
    }

    /*
     * Read access:
     *
     * ADMIN:
     * - all hardware packets
     *
     * DISPATCH:
     * - hardware packets from assigned plants
     *
     * HARDWARE_PACKING:
     * - own hardware packets only
     */
    @GetMapping
    @PreAuthorize(
            "hasAnyAuthority('ADMIN', 'DISPATCH', 'HARDWARE_PACKING')"
    )
    public List<HardwarePacketResponse> getVisiblePackets(
            @RequestHeader(
                    value = "Authorization",
                    required = false
            ) String auth
    ) {
        User user =
                currentUserService.getCurrentUserFromAuth(auth);

        return hardwarePacketService.getVisiblePackets(user);
    }

    @PutMapping("/{itemId}")
    @PreAuthorize(
            "hasAnyAuthority('ADMIN', 'HARDWARE_PACKING')"
    )
    public HardwarePacketResponse update(
            @PathVariable UUID itemId,
            @RequestBody HardwarePacketUpdateRequest request,
            @RequestHeader(
                    value = "Authorization",
                    required = false
            ) String auth
    ) {
        User user =
                currentUserService.getCurrentUserFromAuth(auth);

        return hardwarePacketService.updatePacket(
                itemId,
                request,
                user
        );
    }

    @DeleteMapping("/{itemId}")
    @PreAuthorize(
            "hasAnyAuthority('ADMIN', 'HARDWARE_PACKING')"
    )
    public ResponseEntity<?> delete(
            @PathVariable UUID itemId,
            @RequestHeader(
                    value = "Authorization",
                    required = false
            ) String auth
    ) {
        User user =
                currentUserService.getCurrentUserFromAuth(auth);

        hardwarePacketService.deletePacket(
                itemId,
                user
        );

        return ResponseEntity.ok(
                Map.of(
                        "message",
                        "Hardware packet deleted"
                )
        );
    }

    /*
     * ADMIN, DISPATCH and the owner can preview.
     *
     * Previewing does not change the database.
     */
    @PostMapping("/{itemId}/preview-sticker")
    @PreAuthorize(
            "hasAnyAuthority('ADMIN', 'DISPATCH', 'HARDWARE_PACKING')"
    )
    public ResponseEntity<byte[]> previewSticker(
            @PathVariable UUID itemId,
            @RequestParam(required = false) String factoryFloor,
            @RequestParam(defaultValue = "true") boolean showCompanyHeader,
            @RequestHeader(
                    value = "Authorization",
                    required = false
            ) String auth
    ) {
        User user =
                currentUserService.getCurrentUserFromAuth(auth);

        byte[] pdf =
                hardwarePacketService.previewSticker(
                        itemId,
                        factoryFloor,
                        showCompanyHeader,
                        user
                );

        return pdfResponse(
                pdf,
                "HARDWARE_PREVIEW_" + itemId + ".pdf",
                false
        );
    }

    /*
     * DISPATCH must not generate or reprint hardware stickers.
     */
    @PostMapping("/{itemId}/generate-sticker")
    @PreAuthorize(
            "hasAnyAuthority('ADMIN', 'HARDWARE_PACKING')"
    )
    public ResponseEntity<byte[]> generateSticker(
            @PathVariable UUID itemId,
            @RequestParam(required = false) String factoryFloor,
            @RequestParam(defaultValue = "true") boolean showCompanyHeader,
            @RequestHeader(
                    value = "Authorization",
                    required = false
            ) String auth
    ) {
        User user =
                currentUserService.getCurrentUserFromAuth(auth);

        byte[] pdf =
                hardwarePacketService.generateSticker(
                        itemId,
                        factoryFloor,
                        showCompanyHeader,
                        user
                );

        return pdfResponse(
                pdf,
                "HARDWARE_STICKER_" + itemId + ".pdf",
                false
        );
    }

    /*
     * IMPORTANT:
     *
     * The frontend currently calls:
     * /latest-sticker?download=true/false
     *
     * Keep /sticker as a backward-compatible alias.
     */
    @GetMapping({
            "/{itemId}/latest-sticker",
            "/{itemId}/sticker"
    })
    @PreAuthorize(
            "hasAnyAuthority('ADMIN', 'DISPATCH', 'HARDWARE_PACKING')"
    )
    public ResponseEntity<byte[]> getLatestSticker(
            @PathVariable UUID itemId,
            @RequestParam(defaultValue = "false") boolean download,
            @RequestHeader(
                    value = "Authorization",
                    required = false
            ) String auth
    ) {
        User user =
                currentUserService.getCurrentUserFromAuth(auth);

        byte[] pdf =
                hardwarePacketService.getLatestSticker(
                        itemId,
                        user
                );

        return pdfResponse(
                pdf,
                "HARDWARE_STICKER_" + itemId + ".pdf",
                download
        );
    }

    private ResponseEntity<byte[]> pdfResponse(
            byte[] pdf,
            String filename,
            boolean download
    ) {
        String disposition =
                download
                        ? "attachment; filename=\"" + filename + "\""
                        : "inline; filename=\"" + filename + "\"";

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        disposition
                )
                .header(
                        HttpHeaders.CACHE_CONTROL,
                        "no-store, no-cache, must-revalidate"
                )
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}