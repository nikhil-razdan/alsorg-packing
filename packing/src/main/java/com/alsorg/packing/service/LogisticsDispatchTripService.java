package com.alsorg.packing.service;

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

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class LogisticsDispatchTripService {

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
            LogisticsTripLocationRepository tripLocationRepository
    ) {
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
            String source
    ) {
        if (itemIds == null || itemIds.isEmpty()) {
            throw new RuntimeException("No items selected for dispatch trip");
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

        List<DispatchedItem> items =
                dispatchedItemRepository.findAllById(itemIds);

        if (items.size() != itemIds.size()) {
            throw new RuntimeException("One or more dispatch items were not found");
        }

        for (DispatchedItem item : items) {
            if (item.getStatus() == ItemDispatchStatus.LOADED) {
                throw new RuntimeException(
                        "Item is already loaded / assigned to driver: " + safe(item.getName())
                );
            }

            if (item.getStatus() == ItemDispatchStatus.OUT_FOR_DELIVERY) {
                throw new RuntimeException(
                        "Item is already out for delivery: " + safe(item.getName())
                );
            }

            if (item.getStatus() == ItemDispatchStatus.DELIVERED) {
                throw new RuntimeException(
                        "Item is already delivered: " + safe(item.getName())
                );
            }

            if (item.getStatus() == ItemDispatchStatus.DISPATCHED) {
                throw new RuntimeException(
                        "Item already dispatched in old flow: " + safe(item.getName())
                );
            }

            if (item.getStatus() != ItemDispatchStatus.READY_TO_DISPATCH) {
                throw new RuntimeException(
                        "Item must be READY_TO_DISPATCH before loading trip: "
                                + safe(item.getName())
                                + " | Current: "
                                + item.getStatus()
                );
            }
        }

        String challanNo = generateChallanNumber();

        ChalaanPdfData data = new ChalaanPdfData();
        data.setVoucherNo(challanNo);
        data.setDriverName(driver.getName());
        data.setVehicleNumber(vehicle.getVehicleNumber());
        data.setOt("-");

        List<ChalaanItem> chalaanItems = new ArrayList<>();

        for (DispatchedItem item : items) {
            PacketItem packetItem = null;

            if (item.getPacketItemId() != null) {
                packetItem = packetItemRepository
                        .findById(item.getPacketItemId())
                        .orElse(null);
            }

            chalaanItems.add(
                    buildChalaanItem(item, packetItem)
            );
        }

        data.setItems(chalaanItems);

        if (!chalaanItems.isEmpty()) {
            data.setAddress(
                    safe(chalaanItems.get(0).getClientAddress())
            );
        }

        byte[] pdf = chalaanPdfService.generateChalaan(data);

        LocalDateTime now = LocalDateTime.now();

        LogisticsTrip trip = new LogisticsTrip();
        trip.setDriver(driver);
        trip.setVehicle(vehicle);
        trip.setChallanNumber(challanNo);

        /*
         * IMPORTANT:
         * Dispatch user is only loading / assigning the trip.
         * Driver has not started the trip yet.
         */
        trip.setQueuedAt(now);
        trip.setTripStart(null);
        trip.setTripEnd(null);
        trip.setStatus(LogisticsTripStatus.QUEUED);

        trip.setTotalItems(items.size());
        trip.setSource(source);
        trip.setCreatedBy(safeActor(username));
        trip.setCreatedAt(now);
        trip.setUpdatedAt(now);

        trip = tripRepository.save(trip);

        List<LogisticsTripItem> tripItems = new ArrayList<>();

        for (DispatchedItem item : items) {
            PacketItem packetItem = null;

            if (item.getPacketItemId() != null) {
                packetItem = packetItemRepository
                        .findById(item.getPacketItemId())
                        .orElse(null);
            }

            LogisticsTripItem tripItem = new LogisticsTripItem();
            tripItem.setTrip(trip);
            tripItem.setZohoItemId(item.getZohoItemId());
            tripItem.setPacketItemId(item.getPacketItemId());

            tripItem.setItemName(
                    packetItem != null && packetItem.getItemName() != null
                            ? packetItem.getItemName()
                            : item.getName()
            );

            tripItem.setSku(
                    packetItem != null && packetItem.getSku() != null
                            ? packetItem.getSku()
                            : item.getSku()
            );

            tripItem.setPdNo(
                    packetItem != null && packetItem.getPdNo() != null
                            ? packetItem.getPdNo()
                            : item.getPdNo()
            );

            tripItem.setDrawingNo(
                    packetItem != null && packetItem.getDrawingNo() != null
                            ? packetItem.getDrawingNo()
                            : item.getDrawingNo()
            );

            tripItem.setClientName(
                    packetItem != null && packetItem.getClientName() != null
                            ? packetItem.getClientName()
                            : item.getClientName()
            );

            tripItem.setDescription(
                    packetItem != null && packetItem.getDescription() != null
                            ? packetItem.getDescription()
                            : item.getDescription()
            );

            tripItem.setRemarks(
                    packetItem != null && packetItem.getRemarks() != null
                            ? packetItem.getRemarks()
                            : item.getRemarks()
            );

            tripItems.add(tripItem);

            /*
             * IMPORTANT:
             * Item is loaded/assigned only.
             * It is NOT out for delivery yet.
             */
            item.setStatus(ItemDispatchStatus.LOADED);
            item.setChalaanNumber(challanNo);
            item.setLogisticsTripId(trip.getId());

            item.setDriverId(driver.getId());
            item.setDriverName(driver.getName());

            item.setVehicleId(vehicle.getId());
            item.setVehicleNumber(vehicle.getVehicleNumber());

            item.setTripStartedAt(null);
            item.setTripEndedAt(null);
            item.setDeliveredAt(null);

            item.setDispatchedAt(null);
            item.setDispatchedBy(null);

            /*
             * Loaded item should not count as available dispatch stock.
             */
            item.setStock(0);
        }

        tripItemRepository.saveAll(tripItems);
        dispatchedItemRepository.saveAll(items);

        for (DispatchedItem item : items) {
            auditLogService.log(
                    item.getZohoItemId(),
                    "Loaded / assigned to driver | Challan: " + challanNo,
                    safeActor(username),
                    "DISPATCH"
            );

            activityLogService.log(
                    item.getZohoItemId(),
                    "LOADED / ASSIGNED TO DRIVER",
                    safeActor(username),
                    "DISPATCH",
                    "READY_TO_DISPATCH",
                    "LOADED",
                    challanNo
            );
        }

        return new DispatchTripPdfResult(
                trip.getId(),
                challanNo,
                pdf
        );
    }
    
    @Transactional
    public LogisticsTrip startTrip(
            UUID tripId,
            User user,
            LocalDateTime requestedStart
    ) {
        if (!currentUserService.isDriver(user)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only DRIVER user can start trip"
            );
        }

        if (user.getDriverId() == null) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Driver profile not linked with this user"
            );
        }

        LogisticsTrip trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Trip not found"
                ));

        if (trip.getDriver() == null || trip.getDriver().getId() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Trip driver missing"
            );
        }

        if (!trip.getDriver().getId().equals(user.getDriverId())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "This trip is not assigned to your driver profile"
            );
        }

        if (trip.getStatus() != LogisticsTripStatus.QUEUED) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Only queued trips can be started"
            );
        }

        LocalDateTime start =
                requestedStart != null
                        ? requestedStart
                        : LocalDateTime.now();

        trip.setStatus(LogisticsTripStatus.OUT_FOR_DELIVERY);
        trip.setTripStart(start);
        trip.setUpdatedAt(LocalDateTime.now());

        tripRepository.save(trip);

        List<LogisticsTripItem> tripItems =
                tripItemRepository.findByTripId(tripId);

        for (LogisticsTripItem tripItem : tripItems) {
            if (tripItem.getZohoItemId() == null) {
                continue;
            }

            dispatchedItemRepository.findById(tripItem.getZohoItemId())
                    .ifPresent(item -> {
                        if (item.getStatus() != ItemDispatchStatus.LOADED) {
                            throw new ResponseStatusException(
                                    HttpStatus.BAD_REQUEST,
                                    "Only LOADED items can be started for delivery"
                            );
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
                                "DRIVER"
                        );

                        activityLogService.log(
                                item.getZohoItemId(),
                                "OUT FOR DELIVERY",
                                safeActor(user.getUsername()),
                                "DRIVER",
                                "LOADED",
                                "OUT_FOR_DELIVERY",
                                item.getChalaanNumber()
                        );
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
            Double accuracy
    ) {
        if (!currentUserService.isDriver(user)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only DRIVER user can update live location"
            );
        }

        if (user.getDriverId() == null) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Driver profile not linked with this user"
            );
        }

        if (latitude == null || longitude == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Latitude and longitude required"
            );
        }

        LogisticsTrip trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Trip not found"
                ));

        if (trip.getDriver() == null || trip.getDriver().getId() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Trip driver missing"
            );
        }

        if (!trip.getDriver().getId().equals(user.getDriverId())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "This trip is not assigned to your driver profile"
            );
        }

        if (trip.getStatus() != LogisticsTripStatus.OUT_FOR_DELIVERY) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Live location allowed only for active trips"
            );
        }

        LocalDateTime now = LocalDateTime.now();

        trip.setCurrentLatitude(latitude);
        trip.setCurrentLongitude(longitude);
        trip.setCurrentLocationAccuracy(accuracy);
        trip.setCurrentLocationAt(now);
        trip.setCurrentLocationBy(user.getUsername());
        trip.setUpdatedAt(now);

        tripRepository.save(trip);

        LogisticsTripLocation location = new LogisticsTripLocation();
        location.setTrip(trip);
        location.setLatitude(latitude);
        location.setLongitude(longitude);
        location.setAccuracy(accuracy);
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
            Double deliveryLocationAccuracy
    ) {
        if (!currentUserService.isDriver(user)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only DRIVER user can end trip"
            );
        }

        if (user.getDriverId() == null) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Driver profile not linked with this user"
            );
        }

        LogisticsTrip trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Trip not found"
                ));

        if (trip.getDriver() == null || trip.getDriver().getId() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Trip driver missing"
            );
        }

        if (!trip.getDriver().getId().equals(user.getDriverId())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "This trip is not assigned to your driver profile"
            );
        }

        if (trip.getStatus() != LogisticsTripStatus.OUT_FOR_DELIVERY) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Only active out-for-delivery trips can be ended"
            );
        }

        LocalDateTime finalEnd =
                tripEnd != null
                        ? tripEnd
                        : LocalDateTime.now();

        if (trip.getTripStart() != null && finalEnd.isBefore(trip.getTripStart())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Trip end time cannot be before trip start time"
            );
        }

        trip.setTripEnd(finalEnd);
        trip.setStatus(LogisticsTripStatus.DELIVERED);
        trip.setEndedBy(safeActor(user.getUsername()));
        trip.setUpdatedAt(LocalDateTime.now());

        if (remarks != null && !remarks.isBlank()) {
            trip.setRemarks(remarks.trim());
        }

        trip.setReceiverName(cleanOrNull(receiverName));
        trip.setReceiverPhone(cleanOrNull(receiverPhone));
        trip.setPodUrl(cleanOrNull(podUrl));
        trip.setDeliveryRemarks(cleanOrNull(deliveryRemarks));
        trip.setDeliveryLatitude(deliveryLatitude);
        trip.setDeliveryLongitude(deliveryLongitude);
        trip.setDeliveryLocationAccuracy(deliveryLocationAccuracy);

        List<LogisticsTripItem> tripItems =
                tripItemRepository.findByTripId(tripId);

        final String finalReceiverName = cleanOrNull(receiverName);
        final String finalReceiverPhone = cleanOrNull(receiverPhone);
        final String finalPodUrl = cleanOrNull(podUrl);
        final String finalDeliveryRemarks = cleanOrNull(deliveryRemarks);
        final Double finalDeliveryLatitude = deliveryLatitude;
        final Double finalDeliveryLongitude = deliveryLongitude;
        final Double finalDeliveryLocationAccuracy = deliveryLocationAccuracy;

        for (LogisticsTripItem tripItem : tripItems) {
            dispatchedItemRepository
                    .findById(tripItem.getZohoItemId())
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
                                    "DRIVER"
                            );

                            activityLogService.log(
                                    item.getZohoItemId(),
                                    "DELIVERED",
                                    safeActor(user.getUsername()),
                                    "DRIVER",
                                    "OUT_FOR_DELIVERY",
                                    "DELIVERED",
                                    item.getChalaanNumber()
                            );
                        }
                    });
        }

        return tripRepository.save(trip);
    }

    @Transactional(readOnly = true)
