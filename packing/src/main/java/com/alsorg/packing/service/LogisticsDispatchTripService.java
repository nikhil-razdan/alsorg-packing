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

    public LogisticsDispatchTripService(
            LogisticsTripRepository tripRepository,
            LogisticsTripItemRepository tripItemRepository,
            DriverRepository driverRepository,
            VehicleRepository vehicleRepository,
            DispatchedItemRepository dispatchedItemRepository,
            PacketItemRepository packetItemRepository,
            ChalaanPdfService chalaanPdfService,
            AuditLogService auditLogService,
            ActivityLogService activityLogService
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

        LocalDateTime finalTripStart =
                tripStart != null
                        ? tripStart
                        : LocalDateTime.now();

        List<DispatchedItem> items =
                dispatchedItemRepository.findAllById(itemIds);

        if (items.size() != itemIds.size()) {
            throw new RuntimeException("One or more dispatch items were not found");
        }

        for (DispatchedItem item : items) {
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
                        "Item must be READY_TO_DISPATCH before trip creation: "
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

        LogisticsTrip trip = new LogisticsTrip();
        trip.setDriver(driver);
        trip.setVehicle(vehicle);
        trip.setChallanNumber(challanNo);
        trip.setTripStart(finalTripStart);
        trip.setTripEnd(null);
        trip.setStatus(LogisticsTripStatus.OUT_FOR_DELIVERY);
        trip.setTotalItems(items.size());
        trip.setSource(source);
        trip.setCreatedBy(safeActor(username));
        trip.setCreatedAt(LocalDateTime.now());

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

            item.setStatus(ItemDispatchStatus.OUT_FOR_DELIVERY);
            item.setChalaanNumber(challanNo);
            item.setLogisticsTripId(trip.getId());
            item.setDriverId(driver.getId());
            item.setDriverName(driver.getName());
            item.setVehicleId(vehicle.getId());
            item.setVehicleNumber(vehicle.getVehicleNumber());
            item.setTripStartedAt(finalTripStart);
            item.setDispatchedAt(finalTripStart);
            item.setDispatchedBy(safeActor(username));
            item.setStock(0);
        }

        tripItemRepository.saveAll(tripItems);
        dispatchedItemRepository.saveAll(items);

        for (DispatchedItem item : items) {
            auditLogService.log(
                    item.getZohoItemId(),
                    "Trip started | Challan: " + challanNo,
                    safeActor(username),
                    "DISPATCH"
            );

            activityLogService.log(
                    item.getZohoItemId(),
                    "OUT FOR DELIVERY",
                    safeActor(username),
                    "DISPATCH",
                    "READY_TO_DISPATCH",
                    "OUT_FOR_DELIVERY",
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
    public LogisticsTrip endTrip(
            UUID tripId,
            LocalDateTime tripEnd,
            String username,
            String remarks,
            String receiverName,
            String receiverPhone,
            String podUrl,
            String deliveryRemarks,
            Double deliveryLatitude,
            Double deliveryLongitude,
            Double deliveryLocationAccuracy
    ) {
        LogisticsTrip trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new RuntimeException("Trip not found"));

        if (trip.getStatus() != LogisticsTripStatus.OUT_FOR_DELIVERY) {
            throw new RuntimeException("Only active out-for-delivery trips can be ended");
        }

        LocalDateTime finalEnd =
                tripEnd != null
                        ? tripEnd
                        : LocalDateTime.now();

        if (trip.getTripStart() != null && finalEnd.isBefore(trip.getTripStart())) {
            throw new RuntimeException("Trip end time cannot be before trip start time");
        }

        trip.setTripEnd(finalEnd);
        trip.setStatus(LogisticsTripStatus.DELIVERED);
        trip.setEndedBy(safeActor(username));
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
                                    "Trip ended / Delivered",
                                    safeActor(username),
                                    "DISPATCH"
                            );

                            activityLogService.log(
                                    item.getZohoItemId(),
                                    "DELIVERED",
                                    safeActor(username),
                                    "DISPATCH",
                                    "OUT_FOR_DELIVERY",
                                    "DELIVERED",
                                    item.getChalaanNumber()
                            );
                        }
                    });
        }

        return tripRepository.save(trip);
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