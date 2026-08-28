package com.alsorg.packing.service;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.controller.dto.logistics.DispatchTripPdfResult;
import com.alsorg.packing.controller.dto.logistics.LogisticsTripItemResponse;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.domain.logistics.Driver;
import com.alsorg.packing.domain.logistics.LogisticsTrip;
import com.alsorg.packing.domain.logistics.LogisticsTripItem;
import com.alsorg.packing.domain.logistics.LogisticsTripStatus;
import com.alsorg.packing.domain.logistics.Vehicle;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.repository.DriverRepository;
import com.alsorg.packing.repository.LogisticsTripItemRepository;
import com.alsorg.packing.repository.LogisticsTripRepository;
import com.alsorg.packing.repository.PacketItemRepository;
import com.alsorg.packing.repository.VehicleRepository;
import com.alsorg.packing.service.pdf.ChalaanItem;
import com.alsorg.packing.service.pdf.ChalaanPdfData;
import com.alsorg.packing.service.pdf.ChalaanPdfService;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.domain.logistics.LogisticsTripLocation;
import com.alsorg.packing.repository.LogisticsTripLocationRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;

import java.net.URI;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class LogisticsDispatchTripService {

        private static final int MAX_TRIP_ITEMS = 1000;
        private static final java.time.ZoneId APP_ZONE = TimeZoneConfig.APP_ZONE;
        private static final int MAX_POD_URL_LENGTH = 2048;
        private static final int MAX_DELIVERY_TEXT_LENGTH = 2000;


        private final LogisticsTripRepository tripRepository;
        private final LogisticsTripItemRepository tripItemRepository;
        private final DriverRepository driverRepository;
        private final VehicleRepository vehicleRepository;
        private final DispatchedItemRepository dispatchedItemRepository;
        private final PacketItemRepository packetItemRepository;
        private final ChalaanPdfService chalaanPdfService;
        private final AuditLogService auditLogService;
        private final ActivityLogService activityLogService;
        private final CurrentUserService currentUserService;
        private final LogisticsTripLocationRepository tripLocationRepository;

        @org.springframework.beans.factory.annotation.Autowired(required = false)
        private UtlWorkflowService utlWorkflowService;

        @PersistenceContext
        private EntityManager entityManager;

        public LogisticsDispatchTripService(
                        LogisticsTripRepository tripRepository,
                        LogisticsTripItemRepository tripItemRepository,
                        DriverRepository driverRepository,
                        VehicleRepository vehicleRepository,
                        DispatchedItemRepository dispatchedItemRepository,
                        PacketItemRepository packetItemRepository,
                        ChalaanPdfService chalaanPdfService,
                        AuditLogService auditLogService,
                        ActivityLogService activityLogService,
                        CurrentUserService currentUserService,
                        LogisticsTripLocationRepository tripLocationRepository) {
                this.tripRepository = tripRepository;
                this.tripItemRepository = tripItemRepository;
                this.driverRepository = driverRepository;
                this.vehicleRepository = vehicleRepository;
                this.dispatchedItemRepository = dispatchedItemRepository;
                this.packetItemRepository = packetItemRepository;
                this.chalaanPdfService = chalaanPdfService;
                this.auditLogService = auditLogService;
                this.activityLogService = activityLogService;
                this.currentUserService = currentUserService;
                this.tripLocationRepository = tripLocationRepository;
        }

        @Transactional
        public DispatchTripPdfResult createTripAndGenerateChallan(
                        List<String> itemIds,
                        UUID driverId,
                        UUID vehicleId,
                        LocalDateTime tripStart,
                        String username,
                        String source) {
                List<String> cleanItemIds = cleanUniqueItemIds(itemIds);

                if (cleanItemIds.isEmpty()) {
                        throw new RuntimeException("No items selected for dispatch");
                }

                if (cleanItemIds.size() > MAX_TRIP_ITEMS) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "A maximum of " + MAX_TRIP_ITEMS
                                                        + " items can be dispatched in one trip");
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

                List<DispatchedItem> lockedItems = dispatchedItemRepository
                                .findAllByIdForDispatchUpdate(cleanItemIds);

                if (lockedItems.size() != cleanItemIds.size()) {
                        throw new RuntimeException("One or more dispatch items were not found");
                }

                Map<String, DispatchedItem> itemsById = new LinkedHashMap<>();

                for (DispatchedItem item : lockedItems) {
                        itemsById.put(item.getZohoItemId(), item);
                }

                List<DispatchedItem> items = new ArrayList<>();

                for (String itemId : cleanItemIds) {
                        DispatchedItem item = itemsById.get(itemId);

                        if (item == null) {
                                throw new RuntimeException(
                                                "Dispatch item not found: " + itemId);
                        }

                        items.add(item);
                }

                for (DispatchedItem item : items) {
                        if (utlWorkflowService != null) {
                                utlWorkflowService.assertCurrentUserCanOperate(item);
                        }

                        ItemDispatchStatus status = item.getStatus();

                        if (status == ItemDispatchStatus.LOADED ||
                                        status == ItemDispatchStatus.OUT_FOR_DELIVERY ||
                                        status == ItemDispatchStatus.DELIVERED ||
                                        status == ItemDispatchStatus.DISPATCHED) {
                                throw new RuntimeException(
                                                "Item already dispatched: "
                                                                + safe(item.getName())
                                                                + " | Challan: "
                                                                + safe(item.getChalaanNumber()));
                        }

                        if (status != ItemDispatchStatus.READY &&
                                        status != ItemDispatchStatus.READY_TO_DISPATCH) {
                                throw new RuntimeException(
                                                "Item must be READY or READY_TO_DISPATCH before dispatch: "
                                                                + safe(item.getName())
                                                                + " | Current: "
                                                                + status);
                        }
                }

                String challanNo = generateChallanNumber();

                ChalaanPdfData data = new ChalaanPdfData();

                data.setVoucherNo(challanNo);
                data.setDriverName(driver.getName());
                data.setVehicleNumber(vehicle.getVehicleNumber());
                data.setOt("-");

                List<ChalaanItem> chalaanItems = new ArrayList<>();

                Map<UUID, PacketItem> packetItemsById = loadPacketItemsById(items);

                for (DispatchedItem item : items) {
                        PacketItem packetItem = item.getPacketItemId() == null
                                        ? null
                                        : packetItemsById.get(item.getPacketItemId());

                        chalaanItems.add(
                                        buildChalaanItem(item, packetItem));
                }

                data.setItems(chalaanItems);

                if (!chalaanItems.isEmpty()) {
                        data.setAddress(
                                        safe(chalaanItems.get(0).getClientAddress()));
                }

                byte[] pdf = chalaanPdfService.generateChalaan(data);

                LocalDateTime now = LocalDateTime.now(APP_ZONE);

                LocalDateTime dispatchTime = tripStart != null
                                ? tripStart
                                : now;

                LogisticsTrip trip = new LogisticsTrip();

                trip.setDriver(driver);
                trip.setVehicle(vehicle);
                trip.setChallanNumber(challanNo);

                trip.setQueuedAt(dispatchTime);
                trip.setTripStart(dispatchTime);
                trip.setTripEnd(null);
                trip.setStatus(LogisticsTripStatus.DISPATCHED);

                trip.setTotalItems(items.size());
                trip.setSource(source);
                trip.setCreatedBy(safeActor(username));
                trip.setCreatedAt(now);
                trip.setUpdatedAt(now);

                trip = tripRepository.save(trip);

                List<LogisticsTripItem> tripItems = new ArrayList<>();

                for (DispatchedItem item : items) {
                        String oldStatus = item.getStatus() == null
                                        ? null
                                        : item.getStatus().name();

                        PacketItem packetItem = item.getPacketItemId() == null
                                        ? null
                                        : packetItemsById.get(item.getPacketItemId());

                        LogisticsTripItem tripItem = new LogisticsTripItem();

                        tripItem.setTrip(trip);
                        tripItem.setZohoItemId(item.getZohoItemId());
                        tripItem.setPacketItemId(item.getPacketItemId());

                        tripItem.setItemName(
                                        packetItem != null && packetItem.getItemName() != null
                                                        ? packetItem.getItemName()
                                                        : item.getName());

                        tripItem.setSku(
                                        packetItem != null && packetItem.getSku() != null
                                                        ? packetItem.getSku()
                                                        : item.getSku());

                        tripItem.setPdNo(
                                        packetItem != null && packetItem.getPdNo() != null
                                                        ? packetItem.getPdNo()
                                                        : item.getPdNo());

                        tripItem.setDrawingNo(
                                        packetItem != null && packetItem.getDrawingNo() != null
                                                        ? packetItem.getDrawingNo()
                                                        : item.getDrawingNo());

                        tripItem.setClientName(
                                        packetItem != null && packetItem.getClientName() != null
                                                        ? packetItem.getClientName()
                                                        : item.getClientName());

                        tripItem.setDescription(
                                        packetItem != null && packetItem.getDescription() != null
                                                        ? packetItem.getDescription()
                                                        : item.getDescription());

                        tripItem.setRemarks(
                                        packetItem != null && packetItem.getRemarks() != null
                                                        ? packetItem.getRemarks()
                                                        : item.getRemarks());

                        tripItems.add(tripItem);

                        item.setStatus(ItemDispatchStatus.DISPATCHED);
                        item.setChalaanNumber(challanNo);
                        item.setLogisticsTripId(trip.getId());

                        item.setDriverId(driver.getId());
                        item.setDriverName(driver.getName());

                        item.setVehicleId(vehicle.getId());
                        item.setVehicleNumber(vehicle.getVehicleNumber());

                        item.setTripStartedAt(null);
                        item.setTripEndedAt(null);
                        item.setDeliveredAt(null);

                        item.setDispatchedAt(dispatchTime);
                        item.setDispatchedBy(safeActor(username));

                        item.setStock(0);

                        if (packetItem != null) {
                                packetItem.setStatus("DISPATCHED");
                                packetItem.setLocation(item.getLocation());
                                packetItem.setCurrentLocationCode(item.getCurrentLocationCode());

                                packetItemRepository.save(packetItem);
                        }

                        auditLogService.log(
                                        item.getZohoItemId(),
                                        "Dispatched via challan | Challan: " + challanNo,
                                        safeActor(username),
                                        "DISPATCH");

                        activityLogService.log(
                                        item.getZohoItemId(),
                                        "DISPATCHED",
                                        safeActor(username),
                                        "DISPATCH",
                                        oldStatus,
                                        "DISPATCHED",
                                        challanNo);
                }

                tripItemRepository.saveAll(tripItems);
                dispatchedItemRepository.saveAll(items);

                return new DispatchTripPdfResult(
                                trip.getId(),
                                challanNo,
                                pdf);
        }

        @Transactional
        public LogisticsTrip startTrip(
                        UUID tripId,
                        User user,
                        LocalDateTime requestedStart) {
                if (!currentUserService.isDriver(user)) {
                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "Only DRIVER user can start trip");
                }

                if (user.getDriverId() == null) {
                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "Driver profile not linked with this user");
                }

                LogisticsTrip trip = requireTripForUpdate(
                                tripId);

                if (trip.getDriver() == null || trip.getDriver().getId() == null) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Trip driver missing");
                }

                if (!trip.getDriver().getId().equals(user.getDriverId())) {
                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "This trip is not assigned to your driver profile");
                }

                if (trip.getStatus() != LogisticsTripStatus.QUEUED) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Only queued trips can be started");
                }

                LocalDateTime start = requestedStart != null
                                ? requestedStart
                                : LocalDateTime.now(APP_ZONE);

                trip.setStatus(LogisticsTripStatus.OUT_FOR_DELIVERY);
                trip.setTripStart(start);
                trip.setUpdatedAt(LocalDateTime.now(APP_ZONE));

                tripRepository.save(trip);

                List<LogisticsTripItem> tripItems = tripItemRepository.findByTripId(tripId);

                for (LogisticsTripItem tripItem : tripItems) {
                        if (tripItem.getZohoItemId() == null) {
                                continue;
                        }

                        dispatchedItemRepository.findByIdForLifecycleUpdate(tripItem.getZohoItemId())
                                        .ifPresent(item -> {
                                                if (item.getStatus() != ItemDispatchStatus.LOADED) {
                                                        throw new ResponseStatusException(
                                                                        HttpStatus.BAD_REQUEST,
                                                                        "Only LOADED items can be started for delivery");
                                                }

                                                item.setStatus(ItemDispatchStatus.OUT_FOR_DELIVERY);
                                                item.setTripStartedAt(start);
                                                item.setDispatchedAt(start);
                                                item.setDispatchedBy(user.getUsername());

                                                dispatchedItemRepository.save(item);

                                                auditLogService.log(
                                                                item.getZohoItemId(),
                                                                "Driver started trip",
                                                                safeActor(user.getUsername()),
                                                                "DRIVER");

                                                activityLogService.log(
                                                                item.getZohoItemId(),
                                                                "OUT FOR DELIVERY",
                                                                safeActor(user.getUsername()),
                                                                "DRIVER",
                                                                "LOADED",
                                                                "OUT_FOR_DELIVERY",
                                                                item.getChalaanNumber());
                                        });
                }

                return trip;
        }

        @Transactional
        public LogisticsTrip updateTripLocation(
                        UUID tripId,
                        User user,
                        Double latitude,
                        Double longitude,
                        Double accuracy,
                        Double speed,
                        Double heading,
                        Double altitude) {
                if (!currentUserService.isDriver(user)) {
                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "Only DRIVER user can update live location");
                }

                if (user.getDriverId() == null) {
                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "Driver profile not linked with this user");
                }

                if (latitude == null || longitude == null) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Latitude and longitude required");
                }

                validateLocationSample(
                                latitude,
                                longitude,
                                accuracy,
                                speed,
                                heading,
                                altitude);

                LogisticsTrip trip = requireTripForUpdate(
                                tripId);

                if (trip.getDriver() == null || trip.getDriver().getId() == null) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Trip driver missing");
                }

                if (!trip.getDriver().getId().equals(user.getDriverId())) {
                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "This trip is not assigned to your driver profile");
                }

                if (trip.getStatus() != LogisticsTripStatus.OUT_FOR_DELIVERY) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Live location allowed only for active trips");
                }

                LocalDateTime now = LocalDateTime.now(APP_ZONE);

                trip.setCurrentLatitude(latitude);
                trip.setCurrentLongitude(longitude);
                trip.setCurrentLocationAccuracy(accuracy);
                trip.setCurrentSpeed(speed);
                trip.setCurrentHeading(heading);
                trip.setCurrentAltitude(altitude);
                trip.setCurrentLocationAt(now);
                trip.setCurrentLocationBy(user.getUsername());
                trip.setUpdatedAt(now);

                tripRepository.save(trip);

                LogisticsTripLocation location = new LogisticsTripLocation();
                location.setTrip(trip);
                location.setLatitude(latitude);
                location.setLongitude(longitude);
                location.setAccuracy(accuracy);
                location.setSpeed(speed);
                location.setHeading(heading);
                location.setAltitude(altitude);
                location.setRecordedAt(now);
                location.setRecordedBy(user.getUsername());

                tripLocationRepository.save(location);

                return trip;
        }

        @Transactional
        public LogisticsTrip endTrip(
                        UUID tripId,
                        LocalDateTime tripEnd,
                        User user,
                        String remarks,
                        String receiverName,
                        String receiverPhone,
                        String podUrl,
                        String deliveryRemarks,
                        Double deliveryLatitude,
                        Double deliveryLongitude,
                        Double deliveryLocationAccuracy) {
                if (!currentUserService.isDriver(user)) {
                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "Only DRIVER user can end trip");
                }

                if (user.getDriverId() == null) {
                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "Driver profile not linked with this user");
                }

                LogisticsTrip trip = requireTripForUpdate(
                                tripId);

                if (trip.getDriver() == null || trip.getDriver().getId() == null) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Trip driver missing");
                }

                if (!trip.getDriver().getId().equals(user.getDriverId())) {
                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "This trip is not assigned to your driver profile");
                }

                if (trip.getStatus() != LogisticsTripStatus.OUT_FOR_DELIVERY) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Only active out-for-delivery trips can be ended");
                }

                LocalDateTime finalEnd = tripEnd != null
                                ? tripEnd
                                : LocalDateTime.now(APP_ZONE);

                if (trip.getTripStart() != null && finalEnd.isBefore(trip.getTripStart())) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Trip end time cannot be before trip start time");
                }

                trip.setTripEnd(finalEnd);
                trip.setStatus(LogisticsTripStatus.DELIVERED);
                trip.setEndedBy(safeActor(user.getUsername()));
                trip.setUpdatedAt(LocalDateTime.now(APP_ZONE));

                String cleanRemarks = cleanLimited(
                                remarks,
                                MAX_DELIVERY_TEXT_LENGTH,
                                "Trip remarks");

                if (cleanRemarks != null) {
                        trip.setRemarks(cleanRemarks);
                }

                String cleanReceiverName = cleanLimited(
                                receiverName,
                                250,
                                "Receiver name");

                String cleanReceiverPhone = cleanLimited(
                                receiverPhone,
                                80,
                                "Receiver phone");

                String cleanPodUrl = validatePodUrl(
                                podUrl);

                String cleanDeliveryRemarks = cleanLimited(
                                deliveryRemarks,
                                MAX_DELIVERY_TEXT_LENGTH,
                                "Delivery remarks");

                validateDeliveryLocation(
                                deliveryLatitude,
                                deliveryLongitude,
                                deliveryLocationAccuracy);

                trip.setReceiverName(cleanReceiverName);
                trip.setReceiverPhone(cleanReceiverPhone);
                trip.setPodUrl(cleanPodUrl);
                trip.setDeliveryRemarks(cleanDeliveryRemarks);
                trip.setDeliveryLatitude(deliveryLatitude);
                trip.setDeliveryLongitude(deliveryLongitude);
                trip.setDeliveryLocationAccuracy(deliveryLocationAccuracy);

                List<LogisticsTripItem> tripItems = tripItemRepository.findByTripId(tripId);

                final String finalReceiverName = cleanReceiverName;
                final String finalReceiverPhone = cleanReceiverPhone;
                final String finalPodUrl = cleanPodUrl;
                final String finalDeliveryRemarks = cleanDeliveryRemarks;
                final Double finalDeliveryLatitude = deliveryLatitude;
                final Double finalDeliveryLongitude = deliveryLongitude;
                final Double finalDeliveryLocationAccuracy = deliveryLocationAccuracy;

                for (LogisticsTripItem tripItem : tripItems) {
                        dispatchedItemRepository
                                        .findByIdForLifecycleUpdate(tripItem.getZohoItemId())
                                        .ifPresent(item -> {
                                                if (item.getStatus() == ItemDispatchStatus.OUT_FOR_DELIVERY) {
                                                        item.setStatus(ItemDispatchStatus.DELIVERED);
                                                        item.setTripEndedAt(finalEnd);
                                                        item.setDeliveredAt(finalEnd);

                                                        item.setReceiverName(finalReceiverName);
                                                        item.setReceiverPhone(finalReceiverPhone);
                                                        item.setPodUrl(finalPodUrl);
                                                        item.setDeliveryRemarks(finalDeliveryRemarks);
                                                        item.setDeliveryLatitude(finalDeliveryLatitude);
                                                        item.setDeliveryLongitude(finalDeliveryLongitude);
                                                        item.setDeliveryLocationAccuracy(finalDeliveryLocationAccuracy);

                                                        dispatchedItemRepository.save(item);

                                                        auditLogService.log(
                                                                        item.getZohoItemId(),
                                                                        "Driver ended trip / Delivered",
                                                                        safeActor(user.getUsername()),
                                                                        "DRIVER");

                                                        activityLogService.log(
                                                                        item.getZohoItemId(),
                                                                        "DELIVERED",
                                                                        safeActor(user.getUsername()),
                                                                        "DRIVER",
                                                                        "OUT_FOR_DELIVERY",
                                                                        "DELIVERED",
                                                                        item.getChalaanNumber());
                                                }
                                        });
                }

                return tripRepository.save(trip);
        }

        @Transactional(readOnly = true)
        public DispatchTripPdfResult generateChallanPdfForTrip(
                        UUID tripId,
                        User user) {
                if (tripId == null) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Trip id is required");
                }

                LogisticsTrip trip = tripRepository.findById(tripId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Trip not found"));

                if (user != null && currentUserService.isDriver(user)) {
                        if (user.getDriverId() == null) {
                                throw new ResponseStatusException(
                                                HttpStatus.FORBIDDEN,
                                                "Driver profile not linked with this user");
                        }

                        if (trip.getDriver() == null ||
                                        trip.getDriver().getId() == null ||
                                        !trip.getDriver().getId().equals(user.getDriverId())) {
                                throw new ResponseStatusException(
                                                HttpStatus.FORBIDDEN,
                                                "This challan does not belong to your driver profile");
                        }
                }

                String challanNo = safe(trip.getChallanNumber());

                ChalaanPdfData data = new ChalaanPdfData();
                data.setVoucherNo(challanNo);

                if (trip.getDriver() != null) {
                        data.setDriverName(trip.getDriver().getName());
                }

                if (trip.getVehicle() != null) {
                        data.setVehicleNumber(trip.getVehicle().getVehicleNumber());
                }

                data.setOt("-");

                List<ChalaanItem> chalaanItems = new ArrayList<>();

                /*
                 * First source:
                 * logistics_trip_items table
                 */
                List<LogisticsTripItem> tripItems = tripItemRepository.findByTripId(tripId);

                if (tripItems != null && !tripItems.isEmpty()) {
                        LinkedHashSet<String> dispatchedIds = tripItems
                                        .stream()
                                        .map(LogisticsTripItem::getZohoItemId)
                                        .filter(value -> value != null && !value.isBlank())
                                        .collect(java.util.stream.Collectors.toCollection(
                                                        LinkedHashSet::new));

                        Map<String, DispatchedItem> dispatchedById = new LinkedHashMap<>();

                        if (!dispatchedIds.isEmpty()) {
                                dispatchedItemRepository.findAllById(dispatchedIds)
                                                .forEach(item -> dispatchedById.put(
                                                                item.getZohoItemId(),
                                                                item));
                        }

                        Map<UUID, PacketItem> packetItemsById = loadPacketItemsById(
                                        new ArrayList<>(dispatchedById.values()));

                        for (LogisticsTripItem tripItem : tripItems) {
                                DispatchedItem dispatchedItem = tripItem.getZohoItemId() == null
                                                ? null
                                                : dispatchedById.get(tripItem.getZohoItemId());

                                PacketItem packetItem = dispatchedItem == null
                                                || dispatchedItem.getPacketItemId() == null
                                                                ? null
                                                                : packetItemsById.get(
                                                                                dispatchedItem.getPacketItemId());

                                if (dispatchedItem != null) {
                                        chalaanItems.add(
                                                        buildChalaanItem(dispatchedItem, packetItem));
                                } else {
                                        ChalaanItem ci = new ChalaanItem();

                                        ci.setZohoItemId(tripItem.getZohoItemId());
                                        ci.setItemName(tripItem.getItemName());
                                        ci.setPdNo(tripItem.getPdNo());
                                        ci.setDrawingNo(tripItem.getDrawingNo());
                                        ci.setClientName(tripItem.getClientName());
                                        ci.setDescription(tripItem.getDescription());
                                        ci.setRemarks(tripItem.getRemarks());
                                        ci.setQty("1");

                                        chalaanItems.add(ci);
                                }
                        }
                }

                if (chalaanItems.isEmpty()) {
                        List<DispatchedItem> dispatchedItems =
                                        dispatchedItemRepository.findByLogisticsTripId(tripId);

                        if (dispatchedItems != null && !dispatchedItems.isEmpty()) {
                                Map<UUID, PacketItem> packetItemsById =
                                                loadPacketItemsById(dispatchedItems);

                                for (DispatchedItem item : dispatchedItems) {
                                        PacketItem packetItem = item.getPacketItemId() == null
                                                        ? null
                                                        : packetItemsById.get(
                                                                        item.getPacketItemId());

                                        chalaanItems.add(
                                                        buildChalaanItem(item, packetItem));
                                }
                        }
                }

                if (chalaanItems.isEmpty()) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "No items found for this trip challan");
                }

                data.setItems(chalaanItems);

                if (!chalaanItems.isEmpty()) {
                        data.setAddress(
                                        safe(chalaanItems.get(0).getClientAddress()));
                }

                byte[] pdf = chalaanPdfService.generateChalaan(data);

                return new DispatchTripPdfResult(
                                trip.getId(),
                                challanNo,
                                pdf);
        }

        @Transactional(readOnly = true)
        public List<LogisticsTrip> getTripsForUser(
                        User user) {
                if (currentUserService.isAdmin(user) ||
                                currentUserService.isDispatch(user) ||
                                currentUserService.isLogistics(user)) {
                        return tripRepository.findAllByOrderByQueuedAtDesc();
                }

                throw new ResponseStatusException(
                                HttpStatus.FORBIDDEN,
                                "You do not have permission to view dispatched challans");
        }

        @Transactional(readOnly = true)
        public List<LogisticsTripItemResponse> getTripItemsForUser(
                        UUID tripId,
                        User user) {
                if (tripId == null) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Trip id is required");
                }

                if (!currentUserService.isAdmin(user) &&
                                !currentUserService.isDispatch(user) &&
                                !currentUserService.isLogistics(user)) {
                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "You do not have permission to view dispatch items");
                }

                if (!tripRepository.existsById(tripId)) {
                        throw new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        "Dispatch challan not found");
                }

                return getTripItems(tripId);
        }

        public List<LogisticsTrip> getAllTrips() {
                return tripRepository.findAllByOrderByTripStartDesc();
        }

        private List<String> cleanUniqueItemIds(
                        List<String> itemIds) {

                if (itemIds == null || itemIds.isEmpty()) {
                        return List.of();
                }

                LinkedHashSet<String> unique = new LinkedHashSet<>();

                for (String itemId : itemIds) {
                        if (itemId == null) {
                                continue;
                        }

                        String clean = itemId.trim();

                        if (!clean.isBlank()) {
                                unique.add(clean);
                        }
                }

                return new ArrayList<>(unique);
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

                packetItemRepository.findAllById(ids)
                                .forEach(packetItem -> {
                                        if (packetItem != null && packetItem.getId() != null) {
                                                result.put(packetItem.getId(), packetItem);
                                        }
                                });

                return result;
        }

        private ChalaanItem buildChalaanItem(
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

                ci.setDrawingNo(
                                packetItem != null && packetItem.getDrawingNo() != null
                                                ? packetItem.getDrawingNo()
                                                : dispatchedItem.getDrawingNo());

                ci.setDescription(
                                packetItem != null && packetItem.getDescription() != null
                                                ? packetItem.getDescription()
                                                : dispatchedItem.getDescription());

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

        @Transactional(readOnly = true)
        public List<LogisticsTripItemResponse> getTripItems(
                        UUID tripId) {
                if (tripId == null) {
                        throw new RuntimeException("Trip id is required");
                }

                if (!tripRepository.existsById(tripId)) {
                        throw new RuntimeException("Trip not found");
                }

                return tripItemRepository.findByTripId(tripId)
                                .stream()
                                .map(item -> {
                                        LogisticsTripItemResponse dto = new LogisticsTripItemResponse();

                                        dto.setId(item.getId());

                                        if (item.getTrip() != null) {
                                                dto.setTripId(item.getTrip().getId());
                                        }

                                        dto.setZohoItemId(item.getZohoItemId());
                                        dto.setPacketItemId(item.getPacketItemId());
                                        dto.setItemName(item.getItemName());
                                        dto.setSku(item.getSku());
                                        dto.setPdNo(item.getPdNo());
                                        dto.setDrawingNo(item.getDrawingNo());
                                        dto.setClientName(item.getClientName());
                                        dto.setDescription(item.getDescription());
                                        dto.setRemarks(item.getRemarks());

                                        return dto;
                                })
                                .toList();
        }

        private String generateChallanNumber() {
                String date = java.time.LocalDate.now(APP_ZONE)
                                .format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);

                String suffix = UUID.randomUUID()
                                .toString()
                                .replace("-", "")
                                .substring(0, 12)
                                .toUpperCase();

                return "CH-" + date + "-" + suffix;
        }

        private LogisticsTrip requireTripForUpdate(
                        UUID tripId) {

                if (tripId == null) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Trip id is required");
                }

                LogisticsTrip trip = entityManager.find(
                                LogisticsTrip.class,
                                tripId,
                                LockModeType.PESSIMISTIC_WRITE);

                if (trip == null) {
                        throw new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        "Trip not found");
                }

                return trip;
        }

        private void validateLocationSample(
                        Double latitude,
                        Double longitude,
                        Double accuracy,
                        Double speed,
                        Double heading,
                        Double altitude) {

                requireFiniteRange(
                                latitude,
                                -90D,
                                90D,
                                "Latitude");

                requireFiniteRange(
                                longitude,
                                -180D,
                                180D,
                                "Longitude");

                optionalFiniteRange(
                                accuracy,
                                0D,
                                100_000D,
                                "Location accuracy");

                optionalFiniteRange(
                                speed,
                                0D,
                                200D,
                                "Speed");

                optionalFiniteRange(
                                heading,
                                0D,
                                360D,
                                "Heading");

                optionalFiniteRange(
                                altitude,
                                -1_000D,
                                20_000D,
                                "Altitude");
        }

        private void validateDeliveryLocation(
                        Double latitude,
                        Double longitude,
                        Double accuracy) {

                boolean hasLatitude = latitude != null;
                boolean hasLongitude = longitude != null;

                if (hasLatitude != hasLongitude) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Delivery latitude and longitude must be supplied together");
                }

                if (!hasLatitude) {
                        if (accuracy != null) {
                                throw new ResponseStatusException(
                                                HttpStatus.BAD_REQUEST,
                                                "Delivery location accuracy requires latitude and longitude");
                        }

                        return;
                }

                requireFiniteRange(
                                latitude,
                                -90D,
                                90D,
                                "Delivery latitude");

                requireFiniteRange(
                                longitude,
                                -180D,
                                180D,
                                "Delivery longitude");

                optionalFiniteRange(
                                accuracy,
                                0D,
                                100_000D,
                                "Delivery location accuracy");
        }

        private void requireFiniteRange(
                        Double value,
                        double min,
                        double max,
                        String label) {

                if (value == null ||
                                !Double.isFinite(value) ||
                                value < min ||
                                value > max) {

                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        label + " is invalid");
                }
        }

        private void optionalFiniteRange(
                        Double value,
                        double min,
                        double max,
                        String label) {

                if (value == null) {
                        return;
                }

                requireFiniteRange(
                                value,
                                min,
                                max,
                                label);
        }

        private String validatePodUrl(
                        String value) {

                String clean = cleanOrNull(value);

                if (clean == null) {
                        return null;
                }

                if (clean.length() > MAX_POD_URL_LENGTH) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "POD URL is too long");
                }

                if (clean.startsWith("/")) {
                        if (clean.startsWith("//")) {
                                throw new ResponseStatusException(
                                                HttpStatus.BAD_REQUEST,
                                                "POD URL is invalid");
                        }

                        return clean;
                }

                try {
                        URI uri = URI.create(clean);

                        String scheme = uri.getScheme();

                        if (scheme == null ||
                                        (!"http".equalsIgnoreCase(scheme)
                                                        && !"https".equalsIgnoreCase(scheme))) {
                                throw new ResponseStatusException(
                                                HttpStatus.BAD_REQUEST,
                                                "POD URL must use http or https");
                        }

                        if (uri.getHost() == null ||
                                        uri.getHost().isBlank()) {
                                throw new ResponseStatusException(
                                                HttpStatus.BAD_REQUEST,
                                                "POD URL host is missing");
                        }

                        return clean;

                } catch (IllegalArgumentException exception) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "POD URL is invalid");
                }
        }

        private String cleanLimited(
                        String value,
                        int maxLength,
                        String label) {

                String clean = cleanOrNull(value);

                if (clean != null &&
                                clean.length() > maxLength) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        label + " is too long");
                }

                return clean;
        }

        private String cleanOrNull(String value) {
                if (value == null || value.trim().isBlank()) {
                        return null;
                }

                return value.trim();
        }

        private String safe(Object value) {
                if (value == null)
                        return "-";

                String text = value.toString().trim();

                return text.isEmpty() ? "-" : text;
        }

        private String safeActor(String username) {
                return username != null && !username.isBlank()
                                ? username.trim()
                                : "SYSTEM";
        }
}