public DispatchTripPdfResult generateChallanPdfForTrip(
        UUID tripId,
        User user
) {
    if (tripId == null) {
        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Trip id is required"
        );
    }

    LogisticsTrip trip = tripRepository.findById(tripId)
            .orElseThrow(() -> new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Trip not found"
            ));

    if (user != null && currentUserService.isDriver(user)) {
        if (user.getDriverId() == null) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Driver profile not linked with this user"
            );
        }

        if (
                trip.getDriver() == null ||
                trip.getDriver().getId() == null ||
                !trip.getDriver().getId().equals(user.getDriverId())
        ) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "This challan does not belong to your driver profile"
            );
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
    List<LogisticsTripItem> tripItems =
            tripItemRepository.findByTripId(tripId);

    if (tripItems != null && !tripItems.isEmpty()) {
        for (LogisticsTripItem tripItem : tripItems) {
            DispatchedItem dispatchedItem = null;
            PacketItem packetItem = null;

            if (tripItem.getZohoItemId() != null) {
                dispatchedItem = dispatchedItemRepository
                        .findById(tripItem.getZohoItemId())
                        .orElse(null);
            }

            if (
                    dispatchedItem != null &&
                    dispatchedItem.getPacketItemId() != null
            ) {
                packetItem = packetItemRepository
                        .findById(dispatchedItem.getPacketItemId())
                        .orElse(null);
            }

            if (dispatchedItem != null) {
                chalaanItems.add(
                        buildChalaanItem(dispatchedItem, packetItem)
                );
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

    /*
     * Fallback source:
     * dispatched_items table by logisticsTripId.
     * This protects older/current trips where logistics_trip_items
     * lookup does not return rows for any reason.
     */
    if (chalaanItems.isEmpty()) {
        List<DispatchedItem> dispatchedItems =
                dispatchedItemRepository.findByLogisticsTripId(tripId);

        if (dispatchedItems != null && !dispatchedItems.isEmpty()) {
            for (DispatchedItem item : dispatchedItems) {
                PacketItem packetItem = null;

                if (item.getPacketItemId() != null) {
                    packetItem = packetItemRepository
                            .findById(item.getPacketItemId())
                            .orElse(null);
                }

                chalaanItems.add(
                        buildChalaanItem(item, packetItem)
                );
            }
        }
    }

    if (chalaanItems.isEmpty()) {
        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "No items found for this trip challan"
        );
    }

    data.setItems(chalaanItems);

    if (!chalaanItems.isEmpty()) {
        data.setAddress(
                safe(chalaanItems.get(0).getClientAddress())
        );
    }

    byte[] pdf = chalaanPdfService.generateChalaan(data);

    return new DispatchTripPdfResult(
            trip.getId(),
            challanNo,
            pdf
    );
}
    
    public List<LogisticsTrip> getAllTrips() {
        return tripRepository.findAllByOrderByTripStartDesc();
    }

    private ChalaanItem buildChalaanItem(
            DispatchedItem dispatchedItem,
            PacketItem packetItem
    ) {
        ChalaanItem ci = new ChalaanItem();

        ci.setZohoItemId(dispatchedItem.getZohoItemId());

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

        ci.setDrawingNo(
                packetItem != null && packetItem.getDrawingNo() != null
                        ? packetItem.getDrawingNo()
                        : dispatchedItem.getDrawingNo()
        );

        ci.setDescription(
                packetItem != null && packetItem.getDescription() != null
                        ? packetItem.getDescription()
                        : dispatchedItem.getDescription()
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
    
    @Transactional(readOnly = true)
    public List<LogisticsTripItemResponse> getTripItems(
            UUID tripId
    ) {
        if (tripId == null) {
            throw new RuntimeException("Trip id is required");
        }

        if (!tripRepository.existsById(tripId)) {
            throw new RuntimeException("Trip not found");
        }

        return tripItemRepository.findByTripId(tripId)
                .stream()
                .map(item -> {
                    LogisticsTripItemResponse dto =
                            new LogisticsTripItemResponse();

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
        return "CH-" + System.currentTimeMillis();
    }

    private String cleanOrNull(String value) {
        if (value == null || value.trim().isBlank()) {
            return null;
        }

        return value.trim();
    }
    
    private String safe(Object value) {
        if (value == null) return "-";

        String text = value.toString().trim();

        return text.isEmpty() ? "-" : text;
    }

    private String safeActor(String username) {
        return username != null && !username.isBlank()
                ? username.trim()
                : "SYSTEM";
    }
}