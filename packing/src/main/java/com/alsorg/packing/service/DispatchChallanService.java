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
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class DispatchChallanService {

        private static final ZoneId INDIA_ZONE = ZoneId.of("Asia/Kolkata");

        private static final int MAX_CHALLAN_ITEMS = 1000;

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

                return generateAndDispatch(
                                rawItemIds,
                                driverId,
                                vehicleId,
                                dispatchTime,
                                null,
                                username,
                                allowedPlants);
        }

        public DispatchTripPdfResult generateAndDispatch(
                        List<String> rawItemIds,
                        UUID driverId,
                        UUID vehicleId,
                        LocalDateTime dispatchTime,
                        Integer helperLoaderCount,
                        String username,
                        Set<String> allowedPlants) {
                if (rawItemIds == null || rawItemIds.isEmpty()) {
                        throw new RuntimeException("No items selected for challan");
                }

                Driver driver = resolveDriver(
                                driverId);

                Vehicle vehicle = resolveVehicle(
                                vehicleId);

                Integer finalHelperLoaderCount = normalizeHelperLoaderCount(
                                helperLoaderCount);

                List<String> itemIds = cleanUniqueItemIds(rawItemIds);

                if (itemIds.isEmpty()) {
                        throw new RuntimeException("No valid items selected for challan");
                }

                if (itemIds.size() > MAX_CHALLAN_ITEMS) {
                        throw new IllegalArgumentException(
                                        "A maximum of " + MAX_CHALLAN_ITEMS
                                                        + " items can be dispatched in one challan");
                }

                /*
                 * Lock all selected rows in one query before validating/mutating
                 * them. This prevents two concurrent challan requests from both
                 * dispatching the same READY item.
                 */
                List<DispatchedItem> lockedItems = dispatchedRepo
                                .findAllByIdForDispatchUpdate(itemIds);

                if (lockedItems.size() != itemIds.size()) {
                        throw new RuntimeException(
                                        "One or more selected dispatch items no longer exist");
                }

                Map<String, DispatchedItem> lockedById = new LinkedHashMap<>();

                for (DispatchedItem item : lockedItems) {
                        lockedById.put(item.getZohoItemId(), item);
                }

                List<DispatchedItem> items = new ArrayList<>();

                for (String id : itemIds) {
                        DispatchedItem item = lockedById.get(id);

                        if (item == null) {
                                throw new RuntimeException("Item not found: " + id);
                        }

                        assertPlantAccess(
                                        item,
                                        allowedPlants);

                        DispatchedItem prepared = prepareForChallan(
                                        item,
                                        username,
                                        allowedPlants);

                        items.add(prepared);
                }

                Set<String> previouslyDispatchedWithoutChallanIds = items
                                .stream()
                                .filter(this::isPreviouslyDispatchedWithoutChallan)
                                .map(DispatchedItem::getZohoItemId)
                                .filter(id -> id != null && !id.isBlank())
                                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));

                LocalDateTime dispatchTimeIst = dispatchTime != null
                                ? dispatchTime
                                : resolveDispatchTimeForChallan(
                                                items);

                String actor = safeActor(username);

                String challanNo = generateChallanNumber(dispatchTimeIst);

                ChalaanPdfData data = buildPdfData(
                                challanNo,
                                driver,
                                vehicle,
                                items,
                                dispatchTimeIst,
                                finalHelperLoaderCount,
                                false);

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
                                        finalHelperLoaderCount,
                                        actor,
                                        previouslyDispatchedWithoutChallanIds.contains(
                                                        item.getZohoItemId()));
                }

                dispatchedRepo.saveAll(items);

                /*
                 * This logs and moves status to DISPATCHED.
                 * Then we re-apply the selected time after it, so even if older
                 * markDispatchedFromChalaan overwrites time, final saved time stays correct.
                 */
                for (DispatchedItem item : items) {
                        if (previouslyDispatchedWithoutChallanIds.contains(
                                        item.getZohoItemId())) {
                                dispatchedItemService.finalizeChallanForPreviouslyDispatchedItem(
                                                item.getZohoItemId(),
                                                actor);
                        } else {
                                dispatchedItemService.markDispatchedFromChalaan(
                                                item.getZohoItemId(),
                                                actor);
                        }
                }

                List<DispatchedItem> reloadedItems = dispatchedRepo.findAllById(itemIds);

                if (reloadedItems.size() != itemIds.size()) {
                        throw new RuntimeException(
                                        "One or more items are missing after dispatch");
                }

                Map<String, DispatchedItem> reloadedById = new LinkedHashMap<>();

                for (DispatchedItem reloaded : reloadedItems) {
                        reloadedById.put(reloaded.getZohoItemId(), reloaded);
                }

                List<DispatchedItem> finalItems = new ArrayList<>();

                for (String itemId : itemIds) {
                        DispatchedItem saved = reloadedById.get(itemId);

                        if (saved == null) {
                                throw new RuntimeException(
                                                "Item missing after dispatch: " + itemId);
                        }

                        applyDispatchMetadata(
                                        saved,
                                        challanNo,
                                        driver,
                                        vehicle,
                                        dispatchTimeIst,
                                        finalHelperLoaderCount,
                                        actor,
                                        previouslyDispatchedWithoutChallanIds.contains(
                                                        saved.getZohoItemId()));

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

        /*
         * Backward-compatible preview overload.
         */
        @Transactional(readOnly = true)
        public DispatchTripPdfResult previewDispatchChallan(
                        List<String> rawItemIds,
                        UUID driverId,
                        UUID vehicleId,
                        LocalDateTime dispatchTime,
                        String username,
                        Set<String> allowedPlants) {

                return previewDispatchChallan(
                                rawItemIds,
                                driverId,
                                vehicleId,
                                dispatchTime,
                                null,
                                username,
                                allowedPlants);
        }

        @Transactional(readOnly = true)
        public DispatchTripPdfResult previewDispatchChallan(
                        List<String> rawItemIds,
                        UUID driverId,
                        UUID vehicleId,
                        LocalDateTime dispatchTime,
                        Integer helperLoaderCount,
                        String username,
                        Set<String> allowedPlants) {

                List<String> itemIds = cleanUniqueItemIds(
                                rawItemIds);

                if (itemIds.isEmpty()) {
                        throw new RuntimeException(
                                        "No valid items selected for challan");
                }

                Driver driver = resolveDriver(
                                driverId);

                Vehicle vehicle = resolveVehicle(
                                vehicleId);

                Integer finalHelperLoaderCount = normalizeHelperLoaderCount(
                                helperLoaderCount);

                List<DispatchedItem> items = loadPreviewItems(
                                itemIds,
                                allowedPlants);

                LocalDateTime dispatchTimeIst = dispatchTime != null
                                ? dispatchTime
                                : LocalDateTime.now(
                                                INDIA_ZONE);

                String previewChallanNumber = "PREVIEW";

                ChalaanPdfData data = buildPdfData(
                                previewChallanNumber,
                                driver,
                                vehicle,
                                items,
                                dispatchTimeIst,
                                finalHelperLoaderCount,
                                true);

                byte[] pdf = pdfService.generateChalaan(
                                data);

                return new DispatchTripPdfResult(
                                null,
                                previewChallanNumber,
                                pdf);
        }

        private List<DispatchedItem> loadPreviewItems(
                        List<String> itemIds,
                        Set<String> allowedPlants) {

                if (itemIds.size() > MAX_CHALLAN_ITEMS) {
                        throw new IllegalArgumentException(
                                        "A maximum of " + MAX_CHALLAN_ITEMS
                                                        + " items can be previewed in one challan");
                }

                List<DispatchedItem> loaded = dispatchedRepo.findAllById(itemIds);

                if (loaded.size() != itemIds.size()) {
                        throw new RuntimeException(
                                        "One or more selected dispatch items were not found");
                }

                Map<String, DispatchedItem> byId = new LinkedHashMap<>();

                for (DispatchedItem item : loaded) {
                        byId.put(item.getZohoItemId(), item);
                }

                List<DispatchedItem> items = new ArrayList<>();

                for (String id : itemIds) {

                        DispatchedItem item = byId.get(id);

                        if (item == null) {
                                throw new RuntimeException(
                                                "Item not found: " + id);
                        }

                        assertPlantAccess(
                                        item,
                                        allowedPlants);

                        assertEligibleForChallan(
                                        item);

                        /*
                         * Important:
                         * Do not call prepareForChallan() here.
                         *
                         * prepareForChallan() may change READY into
                         * READY_TO_DISPATCH, which is not allowed during preview.
                         */
                        items.add(
                                        item);
                }

                return List.copyOf(
                                items);
        }

        private void assertEligibleForChallan(
                        DispatchedItem item) {

                if (item == null) {
                        throw new RuntimeException(
                                        "Dispatch item is missing");
                }

                ItemDispatchStatus status = item.getStatus();

                if (status == ItemDispatchStatus.READY_TO_DISPATCH) {
                        return;
                }

                /*
                 * QR dispatch may provide a READY item.
                 *
                 * It is acceptable only when:
                 * - it has already moved to FG, or
                 * - it is a legacy item without complete plant/location data.
                 */
                if (status == ItemDispatchStatus.READY) {
                        if (requiresMoveToFg(item)) {
                                throw new RuntimeException(
                                                "Move item to FG before generating challan: "
                                                                + safe(
                                                                                item.getName()));
                        }

                        return;
                }

                if (status == ItemDispatchStatus.DISPATCHED) {
                        /*
                         * Verified XLSX / compatible legacy rows can be dispatched first
                         * and receive their challan later. Existing challaned rows remain
                         * protected from duplicate challan generation.
                         */
                        if (isPreviouslyDispatchedWithoutChallan(item)) {
                                return;
                        }

                        throw new RuntimeException(
                                        "Item already dispatched. Challan: "
                                                        + safe(
                                                                        item.getChalaanNumber()));
                }

                if (status == ItemDispatchStatus.LOADED) {
                        throw new RuntimeException(
                                        "Item is in old queued state. Reset/restore before dispatch: "
                                                        + safe(
                                                                        item.getName()));
                }

                if (status == ItemDispatchStatus.OUT_FOR_DELIVERY) {
                        throw new RuntimeException(
                                        "Item is in old delivery state. Reset/restore before dispatch: "
                                                        + safe(
                                                                        item.getName()));
                }

                if (status == ItemDispatchStatus.DELIVERED) {
                        throw new RuntimeException(
                                        "Item is in old delivered state. Reset/restore before dispatch: "
                                                        + safe(
                                                                        item.getName()));
                }

                throw new RuntimeException(
                                "Item must be READY or READY_TO_DISPATCH before challan. "
                                                + "Current status: "
                                                + (status == null
                                                                ? "NULL"
                                                                : status.name())
                                                + " | Item: "
                                                + safe(
                                                                item.getName()));
        }

        private Driver resolveDriver(
                        UUID driverId) {

                if (driverId == null) {
                        return null;
                }

                return driverRepository
                                .findById(driverId)
                                .orElseThrow(
                                                () -> new RuntimeException(
                                                                "Driver not found: "
                                                                                + driverId));
        }

        private Vehicle resolveVehicle(
                        UUID vehicleId) {

                if (vehicleId == null) {
                        return null;
                }

                return vehicleRepository
                                .findById(vehicleId)
                                .orElseThrow(
                                                () -> new RuntimeException(
                                                                "Vehicle not found: "
                                                                                + vehicleId));
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

                /*
                 * Uses the exact same eligibility rules as preview.
                 */
                assertEligibleForChallan(
                                item);

                if (item.getStatus() == ItemDispatchStatus.READY_TO_DISPATCH) {
                        return item;
                }

                if (isPreviouslyDispatchedWithoutChallan(item)) {
                        return item;
                }

                /*
                 * A valid QR READY item is promoted only during
                 * final creation, never during preview.
                 */
                if (item.getStatus() == ItemDispatchStatus.READY) {
                        dispatchedItemService
                                        .updateDispatchStatus(
                                                        item.getZohoItemId(),
                                                        ItemDispatchStatus.READY_TO_DISPATCH,
                                                        safeActor(
                                                                        username),
                                                        allowedPlants);

                        return dispatchedRepo
                                        .findById(
                                                        item.getZohoItemId())
                                        .orElseThrow(
                                                        () -> new RuntimeException(
                                                                        "Item missing after status update: "
                                                                                        + item.getZohoItemId()));
                }

                /*
                 * assertEligibleForChallan() already rejects all
                 * remaining statuses.
                 */
                throw new RuntimeException(
                                "Item cannot be prepared for challan: "
                                                + safe(
                                                                item.getName()));
        }

        private ChalaanPdfData buildPdfData(
                        String challanNo,
                        Driver driver,
                        Vehicle vehicle,
                        List<DispatchedItem> items,
                        LocalDateTime dispatchTimeIst,
                        Integer helperLoaderCount,
                        boolean preview) {

                ChalaanPdfData data = new ChalaanPdfData();

                data.setPreview(
                                preview);

                data.setHelperLoaderCount(
                                helperLoaderCount);

                data.setVoucherNo(challanNo);
                data.setDispatchTime(dispatchTimeIst);
                data.setDesignerName("-");
                data.setOt("-");
                data.setDriverName(
                                resolveChallanDriverName(
                                                driver,
                                                items));

                data.setVehicleNumber(
                                vehicle == null
                                                ? null
                                                : cleanNullable(
                                                                vehicle.getVehicleNumber()));

                List<ChalaanItem> challanItems = new ArrayList<>();

                Map<UUID, PacketItem> packetItemsById = loadPacketItemsById(items);

                for (DispatchedItem item : items) {
                        PacketItem packetItem = item.getPacketItemId() == null
                                        ? null
                                        : packetItemsById.get(item.getPacketItemId());

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

        private Map<UUID, PacketItem> loadPacketItemsById(
                        List<DispatchedItem> items) {

                LinkedHashSet<UUID> ids = new LinkedHashSet<>();

                if (items != null) {
                        for (DispatchedItem item : items) {
                                if (item != null && item.getPacketItemId() != null) {
                                        ids.add(item.getPacketItemId());
                                }
                        }
                }

                if (ids.isEmpty()) {
                        return Map.of();
                }

                Map<UUID, PacketItem> result = new LinkedHashMap<>();

                packetItemRepo.findAllById(ids)
                                .forEach(packetItem -> {
                                        if (packetItem != null && packetItem.getId() != null) {
                                                result.put(packetItem.getId(), packetItem);
                                        }
                                });

                return result;
        }

        private void applyDispatchMetadata(
                        DispatchedItem item,
                        String challanNo,
                        Driver driver,
                        Vehicle vehicle,
                        LocalDateTime dispatchTimeIst,
                        Integer helperLoaderCount,
                        String actor,
                        boolean preserveExistingTransportMetadata) {
                item.setChalaanNumber(challanNo);

                item.setHelperLoaderCount(
                                helperLoaderCount);

                if (driver != null) {
                        item.setDriverId(
                                        driver.getId());

                        item.setDriverName(
                                        cleanNullable(
                                                        driver.getName()));
                } else if (!preserveExistingTransportMetadata) {
                        item.setDriverId(null);
                        item.setDriverName(null);
                }

                if (vehicle != null) {
                        item.setVehicleId(
                                        vehicle.getId());

                        item.setVehicleNumber(
                                        cleanNullable(
                                                        vehicle.getVehicleNumber()));
                } else if (!preserveExistingTransportMetadata) {
                        item.setVehicleId(null);
                        item.setVehicleNumber(null);
                }

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

        private boolean isPreviouslyDispatchedWithoutChallan(
                        DispatchedItem item) {

                if (item == null || item.getStatus() != ItemDispatchStatus.DISPATCHED) {
                        return false;
                }

                return isBlank(item.getChalaanNumber());
        }

        private LocalDateTime resolveDispatchTimeForChallan(
                        List<DispatchedItem> items) {

                if (items != null && !items.isEmpty()
                                && items.stream().allMatch(this::isPreviouslyDispatchedWithoutChallan)) {

                        LocalDateTime common = null;

                        for (DispatchedItem item : items) {
                                LocalDateTime value = item.getDispatchedAt();

                                if (value == null) {
                                        return LocalDateTime.now(INDIA_ZONE);
                                }

                                if (common == null) {
                                        common = value;
                                } else if (!common.equals(value)) {
                                        return LocalDateTime.now(INDIA_ZONE);
                                }
                        }

                        if (common != null) {
                                return common;
                        }
                }

                return LocalDateTime.now(INDIA_ZONE);
        }

        private String resolveChallanDriverName(
                        Driver selectedDriver,
                        List<DispatchedItem> items) {

                if (selectedDriver != null) {
                        return cleanNullable(
                                        selectedDriver.getName());
                }

                if (items == null || items.isEmpty()) {
                        return null;
                }

                String commonName = null;

                for (DispatchedItem item : items) {
                        if (!isPreviouslyDispatchedWithoutChallan(item)) {
                                continue;
                        }

                        String name = cleanNullable(
                                        item.getDriverName());

                        if (name == null) {
                                continue;
                        }

                        if (commonName == null) {
                                commonName = name;
                                continue;
                        }

                        if (!commonName.equalsIgnoreCase(name)) {
                                return null;
                        }
                }

                return commonName;
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
                                .substring(0, 12)
                                .toUpperCase();

                return "CH-" + date + "-" + suffix;
        }

        private String safeActor(
                        String username) {
                return username != null && !username.isBlank()
                                ? username.trim()
                                : "SYSTEM";
        }

        private String cleanNullable(
                        Object value) {
                if (value == null) {
                        return null;
                }

                String text = value
                                .toString()
                                .trim();

                return text.isBlank()
                                ? null
                                : text;
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

        private Integer normalizeHelperLoaderCount(
                        Integer value) {

                /*
                 * Empty or zero means no helpers/loaders.
                 */
                if (value == null || value == 0) {
                        return null;
                }

                if (value < 0) {
                        throw new IllegalArgumentException(
                                        "Helpers/loaders count cannot be negative");
                }

                if (value > 999) {
                        throw new IllegalArgumentException(
                                        "Helpers/loaders count cannot exceed 999");
                }

                return value;
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
                                .substring(0, 12)
                                .toUpperCase();

                return prefix + "-" + date + "-" + suffix;
        }

        private boolean isBlank(
                        String value) {
                return value == null || value.trim().isBlank();
        }
}