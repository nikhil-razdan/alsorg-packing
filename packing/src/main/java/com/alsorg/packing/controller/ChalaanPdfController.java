package com.alsorg.packing.controller;

import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.domain.logistics.Driver;
import com.alsorg.packing.domain.logistics.Vehicle;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.repository.DriverRepository;
import com.alsorg.packing.repository.PacketItemRepository;
import com.alsorg.packing.repository.VehicleRepository;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.DispatchedItemService;
import com.alsorg.packing.service.pdf.ChalaanItem;
import com.alsorg.packing.service.pdf.ChalaanPdfData;
import com.alsorg.packing.service.pdf.ChalaanPdfService;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/chalaan")
public class ChalaanPdfController {

    private final ChalaanPdfService pdfService;
    private final DispatchedItemRepository repo;
    private final DispatchedItemService dispatchedService;
    private final PacketItemRepository packetItemRepo;
    private final DriverRepository driverRepository;
    private final VehicleRepository vehicleRepository;
    private final CurrentUserService currentUserService;

    public ChalaanPdfController(
            ChalaanPdfService pdfService,
            DispatchedItemRepository repo,
            DispatchedItemService dispatchedService,
            PacketItemRepository packetItemRepo,
            DriverRepository driverRepository,
            VehicleRepository vehicleRepository,
            CurrentUserService currentUserService
    ) {
        this.pdfService = pdfService;
        this.repo = repo;
        this.dispatchedService = dispatchedService;
        this.packetItemRepo = packetItemRepo;
        this.driverRepository = driverRepository;
        this.vehicleRepository = vehicleRepository;
        this.currentUserService = currentUserService;
    }

    /*
     * NEW MAIN WEB / MOBILE FLOW
     *
     * Dispatch user selects / scans items,
     * chooses driver + vehicle,
     * challan is generated,
     * items become DISPATCHED immediately.
     *
     * No queue.
     * No start trip.
     * No live location.
     * No POD.
     * No delivery completion.
     */
    @Transactional
    @PostMapping(
            value = "/dispatch",
            produces = MediaType.APPLICATION_PDF_VALUE
    )
    public ResponseEntity<byte[]> generateDispatchChallan(
            @RequestBody ChallanDispatchRequest request,
            @RequestParam(defaultValue = "true") boolean preview,
            @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        User user =
                currentUserService.getCurrentUserFromAuth(auth);

        assertDispatchUser(user);

        DispatchChallanResult result =
                generateAndDispatch(
                        request.itemIds(),
                        request.driverId(),
                        request.vehicleId(),
                        user
                );

        return buildPdfResponse(
                result,
                preview
        );
    }

    /*
     * SINGLE CHALLAN - kept for old frontend compatibility.
     *
     * IMPORTANT:
     * This now also needs driverId and vehicleId.
     */
    @Transactional
    @GetMapping(
            value = "/{zohoItemId}/download",
            produces = MediaType.APPLICATION_PDF_VALUE
    )
    public ResponseEntity<byte[]> generateSingle(
            @PathVariable String zohoItemId,
            @RequestParam UUID driverId,
            @RequestParam UUID vehicleId,
            @RequestParam(defaultValue = "false") boolean preview,
            @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        User user =
                currentUserService.getCurrentUserFromAuth(auth);

        assertDispatchUser(user);

        DispatchChallanResult result =
                generateAndDispatch(
                        List.of(zohoItemId),
                        driverId,
                        vehicleId,
                        user
                );

        return buildPdfResponse(
                result,
                preview
        );
    }

