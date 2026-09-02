package com.alsorg.packing.controller;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.DispatchChallanService;
import com.alsorg.packing.service.DispatchedItemService;

/**
 * Read-only Dispatch bridge for a pure HARDWARE_PACKING account.
 *
 * This controller intentionally does not expose any mutation endpoint. It lets
 * a hardware packet creator inspect only:
 *
 * - their own hardware PacketItems after those packets enter Dispatch; and
 * - the rows belonging to those same packets inside normal Dispatch challans.
 *
 * Ownership is enforced by PacketItem.createdByUserId inside
 * DispatchedItemService. DispatchedItem.dispatchedBy remains the real Dispatch
 * operator and is not rewritten or treated as hardware ownership.
 */
@RestController
@RequestMapping("/api/hardware-owner-dispatch")
@PreAuthorize("isAuthenticated()")
public class HardwareOwnerDispatchReadController {

    private static final int DEFAULT_CHALLAN_PAGE_SIZE = 50;
    private static final int MAX_CHALLAN_PAGE_SIZE = 100;
    private static final int MAX_CHALLAN_NUMBER_LENGTH = 200;

    private final CurrentUserService currentUserService;
    private final DispatchedItemService dispatchedItemService;
    private final DispatchChallanService dispatchChallanService;

    public HardwareOwnerDispatchReadController(
            CurrentUserService currentUserService,
            DispatchedItemService dispatchedItemService,
            DispatchChallanService dispatchChallanService) {

        this.currentUserService = currentUserService;
        this.dispatchedItemService = dispatchedItemService;
        this.dispatchChallanService = dispatchChallanService;
    }

    @GetMapping(value = "/challans/search", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<DispatchedChallanResponse>> searchOwnedHardwareChallans(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + DEFAULT_CHALLAN_PAGE_SIZE) int size) {

        User user = requireHardwareOnlyUser();
        Set<String> allowedPlants = currentUserService.allowedPlants(user);

        int safePage = Math.max(0, page);
        int safeSize = Math.min(
                Math.max(1, size),
                MAX_CHALLAN_PAGE_SIZE);

        Pageable pageable = PageRequest.of(
                safePage,
                safeSize);

        Page<String> numbersPage = dispatchedItemService
                .searchHardwareOwnerChallanNumbers(
                        user.getId(),
                        allowedPlants,
                        pageable);

        List<DispatchedChallanResponse> rows = numbersPage
                .getContent()
                .stream()
                .map(challanNumber -> dispatchedItemService
                        .findHardwareOwnerChallanItems(
                                user.getId(),
                                allowedPlants,
                                challanNumber))
                .filter(items -> items != null && !items.isEmpty())
                .map(this::buildResponse)
                .toList();

        return ResponseEntity
                .ok()
                .contentType(MediaType.APPLICATION_JSON)
                .header(
                        HttpHeaders.CACHE_CONTROL,
                        "no-store, no-cache, must-revalidate")
                .header(
                        "X-Total-Pages",
                        String.valueOf(numbersPage.getTotalPages()))
                .header(
                        "X-Total-Elements",
                        String.valueOf(numbersPage.getTotalElements()))
                .header(
                        "X-Page-Number",
                        String.valueOf(numbersPage.getNumber()))
                .header(
                        "X-Page-Size",
                        String.valueOf(numbersPage.getSize()))
                .header(
                        "X-Has-Next",
                        String.valueOf(numbersPage.hasNext()))
                .body(rows);
    }

    @GetMapping(value = "/challans/{challanNumber:.+}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<DispatchedChallanResponse> getOwnedHardwareChallan(
            @PathVariable String challanNumber) {

        User user = requireHardwareOnlyUser();
        String cleanChallanNumber = cleanChallanNumber(challanNumber);

        List<DispatchedItem> items = dispatchedItemService
                .findHardwareOwnerChallanItems(
                        user.getId(),
                        currentUserService.allowedPlants(user),
                        cleanChallanNumber);

        if (items.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Hardware challan not found");
        }

        return ResponseEntity
                .ok()
                .contentType(MediaType.APPLICATION_JSON)
                .header(
                        HttpHeaders.CACHE_CONTROL,
                        "no-store, no-cache, must-revalidate")
                .body(buildResponse(items));
    }

