package com.alsorg.packing.controller;

import static com.alsorg.packing.controller.dto.hardware.HardwarePacketDtos.*;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

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

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.HardwarePacketService;
import com.alsorg.packing.service.UtlWorkflowService;

/**
 * Dedicated UTL hardware-packing boundary.
 *
 * Normal hardware creation remains on /api/hardware-packets and continues to
 * require ADMIN/HARDWARE_PACKING.  This controller exists so a UTL identity
 * never needs ordinary HARDWARE_PACKING authority.
 *
 * UTL hardware is deliberately subject to the same isolation rules as normal
 * UTL packing:
 * - exactly one assigned source plant (AL-P3 or WR-38);
 * - creator-owned hardware Inventory;
 * - final sticker/QR generation requires one eligible same-plant Dispatch
 *   target;
 * - the routing row is created before the packet enters Dispatch;
 * - AL-P3 UTL hardware hides the ALSORG header and WR-38 stays QR-only through
 *   PacketService's established WR-38 renderer.
 */
@RestController
@RequestMapping("/api/utl/hardware-packets")
@PreAuthorize("isAuthenticated() and hasAuthority('UTL_HARDWARE_PACKING')")
public class UtlHardwarePacketController {

    private static final Set<String> UTL_PLANTS = Set.of(
            UtlWorkflowService.AL_P3,
            UtlWorkflowService.WR_38);

    private final HardwarePacketService hardwarePacketService;
    private final CurrentUserService currentUserService;
    private final UtlWorkflowService utlWorkflowService;

    public UtlHardwarePacketController(
            HardwarePacketService hardwarePacketService,
            CurrentUserService currentUserService,
            UtlWorkflowService utlWorkflowService) {
        this.hardwarePacketService = hardwarePacketService;
        this.currentUserService = currentUserService;
        this.utlWorkflowService = utlWorkflowService;
    }

    @PostMapping
    public ResponseEntity<List<HardwarePacketResponse>> create(
            @RequestBody HardwarePacketCreateRequest request,
            @RequestParam(required = false) List<Integer> packetNumbers) {
        User user = requireUtlHardwareUser();
        return ResponseEntity.ok(
                hardwarePacketService.createUtlPackets(
                        request,
                        user,
                        packetNumbers));
    }

    @PostMapping("/masters/{masterItemId}/packets")
    public ResponseEntity<List<HardwarePacketResponse>> addPackets(
            @PathVariable UUID masterItemId,
            @RequestBody HardwarePacketAddRequest request,
            @RequestParam(required = false) List<Integer> packetNumbers) {
        User user = requireUtlHardwareUser();
        return ResponseEntity.ok(
                hardwarePacketService.addUtlPackets(
                        masterItemId,
                        request,
                        user,
                        packetNumbers));
    }

    @GetMapping
    public ResponseEntity<List<HardwarePacketResponse>> getVisiblePackets() {
        User user = requireUtlHardwareUser();
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(hardwarePacketService.getVisiblePackets(user));
    }

    @PutMapping("/{itemId}")
    public HardwarePacketResponse update(
            @PathVariable UUID itemId,
            @RequestBody HardwarePacketUpdateRequest request) {
        User user = requireUtlHardwareUser();
        return hardwarePacketService.updatePacket(itemId, request, user);
    }

    @DeleteMapping("/{itemId}")
    public ResponseEntity<Map<String, String>> delete(
            @PathVariable UUID itemId) {
        User user = requireUtlHardwareUser();
        hardwarePacketService.deletePacket(itemId, user);
        return ResponseEntity.ok(
                Map.of("message", "UTL hardware packet deleted"));
    }

    @GetMapping("/dispatch-targets")
    public ResponseEntity<List<UtlWorkflowService.DispatchTarget>> dispatchTargets() {
        User user = requireUtlHardwareUser();
        String plantCode = requireSingleUtlPlant(user);

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(utlWorkflowService.getEligibleDispatchTargets(
                        user,
                        plantCode));
    }

    @PostMapping("/{itemId}/preview-sticker")
    public ResponseEntity<byte[]> previewSticker(
            @PathVariable UUID itemId,
            @RequestParam(required = false) String factoryFloor,
            @RequestParam(defaultValue = "false") boolean showCompanyHeader) {
        User user = requireUtlHardwareUser();

        /*
         * UTL company-header suppression is server-enforced. The request flag is
         * accepted only so the existing Inventory client can use one query shape.
         */
        byte[] pdf = hardwarePacketService.previewSticker(
                itemId,
                factoryFloor,
                false,
                user);

        String prefix = isWr38(user)
                ? "UTL_HARDWARE_QR_PREVIEW_"
                : "UTL_HARDWARE_STICKER_PREVIEW_";

        return pdfResponse(
                pdf,
                prefix + itemId + ".pdf",
                false);
    }

