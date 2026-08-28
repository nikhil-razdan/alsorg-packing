package com.alsorg.packing.controller;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
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
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.controller.dto.logistics.DispatchTripPdfResult;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.DispatchChallanService;
import com.alsorg.packing.service.DispatchedItemService;
import com.alsorg.packing.service.UtlWorkflowService;

/**
 * Strict operational boundary for the UTL Warehouse / Dispatch identity.
 *
 * The normal /api/dispatched and /api/chalaan controllers are deliberately
 * left unchanged for the primary Alsorg workflow.  UTL_DISPATCH uses these
 * endpoints for state-changing work so an exact-role check in a legacy normal
 * controller can never force us to promote UTL_DISPATCH to ordinary DISPATCH.
 *
 * Every operation is checked against:
 *  - exactly one UTL plant (AL-P3 or WR-38),
 *  - an existing UTL routing row, and
 *  - UtlWorkflowService.assertCurrentUserCanOperate(...).
 *
 * That keeps AL-P3 UTL and WR-38 UTL teams mutually isolated while permitting
 * the selected UTL Warehouse / Dispatch user to execute the same established
 * FG, warehouse, status and challan lifecycle as the normal Dispatch user.
 */
@RestController
@RequestMapping("/api/utl")
@PreAuthorize("isAuthenticated() and hasAuthority('UTL_DISPATCH')")
public class UtlDispatchController {

    private static final Set<String> UTL_PLANTS = Set.of(
            "AL-P3",
            "WR-38");

    private static final Set<ItemDispatchStatus> ALLOWED_MANUAL_STATUSES = Set.of(
            ItemDispatchStatus.READY_TO_STORE,
            ItemDispatchStatus.READY_TO_DISPATCH);

    private static final int MAX_BULK_ITEMS = 1000;

    private final DispatchedItemService dispatchedItemService;
    private final DispatchChallanService dispatchChallanService;
    private final DispatchedItemRepository dispatchedItemRepository;
    private final CurrentUserService currentUserService;
    private final UtlWorkflowService utlWorkflowService;

    public UtlDispatchController(
            DispatchedItemService dispatchedItemService,
            DispatchChallanService dispatchChallanService,
            DispatchedItemRepository dispatchedItemRepository,
            CurrentUserService currentUserService,
            UtlWorkflowService utlWorkflowService) {
        this.dispatchedItemService = dispatchedItemService;
        this.dispatchChallanService = dispatchChallanService;
        this.dispatchedItemRepository = dispatchedItemRepository;
        this.currentUserService = currentUserService;
        this.utlWorkflowService = utlWorkflowService;
    }

    /* ============================================================
     * DISPATCH LIFECYCLE
     * ============================================================ */

    @Transactional
    @PostMapping("/dispatch/{itemId:.+}/move-to-fg")
    public ResponseEntity<?> moveToFg(
            @PathVariable String itemId,
            @RequestParam(required = false) String fgZoneCode) {

        UtlContext context = requireContext();
        String cleanId = cleanItemId(itemId);
        requireOperableItem(cleanId, context.plants());

        dispatchedItemService.movePackedItemToFg(
                cleanId,
                cleanNullable(fgZoneCode),
                context.user().getUsername(),
                context.plants());

        return ResponseEntity.ok(
                Map.of(
                        "itemId", cleanId,
                        "message", "Item moved to FG"));
    }

    @Transactional
    @PostMapping("/dispatch/{itemId:.+}/dispatch")
    public ResponseEntity<?> updateStatus(
            @PathVariable String itemId,
            @RequestParam String status) {

        UtlContext context = requireContext();
        String cleanId = cleanItemId(itemId);
        ItemDispatchStatus finalStatus = parseManualStatus(status);

        requireOperableItem(cleanId, context.plants());

        dispatchedItemService.updateDispatchStatus(
                cleanId,
                finalStatus,
                context.user().getUsername(),
                context.plants());

        return ResponseEntity.ok(
                Map.of(
                        "itemId", cleanId,
                        "status", finalStatus.name()));
    }

    @Transactional
    @PostMapping("/dispatch/bulk/status")
    public ResponseEntity<?> bulkUpdateStatus(
            @RequestBody List<String> itemIds,
            @RequestParam String status) {

        UtlContext context = requireContext();
        List<String> cleanIds = cleanItemIds(itemIds);
        ItemDispatchStatus finalStatus = parseManualStatus(status);

        requireOperableItems(cleanIds, context.plants());

        dispatchedItemService.bulkUpdateStatus(
                cleanIds,
                finalStatus,
                context.user().getUsername(),
                context.plants());

        return ResponseEntity.ok(
                Map.of(
                        "updated", cleanIds.size(),
                        "status", finalStatus.name()));
    }

