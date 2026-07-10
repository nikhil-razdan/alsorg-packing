package com.alsorg.packing.service;

import com.alsorg.packing.controller.dto.logistics.DispatchTripPdfResult;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.domain.logistics.Driver;
import com.alsorg.packing.domain.logistics.Vehicle;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.repository.DriverRepository;
import com.alsorg.packing.repository.PacketItemRepository;
import com.alsorg.packing.repository.VehicleRepository;
import com.alsorg.packing.service.pdf.ChalaanItem;
import com.alsorg.packing.service.pdf.ChalaanPdfData;
import com.alsorg.packing.service.pdf.ChalaanPdfService;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.alsorg.packing.controller.dto.challan.CustomChallanRequest;
import com.alsorg.packing.controller.dto.challan.CustomChallanItemRequest;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class DispatchChallanService {

    private static final ZoneId INDIA_ZONE = ZoneId.of("Asia/Kolkata");

    private final ChalaanPdfService pdfService;
    private final DispatchedItemRepository dispatchedRepo;
    private final PacketItemRepository packetItemRepo;
    private final DriverRepository driverRepository;
    private final VehicleRepository vehicleRepository;
    private final DispatchedItemService dispatchedItemService;

    public DispatchChallanService(
            ChalaanPdfService pdfService,
            DispatchedItemRepository dispatchedRepo,
            PacketItemRepository packetItemRepo,
            DriverRepository driverRepository,
            VehicleRepository vehicleRepository,
            DispatchedItemService dispatchedItemService) {
        this.pdfService = pdfService;
        this.dispatchedRepo = dispatchedRepo;
        this.packetItemRepo = packetItemRepo;
        this.driverRepository = driverRepository;
        this.vehicleRepository = vehicleRepository;
        this.dispatchedItemService = dispatchedItemService;
    }

    /*
     * Backward-compatible wrapper.
     * Keeps old controller / mobile calls compiling.
     */
    public DispatchTripPdfResult generateAndDispatch(
            List<String> rawItemIds,
            UUID driverId,
            UUID vehicleId,
            String username,
            Set<String> allowedPlants) {
        return generateAndDispatch(
                rawItemIds,
                driverId,
                vehicleId,
                null,
                username,
                allowedPlants);
    }

    public DispatchTripPdfResult generateAndDispatch(
            List<String> rawItemIds,
            UUID driverId,
            UUID vehicleId,
            LocalDateTime dispatchTime,
            String username,
            Set<String> allowedPlants) {
        if (rawItemIds == null || rawItemIds.isEmpty()) {
            throw new RuntimeException("No items selected for challan");
        }

        if (driverId == null) {
            throw new RuntimeException("Driver is required");
        }

        if (vehicleId == null) {
            throw new RuntimeException("Vehicle is required");
        }

        Driver driver = driverRepository
                .findById(driverId)
                .orElseThrow(() -> new RuntimeException("Driver not found"));

        Vehicle vehicle = vehicleRepository
                .findById(vehicleId)
                .orElseThrow(() -> new RuntimeException("Vehicle not found"));

        List<String> itemIds = cleanUniqueItemIds(rawItemIds);

        if (itemIds.isEmpty()) {
            throw new RuntimeException("No valid items selected for challan");
        }

        List<DispatchedItem> items = new ArrayList<>();

        for (String id : itemIds) {
            DispatchedItem item = dispatchedRepo
                    .findById(id)
                    .orElseThrow(() -> new RuntimeException("Item not found: " + id));

            assertPlantAccess(
                    item,
                    allowedPlants);

            DispatchedItem prepared = prepareForChallan(
                    item,
                    username,
                    allowedPlants);

            items.add(prepared);
        }

        LocalDateTime dispatchTimeIst = dispatchTime != null
                ? dispatchTime
                : LocalDateTime.now(INDIA_ZONE);

        String actor = safeActor(username);

        String challanNo = generateChallanNumber(dispatchTimeIst);

        ChalaanPdfData data = buildPdfData(
                challanNo,
                driver,
                vehicle,
                items,
                dispatchTimeIst);

        byte[] pdf = pdfService.generateChalaan(data);

        /*
         * Save challan metadata before marking DISPATCHED.
         * markDispatchedFromChalaan will set status/stock/logs.
         */
        for (DispatchedItem item : items) {
            applyDispatchMetadata(
                    item,
                    challanNo,
                    driver,
                    vehicle,
                    dispatchTimeIst,
                    actor);
        }

        dispatchedRepo.saveAll(items);

        /*
         * This logs and moves status to DISPATCHED.
         * Then we re-apply the selected time after it, so even if older
         * markDispatchedFromChalaan overwrites time, final saved time stays correct.
         */
        for (DispatchedItem item : items) {
            dispatchedItemService.markDispatchedFromChalaan(
                    item.getZohoItemId(),
                    actor);
        }

        List<DispatchedItem> finalItems = new ArrayList<>();

        for (DispatchedItem item : items) {
            DispatchedItem saved = dispatchedRepo
                    .findById(item.getZohoItemId())
                    .orElseThrow(() -> new RuntimeException(
                            "Item missing after dispatch: " + item.getZohoItemId()));

            applyDispatchMetadata(
                    saved,
                    challanNo,
                    driver,
                    vehicle,
                    dispatchTimeIst,
                    actor);

            saved.setStatus(ItemDispatchStatus.DISPATCHED);
            saved.setStock(0);

            finalItems.add(saved);
        }

        dispatchedRepo.saveAll(finalItems);

        return new DispatchTripPdfResult(
                null,
                challanNo,
                pdf);
    }

    public DispatchTripPdfResult generateCustomChallan(
            CustomChallanRequest request,
            String username) {
        if (request == null) {
            throw new RuntimeException("Custom challan request missing");
        }

        if (isBlank(request.fromLocation())) {
            throw new RuntimeException("From location is required");
        }

        if (isBlank(request.toLocation())) {
            throw new RuntimeException("To location / site is required");
        }

        if (request.items() == null || request.items().isEmpty()) {
            throw new RuntimeException("At least one challan item is required");
        }

        boolean hasValidItem = false;

        for (CustomChallanItemRequest item : request.items()) {
            if (item != null && !isBlank(item.description())) {
                hasValidItem = true;
                break;
            }
        }

        if (!hasValidItem) {
            throw new RuntimeException("At least one item description is required");
        }

        String challanNo = generateCustomChallanNumber(request.challanType());

        byte[] pdf = pdfService.generateCustomChalaan(
                request,
                challanNo,
                safeActor(username));

        return new DispatchTripPdfResult(
                null,
                challanNo,
                pdf);
    }

    private List<String> cleanUniqueItemIds(
            List<String> rawItemIds) {
        LinkedHashSet<String> unique = new LinkedHashSet<>();

        for (String id : rawItemIds) {
            if (id == null) {
                continue;
            }

            String clean = id.trim();

            if (!clean.isBlank()) {
                unique.add(clean);
            }
        }

        return new ArrayList<>(unique);
    }

    private DispatchedItem prepareForChallan(
            DispatchedItem item,
            String username,
            Set<String> allowedPlants) {
        ItemDispatchStatus status = item.getStatus();

        if (status == ItemDispatchStatus.READY_TO_DISPATCH) {
            return item;
        }

        if (status == ItemDispatchStatus.DISPATCHED) {
            throw new RuntimeException(
                    "Item already dispatched. Challan: "
                            + safe(item.getChalaanNumber()));
        }

        if (status == ItemDispatchStatus.LOADED) {
            throw new RuntimeException(
                    "Item is in old queued state. Reset/restore before dispatch: "
                            + safe(item.getName()));
        }

        if (status == ItemDispatchStatus.OUT_FOR_DELIVERY) {
            throw new RuntimeException(
                    "Item is in old delivery state. Reset/restore before dispatch: "
                            + safe(item.getName()));
        }

        if (status == ItemDispatchStatus.DELIVERED) {
            throw new RuntimeException(
                    "Item is in old delivered state. Reset/restore before dispatch: "
                            + safe(item.getName()));
        }

        if (status == ItemDispatchStatus.READY) {
            if (requiresMoveToFg(item)) {
                throw new RuntimeException(
                        "Move item to FG before generating challan: "
                                + safe(item.getName()));
            }

            dispatchedItemService.updateDispatchStatus(
                    item.getZohoItemId(),
                    ItemDispatchStatus.READY_TO_DISPATCH,
                    safeActor(username),
                    allowedPlants);

            return dispatchedRepo
                    .findById(item.getZohoItemId())
                    .orElseThrow(() -> new RuntimeException(
                            "Item missing after status update"));
        }

        throw new RuntimeException(
                "Item must be READY_TO_DISPATCH before challan. Current status: "
                        + status
                        + " | Item: "
                        + safe(item.getName()));
    }

    private ChalaanPdfData buildPdfData(
            String challanNo,
            Driver driver,
            Vehicle vehicle,
            List<DispatchedItem> items,
            LocalDateTime dispatchTimeIst) {
        ChalaanPdfData data = new ChalaanPdfData();

        data.setVoucherNo(challanNo);
        data.setDispatchTime(dispatchTimeIst);
        data.setDesignerName("-");
        data.setOt("-");
        data.setDriverName(safe(driver.getName()));
        data.setVehicleNumber(safe(vehicle.getVehicleNumber()));

        List<ChalaanItem> challanItems = new ArrayList<>();

        for (DispatchedItem item : items) {
            PacketItem packetItem = null;

            if (item.getPacketItemId() != null) {
                packetItem = packetItemRepo
                        .findById(item.getPacketItemId())
                        .orElse(null);
            }

            challanItems.add(
                    buildChallanItem(
                            item,
                            packetItem));
        }

        data.setItems(challanItems);

        if (!challanItems.isEmpty()) {
            data.setAddress(
                    safe(challanItems.get(0).getClientAddress()));
        } else {
            data.setAddress("-");
        }

        return data;
    }

    private void applyDispatchMetadata(
            DispatchedItem item,
            String challanNo,
            Driver driver,
            Vehicle vehicle,
            LocalDateTime dispatchTimeIst,
            String actor) {
        item.setChalaanNumber(challanNo);

        item.setDriverId(driver.getId());
        item.setDriverName(safe(driver.getName()));

        item.setVehicleId(vehicle.getId());
        item.setVehicleNumber(safe(vehicle.getVehicleNumber()));

        /*
         * Main rule:
         * selected dispatch time = dispatchedAt = tripStartedAt
         */
        item.setDispatchedAt(dispatchTimeIst);
        item.setTripStartedAt(dispatchTimeIst);

        /*
         * Logistics/Admin ends it later from Dispatch Challans screen.
         */
        item.setTripEndedAt(null);

        item.setDispatchedBy(actor);
    }

    private ChalaanItem buildChallanItem(
            DispatchedItem dispatchedItem,
            PacketItem packetItem) {
        ChalaanItem ci = new ChalaanItem();

        ci.setZohoItemId(
                dispatchedItem.getZohoItemId());

        ci.setItemName(
                packetItem != null && packetItem.getItemName() != null
                        ? packetItem.getItemName()
                        : dispatchedItem.getName());

        ci.setPdNo(
                packetItem != null && packetItem.getPdNo() != null
                        ? packetItem.getPdNo()
                        : dispatchedItem.getPdNo());

        ci.setClientName(
                packetItem != null && packetItem.getClientName() != null
                        ? packetItem.getClientName()
                        : dispatchedItem.getClientName());

        ci.setClientAddress(
                packetItem != null && packetItem.getClientAddress() != null
                        ? packetItem.getClientAddress()
                        : dispatchedItem.getClientAddress());

        ci.setDescription(
                packetItem != null && packetItem.getDescription() != null
                        ? packetItem.getDescription()
                        : dispatchedItem.getDescription());

        ci.setDrawingNo(
                packetItem != null && packetItem.getDrawingNo() != null
                        ? packetItem.getDrawingNo()
                        : dispatchedItem.getDrawingNo());

        ci.setRemarks(
                packetItem != null && packetItem.getRemarks() != null
                        ? packetItem.getRemarks()
                        : dispatchedItem.getRemarks());

        ci.setQty(
                dispatchedItem.getQuantity() != null
                        ? String.valueOf(dispatchedItem.getQuantity())
                        : "1");

        return ci;
    }

    private void assertPlantAccess(
            DispatchedItem item,
            Set<String> allowedPlants) {
        if (allowedPlants == null || allowedPlants.isEmpty()) {
            return;
        }

        if (item.getPlantCode() == null || item.getPlantCode().isBlank()) {
            return;
        }

        if (!allowedPlants.contains(item.getPlantCode())) {
            throw new RuntimeException(
                    "User does not have access to plant: "
                            + item.getPlantCode());
        }
    }

    private boolean requiresMoveToFg(
            DispatchedItem item) {
        return item.getStatus() == ItemDispatchStatus.READY
                && !isLegacyLocationMissing(item)
                && isPkdLocation(item)
                && !isFgLocation(item);
    }

    private boolean isLegacyLocationMissing(
            DispatchedItem item) {
        return item.getPlantCode() == null || item.getPlantCode().isBlank()
                || item.getCurrentLocationCode() == null || item.getCurrentLocationCode().isBlank()
                || item.getFgAreaCode() == null || item.getFgAreaCode().isBlank();
    }

    private String currentLocation(
            DispatchedItem item) {
        if (item.getCurrentLocationCode() != null && !item.getCurrentLocationCode().isBlank()) {
            return item.getCurrentLocationCode().trim();
        }

        if (item.getLocation() != null && !item.getLocation().isBlank()) {
            return item.getLocation().trim();
        }

        return "";
    }

    private boolean isPkdLocation(
            DispatchedItem item) {
        String location = currentLocation(item);

        if (location.isBlank()) {
            return false;
        }

        String packedArea = item.getPackedAreaCode();

        String cleanLocation = location.trim().toUpperCase();

        if (packedArea != null && !packedArea.isBlank()) {
            String cleanPackedArea = packedArea.trim().toUpperCase();

            return cleanLocation.equals(cleanPackedArea)
                    || cleanLocation.startsWith(cleanPackedArea + "-")
                    || cleanLocation.startsWith(cleanPackedArea + " ");
        }

        return cleanLocation.startsWith("PKD");
    }

    private boolean isFgLocation(
            DispatchedItem item) {
        String location = currentLocation(item);

        String fg = item.getFgAreaCode();

        if (location.isBlank() || fg == null || fg.isBlank()) {
            return false;
        }

        String cleanLocation = location.trim().toUpperCase();

        String cleanFg = fg.trim().toUpperCase();

        return cleanLocation.equals(cleanFg)
                || cleanLocation.startsWith(cleanFg + "-")
                || cleanLocation.startsWith(cleanFg + " ");
    }

    private String generateChallanNumber(
            LocalDateTime dispatchTimeIst) {
        String date = (dispatchTimeIst != null
                ? dispatchTimeIst.toLocalDate()
                : java.time.LocalDate.now(INDIA_ZONE)).format(
                        java.time.format.DateTimeFormatter.BASIC_ISO_DATE);

        String suffix = UUID.randomUUID()
                .toString()
                .substring(0, 6)
                .toUpperCase();

        return "CH-" + date + "-" + suffix;
    }

    private String safeActor(
            String username) {
        return username != null && !username.isBlank()
                ? username.trim()
                : "SYSTEM";
    }

    private String safe(
            Object value) {
        if (value == null) {
            return "-";
        }

        String text = value.toString().trim();

        return text.isEmpty()
                ? "-"
                : text;
    }

    private String generateCustomChallanNumber(
            String challanType) {
        String cleanType = challanType == null
                ? ""
                : challanType.trim().toUpperCase();

        String prefix;

        if ("CUSTOMER_CARE".equals(cleanType)) {
            prefix = "CC-CH";
        } else if ("HARDWARE_SITE_REQUIREMENT".equals(cleanType)) {
            prefix = "HW-CH";
        } else if ("ASSEMBLY_SITE_REQUIREMENT".equals(cleanType)) {
            prefix = "ASM-CH";
        } else if ("JOB_WORK".equals(cleanType)) {
            prefix = "JW-CH";
        } else if ("SITE_RETURN".equals(cleanType)) {
            prefix = "SR-CH";
        } else {
            prefix = "CUS-CH";
        }

        String date = java.time.LocalDate.now(INDIA_ZONE)
                .format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);

        String suffix = UUID.randomUUID()
                .toString()
                .substring(0, 6)
                .toUpperCase();

        return prefix + "-" + date + "-" + suffix;
    }

    private boolean isBlank(
            String value) {
        return value == null || value.trim().isBlank();
    }
}