    @PostMapping("/{itemId}/generate-sticker")
    public ResponseEntity<byte[]> generateSticker(
            @PathVariable UUID itemId,
            @RequestParam(required = false) String factoryFloor,
            @RequestParam(defaultValue = "false") boolean showCompanyHeader,
            @RequestParam String dispatchMode,
            @RequestParam String dispatchTargetUsername,
            @RequestParam(required = false) String dispatchTargetPlantCode) {

        User user = requireUtlHardwareUser();
        String sourcePlant = requireSingleUtlPlant(user);

        UtlWorkflowService.DispatchTarget selected = validateRoutingTarget(
                user,
                sourcePlant,
                dispatchMode,
                dispatchTargetUsername,
                dispatchTargetPlantCode);

        byte[] pdf = hardwarePacketService.generateUtlSticker(
                itemId,
                factoryFloor,
                user,
                selected.dispatchMode(),
                selected.username(),
                selected.plantCode());

        String prefix = UtlWorkflowService.WR_38.equals(sourcePlant)
                ? "UTL_HARDWARE_QR_"
                : "UTL_HARDWARE_STICKER_";

        return pdfResponse(
                pdf,
                prefix + itemId + ".pdf",
                false);
    }

    @GetMapping({"/{itemId}/latest-sticker", "/{itemId}/sticker"})
    public ResponseEntity<byte[]> getLatestSticker(
            @PathVariable UUID itemId,
            @RequestParam(defaultValue = "false") boolean download) {
        User user = requireUtlHardwareUser();
        byte[] pdf = hardwarePacketService.getLatestSticker(itemId, user);

        String prefix = isWr38(user)
                ? "UTL_HARDWARE_QR_"
                : "UTL_HARDWARE_STICKER_";

        return pdfResponse(
                pdf,
                prefix + itemId + ".pdf",
                download);
    }

    private UtlWorkflowService.DispatchTarget validateRoutingTarget(
            User user,
            String sourcePlant,
            String dispatchMode,
            String dispatchTargetUsername,
            String dispatchTargetPlantCode) {

        String cleanMode = normalizeUpper(dispatchMode);
        String cleanUsername = clean(dispatchTargetUsername);
        String requestedPlant = normalizeUpper(dispatchTargetPlantCode);

        if (!UtlWorkflowService.MODE_UTL.equals(cleanMode)
                && !UtlWorkflowService.MODE_INTERNAL.equals(cleanMode)) {
            throw new IllegalArgumentException(
                    "Select UTL Dispatch or Internal Plant Dispatch before sticker generation");
        }

        if (cleanUsername == null) {
            throw new IllegalArgumentException(
                    "Select the dispatch user before sticker generation");
        }

        if (requestedPlant != null && !sourcePlant.equals(requestedPlant)) {
            throw new AccessDeniedException(
                    "UTL hardware must be routed inside its source plant");
        }

        return utlWorkflowService.getEligibleDispatchTargets(user, sourcePlant)
                .stream()
                .filter(target -> cleanMode.equalsIgnoreCase(target.dispatchMode()))
                .filter(target -> sourcePlant.equalsIgnoreCase(target.plantCode()))
                .filter(target -> cleanUsername.equalsIgnoreCase(target.username()))
                .findFirst()
                .orElseThrow(() -> new AccessDeniedException(
                        "Selected dispatch user is not eligible for this UTL hardware packet"));
    }

    private User requireUtlHardwareUser() {
        User user = currentUserService.requireCurrentUser();

        if (!currentUserService.isUtlHardwarePacking(user)) {
            throw new AccessDeniedException(
                    "UTL_HARDWARE_PACKING access required");
        }

        requireSingleUtlPlant(user);
        return user;
    }

    private String requireSingleUtlPlant(User user) {
        Set<String> plants = currentUserService.allowedPlants(user);

        if (plants == null || plants.size() != 1) {
            throw new AccessDeniedException(
                    "UTL hardware packing identity must have exactly one plant");
        }

        String plant = normalizeUpper(plants.iterator().next());

        if (plant == null || !UTL_PLANTS.contains(plant)) {
            throw new AccessDeniedException(
                    "UTL hardware packing can operate only in AL-P3 or WR-38");
        }

        return plant;
    }

    private boolean isWr38(User user) {
        return UtlWorkflowService.WR_38.equals(requireSingleUtlPlant(user));
    }

    private ResponseEntity<byte[]> pdfResponse(
            byte[] pdf,
            String filename,
            boolean download) {

        if (pdf == null || pdf.length == 0) {
            throw new IllegalStateException(
                    "Sticker / QR PDF could not be generated");
        }

        String safeFilename = filename.replaceAll(
                "[^a-zA-Z0-9._-]",
                "_");

        ContentDisposition disposition = download
                ? ContentDisposition.attachment()
                        .filename(safeFilename)
                        .build()
                : ContentDisposition.inline()
                        .filename(safeFilename)
                        .build();

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        disposition.toString())
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    private String clean(String value) {
        if (value == null) {
            return null;
        }

        String clean = value.trim();
        return clean.isBlank() ? null : clean;
    }

    private String normalizeUpper(String value) {
        String clean = clean(value);
        return clean == null
                ? null
                : clean.toUpperCase(Locale.ROOT);
    }
}