    @Transactional
    @PostMapping("/dispatch/{itemId:.+}/store")
    public ResponseEntity<?> moveToWarehouse(
            @PathVariable String itemId,
            @RequestParam String warehouseCode,
            @RequestParam(required = false) String fromLocation) {

        UtlContext context = requireContext();
        String cleanId = cleanItemId(itemId);
        requireOperableItem(cleanId, context.plants());

        String gatePass = dispatchedItemService.moveToWarehouse(
                cleanId,
                warehouseCode,
                fromLocation,
                context.user().getUsername(),
                context.plants());

        return ResponseEntity.ok(
                Map.of(
                        "gatePass", gatePass,
                        "itemId", cleanId));
    }

    @Transactional
    @PostMapping("/dispatch/bulk/store")
    public ResponseEntity<?> bulkMoveToWarehouse(
            @RequestBody List<String> itemIds,
            @RequestParam String warehouseCode,
            @RequestParam(required = false) String fromLocation) {

        UtlContext context = requireContext();
        List<String> cleanIds = cleanItemIds(itemIds);
        requireOperableItems(cleanIds, context.plants());

        String gatePass = dispatchedItemService.bulkMoveToWarehouse(
                cleanIds,
                warehouseCode,
                fromLocation,
                context.user().getUsername(),
                context.plants());

        return ResponseEntity.ok(
                Map.of(
                        "gatePass", gatePass,
                        "itemCount", cleanIds.size()));
    }

    /* ============================================================
     * CHALLAN
     * ============================================================ */

