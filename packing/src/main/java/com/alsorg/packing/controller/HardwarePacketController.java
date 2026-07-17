package com.alsorg.packing.controller;

import static com.alsorg.packing.controller.dto.hardware.HardwarePacketDtos.*;

import java.util.List;
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
@PreAuthorize(
        "hasAnyAuthority('ADMIN', 'HARDWARE_PACKING')"
)
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

    @PostMapping
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

    @GetMapping
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
                java.util.Map.of(
                        "message",
                        "Hardware packet deleted"
                )
        );
    }

    @PostMapping("/{itemId}/preview-sticker")
    public ResponseEntity<byte[]> previewSticker(
            @PathVariable UUID itemId,
            @RequestParam(required = false) String factoryFloor,
            @RequestParam(defaultValue = "true")
                    boolean showCompanyHeader,
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

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=HARDWARE_PREVIEW_"
                                + itemId
                                + ".pdf"
                )
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @PostMapping("/{itemId}/generate-sticker")
    public ResponseEntity<byte[]> generateSticker(
            @PathVariable UUID itemId,
            @RequestParam(required = false) String factoryFloor,
            @RequestParam(defaultValue = "true")
                    boolean showCompanyHeader,
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

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=HARDWARE_STICKER_"
                                + itemId
                                + ".pdf"
                )
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @GetMapping("/{itemId}/sticker")
    public ResponseEntity<byte[]> getLatestSticker(
            @PathVariable UUID itemId,
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

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=HARDWARE_STICKER_"
                                + itemId
                                + ".pdf"
                )
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}