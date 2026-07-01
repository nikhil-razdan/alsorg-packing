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

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class DispatchChallanService {

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

    @Transactional
    public DispatchTripPdfResult generateAndDispatch(
            List<String> rawItemIds,
            UUID driverId,
            UUID vehicleId,
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

        Driver driver = driverRepository.findById(driverId)
                .orElseThrow(() -> new RuntimeException("Driver not found"));

        Vehicle vehicle = vehicleRepository.findById(vehicleId)
                .orElseThrow(() -> new RuntimeException("Vehicle not found"));

        List<String> itemIds = new ArrayList<>(
                rawItemIds.stream()
                        .filter(id -> id != null && !id.trim().isBlank())
                        .map(String::trim)
                        .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new)));

        if (itemIds.isEmpty()) {
            throw new RuntimeException("No valid items selected for challan");
        }

        List<DispatchedItem> items = new ArrayList<>();

        for (String id : itemIds) {
            DispatchedItem item = dispatchedRepo.findById(id)
                    .orElseThrow(() -> new RuntimeException("Item not found: " + id));

            assertPlantAccess(item, allowedPlants);

            item = prepareForChallan(
                    item,
                    username,
                    allowedPlants);

            items.add(item);
        }

        String challanNo = "CH-" + System.currentTimeMillis();

        ChalaanPdfData data = new ChalaanPdfData();

        data.setVoucherNo(challanNo);
        data.setDesignerName("-");
        data.setOt("-");
        data.setDriverName(driver.getName());
        data.setVehicleNumber(vehicle.getVehicleNumber());

        List<ChalaanItem> challanItems = new ArrayList<>();

        for (DispatchedItem item : items) {
            PacketItem packetItem = null;

            if (item.getPacketItemId() != null) {
                packetItem = packetItemRepo.findById(item.getPacketItemId())
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
        }

        byte[] pdf = pdfService.generateChalaan(data);

        LocalDateTime now = LocalDateTime.now(
                java.time.ZoneId.of("Asia/Kolkata"));

        for (DispatchedItem item : items) {
            item.setChalaanNumber(challanNo);

            item.setDriverId(driver.getId());
            item.setDriverName(driver.getName());

            item.setVehicleId(vehicle.getId());
            item.setVehicleNumber(vehicle.getVehicleNumber());

            item.setDispatchedAt(now);
            item.setDispatchedBy(safeActor(username));
        }

        dispatchedRepo.saveAll(items);

        for (DispatchedItem item : items) {
            dispatchedItemService.markDispatchedFromChalaan(
                    item.getZohoItemId(),
                    safeActor(username));
        }

        return new DispatchTripPdfResult(
                null,
                challanNo,
                pdf);
    }

    private DispatchedItem prepareForChallan(
            DispatchedItem item,
            String username,
            Set<String> allowedPlants) {
        if (item.getStatus() == ItemDispatchStatus.READY_TO_DISPATCH) {
            return item;
        }

        if (item.getStatus() == ItemDispatchStatus.DISPATCHED) {
            throw new RuntimeException(
                    "Item already dispatched. Challan: " + safe(item.getChalaanNumber()));
        }

        if (item.getStatus() == ItemDispatchStatus.LOADED) {
            throw new RuntimeException(
                    "Item is in old queued state. Reset/restore before dispatch: "
                            + safe(item.getName()));
        }

        if (item.getStatus() == ItemDispatchStatus.OUT_FOR_DELIVERY) {
            throw new RuntimeException(
                    "Item is in old delivery state. Reset/restore before dispatch: "
                            + safe(item.getName()));
        }

        if (item.getStatus() == ItemDispatchStatus.DELIVERED) {
            throw new RuntimeException(
                    "Item is in old delivered state. Reset/restore before dispatch: "
                            + safe(item.getName()));
        }

        if (item.getStatus() == ItemDispatchStatus.READY) {
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

            return dispatchedRepo.findById(item.getZohoItemId())
                    .orElseThrow(() -> new RuntimeException("Item missing after status update"));
        }

        throw new RuntimeException(
                "Item must be READY_TO_DISPATCH before challan. Current status: "
                        + item.getStatus()
                        + " | Item: "
                        + safe(item.getName()));
    }

    private ChalaanItem buildChallanItem(
            DispatchedItem dispatchedItem,
            PacketItem packetItem) {
        ChalaanItem ci = new ChalaanItem();

        ci.setZohoItemId(dispatchedItem.getZohoItemId());

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
                    "User does not have access to plant: " + item.getPlantCode());
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

        if (packedArea != null && !packedArea.isBlank()) {
            return location.equals(packedArea)
                    || location.startsWith(packedArea + "-")
                    || location.startsWith(packedArea + " ");
        }

        return location.startsWith("PKD");
    }

    private boolean isFgLocation(
            DispatchedItem item) {
        String location = currentLocation(item);

        String fg = item.getFgAreaCode();

        if (location.isBlank() || fg == null || fg.isBlank()) {
            return false;
        }

        return location.equals(fg)
                || location.startsWith(fg + "-")
                || location.startsWith(fg + " ");
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
}