    @Transactional(readOnly = true)
    @PostMapping(
            value = "/chalaan/dispatch/preview",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> previewChallan(
            @RequestBody UtlChallanDispatchRequest request) {

        UtlContext context = requireContext();
        List<String> itemIds = validateChallanRequest(
                request,
                context.plants());

        DispatchTripPdfResult result = dispatchChallanService.previewDispatchChallan(
                itemIds,
                request.driverId(),
                request.vehicleId(),
                firstNonNull(request.dispatchTime(), request.tripStart()),
                normalizeHelperLoaderCount(request.helperLoaderCount()),
                context.user().getUsername(),
                context.plants());

        byte[] pdf = requirePdf(result);

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline()
                                .filename("UTL_CHALLAN_PREVIEW.pdf")
                                .build()
                                .toString())
                .header("X-Challan-Preview", "true")
                .header("X-Challan-No", "PREVIEW")
                .header(
                        "Access-Control-Expose-Headers",
                        "X-Challan-No, X-Challan-Preview, Content-Disposition")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @Transactional
    @PostMapping(
            value = "/chalaan/dispatch",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> generateChallan(
            @RequestBody UtlChallanDispatchRequest request,
            @RequestParam(defaultValue = "true") boolean preview) {

        UtlContext context = requireContext();
        List<String> itemIds = validateChallanRequest(
                request,
                context.plants());

        DispatchTripPdfResult result = dispatchChallanService.generateAndDispatch(
                itemIds,
                request.driverId(),
                request.vehicleId(),
                firstNonNull(request.dispatchTime(), request.tripStart()),
                normalizeHelperLoaderCount(request.helperLoaderCount()),
                context.user().getUsername(),
                context.plants());

        byte[] pdf = requirePdf(result);
        String challanNo = cleanChallanNumber(result.getChallanNumber());
        String filename = safeFilename(challanNo) + ".pdf";

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        (preview
                                ? ContentDisposition.inline()
                                : ContentDisposition.attachment())
                                .filename(filename)
                                .build()
                                .toString())
                .header("X-Challan-No", challanNo)
                .header(
                        "Access-Control-Expose-Headers",
                        "X-Challan-No, Content-Disposition")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    private List<String> validateChallanRequest(
            UtlChallanDispatchRequest request,
            Set<String> plants) {

        if (request == null) {
            throw badRequest("Challan request is required");
        }

        List<String> cleanIds = cleanItemIds(request.itemIds());
        requireOperableItems(cleanIds, plants);

        /* Validate before the service starts PDF generation. */
        normalizeHelperLoaderCount(request.helperLoaderCount());

        if (firstNonNull(request.dispatchTime(), request.tripStart()) == null) {
            throw badRequest("Challan date and time is required");
        }

        return cleanIds;
    }

    private UtlContext requireContext() {
        User user = currentUserService.requireCurrentUser();

        if (!currentUserService.isUtlDispatch(user)) {
            throw new AccessDeniedException(
                    "UTL_DISPATCH access required");
        }

        Set<String> plants = currentUserService.allowedPlants(user);

        if (plants == null || plants.size() != 1) {
            throw new AccessDeniedException(
                    "UTL Warehouse / Dispatch identity must have exactly one plant");
        }

        String plant = normalizeCode(plants.iterator().next());

        if (plant == null || !UTL_PLANTS.contains(plant)) {
            throw new AccessDeniedException(
                    "UTL Warehouse / Dispatch can operate only in AL-P3 or WR-38");
        }

        return new UtlContext(
                user,
                Set.of(plant));
    }

    private DispatchedItem requireOperableItem(
            String itemId,
            Set<String> plants) {

        DispatchedItem item = dispatchedItemRepository
                .findById(itemId)
                .orElseThrow(() -> hiddenNotFound(itemId));

        String plant = normalizeCode(item.getPlantCode());

        if (plant == null || !plants.contains(plant)) {
            throw hiddenNotFound(itemId);
        }

        if (item.getPacketItemId() == null
                || utlWorkflowService
                        .findRoutingByPacketItemId(item.getPacketItemId())
                        .isEmpty()) {
            throw hiddenNotFound(itemId);
        }

        utlWorkflowService.assertCurrentUserCanOperate(item);
        return item;
    }

    private void requireOperableItems(
            List<String> itemIds,
            Set<String> plants) {
        for (String itemId : itemIds) {
            requireOperableItem(itemId, plants);
        }
    }

    private List<String> cleanItemIds(
            List<String> itemIds) {
        if (itemIds == null || itemIds.isEmpty()) {
            throw badRequest("No items selected");
        }

        if (itemIds.size() > MAX_BULK_ITEMS) {
            throw new ResponseStatusException(
                    HttpStatus.PAYLOAD_TOO_LARGE,
                    "A maximum of " + MAX_BULK_ITEMS + " items can be submitted at one time");
        }

        LinkedHashSet<String> unique = new LinkedHashSet<>();

        for (String value : itemIds) {
            String clean = cleanItemId(value);
            unique.add(clean);
        }

        if (unique.isEmpty()) {
            throw badRequest("No valid items selected");
        }

        return List.copyOf(unique);
    }

    private String cleanItemId(
            String value) {
        String clean = value == null
                ? ""
                : value.trim();

        if (clean.isBlank()) {
            throw badRequest("Dispatch item id is required");
        }

        if (clean.length() > 300) {
            throw badRequest("Dispatch item id is too long");
        }

        return clean;
    }

    private ItemDispatchStatus parseManualStatus(
            String value) {
        String clean = normalizeCode(value);

        if (clean == null) {
            throw badRequest("Dispatch status is required");
        }

        final ItemDispatchStatus status;

        try {
            status = ItemDispatchStatus.valueOf(clean);
        } catch (IllegalArgumentException exception) {
            throw badRequest("Invalid dispatch status: " + clean);
        }

        if (!ALLOWED_MANUAL_STATUSES.contains(status)) {
            throw badRequest(
                    "UTL manual status may only be READY_TO_STORE or READY_TO_DISPATCH");
        }

        return status;
    }

    private Integer normalizeHelperLoaderCount(
            Integer value) {
        if (value == null || value == 0) {
            return null;
        }

        if (value < 0 || value > 999) {
            throw badRequest(
                    "Helpers / loaders must be between 0 and 999");
        }

        return value;
    }

    private byte[] requirePdf(
            DispatchTripPdfResult result) {
        byte[] bytes = result == null
                ? null
                : result.getPdfBytes();

        if (bytes == null || bytes.length == 0) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Challan PDF could not be generated");
        }

        return bytes;
    }

    private String cleanChallanNumber(
            String value) {
        String clean = value == null
                ? ""
                : value.trim();

        return clean.isBlank()
                ? "CHALAAN"
                : clean;
    }

    private String safeFilename(
            String value) {
        String clean = Objects.toString(value, "CHALAAN")
                .replaceAll("[^a-zA-Z0-9._-]", "_");

        return clean.isBlank()
                ? "CHALAAN"
                : clean;
    }

    private String normalizeCode(
            String value) {
        if (value == null) {
            return null;
        }

        String clean = value
                .trim()
                .toUpperCase(Locale.ROOT);

        return clean.isBlank()
                ? null
                : clean;
    }

    private String cleanNullable(
            String value) {
        if (value == null) {
            return null;
        }

        String clean = value.trim();
        return clean.isBlank()
                ? null
                : clean;
    }

    private LocalDateTime firstNonNull(
            LocalDateTime first,
            LocalDateTime second) {
        return first != null
                ? first
                : second;
    }

    private ResponseStatusException hiddenNotFound(
            String itemId) {
        return new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "UTL dispatch item not found or not assigned: " + itemId);
    }

    private ResponseStatusException badRequest(
            String message) {
        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                message);
    }

    private record UtlContext(
            User user,
            Set<String> plants) {
    }

    public record UtlChallanDispatchRequest(
            List<String> itemIds,
            UUID driverId,
            UUID vehicleId,
            Integer helperLoaderCount,
            LocalDateTime dispatchTime,
            LocalDateTime tripStart) {
    }
}