    @GetMapping(value = "/challans/{challanNumber:.+}/download", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> downloadOwnedHardwareChallan(
            @PathVariable String challanNumber,
            @RequestParam(defaultValue = "false") boolean preview) {

        User user = requireHardwareOnlyUser();
        String cleanChallanNumber = cleanChallanNumber(challanNumber);

        List<DispatchedItem> items = dispatchedItemService
                .findHardwareOwnerChallanItems(
                        user.getId(),
                        currentUserService.allowedPlants(user),
                        cleanChallanNumber);

        if (items.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Hardware challan not found");
        }

        byte[] pdf = dispatchChallanService
                .renderExistingChallanForVisibleItems(
                        cleanChallanNumber,
                        items);

        String filename = cleanChallanNumber
                .replaceAll("[^a-zA-Z0-9._-]", "_")
                + ".pdf";

        return ResponseEntity
                .ok()
                .header(
                        HttpHeaders.CACHE_CONTROL,
                        "no-store, no-cache, must-revalidate")
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        preview
                                ? "inline; filename=" + filename
                                : "attachment; filename=" + filename)
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    private User requireHardwareOnlyUser() {
        User user = currentUserService.requireCurrentUser();

        if (!currentUserService.isHardwareOnlyPackingUser(user)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Hardware owner Dispatch history is available only to hardware-only packing users");
        }

        if (user.getId() == null) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Authenticated hardware user ID is missing");
        }

        return user;
    }

    private String cleanChallanNumber(String value) {
        String clean = value == null
                ? ""
                : value.trim();

        if (clean.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Challan number is required");
        }

        if (clean.length() > MAX_CHALLAN_NUMBER_LENGTH) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Challan number is too long");
        }

        return clean;
    }

    private DispatchedChallanResponse buildResponse(
            List<DispatchedItem> items) {

        if (items == null || items.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Hardware challan not found");
        }

        DispatchedItem first = items.get(0);

        LocalDateTime dispatchedAt = items
                .stream()
                .map(DispatchedItem::getDispatchedAt)
                .filter(java.util.Objects::nonNull)
                .min(LocalDateTime::compareTo)
                .orElse(null);

        LocalDateTime tripStartedAt = items
                .stream()
                .map(DispatchedItem::getTripStartedAt)
                .filter(java.util.Objects::nonNull)
                .min(LocalDateTime::compareTo)
                .orElse(dispatchedAt);

        LocalDateTime tripEndedAt = items
                .stream()
                .map(DispatchedItem::getTripEndedAt)
                .filter(java.util.Objects::nonNull)
                .max(LocalDateTime::compareTo)
                .orElse(null);

        LocalDateTime durationEnd = tripEndedAt != null
                ? tripEndedAt
                : LocalDateTime.now(TimeZoneConfig.APP_ZONE);

        Long tripDurationMinutes = tripStartedAt == null
                ? null
                : ChronoUnit.MINUTES.between(
                        tripStartedAt,
                        durationEnd);

        String tripStatus = tripEndedAt == null
                ? "RUNNING"
                : "ENDED";

        List<DispatchedChallanItemResponse> itemResponses = items
                .stream()
                .map(this::toItemResponse)
                .toList();

        return new DispatchedChallanResponse(
                firstNonBlank(first.getChalaanNumber()),
                first.getDriverId(),
                first.getDriverName(),
                first.getVehicleId(),
                first.getVehicleNumber(),
                first.getHelperLoaderCount(),
                dispatchedAt,
                first.getDispatchedBy(),
                tripStartedAt,
                tripEndedAt,
                tripDurationMinutes,
                tripStatus,
                itemResponses.size(),
                itemResponses);
    }

    private DispatchedChallanItemResponse toItemResponse(
            DispatchedItem item) {

        return new DispatchedChallanItemResponse(
                item.getZohoItemId(),
                item.getName(),
                item.getSku(),
                item.getPdNo(),
                item.getDrawingNo(),
                item.getClientName(),
                item.getClientAddress(),
                item.getDescription(),
                item.getRemarks(),
                item.getPlantCode(),
                firstNonBlank(
                        item.getCurrentLocationCode(),
                        item.getLocation()),
                item.getStatus() == null
                        ? ""
                        : item.getStatus().name(),
                item.getQuantity(),
                item.getDispatchedAt(),
                item.getDispatchedBy());
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }

        for (String value : values) {
            if (value != null && !value.trim().isBlank()) {
                return value.trim();
            }
        }

        return "";
    }

    public record DispatchedChallanResponse(
            String challanNumber,
            UUID driverId,
            String driverName,
            UUID vehicleId,
            String vehicleNumber,
            Integer helperLoaderCount,
            LocalDateTime dispatchedAt,
            String dispatchedBy,
            LocalDateTime tripStartedAt,
            LocalDateTime tripEndedAt,
            Long tripDurationMinutes,
            String tripStatus,
            int totalItems,
            List<DispatchedChallanItemResponse> items) {
    }

    public record DispatchedChallanItemResponse(
            String zohoItemId,
            String name,
            String sku,
            String pdNo,
            String drawingNo,
            String clientName,
            String clientAddress,
            String description,
            String remarks,
            String plantCode,
            String currentLocationCode,
            String status,
            Integer quantity,
            LocalDateTime dispatchedAt,
            String dispatchedBy) {
    }
}