    /*
     * BULK CHALLAN - kept for old frontend compatibility.
     *
     * IMPORTANT:
     * This now also needs driverId and vehicleId.
     */
    @Transactional
    @PostMapping(
            value = "/bulk",
            produces = MediaType.APPLICATION_PDF_VALUE
    )
    public ResponseEntity<byte[]> generateBulk(
            @RequestBody List<String> ids,
            @RequestParam UUID driverId,
            @RequestParam UUID vehicleId,
            @RequestParam(defaultValue = "false") boolean preview,
            @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        User user =
                currentUserService.getCurrentUserFromAuth(auth);

        assertDispatchUser(user);

        DispatchChallanResult result =
                generateAndDispatch(
                        ids,
                        driverId,
                        vehicleId,
                        user
                );

        return buildPdfResponse(
                result,
                preview
        );
    }

    private DispatchChallanResult generateAndDispatch(
            List<String> rawItemIds,
            UUID driverId,
            UUID vehicleId,
            User user
    ) {
        if (rawItemIds == null || rawItemIds.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "No items selected for challan"
            );
        }

        if (driverId == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Driver is required"
            );
        }

        if (vehicleId == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vehicle is required"
            );
        }

        Driver driver =
                driverRepository.findById(driverId)
                        .orElseThrow(() ->
                                new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Driver not found"
                                )
                        );

        Vehicle vehicle =
                vehicleRepository.findById(vehicleId)
                        .orElseThrow(() ->
                                new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Vehicle not found"
                                )
                        );

        List<String> itemIds =
                rawItemIds
                        .stream()
                        .filter(id -> id != null && !id.trim().isBlank())
                        .map(String::trim)
                        .collect(
                                java.util.stream.Collectors.collectingAndThen(
                                        java.util.stream.Collectors.toCollection(LinkedHashSet::new),
                                        ArrayList::new
                                )
                        );

        if (itemIds.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "No valid items selected for challan"
            );
        }

        Set<String> allowedPlants =
                currentUserService.allowedPlants(user);

        List<DispatchedItem> items =
                new ArrayList<>();

        for (String id : itemIds) {
            DispatchedItem item =
                    repo.findById(id)
                            .orElseThrow(() ->
                                    new ResponseStatusException(
                                            HttpStatus.NOT_FOUND,
                                            "Item not found: " + id
                                    )
                            );

            assertDispatchPlantAccess(
                    item,
                    allowedPlants
            );

            /*
             * This is the important part:
             *
             * Move to FG stays.
             * If item is still in PKD, block challan.
             * If item is READY but already in FG / legacy-safe location,
             * convert it to READY_TO_DISPATCH automatically.
             */
            item =
                    prepareItemForChallan(
                            item,
                            user.getUsername(),
                            allowedPlants
                    );

            items.add(item);
        }

        String challanNo =
                generateChallanNumber();

        ChalaanPdfData data =
                new ChalaanPdfData();

        data.setVoucherNo(challanNo);
        data.setDesignerName("-");
        data.setOt("-");
        data.setDriverName(driver.getName());
        data.setVehicleNumber(vehicle.getVehicleNumber());

        List<ChalaanItem> chalaanItems =
                new ArrayList<>();

        for (DispatchedItem item : items) {
            PacketItem packetItem =
                    null;

            if (item.getPacketItemId() != null) {
                packetItem =
                        packetItemRepo
                                .findById(item.getPacketItemId())
                                .orElse(null);
            }

            chalaanItems.add(
                    buildChalaanItem(
                            item,
                            packetItem
                    )
            );
        }

        data.setItems(chalaanItems);

        if (!chalaanItems.isEmpty()) {
            data.setAddress(
                    safe(chalaanItems.get(0).getClientAddress())
            );
        }

        byte[] pdf =
                pdfService.generateChalaan(data);

        for (DispatchedItem item : items) {
            item.setChalaanNumber(challanNo);

            item.setDriverId(driver.getId());
            item.setDriverName(driver.getName());

            item.setVehicleId(vehicle.getId());
            item.setVehicleNumber(vehicle.getVehicleNumber());
        }

        repo.saveAll(items);

        /*
         * Final dispatch happens here.
         * This marks item as DISPATCHED immediately.
         */
        for (DispatchedItem item : items) {
            dispatchedService.markDispatchedFromChalaan(
                    item.getZohoItemId(),
                    user.getUsername()
            );
        }

        return new DispatchChallanResult(
                challanNo,
                pdf
        );
    }

    private DispatchedItem prepareItemForChallan(
            DispatchedItem item,
            String username,
            Set<String> allowedPlants
    ) {
        if (item.getStatus() == ItemDispatchStatus.READY_TO_DISPATCH) {
            return item;
        }

        if (item.getStatus() == ItemDispatchStatus.DISPATCHED) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Item already dispatched: " + safe(item.getName())
            );
        }

        if (item.getStatus() == ItemDispatchStatus.LOADED) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Item is in old queued/loaded state. Restore/reset it before dispatch: "
                            + safe(item.getName())
            );
        }

        if (item.getStatus() == ItemDispatchStatus.OUT_FOR_DELIVERY) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Item is in old delivery state. Restore/reset it before dispatch: "
                            + safe(item.getName())
            );
        }

        if (item.getStatus() == ItemDispatchStatus.DELIVERED) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Item is in old delivered state. Restore/reset it before dispatch: "
                            + safe(item.getName())
            );
        }

        if (item.getStatus() == ItemDispatchStatus.READY) {
            if (requiresMoveToFg(item)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Move item to FG before generating challan: "
                                + safe(item.getName())
                );
            }

            dispatchedService.updateDispatchStatus(
                    item.getZohoItemId(),
                    ItemDispatchStatus.READY_TO_DISPATCH,
                    username,
                    allowedPlants
            );

            return repo.findById(item.getZohoItemId())
                    .orElseThrow(() ->
                            new ResponseStatusException(
                                    HttpStatus.NOT_FOUND,
                                    "Item missing after status update"
                            )
                    );
        }

        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Item must be READY_TO_DISPATCH before challan. Current status: "
                        + item.getStatus()
                        + " | Item: "
                        + safe(item.getName())
        );
    }

    private ChalaanItem buildChalaanItem(
            DispatchedItem dispatchedItem,
            PacketItem packetItem
    ) {
        ChalaanItem ci =
                new ChalaanItem();

        ci.setZohoItemId(
                dispatchedItem.getZohoItemId()
        );

        ci.setItemName(
                packetItem != null && packetItem.getItemName() != null
                        ? packetItem.getItemName()
                        : dispatchedItem.getName()
        );

        ci.setPdNo(
                packetItem != null && packetItem.getPdNo() != null
                        ? packetItem.getPdNo()
                        : dispatchedItem.getPdNo()
        );

        ci.setClientName(
                packetItem != null && packetItem.getClientName() != null
                        ? packetItem.getClientName()
                        : dispatchedItem.getClientName()
        );

        ci.setClientAddress(
                packetItem != null && packetItem.getClientAddress() != null
                        ? packetItem.getClientAddress()
                        : dispatchedItem.getClientAddress()
        );

        ci.setDescription(
                packetItem != null && packetItem.getDescription() != null
                        ? packetItem.getDescription()
                        : dispatchedItem.getDescription()
        );

        ci.setDrawingNo(
                packetItem != null && packetItem.getDrawingNo() != null
                        ? packetItem.getDrawingNo()
                        : dispatchedItem.getDrawingNo()
        );

        ci.setRemarks(
                packetItem != null && packetItem.getRemarks() != null
                        ? packetItem.getRemarks()
                        : dispatchedItem.getRemarks()
        );

        ci.setQty(
                dispatchedItem.getQuantity() != null
                        ? String.valueOf(dispatchedItem.getQuantity())
                        : "1"
        );

        return ci;
    }

    private ResponseEntity<byte[]> buildPdfResponse(
            DispatchChallanResult result,
            boolean preview
    ) {
        String challanNo =
                safe(result.challanNo());

        String filename =
                sanitizeFilename(challanNo) + ".pdf";

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        preview
                                ? "inline; filename=" + filename
                                : "attachment; filename=" + filename
                )
                .header(
                        "X-Challan-No",
                        challanNo
                )
                .header(
                        "Access-Control-Expose-Headers",
                        "X-Challan-No, Content-Disposition"
                )
                .contentType(MediaType.APPLICATION_PDF)
                .body(result.pdfBytes());
    }

    private void assertDispatchUser(
            User user
    ) {
        if (user == null || !currentUserService.isDispatch(user)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only DISPATCH user can generate challan"
            );
        }
    }

    private void assertDispatchPlantAccess(
            DispatchedItem item,
            Set<String> allowedPlants
    ) {
        if (item == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Dispatch item missing"
            );
        }

        if (allowedPlants == null || allowedPlants.isEmpty()) {
            return;
        }

        /*
         * Legacy safety:
         * Old items may not have plantCode.
         * Do not block them.
         */
        if (item.getPlantCode() == null || item.getPlantCode().isBlank()) {
            return;
        }

        if (!allowedPlants.contains(item.getPlantCode())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "User does not have access to plant: " + item.getPlantCode()
            );
        }
    }

    private boolean requiresMoveToFg(
            DispatchedItem item
    ) {
        return item.getStatus() == ItemDispatchStatus.READY
                && !isLegacyLocationMissing(item)
                && isPkdLocation(item)
                && !isFgLocation(item);
    }

    private boolean isLegacyLocationMissing(
            DispatchedItem item
    ) {
        return item.getPlantCode() == null || item.getPlantCode().isBlank()
                || item.getCurrentLocationCode() == null || item.getCurrentLocationCode().isBlank()
                || item.getFgAreaCode() == null || item.getFgAreaCode().isBlank();
    }

    private String currentLocation(
            DispatchedItem item
    ) {
        if (
                item.getCurrentLocationCode() != null
                        && !item.getCurrentLocationCode().isBlank()
        ) {
            return item.getCurrentLocationCode().trim();
        }

        if (
                item.getLocation() != null
                        && !item.getLocation().isBlank()
        ) {
            return item.getLocation().trim();
        }

        return "";
    }

    private boolean isPkdLocation(
            DispatchedItem item
    ) {
        String location =
                currentLocation(item);

        if (location.isBlank()) {
            return false;
        }

        String packedArea =
                item.getPackedAreaCode();

        if (packedArea != null && !packedArea.isBlank()) {
            return location.equals(packedArea)
                    || location.startsWith(packedArea + "-")
                    || location.startsWith(packedArea + " ");
        }

        return location.startsWith("PKD");
    }

    private boolean isFgLocation(
            DispatchedItem item
    ) {
        String location =
                currentLocation(item);

        String fg =
                item.getFgAreaCode();

        if (
                location.isBlank()
                        || fg == null
                        || fg.isBlank()
        ) {
            return false;
        }

        return location.equals(fg)
                || location.startsWith(fg + "-")
                || location.startsWith(fg + " ");
    }

    private String generateChallanNumber() {
        return "CH-" + System.currentTimeMillis();
    }

    private String sanitizeFilename(
            String value
    ) {
        return safe(value)
                .replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private String safe(
            Object value
    ) {
        if (value == null) {
            return "-";
        }

        String text =
                value.toString().trim();

        return text.isEmpty()
                ? "-"
                : text;
    }

    public record ChallanDispatchRequest(
            List<String> itemIds,
            UUID driverId,
            UUID vehicleId,

            /*
             * Kept only so old frontend body with tripStart does not break.
             * Not used for trip/delivery anymore.
             */
            LocalDateTime tripStart,
            LocalDateTime dispatchTime
    ) {
    }

    private record DispatchChallanResult(
            String challanNo,
            byte[] pdfBytes
    ) {
    }
}